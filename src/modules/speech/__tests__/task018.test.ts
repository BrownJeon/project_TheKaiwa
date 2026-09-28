/**
 * task-018 ① — 발화 ↔ 대화방 결속(`Utterance.chatId`)과 "발화 1개 = 메시지 1개"(`chatMessageId @unique`).
 * DB 호출은 `utteranceDb` 를 바꿔 끼워 재현한다(Prisma 위임 객체는 mock.method 로 못 바꾼다).
 */
import { mock, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import { recordUploadedUtterance, registerGatewayUtterance } from '../utterances'
import { utteranceDb } from '../utterances/store'
import { checkUtteranceForTurn, linkUtteranceToMessage, turnUtteranceProblem, UTTERANCE_TURN_WINDOW_MS } from '../utterances/turn'
import { parseGatewayBody, parseUploadForm } from '../utterances/validate'

const U1 = 'cuser00000000000000000001'
const CHAT_A = 'cchataaaaaaaaaaaaaaaaaaaa'
const CHAT_B = 'cchatbbbbbbbbbbbbbbbbbbbb'
const NOW = 1_790_000_000_000

let root = ''
const savedRoot = process.env.DATA_ROOT
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'kaiwa-task018-'))
  process.env.DATA_ROOT = root
  // 기록 경로가 뒤에서 도는 보존 정리(실제 DB 조회·갱신)를 이 프로세스에서는 돌리지 않는다.
  globalThis.__kaiwaUtterancePurgeAt = Date.now() + 24 * 60 * 60 * 1000
})
after(async () => {
  process.env.DATA_ROOT = savedRoot
  await rm(root, { recursive: true, force: true })
})

function reasonOf(e: unknown): unknown {
  return e instanceof ApiError ? e.details?.reason : undefined
}

const row = (p: Partial<{ chatId: string | null; chatMessageId: string | null; lessonId: string | null; evaluationItemId: string | null; createdAt: Date }> = {}) => ({
  chatId: null,
  chatMessageId: null,
  lessonId: null,
  evaluationItemId: null,
  createdAt: new Date(NOW - 1_000),
  ...p,
})

test('턴 판정: 같은 방·방 없는 발화(옛 행·방 밖 녹음)는 통과, 다른 방은 409 UTTERANCE_OTHER_CHAT', () => {
  assert.equal(turnUtteranceProblem(row({ chatId: CHAT_A }), CHAT_A, NOW), null)
  assert.equal(turnUtteranceProblem(row({ chatId: null }), CHAT_B, NOW), null)
  const other = turnUtteranceProblem(row({ chatId: CHAT_A }), CHAT_B, NOW)
  assert.ok(other instanceof ApiError)
  assert.deepEqual([other.code, reasonOf(other)], ['CONFLICT', 'UTTERANCE_OTHER_CHAT'])
})

test('턴 판정 순서: 이미 보냄(USED) → 다른 방(OTHER_CHAT) → 10분 지남(EXPIRED)', () => {
  const old = new Date(NOW - UTTERANCE_TURN_WINDOW_MS - 1)
  assert.equal(reasonOf(turnUtteranceProblem(row({ chatId: CHAT_A, chatMessageId: 'm1', createdAt: old }), CHAT_B, NOW)), 'UTTERANCE_USED')
  assert.equal(reasonOf(turnUtteranceProblem(row({ chatId: CHAT_A, createdAt: old }), CHAT_B, NOW)), 'UTTERANCE_OTHER_CHAT')
  assert.equal(reasonOf(turnUtteranceProblem(row({ chatId: CHAT_A, createdAt: old }), CHAT_A, NOW)), 'UTTERANCE_EXPIRED')
  assert.equal(turnUtteranceProblem(row({ createdAt: new Date(NOW - UTTERANCE_TURN_WINDOW_MS) }), CHAT_A, NOW), null, '딱 10분은 통과')
})

test('수락 전 검사: 없음·형식 오류 404(형식 오류는 DB 조회 없음), 다른 방 발화 409, 같은 방은 id·finalText 반환', async (t) => {
  t.after(() => mock.restoreAll())
  const rows: Record<string, { id: string; chatId: string | null; chatMessageId: string | null; lessonId: string | null; evaluationItemId: string | null; createdAt: Date; finalText: string | null }> = {
    uA: { id: 'uA', chatId: CHAT_A, chatMessageId: null, lessonId: null, evaluationItemId: null, createdAt: new Date(NOW - 5_000), finalText: '今日は' },
  }
  const find = mock.method(utteranceDb, 'findForTurn', async (userId: string, id: string) => (userId === U1 ? (rows[id] ?? null) : null))
  await assert.rejects(checkUtteranceForTurn(U1, '../x', CHAT_A, NOW), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  assert.equal(find.mock.callCount(), 0)
  await assert.rejects(checkUtteranceForTurn(U1, 'nope', CHAT_A, NOW), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  await assert.rejects(checkUtteranceForTurn('cuser00000000000000000002', 'uA', CHAT_A, NOW), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  await assert.rejects(checkUtteranceForTurn(U1, 'uA', CHAT_B, NOW), (e: unknown) => reasonOf(e) === 'UTTERANCE_OTHER_CHAT')
  assert.deepEqual(await checkUtteranceForTurn(U1, 'uA', CHAT_A, NOW), { id: 'uA', finalText: '今日は' })
})

test('연결: 성공·고친 글자면 finalSource=USER, 경합(count 0)은 LINK_SKIPPED, unique 위반(P2002)은 UTTERANCE_USED 로 수렴, 그 밖 오류는 그대로', async (t) => {
  t.after(() => mock.restoreAll())
  const calls: unknown[] = []
  let next: () => Promise<number> = async () => 1
  mock.method(utteranceDb, 'link', async (userId: string, id: string, data: unknown) => {
    calls.push({ userId, id, data })
    return next()
  })
  const base = { userId: U1, utterance: { id: 'uA', finalText: '今日は' }, messageId: 'm1' }

  assert.deepEqual(await linkUtteranceToMessage({ ...base, text: '今日は' }), { linked: true, finalSourceUser: false, warning: null })
  assert.deepEqual(calls.at(-1), { userId: U1, id: 'uA', data: { chatMessageId: 'm1' } })
  assert.deepEqual(await linkUtteranceToMessage({ ...base, text: '今日は!' }), { linked: true, finalSourceUser: true, warning: null })
  assert.deepEqual(calls.at(-1), { userId: U1, id: 'uA', data: { chatMessageId: 'm1', finalText: '今日は!', finalSource: 'USER' } })

  next = async () => 0
  assert.deepEqual(await linkUtteranceToMessage({ ...base, text: '今日は' }), { linked: false, finalSourceUser: false, warning: 'UTTERANCE_LINK_SKIPPED' })
  next = async () => {
    throw Object.assign(new Error('Unique constraint failed on the constraint: `Utterance_chatMessageId_key`'), { code: 'P2002' })
  }
  assert.deepEqual(await linkUtteranceToMessage({ ...base, text: '今日は!' }), { linked: false, finalSourceUser: false, warning: 'UTTERANCE_USED' })
  next = async () => {
    throw Object.assign(new Error('db down'), { code: 'P1001' })
  }
  await assert.rejects(linkUtteranceToMessage({ ...base, text: '今日は' }), /db down/)
})

function pcmWav(ms: number): Buffer {
  const data = Buffer.alloc(Math.round((16_000 * 2 * ms) / 1000))
  const h = Buffer.alloc(44)
  h.write('RIFF', 0, 'ascii')
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8, 'ascii')
  h.write('fmt ', 12, 'ascii')
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(16_000, 24)
  h.writeUInt32LE(32_000, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36, 'ascii')
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

function captureCreate(fail?: () => never) {
  const created: Array<Record<string, unknown>> = []
  mock.method(utteranceDb, 'realtimeConnection', async () => ({ id: 'ec1', key: 'rt-key', connectionType: 'ONDEVICE' as const }))
  mock.method(utteranceDb, 'create', async (data: Record<string, unknown>) => {
    if (fail) fail()
    created.push(data)
    return { id: String(data.id) }
  })
  mock.method(utteranceDb, 'remove', async () => ({}))
  return created
}

const fkMissing = (): never => {
  throw Object.assign(new Error('Foreign key constraint violated: `Utterance_chatId_fkey`'), { code: 'P2003' })
}

test('gateway 콜백 등록: 티켓 chatId 를 Utterance.chatId 로 저장, 없으면 null, 방·사용자가 사라졌으면(P2003) 404', async (t) => {
  t.after(() => mock.restoreAll())
  const created = captureCreate()
  const body = { userId: U1, durationMs: 1200, realtimeEngine: 'rt-key', realtimeText: 'こんにちは' }
  const withChat = await registerGatewayUtterance(parseGatewayBody({ ...body, chatId: CHAT_A }))
  assert.equal(created[0].chatId, CHAT_A)
  assert.equal(created[0].id, withChat.utteranceId)
  await registerGatewayUtterance(parseGatewayBody(body))
  assert.equal(created[1].chatId, null)

  mock.restoreAll()
  captureCreate(fkMissing)
  await assert.rejects(registerGatewayUtterance(parseGatewayBody({ ...body, chatId: CHAT_B })), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
})

test('#21 업로드: 요청 chatId 를 저장, 없으면 null, 방이 사라졌으면(P2003) 404 + 올린 wav 삭제', async (t) => {
  t.after(() => mock.restoreAll())
  const created = captureCreate()
  const form = (chatId?: string) => {
    const f = new FormData()
    f.set('audio', new Blob([new Uint8Array(pcmWav(500))], { type: 'audio/wav' }), 'u.wav')
    f.set('text', 'はい')
    f.set('realtimeConnectionKey', 'ec1')
    if (chatId) f.set('chatId', chatId)
    return f
  }
  const a = await recordUploadedUtterance(U1, await parseUploadForm(form(CHAT_A)))
  assert.equal(created[0].chatId, CHAT_A)
  assert.equal(created[0].id, a.utteranceId)
  await recordUploadedUtterance(U1, await parseUploadForm(form()))
  assert.equal(created[1].chatId, null)

  mock.restoreAll()
  captureCreate(fkMissing)
  const month = (await readdir(join(root, 'users', U1, 'utterances')))[0]
  const before = (await readdir(join(root, 'users', U1, 'utterances', month))).length
  await assert.rejects(recordUploadedUtterance(U1, await parseUploadForm(form(CHAT_B))), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  assert.equal((await readdir(join(root, 'users', U1, 'utterances', month))).length, before, '실패한 업로드의 wav 는 남지 않는다')
})
