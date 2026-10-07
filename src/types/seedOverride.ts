/**
 * 시드 사용자별 관리(UserSeedOverride, task-045) 화면 ↔ 서버 DTO. #174 주제 fork · #175 상황 fork · #176 되돌리기 · 시드 숨김(#165·#173 의 시드 id 경로).
 * 서버 모듈을 import 하지 않는다. 정본 계약 `docs/design/topic-scenario-manager.md` §1·§2·§4.
 */

export type SeedKind = 'TOPIC' | 'SCENARIO'
export const SEED_KINDS: readonly SeedKind[] = ['TOPIC', 'SCENARIO']

/**
 * 한 사용자에게 그 시드가 어떤 상태인가. override 행이 없으면 `VISIBLE`(이 값은 목록 판정 결과로만 쓰고 저장하지 않는다).
 * `COPIED` = 내 버전(사본)이 원본을 대신함 · `HIDDEN` = 내 목록에서 숨김(사본이 사라졌거나 지운 고아 override 도 HIDDEN 으로 읽는다).
 */
export type SeedOverrideState = 'VISIBLE' | 'HIDDEN' | 'COPIED'

export interface SeedOverrideDto {
  kind: SeedKind
  seedId: string
  state: Exclude<SeedOverrideState, 'VISIBLE'>
  /** `COPIED` 일 때만 사본 id. 고아(사본 행 없음)·숨김은 null. */
  copyId: string | null
  /** 사본이 가리키는 행이 사라졌거나(주제) 지워진(상황 ARCHIVED) 고아 override — 되돌리기가 정리한다. */
  orphan: boolean
  /** ISO 시각. */
  updatedAt: string
}

export interface HideSeedResult {
  kind: SeedKind
  seedId: string
  state: Exclude<SeedOverrideState, 'VISIBLE'>
  /** 이번 호출로 숨김 행을 새로 만들었으면 true. 이미 숨김·사본이 있으면 false(무변경, 멱등). */
  changed: boolean
}

export interface ForkSeedResult {
  kind: SeedKind
  seedId: string
  copyId: string
  /** 주제 fork 때 시드 주제에서 사본 주제로 연결을 옮긴 내 상황 id(상황 fork 는 빈 배열). */
  relinkedScenarioIds: string[]
}

/** 되돌린 경로 — 숨김 해제 · 사본 삭제 규칙 적용 · 고아 정리. */
export type RestoreSeedPath = 'HIDDEN' | 'COPY' | 'ORPHAN'

export interface RestoreSeedResult {
  kind: SeedKind
  seedId: string
  path: RestoreSeedPath
  /** 정리한 사본 id(`COPY`·`ORPHAN`). */
  copyId: string | null
  /** 주제 사본 삭제 결과(삭제 포트가 돌려준 값 그대로) — 상황 사본·숨김·고아는 null. */
  removal: Record<string, unknown> | null
}

/** 오류 `details.reason` 코드(화면 문구 1:1). */
export type SeedOverrideErrorReason =
  | 'SEED_NOT_FOUND'
  | 'NOT_OVERRIDDEN'
  | 'ALREADY_COPIED'
  | 'TOPIC_LIMIT'
  | 'SCENARIO_LIMIT'
  | 'DAILY_LIMIT'
  | 'TOPIC_REMOVAL_UNAVAILABLE'
