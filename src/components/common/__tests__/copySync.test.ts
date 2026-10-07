import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FAIL as TOPIC_FAIL } from '@/components/topic/topicCopy'
import { copyIdSet, scenarioOrigin } from '@/components/topic/logic'
import { sheetOrigin } from '@/components/scenario/logic'
import { CHECK, FAIL as SCENARIO_FAIL } from '@/components/scenario/scenarioCopy'

/*
 * task-045 REV-160 M-1·L-2 — 주제 쪽(`topic/`)과 상황 쪽(`scenario/`)이 따로 가진 같은 뜻의 서버 오류 문구·출처 판정이 어긋나지 않게 묶는다.
 * 앱 코드는 scenario → topic import 가 금지라 문구가 두 벌이다. 한쪽만 고치면 이 시험이 실패한다(시험 파일은 두 폴더를 모두 읽어도 된다).
 */

test('400 칸 문구: 숨은 글자·꺾쇠·링크 / 비밀 모양 글 — 두 벌이 같은 글자(REV-159 M-1·L-1 이 새 화면에서 재발하지 않게)', () => {
  assert.equal(CHECK.forbidden, TOPIC_FAIL.field.forbiddenChar)
  assert.equal(CHECK.secretLike, TOPIC_FAIL.field.secretLike)
})

test('공통 오류 문구: 네트워크·계정·분당 한도·하루 한도 남은 때·기본 항목·숨김·되돌리기', () => {
  assert.equal(SCENARIO_FAIL.network, TOPIC_FAIL.network)
  assert.equal(SCENARIO_FAIL.userGone, TOPIC_FAIL.userGone)
  assert.equal(SCENARIO_FAIL.writeRate(7), TOPIC_FAIL.writeRate(7))
  for (const sec of [30, 90, 3599, 3600, 7200]) assert.equal(SCENARIO_FAIL.waitAbout(sec), TOPIC_FAIL.waitAbout(sec), String(sec))
  assert.equal(SCENARIO_FAIL.seedGone, TOPIC_FAIL.seedGone)
  assert.equal(SCENARIO_FAIL.notOverridden, TOPIC_FAIL.notOverridden)
  assert.equal(SCENARIO_FAIL.scenarioGone, TOPIC_FAIL.scenarioGone)
  assert.equal(SCENARIO_FAIL.hideFail, TOPIC_FAIL.scenarioHideFail)
  assert.equal(SCENARIO_FAIL.revertFail, TOPIC_FAIL.scenarioRevertFail)
})

test('첫마디 일본어 만들기(#178) 문구: 주제 쪽 새 상황 편집과 상황 편집기가 같은 글자', () => {
  const t = TOPIC_FAIL.opening
  const s = SCENARIO_FAIL.opening
  assert.equal(s.unfit, t.unfit)
  assert.equal(s.tooLong, t.tooLong)
  assert.equal(s.busy, t.busy)
  assert.equal(s.rate(20), t.rate(20))
  assert.equal(s.daily('약 2시간 뒤'), t.daily('약 2시간 뒤'))
  assert.equal(s.fail, t.fail)
  assert.equal(s.failKeep, t.failKeep)
  assert.equal(s.max, t.max)
  assert.equal(CHECK.required('openingKo'), t.required)
  assert.equal(CHECK.noHangul, t.noHangul)
})

test('출처 판정(REV-160 L-2): 목록 뱃지(topic)와 시트 행동 줄(scenario)이 같은 기준 — 기본·내 버전·내 상황·고아 사본', () => {
  const all = [
    { seedId: 's1', kind: 'SCENARIO', state: 'COPIED', copyId: 'c1', orphan: false },
    { seedId: 's2', kind: 'SCENARIO', state: 'HIDDEN', copyId: null, orphan: false },
    { seedId: 's3', kind: 'SCENARIO', state: 'COPIED', copyId: 'c3', orphan: true },
    // 주제 쪽 사본은 상황 판정에 끼지 않는다(시트는 #179 를 `kind=SCENARIO` 로 부른다).
    { seedId: 't1', kind: 'TOPIC', state: 'COPIED', copyId: 'c9', orphan: false },
  ] as unknown as Parameters<typeof copyIdSet>[0]
  const ids = copyIdSet(all, 'SCENARIO')
  const sheetRows = all.filter((o) => o.kind === 'SCENARIO') as unknown as NonNullable<Parameters<typeof sheetOrigin>[1]>
  const expected: Record<string, string> = { s9: 'SEED', c1: 'COPY', c3: 'MINE', c9: 'MINE', mine: 'MINE' }
  for (const [id, want] of Object.entries(expected)) {
    const item = { id, isMine: id !== 's9' }
    assert.equal(scenarioOrigin(item, ids), want, `topic ${id}`)
    assert.equal(sheetOrigin(item, sheetRows), want, `sheet ${id}`)
  }
})
