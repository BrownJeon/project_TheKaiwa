/**
 * 회화(TALK) 교정 방식(task-010c, learning-personalization §2-7·§2-8) — 순수 함수만.
 *
 * - 교정 **행 생성 규칙은 그대로**다(모드와 무관하게 `Correction(PROPOSED)` 로 모두 저장). 모드는 보여 주는 때만 바꾼다:
 *   유창성 = `severity=MAJOR` 만 그 자리(NOW), MINOR 는 "모아 둔 교정"(LATER) / 코치 = 전부 NOW + 힌트 먼저.
 * - 표시 메타는 교정이 달린 **사용자 메시지의 `toolLog.correction`** 에 둔다(스키마 변경 없이 새로고침·시트·칩 수가 같은 값을 보게).
 *   싣는 것: 교정 id·모드·deliver·힌트(≤200자, 정답 미포함)·자기수정 판정 — 원문·응답 전문은 없다.
 * - 코치 자기수정 판정은 LLM 없이 코드가 한다: 직전 교정의 `corrected` 를 정규화(NFKC·공백·문장부호 제거)해 이번 발화에 들어 있으면 고침.
 */
import type { CorrectionMode } from '../prompts/talk'

export const CORRECTION_DELIVERS = ['NOW', 'LATER'] as const
export type CorrectionDeliver = (typeof CORRECTION_DELIVERS)[number]
/** SELF = 정답을 열지 않고 고쳐 말함 · REPEAT = 정답을 연 뒤 고쳐 말함 · MISSED = 다음 말에서 고치지 못함(또는 판정 불가). */
export type SelfCheckResult = 'SELF' | 'REPEAT' | 'MISSED'

export const HINT_MAX = 200

/**
 * 이번 턴에 쓸 교정 방식. 역할극(상황 대화, `Chat.scenarioId`)은 설정과 무관하게 코치(§2-7 — 역할극·레슨 말하기는 코치).
 * 역할극 화면·시드는 task-010d 가 연다 — 여기서는 분기만 열어 둔다.
 */
export function resolveTalkCorrectionMode(profileMode: CorrectionMode | null | undefined, chat: { scenarioId?: string | null }): CorrectionMode {
  if (chat.scenarioId) return 'COACH'
  return profileMode === 'COACH' ? 'COACH' : 'FLUENCY'
}

export function correctionDeliver(mode: CorrectionMode, severity: string): CorrectionDeliver {
  return mode === 'FLUENCY' && severity !== 'MAJOR' ? 'LATER' : 'NOW'
}

export function normalizeForSelfCheck(s: string): string {
  return s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
}

/**
 * 원문 대비 교정문에서 바뀐 조각(정규화 기준) — 공통 접두·접미를 떼고 남은 교정문 쪽 가운데. 같거나 지우기만 한 교정이면 ''.
 * 코드 포인트 단위로 자른다(서로게이트 쌍 한자를 반쪽으로 잘라 1자 조각이 생기지 않게).
 */
export function changedPieceOf(original: string, corrected: string): string {
  const o = Array.from(normalizeForSelfCheck(original))
  const c = Array.from(normalizeForSelfCheck(corrected))
  const max = Math.min(o.length, c.length)
  let p = 0
  while (p < max && o[p] === c[p]) p++
  let s = 0
  while (s < max - p && o[o.length - 1 - s] === c[c.length - 1 - s]) s++
  return c.slice(p, c.length - s).join('')
}

/**
 * 화면에 낼 힌트 — 코치일 때만, 비어 있지 않고 정답(교정문 전체, `original` 을 주면 바뀐 일본어 조각 2자 이상도)을 그대로 담지 않은 것.
 * 아니면 null(카드는 바로 정답을 보인다 — 데모 co-nohint). 조각 1자(조사·가나 한 글자)는 힌트에 우연히 들어가기 쉬워 판정하지 않는다.
 * 후검증(`checkTalkResponse`)이 교정문 전체 누출을 재시도로 잡지만 재시도 뒤에도 남을 수 있어(softExtraCheck) 여기서 한 번 더 거른다.
 * 조각 검사는 여기만 둔다 — 후검증에 넣으면 재시도(LLM 호출)가 늘어 5초 예산을 해친다.
 */
export function coachHintOf(mode: CorrectionMode, hintKo: string | null | undefined, corrected: string, original?: string): string | null {
  if (mode !== 'COACH' || typeof hintKo !== 'string') return null
  const h = hintKo.trim()
  if (!h || h.length > HINT_MAX) return null
  const c = normalizeForSelfCheck(corrected)
  const nh = normalizeForSelfCheck(h)
  if (h.includes(corrected) || (c.length >= 2 && nh.includes(c))) return null
  if (original !== undefined) {
    const piece = changedPieceOf(original, corrected)
    if (Array.from(piece).length >= 2 && nh.includes(piece)) return null
  }
  return h
}

/**
 * 다음 말(text)이 직전 교정을 고쳤는가. 교정문 전체(정규화)가 들어 있으면 고침 — 단, 교정문에 원문이 들어 있지 않은데 원문을 그대로 다시
 * 말했으면(원문이 교정문을 품는 "지우기" 교정) 고친 것이 아니다. 교정문이 2자 미만이거나 원문과 정규화 결과가 같으면 판정할 수 없어 MISSED.
 */
export function judgeSelfCorrection(i: { original: string; corrected: string; text: string; revealed: boolean }): SelfCheckResult {
  const c = normalizeForSelfCheck(i.corrected)
  const o = normalizeForSelfCheck(i.original)
  const t = normalizeForSelfCheck(i.text)
  if (c.length < 2 || c === o) return 'MISSED'
  const repeatedOriginal = o.length > 0 && !c.includes(o) && t.includes(o)
  if (t.includes(c) && !repeatedOriginal) return i.revealed ? 'REPEAT' : 'SELF'
  return 'MISSED'
}

/** 사용자 메시지 `toolLog.correction` — 교정 1건의 표시 메타. */
export interface TalkCorrectionMeta {
  id: string
  mode: CorrectionMode
  deliver: CorrectionDeliver
  hintKo: string | null
  selfCheck: SelfCheckResult | null
}

const DELIVERS = new Set(['NOW', 'LATER'])
const RESULTS = new Set(['SELF', 'REPEAT', 'MISSED'])

/** toolLog 에서 메타를 꺼낸다. 모양이 어긋나거나 다른 교정의 것이면 null(옛 행 = 메타 없음 = 지금처럼 바로 카드). */
export function readCorrectionMeta(toolLog: unknown, correctionId?: string): TalkCorrectionMeta | null {
  if (!toolLog || typeof toolLog !== 'object' || Array.isArray(toolLog)) return null
  const m = (toolLog as Record<string, unknown>).correction
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null
  const r = m as Record<string, unknown>
  if (typeof r.id !== 'string' || (correctionId !== undefined && r.id !== correctionId)) return null
  if (r.mode !== 'FLUENCY' && r.mode !== 'COACH') return null
  if (typeof r.deliver !== 'string' || !DELIVERS.has(r.deliver)) return null
  const hintKo = typeof r.hintKo === 'string' && r.hintKo.length > 0 && r.hintKo.length <= HINT_MAX ? r.hintKo : null
  const selfCheck = typeof r.selfCheck === 'string' && RESULTS.has(r.selfCheck) ? (r.selfCheck as SelfCheckResult) : null
  return { id: r.id, mode: r.mode, deliver: r.deliver as CorrectionDeliver, hintKo, selfCheck }
}

/** 기존 toolLog 의 다른 키는 보존하고 `correction` 만 바꾼다. */
export function writeCorrectionMeta(toolLog: unknown, meta: TalkCorrectionMeta): Record<string, unknown> {
  const base = toolLog && typeof toolLog === 'object' && !Array.isArray(toolLog) ? (toolLog as Record<string, unknown>) : {}
  return { ...base, correction: { id: meta.id, mode: meta.mode, deliver: meta.deliver, hintKo: meta.hintKo, selfCheck: meta.selfCheck } }
}

/** 응답에 싣는 교정 표시 필드(#29·#32·#34). 메타가 없으면 NOW·힌트 없음. */
export function talkCorrectionFields(meta: TalkCorrectionMeta | null): { deliver: CorrectionDeliver; hintKo: string | null; selfCheck: SelfCheckResult | null } {
  return { deliver: meta?.deliver ?? 'NOW', hintKo: meta?.hintKo ?? null, selfCheck: meta?.selfCheck ?? null }
}

/** 코치 판정 대상 — 힌트를 받았고 아직 판정 전인 교정. 채택·거절된 교정은 대상이 아니다(호출자가 PROPOSED 만 넘긴다). */
export function isAwaitingSelfCheck(meta: TalkCorrectionMeta | null): meta is TalkCorrectionMeta & { hintKo: string } {
  return !!meta && meta.mode === 'COACH' && meta.hintKo !== null && meta.selfCheck === null
}
