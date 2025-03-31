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
exports.getVideoDuration = getVideoDuration;
exports.trimVideo = trimVideo;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = require("@ffmpeg-installer/ffmpeg");
const ffprobe_1 = require("@ffprobe-installer/ffprobe");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// FFmpeg 및 FFprobe 경로 설정
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.path);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.path);
/**
 * 비디오 파일의 길이를 초 단위로 가져오는 함수
 * @param videoPath 비디오 파일 경로
 * @returns 비디오 길이(초)
 */
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            if (!metadata?.format?.duration) {
                reject(new Error("Could not get video duration"));
                return;
            }
            resolve(metadata.format.duration);
        });
    });
}
/**
 * 시간 문자열을 초로 변환하는 함수 (예: "3~5" -> { start: 180, end: 300 }, "3~" -> { start: 180, end: null })
 */
function parseTimeRange(timeRange) {
    const [startStr, endStr] = timeRange.split("~");
    const start = parseInt(startStr, 10);
    if (isNaN(start)) {
        throw new Error('시간 형식이 잘못되었습니다. "시작~종료" 형식으로 입력해주세요. (예: "3~5" 또는 "3~")');
    }
    // 끝 시간이 지정되지 않은 경우
    if (!endStr) {
        return {
            start: start * 60,
            end: null,
        };
    }
    const end = parseInt(endStr, 10);
    if (isNaN(end)) {
        throw new Error('시간 형식이 잘못되었습니다. "시작~종료" 형식으로 입력해주세요. (예: "3~5" 또는 "3~")');
    }
    if (start >= end) {
        throw new Error("종료 시간은 시작 시간보다 커야 합니다.");
    }
    // 분을 초로 변환
    return {
        start: start * 60,
        end: end * 60,
    };
}
/**
 * 입력값 검증 및 준비 작업을 수행하는 함수
 */
function validateAndPrepare(options) {
    const { inputPath, outputPath, timeRange } = options;
    // 입력 파일 존재 확인
    if (!fs.existsSync(inputPath)) {
        throw new Error(`입력 파일이 없습니다: ${inputPath}`);
    }
    // 출력 디렉토리 확인 및 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // 시간 범위 파싱
    return parseTimeRange(timeRange);
}
/**
 * 비디오 파일을 지정된 시간 범위로 자르는 함수
 * @param inputPath 입력 비디오 파일 경로
 * @param outputPath 출력 비디오 파일 경로
 * @param timeRange 시간 범위 (예: "3~5")
 */
async function trimVideo(inputPath, outputPath, timeRange) {
    const { start, end } = validateAndPrepare({
        inputPath,
        outputPath,
        timeRange,
    });
    return new Promise((resolve, reject) => {
        console.log(`${inputPath} 파일의 ${start / 60}분부터 ${end ? end / 60 + "분" : "끝"}까지 영상 생성 중...`);
        let command = (0, fluent_ffmpeg_1.default)(inputPath).setStartTime(start);
        // 종료 시간이 지정된 경우에만 duration 설정
        if (end !== null) {
            command = command.setDuration(end - start);
        }
        command
            .output(outputPath)
            .on("end", () => {
            console.log("영상 생성 완료 ✅:", outputPath);
            resolve();
        })
            .on("error", (err) => {
            console.error("오류 발생 ❌:", err);
            reject(err);
        })
            .run();
    });
}
// 커맨드 라인 실행을 위한 메인 함수
async function main() {
    const [inputPath, outputPath, timeRange] = process.argv.slice(2);
    if (!inputPath || !outputPath || !timeRange) {
        console.error('사용법: npm run trim "입력파일" "출력파일" "시작~종료"');
        console.error('예시: npm run trim "input.mp4" "output.mp4" "3~5"');
        console.error('      npm run trim "./videos/input.mp4" "./output/result.mp4" "3~"');
        process.exit(1);
    }
    try {
        await trimVideo(path.resolve(inputPath), path.resolve(outputPath), timeRange);
    }
    catch (err) {
        console.error("프로그램 실행 중 오류 발생 ❌:", err);
        process.exit(1);
    }
}
// 이 파일이 직접 실행될 때만 main 함수 실행
if (require.main === module) {
    main();
}
