/**
 * 챌린지 주제 단어·오늘 탭 챌린지 문구의 단일 출처(task-044 designer 가이드 E12, 설계서 `docs/design/challenge.md` v2.3 §4-3b·c·§8-3·§13-5).
 * 오늘 띠·단어 카드·회화 카드 챌린지 모드·새 단어 대기 화면·덱 머리·끝내기 시트·결과·수업 종료 줄이 여기서만 문구를 고른다.
 * 엔진·모델 이름은 없다("AI" 까지만). `generation.reason` 코드값은 화면에 쓰지 않는다.
 */
import type { JlptLevel } from '@/types/lesson'
import { formatMonthDay } from './format'
import { levelLabel } from './labels'

/** 「주제」 — 주제 이름은 늘 이 괄호로 감싼다. */
export const q = (title: string) => `「${title}」`

export const NOT_COUNTED = '챌린지에는 세지 않아요'

export const STRIP = {
  progressTitle: (title: string, dayIndex: number, days: number) => `${q(title)} 챌린지 · ${dayIndex}일째 / ${days}일`,
  progressSub: (done: number, total: number) => `오늘 할 일 ${done} / ${total}`,
  words: '단어',
  wordsShort: (answered: number, need: number) => `단어 ${answered}/${need}장`,
  lesson: '회화',
  metTitle: '✓ 오늘 챌린지 목표 달성',
  metSub: (streak: number | null, lastDay: boolean) =>
    lastDay ? '오늘 자정에 마감돼요' : streak !== null && streak > 0 ? `수행 연속 ${streak}일째 · 내일도 이어 가요` : '내일도 이어 가요',
  tomorrowTitle: (title: string) => `${q(title)} 챌린지 · 내일 시작해요`,
  tomorrowSub: '내일 공부 탭에서 첫 과제를 해요',
  toPlan: '계획표 ›',
  aria: (p: { title: string; dayIndex: number; days: number; done: number; total: number; words?: string | null }) =>
    `${p.title} 챌린지, ${p.dayIndex}일째 / ${p.days}일, 오늘 할 일 ${p.done} / ${p.total}${p.words ? `, ${p.words}` : ''}, 계획표에서 보기`,
  metAria: '오늘 챌린지 목표 달성, 계획표에서 보기',
  tomorrowAria: (title: string) => `${title} 챌린지 내일 시작, 계획표에서 보기`,
  loadError: '챌린지 정보를 불러오지 못했어요. 단어·회화는 평소처럼 할 수 있어요.',
  retry: '다시 시도',
} as const

export const WORDS_CARD = {
  title: '오늘의 단어',
  /**
   * task-076 D7 B(§33 P7) — 챌린지 난이도를 주제 이름 **앞에**: 칩은 한 줄 말줄임이라 끝에 두면 긴 주제 이름에서 난이도가 잘린다(데모 v2 실측).
   * 이름+코드는 `levelLabel` 로만. 난이도를 모르면(옛 응답) 지금 모양.
   */
  chip: (title: string, level?: JlptLevel | null) => (level && levelLabel(level) ? `챌린지 · ${levelLabel(level)} · ${q(title)}` : `챌린지 · ${q(title)}`),
  chipSr: '챌린지 주제: ',
  todoHead: (title: string, n: number, need: number) => `${q(title)} 새 단어 ${n}장 · 오늘 0/${need}장`,
  todoBody: (n: number, need: number) => `AI 가 매일 새로 만들어요 · 하루에 ${n}장 중 ${need}장 이상 풀면 오늘 단어 완료 · 나눠 풀어도 합쳐서 계산해요`,
  start: '시작하기',
  startAria: (title: string, n: number) => `${q(title)} 새 단어 ${n}장 시작하기`,
  shortHead: (answered: number, need: number) => `오늘 ${answered}/${need}장 — ${Math.max(0, need - answered)}장 더 풀면 오늘 단어 완료`,
  setsLine: (k: number, c: number, w: number, s: number) => `끝낸 세트 ${k}개 · 맞힘 ${c} · 틀림 ${w} · 건너뜀 ${s}`,
  shortMemoStrong: '세트를 일찍 끝냈어도 괜찮아요.',
  shortMemo: ' 한 세트 더 풀면 오늘 푼 장수에 합쳐서 계산해요. 건너뛴 카드는 다음 세트에 다시 나올 수 있어요.',
  oneMore: '한 세트 더',
  doneHead: '✓ 오늘 단어 완료',
  doneBody: (k: number, answered: number, need: number, c: number) => `${k >= 2 ? `${k}세트 합쳐 ` : ''}${answered}장 풂(${need}장 이상) · 맞힘 ${c}`,
  wipNote: '끝내면 오늘 합계에 더해져요',
  otherWipNote: '이 세트를 끝내면 챌린지 단어를 시작할 수 있어요',
  ipDefense: '풀던 세트가 있어요',
  resume: '이어서 풀기',
  mine: '내 단어장으로 풀기',
  mineNote: '내 단어장 세트는 챌린지에는 세지 않아요',
} as const

/** 오늘의 회화 카드 — 챌린지 모드(§3-4). 기본 카드 문구는 `lesson/lessonCopy.ts HOME` 그대로. */
export const LESSON_CH = {
  chip: (dayIndex: number) => `챌린지 · ${dayIndex}일째`,
  genTitle: '수업을 만들고 있어요',
  genBody: (title: string) => `${q(title)} · 1분쯤 걸려요. 다 되면 여기서 열 수 있어요.`,
  genSr: '수업을 만드는 중이에요',
  open: '보러 가기',
  busyTitle: '다른 수업을 만들고 있어요',
  busyBody: (other: string) => `${q(other)} · 1분쯤 걸려요. 다 되면 여기서 열 수 있어요.`,
  busyInfo: (title: string) => `챌린지 주제(${q(title)}) 수업은 이 수업이 다 된 뒤에 [오늘 수업 만들기]로 만들 수 있어요.`,
  recLabel: '챌린지 주제',
  r3First: '챌린지 첫 수업이에요',
  r3Preview: (dayIndex: number, t: string) => `챌린지 ${dayIndex}일째 · 지난 시간 예고 · ${t}`,
  r3Day: (dayIndex: number) => `챌린지 ${dayIndex}일째`,
  make: '오늘 수업 만들기',
  makeAria: (title: string) => `${q(title)} 오늘 수업 만들기`,
  creating: '만드는 중…',
  makeNote: '누르면 1분쯤 걸려요 · 주제는 챌린지 주제로 정해져 있어요',
  other: '다른 주제로 수업하기',
  otherAria: '다른 주제로 수업하기, 챌린지에는 세지 않아요',
  readyTitle: '수업이 준비됐어요',
  readyBody: (title: string) => `${q(title)} · 5단계 · 약 15분`,
  start: '시작하기',
  progressTitle: '하던 수업이 있어요',
  resume: '이어서 하기',
  continueTitle: '어제 만든 챌린지 수업이 있어요',
  continueBody: (title: string, date: string | null, n: number | null) =>
    date !== null && n !== null ? `${q(title)} · ${formatMonthDay(date)} 시작 · 5단계 중 ${n}단계 끝냄` : q(title),
  continueNote: (nextStage: string, dayIndex: number) => `다음은 ${nextStage}. 단계마다 저장돼요. 오늘 끝내면 오늘(${dayIndex}일째) 회화 기록으로 인정돼요.`,
  failTitle: '수업을 만들지 못했어요',
  failBody: (title: string) => `${q(title)} · 다시 만들면 대부분 잘 만들어져요.`,
  retry: '다시 만들기',
  doneTitle: '✓ 오늘 수업을 끝냈어요',
  nextLesson: '다음 수업 만들기',
  doneNote: '오늘 회화 목표는 이미 채웠어요',
  doneResult: '끝낸 수업 결과 보기',
  auxOpen: (t: string, n: number) => `${q(t)} 수업이 열려 있어요 · 5단계 중 ${n}단계 · ${NOT_COUNTED}`,
  auxOpenAria: (t: string) => `${q(t)} 수업 이어서 하기`,
  /** task-081: 점수를 뺐다(§37-8). 두 번째 인자는 호출부(`TodayLessonCard`)가 옮겨 갈 동안만 받고 읽지 않는다. */
  auxDone: ((t: string) => `✓ 오늘 ${q(t)} 수업 끝냄 · ${NOT_COUNTED}`) as (t: string, legacyCorrect?: number | null) => string,
  /** 챌린지 회화 과제가 꺼졌는데 #58 추천 이유가 CHALLENGE 일 때 기본 카드 추천 줄(가이드 §11 ⑧). */
  reasonChallenge: '챌린지 주제예요',
} as const

/** 새 단어 대기 화면 `/study/today/words/new`(§3-5). */
export const WAIT = {
  title: '오늘의 단어',
  back: '공부로',
  /** 방식 이름 없음(task-059 — 세트는 늘 카드 우선). */
  subtitle: (title: string, n: number) => `${q(title)} · ${n}장`,
  srQuiet: '세트를 만드는 중…',
  genTitle: (title: string) => `오늘의 ${q(title)} 새 단어를 만들고 있어요`,
  genBody: '보통 10~20초 걸려요',
  genLong: (title: string) => `조금 더 걸리고 있어요 · 늦어지면 ${q(title)} 표현으로 바로 이어서 풀어요`,
  skip: '주제 표현으로 바로 풀기',
  skipNote: (title: string) => `새 단어 없이 ${q(title)} 기본 표현과 지난 수업 표현으로 바로 풀어요`,
  skipping: '만드는 중…',
  busyTitle: '다른 화면에서 새 단어를 만들고 있어요',
  busyBody: '잠시 뒤 자동으로 다시 열어요',
  busyGiveUp: '아직 만들고 있어요. 잠시 뒤 다시 시도해 주세요.',
  retry: '다시 시도',
  error: '세트를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  rate: '세트를 너무 자주 만들었어요. 잠시 뒤 다시 시도해 주세요.',
  allDoneTitle: '오늘 이 주제 표현을 모두 풀었어요',
  allDoneBody: (wordsDone: boolean) => `${wordsDone ? '오늘 단어는 이미 완료예요. ' : ''}오늘 푼 표현은 내일 다시 나와요.`,
  topicEmptyTitle: '이 주제에는 아직 풀 표현이 없어요.',
  mine: '내 단어장으로 풀기',
  today: '공부로',
  ipFlash: '풀던 세트가 있어요. 이어서 풀거나 끝내 주세요.',
} as const

/**
 * 덱 머리 출처 줄 B(§3-6) — `topicSourceParts` 가 고른다. 줄 = 설명 + " · " + AI 주의(새 단어가 있을 때만).
 * 좁은 화면에서 한 줄로 줄일 때 주의(안전 고지)는 남기고 설명부터 줄이도록 두 부분을 따로 둔다(REV-125 L-4, Leader 결정).
 */
export const SOURCE = {
  aiNote: 'AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요',
  aiNoteShort: 'AI 가 만든 단어는 틀릴 수 있어요',
  sep: ' · ',
  reuse: (ai: number, title: string, rest: number) => `오늘 만든 새 단어 중 안 푼 ${ai}장${rest > 0 ? ` + ${q(title)} 표현 ${rest}장` : ''}`,
  allAi: (title: string, n: number) => `${q(title)} 새 단어 ${n}장`,
  mixed: (ai: number, title: string, rest: number) => `새 단어 ${ai}장 + ${q(title)} 표현 ${rest}장`,
  topicOnly: (title: string, n: number, lessonCards: number) =>
    `${q(title)} 표현으로 만든 오늘의 단어 ${n}장${lessonCards >= 1 ? ` · 지난 수업 표현 ${lessonCards}개 포함` : ''}`,
} as const

/** 덱 알림 `topicReason`(#47 직후 첫 열기만)과 주제 세트의 강등·장수 알림. */
export const REASON = {
  fail: (title: string) => `오늘은 새 단어를 만들지 못해 ${q(title)} 표현으로 골랐어요 · 다음 세트에서 다시 만들어 볼게요`,
  limit: (title: string) => `오늘 새 단어 만들기는 여기까지예요 · ${q(title)} 표현으로 골랐어요`,
  newDone: (title: string) => `오늘 새 단어는 다 풀었어요 — ${q(title)} 표현으로 이어서 풀어요`,
  /** 이전 4지선다 주제 세트의 강등(이전 세트만 — 카드 우선 세트는 강등이 없다). */
  few: '뜻이 서로 다른 표현이 4개보다 적어서 이번엔 뒤집기 카드로 풀어요.',
  /** 보기를 하나도 못 만든 카드 우선 주제 세트(task-059 §23-8 ⑤★ — 내 단어장 쪽 짝은 `DeckNotice`). */
  noChoice: '뜻이 서로 다른 표현이 4개보다 적어서 이번엔 객관식 없이 풀어요.',
  fewer: (n: number) => `오늘 풀 수 있는 이 주제 카드가 ${n}장이라 ${n}장으로 만들었어요.`,
} as const

/** 덱 챌린지 줄 C(§3-6). */
export const DECK_CH = {
  past: (date: string, k: number) => `챌린지 · ${formatMonthDay(date)} 시작 세트 · 그날(${k}일째) 단어로 인정돼요`,
  done: '챌린지 · 오늘 단어는 이미 완료 · 더 풀면 오늘 합계에 더해져요',
  filled: (run: number) => `챌린지 · 오늘 ${run}장 풂 · 이 세트를 끝내면 오늘 단어 완료`,
  first: (need: number) => `챌린지 · ${need}장 이상 풀면 오늘 단어 완료`,
  run: (run: number, need: number) => `챌린지 · 오늘 ${run}/${need}장 — ${Math.max(0, need - run)}장 더 풀면 완료`,
  chipSr: '주제: ',
} as const

/** 끝내기 확인 시트 메모(§3-7). */
export const FINISH_CH = {
  zero: (done: boolean, base: number, need: number) => `오늘 단어는 ${done ? '이미 완료' : `${base}/${need}장`} 그대로예요.`,
  past: (date: string) => `이 세트는 ${formatMonthDay(date)}에 시작해서 그날 기록으로 남아요.`,
  done: '오늘 단어는 이미 완료예요. 이 세트도 오늘 합계에 더해져요.',
  filled: (after: number) => `이 세트까지 오늘 ${after}장 풀었어요 — 오늘 단어는 완료로 인정돼요.`,
  shortStrong: (need: number, after: number) => `지금 끝내면 오늘 단어는 ${need}장 중 ${after}장 — ‘일부’로 남아요.`,
  short: ' 남은 표현으로 한 세트 더 풀 수 있어요.',
} as const

/** 세트 결과(§3-8). */
export const RESULT_CH = {
  metNowTitle: '오늘 챌린지 목표 달성!',
  metNowBody: (title: string, dayIndex: number, ans: number, need: number) => `${q(title)} 챌린지 ${dayIndex}일째 · 오늘 단어 ${ans}장 풂(${need}장 이상)`,
  retroTitle: '어제 목표도 채웠어요',
  retroBody: (date: string, dayIndex: number) => `${formatMonthDay(date)}(${dayIndex}일째) · 이 세트는 시작한 날로 계산돼서 그날 목표를 채웠어요`,
  wordsDoneTitle: '오늘 단어 완료 · 챌린지 오늘 할 일 1 / 2',
  wordsDoneBody: (ans: number, need: number) => `${ans}장 풂(${need}장 이상) · 오늘의 회화가 남았어요`,
  shortTitle: (ans: number, need: number) => `오늘 ${ans}/${need}장 — ${Math.max(0, need - ans)}장 더 풀면 오늘 단어 완료예요.`,
  shortBody: '이 세트는 ‘일부’로 남고, 한 세트 더 풀면 합쳐서 계산해요.',
  already: (ans: number) => `오늘 목표는 이미 채웠어요 · 이 세트도 오늘 합계에 더해졌어요(푼 ${ans}장)`,
  wordsAlready: (ans: number) => `오늘 단어는 이미 완료예요 · 이 세트도 오늘 합계에 더해졌어요(푼 ${ans}장) · 오늘의 회화가 남았어요`,
  pastDay: (date: string, dayIndex: number, ans: number, need: number) => `${formatMonthDay(date)}(${dayIndex}일째) 기록으로 남았어요 · 그날 단어 ${ans}/${need}장`,
  toChallenge: '챌린지 ›',
  toPlan: '계획표 ›',
  toTalk: '회화 ›',
  oneMore: '한 세트 더',
  cautionAi: 'AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요 · 단어장에는 [단어장에 넣기]를 누른 단어만 들어가요',
  cautionTopic: '단어장에는 [단어장에 넣기]를 누른 표현만 들어가요',
  wrongTitle: (n: number) => `틀린 카드 ${n}`,
  wrongNote: '단어장에 넣어 두면 내 단어장 세트에도 나와요',
  subtitleTopic: (title: string) => q(title),
} as const

export const ADD = {
  add: '단어장에 넣기',
  aria: (surface: string) => `${surface} 단어장에 넣기`,
  busy: '넣는 중…',
  added: '✓ 넣었어요',
  exists: '단어장에 있어요',
  failed: '단어장에 넣지 못했어요. 잠시 뒤 다시 눌러 주세요.',
} as const

/** 수업 종료 줄(§3-9). */
export const LESSON_END_CH = {
  metNowTitle: '오늘 챌린지 목표 달성!',
  metNowBody: (title: string, dayIndex: number) => `${q(title)} 챌린지 ${dayIndex}일째 · 오늘 할 일을 다 했어요`,
  metTitle: (dayIndex: number) => `챌린지 ${dayIndex}일째 · 오늘 목표는 이미 채웠어요`,
  leftTitle: (dayIndex: number) => `챌린지 ${dayIndex}일째 · 회화 완료`,
  leftBody: '오늘의 단어가 남았어요',
  toChallenge: '챌린지 ›',
  toToday: '공부 탭 ›',
  toast: '오늘 챌린지 목표 달성!',
} as const
