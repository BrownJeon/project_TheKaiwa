/**
 * task-010d A1-서버 라이브 스모크 — **서비스 직접 호출**(HTTP 아님). #28 라우트는 가드(`validate.ts` 63·64행, Leader 결정 G1)가 막고 있어
 * 역할극 대화를 HTTP 로 만들 수 없다 — 그래서 실제 DB 에 대고 `createRolePlayChat`·`readRolePlayEndFacts`·`endScenarioRolePlay` 를 부른다. LLM 없음.
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test`(상황 역할극 레인) = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR). 두 계정 행은 먼저
 * `QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/x && rm /tmp/x`(2 도 같게)로 만들어 둔다 — 없으면 아무것도 쓰지 않고 끝난다.
 *
 * 흐름: 0 가드(parseCreateChat 400 FEATURE_NOT_READY) → 1 고정 행 심기(QA4 주제·조각·상황(+ScenarioTopic)·상황 수업 / QA2 상황·수업 — 시드 행은 만들지 않는다)
 *   → 2 대화 생성: scenarioId · lessonId 만(상황 상속) · 남의 상황 404 · 남의 수업 404 · 이어지지 않은 주제 400 · CHAT 400 → Chat.scenarioId·lessonId·topicId·
 *   코치 강제(resolveTalkCorrectionMode) → 3 학습자 말 2개·교정 1건 심기(턴 LLM 대신) → 4 종료 한 트랜잭션(재료 읽기 → 기록): 행 수 대조
 *   StudyLog(TALK·DIRECT) 1 · RepetitionItem(SCENARIO) 1 · LearningObservation(SCENARIO_COMPLETED) 1 · DAILY talkTurns+2·corrections.proposed+1·repetition.studied+1·
 *   observations.total+1 → 5 다시 종료 = replayed·행 변화 0 → 6 QA2 가 QA4 대화 종료 404 · 0턴 대화 409 → 7 기록 JSON 엔진명·학습자 원문 0.
 * 정리: 이 실행이 만든 행만 지운다(대화 cascade·StudyLog·RepetitionItem·관측·고정 행). QA4 오늘 DAILY 는 시작 전 값으로 되돌린다(없었으면 지운다).
 *
 * 실행(우분투 미러, DB0 push·prisma generate 뒤): `cd ~/.node-local/thekaiwa-010d-a && node --env-file=.env --import tsx tests/live/task010d-a1-smoke.ts`
 * (NFS 에서 고쳤으면 먼저 `KAIWA_LOCAL_ROOT=~/.node-local/thekaiwa-010d-a bash scripts/sync-local.sh`). 끝 줄 `RESULT pass=N fail=M`, 실패가 있으면 종료 코드 1.
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { ApiError, dates, withTransaction } from '@/modules/infra'
import { endScenarioRolePlay } from '@/modules/learning'
import { parseCreateChat } from '@/modules/conversation/chats/validate'
import { createRolePlayChat, readRolePlayEndFacts } from '@/modules/conversation/chats/rolePlay'
import { resolveTalkCorrectionMode } from '@/modules/conversation/corrections/talkDelivery'

const prisma = new PrismaClient()
const MARK = `smk010d-${Date.now().toString(36)}`
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|"model"/i
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
async function expectApi(id: string, code: string, p: Promise<unknown> | (() => unknown)): Promise<void> {
  try {
    await (typeof p === 'function' ? p() : p)
    check(id, false, `${code} 기대, 성공함`)
  } catch (e) {
    check(id, e instanceof ApiError && e.code === code, e instanceof ApiError ? `${e.code} ${JSON.stringify(e.details ?? {})}` : String(e))
  }
}
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

const made = { topicIds: [] as string[], scenarioIds: [] as string[], lessonIds: [] as string[], chatIds: [] as string[] }

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true, provider: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true, provider: true } })
  if (!qa4 || !qa2 || qa4.provider !== 'test' || qa2.provider !== 'test') throw new Error('QA4·QA2 계정이 없다 — qa-session.ts(QA_ACCOUNT=4·2)를 먼저 실행')
  const U = qa4.id
  const today = dates.todayKst()
  const dailyBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { id: true, data: true } })
  const since = new Date()

  try {
    // 0 가드(G1)
    await expectApi('0a #28 scenarioId 는 여전히 400 FEATURE_NOT_READY', 'FEATURE_NOT_READY', () => parseCreateChat({ kind: 'TALK', scenarioId: 'x' }))
    await expectApi('0b #28 lessonId 는 여전히 400 FEATURE_NOT_READY', 'FEATURE_NOT_READY', () => parseCreateChat({ kind: 'TALK', lessonId: 'x' }))

    // 1 고정 행
    const topic = await prisma.conversationTopic.create({ data: { userId: U, title: `${MARK} 카페`, level: 'N5', isSeed: false }, select: { id: true } })
    made.topicIds.push(topic.id)
    const loose = await prisma.conversationTopic.create({ data: { userId: U, title: `${MARK} 무관`, level: 'N5', isSeed: false }, select: { id: true } })
    made.topicIds.push(loose.id)
    const chunk = await prisma.topicChunk.create({ data: { topicId: topic.id, chunkType: 'NAME', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피' }, select: { id: true } })
    const scenarioData = {
      title: `${MARK} 사이즈 바꿔 주문하기`,
      titleJa: 'サイズを変えて注文する',
      level: 'N5' as const,
      difficulty: 2,
      roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoal_ko: '사이즈를 바꿔 주문해요', successCriteria: ['음료를 말한다', '사이즈를 말한다'] },
      keyExpressions: [{ chunkId: chunk.id }, { id: 'e2', ja: 'ホットで', ko: '따뜻한 걸로' }, { id: 'e3', ja: '大きいサイズ', reading: 'おおきいサイズ', ko: '큰 사이즈' }],
      completionRule: { requiredExpressions: 2, tutorJudgement: true },
      isSeed: false,
    }
    const sc = await prisma.scenario.create({ data: { ...scenarioData, userId: U, topics: { create: [{ topicId: topic.id, weight: 2 }] } }, select: { id: true } })
    made.scenarioIds.push(sc.id)
    const theirs = await prisma.scenario.create({ data: { ...scenarioData, userId: qa2.id }, select: { id: true } })
    made.scenarioIds.push(theirs.id)
    const lessonBase = { date: dates.toDbDate('2000-01-03'), kind: 'NEW' as const, title: `${MARK} 상황 수업`, level: 'N5' as const, status: 'FAILED' as const }
    const myLesson = await prisma.lesson.create({ data: { ...lessonBase, userId: U, topicId: topic.id, scenarioId: sc.id }, select: { id: true } })
    made.lessonIds.push(myLesson.id)
    const theirLesson = await prisma.lesson.create({ data: { ...lessonBase, userId: qa2.id, scenarioId: sc.id }, select: { id: true } })
    made.lessonIds.push(theirLesson.id)

    // 2 대화 생성
    const base = { kind: 'TALK' as const, title: null, level: null, topicId: null }
    const chat = await createRolePlayChat(U, { ...base, scenarioId: sc.id, lessonId: null })
    made.chatIds.push(chat.id)
    const row = await prisma.chat.findUnique({ where: { id: chat.id }, select: { userId: true, kind: true, scenarioId: true, lessonId: true, topicId: true, level: true, title: true } })
    check('2a 대화 행: TALK·scenarioId·주제(이어진 주제)·수준(상황)·제목(상황)', !!row && row.userId === U && row.kind === 'TALK' && row.scenarioId === sc.id && row.lessonId === null && row.topicId === topic.id && row.level === 'N5' && row.title === scenarioData.title, JSON.stringify(row))
    check('2b 코치 강제: 설정 유창성이어도 역할극 대화는 코치', resolveTalkCorrectionMode('FLUENCY', { scenarioId: row?.scenarioId }) === 'COACH')
    const viaLesson = await createRolePlayChat(U, { ...base, scenarioId: null, lessonId: myLesson.id })
    made.chatIds.push(viaLesson.id)
    check('2c lessonId 만: 수업의 상황·수업 주제를 이어받음', viaLesson.scenarioId === sc.id && viaLesson.lessonId === myLesson.id && viaLesson.topic?.id === topic.id)
    await expectApi('2d 남의 상황 404', 'NOT_FOUND', createRolePlayChat(U, { ...base, scenarioId: theirs.id, lessonId: null }))
    await expectApi('2e 남의 수업 404', 'NOT_FOUND', createRolePlayChat(U, { ...base, scenarioId: sc.id, lessonId: theirLesson.id }))
    await expectApi('2f 이어지지 않은 주제 400', 'VALIDATION', createRolePlayChat(U, { ...base, topicId: loose.id, scenarioId: sc.id, lessonId: null }))
    await expectApi('2g CHAT 은 400', 'VALIDATION', createRolePlayChat(U, { ...base, kind: 'CHAT', scenarioId: sc.id, lessonId: null }))
    check('2h 거부된 요청은 Chat 행을 만들지 않음', (await prisma.chat.count({ where: { userId: U, createdAt: { gte: since } } })) === 2)

    // 3 학습자 말·교정 심기(턴 LLM 대신)
    const t0 = Date.now()
    const m1 = await prisma.chatMessage.create({ data: { chatId: chat.id, userId: U, role: 'USER', content: 'コーヒーをください', inputSource: 'TEXT', status: 'DONE', createdAt: new Date(t0 - 60_000) }, select: { id: true } })
    await prisma.chatMessage.create({ data: { chatId: chat.id, userId: U, role: 'USER', content: '大きいサイズでお願いします', inputSource: 'TEXT', status: 'DONE', createdAt: new Date(t0 - 30_000) }, select: { id: true } })
    await prisma.correction.create({ data: { userId: U, chatId: chat.id, messageId: m1.id, original: 'コーヒーをください', corrected: 'コーヒーをお願いします', explanation: `${MARK} 더 공손하게`, errorType: 'POLITENESS', severity: 'MINOR' }, select: { id: true } })

    // 4 종료 한 트랜잭션
    const end = (userId: string, chatId: string, verdict?: unknown) =>
      withTransaction(async (tx) => {
        const facts = await readRolePlayEndFacts(userId, chatId, tx)
        return endScenarioRolePlay(userId, { ...facts, verdict }, tx)
      })
    const verdict = { goalAchieved: true, communicationSuccess: true, usedExpressionIds: ['e2', 'not-a-key'], missedExpressionIds: [] }
    const r = await end(U, chat.id, verdict)
    check('4a 결과: 달성(강사 + 코드 규칙)·쓴 표현 = 코드 확인 2 ∪ 강사 e2(목록 밖 id 버림)', r.outcome === 'ACHIEVED' && r.expressions.usedIds.length === 3 && r.expressions.verifiedIds.length === 2 && !r.replayed, JSON.stringify(r.expressions))
    const logs = await prisma.studyLog.findMany({ where: { userId: U, refId: chat.id }, select: { type: true, origin: true, result: true, summary: true } })
    const reps = await prisma.repetitionItem.findMany({ where: { userId: U, refType: 'Scenario', refId: sc.id }, select: { itemType: true, studiedCount: true, correctCount: true, wrongCount: true } })
    const obs = await prisma.learningObservation.findMany({ where: { userId: U, refType: 'Chat', refId: chat.id }, select: { kind: true, outcome: true, skill: true, scenarioId: true, confidence: true } })
    check('4b StudyLog(TALK, DIRECT) 1행', logs.length === 1 && logs[0].type === 'TALK' && logs[0].origin === 'DIRECT', JSON.stringify(logs.map((l) => [l.type, l.origin])))
    check('4c RepetitionItem(SCENARIO) 1행 · 공부 1 · 정답 1', reps.length === 1 && reps[0].itemType === 'SCENARIO' && reps[0].studiedCount === 1 && reps[0].correctCount === 1 && reps[0].wrongCount === 0)
    check('4d 관측 SCENARIO_COMPLETED 1행 · SUCCESS · 대화 축 · scenarioId', obs.length === 1 && obs[0].kind === 'SCENARIO_COMPLETED' && obs[0].outcome === 'SUCCESS' && obs[0].skill === 'CONVERSATION_MAINTAIN' && obs[0].scenarioId === sc.id && obs[0].confidence === 1)
    const daily = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { data: true } })
    const b = obj(dailyBefore?.data)
    const a = obj(daily?.data)
    const delta = {
      talkTurns: num(a.talkTurns) - num(b.talkTurns),
      proposed: num(obj(a.corrections).proposed) - num(obj(b.corrections).proposed),
      studied: num(obj(a.repetition).studied) - num(obj(b.repetition).studied),
      observations: num(obj(a.observations).total) - num(obj(b.observations).total),
    }
    check('4e DAILY: talkTurns+2 · corrections.proposed+1 · repetition.studied+1 · observations.total+1', delta.talkTurns === 2 && delta.proposed === 1 && delta.studied === 1 && delta.observations === 1, JSON.stringify(delta))
    const s = obj(obj(logs[0]?.result).scenario)
    check('4f result.scenario: scenarioId·goalAchieved·hintsUsed·쓴/못 쓴 표현 id', s.scenarioId === sc.id && s.goalAchieved === true && Array.isArray(s.usedExpressionIds) && Array.isArray(s.missedExpressionIds) && typeof s.hintsUsed === 'number')

    // 5 멱등
    const again = await end(U, chat.id, { goalAchieved: false })
    const counts = async () => [
      await prisma.studyLog.count({ where: { userId: U, refId: chat.id } }),
      await prisma.repetitionItem.count({ where: { userId: U, refType: 'Scenario', refId: sc.id } }),
      await prisma.learningObservation.count({ where: { userId: U, refType: 'Chat', refId: chat.id } }),
    ]
    const dailyAgain = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { data: true } })
    check('5a 두 번째 종료 = replayed · 같은 결과 · 행 변화 0 · DAILY 그대로', again.replayed && again.outcome === r.outcome && again.studyLogId === r.studyLogId && JSON.stringify(await counts()) === '[1,1,1]' && JSON.stringify(dailyAgain?.data) === JSON.stringify(daily?.data))

    // 6 거부
    await expectApi('6a QA2 가 QA4 대화 종료 404', 'NOT_FOUND', end(qa2.id, chat.id))
    await expectApi('6b 0턴 대화 종료 409', 'CONFLICT', end(U, viaLesson.id))
    check('6c 거부된 종료는 행을 만들지 않음', (await prisma.studyLog.count({ where: { userId: { in: [U, qa2.id] }, refId: viaLesson.id } })) === 0)

    // 7 누출
    const text = JSON.stringify(logs) + JSON.stringify(r)
    check('7a 기록·결과에 엔진명 0 · 학습자 원문 0', !LEAK.test(text) && !text.includes('コーヒーをください'))
  } finally {
    await cleanup(U, today, dailyBefore, since)
  }
}

async function cleanup(U: string, today: string, dailyBefore: { id: string; data: Prisma.JsonValue } | null, since: Date): Promise<void> {
  try {
    if (made.chatIds.length) {
      await prisma.learningObservation.deleteMany({ where: { userId: U, refType: 'Chat', refId: { in: made.chatIds } } })
      await prisma.studyLog.deleteMany({ where: { userId: U, refId: { in: made.chatIds } } })
    }
    if (made.scenarioIds.length) await prisma.repetitionItem.deleteMany({ where: { userId: U, refType: 'Scenario', refId: { in: made.scenarioIds }, createdAt: { gte: since } } })
    await prisma.chat.deleteMany({ where: { id: { in: made.chatIds } } })
    await prisma.lesson.deleteMany({ where: { id: { in: made.lessonIds } } })
    await prisma.scenario.deleteMany({ where: { id: { in: made.scenarioIds } } })
    await prisma.conversationTopic.deleteMany({ where: { id: { in: made.topicIds } } })
    if (dailyBefore) await prisma.statsSnapshot.update({ where: { id: dailyBefore.id }, data: { data: dailyBefore.data as Prisma.InputJsonValue } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U, kind: 'DAILY', periodKey: today } })
    console.log(`(정리: 대화 ${made.chatIds.length} · 상황 ${made.scenarioIds.length} · 수업 ${made.lessonIds.length} · 주제 ${made.topicIds.length} · DAILY ${dailyBefore ? '되돌림' : '삭제'})`)
  } catch (e) {
    console.log(`! 정리 실패 — 수동 확인 필요(MARK=${MARK}): ${String(e)}`)
  }
}

main()
  .catch((e) => check('run', false, String(e)))
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((x) => !x.ok).length
    console.log(`RESULT pass=${results.length - fail} fail=${fail}`)
    process.exitCode = fail ? 1 : 0
  })
