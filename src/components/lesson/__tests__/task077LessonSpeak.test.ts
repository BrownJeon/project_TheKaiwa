/**
 * task-077 UI-2 — 오늘의 회화 ⑤ 말하기 배선(screens §34): 레슨용 말 바 view · 지금 레슨 말 바와의 마크업 대조 · 토스트 바닥(B8 A) ·
 * 판 열 때 카드 맞춤 · 답 확인 순서(도우미 접기·판 닫기·원문 되돌리기) · 배선 스캔(공용 부품·#184·초안 키·Enter·엔진명·직접 fetch).
 * 동작 규칙은 순수 함수 시험, 화면 배선은 소스 스캔(렌더러 없음 — 알려진 한계).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup as r } from 'react-dom/server'
import { ApiError } from '@/components/common/api'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import VoiceBar from '@/components/talk/VoiceBar'
import type { SpeakingResult } from '@/types/lesson'
import { U5 } from '../lessonCopy'
import { LESSON_TOAST_DEFAULT, lessonToastBottom, lessonVoiceView, taskSentenceHidden, type LessonVoiceViewInput } from '../lessonVoiceView'
import { StopIcon } from '../parts'
import { runSpeakCheck, type SpeakCheckDeps } from '../speakCheck'
import { LESSON_KEYS } from '../useLessonCreate'

const noop = () => undefined
const PHASES = ['idle', 'starting', 'recording', 'finishing', 'unavailable'] as const

/* ── 레슨용 말 바 view ──────────────────────────────────────────────── */

test('lessonVoiceView: 상태 표 — 대기·시작·녹음·인식·사용 불가 × 확인 중 × 재생 중', () => {
  const base = (o: Partial<LessonVoiceViewInput>): LessonVoiceViewInput => ({ phase: 'idle', statusText: '누르고 있는 동안 말해요', pttLabel: '누르고 있는 동안 말하기', checking: false, playing: false, ...o })
  // [입력, state, sub, ptt.disabled, statusText, showStop]
  const rows: [Partial<LessonVoiceViewInput>, string, string | null, boolean, string, boolean][] = [
    [{}, 'IDLE', null, false, '누르고 있는 동안 말해요', false],
    [{ statusText: U5.idleAfter }, 'IDLE', null, false, '다시 하려면 또 누르고 말해요', false],
    [{ phase: 'starting', statusText: '마이크를 켜는 중' }, 'IDLE', null, false, '마이크를 켜는 중', false],
    [{ phase: 'recording', statusText: '듣고 있어요 · 0:04' }, 'RECORDING', null, false, '듣고 있어요 · 0:04', false],
    [{ phase: 'finishing', statusText: '알아듣는 중…' }, 'RECOGNIZING', null, false, '알아듣는 중…', false],
    [{ phase: 'unavailable', statusText: '지금은 말로 답할 수 없어요' }, 'IDLE', 'unavailable', false, '지금은 말로 답할 수 없어요', false],
    [{ checking: true, statusText: U5.idleAfter }, 'IDLE', null, true, '확인하는 중…', false],
    [{ playing: true, statusText: U5.speaking, pttLabel: U5.pttBarge }, 'IDLE', null, false, '듣는 중 · 누르면 멈추고 말해요', true],
    [{ playing: true, checking: true }, 'IDLE', null, true, '확인하는 중…', true],
  ]
  for (const [inp, state, sub, disabled, statusText, showStop] of rows) {
    const i = base(inp)
    const v = lessonVoiceView(i)
    const name = JSON.stringify(inp)
    assert.equal(v.state, state, name)
    assert.equal(v.sub, sub, name)
    assert.deepEqual(v.ptt, { phase: i.phase, disabled, label: i.pttLabel }, name)
    assert.equal(v.statusText, statusText, name)
    assert.equal(v.showStop, showStop, name)
    assert.equal(v.keyboardDisabled, false, `${name}: ⌨ 는 지금 레슨처럼 늘 누를 수 있다`)
  }
})

/** 변경 전 레슨 말 바(HEAD `StageSpeak.tsx` 404~433)를 그대로 옮긴 것 — 공용 `VoiceBar` 로 바꾼 뒤와 대조한다. */
function oldLessonBar(i: LessonVoiceViewInput, db: number | null): string {
  const kb = h(
    'svg',
    { width: '22', height: '22', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('rect', { x: '2.5', y: '6', width: '19', height: '12', rx: '2' }),
    h('path', { d: 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10' }),
  )
  return r(
    h(
      'div',
      { className: 'flex-none border-t border-line bg-surface px-4 pt-2', style: { paddingBottom: 'max(8px, env(safe-area-inset-bottom))' } },
      h(
        'div',
        { id: 'lesson-voice-status', className: 'flex h-6 min-w-0 items-center justify-center gap-2 text-[13px] text-ink2' },
        h(MicLevelMeter, { db, active: i.phase === 'recording' }),
        h('span', { className: 'min-w-0 truncate break-keep' }, i.checking ? U5.checking : i.statusText),
      ),
      h(
        'div',
        { className: 'mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center' },
        h('button', { type: 'button', 'aria-label': U5.textMode, onClick: noop, className: 'grid h-11 w-11 place-items-center rounded-full text-ink2' }, kb),
        h('div', { className: 'flex justify-center' }, h(PushToTalkButton, { phase: i.phase, disabled: i.checking, label: i.pttLabel, describedBy: 'lesson-voice-status', onPress: noop, onRelease: noop, onAbort: noop })),
        i.playing
          ? h('button', { type: 'button', 'aria-label': U5.stopSound, onClick: noop, className: 'grid h-11 w-11 place-items-center rounded-full bg-surface2 text-ink' }, h(StopIcon, { size: 18 }))
          : h('span', { 'aria-hidden': 'true', className: 'h-11 w-11' }),
      ),
    ),
  )
}

const newLessonBar = (i: LessonVoiceViewInput, db: number | null, trailing?: unknown) =>
  r(
    h(VoiceBar, {
      view: lessonVoiceView(i),
      db,
      onPress: noop,
      onRelease: noop,
      onAbort: noop,
      onKeyboard: noop,
      onStop: noop,
      keyboardLabel: U5.textMode,
      stopLabel: U5.stopSound,
      statusId: 'lesson-voice-status',
      ...(trailing ? { trailing: trailing as never } : {}),
    }),
  )

test('공용 VoiceBar 로 바꾼 레슨 말 바 = 지금 레슨 말 바(도우미 칸 없을 때) — 알려진 차이 2개(⌨ 클래스 끝 공백 · ■ 아이콘 사각형 크기)만', () => {
  let n = 0
  for (const phase of PHASES)
    for (const checking of [false, true])
      for (const playing of [false, true]) {
        const i: LessonVoiceViewInput = { phase, statusText: `상태-${phase}`, pttLabel: playing ? U5.pttBarge : U5.pttNormal, checking, playing }
        const db = phase === 'recording' ? -30 : null
        const now = newLessonBar(i, db)
          .replace('rounded-full text-ink2 "', 'rounded-full text-ink2"')
          .replace('<rect x="6" y="6" width="12" height="12" rx="2"></rect>', '<rect x="5" y="5" width="14" height="14" rx="2"></rect>')
        assert.equal(now, oldLessonBar(i, db), `${phase} checking=${checking} playing=${playing}`)
        n++
      }
  assert.equal(n, 20)
})

test('레슨 말 바 + 도우미: 도우미가 우측 끝 44 칸, ■ 는 마이크 오른쪽 · 상태 줄 id·⌨·■ 이름은 레슨 값', () => {
  const i: LessonVoiceViewInput = { phase: 'idle', statusText: U5.idleAfter, pttLabel: U5.pttBarge, checking: false, playing: true }
  const html = newLessonBar(i, null, h('button', { type: 'button', 'aria-label': '일본어 도우미' }, 'H'))
  assert.match(html, /<div id="lesson-voice-status" /)
  assert.match(html, /aria-describedby="lesson-voice-status"/)
  assert.match(html, /aria-label="글자로 답하기"/)
  assert.match(html, /<div class="ml-3 justify-self-start"><button type="button" aria-label="소리 멈추기"/)
  assert.match(html, /<div class="justify-self-end"><button type="button" aria-label="일본어 도우미">H<\/button><\/div><\/div><\/div>$/)
  assert.doesNotMatch(html, /선생님 말 멈추기|글자로 입력하기|talk-status/)
  assert.match(html, />다시 하려면 또 누르고 말해요</)
})

/* ── 토스트 바닥(B8 A) · 카드 맞춤 ─────────────────────────────────────── */

test('lessonToastBottom: ⑤ = 하단 묶음 높이 + 12 · 재기 전·다시 보기 = 136 · 그 밖 단계 = 24', () => {
  const rows: [number, number | null, number][] = [
    [1, null, 24],
    [2, 300, 24],
    [4, 120, 24],
    [5, null, 136],
    [5, 0, 136],
    [5, Number.NaN, 136],
    [5, 124, 136],
    [5, 124.4, 136],
    [5, 124.6, 137],
    [5, 444, 456],
  ]
  for (const [stage, hgt, want] of rows) assert.equal(lessonToastBottom(stage, hgt), want, `${stage} ${hgt}`)
  assert.equal(LESSON_TOAST_DEFAULT, 136)
})

test('taskSentenceHidden: 과제 문장(카드 머리 ~ 「목표 표현」)이 위로 넘어갔거나 아래로 잘렸으면 가려짐 — 1px 오차는 보임', () => {
  const v = { viewTop: 100, viewBottom: 326 }
  const rows: [number, number, boolean][] = [
    [112, 213, false],
    [100, 326, false],
    [99.5, 326.5, false],
    [98, 200, true],
    [-300, -199, true],
    [200, 328, true],
    [400, 501, true],
  ]
  for (const [top, bottom, want] of rows) assert.equal(taskSentenceHidden({ ...v, top, bottom }), want, `${top}~${bottom}`)
})

/* ── 답 확인 순서(§34-5) ─────────────────────────────────────────────── */

const RESULT: SpeakingResult = { used: true, matchedIds: ['e1'], missedIds: [], unknownIds: [], utteranceId: 'u1', hasAudio: true } as unknown as SpeakingResult

function deps(posts: ((body: unknown) => Promise<SpeakingResult>)[]) {
  const log: string[] = []
  const bodies: unknown[] = []
  const d: SpeakCheckDeps = {
    post: (body) => {
      bodies.push(body)
      log.push('post')
      const f = posts.shift()
      if (!f) throw new Error('unexpected post')
      return f(body)
    },
    cancelHelper: () => log.push('cancelHelper'),
    closeHelper: () => log.push('closeHelper'),
    restore: (raw) => log.push(`restore:${raw}`),
  }
  return { d, log, bodies }
}

test('runSpeakCheck: 성공 — 도우미 접기 → #62b → 판 닫기(결과 뒤 판이 남지 않음), 되돌리기 없음', async () => {
  const { d, log, bodies } = deps([async () => RESULT])
  const out = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: 'u1' }, d)
  assert.deepEqual(out, { ok: true, result: RESULT })
  assert.deepEqual(log, ['cancelHelper', 'post', 'closeHelper'])
  assert.deepEqual(bodies, [{ itemId: 'i1', text: 'あい', utteranceId: 'u1' }])
})

test('runSpeakCheck: 글자 답 실패 — 원문(trim 전)을 입력창에 되돌리고 판은 닫지 않는다', async () => {
  const { d, log } = deps([async () => Promise.reject(new ApiError('x', 500))])
  const out = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: null, raw: ' あい\n' }, d)
  assert.equal(out.ok, false)
  if (!out.ok) assert.equal(out.err.status, 500)
  assert.deepEqual(log, ['cancelHelper', 'post', 'restore: あい\n'])
})

test('runSpeakCheck: 말로 한 답 실패 — 되돌릴 원문 없음 · 409(발화 아님)는 다시 보내지 않음', async () => {
  const { d, log } = deps([async () => Promise.reject(new ApiError('x', 409, 'CONFLICT', { reason: 'STAGE_LOCKED' }))])
  const out = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: 'u1' }, d)
  assert.equal(out.ok, false)
  if (!out.ok) assert.equal(out.err.status, 409)
  assert.deepEqual(log, ['cancelHelper', 'post'])
})

test('runSpeakCheck: 발화 id 409 UTTERANCE_* — 글만 다시 보내고(지금 동작) 성공하면 판 닫기, 다시 실패하면 실패', async () => {
  const a = deps([async () => Promise.reject(new ApiError('x', 409, 'CONFLICT', { reason: 'UTTERANCE_USED' })), async () => RESULT])
  const ok = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: 'u1' }, a.d)
  assert.equal(ok.ok, true)
  assert.deepEqual(a.bodies, [{ itemId: 'i1', text: 'あい', utteranceId: 'u1' }, { itemId: 'i1', text: 'あい' }])
  assert.deepEqual(a.log, ['cancelHelper', 'post', 'post', 'closeHelper'])
  const b = deps([async () => Promise.reject(new ApiError('x', 409, 'CONFLICT', { reason: 'UTTERANCE_MISMATCH' })), async () => Promise.reject(new ApiError('y', 0))])
  const bad = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: 'u1' }, b.d)
  assert.equal(bad.ok, false)
  assert.deepEqual(b.log, ['cancelHelper', 'post', 'post'])
  const c = deps([async () => Promise.reject(new ApiError('x', 409, 'CONFLICT', { reason: 'UTTERANCE_USED' }))])
  const noUtt = await runSpeakCheck({ itemId: 'i1', text: 'あい', utteranceId: null, raw: 'あい' }, c.d)
  assert.equal(noUtt.ok, false, '발화 id 가 없으면 다시 보내지 않음')
  assert.deepEqual(c.log, ['cancelHelper', 'post', 'restore:あい'])
})

/* ── 배선 스캔 ──────────────────────────────────────────────────────── */

const ROOT = join(process.cwd(), 'src', 'components')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const SPEAK = read('lesson/StageSpeak.tsx')
const SCREEN = read('lesson/LessonScreen.tsx')
const NEW_FILES = ['lesson/lessonVoiceView.ts', 'lesson/speakTranslation.ts', 'lesson/useSpeakTranslation.ts', 'lesson/SpeakTranslation.tsx', 'lesson/speakCheck.ts']

test('배선: 하단 = 공용 VoiceBar(레슨 view·⌨/■ 이름·상태 줄 id) + 공용 Composer, 레슨 복제 입력창·누르고 말하기 직접 사용 없음', () => {
  assert.match(SPEAK, /import VoiceBar from '@\/components\/talk\/VoiceBar'/)
  assert.match(SPEAK, /import Composer, \{ type ComposerHandle \} from '@\/components\/chat\/Composer'/)
  assert.doesNotMatch(SPEAK, /<textarea|PushToTalkButton|MicLevelMeter/)
  assert.match(SPEAK, /const view = lessonVoiceView\(\{ phase: voice\.phase, statusText: voice\.statusText, pttLabel: voice\.pttLabel, checking, playing: pb\.snapshot\.phase === 'playing' \}\)/)
  assert.match(SPEAK, /keyboardLabel=\{U5\.textMode\}\s+stopLabel=\{U5\.stopSound\}\s+statusId=\{LESSON_VOICE_STATUS_ID\}/)
  assert.match(SPEAK, /export const LESSON_VOICE_STATUS_ID = 'lesson-voice-status'/)
  assert.match(SPEAK, /trailing=\{helperButton\}/)
})

test('배선: 글자 입력 — 초안 키(수업·과제별) 그대로 · 과제마다 새로 그림 · Enter 확인(B6-Q A) · 「확인하기」 · placeholder 지금 문구 · 확인 중 막힘', () => {
  assert.match(SPEAK, /const draftKey = LESSON_KEYS\.speakDraft\(lesson\.id, item\.id\)/)
  assert.equal(LESSON_KEYS.speakDraft('L', 'I'), 'kaiwa.lesson.speakDraft.L.I')
  const composer = SPEAK.slice(SPEAK.indexOf('<Composer'), SPEAK.indexOf('/>', SPEAK.indexOf('leading={', SPEAK.indexOf('<Composer'))))
  for (const prop of ['key={item.id}', 'draftKey={draftKey}', 'enterSends="always"', 'sendLabel={U5.send}', 'placeholder={U5.inputPlaceholder}', 'inputLabel={U5.textMode}', 'busy={checking}', 'busyReason={U5.checking}', 'onSend={sendText}', 'handleRef={composerRef}'])
    assert.ok(composer.includes(prop), prop)
  assert.equal(U5.inputPlaceholder, '일본어로 답해 보세요')
  assert.equal(U5.send, '확인하기')
  assert.doesNotMatch(SPEAK, /readStore|writeStore/, '초안은 Composer 가 맡는다')
})

test('배선: 확인 — 원문 되돌리기(막혔을 때·실패) · 도우미 접기/닫기 연결 · 마이크 누름에 도우미 취소', () => {
  assert.match(SPEAK, /if \(checking \|\| reviewing\) \{\s+if \(raw !== undefined\) composerRef\.current\?\.restore\(raw\)\s+return/)
  assert.match(SPEAK, /restore: \(t\) => composerRef\.current\?\.restore\(t\)/)
  assert.match(SPEAK, /cancelHelper: \(\) => void helperOpsRef\.current\.cancelPending\(\)/)
  assert.match(SPEAK, /closeHelper: \(\) => helperOpsRef\.current\.close\(\)/)
  assert.match(SPEAK, /void check\(t, 'text', null, raw\)/)
  assert.match(SPEAK, /const onPress = \(\) => \{\s+helper\.stopSound\(\)[\s\S]{0,120}helper\.cancelPending\(\)\s+voice\.press\(\)/)
  assert.match(SPEAK, /onPress=\{onPress\}/)
})

test('배선: 도우미 — #184 주소 · 잠금 = lessonHelperLockReason(phase, checking) · kind lesson · 넣기는 채우기만 · 다음 과제에 닫기', () => {
  assert.match(SPEAK, /phraseHelpRequest\(`\/api\/v1\/lessons\/\$\{encodeURIComponent\(lesson\.id\)\}\/phrase-help`\)/)
  assert.match(SPEAK, /usePhraseHelper\(\{\s+request: helperRequest,\s+recording: helperLock,/)
  assert.doesNotMatch(SPEAK, /usePhraseHelper\(\{[^}]*\b(chatId|ended|onEnded)\b/)
  assert.match(SPEAK, /const lockWhy = lessonHelperLockReason\(voice\.phase, checking\)/)
  assert.match(SPEAK, /onLocked=\{\(\) => \{\s+const m = helperLockToast\(lockWhy\)/)
  assert.match(SPEAK, /kind="lesson"/)
  assert.match(SPEAK, /locked=\{helperLock\}/)
  assert.match(SPEAK, /onFill=\{\(ja\) => \{\s+composerRef\.current\?\.fill\(ja\)\s+focusComposerRef\.current = true\s+helper\.close\(\)\s+\}\}/)
  assert.match(SPEAK, /const goNext = \(\) => \{\s+helper\.close\(\)\s+setIdx\(idx \+ 1\)/)
  assert.doesNotMatch(SPEAK, /setIdx\(idx \+ 1\)\}|onClick=\{\(\) => setIdx\(idx \+ 1\)\}/, '다음 과제는 goNext 로만')
  assert.match(SPEAK, /<div hidden=\{helper\.typing\} className="contents">/)
  assert.match(SPEAK, /\) : helper\.typing \? null : \(/)
})

/** 소스에서 `from` 이 시작하는 곳부터 `to` 직전까지. 둘 중 하나라도 없으면 시험을 실패시킨다(빈 조각으로 통과하지 않게). */
function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from)
  const b = src.indexOf(to, a + 1)
  assert.ok(a >= 0 && b > a, `${from} … ${to}`)
  return src.slice(a, b)
}

test('배선: 도우미 안내 말풍선 — 버튼 aria-describedby 는 말풍선이 보일 때만, 글자 모드에서는 안내·가리킴 모두 없음(REV-077U Low-1 M11)', () => {
  // 안내(말풍선)는 마이크 모드 전용이라 글자 모드에서 id 를 가리키면 DOM 에 없는 id 를 가리킨다 → 가드 마지막 항이 !textMode.
  assert.match(SPEAK, /const tipShown = tipOpen && [^\n]*&& !textMode\n/)
  assert.match(SPEAK, /describedBy=\{tipShown \? HELPER_TIP_ID : undefined\}/)
  assert.match(SPEAK, /\{tipShown \? <PhraseHelperTip onClose=\{\(\) => setTipOpen\(false\)\} \/> : null\}/)
  assert.equal((SPEAK.match(/HELPER_TIP_ID/g) ?? []).length, 2, 'HELPER_TIP_ID 는 import 와 가드 걸린 describedBy 두 곳뿐')
})

test('배선: 도우미 판 열기 — 열기 클릭에서만 맞춤 표시를 켜고, 판이 보일 때 한 번 소비해 가려진 과제 카드 머리로 맞춘다(REV-077U Low-1 M13, B8 A)', () => {
  const toggle = between(SPEAK, 'const toggleHelper = ', 'const closeHelperToButton')
  assert.match(toggle, /alignOnOpenRef\.current = true\s+helper\.setOpen\(true\)/)
  assert.equal((SPEAK.match(/alignOnOpenRef\.current = true/g) ?? []).length, 1, '켜는 곳은 열기 클릭 한 곳')
  assert.match(SPEAK, /onToggle=\{toggleHelper\}/)
  const effect = between(SPEAK, 'const alignOnOpenRef = useRef(false)', 'const tipShown')
  assert.match(effect, /useLayoutEffect\(\(\) => \{\s+if \(!helper\.shown \|\| !alignOnOpenRef\.current\) return\s+alignOnOpenRef\.current = false/)
  assert.match(effect, /taskSentenceHidden\(\{ viewTop: view\.top, viewBottom: view\.bottom, top: card\.top, bottom: label\.bottom \}\)\) cardRef\.current\?\.scrollIntoView\(\{ block: 'start' \}\)/)
  assert.match(effect, /\}, \[helper\.shown\]\)/)
  // 효과가 읽는 세 곳이 실제 DOM 에 붙어 있어야 맞춤이 조용히 건너뛰지 않는다.
  assert.match(SPEAK, /<div ref=\{scrollRef\} /)
  assert.match(SPEAK, /<div ref=\{cardRef\} className="scroll-mt-3">/)
  assert.match(SPEAK, /<p ref=\{targetsLabelRef\} /)
})

test('배선: 번역 칸 — 말풍선 안 · 잠금(말하는 중·확인 중)에 멈춤 · 표시 설정과 무관 · 수업 화면 메모리', () => {
  assert.match(SPEAK, /<HangulLine state=\{annOf\(res\.text\)\} size=\{13\} onTint className="!mt-0" \/>\s+<SpeakTranslation state=\{tr\.state\} via=\{res\.via\} onRetry=\{tr\.retry\} \/>\s+<\/div>/)
  assert.match(SPEAK, /const trPlan = translationPlan\(res, item\.modelAnswerJa, item\.modelKo\)/)
  assert.match(SPEAK, /paused: helperLock,\s+cache: trCache,/)
  assert.doesNotMatch(SPEAK, /showTranslation|useDisplayPrefs/)
  assert.doesNotMatch(read('lesson/SpeakTranslation.tsx'), /showTranslation|useDisplayPrefs/)
  assert.match(SCREEN, /const trCache = useSpeakTrCache\(\)/)
})

test('배선: 토스트 바닥 = 하단 묶음 실제 높이(ResizeObserver) — 136 고정 없음', () => {
  assert.match(SCREEN, /<Toast message=\{toast\.message\} bottomPx=\{lessonToastBottom\(stage, speakBottom\)\} \/>/)
  assert.doesNotMatch(SCREEN, /stage === 5 \? 136/)
  assert.match(SCREEN, /onBottomHeight=\{setSpeakBottom\}/)
  assert.match(SPEAK, /<div ref=\{stackRef\} className="flex-none">/)
  assert.match(SPEAK, /new ResizeObserver\(report\)/)
})

test('새 파일·수업 ⑤: 직접 fetch·window.Capacitor·엔진/모델 이름 없음, 화면 B 규칙(옛 읽기 줄·화면 변환 함수) 지킴', () => {
  for (const f of [...NEW_FILES, 'lesson/StageSpeak.tsx', 'lesson/LessonScreen.tsx']) {
    const src = read(f)
    assert.doesNotMatch(src, /\bfetch\(/, `${f}: fetch`)
    assert.doesNotMatch(src, /window\.Capacitor/, `${f}: Capacitor`)
    assert.doesNotMatch(src, /reazon|whisper|style-?bert|sbv2|claude|qwen|ollama|haiku|sonnet|opus/i, `${f}: 엔진명`)
    assert.ok(!/readingDefault|CHAT_KEYS/.test(src), `${f}: 옛 키`)
    assert.ok(!/\b(kanaToHangul|pronLine)\s*\(/.test(src), `${f}: 화면 변환 함수`)
    assert.ok(!/(modelReading|exampleReading|\bd\.reading)\b/.test(src), `${f}: 옛 히라가나 줄`)
    assert.ok(!/후리가나/.test(src), `${f}: 화면 글자`)
  }
})

test('voiceSharedFrozen 좁은 예외: 수업 ⑤ 두 파일의 keyboardLabel 하나만 — 다른 금지어·다른 파일은 그대로', () => {
  const frozen = readFileSync(join(ROOT, 'talk', '__tests__', 'voiceSharedFrozen.test.ts'), 'utf8')
  assert.match(frozen, /const keyboardLabelOk = new Set\(\['src\/components\/lesson\/StageSpeak\.tsx', 'src\/components\/lesson\/useLessonVoice\.ts'\]\)/)
  assert.match(frozen, /if \(bad === 'keyboardLabel' && keyboardLabelOk\.has\(f\)\) continue/)
  for (const bad of ['cancelOutside', 'safeBottom', 'textOf=', 'canResend', 'caption=']) assert.ok(!SPEAK.includes(bad), bad)
})
