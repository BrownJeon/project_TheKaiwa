/**
 * task-064 통합 보정 — ASK 방에서 다른 종류용 라우트 차단(api-contract §2-18-A 3-A항).
 * 표현 점검(#33)·일본어 도우미(#180)·대답 연습(#169)·상황 마치기(#167)·내 말 번역(#32t)을 `Chat.kind=ASK` 방에 부르면
 * **LLM 을 부르기 전에** 거절한다(AI 비용이 드는 호출을 화면에 메뉴가 없다는 이유만으로 열어 두지 않는다). DB·엔진 0 — 가짜 deps·가짜 tx.
 *
 * 거절 코드: 표현 점검·상황 마치기·내 말 번역 = `400 VALIDATION`, 일본어 도우미·대답 연습 = 기존 `404`(회화가 아니면 존재를 숨기는 기존 계약 — 3-A항
 * "이미 TALK/CHAT 이 아니면 거절하는 라우트는 그대로").
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, prisma, type Tx } from '@/modules/infra'
import type { LlmJsonResult } from '@/modules/engine'
import { reviewChat } from '../review'
import { finishRolePlay, type RolePlayFinishDeps } from '../chats/rolePlay'
import { helpPhrase, type PhraseHelpDeps } from '../chats/phraseHelp'
import { suggestReply, type ReplyPracticeDeps } from '../chats/replyPractice'
import { retryUserTranslation, translationDeps } from '../chats/translation'
import { assertNotAskRoom } from '../chats/validate'

const U = 'cuser000000000000000ask01'
const CHAT_AT = new Date('2026-10-12T01:00:00Z')

const apiErr = (code: string, check?: (e: ApiError) => boolean) => (e: unknown) => {
  assert.ok(e instanceof ApiError, `ApiError 여야 함: ${String(e)}`)
  assert.equal(e.code, code)
  if (check) assert.ok(check(e), JSON.stringify(e.details))
  return true
}
const isKind400 = (e: ApiError) => e.details?.field === 'chatId' && e.details?.reason === 'kind'

// ── 공용 가드 ────────────────────────────────────────────────────────────────────

test('assertNotAskRoom — ASK 만 400 {field:chatId, reason:kind}, TALK·CHAT(그리고 값 없음)은 통과', () => {
  assert.throws(() => assertNotAskRoom('ASK'), apiErr('VALIDATION', isKind400))
  for (const k of ['TALK', 'CHAT', null, undefined] as const) assert.doesNotThrow(() => assertNotAskRoom(k), String(k))
})

// ── #33 표현 점검 ────────────────────────────────────────────────────────────────

test('#33 표현 점검: ASK 방은 잠금(사용자 → 대화) 뒤 400 kind — 점검 잡·메시지 읽기 0 (CHAT 만 허용은 기존 그대로)', async (t) => {
  for (const kind of ['ASK', 'TALK']) {
    const calls: string[] = []
    const fakeTx = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings.join('?').includes('`User`')) {
          calls.push('lockUser')
          return [{ id: values[0] }]
        }
        calls.push('lockChat')
        return [{ id: 'chat_ask', userId: U, kind, level: 'N5', messageCount: 5, reviewedAt: null }]
      },
      chatMessage: { findMany: async () => (calls.push('msg.findMany'), []) },
      job: { findFirst: async () => (calls.push('job.findFirst'), null) },
    }
    // PrismaClient 의 $transaction 은 Proxy 뒤라 mock.method 가 못 찾는다 — 직접 바꿔 끼우고 되돌린다(DB 접속 0).
    const client = prisma as unknown as Record<string, unknown>
    const original = client.$transaction
    client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)
    t.after(() => {
      client.$transaction = original
    })
    await assert.rejects(reviewChat(U, 'chat_ask'), apiErr('VALIDATION', (e) => e.details?.reason === 'kind'), kind)
    assert.deepEqual(calls, ['lockUser', 'lockChat'], `${kind}: 점검 잡·메시지를 읽기 전에 거절`)
    client.$transaction = original
  }
})

// ── #167 상황 마치기 ─────────────────────────────────────────────────────────────

test('#167 상황 마치기: ASK 방은 400(역할극 아님) — 판정 LLM·기록 0', async () => {
  const calls: string[] = []
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('`User`')) return [{ id: values[0] }]
      calls.push('lockChat')
      // 상황 id 가 (잘못) 붙어 있어도 종류가 ASK 면 거절 — 종류 검사가 `scenarioId` 검사에 가려지지 않게 한다.
      return [{ id: 'chat_ask', userId: U, kind: 'ASK', scenarioId: 'scn_stray', lessonId: null, topicId: null, createdAt: CHAT_AT, endedAt: null }]
    },
  } as unknown as Tx
  const deps = { transaction: async (fn: (t: Tx) => Promise<unknown>) => fn(tx) } as unknown as RolePlayFinishDeps
  await assert.rejects(finishRolePlay(U, 'chat_ask', deps), apiErr('VALIDATION', (e) => e.details?.field === 'chatId' && e.details?.reason === 'not_scenario'))
  assert.deepEqual(calls, ['lockChat'])
})

// ── #180 일본어 도우미 · #169 대답 연습 ──────────────────────────────────────────

const boom = (name: string) => async () => {
  throw new Error(`${name} 호출되면 안 된다(ASK 방은 LLM 이전에 거절)`)
}

test('#180 일본어 도우미: ASK 방은 404(기존 계약 — 회화가 아니면 존재를 숨김) · LLM·재료 읽기 0', async () => {
  const seen: string[] = []
  const deps = {
    readChat: async (userId: string, chatId: string) => (seen.push('chat'), userId === U && chatId === 'chat_ask' ? { id: 'chat_ask', kind: 'ASK', level: null, scenarioId: 'scn_stray', createdAt: CHAT_AT, endedAt: null } : null),
    isEnded: boom('isEnded'),
    readMaterial: boom('readMaterial'),
    learnerLevel: boom('learnerLevel'),
    complete: boom('complete'),
    trace: boom('trace'),
  } as unknown as PhraseHelpDeps
  await assert.rejects(helpPhrase(U, 'chat_ask', { queryKo: '커피 주문하고 싶어요' } as never, deps), apiErr('NOT_FOUND'))
  assert.deepEqual(seen, ['chat'])
})

test('#169 대답 연습: ASK 방은 404(기존 계약) · 메시지·LLM 읽기 0', async () => {
  const seen: string[] = []
  const deps = {
    readChat: async () => (seen.push('chat'), { id: 'chat_ask', kind: 'ASK', level: null, scenarioId: 'scn_stray', createdAt: CHAT_AT, endedAt: null }),
    recentMessages: boom('recentMessages'),
    turnLocked: () => false,
    isEnded: boom('isEnded'),
    readMaterial: boom('readMaterial'),
    learnerTexts: boom('learnerTexts'),
    learnerLevel: boom('learnerLevel'),
    complete: boom('complete'),
    trace: boom('trace'),
  } as unknown as ReplyPracticeDeps
  await assert.rejects(suggestReply(U, 'chat_ask', 'msg_1', deps), apiErr('NOT_FOUND'))
  assert.deepEqual(seen, ['chat'])
})

// ── #32t 내 말 번역 ──────────────────────────────────────────────────────────────

const TEXT = '昨日、映画を見に行きました。'

function wireTranslation(t: import('node:test').TestContext, chat: { kind: string } | undefined) {
  const finds: { where: Record<string, unknown>; select: Record<string, unknown> }[] = []
  const seen = { complete: 0, saved: 0 }
  const store = {
    findFirst: async (a: { where: Record<string, unknown>; select: Record<string, unknown> }) => {
      finds.push(a)
      return { id: 'mu', role: 'USER', content: TEXT, translation: null, ...(chat ? { chat } : {}) }
    },
    updateMany: async () => ((seen.saved += 1), { count: 1 }),
  }
  t.mock.method(translationDeps, 'messages', () => store as never)
  t.mock.method(translationDeps, 'hasPendingTurn', async () => false)
  t.mock.method(translationDeps, 'learnerLevel', async () => 'N4')
  t.mock.method(translationDeps, 'complete', async () => {
    seen.complete += 1
    return { data: { userKo: '어제 영화를 보러 갔어요.' } } as LlmJsonResult<{ userKo: string }> as never
  })
  return { finds, seen }
}

test('#32t 내 말 번역: ASK 방의 내 질문은 400 kind — LLM·저장 0', async (t) => {
  const w = wireTranslation(t, { kind: 'ASK' })
  await assert.rejects(retryUserTranslation(U, 'chat_ask', 'mu'), apiErr('VALIDATION', isKind400))
  assert.equal(w.seen.complete, 0, 'LLM 호출 0')
  assert.equal(w.seen.saved, 0, '저장 0')
  assert.equal(w.finds.length, 1, '메시지 조회 1번만')
})

test('#32t 소유 조건은 그대로 (id, chatId, userId) · 종류는 같은 조회의 select 로만 읽는다(추가 쿼리 0)', async (t) => {
  const w = wireTranslation(t, { kind: 'ASK' })
  await assert.rejects(retryUserTranslation(U, 'chat_ask', 'mu'))
  assert.deepEqual(w.finds[0].where, { id: 'mu', chatId: 'chat_ask', userId: U })
  assert.deepEqual(w.finds[0].select.chat, { select: { kind: true } })
})

test('#32t 회귀: TALK·CHAT 방은 동작 불변 — 번역을 가져와 저장한다(LLM 1·저장 1)', async (t) => {
  for (const kind of ['TALK', 'CHAT']) {
    t.mock.restoreAll()
    const w = wireTranslation(t, { kind })
    assert.deepEqual(await retryUserTranslation(U, 'chat_x', 'mu'), { messageId: 'mu', translation: '어제 영화를 보러 갔어요.', cached: false }, kind)
    assert.deepEqual(w.seen, { complete: 1, saved: 1 }, kind)
  }
})

test('#32t 이미 번역이 있는 ASK 방 메시지도 400 — 종류 검사가 캐시 응답보다 앞선다', async (t) => {
  const store = { findFirst: async () => ({ id: 'mu', role: 'USER', content: TEXT, translation: '있는 번역', chat: { kind: 'ASK' } }), updateMany: async () => ({ count: 0 }) }
  t.mock.method(translationDeps, 'messages', () => store as never)
  await assert.rejects(retryUserTranslation(U, 'chat_ask', 'mu'), apiErr('VALIDATION', isKind400))
})
