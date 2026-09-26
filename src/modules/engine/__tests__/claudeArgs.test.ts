import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClaudeArgs } from '../adapters/llm/claudeCli'

const persona = { tutor: { description: 'd', prompt: 'p' } }

test('도구는 항상 명시적으로 끄고 프롬프트는 argv 에 없다(stdin)', () => {
  const args = buildClaudeArgs('비밀 프롬프트', { model: 'haiku' })
  assert.equal(args[0], '--print')
  assert.ok(!args.includes('비밀 프롬프트'))
  const i = args.indexOf('--tools')
  assert.equal(args[i + 1], '')
  assert.deepEqual(args.slice(args.indexOf('--permission-mode'), args.indexOf('--permission-mode') + 2), ['--permission-mode', 'dontAsk'])
  assert.equal(args[args.indexOf('--model') + 1], 'haiku')
})

test('--agents JSON 에는 model 이 없고 --model 이 권위다', () => {
  const args = buildClaudeArgs('x', { model: 'haiku', agents: persona, agent: 'tutor' })
  const json = JSON.parse(args[args.indexOf('--agents') + 1])
  assert.deepEqual(Object.keys(json.tutor).sort(), ['description', 'prompt'])
  assert.equal(args[args.indexOf('--agent') + 1], 'tutor')
  assert.equal(args[args.indexOf('--model') + 1], 'haiku')
})

test('agents 에 model 을 넣으면 거부한다', () => {
  assert.throws(() => buildClaudeArgs('x', { agents: { tutor: { description: 'd', prompt: 'p', model: 'opus' } as never } }))
})

test('고정비 제거 플래그와 thinking 끄기가 기본으로 붙는다', () => {
  const args = buildClaudeArgs('x', { model: 'haiku', systemPrompt: 'P' })
  assert.equal(args[args.indexOf('--setting-sources') + 1], '')
  assert.ok(args.includes('--strict-mcp-config'))
  assert.deepEqual(JSON.parse(args[args.indexOf('--mcp-config') + 1]), { mcpServers: {} })
  assert.ok(args.includes('--no-session-persistence'))
  assert.deepEqual(JSON.parse(args[args.indexOf('--settings') + 1]), { alwaysThinkingEnabled: false })
  assert.equal(args[args.indexOf('--system-prompt') + 1], 'P')
  assert.ok(!buildClaudeArgs('x', { thinking: true }).includes('--settings'))
})

test('stream-json 은 --verbose 를 동반하고 json-schema 는 인라인 JSON 이다', () => {
  const args = buildClaudeArgs('x', { outputFormat: 'stream-json', jsonSchema: { type: 'object' } })
  assert.ok(args.includes('--verbose'))
  assert.equal(args[args.indexOf('--output-format') + 1], 'stream-json')
  assert.deepEqual(JSON.parse(args[args.indexOf('--json-schema') + 1]), { type: 'object' })
})

test('허용되지 않은 도구는 거부한다(화이트리스트가 비어 있음)', () => {
  assert.throws(() => buildClaudeArgs('x', { tools: ['Read'] as never }))
})
