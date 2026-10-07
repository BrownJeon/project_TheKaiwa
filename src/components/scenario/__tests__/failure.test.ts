import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Err } from '@/components/common/errors'
import { scenarioFailure, scenarioFieldFailure, scenarioFieldFailures, type ScenarioFailContext } from '../failure'
import { josa } from '../logic'
import { CHECK, DRAFT, FAIL, FIELD_LABEL, SHEET } from '../scenarioCopy'

/* task-045 T5-5a — 상황 쪽 서버 오류 → 화면 고정 문구(screens.md §16-7). 서버 message 는 화면에 쓰지 않는다. */

const SERVER = '서버 문구은(는) 쓰지 않아요'
const err = (status: number, details: Record<string, unknown> = {}, retryAfterSec: number | null = null): Err => ({ status, message: SERVER, code: null, details, retryAfterSec })

const CONTEXTS: ScenarioFailContext[] = ['scenarioDraft', 'scenarioSave', 'scenarioEdit', 'scenarioFork', 'scenarioDelete', 'scenarioHide', 'scenarioRevert', 'openingDraft']

test('칸 이름표 표: 조사를 미리 붙였고 josa() 와 같다(「을(를)」 병기 없음)', () => {
  for (const [k, v] of Object.entries(FIELD_LABEL)) {
    assert.equal(v.obj, josa(v.noun, '을', '를'), k)
    assert.equal(v.top, josa(v.noun, '은', '는'), k)
  }
})

test('400 칸 문구: 상황 편집기 칸마다 고정 문구 — 「적어 주세요」·「n자까지」가 일반 문구로 떨어지지 않는다', () => {
  const t = (field: string, reason: string, ctx: ScenarioFailContext = 'scenarioSave') => scenarioFieldFailure(ctx, field, reason)
  assert.equal(t('title', 'required').text, '제목을 적어 주세요.')
  assert.equal(t('titleJa', 'max_length').text, '일본어 제목은 40자까지 쓸 수 있어요.')
  assert.equal(t('roles.learner', 'required').text, '내 역할을 적어 주세요.')
  assert.equal(t('roles.tutor', 'max_length').text, '선생님 역할은 12자까지 쓸 수 있어요.')
  assert.equal(t('goal.communicativeGoalKo', 'required').text, '목표를 적어 주세요.')
  assert.equal(t('goal.successCriteria[2]', 'max_length').text, '성공 조건은 40자까지 쓸 수 있어요.')
  assert.equal(t('steps[3].ko', 'required').text, '대화 순서를 적어 주세요.')
  assert.equal(t('steps', 'min 2').text, '대화 순서는 2단계 이상이어야 해요.')
  assert.equal(t('steps', 'max 8').text, '대화 순서는 8단계까지 넣을 수 있어요.')
  assert.equal(t('goal.successCriteria', 'max 3').text, '성공 조건은 3개까지 넣을 수 있어요.')
  assert.equal(t('keyExpressions', 'min 2').text, '핵심 표현은 2개 이상이어야 해요.')
  assert.equal(t('keyExpressions[0].ja', 'max_length').text, '표현 일본어는 40자까지 쓸 수 있어요.')
  assert.equal(t('keyExpressions[1].ko', 'required').text, '표현 뜻을 적어 주세요.')
  assert.equal(t('keyExpressions[1].ja', 'duplicate').text, CHECK.duplicate)
  assert.equal(t('opening.ko', 'max_length').text, FAIL.opening.max)
  assert.equal(t('opening.ko', 'required').text, '선생님 첫마디를 적어 주세요.')
  assert.equal(t('opening.ja', 'max_length').text, '일본어 첫마디는 60자까지 쓸 수 있어요.')
  assert.equal(t('description', 'max_length', 'scenarioDraft').text, '상황 설명은 300자까지 쓸 수 있어요.')
  assert.equal(t('title', 'forbidden_char').text, CHECK.forbidden)
  assert.equal(t('goal', 'secret_like').text, CHECK.secretLike)
  assert.equal(t('topicIds[0]', 'not_linked', 'scenarioFork').text, CHECK.notLinked)
  assert.equal(t('topicId', 'not_found', 'scenarioDraft').text, CHECK.notLinked)
  assert.equal(t('difficulty', 'range 1-5').text, CHECK.enumPick)
  assert.equal(t('level', 'N5|N4|N3|N2|N1').text, CHECK.enumPick)
  for (const [field, reason] of [['opening', 'type'], ['keyExpressions[0].chunkType', 'a|b'], ['body', 'empty'], ['x', 'unknown_key'], ['topicIds[0]', 'format']]) {
    const f = t(field, reason)
    assert.equal(f.defect, true, `${field}/${reason}`)
    assert.equal(f.text, CHECK.defect)
  }
  assert.deepEqual(
    scenarioFieldFailures('scenarioSave', { problems: [{ field: 'title', reason: 'required', message: SERVER }, { nope: 1 }] }).map((x) => x.text),
    ['제목을 적어 주세요.'],
  )
})

test('#178 첫마디: 칸·422·409·429(분/하루)·502·네트워크 — 「한국어는 그대로 있어요」', () => {
  const f = (e: Err) => scenarioFailure('openingDraft', e)
  assert.equal(f(err(400, { field: 'ko', reason: 'max_length' })).text, FAIL.opening.max)
  assert.equal(f(err(400, { field: 'ko', reason: 'no_hangul' })).text, CHECK.noHangul)
  assert.equal(f(err(400, { field: 'ko', reason: 'required' })).text, '선생님 첫마디를 적어 주세요.')
  assert.equal(f(err(400, { field: 'scenario.roles', reason: 'required' })).text, CHECK.defect)
  assert.equal(f(err(422, { reason: 'NOT_AN_UTTERANCE' })).text, FAIL.opening.unfit)
  assert.equal(f(err(422, { reason: 'TOO_LONG' })).kind, 'tooLong')
  assert.equal(f(err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.opening.busy)
  const rate = f(err(429, {}, 20))
  assert.deepEqual([rate.kind, rate.text, rate.block], ['rate', FAIL.opening.rate(20), false])
  const daily = f(err(429, { retryAfterSec: 7200 }))
  assert.deepEqual([daily.kind, daily.text, daily.block], ['daily', '오늘은 일본어 만들기를 60번 모두 했어요. 약 2시간 뒤 다시 할 수 있어요.', true])
  assert.equal(f(err(429, {}, 300)).text, '오늘은 일본어 만들기를 60번 모두 했어요. 약 5분 뒤 다시 할 수 있어요.')
  const engine = f(err(502))
  assert.deepEqual([engine.kind, engine.text, engine.body, engine.retry], ['engine', FAIL.opening.fail, FAIL.opening.failKeep, true])
  assert.equal(f(err(0)).body, FAIL.opening.failKeep)
})

test('#166 상황 초안(묻기 단계): 422 · 409 · 429 분/하루 · 5xx', () => {
  const f = (e: Err) => scenarioFailure('scenarioDraft', e)
  assert.equal(f(err(422, { reason: 'NOT_A_SCENARIO' })).text, DRAFT.gen422)
  assert.equal(f(err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.draftBusy)
  assert.equal(f(err(429, {}, 30)).text, FAIL.draftRate(30))
  assert.deepEqual([f(err(429, {}, 3600)).text, f(err(429, {}, 3600)).block], [FAIL.draftDaily, true])
  assert.deepEqual([f(err(504)).text, f(err(504)).retry], [DRAFT.genFail, true])
})

test('저장·고치기·내 버전(#163·#164·#175): 한도 · 다른 화면이 먼저 만듦 · 기본 항목 없음 · 지운 상황', () => {
  assert.equal(scenarioFailure('scenarioFork', err(409, { reason: 'ALREADY_COPIED' })).text, DRAFT.copied)
  assert.equal(scenarioFailure('scenarioFork', err(404, { reason: 'SEED_NOT_FOUND' })).kind, 'seedGone')
  assert.equal(scenarioFailure('scenarioFork', err(409, { reason: 'SCENARIO_LIMIT' })).text, FAIL.saveLimit)
  const daily = scenarioFailure('scenarioFork', err(429, { reason: 'DAILY_LIMIT' }, 40000))
  assert.deepEqual([daily.text, daily.block], [FAIL.saveDaily, true])
  assert.equal(scenarioFailure('scenarioSave', err(429, { reason: 'DAILY_LIMIT' })).text, FAIL.saveDaily)
  assert.equal(scenarioFailure('scenarioEdit', err(429, {}, 12)).text, FAIL.writeRate(12))
  assert.equal(scenarioFailure('scenarioEdit', err(404, { reason: 'SEED' })).kind, 'gone')
  assert.equal(scenarioFailure('scenarioEdit', err(409, { reason: 'ARCHIVED' })).kind, 'gone')
  assert.equal(scenarioFailure('scenarioSave', err(500)).text, DRAFT.saveFail)
})

test('상황 시트(#165·#176): 이미 없음 → 닫고 다시 읽기 · 이미 기본 · 실패 문구', () => {
  assert.deepEqual([scenarioFailure('scenarioHide', err(404)).kind, scenarioFailure('scenarioHide', err(404)).text], ['gone', FAIL.scenarioGone])
  assert.equal(scenarioFailure('scenarioDelete', err(409, { reason: 'ARCHIVED' })).kind, 'gone')
  assert.deepEqual([scenarioFailure('scenarioRevert', err(404, { reason: 'NOT_OVERRIDDEN' })).kind, scenarioFailure('scenarioRevert', err(404, { reason: 'NOT_OVERRIDDEN' })).text], ['notOverridden', FAIL.notOverridden])
  assert.equal(scenarioFailure('scenarioRevert', err(404)).kind, 'gone')
  assert.equal(scenarioFailure('scenarioDelete', err(500)).text, SHEET.deleteFail)
  assert.equal(scenarioFailure('scenarioHide', err(500)).text, FAIL.hideFail)
  assert.equal(scenarioFailure('scenarioRevert', err(500)).text, FAIL.revertFail)
  assert.equal(scenarioFailure('scenarioHide', err(429, {}, 5)).text, FAIL.writeRate(5))
})

test('어느 문맥·상태에서도 서버 message 를 쓰지 않고, 「AI」·엔진명·조사 병기가 없다', () => {
  const statuses: [number, Record<string, unknown>][] = [
    [0, {}],
    [-1, {}],
    [400, { field: 'title', reason: 'required' }],
    [400, { field: 'mystery', reason: 'mystery' }],
    [400, {}],
    [404, {}],
    [404, { reason: 'USER_GONE' }],
    [409, {}],
    [409, { reason: 'ALREADY_COPIED' }],
    [422, {}],
    [429, {}],
    [429, { reason: 'DAILY_LIMIT' }],
    [500, {}],
    [502, {}],
  ]
  for (const ctx of CONTEXTS) {
    for (const [status, details] of statuses) {
      const f = scenarioFailure(ctx, err(status, details))
      for (const t of [f.text, ...(f.body === null ? [] : [f.body]), ...f.problems.map((p) => p.text)]) {
        assert.ok(!t.includes('서버 문구'), `${ctx} ${status}: ${t}`)
        assert.ok(!/\((을|를|은|는|이|가)\)/.test(t), `${ctx} ${status}: ${t}`)
        assert.ok(!/\bAI\b|claude|whisper|reazon|style-bert/i.test(t), `${ctx} ${status}: ${t}`)
        assert.ok(t.length > 0, `${ctx} ${status}: 빈 문구`)
      }
    }
  }
  assert.equal(scenarioFailure('scenarioSave', err(404, { reason: 'USER_GONE' })).text, FAIL.userGone)
})
