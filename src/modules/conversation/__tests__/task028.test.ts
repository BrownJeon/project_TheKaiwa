/**
 * task-028(IMP-0020·IMP-0022) — A1 회화(TALK) 응답 ① `conversation.replyKo`(번역)의 자연스러운 존댓말·이중 높임 금지
 * ② `correction.explanationKo`를 학습자 기존 JLPT 레벨에 맞춘 쉬운 한국어. 재현(2026-10-03, traceId
 * `t_rApoXn51DLgsUlR4OfBD`): 일본어는 정상(「ビニール袋をお付けします」)인데 번역이 「비닐봉투를 드려드리겠습니다」
 * (이중 높임 비문)로 나왔다. DB·LLM 은 쓰지 않는다(프롬프트 문자열·후검증 함수만 — 실 CLI 표본은 live 측정 스크립트).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../engine/llm'
import { checkReplyKoNaturalness, checkTalkResponse } from '../structuredResponse/checks'
import type { TutorResponse } from '../structuredResponse/schemas'
import { buildTalkRequest, replyJaInstructionLine, talkInstruction, TALK_USER_PROMPT_CAP } from '../prompts/talk'

interface TranslationItem {
  id: string
  replyJa: string
  bad: string
  good: string[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-translation.json'), 'utf8')) as { items: TranslationItem[] }
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const resp = (replyKo: string): TutorResponse =>
  ({
    speech: { style: 'NEUTRAL' },
    conversation: { replyJa: 'x', replyKo },
    correction: null,
    learning: { grammarPoint: null, difficulty: 'N5' },
    endOfTopic: false,
    proposals: [],
  }) as unknown as TutorResponse

// ── ① 지시문: replyKo 자연스러운 존댓말·이중 높임 금지 ──────────────────────

test('지시문: replyJaInstructionLine 의 tail 이 replyKo 에 자연스러운 존댓말·이중 높임 금지를 지시한다(모든 사용 상한에서)', () => {
  for (const cap of [1, 2, 3, 4]) {
    const instr = replyJaInstructionLine(cap)
    assert.ok(instr.includes('replyKo'))
    assert.ok(instr.includes('존댓말'), `cap=${cap}: 존댓말 번역 지시가 있어야 한다`)
    assert.ok(instr.includes('이중 높임'), `cap=${cap}: 이중 높임 금지 지시가 있어야 한다`)
  }
})

// ── ② 픽스처 5건 — bad(이중 높임)는 후검증에 걸리고, good(정답 고정 없음)은 걸리지 않는다 ──

test('픽스처는 5건(お付けします·お渡しします·お持ちします·ご案内します 계열), bad 는 전부 이중 높임 패턴을 포함', () => {
  assert.equal(fixture.items.length, 5)
  for (const it of fixture.items) {
    assert.ok(it.good.length >= 1, `${it.id}: good 후보가 1건 이상이어야 한다(정답 고정 없음)`)
  }
})

test('checkReplyKoNaturalness: 픽스처 bad 5건 전부 위반, good 전부(1건 이상씩) 통과', () => {
  for (const it of fixture.items) {
    const violations = checkReplyKoNaturalness(it.bad)
    assert.equal(violations.length, 1, `${it.id}: bad "${it.bad}" 는 이중 높임으로 걸려야 한다`)
    assert.ok(violations[0].includes('이중 높임'))
    for (const g of it.good) {
      assert.deepEqual(checkReplyKoNaturalness(g), [], `${it.id}: good "${g}" 는 걸리면 안 된다`)
    }
  }
})

test('checkReplyKoNaturalness: 정상 겸양("말씀드립니다"·"드려요"처럼 드리가 한 번만)은 걸리지 않는다', () => {
  assert.deepEqual(checkReplyKoNaturalness('말씀드립니다.'), [])
  assert.deepEqual(checkReplyKoNaturalness('이따 연락 드려요.'), [])
  assert.deepEqual(checkReplyKoNaturalness('나중에 다시 말씀드릴게요.'), [])
})

test('buildTalkRequest.extraCheck: 픽스처 bad replyKo 는 TALK 응답 전체 검사에서도 위반으로 잡힌다(checkTalkResponse + checkReplyKoNaturalness 합성)', () => {
  const req = buildTalkRequest({ todayKst: '2026-10-03', learner, history: [], text: 'ビニール袋お願いします' })
  for (const it of fixture.items) {
    const violations = req.extraCheck!(resp(it.bad))
    assert.ok(violations.some((m) => m.includes('이중 높임')), `${it.id}: extraCheck 가 이중 높임을 잡아야 한다`)
  }
  // good 은(원문 교정이 없는 응답이라 correction.original 검사는 걸리지 않음) 이중 높임 위반이 없어야 한다
  const okViolations = req.extraCheck!(resp(fixture.items[0].good[0]))
  assert.ok(!okViolations.some((m) => m.includes('이중 높임')))
})

// ── ③ explanationKo 수준별 쉬운 한국어 ────────────────────────────────

test('지시문: explanationKo — N5·N4 는 "문법 용어는 쓰지 않습니다" 지시가 붙고, N3 이상은 붙지 않는다', () => {
  for (const level of ['N5', 'N4']) {
    const instr = talkInstruction('FLUENCY', 2, level)
    assert.ok(instr.includes('문법 용어는 쓰지 않습니다'), `level=${level}: 쉬운 말 지시가 있어야 한다`)
    assert.ok(instr.includes('쉬운 말로'))
  }
  for (const level of ['N3', 'N2', 'N1']) {
    const instr = talkInstruction('FLUENCY', 2, level)
    assert.ok(!instr.includes('문법 용어는 쓰지 않습니다'), `level=${level}: 쉬운 말 지시가 없어야 한다`)
  }
  // 레벨을 생략하면 기본값 N5(쉬운 말 지시 있음) — 호환을 위해 보수적으로 쉬운 쪽을 기본으로 한다.
  assert.equal(talkInstruction('FLUENCY', 2), talkInstruction('FLUENCY', 2, 'N5'))
})

test('지시문: explanationKo — 일본어 인용은 고친 조각만(레벨과 무관, COACH·FLUENCY 공통)', () => {
  for (const mode of ['FLUENCY', 'COACH'] as const) {
    for (const level of ['N5', 'N1']) {
      const instr = talkInstruction(mode, 2, level)
      assert.ok(instr.includes('일본어 인용은 고친 조각만'), `mode=${mode} level=${level}`)
    }
  }
})

test('buildTalkRequest: 학습자 level 이 explanationKo 지시에 그대로 치환된다(헤더의 level 과 같은 값, 새 설정 없음)', () => {
  const n5 = buildTalkRequest({ todayKst: '2026-10-03', learner: { ...learner, level: 'N5' }, history: [], text: 'おはよう' })
  const n1 = buildTalkRequest({ todayKst: '2026-10-03', learner: { ...learner, level: 'N1' }, history: [], text: 'おはよう' })
  assert.ok(n5.system.includes('문법 용어는 쓰지 않습니다'))
  assert.ok(!n1.system.includes('문법 용어는 쓰지 않습니다'))
})

// ── ④ 예산·불변식 회귀 ─────────────────────────────────────────────────

test('예산: talk@v6 변경 후에도 전 상한(1~4) × 두 교정 모드 × 최악 조합(무거운 헤더·altText·긴 이력) ≤3,000자', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(20), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const longHistory = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `メッセージ${i} `.repeat(30) }))
  for (const cap of [1, 2, 3, 4]) {
    for (const correctionMode of ['FLUENCY', 'COACH'] as const) {
      for (const level of ['N5', 'N1']) {
        for (const textLen of [1, 1_000]) {
          for (const altLen of [60, 201, 5_000]) {
            const req = buildTalkRequest({
              todayKst: '2026-10-03',
              learner: { ...heavy, level },
              history: longHistory,
              text: 'あ'.repeat(textLen),
              altText: 'い'.repeat(altLen),
              correctionMode,
              sceneCap: cap,
            })
            const prompt = renderTranscript(req.system, req.messages)
            assert.ok(prompt.length <= TALK_USER_PROMPT_CAP, `cap=${cap} mode=${correctionMode} level=${level} text=${textLen} alt=${altLen}: ${prompt.length}자`)
          }
        }
      }
    }
  }
})

test('원문 무수정·CHAT 비범위: checkReplyKoNaturalness 는 checkTalkResponse 에 섞이지 않는다(CHAT 영향 없음 — buildTalkRequest 의 extraCheck 에서만 합성)', () => {
  // checkTalkResponse 자체(=checkChatResponse 가 호출하는 함수)는 이중 높임을 보지 않는다 — task-028 은 TALK 전용이라
  // CHAT(A2)에 이 검사가 새어 들어가면 안 된다(비범위, Leader 결정).
  const bad = resp('비닐봉투를 드려드리겠습니다.')
  assert.deepEqual(checkTalkResponse('x', bad), [], 'checkTalkResponse 단독으로는 이중 높임을 잡지 않는다(TALK 전용 추가 검사는 buildTalkRequest 쪽)')
})
