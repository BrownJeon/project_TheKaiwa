/**
 * task-064 dev-S1 — conversation 이 넘기는 읽기 함수(`Correction`·`Chat` 은 L2 소유 — learning 은 직접 읽지 않는다).
 * 교정: 본인·ACCEPTED·기간·검색어(원래·고친 문장, LIKE 이스케이프)만, 설명·대화 칸은 select 하지 않는다.
 * 역할극: 본인 TALK 방 중 상황이 붙은 것만, 메시지·제목은 읽지 않는다. 빈 userId 는 조회하지 않는다.
 * `retrieveAskRecords` 는 두 읽기 함수와 질문 검색어를 채워 learning `retrieveRecords` 를 부른다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAskCorrectionReader, createAskRolePlayReader, retrieveAskRecords } from '..'
import { dbDate, kst, retrievalFakeDb } from '../../../learning/recordRetrieval/__tests__/fakeDb'

const U = 'cuserask0000000000000000u1'
const U2 = 'cuserask0000000000000000u2'

function world() {
  const f = retrievalFakeDb()
  const t = f.tables
  t.correction.push(
    { id: 'c1', userId: U, chatId: 'ch1', messageId: 'm1', status: 'ACCEPTED', original: '学校で行きます', corrected: '学校に行きます', explanation: 'SECRET_EXPL', extraNoteKo: 'SECRET_EXTRA', errorType: 'PARTICLE', createdAt: kst('2026-10-06 21:00') },
    { id: 'c2', userId: U, chatId: 'ch1', messageId: 'm1', status: 'PROPOSED', original: 'P', corrected: 'P2', explanation: 'x', errorType: 'GRAMMAR', createdAt: kst('2026-10-07 21:00') },
    { id: 'c3', userId: U, chatId: 'ch1', messageId: 'm1', status: 'REJECTED', original: 'R', corrected: 'R2', explanation: 'x', errorType: 'GRAMMAR', createdAt: kst('2026-10-07 21:00') },
    { id: 'c4', userId: U2, chatId: 'ch9', messageId: 'm9', status: 'ACCEPTED', original: '学校で', corrected: '学校に', explanation: 'x', errorType: 'PARTICLE', createdAt: kst('2026-10-06 21:00') },
    { id: 'c5', userId: U, chatId: 'ch1', messageId: 'm1', status: 'ACCEPTED', original: '50%_off で', corrected: '50%_off に', explanation: 'x', errorType: 'PARTICLE', createdAt: kst('2026-09-01 21:00') },
  )
  t.chat.push(
    { id: 'ch1', userId: U, kind: 'TALK', title: 'SECRET_TITLE', scenarioId: 'cscen1', createdAt: kst('2026-10-06 20:00'), endedAt: kst('2026-10-06 20:20') },
    { id: 'ch2', userId: U, kind: 'TALK', title: 't', scenarioId: null, createdAt: kst('2026-10-06 20:00'), endedAt: null },
    { id: 'ch3', userId: U, kind: 'CHAT', title: 't', scenarioId: 'cscen1', createdAt: kst('2026-10-06 20:00'), endedAt: null },
    { id: 'ch4', userId: U2, kind: 'TALK', title: 't', scenarioId: 'cscen1', createdAt: kst('2026-10-06 20:00'), endedAt: null },
    { id: 'ch5', userId: U, kind: 'TALK', title: 't', scenarioId: 'cscen1', createdAt: kst('2026-08-01 20:00'), endedAt: kst('2026-10-07 09:00') },
  )
  t.scenario.push({ id: 'cscen1', userId: null, isSeed: true, title: '역에서 표 사기', titleJa: null, keyExpressions: [] })
  t.lesson.push({ id: 'l1', userId: U, date: dbDate('2026-10-06'), kind: 'NEW', title: '레슨', status: 'DONE', score: 90, content: null, createdAt: kst('2026-10-06 09:00') })
  return f
}

const RANGE = { from: kst('2026-10-05 00:00'), toExclusive: kst('2026-10-12 00:00') }

test('교정 읽기 — 본인·ACCEPTED·기간만, 설명·대화 칸 select 안 함', async () => {
  const f = world()
  const read = createAskCorrectionReader(f.db)
  const rows = await read(U, { ...RANGE, terms: [], take: 10 })
  assert.deepEqual(rows.map((r) => r.id), ['c1'])
  assert.deepEqual(Object.keys(rows[0]).sort(), ['corrected', 'createdAt', 'errorType', 'id', 'original', 'status', 'userId'])
  const call = f.calls.at(-1)
  assert.equal(call?.table, 'correction')
  assert.equal(call?.args.where?.userId, U)
  assert.equal(call?.args.where?.status, 'ACCEPTED')
  for (const col of ['explanation', 'extraNoteKo', 'chatId', 'messageId']) assert.ok(!call?.args.select?.[col], col)
  const all = await read(U, { from: null, toExclusive: RANGE.toExclusive, terms: [], take: 10 })
  assert.deepEqual(all.map((r) => r.id), ['c1', 'c5'], '하한 없음 = 전체 기간, 최근순')
})

test('교정 읽기 — 검색어는 원래·고친 문장에서만, LIKE 이스케이프, take 1~20', async () => {
  const f = world()
  const read = createAskCorrectionReader(f.db)
  const hit = await read(U, { from: null, toExclusive: RANGE.toExclusive, terms: ['50%_off'], take: 99 })
  assert.deepEqual(hit.map((r) => r.id), ['c5'])
  const call = f.calls.at(-1)
  assert.equal(call?.args.take, 20)
  assert.deepEqual(call?.args.where?.OR, [{ original: { contains: '50\\%\\_off' } }, { corrected: { contains: '50\\%\\_off' } }])
  assert.deepEqual((await read(U, { from: null, toExclusive: RANGE.toExclusive, terms: ['SECRET_EXPL'], take: 5 })).map((r) => r.id), [], '설명은 찾지 않는다')
  await read(U, { ...RANGE, terms: [], take: 0 })
  assert.equal(f.calls.at(-1)?.args.take, 1)
})

test('역할극 읽기 — 본인 TALK·상황 있는 방만, 시작 또는 마침이 기간 안, 제목·메시지 안 읽음', async () => {
  const f = world()
  const read = createAskRolePlayReader(f.db)
  const rows = await read(U, { ...RANGE, take: 10 })
  assert.deepEqual(rows.map((r) => r.chatId).sort(), ['ch1', 'ch5'])
  assert.deepEqual(Object.keys(rows[0]).sort(), ['chatId', 'createdAt', 'endedAt', 'scenarioId', 'userId'])
  const call = f.calls.at(-1)
  assert.equal(call?.args.where?.userId, U)
  assert.equal(call?.args.where?.kind, 'TALK')
  assert.ok(!call?.args.select?.title)
  assert.equal(f.calls.filter((c) => c.table === 'chatMessage').length, 0)
})

test('빈 userId 는 두 읽기 함수 모두 조회하지 않는다', async () => {
  const f = world()
  assert.deepEqual(await createAskCorrectionReader(f.db)('', { ...RANGE, terms: [], take: 5 }), [])
  assert.deepEqual(await createAskRolePlayReader(f.db)('', { ...RANGE, take: 5 }), [])
  assert.equal(f.calls.length, 0)
})

test('retrieveAskRecords — 교정·역할극 읽기와 질문 검색어를 채워 조회(본인 기록만, 근거 id 는 sourceMap 에만)', async () => {
  const f = world()
  const r = await retrieveAskRecords(U, { intent: 'EXPRESSION', scope: { key: 'THIS_WEEK' } }, '「学校」에서 고쳐 준 거 뭐였지?', { db: f.db, now: () => kst('2026-10-08 12:00') })
  assert.deepEqual(r.meta.functionsCalled, ['findExpressions', 'getRecentCorrections'])
  const texts = r.items.map((i) => i.text)
  assert.ok(texts.includes('채택한 교정(조사) · 「学校で行きます」 → 「学校に行きます」'))
  assert.ok(!JSON.stringify(r.items).includes('SECRET'))
  assert.ok(!JSON.stringify(r.items).match(/\bc1\b|\bch1\b/))
  const ids = Object.values(r.sourceMap).map((s) => s.id)
  assert.ok(ids.includes('c1'))
  assert.ok(!ids.includes('c4') && !ids.includes('ch4'))
  const g = await retrieveAskRecords(U, { intent: 'GENERAL', scope: null }, '뜻', { db: f.db })
  assert.equal(g.items.length, 0)
})
