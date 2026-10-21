/**
 * task-081 화면 갈래 ④-A — ④ 응용 `StageApply` 마이크 기본 + 한국어 뜻 줄(screens §37-5·37-7·37-8·37-10·37-14).
 * 서버 렌더 DOM: 초기 입력 방법(`textFirst`) · 글자 우선 이유 `role="status"` · 알아들은 말 상자 `aria-live="polite"` · 비교 뒤 «내 문장» 뜻 줄(같음 = 모범 답안 뜻,
 * 다름 = 준비 줄, 메모리 = 뜻·힌트 없음) + 순수 함수(`applyTrTarget` 번역 대상·`applyAnswerPatch` 저장 모양) + 정적 경계(금지어·엔진명·훅 하나).
 * 서버 렌더라 누름·초점·스크롤·늦게 온 `textFirst` 는 보이지 않는다 — QA 몫(기록 참조).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DISPLAY_COPY } from '@/components/common/japanese/displayPrefs'
import type { LessonApplication, LessonContent, LessonDto, LessonProgress } from '@/types/lesson'
import { U4, U5 } from '../lessonCopy'
import StageApply, { applyAnswerPatch, applyTrTarget } from '../StageApply'
import { translationPlan } from '../speakTranslation'
import type { UseLesson } from '../useLesson'
import type { LessonPlayback } from '../useLessonPlayback'
import type { SpeakTrCache } from '../useSpeakTranslation'

const count = (html: string, needle: string) => html.split(needle).length - 1

const AP = (i: number, o: Partial<LessonApplication> = {}): LessonApplication => ({
  id: `ap${i}`,
  promptKo: `카페에서 주문해 보세요 ${i}`,
  hintJa: null,
  modelAnswerJa: '温かいお茶を二つください。',
  modelReading: '',
  modelKo: '따뜻한 차를 두 개 주세요.',
  targetIds: [],
  ...o,
})

const lessonOf = (progress: LessonProgress = {}): LessonDto & { content: LessonContent } =>
  ({
    id: 'L1',
    kind: 'NEW',
    date: '2026-10-21',
    title: 'カフェで注文',
    titleKo: '카페에서 주문',
    level: 'N4',
    status: 'IN_PROGRESS',
    stageDone: 3,
    progress,
    score: null,
    source: 'TOPIC',
    topic: { id: 't1', title: '카페 주문' },
    content: { v: 1, title: 'カフェで注文', titleKo: '카페에서 주문', rolesKo: {}, dialogue: [], segmentCount: 1, chunks: [], grammar: [], application: [AP(0), AP(1), AP(2)], speaking: [], nextPreview: null },
    jobId: null,
    error: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    completedAt: null,
  }) as unknown as LessonDto & { content: LessonContent }

const PB = {
  textOnly: false,
  active: () => false,
  loading: () => false,
  lineOf: () => null,
  blocked: false,
  snapshot: { phase: 'idle', messageId: null, chunkIndex: null },
  stop: () => {},
  playLines: () => {},
  playMine: () => {},
  resume: () => {},
} as unknown as LessonPlayback
const ST = { update: () => {} } as unknown as UseLesson
const cacheOf = (entries: [string, string][] = []): SpeakTrCache => ({ map: new Map(entries), add: () => {} })

const render = (o: { textFirst?: boolean; progress?: LessonProgress; cache?: SpeakTrCache } = {}) =>
  renderToStaticMarkup(
    createElement(StageApply, {
      lesson: lessonOf(o.progress),
      st: ST,
      pb: PB,
      reviewing: false,
      config: null,
      textFirst: o.textFirst ?? false,
      trCache: o.cache ?? cacheOf(),
      onToast: () => {},
      footer: null,
    }),
  )

/** 알아들은 말 상자 여는 태그 */
const heardBoxTag = (html: string) => html.match(/<div[^>]*data-apply-heard[^>]*>/)?.[0] ?? null
/** «내 문장» 칸(비교 뒤) — 첫 회색 상자 */
const mineBox = (html: string) => {
  const at = html.indexOf(`>${U4.mine}<`)
  const end = html.indexOf(`>${U4.model}<`)
  return at >= 0 && end > at ? html.slice(at, end) : ''
}

/* ── 초기 입력 방법(Q6 A · ④-1 · ④-10) ───────────────────────────────── */

test('④-1 마이크가 기본: textFirst=false 면 알아들은 말 상자·누르고 말하기·[⌨ 글자로 쓰기], 글자 입력·이유 줄 없음', () => {
  const html = render({ textFirst: false })
  assert.ok(heardBoxTag(html), '알아들은 말 상자')
  assert.match(html, new RegExp(U4.voiceBox))
  assert.match(html, /aria-describedby="apply-voice-status"/, '누르고 말하기 버튼')
  assert.match(html, new RegExp(`>${U4.byText}<`))
  assert.doesNotMatch(html, /<textarea/)
  assert.doesNotMatch(html, new RegExp(U4.textFirst))
  assert.equal(count(html, 'role="status"'), 0, '이유 줄 없음')
})

test('④-10 글자 우선: textFirst=true 면 글자 입력 + 이유 한 줄(role=status) + [🎤 말로 쓰기] 남김', () => {
  const html = render({ textFirst: true })
  assert.match(html, /<textarea[^>]*id="apply-input"/)
  assert.equal(heardBoxTag(html), null, '알아들은 말 상자 없음')
  assert.match(html, new RegExp(`<p role="status"[^>]*>${U4.textFirst}</p>`))
  assert.equal(count(html, 'role="status"'), 1)
  assert.match(html, new RegExp(`>${U4.byVoice}<`))
})

/* ── 접근성(37-10 ⑦ · 37-18-1 ⑧) ─────────────────────────────────────── */

test('알아들은 말 상자는 aria-hidden 이 아니고, aria-live="polite" 는 안쪽 알아들은 글 칸에만(뜻 줄 SpeakTranslation 의 자체 live 와 중첩 금지 — 감사 C F1)', () => {
  const html = render()
  const tag = heardBoxTag(html)
  assert.ok(tag)
  assert.doesNotMatch(tag, /aria-live/, '바깥 상자에는 live 없음')
  assert.doesNotMatch(tag, /aria-hidden/)
  const at = html.indexOf(tag) + tag.length
  assert.match(html.slice(at, at + 40), /^<div aria-live="polite">/, '첫 자식이 live 칸')
})

/* ── 비교 뒤 «내 문장» 뜻 줄(④-5·④-7·④-9) ─────────────────────────────── */

test('④-5 모범 답안과 같은 글: «내 문장» 칸 뜻 줄 = 모범 답안 뜻 즉시(준비 줄 없음, 힌트 없음)', () => {
  const html = render({ progress: { application: { answers: ['温かいお茶を二つください。', 'はい', 'はい'] } } })
  const mine = mineBox(html)
  assert.ok(mine, '«내 문장» 칸')
  assert.match(mine, new RegExp(`${U5.trSr}</span>따뜻한 차를 두 개 주세요\\.`))
  assert.doesNotMatch(mine, new RegExp(DISPLAY_COPY.userTr.pending))
  assert.doesNotMatch(mine, new RegExp(U5.trHeard))
})

test('④-9 다른 글(메모리 없음): «내 문장» 칸에 준비 줄(곧 묻는다) · 다시 열면 via 가 없어 힌트 없음', () => {
  const html = render({ progress: { application: { answers: ['温かいお茶をください', 'はい', 'はい'] } } })
  const mine = mineBox(html)
  assert.match(mine, new RegExp(DISPLAY_COPY.userTr.pending))
  assert.match(mine, /aria-live="polite" aria-atomic="true"/, '뜻 칸은 SpeakTranslation 상자')
})

test('④-9 메모리에 뜻이 있으면 그 뜻 — 다시 열기(via 없음 → text)라 «알아들은 말을 그대로 옮겼어요» 없음', () => {
  const html = render({ progress: { application: { answers: ['温かいお茶をください', 'はい', 'はい'] } }, cache: cacheOf([['温かいお茶をください', '따뜻한 차를 주세요.']]) })
  const mine = mineBox(html)
  assert.match(mine, new RegExp(`${U5.trSr}</span>따뜻한 차를 주세요\\.`))
  assert.doesNotMatch(mine, new RegExp(U5.trHeard))
  assert.doesNotMatch(mine, new RegExp(DISPLAY_COPY.userTr.pending))
})

test('건너뛴 상황(«모르겠어요» 는 저장 안 함 · 다시 보기의 빈 칸)에는 뜻 줄이 없다', () => {
  const html = renderToStaticMarkup(
    createElement(StageApply, { lesson: lessonOf({}), st: ST, pb: PB, reviewing: true, config: null, textFirst: false, trCache: cacheOf(), onToast: () => {}, footer: null }),
  )
  const mine = mineBox(html)
  assert.match(mine, new RegExp(U4.skipped.replace(/[()]/g, '\\$&')))
  assert.doesNotMatch(mine, /aria-atomic/)
})

/* ── 번역 대상(§37-5 ⓐⓑ) — 순수 함수 ──────────────────────────────────── */

const base = { idx: 0, shown: false, saved: null, heard: null, draft: '', voiceMode: true, modelAnswerJa: '温かいお茶を二つください。', modelKo: '따뜻한 차를 두 개 주세요.' }

test('ⓐ 말한 직후: 대상 키 ap:{idx}:{seq} · 다름 = fetch', () => {
  const t = applyTrTarget({ ...base, idx: 1, heard: { text: '温かいお茶をください', seq: 2 }, draft: '温かいお茶をください' })
  assert.deepEqual(t, { key: 'ap:1:2', text: '温かいお茶をください', plan: { kind: 'fetch' } })
})

test('ⓐ 모범 답안과 같게 말함 = free(모범 답안 뜻 · AI 호출 0)', () => {
  const t = applyTrTarget({ ...base, heard: { text: '温かいお茶を二つください', seq: 1 }, draft: '温かいお茶を二つください' })
  assert.deepEqual(t?.plan, { kind: 'free', ko: '따뜻한 차를 두 개 주세요.' })
  // translationPlan 단위 — 같은 글(문장부호 차이만)이면 fetch 가 아니다
  assert.equal(translationPlan({ text: '温かいお茶を二つください' }, base.modelAnswerJa, base.modelKo).kind, 'free')
})

test('글자로 쓰는 동안·알아들은 뒤 글자로 고친 초안·아직 말하지 않음 → 대상 없음(번역 안 함)', () => {
  const heard = { text: '温かいお茶をください', seq: 1 }
  assert.equal(applyTrTarget({ ...base, voiceMode: false, heard, draft: heard.text }), null)
  assert.equal(applyTrTarget({ ...base, heard, draft: '温かいお茶をくださいね' }), null)
  assert.equal(applyTrTarget({ ...base, draft: '温かいお茶' }), null)
})

test('ⓑ 비교 뒤: 저장한 글이 방금 알아들은 글이면 같은 키(다시 묻지 않음) · 글자로 쓴 답은 ap:{idx}:saved · 건너뜀은 없음', () => {
  const heard = { text: '温かいお茶をください', seq: 3 }
  assert.equal(applyTrTarget({ ...base, shown: true, saved: heard.text, heard, draft: heard.text })?.key, 'ap:0:3')
  assert.equal(applyTrTarget({ ...base, shown: true, saved: 'お茶をください', heard, draft: '' })?.key, 'ap:0:saved')
  assert.equal(applyTrTarget({ ...base, shown: true, saved: null, heard, draft: '' }), null)
  assert.deepEqual(applyTrTarget({ ...base, shown: true, saved: '温かいお茶を二つください。', voiceMode: false })?.plan, { kind: 'free', ko: '따뜻한 차를 두 개 주세요.' })
})

/* ── 저장 모양(via 미저장 ★) ─────────────────────────────────────────── */

test('[비교하기] 저장은 그 칸 글자만 — via 를 싣지 않는다', () => {
  const out = applyAnswerPatch({ listen: { segmentsDone: [1] } }, 1, '温かいお茶', 3)
  assert.deepEqual(out, { listen: { segmentsDone: [1] }, application: { answers: [null, '温かいお茶', null] } })
  assert.deepEqual(Object.keys(out.application ?? {}), ['answers'])
  assert.doesNotMatch(JSON.stringify(out), /via|voice/)
  const again = applyAnswerPatch(out, 2, 'はい', 3)
  assert.deepEqual(again.application?.answers, [null, '温かいお茶', 'はい'])
})

/* ── 정적 경계(37-14 · 37-17 ⑥⑦) ─────────────────────────────────────── */

const SRC = readFileSync(join(process.cwd(), 'src', 'components', 'lesson', 'StageApply.tsx'), 'utf8')

test('voiceSharedFrozen 금지어·엔진명·직접 호출이 StageApply 에 없다', () => {
  for (const bad of ['cancelOutside', 'safeBottom', 'keyboardLabel', 'textOf=', 'canResend', 'caption=']) assert.ok(!SRC.includes(bad), bad)
  assert.doesNotMatch(SRC, /reazon|whisper|style.?bert|sbv2|claude|sherpa|qwen/i)
  assert.doesNotMatch(SRC, /window\.Capacitor|\bfetch\(/)
  assert.doesNotMatch(SRC, /import (VoiceBar|Composer)\b/)
})

test('번역 훅은 하나(한 번에 지금 상황 하나) · 뜻 메모리는 props 의 trCache · 비교 버튼은 rAF 뒤 nearest', () => {
  assert.equal((SRC.match(/useSpeakTranslation\(/g) ?? []).length, 1)
  assert.match(SRC, /cache: trCache,/)
  assert.doesNotMatch(SRC, /useSpeakTrCache/)
  assert.match(SRC, /requestAnimationFrame\(\(\) => compareRef\.current\?\.scrollIntoView\(\{ block: 'nearest' \}\)\)/)
  assert.match(SRC, /useState\(!textFirst\)/)
  assert.equal((SRC.match(/application: \{/g) ?? []).length, 1, '저장 모양은 applyAnswerPatch 한 곳')
})

/* ── 문구(37-8 U4) ─────────────────────────────────────────────────── */

test('U4 문구 — 37-8 글자 그대로 · ⑤ 와 같은 상자 문구 · 엔진명·셈 뜻 «세요» 0', () => {
  assert.equal(U4.desc, '상황에 맞는 문장을 말로 만들어 봐요. 채점하지 않고, 모범 답안과 비교해 스스로 확인해요.')
  assert.equal(U4.voiceBox, '버튼을 누른 채로 말하면 여기에 알아들은 말이 나와요')
  assert.equal(U4.voiceBox, U5.voiceBox)
  assert.equal(U4.textFirst, '지금은 말로 답하기를 쓸 수 없어서 글자 입력으로 열었어요.')
  for (const k of ['mine', 'byText', 'byVoice', 'compare', 'dontKnow'] as const) assert.equal(typeof U4[k], 'string', k)
  assert.equal(U4.count(14), '14 / 200자')
  for (const v of [U4.desc, U4.voiceBox, U4.textFirst]) {
    assert.doesNotMatch(v, /세요/)
    assert.doesNotMatch(v, /reazon|whisper|style.?bert|claude/i)
  }
})
