/**
 * 채택 교정 모음(`/drawer/corrections`, task-055)의 문구 단일 출처(screens.md §21-9). 승인 데모 v1 원문과 한 글자도 다르지 않다.
 * 순수 모듈 — 자리표시(`CorrectionsSkeleton`)와 분절(`DrawerSwitch`)도 읽으므로 화면 부품을 import 하지 않는다.
 *
 * 일본어가 섞일 수 있는 검색어(q)가 들어가는 문구는 화면이 `JaRuns` 로 일본어 구간에만 `lang="ja"` 를 달아야 해서 **조각**으로 둔다
 * (`quoteOpen` + q + `quoteClose` + 꼬리). 같은 문구의 이어 붙인 전체 문자열 함수(`headSearch`·`emptySearchTitle`)는 시험·aria 용이다.
 * 굵게 그리는 곳(빈 상태의 [채택]·조건)도 조각으로 둔다. 숫자는 `ko-KR` 자리 구분.
 * 다른 곳에서 가져오는 문구는 여기 다시 쓰지 않는다: ← 이름 `CORRECTIONS_RETURN_LABEL`(shell/correctionsReturn) · `SKELETON_SR_LABEL` ·
 * `DISPLAY_COPY` · `EXTRA_NOTE_LABEL` · `ERROR_TYPE_LABEL`·`CHUNK_LABEL`(chat/labels) · 조각 칩 `CHUNK_FILTER_ALL`·`CHUNK_FILTER_CHIPS` · `WORD_NOT_FOUND`.
 */
import { CHUNK_LABEL, ERROR_TYPE_LABEL } from '@/components/chat/labels'
import type { ChatKind, ChunkType, ErrorType } from '@/types/chat'

const num = (n: number) => n.toLocaleString('ko-KR')

export const CORRECTIONS_COPY = {
  // 분절(D1 A)
  switchNav: '단어장 보기',
  switchWords: '단어',
  switchCorrections: '채택한 교정',
  /** 문서 제목(앱바 h1 은 「단어장」 그대로 — 지금 위치는 분절 aria-current 가 알린다). */
  docTitle: '채택한 교정 · 단어장',

  // 거르기
  search: '문장이나 설명으로 찾기',
  searchTooLong: '검색어는 40자까지예요',
  typeLabel: '유형',
  typeAllSr: ' (모든 유형)',
  typeCountSr: '개',

  // 머리 줄
  listLabel: '채택한 교정 목록',
  head: (n: number) => `채택한 교정 ${num(n)}개`,
  quoteOpen: '‘',
  quoteClose: '’',
  /** ‘{q}’ 뒤 꼬리 — 화면은 `quoteOpen` + `<JaRuns q>` + `quoteClose` + 이것. */
  headSearchTail: (n: number) => ` 검색 결과 ${num(n)}개`,
  headSearch: (q: string, n: number) => `‘${q}’ 검색 결과 ${num(n)}개`,
  /** 머리 줄·E2 에서 조건 앞 구분자(조건 글자는 굵게). */
  condSep: ' · ',

  // 카드
  acceptedOnSr: '채택한 날 ',
  mineSr: '내 문장: ',
  fixSr: '고친 문장: ',
  major: '중요',
  kind: { TALK: '회화', CHAT: '채팅' },
  goChat: '원래 대화 보기 ›',
  goChatAria: (kindLabel: string, title: string) => `${kindLabel} ‘${title}’에서 이 교정 보기`,
  /** [단어 {surface} 보기 ›] — 화면은 `goWordLead` + `<span lang="ja">{surface}</span>` + `goWordTail`. */
  goWordLead: '단어',
  goWordTail: '보기 ›',
  goWord: (surface: string) => `단어 ${surface} 보기 ›`,

  // 더 보기
  more: '교정 더 보기',
  moreBusy: '불러오는 중…',
  moreError: '교정을 더 불러오지 못했어요. 다시 눌러 주세요.',
  end: (n: number) => `채택한 교정을 모두 봤어요 · ${num(n)}개`,

  // 오류
  loadErrorNetwork: '교정을 불러오지 못했어요. 네트워크를 확인해 주세요.',
  loadError: '교정을 불러오지 못했어요.',
  retry: '다시 시도',

  // E1 처음 비어 있음
  emptyFirstTitle: '아직 채택한 교정이 없어요',
  /** [앞, 굵게, 뒤] — 「…문장 아래 **[채택]**을 누르면 …」 */
  emptyFirstBody: [
    '회화나 채팅에서 선생님이 고쳐 준 문장 아래 ',
    '[채택]',
    '을 누르면 여기에 모여요. 모아 둔 문장은 언제든 다시 읽고, 원래 대화로 돌아가 볼 수 있어요.',
  ],
  /** 장식 그림(aria-hidden) — 「駅[に]降りて…」「駅[で]降りて…」, 괄호 부분이 지운·넣은 글자. */
  emptyFirstPic: {
    mine: '내 문장',
    fix: '이렇게 고쳐요',
    head: '駅',
    removed: 'に',
    added: 'で',
    tail: '降りて…',
    accept: '채택',
    reject: '무시',
  },
  goTalk: '회화하러 가기',
  goChatList: '채팅하러 가기',

  // E2 조건 0건
  emptyFilterTitle: '조건에 맞는 교정이 없어요',
  /** 굵은 조건 뒤 꼬리 — 「**{조건}** — 다른 조건을 골라 보세요.」 */
  emptyFilterBodyTail: ' — 다른 조건을 골라 보세요.',
  clearFilter: '조건 풀기',

  // E3 검색 0건
  /** ‘{q}’ 뒤 꼬리 — 화면은 `quoteOpen` + `<JaRuns q>` + `quoteClose` + 이것. */
  emptySearchTitleTail: '와 맞는 교정이 없어요',
  emptySearchTitle: (q: string) => `‘${q}’와 맞는 교정이 없어요`,
  emptySearchBody: '내 문장·고친 문장·설명에서 찾았어요.',
  emptySearchWithCond: ' 유형·조각 조건도 함께 걸려 있어요.',
  clearSearch: '검색 지우기',

  // 단어 시트(D6)
  wordRemoved: '삭제했어요 · 지난 기록은 그대로 남아요',
} as const

/** 카드 출처 줄·링크 이름의 대화 종류 — 회화(TALK)만 「회화」, 그 밖은 「채팅」(데모 `kindKo`, ASK 는 계약상 교정이 없다). */
export function kindLabel(kind: ChatKind): string {
  return kind === 'TALK' ? CORRECTIONS_COPY.kind.TALK : CORRECTIONS_COPY.kind.CHAT
}

/** 머리 줄·E2 의 굵은 조건 글자 — 「활용 · 액션 조각」/「조사」/「이름 조각」, 조건이 없으면 null. */
export function conditionText(errorType: ErrorType | null | undefined, chunkType: ChunkType | null | undefined): string | null {
  const parts = [errorType ? ERROR_TYPE_LABEL[errorType] : null, chunkType ? CHUNK_LABEL[chunkType] : null].filter((s): s is string => !!s)
  return parts.length ? parts.join(CORRECTIONS_COPY.condSep) : null
}
