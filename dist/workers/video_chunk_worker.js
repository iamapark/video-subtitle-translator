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
const worker_threads_1 = require("worker_threads");
const extract_1 = require("../libs/audio/extract");
const transcribe_1 = require("../libs/speech/transcribe");
const segment_utils_1 = require("../segment_utils");
const gemini_translator_1 = require("../libs/translator/gemini_translator");
const storage_1 = require("../libs/transcription/storage");
const trim_video_1 = require("../trim_video");
const logger_1 = require("../util/logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function processChunk(input) {
    const { inputVideoPath, workDir, chunkIndex, totalChunks, timeRange, timeOffset, } = input;
    try {
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 청크 처리 시작 (${timeRange})`);
        // 비디오 청크 생성
        const chunkVideoPath = path.join(workDir, `chunk_${chunkIndex + 1}.mp4`);
        await (0, trim_video_1.trimVideo)(inputVideoPath, chunkVideoPath, timeRange);
        // 오디오 추출 (mp4 -> wav)
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 오디오 추출 중...`);
        const chunkAudioPath = path.join(workDir, `chunk_${chunkIndex + 1}.wav`);
        await (0, extract_1.extractAudio)(chunkVideoPath, chunkAudioPath);
        // 음성 인식 (wav -> json)
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 음성 인식 중...`);
        const segments = await (0, transcribe_1.transcribeAudio)(chunkAudioPath);
        const splitResult = (0, segment_utils_1.splitSegments)(segments);
        // 시간 오프셋 적용
        const offsetSegments = splitResult.map((segment) => ({
            ...segment,
            start: segment.start + timeOffset,
            end: segment.end + timeOffset,
        }));
        // 음성 인식 결과 저장
        const transcriptionPath = path.join(workDir, `transcription_${chunkIndex + 1}.json`);
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 음성 인식 결과 저장 중...`);
        (0, storage_1.saveTranscriptionResult)(offsetSegments, transcriptionPath);
        // 음성 인식 결과 로드 및 번역
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 음성 인식 결과 로드 중...`);
        const transcriptionResult = (0, storage_1.loadTranscriptionResult)(transcriptionPath);
        (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 로드된 음성 인식 세그먼트 수: ${transcriptionResult.length}`);
        let translatedSegments = [];
        // 세그먼트를 번역
        if (transcriptionResult.length > 0) {
            (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 번역 시작...`);
            translatedSegments = await (0, gemini_translator_1.translateSegmentsWithGemini)(transcriptionResult).catch((error) => {
                console.error(`Worker ${chunkIndex + 1}: 번역 중 오류 발생:`, error);
                return [];
            });
            (0, logger_1.logWithTimestamp)(`Worker ${chunkIndex + 1}: 번역 완료. 세그먼트 수: ${translatedSegments.length}`);
        }
        // 임시 파일 정리
        fs.unlinkSync(chunkVideoPath);
        fs.unlinkSync(chunkAudioPath);
        fs.unlinkSync(transcriptionPath);
        // 결과 반환
        worker_threads_1.parentPort?.postMessage({
            success: true,
            chunkIndex,
            segments: translatedSegments,
        });
    }
    catch (error) {
        worker_threads_1.parentPort?.postMessage({
            success: false,
            chunkIndex,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
// Worker 메시지 처리
if (worker_threads_1.parentPort) {
    processChunk(worker_threads_1.workerData).catch((error) => {
        worker_threads_1.parentPort?.postMessage({
            success: false,
            chunkIndex: worker_threads_1.workerData.chunkIndex,
            error: error instanceof Error ? error.message : String(error),
        });
    });
}
