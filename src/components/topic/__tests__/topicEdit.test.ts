import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/components/common/api'
import type { Topic } from '@/types/lesson'
import type { SeedOverrideItem } from '@/types/seedOverride'
import type { TopicUpdateInput } from '@/types/topicWrite'
import { failureCopy } from '../failure'
import {
  copyIdSet,
  createOnceGuard,
  createTopicDraftFlight,
  editFlash,
  editServerProblems,
  flashText,
  isTopicEdited,
  levelRegenBody,
  levelRegenFailLines,
  levelRegenPrompt,
  parseFlash,
  regenChunks,
  regenWarnLines,
  runTopicEditSave,
  seedCopyId,
  topicEditFailView,
  topicEditFrom,
  topicEditPatch,
  topicEditRoute,
  topicForkBody,
  topicOrigin,
  validateTopicEdit,
  type EditableTopicDraft,
  type TopicDraftOutcome,
  type TopicEditApi,
} from '../logic'
import { EDIT, FAIL, TOAST } from '../topicCopy'

const SERVER_MSG = '서버 문구 을(를) 화면에 쓰면 안 됨'

const chunk = (id: string, order: number, textJa: string, reading: string | null, meaningKo: string, chunkType: 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER' = 'NAME') => ({
  id,
  order,
  chunkType,
  textJa,
  reading,
  meaningKo,
})

const NAMES: Array<[string, string, string]> = [
  ['受付', 'うけつけ', '접수처'],
  ['保険証', 'ほけんしょう', '보험증'],
  ['診察券', 'しんさつけん', '진찰권'],
  ['予約', 'よやく', '예약'],
  ['熱', 'ねつ', '열'],
  ['薬', 'くすり', '약'],
  ['頭痛', 'ずつう', '두통'],
  ['待合室', 'まちあいしつ', '대기실'],
  ['名前', 'なまえ', '이름'],
]

/** 서버 #56 항목 — 일부러 `order` 를 뒤섞어 둔다(편집 값은 order 순이어야 한다). */
function topic(over: Partial<Topic> = {}): Topic {
  const chunks = NAMES.map(([ja, rd, mk], i) => chunk(`ck${i + 1}`, i + 1, ja, rd, mk)).reverse()
  return {
    id: 't-mine',
    title: '병원 진료',
    titleJa: '病院',
    level: 'N5',
    description: '병원에서 접수하고 진료받기',
    tags: [],
    isSeed: false,
    chunks,
    lessonCount: 0,
    lastLessonAt: null,
    ...over,
  }
}

const clone = (d: EditableTopicDraft): EditableTopicDraft => ({ ...d, chunks: d.chunks.map((c) => ({ ...c })) })

function fakeApi(respond: { patch?: () => Promise<unknown>; fork?: () => Promise<unknown> } = {}) {
  const calls: Array<{ op: 'patch' | 'fork'; id: string; body: TopicUpdateInput }> = []
  const api: TopicEditApi = {
    patch: (id, body) => {
      calls.push({ op: 'patch', id, body })
      return respond.patch ? respond.patch() : Promise.resolve({ topic: { id }, warnings: [] })
    },
    fork: (id, body) => {
      calls.push({ op: 'fork', id, body })
      return respond.fork ? respond.fork() : Promise.resolve({ topic: { id: 'copy-1' }, warnings: [], seedId: id, copyId: 'copy-1', relinkedScenarioIds: [] })
    },
  }
  return { api, calls }
}

test('경로: 내 주제·내 버전 → #171 PATCH, 기본 주제 → #174 fork — 출처는 #56 isSeed + #179 사본 id', () => {
  const overrides = [{ kind: 'TOPIC', seedId: 'seed-1', seedTitle: '길 묻기', state: 'COPIED', copyId: 't-copy', orphan: false, updatedAt: '2026-10-07T00:00:00Z' }] as SeedOverrideItem[]
  const ids = copyIdSet(overrides, 'TOPIC')
  assert.equal(topicEditRoute(topicOrigin({ id: 't-mine', isSeed: false }, ids)), 'patch')
  assert.equal(topicEditRoute(topicOrigin({ id: 't-copy', isSeed: false }, ids)), 'patch')
  assert.equal(topicEditRoute(topicOrigin({ id: 'seed-1', isSeed: true }, ids)), 'fork')
  assert.equal(topicEditRoute('SEED'), 'fork')
})

test('편집 값: order 순·화면 열쇠 c1..cN·서버 id 그대로·읽기 null → 빈 글', () => {
  const d = topicEditFrom(topic({ chunks: [chunk('b', 2, '熱', null, '열'), chunk('a', 1, '受付', 'うけつけ', '접수처')], titleJa: null, description: null }))
  assert.deepEqual(
    d.chunks.map((c) => [c.key, c.id, c.textJa, c.reading]),
    [
      ['c1', 'a', '受付', 'うけつけ'],
      ['c2', 'b', '熱', ''],
    ],
  )
  assert.equal(d.titleJa, '')
  assert.equal(d.description, '')
})

test('#171 본문: 바뀐 게 없으면 null(서버 0) · 앞뒤 공백만 바꿔도 null', () => {
  const orig = topicEditFrom(topic())
  assert.equal(topicEditPatch(orig, clone(orig)), null)
  const spaced = clone(orig)
  spaced.title = '  병원 진료 '
  spaced.chunks[0].meaningKo = ` ${spaced.chunks[0].meaningKo} `
  assert.equal(topicEditPatch(orig, spaced), null)
  assert.equal(isTopicEdited(orig, spaced), false)
})

test('#171 본문: 표현 1개 뜻만 고침 → chunks 만, 모든 표현이 원래 id 그대로(QA T5-4 ①)', () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.chunks[2].meaningKo = '진찰 카드'
  const p = topicEditPatch(orig, cur)
  assert.ok(p)
  assert.deepEqual(Object.keys(p), ['chunks'])
  assert.deepEqual(
    p.chunks?.map((c) => c.id),
    orig.chunks.map((c) => c.id),
  )
  assert.equal(p.chunks?.[2].meaningKo, '진찰 카드')
  assert.equal(p.chunks?.[2].id, 'ck3')
})

test('#171 본문: 이름만 → {title} · 일본어 이름 비움 → null · 수준 · 설명', () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.title = '병원 접수'
  assert.deepEqual(topicEditPatch(orig, cur), { title: '병원 접수' })
  cur.titleJa = '  '
  cur.level = 'N4'
  cur.description = ''
  assert.deepEqual(topicEditPatch(orig, cur), { title: '병원 접수', titleJa: null, level: 'N4', description: null })
})

test('#171 본문: 지운 표현은 빠지고·순서 바꿈도 전체 목록·새 표현은 id 없음·글을 바꿔도 보낸 id 는 원래 값(새 id 는 서버가 정한다)', () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.chunks.splice(1, 1)
  ;[cur.chunks[0], cur.chunks[1]] = [cur.chunks[1], cur.chunks[0]]
  cur.chunks[3].textJa = '診察'
  cur.chunks.push({ key: 'c99', chunkType: 'ACTION', textJa: '待つ', reading: 'まつ', meaningKo: '기다리다' })
  const p = topicEditPatch(orig, cur)
  assert.ok(p?.chunks)
  assert.equal(p.chunks.length, orig.chunks.length)
  assert.deepEqual(
    p.chunks.map((c) => c.id ?? null),
    ['ck3', 'ck1', 'ck4', 'ck5', 'ck6', 'ck7', 'ck8', 'ck9', null],
  )
  assert.ok(!p.chunks.some((c) => c.id === 'ck2'), '지운 표현은 목록에서 빠진다')
  assert.equal(p.chunks[3].textJa, '診察')
  assert.equal(p.chunks[3].id, 'ck5')
})

test('#171 본문: 화면이 만든 id(원본에 없는 값)는 싣지 않는다', () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.chunks[0] = { ...cur.chunks[0], id: 'made-by-screen' }
  const p = topicEditPatch(orig, cur)
  assert.equal(p?.chunks?.[0].id, undefined)
})

test('#174 본문: 전체 값, 표현에 id 없음(사본은 새 행)', () => {
  const cur = topicEditFrom(topic({ id: 'seed-1', isSeed: true }))
  const b = topicForkBody(cur)
  assert.equal(b.title, '병원 진료')
  assert.equal(b.chunks?.length, NAMES.length)
  assert.ok(b.chunks?.every((c) => !('id' in c)))
})

test('검사: #171 은 보내는 칸만(읽기 빈 옛 표현이 이름 고치기를 막지 않음) · 표현을 보내면 표현도 · #174 는 전부', () => {
  const t = topic()
  t.chunks[0] = { ...t.chunks[0], reading: null }
  const orig = topicEditFrom(t)
  const cur = clone(orig)
  cur.title = '병원 접수'
  assert.deepEqual(validateTopicEdit(cur, 'patch', topicEditPatch(orig, cur)), [])
  assert.ok(validateTopicEdit(cur, 'fork', topicEditPatch(orig, cur)).some((p) => p.key.endsWith(':reading')))
  cur.chunks[1].meaningKo = '보험 카드'
  assert.ok(validateTopicEdit(cur, 'patch', topicEditPatch(orig, cur)).some((p) => p.key.endsWith(':reading')))
  const long = clone(orig)
  long.title = '가'.repeat(21)
  assert.deepEqual(
    validateTopicEdit(long, 'patch', topicEditPatch(orig, long)).map((p) => p.key),
    ['title'],
  )
})

test('저장: 바뀐 게 없으면·검사 실패면 서버 0, 내 주제 → PATCH 1회(같은 id), 기본 주제 → fork 1회(사본 id)', async () => {
  const orig = topicEditFrom(topic())
  const none = fakeApi()
  assert.deepEqual(await runTopicEditSave({ id: 't-mine', route: 'patch', orig, cur: clone(orig) }, none.api), { kind: 'unchanged' })
  assert.equal(none.calls.length, 0)

  const bad = clone(orig)
  bad.title = ''
  const inv = fakeApi()
  assert.equal((await runTopicEditSave({ id: 't-mine', route: 'patch', orig, cur: bad }, inv.api)).kind, 'invalid')
  assert.equal(inv.calls.length, 0)

  const cur = clone(orig)
  cur.description = '접수·진료·약 받기'
  const p = fakeApi()
  assert.deepEqual(await runTopicEditSave({ id: 't-mine', route: 'patch', orig, cur }, p.api), { kind: 'saved', route: 'patch', id: 't-mine' })
  assert.deepEqual(
    p.calls.map((c) => [c.op, c.id]),
    [['patch', 't-mine']],
  )
  assert.deepEqual(p.calls[0].body, { description: '접수·진료·약 받기' })

  const seed = topicEditFrom(topic({ id: 'seed-1', isSeed: true }))
  const seedCur = clone(seed)
  seedCur.title = '내 병원'
  const f = fakeApi()
  assert.deepEqual(await runTopicEditSave({ id: 'seed-1', route: 'fork', orig: seed, cur: seedCur }, f.api), { kind: 'saved', route: 'fork', id: 'copy-1' })
  assert.deepEqual(
    f.calls.map((c) => [c.op, c.id]),
    [['fork', 'seed-1']],
  )
  assert.equal(f.calls[0].body.title, '내 병원')
  assert.ok(f.calls[0].body.chunks?.every((c) => !('id' in c)))
})

test('저장 더블 탭: 같은 가드로 두 번 눌러도 요청 1건', async () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.title = '병원 접수'
  let release: () => void = () => {}
  const f = fakeApi({ patch: () => new Promise((r) => (release = () => r({ topic: { id: 't-mine' } }))) })
  const guard = createOnceGuard()
  const run = () => guard.run(async () => void (await runTopicEditSave({ id: 't-mine', route: 'patch', orig, cur }, f.api)))
  assert.equal(run(), true)
  assert.equal(run(), false)
  await new Promise((r) => setImmediate(r))
  assert.equal(f.calls.length, 1)
  release()
})

const err = (status: number, details: Record<string, unknown> = {}) => new ApiError(SERVER_MSG, status, null, details)

async function failOf(route: 'patch' | 'fork', e: unknown) {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.chunks[0].meaningKo = '접수 창구'
  const f = fakeApi(route === 'patch' ? { patch: () => Promise.reject(e) } : { fork: () => Promise.reject(e) })
  const o = await runTopicEditSave({ id: 'x', route, orig, cur }, f.api)
  assert.equal(o.kind, 'fail')
  if (o.kind !== 'fail') throw new Error('fail 아님')
  assert.ok(!o.failure.text.includes(SERVER_MSG), '서버 message 를 쓰지 않는다')
  return topicEditFailView(o.failure, cur)
}

test('실패: 409 ALREADY_COPIED → 이미 내 버전(저장 막고 [내 버전 열기]) · 409 USE_FORK → 기본 주제로 바꾸고 다시 누르기', async () => {
  const copied = await failOf('fork', err(409, { reason: 'ALREADY_COPIED', state: 'COPIED' }))
  assert.equal(copied.copied, true)
  assert.equal(copied.message, null)
  const useFork = await failOf('patch', err(409, { reason: 'USE_FORK' }))
  assert.equal(useFork.forceSeed, true)
  assert.deepEqual(useFork.message, { text: EDIT.useFork, block: false })
})

test('실패: 404 TOPIC_GONE(#171)·SEED_NOT_FOUND(#174) → 찾을 수 없음 · USER_GONE 은 다시 로그인 문구', async () => {
  assert.equal((await failOf('patch', err(404, { reason: 'TOPIC_GONE' }))).notFound, true)
  assert.equal((await failOf('fork', err(404, { reason: 'SEED_NOT_FOUND' }))).notFound, true)
  const gone = await failOf('patch', err(404, { reason: 'USER_GONE' }))
  assert.equal(gone.notFound, false)
  assert.equal(gone.message?.text, FAIL.userGone)
})

test('실패: 400 chunks[i].id not_found → 「다른 곳에서 바뀐 표현」 · 400 칸 → 그 행 칸', async () => {
  const stale = await failOf('patch', err(400, { field: 'chunks[1].id', reason: 'not_found' }))
  assert.deepEqual(stale.message, { text: EDIT.chunkGone, block: false })
  assert.deepEqual(stale.problems, [])
  const field = await failOf('patch', err(400, { problems: [{ field: 'chunks[0].reading', reason: 'reading' }] }))
  assert.deepEqual(
    field.problems.map((p) => p.key),
    ['chunk:c1:reading'],
  )
  assert.equal(field.message, null)
  const dupId = editServerProblems([{ field: 'chunks[0].id', text: FAIL.field.duplicate, defect: false }], topicEditFrom(topic()))
  assert.equal(dupId.stale, false)
  assert.equal(dupId.defect, true)
})

test('실패: 하루 10(내 버전 포함)·내 주제 30·분당 한도·네트워크', async () => {
  const daily = await failOf('fork', err(429, { reason: 'DAILY_LIMIT', retryAfterSec: 3600 }))
  assert.deepEqual(daily.message, { text: FAIL.topicSave.dailyFork, block: true })
  const dailyPatch = await failOf('patch', err(429, { reason: 'DAILY_LIMIT', retryAfterSec: 3600 }))
  assert.equal(dailyPatch.message?.block, true)
  assert.equal((await failOf('fork', err(409, { reason: 'TOPIC_LIMIT' }))).message?.text, FAIL.topicSave.limit)
  assert.equal((await failOf('patch', err(429, { retryAfterSec: 12 }))).message?.text, FAIL.writeRate(12))
  assert.equal((await failOf('patch', new ApiError('', 0))).message?.text, FAIL.network)
})

test('[내 버전 열기]: 그 시드의 살아 있는 사본 id(고아·숨김·다른 시드는 아님)', () => {
  const o = (x: Partial<SeedOverrideItem>) => ({ kind: 'TOPIC', seedId: 's1', seedTitle: '', state: 'COPIED', copyId: 'c1', orphan: false, updatedAt: '', ...x }) as SeedOverrideItem
  assert.equal(seedCopyId([o({})], 's1'), 'c1')
  assert.equal(seedCopyId([o({ orphan: true })], 's1'), null)
  assert.equal(seedCopyId([o({ state: 'HIDDEN', copyId: null })], 's1'), null)
  assert.equal(seedCopyId([o({ seedId: 's2' })], 's1'), null)
  assert.equal(seedCopyId([o({ kind: 'SCENARIO' })], 's1'), null)
})

test('저장 뒤 토스트: 내 주제 「저장했어요」 · 기본 주제 「내 버전으로 저장했어요」(sessionStorage 왕복)', () => {
  for (const [route, text] of [
    ['patch', TOAST.saved],
    ['fork', TOAST.copySaved],
  ] as const) {
    const f = parseFlash(JSON.stringify(editFlash(route)))
    assert.ok(f)
    assert.equal(flashText(f), text)
  }
})

test('D4-A 상자: 표현 수준과 고른 수준이 다를 때만 · [지금 표현 두기]로 넘긴 수준이면 숨김 · 다른 수준으로 또 바꾸면 다시', () => {
  assert.equal(levelRegenPrompt('N5', 'N5', null), null)
  assert.deepEqual(levelRegenPrompt('N5', 'N4', null), { from: 'N5', to: 'N4' })
  assert.equal(levelRegenPrompt('N5', 'N4', 'N4'), null)
  assert.deepEqual(levelRegenPrompt('N5', 'N3', 'N4'), { from: 'N5', to: 'N3' })
})

test('D4-A 요청 본문: 지금 이름 + 새 수준 · 이름이 2자 미만이면 보내지 않음', () => {
  assert.deepEqual(levelRegenBody({ title: ' 병원 진료 ', level: 'N4' }), { title: '병원 진료', level: 'N4' })
  assert.equal(levelRegenBody({ title: '병', level: 'N4' }), null)
})

test('D4-A 다시 받기: #170 한 건만(저장 전 쓰기 0) → 표현만 바뀌고 이름·설명 그대로, 받은 표현은 id 없음·열쇠는 다음 번호부터 → 저장 본문은 옛 id 0개', async () => {
  const orig = topicEditFrom(topic())
  let cur = clone(orig)
  cur.level = 'N4'
  const posts: unknown[] = []
  const save = fakeApi()
  const fresh = NAMES.slice(0, 8).map(([ja, rd, mk]) => ({ chunkType: 'NAME', textJa: ja + 'の', reading: rd + 'の', meaningKo: mk + ' 것' }))
  const flight = createTopicDraftFlight({
    post: (body) => {
      posts.push(body)
      return Promise.resolve({ draft: { title: '다른 이름', titleJa: null, level: 'N4', description: '다른 설명', chunks: fresh }, warnings: ['CHUNKS_SHORT', 'TITLE_JA_MISSING'] })
    },
    onState: () => {},
    timers: { set: () => 0, clear: () => {} },
  })
  const body = levelRegenBody(cur)
  assert.ok(body)
  const outcome = await new Promise<TopicDraftOutcome>((resolve) => assert.equal(flight.start(body, resolve), true))
  assert.equal(outcome.kind, 'ok')
  if (outcome.kind !== 'ok') return
  cur = { ...cur, chunks: regenChunks(cur.chunks, outcome.draft.chunks) }
  assert.deepEqual(posts, [{ title: '병원 진료', level: 'N4' }])
  assert.equal(save.calls.length, 0, '받는 동안 저장 요청 없음')
  assert.equal(cur.title, '병원 진료')
  assert.equal(cur.description, orig.description)
  assert.equal(cur.chunks.length, 8)
  assert.ok(cur.chunks.every((c) => c.id === undefined))
  assert.equal(cur.chunks[0].key, `c${NAMES.length + 1}`)
  const p = topicEditPatch(orig, cur)
  assert.ok(p?.chunks)
  assert.equal(p.level, 'N4')
  assert.ok(p.chunks.every((c) => !('id' in c)), '옛 표현은 모두 빠지고 새 표현만')
  assert.deepEqual(
    regenWarnLines(outcome.warnings, cur).map((w) => w.code),
    ['CHUNKS_SHORT'],
  )
})

test('D4-A 실패 문구: 첫 줄은 늘 「표현을 받지 못했어요…」, 한도·동시 요청은 둘째 줄, 하루 한도는 버튼 막기', () => {
  const engine = levelRegenFailLines(failureCopy('topicDraft', { status: 502, message: SERVER_MSG, code: null, details: {}, retryAfterSec: null }))
  assert.deepEqual(engine, { text: EDIT.lvlFail, detail: null, block: false })
  const busy = levelRegenFailLines(failureCopy('topicDraft', { status: 409, message: SERVER_MSG, code: null, details: { reason: 'DRAFT_BUSY' }, retryAfterSec: null }))
  assert.equal(busy.detail, FAIL.topicDraft.busy)
  const daily = levelRegenFailLines(failureCopy('topicDraft', { status: 429, message: SERVER_MSG, code: null, details: { reason: 'DAILY_LIMIT', retryAfterSec: 7200 }, retryAfterSec: null }))
  assert.equal(daily.block, true)
  assert.ok(daily.detail && !daily.detail.includes(SERVER_MSG))
})

test('ChunkEditor: 행 자리 고치기는 서버 id 를 그대로 들고 간다(새 표현은 id 없음)', () => {
  const src = readFileSync(join(__dirname, '..', 'ChunkEditor.tsx'), 'utf8')
  assert.match(src, /const keepId = edit\.isNew \? undefined : chunks\.find\(\(c\) => c\.key === edit\.key\)\?\.id/)
  assert.match(src, /\.\.\.\(keepId \? \{ id: keepId \} : \{\}\)/)
})

test('S7 화면: 서버 message·엔진명·「AI」 문구 없음, 저장 이동은 { scroll: false }', () => {
  const dir = join(__dirname, '..')
  const files = ['TopicEditScreen.tsx', 'useTopicEdit.ts', 'LevelRegenBox.tsx'].map((f) => readFileSync(join(dir, f), 'utf8'))
  for (const src of files) {
    assert.ok(!/\b(e|err|error|res)\.message\b/.test(src), '서버 message 를 읽지 않는다')
    assert.ok(!/claude|sonnet|haiku|opus|qwen|whisper|reazon|style-bert/i.test(src))
    assert.ok(!/['"`][^'"`]*\bAI\b[^'"`]*['"`]/.test(src))
  }
  const hook = files[1]
  const replaces = [...hook.matchAll(/router\.replace\(([^\n]*)\)/g)].map((m) => m[1])
  assert.ok(replaces.length >= 3)
  for (const c of replaces) assert.match(c, /\{\s*scroll:\s*false\s*\}/)
})
