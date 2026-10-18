/**
 * 회화방 일본어 도우미 문구 단일 출처(screens §22-7, 데모 v1 문구 그대로). 엔진·모델 이름이 들어간 문구는 없다.
 * 꼬리표·뜻·이유 문장은 서버가 주고 화면은 만들지 않는다.
 * `'lesson'`(오늘의 회화 ⑤ 말하기, task-077 §34-6)은 과제와 무관한 일반 문장 예시다 — 레슨 맥락을 프롬프트에 넣지 않으므로(B2 A) 과제 맞춤 예시를 만들지 않는다.
 */

/** 질의 글자 수 상한(코드포인트) — 서버 `PHRASE_HELP_LIMITS.queryMax` 와 같다. */
export const HELPER_MAX = 100
/** 이 글자 수부터 「n/100」 을 보인다. */
export const HELPER_COUNT_FROM = 90

export type HelperRoomKind = 'talk' | 'rp' | 'lesson'

export const HELPER = {
  button: '일본어 도우미',
  tip: '한국어로 물어보면 일본어로 알려 줘요',
  tipClose: '안내 닫기',
  title: '일본어 도우미',
  sub: '하고 싶은 말을 한국어로 물어보세요',
  close: '일본어 도우미 닫기',
  inputLabel: '한국어로 물어볼 말',
  ask: '물어보기',
  placeholder: { talk: '예: 목이 쉬었어요', rp: '예: 얼음 적게 해 주세요', lesson: '예: 주말에 친구를 만났어요' } satisfies Record<HelperRoomKind, string>,
  empty: '물어볼 말을 한국어로 써 주세요',
  count: (n: number) => `${n}/${HELPER_MAX}`,
  over: (n: number) => `${HELPER_MAX}자까지 물어볼 수 있어요 · ${n}/${HELPER_MAX}`,
  examplesLead: '이렇게 물어보세요',
  examples: {
    talk: ['목이 쉬었어요', '천천히 말해 주세요', '다음에 또 가고 싶어요'],
    rp: ['얼음 적게 해 주세요', '빨대는 필요 없어요', '여기서 마실게요'],
    lesson: ['주말에 친구를 만났어요', '요리하는 걸 좋아해요', '조금 더 연습하고 싶어요'],
  } satisfies Record<HelperRoomKind, readonly string[]>,
  loadingSr: '일본어 표현을 찾는 중…',
  slow: '조금만 기다려 주세요',
  found: (n: number) => `표현 ${n}개를 찾았어요`,
  listAria: '일본어 표현',
  altsAria: '다른 말투',
  more: (n: number) => `다른 말투 ${n}개 더 보기`,
  less: '다른 말투 접기',
  listen: (ja: string) => `${ja} 듣기`,
  stop: (ja: string) => `${ja} 멈추기`,
  fill: '입력창에 넣기',
  none: '이 말에 맞는 일본어를 찾지 못했어요.',
  noneHint: (ex: string) => `짧은 한국어 문장으로 다시 써 보세요. 예: ‘${ex}’`,
  noneExample: { talk: '천천히 말해 주세요', rp: '얼음 적게 해 주세요', lesson: '주말에 친구를 만났어요' } satisfies Record<HelperRoomKind, string>,
  error: '지금은 표현을 가져오지 못했어요.',
  timeout: '시간이 오래 걸려 멈췄어요. 다시 물어봐 주세요.',
  retry: '다시 시도',
  rate: (n: number) => `${n}초 뒤 다시 물어볼 수 있어요.`,
  rateDone: '잠시 뒤 다시 물어봐 주세요.',
  busy: '선생님 말이 끝나면 다시 물어봐 주세요.',
  /** 말하기·회화 턴을 시작해 아직 답이 오지 않은 요청을 멈췄을 때 — 안내 줄에 보인다(오류가 아니다). */
  cancelled: '말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요.',
  locked: '말하는 중에는 열 수 없어요',
  /** 선생님이 답을 만드는 중(대기·생각) — 턴의 AI 호출이 도우미 뒤로 밀리지 않게 잠근다(QA-B2, 사용자 결정 2026-10-11). */
  lockedTurn: '선생님이 답하는 중에는 열 수 없어요',
  /** 오늘의 회화 ⑤ — 말한 답·쓴 답을 확인하는 중(#62b, task-077 B5 A). */
  lockedCheck: '답을 확인하는 중에는 열 수 없어요',
} as const
