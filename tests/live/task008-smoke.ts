/**
 * task-008 라이브 스모크 — QA 계정 두 개로 단어장(#40~#46b)·오늘의 단어(#47~#54)를 실제 서버(127.0.0.1)·실제 DB 에 친다.
 * Leader 완료 기준 2~11 을 항목별 PASS/FAIL 로 찍고, 동시 요청(세트 생성·같은 order 답·finish·seed-pack·삭제+finish·답+finish)을 포함한다.
 *
 * 실행(우분투 미러): `bash tests/live/task008-smoke.sh [포트=3011]` — 세션 쿠키 생성·삭제를 감싼다.
 * LLM 호출은 A10 보강 3회(나머지 보강 요청은 메모리 캐시). DB 는 개발·운영 공유라 **QA 계정 행만** 지운다:
 * 시작 시 QA 두 계정의 단어·세트·WORDS 학습 기록·VOCAB_SESSION 스냅샷을 비우고, 끝에 다시 비운다(DAILY 는 이 실행이 만든 행만).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task008-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const startedAt = new Date()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2/i
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
  ms: number
}
async function api(cookie: string, method: string, path: string, body?: unknown): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t0
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 200) }
  }
  return { status: r.status, body: parsed, text, ms }
}
const d = (r: Res) => r.body.data as Json
const p50 = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b)
  return s.length ? Math.round(s[Math.floor((s.length - 1) / 2)]) : 0
}

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}

async function wipe(userId: string): Promise<void> {
  await prisma.vocabSession.deleteMany({ where: { userId } })
  await prisma.wordEntry.deleteMany({ where: { userId } })
  await prisma.studyLog.deleteMany({ where: { userId, type: 'WORDS' } })
  await prisma.statsSnapshot.deleteMany({ where: { userId, kind: 'VOCAB_SESSION' } })
}

interface Card {
  order: number
  wordId: string | null
  surface: string
  reading: string | null
  choices?: string[]
  flagged: boolean
  answered: boolean
  meaning?: string
  example?: string | null
  exampleKo?: string | null
  answer?: string | null
  correctText?: string
}
interface Created {
  session: Json & { id: string; mode: string; cardCount: number; downgraded: boolean } | null
  cards?: Card[]
  empty?: { reason: string; cta: string[] }
}

async function correctOf(sessionId: string, order: number): Promise<{ meaning: string; choices: string[] }> {
  const a = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId, order } } })
  return { meaning: a.meaningSnap, choices: (a.choices as string[] | null) ?? [] }
}

const HIDDEN_KEYS = ['meaning', 'example', 'exampleKo', 'answer', 'correctText', 'chosenText', 'answeredAt']
function choiceCardHides(c: Card): boolean {
  return !c.answered && HIDDEN_KEYS.every((k) => !(k in c)) && Array.isArray(c.choices) && c.choices.length === 4
}

async function main() {
  const u1 = await uid('qa-bot@thekaiwa.test')
  const u2 = await uid('qa-bot2@thekaiwa.test')
  await wipe(u1)
  await wipe(u2)

  // ── 11. A10 보강(분당 창을 여기서 시작) ─────────────────────────────
  const e1 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: '映画', enrich: true })
  const draft = d(e1).draft as Json | undefined
  check('11a enrich → draft(reading·meaning·partOfSpeech·jlpt·example·exampleKo), saved:false', e1.status === 200 && d(e1).saved === false && !!draft && draft.valid === true && ['reading', 'meaning', 'partOfSpeech', 'example', 'exampleKo'].every((k) => typeof draft[k] === 'string') && 'jlpt' in draft, `${e1.status} ${Math.round(e1.ms)}ms ${JSON.stringify(draft)?.slice(0, 160)}`)
  check('2b enrich 는 저장하지 않는다(DB 행 0)', (await prisma.wordEntry.count({ where: { userId: u1, surface: '映画' } })) === 0)
  const e2 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: '안녕하세요', enrich: true })
  const draft2 = d(e2).draft as Json | undefined
  check('11b 비일본어 → 200 {draft:{valid:false, invalidReason}, saved:false}(F8)', e2.status === 200 && draft2?.valid === false && typeof draft2?.invalidReason === 'string' && draft2?.meaning === null, `${e2.status} ${JSON.stringify(draft2)?.slice(0, 120)}`)
  const e3 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: 'コーヒー', enrich: true })
  check('11c 가타카나 표현 보강', e3.status === 200 && (d(e3).draft as Json)?.valid === true, `${e3.status} ${JSON.stringify(d(e3).draft)?.slice(0, 120)}`)
  const e4 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: '映画', enrich: true })
  check('11d 같은 표현 재보강은 캐시(빠름·같은 draft)', e4.status === 200 && JSON.stringify(d(e4).draft) === JSON.stringify(draft) && e4.ms < 1500, `${Math.round(e4.ms)}ms`)
  const rl: number[] = []
  for (let i = 0; i < 16; i++) rl.push((await api(COOKIE1, 'POST', '/api/v1/words', { surface: '映画', enrich: true })).status)
  const r21 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: '映画', enrich: true })
  check('11e 분당 21번째 보강 → 429 + retryAfterSec', rl.every((s) => s === 200) && r21.status === 429 && typeof r21.body.data.details?.retryAfterSec === 'number', `${rl.filter((s) => s === 200).length}×200 then ${r21.status}`)
  const eBad = await api(COOKIE1, 'POST', '/api/v1/words', { surface: '', enrich: true })
  check('11f 보강 빈 표현 400', eBad.status === 400)

  // ── 2. 단어 CRUD ─────────────────────────────────────────────────
  const w1 = await api(COOKIE1, 'POST', '/api/v1/words', { surface: 'テスト語', meaning: '시험어', partOfSpeech: 'NOUN', category: '스모크' })
  const w1id = String((d(w1).word as Json)?.id)
  check('2a 완전한 본문 즉시 저장 {word, saved:true}, source=MANUAL', w1.status === 200 && d(w1).saved === true && (d(w1).word as Json)?.source === 'MANUAL', `${w1.status}`)
  const dup = await api(COOKIE1, 'POST', '/api/v1/words', { surface: 'テスト語', meaning: '다른 뜻' })
  check('2c 같은 표현 409 {existingId}', dup.status === 409 && dup.body.data.details?.existingId === w1id)
  const dupE = await api(COOKIE2, 'POST', '/api/v1/words', { surface: 'テスト語', meaning: '다른 사용자' })
  check('2c′ 다른 사용자의 같은 표현은 허용', dupE.status === 200)
  const kana = await api(COOKIE1, 'POST', '/api/v1/words', { surface: 'てすと語', meaning: '히라가나 표기' })
  check('2c″ 히라가나/가타카나 다른 표기는 중복 아님(바이트 일치)', kana.status === 200, `${kana.status}`)
  const ro1 = await api(COOKIE1, 'PATCH', `/api/v1/words/${w1id}`, { correctCount: 9 })
  const ro2 = await api(COOKIE1, 'PATCH', `/api/v1/words/${w1id}`, { source: 'SEED' })
  const pt = await api(COOKIE1, 'PATCH', `/api/v1/words/${w1id}`, { note: '메모', category: '스모크2', reading: null })
  check('2d 수정: 카운터·source 400, 부분 수정 200', ro1.status === 400 && ro2.status === 400 && pt.status === 200 && d(pt).note === '메모' && d(pt).category === '스모크2' && d(pt).reading === null && d(pt).source === 'MANUAL', `${ro1.status}/${ro2.status}/${pt.status}`)
  const ptDup = await api(COOKIE1, 'PATCH', `/api/v1/words/${w1id}`, { surface: 'てすと語' })
  check('2d′ 표현을 다른 단어와 같게 바꾸면 409 {existingId}', ptDup.status === 409 && ptDup.body.data.details?.existingId === String((d(kana).word as Json)?.id))

  // 기본 단어 팩 — 동시 2회
  const [sp1, sp2] = await Promise.all([api(COOKIE1, 'POST', '/api/v1/words/seed-pack', { pack: 'N5' }), api(COOKIE1, 'POST', '/api/v1/words/seed-pack', { pack: 'N5' })])
  const added = [Number(d(sp1).added), Number(d(sp2).added)].sort()
  const seedRows = await prisma.wordEntry.count({ where: { userId: u1, source: 'SEED' } })
  check('2e 기본 단어 팩 동시 2회 → 합계 added 50 (50/0), DB SEED 행 50', sp1.status === 200 && sp2.status === 200 && added[0] === 0 && added[1] === 50 && seedRows === 50, `added=${added} rows=${seedRows}`)
  const sp3 = await api(COOKIE1, 'POST', '/api/v1/words/seed-pack', { pack: 'N5' })
  check('2e′ 재실행 added 0·skipped 50, 다른 pack 400', d(sp3).added === 0 && d(sp3).skipped === 50 && (await api(COOKIE1, 'POST', '/api/v1/words/seed-pack', { pack: 'N1' })).status === 400)

  const list1 = await api(COOKIE1, 'GET', '/api/v1/words?limit=20')
  const list2 = await api(COOKIE1, 'GET', `/api/v1/words?limit=20&cursor=${encodeURIComponent(String(d(list1).nextCursor))}`)
  const ids1 = (d(list1).items as Json[]).map((w) => w.id)
  const ids2 = (d(list2).items as Json[]).map((w) => w.id)
  check('2f 목록 기본(recent)·total 52·커서 다음 쪽 겹침 없음', d(list1).total === 52 && ids1.length === 20 && ids2.length === 20 && ids1.every((i) => !ids2.includes(i)), `total=${d(list1).total}`)
  const srch = await api(COOKIE1, 'GET', `/api/v1/words?q=${encodeURIComponent('学')}`)
  const srchKo = await api(COOKIE1, 'GET', `/api/v1/words?q=${encodeURIComponent('선생')}`)
  const srchPct = await api(COOKIE1, 'GET', `/api/v1/words?q=${encodeURIComponent('%')}`)
  check('2g 검색(surface·meaning 부분 일치), % 는 글자 그대로', (d(srch).items as Json[]).some((w) => w.surface === '学校') && (d(srchKo).items as Json[]).some((w) => w.surface === '先生') && d(srchPct).total === 0, `学=${d(srch).total} 선생=${d(srchKo).total} %=${d(srchPct).total}`)
  const q41 = await api(COOKIE1, 'GET', `/api/v1/words?q=${encodeURIComponent('あ'.repeat(41))}`)
  check('2g′ q 41자 400·sort 잘못 400', q41.status === 400 && (await api(COOKIE1, 'GET', '/api/v1/words?sort=x')).status === 400)
  const cat = await api(COOKIE1, 'GET', `/api/v1/words?category=${encodeURIComponent('N5 기초')}&limit=100`)
  check('2h 카테고리 필터', d(cat).total === 50 && (d(cat).items as Json[]).every((w) => w.category === 'N5 기초'))
  const bySurface = await api(COOKIE1, 'GET', '/api/v1/words?sort=surface&limit=100')
  const byWrong = await api(COOKIE1, 'GET', '/api/v1/words?sort=wrong&limit=100')
  check('2i 정렬 surface·wrong 200, 전체 52', bySurface.status === 200 && (d(bySurface).items as Json[]).length === 52 && byWrong.status === 200 && (d(byWrong).items as Json[]).length === 52)
  const arch = await api(COOKIE1, 'POST', `/api/v1/words/${w1id}/archive`)
  const inArchived = await api(COOKIE1, 'GET', '/api/v1/words?archived=1')
  const inActive = await api(COOKIE1, 'GET', '/api/v1/words?archived=0&limit=100')
  const cats = await api(COOKIE1, 'GET', '/api/v1/words/categories')
  const smoke2 = (d(cats) as unknown as Json[]).find((c) => c.category === '스모크2')
  const n5 = (d(cats) as unknown as Json[]).find((c) => c.category === 'N5 기초')
  check('2j 보관: 보관함에만 보임, 카테고리 집계 count(보관 제외)·archivedCount', arch.status === 200 && d(arch).archived === true && typeof d(arch).archivedAt === 'string' && (d(inArchived).items as Json[]).map((w) => w.id).join() === w1id && !(d(inActive).items as Json[]).some((w) => w.id === w1id) && smoke2?.count === 0 && smoke2?.archivedCount === 1 && n5?.count === 50, JSON.stringify(d(cats)).slice(0, 200))
  const unarch = await api(COOKIE1, 'POST', `/api/v1/words/${w1id}/unarchive`)
  check('2j′ 보관 풀기', unarch.status === 200 && d(unarch).archived === false && d(unarch).archivedAt === null)
  const det = await api(COOKIE1, 'GET', `/api/v1/words/${w1id}`)
  check('2k 상세 = WordEntry + stats + corrections', det.status === 200 && typeof (d(det).stats as Json)?.attempts === 'number' && Array.isArray(d(det).corrections), JSON.stringify(d(det).stats))

  // ── 5. 빈 풀·강등·409 ────────────────────────────────────────────
  const empty2 = await api(COOKIE2, 'POST', '/api/v1/vocab/sessions', { count: 10 })
  // QA2 는 'テスト語' 하나만 있다 → 풀 1 → FLIP 강등. 먼저 그걸 지워 NO_WORDS 를 본다.
  check('5a 풀 1(단어 1개) → FLIP 강등 downgraded:true', empty2.status === 200 && (d(empty2).session as Json)?.mode === 'FLIP' && (d(empty2).session as Json)?.downgraded === true, JSON.stringify(d(empty2).session)?.slice(0, 120))
  const qa2Session = String((d(empty2).session as Json)?.id)
  await api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${qa2Session}/finish`)
  await prisma.wordEntry.deleteMany({ where: { userId: u2 } })
  const noWords = await api(COOKIE2, 'POST', '/api/v1/vocab/sessions', {})
  check('5b 단어 0 → {session:null, empty.reason:NO_WORDS, cta}', noWords.status === 200 && d(noWords).session === null && (d(noWords).empty as Json)?.reason === 'NO_WORDS', JSON.stringify(d(noWords)))
  const noCat = await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: '없는분류' })
  check('5c 분류에 단어 없음 → NO_WORDS_IN_CATEGORY', (d(noCat).empty as Json)?.reason === 'NO_WORDS_IN_CATEGORY')
  for (const [s, m] of [['少', '소'], ['中', '중'], ['多', '다']]) await api(COOKIE1, 'POST', '/api/v1/words', { surface: `${s}数語`, meaning: `${m}수어`, category: '소수' })
  const few = (await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: '소수', mode: 'CHOICE', count: 10 })).body.data as unknown as Created
  check('5d 풀 3 + CHOICE → FLIP 강등, 카드에 뜻·예문(F1), 보기 없음', few.session?.mode === 'FLIP' && few.session?.downgraded === true && few.session?.cardCount === 3 && (few.cards ?? []).every((c) => typeof c.meaning === 'string' && !c.choices), JSON.stringify(few.session)?.slice(0, 100))
  const busy = await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', {})
  check('5e 진행 중 세트 있으면 409 {sessionId}', busy.status === 409 && busy.body.data.details?.sessionId === few.session?.id)
  // FLIP 자기 채점 1장 → finish(DONE) → 같은 분류 다시: ALL_DONE_TODAY
  const flipA = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${few.session?.id}/attempts`, { order: 0, selfResult: 'CORRECT', responseMs: 3000 })
  const flipWrongKind = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${few.session?.id}/attempts`, { order: 1, chosenText: 'x' })
  check('4f FLIP 자기 채점 200, FLIP 세트에 보기 답 400', flipA.status === 200 && d(flipA).answer === 'CORRECT' && flipWrongKind.status === 400)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${few.session?.id}/finish`)
  const allDone = await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: '소수' })
  check('5f 오늘 끝낸 세트 단어만 남음 → ALL_DONE_TODAY', (d(allDone).empty as Json)?.reason === 'ALL_DONE_TODAY', JSON.stringify(d(allDone)))

  // 보관 ↔ 세트 생성 동시(Codex C2-1): 보관된 단어가 세트에 들어 있다면 세트가 먼저 만들어졌어야 한다(startedAt < archivedAt)
  const raceIds: string[] = []
  for (const [s1, m1] of [['競一', '경일'], ['競二', '경이'], ['競三', '경삼'], ['競四', '경사'], ['競五', '경오']]) raceIds.push(String((d(await api(COOKIE1, 'POST', '/api/v1/words', { surface: `${s1}語`, meaning: `${m1}어`, category: '경합' })).word as Json).id))
  const [arA, crA] = await Promise.all([api(COOKIE1, 'POST', `/api/v1/words/${raceIds[0]}/archive`), api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: '경합', count: 5 })])
  const raceSet = d(crA) as unknown as Created
  const included = (raceSet.cards ?? []).some((c) => c.wordId === raceIds[0])
  const archivedAtMs = Date.parse(String(d(arA).archivedAt))
  const startedMs = Date.parse(String(raceSet.session?.startedAt))
  check('5i 보관·세트 생성 동시 → 둘 다 200, 보관 단어가 세트에 있으면 세트가 먼저(startedAt < archivedAt)', arA.status === 200 && crA.status === 200 && (!included || startedMs < archivedAtMs), `included=${included} cards=${raceSet.session?.cardCount}`)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${raceSet.session?.id}/finish`)
  const afterArch = d(await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: '경합', count: 5 })) as unknown as Created
  check('5j 보관 뒤 만든 세트에는 보관 단어 없음', !(afterArch.cards ?? []).some((c) => c.wordId === raceIds[0]) && (afterArch.cards ?? []).length === 4)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${afterArch.session?.id}/finish`)

  // 동시 세트 생성 2회
  const [cA, cB] = await Promise.all([api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 10 }), api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 10 })])
  const inProg = await prisma.vocabSession.count({ where: { userId: u1, status: 'IN_PROGRESS' } })
  const winner = cA.status === 200 ? cA : cB
  const loser = cA.status === 200 ? cB : cA
  check('5g 동시 세트 생성 2회 → 200 1개 + 409 {sessionId} 1개, DB 진행 중 1', [cA.status, cB.status].sort().join() === '200,409' && loser.body.data.details?.sessionId === (d(winner).session as Json)?.id && inProg === 1, `${cA.status}/${cB.status} inProgress=${inProg}`)
  const S = d(winner) as unknown as Created
  const sid = String(S.session?.id)

  // ── 3. 정답 미노출(CHOICE) ──────────────────────────────────────
  const get49 = await api(COOKIE1, 'GET', `/api/v1/vocab/sessions/${sid}`)
  const cards49 = (d(get49).cards as Card[]) ?? []
  check('3a #47·#49(진행 중) CHOICE 미답 카드: 보기 4개, 정답·뜻·예문·위치 필드 없음', S.session?.mode === 'CHOICE' && (S.cards ?? []).length === 10 && (S.cards ?? []).every(choiceCardHides) && cards49.every(choiceCardHides), `mode=${S.session?.mode}`)
  const s10words = (S.cards ?? []).map((c) => c.wordId)
  const doneTodayWords = await prisma.vocabAttempt.findMany({ where: { session: { userId: u1, status: 'DONE' } }, select: { wordId: true } })
  check('5h 오늘 DONE 세트 단어는 새 세트에서 제외', doneTodayWords.every((a) => !s10words.includes(a.wordId)))

  // ── 4. 채점 ───────────────────────────────────────────────────
  const t0 = await correctOf(sid, 0)
  const t1 = await correctOf(sid, 1)
  const wrongText = t1.choices.find((c) => c !== t1.meaning)!
  const attemptMs: number[] = []
  const a0 = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 0, chosenText: t0.meaning, responseMs: 4200 })
  attemptMs.push(a0.ms)
  const a1 = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 1, chosenText: wrongText, responseMs: 5100 })
  attemptMs.push(a1.ms)
  check('4a 서버 채점: 맞힘 CORRECT·틀림 WRONG, correctText=정답', d(a0).answer === 'CORRECT' && d(a0).correctText === t0.meaning && d(a1).answer === 'WRONG' && d(a1).correctText === t1.meaning && d(a1).chosenText === wrongText)
  const notIn = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 2, chosenText: '보기에없는말' })
  check('4b chosenText ∉ choices → 400', notIn.status === 400)
  const again = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 1, chosenText: t1.meaning, responseMs: 100 })
  check('4c 같은 order 재전송 → 첫 결과 그대로(WRONG 유지)', again.status === 200 && d(again).answer === 'WRONG' && d(again).answeredAt === d(a1).answeredAt)
  const rms = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 2, chosenText: (await correctOf(sid, 2)).meaning, responseMs: 60_001 })
  check('4d responseMs 60,001 → 400', rms.status === 400)
  const flag = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 5, flagged: true })
  const flagRow = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId: sid, order: 5 } } })
  check('4e 표시 전용 {order, flagged} → 응답 키 2개(정답 없음, F9), 답은 그대로 미답', flag.status === 200 && Object.keys(d(flag)).sort().join() === 'flagged,order' && flagRow.flagged && flagRow.answer === null)
  // 같은 order 동시 5회(보기 서로 다르게)
  const t3 = await correctOf(sid, 3)
  const race = await Promise.all(t3.choices.concat(t3.choices[0]).map((c) => api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 3, chosenText: c, responseMs: 2000 })))
  const answers3 = new Set(race.map((r) => `${d(r).answer}|${d(r).chosenText}|${d(r).answeredAt}`))
  const row3 = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId: sid, order: 3 } } })
  check('4g 같은 order 동시 5회 → 전부 200·같은 결과 1개, DB 는 그 결과', race.every((r) => r.status === 200) && answers3.size === 1 && [...answers3][0].startsWith(`${row3.answer}|${row3.chosenText}`), [...answers3].join(' / '))
  // 나머지 답(4~9 중 6장, 8·9 는 미답으로 남김) — 10장 3분 계측용
  for (const order of [2, 4, 5, 6, 7]) {
    const t = await correctOf(sid, order)
    const r = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order, chosenText: order % 2 ? t.choices.find((c) => c !== t.meaning) : t.meaning, responseMs: 3000 })
    attemptMs.push(r.ms)
  }
  const skipR = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 8, skipped: true })
  attemptMs.push(skipR.ms)
  check('4h 건너뛰기 → SKIPPED + 정답 공개', d(skipR).answer === 'SKIPPED' && typeof d(skipR).correctText === 'string')

  // ── 6. finish 단일 트랜잭션 ──────────────────────────────────────
  const today = (d(get49).session as Json).date as string
  const before = await prisma.wordEntry.findMany({ where: { id: { in: s10words.filter((x): x is string => !!x) } }, select: { id: true, correctCount: true, wrongCount: true } })
  const dailyBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: today } } })
  const wBefore = ((dailyBefore?.data as Json | undefined)?.words as Json | undefined) ?? { sessions: 0, correct: 0, wrong: 0 }
  const attemptsBefore = await prisma.vocabAttempt.findMany({ where: { sessionId: sid }, orderBy: { order: 'asc' } })
  const finMs0 = performance.now()
  const fins = await Promise.all([1, 2, 3].map(() => api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/finish`)))
  const finMs = performance.now() - finMs0
  const fin = d(fins[0])
  const fs = fin.session as Json
  const exp = { c: attemptsBefore.filter((a) => a.answer === 'CORRECT').length, w: attemptsBefore.filter((a) => a.answer === 'WRONG').length }
  const expSkipped = 10 - exp.c - exp.w
  check('6a finish: 미답 → SKIPPED, 세션 카운터·durationSec·DONE', fs.status === 'DONE' && fs.correctCount === exp.c && fs.wrongCount === exp.w && fs.skippedCount === expSkipped && typeof fs.durationSec === 'number' && (await prisma.vocabAttempt.count({ where: { sessionId: sid, answer: null } })) === 0, JSON.stringify(fs))
  check('6b 동시 finish 3회 → 전부 200·같은 응답', fins.every((f) => f.status === 200 && f.text === fins[0].text), fins.map((f) => f.status).join())
  const after = await prisma.wordEntry.findMany({ where: { id: { in: before.map((b) => b.id) } }, select: { id: true, correctCount: true, wrongCount: true, lastResult: true, lastSeenAt: true } })
  const counterOk = attemptsBefore.every((a) => {
    const b = before.find((x) => x.id === a.wordId)
    const n = after.find((x) => x.id === a.wordId)
    if (!b || !n) return true
    const ans = a.answer ?? 'SKIPPED'
    return n.correctCount === b.correctCount + (ans === 'CORRECT' ? 1 : 0) && n.wrongCount === b.wrongCount + (ans === 'WRONG' ? 1 : 0) && n.lastResult === ans && !!n.lastSeenAt
  })
  check('6c WordEntry 카운터 한 번만(E5: SKIPPED 는 lastSeenAt·lastResult 만)', counterOk)
  const logs = await prisma.studyLog.findMany({ where: { userId: u1, type: 'WORDS', refId: sid } })
  const snaps = await prisma.statsSnapshot.findMany({ where: { userId: u1, kind: 'VOCAB_SESSION', periodKey: sid } })
  check('6d StudyLog(WORDS, DIRECT, refId) 1행·studyLogId 일치, VOCAB_SESSION 스냅샷 1행', logs.length === 1 && logs[0].origin === 'DIRECT' && fin.studyLogId === logs[0].id && snaps.length === 1 && (snaps[0].data as Json).correct === exp.c, `logs=${logs.length} snaps=${snaps.length}`)
  const dailyAfter = await prisma.statsSnapshot.findUniqueOrThrow({ where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: today } } })
  const wAfter = (dailyAfter.data as Json).words as Json
  check('6e DAILY words 증가 1회분(sessions+1·correct·wrong)', Number(wAfter.sessions) === Number(wBefore.sessions) + 1 && Number(wAfter.correct) === Number(wBefore.correct) + exp.c && Number(wAfter.wrong) === Number(wBefore.wrong) + exp.w, `${JSON.stringify(wBefore)} → ${JSON.stringify(wAfter)}`)
  check('6f wrongWords·flaggedCount', (fin.wrongWords as Json[]).length === exp.w && fin.flaggedCount === 1)
  const late = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 9, skipped: true })
  const lateFlag = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: 9, flagged: true })
  check('4i DONE 세트에 답·표시 → 409', late.status === 409 && lateFlag.status === 409)
  const done49 = await api(COOKIE1, 'GET', `/api/v1/vocab/sessions/${sid}`)
  check('6g #49 DONE: 전 카드 정답 포함·세션 개수·durationSec(F4)', (d(done49).cards as Card[]).every((c) => typeof c.correctText === 'string' && c.answer) && (d(done49).session as Json).skippedCount === expSkipped)

  // F2: 답 0장 finish → ABANDONED
  const z = d(await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 5 })) as unknown as Created
  const logCount0 = await prisma.studyLog.count({ where: { userId: u1, type: 'WORDS' } })
  const zf = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${z.session?.id}/finish`)
  check('6h 답 0장 finish → ABANDONED, studyLogId null, 기록·스냅샷 0(F2)', (d(zf).session as Json).status === 'ABANDONED' && d(zf).studyLogId === null && (await prisma.studyLog.count({ where: { userId: u1, type: 'WORDS' } })) === logCount0 && (await prisma.statsSnapshot.count({ where: { userId: u1, periodKey: String(z.session?.id) } })) === 0)

  const z49 = await api(COOKIE1, 'GET', `/api/v1/vocab/sessions/${z.session?.id}`)
  const zCards = (d(z49).cards as Card[]) ?? []
  check('6h′ ABANDONED 세트 #49 재조회 → CHOICE 미답 카드 정답·예문 여전히 없음(REV-008 H1)', z49.status === 200 && (d(z49).session as Json).status === 'ABANDONED' && zCards.length === 5 && zCards.every(choiceCardHides), `mode=${(d(z49).session as Json)?.mode}`)
  const zKeep = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${z.session?.id}/keep`, { kept: true })
  check('6h″ ABANDONED 세트 keep → 409', zKeep.status === 409)

  // 답과 finish 겹침
  const ov = d(await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 5 })) as unknown as Created
  const ovId = String(ov.session?.id)
  const o0 = await correctOf(ovId, 0)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${ovId}/attempts`, { order: 0, chosenText: o0.meaning, responseMs: 1000 })
  const o1 = await correctOf(ovId, 1)
  const [ra, rf] = await Promise.all([
    api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${ovId}/attempts`, { order: 1, chosenText: o1.meaning, responseMs: 1000 }),
    api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${ovId}/finish`),
  ])
  const ovRow = await prisma.vocabSession.findUniqueOrThrow({ where: { id: ovId } })
  const ovSnap = await prisma.statsSnapshot.findUniqueOrThrow({ where: { userId_kind_periodKey: { userId: u1, kind: 'VOCAB_SESSION', periodKey: ovId } } })
  const consistent = (ra.status === 200 && ovRow.correctCount === 2) || (ra.status === 409 && ovRow.correctCount === 1)
  check('6i 답과 finish 동시 → (답 200 & 집계 포함) 또는 (답 409 & 미포함), 스냅샷=세션 카운터', rf.status === 200 && consistent && (ovSnap.data as Json).correct === ovRow.correctCount && (ovSnap.data as Json).skipped === ovRow.skippedCount, `attempt=${ra.status} correct=${ovRow.correctCount}`)

  // ── 7. 삭제 후 집계 불변 ───────────────────────────────────────
  const stats0 = await api(COOKIE1, 'GET', '/api/v1/vocab/stats?days=30')
  const snapsBefore = JSON.stringify(await prisma.statsSnapshot.findMany({ where: { userId: u1, kind: 'VOCAB_SESSION' }, orderBy: { periodKey: 'asc' }, select: { periodKey: true, data: true } }))
  const victim = attemptsBefore.find((a) => a.answer === 'WRONG' && a.wordId)!
  const del = await api(COOKIE1, 'DELETE', `/api/v1/words/${victim.wordId}`)
  const stats1 = await api(COOKIE1, 'GET', '/api/v1/vocab/stats?days=30')
  const snapsAfter = JSON.stringify(await prisma.statsSnapshot.findMany({ where: { userId: u1, kind: 'VOCAB_SESSION' }, orderBy: { periodKey: 'asc' }, select: { periodKey: true, data: true } }))
  const victimRow = await prisma.vocabAttempt.findUniqueOrThrow({ where: { id: victim.id } })
  const res49 = await api(COOKIE1, 'GET', `/api/v1/vocab/sessions/${sid}`)
  const victimCard = (d(res49).cards as Card[]).find((c) => c.order === victim.order)
  check('7a 삭제 {deleted, snapshotKept}, #54·VOCAB_SESSION 스냅샷 변화 0', del.status === 200 && d(del).deleted === true && d(del).snapshotKept === true && stats0.text === stats1.text && snapsBefore === snapsAfter, `stats=${stats0.text.slice(0, 160)}`)
  check('7b VocabAttempt wordId=null + Snap 유지, #49 결과 정상', victimRow.wordId === null && victimRow.surfaceSnap === victim.surfaceSnap && res49.status === 200 && victimCard?.wordId === null && victimCard?.surface === victim.surfaceSnap)
  const st = d(stats1)
  check('7c #54 형태: byCount·daily·streakDays', Array.isArray(st.byCount) && Array.isArray(st.daily) && st.streakDays === 1, JSON.stringify(st).slice(0, 200))

  // 삭제와 finish 겹침
  const dx = d(await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 5 })) as unknown as Created
  const dxId = String(dx.session?.id)
  for (const order of [0, 1, 2]) {
    const t = await correctOf(dxId, order)
    await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${dxId}/attempts`, { order, chosenText: t.meaning, responseMs: 1000 })
  }
  const dxVictim = (dx.cards ?? [])[0].wordId!
  const [rDel, rFin] = await Promise.all([api(COOKIE1, 'DELETE', `/api/v1/words/${dxVictim}`), api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${dxId}/finish`)])
  const dxRow = await prisma.vocabSession.findUniqueOrThrow({ where: { id: dxId } })
  const dxSnap = await prisma.statsSnapshot.findUniqueOrThrow({ where: { userId_kind_periodKey: { userId: u1, kind: 'VOCAB_SESSION', periodKey: dxId } } })
  check('7d 단어 삭제와 finish 동시 → 둘 다 200, 단어 없음, 스냅샷 = 세션 카운터(3/0/2)', rDel.status === 200 && rFin.status === 200 && (await prisma.wordEntry.count({ where: { id: dxVictim } })) === 0 && dxRow.correctCount === 3 && (dxSnap.data as Json).correct === 3 && (dxSnap.data as Json).skipped === 2, `${rDel.status}/${rFin.status}`)

  // ── 8. keep / replay ──────────────────────────────────────────
  const rp0 = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/replay`)
  check('8a 보관 안 한 세트 replay → 409(F7)', rp0.status === 409)
  const kp = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: true })
  const kp2 = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: true })
  check('8b keep DONE → keptAt, 다시 keep 해도 keptAt 유지', kp.status === 200 && typeof d(kp).keptAt === 'string' && d(kp2).keptAt === d(kp).keptAt)
  const kept = await api(COOKIE1, 'GET', '/api/v1/vocab/sessions?kept=1')
  check('8c #48 kept=1 목록 + answeredCount·startedAt', (d(kept).items as Json[]).length === 1 && (d(kept).items as Json[])[0].id === sid && (d(kept).items as Json[])[0].answeredCount === 9 && typeof (d(kept).items as Json[])[0].startedAt === 'string', JSON.stringify(d(kept).items).slice(0, 200))
  const rp = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/replay`)
  const rpS = d(rp) as unknown as Created
  const origNow = await prisma.vocabAttempt.findMany({ where: { sessionId: sid }, select: { wordId: true, surfaceSnap: true } })
  const origWords = origNow.map((a) => a.wordId ?? `snap:${a.surfaceSnap}`).sort()
  const rpWords = (rpS.cards ?? []).map((c) => c.wordId ?? `snap:${c.surface}`).sort()
  check('8d 삭제 단어 포함 세트 replay → 같은 단어 목록·replayOfId·전체 FLIP(downgraded, E4)', rp.status === 200 && rpS.session?.replayOfId === sid && rpS.session?.mode === 'FLIP' && rpS.session?.downgraded === true && JSON.stringify(origWords) === JSON.stringify(rpWords), `${rp.status} mode=${rpS.session?.mode}`)
  const rpBusy = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/replay`)
  const unkeepRace = await Promise.all([api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: false }), api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: true })])
  check('8e′ keep 해제·재보관 동시 → 둘 다 200(사용자 행 직렬), 최종 상태 = 나중에 처리된 쪽', unkeepRace.every((r) => r.status === 200), unkeepRace.map((r) => `${r.status}:${d(r).keptAt ? 'kept' : 'unkept'}`).join(','))
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: true })
  check('8e 진행 중 세트 있으면 replay 409', rpBusy.status === 409)
  const keepIP = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${rpS.session?.id}/keep`, { kept: true })
  check('8f 진행 중 세트 keep → 409', keepIP.status === 409)
  const inProgList = await api(COOKIE1, 'GET', '/api/v1/vocab/sessions?status=IN_PROGRESS')
  check('8g #48 status=IN_PROGRESS 필터', (d(inProgList).items as Json[]).length === 1 && (d(inProgList).items as Json[])[0].id === rpS.session?.id)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${rpS.session?.id}/finish`)

  // CHOICE 유지 replay(삭제 단어 없음): 소수 세트는 FLIP 이었으므로 새 CHOICE 세트를 끝내고 보관 → replay
  const cs = d(await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 5 })) as unknown as Created
  const csId = String(cs.session?.id)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${csId}/attempts`, { order: 0, skipped: true })
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${csId}/finish`)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${csId}/keep`, { kept: true })
  const rc = d(await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${csId}/replay`)) as unknown as Created
  check('8h CHOICE 세트 replay → CHOICE 유지·같은 단어 집합·정답 미노출', rc.session?.mode === 'CHOICE' && rc.session?.downgraded === false && JSON.stringify((rc.cards ?? []).map((c) => c.wordId).sort()) === JSON.stringify((cs.cards ?? []).map((c) => c.wordId).sort()) && (rc.cards ?? []).every(choiceCardHides))

  // ── 9. IDOR ───────────────────────────────────────────────────
  const someWord = String(((await prisma.wordEntry.findFirst({ where: { userId: u1 } })) ?? { id: 'none' }).id)
  const rcId = String(rc.session?.id)
  const idor = await Promise.all([
    api(COOKIE2, 'GET', `/api/v1/words/${someWord}`),
    api(COOKIE2, 'PATCH', `/api/v1/words/${someWord}`, { note: 'x' }),
    api(COOKIE2, 'DELETE', `/api/v1/words/${someWord}`),
    api(COOKIE2, 'POST', `/api/v1/words/${someWord}/archive`),
    api(COOKIE2, 'POST', `/api/v1/words/${someWord}/unarchive`),
    api(COOKIE2, 'GET', `/api/v1/vocab/sessions/${rcId}`),
    api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${rcId}/attempts`, { order: 0, skipped: true }),
    api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${rcId}/attempts`, { order: 0, flagged: true }),
    api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${rcId}/finish`),
    api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: false }),
    api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${sid}/replay`),
  ])
  const rcAfter = await prisma.vocabSession.findUniqueOrThrow({ where: { id: rcId } })
  check('9 IDOR: 두 번째 계정으로 단어·세트·답·표시·finish·keep·replay 전부 404, 원본 변화 0', idor.every((r) => r.status === 404) && rcAfter.status === 'IN_PROGRESS' && (await prisma.wordEntry.count({ where: { id: someWord } })) === 1, idor.map((r) => r.status).join(','))
  const unauth = await fetch(`${BASE}/api/v1/words`)
  check('9′ 세션 없음 401', unauth.status === 401)
  await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${rcId}/finish`)

  // ── 10. 10장 3분(서버 시간) ─────────────────────────────────────
  // 오늘 DONE 단어 제외로 풀이 줄었으므로 새 계정 풀을 쓴다: QA2 에 기본 팩을 넣고 10장.
  await api(COOKIE2, 'POST', '/api/v1/words/seed-pack', { pack: 'N5' })
  const tc0 = performance.now()
  const ts = await api(COOKIE2, 'POST', '/api/v1/vocab/sessions', { count: 10, mode: 'CHOICE' })
  const createMs = ts.ms
  const tsId = String((d(ts).session as Json).id)
  const perAttempt: number[] = []
  for (let order = 0; order < 10; order++) {
    const t = await correctOf(tsId, order)
    const r = await api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${tsId}/attempts`, { order, chosenText: t.meaning, responseMs: 3000 })
    perAttempt.push(r.ms)
  }
  const tf = await api(COOKIE2, 'POST', `/api/v1/vocab/sessions/${tsId}/finish`)
  const serverTotal = createMs + perAttempt.reduce((a, b) => a + b, 0) + tf.ms
  const userTotalSec = serverTotal / 1000 + 10 * 12
  check('10 세트 생성+답 10+finish 서버 합계, 12s/장 가정 총합 ≤180s', tf.status === 200 && userTotalSec <= 180, `create=${Math.round(createMs)}ms attempt p50=${p50(perAttempt)}ms max=${Math.round(Math.max(...perAttempt))}ms finish=${Math.round(tf.ms)}ms 합계=${Math.round(serverTotal)}ms → 사용자 총 ${userTotalSec.toFixed(1)}s (벽시계 ${Math.round(performance.now() - tc0)}ms)`)
  console.log(`  (계측) attempt p50 전체=${p50([...attemptMs, ...perAttempt])}ms · 동시 finish 3회 ${Math.round(finMs)}ms`)

  // ── 입력 검증 잔여 ───────────────────────────────────────────────
  const v = await Promise.all([
    api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 4 }),
    api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 31 }),
    api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { mode: 'QUIZ' }),
    api(COOKIE1, 'GET', '/api/v1/vocab/stats?days=0'),
    api(COOKIE1, 'GET', '/api/v1/vocab/sessions?status=OPEN'),
    api(COOKIE1, 'POST', '/api/v1/words', { surface: 'x'.repeat(81), meaning: 'm' }),
    api(COOKIE1, 'POST', '/api/v1/words', { surface: 'ok', meaning: 'm', enrich: 'yes' }),
    api(COOKIE1, 'GET', '/api/v1/words?cursor=garbage'),
  ])
  check('v 입력 검증 400(count 4·31·mode·days 0·status·surface 81·enrich 형식·커서)', v.every((r) => r.status === 400), v.map((r) => r.status).join(','))
  const nf = await api(COOKIE1, 'GET', '/api/v1/vocab/sessions/nonexistent_id_000')
  check('v′ 없는 세트 404', nf.status === 404)

  // ── 3′. 정답 위치 분산(이번 실행의 CHOICE 카드 전부) ─────────────────
  const choiceRows = await prisma.vocabAttempt.findMany({ where: { session: { userId: { in: [u1, u2] }, mode: 'CHOICE' } }, select: { meaningSnap: true, choices: true } })
  const pos = [0, 0, 0, 0]
  for (const r of choiceRows) {
    const i = ((r.choices as string[] | null) ?? []).indexOf(r.meaningSnap)
    if (i >= 0) pos[i]++
  }
  check('3b CHOICE 정답 위치가 한 자리에 고정되지 않음(표본 전부)', choiceRows.length >= 20 && pos.filter((n) => n > 0).length >= 3 && Math.max(...pos) <= choiceRows.length * 0.6, `n=${choiceRows.length} 위치별=${pos.join('/')}`)

  // ── 12. 엔진명 누출 ──────────────────────────────────────────────
  check('12 응답에 엔진·모델명 0건', leakHits === 0, `hits=${leakHits}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) {
    console.log(`실패: ${failed.map((f) => f.id).join(', ')}`)
    process.exitCode = 1
  }
}

async function cleanup() {
  for (const email of ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test']) {
    const u = await prisma.user.findUnique({ where: { email } })
    if (!u) continue
    await wipe(u.id)
    await prisma.statsSnapshot.deleteMany({ where: { userId: u.id, kind: 'DAILY', createdAt: { gte: startedAt } } })
  }
  console.log('(QA 데이터 정리 완료)')
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('정리 실패:', e))
    await prisma.$disconnect()
  })
