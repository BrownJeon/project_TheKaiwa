/**
 * task-003d 라이브 스모크 — 앱 TTS 플랫폼 층(#23 `POST /api/v1/speech/tts` · #18 `/voices/preview` · `GET /api/v1/speech/tts/status`)을
 * 실제 서버(127.0.0.1)·실제 DB 에 친다. **M4 tts-service 가 떠 있지 않은 상태**(현재)를 전제로 한 경로와, 캐시를 미리 채워 HIT 경로를 본다.
 *   - M4 가 떠 있으면(TTS_SMOKE_EXPECT_M4=1) MISS 합성·캐시 적중·키 요소 변경 미적중·SpeechProfile 길이 비교·/g2p 골든 대조를 추가로 본다.
 *
 * 실행(우분투 미러): `bash tests/live/task003d-smoke.sh [포트=3011]` — QA 쿠키(USER·ADMIN) 생성·삭제를 감싼다.
 * DB(개발·운영 공유)에 쓰는 것: QA 계정 PREVIEW Trace · 미리 채운 TtsCache 행+파일(키 = 해시) · LOCAL TTS connection Health 결과.
 * 끝나면 이 실행이 만든 TtsCache 행·파일, RequestTrace(QA 계정), EngineHealth 를 지우고 LOCAL TTS connection 상태를 시작 전 값으로 되돌린다.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { cacheSegments, storeCachedAudio } from '../../src/modules/speech/tts/cache'
import { prepareSentence } from '../../src/modules/speech/tts/synthesize'
import { removeDataFile } from '../../src/modules/infra/storage'
import { NORMALIZER_GOLDEN } from '../../src/modules/speech/__tests__/fixtures/normalizerGolden'
import { normalizeJapanese } from '../../src/modules/speech/tts/normalizer'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const EXPECT_M4 = process.env.TTS_SMOKE_EXPECT_M4 === '1'
const [cUser, cAdmin] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cUser || !cAdmin) throw new Error('사용: task003d-smoke.ts <user 쿠키> <admin 쿠키>')

const prisma = new PrismaClient()
const startedAt = new Date()
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

interface Res {
  status: number
  headers: Headers
  json: { success?: boolean; data?: Record<string, unknown> & { code?: string; details?: Record<string, unknown> }; message?: string | null } | null
  bytes: Buffer
  ms: number
}
const leakCorpus: string[] = []
async function call(cookie: string | null, method: string, path: string, body?: unknown, accept = 'audio/wav'): Promise<Res> {
  const t0 = performance.now()
  const headers: Record<string, string> = { accept }
  if (cookie) headers.Cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${path}`, { method, headers, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) })
  const bytes = Buffer.from(await r.arrayBuffer())
  const ms = performance.now() - t0
  let json: Res['json'] = null
  // 엔진명 비노출 검사는 **사용자 API** 응답만 모은다(관리자 콘솔은 connectionKey·모델명을 보여 주는 게 정상).
  const userFacing = !path.startsWith('/api/admin/')
  if ((r.headers.get('content-type') ?? '').includes('json')) {
    try {
      json = JSON.parse(bytes.toString('utf8'))
    } catch {
      json = null
    }
    if (userFacing) leakCorpus.push(bytes.toString('utf8'))
  }
  if (userFacing) leakCorpus.push([...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n'))
  return { status: r.status, headers: r.headers, json, bytes, ms }
}
const code = (r: Res) => r.json?.data?.code
const details = (r: Res) => (r.json?.data?.details ?? {}) as Record<string, unknown>

function fakeWav(ms: number): Buffer {
  const rate = 44100
  const data = Math.round((rate * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + data, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(data, 40)
  return b
}
const p50 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]
function wavMs(buf: Buffer): number | null {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null
  const byteRate = buf.readUInt32LE(28)
  return byteRate ? Math.round(((buf.length - 44) * 1000) / byteRate) : null
}

async function main() {
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  const env = (process.env.APP_ENV ?? 'LOCAL').toUpperCase() as 'LOCAL'
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment: env, role: 'TTS' } } })
  const conn = policy ? await prisma.engineConnection.findUnique({ where: { id: policy.primaryConnectionId } }) : null
  if (!conn) throw new Error('LOCAL TTS connection 이 없다')
  const snapshot = { status: conn.status, statusReason: conn.statusReason, lastHealthAt: conn.lastHealthAt, lastFunctionalAt: conn.lastFunctionalAt }
  const seededKeys: string[] = []

  try {
    // ── 1. 인증 ────────────────────────────────────────────────
    const noAuth = [await call(null, 'POST', '/api/v1/speech/tts', { text: 'こんにちは。' }), await call(null, 'GET', '/api/v1/speech/tts/status', undefined, 'application/json'), await call(null, 'POST', '/api/v1/voices/preview', { voiceProfileId: 'teacher_haruka', style: 'AUTO', speed: 1, pitch: 1, intonation: 1 })]
    check('1 세션 없으면 #23·status·#18 모두 401', noAuth.every((r) => r.status === 401), noAuth.map((r) => r.status).join(','))

    // ── 2. 입력 검증(엔진 수치 불가) ─────────────────────────────
    const bad = async (body: unknown) => {
      const r = await call(cUser, 'POST', '/api/v1/speech/tts', body)
      return `${r.status}:${String(details(r).reason ?? '')}`
    }
    const v = [await bad({ text: 'こんにちは。', speakerId: 2 }), await bad({ text: 'こんにちは。', styleWeight: 1.5 }), await bad({ text: 'あ'.repeat(101) }), await bad({ text: 'a', foo: 1 }), await bad({ text: 'a', renderingPlan: { segments: [{ speed: 0.5 }] } }), await bad({ text: 'a', voiceId: 'teacher_nobody' })]
    check(
      '2 검증: 엔진 수치 400(engine_param)·101자·모르는 키·수치 속도·없는 목소리 400',
      v[0] === '400:engine_param' && v[1] === '400:engine_param' && v[2].startsWith('400') && v[3] === '400:unknown_key' && v[4].startsWith('400') && v[5] === '400:VOICE_NOT_AVAILABLE',
      v.join(' '),
    )

    // ── 3. 상태(M4 없음 → 자막만) ───────────────────────────────
    const st = await call(cUser, 'GET', '/api/v1/speech/tts/status', undefined, 'application/json')
    const sd = (st.json?.data ?? {}) as Record<string, unknown>
    if (EXPECT_M4) check('3 status: M4 정상 → SERVER·HEALTHY', st.status === 200 && sd.executionMode === 'SERVER', JSON.stringify(sd))
    else
      check(
        '3 status: M4 없음 → 200 TEXT_ONLY·UNAVAILABLE·사유, 3초 이내',
        st.status === 200 && sd.executionMode === 'TEXT_ONLY' && sd.serverHealth === 'UNAVAILABLE' && ['NO_CONNECTION', 'SERVER_TIMEOUT', 'SERVER_ERROR'].includes(String(sd.fallbackReason)) && st.ms < 3000,
        `${JSON.stringify(sd)} ${Math.round(st.ms)}ms`,
      )
    check('3b status 응답 키는 정본 5개뿐', Object.keys(sd).sort().join(',') === 'executionMode,fallbackReason,lastUpdatedAt,networkStatus,serverHealth', Object.keys(sd).join(','))

    // ── 4. MISS(M4 없음) → 422 자막만 ─────────────────────────────
    if (!EXPECT_M4) {
      const miss = await call(cUser, 'POST', '/api/v1/speech/tts', { text: '今日は9:30に会いましょう。' })
      check('4 MISS + M4 없음 → 422 ENGINE_UNAVAILABLE(reason TTS_UNAVAILABLE, runtime TEXT_ONLY)', miss.status === 422 && code(miss) === 'ENGINE_UNAVAILABLE' && details(miss).reason === 'TTS_UNAVAILABLE' && (details(miss).runtime as { executionMode?: string })?.executionMode === 'TEXT_ONLY', `${miss.status} ${JSON.stringify(details(miss))} ${Math.round(miss.ms)}ms`)
    }

    // ── 5. 캐시 HIT(미리 채움) — M4 호출 0 ─────────────────────────
    const hitText = 'キャッシュのテストです。'
    const prep = await prepareSentence({ userId: qa.id, text: hitText, trace: { refType: 'speechTts' } })
    if (!prep.key || !prep.parts) throw new Error('캐시 키를 만들지 못했다(TTS connection 없음)')
    const audio = fakeWav(700)
    if (!EXPECT_M4) {
      await storeCachedAudio(prep.key, prep.parts, audio, 700)
      seededKeys.push(prep.key)
    }
    const hits: Res[] = []
    for (let i = 0; i < 5; i++) hits.push(await call(cUser, 'POST', '/api/v1/speech/tts', { text: hitText }))
    const firstHit = EXPECT_M4 ? hits.slice(1) : hits
    check(
      '5 같은 문장 → 200 audio/wav · X-Tts-Cache HIT · 길이 헤더',
      firstHit.every((r) => r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('audio/wav') && r.headers.get('x-tts-cache') === 'HIT') && (EXPECT_M4 || hits[0].bytes.equals(audio)),
      hits.map((r) => `${r.status}/${r.headers.get('x-tts-cache')}`).join(' '),
    )
    const hitMs = firstHit.map((r) => r.ms)
    const hitServer = firstHit.map((r) => Number(r.headers.get('x-tts-ttfa-ms') ?? NaN))
    check('5b HIT 지연 p50 ≤ 120ms(왕복)', p50(hitMs) <= 120, `왕복 p50 ${Math.round(p50(hitMs))}ms · 서버 TTFA p50 ${p50(hitServer)}ms`)
    check('5c 응답 헤더에 캐시 키·엔진 정보 없음', hits.every((r) => !r.headers.get('x-tts-cache-key') && ![...r.headers.keys()].some((k) => k.startsWith('x-kaiwa'))), [...hits[0].headers.keys()].filter((k) => k.startsWith('x-')).join(','))

    // 키 요소 하나만 바꿔도 미적중(프로필·라벨·문장부호)
    const variants = [
      // 미리 채운 키는 QA 계정의 저장 프로필로 만들어졌다 — 그와 다른 프로필을 명시한다.
      { speechProfile: prep.profile === 'LEARNING_SLOW' ? 'NATIVE' : 'LEARNING_SLOW' },
      { renderingPlan: { segments: [{ speed: 'SLOW' }] } },
      { context: { styleHint: 'ENCOURAGING' } },
    ]
    const vr: string[] = []
    for (const extra of variants) {
      const r = await call(cUser, 'POST', '/api/v1/speech/tts', { text: hitText, ...extra })
      vr.push(`${r.status}/${r.headers.get('x-tts-cache') ?? code(r)}`)
    }
    check('5d 키 요소(프로필·속도 라벨·LLM 라벨) 하나만 바뀌어도 HIT 아님', vr.every((x) => !x.includes('HIT')), vr.join(' '))

    // ── 6. 미리듣기 HIT(미리 채움) + 분당 10 초과 429 ─────────────────
    const pv = await prisma.appSetting.findUnique({ where: { environment_key: { environment: env, key: 'voice.preview.defaultText' } } })
    const pvVer = await prisma.appSetting.findUnique({ where: { environment_key: { environment: env, key: 'voice.preview.textVersion' } } })
    const draft = { voiceProfileId: 'teacher_sakura', style: 'AUTO', styleWeight: null, speed: 0.9, pitch: 1, intonation: 1, speechProfile: 'NATIVE' as const }
    const pprep = await prepareSentence({
      userId: qa.id,
      text: typeof pv?.value === 'string' ? pv.value : 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。',
      voiceId: draft.voiceProfileId,
      speechProfile: 'NATIVE',
      draft: { style: draft.style, styleWeight: draft.styleWeight, speed: draft.speed, pitch: draft.pitch, intonation: draft.intonation },
      textVersion: typeof pvVer?.value === 'number' ? pvVer.value : 1,
      trace: { refType: 'voicePreview', refId: draft.voiceProfileId },
    })
    if (!EXPECT_M4 && pprep.key && pprep.parts) {
      await storeCachedAudio(pprep.key, pprep.parts, fakeWav(900), 900)
      seededKeys.push(pprep.key)
    }
    const ph = await call(cUser, 'POST', '/api/v1/voices/preview', draft)
    check('6 미리듣기(draft·들려주는 방식) → 200 audio/wav · X-Tts-Cache', ph.status === 200 && (ph.headers.get('content-type') ?? '').startsWith('audio/wav') && !!ph.headers.get('x-tts-cache'), `${ph.status} ${ph.headers.get('x-tts-cache')}`)
    const more: number[] = []
    for (let i = 0; i < 10; i++) more.push((await call(cUser, 'POST', '/api/v1/voices/preview', { ...draft, voiceProfileId: ['teacher_haruka', 'teacher_sakura', 'teacher_takumi'][i % 3] })).status)
    const last = await call(cUser, 'POST', '/api/v1/voices/preview', draft)
    check('6b 미리듣기 11번째(분당 10 초과) → 429 + Retry-After', more[9] === 429 && last.status === 429 && !!last.headers.get('retry-after') && more.slice(0, 9).every((s) => s !== 429), `${more.join(',')} → ${last.status} retry=${last.headers.get('retry-after')}`)
    if (!EXPECT_M4) check('6c M4 없음 → 미리듣기 MISS 는 422(500 없음)', more.slice(0, 9).every((s) => s === 422 || s === 200), more.join(','))

    // ── 7. #23 분당 60 초과 429 ─────────────────────────────────
    let n = 0
    let limited: Res | null = null
    while (n < 80) {
      const r = await call(cUser, 'POST', '/api/v1/speech/tts', { text: hitText })
      n++
      if (r.status === 429) {
        limited = r
        break
      }
    }
    check('7 #23 분당 60 초과 → 429 + Retry-After', !!limited && !!limited.headers.get('retry-after'), `${n}번째 요청에서 ${limited?.status}`)

    // ── 8. 관리자 콘솔: TTS Health·Functional Test ────────────────
    const h = await call(cAdmin, 'POST', `/api/admin/v1/engine-connections/${conn.id}/health`, {}, 'application/json')
    const hd = (h.json?.data ?? {}) as Record<string, unknown>
    const hStatus = (hd.health as { status?: string } | undefined)?.status ?? (hd.status as string | undefined)
    if (EXPECT_M4) check('8 Health(M4 정상) → HEALTHY', h.status === 200 && hStatus === 'HEALTHY', JSON.stringify(hd).slice(0, 200))
    else check('8 Health(M4 없음) → 200 UNAVAILABLE(500 없음)', h.status === 200 && hStatus === 'UNAVAILABLE', JSON.stringify(hd).slice(0, 200))
    const ft = await call(cAdmin, 'POST', `/api/admin/v1/engine-connections/${conn.id}/test`, {}, 'application/json')
    const fd = JSON.stringify(ft.json?.data ?? {})
    if (EXPECT_M4) check('8b Functional Test(M4 정상) → 고정 문장 합성 ok · audioBytes', ft.status === 200 && /"audioBytes":\d+/.test(fd), fd.slice(0, 240))
    else check('8b Functional Test(M4 없음) → 200 SERVICE_DOWN 생략(500 없음)', ft.status === 200 && fd.includes('SERVICE_DOWN'), fd.slice(0, 240))

    // ── 9. M4 가 있을 때만: MISS 합성·HIT·프로필 길이·/g2p 골든 ──────────
    if (EXPECT_M4) {
      const text = `今日は${new Date().getSeconds()}分ぐらい話しましょう。`
      const m1 = await call(cUser, 'POST', '/api/v1/speech/tts', { text })
      const m2 = await call(cUser, 'POST', '/api/v1/speech/tts', { text })
      check('9 M4: 첫 요청 MISS·두 번째 HIT(M4 호출 0)', m1.status === 200 && m1.headers.get('x-tts-cache') === 'MISS' && m2.headers.get('x-tts-cache') === 'HIT', `${m1.status}/${m1.headers.get('x-tts-cache')} ${Math.round(m1.ms)}ms → ${m2.headers.get('x-tts-cache')} ${Math.round(m2.ms)}ms`)
      const slow = await call(cUser, 'POST', '/api/v1/speech/tts', { text, speechProfile: 'LEARNING_SLOW' })
      check('9b LEARNING_SLOW 는 NATIVE 보다 길다', slow.status === 200 && (wavMs(slow.bytes) ?? 0) > (wavMs(m1.bytes) ?? 0), `${wavMs(m1.bytes)}ms → ${wavMs(slow.bytes)}ms`)
    }
    if (EXPECT_M4 && process.env.TTS_SMOKE_G2P_URL && process.env.TTS_SERVICE_SECRET) {
      const miss: string[] = []
      const strip = (s: string) => s.replace(/[ーウ]/g, '')
      for (const g of NORMALIZER_GOLDEN) {
        const r = await fetch(`${process.env.TTS_SMOKE_G2P_URL}/g2p`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-secret': process.env.TTS_SERVICE_SECRET }, body: JSON.stringify({ text: normalizeJapanese(g.text).normalizedText }) })
        const j = (await r.json()) as { reading?: string }
        if (!g.reading.every((frag) => strip(j.reading ?? '').includes(strip(frag)))) miss.push(`${g.id}:${j.reading}`)
      }
      check('9c 정규화 골든 /g2p 읽기 대조(長音·ウ 무시)', miss.length === 0, miss.join(' | ') || `${NORMALIZER_GOLDEN.length}건 일치`)
    }

    // ── 10. Trace: 하위 단계 ms 만, 본문 없음 ──────────────────────
    const traces = await prisma.requestTrace.findMany({ where: { userId: qa.id, createdAt: { gte: startedAt }, kind: 'PREVIEW' }, select: { steps: true, refType: true, status: true } })
    const names = new Set(traces.flatMap((t) => (t.steps as { name: string }[]).map((s) => s.name)))
    const traceText = JSON.stringify(traces)
    check('10 Trace: TTS·TTS_LEXICON·TTS_NORMALIZE·TTS_PLAN·TTS_SYNTH[0] 단계', ['TTS', 'TTS_LEXICON', 'TTS_NORMALIZE', 'TTS_PLAN', 'TTS_SYNTH[0]'].every((n2) => names.has(n2)) && traces.some((t) => t.refType === 'speechTts') && traces.some((t) => t.refType === 'voicePreview'), [...names].join(','))
    check('10b Trace 에 문장·정규화 결과·시크릿 없음', !/キャッシュ|テスト|会いましょう|九時|勉強/.test(traceText) && !(process.env.TTS_SERVICE_SECRET && traceText.includes(process.env.TTS_SERVICE_SECRET)), `${traces.length}행`)

    // ── 11. 사용자 응답 전체: 엔진명·호스트·연결 키 0 ────────────────
    const corpus = leakCorpus.join('\n')
    const leaks = corpus.match(/style-?bert|sbv2|jvnv|:8200|192\.168\.|connectionKey|x-kaiwa|tts-cache|DATA_ROOT/gi)
    if (leaks) for (const piece of leakCorpus.filter((x) => /style-?bert|sbv2|jvnv|:8200|192\.168\.|connectionKey|x-kaiwa|tts-cache|DATA_ROOT/i.test(x))) console.log('  누출 후보:', piece.slice(0, 300))
    check('11 사용자 응답·헤더에 엔진명·호스트·연결 키·경로 0', !leaks, leaks ? [...new Set(leaks)].join(',') : `${leakCorpus.length}개 응답 검사`)
    if (process.env.TTS_SERVICE_SECRET) check('11b 응답에 TTS 시크릿 없음', !corpus.includes(process.env.TTS_SERVICE_SECRET))
  } finally {
    // ── 정리 ────────────────────────────────────────────────────
    for (const k of seededKeys) {
      await prisma.ttsCache.delete({ where: { key: k } }).catch(() => undefined)
      await removeDataFile(cacheSegments(k)).catch(() => undefined)
    }
    const qaIds = (await prisma.user.findMany({ where: { email: { in: ['qa-bot@thekaiwa.test', 'qa-admin@thekaiwa.test'] } }, select: { id: true } })).map((u) => u.id)
    const tr = await prisma.requestTrace.deleteMany({ where: { userId: { in: qaIds }, createdAt: { gte: startedAt } } })
    const eh = await prisma.engineHealth.deleteMany({ where: { connectionId: conn.id, checkedAt: { gte: startedAt } } })
    await prisma.engineConnection.update({ where: { id: conn.id }, data: snapshot })
    console.log(`(정리) 캐시 ${seededKeys.length}·Trace ${tr.count}·EngineHealth ${eh.count} 삭제, TTS connection 상태 원복(${snapshot.status})`)
    await prisma.$disconnect()
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error('스모크 중단:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
