/**
 * 챌린지 주제 단어·오늘 탭 챌린지 표시의 순수 판정(task-044 가이드 §3·§5) — DOM·API 를 모른다(단위 테스트 대상).
 * 값의 원천: #158 `ChallengeTodayResponse`(띠·카드 모드·덱 챌린지 줄), #47·#48·#49 세션 `topic`·`generation`(출처 줄·사유 알림),
 * #51 `challenge`(결과 상자). 판정은 서버 값만 쓰고, 덱이 아는 "이 세트에서 답한 수"(맞힘+틀림)만 더한다 — 건너뜀은 세지 않는다(서버 규칙과 같음).
 */
import type {
  ChallengeLessonTask,
  ChallengeProgress,
  ChallengeTodayResponse,
  ChallengeTodayTasks,
  ChallengeWordsTask,
} from '@/types/challenge'
import type { JlptLevel } from '@/types/lesson'
import type { SessionSummary, TopicGeneration, VocabCard, VocabSessionInfo, VocabSessionTopic } from '@/types/vocab'
import { inProgressNotes } from './labels'
import { DECK_CH, FINISH_CH, REASON, SOURCE, STRIP, WORDS_CARD } from './topicCopy'

// ── #158 → 오늘 탭 ─────────────────────────────────────────────────────────────────────────────

/** 진행 중 챌린지의 오늘 맥락(#158 `challenge`·`today` 가 둘 다 있을 때만). 덱·오늘 탭이 같은 값을 쓴다. */
export interface ChallengeCtx {
  challengeId: string
  topicId: string
  title: string
  lengthDays: number
  level: JlptLevel
  today: ChallengeTodayTasks
}

/**
 * task-076 P10(D6 A) — 「내 단어장 세트」 준비 줄을 챌린지 문장으로 바꿀 챌린지 난이도. null = 지금 문장(「지금 수준 …」).
 * 서버 가중 기준(`vocab/sessions.ts` `mineSetCeiling`)의 「진행 중」과 같은 집합이어야 문장이 맞는다 → `topics/visible.ts` `isChallengeInProgress`
 * (ACTIVE ∧ 주제 있음 ∧ 종료일 ≥ 오늘 — **시작 전 포함**, 과제 켜짐 무관)를 #158 값으로 그대로 옮긴다. 띠·카드 모드(`challengeCtxOf`)는 기간 안만이라 쓰지 않는다.
 * **D6 B 로 바꾸면 본문을 `return null` 한 줄로**(서버 `mineSetCeiling` 과 함께).
 */
export function mineSetChallengeLevel(res: ChallengeTodayResponse | null | undefined, todayKey: string): JlptLevel | null {
  const c = res?.challenge
  if (!c || c.status !== 'ACTIVE' || c.topic.id === null || !todayKey || c.endDate < todayKey) return null
  return c.level
}

export function wordsTaskOf(today: ChallengeTodayTasks | null | undefined): ChallengeWordsTask | null {
  return (today?.tasks.find((t) => t.kind === 'WORDS') as ChallengeWordsTask | undefined) ?? null
}

export function lessonTaskOf(today: ChallengeTodayTasks | null | undefined): ChallengeLessonTask | null {
  return (today?.tasks.find((t) => t.kind === 'LESSON') as ChallengeLessonTask | undefined) ?? null
}

export function challengeCtxOf(res: ChallengeTodayResponse | null | undefined): ChallengeCtx | null {
  const c = res?.challenge
  const today = res?.today
  if (!c || c.status !== 'ACTIVE' || !today) return null
  const topicId = today.topic?.id ?? c.topic.id
  if (!topicId) return null
  return { challengeId: c.id, topicId, title: today.topic?.title ?? c.topic.title, lengthDays: c.lengthDays, level: c.level, today }
}

export type StripModel =
  | { kind: 'progress'; title: string; sub: string; aria: string; words: { state: ChallengeWordsTask['state']; label: string } | null; lesson: { state: ChallengeLessonTask['state'] } | null }
  | { kind: 'met'; title: string; sub: string; aria: string }
  | { kind: 'tomorrow'; title: string; sub: string; aria: string }

/** 띠(§3-2). 진행 중이 아니거나(끝남·없음) 기간 밖이면 null. `todayKey` = KST 오늘. */
export function stripModel(res: ChallengeTodayResponse | null | undefined, todayKey: string): StripModel | null {
  const c = res?.challenge
  if (!c || c.status !== 'ACTIVE') return null
  const ctx = challengeCtxOf(res)
  if (!ctx) {
    if (todayKey && c.startDate > todayKey) return { kind: 'tomorrow', title: STRIP.tomorrowTitle(c.topic.title), sub: STRIP.tomorrowSub, aria: STRIP.tomorrowAria(c.topic.title) }
    return null
  }
  const t = ctx.today
  if (t.goalMet) {
    return { kind: 'met', title: STRIP.metTitle, sub: STRIP.metSub(c.stats.streak, t.dayIndex >= c.lengthDays), aria: STRIP.metAria }
  }
  const w = wordsTaskOf(t)
  const l = lessonTaskOf(t)
  const done = t.tasks.filter((x) => x.state === 'DONE').length
  const total = t.tasks.length
  const need = w?.minAnswered ?? 0
  const wordsLabel = w ? (w.state === 'SHORT' ? STRIP.wordsShort(w.answered, need) : STRIP.words) : null
  return {
    kind: 'progress',
    title: STRIP.progressTitle(ctx.title, t.dayIndex, c.lengthDays),
    sub: STRIP.progressSub(done, total),
    aria: STRIP.aria({ title: ctx.title, dayIndex: t.dayIndex, days: c.lengthDays, done, total, words: w && w.state === 'SHORT' ? `단어 ${w.answered}/${need}장` : null }),
    words: w && wordsLabel ? { state: w.state, label: wordsLabel } : null,
    lesson: l ? { state: l.state } : null,
  }
}

/** 오늘 탭 카드 분기(§3-1). `chState` = #158 읽기 상태. 단어·회화 카드는 각각 챌린지 모드인지 지금 카드인지. */
export interface TodayMode {
  loading: boolean
  error: boolean
  ctx: ChallengeCtx | null
  wordsTask: ChallengeWordsTask | null
  lessonTask: ChallengeLessonTask | null
}

export function todayMode(chState: 'loading' | 'error' | 'ready', res: ChallengeTodayResponse | null): TodayMode {
  if (chState === 'loading') return { loading: true, error: false, ctx: null, wordsTask: null, lessonTask: null }
  if (chState === 'error') return { loading: false, error: true, ctx: null, wordsTask: null, lessonTask: null }
  const ctx = challengeCtxOf(res)
  return { loading: false, error: false, ctx, wordsTask: ctx ? wordsTaskOf(ctx.today) : null, lessonTask: ctx ? lessonTaskOf(ctx.today) : null }
}

/** 오늘 끝낸 이 주제 세트 합(#48 — 표시만, 판정은 #158). */
export function topicSetsTally(recent: readonly SessionSummary[], topicId: string, today: string): { sets: number; correct: number; wrong: number; skipped: number } {
  return recent
    .filter((s) => s.status === 'DONE' && s.date === today && s.topic?.id === topicId)
    .reduce((a, s) => ({ sets: a.sets + 1, correct: a.correct + s.correctCount, wrong: a.wrong + s.wrongCount, skipped: a.skipped + s.skippedCount }), { sets: 0, correct: 0, wrong: 0, skipped: 0 })
}

export type WordsCardKind = 'wip' | 'otherWip' | 'ipDefense' | 'todo' | 'short' | 'done'

/** 단어 카드 본문 상태(§3-3 판정 순서). */
export function wordsCardKind(task: ChallengeWordsTask, inProgress: { session: Pick<SessionSummary, 'topic'> } | null, topicId: string): WordsCardKind {
  if (inProgress) return inProgress.session.topic?.id === topicId ? 'wip' : 'otherWip'
  if (task.state === 'IN_PROGRESS') return 'ipDefense'
  if (task.state === 'SHORT') return 'short'
  if (task.state === 'DONE') return 'done'
  return 'todo'
}

/**
 * 풀던 세트 카드의 안내 줄(§3-3) — 지금 카드 줄(저장됨·지난 날 안내) 그대로 + 챌린지 한 줄.
 * 세트는 시작한 날로 세므로 "끝내면 오늘 합계에 더해져요"는 오늘 시작한 챌린지 주제 세트에만 쓴다(지난 날 세트는 지난 날 안내가 대신 말한다).
 */
export function wipCardNotes(kind: 'wip' | 'otherWip', sessionDate: string, today: string): string[] {
  const base = inProgressNotes(sessionDate, today)
  if (kind === 'otherWip') return [...base, WORDS_CARD.otherWipNote]
  return today && sessionDate === today ? [...base, WORDS_CARD.wipNote] : base
}

// ── 덱 머리 ───────────────────────────────────────────────────────────────────────────────────

type SourceTopic = Pick<VocabSessionTopic, 'title' | 'aiCardCount' | 'lessonCardCount'>

/** 출처 줄의 두 부분 — `desc` 설명, `note` AI 주의(새 단어가 없으면 null). 좁은 화면은 `note` 를 남기고 `desc` 부터 줄인다. */
export interface SourceParts {
  desc: string
  note: string | null
}

/** 덱 머리 출처 줄 B(§3-6). `generation` 은 #47 직후 첫 열기에만 있다(새로 고침·#48·#49 는 null → 카드 수로 고른다). */
export function topicSourceParts(topic: SourceTopic, cardCount: number, generation: TopicGeneration | null): SourceParts {
  const n = Math.max(0, cardCount)
  const ai = Math.max(0, Math.min(n, topic.aiCardCount))
  const rest = n - ai
  if (generation && !generation.generatedNow && ai > 0) return { desc: SOURCE.reuse(ai, topic.title, rest), note: SOURCE.aiNoteShort }
  if (ai > 0 && ai === n) return { desc: SOURCE.allAi(topic.title, n), note: SOURCE.aiNote }
  if (ai > 0) return { desc: SOURCE.mixed(ai, topic.title, rest), note: SOURCE.aiNoteShort }
  return { desc: SOURCE.topicOnly(topic.title, n, topic.lessonCardCount), note: null }
}

/** 출처 줄 한 문장(풀던 세트 카드·스크린 리더용). */
export function topicSourceLine(topic: SourceTopic, cardCount: number, generation: TopicGeneration | null): string {
  const p = topicSourceParts(topic, cardCount, generation)
  return p.note ? `${p.desc}${SOURCE.sep}${p.note}` : p.desc
}

/** 폴백 사유 알림 문구(#47 직후 첫 열기만). 사유가 없거나 B 줄이 말하는 경우 null. */
export function topicReasonNotice(generation: TopicGeneration | null, topic: Pick<VocabSessionTopic, 'title' | 'aiCardCount'>): string | null {
  switch (generation?.reason) {
    case 'TIMEOUT':
    case 'FAILED':
    case 'INVALID':
      return REASON.fail(topic.title)
    case 'LIMIT':
      return REASON.limit(topic.title)
    case 'NEW_DONE':
      return topic.aiCardCount === 0 ? REASON.newDone(topic.title) : null
    default:
      return null
  }
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** b − a (일). 형식이 틀리면 null. */
export function daysBetween(a: string, b: string): number | null {
  const x = DATE_RE.exec(a)
  const y = DATE_RE.exec(b)
  if (!x || !y) return null
  const ta = Date.UTC(Number(x[1]), Number(x[2]) - 1, Number(x[3]))
  const tb = Date.UTC(Number(y[1]), Number(y[2]) - 1, Number(y[3]))
  return Math.round((tb - ta) / 86_400_000)
}

type DeckSession = Pick<VocabSessionInfo, 'date'> & { topic?: Pick<VocabSessionTopic, 'id'> | null }

interface DeckBase {
  need: number
  base: number
  done: boolean
  past: { date: string; k: number } | null
}

/** 덱 챌린지 줄·끝내기 메모의 공통 입력. 챌린지 줄을 그리지 않는 조건이면 null. */
function deckBase(ctx: ChallengeCtx | null, session: DeckSession): DeckBase | null | 'pastHidden' {
  if (!ctx || !session.topic || session.topic.id !== ctx.topicId) return null
  const w = wordsTaskOf(ctx.today)
  if (!w || !w.minAnswered) return null
  if (session.date && session.date !== ctx.today.date) {
    const diff = daysBetween(session.date, ctx.today.date)
    const k = diff === null ? 0 : ctx.today.dayIndex - diff
    return k >= 1 ? { need: w.minAnswered, base: 0, done: false, past: { date: session.date, k } } : 'pastHidden'
  }
  return { need: w.minAnswered, base: w.answered, done: w.state === 'DONE', past: null }
}

/** 덱 챌린지 줄 C(§3-6). `here` = 이 세트에서 지금까지 맞힘+틀림. */
export function deckChallengeLine(ctx: ChallengeCtx | null, session: DeckSession, here: number): string | null {
  const b = deckBase(ctx, session)
  if (!b || b === 'pastHidden') return null
  if (b.past) return DECK_CH.past(b.past.date, b.past.k)
  if (b.done) return DECK_CH.done
  const run = b.base + here
  if (run >= b.need) return DECK_CH.filled(run)
  if (b.base === 0 && here === 0) return DECK_CH.first(b.need)
  return DECK_CH.run(run, b.need)
}

export interface FinishNote {
  tone: 'plain' | 'warn'
  strong: string | null
  text: string
}

/** 끝내기 확인 시트 메모(§3-7 — 위 줄이 이긴다). 챌린지 줄을 그리지 않는 조건이면 null(지금 시트 그대로). */
export function finishChallengeNote(ctx: ChallengeCtx | null, session: DeckSession, here: number): FinishNote | null {
  const b = deckBase(ctx, session)
  if (!b || b === 'pastHidden') return null
  if (here === 0) return { tone: 'plain', strong: null, text: FINISH_CH.zero(b.done, b.base, b.need) }
  if (b.past) return { tone: 'plain', strong: null, text: FINISH_CH.past(b.past.date) }
  if (b.done) return { tone: 'plain', strong: null, text: FINISH_CH.done }
  const after = b.base + here
  if (after >= b.need) return { tone: 'plain', strong: null, text: FINISH_CH.filled(after) }
  return { tone: 'warn', strong: FINISH_CH.shortStrong(b.need, after), text: FINISH_CH.short }
}

// ── 결과 ──────────────────────────────────────────────────────────────────────────────────────

export type ResultChallengeView =
  | { kind: 'metNow'; dayIndex: number; ans: number; need: number; challengeId: string }
  | { kind: 'retro'; date: string; dayIndex: number }
  | { kind: 'wordsDone'; ans: number; need: number }
  | { kind: 'short'; ans: number; need: number }
  | { kind: 'already'; ans: number }
  | { kind: 'wordsAlready'; ans: number }
  | { kind: 'pastDay'; date: string; dayIndex: number; ans: number; need: number }

/**
 * 결과 화면 챌린지 상자(§3-8 표 — 위가 이긴다). `thisAnswered` = 이 세트 맞힘+틀림. "오늘 단어 완료"는 합계를 채운 그 세트(metNow·wordsDone)에만,
 * 목표 달성 알림은 `goalMetNow` 일 때 한 번. `challenge=null` 이면 상자 없음.
 */
export function resultChallengeView(ch: ChallengeProgress | null | undefined, thisAnswered: number, todayKey: string): ResultChallengeView | null {
  if (!ch) return null
  const ans = ch.words?.answered ?? 0
  const need = ch.words?.need ?? 0
  const isToday = ch.date === todayKey
  if (ch.goalMetNow) return isToday ? { kind: 'metNow', dayIndex: ch.dayIndex, ans, need, challengeId: ch.challengeId } : { kind: 'retro', date: ch.date, dayIndex: ch.dayIndex }
  if (!ch.words) return null
  if (isToday) {
    if (ans >= need && ans - thisAnswered < need && !ch.goalMet) return { kind: 'wordsDone', ans, need }
    if (ans < need) return { kind: 'short', ans, need }
    if (ch.goalMet) return { kind: 'already', ans }
    return { kind: 'wordsAlready', ans }
  }
  return { kind: 'pastDay', date: ch.date, dayIndex: ch.dayIndex, ans, need }
}

/** [단어장에 넣기] 본문(#41 — 예문·품사 없이 바로 저장). 뜻이 비면 null(버튼을 그리지 않는다). */
export function addBody(card: Pick<VocabCard, 'surface' | 'reading' | 'correctText' | 'meaning'>): { surface: string; reading?: string; meaning: string } | null {
  const meaning = (card.correctText ?? card.meaning ?? '').trim()
  const surface = card.surface.trim()
  if (!meaning || !surface) return null
  const reading = card.reading?.trim()
  return reading ? { surface, reading, meaning } : { surface, meaning }
}

// ── 새 단어 세트 시작 토큰(E2) ───────────────────────────────────────────────────────────────────

export interface TopicStartToken {
  v: 1
  topicId: string
  title: string
  count: number
  /**
   * task-059 이전 화면이 남긴 값(배포 직후 60초 동안만 있을 수 있다). 읽어서 형식만 확인하고 **#47 본문에는 싣지 않는다** —
   * 실으면 그 세트만 이전 4지선다로 만들어진다(§23-10 D 6). 새 화면은 쓰지 않는다.
   */
  mode?: 'CHOICE' | 'FLIP'
  wordsDone: boolean
  at: number
}

export const TOPIC_START_TTL_MS = 60_000

/** 저장된 시작 값 해석 — 형식이 틀리거나 60초가 지났으면 null(대기 화면은 오늘로 돌아간다). */
export function parseTopicStart(raw: string | null, now: number): TopicStartToken | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const t = v as Partial<TopicStartToken>
  if (t.v !== 1 || typeof t.topicId !== 'string' || !t.topicId || typeof t.title !== 'string' || typeof t.at !== 'number') return null
  if (typeof t.count !== 'number' || !Number.isInteger(t.count) || t.count < 1) return null
  if (t.mode !== undefined && t.mode !== 'CHOICE' && t.mode !== 'FLIP') return null
  if (now - t.at > TOPIC_START_TTL_MS || t.at - now > TOPIC_START_TTL_MS) return null
  return { v: 1, topicId: t.topicId, title: t.title, count: t.count, ...(t.mode ? { mode: t.mode } : {}), wordsDone: t.wordsDone === true, at: t.at }
}

/** 대기 화면이 #47 로 보내는 값(`generate` 제외) — 주제·장수만. 토큰에 옛 `mode` 가 있어도 싣지 않는다(서버 기본 = 카드 우선). */
export function topicStartBody(t: Pick<TopicStartToken, 'topicId' | 'count'>): { topicId: string; count: number } {
  return { topicId: t.topicId, count: t.count }
}

/** #47 응답의 `generation` 을 덱 첫 열기로 넘기는 값의 해석(형식이 틀리면 null). */
export function parseGeneration(raw: string | null): TopicGeneration | null {
  if (!raw) return null
  try {
    const g = JSON.parse(raw) as Partial<TopicGeneration> | null
    if (!g || (g.source !== 'AI' && g.source !== 'MIXED' && g.source !== 'TOPIC') || typeof g.generatedNow !== 'boolean') return null
    return { source: g.source, generatedNow: g.generatedNow, reason: g.reason ?? null }
  } catch {
    return null
  }
}
