/**
 * task-037 QA — **실제 Claude CLI(구독)가 낸 자연 JSON 구문 슬립**이 `repairRootClose` 로 복구되는지 본다(TALK, 작업본 arm 만).
 * 합성 슬립 단위 증명은 이미 있다(`engine/__tests__/repairRootClose.test.ts`) — 이 스크립트는 "진짜 모델이 낸 슬립 모양"과 "복구 후 계약 통과"만 센다.
 * **운영 DB 를 바꾸지 않는다**(합성 발화만 — `tests/prompts/fixtures/{talk-corrections,talk-userko}.json`, 모듈 수준 호출이라 RequestTrace 도 안 쓴다).
 *
 * 호출마다 기록: 1차 응답(스트림 조각 합)이 `extractJson` 으로 파싱되는가(= 슬립/파싱 실패 여부) · `repaired` · `attempts` · FAILED ·
 * 복구본이 **독립 재검증**(스크립트가 직접 `repairRootClose`→`JSON.parse`→`validateOutput`(TALK_SCHEMA)→`checkTalkResponse`)을 통과하는가 ·
 * 슬립 모양(첫 루트 닫힘 뒤가 `,"userKo"` 인가)과 복구 후 `userKo` 가 루트 키인가 · 조기 음성 경로(스트림 첫 문장이 최종 replyJa 의 prefix 인가) ·
 * 호출 중 나온 `[json]` 경고 줄(내용 유무 확인용 원문).
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task037-slip-live.ts
 * 환경변수: RUNS=4(32문장 × RUNS 호출) RUN_START=1 GAP_MS=1500 ONLY=e01,u02 OUT=/tmp/kaiwa-task037-slip.json
 * 429/한도가 나오면 즉시 중단한다. 결과는 호출마다 OUT 에 덮어써 중단돼도 부분 결과가 남는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deepStrictEqual } from 'node:assert'
import { llm, createJsonPathStreamReader } from '../../src/modules/engine'
import { extractJson } from '../../src/modules/engine/json/extractJson'
import { repairRootClose } from '../../src/modules/engine/json/repairRootClose'
import { validateOutput } from '../../src/modules/engine/json/schemaValidate'
import { StreamingSentenceSplitter } from '../../src/modules/conversation/orchestrator/sentences'
import { earlySentenceProblem } from '../../src/modules/conversation/orchestrator/earlyFilter'
import { buildTalkRequest, checkTalkResponse, TALK_SCHEMA, TALK_PROMPT_VERSION, type TutorResponse } from '../../src/modules/conversation'

interface HistMsg { role: 'user' | 'assistant'; content: string }
interface Item { id: string; level: string; input: string; history: HistMsg[] }

const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const RUNS = Number(process.env.RUNS ?? 4)
const RUN_START = Number(process.env.RUN_START ?? 1)
const OUT = process.env.OUT ?? '/tmp/kaiwa-task037-slip.json'
const ONLY = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const corr = (JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-corrections.json'), 'utf8')) as { items: (Omit<Item, 'history'> & { history?: HistMsg[] })[] }).items.map((x) => ({ id: x.id, level: x.level, input: x.input, history: x.history ?? [] })) as Item[]
const uko = (JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-userko.json'), 'utf8')) as { live: Item[] }).live
const learnerBase = { displayName: '브라운', teacherName: '유우', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

/** 스크립트 독자 구현 — 문자열을 인식해 루트가 처음 닫히는 인덱스(코드펜스 제거 후 기준). 못 찾으면 -1. */
function firstRootCloseIdx(cleaned: string): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
const stripFences = (t: string) => t.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

interface Row {
  id: string
  run: number
  set: 'corr' | 'uko'
  ok: boolean
  ms: number
  attempts?: 1 | 2
  repaired?: string
  /** 1차 응답이 extractJson 으로 파싱되지 않았다(슬립 후보 포함 모든 파싱 실패). */
  firstParseFail: boolean
  /** 1차 응답이 파싱은 되지만 계약(스키마/extraCheck)을 어겨 재시도했다(슬립 아님). */
  firstContractViolation?: boolean
  raw1Chars: number
  /** 파싱 실패 응답의 첫 루트 닫힘 뒤 모양. */
  slipShape?: 'ROOT_CLOSE_THEN_USERKO' | 'ROOT_CLOSE_THEN_OTHER_KEY' | 'ROOT_CLOSE_THEN_JUNK' | 'NO_ROOT_CLOSE' | 'NOT_OBJECT_START'
  slipTail?: string
  slipHead?: string
  slipRaw1?: string
  /** 독립 재검증(파싱 실패 응답에 한해). */
  indep?: { fixedNonNull: boolean; parseOk: boolean; schemaOk: boolean; extraViolations: string[]; equalsReturnedData: boolean | null; userKoIsRootKey: boolean }
  /** 조기 음성: 스트림으로 확정된 첫 문장이 최종 replyJa 의 prefix 인가. */
  earlyPrefixOk?: boolean
  firstSentenceMs?: number | null
  warnLines: string[]
  error?: string
}

function buildReq(it: Item) {
  const input = { todayKst: '2026-10-05', learner: { ...learnerBase, level: it.level }, history: it.history, text: it.input }
  const req = buildTalkRequest({ ...input, sceneCap: 2 })
  if (req.repairRootClose !== true) throw new Error('작업본 TALK 요청에 repairRootClose:true 가 없다')
  return { req, input }
}

async function run(set: 'corr' | 'uko', it: Item, n: number): Promise<Row> {
  const { req, input } = buildReq(it)
  const raws: string[] = []
  const warnLines: string[] = []
  const origWarn = console.warn
  console.warn = (...a: unknown[]) => {
    const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')
    if (s.includes('[json]')) warnLines.push(s)
    origWarn.apply(console, a as [])
  }
  let firstSentenceMs: number | null = null
  let firstSentence: string | null = null
  const splitter = new StreamingSentenceSplitter()
  let replyDone = false
  const t0 = Date.now()
  const markFirst = (s: string) => {
    if (firstSentenceMs !== null) return
    firstSentenceMs = Date.now() - t0
    firstSentence = earlySentenceProblem(s) === null ? s : null
  }
  const reader = createJsonPathStreamReader([
    {
      path: ['conversation', 'replyJa'],
      onChunk: (t) => {
        if (replyDone || firstSentenceMs !== null) return
        for (const s of splitter.push(t)) { markFirst(s); break }
      },
      onComplete: () => {
        if (!replyDone && firstSentenceMs === null) {
          const rest = splitter.end()
          if (rest) markFirst(rest)
        }
        replyDone = true
      },
    },
  ])
  const onTextDelta = (d: string, call: number) => {
    raws[call] = (raws[call] ?? '') + d
    if (call === 1 && !reader.failed) reader.push(d)
  }
  const base = { id: it.id, run: n, set }
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 25_000, onTextDelta })
    console.warn = origWarn
    const raw1 = raws[1] ?? ''
    let firstParseFail = false
    try { extractJson(raw1) } catch { firstParseFail = true }
    const row: Row = {
      ...base, ok: true, ms: r.elapsedMs, attempts: r.attempts, ...(r.repaired ? { repaired: r.repaired } : {}),
      firstParseFail, raw1Chars: raw1.length, warnLines, firstSentenceMs,
    }
    if (firstSentence !== null) row.earlyPrefixOk = r.data.conversation.replyJa.trim().startsWith(firstSentence)
    if (!firstParseFail && r.attempts === 2) row.firstContractViolation = true
    if (firstParseFail) {
      const cleaned = stripFences(raw1)
      const idx = cleaned.startsWith('{') ? firstRootCloseIdx(cleaned) : -2
      row.slipShape = idx === -2 ? 'NOT_OBJECT_START' : idx === -1 ? 'NO_ROOT_CLOSE' : /^\}\s*,\s*"userKo"\s*:/.test(cleaned.slice(idx)) ? 'ROOT_CLOSE_THEN_USERKO' : /^\}\s*,\s*"/.test(cleaned.slice(idx)) ? 'ROOT_CLOSE_THEN_OTHER_KEY' : 'ROOT_CLOSE_THEN_JUNK'
      if (idx >= 0) { row.slipTail = cleaned.slice(Math.max(0, idx - 60), idx + 80); row.slipHead = cleaned.slice(0, 60) }
      row.slipRaw1 = raw1
      // 독립 재검증 — completeJson 이 돌려준 data 가 아니라 스크립트가 직접 복구·검증한다.
      const fixed = repairRootClose(raw1)
      let parseOk = false
      let schemaOk = false
      let extraViolations: string[] = []
      let equalsReturnedData: boolean | null = null
      let userKoIsRootKey = false
      if (fixed !== null) {
        try {
          const obj = JSON.parse(fixed) as TutorResponse
          parseOk = true
          schemaOk = validateOutput(obj, TALK_SCHEMA as object).ok
          extraViolations = (req.extraCheck ? req.extraCheck(obj, { attempt: 1, maxAttempts: 2 } as never) : checkTalkResponse(input.text, obj)) ?? []
          userKoIsRootKey = typeof (obj as unknown as Record<string, unknown>).userKo === 'string'
          if (r.repaired) { try { deepStrictEqual(obj, r.data); equalsReturnedData = true } catch { equalsReturnedData = false } }
        } catch { /* parseOk=false */ }
      }
      row.indep = { fixedNonNull: fixed !== null, parseOk, schemaOk, extraViolations: Array.isArray(extraViolations) ? extraViolations : [], equalsReturnedData, userKoIsRootKey }
    }
    return row
  } catch (e) {
    console.warn = origWarn
    const err = e as Error
    const raw1 = raws[1] ?? ''
    let firstParseFail = false
    try { extractJson(raw1) } catch { firstParseFail = true }
    return { ...base, ok: false, ms: Date.now() - t0, firstParseFail, raw1Chars: raw1.length, warnLines, error: `${err.name}: ${err.message.slice(0, 300)}`, slipRaw1: firstParseFail ? raw1 : undefined }
  }
}

function summarize(rows: Row[]): string {
  const out: string[] = []
  const n = rows.length
  const ok = rows.filter((r) => r.ok)
  const slip = rows.filter((r) => r.firstParseFail)
  const repaired = rows.filter((r) => r.repaired === 'ROOT_CLOSE')
  const retried = ok.filter((r) => r.attempts === 2)
  const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)] : NaN)
  out.push(`호출 ${n} · 성공 ${ok.length} · FAILED ${n - ok.length}`)
  out.push(`attempts 분포: 1회 ${ok.filter((r) => r.attempts === 1).length} · 2회 ${retried.length}`)
  out.push(`1차 응답 파싱 실패(슬립 후보) ${slip.length}건 (${((slip.length / n) * 100).toFixed(2)}%)`)
  out.push(`  └ 복구 성공(repaired=ROOT_CLOSE, attempts=1) ${repaired.length}건`)
  out.push(`  └ 복구 안 됨 → 재시도로 회복 ${slip.filter((r) => r.ok && !r.repaired).length}건 · 최종 실패 ${slip.filter((r) => !r.ok).length}건`)
  out.push(`  └ 슬립 모양: ${JSON.stringify(slip.reduce<Record<string, number>>((m, r) => ((m[r.slipShape ?? 'n/a'] = (m[r.slipShape ?? 'n/a'] ?? 0) + 1), m), {}))}`)
  out.push(`재시도 총 ${retried.length}건 = 슬립(파싱 실패) ${retried.filter((r) => r.firstParseFail).length} + 계약 위반(파싱 OK) ${retried.filter((r) => r.firstContractViolation).length}`)
  out.push(`복구본 독립 재검증: ${repaired.length}건 중 parseOk ${repaired.filter((r) => r.indep?.parseOk).length} · schemaOk ${repaired.filter((r) => r.indep?.schemaOk).length} · extraCheck 위반 0 ${repaired.filter((r) => r.indep && r.indep.extraViolations.length === 0).length} · completeJson data 와 deepEqual ${repaired.filter((r) => r.indep?.equalsReturnedData === true).length} · userKo 루트 키 ${repaired.filter((r) => r.indep?.userKoIsRootKey).length}`)
  out.push(`조기 음성 prefix 일치(스트림 첫 문장 ⊂ 최종 replyJa): 전체 ${ok.filter((r) => r.earlyPrefixOk).length}/${ok.filter((r) => r.earlyPrefixOk !== undefined).length} · 복구 ${repaired.filter((r) => r.earlyPrefixOk).length}/${repaired.filter((r) => r.earlyPrefixOk !== undefined).length}`)
  const ms = ok.map((r) => r.ms)
  out.push(`ms p50 ${pctl(ms, 0.5)} · p95 ${pctl(ms, 0.95)} · 복구 행 ms ${JSON.stringify(repaired.map((r) => r.ms))} · 재시도 행 ms ${JSON.stringify(retried.map((r) => r.ms))}`)
  out.push(`경고 줄 집계: 구문 슬립 복구(ROOT_CLOSE) ${rows.reduce((a, r) => a + r.warnLines.filter((l) => l.includes('구문 슬립 복구(ROOT_CLOSE)')).length, 0)}줄 (repaired 행 ${repaired.length}) · 재시도 줄 ${rows.reduce((a, r) => a + r.warnLines.filter((l) => l.includes('1차 응답 계약 위반')).length, 0)}줄`)
  for (const r of rows.filter((x) => x.warnLines.some((l) => l.includes('구문 슬립 복구')))) out.push(`  경고 원문 ${r.id}#${r.run}: ${JSON.stringify(r.warnLines)}`)
  for (const r of slip) out.push(`슬립 ${r.id}#${r.run} ok=${r.ok} attempts=${r.attempts ?? '-'} repaired=${r.repaired ?? '-'} shape=${r.slipShape} head=${JSON.stringify(r.slipHead)} tail=${JSON.stringify(r.slipTail)} indep=${JSON.stringify(r.indep)}`)
  for (const r of rows.filter((x) => !x.ok)) out.push(`실패 ${r.id}#${r.run}: ${r.error}`)
  return out.join('\n')
}

async function main() {
  const pick = (xs: Item[]) => xs.filter((x) => !ONLY || ONLY.includes(x.id))
  const jobs: { set: 'corr' | 'uko'; it: Item; n: number }[] = []
  for (let n = RUN_START; n < RUN_START + RUNS; n++) {
    pick(corr).forEach((it) => jobs.push({ set: 'corr', it, n }))
    pick(uko).forEach((it) => jobs.push({ set: 'uko', it, n }))
  }
  console.log(`task-037 라이브 슬립 포착 — work=${TALK_PROMPT_VERSION} · 작업 ${jobs.length}개 = 총 호출(재시도 제외) ${jobs.length} · 호출 간격 ${GAP_MS}ms · 순차`)
  const rows: Row[] = []
  const save = () => writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), work: TALK_PROMPT_VERSION, rows }, null, 1))
  for (const j of jobs) {
    const r = await run(j.set, j.it, j.n)
    rows.push(r)
    console.log(JSON.stringify({ i: rows.length, id: r.id, run: r.run, ok: r.ok, ms: r.ms, att: r.attempts, rep: r.repaired, pfail: r.firstParseFail, shape: r.slipShape, err: r.error }))
    save()
    if (r.error && /429|rate.?limit|usage limit|한도/i.test(r.error)) {
      console.log('429/사용 한도 감지 — 중단')
      console.log(`\n## 요약(중단)\n${summarize(rows)}`)
      return
    }
    await sleep(GAP_MS)
  }
  console.log(`\n## 요약\n${summarize(rows)}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
