import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/components/common/api'
// 시험 전용 import — 화면이 옮겨 적은 표현 문자 규칙이 서버 검사와 어긋나지 않는지 대조한다(번들에 들어가지 않는다).
// eslint-disable-next-line no-restricted-imports
import { checkTopicChunkFields } from '@/modules/conversation/structuredResponse/topicDraftSchemas'
import { fieldFailures } from '../failure'
import {
  chunkCanMove,
  chunkFieldProblems,
  chunkGroupsOf,
  chunkMove,
  chunkNeighborKey,
  chunkProblemKey,
  chunkUpsert,
  createOnceGuard,
  createTopicDraftFlight,
  flashText,
  isBlankTopicStore,
  nextChunkKey,
  parseFlash,
  parseTopicStore,
  readTopicStore,
  serializeTopicStore,
  serverTopicProblems,
  topicAskBody,
  topicAskProblem,
  topicCreateBody,
  topicDraftFromResponse,
  topicWarnLines,
  validateTopicDraft,
  warnLineFixed,
  TOPIC_DRAFT_CANCEL_LOCK_MS,
  TOPIC_DRAFT_LONG_MS,
  TOPIC_DRAFT_TIMEOUT_MS,
  type EditableChunk,
  type EditableTopicDraft,
  type TopicDraftFlightState,
  type TopicDraftOutcome,
} from '../logic'
import { CREATE, FAIL, REVIEW, TOAST } from '../topicCopy'
// T5-3b 상황 초안·순차 저장·부분 저장
import { validateDraft, type EditableDraft } from '@/components/scenario/logic'
import { DRAFT as SC_DRAFT } from '@/components/scenario/scenarioCopy'
import {
  createScenarioDraftFlight,
  nextScenarioSlotKey,
  partialView,
  runTopicCreateSave,
  scenarioDraftBody,
  scenarioMoreProblem,
  scenarioPick,
  scenarioSaveBody,
  scenarioSeedDescription,
  scenarioSlotProblems,
  scenariosToSave,
  slotServerProblems,
  toggleScenarioKeep,
  type ScenarioDraftOutcome,
  type ScenarioSlot,
  type TopicCreateSaveProgress,
} from '../logic'
import { PARTIAL, SCDRAFT } from '../topicCopy'

// task-045 T5-3a 주제 만들기(S3·S4) — 순수 함수·요청 흐름(가짜 시계·가짜 post). 화면 실측(360/390/412·scrollTop)은 QA.

const ck = (n: number, chunkType: EditableChunk['chunkType'], textJa: string, reading: string, meaningKo: string): EditableChunk => ({ key: `c${n}`, chunkType, textJa, reading, meaningKo })

const BANK: EditableChunk[] = [
  ck(1, 'NAME', '口座', 'こうざ', '계좌'),
  ck(2, 'NAME', '通帳', 'つうちょう', '통장'),
  ck(3, 'ACTION', '作る', 'つくる', '만들다'),
  ck(4, 'ACTION', '書く', 'かく', '쓰다'),
  ck(5, 'FEELING', '安心', 'あんしん', '안심'),
  ck(6, 'FEELING', '不安', 'ふあん', '불안'),
  ck(7, 'MODIFIER', 'すぐに', 'すぐに', '바로'),
  ck(8, 'MODIFIER', 'ゆっくり', 'ゆっくり', '천천히'),
]
const draftOf = (over: Partial<EditableTopicDraft> = {}): EditableTopicDraft => ({ title: '은행 계좌 만들기', titleJa: '銀行で口座を作る', level: 'N4', description: '은행 창구에서 계좌를 만들어요', chunks: BANK.map((c) => ({ ...c })), ...over })

test('S3 묻기: 2자 미만·40자 초과만 막고, 본문은 한 줄로 접은 주제와 수준뿐(note 없음)', () => {
  assert.equal(topicAskProblem('은'), CREATE.short)
  assert.equal(topicAskProblem('  은 \n'), CREATE.short)
  assert.equal(topicAskProblem('은행'), null)
  assert.equal(topicAskProblem('가'.repeat(40)), null)
  assert.equal(topicAskProblem('가'.repeat(41)), CREATE.long)
  assert.deepEqual(topicAskBody({ title: ' 병원\n진료 ', level: 'N5' }), { title: '병원 진료', level: 'N5' })
})

test('#170 응답 → 편집 값: 열쇠 c1..cN·빈 일본어 이름/설명은 빈 글·모르는 경고는 버림·모양이 어긋나면 null', () => {
  const raw = {
    draft: { title: '은행', titleJa: null, level: 'N4', description: null, chunks: [{ chunkType: 'NAME', textJa: '口座', reading: 'こうざ', meaningKo: '계좌' }, { chunkType: 'ACTION', textJa: '作る', reading: 'つくる', meaningKo: '만들다' }] },
    warnings: ['CHUNKS_SHORT', 'NOPE', 'TITLE_JA_MISSING'],
  }
  const r = topicDraftFromResponse(raw)
  assert.ok(r)
  assert.deepEqual(r.draft.chunks.map((c) => c.key), ['c1', 'c2'])
  assert.equal(r.draft.titleJa, '')
  assert.equal(r.draft.description, '')
  assert.deepEqual(r.warnings, ['CHUNKS_SHORT', 'TITLE_JA_MISSING'])
  assert.equal(topicDraftFromResponse({ draft: { ...raw.draft, level: 'N9' } }), null)
  assert.equal(topicDraftFromResponse({ draft: { ...raw.draft, chunks: [{ chunkType: 'X', textJa: 'a', reading: 'a', meaningKo: 'a' }] } }), null)
  assert.equal(topicDraftFromResponse(null), null)
})

test('#57 본문: chunks 에 id·key·order 없음(새 주제에 id 를 보내면 400 unknown_key)·빈 일본어 이름/설명은 null·앞뒤 공백 정리·배열 순서 유지', () => {
  const body = topicCreateBody(draftOf({ titleJa: '  ', description: ' \n ', title: ' 은행\n계좌 ' }))
  assert.equal(body.title, '은행 계좌')
  assert.equal(body.titleJa, null)
  assert.equal(body.description, null)
  assert.equal(body.chunks.length, 8)
  for (const c of body.chunks) assert.deepEqual(Object.keys(c).sort(), ['chunkType', 'meaningKo', 'reading', 'textJa'])
  assert.deepEqual(body.chunks.map((c) => c.textJa), BANK.map((c) => c.textJa))
  assert.deepEqual(Object.keys(body).sort(), ['chunks', 'description', 'level', 'title', 'titleJa'])
})

test('저장 전 검사: 그대로면 문제 0 · 읽기에 한자 → 읽기 문구 · 같은 표현 → 뒤 표현에 중복 · 8 미만/20 초과 → 개수', () => {
  assert.deepEqual(validateTopicDraft(draftOf()), [])
  const d = draftOf()
  d.chunks[2] = { ...d.chunks[2], reading: 'つく る' }
  d.chunks[3] = { ...d.chunks[3], reading: '書く' }
  d.chunks[7] = { ...d.chunks[7], textJa: '口座', reading: 'こうざ', meaningKo: '천천히' }
  const p = validateTopicDraft(d)
  assert.ok(p.some((x) => x.key === chunkProblemKey('c4', 'reading') && x.message === FAIL.field.reading))
  assert.ok(p.some((x) => x.key === chunkProblemKey('c8', 'textJa') && x.message === FAIL.field.duplicate))
  assert.ok(!p.some((x) => x.key === chunkProblemKey('c1', 'textJa')), '중복은 앞 표현이 아니라 뒤 표현을 짚는다')
  const seven = validateTopicDraft(draftOf({ chunks: BANK.slice(0, 7) }))
  assert.deepEqual(seven[0], { key: 'chunks', message: FAIL.field.count(7) })
  const many = Array.from({ length: 21 }, (_, i) => ck(i + 1, 'NAME', `語${String.fromCodePoint(0x4e00 + i)}`, 'ご', `말${i}`))
  assert.ok(validateTopicDraft(draftOf({ chunks: many })).some((x) => x.key === 'chunks' && x.message === FAIL.field.count(21)))
})

test('저장 전 검사: 주제 정보 — 빈 이름·20자 초과·꺾쇠·일본어 이름에 한글 — 문제 순서는 화면 위→아래(이름 → 표현 묶음 순)', () => {
  assert.equal(validateTopicDraft(draftOf({ title: '  ' }))[0].message, FAIL.field.required('title'))
  assert.equal(validateTopicDraft(draftOf({ title: '가'.repeat(21) }))[0].message, FAIL.field.max('title', 20))
  assert.equal(validateTopicDraft(draftOf({ title: '은행 <계좌>' }))[0].message, FAIL.field.forbiddenChar)
  assert.equal(validateTopicDraft(draftOf({ title: '이모지 🏦 계좌' })).length, 0, '이모지는 허용')
  assert.equal(validateTopicDraft(draftOf({ titleJa: '銀行 계좌' }))[0].message, FAIL.field.notJapanese)
  assert.equal(validateTopicDraft(draftOf({ description: '가'.repeat(121) }))[0].message, FAIL.field.max('description', 120))
  const d = draftOf({ title: '' })
  // 배열 순서는 MODIFIER 가 앞이어도 문제 순서는 묶음 순서(이름 → 액션 → 느낌 → 꾸밈)
  d.chunks = [{ ...d.chunks[6], reading: '' }, ...d.chunks.slice(0, 6), { ...d.chunks[7] }]
  d.chunks[1] = { ...d.chunks[1], meaningKo: '' }
  const keys = validateTopicDraft(d).map((x) => x.key)
  assert.deepEqual(keys, ['title', chunkProblemKey('c1', 'meaningKo'), chunkProblemKey('c7', 'reading')])
})

test('클라이언트 표현 검사는 서버(checkTopicChunkFields)와 문자 규칙이 같다 — 같은 표로 통과/거절이 일치', () => {
  const rows: Array<[string, string, string]> = [
    ['口座', 'こうざ', '계좌'],
    ['パスポート', 'ぱすぽーと', '여권'],
    ['口座', '口座', '계좌'],
    ['口座', 'kouza', '계좌'],
    ['계좌', 'こうざ', '계좌'],
    ['口座', 'こうざ', 'こうざ'],
    ['口座', 'こうざ', 'account'],
    ['ATM', 'えーてぃーえむ', '현금인출기'],
    ['一つ', 'ひとつ', '하나'],
    ['〜円', 'えん', '엔'],
    ['口座', 'コウザ・', '계좌'],
    ['a<b', 'あ', '가'],
  ]
  for (const [ja, rd, mk] of rows) {
    const client = Object.keys(chunkFieldProblems({ chunkType: 'NAME', textJa: ja, reading: rd, meaningKo: mk })).length === 0
    const server = checkTopicChunkFields(ja, rd, mk)
    // 서버만 보는 규칙(읽기·표기 어긋남)은 클라이언트가 통과시킬 수 있다 — 반대(클라이언트만 거절)는 없어야 한다.
    if (!client) assert.notEqual(server, null, `클라이언트만 거절: ${ja}/${rd}/${mk}`)
    if (server === null) assert.ok(client, `서버 통과인데 클라이언트 거절: ${ja}/${rd}/${mk}`)
    if (server && server !== 'READING_MISMATCH' && server !== 'ENGINE_NAME') assert.ok(!client, `서버 거절(${server})인데 클라이언트 통과: ${ja}/${rd}/${mk}`)
  }
})

test('400 칸 문제 → 화면 열쇠: chunks[i] 는 보낸 배열 순서의 표현, 모르는 칸·모양 오류는 defect', () => {
  const d = draftOf()
  const f = fieldFailures('topicSave', { problems: [{ field: 'chunks[2].reading', reason: 'reading' }, { field: 'title', reason: 'max_length' }, { field: 'chunks[0].order', reason: 'unknown_key' }] })
  const s = serverTopicProblems(f, d)
  assert.deepEqual(s.problems, [
    { key: chunkProblemKey('c3', 'reading'), message: FAIL.field.reading },
    { key: 'title', message: FAIL.field.max('title', 20) },
  ])
  assert.equal(s.defect, true)
})

test('표현 옮기기·지우기 이웃·더하기 열쇠: 같은 종류 안에서만, 열쇠는 그대로(목록 key 가 바뀌지 않는다)', () => {
  const cs = [ck(1, 'NAME', 'a', 'あ', '가'), ck(2, 'ACTION', 'b', 'い', '나'), ck(3, 'NAME', 'c', 'う', '다'), ck(4, 'NAME', 'd', 'え', '라')]
  assert.deepEqual(chunkMove(cs, 'c3', -1).map((c) => c.key), ['c3', 'c2', 'c1', 'c4'])
  assert.deepEqual(chunkMove(cs, 'c1', -1).map((c) => c.key), ['c1', 'c2', 'c3', 'c4'])
  assert.deepEqual(chunkMove(cs, 'c3', 1).map((c) => c.key), ['c1', 'c2', 'c4', 'c3'])
  assert.equal(chunkCanMove(cs, 'c1', -1), false)
  assert.equal(chunkCanMove(cs, 'c1', 1), true)
  assert.equal(chunkCanMove(cs, 'c2', 1), false)
  assert.equal(chunkNeighborKey(cs, 'c3'), 'c4')
  assert.equal(chunkNeighborKey(cs, 'c4'), 'c3')
  assert.equal(chunkNeighborKey(cs, 'c2'), null)
  assert.equal(nextChunkKey(cs), 'c5')
  assert.deepEqual(chunkUpsert(cs, { ...cs[1], textJa: 'z' }).map((c) => c.textJa), ['a', 'z', 'c', 'd'])
  assert.equal(chunkUpsert(cs, ck(9, 'FEELING', 'x', 'お', '마')).length, 5)
  assert.deepEqual(chunkGroupsOf(cs).map((g) => [g.type, g.items.map((c) => c.key)]), [['NAME', ['c1', 'c3', 'c4']], ['ACTION', ['c2']]])
})

test('확인해 볼 곳: 칸 순서·여러 종류는 한 줄·고치면 「✓ 고쳤어요」로(줄 수 그대로)', () => {
  const d = draftOf({ titleJa: '', description: '', chunks: BANK.filter((c) => c.chunkType !== 'FEELING' || c.key === 'c5') })
  const lines = topicWarnLines(['TYPE_THIN_FEELING', 'CHUNKS_SHORT', 'DESCRIPTION_MISSING', 'TITLE_JA_MISSING', 'TITLE_TRUNCATED', 'TYPE_THIN_NAME'], d)
  assert.deepEqual(lines.map((l) => l.code), ['TITLE_TRUNCATED', 'TITLE_JA_MISSING', 'DESCRIPTION_MISSING', 'CHUNKS_SHORT', 'TYPE_THIN'])
  assert.equal(lines[3].text, REVIEW.warn.CHUNKS_SHORT(7))
  assert.equal(lines[4].text, REVIEW.warn.TYPE_THIN(['NAME', 'FEELING'], 2))
  const arrival = d.title
  assert.ok(lines.every((l) => !warnLineFixed(l, d, arrival)))
  const fixed = { ...d, title: '은행 계좌', titleJa: '銀行', description: '설명' }
  assert.equal(warnLineFixed(lines[0], fixed, arrival), true)
  assert.equal(warnLineFixed(lines[1], fixed, arrival), true)
  assert.equal(warnLineFixed(lines[2], fixed, arrival), true)
  assert.equal(warnLineFixed(lines[3], fixed, arrival), false)
  assert.equal(warnLineFixed(lines[3], { ...fixed, chunks: Array.from({ length: 12 }, (_, i) => ck(i + 1, 'NAME', 'a', 'あ', '가')) }, arrival), true)
})

test('이 탭 보관: 왕복 같음 · 다른 판·잘못된 열쇠·과한 길이는 통째로 버림 · 보관 값에 토큰·응답 원문 칸이 없다', () => {
  const snap = { userId: 'u-1', ask: { title: '은행', level: 'N4' as const }, draft: draftOf(), warnings: ['CHUNKS_SHORT' as const], arrivalTitle: '은행 계좌 만들기', edited: true, savedAt: 1 }
  const raw = serializeTopicStore(snap)
  const back = parseTopicStore(raw, 'u-1')
  assert.ok(back)
  assert.deepEqual(back.draft, snap.draft)
  assert.deepEqual(back.ask, snap.ask)
  assert.equal(back.edited, true)
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['arrivalTitle', 'ask', 'draft', 'edited', 'savedAt', 'userId', 'version', 'warnings'])
  assert.equal(parseTopicStore(raw.replace('"version":1', '"version":2'), 'u-1'), null)
  assert.equal(parseTopicStore(raw.replace('"key":"c1"', '"key":"x1"'), 'u-1'), null)
  assert.equal(parseTopicStore(JSON.stringify({ ...JSON.parse(raw), ask: { title: 'a'.repeat(401), level: 'N4' } }), 'u-1'), null)
  const extra = parseTopicStore(JSON.stringify({ ...JSON.parse(raw), token: 'secret' }), 'u-1')
  assert.ok(extra && !('token' in extra))
  assert.equal(parseTopicStore('{', 'u-1'), null)
  assert.equal(parseTopicStore(null, 'u-1'), null)
  assert.equal(isBlankTopicStore({ ask: { title: '  ', level: 'N5' }, draft: null }), true)
  assert.equal(isBlankTopicStore({ ask: { title: '은행', level: 'N5' }, draft: null }), false)
})

test('REV-162 M-1 이 탭 보관은 주인이 같을 때만 쓴다 — 같은 사용자는 유지, 다른 사용자·userId 없는 옛 값·손상 JSON 은 쓰지 않고 지우라고 알린다', () => {
  const snap = { userId: 'u-1', ask: { title: '은행', level: 'N4' as const }, draft: draftOf(), warnings: [] as never[], arrivalTitle: '은행 계좌 만들기', edited: true, savedAt: 1 }
  const raw = serializeTopicStore(snap)
  const mine = readTopicStore(raw, 'u-1')
  assert.equal(mine.discard, false, '같은 사용자의 초안은 지우지 않는다')
  assert.equal(mine.store?.userId, 'u-1')
  assert.deepEqual(mine.store?.draft, snap.draft)
  const other = readTopicStore(raw, 'u-2')
  assert.deepEqual(other, { store: null, discard: true }, '다른 사용자 값은 쓰지 않고 지운다(같은 탭에서 계정을 바꿔도 이전 사용자의 초안 카드가 없다)')
  const oldShape = JSON.parse(raw) as Record<string, unknown>
  delete oldShape.userId
  assert.deepEqual(readTopicStore(JSON.stringify(oldShape), 'u-1'), { store: null, discard: true }, 'userId 가 없는 옛 형식')
  assert.deepEqual(readTopicStore(JSON.stringify({ ...oldShape, userId: 7 }), 'u-1'), { store: null, discard: true }, 'userId 가 문자열이 아님')
  assert.deepEqual(readTopicStore(JSON.stringify({ ...oldShape, userId: '' }), 'u-1'), { store: null, discard: true })
  assert.deepEqual(readTopicStore('{', 'u-1'), { store: null, discard: true }, '손상 JSON')
  assert.deepEqual(readTopicStore('', 'u-1'), { store: null, discard: false })
  assert.deepEqual(readTopicStore(null, 'u-1'), { store: null, discard: false }, '보관 값이 없으면 지울 것도 없다')
  assert.deepEqual(readTopicStore(JSON.stringify({ ...oldShape, userId: '' }), ''), { store: null, discard: true }, '지금 사용자를 모르면 어떤 값도 쓰지 않는다')
})

test('REV-162 L-1 서버 engine_name 400 은 칸 이름 없이 chunks[i] 로 와도 그 행에 붙는다(화면 문제 문구로 떨어지지 않는다)', () => {
  const d = draftOf()
  const f = fieldFailures('topicSave', { problems: [{ field: 'chunks[2]', reason: 'engine_name' }] })
  const s = serverTopicProblems(f, d)
  assert.deepEqual(s.problems, [{ key: chunkProblemKey('c3', 'textJa'), message: FAIL.field.engineName }])
  assert.equal(s.defect, false)
  const gone = serverTopicProblems(f, { ...d, chunks: [] })
  assert.deepEqual(gone.problems, [{ key: 'chunks', message: FAIL.field.engineName }], '행이 이미 없으면 표현 개수 칸으로')
  const shape = serverTopicProblems(fieldFailures('topicSave', { problems: [{ field: 'chunks[2]', reason: 'type' }] }), d)
  assert.equal(shape.defect, true, '모양 오류(type)는 여전히 화면 결함')
})

test('돌아왔을 때 토스트: created 는 제목과 함께 읽히고 문구는 문구표 그대로', () => {
  const f = parseFlash(JSON.stringify({ kind: 'created', title: '은행 계좌' }))
  assert.deepEqual(f, { kind: 'created', title: '은행 계좌', scenarios: 0 })
  assert.equal(flashText(f!), TOAST.created('은행 계좌', 0))
  // T5-3b: 함께 저장한 상황 수(0~2)가 토스트 둘째 마디로 — 범위 밖 값은 0.
  const f2 = parseFlash(JSON.stringify({ kind: 'created', title: '은행 계좌', scenarios: 2 }))
  assert.equal(flashText(f2!), TOAST.created('은행 계좌', 2))
  assert.deepEqual(parseFlash(JSON.stringify({ kind: 'created', title: '은행 계좌', scenarios: 9 })), { kind: 'created', title: '은행 계좌', scenarios: 0 })
  assert.equal(parseFlash(JSON.stringify({ kind: 'created' })), null)
  const detail = readFileSync(join(__dirname, '..', 'TopicDetail.tsx'), 'utf8')
  assert.match(detail, /f\.kind !== 'created'/, '새 주제 보기가 created 토스트를 읽어야 한다')
})

/* ───── 요청 흐름(가짜 시계·가짜 post) ───── */

function fakeClock() {
  let now = 0
  const q: { at: number; fn: () => void; id: number }[] = []
  let seq = 0
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = ++seq
        q.push({ at: now + ms, fn, id })
        return id
      },
      clear: (h: unknown) => {
        const i = q.findIndex((x) => x.id === h)
        if (i >= 0) q.splice(i, 1)
      },
    },
    advance(ms: number) {
      now += ms
      for (;;) {
        q.sort((a, b) => a.at - b.at)
        const t = q[0]
        if (!t || t.at > now) break
        q.shift()
        t.fn()
      }
    },
    pending: () => q.length,
  }
}

function fakePost() {
  const calls: { body: unknown; signal: AbortSignal; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []
  const post = (body: unknown, signal: AbortSignal) =>
    new Promise<unknown>((resolve, reject) => {
      calls.push({ body, signal, resolve, reject })
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  return { post, calls }
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const OK_RAW = { draft: { title: '은행', titleJa: '銀行', level: 'N4', description: '', chunks: BANK.map((c) => ({ chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo })) }, warnings: [] }

function setup() {
  const clock = fakeClock()
  const p = fakePost()
  const states: TopicDraftFlightState[] = []
  const outcomes: TopicDraftOutcome[] = []
  const flight = createTopicDraftFlight({ post: p.post as never, onState: (s) => states.push(s), timers: clock.timers })
  const start = () => flight.start({ title: '은행', level: 'N4' }, (o) => outcomes.push(o))
  return { clock, p, states, outcomes, flight, start }
}

test('흐름: 더블 탭 → 요청 1건 · 성공하면 편집 값 · 타이머 정리', async () => {
  const s = setup()
  assert.equal(s.start(), true)
  assert.equal(s.start(), false)
  assert.equal(s.p.calls.length, 1)
  assert.deepEqual(s.p.calls[0].body, { title: '은행', level: 'N4' })
  s.p.calls[0].resolve(OK_RAW)
  await tick()
  assert.equal(s.outcomes.length, 1)
  assert.equal(s.outcomes[0].kind, 'ok')
  assert.equal(s.clock.pending(), 0)
  assert.deepEqual(s.states.at(-1), { busy: false, cancelable: false, long: false })
  assert.equal(s.start(), true, '끝난 뒤에는 다시 보낼 수 있다')
})

test('흐름: 취소 잠금 799ms 는 듣지 않고 800ms 부터 끊는다 — 끊으면 canceled·신호 abort·결과가 늦게 와도 무시', async () => {
  assert.equal(TOPIC_DRAFT_CANCEL_LOCK_MS, 800, '잠금 값 자체를 고정한다 — 상수로만 경계를 만들면 80 으로 줄어도 통과한다(REV-162 L-3)')
  const s = setup()
  s.start()
  s.clock.advance(TOPIC_DRAFT_CANCEL_LOCK_MS - 1)
  s.flight.cancel()
  assert.equal(s.p.calls[0].signal.aborted, false)
  assert.equal(s.states.at(-1)?.cancelable, false)
  s.clock.advance(1)
  assert.equal(s.states.at(-1)?.cancelable, true)
  s.flight.cancel()
  assert.equal(s.p.calls[0].signal.aborted, true)
  await tick()
  assert.deepEqual(s.outcomes, [{ kind: 'canceled' }])
  s.p.calls[0].resolve(OK_RAW)
  await tick()
  assert.equal(s.outcomes.length, 1)
})

test('흐름: 15초 long · 60초 벽시계 상한 → 일시 실패(다시 만들기) · dispose 는 결과를 알리지 않는다', async () => {
  const s = setup()
  s.start()
  s.clock.advance(TOPIC_DRAFT_LONG_MS)
  assert.equal(s.states.at(-1)?.long, true)
  s.clock.advance(TOPIC_DRAFT_TIMEOUT_MS - TOPIC_DRAFT_LONG_MS)
  await tick()
  assert.equal(s.outcomes.length, 1)
  const o = s.outcomes[0]
  assert.ok(o.kind === 'fail' && o.failure.kind === 'engine' && o.failure.retry && o.failure.text === FAIL.engine)
  const d = setup()
  d.start()
  d.flight.dispose()
  await tick()
  assert.equal(d.outcomes.length, 0)
  assert.equal(d.clock.pending(), 0)
})

test('흐름: 서버 오류는 고정 문구 — 422 한 문구 · 409 DRAFT_BUSY · 429 분/하루(막음) · 502 · 빈 응답', async () => {
  const cases: Array<[unknown, (o: TopicDraftOutcome) => boolean]> = [
    [new ApiError('서버 문구', 422, null, { reason: 'NOT_A_TOPIC' }), (o) => o.kind === 'fail' && o.failure.kind === 'unfit' && o.failure.text === FAIL.topicDraft.unfit],
    [new ApiError('서버 문구', 409, null, { reason: 'DRAFT_BUSY' }), (o) => o.kind === 'fail' && o.failure.text === FAIL.topicDraft.busy],
    [new ApiError('서버 문구', 429, null, { retryAfterSec: 12 }), (o) => o.kind === 'fail' && o.failure.text === FAIL.topicDraft.rate(12) && !o.failure.block],
    [new ApiError('서버 문구', 429, null, { retryAfterSec: 7200 }), (o) => o.kind === 'fail' && o.failure.kind === 'daily' && o.failure.block],
    [new ApiError('서버 문구', 502), (o) => o.kind === 'fail' && o.failure.text === FAIL.engine && o.failure.retry],
    [new ApiError('서버 문구', 400, null, { field: 'title', reason: 'max_length' }), (o) => o.kind === 'fail' && o.failure.kind === 'field' && o.failure.problems[0]?.field === 'title'],
  ]
  for (const [err, ok] of cases) {
    const s = setup()
    s.start()
    s.p.calls[0].reject(err)
    await tick()
    assert.ok(ok(s.outcomes[0]), JSON.stringify(s.outcomes[0]))
    assert.ok(!JSON.stringify(s.outcomes[0]).includes('서버 문구'), '서버 message 를 쓰지 않는다')
  }
  const bad = setup()
  bad.start()
  bad.p.calls[0].resolve({ draft: { title: 1 } })
  await tick()
  const o = bad.outcomes[0]
  assert.ok(o.kind === 'fail' && o.failure.text === FAIL.engine)
})

test('저장 한 번에 하나: 더블 탭은 요청을 하나만 만들고, 끝나면 다시 할 수 있다', async () => {
  const g = createOnceGuard()
  let calls = 0
  let release: () => void = () => {}
  const fn = () => {
    calls++
    return new Promise<void>((r) => {
      release = r
    })
  }
  assert.equal(g.run(fn), true)
  assert.equal(g.run(fn), false)
  assert.equal(calls, 1)
  assert.equal(g.busy(), true)
  release()
  await tick()
  assert.equal(g.busy(), false)
  assert.equal(g.run(fn), true)
  assert.equal(calls, 2)
})

test('화면 소스: 새 파일도 서버 message·@/modules·엔진 이름·「AI」를 쓰지 않는다', () => {
  for (const f of ['TopicCreateScreen.tsx', 'TopicAskForm.tsx', 'TopicDraftReview.tsx', 'TopicInfoFields.tsx', 'ChunkEditor.tsx', 'useTopicDraft.ts']) {
    const src = readFileSync(join(__dirname, '..', f), 'utf8')
    assert.ok(!/from '@\/modules/.test(src), `${f}: @/modules import 금지`)
    assert.ok(!/\b(?:e|err|error|res)\.message\b/.test(src), `${f}: 서버 message 사용 금지`)
    assert.ok(!/claude|whisper|reazon|style-?bert|\bAI\b/i.test(src), `${f}: 엔진명·AI 금지`)
  }
})

/* ───── T5-3b 상황 초안(#166 인라인 주제)·S5·순차 저장(#57 → #163)·부분 저장 ───── */

const scDraftOf = (over: Partial<EditableDraft> = {}): EditableDraft => ({
  title: '창구에서 계좌 만들기',
  titleJa: '窓口で口座を作る',
  level: 'N4',
  difficulty: 2,
  learner: '손님',
  tutor: '은행원',
  goalKo: '목적을 말하고 서류 안내를 알아들어요',
  criteria: ['목적을 말한다'],
  steps: ['인사', '목적 말하기'],
  expressions: [
    { ja: '口座を作りたいです', ko: '계좌를 만들고 싶어요' },
    { ja: 'お願いします', ko: '부탁해요' },
  ],
  opening: { ko: '어서 오세요', ja: 'いらっしゃいませ', koAtJa: '어서 오세요', reading: null },
  topicIds: [],
  requiredExpressions: null,
  ...over,
})
const slotOf = (key: ScenarioSlot['key'], over: Partial<ScenarioSlot> = {}): ScenarioSlot => ({ key, desc: '은행 창구에서 계좌를 만들어요', draft: scDraftOf({ title: `상황 ${key}` }), keep: true, savedId: null, ...over })
const SC_RAW = {
  draft: {
    title: '창구에서 계좌 만들기',
    titleJa: '窓口で口座を作る',
    level: 'N4',
    roles: { learner: '손님', tutor: '은행원' },
    goal: { communicativeGoalKo: '목적을 말해요', successCriteria: ['목적을 말한다'] },
    steps: [{ ko: '인사' }, { ko: '목적' }],
    keyExpressions: [{ ja: '口座', ko: '계좌' }, { ja: 'お願いします', ko: '부탁해요' }],
    opening: null,
    topicIds: ['top_other'],
  },
}

test('T5-3b 자동 요청 본문: 주제 설명(5자 이상) 또는 「{이름} 상황에서 나누는 대화」 · 인라인 topic(아이디 없음) · 300자 상한', () => {
  assert.equal(scenarioSeedDescription(draftOf()), '은행 창구에서 계좌를 만들어요')
  assert.equal(scenarioSeedDescription(draftOf({ description: ' 짧음 ' })), SCDRAFT.fallbackDesc('은행 계좌 만들기'))
  assert.equal(scenarioSeedDescription(draftOf({ description: '' })), '은행 계좌 만들기 상황에서 나누는 대화')
  assert.equal(Array.from(scenarioSeedDescription(draftOf({ description: '가'.repeat(400) }))).length, 300)
  const body = scenarioDraftBody(draftOf(), '은행 창구에서 계좌를 만들어요', '도착 이름')
  assert.deepEqual(body, { description: '은행 창구에서 계좌를 만들어요', level: 'N4', topic: { title: '은행 계좌 만들기', titleJa: '銀行で口座を作る' } })
  assert.ok(!('topicId' in body), 'topicId 와 topic 을 같이 보내면 400 conflict')
  // 고치는 중이라 주제 한도에 맞지 않는 이름이면 도착 때 이름 · 빈 일본어 이름은 보내지 않는다
  const b2 = scenarioDraftBody(draftOf({ title: '가'.repeat(21), titleJa: '' }), '설명 다섯자 이상', '은행 계좌')
  assert.deepEqual(b2.topic, { title: '은행 계좌' })
  assert.equal(scenarioDraftBody(draftOf({ title: '<b>은행' }), 'x설명입니다', '은행').topic?.title, '은행')
  assert.equal(scenarioMoreProblem('약'), SC_DRAFT.tooShort)
  assert.equal(scenarioMoreProblem('가'.repeat(301)), SC_DRAFT.descTooLong)
  assert.equal(scenarioMoreProblem('약을 받으며 먹는 법을 묻는 상황'), null)
})

function scSetup() {
  const clock = fakeClock()
  const p = fakePost()
  const states: TopicDraftFlightState[] = []
  const outcomes: ScenarioDraftOutcome[] = []
  const flight = createScenarioDraftFlight({ post: p.post as never, onState: (s) => states.push(s), timers: clock.timers })
  const body = scenarioDraftBody(draftOf(), scenarioSeedDescription(draftOf()), '은행 계좌 만들기')
  return { clock, p, states, outcomes, flight, body, done: (o: ScenarioDraftOutcome) => outcomes.push(o) }
}

test('T5-3b ① 주제 초안 도착마다 #166 은 정확히 1회 — 같은 도착 번호로 다시 불러도(요청 중·끝난 뒤) 0회, 새 도착이면 다시 1회', async () => {
  const t = scSetup()
  assert.equal(t.flight.autoOnce(1, t.body, t.done), true)
  assert.equal(t.flight.autoOnce(1, t.body, t.done), false, '다시 그려도 재요청 0')
  assert.equal(t.p.calls.length, 1)
  t.p.calls[0].resolve(SC_RAW)
  await tick()
  assert.equal(t.flight.autoOnce(1, t.body, t.done), false, '끝난 뒤에도 같은 도착으로는 0')
  assert.equal(t.flight.autoOnce(0, t.body, t.done), false, '옛 도착 번호도 0')
  assert.equal(t.p.calls.length, 1)
  assert.equal(t.outcomes.length, 1)
  const o = t.outcomes[0]
  assert.ok(o.kind === 'ok')
  assert.deepEqual(o.draft.topicIds, [], '새 주제는 아직 id 가 없다 — 초안의 장소는 버리고 저장 때 새 주제 id 로')
  assert.equal(o.draft.title, '창구에서 계좌 만들기')
  // 주제 초안을 다시 만들면(새 도착) 그때 한 번 더
  assert.equal(t.flight.autoOnce(2, t.body, t.done), true)
  assert.equal(t.p.calls.length, 2)
})

test('T5-3b ③ 병렬 금지: 자동 요청이 도는 동안 [하나 더](start)는 아무것도 보내지 않는다 · 취소 잠금 · 15초 long · 실패 문구는 고정 문구', async () => {
  const t = scSetup()
  t.flight.autoOnce(1, t.body, t.done)
  assert.equal(t.flight.start(t.body, t.done), false)
  assert.equal(t.p.calls.length, 1)
  assert.deepEqual(t.states.at(-1), { busy: true, cancelable: false, long: false })
  t.flight.cancel()
  assert.equal(t.p.calls[0].signal.aborted, false, '800ms 안에는 끊지 않는다')
  t.clock.advance(TOPIC_DRAFT_CANCEL_LOCK_MS)
  t.clock.advance(TOPIC_DRAFT_LONG_MS)
  assert.deepEqual(t.states.at(-1), { busy: true, cancelable: true, long: true })
  t.flight.cancel()
  await tick()
  assert.deepEqual(t.outcomes, [{ kind: 'canceled' }])
  assert.equal(t.flight.start(t.body, t.done), true, '끝나면 다음 요청을 보낼 수 있다')
  t.p.calls[1].reject(new ApiError('서버 문구', 422, null, { reason: 'NOT_A_SCENARIO' }))
  await tick()
  const f = t.outcomes.at(-1)
  assert.ok(f?.kind === 'fail' && f.failure.kind === 'unfit' && f.failure.text === SCDRAFT.unfit)
  t.flight.start(t.body, t.done)
  t.p.calls[2].reject(new ApiError('서버 문구', 409, null, { reason: 'DRAFT_BUSY' }))
  await tick()
  const b = t.outcomes.at(-1)
  assert.ok(b?.kind === 'fail' && b.failure.text === FAIL.scenarioDraft.busy)
  t.flight.start(t.body, t.done)
  t.clock.advance(TOPIC_DRAFT_TIMEOUT_MS)
  await tick()
  const to = t.outcomes.at(-1)
  assert.ok(to?.kind === 'fail' && to.failure.text === SCDRAFT.fail && to.failure.retry, '시간 초과 = 상황 초안만 실패(주제 저장은 막지 않는다)')
})

test('T5-3b 카드: 다음 열쇠(최대 2) · 「저장할 상황 k/n」 · 체크는 그 카드 객체만 바꾼다(R1 — 나머지 참조 그대로)', () => {
  assert.equal(nextScenarioSlotKey([]), 'sc0')
  assert.equal(nextScenarioSlotKey([slotOf('sc0')]), 'sc1')
  assert.equal(nextScenarioSlotKey([slotOf('sc0'), slotOf('sc1')]), null)
  const slots = [slotOf('sc0'), slotOf('sc1')]
  assert.deepEqual(scenarioPick(slots), { k: 2, n: 2 })
  const off = toggleScenarioKeep(slots, 'sc1', false)
  assert.deepEqual(scenarioPick(off), { k: 1, n: 2 })
  assert.equal(off[0], slots[0], '다른 카드는 같은 객체')
  assert.notEqual(off[1], slots[1])
  assert.equal(toggleScenarioKeep(off, 'sc1', false)[1], off[1], '같은 값이면 바꾸지 않는다')
  // 저장된 카드는 셈에서 빠진다(부분 저장 뒤 남은 카드만)
  assert.deepEqual(scenarioPick([slotOf('sc0', { savedId: 'scn_1' }), slotOf('sc1', { keep: false })]), { k: 0, n: 1 })
  assert.deepEqual(
    scenariosToSave([slotOf('sc0', { keep: false }), slotOf('sc1')]).map((s) => s.key),
    ['sc1'],
    '체크를 끈 상황은 보내지 않는다',
  )
  // 저장 전 검사: 체크한 카드만 validateDraft
  const bad = [slotOf('sc0', { draft: scDraftOf({ learner: '' }) }), slotOf('sc1', { keep: false, draft: scDraftOf({ goalKo: '' }) })]
  const probs = scenarioSlotProblems(bad, validateDraft)
  assert.deepEqual([...probs.keys()], ['sc0'])
  assert.equal(probs.get('sc0')?.[0].key, 'learner')
})

function fakeSaveApi(opts: { topicFail?: unknown; scenarioFail?: Record<number, unknown> } = {}) {
  const log: string[] = []
  const topicBodies: unknown[] = []
  const scenarioBodies: { topicIds: string[]; title: string; description: string | null }[] = []
  let inFlight = 0
  let maxInFlight = 0
  let n = 0
  return {
    log,
    topicBodies,
    scenarioBodies,
    maxInFlight: () => maxInFlight,
    api: {
      createTopic: async (body: unknown) => {
        log.push('topic')
        topicBodies.push(body)
        if (opts.topicFail) throw opts.topicFail
        return { topic: { id: 'top_new', title: '은행 계좌 만들기' }, warnings: [] }
      },
      createScenario: async (body: { topicIds: string[]; title: string; description: string | null }) => {
        const i = n++
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        log.push(`scenario:${body.title}`)
        scenarioBodies.push(body)
        await Promise.resolve()
        inFlight--
        const f = opts.scenarioFail?.[i]
        if (f) throw f
        return { id: `scn_${i}` }
      },
    },
  }
}

function saveHooks(log: string[]) {
  const progress: TopicCreateSaveProgress[] = []
  const saved: Record<string, string> = {}
  let topicId: string | null = null
  return {
    progress,
    saved,
    topicId: () => topicId,
    hooks: {
      onTopicSaved: (id: string) => {
        topicId = id
        log.push(`topicSaved:${id}`)
      },
      onScenarioSaved: (key: ScenarioSlot['key'], id: string) => {
        saved[key] = id
        log.push(`scenarioSaved:${key}`)
      },
      onProgress: (p: TopicCreateSaveProgress) => progress.push(p),
    },
  }
}

test('T5-3b 저장: #57 → savedTopicId 기록 → 체크한 상황만 #163 하나씩(새 주제 id 를 장소로) → 전부 성공이면 done', async () => {
  const f = fakeSaveApi()
  const h = saveHooks(f.log)
  const slots = [slotOf('sc0'), slotOf('sc1', { keep: false })]
  const r = await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots }, f.api as never, h.hooks)
  assert.deepEqual(r, { kind: 'done', topicId: 'top_new', title: '은행 계좌 만들기', saved: 1 })
  assert.deepEqual(f.log, ['topic', 'topicSaved:top_new', 'scenario:상황 sc0', 'scenarioSaved:sc0'], '주제 id 를 기록한 뒤에 상황을 보낸다 · 체크 끈 sc1 은 보내지 않는다')
  assert.deepEqual(f.scenarioBodies[0].topicIds, ['top_new'])
  assert.equal(f.scenarioBodies[0].description, '은행 창구에서 계좌를 만들어요')
  assert.deepEqual(scenarioSaveBody(slots[0], 'top_x').topicIds, ['top_x'])
  assert.ok(!('chunks' in (f.scenarioBodies[0] as object)))
  assert.deepEqual(h.progress, [{ phase: 'topic' }, { phase: 'scenario', i: 1, k: 1 }])
  // 두 개 체크 → 순차(동시에 2건이 나가지 않는다)
  const f2 = fakeSaveApi()
  await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots: [slotOf('sc0'), slotOf('sc1')] }, f2.api as never, saveHooks(f2.log).hooks)
  assert.equal(f2.maxInFlight(), 1, '#163 병렬 금지')
  assert.equal(f2.scenarioBodies.length, 2)
})

test('T5-3b ④ 상황 저장만 실패 → partial(주제 1번만) · [상황 다시 저장]은 savedTopicId 로 #57 을 다시 부르지 않고 남은 것만', async () => {
  const limit = new ApiError('서버 문구', 409, null, { reason: 'SCENARIO_LIMIT' })
  const f = fakeSaveApi({ scenarioFail: { 0: limit } })
  const h = saveHooks(f.log)
  const slots = [slotOf('sc0'), slotOf('sc1')]
  const r = await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots }, f.api as never, h.hooks)
  assert.equal(r.kind, 'partial')
  if (r.kind !== 'partial') return
  assert.equal(r.topicId, 'top_new')
  assert.equal(f.log.filter((x) => x === 'topic').length, 1)
  assert.equal(f.scenarioBodies.length, 1, '내 상황 50 이면 남은 상황은 보내지 않는다(같은 이유로 실패)')
  assert.deepEqual(
    r.failed.map((x) => [x.key, x.failure.kind]),
    [
      ['sc0', 'limit'],
      ['sc1', 'limit'],
    ],
  )
  assert.equal(r.failed[0].failure.text, FAIL.scenarioSave.limit)
  const v = partialView(slots, r.failed)
  assert.equal(v.m, 2)
  assert.equal(v.block, FAIL.scenarioSave.limit, '[상황 다시 저장]을 막는 이유')
  assert.equal(PARTIAL.body(v.m), '상황 2개는 저장하지 못했어요. 주제와 상황은 따로 저장돼요.')

  // 다시 저장(새로 고침 뒤와 같다 — 보관에서 savedTopicId·savedId 를 읽어 온 값): 주제를 다시 만들지 않는다
  const f2 = fakeSaveApi()
  const h2 = saveHooks(f2.log)
  const again = [slotOf('sc0', { savedId: 'scn_old' }), slotOf('sc1')]
  const r2 = await runTopicCreateSave({ draft: draftOf(), savedTopicId: 'top_new', slots: again }, f2.api as never, h2.hooks)
  assert.deepEqual(r2, { kind: 'done', topicId: 'top_new', title: '은행 계좌 만들기', saved: 2 })
  assert.equal(f2.topicBodies.length, 0, '재시도에서 #57 0회')
  assert.equal(h2.topicId(), null, '주제 저장 표시도 다시 쓰지 않는다')
  assert.deepEqual(f2.log, ['scenario:상황 sc1', 'scenarioSaved:sc1'], '이미 저장한 sc0 은 보내지 않는다')
  assert.deepEqual(f2.scenarioBodies[0].topicIds, ['top_new'])
})

test('T5-3b 저장 실패 갈래: 주제 실패 = 아무것도 저장 안 됨(상황 0·기록 0) · 네트워크 실패 상황은 다음 상황을 계속 보낸다 · 400 칸은 그 카드 칸으로', async () => {
  const f = fakeSaveApi({ topicFail: new ApiError('서버 문구', 409, null, { reason: 'TOPIC_LIMIT' }) })
  const h = saveHooks(f.log)
  const r = await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots: [slotOf('sc0')] }, f.api as never, h.hooks)
  assert.ok(r.kind === 'topicFail' && r.failure.text === FAIL.topicSave.limit)
  assert.deepEqual(f.log, ['topic'])
  assert.equal(h.topicId(), null)

  const net = new TypeError('Failed to fetch')
  const f2 = fakeSaveApi({ scenarioFail: { 0: net } })
  const h2 = saveHooks(f2.log)
  const r2 = await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots: [slotOf('sc0'), slotOf('sc1')] }, f2.api as never, h2.hooks)
  assert.ok(r2.kind === 'partial')
  assert.equal(f2.scenarioBodies.length, 2, '일시 실패는 다음 상황을 계속')
  assert.deepEqual(Object.keys(h2.saved), ['sc1'])
  if (r2.kind === 'partial') {
    assert.equal(r2.saved, 1)
    assert.equal(partialView([slotOf('sc0'), slotOf('sc1', { savedId: 'scn_1' })], r2.failed).block, null, '일시 실패면 다시 저장을 막지 않는다')
  }

  const field = new ApiError('서버 문구', 400, null, { problems: [{ field: 'roles.learner', reason: 'max_length' }] })
  const f3 = fakeSaveApi({ scenarioFail: { 0: field } })
  const r3 = await runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots: [slotOf('sc0')] }, f3.api as never, saveHooks(f3.log).hooks)
  assert.ok(r3.kind === 'partial')
  if (r3.kind === 'partial') {
    assert.equal(r3.failed[0].failure.kind, 'field')
    assert.deepEqual(
      slotServerProblems(r3.failed[0].failure).map((p) => p.key),
      ['learner'],
      '서버 칸 경로 → 편집기 칸 열쇠',
    )
    assert.ok(partialView([slotOf('sc0')], r3.failed).lines[0].field)
  }
})

test('T5-3b 저장 더블 탭: 같은 가드 안에서 두 번 눌러도 #57 은 1건', async () => {
  const f = fakeSaveApi()
  const guard = createOnceGuard()
  const run = () => runTopicCreateSave({ draft: draftOf(), savedTopicId: null, slots: [slotOf('sc0')] }, f.api as never, saveHooks(f.log).hooks).then(() => undefined)
  assert.equal(guard.run(run), true)
  assert.equal(guard.run(run), false)
  await tick()
  await tick()
  assert.equal(f.topicBodies.length, 1)
  assert.equal(f.scenarioBodies.length, 1)
})

test('T5-3b 보관: 상황 초안·체크·savedTopicId·저장된 상황 id 가 새로 고침 뒤에도 그대로 · 모양이 어긋나면 통째로 버린다 · 옛 보관은 빈 값', () => {
  const base = { userId: 'u1', ask: { title: '은행', level: 'N4' as const }, draft: draftOf(), warnings: [], arrivalTitle: '은행', edited: true, savedAt: 1 }
  const scenarios = [slotOf('sc0', { savedId: 'scn_1' }), slotOf('sc1', { keep: false })]
  const raw = serializeTopicStore({ ...base, scenarios, savedTopicId: 'top_new', scAsked: true })
  const back = parseTopicStore(raw, 'u1')
  assert.ok(back)
  assert.equal(back.savedTopicId, 'top_new')
  assert.equal(back.scAsked, true)
  assert.deepEqual(back.scenarios, scenarios)
  assert.equal(parseTopicStore(raw, 'u2'), null, '남의 값은 읽지 않는다')
  const old = parseTopicStore(serializeTopicStore(base), 'u1')
  assert.deepEqual([old?.scenarios, old?.savedTopicId, old?.scAsked], [[], null, false])
  const bad = (patch: Record<string, unknown>) => parseTopicStore(JSON.stringify({ ...JSON.parse(raw), ...patch }), 'u1')
  assert.equal(bad({ savedTopicId: '../x' }), null)
  assert.equal(bad({ scenarios: [...scenarios, slotOf('sc0')] }), null, '3개·중복 열쇠')
  assert.equal(bad({ scenarios: [{ ...scenarios[0], key: 'sc9' }] }), null)
  assert.equal(bad({ scenarios: [{ ...scenarios[0], draft: { ...scenarios[0].draft, steps: 'x' } }] }), null)
  assert.equal(bad({ scenarios: [{ ...scenarios[0], keep: 'yes' }] }), null)
  // 실패 문구·서버 message 칸은 보관 모양에 없다
  assert.ok(!/message|failure|text/.test(Object.keys(back).join(',')))
})

test('T5-3b 화면 소스: savedTopicId 가 있으면 partial 로 열고(이어 고치기 묻지 않음) · 주소 단계 S5 · 공유 편집기는 topic 을 import 하지 않는다', () => {
  const hook = readFileSync(join(__dirname, '..', 'useTopicDraft.ts'), 'utf8')
  assert.match(hook, /useState<TopicDraftStage>\(resumed \? 'partial' : 'ask'\)/)
  assert.match(hook, /stored\?\.draft && !stored\.savedTopicId \? stored : null/)
  assert.match(hook, /scFlightCtl\.autoOnce\(arrivalSeq\.current, body,/, '자동 요청은 도착 번호 가드를 지난다')
  const screen = readFileSync(join(__dirname, '..', 'TopicCreateScreen.tsx'), 'utf8')
  assert.match(screen, /router\.push\(`\$\{TOPIC_NEW_HREF\}\?step=\$\{key\}`, \{ scroll: false \}\)/)
  const editor = readFileSync(join(__dirname, '..', '..', 'scenario', 'DraftEditor.tsx'), 'utf8')
  assert.ok(!/from '@\/components\/topic|from '\.\.\/topic/.test(editor))
  assert.match(editor, /placesFixed\?: \{ title: string; label: string \}/)
})
