import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { dialogAria } from '@/components/common/Sheet'
import type { TopicRemovalPreview } from '@/types/topic'
import { removalView } from '../logic'
import { REMOVAL_IDLE, type RemovalState } from '../useTopicRemoval'
import { removalDescribeTarget, removalFocusTarget } from '../TopicRemovalSheet'
import type { RemovalMode } from '../topicCopy'

// task-045 T5-2-fix(REV-161): 확인 시트 대화상자 설명(M-1)·[다시 보기] 44px(M-2)·409 뒤 일반 실패의 초점(L-5)·S6 #161 다시 시도 표시(L-7).
// 시트 컴포넌트는 DOM 없이 그릴 수 없어(포털) 순수 결정 함수는 값으로, 연결은 소스 줄로 고정한다. 실제 스크린리더·초점·터치는 QA.

const TOPIC_DIR = join(__dirname, '..')
const COMPONENTS = join(__dirname, '..', '..')
const SRC = join(__dirname, '..', '..', '..')
const read = (...p: string[]) => readFileSync(join(...p), 'utf8')
/** 주석을 지운 소스 — 주석 속 글자가 연결로 읽히지 않게. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full))
    else if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

// ── M-1 ───────────────────────────────────────────────────────────────

test('M-1 공용 Sheet: describedBy 가 없으면 aria-describedby 를 내지 않고, 있으면 그 id 로 묶는다', () => {
  assert.deepEqual(dialogAria('t1'), { 'aria-labelledby': 't1' })
  assert.ok(!('aria-describedby' in dialogAria('t1')), '미지정이면 키 자체가 없다(기존 시트 그대로)')
  assert.ok(!('aria-describedby' in dialogAria('t1', '')), '빈 id 도 내지 않는다')
  assert.deepEqual(dialogAria('t1', 'd1'), { 'aria-labelledby': 't1', 'aria-describedby': 'd1' })

  const sheet = strip(read(COMPONENTS, 'common', 'Sheet.tsx'))
  assert.match(sheet, /describedBy\?: string/, '선택 prop')
  assert.match(sheet, /role="dialog"[\s\S]{0,120}\{\.\.\.dialogAria\(titleId, describedBy\)\}/, '대화상자 요소에 펼친다')
  assert.ok(!/aria-labelledby=\{titleId\}/.test(sheet), '이름 연결은 dialogAria 한 곳')
})

test('M-1 기존 Sheet 호출처는 describedBy 를 넘기지 않는다 — 확인 시트 한 곳만(미지정 시 동작 그대로)', () => {
  const users = tsxFiles(SRC).filter((f) => /<Sheet\b/.test(strip(readFileSync(f, 'utf8'))) && !f.endsWith(join('common', 'Sheet.tsx')))
  assert.ok(users.length >= 30, `호출처 파일이 줄었다: ${users.length}`)
  const withDesc = users.filter((f) => /\bdescribedBy=/.test(strip(readFileSync(f, 'utf8'))))
  assert.deepEqual(
    withDesc.map((f) => f.slice(SRC.length + 1)),
    [join('components', 'topic', 'TopicRemovalSheet.tsx')],
  )
})

test('M-1 확인 시트: 대화상자 설명은 경고·안내 상자가 있으면 그것, 없으면 첫머리 안내 문단 — 어느 mode 에도 끊어진 id 가 없다', () => {
  const p = (over: Partial<TopicRemovalPreview> = {}): TopicRemovalPreview =>
    ({
      topicId: 't1',
      title: '병원 진료',
      isSeed: false,
      isSeedCopy: false,
      ack: 'none',
      activeChallenge: null,
      finishedChallenges: 0,
      scenariosArchived: [],
      scenariosUnlinked: [],
      scenariosRelinked: [],
      delete: { scenariosArchived: [], scenariosUnlinked: [], scenariosRelinked: [] },
      restore: { scenariosArchived: [], scenariosUnlinked: [], scenariosRelinked: [] },
      doneLessons: 0,
      chunks: 0,
      ...over,
    }) as unknown as TopicRemovalPreview
  const active = { id: 'c1', title: '병원 진료 14일', day: 4, lengthDays: 14 }
  const modes: RemovalMode[] = ['delete', 'copyDelete', 'restore', 'hide']
  for (const mode of modes) {
    const quiet = removalView(mode, p())
    assert.equal(removalDescribeTarget(quiet), 'lead', `${mode}: 챌린지가 없으면 첫머리 안내 문단`)
    assert.ok(quiet.leads.length > 0 && !quiet.warn)
    const busy = removalView(mode, p({ activeChallenge: active }))
    assert.equal(removalDescribeTarget(busy), 'warn', `${mode}: 진행 중 챌린지가 있으면 그 경고·안내 상자`)
    assert.ok(busy.warn)
  }
  assert.equal(removalDescribeTarget({ warn: null, leads: [] }), null, '묶을 문단이 없으면 묶지 않는다(끊어진 id 방지)')
})

test('M-1 확인 시트 소스: Sheet 에 describedBy 를 넘기고, 같은 id 를 경고 상자·안내 문단 하나에만 단다', () => {
  const src = strip(read(TOPIC_DIR, 'TopicRemovalSheet.tsx'))
  assert.match(src, /<Sheet [^>]*describedBy=\{describe \? descId : undefined\}/, '시트에 설명 id 연결')
  assert.match(src, /<div id=\{idOf\('warn'\)\} className="rounded-xl border-\[1\.5px\] border-bad/, '진행 중 챌린지 경고 상자(데모 S9 dw)')
  assert.match(src, /<p id=\{idOf\('warn'\)\} className="\[overflow-wrap:anywhere\]">\{view\.warn\.text\}<\/p>/, '숨기기의 안내 문단(챌린지 제목이 들어가 긴 글 안전장치 포함)')
  assert.equal([...src.matchAll(/id=\{i === 0 \? idOf\('lead'\) : undefined\}/g)].length, 2, '첫머리 안내(상자 안 문단·일반 문단) 첫 줄에만')
  assert.equal([...src.matchAll(/\bid=\{/g)].length, 4, '이 파일의 id 는 설명 id 네 곳뿐')
  assert.match(src, /const descId = useId\(\)/, '인스턴스마다 고유한 id')
})

// ── L-5 ───────────────────────────────────────────────────────────────

const st = (over: Partial<RemovalState>): RemovalState => ({ ...REMOVAL_IDLE, ...over })

test('L-5 초점: 실행 실패 문구가 있으면 그 줄로, 없고 409 로 다시 그렸으면 알림 줄로 — 409 뒤 일반 실패가 옛 알림 줄로 가지 않는다', () => {
  assert.equal(removalFocusTarget(st({ phase: 'ready', changed: true, error: null })), 'changed', '409 로 다시 그린 직후')
  assert.equal(removalFocusTarget(st({ phase: 'ready', changed: true, error: '지우지 못했어요' })), 'error', '409 뒤 다시 눌렀더니 일반 실패 — 새 실패 문구')
  assert.equal(removalFocusTarget(st({ phase: 'ready', changed: false, error: '지우지 못했어요' })), 'error')
  assert.equal(removalFocusTarget(st({ phase: 'ready' })), null, '처음 열렸을 때는 초점을 옮기지 않는다')
  for (const phase of ['idle', 'loading', 'loadFail', 'busy', 'done', 'gone'] as const) {
    assert.equal(removalFocusTarget(st({ phase, changed: true, error: 'x' })), null, `${phase} 에서는 옮기지 않는다`)
  }
})

test('L-5 시트 소스: 실패 문구 줄은 프로그램 초점을 받을 수 있고, 효과는 초점 대상 값이 바뀔 때만 켠다', () => {
  const src = strip(read(TOPIC_DIR, 'TopicRemovalSheet.tsx'))
  assert.match(src, /<p ref=\{errorRef\} tabIndex=\{-1\} role="alert"/, '실행 실패 줄')
  assert.match(src, /<p ref=\{changedRef\} tabIndex=\{-1\} role="alert"/, '409 알림 줄')
  assert.match(src, /if \(focusTarget === 'error'\) errorRef\.current\?\.focus\(\)/)
  assert.match(src, /else if \(focusTarget === 'changed'\) changedRef\.current\?\.focus\(\)/)
  assert.match(src, /\}, \[focusTarget\]\)/, '`changed` 가 켜져 있다는 이유만으로 다시 켜지 않는다')
})

// ── M-2 ───────────────────────────────────────────────────────────────

test('M-2 숨긴 기본 항목: [다시 보기] 버튼은 44px 이상(sm 은 38px 라 min-h-11)이고 다른 누르는 대상은 공용 시트의 ✕(44)뿐', () => {
  const src = strip(read(TOPIC_DIR, 'HiddenSeedSheet.tsx'))
  const btns = [...src.matchAll(/<Btn\b[\s\S]*?<\/Btn>/g)].map((m) => m[0])
  assert.equal(btns.length, 1, '이 시트의 누르는 대상은 [다시 보기] 버튼 하나')
  assert.ok(/size="sm"/.test(btns[0]) && /min-h-11/.test(btns[0]), 'sm 버튼에 min-h-11')
  assert.ok(!/<button\b/.test(src), '다른 직접 버튼 없음')
  const ui = read(COMPONENTS, 'common', 'ui.tsx')
  assert.match(ui, /size === 'sm' \? 'h-\[38px\]/, 'Btn sm 은 38px — 이 시험은 그 부족분을 min-h-11 이 메우는지 본다')
  const sheet = read(COMPONENTS, 'common', 'Sheet.tsx')
  assert.match(sheet, /aria-label="닫기"[\s\S]*?h-11 w-11/, '시트 ✕ 는 44px')
  // 44px 버튼이 줄(min-h-14 = 56px)에 들어가도록 위아래 패딩은 py-1.5(6+6) — 44+12+border 1 = 57px.
  assert.match(src, /<li key=\{k\} className="flex min-h-14 [^"]*border-b border-line py-1\.5">/)
})

// ── L-7 ───────────────────────────────────────────────────────────────

test('L-7 S6: #161 만 실패했을 때 [다시 시도] 는 최소 0.5초 자리표시로 눌렀음을 보인다(관리 화면과 같은 방식)', () => {
  const hook = strip(read(TOPIC_DIR, 'useTopicDetail.ts'))
  assert.match(hook, /retryBusyRemainingMs\(startedAt, Date\.now\(\)\)/, '최소 표시 시간 계산')
  assert.match(hook, /return \{ status, view, reload, refresh, retryScenarios, scenariosRetrying \}/)
  // 순번 확인은 값을 반영하는 `apply` 안에만 있고(재시도 최소 표시 대기 때문에 반영만 미룬다), `.then` 본문은 중간에 돌아가지 않는다.
  assert.ok(!/if \(my !== seq\.current\) return/.test(hook.replace(/const apply = \(\) => \{\s*if \(my !== seq\.current\) return/, '')), '늦은 응답을 버리더라도 중간에 돌아가지 않는다')
  assert.ok(hook.indexOf('onSettled?.()') > hook.indexOf('else apply()'), '늦은 응답이어도 표시는 끝낸다(반영·대기 뒤, 값을 버렸든 아니든)')
  assert.match(hook, /clearTimeout\(busyTimer\.current\)/, '타이머 정리')
  const screen = strip(read(TOPIC_DIR, 'TopicDetail.tsx'))
  assert.match(screen, /onRetryScenarios=\{d\.retryScenarios\}/, '조용히 다시 읽는 refresh 가 아니라 표시가 있는 다시 시도')
  assert.match(screen, /scenariosRetrying=\{d\.scenariosRetrying\}/)
  assert.match(screen, /scenariosRetrying \? \(\s*<div aria-busy="true">\s*<Skeleton heights=\{\[SCENARIO_CARD_HEIGHT, SCENARIO_CARD_HEIGHT\]\} label=\{MANAGE\.loading\} \/>/)
})
