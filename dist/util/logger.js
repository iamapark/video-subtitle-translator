"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWithTimestamp = logWithTimestamp;
/**
 * 타임스탬프가 포함된 로그 메시지를 출력하는 함수
 * @param message 로그 메시지
 * @param optionalParams 추가 파라미터들
 */
function logWithTimestamp(message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, ...optionalParams);
}
