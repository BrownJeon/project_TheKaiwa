import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, escapeLike } from '@/modules/infra'
import { createRng, generateWordSet, newSeed, recencyFactor, requestedModeOf, sampleWeighted, shuffle, weightOf, type SetCandidate } from '../vocab/setGenerator'
import { distinctMeaningCount, pickChoices, type MeaningSource } from '../vocab/distractors'
import { durationSecOf, parseAttemptBody, parseCreateSessionBody, parseKeepBody, parseSessionListQuery, toCardDto } from '../vocab/sessions'
import { parseWordInput, parseWordListQuery, parseWordPatch, parseEnrichSurface, isBlankMeaning, wordListFilter } from '../vocab/words'
import { asSeedWords } from '../vocab/seedPack'
import wordsN5 from '../../../../prisma/seed-data/words-n5.json'
import { aggregateVocabStats, parseStatsDays, readSnapshot } from '../vocab/stats'
import { cachedDraft, enrichCacheSize, rememberDraft, toDraft } from '../vocab/enrich'

const code = (c: string) => (e: unknown) => e instanceof ApiError && e.code === c
const NOW = new Date('2026-09-27T03:00:00.000Z')
const DAY = 86_400_000

function words(n: number, over: Partial<SetCandidate> = {}): SetCandidate[] {
  return Array.from({ length: n }, (_, i) => ({ id: `w${String(i).padStart(3, '0')}`, correctCount: 0, wrongCount: 0, lastSeenAt: null, ...over }))
}

test('시드 PRNG: 같은 시드 → 같은 수열, 다른 시드 → 다른 수열, 범위 [0,1)', () => {
  const a = createRng('Cabc')
  const b = createRng('Cabc')
  const c = createRng('Cabd')
  const sa = Array.from({ length: 50 }, () => a())
  assert.deepEqual(sa, Array.from({ length: 50 }, () => b()))
  assert.notDeepEqual(sa, Array.from({ length: 50 }, () => c()))
  assert.ok(sa.every((x) => x >= 0 && x < 1))
})

test('세트 생성 재현성: 같은 시드·같은 후보 → 같은 카드·순서(후보 입력 순서와 무관), 비복원', () => {
  const pool = words(40).map((w, i) => ({ ...w, wrongCount: i % 5, correctCount: i % 3, lastSeenAt: i % 4 ? new Date(NOW.getTime() - i * DAY) : null }))
  const seed = newSeed('CHOICE')
  const one = generateWordSet(pool, 10, createRng(seed), NOW).map((w) => w.id)
  const two = generateWordSet(pool.slice().reverse(), 10, createRng(seed), NOW).map((w) => w.id)
  assert.deepEqual(one, two, '같은 시드 → 같은 결과')
  assert.equal(new Set(one).size, 10, '비복원(중복 없음)')
  const other = generateWordSet(pool, 10, createRng(newSeed('CHOICE')), NOW).map((w) => w.id)
  assert.notDeepEqual(one, other, '다른 시드 → 다른 결과(확률적으로)')
  assert.equal(generateWordSet(pool.slice(0, 3), 10, createRng(seed), NOW).length, 3, 'count = min(요청, 풀)')
})

test('가중치 공식(§7-2): clamp(1+2·wrong−0.5·correct, 0.25, 8) × recency', () => {
  assert.equal(recencyFactor(null, NOW), 2.0)
  assert.equal(recencyFactor(new Date(NOW.getTime() - 7 * DAY), NOW), 1.5)
  assert.equal(recencyFactor(new Date(NOW.getTime() - 3 * DAY), NOW), 1.0)
  assert.equal(recencyFactor(new Date(NOW.getTime() - DAY), NOW), 1.0)
  assert.equal(recencyFactor(new Date(NOW.getTime() - DAY + 1000), NOW), 0.3)
  assert.equal(weightOf({ correctCount: 0, wrongCount: 0, lastSeenAt: null }, NOW), 2)
  assert.equal(weightOf({ correctCount: 0, wrongCount: 10, lastSeenAt: null }, NOW), 16, '상한 8 × 미노출 2')
  assert.equal(weightOf({ correctCount: 20, wrongCount: 0, lastSeenAt: new Date(NOW.getTime() - 60_000) }, NOW), 0.25 * 0.3, '하한 0.25 × 24h 0.3')
  assert.equal(weightOf({ correctCount: 2, wrongCount: 1, lastSeenAt: new Date(NOW.getTime() - 3 * DAY) }, NOW), 2)
})

test('가중 샘플링: 무거운 항목이 훨씬 자주 뽑힌다(시드 200개)', () => {
  const items = ['heavy', 'light1', 'light2', 'light3']
  let heavy = 0
  for (let i = 0; i < 200; i++) if (sampleWeighted(items, [16, 0.075, 0.075, 0.075], 1, createRng(`s${i}`))[0] === 'heavy') heavy++
  assert.ok(heavy > 180, `heavy=${heavy}/200`)
  assert.equal(sampleWeighted(items, [1, 1, 1, 1], 0, createRng('x')).length, 0)
})

test('Fisher-Yates: 원본 불변, 같은 원소', () => {
  const src = [1, 2, 3, 4, 5]
  const out = shuffle(src, createRng('z'))
  assert.deepEqual(src, [1, 2, 3, 4, 5])
  assert.deepEqual(out.slice().sort(), src)
})

test('시드 첫 글자 = 요청 모드(downgraded 재계산용)', () => {
  const c = newSeed('CHOICE')
  assert.equal(c.length, 31)
  assert.ok(c.length <= 32, 'VARCHAR(32)')
  assert.equal(requestedModeOf(c), 'CHOICE')
  assert.equal(requestedModeOf(newSeed('FLIP')), 'FLIP')
})

const SRC: MeaningSource[] = [
  { id: 'a', meaning: '영화', partOfSpeech: 'NOUN' },
  { id: 'b', meaning: '음악', partOfSpeech: 'NOUN' },
  { id: 'c', meaning: '사진', partOfSpeech: 'NOUN' },
  { id: 'd', meaning: '여행', partOfSpeech: 'NOUN' },
  { id: 'e', meaning: '먹다', partOfSpeech: 'VERB' },
  { id: 'f', meaning: '마시다', partOfSpeech: 'VERB' },
  { id: 'g', meaning: '영화', partOfSpeech: 'NOUN' },
]

test('보기(E6): 정답 포함 4개·서로 다름·같은 품사 우선·모자라면 다른 품사·후보 부족이면 null', () => {
  const ch = pickChoices({ meaning: '영화', partOfSpeech: 'NOUN' }, SRC, createRng('q1'))!
  assert.equal(ch.length, 4)
  assert.equal(new Set(ch).size, 4)
  assert.ok(ch.includes('영화'))
  assert.deepEqual(ch.filter((x) => x !== '영화').sort(), ['사진', '여행', '음악'].sort(), '같은 품사 3개가 있으면 그것만')
  const verb = pickChoices({ meaning: '먹다', partOfSpeech: 'VERB' }, SRC, createRng('q2'))!
  assert.ok(verb.includes('마시다'), '같은 품사 먼저')
  assert.equal(new Set(verb).size, 4)
  assert.equal(pickChoices({ meaning: '영화', partOfSpeech: 'NOUN' }, SRC.slice(0, 3), createRng('q3')), null)
  assert.equal(distinctMeaningCount(SRC), 6)
  assert.equal(distinctMeaningCount([SRC[0], SRC[6], SRC[1]]), 2, '같은 뜻은 하나로')
})

test('정답 위치 분산(완료 기준 3): 시드 20개에서 정답 자리가 한 곳에 고정되지 않는다', () => {
  const positions = new Set<number>()
  for (let i = 0; i < 20; i++) positions.add(pickChoices({ meaning: '영화', partOfSpeech: 'NOUN' }, SRC, createRng(newSeed('CHOICE')))!.indexOf('영화'))
  assert.ok(positions.size >= 3, `positions=${[...positions]}`)
})

const attemptBase: Parameters<typeof toCardDto>[2] = {
  order: 0, wordId: 'w1', surfaceSnap: '映画', readingSnap: 'えいが', meaningSnap: '영화', choices: ['음악', '영화', '사진', '여행'],
  answer: null, chosenText: null, flagged: false, answeredAt: null, word: { example: '映画を見ました。', exampleKo: '영화를 봤어요.' },
  exampleSnap: null, exampleKoSnap: null,
}

test('정답 미노출(F1·REV-008): CHOICE 미답 카드는 진행 중·ABANDONED 모두 정답·뜻·예문 없음, 답하면·DONE 이면 포함, FLIP 은 뜻·예문 처음부터', () => {
  const hidden = toCardDto('CHOICE', 'IN_PROGRESS', { ...attemptBase })
  assert.deepEqual(Object.keys(hidden).sort(), ['answered', 'choices', 'flagged', 'order', 'reading', 'surface', 'wordId'].sort())
  const json = JSON.stringify(hidden)
  assert.ok(!json.includes('영화를') && !json.includes('映画を'), '예문 없음')
  assert.equal(hidden.answered, false)
  const answered = toCardDto('CHOICE', 'IN_PROGRESS', { ...attemptBase, answer: 'CORRECT', chosenText: '영화', answeredAt: NOW })
  assert.equal(answered.correctText, '영화')
  assert.equal(answered.exampleKo, '영화를 봤어요.')
  const done = toCardDto('CHOICE', 'DONE', { ...attemptBase, answer: 'SKIPPED' })
  assert.equal(done.correctText, '영화')
  assert.equal(done.answer, 'SKIPPED')
  const abandoned = toCardDto('CHOICE', 'ABANDONED', { ...attemptBase })
  assert.deepEqual(Object.keys(abandoned).sort(), Object.keys(hidden).sort(), 'ABANDONED(F2) 미답 카드도 정답·예문 없음(REV-008 H1)')
  assert.equal(abandoned.correctText, undefined)
  assert.equal(abandoned.exampleKo, undefined)
  const abandonedFlip = toCardDto('FLIP', 'ABANDONED', { ...attemptBase, choices: null })
  assert.equal(abandonedFlip.meaning, '영화', 'FLIP 은 F1 대로 뜻 포함')
  assert.equal(abandonedFlip.correctText, undefined)
  const flip = toCardDto('FLIP', 'IN_PROGRESS', { ...attemptBase, choices: null })
  assert.equal(flip.meaning, '영화')
  assert.equal(flip.example, '映画を見ました。')
  assert.equal(flip.choices, undefined)
  assert.equal(flip.correctText, undefined, 'FLIP 미답도 채점 필드는 없음')
  const deleted = toCardDto('FLIP', 'IN_PROGRESS', { ...attemptBase, wordId: null, word: null, choices: null })
  assert.equal(deleted.wordId, null)
  assert.equal(deleted.example, null, '삭제 단어는 Snap 뜻만')
  assert.equal(deleted.meaning, '영화')
})

test('#50 본문: 답 필드 정확히 하나·표시 전용(E2)·responseMs 0~60,000·order 범위', () => {
  assert.deepEqual(parseAttemptBody({ order: 3, flagged: true }), { kind: 'flag', order: 3, flagged: true })
  assert.deepEqual(parseAttemptBody({ order: 3, chosenText: '영화', responseMs: 4200, flagged: false }), { kind: 'choice', order: 3, chosenText: '영화', responseMs: 4200, flagged: false })
  assert.equal(parseAttemptBody({ order: 0, selfResult: 'WRONG', responseMs: 0 }).kind, 'flip')
  assert.equal(parseAttemptBody({ order: 0, skipped: true }).kind, 'skip')
  assert.equal(parseAttemptBody({ order: 1, chosenText: 'x', responseMs: 60_000 }).kind, 'choice')
  for (const bad of [
    { order: 1, chosenText: 'x', responseMs: 60_001 },
    { order: 1, chosenText: 'x', responseMs: -1 },
    { order: 1, chosenText: 'x', responseMs: 1.5 },
    { order: 30, chosenText: 'x' },
    { order: -1, chosenText: 'x' },
    { order: '1', chosenText: 'x' },
    { order: 1 },
    { order: 1, responseMs: 100, flagged: true },
    { order: 1, chosenText: 'x', selfResult: 'CORRECT' },
    { order: 1, skipped: false },
    { order: 1, selfResult: 'MAYBE' },
    { order: 1, chosenText: '' },
    { order: 1, flagged: 'yes' },
    { order: 1, chosenText: 'x', answer: 'CORRECT' },
  ]) assert.throws(() => parseAttemptBody(bad as Record<string, unknown>), code('VALIDATION'), JSON.stringify(bad))
})

test('#47 본문: count 5~30·mode·category ≤40, 생략 시 기본값', () => {
  assert.deepEqual(parseCreateSessionBody({}), { count: undefined, mode: 'FLIP', category: null })
  assert.deepEqual(parseCreateSessionBody({ count: 5, mode: 'FLIP', category: ' 일상 ' }), { count: 5, mode: 'FLIP', category: '일상' })
  assert.equal(parseCreateSessionBody({ count: 30, category: null }).count, 30)
  for (const bad of [{ count: 4 }, { count: 31 }, { count: 10.5 }, { mode: 'QUIZ' }, { category: 'c'.repeat(41) }, { category: 3 }, { seed: 'x' }]) {
    assert.throws(() => parseCreateSessionBody(bad as Record<string, unknown>), code('VALIDATION'), JSON.stringify(bad))
  }
})

test('#48·#52 쿼리/본문', () => {
  const q = parseSessionListQuery(new URLSearchParams('kept=1&status=IN_PROGRESS'), 10)
  assert.deepEqual({ kept: q.kept, status: q.status }, { kept: true, status: 'IN_PROGRESS' })
  assert.throws(() => parseSessionListQuery(new URLSearchParams('status=OPEN'), 10), code('VALIDATION'))
  assert.throws(() => parseSessionListQuery(new URLSearchParams('kept=yes'), 10), code('VALIDATION'))
  assert.equal(parseKeepBody({ kept: false }), false)
  assert.throws(() => parseKeepBody({ kept: 'true' }), code('VALIDATION'))
})

test('걸린 시간: 초 단위 반올림, 음수 0, 1시간 상한', () => {
  const s = new Date('2026-09-27T00:00:00Z')
  assert.equal(durationSecOf(s, new Date(s.getTime() + 156_400)), 156)
  assert.equal(durationSecOf(s, new Date(s.getTime() - 5_000)), 0)
  assert.equal(durationSecOf(s, new Date(s.getTime() + 3 * DAY)), 3600)
})

test('#40 쿼리: q ≤40·category ≤40·archived 0|1·sort 3종', () => {
  const q = parseWordListQuery(new URLSearchParams('q=%20映画%20&archived=1&sort=wrong'), 30)
  assert.deepEqual({ q: q.q, archived: q.archived, sort: q.sort, limit: q.limit }, { q: '映画', archived: true, sort: 'wrong', limit: 30 })
  assert.equal(parseWordListQuery(new URLSearchParams(''), 20).sort, 'recent')
  assert.equal(parseWordListQuery(new URLSearchParams('q=%20%20'), 20).q, null, '공백만 = 검색 없음')
  assert.equal(parseWordListQuery(new URLSearchParams(`q=${'😀'.repeat(40)}`), 20).q?.length, 80, '코드포인트 40 통과')
  for (const bad of [`q=${'あ'.repeat(41)}`, `category=${'c'.repeat(41)}`, 'archived=2', 'sort=random']) {
    assert.throws(() => parseWordListQuery(new URLSearchParams(bad), 20), code('VALIDATION'), bad)
  }
})

test('#40 조각 조건(task-023 → task-068 T11): 5유형 하나만(EXPRESSION 통과), none 은 폐지 400, 빈 값은 조건 없음, 그 밖(소문자·쉼표 목록·None)은 400', () => {
  for (const k of ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] as const) {
    assert.equal(parseWordListQuery(new URLSearchParams(`chunkType=${k}`), 20).chunkType, k)
  }
  assert.equal(parseWordListQuery(new URLSearchParams(''), 20).chunkType, null)
  assert.equal(parseWordListQuery(new URLSearchParams('chunkType='), 20).chunkType, null, '빈 값 = 조건 없음')
  for (const bad of ['none', 'name', 'NAME,ACTION', 'None', 'NULL', ' NAME', 'chunk', 'OTHER']) {
    assert.throws(
      () => parseWordListQuery(new URLSearchParams({ chunkType: bad }), 20),
      (e: unknown) => code('VALIDATION')(e) && (e as ApiError).details?.field === 'chunkType',
      bad,
    )
  }
})

test('#40 where(task-068): 보이는 범위(출처)·나의 보관 여부·분류·조각·검색을 AND 로', () => {
  const base = { q: null, category: null, chunkType: null, archived: false, source: 'all' } as const
  const visible = { OR: [{ userId: 'u1' }, { userId: null, source: 'SEED' }] }
  const notArchived = { states: { none: { userId: 'u1', archived: true } } }
  assert.deepEqual(wordListFilter('u1', base), { AND: [visible, notArchived] })
  assert.deepEqual(wordListFilter('u1', { ...base, chunkType: 'EXPRESSION', category: '일상', archived: true, source: 'mine' }), {
    AND: [{ userId: 'u1' }, { states: { some: { userId: 'u1', archived: true } } }, { category: '일상' }, { chunkType: 'EXPRESSION' }],
  })
  assert.deepEqual(wordListFilter('u1', { ...base, source: 'base' }).AND, [{ userId: null, source: 'SEED' }, notArchived])
  const all = wordListFilter('u1', { ...base, q: '50%' })
  assert.deepEqual((all.AND as object[])[2], { OR: [{ surface: { contains: '50\\%' } }, { reading: { contains: '50\\%' } }, { meaning: { contains: '50\\%' } }] })
})

test('LIKE 이스케이프: % _ \\ 는 글자 그대로', () => {
  assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\')
  assert.equal(escapeLike('映画'), '映画')
})

test('#43 본문: 카운터·출처·보관 상태 400(read_only), 모르는 키 400, null 로 비우기', () => {
  assert.deepEqual(parseWordPatch({ note: null, category: ' 음식 ', partOfSpeech: null }), { note: null, category: '음식', partOfSpeech: 'OTHER' })
  assert.deepEqual(parseWordPatch({}), {})
  for (const k of ['correctCount', 'wrongCount', 'source', 'sourceRefId', 'archived', 'lastResult']) {
    try {
      parseWordPatch({ [k]: 1 })
      assert.fail(`${k} 는 막혀야 한다`)
    } catch (e) {
      assert.equal((e as ApiError).code, 'VALIDATION')
      assert.equal((e as ApiError).details?.reason, 'read_only')
    }
  }
  assert.throws(() => parseWordPatch({ color: 'red' }), code('VALIDATION'))
  assert.throws(() => parseWordPatch({ surface: '' }), code('VALIDATION'))
  assert.throws(() => parseWordPatch({ meaning: null }), code('VALIDATION'))
})

test('#41 보강 경로 판정·표현 검증', () => {
  assert.equal(isBlankMeaning(undefined), true)
  assert.equal(isBlankMeaning('  '), true)
  assert.equal(isBlankMeaning('영화'), false)
  assert.equal(parseEnrichSurface({ surface: ' 映画 ' }), '映画')
  assert.throws(() => parseEnrichSurface({ surface: '' }), code('VALIDATION'))
  assert.throws(() => parseEnrichSurface({ surface: 'あ'.repeat(81) }), code('VALIDATION'))
  assert.throws(() => parseEnrichSurface({ surface: 'a', saved: true }), code('VALIDATION'))
})

test('기본 단어(E1): 옛 OWNER 시드 원본 words-n5.json 50개·표현 중복 없음·전부 채택 경로(#35·#38) 한도 통과', () => {
  const pack = asSeedWords(wordsN5)
  assert.equal(pack.length, 50)
  assert.equal(new Set(pack.map((w) => w.surface)).size, 50)
  for (const w of pack) parseWordInput({ surface: w.surface, meaning: w.meaning, reading: w.reading, partOfSpeech: w.partOfSpeech, chunkType: w.chunkType, example: w.example, exampleKo: w.exampleKo, jlpt: 'N5', category: 'N5 기초' })
})

test('#54 집계: VOCAB_SESSION 스냅샷만으로 byCount·daily·streak(오늘 없으면 어제부터), 기간 밖 제외', () => {
  const today = '2026-09-27'
  const rows = [
    { date: '2026-09-27', cardCount: 10, correct: 7, wrong: 2, skipped: 1 },
    { date: '2026-09-26', cardCount: 10, correct: 5, wrong: 5, skipped: 0 },
    { date: '2026-09-26', cardCount: 5, correct: 5, wrong: 0, skipped: 0 },
    { date: '2026-09-25', cardCount: 5, correct: 1, wrong: 4, skipped: 0 },
    { date: '2026-08-01', cardCount: 20, correct: 20, wrong: 0, skipped: 0 },
  ]
  const s = aggregateVocabStats(rows, today, 30)
  assert.deepEqual(s.byCount, [
    { cardCount: 5, sessions: 2, correct: 6, wrong: 4, skipped: 0 },
    { cardCount: 10, sessions: 2, correct: 12, wrong: 7, skipped: 1 },
  ])
  assert.deepEqual(s.daily.map((d) => d.date), ['2026-09-25', '2026-09-26', '2026-09-27'])
  assert.equal(s.streakDays, 3)
  assert.equal(aggregateVocabStats(rows.slice(1), today, 30).streakDays, 2, '오늘 아직 안 풀었으면 어제부터')
  assert.equal(aggregateVocabStats(rows.slice(3), today, 30).streakDays, 0, '어제 끊김')
  assert.equal(aggregateVocabStats(rows, today, 1).daily.length, 1)
  assert.deepEqual(readSnapshot({ cardCount: 'x', correct: 3 }, new Date('2026-09-26T16:00:00Z')), { date: '2026-09-27', cardCount: 0, correct: 3, wrong: 0, skipped: 0 }, '형태 이상 → 0, 날짜 없으면 생성 시각 KST')
  assert.equal(parseStatsDays(null), 30)
  assert.throws(() => parseStatsDays('0'), code('VALIDATION'))
  assert.throws(() => parseStatsDays('366'), code('VALIDATION'))
})

test('A10 draft(E8·F8): valid=false 면 사전 필드 비움, 캐시 키 = (표현, 수준)·상한·만료', () => {
  const inval = toDraft('안녕', { valid: false, invalidReason: '한국어예요', reading: 'x', meaning: 'y', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5', example: 'e', exampleKo: 'k' })
  assert.deepEqual(inval, { surface: '안녕', valid: false, invalidReason: '한국어예요', reading: null, meaning: null, partOfSpeech: null, chunkType: null, jlpt: null, example: null, exampleKo: null })
  const d = toDraft('映画', { valid: true, invalidReason: null, reading: 'えいが', meaning: '영화', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5', example: '映画を見る。', exampleKo: '영화를 본다.' })
  rememberDraft('映画', 'N5', d, 1_000)
  assert.deepEqual(cachedDraft('映画', 'N5', 2_000), d)
  assert.equal(cachedDraft('映画', 'N4', 2_000), null, '수준이 다르면 다른 키')
  assert.equal(cachedDraft('映画', 'N5', 1_000 + 25 * 60 * 60 * 1000), null, '24시간 만료')
  for (let i = 0; i < 600; i++) rememberDraft(`w${i}`, null, d, 5_000)
  assert.ok(enrichCacheSize() <= 500, `size=${enrichCacheSize()}`)
  assert.equal(cachedDraft('w0', null, 6_000), null, '오래된 것부터 버림')
  assert.notEqual(cachedDraft('w599', null, 6_000), null)
})

/** 가짜 tx — 호출 순서를 기록한다(잠금이 대상 쓰기·읽기보다 먼저인지). */
function fakeTx(log: string[], rows: { word?: unknown; session?: unknown; attempts?: unknown[] }) {
  return {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      log.push(sql.includes('`User`') ? 'lock:user' : sql.includes('VocabSession') ? 'lock:session' : `raw:${sql}`)
      return [{ id: 'x' }]
    },
    wordEntry: {
      updateMany: async () => (log.push('word:update'), { count: 1 }),
      findFirst: async () => (log.push('word:read'), rows.word ?? null),
    },
    vocabSession: { findUniqueOrThrow: async () => (log.push('session:read'), rows.session) },
    vocabAttempt: { findMany: async () => (log.push('attempts:read'), rows.attempts ?? []) },
  } as never
}

test('Codex C2-1: 보관 토글은 사용자 행을 먼저 잠근 뒤 단어를 읽고 나의 상태만 쓴다(task-068 — UserWordState)', async () => {
  const { setWordArchivedTx } = await import('../vocab/words')
  const { createWordFakeDb, word } = await import('./wordFakeDb')
  const fake = createWordFakeDb({ words: [word({ id: 'w1', userId: 'u1' })] })
  const dto = await setWordArchivedTx(fake.db, 'u1', 'w1', true)
  assert.deepEqual(fake.log, ['lock:user', 'word:findFirst', 'state:findUnique', 'state:upsert'])
  assert.equal(dto.archived, true)
  assert.ok(dto.archivedAt)
  await assert.rejects(setWordArchivedTx(createWordFakeDb({ words: [word({ id: 'w1', userId: 'u2' })] }).db, 'u1', 'w1', true), code('NOT_FOUND'), '없거나 남의 단어 404')
})

test('Codex C2-2: #49 조회는 세트 행을 잠근 뒤 카드를 읽는다(한 스냅샷), 미답 CHOICE 정답 없음', async () => {
  const { readVocabSessionTx } = await import('../vocab/sessions')
  const log: string[] = []
  const session = { id: 'vs1', date: new Date('2026-09-27T00:00:00Z'), mode: 'CHOICE', requestedCount: 5, cardCount: 1, correctCount: 0, wrongCount: 0, skippedCount: 0, status: 'IN_PROGRESS', keptAt: null, replayOfId: null, seed: 'Cabc', startedAt: NOW, finishedAt: null, durationSec: null }
  const out = await readVocabSessionTx(fakeTx(log, { session, attempts: [{ id: 'a1', ...attemptBase }] }), 'u1', 'vs1')
  assert.deepEqual(log, ['lock:session', 'session:read', 'attempts:read'])
  assert.equal(out.session.status, 'IN_PROGRESS')
  assert.equal(out.cards[0].correctText, undefined)
})
