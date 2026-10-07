/**
 * task-045 PE — `scenarioVariant@v3` 라이브 재측정(`flow=suggest` 축 NOT_REFLECTED 보완 확인). 실제 Claude CLI(구독)를 **직렬**로 부른다.
 * 원본 `tests/live/task045-variant-measure.ts`·QA 복사본 `tests/live/p3-qa-llm/variant-measure-h.ts` 와 판정 로직은 같고(축별 필수 칸 + 코드 반영 검사), 바꾼 것만 다르다.
 *  - **시도마다 원 응답·코드 판정을 남긴다**: `extraCheck` 를 감싸 엔진의 1차·재시도 응답과 그 응답에 대한 `fitScenarioVariant` 결과(문제 코드·버려진 표현 수·새 표현 수)를 `attempts[]` 에 기록한다.
 *    (엔진은 1차 위반 원문을 저장하지 않는다 — JSON 스키마 단계 위반은 `extraCheck` 전에 걸러져 이 기록에 없고 `attempts===2` 와 로그 줄 `[json] 1차 응답 계약 위반` 으로만 안다.)
 *  - 성공 조건 개수·항목 최대 글자 수·`firstPass`(재시도 없이 통과) 를 행에 적는다. 요약은 기준 상황별 1차 통과/위반·최종 실패·응답 시간.
 *  - 엔진 태스크 키는 빌더가 정한 `scenarioVariant`(`LLM_TASKS` 에 있음 — 운영과 같은 tier·lane)이고 `timeoutMs` 만 `TIMEOUT_MS`(기본 60000 — QA 측정과 같음)로 덮어 40s 초과 호출도 값을 본다(40s 초과는 요약에 따로 센다).
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다. 입력은 `CASES_FILE`(JSON 배열 `[{id, seed, axes, note?}]`), 기준 상황은 시드 `prisma/seed-data/scenarios.json`.
 *
 * 실행(미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe045h && DATABASE_URL=invalid CASES_FILE=<입력.json> OUT=<결과.json> node --import tsx tests/live/task045-variant-measure-v3.ts
 * 환경: TIMEOUT_MS=60000 · GAP_MS=1000 · LIMIT=<최대 케이스 수> · RESUME=1(끝난 케이스는 건너뜀) · SUMMARY=1(호출 없이 OUT 만 요약)
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildScenarioVariantRequest, finalizeScenarioVariant, SCENARIO_VARIANT_PROMPT_VERSION } from '../../src/modules/conversation/prompts/scenarioVariant'
import { countNewExpressions, fitScenarioVariant, parseScenarioVariantBody, type ScenarioVariantBase, type ScenarioVariantFinal, type ScenarioVariantModelResponse } from '../../src/modules/conversation/structuredResponse/scenarioVariantSchemas'
import type { ScenarioVariantAxes, ScenarioVariantField } from '../../src/types/scenarioVariant'

interface SeedScenario { key: string; topics: { key: string }[]; title: string; titleJa: string; description: string; level: ScenarioVariantBase['level']; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string; successCriteria: string[] }; steps: { ko: string }[]; opening: { ja: string; ko: string } | null; keyExpressions: { ja: string; reading?: string; ko: string }[] }
interface CaseIn { id: string; seed: string; axes: Partial<ScenarioVariantAxes>; note?: string }
const ROOT = process.cwd()
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]
const seedTopics = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as { key: string; title: string }[]
const baseOf = (key: string): ScenarioVariantBase => {
  const s = seeds.find((x) => x.key === key)
  if (!s) throw new Error(`시드 상황 없음: ${key}`)
  return { title: s.title, titleJa: s.titleJa, description: s.description, level: s.level, roles: s.roles, goal: s.goal, steps: s.steps, keyExpressions: s.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading ?? null, ko: e.ko })), opening: s.opening, topics: s.topics.map((t) => ({ id: `tp_${t.key}`, title: seedTopics.find((x) => x.key === t.key)?.title ?? t.key })) }
}

const OUT = process.env.OUT ?? '/tmp/kaiwa-task045-variant-v3.json'
const GAP_MS = Number(process.env.GAP_MS ?? 1000)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000)
const MAX_CASES = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i

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

interface AttemptRec {
  /** extraCheck 가 불린 순번(1차=1, 재시도=2). 스키마 단계 위반 응답은 여기까지 오지 않는다. */
  n: number
  status: string
  problems: string[]
  newExpr: number
  dropped: Record<string, number>
  rawExprCount: number
  rawExprJa: string[]
  criteria: number[]
}
interface Row {
  id: string
  seed: string
  axes: Partial<ScenarioVariantAxes>
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  /** 재시도 없이(엔진 1차) 통과. */
  firstPass?: boolean
  model?: string
  promptChars?: number
  /** system 지시문 sha(수준·축의 함수) — 같은 판으로 쟀는지 확인용. */
  systemSha?: string
  finalStatus?: string
  problems?: string[]
  changedFields?: ScenarioVariantField[]
  newExpr?: number
  requiredOk?: boolean
  pass?: boolean
  criteriaCount?: number
  criteriaMax?: number
  attemptRecs: AttemptRec[]
  errorName?: string
  error?: string
  limitHit?: boolean
  raw?: unknown
  brief?: { title: string; steps: string[]; exprs: string[] }
}
interface Saved { startedAt: string; version: string; timeoutMs: number; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const cp = (s: string) => Array.from(s).length
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: SCENARIO_VARIANT_PROMPT_VERSION, timeoutMs: TIMEOUT_MS, rows } satisfies Saved, null, 1))
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 10)

/** 축별 필수 바뀐 칸. */
function requiredFields(axes: Partial<ScenarioVariantAxes>): ScenarioVariantField[] {
  const out = new Set<ScenarioVariantField>(['title'])
  if (axes.twist && axes.twist !== 'none') ['steps', 'keyExpressions'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.flow && axes.flow !== 'same') ['steps', 'keyExpressions'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.level === 'up') ['keyExpressions', 'level'].forEach((f) => out.add(f as ScenarioVariantField))
  if (axes.persona && axes.persona !== 'same') out.add('roles')
  return [...out]
}

const draftOf = (data: ScenarioVariantModelResponse) => (data && typeof data === 'object' ? data.draft : null)
function criteriaLens(data: ScenarioVariantModelResponse): number[] {
  const d = draftOf(data)
  return Array.isArray(d?.successCriteria) ? d.successCriteria.map((c) => cp(String(c))) : []
}

async function runCase(c: CaseIn): Promise<Row> {
  const base = baseOf(c.seed)
  const row: Row = { id: c.id, seed: c.seed, axes: c.axes, ok: false, elapsedMs: 0, attemptRecs: [] }
  const parsed = parseScenarioVariantBody({ axes: c.axes, ...(c.note ? { note: c.note } : {}) }, { baseLevel: base.level })
  if (!parsed.ok) return { ...row, errorName: 'ParseBlocked', error: JSON.stringify(parsed.problems) }
  const built = buildScenarioVariantRequest({ base, axes: parsed.value.axes, note: parsed.value.note })
  const { context, ...llmReq } = built
  row.systemSha = sha(built.system)
  const recs: AttemptRec[] = []
  const wrappedCheck = (data: ScenarioVariantModelResponse): string[] => {
    const fin = fitScenarioVariant(context, data)
    const d = draftOf(data)
    recs.push({
      n: recs.length + 1,
      status: fin.status,
      problems: fin.problems,
      newExpr: fin.draft ? countNewExpressions(base, fin.draft.keyExpressions) : -1,
      dropped: Object.fromEntries(Object.entries(fin.repairs.droppedExpressions).filter(([, v]) => v > 0)),
      rawExprCount: Array.isArray(d?.keyExpressions) ? d.keyExpressions.length : 0,
      rawExprJa: Array.isArray(d?.keyExpressions) ? d.keyExpressions.map((e) => String(e?.ja ?? '')) : [],
      criteria: criteriaLens(data),
    })
    return llmReq.extraCheck ? llmReq.extraCheck(data) : []
  }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ScenarioVariantModelResponse>({ ...llmReq, extraCheck: wrappedCheck, timeoutMs: TIMEOUT_MS })
    const fin: ScenarioVariantFinal = finalizeScenarioVariant(context, r.data)
    const req = requiredFields(c.axes)
    const requiredOk = fin.status === 'OK' ? req.every((f) => fin.changedFields.includes(f)) : false
    const lens = criteriaLens(r.data)
    return {
      ...row,
      ok: true,
      elapsedMs: r.elapsedMs,
      attempts: r.attempts,
      firstPass: r.attempts === 1,
      model: r.model,
      promptChars: r.promptChars,
      systemSha: sha(built.system),
      finalStatus: fin.status,
      problems: fin.problems,
      changedFields: fin.changedFields,
      newExpr: fin.draft ? countNewExpressions(base, fin.draft.keyExpressions) : 0,
      requiredOk,
      pass: fin.status === 'OK' && requiredOk,
      criteriaCount: lens.length,
      criteriaMax: lens.length ? Math.max(...lens) : 0,
      attemptRecs: recs,
      raw: r.data,
      brief: fin.draft ? { title: fin.draft.title, steps: fin.draft.steps.map((s) => s.ko), exprs: fin.draft.keyExpressions.map((e) => e.ja) } : undefined,
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    return { ...row, elapsedMs: Date.now() - t0, attemptRecs: recs, systemSha: sha(built.system), errorName: err.name, error: err.message.slice(0, 400), limitHit: LIMIT_RE.test(`${err.message}\n${err.raw ?? ''}`) }
  }
}

function summary(rows: Row[], timeoutMs: number): void {
  const seedsSeen = [...new Set(rows.map((r) => r.seed))]
  const axisKey = (r: Row) => JSON.stringify(r.axes)
  console.log(`\n## 요약 — version=${SCENARIO_VARIANT_PROMPT_VERSION} 케이스 ${rows.length}건 타임아웃 ${timeoutMs}ms`)
  const cliCalls = rows.reduce((a, r) => a + (r.ok ? (r.attempts ?? 1) : Math.max(1, r.attemptRecs.length)), 0)
  console.log(`- Claude CLI 실호출(추정: 성공 건 attempts 합 + 실패 건 extraCheck 횟수 ≥1) ${cliCalls}`)
  console.log('| 기준 상황 · 축 | n | 1차 통과 | 1차 위반(재시도 성공) | 최종 실패 | 응답 p50/p95/max(성공건, s) | 성공조건 개수·최대 글자 | 위반 사유 |')
  console.log('|---|---|---|---|---|---|---|---|')
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.seed} · ${axisKey(r)}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  for (const [k, g] of groups) {
    const okR = g.filter((r) => r.ok)
    const first = okR.filter((r) => r.firstPass).length
    const retried = okR.filter((r) => r.attempts === 2)
    const failed = g.filter((r) => !r.ok)
    const ms = okR.map((r) => r.elapsedMs / 1000)
    const reasons = [...retried.map((r) => `${r.id}: 1차 위반(재시도 성공)`), ...failed.map((r) => `${r.id}: ${r.errorName} ${r.error?.slice(0, 80) ?? ''}`)].join(' / ')
    const cr = okR.length ? `${[...new Set(okR.map((r) => r.criteriaCount))].join('/')}개·최대 ${Math.max(...okR.map((r) => r.criteriaMax ?? 0))}자` : '-'
    console.log(`| ${k} | ${g.length} | ${first} | ${retried.length} | ${failed.length} | ${round(pct(ms, 50))} / ${round(pct(ms, 95))} / ${round(Math.max(...ms, 0))} | ${cr} | ${reasons || '-'} |`)
  }
  const okAll = rows.filter((r) => r.ok)
  const msAll = okAll.map((r) => r.elapsedMs / 1000)
  const firstAll = okAll.filter((r) => r.firstPass).length
  console.log(`- 합계: 1차 통과 ${firstAll}/${rows.length} (1차 위반율 ${round(((rows.length - firstAll) / Math.max(1, rows.length)) * 100)}%) · 재시도 후 최종 실패 ${rows.length - okAll.length}/${rows.length} · 최종 INVALID ${okAll.filter((r) => r.finalStatus !== 'OK').length} · pass ${rows.filter((r) => r.pass).length}`)
  console.log(`- 응답 시간(성공건) p50 ${round(pct(msAll, 50))}s · p95 ${round(pct(msAll, 95))}s · max ${round(Math.max(...msAll, 0))}s · 40s 초과 ${rows.filter((r) => r.elapsedMs > 40_000).length}건(운영 상한 40s 였다면 시간 초과 후보)`)
  const crit = okAll.filter((r) => (r.criteriaCount ?? 0) > 3 || (r.criteriaMax ?? 0) > 40)
  console.log(`- 성공 조건: 반환 응답 중 4개 이상 ${okAll.filter((r) => (r.criteriaCount ?? 0) > 3).length} · 40자 초과 ${okAll.filter((r) => (r.criteriaMax ?? 0) > 40).length}(재시도 후 응답 기준) · 최대 글자 ${Math.max(0, ...okAll.map((r) => r.criteriaMax ?? 0))}${crit.length ? ` ← ${crit.map((r) => r.id).join(',')}` : ''}`)
  const nexp = okAll.map((r) => r.newExpr ?? 0)
  console.log(`- 새 표현 수(코드 정리 후) 분포 ${JSON.stringify(nexp.reduce<Record<number, number>>((a, n) => ({ ...a, [n]: (a[n] ?? 0) + 1 }), {}))} · 1개(하한 근처) ${nexp.filter((n) => n === 1).length}건`)
  const dropAgg: Record<string, number> = {}
  for (const r of rows) for (const a of r.attemptRecs) for (const [k, v] of Object.entries(a.dropped)) dropAgg[k] = (dropAgg[k] ?? 0) + v
  console.log(`- 코드가 버린 표현(모든 extraCheck 응답 합) ${JSON.stringify(dropAgg)} · midBlank 가 있었던 응답 ${rows.flatMap((r) => r.attemptRecs).filter((a) => (a.dropped.midBlank ?? 0) > 0).length}건`)
  const refl = rows.flatMap((r) => r.attemptRecs.filter((a) => a.problems.length > 0).map((a) => `${r.id}#${a.n}:${a.problems.join('+')}(raw표현 ${a.rawExprCount}·버림 ${JSON.stringify(a.dropped)})`))
  console.log(`- extraCheck 위반 응답 ${refl.length}건 ${refl.join(' | ') || '-'}`)
  void seedsSeen
}

async function main(): Promise<void> {
  if (process.env.SUMMARY === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    summary(saved.rows, saved.timeoutMs)
    return
  }
  if (!process.env.CASES_FILE) throw new Error('CASES_FILE 가 필요하다')
  const cases = JSON.parse(readFileSync(process.env.CASES_FILE, 'utf8')) as CaseIn[]
  let rows: Row[] = []
  let startedAt = new Date().toISOString()
  if (process.env.RESUME === '1' && existsSync(OUT)) {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    rows = saved.rows
    startedAt = saved.startedAt
  }
  const done = new Set(rows.map((r) => r.id))
  let n = 0
  let consecFail = 0
  for (const c of cases) {
    if (done.has(c.id)) continue
    if (n >= MAX_CASES) break
    n++
    const row = await runCase(c)
    rows.push(row)
    save(rows, startedAt)
    const last = row.attemptRecs.map((a) => `#${a.n}:${a.status}${a.problems.length ? `[${a.problems.join('+')}]` : ''} new=${a.newExpr} drop=${JSON.stringify(a.dropped)}`).join(' ')
    console.log(`${row.ok ? 'OK  ' : 'FAIL'} ${c.id} ${round(row.elapsedMs / 1000)}s att=${row.attempts ?? '-'} first=${row.firstPass ?? '-'} final=${row.finalStatus ?? row.errorName} pass=${row.pass ?? '-'} crit=${row.criteriaCount ?? '-'}/${row.criteriaMax ?? '-'} newExpr=${row.newExpr ?? '-'} sha=${row.systemSha ?? '-'} ${last}`)
    consecFail = row.ok ? 0 : consecFail + 1
    if (consecFail >= 3) {
      console.log('연속 실패 3건 — 멈춘다.')
      break
    }
    if (row.limitHit) {
      console.log('한도에 걸렸다 — 멈춘다(추정값을 쓰지 않는다).')
      break
    }
    await sleep(GAP_MS)
  }
  summary(rows, TIMEOUT_MS)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
