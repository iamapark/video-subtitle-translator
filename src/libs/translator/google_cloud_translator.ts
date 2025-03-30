import { v2 as translate } from "@google-cloud/translate";
import * as dotenv from "dotenv";
import { SubtitleSegment } from "../../types";

dotenv.config();

const translateClient = new translate.Translate();

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

export async function translateSegmentsWithGoogleTrasnlator(
  segments: SubtitleSegment[]
): Promise<SubtitleSegment[]> {
  const translatedSegments: SubtitleSegment[] = [];
  for (const segment of segments) {
    const translatedText = await translateText(segment.text);
    translatedSegments.push({
      ...segment,
      text: translatedText,
    });
  }
  return translatedSegments;
}
