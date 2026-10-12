import { rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { admitAskTurn, getOwnedChatKind, startTurn, type TurnHooks, type TurnRequest } from '@/modules/conversation'
import { recordObservations } from '@/modules/learning'
import { checkUtteranceForTurn, createTurnSpeaker, linkUtteranceToMessage, type TurnUtterance } from '@/modules/speech'
import { correctionProposedHook } from '../../../_lib/review'
import { handleTurnRequest, type TurnRouteDeps } from '../../_lib/turnRoute'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #32 턴(SSE). 수락 전 실패(401·404·400·409·429)는 봉투 JSON, 수락 뒤에는 `accepted → status… → audio…(TALK) → done|error` 스트림.
 * 스트림이 끊겨도 턴은 서버에서 끝까지 처리·저장된다(`startTurn` 이 연결과 무관한 promise 로 돈다 — §0-9).
 * 본문 검사·종류별 검사·ASK 한도(task-064)는 `_lib/turnRoute.ts` — 이 파일은 훅 조합만 한다.
 *
 * conversation 과 speech 는 서로 import 하지 않는다 — 이 라우트가 훅으로 잇는다(module-dependency §4-1):
 *  - `utteranceId`: 수락 전 speech 가 소유자·미연결·같은 방(발화에 방이 기록돼 있으면, task-018)·10분을 검사(404·409), 수락 직후 조건부 연결
 *    + 고친 글자면 finalText=text(USER).
 *  - TALK 문장 음성: speech 의 턴 합성기(서명 URL·캐시·8초)를 conversation 의 speaker 자리에 넣는다.
 *  - 코치 자기수정(task-010c): conversation 이 판정하고 저장 트랜잭션 안에서 이 훅을 부르면, 관측(learning 소유)을 같은 tx 에 쓴다.
 *    정답을 열지 않고 고침 = SUCCESS, 연 뒤 고침 = PARTIAL. 신뢰도는 1.0(실시간 인식 신뢰도는 턴 경로에 없다 — 입력 경로만 meta 에).
 * 위 훅은 TALK·CHAT 에만 — ASK 는 음성·발화·교정 관측이 없다.
 */
function talkChatHooks(userId: string, chatId: string, request: TurnRequest): TurnHooks {
  const hooks: TurnHooks = {
    speaker: (a) => createTurnSpeaker({ userId, messageId: a.assistantMessageId }),
    // task-010b L3 — 이번 턴이 만든 교정(PROPOSED) 관측을 저장 트랜잭션에(learning 소유). 신뢰도 1.0, 입력 경로는 meta.
    recordCorrectionProposed: correctionProposedHook(userId),
    recordSelfCorrection: async (tx, r) => {
      await recordObservations(
        userId,
        [
          {
            kind: 'SELF_CORRECTION',
            outcome: r.result === 'SELF' ? 'SUCCESS' : 'PARTIAL',
            refType: 'Correction',
            refId: r.correctionId,
            confidence: 1,
            meta: { revealed: r.revealed, input: r.inputSource === 'TEXT' ? 'TEXT' : r.inputSource ? 'VOICE' : null },
          },
        ],
        tx,
      )
    },
  }
  if (!request.resume && request.utteranceId) {
    const utteranceId = request.utteranceId
    const text = request.text
    let utterance: TurnUtterance | null = null
    hooks.gate = async () => {
      utterance = await checkUtteranceForTurn(userId, utteranceId, chatId)
    }
    hooks.onAccepted = async (a) => {
      if (!utterance) return null
      const t = Date.now()
      const r = await linkUtteranceToMessage({ userId, utterance, messageId: a.userMessageId, text })
      return { name: 'UTTERANCE_LINK', ms: Date.now() - t, linked: r.linked, finalSourceUser: r.finalSourceUser, ...(r.warning ? { warning: r.warning } : {}) }
    }
  }
  return hooks
}

const deps: TurnRouteDeps = {
  chatKind: (userId, chatId) => getOwnedChatKind(userId, chatId),
  startTurn: (input) => startTurn(input),
  admitAsk: (userId) => admitAskTurn(userId),
  talkChatHooks,
}

export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`turn:${userId}`, 12)
  return handleTurnRequest(userId, id, await readJsonObject(req, 16 * 1024), deps)
})
