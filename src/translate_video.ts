import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { v2 as speech } from "@google-cloud/speech";
import { protos } from "@google-cloud/speech";
import { v2 as translate } from "@google-cloud/translate";
import * as dotenv from "dotenv";
import { Storage } from "@google-cloud/storage";
import { mergeSubtitles } from "./merge_subtitle";
// 환경 변수 로드
dotenv.config();

// FFmpeg 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

const speechClient = new speech.SpeechClient();
const translateClient = new translate.Translate();
const storage = new Storage();

// GCS 관련 설정
const bucketName = process.env.GOOGLE_STORAGE_BUCKET || "video-subtitle-bucket";
const bucket = storage.bucket(bucketName);

// 파일을 GCS에 업로드하는 함수
async function uploadToGCS(
  filePath: string,
  destination: string
): Promise<string> {
  await bucket.upload(filePath, {
    destination: destination,
  });
  return `gs://${bucketName}/${destination}`;
}

// GCS에서 파일 삭제하는 함수
async function deleteFromGCS(gcsUri: string): Promise<void> {
  const fileName = gcsUri.replace(`gs://${bucketName}/`, "");
  await bucket.file(fileName).delete();
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

// 디렉토리 생성 함수
function ensureDirectoryExists(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// 오디오 추출 함수
async function extractAudio(
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

// 문장 종료를 나타내는 패턴
const SENTENCE_END_PATTERN = /[.!?]\s*$/;

// 단어들을 문장 단위로 그룹화하는 함수
function groupWordsIntoSentences(
  segments: SubtitleSegment[]
): SubtitleSegment[] {
  const result: SubtitleSegment[] = [];
  let currentSentence: string[] = [];
  let sentenceStart = 0;
  let lastEnd = 0;

  segments.forEach((segment, index) => {
    currentSentence.push(segment.text);
    lastEnd = segment.end;

    // 문장이 완성되었는지 확인
    const isEndOfSentence =
      SENTENCE_END_PATTERN.test(segment.text) || // 문장 종료 부호로 끝나는 경우
      index === segments.length - 1 || // 마지막 세그먼트인 경우
      segments[index + 1]?.start - segment.end > 1; // 다음 세그먼트와 1초 이상 간격이 있는 경우

    if (isEndOfSentence && currentSentence.length > 0) {
      result.push({
        start: sentenceStart,
        end: lastEnd,
        text: currentSentence.join(" "),
      });
      currentSentence = [];
      sentenceStart = lastEnd;
    }
  });

  // 남은 단어들이 있다면 마지막 문장으로 처리
  if (currentSentence.length > 0) {
    result.push({
      start: sentenceStart,
      end: lastEnd,
      text: currentSentence.join(" "),
    });
  }

  return result;
}

// 자막 세그먼트를 더 작은 단위로 나누는 함수
function splitSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
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

// 음성 인식 함수
async function transcribeAudio(audioPath: string): Promise<SubtitleSegment[]> {
  try {
    // 오디오 파일을 GCS에 업로드
    console.log("오디오 파일 GCS 업로드 중...");
    const gcsUri = await uploadToGCS(audioPath, `audio-${Date.now()}.wav`);

    const file_metadata =
      new protos.google.cloud.speech.v2.BatchRecognizeFileMetadata({
        uri: gcsUri,
      });
    const request = new protos.google.cloud.speech.v2.BatchRecognizeRequest({
      recognizer: process.env.RECOGNIZER_NAME,
      config: {
        languageCodes: ["en-US"],
        model: "long",
        autoDecodingConfig: {},
        explicitDecodingConfig: {
          encoding: "LINEAR16",
          sampleRateHertz: 16000,
          audioChannelCount: 1,
        },
        features: {
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
        },
      },
      recognitionOutputConfig: {
        inlineResponseConfig:
          new protos.google.cloud.speech.v2.InlineOutputConfig(),
      },
      processingStrategy: "DYNAMIC_BATCHING",
      files: [file_metadata],
    });

    console.log("음성 인식 요청 시작...");
    // const [operation] = await speechClient.longRunningRecognize(request);
    const [operation] = await speechClient.batchRecognize(request);
    console.log("음성 인식 처리 중...");
    const [response] = await operation.promise();
    console.log("음성 인식 완료!");

    // GCS에서 오디오 파일 삭제
    await deleteFromGCS(gcsUri);

    // 단어 단위로 세그먼트 생성
    const wordSegments: SubtitleSegment[] = [];
    const results = Object.values(response.results || {});
    // console.info(`results: `, results);
    for (const result of results) {
      for (const r of result.transcript?.results || []) {
        const words = r.alternatives?.[0]?.words || [];
        for (const wordInfo of words) {
          const start = Number(wordInfo.startOffset?.seconds || 0);
          const end = Number(wordInfo.endOffset?.seconds || 0);
          const text = wordInfo.word || "";
          wordSegments.push({ start, end, text });
        }
      }
    }

    // 단어들을 문장 단위로 그룹화
    const sentenceSegments = groupWordsIntoSentences(wordSegments);

    return sentenceSegments;
  } catch (error) {
    console.error("음성 인식 오류:", error);
    throw error;
  }
}

// 텍스트 번역 함수
async function translateText(text: string): Promise<string> {
  try {
    const [translation] = await translateClient.translate(text, {
      from: "en",
      to: "ko",
    });
    return translation;
  } catch (error) {
    console.error("번역 오류:", error);
    throw error;
  }
}

// SRT 파일 생성 함수
function createSRTFile(segments: SubtitleSegment[], outputPath: string): void {
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

// 음성 인식 결과를 파일로 저장하는 함수
function saveTranscriptionResult(
  segments: SubtitleSegment[],
  outputPath: string
): void {
  fs.writeFileSync(outputPath, JSON.stringify(segments, null, 2));
}

// 음성 인식 결과를 파일에서 읽는 함수
function loadTranscriptionResult(filePath: string): SubtitleSegment[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContent) as SubtitleSegment[];
}

// 메인 처리 함수
export async function translateVideo(
  inputVideoPath: string,
  outputVideoPath: string
): Promise<void> {
  try {
    // 작업 디렉토리 설정
    const workDir = path.join(path.dirname(inputVideoPath), "temp");
    ensureDirectoryExists(workDir);

    // 오디오 추출 (mp4 -> wav)
    console.log("오디오 추출 중...");
    const audioPath = path.join(workDir, "audio.wav");
    await extractAudio(inputVideoPath, audioPath);

    // 음성 인식 (wav -> json)
    console.log("음성 인식 중...");
    const segments = await transcribeAudio(audioPath);

    const splitResult = splitSegments(segments);

    // 음성 인식 결과 저장
    const transcriptionPath = path.join(workDir, "transcription.json");
    console.log("음성 인식 결과 저장 중...");
    saveTranscriptionResult(splitResult, transcriptionPath);

    // 음성 인식 결과 로드 및 번역
    console.log("음성 인식 결과 로드 중...");
    const transcriptionResult = loadTranscriptionResult(transcriptionPath);

    // 번역
    console.log("텍스트 번역 중...");
    const translatedSegments: SubtitleSegment[] = [];
    for (const segment of transcriptionResult) {
      const translatedText = await translateText(segment.text);
      translatedSegments.push({
        ...segment,
        text: translatedText,
      });
    }

    // 자막 파일 생성
    console.log("자막 파일 생성 중...");
    const subtitlePath = path.join(workDir, "subtitle.srt");
    createSRTFile(translatedSegments, subtitlePath);

    // 자막 합성
    console.log("자막 합성 중...");
    await mergeSubtitles(inputVideoPath, subtitlePath, outputVideoPath);
  } catch (error) {
    console.error("비디오 처리 중 오류 발생:", error);
    throw error;
  }
}
