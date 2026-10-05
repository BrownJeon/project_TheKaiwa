/**
 * task-036(talk@v8·chat@v3) A/B 실측 — 실제 Claude CLI(구독)로 A1 TALK·A2 CHAT 응답 계약에서 구 히라가나 읽기 줄 필드를 뺀 전후를 비교한다.
 * **운영 DB 를 바꾸지 않는다**(합성 발화만 — `tests/prompts/fixtures/{talk-corrections,talk-userko}.json`, connection 은 읽기만).
 *
 * - arm `head` = 커밋 HEAD(talk@v7·chat@v2) 의 프롬프트 모듈 그대로. `git archive HEAD src` 로 푼 디렉토리(`BASE_SRC`, 기본 ~/.node-local/thekaiwa-head036/src)의
 *   `modules/conversation/prompts/{talk,chat}.ts` 를 동적 import 한다(그 파일의 `../structuredResponse`·`../persona` 상대 import 는 HEAD 것, `@/` 별칭은 미러 것).
 * - arm `work` = 작업본(미러 src) `buildTalkRequest`·`buildChatRequest` 그대로.
 * - 두 팔은 항목마다 번갈아 먼저 돈다(교차) · 순차 실행(지연 왜곡 방지) · 호출 사이 `GAP_MS` 대기 · 429/한도가 나오면 즉시 중단.
 * - 스트림(`onTextDelta`)에서 운영 `TurnAudio` 와 같은 `createJsonPathStreamReader`+`StreamingSentenceSplitter` 로 `speech.style` 완료·replyJa 첫 문장 확정 시각을 잰다
 *   (조기 추출 → 첫 음성 합성 시작 시점의 LLM 단 지표). 모델이 옛 키를 냈는지는 **호출별 원문**에서 `"replyReading"` 을 찾아 센다(재시도로 가려진 1차 방출 포함).
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task036-reading-ab.ts
 * 환경변수: RUNS_CORR=2(교정 20문장 TALK) RUNS_UKO_TALK=1(userKo 12문장 TALK) RUNS_UKO_CHAT=2(userKo 12문장 CHAT) GAP_MS=1500 ONLY=e01,u02 ARMS=head,work PHASES=corr,ukotalk,ukochat
 *       RUN_START=1(추가 패스는 3 처럼 올려 교차 순서를 바꾼다) SUMMARIZE_ONLY=a.json,b.json(호출 없이 여러 결과 파일을 합쳐 요약만)
 *       BASE_SRC=<HEAD 복원 src> OUT=/tmp/kaiwa-task036-ab.json
 * 결과: OUT(실행 중 계속 덮어써 중단돼도 부분 결과가 남는다) + 표준 출력 요약.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { llm, createJsonPathStreamReader } from '../../src/modules/engine'
import { StreamingSentenceSplitter } from '../../src/modules/conversation/orchestrator/sentences'
import { earlySentenceProblem } from '../../src/modules/conversation/orchestrator/earlyFilter'
import { checkReplyKoNaturalness, countJaSentences, sanitizeUserKo } from '../../src/modules/conversation/structuredResponse/checks'
import type { TutorResponse } from '../../src/modules/conversation/structuredResponse/schemas'
import * as WORK_T from '../../src/modules/conversation/prompts/talk'
import * as WORK_C from '../../src/modules/conversation/prompts/chat'

type Arm = 'head' | 'work'
type Kind = 'talk' | 'chat'
type SetId = 'corr' | 'uko'
interface HistMsg { role: 'user' | 'assistant'; content: string }
interface Item {
  id: string
  level: string
  input: string
  history: HistMsg[]
  hasError?: boolean
  expectedCorrected?: string
  errorType?: string
}

const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const OUT = process.env.OUT ?? '/tmp/kaiwa-task036-ab.json'
const ONLY = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const ARMS = (process.env.ARMS ?? 'head,work').split(',').map((s) => s.trim()) as Arm[]
const PHASES = (process.env.PHASES ?? 'corr,ukotalk,ukochat').split(',').map((s) => s.trim())
const RUNS_CORR = Number(process.env.RUNS_CORR ?? 2)
const RUNS_UKO_TALK = Number(process.env.RUNS_UKO_TALK ?? 1)
const RUNS_UKO_CHAT = Number(process.env.RUNS_UKO_CHAT ?? 2)
const RUN_START = Number(process.env.RUN_START ?? 1)
const SUMMARIZE_ONLY = process.env.SUMMARIZE_ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const BASE_SRC = process.env.BASE_SRC ?? join(process.env.HOME ?? '', '.node-local/thekaiwa-head036/src')

const corr = (JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-corrections.json'), 'utf8')) as { items: (Omit<Item, 'history'> & { history?: HistMsg[] })[] }).items.map((x) => ({ ...x, history: x.history ?? [] })) as Item[]
const uko = (JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-userko.json'), 'utf8')) as { live: Item[] }).live
const learnerBase = { displayName: '브라운', teacherName: '유우', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const norm = (s: string) => s.replace(/[\s、。！？!?]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Builders {
  buildTalkRequest: (i: Record<string, unknown>) => Parameters<typeof llm.completeJson<TutorResponse>>[0]
  buildChatRequest: (i: Record<string, unknown>) => Parameters<typeof llm.completeJson<TutorResponse>>[0]
  TALK_PROMPT_VERSION?: string
  CHAT_PROMPT_VERSION?: string
}
let HEAD: Builders
const WORK: Builders = { buildTalkRequest: WORK_T.buildTalkRequest as unknown as Builders['buildTalkRequest'], buildChatRequest: WORK_C.buildChatRequest as unknown as Builders['buildChatRequest'], TALK_PROMPT_VERSION: WORK_T.TALK_PROMPT_VERSION, CHAT_PROMPT_VERSION: WORK_C.CHAT_PROMPT_VERSION }

interface Row {
  kind: Kind
  set: SetId
  arm: Arm
  id: string
  run: number
  ok: boolean
  ms: number
  attempts?: 1 | 2
  firstDeltaMs?: number | null
  promptChars?: number
  /** 검증 통과한 data 를 JSON.stringify 한 길이(= 모델이 낸 구조화 출력의 크기 대용). */
  outChars?: number
  /** 호출 1 원문 길이(스트림 조각 합). */
  raw1Chars?: number
  streamed?: boolean
  /** 옛 키가 원문에 나온 호출 번호들(재시도 전 1차 방출 포함). */
  oldKeyCalls?: number[]
  oldKeyFinal?: boolean
  convKeys?: string[]
  replyKoHangul?: boolean
  replyKoDouble?: boolean
  replySentences?: number
  userKoOk?: boolean
  styleMs?: number | null
  firstSentenceMs?: number | null
  earlyProblem?: string | null
  earlyPrefixOk?: boolean
  styleBeforeSentence?: boolean
  detected?: boolean
  originalUnchanged?: boolean | null
  correctedMatch?: boolean | null
  typeMatch?: boolean | null
  hasError?: boolean
  retryRaw?: string
  /** 진단용 — learning.grammarPoint(괄호 포함 여부와 JSON 구문 슬립의 상관을 보려고). */
  gp?: string | null
  error?: string
}

function buildReq(arm: Arm, kind: Kind, it: Item) {
  const b = arm === 'head' ? HEAD : WORK
  const input = { todayKst: '2026-10-05', learner: { ...learnerBase, level: it.level }, history: it.history, text: it.input }
  const req = kind === 'talk' ? b.buildTalkRequest({ ...input, sceneCap: 2 }) : b.buildChatRequest(input)
  // 안전망 — 두 팔이 정말 서로 다른 계약인지(head 는 옛 키가 지시·스키마에 있고 work 는 어디에도 없다).
  const hasOld = /replyReading/.test((req as { system: string }).system) || /replyReading/.test(JSON.stringify((req as { jsonSchema: unknown }).jsonSchema))
  if (arm === 'head' && !hasOld) throw new Error('head 팔에 옛 키가 없다 — BASE_SRC 확인')
  if (arm === 'work' && hasOld) throw new Error('work 팔에 옛 키가 남았다')
  return req
}

async function run(kind: Kind, set: SetId, arm: Arm, it: Item, n: number): Promise<Row> {
  const base: Row = { kind, set, arm, id: it.id, run: n, ok: false, ms: 0, hasError: it.hasError }
  const req = buildReq(arm, kind, it)
  const raws: string[] = []
  let styleMs: number | null = null
  let firstSentenceMs: number | null = null
  let firstSentence: string | null = null
  let earlyProblem: string | null = null
  let replyDone = false
  let deltas = 0
  const splitter = new StreamingSentenceSplitter()
  const t0 = Date.now()
  const markFirst = (s: string) => {
    if (firstSentenceMs !== null) return
    firstSentenceMs = Date.now() - t0
    firstSentence = s
    earlyProblem = earlySentenceProblem(s)
  }
  const reader = createJsonPathStreamReader([
    { path: ['speech', 'style'], onComplete: () => { if (styleMs === null) styleMs = Date.now() - t0 } },
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
    deltas++
    raws[call] = (raws[call] ?? '') + d
    if (call === 1 && !reader.failed) reader.push(d)
  }
  try {
    const r = await llm.completeJson<TutorResponse>({ ...(req as Parameters<typeof llm.completeJson<TutorResponse>>[0]), timeoutMs: 25_000, onTextDelta })
    const ms = r.elapsedMs
    const d = r.data
    const c = d.correction
    const oldKeyCalls = raws.map((x, i) => (x && /"replyReading"/.test(x) ? i : -1)).filter((i) => i > 0)
    const userKoSan = sanitizeUserKo(it.input, d.userKo)
    const row: Row = {
      ...base, ok: true, ms, attempts: r.attempts, firstDeltaMs: r.firstDeltaMs ?? null, promptChars: r.promptChars,
      outChars: JSON.stringify(d).length, raw1Chars: raws[1]?.length ?? 0, streamed: deltas > 0,
      oldKeyCalls, oldKeyFinal: /replyReading/.test(JSON.stringify(d)), convKeys: Object.keys(d.conversation),
      replyKoHangul: /[가-힣]/.test(d.conversation.replyKo ?? ''), replyKoDouble: checkReplyKoNaturalness(d.conversation.replyKo ?? '').length > 0,
      replySentences: countJaSentences(d.conversation.replyJa), userKoOk: userKoSan !== null, gp: d.learning?.grammarPoint ?? null,
      styleMs, firstSentenceMs, earlyProblem, earlyPrefixOk: firstSentence !== null ? d.conversation.replyJa.trim().startsWith(firstSentence) : undefined,
      styleBeforeSentence: styleMs !== null && firstSentenceMs !== null ? styleMs <= firstSentenceMs : undefined,
    }
    if (set === 'corr' && kind === 'talk') {
      row.detected = Boolean(c)
      row.originalUnchanged = c ? c.original === it.input : null
      row.correctedMatch = c && it.expectedCorrected ? norm(c.corrected) === norm(it.expectedCorrected) : null
      row.typeMatch = c && it.errorType ? c.errorType === it.errorType : null
    }
    if (r.attempts === 2) row.retryRaw = (raws[1] ?? '').slice(0, 600)
    return row
  } catch (e) {
    const err = e as Error
    return { ...base, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 300)}`, oldKeyCalls: raws.map((x, i) => (x && /"replyReading"/.test(x) ? i : -1)).filter((i) => i > 0), retryRaw: (raws[1] ?? '').slice(0, 600) }
  }
}

// ── 통계 ────────────────────────────────────────────────────────────────────
const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)] : NaN)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const frac = (a: number, b: number) => (b ? `${a}/${b}` : '-')
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** 두 표본의 통계량(중앙값·평균) 차이에 대한 양측 순열검정 p. */
function permP(a: number[], b: number[], stat: (x: number[]) => number, iters = 20_000): number {
  if (a.length < 3 || b.length < 3) return NaN
  const obs = Math.abs(stat(a) - stat(b))
  const all = [...a, ...b]
  const rnd = mulberry32(36)
  let ge = 0
  for (let i = 0; i < iters; i++) {
    for (let j = all.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1))
      ;[all[j], all[k]] = [all[k], all[j]]
    }
    if (Math.abs(stat(all.slice(0, a.length)) - stat(all.slice(a.length))) >= obs) ge++
  }
  return (ge + 1) / (iters + 1)
}

function summarize(rows: Row[]): string {
  const out: string[] = []
  const groups: { label: string; kind: Kind; sets: SetId[] }[] = [
    { label: 'TALK 전체(교정 20문장 ×RUNS + userKo 12문장)', kind: 'talk', sets: ['corr', 'uko'] },
    { label: 'TALK · 교정 세트(talk-corrections 20문장)', kind: 'talk', sets: ['corr'] },
    { label: 'CHAT(userKo 12문장)', kind: 'chat', sets: ['uko'] },
  ]
  for (const g of groups) {
    const sub = rows.filter((r) => r.kind === g.kind && g.sets.includes(r.set))
    if (!sub.length) continue
    out.push(`\n### ${g.label}`)
    out.push('| arm | n | 성공 | FAILED | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | ms 평균 | 12s 초과 | 출력JSON 평균자 | 원문1 평균자 | replyReading 원문 방출(head=계약 필드·work=옛 키) | 최종 data 에 남음 | replyKo 한글 | 이중높임 | userKo 정리 | replyJa 문장 평균 |')
    out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = sub.filter((r) => r.arm === arm)
      if (!a.length) continue
      const ok = a.filter((r) => r.ok)
      const ms = ok.map((r) => r.ms)
      out.push(
        `| ${arm} | ${a.length} | ${frac(ok.length, a.length)} | ${a.length - ok.length} | ${frac(ok.filter((r) => r.attempts === 1).length, a.length)} | ${ok.filter((r) => r.attempts === 2).length} | ${pctl(ms, 0.5)} | ${pctl(ms, 0.95)} | ${mean(ms).toFixed(0)} | ${ms.filter((x) => x > 12_000).length} | ${mean(ok.map((r) => r.outChars ?? 0)).toFixed(1)} | ${mean(ok.map((r) => r.raw1Chars ?? 0)).toFixed(1)} | ${a.filter((r) => (r.oldKeyCalls?.length ?? 0) > 0).length}/${a.length} | ${ok.filter((r) => r.oldKeyFinal).length} | ${frac(ok.filter((r) => r.replyKoHangul).length, ok.length)} | ${ok.filter((r) => r.replyKoDouble).length} | ${frac(ok.filter((r) => r.userKoOk).length, ok.length)} | ${mean(ok.map((r) => r.replySentences ?? 0)).toFixed(2)} |`,
      )
    }
    const h = sub.filter((r) => r.arm === 'head' && r.ok).map((r) => r.ms)
    const w = sub.filter((r) => r.arm === 'work' && r.ok).map((r) => r.ms)
    if (h.length && w.length) {
      const med = (x: number[]) => pctl(x, 0.5)
      out.push(`- ms 차이(work−head): p50 ${(med(w) - med(h)).toFixed(0)} · 평균 ${(mean(w) - mean(h)).toFixed(0)} · p95 ${(pctl(w, 0.95) - pctl(h, 0.95)).toFixed(0)} — 순열검정 p(중앙값)=${permP(h, w, med).toFixed(3)} · p(평균)=${permP(h, w, mean).toFixed(3)}`)
      const ho = sub.filter((r) => r.arm === 'head' && r.ok).map((r) => r.outChars ?? 0)
      const wo = sub.filter((r) => r.arm === 'work' && r.ok).map((r) => r.outChars ?? 0)
      out.push(`- 출력JSON 평균자 차이(work−head): ${(mean(wo) - mean(ho)).toFixed(1)}자 (${(((mean(wo) - mean(ho)) / mean(ho)) * 100).toFixed(1)}%)`)
    }
  }
  // 조기 추출(첫 음성 전 단계) — TALK 만.
  const t = rows.filter((r) => r.kind === 'talk' && r.ok)
  if (t.length) {
    out.push('\n### 조기 추출(TALK, 스트림 → speech.style 완료 · replyJa 첫 문장 확정)')
    out.push('| arm | n | 스트림 수신 | style 완료 p50 | 첫문장 확정 p50 | 첫문장 p95 | 첫문장 평균 | 필터 통과 | prefix 일치 | style 먼저 |')
    out.push('|---|---|---|---|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = t.filter((r) => r.arm === arm)
      if (!a.length) continue
      const fs = a.map((r) => r.firstSentenceMs).filter((x): x is number => typeof x === 'number')
      const st = a.map((r) => r.styleMs).filter((x): x is number => typeof x === 'number')
      out.push(
        `| ${arm} | ${a.length} | ${frac(a.filter((r) => r.streamed).length, a.length)} | ${pctl(st, 0.5)} | ${pctl(fs, 0.5)} | ${pctl(fs, 0.95)} | ${mean(fs).toFixed(0)} | ${frac(a.filter((r) => r.firstSentenceMs != null && r.earlyProblem === null).length, a.length)} | ${frac(a.filter((r) => r.earlyPrefixOk).length, a.length)} | ${frac(a.filter((r) => r.styleBeforeSentence).length, a.length)} |`,
      )
    }
    const hf = t.filter((r) => r.arm === 'head').map((r) => r.firstSentenceMs).filter((x): x is number => typeof x === 'number')
    const wf = t.filter((r) => r.arm === 'work').map((r) => r.firstSentenceMs).filter((x): x is number => typeof x === 'number')
    if (hf.length && wf.length) {
      const med = (x: number[]) => pctl(x, 0.5)
      out.push(`- 첫문장 확정 차이(work−head): p50 ${(med(wf) - med(hf)).toFixed(0)} · 평균 ${(mean(wf) - mean(hf)).toFixed(0)} — 순열검정 p(중앙값)=${permP(hf, wf, med).toFixed(3)} · p(평균)=${permP(hf, wf, mean).toFixed(3)}`)
    }
  }
  // 교정 검출(교정 세트 TALK).
  const cr = rows.filter((r) => r.kind === 'talk' && r.set === 'corr' && r.ok)
  if (cr.length) {
    out.push('\n### 교정 검출(talk-corrections: 오류 16·정답 4 × RUNS)')
    out.push('| arm | 오류 검출 | 오탐(정답 교정) | 유형 일치 | 교정문 일치 | original 바이트 일치(검출분) |')
    out.push('|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = cr.filter((r) => r.arm === arm)
      if (!a.length) continue
      const errs = a.filter((r) => r.hasError)
      const clean = a.filter((r) => !r.hasError)
      const det = a.filter((r) => r.detected)
      out.push(
        `| ${arm} | ${frac(errs.filter((r) => r.detected).length, errs.length)} | ${frac(clean.filter((r) => r.detected).length, clean.length)} | ${frac(errs.filter((r) => r.typeMatch).length, errs.length)} | ${frac(errs.filter((r) => r.correctedMatch).length, errs.length)} | ${frac(det.filter((r) => r.originalUnchanged).length, det.length)} |`,
      )
    }
  }
  const emitted = rows.filter((r) => (r.oldKeyCalls?.length ?? 0) > 0)
  out.push(`\n### replyReading 원문 방출 — 원문 기준 ${emitted.length}건(head 는 그 팔의 계약 필드라 정상 — work 팔 방출 ${emitted.filter((r) => r.arm === 'work').length}건이 옛 키 방출)`)
  for (const r of emitted) out.push(`- ${r.kind}/${r.arm}/${r.id}#${r.run} calls=${JSON.stringify(r.oldKeyCalls)} attempts=${r.attempts ?? '-'} ok=${r.ok}${r.error ? ' err=' + r.error : ''}`)
  for (const r of rows.filter((x) => !x.ok)) out.push(`- 실패 ${r.kind}/${r.arm}/${r.id}#${r.run}: ${r.error}`)
  for (const r of rows.filter((x) => x.ok && x.attempts === 2)) out.push(`- 재시도 ${r.kind}/${r.arm}/${r.id}#${r.run} ms=${r.ms} raw1=${JSON.stringify(r.retryRaw)}`)
  return out.join('\n')
}

interface Job { kind: Kind; set: SetId; it: Item; n: number; order: Arm[] }

function planJobs(): Job[] {
  const jobs: Job[] = []
  const pick = (xs: Item[]) => xs.filter((x) => !ONLY || ONLY.includes(x.id))
  const order = (i: number, n: number): Arm[] => {
    const o: Arm[] = (i + n) % 2 === 0 ? ['head', 'work'] : ['work', 'head']
    return o.filter((a) => ARMS.includes(a))
  }
  if (PHASES.includes('corr')) for (let n = RUN_START; n < RUN_START + RUNS_CORR; n++) pick(corr).forEach((it, i) => jobs.push({ kind: 'talk', set: 'corr', it, n, order: order(i, n) }))
  if (PHASES.includes('ukotalk')) for (let n = RUN_START; n < RUN_START + RUNS_UKO_TALK; n++) pick(uko).forEach((it, i) => jobs.push({ kind: 'talk', set: 'uko', it, n, order: order(i, n) }))
  if (PHASES.includes('ukochat')) for (let n = RUN_START; n < RUN_START + RUNS_UKO_CHAT; n++) pick(uko).forEach((it, i) => jobs.push({ kind: 'chat', set: 'uko', it, n, order: order(i, n) }))
  return jobs
}

async function main() {
  if (SUMMARIZE_ONLY) {
    const all = SUMMARIZE_ONLY.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows)
    console.log(`## 합산 요약(${SUMMARIZE_ONLY.join(' + ')}, 행 ${all.length})\n${summarize(all)}`)
    return
  }
  const t = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/talk.ts')).href)) as Builders
  const c = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/chat.ts')).href)) as Builders
  HEAD = { buildTalkRequest: t.buildTalkRequest, buildChatRequest: c.buildChatRequest, TALK_PROMPT_VERSION: t.TALK_PROMPT_VERSION, CHAT_PROMPT_VERSION: c.CHAT_PROMPT_VERSION }
  const jobs = planJobs()
  const calls = jobs.reduce((n, j) => n + j.order.length, 0)
  console.log(`task-036 A/B 실측 — head=${HEAD.TALK_PROMPT_VERSION}/${HEAD.CHAT_PROMPT_VERSION} work=${WORK.TALK_PROMPT_VERSION}/${WORK.CHAT_PROMPT_VERSION} · 작업 ${jobs.length}개 · 총 호출 ${calls} · 호출 간격 ${GAP_MS}ms (순차·교차)`)
  const rows: Row[] = []
  const save = () => writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), head: HEAD.TALK_PROMPT_VERSION + '/' + HEAD.CHAT_PROMPT_VERSION, work: WORK.TALK_PROMPT_VERSION + '/' + WORK.CHAT_PROMPT_VERSION, rows }, null, 1))
  for (const j of jobs) {
    for (const arm of j.order) {
      const r = await run(j.kind, j.set, arm, j.it, j.n)
      rows.push(r)
      console.log(JSON.stringify({ kind: r.kind, set: r.set, arm: r.arm, id: r.id, run: r.run, ok: r.ok, ms: r.ms, att: r.attempts, out: r.outChars, old: r.oldKeyCalls, fs: r.firstSentenceMs, err: r.error }))
      save()
      if (r.error && /429|rate.?limit|usage limit|한도/i.test(r.error)) {
        console.log('429/사용 한도 감지 — 중단')
        console.log(`\n## 요약(중단)\n${summarize(rows)}`)
        return
      }
      await sleep(GAP_MS)
    }
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
