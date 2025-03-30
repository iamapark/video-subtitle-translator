import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { SubtitleSegment } from "../../types";
import { TRANSLATE_PROMPT } from "./prompts/gemini_translate_prompt";

// 환경 변수 로드 (Gemini 키를 위해)
dotenv.config();

// Gemini API 설정
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn(
    "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Gemini 번역 기능이 작동하지 않을 수 있습니다."
  );
}
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
let modelName = process.env.GEMINI_MODEL_NAME;
if (!modelName) {
  console.warn(
    "GEMINI_MODEL_NAME 환경 변수가 설정되지 않았습니다. 기본 모델(gemini-1.5-pro-latest)을 사용합니다."
  );
  modelName = "gemini-1.5-pro-latest";
} else {
  console.log(`사용할 Gemini 모델: ${modelName}`);
}

const geminiModel = genAI
  ? genAI.getGenerativeModel({
      model: modelName,
      // Optional: Configure safety settings if needed
      // safetySettings: [
      //   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      //   { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      //   { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      //   { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      // ],
    })
  : null;

// Gemini API를 사용하여 세그먼트 번역하는 함수
export async function translateSegmentsWithGemini(
  segments: SubtitleSegment[]
): Promise<SubtitleSegment[]> {
  if (!geminiModel) {
    throw new Error("Gemini API 키가 설정되지 않아 번역을 진행할 수 없습니다.");
  }

  const inputText = JSON.stringify(segments, null, 2);

  // 프롬프트 템플릿에 입력 데이터 삽입
  const prompt = TRANSLATE_PROMPT.replace("{INPUT_JSON}", inputText);

  try {
    // 토큰 수 계산 및 로깅
    const { totalTokens } = await geminiModel.countTokens(prompt);
    console.log(`[Gemini] 계산된 요청 토큰 수: ${totalTokens}`);

    // responseMimeType을 application/json으로 설정하여 JSON 출력을 명시적으로 요청
    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const response = result.response;
    const translatedJsonString = response.text(); // MIME 타입 설정 시, 응답 텍스트가 바로 JSON 문자열

    // JSON 파싱
    const translatedSegments = JSON.parse(
      translatedJsonString
    ) as SubtitleSegment[];

    // 입력과 출력 세그먼트 개수 확인
    if (translatedSegments.length !== segments.length) {
      console.warn(
        `번역 후 세그먼트 개수가 변경되었습니다. 원본: ${segments.length}, 번역: ${translatedSegments.length}`
      );
      // 개수가 다른 경우에 대한 처리 (예: 오류 발생 또는 원본 반환) - 여기서는 일단 경고만 출력
    }

    console.log("Gemini API 번역 완료!");
    return translatedSegments;
  } catch (error) {
    console.error("Gemini API 번역 오류:", error);
    // API 응답 내용 로깅 (오류 분석에 도움)
    if (error instanceof Error && "response" in error) {
      console.error("Gemini API Raw Response:", (error as any).response);
    }
    throw new Error(`Gemini API translation failed: ${error}`);
  }
}
