/**
 * 주제·상황 관리(task-045 T5) 새 화면 문구의 단일 출처 — screens.md §16-6 `topicCopy.ts` 표 + §16-7 오류 문구(`FAIL`).
 * 공유 편집기·상황 시트·변형 화면 문구는 `scenario/scenarioCopy.ts` 에 둔다(scenario → topic import 금지).
 * 제목 `{t}` 는 늘 「」 안에 넣고 뒤에 고정 명사(주제·상황·챌린지)를 붙인다 — 사용자 글 끝 글자에 조사를 붙이지 않는다.
 * 서버 컴포넌트(설정 행)도 읽으므로 'use client' 를 두지 않는다. 엔진·모델명과 「AI」라는 낱말을 쓰지 않는다.
 */
import type { TopicChunkType } from '@/types/topic'

export const ENTRY = {
  section: '회화 연습',
  row: '내 상황·주제 관리',
  rowSub: '주제를 적으면 선생님이 상황 초안을 만들어요',
} as const

export const MANAGE = {
  title: '내 상황·주제',
  back: '설정',
  /** 같은 화면의 두 `radiogroup` 이름은 서로 달라야 한다(분절 ↔ 상황 칩). */
  tabsAria: '관리 대상',
  /** 불러오기 전에는 숫자를 비운다(가짜 0 을 보이지 않게). */
  tabTopics: (n: number | null) => (n === null ? '주제' : `주제 ${n}`),
  tabScenarios: (n: number | null) => (n === null ? '상황' : `상황 ${n}`),
  createTopic: '＋ 주제 만들기',
  createTopicSub: '주제를 한 줄로 적으면 선생님이 기본 표현과 상황 초안을 만들어요',
  mineCount: (n: number) => `내 주제 ${n}/30`,
  mineFull: '내 주제는 30개까지예요. 안 쓰는 주제를 지우면 새로 만들 수 있어요.',
  mineSection: (n: number | null) => (n === null ? '내가 만든 주제' : `내가 만든 주제 ${n}개`),
  seedSection: (n: number | null) => (n === null ? '기본 주제' : `기본 주제 ${n}개`),
  mineEmpty: '아직 만든 주제가 없어요. 위 [＋ 주제 만들기]로 시작해요.',
  rowMeta: (s: number, c: number) => `상황 ${s}개 · 기본 표현 ${c}개`,
  rowMetaNoScenario: (c: number) => `기본 표현 ${c}개`,
  challengeBadge: (d: number) => `챌린지 ${d}일째`,
  badgeSeed: '기본',
  badgeMine: '내 주제',
  badgeCopy: '✎ 내 버전',
  createScenario: '＋ 상황 만들기',
  scenarioCount: (n: number) => `내 상황 ${n}/50`,
  scenarioEmpty: '아직 만든 상황이 없어요.',
  /** 상황 탭 출처 칩(전체·내가 만든·기본)의 읽어 주는 이름 — 화면에 보이지 않고, 분절 이름과만 구분하면 된다. */
  filterAria: '상황 보기 범위',
  filterAll: (n: number) => `전체 ${n}`,
  filterMine: (n: number) => `내가 만든 ${n}`,
  filterSeed: (n: number) => `기본 ${n}`,
  hiddenRow: (n: number) => `숨긴 기본 항목 ${n}개`,
  loading: '내 상황·주제를 불러오는 중…',
  loadFail: '목록을 불러오지 못했어요',
  loadFailBody: '잠시 뒤 다시 시도해 주세요.',
  retry: '다시 시도',
} as const

export const HIDDEN = {
  title: '숨긴 기본 항목',
  intro: '나에게만 숨긴 기본 주제·상황이에요. 다시 보면 목록에 돌아와요.',
  kindTopic: '주제',
  kindScenario: '상황',
  noTitle: '이름을 알 수 없는 기본 항목',
  show: '다시 보기',
  showing: '다시 보이게 하는 중…',
  shown: '다시 보이게 했어요',
  /** 같은 이름의 [다시 보기] 버튼이 여러 개라 읽어 줄 때 무엇을 다시 보는지 붙인다. */
  showAria: (t: string) => `「${t}」 다시 보기`,
  empty: '숨긴 기본 항목이 없어요.',
  fail: '다시 보이게 하지 못했어요. 다시 눌러 주세요.',
} as const

export const CREATE = {
  title: '주제 만들기',
  ask: '어떤 주제로 연습하고 싶어요?',
  askSub: '주제를 한 줄로 적어 주세요. 선생님이 설명·기본 표현·상황 초안을 만들어요.',
  field: '주제',
  placeholder: '예: 병원 진료',
  /** 데모 v2 `scrCreate` 의 예시 칩 그대로. */
  examples: ['은행에서 계좌 만들기', '병원 진료 받기', '미용실 예약하기', '회사에서 회의하기'],
  level: '수준',
  levelNote: (l: string) => `내 수준(${l})으로 골라 뒀어요`,
  submit: '초안 만들기',
  privacy: '초안은 저장하기 전까지 어디에도 남지 않아요',
  short: '주제를 2자 이상 적어 주세요.',
  long: '주제는 40자까지 적을 수 있어요.',
  gen: '선생님이 주제 초안을 만들고 있어요',
  genSub: '보통 10~15초 걸려요.',
  genLong: '조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요.',
  cancel: '그만두기',
  canceled: '초안 만들기를 그만뒀어요. 적은 주제는 그대로 있어요.',
  resumeTitle: '고치던 주제 초안이 있어요',
  resumeBody: (t: string) => `「${t}」 주제 초안을 이어서 고칠 수 있어요.`,
  resume: '이어서 고치기',
  resumeDiscard: '버리고 새로 만들기',
} as const

const CHUNK_TYPE_LABEL: Record<TopicChunkType, string> = { NAME: '이름', ACTION: '액션', FEELING: '느낌', MODIFIER: '꾸밈' }

export const REVIEW = {
  arrivedTitle: '초안이 왔어요',
  arrivedBody: '고칠 곳을 고친 뒤 저장해야 내 주제가 돼요. 저장하기 전에는 어디에도 남지 않아요.',
  info: '주제 정보',
  fTitle: '주제 이름',
  fTitleJa: '일본어 이름',
  fLevel: '수준',
  fDesc: '설명',
  chunksHead: (n: number) => `기본 표현 ${n}개`,
  chunksRange: '8~20개',
  readingWarn: '읽기가 틀릴 수 있어요. 확인해 주세요.',
  readingWarnSub: '한자 읽기는 선생님도 가끔 틀려요. 틀린 읽기는 ⋯ › 고치기에서 바꿔요.',
  type: CHUNK_TYPE_LABEL,
  menu: (t: string) => `${t} 표현 메뉴`,
  menuEdit: '고치기',
  menuUp: '위로',
  menuDown: '아래로',
  menuRemove: '지우기',
  /** 표현 고치기 펼침의 종류 칸 이름표(가이드 S4 「종류 `Segmented sm`… 보이는 이름표」 — 표에 값이 없어 T5-3a 가 더함). */
  fType: '종류',
  fJa: '일본어',
  fReading: '읽기',
  fMeaning: '뜻',
  apply: '바꾸기',
  cancel: '취소',
  addChunk: '＋ 표현 더하기',
  checkHead: (n: number) => `확인해 볼 곳 ${n}가지 · 그대로 저장해도 돼요`,
  fixed: '✓ 고쳤어요',
  warn: {
    TITLE_TRUNCATED: '적은 주제가 길어서 이름을 20자로 줄였어요. 이름을 확인해 주세요.',
    DESCRIPTION_MISSING: '설명이 비어 있어요. 한 줄 적어 두면 목록에서 알아보기 쉬워요.',
    TITLE_JA_MISSING: '일본어 이름이 비어 있어요. 적지 않으면 한국어 이름만 보여요.',
    CHUNKS_SHORT: (n: number) => `기본 표현이 ${n}개예요. 20개까지 더 넣을 수 있어요.`,
    /** 여러 종류가 모자라면 한 줄로(이름·액션 …). */
    TYPE_THIN: (types: readonly TopicChunkType[], n: number) =>
      `${types.map((t) => CHUNK_TYPE_LABEL[t]).join('·')} 조각이 ${n}개뿐이에요. 하나 더 넣으면 수업 카드가 고르게 나와요.`,
  },
  problemsHead: (n: number) => `고칠 곳이 ${n}군데 있어요`,
  saveOrder: '주제를 먼저 저장하고, 고른 상황을 하나씩 저장해요.',
  /** 고른 상황이 없을 때 같은 자리의 한 줄 — `saveOrder` 와 겹쳐 그려 줄 높이가 바뀌지 않게 한다(REV-164 L-4). */
  saveIdle: '저장할 상황이 없어요.',
  save: (k: number) => `주제와 상황 ${k}개 저장`,
  saveTopicOnly: '주제만 저장',
  saving: '주제를 저장하고 있어요…',
  savingScenario: (i: number, k: number) => `상황 ${i}/${k} 저장 중…`,
  regen: '다시 만들기',
  regenAsk: '주제 초안을 다시 만들까요? 지금 고친 내용은 사라져요.',
  regenYes: '다시 만들기',
  discard: '버리기',
  discardTitle: '초안을 버릴까요?',
  discardBody: '버린 초안은 되돌릴 수 없어요.',
  leaveTitle: '나갈까요?',
  leaveBody: '고치던 초안은 이 탭에 남아 있어서 다시 들어오면 이어서 고칠 수 있어요.',
  leave: '나가기',
  stay: '계속 고치기',
} as const

export const SCDRAFT = {
  head: '상황 초안',
  pick: (k: number, n: number) => `저장할 상황 ${k}/${n}`,
  intro: '주제와 함께 저장할 상황을 골라요. 저장한 뒤에도 따로 만들거나 고칠 수 있어요.',
  gen: '선생님이 이 주제로 상황 초안을 만들고 있어요',
  genSub: '보통 10~20초 걸려요. 그동안 위 표현을 먼저 고쳐도 돼요.',
  cancel: '그만두기',
  keep: '이 상황도 저장',
  /** 체크의 읽어 주는 이름 앞에 붙는 순번(REV-166 L-C) — 화면에 보이지 않는다. 제목이 같은 두 초안도 이름이 달라진다. */
  nth: (n: number) => `${n}번째 상황`,
  opening: (ko: string) => `첫마디 · ${ko}`,
  noOpening: '첫마디 없음',
  edit: '고치기',
  problems: (n: number) => `고칠 곳 ${n}군데`,
  more: '＋ 상황 하나 더 만들기',
  moreLabel: '어떤 상황을 하나 더 만들까요?',
  morePlaceholder: '예: 약을 받으며 먹는 법을 묻는 상황',
  moreSubmit: '상황 초안 만들기',
  moreBusy: '앞 상황 초안을 만드는 중이에요.',
  fail: '상황 초안은 만들지 못했어요. 주제만 저장하고 상황은 나중에 만들 수도 있어요.',
  retry: '다시 만들기',
  unfit: '이 주제로는 상황 초안을 만들기 어려워요. 아래에 상황을 한 줄로 적어 다시 만들어 보세요.',
  placeFixed: (t: string) => `장소 · ${t} (저장할 때 이 주제에 이어져요)`,
  backToReview: '주제 초안',
  done: '완료',
  /** 요청 본문용 — 화면에 보이지 않는다. */
  fallbackDesc: (t: string) => `${t} 상황에서 나누는 대화`,
} as const

export const PARTIAL = {
  title: '주제는 저장했어요',
  body: (m: number) => `상황 ${m}개는 저장하지 못했어요. 주제와 상황은 따로 저장돼요.`,
  topicLocked: '주제는 저장됐어요. 주제를 고치려면 주제 보기에서 고쳐요.',
  /** 응답을 받지 못해 실패한 상황이 있을 때만(REV-164 M-1) — #163 에 멱등 키가 없어 서버가 이미 저장했을 수 있다. */
  unsure: '응답을 받지 못한 상황은 이미 저장됐을 수 있어요. 다시 저장하면 같은 상황이 두 개 생길 수 있어요.',
  retry: '상황 다시 저장',
  later: '주제 보기로',
  laterTitle: '주제 보기로 갈까요?',
  laterBody: (m: number) => `저장하지 못한 상황 초안 ${m}개는 사라져요.`,
} as const

export const TOPIC = {
  back: '내 상황·주제',
  seedInfo: '기본 주제예요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요.',
  copyInfo: (date: string) => `✎ 내 버전이에요 · ${date}에 만들었어요`,
  revert: '기본으로 되돌리기',
  challenge: (t: string, d: number, len: number) => `「${t}」 챌린지 ${d}일째 · ${len}일`,
  challengeLink: '챌린지 보기',
  chunksHead: (n: number) => `기본 표현 ${n}개`,
  edit: '고치기',
  editAria: (t: string) => `「${t}」 주제 고치기`,
  scenariosHead: (n: number) => `이 주제의 상황 ${n}개`,
  scenariosEmpty: '이 주제로 만든 상황이 아직 없어요.',
  addScenario: '＋ 이 주제로 상황 만들기',
  remove: '주제 지우기',
  hide: '나에게서 숨기기',
  hideSub: '나에게만 숨겨지고, 다시 볼 수 있어요',
  copyRemove: '내 버전 지우기',
  copyRemoveSub: '내 버전을 지우면 기본 주제도 내 목록에서 숨겨져요',
  notFound: '이 주제를 찾을 수 없어요',
  notFoundBody: '지워졌거나 내 목록에서 숨긴 주제예요.',
  notFoundBtn: '내 상황·주제로',
  loading: '주제를 불러오는 중…',
} as const

export const EDIT = {
  title: '주제 고치기',
  seedInfo: '기본 주제예요. 저장하면 내 버전이 생겨요. 기본 주제는 그대로 남고, 언제든 되돌릴 수 있어요.',
  save: '저장',
  saveSeed: '내 버전으로 저장',
  lvlChanged: (a: string, b: string) => `수준을 바꿨어요 (${a} → ${b}). 기본 표현도 새 수준에 맞게 다시 받을까요?`,
  lvlNote: '받은 표현은 저장해야 바뀌어요. 새로 받은 표현은 연습 기록이 처음부터 쌓여요.',
  lvlRegen: '표현 다시 받기',
  lvlKeep: '지금 표현 두기',
  lvlGen: '선생님이 새 수준에 맞는 표현을 만들고 있어요',
  lvlFail: '표현을 받지 못했어요. 지금 표현은 그대로 있어요.',
  copied: '다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요.',
  openCopy: '내 버전 열기',
  useFork: '기본 주제라 내 버전으로 저장돼요. 다시 눌러 주세요.',
  chunkGone: '다른 곳에서 바뀐 표현이 있어요. 화면을 새로 고친 뒤 다시 고쳐 주세요.',
  /** S7 나가기 시트 본문(T5-4 — 가이드 §16-6 에 없어 developer 가 더함, 주제 만들기와 달리 이 탭에 남지 않는다). 제목·버튼은 `REVIEW.leaveTitle`·`leave`·`stay`. */
  leaveBody: '나가면 고친 내용은 저장되지 않아요.',
  /** 행 고치기에서 일본어 글이 원래 글과 달라졌을 때만(REV-163 M-3 — 데모에 없는 정보성 추가, 서버가 새 행으로 만들어 연습 기록이 0부터). */
  textChanged: '일본어 글을 바꾸면 이 표현의 연습 기록이 처음부터 다시 시작돼요.',
} as const

export type RemovalMode = 'delete' | 'copyDelete' | 'restore' | 'hide'

export const REMOVAL = {
  title: { delete: '주제를 지울까요?', copyDelete: '내 버전을 지울까요?', restore: '기본으로 되돌릴까요?', hide: '이 주제를 숨길까요?' } satisfies Record<RemovalMode, string>,
  loading: '무엇이 바뀌는지 확인하는 중…',
  /** 확인(#172)이 끝나기 전 실행 버튼 글자(§16-2 S8·S9 열기). */
  checking: '확인하는 중…',
  loadFail: '확인하지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도',
  warnTitle: '진행 중인 챌린지가 있어요',
  warn: {
    delete: (t: string, d: number) => `「${t}」 챌린지를 ${d}일째 하고 있어요. 지우면 이 챌린지도 함께 지워지고, 되돌릴 수 없어요.`,
    copyDelete: (t: string, d: number) => `「${t}」 챌린지를 ${d}일째 하고 있어요. 지우면 이 챌린지도 함께 지워지고, 되돌릴 수 없어요.`,
    restore: (t: string, d: number) => `「${t}」 챌린지를 ${d}일째 하고 있어요. 되돌리면 내 버전으로 하던 이 챌린지는 지워지고, 되돌릴 수 없어요.`,
    /** 경고가 아니라 안내(`InfoBox`) — 숨겨도 챌린지는 이어진다. */
    hide: (t: string) => `진행 중인 「${t}」 챌린지는 그대로 이어져요. 숨겨도 챌린지 화면에서 계속 공부할 수 있어요.`,
  },
  noActive: '진행 중인 챌린지는 없어요. 지우면 되돌릴 수 없어요.',
  noActiveRestore: '진행 중인 챌린지는 없어요.',
  goneHead: '함께 지워져요',
  goneScenarios: (n: number) => `이 주제에만 있는 내 상황 ${n}개`,
  goneChallenge: '진행 중인 챌린지',
  keepHead: '그대로 남아요',
  keepFinished: '완료한 챌린지 기록은 그대로 남아요',
  keepUnlinked: (n: number) => `다른 주제에도 있는 상황 ${n}개`,
  keepUnlinkedSub: '이 주제와의 연결만 빠져요',
  keepRecords: '수업·단어 기록과 단어장',
  restoreBody: '내가 고친 이름·설명·수준·기본 표현이 기본 내용으로 바뀌어요.',
  restoreHead: '기본 주제로 되돌아가요',
  relinked: (n: number) => `내 상황 ${n}개는 기본 주제에 다시 이어져요`,
  hideBody: '나에게만 숨겨져요. 다른 사람에게는 그대로 보여요. 「내 상황·주제」 맨 아래 「숨긴 기본 항목」에서 다시 볼 수 있어요.',
  copyDeleteBody: '내가 고친 주제가 지워지고, 기본 주제도 내 목록에서 숨겨져요. 「숨긴 기본 항목」에서 기본 주제를 다시 볼 수 있어요.',
  btn: { delete: '주제 지우기', copyDelete: '내 버전 지우기', restore: '기본으로 되돌리기', hide: '나에게서 숨기기' } satisfies Record<RemovalMode, string>,
  btnWithChallenge: { delete: '챌린지까지 지우기', restore: '챌린지까지 되돌리기' },
  cancel: '취소',
  busy: { delete: '지우는 중…', restore: '되돌리는 중…', hide: '숨기는 중…' },
  changed: '확인하는 사이에 바뀐 내용이 있어요. 아래 내용을 다시 확인하고 눌러 주세요.',
  fail: {
    delete: '지우지 못했어요. 아무것도 지워지지 않았어요. 다시 눌러 주세요.',
    restore: '되돌리지 못했어요. 아무것도 바뀌지 않았어요. 다시 눌러 주세요.',
    hide: '숨기지 못했어요. 다시 눌러 주세요.',
  },
  gone: '이 주제는 이미 지워졌어요.',
} as const

export const TOAST = {
  removed: (t: string, s: number, ch: boolean) =>
    `「${t}」 주제를 지웠어요${s > 0 ? ` · 상황 ${s}개도 함께 지웠어요` : ''}${ch ? ' · 진행 중인 챌린지도 지웠어요' : ''}`,
  hidden: (t: string) => `「${t}」 주제를 숨겼어요`,
  copyRemoved: (t: string) => `「${t}」 내 버전을 지웠어요 · 기본 주제는 숨긴 기본 항목에 있어요`,
  restored: (t: string) => `「${t}」 주제를 기본으로 되돌렸어요`,
  created: (t: string, k: number) => `「${t}」 주제를 저장했어요${k > 0 ? ` · 상황 ${k}개도 저장했어요` : ''}`,
  saved: '저장했어요',
  copySaved: '내 버전으로 저장했어요',
} as const

/** 서버 응답 → 화면 문구(§16-7). 고르는 규칙은 `failure.ts`, 문구는 여기 한 곳. 서버 `message` 는 쓰지 않는다. */
export const FAIL = {
  network: '인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
  userGone: '계정을 다시 확인해야 해요. 다시 로그인해 주세요.',
  writeRate: (s: number) => `잠시 뒤 다시 눌러 주세요. ${s}초 뒤에 할 수 있어요.`,
  /** 하루 한도의 남은 때 — 1시간 이상이면 시간(올림), 아니면 분(올림). */
  waitAbout: (sec: number) => (sec >= 3600 ? `약 ${Math.ceil(sec / 3600)}시간 뒤` : `약 ${Math.max(1, Math.ceil(sec / 60))}분 뒤`),
  engine: '잠시 문제가 생겼어요. 다시 만들어 볼까요?',
  topicDraft: {
    unfit: '이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인).',
    busy: '다른 화면에서 주제 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.',
    rate: (s: number) => `초안은 1분에 6번까지 만들 수 있어요. ${s}초 뒤 다시 눌러 주세요.`,
    daily: (wait: string) => `오늘은 주제 초안을 20번 모두 만들었어요. ${wait} 다시 만들 수 있어요.`,
  },
  scenarioDraft: {
    busy: '앞 상황 초안을 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요.',
    rate: (s: number) => `상황 초안은 1분에 6번까지 만들 수 있어요. ${s}초 뒤 다시 눌러 주세요.`,
    daily: '오늘은 상황 초안을 모두 만들었어요. 상황 초안과 변형 초안을 합쳐 하루 40번까지예요.',
  },
  topicSave: {
    limit: '내 주제는 30개까지예요. 안 쓰는 주제를 지운 뒤 다시 저장해 주세요.',
    daily: '오늘은 주제를 10번 저장했어요. 내일 다시 저장할 수 있어요. 고친 초안은 이 탭에 남아 있어요.',
    /** #174 내 버전 만들기도 같은 하루 10번을 쓴다. */
    dailyFork: '오늘은 주제를 10번 저장했어요(내 버전 만들기 포함). 내일 다시 저장할 수 있어요.',
    fail: '저장하지 못했어요. 아무것도 저장되지 않았어요. 다시 눌러 주세요.',
  },
  scenarioSave: {
    limit: '내 상황이 50개라 더 저장할 수 없어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.',
    daily: '오늘은 상황을 30개 저장했어요. 내일 다시 저장할 수 있어요.',
    fail: '잠시 문제가 생겼어요. 다시 눌러 주세요.',
  },
  seedGone: '기본 항목을 찾을 수 없어요. 목록을 새로 고칠게요.',
  notOverridden: '이미 기본으로 돌아가 있어요.',
  scenarioGone: '이 상황은 이미 목록에 없어요.',
  scenarioHideFail: '숨기지 못했어요. 다시 눌러 주세요.',
  scenarioRevertFail: '되돌리지 못했어요. 다시 눌러 주세요.',
  opening: {
    required: '선생님 첫마디를 적어 주세요.',
    noHangul: '한국어로 적어 주세요.',
    max: '첫마디는 80자까지 적을 수 있어요.',
    unfit: '선생님이 처음 건넬 말을 적어 주세요. 예: 어서 오세요, 무엇을 드릴까요?',
    tooLong: '첫마디가 길어서 일본어 한 줄로 만들기 어려워요. 조금 줄여 주세요.',
    busy: '앞에서 누른 일본어를 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요.',
    rate: (s: number) => `일본어 만들기는 1분에 10번까지예요. ${s}초 뒤 다시 눌러 주세요.`,
    daily: (wait: string) => `오늘은 일본어 만들기를 60번 모두 했어요. ${wait} 다시 할 수 있어요.`,
    fail: '일본어로 바꾸지 못했어요. 다시 해 볼까요?',
    failKeep: '한국어는 그대로 있어요.',
  },
  variant: {
    baseGone: '원본 상황을 찾을 수 없어요. 지웠거나 내 목록에서 숨긴 상황이에요.',
    noVariation: '바꿀 점을 하나 이상 골라 주세요.',
    unfit: '이 내용으로는 변형 상황을 만들기 어려워요. 바꿀 점을 다르게 적어 주세요.',
    busy: '다른 화면에서 변형 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.',
    rate: (s: number) => `변형 초안은 1분에 6번까지 만들 수 있어요. ${s}초 뒤 다시 눌러 주세요.`,
  },
  /** 400 칸 문구(§16-7 칸 문구 표). 칸 이름표는 고정 한글이라 조사를 미리 붙여 둔다. */
  field: {
    required: (label: FieldLabel) => `${FIELD_OBJ[label]} 적어 주세요.`,
    max: (label: FieldLabel, max: number) => `${FIELD_TOPIC[label]} ${max}자까지 쓸 수 있어요.`,
    /** 서버가 숨은·제어 글자·꺾쇠·링크 주소를 모두 `forbidden_char` 로 묶는다(`saveBody.ts`·`topicDraftSchemas.ts` `detectUnsafeTopicText`) — 셋 다 말한다. */
    forbiddenChar: '꺾쇠(< >)·링크 주소·눈에 보이지 않는 글자는 쓸 수 없어요.',
    /** 저장 경로는 카드 번호 모양 숫자열, 초안 경로(#170·#166·#178)는 긴 영문·숫자 토큰(키)도 이 reason 으로 막는다(`isSecretLikeText`·`hasCardLikeDigits`). */
    secretLike: '비밀번호·카드 번호·긴 영문 숫자 키처럼 보이는 글은 쓸 수 없어요.',
    notJapanese: '일본어로 적어 주세요.',
    chars: '쓸 수 없는 글자가 있어요.',
    reading: '읽기는 히라가나·가타카나로만 적어 주세요.',
    duplicate: '같은 표현이 이미 있어요.',
    count: (n: number | null) => `기본 표현은 8~20개여야 해요.${n === null ? '' : ` 지금 ${n}개예요.`}`,
    enum: '목록에서 골라 주세요.',
    engineName: '이 칸에는 쓸 수 없는 낱말이 있어요.',
    noHangul: '한국어로 적어 주세요.',
    chunkGone: '다른 곳에서 바뀐 표현이 있어요. 화면을 새로 고친 뒤 다시 고쳐 주세요.',
    notLinked: '지금 목록에 없는 장소예요. 목록을 새로 고친 뒤 다시 골라 주세요.',
    defect: '저장하지 못했어요. 화면을 새로 고친 뒤 다시 해 주세요.',
  },
} as const

export type FieldLabel = 'title' | 'topic' | 'titleJa' | 'description' | 'level' | 'chunks' | 'textJa' | 'reading' | 'meaningKo' | 'opening'

/** 「…을/를」 꼴. */
const FIELD_OBJ: Record<FieldLabel, string> = {
  title: '주제 이름을',
  topic: '주제를',
  titleJa: '일본어 이름을',
  description: '설명을',
  level: '수준을',
  chunks: '기본 표현을',
  textJa: '일본어를',
  reading: '읽기를',
  meaningKo: '뜻을',
  opening: '선생님 첫마디를',
}

/** 「…은/는」 꼴. */
const FIELD_TOPIC: Record<FieldLabel, string> = {
  title: '주제 이름은',
  topic: '주제는',
  titleJa: '일본어 이름은',
  description: '설명은',
  level: '수준은',
  chunks: '기본 표현은',
  textJa: '일본어는',
  reading: '읽기는',
  meaningKo: '뜻은',
  opening: '선생님 첫마디는',
}
