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

// ── 주제 삭제(#172 사전 조회 · #173 삭제 · #176 내 버전 되돌리기) — 계약 §4 ──────────────

/** 오류 `details.reason` — `TOPIC_GONE`(404: 주제가 없거나 사라짐·가려짐) · `IMPACT_CHANGED`(409: 확인 뒤 삭제 영향이 바뀜, `details.preview` 에 새 사전 조회). */
export type TopicErrorReason = 'TOPIC_GONE' | 'IMPACT_CHANGED'

/** 삭제 확인 `ack` 값 — 진행 중 챌린지가 없으면 이 값, 있으면 그 챌린지 id. */
export const TOPIC_REMOVAL_ACK_NONE = 'none'

export interface TopicRemovalScenarioRef {
  id: string
  title: string
}

/**
 * 주제 지우기 규칙 두 갈래(T3-1b, Leader 결정).
 * - `DELETE`  : #173 "지우기" — 그 주제에만 붙은 내 상황은 보관, 다른 연결이 있는 상황은 연결만 끊음. 내 버전(사본)을 지우면 시드는 그 사용자 목록에서
 *               숨김으로 남고(override `copyId=null`) 내 상황을 시드 주제에 되돌려 붙이지 않는다.
 * - `RESTORE` : #176 "기본으로 되돌리기"(주제 사본만) — 사본에 붙은 내 상황을 시드 주제로 되돌려 붙이고(보관 방지) override 를 지운다(시드가 다시 보임).
 * 두 갈래 모두 사본 주제에 걸린 진행 중 챌린지 행은 지운다(`ack` 필요).
 */
export type TopicRemovalMode = 'DELETE' | 'RESTORE'

/** 한 갈래의 상황 영향(사용자에게 보이는 ACTIVE 상황만). `DELETE` 의 `scenariosRelinked` 는 언제나 빈 배열. */
export type TopicRemovalModeImpact = {
  scenariosArchived: TopicRemovalScenarioRef[]
  scenariosUnlinked: TopicRemovalScenarioRef[]
  scenariosRelinked: TopicRemovalScenarioRef[]
}

/**
 * #172 사전 조회. 제목·개수·id 만(원문 없음). 상황 목록은 사용자에게 보이는 ACTIVE 상황만 싣는다(보관된 상황은 연결만 함께 사라진다).
 * - `ack` = 이 응답대로 지우려면 #173·#176 에 보낼 값(`activeChallenge.id` 또는 `'none'`, 두 갈래 같음). 서버가 다시 계산한 값과 다르면 409 `IMPACT_CHANGED`.
 * - `isSeed` 이면 삭제 = 이 사용자 목록에서만 숨김(진행 중 챌린지는 계속, 상황 변화 없음 — 세 목록은 빈 배열, `ack` 는 보지 않는다).
 * - 맨 위 `scenarios*` 세 목록 = `delete` 와 같은 값(#173 "지우기" 확인 창). `restore` = 내 버전(`isSeedCopy`)일 때만 "기본으로 되돌리기"(#176) 확인 창 값, 아니면 null.
 */
export type TopicRemovalPreview = {
  topicId: string
  title: string
  isSeed: boolean
  isSeedCopy: boolean
  ack: string
  activeChallenge: { id: string; title: string; day: number; lengthDays: number } | null
  finishedChallenges: number
  scenariosArchived: TopicRemovalScenarioRef[]
  scenariosUnlinked: TopicRemovalScenarioRef[]
  scenariosRelinked: TopicRemovalScenarioRef[]
  delete: TopicRemovalModeImpact
  restore: TopicRemovalModeImpact | null
  doneLessons: number
  chunks: number
}

/** #173 결과(#176 주제 사본 되돌리기의 `removal` 도 `REMOVED` 모양 그대로, `mode: 'RESTORE'`). */
export type TopicRemovalResult = {
  topicId: string
  result: 'REMOVED' | 'HIDDEN'
  mode: TopicRemovalMode
  challengeDeleted: boolean
  deletedChallengeId: string | null
  scenariosArchived: number
  scenariosUnlinked: number
  scenariosRelinked: number
  /** 지운 주제가 시드의 내 버전이었으면 그 시드 id — `DELETE` 면 그 사용자 목록에서 숨김으로 남고(#176 으로 다시 보임), `RESTORE` 면 다시 보인다. */
  seedId: string | null
}
