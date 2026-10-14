/**
 * task-068 공용 도우미(`vocab/wordState.ts`) — 보이는 범위(내 단어 + 기본 단어)·내 보관·상태 맵·끝내기 카운터.
 * 가짜 DB(`wordFakeDb.ts`)가 실제 Prisma where 모양을 해석하므로, 조건 모양이 바뀌면 이 시험이 잡는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeWordWhere, archivedBy, bumpWordStates, loadWordStates, notArchivedBy, visibleWordWhere } from '../vocab/wordState'
import { base, createWordFakeDb, state, word } from './wordFakeDb'

const NOW = new Date('2026-10-14T03:00:00.000Z')

function fixture() {
  return createWordFakeDb({
    words: [
      base('b1', 'N5-0001'),
      base('b2', 'N5-0002'),
      word({ id: 'a1', userId: 'A' }),
      word({ id: 'x1', userId: 'B' }),
      word({ id: 'orphan', userId: null, source: 'MANUAL' }),
    ],
    states: [state('A', 'b2', { archived: true }), state('B', 'b1', { archived: true })],
  })
}

test('visibleWordWhere: 내 단어 + 기본 단어만(남의 단어·소유자 없는 비SEED 행 제외)', async () => {
  const { db } = fixture()
  const ids = (await db.wordEntry.findMany({ where: visibleWordWhere('A'), select: { id: true } })).map((r) => r.id)
  assert.deepEqual(ids.sort(), ['a1', 'b1', 'b2'])
  assert.deepEqual(visibleWordWhere('A'), { OR: [{ userId: 'A' }, { userId: null, source: 'SEED' }] })
})

test('notArchivedBy·activeWordWhere: 내 보관만 뺀다 — 다른 사용자의 보관은 영향 없음', async () => {
  const { db } = fixture()
  const ids = async (where: object) => (await db.wordEntry.findMany({ where, select: { id: true } })).map((r) => r.id).sort()
  assert.deepEqual(await ids(activeWordWhere('A')), ['a1', 'b1'], 'A 가 b2 보관, B 의 b1 보관은 A 에 영향 없음')
  assert.deepEqual(await ids(activeWordWhere('B')), ['b2', 'x1'])
  assert.deepEqual(await ids({ AND: [visibleWordWhere('A'), archivedBy('A')] }), ['b2'])
  assert.deepEqual(notArchivedBy('A'), { states: { none: { userId: 'A', archived: true } } })
})

test('loadWordStates: 내 행만 맵으로, 없는 단어는 맵에 없음, 빈 목록은 조회 0', async () => {
  const { db, log } = fixture()
  const m = await loadWordStates(db, 'A', ['b1', 'b2', 'b2', 'a1'])
  assert.deepEqual([...m.keys()], ['b2'])
  assert.equal(m.get('b2')?.archived, true)
  assert.equal(m.has('b1'), false, 'B 의 b1 상태는 A 맵에 없다')
  const before = log.length
  assert.equal((await loadWordStates(db, 'A', [])).size, 0)
  assert.equal(log.length, before, '빈 목록이면 DB 를 부르지 않는다')
})

test('bumpWordStates: UserWordState 에만 +1(맞힘·틀림)·건너뜀은 시각·결과만, WordEntry 행 변경 0, 남의 단어 id 는 빠짐', async () => {
  const { db, states, words, log } = fixture()
  const before = JSON.stringify(words)
  await bumpWordStates(db, 'A', { correctIds: ['b1', 'b1', 'a1'], wrongIds: ['b2', 'x1'], skippedIds: ['a1'] }, NOW)
  assert.equal(JSON.stringify(words), before, 'WordEntry 상태 칸은 쓰지 않는다')
  assert.equal(log.filter((l) => l.startsWith('word:') && l !== 'word:findMany').length, 0)
  const of = (u: string, w: string) => states.find((s) => s.userId === u && s.wordId === w)
  assert.deepEqual([of('A', 'b1')?.correctCount, of('A', 'b1')?.lastResult], [1, 'CORRECT'], '한 목록 안 중복은 한 번')
  assert.deepEqual([of('A', 'b2')?.wrongCount, of('A', 'b2')?.archived, of('A', 'b2')?.lastResult], [1, true, 'WRONG'], '보관 상태는 그대로')
  assert.deepEqual([of('A', 'a1')?.correctCount, of('A', 'a1')?.lastResult], [1, 'SKIPPED'], '맞힘 → 건너뜀 순서로 반영')
  assert.equal(of('A', 'a1')?.lastSeenAt?.getTime(), NOW.getTime())
  assert.equal(of('A', 'x1'), undefined, '남의 단어 상태를 만들지 않는다')
  assert.equal(of('B', 'b1')?.correctCount, 0, 'B 의 상태는 그대로')
  await bumpWordStates(db, 'A', { correctIds: ['b1'], wrongIds: [], skippedIds: [] }, NOW)
  assert.equal(of('A', 'b1')?.correctCount, 2, '두 번째 끝내기는 같은 행에 누적')
  assert.equal(states.filter((s) => s.userId === 'A' && s.wordId === 'b1').length, 1)
})
