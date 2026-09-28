import { ok, rateLimit, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { assertAnswerTakesUtterance, lockEvaluationItemForAnswer, parseAnswerBody, saveEvaluationAnswer } from '@/modules/learning'
import { linkUtteranceToEvaluationItem } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/**
 * #67 문항 답 저장 — `{answerText?, inputSource?, utteranceId?, pieceOrder?}`.
 *   보기 문항(뜻·용법) = 보기 글자 그대로 · 읽기 = 입력 · 조각 분류 = NAME|ACTION|FEELING|MODIFIER · 조립 = `pieceOrder`(조각 번호 순열) ·
 *   서술형 = 글자(TEXT) 또는 `utteranceId`(음성 — 발화 최종 텍스트로 채점, 본문 answerText 는 쓰지 않음).
 * **한 트랜잭션**: 평가 잠금(사용자 → 평가, READY·IN_PROGRESS 만 — 그 밖 409) → 문항 확인(없으면 404) → `utteranceId` 가 오면 speech 가
 * 소유(404)·미사용(409 UTTERANCE_USED|OTHER_CHAT|OTHER_LESSON)·10분(409 UTTERANCE_EXPIRED)을 확인하고 `Utterance.evaluationItemId` 연결 →
 * 답 저장(객관식은 코드가 즉시 채점해 저장, 재답은 덮어쓰기) → 첫 답이면 READY → IN_PROGRESS·`startedAt`(10분 시작).
 * 응답 `{id, answered, graded, expectedShown:false, answerText, answerOrder, inputSource, answeredAt, evaluationStatus, startedAt, deadlineAt,
 * utteranceId, hasAudio}` — **점수·정답 없음**(제출 뒤 #66). 사용자당 분당 60.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id, itemId } = await ctx.params
  rateLimit(`eval-answer:${userId}`, 60)
  const body = parseAnswerBody(await readJsonObject(req, 16 * 1024))
  return ok(
    await withTransaction(async (tx) => {
      const h = await lockEvaluationItemForAnswer(tx, userId, id, itemId)
      let link: { id: string; text: string; hasAudio: boolean } | null = null
      if (body.utteranceId) {
        assertAnswerTakesUtterance(h)
        link = await linkUtteranceToEvaluationItem(userId, body.utteranceId, h.item.id, tx)
      }
      const r = await saveEvaluationAnswer(tx, h, body, link ? link.text : null)
      return { ...r, utteranceId: link?.id ?? null, hasAudio: link?.hasAudio ?? false }
    }),
  )
})
