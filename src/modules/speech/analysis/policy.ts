/**
 * 분석 STT 정책(순수 함수, task-012b) — 적재 게이트·모드별 지연·재확인 판정·백오프·평가 채점 텍스트 선택.
 * DB·시계·프로세스 상태를 모르므로 단위 테스트가 그대로 부른다. 정본: api-contract #21·#138~#140·#67 옆 D-B7, domain-model §5-8·§5-9.
 */
import type { FinalSource, InputSource, RecognitionMode, UtteranceStatus } from '@prisma/client'

/** 워커 생존 게이트(D-B3) — 마지막 claim 이 이 안이면 살아 있다. */
export const WORKER_ALIVE_WINDOW_MS = 120_000
/** 고아 회수(§5-8) — RUNNING 인데 이보다 오래 잠긴 잡은 워커가 죽은 것으로 본다. */
export const ORPHAN_AFTER_MS = 15 * 60_000
/** #140 백오프 — attempts(claim 때 이미 +1) 1·2·3 → 30초·2분·10분. */
export const RETRY_BACKOFF_MS = [30_000, 120_000, 600_000] as const
/** D-B8 — 우선순위 칸이 없어 FAST 는 늦게 집는 것으로 근사. */
export const FAST_MODE_DELAY_MS = 30_000
/**
 * gateway 경로는 콜백 응답을 받은 **뒤에** gateway 가 wav 를 제자리로 옮긴다 — 그 전에 워커가 집으면 AUDIO_MISSING(재시도 없음)으로
 * 끝나므로 짧게 미룬다. 옮기기에 실패한 발화(_orphan)는 이 뒤에 집혀도 AUDIO_MISSING 이 맞다. (지금은 디바운스 20초가 이보다 길어 가려진다.)
 */
export const GATEWAY_AUDIO_GRACE_MS = 10_000
/**
 * 사용자별 디바운스(D-B8 수정, Leader 2026-09-29) — 분석(전사가 CPU 코어를 다 쓰고 결과 저장이 공유 DB 에 커밋한다)이 대화 턴과 겹치면
 * 턴이 느려진다(실측 첫 음성 p50 +42%). 그래서 발화마다 그 사용자의 대기 중(QUEUED) 분석 잡을 "마지막 발화 + 20초" 뒤로 미뤄 대화가 멈췄을 때 돈다.
 * 끝없이 이어지는 대화에서 영원히 밀리지 않게 잡이 만들어진 지 5분이 지나면 더 밀지 않는다(runAfter ≤ createdAt + 5분).
 */
export const ANALYSIS_DEBOUNCE_MS = 20_000
export const ANALYSIS_DEBOUNCE_CAP_MS = 5 * 60_000
export const REVIEW_THRESHOLD_DEFAULT = 0.85
export const REVIEW_THRESHOLD_ACCURATE = 0.9
/** 재시도해도 결과가 같은 실패 — 워커가 retryable 을 true 로 보내도 확정 실패로 본다(§5-8). */
export const NON_RETRYABLE_ERRORS: ReadonlySet<string> = new Set(['AUDIO_MISSING', 'AUDIO_INVALID', 'EMPTY_TRANSCRIPTS', 'READING_UNAVAILABLE'])
export const COMPARATOR_FLAGS = ['LENGTH_RATIO', 'ANALYSIS_EMPTY', 'REALTIME_EMPTY'] as const
export type ComparatorFlag = (typeof COMPARATOR_FLAGS)[number]

export interface EnqueueGate {
  workerAlive: boolean
  recognitionMode: RecognitionMode
  analysisConnection: boolean
  hasAudio: boolean
}

/** #21 적재 조건 4개(D-B3) — 하나라도 아니면 적재하지 않는다(발화 저장은 그대로). */
export function shouldEnqueue(g: EnqueueGate): boolean {
  return g.workerAlive && g.recognitionMode !== 'OFFLINE' && g.analysisConnection && g.hasAudio
}

/** 새 잡을 집어도 되는 가장 이른 시각까지의 지연 — 디바운스 20초·FAST 30초·gateway 파일 이동 여유 중 가장 긴 것. */
export function enqueueDelayMs(mode: RecognitionMode, path: 'upload' | 'gateway'): number {
  const byMode = mode === 'FAST' ? FAST_MODE_DELAY_MS : 0
  return Math.max(ANALYSIS_DEBOUNCE_MS, byMode, path === 'gateway' ? GATEWAY_AUDIO_GRACE_MS : 0)
}

/**
 * 디바운스로 미룬 뒤의 runAfter(순수 — DB 의 `UPDATE … GREATEST(runAfter, LEAST(…))` 와 같은 규칙). 줄이지는 않는다(백오프 중인 잡 보존),
 * 만든 지 5분이 지난 잡은 그대로(null = 바꾸지 않음).
 */
export function debouncedRunAfter(job: { runAfter: Date; createdAt: Date }, now: number): Date | null {
  if (job.createdAt.getTime() <= now - ANALYSIS_DEBOUNCE_CAP_MS) return null
  const target = Math.min(now + ANALYSIS_DEBOUNCE_MS, job.createdAt.getTime() + ANALYSIS_DEBOUNCE_CAP_MS)
  return target > job.runAfter.getTime() ? new Date(target) : null
}

/**
 * claim 재검사(Codex C2 지적 1, TOCTOU) — 잡을 잠근 뒤 RUNNING 으로 올리기 직전, 그 사용자의 가장 최근 발화가 20초 안이면 올리지 않고
 * 미룰 runAfter 를 돌려준다(null = 지금 집어도 된다). 디바운스와 같은 상한: 만든 지 5분 지난 잡은 미루지 않는다.
 * (디바운스 UPDATE 가 claim 잠금보다 늦게 도착해 옛 잡을 못 민 경우 — 이미 커밋된 새 발화를 여기서 다시 본다.)
 */
export function claimDeferral(job: { createdAt: Date }, lastUtteranceAt: Date | null, now: number): Date | null {
  if (!lastUtteranceAt) return null
  const capAt = job.createdAt.getTime() + ANALYSIS_DEBOUNCE_CAP_MS
  if (capAt <= now) return null
  const quietAt = lastUtteranceAt.getTime() + ANALYSIS_DEBOUNCE_MS
  if (quietAt <= now) return null
  return new Date(Math.min(quietAt, capAt))
}

/**
 * 재확인 임계(#138) — ACCURATE 0.90, 그 밖 0.85. AppSetting `speech.review.threshold` 가 0~1 숫자면 그 값을 쓰되
 * **ACCURATE 는 max(설정값, 0.90)**(task-012b 03:30 판단 ⑤ — 콘솔에서 임계를 낮춰도 정확 모드의 재확인 기준은 내려가지 않는다, task-012c 에서 적용).
 */
export function reviewThreshold(mode: RecognitionMode, override: unknown): number {
  const set = typeof override === 'number' && Number.isFinite(override) && override >= 0 && override <= 1 ? override : null
  if (mode === 'ACCURATE') return Math.max(set ?? REVIEW_THRESHOLD_ACCURATE, REVIEW_THRESHOLD_ACCURATE)
  return set ?? REVIEW_THRESHOLD_DEFAULT
}

/** `requiresReview = similarity < 임계 || flags 가 있음` — 판정은 앱(워커는 similarity·flags 만). */
export function judgeReview(similarity: number, flags: readonly ComparatorFlag[], threshold: number): boolean {
  return similarity < threshold || flags.length > 0
}

/** #140 — 재적재할지(그 시각) 확정 실패할지. `attempts` 는 이번 시도까지 센 값. */
export function nextAfterFailure(input: { attempts: number; maxAttempts: number; retryable: boolean; error: string }, now: number): { status: 'QUEUED'; runAfter: Date } | { status: 'FAILED' } {
  const retryable = input.retryable && !NON_RETRYABLE_ERRORS.has(input.error)
  if (!retryable || input.attempts >= input.maxAttempts) return { status: 'FAILED' }
  const idx = Math.min(Math.max(input.attempts, 1), RETRY_BACKOFF_MS.length) - 1
  return { status: 'QUEUED', runAfter: new Date(now + RETRY_BACKOFF_MS[idx]) }
}

/** 고아 회수 — 한도를 다 쓴 잡은 되돌리지 않고 확정 실패(attempts 는 3회 한도에 포함, §5-8). */
export function orphanOutcome(attempts: number, maxAttempts: number): 'QUEUED' | 'FAILED' {
  return attempts >= maxAttempts ? 'FAILED' : 'QUEUED'
}

/** SpeechAnalysis.engineVersions 에 남긴 판정 스냅샷(#138) — "원래 재확인 대상이었는가" 판단용. */
export interface ReviewSnapshot {
  reviewThreshold?: unknown
  flags?: unknown
}

/** 원래 재확인 대상이었는가 = `transcriptConfidence < reviewThreshold`(스냅샷) 또는 flags 가 있었다(api-contract #21a). 스냅샷이 없으면 false. */
export function wasReviewTarget(transcriptConfidence: number | null, snap: ReviewSnapshot | null): boolean {
  if (!snap) return false
  if (Array.isArray(snap.flags) && snap.flags.length > 0) return true
  const t = snap.reviewThreshold
  return typeof t === 'number' && transcriptConfidence !== null && transcriptConfidence < t
}

export interface GradingUtterance {
  status: UtteranceStatus
  requiresReview: boolean
  finalText: string | null
  finalSource: FinalSource
  realtimeText: string
  analysisText: string | null
  transcriptConfidence: number | null
  snapshot: ReviewSnapshot | null
}

export interface GradingText {
  text: string
  inputSource: InputSource
}

const SOURCE_OF: Record<FinalSource, InputSource> = { REALTIME: 'REALTIME_STT', ANALYSIS: 'SERVER_STT', USER: 'TEXT' }

/**
 * 평가 말하기 문항의 채점 텍스트(D-B7) — 채점 잡이 시작하는 시점 값, 분석을 기다리지 않는다. null = 저장된 답 그대로(`REALTIME_STT`).
 *   ① 학습자가 #21a 로 확정 — `finalSource ≠ REALTIME`, 또는 재확인 대상이었는데 `requiresReview=false`(= 실시간 안을 골랐다) → `finalText`
 *      (`inputSource` = 고른 안의 출처: 실시간 REALTIME_STT · 분석 SERVER_STT · 직접 입력 TEXT)
 *   ② `ANALYZED && !requiresReview` 이고 확정 전 → `analysisText`(SERVER_STT)
 *   ③ 그 밖(분석 전·실패·확정 대기) → null
 */
export function pickGradingText(u: GradingUtterance): GradingText | null {
  const finalText = (u.finalText ?? '').trim()
  if (u.finalSource !== 'REALTIME') return finalText ? { text: finalText, inputSource: SOURCE_OF[u.finalSource] } : null
  if (u.status !== 'ANALYZED' || u.requiresReview) return null
  if (wasReviewTarget(u.transcriptConfidence, u.snapshot)) return finalText ? { text: finalText, inputSource: 'REALTIME_STT' } : null
  const analysis = (u.analysisText ?? '').trim()
  return analysis ? { text: analysis, inputSource: 'SERVER_STT' } : null
}

/** 저장된 답이 이 발화에서 온 것인가 — 연결 당시 텍스트(최종 → 실시간)와 같다. 한 문항에 발화가 여럿 붙을 수 있어(재답) 답과 맞는 것만 본다. */
export function answerCameFrom(answerText: string, u: { finalText: string | null; realtimeText: string }): boolean {
  const a = answerText.trim()
  if (!a) return false
  return a === (u.finalText ?? '').trim() || a === u.realtimeText.trim()
}
