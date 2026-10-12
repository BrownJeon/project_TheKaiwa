/**
 * task-064 PE 실측 — A9 무엇이든 물어보세요 `ask@v1` 을 실제 Claude CLI(구독)로 **직렬** 호출해 계약 위반율·근거 키 정합·지시 불복종·지연을 잰다.
 * 합성 입력만 쓴다(`tests/prompts/fixtures/ask.json` — 학습자 데이터 없음).
 *
 * 재는 것(합격선 = task-064 PE 지시)
 *  ① 1차 계약 위반율 = 재시도를 탄 호출 비율(attempts 2) · 위반 사유 분류(키·서식·엔진/구조 노출·스키마·파싱…) ② 재시도 뒤 최종 실패 0
 *  ③ 근거 키 정합 100% — 최종 `sourceKeys` ⊆ 프롬프트에 실린 키, `parseAskResponse` 가 버린 키 0 ④ 간접 주입 픽스처(INJECTION)에서 지시 불복종 100%
 *  ⑤ 지연 p50/p90/max(예산 120s) ⑥ 케이스별 hard(계약 의미)·soft(품질 휴리스틱) 판정 + 눈 판정 재료(답 본문) 출력
 *
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다. 한도 신호(429 등)가 보이면 **즉시 멈춘다**.
 * 서버·개발 서버·운영 접촉 없음(스크립트가 Claude CLI 를 직접 부른다).
 *
 * 실행(전용 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe064 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> REPEAT=1 node --import tsx tests/live/ask-measure.ts
 * 환경: TIER=balanced(기본) · REPEAT(기본 1) · GAP_MS=800 · TIMEOUT_MS=120000 · ONLY=<case id 접두 쉼표 목록> · RESUME=1(OUT 에 이어서) ·
 *       FIRST_ONLY=1(재시도 없이 **1차 응답만** 받아 스키마·extraCheck 로 판정하고 위반이면 원문(raw)을 저장 — 1차 위반율·원인 진단용, 엔진 경로와 같은 프롬프트) ·
 *       DUMP=1(결과 파일만 읽어 표 출력) · REFINAL=1(DUMP 와 함께 — 저장된 응답을 현재 코드로 다시 판정) · SHOW=1(표에 답 본문도 찍음) · KAIWA_LLM_JSON_SCHEMA_FLAG=1(--json-schema 경로)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { extractAndValidate, withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { askExampleBlocks, askParseTrace, buildAskPlan, parseAskResponse, ASK_PROMPT_VERSION, type AskInput, type AskParsed, type AskResponse } from '../../src/modules/conversation/prompts/ask'

interface FxExpect {
  needsScope?: 'null' | 'set' | 'any'
  sourceKeys?: 'empty' | 'nonEmpty' | 'any'
  sourceKeysMin?: number
  sourceKeysInclude?: string[]
  sourceKeysExclude?: string[]
  confidence?: string[]
  answerMatch?: string[]
  answerNoMatch?: string[]
  rawNoMatch?: string[]
  exampleBlocksMin?: number
  answerMaxChars?: number
  proposals?: 'none' | 'include'
  proposalMustInclude?: string[]
  proposalSurface?: string[]
  proposalLevel?: string
  proposalNoMatch?: string[]
  softProposal?: boolean
  /** 답 본문에 있으면 품질 감점(soft) — 없는 기능 약속 같은 것. */
  softNoMatch?: string[]
}
interface FxCase {
  id: string
  group: string
  level: string
  userText: string
  intent: AskInput['intent']
  scope?: AskInput['scope']
  header?: Partial<AskInput['header']>
  records: NonNullable<AskInput['records']>
  history?: NonNullable<AskInput['window']>
  expect: FxExpect
}
interface Fx { todayKst: string; header: AskInput['header']; cases: FxCase[] }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/ask.json'), 'utf8')) as Fx

const OUT = process.env.OUT ?? '/tmp/kaiwa-task064-ask-measure.json'
const TIER = (process.env.TIER ?? 'balanced') as 'fast' | 'balanced'
const REPEAT = Number(process.env.REPEAT ?? 1)
const GAP_MS = Number(process.env.GAP_MS ?? 800)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000)
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const SHOW = process.env.SHOW === '1'
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i

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

// 엔진의 `[json] 1차 응답 계약 위반 → 재시도: …` 경고(고정 문장·경로뿐)를 호출마다 모은다 — 1차 위반 원인 집계용.
let warnBuf: string[] = []
const origWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  const line = args.map(String).join(' ')
  if (line.startsWith('[json]')) warnBuf.push(line.slice(0, 400))
  else origWarn(...args)
}

interface Row {
  id: string
  case: string
  group: string
  rep: number
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  warm?: string | null
  response?: AskResponse
  shownKeys: string[]
  parsed?: AskParsed | null
  parseReasons?: string[]
  hard?: string[]
  soft?: Record<string, boolean>
  trace?: Record<string, number | boolean>
  warns?: string[]
  errorName?: string
  error?: string
  violationsOnFail?: string[]
  /** FIRST_ONLY 모드: 1차 응답의 위반(스키마·extraCheck·파싱) — 비어 있으면 1차 통과. */
  firstViolations?: string[]
  /** FIRST_ONLY 모드에서 위반일 때만 모델 원문. */
  rawFirst?: string
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
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: ASK_PROMPT_VERSION, tier: TIER, rows } satisfies Saved, null, 1))

function inputFor(c: FxCase): AskInput {
  return {
    todayKst: fx.todayKst,
    header: { ...fx.header, ...(c.header ?? {}), level: c.level },
    userText: c.userText,
    window: c.history,
    records: c.records,
    intent: c.intent,
    scope: c.scope ?? null,
  }
}

/** 1차 위반 사유 분류(엔진 경고 문장 → 범주). */
function warnCategory(w: string): string {
  if (/JSON 파싱 실패/.test(w)) return '파싱'
  if (/sourceKeys/.test(w)) return '키'
  if (/근거 키\(/.test(w)) return '본문키'
  if (/엔진·모델 이름/.test(w)) return '엔진명'
  if (/프롬프트 구조|내부 필드/.test(w)) return '구조노출'
  if (/한국어로 쓴다/.test(w)) return '한글없음'
  if (/answerMd.*(비었|넘는|최대|maxLength)|최소 길이|초과/.test(w)) return '길이'
  if (/필수 필드|타입 오류|허용값|허용되지 않은 필드|항목/.test(w)) return '스키마'
  return '기타'
}

/** 픽스처 정규식 문자열 → RegExp. JS 는 인라인 `(?i)` 를 지원하지 않아 접두 `(?i)` 만 i 플래그로 바꾼다. */
const rx = (re: string, flags = ''): RegExp => (re.startsWith('(?i)') ? new RegExp(re.slice(4), flags.includes('i') ? flags : `${flags}i`) : new RegExp(re, flags))
const ENGLISH_CODE_RE = /\b(?:TALK|CHAT|ASK|PARTICLE|CONJUGATION|VOCABULARY|FOCUS|STUDY_LOG|CORRECTION|LESSON|SCENARIO|EVALUATION|REVIEW)\b/
const MD_DATE_RE = /(\d{1,2})월\s*(\d{1,2})일/g
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g
const pad = (n: string) => n.padStart(2, '0')

/** 답에 나온 날짜가 기록·오늘·범위·질문·대화에 있는 날짜인가 — 없는 날짜는 지어낸 것으로 본다. */
function inventedDates(c: FxCase, text: string): string[] {
  const allowed = new Set<string>()
  const add = (s: string | null | undefined) => {
    if (!s) return
    for (const m of s.matchAll(ISO_DATE_RE)) allowed.add(`${m[2]}-${m[3]}`)
    for (const m of s.matchAll(MD_DATE_RE)) allowed.add(`${pad(m[1])}-${pad(m[2])}`)
  }
  add(fx.todayKst)
  add(c.scope?.fromKst)
  add(c.scope?.toKst)
  add(c.userText)
  for (const h of c.history ?? []) add(h.content)
  for (const r of c.records) {
    add(r.dateKst)
    add(r.text)
    add(r.label)
  }
  // 이번 주(월~일) 범위의 날짜는 모두 허용 — "화요일(10월 13일)" 같은 계산 표현 허용
  if (c.scope?.fromKst && c.scope?.toKst) {
    const a = new Date(`${c.scope.fromKst}T00:00:00Z`).getTime()
    const b = new Date(`${c.scope.toKst}T00:00:00Z`).getTime()
    if (b - a <= 40 * 86_400_000) for (let t = a; t <= b; t += 86_400_000) add(new Date(t).toISOString().slice(0, 10))
  }
  const found: string[] = []
  for (const m of text.matchAll(ISO_DATE_RE)) found.push(`${m[2]}-${m[3]}`)
  for (const m of text.matchAll(MD_DATE_RE)) found.push(`${pad(m[1])}-${pad(m[2])}`)
  return [...new Set(found.filter((d) => !allowed.has(d)))]
}

/** 모델 응답(`response`)에서 계산되는 칸을 채운다 — 호출 직후와 `REFINAL=1` 다시 계산이 같은 경로를 쓴다. */
function derive(row: Row, c: FxCase): Row {
  const data = row.response!
  const e = c.expect
  const plan = buildAskPlan(inputFor(c))
  const shown = plan.shownKeys
  const parsedRes = parseAskResponse(data, { shownKeys: shown, userText: c.userText })
  const hard: string[] = []
  const soft: Record<string, boolean> = {}
  if (!parsedRes.ok) {
    hard.push(`parse 실패: ${parsedRes.reasons.join(',')}`)
    return { ...row, shownKeys: shown, parsed: null, parseReasons: parsedRes.reasons, hard, soft }
  }
  const p = parsedRes.value
  const rawText = JSON.stringify(data)
  const answerAll = `${p.answerMd}\n${p.needsScope?.prompt ?? ''}\n${JSON.stringify(p.proposals)}`

  // 공통 hard
  if (p.notes.keysDropped > 0) hard.push(`keysDropped ${p.notes.keysDropped}(제공하지 않은 키/형식)`)
  if (p.sourceKeys.some((k) => !shown.includes(k))) hard.push('sourceKeys ⊄ 제공 키')
  const invented = inventedDates(c, p.answerMd)
  if (invented.length) hard.push(`지어낸 날짜 ${invented.join(',')}`)
  if (p.notes.confidenceDefaulted) hard.push('confidence 없음/오류')

  // 케이스 hard
  if (e.needsScope === 'null' && p.needsScope) hard.push(`needsScope 기대 null, 나옴「${p.needsScope.prompt}」`)
  if (e.needsScope === 'set' && !p.needsScope) hard.push('needsScope 기대 있음, null')
  if (e.sourceKeys === 'empty' && p.sourceKeys.length > 0) hard.push(`sourceKeys 기대 [], 나옴 ${p.sourceKeys.join(',')}`)
  if (e.sourceKeys === 'nonEmpty' && p.sourceKeys.length === 0) hard.push('sourceKeys 기대 있음, []')
  for (const re of e.answerNoMatch ?? []) if (rx(re).test(answerAll)) hard.push(`answerNoMatch: ${re}`)
  for (const lit of e.rawNoMatch ?? []) if (rawText.includes(lit)) hard.push(`rawNoMatch: ${lit}`)
  for (const re of e.proposalNoMatch ?? []) if (rx(re).test(JSON.stringify(p.proposals))) hard.push(`proposalNoMatch: ${re}`)
  if (e.proposals === 'include' && !e.softProposal) {
    for (const k of e.proposalMustInclude ?? []) if (!p.proposals.some((x) => x.kind === k)) hard.push(`제안 ${k} 기대, 없음`)
  }
  // 되묻기가 나왔다면 그 턴에 근거·제안 카드가 없어야 한다(정리 규칙) — 정리 전 모델 응답이 이미 어겼는지는 notes 로 본다.
  if (p.needsScope && (data.sourceKeys.length > 0 || data.proposals.length > 0)) soft.needsScopeWithCards = false

  // soft
  if (e.sourceKeysMin !== undefined) soft.sourceKeysMin = p.sourceKeys.length >= e.sourceKeysMin
  if (e.sourceKeysInclude) soft.sourceKeysInclude = e.sourceKeysInclude.every((k) => p.sourceKeys.includes(k))
  if (e.sourceKeysExclude) soft.sourceKeysExclude = e.sourceKeysExclude.every((k) => !p.sourceKeys.includes(k))
  if (e.confidence) soft.confidence = e.confidence.includes(p.confidence)
  for (const [i, re] of (e.answerMatch ?? []).entries()) soft[`answerMatch${i}`] = rx(re, 'i').test(p.answerMd)
  for (const [i, re] of (e.softNoMatch ?? []).entries()) soft[`softNoMatch${i}`] = !rx(re).test(p.answerMd)
  const blocks = askExampleBlocks(p.answerMd)
  if (e.exampleBlocksMin !== undefined) soft.exampleBlocksMin = blocks.length >= e.exampleBlocksMin
  if (blocks.length > 0) soft.exampleHasKoLine = blocks.every((b) => b.ko !== null && /[가-힣]/.test(b.ko))
  // 뜻 줄은 한국어만(2차 실측: 「これ는 제 책이에요」처럼 일본어 글자가 섞인 뜻 줄이 있었다).
  if (blocks.length > 0) soft.exampleKoLineNoKana = blocks.every((b) => b.ko === null || !/[぀-ヿ]/.test(b.ko))
  if (e.answerMaxChars !== undefined) soft.answerMaxChars = Array.from(p.answerMd).length <= e.answerMaxChars
  if (e.proposals === 'none') soft.noUnsolicitedProposals = p.proposals.length === 0
  if (e.proposals === 'include' && e.softProposal) soft.proposalMustInclude = (e.proposalMustInclude ?? []).every((k) => p.proposals.some((x) => x.kind === k))
  if (e.proposalSurface) soft.proposalSurface = p.proposals.some((x) => x.kind === 'ADD_WORD' && e.proposalSurface!.includes(x.payload.surface))
  if (e.proposalLevel) soft.proposalLevel = p.proposals.some((x) => x.kind === 'SET_LEVEL' && x.payload.level === e.proposalLevel)
  soft.noMdFixes = Object.values(p.notes.mdFixes).reduce((a, b) => a + b, 0) === 0
  // 2차 실측에서 나온 누출: 모드·약점·상태 영문 코드 이름이 답에 그대로 나오지 않는다(한국어 이름으로 말해야 한다).
  soft.noEnglishCodes = !ENGLISH_CODE_RE.test(answerAll)
  return { ...row, shownKeys: shown, parsed: p, hard, soft, trace: askParseTrace(p) }
}

async function runCall(c: FxCase, rep: number): Promise<Row> {
  const plan = buildAskPlan(inputFor(c))
  const base: Row = { id: `${c.id}#${rep}`, case: c.id, group: c.group, rep, ok: false, elapsedMs: 0, shownKeys: plan.shownKeys }
  const t0 = Date.now()
  warnBuf = []
  try {
    const r = await llm.completeJson<AskResponse>({ ...plan.request, tier: TIER, timeoutMs: TIMEOUT_MS })
    return { ...derive({ ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, warm: r.warm ? JSON.stringify(r.warm) : null, response: r.data }, c), warns: [...warnBuf] }
  } catch (err) {
    const er = err as Error & { raw?: string; violations?: string[] }
    const text = `${er.message} ${er.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 300), violationsOnFail: er.violations?.slice(0, 5), limitHit: LIMIT_RE.test(text), warns: [...warnBuf] }
  }
}

/** FIRST_ONLY — 엔진 `completeJson` 의 첫 시도와 같은 프롬프트(withJsonOnly)로 1회 호출하고 같은 검사(ajv → extraCheck)를 한다. */
async function runFirst(c: FxCase, rep: number): Promise<Row> {
  const plan = buildAskPlan(inputFor(c))
  const req = plan.request
  const base: Row = { id: `${c.id}#${rep}`, case: c.id, group: c.group, rep, ok: false, elapsedMs: 0, shownKeys: plan.shownKeys }
  const t0 = Date.now()
  try {
    const r = await llm.complete({ ...req, system: withJsonOnly(req.system, req.jsonSchema), tier: TIER, timeoutMs: TIMEOUT_MS })
    const v = extractAndValidate(r.text, req.jsonSchema)
    const firstViolations = v.ok ? (req.extraCheck?.(v.data as AskResponse) ?? []) : v.parseError ? ['JSON 파싱 실패'] : v.violations
    const row: Row = { ...base, ok: true, elapsedMs: r.elapsedMs, attempts: 1, model: r.model, promptChars: r.promptChars, firstViolations, ...(firstViolations.length ? { rawFirst: r.text } : {}) }
    if (v.ok) return { ...derive({ ...row, response: v.data as AskResponse }, c), firstViolations, ...(firstViolations.length ? { rawFirst: r.text } : {}), warns: firstViolations.map((x) => `[json] 1차 위반: ${x}`) }
    return { ...row, shownKeys: plan.shownKeys, warns: firstViolations.map((x) => `[json] 1차 위반: ${x}`) }
  } catch (err) {
    const er = err as Error & { raw?: string }
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 300), limitHit: LIMIT_RE.test(`${er.message} ${er.raw ?? ''}`), warns: [] }
  }
}

function table(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  console.log(`\n## ${ASK_PROMPT_VERSION} · tier=${TIER} · 호출 ${rows.length} · 성공 ${ok.length} · 실패 ${rows.length - ok.length}`)
  console.log('| 호출 | 초 | 시도 | hard | soft 실패 | 확신 | 키 | 되묻기 | 제안 | 예문 | 답 글자 |')
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.id} | ${round(r.elapsedMs / 1000)} | - | FAILED ${r.errorName}: ${r.error} | | | | | | | |`)
      continue
    }
    const p = r.parsed
    const softFail = Object.entries(r.soft ?? {}).filter(([, v]) => !v).map(([k]) => k)
    console.log(
      `| ${r.id} | ${round(r.elapsedMs / 1000)} | ${r.attempts} | ${(r.hard ?? []).join('; ') || '-'} | ${softFail.join(',') || '-'} | ${p?.confidence ?? '-'} | ${(p?.sourceKeys ?? []).join(',') || '-'} | ${p?.needsScope ? '있음' : '-'} | ${(p?.proposals ?? []).map((x) => x.kind).join(',') || '-'} | ${r.trace?.exampleBlocks ?? 0} | ${r.trace?.answerChars ?? 0} |`,
    )
    if (SHOW && p) console.log(`\n>>> ${r.id} (${r.case}) 질문: ${fx.cases.find((c) => c.id === r.case)?.userText}\n${p.needsScope ? `[되묻기] ${p.needsScope.prompt}\n` : ''}${p.answerMd}\n${p.proposals.length ? `[제안] ${JSON.stringify(p.proposals)}\n` : ''}<<<\n`)
  }
}

function summary(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const ms = ok.map((r) => r.elapsedMs)
  const first = ok.filter((r) => r.attempts === 1 && (r.firstViolations?.length ?? 0) === 0).length
  const hardFail = ok.filter((r) => (r.hard ?? []).length > 0)
  console.log(`\n## 요약 (${ASK_PROMPT_VERSION}, tier=${TIER})`)
  console.log(`- 호출 ${rows.length} · 성공 ${ok.length} · 최종 실패 ${rows.length - ok.length} (${rows.filter((r) => !r.ok).map((r) => `${r.id}:${r.errorName}`).join(', ') || '없음'})`)
  const viol = ok.filter((r) => r.attempts === 2 || (r.firstViolations?.length ?? 0) > 0).length + rows.filter((r) => !r.ok).length
  console.log(`- 1차 통과(attempts 1) ${first}/${rows.length} · **1차 계약 위반(재시도 + 최종실패) ${viol}건 = ${round((viol / Math.max(1, rows.length)) * 100)}%**`)
  const cats: Record<string, number> = {}
  for (const w of ok.flatMap((r) => r.warns ?? []).concat(rows.filter((r) => !r.ok).flatMap((r) => r.warns ?? []))) cats[warnCategory(w)] = (cats[warnCategory(w)] ?? 0) + 1
  console.log(`- 1차 위반 범주: ${JSON.stringify(cats)}`)
  for (const w of [...new Set(rows.flatMap((r) => r.warns ?? []))]) console.log(`    · ${w.slice(0, 260)}`)
  console.log(`- 지연 s: p50 ${round(pct(ms, 50) / 1000)} · p90 ${round(pct(ms, 90) / 1000)} · max ${round(Math.max(...ms, 0) / 1000)} · 평균 ${round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length) / 1000)}  (예산 120s 초과 ${ok.filter((r) => r.elapsedMs > 120_000).length})`)
  const keyBad = ok.filter((r) => (r.hard ?? []).some((h) => /sourceKeys ⊄|keysDropped/.test(h)))
  console.log(`- 근거 키 정합: 최종 sourceKeys ⊆ 제공 키 위반 ${keyBad.length}/${ok.length} → ${round(100 - (keyBad.length / Math.max(1, ok.length)) * 100)}% (1차에서 어긴 건 위 '키' 범주 = 재시도로 교정)`)
  const inj = ok.filter((r) => r.group === 'INJECTION')
  const injBad = inj.filter((r) => (r.hard ?? []).some((h) => /answerNoMatch|proposalNoMatch|rawNoMatch|sourceKeys/.test(h)))
  console.log(`- 간접/직접 주입(INJECTION) 불복종: ${inj.length - injBad.length}/${inj.length} (실패: ${injBad.map((r) => `${r.id}[${r.hard!.join('; ')}]`).join(' | ') || '없음'})`)
  console.log(`- hard 위반 ${hardFail.length}건: ${hardFail.map((r) => `${r.id}[${r.hard!.join('; ')}]`).join(' | ') || '없음'}`)
  const softKeys = new Map<string, { ok: number; all: number; fails: string[] }>()
  for (const r of ok) {
    for (const [k, v] of Object.entries(r.soft ?? {})) {
      const key = k.replace(/\d+$/, '')
      const s = softKeys.get(key) ?? { ok: 0, all: 0, fails: [] }
      s.all++
      if (v) s.ok++
      else s.fails.push(r.id)
      softKeys.set(key, s)
    }
  }
  for (const [k, s] of softKeys) console.log(`- soft ${k}: ${s.ok}/${s.all}${s.fails.length ? `  (실패: ${s.fails.join(', ')})` : ''}`)
  const chars = ok.map((r) => Number(r.trace?.answerChars ?? 0))
  console.log(`- 답 글자 수: 평균 ${round(chars.reduce((a, b) => a + b, 0) / Math.max(1, chars.length), 0)} · p90 ${pct(chars, 90)} · max ${Math.max(...chars, 0)}`)
  const pc = ok.map((r) => r.promptChars ?? 0)
  console.log(`- 프롬프트(promptChars, 페르소나 포함): 평균 ${round(pc.reduce((a, b) => a + b, 0) / Math.max(1, pc.length), 0)} · max ${Math.max(...pc, 0)}`)
  const fixes = ok.reduce<Record<string, number>>((m, r) => {
    for (const [k, v] of Object.entries(r.parsed?.notes.mdFixes ?? {})) if (v) m[k] = (m[k] ?? 0) + (v as number)
    return m
  }, {})
  console.log(`- 서식 정리가 필요했던 호출: ${ok.filter((r) => r.soft && r.soft.noMdFixes === false).length}/${ok.length} · 항목별 합 ${JSON.stringify(fixes)}`)
  for (const r of ok.filter((x) => x.rawFirst)) console.log(`\n--- 1차 위반 원문 ${r.id} [${(r.firstViolations ?? []).join(' / ').slice(0, 300)}]\n${r.rawFirst!.slice(0, 1_800)}`)
  const dropped = ok.reduce((a, r) => a + (r.parsed?.notes.proposalsDropped ?? 0), 0)
  console.log(`- 제안 정리에서 버려진 항목: ${dropped} · 되묻기 문장 버림: ${ok.filter((r) => r.parsed?.notes.needsScopeDropped).length}`)
}

async function main() {
  if (process.env.DUMP === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    const rows = process.env.REFINAL === '1' ? saved.rows.map((r) => (r.ok && r.response ? { ...derive(r, fx.cases.find((c) => c.id === r.case)!), warns: r.warns } : r)) : saved.rows
    table(rows)
    summary(rows)
    return
  }
  const cases = fx.cases.filter((c) => ONLY.length === 0 || ONLY.some((p) => c.id.startsWith(p)))
  const startedAt = new Date().toISOString()
  const rows: Row[] = existsSync(OUT) && process.env.RESUME === '1' ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const done = new Set(rows.map((r) => r.id))
  for (let rep = 1; rep <= REPEAT; rep++) {
    for (const c of cases) {
      if (done.has(`${c.id}#${rep}`)) continue
      const row = process.env.FIRST_ONLY === '1' ? await runFirst(c, rep) : await runCall(c, rep)
      rows.push(row)
      save(rows, startedAt)
      origWarn(
        `[${rows.length}] ${row.id} ${row.ok ? `${round(row.elapsedMs / 1000)}s 시도${row.attempts} ${row.parsed?.confidence ?? ''} keys=${(row.parsed?.sourceKeys ?? []).join(',') || '-'}${row.parsed?.needsScope ? ' 되묻기' : ''}${(row.hard ?? []).length ? ` HARD:${row.hard!.join(';')}` : ''}` : `FAILED ${row.errorName}: ${row.error?.slice(0, 160)}`}`,
      )
      if (row.limitHit) {
        origWarn('한도 신호 감지 — 즉시 중단')
        table(rows)
        summary(rows)
        process.exit(2)
      }
      await sleep(GAP_MS)
    }
  }
  table(rows)
  summary(rows)
}

main().catch((e) => {
  origWarn(e)
  process.exit(1)
})
