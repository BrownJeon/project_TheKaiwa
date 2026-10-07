import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Err } from '@/components/common/errors'
import type { ScenarioDetail, ScenarioListItem } from '@/types/scenario'
import { SCENARIO_LIMITS } from '@/types/scenario'
import {
  cardStatus,
  draftFromDetail,
  draftFromResponse,
  draftInput,
  draftLevelOf,
  draftPatch,
  effectiveFilter,
  genFailureOf,
  goalSummary,
  groupByPlace,
  isBlankStore,
  isScenarioIdParam,
  josa,
  parseStoredDraft,
  pickRecommended,
  placeOptions,
  problemDomId,
  problemKey,
  recommendReasonText,
  requiredOf,
  saveFailureOf,
  serializeStoredDraft,
  serverProblems,
  startFailureOf,
  stepPosition,
  stepView,
  validateDraft,
  withRo,
  type EditableDraft,
} from '../logic'

const T = (id: string, title: string) => ({ id, title, titleJa: `${title}JA` })
function item(id: string, over: Partial<ScenarioListItem> = {}): ScenarioListItem {
  return {
    id,
    title: `상황 ${id}`,
    titleJa: null,
    level: 'N5',
    difficulty: 2,
    isMine: false,
    roles: { learner: '손님', tutor: '점원' },
    goalKo: '주문한다',
    stepCount: 4,
    expressionCount: 4,
    topics: [],
    recommended: false,
    ...over,
  }
}
const err = (status: number, details: Record<string, unknown> = {}, message = '서버 문구', code: string | null = null): Err => ({ status, message, code, details, retryAfterSec: null })

function draft(over: Partial<EditableDraft> = {}): EditableDraft {
  return {
    title: '편의점 계산',
    titleJa: 'コンビニの会計',
    level: 'N5',
    difficulty: 2,
    learner: '손님',
    tutor: '점원',
    goalKo: '봉투와 포인트 카드를 묻고 답한다',
    criteria: ['봉투가 필요한지 답한다'],
    steps: ['인사', '계산'],
    expressions: [
      { ja: '袋をください', ko: '봉투 주세요' },
      { ja: 'カードはありません', ko: '카드는 없어요' },
    ],
    opening: { ja: 'いらっしゃいませ', ko: '어서 오세요', koAtJa: '어서 오세요', reading: null },
    topicIds: ['t_conv'],
    requiredExpressions: null,
    ...over,
  }
}

test('조사: 받침·ㄹ 받침·한글 아님', () => {
  assert.equal(josa('점원', '이', '가'), '점원이')
  assert.equal(josa('손님', '이', '가'), '손님이')
  assert.equal(josa('가게 주인', '이', '가'), '가게 주인이')
  assert.equal(josa('바리스타', '이', '가'), '바리스타가')
  assert.equal(josa('ABC', '이', '가'), 'ABC이(가)')
  assert.equal(withRo('호텔'), '호텔로')
  assert.equal(withRo('병원'), '병원으로')
  assert.equal(withRo('카페'), '카페로')
})

test('주소 값: 상황 id 모양만', () => {
  assert.ok(isScenarioIdParam('scn_cafe-1'))
  assert.ok(!isScenarioIdParam(''))
  assert.ok(!isScenarioIdParam('a'.repeat(41)))
  assert.ok(!isScenarioIdParam('../x'))
  assert.ok(!isScenarioIdParam(['a']))
})

test('카드 상태: 처음·달성·거의·아직 + 날짜(KST)', () => {
  assert.deepEqual(cardStatus({}), { kind: 'first' })
  assert.deepEqual(cardStatus({ last: { at: '2026-09-26T03:00:00.000Z', outcome: 'ACHIEVED', usedCount: 3, totalCount: 4 } }), { kind: 'achieved', date: '9월 26일' })
  assert.deepEqual(cardStatus({ last: { at: '2026-09-25T16:30:00.000Z', outcome: 'ALMOST', usedCount: 1, totalCount: 4 } }), { kind: 'almost', date: '9월 26일' })
  assert.equal(cardStatus({ last: { at: 'x', outcome: 'NOT_YET', usedCount: 0, totalCount: 4 } }).kind, 'notYet')
})

test('추천: 이유 문구(모르는 코드 = 줄 없음) · recommendedIds 순서 · 3개까지', () => {
  assert.equal(recommendReasonText('RETRY_NOT_YET'), '지난번엔 목표 전이었어요 · 다시 해 볼 때예요')
  assert.equal(recommendReasonText('SOMETHING_NEW'), null)
  assert.equal(recommendReasonText('toString'), null)
  assert.equal(recommendReasonText(undefined), null)
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, { recommended: id !== 'a' }))
  assert.deepEqual(pickRecommended({ items, recommendedIds: ['d', 'zz', 'b', 'e', 'c'] }).map((x) => x.id), ['d', 'b', 'e'])
  assert.deepEqual(pickRecommended({ items, recommendedIds: [] }), [])
})

test('장소: 칩 순서(시드 첫 장소 → 그 밖) · 전체는 첫 장소에만 한 번 · 장소 칩은 이어진 상황 전부 · 내 상황 묶음', () => {
  const cafe = T('t_cafe', '카페 주문')
  const road = T('t_road', '길 묻기')
  const shop = T('t_shop', '쇼핑')
  const items = [
    item('m1', { isMine: true, topics: [shop] }),
    item('s1', { topics: [cafe] }),
    item('s2', { topics: [cafe, road] }),
    item('s3', { topics: [road] }),
    item('s4', { topics: [] }),
  ]
  const opts = placeOptions(items)
  assert.deepEqual(opts.map((o) => o.label), ['전체', '내 상황 1', '카페 주문', '길 묻기', '쇼핑'])
  const all = groupByPlace(items, 'all')
  assert.deepEqual(all.map((g) => [g.title, g.items.map((x) => x.id)]), [
    ['내 상황', ['m1']],
    ['카페 주문', ['s1', 's2']],
    ['길 묻기', ['s3']],
    ['다른 상황', ['s4']],
  ])
  assert.deepEqual(groupByPlace(items, 'topic:t_road')[0].items.map((x) => x.id), ['s2', 's3'])
  assert.deepEqual(groupByPlace(items, 'topic:t_shop')[0].items.map((x) => x.id), ['m1'])
  assert.deepEqual(groupByPlace(items, 'mine')[0].items.map((x) => x.id), ['m1'])
  assert.deepEqual(groupByPlace(items.filter((x) => !x.isMine), 'mine'), [])
  assert.ok(!placeOptions(items.filter((x) => !x.isMine)).some((o) => o.value === 'mine'))
  assert.equal(effectiveFilter('topic:gone', opts), 'all')
  assert.equal(effectiveFilter('topic:t_cafe', opts), 'topic:t_cafe')
  assert.equal(effectiveFilter('mine', []), 'mine')
})

test('목표 요약·단계 보기(진행값 있음·없음·체크 숨김·이상한 값)', () => {
  assert.equal(goalSummary({ stepIndex: 1, stepCount: 4, usedCount: 1, total: 4, checksHidden: false }), '2/4단계 · 표현 1/4')
  assert.equal(goalSummary({ stepIndex: null, stepCount: 4, usedCount: 1, total: 4, checksHidden: false }), '4단계 · 표현 1/4')
  assert.equal(goalSummary({ stepIndex: 9, stepCount: 4, usedCount: 9, total: 4, checksHidden: false }), '4/4단계 · 표현 4/4')
  assert.equal(goalSummary({ stepIndex: 1, stepCount: 0, usedCount: 0, total: 3, checksHidden: false }), '표현 0/3')
  assert.equal(goalSummary({ stepIndex: 1, stepCount: 4, usedCount: 1, total: 4, checksHidden: true }), '표현 4개')
  const steps = [{ ko: 'a' }, { ko: 'b' }, { ko: 'c' }]
  assert.deepEqual(stepView(steps, 1).map((s) => s.state), ['done', 'current', 'next'])
  assert.deepEqual(stepView(steps, null).map((s) => s.state), ['next', 'next', 'next'])
  assert.deepEqual(stepView(steps, -1).map((s) => s.state), ['next', 'next', 'next'])
  assert.equal(requiredOf(4, null), 2)
  assert.equal(requiredOf(1, null), 1)
  assert.equal(requiredOf(3, 5), 3)
  assert.equal(draftLevelOf('N1'), 'N3')
  assert.equal(draftLevelOf(null), 'N5')
})

test('초안 응답 → 편집 모양: 빠진 칸은 빈 칸 · 표현 id 버림 · 장소는 묻기 값', () => {
  const ask = { desc: '편의점에서 계산하기', topicId: 't_conv', level: 'N4' as const }
  assert.equal(draftFromResponse({ nope: 1 }, ask), null)
  const d = draftFromResponse({ draft: { title: '계산', roles: { learner: '손님' }, steps: [{ ko: '인사' }, '계산'], keyExpressions: [{ id: 'x', ja: '袋', ko: '봉투', reading: 'ふくろ' }] } }, ask)
  assert.ok(d)
  assert.equal(d.title, '계산')
  assert.equal(d.tutor, '')
  assert.equal(d.level, 'N4')
  assert.deepEqual(d.steps, ['인사', '계산'])
  assert.deepEqual(d.expressions, [{ ja: '袋', ko: '봉투', reading: 'ふくろ' }])
  assert.deepEqual(d.topicIds, ['t_conv'])
  assert.equal(d.opening, null)
})

test('만들기 본문: 한 줄 정리 · id 없음 · 빈 일본어 제목 null · 필수 수 안 보냄', () => {
  const body = draftInput(draft({ titleJa: '  ', title: ' 편의점\n계산 ', expressions: [{ id: 'e9', ja: ' 袋 ', ko: '봉투' }, { ja: 'b', ko: 'c' }] }), { desc: '편의점에서\t계산' })
  assert.equal(body.title, '편의점 계산')
  assert.equal(body.titleJa, null)
  assert.equal(body.description, '편의점에서 계산')
  assert.deepEqual(body.keyExpressions[0], { ja: '袋', ko: '봉투' })
  assert.ok(!('requiredExpressions' in body))
  assert.deepEqual(body.topicIds, ['t_conv'])
})

function detail(): ScenarioDetail {
  return {
    ...item('scn_mine', { isMine: true, title: '편의점 계산', titleJa: 'コンビニの会計', topics: [T('t_conv', '편의점')] }),
    roles: { learner: '손님', tutor: '점원' },
    goalKo: '봉투와 포인트 카드를 묻고 답한다',
    description: '설명',
    goal: { communicativeGoalKo: '봉투와 포인트 카드를 묻고 답한다', successCriteria: ['봉투가 필요한지 답한다'] },
    steps: [{ ko: '인사' }, { ko: '계산' }],
    keyExpressions: [
      { id: 'e1', ja: '袋をください', ko: '봉투 주세요' },
      { id: 'e2', ja: 'カードはありません', ko: '카드는 없어요' },
    ],
    requiredExpressions: 2,
    opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' },
  }
}

test('고치기 본문: 바뀐 칸만 · 기존 표현 id 유지 · 안 바꾸면 빈 객체', () => {
  const orig = detail()
  const d = draftFromDetail(orig)
  assert.deepEqual(draftPatch(d, orig), {})
  const changed = { ...d, steps: [...d.steps, '인사하고 나가기'], expressions: [...d.expressions, { ja: 'はい', ko: '네' }] }
  const patch = draftPatch(changed, orig)
  assert.deepEqual(Object.keys(patch).sort(), ['keyExpressions', 'steps'])
  assert.deepEqual(patch.keyExpressions?.map((e) => e.id ?? null), ['e1', 'e2', null])
  assert.deepEqual(Object.keys(draftPatch({ ...d, opening: null }, orig)), ['opening'])
})

test('저장 전 검사: 서버 한도 그대로(단계 2~8·표현 2~12·꺾쇠·중복·첫마디)', () => {
  assert.deepEqual(validateDraft(draft()), [])
  const keys = (d: EditableDraft) => validateDraft(d).map((p) => p.key)
  assert.deepEqual(keys(draft({ title: '', tutor: 'a'.repeat(SCENARIO_LIMITS.roleMax + 1) })), ['title', 'tutor'])
  assert.deepEqual(keys(draft({ steps: ['인사'] })), ['steps'])
  assert.deepEqual(keys(draft({ steps: ['인사', ' '] })), ['steps[1]'])
  assert.deepEqual(keys(draft({ steps: Array(SCENARIO_LIMITS.stepsMax + 1).fill('a') })), ['steps'])
  assert.deepEqual(keys(draft({ criteria: [] })), ['criteria'])
  assert.deepEqual(keys(draft({ goalKo: '<b>' })), ['goal'])
  assert.deepEqual(keys(draft({ expressions: [{ ja: '袋', ko: '봉투' }, { ja: ' 袋', ko: '봉투2' }] })), ['expr[1]'])
  assert.deepEqual(keys(draft({ expressions: [{ ja: '袋', ko: '' }] })), ['expr', 'expr[0]'])
  assert.deepEqual(keys(draft({ expressions: Array.from({ length: 13 }, (_, i) => ({ ja: `j${i}`, ko: 'k' })) })), ['expr'])
  // task-045 T5-5a: 첫마디는 한국어 주 입력 — 일본어가 아직 없으면(koOnly) 저장을 막는다. 문구는 조사를 미리 붙인 이름표(「은(는)」 병기 없음).
  assert.deepEqual(keys(draft({ opening: { ko: '어서', ja: null, koAtJa: null, reading: null } })), ['opening'])
  assert.deepEqual(keys(draft({ opening: null })), [])
  assert.equal(validateDraft(draft({ title: 'a'.repeat(41) }))[0].message, '제목은 40자까지 쓸 수 있어요.')
})

test('서버 400 문제 → 화면 칸 · 초점 id', () => {
  const p = serverProblems(
    'scenarioSave',
    {
      field: 'steps[2].ko',
      reason: 'max_length',
      problems: [
        { field: 'steps[2].ko', reason: 'max_length', message: '대화 순서은(는) 40자까지 쓸 수 있어요.' },
        { field: 'keyExpressions[1].ja', reason: 'duplicate', message: '같은 표현이 두 번 들어 있어요.' },
        { field: 'goal.successCriteria[0]', reason: 'required', message: 'x' },
        { field: 'roles.tutor', reason: 'required', message: 'y' },
        { field: 'topicIds[0]', reason: 'not_found', message: 'z' },
        { field: 'requiredExpressions', reason: 'range', message: 'w' },
      ],
    },
  )
  assert.deepEqual(p.map((x) => x.key), ['steps[2]', 'expr[1]', 'criteria[0]', 'tutor', 'place', 'expr'])
  // task-045 T5-5a: 서버 message 대신 고정 문구(「을(를)」·「은(는)」 병기 0).
  assert.equal(p[0].message, '대화 순서는 40자까지 쓸 수 있어요.')
  assert.equal(p[3].message, '선생님 역할을 적어 주세요.')
  assert.ok(p.every((x) => !/\([을를은는이가]\)/.test(x.message) && x.message !== 'x' && x.message !== 'y'))
  assert.deepEqual(serverProblems('scenarioSave', { field: 'title', reason: 'required' }), [{ key: 'title', message: '제목을 적어 주세요.' }])
  assert.equal(problemKey('opening.ko'), 'openingKo')
  assert.equal(problemKey('opening.ja'), 'opening')
  assert.equal(problemKey('opening'), 'opening')
  assert.equal(problemDomId('openingKo'), 'dr-openingKo')
  assert.equal(problemKey('constraints'), 'other')
  assert.equal(problemDomId('steps[2]'), 'dr-steps-2')
  assert.equal(problemDomId('expr'), 'dr-expr')
})

test('오류 분류: 시작·초안·저장', () => {
  assert.equal(startFailureOf(err(404)), 'gone')
  assert.equal(startFailureOf(err(409, { reason: 'ARCHIVED' })), 'archived')
  assert.equal(startFailureOf(err(429)), 'rate')
  assert.equal(startFailureOf(err(400, {}, '상황 대화는 아직 준비 중이에요.', 'FEATURE_NOT_READY')), 'fail')
  assert.equal(startFailureOf(err(0)), 'fail')
  // task-045 T5-5a: 초안·저장 실패 문구는 failure.ts 고정 문구(서버 message 는 쓰지 않는다).
  assert.equal(genFailureOf(err(422), false).kind, 'unfit')
  assert.deepEqual(
    (({ kind, waitSec }) => ({ kind, waitSec }))(genFailureOf({ ...err(429), retryAfterSec: 7 }, false)),
    { kind: 'rate', waitSec: 7 },
  )
  assert.equal(genFailureOf(err(404), false).kind, 'engine')
  assert.equal(genFailureOf(err(404), false).retry, true)
  assert.equal(genFailureOf(err(422), true).kind, 'engine')
  const field = genFailureOf(err(400, { field: 'description', reason: 'max_length' }, '상황 설명은(는) 300자까지'), false)
  assert.equal(field.kind, 'field')
  assert.equal(field.text, '상황 설명은 300자까지 쓸 수 있어요.')
  assert.equal(field.problems[0]?.field, 'description')
  assert.deepEqual(saveFailureOf(err(404, { reason: 'SEED' })), { kind: 'gone' })
  assert.deepEqual(saveFailureOf(err(409, { reason: 'ARCHIVED' })), { kind: 'gone' })
  assert.deepEqual(saveFailureOf(err(409, { reason: 'SCENARIO_LIMIT' }, '서버 문구')), { kind: 'message', text: '내 상황이 50개라 더 저장할 수 없어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.', block: false })
  assert.deepEqual(saveFailureOf(err(429, { reason: 'DAILY_LIMIT' }, '서버 문구')), { kind: 'message', text: '오늘은 상황을 30개 저장했어요. 내일 다시 저장할 수 있어요.', block: true })
  assert.deepEqual(saveFailureOf(err(429)), { kind: 'message', text: '잠시 뒤 다시 눌러 주세요. 10초 뒤에 할 수 있어요.', block: false })
  assert.equal(saveFailureOf(err(500)).kind, 'message')
  assert.equal(saveFailureOf(err(400, { field: 'title', reason: 'required' }, '제목')).kind, 'invalid')
  assert.equal(saveFailureOf(err(409, { reason: 'ALREADY_COPIED' }), 'scenarioFork').kind, 'copied')
  assert.equal(saveFailureOf(err(404, { reason: 'SEED_NOT_FOUND' }), 'scenarioFork').kind, 'seedGone')
})

test('초안 보관: 왕복 · 깨진 값 · 빈 보관', () => {
  const s = { ask: { desc: '호텔에 체크인하기', topicId: null, level: 'N4' as const }, draft: draft(), edited: true, savedAt: 5 }
  const back = parseStoredDraft(serializeStoredDraft(s))
  assert.ok(back)
  assert.equal(back.ask.desc, '호텔에 체크인하기')
  assert.equal(back.draft?.title, '편의점 계산')
  assert.equal(back.edited, true)
  assert.equal(parseStoredDraft('{bad'), null)
  assert.equal(parseStoredDraft(JSON.stringify({ v: 2, ask: { desc: '' } })), null)
  assert.equal(parseStoredDraft(JSON.stringify({ v: 1, ask: { desc: 'x' }, draft: { title: 1 } }))?.draft, null)
  assert.ok(isBlankStore({ ask: { desc: '  ', topicId: null, level: 'N5' }, draft: null }))
  assert.ok(!isBlankStore({ ask: { desc: 'a', topicId: null, level: 'N5' }, draft: null }))
})

/* ── REV-139 M-4: 한도 정확값·0번 단계·장소 패치·보관 상한·ARCHIVED 코드 ─────────── */

test('저장 전 검사 경계: 정확히 한도인 값은 저장 가능, 한도+1 은 불가', () => {
  const L = SCENARIO_LIMITS
  const keys = (d: EditableDraft) => validateDraft(d).map((p) => p.key)
  assert.deepEqual(keys(draft({ steps: Array.from({ length: L.stepsMax }, (_, i) => `단계${i}`) })), [])
  assert.deepEqual(keys(draft({ steps: Array.from({ length: L.stepsMax + 1 }, (_, i) => `단계${i}`) })), ['steps'])
  assert.deepEqual(keys(draft({ expressions: Array.from({ length: L.expressionsMax }, (_, i) => ({ ja: `j${i}`, ko: 'k' })) })), [])
  assert.deepEqual(keys(draft({ expressions: Array.from({ length: L.expressionsMax + 1 }, (_, i) => ({ ja: `j${i}`, ko: 'k' })) })), ['expr'])
  assert.deepEqual(keys(draft({ criteria: Array.from({ length: L.successCriteriaMax }, (_, i) => `조건${i}`) })), [])
  assert.deepEqual(keys(draft({ criteria: Array.from({ length: L.successCriteriaMax + 1 }, (_, i) => `조건${i}`) })), ['criteria'])
  assert.deepEqual(keys(draft({ title: 'あ'.repeat(L.titleMax) })), [])
  assert.deepEqual(keys(draft({ title: 'あ'.repeat(L.titleMax + 1) })), ['title'])
  assert.deepEqual(keys(draft({ goalKo: '가'.repeat(L.goalMax) })), [])
  assert.deepEqual(keys(draft({ goalKo: '가'.repeat(L.goalMax + 1) })), ['goal'])
})

test('0번 단계(시작 값): 첫 단계가 지금 단계', () => {
  assert.equal(stepPosition(0, 3), 0)
  assert.equal(stepPosition(0, 0), null)
  assert.deepEqual(stepView([{ ko: 'a' }, { ko: 'b' }, { ko: 'c' }], 0).map((s) => s.state), ['current', 'next', 'next'])
  assert.equal(goalSummary({ stepIndex: 0, stepCount: 4, usedCount: 0, total: 4, checksHidden: false }), '1/4단계 · 표현 0/4')
})

test('고치기 본문: 장소만 바꾸면 topicIds 만 · 장소를 비우면 빈 배열', () => {
  const orig = detail()
  const d = draftFromDetail(orig)
  assert.deepEqual(draftPatch({ ...d, topicIds: ['t_hotel'] }, orig), { topicIds: ['t_hotel'] })
  assert.deepEqual(draftPatch({ ...d, topicIds: [] }, orig), { topicIds: [] })
})

test('초안 보관: 상황 설명은 상한(설명 한도의 2배)까지만 읽는다', () => {
  const cap = SCENARIO_LIMITS.descriptionMax * 2
  const read = (desc: string) => parseStoredDraft(JSON.stringify({ v: 1, ask: { desc }, draft: null }))?.ask.desc ?? null
  assert.equal(read('가'.repeat(cap + 50))?.length, cap)
  assert.equal(read('가'.repeat(cap))?.length, cap)
})

test('역할극 시작 409: details.reason 이 없어도 오류 코드 ARCHIVED 면 archived', () => {
  assert.equal(startFailureOf(err(409, {}, '지운 상황', 'ARCHIVED')), 'archived')
  assert.equal(startFailureOf(err(409, {}, '다른 충돌', 'CONFLICT')), 'fail')
})

test('첫마디(M-3 → task-045 D5=A): 한국어 한도 정확값 통과 · 비우면 첫마디 없음(null) · 맞춘 값만 저장', () => {
  const keys = (d: EditableDraft) => validateDraft(d).map((p) => p.key)
  const ko = (s: string) => draft({ opening: { ja: 'いらっしゃいませ', ko: s, koAtJa: s.replace(/[\r\n\t\f\v ]+/g, ' ').trim(), reading: null } })
  assert.deepEqual(keys(ko('')), [])
  assert.equal(draftInput(ko(''), { desc: '' }).opening, null)
  assert.deepEqual(keys(ko('가'.repeat(SCENARIO_LIMITS.openingKoMax))), [])
  assert.deepEqual(keys(ko('가'.repeat(SCENARIO_LIMITS.openingKoMax + 1))), ['openingKo'])
  assert.equal(validateDraft(ko('가'.repeat(SCENARIO_LIMITS.openingKoMax + 1)))[0].message, '선생님 첫마디는 80자까지 쓸 수 있어요.')
  const body = draftInput(ko(' 어서\n오세요 '), { desc: '' })
  assert.deepEqual(body.opening, { ja: 'いらっしゃいませ', ko: '어서 오세요' })
})
