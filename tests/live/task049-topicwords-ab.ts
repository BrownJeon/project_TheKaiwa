/**
 * task-049 라이브 측정 게이트 — A12 `topicWords@v1`(6필드) vs `topicWords@v2`(+예문 exampleJa·exampleKo)를 **같은 호출 경로**로 교대 측정한다.
 * 목적: 설계서 §4-3a E3 를 미룬 이유(출력 ≈40% 증가 → 대기 증가, [추측·미측정])를 숫자로 가려 합격선에 대본다.
 *
 * 합격선(Leader 제안, task-049 이력서 4항): ① v2−v1 증가분 p50 ≤ +2.5초 ② v2 총 p95 ≤ 12초 ③ v2 1차 통과율 ≥ 90% ④ `valid:false` 비율 증가 ≤ +5%p.
 * 하나라도 어긋나면 불합격 — 대안(ⓐ 예문 별도 호출 ⓑ 앞쪽 N장만 ⓒ DB 칸만)은 이 도구가 고르지 않는다.
 *
 * **호출 경로** = 운영 A12 와 같다: `buildTopicWordsRequest(...)` → `llm.completeJson`, task=`topicWords`(fast tier·timeout 20s·interactive 레인 — `engine/router/tasks.ts`),
 * `tier`·`timeoutMs` **덮어쓰지 않음**. 운영과 다른 점(한계): DB·Trace 없음(연결은 시드 모양 고정 — `routerDeps.loadChain`), 벽시계 30초·손님 취소 없음,
 * 제외 목록은 그 주제 기본 표현뿐(= 첫날 조건), 운영 서버·DB 접촉 없음.
 *
 * 설계: 주제 3개(시드 `cafe-order`·`ask-directions`·`travel-story`, 수준 N5·N5·N4) × 쌍 N개(기본 20 → 팔당 20회). 쌍 i 의 두 팔은 **같은 주제·수준·목표 장수·제외 목록·variant**.
 * 실행 순서는 교대(ABBA: 짝수 쌍 v1→v2, 홀수 쌍 v2→v1) — 시간대 편향과 "바로 앞 호출의 영향"(위치 편향)을 함께 줄인다. 호출 사이 GAP_MS(기본 1.5초) 이상 쉰다.
 * 중단: 429·한도 문구, 즉시 실패(타임아웃 아닌 오류가 5초 안에) 2연속 → 멈추고 기록(추정 없음). 호출마다 OUT 에 저장해 중단돼도 부분 결과가 남고, `RESUME=1` 이면 끝난 호출은 건너뛴다.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe049 && OUT=<결과.json> node --env-file=.env --import tsx tests/live/task049-topicwords-ab.ts
 * 환경: PAIRS=20 · TARGET=10(목표 장수 → 요청 13) · GAP_MS=1500 · TOPICS=<key 쉼표 목록> · SEED=49(표본 추출) · RESUME=1 · DUMP=1(결과 파일만 읽어 요약, 호출 없음) · SAMPLE=15
 * 후보 대안 ⓑ 측정(배포 코드 아님, 이 도구 안의 실험 팔): ARMS=v1,v2b B_N=5 — v2 요청의 system 에 "예문은 앞의 B_N개 항목에만, 나머지는 null" 한 줄만 더해 v1 과 교대 측정한다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import {
  assembleTopicWords as assembleV2,
  buildTopicWordsRequest as buildV2,
  TOPIC_WORDS_PROMPT_VERSION as VERSION_V2,
  topicWordsRequestCount,
  type TopicWord,
  type TopicWordDropReason,
  type TopicExampleDropReason,
} from '../../src/modules/conversation/prompts/topicWords'
import {
  assembleTopicWords as assembleV1,
  buildTopicWordsRequest as buildV1,
  TOPIC_WORDS_PROMPT_VERSION as VERSION_V1,
} from './baseline/topicWords.v1'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

interface FxChunk { textJa: string; reading: string; meaningKo: string; chunkType: string }
interface FxTopic { key: string; title: string; titleJa: string; description: string; level: JlptLevel; chunks: FxChunk[] }
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words.json'), 'utf8')) as { topics: FxTopic[] }

const OUT = process.env.OUT ?? '/tmp/kaiwa-task049-topicwords-ab.json'
const PAIRS = Number(process.env.PAIRS ?? 20)
const TARGET = Number(process.env.TARGET ?? 10)
const GAP_MS = Math.max(1500, Number(process.env.GAP_MS ?? 1500))
const SEED = Number(process.env.SEED ?? 49)
const SAMPLE = Number(process.env.SAMPLE ?? 15)
const ARMS = (process.env.ARMS ?? 'v1,v2').split(',').filter(Boolean) as Arm[]
const B_N = Number(process.env.B_N ?? 5)
/** 비교 대상 팔 — 기본 v2, 실험 때 v2b. 결과의 `v2` 키는 이 팔의 통계다. */
const B: Arm = ARMS.includes('v2b') ? 'v2b' : 'v2'
const TOPIC_KEYS = (process.env.TOPICS ?? 'cafe-order,ask-directions,travel-story').split(',').filter(Boolean)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const IMMEDIATE_FAIL_MS = 5_000

// ── DB 없이 연결 고정(시드 claude-cli-local 모양 — task042 실측과 같다) ───────────────────────
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

type Arm = 'v1' | 'v2' | 'v2b'
interface Planned { id: string; pair: number; arm: Arm; topic: string; variant: number }
interface RawWord { textJa: string; reading: string; meaningKo: string; chunkType: string; jlpt: string | null; valid: boolean; exampleJa?: string | null; exampleKo?: string | null }
interface Row {
  id: string
  pair: number
  arm: Arm
  topic: string
  level: JlptLevel
  variant: number
  target: number
  count: number
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  warm?: string | null
  model?: string
  promptChars?: number
  resultChars?: number
  received?: number
  validFalse?: number
  keptCount?: number
  droppedByReason?: Partial<Record<TopicWordDropReason, number>>
  exampleNulled?: number
  exampleNulledByReason?: Partial<Record<TopicExampleDropReason, number>>
  kept?: TopicWord[]
  words?: RawWord[]
  errorName?: string
  error?: string
  limitHit?: boolean
  timeout?: boolean
}
interface Saved { startedAt: string; versions: { v1: string; v2: string }; target: number; rows: Row[]; stopped?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)

function buildPlan(): Planned[] {
  const plan: Planned[] = []
  for (let i = 0; i < PAIRS; i++) {
    const topic = TOPIC_KEYS[i % TOPIC_KEYS.length]
    const variant = i % 8
    const order: Arm[] = i % 2 === 0 ? ARMS : [...ARMS].reverse()
    for (const arm of order) plan.push({ id: `p${String(i + 1).padStart(2, '0')}-${arm}`, pair: i + 1, arm, topic, variant })
  }
  return plan
}

async function runCall(c: Planned, topic: FxTopic): Promise<Row> {
  const exclude = topic.chunks.map((x) => x.textJa)
  const excludeMeanings = topic.chunks.map((x) => x.meaningKo)
  const input = { topic: { title: topic.title, titleJa: topic.titleJa, description: topic.description, level: topic.level }, targetCount: TARGET, exclude, variant: c.variant }
  const built = (c.arm === 'v1' ? buildV1 : buildV2)(input)
  // 실험 팔 v2b(ⓑ 앞쪽 N장만 예문): v2 요청에 한 줄만 더한다 — 배포 코드(src)는 바뀌지 않는다.
  const req = c.arm === 'v2b'
    ? { ...built, system: built.system.replace('\n[출력]', `\n- 예문(exampleJa·exampleKo)은 words 의 앞 ${B_N}개 항목에만 씁니다. ${B_N + 1}번째 항목부터는 둘 다 null 로 둡니다.\n[출력]`) }
    : built
  const count = topicWordsRequestCount(TARGET)
  const base: Row = { id: c.id, pair: c.pair, arm: c.arm, topic: c.topic, level: topic.level, variant: c.variant, target: TARGET, count, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    // tier·timeoutMs 를 덮어쓰지 않는다 — 레지스트리의 topicWords(fast·20s·interactive)가 그대로 적용된다(운영과 같은 값).
    const r = await llm.completeJson<{ words: RawWord[] }>(req as Parameters<typeof llm.completeJson>[0] as never)
    const data = r.data as { words: RawWord[] }
    const asm = (c.arm === 'v1' ? assembleV1 : assembleV2)(data, { level: topic.level, exclude, excludeMeanings }) as ReturnType<typeof assembleV2>
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, warm: r.warm ? JSON.stringify(r.warm) : null, model: r.model, promptChars: r.promptChars,
      resultChars: JSON.stringify(data).length, received: asm.received, validFalse: data.words.filter((w) => w.valid !== true).length, keptCount: asm.words.length,
      droppedByReason: asm.droppedByReason, exampleNulled: asm.exampleNulled ?? 0, exampleNulledByReason: asm.exampleNulledByReason ?? {},
      kept: (asm.words as TopicWord[]), words: data.words,
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${typeof err.raw === 'string' ? err.raw.slice(0, 2000) : ''}`
    return { ...base, ok: false, elapsedMs: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 240), limitHit: LIMIT_RE.test(blob), timeout: /Timeout/i.test(err.name) }
  }
}

// ── 요약 ──────────────────────────────────────────────────────────────────────────────────

/** 표본 점검용 느슨한 휴리스틱 — 하드 검사가 아니다(활용형·다른 활용 때문에 오검출이 있다). */
function exampleMentionsSurface(w: TopicWord): boolean | null {
  if (!w.exampleJa) return null
  const ja = w.exampleJa
  const chars = [...w.textJa]
  if (ja.includes(w.textJa) || ja.includes(w.reading)) return true
  const stem = chars.length >= 3 ? chars.slice(0, chars.length - 1).join('') : chars.length === 2 ? chars[0] : w.textJa
  return ja.includes(stem)
}

function armStats(rows: Row[], arm: Arm) {
  const mine = rows.filter((r) => r.arm === arm)
  const ok = mine.filter((r) => r.ok)
  const failed = mine.filter((r) => !r.ok)
  const timeouts = failed.filter((r) => r.timeout).length
  const schemaFail = failed.filter((r) => r.errorName === 'JsonSchemaError').length
  const firstPass = ok.filter((r) => r.attempts === 1).length
  const okMs = ok.map((r) => r.elapsedMs)
  const allMs = mine.map((r) => r.elapsedMs)
  const received = ok.reduce((n, r) => n + (r.received ?? 0), 0)
  const kept = ok.reduce((n, r) => n + (r.keptCount ?? 0), 0)
  const validFalse = ok.reduce((n, r) => n + (r.validFalse ?? 0), 0)
  const drops: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.droppedByReason ?? {})) drops[k] = (drops[k] ?? 0) + (v as number)
  const keptWords = ok.flatMap((r) => r.kept ?? [])
  const withExample = keptWords.filter((w) => w.exampleJa !== null && w.exampleJa !== undefined)
  const exNulled = ok.reduce((n, r) => n + (r.exampleNulled ?? 0), 0)
  const exReasons: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.exampleNulledByReason ?? {})) exReasons[k] = (exReasons[k] ?? 0) + (v as number)
  const surfaceFlags = withExample.map(exampleMentionsSurface).filter((x): x is boolean => x !== null)
  const jaLens = withExample.map((w) => [...(w.exampleJa as string)].length)
  const koLens = withExample.map((w) => [...(w.exampleKo as string)].length)
  const echo = withExample.filter((w) => (w.exampleJa as string).replace(/[。、！？\s]/g, '') === w.textJa).length
  return {
    calls: mine.length,
    ok: ok.length,
    failed: failed.length,
    timeouts,
    schemaFail,
    errNames: failed.reduce<Record<string, number>>((m, r) => ((m[r.errorName ?? '?'] = (m[r.errorName ?? '?'] ?? 0) + 1), m), {}),
    firstPassOfAllCalls: `${firstPass}/${mine.length} = ${round((firstPass / Math.max(1, mine.length)) * 100)}%`,
    firstPassExclTimeouts: `${firstPass}/${mine.length - timeouts} = ${round((firstPass / Math.max(1, mine.length - timeouts)) * 100)}%`,
    retried: ok.filter((r) => r.attempts === 2).length,
    latencyOkMs: { n: okMs.length, p50: pct(okMs, 50), p95: pct(okMs, 95), max: okMs.length ? Math.max(...okMs) : NaN, mean: round(mean(okMs), 0) },
    latencyAllMs: { n: allMs.length, p50: pct(allMs, 50), p95: pct(allMs, 95), max: allMs.length ? Math.max(...allMs) : NaN, mean: round(mean(allMs), 0) },
    over12s: allMs.filter((x) => x > 12_000).length,
    over20s: allMs.filter((x) => x >= 20_000).length,
    promptChars: { mean: round(mean(ok.map((r) => r.promptChars ?? 0)), 0), max: ok.length ? Math.max(...ok.map((r) => r.promptChars ?? 0)) : NaN },
    resultChars: { mean: round(mean(ok.map((r) => r.resultChars ?? 0)), 0), p50: pct(ok.map((r) => r.resultChars ?? 0), 50) },
    itemsReceived: received,
    itemsKept: kept,
    itemPassRatePct: round((kept / Math.max(1, received)) * 100),
    validFalseRatePct: round((validFalse / Math.max(1, received)) * 100),
    callsKeptGeTarget: `${ok.filter((r) => (r.keptCount ?? 0) >= r.target).length}/${ok.length}`,
    dropsByReason: drops,
    examplesPerCallMean: arm !== 'v1' ? round(mean(ok.map((r) => (r.kept ?? []).filter((w) => w.exampleJa).length))) : null,
    exampleNulledOfKeptPct: arm !== 'v1' ? round((exNulled / Math.max(1, kept)) * 100) : null,
    exampleNulledByReason: arm !== 'v1' ? exReasons : null,
    exampleSurfaceLooseHitPct: arm !== 'v1' ? round((surfaceFlags.filter(Boolean).length / Math.max(1, surfaceFlags.length)) * 100) : null,
    exampleEqualsSurface: arm !== 'v1' ? echo : null,
    exampleJaLen: arm !== 'v1' ? { mean: round(mean(jaLens)), p50: pct(jaLens, 50), p95: pct(jaLens, 95), max: jaLens.length ? Math.max(...jaLens) : NaN } : null,
    exampleKoLen: arm !== 'v1' ? { mean: round(mean(koLens)), p50: pct(koLens, 50), p95: pct(koLens, 95), max: koLens.length ? Math.max(...koLens) : NaN } : null,
  }
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function compare(rows: Row[]) {
  const v1 = armStats(rows, 'v1')
  const v2 = armStats(rows, B)
  const pairs: number[] = []
  for (const p of new Set(rows.map((r) => r.pair))) {
    const a = rows.find((r) => r.pair === p && r.arm === 'v1' && r.ok)
    const b = rows.find((r) => r.pair === p && r.arm === B && r.ok)
    if (a && b) pairs.push(b.elapsedMs - a.elapsedMs)
  }
  const dP50 = v2.latencyOkMs.p50 - v1.latencyOkMs.p50
  const dP95 = v2.latencyOkMs.p95 - v1.latencyOkMs.p95
  const v2P95All = v2.latencyAllMs.p95
  const firstPassV2 = (v2.ok > 0 ? rows.filter((r) => r.arm === B && r.ok && r.attempts === 1).length : 0) / Math.max(1, v2.calls)
  const validFalseDelta = round(v2.validFalseRatePct - v1.validFalseRatePct)
  const enough = v1.calls >= 10 && v2.calls >= 10
  const gate = {
    n: { v1: v1.calls, v2: v2.calls, pairsBothOk: pairs.length },
    g1_deltaP50Ms: { value: dP50, limit: 2500, pass: dP50 <= 2500 },
    g2_v2TotalP95Ms: { value: v2P95All, limit: 12_000, pass: v2P95All <= 12_000 },
    g3_v2FirstPassPct: { value: round(firstPassV2 * 100), limit: 90, pass: firstPassV2 >= 0.9 },
    g4_validFalseDeltaPp: { value: validFalseDelta, limit: 5, pass: validFalseDelta <= 5 },
  }
  const all = [gate.g1_deltaP50Ms.pass, gate.g2_v2TotalP95Ms.pass, gate.g3_v2FirstPassPct.pass, gate.g4_validFalseDeltaPp.pass]
  const verdict = !enough ? 'inconclusive(표본 <10/팔)' : all.every(Boolean) ? 'PASS' : 'FAIL'
  return {
    v1, v2,
    paired: { n: pairs.length, p50DeltaMs: pct(pairs, 50), p95DeltaMs: pct(pairs, 95), meanDeltaMs: round(mean(pairs), 0), v2SlowerInPairs: pairs.filter((x) => x > 0).length },
    deltaOkMs: { p50: dP50, p95: dP95 },
    outputGrowth: {
      resultCharsMeanPct: round((v2.resultChars.mean / Math.max(1, v1.resultChars.mean) - 1) * 100),
      resultCharsP50Pct: round((v2.resultChars.p50 / Math.max(1, v1.resultChars.p50) - 1) * 100),
      promptCharsMeanDelta: round(v2.promptChars.mean - v1.promptChars.mean, 0),
    },
    comparedArm: B,
    gate, verdict,
  }
}

function sampleExamples(rows: Row[]) {
  const pool: Array<{ topic: string; level: string; textJa: string; reading: string; meaningKo: string; exampleJa: string; exampleKo: string; row: string }> = []
  for (const r of rows.filter((x) => x.arm === B && x.ok)) {
    for (const w of r.kept ?? []) if (w.exampleJa && w.exampleKo) pool.push({ topic: r.topic, level: r.level, textJa: w.textJa, reading: w.reading, meaningKo: w.meaningKo, exampleJa: w.exampleJa, exampleKo: w.exampleKo, row: r.id })
  }
  const rnd = mulberry32(SEED)
  const idx = pool.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return { poolSize: pool.length, picks: idx.slice(0, SAMPLE).map((i) => pool[i]) }
}

function save(rows: Row[], startedAt: string, stopped?: string) {
  const out: Saved = { startedAt, versions: { v1: VERSION_V1, v2: VERSION_V2 }, target: TARGET, rows, ...(stopped ? { stopped } : {}) }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

function report(saved: Saved) {
  const c = compare(saved.rows)
  console.log(`\n## 요약 (${saved.versions.v1} vs ${saved.versions.v2}, 목표 ${saved.target}장 → 요청 ${topicWordsRequestCount(saved.target)}, 시작 ${saved.startedAt}${saved.stopped ? `, 중단: ${saved.stopped}` : ''})`)
  console.log(JSON.stringify(c, null, 1))
  const s = sampleExamples(saved.rows)
  console.log(`\n## v2 예문 표본 ${s.picks.length}/${s.poolSize} (seed ${SEED})`)
  s.picks.forEach((p, i) => console.log(`${i + 1}\t[${p.level}/${p.topic}]\t${p.textJa} (${p.reading}: ${p.meaningKo})\t${p.exampleJa}\t${p.exampleKo}`))
  console.log(`\n판정: ${c.verdict}`)
}

async function main() {
  if (process.env.DUMP === '1') {
    report(JSON.parse(readFileSync(OUT, 'utf8')) as Saved)
    return
  }
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  if (process.env.RESUME === '1' && existsSync(OUT)) rows.push(...(JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows.filter((r) => r.ok || r.timeout))
  const done = new Set(rows.map((r) => r.id))
  const topics = new Map(fixture.topics.map((t) => [t.key, t]))
  for (const k of TOPIC_KEYS) if (!topics.has(k)) throw new Error(`픽스처에 주제 ${k} 없음`)
  let stopped: string | undefined
  let immediateFails = 0
  for (const c of buildPlan()) {
    if (done.has(c.id)) continue
    const row = await runCall(c, topics.get(c.topic)!)
    rows.push(row)
    save(rows, startedAt)
    console.log(row.ok
      ? `${c.id}\t${row.elapsedMs}ms\ta=${row.attempts}\tpc=${row.promptChars}\trc=${row.resultChars}\trecv=${row.received}\tkept=${row.keptCount}/${row.target}\tvalidFalse=${row.validFalse}\tex-null=${row.exampleNulled}`
      : `${c.id}\tFAIL ${row.elapsedMs}ms ${row.errorName}: ${row.error}`)
    if (row.limitHit) { stopped = `한도·429 문구 감지(${c.id})`; break }
    immediateFails = !row.ok && !row.timeout && row.elapsedMs < IMMEDIATE_FAIL_MS ? immediateFails + 1 : 0
    if (immediateFails >= 2) { stopped = `즉시 실패 2연속(${c.id})`; break }
    await sleep(GAP_MS)
  }
  if (stopped) { save(rows, startedAt, stopped); console.log(`BLOCKED: ${stopped} — 여기서 멈춘다(추정 없음).`) }
  report({ startedAt, versions: { v1: VERSION_V1, v2: VERSION_V2 }, target: TARGET, rows, ...(stopped ? { stopped } : {}) })
  console.log(`\n결과 파일: ${OUT}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
