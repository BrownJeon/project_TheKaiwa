'use client'

/**
 * 푸시투토크 실시간 인식 훅(docs/screens.md §8-3 B) — 마이크 테스트와 task-007 회화방이 같이 쓴다.
 * 상태기계는 sttUiState(순수), 실제 마이크·연결은 `@/modules/speech/stt/client`. 이 훅은 둘을 잇고 타이머·온라인·화면 숨김만 본다.
 *
 * `press()` 는 누름 핸들러에서 **동기로** 불러야 한다 — 그 안에서 client.begin() 이 AudioContext 를 깨운다.
 * 결과 텍스트는 React state 에만 있다(저장·로그 없음). 엔진·추적 값은 클라이언트가 이미 버렸다.
 *
 * `onFinal`(task-007 회화방): 손을 뗀 뒤(`finishing`) 받은 final 을 발화 id·길이·시각과 함께 올린다 — 회화방은 곧바로 턴을 보낸다.
 * 시각은 `performance.now()` 기준(`releasedAt` = 손 뗌 또는 30초 자동 멈춤). 마이크 테스트는 넘기지 않으니 그대로다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiPost, ApiError } from '@/components/common/api'
import { isAppUpdateRequired, useAppUpdate } from '@/components/shell/useAppUpdate'
import { isNativeApp, readNativeFile } from '@/modules/infra/native'
import {
  createRealtimeSttClient,
  onDeviceModelStore,
  PERMISSION_ONLY,
  SttError,
  type RoutedSttClient,
  type SttClientConfig,
  type SttKind,
  type SttPurpose,
  type SttRoute,
  type SttTicket,
} from '@/modules/speech/stt/client'
import { stopAllTts } from './ttsAudio'
import { micPreflight, watchMicPermission } from './micPreflight'
import { uploadOnDeviceUtterance } from './onDeviceUpload'
import { initialSttUi, isBlockingError, sttUiReducer, type PermState, type SttUiEffect, type SttUiEvent, type SttUiState } from './sttUiState'

const TICK_MS = 250

async function fetchTicket(body: { purpose: SttPurpose; chatId?: string }): Promise<SttTicket> {
  try {
    return await apiPost<SttTicket>('/api/v1/speech/ticket', body)
  } catch (e) {
    if (e instanceof ApiError) {
      const fromDetails = e.details?.retryAfterSec
      throw { status: e.status, code: e.code, retryAfterSec: typeof fromDetails === 'number' ? fromDetails : e.retryAfterSec }
    }
    throw { status: 0 }
  }
}

export interface SttFinal {
  text: string
  /** gateway 가 저장한 발화 id(TURN). 콜백 실패면 null — 회화방은 글자 턴으로 보낸다(§9-11 ②). */
  utteranceId: string | null
  durationMs: number
  releasedAt: number
  finalAt: number
}

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export interface UseRealtimeStt {
  ui: SttUiState
  kind: SttKind
  /** 다음 누름의 경로와 이유(screens §11-3 C) — 마이크 테스트 경로 한 줄·회화방 메뉴 줄. */
  route: SttRoute
  /** 말을 잃지 않은 휴대폰 → 서버 전환이 일어날 때마다 1씩 는다(회화방 토스트 1회). */
  switchNotice: number
  press: () => void
  release: () => void
  abort: () => void
}

const WEB_ROUTE: SttRoute = { kind: 'GATEWAY', reason: 'WEB' }

export function useRealtimeStt(o: {
  purpose: SttPurpose
  chatId?: string
  config: SttClientConfig | null
  maxSec?: number
  onFinal?: (f: SttFinal) => void
}): UseRealtimeStt {
  const { purpose, chatId, config, maxSec, onFinal } = o
  const onFinalRef = useRef(onFinal)
  useLayoutEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])
  /** 이번 발화가 finishing 으로 넘어간 시각(performance.now) */
  const releasedAtRef = useRef<number | null>(null)
  const [initial] = useState(() => initialSttUi(0, maxSec))
  const stateRef = useRef<SttUiState>(initial)
  const [ui, setUi] = useState<SttUiState>(initial)
  const clientRef = useRef<RoutedSttClient | null>(null)
  const [route, setRoute] = useState<SttRoute>(WEB_ROUTE)
  const [switchNotice, setSwitchNotice] = useState(0)
  const [modelTick, setModelTick] = useState(0)
  const updateState = useAppUpdate().state
  const permRef = useRef<PermState>('unknown')
  const beginSeq = useRef(0)
  const optsRef = useRef({ purpose, chatId })
  useLayoutEffect(() => {
    optsRef.current = { purpose, chatId }
  }, [purpose, chatId])

  const applyRef = useRef<(ev: SttUiEvent) => void>(() => undefined)

  const client = useCallback((): RoutedSttClient => {
    if (!clientRef.current) {
      const c = createRealtimeSttClient(null, {
        fetchTicket,
        clientPlatform: isNativeApp() ? 'android' : 'web',
        onDevice: { upload: uploadOnDeviceUtterance, readWav: readNativeFile, isUpdateRequired: isAppUpdateRequired },
      })
      c.subscribe((e) => {
        const now = Date.now()
        const apply = applyRef.current
        switch (e.type) {
          case 'route':
            setRoute(e.route)
            if (e.switched) setSwitchNotice((n) => n + 1)
            return
          case 'interrupted':
            return apply({ type: 'INTERRUPTED', now })
          case 'level':
            return apply({ type: 'LEVEL', now, db: e.db })
          case 'connecting':
            return apply({ type: 'CONNECTING', slow: e.slow })
          case 'partial':
            return apply({ type: 'PARTIAL', segIdx: e.segIdx, text: e.text })
          case 'final': {
            const wasFinishing = stateRef.current.phase === 'finishing'
            apply({ type: 'FINAL', now, text: e.text })
            if (wasFinishing && onFinalRef.current) {
              const finalAt = perfNow()
              onFinalRef.current({ text: e.text, utteranceId: e.utteranceId, durationMs: e.durationMs, releasedAt: releasedAtRef.current ?? finalAt, finalAt })
            }
            return
          }
          case 'error':
            return apply({ type: 'ERROR', now, code: e.code, retryAfterSec: e.retryAfterSec, switched: e.switched, offlineMode: e.offlineMode })
          default:
            return
        }
      })
      clientRef.current = c
    }
    return clientRef.current
  }, [])

  const run = useCallback(
    (eff: SttUiEffect) => {
      switch (eff) {
        case 'STOP_TTS':
          stopAllTts()
          return
        case 'BEGIN': {
          const seq = ++beginSeq.current
          const { purpose: p, chatId: c } = optsRef.current
          client()
            .begin({ purpose: p, ...(c ? { chatId: c } : {}) })
            .then(
              () => seq === beginSeq.current && applyRef.current({ type: 'BEGIN_OK', now: Date.now() }),
              (err: unknown) => {
                if (seq !== beginSeq.current) return
                // 앱 첫 누름 = 권한 대화상자만(허용됨) — 오류가 아니라 힌트(§11-3 D).
                if (err instanceof SttError && err.pluginCode === PERMISSION_ONLY) return applyRef.current({ type: 'PERMISSION_ONLY', now: Date.now() })
                const code = err instanceof SttError ? err.code : 'UNSUPPORTED'
                applyRef.current({ type: 'BEGIN_FAIL', now: Date.now(), code, retryAfterSec: err instanceof SttError ? err.retryAfterSec : undefined })
              },
            )
          return
        }
        case 'END':
          clientRef.current?.end()
          return
        case 'CANCEL':
          clientRef.current?.cancel()
          return
      }
    },
    [client],
  )

  const apply = useCallback(
    (ev: SttUiEvent) => {
      const r = sttUiReducer(stateRef.current, ev)
      if (r.state.phase === 'finishing' && stateRef.current.phase !== 'finishing') releasedAtRef.current = perfNow()
      if (r.state !== stateRef.current) {
        stateRef.current = r.state
        setUi(r.state)
      }
      for (const eff of r.effects) run(eff)
    },
    [run],
  )
  useLayoutEffect(() => {
    applyRef.current = apply
  }, [apply])

  // 클라이언트 준비 + 정리(언마운트·StrictMode 재마운트)
  useEffect(() => {
    const seq = beginSeq
    const holder = clientRef
    setRoute(client().route())
    return () => {
      seq.current++
      holder.current?.dispose()
      holder.current = null
    }
  }, [client])

  // #19 설정 → 라우터(경로는 누를 때마다 다시 고른다). 휴대폰 인식 파일 상태가 바뀌면 사전 점검을 다시(오프라인 방식 + 파일 없음).
  useEffect(() => {
    client().configure(config)
  }, [client, config])
  useEffect(() => onDeviceModelStore().subscribe(() => setModelTick((n) => n + 1)), [])
  // 강제 업데이트 상태가 바뀌면 경로를 다시 알린다(UPDATE_REQUIRED).
  useEffect(() => {
    client().refresh()
  }, [client, updateState])

  // 사전 점검(권한은 묻지 않는다) — 설정·경로·파일 상태가 바뀌면 다시.
  useEffect(() => {
    const err = micPreflight(route, config, { modelInstalled: onDeviceModelStore().snapshot().installed })
    apply({ type: 'PREFLIGHT', error: err, blocking: err ? isBlockingError(err) : false })
  }, [config, route, modelTick, apply])

  useEffect(
    () =>
      watchMicPermission((s) => {
        permRef.current = s
        apply({ type: 'PERMISSION', state: s })
      }),
    [apply],
  )

  // 진행 중에만 타이머(경과초·30초 상한·8초 무응답·소리 작음)
  const active = ui.phase === 'starting' || ui.phase === 'recording' || ui.phase === 'finishing'
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => apply({ type: 'TICK', now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [active, apply])

  useEffect(() => {
    const off = () => {
      apply({ type: 'OFFLINE', now: Date.now() })
      clientRef.current?.dispose()
    }
    const on = () => apply({ type: 'ONLINE', now: Date.now() })
    const vis = () => {
      if (document.visibilityState !== 'hidden') return
      apply({ type: 'ABORT', now: Date.now() })
      clientRef.current?.dispose()
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [apply])

  const press = useCallback(() => apply({ type: 'PRESS', now: Date.now(), perm: permRef.current }), [apply])
  const release = useCallback(() => apply({ type: 'RELEASE', now: Date.now() }), [apply])
  const abort = useCallback(() => apply({ type: 'ABORT', now: Date.now() }), [apply])

  return { ui, kind: route.kind, route, switchNotice, press, release, abort }
}
