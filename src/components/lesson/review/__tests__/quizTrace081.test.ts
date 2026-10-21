/**
 * task-081 ④-B2 — 복습·챌린지·성장 탭·단어장 카드에서 «문제»(문제 단계·문제 점수) 흔적이 지워졌는지(§37-6·37-8·37-18-1 ②).
 * 문구는 가이드 글자 그대로 고정하고, 파일 소스(주석 제외)에서 «문제» 낱말·엔진명·셈 뜻 «세요» 가 없는지 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COPY, CREATE } from '@/components/challenge/challengeCopy'
import { ruleLines, scoreRows, taskRowView } from '@/components/challenge/logic'
import { AXES, GROWTH } from '@/components/plan/growthCopy'
import { LESSON_CH, NOT_COUNTED } from '@/components/vocab/topicCopy'
import type { ChallengeDay, ChallengeTask } from '@/types/challenge'
import { RV_GEN, RV_HOME, RV_LESSON } from '../reviewCopy'

const ROOT = join(process.cwd(), 'src/components')
const ENGINE_NAMES = /claude|anthropic|haiku|sonnet|opus|whisper|reazon|sherpa|zipformer|style[-_ ]?bert|sbv2|qwen|ollama|gateway|model_id|speaker_id/i
const COUNT_SEYO = /(만|을|를|로|으로|도|이렇게|합쳐서|함께) 세요/
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/**
 * 이 갈래가 만지는 문구 파일. 허용(«문제» 가 퀴즈 뜻이 아님 · 이번 결정 밖):
 * - challenge/logic.ts `'문제 있음: '` — 수업 만들기 실패 줄의 낭독 접두어(«탈이 났다» 뜻).
 * - (plan/growthCopy.ts `GROWTH.how` 첫 줄의 «수업 문제» 는 Leader 가 직접 지웠다 — 허용 항목 없음.)
 */
const FILES: { f: string; allow: string[] }[] = [
  { f: 'lesson/review/reviewCopy.ts', allow: [] },
  { f: 'lesson/review/TodayReviewCard.tsx', allow: [] },
  { f: 'lesson/review/reviewLogic.ts', allow: [] },
  { f: 'challenge/challengeCopy.ts', allow: [] },
  { f: 'challenge/DayStrip.tsx', allow: [] },
  { f: 'challenge/logic.ts', allow: ["'문제 있음: '"] },
  { f: 'vocab/topicCopy.ts', allow: [] },
  { f: 'plan/growthCopy.ts', allow: [] },
]

test('복습 문구 — §37-8 글자 그대로, 끝냄 카드에 점수 없음, quizNote 지움', () => {
  assert.equal(RV_HOME.doneBody(5), '5개 항목')
  assert.equal(RV_HOME.doneBody.length, 1)
  assert.equal(RV_GEN.itemsNote, '항목을 섞은 새 대화로 오늘의 회화와 같은 5단계(이해 → 문법 → 조각 → 응용 → 말하기)를 해요. ● 은 집중 항목이에요.')
  assert.equal(RV_LESSON.itemsNote, '선생님이 고른 항목이에요. 오늘 대화·응용·말하기에 섞여 나와요.')
  assert.equal(RV_LESSON.exprNote, '이번 복습 항목이에요. 누르면 소리를 들을 수 있어요. 응용·말하기에서 다시 써요.')
  assert.equal(RV_LESSON.exprNoteNoAudio, '이번 복습 항목이에요. 응용·말하기에서 다시 써요.')
  assert.ok(!('quizNote' in RV_LESSON))
})

test('복습 하던 수업 «다음은 …» — 단계 이름 받침에 맞춘 서술격(오늘의 회화 HOME.nextStage 와 같은 규칙)', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => RV_HOME.nextStage(n)),
    ['다음은 ① 이해예요. 단계마다 저장돼요.', '다음은 ② 문법이에요. 단계마다 저장돼요.', '다음은 ③ 조각이에요. 단계마다 저장돼요.', '다음은 ④ 응용이에요. 단계마다 저장돼요.', '다음은 ⑤ 말하기예요. 단계마다 저장돼요.'],
  )
})

test('챌린지 — 날짜별 기록 제목·안내·과제 문구·규칙(§37-8), 점수가 null 이어도 그대로', () => {
  assert.equal(COPY.scoreTitle, '날짜별 기록')
  assert.equal(COPY.scoreNote, '회화는 끝낸 날만 표시하고, 단어는 그날 세트 합계예요.')
  assert.equal(CREATE.lessonBody('카페 주문'), '「카페 주문」 수업을 하루 1개 끝내요 · 약 15분')
  assert.equal(taskRowView({ kind: 'LESSON', state: 'DONE' } as unknown as ChallengeTask).desc, '끝냈어요')
  const day = { date: '2026-10-21', dayIndex: 1, state: 'MET', lesson: { done: 1, quizCorrect: null, quizTotal: null, lessonId: 'l', refExists: true }, words: null } as unknown as ChallengeDay
  assert.deepEqual(scoreRows([day], { lesson: true, words: false })[0].lesson, { text: '끝냄' })
  const rules = ruleLines({ lesson: true, words: false } as never)
  assert.ok(rules.includes('회화는 수업을 끝내면 완료예요.'))
  const ds = strip(readFileSync(join(ROOT, 'challenge/DayStrip.tsx'), 'utf8'))
  assert.ok(ds.includes('회화') && ds.includes('날짜별 회화 수업과 단어 맞힘') && ds.includes('지난 날 회화 수업과 단어 맞힘'))
  assert.ok(!/Dots|dots/.test(ds), '점(dots)을 그리지 않는다')
})

test('단어장·오늘 카드 보조 줄 — «문제 c/5 · » 를 뺐고, 옛 두 인자 호출도 같은 글', () => {
  const want = `✓ 오늘 「카페 주문」 수업 끝냄 · ${NOT_COUNTED}`
  assert.equal(LESSON_CH.auxDone('카페 주문'), want)
  assert.equal(LESSON_CH.auxDone('카페 주문', 4), want)
})

test('성장 탭 축 안내 — Leader 결정 §37-18-1 ② 4줄', () => {
  const how = Object.fromEntries(AXES.map((a) => [a.axis, a.how]))
  assert.deepEqual([how.VOCAB_RECALL, how.GRAMMAR_PARTICLE], ['오늘의 단어를 풀면 쌓여요', '대화 교정에서 쌓여요'])
  assert.deepEqual([GROWTH.axisOneSidedSub.VOCAB_RECALL, GROWTH.axisOneSidedSub.GRAMMAR_PARTICLE], ['오늘의 단어도 풀면 단계가 보이기 시작해요.', ''])
})

test('소스 전수 — «문제» 낱말(허용 목록 밖) 0 · 엔진명 0 · 셈 뜻 «세요» 0', () => {
  for (const { f, allow } of FILES) {
    let src = strip(readFileSync(join(ROOT, f), 'utf8'))
    for (const a of allow) {
      assert.ok(src.includes(a), `${f}: 허용 항목이 사라졌으면 목록에서도 지운다 — ${a}`)
      src = src.split(a).join('')
    }
    const i = src.indexOf('문제')
    assert.equal(i, -1, `${f}: «문제» — ${src.slice(Math.max(0, i - 30), i + 30)}`)
    assert.ok(!ENGINE_NAMES.test(src), `${f}: 엔진명`)
    src.split('\n').forEach((line) => assert.ok(!COUNT_SEYO.test(line), `${f}: 셈 «세요» — ${line.trim().slice(0, 80)}`))
  }
})
