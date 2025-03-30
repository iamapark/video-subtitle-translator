import { v2 as speech } from "@google-cloud/speech";
import { protos } from "@google-cloud/speech";
import { Storage } from "@google-cloud/storage";
import { SubtitleSegment } from "../../types";
import * as dotenv from "dotenv";
import { logWithTimestamp } from "../../util/logger";

// 환경 변수 로드
dotenv.config();

// 클라이언트 초기화
const speechClient = new speech.SpeechClient();
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

// 음성 인식 함수
export async function transcribeAudio(
  audioPath: string
): Promise<SubtitleSegment[]> {
  try {
    // 오디오 파일을 GCS에 업로드
    logWithTimestamp("오디오 파일 GCS 업로드 중...");
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

    logWithTimestamp("음성 인식 요청 시작...");
    const [operation] = await speechClient.batchRecognize(request);
    logWithTimestamp("음성 인식 처리 중...");
    const [response] = await operation.promise();
    logWithTimestamp("음성 인식 완료!");

    // GCS에서 오디오 파일 삭제
    await deleteFromGCS(gcsUri);

    // 단어 단위로 세그먼트 생성
    const wordSegments: SubtitleSegment[] = [];
    const results = Object.values(response.results || {});
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
