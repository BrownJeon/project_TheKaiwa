/**
 * qa-p2c-B 항목 A 보강 — 종료(#167)와 턴(#32)의 경합 변형 + 판정 실패(`verdict:null`) 경로.
 *  R1 턴 진행 중 종료 → 409 TURN_RUNNING·기록 0 / R4 `done` 직후(sleep 0) 종료 → 200(turns 에 그 턴 포함)
 *  R2 판정 중(잠금 밖)에 턴 도착 → 허용 결과 + 불변식 / R3 두 종료 동시 → 둘 다 200·기록 1·같은 endedAt·replayed [false,true]
 *  R6(BASE2 가 있을 때) 판정이 실패하는 서버(CLAUDE_CLI_PATH 없는 경로)로 종료 → 200 judged:false·기록 1·tutorGoalAchieved null·재종료 replayed·같은 endedAt
 * 사용: BASE=http://127.0.0.1:3034 BASE2=http://127.0.0.1:3035 SERVER_PID=<pid> node --env-file=.env --import tsx tests/live/p2c-qa/b-race.ts <QA4 쿠키>
 */
import { prisma } from '../../../src/modules/infra/db'
import { api, check, cookieOf, doneOf, num, obj, reason, sleep, startTurn, stats, summary, type Json } from './b-lib'

const C4 = cookieOf(process.argv[2])
const BASE2 = process.env.BASE2 ?? ''

async function rows(U: string, chatId: string, scenarioId: string) {
  const [log, rep, obs, users, ass] = await Promise.all([
    prisma.studyLog.count({ where: { userId: U, refId: chatId } }),
    prisma.repetitionItem.count({ where: { userId: U, refType: 'Scenario', refId: scenarioId, createdAt: { gte: SINCE } } }),
    prisma.learningObservation.count({ where: { userId: U, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: chatId } }),
    prisma.chatMessage.count({ where: { chatId, role: 'USER' } }),
    prisma.chatMessage.count({ where: { chatId, role: 'ASSISTANT' } }),
  ])
  return { log, rep, obs, users, ass }
}
const SINCE = new Date()
async function newRp(scenarioId: string): Promise<string> {
  const r = await api(C4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId })
  return String(r.data.id ?? '')
}
async function turnDone(chatId: string, text: string) {
  const r = await startTurn(C4, chatId, text).finished
  return r
}

async function main(): Promise<void> {
  const U = (await prisma.user.findFirstOrThrow({ where: { email: 'qa-bot4@thekaiwa.test', provider: 'test' }, select: { id: true } })).id
  console.log(`[b-race] since=${SINCE.toISOString()}`)

  // ── R1 + R4 ──
  const SA = 'scn_directions-station-exit'
  const A = await newRp(SA)
  const t1 = await turnDone(A, 'すみません、東口はどこですか。')
  check('R0 첫 턴 200 done', t1.status === 200 && !!doneOf(t1.events).traceId, `status=${t1.status} firstAudio=${Math.round(t1.firstAudioAt ?? -1)}ms`)
  const before1 = await rows(U, A, SA)
  const run2 = startTurn(C4, A, 'ここから遠いですか。')
  const head2 = await run2.head
  const f1 = await api(C4, 'POST', `/api/v1/chats/${A}/scenario/finish`)
  const after1 = await rows(U, A, SA)
  check('R1 턴 진행 중 종료 → 409 TURN_RUNNING · StudyLog·반복·관측 0', head2.sse && f1.status === 409 && reason(f1.data) === 'TURN_RUNNING' && after1.log === 0 && after1.rep === 0 && after1.obs === 0, `turn=${head2.status} finish=${f1.status}:${String(reason(f1.data))} rows=${JSON.stringify(after1)} (before ${JSON.stringify(before1)})`)
  // R4 — done 직후 곧바로
  const r2 = await run2.finished
  const tDone = Date.now()
  const f4 = await api(C4, 'POST', `/api/v1/chats/${A}/scenario/finish`)
  const learnerCount = await prisma.chatMessage.count({ where: { chatId: A, role: 'USER' } })
  const after4 = await rows(U, A, SA)
  check('R4 `done` 직후(지연 0) 종료 → 200 · turns = 학습자 말 수(마지막 턴 포함) · 기록 1·1·1', r2.status === 200 && f4.status === 200 && f4.data.turns === learnerCount && after4.log === 1 && after4.rep === 1 && after4.obs === 1, `turn=${r2.status} finish=${f4.status}${f4.status === 409 ? ':' + String(reason(f4.data)) : ''} turns=${String(f4.data.turns)}/${learnerCount} judged=${String(f4.data.judged)} outcome=${String(f4.data.outcome)} 종료까지 ${Math.round(Date.now() - tDone)}ms rows=${JSON.stringify(after4)}`)
  const f4b = await api(C4, 'POST', `/api/v1/chats/${A}/scenario/finish`)
  check('R4b 재종료 replayed:true · 같은 endedAt·studyLogId · 기록 변화 0', f4b.status === 200 && f4b.data.replayed === true && f4b.data.endedAt === f4.data.endedAt && f4b.data.studyLogId === f4.data.studyLogId && JSON.stringify(await rows(U, A, SA)) === JSON.stringify(after4), `endedAt ${String(f4.data.endedAt)} / ${String(f4b.data.endedAt)}`)

  // ── R2: 판정 중에 턴 도착 ──
  const SB = 'scn_weekend-plan-invite'
  const B = await newRp(SB)
  await turnDone(B, '今度の土曜日、映画を見に行きませんか。')
  const finP = api(C4, 'POST', `/api/v1/chats/${B}/scenario/finish`)
  await sleep(1500)
  const tr2 = startTurn(C4, B, '土曜日は大丈夫ですか。')
  const [fB, tB] = await Promise.all([finP, tr2.finished])
  await sleep(600)
  const rB = await rows(U, B, SB)
  const endedAtB = typeof fB.data.endedAt === 'string' ? new Date(fB.data.endedAt) : null
  const lateUsers = endedAtB ? await prisma.chatMessage.count({ where: { chatId: B, role: 'USER', createdAt: { gt: endedAtB } } }) : -1
  const label = `turn=${tB.status}${tB.status === 409 ? ':' + String(reason(tB.data)) : ''} finish=${fB.status}${fB.status === 409 ? ':' + String(reason(fB.data)) : ''} turns=${String(fB.data.turns)} users=${rB.users} rows=${JSON.stringify(rB)} lateUsers=${lateUsers}`
  const okB =
    rB.log <= 1 && rB.obs <= 1 && rB.rep <= 1 &&
    ((tB.status === 200 && fB.status === 409 && reason(fB.data) === 'TURN_RUNNING' && rB.log === 0) ||
      (tB.status === 200 && fB.status === 200 && fB.data.turns === rB.users && rB.log === 1 && lateUsers === 0) ||
      (tB.status === 409 && reason(tB.data) === 'ROLEPLAY_ENDED' && fB.status === 200 && fB.data.turns === rB.users && rB.log === 1))
  check('R2 판정 중(잠금 밖)에 턴 도착 → 허용 결과 + 불변식(기록 ≤1 · 끝난 뒤 학습자 말 0 · turns = DB)', okB, label)

  // ── R3: 두 종료 동시 ──
  const SC = 'scn_cafe-order-takeout'
  const Cc = await newRp(SC)
  await turnDone(Cc, '持ち帰りにしてください。')
  const [x, y] = await Promise.all([api(C4, 'POST', `/api/v1/chats/${Cc}/scenario/finish`), api(C4, 'POST', `/api/v1/chats/${Cc}/scenario/finish`)])
  await sleep(500)
  const rC = await rows(U, Cc, SC)
  const rep = [x.data.replayed, y.data.replayed].sort()
  check('R3 두 종료 동시 → 둘 다 200 · replayed [false,true] · 같은 endedAt·studyLogId · 기록 1·1·1', x.status === 200 && y.status === 200 && JSON.stringify(rep) === '[false,true]' && x.data.endedAt === y.data.endedAt && x.data.studyLogId === y.data.studyLogId && rC.log === 1 && rC.rep === 1 && rC.obs === 1, `${x.status}/${y.status} replayed=${JSON.stringify([x.data.replayed, y.data.replayed])} 같은 endedAt=${x.data.endedAt === y.data.endedAt} rows=${JSON.stringify(rC)} ms=${x.ms}/${y.ms}`)

  // ── R6: 판정 실패 서버로 종료(verdict:null) ──
  if (!BASE2) console.log('SKIP R6 — BASE2 없음')
  else {
    const SD = 'scn_self-intro-first-meeting'
    const D = await newRp(SD)
    await turnDone(D, 'はじめまして。キムです。')
    await turnDone(D, '会社員です。ソウルに住んでいます。')
    const fetchFinish = async (): Promise<{ status: number; data: Json; ms: number }> => {
      const t0 = performance.now()
      const r = await fetch(`${BASE2}/api/v1/chats/${D}/scenario/finish`, { method: 'POST', headers: { Cookie: C4, 'Content-Type': 'application/json' } })
      const text = await r.text()
      let data: Json = {}
      try { data = obj((JSON.parse(text) as { data?: unknown }).data) } catch { data = {} }
      return { status: r.status, data, ms: Math.round(performance.now() - t0) }
    }
    const v1 = await fetchFinish()
    const rD = await rows(U, D, SD)
    const sl = await prisma.studyLog.findFirst({ where: { userId: U, refId: D }, select: { result: true, origin: true } })
    const obsD = await prisma.learningObservation.findFirst({ where: { userId: U, kind: 'SCENARIO_COMPLETED', refId: D }, select: { confidence: true } })
    check('R6a 판정 실패 서버 종료 → 200 judged:false · tutorGoalAchieved null · 기록 1·1·1(코드 규칙만)', v1.status === 200 && v1.data.judged === false && v1.data.tutorGoalAchieved === null && rD.log === 1 && rD.rep === 1 && rD.obs === 1, `status=${v1.status} judged=${String(v1.data.judged)} outcome=${String(v1.data.outcome)} codeRulePassed=${String(v1.data.codeRulePassed)} goalAchieved=${String(v1.data.goalAchieved)} verified=${JSON.stringify(obj(v1.data.expressions).verifiedIds)} ${v1.ms}ms obsConfidence=${String(obsD?.confidence)}`)
    check('R6b 판정 없음이면 달성(ACHIEVED)으로 올리지 않는다', v1.data.outcome !== 'ACHIEVED', `outcome=${String(v1.data.outcome)}`)
    const v2 = await fetchFinish()
    check('R6c 재종료 replayed:true · 같은 endedAt · 행 변화 0', v2.status === 200 && v2.data.replayed === true && v2.data.endedAt === v1.data.endedAt && JSON.stringify(await rows(U, D, SD)) === JSON.stringify(rD), `${String(v1.data.endedAt)} / ${String(v2.data.endedAt)}`)
    check('R6d StudyLog 원문·엔진명 0', !/claude|haiku|sonnet|はじめまして。キムです|会社員です/.test(JSON.stringify(sl?.result ?? null)), `origin=${String(sl?.origin)}`)
    void num
  }
  check('R9 응답·SSE 에 엔진명 0', stats.leak === 0, `hits=${stats.leak}`)
}

main().catch((e) => check('run', false, String(e))).finally(async () => { await prisma.$disconnect(); summary() })
