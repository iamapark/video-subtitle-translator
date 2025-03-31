import { exec } from "child_process";
import { promisify } from "util";
import { VideoInfo } from "../types";
import { logWithTimestamp } from "../util/logger";

const execAsync = promisify(exec);

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const { stdout } = await execAsync(`yt-dlp -j "${url}"`);
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to get video info: ${error}`);
  }
}

export async function downloadStream(
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