/**
 * 오늘의 회화 화면의 순수 판정(screens §12-3 A·§12-2 D·K·F) — 단위 테스트 대상. DOM·API 를 모른다.
 *  - `deriveLessonCard`: 오늘 홈 카드 8상태(표의 위 줄이 이긴다)
 *  - `genPhase`: 생성 대기 경과 문구
 *  - `endResultFrom`: #60 DONE 레슨 → 종료 카드 값(#62 `result` 와 같은 계산)
 *  - `memoWordProblem`: 들린 단어 메모 한 줄 검사(서버 #61·#62a 규칙과 같음)
 *  - `hasJa`: 가나·한자가 있으면 일본어로 본다(`lang="ja"`)
 */
import type { LessonContent, LessonDto, LessonProgress, MemoDraft, NextPreview, TodayLessonItem, TodayLessons } from '@/types/lesson'

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
  const list = today.todayLessons ?? []
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
