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
exports.saveTranscriptionResult = saveTranscriptionResult;
exports.loadTranscriptionResult = loadTranscriptionResult;
const fs = __importStar(require("fs"));
/**
 * 음성 인식 결과를 JSON 파일로 저장하는 함수
 * @param segments 저장할 자막 세그먼트 배열
 * @param outputPath 출력 파일 경로
 */
function saveTranscriptionResult(segments, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(segments, null, 2));
}
/**
 * 음성 인식 결과를 JSON 파일에서 읽어오는 함수
 * @param filePath 입력 파일 경로
 * @returns 자막 세그먼트 배열
 */
function loadTranscriptionResult(filePath) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
}
