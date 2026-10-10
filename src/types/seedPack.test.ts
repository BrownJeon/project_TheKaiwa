import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_PACKS, SEED_PACK_COUNT, SEED_PACK_LABEL, isSeedPack, seedPackCategory } from './seedPack'

test('task-051 단계 팩: 5단계 순서·표시 이름(D1=C)·분류 칩 이름 = 표시 이름(D3=B)', () => {
  assert.deepEqual([...SEED_PACKS], ['N5', 'N4', 'N3', 'N2', 'N1'])
  assert.deepEqual(SEED_PACK_LABEL, { N5: '초보자 (N5)', N4: '초급 (N4)', N3: '중급 (N3)', N2: '고급 (N2)', N1: '최상급 (N1)' })
  for (const p of SEED_PACKS) {
    assert.equal(seedPackCategory(p), SEED_PACK_LABEL[p])
    assert.ok(seedPackCategory(p).length <= 40, 'WordEntry.category VarChar(40)')
  }
  assert.ok(!Object.values(SEED_PACK_LABEL).some((l) => l.includes('원어민')), '「원어민」은 쓰지 않는다')
  assert.notEqual(seedPackCategory('N5'), 'N5 기초', '기존 50개 분류와 다른 칩(사용자 결정 D3=B 고지)')
})

test('task-051 단계 팩: isSeedPack 은 다섯 값만, 개수 맵은 다섯 키 전부 양의 정수', () => {
  for (const p of SEED_PACKS) assert.equal(isSeedPack(p), true)
  for (const bad of ['N6', 'n5', '', ' N5', 'ALL', null, undefined, 5, {}]) assert.equal(isSeedPack(bad), false, String(bad))
  assert.deepEqual(Object.keys(SEED_PACK_COUNT).sort(), [...SEED_PACKS].sort())
  for (const p of SEED_PACKS) assert.ok(Number.isInteger(SEED_PACK_COUNT[p]) && SEED_PACK_COUNT[p] > 0, p)
})
