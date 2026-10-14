/**
 * task-068 D5 PE 실측 — `wordEnrich@v2`(선생님 초안)가 고르는 조각(chunkType) 정확도를 실제 Claude CLI(구독)로 **직렬** 잰다.
 * 합성 낱말만 쓴다(`tests/prompts/fixtures/word-enrich-chunk.json` — 학습자 데이터 없음). **DB 를 읽지도 쓰지도 않는다**
 * (`routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다). 서버·운영 접촉 없음 — 스크립트가 Claude CLI 를 직접 부른다.
 *
 * **호출 상한**: 누적 40회(재시도 포함)를 `BUDGET_FILE` 에 쌓아 넘기지 않는다. 한 낱말이 최악 2회(1차 위반 → 재시도)라 `남은 호출 < 2` 면 멈춘다.
 * 한도 신호(429·rate limit 등)가 보이면 즉시 멈춘다.
 *
 * 합격선(의뢰): 채점 25단어(동작성 명사 6 포함) 중 22개 이상 기대 조각과 일치. 보고: 전체·보류(지시문에 예로 안 적힌 22개)·유형별 일치율,
 * 틀린 낱말(고른 값·품사·뜻)과 1차 계약 위반 수(attempts 2), 지연 p50/p95. `info` 3건은 점수에 넣지 않고 고른 값만 본다.
 *
 * 실행(전용 미러): cd ~/.node-local/thekaiwa-pe068 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid TAG=r1 node --import tsx tests/prompts/word-enrich-chunk-live.ts
 * 환경: PE068_SCRATCH(결과·호출 장부 폴더, 기본 = OS 임시 폴더/thekaiwa-pe068 — 비우면 장부도 0으로 돌아가니 계속 쓰려면 BUDGET_FILE 을 따로 지정) · INVALID=1(무효 입력 2건 — valid=false·chunkType null 계약 확인, 기본 생략) · TAG(결과 파일 이름)=r1 · ONLY=c07,c09(이 id 들만) · REPEAT=3(선택한 행을 각각 3번 — 안정성 확인) · INFO=0(info 3건 생략, 기본 1) · MAX_CALLS=40 · BUDGET_FILE · OUT · GAP_MS=600 · TIMEOUT_MS=40000 · DUMP=1(OUT 만 읽어 요약 출력)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildWordEnrichRequest, WORD_ENRICH_PROMPT_VERSION, type WordEnrichResponseV2 } from '../../src/modules/conversation/prompts/wordEnrich'

interface Item { id: string; surface: string; level: string; expected: string; group: string; seedChunk: string | null; inPrompt?: boolean; note?: string }
interface Info { id: string; surface: string; level: string; acceptable: string[]; note?: string }
interface Invalid { id: string; surface: string; level: string | null; note?: string }
interface Fx { passLine: { total: number; min: number }; items: Item[]; info: Info[]; invalid: Invalid[] }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/word-enrich-chunk.json'), 'utf8')) as Fx

const TAG = process.env.TAG ?? 'r1'
const SCRATCH = process.env.PE068_SCRATCH ?? join(tmpdir(), 'thekaiwa-pe068')
const OUT = process.env.OUT ?? join(SCRATCH, `pe068-chunk-live-${TAG}.json`)
const BUDGET_FILE = process.env.BUDGET_FILE ?? join(SCRATCH, 'pe068-live-budget.json')
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 40)
const GAP_MS = Number(process.env.GAP_MS ?? 600)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 40_000)
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const WITH_INFO = process.env.INFO !== '0'
const REPEAT = Math.max(1, Number(process.env.REPEAT ?? 1))
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const ENGINE_LEAK = /claude|haiku|sonnet|opus|qwen|anthropic|home-m4/i

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

// 엔진의 `[json] 1차 응답 계약 위반 → 재시도: …` 경고(고정 문장·경로뿐)를 호출마다 모은다 — 1차 위반 원인 확인용.
let warnBuf: string[] = []
const origWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  const line = args.map(String).join(' ')
  if (line.startsWith('[json]')) warnBuf.push(line.slice(0, 300))
  else origWarn(...args)
}

interface Row {
  id: string
  surface: string
  scored: boolean
  kind: 'scored' | 'info' | 'invalid'
  group: string
  inPrompt: boolean
  expected: string | null
  acceptable?: string[]
  ok: boolean
  chunkType?: string | null
  match?: boolean
  partOfSpeech?: string | null
  meaning?: string | null
  valid?: boolean
  attempts?: 1 | 2
  callsUsed: number
  ms: number
  model?: string
  promptChars?: number
  engineLeak?: boolean
  warns?: string[]
  errorName?: string
  error?: string
}
interface Saved { startedAt: string; version: string; tag: string; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const readBudget = (): number => (existsSync(BUDGET_FILE) ? (JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as { used: number }).used : 0)
const writeBudget = (used: number, note: string): void => {
  mkdirSync(dirname(BUDGET_FILE), { recursive: true })
  const prev = existsSync(BUDGET_FILE) ? (JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as { log?: string[] }).log ?? [] : []
  writeFileSync(BUDGET_FILE, JSON.stringify({ used, max: MAX_CALLS, log: [...prev, `${new Date().toISOString()} ${note}`] }, null, 1))
}

async function callOne(target: { id: string; surface: string; level: string | null }): Promise<Pick<Row, 'ok' | 'chunkType' | 'partOfSpeech' | 'meaning' | 'valid' | 'attempts' | 'callsUsed' | 'ms' | 'model' | 'promptChars' | 'engineLeak' | 'warns' | 'errorName' | 'error'>> {
  const req = buildWordEnrichRequest({ surface: target.surface, level: target.level })
  warnBuf = []
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<WordEnrichResponseV2>({ ...req, timeoutMs: TIMEOUT_MS })
    const d = r.data
    const hay = [d.meaning, d.example, d.exampleKo, d.invalidReason].filter((x): x is string => Boolean(x))
    return {
      ok: true, chunkType: d.chunkType, partOfSpeech: d.partOfSpeech, meaning: d.meaning, valid: d.valid, attempts: r.attempts,
      callsUsed: r.attempts ?? 1, ms: Date.now() - t0, model: r.model, promptChars: r.promptChars,
      engineLeak: hay.some((s) => ENGINE_LEAK.test(s)), warns: warnBuf.length ? [...warnBuf] : undefined,
    }
  } catch (e) {
    const err = e as Error
    return { ok: false, callsUsed: 2, ms: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 300), warns: warnBuf.length ? [...warnBuf] : undefined }
  }
}

function summarize(rows: Row[]): void {
  const scored = rows.filter((r) => r.scored)
  const okRows = rows.filter((r) => r.ok)
  const callsUsed = rows.reduce((n, r) => n + r.callsUsed, 0)
  console.log(`\n## 요약 [${TAG}] ${WORD_ENRICH_PROMPT_VERSION} — 이번 실행 호출 ${callsUsed}회(누적 ${readBudget()}/${MAX_CALLS}) · 행 ${rows.length}(채점 ${scored.length})`)
  const hit = scored.filter((r) => r.match)
  console.log(`일치 ${hit.length}/${scored.length} (합격선 ${fx.passLine.min}/${fx.passLine.total}, 채점 행이 ${fx.passLine.total}개보다 적으면 부분 실행)`)
  const held = scored.filter((r) => !r.inPrompt)
  console.log(`보류(지시문 예 제외) 일치 ${held.filter((r) => r.match).length}/${held.length}`)
  const groups = [...new Set(scored.map((r) => r.group))]
  for (const g of groups) {
    const rs = scored.filter((r) => r.group === g)
    console.log(`  - ${g}: ${rs.filter((r) => r.match).length}/${rs.length}`)
  }
  const miss = scored.filter((r) => !r.match)
  if (miss.length) {
    console.log('틀림/실패:')
    for (const r of miss) console.log(`  · ${r.id} ${r.surface} 기대 ${r.expected} → 고른 값 ${r.chunkType ?? '(실패)'} (품사 ${r.partOfSpeech ?? '-'} · 뜻 ${r.meaning ?? '-'})${r.ok ? '' : ` [${r.errorName}: ${r.error}]`}`)
  }
  const invalid = rows.filter((r) => r.kind === 'invalid')
  if (invalid.length) {
    console.log('무효 입력(valid=false, chunkType null 계약):')
    for (const r of invalid) console.log(`  · ${r.id} ${r.surface} → valid=${r.valid} chunkType=${r.chunkType} ${r.ok && r.valid === false && r.chunkType === null ? 'OK' : 'NG'}`)
  }
  const info = rows.filter((r) => r.kind === 'info')
  if (info.length) {
    console.log('info(점수 제외):')
    for (const r of info) console.log(`  · ${r.id} ${r.surface} → ${r.chunkType ?? '(실패)'} (허용 ${r.acceptable?.join('/')}) ${r.chunkType && r.acceptable?.includes(r.chunkType) ? '허용 안' : '허용 밖'}`)
  }
  const ms = okRows.map((r) => r.ms)
  console.log(`1차 계약 위반(attempts 2) ${okRows.filter((r) => r.attempts === 2).length}/${okRows.length} · 최종 실패 ${rows.length - okRows.length} · 지연 p50 ${pct(ms, 50)}ms p95 ${pct(ms, 95)}ms max ${Math.max(0, ...ms)}ms · 엔진명 누출 ${okRows.filter((r) => r.engineLeak).length}`)
  const nonNull = okRows.filter((r) => r.valid && !r.chunkType)
  console.log(`valid 인데 chunkType 없음 ${nonNull.length} · promptChars ${okRows[0]?.promptChars ?? '-'}`)
}

async function main(): Promise<void> {
  if (process.env.DUMP === '1') {
    summarize((JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows)
    return
  }
  const targets: Array<{ kind: 'scored' | 'info' | 'invalid'; item: Item | Info | Invalid }> = [
    ...fx.items.map((item) => ({ kind: 'scored' as const, item })),
    ...(WITH_INFO ? fx.info.map((item) => ({ kind: 'info' as const, item })) : []),
    ...(process.env.INVALID === '1' ? fx.invalid.map((item) => ({ kind: 'invalid' as const, item })) : []),
  ]
    .filter((t) => ONLY.length === 0 || ONLY.includes(t.item.id))
    .flatMap((t) => Array.from({ length: REPEAT }, () => t))
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  let consecutiveFail = 0
  console.log(`word-enrich chunk 실측 [${TAG}] ${WORD_ENRICH_PROMPT_VERSION} — 대상 ${targets.length}행, 누적 호출 ${readBudget()}/${MAX_CALLS}`)
  for (const t of targets) {
    const used = readBudget()
    if (used + 2 > MAX_CALLS) {
      console.log(`호출 상한 근접(누적 ${used}/${MAX_CALLS}, 최악 2회가 필요) — 여기서 멈춘다. 남은 행: ${targets.slice(rows.length).map((x) => x.item.id).join(',')}`)
      break
    }
    const it = t.item
    const res = await callOne(it)
    writeBudget(used + res.callsUsed, `${TAG} ${it.id} ${it.surface} +${res.callsUsed}`)
    const scored = t.kind === 'scored'
    const row: Row = {
      id: it.id, surface: it.surface, scored, kind: t.kind,
      group: scored ? (it as Item).group : t.kind === 'invalid' ? 'INVALID' : 'INFO',
      inPrompt: scored ? Boolean((it as Item).inPrompt) : false,
      expected: scored ? (it as Item).expected : null,
      acceptable: t.kind === 'info' ? (it as Info).acceptable : undefined,
      ...res,
      match: scored ? res.ok && res.chunkType === (it as Item).expected : undefined,
    }
    rows.push(row)
    console.log(JSON.stringify({ id: row.id, surface: row.surface, expected: row.expected, got: row.chunkType, match: row.match, pos: row.partOfSpeech, attempts: row.attempts, ms: row.ms, err: row.errorName }))
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ startedAt, version: WORD_ENRICH_PROMPT_VERSION, tag: TAG, rows } satisfies Saved, null, 1))
    if (!res.ok && LIMIT_RE.test(res.error ?? '')) {
      console.log('한도 신호 감지 — 즉시 멈춘다')
      break
    }
    consecutiveFail = res.ok ? 0 : consecutiveFail + 1
    if (consecutiveFail >= 2) {
      console.log('연속 2건 실패 — 환경 문제로 보고 멈춘다(호출 낭비 방지)')
      break
    }
    await sleep(GAP_MS)
  }
  summarize(rows)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
