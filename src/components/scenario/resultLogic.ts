/**
 * 상황 역할극 B3 순수 유도 함수 — 결과 화면(가이드 §3-G) · 수업 종료 카드(§3-I) · 회화 목록 뱃지(§3-J). React·브라우저 API 를 쓰지 않는다
 * (단위 테스트 `__tests__/resultLogic.test.ts`). 문구는 `scenarioCopyResult.ts`·`scenarioCopy.ts` 만.
 * 판정·개수는 서버 결과(`RolePlayResultView` — A1-서버 `judgeScenarioCompletion` 값)를 그대로 옮긴다. 화면은 다시 판정하지 않는다.
 */
import type { ChatDetail, RolePlayChatView, RolePlayNext, RolePlayResultView } from '@/types/chat'
import type { LessonChunk } from '@/types/lesson'
import type { ScenarioKeyExpression } from '@/types/scenario'
import type { StartFailure } from './logic'
import { OUTCOME_KO } from './scenarioCopy'
import { LESSON, RESULT } from './scenarioCopyResult'

/* ── 결과 읽기 상태(S9) ─────────────────────────────────────────────── */

export type EndedRolePlay = RolePlayChatView & { ended: RolePlayResultView }

export type ResultState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'gone' }
  | { kind: 'notEnded' }
  | { kind: 'ready'; view: EndedRolePlay }

/**
 * #29 읽기 → 화면 상태. 404(남의·없는 대화)와 역할극이 아닌 대화(`scenario` 칸 없음 — 상황 행이 사라진 대화 포함)는 `res-404`,
 * 마치지 않은 역할극은 `res-notended`. 결과 화면은 읽기만 한다 — 마치기(#167)는 방 안 시트가 한다(D-9).
 */
export function resultStateOf(load: { status: 'loading' | 'ready' | 'error'; errStatus: number | null; data: Pick<ChatDetail, 'chat'> | null }): ResultState {
  if (load.status === 'loading') return { kind: 'loading' }
  if (load.status === 'error') return load.errStatus === 404 ? { kind: 'gone' } : { kind: 'error' }
  const scenario = load.data?.chat.kind === 'TALK' ? load.data.chat.scenario : null
  if (!scenario) return { kind: 'gone' }
  if (!scenario.ended) return { kind: 'notEnded' }
  return { kind: 'ready', view: scenario as EndedRolePlay }
}

/* ── 결과 판정 카드 ─────────────────────────────────────────────────── */

export interface VerdictRow {
  key: 'tutor' | 'comm' | 'expr' | 'steps'
  label: string
  value: string
  /** 채운 줄(✓ 글자가 값 안에 있다 — 색만으로 구분하지 않는다). */
  ok: boolean
}

export interface OutcomeView {
  title: string
  achieved: boolean
  /** 원 안 글자(aria-hidden) — 달성 ✓ · 그 외 △. */
  icon: string
  rows: VerdictRow[]
  /** 판정 줄 아래 한 문장 — "거의"(선생님 달성·표현 모자람) 또는 판단 없음. 없으면 null. */
  note: string | null
  recordNote: string
}

/**
 * 대화 순서 줄 값. 가이드 §3-G "진행값이 있을 때만"(REV-141 M-2) — 진행 값이 있으면 `s/S단계`(s = 0부터 센 지금 단계 + 1, 상한 S),
 * 없으면(`stepIndex` null — 지금 서버는 늘 null) 줄 없음. 전체 단계 수만 보이면 "그 단계까지 갔다"로 읽혀서다. 단계가 없는 상황도 줄 없음.
 */
export function resultSteps(stepCount: number, stepIndex: number | null | undefined): { value: string; ok: boolean } | null {
  if (!Number.isInteger(stepCount) || stepCount <= 0) return null
  if (typeof stepIndex !== 'number' || !Number.isInteger(stepIndex) || stepIndex < 0) return null
  const reached = Math.min(stepIndex + 1, stepCount)
  return { value: RESULT.stepsProgress(reached, stepCount), ok: reached >= stepCount }
}

export function outcomeView(r: RolePlayResultView, steps?: { count: number; stepIndex: number | null | undefined }): OutcomeView {
  const used = r.expressions.usedIds.length
  const { required, total } = r.expressions
  const exprOk = r.codeRulePassed
  const achieved = r.outcome === 'ACHIEVED'
  const tutor: VerdictRow = !r.judged
    ? { key: 'tutor', label: RESULT.rowTutor, value: RESULT.tutorNone, ok: false }
    : r.tutorGoalAchieved === true
      ? { key: 'tutor', label: RESULT.rowTutor, value: RESULT.tutorYes, ok: true }
      : { key: 'tutor', label: RESULT.rowTutor, value: RESULT.tutorNo, ok: false }
  const comm: VerdictRow =
    !r.judged || r.communicationSuccess === null
      ? { key: 'comm', label: RESULT.rowComm, value: RESULT.commNone, ok: false }
      : { key: 'comm', label: RESULT.rowComm, value: r.communicationSuccess ? RESULT.commYes : RESULT.commNo, ok: r.communicationSuccess }
  const rows: VerdictRow[] = [tutor, comm, { key: 'expr', label: RESULT.rowExpr, value: RESULT.exprValue(used, total, required, exprOk), ok: exprOk }]
  const st = steps ? resultSteps(steps.count, steps.stepIndex) : null
  if (st) rows.push({ key: 'steps', label: RESULT.rowSteps, value: st.value, ok: st.ok })
  const note = !r.judged
    ? RESULT.unjudgedNote
    : !achieved && r.tutorGoalAchieved === true && !exprOk
      ? RESULT.almostNote(Math.max(1, required - used))
      : null
  return {
    title: OUTCOME_KO[r.outcome] ?? OUTCOME_KO.NOT_YET,
    achieved,
    icon: achieved ? '✓' : '△',
    rows,
    note,
    recordNote: achieved ? RESULT.recordAchieved : RESULT.recordNotYet,
  }
}

/** 표현 id → 칩. 상황을 고친 뒤 사라진 표현 id 는 건너뛴다(개수 줄은 서버 값 그대로). 같은 id 는 한 번만. */
export function resultChips(expressions: readonly Pick<ScenarioKeyExpression, 'id' | 'ja' | 'ko'>[], ids: readonly string[]): { id: string; ja: string; ko: string }[] {
  const byId = new Map(expressions.map((e) => [e.id, e]))
  const seen = new Set<string>()
  const out: { id: string; ja: string; ko: string }[] = []
  for (const id of ids) {
    const e = byId.get(id)
    if (!e || seen.has(id)) continue
    seen.add(id)
    out.push({ id: e.id, ja: e.ja, ko: e.ko })
  }
  return out
}

/** 아래 버튼 순서 — 달성하고 다음 상황이 있으면 [다음 상황] 주 버튼, 그 밖은 [다시 해 보기] 주 버튼. 다음 상황이 없으면 [다른 상황 고르기]. */
export function nextPlan(r: Pick<RolePlayResultView, 'outcome' | 'next'>): { primary: 'next' | 'retry'; next: RolePlayNext | null } {
  const next = r.next && typeof r.next.id === 'string' && r.next.id ? r.next : null
  return { primary: r.outcome === 'ACHIEVED' && next ? 'next' : 'retry', next }
}

/** [다시 해 보기] 실패 토스트. */
export function retryFailureText(f: StartFailure): string {
  if (f === 'rate') return RESULT.retryRate
  if (f === 'gone' || f === 'archived') return RESULT.retryGone
  return RESULT.retryFail
}

/* ── 수업 종료 카드(§3-I) ───────────────────────────────────────────── */

const STRIP = /[\s\p{P}\p{S}]/gu

/** 겹치는 표현 비교용 — 공백·구두점·기호(〜·～·「」·。 포함)를 뺀 글자. */
export function normalizeJa(s: string): string {
  return s.normalize('NFKC').replace(STRIP, '')
}

/** 오늘 수업 표현(`content.chunks[].textJa`)과 상황 핵심 표현이 같은 것 — 상황 표현 순서, 최대 2개(안내 문구용, 판정과 무관). */
export function lessonOverlap(chunks: readonly Pick<LessonChunk, 'textJa'>[], expressions: readonly Pick<ScenarioKeyExpression, 'ja'>[], max = 2): string[] {
  const lessonSet = new Set(chunks.map((c) => normalizeJa(c.textJa)).filter(Boolean))
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of expressions) {
    const k = normalizeJa(e.ja)
    if (!k || seen.has(k) || !lessonSet.has(k)) continue
    seen.add(k)
    out.push(e.ja)
    if (out.length >= max) break
  }
  return out
}

const HIRA_FIRST = 0x3041
const HIRA_LAST = 0x3096
const KATA_FIRST = 0x30a1
const KATA_LAST = 0x30fc
const HIRA_N = 0x3093
const KATA_N = 0x30f3

/** 일본어 끝소리에 붙는 '이/가' — 가나는 'ん' 만 받침(이), 그 밖 가나·장음 부호는 가, 한자 등 읽기를 모르는 끝은 '이(가)'. */
export function jaSubjectJosa(ja: string): string {
  const chars = Array.from(ja.trim())
  const code = chars.length ? (chars[chars.length - 1].codePointAt(0) ?? 0) : 0
  if (code === HIRA_N || code === KATA_N) return '이'
  if ((code >= HIRA_FIRST && code <= HIRA_LAST) || (code >= KATA_FIRST && code <= KATA_LAST)) return '가'
  return '이(가)'
}

/**
 * 수업 카드가 읽을 상황(§3-I) — 상황 수업(`lesson.scenarioId`, A2 — `le-scenario-lesson`)이면 그 상황(추천 요청 없음),
 * 아니면 주제 추천 1개(`le-card`). 둘 다 없으면 null(카드 없음).
 */
export function lessonCardSourceOf(lesson: { scenarioId?: unknown; topic?: { id: string } | null }): { kind: 'scenario'; id: string } | { kind: 'topic'; topicId: string } | null {
  if (typeof lesson.scenarioId === 'string' && lesson.scenarioId) return { kind: 'scenario', id: lesson.scenarioId }
  return lesson.topic?.id ? { kind: 'topic', topicId: lesson.topic.id } : null
}

/** 수업 카드 대상 고르기 — 추천 1개(`recommended=1&limit=1`)의 첫 항목. 없으면 카드 없음. */
export function lessonPickOf(res: { items?: readonly { id: string }[] } | null | undefined): string | null {
  const first = res?.items?.[0]
  return first && typeof first.id === 'string' && first.id ? first.id : null
}

/** 수업 카드 본문 한 줄의 뒤쪽(겹치는 표현이 있을 때만) — 마지막 「」 뒤 조사. */
export function overlapTail(overlaps: readonly string[]): string | null {
  const last = overlaps[overlaps.length - 1]
  return last ? LESSON.overlapAfter(jaSubjectJosa(last)) : null
}

/* ── 회화 목록 뱃지(§3-J, D-5) ──────────────────────────────────────── */

/**
 * #27 행이 역할극인지 — `scenario?:{id, ended}`(가이드 S-계약) 또는 `scenarioId`. 지금 #27 은 둘 다 주지 않아 늘 null(뱃지 없음 — 화면은 둘 다 견딘다).
 * `ended` 는 참/거짓 또는 결과 객체를 모두 받는다.
 */
export function rolePlayRowOf(chat: object): { ended: boolean } | null {
  const rec = chat as { scenario?: unknown; scenarioId?: unknown }
  const sc = rec.scenario
  if (sc && typeof sc === 'object') {
    const s = sc as { id?: unknown; ended?: unknown }
    if (typeof s.id !== 'string' || !s.id) return null
    return { ended: s.ended === true || (typeof s.ended === 'object' && s.ended !== null) }
  }
  if (typeof rec.scenarioId === 'string' && rec.scenarioId) return { ended: false }
  return null
}
