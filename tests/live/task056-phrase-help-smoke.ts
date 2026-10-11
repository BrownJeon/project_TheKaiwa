/**
 * task-056 #180 회화방 일본어 도우미(`POST /api/v1/chats/:id/phrase-help`) 라이브 스모크 — **실제 개발 서버(localhost)·실제 DB** 로 친다.
 * 작성만 했고 실행은 QA 몫이다(developer 는 실행하지 않음 — 공유 NAS DB).
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test` = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR).
 * 단계(LLM 0 / LLM 구분):
 *   [LLM 0] 1 준비: QA4 내 상황 1개(#163, 제목 접두 MARK) · 역할극 대화(#28) · 일반 TALK 대화 · CHAT 대화
 *   [LLM 0] 2 본문 400 8종(type·required·max_length·forbidden_char·no_text·no_hangul·secret_like·unknown_key) — field·reason·한국어 message · Trace 0
 *   [LLM 0] 3 404: QA2 가 QA4 대화 · CHAT 대화 · 없는 id
 *   [LLM]   4 일반 TALK 정상 → 200 {items 1~3 · ja·ko 글 · labelKo·whyKo 는 있으면 글} · `Cache-Control: private, no-store` · 12초 안 · Trace 1행(원문 0, scene NONE)
 *   [LLM]   5 역할극 방 정상 → 200 · Trace scene OK
 *   [LLM]   6 문법 질문(모델 판정) → 200 `{items: []}` — 실패면 모델 품질 문제로 기록(계약 결함 아님)
 *   [LLM 0] 7 행 수 불변(4~6 전후): 메시지·교정·StudyLog·관측·단어장·반복 항목·제안·오늘 DAILY
 *   [LLM 0] 8 마친 역할극(이 실행이 만든 대화의 `endedAt` 을 직접 채움) → 409 ENDED
 *   [LLM 1] 9 같은 사용자 동시 2건 → 하나 200 · 하나 409 PHRASE_BUSY
 *   [LLM 2] 10 (선택 `SMOKE_CONTENTION=1`) 도우미 진행 중 턴 전송 → 턴 첫 바이트까지 ms 출력(판정 없음, Leader 결정 1 QA 측정 항목). 턴이 행을 만들므로 7 뒤에 둔다.
 * 한도: QA4 의 한도 소모(404·409·200)는 1~9 단계 합쳐 8건 — 분당 10 을 넘지 않게 한 번에 한 실행만. 다른 LLM 스모크와 동시에 돌리지 않는다. `SMOKE_LLM=0` 이면 1~3·8 만.
 * 정리: 이 실행이 만든 행만 — 대화(메시지·교정 cascade)·그 대화의 StudyLog·관측·Trace(phraseHelp·턴)·상황(MARK)·QA4 오늘 DAILY 는 시작 전 값으로.
 *
 * 가드: `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 거부 · BASE 는 localhost 만, 포트 3010(운영) 거부.
 * 실행(우분투 미러, 개발 서버는 따로 — 예 `PORT=3029`):
 *   QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q4 && QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q2
 *   BASE=http://127.0.0.1:3029 node --env-file=.env --import tsx tests/live/task056-phrase-help-smoke.ts /tmp/q4 /tmp/q2 ; rm /tmp/q4 /tmp/q2
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
const CONTENTION = process.env.SMOKE_CONTENTION === '1'
const [c4file, c2file] = process.argv.slice(2)
if (!c4file || !c2file) throw new Error('사용: task056-phrase-help-smoke.ts <QA4 쿠키 파일> <QA2 쿠키 파일>')
const COOKIE4 = readFileSync(c4file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE4 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 결과를 확인')

const MARK = `smk056-${Date.now().toString(36)}`
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2/i
const Q_PLAIN = '오늘 날씨가 좋아서 산책하고 싶어요'
const Q_ROLE = '봉투는 필요 없어요'
const Q_GRAMMAR = '「は」와 「が」의 차이를 설명해 주세요'
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
/** Trace 는 응답 뒤 `void recordTrace` 로 늦게 쓰인다 — `ready` 가 참이 될 때까지 최대 5초 다시 읽는다. */
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
const details = (d: Json) => obj(d.details)

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json; message: string | null; ms: number; cache: string | null }> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let data: Json = {}
  let message: string | null = null
  try {
    const j = JSON.parse(text) as { data?: unknown; message?: unknown }
    data = obj(j.data)
    message = typeof j.message === 'string' ? j.message : null
  } catch {
    data = {}
  }
  return { status: r.status, data, message, ms: Math.round(performance.now() - t0), cache: r.headers.get('Cache-Control') }
}
const help = (cookie: string, chatId: string, queryKo: unknown) => api(cookie, 'POST', `/api/v1/chats/${chatId}/phrase-help`, { queryKo })

/** 항목 모양 — 1~3개, ja·ko 는 비지 않은 글, 꼬리표·이유는 있으면 글, 그 밖 칸 없음. */
function itemsOk(items: unknown): boolean {
  if (!Array.isArray(items) || items.length < 1 || items.length > 3) return false
  return items.every((it) => {
    const o = obj(it)
    const keysOk = Object.keys(o).every((k) => ['ja', 'ko', 'labelKo', 'whyKo'].includes(k))
    const opt = (v: unknown) => v === undefined || (typeof v === 'string' && v.length > 0)
    return keysOk && typeof o.ja === 'string' && o.ja.length > 0 && typeof o.ko === 'string' && o.ko.length > 0 && opt(o.labelKo) && opt(o.whyKo) && !/[가-힣]/.test(o.ja)
  })
}

const made = { chatIds: [] as string[], scenarioIds: [] as string[], since: new Date() }

const SCENARIO_BODY = {
  title: `${MARK} 편의점 계산`,
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '편의점 계산대에서 봉투 질문에 답하고 계산한다', successCriteria: ['봉투 필요 여부를 말했다'] },
  steps: [{ ko: '봉투 질문에 답하기' }, { ko: '계산하기' }],
  keyExpressions: [
    { ja: '袋は大丈夫です', ko: '봉투는 괜찮아요' },
    { ja: 'カードでお願いします', ko: '카드로 부탁해요' },
  ],
  opening: { ja: 'いらっしゃいませ。袋はご利用ですか。', ko: '어서 오세요. 봉투 필요하세요?' },
}

async function rowCounts(U: string) {
  const since = made.since
  const [msgs, corr, logs, obs, words, reps, props, daily] = await Promise.all([
    prisma.chatMessage.count({ where: { chatId: { in: made.chatIds } } }),
    prisma.correction.count({ where: { chatId: { in: made.chatIds } } }),
    prisma.studyLog.count({ where: { userId: U, createdAt: { gte: since } } }),
    prisma.learningObservation.count({ where: { userId: U, occurredAt: { gte: since } } }),
    prisma.wordEntry.count({ where: { userId: U } }),
    prisma.repetitionItem.count({ where: { userId: U } }),
    prisma.tutorProposal.count({ where: { userId: U } }),
    prisma.statsSnapshot.findFirst({ where: { userId: U, kind: 'DAILY', periodKey: todayKst() }, select: { data: true } }),
  ])
  return { msgs, corr, logs, obs, words, reps, props, daily: JSON.stringify(daily?.data ?? null) }
}

const traceRows = (U: string) => prisma.requestTrace.findMany({ where: { userId: U, refType: 'phraseHelp', createdAt: { gte: made.since } }, orderBy: { createdAt: 'asc' }, select: { refId: true, status: true, steps: true } })
const stepOf = (row: { steps: Prisma.JsonValue } | undefined): Json => obj(Array.isArray(row?.steps) ? row.steps[0] : null)

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true } })
  if (!qa4 || !qa2) throw new Error('QA4·QA2 계정이 없다(qa-session.ts 로 먼저 만든다)')
  const U = qa4.id
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
    const plain = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK' })
    const PLAIN = String(plain.data.id ?? '')
    if (PLAIN) made.chatIds.push(PLAIN)
    const chatRoom = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'CHAT' })
    const CHAT = String(chatRoom.data.id ?? '')
    if (CHAT) made.chatIds.push(CHAT)
    check('1b 역할극·일반 TALK·CHAT 대화 준비', !!RP && !!PLAIN && !!CHAT, `rp=${rp.status} plain=${plain.status} chat=${chatRoom.status}`)

    // ── 2 본문 400 [LLM 0] ───────────────────────────────────────────────
    const cases: [string, unknown, string, string][] = [
      ['type', { queryKo: 123 }, 'queryKo', 'type'],
      ['required', { queryKo: '   ' }, 'queryKo', 'required'],
      ['max_length', { queryKo: '가'.repeat(101) }, 'queryKo', 'max_length'],
      ['forbidden_char', { queryKo: '<b>안녕</b> 라고 말하고 싶어' }, 'queryKo', 'forbidden_char'],
      ['no_text', { queryKo: '?!...!!' }, 'queryKo', 'no_text'],
      ['no_hangul', { queryKo: 'I want a coffee' }, 'queryKo', 'no_hangul'],
      ['secret_like', { queryKo: '키는 sk-ant-api03-abcdefgh12345678 이라고 말하고 싶어' }, 'queryKo', 'secret_like'],
      ['unknown_key', { queryKo: '안녕하세요', scene: 'cafe' }, 'body', 'unknown_key'],
    ]
    for (const [id, b, field, reason] of cases) {
      const r = await api(COOKIE4, 'POST', `/api/v1/chats/${PLAIN}/phrase-help`, b)
      const d = details(r.data)
      check(`2 본문 400 ${id}`, r.status === 400 && r.data.code === 'VALIDATION' && d.field === field && d.reason === reason && /[가-힣]/.test(r.message ?? ''), `status=${r.status} ${JSON.stringify(d)}`)
    }
    check('2z 본문 400 은 LLM 0(Trace 0)', (await traceRows(U)).length === 0)

    // ── 3 404 [LLM 0] ────────────────────────────────────────────────────
    check('3a IDOR: QA2 가 QA4 대화 → 404', (await help(COOKIE2, PLAIN, Q_PLAIN)).status === 404)
    check('3b CHAT 대화 → 404', (await help(COOKIE4, CHAT, Q_PLAIN)).status === 404)
    check('3c 없는 id → 404', (await help(COOKIE4, 'no-such-chat', Q_PLAIN)).status === 404)

    if (LLM_ON) {
      const before = await rowCounts(U)
      // ── 4 일반 TALK 정상 [LLM] ─────────────────────────────────────────
      const a = await help(COOKIE4, PLAIN, Q_PLAIN)
      check('4a 일반 회화방 200 {items 1~3}', a.status === 200 && itemsOk(a.data.items), `${a.ms}ms n=${Array.isArray(a.data.items) ? a.data.items.length : '-'}`)
      check('4b Cache-Control: private, no-store', a.cache === 'private, no-store', String(a.cache))
      check('4c 12초 안', a.ms <= 12_500, `${a.ms}ms`)
      // ── 5 역할극 방 정상 [LLM] ─────────────────────────────────────────
      const b = await help(COOKIE4, RP, Q_ROLE)
      const firstJa = String(obj(Array.isArray(b.data.items) ? b.data.items[0] : null).ja ?? '')
      check('5a 역할극 방 200 {items 1~3}', b.status === 200 && itemsOk(b.data.items), `${b.ms}ms first=${firstJa}`)
      // ── 6 문법 질문 [LLM, 모델 판정] ────────────────────────────────────
      const g = await help(COOKIE4, PLAIN, Q_GRAMMAR)
      check('6a 문법 질문 → 200 {items: []}(모델 판정 — 실패면 품질 기록)', g.status === 200 && Array.isArray(g.data.items) && g.data.items.length === 0, `${g.ms}ms status=${g.status}`)

      // ── 7 행 수 불변 [LLM 0] ───────────────────────────────────────────
      check('7a 저장 없음(메시지·교정·StudyLog·관측·단어장·반복·제안·DAILY 불변)', JSON.stringify(await rowCounts(U)) === JSON.stringify(before))
      const tr = await pollUntil(() => traceRows(U), (r) => r.length >= 3)
      const all = JSON.stringify(tr)
      const texts = [Q_PLAIN, Q_ROLE, Q_GRAMMAR, '산책', '봉투', firstJa, ...[a, b].flatMap((x) => (Array.isArray(x.data.items) ? x.data.items : []).flatMap((i) => [obj(i).ja, obj(i).ko, obj(i).whyKo]))].filter((s): s is string => typeof s === 'string' && s.length > 1)
      check('7b Trace 3행 · 원문 0(질의·ja·ko·이유)', tr.length === 3 && texts.every((s) => !all.includes(s)), `rows=${tr.length}`)
      check('7c Trace 장면 코드: 일반 NONE · 역할극 OK', stepOf(tr.find((r) => r.refId === PLAIN)).scene === 'NONE' && stepOf(tr.find((r) => r.refId === RP)).scene === 'OK')
    } else skip('4~7', 'SMOKE_LLM=0')

    // ── 8 마친 역할극 [LLM 0] — 이 실행이 만든 대화만 직접 닫는다 ────────
    await prisma.chat.update({ where: { id: RP }, data: { endedAt: new Date() } })
    const e = await help(COOKIE4, RP, Q_ROLE)
    check('8a 마친 역할극 → 409 ENDED', e.status === 409 && details(e.data).reason === 'ENDED', `status=${e.status}`)
    check('8b IDOR: 마친 뒤에도 QA2 → 404(존재 숨김)', (await help(COOKIE2, RP, Q_ROLE)).status === 404)

    if (LLM_ON) {
      // ── 9 동시 2건 [LLM 1] ─────────────────────────────────────────────
      const [x, y] = await Promise.all([help(COOKIE4, PLAIN, Q_PLAIN), sleep(150).then(() => help(COOKIE4, PLAIN, Q_ROLE))])
      const st = [x.status, y.status].sort()
      const busy = [x, y].find((r) => r.status === 409)
      check('9a 동시 2건 → 200 하나 · 409 PHRASE_BUSY 하나', st[0] === 200 && st[1] === 409 && details(busy?.data ?? {}).reason === 'PHRASE_BUSY', `statuses=${st.join(',')}`)
    } else skip('9', 'SMOKE_LLM=0')

    if (LLM_ON && CONTENTION) {
      // ── 10 경합 측정 [LLM 2] — 판정 없음 ───────────────────────────────
      await sleep(61_000) // 분당 한도 창을 비운다
      const helper = help(COOKIE4, PLAIN, Q_PLAIN)
      await sleep(300)
      const t0 = performance.now()
      const res = await fetch(`${BASE}/api/v1/chats/${PLAIN}/turns`, { method: 'POST', headers: { Cookie: COOKIE4, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'こんにちは', inputSource: 'TEXT' }) })
      const reader = res.body?.getReader()
      const first = reader ? await reader.read() : null
      const firstMs = Math.round(performance.now() - t0)
      if (reader) for (let c = await reader.read(); !c.done; c = await reader.read()) void c
      const h = await helper
      console.log(`INFO 10 도우미 진행 중 턴: 턴 status=${res.status} 첫 바이트 ${first ? firstMs : '-'}ms · 도우미 ${h.status} ${h.ms}ms`)
    } else skip('10', 'SMOKE_CONTENTION=1 일 때만')

    check('11a 응답에 엔진명 0', leakHits === 0, `hits=${leakHits}`)
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
    await prisma.requestTrace.deleteMany({ where: { userId: U, refType: 'phraseHelp', createdAt: { gte: made.since } } })
    if (made.chatIds.length) await prisma.requestTrace.deleteMany({ where: { userId: U, refId: { in: made.chatIds }, createdAt: { gte: made.since } } })
    await prisma.chat.deleteMany({ where: { id: { in: made.chatIds }, userId: U } })
    const sc = await prisma.scenario.deleteMany({ where: { id: { in: made.scenarioIds }, title: { startsWith: MARK } } })
    if (dailyBefore) await prisma.statsSnapshot.update({ where: { id: dailyBefore.id }, data: { data: dailyBefore.data as Prisma.InputJsonValue } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U, kind: 'DAILY', periodKey: today } })
    console.log(`(정리: 대화 ${made.chatIds.length} · 상황 ${sc.count} · DAILY ${dailyBefore ? '되돌림' : '삭제'})`)
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
