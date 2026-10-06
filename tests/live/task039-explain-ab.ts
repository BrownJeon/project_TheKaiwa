/**
 * task-039(IMP-0025 방안 B) 실측 — 실제 Claude CLI(구독)로 A1 TALK·A2 CHAT 의 **교정 설명(explanationKo)·문법 포인트(grammarPoint)** 가 일상 회화 중심인지,
 * JLPT 식 설명이 새 칸 `correction.extraNoteKo` 로 가는지, 계약(ajv 1차 통과·재시도·검출률·원문 무수정·지연·조기 추출) 비악화인지 잰다.
 * **운영 DB 를 바꾸지 않는다**(합성 입력만 — `tests/prompts/fixtures/{talk-explanation-style,talk-corrections}.json`, connection 은 읽기만).
 *
 * - arm `head` = 커밋 HEAD 의 프롬프트 모듈 그대로. `git archive HEAD src` 로 푼 디렉토리(`BASE_SRC`, 기본 ~/.node-local/thekaiwa-head039/src)의 `prompts/{talk,chat}.ts` 를
 *   동적 import 하고, **그 HEAD 의 tutor.md**(`BASE_PERSONA`, 기본 ~/.node-local/thekaiwa-head039/tutor.md)를 `TUTOR_PERSONA_PATH` 로 가리킨 채 요청을 만든다(persona 가 이번 task 에서 바뀐다).
 * - arm `work` = 작업본(미러 src + 미러 .claude/agents/tutor.md) 그대로(`TUTOR_PERSONA_PATH` 해제).
 * - 두 팔은 항목마다 번갈아 먼저(교차) · 순차 실행 · 호출 사이 `GAP_MS` 대기 · 429/한도가 나오면 즉시 중단. 스트림에서 운영 `TurnAudio` 와 같은 리더로 조기 추출(style→첫 문장) 시각을 잰다.
 * - 결과 행에 **출력 원문 필드**(교정 전체·grammarPoint·replyJa)를 남겨 규칙 판정(`task039-style-classify.ts`)·눈 판정을 호출 없이 다시 돌릴 수 있다.
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task039-explain-ab.ts
 * 환경변수: SETS=style,corr,chat  RUNS=1  ARMS=head,work  ONLY=n5d01,n3x04  LEVELS=N3  KIND=DAILY|EXAM  GAP_MS=1500  RUN_START=1  OUT=/tmp/kaiwa-task039-ab.json
 *       SUMMARIZE_ONLY=a.json,b.json (호출 없이 합쳐 요약)  DUMP=1 (SUMMARIZE_ONLY 와 함께 — 눈 판정용 출력 목록)  BASE_SRC=…  BASE_PERSONA=…
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { llm, createJsonPathStreamReader } from '../../src/modules/engine'
import { StreamingSentenceSplitter } from '../../src/modules/conversation/orchestrator/sentences'
import { earlySentenceProblem } from '../../src/modules/conversation/orchestrator/earlyFilter'
import { countJaSentences } from '../../src/modules/conversation/structuredResponse/checks'
import type { TutorResponse } from '../../src/modules/conversation/structuredResponse/schemas'
import * as WORK_T from '../../src/modules/conversation/prompts/talk'
import * as WORK_C from '../../src/modules/conversation/prompts/chat'
import { flagsOf, verdictOf } from './task039-style-classify'

type Arm = 'head' | 'work'
type Kind = 'talk' | 'chat'
type SetId = 'style' | 'corr' | 'chat'
interface Item {
  id: string
  level: string
  input: string
  history: { role: 'user' | 'assistant'; content: string }[]
  hasError?: boolean
  expectedCorrected?: string
  errorType?: string
  kind?: 'DAILY' | 'EXAM'
}

const GAP_MS = Number(process.env.GAP_MS ?? 1500)
const OUT = process.env.OUT ?? '/tmp/kaiwa-task039-ab.json'
const ONLY = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const ARMS = (process.env.ARMS ?? 'head,work').split(',').map((s) => s.trim()) as Arm[]
const SETS = (process.env.SETS ?? 'style,corr,chat').split(',').map((s) => s.trim()) as SetId[]
const RUNS = Number(process.env.RUNS ?? 1)
const RUN_START = Number(process.env.RUN_START ?? 1)
const LEVELS = process.env.LEVELS?.split(',').map((s) => s.trim()).filter(Boolean)
const KIND_FILTER = process.env.KIND
const SUMMARIZE_ONLY = process.env.SUMMARIZE_ONLY?.split(',').map((s) => s.trim()).filter(Boolean)
const BASE_SRC = process.env.BASE_SRC ?? join(process.env.HOME ?? '', '.node-local/thekaiwa-head039/src')
const BASE_PERSONA = process.env.BASE_PERSONA ?? join(process.env.HOME ?? '', '.node-local/thekaiwa-head039/tutor.md')

const load = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures', f), 'utf8')) as { items: (Omit<Item, 'history'> & { history?: Item['history'] })[] }
const withHistory = (xs: ReturnType<typeof load>['items']): Item[] => xs.map((x) => ({ ...x, history: x.history ?? [] }))
const styleItems = withHistory(load('talk-explanation-style.json').items)
const corrItems = withHistory(load('talk-corrections.json').items)
const chatItems = styleItems.filter((x) => /0[1-4]$/.test(x.id))
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
  level: string
  itemKind?: 'DAILY' | 'EXAM'
  run: number
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  personaChars?: number
  outChars?: number
  raw1Chars?: number
  streamed?: boolean
  convKeys?: string[]
  replySentences?: number
  styleMs?: number | null
  firstSentenceMs?: number | null
  earlyProblem?: string | null
  earlyPrefixOk?: boolean
  styleBeforeSentence?: boolean
  hasError?: boolean
  detected?: boolean
  originalUnchanged?: boolean | null
  correctedMatch?: boolean | null
  typeMatch?: boolean | null
  /** 출력 원문(눈 판정·규칙 재판정용). */
  out?: { explanationKo: string | null; extraNoteKo: string | null; corrected: string | null; errorType: string | null; severity: string | null; grammarPoint: string | null; replyJa: string; extraKeyPresent: boolean; nProposals: number }
  retryRaw?: string
  error?: string
}

function buildReq(arm: Arm, kind: Kind, it: Item) {
  const b = arm === 'head' ? HEAD : WORK
  const input = { todayKst: '2026-10-06', learner: { ...learnerBase, level: it.level }, history: it.history, text: it.input }
  if (arm === 'head') process.env.TUTOR_PERSONA_PATH = BASE_PERSONA
  else delete process.env.TUTOR_PERSONA_PATH
  const req = kind === 'talk' ? b.buildTalkRequest({ ...input, sceneCap: 2 }) : b.buildChatRequest(input)
  delete process.env.TUTOR_PERSONA_PATH
  const hasExtra = /extraNoteKo/.test((req as { system: string }).system) || /extraNoteKo/.test(JSON.stringify((req as { jsonSchema: unknown }).jsonSchema))
  if (arm === 'head' && hasExtra) throw new Error('head 팔에 extraNoteKo 가 있다 — BASE_SRC 확인')
  if (process.env.EXPECT_EXTRA !== '0' && arm === 'work' && kind === 'talk' && !hasExtra) throw new Error('work 팔 TALK 에 extraNoteKo 가 없다(EXPECT_EXTRA=0 으로 끌 수 있음)')
  return req
}

async function run(kind: Kind, set: SetId, arm: Arm, it: Item, n: number): Promise<Row> {
  const base: Row = { kind, set, arm, id: it.id, level: it.level, itemKind: it.kind, run: n, ok: false, ms: 0, hasError: it.hasError }
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
    const d = r.data
    const c = d.correction as (TutorResponse['correction'] & { extraNoteKo?: string | null }) | null
    const row: Row = {
      ...base, ok: true, ms: r.elapsedMs, attempts: r.attempts, promptChars: r.promptChars, personaChars: req.persona?.prompt.length,
      outChars: JSON.stringify(d).length, raw1Chars: raws[1]?.length ?? 0, streamed: deltas > 0, convKeys: Object.keys(d.conversation),
      replySentences: countJaSentences(d.conversation.replyJa), styleMs, firstSentenceMs, earlyProblem,
      earlyPrefixOk: firstSentence !== null ? d.conversation.replyJa.trim().startsWith(firstSentence) : undefined,
      styleBeforeSentence: styleMs !== null && firstSentenceMs !== null ? styleMs <= firstSentenceMs : undefined,
      out: {
        explanationKo: c?.explanationKo ?? null, extraNoteKo: c?.extraNoteKo ?? null, corrected: c?.corrected ?? null, errorType: c?.errorType ?? null, severity: c?.severity ?? null,
        grammarPoint: d.learning?.grammarPoint ?? null, replyJa: d.conversation.replyJa, extraKeyPresent: c ? 'extraNoteKo' in c : false, nProposals: d.proposals?.length ?? 0,
      },
    }
    if (kind === 'talk') {
      row.detected = Boolean(c)
      row.originalUnchanged = c ? c.original === it.input : null
      row.correctedMatch = c && it.expectedCorrected ? norm(c.corrected) === norm(it.expectedCorrected) : null
      row.typeMatch = c && it.errorType ? c.errorType === it.errorType : null
    }
    if (r.attempts === 2) row.retryRaw = (raws[1] ?? '').slice(0, 700)
    return row
  } catch (e) {
    const err = e as Error
    return { ...base, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 300)}`, retryRaw: (raws[1] ?? '').slice(0, 700) }
  }
}

// ── 통계 ────────────────────────────────────────────────────────────────────
const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)] : NaN)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const frac = (a: number, b: number) => (b ? `${a}/${b} (${((a / b) * 100).toFixed(0)}%)` : '-')
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function permP(a: number[], b: number[], stat: (x: number[]) => number, iters = 20_000): number {
  if (a.length < 3 || b.length < 3) return NaN
  const obs = Math.abs(stat(a) - stat(b))
  const all = [...a, ...b]
  const rnd = mulberry32(39)
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
/** 두 비율 차이(독립)의 Fisher 정확검정 양측 p — 작은 표본용. */
function fisherP(a: number, an: number, b: number, bn: number): number {
  const lf = (n: number) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s }
  const logC = (n: number, k: number) => lf(n) - lf(k) - lf(n - k)
  const n = an + bn
  const k = a + b
  const pObs = Math.exp(logC(an, a) + logC(bn, b) - logC(n, k))
  let p = 0
  for (let x = Math.max(0, k - bn); x <= Math.min(an, k); x++) {
    const px = Math.exp(logC(an, x) + logC(bn, k - x) - logC(n, k))
    if (px <= pObs + 1e-12) p += px
  }
  return Math.min(1, p)
}

function styleTable(rows: Row[], label: string, filter: (r: Row) => boolean): string[] {
  const out: string[] = [`\n#### ${label}`]
  out.push('| arm | n | 교정 있음 | 메인 설명 JLPT식(explJlpt) | 설명 일상표지(explEveryday) | 설명 급수·시험표지 | 설명 강한 용어 | 설명 약한 용어 | grammarPoint 용어라벨(gpTerm) | 메인 JLPT식(어느 한쪽) | extraNoteKo 비null | extra 안 JLPT식 | explanationKo 평균자 | extra 평균자 |')
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const arm of ARMS) {
    const a = rows.filter((r) => r.arm === arm && r.ok && r.out && filter(r))
    if (!a.length) continue
    const withC = a.filter((r) => r.out!.explanationKo)
    const v = a.map((r) => ({ r, v: verdictOf({ explanationKo: r.out!.explanationKo, grammarPoint: r.out!.grammarPoint, extraNoteKo: r.out!.extraNoteKo }), f: flagsOf(r.out!.explanationKo) }))
    const cv = v.filter((x) => x.r.out!.explanationKo)
    const ex = v.filter((x) => x.v.extraPresent)
    out.push(
      `| ${arm} | ${a.length} | ${frac(withC.length, a.length)} | ${frac(cv.filter((x) => x.v.explJlpt).length, cv.length)} | ${frac(cv.filter((x) => x.v.explEveryday).length, cv.length)} | ${frac(cv.filter((x) => x.f.examMarker).length, cv.length)} | ${frac(cv.filter((x) => x.f.strongTerm).length, cv.length)} | ${frac(cv.filter((x) => x.f.weakTerm).length, cv.length)} | ${frac(v.filter((x) => x.v.gpTerm).length, v.filter((x) => x.r.out!.grammarPoint).length)} | ${frac(v.filter((x) => x.v.mainJlpt).length, v.length)} | ${frac(ex.length, cv.length)} | ${frac(ex.filter((x) => x.v.extraJlpt).length, ex.length)} | ${mean(cv.map((x) => x.r.out!.explanationKo!.length)).toFixed(0)} | ${ex.length ? mean(ex.map((x) => x.r.out!.extraNoteKo!.length)).toFixed(0) : '-'} |`,
    )
  }
  const h = rows.filter((r) => r.arm === 'head' && r.ok && r.out && r.out.explanationKo && filter(r))
  const w = rows.filter((r) => r.arm === 'work' && r.ok && r.out && r.out.explanationKo && filter(r))
  if (h.length && w.length) {
    const hj = h.filter((r) => flagsOf(r.out!.explanationKo).jlptStyle).length
    const wj = w.filter((r) => flagsOf(r.out!.explanationKo).jlptStyle).length
    out.push(`- 메인 설명 JLPT식 비율 차이(work−head): ${((wj / w.length - hj / h.length) * 100).toFixed(1)}%p — Fisher p=${fisherP(hj, h.length, wj, w.length).toFixed(3)}`)
  }
  return out
}

function summarize(rows: Row[]): string {
  const out: string[] = []
  for (const g of [
    { label: 'TALK · 스타일 세트(60문장: N5·N4·N3 × 일상/시험식)', kind: 'talk' as Kind, sets: ['style'] as SetId[] },
    { label: 'TALK · 교정 검출 세트(talk-corrections 20문장 = 오류 16 + 정답 4)', kind: 'talk' as Kind, sets: ['corr'] as SetId[] },
    { label: 'CHAT · 스타일 24문장(교정 없음, grammarPoint 만)', kind: 'chat' as Kind, sets: ['chat'] as SetId[] },
  ]) {
    const sub = rows.filter((r) => r.kind === g.kind && g.sets.includes(r.set))
    if (!sub.length) continue
    out.push(`\n### ${g.label}`)
    out.push('| arm | n | 성공 | FAILED | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | ms 평균 | 12s 초과 | 출력JSON 평균자 | 원문1 평균자 | persona 자 | prompt 자 | replyJa 문장 평균 |')
    out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = sub.filter((r) => r.arm === arm)
      if (!a.length) continue
      const ok = a.filter((r) => r.ok)
      const ms = ok.map((r) => r.ms)
      out.push(
        `| ${arm} | ${a.length} | ${frac(ok.length, a.length)} | ${a.length - ok.length} | ${frac(ok.filter((r) => r.attempts === 1).length, a.length)} | ${ok.filter((r) => r.attempts === 2).length} | ${pctl(ms, 0.5)} | ${pctl(ms, 0.95)} | ${mean(ms).toFixed(0)} | ${ms.filter((x) => x > 12_000).length} | ${mean(ok.map((r) => r.outChars ?? 0)).toFixed(1)} | ${mean(ok.map((r) => r.raw1Chars ?? 0)).toFixed(1)} | ${mean(ok.map((r) => r.personaChars ?? 0)).toFixed(0)} | ${mean(ok.map((r) => r.promptChars ?? 0)).toFixed(0)} | ${mean(ok.map((r) => r.replySentences ?? 0)).toFixed(2)} |`,
      )
    }
    for (const arm of ARMS) {
      const a = sub.filter((r) => r.arm === arm && r.ok && r.out)
      if (a.length) out.push(`- ${arm} proposals 제안 턴: ${frac(a.filter((r) => (r.out!.nProposals ?? 0) > 0).length, a.length)}`)
    }
    const h = sub.filter((r) => r.arm === 'head' && r.ok).map((r) => r.ms)
    const w = sub.filter((r) => r.arm === 'work' && r.ok).map((r) => r.ms)
    if (h.length && w.length) {
      const med = (x: number[]) => pctl(x, 0.5)
      out.push(`- ms 차이(work−head): p50 ${(med(w) - med(h)).toFixed(0)} (${(((med(w) - med(h)) / med(h)) * 100).toFixed(1)}%) · 평균 ${(mean(w) - mean(h)).toFixed(0)} · p95 ${(pctl(w, 0.95) - pctl(h, 0.95)).toFixed(0)} — 순열검정 p(중앙값)=${permP(h, w, med).toFixed(3)} · p(평균)=${permP(h, w, mean).toFixed(3)}`)
      const ho = sub.filter((r) => r.arm === 'head' && r.ok).map((r) => r.outChars ?? 0)
      const wo = sub.filter((r) => r.arm === 'work' && r.ok).map((r) => r.outChars ?? 0)
      out.push(`- 출력JSON 평균자 차이(work−head): ${(mean(wo) - mean(ho)).toFixed(1)}자 (${(((mean(wo) - mean(ho)) / mean(ho)) * 100).toFixed(1)}%)`)
    }
    if (g.sets[0] === 'style' || g.sets[0] === 'chat') {
      out.push(...styleTable(sub, '전체', () => true))
      for (const lv of ['N5', 'N4', 'N3']) out.push(...styleTable(sub, `수준 ${lv}`, (r) => r.level === lv))
      if (g.sets[0] === 'style') for (const k of ['DAILY', 'EXAM'] as const) out.push(...styleTable(sub, `종류 ${k}`, (r) => r.itemKind === k))
    }
  }
  const t = rows.filter((r) => r.kind === 'talk' && r.ok)
  if (t.length) {
    out.push('\n### 조기 추출(TALK 전체, 스트림 → speech.style 완료 · replyJa 첫 문장 확정)')
    out.push('| arm | n | 스트림 수신 | style 완료 p50 | 첫문장 확정 p50 | 첫문장 p95 | 필터 통과 | prefix 일치 | style 먼저 |')
    out.push('|---|---|---|---|---|---|---|---|---|')
    for (const arm of ARMS) {
      const a = t.filter((r) => r.arm === arm)
      if (!a.length) continue
      const fs = a.map((r) => r.firstSentenceMs).filter((x): x is number => typeof x === 'number')
      const st = a.map((r) => r.styleMs).filter((x): x is number => typeof x === 'number')
      out.push(
        `| ${arm} | ${a.length} | ${frac(a.filter((r) => r.streamed).length, a.length)} | ${pctl(st, 0.5)} | ${pctl(fs, 0.5)} | ${pctl(fs, 0.95)} | ${frac(a.filter((r) => r.firstSentenceMs != null && r.earlyProblem === null).length, a.length)} | ${frac(a.filter((r) => r.earlyPrefixOk).length, a.length)} | ${frac(a.filter((r) => r.styleBeforeSentence).length, a.length)} |`,
      )
    }
  }
  const cr = rows.filter((r) => r.kind === 'talk' && r.ok)
  if (cr.length) {
    out.push('\n### 교정 검출(talk 전체: corr 세트는 오류 16·정답 4, style 세트는 전부 오류)')
    out.push('| arm | set | 오류 검출 | 오탐(정답 교정) | 유형 일치 | 교정문 일치 | original 바이트 일치(검출분) | extraNoteKo 키 존재(교정 있는 행) |')
    out.push('|---|---|---|---|---|---|---|---|')
    for (const s of ['corr', 'style'] as SetId[]) {
      for (const arm of ARMS) {
        const a = cr.filter((r) => r.arm === arm && r.set === s)
        if (!a.length) continue
        const errs = a.filter((r) => r.hasError)
        const clean = a.filter((r) => !r.hasError)
        const det = a.filter((r) => r.detected)
        out.push(
          `| ${arm} | ${s} | ${frac(errs.filter((r) => r.detected).length, errs.length)} | ${clean.length ? frac(clean.filter((r) => r.detected).length, clean.length) : '-'} | ${frac(errs.filter((r) => r.typeMatch).length, errs.length)} | ${frac(errs.filter((r) => r.correctedMatch).length, errs.length)} | ${frac(det.filter((r) => r.originalUnchanged).length, det.length)} | ${frac(det.filter((r) => r.out?.extraKeyPresent).length, det.length)} |`,
        )
      }
    }
  }
  for (const r of rows.filter((x) => !x.ok)) out.push(`- 실패 ${r.kind}/${r.arm}/${r.id}#${r.run}: ${r.error}`)
  for (const r of rows.filter((x) => x.ok && x.attempts === 2)) out.push(`- 재시도 ${r.kind}/${r.arm}/${r.id}#${r.run} ms=${r.ms} raw1=${JSON.stringify(r.retryRaw)}`)
  return out.join('\n')
}

function dump(rows: Row[]): string {
  const out: string[] = []
  for (const r of rows.filter((x) => x.ok && x.out).sort((a, b) => a.id.localeCompare(b.id) || a.arm.localeCompare(b.arm))) {
    const o = r.out!
    out.push(`[${r.arm}] ${r.set}/${r.id}#${r.run} ${r.level}${r.itemKind ? '/' + r.itemKind : ''} sev=${o.severity ?? '-'} type=${o.errorType ?? '-'}\n  GP : ${o.grammarPoint ?? '(null)'}\n  EXP: ${o.explanationKo ?? '(교정 없음)'}\n  EXT: ${o.extraNoteKo ?? '(null)'}`)
  }
  return out.join('\n')
}

interface Job { kind: Kind; set: SetId; it: Item; n: number; order: Arm[] }

function planJobs(): Job[] {
  const jobs: Job[] = []
  const pick = (xs: Item[]) => xs.filter((x) => (!ONLY || ONLY.includes(x.id)) && (!LEVELS || LEVELS.includes(x.level)) && (!KIND_FILTER || x.kind === KIND_FILTER))
  const order = (i: number, n: number): Arm[] => ((i + n) % 2 === 0 ? ['head', 'work'] : ['work', 'head']).filter((a) => ARMS.includes(a as Arm)) as Arm[]
  const add = (set: SetId, kind: Kind, items: Item[]) => {
    for (let n = RUN_START; n < RUN_START + RUNS; n++) pick(items).forEach((it, i) => jobs.push({ kind, set, it, n, order: order(i, n) }))
  }
  if (SETS.includes('style')) add('style', 'talk', styleItems)
  if (SETS.includes('corr')) add('corr', 'talk', corrItems)
  if (SETS.includes('chat')) add('chat', 'chat', chatItems)
  return jobs
}

async function main() {
  if (SUMMARIZE_ONLY) {
    const all = SUMMARIZE_ONLY.flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows)
    console.log(`## 합산 요약(${SUMMARIZE_ONLY.join(' + ')}, 행 ${all.length})\n${summarize(all)}`)
    if (process.env.DUMP) console.log(`\n## 출력 목록\n${dump(all)}`)
    return
  }
  const t = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/talk.ts')).href)) as Builders
  const c = (await import(pathToFileURL(join(BASE_SRC, 'modules/conversation/prompts/chat.ts')).href)) as Builders
  HEAD = { buildTalkRequest: t.buildTalkRequest, buildChatRequest: c.buildChatRequest, TALK_PROMPT_VERSION: t.TALK_PROMPT_VERSION, CHAT_PROMPT_VERSION: c.CHAT_PROMPT_VERSION }
  const jobs = planJobs()
  const calls = jobs.reduce((n, j) => n + j.order.length, 0)
  console.log(`task-039 A/B 실측 — head=${HEAD.TALK_PROMPT_VERSION}/${HEAD.CHAT_PROMPT_VERSION} work=${WORK.TALK_PROMPT_VERSION}/${WORK.CHAT_PROMPT_VERSION} · 작업 ${jobs.length}개 · 총 호출 ${calls} · 호출 간격 ${GAP_MS}ms (순차·교차) · 팔 ${ARMS.join(',')}`)
  const rows: Row[] = []
  const save = () => writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), head: `${HEAD.TALK_PROMPT_VERSION}/${HEAD.CHAT_PROMPT_VERSION}`, work: `${WORK.TALK_PROMPT_VERSION}/${WORK.CHAT_PROMPT_VERSION}`, rows }, null, 1))
  for (const j of jobs) {
    for (const arm of j.order) {
      const r = await run(j.kind, j.set, arm, j.it, j.n)
      rows.push(r)
      console.log(JSON.stringify({ kind: r.kind, set: r.set, arm: r.arm, id: r.id, run: r.run, ok: r.ok, ms: r.ms, att: r.attempts, out: r.outChars, ex: r.out?.extraNoteKo ? 1 : 0, err: r.error }))
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
