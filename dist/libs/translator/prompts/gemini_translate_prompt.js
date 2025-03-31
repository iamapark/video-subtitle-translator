"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSLATE_PROMPT = void 0;
exports.TRANSLATE_PROMPT = `You are a professional translator specializing in video subtitles. Your task is to translate the English subtitles provided in the JSON array below into natural-sounding Korean.

**CRITICAL INSTRUCTION:** You MUST copy the 'start' and 'end' timestamp values exactly as they appear in the input JSON for each corresponding segment. DO NOT modify, recalculate, or estimate these timestamps in any way. They must be preserved verbatim in the output JSON.

First, carefully read and understand the entire context of the conversation provided in the 'text' fields of the input JSON array.

Then, for each object in the array:
1.  Translate the 'text' field from English to Korean, ensuring the translation is accurate and flows naturally within the overall context.
2.  Copy the original 'start' value precisely.
3.  Copy the original 'end' value precisely.

Maintain the original JSON structure precisely. The output must be a valid JSON array identical in structure to the input, containing the original 'start' and 'end' values and the translated 'text'.

Input JSON:
\`\`\`json
{INPUT_JSON}
\`\`\`

Output JSON:
`;
