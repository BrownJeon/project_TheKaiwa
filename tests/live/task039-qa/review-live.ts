/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * task-039 QA — 표현 점검(A3 chatReview@v3)을 실제 dev 서버(3030)·실제 Claude CLI(sonnet)·실제 MariaDB 로 N회 돌린다.
 * 매 회: QA 계정(qa-bot)에 CHAT 방을 만들고 합성 사용자 메시지 14건(픽스처 chat-review-style.json — 일상 6·시험식 6·정답 2)을 DB 로 심은 뒤 POST #33.
 * 기록: 성공/실패(HTTP·오류 코드)·소요 ms·items 수·`extraNoteKo` 채움·DB Correction = #33 응답 = #34 목록 대조·original 바이트가 메시지 안 인용인지·
 *       채택 전 WordEntry 0·실패 시 부분 저장(교정 행·reviewedAt) 여부·재시도(다시 시도) 뒤 중복 행 여부·서버 로그에 추가 설명 문자열 0.
 * LLM 호출 수(1회 = POST 1건, 서버 내부 재시도는 로그 `[json] 1차 응답 계약 위반` 줄로 따로 센다)와 타임아웃·실패를 따로 센다.
 * 세션 한도·429 가 보이면 즉시 중단. 끝에 이 실행의 방·Trace 를 지운다.
 *
 * 실행: BASE=http://127.0.0.1:3030 RUNS=12 DEV_LOG=<로그> OUT=<json> node --env-file=.env --import tsx tests/live/task039-qa/review-live.ts <쿠키>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('BASE 는 dev localhost 만')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const RUNS = Number(process.env.RUNS ?? 12)
const GAP_MS = Number(process.env.GAP_MS ?? 2500)
const DEV_LOG = process.env.DEV_LOG ?? ''
const OUT = process.env.OUT ?? '/tmp/kaiwa-qa039-review.json'
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/chat-review-style.json'), 'utf8')) as { messages: { id: string; text: string; kind: string | null }[] }

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: any; message: string | null; ms: number }> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const text = await r.text()
  let body: any = {}
  try { body = JSON.parse(text) } catch { body = { data: {}, message: text.slice(0, 200) } }
  return { status: r.status, data: body.data ?? {}, message: body.message ?? null, ms: Math.round(performance.now() - t0) }
}

const logRead = () => (DEV_LOG && existsSync(DEV_LOG) ? readFileSync(DEV_LOG, 'utf8') : '')
const results: { name: string; ok: boolean; detail: string }[] = []
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

interface Run {
  run: number; status: number; code: string | null; ms: number; items: number; filled: number; sameThreeWay: boolean | null; originalsInMsg: boolean | null
  wordEntries: number; partial: boolean | null; retryOk: boolean | null; retryMs: number | null; retryItems: number | null; dupRows: boolean | null
  firstPassViolations: number; extras: string[]; chojak: number; examFilled: number; examN: number; dailyFilled: number; dailyN: number
}

async function main(): Promise<void> {
  const runs: Run[] = []
  const chatIds: string[] = []
  const allExtras: string[] = []
  let userId = ''
  let stopped = ''
  const logStart = logRead().length
  try {
    for (let i = 1; i <= RUNS; i++) {
      const c = await api('POST', '/api/v1/chats', { kind: 'CHAT', title: `qa039 review ${i}` })
      const chatId = String(c.data.id ?? '')
      if (!chatId) throw new Error(`방 생성 실패 ${c.status}`)
      chatIds.push(chatId)
      if (!userId) userId = (await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } }))!.userId
      const wordBase = await prisma.wordEntry.count({ where: { userId } })
      const base = Date.now() - 3_600_000
      const idByFx = new Map<string, string>()
      for (let k = 0; k < fx.messages.length; k++) {
        const m = await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: fx.messages[k].text, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(base + k * 60_000) } })
        idByFx.set(fx.messages[k].id, m.id)
        // 교정 후보가 의미 있으려면 강사 응답이 사이에 있어도 되지만 점검은 사용자 메시지만 본다 — 사용자 메시지만 심는다.
      }
      await prisma.chat.update({ where: { id: chatId }, data: { messageCount: fx.messages.length, lastMessageAt: new Date(base + 14 * 60_000) } })
      const logBefore = logRead().length
      const rv = await api('POST', `/api/v1/chats/${chatId}/review`)
      const logAdded = logRead().slice(logBefore)
      const violations = logAdded.split('\n').filter((l) => /\[json\] 1차 응답 계약 위반/.test(l)).length
      const run: Run = { run: i, status: rv.status, code: rv.status === 200 ? null : String(rv.data?.code ?? rv.message ?? '?'), ms: rv.ms, items: 0, filled: 0, sameThreeWay: null, originalsInMsg: null, wordEntries: 0, partial: null, retryOk: null, retryMs: null, retryItems: null, dupRows: null, firstPassViolations: violations, extras: [], chojak: 0, examFilled: 0, examN: 0, dailyFilled: 0, dailyN: 0 }
      const stdoutHit = /session limit|hit your/i.test(JSON.stringify(rv)) || rv.status === 429
      if (rv.status === 200 && Array.isArray(rv.data.items)) {
        const items = rv.data.items as any[]
        run.items = items.length
        const rows = await prisma.correction.findMany({ where: { chatId } })
        const list = await api('GET', `/api/v1/corrections?chatId=${chatId}&limit=100`)
        const listItems = (list.data.items ?? []) as any[]
        let same = rows.length === items.length && listItems.length === rows.length
        let origOk = true
        for (const it of items) {
          const row = rows.find((r) => r.id === it.correctionId || r.id === it.id)
          const li = listItems.find((x) => x.id === (it.correctionId ?? it.id))
          if (!row || !li) { same = false; continue }
          if ((row.extraNoteKo ?? null) !== (it.extraNoteKo ?? null) || (li.extraNoteKo ?? null) !== (row.extraNoteKo ?? null) || !('extraNoteKo' in it) || !('extraNoteKo' in li)) same = false
          // original 은 메시지 안 인용(바이트 단위 부분 문자열)
          const hit = fx.messages.some((m) => Buffer.from(m.text, 'utf8').includes(Buffer.from(row.original, 'utf8')))
          if (!hit) origOk = false
          if (typeof row.extraNoteKo === 'string') { run.filled++; run.extras.push(row.extraNoteKo); allExtras.push(row.extraNoteKo) }
          if (/조각/.test(row.explanation)) run.chojak++
          // 어느 픽스처 메시지에서 나온 항목인지(원문이 든 메시지의 kind)
          const src = fx.messages.find((m) => Buffer.from(m.text, 'utf8').includes(Buffer.from(row.original, 'utf8')))
          if (src?.kind === 'EXAM') { run.examN++; if (row.extraNoteKo) run.examFilled++ }
          if (src?.kind === 'DAILY') { run.dailyN++; if (row.extraNoteKo) run.dailyFilled++ }
        }
        run.sameThreeWay = same
        run.originalsInMsg = origOk
        run.wordEntries = (await prisma.wordEntry.count({ where: { userId } })) - wordBase
      } else {
        // 실패 경로: 부분 저장 여부 → 같은 방에서 다시 시도(화면의 [다시 시도] = 같은 POST) → 중복 행 여부
        const rows = await prisma.correction.count({ where: { chatId } })
        const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { reviewedAt: true } })
        const proposals = await prisma.tutorProposal.count({ where: { chatId } })
        run.partial = rows > 0 || !!chat?.reviewedAt || proposals > 0
        console.log(`  ! run ${i} 실패 status=${rv.status} code=${run.code} ms=${rv.ms} · 부분 저장: 교정 ${rows}·reviewedAt=${!!chat?.reviewedAt}·제안 ${proposals}`)
        if (!stdoutHit) {
          await sleep(GAP_MS)
          const rt = await api('POST', `/api/v1/chats/${chatId}/review`)
          run.retryOk = rt.status === 200
          run.retryMs = rt.ms
          if (rt.status === 200) {
            run.retryItems = (rt.data.items ?? []).length
            const rows2 = await prisma.correction.findMany({ where: { chatId } })
            const keys = rows2.map((r) => `${r.messageId}|${r.original}`)
            run.dupRows = new Set(keys).size !== keys.length || rows2.length !== run.retryItems
          }
        }
      }
      runs.push(run)
      console.log(`· run ${i}/${RUNS} status=${run.status} ${run.ms}ms items=${run.items} extra채움=${run.filled} 3자일치=${run.sameThreeWay} 재시도줄=${run.firstPassViolations}${run.code ? ` code=${run.code}` : ''}`)
      if (stdoutHit) { stopped = `한도/429: ${JSON.stringify(rv).slice(0, 160)}`; break }
      await sleep(GAP_MS)
    }
    const txt = logRead().slice(logStart)
    const leak = [...new Set(allExtras)].filter((e) => txt.includes(e))
    check('dev 서버 로그에 추가 설명 문자열 0', leak.length === 0, `로그 ${txt.length}자 · 추가 설명 ${new Set(allExtras).size}종 · 발견 ${leak.length}`)
    const traces = await prisma.requestTrace.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 3 * 3_600_000) } }, select: { steps: true } })
    const trTxt = JSON.stringify(traces.map((t) => t.steps))
    check('RequestTrace.steps 에 추가 설명 문자열 0(이 실행 시간대)', ![...new Set(allExtras)].some((e) => trTxt.includes(e)), `trace ${traces.length}건`)
    const jobs = await prisma.aiJob.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 3 * 3_600_000) } }, select: { payload: true, result: true } as any }).catch(() => [])
    const jobTxt = JSON.stringify(jobs)
    console.log(`  (AiJob payload/result 에 추가 설명 문자열: ${[...new Set(allExtras)].filter((e) => jobTxt.includes(e)).length}종 — 잡 결과에 들어 있으면 별도 기록)`)
  } finally {
    for (const id of chatIds) {
      const r = await api('DELETE', `/api/v1/chats/${id}`).catch(() => ({ status: 0 }))
      if ((r as any).status !== 200) await prisma.chat.delete({ where: { id } }).catch(() => undefined)
    }
    await prisma.$disconnect()
  }
  const ok = runs.filter((r) => r.status === 200)
  const bad = runs.filter((r) => r.status !== 200)
  const msOk = ok.map((r) => r.ms).sort((a, b) => a - b)
  const q = (x: number[], p: number) => (x.length ? x[Math.min(x.length - 1, Math.max(0, Math.ceil(p * x.length) - 1))] : NaN)
  console.log(`\n── 요약 ── POST #33 호출 ${runs.length}회(+실패 후 재시도 ${runs.filter((r) => r.retryOk !== null).length}회) · 성공 ${ok.length} · 실패 ${bad.length}${stopped ? ` · 중단 ${stopped}` : ''}`)
  console.log(`· 서버 내부 재시도 줄(로그 '1차 응답 계약 위반') ${runs.reduce((a, r) => a + r.firstPassViolations, 0)}건 → 1차 통과율 ≈ ${runs.length - runs.filter((r) => r.firstPassViolations > 0 || r.status !== 200).length}/${runs.length}`)
  console.log(`· 실패 내역: ${JSON.stringify(bad.map((r) => ({ run: r.run, status: r.status, code: r.code, ms: r.ms, partial: r.partial, retryOk: r.retryOk, dup: r.dupRows })))}`)
  console.log(`· 성공 ms p50/p95/max ${q(msOk, 0.5)}/${q(msOk, 0.95)}/${msOk.at(-1)}`)
  const items = ok.reduce((a, r) => a + r.items, 0), filled = ok.reduce((a, r) => a + r.filled, 0)
  console.log(`· 교정 항목 ${items}건 중 추가 설명 채움 ${filled} (${items ? Math.round((100 * filled) / items) : 0}%) · 시험식 ${ok.reduce((a, r) => a + r.examFilled, 0)}/${ok.reduce((a, r) => a + r.examN, 0)} · 일상 ${ok.reduce((a, r) => a + r.dailyFilled, 0)}/${ok.reduce((a, r) => a + r.dailyN, 0)} · 설명 '조각' 언급 ${ok.reduce((a, r) => a + r.chojak, 0)}/${items}`)
  check('성공 회차 모두 DB = #33 = #34 extraNoteKo 일치', ok.every((r) => r.sameThreeWay === true), `${ok.filter((r) => r.sameThreeWay !== true).map((r) => r.run).join(',') || '-'}`)
  check('성공 회차 모두 original 이 메시지 안 인용(바이트)', ok.every((r) => r.originalsInMsg === true), `${ok.filter((r) => r.originalsInMsg !== true).map((r) => r.run).join(',') || '-'}`)
  check('점검(채택 전) WordEntry 증가 0', runs.every((r) => r.wordEntries === 0), `${runs.filter((r) => r.wordEntries !== 0).map((r) => r.run).join(',') || '-'}`)
  check('실패 회차: 부분 저장 없음(교정 0·reviewedAt null·제안 0)', bad.every((r) => r.partial === false), `${bad.filter((r) => r.partial !== false).map((r) => r.run).join(',') || '-'}`)
  check('실패 후 다시 시도 성공 시 중복·부분 행 없음', bad.filter((r) => r.retryOk).every((r) => r.dupRows === false), `${bad.filter((r) => r.retryOk && r.dupRows !== false).map((r) => r.run).join(',') || '-'}`)
  writeFileSync(OUT, JSON.stringify({ runs, results, stopped }, null, 1), 'utf8')
  console.log(`(원자료 → ${OUT})`)
  if (results.some((r) => !r.ok)) process.exitCode = 1
}
main().catch((e) => {
  console.error('QA 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  process.exitCode = 1
})
