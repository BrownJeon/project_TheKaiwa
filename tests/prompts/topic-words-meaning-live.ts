/**
 * task-079 갈래 B(IMP-0055) — A12 `topicWords` 의 `meaningKo`(특히 쉼표 뒤 보조 뜻)가 한자음을 뒤집거나 다른 낱말로 바꿔치기되는 문제(저장된 57개 중 7개 ≈ 12%)를
 * `topicWords@v3`(현재 운영) ↔ `topicWords@v4`(meaningKo 지시만 고침) 로 **눈가림 비교**하고, v4 가 task-078 의 N2 통과를 깨지 않는지(가드) 재는 라이브 하네스.
 *
 * ── 안전장치(task-078 에서 import 부작용으로 라이브 호출 2회가 더 나간 사고가 있었다) ───────────────────────────────────────────────
 *  1. `main()` 은 **직접 실행일 때만** 돈다(import 해도 호출 0). 직접 실행이어도 `GO=1` 이 없으면 DRY(호출 0)다.
 *  2. **하드 상한 40회** — 코드 상수(`HARD_CAP`)이고 환경변수(`MAX_CALLS`)는 낮추는 쪽으로만 듣는다. 호출 **직전에** 원장(`calls.json`)에 `started` 행을 먼저 쓰고,
 *     원장 행 수(실패·중단 포함) + 이미 쓴 CLI 시도 수가 상한에 닿으면 멈춘다. 같은 호출 id 는 원장에 있으면 다시 부르지 않는다(실패해도 1회로 센다).
 *  3. 잠금 파일(`run.lock`) — 이미 도는 실행이 있으면 시작하지 않는다.
 *  4. 429·한도 문구 또는 즉시 실패(5초 안 비타임아웃 오류) 2연속이면 멈추고 그대로 기록한다. 직렬·호출 간격 ≥ 1.5초.
 *
 * ── 설계(실행 전 고정, 이력서 «구현 계획 › 갈래 B») ──────────────────────────────────────────────────────────────────────────────
 *  STAGE=pair  : 같은 입력 10개 × arm 2(v3·v4) = 20회. 입력마다 두 arm 의 실행 순서를 번갈아(시간 편향 완화). 입력 = 합성 주제(AI 가 만든 일반 주제, 사용자 데이터 0).
 *  STAGE=guard : N2 가드 10회 — 주제 N4 `weekend-plan`(픽스처) + 챌린지 N2, **v4** 로. task-078 의 N2 측정(`topic-words-level-live.ts` improve 계획)과 같은 입력 10개(variant 0~7·0#2·4#2),
 *                제외 목록 = 그 주제 기본 표현 12개. 비교 기준 = task-078 측정 평균 8.10 장.
 *  STAGE=reserve: 예비 10회 — `RERUN` 에 다시 부를 호출 id 를 적고 `RESERVE_REASON` 을 줘야만 돈다(쓰지 않으면 쓰지 않는다).
 *  MODE=report : 호출 0 — rows.json·calls.json 을 읽어 객관 지표를 계산하고, 눈가림 표(blind-words.md)·열쇠(key.json)를 만든다(이미 있으면 FORCE=1 없이는 덮어쓰지 않는다).
 *  MODE=score  : 호출 0 — Leader 판정 파일(VERDICTS)과 key.json 으로 (a) 를 계산한다. 이 하네스는 뜻을 스스로 판정하지 않는다(자기 채점 금지).
 *
 * ── arm 정의 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *  v3 = 운영 `SYSTEM_PROMPT` 그대로(`meaningKo` 줄 = `MEANING_LINE_V3`), v4 = 그 줄 하나만 `MEANING_LINE_V4` 로 바꾼 것. 다른 줄·스키마·입력 블록은 바이트 동일.
 *  운영 파일이 v4 로 바뀐 뒤에도 같은 하네스가 돈다(둘 중 어느 줄이 들어 있든 정확히 1번 나오면 목표 줄로 바꾼다).
 *
 * 한계(숨기지 않는다): 단일 모델(haiku)·입력당 표본 1개(arm 별 10회)·**첫날 조건(제외 목록 비움)**·합성 주제·뜻 판정자는 AI(Leader) 한 명.
 *
 * 실행(전용 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe079 && GO=1 STAGE=pair OUT_DIR=<폴더> node --env-file=.env --import tsx tests/prompts/topic-words-meaning-live.ts
 * 환경: OUT_DIR · STAGE=pair|guard|reserve · MODE=report|score · GO=1(라이브) · MAX_CALLS(≤40) · GAP_MS(≥1500) · RERUN · RESERVE_REASON · FORCE=1 · VERDICTS
 */
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import {
  assembleTopicWords,
  buildTopicWordsRequest,
  TOPIC_WORDS_PROMPT_VERSION,
  type TopicWordsResponse,
} from '../../src/modules/conversation/prompts/topicWords'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

// ── 상수 ─────────────────────────────────────────────────────────────────────────────────────
/** 라이브 호출 하드 상한(이력서 확정값). 환경변수로 올릴 수 없다. */
export const HARD_CAP = 40
const MAX_CALLS = Math.min(HARD_CAP, Math.max(0, Math.trunc(Number(process.env.MAX_CALLS ?? HARD_CAP))))
const GAP_MS = Math.max(1500, Number(process.env.GAP_MS ?? 1500))
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), 'thekaiwa-pe079-meaning')
const LEDGER = join(OUT_DIR, 'calls.json')
const ROWS = join(OUT_DIR, 'rows.json')
const LOCK = join(OUT_DIR, 'run.lock')
const TARGET = 10
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const IMMEDIATE_FAIL_MS = 5_000

/** 합격선(이력서 «구현 계획 › 갈래 B», 사후 변경 금지). (a) 는 Leader 눈가림 판정 뒤 `MODE=score` 가 계산한다. */
export const GATES = {
  /** (b) N2 가드 평균 통과 장수 ≥ 8.10 − 0.5 */
  guardMeanMin: 7.6,
  /** (c) 검사 통과율(남김/받음)이 v3 arm 보다 5%p 넘게 낮지 않음 */
  passRateMaxDropPp: 5,
  /** (d) 출력 길이·지연이 v3 대비 +15% 이내 */
  lengthLatencyMaxRatio: 1.15,
  /** (a) v4 의 «어색+틀림» 비율 ≤ v3 의 절반이고 절대 6% 이하 */
  badRatioMaxOfV3: 0.5,
  badAbsMaxPct: 6,
} as const
/** task-078 에서 같은 입력 10개로 잰 운영 v3 의 N2 평균 통과 장수(비교 기준). */
export const TASK078_N2_MEAN = 8.1

// ── arm 별 meaningKo 줄 ──────────────────────────────────────────────────────────────────────
export const MEANING_LINE_V3 = '- meaningKo: 한국어 뜻을 짧게(1~3개, 쉼표로 구분). 설명문·일본어·괄호 병기 금지.'
export const MEANING_LINE_V4 =
  '- meaningKo: 한국에서 실제로 쓰는 가장 흔한 낱말로 짧게. 쉼표 뒤 보조 뜻(최대 2개)은 흔히 쓰는 낱말이고 첫 뜻과 다른 뜻을 더해 줄 때만 붙입니다(예: 定食 → 정식, 한 끼 식사). 한자음을 뒤집거나 비슷한 다른 낱말로 바꾸지 않고, 같은 말의 어미·활용만 바꾼 뜻은 붙이지 않으며, 확신이 없으면 첫 뜻 하나만 씁니다. 설명문·일본어·괄호 병기 금지.'

export type Arm = 'v3' | 'v4'
const ARM_LINE: Record<Arm, string> = { v3: MEANING_LINE_V3, v4: MEANING_LINE_V4 }

/** 운영 system 의 meaningKo 줄(v3 또는 v4)을 arm 의 줄로 바꾼다. 어느 줄이든 정확히 1번이어야 한다. */
export function systemForArm(system: string, arm: Arm): string {
  const have = [MEANING_LINE_V3, MEANING_LINE_V4].filter((l) => system.split(l).length - 1 === 1)
  if (have.length !== 1) throw new Error(`meaningKo 줄을 정확히 1개 찾지 못했다(찾은 ${have.length}개) — 운영 프롬프트가 바뀌었다`)
  return system.replace(have[0], () => ARM_LINE[arm])
}

// ── 입력(실행 전 고정) ───────────────────────────────────────────────────────────────────────
interface SynTopic { key: string; title: string; titleJa: string; description: string }
/** 합성 주제 — 일상 실용 영역(호텔·병원·쇼핑·환불·교통·마트·직장·식당). 설명은 실패 사례의 한국어 정답(영수증·접수·탈의실·숙박·이동·재고 …)을 넣지 않는다. */
const SYN: Record<string, SynTopic> = {
  hotel: { key: 'hotel', title: '호텔 체크인', titleJa: 'ホテルのチェックイン', description: '호텔에 도착해 방을 받고 시설과 필요한 것을 묻고 부탁해요' },
  clinic: { key: 'clinic', title: '병원 진료', titleJa: '病院で', description: '아플 때 병원에서 증상을 말하고 진료와 약 처방에 대해 이야기해요' },
  clothes: { key: 'clothes', title: '옷 가게 쇼핑', titleJa: '服を買う', description: '옷 가게에서 사이즈와 색을 묻고 입어 보고 계산해요' },
  refund: { key: 'refund', title: '환불과 교환', titleJa: '返品と交換', description: '산 물건에 문제가 있어서 가게에 돌려주거나 바꿔 달라고 말해요' },
  airport: { key: 'airport', title: '공항과 교통', titleJa: '空港と交通', description: '공항과 역에서 표를 사고 탈 것을 확인하며 목적지로 가요' },
  mart: { key: 'mart', title: '슈퍼마켓 장보기', titleJa: 'スーパーで買い物', description: '마트에서 필요한 물건을 찾고 점원에게 묻고 계산해요' },
  office: { key: 'office', title: '회사 업무 대화', titleJa: '会社での仕事', description: '직장에서 일정과 업무를 조정하고 동료와 의논해요' },
  restaurant: { key: 'restaurant', title: '식당 예약과 주문', titleJa: 'レストランで食事', description: '식당에 자리를 정하고 메뉴를 고르고 주문하고 계산해요' },
}
interface PairInput { id: string; topic: keyof typeof SYN; level: JlptLevel; variant: number }
export const PAIR_INPUTS: PairInput[] = [
  { id: 'P01', topic: 'hotel', level: 'N3', variant: 0 },
  { id: 'P02', topic: 'clinic', level: 'N3', variant: 0 },
  { id: 'P03', topic: 'clothes', level: 'N3', variant: 0 },
  { id: 'P04', topic: 'refund', level: 'N2', variant: 0 },
  { id: 'P05', topic: 'airport', level: 'N2', variant: 0 },
  { id: 'P06', topic: 'hotel', level: 'N2', variant: 1 },
  { id: 'P07', topic: 'clinic', level: 'N2', variant: 2 },
  { id: 'P08', topic: 'mart', level: 'N3', variant: 4 },
  { id: 'P09', topic: 'office', level: 'N2', variant: 0 },
  { id: 'P10', topic: 'restaurant', level: 'N3', variant: 5 },
]
/** task-078 improve 계획의 N2 variant 순서(`IMPROVE_VARIANTS.N2`)와 같다 — 같은 입력으로 v3(8.10)과 비교한다. */
export const GUARD_VARIANTS = [0, 1, 2, 3, 4, 5, 6, 7, 0, 4]

interface FxChunk { textJa: string; reading: string; meaningKo: string; chunkType: string }
interface FxTopic { key: string; title: string; titleJa: string; description: string; level: JlptLevel; chunks: FxChunk[] }

interface Planned {
  callId: string
  stage: 'pair' | 'guard' | 'reserve'
  /** 입력을 만드는 방식(reserve 는 원래 계획의 출처를 따른다). */
  origin: 'pair' | 'guard'
  arm: Arm
  inputId: string
  topicKey: string
  level: JlptLevel
  variant: number
}

export function buildPlan(stage: 'pair' | 'guard'): Planned[] {
  if (stage === 'guard') {
    const seen = new Map<string, number>()
    return GUARD_VARIANTS.map((v) => {
      const base = `N2-v${v}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      const inputId = n === 1 ? base : `${base}#${n}`
      return { callId: `guard:${inputId}:v4`, stage: 'guard' as const, origin: 'guard' as const, arm: 'v4' as const, inputId, topicKey: 'weekend-plan', level: 'N2' as JlptLevel, variant: v }
    })
  }
  const plan: Planned[] = []
  PAIR_INPUTS.forEach((p, i) => {
    const order: Arm[] = i % 2 === 0 ? ['v3', 'v4'] : ['v4', 'v3']
    for (const arm of order) plan.push({ callId: `pair:${p.id}:${arm}`, stage: 'pair', origin: 'pair', arm, inputId: p.id, topicKey: p.topic, level: p.level, variant: p.variant })
  })
  return plan
}

// ── 연결 고정(DB 없음, task-078 하네스와 같다) ────────────────────────────────────────────────
const STUB_CONNECTION: ResolvedConnection = {
  id: 'stub-claude-cli-local',
  key: 'claude-cli-local',
  engineId: 'claude-cli',
  connectionType: 'CLI',
  connection: {},
  runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, concurrency: 1, interactiveLane: true, permissionMode: 'dontAsk', tools: '' },
  credentialRef: null,
}

// ── 원장·결과 ────────────────────────────────────────────────────────────────────────────────
interface LedgerEntry {
  seq: number
  callId: string
  arm: Arm
  inputId: string
  stage: string
  status: 'started' | 'ok' | 'failed'
  startedAt: string
  endedAt?: string
  elapsedMs?: number
  attempts?: number
  reserveReason?: string
}
interface Row {
  callId: string
  stage: string
  arm: Arm
  inputId: string
  topicKey: string
  level: JlptLevel
  variant: number
  ok: boolean
  elapsedMs: number
  attempts?: number
  model?: string
  promptChars?: number
  systemChars: number
  outputChars?: number
  received?: number
  kept?: number
  droppedByReason?: Record<string, number>
  /** 통과한 단어(앞에서부터 목표 장수로 자르기 전, 응답 순서). */
  keptWords?: Array<{ textJa: string; reading: string; meaningKo: string; jlpt: string | null }>
  errorName?: string
  error?: string
  limitHit?: boolean
  timeout?: boolean
}

function atomicWrite(path: string, text: string) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, path)
}
function readLedger(): LedgerEntry[] {
  return existsSync(LEDGER) ? (JSON.parse(readFileSync(LEDGER, 'utf8')) as LedgerEntry[]) : []
}
function readRows(): Row[] {
  return existsSync(ROWS) ? (JSON.parse(readFileSync(ROWS, 'utf8')) as Row[]) : []
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── 입력 조립 ────────────────────────────────────────────────────────────────────────────────
let fixtureCache: { topics: FxTopic[] } | null = null
function fixtureTopic(key: string): FxTopic {
  fixtureCache ??= JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words.json'), 'utf8')) as { topics: FxTopic[] }
  const t = fixtureCache.topics.find((x) => x.key === key)
  if (!t) throw new Error(`픽스처에 주제 ${key} 없음`)
  return t
}

function inputFor(p: Planned) {
  if (p.origin === 'guard') {
    const t = fixtureTopic(p.topicKey)
    const exclude = t.chunks.map((c) => c.textJa)
    const excludeMeanings = t.chunks.map((c) => c.meaningKo)
    return { exclude, excludeMeanings, input: { topic: { title: t.title, titleJa: t.titleJa, description: t.description, level: p.level }, targetCount: TARGET, exclude, variant: p.variant } }
  }
  const s = SYN[p.topicKey]
  return { exclude: [] as string[], excludeMeanings: [] as string[], input: { topic: { title: s.title, titleJa: s.titleJa, description: s.description, level: p.level }, targetCount: TARGET, exclude: [] as string[], variant: p.variant } }
}

function requestFor(p: Planned) {
  const { exclude, excludeMeanings, input } = inputFor(p)
  const req = buildTopicWordsRequest(input)
  return { req: { ...req, system: systemForArm(req.system, p.arm) }, exclude, excludeMeanings }
}

// ── 라이브 실행 ──────────────────────────────────────────────────────────────────────────────
function acquireLock() {
  mkdirSync(OUT_DIR, { recursive: true })
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8').trim())
    let alive = false
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); alive = true } catch { alive = false }
    }
    if (alive) throw new Error(`이미 실행 중인 호출이 있다(pid ${pid}) — 시작하지 않는다`)
  }
  writeFileSync(LOCK, String(process.pid))
}
function releaseLock() {
  try { if (existsSync(LOCK) && readFileSync(LOCK, 'utf8').trim() === String(process.pid)) unlinkSync(LOCK) } catch { /* 무시 */ }
}

async function runLive(plan: Planned[], reserveReason?: string) {
  routerDeps.loadChain = async () => [STUB_CONNECTION]
  acquireLock()
  const rows = readRows()
  const ledger = readLedger()
  let stopped: string | undefined
  let immediateFails = 0
  try {
    for (const p of plan) {
      if (ledger.some((e) => e.callId === p.callId)) continue // 원장에 있으면(실패 포함) 다시 부르지 않는다
      const attemptsUsed = ledger.reduce((n, e) => n + (e.attempts ?? 1), 0)
      if (ledger.length >= MAX_CALLS || attemptsUsed >= HARD_CAP) { stopped = `호출 상한 도달(원장 ${ledger.length}행 · CLI 시도 ${attemptsUsed}회 · 상한 ${MAX_CALLS})`; break }
      const { req, exclude, excludeMeanings } = requestFor(p)
      const startedAt = new Date().toISOString()
      const entry: LedgerEntry = { seq: ledger.length + 1, callId: p.callId, arm: p.arm, inputId: p.inputId, stage: p.stage, status: 'started', startedAt, ...(reserveReason ? { reserveReason } : {}) }
      ledger.push(entry)
      atomicWrite(LEDGER, JSON.stringify(ledger, null, 1)) // 호출 직전에 먼저 센다
      const t0 = Date.now()
      let row: Row
      try {
        const r = await llm.completeJson<TopicWordsResponse>(req)
        const asm = assembleTopicWords(r.data, { level: p.level, exclude, excludeMeanings })
        row = {
          callId: p.callId, stage: p.stage, arm: p.arm, inputId: p.inputId, topicKey: p.topicKey, level: p.level, variant: p.variant,
          ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, systemChars: req.system.length,
          outputChars: JSON.stringify(r.data).length, received: asm.received, kept: asm.words.length, droppedByReason: asm.droppedByReason as Record<string, number>,
          keptWords: asm.words.map((w) => ({ textJa: w.textJa, reading: w.reading, meaningKo: w.meaningKo, jlpt: w.jlpt })),
        }
        entry.status = 'ok'
        entry.attempts = r.attempts
        entry.elapsedMs = r.elapsedMs
      } catch (e) {
        const err = e as Error & { raw?: string }
        const blob = `${err.message}\n${typeof err.raw === 'string' ? err.raw.slice(0, 2000) : ''}`
        const elapsed = Date.now() - t0
        row = {
          callId: p.callId, stage: p.stage, arm: p.arm, inputId: p.inputId, topicKey: p.topicKey, level: p.level, variant: p.variant,
          ok: false, elapsedMs: elapsed, systemChars: req.system.length, errorName: err.name, error: err.message.slice(0, 240), limitHit: LIMIT_RE.test(blob), timeout: /Timeout/i.test(err.name),
        }
        entry.status = 'failed'
        entry.attempts = 1
        entry.elapsedMs = elapsed
      }
      entry.endedAt = new Date().toISOString()
      rows.push(row)
      atomicWrite(LEDGER, JSON.stringify(ledger, null, 1))
      atomicWrite(ROWS, JSON.stringify(rows, null, 1))
      console.log(row.ok
        ? `${p.callId}\t[${p.level}]\t${row.elapsedMs}ms\ta=${row.attempts}\tpc=${row.promptChars}\tout=${row.outputChars}\trecv=${row.received}\tkept=${row.kept}\tdrops=${JSON.stringify(row.droppedByReason)}`
        : `${p.callId}\tFAIL ${row.elapsedMs}ms ${row.errorName}: ${row.error}`)
      if (row.limitHit) { stopped = `한도·429 문구 감지(${p.callId})`; break }
      immediateFails = !row.ok && !row.timeout && row.elapsedMs < IMMEDIATE_FAIL_MS ? immediateFails + 1 : 0
      if (immediateFails >= 2) { stopped = `즉시 실패 2연속(${p.callId})`; break }
      await sleep(GAP_MS)
    }
  } finally {
    releaseLock()
  }
  if (stopped) console.log(`BLOCKED: ${stopped} — 여기서 멈춘다.`)
  console.log(`\n원장 ${readLedger().length}행 / 상한 ${MAX_CALLS} · 결과 ${ROWS}`)
}

// ── 지표(객관) ───────────────────────────────────────────────────────────────────────────────
const round = (n: number, d = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const median = (xs: number[]) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const stdev = (xs: number[]) => {
  if (xs.length < 2) return NaN
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/** 쉼표(,，、)로 뜻을 나눈다. 빈 조각은 버린다. */
export function splitMeanings(s: string): string[] {
  return s.split(/[,，、]/).map((x) => x.trim()).filter(Boolean)
}

function armStats(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const received = ok.reduce((n, r) => n + (r.received ?? 0), 0)
  const kept = ok.reduce((n, r) => n + (r.kept ?? 0), 0)
  const cut = ok.flatMap((r) => (r.keptWords ?? []).slice(0, TARGET))
  const nm = cut.map((w) => splitMeanings(w.meaningKo).length)
  const dupInside = cut.filter((w) => {
    const ms = splitMeanings(w.meaningKo)
    return new Set(ms).size < ms.length
  }).length
  const perSet = ok.map((r) => Math.min(r.kept ?? 0, TARGET))
  return {
    calls: rows.length,
    ok: ok.length,
    failed: rows.length - ok.length,
    received,
    kept,
    passRatePct: round((kept / Math.max(1, received)) * 100, 1),
    keptPerSet: perSet,
    keptMean: round(mean(perSet), 2),
    keptSd: round(stdev(perSet), 2),
    keptMin: perSet.length ? Math.min(...perSet) : NaN,
    droppedByReason: ok.reduce<Record<string, number>>((m, r) => { for (const [k, v] of Object.entries(r.droppedByReason ?? {})) m[k] = (m[k] ?? 0) + v; return m }, {}),
    words: cut.length,
    multiMeaningWords: nm.filter((n) => n >= 2).length,
    multiMeaningPct: round((nm.filter((n) => n >= 2).length / Math.max(1, cut.length)) * 100, 1),
    meaningsPerWord: round(mean(nm), 2),
    meaningCharsPerWord: round(mean(cut.map((w) => [...w.meaningKo].length)), 1),
    identicalMeaningRepeats: dupInside,
    outputCharsMean: round(mean(ok.map((r) => r.outputChars ?? 0)), 0),
    outputCharsMedian: round(median(ok.map((r) => r.outputChars ?? 0)), 0),
    latencyMsMean: round(mean(ok.map((r) => r.elapsedMs)), 0),
    latencyMsMedian: round(median(ok.map((r) => r.elapsedMs)), 0),
    latencyMsMax: ok.length ? Math.max(...ok.map((r) => r.elapsedMs)) : NaN,
    promptCharsMean: round(mean(ok.map((r) => r.promptChars ?? 0)), 0),
    systemChars: ok[0]?.systemChars ?? NaN,
    attemptsSum: ok.reduce((n, r) => n + (r.attempts ?? 1), 0) + (rows.length - ok.length),
  }
}

export function computeReport(rows: Row[], ledger: LedgerEntry[]) {
  const pair = rows.filter((r) => r.stage === 'pair')
  const v3 = armStats(pair.filter((r) => r.arm === 'v3'))
  const v4 = armStats(pair.filter((r) => r.arm === 'v4'))
  // 가드: 입력(inputId)마다 세트 1개. 처음 계획한 호출(stage=guard)이 성공했으면 그것을, 실패했고 예비에서 같은 입력을 다시 불렀다면(callId `guard:<입력>:v4#rN`) 성공한 재실행을 쓴다.
  const guardAsRun = rows.filter((r) => r.stage === 'guard')
  const guardRerun = rows.filter((r) => r.stage === 'reserve' && r.callId.startsWith('guard:'))
  const guardSets = GUARD_VARIANTS.map((_, i) => buildPlan('guard')[i].inputId).map((inputId) => {
    const first = guardAsRun.find((r) => r.inputId === inputId)
    if (first?.ok) return { row: first, rerun: false }
    const re = guardRerun.find((r) => r.inputId === inputId && r.ok)
    return re ? { row: re, rerun: true } : { row: first ?? null, rerun: false }
  })
  const guardCompleted = guardSets.flatMap((x) => (x.row?.ok ? [x.row] : []))
  const g = armStats(guardCompleted)
  const asRunOk = guardAsRun.filter((r) => r.ok)
  const asRunSets = asRunOk.map((r) => Math.min(r.kept ?? 0, TARGET))
  const failZeroSets = guardAsRun.map((r) => (r.ok ? Math.min(r.kept ?? 0, TARGET) : 0))
  const pairComplete = v3.ok === PAIR_INPUTS.length && v4.ok === PAIR_INPUTS.length
  const ratio = (a: number, b: number) => round(a / b, 3)
  const cDrop = round(v3.passRatePct - v4.passRatePct, 1)
  const out = {
    calls: { ledgerRows: ledger.length, hardCap: HARD_CAP, byStage: ledger.reduce<Record<string, number>>((m, e) => { m[e.stage] = (m[e.stage] ?? 0) + 1; return m }, {}), cliAttemptsSum: ledger.reduce((n, e) => n + (e.attempts ?? 1), 0), failed: ledger.filter((e) => e.status === 'failed').length, unfinished: ledger.filter((e) => e.status === 'started').length },
    pair: { v3, v4, complete: pairComplete },
    guard: {
      stats: g,
      complete: g.ok >= GUARD_VARIANTS.length,
      task078V3Mean: TASK078_N2_MEAN,
      rerunInputs: guardSets.filter((x) => x.rerun).map((x) => x.row?.inputId),
      failedAsRun: guardAsRun.filter((r) => !r.ok).map((r) => ({ callId: r.callId, errorName: r.errorName, elapsedMs: r.elapsedMs })),
      // 민감도(참고, 합격선은 «완성한 10세트» 평균): 처음 실행 그대로(성공 세트만) · 실패 세트를 0장으로 센 평균
      sensitivity: { asRunSuccessOnly: { n: asRunSets.length, mean: round(mean(asRunSets), 2), perSet: asRunSets }, asRunFailureAsZero: { n: failZeroSets.length, mean: round(mean(failZeroSets), 2), perSet: failZeroSets } },
    },
    gates: {
      b_guardMean: g.ok === 0 ? null : { mean: g.keptMean, min: GATES.guardMeanMin, sd: g.keptSd, perSet: g.keptPerSet, pass: g.keptMean >= GATES.guardMeanMin, deltaVsTask078: round(g.keptMean - TASK078_N2_MEAN, 2) },
      c_passRate: !pairComplete ? null : { v3Pct: v3.passRatePct, v4Pct: v4.passRatePct, dropPp: cDrop, maxDropPp: GATES.passRateMaxDropPp, pass: cDrop <= GATES.passRateMaxDropPp },
      d_lengthLatency: !pairComplete
        ? null
        : {
            outputRatioMean: ratio(v4.outputCharsMean, v3.outputCharsMean),
            outputRatioMedian: ratio(v4.outputCharsMedian, v3.outputCharsMedian),
            latencyRatioMean: ratio(v4.latencyMsMean, v3.latencyMsMean),
            latencyRatioMedian: ratio(v4.latencyMsMedian, v3.latencyMsMedian),
            max: GATES.lengthLatencyMaxRatio,
            // 합격선은 평균 기준으로 고정한다(중앙값은 참고).
            pass: ratio(v4.outputCharsMean, v3.outputCharsMean) <= GATES.lengthLatencyMaxRatio && ratio(v4.latencyMsMean, v3.latencyMsMean) <= GATES.lengthLatencyMaxRatio,
          },
    },
    guardLatencyVsTask078: g.ok === 0 ? null : { note: '참고(합격선 아님) — task-078 v3 N2 25회 측정: p50 약 10.7초(N2 만), 최대 12.12초', v4GuardMedianMs: g.latencyMsMedian, v4GuardMaxMs: g.latencyMsMax },
  }
  return out
}

// ── 눈가림 표·열쇠 ───────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildBlind(rows: Row[], seed = 79) {
  const items: Array<{ arm: Arm; callId: string; textJa: string; reading: string; meaningKo: string }> = []
  for (const r of rows.filter((x) => x.stage === 'pair' && x.ok)) {
    for (const w of (r.keptWords ?? []).slice(0, TARGET)) items.push({ arm: r.arm, callId: r.callId, textJa: w.textJa, reading: w.reading, meaningKo: w.meaningKo.replace(/\s+/g, ' ').trim() })
  }
  const rnd = mulberry32(seed)
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  const rowsOut = items.map((it, i) => ({ id: `W${String(i + 1).padStart(3, '0')}`, ...it }))
  const esc = (s: string) => s.replace(/\|/g, '\\|')
  const md = [
    '# 눈가림 표 — A12 새 단어 한국어 뜻 (task-079 갈래 B)',
    '',
    `단어 ${rowsOut.length}개(섞인 순서). 어느 조건에서 나온 단어인지는 이 파일에 없다(열쇠 \`key.json\` 은 판정이 끝나기 전에 열지 않는다).`,
    '',
    '판정 방법: 각 단어의 **모든 뜻**(쉼표로 나뉜 첫 뜻·보조 뜻 전부)을 «맞음 / 어색 / 틀림» 으로 본다.',
    '- 맞음 = 한국에서 실제로 그 뜻으로 쓰는 자연스러운 말 · 어색 = 뜻은 통하지만 한국어로 잘 쓰지 않거나 부자연스러운 말(한자음을 어색하게 읽은 말 포함) · 틀림 = 그 단어의 뜻이 아니거나 다른 낱말',
    '- 판정 파일 형식(`MODE=score` 가 읽는다): 한 줄에 한 단어 `W012 맞음,어색` (뜻 개수만큼 쉼표로, 뜻이 하나면 하나). 영문 `ok,awkward,wrong` 도 된다.',
    '',
    '| id | 표기 | 읽기 | 뜻(전체) |',
    '|---|---|---|---|',
    ...rowsOut.map((r) => `| ${r.id} | ${esc(r.textJa)} | ${esc(r.reading)} | ${esc(r.meaningKo)} |`),
    '',
  ].join('\n')
  const key = Object.fromEntries(rowsOut.map((r) => [r.id, { arm: r.arm, callId: r.callId }]))
  return { md, key, count: rowsOut.length }
}

// ── (a) 채점(판정은 Leader 몫, 이 함수는 계산만) ─────────────────────────────────────────────
type Verdict = 'ok' | 'awkward' | 'wrong'
const V_MAP: Record<string, Verdict> = { 맞음: 'ok', 어색: 'awkward', 틀림: 'wrong', ok: 'ok', awkward: 'awkward', wrong: 'wrong' }
export function parseVerdicts(text: string): Map<string, Verdict[]> {
  const m = new Map<string, Verdict[]>()
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const mm = /^(W\d{3})\s+(.+)$/.exec(t)
    if (!mm) throw new Error(`판정 줄을 읽을 수 없다: ${t}`)
    const vs = mm[2].split(/[,\s]+/).filter(Boolean).map((x) => {
      const v = V_MAP[x]
      if (!v) throw new Error(`알 수 없는 판정 '${x}' (${mm[1]})`)
      return v
    })
    m.set(mm[1], vs)
  }
  return m
}
export function scoreBlind(key: Record<string, { arm: Arm }>, blindRows: Map<string, number>, verdicts: Map<string, Verdict[]>) {
  const per: Record<Arm, { words: number; badWords: number; wrongWords: number; meanings: number; badMeanings: number }> = {
    v3: { words: 0, badWords: 0, wrongWords: 0, meanings: 0, badMeanings: 0 },
    v4: { words: 0, badWords: 0, wrongWords: 0, meanings: 0, badMeanings: 0 },
  }
  const missing: string[] = []
  for (const id of Object.keys(key)) {
    const vs = verdicts.get(id)
    if (!vs) { missing.push(id); continue }
    const need = blindRows.get(id) ?? vs.length
    if (vs.length !== need) throw new Error(`${id}: 뜻 ${need}개인데 판정 ${vs.length}개`)
    const a = per[key[id].arm]
    a.words++
    a.meanings += vs.length
    const bad = vs.filter((v) => v !== 'ok').length
    a.badMeanings += bad
    if (bad > 0) a.badWords++
    if (vs.includes('wrong')) a.wrongWords++
  }
  const pct = (n: number, d: number) => round((n / Math.max(1, d)) * 100, 1)
  const v3Pct = pct(per.v3.badWords, per.v3.words)
  const v4Pct = pct(per.v4.badWords, per.v4.words)
  return {
    missing,
    v3: { ...per.v3, badWordPct: v3Pct, wrongWordPct: pct(per.v3.wrongWords, per.v3.words), badMeaningPct: pct(per.v3.badMeanings, per.v3.meanings) },
    v4: { ...per.v4, badWordPct: v4Pct, wrongWordPct: pct(per.v4.wrongWords, per.v4.words), badMeaningPct: pct(per.v4.badMeanings, per.v4.meanings) },
    gate_a: {
      rule: `v4 어색+틀림(단어 기준) ≤ v3 의 ${GATES.badRatioMaxOfV3} 배 이고 ≤ ${GATES.badAbsMaxPct}%`,
      v3Pct,
      v4Pct,
      halfOfV3Pct: round(v3Pct * GATES.badRatioMaxOfV3, 1),
      pass: v4Pct <= v3Pct * GATES.badRatioMaxOfV3 && v4Pct <= GATES.badAbsMaxPct,
    },
  }
}

// ── 진입 ─────────────────────────────────────────────────────────────────────────────────────
function printPlan(plan: Planned[]) {
  console.log(`계획 ${plan.length}회: ${plan.map((p) => p.callId).join(' ')}`)
}

function dryAll() {
  console.log(`## DRY — 라이브 호출 0회 (버전 ${TOPIC_WORDS_PROMPT_VERSION}, 하드 상한 ${HARD_CAP}, 이번 실행 상한 ${MAX_CALLS})`)
  for (const stage of ['pair', 'guard'] as const) {
    const plan = buildPlan(stage)
    console.log(`\n[${stage}]`)
    printPlan(plan)
    const sizes = plan.map((p) => requestFor(p)).map((x) => ({ sys: x.req.system.length, user: x.req.messages[0]?.content.length ?? 0 }))
    console.log(`  system ${[...new Set(sizes.map((s) => s.sys))].join('/')}자 · user ${Math.min(...sizes.map((s) => s.user))}~${Math.max(...sizes.map((s) => s.user))}자`)
  }
  const base = buildTopicWordsRequest({ topic: { title: 't', level: 'N3' }, targetCount: TARGET, exclude: [], variant: 0 }).system
  const s3 = systemForArm(base, 'v3')
  const s4 = systemForArm(base, 'v4')
  console.log(`\nsystem 길이: v3 ${s3.length}자 → v4 ${s4.length}자 (+${s4.length - s3.length}자, ${round(((s4.length - s3.length) / s3.length) * 100, 1)}%)`)
  const l3 = s3.split('\n')
  const l4 = s4.split('\n')
  const diff = l4.filter((l) => !l3.includes(l))
  console.log(`달라진 줄 ${diff.length}개:`)
  for (const l of diff) console.log(`  + ${l}`)
  console.log(`  - ${MEANING_LINE_V3}`)
  console.log(`두 arm 의 나머지 줄은 바이트 동일: ${l3.filter((l) => l !== MEANING_LINE_V3).join('\n') === l4.filter((l) => l !== MEANING_LINE_V4).join('\n')}`)
  console.log('\n예시 user 블록(P01):')
  console.log(requestFor(buildPlan('pair')[0]).req.messages[0]?.content)
}

async function main() {
  const mode = process.env.MODE
  if (mode === 'report') {
    const rows = readRows()
    const ledger = readLedger()
    const rep = computeReport(rows, ledger)
    mkdirSync(OUT_DIR, { recursive: true })
    atomicWrite(join(OUT_DIR, 'summary.json'), JSON.stringify(rep, null, 1))
    console.log(JSON.stringify(rep, null, 1))
    if (rep.pair.complete) {
      const blindPath = join(OUT_DIR, 'blind-words.md')
      const keyPath = join(OUT_DIR, 'key.json')
      if ((existsSync(blindPath) || existsSync(keyPath)) && process.env.FORCE !== '1') {
        console.log('\n눈가림 표·열쇠가 이미 있다 — 덮어쓰지 않는다(FORCE=1 로만).')
      } else {
        const b = buildBlind(rows)
        atomicWrite(blindPath, b.md)
        atomicWrite(keyPath, JSON.stringify(b.key, null, 1))
        console.log(`\n눈가림 표 ${b.count}단어 → ${blindPath} · 열쇠 → ${keyPath}`)
      }
    } else {
      console.log('\n짝 비교(pair) 20회가 아직 끝나지 않아 눈가림 표를 만들지 않았다.')
    }
    return
  }
  if (mode === 'score') {
    const verdictsPath = process.env.VERDICTS
    if (!verdictsPath) throw new Error('VERDICTS=<판정 파일> 이 필요하다')
    const key = JSON.parse(readFileSync(join(OUT_DIR, 'key.json'), 'utf8')) as Record<string, { arm: Arm }>
    const md = readFileSync(join(OUT_DIR, 'blind-words.md'), 'utf8')
    const counts = new Map<string, number>()
    for (const line of md.split('\n')) {
      const mm = /^\| (W\d{3}) \| .*? \| .*? \| (.*) \|$/.exec(line)
      if (mm) counts.set(mm[1], splitMeanings(mm[2].replace(/\\\|/g, '|')).length)
    }
    console.log(JSON.stringify(scoreBlind(key, counts, parseVerdicts(readFileSync(verdictsPath, 'utf8'))), null, 1))
    return
  }
  const stage = process.env.STAGE
  if (process.env.GO !== '1' || !stage) {
    dryAll()
    if (stage && process.env.GO !== '1') console.log('\n(GO=1 이 없어 라이브 호출 0회)')
    return
  }
  if (stage === 'pair' || stage === 'guard') {
    await runLive(buildPlan(stage))
    return
  }
  if (stage === 'reserve') {
    const reason = (process.env.RESERVE_REASON ?? '').trim()
    const ids = (process.env.RERUN ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!reason || ids.length === 0) throw new Error('reserve 는 RESERVE_REASON 과 RERUN(다시 부를 호출 id 목록)이 모두 있어야 돈다')
    const all = [...buildPlan('pair'), ...buildPlan('guard')]
    const ledger = readLedger()
    const plan: Planned[] = ids.map((id) => {
      const p = all.find((x) => x.callId === id)
      if (!p) throw new Error(`계획에 없는 호출 id: ${id}`)
      const n = ledger.filter((e) => e.callId === id || e.callId.startsWith(`${id}#r`)).length
      return { ...p, callId: `${id}#r${n}`, stage: 'reserve' as const }
    })
    await runLive(plan, reason)
    return
  }
  throw new Error(`STAGE 는 pair|guard|reserve 중 하나다: ${stage}`)
}

// import 만으로는 실행하지 않는다 — 직접 실행(`node … tests/prompts/topic-words-meaning-live.ts`)일 때만 main() 을 돈다.
if ((process.argv[1] ?? '').endsWith('topic-words-meaning-live.ts')) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e)
      releaseLock()
      process.exit(1)
    },
  )
}
