/**
 * task-045 PE — `scenarioVariant@v3` 오프라인 점검. **결정적·LLM 0·DB 0**(일회용 점검 스크립트, 단위 시험 `scenarioVariant.test.ts` 와 같은 코드를 다른 눈으로 한 번 더 본다).
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
 *   E 지시문 중립(REV-153 M-2)  중립 기준(가상 상황)으로 모든 축·수준 조합(474건)의 요청 전체와, 라이브 케이스 27건의 고정 지시문(system·persona·스키마)에 장면 단어(카페·결제·품절·コンビニ …)가 0 — 금지 목록은 fixtures `instructionNeutrality.forbidden`
 *   F 한도 점검(v2)  라이브 케이스 27건의 system 끝(마지막 두 줄 = 숫자 한도 점검 줄 + [출력])이 스키마 한도와 같은 숫자인지 · QA 가 본 1차 위반 두 모양(성공 조건 4개·40자 초과)이 스키마에서 그 이유로 걸리는지 · 시드 상황 성공 조건 개수·길이(정보)
 *   G 반영 점검(v3)  라이브 케이스 27건의 system 끝에서 세 번째 줄이 반영 점검 줄(새 표현 3개·완결된 문장)인지 · suggest 설명이 권유·대답 단계를 요구하는지 · QA(길 묻기×suggest) NOT_REFLECTED 재현 응답 쌍이 기대대로(midBlank → INVALID, 완결 문장 → OK·새 표현 ≥3) · 새 문구에 장면 단어 0
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTranscript } from '../../src/modules/engine/llm'
import { llm } from '../../src/modules/engine'
import { validateOutput, withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { buildScenarioVariantRequest, finalizeScenarioVariant, SCENARIO_VARIANT_AXIS_RULES, SCENARIO_VARIANT_CRITERION_TYPICAL, SCENARIO_VARIANT_NEW_EXPRESSIONS_MIN, SCENARIO_VARIANT_PROMPT_VERSION, SCENARIO_VARIANT_REFLECT_LINE } from '../../src/modules/conversation/prompts/scenarioVariant'
import { countNewExpressions, parseScenarioVariantBody, SCENARIO_VARIANT_SCHEMA, type ScenarioVariantBase, type ScenarioVariantModelResponse } from '../../src/modules/conversation/structuredResponse/scenarioVariantSchemas'
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
  instructionNeutrality: { base: ScenarioVariantBase; forbidden: string[] }
  v3Regression: { seed: string; axes: Partial<ScenarioVariantAxes>; common: Omit<ScenarioDraftModel, 'keyExpressions'>; midBlankExpressions: ScenarioDraftModel['keyExpressions']; completeExpressions: ScenarioDraftModel['keyExpressions'] }
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

// E 지시문 중립 — 고정 지시문(system·persona·스키마)에 장면 단어가 있으면 서비스 장면이 아닌 기준에서도 모델이 베낀다
{
  const words = fx.instructionNeutrality.forbidden
  const hitsIn = (text: string) => words.filter((w) => text.toLowerCase().includes(w.toLowerCase()))
  if (hitsIn('결제 · カード').length !== 2) fail('E', '대조 함수가 장면 단어를 못 잡는다(빈 증명)')
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
  let built = 0
  for (const level of levels) for (const persona of ['same', 'kind', 'busy', 'picky'] as const) for (const twist of ['none', 'unavailable', 'mishear', 'trouble'] as const) for (const flow of ['same', 'suggest', 'rephrase'] as const) for (const lv of ['same', 'up'] as const) {
    let r: ReturnType<typeof buildScenarioVariantRequest>
    try {
      r = buildScenarioVariantRequest({ base: { ...fx.instructionNeutrality.base, level }, axes: { persona, twist, flow, level: lv } })
    } catch {
      continue
    }
    built++
    const rendered = renderTranscript(withJsonOnly(r.system, r.jsonSchema!), r.messages)
    const hits = hitsIn([r.system, r.persona!.prompt, r.messages[0].content, JSON.stringify(r.jsonSchema), rendered].join('\n'))
    if (hits.length) fail('E', `${level}/${persona}/${twist}/${flow}/${lv}: 장면 단어 ${hits.join(',')}`)
  }
  if (built !== 474) fail('E', `만들어진 조합 ${built} (기대 474)`)
  let live = 0
  for (const c of fx.liveCases) {
    const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: baseOf(c.seed).level })
    if (!parsed.ok) continue
    const r = buildScenarioVariantRequest({ base: baseOf(c.seed), axes: parsed.value.axes, note: parsed.value.note })
    live++
    const hits = hitsIn([r.system, r.persona!.prompt, JSON.stringify(r.jsonSchema)].join('\n'))
    if (hits.length) fail('E', `${c.id}: 고정 지시문에 장면 단어 ${hits.join(',')}`)
  }
  infos.push(`E 지시문 중립 — 중립 기준 ${built}조합 · 라이브 ${live}건 · 금지 어휘 ${words.length}개`)
}

// F 한도 점검(v2) — JSON 1차 위반(성공 조건 4개·40자 초과)을 부르던 한도 문구가 출력 규칙 가까이에 스키마와 같은 숫자로 있는가
{
  const dp = SCENARIO_VARIANT_SCHEMA.properties.draft.anyOf[1].properties
  const maxItems = dp.successCriteria.maxItems
  const maxLen = dp.successCriteria.items.maxLength
  const need = [
    `successCriteria 는 최대 ${maxItems}개이고 항목마다 ${maxLen}자 이내`,
    `title ${dp.title.maxLength}자`,
    `titleJa ${dp.titleJa.maxLength}자`,
    `roles 각 ${dp.roles.properties.learner.maxLength}자`,
    `goalKo ${dp.goalKo.maxLength}자`,
    `steps 각 ${dp.steps.items.maxLength}자(최대 ${dp.steps.maxItems}개)`,
    `opening.ja ${dp.opening.properties.ja.maxLength}자`,
    `opening.ko ${dp.opening.properties.ko.maxLength}자`,
  ]
  let live = 0
  for (const c of fx.liveCases) {
    const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: baseOf(c.seed).level })
    if (!parsed.ok) continue
    const r = buildScenarioVariantRequest({ base: baseOf(c.seed), axes: parsed.value.axes, note: parsed.value.note })
    live++
    const lines = r.system.split('\n')
    const lim = lines[lines.length - 2]
    const out = lines[lines.length - 1]
    if (!lim.startsWith('- 한도 점검(내보내기 전에 센다)')) fail('F', `${c.id}: 끝에서 두 번째 줄이 한도 점검이 아니다`)
    for (const piece of need) if (!lim.includes(piece)) fail('F', `${c.id}: 한도 점검 줄에 「${piece}」 없음`)
    if (!out.startsWith('[출력]') || !out.includes(`successCriteria 최대 ${maxItems}개·각 ${maxLen}자 이내`)) fail('F', `${c.id}: [출력] 줄에 한도 재확인 없음`)
  }
  // QA 라이브가 본 1차 위반 두 모양 — 스키마가 그 이유로 거절하는가(빈 증명 방지: 3개·짧은 항목은 통과)
  const ok = fx.samples['cafe-busy'].response.draft!
  const crit = ['이름을 말해요', '하는 일을 말해요', '사는 곳을 말해요']
  const run = (successCriteria: string[]) => validateOutput({ status: 'OK', draft: { ...ok, successCriteria } }, SCENARIO_VARIANT_SCHEMA)
  if (!run(crit).ok) fail('F', '3개·짧은 항목이 스키마를 통과하지 못한다(빈 증명)')
  const four = run([...crit, '못 알아들으면 다시 말해요'])
  if (four.ok || !JSON.stringify(four).includes('successCriteria')) fail('F', `성공 조건 4개가 스키마에서 걸리지 않는다: ${JSON.stringify(four)}`)
  const long = run([crit[0], crit[1], '가'.repeat(maxLen + 1)])
  if (long.ok || !JSON.stringify(long).includes('successCriteria')) fail('F', `성공 조건 ${maxLen + 1}자가 스키마에서 걸리지 않는다: ${JSON.stringify(long)}`)
  const lens = seeds.map((s) => `${s.goal.successCriteria.length}개/최대 ${Math.max(...s.goal.successCriteria.map((x) => Array.from(x).length))}자`)
  infos.push(`F 한도 점검 — 라이브 ${live}건 · 시드 상황 성공 조건 ${[...new Set(lens)].join(' · ')}(기준이 이미 상한이면 4번째 항목을 더하기 쉽다)`)
}

// G 반영 점검(v3) — suggest 축 NOT_REFLECTED(QA qa-045-llm-h): 새 표현이 〜 가운데 빈칸 틀이면 코드가 버려 새 표현이 모자란다 → 지시문이 완결된 문장·새 표현 3개·권유/대답 단계를 요구하는가
{
  if (SCENARIO_VARIANT_PROMPT_VERSION !== 'scenarioVariant@v3') fail('G', `버전 ${SCENARIO_VARIANT_PROMPT_VERSION}`)
  const needReflect = [
    '[변경]에 적힌 축마다 steps 에 그 변화가 일어나는 단계가 따로 있고',
    `원본에 없던 새 표현이 ${SCENARIO_VARIANT_NEW_EXPRESSIONS_MIN}개 이상 있는지`,
    '〜 로 비우지 않고 낱말까지 정한 완결된 문장',
    '가운데에 〜 가 있는 표현',
    '원본과 겹치는 표현은 새 표현으로 세어지지 않습니다',
  ]
  let live = 0
  for (const c of fx.liveCases) {
    const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: baseOf(c.seed).level })
    if (!parsed.ok) continue
    const r = buildScenarioVariantRequest({ base: baseOf(c.seed), axes: parsed.value.axes, note: parsed.value.note })
    live++
    const lines = r.system.split('\n')
    if (lines[lines.length - 3] !== SCENARIO_VARIANT_REFLECT_LINE) fail('G', `${c.id}: 끝에서 세 번째 줄이 반영 점검이 아니다`)
    for (const piece of needReflect) if (!SCENARIO_VARIANT_REFLECT_LINE.includes(piece)) fail('G', `반영 점검 줄에 「${piece}」 없음`)
    const expr = lines.find((l) => l.startsWith('- keyExpressions:')) ?? ''
    if (!expr.includes(`새 표현이 ${SCENARIO_VARIANT_NEW_EXPRESSIONS_MIN}개 이상이어야 합니다`) || expr.includes('빈자리를 〜 로 둔 틀도 좋지만') || !expr.includes('따라서 빈자리 틀로 만들지 않습니다')) fail('G', `${c.id}: keyExpressions 줄이 v3 문구가 아니다`)
    const goal = lines.find((l) => l.startsWith('- goalKo:')) ?? ''
    if (!goal.includes(`보통 ${SCENARIO_VARIANT_CRITERION_TYPICAL}자 안팎의 한 문장`) || !goal.includes('한 항목에는 학습자의 행동 하나만 담고')) fail('G', `${c.id}: goalKo 줄에 성공 조건 길이 문구 없음`)
    const suggest = c.axes.flow === 'suggest'
    if (suggest !== r.system.includes('다른 선택지를 권하는 단계와 학습자가 대답하는 단계를 넣고')) fail('G', `${c.id}: suggest 설명은 suggest 를 고른 호출에만`)
  }
  const words = fx.instructionNeutrality.forbidden
  const newText = [SCENARIO_VARIANT_REFLECT_LINE, SCENARIO_VARIANT_AXIS_RULES.flow.suggest].join('\n')
  const hit = words.filter((w) => newText.toLowerCase().includes(w.toLowerCase()))
  if (hit.length) fail('G', `새 문구에 장면 단어 ${hit.join(',')}`)

  // QA 재현 응답 쌍
  const v = fx.v3Regression
  const base = baseOf(v.seed)
  const ctx = buildScenarioVariantRequest({ base, axes: v.axes }).context
  const respond = (keyExpressions: ScenarioDraftModel['keyExpressions']): ScenarioVariantModelResponse => ({ status: 'OK', draft: { ...v.common, keyExpressions } as ScenarioDraftModel })
  for (const [name, exprs] of [['midBlank', v.midBlankExpressions], ['complete', v.completeExpressions]] as const) {
    const sv = validateOutput(respond(exprs), SCENARIO_VARIANT_SCHEMA)
    if (!sv.ok) fail('G', `${name}: 재현 응답이 스키마를 못 통과한다(빈 증명) ${JSON.stringify(sv)}`)
  }
  const bad = finalizeScenarioVariant(ctx, respond(v.midBlankExpressions))
  if (bad.status !== 'INVALID' || JSON.stringify(bad.problems) !== '["NOT_REFLECTED"]') fail('G', `midBlank 재현: ${bad.status} ${JSON.stringify(bad.problems)}`)
  const good = finalizeScenarioVariant(ctx, respond(v.completeExpressions))
  const newN = good.draft ? countNewExpressions(base, good.draft.keyExpressions) : 0
  if (good.status !== 'OK' || newN < SCENARIO_VARIANT_NEW_EXPRESSIONS_MIN) fail('G', `완결 문장 응답: ${good.status} 새 표현 ${newN}`)
  infos.push(`G 반영 점검(v3) — 라이브 ${live}건 · 재현 쌍(midBlank → INVALID·완결 → OK·새 표현 ${newN}개) · 새 문구 장면 단어 0`)
}

for (const i of infos) console.log(`ok   ${i}`)
if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`)
  process.exit(1)
}
console.log('PASS 전 항목 통과')
