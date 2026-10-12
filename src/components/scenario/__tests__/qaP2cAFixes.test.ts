/**
 * qa-p2c-A 결함 수정 시험(task-010d) — 정적 렌더(서버 렌더 — 효과는 돌지 않는다)와 순수 함수.
 *  - #2 딥링크 시트: 수화 전(서버·수화 첫 렌더)에는 시트를 그리지 않는다. 클라이언트 첫 렌더 조건(`document` 있음)을 흉내 내도 포털을 만들지 않아야
 *    서버 렌더와 어긋나지 않는다(React #418). 열림은 수화 뒤 `sheetIdAfterHydration`.
 *  - #3 결과 화면: 세로 flex 스크롤 칸에 바로 놓인 [다시 해 보기]·[다른 상황 고르기]가 줄어들지 않게 `shrink-0`(높이 h-12 유지).
 *  - qa-p2c-B #4·#8: 결과 안내 주 링크 `shrink-0` · 회화방 스크린리더 칸(`srMsg`)의 「일본어」 구간 `lang="ja"`.
 *  - #5 계열: 수업에서 이어진 역할극 안내 "오늘 수업 「…」에서 이어져요." 의 일본어 제목이 `lang="ja"` 안에 있다.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { JaQuoted } from '@/components/common/japanese/JaQuoted'
import type { RolePlayChatView, RolePlayResultView } from '@/types/chat'
import { sheetIdAfterHydration } from '../logic'
import { Missing, ResultBody } from '../RolePlayResultScreen'
import RolePlayIntro, { RolePlaySystemLine } from '../RolePlayIntro'
import { readCode } from '../../__tests__/sourceCode'
import ScenarioHome from '../ScenarioHome'
import type { EndedRolePlay } from '../resultLogic'
import { ROOM, SCENARIO_HOME_HREF, SHEET } from '../scenarioCopy'
import { RESULT } from '../scenarioCopyResult'
import type { RolePlay } from '../useRolePlay'

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))

/** 클라이언트 첫 렌더처럼 `document` 가 있는 상태로 그린다 — 공용 `Sheet` 의 서버 전용 null 분기를 건너뛰게 해 "첫 렌더부터 열림"을 드러낸다. */
function renderWithDocument(el: ReactElement): string {
  const g = globalThis as { document?: unknown }
  const had = Object.prototype.hasOwnProperty.call(g, 'document')
  const prev = g.document
  g.document = { body: {} }
  try {
    return render(el)
  } finally {
    if (had) g.document = prev
    else delete g.document
  }
}

/* ── #2 딥링크 시트 수화 ────────────────────────────────────────────── */

test('sheetIdAfterHydration: 수화 전에는 늘 닫힘(null), 수화 뒤에는 고른 id 그대로', () => {
  assert.equal(sheetIdAfterHydration('scn_a', false), null)
  assert.equal(sheetIdAfterHydration(null, false), null)
  assert.equal(sheetIdAfterHydration('scn_a', true), 'scn_a')
  assert.equal(sheetIdAfterHydration(null, true), null)
})

test('ScenarioHome ?sc=: 서버 렌더에 시트(dialog)가 없다', () => {
  const html = render(createElement(ScenarioHome, { initialSheetId: 'scn_self-intro-first-meeting', saved: true }))
  assert.ok(!html.includes('role="dialog"'))
  assert.ok(!html.includes(SHEET.title))
  assert.ok(!html.includes(SHEET.saved))
})

test('ScenarioHome ?sc=: 수화 첫 렌더(서버 스냅샷)에서는 document 가 있어도 시트 포털을 만들지 않는다 — 서버 렌더와 같은 마크업', () => {
  const props = { initialSheetId: 'scn_self-intro-first-meeting', saved: true }
  const server = render(createElement(ScenarioHome, props))
  let client = ''
  assert.doesNotThrow(() => {
    client = renderWithDocument(createElement(ScenarioHome, props))
  }, '첫 렌더에 시트를 열면 포털을 만들려다 서버 렌더러가 던진다')
  assert.equal(client, server)
  assert.ok(!client.includes('role="dialog"'))
})

/* ── #3 결과 화면 버튼 줄 ───────────────────────────────────────────── */

const SC: RolePlayChatView = {
  id: 'sc1',
  title: '카페에서 주문하기',
  titleJa: 'カフェで注文する',
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '커피를 주문한다',
  steps: [{ ko: '인사' }, { ko: '주문' }],
  keyExpressions: [
    { id: 'e1', ja: 'お願いします', ko: '부탁합니다' },
    { id: 'e2', ja: 'ください', ko: '주세요' },
  ],
  requiredExpressions: 1,
  progress: { usedIds: ['e1'], stepIndex: null },
  ended: null,
  lesson: null,
}
const ENDED: RolePlayResultView = {
  replayed: false,
  chatId: 'c1',
  scenarioId: 'sc1',
  studyLogId: 'l1',
  repetitionItemId: null,
  outcome: 'NOT_YET',
  goalAchieved: false,
  tutorGoalAchieved: false,
  codeRulePassed: false,
  communicationSuccess: false,
  judged: true,
  expressions: { usedIds: ['e1'], missedIds: ['e2'], verifiedIds: ['e1'], required: 1, total: 2 },
  turns: 3,
  hintsUsed: 0,
  selfCorrections: 0,
  pendingCorrections: 0,
  endedAt: '2026-10-07T01:00:00.000Z',
}
const NEXT = { id: 'sc2', title: '테이크아웃 주문하기', titleJa: 'テイクアウトで注文する', goalKo: '포장 주문을 한다' }
const view = (ended: Partial<RolePlayResultView>): EndedRolePlay => ({ ...SC, ended: { ...ENDED, ...ended } })
const result = (v: EndedRolePlay) => render(createElement(ResultBody, { chatId: 'c1', view: v }))

/** 글자 `label` 을 가진 첫 `<tag …>` 의 class. */
function classOf(html: string, tag: 'button' | 'a', label: string): string {
  const end = html.indexOf(`>${label}</${tag}>`)
  assert.ok(end >= 0, `${label} 이 없다`)
  const start = html.lastIndexOf(`<${tag} `, end)
  const m = /class="([^"]*)"/.exec(html.slice(start, end + 1))
  assert.ok(m, `${label} class 없음`)
  return m[1]
}

const hasClass = (cls: string, name: string) => cls.split(/\s+/).includes(name)

test('결과 화면 [다시 해 보기](주 버튼·보조 버튼 모두): h-12 + shrink-0 — 세로 flex 칸에서 글자 높이로 줄지 않는다', () => {
  for (const v of [view({ outcome: 'NOT_YET' }), view({ outcome: 'ALMOST', next: NEXT }), view({ outcome: 'ACHIEVED', goalAchieved: true, next: NEXT })]) {
    const html = result(v)
    const cls = classOf(html, 'button', RESULT.retry)
    assert.ok(hasClass(cls, 'h-12') && hasClass(cls, 'shrink-0'), `${v.ended.outcome}: ${cls}`)
  }
})

test('결과 화면 다음 상황 없음: [다른 상황 고르기] 링크도 h-12 + shrink-0, 다음 상황 카드의 버튼은 카드 안(h-12)', () => {
  const none = result(view({ outcome: 'NOT_YET' }))
  const link = classOf(none, 'a', RESULT.pickOther)
  assert.ok(hasClass(link, 'h-12') && hasClass(link, 'shrink-0'), link)
  const withNext = result(view({ outcome: 'ACHIEVED', goalAchieved: true, next: NEXT }))
  assert.ok(hasClass(classOf(withNext, 'button', RESULT.nextBtn), 'h-12'))
})

test('결과 화면 안내(없음·아직 안 끝남)의 주 링크(linkPrimary)도 h-12 + shrink-0 (qa-p2c-B #4 재확인)', () => {
  const html = render(createElement(Missing, { title: RESULT.goneTitle, href: SCENARIO_HOME_HREF, label: RESULT.goneBtn }))
  const cls = classOf(html, 'a', RESULT.goneBtn)
  assert.ok(hasClass(cls, 'h-12') && hasClass(cls, 'shrink-0') && hasClass(cls, 'w-full'), cls)
})

/* ── #5 계열 — 수업 제목 lang ───────────────────────────────────────── */

const KANA_HAN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
/** `lang="ja"` 로 감싼 잎 요소(span·p)를 지운 뒤에도 가나·한자가 남으면 lang 누락. */
const jaOutsideLang = (html: string) => html.replace(/<(span|p)\b[^>]*\blang="ja"[^>]*>[^<]*<\/\1>/g, '').replace(/<[^>]+>/g, '')

test('rp-fromlesson: "오늘 수업 「…」에서 이어져요." 의 일본어 제목이 lang="ja" 안(시스템 줄·첫 안내 모두)', () => {
  const title = 'カフェの表現'
  const rp = { view: { ...SC, titleJa: null, lesson: { id: 'L1', title } } } as unknown as RolePlay
  const line = render(createElement(RolePlaySystemLine, { rp }))
  const intro = render(createElement(RolePlayIntro, { rp, teacherName: '유우', voice: true }))
  for (const html of [line, intro]) {
    assert.ok(html.includes(`<span lang="ja">「${title}」</span>`), html)
    const left = jaOutsideLang(html)
    assert.ok(!KANA_HAN.test(left), `lang 밖 일본어: ${left}`)
  }
  assert.ok(line.replace(/<[^>]+>/g, '').includes(ROOM.fromLesson(title)), '문구는 그대로')
})

/* ── qa-p2c-B #8 — 회화방 스크린리더 칸(role=status)의 「일본어」 lang ─────────────── */

const srCell = (msg: string) => renderToStaticMarkup(createElement('p', { role: 'status', className: 'sr-only' }, createElement(JaQuoted, { text: msg })))
const textOf = (html: string) => html.replace(/<[^>]+>/g, '')

test('스크린리더 칸: 역할극 "「ja」 썼어요" 의 일본어 구간만 lang="ja", 낭독 글자는 그대로', () => {
  const msg = ROOM.usedAnnounce('お願いします')
  const html = srCell(msg)
  assert.ok(html.includes('<span lang="ja">「お願いします」</span>'), html)
  assert.equal(textOf(html), msg)
  const two = [ROOM.usedAnnounce('お願いします'), ROOM.usedAnnounce('ください')].join(' ')
  assert.equal(textOf(srCell(two)), two)
  assert.equal((srCell(two).match(/lang="ja"/g) ?? []).length, 2)
})

test('스크린리더 칸: 일반 회화·빈 문자열은 글자 그대로(「」 없으면 lang 없음)', () => {
  const plain = ROOM.stepAnnounce('주문하기')
  const html = srCell(plain)
  assert.ok(!html.includes('lang='), html)
  assert.equal(textOf(html), plain)
  assert.equal(textOf(srCell('')), '')
})

test('TalkRoom: role=status sr-only 칸이 srMsg 를 JaQuoted 로 그린다(srMsg 는 문자열 state)', () => {
  const src = readCode(join(process.cwd(), 'src/components/talk/TalkRoom.tsx'))
  assert.ok(src.includes("import { JaQuoted } from '@/components/common/japanese/JaQuoted'"))
  assert.ok(/<p role="status" className="sr-only">\s*<JaQuoted text=\{srMsg\} \/>\s*<\/p>/.test(src))
  assert.ok(src.includes("const [srMsg, setSrMsg] = useState('')"))
})
