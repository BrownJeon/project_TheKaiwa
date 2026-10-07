/**
 * 상황 역할극 화면 문구의 단일 출처(task-010d B — designer 구현 가이드 §3-B·§3-C·§3-H·§4). 화면 파일에 문구를 직접 쓰지 않는다.
 * 숫자가 든 문구는 서버 한도(`SCENARIO_LIMITS`, A3a)를 그대로 받는다 — 가이드의 화면 제안값과 다르면 서버 값이 정본이다.
 * 엔진·모델 이름은 넣지 않는다("선생님"으로만).
 */
import type { ScenarioOutcome, ScenarioRecommendReason } from '@/types/scenario'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import { SCENARIO_VARIANT_AXIS_LABELS, SCENARIO_VARIANT_NO_CHANGE_MESSAGE, SCENARIO_VARIANT_NOTE_MAX } from '@/types/scenarioVariant'

export const SCENARIO_HOME_HREF = '/study/ai?tab=scenario'
export const SCENARIO_NEW_HREF = '/study/ai/scenario/new'
/** 편집 화면에 들어온 곳 — 관리 화면(`/settings/scenarios`)이면 뒤로·저장 뒤 돌아갈 곳이 관리 화면 상황 탭이다(S11). */
export type DraftFrom = 'manage' | null
export const parseDraftFrom = (v: unknown): DraftFrom => (v === 'manage' ? 'manage' : null)
export const scenarioEditHref = (id: string, from: DraftFrom = null) => `/study/ai/scenario/${encodeURIComponent(id)}/edit${from === 'manage' ? '?from=manage' : ''}`
export const scenarioVariantHref = (id: string, from: DraftFrom = null) => `/study/ai/scenario/${encodeURIComponent(id)}/variant${from === 'manage' ? '?from=manage' : ''}`
export const scenarioSheetHref = (id: string, saved = false) => `${SCENARIO_HOME_HREF}&sc=${encodeURIComponent(id)}${saved ? '&saved=1' : ''}`
/** 관리 화면 상황 탭(T5-1 딥링크 `?tab=scenarios&sc=`) — topic 폴더를 import 하지 않으려고 주소만 같은 값으로 둔다. */
export const MANAGE_SCENARIOS_HREF = '/settings/scenarios?tab=scenarios'
export const manageSheetHref = (id: string, saved = false) => `${MANAGE_SCENARIOS_HREF}&sc=${encodeURIComponent(id)}${saved ? '&saved=1' : ''}`
/** 들어온 곳에 맞춘 돌아갈 곳·시트 주소·뒤로 이름표. */
export const draftReturn = (from: DraftFrom) =>
  from === 'manage'
    ? { backHref: MANAGE_SCENARIOS_HREF, sheetHref: manageSheetHref, backLabel: DRAFT.backManage }
    : { backHref: SCENARIO_HOME_HREF, sheetHref: scenarioSheetHref, backLabel: DRAFT.back }
export const talkRoomHref = (chatId: string) => `/study/ai/talk/${encodeURIComponent(chatId)}`
/** 역할극 결과 화면(B3 가 페이지를 만든다 — 결과는 #29 로 읽는다, 첫 그림 보관 없음 — REV-141 L-3). */
export const rolePlayResultHref = (chatId: string) => `${talkRoomHref(chatId)}/result`

/** AI 초안 자동 보관(이 탭에서만 — sessionStorage). */
export const DRAFT_STORE_KEY = 'kaiwa.scenario.draft'
/**
 * 역할극 방 — 표현 체크 숨김(이 탭 동안)·대답 연습 마지막 방식 · 그만두기 안내 한 번(`quitDone` — 방이 쓰고 나가면 시나리오 홈이 읽고 바로 지운다,
 * 방 토스트는 방과 함께 사라지므로 — REV-141 L-4).
 */
export const ROOM_STORE = { checksHidden: 'kaiwa.rp.checksHidden', practiceMode: 'kaiwa.rp.practiceMode', quitDone: 'kaiwa.rp.quitDone' } as const

/** 결과 문구(서버 `OUTCOME_KO` 와 같은 말). */
export const OUTCOME_KO: Record<ScenarioOutcome, string> = {
  ACHIEVED: '목표를 달성했어요',
  ALMOST: '거의 다 왔어요',
  NOT_YET: '아직 목표 전이에요',
}

/** 추천 이유 코드 → 카드 한 줄. 모르는 코드면 줄을 숨긴다. */
export const RECOMMEND_REASON_KO: Record<ScenarioRecommendReason, string> = {
  RETRY_NOT_YET: '지난번엔 목표 전이었어요 · 다시 해 볼 때예요',
  NEXT_IN_TOPIC: '오늘 수업한 주제의 다음 상황이에요',
  NEW_EASY: '아직 안 해 본 쉬운 상황이에요',
  REVIEW_DUE: '다시 해 볼 때가 됐어요',
}

export const HOME = {
  create: '＋ 내 상황 만들기',
  intro: '상황 카드를 고르면 선생님이 상대 역할을 맡아요. 나는 목표를 이루며 말해요.',
  recoTitle: '추천 상황',
  recoSub: '내 기록으로 골랐어요',
  placeAria: '장소',
  chipAll: '전체',
  chipMine: (n: number) => `내 상황 ${n}`,
  groupMine: '내 상황',
  groupOther: '다른 상황',
  groupCount: (n: number) => `${n}개`,
  loadingSr: '상황을 불러오는 중…',
  error: '상황을 불러오지 못했어요.',
  emptyTitle: '아직 고를 수 있는 상황이 없어요',
  emptyBody: '내 상황을 만들어 연습해 보세요.',
  mineEmptyTitle: '아직 만든 상황이 없어요',
  mineEmptyBody: '하고 싶은 상황을 적으면 선생님이 대화 순서와 핵심 표현을 넣은 초안을 만들어 드려요.',
  deleted: '지웠어요',
} as const

export const CARD = {
  mine: '내 상황',
  first: '처음 해 봐요',
  achieved: '목표 달성 ✓',
  almost: '거의 다 왔어요',
  tried: '해 봤어요',
  notYet: '아직 목표 전',
  notYetOn: (date: string) => `아직 목표 전 · ${date}`,
  inProgress: '이어서 할 수 있어요',
  goal: (goalKo: string) => `목표 · ${goalKo}`,
  steps: (n: number) => `${n}단계`,
  difficulty: '난이도',
  difficultySr: (d: number) => `난이도 5단계 중 ${d}`,
} as const

export const SHEET = {
  title: '상황 역할극',
  saved: '내 상황에 저장했어요',
  fromLessonBefore: '오늘 수업 「',
  fromLessonAfter: '」에서 이어서 해요.',
  mineBadge: '내 상황',
  rolesAria: '역할',
  me: '나',
  tutor: '선생님',
  goalLabel: '목표',
  successLabel: '이렇게 되면 성공이에요',
  stepsTitle: '대화 순서',
  stepsSub: (n: number) => `${n}단계 · 선생님이 이 순서로 이끌어요`,
  exprTitle: (n: number) => `핵심 표현 ${n}개`,
  exprSub: (n: number, m: number, voice: boolean) => `${n}개 중 ${m}개 이상 쓰면 표현 조건을 채워요.${voice ? ' ▶ 로 먼저 들어 보세요.' : ''}`,
  exprListen: (ja: string) => `${ja} 듣기`,
  exprStop: (ja: string) => `${ja} 멈추기`,
  exprLoading: (ja: string) => `${ja} 소리를 불러오는 중, 누르면 취소`,
  textOnly: '지금은 선생님 목소리를 들을 수 없어요(자막만). 역할극은 글자로 진행돼요.',
  prev: (date: string, outcome: string, used: number, total: number) => `지난번 ${date} · ${outcome} · 핵심 표현 ${used}/${total}`,
  leadOpening: (tutorWithJosa: string) => `선생님이 ${tutorWithJosa} 되어 먼저 말을 걸어요. 틀린 말은 힌트를 먼저 드리고, 다시 말해 보게 해요.`,
  leadNoOpening: (tutorWithJosa: string, learnerWithJosa: string) =>
    `선생님이 ${tutorWithJosa} 돼요. ${learnerWithJosa} 되어 먼저 말을 걸어 보세요. 틀린 말은 힌트를 먼저 드리고, 다시 말해 보게 해요.`,
  edit: '고치기',
  delete: '지우기',
  deleteTitle: '이 상황을 지울까요?',
  deleteBody: '목록에서 사라져요. 이 상황으로 한 역할극과 기록은 그대로 남아요.',
  deleteConfirm: '지우기',
  deleting: '지우는 중…',
  deleteCancel: '취소',
  deleteFail: '지우지 못했어요. 다시 시도해 주세요.',
  start: '역할극 시작',
  starting: '시작하는 중…',
  close: '닫기',
  resume: '이어서 하기',
  restart: '처음부터 새로',
  /** 하던 역할극의 날짜는 목록 응답에 없다(`inProgressChatId` 만) — 날짜 없이 말한다. */
  resumeNote: '하던 역할극이 있어요. 새로 하면 그 대화는 회화 목록에 남아요.',
  startFail: '역할극을 시작하지 못했어요. 다시 눌러 주세요.',
  startRate: '잠시 뒤 다시 눌러 주세요.',
  archived: '지금은 열 수 없는 상황이에요. 다른 상황을 골라 주세요.',
  loadingSr: '상황을 불러오는 중…',
  error: '상황을 불러오지 못했어요.',
  goneTitle: '이 상황을 찾을 수 없어요',
  goneBody: '더 이상 쓰지 않는 상황이에요. 다른 상황을 골라 주세요.',
  goneBtn: '다른 상황 고르기',
  retry: '다시 시도',
  /** S10 출처 뱃지(내 상황은 `mineBadge`). */
  badgeSeed: '기본',
  badgeCopy: '✎ 내 버전',
  /** S10 행동 줄 — 변형 상황 만들기(A). 변형으로 저장한 상황은 따로 표시하지 않는다(Leader L-2). */
  variant: '변형 만들기',
  /** S10 기본 상황 [지우기] = 나에게서 숨기기(데모 v2 S10 `seeddel`). */
  hideTitle: '이 상황을 지울까요?',
  hideBodyStrong: '기본 상황이라 나에게만 숨겨져요. 기본으로 되돌릴 수 있어요.',
  hideBodyRest: '이 상황으로 한 역할극과 기록은 그대로 남아요.',
  hideConfirm: '나에게서 숨기기',
  hiding: '숨기는 중…',
  hidden: (title: string) => `「${title}」 상황을 숨겼어요`,
  /** S10 내 버전 [기본으로 되돌리기](#176). */
  revert: '기본으로 되돌리기',
  revertTitle: '기본 상황으로 되돌릴까요?',
  revertBody: '내가 고친 내용은 목록에서 빠지고 기본 상황이 다시 보여요. 내 버전으로 한 역할극 기록은 그대로 남아요.',
  revertConfirm: '기본으로 되돌리기',
  reverting: '되돌리는 중…',
  reverted: '기본 상황으로 되돌렸어요',
} as const

export const DRAFT = {
  back: '시나리오로',
  backManage: '내 상황·주제로',
  titleNew: '내 상황 만들기',
  titleEdit: '내 상황 고치기',
  /** S11 기본 상황 고치기(데모 v2 S11 `seed`). */
  titleEditSeed: '상황 고치기',
  seedInfoStrong: '기본 상황이에요.',
  seedInfo: '고쳐서 저장하면 내 버전으로 바뀌고, 언제든 기본으로 되돌릴 수 있어요.',
  saveSeed: '내 버전으로 저장',
  copied: '다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요.',
  openCopy: '내 버전 열기',
  openingCopy: '여는 중…',
  askTitle: '어떤 상황을 연습하고 싶어요?',
  askBody: '장소와 하고 싶은 말을 한국어나 일본어로 적어 주세요. 선생님이 대화 순서와 핵심 표현을 넣은 초안을 만들어 드려요. 마음에 들게 고친 뒤 저장하면 돼요.',
  descLabel: '상황 설명',
  descPlaceholder: '예: 편의점에서 계산할 때 봉투가 필요한지, 포인트 카드가 있는지 물어봐요',
  descCount: (n: number) => `${n}/${L.descriptionMax}`,
  descTooLong: `상황 설명은 ${L.descriptionMax}자까지 쓸 수 있어요.`,
  examplesLabel: '이렇게 적어 볼 수 있어요',
  examples: ['호텔에 체크인하기', '병원 접수하기', '편의점에서 계산하기'] as readonly string[],
  placeLabelAsk: '장소 (선택)',
  placeLabel: '장소',
  placeNone: '고르지 않음',
  placesFail: '장소를 불러오지 못했어요 — 장소 없이 만들 수 있어요',
  levelLabel: '수준',
  generate: '초안 만들기',
  descMin: 5,
  tooShort: '상황을 조금 더 적어 주세요(5자 이상)',
  askNote: '초안은 저장하기 전까지 어디에도 남지 않아요.',
  genTitle: '선생님이 초안을 만들고 있어요',
  genBody: '대화 순서와 핵심 표현을 고르는 중이에요',
  genLong: '조금 오래 걸리고 있어요',
  genCancel: '그만두기',
  genFail: '초안을 만들지 못했어요. 다시 시도해 주세요.',
  gen422: '이 내용으로는 회화 상황을 만들기 어려워요. 장소와 하고 싶은 말을 조금 더 적어 주세요.',
  retry: '다시 시도',
  editNoteTitle: '선생님이 만든 초안이에요',
  editNoteBody: '고친 뒤 [저장]해야 내 상황 목록에 생겨요. 저장하기 전에는 아무것도 남지 않아요.',
  editExistingNote: '고친 내용은 다음 역할극부터 쓰여요. 지난 결과는 그대로예요.',
  fTitle: '제목',
  fTitleJa: '일본어 제목',
  fRoles: '역할',
  fLearner: '나',
  fTutor: '선생님',
  fGoal: '목표',
  fSteps: '대화 순서',
  fCriteria: '이렇게 되면 성공이에요',
  fExpressions: '핵심 표현',
  stepAdd: '＋ 단계 더하기',
  stepMax: `${L.stepsMax}단계까지 넣을 수 있어요`,
  stepMin: `대화 순서는 ${L.stepsMin}단계 이상이어야 해요`,
  stepMenu: (n: number) => `${n}번째 단계 메뉴`,
  criterionAdd: '＋ 조건 더하기',
  criterionMax: `성공 조건은 ${L.successCriteriaMax}개까지 넣을 수 있어요`,
  criterionMin: `성공 조건은 ${L.successCriteriaMin}개 이상이어야 해요`,
  criterionMenu: (n: number) => `${n}번째 조건 메뉴`,
  menuTitle: (label: string, n: number) => `${label} ${n}번째`,
  moveUp: '위로 옮기기',
  moveDown: '아래로 옮기기',
  remove: '지우기',
  exprAdd: '＋ 표현 더하기',
  exprMax: `핵심 표현은 ${L.expressionsMax}개까지 넣을 수 있어요`,
  exprMin: `핵심 표현은 ${L.expressionsMin}개 이상이어야 해요`,
  exprMenu: (n: number) => `${n}번째 표현 메뉴`,
  exprEdit: '고치기',
  exprJa: '일본어',
  exprKo: '뜻',
  exprInsert: '넣기',
  exprApply: '바꾸기',
  cancel: '취소',
  exprNote: (m: number) => `이 중 ${m}개 이상 쓰면 표현 조건을 채워요.`,
  save: '저장',
  saving: '저장하는 중…',
  regen: '다시 만들기',
  discard: '버리기',
  leaveEdit: '고치지 않고 나가기',
  /** 문제가 첫마디 하나뿐이면 「· 선생님 첫마디」를 붙인다(데모 v2 S11 `opBlock`). */
  invalidSummary: (n: number, openingOnly = false) => `고칠 곳이 ${n}군데 있어요${openingOnly ? ' · 선생님 첫마디' : ''}`,
  saveFail: '저장하지 못했어요. 고친 내용은 그대로 있어요. 다시 눌러 주세요.',
  regenConfirm: '고친 내용이 사라지고 새 초안으로 바뀌어요.',
  regenConfirmBtn: '새로 만들기',
  discardTitle: '초안을 버릴까요?',
  discardBody: '저장하지 않은 초안은 되돌릴 수 없어요.',
  discardConfirm: '버리기',
  discardKeep: '계속 고치기',
  edit404: '이 상황은 고칠 수 없어요.',
  loadError: '상황을 불러오지 못했어요.',
  loadingSr: '상황을 불러오는 중…',
  restoreTitle: (title: string) => (title ? `고치던 초안이 있어요 · ${title}` : '고치던 초안이 있어요'),
  restoreContinue: '이어서 고치기',
  restoreNew: '버리고 새로 만들기',
} as const

/**
 * 변형 상황 만들기 A(screens.md §16-2 A·§16-6 `VARIANT`). 축 이름·칩 라벨은 여기에 복사하지 않는다 — `types/scenarioVariant.ts` 단일 출처.
 * 표현 수준 칩만 화면이 수준 글자를 덧붙인다(「그대로(N5)」·「한 단계 위(N4)」).
 */
export const VARIANT = {
  title: '변형 상황 만들기',
  baseHead: '원본 상황',
  baseMeta: (learner: string, tutor: string, level: string) => `나 ${learner} · 선생님 ${tutor} · ${level}`,
  ask: '무엇을 바꿔 볼까요?',
  askSub: '하나 이상 골라 주세요. 고르지 않은 것은 원본 그대로예요.',
  levelSame: (l: string) => `${SCENARIO_VARIANT_AXIS_LABELS.level.options.same}(${l})`,
  levelUp: (l: string) => `${SCENARIO_VARIANT_AXIS_LABELS.level.options.up}(${l})`,
  levelTop: '이미 가장 높은 수준이라 올릴 수 없어요.',
  note: '직접 적기(선택)',
  notePlaceholder: '예: 상대가 처음에 내 말을 못 알아들어요',
  noteCount: (n: number) => `${n}/${SCENARIO_VARIANT_NOTE_MAX}`,
  noteTooLong: `직접 적기는 ${SCENARIO_VARIANT_NOTE_MAX}자까지 쓸 수 있어요.`,
  submit: '변형 초안 만들기',
  /** 서버 422 `NO_VARIATION` 과 같은 글(화면이 먼저 막는다). */
  noChange: SCENARIO_VARIANT_NO_CHANGE_MESSAGE,
  gen: '선생님이 변형 상황 초안을 만들고 있어요',
  genSub: '보통 10~20초 걸려요.',
  genLong: '조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요.',
  cancel: '그만두기',
  reviewTitle: '변형 초안이 왔어요',
  /** 검토 안내 첫 줄(데모 v2 `:957`) — `{labels}` 는 실제로 바뀐 축의 칩 글자를 ` · ` 로 이은 것(`variantLogic.variantReviewBody`). */
  reviewChanged: (labels: string) => `바꾼 것 · ${labels}.`,
  /** 데모 v2 `:957` 둘째·셋째 문장 — 「원본은 그대로예요」는 변형이 새 상황 한 행이라 원본이 바뀌지 않는다는 뜻. */
  reviewBody: '「바뀜」 칸을 확인하고 [새 상황으로 저장]해야 생겨요. 원본은 그대로예요.',
  changed: '바뀜',
  changedSr: '원본에서 바뀌었어요',
  save: '새 상황으로 저장',
  saveNote: '새 상황은 내 상황 50개·하루 만들기 30번에 들어가요.',
  regen: '다시 만들기',
  baseGone: '원본 상황을 찾을 수 없어요. 지웠거나 내 목록에서 숨긴 상황이에요.',
  unfit: '이 내용으로는 변형 상황을 만들기 어려워요. 바꿀 점을 다르게 적어 주세요.',
  busy: '다른 화면에서 변형 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.',
  rate: (s: number) => `변형 초안은 1분에 6번까지 만들 수 있어요. ${s}초 뒤 다시 눌러 주세요.`,
  fail: '잠시 문제가 생겼어요. 다시 만들어 볼까요?',
} as const

/** 역할극 회화방(가이드 §3-D) — 머리·목표 카드·첫 안내·마무리 띠·마친 뒤 바·메뉴 한 줄. */
export const ROOM = {
  back: '시나리오로',
  roleTag: (tutor: string) => `${tutor} 역`,
  srTitle: (title: string) => `, 상황 역할극: ${title}`,
  end: '마치기',
  endWhileLoading: '역할극이 열린 뒤에 마칠 수 있어요',
  endWhileTurn: '선생님 대답이 끝나면 마칠 수 있어요',
  endWhileListening: '말하는 중에는 마칠 수 없어요',
  goalTag: '목표',
  summaryEnded: '마침',
  summaryChecksHidden: (total: number) => `표현 ${total}개`,
  summaryExpr: (used: number, total: number) => `표현 ${used}/${total}`,
  summarySteps: (steps: number, expr: string) => `${steps}단계 · ${expr}`,
  summaryStepAt: (at: number, steps: number, expr: string) => `${at}/${steps}단계 · ${expr}`,
  me: '나',
  tutor: '선생님',
  stepsTitle: '대화 순서',
  stepDoneSr: '끝남',
  stepNowSr: '지금',
  exprCount: (used: number, total: number) => `${used}/${total}`,
  exprNeed: (m: number) => ` · ${m}개 이상 쓰면 돼요`,
  exprHiddenNote: (m: number) => `${m}개 이상 · 쓴 표현은 끝나고 보여 드려요`,
  checksHidden: '체크 숨김',
  checksShown: '체크 보기',
  usedSr: ', 썼어요',
  usedAnnounce: (ja: string) => `「${ja}」 썼어요`,
  stepAnnounce: (ko: string) => `다음 단계: ${ko}`,
  fromLesson: (title: string) => `오늘 수업 「${title}」에서 이어져요.`,
  /** 시스템 줄 "선생님은 <b>{tutor}</b>, 나는 <b>{learner}</b>{이에요/예요}." — 굵은 글자 사이 조각. */
  sysPre: '선생님은 ',
  sysMid: ', 나는 ',
  sysFirst: '선생님이 먼저 말을 걸어요.',
  introLead: (teacherWithTopic: string, tutor: string, learnerWithCopula: string) => `${teacherWithTopic} ${tutor}, 나는 ${learnerWithCopula}.`,
  introHowVoice: (learnerWithJosa: string) => `아래 버튼을 누른 채로 ${learnerWithJosa} 되어 먼저 말을 걸어 보세요.`,
  introHowText: (learnerWithJosa: string) => `${learnerWithJosa} 되어 아래 입력창에 먼저 말을 써 보세요.`,
  introTry: '이렇게 시작해 보세요:',
  textPlaceholder: (learnerWithRo: string) => `${learnerWithRo} 할 말을 일본어로 써 보세요 — 선생님이 역할로 대답해요`,
  menuNote: '역할극은 늘 코치 방식으로 교정해요 — 힌트를 먼저 드려요.',
  nudgeLead: '선생님이 목표를 이룬 것 같다고 해요.',
  nudgeAsk: ' 역할극을 마칠까요?',
  nudgeFinish: '마치고 결과 보기',
  nudgeMore: '조금 더 하기',
  nudgeMoreToast: '이어서 말해 보세요 · 다 되면 위의 [마치기]를 눌러요',
  endedTitle: '이 역할극은 마쳤어요',
  endedBody: '더 말하려면 다시 해 보세요.',
  endedResult: '결과 보기',
  endedRetry: '다시 하기',
  endedRetrying: '시작하는 중…',
  endedUnsent: '이미 마친 역할극이에요.',
} as const

/** 마치기 시트(가이드 §3-F). */
export const END = {
  confirmTitle: '역할극을 마칠까요?',
  confirmBody: '지금까지 나눈 대화로 선생님이 목표를 이뤘는지 판단해요. 마친 뒤에는 이 역할극에 더 말할 수 없어요.',
  badgeTurns: (n: number) => `내 말 ${n}번`,
  badgeExpr: (used: number, total: number) => `핵심 표현 ${used}/${total}`,
  badgeSteps: (at: number, total: number) => `${at}/${total}단계`,
  finish: '마치고 결과 보기',
  keepGoing: '계속하기',
  emptyTitle: '아직 한 마디도 하지 않았어요',
  emptyBody: '지금 그만두면 결과와 기록이 남지 않아요. 선생님 말에 한 마디만 대답해 봐도 좋아요.',
  quit: '그만두기',
  quitting: '그만두는 중…',
  quitDone: '역할극을 그만뒀어요',
  quitFail: '그만두지 못했어요. 다시 눌러 주세요.',
  busy: '선생님이 결과를 정리하고 있어요…',
  busyNote: '보통 몇 초면 끝나요',
  fail: '결과를 기록하지 못했어요. 대화는 저장돼 있어요.',
  retry: '다시 시도',
  later: '나중에 하기',
} as const

/** 대답 연습(가이드 §3-E). */
export const PRACTICE = {
  entry: '대답 연습',
  entrySub: '무엇을 말할지 막히면 눌러요',
  region: '대답 연습',
  modeAria: '연습 방식',
  modeChoose: '고르기',
  modeSay: '말하기',
  modeRepeat: '따라 하기',
  close: '대답 연습 닫기',
  noChoose: '이 말에는 고르기 연습이 없어요',
  loadingSr: '대답 예시를 만드는 중…',
  slow: '조금만 기다려 주세요',
  error: '대답 예시를 만들지 못했어요.',
  retry: '다시 시도',
  rate: '잠시 뒤 다시 눌러 주세요.',
  rateIn: (sec: number) => `${sec}초 뒤 다시 눌러 주세요.`,
  stale: '새 말이 와서 연습을 닫았어요',
  busy: '선생님 말이 끝나면 다시 눌러 주세요.',
  chooseLead: '빈칸에 들어갈 말을 골라 보세요',
  blankAria: '빈칸',
  chooseLegend: '빈칸에 들어갈 말',
  right: '✓ 맞아요',
  wrong: '다시 골라 보세요',
  rightNextVoice: '이제 이 문장을 말해 보세요 — 아래 버튼을 누른 채로.',
  sayLead: '이 뜻을 일본어로 말해 보세요',
  hint: '힌트',
  showAnswer: '정답 보기',
  sayHowVoice: '아래 버튼을 누른 채로 말해요',
  sayHowText: '입력창에 써서 보내요',
  repeatLead: '듣고 따라 말해 보세요',
  listen: '▶ 듣기',
  stop: '■ 멈춤',
  listenAria: '연습 문장 듣기',
  stopAria: '연습 문장 멈추기',
  loadingSound: '불러오는 중…',
  repeatHowVoice: '아래 버튼을 누른 채로 따라 말해요',
  fill: '입력창에 넣기',
} as const

/**
 * 상황 편집기 칸 이름표 — 조사를 미리 붙여 둔다(「을(를)」 병기 금지, screens.md §16-7 규칙 4). 화면 검사(`validateDraft`)와
 * 서버 400 문구(`failure.ts`)가 같은 표를 쓴다. `obj` = 을/를 · `top` = 은/는(단위 시험이 `josa()` 와 대조한다).
 */
export const FIELD_LABEL = {
  title: { noun: '제목', obj: '제목을', top: '제목은' },
  titleJa: { noun: '일본어 제목', obj: '일본어 제목을', top: '일본어 제목은' },
  description: { noun: '상황 설명', obj: '상황 설명을', top: '상황 설명은' },
  level: { noun: '수준', obj: '수준을', top: '수준은' },
  difficulty: { noun: '난이도', obj: '난이도를', top: '난이도는' },
  place: { noun: '장소', obj: '장소를', top: '장소는' },
  learner: { noun: '내 역할', obj: '내 역할을', top: '내 역할은' },
  tutor: { noun: '선생님 역할', obj: '선생님 역할을', top: '선생님 역할은' },
  goal: { noun: '목표', obj: '목표를', top: '목표는' },
  criterion: { noun: '성공 조건', obj: '성공 조건을', top: '성공 조건은' },
  step: { noun: '대화 순서', obj: '대화 순서를', top: '대화 순서는' },
  exprJa: { noun: '표현 일본어', obj: '표현 일본어를', top: '표현 일본어는' },
  exprKo: { noun: '표현 뜻', obj: '표현 뜻을', top: '표현 뜻은' },
  exprReading: { noun: '표현 읽기', obj: '표현 읽기를', top: '표현 읽기는' },
  expressions: { noun: '핵심 표현', obj: '핵심 표현을', top: '핵심 표현은' },
  openingKo: { noun: '선생님 첫마디', obj: '선생님 첫마디를', top: '선생님 첫마디는' },
  openingJa: { noun: '일본어 첫마디', obj: '일본어 첫마디를', top: '일본어 첫마디는' },
} as const
export type FieldLabelKey = keyof typeof FIELD_LABEL

/** 화면 검사·서버 칸 문구(같은 뜻이면 같은 글 — 서버 `message` 는 쓰지 않는다). */
export const CHECK = {
  required: (k: FieldLabelKey) => `${FIELD_LABEL[k].obj} 적어 주세요.`,
  tooLong: (k: FieldLabelKey, max: number) => `${FIELD_LABEL[k].top} ${max}자까지 쓸 수 있어요.`,
  angle: (k: FieldLabelKey) => `${FIELD_LABEL[k].noun}에 꺾쇠(< >)는 쓸 수 없어요.`,
  duplicate: '같은 표현이 두 번 들어 있어요.',
  listMin: (k: FieldLabelKey, min: number) => `${FIELD_LABEL[k].top} ${min}개 이상이어야 해요.`,
  listMax: (k: FieldLabelKey, max: number) => `${FIELD_LABEL[k].top} ${max}개까지 넣을 수 있어요.`,
  /**
   * 서버가 꺾쇠·링크 주소·숨은 글자를 `forbidden_char` 로 묶는다. 이 두 문구는 `topic/topicCopy.ts` `FAIL.field` 와 같은 글자여야 한다 —
   * 두 벌이 어긋나지 않게 `common/__tests__/copySync.test.ts` 가 맞춘다(앱 코드는 scenario → topic import 금지).
   */
  forbidden: '꺾쇠(< >)·링크 주소·눈에 보이지 않는 글자는 쓸 수 없어요.',
  secretLike: '비밀번호·카드 번호·긴 영문 숫자 키처럼 보이는 글은 쓸 수 없어요.',
  /** 첫마디 제안(#178)이 상황 정보 칸(제목·목표·역할 …)을 거절한 경우 — 어느 칸인지 말해 주고, 칸은 위 편집기에서 고친다. */
  unusableIn: (k: FieldLabelKey) => `${FIELD_LABEL[k].noun}에 쓸 수 없는 글이 있어요. 그 칸을 고친 뒤 다시 만들어 주세요.`,
  enumPick: '목록에서 골라 주세요.',
  noHangul: '한국어로 적어 주세요.',
  notLinked: '지금 목록에 없는 장소예요. 목록을 새로 고친 뒤 다시 골라 주세요.',
  /** 화면이 막았어야 할 모양 오류(`type`·`unknown_key`·`format` …) — 화면 결함. */
  defect: '저장하지 못했어요. 화면을 새로 고친 뒤 다시 해 주세요.',
} as const

/** 공유 편집기 첫마디(`OpeningField`, D5=A — screens.md §16-2·§16-6 `OPENING`). `{tutor}` 가 비면 괄호를 뺀다. */
const tutorRole = (tutor: string) => (tutor.trim() ? `선생님(${tutor.trim()} 역할)` : '선생님')
export const OPENING = {
  legend: '선생님 첫마디',
  koLabel: '한국어로 적어요',
  koHint: (tutor: string) => `역할극을 시작할 때 ${tutorRole(tutor)}이 나에게 먼저 건네는 말을 적어요. 비워 두면 첫마디 없이 내가 먼저 말을 걸어요.`,
  make: '일본어로 만들기',
  remake: '일본어 다시 만들기',
  retry: '다시 만들기',
  cancel: '그만두기',
  play: '일본어 첫마디 듣기',
  stopPlay: '일본어 첫마디 멈추기',
  matchedHead: '역할극에서 선생님이 이렇게 말해요',
  confirmRole: (tutor: string) => `${tutorRole(tutor)}이 먼저 건네는 말이 맞는지 확인해 주세요. 내가 할 말이면 첫마디가 아니라 대화 순서에 적어요.`,
  koOnlyHead: '역할극에서 선생님이 할 말(일본어)',
  koOnly: '아직 일본어가 없어요. 아래 [일본어로 만들기]를 눌러 주세요.',
  stale: '한국어를 고쳤어요. 일본어를 다시 만들어 주세요.',
  staleOld: '예전 한국어로 만든 일본어',
  genTitle: '선생님이 일본어로 바꾸고 있어요',
  genSub: (tutor: string, level: string) => `상황과 역할(${tutor.trim() || '선생님'})·수준(${level})에 맞춰요. 보통 3~5초 걸려요.`,
  empty: '첫마디가 없어요. 역할극에서는 내가 먼저 말을 걸어요.',
  needRoles: '역할을 먼저 적으면 일본어로 만들 수 있어요.',
  truncated: '일본어가 길어서 줄였어요. 뜻이 다 담겼는지 확인해 주세요.',
  problemStale: '저장하려면 일본어 첫마디를 다시 만들어 주세요.',
  problemKoOnly: '저장하려면 [일본어로 만들기]를 눌러 주세요.',
} as const

/** 서버 오류 → 화면 고정 문구(`failure.ts` — screens.md §16-7 상황 쪽 문맥). 서버 `message` 는 쓰지 않는다. */
export const FAIL = {
  network: '인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
  userGone: '계정을 다시 확인해야 해요. 다시 로그인해 주세요.',
  writeRate: (s: number) => `잠시 뒤 다시 눌러 주세요. ${s}초 뒤에 할 수 있어요.`,
  /** 하루 한도의 남은 때 — 1시간 이상이면 시간(올림), 아니면 분(올림). */
  waitAbout: (sec: number) => (sec >= 3600 ? `약 ${Math.ceil(sec / 3600)}시간 뒤` : `약 ${Math.max(1, Math.ceil(sec / 60))}분 뒤`),
  draftBusy: '다른 화면에서 상황 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.',
  draftRate: (s: number) => `상황 초안은 1분에 6번까지 만들 수 있어요. ${s}초 뒤 다시 눌러 주세요.`,
  draftDaily: '오늘은 상황 초안을 모두 만들었어요. 상황 초안과 변형 초안을 합쳐 하루 40번까지예요.',
  saveLimit: `내 상황이 ${L.activePerUser}개라 더 저장할 수 없어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.`,
  saveDaily: `오늘은 상황을 ${L.createPerDay}개 저장했어요. 내일 다시 저장할 수 있어요.`,
  seedGone: '기본 항목을 찾을 수 없어요. 목록을 새로 고칠게요.',
  scenarioGone: '이 상황은 이미 목록에 없어요.',
  notOverridden: '이미 기본으로 돌아가 있어요.',
  hideFail: '숨기지 못했어요. 다시 눌러 주세요.',
  revertFail: '되돌리지 못했어요. 다시 눌러 주세요.',
  opening: {
    unfit: '선생님이 처음 건넬 말을 적어 주세요. 예: 어서 오세요, 무엇을 드릴까요?',
    tooLong: '첫마디가 길어서 일본어 한 줄로 만들기 어려워요. 조금 줄여 주세요.',
    busy: '앞에서 누른 일본어를 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요.',
    rate: (s: number) => `일본어 만들기는 1분에 10번까지예요. ${s}초 뒤 다시 눌러 주세요.`,
    daily: (wait: string) => `오늘은 일본어 만들기를 60번 모두 했어요. ${wait} 다시 할 수 있어요.`,
    fail: '일본어로 바꾸지 못했어요. 다시 해 볼까요?',
    failKeep: '한국어는 그대로 있어요.',
    max: `첫마디는 ${L.openingKoMax}자까지 적을 수 있어요.`,
  },
} as const
