/**
 * PronunciationLexiconService(speech-platform/16 §2, P0) — 사전 읽기·범위 해석·최장 일치·버전.
 * 이 파일은 **읽기와 적용**만 한다(쓰기 0). 관리 쓰기(추가·수정·비활성·Import·Rollback)는 `lexiconStore`(task-003g).
 *
 * 적용 방식 A(§2.4): 정규화 전에 원문에서 매칭 구간을 찾아 정규화기가 건드리지 못하게 보호하고(§3.2 ①),
 * 매칭 결과를 엔진 독립 `lexiconHints[{surface, reading, accentType, wordType}]` 로 어댑터에 넘긴다.
 * 사용자 사전을 쓸 수 없는 엔진은 어댑터가 표기→가타카나 치환으로 강등한다(읽기 보존, 악센트 손실).
 *
 * 정본 데이터는 **ACTIVE `PronunciationLexiconVersion.snapshot`** 이다 — `dictionaryVersion`(캐시 키·Trace 값)과
 * 실제 쓴 항목이 어긋나지 않게 버전 행 하나에서 둘 다 읽는다. ACTIVE 버전이 없으면 빈 사전·버전 0(§2.1).
 */
import { createHash } from 'node:crypto'
import type { Environment, LexiconScope } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { KATAKANA_READING, moraCount, toWorkingText } from './text'

export interface LexiconEntryData {
  surface: string
  reading: string
  accentType: number
  priority: number
  scope: LexiconScope
  scopeRefId: string | null
  wordType: string | null
  enabled: boolean
}

/** 요청 문맥 — 각 범위의 대상 id(§2.1 scopeRefId). */
export interface LexiconContext {
  userId?: string | null
  voiceId?: string | null
  lessonId?: string | null
  topicId?: string | null
}

export interface LexiconHint {
  surface: string
  reading: string
  accentType: number
  wordType: string | null
}

export interface LexiconMatch extends LexiconHint {
  /** 원문(= working) 좌표. */
  start: number
  end: number
}

/** 좁은 범위가 이긴다(§2.2): USER > VOICE > LESSON > COURSE > GLOBAL. */
const SCOPE_RANK: Record<LexiconScope, number> = { GLOBAL: 0, COURSE: 1, LESSON: 2, VOICE: 3, USER: 4 }

export const WORD_TYPES = ['PROPER_NOUN', 'PERSON', 'PLACE', 'COMMON', 'LOANWORD', 'ABBREVIATION'] as const

/** L-4 검증 — 위반 코드 목록(빈 배열 = 통과). 관리 API(003g)·시드가 같은 규칙을 쓴다. */
export function validateLexiconEntry(e: Pick<LexiconEntryData, 'surface' | 'reading' | 'accentType' | 'priority' | 'scope' | 'scopeRefId' | 'wordType'>): string[] {
  const errs: string[] = []
  if (typeof e.surface !== 'string' || e.surface.trim().length === 0 || [...e.surface].length > 40) errs.push('E_SURFACE')
  if (typeof e.reading !== 'string' || [...e.reading].length > 60 || !KATAKANA_READING.test(e.reading)) errs.push('E_READING')
  else if (!Number.isInteger(e.accentType) || e.accentType < 0 || e.accentType > moraCount(e.reading)) errs.push('E_ACCENT')
  if (!Number.isInteger(e.priority) || e.priority < 0 || e.priority > 1000) errs.push('E_PRIORITY')
  if (e.scope === 'GLOBAL' ? e.scopeRefId !== null : typeof e.scopeRefId !== 'string' || e.scopeRefId.length === 0 || e.scopeRefId.length > 40) errs.push('E_SCOPE_REF')
  if (e.wordType !== null && !(WORD_TYPES as readonly string[]).includes(e.wordType)) errs.push('E_WORD_TYPE')
  return errs
}

function inScope(e: LexiconEntryData, ctx: LexiconContext): boolean {
  switch (e.scope) {
    case 'GLOBAL':
      return true
    case 'COURSE':
      return !!ctx.topicId && e.scopeRefId === ctx.topicId
    case 'LESSON':
      return !!ctx.lessonId && e.scopeRefId === ctx.lessonId
    case 'VOICE':
      return !!ctx.voiceId && e.scopeRefId === ctx.voiceId
    case 'USER':
      return !!ctx.userId && e.scopeRefId === ctx.userId
  }
}

/**
 * 문맥에 해당하는 enabled 항목 중 표기마다 가장 좁은 범위 1건(L-1·L-3). 키는 working 표기.
 * `forced`(사전 미리듣기의 저장 전 초안, task-003g)는 문맥과 무관하게 적용되고 같은 표기의 다른 항목보다 우선한다.
 */
export function selectEntries(entries: readonly LexiconEntryData[], ctx: LexiconContext, forced?: ReadonlySet<LexiconEntryData>): Map<string, LexiconEntryData> {
  const out = new Map<string, LexiconEntryData>()
  const rank = (e: LexiconEntryData) => SCOPE_RANK[e.scope] + (forced?.has(e) ? 10 : 0)
  for (const e of entries) {
    if (!e.enabled || !(forced?.has(e) || inScope(e, ctx))) continue
    const key = toWorkingText(e.surface)
    const cur = out.get(key)
    if (!cur || rank(e) > rank(cur)) out.set(key, e)
  }
  return out
}

/**
 * 최장 일치(L-2): 왼쪽부터 훑어 그 위치에서 시작하는 표기 중 가장 긴 것(같은 길이면 priority 큰 쪽)을 잡고 그 뒤로 건너뛴다.
 * 비교는 working 문자열(전각 영숫자 → ASCII)끼리 한다.
 */
export function findLexiconMatches(text: string, selected: ReadonlyMap<string, LexiconEntryData>): LexiconMatch[] {
  if (selected.size === 0) return []
  const byFirst = new Map<string, { key: string; e: LexiconEntryData }[]>()
  for (const [key, e] of selected) {
    const list = byFirst.get(key[0]) ?? []
    list.push({ key, e })
    byFirst.set(key[0], list)
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.key.length - a.key.length || b.e.priority - a.e.priority)
  const w = toWorkingText(text)
  const out: LexiconMatch[] = []
  for (let i = 0; i < w.length; ) {
    const hit = byFirst.get(w[i])?.find(({ key }) => w.startsWith(key, i))
    if (!hit) {
      i++
      continue
    }
    out.push({ start: i, end: i + hit.key.length, surface: text.slice(i, i + hit.key.length), reading: hit.e.reading, accentType: hit.e.accentType, wordType: hit.e.wordType })
    i += hit.key.length
  }
  return out
}

/** 적용된 힌트의 요약 해시 — 캐시 키 사전 요소에 덧붙여 범위(USER·LESSON…)가 다른 요청끼리 오디오가 섞이지 않게 한다. */
export function lexiconDigest(hints: readonly LexiconHint[]): string | null {
  if (hints.length === 0) return null
  const canon = hints.map((h) => [h.surface, h.reading, h.accentType, h.wordType ?? ''].join('\u0001')).sort()
  return createHash('sha1').update(canon.join('\u0002')).digest('hex').slice(0, 12)
}

/** 스냅샷 해시(§2.1): enabled 항목을 정렬해 sha256. 시드·003g 버전 생성과 같은 규칙. */
export function snapshotHash(entries: readonly LexiconEntryData[]): string {
  const canon = entries
    .filter((e) => e.enabled)
    .map((e) => [e.scope, e.scopeRefId ?? '', e.surface, e.reading, e.accentType, e.priority, e.wordType ?? ''].join('\u0001'))
    .sort()
  return createHash('sha256').update(canon.join('\u0002')).digest('hex')
}

function parseSnapshot(raw: unknown): LexiconEntryData[] {
  if (!Array.isArray(raw)) return []
  const out: LexiconEntryData[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const scope = typeof o.scope === 'string' && o.scope in SCOPE_RANK ? (o.scope as LexiconScope) : null
    if (!scope || typeof o.surface !== 'string' || typeof o.reading !== 'string') continue
    const e: LexiconEntryData = {
      surface: o.surface,
      reading: o.reading,
      accentType: typeof o.accentType === 'number' ? o.accentType : 0,
      priority: typeof o.priority === 'number' ? o.priority : 10,
      scope,
      scopeRefId: typeof o.scopeRefId === 'string' ? o.scopeRefId : null,
      wordType: typeof o.wordType === 'string' ? o.wordType : null,
      enabled: o.enabled !== false,
    }
    // 스냅샷이 손상돼도 잘못된 읽기를 엔진에 보내지 않는다.
    if (validateLexiconEntry(e).length === 0) out.push(e)
  }
  return out
}

export interface ActiveLexicon {
  dictionaryVersion: number
  entries: LexiconEntryData[]
}

const CACHE_MS = 30_000
const cache = new Map<Environment, { at: number; value: ActiveLexicon }>()

/** 환경의 ACTIVE 사전(30초 메모리 캐시 — 게시 후 최대 30초 뒤 반영, 캐시 키는 버전으로 갈리므로 섞이지 않는다). */
export async function loadActiveLexicon(environment: Environment): Promise<ActiveLexicon> {
  const hit = cache.get(environment)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
  const row = await prisma.pronunciationLexiconVersion.findFirst({
    where: { environment, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { version: true, snapshot: true },
  })
  const value: ActiveLexicon = row ? { dictionaryVersion: row.version, entries: parseSnapshot(row.snapshot) } : { dictionaryVersion: 0, entries: [] }
  cache.set(environment, { at: Date.now(), value })
  return value
}

export function clearLexiconCache(): void {
  cache.clear()
}
