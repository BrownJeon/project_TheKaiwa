/**
 * #138 분석 결과 반영(api-contract §2-28, domain-model §5-9, task-012b D-B5) — 한 트랜잭션:
 *   발화 잠금 → 잡 확인(이 발화의 ANALYSIS_STT 잡이 아니면 404) → 이미 ANALYZED 면 `stored:false, ALREADY_ANALYZED`(먼저 온 결과가 이긴다)
 *   → 재확인 판정(임계 = 사용자 모드·AppSetting, 앱 정책) → Utterance{analysisEngine, analysisText, transcriptConfidence, requiresReview, ANALYZED}
 *   + SpeechAnalysis upsert(Phase 2 는 점수 칸 없이 engineVersions + 판정 스냅샷) + 잡 DONE.
 * **`finalText`·`finalSource` 는 바꾸지 않는다** — 이미 보낸 턴·교정의 근거 텍스트와 같게 두고, 학습자가 #21a 로 고를 때만 바뀐다.
 * 이미 학습자가 직접 고친 발화(`finalSource=USER` — 채팅 턴 "글자로 고치기")는 `requiresReview=false` 로 저장한다(⑫ Leader 2026-09-29) —
 * 재확인 카드가 학습자 텍스트를 덮어쓸 여지를 없앤다(#21a 409). 유사도·임계 스냅샷은 그대로 남겨 분석 품질 지표로 쓴다.
 * 회수된 잡의 늦은 결과도 발화가 아직 분석 전이면 받는다(잡이 QUEUED 여도 DONE 으로). 확정 실패(FAILED)한 잡의 결과는 409 STALE_CLAIM.
 * 세대 펜싱은 하지 않는다(알려진 수용 동작, REV-044): 앞 세대의 늦은 성공이 뒤 세대 잡을 조기 DONE 으로 만들어도 발화는 1회만 저장되고 뒤 세대는 ALREADY_ANALYZED·409 로 무해하게 끝난다.
 */
import type { FinalSource, Prisma } from '@prisma/client'
import { ApiError } from '@/modules/infra'
import { analysisDb } from './db'
import { inScope, jobUserScope } from './jobs'
import { judgeReview, reviewThreshold } from './policy'
import { JOB_ID_RE, type AnalysisInput } from './validate'

export const REVIEW_THRESHOLD_SETTING = 'speech.review.threshold'

export type AnalysisApplyResult =
  | { stored: true; utteranceStatus: 'ANALYZED'; transcriptConfidence: number; requiresReview: boolean; finalSource: FinalSource }
  | { stored: false; reason: 'ALREADY_ANALYZED'; utteranceStatus: 'ANALYZED'; transcriptConfidence: number | null; requiresReview: boolean; finalSource: FinalSource }

const notFound = () => new ApiError('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')

export async function applyAnalysisResult(utteranceId: string, input: AnalysisInput, now = new Date()): Promise<AnalysisApplyResult> {
  if (!JOB_ID_RE.test(utteranceId)) throw notFound()
  const analysisEngine = await analysisDb.analysisConnectionKey(input.analysisEngine)
  if (!analysisEngine) throw new ApiError('VALIDATION', '요청 본문이 올바르지 않습니다.', { field: 'analysisEngine', reason: 'UNKNOWN_CONNECTION' })
  const [scope, override] = await Promise.all([jobUserScope(), analysisDb.reviewOverride(REVIEW_THRESHOLD_SETTING)])
  return analysisDb.transaction(async (tx) => {
    const u = await analysisDb.lockUtterance(tx, utteranceId)
    if (!u || !inScope(scope, u.userId)) throw notFound()
    const job = await analysisDb.jobOfUtterance(tx, input.jobId, utteranceId)
    if (!job || job.kind !== 'ANALYSIS_STT') throw notFound()
    if (u.status === 'ANALYZED') {
      return { stored: false, reason: 'ALREADY_ANALYZED', utteranceStatus: 'ANALYZED', transcriptConfidence: u.transcriptConfidence, requiresReview: u.requiresReview, finalSource: u.finalSource } as const
    }
    if (job.status === 'FAILED' || job.status === 'DONE') throw new ApiError('CONFLICT', '이미 끝난 잡입니다.', { reason: 'STALE_CLAIM' })
    const mode = await analysisDb.recognitionMode(u.userId)
    const threshold = reviewThreshold(mode, override)
    const requiresReview = u.finalSource === 'USER' ? false : judgeReview(input.similarity, input.flags, threshold)
    const engineVersions = { ...input.engineVersions, comparator: input.comparatorVersion, reviewThreshold: threshold, flags: input.flags, recognitionMode: mode } as Prisma.InputJsonValue
    await analysisDb.storeAnalysis(tx, { utteranceId, jobId: job.id, analysisEngine, analysisText: input.analysisText, confidence: input.similarity, requiresReview, engineVersions, now })
    return { stored: true, utteranceStatus: 'ANALYZED', transcriptConfidence: input.similarity, requiresReview, finalSource: u.finalSource } as const
  })
}
