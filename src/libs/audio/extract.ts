import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * 비디오 파일에서 오디오를 추출하는 함수
 * @param inputPath 입력 비디오 파일 경로
 * @param outputPath 출력 오디오 파일 경로
 * @returns Promise<void>
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("wav")
      .outputOptions("-acodec pcm_s16le")
      .outputOptions("-ac 1")
      .outputOptions("-ar 16000")
      .save(outputPath)
      .on("end", () => resolve())
      .on("error", reject);
  });
}
