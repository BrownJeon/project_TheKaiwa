import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildClaudeArgs, callClaudeDetailed, ClaudeCliAbortedError, drainWarmPool, prewarmClaude, textDeltaOf, warmPoolSnapshot } from '../adapters/llm/claudeCli'

/**
 * 가짜 CLI — 실제 claude 대신 argv·stdin 규약만 흉내 낸다(stream-json 입력이면 메시지 1줄, 아니면 stdin 전체).
 * 시스템 프롬프트에 든 표식으로 동작을 바꾼다: DIE_ON_START(바로 죽음) · SILENT_WARM(예열 경로에서만 출력 없이 종료).
 * 결과 텍스트에 자기 pid 를 넣어 "프로세스당 1요청" 을 확인한다.
 */
const FAKE = `#!/usr/bin/env node
const args = process.argv.slice(2)
const sp = args.includes('--system-prompt') ? args[args.indexOf('--system-prompt') + 1] : ''
const streamIn = args.includes('--input-format')
const partial = args.includes('--include-partial-messages')
const streamOut = args.includes('--output-format')
if (sp.includes('DIE_ON_START')) process.exit(3)
let buf = ''
process.stdin.on('data', (d) => (buf += d))
process.stdin.on('end', () => {
  if (streamIn) {
    const line = buf.split('\\n').find((l) => l.trim())
    if (!line) process.exit(0)
    JSON.parse(line)
    if (sp.includes('SILENT_WARM')) process.exit(0)
  }
  const reply = '{"conversation":{"replyJa":"はい。' + process.pid + '"}}'
  if (sp.includes('SLOW') && streamOut) {
    // 첫 조각(자기 pid)만 내고 오래 멈춘다 — 호출자가 abort 해야 끝난다.
    process.stdout.write(JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'pid=' + process.pid } } }) + '\\n')
    setTimeout(() => {}, 60000)
    return
  }
  if (!streamOut) { process.stdout.write(reply); return }
  const out = [{ type: 'system', subtype: 'init' }]
  if (partial) for (const t of [reply.slice(0, 12), reply.slice(12)]) out.push({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } } })
  out.push({ type: 'result', subtype: 'success', is_error: false, result: reply })
  process.stdout.write(out.map((o) => JSON.stringify(o)).join('\\n') + '\\n')
})
`

let dir = ''
const savedPath = process.env.CLAUDE_CLI_PATH
const limits = { maxIdle: 2, idleTtlMs: 60_000 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const pidOf = (text: string) => Number(/はい。(\d+)/.exec(text)?.[1])

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaiwa-fake-claude-'))
  const bin = join(dir, 'claude')
  writeFileSync(bin, FAKE)
  chmodSync(bin, 0o755)
  process.env.CLAUDE_CLI_PATH = bin
})
afterEach(async () => {
  drainWarmPool()
  await sleep(50)
})
after(() => {
  process.env.CLAUDE_CLI_PATH = savedPath
  rmSync(dir, { recursive: true, force: true })
})

test('argv: 예열 형식은 stream-json 입출력 + 부분 메시지, stream-json 입력은 stream-json 출력에서만', () => {
  const args = buildClaudeArgs('', { model: 'haiku', outputFormat: 'stream-json', includePartialMessages: true, inputFormat: 'stream-json' })
  assert.ok(args.includes('--include-partial-messages'))
  assert.equal(args[args.indexOf('--input-format') + 1], 'stream-json')
  assert.ok(args.includes('--verbose'))
  assert.throws(() => buildClaudeArgs('', { inputFormat: 'stream-json' }))
  assert.ok(!buildClaudeArgs('x', { includePartialMessages: true }).includes('--include-partial-messages'), 'text 출력에는 붙지 않는다')
})

test('textDeltaOf: content_block_delta/text_delta 만 조각으로 본다', () => {
  assert.equal(textDeltaOf({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'あ' } } }), 'あ')
  assert.equal(textDeltaOf({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{' } } }), null)
  assert.equal(textDeltaOf({ type: 'assistant' }), null)
})

test('cold + onTextDelta: 조각을 흘리고 결과는 result 이벤트 기준, 원하지 않은 키는 warm=OFF', async () => {
  const deltas: string[] = []
  const r = await callClaudeDetailed('プロンプト', { model: 'haiku', systemPrompt: 'P-cold', onTextDelta: (d) => deltas.push(d), maxAttempts: 1, timeoutMs: 10_000 })
  assert.equal(r.warm, 'OFF')
  assert.equal(deltas.join(''), r.text)
  assert.ok(r.firstDeltaMs !== null && r.firstDeltaMs >= 0)
})

test('예열 HIT: 대기 프로세스를 쓰고(프로세스당 1요청) 끝나면 같은 키를 다시 채운다', async () => {
  const opts = { model: 'haiku', systemPrompt: 'P-warm', timeoutMs: 10_000, maxAttempts: 1 }
  assert.equal(prewarmClaude(opts, limits), 'SPAWNED')
  assert.equal(prewarmClaude(opts, limits), 'EXISTS', '키마다 대기 1개')
  const idlePid = warmPoolSnapshot().pids[0]
  await sleep(200)
  const deltas: string[] = []
  const r1 = await callClaudeDetailed('一回目', { ...opts, onTextDelta: (d) => deltas.push(d) })
  assert.equal(r1.warm, 'HIT')
  assert.equal(pidOf(r1.text), idlePid, '대기하던 바로 그 프로세스')
  assert.equal(deltas.join(''), r1.text)
  const snap = warmPoolSnapshot()
  assert.equal(snap.idle, 1, '쓴 뒤 다시 채움')
  assert.notEqual(snap.pids[0], idlePid)
  await sleep(200)
  const r2 = await callClaudeDetailed('二回目', opts)
  assert.equal(r2.warm, 'HIT')
  assert.notEqual(pidOf(r2.text), pidOf(r1.text), '같은 프로세스를 두 번 쓰지 않는다')
  await sleep(100)
  assert.ok(!alive(pidOf(r1.text)) && !alive(pidOf(r2.text)), '쓴 프로세스는 끝난다')
})

test('상한: 전체 대기 2개를 넘으면 가장 오래된 것을 내린다', async () => {
  prewarmClaude({ model: 'haiku', systemPrompt: 'A' }, limits)
  await sleep(20)
  prewarmClaude({ model: 'haiku', systemPrompt: 'B' }, limits)
  const [pa] = warmPoolSnapshot().pids
  await sleep(20)
  prewarmClaude({ model: 'haiku', systemPrompt: 'C' }, limits)
  const snap = warmPoolSnapshot()
  assert.equal(snap.idle, 2)
  assert.ok(!snap.pids.includes(pa))
  await sleep(300)
  assert.ok(!alive(pa), '내린 프로세스는 죽는다')
  assert.equal(prewarmClaude({ model: 'haiku', systemPrompt: 'D' }, { maxIdle: 0, idleTtlMs: 1000 }), 'DISABLED')
})

test('유휴 TTL: 지나면 대기 프로세스를 내리고(0개) 다시 채우지 않는다', async () => {
  prewarmClaude({ model: 'haiku', systemPrompt: 'TTL' }, { maxIdle: 2, idleTtlMs: 150 })
  const [pid] = warmPoolSnapshot().pids
  await sleep(600)
  assert.equal(warmPoolSnapshot().idle, 0)
  assert.ok(!alive(pid))
})

test('시작 직후 죽는 예열은 버리고 잠시 쉬며(BACKOFF), 요청은 cold 로 돈다', async () => {
  assert.equal(prewarmClaude({ model: 'haiku', systemPrompt: 'DIE_ON_START' }, limits), 'SPAWNED')
  await sleep(400)
  assert.equal(warmPoolSnapshot().idle, 0)
  assert.equal(prewarmClaude({ model: 'haiku', systemPrompt: 'OTHER' }, limits), 'BACKOFF')
})

test('예열 프로세스가 메시지를 받고 아무것도 내지 않으면 FALLBACK → cold 로 성공', async () => {
  const opts = { model: 'haiku', systemPrompt: 'SILENT_WARM', timeoutMs: 10_000, maxAttempts: 1 }
  prewarmClaude(opts, limits)
  await sleep(200)
  const r = await callClaudeDetailed('入力', opts)
  assert.equal(r.warm, 'FALLBACK')
  assert.match(r.text, /はい。\d+/)
})

test('drain 뒤 살아 있는 예열 프로세스 0', async () => {
  prewarmClaude({ model: 'haiku', systemPrompt: 'X1' }, limits)
  prewarmClaude({ model: 'haiku', systemPrompt: 'X2' }, limits)
  const pids = warmPoolSnapshot().pids
  assert.equal(pids.length, 2)
  drainWarmPool()
  await sleep(300)
  assert.ok(pids.every((p) => !alive(p)))
  assert.equal(warmPoolSnapshot().idle, 0)
})

async function abortMidway(opts: Record<string, unknown>): Promise<{ pid: number; err: unknown; ms: number }> {
  const ac = new AbortController()
  let pid = 0
  const t0 = Date.now()
  const p = callClaudeDetailed('入力', {
    model: 'haiku',
    timeoutMs: 30_000,
    maxAttempts: 1,
    ...opts,
    signal: ac.signal,
    onTextDelta: (d) => {
      pid = Number(/pid=(\d+)/.exec(d)?.[1] ?? 0)
      ac.abort()
    },
  })
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  return { pid, err, ms: Date.now() - t0 }
}

test('abort(수락 거절): 실행 중인 cold 자식을 죽이고 AbortError(재시도·폴백 없음)', async () => {
  const r = await abortMidway({ systemPrompt: 'SLOW-cold' })
  assert.ok(r.err instanceof ClaudeCliAbortedError && (r.err as Error).name === 'AbortError')
  assert.ok(r.pid > 0)
  await sleep(300)
  assert.ok(!alive(r.pid), '자식 프로세스가 죽었다')
  assert.ok(r.ms < 5_000)
})

test('abort: 예열에서 꺼낸 자식도 죽이고, 다음 턴용으로 다시 채운다', async () => {
  prewarmClaude({ model: 'haiku', systemPrompt: 'SLOW-warm' }, limits)
  await sleep(200)
  const idle = warmPoolSnapshot().pids[0]
  const r = await abortMidway({ systemPrompt: 'SLOW-warm' })
  assert.ok(r.err instanceof ClaudeCliAbortedError)
  assert.equal(r.pid, idle, '예열 프로세스를 썼다')
  await sleep(300)
  assert.ok(!alive(r.pid))
  assert.equal(warmPoolSnapshot().idle, 1, '원하던 키라 다시 채움')
})

test('abort: 큐에서 기다리는 동안 이미 취소됐으면 프로세스를 띄우지 않는다', async () => {
  const ac = new AbortController()
  ac.abort()
  const before = warmPoolSnapshot().stats.spawned
  const err = await callClaudeDetailed('入力', { model: 'haiku', systemPrompt: 'never', signal: ac.signal, maxAttempts: 1 }).then(
    () => null,
    (e: unknown) => e,
  )
  assert.ok(err instanceof ClaudeCliAbortedError)
  assert.equal(warmPoolSnapshot().stats.spawned, before)
  assert.equal(warmPoolSnapshot().active, 0)
})
