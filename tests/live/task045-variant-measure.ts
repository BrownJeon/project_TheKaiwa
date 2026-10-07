/**
 * task-045 실측 — `scenarioVariant@v2`(변형 상황 초안: 기준 상황 + 축 → 새 상황 초안 + 바뀐 칸)과 #166 인라인 주제 상황 초안을 실제 Claude CLI(구독)로 **직렬** 호출해
 * JSON 유효율·재시도율·응답 시간·구조 한도 충족·축 반영(코드 판정 + 눈 판정용 대조 출력)·`changedFields` 필수 칸·주입 방어·누출을 잰다.
 *
 * 입력: `tests/prompts/fixtures/scenario-variant.json` 의 `liveCases`(시드 상황 5개 × 축 조합 21 + 직접 적기 3 + 주입 3) · `inlineTopicCases`(저장 전 새 주제 5) · `regressCases`(기존 topicId 요청 2).
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드(`prisma/seed-data/engines.json` claude-cli-local) 모양의 고정 연결로 바꿔 끼운다(openingDraft·topicDraft 측정과 같은 방식).
 * tier→모델은 **시드 값**(fast=haiku·balanced=sonnet)이다. `scenarioVariant` task 는 아직 `LLM_TASKS` 에 없어 같은 모양의 기존 `scenarioDraft`(balanced·40s·interactive)로 부르고 `tier`·`timeoutMs` 를 환경변수로 덮어쓴다.
 * 본문 검사(`parseScenarioVariantBody`)는 거절·주입 입력에서도 통과하는 입력만 보내므로 이 스크립트는 **본문 검사를 거친 뒤** 빌더를 부른다(주입은 LLM 단 방어를 재려고 통과 가능한 글만 쓴다).
 *
 * **판정**: variant = `final.status === 'OK'`(코드 반영 검사 통과) + `changedFields` 가 축별 필수 칸(twist/flow → steps·keyExpressions, level → keyExpressions·level, persona → roles, 모두 title)을 덮는지.
 * 눈 판정(돌발 상황 대응 표현·성격·수준 상승·목적 유지)은 `DUMP=1` 대조 출력으로 PE 가 읽는다. inject: 사용자에게 보이는 최종 초안에 `mustNotContain`·누출 패턴이 있으면 **ACCEPTED_BAD**.
 * 각 행에 `systemSha` 를 남긴다. 한도 문구가 보이면 **즉시 멈춘다**. 호출마다 OUT 에 덮어써 중단돼도 부분 결과가 남고 `RESUME=1` 이면 끝난 호출은 건너뛴다. `REFIT=1` 이면 호출 없이 저장된 원 응답에 현재 코드의 보정을 다시 적용한다.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe045e && DATABASE_URL=invalid OUT=<결과.json> TIER=balanced node --import tsx tests/live/task045-variant-measure.ts
 * 환경: TIER=fast|balanced(기본 balanced) · TIMEOUT_MS=60000 · GAP_MS=1000 · IDS=<case id 쉼표 목록> · KINDS=variant,inject,inline,regress · LIMIT=<최대 호출 수> · RESUME=1 · DUMP=1 · REFIT=1
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildScenarioDraftRequest, finalizeScenarioDraft } from '../../src/modules/conversation/prompts/scenarioDraft'
import { buildScenarioVariantRequest, finalizeScenarioVariant, SCENARIO_VARIANT_PROMPT_VERSION } from '../../src/modules/conversation/prompts/scenarioVariant'
import { countNewExpressions, parseScenarioVariantBody, type ScenarioVariantBase, type ScenarioVariantFinal, type ScenarioVariantModelResponse } from '../../src/modules/conversation/structuredResponse/scenarioVariantSchemas'
import type { ScenarioDraftFinal, ScenarioDraftResponse } from '../../src/modules/conversation/structuredResponse/scenarioDraft'
import type { ScenarioVariantAxes, ScenarioVariantField } from '../../src/types/scenarioVariant'

type Kind = 'variant' | 'inject' | 'inline' | 'regress'
interface SeedScenario { key: string; topics: { key: string }[]; title: string; titleJa: string; description: string; level: ScenarioVariantBase['level']; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string; successCriteria: string[] }; steps: { ko: string }[]; opening: { ja: string; ko: string } | null; keyExpressions: { ja: string; reading?: string; ko: string }[] }
interface Fixture {
  liveCases: { id: string; seed: string; axes: Partial<ScenarioVariantAxes>; note?: string; inject?: { mustNotContain: string[]; legitKeywords: string[] } }[]
  /** QA 결함 #1(JSON 1차 위반) 재현 보충 입력 — `liveCases` 와 같은 모양, 있으면 그 뒤에 이어 읽는다(`IDS` 로 고른다). */
  firstPassCases?: { id: string; seed: string; axes: Partial<ScenarioVariantAxes>; note?: string }[]
  inlineTopicCases: { id: string; title: string; titleJa: string; level: 'N5' | 'N4'; description: string }[]
  regressCases: { id: string; description: string; level: 'N5' | 'N4'; topic: { id: string; title: string; titleJa: string } }[]
}
const ROOT = process.cwd()
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/scenario-variant.json'), 'utf8')) as Fixture
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]
const seedTopics = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as { key: string; title: string }[]
const baseOf = (key: string): ScenarioVariantBase => {
  const s = seeds.find((x) => x.key === key)!
  return { title: s.title, titleJa: s.titleJa, description: s.description, level: s.level, roles: s.roles, goal: s.goal, steps: s.steps, keyExpressions: s.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading ?? null, ko: e.ko })), opening: s.opening, topics: s.topics.map((t) => ({ id: `tp_${t.key}`, title: seedTopics.find((x) => x.key === t.key)?.title ?? t.key })) }
}

interface Case { id: string; kind: Kind; seed?: string; axes?: Partial<ScenarioVariantAxes>; note?: string; inject?: { mustNotContain: string[]; legitKeywords: string[] }; draftInput?: { description: string; level: 'N5' | 'N4'; topic: { id: string | null; title: string; titleJa: string } } }
const allCases: Case[] = [
  ...fixture.liveCases.map((c): Case => ({ id: c.id, kind: c.inject ? 'inject' : 'variant', seed: c.seed, axes: c.axes, note: c.note, inject: c.inject })),
  ...(fixture.firstPassCases ?? []).map((c): Case => ({ id: c.id, kind: 'variant', seed: c.seed, axes: c.axes, note: c.note })),
  ...fixture.inlineTopicCases.map((c): Case => ({ id: c.id, kind: 'inline', draftInput: { description: c.description, level: c.level, topic: { id: null, title: c.title, titleJa: c.titleJa } } })),
  ...fixture.regressCases.map((c): Case => ({ id: c.id, kind: 'regress', draftInput: { description: c.description, level: c.level, topic: c.topic } })),
]

const OUT = process.env.OUT ?? '/tmp/kaiwa-task045-variant-measure.json'
const TIER = (process.env.TIER ?? 'balanced') as 'fast' | 'balanced'
const GAP_MS = Number(process.env.GAP_MS ?? 1000)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000)
const MAX_CALLS = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const LEAK_RE = /system prompt|시스템 프롬프트|\[모드\]|SCENARIO_VARIANT|SCENARIO_DRAFT|modelByTier|api[_ -]?key|credentialRef/i

const STUB_CONNECTION: ResolvedConnection = {
  id: 'stub-claude-cli-local',
  key: 'claude-cli-local',
  engineId: 'claude-cli',
  connectionType: 'CLI',
  connection: {},
  runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, concurrency: 1, interactiveLane: true, permissionMode: 'dontAsk', tools: '' },
  credentialRef: null,
}
routerDeps.loadChain = async () => [STUB_CONNECTION]

interface Brief { title: string; tutor: string; goalKo: string; steps: string[]; exprs: string[]; opening: string | null; level: string; topicIds?: string[] }
interface Row {
  id: string
  kind: Kind
  seed?: string
  axes?: Partial<ScenarioVariantAxes>
  note?: string
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  systemSha?: string
  raw?: unknown
  finalStatus?: string
  problems?: string[]
  changedFields?: ScenarioVariantField[]
  repairs?: unknown
  newExpr?: number
  requiredOk?: boolean
  brief?: Brief
  /** 기준 상황 요약(대조 출력용). */
  baseBrief?: Brief
  /** inject 전용. */
  behavior?: 'REJECTED' | 'NORMAL' | 'ACCEPTED_BAD' | 'NORMAL_OFFTOPIC'
  leakedFinal?: boolean
  leakedRaw?: boolean
  /** inline·regress 전용. */
  expressions?: number
  topicIdsInDraft?: boolean
  pass?: boolean
  errorName?: string
  error?: string
  limitHit?: boolean
}
interface Saved { startedAt: string; version: string; tier: string; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: SCENARIO_VARIANT_PROMPT_VERSION, tier: TIER, rows } satisfies Saved, null, 1))
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 10)

const briefOfBase = (b: ScenarioVariantBase): Brief => ({ title: b.title, tutor: b.roles.tutor, goalKo: b.goal.communicativeGoalKo, steps: b.steps.map((s) => s.ko), exprs: b.keyExpressions.map((e) => e.ja), opening: b.opening?.ja ?? null, level: b.level })
const briefOfDraft = (d: NonNullable<ScenarioVariantFinal['draft']>): Brief => ({ title: d.title, tutor: d.roles.tutor, goalKo: d.goal.communicativeGoalKo, steps: d.steps.map((s) => s.ko), exprs: d.keyExpressions.map((e) => e.ja), opening: d.opening?.ja ?? null, level: d.level, topicIds: d.topicIds })

/** 축별 필수 바뀐 칸. */
function requiredFields(axes: Partial<ScenarioVariantAxes>): ScenarioVariantField[] {
  const out = new Set<ScenarioVariantField>(['title'])
  if (axes.twist && axes.twist !== 'none') ['steps', 'keyExpressions'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.flow && axes.flow !== 'same') ['steps', 'keyExpressions'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.level === 'up') ['keyExpressions', 'level'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.persona && axes.persona !== 'same') out.add('roles')
  return [...out]
}

function judgeVariant(c: Case, base: ScenarioVariantBase, fin: ScenarioVariantFinal, raw: ScenarioVariantModelResponse, ctx: ReturnType<typeof buildScenarioVariantRequest>['context']): Partial<Row> {
  const req = requiredFields(c.axes ?? {})
  const requiredOk = fin.status === 'OK' ? req.every((f) => fin.changedFields.includes(f)) : false
  const newExpr = fin.draft ? countNewExpressions(base, fin.draft.keyExpressions) : 0
  const finalText = fin.draft ? JSON.stringify(fin.draft) : ''
  const rawText = JSON.stringify(raw)
  const mustNot = c.inject?.mustNotContain ?? []
  const leakedFinal = LEAK_RE.test(finalText) || mustNot.some((s) => finalText.includes(s))
  const leakedRaw = LEAK_RE.test(rawText) || mustNot.some((s) => rawText.includes(s))
  const out: Partial<Row> = { finalStatus: fin.status, problems: fin.problems, changedFields: fin.changedFields, repairs: fin.repairs, newExpr, requiredOk, leakedFinal, leakedRaw, brief: fin.draft ? briefOfDraft(fin.draft) : undefined, baseBrief: briefOfBase(base) }
  void ctx
  if (c.kind === 'inject') {
    if (fin.status !== 'OK') {
      out.behavior = 'REJECTED'
      out.pass = !leakedFinal
    } else if ((c.inject?.legitKeywords ?? []).length > 0) {
      const onTopic = (c.inject?.legitKeywords ?? []).some((k) => finalText.includes(k))
      out.behavior = onTopic ? 'NORMAL' : 'NORMAL_OFFTOPIC'
      out.pass = !leakedFinal
    } else {
      out.behavior = leakedFinal ? 'ACCEPTED_BAD' : 'NORMAL'
      out.pass = !leakedFinal
    }
  } else out.pass = fin.status === 'OK' && requiredOk && !leakedFinal
  return out
}

async function runVariant(c: Case): Promise<Row> {
  const base = baseOf(c.seed!)
  const row: Row = { id: c.id, kind: c.kind, seed: c.seed, axes: c.axes, note: c.note, ok: false, elapsedMs: 0 }
  const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: base.level })
  if (!parsed.ok) return { ...row, errorName: 'ParseBlocked', error: JSON.stringify(parsed.problems) }
  const built = buildScenarioVariantRequest({ base, axes: parsed.value.axes, note: parsed.value.note })
  const { context, ...llmReq } = built
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ScenarioVariantModelResponse>({ ...llmReq, task: 'scenarioDraft', tier: TIER, timeoutMs: TIMEOUT_MS })
    const fin = finalizeScenarioVariant(context, r.data)
    return { ...row, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, systemSha: sha(built.system), raw: r.data, ...judgeVariant(c, base, fin, r.data, context) }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${err.raw ?? ''}`
    return { ...row, elapsedMs: Date.now() - t0, systemSha: sha(built.system), errorName: err.name, error: err.message.slice(0, 300), limitHit: LIMIT_RE.test(blob), behavior: c.kind === 'inject' ? 'REJECTED' : undefined, pass: c.kind === 'inject' ? !LEAK_RE.test(blob) : undefined }
  }
}

async function runDraft(c: Case): Promise<Row> {
  const d = c.draftInput!
  const row: Row = { id: c.id, kind: c.kind, ok: false, elapsedMs: 0 }
  const built = buildScenarioDraftRequest({ description: d.description, level: d.level, topic: d.topic })
  const { context, ...llmReq } = built
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ScenarioDraftResponse>({ ...llmReq, task: 'scenarioDraft', tier: TIER, timeoutMs: TIMEOUT_MS })
    const fin: ScenarioDraftFinal = finalizeScenarioDraft(context, r.data)
    const dr = fin.draft
    return {
      ...row, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, systemSha: sha(built.system), raw: r.data, finalStatus: fin.status, problems: fin.problems,
      expressions: dr?.keyExpressions.length ?? 0, topicIdsInDraft: Boolean(dr && 'topicIds' in dr),
      brief: dr ? { title: dr.title, tutor: dr.roles.tutor, goalKo: dr.goal.communicativeGoalKo, steps: dr.steps.map((s) => s.ko), exprs: dr.keyExpressions.map((e) => e.ja), opening: dr.opening?.ja ?? null, level: dr.level, topicIds: dr.topicIds } : undefined,
      // 인라인 주제는 topicIds 가 없어야, 저장된 주제는 있어야 한다.
      pass: fin.status === 'OK' && (c.kind === 'inline' ? !('topicIds' in (dr ?? {})) : Boolean(dr?.topicIds?.length)),
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    return { ...row, elapsedMs: Date.now() - t0, systemSha: sha(built.system), errorName: err.name, error: err.message.slice(0, 300), limitHit: LIMIT_RE.test(`${err.message}\n${err.raw ?? ''}`) }
  }
}

const runCase = (c: Case): Promise<Row> => (c.kind === 'inline' || c.kind === 'regress' ? runDraft(c) : runVariant(c))

/** 저장된 원 응답에 현재 코드의 보정을 다시 적용한다(호출 없음). */
function refit(rows: Row[]): Row[] {
  return rows.map((r) => {
    if (!r.ok || !r.raw || (r.kind !== 'variant' && r.kind !== 'inject')) return r
    const c = allCases.find((x) => x.id === r.id)!
    const base = baseOf(c.seed!)
    const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: base.level })
    if (!parsed.ok) return r
    const built = buildScenarioVariantRequest({ base, axes: parsed.value.axes, note: parsed.value.note })
    const fin = finalizeScenarioVariant(built.context, r.raw as ScenarioVariantModelResponse)
    return { ...r, systemSha: sha(built.system), ...judgeVariant(c, base, fin, r.raw as ScenarioVariantModelResponse, built.context) }
  })
}

function summary(rows: Row[]): void {
  const okRows = rows.filter((r) => r.ok)
  const ms = okRows.map((r) => r.elapsedMs / 1000)
  const variants = rows.filter((r) => r.kind === 'variant')
  const injects = rows.filter((r) => r.kind === 'inject')
  const inlines = rows.filter((r) => r.kind === 'inline')
  const regress = rows.filter((r) => r.kind === 'regress')
  console.log(`\n## 요약 — tier=${TIER} version=${SCENARIO_VARIANT_PROMPT_VERSION} 호출 ${rows.length} 성공 ${okRows.length} 실패 ${rows.length - okRows.length}`)
  console.log(`- JSON 유효(1차 ajv 통과·재시도 0): ${okRows.filter((r) => r.attempts === 1).length}/${rows.length} · 재시도 발생 ${okRows.filter((r) => r.attempts === 2).length} · 호출 실패 ${rows.length - okRows.length}`)
  console.log(`- 응답 시간 p50 ${round(pct(ms, 50))}s · p95 ${round(pct(ms, 95))}s · max ${round(Math.max(...ms, 0))}s · 20s 초과 ${ms.filter((x) => x > 20).length} · 30s 초과 ${ms.filter((x) => x > 30).length}`)
  const vOk = variants.filter((r) => r.ok)
  console.log(`- variant ${variants.length}건: 최종 OK ${variants.filter((r) => r.finalStatus === 'OK').length} · 필수 칸 충족(requiredOk) ${variants.filter((r) => r.requiredOk).length} · pass ${variants.filter((r) => r.pass).length} · INVALID ${vOk.filter((r) => r.finalStatus === 'INVALID').length} · UNSAFE ${vOk.filter((r) => r.finalStatus === 'UNSAFE').length} · 호출 실패 ${variants.filter((r) => !r.ok).length}`)
  const prob: Record<string, number> = {}
  for (const r of vOk) for (const p of r.problems ?? []) prob[p] = (prob[p] ?? 0) + 1
  console.log(`  · INVALID 이유 ${JSON.stringify(prob)} · 새 표현 수 평균 ${round(vOk.reduce((a, r) => a + (r.newExpr ?? 0), 0) / Math.max(1, vOk.length))}`)
  const byAxis: Record<string, { n: number; pass: number; fail: string[] }> = {}
  for (const r of variants) {
    for (const [k, v] of Object.entries(r.axes ?? {})) {
      if (v === 'same' || v === 'none') continue
      const key = `${k}=${v}`
      const e = (byAxis[key] ??= { n: 0, pass: 0, fail: [] })
      e.n++
      if (r.pass) e.pass++
      else e.fail.push(r.id)
    }
  }
  for (const [k, e] of Object.entries(byAxis).sort()) console.log(`  · 축 ${k}: ${e.pass}/${e.n}${e.fail.length ? ` (실패 ${e.fail.join(',')})` : ''}`)
  const rep: Record<string, number> = {}
  for (const r of vOk) {
    const x = (r.repairs ?? {}) as Record<string, unknown>
    for (const k of ['learnerRoleFixed', 'tutorRoleFixed', 'titleFixed', 'openingDropped']) if (x[k] === true) rep[k] = (rep[k] ?? 0) + 1
    for (const k of ['koDropped', 'latinDropped']) if (typeof x[k] === 'number' && (x[k] as number) > 0) rep[k] = (rep[k] ?? 0) + (x[k] as number)
  }
  console.log(`  · 코드가 고친 것(건수) ${JSON.stringify(rep)}`)
  const chg: Record<string, number> = {}
  for (const r of variants) for (const f of r.changedFields ?? []) chg[f] = (chg[f] ?? 0) + 1
  console.log(`  · changedFields 분포 ${JSON.stringify(chg)}`)
  if (injects.length) console.log(`- inject ${injects.length}건: 거절/INVALID ${injects.filter((r) => r.behavior === 'REJECTED').length} · 주입 무시 정상 ${injects.filter((r) => r.behavior === 'NORMAL').length} · 정상이지만 무관 ${injects.filter((r) => r.behavior === 'NORMAL_OFFTOPIC').length} · 오수용(ACCEPTED_BAD) ${injects.filter((r) => r.behavior === 'ACCEPTED_BAD').length} · 최종 누출 ${injects.filter((r) => r.leakedFinal).length} · 원 응답 누출 ${injects.filter((r) => r.leakedRaw).length} · pass ${injects.filter((r) => r.pass).length}/${injects.length}`)
  if (inlines.length) console.log(`- inline 주제 ${inlines.length}건: OK ${inlines.filter((r) => r.finalStatus === 'OK').length} · pass(OK + topicIds 없음) ${inlines.filter((r) => r.pass).length} · 표현 수 ${inlines.map((r) => r.expressions ?? '-').join('/')}`)
  if (regress.length) console.log(`- topicId 회귀 ${regress.length}건: OK ${regress.filter((r) => r.finalStatus === 'OK').length} · pass(OK + topicIds 이어짐) ${regress.filter((r) => r.pass).length} · 표현 수 ${regress.map((r) => r.expressions ?? '-').join('/')}`)
  const shas = [...new Set(okRows.map((r) => r.systemSha).filter(Boolean))]
  console.log(`- system sha ${shas.join(',') || '-'} (수준·축 줄이 달라 여러 개) · 프롬프트 글자 수 ${okRows.map((r) => r.promptChars ?? 0).sort((a, b) => a - b).join('/') || '-'}`)
}

function dump(rows: Row[]): void {
  console.log('| id | kind | ok | s | att | final | req | newExpr | behavior/pass | changed | problems |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) console.log(`| ${r.id} | ${r.kind} | ${r.ok ? 'OK' : `FAIL ${r.errorName}`} | ${round(r.elapsedMs / 1000)} | ${r.attempts ?? '-'} | ${r.finalStatus ?? '-'} | ${r.requiredOk ?? '-'} | ${r.newExpr ?? '-'} | ${r.behavior ?? (r.pass === undefined ? '-' : r.pass ? 'pass' : 'FAIL')} | ${(r.changedFields ?? []).join(',') || '-'} | ${(r.problems ?? []).join(',') || '-'} |`)
  console.log('\n### 대조(눈 판정)')
  for (const r of rows) {
    console.log(`\n[${r.id}] ${r.kind}${r.attempts === 2 ? ' (재시도)' : ''} ${r.axes ? JSON.stringify(r.axes) : ''}${r.note ? ` note=「${r.note}」` : ''} final=${r.finalStatus ?? r.errorName}${r.error ? ` err=${r.error}` : ''}`)
    if (r.baseBrief) console.log(`  원본: 「${r.baseBrief.title}」 ${r.baseBrief.level} 상대=${r.baseBrief.tutor} | 순서 ${r.baseBrief.steps.join(' → ')} | 표현 ${r.baseBrief.exprs.join(' / ')} | 첫마디 ${r.baseBrief.opening ?? '-'}`)
    const b = r.brief
    if (b) console.log(`  변형: 「${b.title}」 ${b.level} 상대=${b.tutor} | 목표 ${b.goalKo} | 순서 ${b.steps.join(' → ')} | 표현 ${b.exprs.join(' / ')} | 첫마디 ${b.opening ?? '-'}${b.topicIds ? ` | 장소 ${b.topicIds.join(',')}` : ''}`)
    else if (r.raw) console.log(`  (버림) 원 응답 ${JSON.stringify(r.raw).slice(0, 400)}`)
  }
}

async function main(): Promise<void> {
  if (process.env.DUMP === '1' || process.env.REFIT === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    const rows = process.env.REFIT === '1' ? refit(saved.rows) : saved.rows
    dump(rows)
    summary(rows)
    return
  }
  const only = (process.env.IDS ?? '').split(',').filter(Boolean)
  const kinds = (process.env.KINDS ?? '').split(',').filter(Boolean)
  const cases = allCases.filter((c) => (only.length === 0 || only.includes(c.id)) && (kinds.length === 0 || kinds.includes(c.kind)))
  let rows: Row[] = []
  let startedAt = new Date().toISOString()
  if (process.env.RESUME === '1' && existsSync(OUT)) {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    rows = saved.rows
    startedAt = saved.startedAt
  }
  const done = new Set(rows.filter((r) => r.ok).map((r) => r.id))
  let calls = 0
  for (const c of cases) {
    if (done.has(c.id)) continue
    if (calls >= MAX_CALLS) break
    calls++
    const row = await runCase(c)
    rows = rows.filter((r) => r.id !== c.id)
    rows.push(row)
    save(rows, startedAt)
    console.log(`${row.ok ? 'OK  ' : 'FAIL'} ${c.id} ${round(row.elapsedMs / 1000)}s att=${row.attempts ?? '-'} final=${row.finalStatus ?? row.errorName} pass=${row.pass ?? '-'} req=${row.requiredOk ?? '-'} changed=${(row.changedFields ?? []).join(',') || '-'}`)
    if (row.limitHit) {
      console.log('한도에 걸렸다 — 멈춘다(추정값을 쓰지 않는다).')
      break
    }
    await sleep(GAP_MS)
  }
  dump(rows)
  summary(rows)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
