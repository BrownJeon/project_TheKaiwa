/**
 * 엔진·모델·회사 이름 패턴 — 엔진명은 `engine/adapters` 밖에 적지 않는다(module-dependency 규칙 2). 상위 층은
 * `llm.mentionsEngineIdentity(text)` 로 "이 문장이 엔진 식별값을 말하는가" 만 묻는다(task-007 C1-3 조기 TTS 안전 필터).
 * 라틴 표기는 NFKC(전각 → 반각) 뒤에, 가타카나 표기는 원문 그대로 본다.
 */
const LATIN = /claude|anthropic|haiku|sonnet|opus|gpt|openai|chatgpt|gemini|qwen|ollama|llama|mistral|whisper|reazon|sherpa|style-?bert|vits/i
const KATAKANA = /クロード|アンソロピック|アンスロピック|ハイク|ソネット|オーパス|チャットジーピーティー|ジェミニ|ウィスパー/

export function mentionsEngineIdentity(text: string): boolean {
  const n = text.normalize('NFKC')
  return LATIN.test(n) || KATAKANA.test(n)
}
