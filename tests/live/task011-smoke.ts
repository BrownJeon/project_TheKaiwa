/**
 * task-011 라이브 스모크 — AI 평가 서버(#65~#69·#67a·#67b·#38 SET_LEVEL)를 실제 서버(127.0.0.1)·실제 DB·실제 A6/A7 로 친다.
 *
 * 흐름: 인증·검증 → 단어 부족 400(QA2) → WORDS 출제(A6) → 진행 중 409·IDOR → 상세(정답 숨김) → 답 검증 400 → 전부 맞게 답(DB 정답)·
 *   덮어쓰기 → 응답에 점수 없음 → 이전 DONE(N4·92점) 심기 → 제출(A7)·재제출 같은 잡 → 제출 뒤 답 409 → DONE(총점 100·정답 공개·
 *   StudyLog 1·EVALUATION 1·DAILY +1)·SET_LEVEL 제안(근거 2건) → 다시 제출 409 → 제안 채택 → Profile.level N3 → 기록 목록·커서 →
 *   TALK 출제(주제) → 듣기 문장 숨김·소리(#67a) → 발화 연결·재사용 409·남의 발화 404 → 조립·상황·틀린 곳 답(상황 하나 미답) →
 *   **EVALUATION 스냅샷 선점으로 채점 트랜잭션 실패 → GRADING 잔류·행 변화 0** → 선점 제거 → 다시 채점(새 잡) → DONE(행 1·미답 0점·총점 재계산).
 *
 * 실행(우분투 미러): `bash tests/live/task011-smoke.sh [포트=3015]`. DB 는 개발·운영 공유라 QA 두 계정의 평가 관련 행만 비우고
 * 레벨·오늘 DAILY 는 시작 전 값으로 되돌린다.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient, type JlptLevel, type Prisma } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3015'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task011-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|promptVersion|"model"/i
const MARK = 't011-smoke'
const WORD_CATEGORY = 't011스모크'
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
const metrics: Record<string, string | number> = {}
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
async function api(cookie: string | null, method: string, path: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const t = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t
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
const details = (r: Res) => (r.body.data?.details ?? {}) as Json
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))
const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))

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
const createdUtterances: string[] = []
let sttKey = ''
async function upload(cookie: string, text: string, extra: Record<string, string> = {}): Promise<Res> {
  const f = new FormData()
  f.set('audio', new File([new Uint8Array(wav(900))], 'u.wav', { type: 'audio/wav' }))
  f.set('text', text)
  f.set('realtimeConnectionKey', sttKey)
  f.set('durationMs', '900')
  for (const [k, v] of Object.entries(extra)) f.set(k, v)
  const r = await fetch(`${BASE}/api/v1/speech/utterances`, { method: 'POST', headers: { Cookie: cookie }, body: f })
  const t = await r.text()
  let parsed: Res['body']
  try {
    parsed = JSON.parse(t)
  } catch {
    parsed = { success: false, data: {}, message: t.slice(0, 200) }
  }
  const id = String((parsed.data as Json)?.utteranceId ?? '')
  if (id) createdUtterances.push(id)
  return { status: r.status, body: parsed, text: t, ms: 0 }
}

/** #55 폴링 — DONE/FAILED 까지(최대 timeoutMs). */
async function pollJob(cookie: string, jobId: string, timeoutMs = 150_000): Promise<{ status: string; error: unknown; ms: number }> {
  const t = Date.now()
  for (;;) {
    const r = await api(cookie, 'GET', `/api/v1/jobs/${jobId}`)
    const st = String(d(r).status ?? '')
    if (st === 'DONE' || st === 'FAILED' || r.status !== 200) return { status: r.status === 200 ? st : `HTTP${r.status}`, error: d(r).error, ms: Date.now() - t }
    if (Date.now() - t > timeoutMs) return { status: 'TIMEOUT', error: null, ms: Date.now() - t }
    await sleep(1_500)
  }
}

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}

/** QA 계정의 평가 관련 행 — 평가(문항 Cascade)·EVALUATION 기록·스냅샷·평가 잡·SET_LEVEL 제안·평가 발화·평가 Trace. */
async function wipe(userId: string): Promise<void> {
  const utts = await prisma.utterance.findMany({ where: { userId, evaluationItemId: { not: null } }, select: { id: true, audioPath: true } })
  for (const u of utts) if (u.audioPath) await removeDataFile(u.audioPath.split('/')).catch(() => undefined)
  await prisma.utterance.deleteMany({ where: { id: { in: utts.map((u) => u.id) } } })
  const evals = await prisma.evaluation.findMany({ where: { userId }, select: { id: true } })
  await prisma.statsSnapshot.deleteMany({ where: { userId, kind: 'EVALUATION' } })
  await prisma.studyLog.deleteMany({ where: { userId, type: 'EVALUATION' } })
  await prisma.evaluation.deleteMany({ where: { id: { in: evals.map((e) => e.id) } } })
  await prisma.aiJob.deleteMany({ where: { userId, kind: { in: ['EVAL_GEN', 'EVAL_GRADE'] } } })
  await prisma.tutorProposal.deleteMany({ where: { userId, kind: 'SET_LEVEL' } })
  await prisma.requestTrace.deleteMany({ where: { userId, refType: { in: ['evalGen', 'evalGrade', 'evalAudio'] } } })
}

const dailyBackup: { userId: string; date: string; data: Prisma.JsonValue | null }[] = []
let levelBackup: JlptLevel | null = null
const createdWordIds: string[] = []

function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}
async function dailyEvals(userId: string): Promise<number> {
  const row = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId, kind: 'DAILY', periodKey: todayKst() } }, select: { data: true } })
  const v = (row?.data as Json | undefined)?.evals
  return typeof v === 'number' ? v : 0
}
async function rowCounts(userId: string, evaluationId: string): Promise<{ logs: number; snaps: number }> {
  return {
    logs: await prisma.studyLog.count({ where: { userId, type: 'EVALUATION', refId: evaluationId } }),
    snaps: await prisma.statsSnapshot.count({ where: { userId, kind: 'EVALUATION', periodKey: evaluationId } }),
  }
}

type Item = { id: string; order: number; kind: string; prompt: Json; expected: Json | null; score: number | null; feedback: string | null; answered: boolean; answerText: string | null; correct: boolean | null }

async function createAndWait(cookie: string, body: Json, tag: string): Promise<{ id: string; created: Res }> {
  let created = await api(cookie, 'POST', '/api/v1/evaluations', body)
  let id = String(d(created).evaluationId ?? '')
  let job = await pollJob(cookie, String(d(created).jobId ?? ''))
  metrics[`${tag}GenMs`] = job.ms
  if (job.status === 'FAILED') {
    // 출제 실패 → 다시 만들기(같은 행 되살리기)
    const again = await api(cookie, 'POST', '/api/v1/evaluations', body)
    const failedRow = await prisma.evaluation.findUnique({ where: { id }, select: { status: true } })
    check(`${tag} 출제 실패 → 다시 만들기 = 같은 행 되살리기`, again.status === 200 && d(again).evaluationId === id, `${job.error} → ${again.status} ${failedRow?.status}`)
    created = again
    id = String(d(again).evaluationId ?? '')
    job = await pollJob(cookie, String(d(again).jobId ?? ''))
    metrics[`${tag}GenMs2`] = job.ms
  }
  check(`${tag} 출제 잡 DONE(A6)`, job.status === 'DONE', `${job.status} ${job.ms}ms ${String(job.error ?? '')}`)
  return { id, created }
}

async function main() {
  const u1 = await uid('qa-bot@thekaiwa.test')
  const u2 = await uid('qa-bot2@thekaiwa.test')
  await wipe(u1)
  await wipe(u2)
  for (const userId of [u1, u2]) {
    const row = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId, kind: 'DAILY', periodKey: todayKst() } }, select: { data: true } })
    dailyBackup.push({ userId, date: todayKst(), data: row?.data ?? null })
  }
  const env = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase() as 'LOCAL'
  sttKey = (await prisma.engineConnection.findFirst({ where: { environment: env, role: 'REALTIME_STT' }, select: { id: true } }))?.id ?? ''
  const prof = await prisma.profile.upsert({ where: { userId: u1 }, update: {}, create: { userId: u1 }, select: { level: true } })
  levelBackup = prof.level
  await prisma.profile.update({ where: { userId: u1 }, data: { level: 'N4' } })

  // ── 준비: QA1 단어 8개(#41, 보강 없음) ─────────────────────────────
  const WORDS = [
    ['駅', 'えき', '역'], ['会計', 'かいけい', '계산'], ['冷たい', 'つめたい', '차갑다'], ['注文', 'ちゅうもん', '주문'],
    ['予約', 'よやく', '예약'], ['忘れる', 'わすれる', '잊다'], ['急ぐ', 'いそぐ', '서두르다'], ['静か', 'しずか', '조용하다'],
  ]
  for (const [surface, reading, meaning] of WORDS) {
    const r = await api(COOKIE1, 'POST', '/api/v1/words', { surface, reading, meaning, category: WORD_CATEGORY })
    const wid = (d(r).word as Json | undefined)?.id
    if (r.status === 200 && wid) createdWordIds.push(String(wid))
  }
  const u1Words = await prisma.wordEntry.count({ where: { userId: u1, archived: false } })
  check('0a 준비: QA1 단어 ≥8', u1Words >= 8, `단어 ${u1Words}개(이번에 만든 것 ${createdWordIds.length})`)

  // ── 1. 인증·검증·단어 부족 ────────────────────────────────────────
  check('1a 세션 없음 → 401', (await api(null, 'POST', '/api/v1/evaluations', { kind: 'WORDS' })).status === 401)
  check('1b 종류 오류·모르는 키 → 400', (await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'LESSON' })).status === 400 && reason(await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'WORDS', total: 1 })) === 'unknown_key')
  check('1c 없는 주제 → 404', (await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'TALK', topicId: 'nope_topic' })).status === 404)
  // task-068: 평가 재료 = 내 단어 + 공용 기본 단어(내가 보관 안 함) — QA2 도 기본 단어를 보므로 보통 이 분기는 건너뛴다.
  const u2Words = await prisma.wordEntry.count({ where: { OR: [{ userId: u2 }, { userId: null, source: 'SEED' }], states: { none: { userId: u2, archived: true } } } })
  if (u2Words < 6) {
    const nw = await api(COOKIE2, 'POST', '/api/v1/evaluations', { kind: 'WORDS' })
    check('1d 단어 부족 → 400 NOT_ENOUGH_WORDS {have, need:6}', nw.status === 400 && reason(nw) === 'NOT_ENOUGH_WORDS' && details(nw).need === 6 && details(nw).have === u2Words, nw.text.slice(0, 160))
  } else check('1d 단어 부족(QA2 단어가 6개 이상이라 건너뜀)', true, `QA2 단어 ${u2Words}`)
  if (u2Words < 4) {
    const nt = await api(COOKIE2, 'POST', '/api/v1/evaluations', { kind: 'TALK' })
    check('1e 회화 평가 단어 부족 → need:4', nt.status === 400 && details(nt).need === 4, nt.text.slice(0, 120))
  }
  check('1f 단어 부족 400 뒤 QA2 평가 행 0', (await prisma.evaluation.count({ where: { userId: u2 } })) === 0)

  // ── 2. WORDS 출제 ───────────────────────────────────────────────
  const w1 = await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'WORDS' })
  const ev1 = String(d(w1).evaluationId ?? '')
  const job1 = String(d(w1).jobId ?? '')
  check('2a WORDS 출제 → {evaluationId, jobId, status:GENERATING}', w1.status === 200 && !!ev1 && !!job1 && d(w1).status === 'GENERATING', w1.text.slice(0, 160))
  const busy = await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'TALK' })
  check('2b 진행 중 평가 있으면 409 {evaluationId}', busy.status === 409 && details(busy).evaluationId === ev1 && reason(busy) === 'IN_PROGRESS', busy.text.slice(0, 160))
  check('2c 남의 평가 상세·잡 → 404', (await api(COOKIE2, 'GET', `/api/v1/evaluations/${ev1}`)).status === 404 && (await api(COOKIE2, 'GET', `/api/v1/jobs/${job1}`)).status === 404)
  const gen = await api(COOKIE1, 'GET', `/api/v1/evaluations/${ev1}`)
  check('2d 출제 중 상세 → GENERATING·jobId·문항 0', d(gen).status === 'GENERATING' ? d(gen).jobId === job1 && (d(gen).items as unknown[]).length === 0 : true, `${d(gen).status}`)
  let job = await pollJob(COOKIE1, job1)
  metrics.wordsGenMs = job.ms
  let evWords = ev1
  if (job.status === 'FAILED') {
    const again = await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'WORDS' })
    check('2e 출제 실패 → 다시 만들기 = 같은 행', again.status === 200 && d(again).evaluationId === ev1, `${String(job.error)} → ${again.status}`)
    evWords = String(d(again).evaluationId ?? ev1)
    job = await pollJob(COOKIE1, String(d(again).jobId ?? ''))
    metrics.wordsGenMs2 = job.ms
  }
  check('2f 출제 잡 DONE(A6 WORDS)', job.status === 'DONE', `${job.status} ${job.ms}ms ${String(job.error ?? '')}`)
  const ready = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evWords}`)
  const items = (d(ready).items ?? []) as Item[]
  const kinds = items.map((i) => i.kind)
  check('2g READY: 10문항·종류 순서(뜻4·읽기2·용법2·분류2)·시작 전 startedAt null', d(ready).status === 'READY' && items.length === 10 && kinds.join(',') === 'MEANING_CHOICE,MEANING_CHOICE,MEANING_CHOICE,MEANING_CHOICE,READING_INPUT,READING_INPUT,USAGE_CHOICE,USAGE_CHOICE,CHUNK_CLASSIFY,CHUNK_CLASSIFY' && d(ready).startedAt === null && d(ready).timeLimitSec === 600, `${d(ready).status} ${kinds.join(',')}`)
  check('2h 제출 전 정답·점수·피드백·차원 숨김', items.every((i) => i.expected === null && i.score === null && i.feedback === null && i.correct === null) && !ready.text.includes('"answer":'), '')
  const dbItems = await prisma.evaluationItem.findMany({ where: { evaluationId: evWords }, orderBy: { order: 'asc' }, select: { id: true, kind: true, prompt: true, expected: true, wordId: true, wordSurfaceSnap: true, chunkType: true } })
  const mySurfaces = new Set((await prisma.wordEntry.findMany({ where: { userId: u1 }, select: { surface: true } })).map((w) => w.surface))
  const linked = dbItems.filter((i) => i.wordSurfaceSnap && mySurfaces.has(i.wordSurfaceSnap)).length
  check('2i 재료 ≥60%(단어장 표기 연결 ≥6/10)·분류 문항 chunkType', linked >= 6 && dbItems.filter((i) => i.kind === 'CHUNK_CLASSIFY').every((i) => !!i.chunkType), `연결 ${linked}/10 wordId ${dbItems.filter((i) => i.wordId).length}`)
  const answerIdx = dbItems.filter((i) => i.kind === 'MEANING_CHOICE' || i.kind === 'USAGE_CHOICE').map((i) => (i.expected as Json).answer as number)
  metrics.choiceAnswerIdx = answerIdx.join('')

  // ── 3. 답 ───────────────────────────────────────────────────────
  const mc = dbItems[0]
  const mcChoices = (mc.prompt as Json).choices as string[]
  const mcRight = mcChoices[(mc.expected as Json).answer as number]
  const mcWrong = mcChoices.find((c) => c !== mcRight) as string
  const ansPath = (evId: string, itemId: string) => `/api/v1/evaluations/${evId}/items/${itemId}/answer`
  check('3a 보기 밖 답 → 400 not_a_choice', reason(await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { answerText: '없는보기' })) === 'not_a_choice')
  check('3b 보기 문항에 pieceOrder → 400·utteranceId → 400', reason(await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { answerText: mcRight, pieceOrder: [0, 1, 2] })) === 'not_assemble' && reason(await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { utteranceId: 'ut_fake' })) === 'not_speaking_item')
  check('3c 음성인데 발화 id 없음 → 400', reason(await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { answerText: 'x', inputSource: 'REALTIME_STT' })) === 'required')
  check('3d 남의 평가 문항에 답 → 404', (await api(COOKIE2, 'POST', ansPath(evWords, mc.id), { answerText: mcRight })).status === 404)
  check('3e 다른 평가의 문항 id → 404', (await api(COOKIE1, 'POST', ansPath(evWords, 'nope_item'), { answerText: mcRight })).status === 404)
  const first = await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { answerText: mcWrong })
  check('3f 첫 답 → 200·graded·점수 없음·expectedShown:false·IN_PROGRESS·startedAt·deadlineAt', first.status === 200 && d(first).graded === true && !('score' in d(first)) && d(first).expectedShown === false && d(first).evaluationStatus === 'IN_PROGRESS' && !!d(first).startedAt && !!d(first).deadlineAt, first.text.slice(0, 200))
  const evRowStarted = await prisma.evaluation.findUnique({ where: { id: evWords }, select: { status: true, startedAt: true } })
  check('3g DB: IN_PROGRESS·startedAt = 첫 답 시각(±10s)', evRowStarted?.status === 'IN_PROGRESS' && Math.abs(Date.now() - (evRowStarted?.startedAt.getTime() ?? 0)) < 10_000)
  const wrongScore = (await prisma.evaluationItem.findUnique({ where: { id: mc.id }, select: { score: true } }))?.score
  const answerMs: number[] = []
  for (const it of dbItems) {
    const e = it.expected as Json
    const p = it.prompt as Json
    let body: Json
    if (it.kind === 'MEANING_CHOICE' || it.kind === 'USAGE_CHOICE') body = { answerText: (p.choices as string[])[e.answer as number] }
    else if (it.kind === 'READING_INPUT') body = { answerText: toKata(String(e.reading)) }
    else body = { answerText: String(it.chunkType ?? e.chunkType).toLowerCase() }
    const r = await api(COOKIE1, 'POST', ansPath(evWords, it.id), body)
    answerMs.push(r.ms)
    if (r.status !== 200) check(`3h 답 저장 ${it.kind}`, false, r.text.slice(0, 160))
  }
  answerMs.sort((a, b) => a - b)
  metrics.answerP50Ms = Math.round(answerMs[Math.floor(answerMs.length / 2)])
  const regraded = await prisma.evaluationItem.findMany({ where: { evaluationId: evWords }, select: { score: true, answerText: true } })
  check('3i 덮어쓰기(틀린 답 0점 → 맞는 답 10점)·전 문항 코드 채점 10', wrongScore === 0 && regraded.every((i) => i.score === 10), regraded.map((i) => i.score).join(','))
  const mid = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evWords}`)
  check('3j 진행 중 상세: answeredCount 10·정답·점수 여전히 숨김', d(mid).answeredCount === 10 && ((d(mid).items ?? []) as Item[]).every((i) => i.answered && i.expected === null && i.score === null))

  // ── 4. 제출·채점(WORDS) ─────────────────────────────────────────
  const prior = await prisma.evaluation.create({
    data: { userId: u1, kind: 'TALK', level: 'N4', status: 'DONE', totalScore: 92, promptVersion: MARK, startedAt: new Date(Date.now() - 2 * 86_400_000), submittedAt: new Date(Date.now() - 2 * 86_400_000), completedAt: new Date(Date.now() - 2 * 86_400_000) },
  })
  const dailyBefore = await dailyEvals(u1)
  check('4a 남의 평가 제출 → 404·본문 키 → 400', (await api(COOKIE2, 'POST', `/api/v1/evaluations/${evWords}/submit`, {})).status === 404 && (await api(COOKIE1, 'POST', `/api/v1/evaluations/${evWords}/submit`, { force: true })).status === 400)
  const sub = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evWords}/submit`, {})
  const sub2 = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evWords}/submit`, {})
  check('4b 제출 → GRADING·재제출은 같은 잡(reused:true)', sub.status === 200 && d(sub).status === 'GRADING' && d(sub).reused === false && sub2.status === 200 && d(sub2).jobId === d(sub).jobId && d(sub2).reused === true, `${sub.text.slice(0, 120)} | ${sub2.text.slice(0, 80)}`)
  const late = await api(COOKIE1, 'POST', ansPath(evWords, mc.id), { answerText: mcRight })
  check('4c 제출 뒤 답 → 409 SUBMITTED', late.status === 409 && reason(late) === 'SUBMITTED')
  job = await pollJob(COOKIE1, String(d(sub).jobId ?? ''))
  metrics.wordsGradeMs = job.ms
  check('4d 채점 잡 DONE(A7 WORDS)', job.status === 'DONE', `${job.status} ${job.ms}ms ${String(job.error ?? '')}`)
  const doneW = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evWords}`)
  const res = (d(doneW).result ?? {}) as Json
  const dItems = (d(doneW).items ?? []) as Item[]
  const rubric = (res.rubric ?? {}) as Json
  check('4e DONE: 총점 100(코드 계산)·EXCELLENT·루브릭 5차원 0~5·코멘트', d(doneW).status === 'DONE' && res.totalScore === 100 && res.grade === 'EXCELLENT' && ['accuracy', 'vocabulary', 'grammar', 'naturalness', 'assembly'].every((k) => typeof rubric[k] === 'number' && (rubric[k] as number) >= 0 && (rubric[k] as number) <= 5) && typeof res.comment === 'string', JSON.stringify(res).slice(0, 200))
  check('4f DONE 이면 정답·점수·맞음·차원 공개', dItems.every((i) => i.expected !== null && i.score === 10 && i.correct === true))
  const cW = await rowCounts(u1, evWords)
  const evDb = await prisma.evaluation.findUnique({ where: { id: evWords }, select: { studyLogId: true, totalScore: true } })
  const logRow = evDb?.studyLogId ? await prisma.studyLog.findUnique({ where: { id: evDb.studyLogId }, select: { origin: true, type: true, refId: true, result: true } }) : null
  check('4g 기록률 100%: StudyLog(EVALUATION,DIRECT) 1·EVALUATION 스냅샷 1·studyLogId 연결·DAILY evals +1', cW.logs === 1 && cW.snaps === 1 && logRow?.origin === 'DIRECT' && logRow?.refId === evWords && res.studyLogId === evDb?.studyLogId && (await dailyEvals(u1)) === dailyBefore + 1, `${JSON.stringify(cW)} daily ${dailyBefore}→${await dailyEvals(u1)}`)
  const lp = res.levelProposal as Json | null
  const lpPayload = (lp?.payload ?? {}) as Json
  const basis = (lpPayload.basis ?? []) as Json[]
  check('4h SET_LEVEL 제안(같은 레벨 ≥90 두 번): N4→N3·근거 2건(92·100, 오래된 것 먼저)·PROPOSED', !!lp && lp.kind === 'SET_LEVEL' && lp.status === 'PROPOSED' && lpPayload.level === 'N3' && lpPayload.fromLevel === 'N4' && basis.length === 2 && basis[0].evaluationId === prior.id && basis[0].totalScore === 92 && basis[1].evaluationId === evWords && basis[1].totalScore === 100 && typeof basis[0].date === 'string', JSON.stringify(lp).slice(0, 240))
  check('4i 채택 전 Profile.level 그대로 N4', (await prisma.profile.findUnique({ where: { userId: u1 }, select: { level: true } }))?.level === 'N4')
  const again = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evWords}/submit`, {})
  check('4j DONE 다시 제출 → 409 ALREADY_DONE·행 변화 0', again.status === 409 && reason(again) === 'ALREADY_DONE' && JSON.stringify(await rowCounts(u1, evWords)) === JSON.stringify(cW))
  const acc = await api(COOKIE1, 'POST', `/api/v1/proposals/${String(lp?.id ?? '')}/accept`, {})
  check('4k 제안 채택 → result.level N3·Profile.level N3', acc.status === 200 && ((d(acc).proposal as Json)?.result as Json)?.level === 'N3' && (await prisma.profile.findUnique({ where: { userId: u1 }, select: { level: true } }))?.level === 'N3', acc.text.slice(0, 160))

  // ── 5. 기록 목록 ─────────────────────────────────────────────────
  const list = await api(COOKIE1, 'GET', '/api/v1/evaluations?limit=1')
  const l1 = (d(list).items ?? []) as Json[]
  const page2 = await api(COOKIE1, 'GET', `/api/v1/evaluations?limit=1&cursor=${encodeURIComponent(String(d(list).nextCursor ?? ''))}`)
  const l2 = (d(page2).items ?? []) as Json[]
  check('5a 기록: 최근 것부터·점수·등급·커서 다음 쪽', list.status === 200 && l1[0]?.id === evWords && l1[0]?.grade === 'EXCELLENT' && l1[0]?.totalScore === 100 && l2[0]?.id === prior.id, `${JSON.stringify(l1[0]).slice(0, 120)} / ${String(l2[0]?.id)}`)
  const onlyW = (d(await api(COOKIE1, 'GET', '/api/v1/evaluations?kind=WORDS')).items ?? []) as Json[]
  check('5b kind 필터·QA2 목록에 QA1 평가 없음', onlyW.every((x) => x.kind === 'WORDS') && ((d(await api(COOKIE2, 'GET', '/api/v1/evaluations')).items ?? []) as unknown[]).length === 0)

  // ── 6. TALK 출제(주제·레벨 N3) ──────────────────────────────────
  const topic = await prisma.conversationTopic.findFirst({ where: { isSeed: true, userId: null }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  const { id: evTalk } = await createAndWait(COOKIE1, { kind: 'TALK', topicId: topic?.id ?? null }, '6a TALK')
  const talk = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evTalk}`)
  const tItems = (d(talk).items ?? []) as Item[]
  const tDb = await prisma.evaluationItem.findMany({ where: { evaluationId: evTalk }, orderBy: { order: 'asc' }, select: { id: true, kind: true, prompt: true, expected: true } })
  const listenDb = tDb.filter((i) => i.kind === 'LISTEN_RESPOND')
  const hiddenTexts = listenDb.map((i) => String((i.prompt as Json).textJa))
  check('6b TALK READY: 6문항(듣기2·조립1·상황2·틀린곳1)·레벨 N3(채택 반영)', d(talk).status === 'READY' && tItems.map((i) => i.kind).join(',') === 'LISTEN_RESPOND,LISTEN_RESPOND,ASSEMBLE,SITUATION_RESPOND,SITUATION_RESPOND,CORRECTION_SPOT' && d(talk).level === 'N3')
  if (d(talk).status !== 'READY') {
    console.log(`  ! TALK 출제가 두 번 모두 실패(${String(d(talk).status)} ${String(d(talk).error)}) — 6c 이후는 건너뛴다(A6 계약 위반은 dev 로그 [json] 줄)`)
    return
  }
  check('6c 듣기 문장 숨김: textHidden·textJa 없음·응답 어디에도 들려줄 문장 없음', tItems.filter((i) => i.kind === 'LISTEN_RESPOND').every((i) => i.prompt.textHidden === true && !('textJa' in i.prompt)) && hiddenTexts.every((t) => t && !talk.text.includes(t)))
  const listen1 = listenDb[0]
  const au = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/items/${listen1.id}/audio`, {})
  if (au.status === 200) {
    const clip = ((d(au).clips ?? []) as Json[])[0]
    const wavRes = clip ? await fetch(`${BASE}${String(clip.url)}`, { headers: { Cookie: COOKIE1 } }) : null
    const head = wavRes ? Buffer.from(await wavRes.arrayBuffer()).subarray(0, 4).toString() : ''
    check('6d 듣기 소리(#67a) → 서명 URL 조각 → audio/wav·문장 글자 없음', !!clip && String(clip.url).startsWith('/api/v1/speech/tts/') && head === 'RIFF' && !au.text.includes(hiddenTexts[0]), `${Math.round(au.ms)}ms cached=${String(clip?.cached)}`)
    metrics.listenAudioMs = Math.round(au.ms)
  } else check('6d 듣기 소리 — 서버 TTS 불가면 422 TTS_UNAVAILABLE', au.status === 422 && reason(au) === 'TTS_UNAVAILABLE', au.text.slice(0, 160))
  const notListen = tDb.find((i) => i.kind === 'ASSEMBLE') as (typeof tDb)[number]
  check('6e 듣기 아닌 문항 소리 → 400·남의 평가 → 404·본문 키 → 400', reason(await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/items/${notListen.id}/audio`, {})) === 'not_listen_item' && (await api(COOKIE2, 'POST', `/api/v1/evaluations/${evTalk}/items/${listen1.id}/audio`, {})).status === 404 && (await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/items/${listen1.id}/audio`, { pace: 'slow' })).status === 400)

  // ── 7. TALK 답(발화·글자·조립), 상황 하나는 미답 ─────────────────
  const modelOf = (i: (typeof tDb)[number]) => String((i.expected as Json).modelAnswerJa ?? '')
  const upEv = await upload(COOKIE1, 'x', { evaluationItemId: listen1.id })
  check('7a #21 evaluationItemId 필드 → 400 FEATURE_NOT_READY(연결은 #67)', upEv.status === 400 && upEv.body.data?.code === 'FEATURE_NOT_READY')
  const up = await upload(COOKIE1, modelOf(listen1))
  const uttId = String(d(up).utteranceId ?? '')
  if (!uttId) check('7b0 #21 업로드', false, up.text.slice(0, 160))
  const la = await api(COOKIE1, 'POST', ansPath(evTalk, listen1.id), { inputSource: 'REALTIME_STT', utteranceId: uttId })
  const uRow = uttId ? await prisma.utterance.findUnique({ where: { id: uttId }, select: { evaluationItemId: true } }) : null
  check('7b 듣기 답 = 발화 연결(utteranceId·hasAudio·answerText = 발화 텍스트·graded:false)', la.status === 200 && d(la).utteranceId === uttId && d(la).hasAudio === true && d(la).answerText === modelOf(listen1) && d(la).graded === false && d(la).inputSource === 'REALTIME_STT' && uRow?.evaluationItemId === listen1.id, la.text.slice(0, 200))
  const reuse = await api(COOKIE1, 'POST', ansPath(evTalk, listenDb[1].id), { utteranceId: uttId })
  check('7c 같은 발화를 다른 문항에 → 409 UTTERANCE_USED', reuse.status === 409 && reason(reuse) === 'UTTERANCE_USED')
  check('7d 같은 발화로 같은 문항 다시 답 → 200', (await api(COOKIE1, 'POST', ansPath(evTalk, listen1.id), { utteranceId: uttId })).status === 200)
  const upB = await upload(COOKIE2, 'よそのはつわ')
  check('7e 남의 발화 → 404', (await api(COOKIE1, 'POST', ansPath(evTalk, listenDb[1].id), { utteranceId: String(d(upB).utteranceId ?? '') })).status === 404)
  check('7f 듣기 2 = 글자 답(TEXT)', (await api(COOKIE1, 'POST', ansPath(evTalk, listenDb[1].id), { answerText: modelOf(listenDb[1]) })).status === 200)
  const pieces = (notListen.prompt as Json).pieces as string[]
  const order = (notListen.expected as Json).order as string[]
  const used = new Set<number>()
  const pieceOrder = order.map((o) => {
    const i = pieces.findIndex((p, k) => p === o && !used.has(k))
    used.add(i)
    return i
  })
  check('7g 조립: 순열 아님 → 400·조각 번호 순서 저장·answerOrder 되돌림', reason(await api(COOKIE1, 'POST', ansPath(evTalk, notListen.id), { pieceOrder: [0, 0, 1].slice(0, pieces.length) })) === 'not_a_permutation' && d(await api(COOKIE1, 'POST', ansPath(evTalk, notListen.id), { pieceOrder })).graded === true)
  const sit = tDb.filter((i) => i.kind === 'SITUATION_RESPOND')
  await api(COOKIE1, 'POST', ansPath(evTalk, sit[0].id), { answerText: modelOf(sit[0]) })
  const cs = tDb.find((i) => i.kind === 'CORRECTION_SPOT') as (typeof tDb)[number]
  const cse = cs.expected as Json
  await api(COOKIE1, 'POST', ansPath(evTalk, cs.id), { answerText: `「${String(cse.wrongSpan)}」が間違いです。${String(cse.correctedJa)}` })
  const mid2 = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evTalk}`)
  const asmItem = ((d(mid2).items ?? []) as (Item & { answerOrder: number[] | null })[]).find((i) => i.kind === 'ASSEMBLE')
  check('7h 진행 중: 5/6 답·조립 answerOrder·answerText = 이은 문장', d(mid2).answeredCount === 5 && JSON.stringify(asmItem?.answerOrder) === JSON.stringify(pieceOrder) && asmItem?.answerText === order.join(''))

  // ── 8. 채점 트랜잭션 실패 → GRADING 잔류 → 다시 채점 ───────────────
  const dailyBefore2 = await dailyEvals(u1)
  const blocker = await prisma.statsSnapshot.create({ data: { userId: u1, kind: 'EVALUATION', periodKey: evTalk, data: { mark: MARK } } })
  const s1 = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/submit`, {})
  job = await pollJob(COOKIE1, String(d(s1).jobId ?? ''))
  metrics.talkGradeFailMs = job.ms
  const stuck = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evTalk}`)
  const c1 = await rowCounts(u1, evTalk)
  check('8a 채점 마지막 트랜잭션 실패(스냅샷 선점) → 잡 FAILED·평가 GRADING 잔류·jobId null·error·StudyLog 0·DAILY 그대로', job.status === 'FAILED' && d(stuck).status === 'GRADING' && d(stuck).jobId === null && !!d(stuck).error && c1.logs === 0 && (await dailyEvals(u1)) === dailyBefore2 && (await prisma.evaluation.findUnique({ where: { id: evTalk }, select: { studyLogId: true } }))?.studyLogId === null, `${job.status} ${String(d(stuck).status)} ${String(d(stuck).error)} ${JSON.stringify(c1)}`)
  check('8b GRADING 동안 새 평가 → 409', (await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'WORDS' })).status === 409)
  await prisma.statsSnapshot.delete({ where: { id: blocker.id } })
  const s2 = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/submit`, {})
  check('8c 다시 채점 → 새 잡(reused:false, 앞 잡과 다름)', s2.status === 200 && d(s2).reused === false && d(s2).jobId !== d(s1).jobId, s2.text.slice(0, 160))
  job = await pollJob(COOKIE1, String(d(s2).jobId ?? ''))
  metrics.talkGradeMs = job.ms
  check('8d 다시 채점 잡 DONE(A7 TALK)', job.status === 'DONE', `${job.status} ${String(job.error ?? '')}`)
  const doneT = await api(COOKIE1, 'GET', `/api/v1/evaluations/${evTalk}`)
  const tRes = (d(doneT).result ?? {}) as Json
  const tDone = (d(doneT).items ?? []) as Item[]
  const sum = tDone.reduce((a, i) => a + (i.score ?? 0), 0)
  const unanswered = tDone.find((i) => i.id === sit[1].id)
  check('8e DONE: 총점 = round(Σscore/60×100)·미답 상황 0점·조립 정답 10·듣기 문장 공개', d(doneT).status === 'DONE' && tRes.totalScore === Math.round((sum / 60) * 100) && unanswered?.score === 0 && tDone.find((i) => i.kind === 'ASSEMBLE')?.score === 10 && tDone.filter((i) => i.kind === 'LISTEN_RESPOND').every((i) => typeof i.prompt.textJa === 'string' && i.prompt.textHidden === false), `total ${String(tRes.totalScore)} Σ${sum} scores ${tDone.map((i) => i.score).join(',')}`)
  const c2 = await rowCounts(u1, evTalk)
  check('8f 다시 채점 뒤 행 1:1(StudyLog 1·스냅샷 1)·DAILY +1', c2.logs === 1 && c2.snaps === 1 && (await dailyEvals(u1)) === dailyBefore2 + 1, `${JSON.stringify(c2)}`)
  const doneCount = await prisma.evaluation.count({ where: { userId: u1, status: 'DONE', promptVersion: { not: MARK } } })
  const snapCount = await prisma.statsSnapshot.count({ where: { userId: u1, kind: 'EVALUATION' } })
  check('8g QA: count(DONE) == count(Snapshot EVALUATION)', doneCount === snapCount, `${doneCount}/${snapCount}`)
  check('8h 서술형 피드백(한국어)·루브릭', tDone.filter((i) => i.kind !== 'ASSEMBLE').every((i) => typeof i.feedback === 'string' && i.feedback.length > 0) && typeof tRes.rubric === 'object', tDone.map((i) => (i.feedback ?? '').slice(0, 20)).join(' | '))
  metrics.talkTotal = Number(tRes.totalScore ?? -1)
  metrics.talkScores = tDone.map((i) => i.score).join(',')

  // ── 9. 시작 훅(#67b)·엔진명 ────────────────────────────────────────
  check('9a #67b 시작 — DONE 평가 → 409·남의 것 404', (await api(COOKIE1, 'POST', `/api/v1/evaluations/${evTalk}/start`)).status === 409 && (await api(COOKIE2, 'POST', `/api/v1/evaluations/${evTalk}/start`)).status === 404)
  const traces = await prisma.requestTrace.findMany({ where: { userId: u1, refType: { in: ['evalGen', 'evalGrade'] } }, orderBy: { createdAt: 'asc' }, select: { refType: true, status: true, steps: true, totalMs: true } })
  metrics.traces = traces
    .map((t) => {
      const llm = (t.steps as { name?: string; ms?: number; attempts?: number }[]).find((x) => x.name === 'LLM')
      return `${t.refType}:${t.status} total=${t.totalMs}ms llm=${llm?.ms}ms attempts=${llm?.attempts}`
    })
    .join(' | ')
  check('9b 응답 전체 엔진명·모델명 누출 0', leakHits === 0, `hits ${leakHits}`)
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
      await prisma.wordEntry.deleteMany({ where: { userId: u1, OR: [{ id: { in: createdWordIds } }, { category: WORD_CATEGORY }] } })
      if (levelBackup) await prisma.profile.update({ where: { userId: u1 }, data: { level: levelBackup } })
      for (const b of dailyBackup) {
        if (b.data === null) await prisma.statsSnapshot.deleteMany({ where: { userId: b.userId, kind: 'DAILY', periodKey: b.date } })
        else await prisma.statsSnapshot.updateMany({ where: { userId: b.userId, kind: 'DAILY', periodKey: b.date }, data: { data: b.data as Prisma.InputJsonValue } })
      }
      console.log('(QA 데이터 정리: 평가·잡·기록·스냅샷·제안·발화·단어 삭제, 레벨·DAILY 복원)')
    } catch (e) {
      console.error('정리 실패:', e instanceof Error ? e.message : 'unknown')
    }
    await prisma.$disconnect()
    const failed = results.filter((r) => !r.ok)
    console.log(`\n지표: ${JSON.stringify(metrics)}`)
    console.log(`결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — 실패 ${failed.map((f) => f.id).join(', ')}` : ''}`)
    process.exit(failed.length ? 1 : 0)
  })
