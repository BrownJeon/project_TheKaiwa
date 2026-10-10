/**
 * task-049 REV-177 M-1 — 예문이 L2(conversation) → 라우트 → L3(learning) 로 건너가는 이음매를 라우트 파일 그대로 시험한다.
 * (DB·엔진·LLM 0. `task045T4Routes.test.ts` 와 같은 방법: require 캐시를 "진짜 + 세션·세트 생성 가짜"로 바꾼 뒤 route.ts 를 처음 읽는다.)
 *
 * 왜 app 층인가: learning 시험은 6층 lint 로 conversation 을 import 할 수 없고, app 시험은 learning 내부(`recheckTopicWords` 등)를 못 본다.
 * 그래서 이음매를 두 쪽으로 나눠 **같은 후보 키 집합**에서 만나게 한다 —
 *  ① 여기: route.ts 가 learning 에 넘기는 driver 의 `assemble` 은 진짜 `assembleTopicWords` 이고, 그 출력의 키가 learning 의 `TopicWordCandidate` 키와 정확히 같다
 *     (타입 쪽은 `Record<keyof Candidate, true>` 로 전수 대조 — learning 이 칸을 더하거나 conversation 이 이름을 바꾸면 tsc·이 시험이 깨진다).
 *  ② `src/modules/learning/__tests__/task042.test.ts`: 그 키로 만든 후보가 서버 재검사 → 카드 → 저장 행·응답까지 간다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { createVocabSession } from '@/modules/learning'

type Handler = (req: unknown, ctx: unknown) => Promise<Response>
type CreateOpts = NonNullable<Parameters<typeof createVocabSession>[2]>
type Driver = NonNullable<CreateOpts['topicWords']>
type Candidate = ReturnType<Driver['assemble']>['words'][number]

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), learning: req.resolve('@/modules/learning') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const learning = req(paths.learning) as typeof import('@/modules/learning')
const conversation = req(req.resolve('@/modules/conversation')) as typeof import('@/modules/conversation')

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const seen: { opts: CreateOpts | null } = { opts: null }
/** 대입 직후 좁혀진 `null` 이 호출 뒤에도 남지 않게 함수로 읽는다. */
const peek = (): CreateOpts | null => seen.opts
swap(paths.infra, { ...infra, requireSession: async () => ({ user: { id: 'cuser_t049_seam_00000000', email: 'qa@example.test', name: null, role: 'USER' } }) })
swap(paths.learning, {
  ...learning,
  createVocabSession: async (_userId: string, _input: unknown, opts: CreateOpts = {}) => {
    seen.opts = opts
    return { session: null, emptyReason: 'NO_WORDS' }
  },
})
const route = req(join(__dirname, '..', 'vocab', 'sessions', 'route.ts')) as { POST: Handler }

/** learning `TopicWordCandidate` 의 키 전부(전수 — 칸이 늘거나 빠지면 `satisfies` 가 컴파일에서 막는다). */
const CANDIDATE_KEYS = Object.keys({ textJa: true, reading: true, meaningKo: true, chunkType: true, jlpt: true, exampleJa: true, exampleKo: true } satisfies Record<keyof Candidate, true>).sort()

async function driverFromRoute(): Promise<Driver> {
  seen.opts = null
  const res = await route.POST(
    new Request('http://localhost/api/v1/vocab/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topicId: 'topic-cafe', mode: 'FLIP', count: 10 }) }),
    {},
  )
  assert.equal(res.status, 200)
  const driver = peek()?.topicWords
  assert.ok(driver, 'route.ts 가 주제 세트용 A12 driver 를 createVocabSession 에 넘긴다')
  return driver
}

const word = (textJa: string, reading: string, meaningKo: string, extra: Record<string, unknown> = {}) => ({ textJa, reading, meaningKo, chunkType: 'NAME', jlpt: 'N5', valid: true, ...extra })

test('이음매: route.ts 의 driver.assemble 은 진짜 L2 조립 — 예문이 learning 후보 키(exampleJa·exampleKo)로 그대로 나오고, 불량·쌍 아님·v1 모양은 null 이면서 단어는 유지', async () => {
  const driver = await driverFromRoute()
  assert.equal(driver.promptVersion, conversation.TOPIC_WORDS_PROMPT_VERSION)
  assert.equal(driver.build({ topic: { title: '카페 주문', titleJa: 'カフェで注文', description: null, level: 'N5' }, targetCount: 10, exclude: [], variant: 0 }).task, conversation.TOPIC_WORDS_TASK)

  const raw = {
    words: [
      word('砂糖', 'さとう', '설탕', { exampleJa: '砂糖をお願いします。', exampleKo: '설탕 부탁해요.' }),
      word('牛乳', 'ぎゅうにゅう', '우유', { exampleJa: 'Lサイズをお願いします。', exampleKo: '큰 사이즈 부탁해요.' }), // 로마자 → L2 예문 검사 불량
      word('氷', 'こおり', '얼음', { exampleJa: '氷をお願いします。', exampleKo: null }), // 쌍 아님
      word('持ち帰り', 'もちかえり', '포장'), // v1 모양(예문 키 없음)
    ],
  }
  const out = driver.assemble(raw, { level: 'N5', exclude: [], excludeMeanings: [] })
  assert.equal(out.received, 4)
  assert.deepEqual(
    out.words.map((w) => [w.textJa, w.exampleJa, w.exampleKo]),
    [['砂糖', '砂糖をお願いします。', '설탕 부탁해요.'], ['牛乳', null, null], ['氷', null, null], ['持ち帰り', null, null]],
    '단어 4개 모두 유지 · 좋은 예문만 값',
  )
  for (const w of out.words) assert.deepEqual(Object.keys(w).sort(), CANDIDATE_KEYS, `${w.textJa} — learning 후보 키와 정확히 같다`)
})
