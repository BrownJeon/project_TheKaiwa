/**
 * task-045 PE — #166 `POST /scenarios/drafts` 의 **인라인 주제**(`topic:{title, titleJa?, level?}`, 저장 전 새 주제의 상황 초안) 단위 테스트(DB·LLM 없음).
 * 대전제: 기존 요청(`topicId`·장소 없음)의 본문 검사·프롬프트 바이트·결과는 그대로다 — 이 파일은 새 경로와 "기존과 같은 모양"만 본다(기존 시험은 건드리지 않았다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import type { LlmJsonResult } from '@/modules/engine'
import { draftScenario, parseScenarioDraftBody, type ScenarioDraftDeps } from '../chats/scenarioDraft'
import { buildScenarioDraftRequest } from '../prompts/scenarioDraft'
import type { ScenarioDraftResponse } from '../structuredResponse/scenarioDraft'

const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/scenario-draft.json'), 'utf8')) as { modelResponses: Record<string, ScenarioDraftResponse> }
const DESC = '병원에서 어디가 아픈지 말하고 진료를 받는 상황이에요'
const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })

function throwsApi(fn: () => unknown, field: string, reason: string): void {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof ApiError)
    assert.equal(e.code, 'VALIDATION')
    assert.equal(e.details?.field, field)
    assert.equal(e.details?.reason, reason)
    return
  }
  assert.fail(`400 ${field}/${reason}`)
}

test('본문: 인라인 주제 통과 — 정리(공백·줄바꿈)·titleJa 선택·level 은 받되 결과에 싣지 않음 · topicId 는 null', () => {
  const b = parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '  병원\n진료 ', titleJa: '病院で診察', level: 'N4' } })
  assert.deepEqual(b, { description: DESC, level: 'N4', topicId: null, topic: { title: '병원 진료', titleJa: '病院で診察' } })
  const noJa = parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '병원 진료' } })
  assert.deepEqual(noJa.topic, { title: '병원 진료', titleJa: null })
})

test('본문: 기존 요청은 그대로 — topicId·장소 없음은 topic 키가 없고 같은 값 · topicIds 는 여전히 unknown_key', () => {
  assert.deepEqual(parseScenarioDraftBody({ description: DESC, level: 'N3' }), { description: DESC, level: 'N3', topicId: null })
  assert.deepEqual(parseScenarioDraftBody({ description: DESC, level: 'N3', topicId: 'top_mine' }), { description: DESC, level: 'N3', topicId: 'top_mine' })
  assert.ok(!('topic' in parseScenarioDraftBody({ description: DESC, level: 'N3', topic: null })), 'topic:null 은 없는 것과 같다')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N3', topicIds: ['x'] }), 'topicIds', 'unknown_key')
})

test('본문: topicId 와 topic 을 함께 보내면 400 topic/conflict · 형식·길이·꺾쇠·URL·비밀 모양·모르는 키·잘못된 level 은 칸별 400', () => {
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topicId: 'top_mine', topic: { title: '병원 진료' } }), 'topic', 'conflict')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: '병원' }), 'topic', 'type')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: [] }), 'topic', 'type')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: {} }), 'topic.title', 'required')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '   ' } }), 'topic.title', 'required')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: 5 } }), 'topic.title', 'type')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '가'.repeat(41) } }), 'topic.title', 'max_length')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '<b>병원</b>' } }), 'topic.title', 'forbidden_char')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: 'https://example.com 병원' } }), 'topic.title', 'forbidden_char')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '병원', titleJa: '<b>病院</b>' } }), 'topic.titleJa', 'forbidden_char')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '병원', id: 'top_x' } }), 'topic.id', 'unknown_key')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '병원', level: 'N9' } }), 'topic.level', 'enum')
  // 이모지는 통과(학습자가 적은 주제 이름) — 표현 선택자(U+FE0F)는 #166 의 글 정리(`cleanScenarioText`)가 보이지 않는 문자로 걷는다(프롬프트 한 줄에만 쓰이므로 무해)
  assert.equal(parseScenarioDraftBody({ description: DESC, level: 'N4', topic: { title: '여행 ✈️' } }).topic?.title, '여행 ✈')
})

test('프롬프트: 인라인 주제도 [장소] 한 줄로만(같은 모양) · 저장된 주제와 같은 제목이면 system 바이트가 같다 · 결과 topicIds 는 없다', () => {
  const inlineReq = buildScenarioDraftRequest({ description: DESC, level: 'N4', topic: { id: null, title: '병원 진료', titleJa: '病院で診察' } })
  const savedReq = buildScenarioDraftRequest({ description: DESC, level: 'N4', topic: { id: 'top_mine', title: '병원 진료', titleJa: '病院で診察' } })
  assert.equal(inlineReq.system, savedReq.system, '[장소] 줄은 id 와 무관하다')
  assert.equal(inlineReq.system.split('\n').filter((l) => l.startsWith('[장소]')).length, 1)
  assert.match(inlineReq.system, /^\[장소\] 병원 진료$/m)
  assert.equal(inlineReq.context.topicId, null)
  // 기존 요청(장소 없음) system 에는 [장소] 가 없다 — 바이트 불변은 기존 scenarioDraft 시험·pin 이 지킨다
  assert.ok(!buildScenarioDraftRequest({ description: DESC, level: 'N4' }).system.includes('[장소]'))
})

test('draftScenario: 인라인 주제는 readTopic 을 부르지 않고 [장소] 로만 쓰이며 결과 draft 에 topicIds 가 없다 · 저장된 주제 경로는 그대로(topicIds 이어짐)', async () => {
  const good = fx.modelResponses['d01-cafe']
  const seen: { system?: string }[] = []
  let readCalls = 0
  const deps: ScenarioDraftDeps = {
    readTopic: async (_u, id) => {
      readCalls += 1
      return id === 'top_mine' ? { id, title: '카페 주문', titleJa: 'カフェで注文' } : null
    },
    complete: async (r) => {
      seen.push({ system: r.system })
      return llmResult(good)
    },
    trace: async () => undefined,
  }
  const inline = await draftScenario('u1', parseScenarioDraftBody({ description: '카페에서 음료를 주문하고 사이즈를 정해요', level: 'N5', topic: { title: '새 카페 주제' } }), deps)
  assert.equal(readCalls, 0)
  assert.match(seen[0].system!, /^\[장소\] 새 카페 주제$/m)
  assert.ok(!('topicIds' in inline.draft))
  const saved = await draftScenario('u1', parseScenarioDraftBody({ description: '카페에서 음료를 주문하고 사이즈를 정해요', level: 'N5', topicId: 'top_mine' }), deps)
  assert.equal(readCalls, 1)
  assert.deepEqual(saved.draft.topicIds, ['top_mine'])
  // 없는 주제 id 는 기존대로 400
  await assert.rejects(draftScenario('u1', parseScenarioDraftBody({ description: '카페에서 음료를 주문하고 사이즈를 정해요', level: 'N5', topicId: 'top_x' }), deps), (e: unknown) => e instanceof ApiError && e.details?.reason === 'not_found')
})
