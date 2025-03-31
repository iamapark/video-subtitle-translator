import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { logWithTimestamp } from "../util/logger";

// FFmpeg 설정
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function mergeStreams(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(["-c:v copy", "-c:a aac", "-strict experimental"])
      .output(outputPath)
      .on("start", () => {
        logWithTimestamp("Started merging video and audio...");
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          process.stdout.write(
            `\rMerging progress: ${progress.percent.toFixed(2)}%`
          );
        }
      })
      .on("end", () => {
        process.stdout.write("\n");
        logWithTimestamp("Merge completed successfully");
        resolve();
      })
      .on("error", (err) => {
        logWithTimestamp(`Error during merge: ${err.message}`);
        reject(new Error(`Failed to merge streams: ${err.message}`));
      })
      .run();
  });
} 