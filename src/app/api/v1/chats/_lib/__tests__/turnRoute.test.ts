/**
 * task-064 dev-S2b — #32 턴 라우트 본문(`_lib/turnRoute.ts`)의 ASK 분기(계약 §2-18-A 3항). DB·엔진 0(가짜 deps, 한도는 실제 모듈).
 * - ASK 요청 검증·한도는 **수락 전**(startTurn 호출 0 = 행 0·SSE 0)
 * - 슬롯 해제는 파이프라인 종료 때 — 정상·오류·소비자 끊김 모두. 수락 전 실패는 몫을 되돌린다.
 * - 끊김 내성: 소비자가 스트림을 끊어도 파이프라인은 끝까지(라우트는 `req.signal` 을 쓰지 않는다)
 * - TALK·CHAT 은 기존 훅 그대로, ASK 한도와 무관
 */
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChatKind } from '@prisma/client'
import { ApiError } from '@/modules/infra'
import { admitAskTurn, askInflightCount, ASK_PER_DAY, ASK_PER_MINUTE, type AskAdmission, type TurnEvent, type TurnHandle, type TurnHooks } from '@/modules/conversation'
import { handleTurnRequest, type TurnRouteDeps } from '../turnRoute'


class FakeTurn {
  readonly events: TurnEvent[] = []
  private readonly listeners = new Set<(e: TurnEvent) => void>()
  private resolveDone!: () => void
  readonly done = new Promise<void>((r) => (this.resolveDone = r))
  finished = false
  emit(e: TurnEvent) {
    this.events.push(e)
    for (const l of this.listeners) l(e)
  }
  finish() {
    this.finished = true
    this.listeners.clear()
    this.resolveDone()
  }
  handle(): TurnHandle {
    return {
      accepted: { userMessageId: 'm_u', assistantMessageId: 'm_a', traceId: 't_1' },
      subscribe: (l) => {
        for (const e of this.events) l(e)
        if (this.finished) return Promise.resolve()
        this.listeners.add(l)
        return this.done
      },
      done: this.done,
    }
  }
}

/** 만든 턴 전부 — 단언이 중간에 실패해도 afterEach 가 끝내 SSE 핑 타이머가 프로세스를 붙잡지 않게(실패가 멈춤으로 보이지 않게). */
const allTurns: FakeTurn[] = []

function world(o: { kind?: ChatKind; startError?: unknown; chatError?: unknown } = {}) {
  const calls: { startTurn: { chatId: string; hooks?: TurnHooks; request: unknown }[]; talkHooks: number; refunds: number } = { startTurn: [], talkHooks: 0, refunds: 0 }
  const turn = new FakeTurn()
  allTurns.push(turn)
  const deps: TurnRouteDeps = {
    chatKind: async () => {
      if (o.chatError) throw o.chatError
      return o.kind ?? 'ASK'
    },
    startTurn: async (input) => {
      calls.startTurn.push({ chatId: input.chatId, hooks: input.hooks, request: input.request })
      if (o.startError) throw o.startError
      turn.emit({ event: 'accepted', data: { userMessageId: 'm_u', assistantMessageId: 'm_a', traceId: 't_1' } })
      return turn.handle()
    },
    admitAsk: (userId) => {
      const a = admitAskTurn(userId)
      return {
        release: () => a.release(),
        refund: () => {
          calls.refunds++
          a.refund()
        },
      }
    },
    talkChatHooks: () => {
      calls.talkHooks++
      return { speaker: () => async () => ({}) as never }
    },
  }
  return { deps, calls, turn }
}

async function readAll(res: Response): Promise<string> {
  return new Response(res.body).text()
}

const flush = () => new Promise((r) => setImmediate(r))
const apiErr = (c: string, check?: (e: ApiError) => boolean) => (e: unknown) => e instanceof ApiError && e.code === c && (check ? check(e) : true)

// 한도 상태는 프로세스 전역이다 — 시험마다 다른 사용자 id 를 쓰고, 끝날 때 슬롯이 모두 풀렸는지 본다(새는 슬롯 = 결함).
afterEach(async () => {
  await flush()
  const leaked = askInflightCount()
  for (const t of allTurns.splice(0)) if (!t.finished) t.finish()
  await flush()
  assert.equal(leaked, 0, '시험이 끝나면 ASK 슬롯 0(시험이 연 턴은 시험이 끝낸다)')
})

test('ASK 정상: accepted → status → done SSE · speaker 훅 없음(audio 0) · done 뒤 슬롯 해제', async () => {
  const w = world()
  const res = await handleTurnRequest('u-ok', 'chat_ask', { text: '이번 주에 뭐 틀렸어?', scope: { key: 'THIS_WEEK' } }, w.deps)
  assert.equal(askInflightCount(), 1)
  assert.equal(w.calls.startTurn.length, 1)
  assert.equal(w.calls.talkHooks, 0, 'ASK 는 TALK·CHAT 훅(발화·음성·관측)을 만들지 않는다')
  assert.equal(w.calls.startTurn[0].hooks?.speaker, undefined)
  assert.deepEqual((w.calls.startTurn[0].request as { scope?: unknown }).scope, { key: 'THIS_WEEK' })
  w.turn.emit({ event: 'status', data: { stage: 'LLM', elapsedMs: 10 } })
  w.turn.emit({ event: 'done', data: { conversation: { answerMd: 'a' } } })
  w.turn.finish()
  const body = await readAll(res)
  assert.match(body, /event: accepted[\s\S]*event: status[\s\S]*event: done/)
  assert.ok(!body.includes('event: audio'))
  await flush()
  assert.equal(askInflightCount(), 0, '파이프라인 종료 때 해제')
})

test('ASK 오류 종료(error 이벤트)도 슬롯 해제', async () => {
  const w = world()
  const res = await handleTurnRequest('u-err', 'chat_ask', { text: '질문' }, w.deps)
  w.turn.emit({ event: 'error', data: { code: 'ENGINE_TIMEOUT' } })
  w.turn.finish()
  assert.match(await readAll(res), /event: error/)
  await flush()
  assert.equal(askInflightCount(), 0)
})

test('끊김 내성: 소비자가 스트림을 끊어도 파이프라인은 계속 · 끝날 때까지 슬롯 유지 · 끝나면 해제', async () => {
  const w = world()
  const res = await handleTurnRequest('u-cut', 'chat_ask', { text: '질문' }, w.deps)
  const reader = res.body!.getReader()
  const first = await reader.read()
  assert.match(new TextDecoder().decode(first.value), /event: accepted/)
  await reader.cancel()
  await flush()
  assert.equal(askInflightCount(), 1, '끊겨도 실행 중이면 슬롯을 쥐고 있다(대기 상한이 실제 부하를 센다)')
  assert.doesNotThrow(() => w.turn.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: 1 } }), '끊긴 소비자 쓰기는 조용히 무시')
  w.turn.emit({ event: 'done', data: {} })
  w.turn.finish()
  await flush()
  assert.equal(askInflightCount(), 0)
  assert.ok(w.turn.finished)
})

test('ASK 한도는 수락 전: 분당 3 을 넘으면 429 · startTurn 0회(행 0·SSE 0)', async () => {
  for (let i = 0; i < 3; i++) {
    const w = world()
    await handleTurnRequest('u-min', 'chat_ask', { text: `q${i}` }, w.deps)
    w.turn.finish()
    await flush()
  }
  const w = world()
  await assert.rejects(handleTurnRequest('u-min', 'chat_ask', { text: 'q4' }, w.deps), apiErr('RATE_LIMITED', (e) => typeof e.details?.retryAfterSec === 'number'))
  assert.equal(w.calls.startTurn.length, 0)
})

test('전역 대기 상한: 실행 중 3건이면 다른 사용자의 4번째 ASK 는 429 ASK_BUSY · startTurn 0회', async () => {
  const live = ['g-a', 'g-b', 'g-c'].map(async (u) => {
    const w = world()
    await handleTurnRequest(u, 'chat_ask', { text: 'q' }, w.deps)
    return w
  })
  const ws = await Promise.all(live)
  const w = world()
  await assert.rejects(handleTurnRequest('g-d', 'chat_ask', { text: 'q' }, w.deps), apiErr('RATE_LIMITED', (e) => e.details?.reason === 'ASK_BUSY'))
  assert.equal(w.calls.startTurn.length, 0)
  ws[0].turn.finish()
  await flush()
  const w2 = world()
  await handleTurnRequest('g-d', 'chat_ask', { text: 'q' }, w2.deps)
  assert.equal(w2.calls.startTurn.length, 1, '하나가 끝나면 다시 받는다')
  for (const x of [ws[1], ws[2], w2]) x.turn.finish()
  await flush()
  assert.equal(askInflightCount(), 0)
})

test('수락 전 실패(409 턴 진행 중 등): 오류 그대로 · 슬롯 해제·몫 되돌림(refund)', async () => {
  const w = world({ startError: new ApiError('CONFLICT', '이미 답을 기다리는 중이에요.', { runningMessageId: 'm_x' }) })
  await assert.rejects(handleTurnRequest('u-409', 'chat_ask', { text: 'q' }, w.deps), apiErr('CONFLICT'))
  assert.equal(w.calls.refunds, 1)
  assert.equal(askInflightCount(), 0)
})

test('수락 전 실패가 거듭돼도 사용자 몫은 그대로 — 하루 60 을 넘겨 실패해도 매번 startTurn 까지 가고(429 없음), 뒤이어 분당 3 건이 온전히 통과 (S-5/M6f)', async () => {
  for (let i = 0; i <= ASK_PER_DAY; i++) {
    const w = world({ startError: new ApiError('CONFLICT', '이미 답을 기다리는 중이에요.') })
    await assert.rejects(handleTurnRequest('u-refund', 'chat_ask', { text: 'q' }, w.deps), apiErr('CONFLICT'), `${i + 1}번째 실패 — refund 가 분·하루 몫을 돌려주지 않으면 여기서 429 로 바뀐다`)
    assert.equal(w.calls.startTurn.length, 1)
    assert.equal(w.calls.refunds, 1)
  }
  for (let i = 0; i < ASK_PER_MINUTE; i++) {
    const ok = world()
    await handleTurnRequest('u-refund', 'chat_ask', { text: `q${i}` }, ok.deps)
    ok.turn.finish()
    await flush()
  }
  const over = world()
  await assert.rejects(handleTurnRequest('u-refund', 'chat_ask', { text: 'q' }, over.deps), apiErr('RATE_LIMITED', (e) => e.details?.reason === 'ASK_RATE'))
  assert.equal(over.calls.startTurn.length, 0)
})

test('턴이 거절(reject)로 끝나도 슬롯을 풀고 처리되지 않은 Promise 거절을 남기지 않는다 — done.then(release, release) (S-5/M7c)', async (t) => {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  t.after(() => process.off('unhandledRejection', onUnhandled))

  const w = world()
  let releases = 0
  let held: AskAdmission | undefined
  let rejectDone!: (e: unknown) => void
  // 라우트가 처리기를 달기 전에는 거절하지 않는다(시험 자신이 처리되지 않은 거절을 만들지 않게).
  const done = new Promise<void>((_resolve, reject) => (rejectDone = reject))
  const deps: TurnRouteDeps = {
    ...w.deps,
    startTurn: async () => ({ accepted: { userMessageId: 'm_u', assistantMessageId: 'm_a', traceId: 't_1' }, subscribe: () => Promise.resolve(), done }),
    admitAsk: (userId) => {
      held = w.deps.admitAsk(userId)
      const a = held
      return { release: () => (releases++, a.release()), refund: () => a.refund() }
    },
  }
  try {
    await handleTurnRequest('u-reject', 'chat_ask', { text: 'q' }, deps)
    assert.equal(askInflightCount(), 1, '파이프라인이 도는 동안 슬롯을 쥔다')

    rejectDone(new Error('파이프라인 예외'))
    await flush()
    await flush()
    assert.equal(releases, 1, 'done 이 거절돼도 release 가 정확히 한 번 불린다')
    assert.equal(askInflightCount(), 0, '슬롯 해제')
    assert.deepEqual(unhandled, [], '처리되지 않은 Promise 거절 0')
  } finally {
    // 결함으로 슬롯이 새도 뒤 시험(전역 슬롯 3칸 공유)과 afterEach 를 끌고 들어가지 않게 — 정상일 땐 이미 풀려 있어 아무 일도 없다.
    held?.release()
  }
})

test('ASK 요청 검증은 한도보다 먼저: utteranceId·음성 inputSource 400 → 몫 0 · 남의 방 404 → startTurn·몫 0', async () => {
  const w = world()
  await assert.rejects(handleTurnRequest('u-val', 'chat_ask', { text: 'q', utteranceId: 'u1' }, w.deps), apiErr('VALIDATION', (e) => e.details?.field === 'utteranceId'))
  await assert.rejects(handleTurnRequest('u-val', 'chat_ask', { text: 'q', inputSource: 'REALTIME_STT' }, w.deps), apiErr('VALIDATION'))
  const nf = world({ chatError: new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.') })
  await assert.rejects(handleTurnRequest('other', 'chat_ask', { text: 'q' }, nf.deps), apiErr('NOT_FOUND'))
  assert.equal(w.calls.startTurn.length + nf.calls.startTurn.length, 0)
  assert.equal(askInflightCount(), 0)
  for (let i = 0; i < 3; i++) {
    const ok = world()
    await handleTurnRequest('u-val', 'chat_ask', { text: 'q' }, ok.deps)
    ok.turn.finish()
    await flush()
  }
})

test('TALK·CHAT: ASK 한도·슬롯과 무관, 기존 훅 그대로 · scope 가 오면 400(startTurn 0)', async () => {
  for (const kind of ['TALK', 'CHAT'] as const) {
    for (let i = 0; i < 5; i++) {
      const w = world({ kind })
      await handleTurnRequest('u-talk', `chat_${kind}`, { text: 'こんにちは' }, w.deps)
      assert.equal(askInflightCount(), 0)
      assert.equal(w.calls.talkHooks, 1)
      assert.ok(w.calls.startTurn[0].hooks?.speaker, 'TALK·CHAT 은 라우트 훅 그대로')
      w.turn.finish()
    }
    const w = world({ kind })
    await assert.rejects(handleTurnRequest('u-talk', `chat_${kind}`, { text: 'a', scope: { key: 'ALL' } }, w.deps), apiErr('VALIDATION', (e) => e.details?.field === 'scope'))
    assert.equal(w.calls.startTurn.length, 0)
  }
})

test('끊김 내성(정적): 턴 라우트·본문은 req.signal 을 턴에 잇지 않는다', () => {
  const dir = join(process.cwd(), 'src/app/api/v1/chats')
  for (const f of ['[id]/turns/route.ts', '_lib/turnRoute.ts']) {
    const code = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.ok(!/\bsignal\b/.test(code), `${f} 에 signal 연결 없음`)
  }
})
