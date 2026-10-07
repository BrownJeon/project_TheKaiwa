/**
 * 챌린지 화면(task-043 T3, 설계서 `docs/design/challenge.md` v2.3 §8·§13-5, designer 구현 가이드 D9) 문구·하루 표시 모양의 단일 출처.
 * 상태는 글자 + 모양을 함께 쓴다 — 색만으로 구분하지 않는다. 색은 `globals.css` 토큰만(새 색 없음).
 */
import type { ChallengeDayState } from '@/types/challenge'

export interface DayViewMeta {
  /** 모양 글자(예정은 빈 칸, 일부는 `half` 그림이라 빈 칸). */
  glyph: string
  /** 일부 — 글자 대신 `parts.tsx` `PartialMark`(반원 그림)를 그린다. 반원 글자(U+25D0)는 기기 글꼴에 따라 점·빈 네모로 보인다. */
  half?: true
  /** 한 단어 이름 — 띠·시트·화면 읽기에 같은 말을 쓴다. */
  word: string
  /** 모양 원의 바탕·글자·테(토큰만). */
  cls: string
}

export const DAY_VIEW: Record<ChallengeDayState, DayViewMeta> = {
  MET: { glyph: '✓', word: '달성', cls: 'bg-good-soft text-good' },
  PARTIAL: { glyph: '', half: true, word: '일부', cls: 'bg-warn-soft text-ink' },
  MISSED: { glyph: '✕', word: '놓침', cls: 'bg-surface text-ink2 shadow-[inset_0_0_0_1.5px_var(--color-ink3)]' },
  TODAY: { glyph: '·', word: '오늘', cls: 'bg-surface text-ink shadow-[inset_0_0_0_2px_var(--color-accent)]' },
  UPCOMING: { glyph: '', word: '예정', cls: 'bg-surface2 text-ink2' },
  STOPPED: { glyph: '–', word: '그만둠', cls: 'bg-surface2 text-ink2' },
}

/** 날짜 띠 아래 범례(그 챌린지에 있는 상태만, 이 순서로). 일부의 반원 모양은 `DayStrip` 이 글 앞에 그림으로 붙인다. */
export const STRIP_LEGEND: Record<ChallengeDayState, string> = {
  MET: '✓ 달성 = 목표를 다 함',
  PARTIAL: '일부 = 하나만 하거나 단어를 덜 풂',
  MISSED: '✕ 놓침',
  TODAY: '오늘',
  UPCOMING: '예정',
  STOPPED: '– 그만둠 — 달성률에 넣지 않음',
}
export const STATE_ORDER: ChallengeDayState[] = ['MET', 'PARTIAL', 'MISSED', 'TODAY', 'UPCOMING', 'STOPPED']

export const TODAY_HREF = '/study/today'
export const DRAFT_KEY = 'kaiwa.challenge.draft'
export const FLASH_KEY = 'kaiwa.challenge.flash'

export const COPY = {
  // 계획표 카드
  cardLoading: '챌린지를 불러오는 중…',
  cardErrorTitle: '챌린지를 불러오지 못했어요.',
  cardErrorBody: '달력은 그대로 볼 수 있어요.',
  retry: '다시 시도',
  detailLink: '자세히 ›',
  todayTasks: '오늘 할 일',
  firstDayTasks: '첫날 할 일 · 내일',
  tomorrowHead: '챌린지 · 내일 시작',
  lastDayHead: ' · 오늘 자정에 마감돼요',
  metTitle: '오늘 목표 달성!',
  metBodyLast: '오늘 자정에 결과가 저장돼요.',
  metBody: (streak: number) => `수행 연속 ${streak}일째예요. 내일도 이어 가요.`,
  shortMemo: '세트를 일찍 끝냈어도 괜찮아요. 오늘 탭에서 한 세트 더 풀면 오늘 푼 장수에 합쳐서 계산해요.',
  lastDayMemo: '세트는 시작한 날로, 수업은 끝낸 날로 기록돼요 — 자정을 넘겨 끝낸 세트는 이 챌린지에 들어가지 않아요.',
  startHead: '챌린지',
  startTitle: '주제 하나로 매일 조금씩',
  startBody: '주제를 하나 고르고 7·14·30일 중 기간을 정하면, 매일 그 주제로 단어를 풀고 회화 수업을 해요. 얼마나 잘 하고 있는지는 여기서 보여 드려요.',
  startCta: '챌린지 시작',
  historyLink: '챌린지 기록 보기',
  endedKeep: '기록은 그대로 남아요',
  retryChallenge: '다시 도전',
  seeResult: '결과 보기',
  otherTopic: '다른 주제로 시작',
  attendHint: '앱을 연 날',
  flash: '챌린지를 시작했어요 · 오늘 탭에서 첫 과제를 해요',
  // 달력·하루 시트
  dayLineGo: '챌린지 ›',
  dayLineKeep: '기록을 지워도 챌린지 달성·통계는 그대로예요.',
  legendBand: '챌린지 기간',
  legendMet: '목표 달성',
  legendPartial: '일부',
  legendMissed: '놓침',
  // 상세
  loading: '챌린지를 불러오는 중…',
  errorTitle: '챌린지를 불러오지 못했어요.',
  errorBody: '잠시 뒤 다시 시도해 주세요.',
  notFound: '챌린지를 찾을 수 없어요 · 주소가 바뀌었거나 이 계정의 챌린지가 아니에요.',
  toPlan: '계획표로',
  toList: '챌린지 기록으로',
  stripTitle: '날짜별',
  scoreTitle: '문제 점수 추이',
  scoreNote: '수업은 5문제 중 맞힌 수, 단어는 그날 세트 합계예요.',
  totalsTitle: '이 챌린지에서 지금까지',
  rulesSummary: '챌린지는 이렇게 계산해요',
  /** 규칙 첫 줄 — `before` 와 `after` 사이에 일부 반원 그림이 들어간다. */
  ruleLegend: { before: '✓ 달성 = 하루 목표를 다 채운 날 · ', after: '일부 = 하나만 했거나 단어를 덜 푼 날 · ✕ 놓침 = 아무것도 안 한 날.' },
  endBtn: '그만두기',
  endNote: '그만두면 되돌릴 수 없어요. 지금까지 기록은 그대로 남아요.',
  topicNote: '이 주제 실력을 보는 거라 챌린지 전에 공부한 것도 함께 계산해요.',
  aiWordHelp: '새 단어는 날마다 새로 나와요 — 다시 풀기·복습 수업으로 익혀요',
  removed: '주제가 지워져 이 챌린지 기록을 계산할 수 없어요',
  // 그만두기
  endTitle: '챌린지를 그만둘까요?',
  endBusy: '그만두는 중…',
  keepGoing: '계속하기',
  endFail: '그만두지 못했어요. 연결을 확인하고 다시 눌러 주세요.',
  endDone: '챌린지를 그만뒀어요. 기록은 그대로 남아요.',
  endAlready: '이미 기간이 끝난 챌린지예요',
  // 결과
  resultKeep: '이 결과는 챌린지가 끝날 때 한 번 저장돼요. 기록을 지워도 바뀌지 않아요.',
  nextTitle: '다음 챌린지',
  nextBody: '같은 주제로 한 번 더 하거나, 다음 주제로 넘어가 보세요.',
  otherTopicShort: '다른 주제로',
  seeActive: '진행 중 챌린지 보기 ›',
  doneTitle: '해낸 것',
  prestopEmpty: '시작하기 전에 그만둬서 기록이 없어요.',
  // 기록
  listTitle: '챌린지 기록',
  listLoading: '챌린지 기록을 불러오는 중…',
  listError: '챌린지 기록을 불러오지 못했어요.',
  listEmpty: '아직 챌린지 기록이 없어요. 주제 하나를 골라 첫 챌린지를 시작해 보세요.',
  listNote: '진행 중인 챌린지를 먼저, 끝난 챌린지는 끝난 날짜 순서로 보여 드려요.',
  more: '더 보기',
  moreBusy: '불러오는 중…',
  moreFail: '더 불러오지 못했어요',
  // 하루 시트
  firstDay: '첫날이에요',
  lastDay: '마지막 날이에요',
  sheetGone: '원본이 지워졌어요',
  sheetGoneNote: '원본을 지워도 챌린지 기록(달성·맞힌 수)은 그대로예요.',
  sheetFrozen: '끝난 챌린지라 끝날 때 저장된 결과만 보여요.',
  sheetMissedNote: '괜찮아요. 다음 날 하루 목표를 채우면 수행 연속이 다시 시작돼요.',
  goToday: '오늘 탭에서 하기',
} as const

export const CREATE = {
  title: '챌린지 만들기',
  stepNames: ['주제', '기간', '목표', '확인'] as const,
  stepsLabel: '챌린지 만들기 4단계',
  backFirst: '계획표로',
  backPrev: '이전 단계로',
  next: '다음',
  start: '챌린지 시작',
  starting: '시작하는 중…',
  q1: '어떤 주제로 할까요?',
  q1Body: (levels: string) => `내 수준에 맞는 주제를 보여 드려요(${levels}). 챌린지 동안 매일 이 주제로 공부해요.`,
  topicLoading: '주제를 불러오는 중…',
  topicError: '주제를 불러오지 못했어요.',
  topicEmpty: '고를 수 있는 주제가 없어요.',
  needTopic: '주제를 먼저 골라 주세요',
  never: '아직 수업하지 않았어요',
  q2: '며칠 동안 할까요?',
  q2Body: (when: string) => `${when} 시작하면 끝나는 날이에요. 기간은 시작한 뒤 바꿀 수 없어요.`,
  lengths: [
    { days: 7, name: '7일', sub: '한 주 — 처음이라면 추천' },
    { days: 14, name: '14일', sub: '두 주' },
    { days: 30, name: '30일', sub: '한 달' },
  ] as const,
  q3: '하루에 무엇을 할까요?',
  q3Body: '고른 것을 다 끝낸 날이 ‘달성’이에요. 하나만 골라도 돼요.',
  wordsName: (n: number) => `오늘의 단어 하루 ${n}장`,
  wordsBody: (topic: string) => `AI 가 매일 「${topic}」 새 단어를 만들어 카드로 풀어요 · 만들지 못한 날은 주제 표현으로 풀어요`,
  wordsRule: (accept: string) => `${accept} · 세트를 나눠 풀어도 합쳐서 계산해요 · 건너뛴 카드는 포함하지 않아요`,
  lessonName: '오늘의 회화 1개',
  lessonBody: (topic: string) => `「${topic}」 수업을 하루 1개 끝내요 · 약 15분 · 문제 점수와 상관없이 끝내면 완료`,
  lessonRule: '오늘 탭 회화 카드에서 [오늘 수업 만들기]를 한 번 누르면 만들어요(1분쯤)',
  countLabel: '하루 단어 장수 · 세트도 이 장수로 만들어요',
  startLabel: '시작하는 날',
  todayMemo: '오늘 시작하면, 만들기 전에 오늘 끝낸 같은 주제 공부도 오늘(1일째) 기록으로 인정돼요.',
  needGoal: '하루 목표를 하나 이상 골라 주세요.',
  q4: '이렇게 시작할까요?',
  rowName: '이름',
  rowTopic: '주제',
  rowLength: '기간',
  rowGoal: '하루 목표',
  firstTasks: (when: string) => `${when} 할 일 · 1일째`,
  rulesTitle: '이렇게 계산해요',
  rules: [
    '같은 주제면 오늘 탭 어디서 공부해도 인정돼요.',
    '하루 목표를 다 채운 날이 ‘달성’, 일부만 한 날은 ‘일부’예요.',
    '단어는 하루에 푼 장수를 합쳐서 계산해요 — 세트를 일찍 끝냈으면 한 세트 더 풀어 채울 수 있어요.',
    '진행 중인 챌린지는 하나뿐이에요. 바꾸려면 그만두고 새로 시작해요.',
  ] as const,
  activeTitle: '이미 진행 중인 챌린지가 있어요',
  activeBody: '챌린지는 한 번에 하나만 할 수 있어요. 새로 시작하려면 그 챌린지를 그만둔 뒤 다시 만들어 주세요.',
  seeActive: '진행 중 챌린지 보기',
  overTitle: '이 장수로는 만들 수 없어요',
  overBody: (topic: string, pool: number, n: number) => `「${topic}」 기본 표현이 ${pool}개라 하루 ${n}장은 고를 수 없어요. 장수를 줄여 주세요.`,
  overBtn: '장수 다시 고르기',
  topicGoneTitle: '이 주제를 찾을 수 없어요',
  topicGoneBody: '주제가 지워졌거나 바뀌었어요. 주제를 다시 골라 주세요.',
  topicGoneBtn: '주제 다시 고르기',
  failed: '챌린지를 만들지 못했어요. 연결을 확인하고 다시 눌러 주세요.',
  rateLimited: '오늘은 챌린지를 여러 번 만들어서 더 만들 수 없어요. 내일 다시 만들어 주세요.',
  againLoading: '지난 챌린지를 불러오는 중…',
  againFail: '지난 챌린지를 불러오지 못해 처음부터 골라요',
  previewMore: (n: number) => `외 ${n}개 · 수업을 하면 늘어나요`,
} as const
