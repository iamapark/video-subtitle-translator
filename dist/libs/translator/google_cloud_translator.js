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
exports.translateSegmentsWithGoogleTrasnlator = translateSegmentsWithGoogleTrasnlator;
const translate_1 = require("@google-cloud/translate");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const translateClient = new translate_1.v2.Translate();
// 텍스트 번역 함수
async function translateText(text) {
    try {
        const [translation] = await translateClient.translate(text, {
            from: "en",
            to: "ko",
        });
        return translation;
    }
    catch (error) {
        console.error("번역 오류:", error);
        throw error;
    }
}
async function translateSegmentsWithGoogleTrasnlator(segments) {
    const translatedSegments = [];
    for (const segment of segments) {
        const translatedText = await translateText(segment.text);
        translatedSegments.push({
            ...segment,
            text: translatedText,
        });
    }
    return translatedSegments;
}
