/** qa-045-b1 공용 도우미 — 쿠키·API·페이서·통계·claude 프로세스 점검. 127.0.0.1:3046(개발 서버)만, 3010(운영)·그 밖 거부. */
import { readFileSync, appendFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:3046'
const u = new URL(BASE)
if (u.hostname !== '127.0.0.1' || Number(u.port) === 3010 || (process.env.APP_ENV ?? 'LOCAL').toUpperCase() === 'PRODUCTION') throw new Error('BASE 는 127.0.0.1(3010 제외)만')
export const SP = process.env.SP
export const cookieOf = (f) => readFileSync(f, 'utf8').trim()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
if (Number(process.env.START_DELAY_MS)) await sleep(Number(process.env.START_DELAY_MS))
export const results = []
export function check(id, ok, note = '') {
  results.push({ id, ok, note })
  console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
export function summary() {
  const fail = results.filter((x) => x.ok === false).length
  const sk = results.filter((x) => x.ok === null).length
  console.log(`RESULT pass=${results.length - fail - sk} fail=${fail} skip=${sk}`)
}
export const pct = (arr, p) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
/** 호출 수 계수(Claude 를 부른 것으로 보이는 요청) */
export const calls = { total: 0 }
/** 슬라이딩 창 페이서 — n 건/windowMs 를 넘지 않게 호출 전에 기다린다(서버 한도는 분당 6 등). */
export function makePacer(n, windowMs = 60_000, margin = 1500) {
  const stamps = []
  return async () => {
    for (;;) {
      const now = Date.now()
      while (stamps.length && now - stamps[0] > windowMs + margin) stamps.shift()
      if (stamps.length < n) break
      await sleep(stamps[0] + windowMs + margin - now)
    }
    stamps.push(Date.now())
  }
}
export function claudeProcs() {
  try {
    return Number(execSync("ps -eo args | grep -E '^claude( |$)|/claude( |$)' | grep -E -- '--print|-p ' | grep -vc grep", { encoding: 'utf8' }).trim())
  } catch {
    return 0
  }
}
export async function api(cookie, method, path, body, { log } = {}) {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), signal: AbortSignal.timeout(120_000) })
  const raw = await r.text()
  const ms = Math.round(performance.now() - t0)
  let json = null
  try { json = JSON.parse(raw) } catch { /* html 등 */ }
  const out = { status: r.status, ms, json, raw, retryAfter: r.headers.get('retry-after') }
  if (log) appendFileSync(log, `${new Date().toISOString()} ${method} ${path} ${typeof body === 'string' ? body : JSON.stringify(body ?? null)} -> ${r.status} ${ms}ms ${raw.slice(0, 6000)}\n`)
  return out
}
/** 응답에 엔진·내부 식별자가 새는지 */
export const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|model_id|speaker_id|systemSha|traceId|credentialRef/i
export const errCode = (r) => r.json?.data?.code ?? r.json?.code ?? null
export const reason = (r) => r.json?.data?.details?.reason ?? r.json?.data?.reason ?? r.json?.details?.reason ?? null
