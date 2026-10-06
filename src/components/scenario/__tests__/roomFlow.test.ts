/**
 * REV-141 L-6 보완 — 역할극 방 훅(`useRolePlay`·`usePractice`)이 넘기는 흐름 함수를 부수 효과 가짜로 직접 돌려 본다(jsdom 없이).
 * 훅이 이 함수들을 실제로 부르는지는 아래 소스 배선 시험이 고정한다(훅 안에서 판단을 다시 하지 않는다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/components/common/api'
import type { Err } from '@/components/common/errors'
import type { RolePlayChatView, RolePlayProgress } from '@/types/chat'
import {
  applyDone,
  closedEndSheet,
  createSingleFlight,
  endSheetFlags,
  endSheetPhaseFor,
  keyboardCollapse,
  quitNoticeOf,
  reloadRolePlay,
  runFinish,
  runQuit,
  withKeptLesson,
  type EndSheetState,
} from '../logic'
import { settlePractice, type PracticeSettle } from '../practiceLogic'
import { END, ROOM } from '../scenarioCopy'

const SC: RolePlayChatView = {
  id: 'sc1',
  title: '카페',
  titleJa: null,
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '주문',
  steps: [{ ko: '인사' }, { ko: '주문' }],
  keyExpressions: [
    { id: 'e1', ja: 'お願いします', ko: '부탁' },
    { id: 'e2', ja: 'ください', ko: '주세요' },
  ],
  requiredExpressions: 1,
  progress: { usedIds: [], stepIndex: null },
  ended: null,
  lesson: null,
}
const api = (status: number, reason?: string) => new ApiError('x', status, null, reason ? { reason } : null)
const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}

/* ── 마치기 시트 상태 ─────────────────────────────────────────────────── */

test('endSheetPhaseFor: 내 말 0 = 빈 대화 시트, 1 이상 = 확인 (N2)', () => {
  assert.equal(endSheetPhaseFor(0), 'empty')
  assert.equal(endSheetPhaseFor(1), 'confirm')
  assert.equal(endSheetPhaseFor(7), 'confirm')
})

test('closedEndSheet · endSheetFlags: 정리·삭제 중엔 닫지 않음(N3), 마친 역할극·역할극 아님이면 안 열림(N9)', () => {
  const open = (phase: EndSheetState['phase']): EndSheetState => ({ open: true, phase })
  assert.deepEqual(closedEndSheet(open('busy'), true), open('busy'))
  assert.deepEqual(closedEndSheet(open('confirm'), false), { open: false, phase: 'confirm' })
  const live = { active: true, ended: false }
  assert.deepEqual(endSheetFlags(open('confirm'), live), { open: true, dismissible: true, empty: false, working: false })
  assert.deepEqual(endSheetFlags(open('busy'), live), { open: true, dismissible: false, empty: false, working: true })
  assert.deepEqual(endSheetFlags(open('quitting'), live), { open: true, dismissible: false, empty: true, working: true })
  assert.equal(endSheetFlags(open('empty'), live).empty, true)
  assert.equal(endSheetFlags(open('fail'), live).dismissible, true)
  assert.equal(endSheetFlags(open('confirm'), { active: true, ended: true }).open, false, '마친 역할극')
  assert.equal(endSheetFlags(open('confirm'), { active: false, ended: false }).open, false, '역할극 아님')
  assert.equal(endSheetFlags({ open: false, phase: 'confirm' }, live).open, false)
})

/* ── 마치기(#167) ─────────────────────────────────────────────────────── */

function finishHarness(post: () => Promise<unknown>) {
  const log: string[] = []
  const flight = createSingleFlight()
  const fx = {
    flight,
    post: () => {
      log.push('post')
      return post()
    },
    setSheet: (s: EndSheetState) => log.push(`sheet:${s.open ? 'open' : 'closed'}:${s.phase}`),
    toResult: () => log.push('toResult'),
    notify: (m: string) => log.push(`toast:${m}`),
  }
  return { log, flight, run: () => runFinish(fx) }
}

test('runFinish: 성공 → 정리 중 → 결과 화면, 그 뒤 다시 눌러도 요청 없음(잠근 채 — N1)', async () => {
  const h = finishHarness(async () => ({}))
  await h.run()
  assert.deepEqual(h.log, ['sheet:open:busy', 'post', 'toResult'])
  assert.equal(h.flight.isBusy(), true)
  await h.run()
  assert.deepEqual(h.log, ['sheet:open:busy', 'post', 'toResult'], '두 번째 요청 없음')
})

test('runFinish: 도는 중 두 번째 호출은 무시', async () => {
  const d = deferred<unknown>()
  const h = finishHarness(() => d.promise)
  const first = h.run()
  await h.run()
  d.resolve({})
  await first
  assert.equal(h.log.filter((x) => x === 'post').length, 1)
})

test('runFinish: 409 NO_TURNS = 빈 시트 · 409 TURN_RUNNING = 닫고 토스트 · 그 밖 = 시트 안 다시 시도(풀려서 다시 부를 수 있음)', async () => {
  const noTurns = finishHarness(async () => {
    throw api(409, 'NO_TURNS')
  })
  await noTurns.run()
  assert.deepEqual(noTurns.log.slice(-1), ['sheet:open:empty'])
  const busy = finishHarness(async () => {
    throw api(409, 'TURN_RUNNING')
  })
  await busy.run()
  assert.deepEqual(busy.log.slice(-2), ['sheet:closed:confirm', `toast:${ROOM.endWhileTurn}`])
  for (const status of [0, 400, 404, 429, 500]) {
    const fail = finishHarness(async () => {
      throw api(status)
    })
    await fail.run()
    assert.deepEqual(fail.log.slice(-1), ['sheet:open:fail'], String(status))
    assert.equal(fail.flight.isBusy(), false, '실패면 풀림')
    await fail.run()
    assert.equal(fail.log.filter((x) => x === 'post').length, 2, '다시 시도 가능')
  }
})

/* ── 그만두기(#31) ────────────────────────────────────────────────────── */

function quitHarness(del: () => Promise<unknown>) {
  const log: string[] = []
  const fx = {
    flight: createSingleFlight(),
    del: () => {
      log.push('del')
      return del()
    },
    setSheet: (s: EndSheetState) => log.push(`sheet:${s.open ? 'open' : 'closed'}:${s.phase}`),
    leave: (notice: boolean) => log.push(`leave:${notice}`),
    notify: (m: string) => log.push(`toast:${m}`),
    connText: (e: Err) => `conn:${e.status}`,
  }
  return { log, run: () => runQuit(fx) }
}

test('runQuit: 지웠으면 안내와 함께 나감 · 이미 없음(404)은 안내 없이 나감(N6) · 그 밖 실패는 빈 시트+토스트', async () => {
  const ok = quitHarness(async () => ({}))
  await ok.run()
  assert.deepEqual(ok.log, ['sheet:open:quitting', 'del', 'leave:true'])
  const gone = quitHarness(async () => {
    throw api(404)
  })
  await gone.run()
  assert.deepEqual(gone.log, ['sheet:open:quitting', 'del', 'leave:false'])
  const fail = quitHarness(async () => {
    throw api(500)
  })
  await fail.run()
  assert.deepEqual(fail.log.slice(-2), ['sheet:open:empty', `toast:${END.quitFail}`])
  const offline = quitHarness(async () => {
    throw api(0)
  })
  await offline.run()
  assert.deepEqual(offline.log.slice(-1), ['toast:conn:0'])
})

test('quitNoticeOf: 방이 남긴 값이 1 일 때만 안내 문구', () => {
  assert.equal(quitNoticeOf('1'), END.quitDone)
  for (const v of [null, '', '0', 'true']) assert.equal(quitNoticeOf(v), null)
})

/* ── 다시 읽기·진행 소식·수업 연결·키보드 ─────────────────────────────── */

test('reloadRolePlay: #29 의 역할극 칸으로 방 값을 바꾼다(N5) · 칸이 없거나 실패면 그대로', async () => {
  const got: RolePlayChatView[] = []
  await reloadRolePlay(async () => ({ chat: { id: 'c1', kind: 'TALK', title: 't', running: false, reviewedAt: null, messageCount: 1, scenario: SC } }), (v) => got.push(v))
  assert.deepEqual(got, [SC])
  await reloadRolePlay(async () => ({ chat: { id: 'c1', kind: 'TALK', title: 't', running: false, reviewedAt: null, messageCount: 1 } }), (v) => got.push(v))
  await reloadRolePlay(async () => {
    throw api(500)
  }, (v) => got.push(v))
  assert.equal(got.length, 1)
})

test('applyDone: 진행을 합치고 새 소식을 한 줄로 알린다(N8) · 소식 없으면 알림 없음 · 역할극 아님/진행 없음이면 그대로', () => {
  const prev: RolePlayProgress = { usedIds: [], stepIndex: null }
  const sets: RolePlayProgress[] = []
  const said: string[] = []
  const fx = { set: (p: RolePlayProgress) => sets.push(p), announce: (m: string) => said.push(m) }
  const next = applyDone(SC, prev, { scenario: { usedIds: ['e2', 'e1'], stepIndex: 1 } }, fx)
  assert.deepEqual(next, { usedIds: ['e1', 'e2'], stepIndex: 1 })
  assert.deepEqual(sets, [next])
  assert.deepEqual(said, [[ROOM.usedAnnounce('お願いします'), ROOM.usedAnnounce('ください'), ROOM.stepAnnounce('주문')].join(' ')])
  applyDone(SC, next, { scenario: { usedIds: ['e1'], stepIndex: 0 } }, fx)
  assert.equal(said.length, 1, '뒤로 간 값은 소식 없음')
  assert.equal(applyDone(null, prev, { scenario: { usedIds: ['e1'], stepIndex: null } }, fx), prev)
  assert.equal(applyDone(SC, prev, { scenario: undefined }, fx), prev)
  assert.equal(sets.length, 2)
})

test('withKeptLesson: 같은 역할극이면 동기로 빠진 수업 연결을 유지(L-2), 다른 역할극·이미 있음·없음이면 받은 값 그대로', () => {
  const kept = { id: 'sc1', lesson: { id: 'L1', title: '카페 표현' } }
  assert.deepEqual(withKeptLesson(SC, kept)?.lesson, kept.lesson)
  assert.equal(withKeptLesson(SC, { ...kept, id: 'other' }), SC)
  assert.equal(withKeptLesson(SC, null), SC)
  const own = { ...SC, lesson: { id: 'L2', title: '새 수업' } }
  assert.equal(withKeptLesson(own, kept), own)
  assert.equal(withKeptLesson(null, kept), null)
})

test('keyboardCollapse: 키보드가 열리고 카드가 펼쳐졌으며 카드 안 초점이 아닐 때만 접는다(M-1)', () => {
  assert.equal(keyboardCollapse({ kbOpen: true, goalOpen: true, focusInside: false }), true)
  assert.equal(keyboardCollapse({ kbOpen: true, goalOpen: true, focusInside: true }), false)
  assert.equal(keyboardCollapse({ kbOpen: false, goalOpen: true, focusInside: false }), false)
  assert.equal(keyboardCollapse({ kbOpen: true, goalOpen: false, focusInside: false }), false)
})

/* ── 대답 연습 요청 결말(#169) ────────────────────────────────────────── */

const PRACTICE_RAW = { messageId: 'a0', ja: 'コーヒーをください', ko: '커피 주세요' }

test('settlePractice: 취소된 요청의 늦은 응답·오류는 버린다(닫힌 판이 되살아나지 않음 — N4)', async () => {
  for (const outcome of ['resolve', 'reject'] as const) {
    const d = deferred<unknown>()
    let live = true
    const out: PracticeSettle[] = []
    const p = settlePractice({ request: () => d.promise, messageId: 'a0', live: () => live, timedOut: () => false, settle: (r) => out.push(r) })
    live = false
    if (outcome === 'resolve') d.resolve(PRACTICE_RAW)
    else d.reject(api(500))
    await p
    assert.deepEqual(out, [], outcome)
  }
})

test('settlePractice: 받음 = 제안 · 모양 틀림 = 판 안 오류(방에 안 알림) · 서버 오류 = 알림 · 취소(Abort)는 무시 · 시간 초과는 오류', async () => {
  const run = async (request: () => Promise<unknown>, timedOut = false) => {
    const out: PracticeSettle[] = []
    await settlePractice({ request, messageId: 'a0', live: () => true, timedOut: () => timedOut, settle: (r) => out.push(r) })
    return out
  }
  const ready = await run(async () => PRACTICE_RAW)
  assert.equal(ready.length, 1)
  assert.equal(ready[0].kind, 'ready')
  assert.deepEqual(await run(async () => ({ messageId: 'zz', ja: 'x', ko: 'y' })), [{ kind: 'failed', failure: { kind: 'error' }, report: false }])
  assert.deepEqual(await run(async () => {
    throw api(409, 'NOT_LATEST')
  }), [{ kind: 'failed', failure: { kind: 'stale' }, report: true }])
  const abort = () => Promise.reject(new DOMException('aborted', 'AbortError'))
  assert.deepEqual(await run(abort), [])
  assert.deepEqual(await run(abort, true), [{ kind: 'failed', failure: { kind: 'error' }, report: true }])
})

/* ── 훅·화면 배선(소스) — 판단을 흐름 함수에 맡기는지 ─────────────────── */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

test('useRolePlay 배선: 흐름 함수를 부르고 판단을 다시 하지 않는다', () => {
  const src = read('src/components/scenario/useRolePlay.ts')
  for (const s of [
    'runFinish({',
    'runQuit({',
    'setSheet((s) => closedEndSheet(s, flight.isBusy()))',
    'setSheet({ open: true, phase: endSheetPhaseFor(turns) })',
    'progressRef.current = applyDone(viewRef.current, progressRef.current, dn, { set: setExtra, announce: srAnnounce })',
    'reloadRolePlay(() => apiGet<ChatDetail>(',
    ', setFresh)',
    "mo.observe(root, { attributes: true, attributeFilter: ['data-kb'] })",
    "if (keyboardCollapse({ kbOpen: root.dataset.kb === 'open', goalOpen: panelRef.current?.k === 'goal', focusInside })) setPanel(null)",
    "if (quitNotice) writeStore('session', ROOM_STORE.quitDone, '1')",
    'const view = useMemo(() => withKeptLesson(raw, keptLesson), [raw, keptLesson])',
  ])
    assert.ok(src.includes(s), s)
  assert.ok(!/kaiwa\.rp\.result|rolePlayResultStoreKey/.test(src), '결과 첫 그림 보관 없음(L-3)')
  assert.ok(!src.includes('END.quitDone'), '방 토스트로 그만두기 안내를 내지 않는다(방과 함께 사라짐 — L-4)')
})

test('RolePlayEndSheet·usePractice 배선', () => {
  const sheet = read('src/components/scenario/RolePlayEndSheet.tsx')
  assert.ok(sheet.includes('endSheetFlags(rp.sheet, { active: rp.active, ended: rp.ended })'))
  assert.match(sheet, /<Sheet open=\{open\} [^>]*dismissible=\{dismissible\}>/)
  const practice = read('src/components/scenario/usePractice.ts')
  assert.ok(practice.includes('await settlePractice({'))
  assert.ok(practice.includes('live: () => live.current === l,'))
  assert.ok(practice.includes('timedOut: () => l.timedOut,'))
  assert.ok(practice.includes('if (r.report) failRef.current(failure)'))
})

test('다시 하기는 lessonId 를 싣지 않는다 — 마친 바·결과 화면 같게(L-1·P6)', () => {
  for (const f of ['src/components/scenario/RolePlayBars.tsx', 'src/components/scenario/RolePlayResultScreen.tsx']) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!src.includes('lessonId'), f)
    const calls = [...src.matchAll(/start\.start\(([^)]*)\)/g)].map((m) => m[1])
    assert.ok(calls.length >= 1, f)
    for (const args of calls) assert.ok(!args.includes(','), `${f}: ${args}`)
  }
})

test('결과 페이지는 세션이 없으면 로그인으로 보낸다(N10)', () => {
  const src = read('src/app/(app)/study/ai/talk/[chatId]/result/page.tsx')
  assert.ok(src.includes('const session = await auth()'))
  assert.ok(src.includes('if (!session) redirect(`/login?callbackUrl='))
})

test('시나리오 홈: 그만두기 안내를 한 번 읽고 지운 뒤 토스트(L-4)', () => {
  const src = read('src/components/scenario/ScenarioHome.tsx')
  assert.ok(src.includes("const notice = quitNoticeOf(readStore('session', ROOM_STORE.quitDone))"))
  const del = src.indexOf("writeStore('session', ROOM_STORE.quitDone, null)")
  const show = src.indexOf('show(notice)')
  assert.ok(del > 0 && show > del, '지운 뒤 보인다')
})
