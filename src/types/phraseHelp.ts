/**
 * 회화방 일본어 도우미 #180 `POST /api/v1/chats/:id/phrase-help` 의 화면용 타입(task-056).
 * 서버 정본은 `conversation/structuredResponse/phraseHelp.ts` 의 `PhraseHelpItem` — 화면은 서버 모듈을 import 하지 않으므로
 * 같은 모양을 여기 복제한다(Leader 결정 3). 계약이 바뀌면 두 곳을 같이 고친다.
 */

export interface PhraseHelpRequest {
  /** 한국어로 하고 싶은 말 — 정리(trim) 뒤 1~100 코드포인트. */
  queryKo: string
}

export interface PhraseHelpItem {
  /** 일본어 표현(읽기 없음 — 화면이 #24r 로 만든다). */
  ja: string
  /** 한국어 뜻 — 늘 보인다(⑥A). */
  ko: string
  /** 후보가 2개 이상일 때만 오는 꼬리표(「정중하게」·「편하게」…). */
  labelKo?: string
  /** 왜 자연스러운지 한 줄(③A) — 없을 수 있다(정상). */
  whyKo?: string
}

/** 200 — 1~3개, 거절·못 찾음은 빈 배열. 첫 항목 = 가장 권하는 표현. */
export interface PhraseHelpResponse {
  items: PhraseHelpItem[]
}
