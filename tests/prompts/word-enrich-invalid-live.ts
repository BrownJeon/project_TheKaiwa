/**
 * task-073 W-3 PE 실측 — 뜻 채우기(`wordEnrich`)의 valid=false 이유 문장(단정 완화)과 valid=true 경로 불변을 실제 Claude CLI(구독)로 **직렬** 잰다.
 * 같은 하네스를 변경 전(v2)·후(v3)에 돌려 표로 대조한다(TAG 로 결과 파일 구분). 입력은 `fixtures/word-enrich-invalid.json`(공개 단어·합성 문자열).
 * **DB 를 읽지도 쓰지도 않는다**(`routerDeps.loadChain` 을 시드 모양 고정 연결로 교체 — task-068 `word-enrich-chunk-live.ts` 와 같은 방식). 서버·운영 포트 접촉 없음.
 *
 * 호출 상한: 누적 `MAX_CALLS`(기본 200, 재시도 포함)를 `BUDGET_FILE` 에 쌓아 넘기지 않는다. 한도 신호(429·rate limit 등)가 보이면 즉시 멈춘다.
 *
 * 실행(전용 미러): cd ~/.node-local/thekaiwa-dev073-pe && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid TAG=v2base REPEAT=2 node --import tsx tests/prompts/word-enrich-invalid-live.ts
 * 환경: TAG(결과 파일 이름) · REPEAT(입력당 호출 수, 기본 2) · GROUP=invalid|valid|borderline|all(기본 all = invalid+valid, borderline 은 GROUP=borderline 으로만) · ONLY=i01,v02 · MAX_CALLS · SCRATCH(결과·장부 폴더)
 *       · BUDGET_FILE · OUT · GAP_MS=500 · TIMEOUT_MS=40000 · DUMP=1(OUT 만 읽어 요약 출력)
 * CLI 경로는 서버 env `CLAUDE_CLI_PATH` 하나만 쓴다(값은 출력하지 않는다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildWordEnrichRequest, WORD_ENRICH_PROMPT_VERSION, type WordEnrichResponseV2 } from '../../src/modules/conversation/prompts/wordEnrich'
import { analyzeReason, reasonProblems } from './wordEnrichInvalidCheck'

interface InvalidItem { id: string; surface: string; kind: string; note?: string }
interface ValidItem { id: string; surface: string; expectedChunkType?: string; note?: string }
interface Fx { level: string; invalid: InvalidItem[]; valid: ValidItem[]; borderline: ValidItem[] }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/word-enrich-invalid.json'), 'utf8')) as Fx

const TAG = process.env.TAG ?? 'run'
const SCRATCH = process.env.SCRATCH ?? join(tmpdir(), 'thekaiwa-pe073')
const OUT = process.env.OUT ?? join(SCRATCH, `pe073-invalid-live-${TAG}.json`)
const BUDGET_FILE = process.env.BUDGET_FILE ?? join(SCRATCH, 'pe073-live-budget.json')
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 200)
const GAP_MS = Number(process.env.GAP_MS ?? 500)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 40_000)
const REPEAT = Math.max(1, Number(process.env.REPEAT ?? 2))
const GROUP = process.env.GROUP ?? 'all'
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
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
  group: 'invalid' | 'valid' | 'borderline'
  ok: boolean
  valid?: boolean
  invalidReason?: string | null
  reading?: string | null
  meaning?: string | null
  partOfSpeech?: string | null
  chunkType?: string | null
  jlpt?: string | null
  filled?: boolean
  expectedChunkType?: string
  attempts?: 1 | 2
  callsUsed: number
  ms: number
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

async function callOne(surface: string): Promise<Omit<Row, 'id' | 'surface' | 'group' | 'expectedChunkType'>> {
  const req = buildWordEnrichRequest({ surface, level: fx.level })
  warnBuf = []
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<WordEnrichResponseV2>({ ...req, timeoutMs: TIMEOUT_MS })
    const d = r.data
    const hay = [d.meaning, d.example, d.exampleKo, d.invalidReason].filter((x): x is string => Boolean(x))
    return {
      ok: true, valid: d.valid, invalidReason: d.invalidReason, reading: d.reading, meaning: d.meaning, partOfSpeech: d.partOfSpeech, chunkType: d.chunkType, jlpt: d.jlpt,
      filled: Boolean(d.reading && d.meaning && d.partOfSpeech && d.chunkType && d.example && d.exampleKo),
      attempts: r.attempts, callsUsed: r.attempts ?? 1, ms: Date.now() - t0, promptChars: r.promptChars,
      engineLeak: hay.some((s) => ENGINE_LEAK.test(s)), warns: warnBuf.length ? [...warnBuf] : undefined,
    }
  } catch (e) {
    const err = e as Error
    return { ok: false, callsUsed: 2, ms: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 300), warns: warnBuf.length ? [...warnBuf] : undefined }
  }
}

function summarize(rows: Row[]): void {
  const callsUsed = rows.reduce((n, r) => n + r.callsUsed, 0)
  console.log(`\n## 요약 [${TAG}] ${WORD_ENRICH_PROMPT_VERSION} — 이번 실행 호출 ${callsUsed}회(누적 ${readBudget()}/${MAX_CALLS}) · 행 ${rows.length}`)
  const inv = rows.filter((r) => r.group === 'invalid')
  if (inv.length) {
    console.log('\n### invalid 입력')
    let assertive = 0, multi = 0, nonKo = 0, validTrue = 0, probs = 0
    for (const it of fx.invalid) {
      const rs = inv.filter((r) => r.id === it.id)
      if (!rs.length) continue
      const parts = rs.map((r) => {
        if (!r.ok) return `FAIL(${r.errorName})`
        if (r.valid) return `valid=TRUE ${r.meaning ?? ''}`
        const a = analyzeReason(it.surface, r.invalidReason)
        const p = reasonProblems(it.surface, r.invalidReason)
        return `「${r.invalidReason}」 ${p.length ? '✗' + p.join('/') : '✓'}${a.latinGuess.length ? ' latin:' + a.latinGuess.join(',') : ''}${a.candidateQuestions ? ' 후보질문' : ''}`
      })
      console.log(`- ${it.id} ${it.surface}: valid=false ${rs.filter((r) => r.ok && r.valid === false).length}/${rs.length}`)
      for (const p of parts) console.log(`    ${p}`)
    }
    for (const r of inv) {
      if (!r.ok) continue
      if (r.valid) { validTrue++; continue }
      const a = analyzeReason(r.surface, r.invalidReason)
      if (a.assertive.length) assertive++
      if (a.sentences > 1) multi++
      if (!a.hasHangul) nonKo++
      if (reasonProblems(r.surface, r.invalidReason).length) probs++
    }
    const judged = inv.filter((r) => r.ok && !r.valid).length
    console.log(`invalid 요약: 호출 ${inv.length} · valid=false ${judged} · valid=true(판정 불일치) ${validTrue} · 단정 표현 ${assertive} · 2문장↑ ${multi} · 비한국어 ${nonKo} · 문제 있는 이유 합계 ${probs} · 실패 ${inv.filter((r) => !r.ok).length}`)
  }
  const val = rows.filter((r) => r.group !== 'invalid')
  if (val.length) {
    console.log('\n### valid 입력(valid·borderline)')
    for (const it of [...fx.valid, ...fx.borderline]) {
      const rs = val.filter((r) => r.id === it.id)
      if (!rs.length) continue
      const ok = rs.filter((r) => r.ok)
      console.log(`- ${it.id} ${it.surface}: valid=true ${ok.filter((r) => r.valid).length}/${rs.length} · 필드 채움 ${ok.filter((r) => r.valid && r.filled).length}/${rs.length} · chunkType ${ok.map((r) => r.chunkType ?? '-').join('/')} (기대 ${it.expectedChunkType ?? '-'}) · 품사 ${ok.map((r) => r.partOfSpeech ?? '-').join('/')} · 읽기 ${ok.map((r) => r.reading ?? '-').join('/')} · jlpt ${ok.map((r) => r.jlpt ?? '-').join('/')} · 재시도 ${rs.filter((r) => r.attempts === 2).length} · 실패 ${rs.filter((r) => !r.ok).length}`)
    }
    const okRows = val.filter((r) => r.ok)
    const pass = okRows.filter((r) => r.valid)
    console.log(`valid 요약: 호출 ${val.length} · valid=true ${pass.length}/${val.length} (${((pass.length / val.length) * 100).toFixed(0)}%) · 필드 채움 ${pass.filter((r) => r.filled).length}/${val.length} · chunkType 기대 일치 ${pass.filter((r) => r.chunkType === r.expectedChunkType).length}/${val.length} · 재시도(1차 계약 위반) ${okRows.filter((r) => r.attempts === 2).length} · 최종 실패 ${val.length - okRows.length}`)
  }
  const okAll = rows.filter((r) => r.ok)
  const ms = okAll.map((r) => r.ms)
  console.log(`\n전체: 1차 계약 위반(attempts 2) ${okAll.filter((r) => r.attempts === 2).length}/${okAll.length} · 최종 실패 ${rows.length - okAll.length} · 지연 p50 ${pct(ms, 50)}ms p95 ${pct(ms, 95)}ms max ${Math.max(0, ...ms)}ms · 엔진명 누출 ${okAll.filter((r) => r.engineLeak).length} · promptChars ${okAll[0]?.promptChars ?? '-'}`)
}

async function main(): Promise<void> {
  if (process.env.DUMP === '1') {
    summarize((JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows)
    return
  }
  const targets: Array<{ group: 'invalid' | 'valid' | 'borderline'; item: InvalidItem | ValidItem }> = [
    ...(GROUP === 'invalid' || GROUP === 'all' ? fx.invalid.map((item) => ({ group: 'invalid' as const, item })) : []),
    ...(GROUP === 'valid' || GROUP === 'all' ? fx.valid.map((item) => ({ group: 'valid' as const, item })) : []),
    ...(GROUP === 'borderline' ? fx.borderline.map((item) => ({ group: 'borderline' as const, item })) : []),
  ]
    .filter((t) => ONLY.length === 0 || ONLY.includes(t.item.id))
  // 같은 입력이 몰리지 않게 라운드 로빈(1회차 전체 → 2회차 전체).
  const order = Array.from({ length: REPEAT }, () => targets).flat()
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  let consecutiveFail = 0
  console.log(`word-enrich invalid/valid 실측 [${TAG}] ${WORD_ENRICH_PROMPT_VERSION} — 대상 ${order.length}행, 누적 호출 ${readBudget()}/${MAX_CALLS}`)
  for (const t of order) {
    const used = readBudget()
    if (used + 2 > MAX_CALLS) {
      console.log(`호출 상한 근접(누적 ${used}/${MAX_CALLS}, 최악 2회가 필요) — 여기서 멈춘다. 남은 행 ${order.length - rows.length}`)
      break
    }
    const res = await callOne(t.item.surface)
    writeBudget(used + res.callsUsed, `${TAG} ${t.item.id} ${t.item.surface} +${res.callsUsed}`)
    const row: Row = { id: t.item.id, surface: t.item.surface, group: t.group, expectedChunkType: t.group !== 'invalid' ? (t.item as ValidItem).expectedChunkType : undefined, ...res }
    rows.push(row)
    console.log(JSON.stringify({ id: row.id, surface: row.surface, valid: row.valid, reason: row.invalidReason, chunk: row.chunkType, pos: row.partOfSpeech, attempts: row.attempts, ms: row.ms, err: row.errorName }))
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ startedAt, version: WORD_ENRICH_PROMPT_VERSION, tag: TAG, rows } satisfies Saved, null, 1))
    if (!res.ok && LIMIT_RE.test(res.error ?? '')) {
      console.log('한도 신호 감지 — 즉시 멈춘다')
      break
    }
    consecutiveFail = res.ok ? 0 : consecutiveFail + 1
    if (consecutiveFail >= 3) {
      console.log('연속 3건 실패 — 환경 문제로 보고 멈춘다(호출 낭비 방지)')
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
