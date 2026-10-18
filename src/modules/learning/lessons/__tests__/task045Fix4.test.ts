/**
 * task-045 fix4 — #59 주제 수업이 가려진·없는 주제를 거절할 때 404 `details.reason='TOPIC_GONE'` 을 낸다(#156·#47·#65 와 같은 오류 계약).
 * 가짜 deps 만 쓴다(실제 DB 없음). 진행 중 챌린지 주제의 가린 시드 예외(§0 #9)는 그대로여야 한다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@/modules/infra'
import { loadTopicLessonMaterials, type TopicLessonDeps } from '../generate'

const USER = 'userA'
const TOPIC = { id: 'topCafe', title: '카페', titleJa: null, level: 'N5' as const, chunks: [] }
const input = { kind: 'topic' as const, topicId: 'topCafe' }

function deps(over: Partial<TopicLessonDeps> = {}): TopicLessonDeps & { historyCalls: number } {
  const state = { historyCalls: 0 }
  const d: TopicLessonDeps = {
    topic: async (_u, id) => (id === TOPIC.id ? TOPIC : null),
    visible: async () => true,
    challengeTopicId: async () => null,
    // task-076: 기준 수준을 확정하지 못함 = 주제 수준(이 시험의 관심 밖).
    targetLevel: async () => null,
    history: async () => {
      state.historyCalls += 1
      return { previousTitles: [], previousNextPreview: null }
    },
    ...over,
  }
  // Object.assign 은 getter 를 값으로 복사해 버리므로(항상 0) defineProperty 로 살아 있는 getter 를 단다.
  return Object.defineProperty(d, 'historyCalls', { get: () => state.historyCalls }) as TopicLessonDeps & { historyCalls: number }
}

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, '오류는 ApiError')
    return e
  }
  assert.fail('거절돼야 한다')
}

const shape = (e: ApiError) => ({ code: e.code, userMessage: e.userMessage, details: e.details })

test('#59 주제 수업 — 가려진 시드·없는 주제는 같은 404 TOPIC_GONE(사유·문구 동일, 재료는 읽지 않는다)', async () => {
  const hidden = deps({ visible: async () => false })
  const missing = deps({ topic: async () => null })
  const otherChallenge = deps({ visible: async () => false, challengeTopicId: async () => 'topOther' })

  const eHidden = await rejection(loadTopicLessonMaterials(USER, input, hidden))
  const eMissing = await rejection(loadTopicLessonMaterials(USER, { kind: 'topic', topicId: 'topGone' }, missing))
  const eOther = await rejection(loadTopicLessonMaterials(USER, input, otherChallenge))

  assert.deepEqual(shape(eHidden), { code: 'NOT_FOUND', userMessage: '주제를 찾을 수 없어요.', details: { reason: 'TOPIC_GONE' } })
  assert.deepEqual(shape(eMissing), shape(eHidden), '없는 주제와 가려진 주제를 구분하지 않는다(존재 여부를 알리지 않는다)')
  assert.deepEqual(shape(eOther), shape(eHidden), '다른 주제의 챌린지가 있어도 가려진 주제는 같은 404')
  assert.equal(hidden.historyCalls + missing.historyCalls + otherChallenge.historyCalls, 0, '거절은 이전 수업 기록 읽기 전에')
})

test('#59 주제 수업 — 진행 중 챌린지의 수업 주제면 가린 시드여도 허용(§0 #9), 보이는 주제는 챌린지를 묻지 않는다', async () => {
  const asked: string[] = []
  const hiddenButChallenge = deps({ visible: async () => false, challengeTopicId: async (u) => (asked.push(u), 'topCafe') })
  const m = await loadTopicLessonMaterials(USER, input, hiddenButChallenge)
  assert.equal(m.topic?.id, 'topCafe')
  assert.equal(hiddenButChallenge.historyCalls, 1)

  asked.length = 0
  const visible = deps({ challengeTopicId: async (u) => (asked.push(u), null) })
  assert.equal((await loadTopicLessonMaterials(USER, input, visible)).topic?.id, 'topCafe')
  assert.deepEqual(asked, [])
})
