/**
 * 분석 잡 적재 게이트(api-contract #21, task-012b D-B3·D-B8) — 발화 저장과 **같은 쓰기**(Prisma 중첩 create)로 `SpeechJob(ANALYSIS_STT, QUEUED)` 를
 * (runAfter = 디바운스 20초·FAST 30초 중 긴 쪽 — 같은 사용자의 다른 대기 잡도 `utteranceDb.create` 가 같은 배치에서 미룬다)
 * 넣기 위해, 행을 만들기 전에 조건을 판정해 중첩 create 입력을 돌려준다. 조건 4개: 워커 claim 120초 안 · 인식 모드 ≠ OFFLINE ·
 * 현재 환경 ANALYSIS_STT connection 사용 가능 · 오디오 있음. 판정 중 오류는 적재하지 않음으로 본다(발화 저장을 막지 않는다).
 * 같은 발화 중복 적재는 `@@unique([utteranceId, kind])` 가 막는다.
 */
import type { Prisma } from '@prisma/client'
import { analysisDb } from './db'
import { isAnalysisWorkerAlive } from './heartbeat'
import { enqueueDelayMs, shouldEnqueue } from './policy'

export interface AnalysisEnqueue {
  status: 'QUEUED'
  jobs: Prisma.SpeechJobUncheckedCreateNestedManyWithoutUtteranceInput
}

export async function analysisEnqueueFor(userId: string, opts: { path: 'upload' | 'gateway'; hasAudio: boolean; now?: number }): Promise<AnalysisEnqueue | null> {
  const now = opts.now ?? Date.now()
  if (!isAnalysisWorkerAlive(now) || !opts.hasAudio) return null
  try {
    const [recognitionMode, target] = await Promise.all([analysisDb.recognitionMode(userId), analysisDb.analysisTarget()])
    if (!shouldEnqueue({ workerAlive: true, recognitionMode, analysisConnection: target !== null, hasAudio: opts.hasAudio })) return null
    // createdAt 도 앱 시각으로 — 디바운스 상한(만든 지 5분)이 이 값을 기준으로 한다.
    return { status: 'QUEUED', jobs: { create: { userId, kind: 'ANALYSIS_STT', runAfter: new Date(now + enqueueDelayMs(recognitionMode, opts.path)), createdAt: new Date(now) } } }
  } catch (e) {
    console.warn('[speech] 분석 적재 판정 실패 — 적재하지 않음:', e instanceof Error ? e.name : 'unknown')
    return null
  }
}
