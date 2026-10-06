/**
 * task-042 실측 — A12 `topicWords@v1`(챌린지 주제 새 단어, U3=B2)을 실제 Claude CLI(구독) 로 **직렬** 호출해 설계서 §4-3a 합격 게이트 3개를 잰다:
 *   ① 항목 검증 통과율 ≥85% ② 읽기 정확도 ≥95%(가나 검사 + 눈 판정) ③ 생성 p95 ≤15s.
 * 합성 입력만 쓴다(시드 주제 5개 — `tests/prompts/fixtures/topic-words.json` 의 topics). 학습자 대화·기록 없음.
 *
 * **DB 를 읽지도 쓰지도 않는다** — `engine/router` 의 `routerDeps.loadChain` 을 시드(`prisma/seed-data/engines.json` claude-cli-local) 모양의 고정 연결로
 * 바꿔 끼운다(orchestrator 테스트와 같은 관례). 그래서 tier→모델 매핑은 **시드 값**(fast=haiku·balanced=sonnet)이고 운영 DB 의 연결 값은 읽지 않는다.
 * `topicWords` task 가 아직 `LLM_TASKS` 에 없어(developer 몫) 같은 모양인 `wordEnrich`(fast·20s·interactive) 로 호출한다 — tier·레인·타임아웃 상한이
 * 계획된 A12 행(`fast`·20s·`interactive`)과 같다. 측정에서는 분포를 보려고 `timeoutMs` 를 60s 로 풀고 20s·30s 초과를 따로 센다.
 *
 * 호출 계획(`PLAN`) — 주제 5개 × 6일(목표 장수 [10,10,15,5,10,10]) = 30호출 + 큰 제외 목록 스트레스 3호출 = 33. 매일의 제외 목록 =
 * 그 주제 기본 표현 + 이전 날들에 **세트에 들어간 새 단어**(통과 항목 앞에서 목표 장수만큼 — 운영과 같다, 여분은 버림), 최근 것부터. 스트레스 3호출은 그때까지 모인
 * 새 단어 전체(최대 300개·2,000자)를 제외 목록으로 쓴다.
 *
 * 한도(429·`session limit`·`hit your`·한도)가 오류 문구나 JsonSchemaError.raw(stdout 에만 나오는 경우) 에서 보이면 **즉시 멈춘다** — 추정값을 쓰지 않는다.
 * 호출마다 OUT 에 덮어써 중단돼도 부분 결과가 남고, `RESUME=1` 이면 OUT 의 끝난 호출은 건너뛰고 이어서 한다(연쇄 상태는 저장된 통과 항목으로 복원).
 * 실패(타임아웃·한도·즉시 실패)는 분모에서 빼지 않고 따로 센다.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe042 && OUT=<결과.json> node --env-file=.env --import tsx tests/live/task042-topicwords-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · GAP_MS=1500 · TIMEOUT_MS=60000 · LIMIT=<최대 호출 수> · RESUME=1 · SKIP_STRESS=1 · TOPICS=<주제 key 쉼표 목록> · DEEP=<주제 key>:<일수> · DUMP=1(결과 파일만 읽어 표 출력, 호출 없음)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import {
  assembleTopicWords,
  buildTopicWordsExcludeLine,
  buildTopicWordsRequest,
  TOPIC_WORDS_PROMPT_VERSION,
  topicWordsRequestCount,
  type TopicWord,
  type TopicWordDropReason,
  type TopicWordsResponse,
} from '../../src/modules/conversation/prompts/topicWords'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

interface FxChunk { textJa: string; reading: string; meaningKo: string; chunkType: string }
interface FxTopic { key: string; title: string; titleJa: string; description: string; level: JlptLevel; chunks: FxChunk[] }
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words.json'), 'utf8')) as { topics: FxTopic[] }

const OUT = process.env.OUT ?? '/tmp/kaiwa-task042-topicwords-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000)
const MAX_CALLS = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i

// ── DB 없이 연결 고정(시드 claude-cli-local 모양) ──────────────────────────────────────────
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

interface PlanCall { id: string; topic: string; day: number; target: number; stress: boolean }
const TARGETS = [10, 10, 15, 5, 10, 10]
function buildPlan(): PlanCall[] {
  // DEEP=<주제 key>:<일수> — 한 주제만 목표 10장으로 오래 이어 부른다(제외 목록이 상한 300개·2,000자에 닿을 때까지 신선한 단어 수율이 어떻게 줄어드는지).
  const deep = (process.env.DEEP ?? '').split(':')
  if (deep[0]) return Array.from({ length: Number(deep[1] ?? 30) }, (_, i) => ({ id: `${deep[0]}-deep${i + 1}`, topic: deep[0], day: i + 1, target: 10, stress: false }))
  const plan: PlanCall[] = []
  for (const t of fixture.topics) TARGETS.forEach((target, i) => plan.push({ id: `${t.key}-d${i + 1}`, topic: t.key, day: i + 1, target, stress: false }))
  if (process.env.SKIP_STRESS !== '1') {
    for (const [i, key] of ['cafe-order', 'ask-directions', 'travel-story'].entries()) plan.push({ id: `stress-${i + 1}-${key}`, topic: key, day: 0, target: 10, stress: true })
  }
  const only = (process.env.TOPICS ?? '').split(',').filter(Boolean)
  return only.length ? plan.filter((c) => only.includes(c.topic)) : plan
}

interface Row {
  id: string
  topic: string
  level: JlptLevel
  day: number
  target: number
  count: number
  stress: boolean
  excludeSent: number
  excludeTruncated: number
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  resultChars?: number
  received?: number
  kept?: TopicWord[]
  dropped?: Array<{ textJa: string; reason: TopicWordDropReason }>
  droppedByReason?: Partial<Record<TopicWordDropReason, number>>
  jlptReported?: Record<string, number>
  chunkTypes?: Record<string, number>
  words?: Array<{ textJa: string; reading: string; meaningKo: string; chunkType: string; jlpt: string | null; valid: boolean }>
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
  const out: Saved = { startedAt, version: TOPIC_WORDS_PROMPT_VERSION, tier: TIER, rows }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

async function runCall(c: PlanCall, exclude: string[], baseExclude: string[], baseMeanings: string[], topic: FxTopic): Promise<Row> {
  const input = { topic: { title: topic.title, titleJa: topic.titleJa, description: topic.description, level: topic.level }, targetCount: c.target, exclude }
  const req = buildTopicWordsRequest(input)
  const count = topicWordsRequestCount(c.target)
  const ex = buildTopicWordsExcludeLine(exclude)
  const base: Row = { id: c.id, topic: c.topic, level: topic.level, day: c.day, target: c.target, count, stress: c.stress, excludeSent: ex.sent, excludeTruncated: ex.truncated, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    // 같은 모양의 기존 task(wordEnrich: fast·20s·interactive)로 부른다 — 위 머리 주석.
    const r = await llm.completeJson<TopicWordsResponse>({ ...req, task: 'wordEnrich', tier: TIER, timeoutMs: TIMEOUT_MS })
    const asm = assembleTopicWords(r.data, { level: topic.level, exclude: [...baseExclude, ...exclude], excludeMeanings: baseMeanings })
    const jlptReported: Record<string, number> = {}
    const chunkTypes: Record<string, number> = {}
    for (const w of r.data.words) {
      jlptReported[w.jlpt ?? 'null'] = (jlptReported[w.jlpt ?? 'null'] ?? 0) + 1
      chunkTypes[w.chunkType] = (chunkTypes[w.chunkType] ?? 0) + 1
    }
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length,
      received: asm.received, kept: asm.words, dropped: asm.dropped, droppedByReason: asm.droppedByReason, jlptReported, chunkTypes, words: r.data.words,
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${typeof err.raw === 'string' ? err.raw.slice(0, 2000) : ''}`
    return { ...base, ok: false, elapsedMs: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 240), limitHit: LIMIT_RE.test(blob) }
  }
}

function summarize(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const failed = rows.filter((r) => !r.ok)
  const received = ok.reduce((n, r) => n + (r.received ?? 0), 0)
  const kept = ok.reduce((n, r) => n + (r.kept?.length ?? 0), 0)
  const requested = ok.reduce((n, r) => n + r.count, 0)
  const drops: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.droppedByReason ?? {})) drops[k] = (drops[k] ?? 0) + (v as number)
  const ms = ok.map((r) => r.elapsedMs)
  const byCount: Record<string, number[]> = {}
  for (const r of ok) (byCount[String(r.count)] ??= []).push(r.elapsedMs)
  const readingFail = (drops.READING_CHARS ?? 0) + (drops.READING_MISMATCH ?? 0)
  const readingDenom = received - (drops.NOT_VALID ?? 0) - (drops.MALFORMED ?? 0) - (drops.ENGINE_NAME ?? 0) - (drops.SURFACE_CHARS ?? 0) - (drops.SURFACE_LEN ?? 0)
  const jlpt: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.jlptReported ?? {})) jlpt[k] = (jlpt[k] ?? 0) + v
  const chunk: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.chunkTypes ?? {})) chunk[k] = (chunk[k] ?? 0) + v
  const firstPass = ok.filter((r) => r.attempts === 1).length
  const schemaFail = failed.filter((r) => r.errorName === 'JsonSchemaError').length
  const timeouts = failed.filter((r) => /Timeout/i.test(r.errorName ?? '')).length
  const errNames: Record<string, number> = {}
  for (const r of failed) errNames[r.errorName ?? '?'] = (errNames[r.errorName ?? '?'] ?? 0) + 1
  return {
    calls: rows.length,
    ok: ok.length,
    failed: failed.length,
    errNames,
    limitHit: failed.some((r) => r.limitHit),
    ajvFirstPass: `${firstPass}/${ok.length + schemaFail} (JsonSchemaError ${schemaFail}, timeout ${timeouts})`,
    retried: ok.filter((r) => r.attempts === 2).length,
    itemsReceived: received,
    itemsKept: kept,
    itemPassRate: round((kept / Math.max(1, received)) * 100),
    keptOverRequested: round((kept / Math.max(1, requested)) * 100),
    callsKeptGeTarget: `${ok.filter((r) => (r.kept?.length ?? 0) >= r.target).length}/${ok.length}`,
    dropsByReason: drops,
    readingAutoPassRate: round((1 - readingFail / Math.max(1, readingDenom)) * 100),
    dupExcludedRate: round(((drops.DUP_EXCLUDED ?? 0) / Math.max(1, received)) * 100),
    dupResponseRate: round(((drops.DUP_RESPONSE ?? 0) / Math.max(1, received)) * 100),
    dupMeaningRate: round(((drops.DUP_MEANING ?? 0) / Math.max(1, received)) * 100),
    jlptReported: jlpt,
    chunkTypes: chunk,
    latencyMs: { p50: pct(ms, 50), p95: pct(ms, 95), max: ms.length ? Math.max(...ms) : NaN, over15s: ms.filter((x) => x > 15_000).length, over20s: ms.filter((x) => x > 20_000).length, over30s: ms.filter((x) => x > 30_000).length },
    latencyByCount: Object.fromEntries(Object.entries(byCount).map(([k, v]) => [`count${k}(n=${v.length})`, { p50: pct(v, 50), p95: pct(v, 95), max: Math.max(...v) }])),
    promptChars: { min: Math.min(...ok.map((r) => r.promptChars ?? 0)), max: Math.max(...ok.map((r) => r.promptChars ?? 0)) },
    resultChars: { p50: pct(ok.map((r) => r.resultChars ?? 0), 50), max: Math.max(...ok.map((r) => r.resultChars ?? 0)) },
  }
}

function dump(rows: Row[]) {
  for (const r of rows) {
    console.log(`\n## ${r.id} (${r.level}, 목표 ${r.target}, 요청 ${r.count}, 제외 ${r.excludeSent}${r.excludeTruncated ? `+${r.excludeTruncated}잘림` : ''}) — ${r.ok ? `${r.elapsedMs}ms attempts=${r.attempts} 통과 ${r.kept?.length}/${r.received}` : `FAIL ${r.errorName}: ${r.error}`}`)
    if (!r.ok) continue
    const dropMap = new Map((r.dropped ?? []).map((d) => [d.textJa, d.reason]))
    for (const w of r.words ?? []) console.log(`  ${dropMap.has(w.textJa) ? 'x' : 'o'} ${w.textJa}\t${w.reading}\t${w.meaningKo}\t${w.chunkType}\t${w.jlpt ?? '-'}${dropMap.has(w.textJa) ? `\t[${dropMap.get(w.textJa)}]` : ''}`)
  }
}

async function main() {
  if (process.env.DUMP === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    dump(saved.rows)
    console.log('\n' + JSON.stringify(summarize(saved.rows), null, 1))
    return
  }
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  if (process.env.RESUME === '1' && existsSync(OUT)) rows.push(...(JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows.filter((r) => r.ok))
  const done = new Set(rows.map((r) => r.id))
  const topics = new Map(fixture.topics.map((t) => [t.key, t]))
  const baseOf = (t: FxTopic) => t.chunks.map((c) => c.textJa)
  const meaningsOf = (t: FxTopic) => t.chunks.map((c) => c.meaningKo)
  // 연쇄 상태 — 주제별로 "세트에 들어간 새 단어"(최근 것이 앞).
  const prior = new Map<string, string[]>()
  const pool: string[] = [] // 스트레스용 전체 새 단어(최근 것이 앞)
  const addKept = (key: string, kept: TopicWord[], target: number) => {
    const surf = kept.slice(0, target).map((w) => w.textJa)
    prior.set(key, [...surf, ...(prior.get(key) ?? [])])
    pool.unshift(...surf)
  }
  const plan = buildPlan()
  for (const c of plan) {
    const prev = rows.find((r) => r.id === c.id)
    if (prev && !c.stress) addKept(c.topic, prev.kept ?? [], c.target)
    else if (prev && c.stress) {
      /* 스트레스 호출은 연쇄 상태에 더하지 않는다 */
    }
  }
  let calls = 0
  for (const c of plan) {
    if (done.has(c.id)) continue
    if (calls >= MAX_CALLS) break
    const topic = topics.get(c.topic)!
    const base = baseOf(topic)
    // 제외 목록 = 주제 기본 표현(항상 먼저) + 이전 새 단어(최근 것부터). 상한(300개·2,000자)에 걸리면 오래된 새 단어가 잘린다 — 서버 쪽 검사는 원본 전체로 한다.
    const exclude = c.stress ? [...base, ...pool] : [...base, ...(prior.get(c.topic) ?? [])]
    const row = await runCall(c, exclude, base, meaningsOf(topic), topic)
    rows.push(row)
    calls++
    save(rows, startedAt)
    console.log(row.ok
      ? `${c.id}\t${row.elapsedMs}ms\ta=${row.attempts}\tpc=${row.promptChars}\trecv=${row.received}\tkept=${row.kept?.length}/${c.target}\tdrops=${JSON.stringify(row.droppedByReason)}`
      : `${c.id}\tFAIL ${row.elapsedMs}ms ${row.errorName}: ${row.error}`)
    if (row.limitHit) {
      console.log('BLOCKED: 한도·429 문구 감지 — 여기서 멈춘다(추정 없음). 한도가 풀린 뒤 RESUME=1 로 이어서 실행.')
      break
    }
    if (row.ok && !c.stress) addKept(c.topic, row.kept ?? [], c.target)
    await sleep(GAP_MS)
  }
  console.log('\n## 요약\n' + JSON.stringify(summarize(rows), null, 1))
  console.log(`\n결과 파일: ${OUT}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
