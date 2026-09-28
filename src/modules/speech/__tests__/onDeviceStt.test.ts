import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OnDeviceSttClient, PERMISSION_ONLY, type OnDeviceFailure, type OnDeviceUpload } from '../stt/client/OnDeviceSttClient'
import { decideRoute, resetOnDeviceRunStateForTest, SttRouter } from '../stt/client/router'
import { downloadErrorCode, estimateEtaSec, OnDeviceModelStore } from '../stt/client/onDeviceModel'
import { SttError, type SttClientConfig, type SttEvent } from '../stt/client/types'
import { FakeGateway, FakeOnDevice, pluginError, tick } from './fakeOnDevice'

const CFG: SttClientConfig = {
  recognitionMode: 'AUTO',
  gateway: { enabled: true },
  onDevice: {
    enabled: true,
    available: true,
    connectionKey: 'cconn0000000000000000000001',
    runtime: { numThreads: 2, decodingMethod: 'greedy_search', vad: { silenceMs: 500, threshold: 0.5 }, partial: true },
    model: { id: 'ondevice-ja-v1', version: 'v1', manifestUrl: '/models/ondevice-ja-v1/manifest.json', totalBytes: 169_824_553, wifiRecommended: true },
  },
  fallback: { onDeviceFailureThreshold: 2, toGateway: true },
  upload: { maxBytes: 2 * 1024 * 1024 },
}

function client(p: FakeOnDevice, extra: Partial<ConstructorParameters<typeof OnDeviceSttClient>[0]> = {}) {
  const events: SttEvent[] = []
  const uploads: OnDeviceUpload[] = []
  const failures: OnDeviceFailure[] = []
  const c = new OnDeviceSttClient({
    plugin: p,
    config: { ...CFG.onDevice!, upload: CFG.upload },
    upload: async (u) => {
      uploads.push(u)
      return 'cutt00000000000000000000001'
    },
    readWav: async () => new Blob([new Uint8Array(44)], { type: 'audio/wav' }),
    onFailure: (f) => failures.push(f),
    ...extra,
  })
  c.subscribe((e) => events.push(e))
  return { c, events, uploads, failures }
}

// ── 온디바이스 클라이언트 ────────────────────────────────────────────────

test('온디바이스: 이벤트 정규화(level·partial·final), TURN 은 wav 업로드 → utteranceId, 업로드 뒤 deleteWav, stop 결과와 final 이벤트는 한 번만', async () => {
  const p = new FakeOnDevice()
  const { c, events, uploads } = client(p)
  await c.begin({ purpose: 'TURN', chatId: 'c1' })
  assert.deepEqual(p.startOpts, { endpoint: 'manual', partial: true, saveWav: true, maxUtteranceSec: 60, vad: { silenceMs: 500, threshold: 0.5 }, numThreads: 2, decodingMethod: 'greedy_search' })
  const sid = p.current!
  p.emit('level', { sessionId: sid, db: -32.5 })
  p.emit('level', { sessionId: 'other', db: -10 })
  p.emit('partial', { sessionId: sid, segIdx: 0, text: 'こん' })
  c.end()
  await tick()
  await tick()
  const types = events.map((e) => e.type)
  assert.deepEqual(types, ['ready', 'level', 'partial', 'final'], '다른 세션 level 은 버린다 · final 한 번')
  const final = events.find((e) => e.type === 'final') as Extract<SttEvent, { type: 'final' }>
  assert.equal(final.text, 'こんにちは')
  assert.equal(final.utteranceId, 'cutt00000000000000000000001')
  assert.equal(uploads.length, 1)
  assert.equal(uploads[0].connectionKey, CFG.onDevice!.connectionKey, '#19 불투명 연결 id 를 그대로')
  assert.equal(uploads[0].chatId, 'c1')
  assert.deepEqual(uploads[0].segments, [{ segIdx: 0, start: 0, end: 1200, text: 'こんにちは' }])
  assert.deepEqual(uploads[0].timings, { vadMs: 20, decodeMs: 180, sttMs: 200 }, 'loadMs 등 허용 밖 키는 싣지 않는다')
  assert.deepEqual(p.deleted, ['/data/user/0/app/files/utterances/s1.wav'])
  assert.doesNotMatch(JSON.stringify(events), /modelVersion|reason|wavPath/, '플러그인 내부 값은 화면 이벤트에 없다')
})

test('온디바이스: MIC_TEST 는 wav 를 만들지도 올리지도 않는다 · 빈 결과는 업로드 없음 · 업로드 실패는 utteranceId null', async () => {
  const p = new FakeOnDevice()
  const t = client(p)
  await t.c.begin({ purpose: 'MIC_TEST' })
  assert.equal(p.startOpts?.saveWav, false)
  t.c.end()
  await tick()
  await tick()
  assert.equal(t.uploads.length, 0)
  assert.equal((t.events.at(-1) as { utteranceId?: unknown }).utteranceId, null)

  const p2 = new FakeOnDevice()
  p2.finalText = ''
  const t2 = client(p2)
  await t2.c.begin({ purpose: 'TURN' })
  t2.c.end()
  await tick()
  await tick()
  assert.equal(t2.uploads.length, 0, '빈 글자는 wavPath 가 null — 올릴 것 없음')
  assert.equal((t2.events.at(-1) as { text?: string }).text, '')

  const p3 = new FakeOnDevice()
  const t3 = client(p3, {
    upload: async () => {
      throw new Error('network')
    },
  })
  await t3.c.begin({ purpose: 'TURN' })
  t3.c.end()
  await tick()
  await tick()
  await tick()
  const f = t3.events.find((e) => e.type === 'final') as Extract<SttEvent, { type: 'final' }>
  assert.equal(f.text, 'こんにちは')
  assert.equal(f.utteranceId, null, '업로드 실패 → 글자 턴(§9-11 ②)')
  assert.equal(p3.deleted.length, 1, '실패해도 wav 는 지운다')
})

test('온디바이스: 권한 — 첫 누름은 대화상자만(PERMISSION_ONLY, 녹음 안 함), 거절은 MIC_DENIED(세지 않음)', async () => {
  const p = new FakeOnDevice()
  p.perm = 'prompt'
  const t = client(p)
  await assert.rejects(t.c.begin({ purpose: 'TURN' }), (e: unknown) => e instanceof SttError && e.pluginCode === PERMISSION_ONLY)
  assert.ok(!p.calls.includes('start'), '허용돼도 이번 누름은 녹음하지 않는다')
  assert.equal(t.failures.length, 0)

  const p2 = new FakeOnDevice()
  p2.perm = 'prompt-with-rationale'
  p2.askResult = 'denied'
  const t2 = client(p2)
  await assert.rejects(t2.c.begin({ purpose: 'TURN' }), (e: unknown) => e instanceof SttError && e.code === 'MIC_DENIED')
  assert.deepEqual(t2.failures, [{ code: 'PERMISSION_DENIED', phase: 'start', countable: false }])
})

test('온디바이스: 세션 중 오류는 ENGINE_ERROR(셈), INTERRUPTED 는 interrupted(세지 않음), 취소 뒤 늦은 final 은 버리고 wav 는 지운다', async () => {
  const p = new FakeOnDevice()
  const t = client(p)
  await t.c.begin({ purpose: 'TURN' })
  p.emit('error', { sessionId: p.current, code: 'DECODE_FAILED', message: 'x' })
  assert.deepEqual(t.events.at(-1), { type: 'error', code: 'ENGINE_ERROR' })
  assert.deepEqual(t.failures.at(-1), { code: 'DECODE_FAILED', phase: 'session', countable: true })

  await t.c.begin({ purpose: 'TURN' })
  p.emit('error', { sessionId: p.current, code: 'INTERRUPTED' })
  assert.deepEqual(t.events.at(-1), { type: 'interrupted' })
  assert.equal(t.failures.length, 1, 'INTERRUPTED 는 세지 않는다')

  await t.c.begin({ purpose: 'TURN' })
  const sid = p.current!
  t.c.cancel()
  assert.ok(p.calls.includes('cancel'))
  p.emit('final', p.finalPayload(sid))
  await tick()
  assert.notEqual(t.events.at(-1)?.type, 'final', '취소한 발화의 final 은 화면에 가지 않는다')
  assert.ok(p.deleted.length >= 1)
})

test('온디바이스: dispose 는 리스너를 모두 뗀다', async () => {
  const p = new FakeOnDevice()
  const t = client(p)
  await t.c.begin({ purpose: 'MIC_TEST' })
  assert.equal(p.listenerCount('final'), 1)
  t.c.dispose()
  await tick()
  assert.equal(p.listenerCount('final'), 0)
  assert.equal(p.listenerCount('level'), 0)
})

// ── 경로 판정 ────────────────────────────────────────────────────────────

test('decideRoute: 웹·플러그인 없음 → WEB, 강제 업데이트 → UPDATE_REQUIRED, 방식·전환·파일 상태별 이유', () => {
  const base = { hasPlugin: true, config: CFG, installed: true, downloading: false, updateRequired: false, failedOver: false }
  assert.deepEqual(decideRoute({ ...base, hasPlugin: false }), { kind: 'GATEWAY', reason: 'WEB' })
  assert.deepEqual(decideRoute({ ...base, config: { gateway: { enabled: true }, onDevice: { enabled: false } } }), { kind: 'GATEWAY', reason: 'SERVER_DISABLED' })
  assert.deepEqual(decideRoute({ ...base, config: { gateway: { enabled: true } } }), { kind: 'GATEWAY', reason: 'WEB' }, '앱이라도 onDevice 블록이 없으면(웹 응답) 서버')
  assert.deepEqual(decideRoute(base), { kind: 'ONDEVICE', reason: 'READY' })
  assert.deepEqual(decideRoute({ ...base, updateRequired: true }), { kind: 'GATEWAY', reason: 'UPDATE_REQUIRED' })
  assert.deepEqual(decideRoute({ ...base, config: { ...CFG, recognitionMode: 'ACCURATE', onDevice: { ...CFG.onDevice!, enabled: false } } }), { kind: 'GATEWAY', reason: 'MODE_ACCURATE' })
  assert.deepEqual(decideRoute({ ...base, config: { ...CFG, recognitionMode: 'OFFLINE' }, installed: false }), { kind: 'ONDEVICE', reason: 'MODE_OFFLINE' })
  assert.deepEqual(decideRoute({ ...base, failedOver: true }), { kind: 'GATEWAY', reason: 'ONDEVICE_FAILED' })
  assert.deepEqual(decideRoute({ ...base, config: { ...CFG, recognitionMode: 'OFFLINE' }, failedOver: true }), { kind: 'ONDEVICE', reason: 'MODE_OFFLINE' }, '오프라인 방식은 바꾸지 않는다')
  assert.deepEqual(decideRoute({ ...base, installed: false }), { kind: 'GATEWAY', reason: 'MODEL_ABSENT' })
  assert.deepEqual(decideRoute({ ...base, installed: false, downloading: true }), { kind: 'GATEWAY', reason: 'MODEL_DOWNLOADING' })
})

// ── 라우터 ────────────────────────────────────────────────────────────────

async function router(p: FakeOnDevice, cfg: SttClientConfig = CFG, opts: { updateRequired?: () => boolean } = {}) {
  resetOnDeviceRunStateForTest()
  const store = new OnDeviceModelStore({ getPlugin: () => p, origin: () => 'https://kaiwa.test' })
  const gw = new FakeGateway()
  const r = new SttRouter({
    fetchTicket: async () => {
      throw new Error('no ticket in test')
    },
    modelStore: store,
    gatewayClient: gw,
    onDevice: { upload: async () => 'cutt00000000000000000000009', readWav: async () => new Blob([new Uint8Array(44)]), isUpdateRequired: opts.updateRequired },
  })
  const events: SttEvent[] = []
  r.subscribe((e) => events.push(e))
  r.configure(cfg)
  await store.refresh()
  await tick()
  return { r, gw, store, events }
}

test('라우터: 모델 설치 → 누름마다 휴대폰, 모델 없음(웹과 같게) → 서버, 받기 끝나면 다음 누름부터 휴대폰', async () => {
  const p = new FakeOnDevice()
  p.model = { installed: false, downloading: false }
  const { r, gw, store, events } = await router(p)
  assert.deepEqual(r.route(), { kind: 'GATEWAY', reason: 'MODEL_ABSENT' })
  await r.begin({ purpose: 'MIC_TEST' })
  assert.equal(gw.begins.length, 1)
  assert.ok(!p.calls.includes('start'))
  r.cancel()

  p.model = { installed: true, version: 'v1', bytes: 1, downloading: false }
  await store.refresh()
  assert.deepEqual(r.route(), { kind: 'ONDEVICE', reason: 'READY' })
  assert.ok(events.some((e) => e.type === 'route' && e.route.reason === 'READY'), '경로가 바뀌면 누르기 전에도 알린다')
  await r.begin({ purpose: 'MIC_TEST' })
  assert.ok(p.calls.includes('start'))
  assert.equal(gw.begins.length, 1)
})

test('라우터: start 거부(셈)는 이번 누름을 서버로 이어 가고, 2회째에 전환(switched, 앱 실행 동안 유지)', async () => {
  const p = new FakeOnDevice()
  p.startError = 'AUDIO_INIT_FAILED'
  const { r, gw, events } = await router(p)
  await r.begin({ purpose: 'TURN', chatId: 'c1' })
  assert.equal(gw.begins.length, 1, '말을 잃지 않게 같은 누름을 서버로')
  assert.deepEqual(r.route(), { kind: 'ONDEVICE', reason: 'READY' }, '1회는 아직 전환 아님')
  r.cancel()
  await r.begin({ purpose: 'TURN', chatId: 'c1' })
  assert.equal(gw.begins.length, 2)
  assert.deepEqual(r.route(), { kind: 'GATEWAY', reason: 'ONDEVICE_FAILED' })
  const sw = events.filter((e) => e.type === 'route' && e.switched)
  assert.equal(sw.length, 1, '전환 안내는 1회')
  p.startError = null
  r.cancel()
  await r.begin({ purpose: 'TURN' })
  assert.equal(gw.begins.length, 3, '전환 뒤에는 앱을 다시 켤 때까지 서버')
})

test('라우터: 세지 않는 start 거부(MODEL_MISSING·ALREADY_STARTED)는 서버로 잇되 전환하지 않는다 · MODEL_MISSING 은 스토어 재확인', async () => {
  const p = new FakeOnDevice()
  const { r, gw } = await router(p)
  p.startError = 'MODEL_MISSING'
  p.model = { installed: false, downloading: false }
  await r.begin({ purpose: 'TURN' })
  assert.equal(gw.begins.length, 1)
  await tick()
  assert.ok(p.calls.filter((c) => c === 'checkModel').length >= 2, '모델 없음 → 스토어가 다시 확인')
  assert.deepEqual(r.route(), { kind: 'GATEWAY', reason: 'MODEL_ABSENT' }, '다음 누름부터 서버(전환 카운트 아님)')
  p.model = { installed: true, version: 'v1', downloading: false }
  p.startError = 'ALREADY_STARTED'
  const { r: r2, gw: gw2 } = await router(p)
  await r2.begin({ purpose: 'TURN' })
  await r2.begin({ purpose: 'TURN' })
  assert.equal(gw2.begins.length, 2)
  assert.deepEqual(r2.route(), { kind: 'ONDEVICE', reason: 'READY' }, 'ALREADY_STARTED 는 세지 않는다')
})

test('라우터: 세션 중 오류 2회 → 두 번째 오류에 switched, 다음 누름부터 서버. 권한 거절은 서버로 잇지 않는다', async () => {
  const p = new FakeOnDevice()
  const { r, gw, events } = await router(p)
  await r.begin({ purpose: 'TURN' })
  p.emit('error', { sessionId: p.current, code: 'DECODE_FAILED' })
  assert.deepEqual(events.at(-1), { type: 'error', code: 'ENGINE_ERROR' })
  await r.begin({ purpose: 'TURN' })
  p.emit('error', { sessionId: p.current, code: 'OOM' })
  const errs = events.filter((e) => e.type === 'error')
  assert.deepEqual(errs.at(-1), { type: 'error', code: 'ENGINE_ERROR', switched: true })
  assert.ok(!events.some((e) => e.type === 'route' && e.switched), '말을 잃은 전환은 띠 2줄이 말한다(토스트 없음)')
  await r.begin({ purpose: 'TURN' })
  assert.equal(gw.begins.length, 1)

  const p2 = new FakeOnDevice()
  p2.perm = 'denied'
  p2.askResult = 'denied'
  const t2 = await router(p2)
  await assert.rejects(t2.r.begin({ purpose: 'TURN' }), (e: unknown) => e instanceof SttError && e.code === 'MIC_DENIED')
  assert.equal(t2.gw.begins.length, 0)
})

test('라우터: 오프라인 방식 — 파일 없으면 MODEL_REQUIRED, 오류는 offlineMode 로 전환하지 않음', async () => {
  const off: SttClientConfig = { ...CFG, recognitionMode: 'OFFLINE', gateway: { enabled: false }, fallback: { onDeviceFailureThreshold: 2, toGateway: false } }
  const p = new FakeOnDevice()
  p.model = { installed: false, downloading: false }
  const { r, gw } = await router(p, off)
  await assert.rejects(r.begin({ purpose: 'TURN' }), (e: unknown) => e instanceof SttError && e.code === 'MODEL_REQUIRED')
  assert.equal(gw.begins.length, 0)

  const p2 = new FakeOnDevice()
  const t = await router(p2, off)
  for (let i = 0; i < 3; i++) {
    await t.r.begin({ purpose: 'TURN' })
    p2.emit('error', { sessionId: p2.current, code: 'DECODE_FAILED' })
  }
  assert.deepEqual(t.events.filter((e) => e.type === 'error').at(-1), { type: 'error', code: 'ENGINE_ERROR', offlineMode: true })
  assert.deepEqual(t.r.route(), { kind: 'ONDEVICE', reason: 'MODE_OFFLINE' })
  p2.startError = 'AUDIO_INIT_FAILED'
  await assert.rejects(t.r.begin({ purpose: 'TURN' }), (e: unknown) => e instanceof SttError && e.code === 'MIC_BUSY')
  assert.equal(t.gw.begins.length, 0, '오프라인 방식은 서버로 잇지 않는다')
})

test('라우터: 강제 업데이트 상태면 휴대폰 경로를 쓰지 않는다(UPDATE_REQUIRED)', async () => {
  let forced = true
  const p = new FakeOnDevice()
  const { r, gw } = await router(p, CFG, { updateRequired: () => forced })
  assert.deepEqual(r.route(), { kind: 'GATEWAY', reason: 'UPDATE_REQUIRED' })
  await r.begin({ purpose: 'TURN' })
  assert.equal(gw.begins.length, 1)
  forced = false
  assert.deepEqual(r.route(), { kind: 'ONDEVICE', reason: 'READY' })
})

// ── 모델 스토어 ──────────────────────────────────────────────────────────

test('모델 스토어: 확인만(자동 받기 없음) · 판정(설치·멈춤·받는 중·배포본 없음 off·플러그인 없음 unsupported)', async () => {
  assert.equal(new OnDeviceModelStore({ getPlugin: () => null }).snapshot().phase, 'unsupported')
  const p = new FakeOnDevice()
  p.model = { installed: false, downloading: false }
  const s = new OnDeviceModelStore({ getPlugin: () => p, origin: () => 'https://kaiwa.test' })
  assert.equal(s.snapshot().phase, 'checking')
  s.setConfig(CFG.onDevice)
  await s.refresh()
  assert.equal(s.snapshot().phase, 'absent')
  assert.equal(s.snapshot().requiredBytes, Math.ceil(169_824_553 * 2.5))
  assert.ok(!p.calls.some((c) => c.startsWith('downloadModel')), '확인만 한다')

  p.model = { installed: false, downloading: false, pendingVersion: 'v1', pendingBytes: 50_000_000 }
  await s.refresh()
  assert.equal(s.snapshot().phase, 'paused')
  assert.equal(s.snapshot().receivedBytes, 50_000_000)

  p.model = { installed: true, version: 'v0', bytes: 1, downloading: false }
  await s.refresh()
  assert.equal(s.snapshot().phase, 'installed')
  assert.equal(s.snapshot().updateAvailable, true, '설치 버전 ≠ #19 version → 새 버전')
  assert.doesNotMatch(JSON.stringify(s.snapshot()), /"v0"|"v1"/, '버전 문자열은 스냅샷에 싣지 않는다')

  const s2 = new OnDeviceModelStore({ getPlugin: () => p })
  s2.setConfig({ enabled: true, model: { id: 'ondevice-ja-v1', version: null, manifestUrl: '/models/ondevice-ja-v1/manifest.json', totalBytes: null } })
  p.model = { installed: false, downloading: false }
  await s2.refresh()
  assert.equal(s2.snapshot().phase, 'off', '서버 배포본이 없으면 쓸 수 없음')
})

test('모델 스토어: 받기 — 같은 origin 절대 manifest URL·Wi-Fi 기본, 진행·완료, 모바일 데이터 동의·멈춤·오류 코드', async () => {
  const p = new FakeOnDevice()
  p.model = { installed: false, downloading: false }
  const s = new OnDeviceModelStore({ getPlugin: () => p, origin: () => 'https://kaiwa.test' })
  s.setConfig(CFG.onDevice)
  await s.refresh()

  let seenUrl = ''
  p.download = async (o) => {
    seenUrl = o.manifestUrl
    p.emit('downloadProgress', { version: 'v1', fileIndex: 0, fileCount: 5, received: 10, total: 100, totalReceived: 84_000_000, totalBytes: 169_824_553 })
    assert.equal(s.snapshot().phase, 'downloading')
    assert.equal(s.snapshot().receivedBytes, 84_000_000)
    p.model = { installed: true, version: 'v1', bytes: 169_824_553, downloading: false }
    return { version: 'v1', bytes: 169_824_553, alreadyInstalled: false }
  }
  await s.download()
  assert.equal(seenUrl, 'https://kaiwa.test/models/ondevice-ja-v1/manifest.json')
  assert.ok(p.calls.includes('downloadModel:wifi'), 'Wi-Fi 전용이 기본')
  assert.equal(s.snapshot().phase, 'installed')
  assert.equal(s.snapshot().justInstalled, true)

  const p2 = new FakeOnDevice()
  p2.model = { installed: false, downloading: false }
  const s2 = new OnDeviceModelStore({ getPlugin: () => p2, origin: () => 'https://kaiwa.test' })
  s2.setConfig(CFG.onDevice)
  await s2.refresh()
  p2.download = async () => {
    throw pluginError('NETWORK_NOT_ALLOWED')
  }
  await s2.download()
  assert.equal(s2.snapshot().phase, 'needsConsent')
  assert.equal(s2.snapshot().error, null, '모바일 데이터는 오류가 아니다')
  p2.download = async () => {
    throw pluginError('DOWNLOAD_CANCELLED')
  }
  await s2.download({ allowCellular: true })
  assert.ok(p2.calls.includes('downloadModel:any'), '[데이터로 받기] = wifiOnly false')
  assert.equal(s2.snapshot().cellularConsent, true)
  assert.equal(s2.snapshot().phase, 'paused', '일시정지 = 오류 아님')
  p2.download = async () => {
    throw pluginError('INSUFFICIENT_STORAGE')
  }
  await s2.download()
  assert.equal(s2.snapshot().error, 'INSUFFICIENT_STORAGE')
  assert.equal(s2.snapshot().phase, 'error')
  s2.dismissError()
  await s2.remove()
  assert.ok(p2.calls.includes('deleteModel'))
  assert.equal(s2.snapshot().phase, 'absent')
})

test('모델 스토어: 오류 코드 → 카드 오류, 남은 시간 추정', () => {
  assert.equal(downloadErrorCode('MANIFEST_INVALID'), 'SERVER')
  assert.equal(downloadErrorCode('ORIGIN_NOT_ALLOWED'), 'SERVER')
  assert.equal(downloadErrorCode('DOWNGRADE_REFUSED'), 'SERVER')
  assert.equal(downloadErrorCode('APP_UPDATE_REQUIRED'), 'APP_UPDATE_REQUIRED')
  assert.equal(downloadErrorCode('DOWNLOAD_FAILED'), 'DOWNLOAD_FAILED')
  assert.equal(downloadErrorCode('WHATEVER'), 'UNKNOWN')
  assert.equal(downloadErrorCode('NETWORK_NOT_ALLOWED'), null)
  assert.equal(downloadErrorCode('DOWNLOAD_CANCELLED'), null)
  const t0 = 1_000_000
  const samples = [
    { at: t0 + 2000, bytes: 10_000_000 },
    { at: t0 + 4000, bytes: 30_000_000 },
  ]
  assert.equal(estimateEtaSec(samples, 130_000_000, t0, t0 + 2500), null, '시작 3초 전은 모름')
  assert.equal(estimateEtaSec(samples, 130_000_000, t0, t0 + 4000), 10, '10MB/s 로 100MB 남음')
  assert.equal(estimateEtaSec(samples, 130_000_000, t0, t0 + 20_000), null, '최근 5초 표본이 없으면 모름')
})
