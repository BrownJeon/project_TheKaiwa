/**
 * 내 말 번역 다시 가져오기(task-026 S2, api-contract #32t). 턴 응답의 `userKo` 가 정리에서 버려졌거나(null) `userKo` 도입 전 메시지라
 * USER `ChatMessage.translation` 이 비었을 때 화면의 [다시 가져오기] 가 부른다.
 *
 * - 소유: 메시지는 `(id, chatId, userId)` 로만 찾는다 — 남의 것·없는 것은 존재를 숨기고 404(§0-4).
 * - USER 메시지만(강사 말 번역은 턴이 이미 저장 — `400`). 이미 번역이 있으면 LLM 없이 그대로 돌려준다(`cached:true`).
 * - 그 방에 턴이 진행 중이면(DB PENDING 또는 이 프로세스의 그 방 턴 락) `409` — 진행 중 턴이 곧 `userKo` 를 저장하고, 같은 CLI 큐에서 두 번 일하지 않는다.
 * - 사용자당 동시 1건(프로세스 메모리, 넘으면 `409 {reason:"TRANSLATION_BUSY"}`) + 라우트 분당 상한.
 * - LLM 1회(`userTranslation@v1`, interactive·15s) → `sanitizeUserTranslation`(턴 번역과 같은 정리 규칙) → null 이면 저장하지 않고
 *   `ENGINE_ERROR`(재시도 가능). 실패 상태는 저장하지 않는다(번역 null = 화면이 다시 [다시 가져오기]).
 * - 저장은 `translation IS NULL` 조건부 — 그사이 다른 경로가 먼저 저장했으면 그 값을 돌려준다(덮어쓰지 않음).
 * - 원문·번역은 로그에 남기지 않는다.
 */
import { llm, type LlmJsonRequest, type LlmJsonResult } from '@/modules/engine'
import { ApiError, prisma } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import {
  buildUserTranslationRequest,
  sanitizeUserTranslation,
  USER_TRANSLATION_TEXT_MAX,
  UserTranslationInputError,
  type UserTranslationResponse,
} from '../prompts/userTranslation'
import { currentTurnLock } from '../orchestrator/locks'
import { runningChatIds } from './index'

export interface UserTranslationResult {
  messageId: string
  translation: string
  /** true = 이미 저장돼 있던 번역(LLM 호출 없음). */
  cached: boolean
}

interface MessageRow {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  translation: string | null
}

type SaveOutcome = { saved: true } | { existing: string } | { gone: true }

const ID_MAX = 40

type MessageStore = Pick<typeof prisma.chatMessage, 'findFirst' | 'updateMany'>

/** DB·LLM 경계 — 단위 테스트는 `mock.method(translationDeps, …)` 로 바꿔 끼운다(`messages` 만 바꾸면 아래 소유 조건까지 실제 코드로 검사). */
export const translationDeps = {
  messages: (): MessageStore => prisma.chatMessage,
  loadMessage: (userId: string, chatId: string, messageId: string): Promise<MessageRow | null> =>
    translationDeps.messages().findFirst({ where: { id: messageId, chatId, userId }, select: { id: true, role: true, content: true, translation: true } }),
  /**
   * 그 방에 턴이 도는가 — DB PENDING 강사 행, 또는 이 프로세스가 그 방 턴의 메모리 락을 잡고 수락 커밋을 기다리는 중(REV-092: 수락 커밋
   * 전에는 PENDING 행이 아직 없다). 같은 사용자의 다른 방 턴은 막지 않는다(계약은 "그 방").
   */
  isChatRunning: async (userId: string, chatId: string): Promise<boolean> =>
    currentTurnLock(userId)?.chatId === chatId || (await translationDeps.hasPendingTurn(chatId)),
  hasPendingTurn: async (chatId: string): Promise<boolean> => (await runningChatIds([chatId])).has(chatId),
  learnerLevel: async (userId: string): Promise<string> => (await getProfile(userId)).level,
  complete: (req: LlmJsonRequest<UserTranslationResponse>): Promise<LlmJsonResult<UserTranslationResponse>> => llm.completeJson(req),
  /** 비어 있을 때만 저장한다. 그사이 다른 경로가 먼저 저장했으면 그 값(`existing`), 행이 사라졌으면 `gone`. */
  saveIfEmpty: async (userId: string, chatId: string, messageId: string, translation: string): Promise<SaveOutcome> => {
    const res = await translationDeps.messages().updateMany({ where: { id: messageId, chatId, userId, role: 'USER', translation: null }, data: { translation } })
    if (res.count === 1) return { saved: true }
    const row = await translationDeps.messages().findFirst({ where: { id: messageId, chatId, userId }, select: { translation: true } })
    return row?.translation ? { existing: row.translation } : { gone: true }
  },
}

const inFlight = new Set<string>()

function notFoundMessage(): ApiError {
  return new ApiError('NOT_FOUND', '메시지를 찾을 수 없어요.')
}

export async function retryUserTranslation(userId: string, chatId: string, messageId: string): Promise<UserTranslationResult> {
  const validId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= ID_MAX
  if (!validId(chatId) || !validId(messageId)) throw notFoundMessage()
  const m = await translationDeps.loadMessage(userId, chatId, messageId)
  if (!m) throw notFoundMessage()
  if (m.role !== 'USER') throw new ApiError('VALIDATION', '내가 한 말만 번역을 다시 가져올 수 있어요.', { field: 'messageId', reason: 'not_user_message' })
  if (m.translation) return { messageId: m.id, translation: m.translation, cached: true }
  const text = m.content.trim()
  if (!text || [...text].length > USER_TRANSLATION_TEXT_MAX) {
    throw new ApiError('VALIDATION', '번역할 말이 없거나 너무 길어요.', { field: 'messageId', reason: 'text_length' })
  }
  if (await translationDeps.isChatRunning(userId, chatId)) throw new ApiError('CONFLICT', '선생님 답을 받는 중이에요. 끝난 뒤 다시 시도해 주세요.', { reason: 'TURN_RUNNING' })
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '번역을 가져오는 중이에요.', { reason: 'TRANSLATION_BUSY' })
  inFlight.add(userId)
  try {
    let req: LlmJsonRequest<UserTranslationResponse>
    try {
      req = buildUserTranslationRequest({ text, level: await translationDeps.learnerLevel(userId) })
    } catch (e) {
      if (e instanceof UserTranslationInputError) throw new ApiError('VALIDATION', e.userMessage, { field: 'messageId', reason: 'text_length' })
      throw e
    }
    const res = await translationDeps.complete(req)
    const translation = sanitizeUserTranslation(text, res.data)
    if (!translation) throw new ApiError('ENGINE_ERROR', '번역을 가져오지 못했어요. 다시 시도해 주세요.', { reason: 'TRANSLATION_REJECTED' })
    const out = await translationDeps.saveIfEmpty(userId, chatId, messageId, translation)
    if ('saved' in out) return { messageId, translation, cached: false }
    if ('existing' in out) return { messageId, translation: out.existing, cached: true }
    throw notFoundMessage()
  } finally {
    inFlight.delete(userId)
  }
}
