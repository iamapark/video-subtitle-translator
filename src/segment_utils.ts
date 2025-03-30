import { SubtitleSegment } from "./types";

/**
 * SubtitleSegment 배열을 지정된 시간(초) 단위의 청크로 분할합니다.
 * 내용이 없는 시간 구간에 대해서는 빈 청크를 생성하지 않습니다.
 *
 * @param segments 원본 SubtitleSegment 배열
 * @param chunkDurationSeconds 청크 단위 시간 (초)
 * @returns 분할된 SubtitleSegment 청크 배열 (SubtitleSegment[][])
 */
export function splitSegmentsIntoChunks(
  segments: SubtitleSegment[],
  chunkDurationSeconds: number
): SubtitleSegment[][] {
  const chunks: SubtitleSegment[][] = [];
  let currentChunk: SubtitleSegment[] = [];
  let currentChunkEndTime = chunkDurationSeconds;

  segments.forEach((segment) => {
    if (segment.start >= currentChunkEndTime) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
      // 다음 청크의 끝 시간 계산
      const skippedChunks = Math.floor(segment.start / chunkDurationSeconds);
      currentChunkEndTime = (skippedChunks + 1) * chunkDurationSeconds;
    }
    currentChunk.push(segment);
  });

  // 마지막 청크 추가
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// 자막 세그먼트를 더 작은 단위로 나누는 함수
export function splitSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
  const MAX_DURATION = 3; // 최대 3초
  const result: SubtitleSegment[] = [];

  segments.forEach((segment) => {
    const duration = segment.end - segment.start;
    if (duration <= MAX_DURATION) {
      result.push(segment);
    } else {
      // 긴 세그먼트를 여러 개로 나누기
      const words = segment.text.split(" ");
      const numParts = Math.ceil(duration / MAX_DURATION);
      const wordsPerPart = Math.ceil(words.length / numParts);

      for (let i = 0; i < numParts; i++) {
        const startIdx = i * wordsPerPart;
        const endIdx = Math.min((i + 1) * wordsPerPart, words.length);
        const partWords = words.slice(startIdx, endIdx);

        const partDuration = duration / numParts;
        const partStart = segment.start + i * partDuration;
        const partEnd = partStart + partDuration;

        result.push({
          start: partStart,
          end: partEnd,
          text: partWords.join(" "),
        });
      }
    }
  });

  return result;
}
