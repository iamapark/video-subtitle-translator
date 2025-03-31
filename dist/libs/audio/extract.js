"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAudio = extractAudio;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = require("@ffmpeg-installer/ffmpeg");
// FFmpeg 경로 설정
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.path);
/**
 * 비디오 파일에서 오디오를 추출하는 함수
 * @param inputPath 입력 비디오 파일 경로
 * @param outputPath 출력 오디오 파일 경로
 * @returns Promise<void>
 */
async function extractAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
            .toFormat("wav")
            .outputOptions("-acodec pcm_s16le")
            .outputOptions("-ac 1")
            .outputOptions("-ar 16000")
            .save(outputPath)
            .on("end", () => resolve())
            .on("error", reject);
    });
}
