/**
 * 오늘의 회화 화면의 순수 판정(screens §12-3 A·§12-2 D·K·F) — 단위 테스트 대상. DOM·API 를 모른다.
 *  - `deriveLessonCard`: 오늘 홈 카드 8상태(표의 위 줄이 이긴다)
 *  - `genPhase`: 생성 대기 경과 문구
 *  - `endResultFrom`: #60 DONE 레슨 → 종료 카드 값(#62 `result` 와 같은 계산)
 *  - `memoWordProblem`: 들린 단어 메모 한 줄 검사(서버 #61·#62a 규칙과 같음)
 *  - `hasJa`: 가나·한자가 있으면 일본어로 본다(`lang="ja"`)
 *  - 줄 다시 듣기·표현 소리 키(task-025): `lineReplayKey`·`exprKey`·`lineReplayPace`·`activeLineReplay`·`playLineReplay`·`playExpr`
 *  - 문제 문장 표기(task-025·025b): `quizPromptView`·`quizSummaryPrompt`(promptKo 가 비었거나 한글이 없으면 일본어 문장 폴백)
 */
import type { PlaybackSnapshot } from '@/modules/speech/tts/client'
import type { AudioPace, LessonContent, LessonDto, LessonProgress, LessonQuiz, MemoDraft, NextPreview, TodayLessonItem, TodayLessons } from '@/types/lesson'
import { U3 } from './lessonCopy'
import type { LessonPlayback } from './useLessonPlayback'

const JA_RE = /[぀-ヿ㐀-鿿]/

export function hasJa(s: string): boolean {
  return JA_RE.test(s)
}

/* ── 오늘 홈 카드 ─────────────────────────────────────────────────── */

export type LessonCard =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'gen'; lesson: TodayLessonItem }
  | { kind: 'progress'; lessonId: string; topic: string | null; stageDone: number; date: string | null; ready: boolean }
  | { kind: 'genfail'; lesson: TodayLessonItem }
  | { kind: 'done'; lesson: TodayLessonItem; nextPreview: NextPreview | null }
  | { kind: 'start' }

export function deriveLessonCard(state: 'loading' | 'error' | 'ready', today: TodayLessons | null): LessonCard {
  if (state === 'loading') return { kind: 'loading' }
  if (state === 'error' || !today) return { kind: 'error' }
  // 복습 레슨(task-010b)도 오늘 날짜라 함께 온다 — 오늘의 회화 카드는 새 수업만 본다(screens §14-2 A).
  const list = (today.todayLessons ?? []).filter((l) => l.kind === 'NEW')
  const gen = list.find((l) => l.status === 'GENERATING')
  if (gen) return { kind: 'gen', lesson: gen }
  const open = list.find((l) => l.status === 'READY' || l.status === 'IN_PROGRESS')
  if (open) return { kind: 'progress', lessonId: open.id, topic: open.topic?.title ?? null, stageDone: open.stageDone, date: null, ready: open.status === 'READY' && open.stageDone === 0 }
  const r = today.resume
  if (r) return { kind: 'progress', lessonId: r.id, topic: r.titleKo || r.title, stageDone: r.stageDone, date: r.date, ready: false }
  if (list[0] && list[0].status === 'FAILED') return { kind: 'genfail', lesson: list[0] }
  const done = list.find((l) => l.status === 'DONE')
  if (done) return { kind: 'done', lesson: done, nextPreview: today.recommendation?.nextPreview ?? null }
  return { kind: 'start' }
}

/** 점수(서버 재채점) → 맞힌 수. 문제는 늘 5개(스키마 고정)라 기본 5. */
export function correctFromScore(score: number | null, total = 5): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 0
  return Math.max(0, Math.min(total, Math.round((score / 100) * total)))
}

/* ── 생성 대기 문구 ───────────────────────────────────────────────── */

export function genPhase(elapsedSec: number, stage: string | null): string {
  if (elapsedSec >= 120) return '조금 오래 걸리고 있어요. 조금만 더 기다려 주세요.'
  if (stage === 'SAVE') return '마지막으로 확인하고 있어요'
  if (elapsedSec < 15) return '주제와 지난 수업을 살펴보고 있어요'
  if (elapsedSec < 45) return '대화문을 쓰고 있어요'
  if (elapsedSec < 75) return '문법과 문제를 만들고 있어요'
  if (elapsedSec < 100) return '응용·말하기 과제를 고르고 있어요'
  return '마지막으로 확인하고 있어요'
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ── 종료 카드 ───────────────────────────────────────────────────── */

export interface EndResult {
  correct: number
  total: number
  applicationDone: number
  usedIds: string[]
  missedIds: string[]
  nextPreview: NextPreview | null
}

/** 말하기 목표 중 판정 가능했던 것 — 시도한 과제에서 matched·missed 어디에도 없으면(판정 불가) 뺀다. 시도 안 한 과제 목표는 못 쓴 표현. */
export function expressionsFrom(content: Pick<LessonContent, 'speaking'>, progress: LessonProgress): { usedIds: string[]; missedIds: string[] } {
  const records = Array.isArray(progress.speaking) ? progress.speaking : []
  const used = new Set<string>()
  const judged = new Set<string>()
  for (const r of records) {
    for (const id of r.matchedIds ?? []) {
      used.add(id)
      judged.add(id)
    }
    for (const id of r.missedIds ?? []) judged.add(id)
  }
  const attempted = new Set(records.map((r) => r.itemId))
  const all: string[] = []
  for (const s of content.speaking) for (const id of s.targetIds) if (!all.includes(id)) all.push(id)
  const unknownInAttempted = new Set<string>()
  for (const s of content.speaking) if (attempted.has(s.id)) for (const id of s.targetIds) if (!judged.has(id)) unknownInAttempted.add(id)
  const candidates = all.filter((id) => !unknownInAttempted.has(id) || used.has(id))
  return { usedIds: candidates.filter((id) => used.has(id)), missedIds: candidates.filter((id) => !used.has(id)) }
}

export function endResultFrom(lesson: Pick<LessonDto, 'score' | 'content' | 'progress'>): EndResult | null {
  const c = lesson.content
  if (!c) return null
  const total = c.quiz.length || 5
  const answers = lesson.progress.application?.answers ?? []
  const expr = expressionsFrom(c, lesson.progress)
  return {
    correct: correctFromScore(lesson.score, total),
    total,
    applicationDone: answers.filter((a) => typeof a === 'string' && a.trim() !== '').length,
    usedIds: expr.usedIds,
    missedIds: expr.missedIds,
    nextPreview: c.nextPreview ?? null,
  }
}

/* ── 들린 단어 메모 ───────────────────────────────────────────────── */

export const MEMO_PER_SEGMENT = 5
export const MEMO_PER_LESSON = 15
export const MEMO_WORD_MAX = 20

export type MemoProblem = 'NOT_JA' | 'DUP' | 'SEGMENT_FULL' | 'LESSON_FULL' | null

/** 서버와 같은 정규화(NFKC·앞뒤 공백 제거). 비었으면 ''. */
export function cleanMemo(raw: string): string {
  return raw.normalize('NFKC').trim()
}

export function memoWordProblem(word: string, segment: number, memo: readonly MemoDraft[]): MemoProblem {
  if (!word || Array.from(word).length > MEMO_WORD_MAX || !hasJa(word)) return 'NOT_JA'
  const inSeg = memo.filter((m) => m.segment === segment)
  if (inSeg.some((m) => m.ja === word)) return 'DUP'
  if (inSeg.length >= MEMO_PER_SEGMENT) return 'SEGMENT_FULL'
  if (memo.length >= MEMO_PER_LESSON) return 'LESSON_FULL'
  return null
}

/** #62a 본문 — 메모가 있는 구간만, 구간당 ≤5(순서 유지). */
export function memoRequest(memo: readonly MemoDraft[]): { segments: { segment: number; words: string[] }[] } {
  const by = new Map<number, string[]>()
  for (const m of memo) {
    const list = by.get(m.segment) ?? []
    if (list.length < MEMO_PER_SEGMENT && !list.includes(m.ja)) list.push(m.ja)
    by.set(m.segment, list)
  }
  return { segments: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([segment, words]) => ({ segment, words })) }
}

/* ── 단계·구간 ───────────────────────────────────────────────────── */

/** 처음 열 단계 = min(stageDone + 1, 5). */
export function firstStage(stageDone: number): number {
  return Math.min(5, Math.max(1, stageDone + 1))
}

/** 구간 번호 → 대화 줄 번호 목록(0부터). */
export function segmentLines(content: Pick<LessonContent, 'dialogue'>): Map<number, number[]> {
  const out = new Map<number, number[]>()
  content.dialogue.forEach((d, i) => {
    const list = out.get(d.segment) ?? []
    list.push(i)
    out.set(d.segment, list)
  })
  return out
}

/** "0.8배" — 설정 learningSpeed(0.6/0.8/1.0, 없으면 0.8). */
export function rateLabel(speed: number | null | undefined): string {
  const v = speed === 0.6 || speed === 0.8 || speed === 1 ? speed : 0.8
  return v === 1 ? '1.0' : String(v)
}

/* ── 다시 듣기·표현 소리(task-025) ─────────────────────────────────── */

/*
 * 진행 기록(`listen.played`·`segmentsDone` → #61, 완료 때 StudyLog)은 **구간 재생(`seg:{k}:{pace}`)의 onComplete 만** 쓴다.
 * 줄 다시 듣기(`line:{idx}`)·표현 소리(`expr:{idx}`)는 onComplete 를 넘기지 않아 기록을 만들지 않는다.
 * 같은 재생 큐를 쓰므로 구간 재생 중에 누르면 그 구간 재생은 끊기고(breakPending) "느리게/보통 ✓"도 채워지지 않는다.
 */
export const lineReplayKey = (idx: number) => `line:${idx}`
export const exprKey = (idx: number) => `expr:${idx}`

/** 줄 다시 듣기 속도(결정 a=A) — 그 구간을 보통 속도로 끝까지 듣기 전엔 느리게, 들은 뒤엔 보통. 다시 보기는 늘 보통. */
export function lineReplayPace(normalDone: boolean, reviewing: boolean): AudioPace {
  return normalDone || reviewing ? 'normal' : 'slow'
}

/** 이 key 소리를 아직 받는 중(첫 소리 전)인가 — 큐가 `waiting` 이거나, 받았지만 재생 손잡이가 아직 없을 때. */
export function isLoadingSnapshot(s: Pick<PlaybackSnapshot, 'phase' | 'messageId' | 'chunkIndex'>, key: string): boolean {
  return s.messageId === key && (s.phase === 'waiting' || (s.phase === 'playing' && s.chunkIndex === null))
}

const LINE_KEY = /^line:(\d+)$/

/** 지금 소리 나는(받는·막힌) 줄 다시 듣기 — 상태 줄은 `lineOf` 가 아니라 이 값으로 그린다. 다른 재생이면 null. */
export function activeLineReplay(s: Pick<PlaybackSnapshot, 'phase' | 'messageId' | 'chunkIndex'>): { idx: number; loading: boolean; blocked: boolean } | null {
  if (s.phase === 'idle' || !s.messageId) return null
  const m = LINE_KEY.exec(s.messageId)
  if (!m) return null
  return { idx: Number(m[1]), loading: isLoadingSnapshot(s, s.messageId), blocked: s.phase === 'blocked' }
}

/** 대화 줄 하나 다시 듣기(#62c dialogue) — onComplete 없음 = 진행·StudyLog 쓰기 0. */
export function playLineReplay(pb: Pick<LessonPlayback, 'playLines'>, idx: number, pace: AudioPace): void {
  pb.playLines(lineReplayKey(idx), [{ kind: 'dialogue', idx, pace }])
}

/** 오늘의 표현 소리(#62c chunk, 보통 속도 한 번) — onComplete 없음. */
export function playExpr(pb: Pick<LessonPlayback, 'playLines'>, idx: number): void {
  pb.playLines(exprKey(idx), [{ kind: 'chunk', idx, pace: 'normal' }])
}

/* ── 문제 문장 표기(task-025, Q10) ──────────────────────────────────── */

const filled = (s: string | null | undefined): string | null => (typeof s === 'string' && s.trim() ? s : null)

// 학습자 UI 가 conversation 층을 import 할 수 없어 `learning/lessons/matching.ts` 의 HANGUL 과 같은 범위(자모·호환 자모·음절)를 따로 둔다.
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏가-힯]/

/** 한글이 하나라도 있어야 한국어 질문으로 인정한다 — LLM 이 promptKo 에 일본어만 넣는 경우(task-025b D9)를 거른다. */
const koText = (s: string | null | undefined): string | null => {
  const f = filled(s)
  return f && HANGUL_RE.test(f) ? f : null
}

/** promptJa 가 비었을 때 일본어뿐인 promptKo 를 일본어 줄로 내린다(버리면 문제 문장 자체가 사라진다). 한글이 섞였으면 koText 쪽이다. */
const jaFromKo = (s: string | null | undefined): string | null => {
  const f = filled(s)
  return f && !HANGUL_RE.test(f) && hasJa(f) ? f : null
}

/**
 * 문제 카드 머리 — 한글이 있는 promptKo 만 한국어 질문(굵게) → 일본어 문장(있으면).
 * 옛 레슨(v7 이하)의 빈 promptKo, 새 레슨이라도 일본어만 담긴 promptKo 는 공통 안내 줄 + 일본어 문장 + 안내 노트(서버 요청 없음).
 * 일본어 문장은 promptJa 가 우선이고, 없으면 일본어뿐인 promptKo 를 쓴다.
 */
export function quizPromptView(q: Pick<LessonQuiz, 'promptKo' | 'promptJa'>): { ko: string; ja: string | null; legacy: boolean } {
  const ko = koText(q.promptKo)
  const ja = filled(q.promptJa)
  if (ko) return { ko, ja, legacy: false }
  return { ko: U3.legacyPrompt, ja: ja ?? jaFromKo(q.promptKo), legacy: true }
}

/** 결과 목록 한 줄 — 한글 promptKo → promptJa → 일본어뿐인 promptKo 순(공통 안내 줄은 마지막 폴백 — 모든 줄이 같은 말이 되니까). */
export function quizSummaryPrompt(q: Pick<LessonQuiz, 'promptKo' | 'promptJa'>): { text: string; ja: boolean } {
  const ko = koText(q.promptKo)
  if (ko) return { text: ko, ja: false }
  const ja = filled(q.promptJa) ?? jaFromKo(q.promptKo)
  return ja ? { text: ja, ja: true } : { text: U3.legacyPrompt, ja: false }
}
