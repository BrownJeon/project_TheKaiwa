/**
 * L4 `speech/utterances` — 발화 1건(`Utterance`, speech 소유 테이블)의 기록·오디오 저장·30일 보존 정리.
 *
 *  - 온디바이스 경로(#21): 앱이 wav 를 받아 **서버가 정한 id 기반 경로**에 쓰고 행을 만든다.
 *  - gateway 경로(internal 콜백): gateway 가 wav 를 쓰고, 앱은 id·경로를 정해 행을 만든 뒤 DATA_ROOT 상대 경로를 돌려준다
 *    (gateway 가 `.part` → 그 경로로 옮김. 절대 경로 `finalPath` 는 보내지 않는다 — 두 프로세스의 DATA_ROOT 표기 차이로 어긋날 수 있어서).
 *  - 경로 = `DATA_ROOT/users/<userId>/utterances/<YYYY-MM(KST)>/<id>.wav`, DB 에는 DATA_ROOT 상대 경로만. 조각 검증은 infra.storage.
 *  - 대화방(`chatId`, task-018 ①): 두 경로 모두 **라우트가 소유를 확인한 방 id** 만 넘긴다(speech 는 Chat 을 모른다). 없으면 null.
 *    확인과 저장 사이에 방이 지워지면 FK(SetNull 관계) 위반 P2003 → 404.
 *  - 보존 30일: `audioExpiresAt` 이 지난 wav 를 지우고 `audioPath=null`·`audioDeletedAt` 기록(행·텍스트는 영구).
 *    정리는 별도 잡 없이 **발화가 새로 기록될 때 프로세스당 1시간에 1번** 뒤에서 돈다(한 번에 200건).
 *  - 분석 잡 적재(task-012b D-B3): 두 경로 모두 행을 만드는 **같은 쓰기**(중첩 create)로 `SpeechJob(ANALYSIS_STT)` 를 넣고 `status=QUEUED`.
 *    게이트(`analysis/enqueue`)가 아니면 `RECORDED` 그대로·`analysisQueued:false`. gateway 경로는 파일이 콜백 뒤에 옮겨지므로 집는 시각을 늦춘다.
 * 원음·전사 전문은 로그에 남기지 않는다(길이·id 만).
 */
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { ApiError, dates, ensureDataDir, prisma, removeDataFile, writeDataFile } from '@/modules/infra'
import { analysisEnqueueFor } from '../analysis/enqueue'
import { UTTERANCE_MAX_BYTES, UTTERANCE_MAX_DURATION_MS, UTTERANCE_RETENTION_DAYS, UTTERANCE_SAMPLE_RATE } from './limits'
import { utteranceDb } from './store'
import { isPcm16Mono16k, parseWav } from './wav'
import type { GatewayUtteranceInput, UploadInput, UtteranceSegment, UtteranceTimings } from './validate'

export * from './limits'
export { parseUploadForm, parseGatewayBody } from './validate'
export type { UploadInput, GatewayUtteranceInput, UtteranceSegment, UtteranceTimings } from './validate'
export { parseWav, isPcm16Mono16k } from './wav'
export { checkUtteranceForTurn, linkUtteranceToMessage, readUtteranceAudio, utterancesForMessages, UTTERANCE_TURN_WINDOW_MS } from './turn'
export { linkUtteranceToLesson, lessonUtteranceProblem } from './lesson'
export { utteranceConfidences, utteranceConfidenceOf } from './confidence'
export type { LessonUtteranceLink } from './lesson'
export { linkUtteranceToEvaluationItem, evaluationUtteranceProblem, voicedEvaluationItems } from './evaluation'
export { listUtterances, parseUtteranceListQuery, UTTERANCE_LIST_LIMIT_MAX } from './list'
export type { UtteranceListQuery } from './list'
export type { EvaluationUtteranceLink } from './evaluation'
export { getUtteranceView, resolveFinalText, parseResolveBody } from './review'
export type { UtteranceView, ResolveChoice } from './review'
export type { TurnUtterance, UtteranceLinkResult, UtteranceAudio, MessageUtterance } from './turn'
export type { WavInfo } from './wav'

const DAY_MS = 24 * 60 * 60 * 1000
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** cuid 형태(25자, 'c' 시작, 소문자·숫자) — Prisma 기본 id 와 같은 모양이라 경로 조각·gateway 검증 규칙을 그대로 통과한다. */
export function newUtteranceId(now = Date.now()): string {
  const time = now.toString(36).padStart(8, '0').slice(-8)
  const rnd = Array.from(randomBytes(16), (b) => B36[b % 36]).join('')
  return `c${time}${rnd}`
}

export function utteranceSegments(userId: string, id: string, at: Date): string[] {
  return ['users', userId, 'utterances', dates.todayKst(at).slice(0, 7), `${id}.wav`]
}

const AUDIO_PATH = /^users\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/utterances\/\d{4}-\d{2}\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.wav$/

function timingsJson(timings: UtteranceTimings | null, segments: UtteranceSegment[] | null): Prisma.InputJsonValue | undefined {
  if (!timings && !segments) return undefined
  return { ...(timings ?? {}), ...(segments ? { segments: segments.map((s) => ({ ...s })) } : {}) }
}

async function realtimeKey(ref: string): Promise<string> {
  const c = await utteranceDb.realtimeConnection(ref)
  if (!c) throw new ApiError('VALIDATION', '인식 경로 값이 올바르지 않아요.', { field: 'realtimeConnectionKey', reason: 'CONNECTION_INVALID' })
  return c.key
}

function isFkMissing(e: unknown): boolean {
  return (e as { code?: string })?.code === 'P2003'
}

export interface RecordedUtterance {
  utteranceId: string
  status: 'RECORDED' | 'QUEUED'
  analysisQueued: boolean
  expiresAt: string
}

const ownerGone = () => new ApiError('NOT_FOUND', '사용자나 대화를 찾을 수 없어요.')

/**
 * #21 — 온디바이스 최종 텍스트 + wav. 길이는 헤더로 계산(클라이언트 값과 20% 넘게 다르면 서버 값). 분석 잡은 게이트를 통과할 때만(task-012b).
 * `input.chatId`·`input.lessonId`(task-010) 는 라우트가 소유를 확인한 값이어야 한다.
 */
export async function recordUploadedUtterance(userId: string, input: UploadInput): Promise<RecordedUtterance> {
  const wav = parseWav(input.audio)
  if (!wav || !isPcm16Mono16k(wav)) throw new ApiError('VALIDATION', '16kHz 모노 PCM16 wav 만 받을 수 있어요.', { field: 'audio', reason: 'AUDIO_FORMAT' })
  // 저장은 버퍼 전체다 — data 선언 뒤에 덧붙은 바이트가 있으면 길이 검증이 저장물과 어긋나므로 거부한다(REV-013 M1).
  if (wav.trailingBytes > 0) throw new ApiError('VALIDATION', '녹음 파일 형식이 올바르지 않아요.', { field: 'audio', reason: 'AUDIO_FORMAT' })
  if (wav.durationMs > UTTERANCE_MAX_DURATION_MS) throw new ApiError('VALIDATION', '60초 이하로 녹음해 주세요.', { field: 'audio', reason: 'AUDIO_TOO_LONG' })
  if (input.audio.length > UTTERANCE_MAX_BYTES) throw new ApiError('VALIDATION', '녹음 파일이 너무 커요.', { field: 'audio', reason: 'TOO_LARGE' })
  const key = await realtimeKey(input.realtimeConnectionKey)
  const reported = input.durationMs
  const durationMs = reported !== null && wav.durationMs > 0 && Math.abs(reported - wav.durationMs) / wav.durationMs <= 0.2 ? reported : wav.durationMs

  const now = new Date()
  const id = newUtteranceId(now.getTime())
  const segs = utteranceSegments(userId, id, now)
  const expiresAt = new Date(now.getTime() + UTTERANCE_RETENTION_DAYS * DAY_MS)
  await writeDataFile(segs, input.audio)
  const analysis = await analysisEnqueueFor(userId, { path: 'upload', hasAudio: input.audio.length > 0, now: now.getTime() })
  try {
    await utteranceDb.create({
      id,
      userId,
      chatId: input.chatId,
      lessonId: input.lessonId,
      audioPath: segs.join('/'),
      audioBytes: input.audio.length,
      durationMs,
      sampleRate: UTTERANCE_SAMPLE_RATE,
      realtimeEngine: key,
      realtimeText: input.text,
      finalText: input.text,
      finalSource: 'REALTIME',
      status: analysis ? analysis.status : 'RECORDED',
      timings: timingsJson(input.timings, input.segments),
      audioExpiresAt: expiresAt,
      createdAt: now,
      ...(analysis ? { jobs: analysis.jobs } : {}),
    })
  } catch (e) {
    await removeDataFile(segs).catch(() => undefined)
    if (isFkMissing(e)) throw ownerGone()
    throw e
  }
  schedulePurge()
  return { utteranceId: id, status: analysis ? 'QUEUED' : 'RECORDED', analysisQueued: analysis !== null, expiresAt: expiresAt.toISOString() }
}

export interface RegisteredGatewayUtterance {
  utteranceId: string
  /** DATA_ROOT 상대 경로(DB 값과 같음). gateway 가 `.part` 를 `DATA_ROOT/<audioPath>` 로 옮긴다. 디렉터리는 앱이 만들어 둔다. */
  audioPath: string
  status: 'RECORDED' | 'QUEUED'
  /** gateway 는 읽지 않는다(추가 필드 — task-012b). */
  analysisQueued: boolean
  expiresAt: string
}

/** gateway `final` 직전 콜백 — 행을 만들고 저장 위치를 돌려준다. 소유자는 gateway 가 검증한 티켓 `sub`, 방은 티켓 `chatId`(라우트가 소유 확인). */
export async function registerGatewayUtterance(input: GatewayUtteranceInput): Promise<RegisteredGatewayUtterance> {
  const key = await realtimeKey(input.realtimeEngine)
  const now = new Date()
  const id = newUtteranceId(now.getTime())
  const segs = utteranceSegments(input.userId, id, now)
  const expiresAt = new Date(now.getTime() + UTTERANCE_RETENTION_DAYS * DAY_MS)
  const analysis = await analysisEnqueueFor(input.userId, { path: 'gateway', hasAudio: input.audioBytes === null || input.audioBytes > 0, now: now.getTime() })
  try {
    await utteranceDb.create({
      id,
      userId: input.userId,
      chatId: input.chatId,
      audioPath: segs.join('/'),
      audioBytes: input.audioBytes,
      durationMs: input.durationMs,
      sampleRate: input.sampleRate,
      realtimeEngine: key,
      realtimeText: input.realtimeText,
      finalText: input.realtimeText,
      finalSource: 'REALTIME',
      status: analysis ? analysis.status : 'RECORDED',
      timings: timingsJson(input.timings, input.segments),
      traceId: input.traceId,
      audioExpiresAt: expiresAt,
      createdAt: now,
      ...(analysis ? { jobs: analysis.jobs } : {}),
    })
  } catch (e) {
    if (isFkMissing(e)) throw ownerGone()
    throw e
  }
  try {
    await ensureDataDir(segs)
  } catch (e) {
    // 파일이 들어갈 자리가 없으면 행도 남기지 않는다(gateway 는 콜백 실패로 처리 — README §5 _orphan).
    await utteranceDb.remove(id).catch(() => undefined)
    throw e
  }
  schedulePurge()
  return { utteranceId: id, audioPath: segs.join('/'), status: analysis ? 'QUEUED' : 'RECORDED', analysisQueued: analysis !== null, expiresAt: expiresAt.toISOString() }
}

/** 보존 기한이 지난 오디오 삭제. 파일이 이미 없어도 행은 정리한다. 경로 형식이 틀린 행은 파일을 건드리지 않는다. */
export async function purgeExpiredAudio(opts: { now?: Date; limit?: number } = {}): Promise<number> {
  const now = opts.now ?? new Date()
  const rows = await prisma.utterance.findMany({
    where: { audioExpiresAt: { lte: now }, audioDeletedAt: null, audioPath: { not: null } },
    select: { id: true, audioPath: true },
    orderBy: { audioExpiresAt: 'asc' },
    take: opts.limit ?? 200,
  })
  let done = 0
  for (const r of rows) {
    if (r.audioPath && AUDIO_PATH.test(r.audioPath)) {
      try {
        await removeDataFile(r.audioPath.split('/'))
      } catch {
        continue
      }
    }
    await prisma.utterance.update({ where: { id: r.id }, data: { audioPath: null, audioDeletedAt: now } })
    done++
  }
  return done
}

const PURGE_INTERVAL_MS = 60 * 60 * 1000
declare global {
  var __kaiwaUtterancePurgeAt: number | undefined
}

/** 프로세스당 1시간에 1번, 요청과 무관하게 뒤에서 정리한다(실패는 다음 기회에). */
export function schedulePurge(now = Date.now()): boolean {
  if (globalThis.__kaiwaUtterancePurgeAt && now - globalThis.__kaiwaUtterancePurgeAt < PURGE_INTERVAL_MS) return false
  globalThis.__kaiwaUtterancePurgeAt = now
  void purgeExpiredAudio()
    .then((n) => {
      if (n) console.info(`[speech] 보존 기한 지난 발화 오디오 ${n}건 정리`)
    })
    .catch((e) => console.warn('[speech] 발화 오디오 정리 실패:', e instanceof Error ? e.name : 'unknown'))
  return true
}
