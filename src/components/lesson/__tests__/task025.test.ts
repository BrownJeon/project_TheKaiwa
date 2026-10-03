import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DiffSeg } from '@/components/chat/diff'
import type { AudioKind, AudioPace } from '@/types/lesson'
import { compareAnswer } from '../compare'
import { U1, U3 } from '../lessonCopy'
import { activeLineReplay, exprKey, isLoadingSnapshot, lineReplayKey, lineReplayPace, playExpr, playLineReplay, quizPromptView, quizSummaryPrompt } from '../logic'

const join = (s: DiffSeg[]) => s.map((x) => x.text).join('')
const marks = (s: DiffSeg[]) => s.filter((x) => x.changed).map((x) => x.text)

/** playLines 호출을 그대로 받아 적는 가짜 재생기. */
function recorder() {
  const calls: { key: string; lines: { kind: AudioKind; idx: number; pace: AudioPace }[]; onComplete: (() => void) | undefined; argc: number }[] = []
  return {
    calls,
    pb: {
      playLines: (...args: [string, { kind: AudioKind; idx: number; pace: AudioPace }[], (() => void)?]) => {
        calls.push({ key: args[0], lines: args[1], onComplete: args[2], argc: args.length })
      },
    },
  }
}

// ── ① 줄 다시 듣기 ──────────────────────────────────────────────────────

test('줄 다시 듣기: 키 line:{idx}, dialogue 한 줄, onComplete 없음(진행·StudyLog 쓰기 0)', () => {
  const r = recorder()
  playLineReplay(r.pb, 4, 'slow')
  assert.deepEqual(r.calls, [{ key: 'line:4', lines: [{ kind: 'dialogue', idx: 4, pace: 'slow' }], onComplete: undefined, argc: 2 }])
  assert.equal(lineReplayKey(0), 'line:0')
  assert.ok(!lineReplayKey(3).startsWith('seg:'), '구간 키(seg:{k}:{pace})와 겹치지 않는다')
})

test('표현 소리: 키 expr:{idx}, chunk 보통 속도 한 번, onComplete 없음', () => {
  const r = recorder()
  playExpr(r.pb, 2)
  assert.deepEqual(r.calls, [{ key: 'expr:2', lines: [{ kind: 'chunk', idx: 2, pace: 'normal' }], onComplete: undefined, argc: 2 }])
  assert.equal(exprKey(7), 'expr:7')
})

test('줄 다시 듣기 속도(결정 a=A): 보통 속도로 듣기 전 느리게, 뒤엔 보통, 다시 보기는 늘 보통', () => {
  assert.equal(lineReplayPace(false, false), 'slow')
  assert.equal(lineReplayPace(true, false), 'normal')
  assert.equal(lineReplayPace(false, true), 'normal')
  assert.equal(lineReplayPace(true, true), 'normal')
})

test('지금 재생 중인 줄: line:{idx} 만 잡고(구간·예문·표현은 null), 받는 중·막힘을 구분한다', () => {
  assert.equal(activeLineReplay({ phase: 'idle', messageId: null, chunkIndex: null }), null)
  assert.equal(activeLineReplay({ phase: 'playing', messageId: 'seg:1:slow', chunkIndex: 0 }), null)
  assert.equal(activeLineReplay({ phase: 'playing', messageId: 'expr:3', chunkIndex: 0 }), null)
  assert.equal(activeLineReplay({ phase: 'playing', messageId: 'g:0', chunkIndex: 0 }), null)
  assert.equal(activeLineReplay({ phase: 'playing', messageId: 'line:x', chunkIndex: 0 }), null)
  assert.deepEqual(activeLineReplay({ phase: 'waiting', messageId: 'line:5', chunkIndex: null }), { idx: 5, loading: true, blocked: false })
  assert.deepEqual(activeLineReplay({ phase: 'playing', messageId: 'line:5', chunkIndex: null }), { idx: 5, loading: true, blocked: false }, '받았지만 재생 손잡이 전')
  assert.deepEqual(activeLineReplay({ phase: 'playing', messageId: 'line:5', chunkIndex: 0 }), { idx: 5, loading: false, blocked: false })
  assert.deepEqual(activeLineReplay({ phase: 'blocked', messageId: 'line:12', chunkIndex: 0 }), { idx: 12, loading: false, blocked: true })
  assert.equal(isLoadingSnapshot({ phase: 'waiting', messageId: 'expr:1', chunkIndex: null }, 'expr:1'), true)
  assert.equal(isLoadingSnapshot({ phase: 'waiting', messageId: 'expr:1', chunkIndex: null }, 'expr:2'), false)
  assert.equal(isLoadingSnapshot({ phase: 'playing', messageId: 'expr:1', chunkIndex: 0 }, 'expr:1'), false)
})

test('줄 다시 듣기 문구: 상태 줄·버튼 이름(1부터 센다)', () => {
  assert.equal(U1.linePlaying(2, true), '2번째 줄 · 느리게 다시 듣는 중')
  assert.equal(U1.linePlaying(2, false), '2번째 줄 · 보통 속도로 다시 듣는 중')
  assert.equal(U1.lineLoading(3), '3번째 줄을 불러오는 중…')
  assert.equal(U1.lineAria(1, true), '1번째 줄 느리게 다시 듣기')
  assert.equal(U1.lineAria(1, false), '1번째 줄 다시 듣기')
  assert.equal(U1.lineStopAria(4), '4번째 줄 멈추기')
})

// ── ③ 문제 한국어 표기 ──────────────────────────────────────────────────

test('문제 머리: 새 레슨은 한국어 질문 → 일본어 문장, 옛 레슨 promptKo null·빈 값은 공통 안내 줄(서버 요청 없음)', () => {
  assert.deepEqual(quizPromptView({ promptKo: '“커피 하나 주세요”를 일본어로 하면?', promptJa: null }), { ko: '“커피 하나 주세요”를 일본어로 하면?', ja: null, legacy: false })
  assert.deepEqual(quizPromptView({ promptKo: '빈칸에 들어갈 알맞은 말을 고르세요.', promptJa: '冷たい＿をお願いします。' }), {
    ko: '빈칸에 들어갈 알맞은 말을 고르세요.',
    ja: '冷たい＿をお願いします。',
    legacy: false,
  })
  assert.deepEqual(quizPromptView({ promptKo: null, promptJa: '「持ち帰り」の意味はどれですか。' }), { ko: U3.legacyPrompt, ja: '「持ち帰り」の意味はどれですか。', legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: '  ', promptJa: '「持ち帰り」の意味はどれですか。' }), { ko: U3.legacyPrompt, ja: '「持ち帰り」の意味はどれですか。', legacy: true })
  assert.deepEqual(quizPromptView({ promptKo: null, promptJa: null }), { ko: U3.legacyPrompt, ja: null, legacy: true }, '둘 다 비어도 깨지지 않는다')
  assert.deepEqual(quizPromptView({ promptKo: '뜻은?', promptJa: '' }), { ko: '뜻은?', ja: null, legacy: false })
  assert.equal(U3.legacyPrompt, '일본어 문장을 읽고 알맞은 답을 고르세요.')
  assert.equal(U3.legacyNote, '예전에 만든 수업이라 한국어 문제 설명이 없어요.')
})

test('결과 목록 한 줄: promptKo ?? promptJa — 공통 안내 줄은 넣지 않는다', () => {
  assert.deepEqual(quizSummaryPrompt({ promptKo: '뜻은?', promptJa: '持ち帰り' }), { text: '뜻은?', ja: false })
  assert.deepEqual(quizSummaryPrompt({ promptKo: null, promptJa: '「持ち帰り」の意味' }), { text: '「持ち帰り」の意味', ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: '', promptJa: '「持ち帰り」の意味' }), { text: '「持ち帰り」の意味', ja: true })
  assert.deepEqual(quizSummaryPrompt({ promptKo: null, promptJa: null }), { text: U3.legacyPrompt, ja: false })
})

// ── ④ 글자 비교 ─────────────────────────────────────────────────────────

test('글자 비교: 조각을 이어 붙이면 내 문장·모범 답안과 정확히 같다(원문 불변)', () => {
  const cases: Array<[string, string]> = [
    ['温かい紅茶をください。', '温かい紅茶を一つください。'],
    ['暖かい紅茶を二つください。', '温かい紅茶を一つください。'],
    ['いいえ、大丈夫です。', '今日は大丈夫です。'],
    ['持ち帰りでお願いします', '持ち帰りでお願いします。'],
    ['😀 今日は！', '今日は。'],
    ['a　b、c', 'abc'],
  ]
  for (const [mine, model] of cases) {
    const r = compareAnswer(mine, model)
    if (r.kind !== 'diff') continue
    assert.equal(join(r.mine), mine, mine)
    assert.equal(join(r.model), model, model)
  }
})

test('글자 비교: 빠진 글자는 모범 답안 쪽(실선)에만, 다른 한자·숫자는 양쪽에 표시', () => {
  const miss = compareAnswer('温かい紅茶をください。', '温かい紅茶を一つください。')
  assert.equal(miss.kind, 'diff')
  if (miss.kind === 'diff') {
    assert.deepEqual(miss.onlyMine, [])
    assert.deepEqual(miss.onlyModel, ['一つ'])
    assert.deepEqual(marks(miss.model), ['一つ'])
  }
  const kanji = compareAnswer('暖かい紅茶を二つください。', '温かい紅茶を一つください。')
  assert.equal(kanji.kind, 'diff')
  if (kanji.kind === 'diff') {
    assert.deepEqual(kanji.onlyMine, ['暖', '二'])
    assert.deepEqual(kanji.onlyModel, ['温', '一'])
  }
})

test('글자 비교: 문장부호·공백만 다르면 같음(글자별 판정 — 섞인 조각도 부호만 뺀다)', () => {
  assert.deepEqual(compareAnswer('持ち帰りでお願いします', '持ち帰りでお願いします。'), { kind: 'same' })
  assert.deepEqual(compareAnswer('持ち帰りで お願いします！', '持ち帰りでお願いします。'), { kind: 'same' })
  assert.deepEqual(compareAnswer('今日は大丈夫です。', '今日は大丈夫です。'), { kind: 'same' })
  const mixed = compareAnswer('いいえ、大丈夫です。', '今日は大丈夫です。')
  assert.equal(mixed.kind, 'diff')
  if (mixed.kind === 'diff') {
    assert.deepEqual(mixed.onlyMine, ['いいえ'], '「、」는 표시하지 않는다')
    assert.deepEqual(mixed.onlyModel, ['今日は'])
    assert.ok(mixed.mine.some((s) => !s.changed && s.text.includes('、')))
  }
  const mixedRun = compareAnswer('ですね。です', 'です')
  assert.equal(mixedRun.kind, 'diff')
  if (mixedRun.kind === 'diff') {
    assert.ok(mixedRun.onlyMine.every((t) => !/[。、\s]/.test(t)), `부호는 밑줄 조각에 들지 않는다: ${mixedRun.onlyMine}`)
    assert.equal(join(mixedRun.mine), 'ですね。です')
  }
})

test('글자 비교: 모르겠어요(빈 답)·200자 초과는 표시 없음', () => {
  assert.deepEqual(compareAnswer(null, '今日は大丈夫です。'), { kind: 'none' })
  assert.deepEqual(compareAnswer('', '今日は大丈夫です。'), { kind: 'none' })
  assert.deepEqual(compareAnswer('   ', '今日は大丈夫です。'), { kind: 'none' })
  assert.deepEqual(compareAnswer('あ'.repeat(201), '今日は大丈夫です。'), { kind: 'none' })
  assert.notEqual(compareAnswer('あ'.repeat(200), '今日は大丈夫です。').kind, 'none')
})
