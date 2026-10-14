import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_PACK_COUNT, SEED_PACK_LABEL, SEED_PACKS } from '@/types/seedPack'
import {
  actionErrorText,
  ARCHIVE_NOTE,
  BASE_ARCHIVE_BTN,
  BASE_ARCHIVED_TOAST,
  BASE_BAND,
  BASE_DUPLICATE_HINT,
  BASE_DUPLICATE_TEXT,
  BASE_SOURCE_SENTENCE,
  BASE_UNARCHIVE_BTN,
  BASE_UNARCHIVED_TOAST,
  categoryBadgeText,
  CHUNK_CHIP_LABEL,
  CHUNK_DEF,
  CHUNK_FIELD_LABEL,
  CHUNK_PICK_DRAFT,
  CHUNK_PICK_HINT,
  CHUNK_PICK_REQUIRED,
  CHUNK_FILTER_ALL,
  CHUNK_FILTER_CHIPS,
  CHUNK_LABEL,
  chunkEmptyText,
  chunkFilterName,
  enrichErrorText,
  FLASH,
  fmtCount,
  isLevelCategory,
  LEVEL_CATEGORY_NAMES,
  listLeadText,
  MINE_SOURCE_SUFFIX,
  ORIGIN_BADGE,
  READ_ONLY_TEXT,
  todayLevelLine,
  WORD_SAVED_TOAST,
  WORD_SOURCE_ARIA,
  WORD_SOURCE_OPTIONS,
  WORDS_EMPTY_COPY,
  WORDS_PAGE_COPY,
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
  seedPackTotal,
  SOURCE_SENTENCE,
  startErrorText,
} from '../labels'
import { WORD_CHUNK_TYPES } from '@/types/vocab'

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

test('기본 단어 출처 줄: 합계는 생성 파일 값의 합(설정 「데이터 출처」) · 옛 이름·고정 개수 없음', () => {
  for (const t of [SOURCE_SENTENCE.SEED, levelHelpText()]) {
    assert.doesNotMatch(t, LEAK)
    assert.doesNotMatch(t, /원어민|N5 기초|50개|674|7,811/)
  }
  assert.equal(SOURCE_SENTENCE.SEED, '기본 단어 팩에서 넣었어요')
  assert.equal(seedPackTotal(), SEED_PACKS.reduce((s, l) => s + SEED_PACK_COUNT[l], 0))
})

test('categoryBadgeText(task-068 §28-2 C): 난이도 이름 분류면 수준과 상관없이 늘 숨긴다(옛 N5 기초 포함)', () => {
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N4, 'N4'), null)
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N4, 'N3'), null)
  assert.equal(categoryBadgeText(SEED_PACK_LABEL.N5, null), null)
  assert.equal(categoryBadgeText('N5 기초', 'N5'), null)
  assert.equal(categoryBadgeText('초보자(N5)', 'N5'), '초보자(N5)', '공백이 다른 사용자 분류는 난이도 이름이 아니다')
  assert.equal(categoryBadgeText('일상', 'N5'), '일상')
  assert.equal(categoryBadgeText(null, 'N5'), null)
  assert.equal(categoryBadgeText('', 'N5'), null)
})

test('resultBand: CHOICE 맞았어요/틀렸어요 · FLIP 알았어요/몰랐어요 · 건너뜀은 중립', () => {
  assert.deepEqual(resultBand('CORRECT', 'CHOICE'), { text: '✓ 맞았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'CHOICE'), { text: '✗ 틀렸어요', tone: 'bad' })
  assert.deepEqual(resultBand('CORRECT', 'FLIP'), { text: '✓ 알았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'FLIP'), { text: '✗ 몰랐어요', tone: 'bad' })
  assert.deepEqual(resultBand('SKIPPED', 'FLIP'), { text: '건너뛴 카드', tone: 'neutral' })
})

test('T10 조각 줄(task-068): 전체·이름·액션·느낌·꾸밈·표현 순 · 「없음」 없음 · 칩 글자 짧게 + 화면 읽기 "○○ 조각"', () => {
  assert.equal(CHUNK_FILTER_ALL.label, '전체')
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.value),
    ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'],
  )
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.label),
    ['이름', '액션', '느낌', '꾸밈', '표현'],
  )
  assert.deepEqual([...WORD_CHUNK_TYPES], ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'])
  for (const c of CHUNK_FILTER_CHIPS) {
    assert.equal(`${c.label}${c.sr}`, CHUNK_LABEL[c.value])
    assert.equal(c.label, CHUNK_CHIP_LABEL[c.value])
  }
  assert.ok(!CHUNK_FILTER_CHIPS.some((c) => /없음|정해지지/.test(c.label + c.sr)))
  assert.equal(chunkFilterName('FEELING'), '느낌 조각')
  assert.equal(chunkFilterName('EXPRESSION'), '표현 조각')
})

test('T9 isLevelCategory: 난이도 이름 6개 정확히(바이트 일치) · 다른 글자는 false', () => {
  assert.deepEqual([...LEVEL_CATEGORY_NAMES], ['초보자 (N5)', '초급 (N4)', '중급 (N3)', '고급 (N2)', '최상급 (N1)', 'N5 기초'])
  for (const n of LEVEL_CATEGORY_NAMES) assert.equal(isLevelCategory(n), true, n)
  for (const n of ['초보자(N5)', '초보자 (n5)', ' 초보자 (N5)', '여행', '', 'N5', null, undefined]) assert.equal(isLevelCategory(n), false, String(n))
})

test('T24 task-068 문구 — 가이드 28-1 H · 28-2 G · 28-3 A · 28-4 F · 28-5 D · 28-6 E 원문', () => {
  const P = WORDS_PAGE_COPY
  assert.deepEqual([P.pagerAria, P.prev, P.next, P.busy, P.firstSr], ['단어 목록 쪽', '이전', '다음', '불러오는 중…', '단어장을 불러오고 있어요'])
  assert.equal(P.label(3, 1109), '3 / 1,109')
  assert.equal(P.total(7758), '모두 7,758개')
  assert.equal(P.centerAria(3, 1109), '3 / 1,109 — 쪽으로 이동')
  assert.equal(P.sr(3, 1109, 7758), '1,109쪽 중 3쪽 · 모두 7,758개')
  assert.equal(P.pagingSr(4), '4쪽을 불러오고 있어요')
  assert.deepEqual([P.pageError, P.pageErrorBody, P.retry], ['이 쪽을 불러오지 못했어요', '연결을 확인하고 다시 시도해 주세요.', '다시 시도'])
  assert.equal(P.jumpTitle, '쪽으로 이동')
  assert.equal(P.jumpNow(3, 1109), '지금 3쪽 · 모두 1,109쪽')
  assert.equal(P.jumpLabel, '쪽 번호')
  assert.equal(P.jumpPlaceholder(1109), '1–1,109')
  assert.equal(P.jumpError(1109), '1부터 1,109 사이 숫자를 적어 주세요')
  assert.deepEqual([P.jumpFirst, P.jumpLast, P.jumpGo, P.pageSuffix(3)], ['처음 쪽', '마지막 쪽', '이동', '3쪽'])

  assert.deepEqual(WORD_SOURCE_OPTIONS.map((o) => [o.value, o.label]), [['all', '전체'], ['mine', '내 단어'], ['base', '기본 단어']])
  assert.equal(WORD_SOURCE_ARIA, '출처')
  assert.deepEqual(['all', 'mine', 'base', 'archived'].map((l) => listLeadText(l as 'all', 7758)), ['단어 7,758개', '내 단어 7,758개', '기본 단어 7,758개', '보관한 단어 7,758개'])
  assert.equal(ARCHIVE_NOTE, '보관한 단어는 오늘의 단어에 나오지 않아요. 숨긴 기본 단어는 나에게만 숨겨져요.')
  assert.equal(todayLevelLine('N5'), '지금 수준(초보자 (N5)) 단어가 가장 많이 나와요.')

  assert.equal(CHUNK_LABEL.EXPRESSION, '표현 조각')
  assert.deepEqual(CHUNK_DEF.EXPRESSION, { def: '문장 밖에서 통째로 쓰는 말(인사 · 대답 · 감탄 · 이음말)', ex: 'はじめまして · なるほど · でも' })
  assert.deepEqual(CHUNK_DEF.NAME, { def: '사람 · 물건 · 곳 · 때를 가리키는 말(명사 · 대명사)', ex: '友達 · 映画 · どこ' })
  assert.deepEqual(CHUNK_DEF.ACTION, { def: '하는 일 · 움직임(동사, 〜する 명사)', ex: '会う · 勉強 · 行く' })
  assert.deepEqual(CHUNK_DEF.FEELING, { def: '마음 · 상태 · 평가(형용사 · 감정)', ex: '楽しい · 好き · 安心' })
  assert.deepEqual(CHUNK_DEF.MODIFIER, { def: '다른 말에 붙어 때 · 곳 · 정도를 더하는 말(부사 · 조사구)', ex: 'とても · 毎日 · その' })
  assert.equal(CHUNK_FIELD_LABEL, '조각')
  assert.equal(CHUNK_PICK_HINT, '단어장에서 이 조각으로 거를 수 있어요. 고르면 뜻이 보여요.')
  assert.equal(CHUNK_PICK_REQUIRED, '조각을 골라 주세요')
  assert.equal(CHUNK_PICK_DRAFT, '선생님이 고른 조각이에요 · 바꿀 수 있어요')
  assert.equal(BASE_DUPLICATE_TEXT, '기본 단어에 이미 있어요')
  assert.equal(BASE_DUPLICATE_HINT, '기본 단어는 모두 단어장에 들어 있어요. 같은 표기 · 읽기는 내 단어로 다시 넣지 않아요.')
  assert.equal(WORD_SAVED_TOAST, '단어장에 넣었어요 · 내 단어는 나만 봐요')

  assert.deepEqual(ORIGIN_BADGE, { MINE: '내 단어', BASE: '기본 단어' })
  assert.equal(BASE_SOURCE_SENTENCE, '기본 단어예요 · 내용은 고칠 수 없고 보관(숨기기)만 할 수 있어요. 맞힘 · 틀림 기록은 나에게만 쌓여요.')
  assert.equal(SOURCE_SENTENCE.MANUAL + MINE_SOURCE_SUFFIX, '내가 넣은 단어예요 · 나만 봐요')
  assert.equal(SOURCE_SENTENCE.MANUAL, '내가 넣은 단어예요')
  assert.deepEqual([BASE_ARCHIVE_BTN, BASE_UNARCHIVE_BTN], ['보관 — 목록 · 오늘의 단어에서 숨기기', '보관 풀기 — 다시 보이기'])
  assert.deepEqual([BASE_ARCHIVED_TOAST, BASE_UNARCHIVED_TOAST], ['보관했어요 · 목록과 오늘의 단어에서 숨겨요(나에게만)', '보관을 풀었어요 · 다시 보여요'])
  assert.equal(READ_ONLY_TEXT, '기본 단어는 고치거나 지울 수 없어요')

  assert.deepEqual(WORDS_EMPTY_COPY, {
    noWordsBody: '아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.',
    todayEmptyBody: '오늘의 단어는 내 단어장에서 골라요.',
    addBtn: '단어 직접 추가',
    noMineTitle: '아직 내가 넣은 단어가 없어요',
    noMineBody: '기본 단어에 없는 표현을 직접 넣으면 여기에 모여요. 내 단어는 나만 봐요.',
  })
  assert.equal(BASE_BAND.title(7758), '기본 단어 7,758개가 들어 있어요')
  assert.equal(BASE_BAND.body, '내용은 고칠 수 없고 보관(숨기기)만 할 수 있어요. 필요한 단어는 ＋ 추가로 직접 넣으세요 — 내 단어는 나만 봐요.')
  assert.equal(BASE_BAND.close, '안내 닫기')
  assert.equal(levelHelpText(), `선생님 대화와 오늘의 단어가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — ${levelName('N1')}은 가장 높은 급수(N1)예요.`)
  assert.doesNotMatch(levelHelpText(), /넣기/)

  const fns = [P.label(1, 2), P.total(3), P.centerAria(1, 2), P.sr(1, 2, 3), P.pagingSr(2), P.jumpNow(1, 2), P.jumpPlaceholder(2), P.jumpError(2), P.pageSuffix(2), BASE_BAND.title(9), todayLevelLine('N1')]
  const all = [
    ...fns,
    ...Object.values(P).flatMap((v) => (typeof v === 'string' ? [v] : [])),
    ...WORD_SOURCE_OPTIONS.map((o) => o.label),
    ARCHIVE_NOTE,
    ...Object.values(CHUNK_DEF).flatMap((d) => [d.def, d.ex]),
    CHUNK_PICK_HINT,
    CHUNK_PICK_REQUIRED,
    CHUNK_PICK_DRAFT,
    BASE_DUPLICATE_TEXT,
    BASE_DUPLICATE_HINT,
    WORD_SAVED_TOAST,
    ...Object.values(ORIGIN_BADGE),
    BASE_SOURCE_SENTENCE,
    BASE_ARCHIVE_BTN,
    BASE_UNARCHIVE_BTN,
    BASE_ARCHIVED_TOAST,
    BASE_UNARCHIVED_TOAST,
    READ_ONLY_TEXT,
    ...Object.values(WORDS_EMPTY_COPY),
    BASE_BAND.body,
    BASE_BAND.close,
    levelHelpText(),
  ]
  for (const t of all) {
    assert.doesNotMatch(t, LEAK, t)
    assert.doesNotMatch(t, /단어 더 보기|seed|Seed/, t)
  }
})

test('actionErrorText 403(task-068): details.code=READ_ONLY 일 때만 전용 문구 — 다른 403 은 지금 문구 그대로', () => {
  assert.equal(actionErrorText({ status: 403, details: { code: 'READ_ONLY' } }), READ_ONLY_TEXT)
  assert.equal(actionErrorText({ status: 403, message: 'x', details: {} }), '처리하지 못했어요. 다시 시도해 주세요.')
  assert.equal(actionErrorText({ status: 403 }), '처리하지 못했어요. 다시 시도해 주세요.')
})

test('목록 머리 조건 · 조각 결과 0 문구(데모 v1 list-and·list-empty·list-search-empty)', () => {
  assert.equal(listConditionText({ category: null, chunk: null }), null)
  assert.equal(listConditionText({ category: '여행', chunk: 'FEELING' }), '여행 · 느낌 조각')
  assert.equal(listConditionText({ category: null, chunk: 'EXPRESSION' }), '표현 조각')
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
