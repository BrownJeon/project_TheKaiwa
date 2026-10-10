import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_PACK_COUNT, SEED_PACK_LABEL, SEED_PACKS } from '@/types/seedPack'
import {
  actionErrorText,
  categoryBadgeText,
  CHUNK_FILTER_ALL,
  CHUNK_FILTER_CHIPS,
  CHUNK_LABEL,
  chunkEmptyText,
  chunkFilterName,
  enrichErrorText,
  FLASH,
  fmtCount,
  HINT,
  homeLoadErrorText,
  JLPT_LEVELS,
  levelHelpText,
  levelLabel,
  levelName,
  listConditionText,
  listErrorText,
  POS_LABEL,
  resultBand,
  SEED_COPY,
  seedLevelsFrom,
  seedPackTotal,
  seedResultText,
  SOURCE_SENTENCE,
  startErrorText,
} from '../labels'

const LEAK = /claude|haiku|sonnet|opus|qwen|엔진|모델|trace|Phase|task-/i

test('오류 문구: 400 만 서버 문구, 나머지는 화면 표 문구(서버 문구의 구현 용어가 새지 않는다)', () => {
  const serverMsg = 'AI 엔진을 지금 사용할 수 없습니다 (traceId t_abc)'
  for (const fn of [actionErrorText, startErrorText, (e: { status: number; message?: string }) => enrichErrorText(e, 7)]) {
    assert.equal(fn({ status: 400, message: '표현은 80자까지' }), '표현은 80자까지')
    for (const status of [0, 404, 409, 422, 429, 502, 504, 500, -1]) {
      const text = fn({ status, message: serverMsg })
      assert.doesNotMatch(text, LEAK, `status=${status}`)
      assert.notEqual(text, serverMsg)
    }
  }
  for (const status of [0, 400, 422, 502, 504]) {
    assert.doesNotMatch(listErrorText({ status, message: serverMsg }), LEAK)
    assert.doesNotMatch(homeLoadErrorText({ status, message: serverMsg }), LEAK)
  }
  assert.match(enrichErrorText({ status: 429 }, 7), /7초/)
  assert.match(enrichErrorText({ status: 422 }), /직접 입력/)
})

test('고정 문구·라벨에 구현 용어 없음', () => {
  const all = [
    ...Object.values(HINT),
    ...Object.values(FLASH),
    ...Object.values(POS_LABEL),
    ...Object.values(SOURCE_SENTENCE),
    ...Object.values(CHUNK_LABEL),
    ...CHUNK_FILTER_CHIPS.flatMap((c) => [c.label, c.sr]),
  ]
  for (const t of all) assert.doesNotMatch(String(t), LEAK)
})

test('seedResultText(pack, r): 단계 이름이 앞에 붙고 숫자는 천 단위 쉼표', () => {
  assert.equal(seedResultText('N5', { added: 12, skipped: 0 }), `${SEED_PACK_LABEL.N5} 단어 12개를 넣었어요`)
  assert.equal(seedResultText('N1', { added: 3001, skipped: 33 }), `${SEED_PACK_LABEL.N1} 단어 3,001개를 넣었어요 · 이미 있는 33개는 건너뛰었어요`)
  assert.equal(seedResultText('N3', { added: 0, skipped: 1649 }), `${SEED_PACK_LABEL.N3} 단어가 이미 모두 들어 있어요`)
  assert.equal(seedResultText('N4', { added: -1, skipped: 0 }), `${SEED_PACK_LABEL.N4} 단어가 이미 모두 들어 있어요`)
})

test('levelLabel·levelName: 이름은 seedPack 단일 출처, 이름에 괄호 없음, 「이름 (코드)」 = 표시 이름', () => {
  for (const l of SEED_PACKS) {
    assert.equal(levelLabel(l), SEED_PACK_LABEL[l])
    assert.doesNotMatch(levelName(l), /[()]/)
    assert.equal(`${levelName(l)} (${l})`, SEED_PACK_LABEL[l])
  }
  assert.deepEqual([...JLPT_LEVELS], [...SEED_PACKS])
  assert.equal(fmtCount(7755), '7,755')
  assert.equal(fmtCount(676), '676')
})

test('기본 단어 문구: 개수는 SEED_PACK_COUNT 에서, N1 옛 이름·고정 개수 없음', () => {
  for (const l of SEED_PACKS) {
    const n = fmtCount(SEED_PACK_COUNT[l])
    assert.equal(SEED_COPY.mainBtn(l), `${SEED_PACK_LABEL[l]} 단어 ${n}개 넣기`)
    assert.equal(SEED_COPY.goalBtn(l), `목표 수준 ${SEED_PACK_LABEL[l]} 단어 ${n}개 넣기`)
    assert.equal(SEED_COPY.sheetMain(l), `${SEED_PACK_LABEL[l]} 기본 단어 ${n}개 한 번에 넣기 ›`)
    assert.equal(SEED_COPY.sheetGoal(l), `목표 수준 ${SEED_PACK_LABEL[l]} 단어 ${n}개 한 번에 넣기 ›`)
    assert.ok(SEED_COPY.emptyBody(l).startsWith(`${SEED_PACK_LABEL[l]} 기본 단어 ${n}개로 바로 시작하거나`))
    assert.ok(SEED_COPY.todayBody(l).includes(`${SEED_PACK_LABEL[l]} 기본 단어로 바로 시작해 볼까요?`))
  }
  const all = [
    ...SEED_PACKS.flatMap((l) => [SEED_COPY.mainBtn(l), SEED_COPY.goalBtn(l), SEED_COPY.sheetMain(l), SEED_COPY.sheetGoal(l), SEED_COPY.emptyBody(l), SEED_COPY.todayBody(l)]),
    SEED_COPY.emptyBodyNoLevel,
    SEED_COPY.todayBodyNoLevel,
    SEED_COPY.levelRetry,
    levelHelpText(),
    SOURCE_SENTENCE.SEED,
  ]
  for (const t of all) {
    assert.doesNotMatch(t, LEAK)
    assert.doesNotMatch(t, /원어민|N5 기초|\b50개|674|7,811/)
  }
  assert.equal(levelHelpText(), `선생님 대화와 기본 단어 넣기가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — ${levelName('N1')}은 가장 높은 급수(N1)예요.`)
  assert.equal(SOURCE_SENTENCE.SEED, '기본 단어 팩에서 넣었어요')
  assert.equal(seedPackTotal(), SEED_PACKS.reduce((s, l) => s + SEED_PACK_COUNT[l], 0))
})

test('categoryBadgeText(§19-4 E): 분류가 수준 뱃지 글과 같을 때만 숨긴다', () => {
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N4, 'N4'), null)
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N4, 'N3'), SEED_PACK_LABEL.N4)
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N5, null), SEED_PACK_LABEL.N5)
  assert.equal(categoryBadgeText('일상', 'N5'), '일상')
  assert.equal(categoryBadgeText(null, 'N5'), null)
  assert.equal(categoryBadgeText('', 'N5'), null)
})

test('seedLevelsFrom(§19-3): 지금 수준이 주, 목표 수준은 있고 다를 때만 보조', () => {
  assert.deepEqual(seedLevelsFrom({ level: 'N5', goalLevel: 'N4' }), { main: 'N5', goal: 'N4' })
  assert.deepEqual(seedLevelsFrom({ level: 'N2', goalLevel: 'N1' }), { main: 'N2', goal: 'N1' })
  assert.deepEqual(seedLevelsFrom({ level: 'N3', goalLevel: 'N3' }), { main: 'N3', goal: null })
  assert.deepEqual(seedLevelsFrom({ level: 'N3', goalLevel: null }), { main: 'N3', goal: null })
  // 목표가 지금보다 낮아도 「다름」이면 그린다.
  assert.deepEqual(seedLevelsFrom({ level: 'N3', goalLevel: 'N5' }), { main: 'N3', goal: 'N5' })
  // 지금 수준을 모르면 둘 다 없다(넣기 버튼 숨김).
  assert.deepEqual(seedLevelsFrom({ level: 'N6', goalLevel: 'N4' }), { main: null, goal: null })
  assert.deepEqual(seedLevelsFrom({ goalLevel: 'N4' }), { main: null, goal: null })
  assert.deepEqual(seedLevelsFrom(null), { main: null, goal: null })
  assert.deepEqual(seedLevelsFrom('N5'), { main: null, goal: null })
  assert.deepEqual(seedLevelsFrom({ level: 'N5', goalLevel: 'NONE' }), { main: 'N5', goal: null })
})

test('resultBand: CHOICE 맞았어요/틀렸어요 · FLIP 알았어요/몰랐어요 · 건너뜀은 중립', () => {
  assert.deepEqual(resultBand('CORRECT', 'CHOICE'), { text: '✓ 맞았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'CHOICE'), { text: '✗ 틀렸어요', tone: 'bad' })
  assert.deepEqual(resultBand('CORRECT', 'FLIP'), { text: '✓ 알았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'FLIP'), { text: '✗ 몰랐어요', tone: 'bad' })
  assert.deepEqual(resultBand('SKIPPED', 'FLIP'), { text: '건너뛴 카드', tone: 'neutral' })
})

test('조각 줄(task-023): 전체·이름·액션·느낌·꾸밈·없음 순, 칩 글자 짧게 + 화면 읽기 "○○ 조각"', () => {
  assert.equal(CHUNK_FILTER_ALL.label, '전체')
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.value),
    ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'none'],
  )
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.label),
    ['이름', '액션', '느낌', '꾸밈', '없음'],
  )
  for (const c of CHUNK_FILTER_CHIPS.filter((x) => x.value !== 'none')) assert.equal(`${c.label}${c.sr}`, CHUNK_LABEL[c.value as 'NAME'])
  assert.equal(chunkFilterName('FEELING'), '느낌 조각')
  assert.equal(chunkFilterName('none'), '조각 없음')
})

test('목록 머리 조건 · 조각 결과 0 문구(데모 v1 list-and·list-empty·list-search-empty)', () => {
  assert.equal(listConditionText({ category: null, chunk: null }), null)
  assert.equal(listConditionText({ category: 'N5 기초', chunk: 'FEELING' }), 'N5 기초 · 느낌 조각')
  assert.equal(listConditionText({ category: null, chunk: 'none' }), '조각 없음')
  assert.equal(listConditionText({ category: '일상' }), '일상')
  assert.deepEqual(chunkEmptyText({ q: '', category: '일상', chunk: 'ACTION', archived: false }), {
    title: '‘일상’에 액션 조각 단어가 없어요',
    body: '분류와 조각을 함께 고르면 둘 다 맞는 단어만 보여요.',
  })
  assert.deepEqual(chunkEmptyText({ q: '', category: null, chunk: 'ACTION', archived: false }), { title: '액션 조각 단어가 없어요', body: null })
  assert.deepEqual(chunkEmptyText({ q: '', category: null, chunk: 'NAME', archived: true }), { title: '보관한 단어 중 이름 조각 단어가 없어요', body: null })
  assert.deepEqual(chunkEmptyText({ q: '映', category: null, chunk: 'ACTION', archived: false }), { title: null, body: '액션 조각 안에서 찾았어요.' })
  assert.deepEqual(chunkEmptyText({ q: '映', category: '교정', chunk: 'ACTION', archived: false }), { title: null, body: '액션 조각 · 교정 안에서 찾았어요.' })
})
