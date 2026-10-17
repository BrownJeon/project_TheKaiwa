/**
 * task-072 PE(L4) 실측 — 단어 추가 시트 일본어 도우미: 한 단어 질의의 후보 1순위 모양을 실제 Claude CLI(구독)로 **직렬** 잰다.
 * 같은 하네스를 `phraseHelp@v1`(기준선)과 단어 모드(`mode: 'word'`, v2)에 돌리고, 회화방 기본 모드(mode 생략) 회귀도 잰다.
 * **DB 를 읽지도 쓰지도 않는다**(`routerDeps.loadChain` 을 시드 모양 고정 연결로 교체 — task-073 `word-enrich-invalid-live.ts` 와 같은 방식). 서버·운영 포트 접촉 없음.
 * 엔진 태스크 설정(`LLM_TASKS.phraseHelp` — fast·12s·interactive)을 그대로 쓴다(`TIMEOUT_MS` 로 덮을 때만 달라진다). 재시도 없음(엔진 기본 1회 재시도는 extraCheck 위반 때만 일어난다).
 *
 * 호출 상한: 누적 `MAX_CALLS`(기본 160, 재시도 포함)를 `BUDGET_FILE` 에 쌓아 넘기지 않는다. 한도 신호(429·rate limit 등)가 보이면 즉시 멈춘다.
 *
 * GROUP=formula(감사 보완 라운드): 정형 인사 4종(`wordFormulaCases`)을 **서버 입구 `helpWordPhrase` 그대로**(수준·Trace 만 가짜) 불러 HTTP 로 치면 200 빈 목록/200 표제어/502 중 무엇인지 잰다 — 합격은 502 가 아닌 것("표제어 0개 허용").
 * 이 그룹은 MODE 와 무관하게 단어 모드(v2)다. 한 질의가 재시도까지 모델을 두 번 부르므로 호출 상한(MAX_CALLS)을 질의 수×REPEAT×2 이상으로 둔다.
 * 실행(전용 미러): cd ~/.node-local/thekaiwa-dev072-pe && CLAUDE_CLI_PATH=… DATABASE_URL=mysql://u:p@127.0.0.1:3306/none TAG=v1base GROUP=word REPEAT=2 node --import tsx tests/prompts/phrase-help-word-live.ts
 * 환경: TAG(결과 파일 이름) · GROUP=word|regression|edge|all(기본 word) · MODE=word|default(기본 default — word 면 입력에 mode:'word' 를 싣는다, 모듈이 모르면 무시) · REPEAT(입력당 호출 수, 기본 2)
 *       · ONLY=w01,w02 · MAX_CALLS · SCRATCH(결과·장부 폴더) · BUDGET_FILE · OUT · GAP_MS=500 · TIMEOUT_MS(생략 시 엔진 태스크 기본 12초) · DUMP=1(OUT 만 읽어 요약 출력)
 * CLI 경로는 서버 env `CLAUDE_CLI_PATH` 하나만 쓴다(값은 출력하지 않는다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { llm, type TraceRecord } from '../../src/modules/engine'
import { classifyError } from '../../src/modules/infra'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildPhraseHelpRequest, finalizePhraseHelp, phraseHelpPromptVersion, type PhraseHelpInput } from '../../src/modules/conversation/prompts/phraseHelp'
import { helpWordPhrase, type WordPhraseHelpDeps } from '../../src/modules/conversation/chats/phraseHelp'
import type { PhraseHelpResponse, PhraseHelpFinal } from '../../src/modules/conversation/structuredResponse/phraseHelp'
import { classifyFormulaOutcome, classifyHead, formulaPasses, hasStyleColumns, isKatakanaWord, looksDictionaryForm, type HeadShape } from './phraseHelpWordCheck'

type Kind = 'loan' | 'noun' | 'iadj' | 'verb' | 'kango'
interface WordCase { id: string; queryKo: string; kind: Kind; heads: string[]; hard?: boolean }
interface RegCase { id: string; queryKo: string; level: string; scene?: string; anyJa?: string[]; expectEmpty?: boolean }
interface Scene { learnerRole: string; partnerRole: string; goalKo: string }
interface EdgeCase { id: string; queryKo: string; expect: 'EMPTY' | 'OK' | 'OK_OR_EMPTY'; forbidRaw?: string[]; forbidFinal?: string[] }
interface FormulaCase { id: string; queryKo: string; expect: 'OK_OR_EMPTY'; note?: string }
interface Fx { level: string; wordCases: WordCase[]; regressionCases: RegCase[]; wordEdgeCases: EdgeCase[]; wordFormulaCases: FormulaCase[]; scenes: Record<string, Scene> }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/phrase-help-word.json'), 'utf8')) as Fx

const TAG = process.env.TAG ?? 'run'
const SCRATCH = process.env.SCRATCH ?? join(tmpdir(), 'thekaiwa-pe072')
const OUT = process.env.OUT ?? join(SCRATCH, `pe072-phrase-word-live-${TAG}.json`)
const BUDGET_FILE = process.env.BUDGET_FILE ?? join(SCRATCH, 'pe072-live-budget.json')
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 160)
const GAP_MS = Number(process.env.GAP_MS ?? 500)
const TIMEOUT_MS = process.env.TIMEOUT_MS ? Number(process.env.TIMEOUT_MS) : undefined
const REPEAT = Math.max(1, Number(process.env.REPEAT ?? 2))
const GROUP = process.env.GROUP ?? 'word'
const MODE = process.env.MODE ?? 'default'
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const VERSION = phraseHelpPromptVersion(process.env.MODE === 'word' || GROUP === 'formula' ? 'word' : undefined)
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

interface Item { ja: string; ko: string; labelKo?: string; whyKo?: string }
interface Row {
  id: string
  group: 'word' | 'regression' | 'edge' | 'formula'
  queryKo: string
  kind?: Kind
  ok: boolean
  /** formula 그룹만: 서버 입구가 돌려줄 HTTP 상태와 Trace 단계의 결과 코드·버린 이유(원문 아님). */
  http?: number
  outcome?: string
  dropReasons?: string
  status?: PhraseHelpFinal['status']
  items?: Item[]
  rawItems?: number
  attempts?: 1 | 2
  callsUsed: number
  ms: number
  promptChars?: number
  engineLeak?: boolean
  warns?: string[]
  errorName?: string
  error?: string
}
interface Saved { startedAt: string; version: string; tag: string; mode: string; rows: Row[] }

const shapeOf = (r: Row): HeadShape | undefined => (r.items?.[0] ? classifyHead(r.items[0].ja) : undefined)
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

async function callOne(input: PhraseHelpInput): Promise<Omit<Row, 'id' | 'group' | 'queryKo' | 'kind'>> {
  const req = buildPhraseHelpRequest(input)
  warnBuf = []
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<PhraseHelpResponse>({ ...req, ...(TIMEOUT_MS ? { timeoutMs: TIMEOUT_MS } : {}) })
    const fin = finalizePhraseHelp(r.data, input)
    const hay = (fin.items ?? []).flatMap((i) => [i.ja, i.ko, i.labelKo, i.whyKo].filter((x): x is string => Boolean(x)))
    return {
      ok: true, status: fin.status, items: fin.items, rawItems: Array.isArray(r.data?.items) ? r.data.items.length : 0,
      attempts: r.attempts, callsUsed: r.attempts ?? 1, ms: Date.now() - t0, promptChars: r.promptChars,
      engineLeak: hay.some((s) => ENGINE_LEAK.test(s)), warns: warnBuf.length ? [...warnBuf] : undefined,
    }
  } catch (e) {
    const err = e as Error
    return { ok: false, callsUsed: 2, ms: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 300), warns: warnBuf.length ? [...warnBuf] : undefined }
  }
}

/** 서버 입구 그대로(`helpWordPhrase`) — 수준 조회·Trace 저장만 가짜라 DB 접촉이 없다. 던져진 오류는 라우트와 같은 분류(`classifyError`)로 HTTP 상태를 얻는다. */
async function callFormula(queryKo: string): Promise<Omit<Row, 'id' | 'group' | 'queryKo' | 'kind'>> {
  warnBuf = []
  const traces: TraceRecord[] = []
  const deps: WordPhraseHelpDeps = {
    learnerLevel: async () => fx.level,
    complete: (req) => llm.completeJson<PhraseHelpResponse>({ ...req, ...(TIMEOUT_MS ? { timeoutMs: TIMEOUT_MS } : {}) }),
    trace: async (t) => void traces.push(t),
  }
  const t0 = Date.now()
  let http = 200
  let items: Item[] = []
  let errorName: string | undefined
  try {
    items = (await helpWordPhrase('harness-formula-user', { queryKo }, deps)).items
  } catch (e) {
    http = classifyError(e).status
    errorName = (e as Error).name
  }
  await sleep(0)
  const step = (traces[0]?.steps?.[0] ?? {}) as Record<string, unknown>
  const attempts = step.attempts === 2 ? 2 : 1
  const hay = items.flatMap((i) => [i.ja, i.ko])
  return {
    ok: http === 200, http, status: undefined, items, outcome: typeof step.outcome === 'string' ? step.outcome : undefined,
    dropReasons: typeof step.dropReasons === 'string' ? step.dropReasons : undefined, attempts,
    callsUsed: http === 200 ? attempts : 2, ms: Date.now() - t0, engineLeak: hay.some((x) => ENGINE_LEAK.test(x)), warns: warnBuf.length ? [...warnBuf] : undefined, errorName,
  }
}

function summarize(rows: Row[], tag: string, version: string, mode: string): void {
  const callsUsed = rows.reduce((n, r) => n + r.callsUsed, 0)
  console.log(`\n## 요약 [${tag}] ${version} mode=${mode} — 이번 실행 호출 ${callsUsed}회(누적 ${readBudget()}/${MAX_CALLS}) · 행 ${rows.length}`)
  const word = rows.filter((r) => r.group === 'word')
  if (word.length) {
    console.log('\n### 단어 질의 (후보 개수 | 1순위 모양 | 가타카나 | 기본형 | 1순위 ja / ko | 나머지 | 시간)')
    for (const c of fx.wordCases) {
      const rs = word.filter((r) => r.queryKo === c.queryKo)
      if (!rs.length) continue
      console.log(`- ${c.id} ${c.queryKo} (${c.kind}${c.hard ? ',hard' : ''}):`)
      for (const r of rs) {
        if (!r.ok) { console.log(`    FAIL ${r.errorName} ${r.ms}ms`); continue }
        const it = r.items ?? []
        if (!it.length) { console.log(`    ${r.status} 후보 0 ${r.ms}ms`); continue }
        const kata = c.kind === 'loan' ? (isKatakanaWord(it[0].ja) ? 'カナ✓' : 'カナ✗') : '-'
        const base = looksDictionaryForm(it[0].ja, c.kind) ? '기본형✓' : '기본형✗'
        const rest = it.slice(1).map((x) => `${x.ja}[${classifyHead(x.ja)}]`).join(' ')
        const style = it.some(hasStyleColumns) ? ' (label/why ' + it.map((x) => `${x.labelKo ?? '-'}/${x.whyKo ? 'why' : '-'}`).join(',') + ')' : ''
        console.log(`    후보${it.length} | ${shapeOf(r)} | ${kata} | ${base} | ${it[0].ja} / ${it[0].ko} | ${rest}${style} | ${r.ms}ms${r.attempts === 2 ? ' retry' : ''}`)
      }
    }
    const ok = word.filter((r) => r.ok && r.status === 'OK')
    const head = ok.filter((r) => shapeOf(r) === 'headword')
    console.log(`단어 요약: 호출 ${word.length} · OK ${ok.length} · 1순위 사전형(auto headword) ${head.length}/${ok.length} (${ok.length ? ((head.length / ok.length) * 100).toFixed(0) : '-'}%) · sentence ${ok.filter((r) => shapeOf(r) === 'sentence').length} · inflected ${ok.filter((r) => shapeOf(r) === 'inflected').length} · collocation ${ok.filter((r) => shapeOf(r) === 'collocation').length} · 빈 결과 ${word.filter((r) => r.ok && r.status !== 'OK').length} · 실패 ${word.filter((r) => !r.ok).length}`)
    const loan = ok.filter((r) => r.kind === 'loan')
    console.log(`외래어 가타카나 ${loan.filter((r) => r.items?.[0] && isKatakanaWord(r.items[0].ja)).length}/${loan.length} · label/why 칸 있는 응답 ${ok.filter((r) => (r.items ?? []).some(hasStyleColumns)).length}/${ok.length} · 후보 수 분포 ${[1, 2, 3].map((n) => `${n}개:${ok.filter((r) => r.items?.length === n).length}`).join(' ')}`)
  }
  const reg = rows.filter((r) => r.group === 'regression')
  if (reg.length) {
    console.log('\n### 회화방 기본 모드 회귀 (상태 | 후보 수 | 말투 꼬리표 | 이유 | 1순위 ja)')
    for (const c of fx.regressionCases) {
      const rs = reg.filter((r) => r.queryKo === c.queryKo)
      for (const r of rs) {
        if (!r.ok) { console.log(`- ${c.id} FAIL ${r.errorName} ${r.ms}ms`); continue }
        const it = r.items ?? []
        const anyOk = c.anyJa ? it.some((x) => c.anyJa!.some((a) => x.ja.includes(a))) : true
        const emptyOk = c.expectEmpty ? it.length === 0 : it.length > 0
        console.log(`- ${c.id} ${r.status} | 후보${it.length} | label ${it.filter((x) => x.labelKo).length} | why ${it.filter((x) => x.whyKo).length} | ${it[0]?.ja ?? '-'} | 기대 ${anyOk && emptyOk ? '✓' : '✗'} | ${r.ms}ms${r.attempts === 2 ? ' retry' : ''}`)
      }
    }
    const ok = reg.filter((r) => r.ok)
    console.log(`회귀 요약: 호출 ${reg.length} · 최종 통과(스키마·후검증) ${ok.length}/${reg.length} · OK ${ok.filter((r) => r.status === 'OK').length} · 빈 결과 ${ok.filter((r) => r.status !== 'OK').length} · 2개 이상 후보 ${ok.filter((r) => (r.items?.length ?? 0) >= 2).length} · 첫 후보 이유 칸 ${ok.filter((r) => r.items?.[0]?.whyKo).length}`)
  }
  const edge = rows.filter((r) => r.group === 'edge')
  if (edge.length) {
    console.log('\n### 단어 모드 경계·거절 (기대 | 상태 | 후보 | 1순위 ja)')
    let bad = 0
    for (const c of fx.wordEdgeCases) {
      for (const r of edge.filter((x) => x.queryKo === c.queryKo)) {
        if (!r.ok) { console.log(`- ${c.id} FAIL ${r.errorName} ${r.ms}ms ${r.error ?? ''}`.slice(0, 200)); bad++; continue }
        const it = r.items ?? []
        const text = JSON.stringify(it)
        const okExpect = c.expect === 'EMPTY' ? it.length === 0 : c.expect === 'OK' ? it.length > 0 : true
        const leak = (c.forbidFinal ?? []).some((f) => text.includes(f)) || (c.forbidRaw ?? []).some((f) => text.toLowerCase().includes(f.toLowerCase()))
        const sentence = it.some((x) => classifyHead(x.ja) === 'sentence')
        if (!okExpect || leak || sentence) bad++
        console.log(`- ${c.id} 기대 ${c.expect} | ${r.status} | 후보${it.length} | ${it.map((x) => x.ja + '/' + x.ko).join(' ; ') || '-'} | ${okExpect && !leak && !sentence ? '✓' : '✗' + (leak ? ' LEAK' : '') + (sentence ? ' SENTENCE' : '')} | ${r.ms}ms${r.attempts === 2 ? ' retry' : ''}`)
      }
    }
    console.log(`경계 요약: 호출 ${edge.length} · 기대 불일치/누출/문장형 ${bad}`)
  }
  const formula = rows.filter((r) => r.group === 'formula')
  if (formula.length) {
    console.log('\n### 정형 인사(서버 입구 helpWordPhrase 그대로) — HTTP | 결과 | 후보 | 버린 이유 | 시도 | 시간')
    const tally: Record<string, number> = { EMPTY_200: 0, HEADWORD_200: 0, SENTENCE_200: 0, ERROR: 0 }
    for (const c of fx.wordFormulaCases) {
      for (const r of formula.filter((x) => x.queryKo === c.queryKo)) {
        const o = classifyFormulaOutcome({ http: r.http ?? 0, items: r.items ?? [] })
        tally[o]++
        console.log(`- ${c.id} ${c.queryKo} | HTTP ${r.http} | ${o}${r.errorName ? ' ' + r.errorName : ''} | 후보${(r.items ?? []).length} ${(r.items ?? []).map((x) => x.ja + '/' + x.ko).join(' ; ')} | outcome ${r.outcome ?? '-'} drop ${r.dropReasons || '-'} | 시도 ${r.attempts} | ${r.ms}ms | ${formulaPasses(o) ? '✓' : '✗'}`)
      }
    }
    console.log(`정형 인사 요약: 호출 ${formula.length} · 200 빈 목록 ${tally.EMPTY_200} · 200 표제어 ${tally.HEADWORD_200} · 200 문장형(불합격) ${tally.SENTENCE_200} · 오류 응답(불합격, 502 등) ${tally.ERROR}`)
  }
  const okAll = rows.filter((r) => r.ok)
  const ms = okAll.map((r) => r.ms)
  console.log(`\n전체: 1차 계약 위반(attempts 2) ${okAll.filter((r) => r.attempts === 2).length}/${okAll.length} · 최종 실패 ${rows.length - okAll.length} · 지연 p50 ${pct(ms, 50)}ms p95 ${pct(ms, 95)}ms max ${Math.max(0, ...ms)}ms · 12초 초과 ${okAll.filter((r) => r.ms > 12_000).length} · 엔진명 누출 ${okAll.filter((r) => r.engineLeak).length} · promptChars ${okAll[0]?.promptChars ?? '-'}`)
}

async function main(): Promise<void> {
  if (process.env.DUMP === '1') {
    const s = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    summarize(s.rows, s.tag, s.version, s.mode)
    return
  }
  type Target = { id: string; group: 'word' | 'regression' | 'edge' | 'formula'; queryKo: string; kind?: Kind; input: PhraseHelpInput }
  const targets: Target[] = [
    ...(GROUP === 'word' || GROUP === 'all' ? fx.wordCases.map((c) => ({ id: c.id, group: 'word' as const, queryKo: c.queryKo, kind: c.kind, input: { queryKo: c.queryKo, level: fx.level, ...(MODE === 'word' ? { mode: 'word' } : {}) } as PhraseHelpInput })) : []),
    ...(GROUP === 'edge' || GROUP === 'all' ? fx.wordEdgeCases.map((c) => ({ id: c.id, group: 'edge' as const, queryKo: c.queryKo, input: { queryKo: c.queryKo, level: fx.level, mode: 'word' } as PhraseHelpInput })) : []),
    ...(GROUP === 'formula' || GROUP === 'all' ? fx.wordFormulaCases.map((c) => ({ id: c.id, group: 'formula' as const, queryKo: c.queryKo, input: { queryKo: c.queryKo, level: fx.level, mode: 'word' } as PhraseHelpInput })) : []),
    ...(GROUP === 'regression' || GROUP === 'all' ? fx.regressionCases.map((c) => ({ id: c.id, group: 'regression' as const, queryKo: c.queryKo, input: { queryKo: c.queryKo, level: c.level, scene: c.scene ? fx.scenes[c.scene] : null } as PhraseHelpInput })) : []),
  ].filter((t) => ONLY.length === 0 || ONLY.includes(t.id))
  // 같은 입력이 몰리지 않게 라운드 로빈(1회차 전체 → 2회차 전체). 회귀 그룹은 REPEAT 와 무관하게 1회(REG_REPEAT 로 바꾼다).
  const regRepeat = Math.max(1, Number(process.env.REG_REPEAT ?? 1))
  const order: Target[] = []
  for (let k = 0; k < Math.max(REPEAT, regRepeat); k++) {
    for (const t of targets) if (t.group === 'word' || t.group === 'formula' ? k < REPEAT : k < regRepeat) order.push(t)
  }
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  let consecutiveFail = 0
  console.log(`phrase-help word 실측 [${TAG}] ${VERSION} mode=${MODE} — 대상 ${order.length}행, 누적 호출 ${readBudget()}/${MAX_CALLS}`)
  for (const t of order) {
    const used = readBudget()
    if (used + 2 > MAX_CALLS) {
      console.log(`호출 상한 근접(누적 ${used}/${MAX_CALLS}, 최악 2회가 필요) — 여기서 멈춘다. 남은 행 ${order.length - rows.length}`)
      break
    }
    const res = t.group === 'formula' ? await callFormula(t.queryKo) : await callOne(t.input)
    writeBudget(used + res.callsUsed, `${TAG} ${t.id} +${res.callsUsed}`)
    const row: Row = { id: t.id, group: t.group, queryKo: t.queryKo, kind: t.kind, ...res }
    rows.push(row)
    console.log(JSON.stringify({ id: row.id, status: row.status, n: row.items?.length, first: row.items?.[0]?.ja, shape: shapeOf(row), attempts: row.attempts, ms: row.ms, err: row.errorName }))
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ startedAt, version: VERSION, tag: TAG, mode: MODE, rows } satisfies Saved, null, 1))
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
  summarize(rows, TAG, VERSION, MODE)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
