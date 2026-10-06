/**
 * task-010d PE-2b 실측 — AI 시나리오 초안 `scenarioDraft@v1` 을 실제 Claude CLI(구독)로 **직렬** 호출해 계약·보정·지연을 잰다.
 * 합성 입력만 쓴다(`tests/prompts/fixtures/scenario-draft.json` — 학습자 데이터 없음).
 *
 * 재는 것: ① 1차 통과율(재시도 없이 ajv·extraCheck 통과 = attempts 1) · 최종 실패 ② 지연 p50/p95(>15s 따로 계수 — 가이드 "조금 오래" 기준)
 * ③ 한도 위반율 — 모델 출력이 코드 보정(잘림·표현 버림·읽기 버림·첫마디 버림·난이도/필수 수 조정)을 거쳤는가 ④ 후보정 통과율 — 보정된 초안이 실제 `normalizeScenarioInput(draft,'create')` 문제 0 인가
 * ⑤ 상태 일치(OK / NOT_SITUATION / UNSAFE) ⑥ 눈 판정 재료 — 초안 전문을 결과 파일에 남기고 표로도 찍는다(수준 적합성은 사람이 읽는다) + 자동 휴리스틱(첫마디가 질문인가·표현에 점원 말이 섞였나).
 *
 * **DB 를 읽지도 쓰지도 않는다** — `engine/router` 의 `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다(verdict 측정과 같은 관례). `scenarioDraft` task 가 아직 `LLM_TASKS` 에 없어
 * 같은 모양인 `wordEnrich`(interactive) 로 부르되 tier·timeout 은 덮어쓴다. 한도 신호(429 등)가 보이면 **즉시 멈춘다**.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-010d-pe2 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> TIER=fast REPEAT=1 node --import tsx tests/live/task010d-pe-draft-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · REPEAT(기본 1) · GAP_MS=1500 · TIMEOUT_MS=60000 · ONLY=<case id 접두 쉼표 목록> · RESUME=1 · DUMP=1(결과 파일만 읽어 표 출력) · REFINAL=1(DUMP 와 함께 — 저장된 모델 응답을 **현재 코드**로 다시 보정·검증해 표를 낸다)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { SCENARIO_DRAFT_PROMPT_VERSION, buildScenarioDraftRequest, finalizeScenarioDraft, type ScenarioDraftInput } from '../../src/modules/conversation/prompts/scenarioDraft'
import { scenarioDraftViolations, type ScenarioDraftFinal, type ScenarioDraftResponse } from '../../src/modules/conversation/structuredResponse/scenarioDraft'
import { normalizeScenarioInput } from '../../src/modules/learning'

interface FxCase { id: string; label: string; input: { description: string; level: ScenarioDraftInput['level']; topic?: string }; expect: { status: string; minExpressions?: number } }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/scenario-draft.json'), 'utf8')) as { topics: Record<string, { id: string; title: string; titleJa: string }>; cases: FxCase[] }

const OUT = process.env.OUT ?? '/tmp/kaiwa-task010d-draft-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const REPEAT = Number(process.env.REPEAT ?? 1)
const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const SLOW_MS = 15_000

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
  case: string
  rep: number
  tier: string
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  response?: ScenarioDraftResponse
  final?: ScenarioDraftFinal
  statusMatch?: boolean
  /** 현재 코드의 `extraCheck` 위반 수 — 0 이 아니면 그 응답은 지금 코드에서는 재시도(attempts 2)를 탔을 것이다. */
  violations?: number
  normalizeProblems?: number
  normalizeFields?: string[]
  expressionsKept?: number
  openingQuestion?: boolean | null
  tutorPhraseInExpressions?: string[]
  readingMissing?: number
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
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: SCENARIO_DRAFT_PROMPT_VERSION, tier: TIER, rows } satisfies Saved, null, 1))

const TUTOR_PHRASE = /^(いらっしゃいませ|かしこまりました|少々お待ち|お待たせ|ご注文は|どうなさ|どちらに|お客様)/
const KANJI = /\p{Script=Han}/u

function inputFor(c: FxCase): ScenarioDraftInput {
  const topic = c.input.topic ? fx.topics[c.input.topic] : undefined
  return { description: c.input.description, level: c.input.level, topic: topic ? { id: topic.id, title: topic.title, titleJa: topic.titleJa } : null }
}

/** 모델 응답(`response`)에서 계산되는 칸을 채운다 — 실제 호출 직후와 `REFINAL=1` 다시 계산이 같은 경로를 쓴다(코드가 바뀐 뒤 저장된 응답을 현재 코드로 다시 보려고). */
function derive(row: Row, c: FxCase): Row {
  const { context } = buildScenarioDraftRequest(inputFor(c))
  const data = row.response!
  const final = finalizeScenarioDraft(context, data)
  const out: Row = { ...row, final, statusMatch: final.status === c.expect.status, violations: scenarioDraftViolations(context, data).length }
  if (final.status === 'OK' && final.draft) {
    const { problems } = normalizeScenarioInput(final.draft as unknown as Record<string, unknown>, 'create')
    out.normalizeProblems = problems.length
    out.normalizeFields = problems.map((p) => `${p.field}:${p.reason}`)
    out.expressionsKept = final.draft.keyExpressions.length
    out.openingQuestion = final.draft.opening ? /[？?]\s*$|か[。\s]*$|ですか|ますか/.test(final.draft.opening.ja) : null
    out.tutorPhraseInExpressions = final.draft.keyExpressions.filter((e) => TUTOR_PHRASE.test(e.ja)).map((e) => e.ja)
    out.readingMissing = final.draft.keyExpressions.filter((e) => KANJI.test(e.ja) && !e.reading).length
  }
  return out
}

async function runCall(c: FxCase, rep: number): Promise<Row> {
  const input = inputFor(c)
  const req = buildScenarioDraftRequest(input)
  const base: Row = { id: `${c.id}#${rep}`, case: c.id, rep, tier: TIER, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    const { context, ...llmReq } = req
    void context
    const r = await llm.completeJson<ScenarioDraftResponse>({ ...llmReq, task: 'wordEnrich', tier: TIER, timeoutMs: TIMEOUT_MS })
    return derive({ ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, response: r.data }, c)
  } catch (err) {
    const er = err as Error & { raw?: string }
    const text = `${er.message} ${er.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 240), limitHit: LIMIT_RE.test(text) }
  }
}

function repairTotal(f: ScenarioDraftFinal): number {
  const r = f.repairs
  const d = r.droppedExpressions
  return r.truncated + r.droppedSteps + r.droppedCriteria + d.tooLong + d.tooShort + d.notJapanese + d.duplicate + d.noMeaning + d.overLimit + d.generic + d.midBlank + r.readingsDropped
}

function table(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const ms = ok.map((r) => r.elapsedMs)
  console.log(`\n## ${SCENARIO_DRAFT_PROMPT_VERSION} · tier=${TIER} · 호출 ${rows.length} · 성공 ${ok.length} · 실패 ${rows.length - ok.length}`)
  console.log('| 호출 | ms | 시도 | 상태(기대) | 보정 건수 | normalize 문제 | 표현(남음/낸) | 첫마디 질문 | 점원 말 | 읽기 빠짐 |')
  console.log('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) { console.log(`| ${r.id} | ${r.elapsedMs} | - | FAILED ${r.errorName}: ${r.error} |`); continue }
    const e = fx.cases.find((c) => c.id === r.case)!.expect
    const given = r.response?.draft?.keyExpressions.length ?? 0
    console.log(`| ${r.id} | ${r.elapsedMs} | ${r.attempts} | ${r.final!.status}(${e.status}) ${r.statusMatch ? '' : 'X'} | ${repairTotal(r.final!)} | ${r.normalizeProblems ?? '-'} | ${r.expressionsKept ?? '-'}/${given} | ${r.openingQuestion ?? '-'} | ${r.tutorPhraseInExpressions?.length ?? '-'} | ${r.readingMissing ?? '-'} |`)
  }
  const drafts = ok.filter((r) => r.final!.status === 'OK')
  console.log(`\n1차 통과(attempts 1) ${ok.filter((r) => r.attempts === 1).length}/${ok.length} · 최종 실패 ${rows.filter((r) => !r.ok).length}`)
  console.log(`지연 p50 ${round(pct(ms, 50), 0)}ms · p95 ${round(pct(ms, 95), 0)}ms · max ${Math.max(...ms, 0)}ms · >15s ${ok.filter((r) => r.elapsedMs > SLOW_MS).length}`)
  console.log(`상태 일치 ${ok.filter((r) => r.statusMatch).length}/${ok.length} · 초안(OK) ${drafts.length}건 중 코드 보정 발생 ${drafts.filter((r) => repairTotal(r.final!) > 0).length}건 · 첫마디 버림 ${drafts.filter((r) => r.final!.repairs.openingDropped).length}건`)
  console.log(`현재 코드 extraCheck 위반 응답 ${ok.filter((r) => (r.violations ?? 0) > 0).length}건(0 이 아니면 재시도 대상)`)
  console.log(`후보정 통과(normalizeScenarioInput 문제 0) ${drafts.filter((r) => r.normalizeProblems === 0).length}/${drafts.length}`)
  console.log(`초안 휴리스틱: 첫마디 질문형 ${drafts.filter((r) => r.openingQuestion === true).length}/${drafts.length} · 점원 말이 표현에 섞인 초안 ${drafts.filter((r) => (r.tutorPhraseInExpressions?.length ?? 0) > 0).length} · 한자 표현인데 읽기 없는 표현 합계 ${drafts.reduce((a, r) => a + (r.readingMissing ?? 0), 0)}`)
}

function show(rows: Row[]) {
  for (const r of rows.filter((x) => x.ok && x.final!.status === 'OK')) {
    const d = r.final!.draft!
    console.log(`\n### ${r.id} (${r.elapsedMs}ms · 시도 ${r.attempts}) ${d.title} / ${d.titleJa} · ${d.level} 난이도 ${d.difficulty} · 역할 ${d.roles.learner}↔${d.roles.tutor}`)
    console.log(`목표: ${d.goal.communicativeGoalKo} | 조건: ${d.goal.successCriteria.join(' / ')}`)
    console.log(`순서: ${d.steps.map((s, i) => `${i + 1}) ${s.ko}`).join(' → ')}`)
    d.keyExpressions.forEach((e, i) => console.log(`  표현${i + 1}: ${e.ja}${e.reading ? ` [${e.reading}]` : ''} — ${e.ko}`))
    console.log(`필수 ${d.requiredExpressions} · 첫마디: ${d.opening ? `${d.opening.ja} / ${d.opening.ko}` : '(없음)'}`)
    const rp = r.final!.repairs
    if (repairTotal(r.final!) || rp.openingDropped || rp.difficultyClamped || rp.requiredClamped) console.log(`  보정: ${JSON.stringify(rp)}`)
  }
}

async function main() {
  if (process.env.DUMP === '1') { const s = JSON.parse(readFileSync(OUT, 'utf8')) as Saved; if (process.env.REFINAL === '1') s.rows = s.rows.map((r) => (r.ok && r.response ? derive(r, fx.cases.find((c) => c.id === r.case)!) : r)); table(s.rows); if (process.env.SHOW === '1') show(s.rows); return }
  const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
  const cases = fx.cases.filter((c) => !only.length || only.some((o) => c.id.startsWith(o)))
  const startedAt = new Date().toISOString()
  const prior: Row[] = process.env.RESUME === '1' && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const rows: Row[] = [...prior]
  const done = new Set(prior.filter((r) => r.ok).map((r) => r.id))
  for (let rep = 1; rep <= REPEAT; rep++) {
    for (const c of cases) {
      const id = `${c.id}#${rep}`
      if (done.has(id)) continue
      const row = await runCall(c, rep)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      save(rows, startedAt)
      console.log(`${row.ok ? 'OK ' : 'ERR'} ${id} ${row.elapsedMs}ms ${row.ok ? `status=${row.final!.status} attempts=${row.attempts} repairs=${repairTotal(row.final!)}` : row.error}`)
      if (row.limitHit) { console.log('\n⚠ 한도 신호 — 즉시 중단(추정값을 쓰지 않는다)'); table(rows); process.exit(2) }
      await sleep(GAP_MS)
    }
  }
  table(rows)
  show(rows)
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
