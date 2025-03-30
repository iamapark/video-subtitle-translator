import * as fs from "fs";
import { SubtitleSegment } from "../../types";

/**
 * 음성 인식 결과를 JSON 파일로 저장하는 함수
 * @param segments 저장할 자막 세그먼트 배열
 * @param outputPath 출력 파일 경로
 */
export function saveTranscriptionResult(
  segments: SubtitleSegment[],
  outputPath: string
): void {
  fs.writeFileSync(outputPath, JSON.stringify(segments, null, 2));
}

/**
 * 음성 인식 결과를 JSON 파일에서 읽어오는 함수
 * @param filePath 입력 파일 경로
 * @returns 자막 세그먼트 배열
 */
export function loadTranscriptionResult(filePath: string): SubtitleSegment[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent) as SubtitleSegment[];
}
