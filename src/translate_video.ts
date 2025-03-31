import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Worker } from "worker_threads";
import { mergeSubtitles } from "./merge_subtitle";
import { translateSegmentsWithGemini } from "./libs/translator/gemini_translator";
import { SubtitleSegment } from "./types";
import { splitSegments } from "./segment_utils";
import { transcribeAudio } from "./libs/speech/transcribe";
import { logWithTimestamp } from "./util/logger";
import { extractAudio } from "./libs/audio/extract";
import { ensureDirectoryExists } from "./util/file";
import { createSRTFile } from "./libs/srt";
import {
  saveTranscriptionResult,
  loadTranscriptionResult,
} from "./libs/transcription/storage";
import { trimVideo, getVideoDuration } from "./trim_video";

// 환경 변수 로드
dotenv.config();

// Worker Thread 수 설정
const nThread = 3; // 동시에 처리할 최대 worker 수

// Worker 생성 함수
function createWorker(workerData: any): Promise<{
  success: boolean;
  chunkIndex: number;
  segments?: SubtitleSegment[];
  error?: string;
}> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, "workers", "video_chunk_worker.js"),
      {
        workerData,
      }
    );

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
export async function translateVideo(
  inputVideoPath: string,
  outputVideoPath: string
): Promise<void> {
  try {
    // 작업 디렉토리 설정
    const workDir = path.join(path.dirname(inputVideoPath), "temp");
    ensureDirectoryExists(workDir);

    // 비디오 길이 확인
    const duration = await getVideoDuration(inputVideoPath);
    const CHUNK_MINUTES = 10;
    const CHUNK_SECONDS = CHUNK_MINUTES * 60;
    const numChunks = Math.ceil(duration / CHUNK_SECONDS);

    logWithTimestamp(
      `전체 비디오 길이: ${Math.floor(duration / 60)}분 ${Math.floor(
        duration % 60
      )}초`
    );
    logWithTimestamp(
      `${CHUNK_MINUTES}분 단위로 분할 처리 (총 ${numChunks}개 청크, ${nThread}개의 worker 사용)`
    );

    // 청크 처리를 위한 배열 준비
    const chunks = Array.from({ length: numChunks }, (_, i) => {
      const chunkStart = i * CHUNK_MINUTES;
      const chunkEnd = Math.min(
        (i + 1) * CHUNK_MINUTES,
        Math.ceil(duration / 60)
      );
      return {
        chunkIndex: i,
        timeRange: `${chunkStart}~${chunkEnd}`,
        timeOffset: i * CHUNK_SECONDS,
      };
    });

    // Worker pool을 사용한 병렬 처리
    const results: SubtitleSegment[][] = [];
    for (let i = 0; i < chunks.length; i += nThread) {
      const chunkGroup = chunks.slice(i, i + nThread);
      const workerPromises = chunkGroup.map((chunk) =>
        createWorker({
          inputVideoPath,
          workDir,
          chunkIndex: chunk.chunkIndex,
          totalChunks: numChunks,
          timeRange: chunk.timeRange,
          timeOffset: chunk.timeOffset,
        })
      );

      const chunkResults = await Promise.all(workerPromises);

      // 에러 체크 및 결과 처리
      for (const result of chunkResults) {
        if (!result.success) {
          throw new Error(
            `Worker error in chunk ${result.chunkIndex + 1}: ${result.error}`
          );
        }
        if (result.segments) {
          results[result.chunkIndex] = result.segments;
        }
      }

      logWithTimestamp(`${i + chunkGroup.length}/${numChunks} 청크 처리 완료`);
    }

    // 모든 번역된 세그먼트를 순서대로 합치기
    const allTranslatedSegments = results.flat();

    // 병합된 번역 결과를 사용하여 자막 파일 생성
    logWithTimestamp("최종 자막 파일 생성 중...");
    const subtitlePath = path.join(workDir, "subtitle.srt");
    createSRTFile(allTranslatedSegments, subtitlePath);

    // 자막 합성
    logWithTimestamp("자막 합성 중...");
    await mergeSubtitles(inputVideoPath, subtitlePath, outputVideoPath);

    logWithTimestamp("모든 처리 완료!");
  } catch (error) {
    console.error("비디오 처리 중 오류 발생:", error);
    throw error;
  }
}
