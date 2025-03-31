export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface VideoInfo {
  title: string;
  formats: Array<{
    format_id: string;
    ext: string;
    filesize: number;
    vcodec: string;
    acodec: string;
  }>;
}
