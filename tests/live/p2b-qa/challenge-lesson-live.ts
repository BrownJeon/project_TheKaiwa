/**
 * qa-p2b — task-041 LLM 항목(REV-120 §6 4·6, REV-126 §7 4·6) — **QA 계정 3**, A4(수업 생성) 실호출. LLM 직렬 슬롯에서 혼자 돌린다.
 *
 * 모드(두 번째 인자):
 *   all         R1 + RI + RR (한 번에, 서버 재기동 없이)
 *   dead-start  RD 앞 절반 — 챌린지(주제 3)·#59 로 A4 잡을 건 직후 종료(셸이 dev 서버 프로세스 그룹을 죽인다 → 잡 행은 RUNNING·레슨은 GENERATING 으로 남음)
 *   dead-check  RD 뒤 절반 — (서버 재기동 뒤) #158·#157 이 죽은 잡을 어떻게 보이는지, AiJob 행 수·레슨 상태 불변, 잡 행 backdate 뒤 FAILED('stale')
 *
 *  R1  실제 A4 수업 + 챌린지: 챌린지 {수업 켬·단어 5장(4장 인정)} → #158 TODO → #59 → **생성 중 #158·#157 폴링(살아 있는 잡: GENERATING·jobId 일치·AiJob 행 수 불변·Lesson GENERATING 유지)**
 *      → READY → 단어 세트 4장 답 #51 `challenge{goalMet:false,goalMetNow:false,words{4,4}}` → 수업 진행·#62 완료 `challenge` 키 항상 존재·`goalMetNow:true` 1번(이 수업이 달성을 채움)
 *      → 두 번째 #62 409 → #158 DONE·goalMet → 달성 뒤 세트 `goalMetNow:false`.
 *  RI  `challengeProgressAfter` 실패 주입(LLM 0 — R1 수업 내용을 복제한 수업 행): 진행 중 챌린지 `dailyGoal` 을 QA 행에서 깨뜨린 채 #62 → 200·`challenge:null`·Lesson DONE·StudyLog 1·LESSON 스냅샷 1 +
 *      서버 로그에 "dailyGoal 형태" 한 줄(예외 객체·원문 없음). 복구 뒤 #158 정상.
 *  RR  #62 × #159 경합: 실제 A4 수업 1개로 오프셋 1회 + 복제 수업으로 오프셋을 흩뿌려 N회 — `result.lessonsDone` == "그 수업의 LESSON 스냅샷 createdAt < endedAt" 불일치 0·수업은 항상 DONE.
 *  RD  `findActiveJob` 죽은 잡 경로.
 *  끝: 이 실행이 만든 행(챌린지·세트·수업·기록·스냅샷·잡·반복 항목)을 기준선 차집합으로 지우고 기존 DAILY 는 시작 값으로 되돌린다. 마지막에 AiJob 증가 = 실제 #59 호출 수 확인.
 *
 * 실행(미러, dev 127.0.0.1·APP_ENV=LOCAL, 00:05~23:50 KST):
 *   QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c3
 *   BASE=http://127.0.0.1:3032 [SERVER_LOG=/tmp/qa-p2b-dev.log] [TRIALS=12] node --env-file=.env --import tsx tests/live/p2b-qa/challenge-lesson-live.ts /tmp/c3 all
 * 쿠키·대화·수업 본문은 출력하지 않는다.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { Prisma, PrismaClient, type RepetitionItem } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3032'
const bm = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(BASE)
if (!bm || Number(bm[2]) === 3010) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const [c3file, MODE = 'all'] = process.argv.slice(2)
if (!c3file) throw new Error('사용: challenge-lesson-live.ts <QA3 쿠키> [all|dead-start|dead-check]')
const COOKIE = readFileSync(c3file, 'utf8').trim()
if (!COOKIE) throw new Error('QA 쿠키 파일이 비어 있다')
const SERVER_LOG = process.env.SERVER_LOG ?? ''
const TRIALS = Math.max(4, Number(process.env.TRIALS ?? 12))
const KST = 9 * 3600_000
const hhmm = new Date(Date.now() + KST).toISOString().slice(11, 16)
if (hhmm < '00:05' || hhmm > '23:50') throw new Error(`KST ${hhmm} — 00:05~23:50 에 실행한다`)
const STATE = '/tmp/qa-p2b-dead.json'

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (m: string) => console.log(`INFO ${m}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const delayed = <T>(ms: number, f: () => Promise<T>): Promise<T> => sleep(ms).then(f)
type Json = Record<string, unknown>
interface Res {
  status: number
  data: Json & { code?: string; details?: Json }
  text: string
  ms: number
}
async function api(method: string, path: string, body?: unknown): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: COOKIE }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t0
  let data: Res['data'] = {}
  try {
    data = (JSON.parse(text) as { data: Res['data'] }).data ?? {}
  } catch {
    data = {}
  }
  return { status: r.status, data, text, ms }
}
const todayKst = () => new Date(Date.now() + KST).toISOString().slice(0, 10)
const dbDate = (d: string) => new Date(`${d}T00:00:00.000Z`)

interface Baseline {
  sessions: Set<string>
  logs: Set<string>
  snaps: Set<string>
  obs: Set<string>
  jobs: Set<string>
  challenges: Set<string>
  lessons: Set<string>
  reps: RepetitionItem[]
  daily: { id: string; data: Prisma.JsonValue }[]
}
async function baseline(userId: string): Promise<Baseline> {
  const ids = async (rows: Promise<{ id: string }[]>) => new Set((await rows).map((r) => r.id))
  return {
    sessions: await ids(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })),
    logs: await ids(prisma.studyLog.findMany({ where: { userId }, select: { id: true } })),
    snaps: await ids(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })),
    obs: await ids(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } })),
    jobs: await ids(prisma.aiJob.findMany({ where: { userId }, select: { id: true } })),
    challenges: await ids(prisma.challenge.findMany({ where: { userId }, select: { id: true } })),
    lessons: await ids(prisma.lesson.findMany({ where: { userId }, select: { id: true } })),
    reps: await prisma.repetitionItem.findMany({ where: { userId } }),
    daily: await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, data: true } }),
  }
}
async function restore(userId: string, b: Baseline): Promise<Json> {
  const fresh = async (rows: Promise<{ id: string }[]>, old: Set<string>) => (await rows).map((r) => r.id).filter((id) => !old.has(id))
  const ch = await fresh(prisma.challenge.findMany({ where: { userId }, select: { id: true } }), b.challenges)
  if (ch.length) await prisma.challenge.deleteMany({ where: { id: { in: ch } } })
  const obs = await fresh(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } }), b.obs)
  if (obs.length) await prisma.learningObservation.deleteMany({ where: { id: { in: obs } } })
  const logs = await fresh(prisma.studyLog.findMany({ where: { userId }, select: { id: true } }), b.logs)
  if (logs.length) await prisma.studyLog.deleteMany({ where: { id: { in: logs } } })
  const jobs = await fresh(prisma.aiJob.findMany({ where: { userId }, select: { id: true } }), b.jobs)
  if (jobs.length) await prisma.aiJob.deleteMany({ where: { id: { in: jobs } } })
  const sessions = await fresh(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } }), b.sessions)
  if (sessions.length) {
    await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sessions } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: sessions } } })
  }
  const snaps = await fresh(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } }), b.snaps)
  if (snaps.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: snaps } } })
  for (const row of b.daily) await prisma.statsSnapshot.update({ where: { id: row.id }, data: { data: (row.data ?? {}) as Prisma.InputJsonValue } })
  const lessons = await fresh(prisma.lesson.findMany({ where: { userId }, select: { id: true } }), b.lessons)
  if (lessons.length) {
    await prisma.reviewSchedule.deleteMany({ where: { lessonId: { in: lessons } } })
    await prisma.lesson.deleteMany({ where: { id: { in: lessons } } })
  }
  const oldReps = new Set(b.reps.map((r) => r.id))
  const reps = (await prisma.repetitionItem.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id).filter((id) => !oldReps.has(id))
  if (reps.length) await prisma.repetitionItem.deleteMany({ where: { id: { in: reps } } })
  for (const r of b.reps) {
    const { id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = r
    void _u
    void _c
    void _up
    await prisma.repetitionItem.updateMany({ where: { id }, data: rest })
  }
  return { challenges: ch.length, observations: obs.length, studyLogs: logs.length, aiJobs: jobs.length, sessions: sessions.length, snapshots: snaps.length, lessons: lessons.length, repetitionItems: reps.length }
}

async function answerAttempt(sessionId: string, order: number): Promise<Res> {
  const a = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId, order } }, select: { meaningSnap: true, choices: true } })
  const choices = Array.isArray(a.choices) ? (a.choices as string[]) : []
  if (!choices.length) return api('POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, selfResult: 'CORRECT' })
  return api('POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, chosenText: a.meaningSnap })
}
async function wordSet(topicId: string, answers: number): Promise<{ sid: string; fin: Res }> {
  const s = await api('POST', '/api/v1/vocab/sessions', { topicId, count: 5, mode: 'CHOICE', generate: false })
  const sid = String((s.data.session as Json | undefined)?.id ?? '')
  for (let o = 0; o < answers; o++) await answerAttempt(sid, o)
  return { sid, fin: await api('POST', `/api/v1/vocab/sessions/${sid}/finish`) }
}

interface LessonContent {
  quiz: { id: string; answer: number }[]
  application: { id: string; modelAnswerJa: string }[]
}
/** 수업을 stageDone 4(완료 직전)까지 진행시킨다 — 퀴즈 전부 정답. */
async function advanceLesson(lessonId: string, content: LessonContent): Promise<number> {
  const answers = content.quiz.map((q) => q.answer)
  const p3 = await api('PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 3, progress: { quiz: { answers }, application: { answers: [content.application[0].modelAnswerJa, null, null] } } })
  const p4 = await api('PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 4 })
  return p3.status * 1000 + p4.status
}
async function pollJobDone(jobId: string, timeoutMs = 180_000): Promise<{ status: string; ms: number }> {
  const t0 = performance.now()
  for (;;) {
    const r = await api('GET', `/api/v1/jobs/${jobId}`)
    const st = String(r.data.status ?? '')
    if (st === 'DONE' || st === 'FAILED') return { status: st, ms: performance.now() - t0 }
    if (performance.now() - t0 > timeoutMs) return { status: 'TIMEOUT', ms: performance.now() - t0 }
    await sleep(2_000)
  }
}
const lessonTaskOf = (r: Res): Json | undefined => (((r.data.today as Json | undefined)?.tasks ?? []) as Json[]).find((t) => t.kind === 'LESSON')
const wordsTaskOf = (r: Res): Json | undefined => (((r.data.today as Json | undefined)?.tasks ?? []) as Json[]).find((t) => t.kind === 'WORDS')

async function lessonA4(topicId: string): Promise<{ lessonId: string; jobId: string; res: Res }> {
  const g = await api('POST', '/api/v1/lessons', { topicId })
  return { lessonId: String(g.data.lessonId ?? ''), jobId: String(g.data.jobId ?? ''), res: g }
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다')
  const userId = user.id
  const busyCh = await prisma.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
  const busyVs = await prisma.vocabSession.findFirst({ where: { userId, status: 'IN_PROGRESS' }, select: { id: true } })
  const busyJob = await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })
  if (MODE !== 'dead-check' && (busyCh || busyVs || busyJob)) throw new Error('계정 3 에 진행 중 챌린지·세트·잡이 있다 — 다른 레인이 쓰는 중이면 기다린다')
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true, _count: { select: { chunks: true } } } })
  const usable = topics.filter((t) => t._count.chunks >= 5)
  if (usable.length < 4) throw new Error(`조각 5개 이상 시드 주제가 ${usable.length}개뿐`)
  const [T1, T2, T3, T4] = usable
  info(`주제 T1=${T1.title} T2=${T2.title} T3=${T3.title} T4=${T4.title}`)
  const today = todayKst()

  if (MODE === 'dead-start') {
    const b = await baseline(userId)
    writeFileSync('/tmp/qa-p2b-dead-baseline.json', JSON.stringify({ lessons: [...b.lessons], jobs: [...b.jobs], challenges: [...b.challenges], sessions: [...b.sessions], snaps: [...b.snaps] }))
    const c = await api('POST', '/api/v1/challenges', { topicId: T3.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
    const g = await lessonA4(T3.id)
    await sleep(1_500)
    const job = await prisma.aiJob.findUnique({ where: { id: g.jobId }, select: { status: true, kind: true } })
    const les = await prisma.lesson.findUnique({ where: { id: g.lessonId }, select: { status: true } })
    info(`dead-start 챌린지 ${c.status} · #59 ${g.res.status} · 잡 ${job?.kind}/${job?.status} · 레슨 ${les?.status}`)
    writeFileSync(STATE, JSON.stringify({ challengeId: String(c.data.id ?? ''), lessonId: g.lessonId, jobId: g.jobId, topicId: T3.id }))
    check('RD0 죽이기 직전 — 잡 QUEUED|RUNNING·레슨 GENERATING', ['QUEUED', 'RUNNING'].includes(String(job?.status)) && les?.status === 'GENERATING')
    await prisma.$disconnect()
    process.exit(results.every((r) => r.ok) ? 0 : 1)
  }

  if (MODE === 'race-real') {
    // 실제 A4 수업 1개로 #62 × #159 경합(RR4·RR5 만) — A4 생성 실패(JSON 계약 위반 재시도 실패)로 `all` 의 RR4 가 NOT_VERIFIED 였을 때 다시 돌린다. A4 실패 시 최대 2번 시도.
    const b = await baseline(userId)
    try {
      const cr = await api('POST', '/api/v1/challenges', { topicId: T4.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
      const cid = String(cr.data.id ?? '')
      let g = await lessonA4(T4.id)
      let poll = await pollJobDone(g.jobId, 180_000)
      let tries = 1
      if (poll.status !== 'DONE') {
        info(`RR4 1번째 A4 ${poll.status} ${Math.round(poll.ms)}ms — 같은 #59 로 되살려 한 번 더`)
        g = await lessonA4(T4.id)
        tries++
        poll = await pollJobDone(g.jobId, 180_000)
      }
      check('RR4 실제 A4 수업 생성 DONE', poll.status === 'DONE', `${poll.status} ${Math.round(poll.ms)}ms · 시도 ${tries}회`)
      if (poll.status === 'DONE') {
        const gl = await api('GET', `/api/v1/lessons/${g.lessonId}`)
        await advanceLesson(g.lessonId, gl.data.content as unknown as LessonContent)
        const [comp, end] = await Promise.all([api('POST', `/api/v1/lessons/${g.lessonId}/complete`, {}), delayed(400, () => api('POST', `/api/v1/challenges/${cid}/end`, {}))])
        const ch = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { status: true, endedAt: true, result: true } })
        const snap = await prisma.statsSnapshot.findFirst({ where: { userId, kind: 'LESSON', periodKey: g.lessonId }, select: { createdAt: true } })
        const counted = !!snap && !!ch.endedAt && snap.createdAt.getTime() < ch.endedAt.getTime()
        const lessonsDone = Number(((ch.result ?? {}) as Json).lessonsDone ?? -1)
        const les = await prisma.lesson.findUniqueOrThrow({ where: { id: g.lessonId }, select: { status: true } })
        check('RR5 실제 A4 수업 #62 × #159(+400ms) — 둘 다 200·수업 DONE·result.lessonsDone == 스냅샷 규칙', comp.status === 200 && end.status === 200 && les.status === 'DONE' && lessonsDone === (counted ? 1 : 0), `${comp.status}/${end.status} ${counted ? '반영' : '제외'} lessonsDone=${lessonsDone} resp=${comp.data.challenge ? 'obj' : 'null'}`)
      }
    } finally {
      info(`정리: ${JSON.stringify(await restore(userId, b))}`)
    }
    const failedR = results.filter((r) => !r.ok)
    console.log(`\n결과: ${results.length - failedR.length}/${results.length} PASS${failedR.length ? ` — FAIL: ${failedR.map((r) => r.id).join(', ')}` : ''}`)
    if (failedR.length) process.exitCode = 1
    return
  }

  if (MODE === 'dead-check') {
    const st = JSON.parse(readFileSync(STATE, 'utf8')) as { challengeId: string; lessonId: string; jobId: string; topicId: string }
    const jobsCount = () => prisma.aiJob.count({ where: { userId } })
    const rowOf = () => prisma.aiJob.findUniqueOrThrow({ where: { id: st.jobId }, select: { status: true, error: true, finishedAt: true, startedAt: true, createdAt: true } })
    const lessonStatus = async () => (await prisma.lesson.findUniqueOrThrow({ where: { id: st.lessonId }, select: { status: true } })).status
    const n0 = await jobsCount()
    const j0 = await rowOf()
    // 새 서버 프로세스는 이 잡의 소유자가 아니다(localJobs 에 없음) — 5분(LESSON_GEN) 전이면 아직 "살아 있는" 것으로 본다.
    const t1 = await api('GET', '/api/v1/challenges/today')
    const l1 = lessonTaskOf(t1)
    info(`RD1 재기동 직후(잡 나이 ${Math.round((Date.now() - (j0.startedAt ?? j0.createdAt).getTime()) / 1000)}s, 잡 ${j0.status}) #158 레슨 과제 = ${String(l1?.state)} jobId=${l1?.jobId ? '있음' : 'null'}`)
    check('RD1 5분 전 죽은 잡 — #158 GENERATING·jobId 일치·AiJob 행 수 불변·잡 행 그대로(QUEUED|RUNNING)', t1.status === 200 && l1?.state === 'GENERATING' && l1?.jobId === st.jobId && (await jobsCount()) === n0 && ['QUEUED', 'RUNNING'].includes((await rowOf()).status), `${t1.status} ${String(l1?.state)}`)
    // 잡 행을 6분 전으로 되돌린다(QA 계정 3 이 만든 잡 행 — "서버가 죽은 지 5분이 지난" 상태 재현).
    const old = new Date(Date.now() - 6 * 60_000)
    await prisma.aiJob.update({ where: { id: st.jobId }, data: { createdAt: old, startedAt: j0.startedAt ? old : null } })
    const t2 = await api('GET', '/api/v1/challenges/today')
    const l2 = lessonTaskOf(t2)
    const j2 = await rowOf()
    check('RD2 5분 넘은 죽은 잡 — #158 레슨 과제 FAILED·jobId null·AiJob 행 수 불변·잡 행 FAILED(stale)', t2.status === 200 && l2?.state === 'FAILED' && l2?.jobId === null && (await jobsCount()) === n0 && j2.status === 'FAILED' && j2.error === 'stale', `${t2.status} ${String(l2?.state)} job ${j2.status}/${String(j2.error)}`)
    check('RD3 레슨 행은 GENERATING 그대로(챌린지 경로가 Lesson 을 쓰지 않음)', (await lessonStatus()) === 'GENERATING', await lessonStatus())
    const upd2 = j2.finishedAt?.getTime() ?? 0
    const t3 = await api('GET', `/api/v1/challenges/${st.challengeId}`)
    const t4 = await api('GET', '/api/v1/challenges/today')
    const j3 = await rowOf()
    const dayTasks = ((t3.data.today as Json | undefined)?.tasks ?? []) as Json[]
    const l3 = dayTasks.find((t) => t.kind === 'LESSON')
    check('RD4 #157 도 같은 표시(FAILED)·다시 불러도 잡 행 추가 쓰기 없음(finishedAt 불변)·행 수 불변', t3.status === 200 && l3?.state === 'FAILED' && lessonTaskOf(t4)?.state === 'FAILED' && (j3.finishedAt?.getTime() ?? 0) === upd2 && (await jobsCount()) === n0, `${t3.status} ${String(l3?.state)}`)
    // 정리 — 이 모드가 만든 행만.
    const bs = JSON.parse(readFileSync('/tmp/qa-p2b-dead-baseline.json', 'utf8')) as { lessons: string[]; jobs: string[]; challenges: string[]; sessions: string[]; snaps: string[] }
    await prisma.challenge.deleteMany({ where: { id: st.challengeId } })
    await prisma.aiJob.deleteMany({ where: { id: st.jobId } })
    await prisma.reviewSchedule.deleteMany({ where: { lessonId: st.lessonId } })
    await prisma.lesson.deleteMany({ where: { id: st.lessonId } })
    void bs
    info(`정리: 챌린지·잡·레슨 각 1건(상태 파일 ${existsSync(STATE) ? '있음' : '없음'})`)
  } else {
    const b = await baseline(userId)
    const jobsBefore = await prisma.aiJob.count({ where: { userId } })
    let a4Calls = 0
    let srcContent: LessonContent | null = null
    let srcRow: { title: string; level: Prisma.LessonUncheckedCreateInput['level']; content: Prisma.JsonValue; model: string | null; promptVersion: string | null; progress: Prisma.JsonValue } | null = null
    try {
      // ── R1 ──
      {
        const c = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 5 } })
        const cid = String(c.data.id ?? '')
        const t0 = await api('GET', '/api/v1/challenges/today')
        const lt0 = lessonTaskOf(t0)
        const wt0 = wordsTaskOf(t0)
        check('R1a 챌린지 생성 후 #158 — 단어 TODO·수업 TODO·goalMet false', c.status === 200 && wt0?.state === 'TODO' && lt0?.state === 'TODO' && lt0?.lessonId === null && (t0.data.today as Json | undefined)?.goalMet === false, `${c.status} words ${String(wt0?.state)} lesson ${String(lt0?.state)}`)
        const jobsNow = await prisma.aiJob.count({ where: { userId } })
        const t0Gen = performance.now()
        const g = await lessonA4(T1.id)
        a4Calls++
        check('R1b #59 {topicId} → GENERATING·jobId', g.res.status === 200 && g.res.data.status === 'GENERATING' && !!g.jobId && !!g.lessonId, `${g.res.status} ${String(g.res.data.status)}`)
        // 생성 중 폴링 — 살아 있는 잡
        let polls = 0
        let genPolls = 0
        let rowsChanged = 0
        let lessonNotGen = 0
        let mismatchJob = 0
        let finalSeen = ''
        for (;;) {
          const r = await api('GET', '/api/v1/challenges/today')
          const r2 = await api('GET', `/api/v1/challenges/${cid}`)
          polls++
          const lt = lessonTaskOf(r)
          const lt2 = ((r2.data.today as Json | undefined)?.tasks as Json[] | undefined)?.find((t) => t.kind === 'LESSON')
          const jobRow = await prisma.aiJob.findUnique({ where: { id: g.jobId }, select: { status: true } })
          const les = await prisma.lesson.findUnique({ where: { id: g.lessonId }, select: { status: true } })
          finalSeen = `${String(lt?.state)}/${String(jobRow?.status)}/${String(les?.status)}`
          if (lt?.state === 'GENERATING') {
            genPolls++
            if (lt.jobId !== g.jobId || lt2?.state !== 'GENERATING') mismatchJob++
            if ((await prisma.aiJob.count({ where: { userId } })) !== jobsNow + 1) rowsChanged++
            if (les?.status !== 'GENERATING') lessonNotGen++
          }
          if (jobRow?.status === 'DONE' || jobRow?.status === 'FAILED') break
          if (performance.now() - t0Gen > 180_000) break
          await sleep(2_000)
        }
        const poll = await pollJobDone(g.jobId, 30_000)
        const a4Ms = Math.round(performance.now() - t0Gen)
        info(`R1 A4 수업 생성 ${a4Ms}ms · 폴링 ${polls}회(GENERATING 으로 보인 ${genPolls}회) · 마지막 ${finalSeen}`)
        check('R1c 생성 중 #158·#157 폴링(살아 있는 잡) — GENERATING 이 보임·jobId 일치·AiJob 행 수 불변·Lesson GENERATING 유지·잡 행 FAILED 로 안 닫힘', genPolls >= 1 && mismatchJob === 0 && rowsChanged === 0 && lessonNotGen === 0, `GENERATING ${genPolls}/${polls} 불일치 ${mismatchJob} 행증감 ${rowsChanged} 레슨상태 ${lessonNotGen}`)
        check('R1d A4 잡 DONE(실패면 이후 단계 생략)', poll.status === 'DONE', `${poll.status} ${a4Ms}ms`)
        if (poll.status !== 'DONE') throw new Error('A4 수업 생성 실패 — 이후 단계 생략')
        const t1 = await api('GET', '/api/v1/challenges/today')
        check('R1e 생성 뒤 #158 — 수업 READY·lessonId 일치', lessonTaskOf(t1)?.state === 'READY' && lessonTaskOf(t1)?.lessonId === g.lessonId, String(lessonTaskOf(t1)?.state))
        // 단어 세트 4장(5장 중 4장 인정) — 수업이 아직 안 끝났으니 goalMet false
        const ws = await wordSet(T1.id, 4)
        const chW = ws.fin.data.challenge as Json | null
        check('R1f 세트(4장 답) #51 — challenge{goalMet:false·goalMetNow:false·words{4,4}}', ws.fin.status === 200 && !!chW && chW.goalMet === false && chW.goalMetNow === false && JSON.stringify(chW.words) === JSON.stringify({ answered: 4, need: 4 }), JSON.stringify(chW))
        // 수업 진행·완료
        const gl = await api('GET', `/api/v1/lessons/${g.lessonId}`)
        const content = gl.data.content as unknown as LessonContent
        srcContent = content
        const adv = await advanceLesson(g.lessonId, content)
        check('R1g 수업 진행(stageDone 3→4) 200·200', adv === 200200, String(adv))
        const jobsPre = await prisma.aiJob.count({ where: { userId } })
        const done = await api('POST', `/api/v1/lessons/${g.lessonId}/complete`, {})
        const chL = done.data.challenge as Json | null | undefined
        check('R1h #62 완료 200 — 응답에 challenge 키가 있다(값은 객체)', done.status === 200 && 'challenge' in done.data && !!chL, `${done.status} ${JSON.stringify(chL ?? null)}`)
        check('R1i 수업이 달성을 채움 — goalMet true·goalMetNow true(1번)·words null(수업이라)·challengeId·date 일치', !!chL && chL.goalMet === true && chL.goalMetNow === true && chL.words === null && chL.challengeId === cid && chL.date === today, JSON.stringify(chL ?? null))
        const jobsPost = await prisma.aiJob.count({ where: { userId } })
        info(`R1 #62 완료 전후 AiJob 행 ${jobsPre}→${jobsPost}(A11 REVIEW_DECISION 가 걸리면 +1 — QA 계정 3 은 공부한 날 1일뿐이라 가드 미통과가 정상)`)
        const done2 = await api('POST', `/api/v1/lessons/${g.lessonId}/complete`, {})
        check('R1j 두 번째 #62 → 409(완료 한 번 — goalMetNow 토스트가 다시 뜰 수 없다)', done2.status === 409 && !('challenge' in done2.data), String(done2.status))
        const t2 = await api('GET', '/api/v1/challenges/today')
        check('R1k 완료 뒤 #158 — 수업 DONE·goalMet true', lessonTaskOf(t2)?.state === 'DONE' && (t2.data.today as Json | undefined)?.goalMet === true, String(lessonTaskOf(t2)?.state))
        const ws2 = await wordSet(T1.id, 2)
        const chW2 = ws2.fin.data.challenge as Json | null
        check('R1l 달성 뒤 또 세트(2장) → goalMet true·goalMetNow false', ws2.fin.status === 200 && !!chW2 && chW2.goalMet === true && chW2.goalMetNow === false, JSON.stringify(chW2))
        const lessonRow = await prisma.lesson.findUniqueOrThrow({ where: { id: g.lessonId }, select: { title: true, level: true, content: true, model: true, promptVersion: true, progress: true } })
        srcRow = { title: lessonRow.title, level: lessonRow.level, content: lessonRow.content as Prisma.JsonValue, model: lessonRow.model, promptVersion: lessonRow.promptVersion, progress: lessonRow.progress as Prisma.JsonValue }
        await api('POST', `/api/v1/challenges/${cid}/end`, {})
        // 이 장면의 행은 남겨 둔다(RI·RR 가 기존 수업 내용을 쓰고 restore 가 한꺼번에 지운다) — 다음 단계가 같은 주제 오늘 수업·세트와 겹치지 않게 일단 지운다.
        await restore(userId, b)
      }
      if (!srcRow || !srcContent) throw new Error('원본 수업이 없다')
      const clone = async (topicId: string): Promise<string> => {
        const l = await prisma.lesson.create({
          data: {
            userId, topicId, date: dbDate(today), kind: 'NEW', title: srcRow!.title, level: srcRow!.level, content: srcRow!.content as Prisma.InputJsonValue, status: 'IN_PROGRESS', stageDone: 4,
            progress: (srcRow!.progress ?? Prisma.JsonNull) as Prisma.InputJsonValue, model: srcRow!.model, promptVersion: srcRow!.promptVersion,
          },
        })
        return l.id
      }
      // ── RI ──
      {
        const cr = await api('POST', '/api/v1/challenges', { topicId: T2.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
        const cid = String(cr.data.id ?? '')
        const lid = await clone(T2.id)
        const original = (await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { dailyGoal: true } })).dailyGoal as Prisma.InputJsonValue
        await prisma.challenge.update({ where: { id: cid }, data: { dailyGoal: { broken: true, lesson: 'x' } as Prisma.InputJsonValue } })
        const logSizeBefore = SERVER_LOG && existsSync(SERVER_LOG) ? statSync(SERVER_LOG).size : 0
        const done = await api('POST', `/api/v1/lessons/${lid}/complete`, {})
        const les = await prisma.lesson.findUniqueOrThrow({ where: { id: lid }, select: { status: true, score: true } })
        const logs = await prisma.studyLog.count({ where: { userId, type: 'LESSON', refId: lid } })
        const snaps = await prisma.statsSnapshot.count({ where: { userId, kind: 'LESSON', periodKey: lid } })
        check('RI1 dailyGoal 깨짐 주입 — #62 200·challenge:null(키는 있음)·수업 DONE·StudyLog 1·LESSON 스냅샷 1(완료는 되돌려지지 않음)', done.status === 200 && 'challenge' in done.data && done.data.challenge === null && les.status === 'DONE' && logs === 1 && snaps === 1, `${done.status} challenge=${JSON.stringify(done.data.challenge ?? null)} 수업 ${les.status} 로그 ${logs} 스냅샷 ${snaps}`)
        if (SERVER_LOG && existsSync(SERVER_LOG)) {
          // dev 서버 로그는 stdout 파이프라 응답보다 늦게 flush 될 수 있다 — 3초까지 기다린다(1차 실행에서 즉시 읽기 경합으로 FAIL 이 났다).
          let tail = ''
          let line: string | undefined
          for (let w = 0; w < 30 && !line; w++) {
            tail = readFileSync(SERVER_LOG, 'utf8').slice(logSizeBefore)
            line = tail.split('\n').find((l) => l.includes('[challenges]'))
            if (!line) await sleep(100)
          }
          check('RI2 서버 로그에 "[challenges] … dailyGoal 형태" 한 줄·스택·원문 없음', !!line && /dailyGoal/.test(line) && !/\bat \S+ \(/.test(tail.slice(tail.indexOf('[challenges]'), tail.indexOf('[challenges]') + 400)), (line ?? '(로그 줄 없음)').slice(0, 160))
        } else info('RI2 SERVER_LOG 미지정 — 로그 줄 확인 생략')
        await prisma.challenge.update({ where: { id: cid }, data: { dailyGoal: original } })
        const t = await api('GET', '/api/v1/challenges/today')
        check('RI3 복구 뒤 #158 정상(수업 DONE·goalMet true)', t.status === 200 && lessonTaskOf(t)?.state === 'DONE' && (t.data.today as Json | undefined)?.goalMet === true, `${t.status} ${String(lessonTaskOf(t)?.state)}`)
        const e = await api('POST', `/api/v1/challenges/${cid}/end`, {})
        check('RI4 끝내기 200', e.status === 200, String(e.status))
        await restore(userId, b)
      }
      // ── RR ──
      {
        let bad = 0
        let nIn = 0
        let nOut = 0
        let nullButCounted = 0
        let respButExcluded = 0
        let notDone = 0
        let httpBad = 0
        const rows: string[] = []
        const OFFS = [0, 150, 300, 450, 600, 750, 900, 1050, 1200, 1500, -150, 50]
        // 실제 A4 수업 1회(마지막 회차 하나) + 복제 수업 N-1 회. 순서는 복제 먼저(A4 가 마지막이라 중간에 막혀도 복제 결과는 남는다).
        for (let i = 0; i < TRIALS; i++) {
          const dEnd = OFFS[i % OFFS.length]
          const topic = [T1, T2, T3, T4][i % 4]
          const cr = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
          const cid = String(cr.data.id ?? '')
          const lid = await clone(topic.id)
          if (cr.status !== 200 || !cid) {
            check(`RR 회차 ${i + 1} 준비`, false, String(cr.status))
            bad++
            await restore(userId, b)
            continue
          }
          const cStart = Date.now()
          const [comp, end] = await Promise.all([api('POST', `/api/v1/lessons/${lid}/complete`, {}), delayed(Math.max(0, dEnd), () => api('POST', `/api/v1/challenges/${cid}/end`, {}))])
          const ch = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { status: true, endedAt: true, result: true, activeKey: true } })
          const snap = await prisma.statsSnapshot.findFirst({ where: { userId, kind: 'LESSON', periodKey: lid }, select: { createdAt: true } })
          const les = await prisma.lesson.findUniqueOrThrow({ where: { id: lid }, select: { status: true } })
          const res = (ch.result ?? {}) as Json
          const counted = !!snap && !!ch.endedAt && snap.createdAt.getTime() < ch.endedAt.getTime()
          const lessonsDone = Number(res.lessonsDone ?? -1)
          const resp = comp.data.challenge as Json | null | undefined
          if (comp.status !== 200 || end.status !== 200) httpBad++
          if (les.status !== 'DONE' || !snap) notDone++
          if (lessonsDone !== (counted ? 1 : 0) || ch.activeKey !== null || ch.status !== 'ENDED') bad++
          if (counted) {
            nIn++
            if (!resp) nullButCounted++
          } else {
            nOut++
            if (resp) respButExcluded++
          }
          rows.push(`${dEnd >= 0 ? '+' : ''}${dEnd}ms ${counted ? '반영' : '제외'} done=${lessonsDone} resp=${resp ? 'obj' : 'null'} http ${comp.status}/${end.status} ${Date.now() - cStart}ms`)
          await restore(userId, b)
        }
        info(`RR 회차별(end 시작 오프셋·결과): ${rows.join(' | ')}`)
        check(`RR1 #62 × #159 경합 ${TRIALS}회(복제 수업) — result.lessonsDone == (스냅샷 createdAt < endedAt)·ENDED·activeKey null 불일치 0`, bad === 0, `불일치 ${bad} (반영 ${nIn}·제외 ${nOut})`)
        check('RR2 수업은 항상 DONE·LESSON 스냅샷 존재(완료는 되돌려지지 않음)·HTTP 전부 200', notDone === 0 && httpBad === 0, `미완료 ${notDone} HTTP이상 ${httpBad}`)
        check('RR3 응답엔 진행이 있었는데 결과에선 제외된 경우 0(거짓 토스트 불가)', respButExcluded === 0, String(respButExcluded))
        info(`RR 참고: 반영됐는데 응답 challenge 가 null 인 경우 ${nullButCounted}/${nIn}(Codex C2 지적 1 — REV-124 수용 사항의 실측 빈도)`)
        // 실제 A4 수업 1회 경합(복제 아님)
        const cr = await api('POST', '/api/v1/challenges', { topicId: T4.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
        const cid = String(cr.data.id ?? '')
        const g = await lessonA4(T4.id)
        a4Calls++
        const poll = await pollJobDone(g.jobId, 180_000)
        check('RR4 실제 A4 수업 생성 DONE', poll.status === 'DONE', `${poll.status} ${Math.round(poll.ms)}ms`)
        if (poll.status === 'DONE') {
          const gl = await api('GET', `/api/v1/lessons/${g.lessonId}`)
          await advanceLesson(g.lessonId, gl.data.content as unknown as LessonContent)
          const [comp, end] = await Promise.all([api('POST', `/api/v1/lessons/${g.lessonId}/complete`, {}), delayed(400, () => api('POST', `/api/v1/challenges/${cid}/end`, {}))])
          const ch = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { status: true, endedAt: true, result: true } })
          const snap = await prisma.statsSnapshot.findFirst({ where: { userId, kind: 'LESSON', periodKey: g.lessonId }, select: { createdAt: true } })
          const counted = !!snap && !!ch.endedAt && snap.createdAt.getTime() < ch.endedAt.getTime()
          const lessonsDone = Number(((ch.result ?? {}) as Json).lessonsDone ?? -1)
          check('RR5 실제 A4 수업 #62 × #159(+400ms) — 둘 다 200·result.lessonsDone == 스냅샷 규칙', comp.status === 200 && end.status === 200 && lessonsDone === (counted ? 1 : 0), `${comp.status}/${end.status} ${counted ? '반영' : '제외'} lessonsDone=${lessonsDone} resp=${comp.data.challenge ? 'obj' : 'null'}`)
        }
        await restore(userId, b)
      }
    } finally {
      const left = await restore(userId, b)
      const jobsAfter = await prisma.aiJob.count({ where: { userId } })
      info(`정리: ${JSON.stringify(left)} · AiJob 행 ${jobsBefore}→${jobsAfter} · 실제 #59 호출 ${a4Calls}회`)
    }
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((r) => r.id).join(', ')}` : ''}`)
  if (failed.length) process.exitCode = 1
}
main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
