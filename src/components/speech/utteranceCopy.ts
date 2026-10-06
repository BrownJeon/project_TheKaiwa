/**
 * 재확인 카드 · 직접 고치기 시트 · 내 발화 기록 · 설정 진입 줄 문구(task-012b-2 가이드 §7, 단일 출처).
 * 엔진 이름·"분석"·"인식률"·신뢰도 숫자는 쓰지 않는다 — 분석 결과는 "다시 들어 본", 실시간 인식은 "처음 들린".
 */
import type { UtteranceFinalSource } from '@/types/speech'

export const REVIEW_COPY = {
  // ⓐ 접힘 줄
  title: '들린 말 확인',
  teaser: '다시 들어 보니 다르게 들렸어요',
  // ⓑ 안내
  intro: '다시 들어 보니 다르게 들린 곳이 있어요. 내가 실제로 한 말을 골라 주세요.',
  legend: '내가 한 말 고르기',
  diffSr: '두 문장에서 서로 다른 곳에 밑줄이 있어요.',
  // ⓒ 두 안
  realtimeHead: '이렇게 들렸어요',
  realtimeSub: '선생님은 이 말을 듣고 답했어요',
  analysisHead: '이렇게도 들렸어요',
  analysisSub: '한 번 더 들어 본 결과예요',
  // ⓓ 한 안
  noSecond: '한 번 더 들어 봤지만 알아듣지 못했어요.',
  keepAsIs: '이대로 기록하기',
  // ⓔ 버튼
  save: '이걸로 기록하기',
  saving: '기록하는 중…',
  fix: '직접 고치기',
  later: '나중에',
  pickFirst: '먼저 하나를 골라 주세요.',
  // ⓕ 효과
  effect: '고른 말은 내 발화 기록에만 남아요. 이미 보낸 말과 교정은 그대로예요. 한 번 고르면 바꿀 수 없어요.',
  // ⓖ 소리 힌트(방만)
  audioHint: '말풍선 아래 ▶ 내 목소리로 들어 보고 골라도 돼요.',
  // ⓘ 실패
  already: '이미 확인한 말이에요.',
  missing: '이 기록을 찾을 수 없어요.',
  rate: '잠시 후 다시 눌러 주세요.',
  offline: '연결하지 못했어요. 네트워크를 확인해 주세요.',
  failed: '기록하지 못했어요. 다시 눌러 주세요.',
} as const

/** ⓗ 성공 줄 — 고른 출처별. */
export const REVIEW_DONE: Record<UtteranceFinalSource, string> = {
  REALTIME: '✓ 기록했어요 · 처음 들린 말로',
  ANALYSIS: '✓ 기록했어요 · 다시 들어 본 말로',
  USER: '✓ 기록했어요 · 내가 고친 말로',
}

/** ⓙ 직접 고치기 시트. */
export const FIX_COPY = {
  title: '직접 고치기',
  intro: '내가 실제로 한 말을 일본어로 적어 주세요.',
  label: '내가 한 말',
  count: (n: number) => `${n}/1000`,
  empty: '한 글자 이상 적어 주세요.',
  tooLong: '1,000자 안으로 적어 주세요.',
  save: '이대로 기록하기',
  saving: '기록하는 중…',
  cancel: '취소',
} as const

/** ⓚ·ⓛ·ⓜ 내 발화 기록 화면. */
export const LOG_COPY = {
  title: '내 발화 기록',
  back: '설정으로',
  intro: '말로 한 문장이 어떻게 기록됐는지 볼 수 있어요.',
  filterAria: '보기',
  all: '전체',
  review: (n: number) => (n > 0 ? `확인 필요 ${n}` : '확인 필요'),
  listAria: '내 발화 기록',
  seconds: (s: number) => `${s}초`,
  mine: '▶ 내 목소리',
  mineAria: (clock: string) => `${clock}에 한 말 녹음 듣기`,
  check: '확인하기',
  expired: '녹음 보관 기간(30일)이 지났어요',
  missingToast: '녹음이 없어요. 내 목소리는 30일 동안만 보관해요.',
  more: '더 보기',
  loading: '불러오는 중…',
  end: '처음 기록까지 다 봤어요',
  error: '기록을 불러오지 못했어요.',
  moreError: '더 불러오지 못했어요.',
  retry: '다시 시도',
  emptyLines: ['아직 말로 한 기록이 없어요.', '회화에서 버튼을 누른 채로 말하면 여기에 쌓여요.'],
  emptyGo: '회화하러 가기',
  emptyReview: '확인할 말이 없어요.',
  notes: [
    '녹음은 30일 동안 보관한 뒤 자동으로 지워져요. 글자 기록은 남고, 여기서 지울 수는 없어요.',
    '기록을 고쳐도 이미 받은 평가 점수와 교정은 바뀌지 않아요.',
    '‘정확하게’ 인식 방식에서는 더 꼼꼼히 비교해서 확인할 말이 조금 더 생길 수 있어요.',
  ],
} as const

export const CHIP_COPY = {
  pending: '확인 필요',
  realtime: '처음 들린 말로 확인',
  analysis: '다시 들어 본 말로 확인',
  user: '내가 고친 말',
} as const

export const CONTEXT_COPY = {
  TALK: { label: '회화', link: '회화에서 보기' },
  LESSON: { label: '오늘의 회화', link: '수업에서 보기' },
  EVALUATION: { label: 'AI 평가', link: '평가에서 보기' },
  // 방은 남아 있는데 메시지로 가지 않은 말 — 방 칸이 남아 있어 데이터로 확실하다(REV-135 L-B).
  ROOM_ONLY: { label: '보내지 않은 말', link: null },
  // 방 연결도 없는 말 — 방 밖 녹음 · 지운 대화의 말 · 내지 않은 평가 답 녹음이 데이터로 갈리지 않는다 — 원인을 단정하지 않는다(REV-132 M-3).
  // 모르는 `context.kind` 도 이 문구로 보인다(`contextOf`).
  UNSENT: { label: '연결된 대화 없음', link: null },
  DELETED: { label: '지운 대화', link: null },
} as const

/** ⓝ 설정 진입 줄. */
export const ENTRY_COPY = {
  title: '내 발화 기록',
  sub: '말로 한 문장과 녹음(30일)을 볼 수 있어요',
  badge: (n: number) => `확인 ${n}`,
  aria: (n: number) => `내 발화 기록, 확인할 말 ${n}개`,
} as const
