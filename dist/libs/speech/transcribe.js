"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = transcribeAudio;
const speech_1 = require("@google-cloud/speech");
const speech_2 = require("@google-cloud/speech");
const storage_1 = require("@google-cloud/storage");
const dotenv = __importStar(require("dotenv"));
const logger_1 = require("../../util/logger");
// 환경 변수 로드
dotenv.config();
// 클라이언트 초기화
const speechClient = new speech_1.v2.SpeechClient();
const storage = new storage_1.Storage();
// GCS 관련 설정
const bucketName = process.env.GOOGLE_STORAGE_BUCKET || "video-subtitle-bucket";
const bucket = storage.bucket(bucketName);
// 파일을 GCS에 업로드하는 함수
async function uploadToGCS(filePath, destination) {
    await bucket.upload(filePath, {
        destination: destination,
    });
    return `gs://${bucketName}/${destination}`;
}
// GCS에서 파일 삭제하는 함수
async function deleteFromGCS(gcsUri) {
    const fileName = gcsUri.replace(`gs://${bucketName}/`, "");
    await bucket.file(fileName).delete();
}
// 문장 종료를 나타내는 패턴
const SENTENCE_END_PATTERN = /[.!?]\s*$/;
// 단어들을 문장 단위로 그룹화하는 함수
function groupWordsIntoSentences(segments) {
    const result = [];
    let currentSentence = [];
    let sentenceStart = 0;
    let lastEnd = 0;
    segments.forEach((segment, index) => {
        currentSentence.push(segment.text);
        lastEnd = segment.end;
        // 문장이 완성되었는지 확인
        const isEndOfSentence = SENTENCE_END_PATTERN.test(segment.text) || // 문장 종료 부호로 끝나는 경우
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
async function transcribeAudio(audioPath) {
    try {
        // 오디오 파일을 GCS에 업로드
        (0, logger_1.logWithTimestamp)("오디오 파일 GCS 업로드 중...");
        const gcsUri = await uploadToGCS(audioPath, `audio-${Date.now()}.wav`);
        const file_metadata = new speech_2.protos.google.cloud.speech.v2.BatchRecognizeFileMetadata({
            uri: gcsUri,
        });
        const request = new speech_2.protos.google.cloud.speech.v2.BatchRecognizeRequest({
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
                inlineResponseConfig: new speech_2.protos.google.cloud.speech.v2.InlineOutputConfig(),
            },
            processingStrategy: "DYNAMIC_BATCHING",
            files: [file_metadata],
        });
        (0, logger_1.logWithTimestamp)("음성 인식 요청 시작...");
        const [operation] = await speechClient.batchRecognize(request);
        (0, logger_1.logWithTimestamp)("음성 인식 처리 중...");
        const [response] = await operation.promise();
        (0, logger_1.logWithTimestamp)("음성 인식 완료!");
        // GCS에서 오디오 파일 삭제
        await deleteFromGCS(gcsUri);
        // 단어 단위로 세그먼트 생성
        const wordSegments = [];
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
    }
    catch (error) {
        console.error("음성 인식 오류:", error);
        throw error;
    }
}
