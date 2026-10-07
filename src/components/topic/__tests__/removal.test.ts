import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/components/common/api'
import type { ChallengeListResponse } from '@/types/challenge'
import type { Topic, TopicChunk } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { RestoreSeedResult, SeedOverrideItem } from '@/types/seedOverride'
import type { TopicRemovalPreview, TopicRemovalResult } from '@/types/topic'
import {
  activeChallengeFor,
  buildTopicDetail,
  flashText,
  groupChunks,
  hiddenSeedItems,
  monthDayKst,
  parseFlash,
  removalActionLabel,
  removalFlash,
  removalView,
  REMOVAL_MODE_OF,
  restoreRemovalOf,
  topicScenarioNewHref,
  topicSheetHref,
} from '../logic'
import { FAIL, REMOVAL, TOAST, TOPIC } from '../topicCopy'
import { createRemovalFlow, type RemovalDeps, type RemovalState } from '../useTopicRemoval'

// task-045 T5-2 — 주제 보기(S6)·확인 시트(S8·S9) 상태 흐름·본문·돌아왔을 때 토스트. 실제 시트·360/390/412 실측은 QA.

const SERVER_MSG = '주제을(를) 지울 수 없어요'

const ref = (id: string, title: string) => ({ id, title })
const impact = (a: ReturnType<typeof ref>[] = [], u: ReturnType<typeof ref>[] = [], r: ReturnType<typeof ref>[] = []) => ({ scenariosArchived: a, scenariosUnlinked: u, scenariosRelinked: r })

function preview(over: Partial<TopicRemovalPreview> = {}): TopicRemovalPreview {
  const del = over.delete ?? impact([ref('s1', '접수에서 예약 확인하기'), ref('s2', '증상 말하기')], [ref('s3', '약국 가는 길 묻기')])
  return {
    topicId: 't1',
    title: '병원 진료',
    isSeed: false,
    isSeedCopy: false,
    ack: 'none',
    activeChallenge: null,
    finishedChallenges: 0,
    ...del,
    delete: del,
    restore: null,
    doneLessons: 2,
    chunks: 10,
    ...over,
  }
}

const active = { id: 'c1', title: '병원 진료 14일', day: 4, lengthDays: 14 }

function result(over: Partial<TopicRemovalResult> = {}): TopicRemovalResult {
  return { topicId: 't1', result: 'REMOVED', mode: 'DELETE', challengeDeleted: false, deletedChallengeId: null, scenariosArchived: 2, scenariosUnlinked: 1, scenariosRelinked: 0, seedId: null, ...over }
}

const tick = () => new Promise((r) => setImmediate(r))

interface Fake {
  deps: RemovalDeps
  calls: { preview: string[]; remove: Array<[string, string]>; restore: unknown[] }
  /** 다음 응답을 차례로(값 또는 던질 오류). */
  previews: Array<TopicRemovalPreview | Error>
  removes: Array<TopicRemovalResult | Error>
  restores: Array<RestoreSeedResult | Error>
}

function fake(): Fake {
  const f: Fake = {
    calls: { preview: [], remove: [], restore: [] },
    previews: [],
    removes: [],
    restores: [],
    deps: {
      preview: async (id) => {
        f.calls.preview.push(id)
        const v = f.previews.shift()
        if (!v) throw new Error('no preview queued')
        if (v instanceof Error) throw v
        return v
      },
      remove: async (id, ack) => {
        f.calls.remove.push([id, ack])
        const v = f.removes.shift()
        if (!v) throw new Error('no remove queued')
        if (v instanceof Error) throw v
        return v
      },
      restore: async (body) => {
        f.calls.restore.push(body)
        const v = f.restores.shift()
        if (!v) throw new Error('no restore queued')
        if (v instanceof Error) throw v
        return v
      },
    },
  }
  return f
}

function flowWith(f: Fake) {
  const seen: RemovalState[] = []
  const flow = createRemovalFlow(f.deps, (s) => seen.push(s))
  return { flow, seen }
}

test('흐름: 열기 → #172 → ready, 확인 → #173 에 미리보기 ack, 더블 탭은 요청 1건', async () => {
  const f = fake()
  f.previews.push(preview({ ack: 'c1', activeChallenge: active }))
  f.removes.push(result({ challengeDeleted: true }))
  const { flow, seen } = flowWith(f)
  flow.open({ mode: 'delete', topicId: 't1', seedId: null })
  assert.equal(flow.state().phase, 'loading')
  await tick()
  assert.equal(flow.state().phase, 'ready')
  const a = flow.confirm()
  const b = flow.confirm()
  assert.equal(flow.state().phase, 'busy')
  await Promise.all([a, b])
  assert.deepEqual(f.calls.remove, [['t1', 'c1']])
  assert.equal(flow.state().phase, 'done')
  assert.equal(flow.state().result?.challengeDeleted, true)
  assert.ok(seen.some((s) => s.phase === 'busy'))
})

test('흐름: 409 IMPACT_CHANGED → details.preview 로 다시 그리고 자동 재시도 없음 → 다시 눌러야 새 ack 로 지움', async () => {
  const f = fake()
  const fresh = preview({ ack: 'c9', activeChallenge: { ...active, id: 'c9', title: '병원 진료 7일', day: 1, lengthDays: 7 } })
  f.previews.push(preview({ ack: 'none' }))
  f.removes.push(new ApiError(SERVER_MSG, 409, null, { reason: 'IMPACT_CHANGED', preview: fresh }))
  const { flow } = flowWith(f)
  flow.open({ mode: 'delete', topicId: 't1', seedId: null })
  await tick()
  await flow.confirm()
  await tick()
  const s = flow.state()
  assert.equal(s.phase, 'ready')
  assert.equal(s.changed, true)
  assert.equal(s.preview?.ack, 'c9')
  assert.equal(s.error, null)
  assert.equal(f.calls.remove.length, 1, '409 뒤 저절로 다시 보내지 않는다')
  assert.equal(removalActionLabel('delete', s.preview, false), REMOVAL.btnWithChallenge.delete)
  const v = removalView('delete', s.preview as TopicRemovalPreview)
  assert.equal(v.warn?.text, REMOVAL.warn.delete('병원 진료 7일', 1))

  f.removes.push(result({ challengeDeleted: true }))
  await flow.confirm()
  assert.deepEqual(f.calls.remove, [
    ['t1', 'none'],
    ['t1', 'c9'],
  ])
  assert.equal(flow.state().phase, 'done')
})

test('흐름: 409 의 preview 가 모양이 아니면 #172 를 다시 읽는다(옛 ack 로 다시 보내지 않음)', async () => {
  const f = fake()
  f.previews.push(preview({ ack: 'none' }), preview({ ack: 'c2', activeChallenge: active }))
  f.removes.push(new ApiError(SERVER_MSG, 409, null, { reason: 'IMPACT_CHANGED', preview: { nope: true } }))
  const { flow } = flowWith(f)
  flow.open({ mode: 'copyDelete', topicId: 't1', seedId: 'seed-1' })
  await tick()
  await flow.confirm()
  await tick()
  assert.equal(f.calls.preview.length, 2)
  assert.equal(flow.state().phase, 'ready')
  assert.equal(flow.state().changed, true)
  assert.equal(flow.state().preview?.ack, 'c2')
  assert.equal(f.calls.remove.length, 1)
})

test('흐름: 숨기기는 ack 대신 none, 되돌리기는 #176 {kind:TOPIC, seedId, ack}', async () => {
  const f = fake()
  f.previews.push(preview({ isSeed: true, ack: 'c1', activeChallenge: active, ...impact(), delete: impact() }))
  f.removes.push(result({ result: 'HIDDEN', scenariosArchived: 0, scenariosUnlinked: 0 }))
  const hide = flowWith(f).flow
  hide.open({ mode: 'hide', topicId: 'seed-t', seedId: null })
  await tick()
  await hide.confirm()
  assert.deepEqual(f.calls.remove, [['seed-t', 'none']])

  const g = fake()
  g.previews.push(preview({ isSeedCopy: true, ack: 'c1', activeChallenge: active, restore: impact([], [], [ref('s1', '카페에서 주문하기')]) }))
  g.restores.push({ kind: 'TOPIC', seedId: 'seed-cafe', path: 'COPY', copyId: 't1', removal: { ...result({ mode: 'RESTORE', scenariosRelinked: 1, scenariosArchived: 0 }) } })
  const restore = flowWith(g).flow
  restore.open({ mode: 'restore', topicId: 't1', seedId: 'seed-cafe' })
  await tick()
  await restore.confirm()
  assert.deepEqual(g.calls.restore, [{ kind: 'TOPIC', seedId: 'seed-cafe', ack: 'c1' }])
  assert.equal(restore.state().result?.mode, 'RESTORE')
  assert.equal(restore.state().result?.scenariosRelinked, 1)
  assert.equal(g.calls.remove.length, 0)
})

test('흐름: 되돌리기인데 시드 id 를 모르면 요청하지 않고 실패 문구', async () => {
  const f = fake()
  f.previews.push(preview({ isSeedCopy: true }))
  const { flow } = flowWith(f)
  flow.open({ mode: 'restore', topicId: 't1', seedId: null })
  await tick()
  await flow.confirm()
  assert.equal(f.calls.restore.length, 0)
  assert.equal(flow.state().phase, 'ready')
  assert.equal(flow.state().error, REMOVAL.fail.restore)
})

test('흐름: 실패 문구는 고정 문구(서버 문구 아님) · 404 는 gone · NOT_OVERRIDDEN 은 notOverridden', async () => {
  const f = fake()
  f.previews.push(preview())
  f.removes.push(new ApiError(SERVER_MSG, 500))
  const { flow } = flowWith(f)
  flow.open({ mode: 'delete', topicId: 't1', seedId: null })
  await tick()
  await flow.confirm()
  assert.equal(flow.state().phase, 'ready')
  assert.equal(flow.state().error, REMOVAL.fail.delete)
  assert.ok(!flow.state().error?.includes('(를)'))

  f.removes.push(new ApiError(SERVER_MSG, 404, null, { reason: 'TOPIC_GONE' }))
  await flow.confirm()
  assert.equal(flow.state().phase, 'gone')
  assert.equal(flow.state().goneKind, 'gone')

  const g = fake()
  g.previews.push(preview({ isSeedCopy: true }))
  g.restores.push(new ApiError(SERVER_MSG, 404, null, { reason: 'NOT_OVERRIDDEN' }))
  const r = flowWith(g).flow
  r.open({ mode: 'restore', topicId: 't1', seedId: 'seed-1' })
  await tick()
  await r.confirm()
  assert.equal(r.state().goneKind, 'notOverridden')

  const h = fake()
  h.previews.push(new ApiError(SERVER_MSG, 404))
  const p = flowWith(h).flow
  p.open({ mode: 'delete', topicId: 'gone', seedId: null })
  await tick()
  assert.equal(p.state().phase, 'gone')

  const k = fake()
  k.previews.push(new ApiError(SERVER_MSG, 502), preview())
  const q = flowWith(k).flow
  q.open({ mode: 'delete', topicId: 't1', seedId: null })
  await tick()
  assert.equal(q.state().phase, 'loadFail')
  assert.equal(q.state().error, REMOVAL.loadFail)
  await q.confirm()
  assert.equal(k.calls.remove.length, 0, '확인 실패 중에는 실행하지 않는다')
  q.retryLoad()
  await tick()
  assert.equal(q.state().phase, 'ready')
})

test('흐름: 닫은 뒤 늦게 온 미리보기는 버린다 · 실행 중에는 닫히지 않는다', async () => {
  const f = fake()
  f.previews.push(preview())
  const { flow } = flowWith(f)
  flow.open({ mode: 'delete', topicId: 't1', seedId: null })
  flow.close()
  await tick()
  assert.equal(flow.state().phase, 'idle')

  const g = fake()
  g.previews.push(preview())
  let release: (v: TopicRemovalResult) => void = () => {}
  g.deps.remove = () => new Promise((r) => (release = r))
  const busy = flowWith(g).flow
  busy.open({ mode: 'delete', topicId: 't1', seedId: null })
  await tick()
  const pending = busy.confirm()
  busy.close()
  assert.equal(busy.state().phase, 'busy')
  release(result())
  await pending
  assert.equal(busy.state().phase, 'done')
})

test('본문: 네 mode 문구가 미리보기 값과 맞고 완료 기록 줄은 finishedChallenges>0 일 때만', () => {
  const p0 = preview()
  const d = removalView('delete', p0)
  assert.equal(d.warn, null)
  assert.deepEqual(
    d.leads.map((l) => l.text),
    [REMOVAL.noActive],
  )
  assert.deepEqual(d.gone, [{ text: REMOVAL.goneScenarios(2), sub: '접수에서 예약 확인하기 · 증상 말하기' }])
  assert.deepEqual(
    d.keep.map((l) => l.text),
    [REMOVAL.keepUnlinked(1), REMOVAL.keepRecords],
  )
  assert.ok(!d.keep.some((l) => l.text === REMOVAL.keepFinished))
  assert.equal(removalActionLabel('delete', p0, false), REMOVAL.btn.delete)

  const p1 = preview({ activeChallenge: active, finishedChallenges: 2 })
  const da = removalView('delete', p1)
  assert.equal(da.warn?.tone, 'bad')
  assert.equal(da.warn?.title, REMOVAL.warnTitle)
  assert.equal(da.warn?.text, REMOVAL.warn.delete('병원 진료 14일', 4))
  assert.ok(!da.leads.some((l) => l.text === REMOVAL.noActive))
  assert.deepEqual(da.gone[1], { text: REMOVAL.goneChallenge, sub: TOPIC.challenge('병원 진료 14일', 4, 14) })
  assert.equal(da.keep[0].text, REMOVAL.keepFinished)

  const cd = removalView('copyDelete', p0)
  assert.deepEqual(
    cd.leads.map((l) => l.text),
    [REMOVAL.copyDeleteBody, REMOVAL.noActive],
  )
  assert.equal(removalActionLabel('copyDelete', p1, false), REMOVAL.btnWithChallenge.delete)
  assert.equal(removalActionLabel('copyDelete', p1, true), REMOVAL.busy.delete)

  const pr = preview({ isSeedCopy: true, restore: impact([], [], [ref('s1', '카페에서 주문하기')]) })
  const r = removalView('restore', pr)
  assert.deepEqual(
    r.leads.map((l) => l.text),
    [REMOVAL.restoreBody, REMOVAL.noActiveRestore],
  )
  assert.deepEqual(r.back, [{ text: REMOVAL.relinked(1), sub: '카페에서 주문하기' }])
  assert.deepEqual(r.gone, [], '되돌리기는 내 상황을 지우지 않는다')
  assert.equal(removalActionLabel('restore', pr, false), REMOVAL.btn.restore)
  const ra = removalView('restore', { ...pr, activeChallenge: active })
  assert.equal(ra.warn?.text, REMOVAL.warn.restore('병원 진료 14일', 4))
  assert.equal(removalActionLabel('restore', { ...pr, activeChallenge: active }, false), REMOVAL.btnWithChallenge.restore)

  const ps = preview({ isSeed: true, activeChallenge: active, ...impact(), delete: impact() })
  const h = removalView('hide', ps)
  assert.equal(h.warn?.tone, 'info', '숨겨도 챌린지는 이어진다 — 경고가 아니라 안내')
  assert.equal(h.warn?.text, REMOVAL.warn.hide('병원 진료 14일'))
  assert.deepEqual(h.leads, [{ text: REMOVAL.hideBody, info: true }])
  assert.deepEqual(h.gone, [])
  assert.equal(removalActionLabel('hide', ps, false), REMOVAL.btn.hide, '숨기기는 챌린지를 지우지 않아 「챌린지까지」가 아니다')
  assert.equal(removalActionLabel('hide', null, false), REMOVAL.checking)
  assert.equal(REMOVAL_MODE_OF.MINE, 'delete')
  assert.equal(REMOVAL_MODE_OF.SEED, 'hide')
  assert.equal(REMOVAL_MODE_OF.COPY, 'copyDelete')
})

test('되돌리기 응답: removal 이 비어도 0 으로 채운다', () => {
  const r = restoreRemovalOf({ kind: 'TOPIC', seedId: 'seed-1', path: 'COPY', copyId: 't1', removal: null }, 't1')
  assert.equal(r.mode, 'RESTORE')
  assert.equal(r.scenariosRelinked, 0)
  assert.equal(r.seedId, 'seed-1')
})

test('돌아왔을 때 토스트: 숫자는 응답 값 · 저장소 값은 모양만 받는다 · 조사 병기 없음', () => {
  const f = removalFlash('delete', 'Café ☕', result({ scenariosArchived: 3, challengeDeleted: true }))
  assert.deepEqual(parseFlash(JSON.stringify(f)), f)
  assert.equal(flashText(f), TOAST.removed('Café ☕', 3, true))
  assert.ok(flashText(f).includes('상황 3개'))
  assert.equal(flashText(removalFlash('copyDelete', '카페 주문', result())), TOAST.copyRemoved('카페 주문'))
  assert.equal(flashText(removalFlash('hide', '길 묻기', result({ result: 'HIDDEN' }))), TOAST.hidden('길 묻기'))
  assert.equal(flashText(removalFlash('restore', '카페 주문', result({ mode: 'RESTORE' }))), TOAST.restored('카페 주문'))
  assert.equal(flashText({ kind: 'gone' }), REMOVAL.gone)
  assert.equal(flashText({ kind: 'notOverridden' }), FAIL.notOverridden)
  for (const t of ['Hello', '😀', '숲', 'abc1']) {
    for (const x of [TOAST.removed(t, 1, false), TOAST.hidden(t), TOAST.copyRemoved(t), TOAST.restored(t)]) assert.ok(!/\((을|를|은|는|이|가)\)|을\(를\)|은\(는\)/.test(x), x)
  }
  assert.equal(parseFlash(null), null)
  assert.equal(parseFlash('{'), null)
  assert.equal(parseFlash(JSON.stringify({ kind: 'removed' })), null)
  assert.equal(parseFlash(JSON.stringify({ kind: 'evil', title: 'x' })), null)
  assert.deepEqual(parseFlash(JSON.stringify({ kind: 'removed', title: 'a', scenarios: -2, challenge: 'yes' })), { kind: 'removed', title: 'a', scenarios: 0, challenge: false })
})

const chunk = (id: string, chunkType: string, order: number): TopicChunk => ({ id, chunkType, textJa: `日${id}`, reading: null, meaningKo: `뜻${id}`, order }) as unknown as TopicChunk
const topic = (id: string, over: Partial<Topic> = {}): Topic =>
  ({ id, title: `주제${id}`, titleJa: null, level: 'N4', description: null, tags: [], isSeed: false, chunks: [], lessonCount: 0, lastLessonAt: null, ...over }) as Topic
const ov = (o: Partial<SeedOverrideItem>): SeedOverrideItem => ({ kind: 'TOPIC', seedId: 'seed', state: 'COPIED', copyId: null, orphan: false, updatedAt: '2026-10-06T16:30:00Z', seedTitle: null, ...o })
const sc = (id: string, topicIds: string[], isMine = true): ScenarioListItem => ({ id, isMine, topics: topicIds.map((t) => ({ id: t, title: t })) }) as unknown as ScenarioListItem
const challenges = (topicId: string | null, dayIndex: number): ChallengeListResponse =>
  ({ items: [{ id: 'c1', title: '카페 주문 7일', status: 'ACTIVE', lengthDays: 7, topic: { id: topicId, title: 'x', exists: true }, stats: { dayIndex } }], nextCursor: null }) as unknown as ChallengeListResponse

test('주제 보기: 목록에서 id 로 찾기 · 출처·시드 id·만든 날 · 이 주제의 상황 · 진행 중 챌린지', () => {
  const topics = [topic('mine1'), topic('copy1', { chunks: [chunk('a', 'ACTION', 2), chunk('b', 'NAME', 1), chunk('c', 'ODD', 3)] }), topic('seed1', { isSeed: true })]
  const overrides = [ov({ seedId: 'seed-cafe', copyId: 'copy1' }), ov({ kind: 'SCENARIO', seedId: 'ss1', copyId: 'sc2' }), ov({ seedId: 'seed-x', state: 'HIDDEN' })]
  const scenarios = [sc('sc1', ['copy1', 'mine1']), sc('sc2', ['copy1']), sc('sc3', ['seed1'], false)]
  assert.equal(buildTopicDetail('nope', { topics, overrides, scenarios, challenges: null }), null)

  const v = buildTopicDetail('copy1', { topics, overrides, scenarios, challenges: challenges('copy1', 3) })
  assert.ok(v)
  assert.equal(v.origin, 'COPY')
  assert.equal(v.seedId, 'seed-cafe')
  assert.equal(v.copyDate, '10월 7일', 'KST 기준 날짜')
  assert.deepEqual(
    v.scenarios?.map((r) => [r.item.id, r.origin]),
    [
      ['sc1', 'MINE'],
      ['sc2', 'COPY'],
    ],
  )
  assert.deepEqual(v.challenge, { id: 'c1', title: '카페 주문 7일', day: 3, lengthDays: 7 })
  assert.deepEqual(
    v.chunkGroups.map((g) => [g.type, g.chunks.map((c) => c.id)]),
    [
      ['NAME', ['b']],
      ['ACTION', ['a']],
      ['ODD', ['c']],
    ],
  )
  assert.equal(v.chunkCount, 3)

  const m = buildTopicDetail('mine1', { topics, overrides, scenarios: null, challenges: challenges('copy1', 3) })
  assert.equal(m?.origin, 'MINE')
  assert.equal(m?.scenarios, null, '#161 실패 — 그 절만 오류')
  assert.equal(m?.challenge, null, '다른 주제의 챌린지는 싣지 않는다')
  assert.equal(buildTopicDetail('seed1', { topics, overrides, scenarios, challenges: null })?.origin, 'SEED')
  assert.equal(activeChallengeFor(challenges('copy1', 0), 'copy1'), null, '시작 전(0일째)은 싣지 않는다')
  assert.equal(monthDayKst('nope'), null)
  assert.equal(groupChunks([]).length, 0)
})

test('숨긴 기본 항목: 숨김 + 고아(두 종류 모두) · 주소', () => {
  const items = hiddenSeedItems([
    ov({ state: 'HIDDEN', seedId: 'a' }),
    ov({ seedId: 'b', copyId: 'x' }),
    ov({ kind: 'SCENARIO', state: 'HIDDEN', seedId: 'c' }),
    ov({ seedId: 'd', orphan: true }),
  ])
  assert.deepEqual(
    items.map((o) => o.seedId),
    ['a', 'c', 'd'],
  )
  assert.equal(topicSheetHref('t 1', 'sc1'), '/settings/scenarios/topics/t%201?sc=sc1')
  assert.equal(topicSheetHref('t1', null), '/settings/scenarios/topics/t1')
  assert.equal(topicScenarioNewHref('t1'), '/study/ai/scenario/new?from=manage&topicId=t1')
})

test('R1~R6: 주제 보기의 router.replace 는 모두 { scroll: false }', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const src = strip(readFileSync(join(__dirname, '..', 'TopicDetail.tsx'), 'utf8'))
  const calls = [...src.matchAll(/router\.replace\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(calls.length >= 5, `시트 열기·닫기·지운 뒤·되돌린 뒤·없음 다섯 곳: ${calls.length}`)
  for (const c of calls) assert.match(c, /\{\s*scroll:\s*false\s*\}/, c)
  assert.ok(!/\bkey=\{/.test(src.replace(/<li key=\{[^}]+\}|<div key=\{[^}]+\}/g, '')), '목록 밖 key 바꾸기 금지')
})
