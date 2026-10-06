/**
 * AI 평가 화면 문구(task-011 데모 v1 승인본 — 결정 a·b·c·d·e=B, f=A). 음성 인식 상태 줄은 공용 `sttCopy` 를 그대로 쓴다.
 * 엔진명·모델명·작업 번호를 싣지 않는다.
 */
import type { EvalDim, EvalGrade, EvalInputSource, EvalItemKind, EvalKind } from '@/types/evaluation'

export const KIND_NAME: Record<EvalKind, string> = { WORDS: '단어 평가', TALK: '회화 평가' }
export const KIND_SHORT: Record<EvalKind, string> = { WORDS: '단어', TALK: '회화' }

export const ITEM_KIND: Record<EvalItemKind, string> = {
  MEANING_CHOICE: '뜻 고르기',
  READING_INPUT: '읽기 쓰기',
  USAGE_CHOICE: '용법 고르기',
  CHUNK_CLASSIFY: '조각 분류',
  LISTEN_RESPOND: '듣고 답하기',
  ASSEMBLE: '문장 조립',
  SITUATION_RESPOND: '상황 응답',
  CORRECTION_SPOT: '틀린 곳 찾기',
}

/** 조각 분류 보기(서버 값 순서 = 이름·액션·느낌·꾸밈). */
export const CHUNK_CHOICES = [
  { value: 'NAME', label: '이름 조각', hint: '사람·물건·장소의 이름' },
  { value: 'ACTION', label: '액션 조각', hint: '하는 일(동사)' },
  { value: 'FEELING', label: '느낌 조각', hint: '상태·느낌(형용사)' },
  { value: 'MODIFIER', label: '꾸밈 조각', hint: '때·정도·방식' },
] as const

export const DIM_NAME: Record<EvalDim, string> = { accuracy: '정확성', vocabulary: '어휘', grammar: '문법', naturalness: '자연스러움', assembly: '조각 조립' }
export const DIM_ORDER: readonly EvalDim[] = ['accuracy', 'vocabulary', 'grammar', 'naturalness', 'assembly']

/** 결정 (c)=B 레벨 기준형. */
export const GRADE_LABEL: Record<EvalGrade, string> = { EXCELLENT: '이 레벨은 충분해요', GOOD: '거의 다 왔어요', FAIR: '기본은 잡혔어요', NEEDS_WORK: '이 레벨을 더 다져요' }
export const GRADE_SUB: Record<EvalGrade, string> = {
  EXCELLENT: '같은 레벨에서 두 번 연속이면 레벨 올리기를 제안해요',
  GOOD: '90점을 넘으면 이 레벨은 충분해요',
  FAIR: '틀린 문항만 다시 보면 금방 올라가요',
  NEEDS_WORK: '‘다음에 집중할 것’부터 연습해요',
}
export const GRADE_RANGE: Record<EvalGrade, string> = { EXCELLENT: '90점 이상', GOOD: '75~89점', FAIR: '60~74점', NEEDS_WORK: '60점 미만' }

export const HOME = {
  title: 'AI 평가',
  myLevel: (l: string) => `내 레벨 ${l}`,
  loading: '불러오는 중…',
  loadError: 'AI 평가 정보를 불러오지 못했어요.',
  intro: '내 단어와 표현으로 지금 실력을 점검해요. 10분 동안 풀고, 제출하면 선생님이 채점해요.',
  wordsTile: '10문항 · 뜻·읽기·용법',
  talkTile: '6문항 · 듣기·말하기',
  talkBlocked: '지금은 볼 수 없어요 · 자막만',
  talkBlockedWhy: '선생님 목소리가 돌아오면 회화 평가를 볼 수 있어요',
  first: '아직 본 평가가 없어요. 첫 평가로 지금 실력을 확인해 보세요.',
  last: (date: string, kind: string) => `지난 평가 · ${date} ${kind} `,
  genTitle: '선생님이 문제를 만들고 있어요',
  genBody: (kind: string, topic: string | null) => `${kind}${topic ? ` · ${topic}` : ''} · 보통 1분 안에 끝나요.`,
  genOpen: '보러 가기',
  readyTitle: '문제가 준비됐어요',
  readyBody: (kind: string, n: number) => `${kind} · ${n}문항 · [시작하기]를 누르면 10분 타이머가 켜져요.`,
  readyGo: '시작하기',
  progressTitle: '푸는 중인 평가가 있어요',
  progressBody: (kind: string, n: number, a: number | null) => `${kind} · ${n}문항${a === null ? '' : ` 중 ${a}개 답함`}`,
  remain: (t: string) => `남은 시간 ${t}`,
  resume: '이어서 풀기',
  overTitle: '시간이 지났어요 — 그래도 제출할 수 있어요',
  overBody: (kind: string, n: number, a: number | null) => `${kind} · ${n}문항${a === null ? '' : ` 중 ${a}개 답함`} · 결과에 ‘시간 초과’로 표시돼요.`,
  overPill: (t: string) => `${t} 지남`,
  resumeOver: '이어서 풀고 제출하기',
  gradingTitle: '선생님이 채점하고 있어요',
  gradingBody: (kind: string) => `${kind} · 보통 1~2분 걸려요. 다 되면 여기서 결과를 볼 수 있어요.`,
  gradeFailTitle: '채점을 끝내지 못했어요',
  gradeFailBody: (kind: string) => `${kind} · 답은 모두 저장돼 있어요. 다시 채점하면 대부분 잘 돼요.`,
  regrade: '다시 채점하기',
  regrading: '보내는 중…',
  doneCap: (kind: string, topic: string | null) => `오늘 평가 · ${kind}${topic ? ` · ${topic}` : ''}`,
  focus: '다음에 집중할 것',
  result: '결과 보기',
  newEval: '새 평가',
  history: '평가 기록 보기',
} as const

export const START = {
  title: 'AI 평가 시작',
  sub: '오늘',
  back: '오늘로',
  question: '어떤 평가를 볼까요?',
  wordsDesc: ['10문항 · 뜻 고르기 4 · 읽기 쓰기 2 · 용법 고르기 2 · 조각 분류 2', '보기를 고르거나 글자로 답해요.'],
  talkDesc: ['6문항 · 듣고 답하기 2 · 문장 조립 1 · 상황 응답 2 · 틀린 곳 찾기 1', '말로 답해요(글자로 써도 돼요).'],
  mic: '마이크 사용',
  talkBlocked: '지금은 선생님 목소리를 들을 수 없어서 회화 평가를 시작할 수 없어요. 목소리가 돌아오면 볼 수 있어요.',
  level: '레벨',
  myLevel: '내 레벨',
  levelNote: '내 레벨보다 높은 레벨도 볼 수 있어요. 레벨은 결과를 보고 선생님이 올리자고 제안해요.',
  topic: '주제',
  topicAuto: '선생님이 고르기',
  topicNote: '고른 주제의 상황과 표현으로 회화 문제를 만들어요. ‘선생님이 고르기’는 최근 수업한 주제에서 골라요.',
  rulesTitle: '이렇게 진행돼요',
  ruleTime: ['10분', ' 안에 풀어요. 시간이 지나도 제출할 수 있고, 결과에 ‘시간 초과’로 표시돼요.'],
  ruleLock: ['정답과 점수는 제출한 뒤에', ' 보여 줘요. 푸는 동안 답은 몇 번이든 바꿀 수 있어요.'],
  ruleBook: ['문제의 ', '60% 이상은 내 단어장', '에서, 자주 틀린 단어부터 나와요. 최근 2주 동안 나온 문제는 다시 나오지 않아요.'],
  ruleMic: ['말하기 문항은 버튼을 ', '누른 채로 말해요.', ' 조용한 곳이 좋아요.'],
  few: (have: number) => `단어장에 단어가 ${have}개뿐이에요.`,
  fewBody: (kind: string, need: number) => `${kind}는 문제의 60% 이상을 내 단어로 만들어서 단어가 ${need}개 이상 있어야 해요.`,
  fewGo: '단어장에 단어 넣기',
  fewWhy: (need: number) => `단어장에 단어가 ${need}개 이상 있어야 해요`,
  make: '문제 만들기',
  making: '만드는 중…',
  makeNote: '문제를 만드는 데 1분쯤 걸려요. 만드는 동안 나가도 괜찮아요.',
  inProgress: '진행 중인 평가가 있어요. 그 평가로 갈게요.',
  topicMissing: '주제를 찾을 수 없어요. 다른 주제를 골라 주세요.',
  rateLimited: '잠시 후 다시 눌러 주세요.',
  failed: '문제를 만들지 못했어요. 다시 눌러 주세요.',
  topicsError: '주제를 불러오지 못했어요. ‘선생님이 고르기’로 볼 수 있어요.',
} as const

export const GEN = {
  title: '문제 만들기',
  hero: '선생님이 문제를 만들고 있어요',
  phase: (t: number) => (t > 60 ? '조금 오래 걸리고 있어요. 조금만 더 기다려 주세요.' : t < 16 ? '내 단어장에서 재료를 고르고 있어요' : t < 40 ? '문제를 쓰고 있어요' : '보기와 정답을 확인하고 있어요'),
  elapsed: (t: string) => `${t} · 보통 1분 안에 끝나요`,
  summary: '이번 평가',
  leave: '이 화면을 나가도 문제는 계속 만들어져요. 다 되면 오늘 탭에서 열 수 있어요.',
  backToday: '오늘로 돌아가기',
  offline: '인터넷 연결이 끊겼어요. 연결되면 이어서 확인해요.',
  failTitle: '문제를 만들지 못했어요',
  failBody: '선생님이 문제를 끝까지 만들지 못했어요. 다시 만들면 대부분 잘 만들어져요.',
  retry: '다시 만들기',
  today: '오늘로',
  readyToast: '문제가 준비됐어요',
} as const

export const SUMMARY = { kind: '종류', level: '레벨', topic: '주제', items: '문항', limit: '제한 시간', limitVal: '10분', count: (n: number) => `${n}문항` } as const

export const READY = {
  title: 'AI 평가',
  hero: '문제가 준비됐어요',
  body: '[시작하기]를 누르면 10분 타이머가 켜져요.',
  plan: '문항 구성',
  planRow: (n: number) => `${n}문항`,
  note: '중간에 나가도 시간은 계속 흘러요. 답은 고를 때마다 저장돼요.',
  start: '시작하기',
  starting: '시작하는 중…',
  later: '나중에 하기',
  startedToast: '10분 타이머가 시작됐어요',
  startFail: '시작하지 못했어요. 다시 눌러 주세요.',
} as const

export const RUN = {
  leaveAria: '평가 나가기',
  answered: (a: number, n: number) => `답함 ${a} / ${n}`,
  timerLabel: { normal: '남은 시간', warn: '1분 남음', over: '시간 지남' },
  timerAria: { normal: (t: string) => `남은 시간 ${t}`, over: (t: string) => `시간이 ${t} 지났어요` },
  navAria: '문항 이동',
  qAria: (n: number, kind: string, answered: boolean) => `${n}번 ${kind}${answered ? ', 답함' : ', 아직 안 답함'}`,
  submit: '제출',
  prev: '‹ 이전',
  next: '다음 ›',
  submitFull: '제출하기',
  firstItem: '첫 문항이에요',
  oneMinute: '1분 남았어요. 시간이 지나도 제출할 수 있어요.',
  overAnnounce: '시간이 지났어요. 그래도 제출할 수 있어요.',
  overBanner: ['시간이 지났어요', ' — 그래도 제출할 수 있어요.'],
  overBanner2: '남은 문항을 마저 풀어도 되고, 결과에는 ‘시간 초과’로 표시돼요.',
  overSubmit: '지금 제출하기',
  points: (n: number) => `${n}점`,
  saved: '저장했어요 · 제출 전까지 바꿀 수 있어요',
  notYet: '아직 답하지 않았어요',
  saveFail: ['답을 저장하지 못했어요.', ' 인터넷 연결을 확인하고 다시 저장해 주세요.'],
  saveRetry: '다시 저장',
  savedToast: '답을 저장했어요',
  saveFailToast: '답을 저장하지 못했어요',
  loadError: '평가를 불러오지 못했어요. 답은 저장돼 있어요.',
  loading: '평가를 불러오는 중…',
  retry: '다시 시도',
} as const

export const ITEM = {
  meaningQ: '이 단어의 뜻은?',
  readingQ: '이 단어를 어떻게 읽을까요? 히라가나로 써 보세요.',
  readingLabel: '읽기',
  readingPh: 'ひらがなで',
  readingEmpty: '쓰고 [저장]을 누르거나 다른 문항으로 가면 저장돼요',
  /** 읽기를 묻는 문항은 제출 전 히라가나·`[한글]` 을 그리지 않는다(정답 보호, task-033 P1) — 히라가나나 한글이 켜져 있을 때만 보인다. */
  readingGuardNote: '읽기를 묻는 문항이라 히라가나·한글은 제출한 뒤에 보여 줘요.',
  save: '저장',
  usageQ: '빈칸에 알맞은 말을 고르세요',
  blank: '빈칸',
  chunkQ: '이 표현은 어떤 조각일까요?',
  choicesAria: '보기',
  mine: '내 답',
  situationQ: '상황에 맞게 일본어로 말해 보세요',
  assembleQ: '조각을 순서대로 눌러 문장을 만들어 보세요',
  assembleKo: (ko: string) => `뜻 · ${ko}`,
  assembleBox: '만든 문장',
  assemblePh: '아래 조각을 눌러 여기에 차례로 놓아요',
  assemblePool: '남은 조각',
  assembleAdd: (p: string) => `조각 ${p} 넣기`,
  assembleDel: (n: number, p: string) => `${n}번째 조각 ${p}, 눌러서 빼기`,
  assembleReset: '처음부터 다시',
  assembleKept: '저장된 답이 있어요 · 조각을 모두 넣으면 새 답으로 바뀌어요',
  assembleEmpty: '조각을 모두 넣으면 저장돼요',
  spotQ: '틀린 곳을 눌러 고르고, 어떻게 고칠지 써 보세요',
  spotAria: '문장 조각, 틀린 곳 하나 고르기',
  spotPicked: '고른 곳 · ',
  spotPick: '틀린 곳을 하나 골라요',
  spotLabel: '고친 말과 이유',
  spotPh: '고친 말은 일본어로, 이유는 한국어로 써도 돼요',
  spotMeta: '고른 곳과 글이 한 답으로 저장돼요',
  spotWhy: '틀린 곳을 고르고 고친 말을 써 주세요',
  fixQ: '틀린 곳을 찾아 문장을 고쳐 쓰고, 이유를 적어 보세요',
  fixLabel: '고친 문장',
  fixNote: '원래 문장이 들어 있어요. 틀린 부분만 고치면 돼요.',
  whyLabel: '이유',
  whyPh: '한국어로 써도 돼요',
  fixMeta: '고친 문장과 이유가 한 답으로 저장돼요',
  fixWhy: '틀린 부분을 고쳐 주세요',
  answerSave: '답 저장',
  answerLabel: '내 답',
  textPh: '일본어로 써 보세요',
  textEmpty: '쓰고 [답 저장]을 누르거나 다른 문항으로 가면 저장돼요',
  writeFirst: '먼저 답을 써 주세요',
  toVoice: '말로 답하기',
  toText: '글자로 답하기',
  said: '내가 한 말',
  wrote: '내가 쓴 답',
  liveBox: '버튼을 누른 채로 말하면 여기에 알아들은 말이 나와요',
  listening: '듣고 있어요…',
  idleAfter: '다시 말하려면 또 누르고 말해요 — 새 답으로 바뀌어요',
  playingIdle: '듣는 중 · 누르면 멈추고 말해요',
  pttNormal: '누르고 있는 동안 말하기',
  pttBarge: '누르면 소리를 멈추고 말하기',
} as const

export const LISTEN = {
  play: '질문 듣기',
  replay: '다시 듣기',
  playingAria: '듣는 중, 누르면 멈춰요',
  playLabel: '눌러서 듣기',
  replayLabel: '다시 듣기',
  playing: '듣는 중…',
  loading: '소리를 받는 중…',
  twice: '두 번까지 들을 수 있어요',
  once: '한 번 더 들을 수 있어요',
  none: '두 번 다 들었어요',
  noneWhy: '두 번 다 들었어요. 글자는 제출한 뒤에 보여 줘요',
  hiddenNote: '들려주는 문장은 제출한 뒤에 글자로 보여 줘요.',
  revealedNote: '글자로 봤어요 · 결과에 표시돼요',
  cut: ['선생님 목소리가 끊겼어요.', ' 돌아오면 다시 들을 수 있어요.'],
  cut2: '기다리기 어려우면 이 문항만 글자로 보고 풀 수 있어요(결과에 표시).',
  reveal: '글자로 보기',
  revealing: '불러오는 중…',
  revealFail: '글자를 불러오지 못했어요. 다시 눌러 주세요.',
  audioErr: '소리를 불러오지 못했어요.',
  audioRetry: '다시 시도',
  blocked: '소리를 내려면 한 번 더 눌러 주세요.',
  rate: '잠시 후 다시 들어 주세요.',
} as const

export const SUBMIT = {
  title: '제출할까요?',
  answered: '답함',
  missing: '안 푼 문항',
  used: '쓴 시간',
  over: '시간 초과',
  missingAlert: (n: number) => `답하지 않은 문항이 ${n}개 있어요.`,
  missingAlert2: ' 답하지 않은 문항은 0점이에요.',
  jump: (n: number) => `${n}번 풀기`,
  overNote: (t: string) => `시간이 ${t} 지났어요. 결과에 ‘시간 초과’로 표시돼요.`,
  lock: (words: boolean) => `제출하면 답을 바꿀 수 없어요. 선생님이 ${words ? '바로' : '1~2분 동안'} 채점해요.`,
  fail: ['제출하지 못했어요.', ' 인터넷 연결을 확인하고 다시 눌러 주세요.'],
  fail2: '여러 번 눌러도 한 번만 제출돼요.',
  unsaved: ['답을 저장하지 못한 문항이 있어요.', ' 인터넷 연결을 확인하고 다시 눌러 주세요. 저장하지 못한 답은 채점되지 않아요.'],
  /** 360·390 폭 두 칸 버튼에서 한 줄에 들도록 짧게('다시 저장하고 제출하기'는 글자 중간에서 줄이 바뀐다). */
  goRetry: '저장하고 제출하기',
  back: '계속 풀기',
  goAnswer: '답하러 가기',
  go: '제출하기',
  goAnyway: '그래도 제출하기',
  going: '제출하는 중…',
} as const

export const LEAVE = {
  title: '평가를 나갈까요?',
  body: '지금까지 답은 저장돼 있어요.',
  bodyUnsaved: (nums: number[]) => `${nums.join('·')}번 답은 아직 저장하지 못했어요.`,
  body2: '나가도 10분 시간은 계속 흘러요. 오늘 탭에서 이어서 풀 수 있어요.',
  go: '나가기',
  stay: '계속 풀기',
} as const

export const GRADING = {
  title: '채점',
  hero: '선생님이 채점하고 있어요',
  phase: (t: number, words: boolean) =>
    t > 120 ? '조금 오래 걸리고 있어요. 조금만 더 기다려 주세요.' : words ? '답을 채점하고 기록하고 있어요' : t < 20 ? '고른 답은 채점했어요 · 말하기·쓰기 답을 읽고 있어요' : t < 45 ? '문항마다 점수와 한마디를 적고 있어요' : '다음에 집중할 것을 정리하고 있어요',
  elapsed: (t: string, words: boolean) => `${t} · ${words ? '곧 끝나요' : '보통 1~2분 걸려요'}`,
  submitted: '제출한 답',
  leave: '이 화면을 나가도 채점은 계속돼요. 다 되면 오늘 탭에서 결과를 볼 수 있어요.',
  backToday: '오늘로 돌아가기',
  failTitle: '채점을 끝내지 못했어요',
  failBody: '답은 모두 저장돼 있어요. 다시 채점하면 대부분 잘 돼요.',
  retry: '다시 채점하기',
  later: '나중에 하기',
  once: '다시 채점해도 기록은 한 번만 남아요. 나중에 오늘 탭에서도 다시 채점할 수 있어요.',
  doneToast: '채점이 끝났어요',
  retryFail: '다시 채점하지 못했어요. 잠시 후 다시 눌러 주세요.',
} as const

export const RESULT = {
  title: '평가 결과',
  totalAria: '총점',
  outOf: '점 / 100',
  meta: (n: number, a: number) => `${n}문항 · 답함 ${a}`,
  over: (t: string) => `시간 초과 ${t}`,
  used: (t: string) => `푼 시간 ${t}`,
  teacherSays: '선생님 한마디',
  focus: '다음에 집중할 것',
  rubric: '영역별 점수',
  rubricScale: '0~5',
  rubricAria: (name: string, v: number) => `${name} 5점 중 ${v}점`,
  rubricNote: '발음·유창성은 이 점수에 넣지 않아요.',
  rubricWords: ' 단어 평가는 고르는 문항 결과를 보고 선생님이 매겨요.',
  items: '문항별 결과',
  itemsHint: '누르면 정답·피드백',
  full: '맞음',
  wrong: '틀림',
  unanswered: '안 풂',
  part: '부분 점수',
  myWord: ' · 내 단어',
  revealed: ' · 글자로 봤어요',
  score: (s: number, m: number) => `${s} / ${m}`,
  heard: '들려준 말',
  heardRevealed: ' · 글자로 봤어요',
  situation: '상황',
  sentence: '문장',
  meaning: '뜻',
  mine: '내 답',
  noAnswer: '답하지 않았어요 · 0점',
  correctLine: '정답이에요.',
  right: '정답',
  model: '모범 답',
  fixed: '고친 곳',
  gist: (g: string) => `이런 뜻이면 돼요 · ${g}`,
  pickedSpot: '고른 곳 · ',
  byVoice: '말로 답함',
  byText: '글자로 답함',
  byUserFix: '말로 답함 · 내가 고친 말로 채점했어요',
  byServerStt: '말로 답함 · 다시 들어 본 말로 채점했어요',
  byRealtimeStt: '말로 답함 · 처음 들린 말로 채점했어요',
  feedback: '선생님 피드백',
  noAnswerFeedback: '답하지 않아서 0점이에요.',
  dims: '이 문항이 재는 것',
  replay: '다시 듣기',
  history: '평가 기록',
  today: '오늘로',
} as const

/** 레벨 문구의 `…으로/로` 는 `levelRo()`(logic)가 붙인 값을 받는다(N3으로 · N4로). */
export const LEVEL = {
  cap: '선생님 제안',
  title: '레벨을 올려 볼까요?',
  arrowSr: (from: string, toRo: string) => `${from}에서 ${toRo}`,
  why: (from: string) => `${from} 평가에서 두 번 연속 90점 이상을 받았어요.`,
  note: (to: string) => `올리면 다음 수업과 평가가 ${to} 기준으로 나와요. 누르기 전에는 바뀌지 않아요.`,
  accept: (toRo: string) => `${toRo} 올리기`,
  accepting: '바꾸는 중…',
  reject: '지금은 그대로',
  fail: '레벨을 바꾸지 못했어요. 다시 눌러 주세요.',
  doneTitle: (toRo: string) => `레벨을 ${toRo} 바꿨어요`,
  doneBody: (to: string) => `다음 수업과 평가부터 ${to} 기준으로 나와요. 설정 › 학습에서 언제든 바꿀 수 있어요.`,
  rejected: (fromRo: string) => `그대로 ${fromRo} 둘게요. 다음에 또 두 번 연속 90점을 넘으면 다시 여쭤볼게요.`,
  today: '오늘',
  basisRow: (date: string, kind: string, score: number) => `${date} ${kind} ${score}점`,
} as const

export const HIST = {
  title: '평가 기록',
  sub: 'AI 평가',
  back: '오늘로',
  filterAria: '종류',
  all: '전체',
  loading: '평가 기록을 불러오는 중…',
  error: '평가 기록을 불러오지 못했어요.',
  emptyTitle: '아직 본 평가가 없어요',
  emptyBody: '10분이면 지금 실력을 확인할 수 있어요. 문제는 내 단어장에서 나와요.',
  emptyGo: '첫 평가 시작하기',
  emptyKind: (k: string) => `${k} 평가 기록이 없어요`,
  showAll: '전체 보기',
  more: '더 보기',
  moreLoading: '불러오는 중…',
  allLoaded: '기록을 모두 불러왔어요',
  score: (n: number) => `${n}점`,
  status: { GENERATING: '만드는 중', READY: '준비됨', IN_PROGRESS: '푸는 중', GRADING: '채점 중', FAILED: '', DONE: '' } as Record<string, string>,
} as const

export const COMMON = {
  notFound: '이 평가를 찾을 수 없어요.',
  notFoundBody: '주소가 잘못되었거나 삭제된 평가예요.',
  today: '오늘로',
  network: '인터넷 연결을 확인하고 다시 눌러 주세요.',
} as const

/**
 * 말하기 문항 "내 답" 아래 채점 글의 출처(task-012b-2 가이드 §2-E, D-B7) — 엔진 이름 없이. `voiced`(#66, D-2) = 답이 녹음에서 왔는가:
 * 학습자가 직접 고친 글로 채점되면 `inputSource` 는 TEXT 로 남아 글자로 쓴 답과 같아 보이므로 이 값으로 가른다(없으면 글자로 답함).
 * `inputSource` 가 없으면 줄 없음(null).
 */
export function answerSourceLabel(it: { inputSource: EvalInputSource | null; voiced?: boolean }): string | null {
  switch (it.inputSource) {
    case 'TEXT':
      return it.voiced ? RESULT.byUserFix : RESULT.byText
    case 'SERVER_STT':
      return RESULT.byServerStt
    case 'REALTIME_STT':
      return RESULT.byRealtimeStt
    default:
      return null
  }
}
