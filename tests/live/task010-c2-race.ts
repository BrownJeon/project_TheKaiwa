/**
 * task-010 Codex C2 경합 실측 — **실제 MariaDB**(개발·운영 공유), QA 계정(qa-bot)만. 한 프로세스의 여러 DB 연결로 트랜잭션을 동시에 돌려
 * 행 잠금·조건부 갱신이 실제로 한쪽만 이기게 하는지 본다(서버 프로세스·LLM 호출 없음).
 *
 *  A. 생성 세대 펜싱(C2-1): 옛 잡 A(RUNNING, 10분 전 시작 → 나이로 stale) ∥ 되살리기(`claimLesson` 과 같은 순서 — 사용자 잠금 → 레슨 상태 →
 *     `findActiveJob` 이 A 를 stale 로 닫음 → 레슨 GENERATING + 새 잡 B)를 동시에. A 의 늦은 **성공** / **실패** 각각 N 회.
 *     불변식: B 가 생겼으면 레슨은 GENERATING(본문 없음·오류 없음)이고 A 는 DONE 이 아니다 — B 만 끝낼 수 있다(끝까지 저장해 확인).
 *             B 가 없으면 A 가 이긴 것 — 성공이면 READY(A 본문)+A DONE, 실패면 FAILED(A 코드).
 *  B. 발화 상호 배타(C2-2): 같은 발화를 레슨 말하기 연결 ∥ 채팅 턴 연결 N 회 → 정확히 한쪽만. 순서대로 쓰면 뒤쪽은 409/연결 안 됨.
 *
 * 실행(미러): `node --env-file=.env --import tsx tests/live/task010-c2-race.ts [반복=12]`. 만든 행(레슨·잡·대화방·메시지·발화)은 끝에 지운다.
 */
import { Prisma } from '@prisma/client'
import { jobs, lockUserRow, prisma, withTransaction } from '../../src/modules/infra'
import { failGeneratedLesson, LessonGenerationSuperseded, saveGeneratedLesson } from '../../src/modules/learning/lessons/generate'
import { checkUtteranceForTurn, linkUtteranceToLesson, linkUtteranceToMessage } from '../../src/modules/speech'

const N = Number(process.argv[2] ?? 12)
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const jitter = () => sleep(Math.floor(Math.random() * 25))
const today = new Date(`${new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)}T00:00:00Z`)
const made = { lessons: [] as string[], chats: [] as string[], utterances: [] as string[] }

async function claimRevive(uid: string, lessonId: string): Promise<{ kind: 'reused' | 'active' | 'revived'; jobId: string | null }> {
  return withTransaction(async (tx) => {
    await lockUserRow(tx, uid)
    const l = await tx.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { status: true } })
    if (l.status === 'READY' || l.status === 'IN_PROGRESS') return { kind: 'reused' as const, jobId: null }
    if (l.status === 'GENERATING') {
      const active = await jobs.findActiveJob({ userId: uid, kind: 'LESSON_GEN', refId: lessonId }, tx)
      if (active) return { kind: 'active' as const, jobId: active.id }
      await tx.lesson.updateMany({ where: { id: lessonId, status: 'GENERATING' }, data: { status: 'FAILED', error: 'stale' } })
    }
    await tx.lesson.update({ where: { id: lessonId }, data: { status: 'GENERATING', content: Prisma.DbNull, error: null } })
    const b = await jobs.createJob({ userId: uid, kind: 'LESSON_GEN', refId: lessonId, status: 'RUNNING' }, tx)
    return { kind: 'revived' as const, jobId: b.id }
  })
}

async function freshGeneration(uid: string): Promise<{ lessonId: string; jobA: string }> {
  const l = await prisma.lesson.create({ data: { userId: uid, date: today, kind: 'NEW', title: 'c2race', level: 'N5', status: 'GENERATING' }, select: { id: true } })
  made.lessons.push(l.id)
  const old = new Date(Date.now() - 10 * 60_000)
  const a = await prisma.aiJob.create({ data: { userId: uid, kind: 'LESSON_GEN', status: 'RUNNING', refId: l.id, createdAt: old, startedAt: old, attempts: 1 }, select: { id: true } })
  return { lessonId: l.id, jobA: a.id }
}

const fields = (title: string) => ({ title, content: { title } as unknown as Prisma.InputJsonValue, model: 'race', promptVersion: 'lesson@race' })

async function raceGeneration(uid: string, mode: 'save' | 'fail'): Promise<void> {
  const tally: Record<string, number> = {}
  let violations = 0
  const notes: string[] = []
  for (let i = 0; i < N; i++) {
    const { lessonId, jobA } = await freshGeneration(uid)
    const c = { lessonId, jobId: jobA, traceId: 'c2race' }
    const lateA = async () => {
      await jitter()
      if (mode === 'save') await withTransaction((tx) => saveGeneratedLesson(tx, uid, c, fields('A')))
      else await withTransaction((tx) => failGeneratedLesson(tx, uid, c, 'TIMEOUT'))
    }
    const [claim, a] = await Promise.allSettled([(async () => (await jitter(), claimRevive(uid, lessonId)))(), lateA()])
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { status: true, content: true, error: true } })
    const all = await prisma.aiJob.findMany({ where: { refId: lessonId, kind: 'LESSON_GEN' }, select: { id: true, status: true, error: true } })
    const A = all.find((j) => j.id === jobA)!
    const B = all.find((j) => j.id !== jobA) ?? null
    const aOutcome = a.status === 'fulfilled' ? 'A이김' : a.reason instanceof LessonGenerationSuperseded ? 'A버림' : `A오류:${(a.reason as Error)?.name}`
    const key = `${claim.status === 'fulfilled' ? claim.value.kind : 'claim오류'}/${aOutcome}`
    tally[key] = (tally[key] ?? 0) + 1
    let ok: boolean
    if (B) {
      ok = lesson.status === 'GENERATING' && lesson.content === null && lesson.error === null && A.status !== 'DONE' && B.status === 'RUNNING'
      if (ok) {
        // B 는 끝까지 저장할 수 있어야 한다(펜싱이 새 세대를 막지 않음).
        await withTransaction((tx) => saveGeneratedLesson(tx, uid, { lessonId, jobId: B.id, traceId: 'c2race' }, fields('B')))
        const after = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { status: true, content: true } })
        const bAfter = await prisma.aiJob.findUniqueOrThrow({ where: { id: B.id }, select: { status: true } })
        ok = after.status === 'READY' && (after.content as { title?: string } | null)?.title === 'B' && bAfter.status === 'DONE'
      }
    } else if (mode === 'save') ok = a.status === 'fulfilled' && lesson.status === 'READY' && (lesson.content as { title?: string } | null)?.title === 'A' && A.status === 'DONE'
    else ok = a.status === 'fulfilled' && lesson.status === 'FAILED' && lesson.error === 'TIMEOUT' && A.status === 'FAILED'
    if (!ok) {
      violations++
      if (notes.length < 3) notes.push(`${key} lesson=${lesson.status}/${lesson.error}/${JSON.stringify(lesson.content)?.slice(0, 20)} A=${A.status} B=${B?.status ?? '-'}`)
    }
  }
  check(`A-${mode} 되살리기 ∥ 옛 잡의 늦은 ${mode === 'save' ? '성공' : '실패'} ${N}회 — 새 세대 레슨을 덮지 않음(B 만 끝냄)`, violations === 0, `${JSON.stringify(tally)}${notes.length ? ` ✗ ${notes.join(' | ')}` : ''}`)
  const both = Object.keys(tally).some((k) => k.includes('revived')) && Object.keys(tally).some((k) => k.startsWith('reused') || (mode === 'fail' && k.includes('A이김')))
  console.log(`   (두 순서 모두 나왔나: ${both ? '예' : '아니오 — 반복을 늘리면 나온다'})`)
}

async function raceUtterance(uid: string): Promise<void> {
  const chat = await prisma.chat.create({ data: { userId: uid, kind: 'TALK', title: 'c2race' }, select: { id: true } })
  made.chats.push(chat.id)
  const lesson = await prisma.lesson.create({ data: { userId: uid, date: today, kind: 'NEW', title: 'c2race', level: 'N5', status: 'READY' }, select: { id: true } })
  made.lessons.push(lesson.id)
  const newUtterance = async () => {
    const u = await prisma.utterance.create({ data: { userId: uid, durationMs: 1000, realtimeEngine: 'race', realtimeText: 'はい', createdAt: new Date() }, select: { id: true } })
    made.utterances.push(u.id)
    return u.id
  }
  const newMessage = async () => (await prisma.chatMessage.create({ data: { chatId: chat.id, userId: uid, role: 'USER', content: 'はい' }, select: { id: true } })).id

  const tally: Record<string, number> = {}
  let violations = 0
  for (let i = 0; i < N; i++) {
    const uId = await newUtterance()
    const mId = await newMessage()
    const [toLesson, toChat] = await Promise.allSettled([
      (async () => (await jitter(), withTransaction((tx) => linkUtteranceToLesson(uid, uId, lesson.id, tx))))(),
      (async () => (await jitter(), linkUtteranceToMessage({ userId: uid, utterance: { id: uId, finalText: 'はい' }, messageId: mId, text: 'はい' })))(),
    ])
    const row = await prisma.utterance.findUniqueOrThrow({ where: { id: uId }, select: { lessonId: true, chatMessageId: true } })
    const lessonWon = toLesson.status === 'fulfilled'
    const chatWon = toChat.status === 'fulfilled' && toChat.value.linked
    const key = lessonWon && !chatWon ? '레슨' : chatWon && !lessonWon ? '채팅' : lessonWon && chatWon ? '둘다✗' : '둘다실패✗'
    tally[key] = (tally[key] ?? 0) + 1
    const exclusive = (row.lessonId === lesson.id) !== (row.chatMessageId === mId) && lessonWon === (row.lessonId === lesson.id) && chatWon === (row.chatMessageId === mId)
    if (!exclusive) violations++
  }
  check(`B-race 같은 발화: 레슨 연결 ∥ 채팅 턴 연결 ${N}회 — 정확히 한쪽만`, violations === 0, JSON.stringify(tally))

  // 순서대로: 레슨에 쓴 발화 → 채팅 턴 사전 검사 409·연결 안 됨 / 채팅에 쓴 발화 → 레슨 409
  const uL = await newUtterance()
  await withTransaction((tx) => linkUtteranceToLesson(uid, uL, lesson.id, tx))
  const pre = await checkUtteranceForTurn(uid, uL, chat.id).then(
    () => 'ok',
    (e: { details?: { reason?: string } }) => e.details?.reason ?? 'err',
  )
  const late = await linkUtteranceToMessage({ userId: uid, utterance: { id: uL, finalText: 'はい' }, messageId: await newMessage(), text: 'はい' })
  const rowL = await prisma.utterance.findUniqueOrThrow({ where: { id: uL }, select: { lessonId: true, chatMessageId: true } })
  check('B-seq 레슨에 쓴 발화 → 채팅 턴: 사전 검사 409 USED·조건부 연결도 0행(레슨 연결 유지)', pre === 'UTTERANCE_USED' && !late.linked && rowL.lessonId === lesson.id && rowL.chatMessageId === null, `${pre} linked=${late.linked}`)
  const uC = await newUtterance()
  const linkedC = await linkUtteranceToMessage({ userId: uid, utterance: { id: uC, finalText: 'はい' }, messageId: await newMessage(), text: 'はい' })
  const rev = await withTransaction((tx) => linkUtteranceToLesson(uid, uC, lesson.id, tx)).then(
    () => 'ok',
    (e: { details?: { reason?: string } }) => e.details?.reason ?? 'err',
  )
  const rowC = await prisma.utterance.findUniqueOrThrow({ where: { id: uC }, select: { lessonId: true } })
  check('B-seq 채팅에 쓴 발화 → 레슨 말하기: 409 USED(레슨 연결 없음)', linkedC.linked && rev === 'UTTERANCE_USED' && rowC.lessonId === null, `${rev}`)
}

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  await raceGeneration(user.id, 'save')
  await raceGeneration(user.id, 'fail')
  await raceUtterance(user.id)
}

main()
  .catch((e) => {
    console.error('예외:', e instanceof Error ? `${e.name}: ${e.message.split('\n')[0]}` : String(e))
    results.push({ name: 'EXCEPTION', ok: false, detail: '' })
  })
  .finally(async () => {
    try {
      await prisma.utterance.deleteMany({ where: { id: { in: made.utterances } } })
      await prisma.chatMessage.deleteMany({ where: { chatId: { in: made.chats } } })
      await prisma.chat.deleteMany({ where: { id: { in: made.chats } } })
      await prisma.aiJob.deleteMany({ where: { kind: 'LESSON_GEN', refId: { in: made.lessons } } })
      await prisma.lesson.deleteMany({ where: { id: { in: made.lessons } } })
      console.log(`(정리: 레슨 ${made.lessons.length}·대화방 ${made.chats.length}·발화 ${made.utterances.length} 와 딸린 잡·메시지 삭제)`)
    } catch (e) {
      console.error('정리 실패:', e instanceof Error ? e.message.split('\n')[0] : 'unknown')
    }
    await prisma.$disconnect()
    const failed = results.filter((r) => !r.ok)
    console.log(`결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — 실패 ${failed.map((f) => f.name.split(' ')[0]).join(', ')}` : ''}`)
    process.exit(failed.length ? 1 : 0)
  })
