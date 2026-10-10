/**
 * 들린 단어 메모 → 단어 제안 재료(task-010 L3, api-contract #62a). learning 은 **후보만** 만든다 — TutorProposal(L2 소유) 쓰기는
 * 라우트가 conversation 에 위임하고, A10 보강 실행도 라우트가 요청을 만들어 넘긴다(L3 는 L2 를 import 하지 않는다).
 *
 * 단어마다(요청 순서):
 *   형식 위반(가나·한자 없음·20자 초과) → 건너뜀 NOT_JAPANESE · 같은 요청 안 중복 → DUPLICATE
 *   이 레슨에서 이미 처리한 단어 → 그때 결과 그대로(제안 카드 또는 IN_WORDBOOK) — 다시 보내도 새 행 없음
 *   메모 한도(구간 5·레슨 15, 이미 적어 둔 초안 포함) 초과 → LIMIT
 *   레슨 조각(chunks)과 표기·읽기가 같으면 그 조각의 표기·읽기·뜻(via CHUNK), 아니면 A10 보강 대상(via ENRICH)
 *   단어장에 같은 표현(**바이트 일치** — DB 콜레이션은 は/ぱ 를 같게 본다)이 있으면 → IN_WORDBOOK
 *   예문 = 그 단어가 나온 대화 줄(같은 구간 먼저).
 */
import { ApiError, prisma, type Tx } from '@/modules/infra'
import type { WordDraft } from '../vocab/enrich'
import { readStoredContent, type StoredLessonContent } from './content'
import { normalizeForMatch } from './matching'
import { MEMO_PER_LESSON_MAX, MEMO_PER_SEGMENT_MAX, memoDrafts, memoProcessed, readProgress, type MemoDraft, type MemoProcessed } from './progress'
import { lessonNotFound, stateConflict, writeProgress, type LessonWriteHandle } from './rows'
import { isLessonId, type MemoRequestWord } from './validate'

export type MemoSkipReason = 'NOT_JAPANESE' | 'DUPLICATE' | 'LIMIT' | 'IN_WORDBOOK' | 'ENRICH_FAILED'

/** conversation `LessonWordDraft` 와 같은 모양(라우트가 그대로 넘긴다). */
export interface MemoWordDraft {
  surface: string
  reading: string | null
  meaning: string
  lessonId: string
  segment: number
  lineIdx: number | null
  via: 'CHUNK' | 'ENRICH'
  /** 학습자가 적은 메모 그대로(표기가 조각 표기로 바뀌었을 때 화면이 메모 칩과 짝짓는다). */
  memo: string
  partOfSpeech?: string | null
  jlpt?: string | null
  example?: string | null
  exampleKo?: string | null
}

export type MemoPlanEntry =
  | { memo: string; segment: number; action: 'SKIP'; reason: MemoSkipReason; wordId?: string }
  | { memo: string; segment: number; action: 'KNOWN'; prior: MemoProcessed }
  | { memo: string; segment: number; action: 'PROPOSE'; draft: MemoWordDraft }
  | { memo: string; segment: number; action: 'ENRICH'; surface: string; lineIdx: number | null; example: string | null; exampleKo: string | null }

export interface MemoPlan {
  lessonId: string
  topicId: string | null
  level: string
  entries: MemoPlanEntry[]
}

function findLine(content: StoredLessonContent, segment: number, surface: string, reading: string | null): number | null {
  const s = normalizeForMatch(surface)
  const r = reading ? normalizeForMatch(reading) : ''
  const hit = (i: number) => {
    const d = content.dialogue[i]
    return (!!s && normalizeForMatch(d.ja).includes(s)) || (!!r && normalizeForMatch(d.reading).includes(r))
  }
  const idx = content.dialogue.map((_, i) => i)
  return idx.find((i) => content.dialogue[i].segment === segment && hit(i)) ?? idx.find(hit) ?? null
}

/**
 * 단어장 바이트 일치 — 표현 → 단어 id. 메모는 표기만 있어 읽기로 가를 수 없다 — 같은 표기·다른 읽기 행이 여럿이면(task-051, REV-179 M2)
 * 가장 먼저 만든 행으로 고정한다. `db` 는 시험 주입용(기본 prisma).
 */
export async function wordbookMatches(userId: string, surfaces: string[], db: Tx = prisma): Promise<Map<string, string>> {
  const uniq = [...new Set(surfaces)].slice(0, 60)
  if (!uniq.length) return new Map()
  const rows = await db.wordEntry.findMany({ where: { userId, surface: { in: uniq } }, select: { id: true, surface: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 500 })
  const out = new Map<string, string>()
  for (const r of rows) if (uniq.includes(r.surface) && !out.has(r.surface)) out.set(r.surface, r.id)
  return out
}

/** 순수 계획(DB 결과를 받아서) — 테스트가 직접 부른다. */
export function planMemoEntries(
  content: StoredLessonContent,
  lessonId: string,
  existing: { drafts: MemoDraft[]; processed: MemoProcessed[] },
  words: readonly MemoRequestWord[],
): { entries: MemoPlanEntry[]; surfaces: string[] } {
  const seen = new Set<string>()
  const memoSet = new Map<string, number>()
  for (const d of existing.drafts) if (!memoSet.has(d.ja)) memoSet.set(d.ja, d.segment)
  for (const p of existing.processed) if (!memoSet.has(p.ja)) memoSet.set(p.ja, p.segment)
  const perSegment = (seg: number) => [...memoSet.values()].filter((s) => s === seg).length
  const processedBy = new Map(existing.processed.map((p) => [p.ja, p]))
  const entries: MemoPlanEntry[] = []
  const surfaces: string[] = []
  for (const w of words) {
    const memo = w.ja ?? w.raw
    if (!w.ja) {
      entries.push({ memo, segment: w.segment, action: 'SKIP', reason: 'NOT_JAPANESE' })
      continue
    }
    if (seen.has(w.ja)) {
      entries.push({ memo, segment: w.segment, action: 'SKIP', reason: 'DUPLICATE' })
      continue
    }
    seen.add(w.ja)
    const prior = processedBy.get(w.ja)
    if (prior) {
      entries.push({ memo, segment: w.segment, action: 'KNOWN', prior })
      continue
    }
    if (!memoSet.has(w.ja)) {
      if (memoSet.size >= MEMO_PER_LESSON_MAX || perSegment(w.segment) >= MEMO_PER_SEGMENT_MAX) {
        entries.push({ memo, segment: w.segment, action: 'SKIP', reason: 'LIMIT' })
        continue
      }
      memoSet.set(w.ja, w.segment)
    }
    const key = normalizeForMatch(w.ja)
    const chunk = content.chunks.find((c) => normalizeForMatch(c.textJa) === key || (!!c.reading && normalizeForMatch(c.reading) === key))
    if (chunk) {
      const lineIdx = findLine(content, w.segment, chunk.textJa, chunk.reading)
      const line = lineIdx !== null ? content.dialogue[lineIdx] : null
      surfaces.push(chunk.textJa)
      entries.push({
        memo,
        segment: w.segment,
        action: 'PROPOSE',
        draft: { surface: chunk.textJa, reading: chunk.reading || null, meaning: chunk.meaningKo, lessonId, segment: w.segment, lineIdx, via: 'CHUNK', memo, example: line?.ja ?? null, exampleKo: line?.ko ?? null },
      })
    } else {
      const lineIdx = findLine(content, w.segment, w.ja, null)
      const line = lineIdx !== null ? content.dialogue[lineIdx] : null
      surfaces.push(w.ja)
      entries.push({ memo, segment: w.segment, action: 'ENRICH', surface: w.ja, lineIdx, example: line?.ja ?? null, exampleKo: line?.ko ?? null })
    }
  }
  return { entries, surfaces }
}

/** 단어장에 이미 있는 표현은 IN_WORDBOOK 로 바꾼다(순수). */
export function applyWordbook(entries: MemoPlanEntry[], wordbook: ReadonlyMap<string, string>): MemoPlanEntry[] {
  return entries.map((e) => {
    const surface = e.action === 'PROPOSE' ? e.draft.surface : e.action === 'ENRICH' ? e.surface : null
    const wordId = surface ? wordbook.get(surface) : undefined
    return wordId ? { memo: e.memo, segment: e.segment, action: 'SKIP', reason: 'IN_WORDBOOK', wordId } : e
  })
}

/** #62a 계획 — 소유자(404)·상태(DONE 409·열리지 않음 409)·구간 번호(400) 확인 후 단어별 처리 방법. 쓰기 없음. */
export async function planLessonMemo(userId: string, lessonId: string, words: readonly MemoRequestWord[]): Promise<MemoPlan> {
  if (!isLessonId(lessonId)) throw lessonNotFound()
  const row = await prisma.lesson.findFirst({ where: { id: lessonId, userId }, select: { id: true, status: true, topicId: true, level: true, content: true, progress: true } })
  if (!row) throw lessonNotFound()
  const conflict = stateConflict(row)
  if (conflict) throw conflict
  const content = readStoredContent(row.content)
  if (!content) throw new ApiError('CONFLICT', '아직 수업을 열 수 없어요.', { reason: 'NOT_READY', status: row.status })
  const bad = words.find((w) => w.segment > content.segmentCount)
  if (bad) throw new ApiError('VALIDATION', `구간 번호는 1~${content.segmentCount} 입니다.`, { field: 'segments', reason: 'segment_range' })
  const progress = readProgress(row.progress)
  const { entries, surfaces } = planMemoEntries(content, lessonId, { drafts: memoDrafts(progress), processed: memoProcessed(progress) }, words)
  return { lessonId, topicId: row.topicId, level: row.level, entries: applyWordbook(entries, await wordbookMatches(userId, surfaces)) }
}

/** A10 보강 결과 → 제안 초안(일본어가 아니라면 null → NOT_JAPANESE). 예문은 대화 줄이 있으면 그것, 없으면 보강 예문. */
export function memoDraftFromEnrich(e: Extract<MemoPlanEntry, { action: 'ENRICH' }>, lessonId: string, d: WordDraft): MemoWordDraft | null {
  if (!d.valid || !d.meaning) return null
  return {
    surface: e.surface,
    reading: d.reading,
    meaning: d.meaning,
    lessonId,
    segment: e.segment,
    lineIdx: e.lineIdx,
    via: 'ENRICH',
    memo: e.memo,
    partOfSpeech: d.partOfSpeech,
    jlpt: d.jlpt,
    example: e.example ?? d.example,
    exampleKo: e.example ? e.exampleKo : d.exampleKo,
  }
}

/**
 * 메모 결과 저장 — 라우트 트랜잭션 안에서, `lockLessonForWrite` 로 잡은 레슨에. 보낸 단어를 초안(`listen.memo`)에 합치고(한도 안에서),
 * 처리 결과(`listen.proposed`)를 덧붙인다(같은 단어는 처음 결과 유지).
 */
export async function saveLessonMemo(tx: Tx, h: LessonWriteHandle, add: { drafts: MemoDraft[]; processed: MemoProcessed[] }): Promise<{ memoCount: number }> {
  const drafts = memoDrafts(h.progress)
  const have = new Set(drafts.map((d) => d.ja))
  for (const d of add.drafts) {
    if (have.has(d.ja) || drafts.length >= MEMO_PER_LESSON_MAX) continue
    if (drafts.filter((x) => x.segment === d.segment).length >= MEMO_PER_SEGMENT_MAX) continue
    drafts.push(d)
    have.add(d.ja)
  }
  const processed = memoProcessed(h.progress)
  const done = new Set(processed.map((p) => p.ja))
  for (const p of add.processed) {
    if (done.has(p.ja)) continue
    processed.push(p)
    done.add(p.ja)
  }
  const listen = { ...(h.progress.listen ?? {}), memo: drafts, proposed: processed }
  await writeProgress(tx, h, { ...h.progress, listen })
  return { memoCount: drafts.length }
}
