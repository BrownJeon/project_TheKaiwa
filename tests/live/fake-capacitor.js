/**
 * PC 에서 앱 모드를 보기 위한 가짜 `window.Capacitor`(screens §11-7 ⑨) — Playwright `context.addInitScript({ path })` 로만 넣는다.
 * `src/` 밖이라 번들에 들어가지 않는다(앱 코드에 개발용 스위치 없음). 메서드·이벤트·오류 코드 이름은 task-003f "플러그인 JS 계약 v1(+v1.1)" 그대로.
 *
 * 조종: `window.__fakeCap.set({ appBuild, appVersion, perm: 'prompt'|'rationale'|'denied'|'granted', askResult, model: 'absent'|'partial'|'installed'|'outdated',
 *        network: 'wifi'|'metered', manualProgress, diag, modelVersion })` · `__fakeCap.emit('resume'|'browserFinished'|'appUrlOpen', data)` ·
 *        `__fakeCap.failNext(code)` · `__fakeCap.progress(ratio)` · `__fakeCap.calls`(호출 기록 — 인자 중 URL 은 앞부분만 남긴다).
 */
;(function () {
  const TOTAL = 169824553
  const state = {
    appBuild: 1,
    appVersion: '1.0.0',
    perm: 'granted',
    askResult: 'granted',
    model: 'absent',
    network: 'wifi',
    manualProgress: false,
    modelVersion: '2024-08-01-int8-v1',
    diag: { pluginVersion: '0.1.0', abi: 'arm64-v8a', recognizerLoaded: false, numThreads: 2, lastLoadMs: 1180, rssMb: 412, javaHeapMb: 38 },
    failNext: null,
    received: 0,
    downloading: null,
    session: null,
    sessionN: 0,
  }
  // 시나리오별 첫 상태 — 이 파일보다 먼저 넣은 init 스크립트가 `window.__FAKE_CAP_INIT` 을 둔다(페이지를 새로 열 때마다 적용).
  try {
    const init = window.__FAKE_CAP_INIT || {}
    Object.assign(state, init)
    if (init.diag) state.diag = { pluginVersion: '0.1.0', abi: 'arm64-v8a', recognizerLoaded: false, numThreads: 2, lastLoadMs: 1180, rssMb: 412, javaHeapMb: 38, ...init.diag }
  } catch {}
  const calls = []
  const listeners = {}
  const record = (name, arg) => calls.push({ name, arg: arg === undefined ? null : JSON.parse(JSON.stringify(arg)) })
  const on = (plugin, event, fn) => {
    const key = plugin + ':' + event
    ;(listeners[key] = listeners[key] || new Set()).add(fn)
    return Promise.resolve({ remove: () => Promise.resolve(void listeners[key].delete(fn)) })
  }
  const emit = (plugin, event, data) => {
    for (const fn of Array.from(listeners[plugin + ':' + event] || [])) fn(data)
  }
  const err = (code) => Object.assign(new Error('fake ' + code), { code })
  const takeFail = () => {
    const c = state.failNext
    state.failNext = null
    return c
  }

  function modelStatus() {
    const base = { freeBytes: 8e9 }
    if (state.downloading) return { ...base, installed: state.model === 'installed' || state.model === 'outdated', version: state.model === 'outdated' ? 'old-v0' : state.modelVersion, downloading: true, pendingVersion: state.modelVersion, pendingBytes: state.received }
    if (state.model === 'installed') return { ...base, installed: true, version: state.modelVersion, bytes: TOTAL, downloading: false }
    if (state.model === 'outdated') return { ...base, installed: true, version: 'old-v0', bytes: TOTAL - 1000, downloading: false }
    if (state.model === 'partial') return { ...base, installed: false, downloading: false, pendingVersion: state.modelVersion, pendingBytes: state.received || 80000000 }
    return { ...base, installed: false, downloading: false }
  }

  function progressTo(ratio) {
    if (!state.downloading) return
    state.received = Math.min(TOTAL, Math.round(TOTAL * ratio))
    emit('SherpaStt', 'downloadProgress', { version: state.modelVersion, fileIndex: 0, fileCount: 5, received: state.received, total: TOTAL, totalReceived: state.received, totalBytes: TOTAL })
    if (state.received >= TOTAL) {
      const d = state.downloading
      state.downloading = null
      clearInterval(d.timer)
      state.model = 'installed'
      setTimeout(() => d.resolve({ version: state.modelVersion, bytes: TOTAL, alreadyInstalled: false }), 150)
    }
  }

  const SherpaStt = {
    checkPermissions() {
      record('checkPermissions')
      return Promise.resolve({ recordAudio: state.perm === 'rationale' ? 'prompt-with-rationale' : state.perm })
    },
    requestPermissions() {
      record('requestPermissions')
      if (state.perm !== 'denied') state.perm = state.askResult
      return Promise.resolve({ recordAudio: state.perm === 'rationale' ? 'prompt-with-rationale' : state.perm })
    },
    checkModel(o) {
      record('checkModel', o)
      return Promise.resolve(modelStatus())
    },
    downloadModel(o) {
      record('downloadModel', { manifestUrl: String(o && o.manifestUrl).slice(0, 80), wifiOnly: o && o.wifiOnly, expectedVersion: o && o.expectedVersion })
      const f = takeFail()
      if (f) return Promise.reject(err(f))
      if (state.downloading) return Promise.reject(err('DOWNLOAD_IN_PROGRESS'))
      if (o && o.wifiOnly !== false && state.network === 'metered') return Promise.reject(err('NETWORK_NOT_ALLOWED'))
      return new Promise((resolve, reject) => {
        state.downloading = { resolve, reject, timer: null }
        if (!state.manualProgress) {
          state.downloading.timer = setInterval(() => progressTo((state.received + TOTAL / 8) / TOTAL), 120)
        } else progressTo(state.received / TOTAL)
      })
    },
    cancelDownload() {
      record('cancelDownload')
      const d = state.downloading
      if (d) {
        clearInterval(d.timer)
        state.downloading = null
        if (state.model === 'absent') state.model = 'partial'
        d.reject(err('DOWNLOAD_CANCELLED'))
      }
      return Promise.resolve()
    },
    deleteModel() {
      record('deleteModel')
      if (state.session || state.downloading) return Promise.reject(err('BUSY'))
      state.model = 'absent'
      state.received = 0
      return Promise.resolve()
    },
    preload(o) {
      record('preload', o)
      state.diag.recognizerLoaded = true
      state.diag.lastLoadMs = 950
      return Promise.resolve({ modelVersion: state.modelVersion, loadMs: 950 })
    },
    start(o) {
      record('start', o)
      const f = takeFail()
      if (f) return Promise.reject(err(f))
      if (state.perm !== 'granted') return Promise.reject(err('PERMISSION_DENIED'))
      if (!(state.model === 'installed' || state.model === 'outdated')) return Promise.reject(err('MODEL_MISSING'))
      const id = 'fs' + ++state.sessionN
      const t0 = Date.now()
      const timer = setInterval(() => emit('SherpaStt', 'level', { sessionId: id, db: -24 - Math.random() * 6 }), 100)
      const part = setTimeout(() => emit('SherpaStt', 'partial', { sessionId: id, segIdx: 0, text: 'こんにち', startMs: 0, endMs: 600 }), 500)
      state.session = { id, t0, timer, part }
      state.diag.recognizerLoaded = true
      return Promise.resolve({ sessionId: id, modelVersion: state.modelVersion })
    },
    stop() {
      record('stop')
      const s = state.session
      if (!s) return Promise.resolve({})
      clearInterval(s.timer)
      clearTimeout(s.part)
      state.session = null
      const f = {
        sessionId: s.id,
        text: 'こんにちは',
        durationMs: Date.now() - s.t0,
        wavPath: '/data/user/0/com.miraclepenguin.kaiwa/files/utterances/' + s.id + '.wav',
        segments: [{ segIdx: 0, text: 'こんにちは', startMs: 0, endMs: Date.now() - s.t0 }],
        timings: { vadMs: 12, decodeMs: 310, loadMs: 0, sttMs: 330 },
        reason: 'stop',
        modelVersion: state.modelVersion,
      }
      return new Promise((resolve) =>
        setTimeout(() => {
          emit('SherpaStt', 'final', f)
          resolve({ sessionId: s.id, utterance: f })
        }, 250),
      )
    },
    cancel() {
      record('cancel')
      const s = state.session
      if (s) {
        clearInterval(s.timer)
        clearTimeout(s.part)
        state.session = null
      }
      return Promise.resolve()
    },
    release() {
      record('release')
      state.diag.recognizerLoaded = false
      return Promise.resolve()
    },
    deleteWav(o) {
      record('deleteWav', { wavPath: o && o.wavPath ? '(path)' : null })
      return Promise.resolve()
    },
    getDiagnostics() {
      record('getDiagnostics')
      return Promise.resolve({ ...state.diag, modelVersion: state.model === 'absent' ? undefined : state.modelVersion })
    },
    openAppSettings() {
      record('openAppSettings')
      return Promise.resolve()
    },
    addListener(event, fn) {
      return on('SherpaStt', event, fn)
    },
  }

  const App = {
    getInfo() {
      record('App.getInfo')
      return Promise.resolve({ name: 'Lingofy Japanese', id: 'com.miraclepenguin.kaiwa', version: state.appVersion, build: String(state.appBuild) })
    },
    getLaunchUrl() {
      return Promise.resolve(null)
    },
    addListener(event, fn) {
      return on('App', event, fn)
    },
  }

  const Browser = {
    open(o) {
      const u = String((o && o.url) || '')
      let summary = u.slice(0, 60)
      try {
        const p = new URL(u)
        summary = { path: p.pathname, platform: p.searchParams.get('platform'), hasChallenge: /^[A-Za-z0-9_-]{43}$/.test(p.searchParams.get('challenge') || ''), download: p.pathname.startsWith('/app/download/') }
      } catch {}
      record('Browser.open', summary)
      return Promise.resolve()
    },
    close() {
      record('Browser.close')
      return Promise.resolve()
    },
    addListener(event, fn) {
      return on('Browser', event, fn)
    },
  }

  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    convertFileSrc: (p) => location.origin + '/_capacitor_file_' + p,
    Plugins: { SherpaStt, App, Browser },
  }

  window.__fakeCap = {
    calls,
    set(patch) {
      Object.assign(state, patch)
      if (patch && patch.diag) state.diag = { ...state.diag, ...patch.diag }
    },
    get() {
      return { model: state.model, perm: state.perm, downloading: !!state.downloading, received: state.received }
    },
    failNext(code) {
      state.failNext = code
    },
    progress(ratio) {
      progressTo(ratio)
    },
    emit(event, data) {
      if (event === 'resume') emit('App', 'resume', {})
      else if (event === 'appUrlOpen') emit('App', 'appUrlOpen', { url: data })
      else if (event === 'browserFinished') emit('Browser', 'browserFinished', {})
      else emit('SherpaStt', event, data)
    },
  }
})()
