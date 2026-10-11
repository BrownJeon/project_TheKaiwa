/**
 * task-056 PE 실측 — 회화방 일본어 도우미 `phraseHelp@v1` 을 실제 Claude CLI(구독)로 **직렬** 호출해 계약 위반율·지연·보정 후 유효율·의미 휴리스틱을 잰다.
 * 합성 입력만 쓴다(`tests/prompts/fixtures/phrase-help.json` liveCases 54건 — 학습자 데이터 없음).
 *
 * 재는 것: ① 1차 통과율(재시도 없이 ajv·extraCheck 통과 = attempts 1) · 최종 실패 ② 지연 p50/p95/max (목표: 5초 안 응답 비율, 12s fail-fast)
 * ③ 판정 — hard: outcome(OK/EMPTY)·항목 수·forbidFinal·forbidRaw / soft: anyJa·allJa·register(의미 휴리스틱 — 비율로 본다)
 * ④ 보정 — 항목/꼬리표/이유가 버려진 수와 이유 ⑤ 눈 판정 재료 — 모든 응답을 표로 찍는다.
 *
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다. `phraseHelp` task 가 아직 `LLM_TASKS` 에 없을 수 있어 같은 모양인 `wordEnrich`(interactive)로
 * 부르되 tier·timeout 은 덮어쓴다(`TIMEOUT_MS` 기본 12,000 = 운영 fail-fast). 한도 신호(429 등)가 보이면 **즉시 멈춘다**.
 *
 * 실행(전용 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe056 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> TIER=fast REPEAT=2 node --import tsx tests/live/task056-pe-phrase-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · REPEAT(기본 1) · GAP_MS=800 · TIMEOUT_MS=12000 · ONLY=<case id 접두 쉼표 목록> · CONTEXT=on|roles|off(on = 역할극 입력에 장면(역할+목표)을 싣는다(기본), roles = 역할만, off = 질의만 — 장면 효과 비교용) ·
 *       DUMP=1(결과 파일만 읽어 표 출력) · REFINAL=1(DUMP 와 함께 — 저장된 모델 응답을 **현재 코드**로 다시 보정해 표를 낸다)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildPhraseHelpRequest, finalizePhraseHelp, PHRASE_HELP_PROMPT_VERSION, type PhraseHelpInput } from '../../src/modules/conversation/prompts/phraseHelp'
import { phraseHelpTrace, type PhraseHelpFinal, type PhraseHelpResponse } from '../../src/modules/conversation/structuredResponse/phraseHelp'

interface FxScene { learnerRole: string; partnerRole: string; goalKo: string }
interface FxExpect { outcome: 'OK' | 'EMPTY' | 'OK_OR_EMPTY'; items?: [number, number]; anyJa?: string[]; allJa?: string[]; register?: 'polite' | 'casual'; forbidFinal?: string[]; forbidRaw?: string[] }
interface FxLive { id: string; group: string; level: string; queryKo: string; scene?: string; expect: FxExpect }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/phrase-help.json'), 'utf8')) as { scenes: Record<string, FxScene>; liveCases: FxLive[] }

const OUT = process.env.OUT ?? '/tmp/kaiwa-task056-phrase-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const REPEAT = Number(process.env.REPEAT ?? 1)
const GAP_MS = Number(process.env.GAP_MS ?? 800)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 12_000)
/** on = 역할극 입력에 장면(역할+목표)을 싣는다(기본), roles = 역할만(목표 제외), off = 질의만(장면 효과 비교용) */
const CONTEXT_MODE = (process.env.CONTEXT ?? 'on') as 'on' | 'roles' | 'off'
const CONTEXT = CONTEXT_MODE !== 'off'
const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
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
  if (line.startsWith('[json]')) warnBuf.push(line.slice(0, 300))
  else origWarn(...args)
}

interface Row {
  id: string
  case: string
  group: string
  rep: number
  tier: string
  context: boolean
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  warm?: string | null
  response?: PhraseHelpResponse
  final?: PhraseHelpFinal
  trace?: ReturnType<typeof phraseHelpTrace>
  hard?: string[]
  soft?: Record<string, boolean>
  warns?: string[]
  errorName?: string
  error?: string
  limitHit?: boolean
}
interface Saved { startedAt: string; version: string; tier: string; context: boolean; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: PHRASE_HELP_PROMPT_VERSION, tier: TIER, context: CONTEXT, rows } satisfies Saved, null, 1))

const POLITE_END = /(です|ます|ません|ました|ください|ですか|ますか|でしょうか|いただけ|お願いします|お願いいたします|ございます|ませんか|ましょう|でした|ますよ|ですね|ますね)[。？！…]*$/u

function inputFor(c: FxLive): PhraseHelpInput {
  return { queryKo: c.queryKo, level: c.level, scene: CONTEXT && c.scene ? (CONTEXT_MODE === 'roles' ? { ...fx.scenes[c.scene], goalKo: null } : fx.scenes[c.scene]) : null }
}

/** 모델 응답(`response`)에서 계산되는 칸을 채운다 — 호출 직후와 `REFINAL=1` 다시 계산이 같은 경로를 쓴다(코드가 바뀐 뒤 저장된 응답을 현재 코드로 다시 보려고). */
function derive(row: Row, c: FxLive): Row {
  const data = row.response!
  const input = inputFor(c)
  const final = finalizePhraseHelp(data, input)
  const trace = phraseHelpTrace(final)
  const hard: string[] = []
  const soft: Record<string, boolean> = {}
  const e = c.expect
  const outcomeOk = final.status === 'OK'
  const empty = final.status === 'NOT_A_PHRASE' || final.status === 'UNSAFE' || final.status === 'TOO_LONG'
  if (final.status === 'INVALID') hard.push('INVALID(쓸 수 있는 항목 없음)')
  if (e.outcome === 'OK' && !outcomeOk) hard.push(`outcome: OK 기대, ${final.status}`)
  if (e.outcome === 'EMPTY' && !empty) hard.push(`outcome: EMPTY 기대, ${final.status}`)
  if (e.outcome === 'OK_OR_EMPTY' && !(outcomeOk || empty)) hard.push(`outcome: ${final.status}`)
  if (outcomeOk && e.items && (final.items.length < e.items[0] || final.items.length > e.items[1])) hard.push(`items ${final.items.length}개 (기대 ${e.items[0]}~${e.items[1]})`)
  const finalText = JSON.stringify(final.items)
  for (const f of e.forbidFinal ?? []) if (finalText.includes(f)) hard.push(`forbidFinal: ${f}`)
  const rawText = JSON.stringify(data)
  for (const f of e.forbidRaw ?? []) if (rawText.toLowerCase().includes(f.toLowerCase())) hard.push(`forbidRaw: ${f}`)
  if (outcomeOk) {
    const jas = final.items.map((i) => i.ja)
    if (e.anyJa) soft.anyJa = e.anyJa.every((re) => jas.some((j) => new RegExp(re).test(j)))
    if (e.allJa) soft.allJa = e.allJa.every((re) => jas.some((j) => new RegExp(re).test(j)))
    if (e.register) {
      const polite = POLITE_END.test(jas[0] ?? '')
      soft.register = e.register === 'polite' ? polite : !polite
    }
    if (final.items.length >= 2) soft.labelsOnMulti = final.items.every((i) => Boolean(i.labelKo))
    soft.whyOnFirst = Boolean(final.items[0]?.whyKo)
  }
  return { ...row, final, trace, hard, soft }
}

async function runCall(c: FxLive, rep: number): Promise<Row> {
  const input = inputFor(c)
  const req = buildPhraseHelpRequest(input)
  const base: Row = { id: `${c.id}#${rep}`, case: c.id, group: c.group, rep, tier: TIER, context: CONTEXT, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  warnBuf = []
  try {
    const r = await llm.completeJson<PhraseHelpResponse>({ ...req, task: 'wordEnrich', tier: TIER, timeoutMs: TIMEOUT_MS })
    return { ...derive({ ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, warm: r.warm ? JSON.stringify(r.warm) : null, response: r.data }, c), warns: [...warnBuf] }
  } catch (err) {
    const er = err as Error & { raw?: string }
    const text = `${er.message} ${er.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 240), limitHit: LIMIT_RE.test(text), warns: [...warnBuf] }
  }
}

function table(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  console.log(`\n## ${PHRASE_HELP_PROMPT_VERSION} · tier=${TIER} · context=${CONTEXT_MODE} · 호출 ${rows.length} · 성공 ${ok.length} · 실패 ${rows.length - ok.length}`)
  console.log('| 호출 | ms | 시도 | 판정 | hard | 표현(첫째 → 나머지) |')
  console.log('|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.id} | ${r.elapsedMs} | - | FAILED ${r.errorName}: ${r.error} | | |`)
      continue
    }
    const items = (r.final?.items ?? []).map((i) => `${i.ja} / ${i.ko}${i.labelKo ? ` [${i.labelKo}]` : ''}${i.whyKo ? ` — ${i.whyKo}` : ''}`).join(' ‖ ')
    console.log(`| ${r.id} | ${r.elapsedMs} | ${r.attempts} | ${r.final?.status} | ${(r.hard ?? []).join('; ') || '-'} | ${items || (r.response?.status ?? '')} |`)
  }
}

function summary(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const ms = ok.map((r) => r.elapsedMs)
  const first = ok.filter((r) => r.attempts === 1).length
  const hardFail = ok.filter((r) => (r.hard ?? []).length > 0)
  console.log(`\n## 요약 (${PHRASE_HELP_PROMPT_VERSION}, tier=${TIER}, context=${CONTEXT_MODE})`)
  console.log(`- 호출 ${rows.length} · 성공 ${ok.length} · 최종 실패 ${rows.length - ok.length} (${rows.filter((r) => !r.ok).map((r) => `${r.id}:${r.errorName}`).join(', ') || '없음'})`)
  console.log(`- 1차 통과(attempts 1) ${first}/${ok.length} = ${round((first / Math.max(1, ok.length)) * 100)}% · 1차 위반(재시도) ${ok.length - first}건 · 1차 위반 사유: ${[...new Set(ok.flatMap((r) => r.warns ?? []))].join(' | ') || '없음'}`)
  console.log(`- 지연 ms: p50 ${pct(ms, 50)} · p95 ${pct(ms, 95)} · max ${Math.max(...ms, 0)} · 평균 ${round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length), 0)}`)
  const within5 = ok.filter((r) => r.elapsedMs <= 5000).length
  const within8 = ok.filter((r) => r.elapsedMs <= 8000).length
  console.log(`- 5초 이내 ${within5}/${ok.length} (${round((within5 / Math.max(1, ok.length)) * 100)}%) · 8초 이내 ${within8}/${ok.length} · 12초 초과 ${ok.filter((r) => r.elapsedMs > 12000).length}`)
  const okRows = ok.filter((r) => r.final?.status === 'OK')
  const counts = [0, 0, 0, 0]
  for (const r of okRows) counts[r.final!.items.length] += 1
  console.log(`- OK ${okRows.length}건 항목 수 분포: 1개 ${counts[1]} · 2개 ${counts[2]} · 3개 ${counts[3]} · 평균 ${round(okRows.reduce((a, r) => a + r.final!.items.length, 0) / Math.max(1, okRows.length), 2)}`)
  const empties = ok.filter((r) => ['NOT_A_PHRASE', 'UNSAFE', 'TOO_LONG'].includes(r.final?.status ?? ''))
  console.log(`- 항목 없음 ${empties.length}건 (${['NOT_A_PHRASE', 'UNSAFE', 'TOO_LONG'].map((s) => `${s} ${empties.filter((r) => r.final?.status === s).length}`).join(' · ')})`)
  console.log(`- hard 위반 ${hardFail.length}건: ${hardFail.map((r) => `${r.id}[${r.hard!.join('; ')}]`).join(' | ') || '없음'}`)
  const softKeys = ['anyJa', 'allJa', 'register', 'labelsOnMulti', 'whyOnFirst']
  for (const k of softKeys) {
    const has = okRows.filter((r) => r.soft && k in r.soft)
    if (has.length) console.log(`- soft ${k}: ${has.filter((r) => r.soft![k]).length}/${has.length}  (실패: ${has.filter((r) => !r.soft![k]).map((r) => r.id).join(', ') || '없음'})`)
  }
  const dropped = ok.reduce((a, r) => a + (r.trace?.itemsDropped ?? 0), 0)
  const labelDropped = ok.reduce((a, r) => a + (r.trace?.labelDropped ?? 0), 0)
  const whyDropped = ok.reduce((a, r) => a + (r.trace?.whyDropped ?? 0), 0)
  const reasons = ok.flatMap((r) => (r.trace?.dropReasons ? r.trace.dropReasons.split(',') : []))
  console.log(`- 보정: 버린 항목 ${dropped} · 버린 꼬리표 ${labelDropped} · 버린 이유 ${whyDropped} · 사유 ${JSON.stringify(reasons.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {}))}`)
  const firstChars = okRows.map((r) => r.trace?.firstJaChars ?? 0)
  console.log(`- 첫 항목 ja 길이: 평균 ${round(firstChars.reduce((a, b) => a + b, 0) / Math.max(1, firstChars.length))} · p95 ${pct(firstChars, 95)} · max ${Math.max(...firstChars, 0)}`)
  const pc = ok.map((r) => r.promptChars ?? 0)
  console.log(`- 프롬프트 길이(promptChars): 평균 ${round(pc.reduce((a, b) => a + b, 0) / Math.max(1, pc.length), 0)} · max ${Math.max(...pc, 0)}`)
}

async function main() {
  if (process.env.DUMP === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    const rows = process.env.REFINAL === '1' ? saved.rows.map((r) => (r.ok && r.response ? { ...derive(r, fx.liveCases.find((c) => c.id === r.case)!), warns: r.warns } : r)) : saved.rows
    table(rows)
    summary(rows)
    return
  }
  const cases = fx.liveCases.filter((c) => ONLY.length === 0 || ONLY.some((p) => c.id.startsWith(p)))
  const startedAt = new Date().toISOString()
  const rows: Row[] = existsSync(OUT) && process.env.RESUME === '1' ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const done = new Set(rows.map((r) => r.id))
  for (let rep = 1; rep <= REPEAT; rep++) {
    for (const c of cases) {
      if (done.has(`${c.id}#${rep}`)) continue
      const row = await runCall(c, rep)
      rows.push(row)
      save(rows, startedAt)
      origWarn(`[${rows.length}] ${row.id} ${row.ok ? `${row.elapsedMs}ms 시도${row.attempts} ${row.final?.status} ${row.final?.items.length ?? 0}개${(row.hard ?? []).length ? ` HARD:${row.hard!.join(';')}` : ''}` : `FAILED ${row.errorName}`}`)
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
