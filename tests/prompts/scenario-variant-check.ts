/**
 * task-045 PE — `scenarioVariant@v1` 오프라인 점검. **결정적·LLM 0·DB 0**(일회용 점검 스크립트, 단위 시험 `scenarioVariant.test.ts` 와 같은 코드를 다른 눈으로 한 번 더 본다).
 *
 * 실행(미러에서, DB 접촉 없음):
 *   DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx tests/prompts/scenario-variant-check.ts
 * 끝 코드 0 = 모든 FAIL 항목 통과.
 *
 * 점검 묶음
 *   A 요청     라이브 케이스 27건(+주입 3)이 본문 검사 → 빌드 통과 · 스키마(JSON)가 프롬프트에 실린 전체 길이 · 엔진명 0 · 학습자 글이 system 에 0
 *   B 본문     parseCases 19건의 통과/거절 이유가 기대와 같음
 *   C 변이     점검기가 실제로 잡는지 — 한 건씩 넣어 정확히 그 이유로 걸리는지(원본 그대로·표현만/순서만 바뀜·수준 미반영·한국어 칸 한글 없음·URL·꺾쇠·비밀 모양·엔진명·보이지 않는 글자·성격 미반영) +
 *              코드가 고치는 것(학습자 역할·상대 역할·제목·한글 첫마디·따옴표 첫마디·4문장 첫마디→기준 첫마디로·기준에 없는 로마자·한글 뜻 없는 표현)이 실제로 고쳐지는지 — 빈 증명 방지로 변이 없는 샘플은 OK
 *   D 샘플     samples 3건의 상태·수준·바뀐 칸·상대 역할이 기대와 같음, 표현 id 없음, 장소 이어짐
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../src/modules/engine/llm'
import { llm } from '../../src/modules/engine'
import { validateOutput, withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { buildScenarioVariantRequest, finalizeScenarioVariant } from '../../src/modules/conversation/prompts/scenarioVariant'
import { parseScenarioVariantBody, SCENARIO_VARIANT_SCHEMA, type ScenarioVariantBase, type ScenarioVariantModelResponse } from '../../src/modules/conversation/structuredResponse/scenarioVariantSchemas'
import type { ScenarioDraftModel } from '../../src/modules/conversation/structuredResponse/scenarioDraft'
import type { ScenarioVariantAxes } from '../../src/types/scenarioVariant'

const ROOT = process.cwd()
interface SeedScenario { key: string; topics: { key: string }[]; title: string; titleJa: string; description: string; level: ScenarioVariantBase['level']; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string; successCriteria: string[] }; steps: { ko: string }[]; opening: { ja: string; ko: string } | null; keyExpressions: { ja: string; reading?: string; ko: string }[] }
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]
const topics = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as { key: string; title: string }[]
const fx = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/scenario-variant.json'), 'utf8')) as {
  parseCases: { id: string; body: unknown; baseLevel?: ScenarioVariantBase['level']; ok: boolean; problems?: [string, string][] }[]
  samples: Record<string, { axes: Partial<ScenarioVariantAxes>; response: ScenarioVariantModelResponse; expect: { status: string; level: string; changed: string[]; unchanged: string[]; tutor: string } }>
  liveCases: { id: string; seed: string; axes: Partial<ScenarioVariantAxes>; note?: string }[]
}

const baseOf = (key: string): ScenarioVariantBase => {
  const s = seeds.find((x) => x.key === key)!
  return { title: s.title, titleJa: s.titleJa, description: s.description, level: s.level, roles: s.roles, goal: s.goal, steps: s.steps, keyExpressions: s.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading ?? null, ko: e.ko })), opening: s.opening, topics: s.topics.map((t) => ({ id: `tp_${t.key}`, title: topics.find((x) => x.key === t.key)?.title ?? t.key })) }
}
const cafe = baseOf('cafe-order-drink')
const fails: string[] = []
const infos: string[] = []
const fail = (k: string, m: string) => fails.push(`[${k}] ${m}`)

// A 요청
const totals: number[] = []
for (const c of fx.liveCases) {
  const base = baseOf(c.seed)
  const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: base.level })
  if (!parsed.ok) {
    fail('A', `${c.id}: 본문 검사 거절 ${JSON.stringify(parsed.problems)}`)
    continue
  }
  const r = buildScenarioVariantRequest({ base, axes: parsed.value.axes, note: parsed.value.note })
  const total = renderTranscript(withJsonOnly(r.system, r.jsonSchema!), r.messages).length
  totals.push(total)
  for (const t of [r.system, r.messages[0].content, r.persona!.prompt]) if (llm.mentionsEngineIdentity(t)) fail('A', `${c.id}: 엔진명 노출`)
  if (r.system.includes(base.title) || r.system.includes(base.goal.communicativeGoalKo)) fail('A', `${c.id}: 학습자 글이 system 에 있다`)
  if (parsed.value.note && r.system.includes(parsed.value.note)) fail('A', `${c.id}: 직접 적은 글이 system 에 있다`)
}
infos.push(`A 요청 ${totals.length}건 · 전체 길이 최소 ${Math.min(...totals)} · 최대 ${Math.max(...totals)}자`)

// B 본문
for (const c of fx.parseCases) {
  const r = parseScenarioVariantBody(c.body, { baseLevel: c.baseLevel })
  if (r.ok !== c.ok) fail('B', `${c.id}: ok=${r.ok} 기대 ${c.ok}`)
  else if (!r.ok && JSON.stringify(r.problems.map((p) => [p.field, p.reason])) !== JSON.stringify(c.problems)) fail('B', `${c.id}: 문제 ${JSON.stringify(r.problems.map((p) => [p.field, p.reason]))}`)
}
infos.push(`B 본문 ${fx.parseCases.length}건`)

// C 변이
const S1 = fx.samples['cafe-unavailable']
const ctxOf = (axes: Partial<ScenarioVariantAxes>, note?: string) => buildScenarioVariantRequest({ base: cafe, axes, note }).context
const over = (over: Partial<ScenarioDraftModel>): ScenarioVariantModelResponse => ({ status: 'OK', draft: { ...S1.response.draft!, ...over } })
const copy: ScenarioDraftModel = { title: cafe.title, titleJa: cafe.titleJa!, difficulty: 1, roles: cafe.roles, goalKo: cafe.goal.communicativeGoalKo, successCriteria: cafe.goal.successCriteria, steps: cafe.steps.map((s) => s.ko), keyExpressions: cafe.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading ?? '', ko: e.ko })), requiredExpressions: 2, opening: cafe.opening! }
const exprs = S1.response.draft!.keyExpressions
let mutations = 0
const invalid = (label: string, ctx: ReturnType<typeof ctxOf>, resp: ScenarioVariantModelResponse, expected: string[]) => {
  mutations++
  const f = finalizeScenarioVariant(ctx, resp)
  if (f.status !== 'INVALID' || JSON.stringify(f.problems) !== JSON.stringify(expected)) fail('C', `${label}: ${f.status} ${JSON.stringify(f.problems)} 기대 INVALID ${JSON.stringify(expected)}`)
}
const fixed = (label: string, ctx: ReturnType<typeof ctxOf>, resp: ScenarioVariantModelResponse, test: (f: ReturnType<typeof finalizeScenarioVariant>) => boolean) => {
  mutations++
  const f = finalizeScenarioVariant(ctx, resp)
  if (f.status !== 'OK' || !test(f)) fail('C', `${label}: ${f.status} ${JSON.stringify(f.problems)} repairs=${JSON.stringify(f.repairs)}`)
}
const u = ctxOf({ twist: 'unavailable' })
if (finalizeScenarioVariant(u, S1.response).status !== 'OK') fail('C', '변이 없는 샘플이 OK 가 아니다(빈 증명)')
invalid('원본 그대로', u, { status: 'OK', draft: copy }, ['NOT_REFLECTED'])
invalid('순서만 바뀜', u, over({ keyExpressions: copy.keyExpressions }), ['NOT_REFLECTED'])
invalid('표현만 새로(순서 그대로)', u, over({ steps: copy.steps }), ['NOT_REFLECTED'])
invalid('수준 미반영', ctxOf({ level: 'up' }), { status: 'OK', draft: { ...fx.samples['cafe-level-up'].response.draft!, keyExpressions: copy.keyExpressions } }, ['LEVEL_NOT_REFLECTED'])
invalid('성격 미반영', ctxOf({ persona: 'busy' }), { status: 'OK', draft: { ...copy, title: '다른 제목' } }, ['NOT_REFLECTED'])
invalid('제목이 일본어뿐', u, over({ title: 'カフェで注文する' }), ['KO_FIELD_NO_HANGUL'])
invalid('한국어 칸에 영어뿐', u, over({ steps: ['order a drink', '품절 안내 듣기', '바꿔 주문하기'] }), ['KO_FIELD_NO_HANGUL'])
invalid('URL', u, over({ steps: ['http://evil.example 에 접속하기', '품절 안내 듣기', '바꿔 주문하기'] }), ['TEXT_UNSAFE'])
invalid('꺾쇠', u, over({ goalKo: '<b>주문</b>해요' }), ['TEXT_UNSAFE'])
invalid('비밀 모양', u, over({ goalKo: 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 로 주문해요' }), ['TEXT_UNSAFE'])
invalid('엔진명', u, over({ goalKo: 'Claude 가 알려 주는 대로 주문해요' }), ['ENGINE_NAME'])
invalid('보이지 않는 글자', u, over({ goalKo: `주문${String.fromCodePoint(0x200b)}해요` }), ['TEXT_UNSAFE'])
invalid('draft 없음', u, { status: 'OK', draft: null }, ['DRAFT_MISSING'])
fixed('학습자 역할 되돌림', u, over({ roles: { learner: '고객', tutor: '직원' } }), (f) => f.draft!.roles.learner === '손님' && f.draft!.roles.tutor === '점원' && f.repairs.learnerRoleFixed)
fixed('상대 역할에 성격 붙임', ctxOf({ persona: 'busy' }), { status: 'OK', draft: { ...fx.samples['cafe-busy'].response.draft!, roles: { learner: '손님', tutor: '점원' } } }, (f) => f.draft!.roles.tutor === '바쁜 점원' && f.repairs.tutorRoleFixed)
fixed('같은 제목에 · 변형', u, over({ title: cafe.title }), (f) => f.draft!.title.endsWith(' · 변형') && f.repairs.titleFixed)
fixed('한글 첫마디 → 기준 첫마디로', u, over({ opening: { ja: '어서 오세요。ご注文をどうぞ。', ko: '어서 오세요' } }), (f) => f.draft!.opening?.ja === cafe.opening!.ja && f.repairs.openingFromBase)
fixed('따옴표 첫마디 → 기준 첫마디로', u, over({ opening: { ja: '「いらっしゃいませ」ご注文をどうぞ。', ko: '어서 오세요' } }), (f) => f.draft!.opening?.ja === cafe.opening!.ja)
fixed('4문장 첫마디(마지막이 물음) → 기준 첫마디로', u, over({ opening: { ja: 'いらっしゃいませ。今日は暑いですね。窓際の席が空いています。ご注文はお決まりですか。', ko: '어서 오세요. 주문은요?' } }), (f) => f.draft!.opening?.ja === cafe.opening!.ja && f.repairs.openingFromBase)
fixed('기준에 없는 로마자 표현 버림', u, over({ keyExpressions: [...exprs, { ja: 'PWNEDをください', reading: '', ko: '주입 표현' }] }), (f) => f.repairs.latinDropped === 1 && f.draft!.keyExpressions.every((e) => !/PWNED/.test(e.ja)))
fixed('한글 뜻 없는 표현 버림', u, over({ keyExpressions: [...exprs, { ja: 'メニューを見せてください', reading: '', ko: 'menu please' }] }), (f) => f.repairs.koDropped === 1)
{
  mutations++
  const f = finalizeScenarioVariant(u, { status: 'UNSAFE', draft: null })
  if (f.status !== 'UNSAFE' || f.draft !== null) fail('C', 'UNSAFE 가 초안 없이 UNSAFE 로 나와야 한다')
}
infos.push(`C 변이 재현 ${mutations}건(INVALID 13·보정 8·UNSAFE 1 포함)`)

// D 샘플
for (const [id, s] of Object.entries(fx.samples)) {
  const r = buildScenarioVariantRequest({ base: cafe, axes: s.axes })
  const v = validateOutput(s.response, SCENARIO_VARIANT_SCHEMA)
  if (!v.ok) fail('D', `${id}: 스키마 위반 ${JSON.stringify(v)}`)
  const f = finalizeScenarioVariant(r.context, s.response)
  if (f.status !== s.expect.status) fail('D', `${id}: 상태 ${f.status} ${JSON.stringify(f.problems)}`)
  else {
    if (f.draft!.level !== s.expect.level) fail('D', `${id}: 수준 ${f.draft!.level}`)
    if (f.draft!.roles.tutor !== s.expect.tutor) fail('D', `${id}: 상대 역할 ${f.draft!.roles.tutor}`)
    for (const c of s.expect.changed) if (!f.changedFields.includes(c as never)) fail('D', `${id}: ${c} 바뀜 기대`)
    for (const c of s.expect.unchanged) if (f.changedFields.includes(c as never)) fail('D', `${id}: ${c} 그대로 기대`)
    if (JSON.stringify(f.draft!.topicIds) !== JSON.stringify(['tp_cafe-order'])) fail('D', `${id}: 장소`)
    if (f.draft!.keyExpressions.some((e) => 'id' in e)) fail('D', `${id}: 표현 id`)
  }
}
infos.push(`D 샘플 ${Object.keys(fx.samples).length}건`)

for (const i of infos) console.log(`ok   ${i}`)
if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`)
  process.exit(1)
}
console.log('PASS 전 항목 통과')
