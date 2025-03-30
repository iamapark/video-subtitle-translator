import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
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
      `${CHUNK_MINUTES}분 단위로 분할 처리 (총 ${numChunks}개 청크)`
    );

    let allTranslatedSegments: SubtitleSegment[] = [];
    let timeOffset = 0;

    // 각 청크 처리
    for (let i = 0; i < numChunks; i++) {
      const chunkStart = i * CHUNK_MINUTES;
      const chunkEnd = Math.min(
        (i + 1) * CHUNK_MINUTES,
        Math.ceil(duration / 60)
      );
      const timeRange = `${chunkStart}~${chunkEnd}`;

      logWithTimestamp(`청크 ${i + 1}/${numChunks} 처리 중... (${timeRange})`);

      // 비디오 청크 생성
      const chunkVideoPath = path.join(workDir, `chunk_${i + 1}.mp4`);
      await trimVideo(inputVideoPath, chunkVideoPath, timeRange);

      // 오디오 추출 (mp4 -> wav)
      logWithTimestamp(`청크 ${i + 1}: 오디오 추출 중...`);
      const chunkAudioPath = path.join(workDir, `chunk_${i + 1}.wav`);
      await extractAudio(chunkVideoPath, chunkAudioPath);

      // 음성 인식 (wav -> json)
      logWithTimestamp(`청크 ${i + 1}: 음성 인식 중...`);
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
        `transcription_${i + 1}.json`
      );
      logWithTimestamp(`청크 ${i + 1}: 음성 인식 결과 저장 중...`);
      saveTranscriptionResult(offsetSegments, transcriptionPath);

      // 음성 인식 결과 로드 및 번역
      logWithTimestamp(`청크 ${i + 1}: 음성 인식 결과 로드 중...`);
      const transcriptionResult = loadTranscriptionResult(transcriptionPath);
      logWithTimestamp(
        `청크 ${i + 1}: 로드된 음성 인식 세그먼트 수: ${
          transcriptionResult.length
        }`
      );

      // 세그먼트를 번역
      if (transcriptionResult.length > 0) {
        logWithTimestamp(`청크 ${i + 1}: 번역 시작...`);
        const translatedSegments = await translateSegmentsWithGemini(
          transcriptionResult
        ).catch((error) => {
          console.error(`청크 ${i + 1}: 번역 중 오류 발생:`, error);
          return [];
        });

        allTranslatedSegments =
          allTranslatedSegments.concat(translatedSegments);
        logWithTimestamp(
          `청크 ${i + 1}: 번역 완료. 현재까지 총 번역된 세그먼트 수: ${
            allTranslatedSegments.length
          }`
        );
      }

      // 임시 파일 정리
      fs.unlinkSync(chunkVideoPath);
      fs.unlinkSync(chunkAudioPath);
      fs.unlinkSync(transcriptionPath);

      // 다음 청크의 시간 오프셋 업데이트
      timeOffset += CHUNK_SECONDS;
    }

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
