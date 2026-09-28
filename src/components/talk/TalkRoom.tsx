'use client'

/**
 * 회화방 `/study/ai/talk/[chatId]`(screens §9). 앱 셸 `main` 을 정확히 100% 채우고 목록만 스크롤한다.
 *
 * 세 상태를 엮는다 — STT(`useRealtimeStt`, 웹 = gateway) · 턴(`useChatTurn` + SSE `audio`) · 재생(`useTalkPlayback` 큐).
 * 화면 상태는 저장하지 않고 `deriveTalkState` 로 유도한다(§9-3 A). 흐름(§9-3 B):
 *   손 뗌 → final → (≤1자 아니면) 곧바로 #32 → accepted(재생 큐 시작·표시등 멈춤) → audio(chunkIndex 순 재생·점진 표시)
 *   → done(본문 확정·교정 카드 즉시·제안) → 마지막 청크 끝 → 대기.
 * 앞 턴이 아직 스트리밍 중이면 보내기 대기(QUEUED) 후 done 에 보낸다(서버 409 를 맞지 않게). 거절된 말은 UnsentBar 에 남는다.
 *
 * 비밀·엔진 값: 서명 URL·cacheKey·connectionKey·traceId 는 state·DOM·콘솔 어디에도 두지 않는다(URL 은 큐 안에서만 fetch).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { useCountdown } from '@/components/common/useNow'
import { ErrorBlock, LoadingBlock } from '@/components/common/ui'
import AcceptCorrectionSheet from '@/components/chat/AcceptCorrectionSheet'
import ChatMenuSheet from '@/components/chat/ChatMenuSheet'
import Composer, { type ComposerHandle } from '@/components/chat/Composer'
import CorrectionCard from '@/components/chat/CorrectionCard'
import { actionErrorText } from '@/components/chat/labels'
import { PendingBubble, UserBubble } from '@/components/chat/MessageBubble'
import MessageList, { type MessageListHandle, type RowContext } from '@/components/chat/MessageList'
import { endsWithUnfinishedReply, mergeMessages, prependMessages, turnBaseOf } from '@/components/chat/messages'
import NewChatSheet from '@/components/chat/NewChatSheet'
import ProposalCard from '@/components/chat/ProposalCard'
import { KEYS } from '@/components/chat/storageKeys'
import TurnNotice from '@/components/chat/TurnNotice'
import { useChatTurn, type RestoreInfo, type SettledKind } from '@/components/chat/useChatTurn'
import { useKeyboardInset } from '@/components/chat/useKeyboardInset'
import { STT_HINT_COPY, STT_STATUS_COPY, STT_SWITCH_TOAST } from '@/components/speech/sttCopy'
import { elapsedSec, showAskPermission, transcriptParts, type SttUiError } from '@/components/speech/sttUiState'
import { unlockTtsAudio } from '@/components/speech/ttsAudio'
import { useRealtimeStt, type SttFinal } from '@/components/speech/useRealtimeStt'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { isNativeApp } from '@/modules/infra/native'
import { browserEnvironmentProblem, onDeviceModelStore, type SttClientConfig } from '@/modules/speech/stt/client'
import type {
  ChatDetail,
  ChatInfo,
  ChatMessageView,
  CorrectionDto,
  CorrectionRejectResponse,
  Paged,
  ProposalDto,
  TurnAcceptedEvent,
  TurnAudioEvent,
  TurnDoneEvent,
} from '@/types/chat'
import AutoplayBar from './AutoplayBar'
import LiveUtteranceBubble from './LiveUtteranceBubble'
import type { ReplayState } from './ReplayButton'
import { completeChunkTexts, hasMoreAfter, sentenceSpans, visiblePrefix, type AudioChunkView } from './revealChunks'
import SpeechProfileMenu, { type ProfileLabel } from './SpeechProfileMenu'
import SttAlert from './SttAlert'
import SttRouteRow from './SttRouteRow'
import TalkIntro from './TalkIntro'
import TalkRoomHeader from './TalkRoomHeader'
import TalkTutorBubble from './TalkTutorBubble'
import TalkUserActions from './TalkUserActions'
import { TALK_HINT, TALK_ROOM, TALK_TOAST, replayErrorText, type UnsentReason } from './talkCopy'
import { deriveTalkState } from './talkState'
import { buildClientTimings, type PrevTurn, type TurnOrigin } from './timings'
import TopicEndNudge from './TopicEndNudge'
import UnsentBar, { type UnsentView } from './UnsentBar'
import { perfNow, useTalkPlayback, type ReplayErrorInfo } from './useTalkPlayback'
import VoiceBar from './VoiceBar'

type LoadState = 'loading' | 'ready' | 'notFound' | 'error'
type InputMode = 'voice' | 'text'

/**
 * #19 중 화면·라우터가 쓰는 값만. 휴대폰 경로는 발화 업로드(#21)에 불투명 연결 id(`connectionKey`)와 실행 값(`runtime`)이 필요하다 —
 * 모델 블록(받기용)은 설정 카드만 쓰므로 회화방 state 에 두지 않는다. 엔진 이름은 원래 없다.
 */
interface SpeechConfigView extends SttClientConfig {
  tts?: { speechProfiles?: ProfileLabel[] }
}

interface RawSpeechConfig {
  recognitionMode?: SttClientConfig['recognitionMode']
  gateway?: { enabled?: boolean; wsPath?: string; sampleRate?: number; frameMs?: number }
  onDevice?: { enabled?: boolean; available?: boolean; connectionKey?: unknown; runtime?: NonNullable<SttClientConfig['onDevice']>['runtime'] }
  fallback?: SttClientConfig['fallback']
  upload?: SttClientConfig['upload']
  tts?: { speechProfiles?: Array<{ id?: unknown; label?: unknown }> }
}

/** 보낼 말 — 음성(발화 id 있으면 REALTIME_STT) 또는 글자. */
interface Outgoing {
  text: string
  utteranceId: string | null
  origin: TurnOrigin
}

interface UnsentItem extends UnsentView {
  utteranceId: string | null
}

const TALK_KEYS = {
  inputMode: 'kaiwa.talk.inputMode',
  topicEnd: (chatId: string) => `kaiwa.talk.topicEnd.${chatId}`,
} as const

const VOICE_TOAST_BOTTOM = 136
const TEXT_TOAST_BOTTOM = 84

function pickConfig(raw: RawSpeechConfig): SpeechConfigView {
  const gw = raw.gateway
  const profiles = Array.isArray(raw.tts?.speechProfiles)
    ? raw.tts.speechProfiles.filter((p): p is ProfileLabel => typeof p?.id === 'string' && typeof p?.label === 'string').map((p) => ({ id: p.id, label: p.label }))
    : undefined
  const od = raw.onDevice
  return {
    ...(raw.recognitionMode ? { recognitionMode: raw.recognitionMode } : {}),
    ...(gw ? { gateway: { enabled: gw.enabled !== false, wsPath: gw.wsPath, sampleRate: gw.sampleRate, frameMs: gw.frameMs } } : {}),
    ...(od
      ? {
          onDevice: {
            enabled: od.enabled === true,
            ...(typeof od.available === 'boolean' ? { available: od.available } : {}),
            ...(typeof od.connectionKey === 'string' ? { connectionKey: od.connectionKey } : {}),
            ...(od.runtime ? { runtime: od.runtime } : {}),
          },
        }
      : {}),
    ...(raw.fallback ? { fallback: raw.fallback } : {}),
    ...(raw.upload ? { upload: raw.upload } : {}),
    ...(profiles ? { tts: { speechProfiles: profiles } } : {}),
  }
}

function upsertProposals(prev: ProposalDto[], next: ProposalDto[]): ProposalDto[] {
  const byId = new Map(prev.map((p) => [p.id, p]))
  for (const p of next) byId.set(p.id, { ...byId.get(p.id), ...p })
  return Array.from(byId.values())
}

function unsentReasonOf(status: number): UnsentReason {
  if (status === 409 || status === 429 || status === 422 || status === 400) return status
  if (status === 0 || status === -1) return 0
  return 'other'
}

export default function TalkRoom({ chatId, teacherName }: { chatId: string; teacherName: string }) {
  const router = useRouter()
  const [load, setLoad] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [proposals, setProposals] = useState<ProposalDto[] | null>(null)
  const [config, setConfig] = useState<SpeechConfigView | null>(null)
  // 첫 렌더는 늘 'loading' 이라 저장소 값을 초기값으로 읽어도 서버 렌더와 어긋나지 않는다.
  const [readingDefault, setReadingDefault] = useState(() => readStore('local', KEYS.readingDefault) !== 'off')
  const [mode, setMode] = useState<InputMode>(() => (readStore('session', TALK_KEYS.inputMode) === 'text' ? 'text' : 'voice'))
  const [native] = useState(() => typeof window !== 'undefined' && isNativeApp())
  const [chunks, setChunks] = useState<Record<string, AudioChunkView[]>>({})
  const [mismatch, setMismatch] = useState<Record<string, true>>({})
  const [queued, setQueued] = useState<Outgoing | null>(null)
  const [unsent, setUnsent] = useState<UnsentItem | null>(null)
  const [pendingUtteranceId, setPendingUtteranceId] = useState<string | null>(null)
  const [talkHint, setTalkHint] = useState<string | null>(null)
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set())
  const [replaySpans, setReplaySpans] = useState<{ messageId: string; texts: string[] } | null>(null)
  const [dismissedSttError, setDismissedSttError] = useState<SttUiError | null>(null)
  const [topicDismissed, setTopicDismissed] = useState<string | null>(() => readStore('session', TALK_KEYS.topicEnd(chatId)))
  const [lastVia, setLastVia] = useState<InputMode>('voice')
  const [menuOpen, setMenuOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<CorrectionDto | null>(null)
  const [busyCorrectionId, setBusyCorrectionId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const toast = useToast()
  const status = useTtsRuntimeStatus()
  const { reportSynthesis, pause: pauseStatus } = status

  const roomRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<ComposerHandle | null>(null)
  const listRef = useRef<MessageListHandle | null>(null)
  const messagesRef = useRef<ChatMessageView[]>(messages)
  const queuedRef = useRef<Outgoing | null>(null)
  const mismatchRef = useRef<Set<string>>(new Set())
  const audioCountRef = useRef<Map<string, number>>(new Map())
  const signaledRef = useRef<Set<string>>(new Set())
  /** 보내는 중인 말의 기준점·경로(accepted 에서 직전 턴으로 옮긴다). 다시 받기(resume)는 null. */
  const sendingRef = useRef<{ via: InputMode; origin: TurnOrigin } | null>(null)
  const prevTurnRef = useRef<Omit<PrevTurn, 'queue'> | null>(null)
  const recordingRef = useRef(false)
  const deferredToastRef = useRef<{ msg: string; ms?: number } | null>(null)
  const focusTextRef = useRef(false)
  const turnPhaseRef = useRef<string>('idle')

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    queuedRef.current = queued
  }, [queued])

  const showToast = toast.show
  /** 녹음 중에는 토스트를 미룬다(스크린리더 음성이 마이크로 들어가지 않게, §9-0 ⑨). */
  const notify = useCallback(
    (msg: string, ms?: number) => {
      if (recordingRef.current) deferredToastRef.current = { msg, ms }
      else showToast(msg, ms)
    },
    [showToast],
  )
  const announce = useCallback((msg: string) => notify(msg, 4000), [notify])

  const onReplayError = useCallback(
    (e: ReplayErrorInfo) => {
      if (e.source === 'mine' && e.status === 404) {
        setGone((s) => new Set(s).add(e.messageId))
        notify(replayErrorText(404))
        return
      }
      if (e.source === 'replay' && (e.status === 422 || e.status === 502 || e.status === 504 || e.status === 0)) reportSynthesis({ ok: false, status: e.status })
      notify(replayErrorText(e.status, e.retryAfterSec))
    },
    [notify, reportSynthesis],
  )
  const playback = useTalkPlayback({ onSignal: reportSynthesis, onReplayError })
  const { queue, snapshot } = playback

  const reloadProposals = useCallback(() => {
    apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}`)
      .then((r) => setProposals(r.items))
      .catch(() => {
        /* 제안은 부가 정보 — 실패해도 대화는 계속된다 */
      })
  }, [chatId])

  /* ── 턴 ─────────────────────────────────────────────────────────── */

  const signalTextOnly = (aid: string) => {
    if (signaledRef.current.has(aid)) return
    signaledRef.current.add(aid)
    reportSynthesis({ ok: false, status: 422 })
  }

  const withdrawChunks = (aid: string) => {
    setChunks((c) => {
      if (!c[aid]) return c
      const next = { ...c }
      delete next[aid]
      return next
    })
  }

  const onRestore = (text: string, info?: RestoreInfo) => {
    const via = sendingRef.current?.via ?? (info?.opts.inputSource === 'REALTIME_STT' ? 'voice' : 'text')
    sendingRef.current = null
    const st = info?.status ?? 0
    const why = st === 409 ? info?.details?.reason : null
    if (why === 'UTTERANCE_USED' || why === 'UTTERANCE_EXPIRED') {
      // 발화를 다시 붙일 수 없다(이미 연결됨·10분 지남) — 계약 권장대로 다시 보내기는 글자 턴(발화 id 없이).
      // 글자로 고쳐 보낸 경우도 같은 띠로 — 입력창에 되돌리면 죽은 발화 id 가 다시 붙는다.
      setUnsent({ text, utteranceId: null, reason: why === 'UTTERANCE_USED' ? 'utteranceUsed' : 'utteranceExpired' })
      return
    }
    if (via === 'text') {
      composerRef.current?.restore(text)
      if (info?.opts.utteranceId) setPendingUtteranceId(info.opts.utteranceId)
      return
    }
    setUnsent({ text, utteranceId: info?.opts.utteranceId ?? null, reason: unsentReasonOf(st), serverMessage: st === 400 ? info?.message : null })
  }

  const turn = useChatTurn({
    chatId,
    getMessages: () => messagesRef.current,
    setMessages,
    patchChat: (fn) => setChat((c) => (c ? fn(c) : c)),
    addProposals: (ps) => setProposals((prev) => upsertProposals(prev ?? [], ps)),
    reloadProposals,
    restoreText: onRestore,
    onNotFound: () => setLoad('notFound'),
    onAccepted: (a: TurnAcceptedEvent) => {
      const aid = a.assistantMessageId
      const s = sendingRef.current
      sendingRef.current = null
      if (s) prevTurnRef.current = { assistantMessageId: aid, ...s.origin }
      mismatchRef.current.delete(aid)
      audioCountRef.current.set(aid, 0)
      signaledRef.current.delete(aid)
      setMismatch((m) => {
        if (!m[aid]) return m
        const next = { ...m }
        delete next[aid]
        return next
      })
      withdrawChunks(aid)
      queue.startTurn(aid)
      pauseStatus(true)
    },
    onAudio: (ev: TurnAudioEvent, aid: string) => {
      if (mismatchRef.current.has(aid)) return
      audioCountRef.current.set(aid, (audioCountRef.current.get(aid) ?? 0) + 1)
      const view: AudioChunkView = { chunkIndex: ev.chunkIndex, text: typeof ev.text === 'string' ? ev.text : '', status: ev.status === 'OK' ? 'OK' : 'FAILED', last: !!ev.last }
      setChunks((c) => {
        const list = c[aid] ?? []
        if (list.some((x) => x.chunkIndex === view.chunkIndex)) return c
        return { ...c, [aid]: [...list, view] }
      })
      queue.push(aid, { chunkIndex: ev.chunkIndex, url: ev.url, status: view.status, last: view.last, pauseBeforeMs: ev.pauseBeforeMs })
      // 자막만(TEXT_ONLY)은 audio 가 아니라 status{TTS, warning:TTS_UNAVAILABLE} 로 온다(onWarning).
      if (view.status === 'OK') reportSynthesis({ ok: true, cacheHit: ev.cached === true })
      else reportSynthesis({ ok: false, status: 502 })
    },
    onWarning: (w: string, aid: string) => {
      if (w === 'AUDIO_TEXT_MISMATCH') {
        // 들리는 것 = 보이는 것: 재생 중 청크도 끊고 드러낸 문장을 거둔 뒤 done 의 최종 텍스트만(§9-11 ⑦).
        mismatchRef.current.add(aid)
        queue.abortTurn(aid)
        withdrawChunks(aid)
        setMismatch((m) => ({ ...m, [aid]: true }))
      } else if (w === 'TTS_UNAVAILABLE') {
        signalTextOnly(aid)
      }
    },
    onDone: (dn: TurnDoneEvent) => {
      const aid = dn.assistantMessageId
      queue.endTurn(aid)
      if ((audioCountRef.current.get(aid) ?? 0) === 0 || dn.audioCount === 0) signalTextOnly(aid)
    },
    onSettled: (kind: SettledKind, aid: string | null) => {
      pauseStatus(false)
      if (kind === 'error' && aid) {
        queue.abortTurn(aid)
        withdrawChunks(aid)
      }
      if (kind === 'detached' && aid) queue.endTurn(aid)
      const q = queuedRef.current
      if (!q) return
      queuedRef.current = null
      setQueued(null)
      if (kind === 'detached') {
        setUnsent({ text: q.text, utteranceId: q.utteranceId, reason: 'detached' })
        return
      }
      // 턴 컨트롤러가 idle 로 돌아간 뒤에 보낸다(같은 SSE 콜백 안에서 새 턴을 열지 않게).
      setTimeout(() => sendOutgoing(q, 'voice'), 0)
    },
  })
  const { attach, markFailed } = turn
  useEffect(() => {
    turnPhaseRef.current = turn.phase
  }, [turn.phase])
  // 표시등 스토어는 앱 전체 1개 — 턴 도중 방을 떠나도 폴링 멈춤이 남지 않게.
  useEffect(() => () => pauseStatus(false), [pauseStatus])

  const sendOutgoing = (o: Outgoing, via: InputMode) => {
    const prev = prevTurnRef.current
    const clientTimings = buildClientTimings(prev ? { ...prev, queue: queue.timingsOf(prev.assistantMessageId) } : null, o.origin)
    sendingRef.current = { via, origin: o.origin }
    setLastVia(via)
    listRef.current?.scrollToBottom()
    void turn.send(o.text, { inputSource: o.utteranceId ? 'REALTIME_STT' : 'TEXT', utteranceId: o.utteranceId, clientTimings })
  }

  /* ── STT ────────────────────────────────────────────────────────── */

  const onFinal = (f: SttFinal) => {
    const trimmed = f.text.trim()
    if (!trimmed) return // 빈 결과 힌트는 STT 상태기계가 띄운다
    if (Array.from(trimmed).length <= 1) {
      setTalkHint(TALK_HINT.tooShort)
      return
    }
    // 원문 그대로 보낸다(trim 은 판정에만) — 교정 원문 바이트 일치 검사 대상이다.
    const o: Outgoing = { text: f.text, utteranceId: f.utteranceId, origin: { origin: 'release', originAt: f.releasedAt, finalAt: f.finalAt } }
    if (turn.isBusy()) {
      if (turnPhaseRef.current === 'detached') setUnsent({ text: o.text, utteranceId: o.utteranceId, reason: 'detached' })
      else if (!queuedRef.current) {
        queuedRef.current = o
        setQueued(o)
      } else setUnsent({ text: o.text, utteranceId: o.utteranceId, reason: 409 })
      return
    }
    if (turn.blockedUntil !== null && turn.blockedUntil > Date.now()) {
      setUnsent({ text: o.text, utteranceId: o.utteranceId, reason: 429 })
      return
    }
    setUnsent(null)
    sendOutgoing(o, 'voice')
  }

  const stt = useRealtimeStt({ purpose: 'TURN', chatId, config, maxSec: 30, onFinal })
  // 말을 잃지 않은 휴대폰 → 서버 전환 — 토스트 1회(녹음 중이면 끝난 뒤, §11-2 D). 말을 잃은 전환은 오류 띠 2줄이 말한다.
  const switchNotice = stt.switchNotice
  useEffect(() => {
    if (switchNotice > 0) announce(STT_SWITCH_TOAST)
  }, [switchNotice, announce])
  const sttPhase = stt.ui.phase
  const recording = sttPhase === 'starting' || sttPhase === 'recording'
  const listening = recording || sttPhase === 'finishing'

  // 녹음이 끝나면 미뤄 둔 토스트를 띄운다.
  useEffect(() => {
    recordingRef.current = recording
    if (!recording && deferredToastRef.current) {
      const d = deferredToastRef.current
      deferredToastRef.current = null
      showToast(d.msg, d.ms)
    }
  }, [recording, showToast])

  const onPress = () => {
    // 순서가 중요하다: 큐를 먼저 멈춰야 stt.press() 안의 stopAllTts 가 "청크가 끝났다"로 읽혀 다음 청크가 재생되지 않는다.
    queue.interrupt('BARGE_IN')
    unlockTtsAudio()
    setTalkHint(null)
    stt.press()
  }
  const onRelease = () => {
    // 터치에선 pointerup 이 사용자 활성화다(pointerdown 은 아님) — 새로고침 직후 첫 동작이어도 답이 자동재생되게.
    unlockTtsAudio()
    stt.release()
  }

  /* ── 방 데이터 ───────────────────────────────────────────────────── */

  useKeyboardInset(roomRef, load === 'ready' && mode === 'text')

  useEffect(() => {
    let cancelled = false
    const base = `/api/v1/chats/${encodeURIComponent(chatId)}`
    void (async () => {
      try {
        const [detail, props, cfg] = await Promise.all([
          apiGet<ChatDetail>(`${base}?limit=50`),
          apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}`).catch(() => null),
          apiGet<RawSpeechConfig>('/api/v1/speech/config').catch(() => null),
        ])
        if (cancelled) return
        if (detail.chat.kind !== 'TALK') {
          router.replace(`/study/ai/chat/${encodeURIComponent(chatId)}`)
          return
        }
        setChat(detail.chat)
        setMessages(detail.messages)
        messagesRef.current = detail.messages
        setOlderCursor(detail.nextCursor)
        if (props) setProposals(props.items)
        const picked = cfg ? pickConfig(cfg) : null
        setConfig(picked)
        // 서버 인식이 꺼져 있거나 이 브라우저가 막혀 있으면 글자 모드로 시작(SttAlert 가 이유를 한 번 보인다).
        // 앱에서 휴대폰 경로가 켜져 있으면(오프라인 방식 등) 서버가 꺼져 있어도 음성으로 시작한다.
        const env = browserEnvironmentProblem()
        const onDeviceOn = picked?.onDevice?.enabled === true && !!onDeviceModelStore().getPlugin()
        if (!onDeviceOn && (picked?.gateway?.enabled === false || env === 'INSECURE' || env === 'UNSUPPORTED')) setMode('text')
        setLoad('ready')
        if (detail.chat.running) attach(turnBaseOf(detail.messages))
        else if (endsWithUnfinishedReply(detail.messages)) markFailed()
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        if (hash.startsWith('#cr_')) setHighlightId(hash.slice(4))
      } catch (e) {
        if (cancelled) return
        setLoad(toErr(e).status === 404 ? 'notFound' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatId, attempt, attach, markFailed, router])

  // 해시로 들어온 교정 카드로 스크롤 + 2초 강조(로드한 50개 안에 없으면 맨 아래 그대로).
  useEffect(() => {
    if (load !== 'ready' || !highlightId) return
    const el = document.getElementById(`cr_${highlightId}`)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    const t = setTimeout(() => setHighlightId(null), 2_000)
    return () => clearTimeout(t)
  }, [load, highlightId])

  const sttError = stt.ui.error

  // 음성→글자 전환을 사용자가 골랐을 때만 입력창에 포커스(키보드가 뜨는 것은 사용자가 고른 동작).
  useEffect(() => {
    if (mode === 'text' && focusTextRef.current) {
      focusTextRef.current = false
      composerRef.current?.focus()
    }
  }, [mode])

  const loadOlder = async () => {
    if (!olderCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const r = await apiGet<ChatDetail>(`/api/v1/chats/${encodeURIComponent(chatId)}?cursor=${encodeURIComponent(olderCursor)}&limit=50`)
      setMessages((ms) => prependMessages(ms, r.messages))
      setOlderCursor(r.nextCursor)
    } catch (e) {
      notify(actionErrorText(toErr(e)))
    } finally {
      setLoadingOlder(false)
    }
  }

  const refreshMessages = async () => {
    try {
      const r = await apiGet<ChatDetail>(`/api/v1/chats/${encodeURIComponent(chatId)}?limit=50`)
      setMessages((ms) => mergeMessages(ms, r.messages))
    } catch {
      /* 다음 동기화 때 맞춰진다 */
    }
  }

  const updateCorrection = (u: CorrectionDto) =>
    setMessages((ms) => ms.map((m) => (m.corrections?.some((c) => c.id === u.id) ? { ...m, corrections: m.corrections.map((c) => (c.id === u.id ? { ...c, ...u } : c)) } : m)))

  const rejectCorrection = async (c: CorrectionDto) => {
    if (busyCorrectionId) return
    setBusyCorrectionId(c.id)
    try {
      const r = await apiPost<CorrectionRejectResponse>(`/api/v1/corrections/${encodeURIComponent(c.id)}/reject`)
      updateCorrection({ ...c, status: r.status, resolvedAt: r.resolvedAt })
      notify('무시했어요 · 기록에 남지 않아요')
    } catch (e) {
      const err = toErr(e)
      if (err.status === 409) {
        notify('이미 처리된 교정이에요')
        void refreshMessages()
      } else notify(actionErrorText(err))
    } finally {
      setBusyCorrectionId(null)
    }
  }

  /* ── 파생 값 ─────────────────────────────────────────────────────── */

  const rateLeft = useCountdown(turn.blockedUntil)
  const { committed, partial } = transcriptParts(stt.ui)
  const view = deriveTalkState({
    sttPhase,
    turnPhase: turn.phase,
    playbackPhase: snapshot.phase,
    playbackSource: snapshot.source,
    queued: queued !== null,
    rateLimitedSec: turn.blockedUntil !== null ? (rateLeft ?? 0) : null,
    recordingSec: elapsedSec(stt.ui),
    askPermission: showAskPermission(stt.ui),
    slowConnect: stt.ui.slow,
    quietHint: stt.ui.hint === 'TOO_QUIET' ? STT_HINT_COPY.TOO_QUIET : null,
    idleHint:
      talkHint ??
      (stt.ui.hint === 'AUTO_STOPPED'
        ? TALK_HINT.autoStopped
        : stt.ui.hint && stt.ui.hint !== 'TOO_QUIET'
          ? STT_HINT_COPY[stt.ui.hint]
          : stt.ui.rationale && !stt.ui.error
            ? STT_STATUS_COPY.rationale
            : null),
  })
  const turnBusy = turn.phase === 'sending' || turn.phase === 'streaming' || turn.phase === 'detached'

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'ASSISTANT') return messages[i]
    return null
  }, [messages])

  /* ── 다시 듣기 ──────────────────────────────────────────────────── */

  const replayStateOf = (m: ChatMessageView, source: 'replay' | 'mine'): ReplayState => {
    if (snapshot.messageId !== m.id) return 'idle'
    if (snapshot.source === source) return snapshot.phase === 'playing' ? 'playing' : snapshot.phase === 'waiting' ? 'loading' : 'idle'
    if (source === 'replay' && snapshot.source === 'turn' && snapshot.phase === 'playing') return 'playing'
    return 'idle'
  }

  const guardListening = () => {
    if (!listening) return false
    notify(TALK_TOAST.replayWhileRecording)
    return true
  }

  const replayTutor = (m: ChatMessageView) => {
    if (guardListening()) return
    unlockTtsAudio()
    const texts = playback.replayTutor(m, completeChunkTexts(chunks[m.id] ?? [], true))
    setReplaySpans({ messageId: m.id, texts })
  }

  const replayMine = (m: ChatMessageView) => {
    if (guardListening()) return
    unlockTtsAudio()
    playback.replayMine(m)
  }

  /* ── 목록 슬롯 ──────────────────────────────────────────────────── */

  const proposalsOf = (id: string) =>
    (proposals ?? [])
      .filter((p) => p.kind === 'ADD_WORD' && p.messageId === id)
      .map((p) => (
        <div key={p.id} className="mt-1.5 pl-9">
          <div className="max-w-[85%]">
            <ProposalCard proposal={p} onChange={(np) => setProposals((prev) => upsertProposals(prev ?? [], [np]))} onToast={notify} />
          </div>
        </div>
      ))

  const renderUser = (m: ChatMessageView, ctx: RowContext) => {
    const canMine = m.inputSource === 'REALTIME_STT' && !!m.utteranceId && m.audioAvailable !== false && !gone.has(m.id) && m.localStatus !== 'SENDING'
    const list = m.corrections ?? []
    return (
      <>
        <UserBubble
          chatId={chatId}
          message={m}
          showTime={ctx.groupEnd}
          correctionChip={false}
          actions={
            canMine ? (
              <TalkUserActions replay={replayStateOf(m, 'mine')} disabled={listening} onPlay={() => replayMine(m)} onStop={playback.stop} />
            ) : undefined
          }
        />
        {list.length > 0 ? (
          <ul className="mt-1.5 flex w-full min-w-0 flex-col gap-2">
            {list.map((c) => (
              <CorrectionCard
                key={c.id}
                correction={c}
                index={1}
                total={list.length}
                showCounter={false}
                busy={busyCorrectionId === c.id}
                highlighted={highlightId === c.id}
                onAccept={setAcceptTarget}
                onReject={(x) => void rejectCorrection(x)}
              />
            ))}
          </ul>
        ) : null}
      </>
    )
  }

  const speakingFor = (m: ChatMessageView) => snapshot.messageId === m.id && snapshot.phase === 'playing' && (snapshot.source === 'turn' || snapshot.source === 'replay')

  const renderTutor = (m: ChatMessageView, ctx: RowContext) => {
    const isReplay = snapshot.messageId === m.id && snapshot.source === 'replay'
    const spans =
      isReplay && replaySpans?.messageId === m.id ? sentenceSpans(m.content, replaySpans.texts) : sentenceSpans(m.content, completeChunkTexts(chunks[m.id] ?? [], true))
    const speaking = speakingFor(m)
    return (
      <>
        <TalkTutorBubble
          message={m}
          mode="done"
          chunks={[]}
          hasMore={false}
          spans={spans}
          teacherName={teacherName}
          showHeader={ctx.groupStart}
          showTime={ctx.groupEnd}
          readingDefault={readingDefault}
          playingIndex={speaking && spans ? snapshot.chunkIndex : null}
          speaking={speaking}
          replay={replayStateOf(m, 'replay')}
          replayDisabled={listening}
          onReplay={() => replayTutor(m)}
          onStop={playback.stop}
        />
        {proposalsOf(m.id)}
      </>
    )
  }

  const renderPending = (m: ChatMessageView, ctx: RowContext) => {
    if (mismatch[m.id]) return <PendingBubble teacherName={teacherName} showHeader={ctx.groupStart} stage="PARSE" startedAt={turn.startedAt} detached={false} />
    const vis = visiblePrefix(chunks[m.id] ?? [])
    if (vis.length === 0) return null
    const speaking = speakingFor(m)
    return (
      <TalkTutorBubble
        message={m}
        mode="streaming"
        chunks={vis}
        hasMore={hasMoreAfter(vis)}
        spans={null}
        teacherName={teacherName}
        showHeader={ctx.groupStart}
        showTime={false}
        readingDefault={readingDefault}
        playingIndex={speaking ? snapshot.chunkIndex : null}
        speaking={speaking}
        replay="idle"
        replayDisabled={listening}
        onReplay={() => undefined}
        onStop={playback.stop}
      />
    )
  }

  const liveText = `${committed}${partial}`
  const tail =
    sttPhase === 'starting' || sttPhase === 'recording' ? (
      <LiveUtteranceBubble kind="listening" partial={liveText} />
    ) : sttPhase === 'finishing' ? (
      <LiveUtteranceBubble kind="recognizing" partial={liveText} />
    ) : queued ? (
      <LiveUtteranceBubble kind="queued" partial="" text={queued.text} />
    ) : null

  /* ── 입력 ───────────────────────────────────────────────────────── */

  const toText = () => {
    if (view.keyboardDisabled) {
      notify(TALK_TOAST.modeWhileRecording)
      return
    }
    focusTextRef.current = true
    setMode('text')
    writeStore('session', TALK_KEYS.inputMode, 'text')
  }

  const toVoice = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setMode('voice')
    writeStore('session', TALK_KEYS.inputMode, 'voice')
  }

  const sendText = (text: string) => {
    unlockTtsAudio()
    const utteranceId = pendingUtteranceId
    setPendingUtteranceId(null)
    sendOutgoing({ text, utteranceId, origin: { origin: 'send', originAt: perfNow() } }, 'text')
  }

  const resendUnsent = () => {
    const u = unsent
    if (!u) return
    if (turn.isBusy()) {
      notify(TALK_TOAST.waitReply)
      return
    }
    unlockTtsAudio()
    setUnsent(null)
    sendOutgoing({ text: u.text, utteranceId: u.utteranceId, origin: { origin: 'send', originAt: perfNow() } }, 'voice')
  }

  const editUnsent = () => {
    const u = unsent
    if (!u) return
    setUnsent(null)
    setPendingUtteranceId(u.utteranceId)
    focusTextRef.current = false
    setMode('text')
    writeStore('session', TALK_KEYS.inputMode, 'text')
    // 입력창은 글자 모드로 바뀐 뒤 그려진다 — 다음 틱에 채운다.
    setTimeout(() => composerRef.current?.fill(u.text), 0)
  }

  /* ── 렌더 ───────────────────────────────────────────────────────── */

  const header = <TalkRoomHeader teacherName={teacherName} title={chat?.title ?? null} onMenu={chat ? () => setMenuOpen(true) : undefined} onAnnounce={announce} />

  if (load === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <TalkRoomHeader teacherName={teacherName} title={null} />
        <LoadingBlock />
      </div>
    )
  }
  if (load === 'notFound' || !chat) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <TalkRoomHeader teacherName={teacherName} title={null} />
        <div className="px-4 pt-6">
          {load === 'error' ? (
            <ErrorBlock
              message={TALK_ROOM.loadFailed}
              onRetry={() => {
                setLoad('loading')
                setAttempt((n) => n + 1)
              }}
            />
          ) : (
            <div role="alert" className="rounded-[14px] border border-line bg-surface p-4">
              <p className="text-[15px] font-semibold break-keep">{TALK_ROOM.notFound}</p>
              <Link href="/study/ai?tab=talk" className="mt-3 inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold">
                {TALK_ROOM.back}
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const showSttAlert = !!sttError && sttError !== dismissedSttError
  const topicEndFor = lastAssistant?.id ?? null
  const showTopicEnd = turn.endOfTopic && view.state === 'IDLE' && !!topicEndFor && topicDismissed !== topicEndFor
  let strip: React.ReactNode = null
  if (showSttAlert && sttError) {
    strip = (
      <SttAlert
        code={sttError.code}
        retryAfterSec={sttError.retryAfterSec}
        mountCheck={sttError.mountCheck}
        switched={sttError.switched}
        offlineMode={sttError.offlineMode}
        native={native}
        textMode={mode === 'text'}
        onTextMode={() => {
          setDismissedSttError(sttError)
          focusTextRef.current = true
          setMode('text')
          writeStore('session', TALK_KEYS.inputMode, 'text')
        }}
        onClose={() => setDismissedSttError(sttError)}
      />
    )
  } else if (unsent) {
    strip = <UnsentBar unsent={unsent} blockedUntil={turn.blockedUntil} onResend={resendUnsent} onEdit={editUnsent} onDiscard={() => {
          setUnsent(null)
          turn.clearNotice()
        }} />
  } else if (snapshot.phase === 'blocked') {
    strip = (
      <AutoplayBar
        onPlay={() => {
          unlockTtsAudio()
          queue.resumeBlocked()
        }}
      />
    )
  } else if (turn.notice && mode === 'text' && lastVia === 'text') {
    strip = <TurnNotice notice={turn.notice} blockedUntil={turn.blockedUntil} onClose={turn.clearNotice} />
  } else if (showTopicEnd) {
    strip = (
      <TopicEndNudge
        onNew={() => setNewOpen(true)}
        onClose={() => {
          setTopicDismissed(topicEndFor)
          writeStore('session', TALK_KEYS.topicEnd(chatId), topicEndFor)
        }}
      />
    )
  }
  const stripIsNotice = strip !== null && !showSttAlert && !unsent && snapshot.phase !== 'blocked' && !!turn.notice && mode === 'text' && lastVia === 'text'

  return (
    <div ref={roomRef} data-talk-state={view.state} className="flex h-full min-h-0 min-w-0 flex-col bg-ground">
      {header}
      <MessageList
        chatId={chatId}
        messages={messages}
        proposals={proposals ?? []}
        teacherName={teacherName}
        readingDefault={readingDefault}
        turn={turn}
        hasOlder={!!olderCursor}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
        onPick={() => undefined}
        onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
        onToast={notify}
        handleRef={listRef}
        renderUser={renderUser}
        renderTutor={renderTutor}
        renderPending={renderPending}
        intro={<TalkIntro teacherName={teacherName} />}
        tail={tail}
        liveOff={view.state === 'RECORDING'}
        followContent
      />
      {strip ? <div className={stripIsNotice ? 'flex-none' : 'flex-none px-4 pb-2 pt-1'}>{strip}</div> : null}
      {mode === 'voice' ? (
        <VoiceBar
          view={view}
          db={stt.ui.db}
          onPress={onPress}
          onRelease={onRelease}
          onAbort={stt.abort}
          onKeyboard={toText}
          onStop={playback.stop}
        />
      ) : (
        <Composer
          chatId={chatId}
          busy={turnBusy}
          blockedUntil={turn.blockedUntil}
          placeholder={TALK_ROOM.textPlaceholder}
          onSend={sendText}
          onBlocked={notify}
          handleRef={composerRef}
          onTextChange={(t) => {
            if (t.trim() === '') setPendingUtteranceId(null)
          }}
          leading={
            <button type="button" aria-label={TALK_ROOM.voice} onClick={toVoice} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
          }
        />
      )}
      <ChatMenuSheet
        open={menuOpen}
        chat={chat}
        turnBusy={turnBusy}
        readingDefault={readingDefault}
        onClose={() => setMenuOpen(false)}
        onRenamed={(title) => setChat((c) => (c ? { ...c, title } : c))}
        onReadingDefault={(on) => {
          setReadingDefault(on)
          writeStore('local', KEYS.readingDefault, on ? 'on' : 'off')
        }}
        onToast={notify}
        extra={
          <>
            <SpeechProfileMenu labels={config?.tts?.speechProfiles ?? null} onToast={notify} />
            {/* 앱에서만 "알아듣는 곳" 읽기 전용 한 줄(§11-2 D). 웹·플러그인 없는 셸은 WEB 이라 그리지 않는다. */}
            {native && stt.route.reason !== 'WEB' ? <SttRouteRow route={stt.route} /> : null}
          </>
        }
      />
      <NewChatSheet open={newOpen} kind="TALK" onClose={() => setNewOpen(false)} />
      <AcceptCorrectionSheet
        key={acceptTarget?.id ?? 'none'}
        correction={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onDone={(updated, withWord) => {
          updateCorrection(updated)
          setAcceptTarget(null)
          notify(withWord ? '채택하고 단어장에 넣었어요' : '채택했어요')
        }}
        onConflict={() => {
          setAcceptTarget(null)
          notify('이미 처리된 교정이에요')
          void refreshMessages()
        }}
      />
      <Toast message={toast.message} bottomPx={mode === 'voice' ? VOICE_TOAST_BOTTOM : TEXT_TOAST_BOTTOM} />
    </div>
  )
}
