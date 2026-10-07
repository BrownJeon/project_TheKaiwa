/**
 * 주제·시드 관리 요청 래퍼(screens.md §16-3) — T5-1 에서 뒤 task(T5-2~T5-4)가 쓸 것까지 전부 둔다(같은 파일을 여러 task 가 고치지 않게).
 * 봉투 풀기·401 이동·`ApiError({status, code, details, message})` 는 공용 `common/api` 가 그대로 던진다 — 화면은 `toErr` → `failureCopy` 로만 문구를 고른다.
 * 상황 편집기 쪽(#164·#165·#175·#177·#178)은 scenario 훅이 직접 부른다(scenario → topic import 금지). #163·#166 은 주제 만들기(S4)가 쓰므로 여기에도 둔다.
 */
import { apiDelete, apiGet, apiPatch, apiPost, type ApiOptions } from '@/components/common/api'
import { readScenarioPages } from '@/components/scenario/useScenarioList'
import type { ChallengeListResponse } from '@/types/challenge'
import type { JlptLevel, Topic, TopicList } from '@/types/lesson'
import type { ScenarioDetail, ScenarioInput, ScenarioListItem } from '@/types/scenario'
import type { ForkSeedResult, RestoreSeedResult, SeedKind, SeedOverrideItem } from '@/types/seedOverride'
import type { TopicRemovalPreview, TopicRemovalResult } from '@/types/topic'
import type { TopicCreateInput, TopicDraftApiResult, TopicDraftRequestBody, TopicSaveApiResult, TopicUpdateInput } from '@/types/topicWrite'

const enc = encodeURIComponent

/** #56 관리 화면 — 모든 수준(`level=all`), 내 행(사본 포함) + 내게 보이는 기본. */
export async function getManageTopics(opts?: ApiOptions): Promise<Topic[]> {
  const res = await apiGet<TopicList>('/api/v1/topics?level=all', opts)
  return Array.isArray(res.items) ? res.items : []
}

/** #179 내가 숨겼거나 내 버전으로 바꾼 기본 항목(`kind` 없으면 둘 다). */
export async function getSeedOverrides(kind?: SeedKind, opts?: ApiOptions): Promise<SeedOverrideItem[]> {
  const res = await apiGet<{ items: SeedOverrideItem[] }>(`/api/v1/seed-overrides${kind ? `?kind=${enc(kind)}` : ''}`, opts)
  return Array.isArray(res.items) ? res.items : []
}

/** #161 전체(커서 이어 읽기 — 회화 탭 목록과 같은 함수). */
export async function getManageScenarios(): Promise<ScenarioListItem[]> {
  return (await readScenarioPages()).items
}

/** #155 진행 중 챌린지(사용자당 하나). */
export function getActiveChallenge(opts?: ApiOptions): Promise<ChallengeListResponse> {
  return apiGet<ChallengeListResponse>('/api/v1/challenges?status=ACTIVE&limit=1', opts)
}

/** #170 주제 초안(행 없음). 분당 6·하루 20·동시 1 — 그만두기는 `opts.signal`. */
export function draftTopic(body: TopicDraftRequestBody, opts?: ApiOptions): Promise<TopicDraftApiResult> {
  return apiPost<TopicDraftApiResult>('/api/v1/topics/drafts', body, opts)
}

/** #57 주제 + 기본 표현 저장(한 트랜잭션). 201. */
export function createTopic(body: TopicCreateInput): Promise<TopicSaveApiResult<Topic>> {
  return apiPost<TopicSaveApiResult<Topic>>('/api/v1/topics', body)
}

/** #171 내 주제(내 버전 포함) 고치기 — 보낸 칸만. 기본 주제 id 는 409 `USE_FORK`. */
export function updateTopic(id: string, patch: TopicUpdateInput): Promise<TopicSaveApiResult<Topic>> {
  return apiPatch<TopicSaveApiResult<Topic>>(`/api/v1/topics/${enc(id)}`, patch)
}

/** #174 기본 주제 → 내 버전(저장 시점에 복사, 본문 = 전체 입력). 201. */
export type TopicForkApiResult = TopicSaveApiResult<Topic> & Omit<ForkSeedResult, 'kind'>
export function forkTopic(id: string, body: TopicUpdateInput): Promise<TopicForkApiResult> {
  return apiPost<TopicForkApiResult>(`/api/v1/topics/${enc(id)}/fork`, body)
}

/** #172 지우기·되돌리기 확인 창 사전 조회(읽기 전용). */
export function getTopicRemoval(id: string): Promise<TopicRemovalPreview> {
  return apiGet<TopicRemovalPreview>(`/api/v1/topics/${enc(id)}/removal`)
}

/** #173 지우기(내 주제·내 버전) · 기본 주제 id 면 나에게서 숨기기. `ack` = #172 응답의 `ack` 그대로. */
export function removeTopic(id: string, ack: string): Promise<TopicRemovalResult> {
  return apiDelete<TopicRemovalResult>(`/api/v1/topics/${enc(id)}?ack=${enc(ack)}`)
}

/** #176 기본으로 되돌리기(내 버전) · 숨긴 기본 항목 다시 보기. 주제 내 버전이면 `ack` 필요(사본 id 로 부른 #172 의 `ack`). */
export function restoreSeed(body: { kind: SeedKind; seedId: string; ack?: string }): Promise<RestoreSeedResult> {
  return apiPost<RestoreSeedResult>('/api/v1/seed-overrides/restore', body)
}

/** #166 본문 — 저장 전 새 주제의 상황 초안은 `topic` 인라인(`topicId` 와 함께 쓰지 않는다). */
export interface ScenarioDraftForTopicBody {
  description: string
  level: JlptLevel
  topicId?: string
  topic?: { title: string; titleJa?: string | null }
}

/** #166 상황 초안(행 없음). 분당 6·하루 40(#177 공유)·동시 1. */
export function draftScenario(body: ScenarioDraftForTopicBody, opts?: ApiOptions): Promise<{ draft: ScenarioInput }> {
  return apiPost<{ draft: ScenarioInput }>('/api/v1/scenarios/drafts', body, opts)
}

/** #163 상황 저장. 201 상세. 하루 30·내 상황 50. */
export function createScenario(body: ScenarioInput): Promise<ScenarioDetail> {
  return apiPost<ScenarioDetail>('/api/v1/scenarios', body)
}
