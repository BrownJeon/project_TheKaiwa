/**
 * 주제 만들기·고치기(task-045 T2 — #57 `POST /topics` · #171 `PATCH /topics/:id`)와 AI 주제 초안(#170 `POST /topics/drafts`)의 요청·응답 모양.
 * 화면(T5)·라우트·learning 서비스가 같은 값을 쓴다. 서버 모듈을 import 하지 않는다. 정본 계약 `docs/design/topic-scenario-manager.md` §3·§5.
 *
 * - 글자 상한은 **AI 초안 계약과 같다**(`conversation` `TOPIC_DRAFT_LIMITS` — 같은 값인지 단위 시험이 대조). `@/types/topic` `TOPIC_LIMITS` 의 넓은 값은 DB 칸 폭(백스톱)이다.
 * - 표현 수 8~20: 하한은 초안이 받아 주는 최소(`chunksMin`), 상한은 수업 조각 상한. 8~11개는 저장되지만 `CHUNKS_SHORT` 안내가 붙는다.
 */
import type { JlptLevel } from './lesson'
import type { TopicChunkType } from './topic'

export const TOPIC_SAVE_LIMITS = {
  titleMin: 1,
  titleMax: 20,
  titleJaMax: 20,
  descriptionMax: 120,
  chunksMin: 8,
  chunksMax: 20,
  textJaMax: 20,
  readingMax: 40,
  meaningMax: 30,
} as const

/** 저장 표현 한 개. `id` 는 #171 에서 기존 표현을 그대로 둘 때만(그 주제의 표현 id) — 없으면 새 표현. */
export interface TopicSaveChunk {
  id?: string
  chunkType: TopicChunkType
  textJa: string
  /** 가나만. 필수(검토 화면이 읽기를 보여 주는 것이 한자 읽기 오류의 마지막 방어선이라 비워 두지 않는다). */
  reading: string
  meaningKo: string
}

/** #57 본문(검사·정규화를 마친 값). `titleJa`·`description` 은 빈 글이면 null. */
export interface TopicCreateInput {
  title: string
  titleJa: string | null
  level: JlptLevel
  description: string | null
  chunks: TopicSaveChunk[]
}

/** #171 본문 — 보낸 칸만 바꾼다(한 칸 이상). `chunks` 를 보내면 그 목록이 새 전체 목록이다(배열 순서 = `order`, `id` 가 있는 것은 유지·수정, 빠진 기존 표현은 삭제). */
export type TopicUpdateInput = Partial<TopicCreateInput>

/** 저장을 막지 않는 안내 코드(초안·저장 공통 — `TITLE_TRUNCATED` 는 초안에서만). 화면 문구는 designer 가이드. */
export type TopicWarningCode =
  | 'CHUNKS_SHORT'
  | 'TYPE_THIN_NAME'
  | 'TYPE_THIN_ACTION'
  | 'TYPE_THIN_FEELING'
  | 'TYPE_THIN_MODIFIER'
  | 'DESCRIPTION_MISSING'
  | 'TITLE_JA_MISSING'
  | 'TITLE_TRUNCATED'

/** #170 요청 — `level` 이 없으면 학습자 수준. 주제 2~40자·보충 설명 ≤200자. */
export interface TopicDraftRequestBody {
  title: string
  level?: JlptLevel
  note?: string | null
}

/** #170 응답 200 — 저장 전 초안(행 없음). 학습자가 고친 뒤 이 모양 그대로(`chunks[].id` 없이) #57 로 보낸다. */
export interface TopicDraftApiResult {
  draft: {
    title: string
    titleJa: string | null
    level: JlptLevel
    description: string | null
    chunks: Array<{ chunkType: TopicChunkType; textJa: string; reading: string; meaningKo: string }>
  }
  warnings: TopicWarningCode[]
}

/** #57(201)·#171(200) 응답 — `topic` 은 #56 목록 항목과 같은 모양(새 주제는 `lessonCount 0`). */
export interface TopicSaveApiResult<TTopic = unknown> {
  topic: TTopic
  warnings: TopicWarningCode[]
}
