/**
 * qa-p2c-A E — 012b-2 확인용 고정 행(QA 계정 1·2 만, 제목·엔진 칸에 표식 `p2cA-fixture`). LLM·STT 호출 0, DB 직접.
 *   up   : QA1 대화방 1(USER 메시지 2·ASSISTANT 1) · QA1 발화 26(확인 대기 1·확정 1·방 없음 1·나머지 23 — 페이지 넘김용) · QA1 완료 평가 1(문항 4: 음성 2·글 1·무응답 1)
 *          QA2 대화방 1 · QA2 발화 2(확인 대기 1 · 확인 불가 1) · QA2 완료 평가 1
 *   down : 표식 행만 삭제(발화·메시지·대화·평가(items cascade))
 * 사용: node --env-file=.env --import tsx tests/live/p2c-qa/utt-fixtures.ts up|down  — 결과 id 는 stdout JSON 한 줄(FIXTURES {...}).
 */
import { prisma } from '../../../src/modules/infra/db'
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const mode = process.argv[2]
if (mode !== 'up' && mode !== 'down') throw new Error('up|down')
const TAG = 'p2cA-fixture'
const H = 3_600_000

async function main(): Promise<void> {
  const u1 = await prisma.user.findFirst({ where: { email: 'qa-bot@thekaiwa.test', provider: 'test' }, select: { id: true } })
  const u2 = await prisma.user.findFirst({ where: { email: 'qa-bot2@thekaiwa.test', provider: 'test' }, select: { id: true } })
  if (!u1 || !u2) throw new Error('QA 1·2 계정 없음')
  if (mode === 'down') {
    const u = await prisma.utterance.deleteMany({ where: { realtimeEngine: TAG } })
    const c = await prisma.chat.deleteMany({ where: { title: { startsWith: TAG } } })
    const e = await prisma.evaluation.deleteMany({ where: { comment: { startsWith: TAG } } })
    console.log(`down: 발화 ${u.count} · 대화 ${c.count}(메시지 cascade) · 평가 ${e.count}`)
    return
  }
  const mkChat = async (userId: string, n: number) => {
    const chat = await prisma.chat.create({ data: { userId, kind: 'TALK', title: `${TAG} ${n}`, level: 'N5' } as never, select: { id: true } })
    const m1 = await prisma.chatMessage.create({ data: { chatId: chat.id, userId, role: 'USER', content: '駅はどこですか', inputSource: 'REALTIME_STT', status: 'DONE' }, select: { id: true } })
    await prisma.chatMessage.create({ data: { chatId: chat.id, userId, role: 'ASSISTANT', content: 'まっすぐ行ってください。', status: 'DONE' } })
    const m2 = await prisma.chatMessage.create({ data: { chatId: chat.id, userId, role: 'USER', content: 'ありがとうございます', inputSource: 'REALTIME_STT', status: 'DONE' }, select: { id: true } })
    return { chatId: chat.id, m1: m1.id, m2: m2.id }
  }
  const base = { realtimeEngine: TAG, durationMs: 2400, sampleRate: 16000 }
  const a = await mkChat(u1.id, 1)
  const b = await mkChat(u2.id, 2)
  const out: Record<string, unknown> = { qa1Chat: a.chatId, qa2Chat: b.chatId }
  const w = await prisma.utterance.create({ data: { ...base, userId: u1.id, chatId: a.chatId, chatMessageId: a.m1, realtimeText: '駅はどこですか', analysisText: '低級はどこですか', transcriptConfidence: 0.6, requiresReview: true, status: 'ANALYZED', finalSource: 'REALTIME', createdAt: new Date(Date.now() - 1 * H) }, select: { id: true } })
  const d = await prisma.utterance.create({ data: { ...base, userId: u1.id, chatId: a.chatId, chatMessageId: a.m2, realtimeText: 'ありがとうございます', analysisText: 'ありがとうございます', transcriptConfidence: 0.99, requiresReview: false, finalText: 'ありがとうございます', status: 'ANALYZED', finalSource: 'ANALYSIS', createdAt: new Date(Date.now() - 1.5 * H) }, select: { id: true } })
  const nochat = await prisma.utterance.create({ data: { ...base, userId: u1.id, realtimeText: '方に向けて話しました', status: 'RECORDED', createdAt: new Date(Date.now() - 2 * H) }, select: { id: true } })
  out.qa1Waiting = w.id; out.qa1Done = d.id; out.qa1NoChat = nochat.id
  for (let i = 0; i < 23; i++) await prisma.utterance.create({ data: { ...base, userId: u1.id, realtimeText: `テスト発話${i}`, status: 'RECORDED', createdAt: new Date(Date.now() - (3 + i) * H) } })
  const bw = await prisma.utterance.create({ data: { ...base, userId: u2.id, chatId: b.chatId, chatMessageId: b.m1, realtimeText: '二番アカウントの確認待ち', analysisText: '別の聞き取り', transcriptConfidence: 0.5, requiresReview: true, status: 'ANALYZED', finalSource: 'REALTIME' }, select: { id: true } })
  const bn = await prisma.utterance.create({ data: { ...base, userId: u2.id, realtimeText: '二番アカウントの確認不可', status: 'RECORDED', createdAt: new Date(Date.now() - 1 * H) }, select: { id: true } })
  out.qa2Waiting = bw.id; out.qa2NotReviewable = bn.id
  const mkEval = async (userId: string, items: { inputSource: 'REALTIME_STT' | 'SERVER_STT' | 'TEXT' | null; answerText: string | null }[]) => {
    const ev = await prisma.evaluation.create({
      data: {
        userId, kind: 'TALK', level: 'N5', status: 'DONE', totalScore: 70, comment: `${TAG} 고정 평가`, completedAt: new Date(), submittedAt: new Date(),
        items: { create: items.map((it, i) => ({ order: i, kind: 'SITUATION_RESPOND' as const, prompt: { instructionKo: '상황에 맞게 답해 보세요.', situationKo: '카페에서 주문해요' }, maxScore: 10, score: 7, feedback: '좋아요', answerText: it.answerText, inputSource: it.inputSource, answeredAt: it.answerText ? new Date() : null })) },
      },
      select: { id: true },
    })
    return ev.id
  }
  out.qa1Eval = await mkEval(u1.id, [{ inputSource: 'REALTIME_STT', answerText: 'ホットでお願いします' }, { inputSource: 'SERVER_STT', answerText: 'Lサイズでお願いします' }, { inputSource: 'TEXT', answerText: 'おねがいします' }, { inputSource: null, answerText: null }])
  out.qa2Eval = await mkEval(u2.id, [{ inputSource: 'REALTIME_STT', answerText: 'テスト' }])
  console.log(`FIXTURES ${JSON.stringify(out)}`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
