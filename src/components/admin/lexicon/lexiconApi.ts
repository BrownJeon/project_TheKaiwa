/**
 * 발음 사전 요청 함수(screens.md §10-4 L1~L9) — 경로·본문 모양을 이 파일 한 곳에 둔다. DTO 는 서버와 공유하는 `@/types/lexicon`.
 * 경로의 id 는 `encodeURIComponent`, 쿼리는 `URLSearchParams`. 이유·확인 문구는 늘 본문으로 보낸다(URL = 접근 로그).
 */
import { apiDelete, apiGetFile, apiPost, apiPostAudio, apiPut, apiUpload, type ApiOptions } from '@/components/common/api'
import type { AdminEnvironment } from '@/types/admin'
import type {
  LexiconFormat,
  LexiconImportMode,
  LexiconImportResultDto,
  LexiconPreviewDto,
  LexiconRollbackResultDto,
  LexiconScopeName,
  LexiconWordType,
  LexiconWriteResultDto,
} from '@/types/lexicon'
import { LEXICON_PAGE_SIZE, type LexiconParams, VERSIONS_PAGE_SIZE } from './lexiconParams'

const BASE = '/api/admin/v1/lexicon'
const enc = encodeURIComponent

/** L1 — 범위가 ALL 이면 scope·대상을 빼고, 꺼진 항목 포함이면 `enabled=all`. */
export function listPath(p: LexiconParams): string {
  const u = new URLSearchParams()
  if (p.q) u.set('q', p.q)
  if (p.scope !== 'ALL') {
    u.set('scope', p.scope)
    if (p.ref && p.scope !== 'GLOBAL') u.set('scopeRefId', p.ref)
  }
  u.set('enabled', p.inactive ? 'all' : '1')
  u.set('page', String(p.page))
  u.set('pageSize', String(LEXICON_PAGE_SIZE))
  return `${BASE}?${u.toString()}`
}

/** 쓰기 공통 꼬리 — `confirm` 은 PRODUCTION 일 때만 싣는다. */
export interface WriteMeta {
  reason: string
  baseVersion: number
  confirm?: string
}

export interface CreateBody extends WriteMeta {
  surface: string
  reading: string
  accentType: number
  priority: number
  scope: LexiconScopeName
  scopeRefId: string | null
  wordType: LexiconWordType | null
  note: string | null
}

export interface UpdateBody extends WriteMeta {
  reading?: string
  accentType?: number
  priority?: number
  wordType?: LexiconWordType | null
  note?: string | null
  enabled?: boolean
}

export const createEntry = (body: CreateBody) => apiPost<LexiconWriteResultDto>(BASE, body)
export const updateEntry = (id: string, body: UpdateBody) => apiPut<LexiconWriteResultDto>(`${BASE}/${enc(id)}`, body)
export const disableEntry = (id: string, body: WriteMeta) => apiDelete<LexiconWriteResultDto>(`${BASE}/${enc(id)}`, body)

/** L5 — multipart `file`(+ 적용 때 `reason`·`baseVersion`·`confirm`), 쿼리 `mode`·`dryRun`. */
export function importLexicon(file: File, mode: LexiconImportMode, dryRun: boolean, meta?: WriteMeta, opts?: ApiOptions) {
  const form = new FormData()
  form.set('file', file, file.name)
  if (meta) {
    form.set('reason', meta.reason)
    form.set('baseVersion', String(meta.baseVersion))
    if (meta.confirm) form.set('confirm', meta.confirm)
  }
  const q = new URLSearchParams({ mode, dryRun: dryRun ? '1' : '0' })
  return apiUpload<LexiconImportResultDto>(`${BASE}/import?${q.toString()}`, form, 'POST', opts)
}

export function exportPath(format: LexiconFormat): string {
  return `${BASE}/export?format=${format}`
}

export function exportFilename(env: AdminEnvironment, version: number | null, format: LexiconFormat): string {
  return `kaiwa-lexicon-${env.toLowerCase()}-v${version ?? 0}.${format}`
}

/**
 * L6 — 받아서 숨은 `<a download>` 로 저장하고 blob URL 은 곧바로 되돌린다. 파일명은 서버 `Content-Disposition` → 없으면 규칙 이름.
 * 저장 위치·결과는 브라우저가 정한다(앱 WebView 는 저장이 안 될 수 있다 — 화면이 안내).
 */
export async function downloadExport(format: LexiconFormat, env: AdminEnvironment, version: number | null): Promise<string> {
  const { blob, filename } = await apiGetFile(exportPath(format))
  const name = filename || exportFilename(env, version, format)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // 클릭이 내려받기를 시작한 뒤에 되돌린다(같은 틱에 revoke 하면 일부 브라우저가 빈 파일을 받는다).
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return name
}

export interface DraftEntryBody {
  surface: string
  reading: string
  accentType: number
  priority: number
  scope: LexiconScopeName
  scopeRefId: string | null
  wordType: LexiconWordType | null
}

export interface PreviewBody {
  text: string
  voiceId?: string
  draftEntries?: DraftEntryBody[]
  compare?: boolean
}

export const PREVIEW_PATH = `${BASE}/preview`

/** L7 — 읽기 확인(JSON). */
export const preview = (body: PreviewBody, opts?: ApiOptions) => apiPost<LexiconPreviewDto>(PREVIEW_PATH, body, opts)

/** L7 소리 — 같은 본문 + `side` 를 `Accept: audio/wav` 로. 서버는 서명 URL 을 주지 않는다(`audioUrl: null`). */
export const previewAudio = (body: PreviewBody, side: 'before' | 'after', opts?: { signal?: AbortSignal }) =>
  apiPostAudio(PREVIEW_PATH, { ...body, side }, opts)

export const versionsPath = (page: number) => `${BASE}/versions?page=${page}&pageSize=${VERSIONS_PAGE_SIZE}`
export const versionDetailPath = (v: number, compare: 'previous' | 'active') => `${BASE}/versions/${enc(String(v))}?compare=${compare}`
export const rollback = (v: number, body: WriteMeta) => apiPost<LexiconRollbackResultDto>(`${BASE}/versions/${enc(String(v))}/rollback`, body)
