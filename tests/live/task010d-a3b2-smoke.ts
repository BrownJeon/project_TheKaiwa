/**
 * task-010d A3b-2 라이브 스모크 — #166 AI 상황 초안 · #169 대답 연습 · #27 목록 역할극 칸 · #29 마친 역할극 · IDOR 를 **실제 개발 서버(localhost)·실제 DB** 로 친다.
 * 작성만 했고 실행은 QA 몫이다(developer 는 실행하지 않음).
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test`(상황 역할극 레인) = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR·남의 장소).
 * 단계(LLM 0 / LLM 구분):
 *   [LLM 0] 1 준비: QA4 내 상황 1개(#163, 제목 접두 MARK) · 역할극 대화(#28, 첫마디 저장) · 일반 TALK 대화 · QA2 주제 1개(없으면 이 실행이 MARK 로 만든다)
 *   [LLM 0] 2 #166 본문 검사: 화이트리스트 밖 키·5자 미만·꺾쇠·수준·QA2 주제(남의 장소) → 400 칸 · Trace 0
 *   [LLM 0] 3 #169: QA2 가 QA4 대화 → 404 · 일반 TALK → 404 · 마지막이 아닌 메시지 → 409 NOT_LATEST · 화이트리스트 밖 키 400
 *   [LLM 0] 4 #27 목록: 역할극 행 `scenario{id, ended:false}` · 일반 TALK 행은 칸 없음
 *   [LLM]   5 #166 정상 → 200 {draft}(행 0) → 그 초안을 #163 에 그대로 저장 201(서버 검사 통과) · 상황 아닌 글 → 422 NOT_A_SCENARIO(모델 판정 — 실패면 모델 품질 문제로 기록)
 *   [LLM]   6 #169 정상(첫마디에 대한 연습) → 200 {messageId, ja, ko, 고르기 세트는 통째로} · 행 수 불변(메시지·교정·StudyLog·관측) · Trace 원문 0 · 지연 출력(목표 ≤12s)
 *   [LLM]   7 턴 1회 → #167 마치기 → #169 409 ENDED · #27 행 `ended:true` · #29 `scenario.ended` · 첫 종료 응답 endedAt = #29 ended.endedAt(REV-140 L-2)
 * LLM 직렬 슬롯: 초안 2 + 연습 1 + 턴 1 + 종료 판정 1 = 5회. 다른 LLM 스모크와 동시에 돌리지 않는다. `SMOKE_LLM=0` 이면 1~4 만.
 * 정리: 이 실행이 만든 행만 — 대화(메시지·교정 cascade)·그 대화의 StudyLog·관측·Trace·반복 항목·상황(MARK)·주제(MARK)·QA4 오늘 DAILY 는 시작 전 값으로.
 *
 * 가드: `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 거부 · BASE 는 localhost 만, 포트 3010(운영) 거부.
 * 실행(우분투 미러, 개발 서버는 따로 — 예 `PORT=3029`):
 *   QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q4 && QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q2
 *   BASE=http://127.0.0.1:3029 node --env-file=.env --import tsx tests/live/task010d-a3b2-smoke.ts /tmp/q4 /tmp/q2 ; rm /tmp/q4 /tmp/q2
 * 끝 줄 `RESULT pass=N fail=M skip=K`, 실패가 있으면 종료 코드 1.
 */
import { readFileSync } from 'node:fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../src/modules/infra/db'
import { todayKst } from '../../src/modules/infra/dates'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다(새 API — 개발 서버 전용)')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3029'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const LLM_ON = process.env.SMOKE_LLM !== '0'
const [c4file, c2file] = process.argv.slice(2)
if (!c4file || !c2file) throw new Error('사용: task010d-a3b2-smoke.ts <QA4 쿠키 파일> <QA2 쿠키 파일>')
const COOKIE4 = readFileSync(c4file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE4 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 결과를 확인')

const MARK = `smkA3b2-${Date.now().toString(36)}`
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|SCENARIO_OPENING/i
let leakHits = 0
const results: { id: string; ok: boolean | null; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
function skip(id: string, note: string): void {
  results.push({ id, ok: null, note })
  console.log(`SKIP ${id} — ${note}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Trace 는 응답 뒤 `void recordTrace` 로 늦게 쓰인다(0.25~1.8초) — `ready` 가 참이 될 때까지 최대 5초(250ms 간격) 다시 읽는다. 끝내 안 되면 마지막 값을 그대로 돌려줘 판정이 FAIL 로 드러난다(기대값은 그대로). */
async function pollUntil<T>(read: () => Promise<T>, ready: (v: T) => boolean, timeoutMs = 5_000, stepMs = 250): Promise<T> {
  const until = Date.now() + timeoutMs
  let v = await read()
  while (!ready(v) && Date.now() < until) {
    await sleep(stepMs)
    v = await read()
  }
  return v
}
type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json; ms: number }> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let data: Json = {}
  try {
    data = obj((JSON.parse(text) as { data?: unknown }).data)
  } catch {
    data = {}
  }
  return { status: r.status, data, ms: Math.round(performance.now() - t0) }
}
const details = (d: Json) => obj(d.details)

/** 턴 1회(SSE 를 끝까지 읽기만) — 429·다른 턴 진행 중 409 는 잠깐 기다렸다 다시. */
async function turnOnce(cookie: string, chatId: string, text: string): Promise<number> {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
    const body = await r.text()
    if (LEAK.test(body)) leakHits++
    if (r.status !== 429 && r.status !== 409) return r.status
    await sleep(r.status === 429 ? 15_000 : 2_000)
  }
  return 0
}

const made = { chatIds: [] as string[], scenarioIds: [] as string[], topicIds: [] as string[], since: new Date() }

const SCENARIO_BODY = {
  title: `${MARK} 카페 주문`,
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '음료를 사이즈까지 정해 주문한다', successCriteria: ['음료 이름을 말했다'] },
  steps: [{ ko: '음료 말하기' }, { ko: '사이즈 말하기' }],
  keyExpressions: [
    { ja: 'アイスコーヒーをください', ko: '아이스커피 주세요' },
    { ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요' },
  ],
  opening: { ja: 'いらっしゃいませ。ご注文はお決まりですか。', ko: '어서 오세요. 주문하시겠어요?' },
}

async function rowCounts(U: string, chatId: string) {
  const [msgs, corr, logs, obs] = await Promise.all([
    prisma.chatMessage.count({ where: { chatId } }),
    prisma.correction.count({ where: { chatId } }),
    prisma.studyLog.count({ where: { userId: U, refId: chatId } }),
    prisma.learningObservation.count({ where: { userId: U, refId: chatId } }),
  ])
  return { msgs, corr, logs, obs }
}

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true } })
  if (!qa4 || !qa2) throw new Error('QA4·QA2 계정이 없다(qa-session.ts 로 먼저 만든다)')
  const U = qa4.id
  const U2 = qa2.id
  const today = todayKst()
  const dailyBefore = await prisma.statsSnapshot.findFirst({ where: { userId: U, kind: 'DAILY', periodKey: today }, select: { id: true, data: true } })
  made.since = new Date(Date.now() - 1000)
  try {
    // ── 1 준비 [LLM 0] ───────────────────────────────────────────────────
    const sc = await api(COOKIE4, 'POST', '/api/v1/scenarios', SCENARIO_BODY)
    const SID = String(sc.data.id ?? '')
    if (SID) made.scenarioIds.push(SID)
    check('1a 내 상황 만들기 201', sc.status === 201 && !!SID, `status=${sc.status}`)
    const rp = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: SID })
    const RP = String(rp.data.id ?? '')
    if (RP) made.chatIds.push(RP)
    check('1b 역할극 대화 시작(첫마디 1행)', rp.status === 200 && rp.data.messageCount === 1, `status=${rp.status}`)
    const plain = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK' })
    const PLAIN = String(plain.data.id ?? '')
    if (PLAIN) made.chatIds.push(PLAIN)
    let otherTopic = await prisma.conversationTopic.findFirst({ where: { userId: U2 }, select: { id: true } })
    if (!otherTopic) {
      otherTopic = await prisma.conversationTopic.create({ data: { userId: U2, title: `${MARK} 남의 장소`, level: 'N5' } as Prisma.ConversationTopicUncheckedCreateInput, select: { id: true } })
      made.topicIds.push(otherTopic.id)
    }
    const opening = (await prisma.chatMessage.findFirst({ where: { chatId: RP, role: 'ASSISTANT' }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ?? ''

    // ── 2 #166 본문 검사 [LLM 0] ─────────────────────────────────────────
    const tracesBefore = await prisma.requestTrace.count({ where: { userId: U, refType: 'scenarioDraft', createdAt: { gte: made.since } } })
    const d1 = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 커피를 주문해요', level: 'N5', topicIds: ['x'] })
    check('2a 화이트리스트 밖 키 400', d1.status === 400 && details(d1.data).reason === 'unknown_key')
    const d2 = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '카페 ', level: 'N5' })
    check('2b 5자 미만 400 description', d2.status === 400 && details(d2.data).field === 'description')
    const d3 = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 <b>커피</b> 주문', level: 'N5' })
    check('2c 꺾쇠 400', d3.status === 400 && details(d3.data).reason === 'forbidden_char')
    const d4 = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 커피를 주문해요', level: 'N9' })
    check('2d 수준 400', d4.status === 400 && details(d4.data).field === 'level')
    const d5 = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 커피를 주문해요', level: 'N5', topicId: otherTopic.id })
    check('2e 남의 장소(QA2 주제) 400 topicId not_found', d5.status === 400 && details(d5.data).field === 'topicId' && details(d5.data).reason === 'not_found')
    const tracesAfter = await prisma.requestTrace.count({ where: { userId: U, refType: 'scenarioDraft', createdAt: { gte: made.since } } })
    check('2f 본문 오류는 LLM 0(Trace 0)', tracesAfter === tracesBefore)

    // ── 3 #169 거절 [LLM 0] ──────────────────────────────────────────────
    const p1 = await api(COOKIE2, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening })
    check('3a IDOR: QA2 가 QA4 대화 → 404', p1.status === 404)
    const p2 = await api(COOKIE4, 'POST', `/api/v1/chats/${PLAIN}/reply-practice`, { messageId: opening })
    check('3b 일반 TALK → 404', p2.status === 404)
    const p3 = await api(COOKIE4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: 'no-such-message' })
    check('3c 마지막이 아닌 메시지 → 409 NOT_LATEST', p3.status === 409 && details(p3.data).reason === 'NOT_LATEST')
    const p4 = await api(COOKIE4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening, save: true })
    check('3d 화이트리스트 밖 키 400', p4.status === 400)

    // ── 4 #27 목록 [LLM 0] ───────────────────────────────────────────────
    const list = await api(COOKIE4, 'GET', '/api/v1/chats?kind=TALK&limit=50')
    const items = (Array.isArray(list.data.items) ? list.data.items : []) as Json[]
    const rpRow = items.find((i) => i.id === RP)
    const plainRow = items.find((i) => i.id === PLAIN)
    check('4a 역할극 행 scenario{id, ended:false}', JSON.stringify(rpRow?.scenario) === JSON.stringify({ id: SID, ended: false }))
    check('4b 일반 TALK 행은 scenario 칸 없음', !!plainRow && !('scenario' in plainRow))

    if (!LLM_ON) {
      skip('5~7', 'SMOKE_LLM=0')
      return
    }
    // ── 5 #166 정상·거절 [LLM] ───────────────────────────────────────────
    const scBefore = await prisma.scenario.count({ where: { userId: U } })
    const ok = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '회사 근처 카페에서 아이스커피를 사이즈까지 정해서 주문하고 싶어요', level: 'N5' })
    const draft = obj(ok.data.draft)
    check('5a 초안 200 {draft} · 행 0', ok.status === 200 && typeof draft.title === 'string' && (await prisma.scenario.count({ where: { userId: U } })) === scBefore, `${ok.ms}ms status=${ok.status}`)
    if (ok.status === 200) {
      const saved = await api(COOKIE4, 'POST', '/api/v1/scenarios', { ...draft, title: `${MARK} ${String(draft.title).slice(0, 20)}` })
      if (saved.data.id) made.scenarioIds.push(String(saved.data.id))
      check('5b 초안을 그대로 #163 저장 201(서버 검사 통과)', saved.status === 201, `status=${saved.status} ${JSON.stringify(details(saved.data)).slice(0, 120)}`)
    }
    const no = await api(COOKIE4, 'POST', '/api/v1/scenarios/drafts', { description: '안녕하세요 반가워요 오늘 날씨 좋네요', level: 'N5' })
    check('5c 상황 아닌 글 422 NOT_A_SCENARIO(모델 판정)', no.status === 422 && details(no.data).reason === 'NOT_A_SCENARIO', `${no.ms}ms status=${no.status}`)
    const dtr = await pollUntil(() => prisma.requestTrace.findMany({ where: { userId: U, refType: 'scenarioDraft', createdAt: { gte: made.since } }, select: { steps: true } }), (r) => r.length >= 2)
    check('5d 초안 Trace 원문 0', dtr.length >= 2 && !JSON.stringify(dtr).includes('아이스커피') && !JSON.stringify(dtr).includes('날씨'))

    // ── 6 #169 정상 [LLM] ────────────────────────────────────────────────
    const before = await rowCounts(U, RP)
    const pr = await api(COOKIE4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: opening })
    const sug = pr.data
    const set = Array.isArray(sug.choices) && sug.blank && typeof sug.answerIndex === 'number'
    const setOk = set ? Array.from(String(sug.ja)).slice(Number(obj(sug.blank).start), Number(obj(sug.blank).end)).join('') === (sug.choices as string[])[sug.answerIndex as number] : !('choices' in sug) && !('blank' in sug)
    check('6a 연습 200 {messageId, ja, ko} · 고르기 세트 통째로', pr.status === 200 && sug.messageId === opening && typeof sug.ja === 'string' && typeof sug.ko === 'string' && setOk, `${pr.ms}ms set=${set}`)
    check('6b 12초 안', pr.ms <= 12_500, `${pr.ms}ms`)
    check('6c 저장 없음(메시지·교정·StudyLog·관측 행 불변)', JSON.stringify(await rowCounts(U, RP)) === JSON.stringify(before))
    const ptr = await pollUntil(() => prisma.requestTrace.findMany({ where: { userId: U, refType: 'replyPractice', refId: RP }, select: { steps: true } }), (r) => r.length >= 1)
    check('6d 연습 Trace 원문 0', ptr.length === 1 && !JSON.stringify(ptr).includes('いらっしゃいませ') && !JSON.stringify(ptr).includes(String(sug.ja)))

    // ── 7 마친 역할극 [LLM: 턴 1 + 판정 1] ─────────────────────────────
    const ts = await turnOnce(COOKIE4, RP, 'アイスコーヒーをください')
    check('7a 턴 200', ts === 200, `status=${ts}`)
    await sleep(500)
    const fin = await api(COOKIE4, 'POST', `/api/v1/chats/${RP}/scenario/finish`)
    check('7b 마치기 200', fin.status === 200, `status=${fin.status}`)
    const last = await prisma.chatMessage.findFirst({ where: { chatId: RP }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } })
    const pe = await api(COOKIE4, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: last?.id ?? '' })
    check('7c 마친 역할극 연습 409 ENDED(LLM 0)', pe.status === 409 && details(pe.data).reason === 'ENDED')
    const list2 = await api(COOKIE4, 'GET', '/api/v1/chats?kind=TALK&limit=50')
    const row2 = ((Array.isArray(list2.data.items) ? list2.data.items : []) as Json[]).find((i) => i.id === RP)
    check('7d #27 역할극 행 ended:true', JSON.stringify(row2?.scenario) === JSON.stringify({ id: SID, ended: true }))
    const det = await api(COOKIE4, 'GET', `/api/v1/chats/${RP}?limit=1`)
    const ended = obj(obj(obj(det.data.chat).scenario).ended)
    check('7e #29 scenario.ended · 첫 종료 응답 endedAt 과 같다(L-2)', !!ended.endedAt && ended.endedAt === fin.data.endedAt, `${String(fin.data.endedAt)} vs ${String(ended.endedAt)}`)
    const p5 = await api(COOKIE2, 'POST', `/api/v1/chats/${RP}/reply-practice`, { messageId: last?.id ?? '' })
    check('7f IDOR: 마친 뒤에도 QA2 → 404(409 아님 — 존재 숨김)', p5.status === 404)
    check('8a 응답에 엔진명 0', leakHits === 0, `hits=${leakHits}`)
  } finally {
    await cleanup(U, today, dailyBefore)
  }
}

async function cleanup(U: string, today: string, dailyBefore: { id: string; data: Prisma.JsonValue } | null): Promise<void> {
  try {
    const msgIds = made.chatIds.length ? (await prisma.chatMessage.findMany({ where: { chatId: { in: made.chatIds } }, select: { id: true } })).map((m) => m.id) : []
    const corrIds = made.chatIds.length ? (await prisma.correction.findMany({ where: { chatId: { in: made.chatIds } }, select: { id: true } })).map((c) => c.id) : []
    const refIds = [...made.chatIds, ...msgIds, ...corrIds]
    if (refIds.length) {
      await prisma.learningObservation.deleteMany({ where: { userId: U, refId: { in: refIds }, occurredAt: { gte: made.since } } })
      await prisma.studyLog.deleteMany({ where: { userId: U, refId: { in: refIds }, createdAt: { gte: made.since } } })
    }
    if (made.scenarioIds.length) await prisma.repetitionItem.deleteMany({ where: { userId: U, refType: 'Scenario', refId: { in: made.scenarioIds }, createdAt: { gte: made.since } } })
    await prisma.requestTrace.deleteMany({ where: { userId: U, refType: { in: ['scenarioDraft', 'replyPractice', 'scenarioFinish'] }, createdAt: { gte: made.since } } })
    if (made.chatIds.length) await prisma.requestTrace.deleteMany({ where: { userId: U, refId: { in: made.chatIds }, createdAt: { gte: made.since } } })
    await prisma.chat.deleteMany({ where: { id: { in: made.chatIds } } })
    const sc = await prisma.scenario.deleteMany({ where: { id: { in: made.scenarioIds }, title: { startsWith: MARK } } })
    const tp = made.topicIds.length ? await prisma.conversationTopic.deleteMany({ where: { id: { in: made.topicIds }, title: { startsWith: MARK } } }) : { count: 0 }
    if (dailyBefore) await prisma.statsSnapshot.update({ where: { id: dailyBefore.id }, data: { data: dailyBefore.data as Prisma.InputJsonValue } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U, kind: 'DAILY', periodKey: today } })
    console.log(`(정리: 대화 ${made.chatIds.length} · 상황 ${sc.count} · 주제 ${tp.count} · DAILY ${dailyBefore ? '되돌림' : '삭제'})`)
  } catch (e) {
    console.log(`! 정리 실패 — 수동 확인 필요(MARK=${MARK}): ${String(e)}`)
  }
}

main()
  .catch((e) => check('run', false, String(e)))
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((x) => x.ok === false).length
    const skipped = results.filter((x) => x.ok === null).length
    console.log(`RESULT pass=${results.length - fail - skipped} fail=${fail} skip=${skipped}`)
    process.exitCode = fail ? 1 : 0
  })
