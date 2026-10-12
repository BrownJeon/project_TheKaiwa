import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callClaudeDetailed, ClaudeCliAbortedError, ClaudeCliExecError, ClaudeCliTimeoutError, type ClaudeCliOptions, type ClaudeQueueLane } from '../adapters/llm/claudeCli'
import { adapterCallOptions, completeJson, requestLane } from '../llm'
import { routerDeps, type ResolvedConnection } from '../router'
import { LLM_TASKS, type LlmTask } from '../router/tasks'

/**
 * task-064 ASK 전용 슬롯 — 공용 슬롯(interactive·batch)과 ASK 슬롯이 서로 기다리지 않는지, 슬롯마다 동시성 1·FIFO 인지,
 * 실패·취소·타임아웃 뒤 슬롯이 풀리는지, 타임아웃 재진입이 같은 레인 꼬리로 가는지 본다.
 *
 * 실제 claude 는 띄우지 않는다 — `CLAUDE_CLI_PATH` 로 가짜 CLI(node 스크립트)를 주입한다(claudeTimeoutRetry.test 와 같은 방식).
 * 가짜 CLI 는 시스템 프롬프트의 표식으로 동작을 바꾼다:
 *   `LOG:<파일>:<태그>` 시작·끝을 `start:<태그>`·`end:<태그>` 줄로 남긴다 · `GATE:<파일>` 그 파일이 생길 때까지 붙잡고 있다 ·
 *   `HANG` 끝까지 무응답(타임아웃) · `HANG_FIRST:<파일>` 첫 호출만 무응답 · `FAIL` exit 1.
 */
const FAKE = String.raw`#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
const sp = args.includes('--system-prompt') ? args[args.indexOf('--system-prompt') + 1] : ''
const log = /LOG:(\S+?):(\w+)/.exec(sp)
const note = (ev) => { if (log) fs.appendFileSync(log[1], ev + ':' + log[2] + '\n') }
// 타임아웃·취소로 죽을 때도 끝을 남긴다(동시 실행 수 계산용).
process.on('SIGTERM', () => { note('end'); process.exit(143) })
// 시험이 중간에 실패해 문이 안 열리고 부모도 먼저 끝나면 고아로 남지 않게.
setTimeout(() => process.exit(3), 15000).unref()
process.stdin.on('data', () => {})
process.stdin.on('end', () => {
  note('start')
  const done = () => { note('end'); process.stdout.write('{"ok":true}') }
  if (/(^|\s)FAIL(\s|$)/.test(sp)) { note('end'); process.stderr.write('boom'); process.exit(1) }
  const hf = /HANG_FIRST:(\S+)/.exec(sp)
  if (hf) { const first = !fs.existsSync(hf[1]); fs.writeFileSync(hf[1], '1'); if (first) { setTimeout(() => {}, 60000); return } }
  if (/(^|\s)HANG(\s|$)/.test(sp)) { setTimeout(() => {}, 60000); return }
  const g = /GATE:(\S+)/.exec(sp)
  if (g) { const t = setInterval(() => { if (fs.existsSync(g[1])) { clearInterval(t); done() } }, 10); return }
  done()
})
`

let dir = ''
let seq = 0
const savedPath = process.env.CLAUDE_CLI_PATH

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'kaiwa-fake-claude-asklane-'))
  const bin = join(dir, 'claude')
  writeFileSync(bin, FAKE)
  chmodSync(bin, 0o755)
  process.env.CLAUDE_CLI_PATH = bin
})
after(() => {
  process.env.CLAUDE_CLI_PATH = savedPath
  rmSync(dir, { recursive: true, force: true })
})

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const fresh = (name: string) => join(dir, `${name}-${++seq}`)
const events = (log: string): string[] => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [])
const open = (gate: string) => writeFileSync(gate, '1')

async function waitFor(cond: () => boolean, what: string, ms = 5_000): Promise<void> {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error(`기다림 초과: ${what}`)
    await sleep(10)
  }
}

/** 정해진 시간 안에 끝나야 하는 약속 — 다른 슬롯을 기다리고 있으면 여기서 실패한다. */
async function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: NodeJS.Timeout | undefined
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`${ms}ms 안에 끝나지 않음: ${what}`)), ms)))])
  } finally {
    clearTimeout(t)
  }
}

/** 거절될 약속을 미리 받아 둔다(처리되지 않은 거절 경고 방지). */
function settle<T>(p: Promise<T>): Promise<PromiseSettledResult<T>> {
  return p.then(
    (value) => ({ status: 'fulfilled', value }) as const,
    (reason) => ({ status: 'rejected', reason }) as const,
  )
}

/** `markers` 는 가짜 CLI 표식(LOG 는 자동으로 붙는다). 재시도는 기본 끔(시도 1회) — 필요한 시험만 덮어쓴다. */
function call(lane: ClaudeQueueLane, log: string, tag: string, markers = '', extra: ClaudeCliOptions = {}) {
  return callClaudeDetailed(`q-${tag}`, { model: 'sonnet', priority: lane, timeoutMs: 5_000, maxAttempts: 1, systemPrompt: `LOG:${log}:${tag} ${markers}`.trim(), label: `lane-${tag}`, ...extra })
}

/** 이벤트 줄에서 태그 그룹별 최대 동시 실행 수. */
function maxConcurrent(ev: string[], inGroup: (tag: string) => boolean): number {
  let cur = 0
  let max = 0
  for (const line of ev) {
    const [kind, tag] = line.split(':')
    if (!inGroup(tag)) continue
    cur += kind === 'start' ? 1 : -1
    max = Math.max(max, cur)
  }
  return max
}
const isShared = (t: string) => t.startsWith('I') || t.startsWith('B')
const isAsk = (t: string) => t.startsWith('Q')

// ── (a) 두 슬롯은 서로 기다리지 않는다 ─────────────────────────────────────────

test('(a-1) 공용 슬롯이 interactive 로 막혀 있어도 ASK 는 즉시 시작·완료한다 — 공용 슬롯의 batch 는 그동안 시작하지 않는다', { timeout: 20_000 }, async () => {
  const log = fresh('a1.log')
  const gI = fresh('a1.gate')
  const i = settle(call('interactive', log, 'I1', `GATE:${gI}`))
  await waitFor(() => events(log).includes('start:I1'), 'I1 시작')
  const b = settle(call('batch', log, 'B1'))
  const q = await within(call('ask', log, 'Q1'), 4_000, 'ASK 가 공용 슬롯을 기다림')
  assert.equal(q.text, '{"ok":true}')
  const mid = events(log)
  assert.ok(!mid.includes('end:I1'), 'I1 은 아직 붙잡혀 있다')
  assert.ok(!mid.includes('start:B1'), '공용 슬롯 동시성 1 — batch 는 I1 뒤')
  open(gI)
  const [ri, rb] = await Promise.all([i, b])
  assert.equal(ri.status, 'fulfilled')
  assert.equal(rb.status, 'fulfilled')
  const ev = events(log)
  assert.deepEqual(ev, ['start:I1', 'start:Q1', 'end:Q1', 'end:I1', 'start:B1', 'end:B1'])
})

test('(a-2) ASK 가 막혀 있어도 interactive·batch 는 즉시 시작·완료한다', { timeout: 20_000 }, async () => {
  const log = fresh('a2.log')
  const gQ = fresh('a2.gate')
  const q = settle(call('ask', log, 'Q1', `GATE:${gQ}`))
  await waitFor(() => events(log).includes('start:Q1'), 'Q1 시작')
  const i = await within(call('interactive', log, 'I1'), 4_000, 'interactive 가 ASK 슬롯을 기다림')
  const b = await within(call('batch', log, 'B1'), 4_000, 'batch 가 ASK 슬롯을 기다림')
  assert.equal(i.text, '{"ok":true}')
  assert.equal(b.text, '{"ok":true}')
  assert.ok(!events(log).includes('end:Q1'), 'Q1 은 아직 붙잡혀 있다')
  open(gQ)
  assert.equal((await q).status, 'fulfilled')
  assert.deepEqual(events(log), ['start:Q1', 'start:I1', 'end:I1', 'start:B1', 'end:B1', 'end:Q1'])
})

// ── (b) ASK 슬롯 동시성 1 · FIFO ─────────────────────────────────────────────

test('(b) ASK 둘 이상은 FIFO 로 직렬 실행된다 — 앞 ASK 가 붙잡혀 있는 동안 다음 ASK 는 시작하지 않는다', { timeout: 20_000 }, async () => {
  const log = fresh('b.log')
  const g1 = fresh('b.gate')
  const q1 = settle(call('ask', log, 'Q1', `GATE:${g1}`))
  await waitFor(() => events(log).includes('start:Q1'), 'Q1 시작')
  const q2 = settle(call('ask', log, 'Q2'))
  const q3 = settle(call('ask', log, 'Q3'))
  await sleep(400)
  assert.deepEqual(events(log), ['start:Q1'], 'Q2·Q3 는 Q1 뒤에서 기다린다')
  open(g1)
  const rs = await Promise.all([q1, q2, q3])
  for (const r of rs) assert.equal(r.status, 'fulfilled')
  const ev = events(log)
  assert.deepEqual(ev, ['start:Q1', 'end:Q1', 'start:Q2', 'end:Q2', 'start:Q3', 'end:Q3'])
  assert.equal(maxConcurrent(ev, isAsk), 1)
})

// ── (c) 실패·취소·타임아웃 뒤 슬롯 해제, 타임아웃 재진입 레인 ─────────────────────

test('(c-1) ASK 가 실행 오류·타임아웃·실행 중 취소·대기 중 취소로 끝나도 ASK 슬롯이 풀려 다음 ASK 가 돈다', { timeout: 30_000 }, async () => {
  const log = fresh('c1.log')

  // 실행 오류(exit 1) — 기본 시도 수(ask 2)로 슬롯 안 재시도까지 거친 뒤 실패.
  const fail = settle(call('ask', log, 'Q1', 'FAIL', { maxAttempts: undefined }))
  const afterFail = settle(call('ask', log, 'Q2'))
  const rf = await within(fail, 8_000, '실행 오류 ASK')
  assert.equal(rf.status, 'rejected')
  if (rf.status === 'rejected') assert.ok(rf.reason instanceof ClaudeCliExecError)
  assert.equal(events(log).filter((e) => e === 'start:Q1').length, 2, 'ask 기본 시도 수 2(interactive 와 같음)')
  assert.equal((await within(afterFail, 4_000, '실행 오류 뒤 ASK')).status, 'fulfilled')

  // 타임아웃.
  const hang = settle(call('ask', log, 'Q3', 'HANG', { timeoutMs: 500 }))
  const afterHang = settle(call('ask', log, 'Q4'))
  const rh = await within(hang, 8_000, '타임아웃 ASK')
  assert.equal(rh.status, 'rejected')
  if (rh.status === 'rejected') assert.ok(rh.reason instanceof ClaudeCliTimeoutError)
  assert.equal((await within(afterHang, 4_000, '타임아웃 뒤 ASK')).status, 'fulfilled')

  // 실행 중 취소.
  const ac = new AbortController()
  const gNever = fresh('c1.never')
  const running = settle(call('ask', log, 'Q5', `GATE:${gNever}`, { signal: ac.signal }))
  await waitFor(() => events(log).includes('start:Q5'), 'Q5 시작')
  const afterAbort = settle(call('ask', log, 'Q6'))
  ac.abort()
  const ra = await within(running, 8_000, '실행 중 취소 ASK')
  assert.equal(ra.status, 'rejected')
  if (ra.status === 'rejected') assert.ok(ra.reason instanceof ClaudeCliAbortedError)
  assert.equal((await within(afterAbort, 4_000, '실행 중 취소 뒤 ASK')).status, 'fulfilled')

  // 대기 중 취소 — 프로세스를 띄우지 않고 실패해도 슬롯이 풀린다.
  const gBlock = fresh('c1.block')
  const blocker = settle(call('ask', log, 'Q7', `GATE:${gBlock}`))
  await waitFor(() => events(log).includes('start:Q7'), 'Q7 시작')
  const ac2 = new AbortController()
  const queued = settle(call('ask', log, 'Q8', '', { signal: ac2.signal }))
  const last = settle(call('ask', log, 'Q9'))
  ac2.abort()
  open(gBlock)
  const rq = await within(queued, 4_000, '대기 중 취소 ASK')
  assert.equal(rq.status, 'rejected')
  if (rq.status === 'rejected') assert.ok(rq.reason instanceof ClaudeCliAbortedError)
  assert.equal((await within(blocker, 4_000, 'Q7')).status, 'fulfilled')
  assert.equal((await within(last, 4_000, '대기 중 취소 뒤 ASK')).status, 'fulfilled')
  assert.ok(!events(log).includes('start:Q8'), '대기 중 취소된 ASK 는 프로세스를 띄우지 않는다')

  assert.equal(maxConcurrent(events(log), isAsk), 1)
  // 공용 슬롯도 그대로 쓸 수 있다.
  assert.equal((await within(call('interactive', log, 'I1'), 4_000, '공용 슬롯')).text, '{"ok":true}')
})

test('(c-2) ASK 타임아웃 재시도는 ASK 큐 꼬리로 다시 들어간다 — 공용 슬롯이 막혀 있어도 2차가 돌고, 그 사이 들어온 ASK 가 먼저 돈다', { timeout: 30_000 }, async () => {
  const log = fresh('c2.log')
  const gI = fresh('c2.gateI')
  const gQ2 = fresh('c2.gateQ2')
  const hf = fresh('c2.hangfirst')
  const i = settle(call('interactive', log, 'I1', `GATE:${gI}`))
  await waitFor(() => events(log).includes('start:I1'), 'I1 시작')
  const q1 = settle(call('ask', log, 'Q1', `HANG_FIRST:${hf}`, { timeoutMs: 600, maxAttempts: 2, retryOnTimeout: true }))
  await waitFor(() => events(log).includes('start:Q1'), 'Q1 1차 시작')
  const q2 = settle(call('ask', log, 'Q2', `GATE:${gQ2}`))
  const q3 = settle(call('ask', log, 'Q3'))
  // Q1 1차 타임아웃(0.6s) → 슬롯을 놓음 → Q2 시작. Q1 2차는 1s 쉰 뒤 ASK 큐 꼬리(Q3 뒤)로 재진입한다.
  await waitFor(() => events(log).includes('start:Q2'), 'Q1 1차 타임아웃 뒤 Q2 시작')
  await sleep(1_500)
  open(gQ2)
  const r1 = await within(q1, 8_000, 'ASK 재시도가 공용 슬롯(붙잡힌 I1)을 기다림')
  assert.equal(r1.status, 'fulfilled')
  assert.ok(!events(log).includes('end:I1'), 'I1 은 여전히 붙잡혀 있다 — 재시도는 공용 슬롯을 쓰지 않았다')
  assert.equal((await q2).status, 'fulfilled')
  assert.equal((await q3).status, 'fulfilled')
  open(gI)
  assert.equal((await i).status, 'fulfilled')
  // 첫 end:Q1 = 1차 타임아웃으로 죽은 것. 2차(start:Q1 두 번째)는 그 사이 들어온 Q2·Q3 뒤.
  assert.deepEqual(events(log), ['start:I1', 'start:Q1', 'end:Q1', 'start:Q2', 'end:Q2', 'start:Q3', 'end:Q3', 'start:Q1', 'end:Q1', 'end:I1'])
})

// ── (d) 공용 슬롯의 기존 동작 ────────────────────────────────────────────────

test('(d) 공용 슬롯: interactive 먼저·batch 나중·동시성 1 은 ASK 슬롯이 돌고 있어도 그대로다', { timeout: 20_000 }, async () => {
  const log = fresh('d.log')
  const gQ = fresh('d.gateQ')
  const g1 = fresh('d.gate1')
  const q = settle(call('ask', log, 'Q1', `GATE:${gQ}`))
  await waitFor(() => events(log).includes('start:Q1'), 'Q1 시작')
  const i1 = settle(call('interactive', log, 'I1', `GATE:${g1}`))
  await waitFor(() => events(log).includes('start:I1'), 'I1 시작')
  const b1 = settle(call('batch', log, 'B1'))
  const b2 = settle(call('batch', log, 'B2'))
  const i2 = settle(call('interactive', log, 'I2'))
  await sleep(300)
  assert.deepEqual(events(log), ['start:Q1', 'start:I1'], '공용 슬롯 동시성 1 — 뒤 요청은 I1 뒤에서 기다린다')
  open(g1)
  for (const r of await Promise.all([i1, b1, b2, i2])) assert.equal(r.status, 'fulfilled')
  const ev = events(log)
  assert.deepEqual(ev, ['start:Q1', 'start:I1', 'end:I1', 'start:I2', 'end:I2', 'start:B1', 'end:B1', 'start:B2', 'end:B2'], '나중에 온 interactive 가 먼저 온 batch 보다 앞선다')
  assert.equal(maxConcurrent(ev, isShared), 1)
  open(gQ)
  assert.equal((await q).status, 'fulfilled')
})

// ── (e) task 표 매핑 ─────────────────────────────────────────────────────────

test('(e-1) task 표: ask 만 ASK 레인이고 그 밖 task 의 레인은 바뀌지 않았다 · requestLane·호출 옵션이 그 레인을 싣는다', () => {
  const expected: Record<LlmTask, string> = {
    talk: 'interactive',
    chat: 'interactive',
    chatReview: 'interactive',
    lesson: 'batch',
    reviewMix: 'batch',
    evalGen: 'batch',
    evalGrade: 'batch',
    planAnalysis: 'batch',
    ask: 'ask',
    wordEnrich: 'interactive',
    userTranslation: 'interactive',
    reviewDecision: 'batch',
    topicWords: 'interactive',
    scenarioVerdict: 'interactive',
    scenarioDraft: 'interactive',
    replyPractice: 'interactive',
    topicDraft: 'interactive',
    openingDraft: 'interactive',
    scenarioVariant: 'interactive',
    phraseHelp: 'interactive',
  }
  const actual = Object.fromEntries((Object.keys(LLM_TASKS) as LlmTask[]).map((t) => [t, LLM_TASKS[t].lane]))
  assert.deepEqual(actual, expected)
  for (const t of Object.keys(LLM_TASKS) as LlmTask[]) {
    assert.equal(requestLane({ task: t }), expected[t], t)
    assert.equal(adapterCallOptions({}, { task: t }, 1_000, requestLane({ task: t })).priority, expected[t], t)
  }
  // 상위 층이 priority 를 주면 그 값이 이긴다(기존 계약) — ASK 레인 이름은 LlmRequest.priority 타입에 없다.
  assert.equal(requestLane({ task: 'ask', priority: 'interactive' }), 'interactive')
  assert.equal(requestLane({ task: 'lesson', priority: 'interactive' }), 'interactive')
})

test('(e-2) 파사드 연결: completeJson({task:"ask"}) 는 ASK 슬롯으로 가 공용 슬롯이 막혀 있어도 끝나고, task chat 은 공용 슬롯에서 기다린다', { timeout: 20_000 }, async () => {
  const conn: ResolvedConnection = {
    id: 'c-test',
    key: 'claude-cli-test',
    engineId: 'claude-cli',
    connectionType: 'CLI',
    connection: {},
    runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, earlySentenceTts: false, prewarm: false },
    credentialRef: null,
  }
  const restore = mock.method(routerDeps, 'loadChain', async () => [conn])
  try {
    const log = fresh('e2.log')
    const gI = fresh('e2.gate')
    const i = settle(call('interactive', log, 'I1', `GATE:${gI}`))
    await waitFor(() => events(log).includes('start:I1'), 'I1 시작')
    const req = (task: LlmTask, tag: string) => ({
      task,
      persona: { name: 't', description: 'd', prompt: `LOG:${log}:${tag}` },
      system: '시험',
      messages: [{ role: 'user' as const, content: 'q' }],
      jsonSchema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
    })
    const a = await within(completeJson<{ ok: boolean }>(req('ask', 'QF')), 4_000, 'task ask 가 공용 슬롯을 기다림')
    assert.deepEqual(a.data, { ok: true })
    const c = settle(completeJson<{ ok: boolean }>(req('chat', 'IF')))
    await sleep(300)
    assert.ok(!events(log).includes('start:IF'), 'task chat 은 공용 슬롯(I1 뒤)에서 기다린다')
    open(gI)
    assert.equal((await i).status, 'fulfilled')
    assert.equal((await c).status, 'fulfilled')
    assert.deepEqual(events(log), ['start:I1', 'start:QF', 'end:QF', 'end:I1', 'start:IF', 'end:IF'])
  } finally {
    restore.mock.restore()
  }
})

// ── (f) L2 에 레인·엔진 이름이 새지 않는다 ───────────────────────────────────

function sourcesUnder(rel: string): string[] {
  const root = join(process.cwd(), rel)
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.tsx?$/.test(name)) out.push(p)
    }
  }
  walk(root)
  return out
}

test('(f) conversation 층(L2) 소스에 큐 레인·슬롯 이름이 없고, ASK 경로 파일에는 엔진·모델 이름과 priority/lane 지정이 없다', () => {
  const files = sourcesUnder('src/modules/conversation')
  assert.ok(files.length > 50, `${files.length}개`)
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    assert.equal(/ClaudeQueueLane|LlmLane|requestLane|askSlot|askQueue|sharedSlot|ASK_SLOT_CONCURRENCY|SHARED_SLOT_CONCURRENCY/.test(src), false, `${f} 에 큐 레인·슬롯 이름`)
    assert.equal(/\b(priority|lane)\s*:\s*['"]ask['"]/.test(src), false, `${f} 가 ASK 레인을 직접 고른다`)
  }
  const askPath = files.filter((f) => /[/\\](orchestrator[/\\]ask|prompts[/\\]ask|prompts[/\\]askResponse|chats[/\\]askView|chats[/\\]askLimits)\.ts$|[/\\]askRouter[/\\]/.test(f))
  assert.ok(askPath.length >= 7, `ASK 경로 ${askPath.length}개`)
  for (const f of askPath) {
    const src = readFileSync(f, 'utf8')
    assert.equal(/\bpriority\b|\blane\b/.test(src), false, `${f} 에 priority/lane`)
    assert.equal(/claude|anthropic|sonnet|haiku|opus/i.test(src), false, `${f} 에 엔진·모델 이름`)
  }
})
