/**
 * task-064 dev-S1 — `conversation/askRouter.classifyIntent`(규칙만, api-contract §2-18-A 6항)·`extractSearchTerms`.
 * ⑦ 대표 질문 40+개(askIntentCases — QA 오분류율 기준 세트) ⑧ 되묻기 칩 답 결합(직전 질문의 의도 + 칩 범위, 칩 글자로 분류하지 않음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifiedQuestion, classifyIntent, extractSearchTerms } from '..'
import { ASK_INTENT_CASES } from './askIntentCases'

test('⑦ 대표 질문 세트 — 40개 이상, 4종 의도 균형', () => {
  assert.ok(ASK_INTENT_CASES.length >= 40, `${ASK_INTENT_CASES.length}개`)
  const count = (i: string) => ASK_INTENT_CASES.filter((c) => c.intent === i).length
  for (const i of ['PROGRESS', 'EXPRESSION', 'GENERAL', 'MIXED']) assert.ok(count(i) >= 7, `${i} ${count(i)}개`)
  assert.ok(ASK_INTENT_CASES.filter((c) => c.needsScope).length >= 4, 'needsScope 사례')
  assert.equal(new Set(ASK_INTENT_CASES.map((c) => c.text)).size, ASK_INTENT_CASES.length, '중복 질문 없음')
})

for (const c of ASK_INTENT_CASES) {
  test(`⑦ ${c.intent}${c.needsScope ? '+범위?' : ''}${c.scope ? `(${c.scope})` : ''} — ${c.text}`, () => {
    const got = classifyIntent(c.text)
    assert.deepEqual(
      { intent: got.intent, needsScope: got.needsScope, scope: got.scope?.key ?? null },
      { intent: c.intent, needsScope: c.needsScope, scope: c.scope },
      c.why,
    )
  })
}

test('⑦ 불변식 — GENERAL 은 범위·되묻기 없음, needsScope 면 scope 없음, 기록 의도만 needsScope', () => {
  for (const c of ASK_INTENT_CASES) {
    const g = classifyIntent(c.text)
    if (g.intent === 'GENERAL') assert.deepEqual([g.needsScope, g.scope], [false, null], c.text)
    if (g.needsScope) assert.equal(g.scope, null, c.text)
  }
})

test('⑦ 빈 글·공백·비문자열은 GENERAL(조회 없음)', () => {
  for (const t of ['', '   ', '\n\t', undefined as unknown as string, 3 as unknown as string]) {
    assert.deepEqual(classifyIntent(t), { intent: 'GENERAL', needsScope: false, scope: null, basedOnPrev: false })
  }
})

test('⑦ 1,000자 넘는 글도 앞 1,000자만 보고 분류한다(길이로 느려지지 않음)', () => {
  const long = `이번 주 진도 ${'가'.repeat(5000)} 차이`
  assert.equal(classifyIntent(long).intent, 'PROGRESS')
})

// ── ⑧ 되묻기 칩 답 결합 ─────────────────────────────────────────────────────

test('⑧ 칩 답 — 직전 질문의 의도 + 칩 범위, needsScope 해제', () => {
  assert.deepEqual(classifyIntent('이번 주', { prevUserText: '내가 자주 틀린 조사 알려줘', scopeKey: 'THIS_WEEK' }), { intent: 'EXPRESSION', needsScope: false, scope: { key: 'THIS_WEEK' }, basedOnPrev: true })
  assert.deepEqual(classifyIntent('전체 기간', { prevUserText: '내 진도 어때?', scopeKey: 'ALL' }), { intent: 'PROGRESS', needsScope: false, scope: { key: 'ALL' }, basedOnPrev: true })
  assert.deepEqual(classifyIntent('지난 30일', { prevUserText: '내가 자주 틀리는 조사 설명해 줘', scopeKey: 'LAST_30D' }), { intent: 'MIXED', needsScope: false, scope: { key: 'LAST_30D' }, basedOnPrev: true })
})

test('⑧ 칩 글자로 분류하지 않는다 — 칩 글이 무엇이든 직전 질문의 의도', () => {
  assert.equal(classifyIntent('〜ている 차이 뜻 일본어로', { prevUserText: '내 진도 어때?', scopeKey: 'ALL' }).intent, 'PROGRESS')
  assert.equal(classifyIntent('', { prevUserText: '내가 틀린 문장들 다 보여줘', scopeKey: 'THIS_WEEK' }).intent, 'EXPRESSION')
})

test('⑧ 칩 범위가 계약 밖 값이면 무시하고 글을 그대로 분류', () => {
  assert.deepEqual(classifyIntent('복습 뭐 남았어?', { prevUserText: '내 진도 어때?', scopeKey: 'YESTERDAY' }), { intent: 'PROGRESS', needsScope: false, scope: null, basedOnPrev: false })
  assert.deepEqual(classifyIntent('내 진도 어때?', { scopeKey: '__proto__' }), { intent: 'PROGRESS', needsScope: true, scope: null, basedOnPrev: false })
})

test('⑧ 칩 답인데 직전 질문이 없으면 글을 분류하고 칩 범위를 붙인다', () => {
  assert.deepEqual(classifyIntent('내가 틀린 문장들 다 보여줘', { scopeKey: 'LAST_30D' }), { intent: 'EXPRESSION', needsScope: false, scope: { key: 'LAST_30D' }, basedOnPrev: false })
})

test('⑧ 직전 질문이 GENERAL 이면 칩 범위가 와도 GENERAL(조회 없음)', () => {
  assert.deepEqual(classifyIntent('이번 주', { prevUserText: '〜ている 와 〜てある 차이가 뭐예요?', scopeKey: 'THIS_WEEK' }), { intent: 'GENERAL', needsScope: false, scope: null, basedOnPrev: true })
})

test('⑧ 「직접 쓸게요」 글 답 — 기간만 쓴 짧은 답은 직전 질문 의도에 그 기간을 붙인다', () => {
  assert.deepEqual(classifyIntent('지난주', { prevUserText: '내가 자주 틀린 조사 알려줘' }), { intent: 'EXPRESSION', needsScope: false, scope: { key: 'LAST_30D' }, basedOnPrev: true })
  assert.deepEqual(classifyIntent('전체로 봐 줘', { prevUserText: '내 진도 어때?' }), { intent: 'PROGRESS', needsScope: false, scope: { key: 'ALL' }, basedOnPrev: true })
  assert.deepEqual(classifyIntent('이번 주요', { prevUserText: '내가 틀린 문장들 다 보여줘' }), { intent: 'EXPRESSION', needsScope: false, scope: { key: 'THIS_WEEK' }, basedOnPrev: true })
})

test('⑧ 직전 질문이 있어도 새 질문(자기 신호가 있는 글)은 그 글로 분류', () => {
  assert.equal(classifyIntent('〜ている 뜻이 뭐야?', { prevUserText: '내가 자주 틀린 조사 알려줘' }).intent, 'GENERAL')
  assert.deepEqual(classifyIntent('복습 뭐 남았어?', { prevUserText: '내가 자주 틀린 조사 알려줘' }), { intent: 'PROGRESS', needsScope: false, scope: null, basedOnPrev: false })
  assert.deepEqual(classifyIntent('안녕하세요', { prevUserText: '내가 자주 틀린 조사 알려줘' }), { intent: 'MIXED', needsScope: false, scope: null, basedOnPrev: false }, '기간 단서 없는 글은 결합하지 않는다')
})

test('⑧ 긴 글은 기간어가 들어 있어도 직전 질문에 결합하지 않는다(기간만 쓴 짧은 답만)', () => {
  const long = '지난주에 우리 가족이랑 같이 여행을 다녀왔는데 정말 재미있었어요'
  assert.deepEqual(classifyIntent(long, { prevUserText: '내가 자주 틀린 조사 알려줘' }), { intent: 'MIXED', needsScope: false, scope: { key: 'LAST_30D' }, basedOnPrev: false }, '직전 질문의 EXPRESSION 이 아니라 이 글 자체(신호 없음 = 애매 MIXED)')
})

test('⑧ basedOnPrev — 직전 질문을 이어받은 때만 true, classifiedQuestion 이 검색어를 뽑을 글을 고른다', () => {
  const prev = '「お会計」 정리해서 내가 틀린 거 보여줘'
  const chip = classifyIntent('이번 주', { prevUserText: prev, scopeKey: 'THIS_WEEK' })
  assert.equal(chip.basedOnPrev, true)
  assert.equal(classifiedQuestion(chip, '이번 주', prev), prev)
  const reply = classifyIntent('지난주', { prevUserText: '내가 자주 틀린 조사 알려줘' })
  assert.equal(reply.basedOnPrev, true)
  assert.equal(classifiedQuestion(reply, '지난주', '내가 자주 틀린 조사 알려줘'), '내가 자주 틀린 조사 알려줘')
  const fresh = classifyIntent('복습 뭐 남았어?', { prevUserText: prev })
  assert.equal(fresh.basedOnPrev, false)
  assert.equal(classifiedQuestion(fresh, '복습 뭐 남았어?', prev), '복습 뭐 남았어?')
  assert.equal(classifiedQuestion({ basedOnPrev: true }, '이번 주', undefined), '이번 주', '직전 질문 글이 없으면 이번 글')
  assert.equal(classifiedQuestion({ basedOnPrev: true }, '이번 주', '   '), '이번 주')
  assert.equal(classifiedQuestion({ basedOnPrev: false }, 3 as unknown as string, 'x'), '')
  assert.deepEqual(extractSearchTerms(classifiedQuestion(chip, '이번 주', prev)), ['お会計'], '검색어는 직전 질문에서')
  assert.deepEqual(extractSearchTerms('이번 주'), [], '칩 글자에서는 뽑을 게 없다 — 그래서 basedOnPrev 가 필요하다')
})

// ── 검색어 ──────────────────────────────────────────────────────────────────

test('검색어 — 따옴표 안 말·일본어 덩어리(가나 2자 이상·한자), 한 글자 가나는 버림, 최대 3개', () => {
  assert.deepEqual(extractSearchTerms('저번에 고쳐 준 に/で 뭐였지?'), [])
  assert.deepEqual(extractSearchTerms('「お会計」 뜻이 뭐였지?'), ['お会計'])
  assert.deepEqual(extractSearchTerms('〜ている 와 〜てある 차이'), ['ている', 'てある'])
  assert.deepEqual(extractSearchTerms('食べてみる랑 食べておく'), ['食べてみる', '食べておく'])
  assert.deepEqual(extractSearchTerms('駅 에서 쓰던 표현'), ['駅'])
  assert.deepEqual(extractSearchTerms('‘잘 먹겠습니다’를 일본어로'), ['잘 먹겠습니다'])
  assert.deepEqual(extractSearchTerms('あいう かきく さしす たちつ'), ['あいう', 'かきく', 'さしす'])
  assert.deepEqual(extractSearchTerms('ｶﾀｶﾅ 반각'), ['カタカナ'], 'NFKC')
  assert.deepEqual(extractSearchTerms(`「${'あ'.repeat(40)}」`), ['あ'.repeat(20)])
  assert.deepEqual(extractSearchTerms('「%」 이번 주 진도'), [])
  assert.deepEqual(extractSearchTerms(''), [])
  assert.deepEqual(extractSearchTerms(undefined as unknown as string), [])
})
