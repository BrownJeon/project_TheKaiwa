/**
 * task-006 라이브 스모크 — QA 계정 두 개로 채팅·턴(SSE)·표현 점검·채택·IDOR·입력 검증을 실제 서버(127.0.0.1)·실제 LLM 에 친다.
 * Leader 완료 기준 2~12·14 를 항목별 PASS/FAIL 로 찍고, 만든 데이터(QA 계정 소유)는 끝에 지운다.
 *
 * 실행(우분투 미러): `bash tests/live/task006-smoke.sh` — 세션 쿠키 생성·삭제를 감싼다. 직접 실행:
 *   BASE=http://127.0.0.1:3011 node --env-file=.env --import tsx tests/live/task006-smoke.ts <cookie1> <cookie2>
 * LLM 호출은 약 17회(턴 p50 10회 포함). DB 는 개발·운영 공유라 QA 계정 행만 만들고 지운다.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task006-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const startedAt = new Date()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog/i
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Res {
  status: number
  body: { success: boolean; data: Record<string, unknown> & { code?: string; details?: Record<string, unknown> }; message: string | null }
  headers: Headers
}
async function api(cookie: string, method: string, path: string, body?: unknown): Promise<Res> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 200) }
  }
  return { status: r.status, body: parsed, headers: r.headers }
}

interface SseEvent {
  event: string
  data: Record<string, unknown>
  at: number
}
interface TurnResult {
  status: number
  contentType: string
  events: SseEvent[]
  envelope?: Res['body']
  ms: number
}
/** 턴 SSE — `onAccepted` 에서 true 를 돌려주면 그 자리에서 연결을 끊는다(끊김 시험). */
async function turn(cookie: string, chatId: string, body: unknown, opts: { onAccepted?: (e: SseEvent) => boolean | void } = {}): Promise<TurnResult> {
  const t0 = Date.now()
  const ac = new AbortController()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal })
  const ct = r.headers.get('content-type') ?? ''
  if (!ct.includes('text/event-stream')) {
    const text = await r.text()
    if (LEAK.test(text)) leakHits++
    return { status: r.status, contentType: ct, events: [], envelope: JSON.parse(text), ms: Date.now() - t0 }
  }
  const events: SseEvent[] = []
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = dec.decode(value, { stream: true })
      if (LEAK.test(chunk)) leakHits++
      buf += chunk
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (block.startsWith(':')) continue
        const ev = /^event: (.+)$/m.exec(block)?.[1]
        const data = /^data: (.+)$/m.exec(block)?.[1]
        if (!ev || !data) continue
        const e = { event: ev, data: JSON.parse(data), at: Date.now() - t0 }
        events.push(e)
        if (ev === 'accepted' && opts.onAccepted?.(e) === true) {
          ac.abort()
          return { status: r.status, contentType: ct, events, ms: Date.now() - t0 }
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e
  }
  return { status: r.status, contentType: ct, events, ms: Date.now() - t0 }
}

/** 429 가 나면 Retry-After 만큼 쉬고 다시(일반 턴용). */
async function turnOk(cookie: string, chatId: string, body: unknown): Promise<TurnResult> {
  for (let i = 0; i < 3; i++) {
    const r = await turn(cookie, chatId, body)
    if (r.status !== 429) return r
    const wait = Number((r.envelope?.data.details as { retryAfterSec?: number } | undefined)?.retryAfterSec ?? 10)
    console.log(`  (429 — ${wait}s 대기)`)
    await sleep((wait + 1) * 1000)
  }
  throw new Error('429 가 계속된다')
}

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}
async function counts(userId: string) {
  const [w, s, snap, err] = await Promise.all([
    prisma.wordEntry.count({ where: { userId } }),
    prisma.studyLog.count({ where: { userId } }),
    prisma.statsSnapshot.count({ where: { userId } }),
    prisma.learnerErrorStat.count({ where: { userId } }),
  ])
  return { w, s, snap, err }
}
const cpLen = (s: string) => Array.from(s).length
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

async function main() {
  const u1 = await uid('qa-bot@thekaiwa.test')
  const u2 = await uid('qa-bot2@thekaiwa.test')
  const before = await counts(u1)

  // ── 11. 입력 검증(턴 라우트 워밍업 겸) ────────────────────────────────
  const A = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT', title: '週末🎉の話😀' })
  const chatA = String(A.body.data.id)
  check('10a 이모지 제목 저장·바이트 동일', A.status === 200 && A.body.data.title === '週末🎉の話😀', `status=${A.status}`)
  check('D9 빈 채팅 lastMessageAt=createdAt', A.body.data.lastMessageAt === A.body.data.createdAt)
  const v1 = await turn(COOKIE1, chatA, { text: '' })
  const v2 = await turn(COOKIE1, chatA, { text: ' \u0001\u0007 \n\t ' })
  const v3 = await turn(COOKIE1, chatA, { text: 'あ'.repeat(1001) })
  const v4 = await turn(COOKIE1, chatA, { text: 'はい', inputSource: 'REALTIME_STT' })
  check('11 빈·공백/제어문자만·1,001자·utteranceId 없는 REALTIME_STT → 400 봉투', [v1, v2, v3, v4].every((v) => v.status === 400 && v.envelope?.data.code === 'VALIDATION'), [v1, v2, v3, v4].map((v) => v.status).join(','))
  const ask = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'ASK' })
  check('11 ASK 생성 → 400 FEATURE_NOT_READY', ask.status === 400 && ask.body.data.code === 'FEATURE_NOT_READY')
  const longTitle = await api(COOKIE1, 'PATCH', `/api/v1/chats/${chatA}`, { title: '😀'.repeat(101) })
  check('11 제목 101 코드포인트 → 400', longTitle.status === 400)

  // ── 2·14. CHAT 턴 10회(SSE 순서·DB·p50) ─────────────────────────────
  const sentences = [
    '昨日は学校を行きました。',
    '友達と映画を見に行くました。',
    '今日は😀楽しかったです🎉',
    'パンを食べました。とても美味しいでした。',
    '明日は雨が降るかもしれません。',
    '私は日本語を勉強しています。',
    '駅に友達を待ちました。',
    '週末は何をするつもりですか？',
    '先生はとても親切でした。',
    'きのう、私は本を読むました。',
  ]
  const lat: number[] = []
  let orderOk = true
  let firstTurn: TurnResult | null = null
  for (const s of sentences) {
    const r = await turnOk(COOKIE1, chatA, { text: s, inputSource: 'TEXT' })
    firstTurn ??= r
    const names = r.events.map((e) => e.event)
    const ok = r.contentType.includes('text/event-stream') && names[0] === 'accepted' && names.at(-1) === 'done' && names.slice(1, -1).every((n) => n === 'status')
    if (!ok) {
      orderOk = false
      console.log(`  turn 이벤트: ${names.join('→')} ${JSON.stringify(r.events.at(-1)?.data ?? r.envelope).slice(0, 200)}`)
    }
    const done = r.events.find((e) => e.event === 'done')
    if (done) lat.push(done.at)
  }
  const stages = firstTurn?.events.filter((e) => e.event === 'status').map((e) => e.data.stage).join('|')
  check('2 SSE 순서 accepted→status(PROMPT|LLM|PARSE)→done ×10', orderOk && stages === 'PROMPT|LLM|PARSE', `stages=${stages}`)
  const chatAfter = await api(COOKIE1, 'GET', `/api/v1/chats/${chatA}?limit=50`)
  const msgs = chatAfter.body.data.messages as { id: string; role: string; status: string; content: string; corrections: unknown[] }[]
  const info = chatAfter.body.data.chat as { messageCount: number; running: boolean }
  check('2 DB USER DONE + ASSISTANT DONE, messageCount=20', msgs.length === 20 && msgs.every((m) => m.status === 'DONE') && info.messageCount === 20 && !info.running, `n=${msgs.length} count=${info.messageCount}`)
  const emojiMsg = msgs.find((m) => m.role === 'USER' && m.content.includes('😀'))
  check('10b 이모지 턴 500 없음·저장값 바이트 동일', !!emojiMsg && Buffer.from(emojiMsg.content).equals(Buffer.from('今日は😀楽しかったです🎉')))
  const listA = await api(COOKIE1, 'GET', '/api/v1/chats?kind=CHAT&limit=20')
  const rowA = (listA.body.data.items as { id: string; preview: string; lastMessageAt: string }[]).find((c) => c.id === chatA)
  check('2 목록 preview·lastMessageAt 갱신', !!rowA?.preview && rowA.lastMessageAt > String(A.body.data.createdAt))
  check('CHAT 교정 없음(턴 중 Correction 0)', msgs.every((m) => m.role !== 'USER' || (m.corrections ?? []).length === 0))
  const sorted = [...lat].sort((a, b) => a - b)
  const p50 = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN
  check('14 CHAT 턴 10회 p50(예산 20s)', sorted.length === 10 && p50 <= 20_000, `p50=${p50}ms max=${sorted.at(-1)}ms all=${lat.join(',')}`)

  // ── 4. accepted 직후 끊어도 끝까지 처리 ────────────────────────────
  let detachedId = ''
  const d = await turn(COOKIE1, chatA, { text: 'すみません、もう一度お願いします。' }, { onAccepted: (e) => ((detachedId = String(e.data.assistantMessageId)), true) })
  let polled: { running: boolean; last?: { id: string; status: string } } = { running: true }
  for (let i = 0; i < 40 && polled.running; i++) {
    await sleep(i < 12 ? 2500 : 5000)
    const g = await api(COOKIE1, 'GET', `/api/v1/chats/${chatA}?limit=5`)
    const m = g.body.data.messages as { id: string; status: string }[]
    polled = { running: (g.body.data.chat as { running: boolean }).running, last: m.at(-1) }
  }
  check('4 끊겨도 서버가 끝까지 처리(running=false·강사 DONE)', d.events[0]?.event === 'accepted' && !polled.running && polled.last?.id === detachedId && polled.last?.status === 'DONE', JSON.stringify(polled.last))

  // ── 6. 채택 전 행 0 (턴 뒤) ─────────────────────────────────────────
  const afterTurns = await counts(u1)
  check('6a 턴 전후 WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat 변화 0', JSON.stringify(afterTurns) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(afterTurns)}`)

  // ── 5. 표현 점검(동기) ───────────────────────────────────────────────
  const rv = await api(COOKIE1, 'POST', `/api/v1/chats/${chatA}/review`)
  const items = (rv.body.data.items ?? []) as { correctionId: string; messageId: string; original: string; corrected: string }[]
  const userTexts = new Map(msgs.filter((m) => m.role === 'USER').map((m) => [m.id, m.content]))
  const dbCorr = await prisma.correction.findMany({ where: { chatId: chatA }, select: { id: true, messageId: true, original: true, status: true } })
  const split = (t: string) => t.split(/(?<=[。！？!?])|\r?\n/).map((s) => s.trim()).filter(Boolean)
  const verbatim = dbCorr.every((c) => {
    const text = userTexts.get(c.messageId)
    return text !== undefined && (Buffer.from(c.original).equals(Buffer.from(text)) || split(text).some((s) => Buffer.from(s).equals(Buffer.from(c.original))))
  })
  check('5a 점검 → Correction PROPOSED, original 이 메시지 전체 또는 문장 하나와 바이트 일치(SQL 대조)', rv.status === 200 && items.length > 0 && dbCorr.length === items.length && dbCorr.every((c) => c.status === 'PROPOSED') && verbatim, `status=${rv.status} items=${items.length} dropped=${rv.body.data.dropped} skipped=${rv.body.data.skippedMessages}`)
  const reviewedChat = await prisma.chat.findUniqueOrThrow({ where: { id: chatA }, select: { reviewedAt: true } })
  check('5b reviewedAt 설정·summaryKo', !!reviewedChat.reviewedAt && typeof rv.body.data.summaryKo === 'string')
  const rv2 = await api(COOKIE1, 'POST', `/api/v1/chats/${chatA}/review`)
  check('5c 두 번째 점검 409 ALREADY_REVIEWED', rv2.status === 409 && rv2.body.data.code === 'ALREADY_REVIEWED')
  const E = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT' })
  const chatEmpty = String(E.body.data.id)
  const rv0 = await api(COOKIE1, 'POST', `/api/v1/chats/${chatEmpty}/review`)
  check('5d 사용자 메시지 0 → 400', rv0.status === 400)
  const afterReview = await counts(u1)
  check('6b 점검 전후 행 수 변화 0', JSON.stringify(afterReview) === JSON.stringify(before), JSON.stringify(afterReview))
  const originalsBefore = new Map(dbCorr.map((c) => [c.id, c.original]))

  // ── 5e. 잡 경로(사용자 메시지 21건 → AiJob) + 진행 중 409 ─────────────
  const J = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT', title: '잡 경로' })
  const chatJ = String(J.body.data.id)
  const base = Date.now() - 60_000
  for (let i = 0; i < 21; i++) {
    const text = i === 3 ? '私は昨日学校を行きました。' : i === 9 ? '友達に会うました。' : `今日は${i + 1}番目のメッセージです。`
    await prisma.chatMessage.create({ data: { chatId: chatJ, userId: u1, role: 'USER', content: text, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(base + i * 2) } })
    await prisma.chatMessage.create({ data: { chatId: chatJ, userId: u1, role: 'ASSISTANT', content: 'そうですか。', status: 'DONE', createdAt: new Date(base + i * 2 + 1) } })
  }
  await prisma.chat.update({ where: { id: chatJ }, data: { messageCount: 42 } })
  const rj = await api(COOKIE1, 'POST', `/api/v1/chats/${chatJ}/review`)
  const jobId = String(rj.body.data.jobId ?? '')
  const rjDup = await api(COOKIE1, 'POST', `/api/v1/chats/${chatJ}/review`)
  check('5e 21건 → {jobId}, 진행 중 재요청 409 CONFLICT {jobId}', rj.status === 200 && !!jobId && rjDup.status === 409 && rjDup.body.data.code === 'CONFLICT' && rjDup.body.data.details?.jobId === jobId, `dup=${rjDup.status}/${rjDup.body.data.code}`)
  let job: Record<string, unknown> = {}
  for (let i = 0; i < 60; i++) {
    await sleep(i < 10 ? 2000 : 5000)
    job = (await api(COOKIE1, 'GET', `/api/v1/jobs/${jobId}`)).body.data
    if (job.status === 'DONE' || job.status === 'FAILED') break
  }
  const jc = await api(COOKIE1, 'GET', `/api/v1/corrections?chatId=${chatJ}&limit=100`)
  const jp = await api(COOKIE1, 'GET', `/api/v1/proposals?chatId=${chatJ}&kind=ADD_STUDY_LOG`)
  const jpItem = (jp.body.data.items as { payload: Record<string, unknown> }[])[0]
  check('5f 잡 DONE → #34 교정·ADD_STUDY_LOG payload(D4 키)', job.status === 'DONE' && (jc.body.data.items as unknown[]).length > 0 && !!jpItem && ['summaryKo', 'strengths', 'focus', 'skippedMessages', 'messageCount', 'correctionCount', 'chatId'].every((k) => k in jpItem.payload), `job=${job.status} corrections=${(jc.body.data.items as unknown[]).length}`)

  // ── 7. 교정 채택·거절 ───────────────────────────────────────────────
  const [c1, c2] = items
  const surface = Array.from(c1.corrected).slice(0, 80).join('')
  const errBefore = (await prisma.learnerErrorStat.aggregate({ where: { userId: u1 }, _sum: { count: true } }))._sum.count ?? 0
  const acc = await api(COOKIE1, 'POST', `/api/v1/corrections/${c1.correctionId}/accept`, { addWord: { surface, meaning: '테스트 뜻', category: '교정', partOfSpeech: 'EXPRESSION' } })
  const wordId = String((acc.body.data.word as { id?: string } | null)?.id ?? '')
  const w = wordId ? await prisma.wordEntry.findUnique({ where: { id: wordId } }) : null
  const errAfter = await prisma.learnerErrorStat.aggregate({ where: { userId: u1 }, _sum: { count: true } })
  check('7a 교정 채택(addWord) → WordEntry(CORRECTION, sourceRefId=교정) + savedWordId + LearnerErrorStat +1', acc.status === 200 && w?.source === 'CORRECTION' && w.sourceRefId === c1.correctionId && (acc.body.data.correction as { savedWordId: string }).savedWordId === wordId && (errAfter._sum.count ?? 0) === errBefore + 1, `status=${acc.status} ${acc.body.message ?? ''}`)
  const acc2 = await api(COOKIE1, 'POST', `/api/v1/corrections/${c1.correctionId}/accept`, {})
  check('7b 재채택 409 {status:ACCEPTED}', acc2.status === 409 && acc2.body.data.details?.status === 'ACCEPTED')
  if (c2) {
    const dupWord = await api(COOKIE1, 'POST', `/api/v1/corrections/${c2.correctionId}/accept`, { addWord: { surface, meaning: '중복' } })
    const c2row = await prisma.correction.findUniqueOrThrow({ where: { id: c2.correctionId }, select: { status: true } })
    check('7c 같은 표현 → 409 {existingId}, 교정은 PROPOSED 로 롤백', dupWord.status === 409 && dupWord.body.data.details?.existingId === wordId && c2row.status === 'PROPOSED')
    const rej = await api(COOKIE1, 'POST', `/api/v1/corrections/${c2.correctionId}/reject`)
    const rej2 = await api(COOKIE1, 'POST', `/api/v1/corrections/${c2.correctionId}/reject`)
    check('7d 거절 → REJECTED, 재거절 409', rej.status === 200 && rej.body.data.status === 'REJECTED' && rej2.status === 409)
  }
  const after7 = await prisma.correction.findMany({ where: { chatId: chatA }, select: { id: true, original: true } })
  check('7e 채택·거절 전후 original 바이트 동일', after7.every((c) => Buffer.from(c.original).equals(Buffer.from(originalsBefore.get(c.id) ?? '\u0000'))))
  const addWordBad = await api(COOKIE1, 'POST', `/api/v1/corrections/${items[items.length - 1].correctionId}/accept`, { addWord: { surface: 'x', meaning: '' } })
  check('7f addWord 검증 400 details.field=addWord.meaning', addWordBad.status === 400 && addWordBad.body.data.details?.field === 'addWord.meaning')

  // ── 8. 제안 채택 ───────────────────────────────────────────────────
  const props = await api(COOKIE1, 'GET', `/api/v1/proposals?chatId=${chatA}&kind=ADD_STUDY_LOG`)
  const studyP = (props.body.data.items as { id: string; payload: Record<string, unknown> }[])[0]
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const snapBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: today } } })
  const sp = await api(COOKIE1, 'POST', `/api/v1/proposals/${studyP?.id}/accept`, {})
  const logId = String((sp.body.data.proposal as { result?: { studyLogId?: string } })?.result?.studyLogId ?? '')
  const log = logId ? await prisma.studyLog.findUnique({ where: { id: logId } }) : null
  const snapAfter = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: today } } })
  const chatTurns = (snapAfter?.data as { chatTurns?: number } | null)?.chatTurns ?? 0
  check('8a ADD_STUDY_LOG 채택 → StudyLog(ACCEPTED, CHAT) + DAILY 증가', sp.status === 200 && log?.origin === 'ACCEPTED' && log.type === 'CHAT' && chatTurns >= 10 && chatTurns > ((snapBefore?.data as { chatTurns?: number } | null)?.chatTurns ?? 0), `status=${sp.status} chatTurns=${chatTurns}`)
  const sp2 = await api(COOKIE1, 'POST', `/api/v1/proposals/${studyP?.id}/accept`, {})
  check('8b 재채택 409 {status:ACCEPTED}', sp2.status === 409 && sp2.body.data.details?.status === 'ACCEPTED')
  const mk = (kind: 'ADD_WORD' | 'SET_LEVEL', payload: object, expiresAt: Date) => prisma.tutorProposal.create({ data: { userId: u1, chatId: chatA, kind, payload, expiresAt } })
  const pw = await mk('ADD_WORD', { surface: '映画館', reading: 'えいがかん', meaning: '영화관' }, new Date(Date.now() + 86_400_000))
  const aw = await api(COOKIE1, 'POST', `/api/v1/proposals/${pw.id}/accept`, { payloadOverride: { meaning: '영화관(명사)' } })
  const tw = await prisma.wordEntry.findFirst({ where: { userId: u1, sourceRefId: pw.id } })
  check('8c ADD_WORD 채택 → WordEntry(TUTOR), payloadOverride 반영', aw.status === 200 && tw?.source === 'TUTOR' && tw.meaning === '영화관(명사)')
  const pe = await mk('ADD_WORD', { surface: '期限', reading: 'きげん', meaning: '기한' }, new Date(Date.now() - 1000))
  const ae = await api(COOKIE1, 'POST', `/api/v1/proposals/${pe.id}/accept`, {})
  check('8d 만료 제안 409 {status:EXPIRED}', ae.status === 409 && ae.body.data.details?.status === 'EXPIRED')
  const pl = await mk('SET_LEVEL', { level: 'N4' }, new Date(Date.now() + 86_400_000))
  const al = await api(COOKIE1, 'POST', `/api/v1/proposals/${pl.id}/accept`, {})
  check('8e 아직 안 여는 kind → 400 FEATURE_NOT_READY', al.status === 400 && al.body.data.code === 'FEATURE_NOT_READY')

  // ── 9. IDOR(두 번째 계정) ──────────────────────────────────────────
  const anyCorr = items[items.length - 1].correctionId
  const idor = [
    await api(COOKIE2, 'GET', `/api/v1/chats/${chatA}`),
    await api(COOKIE2, 'PATCH', `/api/v1/chats/${chatA}`, { title: 'x' }),
    await api(COOKIE2, 'DELETE', `/api/v1/chats/${chatA}`),
    { status: (await turn(COOKIE2, chatA, { text: 'こんにちは' })).status } as Res,
    { status: (await turn(COOKIE2, chatA, { resumePending: true })).status } as Res,
    await api(COOKIE2, 'POST', `/api/v1/chats/${chatA}/review`),
    await api(COOKIE2, 'GET', `/api/v1/corrections?chatId=${chatA}`),
    await api(COOKIE2, 'POST', `/api/v1/corrections/${anyCorr}/accept`, {}),
    await api(COOKIE2, 'POST', `/api/v1/corrections/${anyCorr}/reject`),
    await api(COOKIE2, 'GET', `/api/v1/proposals?chatId=${chatA}`),
    await api(COOKIE2, 'POST', `/api/v1/proposals/${pl.id}/accept`, {}),
    await api(COOKIE2, 'POST', `/api/v1/proposals/${pl.id}/reject`),
    await api(COOKIE2, 'GET', `/api/v1/jobs/${jobId}`),
  ]
  const stillThere = await prisma.chat.findUnique({ where: { id: chatA }, select: { title: true } })
  const u2rows = await prisma.chatMessage.count({ where: { userId: u2, createdAt: { gte: startedAt } } })
  check('9 타인 채팅·턴·재시도·점검·교정/제안 채택·거절·잡 → 전부 404(두 번째 계정 행 0)', idor.every((r) => r.status === 404) && stillThere?.title === '週末🎉の話😀' && u2rows === 0, idor.map((r) => r.status).join(','))

  // ── TALK 경로(교정 PROPOSED·원문 바이트 일치) ─────────────────────────
  const T = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'TALK' })
  const talkText = '昨日映画を見に行くました'
  const tt = await turnOk(COOKIE1, String(T.body.data.id), { text: talkText })
  const tdone = tt.events.find((e) => e.event === 'done')?.data as { correction?: { id: string; original: string; status: string } | null } | undefined
  const tcorr = tdone?.correction ? await prisma.correction.findUnique({ where: { id: tdone.correction.id } }) : null
  check('TALK 턴 교정 PROPOSED·original=서버 text 바이트 일치', !!tcorr && tcorr.status === 'PROPOSED' && Buffer.from(tcorr.original).equals(Buffer.from(talkText)), tdone ? JSON.stringify(tdone.correction).slice(0, 120) : tt.events.map((e) => e.event).join(','))
  const trv = await api(COOKIE1, 'POST', `/api/v1/chats/${String(T.body.data.id)}/review`)
  check('TALK 채팅 점검 → 400', trv.status === 400)

  // ── D1 resumePending ───────────────────────────────────────────────
  const r409 = await turn(COOKIE1, chatA, { resumePending: true })
  check('D1 마지막 강사 DONE 이면 resumePending 409', r409.status === 409)
  const lastA = await prisma.chatMessage.findFirstOrThrow({ where: { chatId: chatA, role: 'ASSISTANT' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  await prisma.chatMessage.update({ where: { id: lastA.id }, data: { status: 'FAILED' } })
  const countBefore = (await prisma.chat.findUniqueOrThrow({ where: { id: chatA } })).messageCount
  const rs = await turnOk(COOKIE1, chatA, { resumePending: true })
  const acc0 = rs.events[0]?.data as { assistantMessageId?: string } | undefined
  const lastAfter = await prisma.chatMessage.findUniqueOrThrow({ where: { id: lastA.id } })
  const countAfter = (await prisma.chat.findUniqueOrThrow({ where: { id: chatA } })).messageCount
  check('D1 FAILED → 같은 강사 행 재사용·DONE, 사용자 행·messageCount 그대로', acc0?.assistantMessageId === lastA.id && lastAfter.status === 'DONE' && countAfter === countBefore && rs.events.at(-1)?.event === 'done', `events=${rs.events.map((e) => e.event).join('→')}`)

  // ── 3. 동시 턴 409 + 분당 13번째 429(새 창에서) ───────────────────────
  console.log('  (분당 제한 창을 비우려고 61초 대기)')
  await sleep(61_000)
  const B = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT', title: '동시성' })
  const chatB = String(B.body.data.id)
  let runningId = ''
  const longEmoji = '😀'.repeat(130)
  const pending = turn(COOKIE1, chatB, { text: longEmoji }, { onAccepted: (e) => void (runningId = String(e.data.assistantMessageId)) })
  for (let i = 0; i < 50 && !runningId; i++) await sleep(100)
  const listB = await api(COOKIE1, 'GET', '/api/v1/chats?kind=CHAT&limit=50')
  const rowB = (listB.body.data.items as { id: string; preview: string; running: boolean }[]).find((c) => c.id === chatB)
  check('10c preview 120 코드포인트·깨진 서로게이트 없음(수락 직후)', !!rowB && cpLen(rowB.preview) <= 120 && !loneSurrogate.test(rowB.preview) && rowB.running, rowB ? `len=${cpLen(rowB.preview)} running=${rowB.running}` : 'no row')
  const statuses: number[] = []
  let conflictId: unknown = null
  for (let i = 0; i < 12; i++) {
    const r = await turn(COOKIE1, chatA, { text: `同時${i}` })
    statuses.push(r.status)
    if (r.status === 409 && conflictId === null) conflictId = r.envelope?.data.details?.runningMessageId
  }
  check('3a 같은 사용자 다른 채팅 동시 턴 → 409 {runningMessageId}', statuses[0] === 409 && conflictId === runningId, `runningMessageId 일치=${conflictId === runningId}`)
  check('3b 1분에 13번째 턴 → 429', statuses.slice(0, 11).every((s) => s === 409) && statuses[11] === 429, statuses.join(','))
  const rl = await turn(COOKIE1, chatA, { text: 'x' })
  check('3c 429 에 Retry-After 헤더·details.retryAfterSec', rl.status === 429 && typeof rl.envelope?.data.details?.retryAfterSec === 'number')
  await pending

  // ── 12. 엔진·모델명·toolLog 누출 ─────────────────────────────────
  check('12 사용자 응답(JSON·SSE)에 엔진·모델명·toolLog 0건', leakHits === 0, `hits=${leakHits}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS · 턴 p50=${p50}ms`)
  if (failed.length) console.log(`실패: ${failed.map((f) => f.id).join(', ')}`)
}

async function cleanup() {
  // QA 계정 두 개가 이 실행 중에 만든 행만 지운다(채팅 cascade → 메시지·교정).
  for (const email of ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test']) {
    const u = await prisma.user.findUnique({ where: { email } })
    if (!u) continue
    const since = { gte: startedAt }
    await prisma.tutorProposal.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.chat.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.wordEntry.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.studyLog.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.statsSnapshot.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.learnerErrorStat.deleteMany({ where: { userId: u.id, firstAt: since } })
    await prisma.aiJob.deleteMany({ where: { userId: u.id, createdAt: since } })
    await prisma.requestTrace.deleteMany({ where: { userId: u.id, createdAt: since } })
  }
  console.log('(QA 데이터 정리 완료)')
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('정리 실패:', e))
    await prisma.$disconnect()
  })
