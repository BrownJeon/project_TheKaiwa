import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScenarioDetail } from '@/types/scenario'
import {
  applyOpeningDraft,
  draftFromDetail,
  draftFromResponse,
  draftInput,
  draftPatch,
  openingBlock,
  openingBody,
  openingDraftResult,
  openingFromSaved,
  openingRequestBody,
  openingState,
  parseStoredDraft,
  seedIdOfCopy,
  serializeStoredDraft,
  sheetOrigin,
  validateDraft,
  type EditableDraft,
  type OpeningValue,
} from '../logic'
import { OPENING, SHEET } from '../scenarioCopy'

/* task-045 T5-5a — 공유 편집기 첫마디(D5=A) 상태·저장 본문·#178 요청/응답 · 상황 시트 행동 줄 출처(S10). */

const matched = (ko: string, ja = 'いらっしゃいませ'): OpeningValue => ({ ko, ja, koAtJa: ko.replace(/\s+/g, ' ').trim(), reading: null })

function draft(over: Partial<EditableDraft> = {}): EditableDraft {
  return {
    title: '카페에서 주문하기',
    titleJa: 'カフェで注文する',
    level: 'N5',
    difficulty: 2,
    learner: '손님',
    tutor: '점원',
    goalKo: '음료를 크기까지 정해서 주문해요',
    criteria: ['마실 것과 크기를 말해요'],
    steps: ['인사하고 메뉴 묻기', '음료 고르기'],
    expressions: [
      { ja: 'アイスコーヒーをください', ko: '아이스커피 주세요' },
      { ja: '以上です', ko: '이게 다예요' },
    ],
    opening: matched('어서 오세요, 무엇을 드릴까요?'),
    topicIds: ['t_cafe'],
    requiredExpressions: null,
    ...over,
  }
}

function detail(over: Partial<ScenarioDetail> = {}): ScenarioDetail {
  return {
    id: 'scn_seed1',
    title: '카페에서 주문하기',
    titleJa: 'カフェで注文する',
    level: 'N5',
    difficulty: 2,
    isMine: false,
    roles: { learner: '손님', tutor: '점원' },
    goalKo: '주문',
    stepCount: 2,
    expressionCount: 2,
    topics: [{ id: 't_cafe', title: '카페 주문', titleJa: null }],
    recommended: false,
    description: null,
    goal: { communicativeGoalKo: '주문', successCriteria: ['크기를 말해요'] },
    steps: [{ ko: '인사' }, { ko: '주문' }],
    keyExpressions: [
      { id: 'e1', ja: 'これをください', ko: '이거 주세요' },
      { id: 'e2', ja: '以上です', ko: '이게 다예요' },
    ],
    requiredExpressions: 2,
    opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' },
    ...over,
  }
}

test('첫마디 상태 7가지 중 저장 판정 4가지: 비움 · 한국어만 · 고침 · 맞춤 — 한국어를 원래 글로 되돌리면 다시 맞춤', () => {
  assert.equal(openingState(null), 'none')
  assert.equal(openingState({ ko: '  \n ', ja: 'x', koAtJa: 'y', reading: null }), 'none')
  assert.equal(openingState({ ko: '어서 오세요', ja: null, koAtJa: null, reading: null }), 'koOnly')
  const m = matched('어서 오세요')
  assert.equal(openingState(m), 'matched')
  assert.equal(openingState({ ...m, ko: '어서 와요' }), 'stale')
  assert.equal(openingState({ ...m, ko: ' 어서\n오세요 ' }), 'matched', '한 줄 정리 기준으로 비교')
  assert.equal(openingState({ ...m, ko: '어서 와요' }) === 'stale' && openingState({ ...m, ko: '어서 오세요' }), 'matched')
})

test('저장된 첫마디·선생님 초안은 맞춤으로 시작 · 첫마디 없는 상세는 null', () => {
  assert.equal(openingState(openingFromSaved({ ja: 'いらっしゃいませ', ko: '어서 오세요' })), 'matched')
  assert.equal(openingFromSaved({ ja: '', ko: '어서' }), null)
  assert.equal(openingFromSaved(null), null)
  assert.equal(openingState(draftFromDetail(detail()).opening), 'matched')
  assert.equal(draftFromDetail(detail({ opening: undefined })).opening, null)
  const d = draftFromResponse({ draft: { title: 't', opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' } } }, { desc: 'x', topicId: null, level: 'N5' })
  assert.equal(openingState(d?.opening), 'matched')
})

test('저장 본문: 맞춤만 {ja, ko} · 비우면 null(#164 는 첫마디를 지움) · 상세 그대로면 바뀐 칸 없음', () => {
  assert.deepEqual(openingBody(matched(' 어서\n오세요 ')), { ja: 'いらっしゃいませ', ko: '어서 오세요' })
  assert.equal(openingBody({ ...matched('어서 오세요'), ko: '어서 와요' }), null)
  assert.equal(openingBody(null), null)
  const orig = detail()
  const base = draftFromDetail(orig)
  assert.deepEqual(draftPatch(base, orig), {})
  assert.deepEqual(draftPatch({ ...base, opening: { ...base.opening!, ko: '' } }, orig), { opening: null })
  const regenerated = { ...base, opening: applyOpeningDraft({ ...base.opening!, ko: '어서 와요' }, '어서 와요', { ja: 'ようこそ', reading: 'ようこそ' }) }
  assert.deepEqual(draftPatch(regenerated, orig), { opening: { ja: 'ようこそ', ko: '어서 와요' } })
  assert.equal(draftInput(draft({ opening: null }), { desc: '' }).opening, null)
})

test('저장 막음: 한국어만·고침이면 첫마디 칸 문제(초점은 [일본어로 만들기] 버튼 dr-opening) — 비움은 막지 않음', () => {
  const keys = (d: EditableDraft) => validateDraft(d).map((p) => p.key)
  assert.deepEqual(keys(draft()), [])
  const koOnly = validateDraft(draft({ opening: { ko: '어서 오세요', ja: null, koAtJa: null, reading: null } }))
  assert.deepEqual(koOnly, [{ key: 'opening', message: OPENING.problemKoOnly }])
  const stale = validateDraft(draft({ opening: { ...matched('어서 오세요'), ko: '어서 와요' } }))
  assert.deepEqual(stale, [{ key: 'opening', message: OPENING.problemStale }])
  assert.deepEqual(keys(draft({ opening: { ko: '', ja: null, koAtJa: null, reading: null } })), [])
  assert.deepEqual(keys(draft({ opening: { ...matched('a<b'), ko: 'a<b' } })), ['openingKo'])
})

test('[일본어로 만들기] 막힘: 한국어 없음 · 역할 없음(400 을 보내지 않게) · 80자 넘음', () => {
  assert.equal(openingBlock(draft({ opening: null })), 'noKo')
  assert.equal(openingBlock(draft({ opening: { ko: '   ', ja: null, koAtJa: null, reading: null } })), 'noKo')
  assert.equal(openingBlock(draft({ tutor: ' ' })), 'noRoles')
  assert.equal(openingBlock(draft({ opening: { ko: '가'.repeat(81), ja: null, koAtJa: null, reading: null } })), 'tooLong')
  assert.equal(openingBlock(draft()), null)
})

test('#178 본문: 지금 편집 값 · 빈 칸·한도 넘는 칸·꺾쇠 칸은 빼고 보낸다 · 장소 이름', () => {
  const b = openingRequestBody(draft({ opening: { ko: ' 어서\n오세요 ', ja: null, koAtJa: null, reading: null } }), '카페 주문')
  assert.deepEqual(b, {
    ko: '어서 오세요',
    scenario: { level: 'N5', roles: { learner: '손님', tutor: '점원' }, title: '카페에서 주문하기', titleJa: 'カフェで注文する', goal: '음료를 크기까지 정해서 주문해요', placeTitle: '카페 주문' },
  })
  const lean = openingRequestBody(draft({ title: 'a'.repeat(41), titleJa: '', goalKo: '<b>' }), null)
  assert.deepEqual(Object.keys(lean.scenario).sort(), ['level', 'roles'])
})

test('#178 응답: 줄임 경고 · 읽기 버림 · 쓸 수 없는 응답 · 받으면 보낸 한국어로 맞춤', () => {
  assert.deepEqual(openingDraftResult({ ja: 'いらっしゃいませ', reading: 'いらっしゃいませ', warnings: [] }), { ja: 'いらっしゃいませ', reading: 'いらっしゃいませ', truncated: false })
  assert.equal(openingDraftResult({ ja: 'x', reading: null, warnings: ['JA_TRUNCATED'] })?.truncated, true)
  assert.equal(openingDraftResult({ ja: 'x', reading: 'え', warnings: ['READING_DROPPED'] })?.reading, null)
  assert.equal(openingDraftResult({ ja: '  ' }), null)
  assert.equal(openingDraftResult('nope'), null)
  const next = applyOpeningDraft({ ko: '어서 오세요', ja: null, koAtJa: null, reading: null }, '어서 오세요', { ja: 'いらっしゃいませ', reading: null })
  assert.equal(openingState(next), 'matched')
})

test('초안 보관: 새 모양(고침 상태 그대로) · 예전 {ja, ko} 모양은 맞춤으로 읽는다', () => {
  const stale = draft({ opening: { ...matched('어서 오세요'), ko: '어서 와요' } })
  const back = parseStoredDraft(serializeStoredDraft({ ask: { desc: 'x', topicId: null, level: 'N5' }, draft: stale, edited: true, savedAt: 1 }))
  assert.equal(openingState(back?.draft?.opening), 'stale')
  const old = JSON.stringify({ v: 1, ask: { desc: 'x', topicId: null, level: 'N5' }, draft: { ...draft(), opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' } }, edited: false, savedAt: 1 })
  assert.equal(openingState(parseStoredDraft(old)?.draft?.opening), 'matched')
})

test('S10 출처: 기본 · 내 상황 · 내 버전(#179) · #179 를 못 읽으면 내 상황 확인 불가(지우기 숨김)', () => {
  const ov = [
    { seedId: 'scn_seed1', state: 'COPIED', copyId: 'scn_copy1', orphan: false },
    { seedId: 'scn_seed2', state: 'HIDDEN', copyId: null, orphan: false },
    { seedId: 'scn_seed3', state: 'COPIED', copyId: 'scn_copy3', orphan: true },
  ]
  assert.equal(sheetOrigin({ id: 'scn_seed9', isMine: false }, ov), 'SEED')
  assert.equal(sheetOrigin({ id: 'scn_copy1', isMine: true }, ov), 'COPY')
  assert.equal(sheetOrigin({ id: 'scn_copy3', isMine: true }, ov), 'MINE', '고아 override 는 내 버전으로 보지 않는다')
  assert.equal(sheetOrigin({ id: 'scn_mine', isMine: true }, ov), 'MINE')
  assert.equal(sheetOrigin({ id: 'scn_copy1', isMine: true }, null), 'MINE_UNSURE')
  assert.equal(seedIdOfCopy('scn_copy1', ov), 'scn_seed1')
  assert.equal(seedIdOfCopy('scn_mine', ov), null)
  assert.equal(seedIdOfCopy('scn_copy1', null), null)
})

test('첫마디·시트 문구: 「AI」·엔진명·조사 병기 없음, 해요체', () => {
  const all = [...Object.values(OPENING), ...Object.values(SHEET)].map((v) => (typeof v === 'function' ? (v as unknown as (...a: string[]) => string)('점원', 'N5') : String(v)))
  for (const t of all) {
    assert.ok(!/\bAI\b|claude|whisper|reazon|style-bert/i.test(t), t)
    assert.ok(!/\((을|를|은|는|이|가)\)/.test(t), t)
  }
  assert.equal(OPENING.confirmRole(''), '선생님이 먼저 건네는 말이 맞는지 확인해 주세요. 내가 할 말이면 첫마디가 아니라 대화 순서에 적어요.')
  assert.ok(OPENING.confirmRole('점원').startsWith('선생님(점원 역할)이 '))
})
