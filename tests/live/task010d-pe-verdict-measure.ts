/**
 * task-010d A1-PE 실측 — 역할극 종료 판정 `scenarioVerdict@v1` 을 실제 Claude CLI(구독)로 **직렬** 호출해 계약·정확도·지연을 잰다.
 * 합성 대화만 쓴다(`tests/prompts/fixtures/scenario-verdict.json` 의 8건 — 학습자 데이터 없음).
 *
 * 재는 것: ① 1차 통과율(재시도 없이 ajv 통과 = attempts 1) · 최종 실패 ② 지연 p50/p95(>20s 따로 계수 — Leader 승인 상한 20s) ③ 픽스처 일치도 — goalAchieved(기대가 null 아닌 칸)·
 * communicationSuccess(null 아닌 칸) ④ 근거 없는 인정: 모델이 댄 증거 중 코드 대조(학습자 말에 글자 그대로 있는가)로 버려진 수, 함정 표현(`mustNotUse`)이 최종 쓴 표현에 들어간 수,
 * 정답 표현(`mustUse`)이 빠진 수 ⑤ stepsReached 하한 ⑥ 완벽 판정이 아니라 **모델 판정을 코드에 넣은 결과(outcome)** 가 기대(`outcomeByCode`)와 같은가.
 *
 * **DB 를 읽지도 쓰지도 않는다** — `engine/router` 의 `routerDeps.loadChain` 을 시드(claude-cli-local) 모양 고정 연결로 바꿔 끼운다(task-042 측정 스크립트와 같은 관례).
 * tier→모델은 시드 값(fast=haiku·balanced=sonnet). `scenarioVerdict` task 가 아직 `LLM_TASKS` 에 없어(developer 몫) 같은 모양인 `wordEnrich`(interactive) 로 부르되 tier·timeout 은 덮어쓴다.
 * 한도(429·session limit·한도)가 보이면 **즉시 멈춘다** — 추정값을 쓰지 않는다. 호출마다 OUT 에 덮어써 중단돼도 부분 결과가 남고, `RESUME=1` 이면 끝난 호출은 건너뛴다.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-010d-a && OUT=<결과.json> TIER=fast REPEAT=2 node --import tsx tests/live/task010d-pe-verdict-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · REPEAT=<대화당 반복 수, 기본 2> · GAP_MS=1500 · TIMEOUT_MS=45000 · ONLY=<대화 id 쉼표 목록> · RESUME=1 · DUMP=1(결과 파일만 읽어 표 출력)
 * SET=variants → 본 세트(9건) 대신 `variants`(x10 정중형 변형·x11 뜻만 비슷한 낱말 함정)를 잰다 — 코드 매칭이 못 잡는 변형을 모델 증거가 살리는지(`variantCredited`)·함정을 거르는지 본다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import {
  SCENARIO_VERDICT_PROMPT_VERSION,
  buildScenarioVerdictRequest,
  finalizeScenarioVerdictFor,
  type ScenarioVerdictInput,
  type ScenarioVerdictTurn,
} from '../../src/modules/conversation/prompts/scenarioVerdict'
import { scenarioPromptParts } from '../../src/modules/conversation/prompts/scenarioInput'
import type { ScenarioVerdictResponse } from '../../src/modules/conversation/structuredResponse/scenarioVerdict'
import { detectScenarioExpressions, judgeScenarioCompletion, readScenarioExpressions, scenarioRequiredExpressions } from '../../src/modules/learning'

interface FxScenario { roles: { learner: string; tutor: string }; goalKo: string; successCriteria: string[]; steps: { ko: string }[]; keyExpressions: Record<string, string>[]; completionRule: Record<string, unknown> }
interface FxConv {
  id: string
  label: string
  scenario: string
  endedBy: 'LEARNER' | 'TUTOR'
  turns: ScenarioVerdictTurn[]
  expect: { goalAchieved: boolean | null; communicationSuccess: boolean | null; mustUse: string[]; mustNotUse: string[]; stepsReachedMin: number; outcomeByCode: string | null; variantUse?: string[] }
}
interface FxVariant extends Omit<FxConv, 'expect'> {
  expect: { goalAchieved: boolean | null; communicationSuccess: boolean | null; codeVerified: string[]; variantUse: string[]; mustNotUse: string[]; stepsReachedMin: number; outcomeIfVariantCredited: string | null; outcomeIfOnlyCode: string | null }
}
const fxRaw = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/scenario-verdict.json'), 'utf8')) as { scenarios: Record<string, FxScenario>; conversations: FxConv[]; variants: FxVariant[] }
const VARIANTS = process.env.SET === 'variants'
// 변형 세트는 본 세트 모양(expect)으로 접어 같은 측정 경로를 쓴다 — 코드 확인 id 가 mustUse, 변형 인정 기대는 variantUse(추가 칸).
const fx = {
  scenarios: fxRaw.scenarios,
  conversations: VARIANTS
    ? fxRaw.variants.map((v): FxConv => ({ ...v, expect: { goalAchieved: v.expect.goalAchieved, communicationSuccess: v.expect.communicationSuccess, mustUse: v.expect.codeVerified, mustNotUse: v.expect.mustNotUse, stepsReachedMin: v.expect.stepsReachedMin, outcomeByCode: null, variantUse: v.expect.variantUse } }))
    : fxRaw.conversations,
}
const variantExpect = (id: string) => fxRaw.variants?.find((v) => v.id === id)?.expect

const OUT = process.env.OUT ?? '/tmp/kaiwa-task010d-verdict-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const REPEAT = Number(process.env.REPEAT ?? 2)
const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 45_000)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const BUDGET_MS = 20_000

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

interface Row {
  id: string
  conv: string
  rep: number
  tier: string
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  response?: ScenarioVerdictResponse
  goalAchieved?: boolean
  communicationSuccess?: boolean
  goalMatch?: boolean | null
  commMatch?: boolean | null
  used?: string[]
  missed?: string[]
  verified?: string[]
  claimed?: number
  rejected?: { id: string; reason: string }[]
  trapCredited?: string[]
  mustUseMissing?: string[]
  variantCredited?: string[]
  variantMissing?: string[]
  stepsReached?: number
  stepsOk?: boolean
  outcome?: string
  outcomeMatch?: boolean | null
  overBudget?: boolean
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

function save(rows: Row[], startedAt: string) {
  const out: Saved = { startedAt, version: SCENARIO_VERDICT_PROMPT_VERSION, tier: TIER, rows }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

function inputFor(c: FxConv): { input: ScenarioVerdictInput; expressionIds: string[]; required: number; stepCount: number } {
  const sc = fx.scenarios[c.scenario]
  const parts = scenarioPromptParts({ roles: sc.roles, goal: { communicativeGoal_ko: sc.goalKo, successCriteria: sc.successCriteria, steps: sc.steps }, keyExpressions: sc.keyExpressions, completionRule: sc.completionRule })
  const exprs = readScenarioExpressions(sc.keyExpressions)
  const verified = detectScenarioExpressions(c.turns.filter((t) => t.role === 'learner').map((t) => t.text), exprs)
  return { input: { ...parts.verdict, level: 'N5', turns: c.turns, verifiedExpressionIds: verified, endedBy: c.endedBy }, expressionIds: parts.expressionIds, required: parts.verdict.requiredExpressions, stepCount: sc.steps.length }
}

async function runCall(c: FxConv, rep: number): Promise<Row> {
  const { input, expressionIds, required } = inputFor(c)
  const req = buildScenarioVerdictRequest(input)
  const base: Row = { id: `${c.id}#${rep}`, conv: c.id, rep, tier: TIER, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    // 같은 모양의 기존 task(wordEnrich: interactive)로 부르되 tier·timeout 은 이 측정 값으로 덮어쓴다.
    const r = await llm.completeJson<ScenarioVerdictResponse>({ ...req, task: 'wordEnrich', tier: TIER, timeoutMs: TIMEOUT_MS })
    const fin = finalizeScenarioVerdictFor(input, r.data)
    const e = c.expect
    const learnerTexts = c.turns.filter((t) => t.role === 'learner').map((t) => t.text)
    const sc = fx.scenarios[c.scenario]
    const exprs = readScenarioExpressions(sc.keyExpressions)
    const judged = judgeScenarioCompletion({ expressions: exprs, required: scenarioRequiredExpressions(sc.completionRule, exprs.length), learnerTexts, verdict: { goalAchieved: fin.goalAchieved, communicationSuccess: fin.communicationSuccess, usedExpressionIds: fin.usedExpressionIds, missedExpressionIds: fin.missedExpressionIds } })
    void required
    void expressionIds
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, response: r.data,
      goalAchieved: fin.goalAchieved, communicationSuccess: fin.communicationSuccess,
      goalMatch: e.goalAchieved === null ? null : fin.goalAchieved === e.goalAchieved,
      commMatch: e.communicationSuccess === null ? null : fin.communicationSuccess === e.communicationSuccess,
      used: fin.usedExpressionIds, missed: fin.missedExpressionIds, verified: input.verifiedExpressionIds ? [...input.verifiedExpressionIds] : [],
      claimed: r.data.evidence.length, rejected: fin.rejectedClaims,
      trapCredited: fin.usedExpressionIds.filter((id) => e.mustNotUse.includes(id)),
      mustUseMissing: e.mustUse.filter((id) => !fin.usedExpressionIds.includes(id)),
      variantCredited: (e.variantUse ?? []).filter((id) => fin.usedExpressionIds.includes(id)),
      variantMissing: (e.variantUse ?? []).filter((id) => !fin.usedExpressionIds.includes(id)),
      stepsReached: fin.stepsReached, stepsOk: fin.stepsReached >= e.stepsReachedMin,
      outcome: judged.outcome, outcomeMatch: e.outcomeByCode === null ? null : judged.outcome === e.outcomeByCode,
      overBudget: r.elapsedMs > BUDGET_MS,
    }
  } catch (err) {
    const er = err as Error & { raw?: string }
    const text = `${er.message} ${er.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 240), limitHit: LIMIT_RE.test(text) }
  }
}

function table(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const ms = ok.map((r) => r.elapsedMs)
  console.log(`\n## ${SCENARIO_VERDICT_PROMPT_VERSION} · tier=${TIER} · 호출 ${rows.length} · 성공 ${ok.length} · 실패 ${rows.length - ok.length}`)
  console.log('| 호출 | ms | 시도 | 목표(기대) | 의사소통 | 쓴 표현 | 증거(주장→버림) | 함정 인정 | 빠진 정답 | 단계 | 결과(기대) |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) { console.log(`| ${r.id} | ${r.elapsedMs} | - | FAILED ${r.errorName}: ${r.error} |`); continue }
    const e = fx.conversations.find((c) => c.id === r.conv)!.expect
    console.log(`| ${r.id} | ${r.elapsedMs} | ${r.attempts} | ${r.goalAchieved}(${e.goalAchieved}) ${r.goalMatch === false ? 'X' : ''} | ${r.communicationSuccess}(${e.communicationSuccess}) ${r.commMatch === false ? 'X' : ''} | ${r.used!.join(',') || '-'} | ${r.claimed}→${r.rejected!.length} | ${r.trapCredited!.join(',') || '-'} | ${r.mustUseMissing!.join(',') || '-'} | ${r.stepsReached}${r.stepsOk ? '' : ' X'} | ${r.outcome}(${e.outcomeByCode}) ${r.outcomeMatch === false ? 'X' : ''} |`)
  }
  const n = (f: (r: Row) => boolean | null | undefined) => { const xs = ok.filter((r) => f(r) !== null && f(r) !== undefined); return `${xs.filter((r) => f(r)).length}/${xs.length}` }
  console.log(`\n1차 통과(attempts 1) ${ok.filter((r) => r.attempts === 1).length}/${ok.length} · 최종 실패 ${rows.filter((r) => !r.ok).length}`)
  console.log(`지연 p50 ${round(pct(ms, 50), 0)}ms · p95 ${round(pct(ms, 95), 0)}ms · max ${Math.max(...ms, 0)}ms · >20s ${ok.filter((r) => r.overBudget).length} (실패 포함 시 타임아웃 ${rows.filter((r) => !r.ok && /timeout|시간/i.test(r.error ?? '')).length})`)
  console.log(`목표 일치 ${n((r) => r.goalMatch)} · 의사소통 일치 ${n((r) => r.commMatch)} · 단계 하한 ${n((r) => r.stepsOk)} · 코드 결과(outcome) 일치 ${n((r) => r.outcomeMatch)}`)
  if (VARIANTS) {
    for (const r of ok) {
      const ve = variantExpect(r.conv)
      if (!ve) continue
      const want = (r.variantCredited?.length ?? 0) > 0 || ve.variantUse.length === 0 ? ve.outcomeIfVariantCredited ?? ve.outcomeIfOnlyCode : ve.outcomeIfOnlyCode
      console.log(`변형 ${r.id}: 인정된 변형 ${r.variantCredited!.join(',') || '-'} / 기대 ${ve.variantUse.join(',') || '-'} · 걸러진 주장 ${r.rejected!.map((x) => `${x.id}:${x.reason}`).join(',') || '-'} · 결과 ${r.outcome} (변형 인정 시 ${ve.outcomeIfVariantCredited}, 코드만 ${ve.outcomeIfOnlyCode}) ${r.outcome === want ? '' : 'X'}`)
    }
  }
  console.log(`근거 없는 인정: 주장 ${ok.reduce((a, r) => a + (r.claimed ?? 0), 0)}건 중 코드 대조로 버려진 ${ok.reduce((a, r) => a + (r.rejected?.length ?? 0), 0)}건 · 함정 표현이 쓴 표현에 들어간 호출 ${ok.filter((r) => r.trapCredited!.length).length}/${ok.length} · 정답 표현 누락 호출 ${ok.filter((r) => r.mustUseMissing!.length).length}/${ok.length}`)
  const byConv = new Map<string, Row[]>()
  for (const r of ok) byConv.set(r.conv, [...(byConv.get(r.conv) ?? []), r])
  console.log('대화별 목표 일치(반복 간 안정성):', [...byConv.entries()].map(([k, v]) => `${k.slice(0, 3)}:${v.map((r) => (r.goalAchieved ? 'T' : 'F')).join('')}`).join(' '))
}

async function main() {
  if (process.env.DUMP === '1') { const s = JSON.parse(readFileSync(OUT, 'utf8')) as Saved; table(s.rows); return }
  const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
  const convs = fx.conversations.filter((c) => !only.length || only.some((o) => c.id.startsWith(o)))
  const startedAt = new Date().toISOString()
  const prior: Row[] = process.env.RESUME === '1' && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const rows: Row[] = [...prior]
  const done = new Set(prior.filter((r) => r.ok).map((r) => r.id))
  for (let rep = 1; rep <= REPEAT; rep++) {
    for (const c of convs) {
      const id = `${c.id}#${rep}`
      if (done.has(id)) continue
      const row = await runCall(c, rep)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      save(rows, startedAt)
      console.log(`${row.ok ? 'OK ' : 'ERR'} ${id} ${row.elapsedMs}ms ${row.ok ? `goal=${row.goalAchieved} used=${row.used!.join(',') || '-'} rej=${row.rejected!.length}` : row.error}`)
      if (row.limitHit) { console.log('\n⚠ 한도 신호 — 즉시 중단(추정값을 쓰지 않는다)'); table(rows); process.exit(2) }
      await sleep(GAP_MS)
    }
  }
  table(rows)
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
