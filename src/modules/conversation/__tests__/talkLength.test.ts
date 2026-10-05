/**
 * task-024(IMP-0010, talk@v4) — 응답 길이 상황별 회귀(결정적 부분만). 모델 출력 분포는 `tests/live/talk-length-measure.ts` 가 잰다.
 * 여기서 잠그는 것: ① 픽스처 형태(4 장면 이상) ② 상한(sceneCap)이 프롬프트에 치환되고 범위 밖 값은 정리 ③ persona(→ --system-prompt)는
 * 상한이 달라도 바이트 동일(예열 프로세스 재사용) ④ 사용자 프롬프트 ≤3,000자(전 상한·최악 조합) ⑤ 후검증 허용 문장 수 = 상한 + 허용치
 * ⑥ 프롬프트에 speaker/model/pitch 지시 없음·"2문장" 고정 문구가 persona(TALK) 에 남지 않음.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../engine/llm'
import { countJaSentences } from '../structuredResponse/checks'
import type { TutorResponse } from '../structuredResponse/schemas'
import {
  buildTalkRequest,
  clampSceneCap,
  replyJaInstructionLine,
  talkInstruction,
  CORRECTION_MODES,
  TALK_SCENE_CAP_DEFAULT,
  TALK_SCENE_CAP_MAX,
  TALK_SCENE_CAP_MIN,
  TALK_SCENE_CAP_TOLERANCE,
  TALK_USER_PROMPT_CAP,
} from '../prompts/talk'

interface LengthItem {
  id: string
  scene: 'SHORT' | 'EXPLAIN' | 'ASK_BACK' | 'CORRECTION'
  level: string
  sceneCap: number
  input: string
  history: { role: 'user' | 'assistant'; content: string }[]
  hasError: boolean
  expect: { sentences: { min: number; max: number }; hasQuestion?: boolean; correctionRequired?: boolean }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-length.json'), 'utf8')) as {
  sceneCaps: Record<string, number>
  items: LengthItem[]
}
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const longHistory = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `メッセージ${i} `.repeat(30) }))

const resp = (replyJa: string, correction: TutorResponse['correction'] = null): TutorResponse =>
  ({
    speech: { style: 'NEUTRAL' },
    conversation: { replyJa, replyKo: 'x' },
    correction,
    learning: { grammarPoint: null, difficulty: 'N5' },
    endOfTopic: false,
    proposals: [],
  }) as unknown as TutorResponse

test('픽스처: 네 장면(짧은 대꾸·설명·되묻기·교정)이 모두 있고 상한이 허용 범위 안이다', () => {
  const scenes = new Set(fixture.items.map((x) => x.scene))
  for (const sc of ['SHORT', 'EXPLAIN', 'ASK_BACK', 'CORRECTION']) assert.ok(scenes.has(sc as LengthItem['scene']), `${sc} 장면 누락`)
  assert.ok(fixture.items.length >= 12)
  assert.equal(new Set(fixture.items.map((x) => x.id)).size, fixture.items.length, 'id 중복')
  for (const it of fixture.items) {
    assert.ok(Number.isInteger(it.sceneCap) && it.sceneCap >= TALK_SCENE_CAP_MIN && it.sceneCap <= TALK_SCENE_CAP_MAX, `${it.id}: sceneCap ${it.sceneCap}`)
    assert.equal(it.sceneCap, fixture.sceneCaps[it.scene], `${it.id}: 장면 상한 표와 일치`)
    assert.ok(it.expect.sentences.min >= 1 && it.expect.sentences.max <= it.sceneCap, `${it.id}: 기대 문장 수는 상한 안`)
    if (it.scene === 'CORRECTION') assert.equal(it.hasError && it.expect.correctionRequired, true)
  }
})

test('clampSceneCap: 기본 2, 범위 1~4, 비정수는 내림, 비정상 값은 기본값', () => {
  assert.equal(clampSceneCap(undefined), TALK_SCENE_CAP_DEFAULT)
  assert.equal(clampSceneCap(null), TALK_SCENE_CAP_DEFAULT)
  assert.equal(clampSceneCap(Number.NaN), TALK_SCENE_CAP_DEFAULT)
  assert.equal(clampSceneCap(Number.POSITIVE_INFINITY), TALK_SCENE_CAP_DEFAULT)
  assert.equal(clampSceneCap(0), TALK_SCENE_CAP_MIN)
  assert.equal(clampSceneCap(-3), TALK_SCENE_CAP_MIN)
  assert.equal(clampSceneCap(9), TALK_SCENE_CAP_MAX)
  assert.equal(clampSceneCap(2.9), 2)
  assert.equal(clampSceneCap(3), 3)
})

test('지시문: 상한이 replyJa 줄에 치환되고, 기본(생략)은 2문장 — v3 와 같은 상한', () => {
  assert.ok(replyJaInstructionLine(4).includes('**최대 4문장**'))
  assert.ok(replyJaInstructionLine(3).includes('**최대 3문장**'))
  assert.ok(replyJaInstructionLine(2).includes('**최대 2문장**'))
  assert.ok(replyJaInstructionLine(1).includes('**1문장**') && !replyJaInstructionLine(1).includes('최대'))
  assert.equal(replyJaInstructionLine(), replyJaInstructionLine(TALK_SCENE_CAP_DEFAULT))
  assert.equal(replyJaInstructionLine(99), replyJaInstructionLine(TALK_SCENE_CAP_MAX), '범위 밖은 정리')
  assert.ok(talkInstruction('FLUENCY', 4).includes('최대 4문장'))
  assert.equal(talkInstruction('FLUENCY'), talkInstruction('FLUENCY', TALK_SCENE_CAP_DEFAULT))
})

test('지시문: 상한별 3단 — cap 2 는 v3 구조(맞장구/직답 → 질문 한 문장)+응대 이어 가기, cap 3~4 는 상황 판단 기준까지', () => {
  for (const cap of [2, 3, 4]) {
    const instr = talkInstruction('FLUENCY', cap)
    assert.ok(instr.includes('짧은 직답') && instr.includes('아주 짧은 맞장구'), 'TTFA: 첫 문장은 짧게 — 맞장구 또는 짧은 직답')
    assert.ok(instr.includes('질문은 한 번에 하나'))
    assert.ok(instr.includes('포인트카드') && instr.includes('かしこまりました'), '응대 상황: 대답만 받고 끝내지 않고 다음 물음으로 이어 감(IMP-0010 예시)')
    assert.ok(instr.includes('。！？로 끝나는 단위'), '문장 셈법을 못 박는다')
    assert.ok(instr.includes('교정 설명') && instr.includes('replyJa 에 넣지 않습니다'))
    assert.ok(instr.includes('speech → conversation'))
  }
  // cap 2 는 v3 처럼 좁게 — "상황별로 늘려도 된다" 문구는 cap 3 이상에만(실측: 섞으면 인사·맞장구에서 3문장·질문 2개로 넘침)
  const two = replyJaInstructionLine(2)
  assert.ok(two.includes('대화를 잇는 질문 한 문장') && !two.includes('상한을 채우려고') && !two.includes('뜻이 애매하면 되묻기'))
  for (const cap of [3, 4]) {
    const wide = replyJaInstructionLine(cap)
    assert.ok(wide.includes('상한을 채우려고 늘리지 말고') && wide.includes('뜻이 애매하면 되묻기') && wide.includes('설명이 필요하면 답을 충분히'))
  }
})

test('픽스처 12건 × 상한: 사용자 프롬프트 ≤3,000자·이번 발화 원문 보존·상한 치환', () => {
  for (const it of fixture.items) {
    const req = buildTalkRequest({ todayKst: '2026-09-30', learner: { ...learner, level: it.level }, history: it.history, text: it.input, sceneCap: it.sceneCap })
    const prompt = renderTranscript(req.system, req.messages)
    assert.ok(prompt.length <= TALK_USER_PROMPT_CAP, `${it.id}: ${prompt.length}자`)
    assert.equal(req.messages.at(-1)!.content, it.input)
    assert.ok(req.system.includes(it.sceneCap === 1 ? '**1문장**' : `**최대 ${it.sceneCap}문장**`), `${it.id}: 상한 치환`)
    assert.equal(req.task, 'talk')
    console.info(`[talk-length] ${it.id} ${it.scene} cap=${it.sceneCap} prompt=${prompt.length}자`)
  }
})

test('예산: 전 상한(1~4) × 두 교정 모드 × 최악 조합(무거운 헤더·altText 중간 길이 포함·긴 이력) 모두 ≤3,000자', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(20), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  for (let cap = TALK_SCENE_CAP_MIN; cap <= TALK_SCENE_CAP_MAX; cap++) {
    for (const correctionMode of CORRECTION_MODES) {
      for (const textLen of [1, 20, 500, 1_000]) {
        for (const altLen of [60, 201, 5_000]) {
          const req = buildTalkRequest({ todayKst: '2026-09-30', learner: heavy, history: longHistory, text: 'あ'.repeat(textLen), altText: 'い'.repeat(altLen), correctionMode, sceneCap: cap })
          const prompt = renderTranscript(req.system, req.messages)
          assert.ok(prompt.length <= TALK_USER_PROMPT_CAP, `cap=${cap} mode=${correctionMode} text=${textLen} alt=${altLen}: ${prompt.length}자`)
        }
      }
    }
  }
})

test('persona(→ --system-prompt)는 상한이 달라도 바이트 동일, 그리고 TALK persona 에 고정 "2문장" 문구가 남지 않는다', () => {
  const personas = [1, 2, 3, 4, undefined].map((sceneCap) => buildTalkRequest({ todayKst: '2026-09-30', learner, history: [], text: 'おはよう', sceneCap }).persona!.prompt)
  for (const p of personas) assert.equal(p, personas[0])
  assert.ok(!personas[0].includes('2문장'), 'TALK persona(절 1·3·4·6)에 "2문장" 고정 문구가 남으면 [지시] 상한과 충돌한다')
  assert.ok(!personas[0].includes('[지시]') || personas[0].includes('상한'), '상한은 [지시] 줄이 정한다는 참조')
})

test('후검증: replyJa 허용 문장 수 = 상한 + 허용치(v3 호환 — 기본 2 → 3 초과에서만 위반)', () => {
  const s = (n: number) => Array.from({ length: n }, (_, i) => `文${i}です。`).join('')
  assert.equal(TALK_SCENE_CAP_TOLERANCE, 1)
  for (const cap of [1, 2, 3, 4]) {
    const req = buildTalkRequest({ todayKst: '2026-09-30', learner, history: [], text: 'こんにちは。', sceneCap: cap })
    const check = req.extraCheck!
    assert.deepEqual(check(resp(s(cap + TALK_SCENE_CAP_TOLERANCE))), [], `cap=${cap}: ${cap + TALK_SCENE_CAP_TOLERANCE}문장은 허용`)
    assert.equal(check(resp(s(cap + TALK_SCENE_CAP_TOLERANCE + 1))).length, 1, `cap=${cap}: ${cap + TALK_SCENE_CAP_TOLERANCE + 1}문장은 위반`)
  }
  assert.equal(countJaSentences(s(4)), 4)
  // 기본(생략) = 2 → 3문장 허용·4문장 위반: v3 의 REPLY_SENTENCE_HARD_CAP(3) 와 동일
  const dflt = buildTalkRequest({ todayKst: '2026-09-30', learner, history: [], text: 'こんにちは。' }).extraCheck!
  assert.deepEqual(dflt(resp(s(3))), [])
  assert.equal(dflt(resp(s(4))).length, 1)
})

test('원문 무수정 검사는 상한과 무관하게 유지: original 이 입력과 다르면 위반', () => {
  const req = buildTalkRequest({ todayKst: '2026-09-30', learner, history: [], text: '昨日友だちを会いました', sceneCap: 4 })
  const bad = resp('そうですか。', { required: true, original: '昨日友だちに会いました', corrected: '昨日友だちに会いました', explanationKo: 'x', errorType: 'PARTICLE', severity: 'MINOR', chunkType: '動', hintKo: null } as never)
  assert.ok(req.extraCheck!(bad).some((m) => m.includes('correction.original')))
})

test('프롬프트(system)에 speaker/model/pitch 지시나 엔진명이 없다', () => {
  for (const cap of [1, 2, 3, 4]) {
    const { system } = buildTalkRequest({ todayKst: '2026-09-30', learner, history: [], text: 'おはよう', sceneCap: cap })
    for (const bad of ['speaker_id', 'model_id', 'styleWeight', 'pitch', 'reazon', 'whisper', 'style-bert', 'connectionId']) {
      assert.ok(!system.toLowerCase().includes(bad.toLowerCase()), `system 에 ${bad}`)
    }
  }
})
