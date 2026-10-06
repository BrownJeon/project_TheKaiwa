/**
 * task-012b-2 서버 — #21c 내 발화 목록(질의 검사·소유자 범위·필터·키셋 커서·응답 모양·엔진 정보 0)과 #66 `items[].voiced`(D-2) 판정.
 * DB 호출은 `listDb`·`voicedDb` 를 바꿔 끼워 재현한다(Prisma 위임 객체는 mock 으로 못 바꾼다). 방 소유(남의 방 404)는 라우트가 conversation 으로 먼저
 * 확인하므로 라우트 소스의 호출 순서를 정적으로 본다 — 라이브 IDOR 는 `tests/live/task012b2-smoke.ts`.
 */
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Prisma } from '@prisma/client'
import { ApiError, encodeCursor } from '@/modules/infra'
import {
  contextOfRow,
  listDb,
  listUtterances,
  listWhere,
  parseUtteranceListQuery,
  REVIEWABLE_WHERE,
  toUtteranceListItem,
  UTTERANCE_LIST_LIMIT_MAX,
  type ListRow,
} from '../utterances/list'
import { voicedDb, voicedEvaluationItems } from '../utterances/evaluation'

const USER = 'cuser0000000000000000001'
const NOW = new Date('2026-10-06T12:00:00.000Z')

const origList = { ...listDb }
const origVoiced = { ...voicedDb }
afterEach(() => {
  Object.assign(listDb, origList)
  Object.assign(voicedDb, origVoiced)
})

function row(over: Partial<ListRow> = {}): ListRow {
  return {
    id: 'utt1',
    createdAt: new Date('2026-10-06T11:00:00.000Z'),
    durationMs: 2400,
    status: 'ANALYZED',
    realtimeText: '駅はどこですか',
    analysisText: '駅はどこでしょうか',
    transcriptConfidence: 0.8,
    requiresReview: true,
    finalText: null,
    finalSource: 'REALTIME',
    chatId: 'chat1',
    chatMessageId: 'msg1',
    lessonId: null,
    evaluationItemId: null,
    audioPath: 'users/u/utterances/2026-10/utt1.wav',
    audioExpiresAt: new Date('2026-11-05T11:00:00.000Z'),
    audioDeletedAt: null,
    analysis: { engineVersions: { reviewThreshold: 0.85, flags: [], analysis: 'engine-x' } },
    ...over,
  }
}

const sp = (q: string) => new URLSearchParams(q)
function validationOf(fn: () => unknown): Record<string, unknown> | undefined {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof ApiError, 'ApiError 여야 한다')
    assert.equal(e.code, 'VALIDATION')
    return e.details
  }
  assert.fail('VALIDATION 이 나야 한다')
}

/* ── 질의 검사 ─────────────────────────────────────────────── */

test('질의: 기본값 — chatId 없음·reviewable false·커서 없음·limit 20', () => {
  assert.deepEqual(parseUtteranceListQuery(sp('')), { chatId: null, reviewable: false, cursor: null, limit: 20 })
})

test('질의: chatId·reviewable=1·limit·커서를 그대로 읽는다', () => {
  const cursor = encodeCursor({ t: '2026-10-06T10:00:00.000Z', id: 'utt9' })
  const q = parseUtteranceListQuery(sp(`chatId=chat_A-1&reviewable=1&limit=50&cursor=${cursor}`))
  assert.deepEqual(q, { chatId: 'chat_A-1', reviewable: true, cursor: { t: '2026-10-06T10:00:00.000Z', id: 'utt9' }, limit: 50 })
  assert.equal(parseUtteranceListQuery(sp('reviewable=0')).reviewable, false)
})

test('질의: 모르는 키·잘못된 chatId·reviewable 값·limit 범위·깨진 커서는 400 VALIDATION', () => {
  assert.equal(validationOf(() => parseUtteranceListQuery(sp('userId=someone')))?.field, 'userId')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp('chatId=../etc')))?.field, 'chatId')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp(`chatId=${'a'.repeat(41)}`)))?.field, 'chatId')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp('reviewable=true')))?.field, 'reviewable')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp(`limit=${UTTERANCE_LIST_LIMIT_MAX + 1}`)))?.field, 'limit')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp('limit=0')))?.field, 'limit')
  assert.equal(validationOf(() => parseUtteranceListQuery(sp('cursor=not-a-cursor')))?.field, 'cursor')
})

/* ── 소유자 범위·필터 ─────────────────────────────────────── */

test('where: 늘 userId 로 묶고, chatId·reviewable 은 있을 때만 더한다', () => {
  assert.deepEqual(listWhere(USER, { chatId: null, reviewable: false }), { userId: USER })
  assert.deepEqual(listWhere(USER, { chatId: 'chat1', reviewable: false }), { userId: USER, chatId: 'chat1' })
  assert.deepEqual(listWhere(USER, { chatId: 'chat1', reviewable: true }), { userId: USER, chatId: 'chat1', ...REVIEWABLE_WHERE })
})

test('확인할 수 있는 발화 조건 = ANALYZED·requiresReview·finalSource REALTIME·처음 들린 글 있음(USER 확정은 빠진다)', () => {
  assert.deepEqual(REVIEWABLE_WHERE, { status: 'ANALYZED', requiresReview: true, finalSource: 'REALTIME', NOT: { realtimeText: '' } })
})

test('listUtterances: 첫 쪽은 limit+1 로 읽어 다음 커서를 만들고, 개수는 같은 방 범위의 reviewable 조건으로 센다', async () => {
  const seen: { page?: Prisma.UtteranceWhereInput; take?: number; count?: Prisma.UtteranceWhereInput } = {}
  const rows = [row({ id: 'u3', createdAt: new Date('2026-10-06T11:03:00Z') }), row({ id: 'u2', createdAt: new Date('2026-10-06T11:02:00Z') }), row({ id: 'u1', createdAt: new Date('2026-10-06T11:01:00Z') })]
  listDb.page = async (where, take) => {
    seen.page = where
    seen.take = take
    return rows
  }
  listDb.countReviewable = async (where) => {
    seen.count = where
    return 7
  }
  const out = await listUtterances(USER, { chatId: 'chat1', reviewable: false, cursor: null, limit: 2 }, NOW)
  assert.equal(seen.take, 3)
  assert.deepEqual(seen.page, { userId: USER, chatId: 'chat1' })
  assert.deepEqual(seen.count, { userId: USER, chatId: 'chat1', ...REVIEWABLE_WHERE })
  assert.deepEqual(out.items.map((i) => i.id), ['u3', 'u2'])
  assert.equal(out.reviewableCount, 7)
  assert.ok(out.nextCursor)
  assert.deepEqual(parseUtteranceListQuery(sp(`cursor=${out.nextCursor}`)).cursor, { t: '2026-10-06T11:02:00.000Z', id: 'u2' })
})

test('listUtterances: 마지막 쪽이면 nextCursor null, 커서가 있으면 (createdAt, id) 보다 앞선 행만 — userId 조건은 그대로', async () => {
  let where: Prisma.UtteranceWhereInput | undefined
  listDb.page = async (w) => {
    where = w
    return [row({ id: 'u1' })]
  }
  listDb.countReviewable = async () => 0
  const out = await listUtterances(USER, { chatId: null, reviewable: true, cursor: { t: '2026-10-06T11:02:00.000Z', id: 'u2' }, limit: 20 }, NOW)
  assert.equal(out.nextCursor, null)
  const t = new Date('2026-10-06T11:02:00.000Z')
  assert.deepEqual(where, {
    AND: [{ userId: USER, ...REVIEWABLE_WHERE }, { OR: [{ createdAt: { lt: t } }, { createdAt: t, id: { lt: 'u2' } }] }],
  })
})

/* ── 응답 모양 ─────────────────────────────────────────────── */

test('응답: 엔진 이름·신뢰도·임계·원음 경로를 싣지 않는다(키·값 모두)', () => {
  const item = toUtteranceListItem(row(), NOW)
  assert.deepEqual(Object.keys(item).sort(), [
    'analysisText',
    'audioAvailable',
    'chatMessageId',
    'context',
    'createdAt',
    'durationMs',
    'finalSource',
    'finalText',
    'id',
    'realtimeText',
    'requiresReview',
    'status',
    'wasReviewTarget',
  ])
  const json = JSON.stringify(item)
  for (const banned of ['engine', 'Engine', 'confidence', 'Confidence', 'reviewThreshold', 'audioPath', '.wav', 'users/']) assert.ok(!json.includes(banned), banned)
})

test('응답: 분석 전·실패 발화는 analysisText 를 null 로, wasReviewTarget 은 판정 스냅샷으로(확정 뒤에도 true)', () => {
  assert.equal(toUtteranceListItem(row({ status: 'QUEUED', analysisText: '途中' }), NOW).analysisText, null)
  assert.equal(toUtteranceListItem(row({ status: 'QUEUED' }), NOW).wasReviewTarget, false)
  assert.equal(toUtteranceListItem(row({ requiresReview: false, finalSource: 'ANALYSIS', finalText: '駅はどこでしょうか' }), NOW).wasReviewTarget, true)
  assert.equal(toUtteranceListItem(row({ transcriptConfidence: 0.95, requiresReview: false }), NOW).wasReviewTarget, false)
  assert.equal(toUtteranceListItem(row({ transcriptConfidence: 0.95, analysis: { engineVersions: { reviewThreshold: 0.85, flags: ['LENGTH_RATIO'] } } }), NOW).wasReviewTarget, true)
  assert.equal(toUtteranceListItem(row({ analysis: null }), NOW).wasReviewTarget, false)
})

test('응답: audioAvailable = 파일 있음·지워지지 않음·보관 기한 전', () => {
  assert.equal(toUtteranceListItem(row(), NOW).audioAvailable, true)
  assert.equal(toUtteranceListItem(row({ audioPath: null }), NOW).audioAvailable, false)
  assert.equal(toUtteranceListItem(row({ audioDeletedAt: new Date('2026-10-05T00:00:00Z') }), NOW).audioAvailable, false)
  assert.equal(toUtteranceListItem(row({ audioExpiresAt: new Date('2026-10-06T11:59:59Z') }), NOW).audioAvailable, false)
  assert.equal(toUtteranceListItem(row({ audioExpiresAt: NOW }), NOW).audioAvailable, false)
})

test('쓰인 곳: 메시지 → 회화(방 id) · 수업 → 수업 id · 평가 → id 없음 · 방만 → ROOM_ONLY(방 id) · 방도 없음 → UNSENT', () => {
  assert.deepEqual(contextOfRow({ chatId: 'c1', chatMessageId: 'm1', lessonId: null, evaluationItemId: null }), { kind: 'TALK', id: 'c1' })
  assert.deepEqual(contextOfRow({ chatId: null, chatMessageId: 'm1', lessonId: null, evaluationItemId: null }), { kind: 'TALK', id: null })
  assert.deepEqual(contextOfRow({ chatId: null, chatMessageId: null, lessonId: 'l1', evaluationItemId: null }), { kind: 'LESSON', id: 'l1' })
  assert.deepEqual(contextOfRow({ chatId: null, chatMessageId: null, lessonId: null, evaluationItemId: 'e1' }), { kind: 'EVALUATION', id: null })
  // REV-135 L-B: 방 칸이 남아 있으면 방은 있다(SetNull) — 방에서 녹음했지만 메시지로 보내지 않은 말.
  assert.deepEqual(contextOfRow({ chatId: 'c1', chatMessageId: null, lessonId: null, evaluationItemId: null }), { kind: 'ROOM_ONLY', id: 'c1' })
  // 방 연결도 없음 — 방 밖 녹음·지운 대화의 말·내지 않은 평가 답은 데이터로 가를 수 없다.
  assert.deepEqual(contextOfRow({ chatId: null, chatMessageId: null, lessonId: null, evaluationItemId: null }), { kind: 'UNSENT', id: null })
  // 앞 갈래가 이긴다 — 메시지·수업·평가 연결이 있으면 방 칸이 있어도 ROOM_ONLY 가 아니다.
  assert.equal(contextOfRow({ chatId: 'c1', chatMessageId: null, lessonId: 'l1', evaluationItemId: null }).kind, 'LESSON')
  assert.equal(contextOfRow({ chatId: 'c1', chatMessageId: null, lessonId: null, evaluationItemId: 'e1' }).kind, 'EVALUATION')
  assert.equal(toUtteranceListItem(row({ chatId: 'c9', chatMessageId: null })).context.kind, 'ROOM_ONLY', '목록 DTO 도 같은 갈래')
})

/* ── 라우트(정적) ─────────────────────────────────────────── */

test('#21c 라우트: 세션 → 사용자당 제한 → 질의 검사 → chatId 면 소유 방 확인(남의 방 404) → 목록, 응답은 no-store', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/v1/speech/utterances/route.ts'), 'utf8')
  const get = src.slice(src.indexOf('export const GET'), src.indexOf('export const POST'))
  const order = ['requireSession()', 'rateLimit(', 'parseUtteranceListQuery(', 'getOwnedChat(s.user.id, q.chatId)', 'listUtterances(s.user.id, q)']
  let at = -1
  for (const needle of order) {
    const i = get.indexOf(needle)
    assert.ok(i > at, `${needle} 순서`)
    at = i
  }
  assert.match(get, /private, no-store/)
})

test('#66 라우트: voiced 는 speech 공개 API 로 라우트가 조합한다(learning → speech import 없음)', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/v1/evaluations/[id]/route.ts'), 'utf8')
  assert.match(route, /import \{ voicedEvaluationItems \} from '@\/modules\/speech'/)
  // 판정·실패 흡수는 `src/app/api/v1/_lib/evaluationVoiced.ts`(REV-132 M-2·L-2) — 단위 테스트는 그 옆 __tests__.
  assert.match(route, /withVoiced\(s\.user\.id, dto\.items, voicedEvaluationItems\)/)
  const learning = readFileSync(join(process.cwd(), 'src/modules/learning/index.ts'), 'utf8')
  assert.doesNotMatch(learning, /@\/modules\/speech|from '\.\.\/speech/)
})

/* ── #66 voiced ───────────────────────────────────────────── */

test('voiced: 이 문항에 붙은 발화의 확정 글(또는 처음 들린 글)과 답이 같을 때만 true — 사용자 범위로 한 번만 읽는다', async () => {
  const calls: { userId: string; ids: string[] }[] = []
  voicedDb.linked = async (userId, ids) => {
    calls.push({ userId, ids })
    return [
      { evaluationItemId: 'item1', finalText: '駅はどこにありますか', realtimeText: '駅はどこですか' },
      { evaluationItemId: 'item2', finalText: null, realtimeText: 'こんにちは' },
      { evaluationItemId: 'item3', finalText: null, realtimeText: '別の話' },
    ]
  }
  const out = await voicedEvaluationItems(USER, [
    { evaluationItemId: 'item1', answerText: ' 駅はどこにありますか ' },
    { evaluationItemId: 'item2', answerText: 'こんにちは' },
    { evaluationItemId: 'item3', answerText: '手で書いた答え' },
    { evaluationItemId: 'item4', answerText: '発話なし' },
  ])
  assert.deepEqual([...out].sort(), ['item1', 'item2'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].userId, USER)
  assert.deepEqual(calls[0].ids, ['item1', 'item2', 'item3', 'item4'])
})

test('voiced: 빈 답·이상한 id 는 묻지 않고, 대상이 없으면 DB 를 부르지 않는다 · 한 번에 50개까지', async () => {
  let called = 0
  let asked: string[] = []
  voicedDb.linked = async (_u, ids) => {
    called++
    asked = ids
    return []
  }
  assert.equal((await voicedEvaluationItems(USER, [{ evaluationItemId: 'ok1', answerText: '  ' }, { evaluationItemId: '../x', answerText: 'あ' }])).size, 0)
  assert.equal(called, 0)
  await voicedEvaluationItems(USER, Array.from({ length: 60 }, (_, i) => ({ evaluationItemId: `it${i}`, answerText: 'あ' })))
  assert.equal(called, 1)
  assert.equal(asked.length, 50)
})
