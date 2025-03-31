import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { exec } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import { promisify } from "util";
import { ensureDirectoryExists, removeDirectoryRecursive } from "./util/file";
import { logWithTimestamp } from "./util/logger";

// FFmpeg 설정
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const execAsync = promisify(exec);

interface VideoInfo {
  title: string;
  formats: Array<{
    format_id: string;
    ext: string;
    filesize: number;
    vcodec: string;
    acodec: string;
  }>;
}

async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const { stdout } = await execAsync(`yt-dlp -j "${url}"`);
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to get video info: ${error}`);
  }
}

async function downloadStream(
  url: string,
  format: string,
  output: string
): Promise<void> {
  try {
    await execAsync(`yt-dlp -f ${format} -o "${output}" "${url}"`);
  } catch (error) {
    throw new Error(`Failed to download stream: ${error}`);
  }
}

async function mergeStreams(
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

async function downloadYouTubeVideo(url: string): Promise<void> {
  let tempVideoPath: string | null = null;
  let tempAudioPath: string | null = null;
  const tempDir = path.join(process.cwd(), "output", "temp");

  try {
    // 출력 디렉토리 생성
    const outputDir = path.join(process.cwd(), "output");
    ensureDirectoryExists(outputDir);
    ensureDirectoryExists(tempDir);

    // 비디오 정보 가져오기
    logWithTimestamp("Getting video information...");
    const videoInfo = await getVideoInfo(url);
    const safeTitle = videoInfo.title
      .replace(/[^\w\s-]/g, "") // 알파벳, 숫자, 공백, 하이픈만 허용
      .replace(/\s+/g, "_"); // 공백을 underscore로 변경

    tempVideoPath = path.join(tempDir, `${safeTitle}_video.mp4`);
    tempAudioPath = path.join(tempDir, `${safeTitle}_audio.m4a`);
    const finalOutputPath = path.join(outputDir, `${safeTitle}.mp4`);

    // 최고 화질 비디오 다운로드 (오디오 없음)
    logWithTimestamp("Downloading video stream (highest quality)...");
    await downloadStream(url, "bestvideo[ext=mp4]", tempVideoPath);

    // 최고 품질 오디오 다운로드
    logWithTimestamp("Downloading audio stream (highest quality)...");
    await downloadStream(url, "bestaudio[ext=m4a]", tempAudioPath);

    // 비디오와 오디오 합치기
    logWithTimestamp("Merging video and audio streams...");
    await mergeStreams(tempVideoPath, tempAudioPath, finalOutputPath);

    // 임시 파일 정리
    logWithTimestamp("Cleaning up temporary files...");
    removeDirectoryRecursive(tempDir);

    logWithTimestamp("Download and merge completed successfully!");
    logWithTimestamp(`Video saved to: ${finalOutputPath}`);
  } catch (error) {
    // 에러 발생 시 임시 파일 정리
    try {
      removeDirectoryRecursive(tempDir);
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    console.error("Error downloading video:", error);
    throw error;
  }
}

// 메인 실행 함수
async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Error: YouTube URL is required");
    console.log("Usage: npm run download_youtube <youtube_url>");
    process.exit(1);
  }

  try {
    await downloadYouTubeVideo(url);
  } catch (error) {
    console.error("Failed to download video:", error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
