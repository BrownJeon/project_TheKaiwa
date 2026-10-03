import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callClaudeDetailed, ClaudeCliError, ClaudeCliTimeoutError } from '../adapters/llm/claudeCli'
import { adapterCallOptions } from '../llm'
import { adapterRetryOptions, LLM_TASKS, type LlmTask } from '../router/tasks'

/**
 * 가짜 CLI — 시스템 프롬프트의 `HANG_FIRST:<파일>`(첫 호출만 무응답) · `HANG_ALWAYS` 표식으로 동작을 바꾼다.
 * 호출 횟수는 `<파일>.calls` 에 한 줄씩 남긴다(프로세스가 달라 파일로 센다). `ORDER:<파일>:<태그>` 가 있으면 시작 순서를 `<파일>` 에 태그로 남긴다.
 */
const FAKE = `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
const sp = args.includes('--system-prompt') ? args[args.indexOf('--system-prompt') + 1] : ''
let buf = ''
process.stdin.on('data', (d) => (buf += d))
process.stdin.on('end', () => {
  const o = /ORDER:(\\S+?):(\\w+)/.exec(sp)
  if (o) fs.appendFileSync(o[1], o[2] + '\\n')
  const m = /(HANG_FIRST|HANG_ALWAYS):(\\S+)/.exec(sp)
  if (m) {
    fs.appendFileSync(m[2] + '.calls', 'x\\n')
    const first = m[1] === 'HANG_FIRST' && !fs.existsSync(m[2])
    if (m[1] === 'HANG_FIRST') fs.writeFileSync(m[2], '1')
    if (m[1] === 'HANG_ALWAYS' || first) { setTimeout(() => {}, 60000); return }
  }
  process.stdout.write('{"ok":true}')
})
`

let dir = ''
const savedPath = process.env.CLAUDE_CLI_PATH
const calls = (f: string) => (existsSync(f + '.calls') ? readFileSync(f + '.calls', 'utf8').split('\n').filter(Boolean).length : 0)

async function captureWarn<T>(fn: () => Promise<T>): Promise<{ result: PromiseSettledResult<T>; warns: string[] }> {
  const warns: string[] = []
  const orig = console.warn
  console.warn = (...a: unknown[]) => void warns.push(a.map(String).join(' '))
  try {
    const result = await fn().then(
      (value) => ({ status: 'fulfilled', value }) as const,
      (reason) => ({ status: 'rejected', reason }) as const,
    )
    return { result, warns }
  } finally {
    console.warn = orig
  }
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaiwa-fake-claude-timeout-'))
  const bin = join(dir, 'claude')
  writeFileSync(bin, FAKE)
  chmodSync(bin, 0o755)
  process.env.CLAUDE_CLI_PATH = bin
})
after(() => {
  process.env.CLAUDE_CLI_PATH = savedPath
  rmSync(dir, { recursive: true, force: true })
})

const base = { model: 'sonnet', priority: 'batch' as const, timeoutMs: 700 }
const a11 = () => ({ label: 'reviewDecision', ...adapterRetryOptions('reviewDecision') })

test('옵트인 + 1차 타임아웃 → 2차 성공: 정상 결과·호출 2회·타임아웃 로그 1줄(원문 없음)', async () => {
  const f = join(dir, 'a')
  const { result, warns } = await captureWarn(() =>
    callClaudeDetailed('학습자-비밀-문장', { ...base, systemPrompt: `HANG_FIRST:${f}`, ...a11() }),
  )
  assert.equal(result.status, 'fulfilled')
  if (result.status === 'fulfilled') assert.equal(result.value.text, '{"ok":true}')
  assert.equal(calls(f), 2)
  const t = warns.filter((w) => w.includes('[claudeCli] 타임아웃'))
  assert.equal(t.length, 1)
  assert.match(t[0], /^\[claudeCli\] 타임아웃 — task=reviewDecision model=sonnet promptChars=\d+ timeoutMs=700 attempt=1 maxAttempts=2 retry=예$/)
  assert.ok(!warns.join('\n').includes('학습자-비밀'), '프롬프트 원문은 로그에 없다')
})

test('옵트인 없음(다른 task) + 타임아웃 → 호출 1회·ClaudeCliTimeoutError·로그 1줄', async () => {
  const f = join(dir, 'b')
  const { result, warns } = await captureWarn(() =>
    callClaudeDetailed('x', { ...base, systemPrompt: `HANG_ALWAYS:${f}`, label: 'reviewMix', ...adapterRetryOptions('reviewMix') }),
  )
  assert.equal(result.status, 'rejected')
  if (result.status === 'rejected') assert.ok(result.reason instanceof ClaudeCliTimeoutError)
  assert.equal(calls(f), 1)
  const t = warns.filter((w) => w.includes('[claudeCli] 타임아웃'))
  assert.equal(t.length, 1)
  assert.match(t[0], /^\[claudeCli\] 타임아웃 — task=reviewMix .* attempt=1 maxAttempts=1 retry=아니오$/)
  assert.ok(!warns.some((w) => w.includes('일시적 실패')), '재시도 없음 — 일반 재시도 줄도 없다')
})

test('옵트인 + 2회 모두 타임아웃 → ClaudeCliTimeoutError throw·호출 2회·로그 2줄', async () => {
  const f = join(dir, 'c')
  const { result, warns } = await captureWarn(() =>
    callClaudeDetailed('x', { ...base, systemPrompt: `HANG_ALWAYS:${f}`, ...a11() }),
  )
  assert.equal(result.status, 'rejected')
  if (result.status === 'rejected') assert.ok(result.reason instanceof ClaudeCliTimeoutError)
  assert.equal(calls(f), 2)
  const t = warns.filter((w) => w.includes('[claudeCli] 타임아웃'))
  assert.equal(t.length, 2)
  assert.match(t[0], /attempt=1 maxAttempts=2 retry=예$/)
  assert.match(t[1], /attempt=2 maxAttempts=2 retry=아니오$/)
  assert.ok(!warns.some((w) => w.includes('일시적 실패')), '타임아웃 재시도는 타임아웃 줄 하나로 표시한다(일반 줄 중복 없음)')
})

test('task 표: retryOnTimeout 은 reviewDecision(A11) 하나만 켜져 있다', () => {
  const on = (Object.keys(LLM_TASKS) as LlmTask[]).filter((t) => adapterRetryOptions(t).retryOnTimeout === true)
  assert.deepEqual(on, ['reviewDecision'])
  assert.deepEqual(adapterRetryOptions('reviewDecision'), { maxAttempts: 2, retryOnTimeout: true })
  for (const t of Object.keys(LLM_TASKS) as LlmTask[]) if (t !== 'reviewDecision') assert.deepEqual(adapterRetryOptions(t), { maxAttempts: 1 })
})

test('M-1 타임아웃 재시도는 큐 꼬리로 재진입한다 — A11 1차 무응답 중 들어온 interactive 가 A11 2차보다 먼저 시작', async () => {
  const f = join(dir, 'd')
  const order = join(dir, 'd.order')
  writeFileSync(order, '')
  const batch = callClaudeDetailed('x', { ...base, systemPrompt: `HANG_FIRST:${f} ORDER:${order}:A11`, ...a11() })
  // A11 1차가 실제로 시작한 뒤에 interactive 를 넣는다(슬롯은 1차가 쥐고 있다).
  for (let i = 0; i < 100 && !readFileSync(order, 'utf8').includes('A11'); i++) await new Promise((r) => setTimeout(r, 20))
  const interactive = callClaudeDetailed('y', { model: 'sonnet', priority: 'interactive', timeoutMs: 5000, systemPrompt: `ORDER:${order}:INTERACTIVE` })
  const [b, i] = await Promise.all([batch, interactive])
  assert.equal(b.text, '{"ok":true}')
  assert.equal(i.text, '{"ok":true}')
  assert.deepEqual(readFileSync(order, 'utf8').split('\n').filter(Boolean), ['A11', 'INTERACTIVE', 'A11'])
})

test('L-6 retryOnTimeout 과 onTextDelta 는 같이 쓸 수 없다 — 프로세스를 띄우기 전에 ClaudeCliError', async () => {
  const f = join(dir, 'e')
  await assert.rejects(
    () => callClaudeDetailed('x', { ...base, systemPrompt: `HANG_ALWAYS:${f}`, ...a11(), onTextDelta: () => {} }),
    (e: unknown) => e instanceof ClaudeCliError && !(e instanceof ClaudeCliTimeoutError),
  )
  assert.equal(calls(f), 0)
})

test('M-2 연결: 호출 옵션 조립이 task 표의 재시도·label 을 실제로 싣는다(A11 = 2시도·타임아웃 재시도, 다른 task = 1시도)', () => {
  const sig = new AbortController().signal
  const a = adapterCallOptions({ model: 'sonnet' }, { task: 'reviewDecision', signal: sig }, 60_000, 'batch')
  assert.equal(a.maxAttempts, 2)
  assert.equal(a.retryOnTimeout, true)
  assert.equal(a.label, 'reviewDecision')
  assert.equal(a.timeoutMs, 60_000)
  assert.equal(a.priority, 'batch')
  assert.equal(a.model, 'sonnet')
  assert.equal(a.signal, sig)
  for (const t of Object.keys(LLM_TASKS) as LlmTask[]) {
    if (t === 'reviewDecision') continue
    const o = adapterCallOptions({}, { task: t }, 1000, 'interactive')
    assert.equal(o.maxAttempts, 1, t)
    assert.equal(o.retryOnTimeout, undefined, t)
    assert.equal(o.label, t)
  }
})
