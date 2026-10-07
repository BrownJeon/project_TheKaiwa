/**
 * task-045 Codex C2 보완 — 역할극 대화 만들기(#28 `scenarioId`)는 Chat 을 만드는 트랜잭션에서 사용자 잠금 뒤 상황을 다시 확인한다
 * (`rolePlayStartGuard` → learning `assertScenarioStartableTx`). 상황 지우기(#165)·시드 숨김도 같은 잠금이라, 지우기가 먼저 끝나면 시작은 거절되고
 * 시작이 먼저면 지우기가 그 뒤에 끝나며 만든 대화는 그대로다. 일반 대화(`createChat`)·guard 없는 `createChatWithOpening` 은 그대로.
 * 메모리 가짜(learning `challengeFakeDb` — 잠금 = 사용자별 FIFO 뮤텍스, infra `lockUserRow` 의 `$queryRaw` 도 같은 잠금). 공유 DB 를 건드리지 않는다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@/modules/infra'
import { archiveScenario, hideSeed, type ScenarioChatStart } from '@/modules/learning'
import { fakeDb, type FakeDbOptions } from '../../learning/__tests__/challengeFakeDb'
import { createChatWithOpening, createRolePlayChat, rolePlayStartGuard, type RolePlayChatDeps, type RolePlayChatRowData } from '../chats/rolePlay'

const U = 'userA'
const O = 'userB'
type Row = Record<string, unknown>
const ROW: RolePlayChatRowData = { userId: U, kind: 'TALK', title: '상황', topicId: null, scenarioId: 'scnMine', lessonId: null, level: 'N5', lastMessageAt: new Date(0), createdAt: new Date(0) }

function fixture(opts: FakeDbOptions = {}) {
  const f = fakeDb(opts)
  f.tables.scenario.push(
    { id: 'scnMine', userId: U, isSeed: false, status: 'ACTIVE', title: '내 상황', level: 'N5' },
    { id: 'scnSeed', userId: null, isSeed: true, status: 'ACTIVE', title: '시드 상황', level: 'N5' },
  )
  return { f, T: f.tables }
}

const startOf = (scenarioId: string): ScenarioChatStart => ({ scenario: { id: scenarioId, title: '상황', titleJa: null, level: 'N5' }, lessonId: null, topic: null, topicSource: 'NONE' })

/** 시작 판정(잠금 밖)은 통과한 것으로 두고, 판정 직후 `between` 을 끼워 넣는다(지우기·숨김이 그 사이 끝난 경우). 만들기는 실제 `createChatWithOpening`. */
function deps(f: ReturnType<typeof fakeDb>, between: () => Promise<unknown> = async () => undefined, opening: { ja: string; ko: string } | null = null): RolePlayChatDeps {
  return {
    resolveStart: async (_u, input) => (await between(), startOf(input.scenarioId!)),
    readMaterial: async () => (opening ? { opening: { ja: opening.ja, ko: opening.ko } } : null) as never,
    createChat: (data, op, guard) => createChatWithOpening(data, op, (fn) => f.deps().transaction!(fn), guard),
  }
}
const start = (f: ReturnType<typeof fakeDb>, scenarioId: string, d = deps(f)) =>
  createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId, lessonId: null }, d)

const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
async function rejectsWith(p: Promise<unknown>, want: string): Promise<void> {
  try {
    await p
  } catch (e) {
    assert.equal(reasonOf(e), want)
    return
  }
  assert.fail(`${want} 로 실패해야 한다`)
}
const tick = () => new Promise<void>((r) => setImmediate(r))

test('역할극 시작 — 잠금 → 상황 재확인 → chat.create 순서(같은 트랜잭션) · 내 상황은 가림 조회 없음 · 시드는 가림 1회', async () => {
  const { f, T } = fixture()
  const dto = await start(f, 'scnMine', deps(f, undefined, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' }))
  assert.equal(dto.scenarioId, 'scnMine')
  const lock = f.log.indexOf('lockUser')
  const read = f.log.indexOf('scenario.findFirst')
  const create = f.log.indexOf('chat.create')
  assert.ok(lock >= 0 && read > lock && create > read && f.log.indexOf('chatMessage.create') > create, f.log.join(' '))
  assert.ok(!f.log.includes('userSeedOverride.findFirst'))
  assert.equal(T.chat.length, 1)
  const g = fixture().f
  await start(g, 'scnSeed')
  assert.equal(g.log.filter((l) => l === 'userSeedOverride.findFirst').length, 1)
})

test('경쟁 — 지우기가 시작 판정과 만들기 사이에 끝나면 시작 판정과 같은 409 ARCHIVED · 대화·메시지 0', async () => {
  const { f, T } = fixture()
  await rejectsWith(start(f, 'scnMine', deps(f, () => archiveScenario(U, 'scnMine', f.deps()), { ja: 'どうぞ。', ko: '' })), 'CONFLICT:ARCHIVED')
  assert.equal(T.chat.length, 0)
  assert.equal(T.chatMessage.length, 0)
})

test('경쟁 — 시드 숨김이 사이에 끝나면 404(사유 없음, 없는 상황과 같음) · 다른 사용자의 숨김은 무관', async () => {
  const { f, T } = fixture()
  await rejectsWith(start(f, 'scnSeed', deps(f, () => hideSeed(U, 'SCENARIO', 'scnSeed', f.deps()))), 'NOT_FOUND:')
  assert.equal(T.chat.length, 0)
  const o = fixture()
  await start(o.f, 'scnSeed', deps(o.f, () => hideSeed(O, 'SCENARIO', 'scnSeed', o.f.deps())))
  assert.equal(o.T.chat.length, 1)
})

test('경쟁 — 시작이 먼저면 지우기는 그 뒤에도 성공하고 만든 대화는 그대로', async () => {
  const { f, T } = fixture()
  await start(f, 'scnMine')
  const chat = JSON.stringify(T.chat)
  assert.equal((await archiveScenario(U, 'scnMine', f.deps())).alreadyArchived, false)
  assert.equal((T.scenario.find((s) => s.id === 'scnMine') as Row).status, 'ARCHIVED')
  assert.equal(JSON.stringify(T.chat), chat)
  // 지운 뒤의 새 시작은 거절.
  await rejectsWith(start(f, 'scnMine'), 'CONFLICT:ARCHIVED')
  assert.equal(T.chat.length, 1)
})

test('동시 실행(호출마다 양보) — 지운 뒤에 만든 역할극 대화는 없다, 두 순서를 모두 거친다', async () => {
  const wins = { archiveFirst: 0, startFirst: 0 }
  for (let lag = 0; lag < 12; lag++) {
    const { f, T } = fixture({ tick: true })
    const [s, a] = await Promise.allSettled([
      start(f, 'scnMine'),
      (async () => {
        for (let i = 0; i < lag; i++) await tick()
        return archiveScenario(U, 'scnMine', f.deps())
      })(),
    ])
    assert.equal(a.status, 'fulfilled', `lag ${lag}: 지우기는 늘 성공`)
    const created = f.log.indexOf('chat.create')
    const archived = f.log.indexOf('scenario.updateMany')
    if (s.status === 'fulfilled') {
      assert.ok(created >= 0 && created < archived, `lag ${lag}: 대화는 지우기보다 먼저 — ${f.log.join(' ')}`)
      wins.startFirst++
    } else {
      assert.equal(reasonOf(s.reason), 'CONFLICT:ARCHIVED')
      assert.equal(T.chat.length, 0)
      wins.archiveFirst++
    }
  }
  assert.ok(wins.archiveFirst > 0 && wins.startFirst > 0, `두 순서를 모두 거쳐야 한다: ${JSON.stringify(wins)}`)
})

test('createRolePlayChat 은 만들기에 rolePlayStartGuard 를 넘긴다 · guard 가 던지면 만들기 0', async () => {
  const seen: unknown[] = []
  const d: RolePlayChatDeps = {
    resolveStart: async () => startOf('scnMine'),
    readMaterial: async () => null,
    createChat: async (_data, _op, guard) => {
      seen.push(guard)
      throw new ApiError('CONFLICT', 'x', { reason: 'ARCHIVED' })
    },
  }
  await rejectsWith(createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scnMine', lessonId: null }, d), 'CONFLICT:ARCHIVED')
  assert.deepEqual(seen, [rolePlayStartGuard])
  const { f, T } = fixture()
  await rejectsWith(
    createChatWithOpening(ROW, { ja: 'どうぞ。', ko: '' }, (fn) => f.deps().transaction!(fn), async () => {
      throw new ApiError('NOT_FOUND', 'gone')
    }),
    'NOT_FOUND:',
  )
  assert.equal(T.chat.length + T.chatMessage.length, 0)
})

test('guard 없는 createChatWithOpening(일반 경로) — 잠금·상황 조회 없이 예전과 같은 쓰기 2건만', async () => {
  const { f } = fixture()
  await createChatWithOpening(ROW, { ja: 'どうぞ。', ko: '' }, (fn) => f.deps().transaction!(fn))
  assert.deepEqual(f.log, ['chat.create', 'chatMessage.create'])
})
