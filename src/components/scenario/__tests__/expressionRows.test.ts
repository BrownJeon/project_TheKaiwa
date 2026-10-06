import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScenarioDetail } from '@/types/scenario'
import {
  addExpression,
  draftFromDetail,
  draftInput,
  draftPatch,
  editExpression,
  editingAfterRemove,
  editingTarget,
  newRowKey,
  NEW_EXPRESSION,
  parseStoredDraft,
  removeExpression,
  serializeStoredDraft,
  withRowKeys,
  type DraftExpression,
  type EditableDraft,
} from '../logic'

/* REV-139 M-1 — 핵심 표현 편집 폼은 행 순번이 아니라 행 키를 가리킨다. */

const rows = (...ja: string[]): DraftExpression[] => ja.map((j) => ({ ja: j, ko: `${j}-뜻` }))

test('행 키: 저장된 표현은 id 로, 새 표현은 c<n> · 이미 맞으면 같은 배열 · 겹치는 키는 새로', () => {
  const keyed = withRowKeys([{ id: 'e1', ja: 'a', ko: '1' }, { ja: 'b', ko: '2' }, { id: 'e2', ja: 'c', ko: '3' }])
  assert.deepEqual(keyed.map((e) => e.rowKey), ['id:e1', 'c0', 'id:e2'])
  assert.equal(withRowKeys(keyed), keyed)
  const dup = withRowKeys([{ rowKey: 'c0', ja: 'a', ko: '1' }, { rowKey: 'c0', ja: 'b', ko: '2' }, { id: 'x', rowKey: 'c0', ja: 'c', ko: '3' }])
  assert.deepEqual(dup.map((e) => e.rowKey), ['c0', 'c1', 'id:x'])
  assert.deepEqual(withRowKeys([]), [])
})

test('새 행 키: 지금 행의 c<n> 다음, 편집기가 준 수보다 작지 않게(지운 키를 다시 쓰지 않음)', () => {
  const keyed = withRowKeys(rows('a', 'b', 'c'))
  assert.equal(newRowKey(keyed), 'c3')
  assert.equal(newRowKey(keyed.slice(0, 1)), 'c1')
  assert.equal(newRowKey(keyed.slice(0, 1), 3), 'c3')
  assert.equal(newRowKey([]), 'c0')
})

test('편집 폼을 연 채 위 행을 지워도 고치던 행이 바뀐다(옆 행을 덮어쓰지 않는다)', () => {
  let list = withRowKeys(rows('一', '二', '三', '四'))
  let editing: string | null = list[2].rowKey // 3번 행(三) 고치기
  const removed = list[0].rowKey
  list = removeExpression(list, removed) // 1번 행(一) 지우기
  editing = editingTarget(list, editingAfterRemove(editing, removed))
  assert.equal(editing, list.find((e) => e.ja === '三')?.rowKey)
  list = editExpression(list, editing as string, { ja: '三つ', ko: '세 개' })
  assert.deepEqual(list.map((e) => e.ja), ['二', '三つ', '四'])
  assert.equal(new Set(list.map((e) => e.ja)).size, 3)
})

test('열린 폼의 행이 사라지면 폼을 닫는다 · 다른 행·새 표현 폼은 그대로', () => {
  const list = withRowKeys(rows('a', 'b', 'c'))
  const b = list[1].rowKey
  assert.equal(editingAfterRemove(b, b), null)
  assert.equal(editingAfterRemove(b, list[0].rowKey), b)
  assert.equal(editingAfterRemove(NEW_EXPRESSION, b), NEW_EXPRESSION)
  assert.equal(editingTarget(list.filter((e) => e.rowKey !== b), b), null)
  assert.equal(editingTarget(list, b), b)
  assert.equal(editingTarget([], NEW_EXPRESSION), NEW_EXPRESSION)
  assert.equal(editingTarget(list, null), null)
})

test('지우기: 키로 찾고, 최소 개수 아래·없는 키면 같은 배열', () => {
  const list = withRowKeys(rows('a', 'b', 'c'))
  assert.deepEqual(removeExpression(list, list[1].rowKey).map((e) => e.ja), ['a', 'c'])
  assert.equal(removeExpression(list, 'c99'), list)
  const two = withRowKeys(rows('a', 'b'))
  assert.equal(removeExpression(two, two[0].rowKey), two)
})

test('고치기: 같은 일본어면 읽기 유지 · 일본어가 바뀌면 읽기 버림 · id·행 키 유지 · 없는 키면 같은 배열', () => {
  const list = withRowKeys([
    { id: 'e1', ja: '袋', reading: 'ふくろ', ko: '봉투' },
    { ja: 'はい', ko: '네' },
  ])
  const same = editExpression(list, 'id:e1', { ja: ' 袋 ', ko: '봉지' })
  assert.deepEqual(same[0], { id: 'e1', rowKey: 'id:e1', ja: ' 袋 ', ko: '봉지', reading: 'ふくろ' })
  const changed = editExpression(list, 'id:e1', { ja: '紙袋', ko: '종이봉투' })
  assert.deepEqual(changed[0], { id: 'e1', rowKey: 'id:e1', ja: '紙袋', ko: '종이봉투' })
  assert.equal(changed[1], list[1])
  assert.equal(editExpression(list, 'c99', { ja: 'x', ko: 'y' }), list)
  const added = addExpression(list, { ja: 'いいえ', ko: '아니요' }, newRowKey(list))
  assert.deepEqual(added[2], { rowKey: 'c1', ja: 'いいえ', ko: '아니요' })
})

function detail(): ScenarioDetail {
  return {
    id: 'scn_mine',
    title: '편의점 계산',
    titleJa: null,
    level: 'N5',
    difficulty: 2,
    isMine: true,
    roles: { learner: '손님', tutor: '점원' },
    goalKo: '목표',
    stepCount: 2,
    expressionCount: 2,
    topics: [],
    recommended: false,
    description: null,
    goal: { communicativeGoalKo: '목표', successCriteria: ['조건'] },
    steps: [{ ko: '인사' }, { ko: '계산' }],
    keyExpressions: [
      { id: 'e1', ja: '袋', ko: '봉투' },
      { id: 'e2', ja: 'はい', ko: '네' },
    ],
    requiredExpressions: 2,
  }
}

test('행 키는 서버로 보내지 않는다(만들기·고치기 본문) · 키만 붙은 표현은 바뀐 칸이 아니다', () => {
  const orig = detail()
  const base = draftFromDetail(orig)
  const keyedDraft: EditableDraft = { ...base, expressions: withRowKeys(base.expressions) }
  assert.deepEqual(draftPatch(keyedDraft, orig), {})
  const body = draftInput(keyedDraft, { desc: '' })
  assert.ok(body.keyExpressions.every((e) => !('rowKey' in e)))
  const moved: EditableDraft = { ...keyedDraft, expressions: [...keyedDraft.expressions].reverse() }
  const patch = draftPatch(moved, orig)
  assert.deepEqual(patch.keyExpressions, [
    { ja: 'はい', ko: '네', id: 'e2' },
    { ja: '袋', ko: '봉투', id: 'e1' },
  ])
})

test('보관 왕복: 행 키는 읽을 때 버리고 편집기가 다시 붙인다', () => {
  const draft: EditableDraft = {
    title: 't',
    titleJa: '',
    level: 'N5',
    difficulty: null,
    learner: 'a',
    tutor: 'b',
    goalKo: 'g',
    criteria: ['c'],
    steps: ['s1', 's2'],
    expressions: withRowKeys(rows('a', 'b')),
    opening: null,
    topicIds: [],
    requiredExpressions: null,
  }
  const back = parseStoredDraft(serializeStoredDraft({ ask: { desc: 'x', topicId: null, level: 'N5' }, draft, edited: true, savedAt: 1 }))
  assert.ok(back?.draft)
  assert.ok(back.draft.expressions.every((e) => e.rowKey === undefined))
  assert.deepEqual(withRowKeys(back.draft.expressions).map((e) => e.rowKey), ['c0', 'c1'])
})
