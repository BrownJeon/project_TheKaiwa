/** qa-p2c-B 공용 도우미 — 쿠키·API·SSE 턴·claude 프로세스 점검. 운영(3010)·비 localhost 거부, PRODUCTION 거부. */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

export const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 금지')
export const BASE = process.env.BASE ?? 'http://127.0.0.1:3034'
const u = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(u.hostname) || Number(u.port) === 3010) throw new Error('BASE 는 localhost(3010 제외)만')
export const cookieOf = (f: string): string => readFileSync(f, 'utf8').trim()
export type Json = Record<string, unknown>
export const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|SCENARIO_OPENING/i
export const stats = { leak: 0 }

export const results: { id: string; ok: boolean | null; note: string }[] = []
export function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
export function skip(id: string, note: string): void {
  results.push({ id, ok: null, note })
  console.log(`SKIP ${id} — ${note}`)
}
export function summary(): void {
  const fail = results.filter((x) => x.ok === false).length
  const sk = results.filter((x) => x.ok === null).length
  console.log(`RESULT pass=${results.length - fail - sk} fail=${fail} skip=${sk}`)
  process.exitCode = fail ? 1 : 0
}

export async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json; ms: number; retryAfter: string | null; raw: string }> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) stats.leak++
  let data: Json = {}
  try {
    data = obj((JSON.parse(text) as { data?: unknown }).data)
    if (!Object.keys(data).length) data = obj((JSON.parse(text) as { error?: unknown }).error)
  } catch {
    data = {}
  }
  return { status: r.status, data, ms: Math.round(performance.now() - t0), retryAfter: r.headers.get('retry-after'), raw: text }
}
export const details = (d: Json): Json => obj(d.details)
export const reason = (d: Json): unknown => details(d).reason

export interface Ev { event: string; data: Json; at: number }
export interface TurnRun {
  /** 응답 헤더를 받은 시각(ms) · 상태. SSE 가 아니면(거절) 곧바로 finished 도 채워진다. */
  head: Promise<{ status: number; sse: boolean; at: number }>
  finished: Promise<{ status: number; events: Ev[]; data: Json; firstAudioAt: number | null; doneAt: number | null; firstEventAt: number | null }>
}
/** 턴을 시작해 `head`(헤더 시점)와 `finished`(SSE 끝까지)를 돌려준다. */
export function startTurn(cookie: string, chatId: string, text: string, inputSource: 'TEXT' | 'VOICE' = 'TEXT'): TurnRun {
  const t0 = performance.now()
  let headRes!: (v: { status: number; sse: boolean; at: number }) => void
  const head = new Promise<{ status: number; sse: boolean; at: number }>((r) => (headRes = r))
  const finished = (async () => {
    const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource }) })
    const sse = (r.headers.get('content-type') ?? '').includes('text/event-stream')
    headRes({ status: r.status, sse, at: performance.now() - t0 })
    if (!sse) {
      const body = await r.text()
      let data: Json = {}
      try {
        data = obj((JSON.parse(body) as { data?: unknown }).data)
        if (!Object.keys(data).length) data = obj((JSON.parse(body) as { error?: unknown }).error)
      } catch {
        data = {}
      }
      return { status: r.status, events: [] as Ev[], data, firstAudioAt: null, doneAt: null, firstEventAt: null }
    }
    const events: Ev[] = []
    const reader = r.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = dec.decode(value, { stream: true })
      if (LEAK.test(chunk)) stats.leak++
      buf += chunk
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (block.startsWith(':')) continue
        const ev = /^event: (.+)$/m.exec(block)?.[1]
        const d = /^data: (.+)$/m.exec(block)?.[1]
        if (ev && d) events.push({ event: ev, data: JSON.parse(d) as Json, at: performance.now() - t0 })
      }
    }
    return {
      status: r.status, events, data: {},
      firstAudioAt: events.find((e) => e.event === 'audio')?.at ?? null,
      doneAt: events.find((e) => e.event === 'done')?.at ?? null,
      firstEventAt: events[0]?.at ?? null,
    }
  })()
  return { head, finished }
}
export const doneOf = (events: Ev[]): Json => obj(events.find((e) => e.event === 'done')?.data)

/** 서버(SERVER_PID)의 자식 `claude --print` 프로세스 PID 목록. */
export function claudeKids(): number[] {
  const sp = process.env.SERVER_PID ?? ''
  if (!sp) return []
  const out = execSync('ps -eo pid=,ppid=,args=', { encoding: 'utf8' })
  return out.split('\n').filter((l) => /\bclaude --print\b/.test(l) && l.trim().split(/\s+/)[1] === sp).map((l) => Number(l.trim().split(/\s+/)[0]))
}
/** 서버가 아닌 곳에서 도는 `claude --print`(다른 레인) 개수. */
export function claudeOthers(): number {
  const sp = process.env.SERVER_PID ?? ''
  const out = execSync('ps -eo pid=,ppid=,args=', { encoding: 'utf8' })
  return out.split('\n').filter((l) => /\bclaude --print\b/.test(l) && l.trim().split(/\s+/)[1] !== sp).length
}
