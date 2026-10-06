/**
 * task-010d A2 라이브 스모크 — #59 `{scenarioId, topicId?}` 상황 수업(A4 `[상황]` 블록)·`Lesson.scenarioId/topicId`·재사용 키·`LessonDto.scenarioId` 를
 * **실제 개발 서버(localhost)·실제 DB** 로 친다. 작성만 했고 실행은 QA 몫이다(developer 는 실행하지 않음).
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test`(상황 역할극 레인) = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR).
 * 단계(LLM 0 / LLM 구분):
 *   [LLM 0] 1 준비: 시드 주제 T(조각 있음)·T2(T 가 아닌 시드 주제) 고르기 · #163 으로 QA4 상황 S(장소 T)·S2(장소 T)·지울 상황(→ #165 ARCHIVED) · QA2 상황 1개
 *           · QA4 오늘 날짜 **일반 수업 고정 행** G(topicId T·scenarioId null·READY·제목 MARK) 1개를 DB 에 직접 만든다(재사용 키 확인용 — LLM 없이)
 *   [LLM 0] 2 #59 검증: {scenarioId, sourceText} 400 not_with_scenario · 남의 상황 404 · 숨긴 상황 409 ARCHIVED · 이어지지 않은 topicId(T2) 400 not_linked
 *           · 형식 400 · 각 거부 뒤 QA4 Lesson 행 수 변화 0
 *   [LLM]   3 #59 {scenarioId:S} → 200 reused:false · lessonId ≠ G · DB 행 scenarioId=S·topicId=T(대표 주제)·제목 = 상황 제목 · 잡 payload promptVersion lessonScenario@v1
 *   [LLM 0] 4 (3 의 생성 중에) #59 {scenarioId:S2} → 409 GENERATING(lessonId = 3 의 수업 — S 수업을 재사용하지 않았다는 뜻) · #59 {topicId:T} → reused:true·lessonId=G
 *           (일반 요청이 상황 수업을 재사용하지 않음) · QA2 의 #60(3 의 수업) 404
 *   [LLM]   5 3 의 잡 폴링(≤150s) → DONE · #60 scenarioId=S·READY·content.dialogue ≥1 · DB promptVersion lessonScenario@v1 · #58 todayLessons 항목 scenarioId=S
 *           · 다시 #59 {scenarioId:S} → reused:true·같은 lessonId·jobId null(새 잡 0)
 * LLM 직렬 슬롯: A4 1회(balanced·batch, 실측 26~37s — PE-2b). 다른 LLM 스모크와 동시에 돌리지 않는다. `SMOKE_LLM=0` 이면 1~2 만(3~5 SKIP).
 * 정리: 이 실행이 만든 행만 — 수업(3 의 수업 + G)·그 수업의 AiJob·Trace(refType lessonGen)·상황(제목 MARK, ScenarioTopic cascade).
 *   수업은 완료하지 않으므로 StudyLog·StatsSnapshot·RepetitionItem 은 생기지 않는다(생겼으면 실패로 보고).
 *
 * 가드: `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 거부 · BASE 는 localhost 만, 포트 3010(운영) 거부.
 * 실행(우분투 미러, 개발 서버는 따로 — 예 `PORT=3029`):
 *   QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q4 && QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q2
 *   BASE=http://127.0.0.1:3029 node --env-file=.env --import tsx tests/live/task010d-a2-smoke.ts /tmp/q4 /tmp/q2 ; rm /tmp/q4 /tmp/q2
 * 끝 줄 `RESULT pass=N fail=M skip=K`, 실패가 있으면 종료 코드 1.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/modules/infra/db'
import { todayKst } from '../../src/modules/infra/dates'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다(새 API — 개발 서버 전용)')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3029'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const LLM_ON = process.env.SMOKE_LLM !== '0'
const [c4file, c2file] = process.argv.slice(2)
if (!c4file || !c2file) throw new Error('사용: task010d-a2-smoke.ts <QA4 쿠키 파일> <QA2 쿠키 파일>')
const COOKIE4 = readFileSync(c4file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE4 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 결과를 확인')

const MARK = `smkA2-${Date.now().toString(36)}`
const LEAK = /claude|haiku|sonnet|opus|qwen|home-m4|reazon|whisper|style-?bert|sbv2|lessonScenario@|lesson@v/i
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

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
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
  return { status: r.status, data }
}
const reason = (d: Json) => obj(d.details).reason

async function pollJob(cookie: string, jobId: string, timeoutMs = 150_000): Promise<{ status: string; ms: number }> {
  const t0 = performance.now()
  let wait = 2_000
  for (;;) {
    const job = (await api(cookie, 'GET', `/api/v1/jobs/${jobId}`)).data
    if (job.status === 'DONE' || job.status === 'FAILED') return { status: String(job.status), ms: performance.now() - t0 }
    if (performance.now() - t0 > timeoutMs) return { status: 'TIMEOUT', ms: performance.now() - t0 }
    await sleep(wait)
    wait = Math.min(5_000, wait + 1_000)
  }
}

const made = { scenarioIds: [] as string[], lessonIds: [] as string[] }

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true, provider: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true, provider: true } })
  if (!qa4 || !qa2 || qa4.provider !== 'test' || qa2.provider !== 'test') throw new Error('QA4·QA2 계정이 없다 — qa-session.ts(QA_ACCOUNT=4·2)를 먼저 실행')
  const U = qa4.id
  const today = todayKst()
  const since = new Date()
  console.log(`[task010d-a2-smoke] env=${SMOKE_ENV} base=${BASE} run=${MARK} llm=${LLM_ON ? 'on' : 'off'}`)

  const seedTopics = await prisma.conversationTopic.findMany({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 2, select: { id: true, title: true, level: true } })
  if (seedTopics.length < 2) throw new Error('조각 있는 시드 주제가 2개 필요하다(seed-topics 적재 확인)')
  const [T, T2] = seedTopics
  // 같은 날 같은 주제의 일반 수업이 이미 있으면 재사용 판정이 섞인다 — 실행을 멈추고 알린다(남의 행을 지우지 않는다).
  const existing = await prisma.lesson.count({ where: { userId: U, topicId: T.id, date: new Date(`${today}T00:00:00.000Z`), kind: 'NEW' } })
  if (existing > 0) throw new Error(`QA4 에 오늘 주제 ${T.id} 수업이 이미 ${existing}개 있다 — 다른 날 또는 정리 후 실행`)
  const busy = await prisma.aiJob.count({ where: { userId: U, kind: 'LESSON_GEN', status: { in: ['QUEUED', 'RUNNING'] } } })
  if (busy > 0) throw new Error('QA4 에 진행 중인 수업 생성 잡이 있다 — 끝난 뒤 실행')

  try {
    // ── 1 [LLM 0] 준비 ─────────────────────────────────────────────────────
    const body = (title: string) => ({
      title: `${MARK} ${title}`,
      titleJa: 'カフェで注文する',
      level: 'N5',
      roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoalKo: '음료 크기와 온도를 말해 주문해요', successCriteria: ['크기 말하기'] },
      steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
      keyExpressions: [{ ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요' }, { ja: 'ホットでお願いします', ko: '따뜻한 걸로 부탁해요' }],
      opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' },
      topicIds: [T.id],
    })
    const s1 = await api(COOKIE4, 'POST', '/api/v1/scenarios', body('상황 수업'))
    const s2 = await api(COOKIE4, 'POST', '/api/v1/scenarios', body('다른 상황'))
    const gone = await api(COOKIE4, 'POST', '/api/v1/scenarios', body('지울 상황'))
    const theirs = await api(COOKIE2, 'POST', '/api/v1/scenarios', body('남의 상황'))
    for (const s of [s1, s2, gone, theirs]) if (typeof s.data.id === 'string') made.scenarioIds.push(s.data.id)
    check('1a #163 상황 4개 201(QA4 3 · QA2 1)', [s1, s2, gone, theirs].every((s) => s.status === 201), [s1, s2, gone, theirs].map((s) => s.status).join('/'))
    const S = s1.data.id as string
    const S2 = s2.data.id as string
    const GONE = gone.data.id as string
    const THEIRS = theirs.data.id as string
    const del = await api(COOKIE4, 'DELETE', `/api/v1/scenarios/${GONE}`)
    check('1b #165 지우기 → ARCHIVED', del.status === 200 && (await prisma.scenario.findUnique({ where: { id: GONE }, select: { status: true } }))?.status === 'ARCHIVED')
    const G = await prisma.lesson.create({
      data: { userId: U, topicId: T.id, scenarioId: null, date: new Date(`${today}T00:00:00.000Z`), kind: 'NEW', status: 'READY', title: `${MARK} 일반 수업 고정 행`, level: T.level },
      select: { id: true },
    })
    made.lessonIds.push(G.id)
    check('1c 일반 수업 고정 행 G(topicId T·scenarioId null·READY)', Boolean(G.id))

    // ── 2 [LLM 0] #59 검증 ───────────────────────────────────────────────
    const lessonsBefore = await prisma.lesson.count({ where: { userId: U } })
    const ja = 'これは日本語の文章です。毎朝コーヒーを飲みます。'.repeat(3)
    const rText = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: S, sourceText: ja })
    check('2a {scenarioId, sourceText} 400 not_with_scenario', rText.status === 400 && reason(rText.data) === 'not_with_scenario', `status=${rText.status} reason=${String(reason(rText.data))}`)
    const r404 = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: THEIRS })
    check('2b 남의 상황 404', r404.status === 404, `status=${r404.status}`)
    const r409 = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: GONE })
    check('2c 숨긴 상황 409 ARCHIVED', r409.status === 409 && reason(r409.data) === 'ARCHIVED', `status=${r409.status} reason=${String(reason(r409.data))}`)
    const rLink = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: S, topicId: T2.id })
    check('2d 이어지지 않은 topicId 400 not_linked', rLink.status === 400 && reason(rLink.data) === 'not_linked', `status=${rLink.status} reason=${String(reason(rLink.data))}`)
    const rBad = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: 'x'.repeat(41) })
    check('2e 형식 400', rBad.status === 400, `status=${rBad.status}`)
    check('2f 거부 뒤 QA4 Lesson 행 수 변화 0', (await prisma.lesson.count({ where: { userId: U } })) === lessonsBefore)

    if (!LLM_ON) {
      for (const id of ['3', '4', '5']) skip(id, 'SMOKE_LLM=0')
      return
    }

    // ── 3 [LLM] 상황 수업 생성(★ A4 직렬 슬롯 — 26~37s) ─────────────────────
    const c1 = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: S })
    const L = c1.data.lessonId as string
    const J = c1.data.jobId as string
    if (L) made.lessonIds.push(L)
    check('3a #59 {scenarioId} 200 reused:false · 일반 수업 G 를 재사용하지 않음', c1.status === 200 && c1.data.reused === false && Boolean(L) && L !== G.id && Boolean(J), `status=${c1.status} reused=${String(c1.data.reused)}`)
    const row = L ? await prisma.lesson.findUnique({ where: { id: L }, select: { userId: true, scenarioId: true, topicId: true, title: true, sourceText: true } }) : null
    check('3b DB 행 scenarioId=S · topicId=T(대표 주제) · 제목 = 상황 제목 · sourceText 없음', row?.userId === U && row.scenarioId === S && row.topicId === T.id && row.title === `${MARK} 상황 수업` && row.sourceText === null, JSON.stringify({ s: row?.scenarioId === S, t: row?.topicId, title: row?.title }))
    const job = J ? await prisma.aiJob.findUnique({ where: { id: J }, select: { payload: true } }) : null
    const payload = obj(job?.payload)
    check('3c 잡 payload promptVersion lessonScenario@v1 · inputMeta.source scenario · 본문 없음', payload.promptVersion === 'lessonScenario@v1' && obj(payload.inputMeta).source === 'scenario' && !JSON.stringify(payload).includes('Lサイズ'))

    // ── 4 [LLM 0] 생성 중 재사용 키 ───────────────────────────────────────
    const c2 = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: S2 })
    check('4a 다른 상황(같은 주제) → 409 GENERATING(S 수업을 재사용하지 않음)', c2.status === 409 && reason(c2.data) === 'GENERATING' && obj(c2.data.details).lessonId === L, `status=${c2.status} reason=${String(reason(c2.data))}`)
    const c3 = await api(COOKIE4, 'POST', '/api/v1/lessons', { topicId: T.id })
    check('4b 같은 주제 일반 요청 → reused:true · lessonId=G(상황 수업 아님)', c3.status === 200 && c3.data.reused === true && c3.data.lessonId === G.id, `status=${c3.status} lessonId=${String(c3.data.lessonId === G.id ? 'G' : c3.data.lessonId === L ? 'L(상황 수업!)' : c3.data.lessonId)}`)
    const idor = await api(COOKIE2, 'GET', `/api/v1/lessons/${L}`)
    check('4c QA2 의 #60(QA4 상황 수업) 404', idor.status === 404, `status=${idor.status}`)

    // ── 5 [LLM] 완료 대기 → 상세·오늘·재사용 ─────────────────────────────
    const done = await pollJob(COOKIE4, J)
    check('5a 잡 DONE(≤150s)', done.status === 'DONE', `${done.status} ${Math.round(done.ms)}ms`)
    if (done.status === 'DONE') {
      const det = await api(COOKIE4, 'GET', `/api/v1/lessons/${L}`)
      const dialogue = obj(det.data.content).dialogue
      check('5b #60 scenarioId=S · READY · topic=T · content.dialogue ≥1', det.status === 200 && det.data.scenarioId === S && det.data.status === 'READY' && obj(det.data.topic).id === T.id && Array.isArray(dialogue) && dialogue.length > 0, `status=${det.status}`)
      const pv = await prisma.lesson.findUnique({ where: { id: L }, select: { promptVersion: true } })
      check('5c DB promptVersion lessonScenario@v1', pv?.promptVersion === 'lessonScenario@v1', String(pv?.promptVersion))
      const gDet = await api(COOKIE4, 'GET', `/api/v1/lessons/${G.id}`)
      check('5d 일반 수업 #60 scenarioId null', gDet.status === 200 && gDet.data.scenarioId === null)
      const todayRes = await api(COOKIE4, 'GET', '/api/v1/lessons/today')
      const items = Array.isArray(todayRes.data.todayLessons) ? (todayRes.data.todayLessons as Json[]) : []
      check('5e #58 todayLessons: 상황 수업 scenarioId=S · 일반 수업 null', items.some((i) => i.id === L && i.scenarioId === S) && items.some((i) => i.id === G.id && i.scenarioId === null))
      const again = await api(COOKIE4, 'POST', '/api/v1/lessons', { scenarioId: S })
      check('5f 다시 #59 {scenarioId:S} → reused:true · 같은 lessonId · jobId null', again.status === 200 && again.data.reused === true && again.data.lessonId === L && again.data.jobId === null)
    } else {
      for (const id of ['5b', '5c', '5d', '5e', '5f']) skip(id, `잡 ${done.status}`)
    }
    const logs = await prisma.studyLog.count({ where: { userId: U, createdAt: { gte: since }, refId: { in: made.lessonIds } } })
    check('5g 완료하지 않은 수업은 StudyLog 0', logs === 0, `studyLog=${logs}`)
    check('5h 응답에 엔진명·프롬프트 버전 0', leakHits === 0, `hits=${leakHits}`)
  } finally {
    await cleanup(U)
  }
}

async function cleanup(U: string): Promise<void> {
  try {
    const lessonIds = made.lessonIds
    if (lessonIds.length) {
      await prisma.requestTrace.deleteMany({ where: { userId: U, refType: 'lessonGen', refId: { in: lessonIds } } })
      await prisma.aiJob.deleteMany({ where: { userId: U, refId: { in: lessonIds } } })
    }
    const ls = await prisma.lesson.deleteMany({ where: { userId: U, id: { in: lessonIds } } })
    const sc = await prisma.scenario.deleteMany({ where: { id: { in: made.scenarioIds }, title: { startsWith: MARK } } })
    console.log(`(정리: 수업 ${ls.count} · 상황 ${sc.count})`)
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
