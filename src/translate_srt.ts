import * as fs from "fs";
import * as path from "path";
import { translateSegmentsWithGemini } from "./libs/translator/gemini_translator";
import { createSRTFile } from "./libs/srt";
import { SubtitleSegment } from "./types";
import { splitSegmentsIntoChunks } from "./segment_utils"; // 유틸리티 함수 임포트

// SRT 시간 문자열 (HH:MM:SS,ms)을 초 단위 숫자로 변환하는 함수
function parseSRTTime(timeString: string): number {
  const [timePart, msPart] = timeString.split(",");
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  const milliseconds = Number(msPart);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

// SRT 파일 내용을 파싱하여 SubtitleSegment 배열로 변환하는 함수
function parseSRTContent(srtContent: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/); // 빈 줄 포함하여 블록 분리

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue; // 최소 3줄 (번호, 시간, 텍스트) 필요

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue; // 시간 형식 안 맞으면 건너뛰기

    const start = parseSRTTime(timeMatch[1]);
    const end = parseSRTTime(timeMatch[2]);
    const text = lines.slice(2).join("\n").trim(); // 여러 줄 텍스트 처리

    if (text) {
      // 텍스트가 있는 경우에만 추가
      segments.push({ start, end, text });
    }
  }

  return segments;
}

// 타임스탬프 로깅 함수
function logWithTimestamp(message: string, ...optionalParams: any[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...optionalParams);
}

// 메인 실행 함수
async function main() {
  // 1. 입력 파라미터 확인 (파일 경로)
  const inputFilePath = process.argv[2];
  if (!inputFilePath) {
    console.error("오류: 입력 파일 경로를 제공해야 합니다.");
    console.log("사용법: npm run translate_with_gemini <입력_파일_경로>");
    process.exit(1);
  }

  logWithTimestamp(`입력 파일: ${inputFilePath}`);

  try {
    // 2. 파일 읽기
    logWithTimestamp("파일 읽는 중...");
    const fileContent = fs.readFileSync(inputFilePath, "utf-8");

    // 파일 내용 검증 (SRT 파싱 전 원본 내용 검증)
    if (!fileContent || fileContent.trim().length === 0) {
      console.error(`오류: 파일 내용이 비어있습니다 (${inputFilePath}).`);
      process.exit(1);
    }

    // 3. SRT 내용 파싱
    logWithTimestamp("SRT 파일 내용 파싱 중...");
    const originalSegments = parseSRTContent(fileContent);
    if (originalSegments.length === 0) {
      console.error(
        `오류: SRT 파일에서 유효한 세그먼트를 찾을 수 없습니다 (${inputFilePath}).`
      );
      process.exit(1);
    }
    logWithTimestamp(`파싱된 세그먼트 수: ${originalSegments.length}`);

    // 4. 세그먼트를 10분(600초) 단위 청크로 분할 (유틸리티 함수 사용)
    const CHUNK_DURATION_SECONDS = 600;
    const chunks = splitSegmentsIntoChunks(
      originalSegments,
      CHUNK_DURATION_SECONDS
    );
    logWithTimestamp(`분할된 유효 청크 수: ${chunks.length}`);

    // 5. 각 청크를 병렬로 번역
    const translationPromises = chunks.map((chunk, index) => {
      if (chunk.length === 0) {
        logWithTimestamp(
          `청크 ${index + 1}/${chunks.length} 비어있음, 건너뜁니다.`
        );
        return Promise.resolve([]); // 빈 청크는 빈 배열 반환
      }
      logWithTimestamp(
        `청크 ${index + 1}/${chunks.length} (${
          chunk.length
        }개 세그먼트) 번역 시작...`
      );
      return translateSegmentsWithGemini(chunk)
        .then((translatedChunk: SubtitleSegment[]) => {
          logWithTimestamp(`청크 ${index + 1}/${chunks.length} 번역 완료.`);
          return translatedChunk;
        })
        .catch((error: Error) => {
          console.error(
            `청크 ${index + 1}/${chunks.length} 번역 중 오류 발생:`,
            error
          );
          return [];
        });
    });

    const translatedChunks = await Promise.all(translationPromises);

    // 6. 번역된 청크들을 하나로 병합
    const allTranslatedSegments: SubtitleSegment[] = translatedChunks.flat();
    logWithTimestamp(
      `모든 청크 번역 완료. 총 번역된 세그먼트 수: ${allTranslatedSegments.length}`
    );

    // 7. 병합된 번역 결과를 SRT 파일로 저장
    const outputDir = path.dirname(inputFilePath);
    const inputFileName = path.basename(
      inputFilePath,
      path.extname(inputFilePath)
    );
    const outputSrtPath = path.join(
      outputDir,
      `${inputFileName}_translated.srt`
    );

    logWithTimestamp(`번역된 SRT 파일 저장 중: ${outputSrtPath}`);
    createSRTFile(allTranslatedSegments, outputSrtPath); // 병합된 결과 사용
    logWithTimestamp("SRT 파일 저장 완료.");
  } catch (error) {
    console.error("오류 발생:", error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
