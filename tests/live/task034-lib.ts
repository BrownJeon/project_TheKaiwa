/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트(응답 JSON 형태를 느슨하게 다룬다) */
/**
 * task-034 QA 공용 도우미 — 서버 localhost(3011 새 코드 · 3012 옛 코드 복제본)만, APP_ENV=LOCAL 만.
 * 쿠키 파일은 권한 600 임시 파일(QA 계정 전용 토큰). 관리자 미리듣기 분당 10 한도는 계정 3개(admin·developer·super)를 돌려 쓴다.
 */
import { readFileSync } from 'node:fs'

export const ENV = (process.env.APP_ENV ?? '').toUpperCase()
if (ENV !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만')
export const NEW = process.env.NEW ?? 'http://localhost:3011'
export const OLD = process.env.OLD ?? 'http://localhost:3012'
for (const b of [NEW, OLD]) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(b)) throw new Error('BASE 는 localhost 만')

export const cookie = (file: string) => readFileSync(file, 'utf8').trim()
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const L = '/api/admin/v1/lexicon'

export const results: { id: string; ok: boolean; note: string }[] = []
export function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
export function summary(name: string): void {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n== ${name}: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}

export interface Res {
  status: number
  json: any
  text: string
  bytes: Buffer
  headers: Headers
}
/** 모든 응답 본문 — 엔진명 노출 검사용. */
export const corpus: string[] = []
export async function call(base: string, ck: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const h: Record<string, string> = { ...headers }
  if (ck) h.Cookie = ck
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const r = await fetch(`${base}${path}`, { method, headers: h, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) })
  const bytes = Buffer.from(await r.arrayBuffer())
  const ct = r.headers.get('content-type') ?? ''
  const text = ct.includes('json') || ct.includes('text') ? bytes.toString('utf8') : ''
  let json: any = null
  if (ct.includes('json')) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (text) corpus.push(text)
  return { status: r.status, json, text, bytes, headers: r.headers }
}

export const ENGINE_NAME_RE = /reazon|whisper|style[-_ ]?bert|sbv2|model_id|speaker_id|modelId|speakerId|openjtalk|pyopenjtalk|sherpa/i

/** 관리자 API 도우미 — 같은 서버의 ACTIVE 버전을 읽어 baseVersion 으로 쓴다. */
export class Admin {
  constructor(
    readonly base: string,
    readonly ck: string,
  ) {}
  async active(): Promise<number> {
    const r = await call(this.base, this.ck, 'GET', `${L}?pageSize=1`)
    const v = r.json?.data?.active?.version ?? r.json?.data?.dictionaryVersion ?? r.json?.data?.activeVersion
    if (typeof v !== 'number') throw new Error(`ACTIVE 버전을 못 읽음 status=${r.status} ${r.text.slice(0, 200)}`)
    return v
  }
  async add(surface: string, reading: string, scope: 'GLOBAL' | 'USER', scopeRefId: string | null, reason: string, extra: Record<string, unknown> = {}): Promise<{ status: number; id: string | null; version: number | null; res: Res }> {
    const body: Record<string, unknown> = { surface, reading, scope, baseVersion: await this.active(), reason, ...extra }
    if (scopeRefId) body.scopeRefId = scopeRefId
    const r = await call(this.base, this.ck, 'POST', L, body)
    return { status: r.status, id: r.json?.data?.entry?.id ?? null, version: r.json?.data?.version?.version ?? null, res: r }
  }
  async disable(id: string, reason: string): Promise<{ status: number; version: number | null }> {
    const r = await call(this.base, this.ck, 'DELETE', `${L}/${id}`, { baseVersion: await this.active(), reason })
    return { status: r.status, version: r.json?.data?.version?.version ?? null }
  }
  async rollback(version: number, reason: string): Promise<{ status: number; version: number | null; res: Res }> {
    const r = await call(this.base, this.ck, 'POST', `${L}/versions/${version}/rollback`, { baseVersion: await this.active(), reason })
    return { status: r.status, version: r.json?.data?.version?.version ?? null, res: r }
  }
}

/** 미리듣기 읽기 확인 — 계정별 분당 10 한도를 지킨다(계정마다 직전 호출 시각을 기억, 7초 간격). */
export class Previewer {
  private last = new Map<string, number>()
  private i = 0
  constructor(
    readonly base: string,
    readonly cookies: string[],
  ) {}
  async preview(text: string, draftEntries: unknown[] = [], compare = false): Promise<Res> {
    const ck = this.cookies[this.i++ % this.cookies.length]
    const gap = 7500 / this.cookies.length
    const wait = (this.last.get(ck) ?? 0) + 7000 - Date.now()
    if (wait > 0) await sleep(Math.max(wait, 0))
    void gap
    this.last.set(ck, Date.now())
    const r = await call(this.base, ck, 'POST', `${L}/preview`, { text, draftEntries, compare })
    if (r.status === 429) {
      await sleep(Number(r.headers.get('retry-after') ?? 10) * 1000 + 500)
      return this.preview(text, draftEntries, compare)
    }
    return r
  }
}
