import { parentPort, workerData } from "worker_threads";
import { extractAudio } from "../libs/audio/extract";
import { transcribeAudio } from "../libs/speech/transcribe";
import { splitSegments } from "../segment_utils";
import { translateSegmentsWithGemini } from "../libs/translator/gemini_translator";
import {
  saveTranscriptionResult,
  loadTranscriptionResult,
} from "../libs/transcription/storage";
import { trimVideo } from "../trim_video";
import { logWithTimestamp } from "../util/logger";
import * as path from "path";
import * as fs from "fs";
import { SubtitleSegment } from "../types";

interface WorkerInput {
  inputVideoPath: string;
  workDir: string;
  chunkIndex: number;
  totalChunks: number;
  timeRange: string;
  timeOffset: number;
}

async function processChunk(input: WorkerInput) {
  const {
    inputVideoPath,
    workDir,
    chunkIndex,
    totalChunks,
    timeRange,
    timeOffset,
  } = input;

  try {
    logWithTimestamp(`Worker ${chunkIndex + 1}: 청크 처리 시작 (${timeRange})`);

    // 비디오 청크 생성
    const chunkVideoPath = path.join(workDir, `chunk_${chunkIndex + 1}.mp4`);
    await trimVideo(inputVideoPath, chunkVideoPath, timeRange);

    // 오디오 추출 (mp4 -> wav)
    logWithTimestamp(`Worker ${chunkIndex + 1}: 오디오 추출 중...`);
    const chunkAudioPath = path.join(workDir, `chunk_${chunkIndex + 1}.wav`);
    await extractAudio(chunkVideoPath, chunkAudioPath);

    // 음성 인식 (wav -> json)
    logWithTimestamp(`Worker ${chunkIndex + 1}: 음성 인식 중...`);
    const segments = await transcribeAudio(chunkAudioPath);
    const splitResult = splitSegments(segments);

    // 시간 오프셋 적용
    const offsetSegments = splitResult.map((segment) => ({
      ...segment,
      start: segment.start + timeOffset,
      end: segment.end + timeOffset,
    }));

    // 음성 인식 결과 저장
    const transcriptionPath = path.join(
      workDir,
      `transcription_${chunkIndex + 1}.json`
    );
    logWithTimestamp(`Worker ${chunkIndex + 1}: 음성 인식 결과 저장 중...`);
    saveTranscriptionResult(offsetSegments, transcriptionPath);

    // 음성 인식 결과 로드 및 번역
    logWithTimestamp(`Worker ${chunkIndex + 1}: 음성 인식 결과 로드 중...`);
    const transcriptionResult = loadTranscriptionResult(transcriptionPath);
    logWithTimestamp(
      `Worker ${chunkIndex + 1}: 로드된 음성 인식 세그먼트 수: ${
        transcriptionResult.length
      }`
    );

    let translatedSegments: SubtitleSegment[] = [];
    // 세그먼트를 번역
    if (transcriptionResult.length > 0) {
      logWithTimestamp(`Worker ${chunkIndex + 1}: 번역 시작...`);
      translatedSegments = await translateSegmentsWithGemini(
        transcriptionResult
      ).catch((error) => {
        console.error(`Worker ${chunkIndex + 1}: 번역 중 오류 발생:`, error);
        return [];
      });
      logWithTimestamp(
        `Worker ${chunkIndex + 1}: 번역 완료. 세그먼트 수: ${
          translatedSegments.length
        }`
      );
    }

    // 임시 파일 정리
    fs.unlinkSync(chunkVideoPath);
    fs.unlinkSync(chunkAudioPath);
    fs.unlinkSync(transcriptionPath);

    // 결과 반환
    parentPort?.postMessage({
      success: true,
      chunkIndex,
      segments: translatedSegments,
    });
  } catch (error) {
    parentPort?.postMessage({
      success: false,
      chunkIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Worker 메시지 처리
if (parentPort) {
  processChunk(workerData).catch((error) => {
    parentPort?.postMessage({
      success: false,
      chunkIndex: workerData.chunkIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
