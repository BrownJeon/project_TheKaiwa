/**
 * 사용자 주제(ConversationTopic, task-045) 저장 한도·입력 모양. 화면·라우트·서버(`learning/seedOverride`·T2 #57/#171)가 같은 값을 쓴다.
 * 서버 모듈을 import 하지 않는다. 정본 계약 `docs/design/topic-scenario-manager.md` §0 #8·§3.
 *
 * - 개수 한도(`minePerUser`·`createPerDay`)는 Leader 결정(§0 #8). 하루는 KST 자정 기준(상황 만들기 하루 한도와 같은 계산).
 * - 글자 상한 중 `titleMax` 는 주제 초안 계약(`topicDraft` title ≤20)과 같고, 나머지는 DB 칸 길이(VarChar)다 —
 *   사람이 고친 값의 내용 검사(이모지 접합 문자 허용·꺾쇠·URL·비밀 모양 금지)는 라우트가 conversation 의 검사로 먼저 한다.
 */
import type { JlptLevel } from './lesson'

export const TOPIC_LIMITS = {
  /** 내 주제(사본 포함) 수 상한 — 넘으면 409 `TOPIC_LIMIT`. */
  minePerUser: 30,
  /** 하루(KST) 주제 저장 상한(새 주제·시드 사본) — 넘으면 429 `DAILY_LIMIT`. */
  createPerDay: 10,
  titleMax: 20,
  titleJaMax: 80,
  descriptionMax: 300,
  /** 기본 표현 수 — 목록 조회가 주제당 40개까지 읽으므로 그 이상 저장하지 않는다. */
  chunksMin: 1,
  chunksMax: 40,
  chunkTextJaMax: 120,
  chunkReadingMax: 160,
  chunkMeaningMax: 160,
  chunkNoteMax: 200,
} as const

export type TopicChunkType = 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER'
export const TOPIC_CHUNK_TYPES: readonly TopicChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER']

export interface TopicChunkInput {
  chunkType: TopicChunkType
  textJa: string
  reading: string | null
  meaningKo: string
  note?: string | null
}

/**
 * 주제 저장 입력(#57 본문 · #174 fork 본문). fork 에서는 빠진 칸이 시드 값으로 채워진다(`chunks` 를 빼면 시드 조각을 그대로 복사).
 */
export interface TopicInput {
  title?: string
  titleJa?: string | null
  level?: JlptLevel
  description?: string | null
  chunks?: TopicChunkInput[]
}
