import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LessonContent, TodayLessonItem, TodayLessons } from '@/types/lesson'
import { correctFromScore, deriveLessonCard, endResultFrom, expressionsFrom, firstStage, genPhase, hasJa, memoRequest, memoWordProblem, mmss, rateLabel, segmentLines } from '../logic'
import { concatWav, parseWav } from '../wav'
import { pasteMeta } from '../LessonPasteScreen'
import { HOME, LESSON, TOPICS, stageLabel } from '../lessonCopy'

const item = (over: Partial<TodayLessonItem> = {}): TodayLessonItem => ({
  id: 'l1', kind: 'NEW', status: 'DONE', title: 'x', titleKo: null, stageDone: 5, topic: { id: 't1', title: '카페 주문' }, score: 80, jobId: null, speaking: { used: 4, total: 5 }, ...over,
})
const today = (list: TodayLessonItem[], over: Partial<TodayLessons> = {}): TodayLessons => ({
  mode: 'NEW', date: '2026-09-28', todayLessons: list, resume: null, recommendation: { topicId: 't1', topicTitle: '카페 주문', level: 'N5', reason: 'CONTINUE', nextPreview: { titleKo: '계산하기', teaserKo: '…' } }, ...over,
})

test('홈 카드 상태: 표의 위 줄이 이긴다(로딩·오류·만드는 중·진행·재개·실패·완료·시작)', () => {
  assert.equal(deriveLessonCard('loading', null).kind, 'loading')
  assert.equal(deriveLessonCard('error', null).kind, 'error')
  assert.equal(deriveLessonCard('ready', today([item({ status: 'GENERATING', jobId: 'j1' }), item()])).kind, 'gen')
  const prog = deriveLessonCard('ready', today([item(), item({ id: 'l2', status: 'IN_PROGRESS', stageDone: 2 })]))
  assert.deepEqual(prog.kind === 'progress' && [prog.lessonId, prog.stageDone, prog.ready, prog.date], ['l2', 2, false, null])
  const readyCard = deriveLessonCard('ready', today([item({ status: 'READY', stageDone: 0 })]))
  assert.ok(readyCard.kind === 'progress' && readyCard.ready, '★ READY·0 → "수업이 준비됐어요"')
  const resume = deriveLessonCard('ready', today([item({ status: 'FAILED' })], { resume: { id: 'old', title: 'はじめて', titleKo: '처음', stageDone: 3, date: '2026-09-27' } }))
  assert.deepEqual(resume.kind === 'progress' && [resume.lessonId, resume.date, resume.topic], ['old', '2026-09-27', '처음'], '재개가 실패보다 위')
  assert.equal(deriveLessonCard('ready', today([item({ status: 'FAILED' }), item()])).kind, 'genfail', '가장 최근이 실패')
  const done = deriveLessonCard('ready', today([item()]))
  assert.ok(done.kind === 'done' && done.nextPreview?.titleKo === '계산하기')
  assert.equal(deriveLessonCard('ready', today([])).kind, 'start')
})

test('맞힌 수·문구: 점수(서버 재채점) → 5문제 기준, 말하기 표현 줄은 total>0 일 때만', () => {
  assert.deepEqual([correctFromScore(80), correctFromScore(100), correctFromScore(0), correctFromScore(null), correctFromScore(60, 5)], [4, 5, 0, 0, 3])
  assert.equal(HOME.doneBody('카페 주문', 4, { used: 4, total: 5 }), '카페 주문 · 문제 4/5 맞힘 · 말하기 표현 4/5')
  assert.equal(HOME.doneBody('카페 주문', 4, { used: 0, total: 0 }), '카페 주문 · 문제 4/5 맞힘')
  assert.equal(HOME.doneBody('카페 주문', 4, null), '카페 주문 · 문제 4/5 맞힘')
  assert.equal(stageLabel(3), '③ 문제')
  assert.equal(LESSON.next(2), '다음 단계 · ② 문법')
  assert.equal(TOPICS.intro('N5', ['N5', 'N4']), '어떤 이야기로 수업할까요? 내 수준(N5)과 한 단계 위(N4) 주제를 보여 드려요.')
  assert.equal(TOPICS.intro('N4', ['N5', 'N4', 'N3']), '어떤 이야기로 수업할까요? 내 수준(N4)과 한 단계 위·아래 주제를 보여 드려요.')
  assert.equal(TOPICS.intro('N1', ['N1']), '어떤 이야기로 수업할까요? 내 수준(N1) 주제를 보여 드려요.')
})

test('생성 대기 문구: 경과 구간·SAVE·120초 넘음, m:ss', () => {
  assert.equal(genPhase(3, 'LLM'), '주제와 지난 수업을 살펴보고 있어요')
  assert.equal(genPhase(30, 'LLM'), '대화문을 쓰고 있어요')
  assert.equal(genPhase(60, null), '문법과 문제를 만들고 있어요')
  assert.equal(genPhase(90, null), '응용·말하기 과제를 고르고 있어요')
  assert.equal(genPhase(110, null), '마지막으로 확인하고 있어요')
  assert.equal(genPhase(20, 'SAVE'), '마지막으로 확인하고 있어요')
  assert.equal(genPhase(130, 'SAVE'), '조금 오래 걸리고 있어요. 조금만 더 기다려 주세요.')
  assert.deepEqual([mmss(0), mmss(65), mmss(-3)], ['0:00', '1:05', '0:00'])
})

const content = {
  speaking: [
    { id: 's1', promptKo: '', targetIds: ['c1', 'g1'], modelAnswerJa: '', modelReading: '', modelKo: '' },
    { id: 's2', promptKo: '', targetIds: ['c2'], modelAnswerJa: '', modelReading: '', modelKo: '' },
    { id: 's3', promptKo: '', targetIds: ['c3', 'g2'], modelAnswerJa: '', modelReading: '', modelKo: '' },
  ],
  quiz: Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, promptKo: 'x', promptJa: null, choices: ['a', 'b', 'c', 'd'], answer: 0, targetIds: ['c1'], explanationKo: '' })),
  dialogue: [
    { speaker: 'A', ja: 'a', reading: 'a', ko: '', segment: 1 },
    { speaker: 'B', ja: 'b', reading: 'b', ko: '', segment: 1 },
    { speaker: 'A', ja: 'c', reading: 'c', ko: '', segment: 1 },
    { speaker: 'B', ja: 'd', reading: 'd', ko: '', segment: 2 },
    { speaker: 'A', ja: 'e', reading: 'e', ko: '', segment: 2 },
  ],
  nextPreview: { titleKo: '다음', teaserKo: '…' },
} as unknown as LessonContent

test('종료 카드 값(#60 DONE 재계산): 정답 = 점수, 만든 문장 = 글자 있는 칸, 쓴/못 쓴 = 말하기 결과(판정 불가 제외, 안 한 과제 목표는 못 씀)', () => {
  const r = endResultFrom({
    score: 60,
    content,
    progress: {
      application: { answers: ['紅茶', null, '  '] },
      speaking: [
        { itemId: 's1', text: 'x', matchedIds: ['c1'], missedIds: [], utteranceId: null, at: '' }, // g1 = 판정 불가(어디에도 없음)
        { itemId: 's3', text: 'y', matchedIds: [], missedIds: ['c3', 'g2'], utteranceId: null, at: '' },
      ],
    },
  })!
  assert.deepEqual([r.correct, r.total, r.applicationDone], [3, 5, 1])
  assert.deepEqual(r.usedIds, ['c1'])
  assert.deepEqual(r.missedIds.sort(), ['c2', 'c3', 'g2'])
  assert.equal(r.nextPreview?.titleKo, '다음')
  assert.equal(endResultFrom({ score: 0, content: null, progress: {} }), null)
  assert.deepEqual(expressionsFrom(content, {}), { usedIds: [], missedIds: ['c1', 'g1', 'c2', 'c3', 'g2'] })
})

test('메모 규칙(서버와 같음): 가나·한자·20자·구간 중복·구간 5·수업 15, #62a 본문은 구간별', () => {
  const memo = [{ segment: 1, ja: '注文' }]
  assert.equal(memoWordProblem('coffee', 1, memo), 'NOT_JA')
  assert.equal(memoWordProblem('', 1, memo), 'NOT_JA')
  assert.equal(memoWordProblem('あ'.repeat(21), 1, memo), 'NOT_JA')
  assert.equal(memoWordProblem('注文', 1, memo), 'DUP')
  assert.equal(memoWordProblem('注文', 2, memo), null, '다른 구간이면 같은 단어도 된다')
  const five = Array.from({ length: 5 }, (_, i) => ({ segment: 1, ja: `語${i}` }))
  assert.equal(memoWordProblem('新', 1, five), 'SEGMENT_FULL')
  const fifteen = Array.from({ length: 15 }, (_, i) => ({ segment: (i % 3) + 1, ja: `語${i}` }))
  assert.equal(memoWordProblem('新', 4, fifteen), 'LESSON_FULL')
  assert.deepEqual(memoRequest([{ segment: 2, ja: 'b' }, { segment: 1, ja: 'a' }, { segment: 2, ja: 'c' }, { segment: 2, ja: 'b' }]), { segments: [{ segment: 1, words: ['a'] }, { segment: 2, words: ['b', 'c'] }] })
  assert.ok(hasJa('ちゅうもん') && hasJa('注文') && hasJa('コーヒー') && !hasJa('coffee') && !hasJa('커피'))
})

test('단계·구간·배율: 처음 단계 = min(stageDone+1, 5), 구간 → 줄 번호, 배율 표기', () => {
  assert.deepEqual([firstStage(0), firstStage(2), firstStage(4), firstStage(5)], [1, 3, 5, 5])
  assert.deepEqual([...segmentLines(content).entries()], [[1, [0, 1, 2]], [2, [3, 4]]])
  assert.deepEqual([rateLabel(0.6), rateLabel(0.8), rateLabel(1), rateLabel(null), rateLabel(0.7)], ['0.6', '0.8', '1.0', '0.8', '0.8'])
})

test('붙여넣기 글자 수(코드포인트)·안내 문구·보낼 수 있는가', () => {
  assert.deepEqual(pasteMeta(''), { n: 0, hint: '50자 이상 · 3~8줄이 알맞아요', bad: false, ok: false })
  assert.deepEqual(pasteMeta('あ'.repeat(10)).hint, '50자 이상 넣어 주세요 · 지금 10자')
  assert.equal(pasteMeta('𠮷'.repeat(50)).n, 50, '서로게이트 쌍도 1자')
  assert.deepEqual([pasteMeta('あ'.repeat(50)).ok, pasteMeta('あ'.repeat(2000)).ok, pasteMeta('あ'.repeat(2001)).bad], [true, true, true])
})

function wav(samples: number[], rate = 22050): ArrayBuffer {
  const data = new Int16Array(samples)
  const buf = new ArrayBuffer(44 + data.byteLength)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  v.setUint32(4, 36 + data.byteLength, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, 'data')
  v.setUint32(40, data.byteLength, true)
  new Int16Array(buf, 44).set(data)
  return buf
}

test('WAV 이어 붙이기: 같은 형식이면 PCM + 조각 사이 무음, 형식이 다르면 첫 조각, 하나면 그대로', () => {
  const a = wav([1, 2, 3])
  const b = wav([4, 5])
  const out = concatWav([a, b], [0, 1000 / 22050 * 2]) // 무음 2프레임
  const p = parseWav(out)!
  assert.equal(p.sampleRate, 22050)
  assert.deepEqual([...new Int16Array(p.data.buffer.slice(p.data.byteOffset, p.data.byteOffset + p.data.byteLength))], [1, 2, 3, 0, 0, 4, 5])
  assert.equal(new DataView(out).getUint32(4, true), out.byteLength - 8, 'RIFF 크기')
  assert.equal(concatWav([a]), a)
  assert.equal(concatWav([a, wav([9], 44100)]), a, '표본율이 다르면 첫 조각')
  assert.equal(concatWav([a, new ArrayBuffer(4)]), a, '깨진 조각이면 첫 조각')
  assert.equal(parseWav(new ArrayBuffer(8)), null)
})

/* ── task-044: 챌린지 모드 회화 카드(가이드 §3-4) ─────────────────────────── */

test('챌린지 회화 카드: 다른 주제 수업을 끝낸 날·열린 날에도 챌린지 [오늘 수업 만들기]가 주인, 다른 수업은 보조 줄 하나', async () => {
  const { deriveChallengeLessonCard } = await import('../logic')
  const other = (over: Partial<TodayLessonItem> = {}) => item({ id: 'o1', topic: { id: 't9', title: '길 묻기' }, ...over })
  const task = (state: 'TODO' | 'GENERATING' | 'READY' | 'IN_PROGRESS' | 'CONTINUE' | 'DONE' | 'FAILED', lessonId: string | null = null, jobId: string | null = null) => ({ state, lessonId, jobId })
  // ① 다른 주제 수업을 이미 끝낸 날
  const d1 = deriveChallengeLessonCard('ready', today([other({ status: 'DONE', score: 80 })]), task('TODO'), 't1')
  assert.equal(d1.card.kind, 'make')
  assert.deepEqual(d1.aux, { kind: 'done', title: '길 묻기', score: 80 })
  // ② 다른 주제 수업이 열려 있는 날(열림 > 끝냄)
  const d2 = deriveChallengeLessonCard('ready', today([other({ status: 'DONE' }), other({ id: 'o2', status: 'IN_PROGRESS', stageDone: 2 })]), task('TODO'), 't1')
  assert.equal(d2.card.kind, 'make')
  assert.deepEqual(d2.aux, { kind: 'open', lessonId: 'o2', title: '길 묻기', stageDone: 2 })
  // 어제 만든 다른 주제 수업(resume) — 보조 줄 [이어서 하기], 카드 주인은 챌린지
  const d3 = deriveChallengeLessonCard('ready', today([], { resume: { id: 'r1', title: 'みち', titleKo: '길 묻기', stageDone: 3, date: '2026-09-27' } }), task('TODO'), 't1')
  assert.equal(d3.card.kind, 'make')
  assert.deepEqual(d3.aux, { kind: 'open', lessonId: 'r1', title: '길 묻기', stageDone: 3 })
  // 챌린지 주제 수업 resume(CONTINUE)만 주인 — 날짜·단계는 #58 resume 에서
  const d4 = deriveChallengeLessonCard('ready', today([], { resume: { id: 'c1', title: 'カフェ', titleKo: '카페', stageDone: 2, date: '2026-09-27' } }), task('CONTINUE', 'c1'), 't1')
  assert.deepEqual(d4.card, { kind: 'continue', lessonId: 'c1', date: '2026-09-27', stageDone: 2 })
  assert.equal(d4.aux, null, '자기 resume 는 보조 줄이 아니다')
  // 다른 주제(붙여넣기 포함) 수업을 만드는 중이면 busy + 그 잡을 지켜본다
  const d5 = deriveChallengeLessonCard('ready', today([item({ id: 'p1', status: 'GENERATING', topic: null, jobId: 'jp' })]), task('TODO'), 't1')
  assert.equal(d5.card.kind, 'busy')
  assert.equal(d5.watchJobId, 'jp')
  // 챌린지 수업 만드는 중 — #58 같은 id 의 jobId 우선, 없으면 #158 jobId
  const d6 = deriveChallengeLessonCard('ready', today([item({ id: 'c2', status: 'GENERATING', jobId: 'j58' })]), task('GENERATING', 'c2', 'j158'), 't1')
  assert.equal(d6.card.kind, 'gen')
  assert.equal(d6.watchJobId, 'j58')
  assert.equal(deriveChallengeLessonCard('ready', today([]), task('GENERATING', 'c2', 'j158'), 't1').watchJobId, 'j158')
  // 진행·준비·실패·끝냄 · #58 로딩·실패
  assert.deepEqual(deriveChallengeLessonCard('ready', today([item({ id: 'c3', status: 'IN_PROGRESS', stageDone: 3 })]), task('IN_PROGRESS', 'c3'), 't1').card, { kind: 'progress', lessonId: 'c3', stageDone: 3 })
  assert.equal(deriveChallengeLessonCard('ready', today([]), task('READY', 'c3'), 't1').card.kind, 'ready')
  assert.equal(deriveChallengeLessonCard('ready', today([]), task('FAILED', 'c3'), 't1').card.kind, 'fail')
  const done = deriveChallengeLessonCard('ready', today([item({ id: 'c4' })]), task('DONE', 'c4'), 't1')
  assert.ok(done.card.kind === 'done' && done.card.lesson?.id === 'c4' && done.card.nextPreview?.titleKo === '계산하기')
  assert.equal(deriveChallengeLessonCard('loading', null, task('TODO'), 't1').card.kind, 'loading')
  assert.equal(deriveChallengeLessonCard('error', null, task('TODO'), 't1').card.kind, 'error')
  // 복습 레슨은 보지 않는다
  assert.equal(deriveChallengeLessonCard('ready', today([other({ kind: 'REVIEW', status: 'IN_PROGRESS' })]), task('TODO'), 't1').aux, null)
})
