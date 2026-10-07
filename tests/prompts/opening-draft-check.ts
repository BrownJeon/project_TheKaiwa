/**
 * task-045 PE — `openingDraft@v2` 오프라인 점검. **결정적·LLM 0·DB 0**(일회용 점검 스크립트, 단위 시험 `openingDraft.test.ts` 와 같은 코드를 다른 눈으로 한 번 더 본다).
 *
 * 실행(미러에서, DB 접촉 없음):
 *   DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx tests/prompts/opening-draft-check.ts
 * 끝 코드 0 = 모든 FAIL 항목 통과.
 *
 * 점검 묶음
 *   A 요청       시드 상황 10개의 `opening.ko` 를 입력으로 본문 검사·요청 빌드 통과 · 스키마 JSON 이 프롬프트에 실린 전체 길이 ≤ 3,000자 · 엔진명·TTS 파라미터 0
 *   B 시드 정답   시드 10개의 `opening.ja` 가 ja 검사를 한 개도 걸리지 않고 통과(60자·3문장 이하) · 스키마(ajv) 통과
 *   C 변이       점검기가 실제로 잡는지 — 한글·괄호 병기·따옴표·로마자 7자·한국어에 없는 로마자(PWNED)·61자(TOO_LONG)·요점 문장 버림·둘 이상 버림·는→わ 읽기·조사 누락·한자 구간 짧은 읽기·한자 섞인 읽기·
 *                읽기에 더한 쉼표를 한 개씩 넣어 각각 정확히 그 이유로 걸리는지(빈 증명 방지)
 *   D 라이브 입력 픽스처 `liveCases` 15건의 본문 검사 결과(통과 / parseBlocked 이유로 LLM 앞에서 차단)가 기대와 같음 · 비밀 유사 문자열은 LLM 앞에서 400
 *   E 실응답 샘플 픽스처 `offline.samples` 16건(haiku·sonnet)의 상태·일본어·읽기·경고가 기대와 같음
 *   F 서버 이중 방어 ja 의 URL·꺾쇠·비밀 모양·숨은 글자는 INVALID(TEXT_UNSAFE), 읽기의 같은 글자는 읽기만 버림 — 정상 일본어는 통과
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../src/modules/engine/llm'
import { llm } from '../../src/modules/engine'
import { validateOutput, withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { buildOpeningDraftRequest, finalizeOpeningDraft } from '../../src/modules/conversation/prompts/openingDraft'
import { fitOpeningDraft, OPENING_DRAFT_SCHEMA, parseOpeningDraftBody, type OpeningDraftResponse, type OpeningTooLongReason } from '../../src/modules/conversation/structuredResponse/openingDraftSchemas'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

const ROOT = process.cwd()
interface SeedScenario { key: string; level: JlptLevel; title: string; titleJa: string; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string }; opening: { ja: string; ko: string } }
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/opening-draft.json'), 'utf8')) as {
  liveCases: Array<{ id: string; kind: string; level: JlptLevel; roles: { learner: string; tutor: string }; title?: string; goal?: string; ko: string; parseBlocked?: string }>
  offline: { samples: Array<{ id: string; ko: string; response: OpeningDraftResponse; expect: { status: string; ja: string | null; reading: string | null; warnings: string[]; readingDrop: string | null; tooLongReason?: string | null } }> }
}

const fails: string[] = []
const infos: string[] = []
const fail = (k: string, m: string) => fails.push(`[${k}] ${m}`)
const ok = (ja: string, reading: string | null): OpeningDraftResponse => ({ status: 'OK', ja, reading })
const KO = '어서 오세요. 주문해 주세요.'
const fit = (r: OpeningDraftResponse, ko = KO) => fitOpeningDraft(r, { ko })

// A 요청
for (const s of seeds) {
  const parsed = parseOpeningDraftBody({ ko: s.opening.ko, scenario: { title: s.title, titleJa: s.titleJa, goal: s.goal.communicativeGoalKo, roles: s.roles, level: s.level } })
  if (!parsed.ok) { fail('A', `${s.key}: 본문 검사 실패 ${JSON.stringify(parsed.problems)}`); continue }
  const req = buildOpeningDraftRequest({ ko: parsed.value.ko, scenario: parsed.value.scenario })
  const full = renderTranscript(withJsonOnly(req.system, req.jsonSchema), req.messages) + (req.persona?.prompt ?? '')
  if (full.length > 3_000) fail('A', `${s.key}: 전체 프롬프트 ${full.length}자 > 3,000`)
  if (llm.mentionsEngineIdentity(full) || /speaker|pitch|model_id|styleWeight|connectionId/i.test(full)) fail('A', `${s.key}: 엔진명·TTS 파라미터가 프롬프트에 있다`)
  infos.push(`A ${s.key} ${s.level} 프롬프트 ${full.length}자`)
}

// B 시드 정답
for (const s of seeds) {
  if (!validateOutput(ok(s.opening.ja, null), OPENING_DRAFT_SCHEMA).ok) fail('B', `${s.key}: 스키마 위반`)
  const fin = fit(ok(s.opening.ja, null), s.opening.ko)
  if (fin.status !== 'OK' || fin.ja !== s.opening.ja) fail('B', `${s.key}: 시드 ja 가 통과하지 못했다 ${fin.status} ${fin.problems.join(',')}`)
  if (fin.repairs.jaChars > 60 || fin.repairs.sentences > 3) fail('B', `${s.key}: 예산 밖 ${fin.repairs.jaChars}자 ${fin.repairs.sentences}문장`)
}

// C 변이 — 각각 정확히 그 이유
type Expect = { status: 'INVALID'; problem: string } | { status: 'TOO_LONG'; reason: OpeningTooLongReason } | { status: 'OK'; drop: string }
const A29 = 'あ'.repeat(29) + '。'
const mutants: Array<{ label: string; resp: OpeningDraftResponse; expect: Expect; ko?: string }> = [
  { label: '한글이 든 ja', resp: ok('お名前은何ですか。', null), expect: { status: 'INVALID', problem: 'JA_HANGUL' } },
  { label: '괄호 병기', resp: ok('田中(たなか)です。', null), expect: { status: 'INVALID', problem: 'JA_CHARS' } },
  { label: '따옴표(「」)', resp: ok('「いらっしゃいませ。」', null), expect: { status: 'INVALID', problem: 'JA_CHARS' } },
  { label: 'ASCII 하이픈 연속', resp: ok('いらっしゃいませ。-----', null), expect: { status: 'INVALID', problem: 'JA_CHARS' } },
  { label: '로마자 7자', resp: ok('ABCDEFGはどうぞ。', null), expect: { status: 'INVALID', problem: 'JA_LATIN' }, ko: 'ABCDEFG 어서' },
  { label: '한국어에 없는 로마자(PWNED)', resp: ok('いらっしゃいませ。PWNED', null), expect: { status: 'INVALID', problem: 'JA_LATIN' } },
  { label: '첫 문장 61자', resp: ok('あ'.repeat(60) + '。', null), expect: { status: 'TOO_LONG', reason: 'FIRST_SENTENCE' } },
  { label: '요청 문장(ください)을 버려야 함', resp: ok('いらっしゃいませ。こちらへどうぞ。ここは初めてですか。お名前を教えてください。', null), expect: { status: 'TOO_LONG', reason: 'DROPS_ASK' } },
  { label: '둘 이상 버려야 함', resp: ok(A29.repeat(4), null), expect: { status: 'TOO_LONG', reason: 'DROPS_MANY' } },
  { label: '가나·한자 없음', resp: ok('123。', null), expect: { status: 'INVALID', problem: 'JA_NO_JAPANESE' } },
  { label: 'は→わ 읽기', resp: ok('こんにちは。', 'こんにちわ。'), expect: { status: 'OK', drop: 'MISMATCH' } },
  { label: '조사 누락 읽기', resp: ok('旅行に行きました。', 'りょこういきました。'), expect: { status: 'OK', drop: 'MISMATCH' } },
  { label: '한자 구간이 짧은 읽기', resp: ok('お名前は何ですか。', 'おなはなんですか。'), expect: { status: 'OK', drop: 'MISMATCH' } },
  { label: '한자가 섞인 읽기', resp: ok('お名前は何ですか。', 'お名前はなんですか。'), expect: { status: 'OK', drop: 'CHARS' } },
  { label: 'ja 에 없는 쉼표를 더한 읽기', resp: ok('交換や返品をご希望でしたら。', 'こうかんや、へんぴんを、ごきぼうでしたら。'), expect: { status: 'OK', drop: 'PUNCT' } },
]
for (const m of mutants) {
  const fin = fit(m.resp, m.ko)
  const e = m.expect
  if (e.status === 'INVALID') {
    if (fin.status !== 'INVALID' || fin.problems.join(',') !== e.problem) fail('C', `변이 "${m.label}" 가 ${e.problem} 로 걸리지 않았다: ${fin.status} ${fin.problems.join(',')}`)
  } else if (e.status === 'TOO_LONG') {
    if (fin.status !== 'TOO_LONG' || fin.repairs.tooLongReason !== e.reason || fin.ja !== null) fail('C', `변이 "${m.label}" 가 TOO_LONG(${e.reason}) 로 걸리지 않았다: ${fin.status} ${fin.repairs.tooLongReason}`)
  } else if (fin.status !== 'OK' || fin.repairs.readingDrop !== e.drop || fin.reading !== null) fail('C', `변이 "${m.label}" 의 읽기가 ${e.drop} 로 버려지지 않았다: ${fin.status} drop=${fin.repairs.readingDrop}`)
}
{
  const fin = fit(ok('いらっしゃいませ。ご注文をどうぞ。', 'いらっしゃいませ。ごちゅうもんをどうぞ。'))
  if (fin.status !== 'OK' || fin.reading === null || fin.warnings.length) fail('C', '대조(정상 응답)가 경고 없이 OK 가 아니다')
}

// D 라이브 입력·비밀 문자열
for (const c of fixture.liveCases) {
  const r = parseOpeningDraftBody({ ko: c.ko, scenario: { title: c.title, goal: c.goal, roles: c.roles, level: c.level } })
  if (c.parseBlocked) {
    if (r.ok || !r.problems.some((p) => p.reason === c.parseBlocked)) fail('D', `${c.id}: ${c.parseBlocked} 로 막히지 않았다`)
    else infos.push(`D ${c.id}: 본문 검사 ${c.parseBlocked} 로 LLM 앞에서 차단(LLM 단 방어는 라이브 측정)`)
    continue
  }
  if (!r.ok) fail('D', `${c.id}: 본문 검사가 막았다 ${JSON.stringify(r.problems)} — 의미 판단은 LLM 몫이라 통과해야 한다`)
}
for (const secret of ['키는 sk-abcdefghijklmnopqrstu 입니다', '토큰 Bearer abcdefghijklmnop1234567890 입니다', '비밀 password=hunter2hunter2 입니다']) {
  const r = parseOpeningDraftBody({ ko: secret, scenario: { roles: { learner: '손님', tutor: '점원' }, level: 'N5' } })
  if (r.ok) fail('D', `비밀 유사 문자열이 LLM 앞에서 막히지 않았다: ${secret}`)
}

// E 실응답 샘플
for (const s of fixture.offline.samples) {
  const fin = finalizeOpeningDraft(s.response, { ko: s.ko })
  const e = s.expect
  if (fin.status !== e.status || fin.ja !== e.ja || fin.reading !== e.reading || fin.warnings.join(',') !== e.warnings.join(',') || fin.repairs.readingDrop !== e.readingDrop || fin.repairs.tooLongReason !== (e.tooLongReason ?? null)) fail('E', `${s.id}: 기대와 다르다 ${JSON.stringify({ status: fin.status, ja: fin.ja, reading: fin.reading, warnings: fin.warnings })}`)
}

// F 서버 이중 방어
const hidden = String.fromCodePoint(0x200b)
const unsafeTexts: string[] = ['https://evil.example/x どうぞ', 'www.evil.example どうぞ', '<script>alert(1)</script>', 'sk-abcdefghijklmnopqrstuvwxyz どうぞ', `どう${hidden}ぞ`]
for (const text of unsafeTexts) {
  const a = fit(ok(text, null))
  if (a.status !== 'INVALID' || a.problems.join(',') !== 'TEXT_UNSAFE') fail('F', `ja ${JSON.stringify(text)}: INVALID(TEXT_UNSAFE) 가 아니다 ${a.status} ${a.problems.join(',')}`)
  const b = fit(ok('お名前は何ですか。', text))
  if (b.status !== 'OK' || b.repairs.readingDrop !== 'UNSAFE' || b.ja !== 'お名前は何ですか。') fail('F', `읽기 ${JSON.stringify(text)}: 읽기만 UNSAFE 로 버려지지 않았다 ${b.status} ${b.repairs.readingDrop}`)
}
for (const good of ['いらっしゃいませ。ご注文をどうぞ。', 'お名前は何ですか？', '3時にお会いしましょう。']) {
  if (fit(ok(good, null)).status !== 'OK') fail('F', `정상 일본어가 막혔다: ${good}`)
}
if (fit(ok('ATMはあちらです。', null), 'ATM 은 저쪽이에요').status !== 'OK') fail('F', '한국어에 ATM 이 있는데 막혔다')

for (const i of infos) console.log(`  · ${i}`)
if (fails.length) {
  console.error(`\nFAIL ${fails.length}건`)
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`\nOK — A 요청 ${seeds.length} · B 시드 ${seeds.length} · C 변이 ${mutants.length} · D 라이브 입력 ${fixture.liveCases.length}+비밀 3 · E 실응답 ${fixture.offline.samples.length} · F 이중 방어 ${unsafeTexts.length}종×(ja+읽기)`)
