/**
 * task-007 라이브 스모크(서버) — 음성 회화 턴 계약을 실제 서버(127.0.0.1)·실제 LLM·M4 TTS 에 친다. 항목별 PASS/FAIL.
 *
 *  A. TALK 턴 SSE 순서(accepted → status… → audio… → done 1회)·audio 필드 모양·audioCount·엔진명/connectionKey/model 0·URL 에 userId 0
 *  B. CHAT 턴은 audio 없음·audioCount 0
 *  C. #24 서명 URL: 본인 200 audio/wav(private max-age ≤600)·JSON 변형 / 타인 세션·만료·변조·없는 키 → 같은 404 / 세션 없음 401
 *  D. #23 Accept: application/json → 서명 URL 로 재생 가능
 *  E. utteranceId: 없음 404·타인 404·REALTIME_STT 인데 없음 400·TEXT+id 400·연결+finalSource=USER·재사용 409 UTTERANCE_USED·10분 지남 409 UTTERANCE_EXPIRED
 *  F. #21b 원음: 본인 200·타인 404·세션 없음 401·보존 기한 지남 404
 *  G. #29: USER utteranceId·audioAvailable, ASSISTANT speechStyle
 *  H. clientTimings: 이번 Trace STT 단계, 직전 Trace PLAYBACK 단계 / Trace·toolLog 에 원문 0
 *  I. 예열 프로세스: dev 서버 자식 claude 대기 ≤ 2
 * TTS 불가(TEXT_ONLY) 경로는 M4 가 운영과 공유라 멈출 수 없어 단위 테스트(conversation/__tests__/task007 TEXT_ONLY)로 갈음한다(SKIP 표시).
 *
 * 실행(우분투 미러): `bash tests/live/task007-smoke.sh [포트=3011]`. Claude CLI 약 8회. 만든 행(QA 계정 Chat·Utterance·wav·Trace)은 끝에 지운다.
 * 출력에 쿠키·토큰·전사 전문을 찍지 않는다(길이·판정만).
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { signTtsAudioToken } from '../../src/modules/speech/tts/audioUrl'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task007-smoke.ts <cookie1> <cookie2>')
const C1 = readFileSync(c1file, 'utf8').trim()
const C2 = readFileSync(c2file, 'utf8').trim()
const DEV_PID = Number(process.env.DEV_PID ?? 0)
const DEV_LOG = process.env.DEV_LOG ?? ''
const prisma = new PrismaClient()
const LEAK = /claude|anthropic|haiku|sonnet|opus|qwen|style-?bert|reazon|whisper|sherpa|connectionKey|"model"|toolLog|192\.168\.|:8200|:8100/i
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const skip = (id: string, note: string) => console.log(`SKIP ${id} — ${note}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Res {
  status: number
  headers: Headers
  text: string
  json: { success?: boolean; data?: Record<string, unknown> & { code?: string; details?: Record<string, unknown> }; message?: string | null } | null
  bytes: Buffer
}
async function call(cookie: string | null, method: string, path: string, opts: { json?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (cookie) headers.Cookie = cookie
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) body = opts.form
  const r = await fetch(`${BASE}${path}`, { method, headers, body, redirect: 'manual' })
  const bytes = Buffer.from(await r.arrayBuffer())
  const text = (r.headers.get('content-type') ?? '').includes('json') ? bytes.toString('utf8') : ''
  let json: Res['json'] = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: r.status, headers: r.headers, text, json, bytes }
}
const data = (r: Res) => (r.json?.data ?? {}) as Record<string, unknown>
const reason = (r: Res) => (r.json?.data?.details as { reason?: string } | undefined)?.reason

interface Ev {
  event: string
  data: Record<string, unknown>
  at: number
}
interface Turn {
  status: number
  events: Ev[]
  raw: string
  envelope: Res['json']
}
async function turn(cookie: string, chatId: string, body: unknown, onAudio?: (data: Record<string, unknown>) => void): Promise<Turn> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const text = await r.text()
    return { status: r.status, events: [], raw: text, envelope: JSON.parse(text) }
  }
  const events: Ev[] = []
  let raw = ''
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = dec.decode(value, { stream: true })
    raw += chunk
    buf += chunk
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (block.startsWith(':')) continue
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (ev && d) {
        const e = { event: ev, data: JSON.parse(d) as Record<string, unknown>, at: performance.now() - t0 }
        events.push(e)
        if (ev === 'audio') onAudio?.(e.data)
      }
    }
  }
  return { status: r.status, events, raw, envelope: null }
}
async function turnOk(cookie: string, chatId: string, body: unknown, onAudio?: (data: Record<string, unknown>) => void): Promise<Turn> {
  for (let i = 0; i < 4; i++) {
    const r = await turn(cookie, chatId, body, onAudio)
    if (r.status !== 429 && !(r.status === 409 && r.envelope?.data?.details && 'runningMessageId' in (r.envelope.data.details as object))) return r
    await sleep(r.status === 429 ? 15_000 : 2_000)
  }
  throw new Error('턴이 계속 거절된다')
}

function wav(ms: number): Buffer {
  const bytes = Math.round((16_000 * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + bytes)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + bytes, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(16_000, 24)
  b.writeUInt32LE(32_000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(bytes, 40)
  for (let i = 44; i + 1 < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), i)
  return b
}
function uploadForm(text: string, key: string): FormData {
  const f = new FormData()
  f.set('audio', new File([new Uint8Array(wav(1200))], 'u.wav', { type: 'audio/wav' }))
  f.set('text', text)
  f.set('realtimeConnectionKey', key)
  f.set('durationMs', '1200')
  return f
}

const createdChats: string[] = []
const createdUtterances: string[] = []
const traceIds: string[] = []
const AUDIO_KEYS = ['cached', 'cacheKey', 'chunkIndex', 'durationMs', 'last', 'pauseBeforeMs', 'runtime', 'status', 'text', 'url'].sort()

async function main(): Promise<void> {
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  const env = (process.env.APP_ENV ?? 'LOCAL').toUpperCase() as 'LOCAL'
  const stt = await prisma.engineConnection.findFirst({ where: { environment: env, role: 'REALTIME_STT' }, select: { id: true } })
  const sttKey = stt?.id ?? 'x'

  const talk = data(await call(C1, 'POST', '/api/v1/chats', { json: { kind: 'TALK', title: 't007 smoke talk' } })).id as string
  const chat = data(await call(C1, 'POST', '/api/v1/chats', { json: { kind: 'CHAT', title: 't007 smoke chat' } })).id as string
  createdChats.push(talk, chat)

  // ── A. TALK 턴 SSE ─────────────────────────────────────────────────
  await call(C1, 'GET', `/api/v1/chats/${talk}`) // 방 진입 = 예열
  await sleep(3_000)
  // audio 이벤트를 받는 **그 순간** #24 를 부른다(MISS 청크의 캐시 행 커밋 전 경합 — 수정 전에는 0.6~1.4s 동안 404).
  const immediate: Promise<{ cached: boolean; status: number }>[] = []
  const grab = (d: Record<string, unknown>) => {
    if (d.status === 'OK') immediate.push(call(C1, 'GET', String(d.url)).then((r) => ({ cached: d.cached === true, status: r.status })))
  }
  const t1 = await turnOk(C1, talk, { text: '昨日映画を見に行くました', clientTimings: { sttMs: 70 } }, grab)
  const names = t1.events.map((e) => e.event)
  const audios = t1.events.filter((e) => e.event === 'audio')
  const done = t1.events.filter((e) => e.event === 'done')
  const doneIdx = names.indexOf('done')
  const d1 = done[0]?.data ?? {}
  traceIds.push(String(d1.traceId ?? ''))
  check('A1 SSE 순서: accepted 첫 번째, done 1회·마지막, audio 는 모두 done 전', t1.status === 200 && names[0] === 'accepted' && done.length === 1 && doneIdx === names.length - 1 && names.lastIndexOf('audio') < doneIdx, names.join(','))
  check('A2 status 단계 PROMPT·LLM·PARSE·TTS', ['PROMPT', 'LLM', 'PARSE', 'TTS'].every((s) => t1.events.some((e) => e.event === 'status' && e.data.stage === s)))
  const idx = audios.map((a) => a.data.chunkIndex as number).sort((a, b) => a - b)
  check('A3 audio chunkIndex 0..n-1(도착 순서 무관)', audios.length > 0 && idx.every((v, i) => v === i), idx.join(','))
  check(
    'A4 audio 필드 = 계약(ttfaMs 는 0번에만, runtime={executionMode:SERVER})',
    audios.every((a) => {
      const keys = Object.keys(a.data).filter((k) => k !== 'ttfaMs').sort()
      const rt = a.data.runtime as Record<string, unknown>
      return JSON.stringify(keys) === JSON.stringify(AUDIO_KEYS) && Object.keys(rt).length === 1 && rt.executionMode === 'SERVER' && ((a.data.chunkIndex === 0) === ('ttfaMs' in a.data))
    }),
  )
  const okAudios = audios.filter((a) => a.data.status === 'OK')
  check('A5 done.audioCount = OK 청크 수', d1.audioCount === okAudios.length, `audioCount=${String(d1.audioCount)} ok=${okAudios.length}`)
  check('A6 audio·done·status 에 엔진명·connectionKey·model 0', !LEAK.test(t1.raw))
  check('A7 audio URL 에 userId 0·/api/v1/speech/tts/ 접두', okAudios.every((a) => String(a.data.url).startsWith('/api/v1/speech/tts/') && !String(a.data.url).includes(qa.id)))
  const reply = (d1.conversation as { replyJa?: string } | undefined)?.replyJa ?? ''
  check('A8 audio 문장을 이으면 최종 replyJa(들리는 것 = 보이는 것)', audios.sort((a, b) => (a.data.chunkIndex as number) - (b.data.chunkIndex as number)).map((a) => a.data.text).join('').replace(/\s/g, '') === reply.replace(/\s/g, ''), `chunks=${audios.length} replyLen=${reply.length}`)

  const im = await Promise.all(immediate)
  check('A9 audio 이벤트 직후 #24 즉시 200(MISS 청크 포함 — 커밋 전 경합 없음)', im.length > 0 && im.every((x) => x.status === 200), im.map((x) => `${x.cached ? 'HIT' : 'MISS'}:${x.status}`).join(','))

  // ── B. CHAT ──────────────────────────────────────────────────────
  const tc = await turnOk(C1, chat, { text: '今日はいい天気ですね。' })
  const dc = tc.events.find((e) => e.event === 'done')?.data ?? {}
  traceIds.push(String(dc.traceId ?? ''))
  check('B1 CHAT 턴은 audio 0·audioCount 0', !tc.events.some((e) => e.event === 'audio') && dc.audioCount === 0 && tc.events.at(-1)?.event === 'done')

  // ── C. #24 ───────────────────────────────────────────────────────
  const url = String(okAudios[0]?.data.url ?? '')
  const token = url.slice('/api/v1/speech/tts/'.length)
  const own = await call(C1, 'GET', url)
  const cc = own.headers.get('cache-control') ?? ''
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? -1)
  check('C1 본인 200 audio/wav·RIFF·private max-age ≤600', own.status === 200 && (own.headers.get('content-type') ?? '').startsWith('audio/wav') && own.bytes.subarray(0, 4).toString('ascii') === 'RIFF' && cc.startsWith('private') && maxAge > 0 && maxAge <= 600, `${own.status} ${cc}`)
  const js = await call(C1, 'GET', url, { headers: { Accept: 'application/json' } })
  check('C2 Accept JSON → {audioUrl, durationMs, timing:null}', js.status === 200 && data(js).audioUrl === url && data(js).timing === null && typeof data(js).durationMs === 'number')
  const other = await call(C2, 'GET', url)
  const [p, m] = token.split('.')
  const tampered = await call(C1, 'GET', `/api/v1/speech/tts/${p}.${m.slice(0, -2)}${m.endsWith('AA') ? 'AB' : 'AA'}`)
  const expired = signTtsAudioToken(qa.id, String(okAudios[0]?.data.cacheKey), { now: Date.now() - 11 * 60_000 })
  const exp = await call(C1, 'GET', expired.url)
  const missing = await call(C1, 'GET', signTtsAudioToken(qa.id, 'f'.repeat(40)).url)
  const garbage = await call(C1, 'GET', '/api/v1/speech/tts/not-a-token')
  const four = [other, tampered, exp, missing, garbage]
  check('C3 타인 세션·변조·만료·없는 키·형식 오류 → 전부 404, 본문 동일', four.every((r) => r.status === 404) && new Set(four.map((r) => r.text)).size === 1, four.map((r) => r.status).join(','))
  check('C4 세션 없음 → 401', (await call(null, 'GET', url)).status === 401)
  check('C5 /tts/status 는 동적 세그먼트에 먹히지 않는다(200 JSON)', (await call(C1, 'GET', '/api/v1/speech/tts/status')).status === 200)

  // ── D. #23 JSON ──────────────────────────────────────────────────
  const j23 = await call(C1, 'POST', '/api/v1/speech/tts', { json: { text: reply.split(/(?<=[。！？])/)[0] || 'はい。', context: { styleHint: (d1.speech as { style?: string } | undefined)?.style ?? null } }, headers: { Accept: 'application/json' } })
  const u23 = String(data(j23).url ?? '')
  check('D1 #23 JSON → 서명 URL 재생 200·엔진명 0', j23.status === 200 && u23.startsWith('/api/v1/speech/tts/') && (await call(C1, 'GET', u23)).status === 200 && !LEAK.test(j23.text), `${j23.status} cached=${String(data(j23).cached)}`)

  const uniq = `今日は${'〇一二三四五六七八九'.split('').sort(() => Math.random() - 0.5).slice(0, 4).join('')}回目の練習です。`
  const jm = await call(C1, 'POST', '/api/v1/speech/tts', { json: { text: uniq }, headers: { Accept: 'application/json' } })
  const rm = await call(C1, 'GET', String(data(jm).url ?? ''))
  check('D2 #23 새 문장(MISS) JSON → 곧바로 서명 URL 200(캐시 행 커밋 전)', jm.status === 200 && data(jm).cached === false && rm.status === 200 && rm.bytes.subarray(0, 4).toString('ascii') === 'RIFF', `${jm.status} cached=${String(data(jm).cached)} → ${rm.status}`)

  // ── E. utteranceId ───────────────────────────────────────────────
  const rows = () => prisma.chatMessage.count({ where: { chatId: talk } })
  /** 수락 전 거절이면 행이 늘지 않고 SSE 도 없다(JSON 봉투). */
  const rejected = async (body: unknown) => {
    const before = await rows()
    const r = await turn(C1, talk, body)
    return { status: r.status, reason: reason({ json: r.envelope } as Res), sse: r.events.length, rowsAdded: (await rows()) - before, details: r.envelope?.data?.details }
  }
  const e1 = await rejected({ text: 'はい', inputSource: 'REALTIME_STT' })
  check('E1 REALTIME_STT 인데 utteranceId 없음 → 400·행 0', e1.status === 400 && e1.rowsAdded === 0 && e1.sse === 0)
  const e2 = await rejected({ text: 'はい', utteranceId: 'cnotexist000000000000000' })
  check('E2 없는 utteranceId → 404·행 0', e2.status === 404 && e2.rowsAdded === 0 && e2.sse === 0)
  const up2 = await call(C2, 'POST', '/api/v1/speech/utterances', { form: uploadForm('こんにちは', sttKey) })
  const u2 = String(data(up2).utteranceId ?? '')
  if (u2) createdUtterances.push(u2)
  const e3 = await rejected({ text: 'こんにちは', utteranceId: u2 })
  check('E3 타인 utteranceId → 404·행 0(DB 확인)', up2.status === 200 && e3.status === 404 && e3.rowsAdded === 0 && e3.sse === 0)
  const up1 = await call(C1, 'POST', '/api/v1/speech/utterances', { form: uploadForm('今日は雨です', sttKey) })
  const u1 = String(data(up1).utteranceId ?? '')
  if (u1) createdUtterances.push(u1)
  const e4 = await rejected({ text: '今日は雨です', utteranceId: u1, inputSource: 'TEXT' })
  check('E4 utteranceId + inputSource TEXT → 400·행 0', e4.status === 400 && e4.rowsAdded === 0)
  const prevAssistant = String(d1.assistantMessageId ?? '')
  const tv = await turnOk(C1, talk, { text: '今日は雨ですね', utteranceId: u1, inputSource: 'REALTIME_STT', clientTimings: { prevMessageId: prevAssistant, sttMs: 64, releaseToFirstAudioEventMs: 3800, firstAudioAtMs: 3950, playbackStartDelayMs: 140 } })
  const dv = tv.events.find((e) => e.event === 'done')?.data ?? {}
  traceIds.push(String(dv.traceId ?? ''))
  await sleep(1_500)
  const urow = u1 ? await prisma.utterance.findUnique({ where: { id: u1 }, select: { chatMessageId: true, finalText: true, finalSource: true } }) : null
  check('E5 고친 글자로 보냄 → 연결·finalText=text·finalSource=USER', tv.status === 200 && !!urow && urow.chatMessageId === dv.userMessageId && urow.finalText === '今日は雨ですね' && urow.finalSource === 'USER')
  const reuse = await rejected({ text: '今日は雨ですね', utteranceId: u1 })
  check('E6 같은 utteranceId 재사용 → 409 UTTERANCE_USED·행 0', reuse.status === 409 && reuse.reason === 'UTTERANCE_USED' && reuse.rowsAdded === 0 && reuse.sse === 0)
  const up3 = await call(C1, 'POST', '/api/v1/speech/utterances', { form: uploadForm('古い録音', sttKey) })
  const u3 = String(data(up3).utteranceId ?? '')
  if (u3) {
    createdUtterances.push(u3)
    await prisma.utterance.update({ where: { id: u3 }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } })
  }
  const old = await rejected({ text: '古い録音', utteranceId: u3 })
  check('E7 10분 지난 발화 → 409 UTTERANCE_EXPIRED·행 0', old.status === 409 && old.reason === 'UTTERANCE_EXPIRED' && old.rowsAdded === 0)

  // E8(REV-014 M2): gate·채팅 확인은 통과 → LLM 을 먼저 띄움 → 수락 트랜잭션이 "다른 인스턴스의 진행 중 턴" 으로 409.
  // 다른 채팅에 살아 있는(180초 안) PENDING 강사 행을 직접 넣어 그 상황을 만든다(이 프로세스의 메모리 락에는 없다).
  const ghost = await prisma.chatMessage.create({ data: { chatId: chat, userId: qa.id, role: 'ASSISTANT', content: '', status: 'PENDING' }, select: { id: true } })
  const logBefore = DEV_LOG ? readFileSync(DEV_LOG, 'utf8').split('\n').length : 0
  const e8 = await rejected({ text: 'もう一度話しましょう' })
  await sleep(1_500)
  const logTail = DEV_LOG ? readFileSync(DEV_LOG, 'utf8').split('\n').slice(logBefore).join('\n') : ''
  await prisma.chatMessage.delete({ where: { id: ghost.id } })
  check('E8 수락 거절(409 runningMessageId)·행 0·SSE 0', e8.status === 409 && (e8.details as { runningMessageId?: string } | undefined)?.runningMessageId === ghost.id && e8.rowsAdded === 0 && e8.sse === 0)
  if (DEV_LOG) check('E9 먼저 띄운 LLM 이 취소됨(서버 로그 `[claudeCli] 취소`)', /\[claudeCli\] 취소/.test(logTail) && !/\[claudeCli\] 완료/.test(logTail))
  else skip('E9 LLM 취소 로그', 'DEV_LOG 없음')

  // ── F. #21b ──────────────────────────────────────────────────────
  const a1 = await call(C1, 'GET', `/api/v1/speech/utterances/${u1}/audio`)
  check('F1 본인 원음 200 audio/wav', a1.status === 200 && (a1.headers.get('content-type') ?? '').startsWith('audio/wav') && a1.bytes.subarray(0, 4).toString('ascii') === 'RIFF')
  check('F2 타인 원음 404', (await call(C2, 'GET', `/api/v1/speech/utterances/${u1}/audio`)).status === 404)
  check('F3 세션 없음 401', (await call(null, 'GET', `/api/v1/speech/utterances/${u1}/audio`)).status === 401)
  if (u3) await prisma.utterance.update({ where: { id: u3 }, data: { audioExpiresAt: new Date(Date.now() - 1000) } })
  check('F4 보존 기한 지남 404', (await call(C1, 'GET', `/api/v1/speech/utterances/${u3}/audio`)).status === 404)

  // ── G. #29 ───────────────────────────────────────────────────────
  const detail = await call(C1, 'GET', `/api/v1/chats/${talk}`)
  const msgs = (data(detail).messages ?? []) as Record<string, unknown>[]
  const um = msgs.find((x) => x.id === dv.userMessageId)
  const plain = msgs.find((x) => x.id === d1.userMessageId)
  const am = msgs.find((x) => x.id === d1.assistantMessageId)
  check('G1 USER utteranceId·audioAvailable(발화 턴 true, 글자 턴 null/false)', um?.utteranceId === u1 && um?.audioAvailable === true && plain?.utteranceId === null && plain?.audioAvailable === false)
  check('G2 ASSISTANT speechStyle = done.speech.style', !!am && am.speechStyle === (d1.speech as { style?: string } | undefined)?.style)
  check('G3 #29 에 엔진명 0', !LEAK.test(detail.text))

  // ── H. 계측 ──────────────────────────────────────────────────────
  await sleep(2_000)
  const trV = await prisma.requestTrace.findUnique({ where: { traceId: String(dv.traceId) } })
  const tr1 = await prisma.requestTrace.findUnique({ where: { traceId: String(d1.traceId) } })
  const stepsV = (trV?.steps ?? []) as Record<string, unknown>[]
  const steps1 = (tr1?.steps ?? []) as Record<string, unknown>[]
  check('H1 Trace STT(클라)·ACCEPT·PROMPT·LLM(warm·firstDeltaMs)·SAVE·TTS[0](ttfaServerMs)', ['STT', 'ACCEPT', 'PROMPT', 'LLM', 'SAVE', 'TTS[0]'].every((n) => stepsV.some((s) => s.name === n)) && 'warm' in (stepsV.find((s) => s.name === 'LLM') ?? {}) && 'ttfaServerMs' in (stepsV.find((s) => s.name === 'TTS[0]') ?? {}))
  const pb = steps1.find((s) => s.name === 'PLAYBACK')
  check('H2 직전 턴 Trace 에 PLAYBACK(playbackStartDelayMs·firstAudioAtMs·releaseToFirstAudioEventMs)', pb?.playbackStartDelayMs === 140 && pb?.firstAudioAtMs === 3950 && pb?.releaseToFirstAudioEventMs === 3800)
  check('H3 UTTERANCE_LINK 단계(linked)', stepsV.some((s) => s.name === 'UTTERANCE_LINK' && s.linked === true))
  const msgRow = await prisma.chatMessage.findUnique({ where: { id: String(dv.assistantMessageId) }, select: { toolLog: true } })
  const tl = (msgRow?.toolLog ?? {}) as Record<string, unknown>
  check('H4 toolLog sttMs·llmMs·llmFirstSentenceMs·ttsStartMs·ttfaMs·totalMs·warm', ['sttMs', 'llmMs', 'llmFirstSentenceMs', 'ttsStartMs', 'ttfaMs', 'totalMs', 'warm'].every((k) => k in tl), JSON.stringify({ stt: tl.sttMs, first: tl.llmFirstSentenceMs, ttfa: tl.ttfaMs, warm: tl.warm }))
  const traceText = JSON.stringify([stepsV, steps1, tl])
  const originals = ['昨日映画を見に行くました', '今日は雨ですね', reply].filter((s) => s.length >= 4)
  check('H5 Trace·toolLog 에 원문·응답 전문 0', !originals.some((s) => traceText.includes(s)))

  // ── I. 예열 프로세스 ─────────────────────────────────────────────
  if (DEV_PID > 0) {
    let kids: string[] = []
    try {
      kids = execFileSync('pgrep', ['-a', '-f', '--', '--input-format stream-json'], { encoding: 'utf8' }).split('\n').filter((l) => l.includes('--print'))
    } catch {
      kids = []
    }
    check('I1 대기 예열 CLI ≤ 2', kids.length <= 2, `idle=${kids.length}`)
  } else skip('I1 대기 예열 CLI', 'DEV_PID 없음')
  skip('J TTS 불가(TEXT_ONLY) → done 정상·audioCount 0·TTS_UNAVAILABLE', 'M4 는 운영과 공유 — 단위 테스트 conversation/__tests__/task007 "TEXT_ONLY" 로 갈음')
}

main()
  .catch((e) => {
    console.error('스모크 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    results.push({ id: 'EXCEPTION', ok: false })
  })
  .finally(async () => {
    try {
      for (const id of createdUtterances) {
        const u = await prisma.utterance.findUnique({ where: { id }, select: { audioPath: true } })
        if (u?.audioPath) await removeDataFile(u.audioPath.split('/')).catch(() => undefined)
      }
      await prisma.utterance.deleteMany({ where: { id: { in: createdUtterances } } })
      await prisma.requestTrace.deleteMany({ where: { traceId: { in: traceIds.filter(Boolean) } } })
      await prisma.chat.deleteMany({ where: { id: { in: createdChats } } })
    } catch (e) {
      console.error('정리 실패:', e instanceof Error ? e.name : 'unknown')
    }
    await prisma.$disconnect()
    const failed = results.filter((r) => !r.ok)
    console.log(`\n결과: PASS ${results.length - failed.length} / ${results.length}${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
    process.exit(failed.length ? 1 : 0)
  })
