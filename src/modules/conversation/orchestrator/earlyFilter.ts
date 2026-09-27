/**
 * 조기 합성 문장 안전 필터(task-007 K2-2, Codex C1-3 ②) — **검증 전** 응답 조각을 소리로 내기 전에 통과해야 하는 최소 조건.
 * 하나라도 걸리면 조기 경로를 끄고 최종 검증 뒤에 합성한다(느려질 뿐 잃는 것은 없다 — 오탐은 싸다).
 *
 *  길이 2~100자 · 제어문자 0 · 가나/한자 비율 ≥50%(공백·문장부호 제외) · URL·이메일 0 · 연속 영문 4자 이상 0 ·
 *  JSON/마크업 기호 0 · 엔진·모델 이름 0(engine 이 판정 — 이름 목록은 adapters 에만) · 지시문 누출 낱말 0.
 * 라틴 판정은 NFKC(전각 → 반각) 뒤에 한다.
 */
import { llm } from '@/modules/engine'

export type EarlyFilterProblem = 'LENGTH' | 'CONTROL' | 'URL' | 'LATIN' | 'MARKUP' | 'IDENTITY' | 'DIRECTIVE' | 'SCRIPT'

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
const URL_LIKE = /https?:|www\.|:\/\/|@|\.(com|net|org|jp|io|ai|dev|app)\b/i
const LATIN_RUN = /[A-Za-z]{4,}/
const MARKUP = /[{}[\]<>"\\`|$#=_*]/
const DIRECTIVE = /system|prompt|json|schema|instruction|assistant|developer|システム|プロンプト|指示|命令|スキーマ|出力形式/i
const NEUTRAL = /[\s、。，．,.！？!?「」『』（）()・…〜~ー:：;；\-－]/u
const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〆]/u

export function earlySentenceProblem(sentence: string): EarlyFilterProblem | null {
  const s = sentence.trim()
  const len = [...s].length
  if (len < 2 || len > 100) return 'LENGTH'
  if (CONTROL.test(sentence)) return 'CONTROL'
  const n = s.normalize('NFKC')
  if (URL_LIKE.test(n)) return 'URL'
  if (LATIN_RUN.test(n)) return 'LATIN'
  if (MARKUP.test(n)) return 'MARKUP'
  if (llm.mentionsEngineIdentity(s)) return 'IDENTITY'
  if (DIRECTIVE.test(n)) return 'DIRECTIVE'
  let total = 0
  let ja = 0
  for (const ch of s) {
    if (NEUTRAL.test(ch)) continue
    total++
    if (JA.test(ch)) ja++
  }
  if (total === 0 || ja / total < 0.5) return 'SCRIPT'
  return null
}
