/**
 * 상황 역할극 B3 화면 문구의 단일 출처 — 결과 화면(가이드 §3-G) · 수업 종료 카드(§3-I) · 회화 목록 뱃지(§3-J).
 * `scenarioCopy.ts`(B1·B2 공용)와 나눈 것은 B2 가 같은 파일을 동시에 고치기 때문이다. 결과 제목은 `OUTCOME_KO`(서버와 같은 말)를 그대로 쓴다.
 * 엔진·모델 이름은 넣지 않는다("선생님"으로만).
 */

export const RESULT = {
  barTitle: '역할극 결과',
  back: '시나리오로',
  subtitle: (name: string, date: string) => (date ? `${name} · ${date}` : name),
  loadingSr: '결과를 불러오는 중…',
  error: '결과를 불러오지 못했어요.',
  goneTitle: '이 결과를 찾을 수 없어요.',
  goneBtn: '시나리오로',
  notEndedTitle: '아직 마치지 않은 역할극이에요.',
  notEndedBtn: '역할극으로 돌아가기',
  verdictAria: '판정',
  rowTutor: '선생님 판단',
  tutorYes: '목표를 이뤘어요 ✓',
  tutorNo: '아직이에요',
  tutorNone: '판단 전에 마쳤어요',
  rowComm: '뜻 전달',
  commYes: '잘 통했어요 ✓',
  commNo: '조금 막혔어요',
  commNone: '—',
  rowExpr: '핵심 표현',
  exprValue: (used: number, total: number, required: number, ok: boolean) => `${used}/${total} · ${required}개 이상 ${ok ? '✓' : '필요'}`,
  rowSteps: '대화 순서',
  stepsProgress: (reached: number, total: number) => `${reached}/${total}단계`,
  almostNote: (more: number) => `선생님은 목표를 이뤘다고 봤어요. 핵심 표현을 ${more}개만 더 쓰면 달성이에요.`,
  unjudgedNote: '선생님이 마무리하기 전에 마쳐서 표현으로만 판단했어요. 다음엔 선생님이 마무리할 때까지 이어 가 보세요.',
  usedTitle: '쓴 표현',
  usedNone: '이번엔 핵심 표현을 쓰지 않았어요',
  missedTitle: '다음엔 이 표현도 써 보세요',
  stats: (turns: number, hints: number, self: number) => `내 말 ${turns}번 · 힌트 ${hints}번 · 스스로 고침 ${self}번`,
  pending: (n: number) => `채택을 기다리는 교정 ${n}개 · 대화에서 보기 ›`,
  nextLabel: '다음 상황',
  nextBtn: '다음 상황',
  retry: '다시 해 보기',
  retrying: '시작하는 중…',
  pickOther: '다른 상황 고르기',
  home: '시나리오로',
  recordAchieved: '목표 달성으로 기록했어요. 이 상황은 선생님이 3~7일 안에 다시 권해 드려요.',
  recordNotYet: '‘아직’으로 기록했어요. 선생님이 곧 다시 권해 드려요.',
  retryFail: '역할극을 시작하지 못했어요.',
  retryRate: '잠시 뒤 다시 눌러 주세요.',
  retryGone: '지금은 열 수 없는 상황이에요. 다른 상황을 골라 주세요.',
} as const

export const LESSON = {
  kicker: '배운 표현으로 바로 말해 보기',
  title: (title: string) => `상황 역할극 · ${title}`,
  /** `tutor` 는 쉼표 앞(조사 없음), `learnerWithJosa` 는 `josa(learner,'이','가')`. */
  roles: (tutor: string, learnerWithJosa: string) => `선생님이 ${tutor}, 내가 ${learnerWithJosa} 돼요 · 약 5분.`,
  overlapBefore: ' 오늘 배운 ',
  overlapSep: ' · ',
  /** 마지막 「」 뒤 조사 + 나머지 — 조사는 `jaSubjectJosa`. */
  overlapAfter: (josaText: string) => `${josaText} 핵심 표현에 들어 있어요.`,
  start: '역할극 해 보기',
} as const

export const LIST = {
  rolePlay: '역할극',
  ended: '마침',
} as const
