import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { translateVideo } from "./translate_video";

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

// 디렉토리 생성 함수
function ensureDirectoryExists(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// 메인 함수
async function main() {
  // 커맨드 라인 인자 처리
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      '사용법: npm run start "입력 파일 경로" ["출력 디렉토리 경로"]'
    );
    console.error('예시: npm run start "./videos/input.mp4" "./output"');
    return;
  }

  // 입력 파일 경로
  const inputVideoPath = path.resolve(args[0]);

  // 출력 디렉토리 설정 (기본값: 입력 파일의 디렉토리)
  const outputDir = args[1]
    ? path.resolve(args[1])
    : path.dirname(inputVideoPath);

  // 출력 디렉토리 생성
  ensureDirectoryExists(outputDir);

  // 출력 파일 경로 설정 (원본 파일명_subtitle.mp4)
  const originalFileName = path.basename(
    inputVideoPath,
    path.extname(inputVideoPath)
  );
  const outputVideoPath = path.join(
    outputDir,
    `${originalFileName}_subtitle.mp4`
  );

  // 입력 파일이 존재하는지 확인
  if (!fs.existsSync(inputVideoPath)) {
    console.error(`입력 비디오 파일이 없습니다: ${inputVideoPath}`);
    return;
  }

  try {
    console.log(`입력 파일: ${inputVideoPath}`);
    console.log(`출력 파일: ${outputVideoPath}`);

    await translateVideo(inputVideoPath, outputVideoPath);
    console.log("영상 처리가 완료되었습니다!");
  } catch (error) {
    console.error("오류 발생:", error);
  }
}

// 프로그램 실행
main();
