/**
 * task-045 T2 — #170 `draftTopic` 실행 서비스 · `LLM_TASKS` 등록 · 저장 검사 보조(`detectUnsafeUserTopicText`·`topicContentWarnings`·`findTopicChunkDuplicate`) ·
 * `TITLE_TRUNCATED`. 엔진·DB 0(가짜 deps). 보이지 않는 문자는 소스에 직접 쓰지 않고 `String.fromCodePoint` 로 만든다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { isLlmTask, LLM_TASKS, type LlmJsonResult, type TraceRecord } from '@/modules/engine'
import { buildTopicDraftRequest, TOPIC_DRAFT_PROMPT_VERSION, TOPIC_DRAFT_TASK } from '../prompts/topicDraft'
import { OPENING_DRAFT_TASK } from '../prompts/openingDraft'
import {
  detectUnsafeTopicText,
  detectUnsafeUserTopicText,
  findTopicChunkDuplicate,
  fitTopicDraft,
  topicContentWarnings,
  type TopicDraftResponse,
} from '../structuredResponse/topicDraftSchemas'
import { draftTopic, readTopicDraftBody, TOPIC_DRAFT_FAIL_MESSAGE, TOPIC_DRAFT_REJECT_MESSAGE, type TopicDraftDeps } from '../chats/topicDraft'

const cp = (...c: number[]) => String.fromCodePoint(...c)
const VS16 = cp(0xfe0f)
const ZWJ = cp(0x200d)

const CHUNKS: Array<[string, string, string, string]> = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'], ['NAME', '受付', 'うけつけ', '접수'],
  ['ACTION', '待ちます', 'まちます', '기다려요'], ['ACTION', '呼びます', 'よびます', '불러요'], ['ACTION', '飲みます', 'のみます', '마셔요'], ['ACTION', '休みます', 'やすみます', '쉬어요'],
  ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['FEELING', '眠いです', 'ねむいです', '졸려요'], ['FEELING', '大変です', 'たいへんです', '힘들어요'],
  ['MODIFIER', '少し', 'すこし', '조금'], ['MODIFIER', '毎日', 'まいにち', '매일'], ['MODIFIER', '右に', 'みぎに', '오른쪽으로'], ['MODIFIER', '早く', 'はやく', '빨리'],
]
const okResponse = (o: Record<string, unknown> = {}): TopicDraftResponse =>
  ({
    status: 'OK',
    draft: {
      title: '병원 진료',
      titleJa: '病院で診察',
      description: '병원에서 증상을 말하고 진료를 받을 때 쓰는 표현을 연습해요.',
      chunks: CHUNKS.map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo, jlpt: 'N5' })),
      ...o,
    },
  }) as unknown as TopicDraftResponse

function fakeDeps(respond: () => Promise<TopicDraftResponse>) {
  const traces: TraceRecord[] = []
  const calls: unknown[] = []
  let profileReads = 0
  const deps: TopicDraftDeps = {
    profileLevel: async () => (profileReads++, 'N4'),
    complete: async (req) => {
      calls.push(req)
      const data = await respond()
      return { data, connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 3300 } as unknown as LlmJsonResult<TopicDraftResponse>
    },
    trace: async (t) => void traces.push(t),
  }
  return { deps, traces, calls, profileReads: () => profileReads }
}

async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<Error & { userMessage?: string; details?: Record<string, unknown> }> {
  try {
    await p
  } catch (e) {
    const err = e as Error & { code?: string; userMessage?: string; details?: Record<string, unknown> }
    assert.equal(err.code, code, `${err.code} ${err.message}`)
    if (reason) assert.equal(err.details?.reason, reason)
    return err
  }
  assert.fail(`expected ${code}`)
}

const flush = () => new Promise((r) => setImmediate(r))
const BODY = { title: '병원 진료 받기', level: 'N5' as const, note: '감기 증상 비밀메모' }

test('LLM_TASKS: topicDraft = balanced·40s·interactive · openingDraft = balanced·25s·interactive · 빌더 task 이름이 등록돼 있다', () => {
  assert.deepEqual(LLM_TASKS.topicDraft, { tier: 'balanced', timeoutMs: 40_000, lane: 'interactive' })
  assert.deepEqual(LLM_TASKS.openingDraft, { tier: 'balanced', timeoutMs: 25_000, lane: 'interactive' })
  assert.ok(isLlmTask(TOPIC_DRAFT_TASK) && isLlmTask(OPENING_DRAFT_TASK))
  assert.equal(buildTopicDraftRequest({ title: '병원', level: 'N5' }).task, 'topicDraft')
})

test('#170 정상: 200 {draft, warnings} · 수준 = 학습자 값 · Trace 1건(판 이름·수치만 — 주제·보충 설명·초안 글 원문 0)', async () => {
  const f = fakeDeps(async () => okResponse())
  const r = await draftTopic('u1', BODY, f.deps)
  assert.equal(r.draft.level, 'N5')
  assert.equal(r.draft.chunks.length, 16)
  assert.deepEqual(r.warnings, [])
  assert.equal(f.calls.length, 1)
  await flush()
  assert.equal(f.traces.length, 1)
  const t = f.traces[0]
  assert.equal(t.status, 'OK')
  assert.equal(t.refType, 'topicDraft')
  assert.equal(t.steps[0].promptVersion, TOPIC_DRAFT_PROMPT_VERSION)
  assert.equal(TOPIC_DRAFT_PROMPT_VERSION, 'topicDraft@v2')
  const json = JSON.stringify(t)
  for (const raw of ['병원 진료', '감기', '비밀메모', '病院', 'びょういん', '증상을 말하고']) assert.equal(json.includes(raw), false, raw)
})

test('#170 거절: NOT_A_TOPIC·UNSAFE 는 같은 문구·같은 사유의 422(Trace 에만 구분) · INVALID 는 502 DRAFT_INVALID', async () => {
  const msgs = new Set<string>()
  const statuses: unknown[] = []
  for (const status of ['NOT_A_TOPIC', 'UNSAFE'] as const) {
    const f = fakeDeps(async () => ({ status, draft: null }) as unknown as TopicDraftResponse)
    const e = await rejects(draftTopic('u1', BODY, f.deps), 'UNPROCESSABLE', 'NOT_A_TOPIC')
    msgs.add(e.userMessage!)
    await flush()
    statuses.push(f.traces[0].steps[0].draftStatus)
  }
  assert.deepEqual([...msgs], [TOPIC_DRAFT_REJECT_MESSAGE])
  assert.equal(TOPIC_DRAFT_REJECT_MESSAGE, '이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인).')
  assert.deepEqual(statuses, ['NOT_A_TOPIC', 'UNSAFE'])
  const f = fakeDeps(async () => okResponse({ chunks: [] }))
  const e = await rejects(draftTopic('u1', BODY, f.deps), 'ENGINE_ERROR', 'DRAFT_INVALID')
  assert.equal(e.userMessage, TOPIC_DRAFT_FAIL_MESSAGE)
})

test('#170 엔진 실패: 엔진 오류·시간 초과는 같은 문구의 502(ENGINE_FAILED·TIMEOUT) · 엔진 큐 포화 429 는 그대로 · Trace 는 ERROR', async () => {
  const named = (name: string) => Object.assign(new Error('x'), { name })
  for (const [err, reason] of [[named('ClaudeCliExecError'), 'ENGINE_FAILED'], [named('ClaudeCliTimeoutError'), 'TIMEOUT'], [new Error('boom'), 'ENGINE_FAILED']] as const) {
    const f = fakeDeps(async () => {
      throw err
    })
    const e = await rejects(draftTopic('u1', BODY, f.deps), 'ENGINE_ERROR', reason)
    assert.equal(e.userMessage, TOPIC_DRAFT_FAIL_MESSAGE)
    await flush()
    assert.equal(f.traces[0].status, 'ERROR')
  }
  const f = fakeDeps(async () => {
    throw new ApiError('RATE_LIMITED', '잠시 후', { retryAfterSec: 3 })
  })
  await rejects(draftTopic('u1', BODY, f.deps), 'RATE_LIMITED')
})

test('#170 같은 사용자 동시 2건 → 두 번째 409 DRAFT_BUSY(LLM 1회) · 다른 사용자는 막지 않음 · 끝나거나 실패하면 다시 가능', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const f = fakeDeps(async () => (await gate, okResponse()))
  const first = draftTopic('u1', BODY, f.deps)
  const second = draftTopic('u1', BODY, f.deps).then(() => null, (e: unknown) => e)
  const other = draftTopic('u2', BODY, f.deps)
  await flush()
  release()
  await Promise.all([first, other])
  const e = (await second) as { code?: string; details?: { reason?: string } } | null
  assert.deepEqual([e?.code, e?.details?.reason], ['CONFLICT', 'DRAFT_BUSY'])
  assert.equal(f.calls.length, 2)
  await draftTopic('u1', BODY, f.deps)
  const g = fakeDeps(async () => {
    throw new Error('boom')
  })
  await rejects(draftTopic('u3', BODY, g.deps), 'ENGINE_ERROR')
  await draftTopic('u3', BODY, f.deps)
})

test('#170 본문: 칸 문제는 400(프로필 읽기 0) · level 이 없으면 검사 통과 뒤 학습자 수준 · level 이 있으면 프로필 읽기 0', async () => {
  const f = fakeDeps(async () => okResponse())
  for (const [raw, field, reason] of [
    [{}, 'title', 'required'],
    [{ title: '가' }, 'title', 'min_length'],
    [{ title: '가'.repeat(41) }, 'title', 'max_length'],
    [{ title: '<b>병원' }, 'title', 'forbidden_char'],
    [{ title: '병원', extra: 1 }, 'body', 'unknown_key'],
    [{ title: '병원', level: 'N9' }, 'level', 'enum'],
    [{ title: '병원', note: '가'.repeat(201) }, 'note', 'max_length'],
  ] as const) {
    const e = await rejects(readTopicDraftBody('u1', raw as Record<string, unknown>, f.deps), 'VALIDATION', reason)
    assert.equal(e.details?.field, field)
  }
  assert.equal(f.profileReads(), 0)
  assert.deepEqual(await readTopicDraftBody('u1', { title: ' 병원 진료 ' }, f.deps), { title: '병원 진료', level: 'N4', note: null })
  assert.equal(f.profileReads(), 1)
  assert.equal((await readTopicDraftBody('u1', { title: '병원', level: 'N2' }, f.deps)).level, 'N2')
  assert.equal(f.profileReads(), 1)
})

test('TITLE_TRUNCATED: 모델 제목 21자↑ 또는 폴백한 입력 제목 21자↑ 이면 경고 끝에 추가 · 20자 이하는 없음 · 기존 경고 순서 불변', () => {
  const ctx = { level: 'N5' as const, title: '병원' }
  assert.deepEqual(fitTopicDraft(ctx, okResponse({ title: '가'.repeat(20) })).warnings, [])
  const long = fitTopicDraft(ctx, okResponse({ title: '가'.repeat(21), titleJa: null, description: null }))
  assert.deepEqual(long.warnings, ['DESCRIPTION_MISSING', 'TITLE_JA_MISSING', 'TITLE_TRUNCATED'])
  assert.equal(Array.from(long.draft!.title).length, 20)
  const fb = fitTopicDraft({ level: 'N5', title: '나'.repeat(30) }, okResponse({ title: '' }))
  assert.equal(fb.repairs.titleFallback, true)
  assert.deepEqual(fb.warnings, ['TITLE_TRUNCATED'])
  assert.deepEqual(fitTopicDraft({ level: 'N5', title: '짧은 제목' }, okResponse({ title: '' })).warnings, [])
})

test('topicContentWarnings: 12개 미만 CHUNKS_SHORT · 유형 2개 미만 TYPE_THIN_* (유형 순) · 설명·일본어 제목 없음 — 순서 고정', () => {
  const ch = (types: string[]) => types.map((chunkType) => ({ chunkType }))
  assert.deepEqual(topicContentWarnings({ titleJa: 'あ', description: '설명', chunks: ch([...'NNNAAAFFFMMM'].map((c) => ({ N: 'NAME', A: 'ACTION', F: 'FEELING', M: 'MODIFIER' })[c]!)) }), [])
  assert.deepEqual(topicContentWarnings({ titleJa: null, description: null, chunks: ch(['NAME', 'NAME', 'FEELING', 'MODIFIER', 'MODIFIER', 'NAME', 'NAME', 'NAME', 'NAME', 'NAME', 'NAME']) }), [
    'CHUNKS_SHORT', 'TYPE_THIN_ACTION', 'TYPE_THIN_FEELING', 'DESCRIPTION_MISSING', 'TITLE_JA_MISSING',
  ])
})

test('findTopicChunkDuplicate: 같은 표기(정규화)·같은 뜻(공백·부호 무시) — 첫 중복 위치', () => {
  assert.equal(findTopicChunkDuplicate([{ textJa: '薬', meaningKo: '약' }, { textJa: '病院', meaningKo: '병원' }]), null)
  assert.deepEqual(findTopicChunkDuplicate([{ textJa: '薬', meaningKo: '약' }, { textJa: '病院', meaningKo: '병원' }, { textJa: '薬', meaningKo: '약품' }]), { index: 2, reason: 'DUP_SURFACE' })
  assert.deepEqual(findTopicChunkDuplicate([{ textJa: '薬', meaningKo: '약, 약품' }, { textJa: 'くすり', meaningKo: '약 약품' }]), { index: 1, reason: 'DUP_MEANING' })
})

test('detectUnsafeUserTopicText: 이모지에 붙은 VS16·ZWJ 허용 · 꺾쇠·URL·비밀 모양·제어문자·이모지 밖 접합 문자 금지 · 원래 함수는 그대로 엄격', () => {
  const ok = [`여행 ✈${VS16}`, `요리 👩${ZWJ}🍳`, `❤${VS16} 데이트`, `1${VS16}${cp(0x20e3)} 번호`, `가족 👨${cp(0x1f3fb)}${ZWJ}👩`, '병원 진료', 'A&B 9:30', '☕ 카페']
  for (const s of ok) assert.equal(detectUnsafeUserTopicText(s), null, JSON.stringify(s))
  const bad: Array<[string, string]> = [
    ['a<b', 'MARKUP'], ['<b>굵게</b>', 'MARKUP'], ['＜script＞', 'MARKUP'], [`✈${VS16}<x>`, 'MARKUP'],
    ['http://evil.example', 'URL'], ['www.evil.example 여행', 'URL'], [`✈${VS16} https://x.example`, 'URL'],
    [`ht${ZWJ}tp://evil.example`, 'CONTROL_CHARS'], [`가${ZWJ}🍳`, 'CONTROL_CHARS'], [`🍳${ZWJ}가`, 'CONTROL_CHARS'], [`병${ZWJ}원`, 'CONTROL_CHARS'], [`병원${VS16}`, 'CONTROL_CHARS'], [`${ZWJ}🍳`, 'CONTROL_CHARS'],
    [`병원${cp(0x200b)}`, 'CONTROL_CHARS'], [`병원${cp(0x202e)}`, 'CONTROL_CHARS'], [`병원${cp(0)}`, 'CONTROL_CHARS'], ['병원\n진료', 'CONTROL_CHARS'], [`👩${ZWJ}${cp(0x200b)}🍳`, 'CONTROL_CHARS'],
    ['sk-abcdefghijklmnopqrstuvwxyz123456', 'SECRET_LIKE'],
  ]
  for (const [s, kind] of bad) assert.equal(detectUnsafeUserTopicText(s), kind, JSON.stringify(s))
  assert.equal(detectUnsafeUserTopicText('Claude 사용법'), null, '엔진·모델 이름은 막지 않는다(Leader 결정 — 표현 칸만 기존 규칙)')
  assert.equal(detectUnsafeTopicText(`여행 ✈${VS16}`), 'CONTROL_CHARS', 'AI 초안 검사는 불변')
  assert.equal(detectUnsafeTopicText(`요리 👩${ZWJ}🍳`), 'CONTROL_CHARS')
})
