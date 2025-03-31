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
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateVideo = translateVideo;
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const worker_threads_1 = require("worker_threads");
const merge_subtitle_1 = require("./merge_subtitle");
const logger_1 = require("./util/logger");
const file_1 = require("./util/file");
const srt_1 = require("./libs/srt");
const trim_video_1 = require("./trim_video");
// 환경 변수 로드
dotenv.config();
// Worker Thread 수 설정
const nThread = 3; // 동시에 처리할 최대 worker 수
// Worker 생성 함수
function createWorker(workerData) {
    return new Promise((resolve, reject) => {
        const worker = new worker_threads_1.Worker(path.join(__dirname, "workers", "video_chunk_worker.js"), {
            workerData,
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}
// 메인 처리 함수
async function translateVideo(inputVideoPath, outputVideoPath) {
    try {
        // 작업 디렉토리 설정
        const workDir = path.join(path.dirname(inputVideoPath), "temp");
        (0, file_1.ensureDirectoryExists)(workDir);
        // 비디오 길이 확인
        const duration = await (0, trim_video_1.getVideoDuration)(inputVideoPath);
        const CHUNK_MINUTES = 10;
        const CHUNK_SECONDS = CHUNK_MINUTES * 60;
        const numChunks = Math.ceil(duration / CHUNK_SECONDS);
        (0, logger_1.logWithTimestamp)(`전체 비디오 길이: ${Math.floor(duration / 60)}분 ${Math.floor(duration % 60)}초`);
        (0, logger_1.logWithTimestamp)(`${CHUNK_MINUTES}분 단위로 분할 처리 (총 ${numChunks}개 청크, ${nThread}개의 worker 사용)`);
        // 청크 처리를 위한 배열 준비
        const chunks = Array.from({ length: numChunks }, (_, i) => {
            const chunkStart = i * CHUNK_MINUTES;
            const chunkEnd = Math.min((i + 1) * CHUNK_MINUTES, Math.ceil(duration / 60));
            return {
                chunkIndex: i,
                timeRange: `${chunkStart}~${chunkEnd}`,
                timeOffset: i * CHUNK_SECONDS,
            };
        });
        // Worker pool을 사용한 병렬 처리
        const results = [];
        for (let i = 0; i < chunks.length; i += nThread) {
            const chunkGroup = chunks.slice(i, i + nThread);
            const workerPromises = chunkGroup.map((chunk) => createWorker({
                inputVideoPath,
                workDir,
                chunkIndex: chunk.chunkIndex,
                totalChunks: numChunks,
                timeRange: chunk.timeRange,
                timeOffset: chunk.timeOffset,
            }));
            const chunkResults = await Promise.all(workerPromises);
            // 에러 체크 및 결과 처리
            for (const result of chunkResults) {
                if (!result.success) {
                    throw new Error(`Worker error in chunk ${result.chunkIndex + 1}: ${result.error}`);
                }
                if (result.segments) {
                    results[result.chunkIndex] = result.segments;
                }
            }
            (0, logger_1.logWithTimestamp)(`${i + chunkGroup.length}/${numChunks} 청크 처리 완료`);
        }
        // 모든 번역된 세그먼트를 순서대로 합치기
        const allTranslatedSegments = results.flat();
        // 병합된 번역 결과를 사용하여 자막 파일 생성
        (0, logger_1.logWithTimestamp)("최종 자막 파일 생성 중...");
        const subtitlePath = path.join(workDir, "subtitle.srt");
        (0, srt_1.createSRTFile)(allTranslatedSegments, subtitlePath);
        // 자막 합성
        (0, logger_1.logWithTimestamp)("자막 합성 중...");
        await (0, merge_subtitle_1.mergeSubtitles)(inputVideoPath, subtitlePath, outputVideoPath);
        (0, logger_1.logWithTimestamp)("모든 처리 완료!");
    }
    catch (error) {
        console.error("비디오 처리 중 오류 발생:", error);
        throw error;
    }
}
