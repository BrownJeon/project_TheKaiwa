import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Err } from '@/components/common/errors'
import { failureCopy, fieldFailure, type FailContext, type Failure } from '../failure'
import { EDIT, FAIL, HIDDEN, REMOVAL, SCDRAFT, TOPIC } from '../topicCopy'

/** 서버 문구 — 화면에 그대로 나오면 안 된다(조사 병기 포함). */
const SERVER_MSG = '주제을(를) 확인해 주세요'

const err = (status: number, details: Record<string, unknown> = {}): Err => ({ status, message: SERVER_MSG, code: null, details, retryAfterSec: null })
const seen: Failure[] = []
const run = (ctx: FailContext, e: Err, opts?: { chunkCount?: number }) => {
  const f = failureCopy(ctx, e, opts)
  seen.push(f)
  return f
}

test('공통 — 네트워크·계정 없음·쓰기 분당 한도', () => {
  assert.equal(run('topicDelete', err(0)).text, FAIL.network)
  assert.equal(run('topicDelete', err(0)).retry, true)
  assert.equal(run('scenarioSave', err(0)).text, FAIL.scenarioSave.fail)
  const gone = run('topicSave', err(404, { reason: 'USER_GONE' }))
  assert.deepEqual([gone.kind, gone.text], ['userGone', FAIL.userGone])
  const rate = run('topicDelete', err(429, { retryAfterSec: 12 }))
  assert.deepEqual([rate.kind, rate.text, rate.block], ['rate', FAIL.writeRate(12), false])
  const fromHeader = run('topicSave', { ...err(429), retryAfterSec: 30 })
  assert.equal(fromHeader.text, FAIL.writeRate(30))
})

test('주제 초안 #170 — 칸·422·409·429(분/하루)·502', () => {
  assert.equal(run('topicDraft', err(400, { field: 'title', reason: 'max_length' })).text, '주제는 40자까지 쓸 수 있어요.')
  assert.equal(run('topicDraft', err(400, { field: 'title', reason: 'required' })).text, '주제를 적어 주세요.')
  const unfit = run('topicDraft', err(422, { reason: 'NOT_A_TOPIC' }))
  assert.deepEqual([unfit.kind, unfit.text], ['unfit', FAIL.topicDraft.unfit])
  assert.equal(run('topicDraft', err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.topicDraft.busy)
  assert.equal(run('topicDraft', err(429, { retryAfterSec: 40 })).text, FAIL.topicDraft.rate(40))
  const daily = run('topicDraft', err(429, { retryAfterSec: 7000 }))
  assert.deepEqual([daily.kind, daily.block, daily.text], ['daily', true, '오늘은 주제 초안을 20번 모두 만들었어요. 약 2시간 뒤 다시 만들 수 있어요.'])
  assert.equal(run('topicDraft', err(429, { retryAfterSec: 1500 })).text, '오늘은 주제 초안을 20번 모두 만들었어요. 약 25분 뒤 다시 만들 수 있어요.')
  assert.equal(run('topicDraft', err(429, { retryAfterSec: 61 })).kind, 'daily')
  assert.equal(run('topicDraft', err(429, { retryAfterSec: 60 })).kind, 'rate')
  for (const s of [502, 504]) {
    const f = run('topicDraft', err(s))
    assert.deepEqual([f.kind, f.text, f.retry], ['engine', FAIL.engine, true])
  }
})

test('상황 초안 #166 — 422·409·429·502', () => {
  assert.equal(run('scenarioDraft', err(422, { reason: 'NOT_A_SCENARIO' })).text, SCDRAFT.unfit)
  assert.equal(run('scenarioDraft', err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.scenarioDraft.busy)
  assert.equal(run('scenarioDraft', err(429, { retryAfterSec: 20 })).text, FAIL.scenarioDraft.rate(20))
  assert.equal(run('scenarioDraft', err(429, { retryAfterSec: 3600 })).text, FAIL.scenarioDraft.daily)
  assert.equal(run('scenarioDraft', err(502)).text, SCDRAFT.fail)
})

test('주제 저장 #57 — 칸 문제 여러 개·한도·하루·5xx', () => {
  const f = run(
    'topicSave',
    err(400, {
      field: 'title',
      reason: 'max_length',
      problems: [
        { field: 'title', reason: 'max_length' },
        { field: 'chunks[2].reading', reason: 'reading' },
        { field: 'chunks[0].meaningKo', reason: 'required' },
        { field: 'chunks[1].textJa', reason: 'max_length' },
        { field: 'description', reason: 'forbidden_char' },
        { field: 'titleJa', reason: 'secret_like' },
        { field: 'chunks', reason: 'count' },
        { field: 'chunks[3].textJa', reason: 'not_japanese' },
        { field: 'chunks[4].chunkType', reason: 'enum' },
        { field: 'chunks[5].textJa', reason: 'duplicate' },
        { field: 'chunks[6]', reason: 'engine_name' },
        { field: 'chunks[7].textJa', reason: 'chars' },
      ],
    }),
    { chunkCount: 7 },
  )
  assert.equal(f.kind, 'field')
  assert.equal(f.text, '주제 이름은 20자까지 쓸 수 있어요.')
  assert.deepEqual(
    f.problems.map((p) => p.text),
    [
      '주제 이름은 20자까지 쓸 수 있어요.',
      FAIL.field.reading,
      '뜻을 적어 주세요.',
      '일본어는 20자까지 쓸 수 있어요.',
      FAIL.field.forbiddenChar,
      FAIL.field.secretLike,
      '기본 표현은 8~20개여야 해요. 지금 7개예요.',
      FAIL.field.notJapanese,
      FAIL.field.enum,
      FAIL.field.duplicate,
      FAIL.field.engineName,
      FAIL.field.chars,
    ],
  )
  assert.equal(f.problems[1].field, 'chunks[2].reading')
  assert.equal(run('topicSave', err(409, { reason: 'TOPIC_LIMIT' })).text, FAIL.topicSave.limit)
  const daily = run('topicSave', err(429, { reason: 'DAILY_LIMIT', retryAfterSec: 30000 }))
  assert.deepEqual([daily.kind, daily.block, daily.text], ['daily', true, FAIL.topicSave.daily])
  assert.equal(run('topicSave', err(500)).text, FAIL.topicSave.fail)
  assert.equal(run('topicSave', err(418)).text, FAIL.topicSave.fail)
})

test('칸 문구 — 이름표 없는 칸·모양 오류는 일반 문구(결함 표시), 개수는 모르면 첫 문장만', () => {
  assert.deepEqual(fieldFailure('topicSave', 'chunks[0].note', 'unknown_key'), { field: 'chunks[0].note', text: FAIL.field.defect, defect: true })
  assert.equal(fieldFailure('topicSave', 'title', 'type').defect, true)
  assert.equal(fieldFailure('topicSave', 'title', 'conflict').defect, true)
  assert.equal(fieldFailure('scenarioSave', 'steps[1].ko', 'required').defect, true)
  assert.equal(fieldFailure('topicSave', 'chunks', 'count').text, '기본 표현은 8~20개여야 해요.')
  assert.equal(fieldFailure('topicSave', 'titleJa', 'no_text').text, '일본어 이름을 적어 주세요.')
  assert.equal(fieldFailure('topicSave', 'description', 'max_length').text, '설명은 120자까지 쓸 수 있어요.')
  assert.equal(fieldFailure('topicSave', 'chunks[0].reading', 'max_length').text, '읽기는 40자까지 쓸 수 있어요.')
  assert.equal(fieldFailure('topicSave', 'chunks[0].meaningKo', 'max_length').text, '뜻은 30자까지 쓸 수 있어요.')
  assert.equal(fieldFailure('topicSave', 'level', 'required').text, '수준을 적어 주세요.')
  assert.equal(fieldFailure('variantDraft', 'note', 'url').text, FAIL.field.forbiddenChar)
  assert.equal(fieldFailure('scenarioSave', 'opening.ko', 'no_hangul').text, FAIL.field.noHangul)
  // 400 인데 칸 정보가 없으면 일반 문구
  const empty = run('topicSave', err(400, {}))
  assert.deepEqual([empty.kind, empty.text, empty.problems.length], ['field', FAIL.field.defect, 0])
})

test('상황 저장 #163 — 한도·하루·장소 칸·5xx', () => {
  assert.equal(run('scenarioSave', err(409, { reason: 'SCENARIO_LIMIT' })).text, FAIL.scenarioSave.limit)
  assert.equal(run('scenarioSave', err(429, { reason: 'DAILY_LIMIT' })).text, FAIL.scenarioSave.daily)
  assert.equal(run('scenarioSave', err(400, { field: 'topicIds[0]', reason: 'not_linked' })).text, FAIL.field.notLinked)
  assert.equal(run('scenarioSave', err(400, { field: 'topicIds[1]', reason: 'not_found' })).text, FAIL.field.notLinked)
  assert.equal(run('scenarioSave', err(503)).text, FAIL.scenarioSave.fail)
})

test('주제 고치기 #171 — 찾을 수 없음·USE_FORK·바뀐 표현 id', () => {
  const gone = run('topicEdit', err(404, { reason: 'TOPIC_GONE' }))
  assert.deepEqual([gone.kind, gone.text, gone.body], ['gone', TOPIC.notFound, TOPIC.notFoundBody])
  assert.equal(run('topicEdit', err(409, { reason: 'USE_FORK' })).text, EDIT.useFork)
  assert.equal(run('topicEdit', err(400, { field: 'chunks[1].id', reason: 'not_found' })).text, FAIL.field.chunkGone)
  assert.equal(run('topicEdit', err(429, { reason: 'DAILY_LIMIT' })).text, FAIL.topicSave.daily)
})

test('내 버전 저장 #174·#175 — 이미 사본·기본 없음·한도·하루(내 버전 포함)', () => {
  const copied = run('topicFork', err(409, { reason: 'ALREADY_COPIED' }))
  assert.deepEqual([copied.kind, copied.text], ['copied', EDIT.copied])
  assert.equal(run('scenarioFork', err(409, { reason: 'ALREADY_COPIED' })).kind, 'copied')
  assert.equal(run('topicFork', err(404, { reason: 'SEED_NOT_FOUND' })).text, FAIL.seedGone)
  assert.equal(run('topicFork', err(409, { reason: 'TOPIC_LIMIT' })).text, FAIL.topicSave.limit)
  assert.equal(run('scenarioFork', err(409, { reason: 'SCENARIO_LIMIT' })).text, FAIL.scenarioSave.limit)
  assert.equal(run('topicFork', err(429, { reason: 'DAILY_LIMIT' })).text, FAIL.topicSave.dailyFork)
  assert.equal(run('scenarioFork', err(429, { reason: 'DAILY_LIMIT' })).text, FAIL.scenarioSave.daily)
})

test('지우기·되돌리기 #172·#173·#176 — 404·IMPACT_CHANGED(자동 재시도 없음)·400 ack·5xx', () => {
  assert.equal(run('removalPreview', err(404, { reason: 'TOPIC_GONE' })).text, REMOVAL.gone)
  assert.equal(run('removalPreview', err(500)).text, REMOVAL.loadFail)
  const preview = { topicId: 't1', ack: 'ch9' }
  const changed = run('topicDelete', err(409, { reason: 'IMPACT_CHANGED', preview }))
  assert.deepEqual([changed.kind, changed.text, changed.retry], ['impactChanged', REMOVAL.changed, false])
  assert.equal(changed.preview, preview)
  assert.equal(run('topicDelete', err(404, { reason: 'TOPIC_GONE' })).text, REMOVAL.gone)
  assert.equal(run('topicRestore', err(404, { reason: 'NOT_OVERRIDDEN' })).text, FAIL.notOverridden)
  assert.equal(run('topicDelete', err(400, { field: 'ack', reason: 'type' })).text, REMOVAL.fail.delete)
  assert.equal(run('topicRestore', err(500)).text, REMOVAL.fail.restore)
  assert.equal(run('topicHide', err(500)).text, REMOVAL.fail.hide)
})

test('숨긴 항목 #176 — NOT_OVERRIDDEN 은 성공처럼, 그 밖은 다시 눌러 달라고', () => {
  const shown = run('hiddenRestore', err(404, { reason: 'NOT_OVERRIDDEN' }))
  assert.deepEqual([shown.kind, shown.text], ['shown', HIDDEN.shown])
  assert.equal(run('hiddenRestore', err(500)).text, HIDDEN.fail)
})

test('상황 시트 #165·#176 — 404 는 이미 목록에 없음', () => {
  assert.equal(run('scenarioHide', err(404)).text, FAIL.scenarioGone)
  assert.equal(run('scenarioRevert', err(404, { reason: 'NOT_OVERRIDDEN' })).text, FAIL.scenarioGone)
  assert.equal(run('scenarioHide', err(500)).text, FAIL.scenarioHideFail)
  assert.equal(run('scenarioRevert', err(500)).text, FAIL.scenarioRevertFail)
})

test('첫마디 #178 — 칸·422 두 갈래·409·429(분/하루)·502', () => {
  assert.equal(run('openingDraft', err(400, { field: 'ko', reason: 'no_hangul' })).text, FAIL.opening.noHangul)
  assert.equal(run('openingDraft', err(400, { field: 'ko', reason: 'max_length' })).text, FAIL.opening.max)
  assert.equal(run('openingDraft', err(400, { field: 'ko', reason: 'required' })).text, FAIL.opening.required)
  assert.equal(run('openingDraft', err(422, { reason: 'NOT_AN_UTTERANCE' })).text, FAIL.opening.unfit)
  assert.equal(run('openingDraft', err(422, { reason: 'TOO_LONG' })).kind, 'tooLong')
  assert.equal(run('openingDraft', err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.opening.busy)
  assert.equal(run('openingDraft', err(429, { retryAfterSec: 9 })).text, FAIL.opening.rate(9))
  assert.equal(run('openingDraft', err(429, { retryAfterSec: 10000 })).text, '오늘은 일본어 만들기를 60번 모두 했어요. 약 3시간 뒤 다시 할 수 있어요.')
  const fail = run('openingDraft', err(502))
  assert.deepEqual([fail.text, fail.body, fail.retry], [FAIL.opening.fail, FAIL.opening.failKeep, true])
})

test('변형 #177 — 404·422 두 갈래·409·429·502', () => {
  assert.equal(run('variantDraft', err(404)).text, FAIL.variant.baseGone)
  assert.equal(run('variantDraft', err(422, { reason: 'NO_VARIATION' })).text, FAIL.variant.noVariation)
  assert.equal(run('variantDraft', err(422, { reason: 'NOT_A_VARIANT' })).text, FAIL.variant.unfit)
  assert.equal(run('variantDraft', err(409, { reason: 'DRAFT_BUSY' })).text, FAIL.variant.busy)
  assert.equal(run('variantDraft', err(429, { retryAfterSec: 5 })).text, FAIL.variant.rate(5))
  assert.equal(run('variantDraft', err(429, { retryAfterSec: 999 })).text, FAIL.scenarioDraft.daily)
  assert.equal(run('variantDraft', err(504)).text, FAIL.engine)
})

test('어느 경우에도 서버 문구·조사 병기·「AI」가 화면 문구로 나오지 않는다', () => {
  assert.ok(seen.length > 50)
  for (const f of seen) {
    for (const t of [f.text, f.body ?? '', ...f.problems.map((p) => p.text)]) {
      assert.notEqual(t, SERVER_MSG)
      assert.ok(!/\((을|를|은|는|이|가)\)/.test(t), t)
      assert.ok(!/\bAI\b/.test(t), t)
    }
  }
})
