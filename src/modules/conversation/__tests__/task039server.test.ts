/**
 * task-039 서버(dev-039) — 교정 추가 설명 칸 `extraNoteKo`.
 * ① 정리 함수 보강(Codex C1: 학습자 원문 통째 복사 → null, 한 줄 정규화·제어문자 → null) ② TALK shape → 저장(create) → SSE `done.correction` → 교정 DTO 왕복
 * ③ 옛 행(NULL) DTO ④ A3 병합(`mergeReviewCandidates`)이 값을 운반 ⑤ 로그·toolLog·Trace 에 값 부재 ⑥ 생성 시에만 쓰기·`original` 불변·모르는 키.
 * DB·LLM 은 쓰지 않는다 — 저장은 `saveTurnTx` 에 가짜 tx, Trace 는 `prisma.requestTrace` 를 가로챈다(task037 방식). 문장은 전부 합성이다.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prisma, type Tx } from '@/modules/infra'
import type { CorrectionUpdate } from '../corrections'
import { CORRECTION_SELECT, serializeCorrection, type CorrectionRow } from '../corrections/serialize'
import { saveTurnTx, startTurn, turnDeps } from '../orchestrator'
import { shapeTurnResponse } from '../orchestrator/shape'
import type { TurnEvent } from '../orchestrator/stream'
import { mergeReviewCandidates, reviewExtraNote } from '../review/filter'
import { EXTRA_NOTE_LEARNER_MIN, EXTRA_NOTE_STORE_MAX, sanitizeExtraNoteKo } from '../structuredResponse/checks'
import type { ChatReviewResponse, ReviewItem, TutorResponse } from '../structuredResponse/schemas'

const TEXT = '家に帰るたら、電話します'
const MAIN = '「帰るたら」는 붙지 않아요. 「帰ったら」(돌아가면)라고 말해요.'
const NOTE = '〜たら(N4): 동사 た형+ら'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const respWith = (extra: unknown): TutorResponse => ({
  conversation: { replyJa: 'そうですか。誰に電話しますか？', replyKo: '그래요? 누구한테 전화해요?' },
  correction: {
    required: true, original: TEXT, corrected: '家に帰ったら、電話します', explanationKo: MAIN,
    errorType: 'CONJUGATION', severity: 'MINOR', chunkType: 'ACTION', hintKo: null,
    ...(extra === undefined ? {} : { extraNoteKo: extra as string | null }),
  },
  learning: { grammarPoint: '돌아가면', difficulty: 'N4' },
  speech: { style: 'NEUTRAL' },
  endOfTopic: false,
  proposals: [],
  userKo: '집에 돌아가면 전화할게요.',
})

// ── ① 정리 함수: Codex C1 2건 + 기존 경우 유지 ─────────────────────────────────────────────

test('sanitizeExtraNoteKo(C1 medium): 학습자 원문을 통째로 담으면 null — 한글 접두어·공백 차이·개행이 있어도 공백을 뺀 비교로 잡는다', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`, TEXT), null, '「참고: <학습자 발화>」')
  assert.equal(sanitizeExtraNoteKo(MAIN, `〜たら 문형. 원문 ${TEXT} 를 보세요`, TEXT), null, '중간에 끼운 원문')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: きのうがっこうにいった', 'きのう がっこうに いった'), null, '원문의 띄어쓰기를 지워 복사')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: きのう がっこうに  いった', 'きのうがっこうにいった'), null, '원문에 띄어쓰기를 넣어 복사')
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고: 家に帰るたら、 電話します`, '家に帰るたら、\n電話します'), null, '원문 개행')
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`, `  ${TEXT}\n`), null, '원문 앞뒤 공백')
})

test('sanitizeExtraNoteKo(C1 medium): 원문 일부(조각) 인용·짧은 원문(공백 제외 4자 미만)·learnerText 생략(옛 두 인자 호출)은 그대로 통과', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, '「帰るたら」가 아니라 〜たら 는 た형+ら', TEXT), '「帰るたら」가 아니라 〜たら 는 た형+ら', '원문 조각 인용은 정상')
  assert.equal(EXTRA_NOTE_LEARNER_MIN, 4)
  assert.equal(sanitizeExtraNoteKo(MAIN, '「はい。」 는 대답 표현', 'はい。'), '「はい。」 는 대답 표현', '3자 원문은 검사하지 않는다')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「はい 。」 는 대답', ' は い。 '), '「はい 。」 는 대답', '공백 제외 3자')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「そうです」 는 맞장구', 'そうです'), null, '공백 제외 정확히 4자부터 검사')
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`), `참고: ${TEXT}`, 'learnerText 를 안 주면 원문 검사 없음(호환)')
  assert.equal(sanitizeExtraNoteKo(MAIN, NOTE, ''), NOTE)
  assert.equal(sanitizeExtraNoteKo(MAIN, NOTE, '   '), NOTE)
})

test('sanitizeExtraNoteKo(C1 low): 한 줄 정규화 — 개행·CRLF·탭·연속 공백은 공백 하나로 접어 저장, 접은 뒤 남은 제어문자는 null', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4):\n동사 た형+ら'), NOTE)
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4):\r\n동사 た형+ら'), NOTE)
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4):\t\t동사   た형+ら'), NOTE)
  assert.equal(sanitizeExtraNoteKo(MAIN, '\n\n〜たら(N4): 동사 た형+ら\n'), NOTE)
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4):\v\f동사 た형+ら'), NOTE, '\\v·\\f 도 공백류')
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら　동사 た형+ら'), '〜たら 동사 た형+ら', '전각 공백도 공백 하나로')
  for (const bad of ['〜たら\u0000 동사 た형+ら', '〜たら 동사\u007f た형+ら', '\u001b[31m〜たら 동사 た형+ら', '〜たら\u001c 동사', '〜たら 동사\u0008']) {
    assert.equal(sanitizeExtraNoteKo(MAIN, bad), null, JSON.stringify(bad))
  }
  const out = sanitizeExtraNoteKo(MAIN, '가\n나\t다')
  assert.ok(out !== null && !/[\r\n\t]/.test(out), '저장값에는 개행·탭이 없다')
})

test('sanitizeExtraNoteKo(C1 low): 길이 상한은 정규화 **후** 길이로 잰다 — 공백류로 부풀린 값은 접어서 통과, 접어도 넘으면 자르지 않고 null', () => {
  const raw = `${'가'.repeat(150)}${'\n'.repeat(100)}나`
  assert.ok(raw.length > EXTRA_NOTE_STORE_MAX)
  assert.equal(sanitizeExtraNoteKo(MAIN, raw), `${'가'.repeat(150)} 나`)
  assert.equal(sanitizeExtraNoteKo(MAIN, `${'가'.repeat(100)}\n\n${'나'.repeat(99)}`)?.length, EXTRA_NOTE_STORE_MAX, '접은 뒤 정확히 200자는 통과')
  assert.equal(sanitizeExtraNoteKo(MAIN, `${'가'.repeat(100)}\n\n${'나'.repeat(100)}`), null, '접은 뒤 201자는 null')
})

test('sanitizeExtraNoteKo: 기존 규칙 유지 — 누락·비문자열·공백뿐·한글 없음·메인 설명(개행이 달라도) 베끼기·엔진명은 null', () => {
  for (const v of [undefined, null, 42, {}, '', ' \n\t ']) assert.equal(sanitizeExtraNoteKo(MAIN, v, TEXT), null, JSON.stringify(v))
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら: N4 JLPT', TEXT), null, '한글 없음')
  assert.equal(sanitizeExtraNoteKo(MAIN, MAIN, TEXT), null)
  assert.equal(sanitizeExtraNoteKo('「帰るたら」는\n붙지 않아요.', '참고 「帰るたら」는 붙지 않아요. 〜たら', TEXT), null, '메인 설명 쪽 개행도 접어서 비교')
  assert.equal(sanitizeExtraNoteKo(MAIN, '이 문형은 claude 가 알려 줬어요', TEXT), null, '엔진 이름')
  assert.equal(sanitizeExtraNoteKo(undefined as unknown as string, NOTE, TEXT), NOTE, '메인 설명이 문자열이 아니어도 던지지 않는다')
})

// ── ①-b dev-039c: 보이지 않는 문자 접기·거부(REV-115 L-1 ⓑ · Codex C2 low), 원문 비교 정규화(L-1 ⓐ) ──────────────

test('sanitizeExtraNoteKo(C2): 줄바꿈류 U+0085(NEL)·U+2028·U+2029 는 개행처럼 공백 하나로 접는다(한 줄 계약)', () => {
  for (const sep of ['\u0085', '\u2028', '\u2029', '\u0085\u2028\n']) {
    assert.equal(sanitizeExtraNoteKo(MAIN, `〜たら(N4):${sep}동사 た형+ら`, TEXT), NOTE, JSON.stringify(sep))
  }
  const out = sanitizeExtraNoteKo(MAIN, '가\u0085나\u2028다\u2029라')
  assert.equal(out, '가 나 다 라')
})

test('sanitizeExtraNoteKo(C2): 서식 문자(영폭·BiDi 임베딩/덮어쓰기·isolate·BOM 등 \\p{Cf})가 하나라도 있으면 지우지 않고 null', () => {
  const formats = [
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f, // ZWSP·ZWNJ·ZWJ·LRM·RLM
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // BiDi 임베딩·덮어쓰기
    0x2060, 0x2061, 0x2062, 0x2063, 0x2064, // word joiner·보이지 않는 연산자
    0x2066, 0x2067, 0x2068, 0x2069, // isolate
    0xfeff, 0x00ad, 0x061c, 0xe0001, 0xe0041, // BOM·soft hyphen·ALM·태그 문자
  ]
  for (const cp of formats) {
    const ch = String.fromCodePoint(cp)
    for (const v of [`〜たら(N4): 동사 ${ch}た형+ら`, `${ch}${NOTE}`, `${NOTE}${ch}`]) {
      assert.equal(sanitizeExtraNoteKo(MAIN, v, TEXT), null, `U+${cp.toString(16).toUpperCase()} ${JSON.stringify(v)}`)
    }
  }
  assert.ok(/\s/.test('\ufeff'), 'U+FEFF 는 JS \\s 라 접기 전에 봐야 거부된다(접은 뒤면 공백·trim 으로 사라져 통과했다)')
  assert.equal(sanitizeExtraNoteKo(MAIN, '\u202e요세하 를ら+형た 사동\u202c', TEXT), null, '덮어쓰기로 순서를 뒤집은 값')
})

test('sanitizeExtraNoteKo(C2): C1 제어문자(U+0080–009F, NEL 제외)는 null — C0·DEL 기존 거부도 그대로', () => {
  for (const cp of [0x80, 0x81, 0x84, 0x86, 0x8d, 0x9b, 0x9f]) {
    const ch = String.fromCharCode(cp)
    assert.equal(sanitizeExtraNoteKo(MAIN, `〜たら(N4): 동사${ch} た형+ら`, TEXT), null, `U+${cp.toString(16).toUpperCase()}`)
  }
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら 동사\u007f た형+ら'), null)
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら\u0000 동사 た형+ら'), null)
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4): 동사\u{a0}た형+ら'), NOTE, 'NBSP(U+00A0 — C1 범위 밖 공백)은 접는다')
})

test('sanitizeExtraNoteKo(L-1 ⓐ): 원문 복제 비교는 NFKC·공백·구두점을 맞춘 뒤 — 끝 구두점·쉼표·반각/전각 차이로 빠져나가지 못한다', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: 家に帰るたら電話します', '家に帰るたら、電話します。'), null, '원문의 、。 를 빼고 인용')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: 「家に帰るたら、電話します!」', TEXT), null, '인용 쪽에만 「」·! 를 붙임')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: コーヒーをのみたいです', 'ｺｰﾋｰをのみたいです'), null, '반각 가타카나 원문')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: JRで行きます', 'ＪＲで行きます'), null, '전각 영문 원문')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: 「元気ですか?」', '元気ですか？'), null, '전각 물음표 원문')
  assert.equal(sanitizeExtraNoteKo(MAIN, '참고: そう…ですね', 'そうですね…'), null, '말줄임표 위치만 다름')
  const msg = '昨日、友達と映画を見ました。とても楽しいでした！'
  assert.equal(reviewExtraNote({ explanation_ko: MAIN, extra_note_ko: '참고: 昨日友達と映画を見ましたとても楽しいでした' }, msg, msg), null, 'A3 메시지 전체(구두점 제거) 복제')
  assert.equal(reviewExtraNote({ explanation_ko: MAIN, extra_note_ko: '참고: とても楽しいでした' }, msg, 'とても楽しいでした！'), null, 'A3 짚은 문장(끝 ！ 없이) 복제')
})

test('sanitizeExtraNoteKo(L-1 ⓐ): 하한은 정규화 **후** 4자 — 구두점으로 부풀린 짧은 원문은 검사하지 않고, 저장값은 정규화하지 않는다', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, '「はい！！」 는 대답 표현', 'はい！！'), '「はい！！」 는 대답 표현', '정규화하면 2자')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「あ、そう。」 는 맞장구', 'あ、そう。'), '「あ、そう。」 는 맞장구', '정규화하면 3자 — 검사 안 함')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「そう。です」 는 맞장구', 'そう、です'), null, '정규화하면 정확히 4자 → 검사')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「えっ、ほんと？」 는 놀람', 'えっ、ほんと？'), null, '정규화 후 4자 이상 원문 전체를 인용하면 null(기존 방침 — 원문 통째 포함)')
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら（N4）：동사 た형＋ら', TEXT), '〜たら（N4）：동사 た형＋ら', '전각 괄호·콜론·＋ 는 저장값에 그대로(비교에만 NFKC)')
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`), `참고: ${TEXT}`, 'learnerText 생략 = 원문 검사 없음(두 인자 호환)')
})

test('sanitizeExtraNoteKo(L-1): 정상 문형 설명은 그대로 통과 — 원문 조각·같은 문형을 인용해도 원문 전체가 아니면 살린다', () => {
  const ok: [note: string, learner: string][] = [
    ['〜たい(希望): 동사 ます형+たい', '映画を見たいです'],
    ['「〜たい(希望)」 는 바람을 말할 때', '映画を見たいです'],
    ['〜ことがある(N4): 경험 — 「見たことがある」', '富士山に登ったことがあります'],
    ['〜たら(N4): 동사 た형+ら', TEXT],
    ['「帰ったら」→ 〜たら 조건(N4)', TEXT],
    ['〜ように(N3): 목적 — 동사 기본형+ように', '忘れないようにメモします'],
    ['N5 · い형용사 과거 「楽しい」→「楽しかった」', '楽しいでした'],
  ]
  for (const [note, learner] of ok) assert.equal(sanitizeExtraNoteKo(MAIN, note, learner), note, note)
})

// ── ①-c dev-039d: Cf 밖 보이지 않는 문자 거부·복제 비교 정규화(REV-116 L-7 · Codex C2 3차) ──────────────────
// 보이지 않는 문자는 소스에 리터럴로 두지 않는다(편집 도구가 이스케이프를 실제 문자로 풀어 넣은 사고 — dev-039c) — 전부 코드 포인트로 만든다.

const IGNORABLE_CPS = [
  0xfe0f, 0xfe00, 0xe0100, // 변이 선택자(이모지·이체자)
  0x034f, // CGJ
  0x3164, 0x115f, 0x1160, 0xffa0, // 한글 채움(3164·115F·1160 은 한글 검사 범위 안)
  0x17b4, 0x180b, // 크메르 모음·몽골 자형 선택자
  0x2800, // 점자 빈 칸(기본 무시 문자 아님)
]
const LONE_SURROGATES = [String.fromCharCode(0xd800), String.fromCharCode(0xdbff), String.fromCharCode(0xdc00), String.fromCharCode(0xdfff)]
const INVISIBLES = [...IGNORABLE_CPS.map((cp) => String.fromCodePoint(cp)), ...LONE_SURROGATES]
const cpLabel = (ch: string) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
const interleave = (s: string, ch: string) => [...s].join(ch)

test('sanitizeExtraNoteKo(L-7): 기본 무시 코드 포인트·U+2800·짝 없는 서로게이트가 앞·중간·끝 어디에 있어도 지우지 않고 null', () => {
  for (const ch of INVISIBLES) {
    for (const v of [`〜たら(N4): 동사 ${ch}た형+ら`, `${ch}${NOTE}`, `${NOTE}${ch}`]) {
      assert.equal(sanitizeExtraNoteKo(MAIN, v, TEXT), null, `${cpLabel(ch)} ${JSON.stringify(v)}`)
    }
  }
  const filler = String.fromCodePoint(0x3164)
  assert.equal(sanitizeExtraNoteKo(MAIN, filler, TEXT), null, '한글 채움 단독 — 한글 검사를 만족시키지만 빈 줄')
  assert.equal(sanitizeExtraNoteKo(MAIN, `〜た${filler}`, TEXT), null, '한글 채움이 유일한 "한글"')
  assert.equal(sanitizeExtraNoteKo(MAIN, `〜たら${String.fromCodePoint(0xffa0)} 동사 た형+ら`, TEXT), null, '반각 한글 채움 + 진짜 한글')
  assert.equal(sanitizeExtraNoteKo(MAIN, `〜たい(希望): 바람 ${String.fromCodePoint(0x2764, 0xfe0f)}`, TEXT), null, 'U+FE0F 가 붙은 이모지 시퀀스도 거부(이 칸에 이모지는 쓸 일이 없다)')
  const astral = String.fromCodePoint(0x20bb7)
  assert.equal(sanitizeExtraNoteKo(MAIN, `「${astral}」 는 「吉」의 이체자`, TEXT), `「${astral}」 는 「吉」의 이체자`, '짝이 맞는 서로게이트(보이는 확장 한자)는 통과')
})

test('sanitizeExtraNoteKo(L-7): 원문·메인 설명 각 글자 사이에 보이지 않는 문자를 끼운 복제는 null — 끼운 쪽이 추가 설명이든 비교 상대든', () => {
  for (const ch of INVISIBLES) {
    const label = cpLabel(ch)
    assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${interleave(TEXT, ch)}`, TEXT), null, `${label} 원문 사이사이(추가 설명 쪽)`)
    assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${interleave(MAIN, ch)}`, TEXT), null, `${label} 메인 설명 사이사이(추가 설명 쪽)`)
    assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`, interleave(TEXT, ch)), null, `${label} 원문 쪽에 낀 문자 — 추가 설명은 깨끗한 복제`)
    assert.equal(sanitizeExtraNoteKo(interleave(MAIN, ch), `참고: ${MAIN}`, TEXT), null, `${label} 메인 설명 쪽에 낀 문자 — 추가 설명은 깨끗한 복제`)
  }
  for (const ch of [String.fromCodePoint(0x200b), String.fromCodePoint(0xfeff), String.fromCodePoint(0x2066)]) {
    assert.equal(sanitizeExtraNoteKo(MAIN, `참고: ${TEXT}`, interleave(TEXT, ch)), null, `${cpLabel(ch)}(Cf) 원문 쪽`)
    assert.equal(sanitizeExtraNoteKo(interleave(MAIN, ch), `참고: ${MAIN}`, TEXT), null, `${cpLabel(ch)}(Cf) 메인 설명 쪽`)
  }
  const msg = '昨日、友達と映画を見ました。とても楽しいでした！'
  const zw = String.fromCodePoint(0x034f)
  assert.equal(reviewExtraNote({ explanation_ko: MAIN, extra_note_ko: '참고: 昨日友達と映画を見ましたとても楽しいでした' }, interleave(msg, zw), interleave(msg, zw)), null, 'A3 메시지에 CGJ 가 낀 경우')
})

test('sanitizeExtraNoteKo(L-7): 메인 설명 복제 비교도 NFKC·공백·구두점을 맞춘 뒤 — 띄어쓰기·구두점·전각만 바꾼 베끼기는 null', () => {
  assert.equal(sanitizeExtraNoteKo(MAIN, MAIN, TEXT), null, '그대로')
  assert.equal(sanitizeExtraNoteKo(MAIN, '「帰るたら」는붙지 않아요 「帰ったら」 (돌아가면) 라고 말해요!', TEXT), null, '띄어쓰기·마침표·느낌표만 바꿈')
  assert.equal(sanitizeExtraNoteKo(MAIN, `참고 — ${MAIN.replace(/\(/g, '（').replace(/\)/g, '）').replace(/\./g, '。')}`, TEXT), null, '전각 괄호·마침표로 바꾼 베끼기')
  assert.equal(sanitizeExtraNoteKo(MAIN, '〜たら(N4): 「帰ったら」(돌아가면) 처럼 た형+ら', TEXT), '〜たら(N4): 「帰ったら」(돌아가면) 처럼 た형+ら', '메인 설명 일부만 겹치면 통과')
})

test('sanitizeExtraNoteKo(L-7): 정규화한 메인 설명이 빈 문자열(구두점·공백·보이지 않는 문자뿐)이면 메인 설명 검사를 건너뛴다 — 빈 문자열 포함으로 잘못 버리지 않는다', () => {
  for (const main of ['', ' ', '。、！？', '「」', String.fromCodePoint(0x200b), String.fromCodePoint(0x3164)]) {
    assert.equal(sanitizeExtraNoteKo(main, NOTE, TEXT), NOTE, JSON.stringify(main))
  }
})

test('sanitizeExtraNoteKo(L-7): 정상 일본어 문형 설명(한글·전각 괄호·장음·물결·가운뎃점·확장 한자 없음)은 그대로 통과 — 오탐 없음', () => {
  const ok = [
    '「〜たい(希望)」 는 바람을 말할 때',
    '〜たい（希望）：동사 ます형＋たい',
    '「コーヒー」의 ー 는 장음(長音) — 한 박 늘여요',
    '〜ている(N5): 진행·상태 — 「食べている」',
    '「〜ましょう」(권유): 동사 ます형 어간+ましょう',
    '「〜ことにする」(N4)와 「〜ことになる」 비교 — 결정・결과',
    '〜ばよかった(N3): 후회 「行けばよかった」',
    '促音 「っ」: 「きって」 와 「きて」 는 뜻이 달라요',
  ]
  for (const note of ok) assert.equal(sanitizeExtraNoteKo(MAIN, note, TEXT), note, note)
})

// ── ② TALK shape → 저장 → DTO 왕복 ─────────────────────────────────────────────────────────────

type Call = { op: string; args: Record<string, unknown> }
function fakeTx(calls: Call[]) {
  const rec = (op: string, ret: (args: Record<string, unknown>) => unknown) => async (args: Record<string, unknown>) => {
    calls.push({ op, args })
    return ret(args)
  }
  return {
    $queryRaw: async () => {
      calls.push({ op: 'lockUser', args: {} })
      return [{ id: 'u1' }]
    },
    chatMessage: {
      updateMany: rec('chatMessage.updateMany', () => ({ count: 1 })),
      update: rec('chatMessage.update', () => ({})),
      findUnique: rec('chatMessage.findUnique', () => null),
    },
    correction: { create: rec('correction.create', () => ({ id: 'cr1' })) },
    tutorProposal: { create: rec('tutorProposal.create', () => ({ id: 'p1' })) },
    chat: { updateMany: rec('chat.updateMany', () => ({ count: 1 })) },
  } as unknown as Tx
}
const accepted = {
  chatId: 'c1', kind: 'TALK' as const, level: null, userMessage: { id: 'mu', content: TEXT, createdAt: new Date(), inputSource: 'TEXT' as const },
  assistantMessageId: 'ma', pendingSince: new Date(), traceId: 't1', resumed: false,
}
const toolLog = { traceId: 't1', meta: { learning: { grammarPoint: null, difficulty: 'N4' }, style: 'NEUTRAL' as const, endOfTopic: false, warning: null } } as unknown as Parameters<typeof saveTurnTx>[4]
const extras = { correction: { mode: 'FLUENCY' as const, deliver: 'LATER' as const, hintKo: null }, selfCheck: null }

/** create 인자로 DB 행을 흉내 내 DTO 를 만든다(조회 select 와 같은 칸). */
function rowFrom(data: Record<string, unknown>): CorrectionRow {
  return {
    id: 'cr1', messageId: data.messageId as string, chatId: data.chatId as string, status: 'PROPOSED', original: data.original as string, corrected: data.corrected as string,
    explanation: data.explanation as string, extraNoteKo: (data.extraNoteKo ?? null) as string | null, errorType: data.errorType as CorrectionRow['errorType'],
    severity: data.severity as CorrectionRow['severity'], chunkType: (data.chunkType ?? null) as CorrectionRow['chunkType'], savedWordId: null, createdAt: new Date('2026-10-06T10:00:00Z'), resolvedAt: null,
  }
}

const CASES: [string, unknown, string | null][] = [
  ['채움', NOTE, NOTE],
  ['null', null, null],
  ['키 없음(옛 응답)', undefined, null],
  ['200자 초과', `〜たら ${'가'.repeat(EXTRA_NOTE_STORE_MAX)}`, null],
  ['메인 설명과 같음', MAIN, null],
  ['엔진명', '이 문형은 claude 가 알려 줬어요', null],
  ['학습자 원문 포함', `참고: ${TEXT}`, null],
  ['여러 줄', '〜たら(N4):\n동사 た형+ら', NOTE],
  ['제어문자', '〜たら\u0000 동사', null],
]

for (const [label, model, expected] of CASES) {
  test(`TALK 왕복(${label}): shape → create.data.extraNoteKo → saved/done.correction → 교정 DTO 가 모두 같은 값(${JSON.stringify(expected)})`, async () => {
    const calls: Call[] = []
    const shaped = shapeTurnResponse('TALK', TEXT, respWith(model))
    assert.equal(shaped.correction?.extraNoteKo, expected, 'shape')
    const saved = await saveTurnTx(fakeTx(calls), 'u1', accepted, shaped, toolLog, extras)
    const create = calls.find((c) => c.op === 'correction.create')!.args as { data: Record<string, unknown>; select: unknown }
    assert.equal(create.data.extraNoteKo, expected, 'create — 키는 늘 있고(null 포함) 정리된 값')
    assert.ok('extraNoteKo' in create.data)
    assert.equal(create.data.original, TEXT, 'original 은 서버가 가진 학습자 말')
    assert.equal(saved.correction?.extraNoteKo, expected, 'saved(= SSE done.correction)')
    const dto = serializeCorrection(rowFrom(create.data))
    assert.equal(dto.extraNoteKo, expected, 'DTO')
    assert.ok(!calls.some((c) => c.op.startsWith('correction.') && c.op !== 'correction.create'), '교정 행은 생성만(갱신 없음)')
  })
}

test('TALK 저장: 모르는 키(스키마 밖 값이 섞여 들어와도) create 데이터는 알려진 칸만 — 새 칸 extraNoteKo 하나만 늘었다', async () => {
  const calls: Call[] = []
  const r = respWith(NOTE)
  const shaped = shapeTurnResponse('TALK', TEXT, { ...r, correction: { ...r.correction!, corrected_note: '모르는 칸', extraNoteKo2: 'x' } as never })
  await saveTurnTx(fakeTx(calls), 'u1', accepted, shaped, toolLog, extras)
  const create = calls.find((c) => c.op === 'correction.create')!.args as { data: Record<string, unknown> }
  assert.deepEqual(Object.keys(create.data), ['userId', 'chatId', 'messageId', 'original', 'corrected', 'explanation', 'extraNoteKo', 'errorType', 'severity', 'chunkType'])
})

// ── ③ 교정 DTO: select·옛 행 ─────────────────────────────────────────────────────────────────

test('교정 DTO: CORRECTION_SELECT 에 extraNoteKo 가 있고(#29·#34·메시지 목록 공통), 옛 행(NULL)·값 없음은 null, 키는 늘 있다', () => {
  assert.equal(CORRECTION_SELECT.extraNoteKo, true)
  const base = rowFrom({ messageId: 'mu', chatId: 'c1', original: TEXT, corrected: '家に帰ったら、電話します', explanation: MAIN, errorType: 'CONJUGATION', severity: 'MINOR', chunkType: null })
  const old = serializeCorrection({ ...base, extraNoteKo: null })
  assert.ok('extraNoteKo' in old)
  assert.equal(old.extraNoteKo, null, '옛 행')
  const { extraNoteKo: _drop, ...noKey } = base
  void _drop
  assert.equal(serializeCorrection(noKey as CorrectionRow).extraNoteKo, null, '값이 undefined 여도 null')
  assert.equal(serializeCorrection({ ...base, extraNoteKo: NOTE }, { id: 'c1', title: '채팅', kind: 'TALK' }).extraNoteKo, NOTE)
})

// ── ④ A3 표현 점검: 병합이 값을 운반 ──────────────────────────────────────────────────────────

const ritem = (message_id: string, original: string, corrected: string, extra?: unknown): ReviewItem => ({
  message_id, original, corrected, explanation_ko: '액션 조각 「行きました」 앞은 「に」예요.', error_type: 'PARTICLE', severity: 'MINOR', chunk_type: 'ACTION',
  ...(extra === undefined ? {} : { extra_note_ko: extra as string | null }),
})
const rresp = (items: ReviewItem[]): ChatReviewResponse => ({ items, summary_ko: '총평', strengths: [], focus: [] })
const MSGS = [
  { id: 'm1', text: '昨日は学校を行きました。友達と話しました。' },
  { id: 'm2', text: 'はい。いく。' },
  { id: 'm3', text: '本が読みたいです' },
]

test('A3 병합: 항목별 extraNoteKo 가 draft 에 실린다 — 채움·null·키 없음(v2 응답)·200 초과·메인 설명 베끼기·짚은 문장 복사·짧은 메시지 통째 복사', () => {
  const S1 = '昨日は学校を行きました。'
  const cases: [ReviewItem, string | null, string][] = [
    [ritem('m1', S1, '昨日は学校に行きました。', '〜に行く: 장소+に 行く(N5)'), '〜に行く: 장소+に 行く(N5)', '채움'],
    [ritem('m1', S1, '昨日は学校に行きました。', null), null, 'null'],
    [ritem('m1', S1, '昨日は学校に行きました。'), null, '키 없음'],
    [ritem('m1', S1, '昨日は学校に行きました。', `〜に ${'가'.repeat(EXTRA_NOTE_STORE_MAX)}`), null, '200 초과'],
    [ritem('m1', S1, '昨日は学校に行きました。', '액션 조각 「行きました」 앞은 「に」예요.'), null, '메인 설명'],
    [ritem('m1', S1, '昨日は学校に行きました。', `참고: ${S1}`), null, '짚은 문장 복사(메시지 전체가 아니어도)'],
    [ritem('m2', 'いく。', '行く。', '참고: はい。いく。 표기'), null, '짧은 문장(3자)이라도 메시지 통째 복사는 null'],
    [ritem('m2', 'いく。', '行く。', '「いく。」 는 한자 行く 로'), '「いく。」 는 한자 行く 로', '3자 문장 조각 인용은 통과'],
    [ritem('m1', S1, '昨日は学校に行きました。', '〜に行く:\n장소+に'), '〜に行く: 장소+に', '여러 줄은 한 줄로'],
  ]
  for (const [it, expected, label] of cases) {
    const r = mergeReviewCandidates(MSGS, [rresp([it])])
    assert.equal(r.items.length, 1, label)
    assert.equal(r.items[0].extraNoteKo, expected, label)
    assert.equal(r.dropped, 0, label)
  }
})

test('A3 병합: 여러 후보 — 같은 (메시지·원문·교정문)은 마지막 후보의 값, 재시도가 빠뜨린 항목은 앞선 후보의 값이 함께 살아남는다', () => {
  const first = rresp([ritem('m3', '本が読みたいです', '本を読みたいです', '〜を〜たい: 희망(N5) 1차'), ritem('m1', '昨日は学校を行きました。', '昨日は学校に行きました。', '〜に行く 1차')])
  const second = rresp([ritem('m3', '本が読みたいです', '本を読みたいです', '〜を〜たい: 희망(N5) 2차')])
  const r = mergeReviewCandidates(MSGS, [first, second])
  assert.deepEqual(r.items.map((d) => [d.messageId, d.extraNoteKo]), [
    ['m1', '〜に行く 1차'],
    ['m3', '〜を〜たい: 희망(N5) 2차'],
  ])
  const nul = mergeReviewCandidates(MSGS, [first, rresp([ritem('m3', '本が読みたいです', '本を読みたいです', null)])])
  assert.equal(nul.items.find((d) => d.messageId === 'm3')?.extraNoteKo, null, '마지막 후보가 null 이면 앞선 후보 값으로 채우지 않는다(항목 단위 운반)')
})

test('A3 병합: 모르는 키(corrected_note 등)는 draft 에 실리지 않는다 — draft 칸은 알려진 것뿐이고 새 칸은 extraNoteKo 하나', () => {
  const it = { ...ritem('m3', '本が読みたいです', '本を読みたいです', '〜を〜たい'), corrected_note: '모르는 칸' } as ReviewItem
  const d = mergeReviewCandidates(MSGS, [rresp([it])]).items[0]
  assert.deepEqual(Object.keys(d), ['messageId', 'original', 'corrected', 'explanation', 'extraNoteKo', 'errorType', 'severity', 'chunkType'])
})

test('reviewExtraNote: 메시지가 곧 원문이면 한 번만 검사하고, 짚은 문장이 따로 있으면 문장 쪽도 검사한다', () => {
  const it = { explanation_ko: '설명', extra_note_ko: '참고: 本が読みたいです' }
  assert.equal(reviewExtraNote(it, '本が読みたいです', '本が読みたいです'), null)
  assert.equal(reviewExtraNote({ ...it, extra_note_ko: '〜を〜たい: 희망' }, '本が読みたいです', '本が読みたいです'), '〜を〜たい: 희망')
  assert.equal(reviewExtraNote({ ...it, extra_note_ko: '참고: 友達と話しました。' }, MSGS[0].text, '友達と話しました。'), null)
})

// ── ⑤ 로그·toolLog·Trace 에 값이 실리지 않는다(턴 전체) ────────────────────────────────────────

const MARK = '〜たら 접속 표식ㅋㅌ: 동사 た형+ら'

function captureTraces() {
  const traces: unknown[] = []
  const original = (prisma as unknown as Record<string, unknown>).requestTrace
  assert.ok(original, 'prisma.requestTrace 델리게이트가 있어야 한다(prisma generate 이후)')
  const descriptor = Object.getOwnPropertyDescriptor(prisma, 'requestTrace')
  Object.defineProperty(prisma, 'requestTrace', { configurable: true, writable: true, value: { create: async (args: { data: unknown }) => (traces.push(args.data), args.data) } })
  return { traces, restore: () => Object.defineProperty(prisma, 'requestTrace', { configurable: true, writable: true, enumerable: true, ...descriptor, value: original }) }
}

test('턴 전체(TALK): done.correction.extraNoteKo 는 저장값 — 강사 행 toolLog·교정 메타 toolLog·Trace·콘솔 로그에는 추가 설명 문자열이 없다', async (t) => {
  const logs: string[] = []
  for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const) mock.method(console, k, (...a: unknown[]) => void logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')))
  const cap = captureTraces()
  t.after(() => {
    mock.restoreAll()
    cap.restore()
  })
  const calls: Call[] = []
  let passedToolLog: unknown = null
  const data = respWith(MARK)
  mock.method(turnDeps, 'precheckChat', async () => ({ kind: 'TALK', level: 'N4', scenarioId: null }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N4' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY' as const)
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  mock.method(turnDeps, 'acceptTurn', async () => ({ ...accepted, chatId: 'c-039', level: 'N4', scenarioId: null }))
  mock.method(turnDeps, 'saveTurn', (u: string, a: Parameters<typeof saveTurnTx>[2], s: Parameters<typeof saveTurnTx>[3], tl: Parameters<typeof saveTurnTx>[4], ex: Parameters<typeof saveTurnTx>[5]) => {
    passedToolLog = tl
    return saveTurnTx(fakeTx(calls), u, a, s, tl, ex)
  })
  mock.method(turnDeps, 'completeJson', async () => ({ data, connectionKey: 'k', model: 'm', elapsedMs: 5, promptChars: 10, attempts: 1, warm: 'HIT', firstDeltaMs: 2, residualViolations: [], candidates: [data] }))
  const handle = await startTurn({ userId: `u-039-${Math.random().toString(36).slice(2, 8)}`, chatId: 'c-039', request: { resume: false, text: TEXT, inputSource: 'TEXT', utteranceId: null, clientTimings: null } })
  const events: TurnEvent[] = []
  await handle.subscribe((e) => events.push(e))
  await handle.done
  await sleep(10)

  const done = events.find((e) => e.event === 'done')?.data as { correction: { extraNoteKo: string | null; explanationKo: string } | null } | undefined
  assert.ok(done, events.map((e) => e.event).join(','))
  assert.equal(done.correction?.extraNoteKo, MARK, 'SSE done.correction 은 저장값')
  const create = calls.find((c) => c.op === 'correction.create')!.args as { data: { extraNoteKo: unknown } }
  assert.equal(create.data.extraNoteKo, MARK, '저장 행')

  const has = (v: unknown) => JSON.stringify(v ?? null).includes('표식ㅋㅌ')
  assert.ok(passedToolLog && !has(passedToolLog), '강사 행 toolLog(meta 포함)')
  for (const c of calls.filter((c) => c.op.startsWith('chatMessage.'))) assert.ok(!has(c.args), `${c.op} — 강사 행 DONE·사용자 행 번역·교정 메타(writeCorrectionMeta)`)
  assert.ok(cap.traces.length >= 1, 'Trace 를 1행 남긴다')
  assert.ok(!has(cap.traces), 'RequestTrace steps')
  assert.ok(!logs.some((l) => l.includes('표식ㅋㅌ')), '콘솔 로그')
})

// ── ⑥ 생성 시에만 쓴다 · original 불변 · 모든 교정 생성 경로가 새 칸을 싣는다 ─────────────────────────────

test('생성 시에만: 교정 갱신 데이터 타입에 original·extraNoteKo 가 없다(타입 검사) — 추가 설명은 수정 경로가 없다', () => {
  // @ts-expect-error — original 은 갱신 데이터에 넣을 수 없다
  const a: CorrectionUpdate = { original: 'x' }
  // @ts-expect-error — extraNoteKo 도 갱신 데이터에 넣을 수 없다(생성 시에만 기록)
  const b: CorrectionUpdate = { extraNoteKo: 'x' }
  const ok: CorrectionUpdate = { status: 'ACCEPTED' }
  void a
  void b
  void ok
})

test('교정 생성 경로(TALK 저장·A3 점검)는 둘 다 create 데이터에 extraNoteKo 를 싣는다 — 새 생성 경로가 칸을 빠뜨리면 실패', () => {
  const root = join(process.cwd(), 'src')
  const found: Record<string, number> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
        continue
      }
      if (!/\.tsx?$/.test(name)) continue
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/\.correction\.create\(\{\s*data:\s*\{([^}]*)\}/g)) {
        const rel = p.slice(root.length + 1)
        assert.ok(/\bextraNoteKo:/.test(m[1]), `${rel}: correction.create 데이터에 extraNoteKo 가 없다`)
        found[rel] = (found[rel] ?? 0) + 1
      }
    }
  }
  walk(root)
  assert.deepEqual(found, { 'modules/conversation/orchestrator/index.ts': 1, 'modules/conversation/review/index.ts': 1 })
})
