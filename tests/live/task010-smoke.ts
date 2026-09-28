/**
 * task-010 라이브 스모크 — QA 계정 두 개로 오늘의 회화 서버(#56·#58~#62·#62a~#62c)를 실제 서버(127.0.0.1)·실제 DB·실제 A4/A10/TTS 에 친다.
 * 흐름: 주제 → 생성(잡) → 폴링 → 상세 → 진행 → 메모 제안(채택 전 WordEntry 0 → 채택 → source LESSON) → 말하기(발화 연결) → 오디오 →
 * 롤백 확인(LESSON 스냅샷 선점으로 완료 트랜잭션 중간 실패) → 완료 → 두 번째 완료 409(행 증가 0) → 붙여넣기 레슨 → 완료 경합(BASE2 면 두 프로세스).
 *
 * 실행(우분투 미러): `bash tests/live/task010-smoke.sh [포트=3011] [경합용 두 번째 포트]` — 세션 쿠키 생성·삭제를 감싼다.
 * LLM 호출: A4 2회(주제·붙여넣기) + A10 1~2회. DB 는 개발·운영 공유라 **QA 두 계정 행만** 지운다(시작·끝). DAILY 는 시작 전 값으로 되돌린다.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
const BASE2 = process.env.BASE2 ?? ''
for (const b of [BASE, BASE2].filter(Boolean)) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(b)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task010-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|promptVersion|"model"/i
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
const metrics: Record<string, number | string> = {}
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
  ms: number
}
async function api(cookie: string | null, method: string, path: string, body?: unknown, base = BASE): Promise<Res> {
  const t0 = performance.now()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t0
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}: ${text.match(LEAK)?.[0]}`)
  }
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 200) }
  }
  return { status: r.status, body: parsed, text, ms }
}
const d = (r: Res) => r.body.data as Json
const reason = (r: Res) => (r.body.data?.details as Json | undefined)?.reason
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

function wav(ms: number): Buffer {
  const bytes = Math.round((16_000 * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + bytes)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + bytes, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(16_000, 24)
  b.writeUInt32LE(32_000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(bytes, 40)
  return b
}
async function upload(cookie: string, text: string, key: string, lessonId: string | null): Promise<Res> {
  const f = new FormData()
  f.set('audio', new File([new Uint8Array(wav(900))], 'u.wav', { type: 'audio/wav' }))
  f.set('text', text)
  f.set('realtimeConnectionKey', key)
  f.set('durationMs', '900')
  if (lessonId) f.set('lessonId', lessonId)
  const r = await fetch(`${BASE}/api/v1/speech/utterances`, { method: 'POST', headers: { Cookie: cookie }, body: f })
  const text2 = await r.text()
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text2)
  } catch {
    parsed = { success: false, data: {}, message: text2.slice(0, 200) }
  }
  return { status: r.status, body: parsed, text: text2, ms: 0 }
}

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}

const createdUtterances: string[] = []
async function wipe(userId: string): Promise<void> {
  const utts = await prisma.utterance.findMany({ where: { userId, lessonId: { not: null } }, select: { id: true, audioPath: true } })
  for (const u of utts) if (u.audioPath) await removeDataFile(u.audioPath.split('/')).catch(() => undefined)
  await prisma.utterance.deleteMany({ where: { id: { in: utts.map((u) => u.id) } } })
  const lessons = await prisma.lesson.findMany({ where: { userId }, select: { id: true } })
  const ids = lessons.map((l) => l.id)
  await prisma.statsSnapshot.deleteMany({ where: { userId, kind: 'LESSON' } })
  await prisma.studyLog.deleteMany({ where: { userId, type: { in: ['LESSON', 'REVIEW'] } } })
  await prisma.repetitionItem.deleteMany({ where: { userId } })
  await prisma.aiJob.deleteMany({ where: { userId, kind: 'LESSON_GEN' } })
  await prisma.tutorProposal.deleteMany({ where: { userId, chatId: null, kind: 'ADD_WORD' } })
  await prisma.wordEntry.deleteMany({ where: { userId, OR: [{ source: 'LESSON' }, { category: 'task010-smoke' }] } })
  await prisma.requestTrace.deleteMany({ where: { userId, refType: { in: ['lessonGen', 'lessonAudio'] } } })
  await prisma.lesson.deleteMany({ where: { id: { in: ids } } })
}

async function pollJob(cookie: string, jobId: string, timeoutMs = 240_000): Promise<{ status: string; ms: number; job: Json }> {
  const t0 = performance.now()
  let wait = 2_000
  for (;;) {
    const r = await api(cookie, 'GET', `/api/v1/jobs/${jobId}`)
    const job = d(r)
    if (job.status === 'DONE' || job.status === 'FAILED') return { status: String(job.status), ms: performance.now() - t0, job }
    if (performance.now() - t0 > timeoutMs) return { status: 'TIMEOUT', ms: performance.now() - t0, job }
    await sleep(wait)
    wait = Math.min(5_000, wait + 1_000)
  }
}

interface Content {
  dialogue: { ja: string; reading: string; segment: number }[]
  segmentCount: number
  chunks: { id: string; textJa: string; reading: string; isNew: boolean }[]
  grammar: { id: string; pattern: string }[]
  quiz: { id: string; answer: number; targetIds: string[] }[]
  application: { id: string; modelAnswerJa: string }[]
  speaking: { id: string; modelAnswerJa: string; targetIds: string[] }[]
  nextPreview: { titleKo: string; teaserKo: string }
}

async function counts(userId: string, lessonId: string) {
  return {
    logs: await prisma.studyLog.count({ where: { userId, type: 'LESSON', refId: lessonId } }),
    snaps: await prisma.statsSnapshot.count({ where: { userId, kind: 'LESSON', periodKey: lessonId } }),
    items: await prisma.repetitionItem.count({ where: { userId } }),
    studied: (await prisma.repetitionItem.aggregate({ where: { userId }, _sum: { studiedCount: true } }))._sum.studiedCount ?? 0,
  }
}
async function dailyLessons(userId: string, date: string): Promise<number> {
  const row = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId, kind: 'DAILY', periodKey: date } }, select: { data: true } })
  const v = (row?.data as { lessons?: unknown } | null)?.lessons
  return typeof v === 'number' ? v : 0
}

const dailyBackup: { userId: string; date: string; data: Prisma.JsonValue | null }[] = []

async function main() {
  const u1 = await uid('qa-bot@thekaiwa.test')
  const u2 = await uid('qa-bot2@thekaiwa.test')
  await wipe(u1)
  await wipe(u2)
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
  for (const u of [u1, u2]) {
    const row = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u, kind: 'DAILY', periodKey: today } }, select: { data: true } })
    dailyBackup.push({ userId: u, date: today, data: row ? row.data : null })
  }
  const env = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase() as 'LOCAL'
  const stt = await prisma.engineConnection.findFirst({ where: { environment: env, role: 'REALTIME_STT' }, select: { id: true } })

  // ── 1. 주제 #56 ─────────────────────────────────────────────
  check('1a 세션 없음 401', (await api(null, 'GET', '/api/v1/topics')).status === 401)
  const tp = await api(COOKIE1, 'GET', '/api/v1/topics')
  const topics = (d(tp).items as Json[]) ?? []
  check('1b 주제 목록(시드·조각·lessonCount·lastLessonAt·level 창)', tp.status === 200 && topics.length > 0 && topics.every((t) => Array.isArray(t.chunks) && (t.chunks as unknown[]).length > 0 && t.lessonCount === 0 && t.lastLessonAt === null) && Array.isArray(d(tp).level), `${topics.length}개 level=${JSON.stringify(d(tp).level)}`)
  check('1c level=N6 → 400', (await api(COOKIE1, 'GET', '/api/v1/topics?level=N6')).status === 400)
  const all = (d(await api(COOKIE1, 'GET', '/api/v1/topics?level=N5')).items as Json[]) ?? []
  const topic = all.find((t) => t.title === '카페 주문') ?? all[0] ?? topics[0]
  const other = [...all, ...topics].find((t) => t.id !== topic.id)!
  check('1d 대상 주제 고름', !!topic?.id && !!other?.id, `${topic?.title} / 다른 주제 ${other?.title}`)

  // ── 2. 오늘 #58(시작 전) ──────────────────────────────────────
  const t0 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const rec0 = d(t0).recommendation as Json | null
  check('2a 오늘: NEW·빈 목록·복습 칸 null·추천 START', t0.status === 200 && d(t0).mode === 'NEW' && d(t0).date === today && (d(t0).todayLessons as unknown[]).length === 0 && d(t0).review === null && d(t0).resume === null && rec0?.reason === 'START', JSON.stringify(rec0))

  // ── 3. 생성 #59 ──────────────────────────────────────────────
  check('3a 본문 없음·둘 다 → 400', (await api(COOKIE1, 'POST', '/api/v1/lessons', {})).status === 400 && (await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: topic.id, sourceText: 'x' })).status === 400)
  check('3b 붙여넣기 짧음·비일본어 → 400', (await api(COOKIE1, 'POST', '/api/v1/lessons', { sourceText: '短い' })).status === 400 && (await api(COOKIE1, 'POST', '/api/v1/lessons', { sourceText: 'This is not Japanese text at all, just English words. '.repeat(2) })).status === 400)
  check('3c 없는 주제 → 404', (await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: 'nope_topic_id' })).status === 404)
  const genT0 = performance.now()
  const c1 = await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: topic.id })
  const lessonId = String(d(c1).lessonId)
  const jobId = String(d(c1).jobId)
  check('3d 생성 → {lessonId, jobId, GENERATING, reused:false}', c1.status === 200 && d(c1).status === 'GENERATING' && d(c1).reused === false && !!d(c1).jobId, `${c1.status} ${c1.text.slice(0, 160)}`)
  const c2 = await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: topic.id })
  check('3e 같은 날 같은 주제 재요청 → 같은 레슨·같은 잡(새 잡 없음)', c2.status === 200 && d(c2).lessonId === lessonId && d(c2).jobId === jobId && d(c2).reused === true && (await prisma.aiJob.count({ where: { userId: u1, kind: 'LESSON_GEN' } })) === 1)
  const c3 = await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: other.id })
  check('3f 생성 중 다른 주제 → 409 {jobId, lessonId}', c3.status === 409 && (c3.body.data.details as Json)?.jobId === jobId && (c3.body.data.details as Json)?.lessonId === lessonId, `${c3.status} ${JSON.stringify(c3.body.data)}`)
  check('3g 타 사용자 잡·레슨 404', (await api(COOKIE2, 'GET', `/api/v1/jobs/${jobId}`)).status === 404 && (await api(COOKIE2, 'GET', `/api/v1/lessons/${lessonId}`)).status === 404)
  const gGen = await api(COOKIE1, 'GET', `/api/v1/lessons/${lessonId}`)
  check('3h 생성 중 상세: GENERATING·jobId·content null', gGen.status === 200 && d(gGen).status === 'GENERATING' && d(gGen).jobId === jobId && d(gGen).content === null)
  let pr = await pollJob(COOKIE1, jobId)
  metrics.a4TopicMs = Math.round(performance.now() - genT0)
  if (pr.status === 'FAILED') {
    // A4 가 계약 위반을 재시도 뒤에도 못 고치면 레슨 FAILED — "다시 만들기"(같은 요청)는 같은 행을 새 잡으로 되살린다(domain-model §5-3).
    const gf = await api(COOKIE1, 'GET', `/api/v1/lessons/${lessonId}`)
    const re = await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: topic.id })
    check('3i′ 생성 실패 → 레슨 FAILED(오류 코드만) → 다시 만들기 = 같은 행·새 잡', d(gf).status === 'FAILED' && typeof d(gf).error === 'string' && d(re).lessonId === lessonId && d(re).jobId !== jobId && d(re).reused === false, `err=${d(gf).error} → ${re.status}`)
    metrics.a4TopicRetried = String(pr.job.error)
    pr = await pollJob(COOKIE1, String(d(re).jobId))
    metrics.a4TopicMs = Math.round(performance.now() - genT0)
  }
  check('3i 잡 폴링 → DONE(refId = 레슨)', pr.status === 'DONE' && pr.job.refId === lessonId && pr.job.kind === 'LESSON_GEN', `${pr.status} ${Math.round(pr.ms)}ms err=${pr.job.error}`)
  if (pr.status !== 'DONE') throw new Error('A4 생성 실패 — 이후 단계 생략')

  // ── 4. 상세 #60 ──────────────────────────────────────────────
  const g = await api(COOKIE1, 'GET', `/api/v1/lessons/${lessonId}`)
  const L = d(g)
  const content = L.content as unknown as Content
  const segOk = content.dialogue.every((x, i, arr) => x.segment >= 1 && (i === 0 || x.segment >= arr[i - 1].segment))
  const sizes = Array.from({ length: content.segmentCount }, (_, i) => content.dialogue.filter((x) => x.segment === i + 1).length)
  check('4a 상세 READY·content(구간 번호·quiz 5·speaking 3)·audio null', g.status === 200 && L.status === 'READY' && segOk && sizes.every((n) => n === 2 || n === 3) && content.quiz.length === 5 && content.speaking.length === 3 && L.audio === null && L.jobId === null, `dialogue=${content.dialogue.length} 구간=${JSON.stringify(sizes)}`)
  check('4b DTO 에 모델·프롬프트 버전·원문 없음', !('model' in L) && !('promptVersion' in L) && !('sourceText' in L) && L.source === 'TOPIC')
  const dbL = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { model: true, promptVersion: true } })
  check('4c 모델·버전은 DB 에만 저장', !!dbL.model && /^lesson@v\d+$/.test(String(dbL.promptVersion)), String(dbL.promptVersion))
  const r2 = await api(COOKIE1, 'POST', '/api/v1/lessons', { topicId: topic.id })
  check('4d READY 레슨이 있으면 재요청은 그 레슨(L10)', d(r2).lessonId === lessonId && d(r2).status === 'READY' && d(r2).jobId === null)

  // ── 5. 진행 #61 ──────────────────────────────────────────────
  const p1 = await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 1, progress: { listen: { segmentsDone: [1], played: { slow: [1], normal: [1] } } } })
  check('5a 첫 진행 → IN_PROGRESS·stageDone 1', p1.status === 200 && d(p1).status === 'IN_PROGRESS' && d(p1).stageDone === 1)
  check('5b 서버 칸(speaking)·모르는 키 → 400', (await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { progress: { speaking: [] } })).status === 400 && (await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { progress: { hack: 1 } })).status === 400)
  check('5c stageDone 감소 → 400', (await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 0 })).status === 400)
  const big = await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { progress: { application: { answers: ['あ'.repeat(3000)] } } })
  check('5d progress 8KB 초과 → 400 TOO_LARGE', big.status === 400 && reason(big) === 'TOO_LARGE')
  check('5e 타 사용자 진행 404', (await api(COOKIE2, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 2 })).status === 404)
  // quiz: q1 오답 하나, 나머지 정답. 첫 답 고정 확인
  const answers = content.quiz.map((q, i) => (i === 1 ? (q.answer + 1) % 4 : q.answer))
  const pq = await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 3, progress: { quiz: { answers }, application: { answers: [content.application[0].modelAnswerJa, null, null] } } })
  const changed = answers.map((a, i) => (i === 1 ? content.quiz[1].answer : a))
  const pq2 = await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { progress: { quiz: { answers: changed } } })
  check('5f quiz 첫 답 고정(나중에 정답으로 바꿔도 처음 답 유지)', pq.status === 200 && pq2.status === 200 && JSON.stringify(((d(pq2).progress as Json).quiz as Json).answers) === JSON.stringify(answers))

  // ── 6. 메모 #62a ─────────────────────────────────────────────
  const words0 = await prisma.wordEntry.count({ where: { userId: u1 } })
  const chunkA = content.chunks[0]
  const chunkB = content.chunks[1]
  await prisma.wordEntry.create({ data: { userId: u1, surface: chunkB.textJa, meaning: '미리 넣은 단어', source: 'MANUAL', category: 'task010-smoke' } })
  const wordsBefore = await prisma.wordEntry.count({ where: { userId: u1 } })
  const enrichWord = '天気予報'
  const memoBody = { segments: [{ segment: 1, words: [chunkA.reading, chunkB.textJa, 'coffee', chunkA.reading] }, { segment: Math.min(2, content.segmentCount), words: [enrichWord] }] }
  check('6a 타 사용자 메모 404', (await api(COOKIE2, 'POST', `/api/v1/lessons/${lessonId}/memo`, memoBody)).status === 404)
  check('6b 없는 구간 번호 → 400', (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/memo`, { segments: [{ segment: content.segmentCount + 1, words: ['注文'] }] })).status === 400)
  const m1 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/memo`, memoBody)
  const props = (d(m1).proposals as Json[]) ?? []
  const skipped = (d(m1).skipped as Json[]) ?? []
  const reasons = Object.fromEntries(skipped.map((s) => [String(s.surface), String(s.reason)]))
  metrics.memoMs = Math.round(m1.ms)
  check(
    '6c 메모 → 조각 단어·보강 단어 제안, 단어장 단어 IN_WORDBOOK, 비일본어 NOT_JAPANESE, 중복 DUPLICATE',
    m1.status === 200 && props.some((p) => (p.payload as Json).surface === chunkA.textJa && (p.payload as Json).via === 'CHUNK' && (p.payload as Json).memo === chunkA.reading) && reasons[chunkB.textJa] === 'IN_WORDBOOK' && reasons.coffee === 'NOT_JAPANESE' && reasons[chunkA.reading] === 'DUPLICATE',
    `${m1.status} ${Math.round(m1.ms)}ms proposals=${props.map((p) => `${(p.payload as Json).surface}/${(p.payload as Json).via}`).join(',')} skipped=${JSON.stringify(reasons)}`,
  )
  const enrichProp = props.find((p) => (p.payload as Json).surface === enrichWord)
  check('6d 조각에 없는 단어 → A10 보강 제안(via ENRICH) 또는 ENRICH_FAILED 로 보고', !!enrichProp ? (enrichProp.payload as Json).via === 'ENRICH' && typeof (enrichProp.payload as Json).meaning === 'string' : reasons[enrichWord] === 'ENRICH_FAILED', enrichProp ? String((enrichProp.payload as Json).meaning) : reasons[enrichWord])
  const lessonProps = await prisma.tutorProposal.count({ where: { userId: u1, kind: 'ADD_WORD', status: 'PROPOSED', chatId: null } })
  check('6e 채택 전 WordEntry 증가 0 · 제안 행 = 응답 제안 수', (await prisma.wordEntry.count({ where: { userId: u1 } })) === wordsBefore && lessonProps === props.length, `words ${words0}→${wordsBefore}(미리 1) props=${lessonProps}`)
  const m2 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/memo`, memoBody)
  check('6f 같은 메모 다시 보내기 → 새 제안 0, 같은 제안 id', m2.status === 200 && (await prisma.tutorProposal.count({ where: { userId: u1, kind: 'ADD_WORD', chatId: null } })) === lessonProps && JSON.stringify(((d(m2).proposals as Json[]) ?? []).map((p) => p.id).sort()) === JSON.stringify(props.map((p) => p.id).sort()))
  const gm = await api(COOKIE1, 'GET', `/api/v1/lessons/${lessonId}`)
  const listen = ((d(gm).progress as Json).listen ?? {}) as Json
  check('6g progress.listen.memo·proposed 기록', Array.isArray(listen.memo) && (listen.memo as Json[]).some((m) => m.ja === chunkA.reading) && Array.isArray(listen.proposed) && (listen.proposed as Json[]).length >= 2, `memo=${(listen.memo as unknown[])?.length} proposed=${(listen.proposed as unknown[])?.length}`)
  const chunkProp = props.find((p) => (p.payload as Json).surface === chunkA.textJa)!
  const acc = await api(COOKIE1, 'POST', `/api/v1/proposals/${chunkProp.id}/accept`)
  const wid = String(((acc.body.data?.proposal as Json)?.result as Json)?.wordId ?? '')
  const w = wid ? await prisma.wordEntry.findUnique({ where: { id: wid } }) : null
  check('6h 채택 → WordEntry(source=LESSON, sourceRefId=레슨 id, 예문=대화 줄)', acc.status === 200 && w?.source === 'LESSON' && w?.sourceRefId === lessonId && w?.surface === chunkA.textJa, `${acc.status} ${w?.source} ${w?.sourceRefId} ex=${w?.example}`)

  // ── 7. 말하기 #62b ───────────────────────────────────────────
  const s1 = content.speaking[0]
  const sp1 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: s1.id, text: s1.modelAnswerJa })
  metrics.modelAnswerUsed = `${d(sp1).used}(${(d(sp1).matchedIds as unknown[])?.length}/${(s1.targetIds ?? []).length})`
  check('7a 모범 답 그대로 → 목표 표현 인식(matched ≥1)·modelAnswer 반환', sp1.status === 200 && (d(sp1).matchedIds as unknown[]).length >= 1 && !!(d(sp1).modelAnswer as Json)?.ja, JSON.stringify({ used: d(sp1).used, m: d(sp1).matchedIds, x: d(sp1).missedIds, u: d(sp1).unknownIds }))
  const sp2 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: content.speaking[1].id, text: 'はい、そうです。' })
  check('7b 목표 표현 없는 답 → used:false·missed 에 목표', sp2.status === 200 && d(sp2).used === false && (d(sp2).missedIds as unknown[]).length > 0)
  check('7c 없는 과제 400·빈 답 400·타 사용자 404', (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: 's9', text: 'x' })).status === 400 && (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: s1.id, text: ' ' })).status === 400 && (await api(COOKIE2, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: s1.id, text: 'x' })).status === 404)
  if (stt) {
    const upForeign = await upload(COOKIE2, 'x', stt.id, lessonId)
    check('7d 남의 레슨 id 로 발화 업로드 → 404', upForeign.status === 404)
    const up = await upload(COOKIE1, content.speaking[2].modelAnswerJa, stt.id, null)
    const uttId = String(d(up).utteranceId ?? '')
    if (uttId) createdUtterances.push(uttId)
    const sp3 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: content.speaking[2].id, text: content.speaking[2].modelAnswerJa, utteranceId: uttId })
    const urow = uttId ? await prisma.utterance.findUnique({ where: { id: uttId }, select: { lessonId: true } }) : null
    check('7e 발화 연결 → Utterance.lessonId·hasAudio:true·utteranceId 저장', sp3.status === 200 && d(sp3).hasAudio === true && d(sp3).utteranceId === uttId && urow?.lessonId === lessonId, `${sp3.status} ${sp3.text.slice(0, 160)}`)
    const au = await fetch(`${BASE}/api/v1/speech/utterances/${uttId}/audio`, { headers: { Cookie: COOKIE1 } })
    check('7f 내 목소리 다시 듣기(#21b 재사용) 200 audio/wav', au.status === 200 && (au.headers.get('content-type') ?? '').includes('audio/wav'))
    const upL = await upload(COOKIE1, 'はい', stt.id, lessonId)
    const uttL = String(d(upL).utteranceId ?? '')
    if (uttL) createdUtterances.push(uttL)
    check('7g #21 lessonId 업로드 → Utterance.lessonId', upL.status === 200 && (await prisma.utterance.findUnique({ where: { id: uttL }, select: { lessonId: true } }))?.lessonId === lessonId)
    // Codex C2-2: 레슨에 쓴 발화를 채팅 턴에 다시 쓰면 수락 전 409 UTTERANCE_USED(전에는 lessonId 를 보지 않아 통과했다) — 행·LLM 0
    const talk = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'TALK' })
    const talkId = String(d(talk).id ?? '')
    if (talkId) {
      const msgsBefore = await prisma.chatMessage.count({ where: { chatId: talkId } })
      const cross = await api(COOKIE1, 'POST', `/api/v1/chats/${talkId}/turns`, { text: 'はい', utteranceId: uttL, inputSource: 'REALTIME_STT' })
      const after = await prisma.utterance.findUnique({ where: { id: uttL }, select: { lessonId: true, chatMessageId: true } })
      check('7g2 레슨에 쓴 발화 → 채팅 턴 409 UTTERANCE_USED·메시지 0·발화는 레슨 연결 그대로(Codex C2-2)', cross.status === 409 && reason(cross) === 'UTTERANCE_USED' && (await prisma.chatMessage.count({ where: { chatId: talkId } })) === msgsBefore && after?.lessonId === lessonId && after?.chatMessageId === null, `${cross.status} ${reason(cross)}`)
      await prisma.chat.deleteMany({ where: { id: talkId, userId: u1 } })
    } else check('7g2 레슨 발화 → 채팅 턴 409', false, `chat 생성 ${talk.status}`)
    const upB = await upload(COOKIE2, 'はい', stt.id, null)
    const uttB = String(d(upB).utteranceId ?? '')
    if (uttB) createdUtterances.push(uttB)
    check('7h 남의 발화 id → 404', (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: s1.id, text: 'x', utteranceId: uttB })).status === 404)
  } else check('7d~7h 발화 연결(실시간 인식 connection 없음 — 건너뜀)', true, 'SKIP')

  // ── 8. 오디오 #62c ───────────────────────────────────────────
  const a1 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 0, pace: 'slow' })
  if (a1.status === 422) {
    check('8a 오디오: 서버 TTS 불가 → 422 ENGINE_UNAVAILABLE(TTS_UNAVAILABLE)', reason(a1) === 'TTS_UNAVAILABLE', 'M4 불가 상태')
  } else {
    const clip = ((d(a1).clips as Json[]) ?? [])[0]
    const t1 = performance.now()
    const wavRes = clip ? await fetch(`${BASE}${clip.url}`, { headers: { Cookie: COOKIE1 } }) : null
    const first = wavRes ? Buffer.from(await wavRes.arrayBuffer()) : Buffer.alloc(0)
    metrics.audioFirstSoundMs = Math.round(a1.ms + (performance.now() - t1))
    check('8a 대화 줄 느리게 → 서명 URL 조각 → 200 audio/wav', a1.status === 200 && !!clip && String(clip.url).startsWith('/api/v1/speech/tts/') && wavRes?.status === 200 && first.subarray(0, 4).toString() === 'RIFF', `${a1.status} 합성 ${Math.round(a1.ms)}ms cached=${clip?.cached}`)
    const a2 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 0, pace: 'slow' })
    check('8b 같은 문장·속도 재요청 → 캐시(cached:true)', a2.status === 200 && ((d(a2).clips as Json[])[0]?.cached === true), `${Math.round(a2.ms)}ms`)
    const a3 = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'speaking', idx: 0, pace: 'normal' })
    check('8c 모범 답 보통 속도 → 200', a3.status === 200 && ((d(a3).clips as unknown[]) ?? []).length >= 1, `${Math.round(a3.ms)}ms`)
  }
  check('8d 범위 밖 400·모르는 kind 400·엔진 수치 400·타 사용자 404', (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 19 })).status === 400 && (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'quiz', idx: 0 })).status === 400 && (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 0, speed: 1.5 })).status === 400 && (await api(COOKIE2, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 0 })).status === 404)

  // ── 9. 완료 #62 ──────────────────────────────────────────────
  const early = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/complete`, {})
  check('9a 단계 부족(stageDone<4) → 409 STAGES_LEFT', early.status === 409 && reason(early) === 'STAGES_LEFT')
  await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 4 })
  const dailyBefore = await dailyLessons(u1, today)
  // 롤백: LESSON 스냅샷을 미리 넣어 완료 트랜잭션 끝 무렵(스냅샷 생성)에서 실패하게 한다 → 앞선 쓰기(레슨 DONE·반복 항목·학습 기록) 전부 되돌아가야 한다.
  const planted = await prisma.statsSnapshot.create({ data: { userId: u1, kind: 'LESSON', periodKey: lessonId, data: { planted: true } } })
  const before = await counts(u1, lessonId)
  const fail = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/complete`, {})
  const afterFail = await counts(u1, lessonId)
  const lf = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { status: true, score: true } })
  check('9b 중간 실패 → 전부 롤백(레슨 IN_PROGRESS·StudyLog 0·RepetitionItem 0·DAILY 그대로)', fail.status >= 500 && lf.status === 'IN_PROGRESS' && lf.score === null && afterFail.logs === 0 && afterFail.items === before.items && afterFail.items === 0 && (await dailyLessons(u1, today)) === dailyBefore, `${fail.status} ${JSON.stringify(afterFail)}`)
  await prisma.statsSnapshot.delete({ where: { id: planted.id } })
  check('9c 타 사용자 완료 404', (await api(COOKIE2, 'POST', `/api/v1/lessons/${lessonId}/complete`, {})).status === 404)
  const done = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/complete`, { score: 100 })
  const expectedScore = Math.round((4 / 5) * 100)
  const cAfter = await counts(u1, lessonId)
  const res = d(done).result as Json
  check('9d 완료 200: 서버 재채점(80, body 100 무시)·reviewDecisionJobId·nextReview null', done.status === 200 && (d(done).lesson as Json).status === 'DONE' && (d(done).lesson as Json).score === expectedScore && d(done).reviewDecisionJobId === null && d(done).nextReview === null && typeof d(done).studyLogId === 'string', `${done.status} score=${(d(done).lesson as Json)?.score} ${done.text.slice(0, 200)}`)
  const expectItems = Math.min(12, content.chunks.length + content.grammar.length)
  check('9e 한 트랜잭션 결과: StudyLog 1·LESSON 스냅샷 1·DAILY lessons+1·RepetitionItem = 조각+문법', cAfter.logs === 1 && cAfter.snaps === 1 && (await dailyLessons(u1, today)) === dailyBefore + 1 && cAfter.items === expectItems && cAfter.studied === expectItems, JSON.stringify(cAfter))
  const log = await prisma.studyLog.findFirstOrThrow({ where: { userId: u1, refId: lessonId } })
  const lr = log.result as Json
  check('9f StudyLog(LESSON, DIRECT) result(itemIds·used/missed = RepetitionItem id)', log.origin === 'DIRECT' && log.type === 'LESSON' && Array.isArray(lr.itemIds) && (lr.itemIds as unknown[]).length === expectItems && Array.isArray(lr.usedExpressionIds) && lr.quizCorrect === 4, JSON.stringify({ used: lr.usedExpressionIds, missed: lr.missedExpressionIds }).slice(0, 200))
  const items = await prisma.repetitionItem.findMany({ where: { userId: u1 } })
  const wrongTarget = content.quiz[1].targetIds
  const topicChunkIds = new Set((await prisma.topicChunk.findMany({ where: { topicId: String(topic.id) }, select: { id: true } })).map((c) => c.id))
  const refTypesOk = items.every((i) => ['TopicChunk', 'Expr', 'Grammar'].includes(i.refType) && i.decidedBy === 'FALLBACK' && i.intervalDays === 3 && i.nextDueAt !== null)
  const topicRefsOk = items.filter((i) => i.refType === 'TopicChunk').every((i) => topicChunkIds.has(i.refId))
  const wrongOk = content.chunks.filter((c) => wrongTarget.includes(c.id)).every((c) => items.some((i) => (i.refId === c.id || i.textJa === c.textJa) && i.wrongCount >= 1))
  check('9g RepetitionItem: refType 3종·TopicChunk 는 이 주제 조각 id·3일·FALLBACK·오답 문항 대상 wrongCount+1', refTypesOk && topicRefsOk && wrongOk, `types=${[...new Set(items.map((i) => i.refType))]} due=${items[0]?.nextDueAt?.toISOString().slice(0, 10)}`)
  check('9h 완료 응답 요약(quiz 4/5·expressions·nextPreview·repetition)', (res.quiz as Json).correct === 4 && Array.isArray((res.expressions as Json).usedIds) && !!(res.nextPreview as Json)?.titleKo && (res.repetition as Json).items === expectItems)
  const again = await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/complete`, {})
  const cAgain = await counts(u1, lessonId)
  check('9i 두 번째 완료 → 409 ALREADY_DONE, 행 증가 0', again.status === 409 && reason(again) === 'ALREADY_DONE' && JSON.stringify(cAgain) === JSON.stringify(cAfter) && (await dailyLessons(u1, today)) === dailyBefore + 1)
  check('9j DONE 레슨에 진행·메모·말하기 → 409', (await api(COOKIE1, 'PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 5 })).status === 409 && (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/memo`, { segments: [{ segment: 1, words: ['新しい'] }] })).status === 409 && (await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/speaking`, { itemId: s1.id, text: 'x' })).status === 409)
  check('9k DONE 레슨 오디오(다시 듣기)는 된다', [200, 422].includes((await api(COOKIE1, 'POST', `/api/v1/lessons/${lessonId}/audio`, { kind: 'dialogue', idx: 1 })).status))

  // ── 10. 오늘·주제 반영 ────────────────────────────────────────
  const t1 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const tl = (d(t1).todayLessons as Json[]) ?? []
  const rec1 = d(t1).recommendation as Json | null
  check('10a 오늘: 끝낸 레슨(점수·주제·stageDone 5)·추천 CONTINUE + nextPreview', tl.some((x) => x.id === lessonId && x.status === 'DONE' && x.score === expectedScore && x.stageDone === 5 && (x.topic as Json)?.id === topic.id) && rec1?.reason === 'CONTINUE' && rec1?.topicId === topic.id && !!(rec1?.nextPreview as Json)?.titleKo, JSON.stringify(rec1))
  const todaySpeaking = (tl.find((x) => x.id === lessonId)?.speaking ?? null) as Json | null
  const doneExpr = (res.expressions as Json) ?? {}
  check('10a′ 오늘 항목 speaking{used,total} = 완료 응답 expressions 와 같은 계산(§12-11 ①)', !!todaySpeaking && todaySpeaking.used === (doneExpr.usedIds as unknown[]).length && todaySpeaking.total === (doneExpr.usedIds as unknown[]).length + (doneExpr.missedIds as unknown[]).length, JSON.stringify(todaySpeaking))
  const tp2 = (d(await api(COOKIE1, 'GET', '/api/v1/topics?level=N5')).items as Json[]).find((t) => t.id === topic.id)
  check('10b 주제 lessonCount 1·lastLessonAt·lastLessonTitle(§12-11 ②)', tp2?.lessonCount === 1 && typeof tp2?.lastLessonAt === 'string' && tp2?.lastLessonTitle === L.title, String(tp2?.lastLessonTitle))
  check('10b′ 끝낸 적 없는 주제는 lastLessonTitle null', ((d(await api(COOKIE1, 'GET', '/api/v1/topics?level=N5')).items as Json[]) ?? []).filter((t) => t.id !== topic.id).every((t) => t.lastLessonTitle === null))
  check('10c 타 사용자 오늘은 비어 있음', ((d(await api(COOKIE2, 'GET', '/api/v1/lessons/today')).todayLessons as unknown[]) ?? []).length === 0)

  // ── 11. 붙여넣기 레슨 + 완료 경합 ─────────────────────────────
  const src = '昨日、友達と新しいカフェに行きました。店員さんに「ご注文はお決まりですか」と聞かれて、少し緊張しました。私はホットコーヒーを、友達は抹茶ラテを注文しました。窓の外を見ながら、週末の旅行について話しました。とても楽しい時間でした。'
  const tsT0 = performance.now()
  const s = await api(COOKIE1, 'POST', '/api/v1/lessons', { sourceText: src })
  check('11a 붙여넣기 생성 → GENERATING', s.status === 200 && d(s).status === 'GENERATING', `${s.status} ${s.text.slice(0, 160)}`)
  const sId = String(d(s).lessonId)
  const sp = await pollJob(COOKIE1, String(d(s).jobId))
  metrics.a4TextMs = Math.round(performance.now() - tsT0)
  const sg = await api(COOKIE1, 'GET', `/api/v1/lessons/${sId}`)
  const sContent = d(sg).content as unknown as Content | null
  check('11b 붙여넣기 레슨 READY·source TEXT·topic null·조각 전부 new-N', sp.status === 'DONE' && d(sg).status === 'READY' && d(sg).source === 'TEXT' && d(sg).topic === null && !!sContent && sContent.chunks.every((c) => /^new-\d+$/.test(c.id)), `${sp.status} ${Math.round(sp.ms)}ms`)
  if (sContent) {
    await api(COOKIE1, 'PATCH', `/api/v1/lessons/${sId}/progress`, { stageDone: 4 })
    const dl0 = await dailyLessons(u1, today)
    const race = await Promise.all([api(COOKIE1, 'POST', `/api/v1/lessons/${sId}/complete`, {}, BASE), api(COOKIE1, 'POST', `/api/v1/lessons/${sId}/complete`, {}, BASE2 || BASE)])
    const statuses = race.map((r) => r.status).sort()
    const cr = await counts(u1, sId)
    const exprItems = await prisma.repetitionItem.count({ where: { userId: u1, refType: 'Expr' } })
    check(`11c 완료 경합(${BASE2 ? '두 프로세스' : '한 프로세스'}) → 200 하나·409 하나, 행 한 번만`, JSON.stringify(statuses) === '[200,409]' && cr.logs === 1 && cr.snaps === 1 && (await dailyLessons(u1, today)) === dl0 + 1 && exprItems >= sContent.chunks.length, `${statuses} ${JSON.stringify(cr)}`)
  }

  check('12 응답·화면 문구에 엔진명·모델명 0', leakHits === 0, `hits=${leakHits}`)
  // A4 실측(관리자 Trace — 정리 전에 읽는다): 레슨별 LLM 단계 ms·JSON 시도 수
  const traces = await prisma.requestTrace.findMany({ where: { userId: u1, refType: 'lessonGen' }, orderBy: { createdAt: 'asc' }, select: { status: true, steps: true, totalMs: true } })
  metrics.a4Traces = traces
    .map((t) => {
      const llm = (t.steps as { name?: string; ms?: number; attempts?: number }[]).find((x) => x.name === 'LLM')
      return `${t.status} total=${t.totalMs}ms llm=${llm?.ms}ms attempts=${llm?.attempts}`
    })
    .join(' | ')
}

main()
  .catch((e) => {
    console.error('스모크 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    results.push({ id: 'EXCEPTION', ok: false, note: String(e) })
  })
  .finally(async () => {
    try {
      const u1 = await uid('qa-bot@thekaiwa.test')
      const u2 = await uid('qa-bot2@thekaiwa.test')
      for (const id of createdUtterances) {
        const u = await prisma.utterance.findUnique({ where: { id }, select: { audioPath: true } })
        if (u?.audioPath) await removeDataFile(u.audioPath.split('/')).catch(() => undefined)
      }
      await prisma.utterance.deleteMany({ where: { id: { in: createdUtterances } } })
      await wipe(u1)
      await wipe(u2)
      for (const b of dailyBackup) {
        if (b.data === null) await prisma.statsSnapshot.deleteMany({ where: { userId: b.userId, kind: 'DAILY', periodKey: b.date } })
        else await prisma.statsSnapshot.updateMany({ where: { userId: b.userId, kind: 'DAILY', periodKey: b.date }, data: { data: b.data as Prisma.InputJsonValue } })
      }
      console.log('(QA 데이터 정리: 레슨·잡·제안·단어·반복 항목·기록·스냅샷·발화 삭제, DAILY 복원)')
    } catch (e) {
      console.error('정리 실패:', e instanceof Error ? e.message : 'unknown')
    }
    await prisma.$disconnect()
    const failed = results.filter((r) => !r.ok)
    console.log(`\n지표: ${JSON.stringify(metrics)}`)
    console.log(`결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — 실패 ${failed.map((f) => f.id).join(', ')}` : ''}`)
    process.exit(failed.length ? 1 : 0)
  })
