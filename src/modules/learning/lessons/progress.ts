/**
 * `Lesson.progress` 형태와 병합 규칙(api-contract #61·#62a·#62b) — 순수 함수만.
 *
 *   progress = {
 *     listen?:      { segmentsDone?: int[], played?: { slow?: int[], normal?: int[] },     ← 클라이언트(#61)
 *                     memo?: [{segment, ja}],                                             ← 클라이언트 초안(#61) + 메모 제안 요청(#62a)이 합침
 *                     proposed?: [{ja, segment, result, proposalId, wordId}] },           ← 서버 전용(#62a 결과)
 *     quiz?:        { answers: (0~3|null)[] },                                            ← 클라이언트, **첫 답 고정**(L4 재채점 근거)
 *     application?: { answers: (string ≤200|null)[] },                                    ← 클라이언트
 *     speaking?:    [{itemId, text, matchedIds, missedIds, utteranceId, at}],             ← 서버 전용(#62b 결과)
 *   }
 *
 * #61 은 클라이언트 칸만 받는다(서버 칸을 보내면 400). 보낸 절만 바뀌고 나머지는 그대로 — 서버 칸은 늘 보존된다.
 * 병합: segmentsDone·played 는 합집합(되돌리지 않음), memo 는 통째 교체, quiz.answers 는 이미 답한 칸을 바꾸지 않음,
 * application.answers 는 보낸 칸(null 이 아닌 값)만 교체.
 */
import { ApiError, codePointLength, sanitizeText } from '@/modules/infra'

export const PROGRESS_PATCH_MAX_BYTES = 8 * 1024
export const MEMO_PER_SEGMENT_MAX = 5
export const MEMO_PER_LESSON_MAX = 15
export const MEMO_WORD_MAX = 20
export const APPLICATION_ANSWER_MAX = 200
export const SPEAKING_TEXT_STORE_MAX = 200

export interface MemoDraft {
  segment: number
  ja: string
}

export type MemoResult = 'PROPOSED' | 'IN_WORDBOOK'

export interface MemoProcessed {
  ja: string
  segment: number
  result: MemoResult
  proposalId: string | null
  wordId: string | null
}

export interface SpeakingEntry {
  itemId: string
  text: string
  matchedIds: string[]
  missedIds: string[]
  utteranceId: string | null
  at: string
}

export interface LessonProgress {
  listen?: { segmentsDone?: number[]; played?: { slow?: number[]; normal?: number[] }; memo?: MemoDraft[]; proposed?: MemoProcessed[] }
  quiz?: { answers: (number | null)[] }
  application?: { answers: (string | null)[] }
  speaking?: SpeakingEntry[]
  [k: string]: unknown
}

export interface ProgressPatch {
  listen?: { segmentsDone?: number[]; played?: { slow?: number[]; normal?: number[] }; memo?: MemoDraft[] }
  quiz?: { answers: (number | null)[] }
  application?: { answers: (string | null)[] }
}

export interface ProgressLimits {
  segmentCount: number
  quizCount: number
  applicationCount: number
}

function bad(field: string, message: string, reason = 'invalid'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function onlyKeys(o: Record<string, unknown>, keys: readonly string[], where: string): void {
  const extra = Object.keys(o).filter((k) => !keys.includes(k))
  if (extra.length) bad(`${where}${extra[0]}`, `넣을 수 없는 항목입니다: ${extra.join(', ')}`, 'unknown_key')
}

function segmentList(v: unknown, field: string, segmentCount: number): number[] {
  if (!Array.isArray(v) || v.length > segmentCount) bad(field, '구간 목록 형식이 올바르지 않습니다.')
  const out = new Set<number>()
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 1 || x > segmentCount) bad(field, `구간 번호는 1~${segmentCount} 입니다.`)
    out.add(x)
  }
  return [...out].sort((a, b) => a - b)
}

/** 메모 단어 1개 — 1~20자, 가나·한자 포함. 앞뒤 공백 제거·NFKC. 형식이 틀리면 null. */
export function cleanMemoWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const w = sanitizeText(raw).normalize('NFKC').trim()
  if (!w || codePointLength(w) > MEMO_WORD_MAX) return null
  if (!/[぀-ヿ㐀-鿿]/.test(w)) return null
  return w
}

/** 메모 초안 제한 — 구간당 5개·레슨 15개·같은 구간 중복 없음. */
export function checkMemoDrafts(list: readonly MemoDraft[], field = 'progress.listen.memo'): void {
  if (list.length > MEMO_PER_LESSON_MAX) bad(field, `메모는 수업 전체에서 ${MEMO_PER_LESSON_MAX}개까지예요.`, 'LIMIT')
  const per = new Map<number, Set<string>>()
  for (const m of list) {
    const s = per.get(m.segment) ?? new Set<string>()
    if (s.has(m.ja)) bad(field, '같은 구간에 같은 단어가 두 번 있어요.', 'DUPLICATE')
    s.add(m.ja)
    if (s.size > MEMO_PER_SEGMENT_MAX) bad(field, `메모는 구간마다 ${MEMO_PER_SEGMENT_MAX}개까지예요.`, 'LIMIT')
    per.set(m.segment, s)
  }
}

/** #61 `progress` 검증 — 클라이언트 칸만, 직렬화 8KB 이하. */
export function parseProgressPatch(raw: unknown, lim: ProgressLimits): ProgressPatch {
  if (!isObj(raw)) bad('progress', 'progress 는 객체여야 합니다.')
  if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > PROGRESS_PATCH_MAX_BYTES) bad('progress', '진행 기록이 너무 커요(8KB).', 'TOO_LARGE')
  onlyKeys(raw, ['listen', 'quiz', 'application'], 'progress.')
  const out: ProgressPatch = {}
  if (raw.listen !== undefined) {
    if (!isObj(raw.listen)) bad('progress.listen', 'listen 형식이 올바르지 않습니다.')
    onlyKeys(raw.listen, ['segmentsDone', 'played', 'memo'], 'progress.listen.')
    const l: NonNullable<ProgressPatch['listen']> = {}
    if (raw.listen.segmentsDone !== undefined) l.segmentsDone = segmentList(raw.listen.segmentsDone, 'progress.listen.segmentsDone', lim.segmentCount)
    if (raw.listen.played !== undefined) {
      const p = raw.listen.played
      if (!isObj(p)) bad('progress.listen.played', 'played 형식이 올바르지 않습니다.')
      onlyKeys(p, ['slow', 'normal'], 'progress.listen.played.')
      l.played = {
        ...(p.slow !== undefined ? { slow: segmentList(p.slow, 'progress.listen.played.slow', lim.segmentCount) } : {}),
        ...(p.normal !== undefined ? { normal: segmentList(p.normal, 'progress.listen.played.normal', lim.segmentCount) } : {}),
      }
    }
    if (raw.listen.memo !== undefined) {
      const m = raw.listen.memo
      if (!Array.isArray(m)) bad('progress.listen.memo', 'memo 는 배열이어야 합니다.')
      const drafts = m.map((x, i) => {
        if (!isObj(x)) bad(`progress.listen.memo[${i}]`, '메모 형식이 올바르지 않습니다.')
        onlyKeys(x, ['segment', 'ja'], `progress.listen.memo[${i}].`)
        if (typeof x.segment !== 'number' || !Number.isInteger(x.segment) || x.segment < 1 || x.segment > lim.segmentCount) bad(`progress.listen.memo[${i}].segment`, `구간 번호는 1~${lim.segmentCount} 입니다.`)
        const ja = cleanMemoWord(x.ja)
        if (!ja) bad(`progress.listen.memo[${i}].ja`, `일본어로 ${MEMO_WORD_MAX}자 이내로 적어 주세요.`, 'NOT_JAPANESE')
        return { segment: x.segment as number, ja }
      })
      checkMemoDrafts(drafts)
      l.memo = drafts
    }
    out.listen = l
  }
  if (raw.quiz !== undefined) {
    if (!isObj(raw.quiz)) bad('progress.quiz', 'quiz 형식이 올바르지 않습니다.')
    onlyKeys(raw.quiz, ['answers'], 'progress.quiz.')
    const a = raw.quiz.answers
    if (!Array.isArray(a) || a.length > lim.quizCount) bad('progress.quiz.answers', `answers 는 ${lim.quizCount}칸 이하 배열입니다.`)
    out.quiz = {
      answers: a.map((x, i) => {
        if (x === null) return null
        if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > 3) bad(`progress.quiz.answers[${i}]`, '답은 0~3 또는 null 입니다.')
        return x as number
      }),
    }
  }
  if (raw.application !== undefined) {
    if (!isObj(raw.application)) bad('progress.application', 'application 형식이 올바르지 않습니다.')
    onlyKeys(raw.application, ['answers'], 'progress.application.')
    const a = raw.application.answers
    if (!Array.isArray(a) || a.length > lim.applicationCount) bad('progress.application.answers', `answers 는 ${lim.applicationCount}칸 이하 배열입니다.`)
    out.application = {
      answers: a.map((x, i) => {
        if (x === null) return null
        if (typeof x !== 'string') bad(`progress.application.answers[${i}]`, '답은 문자열 또는 null 입니다.')
        const v = sanitizeText(x as string, { multiline: true })
        if (codePointLength(v) > APPLICATION_ANSWER_MAX) bad(`progress.application.answers[${i}]`, `답은 ${APPLICATION_ANSWER_MAX}자 이내입니다.`)
        return v || null
      }),
    }
  }
  return out
}

/** 저장된 JSON → 진행 객체(형태가 어긋난 칸은 버린다). */
export function readProgress(raw: unknown): LessonProgress {
  return isObj(raw) ? (raw as LessonProgress) : {}
}

const union = (a: readonly number[] | undefined, b: readonly number[] | undefined) => [...new Set([...(a ?? []), ...(b ?? [])])].sort((x, y) => x - y)

export function mergeProgress(current: LessonProgress, patch: ProgressPatch): LessonProgress {
  const next: LessonProgress = { ...current }
  if (patch.listen) {
    const cur = current.listen ?? {}
    const l = { ...cur }
    if (patch.listen.segmentsDone) l.segmentsDone = union(cur.segmentsDone, patch.listen.segmentsDone)
    if (patch.listen.played) {
      l.played = {
        slow: union(cur.played?.slow, patch.listen.played.slow),
        normal: union(cur.played?.normal, patch.listen.played.normal),
      }
    }
    if (patch.listen.memo) l.memo = patch.listen.memo
    next.listen = l
  }
  if (patch.quiz) {
    const prev = current.quiz?.answers ?? []
    const len = Math.max(prev.length, patch.quiz.answers.length)
    next.quiz = {
      answers: Array.from({ length: len }, (_, i) => {
        const p = prev[i]
        if (typeof p === 'number') return p
        const n = patch.quiz!.answers[i]
        return typeof n === 'number' ? n : null
      }),
    }
  }
  if (patch.application) {
    const prev = current.application?.answers ?? []
    const len = Math.max(prev.length, patch.application.answers.length)
    next.application = {
      answers: Array.from({ length: len }, (_, i) => {
        const n = patch.application!.answers[i]
        if (typeof n === 'string') return n
        const p = prev[i]
        return typeof p === 'string' ? p : null
      }),
    }
  }
  return next
}

export function speakingRecords(p: LessonProgress): SpeakingEntry[] {
  return Array.isArray(p.speaking) ? p.speaking.filter((s): s is SpeakingEntry => isObj(s) && typeof s.itemId === 'string' && Array.isArray(s.matchedIds)) : []
}

/** 말하기 결과 1건 넣기 — 같은 과제는 마지막 시도로 교체. */
export function withSpeaking(p: LessonProgress, entry: SpeakingEntry): LessonProgress {
  const rest = speakingRecords(p).filter((s) => s.itemId !== entry.itemId)
  return { ...p, speaking: [...rest, entry] }
}

export function memoDrafts(p: LessonProgress): MemoDraft[] {
  const m = p.listen?.memo
  return Array.isArray(m) ? m.filter((x): x is MemoDraft => isObj(x) && typeof x.ja === 'string' && typeof x.segment === 'number') : []
}

export function memoProcessed(p: LessonProgress): MemoProcessed[] {
  const m = p.listen?.proposed
  return Array.isArray(m) ? m.filter((x): x is MemoProcessed => isObj(x) && typeof x.ja === 'string' && typeof x.segment === 'number') : []
}
