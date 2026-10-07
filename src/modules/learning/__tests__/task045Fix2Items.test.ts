/**
 * task-045 감사 잔여 보완(REV-154 L-1 ②·개발자 남은 위험 ②) — 서비스 고정(DB·LLM 0, 메모리 가짜 DB):
 * - #179 `listSeedOverrideItems` 상황 제목: 공유 시드 상황(`userId null ∧ isSeed`) 행에서만 읽는다 — override 의 seedId 가 남의 사본·위조 시드 표시 행·
 *   시드 아닌 공용 행을 가리켜도 제목 null(두 조건을 각각 따로 깨는 행으로 고정).
 * - #166 AI 상황 초안 장소(`readScenarioDraftTopic`): 이 사용자가 가린 시드 주제(숨김·내 버전·고아)는 400 `not_linked` — #163·#164·#175 의
 *   `visibleTopicIds` 와 같은 판정·같은 문구(표 대조). 보이는 시드·내 주제·사본은 그대로, 남의·없는 주제는 기존대로 null(→ `not_found`).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { visibleTopicIds } from '../scenarios/catalog'
import { readScenarioDraftTopic, TOPIC_NOT_LINKED_MESSAGE } from '../scenarios/start'
import { listSeedOverrideItems } from '../seedOverride'
import { scenarioFakeDb } from './scenarioFakeDb'

const ME = 'cuser000000000000000mefx2'
const OTHER = 'cuser00000000000otherfx2'
const T0 = new Date('2026-09-01T00:00:00.000Z')
const ov = (id: string, userId: string, kind: string, seedId: string, copyId: string | null) => ({ id, userId, kind, seedId, copyId, createdAt: T0, updatedAt: T0 })
const scn = (id: string, userId: string | null, isSeed: boolean, title: string) => ({ id, userId, isSeed, status: 'ACTIVE', title, titleJa: null, level: 'N5', createdAt: T0, updatedAt: T0 })

test('#179 상황 제목 — 공유 시드 상황 행에서만: 남의 사본·남의 위조 시드 표시·시드 아닌 공용 행을 가리키는 override 는 제목 null', async () => {
  const f = scenarioFakeDb()
  f.tables.scenario.push(
    scn('scn_seed', null, true, '시드 상황'),
    scn('scn_other_copy', OTHER, false, '남의 사본 상황'), // userId·isSeed 두 조건 모두로 걸러짐
    scn('scn_other_flag', OTHER, true, '남의 위조 시드 표시'), // userId null 조건만 거른다
    scn('scn_null_plain', null, false, '시드 아닌 공용 행'), // isSeed 조건만 거른다
  )
  f.tables.conversationTopic.push({ id: 'topic_other_fx2', userId: OTHER, isSeed: false, title: '남의 주제 fx2', titleJa: null, createdAt: T0 })
  f.tables.userSeedOverride.push(
    ov('o1', ME, 'SCENARIO', 'scn_seed', null),
    ov('o2', ME, 'SCENARIO', 'scn_other_copy', null),
    ov('o3', ME, 'SCENARIO', 'scn_other_flag', null),
    ov('o4', ME, 'SCENARIO', 'scn_null_plain', null),
    ov('o5', ME, 'TOPIC', 'topic_other_fx2', null),
    ov('o6', OTHER, 'SCENARIO', 'scn_seed', null),
  )
  const items = await listSeedOverrideItems(ME, undefined, f.db)
  const title = new Map(items.map((i) => [`${i.kind}:${i.seedId}`, i.seedTitle]))
  assert.equal(items.length, 5, '본인 override 만(OTHER 의 o6 제외)')
  assert.equal(title.get('SCENARIO:scn_seed'), '시드 상황')
  assert.equal(title.get('SCENARIO:scn_other_copy'), null, '남의 사본 제목 노출 0')
  assert.equal(title.get('SCENARIO:scn_other_flag'), null, 'isSeed 표시가 있어도 남의 행이면 제목 0(userId null 조건)')
  assert.equal(title.get('SCENARIO:scn_null_plain'), null, '공용 행이라도 시드가 아니면 제목 0(isSeed 조건)')
  assert.equal(title.get('TOPIC:topic_other_fx2'), null)
  const text = JSON.stringify(items)
  for (const leak of ['남의 사본 상황', '남의 위조 시드 표시', '시드 아닌 공용 행', '남의 주제 fx2']) assert.ok(!text.includes(leak), `제목 노출 0: ${leak}`)
  assert.deepEqual((await listSeedOverrideItems(ME, 'SCENARIO', f.db)).map((i) => i.seedTitle).sort(), [null, null, null, '시드 상황'].sort())
  assert.ok(f.log.every((l) => /\.(findMany|findFirst|count)$/.test(l)), `읽기 전용: ${f.log.join(',')}`)
})

function topicsDb() {
  const f = scenarioFakeDb()
  const tp = (id: string, userId: string | null, title: string) => ({ id, userId, isSeed: userId === null, title, titleJa: userId === null ? `${title}JA` : null, createdAt: T0 })
  f.tables.conversationTopic.push(
    tp('topic_free', null, '보이는 시드'),
    tp('topic_cafe', null, '카페'),
    tp('topic_road', null, '길 묻기'),
    tp('topic_shop', null, '가게'),
    tp('topic_cafe_mine', ME, '카페(내 버전)'),
    tp('topic_mine', ME, '내 주제'),
    tp('topic_other', OTHER, '남의 주제'),
  )
  f.tables.userSeedOverride.push(
    ov('t1', ME, 'TOPIC', 'topic_cafe', 'topic_cafe_mine'), // 내 버전
    ov('t2', ME, 'TOPIC', 'topic_road', null), // 숨김
    ov('t3', ME, 'TOPIC', 'topic_shop', 'topic_gone'), // 고아
    ov('t4', OTHER, 'TOPIC', 'topic_free', null), // 다른 사용자의 숨김 — ME 에 영향 없음
    ov('t5', ME, 'SCENARIO', 'topic_free', null), // 종류가 다른 행 — 주제 판정에 영향 없음
  )
  return f
}

type Outcome = 'ok' | string
async function draftOutcome(db: ReturnType<typeof scenarioFakeDb>['db'], userId: string, id: string): Promise<Outcome> {
  try {
    return (await readScenarioDraftTopic(userId, id, db as never)) === null ? 'not_found' : 'ok'
  } catch (e) {
    assert.ok(e instanceof ApiError, String(e))
    return String(e.details?.reason)
  }
}
async function saveOutcome(db: ReturnType<typeof scenarioFakeDb>['db'], userId: string, id: string): Promise<Outcome> {
  try {
    await visibleTopicIds(db, userId, [id])
    return 'ok'
  } catch (e) {
    assert.ok(e instanceof ApiError, String(e))
    return String(e.details?.reason)
  }
}

test('#166 초안 장소 = #163 저장 검사와 같은 판정: 가린 시드(내 버전·숨김·고아) 400 not_linked · 보이는 시드·내 주제·사본 통과 · 남의·없는 주제 null', async () => {
  const f = topicsDb()
  const expected: Record<string, Outcome> = {
    topic_free: 'ok',
    topic_mine: 'ok',
    topic_cafe_mine: 'ok',
    topic_cafe: 'not_linked',
    topic_road: 'not_linked',
    topic_shop: 'not_linked',
    topic_other: 'not_found',
    topic_none: 'not_found',
  }
  for (const [id, want] of Object.entries(expected)) {
    assert.equal(await draftOutcome(f.db, ME, id), want, `초안 ${id}`)
    assert.equal(await saveOutcome(f.db, ME, id), want, `저장 ${id}`)
  }
  assert.equal(await draftOutcome(f.db, OTHER, 'topic_free'), 'not_linked', 'OTHER 는 자기가 숨긴 시드가 막힌다')
  assert.equal(await saveOutcome(f.db, OTHER, 'topic_free'), 'not_linked')
  assert.equal(await draftOutcome(f.db, OTHER, 'topic_cafe'), 'ok', 'ME 의 override 는 OTHER 에 영향 없음')
  assert.equal(await draftOutcome(f.db, OTHER, 'topic_mine'), 'not_found')
})

test('#166 초안 장소 — 오류 모양 {field:topicId, reason:not_linked}·문구는 저장 검사와 같은 글 · 정상 응답 모양 그대로 · override 는 시드일 때만 · 쓰기 0', async () => {
  const f = topicsDb()
  const err = await readScenarioDraftTopic(ME, 'topic_road', f.db as never).then(
    () => assert.fail('400 기대'),
    (e: unknown) => e,
  )
  assert.ok(err instanceof ApiError)
  assert.equal(err.code, 'VALIDATION')
  assert.deepEqual(err.details, { field: 'topicId', reason: 'not_linked' })
  assert.equal(err.userMessage, TOPIC_NOT_LINKED_MESSAGE)
  const save = await visibleTopicIds(f.db, ME, ['topic_road']).then(
    () => assert.fail('400 기대'),
    (e: unknown) => e,
  )
  assert.ok(save instanceof ApiError)
  assert.equal(save.userMessage, err.userMessage, '#163 과 같은 문구')

  assert.deepEqual(await readScenarioDraftTopic(ME, 'topic_free', f.db as never), { id: 'topic_free', title: '보이는 시드', titleJa: '보이는 시드JA' }, '응답 칸은 id·title·titleJa 뿐(userId 미노출)')
  assert.deepEqual(await readScenarioDraftTopic(ME, 'topic_cafe_mine', f.db as never), { id: 'topic_cafe_mine', title: '카페(내 버전)', titleJa: null })

  const before = f.reads.filter((r) => r.op === 'userSeedOverride').length
  assert.ok(await readScenarioDraftTopic(ME, 'topic_mine', f.db as never))
  assert.equal(await readScenarioDraftTopic(ME, 'topic_other', f.db as never), null)
  assert.equal(f.reads.filter((r) => r.op === 'userSeedOverride').length, before, '내 주제·남의 주제는 override 를 읽지 않는다')
  const n = f.reads.length
  assert.equal(await readScenarioDraftTopic(ME, 'x'.repeat(41), f.db as never), null)
  assert.equal(f.reads.length, n, '형식 틀린 id 는 쿼리 0')
  assert.ok(f.log.every((l) => /\.(findMany|findFirst|count)$/.test(l)), `읽기 전용: ${f.log.join(',')}`)
})
