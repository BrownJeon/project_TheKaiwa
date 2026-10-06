/**
 * #24 캐시 오디오 **서명 URL**(task-007 K5, Codex C1-1 판정) — `/api/v1/speech/tts/<token>`.
 *
 *   token = base64url(JSON {k: cacheKey, e: 만료 epoch 초}) + "." + base64url(HMAC-SHA256(키, "tts-audio|" + userId + "|" + k + "|" + e))
 *   키    = HKDF-SHA256(JWT_SECRET, info "thekaiwa/tts-audio-url/v1") — 세션 서명 키를 그대로 쓰지 않는다(infra.deriveSubkey).
 *
 *  - **userId 는 URL 에 없다**(MAC 입력에만). 검증은 요청 세션 사용자로 MAC 을 다시 계산한다 → 다른 사람 세션이면 불일치.
 *    cacheKey 는 내용 해시(sha1 40자)라 사용자 식별값이 아니다. messageId 는 결속하지 않는다(만료 10분 + 사용자 결속으로 충분 — Leader 판정).
 *  - 비교는 `timingSafeEqual`. 형식·만료·서명·캐시 없음은 호출자가 **모두 같은 404** 로 돌린다(존재 오라클 금지).
 *  - 만료는 기본 10분. 지난 메시지 다시 듣기는 #23(`POST /speech/tts`, 캐시 HIT)으로 한다 — 이 URL 을 보관·재사용하지 않는다.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { deriveSubkey } from '@/modules/infra'
import type { TtsTiming } from '@/types/tts'
import { isCacheKey, readCachedAudio } from './cache'
import { recallRecentAudio } from './recentAudio'
import { TIMING_DURATION_TOLERANCE_MS } from './timing'

export const TTS_AUDIO_URL_PATH = '/api/v1/speech/tts/'
export const TTS_AUDIO_URL_TTL_SEC = 600
const KEY_INFO = 'thekaiwa/tts-audio-url/v1'
/** payload(base64url JSON ≈ 70자) + "." + MAC(base64url 32바이트 = 43자). */
const TOKEN_RE = /^([A-Za-z0-9_-]{20,120})\.([A-Za-z0-9_-]{43})$/
const MAX_TTL_SEC = 3_600

function mac(userId: string, k: string, e: number): Buffer {
  return createHmac('sha256', deriveSubkey(KEY_INFO)).update(`tts-audio|${userId}|${k}|${e}`, 'utf8').digest()
}

export interface SignedTtsAudio {
  url: string
  token: string
  expiresAt: string
}

// ── 토큰 ↔ 조각 글 timing(task-012b-4, D-T1) ───────────────────────────────────────────────
// #24 는 토큰(캐시 키)만 받아 그 소리가 어느 조각 글의 것인지 모른다. 캐시 행의 timing 은 정규화 글 좌표라(같은 키를 원문이 다른 조각이
// 함께 쓴다) 조각 글 좌표로 바꾸려면 원문이 필요하다 → **서명하는 쪽**(원문을 아는 합성 호출)이 바꿔 둔 값을 토큰에 묶어 둔다.
// 토큰 형식·MAC 은 그대로다. 프로세스 메모리(globalThis — 턴 라우트와 #24 가 다른 번들이어도 같은 보관소, recentAudio 와 같은 방식).
// 없으면(다른 인스턴스·재시작·밀려남) timing 없음 = 화면은 강조 없이 재생(정상). 같은 토큰에 다른 값이 오면(같은 사용자·키·초에
// 원문이 다른 두 조각) 둘 다 null — 틀린 강조보다 없는 강조.

export const TOKEN_TIMING_MAX_ENTRIES = 512

interface TokenTimingEntry {
  /** 화면 형식 JSON 문자열. null = 충돌(또는 timing 없음). */
  json: string | null
  expiresAt: number
}

declare global {
  var __kaiwaTtsTokenTiming: Map<string, TokenTimingEntry> | undefined
}

const tokenTiming: Map<string, TokenTimingEntry> = (globalThis.__kaiwaTtsTokenTiming ??= new Map())

function rememberTokenTiming(token: string, timing: TtsTiming | null, expiresAt: number, now: number): void {
  for (const [k, v] of tokenTiming) if (v.expiresAt <= now) tokenTiming.delete(k)
  const json = timing ? JSON.stringify(timing) : null
  const prev = tokenTiming.get(token)
  if (prev && prev.expiresAt > now) {
    if (prev.json !== json) prev.json = null
    return
  }
  while (tokenTiming.size >= TOKEN_TIMING_MAX_ENTRIES) {
    const oldest = tokenTiming.keys().next().value as string | undefined
    if (oldest === undefined) break
    tokenTiming.delete(oldest)
  }
  tokenTiming.set(token, { json, expiresAt })
}

function recallTokenTiming(token: string, now: number): TtsTiming | null {
  const e = tokenTiming.get(token)
  if (!e || e.expiresAt <= now || e.json === null) return null
  try {
    return JSON.parse(e.json) as TtsTiming
  } catch {
    return null
  }
}

/** 테스트용. */
export function clearTokenTiming(): void {
  tokenTiming.clear()
}

/**
 * `timing` 을 주면(null 포함) 이 토큰으로 #24 가 줄 timing 을 기억한다 — 그 소리를 만든 조각 글 기준 좌표여야 한다.
 * 생략하면 기억하지 않는다(#24 timing 없음).
 */
export function signTtsAudioToken(userId: string, cacheKey: string, opts: { now?: number; ttlSec?: number; timing?: TtsTiming | null } = {}): SignedTtsAudio {
  if (!userId) throw new Error('signTtsAudioToken: userId 필요')
  if (!isCacheKey(cacheKey)) throw new Error('signTtsAudioToken: 캐시 키 형식')
  const ttl = Math.min(MAX_TTL_SEC, Math.max(1, Math.floor(opts.ttlSec ?? TTS_AUDIO_URL_TTL_SEC)))
  const now = opts.now ?? Date.now()
  const e = Math.floor(now / 1000) + ttl
  const payload = Buffer.from(JSON.stringify({ k: cacheKey, e }), 'utf8').toString('base64url')
  const token = `${payload}.${mac(userId, cacheKey, e).toString('base64url')}`
  if (opts.timing !== undefined) rememberTokenTiming(token, opts.timing, e * 1000, now)
  return { token, url: `${TTS_AUDIO_URL_PATH}${token}`, expiresAt: new Date(e * 1000).toISOString() }
}

export interface VerifiedTtsAudio {
  cacheKey: string
  expiresAtSec: number
  remainingSec: number
}

/** 형식·만료·서명을 모두 확인한다. 어느 하나라도 틀리면 null(이유를 구분하지 않는다). */
export function verifyTtsAudioToken(userId: string, token: unknown, now = Date.now()): VerifiedTtsAudio | null {
  if (!userId || typeof token !== 'string') return null
  const m = TOKEN_RE.exec(token)
  if (!m) return null
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const p = payload as { k?: unknown; e?: unknown }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 2) return null
  if (!isCacheKey(p.k) || typeof p.e !== 'number' || !Number.isInteger(p.e)) return null
  const nowSec = Math.floor(now / 1000)
  if (p.e <= nowSec || p.e > nowSec + MAX_TTL_SEC) return null
  const given = Buffer.from(m[2], 'base64url')
  const expected = mac(userId, p.k, p.e)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return { cacheKey: p.k, expiresAtSec: p.e, remainingSec: p.e - nowSec }
}

export interface SignedAudioFile {
  audio: Buffer
  durationMs: number | null
  modelVersion: string | null
  dictionaryVersion: number | null
  remainingSec: number
  /** 서명한 쪽이 묶어 둔 조각 글 기준 timing(task-012b-4). 없으면 null(정상). */
  timing: TtsTiming | null
}

/**
 * 서명 검증 → (방금 합성한 오디오 보관소 → 캐시 파일). 실패는 전부 null(라우트가 같은 404 로).
 * 보관소는 검증을 통과한 뒤에만 본다 — 서명이 틀린 요청에는 어느 저장소에 무엇이 있는지 드러나지 않는다.
 * 합성 직후 캐시 행 커밋 전(≈1s)에 온 요청도 바로 200 이다(recentAudio 주석 — MISS 청크 404 경합 수정).
 * timing 은 토큰에 묶인 값만 준다(캐시 행의 정규화 글 좌표는 조각 글을 모르면 쓸 수 없다). 그 값의 wav 길이가 지금 줄 오디오와 다르면 null.
 */
export async function readSignedTtsAudio(userId: string, token: unknown, now = Date.now()): Promise<SignedAudioFile | null> {
  const v = verifyTtsAudioToken(userId, token, now)
  if (!v) return null
  const timingFor = (durationMs: number | null): TtsTiming | null => {
    const t = recallTokenTiming(token as string, now)
    return t && durationMs !== null && Math.abs(t.durationMs - durationMs) <= TIMING_DURATION_TOLERANCE_MS ? t : null
  }
  const recent = recallRecentAudio(v.cacheKey, now)
  if (recent) return { ...recent, remainingSec: v.remainingSec, timing: timingFor(recent.durationMs) }
  // 캐시 파일 경로의 길이는 readCachedAudio 가 파일 헤더에서 읽은 값(행 값 아님 — REV-136).
  const hit = await readCachedAudio(v.cacheKey)
  if (!hit) return null
  return { audio: hit.audio, durationMs: hit.durationMs, modelVersion: hit.modelVersion ?? null, dictionaryVersion: hit.dictionaryVersion ?? null, remainingSec: v.remainingSec, timing: timingFor(hit.durationMs) }
}
