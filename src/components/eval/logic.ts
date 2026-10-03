/**
 * AI 평가 화면 로직(순수 — DOM·요청 없음, 단위 테스트 `__tests__/evalLogic.test.ts`).
 * 데모 v1 승인본의 상태 규칙: 오늘 홈 카드 상태 · 화면 갈래 · 10분 타이머(서버 마감 기준) · 번호 이동·안 푼 문항 · 듣기 2회(e=B) ·
 * 자막만이면 회화 평가 시작 막기(b=B) · 틀린 곳 찾기 조각 답(f=A, 조각 없는 옛 문항은 고쳐 쓰기) · 결과 표시.
 */
import { kstDateKey } from '@/components/common/format'
import type { JlptLevel } from '@/types/lesson'
import type { AnswerBody, EvalItemKind, EvalKind, EvaluationDetail, EvaluationItem, EvaluationListItem } from '@/types/evaluation'

export const EVAL_TIME_LIMIT_SEC = 600
export const WARN_SEC = 60
/** 결정 (e)=B — 처음 듣기를 포함해 2번. */
export const LISTEN_MAX = 2
/** 서버 #65 `NOT_ENOUGH_WORDS` 기준(재료 60% × 10·6). */
export const NEED_WORDS: Record<EvalKind, number> = { WORDS: 6, TALK: 4 }
export const LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

/* ── 시간 ─────────────────────────────────────────────────────────── */

/** `9:41` · 지났으면 `+0:12`. */
export function clockText(sec: number): string {
  const a = Math.abs(Math.trunc(sec))
  const m = Math.floor(a / 60)
  const s = a % 60
  return `${sec < 0 ? '+' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

/** `1분 20초` · `12초` · `3분 05초`(데모 fmtKo 와 같음). */
export function koDuration(sec: number): string {
  const a = Math.abs(Math.trunc(sec))
  const m = Math.floor(a / 60)
  const s = a % 60
  return `${m ? `${m}분 ` : ''}${s < 10 && m ? '0' : ''}${s}초`
}

/** 서버 마감까지 남은 초(지났으면 음수, 0.5초 지났으면 -1). 마감을 모르면 null. */
export function remainSecOf(deadlineAt: string | null, now: number): number | null {
  if (!deadlineAt || !now) return null
  const d = Date.parse(deadlineAt)
  if (Number.isNaN(d)) return null
  const ms = d - now
  return ms >= 0 ? Math.ceil(ms / 1000) : -Math.ceil(-ms / 1000)
}

export type TimerTone = 'normal' | 'warn' | 'over'

export function timerTone(remain: number | null): TimerTone {
  if (remain === null) return 'normal'
  if (remain < 0) return 'over'
  return remain <= WARN_SEC ? 'warn' : 'normal'
}

/** 경과 초(시작을 모르면 0). */
export function elapsedSince(iso: string | null, now: number): number {
  if (!iso || !now) return 0
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / 1000))
}

/** 시작 → 끝(초). 어느 하나라도 모르면 null. */
export function spanSec(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const a = Date.parse(from)
  const b = Date.parse(to)
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.max(0, Math.round((b - a) / 1000))
}

/* ── 화면 갈래 ─────────────────────────────────────────────────────── */

export type EvalView = 'gen' | 'genfail' | 'ready' | 'run' | 'grading' | 'gradefail' | 'result'

/** #66 status → 화면. 채점 중인데 살아 있는 잡이 없으면(오류 코드 유무와 무관) 실패 — [다시 채점하기] = #68 다시. */
export function evalView(d: Pick<EvaluationDetail, 'status' | 'jobId'>): EvalView {
  switch (d.status) {
    case 'GENERATING':
      return 'gen'
    case 'FAILED':
      return 'genfail'
    case 'READY':
      return 'ready'
    case 'IN_PROGRESS':
      return 'run'
    case 'GRADING':
      return d.jobId ? 'grading' : 'gradefail'
    default:
      return 'result'
  }
}

/* ── 오늘 홈 카드 ──────────────────────────────────────────────────── */

export type EvalCard =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'first' }
  | { kind: 'start'; last: EvaluationListItem | null }
  | { kind: 'gen'; ev: EvaluationListItem; jobId: string | null }
  | { kind: 'ready'; ev: EvaluationListItem; itemCount: number }
  | { kind: 'progress' | 'over'; ev: EvaluationListItem; itemCount: number; answered: number | null; remain: number | null }
  | { kind: 'grading'; ev: EvaluationListItem; jobId: string }
  | { kind: 'gradefail'; ev: EvaluationListItem }
  | { kind: 'done'; ev: EvaluationListItem; focus: string | null }

const ITEM_COUNT: Record<EvalKind, number> = { WORDS: 10, TALK: 6 }

/** 가장 최근 평가(#69 limit=1) 하나와 필요할 때만 읽은 상세(#66)로 카드 상태를 정한다. 진행 중이면 그 평가로만 간다(한 번에 하나). */
export function deriveEvalCard(
  state: 'loading' | 'error' | 'ready',
  latest: EvaluationListItem | null,
  detail: EvaluationDetail | null,
  today: string,
  now: number,
): EvalCard {
  if (state === 'loading') return { kind: 'loading' }
  if (state === 'error') return { kind: 'error' }
  if (!latest) return { kind: 'first' }
  const d = detail && detail.id === latest.id ? detail : null
  const itemCount = d?.itemCount || ITEM_COUNT[latest.kind]
  switch (latest.status) {
    case 'GENERATING':
      return { kind: 'gen', ev: latest, jobId: d?.jobId ?? null }
    case 'READY':
      return { kind: 'ready', ev: latest, itemCount }
    case 'IN_PROGRESS': {
      const remain = remainSecOf(d?.deadlineAt ?? latest.deadlineAt, now)
      return { kind: remain !== null && remain < 0 ? 'over' : 'progress', ev: latest, itemCount, answered: d ? d.answeredCount : null, remain }
    }
    case 'GRADING':
      if (!d) return { kind: 'grading', ev: latest, jobId: '' }
      return d.jobId ? { kind: 'grading', ev: latest, jobId: d.jobId } : { kind: 'gradefail', ev: latest }
    case 'DONE':
      if (latest.completedAt && kstDateKey(latest.completedAt) === today) return { kind: 'done', ev: latest, focus: d?.result?.nextFocus[0] ?? null }
      return { kind: 'start', last: latest }
    default:
      return { kind: 'start', last: null }
  }
}

/** 카드가 상세(#66)까지 읽어야 하는가 — 진행 중(개수·남은 시간·잡)과 오늘 끝난 평가(다음에 집중할 것). */
export function cardNeedsDetail(latest: EvaluationListItem | null, today: string): boolean {
  if (!latest) return false
  if (latest.status === 'DONE') return !!latest.completedAt && kstDateKey(latest.completedAt) === today
  return latest.status !== 'FAILED'
}

/* ── 시작 ─────────────────────────────────────────────────────────── */

/** 결정 (b)=B: 자막만(선생님 목소리 불가)이면 회화 평가는 시작할 수 없다. 단어가 모자라면 그 종류를 막는다(서버 기준과 같음). */
export function startBlock(kind: EvalKind, textOnly: boolean, have: number | null): 'TTS' | 'FEW' | null {
  if (kind === 'TALK' && textOnly) return 'TTS'
  if (have !== null && have < NEED_WORDS[kind]) return 'FEW'
  return null
}

/** `N3으로` · `N4로` — 숫자의 한자어 읽기 받침(삼·육·영 → 으로). */
export function levelRo(level: string): string {
  const last = level.slice(-1)
  return `${level}${'036'.includes(last) ? '으로' : '로'}`
}

/* ── 문항 ─────────────────────────────────────────────────────────── */

export function promptStr(p: Record<string, unknown>, key: string): string {
  const v = p[key]
  return typeof v === 'string' ? v : ''
}

export function promptArr(p: Record<string, unknown>, key: string): string[] {
  const v = p[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** 문항 종류별 개수(처음 나온 순서) — 준비 화면 "문항 구성". */
export function countByKind(items: readonly Pick<EvaluationItem, 'kind'>[]): { kind: EvalItemKind; n: number }[] {
  const out: { kind: EvalItemKind; n: number }[] = []
  for (const it of items) {
    const row = out.find((r) => r.kind === it.kind)
    if (row) row.n++
    else out.push({ kind: it.kind, n: 1 })
  }
  return out
}

/** 안 푼 문항의 위치(0부터). */
export function missingIndexes(items: readonly Pick<EvaluationItem, 'answered'>[]): number[] {
  const out: number[] = []
  items.forEach((it, i) => {
    if (!it.answered) out.push(i)
  })
  return out
}

/* ── 저장하지 못한 답(REV-051) ──────────────────────────────────────── */

/** 다시 보낼 저장 본문 — 음성 답은 발화를 못 쓰게 됐을 때 대신 보낼 알아들은 글자(`textFallback`)도 같이 둔다. */
export interface SaveRetry {
  body: AnswerBody
  textFallback?: string
}

/** #67 한 번의 결과 — 409(제출·채점 끝)는 화면을 다시 읽으므로 실패로 남기지 않는다. */
export type SaveOutcome = 'OK' | 'FAIL' | 'CONFLICT'

/**
 * 저장 결과를 "저장하지 못한 문항" 목록에 반영한다. 서버 `answered` 로는 이미 답한 문항의 수정 실패가 드러나지 않아(옛 답이 채점됨) 따로 센다.
 * 저장은 한 줄로 차례대로 끝나므로 같은 문항은 나중 결과가 이긴다. FAIL 인데 다시 보낼 본문이 없으면 목록을 그대로 둔다.
 */
export function recordSaveOutcome(prev: ReadonlyMap<string, SaveRetry>, itemId: string, outcome: SaveOutcome, retry?: SaveRetry): Map<string, SaveRetry> {
  const next = new Map(prev)
  if (outcome !== 'FAIL') next.delete(itemId)
  else if (retry) next.set(itemId, retry.textFallback ? { body: retry.body, textFallback: retry.textFallback } : { body: retry.body })
  return next
}

/** 저장하지 못한 문항의 위치(0부터, 화면 순서). */
export function unsavedIndexes(items: readonly Pick<EvaluationItem, 'id'>[], unsaved: ReadonlySet<string> | ReadonlyMap<string, unknown>): number[] {
  const out: number[] = []
  items.forEach((it, i) => {
    if (unsaved.has(it.id)) out.push(i)
  })
  return out
}

/** 제출(#68)을 보내도 되는가 — 저장하지 못한 답이 하나라도 남아 있으면 보내지 않는다(제출 뒤에는 되돌릴 수 없다). */
export function submitGate(unsaved: ReadonlySet<string> | ReadonlyMap<string, unknown>): 'GO' | 'BLOCK' {
  return unsaved.size === 0 ? 'GO' : 'BLOCK'
}

/** 결정 (a)=B 번호로 자유 이동 — 범위 밖은 가장자리로. */
export function clampIndex(i: number, n: number): number {
  if (n <= 0) return 0
  return Math.min(n - 1, Math.max(0, Math.trunc(i)))
}

/** 다시 들어왔을 때 처음 열 문항 — 첫 안 푼 문항, 다 풀었으면 마지막. */
export function firstOpenIndex(items: readonly Pick<EvaluationItem, 'answered'>[]): number {
  const i = items.findIndex((it) => !it.answered)
  return i === -1 ? Math.max(0, items.length - 1) : i
}

export function choiceIndex(choices: readonly string[], answerText: string | null): number | null {
  if (answerText === null) return null
  const i = choices.findIndex((c) => c.normalize('NFC').trim() === answerText.normalize('NFC').trim())
  return i === -1 ? null : i
}

/* ── 듣고 답하기 ──────────────────────────────────────────────────── */

export type ListenMode = 'revealed' | 'cut' | 'audioErr' | 'normal'

/**
 * 결정 (b)=B: 시작은 목소리가 있을 때만 — 푸는 도중 끊기면(자막만) 그 문항만 [글자로 보기]. 글자를 이미 봤으면 늘 글자.
 * 소리를 받지 못했으면 [다시 시도]·[글자로 보기].
 */
export function listenMode(o: { revealed: boolean; textOnly: boolean; audioErr: boolean }): ListenMode {
  if (o.revealed) return 'revealed'
  if (o.textOnly) return 'cut'
  return o.audioErr ? 'audioErr' : 'normal'
}

export function listenLeft(played: number): { left: number; text: 'twice' | 'once' | 'none' } {
  const left = Math.max(0, LISTEN_MAX - played)
  return { left, text: left <= 0 ? 'none' : played > 0 ? 'once' : 'twice' }
}

/* ── 틀린 곳 찾기 ─────────────────────────────────────────────────── */

export interface SpotDraft {
  seg: number | null
  text: string
  fixed: string
  why: string
}

/** 조각(`prompt.segments`)이 있으면 결정 f=A(눌러 고르기), 없으면 옛 문항 폴백(원문 고쳐 쓰기). */
export function spotSegments(item: Pick<EvaluationItem, 'prompt'>): string[] {
  return promptArr(item.prompt, 'segments')
}

const WHY_MARK = '\n(이유) '

export function spotDraftFrom(item: Pick<EvaluationItem, 'prompt' | 'answerText' | 'answerSpot'>): SpotDraft {
  const sentence = promptStr(item.prompt, 'sentenceJa')
  if (spotSegments(item).length > 0) return { seg: item.answerSpot ?? null, text: item.answerText ?? '', fixed: '', why: '' }
  const a = item.answerText ?? ''
  const at = a.indexOf(WHY_MARK)
  return at >= 0 ? { seg: null, text: '', fixed: a.slice(0, at), why: a.slice(at + WHY_MARK.length) } : { seg: null, text: '', fixed: a || sentence, why: '' }
}

export function spotReady(segMode: boolean, d: SpotDraft, sentence: string): boolean {
  if (segMode) return d.seg !== null && d.text.trim().length > 0
  const f = d.fixed.trim()
  return f.length > 0 && f !== sentence.trim()
}

/** 저장 본문 — 조각 모드는 `{spotIndex, answerText}`, 폴백은 고친 문장(+이유 한 줄)을 한 답으로. */
export function spotBody(segMode: boolean, d: SpotDraft): AnswerBody {
  if (segMode) return { answerText: d.text.trim(), spotIndex: d.seg ?? 0 }
  const why = d.why.trim()
  return { answerText: `${d.fixed.trim()}${why ? `${WHY_MARK}${why}` : ''}` }
}

/** 저장된 답과 같은가(같으면 다른 문항으로 갈 때 다시 보내지 않는다). */
export function sameSpot(segMode: boolean, d: SpotDraft, item: Pick<EvaluationItem, 'answerText' | 'answerSpot' | 'answered'>): boolean {
  if (!item.answered) return false
  const b = spotBody(segMode, d)
  return b.answerText === item.answerText && (b.spotIndex ?? null) === (segMode ? (item.answerSpot ?? null) : null)
}

/* ── 결과 ─────────────────────────────────────────────────────────── */

export type ItemTone = 'full' | 'part' | 'zero'

export function itemTone(score: number | null, max: number): ItemTone {
  const s = score ?? 0
  if (s >= max) return 'full'
  return s <= 0 ? 'zero' : 'part'
}

export interface LevelProposalView {
  id: string
  status: string
  from: string
  to: string
  basis: { date: string; kind: EvalKind; score: number }[]
}

/** #66 `result.levelProposal`(SET_LEVEL) → 카드 재료. 모양이 어긋나면 null(카드 없음). */
export function levelProposalView(p: { id: string; kind: string; status: string; payload: Record<string, unknown> } | null | undefined): LevelProposalView | null {
  if (!p || p.kind !== 'SET_LEVEL') return null
  const to = typeof p.payload.level === 'string' ? p.payload.level : ''
  const from = typeof p.payload.fromLevel === 'string' ? p.payload.fromLevel : ''
  if (!to || !from) return null
  const raw = Array.isArray(p.payload.basis) ? p.payload.basis : []
  const basis = raw
    .map((b) => (b && typeof b === 'object' ? (b as Record<string, unknown>) : null))
    .filter((b): b is Record<string, unknown> => !!b && typeof b.date === 'string' && typeof b.totalScore === 'number' && (b.kind === 'WORDS' || b.kind === 'TALK'))
    .map((b) => ({ date: b.date as string, kind: b.kind as EvalKind, score: b.totalScore as number }))
  return { id: p.id, status: p.status, from, to, basis }
}

/** 결과 머리 줄 재료 — 답한 수·푼 시간·시간 초과(초). */
export function resultMeta(d: Pick<EvaluationDetail, 'items' | 'startedAt' | 'submittedAt' | 'timeLimitSec' | 'result'>): { n: number; answered: number; usedSec: number | null; overSec: number | null } {
  const used = d.result?.durationSec ?? spanSec(d.startedAt, d.submittedAt)
  const limit = d.timeLimitSec || EVAL_TIME_LIMIT_SEC
  const over = used !== null && used > limit ? used - limit : null
  return { n: d.items.length, answered: d.items.filter((i) => i.answered).length, usedSec: used, overSec: d.result?.overtime === false ? null : over }
}

/** 기록 줄 날짜 기준 — 끝난 시각, 없으면 시작 시각. */
export function histDateIso(it: Pick<EvaluationListItem, 'completedAt' | 'startedAt' | 'submittedAt'>): string | null {
  return it.completedAt ?? it.submittedAt ?? it.startedAt
}

/**
 * 틀린 곳 찾기 결과 — 원문에서 `wrongSpan` 앞뒤가 고친 문장(`correctedJa`)과 같으면 바뀐 부분만 뽑아 데모처럼 "원문(틀린 곳 취소선) 고친 말"로 보인다.
 * 앞뒤가 달라(여러 곳을 고친 문장) 뽑을 수 없으면 `fix:null` — 화면은 고친 문장 전체를 따로 보인다.
 */
export function spotFix(sentence: string, wrongSpan: string, corrected: string): { before: string; wrong: string; after: string; fix: string | null } | null {
  const at = wrongSpan ? sentence.indexOf(wrongSpan) : -1
  if (at < 0) return null
  const before = sentence.slice(0, at)
  const after = sentence.slice(at + wrongSpan.length)
  const ok = corrected.startsWith(before) && corrected.endsWith(after) && corrected.length >= before.length + after.length
  const fix = ok ? corrected.slice(before.length, corrected.length - after.length) : null
  return { before, wrong: wrongSpan, after, fix: fix || null }
}
