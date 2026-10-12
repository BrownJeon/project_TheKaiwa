import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callClaudeDetailed, ClaudeCliExecError, drainWarmPool, prewarmClaude } from '../adapters/llm/claudeCli'

/**
 * 가짜 CLI — 시스템 프롬프트의 `CFG:<json 경로>` 가 가리키는 설정대로 stdout/stderr 바이트를 **n바이트씩 끊어서**(조각 사이 4ms) 내고 종료한다.
 * 한글·일본어(3바이트)·이모지(4바이트)가 조각 경계에 걸리는 상황을 실제 자식 프로세스 파이프로 만든다(어댑터의 `data` 이벤트 경로 그대로).
 * stdin 이 끝나야 출력을 시작한다 — cold(stdin 프롬프트)와 예열(stream-json 메시지 1줄 뒤 stdin 종료) 모두 같은 규약.
 */
const FAKE = `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
const sp = args.includes('--system-prompt') ? args[args.indexOf('--system-prompt') + 1] : ''
const m = /CFG:(\\S+)/.exec(sp)
if (!m) { process.stderr.write('no cfg'); process.exit(9) }
const cfg = JSON.parse(fs.readFileSync(m[1], 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const write = (stream, buf) => new Promise((r) => stream.write(buf, r))
async function emit(stream, b64) {
  if (!b64) return
  const all = Buffer.from(b64, 'base64')
  for (let i = 0; i < all.length; i += cfg.chunk) {
    await write(stream, all.subarray(i, i + cfg.chunk))
    await sleep(4)
  }
}
process.stdin.resume()
process.stdin.on('end', async () => {
  await emit(process.stderr, cfg.stderr)
  await emit(process.stdout, cfg.stdout)
  process.exit(cfg.exit || 0)
})
`

interface Cfg {
  stdout?: Buffer
  stderr?: Buffer
  /** 조각 크기(바이트). */
  chunk: number
  exit?: number
}

let dir = ''
let seq = 0
const savedPath = process.env.CLAUDE_CLI_PATH
const FFFD = '�'

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaiwa-fake-claude-utf8-'))
  const bin = join(dir, 'claude')
  writeFileSync(bin, FAKE)
  chmodSync(bin, 0o755)
  process.env.CLAUDE_CLI_PATH = bin
})
afterEach(async () => {
  drainWarmPool()
  await new Promise((r) => setTimeout(r, 50))
})
after(() => {
  process.env.CLAUDE_CLI_PATH = savedPath
  rmSync(dir, { recursive: true, force: true })
})

/** 설정을 파일로 쓰고 시스템 프롬프트 표식을 돌려준다. */
function cfgPrompt(c: Cfg): string {
  const f = join(dir, `cfg-${++seq}.json`)
  writeFileSync(f, JSON.stringify({ chunk: c.chunk, exit: c.exit ?? 0, stdout: c.stdout?.toString('base64') ?? '', stderr: c.stderr?.toString('base64') ?? '' }))
  return `CFG:${f}`
}

const base = { model: 'haiku', timeoutMs: 15_000, maxAttempts: 1 }
// 1바이트는 모든 멀티바이트 글자를 가른다. 2바이트는 3·4바이트 글자를 시작 위치와 상관없이 가른다.
const CHUNKS = [1, 2]

/** 청크 경계에 걸리면 깨지기 쉬운 글자를 골고루 — 한글(3바이트)·일본어(3바이트)·이모지(4바이트)·2바이트(é). */
const SAMPLE = '훨씬 많이 しゃべりましょう 😀 café 🎌 終わり'

for (const chunk of CHUNKS) {
  test(`text 출력: 한글·일본어·이모지가 ${chunk}바이트 조각에 걸려도 그대로 복원된다(U+FFFD 없음)`, async () => {
    const r = await callClaudeDetailed('入力', { ...base, systemPrompt: cfgPrompt({ chunk, stdout: Buffer.from(`{"replyJa":"${SAMPLE}"}`, 'utf8') }) })
    assert.equal(r.text, `{"replyJa":"${SAMPLE}"}`)
    assert.ok(!r.text.includes(FFFD))
  })

  test(`stream-json 출력(onTextDelta): delta·result 모두 ${chunk}바이트 조각에서 복원된다`, async () => {
    const parts = ['훨씬 ', '많이 ', 'しゃべり', 'ましょう😀', ' café']
    const full = parts.join('')
    const lines = [
      { type: 'system', subtype: 'init' },
      ...parts.map((text) => ({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } } })),
      { type: 'result', subtype: 'success', is_error: false, result: full },
    ]
    const stdout = Buffer.from(`${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8')
    const deltas: string[] = []
    const events: string[] = []
    const r = await callClaudeDetailed('入力', {
      ...base,
      systemPrompt: cfgPrompt({ chunk, stdout }),
      onTextDelta: (d) => deltas.push(d),
      onEvent: (e) => events.push(JSON.stringify(e)),
    })
    assert.equal(r.text, full)
    assert.deepEqual(deltas, parts)
    assert.ok(!events.join('').includes(FFFD), 'onEvent 로 흘러간 이벤트에도 깨진 글자가 없다')
  })

  test(`stderr: 비정상 종료 메시지의 한글·일본어가 ${chunk}바이트 조각에서 복원된다`, async () => {
    const msg = '오류: 연결이 끊겼어요 エラー 😀'
    await assert.rejects(
      () => callClaudeDetailed('入力', { ...base, systemPrompt: cfgPrompt({ chunk, stderr: Buffer.from(msg, 'utf8'), exit: 2 }) }),
      (e: unknown) => {
        assert.ok(e instanceof ClaudeCliExecError)
        assert.ok(e.message.includes(msg), e.message)
        assert.ok(!e.message.includes(FFFD))
        return true
      },
    )
  })
}

test('예열 HIT 경로: 대기 프로세스를 꺼낸 뒤의 출력도 1바이트 조각에서 복원된다', async () => {
  const parts = ['はい。', '훨씬 ', '많이😀']
  const full = parts.join('')
  const lines = [
    { type: 'system', subtype: 'init' },
    ...parts.map((text) => ({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } } })),
    { type: 'result', subtype: 'success', is_error: false, result: full },
  ]
  const opts = { ...base, systemPrompt: cfgPrompt({ chunk: 1, stdout: Buffer.from(`${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8') }) }
  assert.equal(prewarmClaude(opts, { maxIdle: 2, idleTtlMs: 60_000 }), 'SPAWNED')
  await new Promise((r) => setTimeout(r, 200))
  const deltas: string[] = []
  const r = await callClaudeDetailed('入力', { ...opts, onTextDelta: (d) => deltas.push(d) })
  assert.equal(r.warm, 'HIT')
  assert.equal(r.text, full)
  assert.deepEqual(deltas, parts)
})

// 정상 종료한 스트림은 끝이 잘린 시퀀스로 끝나지 않는다. 그래도 끝이 잘려 있다면(자식이 글자 중간에서 끊김) 예전처럼(조각 단위 디코딩)
// 마지막에 U+FFFD 한 글자가 남아야 한다 — 디코더를 비우지 않으면 그 자리가 조용히 사라진다.
test('끝이 잘린 stdout: 남은 바이트를 비워 U+FFFD 로 남긴다(조각 크기와 무관)', async () => {
  const tail = Buffer.concat([Buffer.from('abc', 'utf8'), Buffer.from([0xe3, 0x81])]) // 'あ'(E3 81 82)의 앞 2바이트
  for (const chunk of [1, 2, 100]) {
    const r = await callClaudeDetailed('入力', { ...base, systemPrompt: cfgPrompt({ chunk, stdout: tail }) })
    assert.equal(r.text, `abc${FFFD}`, `chunk=${chunk}`)
  }
})

test('끝이 잘린 stderr: 남은 바이트를 비워 U+FFFD 로 남긴다', async () => {
  const stderr = Buffer.concat([Buffer.from('エラー', 'utf8'), Buffer.from([0xe3, 0x81])])
  for (const chunk of [1, 100]) {
    await assert.rejects(
      () => callClaudeDetailed('入力', { ...base, systemPrompt: cfgPrompt({ chunk, stderr, exit: 2 }) }),
      (e: unknown) => {
        assert.ok(e instanceof ClaudeCliExecError)
        assert.ok(e.message.endsWith(`エラー${FFFD}`), `chunk=${chunk}: ${e.message}`)
        return true
      },
    )
  }
})
