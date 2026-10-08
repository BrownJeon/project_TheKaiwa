/**
 * 「AI와 공부하기」 홈의 탭 값·분절 목록·탭별 문구(task-046 REV-171 M-1·L-6). 순수 모듈 — 화면(`StudyAiHome`)·서버 `page.tsx`·로딩 자리표시(`StudyAiSkeleton`)가
 * 같은 값을 읽어, 자리표시가 틀린 탭을 그렸다가 바뀌는 일이 없게 한다. 큰 화면 모듈을 끌어오지 않도록 따로 두었다.
 */
import { TALK_HOME } from '@/components/talk/talkCopy'

export type StudyAiTab = 'chat' | 'talk' | 'scenario'

export const STUDY_AI_TABS = [
  { value: 'talk', label: '회화' },
  { value: 'scenario', label: '시나리오' },
  { value: 'chat', label: '채팅' },
] as const

export const NEW_CHAT_LABEL = '＋ 새 채팅'
export const CHAT_SECTION_TITLE = '채팅'

/**
 * 주소의 `tab` 값 → 탭. `chat`·`scenario` 외(없음·빈 값·엉뚱한 값·같은 이름이 여러 번이라 배열인 경우)는 모두 회화.
 * 서버 `page.tsx` 와 로딩 자리표시가 **같은 함수**로 판정한다 — 자리표시는 `getAll('tab')` 로 서버 `searchParams` 와 같은 모양(한 번이면 문자열, 여러 번이면 배열)을 만들어 넘긴다.
 */
export function parseStudyAiTab(tab: string | string[] | null | undefined): StudyAiTab {
  return tab === 'chat' ? 'chat' : tab === 'scenario' ? 'scenario' : 'talk'
}

/** 회화·채팅 탭의 [새로 만들기] 버튼 문구 */
export function newButtonLabel(tab: 'talk' | 'chat'): string {
  return tab === 'talk' ? TALK_HOME.newTalk : NEW_CHAT_LABEL
}

/** 회화·채팅 목록 섹션 머리 글자 */
export function listSectionTitle(tab: 'talk' | 'chat'): string {
  return tab === 'talk' ? TALK_HOME.section : CHAT_SECTION_TITLE
}
