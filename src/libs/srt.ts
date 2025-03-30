import * as fs from "fs";
import { SubtitleSegment } from "../types";

// SRT 파일 생성 함수
export function createSRTFile(
  segments: SubtitleSegment[],
  outputPath: string
): void {
  let srtContent = "";
  segments.forEach((segment, index) => {
    const startTime = formatSRTTime(segment.start);
    const endTime = formatSRTTime(segment.end);

    srtContent += `${index + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${segment.text}\n\n`;
  });

  fs.writeFileSync(outputPath, srtContent);
}

// SRT 시간 포맷 함수
function formatSRTTime(seconds: number): string {
  const pad = (num: number): string => num.toString().padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${ms
    .toString()
    .padStart(3, "0")}`;
}
