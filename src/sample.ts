import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as fs from "fs";

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

async function createSample(): Promise<void> {
  const inputDir = path.join(__dirname, "..", "input");
  const inputPath = path.join(inputDir, "input.mp4");
  const outputPath = path.join(inputDir, "sample.mp4");

  // 입력 파일 존재 확인
  if (!fs.existsSync(inputPath)) {
    console.error("입력 파일이 없습니다:", inputPath);
    return;
  }

  return new Promise((resolve, reject) => {
    console.log("3분 샘플 영상 생성 중...");
    ffmpeg(inputPath)
      .setDuration(180) // 3분 = 180초
      .output(outputPath)
      .on("end", () => {
        console.log("샘플 영상 생성 완료:", outputPath);
        resolve();
      })
      .on("error", (err: Error) => {
        console.error("오류 발생:", err);
        reject(err);
      })
      .run();
  });
}

// 실행
createSample().catch((err) => {
  console.error("프로그램 실행 중 오류 발생:", err);
});
