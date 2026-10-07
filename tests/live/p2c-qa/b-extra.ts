/**
 * qa-p2c-B 항목 B 보강 — a3b2 스모크가 못 덮은 것: ① #169 본문 400 이 한도를 쓰지 않음(REV-142 L-4) ② #166 한도(분당 6) 경계(LLM 0: 없는 주제 400 은 한도 안) ③ #169 PRACTICE_BUSY·TURN_RUNNING
 * ④ 초안·연습 Trace 원문 0(응답 뒤 지연 기록이라 폴링) ⑤ 끝난 역할극 #29 에서 TALK 예열이 안 걸림(ps — 양성 대조: 일반 TALK #29 는 걸림) ⑥ #27 응답 시간.
 * 사용(서버 PID 는 SERVER_PID): BASE=http://127.0.0.1:3034 SERVER_PID=<pid> node --env-file=.env --import tsx tests/live/p2c-qa/b-extra.ts <QA4 쿠키> <QA2 쿠키>
 * 정리는 이 스크립트가 하지 않는다 — p2c-qa/final-cleanup.ts(SINCE) + b-state.ts restore.
 */
import { prisma } from '../../../src/modules/infra/db'
import { api, check, claudeKids, claudeOthers, cookieOf, details, doneOf, num, obj, reason, skip, sleep, startTurn, stats, summary, type Json } from './b-lib'

const [c4f, c2f] = process.argv.slice(2)
const C4 = cookieOf(c4f)
const C2 = cookieOf(c2f)
const NOTOPIC = 'c' + '0'.repeat(24)

async function main(): Promise<void> {
  const qa4 = await prisma.user.findFirstOrThrow({ where: { email: 'qa-bot4@thekaiwa.test', provider: 'test' }, select: { id: true } })
  const U = qa4.id
  const since = new Date()
  console.log(`[b-extra] since=${since.toISOString()} others(claude --print not mine)=${claudeOthers()} mine=${claudeKids().length}`)

  // 준비: 시드 상황으로 역할극 대화 1개(첫마디 있음) + 일반 TALK 1개
  const rp = await api(C4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: 'scn_cafe-order-drink' })
  const RP = String(rp.data.id ?? '')
  const plain = await api(C4, 'POST', '/api/v1/chats', { kind: 'TALK' })
  const PL = String(plain.data.id ?? '')
  check('0 준비: 시드 상황 역할극 #28 200 · 일반 TALK 200', rp.status === 200 && plain.status === 200 && !!RP && !!PL, `${rp.status}/${plain.status}`)
  const opening = (await prisma.chatMessage.findFirst({ where: { chatId: RP, role: 'ASSISTANT' }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ?? ''

  // ── X2 #169 잘못된 본문 400 은 한도를 쓰지 않는다(분당 10) ─────────────────────
  const t2 = Date.now()
  const bad: number[] = []
  for (let i = 0; i < 15; i++) bad.push((await api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, i % 3 === 0 ? { messageId: 123 } : i % 3 === 1 ? {} : { messageId: opening, save: true })).status)
  check('X2a #169 잘못된 본문 15번 전부 400(한도 10 초과해도)', bad.every((s) => s === 400), bad.join(','))
  const good: number[] = []
  for (let i = 0; i < 14; i++) {
    const r = await api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: 'no-such-message' })
    good.push(r.status)
    if (r.status === 429) break
  }
  const n409 = good.filter((s) => s === 409).length
  check('X2b 그 뒤 올바른 본문(DB 읽는 409 NOT_LATEST)이 정확히 10번 허용 → 11번째 429', n409 === 10 && good[10] === 429, `statuses=${good.join(',')}`)
  const r429 = await api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: 'no-such-message' })
  check('X2c 429 응답에 retry-after·표준 오류 모양', r429.status === 429 && !!r429.retryAfter, `retry-after=${String(r429.retryAfter)} code=${String(obj(r429.data).code ?? '')}`)

  // ── X3 #166 한도(분당 6) 경계 — LLM 0(없는 주제 id 는 한도 안에서 400) ─────────────
  const dr: number[] = []
  for (let i = 0; i < 8; i++) {
    const r = await api(C4, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 커피를 주문해요', level: 'N5', topicId: NOTOPIC })
    dr.push(r.status)
  }
  check('X3a #166 한도: 분당 6번째까지 400(topicId not_found, LLM 0) · 7·8번째 429', dr.slice(0, 6).every((s) => s === 400) && dr[6] === 429 && dr[7] === 429, dr.join(','))
  const bad166 = await api(C4, 'POST', '/api/v1/scenarios/drafts', { description: '카페 ', level: 'N5' })
  check('X3b 한도 중에도 본문 오류는 400(한도 앞)', bad166.status === 400, `status=${bad166.status}`)

  // 창 초기화 대기(61s 이상 — X2 시작 기준)
  const wait = Math.max(0, 62_000 - (Date.now() - t2))
  console.log(`(한도 창 초기화 대기 ${Math.round(wait / 1000)}s)`)
  await sleep(wait)

  // ── X4 #169 PRACTICE_BUSY(같은 대화 동시 2건) ───────────────────────────────
  const [pa, pb] = await Promise.all([api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening }), api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening })])
  const st = [pa.status, pb.status].sort()
  const busy = [pa, pb].find((x) => x.status === 409)
  check('X4 #169 같은 대화 동시 2건 → {200, 409 PRACTICE_BUSY}', st[0] === 200 && st[1] === 409 && reason(busy!.data) === 'PRACTICE_BUSY', `${pa.status}/${pb.status} reason=${String(busy ? reason(busy.data) : '-')} ms=${pa.ms}/${pb.ms}`)

  // ── X5 #169 TURN_RUNNING(턴 진행 중) ────────────────────────────────────────
  const run = startTurn(C4, RP, 'ラテをください。')
  const head = await run.head
  const during = await api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening })
  check('X5 #169 턴 진행 중 → 409 TURN_RUNNING', head.sse && during.status === 409 && reason(during.data) === 'TURN_RUNNING', `turn=${head.status} practice=${during.status}:${String(reason(during.data))}`)
  const fin = await run.finished
  check('X5b 턴은 정상 done', fin.status === 200 && !!doneOf(fin.events).traceId, `status=${fin.status}`)

  // ── X1 초안·연습 Trace 원문 0(폴링) ───────────────────────────────────────────
  const dsc = '회사 근처 카페에서 아이스커피를 사이즈까지 정해서 주문하고 싶어요'
  const sinceD = new Date(Date.now() - 500)
  const draft = await api(C4, 'POST', '/api/v1/scenarios/drafts', { description: dsc, level: 'N5' })
  let dtr: { steps: unknown; createdAt: Date }[] = []
  let dLag = -1
  for (let i = 0; i < 40; i++) {
    dtr = await prisma.requestTrace.findMany({ where: { userId: U, refType: 'scenarioDraft', createdAt: { gte: sinceD } }, select: { steps: true, createdAt: true } })
    if (dtr.length) { dLag = i * 250; break }
    await sleep(250)
  }
  check('X1a #166 초안 200 → Trace 행이 (지연 기록으로) 생김', draft.status === 200 && dtr.length >= 1, `status=${draft.status} ${draft.ms}ms Trace지연≈${dLag}ms rows=${dtr.length}`)
  const dtext = JSON.stringify(dtr)
  check('X1b 초안 Trace 에 입력 원문 0(아이스커피·사이즈까지)', dtr.length >= 1 && !dtext.includes('아이스커피') && !dtext.includes('사이즈까지') && !dtext.includes(String(obj(draft.data.draft).title ?? '\u0000')))

  const last = await prisma.chatMessage.findFirst({ where: { chatId: RP, role: 'ASSISTANT', status: 'DONE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, content: true } })
  const sinceP = new Date(Date.now() - 500)
  const pr = await api(C4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: last?.id ?? '' })
  let ptr: { steps: unknown }[] = []
  let pLag = -1
  for (let i = 0; i < 40; i++) {
    ptr = await prisma.requestTrace.findMany({ where: { userId: U, refType: 'replyPractice', refId: RP, createdAt: { gte: sinceP } }, select: { steps: true } })
    if (ptr.length) { pLag = i * 250; break }
    await sleep(250)
  }
  const ptext = JSON.stringify(ptr)
  check('X1c #169 연습 200 · Trace 행 생김', pr.status === 200 && ptr.length === 1, `status=${pr.status} ${pr.ms}ms Trace지연≈${pLag}ms rows=${ptr.length}`)
  check('X1d 연습 Trace 에 선생님 말·제안 문장 원문 0', ptr.length === 1 && !ptext.includes((last?.content ?? '\u0000').slice(0, 8)) && !ptext.includes(String(pr.data.ja ?? '\u0000').slice(0, 8)) && !ptext.includes(String(pr.data.ko ?? '\u0000').slice(0, 8)))

  // ── X6 끝난 역할극 #29 → TALK 예열 안 걸림(양성 대조 포함) ─────────────────────
  const finr = await api(C4, 'POST', `/api/v1/chats/${RP}/scenario/finish`)
  check('X6a 마치기 200(턴 1회 있음)', finr.status === 200, `status=${finr.status} outcome=${String(finr.data.outcome)} judged=${String(finr.data.judged)} ${finr.ms}ms`)
  for (const pid of claudeKids()) { try { process.kill(pid) } catch { /* 이미 끝남 */ } }
  await sleep(1500)
  check('X6b 예열 프로세스 정리됨(시작 조건 0)', claudeKids().length === 0, `kids=${claudeKids().length}`)
  const g1 = await api(C4, 'GET', `/api/v1/chats/${RP}`)
  await sleep(3000)
  const afterEnded = claudeKids().length
  check('X6c 끝난 역할극 #29(after 없음) → 예열 프로세스 0', g1.status === 200 && afterEnded === 0, `status=${g1.status} claudeKids=${afterEnded}`)
  const g2 = await api(C4, 'GET', `/api/v1/chats/${PL}`)
  await sleep(3000)
  const afterPlain = claudeKids().length
  check('X6d 양성 대조: 일반 TALK #29 → 예열 프로세스 ≥1', g2.status === 200 && afterPlain >= 1, `status=${g2.status} claudeKids=${afterPlain}`)

  // ── X7 #27 목록 응답 시간(역할극 행 포함) ─────────────────────────────────────
  const ms: number[] = []
  let first: Json = {}
  for (let i = 0; i < 6; i++) {
    const r = await api(C4, 'GET', '/api/v1/chats?kind=TALK&limit=50')
    ms.push(r.ms)
    if (!i) first = r.data
  }
  const items = (Array.isArray(first.items) ? first.items : []) as Json[]
  const rpRow = items.find((i) => i.id === RP)
  check('X7 #27 목록: 끝난 역할극 행 scenario{id, ended:true} · 일반 행 칸 없음', JSON.stringify(rpRow?.scenario) === JSON.stringify({ id: 'scn_cafe-order-drink', ended: true }) && !('scenario' in (items.find((i) => i.id === PL) ?? { scenario: 1 })), `n=${items.length} ms=[${ms.join(',')}]`)
  // IDOR 한 번 더: QA2 가 #169·#167·#29
  const i1 = await api(C2, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening })
  check('X8 IDOR: QA2 의 #169 → 404', i1.status === 404, `status=${i1.status}`)
  check('X9 응답에 엔진명 0', stats.leak === 0, `hits=${stats.leak}`)
  void num; void details; void skip
}

main().catch((e) => check('run', false, String(e))).finally(async () => { await prisma.$disconnect(); summary() })
