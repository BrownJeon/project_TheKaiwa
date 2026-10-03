/**
 * 오늘의 복습(task-010b) 한국어 UI 문구 — screens §14-8(데모 v1 문구 그대로, ★ = 계약 때문에 더한 줄).
 * 오늘의 회화 문구(`lessonCopy.ts`)는 건드리지 않는다. 엔진명·판단 주체 원값·잡 종류는 여기에 두지 않는다(§14-10).
 */

/* ⓐ 오늘 홈 카드 */
export const RV_HOME = {
  title: '오늘의 복습',
  minutes: '약 15분',
  items: (n: number) => `${n}개 항목`,
  focus: (f: number) => `집중 ${f}개`,
  whySr: '선생님 근거: ',
  judgedBy: (teacherName: string) => (teacherName === '선생님' ? '선생님 판단' : `${teacherName} 선생님 판단`),
  more: '자세히',
  less: '접기',
  chipsTitle: (n: number) => `이번 복습 항목 ${n}개`,
  chipsMore: (k: number) => `외 ${k}개`,
  chipsAria: '이번 복습 항목',
  focusSr: '집중, ',
  start: '복습 시작',
  starting: '만드는 중…',
  skip: '오늘은 건너뛰기',
  fallbackWhy: '지난 학습에서 틀리거나 오래된 항목을 골랐어요',
  fallbackNote: '이번엔 기본 규칙으로 골랐어요.',
  pendingTitle: '선생님이 오늘 복습할 항목을 고르고 있어요',
  pendingBody: '곧 준비돼요. 보통 1분 안에 끝나요. 그동안 다른 공부를 해도 괜찮아요.',
  restTitle: '오늘은 복습할 항목이 없어요',
  restBody: (due: string, d: number, k: number) => `다음 복습 · ${due}, ${d}일 뒤 · ${k}개 항목`,
  genTitle: '복습 수업을 만들고 있어요',
  genBody: (n: number) => `${n}개 항목 · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요.`,
  genOpen: '보러 가기',
  failTitle: '복습 수업을 만들지 못했어요',
  failBody: (n: number) => `${n}개 항목 · 다시 만들면 대부분 잘 만들어져요.`,
  retry: '다시 만들기',
  progressTitle: '하던 복습이 있어요',
  progressBody: (n: number, k: number) => `${n}개 항목 · 오늘 시작 · 5단계 중 ${k}단계 끝냄`,
  nextStage: (label: string) => `다음은 ${label}예요. 단계마다 저장돼요.`,
  resume: '이어서 하기',
  readyTitle: '복습 수업이 준비됐어요',
  readyBody: (n: number) => `${n}개 항목 · 5단계 · 약 15분`,
  readyStart: '시작하기',
  doneTitle: '오늘 복습을 끝냈어요',
  doneBody: (n: number, c: number | null) => (c === null ? `${n}개 항목` : `${n}개 항목 · 문제 ${c}/5 맞힘`),
  nextTitle: '다음 복습',
  nextTutor: (due: string, d: number) => `${due} · 선생님이 ${d}일 뒤로 정했어요`,
  nextNeutral: (due: string, d: number) => `${due} · ${d}일 뒤`,
  nextFallbackNote: '이번엔 지난 간격대로 정했어요',
  nextPending: '선생님이 날짜를 정하고 있어요',
  doneResult: '끝낸 복습 결과 보기',
  skippedTitle: '오늘 복습은 건너뛰었어요',
  skippedBody: (n: number) => `${n}개 항목은 다음에 공부하는 날 선생님이 다시 골라 드려요.`,
  undoMessage: '오늘 복습을 건너뛰었어요',
  undo: '되돌리기',
  undone: '건너뛰기를 되돌렸어요',
  skipFailed: '건너뛰지 못했어요. 다시 눌러 주세요.',
  /** ★ #58 오류(오늘의 회화 카드 한 곳에서 합침, Leader ⑥). */
  loadError: '오늘의 회화와 복습을 불러오지 못했어요.',
  /** ★ [복습 시작]·[다시 만들기] 오류 토스트. */
  startChanged: '오늘 복습이 바뀌었어요. 다시 불러올게요.',
  startRateLimited: '잠시 후 다시 눌러 주세요.',
  startOffline: '연결하지 못했어요. 네트워크를 확인해 주세요.',
  startFailed: '복습 수업을 만들지 못했어요. 다시 눌러 주세요.',
} as const

/* ⓑ 곧 열려요(가드) */
export const RV_SOON = {
  section: '곧 열려요',
  title: '오늘의 복습',
  badge: '기록이 더 쌓이면 열려요',
  body: '선생님이 복습 날짜를 정하려면 기록이 조금 더 필요해요.',
  studyDays: '공부한 날',
  items: '복습할 재료',
  dayUnit: '일',
  itemUnit: '개',
  hint: '수업이나 단어 세트를 끝내거나 교정을 채택하면 재료가 쌓여요.',
  meterNum: (have: number, need: number, unit: string, ok: boolean) => `${ok ? '✓ ' : ''}${have}/${need}${unit}`,
  meterAria: (label: string, have: number, need: number, unit: string, ok: boolean) => `${label}, ${need}${unit} 중 ${have}${unit}${ok ? ', 채웠어요' : ''}`,
} as const

/* ⓒ 복습 수업 대기·실패 */
export const RV_GEN = {
  backTitle: '복습 수업 만들기',
  backSub: (n: number | null) => (n === null ? '오늘의 복습' : `오늘의 복습 · ${n}개 항목`),
  title: '선생님이 복습 수업을 만들고 있어요',
  phaseItems: '이번 복습 항목을 살펴보고 있어요',
  phaseMix: '항목을 섞어 대화문을 쓰고 있어요',
  itemsTitle: (n: number) => `이번 복습 항목 ${n}개로 만들어요`,
  itemsNote: '항목을 섞은 새 대화로 오늘의 회화와 같은 5단계(이해 → 문법 → 문제 → 응용 → 말하기)를 해요. ● 은 집중 항목이에요.',
  failTitle: '복습 수업을 만들지 못했어요',
  backToday: '오늘로 돌아가기',
  readyToast: '복습 수업이 준비됐어요',
} as const

/* ⓓ 복습 수업 */
export const RV_LESSON = {
  badge: '복습',
  headerSr: '오늘의 복습: ',
  itemsTitle: (n: number) => `이번 복습 항목 ${n}개`,
  itemsFocus: (f: number) => ` · 집중 ${f}개`,
  itemsNote: '선생님이 고른 항목이에요. 오늘 대화·문제·말하기에 섞여 나와요.',
  focus: '집중',
  focusNote: ' 자주 틀리거나 교정받은 항목이에요. 다음 복습도 3일 안에 다시 봐요.',
  feedback: (n: number) => `교정 ${n}번`,
  wrong: (n: number) => `틀림 ${n}번`,
  neverWrong: '틀린 적 없음',
  studied: (n: number) => `공부 ${n}번`,
  /** ★ 공부 0번(교정 채택·단어 세트로 막 들어온 항목, §14-11 ⑧). */
  firstReview: '처음 복습해요',
  fromSource: (label: string) => `${label}에서`,
  grammarIntro: (g: number) => `복습할 표현과 문형 ${g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요.`,
  exprTitle: (n: number) => `복습 표현 ${n}개`,
  exprNote: '이번 복습 항목이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요.',
  exprNoteNoAudio: '이번 복습 항목이에요. 문제·응용·말하기에서 다시 써요.',
  quizNote: '틀린 문제는 수업을 마친 뒤 선생님이 다음 복습 날짜를 정할 때 참고해요.',
} as const

/* ⓔ 복습 종료 카드 */
export const RV_END = {
  title: '복습을 마쳤어요',
  subtitle: (monthDay: string) => `오늘의 복습 · ${monthDay}`,
  heroSub: (n: number, titleKo: string | null) => (titleKo ? `${n}개 항목 복습 · ${titleKo}` : `${n}개 항목 복습`),
  recordNote: '복습한 항목마다 공부 횟수를 1번씩 더했어요.',
  nextTitle: '다음 복습',
  pendingTitle: '선생님이 다음 복습 날짜를 정하고 있어요',
  pendingBody: '보통 1분 안에 끝나요. 이 화면을 나가도 괜찮아요 — 오늘 탭에서도 볼 수 있어요.',
  tutorTitle: (d: number) => `선생님이 ${d}일 뒤로 정했어요`,
  tutorManyBody: (due: string) => `${due}부터, 항목마다 3~7일 간격이에요.`,
  /** ★ 묶음이 하나일 때. */
  tutorOneBody: (due: string) => `${due}에 다시 봐요.`,
  groupDays: (d: number) => `${d}일 뒤`,
  groupMeta: (due: string, k: number) => `${due} · ${k}개`,
  fallbackTitle: (d: number) => `가장 가까운 복습은 ${d}일 뒤예요`,
  fallbackNote: '이번엔 선생님 판단 없이 지난 간격대로 정했어요. 다음에 공부할 때 다시 판단해요.',
  /** ★ 대기를 끝냈는데도 값이 없을 때. */
  unknown: '다음 복습 날짜는 오늘 탭에서 볼 수 있어요.',
  backToday: '오늘로',
  backTodayNote: '오늘 탭에서 새 수업도 이어서 할 수 있어요.',
} as const

/** 종류 라벨(`itemType`) — SCENARIO·LESSON 은 Phase 2 에선 나오지 않는다. */
export const ITEM_TYPE_LABEL: Record<string, string> = {
  EXPRESSION: '표현',
  CHUNK: '표현',
  GRAMMAR: '문형',
  WORD: '단어',
  SCENARIO: '상황',
  LESSON: '수업',
}

/** 출처 라벨(`refType` → 3종, Leader ④). 모르는 값은 라벨 없음. */
export const SOURCE_LABEL: Record<string, string> = {
  TopicChunk: '수업',
  Expr: '수업',
  Grammar: '수업',
  Correction: '회화 교정',
  WordEntry: '단어 세트',
}
