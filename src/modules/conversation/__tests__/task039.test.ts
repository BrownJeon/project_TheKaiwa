import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractAndValidate, validateOutput } from '../../engine/json/schemaValidate'
import { renderTranscript } from '../../engine/llm'
import { loadPersona, resetPersonaCache } from '../persona/loader'
import { shapeTurnResponse } from '../orchestrator/shape'
import { buildChatRequest, CHAT_PROMPT_VERSION } from '../prompts/chat'
import { buildChatReviewRequest, CHAT_REVIEW_PROMPT_VERSION } from '../prompts/chatReview'
import { buildLessonRequest, LESSON_PROMPT_VERSION } from '../prompts/lesson'
import { buildTalkRequest, CORRECTION_MODES, EXTRA_NOTE_LINE, talkInstruction, TALK_PROMPT_VERSION, TALK_USER_PROMPT_CAP } from '../prompts/talk'
import { checkChatReview, checkTalkResponse, EXTRA_NOTE_STORE_MAX, sanitizeExtraNoteKo } from '../structuredResponse/checks'
import { CHAT_REVIEW_SCHEMA, CHAT_SCHEMA, EXTRA_NOTE_PROMPT_MAX, TALK_SCHEMA, type ChatReviewResponse, type TutorResponse } from '../structuredResponse/schemas'
import { flagsOf, verdictOf } from '../../../../tests/live/task039-style-classify'

// task-039(IMP-0025 방안 B) — 응답·교정은 일상 회화 중심, JLPT 식 설명은 `correction.extraNoteKo`(추가 설명). 이 파일은 **오프라인 계약 회귀**다(프롬프트 문자열·스키마·후검증·정리 함수·persona·
// 픽스처·판정 사전). 실 LLM 효과 측정은 `tests/live/task039-explain-ab.ts`·`task039-review-lesson-ab.ts`(이력서 "Prompt-Engineer 기록"). 문장은 전부 합성이다.

const INPUT = '家に帰るたら、電話します'
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)'], streakDays: 4 }
const ok: TutorResponse = {
  conversation: { replyJa: 'そうですか。誰に電話しますか？', replyKo: '그래요? 누구한테 전화해요?' },
  correction: {
    required: true, original: INPUT, corrected: '家に帰ったら、電話します', explanationKo: '「帰るたら」는 붙지 않아요. 「帰ったら」(돌아가면)라고 말해요.',
    errorType: 'CONJUGATION', severity: 'MINOR', chunkType: 'ACTION', hintKo: null, extraNoteKo: '〜たら(N4): 동사 た형+ら',
  },
  learning: { grammarPoint: '〜たら(조건)', difficulty: 'N4' },
  speech: { style: 'NEUTRAL' },
  endOfTopic: false,
  proposals: [],
  userKo: '집에 돌아가면 전화할게요.',
}

// ── 버전·이름 일치(A5·A11 교훈: 지시·스키마·타입·테스트가 같은 이름) ─────────────────────────────

test('task-039: 버전 — talk@v9·chat@v4·chatReview@v3(v2 = 일상 쓰임 중심 설명, v3 = 추가 설명 칸 extra_note_ko)', () => {
  assert.equal(TALK_PROMPT_VERSION, 'talk@v9')
  assert.equal(CHAT_PROMPT_VERSION, 'chat@v4')
  assert.equal(CHAT_REVIEW_PROMPT_VERSION, 'chatReview@v3')
})

test('task-039: TALK 지시 — 모든 모드·상한·수준에서 extraNoteKo 를 정확한 이름으로 한 번 지시하고(스키마 property 와 같은 이름), 메인 설명은 문법 용어·급수·문형 이름 금지', () => {
  assert.ok(EXTRA_NOTE_LINE.includes('extraNoteKo') && EXTRA_NOTE_LINE.includes(`${EXTRA_NOTE_PROMPT_MAX}자`) && EXTRA_NOTE_LINE.includes('null'))
  const props = Object.keys((TALK_SCHEMA.properties.correction.anyOf[1] as { properties: object }).properties)
  assert.ok(props.includes('extraNoteKo'), '스키마 correction.properties 에 같은 이름')
  for (const mode of CORRECTION_MODES) {
    for (const cap of [1, 2, 3, 4]) {
      for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
        const instr = talkInstruction(mode, cap, level)
        assert.equal(instr.split('extraNoteKo').length - 1, 1, `${mode}/${cap}/${level}: 지시문에 extraNoteKo 한 번`)
        assert.ok(instr.includes('문법 용어(て형 등)·급수·문형 이름은 쓰지 않습니다'), `${mode}/${cap}/${level}: 메인 설명 금지어`)
        assert.ok(instr.includes('고친 말을 일상에서 어떻게 쓰는지만') && instr.includes('(80자 이내)'), `${mode}/${cap}/${level}: 메인 설명은 일상 쓰임 중심·80자`)
        assert.ok(instr.includes('learning.grammarPoint 는 이번 턴 표현의 쓰임 이름'), `${mode}/${cap}/${level}: grammarPoint 는 쓰임 이름`)
      }
    }
  }
})

test('task-039: 기존 지시는 그대로 — N5·N4 는 "쉬운 말로", 원문 전체 복사·1건만·일본어 인용은 고친 조각만, COACH 힌트 줄, 키 순서 지시는 불변', () => {
  for (const level of ['N5', 'N4']) assert.ok(talkInstruction('FLUENCY', 2, level).includes('쉬운 말로.'), level)
  for (const level of ['N3', 'N2', 'N1']) assert.ok(!talkInstruction('FLUENCY', 2, level).includes('쉬운 말로.'), level)
  const instr = talkInstruction('FLUENCY', 2, 'N5')
  assert.ok(instr.includes('가장 중요한 1건만') && instr.includes('한 글자도 바꾸지 말고 그대로 복사') && instr.includes('일부만 잘라 쓰지 않음') && instr.includes('일본어 인용은 고친 조각만') && instr.includes('hintKo 는 null.'))
  assert.ok(instr.includes('speech → conversation(replyJa→replyKo) → correction → learning → endOfTopic → proposals → userKo'))
  assert.ok(talkInstruction('COACH', 2, 'N5').includes('hintKo=힌트(정답 제외)'))
})

test('task-039: [순서 예] 골격과 키 순서 — 최상위 순서는 불변이고 extraNoteKo 는 최상위 키가 아니다(correction 객체 안·맨 끝)', () => {
  const instr = talkInstruction()
  const skeleton = instr.split('\n').find((l) => l.startsWith('[순서 예]'))!
  const idx = ['"speech"', '"conversation"', '"replyJa"', '"replyKo"', '"correction"', '"learning"', '"endOfTopic"', '"proposals"', '"userKo"'].map((k) => skeleton.indexOf(k))
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, '골격 최상위 키 순서 불변(speech → conversation(replyJa → replyKo) → correction → … → userKo)')
  assert.ok(!idx.includes(-1))
  assert.ok(!Object.keys(TALK_SCHEMA.properties).includes('extraNoteKo' as never), '최상위 properties 에 없다')
  const corrProps = Object.keys((TALK_SCHEMA.properties.correction.anyOf[1] as { properties: object }).properties)
  assert.equal(corrProps.at(-1), 'extraNoteKo', 'correction.properties 선언 순서 맨 끝(hintKo 다음)')
  assert.deepEqual(corrProps.slice(0, -1), ['required', 'original', 'corrected', 'explanationKo', 'errorType', 'severity', 'chunkType', 'hintKo'])
})

// ── 스키마: 선택·null 허용·길이 무제한(이 칸 때문에 재시도·턴 실패가 없다 — REV-086 M3 와 같은 원칙) ───────────

test('task-039: 스키마 — extraNoteKo 는 required 가 아니고 null·누락·빈 문자열·초장문이어도 통과, 문자열이 아닌 값만 위반(옛 응답 호환)', () => {
  const corr = (TALK_SCHEMA.properties.correction.anyOf[1] as { required: readonly string[]; properties: Record<string, unknown> })
  assert.ok(!corr.required.includes('extraNoteKo'), 'required 에 넣지 않는다')
  assert.deepEqual(validateOutput(ok, TALK_SCHEMA), { ok: true })
  assert.deepEqual(validateOutput({ ...ok, correction: { ...ok.correction!, extraNoteKo: null } }, TALK_SCHEMA), { ok: true })
  const { extraNoteKo: _omit, ...rest } = ok.correction!
  void _omit
  assert.deepEqual(validateOutput({ ...ok, correction: rest }, TALK_SCHEMA), { ok: true }, '옛 응답(키 없음)')
  assert.deepEqual(validateOutput({ ...ok, correction: { ...ok.correction!, extraNoteKo: '' } }, TALK_SCHEMA), { ok: true }, '빈 문자열은 스키마가 막지 않는다(정리 함수가 null)')
  assert.deepEqual(validateOutput({ ...ok, correction: { ...ok.correction!, extraNoteKo: '가'.repeat(5_000) } }, TALK_SCHEMA), { ok: true }, '길이 무제한(정리 함수가 null)')
  assert.equal(validateOutput({ ...ok, correction: { ...ok.correction!, extraNoteKo: 3 as unknown as string } }, TALK_SCHEMA).ok, false)
  assert.equal(validateOutput({ ...ok, correction: { ...ok.correction!, extraNoteKo2: 'x' } as never }, TALK_SCHEMA).ok, false, '그 밖의 모르는 키는 여전히 additionalProperties 위반')
})

test('task-039: CHAT 계약은 불변 — 교정은 항상 null(새 칸이 들어갈 자리가 없다), CHAT 요청 지시·스키마에 extraNoteKo 가 없다', () => {
  assert.equal(validateOutput(ok, CHAT_SCHEMA).ok, false, 'CHAT 은 correction 이 있으면 위반')
  assert.deepEqual(validateOutput({ ...ok, correction: null }, CHAT_SCHEMA), { ok: true })
  const req = buildChatRequest({ todayKst: '2026-10-06', learner, history: [], text: 'おはよう' })
  assert.ok(!req.system.includes('extraNoteKo') && !JSON.stringify(req.jsonSchema).includes('extraNoteKo') && !(req.persona?.prompt ?? '').includes('extraNoteKo'))
  assert.ok(req.system.includes('learning.grammarPoint 는 이번 턴 핵심 표현의 쓰임 이름을 짧게'), 'CHAT 은 grammarPoint 문구만 바뀐다(chat@v4)')
})

// ── 후검증·정리: 재시도 대상 아님, 저장 전 정리만 ────────────────────────────────────────────────

test('task-039: checkTalkResponse — extraNoteKo 는 후검증 대상이 아니다(어떤 값이어도 위반을 더하지 않는다)', () => {
  assert.deepEqual(checkTalkResponse(INPUT, ok), [])
  for (const v of [null, '', '가'.repeat(900), 'English only', ok.correction!.explanationKo]) {
    assert.deepEqual(checkTalkResponse(INPUT, { ...ok, correction: { ...ok.correction!, extraNoteKo: v } }), [], JSON.stringify(v).slice(0, 30))
  }
})

test('task-039: sanitizeExtraNoteKo — 누락·빈 값·상한 초과(자르지 않음)·한글 없음·메인 설명 베끼기·엔진명은 null, 정상 한 줄은 trim 해서 그대로', () => {
  const main = '「帰るたら」는 붙지 않아요.'
  assert.equal(sanitizeExtraNoteKo(main, undefined), null)
  assert.equal(sanitizeExtraNoteKo(main, null), null)
  assert.equal(sanitizeExtraNoteKo(main, 42), null)
  assert.equal(sanitizeExtraNoteKo(main, '   '), null)
  assert.equal(sanitizeExtraNoteKo(main, '〜たら(N4): 동사 た형+ら'), '〜たら(N4): 동사 た형+ら')
  assert.equal(sanitizeExtraNoteKo(main, '  〜たら(N4): 동사 た형+ら \n'), '〜たら(N4): 동사 た형+ら', 'trim')
  const long = `〜たら ${'가'.repeat(EXTRA_NOTE_STORE_MAX)}`
  assert.equal(sanitizeExtraNoteKo(main, long), null, `${EXTRA_NOTE_STORE_MAX}자 초과는 자르지 않고 null`)
  assert.equal(sanitizeExtraNoteKo(main, `가${'나'.repeat(EXTRA_NOTE_STORE_MAX - 1)}`)?.length, EXTRA_NOTE_STORE_MAX, '상한 정확히 일치는 통과')
  assert.equal(sanitizeExtraNoteKo(main, '〜たら: N4 JLPT'), null, '한글이 없으면 null')
  assert.equal(sanitizeExtraNoteKo(main, main), null, '메인 설명과 같으면 null')
  assert.equal(sanitizeExtraNoteKo(main, `${main} 그리고 〜たら`), null, '메인 설명을 통째로 포함하면 null')
  assert.equal(sanitizeExtraNoteKo(main, '이 문형은 claude 가 알려 줬어요'), null, '엔진 이름 노출')
})

// ── 서버: shape 에서 한 번 정리한다(저장 행·SSE done.correction 이 같은 값 — 왕복은 task039server.test.ts) ───────────────

test('task-039: shapeTurnResponse — TALK 교정의 extraNoteKo 는 sanitizeExtraNoteKo(학습자 원문 포함)를 거친 값(string | null), CHAT·원문 불일치 교정은 버린다', () => {
  const shaped = shapeTurnResponse('TALK', INPUT, ok)
  assert.equal(shaped.correction?.extraNoteKo, '〜たら(N4): 동사 た형+ら')
  assert.equal(shaped.correction?.original, INPUT)
  assert.equal(shapeTurnResponse('CHAT', INPUT, ok).correction, null)
  const mismatch = shapeTurnResponse('TALK', '다른 입력', ok)
  assert.equal(mismatch.correction, null)
  assert.equal(mismatch.warning, 'CORRECTION_ORIGINAL_MISMATCH')
  assert.equal(shapeTurnResponse('TALK', INPUT, { ...ok, correction: { ...ok.correction!, extraNoteKo: undefined } }).correction?.extraNoteKo, null, '옛 응답(키 없음)은 null 로 고정')
  assert.equal(shapeTurnResponse('TALK', INPUT, { ...ok, correction: { ...ok.correction!, extraNoteKo: `참고: ${INPUT}` } }).correction?.extraNoteKo, null, '학습자 원문 통째 복사는 null')
})

// ── repairRootClose(task-037) 호환 ───────────────────────────────────────────────────────────────

test('task-039: repairRootClose — 새 칸이 든 응답에서 루트 조기 닫힘 슬립을 복구해도 스키마·extraCheck 를 통과하고, userKo 슬립 모양은 그대로다', () => {
  const { userKo: _u, ...body } = ok
  void _u
  const slip = '```json\n' + JSON.stringify(body) + ',"userKo":"집에 돌아가면 전화할게요."}\n```'
  const req = buildTalkRequest({ todayKst: '2026-10-06', learner, history: [], text: INPUT })
  assert.deepEqual(extractAndValidate(slip, TALK_SCHEMA), { ok: false, parseError: true }, '옵션 없이는 파싱 실패(옛 재시도 경로)')
  const r = extractAndValidate(slip, TALK_SCHEMA, { repairRootClose: req.repairRootClose })
  assert.ok(r.ok && r.repaired === 'ROOT_CLOSE', JSON.stringify(r))
  if (!r.ok) return
  const data = r.data as TutorResponse
  assert.equal(data.correction?.extraNoteKo, '〜たら(N4): 동사 た형+ら')
  assert.equal(data.userKo, '집에 돌아가면 전화할게요.')
  assert.deepEqual(req.extraCheck!(data), [], '복구한 객체도 후검증을 통과한다')
  // 새 칸이 correction 안에서 닫히지 않은 채 끊긴 응답(루트 슬립이 아님)은 복구 대상이 아니다
  const broken = JSON.stringify(body).replace('"extraNoteKo":"〜たら(N4): 동사 た형+ら"}', '"extraNoteKo":"〜たら(N4): 동사 た형+ら"')
  assert.deepEqual(extractAndValidate(broken, TALK_SCHEMA, { repairRootClose: true }), { ok: false, parseError: true })
})

// ── persona: 한 줄 원칙 + TALK 행의 형식 정의, 바이트 불변·예산 ─────────────────────────────────────

test('task-039: persona — §3-9 는 TALK·A3·EVAL_GRADE 가 싣고(필드 이름 없음), extraNoteKo 정의는 TALK 행에만, CHAT 은 §3 을 싣지 않는다', () => {
  resetPersonaCache()
  const talk = loadPersona({ sections: [1, 3, 4, 6], level: 'N4', mode: 'TALK' }).prompt
  const review = loadPersona({ sections: [1, 2, 3, 4, 5, 6, 8], level: 'N4', mode: 'REVIEW' }).prompt
  const evalGrade = loadPersona({ sections: [1, 3, 4, 6], level: 'N4', mode: 'EVAL_GRADE' }).prompt
  const chat = loadPersona({ sections: [1, 2, 4, 6], level: 'N4', mode: 'CHAT' }).prompt
  const lesson = loadPersona({ sections: [1, 2, 4, 5, 6, 8], level: 'N4', mode: 'LESSON' }).prompt
  const rule = '설명은 일상 회화가 메인, JLPT 식은 추가입니다'
  for (const [name, p] of [['TALK', talk], ['REVIEW', review], ['EVAL_GRADE', evalGrade]] as const) assert.ok(p.includes(rule), `${name} persona 에 §3-9`)
  for (const [name, p] of [['CHAT', chat], ['LESSON', lesson]] as const) assert.ok(!p.includes(rule), `${name} persona 는 §3 을 싣지 않는다`)
  // §3-9 본문(절 안)에는 필드 이름이 없다 — 추가 설명 칸이 없는 A3·EVAL_GRADE 가 같은 절을 싣기 때문(이름이 있으면 그 응답이 없는 키를 만든다).
  const section39 = talk.slice(talk.indexOf('9. **설명은 일상 회화가 메인'), talk.indexOf('## 4.'))
  assert.ok(section39.length > 40 && !section39.includes('extraNoteKo'))
  assert.ok(talk.includes('`extraNoteKo`') && talk.includes('「〜ように: 동사 기본형+ように」') && talk.includes('확실할 때만'), 'TALK 행: 필드 이름·형식 예시·확실할 때만')
  for (const [name, p] of [['REVIEW', review], ['EVAL_GRADE', evalGrade], ['CHAT', chat], ['LESSON', lesson]] as const) assert.ok(!p.includes('extraNoteKo') && !p.includes('extra_note_ko'), `${name} persona 에 추가 설명 칸 이름 없음(이름은 지시문에만)`)
})

test('task-039: persona 예산 — TALK 은 모든 수준에서 ≤2,800자, 같은 학습자·수준·모드면 턴이 달라도 바이트 동일(예열 프로세스 재사용 전제)', () => {
  resetPersonaCache()
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    const n = loadPersona({ sections: [1, 3, 4, 6], level, mode: 'TALK' }).prompt.length
    assert.ok(n <= 2_800, `${level}: ${n}자`)
  }
  const a = buildTalkRequest({ todayKst: '2026-10-06', learner, history: [], text: 'おはよう' })
  const b = buildTalkRequest({ todayKst: '2026-10-07', learner: { ...learner, streakDays: 99 }, history: [], text: INPUT, altText: 'x', correctionMode: 'COACH', sceneCap: 4 })
  assert.equal(a.persona!.prompt, b.persona!.prompt)
})

// ── A1 예산(≤3,000자)·A3·A4 문구 ───────────────────────────────────────────────────────────────

test('task-039: A1 예산 — 지시 추가(extraNoteKo·메인 설명·grammarPoint) 후에도 최악 조합(COACH·무거운 헤더·발화 1,000자)이 ≤3,000자 안에 든다', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(20), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const longHistory = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `メッセージ${i} `.repeat(30) }))
  let min = Infinity
  for (const cap of [1, 2, 3, 4]) for (const correctionMode of CORRECTION_MODES) for (const level of ['N5', 'N1']) for (const t of [1, 1_000]) for (const alt of [60, 201]) {
    const req = buildTalkRequest({ todayKst: '2026-10-06', learner: { ...heavy, level }, history: longHistory, text: 'あ'.repeat(t), altText: 'い'.repeat(alt), correctionMode, sceneCap: cap })
    const len = renderTranscript(req.system, req.messages).length
    assert.ok(len <= TALK_USER_PROMPT_CAP, `cap=${cap} ${correctionMode} ${level} t=${t} alt=${alt}: ${len}자`)
    min = Math.min(min, TALK_USER_PROMPT_CAP - len)
  }
  assert.ok(min >= 0)
})

test('task-039: A3 chatReview@v3 — explanation_ko 지시는 v2 그대로(조각 먼저 → 일상 쓰임·급수·문형 이름·활용 용어 금지), 추가 설명 칸 extra_note_ko 는 새 [지시] 줄 하나에 정확한 이름으로 한 번', () => {
  const req = buildChatReviewRequest({ todayKst: '2026-10-06', learner, messages: [{ id: 'm1', text: INPUT }] })
  assert.ok(req.system.includes('일상 대화에서 이렇게 말한다는 쓰임 중심') && req.system.includes('급수·문형 이름·활용 용어는 쓰지 않습니다'))
  // 실측(2차): "어느 조각이 왜 틀렸는지" 한 문장만 있으면 설명에서 조각 언급이 84%(16/19)→0%(0/29)로 사라졌다(persona §3-5 조각 단위 지적) — 첫머리에 조각을 짚으라는 지시가 27/27 로 되살렸다.
  assert.ok(req.system.includes('먼저 어느 조각(이름·액션·느낌·꾸밈)이 틀렸는지 짚고'), 'A3: 첫머리에 틀린 조각을 짚으라는 지시(persona §3-5) — v3 에서도 바꾸지 않는다')
  const lines = req.system.split('\n')
  const explLine = lines.filter((l) => l.includes('explanation_ko 는 한국어로'))
  const extraLine = lines.filter((l) => l.includes('extra_note_ko'))
  assert.equal(explLine.length, 1)
  assert.equal(extraLine.length, 1, '지시문에 extra_note_ko 는 한 줄에 한 번')
  assert.equal(req.system.split('extra_note_ko').length - 1, 1, '이름이 한 번만 나온다')
  assert.ok(!explLine[0].includes('extra_note_ko'), 'explanation_ko 줄은 건드리지 않았다(별도 줄)')
  assert.ok(extraLine[0].startsWith('- extra_note_ko 는 ') && extraLine[0].includes(`${EXTRA_NOTE_PROMPT_MAX}자 이내`) && extraLine[0].includes('확실할 때만') && extraLine[0].includes('null(대부분 null)'), 'TALK 과 같은 의미: 확실할 때만·아니면 null·대부분 null·40자')
  assert.ok(!extraLine[0].includes('extraNoteKo'), 'A3 는 snake_case 이름만(TALK 이름 혼입 금지)')
  assert.ok(!req.system.includes('extraNoteKo') && !JSON.stringify(req.jsonSchema).includes('extraNoteKo'))
  assert.ok(!(req.persona?.prompt ?? '').includes('extra_note_ko') && !(req.persona?.prompt ?? '').includes('extraNoteKo'), 'persona(§3-9 포함)는 필드 이름을 쓰지 않는다 — 이름은 지시문에만')
})

const reviewItem = { message_id: 'm1', original: INPUT, corrected: '家に帰ったら、電話します', explanation_ko: '활용 조각이 틀렸어요. 「帰ったら」라고 말해요.', error_type: 'CONJUGATION', severity: 'MINOR', chunk_type: 'ACTION' } as const
const reviewResp = (items: object[]) => ({ items, summary_ko: '총평', strengths: ['전화 표현'], focus: ['활용'] })

test('task-039: A3 스키마 — extra_note_ko 는 required 가 아니고 null·누락·빈 문자열·초장문이어도 통과, 문자열이 아닌 값·모르는 키만 위반, 선언 순서는 항목 맨 끝', () => {
  const itemSchema = CHAT_REVIEW_SCHEMA.properties.items.items
  assert.ok(!(itemSchema.required as readonly string[]).includes('extra_note_ko'), 'required 에 넣지 않는다')
  assert.deepEqual(Object.keys(itemSchema.properties), ['message_id', 'original', 'corrected', 'explanation_ko', 'error_type', 'severity', 'chunk_type', 'extra_note_ko'], '선언 순서 맨 끝(chunk_type 다음) — 옛 키 순서 불변')
  assert.deepEqual(validateOutput(reviewResp([reviewItem]), CHAT_REVIEW_SCHEMA), { ok: true }, '옛 응답(키 없음)')
  assert.deepEqual(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko: null }]), CHAT_REVIEW_SCHEMA), { ok: true })
  assert.deepEqual(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko: '〜たら(N4): 동사 た형+ら' }]), CHAT_REVIEW_SCHEMA), { ok: true })
  assert.deepEqual(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko: '' }]), CHAT_REVIEW_SCHEMA), { ok: true }, '빈 문자열은 스키마가 막지 않는다(정리 함수가 null)')
  assert.deepEqual(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko: '가'.repeat(5_000) }]), CHAT_REVIEW_SCHEMA), { ok: true }, '길이 무제한(정리 함수가 null)')
  assert.deepEqual(validateOutput(reviewResp([reviewItem, { ...reviewItem, message_id: 'm2', extra_note_ko: null }, { ...reviewItem, message_id: 'm3', extra_note_ko: '〜ように: 동사 기본형+ように' }]), CHAT_REVIEW_SCHEMA), { ok: true }, '항목마다 섞여도 통과')
  assert.equal(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko: 3 }]), CHAT_REVIEW_SCHEMA).ok, false, '문자열이 아닌 값만 위반')
  assert.equal(validateOutput(reviewResp([{ ...reviewItem, extra_note_ko2: 'x' }]), CHAT_REVIEW_SCHEMA).ok, false, '모르는 키는 여전히 additionalProperties 위반')
  assert.equal(validateOutput(reviewResp([{ ...reviewItem, extraNoteKo: 'x' }]), CHAT_REVIEW_SCHEMA).ok, false, 'TALK 이름(카멜)은 A3 항목에서 모르는 키다')
})

test('task-039: A3 후검증·정리 — extra_note_ko 는 checkChatReview 대상이 아니고(어떤 값이어도 위반을 더하지 않음), sanitizeExtraNoteKo(explanation_ko, extra_note_ko) 로 TALK 과 같은 규칙이 걸린다', () => {
  const msgs = [{ id: 'm1', text: INPUT }]
  const withNote = (v: unknown) => ({ ...reviewResp([{ ...reviewItem, extra_note_ko: v }]) }) as unknown as ChatReviewResponse
  assert.deepEqual(checkChatReview(msgs, withNote('〜たら(N4): 동사 た형+ら')), [])
  for (const v of [null, '', '가'.repeat(900), 'English only', reviewItem.explanation_ko]) assert.deepEqual(checkChatReview(msgs, withNote(v)), [], JSON.stringify(v).slice(0, 30))
  const it = (v: unknown) => sanitizeExtraNoteKo(reviewItem.explanation_ko, v)
  assert.equal(it('〜たら(N4): 동사 た형+ら'), '〜たら(N4): 동사 た형+ら')
  assert.equal(it(undefined), null, '누락')
  assert.equal(it(null), null)
  assert.equal(it(`〜たら ${'가'.repeat(EXTRA_NOTE_STORE_MAX)}`), null, '저장 상한 초과는 자르지 않고 null')
  assert.equal(it('〜たら: N4 JLPT'), null, '한글 없음')
  assert.equal(it(reviewItem.explanation_ko), null, '메인 설명 베끼기')
})

// ── 픽스처·판정 사전 ───────────────────────────────────────────────────────────────────────────────

test('task-039: 스타일 픽스처 — 60문장(N5·N4·N3 × DAILY·EXAM 각 10), id 유일, 오류 문장은 교정문과 다르다, chat 세트는 24문장', () => {
  const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-explanation-style.json'), 'utf8')) as { items: { id: string; level: string; kind: string; input: string; expectedCorrected: string; hasError: boolean }[] }
  assert.equal(fx.items.length, 60)
  assert.equal(new Set(fx.items.map((x) => x.id)).size, 60)
  for (const level of ['N5', 'N4', 'N3']) for (const kind of ['DAILY', 'EXAM']) assert.equal(fx.items.filter((x) => x.level === level && x.kind === kind).length, 10, `${level}/${kind}`)
  for (const it of fx.items) assert.ok(it.hasError && it.input !== it.expectedCorrected && it.input.length > 0 && it.input.length <= 1_000, it.id)
  assert.equal(fx.items.filter((x) => /0[1-4]$/.test(x.id)).length, 24)
  const rv = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/chat-review-style.json'), 'utf8')) as { messages: { id: string; kind: string | null }[] }
  assert.equal(rv.messages.length, 14)
  assert.deepEqual(['DAILY', 'EXAM', null].map((k) => rv.messages.filter((m) => m.kind === k).length), [6, 6, 2])
})

test('task-039: 규칙 판정기 사전 — 급수·문형·용어는 JLPT 식, 쓰임·자연스러운 표현은 일상 표지, 둘은 독립', () => {
  assert.equal(flagsOf('「〜ように」(N4): 동사 기본형+ように').jlptStyle, true)
  assert.equal(flagsOf('JLPT 시험에 자주 나오는 문형이에요').examMarker, true)
  assert.equal(flagsOf('동사 て형에 붙여서 「座って」가 돼요').strongTerm, true)
  assert.equal(flagsOf('「帰ったら」(돌아가면)라고 말해요. 일상에서 자주 써요.').jlptStyle, false)
  assert.equal(flagsOf('「帰ったら」(돌아가면)라고 말해요. 일상에서 자주 써요.').everyday, true)
  assert.equal(flagsOf('조사 「を」는 한 번만 써요').jlptStyle, false)
  assert.equal(flagsOf('조사 「を」는 한 번만 써요').weakTerm, true)
  assert.equal(flagsOf(null).jlptStyle, false)
  const v = verdictOf({ explanationKo: '「帰ったら」라고 말해요.', grammarPoint: '過去形', extraNoteKo: '〜たら(N4): 동사 た형+ら' })
  assert.deepEqual([v.explJlpt, v.gpTerm, v.mainJlpt, v.extraPresent, v.extraJlpt], [false, true, true, true, true])
  assert.equal(verdictOf({ explanationKo: null, grammarPoint: null }).mainJlpt, false)
})

test('task-039: A4 lesson@v9 — grammar 지시에 "(일상 회화 위주)" 만 더했다(문구만 — 계약·스키마·persona 불변, 새 칸 없음)', () => {
  const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as { topic: Parameters<typeof buildLessonRequest>[0]['topic'] }
  const req = buildLessonRequest({ todayKst: '2026-10-06', learner, topic: fx.topic })
  assert.equal(LESSON_PROMPT_VERSION, 'lesson@v9')
  assert.ok(req.system.includes('이번 수업의 핵심 문형(일상 회화 위주)'))
  assert.ok(!/extraNote|extra_note/i.test(req.system + JSON.stringify(req.jsonSchema)))
  assert.ok(!(req.persona?.prompt ?? '').includes('설명은 일상 회화가 메인'), 'LESSON persona 는 §3 을 싣지 않는다 — 바이트 불변')
})
