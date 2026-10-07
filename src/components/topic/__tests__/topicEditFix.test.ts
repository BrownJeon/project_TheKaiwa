import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Topic } from '@/types/lesson'
import type { TopicUpdateInput } from '@/types/topicWrite'
import {
  chunkTextRetexted,
  chunkUpsert,
  createTopicDraftFlight,
  levelRegenBody,
  levelRegenPrompt,
  nextAddedKey,
  nextChunkKey,
  regenArrival,
  regenChunks,
  runTopicEditSave,
  topicEditFrom,
  topicEditLocked,
  topicEditPatch,
  type EditableChunk,
  type EditableTopicDraft,
  type TopicDraftOutcome,
  type TopicEditApi,
} from '../logic'
import { EDIT } from '../topicCopy'

// task-045 T5-4-fix(REV-163 M-1·M-2·M-3·L-1). 훅·화면은 DOM 없이 돌릴 수 없어 순수 함수는 값으로, 훅·화면은 소스 문자열로 고정한다
// (`draftHookGuard.test.ts` 와 같은 방식 — 규칙을 설명하는 주석은 제외하고 본다). 실제 초점·터치·높이는 QA 실측.
const DIR = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (f: string) => strip(readFileSync(join(DIR, f), 'utf8'))

/** `start` 가 처음 나오는 곳부터 `end` 가 처음 나오는 곳 앞까지. 못 찾으면 시험이 실패한다(코드가 크게 바뀌어 가드를 다시 맞춰야 한다는 뜻). */
function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start)
  assert.ok(a >= 0, `찾지 못함: ${start}`)
  const b = src.indexOf(end, a + 1)
  assert.ok(b > a, `끝을 찾지 못함: ${end}`)
  return src.slice(a, b)
}

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

function topic(): Topic {
  return {
    id: 't-mine',
    title: '병원 진료',
    titleJa: '病院',
    level: 'N5',
    description: '병원에서 접수하고 진료받기',
    tags: [],
    isSeed: false,
    chunks: NAMES.map(([ja, rd, mk], i) => ({ id: `ck${i + 1}`, order: i + 1, chunkType: 'NAME' as const, textJa: ja, reading: rd, meaningKo: mk })),
    lessonCount: 0,
    lastLessonAt: null,
  }
}

const clone = (d: EditableTopicDraft): EditableTopicDraft => ({ ...d, chunks: d.chunks.map((c) => ({ ...c })) })

function fresh(n: number): EditableChunk[] {
  return Array.from({ length: n }, (_, i) => ({ key: `x${i}`, chunkType: 'ACTION' as const, textJa: `動作${i}`, reading: `どうさ${i}`, meaningKo: `동작 ${i}` }))
}

// ── M-1 ① 받는 중 칸 잠금 ─────────────────────────────────────────────────

test('M-1 잠금 판정: 저장 중이거나 표현을 받는 중이면 잠긴다 · 둘 다 아니면 풀린다', () => {
  assert.equal(topicEditLocked({ saving: false, regenBusy: false }), false)
  assert.equal(topicEditLocked({ saving: true, regenBusy: false }), true)
  assert.equal(topicEditLocked({ saving: false, regenBusy: true }), true)
  assert.equal(topicEditLocked({ saving: true, regenBusy: true }), true)
})

test('M-1 화면: 이름·수준·설명 칸과 표현 편집이 같은 잠금(locked)을 쓴다 · [그만두기] 상자는 잠금과 무관', () => {
  const screen = read('TopicEditScreen.tsx')
  assert.match(screen, /const locked = topicEditLocked\(\{ saving: m\.saving, regenBusy \}\)/)
  assert.match(screen, /<TopicInfoFields[^>]*?\bdisabled=\{locked\}/, '이름·일본어 이름·수준·설명 칸')
  assert.match(screen, /<ChunkEditor[^>]*?\bdisabled=\{locked\}/, '표현 편집')
  assert.ok(!/disabled=\{m\.saving\}/.test(screen), '저장 중만 보는 옛 잠금이 남아 있지 않다')
  assert.ok(!/<LevelRegenBox[^>]*\bdisabled=/.test(screen), '수준 바꿈 상자(그 안의 [그만두기])는 잠그지 않는다')
})

test('M-1 편집기: 잠금 중에는 이미 펼친 편집기의 [바꾸기]도 막는다(받는 중 표현 목록이 바뀌지 않는다)', () => {
  const src = read('ChunkEditor.tsx')
  assert.match(src, /const apply = \(\) => \{\s*if \(!edit \|\| disabled\) return/)
  assert.match(src, /aria-disabled=\{locked \|\| undefined\} onClick=\{onApply\}/, '[바꾸기] 가 눈에도 막힘을 보인다')
  assert.match(src, /locked=\{disabled\}/)
})

test('M-1 훅: 저장 중에는 [표현 다시 받기]·[지금 표현 두기]가 저장 요청과 겹치지 않는다', () => {
  const hook = read('useTopicEdit.ts')
  assert.match(between(hook, 'const regen = useCallback(', 'const keepChunks'), /if \(!draft \|\| saving \|\| regenFailure\?\.block\) return/)
  assert.match(between(hook, 'const keepChunks = useCallback(', 'const cancelRegen'), /if \(!draft \|\| saving \|\| regenFlight\.busy\) return/)
})

// ── M-1 ② 도착 처리 — 경합 순서 규칙 ──────────────────────────────────────

test('M-1 도착: 요청 시점 이름과 지금 이름이 다르면 적용하지 않는다 — 옛 이름으로 받은 표현이 새 이름 아래 저장되는 경로 0', () => {
  const cur = topicEditFrom(topic())
  cur.title = '병원 접수'
  assert.equal(regenArrival(cur, { title: '병원 진료', level: 'N5' }, fresh(6)), null)
  // 앞뒤·사이 공백만 다른 이름은 같은 이름(요청도 oneLine 으로 보낸다)
  cur.title = ' 병원   진료 '
  assert.ok(regenArrival(cur, { title: '병원 진료', level: 'N5' }, fresh(6)))
})

test('M-1 도착: 표현만 바꾼다(이름·일본어 이름·설명·수준 그대로) · 받은 표현은 id 없고 열쇠는 지금 목록 다음 번호부터', () => {
  const cur = topicEditFrom(topic())
  const r = regenArrival(cur, { title: cur.title, level: cur.level }, fresh(6))
  assert.ok(r)
  assert.deepEqual([r.draft.title, r.draft.titleJa, r.draft.description, r.draft.level], [cur.title, cur.titleJa, cur.description, cur.level])
  assert.equal(r.draft.chunks.length, 6)
  assert.ok(r.draft.chunks.every((c) => c.id === undefined))
  assert.deepEqual(
    r.draft.chunks.map((c) => c.key),
    ['c10', 'c11', 'c12', 'c13', 'c14', 'c15'],
  )
})

test('M-1 도착: 표현의 수준은 요청 시점 수준 — 도착 직전 사용자가 수준을 되돌렸어도 요청 때 수준으로 적고, 수준 상자가 다시 묻는다', () => {
  const cur = topicEditFrom(topic())
  cur.level = 'N5' // 원래 수준으로 되돌린 뒤
  const r = regenArrival(cur, { title: cur.title, level: 'N4' }, fresh(6)) // 요청은 N4 로 보냈다
  assert.ok(r)
  assert.equal(r.chunksLevel, 'N4')
  assert.equal(r.draft.level, 'N5', '칩 값은 건드리지 않는다')
  assert.deepEqual(levelRegenPrompt(r.chunksLevel, r.draft.level, null), { from: 'N4', to: 'N5' })
  // 요청 수준 그대로면 상자는 없다
  const same = regenArrival({ ...cur, level: 'N4' }, { title: cur.title, level: 'N4' }, fresh(6))
  assert.ok(same)
  assert.equal(levelRegenPrompt(same.chunksLevel, 'N4', null), null)
})

test('M-1 도착: 서버 쓰기 0 — 받기·도착 동안 저장 API 호출 0, 사용자가 [저장]을 눌렀을 때만 1건(새 표현만·옛 id 0)', async () => {
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.level = 'N4'
  const posts: unknown[] = []
  const saves: Array<{ op: string; body: TopicUpdateInput }> = []
  const api: TopicEditApi = {
    patch: (_id, body) => (saves.push({ op: 'patch', body }), Promise.resolve({ topic: { id: 't-mine' } })),
    fork: (_id, body) => (saves.push({ op: 'fork', body }), Promise.resolve({ copyId: 'c' })),
  }
  const flight = createTopicDraftFlight({
    post: (body) => {
      posts.push(body)
      return Promise.resolve({ draft: { title: 'x', titleJa: null, level: 'N4', description: 'y', chunks: NAMES.slice(0, 8).map(([ja, rd, mk]) => ({ chunkType: 'NAME', textJa: `${ja}の`, reading: `${rd}の`, meaningKo: `${mk} 것` })) }, warnings: [] })
    },
    onState: () => {},
    timers: { set: () => 0, clear: () => {} },
  })
  const body = levelRegenBody(cur)
  assert.ok(body)
  const o = await new Promise<TopicDraftOutcome>((resolve) => assert.equal(flight.start(body, resolve), true))
  assert.equal(o.kind, 'ok')
  if (o.kind !== 'ok') return
  const arrived = regenArrival(cur, { title: body.title, level: cur.level }, o.draft.chunks)
  assert.ok(arrived)
  assert.deepEqual(posts, [{ title: '병원 진료', level: 'N4' }], '요청은 #170 한 건')
  assert.equal(saves.length, 0, '도착 처리는 서버를 쓰지 않는다')
  const saved = await runTopicEditSave({ id: 't-mine', route: 'patch', orig, cur: arrived.draft }, api)
  assert.equal(saved.kind, 'saved')
  assert.deepEqual(
    saves.map((s) => s.op),
    ['patch'],
  )
  assert.ok(saves[0].body.chunks?.every((c) => !('id' in c)))
})

test('M-1 훅 소스: 저장 API(updateTopic·forkTopic)는 import 와 저장 한 곳(runTopicEditSave 인자)에만 나오고, 다시 받기·도착 처리에는 없다', () => {
  const hook = read('useTopicEdit.ts')
  assert.equal(hook.match(/\bupdateTopic\b/g)?.length, 2, 'import 1 + 저장 1')
  assert.equal(hook.match(/\bforkTopic\b/g)?.length, 2, 'import 1 + 저장 1')
  assert.equal(hook.match(/\brunTopicEditSave\(/g)?.length, 1)
  assert.match(between(hook, 'const save = useCallback(', 'const openCopy'), /runTopicEditSave\(input, \{ patch: updateTopic, fork: forkTopic \}\)/)
  const regen = between(hook, 'const regen = useCallback(', 'const keepChunks')
  assert.ok(!/updateTopic|forkTopic|runTopicEditSave|getManageTopics|router\./.test(regen), '다시 받기는 #170 외에 아무 요청·이동도 하지 않는다')
  assert.match(regen, /regenArrival\(cur, \{ title: body\.title, level \}, o\.draft\.chunks\)/, '도착은 경합 규칙 함수를 거친다')
})

// ── M-2 새 표현 편집기 열쇠 충돌 ─────────────────────────────────────────

test('M-2 열어 둔 [＋ 표현 더하기] 편집기 + 다시 받기 도착 → [바꾸기]는 덮어쓰기가 아니라 7번째 행 추가', () => {
  const orig = topicEditFrom(topic())
  const editorKey = nextAddedKey(orig.chunks, 0).key // 편집기를 연 순간의 열쇠
  const r = regenArrival(orig, { title: orig.title, level: orig.level }, fresh(6))
  assert.ok(r)
  assert.equal(r.draft.chunks.length, 6)
  assert.ok(!r.draft.chunks.some((c) => c.key === editorKey), '받은 표현 열쇠가 열린 편집기 열쇠와 겹치지 않는다')
  const added: EditableChunk = { key: editorKey, chunkType: 'NAME', textJa: '診察室', reading: 'しんさつしつ', meaningKo: '진찰실' }
  const after = chunkUpsert(r.draft.chunks, added)
  assert.equal(after.length, 7, '추가 — 받은 표현 하나가 사라지지 않는다')
  assert.deepEqual(
    after.slice(0, 6).map((c) => c.textJa),
    r.draft.chunks.map((c) => c.textJa),
  )
  assert.equal(after[6].textJa, '診察室')
  // 옛 방식(nextChunkKey)은 정확히 이 충돌을 냈다 — 회귀 확인용
  assert.equal(nextChunkKey(orig.chunks), regenChunks(orig.chunks, fresh(1))[0].key)
})

test('M-2 열쇠 규칙: 새 행 `n<번호>`는 읽어 온·다시 받은 행 `c<번호>` 와 이름 공간이 다르고, 한 번 쓴 번호를 다시 쓰지 않는다', () => {
  const rows = topicEditFrom(topic()).chunks
  assert.ok(rows.every((c) => /^c\d+$/.test(c.key)))
  assert.ok(regenChunks(rows, fresh(4)).every((c) => /^c\d+$/.test(c.key)))
  const a = nextAddedKey(rows, 0)
  assert.deepEqual(a, { key: 'n1', n: 1 })
  // 취소해 목록에 없어도 편집기가 기억한 번호(used)보다 크게 간다
  assert.deepEqual(nextAddedKey(rows, a.n), { key: 'n2', n: 2 })
  // 더한 뒤 지워도(목록에서 사라져도) used 가 이어진다 · 편집기가 다시 만들어져 used 가 0 이어도 목록의 n 열쇠 다음 번호
  const withN: EditableChunk[] = [...rows, { key: 'n3', chunkType: 'NAME', textJa: 'a', reading: 'a', meaningKo: 'a' }]
  assert.deepEqual(nextAddedKey(withN, 0), { key: 'n4', n: 4 })
  assert.deepEqual(nextAddedKey(rows, 5), { key: 'n6', n: 6 })
  // 다시 받은 뒤 (목록이 모두 c 열쇠로 바뀐 뒤)에도 n 열쇠는 c 열쇠와 겹치지 않는다
  const after = regenChunks(withN, fresh(3))
  assert.ok(!after.some((c) => c.key === nextAddedKey(after, 0).key))
})

test('M-2 편집기 소스: [＋ 표현 더하기]는 nextChunkKey 가 아니라 nextAddedKey 로 열쇠를 잡고 번호를 ref 로 이어 간다', () => {
  const src = read('ChunkEditor.tsx')
  assert.ok(!/\bnextChunkKey\b/.test(src), '목록 최댓값+1 열쇠는 다시 받기 열쇠와 겹친다')
  assert.match(src, /const k = nextAddedKey\(chunks, addNo\.current\)\s*addNo\.current = k\.n/)
})

// ── M-3 글을 바꾸면 연습 기록이 처음부터 — 안내 ─────────────────────────────

// 서버 `normalizeRefText`(NFKC · 공백·문장부호·물결표 제거, 가나 종류·장음은 그대로)와 같은 규칙인지 경계 쌍으로 고정한다.
const PAIRS: Array<[string, string, boolean, string]> = [
  ['受付', '受 付', false, '공백'],
  ['受付', '受　付', false, '전각 공백'],
  ['カメラ', 'ｶﾒﾗ', false, '반각 가타카나'],
  ['コーヒー', 'ｺｰﾋｰ', false, '반각 장음(ｰ → ー)'],
  ['すみません', 'すみません。', false, '문장부호'],
  ['ありがとう', 'ありがとう〜', false, '물결표'],
  ['コーヒー', 'コヒー', true, '장음 삭제'],
  ['カメラ', 'かめら', true, '가나 종류(카타카나 → 히라가나)'],
  ['受付', '診察', true, '다른 글'],
]

test('M-3 안내 판정: 서버와 같은 정규화 — 공백·전각/반각·문장부호는 같은 글, 장음·가나 종류·다른 글은 바뀐 글', () => {
  for (const [a, b, changed, why] of PAIRS) assert.equal(chunkTextRetexted(a, b), changed, `${a} → ${b} (${why})`)
  assert.equal(chunkTextRetexted(undefined, '診察'), false, '새 표현(서버 원래 글 없음)은 안내하지 않는다')
  assert.equal(chunkTextRetexted(' 受付 ', '受付'), false, '앞뒤 공백')
})

test('L-1 ① 글만 바꾼 표현은 「바뀐 게 없음」이 아니다 — 정규화 경계 쌍에서도 표현 목록을 보낸다(같은 id 로)', () => {
  for (const [a, b, , why] of PAIRS) {
    const orig = topicEditFrom(topic())
    orig.chunks[0].textJa = a
    const cur = clone(orig)
    cur.chunks[0].textJa = b
    const p = topicEditPatch(orig, cur)
    assert.ok(p?.chunks, `${a} → ${b} (${why}) — 글만 바꿔도 chunks 를 보낸다`)
    assert.deepEqual(Object.keys(p), ['chunks'])
    assert.equal(p.chunks[0].id, 'ck1', '원래 id 를 싣는다(새 id 는 서버가 정한다)')
    assert.equal(p.chunks[0].textJa, b.trim())
  }
  // 앞뒤 공백만 다르면 바뀐 게 없다(서버를 부르지 않는다)
  const orig = topicEditFrom(topic())
  const cur = clone(orig)
  cur.chunks[0].textJa = ` ${cur.chunks[0].textJa} `
  assert.equal(topicEditPatch(orig, cur), null)
})

test('M-3 문구: 해요체 한 문장 · 「세요」 없음 · 엔진명·「AI」 없음 · 뜻·읽기·종류가 아니라 일본어 글을 말한다', () => {
  assert.equal(EDIT.textChanged, '일본어 글을 바꾸면 이 표현의 연습 기록이 처음부터 다시 시작돼요.')
  assert.ok(/요\.$/.test(EDIT.textChanged))
  assert.ok(!/세요/.test(EDIT.textChanged))
  assert.ok(!/claude|sonnet|haiku|opus|qwen|whisper|reazon|style-bert|\bAI\b/i.test(EDIT.textChanged))
})

test('M-3 편집기·화면 소스: 안내는 S7 의 기존 행 고치기에서만 — 새 표현·S4 주제 만들기에는 없다, 색만이 아니라 글로 · 입력과 연결', () => {
  const editor = read('ChunkEditor.tsx')
  const retexted = between(editor, 'const retextedFor = (e: Editing) => {', 'const editorFor')
  assert.match(retexted, /if \(e\.isNew \|\| !origTexts\) return false/, '새 표현과 원래 글이 없는 화면(S4)은 안내하지 않는다')
  assert.match(retexted, /chunkTextRetexted\(id === undefined \? undefined : origTexts\.get\(id\), e\.values\.textJa\)/, '서버가 준 원래 글과 비교')
  assert.match(editor, /<p id=\{RETEXT_NOTE_DOM_ID\} role="note"[^>]*>\s*<span aria-hidden="true"[^>]*>\s*⚠\s*<\/span>\s*<span[^>]*>\{EDIT\.textChanged\}<\/span>/, '글자로 말한다(⚠ 는 장식)')
  assert.match(editor, /const note = f === 'textJa' && retexted/, '일본어 글 칸 밑에만')
  assert.match(editor, /aria-describedby=\{described\}/, '글 칸이 안내를 읽어 준다')
  assert.match(read('TopicEditScreen.tsx'), /<ChunkEditor[^>]*\borigTexts=\{m\.origTexts\}/, 'S7 만 원래 글을 넘긴다')
  for (const f of ['TopicDraftReview.tsx', 'TopicCreateScreen.tsx', 'useTopicDraft.ts']) assert.ok(!/origTexts/.test(read(f)), `${f}(S4) 는 원래 글을 넘기지 않는다`)
  const hook = read('useTopicEdit.ts')
  assert.match(hook, /const origTexts = useMemo\(\(\) => new Map\(\(loaded\?\.orig\.chunks \?\? \[\]\)\.flatMap\(\(c\) => \(c\.id \? \[\[c\.id, c\.textJa\] as \[string, string\]\] : \[\]\)\)\), \[loaded\]\)/, '서버에서 읽은 원본에서만(고친 값이 아니라)')
})

// ── L-1 ③ 서버 message 를 화면에 쓰지 않는다(소스 가드) ──────────────────────

test('L-1 ③ S7 화면·훅·상자·편집기에서 `.message` 는 고정 문구를 담은 값(v = 저장 결과 보기, p = 칸 문제)에만 쓴다 — toErr(e).message·e.message 금지', () => {
  const ALLOWED = /\b(?:v|p)\??$/
  for (const f of ['TopicEditScreen.tsx', 'useTopicEdit.ts', 'LevelRegenBox.tsx', 'ChunkEditor.tsx', 'TopicInfoFields.tsx']) {
    const code = read(f)
    for (const m of code.matchAll(/\.message\b/g)) {
      const before = code.slice(Math.max(0, (m.index ?? 0) - 40), m.index)
      assert.ok(ALLOWED.test(before), `${f}: 서버 message 를 읽는 것처럼 보이는 곳 — …${before.slice(-30)}.message`)
    }
  }
  const hook = read('useTopicEdit.ts')
  assert.equal(hook.match(/\bv\.message\b/g)?.length, 1, '저장 결과 보기의 고정 문구 한 곳')
  assert.ok(!/toErr\([^)]*\)\s*\.message/.test(hook))
})

// ── L-1 ⓓ 44px — S7 의 작은 버튼 전수 ──────────────────────────────────────

test('L-1 ⓓ S7 의 size="sm" 버튼은 전부 min-h-11(44px) — LevelRegenBox·TopicEditScreen·ChunkEditor', () => {
  let total = 0
  for (const f of ['LevelRegenBox.tsx', 'TopicEditScreen.tsx', 'ChunkEditor.tsx']) {
    const tags = read(f).match(/<Btn\b(?:=>|[^>])*>/g) ?? []
    for (const t of tags.filter((x) => /size="sm"/.test(x))) {
      total++
      assert.match(t, /min-h-11/, `${f}: ${t.replace(/\s+/g, ' ').slice(0, 80)}…`)
    }
  }
  assert.ok(total >= 9, `작은 버튼을 못 찾았다(${total})`)
})
