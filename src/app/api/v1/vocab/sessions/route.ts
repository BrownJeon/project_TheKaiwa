import { assembleTopicWords, buildTopicWordsRequest, TOPIC_WORDS_PROMPT_VERSION } from '@/modules/conversation'
import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createVocabSession, listVocabSessions, parseCreateSessionBody, parseSessionListQuery } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * A12 함수 묶음 — 요청·항목 검사는 L2(conversation)가 만들고 learning 은 값으로만 받는다(L3 → L2 import 금지, module-dependency §4-4).
 * 실행(엔진 호출·벽시계·취소)·DB 지식(제외 집합 전체)으로 한 번 더 거르는 일은 learning 이 한다.
 */
type TopicWordsDriver = NonNullable<NonNullable<Parameters<typeof createVocabSession>[2]>['topicWords']>

const topicWordsDriver: TopicWordsDriver = {
  promptVersion: TOPIC_WORDS_PROMPT_VERSION,
  build: (input) => buildTopicWordsRequest(input),
  assemble: (raw, ctx) => assembleTopicWords(raw, ctx),
}

/** #48 세트 목록 — `startedAt desc`, `kept`·`status` 필터, 항목별 `answeredCount`·주제 세트 `topic`. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  return ok(await listVocabSessions(s.user.id, parseSessionListQuery(q, parseLimit(q.get('limit'), 20, 100))))
})

/**
 * #47 세트 생성 — 정답 미포함(CHOICE). 장수 생략 시 `Profile.dailyWordCount`. 진행 중 세트가 있으면 409 `{sessionId}`.
 * `topicId` 면 주제 세트: 그날 그 주제 첫 세트는 A12 새 단어를 동기로 만든다(요청 시작부터 큐 대기 포함 30초 — `startedAt`),
 * 손님이 끊으면(`req.signal`) 생성을 멈추고 세트를 만들지 않는다. 생성 중 두 번째 요청은 409 `{reason:'GENERATING'}`.
 */
export const POST = withApi(async (req) => {
  const startedAt = Date.now()
  const s = await requireSession()
  const input = parseCreateSessionBody(await readJsonObject(req))
  const count = input.count ?? (await getProfile(s.user.id)).dailyWordCount
  return ok(
    await createVocabSession(
      s.user.id,
      { count, mode: input.mode, category: input.category, topicId: input.topicId, generate: input.generate },
      { topicWords: topicWordsDriver, signal: req.signal, startedAt },
    ),
  )
})
