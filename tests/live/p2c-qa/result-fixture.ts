/**
 * qa-p2c-A D(B3) — 끝낸 역할극 대화 고정 행(LLM 0): 결과 화면·회화 목록 뱃지를 **실제 서버·실제 DB 응답**으로 열어 읽기 전용을 DB 행 수로 대조한다.
 * A1 스모크와 같은 서비스 직접 호출(`createRolePlayChat` → 학습자 말·교정 심기 → `endScenarioRolePlay`(판정은 고정 값)). QA 계정 4 만.
 *   up   [out.json]  : 상황 1(내 것) + 끝낸 역할극 대화 1 + 일반 TALK 대화 1 → id 를 out.json 에 쓴다
 *   down [out.json]  : 그 id 의 행(대화 cascade·StudyLog·RepetitionItem·관측·상황)을 지우고 QA4 오늘 DAILY 를 시작 전 값으로
 * 실행: node --env-file=.env --import tsx tests/live/p2c-qa/result-fixture.ts up|down /tmp/.../res.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { dates, withTransaction } from '@/modules/infra'
import { endScenarioRolePlay } from '@/modules/learning'
import { createRolePlayChat, readRolePlayEndFacts } from '@/modules/conversation/chats/rolePlay'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION' || /\/apps\/thekaiwa(\/|$)/.test(process.cwd())) throw new Error('PRODUCTION 금지')
const [mode, out] = process.argv.slice(2)
if ((mode !== 'up' && mode !== 'down') || !out) throw new Error('사용: result-fixture.ts up|down <json>')
const prisma = new PrismaClient()
const MARK = `p2cA-res-${Date.now().toString(36)}`

async function main(): Promise<void> {
  const qa4 = await prisma.user.findFirst({ where: { email: 'qa-bot4@thekaiwa.test', provider: 'test' }, select: { id: true } })
  if (!qa4) throw new Error('QA4 없음')
  const U = qa4.id
  const today = dates.todayKst()
  if (mode === 'down') {
    const f = JSON.parse(readFileSync(out, 'utf8')) as { chatIds: string[]; scenarioIds: string[]; topicIds: string[]; dailyBefore: { id: string; data: unknown } | null }
    await prisma.studyLog.deleteMany({ where: { userId: U, refId: { in: f.chatIds } } })
    await prisma.learningObservation.deleteMany({ where: { userId: U, refId: { in: f.chatIds } } })
    await prisma.repetitionItem.deleteMany({ where: { userId: U, refType: 'Scenario', refId: { in: f.scenarioIds } } })
    for (const id of f.chatIds) await prisma.chat.deleteMany({ where: { id } })
    await prisma.scenario.deleteMany({ where: { id: { in: f.scenarioIds } } })
    await prisma.conversationTopic.deleteMany({ where: { id: { in: f.topicIds } } })
    if (f.dailyBefore) await prisma.statsSnapshot.update({ where: { id: f.dailyBefore.id }, data: { data: f.dailyBefore.data as never } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U, kind: 'DAILY', periodKey: today } })
    console.log('down: 정리 완료')
    return
  }
  const dailyBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { id: true, data: true } })
  const topic = await prisma.conversationTopic.create({ data: { userId: U, title: `${MARK} 카페`, level: 'N5', isSeed: false }, select: { id: true } })
  const sc = await prisma.scenario.create({
    data: {
      title: `${MARK} 사이즈 바꿔 주문하기`, titleJa: 'サイズを変えて注文する', level: 'N5', difficulty: 2, userId: U, isSeed: false,
      roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoal_ko: '사이즈를 바꿔 주문해요', successCriteria: ['음료를 말한다', '사이즈를 말한다'] },
      keyExpressions: [{ id: 'e1', ja: 'コーヒーをください', ko: '커피 주세요' }, { id: 'e2', ja: 'ホットで', ko: '따뜻한 걸로' }, { id: 'e3', ja: '大きいサイズ', reading: 'おおきいサイズ', ko: '큰 사이즈' }],
      completionRule: { requiredExpressions: 2, tutorJudgement: true },
      constraints: { steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' } },
      topics: { create: [{ topicId: topic.id, weight: 2 }] },
    },
    select: { id: true },
  })
  const base = { kind: 'TALK' as const, title: null, level: null, topicId: null }
  const chat = await createRolePlayChat(U, { ...base, scenarioId: sc.id, lessonId: null })
  const plain = await prisma.chat.create({ data: { userId: U, kind: 'TALK', title: `${MARK} 일반 회화`, level: 'N5' } as never, select: { id: true } })
  const t0 = Date.now()
  const m1 = await prisma.chatMessage.create({ data: { chatId: chat.id, userId: U, role: 'USER', content: 'コーヒーをください', inputSource: 'TEXT', status: 'DONE', createdAt: new Date(t0 - 60_000) }, select: { id: true } })
  await prisma.chatMessage.create({ data: { chatId: chat.id, userId: U, role: 'USER', content: '大きいサイズでお願いします', inputSource: 'TEXT', status: 'DONE', createdAt: new Date(t0 - 30_000) } })
  await prisma.correction.create({ data: { userId: U, chatId: chat.id, messageId: m1.id, original: 'コーヒーをください', corrected: 'コーヒーをお願いします', explanation: `${MARK} 더 공손하게`, errorType: 'POLITENESS', severity: 'MINOR' } })
  const verdict = { goalAchieved: true, communicationSuccess: true, usedExpressionIds: ['e2'], missedExpressionIds: [] }
  const r = await withTransaction(async (tx) => {
    const facts = await readRolePlayEndFacts(U, chat.id, tx)
    return endScenarioRolePlay(U, { ...facts, verdict }, tx)
  })
  writeFileSync(out, JSON.stringify({ chatIds: [chat.id, plain.id], endedChat: chat.id, plainChat: plain.id, scenarioIds: [sc.id], topicIds: [topic.id], dailyBefore }))
  console.log(`up: ended roleplay chat=${chat.id} outcome=${r.outcome} plain=${plain.id} scenario=${sc.id}`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
