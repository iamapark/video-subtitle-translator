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
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = require("@ffmpeg-installer/ffmpeg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const translate_video_1 = require("./translate_video");
const file_1 = require("./util/file");
// FFmpeg 경로 설정
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.path);
// 메인 함수
async function main() {
    // 커맨드 라인 인자 처리
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('사용법: npm run start "입력 파일 경로" ["출력 디렉토리 경로"]');
        console.error('예시: npm run start "./videos/input.mp4" "./output"');
        return;
    }
    // 입력 파일 경로
    const inputVideoPath = path.resolve(args[0]);
    // 출력 디렉토리 설정 (기본값: 입력 파일의 디렉토리)
    const outputDir = args[1]
        ? path.resolve(args[1])
        : path.dirname(inputVideoPath);
    // 출력 디렉토리 생성
    (0, file_1.ensureDirectoryExists)(outputDir);
    // 출력 파일 경로 설정 (원본 파일명_subtitle.mp4)
    const originalFileName = path.basename(inputVideoPath, path.extname(inputVideoPath));
    const outputVideoPath = path.join(outputDir, `${originalFileName}_subtitle.mp4`);
    // 입력 파일이 존재하는지 확인
    if (!fs.existsSync(inputVideoPath)) {
        console.error(`입력 비디오 파일이 없습니다: ${inputVideoPath}`);
        return;
    }
    try {
        console.log(`입력 파일: ${inputVideoPath}`);
        console.log(`출력 파일: ${outputVideoPath}`);
        await (0, translate_video_1.translateVideo)(inputVideoPath, outputVideoPath);
        console.log("영상 처리가 완료되었습니다!");
    }
    catch (error) {
        console.error("오류 발생:", error);
    }
}
// 프로그램 실행
main();
