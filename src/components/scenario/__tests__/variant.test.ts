import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/components/common/api'
import { isTopicGone, resultHeroView, resultNextView, type RetryGate } from '@/components/challenge/logic'
import { COPY, CREATE } from '@/components/challenge/challengeCopy'
import type { ChallengeDetail } from '@/types/challenge'
import { SCENARIO_VARIANT_AXIS_KEYS, SCENARIO_VARIANT_AXIS_LABELS, SCENARIO_VARIANT_FIELDS, SCENARIO_VARIANT_NO_AXES, SCENARIO_VARIANT_NO_CHANGE_MESSAGE, type ScenarioVariantAxes } from '@/types/scenarioVariant'
import { scenarioFailure } from '../failure'
import type { EditableDraft } from '../logic'
import { CHECK, FAIL, SHEET, VARIANT, scenarioVariantHref } from '../scenarioCopy'
import {
  VARIANT_CANCEL_LOCK_MS,
  VARIANT_LONG_MS,
  VARIANT_TIMEOUT_MS,
  axisOptions,
  createVariantFlight,
  hasVariation,
  pickAxis,
  submitBlock,
  variantRequestBody,
  variantResult,
  variantSaveBody,
  type VariantFlightState,
} from '../variantLogic'

/* task-045 T5-5b — 변형 상황 만들기 A(#177·#163) · 「바뀜」 · 주제가 지워진 완료 챌린지. */

const NONE: ScenarioVariantAxes = { ...SCENARIO_VARIANT_NO_AXES }
const err = (status: number, details: Record<string, unknown> = {}, retryAfterSec: number | null = null) => ({ status, message: '서버 내부 문구(을(를))', code: null, details, retryAfterSec })

/* ── 축 고르기 ── */

test('칩 라벨은 types/scenarioVariant 단일 출처 그대로, 표현 수준만 수준 글자를 붙인다', () => {
  for (const k of SCENARIO_VARIANT_AXIS_KEYS) {
    if (k === 'level') continue
    const opts = axisOptions(k, 'N4')
    const labels = SCENARIO_VARIANT_AXIS_LABELS[k].options as Record<string, string>
    assert.deepEqual(
      opts.map((o) => o.label),
      opts.map((o) => labels[o.value]),
    )
    assert.ok(opts.every((o) => !o.disabled))
  }
  assert.deepEqual(
    axisOptions('persona', 'N5').map((o) => o.label),
    ['그대로', '친절해요', '바빠서 말이 빨라요', '꼼꼼히 되물어요'],
  )
  assert.deepEqual(
    axisOptions('level', 'N5').map((o) => [o.label, o.disabled]),
    [
      ['그대로(N5)', false],
      ['한 단계 위(N4)', false],
    ],
  )
  assert.deepEqual(
    axisOptions('level', 'N3').map((o) => o.label),
    ['그대로(N3)', '한 단계 위(N2)'],
  )
})

test('기준이 N1 이면 「한 단계 위」는 막히고(aria-disabled 용 disabled) 눌러도 바뀌지 않는다', () => {
  const up = axisOptions('level', 'N1').find((o) => o.value === 'up')!
  assert.equal(up.disabled, true)
  assert.equal(up.label, '한 단계 위')
  assert.equal(pickAxis(NONE, 'level', 'up', 'N1'), NONE)
  assert.equal(pickAxis(NONE, 'level', 'up', 'N2').level, 'up')
  assert.equal(VARIANT.levelTop, '이미 가장 높은 수준이라 올릴 수 없어요.')
})

test('칩 누르기: 목록에 없는 값 무시 · 같은 값이면 같은 객체(다시 그리지 않음) · 다른 축은 그대로', () => {
  assert.equal(pickAxis(NONE, 'persona', 'angry', 'N5'), NONE)
  assert.equal(pickAxis(NONE, 'persona', 'same', 'N5'), NONE)
  const a = pickAxis(NONE, 'twist', 'mishear', 'N5')
  assert.deepEqual(a, { ...NONE, twist: 'mishear' })
  assert.equal(pickAxis(a, 'twist', 'mishear', 'N5'), a)
})

test('하나도 안 고르면 막힘(직접 적기만 적어도) — 이유는 서버 NO_VARIATION 과 같은 글', () => {
  assert.equal(submitBlock(NONE, '', 'N5'), 'noChange')
  assert.equal(submitBlock(NONE, '상대가 처음에 못 알아들어요', 'N5'), 'noChange')
  assert.equal(submitBlock({ ...NONE, level: 'up' }, '', 'N1'), 'noChange')
  assert.equal(hasVariation({ ...NONE, level: 'up' }, 'N1'), false)
  assert.equal(submitBlock({ ...NONE, flow: 'suggest' }, '', 'N5'), null)
  assert.equal(submitBlock({ ...NONE, flow: 'suggest' }, '가'.repeat(101), 'N5'), 'noteLong')
  assert.equal(submitBlock({ ...NONE, flow: 'suggest' }, '가'.repeat(100), 'N5'), null)
  assert.equal(VARIANT.noChange, SCENARIO_VARIANT_NO_CHANGE_MESSAGE)
})

test('#177 본문 — 바꾸는 축만 · 직접 적기는 한 줄 정리, 비면 뺀다 · N1 의 up 은 싣지 않는다', () => {
  assert.deepEqual(variantRequestBody({ ...NONE, persona: 'busy', level: 'up' }, '  ', 'N4'), { axes: { persona: 'busy', level: 'up' } })
  assert.deepEqual(variantRequestBody({ ...NONE, twist: 'trouble' }, ' 카드가\n 안 돼요 ', 'N5'), { axes: { twist: 'trouble' }, note: '카드가 안 돼요' })
  assert.deepEqual(variantRequestBody({ ...NONE, persona: 'kind', level: 'up' }, '', 'N1'), { axes: { persona: 'kind' } })
  const body = variantRequestBody({ persona: 'picky', twist: 'unavailable', flow: 'rephrase', level: 'up' }, '가'.repeat(100), 'N5')
  assert.ok(new TextEncoder().encode(JSON.stringify(body)).length < 4 * 1024)
  assert.deepEqual(Object.keys(body).sort(), ['axes', 'note'])
})

/* ── 응답·저장 ── */

const response = {
  draft: {
    title: '카페에서 주문하기 · 품절',
    titleJa: 'カフェで注文する（品切れ）',
    description: '카페에서 음료를 주문해요',
    level: 'N5',
    difficulty: 2,
    roles: { learner: '손님', tutor: '바쁜 점원' },
    goal: { communicativeGoalKo: '품절일 때 다른 음료로 바꿔 주문해요', successCriteria: ['다른 음료로 바꿔 주문해요'] },
    steps: [{ ko: '주문하기' }, { ko: '품절 안내 알아듣기' }, { ko: '바꿔서 주문하기' }],
    keyExpressions: [
      { ja: 'カフェラテはありますか', ko: '카페라테 있어요?' },
      { ja: 'じゃあ、紅茶にします', ko: '그럼 홍차로 할게요' },
    ],
    opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' },
    topicIds: ['t_cafe00000001'],
  },
  changedFields: ['title', 'roles', 'goal', 'steps', 'nonsense', 'description'],
  axes: { persona: 'busy', twist: 'unavailable', flow: 'same', level: 'same' },
}

test('응답 → 편집 값: 장소는 응답 draft.topicIds(원본 장소) · 「바뀜」은 알려진 칸만(설명 없음) · 쓸 수 없으면 null', () => {
  const v = variantResult(response, 'N5')!
  assert.ok(v)
  assert.deepEqual(v.draft.topicIds, ['t_cafe00000001'])
  assert.equal(v.description, '카페에서 음료를 주문해요')
  assert.deepEqual([...v.changed].sort(), ['goal', 'roles', 'steps', 'title'])
  assert.ok(!(v.changed as ReadonlySet<string>).has('description'))
  assert.equal(v.draft.opening?.ja, 'いらっしゃいませ')
  assert.equal(variantResult({}, 'N5'), null)
  assert.equal(variantResult({ draft: { title: '  ' } }, 'N5'), null)
  assert.equal(variantResult(null, 'N5'), null)
})

test('저장 본문(#163) — 고친 값 + 원본 설명 · 직접 적은 글(note)은 싣지 않는다 · 장소 유지', () => {
  const v = variantResult(response, 'N5')!
  const edited: EditableDraft = { ...v.draft, title: '카페 품절 상황' }
  const body = variantSaveBody(v, edited) as unknown as Record<string, unknown>
  assert.ok(!('note' in body))
  assert.ok(!JSON.stringify(body).includes('note'))
  assert.equal(body.title, '카페 품절 상황')
  assert.equal(body.description, '카페에서 음료를 주문해요')
  assert.deepEqual(body.topicIds, ['t_cafe00000001'])
  assert.deepEqual(body.opening, { ja: 'いらっしゃいませ', ko: '어서 오세요' })
  assert.ok(!(body.keyExpressions as { id?: string }[]).some((e) => 'id' in e))
})

/* ── #177 오류 → 고정 문구(서버 message 를 쓰지 않는다) ── */

test('#177 실패 문구: 404 원본 없음 · 422 NO_VARIATION/NOT_A_VARIANT · 409 · 429 분/하루 · 502 · 네트워크 · 400 note', () => {
  const f = (e: ReturnType<typeof err>) => scenarioFailure('variantDraft', e)
  assert.deepEqual([f(err(404)).kind, f(err(404)).text], ['gone', VARIANT.baseGone])
  assert.equal(f(err(404, { reason: 'USER_GONE' })).kind, 'userGone')
  assert.deepEqual([f(err(422, { reason: 'NO_VARIATION' })).kind, f(err(422, { reason: 'NO_VARIATION' })).text], ['noChange', VARIANT.noChange])
  assert.deepEqual([f(err(422, { reason: 'NOT_A_VARIANT' })).kind, f(err(422, { reason: 'NOT_A_VARIANT' })).text], ['unfit', VARIANT.unfit])
  assert.deepEqual([f(err(409, { reason: 'DRAFT_BUSY' })).kind, f(err(409, { reason: 'DRAFT_BUSY' })).text], ['busy', VARIANT.busy])
  const rate = f(err(429, {}, 30))
  assert.deepEqual([rate.kind, rate.text, rate.block], ['rate', VARIANT.rate(30), false])
  const daily = f(err(429, {}, 7200))
  assert.deepEqual([daily.kind, daily.text, daily.block], ['daily', FAIL.draftDaily, true])
  const eng = f(err(502))
  assert.deepEqual([eng.kind, eng.text, eng.retry], ['engine', VARIANT.fail, true])
  assert.equal(f(err(504)).text, VARIANT.fail)
  assert.equal(f(err(0)).text, FAIL.network)
  const note = f(err(400, { field: 'note', reason: 'max_length', problems: [{ field: 'note', reason: 'max_length' }] }))
  assert.deepEqual([note.kind, note.problems[0]?.field, note.text], ['field', 'note', VARIANT.noteTooLong])
  assert.equal(f(err(400, { field: 'note', reason: 'secret_like' })).text, CHECK.secretLike)
  assert.equal(f(err(400, { field: 'note', reason: 'url' })).text, CHECK.forbidden)
  assert.equal(f(err(400, { field: 'axes', reason: 'required' })).kind, 'noChange')
  assert.equal(f(err(400, { field: 'axes.persona', reason: 'enum' })).text, CHECK.defect)
  for (const e of [err(404), err(422), err(409), err(429, {}, 5), err(502), err(400, { field: 'note', reason: 'max_length' })]) assert.ok(!f(e).text.includes('서버 내부 문구'))
})

/* ── 요청 한 건의 흐름 — 더블 탭 1건 · 취소 잠금 800ms · 20초 한 줄 · 60초 상한 · 정리 ── */

function fakeClock() {
  let now = 0
  let seq = 0
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = ++seq
        pending.set(id, { at: now + ms, fn })
        return id
      },
      clear: (h: unknown) => {
        pending.delete(h as number)
      },
    },
    tick(ms: number) {
      const end = now + ms
      for (;;) {
        const next = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        pending.delete(next[0])
        now = next[1].at
        next[1].fn()
      }
      now = end
    },
    pendingCount: () => pending.size,
  }
}

function rig() {
  const clock = fakeClock()
  const calls: { body: unknown; signal: AbortSignal; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []
  const states: VariantFlightState[] = []
  const results: unknown[] = []
  const flight = createVariantFlight({
    timers: clock.timers,
    onState: (s) => states.push(s),
    post: (body, signal) =>
      new Promise((resolve, reject) => {
        calls.push({ body, signal, resolve, reject })
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
  })
  const make = () => flight.make({ axes: { persona: 'busy' } }, (raw) => variantResult(raw, 'N5'), (v) => results.push(v))
  const last = () => states[states.length - 1]
  return { clock, calls, states, results, flight, make, last }
}
const settle = () => new Promise<void>((r) => setImmediate(r))

test('더블 탭: 만드는 중에 또 눌러도 요청은 1건', () => {
  const r = rig()
  r.make()
  r.make()
  assert.equal(r.calls.length, 1)
  assert.equal(r.last().phase, 'busy')
})

test('시작 직후 800ms 는 [그만두기]가 듣지 않는다 — 지나면 끊고 idle, 결과는 버린다', async () => {
  const r = rig()
  r.make()
  r.flight.cancel()
  assert.equal(r.calls[0].signal.aborted, false)
  assert.equal(r.last().cancelable, false)
  r.clock.tick(VARIANT_CANCEL_LOCK_MS)
  assert.equal(r.last().cancelable, true)
  r.flight.cancel()
  assert.equal(r.calls[0].signal.aborted, true)
  assert.equal(r.last().phase, 'idle')
  await settle()
  assert.equal(r.results.length, 0)
  assert.equal(r.last().failure, null)
  assert.equal(r.clock.pendingCount(), 0)
})

test('20초가 지나면 한 줄 더(long), 60초 상한이면 끊고 일반 실패(다시 만들기)', async () => {
  const r = rig()
  r.make()
  r.clock.tick(VARIANT_LONG_MS - 1)
  assert.equal(r.last().long, false)
  r.clock.tick(1)
  assert.equal(r.last().long, true)
  r.clock.tick(VARIANT_TIMEOUT_MS - VARIANT_LONG_MS)
  await settle()
  assert.equal(r.last().phase, 'failed')
  assert.equal(r.last().failure?.text, VARIANT.fail)
  assert.equal(r.last().failure?.retry, true)
})

test('성공: 결과를 넘기고 idle · 타이머 정리 · 쓸 수 없는 응답은 실패', async () => {
  const r = rig()
  r.make()
  r.calls[0].resolve(response)
  await settle()
  assert.equal(r.results.length, 1)
  assert.equal(r.last().phase, 'idle')
  assert.equal(r.clock.pendingCount(), 0)
  r.make()
  r.calls[1].resolve({ nope: true })
  await settle()
  assert.equal(r.results.length, 1)
  assert.equal(r.last().failure?.kind, 'engine')
})

test('서버 실패는 고정 문구 · clear 로 지우고 · dispose 는 끊되 상태를 알리지 않는다', async () => {
  const r = rig()
  r.make()
  r.calls[0].reject(new ApiError('서버 내부 문구', 422, null, { reason: 'NOT_A_VARIANT' }))
  await settle()
  assert.equal(r.last().failure?.text, VARIANT.unfit)
  r.flight.clear()
  assert.equal(r.last().failure, null)
  r.make()
  const n = r.states.length
  r.flight.dispose()
  await settle()
  assert.equal(r.calls[1].signal.aborted, true)
  assert.equal(r.states.length, n)
})

/* ── 화면 연결(소스 가드) — 막힘이면 요청 0 · 「바뀜」 칸 대응 · 스크롤을 옮기는 호출 0(R1~R6) · 시트 [변형 만들기] ── */

const dir = join(__dirname, '..')
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const code = (f: string) => stripComments(readFileSync(join(dir, f), 'utf8'))

test('막힘(바꿀 점 없음·직접 적기 넘침·하루 한도)이면 [변형 초안 만들기]가 요청을 보내지 않는다', () => {
  const screen = code('VariantDraftScreen.tsx')
  assert.match(screen, /!blocked && m\.generate\(\)/)
  assert.match(screen, /aria-describedby=\{!gen && reason \? 'va-submit-why' : undefined\}/)
  const hook = code('useVariantDraft.ts')
  assert.match(hook, /if \(!base \|\| generating \|\| submitBlock\(axes, note, base\.level\)\) return/)
})

test('「바뀜」: DraftEditor 가 #177 changedFields 의 모든 칸을 표시하고, changed 가 없으면 감싸지 않는다', () => {
  const ed = code('DraftEditor.tsx')
  for (const f of SCENARIO_VARIANT_FIELDS) assert.match(ed, new RegExp(`mark\\(\\s*'${f}'`), f)
  assert.ok(!/mark\(\s*'description'/.test(ed))
  assert.match(ed, /changed\?\.has\(f\) \? <Changed>\{node\}<\/Changed> : node/)
  assert.equal(VARIANT.changed, '바뀜')
  assert.equal(VARIANT.changedSr, '원본에서 바뀌었어요')
})

const FORBIDDEN: Array<[string, RegExp]> = [
  ['scrollIntoView', /scrollIntoView/],
  ['scrollTo(', /\bscrollTo\s*\(/],
  ['scrollBy(', /\bscrollBy\s*\(/],
  ['window.scroll', /window\.scroll/],
  ['scrollTop =', /scrollTop\s*=(?!=)/],
]

test('R1~R6: 변형 화면 파일에 스크롤을 옮기는 호출 0건 · router.replace 는 모두 { scroll: false } · 칩 key 는 고정 값', () => {
  for (const f of ['VariantDraftScreen.tsx', 'VariantAxes.tsx', 'useVariantDraft.ts', 'variantLogic.ts']) {
    const src = code(f)
    for (const [name, re] of FORBIDDEN) assert.ok(!re.test(src), `${f} 에 ${name} 금지`)
    for (const m of src.matchAll(/router\.replace\(([^\n]*)\)/g)) assert.match(m[1], /\{\s*scroll:\s*false\s*\}/, `${f}: ${m[1]}`)
  }
  const axes = code('VariantAxes.tsx')
  const keys = [...axes.matchAll(/key=\{([^}]*)\}/g)].map((m) => m[1])
  assert.deepEqual(keys.sort(), ['k', 'o.value'])
  // 눈에 안 보이는 라디오가 칩 안에 놓이게(초점 때 스크롤이 튀지 않게).
  assert.match(axes, /className=\{`relative inline-flex min-h-11/)
  assert.match(axes, /role="radiogroup"/)
})

test('상황 시트 행동 줄에 [변형 만들기] — 관리 화면에서 열면 ?from=manage', () => {
  const sheet = code('ScenarioSheet.tsx')
  assert.match(sheet, /variantHref=\{scenarioVariantHref\(detail\.data\.id, fromManage \? 'manage' : null\)\}/)
  assert.match(sheet, /\{SHEET\.variant\}/)
  assert.equal(SHEET.variant, '변형 만들기')
  assert.equal(scenarioVariantHref('sc1'), '/study/ai/scenario/sc1/variant')
  assert.equal(scenarioVariantHref('sc1', 'manage'), '/study/ai/scenario/sc1/variant?from=manage')
  // 변형으로 만든 상황은 따로 표시하지 않는다(L-2).
  assert.ok(!/변형/.test(JSON.stringify(SHEET).replace('변형 만들기', '')))
})

test('화면 문구에 엔진명·「AI」 없음, 「세요」 오독 없음', () => {
  const all = JSON.stringify(VARIANT)
  assert.ok(!/AI|Claude|claude|모델|엔진/.test(all))
  assert.ok(!/(합쳐서|함께|이렇게|로|도|으로) 세요/.test(all))
})

/* ── 주제가 지워진 완료 챌린지 ── */

function detail(over: Partial<ChallengeDetail> & { topic: ChallengeDetail['topic'] }): ChallengeDetail {
  return {
    id: 'ch1',
    status: 'COMPLETED',
    lengthDays: 7,
    days: [],
    stats: { metDays: 5, elapsedDays: 7, rate: 0.7, dayIndex: 7, longestStreak: 3 },
    totals: { lessonsDone: 2, wordsCorrect: 20, wordSets: 3 },
    result: { metDays: 5, elapsedDays: 7, rate: 0.7, partialDays: 1, missedDays: 1, longestStreak: 3, lessonsDone: 2, wordsCorrect: 20, wordSets: 3, endReason: null },
    ...over,
  } as unknown as ChallengeDetail
}

test('주제가 지워진 완료 챌린지: [다시 도전] 숨김 · 다음 주제 안내 · 「주제가 지워져…」 문구는 나오지 않는다(삭제됨 표기 없음)', () => {
  const show: RetryGate = { kind: 'show' }
  const blocked: RetryGate = { kind: 'blocked', id: 'ch2', title: '병원', dayIndex: 2 }
  const gone = detail({ topic: { id: null, title: '카페', exists: false } })
  assert.equal(isTopicGone(gone.topic), true)
  assert.equal(isTopicGone({ id: 't1', exists: false }), true)
  assert.equal(isTopicGone({ id: 't1', exists: true }), false)
  assert.deepEqual(resultNextView(gone.topic, show), { topicGone: true, showRetry: false })
  assert.deepEqual(resultNextView({ id: 't1', exists: true }, show), { topicGone: false, showRetry: true })
  assert.deepEqual(resultNextView({ id: 't1', exists: true }, blocked), { topicGone: false, showRetry: false })
  assert.equal(resultHeroView(gone).removed, false)
  assert.equal(resultHeroView(detail({ status: 'ENDED', topic: { id: null, title: '카페', exists: false } })).removed, false)
  assert.equal(COPY.nextBodyNoTopic, '다음 주제로 넘어가 보세요.')
  assert.ok(!/삭제/.test(COPY.nextBodyNoTopic))
})

test('계획표 카드 [다시 하기] → 주제가 지워졌으면 새 문구로 받는다', () => {
  assert.equal(CREATE.againTopicGone, '그 주제는 이제 내 목록에 없어요. 주제를 다시 골라 주세요.')
  const create = stripComments(readFileSync(join(dir, '..', 'challenge', 'ChallengeCreateScreen.tsx'), 'utf8'))
  assert.match(create, /if \(isTopicGone\(d\.topic\) \|\| !d\.topic\.id\) \{\s*show\(CREATE\.againTopicGone\)/)
  const screen = stripComments(readFileSync(join(dir, '..', 'challenge', 'ChallengeScreen.tsx'), 'utf8'))
  assert.match(screen, /next\.showRetry \?/)
  assert.match(screen, /next\.topicGone \? COPY\.nextBodyNoTopic : COPY\.nextBody/)
})
