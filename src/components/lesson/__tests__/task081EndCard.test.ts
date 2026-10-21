/**
 * task-081 ④-B1 — 수업 화면 연결·종료 카드·오늘 카드·생성 대기 문구(screens §37-6·37-8·37-13 ⑥·37-18-1 ③).
 * 종료 카드 숫자 칸은 내용에서 센 오늘의 조각(옛 수업 2칸), 오늘 카드는 «조각 N개»·단계 이름 받침, «문제» 부속은 지웠다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { DialogueLine, LessonContent, LessonDto } from '@/types/lesson'
import { pieceCount } from '../chunkLogic'
import LessonEnd from '../LessonEnd'
import { END, GEN, HOME, LESSON, STAGE_COPULA, STAGE_NAMES, U2 } from '../lessonCopy'
import * as logic from '../logic'
import { endResultFrom, genPhase, type EndResult } from '../logic'

const SRC = join(process.cwd(), 'src', 'components', 'lesson')
const read = (f: string) => readFileSync(join(SRC, f), 'utf8')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const ENGINE_NAMES = /claude|anthropic|haiku|sonnet|opus|whisper|reazon|sherpa|zipformer|style[-_ ]?bert|sbv2|qwen|ollama|gateway|model_id|speaker_id/i
const COUNT_SEYO = /(만|을|를|로|으로|도|이렇게|합쳐서|함께) 세요/

const line = (ja: string, pieces?: DialogueLine['pieces']): DialogueLine => ({ speaker: 'A', ja, reading: '', ko: '', segment: 1, ...(pieces === undefined ? {} : { pieces }) })
const NEW_DIALOGUE: DialogueLine[] = [
  line('コーヒーをください。', [
    { ja: 'コーヒー', type: 'NAME', ko: '커피' },
    { ja: 'を', type: 'LINK', ko: '을' },
    { ja: 'ください', type: 'EXPRESSION', ko: '주세요', slash: true },
    { ja: '。', type: null, ko: null },
  ]),
  line('コーヒーですね。', [
    { ja: 'コーヒー', type: 'NAME', ko: '커피' },
    { ja: 'ですね', type: 'EXPRESSION', ko: '이군요' },
    { ja: '。', type: null, ko: null },
  ]),
  line('はい。', null),
]
const contentOf = (dialogue: DialogueLine[]): LessonContent =>
  ({
    v: 1,
    title: 'カフェで注文',
    titleKo: '카페에서 주문',
    rolesKo: { A: '손님', B: '점원' },
    dialogue,
    segmentCount: 1,
    chunks: [],
    grammar: [],
    application: [],
    speaking: [],
    nextPreview: { titleKo: '다음 수업', teaserKo: '이어서 해요' },
  }) as unknown as LessonContent

const lessonOf = (content: LessonContent): LessonDto & { content: LessonContent } =>
  ({
    id: 'L1',
    kind: 'NEW',
    date: '2026-10-21',
    title: 'カフェで注文',
    titleKo: '카페에서 주문',
    level: 'N4',
    status: 'DONE',
    stageDone: 5,
    progress: { application: { answers: ['紅茶', null, ''] } },
    score: null,
    source: 'TOPIC',
    topic: { id: 't1', title: '카페 주문' },
    content,
    jobId: null,
    error: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    completedAt: '2026-10-21T01:00:00.000Z',
  }) as LessonDto & { content: LessonContent }

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const withRouter = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))
const STAT_CELL = 'flex min-w-0 flex-col items-center rounded-xl border border-line bg-surface py-2.5'
const cells = (html: string) => html.split(STAT_CELL).length - 1

test('endResultFrom: pieces = 내용에서 센 오늘의 조각(종류+글자 한 번·문장부호 제외) · 옛 수업·모든 줄 실패는 null · 점수 칸 없음', () => {
  const r = endResultFrom(lessonOf(contentOf(NEW_DIALOGUE)))!
  assert.equal(r.pieces, 4, 'コーヒー(이름)·を·ください·ですね — 두 번 나온 コーヒー 는 한 번')
  assert.equal(r.pieces, pieceCount(contentOf(NEW_DIALOGUE)), '오늘 카드·서버 #58 과 같은 규칙')
  assert.equal(r.applicationDone, 1)
  assert.deepEqual(Object.keys(r).sort(), ['applicationDone', 'missedIds', 'nextPreview', 'pieces', 'usedIds'])
  assert.equal(endResultFrom(lessonOf(contentOf([line('はい。'), line('どうぞ。')])))!.pieces, null, '옛 수업 — pieces 키 없음')
  assert.equal(endResultFrom(lessonOf(contentOf([line('はい。', null), line('どうぞ。', null)])))!.pieces, null, '새 수업인데 모든 줄 분해 실패(§37-3-1)')
})

test('LessonEnd 서버 렌더: 조각 수가 있으면 [N 오늘의 조각][만든 문장][쓴 표현] 3칸, 옛 수업은 2칸 · 엔진명·«문제» 0', () => {
  const base: EndResult = { pieces: 4, applicationDone: 2, usedIds: [], missedIds: [], nextPreview: null }
  const three = withRouter(createElement(LessonEnd, { lesson: lessonOf(contentOf(NEW_DIALOGUE)), result: base, onToast: () => {} }))
  assert.equal(cells(three), 3)
  assert.ok(three.includes('grid grid-cols-3 gap-2') && !three.includes('grid grid-cols-2 gap-2'))
  assert.ok(three.includes(`>4</b><span class="text-[12px] text-ink2">${END.statPieces}</span>`), '첫 칸 = 조각 수')
  assert.ok(three.indexOf(END.statPieces) < three.indexOf(END.statApply) && three.indexOf(END.statApply) < three.indexOf(END.statExpr), '칸 순서')
  const two = withRouter(createElement(LessonEnd, { lesson: lessonOf(contentOf([line('はい。')])), result: { ...base, pieces: null }, onToast: () => {} }))
  assert.equal(cells(two), 2)
  assert.ok(two.includes('grid grid-cols-2 gap-2') && !two.includes('grid grid-cols-3 gap-2'))
  assert.ok(!two.includes(END.statPieces))
  for (const html of [three, two]) {
    assert.ok(!html.includes('문제'), '«문제» 낱말 0')
    assert.ok(!ENGINE_NAMES.test(html), '엔진명 0')
    assert.ok(html.includes(END.recorded), '«복습할 항목으로 기록» 은 그대로(§37-13 ④)')
  }
})

test('오늘 카드 문구: 시작 소개·끝냄 «조각 N개»(없으면 생략)·하던 수업 «다음은 …» 5단계 받침', () => {
  assert.equal(HOME.startIntro, '선생님과 5단계로 수업해요. 듣기 → 문법 → 조각 → 응용 → 말하기')
  assert.equal(HOME.doneBody('「카페 주문」', 6, { used: 2, total: 3 }), '「카페 주문」 · 조각 6개 · 말하기 표현 2/3')
  assert.equal(HOME.doneBody('「카페 주문」', null, null), '「카페 주문」')
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => HOME.nextStage(n)),
    [
      '다음은 ① 이해예요. 단계마다 저장돼요.',
      '다음은 ② 문법이에요. 단계마다 저장돼요.',
      '다음은 ③ 조각이에요. 단계마다 저장돼요.',
      '다음은 ④ 응용이에요. 단계마다 저장돼요.',
      '다음은 ⑤ 말하기예요. 단계마다 저장돼요.',
    ],
  )
  // 받침 표가 단계 이름과 어긋나지 않는다(이름이 바뀌면 표도 바꿔야 한다 — 마지막 글자 받침 = «이에요»).
  const hasBatchim = (s: string) => (s.charCodeAt(s.length - 1) - 0xac00) % 28 !== 0
  assert.deepEqual(STAGE_NAMES.map((name) => (hasBatchim(name) ? '이에요' : '예요')), [...STAGE_COPULA])
})

test('생성 대기·② 문구: «이런 순서로» ③ 조각·④ 말로 만들기, 45~75초 «문법과 조각을…», ② 설명에서 «표현 조각»·«문제» 뺌', () => {
  assert.deepEqual(
    GEN.order.map((r) => [...r]),
    [
      ['이해', '대화를 구간별로 듣고, 들린 단어를 메모해요'],
      ['문법', '대화에 나온 문형 1~3개'],
      ['조각', '대화 문장을 조각으로 나눠 끊어 봐요'],
      ['응용', '상황에 맞는 문장 3개 말로 만들기'],
      ['말하기', '목표 표현을 넣어 말하기 3개'],
    ],
  )
  assert.deepEqual(GEN.order.map((r) => r[0]), [...STAGE_NAMES], '대기 화면 순서 = 단계 이름')
  assert.equal(genPhase(45, null), '문법과 조각을 만들고 있어요')
  assert.equal(genPhase(74, 'LLM'), '문법과 조각을 만들고 있어요')
  assert.equal(GEN.elapsed('1:05'), '1:05 · 보통 1~2분 걸려요', 'PE 실측 뒤 다시 봄 — 지금 그대로')
  assert.equal(U2.desc(2), '오늘 대화의 표현과 문형 2개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요.')
  assert.equal(U2.exprDesc, '대화에 나온 표현이에요. 응용·말하기에서 다시 써요.')
  assert.equal(U2.exprDescPlay, '대화에 나온 표현이에요. 누르면 소리를 들을 수 있어요. 응용·말하기에서 다시 써요.')
  assert.equal(END.statPieces, '오늘의 조각')
  assert.ok(!('statQuiz' in END))
})

/** 문구 묶음의 모든 값(함수는 1 을 넣어 부른 결과) — «문제»·셈 «세요»·엔진명 검사용. */
function copyValues(o: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (typeof v === 'function') {
      try {
        out.push(String((v as (...a: unknown[]) => unknown)(1, 1, 1)))
      } catch {
        /* 인자 모양이 다른 함수는 소스 검사가 맡는다 */
      }
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(o)
  return out
}

test('문구 전수 — 오늘 카드·생성 대기·수업 공통·② 문법·종료 카드 문구에 «문제» 0 · 셈 뜻 «세요» 0 · 엔진명 0', () => {
  for (const [name, obj] of Object.entries({ HOME, GEN, LESSON, U2, END })) {
    for (const v of copyValues(obj)) {
      assert.ok(!v.includes('문제'), `${name}: «문제» — ${v}`)
      assert.ok(!COUNT_SEYO.test(v), `${name}: 셈 «세요» — ${v}`)
      assert.ok(!ENGINE_NAMES.test(v), `${name}: 엔진명 — ${v}`)
    }
  }
  for (const f of ['lessonCopy.ts', 'logic.ts', 'LessonEnd.tsx', 'TodayLessonCard.tsx', 'LessonScreen.tsx', 'LessonGenScreen.tsx', 'parts.tsx']) {
    const src = strip(read(f))
    const i = src.indexOf('문제')
    assert.equal(i, -1, `${f}: «문제» — ${src.slice(Math.max(0, i - 30), i + 30)}`)
    assert.ok(!ENGINE_NAMES.test(src), `${f}: 엔진명`)
    src.split('\n').forEach((l) => assert.ok(!COUNT_SEYO.test(l), `${f}: 셈 «세요» — ${l.trim().slice(0, 80)}`))
  }
})

test('문제 전용 부속 지움(§37-13 ⑥) — logic.ts 내보내기·types/lesson.ts 문항 타입·화면 호출부 0', () => {
  for (const fn of ['correctFromScore', 'quizPromptView', 'quizSummaryPrompt', 'quizReadingLeak', 'quizPromptLayerState']) {
    assert.ok(!(fn in logic), `logic.${fn} 남음`)
  }
  const types = readFileSync(join(process.cwd(), 'src', 'types', 'lesson.ts'), 'utf8')
  assert.ok(!/LessonQuiz/.test(types), 'LessonQuiz 남음')
  assert.ok(!/^\s+quiz\??: /m.test(strip(types).split('interface CompleteResult')[0]), 'LessonContent·LessonProgress·ProgressPatch 에 quiz 칸 남음')
  for (const f of ['TodayLessonCard.tsx', 'LessonScreen.tsx', 'LessonEnd.tsx']) {
    const src = read(f)
    assert.ok(!/correctFromScore|result\.quiz|result\.correct|result\.total|statQuiz/.test(src), `${f}: 문제 점수 참조`)
  }
})

test('배선: StageApply 에 ⑤ 와 같은 textFirst·trCache · 완료 결과 = 내용에서 센 조각 · 오늘 카드 호출부 새 형', () => {
  const screen = read('LessonScreen.tsx')
  const apply = /<StageApply [^>]*\/>/.exec(screen)?.[0] ?? ''
  assert.ok(apply.includes('textFirst={textFirst}') && apply.includes('trCache={trCache}'), apply)
  assert.equal((screen.match(/const \{ config, textFirst \} = useSpeechConfig\(\)/g) ?? []).length, 1, '설정 훅 한 번 — ④·⑤ 같은 값')
  assert.equal((screen.match(/useSpeakTrCache\(\)/g) ?? []).length, 1, '뜻 메모리 한 벌 — ④·⑤ 공유')
  assert.ok(/onEnded\(\s*\{ pieces: pieceCount\(lesson\.content\), applicationDone: r\.result\.applicationDone/.test(screen))
  const card = read('TodayLessonCard.tsx')
  assert.equal((card.match(/HOME\.nextStage\((card\.)?stageDone \+ 1\)/g) ?? []).length, 2)
  assert.ok(!/HOME\.nextStage\(stageLabel/.test(card))
  assert.ok(card.includes('LESSON_CH.auxDone(t)'))
  assert.ok(card.includes('HOME.doneBody(topicName(l.topic), l.pieces, ') && card.includes('HOME.doneBody(`「${ctx.title}」`, l?.pieces, '))
})
