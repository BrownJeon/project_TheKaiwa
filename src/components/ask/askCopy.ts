/**
 * 「무엇이든 물어보세요」 화면 문구 단일 출처(task-064, screens.md §25-10). 승인 데모 v2 원문과 같다 — ★ 표시는 데모에 없어 가이드가 정한 것.
 * 엔진·모델·호스트 이름은 어디에도 없다. 숫자는 `toLocaleString('ko-KR')`.
 * 3a 범위 밖(주제 제안 카드·단어 근거·음성 입력) 문구는 두지 않는다(Leader 결정 L-2·L-10, D13).
 */
import type { AskSourceType } from '@/types/ask'

export const ASK_COPY = {
  title: '질문',
  roomsTitle: '지난 질문',
  more: '이전 질문 더 보기',
  moreBusy: '불러오는 중…',

  composerLabel: '선생님에게 물어보기',
  composerPlaceholder: '일본어 표현·문법이나 내 공부 기록을 물어보세요',
  ask: '물어보기',
  /** ★ */
  asking: '보내는 중…',
  emptyAsk: '질문을 적어 주세요',
  tooLong: '1,000자까지 보낼 수 있어요',
  scopeLink: '선생님에게 보내는 범위',

  examplesTitle: '이렇게 물어볼 수 있어요',
  /** 굵은 곳(「근거와 함께」)은 화면이 `examplesDescBold` 로 나눠 그린다. */
  examplesDescHead: '내 기록을 묻는 질문은 수업·교정·복습 기록을 찾아 ',
  examplesDescBold: '근거와 함께',
  examplesDescTail: ' 답해요.',
  examplesRowTitle: '예시',
  examples: [
    { tag: '문법', q: '〜ている 와 〜てある 차이가 뭐예요?' },
    { tag: '내 기록', q: '이번 주에 내가 자주 틀린 조사 알려줘' },
    { tag: '복습', q: '오늘 복습할 거 뭐 있어?' },
    { tag: '배운 표현', q: '역에서 길 물을 때 쓰던 표현 뭐였지?' },
  ],

  listError: '지난 질문을 불러오지 못했어요',
  listErrorBody: '연결을 확인하고 다시 시도해 주세요.',
  retry: '다시 시도',

  running: '답 만드는 중',
  runningLine: '선생님이 답을 만드는 중이에요',
  newAnswer: '새 답',
  newAnswerSr: '새 답 도착',
  arrivedToast: '답이 도착했어요',
  noMessages: '아직 메시지가 없어요',
  deletedToast: '질문 방을 삭제했어요',

  backLabel: '질문 목록으로',
  roomLoadingTitle: '질문',
  subtitle: (t: string) => `질문 · ${t}`,
  menuAria: '질문 방 메뉴',

  placeholder: '이어서 물어보세요',
  placeholderWaiting: '다음 질문을 미리 써요',
  placeholderScopeOwn: '기간을 적어 주세요 (예: 9월, 지난 2주)',
  inputLabel: '질문 입력',
  sendLocked: '답을 받은 뒤 보낼 수 있어요',

  answerAria: (t: string) => `${t} 답`,
  meSr: '나: ',
  meaningSr: '뜻: ',

  lowBold: '확실하지 않은 부분이 있어요.',
  lowWithSources: '근거를 눌러 직접 확인해 보세요.',
  lowNoSources: '중요한 건 한 번 더 확인해 보세요.',
  noneBold: '관련 기록을 못 찾았어요',
  noneTail: ' — 일반 설명으로 답할게요.',

  scopeGroup: '기간 고르기',
  scopeCaption: '눌러서 답하기',
  scopeOwn: '직접 쓸게요',

  sourcesHead: '근거로 본 내 기록',
  sourcesMore: (n: number) => `${n.toLocaleString('ko-KR')}개 더 보기`,
  sourcesLess: '접기',
  sourceType: {
    CORRECTION: '교정',
    LESSON: '수업',
    SCENARIO: '상황 연습',
    REVIEW: '복습',
    EVALUATION: '평가',
    STUDY_LOG: '공부 기록',
  } satisfies Record<AskSourceType, string>,
  sourceGlyph: {
    CORRECTION: '✎',
    LESSON: '書',
    SCENARIO: '話',
    REVIEW: '↻',
    EVALUATION: '✓',
    STUDY_LOG: '日',
  } satisfies Record<AskSourceType, string>,

  steps: ['질문 살펴보기', '답 쓰기', '정리하기'],
  stageMain: ['질문을 살펴보고 있어요', '선생님이 답을 쓰는 중이에요', '답을 정리하고 있어요'],
  secSuffix: (n: number) => ` · ${n.toLocaleString('ko-KR')}초`,
  hint30: '내 기록을 살펴보는 질문은 1분 넘게 걸릴 수 있어요.',
  hint90: '거의 다 됐어요. 2분이 지나면 멈추고 알려 드려요.',
  leaveLine: '다른 화면으로 가도 답은 계속 만들어져요. 돌아오면 이 질문 방에서 볼 수 있어요.',
  arrivedLive: (t: string, n: number, m: number) =>
    [`${t} 답이 도착했어요`, n > 0 ? `근거 ${n.toLocaleString('ko-KR')}개` : '', m > 0 ? `제안 ${m.toLocaleString('ko-KR')}개` : ''].filter(Boolean).join(' · '),

  failTimeout: '답이 너무 오래 걸려 멈췄어요',
  failTimeoutBody: '2분 안에 답을 만들지 못했어요. 다시 받거나, 질문을 둘로 나눠 물어보세요.',
  failUnavail: '선생님이 지금 답할 수 없어요',
  failUnavailBody: '잠시 뒤 다시 받아 보세요. 질문은 저장돼 있어요.',
  retryGet: '다시 받기',
  retryGetBusy: '다시 받는 중…',

  rate: (n: number) => `질문을 너무 자주 보냈어요. ${n.toLocaleString('ko-KR')}초 뒤에 보낼 수 있어요.`,
  /** ★ */
  rateMin: (m: number) => `질문을 너무 자주 보냈어요. ${m.toLocaleString('ko-KR')}분 뒤에 보낼 수 있어요.`,
  /** ★ — 하루 한도(`retryAfterSec` > 3600, Leader L-11). */
  rateDay: '질문을 너무 자주 보냈어요. 오늘은 더 보낼 수 없어요 — 내일 다시 물어봐 주세요.',
  /** ★ Leader 알림 — `429 { reason:"ASK_BUSY" }`. */
  askBusy: (n: number) => `지금 질문이 몰려 있어요. ${n.toLocaleString('ko-KR')}초 뒤에 다시 물어봐 주세요.`,
  askBusyNoSec: '지금 질문이 몰려 있어요. 잠시 뒤에 다시 물어봐 주세요.',
  net: '보내지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.',

  notFoundTitle: '질문 방을 찾을 수 없어요',
  notFoundBody: '지워졌거나 주소가 잘못됐어요.',
  toList: '질문 목록으로',
  /** ★ */
  loadError: '질문 방을 불러오지 못했어요.',

  menu: {
    title: '질문 방 메뉴',
    noun: '질문 방',
    scope: '보내는 범위 보기',
    delete: '질문 방 삭제',
    deleteBusy: '답을 받는 중에는 지울 수 없어요',
    confirmTitle: '이 질문 방을 삭제할까요?',
    confirmBody: '질문과 답, 아직 고르지 않은 제안이 함께 지워져요. 이미 채택한 단어·주제·공부 기록은 그대로 남아요.',
    deleteFail: '삭제하지 못했어요. 잠시 뒤 다시 해 보세요.',
  },

  scope: {
    title: '선생님에게 보내는 범위',
    leadHead: '내 공부 기록을 근거로 답할 때, 질문과 함께 아래 내용이 ',
    leadBold: '선생님(외부 AI 서비스)',
    leadTail: '에게 전달돼요. 한 번에 기록은 20건·2,000자까지만 보내요.',
    sendHead: '보내는 것',
    noSendHead: '보내지 않는 것',
    /** 계약 §2-18-A 5항 D2=(b) = 승인 데모 v2 문구 그대로(Leader L-5). 바꾸면 안내 키(`ASK_KEYS.scopeNotice`) 버전을 올린다. */
    send: [
      '질문과 이 질문 방의 최근 대화(12개까지)',
      '표시 이름·레벨 같은 학습자 정보',
      '공부 기록 요약 — 공부 횟수·점수·복습 예정 목록',
      '내가 채택한 교정의 원래 문장과 고친 문장',
      '수업에서 배운 표현',
    ],
    noSend: ['이메일·계정 정보', '내부 번호(id)', '다른 회화·채팅의 대화 내용'],
    note: '이 앱은 내 대화·기록을 AI 학습 데이터로 쓰지 않아요.',
    noteFirstTail: ' 이 안내는 질문 방 메뉴 ⋯ 「보내는 범위 보기」에서 다시 볼 수 있어요.',
    ok: '알겠어요, 보내기',
    cancel: '취소',
    close: '닫기',
  },

  level: {
    cap: '레벨 제안',
    sr: (f: string | null, toRo: string) => (f ? `${f}에서 ${toRo} 올리기` : `${toRo} 올리기`),
    body: (to: string) => `바꾸면 수업·단어가 ${to} 기준이 돼요. 설정에서 언제든 되돌릴 수 있어요.`,
    note: '선생님 제안이에요. 바꾸기를 눌러야 레벨이 바뀌어요.',
    accept: (toRo: string) => `${toRo} 바꾸기`,
    reject: '지금은 그대로',
    done: (toRo: string) => `✓ 레벨을 ${toRo} 바꿨어요 · 설정에서 언제든 되돌릴 수 있어요`,
    toast: (toRo: string) => `레벨을 ${toRo} 바꿨어요`,
    /** ★ `fromLevel` 이 없을 때(Leader L-3 — 서버가 채우지 못한 옛 행). */
    rejected: (f: string | null) => (f ? `레벨은 ${f} 그대로예요` : '레벨은 그대로예요'),
    expired: '기한이 지난 제안이에요',
  },

  studyLog: {
    q: '이 질문을 공부 기록으로 남길까요?',
    note: '남기면 달력에 「질문」 기록이 생겨요. 선생님 제안이라 남기기를 눌러야 저장돼요.',
  },
} as const
