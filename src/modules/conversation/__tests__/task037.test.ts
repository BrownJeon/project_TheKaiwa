import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { completeJson, JsonSchemaError } from '../../engine/llm'
import { routerDeps, type ResolvedConnection } from '../../engine/router'
import { prisma } from '@/modules/infra'
import { buildChatRequest } from '../prompts/chat'
import { buildTalkRequest } from '../prompts/talk'
import { buildWordEnrichRequest } from '../prompts/wordEnrich'
import { startTurn, turnDeps } from '../orchestrator'
import type { TurnEvent } from '../orchestrator/stream'
import type { TutorResponse } from '../structuredResponse/schemas'

// task-037 — 루트 조기 닫힘 구문 슬립 복구를 **실제 completeJson**(요청 옵션 → runJsonSoft/runJsonWithRetry → extractAndValidate → 후검증)과
// **실제 startTurn**(TALK 턴 → done · RequestTrace LLM 단계 표식)까지 가짜 LLM 서버로 관통해 확인한다. 라이브 LLM·실 TTS 호출 0.
// 문장은 전부 합성이다(실사용자 대화·사람 이름 없음).

const learner = { displayName: '학습자', teacherName: '선생님', level: 'N5', weaknesses: [], streakDays: 1 }

const body = (over: Record<string, unknown> = {}) => ({
  speech: { style: 'ENCOURAGING' },
  conversation: { replyJa: 'いいですね。映画は好きですか？', replyKo: '좋네요. 영화를 좋아해요?' },
  correction: null,
  learning: { grammarPoint: null, difficulty: 'N5' },
  endOfTopic: false,
  proposals: [],
  ...over,
})
const KO = '네.'
/** 슬립: 마지막 필드(proposals)에서 루트를 닫고 `,"userKo":…}` 가 이어진다(코드펜스 포함). */
const slip = (over: Record<string, unknown> = {}) => '```json\n' + JSON.stringify(body(over)) + `,"userKo":${JSON.stringify(KO)}}\n\`\`\``
const good = (over: Record<string, unknown> = {}) => JSON.stringify({ ...body(over), userKo: KO })

interface Fake {
  hits: string[]
  server: Server
  port: number
  /** 다음 응답들을 순서대로 돌려준다(경로 무관). 남은 응답이 없으면 500. */
  script: string[]
}

async function startFakeLlm(script: string[]): Promise<Fake> {
  const fake: Fake = { hits: [], script, port: 0, server: undefined as unknown as Server }
  fake.server = createServer((rq, rs) => {
    rq.resume()
    rq.on('end', () => {
      fake.hits.push(rq.url ?? '')
      const next = fake.script.shift()
      if (next === undefined) {
        rs.writeHead(500).end('unexpected call')
        return
      }
      rs.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ message: { content: next } }))
    })
  })
  await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve))
  fake.port = (fake.server.address() as AddressInfo).port
  return fake
}

/** home-m4 형식 가짜 connection 하나를 router 에 끼운다(DB·실 엔진 없이). 반환값은 원복 함수. */
function installFakeConnection(fake: Fake): () => void {
  const keyEnv = 'HOME_M4_API_KEY'
  const prevKey = process.env[keyEnv]
  const prevBase = process.env.AI_API_BASE
  process.env[keyEnv] = 'test-only'
  process.env.AI_API_BASE = `http://127.0.0.1:${fake.port}`
  const conn: ResolvedConnection = {
    id: 'fake',
    key: 'fake',
    engineId: 'home-m4-api',
    connectionType: 'HTTP',
    connection: { baseUrl: `http://127.0.0.1:${fake.port}` },
    runtime: { model: 'fake-model' },
    credentialRef: `env:${keyEnv}`,
  }
  mock.method(routerDeps, 'loadChain', async () => [conn])
  return () => {
    fake.server.closeAllConnections()
    fake.server.close()
    if (prevKey === undefined) delete process.env[keyEnv]
    else process.env[keyEnv] = prevKey
    if (prevBase === undefined) delete process.env.AI_API_BASE
    else process.env.AI_API_BASE = prevBase
  }
}

/**
 * `recordTrace` 가 쓰는 `prisma.requestTrace.create` 를 가로채 실제 DB 에는 아무것도 쓰지 않고 기록될 행을 모은다. Prisma 모델 델리게이트는
 * Proxy 라 `mock.method` 가 `create` 를 찾지 못한다 — 자기 속성(`requestTrace`)을 통째로 바꿔 끼우고 **원래 델리게이트 값**으로 되돌린다.
 * 자기 속성 descriptor 의 `value` 는 `undefined` 다(Proxy 가 get 으로 델리게이트를 내줄 뿐) — descriptor 만으로 되돌리면 이후
 * `prisma.requestTrace` 가 `undefined` 가 되므로 값을 먼저 잡아 두고 `{ ...descriptor, value }` 로 복원한다(REV-110 M-1).
 */
function captureTraces(): {
  traces: { traceId: string; steps: Record<string, unknown>[]; status: string }[]
  original: unknown
  restore: () => void
} {
  const traces: { traceId: string; steps: Record<string, unknown>[]; status: string }[] = []
  const original = (prisma as unknown as Record<string, unknown>).requestTrace
  assert.ok(original, 'prisma.requestTrace 델리게이트가 있어야 한다(prisma generate 이후)')
  const originalDescriptor = Object.getOwnPropertyDescriptor(prisma, 'requestTrace')
  Object.defineProperty(prisma, 'requestTrace', {
    configurable: true,
    writable: true,
    value: {
      create: async (args: { data: { traceId: string; steps: Record<string, unknown>[]; status: string } }) => {
        traces.push(args.data)
        return args.data
      },
    },
  })
  return {
    traces,
    original,
    restore: () => {
      Object.defineProperty(prisma, 'requestTrace', { configurable: true, writable: true, enumerable: true, ...originalDescriptor, value: original })
    },
  }
}

test('completeJson(TALK 요청 그대로): 슬립 1차 응답 → LLM 1회·attempts 1·repaired ROOT_CLOSE·로그 한 줄(내용 없음) / 옵션을 끄면 지금처럼 2회', async (t) => {
  const warns: string[] = []
  mock.method(console, 'warn', (...a: unknown[]) => void warns.push(a.map(String).join(' ')))
  const fake = await startFakeLlm([slip(), good()])
  const restore = installFakeConnection(fake)
  t.after(() => {
    mock.restoreAll()
    restore()
  })

  const req = buildTalkRequest({ todayKst: '2026-10-05', learner, history: [], text: 'はい' })
  assert.equal(req.repairRootClose, true)
  // TALK 은 soft 경로로 부른다(orchestrator `startLlmRun`) — 같은 모양으로.
  const r = await completeJson<TutorResponse>({ ...req, softExtraCheck: true })
  assert.deepEqual(fake.hits.length, 1, 'HTTP 호출 1회 — 재시도 없음')
  assert.equal(r.attempts, 1)
  assert.equal(r.repaired, 'ROOT_CLOSE')
  assert.equal(r.data.userKo, KO, 'userKo 는 루트 키로 살아 있다')
  assert.deepEqual(r.residualViolations, [])
  assert.deepEqual(warns, ['[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략'])
  assert.ok(!warns.join('').includes('映画') && !warns.join('').includes('いいですね'), '응답·문장 내용은 로그에 없다')

  // 같은 요청에서 옵션만 끄면(= 옵트인 전의 동작) 파싱 실패 → 재시도 1회.
  fake.hits.length = 0
  fake.script.length = 0
  fake.script.push(slip(), good())
  const off = await completeJson<TutorResponse>({ ...req, repairRootClose: false, softExtraCheck: true })
  assert.equal(fake.hits.length, 2)
  assert.equal(off.attempts, 2)
  assert.ok(!('repaired' in off), '옵션을 끈 요청의 결과에는 repaired 키가 없다')

  // 옵션 값이 아예 없는(undefined) 요청 = 옵트인하지 않은 호출도 같다 — 기본값이 "켜짐" 이면 안 된다.
  fake.hits.length = 0
  fake.script.length = 0
  fake.script.push(slip(), good())
  const unset = await completeJson<TutorResponse>({ ...req, repairRootClose: undefined, softExtraCheck: true })
  assert.equal(fake.hits.length, 2, '옵션이 없으면 복구하지 않고 재시도한다')
  assert.equal(unset.attempts, 2)
  assert.ok(!('repaired' in unset))
})

test('completeJson(CHAT 요청 그대로, soft 아님): 슬립 → 1회·repaired / 복구해도 ajv 위반이면 재시도·그것도 위반이면 JsonSchemaError', async (t) => {
  mock.method(console, 'warn', () => {})
  const fake = await startFakeLlm([slip()])
  const restore = installFakeConnection(fake)
  t.after(() => {
    mock.restoreAll()
    restore()
  })
  const req = buildChatRequest({ todayKst: '2026-10-05', learner, history: [], text: 'はい' })
  const r = await completeJson<TutorResponse>(req)
  assert.deepEqual([fake.hits.length, r.attempts, r.repaired], [1, 1, 'ROOT_CLOSE'])

  // 복구 후 위반(허용 밖 필드) → 재시도, 재시도 응답이 정상이면 그것을 쓴다(repaired 없음).
  fake.hits.length = 0
  fake.script.length = 0
  fake.script.push(slip({ surprise: 1 }), good())
  const r2 = await completeJson<TutorResponse>(req)
  assert.deepEqual([fake.hits.length, r2.attempts], [2, 2])
  assert.ok(!('repaired' in r2), '재시도 응답은 정상 JSON 이라 repaired 키가 없다')

  // 둘 다 위반이면 기존대로 JsonSchemaError — 복구가 재시도 상한(1회)을 바꾸지 않는다.
  fake.hits.length = 0
  fake.script.length = 0
  fake.script.push(slip({ surprise: 1 }), slip({ surprise: 1 }))
  await assert.rejects(completeJson<TutorResponse>(req), JsonSchemaError)
  assert.equal(fake.hits.length, 2)
})

/** 단어 보강(A10, wordEnrich@v2 — chunkType 필수 키 포함) 스키마를 **통과하는** 문서의 슬립 모양 — 복구가 켜져 있었다면 1회로 성공했을 입력이라, 이 요청이 복구하지 않음을 빈 증명이 아니게 한다. */
const wordSlip = () => '{"valid":true,"invalidReason":null,"reading":"えいが","meaning":"영화","partOfSpeech":null,"chunkType":"NAME","jlpt":"N5","example":null},"exampleKo":null}'

test('옵트인하지 않은 요청(단어 보강 등)은 슬립이 와도 복구하지 않고 지금처럼 재시도한다', async (t) => {
  mock.method(console, 'warn', () => {})
  const fake = await startFakeLlm([wordSlip(), wordSlip()])
  const restore = installFakeConnection(fake)
  t.after(() => {
    mock.restoreAll()
    restore()
  })
  const req = buildWordEnrichRequest({ surface: '映画', level: 'N5' })
  assert.ok(!req.repairRootClose, '단어 보강 요청은 옵션을 켜지 않는다')
  await assert.rejects(completeJson(req), JsonSchemaError)
  assert.equal(fake.hits.length, 2, '파싱 실패 → 재시도 1회 → 다시 실패(복구 경로를 타지 않는다)')
})

test('startTurn(TALK): 슬립 응답으로도 LLM 1회에 done 에 도달하고 RequestTrace LLM 단계에 attempts 1·repaired=ROOT_CLOSE 가 남는다', async (t) => {
  mock.method(console, 'warn', () => {})
  const fake = await startFakeLlm([slip()])
  const restore = installFakeConnection(fake)
  const trace = captureTraces()
  t.after(() => {
    mock.restoreAll()
    restore()
    trace.restore()
  })
  mock.method(turnDeps, 'precheckChat', async () => ({ kind: 'TALK' as const, level: 'N5' as const }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N5' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY' as const)
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  mock.method(turnDeps, 'acceptTurn', async () => ({
    chatId: 'c-037',
    kind: 'TALK' as const,
    level: 'N5' as const,
    userMessage: { id: 'um-037', content: 'はい', createdAt: new Date(), inputSource: 'TEXT' as const },
    assistantMessageId: 'am-037',
    pendingSince: new Date(),
    traceId: 't_task037_repair',
    resumed: false,
  }))
  const saved: unknown[] = []
  mock.method(turnDeps, 'saveTurn', async (...args: unknown[]) => {
    saved.push(args[2])
    return { correction: null, proposals: [] }
  })

  const handle = await startTurn({
    userId: 'u-task037',
    chatId: 'c-037',
    request: { resume: false, text: 'はい', inputSource: 'TEXT', utteranceId: null, clientTimings: null },
  })
  const events: TurnEvent[] = []
  await handle.subscribe((e) => events.push(e))
  await handle.done

  assert.equal(fake.hits.length, 1, 'LLM 호출 1회 — 슬립인데도 재시도가 없다')
  const names = events.map((e) => e.event)
  assert.equal(names.at(-1), 'done', JSON.stringify(events.filter((e) => e.event === 'error')))
  assert.ok(!names.includes('error'), 'error 이벤트 없음')
  const done = events.at(-1)!.data as { conversation: { replyJa: string } }
  assert.equal(done.conversation.replyJa, 'いいですね。映画は好きですか？')
  assert.equal(saved.length, 1, '저장 1회 — 복구한 객체가 그대로 저장 경로로 간다')

  const traces = trace.traces
  assert.equal(traces.length, 1)
  const llm = traces[0].steps.find((s) => s.name === 'LLM')!
  assert.equal(llm.attempts, 1)
  assert.equal(llm.repaired, 'ROOT_CLOSE')
  assert.equal(llm.earlyStop, null, '재시도가 없으니 조기 경로가 RETRY 로 닫히지 않는다(조기 음성 없는 턴이라 null)')
  assert.equal(traces[0].status, 'OK')
  assert.ok(!JSON.stringify(traces[0].steps).includes('いいですね'), 'Trace 에 응답 문장은 없다')

  // REV-110 M-1: 복원은 값을 되돌려야 한다 — 같은 델리게이트가 돌아오지 않으면(옛 descriptor 복원은 undefined) 뒤따르는 test 의 recordTrace 가 조용히 Trace 를 잃는다.
  trace.restore()
  assert.equal((prisma as unknown as Record<string, unknown>).requestTrace, trace.original, '복원 뒤 prisma.requestTrace 는 원래 델리게이트다')
})
