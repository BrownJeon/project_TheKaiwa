/**
 * task-051 REV-179 M2 — 같은 표기·다른 읽기 행(기본 단어 팩에서 생김)이 있을 때 표기만 보는 세 경로가 결정적으로 같은 행을 고르는지.
 * ① 단어 저장 409 `existingId`(words.ts findSameSurface) ② 평가 문항 wordId(evaluation/generate.ts buildItemRows) ③ 레슨 메모 단어장 연결(lessons/memo.ts).
 * 409 정책 자체(읽기가 다르면 허용할지)는 바꾸지 않는다 — 사용자 결정 사항.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import { buildItemRows, type EvalGenOutputLike } from '../evaluation/generate'
import type { EvalMaterialWord } from '../evaluation/materials'
import { wordbookMatches } from '../lessons/memo'
import { createWord } from '../vocab/words'

type Row = { id: string; userId: string; surface: string; createdAt: Date }
type OrderBy = { createdAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }[]

/** findMany 가 받은 orderBy 를 기록하고 그대로 정렬해 돌려주는 가짜 DB(정렬이 없으면 저장 순 = 비결정 흉내로 최신 행이 앞). */
function fakeDb(rows: Row[]) {
  const seenOrder: (OrderBy | undefined)[] = []
  const db = {
    $queryRaw: async () => [{ id: 'u1' }],
    wordEntry: {
      findMany: async (a: { where: { userId: string; surface: string | { in: string[] }; id?: { not: string } }; orderBy?: OrderBy; take?: number }) => {
        seenOrder.push(a.orderBy)
        const s = a.where.surface
        let out = rows.filter((r) => r.userId === a.where.userId && (typeof s === 'string' ? r.surface === s : s.in.includes(r.surface)) && r.id !== a.where.id?.not)
        out = a.orderBy
          ? out.slice().sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
          : out.slice().reverse()
        return out.slice(0, a.take ?? out.length).map((r) => ({ id: r.id, surface: r.surface }))
      },
    },
  }
  return { db: db as unknown as Tx, seenOrder }
}

const at = (m: number) => new Date(Date.UTC(2026, 9, 10, 0, m))
const ROWS: Row[] = [
  { id: 'w-old', userId: 'u1', surface: '明日', createdAt: at(1) },
  { id: 'w-new', userId: 'u1', surface: '明日', createdAt: at(5) },
  { id: 'w-other', userId: 'u2', surface: '明日', createdAt: at(0) },
]

test('M2① createWord 409: 같은 표기 행이 여럿이면 existingId = 가장 먼저 만든 행(createdAt·id 오름차순), 409 자체는 그대로', async () => {
  const { db, seenOrder } = fakeDb(ROWS)
  await assert.rejects(
    createWord('u1', { surface: '明日', meaning: '내일', reading: 'あす' } as Parameters<typeof createWord>[1], db),
    (e: unknown) => {
      const err = e as { code?: string; details?: { existingId?: string } }
      assert.equal(err.code, 'CONFLICT')
      assert.equal(err.details?.existingId, 'w-old')
      return true
    },
  )
  assert.deepEqual(seenOrder[0], [{ createdAt: 'asc' }, { id: 'asc' }])
})

test('M2② 평가 문항 wordId: 같은 표기 재료가 둘이면 [재료] 순서의 앞 행(뒤 행이 덮지 않음)', () => {
  const mats: EvalMaterialWord[] = [
    { id: 'w-a', surface: '明日', reading: 'あした', meaning: '내일', correctCount: 0, wrongCount: 2, lastSeenAt: null },
    { id: 'w-b', surface: '明日', reading: 'あす', meaning: '내일', correctCount: 0, wrongCount: 0, lastSeenAt: null },
    { id: 'w-c', surface: '窓', reading: 'まど', meaning: '창문', correctCount: 0, wrongCount: 0, lastSeenAt: null },
  ]
  const out = { items: [{ kind: 'MEANING_CHOICE', wordSurface: '明日', prompt: {}, expected: {}, dims: [] }, { kind: 'MEANING_CHOICE', wordSurface: '窓', prompt: {}, expected: {}, dims: [] }] } as unknown as EvalGenOutputLike
  const rows = buildItemRows('ev1', 'WORDS', out, mats)
  assert.deepEqual(rows.map((r) => r.wordId), ['w-a', 'w-c'])
  assert.deepEqual(buildItemRows('ev1', 'WORDS', out, [mats[1]!, mats[0]!, mats[2]!]).map((r) => r.wordId), ['w-b', 'w-c'], '순서가 정한다(결정적)')
})

test('M2③ 레슨 메모 단어장 연결: 같은 표기 행이 여럿이면 가장 먼저 만든 행, 다른 사용자 행은 보지 않음', async () => {
  const { db, seenOrder } = fakeDb([...ROWS, { id: 'w-mado', userId: 'u1', surface: '窓', createdAt: at(3) }])
  const m = await wordbookMatches('u1', ['明日', '窓', '明日', '猫'], db)
  assert.deepEqual([...m], [['明日', 'w-old'], ['窓', 'w-mado']])
  assert.deepEqual(seenOrder[0], [{ createdAt: 'asc' }, { id: 'asc' }])
  assert.equal((await wordbookMatches('u1', [], db)).size, 0)
})
