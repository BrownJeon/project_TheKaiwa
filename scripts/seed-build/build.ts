/**
 * JLPT 시드 생성 러너(task-051) — OpenJLPT 원본(raw/n?.json)에 한국어 뜻·품사·조각 유형·예문을 Claude CLI 로 채워
 * `prisma/seed-data/jlpt/<level>.json` 과 `src/types/seedPackCounts.ts` 를 쓴다. 재현 절차는 같은 폴더 README.md.
 *
 * 앱의 `engine/adapters/llm/claudeCli` 를 쓰지 않는 이유: 그 어댑터는 앱 설정(infra/config·.env)과 큐·trace 를 끌고 오고
 * 토큰 계측(`--output-format json`)을 내지 않는다. 플래그는 `buildClaudeArgs` 와 같게 맞춘다(argv 배열, 도구·MCP·설정 없음, dontAsk).
 * 외부로 나가는 것은 공개 사전 표제어·읽기·영어 뜻·품사태그뿐이다. 로그·체크포인트에는 프롬프트·키·토큰 값을 남기지 않는다.
 *
 *   node --import tsx scripts/seed-build/build.ts run --repo <저장소 루트> [--levels N5,N4] [--work DIR] [--raw DIR] [--conc 3]
 *   node --import tsx scripts/seed-build/build.ts counts --repo <저장소 루트>
 *   node --import tsx scripts/seed-build/build.ts sample --repo <저장소 루트> [--work DIR] [--raw DIR]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  LEVELS, SYSTEM_PROMPT, VOCAB_ENRICH_PROMPT_VERSION, buildUserPrompt, checkRow, mulberry32, parseRows, posHints, serializeRecords, toSeedRecord,
  type EnrichedRow, type SeedRecord, type VocabLevel, type VocabSource,
} from './enrich'
import { validateLevels } from './validate'

/** Leader 결정(task-051 「PE 측정 결과 처리」): N5·N4 = haiku 배치 40, N3~N1 = sonnet 배치 20. */
const LEVEL_PLAN: Record<VocabLevel, { model: 'haiku' | 'sonnet'; batch: number }> = {
  N5: { model: 'haiku', batch: 40 }, N4: { model: 'haiku', batch: 40 },
  N3: { model: 'sonnet', batch: 20 }, N2: { model: 'sonnet', batch: 20 }, N1: { model: 'sonnet', batch: 20 },
}
const MAX_CONC = 3
const CALL_TIMEOUT_MS = 240_000
const CALL_ATTEMPTS = 3 // 호출 전체 실패(파싱·행 수·타임아웃·종료 코드) 시 같은 배치 재시도 횟수
const LIMIT_BACKOFF_MS = [30_000, 60_000, 120_000] // 429·한도 오류: 이 3번 안에 풀리지 않으면 전체 중단
const ROW_PASSES = 2 // 행 단위: 첫 시도 + retry/null 행 1회 재시도

interface Args { cmd: string; repo: string; work: string; raw: string; levels: VocabLevel[]; conc: number }
function parseArgs(argv: string[]): Args {
  const [cmd = '', ...rest] = argv
  const get = (k: string) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined }
  const repo = get('repo')
  if (!repo) throw new Error('--repo <저장소 루트> 가 필요합니다(미러가 아니라 NFS 원본 경로)')
  const seedwork = join(homedir(), '.node-local', 'thekaiwa-seedwork')
  const levels = (get('levels') ?? LEVELS.join(',')).split(',').map((s) => s.trim().toUpperCase())
  for (const l of levels) if (!(LEVELS as readonly string[]).includes(l)) throw new Error(`알 수 없는 단계: ${l}`)
  const conc = Math.min(MAX_CONC, Math.max(1, Number(get('conc') ?? MAX_CONC)))
  return { cmd, repo: resolve(repo), work: resolve(get('work') ?? join(seedwork, 'build')), raw: resolve(get('raw') ?? join(seedwork, 'raw')), levels: levels as VocabLevel[], conc }
}

interface RawItem { word: string; reading: string; pos?: string[]; meanings?: string[] }
export function loadSources(rawDir: string, level: VocabLevel): VocabSource[] {
  const all = JSON.parse(readFileSync(join(rawDir, `${level.toLowerCase()}.json`), 'utf8')) as RawItem[]
  return all.map((r) => ({ word: r.word, reading: r.reading, pos: r.pos ?? [], meanings: r.meanings ?? [] }))
}

type ItemState =
  | { status: 'pending'; attempts: number; codes?: string[]; lastRaw?: unknown }
  | { status: 'ok'; attempts: number; row: EnrichedRow; soft: string[] }
  | { status: 'rejected'; attempts: number; codes: string[]; lastRaw?: unknown }
interface LevelState { promptVersion: string; model: string; batch: number; total: number; items: ItemState[] }

function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, path)
}

function loadState(dir: string, level: VocabLevel, total: number): LevelState {
  const p = join(dir, 'state.json')
  const plan = LEVEL_PLAN[level]
  if (existsSync(p)) {
    const s = JSON.parse(readFileSync(p, 'utf8')) as LevelState
    if (s.total !== total || s.promptVersion !== VOCAB_ENRICH_PROMPT_VERSION || s.model !== plan.model) {
      throw new Error(`${level}: 체크포인트가 지금 입력·프롬프트·모델과 다릅니다(${p}). 지우고 다시 시작하세요.`)
    }
    return s
  }
  return { promptVersion: VOCAB_ENRICH_PROMPT_VERSION, model: plan.model, batch: plan.batch, total, items: Array.from({ length: total }, () => ({ status: 'pending', attempts: 0 })) }
}

const ENV_KEYS = ['HOME', 'PATH', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL']
/** 허용 목록 env 만 넘긴다(키·토큰 env 가 CLI 로 새지 않게). 앱 타입이 ProcessEnv 에 NODE_ENV 를 필수로 넣어 단언한다. */
function childEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string> = { MAX_THINKING_TOKENS: '0' }
  for (const k of ENV_KEYS) { const v = process.env[k]; if (v) env[k] = v }
  return env as NodeJS.ProcessEnv
}

function claudeArgs(model: string): string[] {
  return [
    '--print', '--output-format', 'json',
    '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence',
    '--settings', '{"alwaysThinkingEnabled":false}',
    '--system-prompt', SYSTEM_PROMPT,
    '--permission-mode', 'dontAsk', '--model', model, '--tools', '',
  ]
}

interface CallResult { ok: boolean; rows?: unknown[]; limit: boolean; error?: string; wallMs: number; outTok: number; inTok: number; costUsd: number }
const LIMIT_RE = /usage limit|rate.?limit|\b429\b|overloaded|\b529\b|quota|too many requests/i

function callClaude(model: string, prompt: string, cwd: string): Promise<CallResult> {
  return new Promise((done) => {
    const t0 = Date.now()
    const child = spawn('claude', claudeArgs(model), { env: childEnv(), cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, CALL_TIMEOUT_MS)
    child.stdout.on('data', (d: Buffer) => { out += d.toString() })
    child.stderr.on('data', (d: Buffer) => { err += d.toString() })
    child.on('error', (e) => { clearTimeout(timer); done({ ok: false, limit: false, error: `spawn: ${e.message}`, wallMs: Date.now() - t0, outTok: 0, inTok: 0, costUsd: 0 }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const wallMs = Date.now() - t0
      if (timedOut) return done({ ok: false, limit: false, error: 'timeout', wallMs, outTok: 0, inTok: 0, costUsd: 0 })
      let j: Record<string, unknown> | null = null
      try { j = JSON.parse(out) as Record<string, unknown> } catch { /* 아래에서 판정 */ }
      const usage = (j?.usage ?? {}) as Record<string, number>
      const meter = {
        outTok: Number(usage.output_tokens ?? 0),
        inTok: Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0) + Number(usage.cache_creation_input_tokens ?? 0),
        costUsd: Number(j?.total_cost_usd ?? 0),
      }
      const text = typeof j?.result === 'string' ? j.result : ''
      if (code !== 0 || !j || j.is_error === true) {
        const msg = `${text} ${err}`.slice(0, 300)
        return done({ ok: false, limit: LIMIT_RE.test(msg), error: `exit=${code} ${msg.replace(/\s+/g, ' ').slice(0, 160)}`, wallMs, ...meter })
      }
      const rows = parseRows(text)
      if (!rows) return done({ ok: false, limit: false, error: 'parse', wallMs, ...meter })
      done({ ok: true, rows, limit: false, wallMs, ...meter })
    })
    child.stdin.end(prompt)
  })
}

class Halt extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runLevel(args: Args, level: VocabLevel): Promise<'done' | 'incomplete'> {
  const plan = LEVEL_PLAN[level]
  const src = loadSources(args.raw, level)
  const dir = join(args.work, level)
  mkdirSync(dir, { recursive: true })
  const cwd = join(args.work, 'cwd')
  mkdirSync(cwd, { recursive: true })
  const state = loadState(dir, level, src.length)
  const save = () => writeAtomic(join(dir, 'state.json'), JSON.stringify(state))
  const callLog = join(dir, 'calls.jsonl')
  let halted: string | null = null

  for (let pass = 1; pass <= ROW_PASSES && !halted; pass++) {
    const pending = state.items.map((s, i) => ({ s, i })).filter(({ s }) => s.status === 'pending' && s.attempts < pass).map(({ i }) => i)
    if (!pending.length) continue
    const batches: number[][] = []
    for (let i = 0; i < pending.length; i += plan.batch) batches.push(pending.slice(i, i + plan.batch))
    console.log(`[${level}] pass${pass} ${pending.length}개 · 배치 ${batches.length} · ${plan.model} · 동시 ${args.conc}`)
    let next = 0
    let doneBatches = 0
    const worker = async () => {
      while (!halted && next < batches.length) {
        const idx = batches[next++]!
        const entries = idx.map((i) => src[i]!)
        const prompt = buildUserPrompt(level, entries)
        let res: CallResult | null = null
        let limitHits = 0
        for (let attempt = 0; attempt < CALL_ATTEMPTS + limitHits && !halted; attempt++) {
          res = await callClaude(plan.model, prompt, cwd)
          appendFileSync(callLog, `${JSON.stringify({ t: new Date().toISOString(), pass, first: idx[0], n: idx.length, attempt, ok: res.ok && res.rows?.length === idx.length, error: res.error, rows: res.rows?.length, wallMs: res.wallMs, outTok: res.outTok, inTok: res.inTok, costUsd: res.costUsd })}\n`)
          if (res.ok && res.rows?.length === idx.length) break
          if (res.limit) {
            if (limitHits >= LIMIT_BACKOFF_MS.length) { halted = `한도 오류가 백오프 ${LIMIT_BACKOFF_MS.length}회 뒤에도 계속됨: ${res.error}`; break }
            console.log(`[${level}] 한도 오류 — ${LIMIT_BACKOFF_MS[limitHits]! / 1000}s 대기 (${limitHits + 1}/${LIMIT_BACKOFF_MS.length})`)
            await sleep(LIMIT_BACKOFF_MS[limitHits]!)
            limitHits++
          }
          res = res.ok ? { ...res, ok: false, error: `rows ${res.rows?.length}≠${idx.length}` } : res
        }
        doneBatches++
        if (!res?.ok || res.rows?.length !== idx.length) {
          console.log(`[${level}] pass${pass} 배치 ${doneBatches}/${batches.length} 호출 실패(${res?.error ?? 'halt'}) — 다음 실행에서 이어서`)
          continue
        }
        const tally = { ok: 0, retry: 0, null: 0 }
        idx.forEach((itemIdx, k) => {
          const prev = state.items[itemIdx]!
          const v = checkRow(res!.rows![k], src[itemIdx]!)
          const attempts = prev.attempts + 1
          tally[v.status]++
          if (v.status === 'ok') state.items[itemIdx] = { status: 'ok', attempts, row: v.row, soft: v.soft }
          else if (attempts >= ROW_PASSES) state.items[itemIdx] = { status: 'rejected', attempts, codes: v.hard, lastRaw: res!.rows![k] }
          else state.items[itemIdx] = { status: 'pending', attempts, codes: v.hard, lastRaw: res!.rows![k] }
        })
        save()
        console.log(`[${level}] pass${pass} 배치 ${doneBatches}/${batches.length} ok=${tally.ok} retry=${tally.retry} null=${tally.null} wall=${(res.wallMs / 1000).toFixed(1)}s out=${res.outTok}tok`)
      }
    }
    await Promise.all(Array.from({ length: args.conc }, worker))
    save()
  }
  writeProgress(args)
  if (halted) throw new Halt(`[${level}] 중단: ${halted}`)
  if (state.items.some((s) => s.status === 'pending')) return 'incomplete'
  finalizeLevel(args, level, src, state)
  return 'done'
}

function finalizeLevel(args: Args, level: VocabLevel, src: VocabSource[], state: LevelState): void {
  const records: SeedRecord[] = []
  const rejected: unknown[] = []
  state.items.forEach((s, i) => {
    if (s.status === 'ok') records.push(toSeedRecord(src[i]!, s.row))
    else if (s.status === 'rejected') rejected.push({ index: i, word: src[i]!.word, reading: src[i]!.reading, pos: src[i]!.pos, meanings: src[i]!.meanings.slice(0, 3), codes: s.codes, lastRaw: s.lastRaw })
  })
  const outDir = join(args.repo, 'prisma', 'seed-data', 'jlpt')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${level.toLowerCase()}.json`)
  const prevPath = `${outPath}.next`
  writeFileSync(prevPath, serializeRecords(records))
  // 검증을 통과해야 정식 파일 이름으로 바꾼다(실패하면 .next 를 남기고 멈춤).
  const report = validateLevels({ repo: args.repo, raw: args.raw, levels: [level], fileOverride: { [level]: prevPath }, checkCounts: false })
  if (report.hardTotal > 0) {
    console.log(report.text)
    throw new Halt(`[${level}] 검증 실패 — ${prevPath} 를 확인하세요`)
  }
  renameSync(prevPath, outPath)
  writeAtomic(join(args.work, '..', `rejected-${level.toLowerCase()}.json`), `${JSON.stringify(rejected, null, 1)}\n`)
  writeCounts(args)
  const calls = readCalls(join(args.work, level, 'calls.jsonl'))
  const summary = { level, model: LEVEL_PLAN[level].model, batch: LEVEL_PLAN[level].batch, source: src.length, records: records.length, rejected: rejected.length, ...calls }
  writeAtomic(join(args.work, level, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`)
  console.log(`[${level}] 완료 — 시드 ${records.length}/${src.length} · 거절 ${rejected.length} · 호출 ${calls.calls} · 출력 ${calls.outTok}tok · 입력 ${calls.inTok}tok · 호출 벽시계 합 ${(calls.wallMs / 1000).toFixed(0)}s · API 환산 $${calls.costUsd.toFixed(2)}`)
}

function readCalls(path: string): { calls: number; failedCalls: number; outTok: number; inTok: number; wallMs: number; costUsd: number } {
  const acc = { calls: 0, failedCalls: 0, outTok: 0, inTok: 0, wallMs: 0, costUsd: 0 }
  if (!existsSync(path)) return acc
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const c = JSON.parse(line) as { ok: boolean; outTok?: number; inTok?: number; wallMs?: number; costUsd?: number }
    acc.calls++
    if (!c.ok) acc.failedCalls++
    acc.outTok += c.outTok ?? 0
    acc.inTok += c.inTok ?? 0
    acc.wallMs += c.wallMs ?? 0
    acc.costUsd += c.costUsd ?? 0
  }
  return acc
}

function writeProgress(args: Args): void {
  const out: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const level of LEVELS) {
    const p = join(args.work, level, 'state.json')
    if (!existsSync(p)) continue
    const s = JSON.parse(readFileSync(p, 'utf8')) as LevelState
    const c = { ok: 0, pending: 0, rejected: 0 }
    for (const it of s.items) c[it.status]++
    out[level] = { total: s.total, ...c, final: existsSync(join(args.repo, 'prisma', 'seed-data', 'jlpt', `${level.toLowerCase()}.json`)) }
  }
  writeAtomic(join(args.work, 'progress.json'), `${JSON.stringify(out, null, 1)}\n`)
}

/** 단계별 개수 상수 — 실제 시드 파일 길이로 쓴다. 파일이 아직 없는 단계는 OpenJLPT 원본 수(잠정)를 쓰고 주석에 밝힌다. */
export function writeCounts(args: Pick<Args, 'repo' | 'raw'>): Record<VocabLevel, number> {
  const counts = {} as Record<VocabLevel, number>
  const provisional: VocabLevel[] = []
  for (const level of LEVELS) {
    const p = join(args.repo, 'prisma', 'seed-data', 'jlpt', `${level.toLowerCase()}.json`)
    if (existsSync(p)) counts[level] = (JSON.parse(readFileSync(p, 'utf8')) as unknown[]).length
    else { counts[level] = loadSources(args.raw, level).length; provisional.push(level) }
  }
  const note = provisional.length
    ? ` * ⚠ 잠정: ${provisional.join('·')} 은 아직 시드 파일이 없어 OpenJLPT v0.3.0 원본 수를 넣었다(검증 후 줄어든다).\n`
    : ' * 다섯 단계 모두 검증을 통과한 시드 파일 길이다(거절 행 제외 — OpenJLPT 원본 수보다 작을 수 있다).\n'
  const text = [
    '/**',
    ' * 기본 단어 팩 단계별 개수 — 클라이언트가 7천 개 데이터를 싣지 않고도 「N개 넣기」 문구를 그릴 수 있게 하는 상수 맵.',
    ' * 생성 파일: `scripts/seed-build/build.ts` 가 `prisma/seed-data/jlpt/*.json` 의 길이로 다시 쓴다(task-051). 손으로 고치지 않는다.',
    note.trimEnd(),
    ' */',
    `export const SEED_PACK_COUNT = { ${LEVELS.map((l) => `${l}: ${counts[l]}`).join(', ')} } as const`,
    '',
  ].join('\n')
  const target = join(args.repo, 'src', 'types', 'seedPackCounts.ts')
  if (!existsSync(target) || readFileSync(target, 'utf8') !== text) writeFileSync(target, text)
  return counts
}

/** 사용자 표본 검수 파일 — 단계별 무작위(고정 seed), haiku 산출(N5·N4)은 40개, 그 밖 30개 + 품사 힌트 불일치 최대 10개. */
function writeSample(args: Args): void {
  const SEED = 51051
  const PER: Record<VocabLevel, number> = { N5: 40, N4: 40, N3: 30, N2: 30, N1: 30 }
  const esc = (s: string | null) => (s ?? '—').replace(/\|/g, '\\|')
  const lines: string[] = [
    '---', 'task_id: task-051', 'title: "task-051 사용자 표본 검수 — JLPT 기본 단어 보강 결과"', 'tags:', '  - type/review', '  - domain/vocab', `created: ${new Date().toISOString().slice(0, 10)}`, '---', '',
    '# task-051 표본 검수 (사용자 원어민 검수용)', '',
    `> 생성: \`scripts/seed-build/build.ts sample\` (seed ${SEED}, 프롬프트 \`${VOCAB_ENRICH_PROMPT_VERSION}\`). 표기·읽기는 OpenJLPT 원본, **뜻·품사·예문·번역은 AI 생성**입니다.`,
    '> 검수 방법: 틀리거나 어색한 행의 ☐ 를 ☒ 로 바꾸고 「메모」에 고칠 내용을 적어 주세요. 자동 검사(형식·한글/일본어 문자·예문에 표제어 포함)는 이미 통과한 행들이라, 여기서는 **뜻이 맞는지·예문이 자연스러운지·번역이 정확한지**만 보면 됩니다.',
    '> 「자동 표시」 칸: 어간만 = 예문에 활용형으로만 들어감 · 읽기만 = 예문에 가나로만 들어감 · 면제 = する·来る 등 불규칙이라 포함 검사 면제 · 품사? = 사전 품사태그와 AI 품사가 다름.',
    '',
  ]
  const rnd = mulberry32(SEED)
  for (const level of LEVELS) {
    const p = join(args.repo, 'prisma', 'seed-data', 'jlpt', `${level.toLowerCase()}.json`)
    if (!existsSync(p)) { lines.push(`## ${level} — 시드 파일 없음(아직 생성 전)`, ''); continue }
    const recs = JSON.parse(readFileSync(p, 'utf8')) as SeedRecord[]
    const src = loadSources(args.raw, level)
    const byKey = new Map(src.map((s) => [`${s.word}\u0000${s.reading}`, s]))
    const st = existsSync(join(args.work, level, 'state.json')) ? (JSON.parse(readFileSync(join(args.work, level, 'state.json'), 'utf8')) as LevelState) : null
    const softByKey = new Map<string, string[]>()
    if (st) st.items.forEach((it, i) => { if (it.status === 'ok' && src[i]) softByKey.set(`${src[i]!.word}\u0000${src[i]!.reading}`, it.soft) })
    const flags = (r: SeedRecord): string => {
      const key = `${r.surface}\u0000${r.reading}`
      const f: string[] = []
      for (const c of softByKey.get(key) ?? []) {
        if (c === 'EXJA_STEM_ONLY') f.push('어간만')
        else if (c === 'EXJA_READING_ONLY') f.push('읽기만')
        else if (c === 'EXJA_INCLUDE_EXEMPT') f.push('면제')
      }
      const hints = posHints(byKey.get(key)?.pos)
      if (hints.size && !hints.has(r.partOfSpeech)) f.push('품사?')
      return f.join('·')
    }
    const idx = recs.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!] }
    const picked = idx.slice(0, PER[level]).sort((a, b) => a - b)
    const pickedSet = new Set(picked)
    const posOdd = recs.map((r, i) => ({ r, i })).filter(({ r, i }) => !pickedSet.has(i) && flags(r).includes('품사?')).slice(0, 10)
    const model = LEVEL_PLAN[level].model
    lines.push(`## ${level} — 무작위 ${picked.length}개 / 전체 ${recs.length}개 (${model} 생성)`, '')
    const table = (rows: { r: SeedRecord; i: number }[]) => {
      lines.push('| # | 표기 | 읽기 | 뜻 | 품사 | 예문 | 번역 | 자동 표시 | 검수 | 메모 |', '|---|---|---|---|---|---|---|---|---|---|')
      for (const { r, i } of rows) lines.push(`| ${i + 1} | ${esc(r.surface)} | ${esc(r.reading)} | ${esc(r.meaning)} | ${r.partOfSpeech}${r.chunkType ? `/${r.chunkType}` : ''} | ${esc(r.example)} | ${esc(r.exampleKo)} | ${flags(r)} | ☐ |  |`)
      lines.push('')
    }
    table(picked.map((i) => ({ r: recs[i]!, i })))
    if (posOdd.length) {
      lines.push(`### ${level} 품사 확인 표본 — 사전 품사태그와 AI 품사가 다른 행 앞에서부터 ${posOdd.length}개`, '')
      table(posOdd)
    }
  }
  const target = join(args.repo, 'agent-vault', '10-Flow', 'tasks', 'task-051-sample-review.md')
  writeFileSync(target, `${lines.join('\n')}\n`)
  console.log(`표본 검수 파일: ${target}`)
}

/**
 * 검사기 수정 뒤 거절 행 재판정 — 모델을 다시 부르지 않고 마지막 원 출력(lastRaw)을 지금 `checkRow` 로 다시 본다.
 * 검사기의 오판(예: コピーする 의 어간 규칙 누락)으로 거절된 행만 살아난다. 완료된 단계는 다시 확정(finalize)한다.
 */
function recheck(args: Args): void {
  for (const level of args.levels) {
    const dir = join(args.work, level)
    if (!existsSync(join(dir, 'state.json'))) continue
    const src = loadSources(args.raw, level)
    const state = loadState(dir, level, src.length)
    let revived = 0
    state.items.forEach((s, i) => {
      if (s.status !== 'rejected' || s.lastRaw === undefined) return
      const v = checkRow(s.lastRaw, src[i]!)
      if (v.status === 'ok') { state.items[i] = { status: 'ok', attempts: s.attempts, row: v.row, soft: [...v.soft, 'RECHECKED'] }; revived++ }
    })
    writeAtomic(join(dir, 'state.json'), JSON.stringify(state))
    console.log(`[${level}] 재판정 — 살아난 행 ${revived}`)
    if (!state.items.some((s) => s.status === 'pending')) finalizeLevel(args, level, src, state)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.cmd === 'counts') { console.log(writeCounts(args)); return }
  if (args.cmd === 'sample') { writeSample(args); return }
  if (args.cmd === 'recheck') { recheck(args); return }
  if (args.cmd !== 'run') throw new Error('사용법: build.ts run|counts|sample --repo <저장소 루트> [...]')
  mkdirSync(args.work, { recursive: true })
  const t0 = Date.now()
  for (const level of args.levels) {
    const finalPath = join(args.repo, 'prisma', 'seed-data', 'jlpt', `${level.toLowerCase()}.json`)
    const stPath = join(args.work, level, 'state.json')
    if (existsSync(finalPath) && existsSync(stPath)) {
      const s = JSON.parse(readFileSync(stPath, 'utf8')) as LevelState
      if (!s.items.some((i) => i.status === 'pending')) { console.log(`[${level}] 이미 완료 — 건너뜀`); continue }
    }
    const tl = Date.now()
    const r = await runLevel(args, level)
    console.log(`[${level}] ${r} — 단계 벽시계 ${((Date.now() - tl) / 1000).toFixed(0)}s`)
    if (r === 'incomplete') { console.log(`[${level}] 호출 실패로 남은 행이 있어 멈춤 — 같은 명령으로 다시 실행하면 이어서 한다`); process.exitCode = 2; return }
  }
  console.log(`전체 완료 — 벽시계 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

if (process.argv[1] && /build\.ts$/.test(process.argv[1])) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = e instanceof Halt ? 3 : 1
  })
}
