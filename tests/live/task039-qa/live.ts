/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * task-039 QA — 실제 dev 서버(127.0.0.1:3030)·실제 Claude CLI·실제 MariaDB 로 TALK 턴을 돌려
 * ① 교정 저장 왕복(done.correction = DB Correction = #29 = #34, extraNoteKo 같은 값, original 바이트 일치)
 * ② 채택 전 WordEntry·StudyLog 0 ③ toolLog·RequestTrace·서버 로그에 추가 설명 문자열 0
 * ④ 지연(ACCEPT→done·첫 audio·Trace 단계) p50/p95 ⑤ ajv 1차 통과(toolLog.attempt) ⑥ 교정 검출·오탐 ⑦ 감시 수치(조각 언급·채움률·JLPT 식 규칙 판정)
 * 를 모은다. 입력은 합성 픽스처(`tests/prompts/fixtures/{talk-explanation-style,talk-corrections}.json`)뿐, QA 계정(qa-bot) 소유 행만 만들고 끝에 지운다.
 *
 * 실행(QA 미러): BASE=http://127.0.0.1:3030 SET=style|corr COUNT=60 PER_CHAT=6 OUT=<json> DEV_LOG=<dev 로그> node --env-file=.env --import tsx tests/live/task039-qa/live.ts <쿠키>
 * 호출 간격: 시작-시작 ≥ GAP_MS(기본 5600 — 분당 12턴 제한). 세션 한도·429 문구(stdout 으로만 나옴)가 보이면 즉시 중단한다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { flagsOf } from '../task039-style-classify'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if (/:3010$/.test(BASE)) throw new Error('3010 은 운영 — 금지')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const SET = (process.env.SET ?? 'style') as 'style' | 'corr'
const COUNT = Number(process.env.COUNT ?? 60)
const PER_CHAT = Number(process.env.PER_CHAT ?? 6)
const GAP_MS = Number(process.env.GAP_MS ?? 5600)
const OUT = process.env.OUT ?? '/tmp/kaiwa-qa039-live.json'
const DEV_LOG = process.env.DEV_LOG ?? ''
const SKIP = Number(process.env.SKIP ?? 0)
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Fx { id: string; level: string; kind?: 'DAILY' | 'EXAM'; input: string; hasError?: boolean; expectedCorrected?: string; errorType?: string }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures', SET === 'style' ? 'talk-explanation-style.json' : 'talk-corrections.json'), 'utf8')).items as Fx[]
const items = fx.slice(SKIP, SKIP + COUNT)

const results: { name: string; ok: boolean; detail: string }[] = []
const counters: Record<string, { ok: number; n: number; fails: string[] }> = {}
function tally(name: string, ok: boolean, detail = ''): void {
  const c = (counters[name] ??= { ok: 0, n: 0, fails: [] })
  c.n++
  if (ok) c.ok++
  else c.fails.push(detail.slice(0, 200))
}
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  return { status: r.status, data: body.data ?? {} }
}

interface TurnResult { names: string[]; done: Record<string, any> | null; error: Record<string, unknown> | null; warnings: string[]; firstAudioMs: number | null; doneMs: number | null; totalMs: number; acceptedMs: number | null; httpStatus: number; stdoutHit: boolean }
async function turn(chatId: string, text: string): Promise<TurnResult> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  const out: TurnResult = { names: [], done: null, error: null, warnings: [], firstAudioMs: null, doneMs: null, totalMs: 0, acceptedMs: null, httpStatus: r.status, stdoutHit: false }
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const txt = await r.text()
    out.error = { code: `HTTP${r.status}`, message: txt.slice(0, 160) }
    out.stdoutHit = /session limit|hit your|429/i.test(txt)
    out.totalMs = Math.round(performance.now() - t0)
    return out
  }
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (!ev || !d) continue
      const data = JSON.parse(d) as Record<string, any>
      out.names.push(ev)
      const now = Math.round(performance.now() - t0)
      if (ev === 'accepted') out.acceptedMs = now
      if (ev === 'done') { out.done = data; out.doneMs = now }
      if (ev === 'error') { out.error = data; out.stdoutHit = /session limit|hit your|429|한도/i.test(JSON.stringify(data)) }
      if (ev === 'status' && typeof data.warning === 'string') out.warnings.push(data.warning)
      if (ev === 'audio' && out.firstAudioMs === null && data.status === 'OK') out.firstAudioMs = now
    }
  }
  out.totalMs = Math.round(performance.now() - t0)
  return out
}

const pct = (xs: number[], q: number): number => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))
  return s[idx]
}

interface Row {
  id: string; level: string; kind?: string; hasError: boolean; input: string
  corrected: boolean; correctionOk: boolean | null
  explanationKo: string | null; extraNoteKo: string | null; grammarPoint: string | null; errorType: string | null; correctedText: string | null
  doneMs: number | null; firstAudioMs: number | null; totalMs: number; attempt: number | null; attemptsTrace: number | null
  llmMs: number | null; firstSentenceMs: number | null; ttfaServerMs: number | null; acceptMs: number | null
  warnings: string[]; status: string
  jlptExpl: boolean; jlptExtra: boolean; chojak: boolean
}

async function main(): Promise<void> {
  const startedAt = new Date()
  const rows: Row[] = []
  const chatIds: string[] = []
  const traceIds: string[] = []
  const extras: string[] = []
  let userId = ''
  let wordBase = -1
  let studyBase = -1
  let stopped = ''
  const toolLogs: string[] = []
  const logBefore = DEV_LOG && existsSync(DEV_LOG) ? readFileSync(DEV_LOG, 'utf8').length : 0
  try {
    let chatId = ''
    let inChat = 0
    let n = 0
    for (const it of items) {
      const started = performance.now()
      if (!chatId || inChat >= PER_CHAT) {
        const c = await api('POST', '/api/v1/chats', { kind: 'TALK', title: `qa039 ${SET}` })
        chatId = String(c.data.id ?? '')
        if (!chatId) throw new Error(`채팅방 생성 실패 status=${c.status}`)
        chatIds.push(chatId)
        inChat = 0
        if (!userId) {
          userId = (await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } }))!.userId
          wordBase = await prisma.wordEntry.count({ where: { userId } })
          studyBase = await prisma.studyLog.count({ where: { userId } })
        }
        await api('GET', `/api/v1/chats/${chatId}`) // 방 진입 = 예열
        await sleep(2500)
      }
      inChat++
      n++
      const t = await turn(chatId, it.input)
      if (t.stdoutHit) { stopped = `한도/429 의심: ${JSON.stringify(t.error).slice(0, 200)}`; break }
      const ok = t.names[0] === 'accepted' && t.names[t.names.length - 1] === 'done' && t.error === null
      tally('SSE accepted 첫째·done 마지막·error 0', ok, `${it.id} events=${t.names.join(',')} err=${JSON.stringify(t.error ?? '').slice(0, 120)}`)
      if (!t.done) {
        rows.push({ id: it.id, level: it.level, kind: it.kind, hasError: !!it.hasError, input: it.input, corrected: false, correctionOk: null, explanationKo: null, extraNoteKo: null, grammarPoint: null, errorType: null, correctedText: null, doneMs: null, firstAudioMs: t.firstAudioMs, totalMs: t.totalMs, attempt: null, attemptsTrace: null, llmMs: null, firstSentenceMs: null, ttfaServerMs: null, acceptMs: null, warnings: t.warnings, status: `NO_DONE:${String((t.error as any)?.code ?? '?')}`, jlptExpl: false, jlptExtra: false, chojak: false })
        console.log(`  ! ${it.id} done 없음 ${JSON.stringify(t.error).slice(0, 160)}`)
        if (/SESSION|LIMIT|RATE/i.test(JSON.stringify(t.error))) { stopped = `error ${JSON.stringify(t.error).slice(0, 200)}`; break }
        await sleep(Math.max(0, GAP_MS - (performance.now() - started)))
        continue
      }
      const d = t.done
      traceIds.push(String(d.traceId ?? ''))
      const c = d.correction as Record<string, any> | null
      const aid = String(d.assistantMessageId)
      const m = await prisma.chatMessage.findUnique({ where: { id: aid } })
      toolLogs.push(JSON.stringify(m?.toolLog ?? null))
      const tl = (m?.toolLog ?? {}) as Record<string, unknown>
      let steps: Record<string, any>[] = []
      for (let w = 0; w < 12; w++) {
        const tr = await prisma.requestTrace.findUnique({ where: { traceId: String(d.traceId ?? '') } })
        steps = (tr?.steps ?? []) as Record<string, any>[]
        if (steps.some((s) => s.name === 'LLM') && steps.some((s) => s.name === 'TTS[0]')) break
        await sleep(500)
      }
      toolLogs.push(JSON.stringify(steps))
      const llmStep = steps.find((s) => s.name === 'LLM')
      const accStep = steps.find((s) => s.name === 'ACCEPT')
      const ttsStep = steps.find((s) => s.name === 'TTS[0]')
      let correctionOk: boolean | null = null
      if (c) {
        const row = await prisma.correction.findUnique({ where: { id: String(c.id) } })
        const inputBytes = Buffer.from(it.input, 'utf8')
        const origEq = !!row && Buffer.compare(Buffer.from(row.original, 'utf8'), inputBytes) === 0 && Buffer.compare(Buffer.from(String(c.original), 'utf8'), inputBytes) === 0
        tally('Correction.original 바이트 = 입력 = done.correction.original', origEq, `${it.id}`)
        const extraRow = (row as any)?.extraNoteKo ?? null
        const extraDone = c.extraNoteKo ?? null
        tally('Correction.extraNoteKo(DB) === done.correction.extraNoteKo', !!row && extraRow === extraDone, `${it.id} db=${JSON.stringify(extraRow)} done=${JSON.stringify(extraDone)}`)
        tally('done.correction 에 extraNoteKo 키가 있음(null 도 키)', 'extraNoteKo' in c, `${it.id}`)
        tally('Correction.explanation === done.explanationKo · status PROPOSED', !!row && row.explanation === c.explanationKo && row.status === 'PROPOSED', `${it.id}`)
        tally('extraNoteKo 형식: null 또는 한 줄·≤200자·한글 포함', extraDone === null || (typeof extraDone === 'string' && !/[\n\r\t]/.test(extraDone) && extraDone.length <= 200 && /[가-힣]/.test(extraDone)), `${it.id} ${JSON.stringify(extraDone)}`)
        if (typeof extraDone === 'string') extras.push(extraDone)
        if (typeof extraRow === 'string') extras.push(extraRow)
        if (it.expectedCorrected) correctionOk = norm(String(c.corrected)) === norm(it.expectedCorrected)
      }
      const wc = await prisma.wordEntry.count({ where: { userId } })
      const sc = await prisma.studyLog.count({ where: { userId } })
      tally('채택 전 WordEntry 행 수 불변', wc === wordBase, `${it.id} ${wc}/${wordBase}`)
      tally('채택 전 StudyLog 행 수 불변', sc === studyBase, `${it.id} ${sc}/${studyBase}`)
      const f = c ? flagsOf(String(c.explanationKo)) : null
      const fe = c && typeof c.extraNoteKo === 'string' ? flagsOf(c.extraNoteKo) : null
      rows.push({
        id: it.id, level: it.level, kind: it.kind, hasError: !!it.hasError, input: it.input, corrected: !!c, correctionOk,
        explanationKo: c ? String(c.explanationKo) : null, extraNoteKo: c ? (c.extraNoteKo ?? null) : null, grammarPoint: d.learning?.grammarPoint ?? null,
        errorType: c ? String(c.errorType) : null, correctedText: c ? String(c.corrected) : null,
        doneMs: t.doneMs, firstAudioMs: t.firstAudioMs, totalMs: t.totalMs,
        attempt: typeof tl.attempt === 'number' ? tl.attempt : null, attemptsTrace: typeof llmStep?.attempts === 'number' ? llmStep.attempts : null,
        llmMs: typeof llmStep?.ms === 'number' ? llmStep.ms : null, firstSentenceMs: typeof llmStep?.firstSentenceMs === 'number' ? llmStep.firstSentenceMs : null,
        ttfaServerMs: typeof ttsStep?.ttfaServerMs === 'number' ? ttsStep.ttfaServerMs : null, acceptMs: typeof accStep?.ms === 'number' ? accStep.ms : null,
        warnings: t.warnings, status: 'OK', jlptExpl: !!f?.jlptStyle, jlptExtra: !!fe?.jlptStyle, chojak: c ? /조각/.test(String(c.explanationKo)) : false,
      })
      console.log(`  · ${n}/${items.length} ${it.id} ${it.hasError ? 'ERR' : 'OK '} corr=${c ? 'Y' : 'N'} extra=${c ? (c.extraNoteKo ? 'Y' : '-') : '/'} done=${t.doneMs}ms audio1=${t.firstAudioMs ?? '-'}ms attempt=${String(tl.attempt ?? '-')}`)
      await sleep(Math.max(0, GAP_MS - (performance.now() - started)))
    }

    // ── 방별 조회 대조: #29 / #34 ──
    let mism29 = 0, cnt29 = 0, mism34 = 0, cnt34 = 0
    for (const id of chatIds) {
      const g = await api('GET', `/api/v1/chats/${id}?limit=50`)
      tally('#29 200', g.status === 200, `status=${g.status}`)
      const msgs = (g.data.messages ?? []) as Record<string, any>[]
      const l = await api('GET', `/api/v1/corrections?chatId=${id}&limit=100`)
      tally('#34 200', l.status === 200, `status=${l.status}`)
      const list = (l.data.items ?? []) as Record<string, any>[]
      const dbRows = await prisma.correction.findMany({ where: { chatId: id }, select: { id: true, extraNoteKo: true, original: true } })
      for (const r of dbRows) {
        const inMsg = msgs.flatMap((x) => (x.corrections ?? []) as Record<string, any>[]).find((x) => x.id === r.id)
        cnt29++
        if (!inMsg || (inMsg.extraNoteKo ?? null) !== (r.extraNoteKo ?? null) || !('extraNoteKo' in inMsg)) mism29++
        const inList = list.find((x) => x.id === r.id)
        cnt34++
        if (!inList || (inList.extraNoteKo ?? null) !== (r.extraNoteKo ?? null) || !('extraNoteKo' in inList)) mism34++
      }
    }
    check('#29 messages[].corrections[].extraNoteKo = DB (키 존재 포함)', mism29 === 0 && cnt29 > 0, `대조 ${cnt29}건 불일치 ${mism29}`)
    check('#34 corrections 목록 extraNoteKo = DB (키 존재 포함)', mism34 === 0 && cnt34 > 0, `대조 ${cnt34}건 불일치 ${mism34}`)

    // ── 로그·toolLog·Trace 에 추가 설명 문자열 0 ──
    const allLogs = toolLogs.join('\n')
    const leaked = extras.filter((e) => allLogs.includes(e))
    check('toolLog·RequestTrace.steps 에 추가 설명 문자열 0', leaked.length === 0, `추가 설명 ${new Set(extras).size}종 · toolLog/steps ${toolLogs.length}건 대조 · 발견 ${leaked.length}`)
    const keyHits = (allLogs.match(/extraNoteKo/g) ?? []).length
    console.log(`  (toolLog·steps 안 'extraNoteKo' 키 이름 출현 ${keyHits}회)`)
    if (DEV_LOG && existsSync(DEV_LOG)) {
      const logTxt = readFileSync(DEV_LOG, 'utf8').slice(logBefore)
      const leakLog = [...new Set(extras)].filter((e) => logTxt.includes(e))
      check('dev 서버 로그에 추가 설명 문자열 0', leakLog.length === 0, `로그 ${logTxt.length}자 대조 · 발견 ${leakLog.length}`)
      const retryLines = logTxt.split('\n').filter((l) => /\[json\] 1차 응답 계약 위반/.test(l)).length
      console.log(`  (dev 로그: '[json] 1차 응답 계약 위반' ${retryLines}줄)`)
    }
  } finally {
    // 정리: 이 실행이 만든 방(cascade 메시지·교정)과 Trace
    await prisma.requestTrace.deleteMany({ where: { traceId: { in: traceIds.filter(Boolean) } } }).catch(() => undefined)
    for (const id of chatIds) {
      const r = await api('DELETE', `/api/v1/chats/${id}`).catch(() => ({ status: 0, data: {} }))
      if (r.status !== 200) await prisma.chat.delete({ where: { id } }).catch(() => undefined)
    }
    await prisma.$disconnect()
  }

  // ── 집계 ──
  console.log('\n── 체크 집계 ──')
  for (const [k, v] of Object.entries(counters)) console.log(`${v.ok === v.n ? 'PASS' : 'FAIL'}  ${k} — ${v.ok}/${v.n}${v.fails.length ? ` 실패 예: ${v.fails.slice(0, 3).join(' | ')}` : ''}`)
  const ok = rows.filter((r) => r.status === 'OK')
  const err = ok.filter((r) => r.hasError)
  const noerr = ok.filter((r) => !r.hasError)
  const det = err.filter((r) => r.corrected).length
  const fp = noerr.filter((r) => r.corrected).length
  const doneMs = ok.map((r) => r.doneMs!).filter((x) => x != null)
  const fa = ok.map((r) => r.firstAudioMs!).filter((x) => x != null)
  const llm = ok.map((r) => r.llmMs!).filter((x) => x != null)
  const fs = ok.map((r) => r.firstSentenceMs!).filter((x) => x != null)
  const ttfa = ok.map((r) => r.ttfaServerMs!).filter((x) => x != null)
  const filled = ok.filter((r) => r.corrected && r.extraNoteKo)
  const corr = ok.filter((r) => r.corrected)
  const first = ok.filter((r) => (r.attempt ?? 1) < 2).length
  console.log(`\n요약 SET=${SET} n=${items.length} 완료=${ok.length}${stopped ? ` · 중단: ${stopped}` : ''}`)
  console.log(`· 교정 검출 ${det}/${err.length} · 오탐 ${fp}/${noerr.length} · 교정문 일치(expectedCorrected 있는 것) ${err.filter((r) => r.correctionOk).length}/${err.filter((r) => r.correctionOk !== null).length}`)
  console.log(`· ajv/계약 1차 통과(toolLog.attempt<2) ${first}/${ok.length} · Trace attempts≥2 ${ok.filter((r) => (r.attemptsTrace ?? 1) >= 2).length} · 완료 못 한 턴 ${rows.length - ok.length}`)
  console.log(`· done ms p50/p95/max ${pct(doneMs, 0.5)}/${pct(doneMs, 0.95)}/${Math.max(...doneMs)} (n=${doneMs.length}) · 첫 audio ms p50/p95 ${pct(fa, 0.5)}/${pct(fa, 0.95)} (n=${fa.length})`)
  console.log(`· LLM ms p50/p95 ${pct(llm, 0.5)}/${pct(llm, 0.95)} · LLM 첫 문장 ms p50/p95 ${pct(fs, 0.5)}/${pct(fs, 0.95)} · ttfaServerMs p50/p95 ${pct(ttfa, 0.5)}/${pct(ttfa, 0.95)}`)
  console.log(`· extraNoteKo 채움(서버 정리 후) ${filled.length}/${corr.length}${corr.length ? ` (${Math.round((100 * filled.length) / corr.length)}%)` : ''} · 시험식(EXAM) ${filled.filter((r) => r.kind === 'EXAM').length}/${corr.filter((r) => r.kind === 'EXAM').length} · 일상(DAILY) ${filled.filter((r) => r.kind === 'DAILY').length}/${corr.filter((r) => r.kind === 'DAILY').length}`)
  console.log(`· 메인 설명 '조각' 언급 ${corr.filter((r) => r.chojak).length}/${corr.length} · 메인 설명 JLPT식(규칙) ${corr.filter((r) => r.jlptExpl).length}/${corr.length} · 추가 설명 JLPT식(규칙) ${filled.filter((r) => r.jlptExtra).length}/${filled.length}`)
  const lens = filled.map((r) => r.extraNoteKo!.length)
  console.log(`· 추가 설명 길이 min/p50/max ${Math.min(...lens)}/${pct(lens, 0.5)}/${Math.max(...lens)}`)
  writeFileSync(OUT, JSON.stringify({ set: SET, startedAt, rows, counters, results, stopped }, null, 1), 'utf8')
  console.log(`(원자료 → ${OUT})`)
  const failC = Object.values(counters).filter((c) => c.ok !== c.n).length
  const failR = results.filter((r) => !r.ok).length
  console.log(`\n결과: 집계 항목 FAIL ${failC} · 개별 FAIL ${failR}`)
  if (failC || failR) process.exitCode = 1
}
const norm = (s: string) => s.replace(/[\s、。！？!?]/g, '')

main().catch((e) => {
  console.error('QA 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  process.exitCode = 1
})
