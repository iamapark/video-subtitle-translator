import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import os from "os";

// ffmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// 틸드(~)를 포함한 경로를 절대 경로로 변환하는 함수
function resolvePath(filepath: string): string {
  if (filepath.startsWith("~")) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return path.resolve(filepath);
}

// 자막 합성 함수
export async function mergeSubtitles(
  inputVideoPath: string,
  subtitlePath: string,
  outputVideoPath: string
): Promise<void> {
  // 모든 경로를 절대 경로로 변환
  const resolvedInputPath = resolvePath(inputVideoPath);
  const resolvedSubtitlePath = resolvePath(subtitlePath);
  const resolvedOutputPath = resolvePath(outputVideoPath);

  return new Promise((resolve, reject) => {
    ffmpeg(resolvedInputPath)
      .videoFilters(`subtitles=${resolvedSubtitlePath}`)
      .output(resolvedOutputPath)
      .on("end", () => {
        // 임시 파일 정리
        // fs.rmSync(workDir, { recursive: true, force: true });
        console.log("처리 완료!");
        resolve();
      })
      .on("error", (err: Error) => {
        console.error("오류 발생:", err);
        reject(err);
      })
      .run();
  });
}

// 메인 실행 코드
if (require.main === module) {
  const inputVideo = process.argv[2];
  const subtitleFile = process.argv[3];
  const outputVideo = process.argv[4];

  if (!inputVideo || !subtitleFile || !outputVideo) {
    console.error(
      "사용법: npm run merge_subtitle -- <입력비디오> <자막파일> <출력비디오>"
    );
    process.exit(1);
  }

  mergeSubtitles(inputVideo, subtitleFile, outputVideo).catch((err) => {
    console.error("자막 합성 중 오류 발생:", err);
    process.exit(1);
  });
}
