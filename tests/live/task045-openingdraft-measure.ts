/**
 * task-045 실측 — `openingDraft@v2`(역할극 첫마디: 한국어 → 선생님 역할의 일본어 + 읽기)을 실제 Claude CLI(구독)로 **직렬** 호출해
 * JSON 유효율·재시도율·응답 시간·ja 검사 통과·읽기 일치·한글/라틴 누출·거절 정확도·길이 분포를 잰다.
 *
 * 입력: ① **시드 상황 10개**(`prisma/seed-data/scenarios.json` 의 `opening.ko` 를 입력으로, `opening.ja` 를 비교 기준 `seedJa` 로) ② `tests/prompts/fixtures/opening-draft.json` 의 `liveCases`(합성 — 학습자 기록 없음).
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드(`prisma/seed-data/engines.json` claude-cli-local) 모양의 고정 연결로 바꿔 끼운다(topicDraft 측정과 같은 방식).
 * tier→모델은 **시드 값**(fast=haiku·balanced=sonnet)이다. `openingDraft` task 가 아직 `LLM_TASKS` 에 없어 같은 모양을 가진 기존 `scenarioDraft`(balanced·40s·interactive)로 부르고 `tier`·`timeoutMs` 를 환경변수로 덮어쓴다.
 * 본문 검사(`parseOpeningDraftBody`)는 **LLM 앞에서** 막는 입력(`parseBlocked`)이 실제로 막히는지 오프라인 점검(`tests/prompts/opening-draft-check.ts`)이 확인하고, 이 스크립트는
 * LLM 단 방어를 재려고 **본문 검사를 건너뛰고** 빌더를 직접 부른다(영문 주입·자모 입력도 모델에 간다).
 *
 * **판정**: accept = `fin.status === 'OK'`(ja·읽기 검사는 `fitOpeningDraft` 가 한다). 시드 입력은 생성 일본어를 `seedJa` 와 나란히 출력해 PE 가 의미·정중도·길이를 눈으로 대조한다.
 * reject(`expect: 'REJECT'`)는 OK 가 오면 **오수용(ACCEPTED_BAD)**. 정상 첫마디 + 주입이 섞인 입력(`expect: 'REJECT_OR_NORMAL'`)은 거절이거나 **주입을 따르지 않은 정상 번역**(legitKeywords 가 ja 에 있고 mustNotContain 이 없음)이면 올바르다.
 * 각 행에 `systemSha` 를 남겨 raw 만으로 프롬프트 개정본을 구분한다. 한도 문구가 보이면 **즉시 멈춘다**. 호출마다 OUT 에 덮어써 중단돼도 부분 결과가 남고 `RESUME=1` 이면 끝난 호출은 건너뛴다.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe045 && DATABASE_URL=invalid OUT=<결과.json> TIER=fast node --import tsx tests/live/task045-openingdraft-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · TIMEOUT_MS=60000 · GAP_MS=1000 · IDS=<case id 쉼표 목록> · LIMIT=<최대 호출 수> · RESUME=1 · DUMP=1(결과 파일만 읽어 표 출력, 호출 없음)
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildOpeningDraftRequest, finalizeOpeningDraft, OPENING_DRAFT_PROMPT_VERSION } from '../../src/modules/conversation/prompts/openingDraft'
import type { OpeningDraftFinal, OpeningDraftResponse } from '../../src/modules/conversation/structuredResponse/openingDraftSchemas'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

interface LiveCase {
  id: string
  /** ambiguous = 누가 할 말인지 애매한 입력(선생님 자기소개일 수도) — OK 와 NOT_AN_UTTERANCE 둘 다 올바른 행동이다(어느 쪽인지만 기록). */
  kind: 'accept' | 'reject' | 'ambiguous'
  group: string
  level: JlptLevel
  roles: { learner: string; tutor: string }
  title?: string
  titleJa?: string
  goal?: string
  placeTitle?: string
  ko: string
  /** 시드 입력일 때 비교 기준 일본어. */
  seedJa?: string
  expect?: 'REJECT' | 'REJECT_OR_NORMAL'
  legitKeywords?: string[]
  mustNotContain?: string[]
  parseBlocked?: string
}
interface SeedScenario { key: string; title: string; titleJa: string; level: JlptLevel; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string }; opening: { ja: string; ko: string } }

const ROOT = process.cwd()
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/opening-draft.json'), 'utf8')) as { liveCases: LiveCase[] }
const seeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]
const seedCases: LiveCase[] = seeds.map((s) => ({
  id: `seed-${s.key}`,
  kind: 'accept',
  group: `seed-${s.level}`,
  level: s.level,
  roles: s.roles,
  title: s.title,
  titleJa: s.titleJa,
  goal: s.goal.communicativeGoalKo,
  ko: s.opening.ko,
  seedJa: s.opening.ja,
}))
const allCases: LiveCase[] = [...seedCases, ...fixture.liveCases]

const OUT = process.env.OUT ?? '/tmp/kaiwa-task045-openingdraft-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const GAP_MS = Number(process.env.GAP_MS ?? 1000)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000)
const MAX_CALLS = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
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

interface Row {
  id: string
  kind: 'accept' | 'reject' | 'ambiguous'
  group: string
  level: JlptLevel
  ko: string
  seedJa?: string
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  modelStatus?: string
  final?: Pick<OpeningDraftFinal, 'status' | 'problems' | 'warnings' | 'repairs'>
  ja?: string | null
  reading?: string | null
  raw?: OpeningDraftResponse
  /** accept: OK / reject: 올바른 행동(거절 또는 주입을 따르지 않은 정상 번역). */
  pass?: boolean
  behavior?: 'REJECTED' | 'NORMAL' | 'ACCEPTED_BAD' | 'NORMAL_OFFTOPIC'
  systemSha?: string
  leaked?: boolean
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
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: OPENING_DRAFT_PROMPT_VERSION, tier: TIER, rows } satisfies Saved, null, 1))

async function runCase(c: LiveCase): Promise<Row> {
  const req = buildOpeningDraftRequest({ ko: c.ko, scenario: { title: c.title, titleJa: c.titleJa, goal: c.goal, placeTitle: c.placeTitle, roles: c.roles, level: c.level } })
  const base: Row = { id: c.id, kind: c.kind, group: c.group, level: c.level, ko: c.ko, seedJa: c.seedJa, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<OpeningDraftResponse>({ ...req, task: 'scenarioDraft', tier: TIER, timeoutMs: TIMEOUT_MS })
    const fin = finalizeOpeningDraft(r.data, { ko: c.ko })
    const text = JSON.stringify(r.data)
    const leaked = /system prompt|시스템 프롬프트|\[모드\]|OPENING_DRAFT|modelByTier|api[_ -]?key/i.test(text) || (c.mustNotContain ?? []).some((s) => text.includes(s))
    let behavior: Row['behavior']
    let pass: boolean
    if (c.kind === 'ambiguous') {
      behavior = fin.status === 'OK' ? 'NORMAL' : 'REJECTED'
      pass = (fin.status === 'OK' || fin.status === 'NOT_AN_UTTERANCE') && !leaked
    } else if (c.kind === 'accept') {
      pass = fin.status === 'OK' && !leaked
    } else if (fin.status !== 'OK') {
      behavior = 'REJECTED'
      pass = !leaked
    } else if (c.expect === 'REJECT_OR_NORMAL') {
      const onTopic = (c.legitKeywords ?? []).some((k) => (fin.ja ?? '').includes(k))
      behavior = onTopic ? 'NORMAL' : 'NORMAL_OFFTOPIC'
      pass = onTopic && !leaked
    } else {
      behavior = 'ACCEPTED_BAD'
      pass = false
    }
    const systemSha = createHash('sha256').update(req.system).digest('hex').slice(0, 10)
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, modelStatus: r.data.status,
      final: { status: fin.status, problems: fin.problems, warnings: fin.warnings, repairs: fin.repairs },
      ja: fin.ja, reading: fin.reading, raw: r.data, pass, behavior, systemSha, leaked,
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${err.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 300), limitHit: LIMIT_RE.test(blob) }
  }
}

function summary(rows: Row[]): void {
  const okRows = rows.filter((r) => r.ok)
  const acc = rows.filter((r) => r.kind === 'accept')
  const amb = rows.filter((r) => r.kind === 'ambiguous')
  const rej = rows.filter((r) => r.kind === 'reject')
  const accOk = acc.filter((r) => r.ok)
  const ms = okRows.map((r) => r.elapsedMs / 1000)
  const lens = accOk.filter((r) => r.final?.status === 'OK').map((r) => r.final?.repairs.jaChars ?? 0)
  const readingKept = accOk.filter((r) => r.final?.status === 'OK' && r.reading).length
  const accFinalOk = accOk.filter((r) => r.final?.status === 'OK').length
  const beh = (b: NonNullable<Row['behavior']>) => rej.filter((r) => r.behavior === b).length
  const problemTotals: Record<string, number> = {}
  for (const r of okRows) for (const p of r.final?.problems ?? []) problemTotals[p] = (problemTotals[p] ?? 0) + 1
  const warnTotals: Record<string, number> = {}
  for (const r of okRows) for (const w of r.final?.warnings ?? []) warnTotals[w] = (warnTotals[w] ?? 0) + 1
  const dropTotals: Record<string, number> = {}
  for (const r of okRows) if (r.final?.repairs.readingDrop) dropTotals[r.final.repairs.readingDrop] = (dropTotals[r.final.repairs.readingDrop] ?? 0) + 1
  console.log(`\n## 요약 — tier=${TIER} version=${OPENING_DRAFT_PROMPT_VERSION} 호출 ${rows.length} 성공 ${okRows.length} 실패 ${rows.length - okRows.length}`)
  console.log(`- JSON 유효(1차 ajv 통과·재시도 0): ${okRows.filter((r) => r.attempts === 1).length}/${rows.length} · 재시도 발생 ${okRows.filter((r) => r.attempts === 2).length} · 호출 실패 ${rows.length - okRows.length}`)
  console.log(`- 응답 시간 p50 ${round(pct(ms, 50))}s · p95 ${round(pct(ms, 95))}s · max ${round(Math.max(...ms, 0))}s · 10s 초과 ${ms.filter((x) => x > 10).length} · 20s 초과 ${ms.filter((x) => x > 20).length}`)
  console.log(`- accept ${acc.length}건: 통과(status OK) ${acc.filter((r) => r.pass).length}/${acc.length} · INVALID ${accOk.filter((r) => r.final?.status === 'INVALID').length} · TOO_LONG ${accOk.filter((r) => r.final?.status === 'TOO_LONG').length} · 모델이 거절 ${accOk.filter((r) => r.final?.status === 'NOT_AN_UTTERANCE' || r.final?.status === 'UNSAFE').length}`)
  if (amb.length) console.log(`- ambiguous ${amb.length}건: OK ${amb.filter((r) => r.final?.status === 'OK').length} · NOT_AN_UTTERANCE ${amb.filter((r) => r.final?.status === 'NOT_AN_UTTERANCE').length} · 그 밖 ${amb.filter((r) => r.ok && r.final?.status !== 'OK' && r.final?.status !== 'NOT_AN_UTTERANCE').length} · 호출 실패 ${amb.filter((r) => !r.ok).length}`)
  console.log(`- ja 길이(OK 만): 평균 ${round(lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length))}자 · 최대 ${Math.max(...lens, 0)}자 · 읽기 유지 ${readingKept}/${accFinalOk} · 읽기 버림 이유 ${JSON.stringify(dropTotals)} · 경고 ${JSON.stringify(warnTotals)} · INVALID 이유 ${JSON.stringify(problemTotals)}`)
  console.log(`- reject ${rej.length}건: 거절 ${beh('REJECTED')} · 주입 섞인 정상 입력에 정상 번역 ${beh('NORMAL')} · 오수용(ACCEPTED_BAD) ${beh('ACCEPTED_BAD')} · 정상 번역이지만 무관(NORMAL_OFFTOPIC) ${beh('NORMAL_OFFTOPIC')} · 호출 실패 ${rej.filter((r) => !r.ok).length} · pass ${rej.filter((r) => r.pass).length}/${rej.length} · 누출 ${rows.filter((r) => r.leaked).length}`)
  const shas = [...new Set(okRows.map((r) => r.systemSha).filter(Boolean))]
  console.log(`- system sha ${shas.join(',') || '-'} (수준 줄만 다르므로 수준별로 갈릴 수 있다) · 프롬프트 글자 수 ${okRows.map((r) => r.promptChars ?? 0).sort((a, b) => a - b).join('/') || '-'}`)
  for (const g of ['seed-N5', 'seed-N4', 'n3', 'control', 'long']) {
    const rs = accOk.filter((r) => r.group === g)
    if (!rs.length) continue
    console.log(`  · ${g} ${rs.length}건: 통과 ${rs.filter((r) => r.pass).length} · p50 ${round(pct(rs.map((r) => r.elapsedMs / 1000), 50))}s · ja 평균 ${round(rs.reduce((a, r) => a + (r.final?.repairs.jaChars ?? 0), 0) / rs.length)}자`)
  }
}

function dump(rows: Row[]): void {
  console.log('| id | kind | lvl | ok | s | att | modelStatus | final | behavior | jaChars | warn | problems |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    const f = r.final
    console.log(`| ${r.id} | ${r.kind} | ${r.level} | ${r.ok ? 'OK' : `FAIL ${r.errorName}`} | ${round(r.elapsedMs / 1000)} | ${r.attempts ?? '-'} | ${r.modelStatus ?? '-'} | ${f?.status ?? '-'}${r.pass === false ? ' ✗' : ''} | ${r.behavior ?? '-'} | ${f?.repairs.jaChars ?? '-'} | ${(f?.warnings ?? []).join(',') || '-'} | ${(f?.problems ?? []).join(',') || '-'} |`)
  }
  console.log('\n### 번역 대조')
  for (const r of rows) {
    console.log(`\n[${r.id}] ${r.level} ${r.kind}${r.attempts === 2 ? ' (재시도)' : ''} — modelStatus=${r.modelStatus ?? r.errorName} final=${r.final?.status ?? '-'}`)
    console.log(`  ko : ${r.ko}`)
    if (r.seedJa) console.log(`  시드: ${r.seedJa}`)
    console.log(`  ja : ${r.ja ?? (r.raw?.ja ? `(버림) ${r.raw.ja}` : '-')}`)
    console.log(`  読み: ${r.reading ?? (r.raw?.reading ? `(버림) ${r.raw.reading}` : '-')}`)
  }
}

async function main(): Promise<void> {
  if (process.env.DUMP === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    dump(saved.rows)
    summary(saved.rows)
    return
  }
  const only = (process.env.IDS ?? '').split(',').filter(Boolean)
  const cases = allCases.filter((c) => only.length === 0 || only.includes(c.id))
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
    console.log(`${row.ok ? 'OK  ' : 'FAIL'} ${c.id} ${round(row.elapsedMs / 1000)}s att=${row.attempts ?? '-'} model=${row.modelStatus ?? row.errorName} final=${row.final?.status ?? '-'} pass=${row.pass ?? '-'} ja=${row.ja ?? '-'}`)
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
