/**
 * LLM 응답에서 JSON 객체를 추출한다 — VoiceVault `src/lib/ai/extractJson.ts`
 * (원본은 bjj `backend/src/utils/extractJson.js`) 이식.
 *
 * 로컬 모델(qwen2.5)도 Claude CLI도 JSON 앞뒤에 인사말·코드펜스를 붙이는 이탈이 잦다.
 * 프롬프트에 "JSON 객체 하나뿐"을 넣어도 완전히 사라지지 않으므로, 추출은 관용적으로 하고
 * **검증만 엄격하게** 한다(schemaValidate). 여기서 실패해 재시도를 도는 것은 비싸다.
 *
 * ① 원문 그대로 parse ② 코드펜스(```json` 등) 제거 후 parse ③ 첫 '{' ~ 마지막 '}' 부분문자열
 * parse(따옴표 안 원본 개행은 이스케이프해 JSON.parse 실패를 방지) ④ 전부 실패 시 throw.
 */
export function extractJson(text: string): unknown {
  // ① 원문 그대로
  try {
    return JSON.parse(text)
  } catch {
    // fall through
  }

  // ② 코드펜스 제거 후
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through
  }

  // ③ 첫 '{' ~ 마지막 '}' 부분문자열
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    let jsonStr = cleaned.slice(start, end + 1)
    // 따옴표로 묶인 문자열 안의 원본 개행만 이스케이프한다 — JSON.parse는 문자열 리터럴 안의
    // raw 개행을 허용하지 않는데, 조리법 본문처럼 여러 줄짜리 값에서 모델이 자주 흘린다.
    jsonStr = jsonStr.replace(/"(?:[^"\\]|\\.)*"/g, (m) =>
      m.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n'),
    )
    try {
      return JSON.parse(jsonStr)
    } catch {
      // fall through
    }
  }

  // ④ 전부 실패
  throw new Error('JSON 객체를 찾을 수 없습니다')
}

/** `extractJson` + "루트가 객체인가"까지 확인한 관용 파서. 배열·스칼라는 실패로 본다. */
export function extractJsonObject(text: string): Record<string, unknown> {
  const parsed = extractJson(text)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 루트가 객체가 아닙니다')
  }
  return parsed as Record<string, unknown>
}
