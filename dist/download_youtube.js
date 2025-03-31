"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ffmpegInstaller = __importStar(require("@ffmpeg-installer/ffmpeg"));
const child_process_1 = require("child_process");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path = __importStar(require("path"));
const util_1 = require("util");
const file_1 = require("./util/file");
const logger_1 = require("./util/logger");
// FFmpeg 설정
fluent_ffmpeg_1.default.setFfmpegPath(ffmpegInstaller.path);
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function getVideoInfo(url) {
    try {
        const { stdout } = await execAsync(`yt-dlp -j "${url}"`);
        return JSON.parse(stdout);
    }
    catch (error) {
        throw new Error(`Failed to get video info: ${error}`);
    }
}
async function downloadStream(url, format, output) {
    try {
        await execAsync(`yt-dlp -f ${format} -o "${output}" "${url}"`);
    }
    catch (error) {
        throw new Error(`Failed to download stream: ${error}`);
    }
}
async function mergeStreams(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(["-c:v copy", "-c:a aac", "-strict experimental"])
            .output(outputPath)
            .on("start", () => {
            (0, logger_1.logWithTimestamp)("Started merging video and audio...");
        })
            .on("progress", (progress) => {
            if (progress.percent) {
                process.stdout.write(`\rMerging progress: ${progress.percent.toFixed(2)}%`);
            }
        })
            .on("end", () => {
            process.stdout.write("\n");
            (0, logger_1.logWithTimestamp)("Merge completed successfully");
            resolve();
        })
            .on("error", (err) => {
            (0, logger_1.logWithTimestamp)(`Error during merge: ${err.message}`);
            reject(new Error(`Failed to merge streams: ${err.message}`));
        })
            .run();
    });
}
async function downloadYouTubeVideo(url) {
    let tempVideoPath = null;
    let tempAudioPath = null;
    const tempDir = path.join(process.cwd(), "output", "temp");
    try {
        // 출력 디렉토리 생성
        const outputDir = path.join(process.cwd(), "output");
        (0, file_1.ensureDirectoryExists)(outputDir);
        (0, file_1.ensureDirectoryExists)(tempDir);
        // 비디오 정보 가져오기
        (0, logger_1.logWithTimestamp)("Getting video information...");
        const videoInfo = await getVideoInfo(url);
        const safeTitle = videoInfo.title
            .replace(/[^\w\s-]/g, "") // 알파벳, 숫자, 공백, 하이픈만 허용
            .replace(/\s+/g, "_"); // 공백을 underscore로 변경
        tempVideoPath = path.join(tempDir, `${safeTitle}_video.mp4`);
        tempAudioPath = path.join(tempDir, `${safeTitle}_audio.m4a`);
        const finalOutputPath = path.join(outputDir, `${safeTitle}.mp4`);
        // 최고 화질 비디오 다운로드 (오디오 없음)
        (0, logger_1.logWithTimestamp)("Downloading video stream (highest quality)...");
        await downloadStream(url, "bestvideo[ext=mp4]", tempVideoPath);
        // 최고 품질 오디오 다운로드
        (0, logger_1.logWithTimestamp)("Downloading audio stream (highest quality)...");
        await downloadStream(url, "bestaudio[ext=m4a]", tempAudioPath);
        // 비디오와 오디오 합치기
        (0, logger_1.logWithTimestamp)("Merging video and audio streams...");
        await mergeStreams(tempVideoPath, tempAudioPath, finalOutputPath);
        // 임시 파일 정리
        (0, logger_1.logWithTimestamp)("Cleaning up temporary files...");
        (0, file_1.removeDirectoryRecursive)(tempDir);
        (0, logger_1.logWithTimestamp)("Download and merge completed successfully!");
        (0, logger_1.logWithTimestamp)(`Video saved to: ${finalOutputPath}`);
    }
    catch (error) {
        // 에러 발생 시 임시 파일 정리
        try {
            (0, file_1.removeDirectoryRecursive)(tempDir);
        }
        catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
        }
        console.error("Error downloading video:", error);
        throw error;
    }
}
// 메인 실행 함수
async function main() {
    const url = process.argv[2];
    if (!url) {
        console.error("Error: YouTube URL is required");
        console.log("Usage: npm run download_youtube <youtube_url>");
        process.exit(1);
    }
    try {
        await downloadYouTubeVideo(url);
    }
    catch (error) {
        console.error("Failed to download video:", error);
        process.exit(1);
    }
}
// 스크립트 실행
main();
