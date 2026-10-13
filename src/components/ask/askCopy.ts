/**
 * 「무엇이든 물어보세요」 화면 문구 단일 출처(task-064 §25-10 → task-066 §26-10 A). 승인 데모 원문과 같다 — ★ 표시는 데모에 없어 가이드가 정한 것.
 * 엔진·모델·호스트 이름·티켓 용도 이름은 어디에도 없다. 숫자는 `toLocaleString('ko-KR')`. 말로 묻기 문구는 `askVoiceCopy.ts`.
 */
import type { AskSourceType } from '@/types/ask'

export const ASK_COPY = {
  title: '질문',

  /** 보내는 중 임시 말풍선(§26-3 C 2) — `AskQuestionBubble` 이 쓴다(가이드 「뺌」 목록에 있으나 쓰는 곳이 남아 둔다). */
  asking: '보내는 중…',
  emptyAsk: '질문을 적어 주세요',
  tooLong: '1,000자까지 보낼 수 있어요',

  /** 빈 대화의 안내 말풍선(§26-5 D, 데모 `greet()`). 굵은 곳은 화면이 `leadBold` 로 나눠 그린다. */
  greeting: {
    leadHead: '무엇이든 물어보세요. 일본어 표현·문법도, ',
    leadBold: '내 공부 기록',
    leadTail: '(교정·복습·수업)도 좋아요.',
    chipsLabel: '글로 물어보기 · 누르면 바로 물어봐요',
    examples: [
      { tag: '문법', q: '〜ている 와 〜てある 차이가 뭐예요?' },
      { tag: '내 기록', q: '이번 주에 내가 자주 틀린 조사 알려줘' },
      { tag: '복습', q: '오늘 복습할 거 뭐 있어?' },
    ],
    voiceHead: '모르는 일본어는 🎤 로 그대로 말해 보세요',
    voiceBody: '뜻·읽기·느낌을 예문과 함께 알려 줘요. 예)',
    voiceExamples: ['大丈夫', 'お疲れ様でした', 'それはちょっと難しいですね'],
  },

  /** 머리 「지난 질문」 알약·시트(§26-4). */
  history: {
    button: '지난 질문',
    running: '답 만드는 중',
    newAnswer: '새 답 도착',
    aria: (s: 'idle' | 'running' | 'new') => (s === 'running' ? '지난 질문 — 답 만드는 중' : s === 'new' ? '지난 질문 — 새 답 도착' : '지난 질문'),
    title: '지난 질문',
    current: '지금 대화',
    /** ★ */
    empty: '아직 지난 질문이 없어요.',

    // task-067 §27-4 F — 5개씩 쪽 넘기기.
    loadingSr: '지난 질문을 불러오고 있어요',
    emptyHint: '질문을 보내면 여기에 최근 순으로 쌓여요.',
    pageError: '이 쪽을 불러오지 못했어요',
    pagerAria: '지난 질문 쪽',
    prev: '이전',
    next: '다음',
    pageLabel: (p: number, n: number) => `${p.toLocaleString('ko-KR')} / ${n.toLocaleString('ko-KR')}`,
    totalLabel: (t: number) => `모두 ${t.toLocaleString('ko-KR')}개`,
    busyLabel: '불러오는 중…',
    pageSr: (p: number, n: number, t: number) => `${n.toLocaleString('ko-KR')}쪽 중 ${p.toLocaleString('ko-KR')}쪽 · 모두 ${t.toLocaleString('ko-KR')}개`,
    pagingSr: (p: number) => `${p.toLocaleString('ko-KR')}쪽을 불러오고 있어요`,

    // task-067 §27-5 E — 행 ⋯ 메뉴 · 시트에서 삭제.
    rowMore: (title: string) => `‘${title}’ 메뉴`,
    rowTitle: '이 대화',
    rename: '제목 바꾸기',
    toList: '목록으로',
    deleteBusyNote: '답을 받는 중이라 지금은 지울 수 없어요.',
    confirmQ: (title: string) => `‘${title}’ 대화를 삭제할까요?`,
  },

  /** task-067 §27-2 B · 27-3 F — 머리 「질문」 아래 지금 대화 제목 줄. */
  head: {
    newConv: '새 질문',
    aria: (title: string) => `질문 · 지금 대화 「${title}」 — 눌러서 제목 바꾸기`,
  },

  /** task-067 §27-3 F — 제목 바꾸기 칸(질문 대화 `variant='ask'`). */
  rename: {
    hint: '100자까지 · 비워 두면 저장할 수 없어요',
    count: (n: number) => `${n.toLocaleString('ko-KR')} / 100`,
    empty: '제목을 적어 주세요',
    over: '제목은 100자까지 쓸 수 있어요',
    fail: '제목을 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.',
    saved: '제목을 바꿨어요',
  },

  /** 입력 바 아래 보내는 범위 한 줄(§26-8 B). */
  scopeLine: {
    text: '내 학습 기록 일부가 AI 에 보내져요',
    more: '자세히',
    aria: '내 학습 기록 일부가 AI 에 보내져요 — 자세히, 선생님에게 보내는 범위',
  },

  listError: '지난 질문을 불러오지 못했어요',
  listErrorBody: '연결을 확인하고 다시 시도해 주세요.',
  retry: '다시 시도',

  running: '답 만드는 중',
  runningLine: '선생님이 답을 만드는 중이에요',
  newAnswer: '새 답',
  newAnswerSr: '새 답 도착',
  arrivedToast: '답이 도착했어요',
  noMessages: '아직 메시지가 없어요',
  deletedToast: '대화를 삭제했어요',

  menuAria: '질문 메뉴',

  placeholderNew: '무엇이든 물어보세요',
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
  /** ★ Leader L-1 — D1=B 라 데모의 「이 자리에서」는 거짓이 된다. */
  leaveLine: '다른 화면으로 가도 답은 계속 만들어져요. 돌아오면 「지난 질문」에서 볼 수 있어요.',
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

  /** ★ */
  notFoundTitle: '대화를 찾을 수 없어요',
  /** 대화 줄 「대화를 찾을 수 없어요」 안내의 링크 라벨(`useAskInput` 의 `notFoundLink`) — 시트의 `history.toList`(목록으로)와 다르다. */
  toList: '질문으로',
  /** ★ */
  loadError: '대화를 불러오지 못했어요.',
  loadErrorBody: '연결을 확인하고 다시 시도해 주세요. 새 질문은 그대로 보낼 수 있어요.',
  /** ★ `?chat=` 복원 중(§26-5 B). */
  loadingConv: '대화를 불러오고 있어요',
  /** ★ `?chat=` 의 대화가 없거나 남의 것(§26-3 B). */
  goneToast: '대화를 찾을 수 없어요',

  menu: {
    title: '질문 메뉴',
    noun: '대화',
    newQ: '새 질문 시작',
    scope: '보내는 범위 보기',
    displayHead: '일본어 표시 · 모든 화면에 적용',
    voiceHead: '말로 묻기',
    convHead: '이 대화',
    /** task-067 J7 — 낱말 「제목」 통일. */
    emptyNote: '아직 보낸 질문이 없어 제목 바꾸기·삭제는 없어요.',
    delete: '이 대화 삭제',
    deleteBusy: '답을 받는 중에는 지울 수 없어요',
    confirmTitle: '이 대화를 삭제할까요?',
    confirmBody: '질문과 답, 아직 고르지 않은 제안이 함께 지워져요. 이미 채택한 단어·주제·공부 기록은 그대로 남아요.',
    deleteFail: '삭제하지 못했어요. 잠시 뒤 다시 해 보세요.',
  },

  scope: {
    title: '선생님에게 보내는 범위',
    leadHead: '질문을 보내면 아래 내용이 ',
    leadBold: '선생님(외부 AI 서비스)',
    leadTail: '에게 전달돼요. 기록은 한 번에 20건·2,000자까지만 보내요.',
    sendHead: '보내는 것',
    noSendHead: '보내지 않는 것',
    /** 계약 §2-18-A 5항 D2=(b) = 승인 데모(task-066 v2) 문구 그대로(Leader L-5). 동의 문구라 원문을 바꾸지 않는다. */
    send: [
      '질문과 이 대화의 최근 메시지(12개까지)',
      '표시 이름·레벨 같은 학습자 정보',
      '공부 기록 요약 — 공부 횟수·점수·복습 예정 목록',
      '내가 채택한 교정의 원래 문장과 고친 문장',
      '수업에서 배운 표현',
    ],
    /** 셋째 줄(목소리)은 화면이 `voiceBold` 를 굵게 나눠 그리고 강조 바탕을 깐다. */
    noSend: ['이메일·계정 정보', '내부 번호(id)', '내 목소리 — 말로 물어도 선생님에게는 들린 글(일본어)만 가요', '다른 회화·채팅의 대화 내용'],
    voiceIndex: 2,
    voiceBold: '내 목소리',
    voiceBandBold: '말로 물어볼 때',
    voiceBandTail: ' — 일본어 음성 인식은 회화와 같은 방식(휴대폰, 또는 이 앱 서버)으로 글자로 바꿔요. 선생님에게는 그 글만 가요.',
    note: '이 앱은 내 대화·기록을 AI 학습 데이터로 쓰지 않아요. 이 안내는 ⋯ 메뉴 「보내는 범위 보기」에서도 볼 수 있어요.',
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
