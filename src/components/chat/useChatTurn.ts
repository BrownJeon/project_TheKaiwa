'use client'

/**
 * 채팅 턴 상태기계(screens.md §3-3) — `idle → sending → streaming → (detached) → idle | failed`.
 *
 * - 보내기는 `apiStream`(fetch POST + SSE). `accepted` 전에 끊기면 "보내지 못함"(원문 복원), 뒤에 끊기면
 *   **오류가 아니라 detached** — 서버는 끝까지 처리·저장하므로(api-contract §0-9) #29 `after=` 폴링
 *   2.5s(처음 30초) → 5s, 200초 상한으로 이어 붙인다.
 * - 재시도는 언제나 `{resumePending:true}` 하나(task-006 D1) — 임시 사용자 말풍선을 만들지 않는다.
 * - 스트림·타이머·마운트 여부처럼 렌더와 무관한 값은 컨트롤러 객체에 두고, 화면에 보일 값만 React 상태로 낸다.
 * - `traceId` 는 어디에도 출력하지 않는다(DOM·토스트·콘솔).
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { apiGet, apiStream, isAbort } from '@/components/common/api'
import type {
  ChatDetail,
  ChatInfo,
  ChatMessageView,
  ProposalDto,
  TurnAcceptedEvent,
  TurnDoneEvent,
  TurnErrorEvent,
  TurnStage,
  TurnStatusEvent,
} from '@/types/chat'
import { retryAfterOf, toErr } from '@/components/common/errors'
import { LOST_FAILURE, NETWORK_SEND_ERROR, turnFailure, turnNoticeText, type FailureView } from './labels'
import { endsWithUnfinishedReply, findLastIndex, isTemp, lastServerId, mergeMessages, turnBaseOf } from './messages'
import { parseEventData, readSse } from './sse'

export type TurnPhase = 'idle' | 'sending' | 'streaming' | 'detached' | 'failed'

export interface TurnNoticeState {
  kind: 'error' | 'rate' | 'notFound'
  text: string
  retryAfterSec?: number
}

export interface TurnState {
  phase: TurnPhase
  stage: TurnStage | null
  /** 이번 턴 시작 시각(ms) — 경과 초 표시용 */
  startedAt: number | null
  notice: TurnNoticeState | null
  failure: FailureView | null
  /** 429 로 막힌 시각(ms). 지나면 다시 보낼 수 있다. */
  blockedUntil: number | null
  /** 직전 `done.endOfTopic` — 점검 권유 조건 */
  endOfTopic: boolean
}

export interface TurnDeps {
  chatId: string
  getMessages: () => ChatMessageView[]
  setMessages: Dispatch<SetStateAction<ChatMessageView[]>>
  patchChat: (fn: (c: ChatInfo) => ChatInfo) => void
  addProposals: (ps: ProposalDto[]) => void
  reloadProposals: () => void
  /** 보내지 못했을 때 입력창이 비어 있으면 원문을 되돌린다. */
  restoreText: (text: string) => void
  onNotFound: () => void
}

const INITIAL: TurnState = {
  phase: 'idle',
  stage: null,
  startedAt: null,
  notice: null,
  failure: null,
  blockedUntil: null,
  endOfTopic: false,
}

const POLL_FAST_MS = 2_500
const POLL_SLOW_MS = 5_000
const POLL_FAST_WINDOW_MS = 30_000
const POLL_MAX_MS = 200_000

interface RunContext {
  /** 이번 턴 직전 메시지 id(폴링 `after`) */
  baseId: string | null
  /** 새 턴이면 임시 말풍선 id, 재시도면 null */
  tmpId: string | null
  text: string | null
}

interface PollState {
  baseId: string | null
  startedAt: number
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
}

const turnPath = (chatId: string) => `/api/v1/chats/${encodeURIComponent(chatId)}`

class TurnController {
  private deps: TurnDeps | null = null
  private phase: TurnPhase = 'idle'
  private abort: AbortController | null = null
  private poll: PollState | null = null
  private alive = false
  /** 스트리밍 중 화면이 가려졌는가 — 모바일은 백그라운드에서 연결이 조용히 죽을 수 있어 돌아오면 폴링으로 갈아탄다. */
  private hiddenWhileStreaming = false
  private currentBase: string | null = null

  constructor(private readonly setState: Dispatch<SetStateAction<TurnState>>) {}

  bind(deps: TurnDeps) {
    this.deps = deps
    this.alive = true
  }

  dispose() {
    this.alive = false
    this.abort?.abort()
    this.abort = null
    this.stopPolling()
  }

  private set(patch: Partial<TurnState>) {
    if (patch.phase) this.phase = patch.phase
    this.setState((s) => ({ ...s, ...patch }))
  }

  private get d(): TurnDeps {
    if (!this.deps) throw new Error('useChatTurn: not bound')
    return this.deps
  }

  get busy(): boolean {
    return this.phase === 'sending' || this.phase === 'streaming' || this.phase === 'detached'
  }

  send = async (text: string): Promise<void> => {
    if (!this.alive || this.busy) return
    const d = this.d
    const now = Date.now()
    const messages = d.getMessages()
    const ctx: RunContext = { baseId: lastServerId(messages), tmpId: `tmp_${now}`, text }
    d.setMessages((ms) => [
      ...ms,
      { id: ctx.tmpId as string, role: 'USER', content: text, status: 'DONE', localStatus: 'SENDING', createdAt: new Date(now).toISOString(), corrections: [] },
    ])
    this.set({ phase: 'sending', stage: null, startedAt: now, notice: null, failure: null, endOfTopic: false })
    await this.run({ text, inputSource: 'TEXT' }, ctx)
  }

  resume = async (): Promise<void> => {
    if (!this.alive || this.busy) return
    const ctx: RunContext = { baseId: turnBaseOf(this.d.getMessages()), tmpId: null, text: null }
    this.set({ phase: 'sending', stage: null, startedAt: Date.now(), notice: null })
    await this.run({ resumePending: true }, ctx)
  }

  /** 방에 들어왔는데 서버가 아직 답하는 중(`running`) — 곧바로 폴링으로 이어 붙인다. */
  attach = (baseId: string | null) => {
    if (!this.alive || this.busy) return
    this.set({ phase: 'detached', stage: null, startedAt: Date.now(), failure: null })
    this.startPolling(baseId)
  }

  /** 방 진입 시 마지막 강사 답이 실패(또는 락 없는 PENDING) — 자동 재시도하지 않고 [다시 받기]를 보인다. */
  markFailed = () => {
    if (!this.alive || this.busy) return
    this.set({ phase: 'failed', stage: null, failure: LOST_FAILURE })
  }

  clearNotice = () => {
    this.set({ notice: null })
  }

  onHidden = () => {
    if (this.phase === 'streaming') this.hiddenWhileStreaming = true
  }

  /**
   * 탭이 다시 보일 때: 가려진 동안 스트리밍 중이었으면 스트림을 버리고 폴링으로(끊김은 오류가 아니다),
   * 폴링 중이면 즉시 한 번, 쉬는 중이면 새 메시지만 당겨 온다(다른 기기에서 쓴 경우).
   */
  onVisible = () => {
    if (!this.alive) return
    if (this.phase === 'streaming' && this.hiddenWhileStreaming) {
      this.hiddenWhileStreaming = false
      this.abort?.abort()
      this.abort = null
      this.set({ phase: 'detached' })
      this.startPolling(this.currentBase)
      void this.pollOnce()
    } else if (this.phase === 'detached' && this.poll) {
      void this.pollOnce()
    } else if (this.phase === 'idle' || this.phase === 'failed') {
      void this.syncNew()
    }
  }

  private async run(body: unknown, ctx: RunContext): Promise<void> {
    const d = this.d
    const ac = new AbortController()
    this.abort = ac
    this.currentBase = ctx.baseId
    this.hiddenWhileStreaming = false
    const st: { accepted: TurnAcceptedEvent | null; terminal: boolean } = { accepted: null, terminal: false }

    let stream: ReadableStream<Uint8Array>
    try {
      stream = await apiStream(`${turnPath(d.chatId)}/turns`, body, { signal: ac.signal })
    } catch (e) {
      if (this.abort === ac) this.abort = null
      if (isAbort(e) || !this.alive) return
      this.rejected(e, ctx)
      return
    }

    try {
      await readSse(stream, (ev) => {
        if (!this.alive) return
        if (ev.event === 'accepted') {
          const a = parseEventData<TurnAcceptedEvent>(ev)
          if (!a?.assistantMessageId) return
          st.accepted = a
          this.onAccepted(a, ctx)
        } else if (ev.event === 'status') {
          const s = parseEventData<TurnStatusEvent>(ev)
          if (s?.stage && this.phase === 'streaming') this.set({ stage: s.stage })
        } else if (ev.event === 'done') {
          const dn = parseEventData<TurnDoneEvent>(ev)
          if (!dn?.assistantMessageId || !dn.conversation) return
          st.terminal = true
          this.onDone(dn, ctx)
        } else if (ev.event === 'error') {
          st.terminal = true
          this.onError(parseEventData<TurnErrorEvent>(ev) ?? {}, st.accepted, ctx)
        }
      })
    } catch (e) {
      if (isAbort(e) || !this.alive) return
      // 읽기 도중 끊김 — 아래에서 accepted 여부로 갈린다.
    } finally {
      if (this.abort === ac) this.abort = null
    }

    if (!this.alive || st.terminal) return
    if (st.accepted) {
      this.set({ phase: 'detached' })
      this.startPolling(ctx.baseId)
    } else {
      this.lostBeforeAccept(ctx)
    }
  }

  private onAccepted(a: TurnAcceptedEvent, ctx: RunContext) {
    const pending: ChatMessageView = {
      id: a.assistantMessageId,
      role: 'ASSISTANT',
      content: '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }
    if (ctx.tmpId) {
      const tmpId = ctx.tmpId
      this.d.setMessages((ms) => {
        const out = ms.map((m): ChatMessageView => {
          if (m.id !== tmpId) return m
          const { localStatus: _drop, ...rest } = m
          void _drop
          return { ...rest, id: a.userMessageId }
        })
        if (!out.some((m) => m.id === a.assistantMessageId)) out.push(pending)
        return out
      })
    } else {
      // 재시도: 서버는 실패한 강사 행을 PENDING 으로 되돌려 재사용한다(D1). id 가 다르면 실패 행을 새 행으로 바꾼다.
      this.d.setMessages((ms) => {
        if (ms.some((m) => m.id === a.assistantMessageId)) {
          return ms.map((m) => (m.id === a.assistantMessageId ? { ...m, status: 'PENDING' } : m))
        }
        const i = findLastIndex(ms, (m) => m.role === 'ASSISTANT' && m.status !== 'DONE')
        const out = i === -1 ? ms.slice() : ms.filter((_, k) => k !== i)
        out.push(pending)
        return out
      })
    }
    this.set({ phase: 'streaming', stage: null, failure: null })
  }

  private onDone(dn: TurnDoneEvent, ctx: RunContext) {
    const aid = dn.assistantMessageId
    const reply: Partial<ChatMessageView> = {
      content: dn.conversation.replyJa,
      reading: dn.conversation.replyReading ?? null,
      translation: dn.conversation.replyKo ?? null,
      learning: dn.learning ?? null,
      status: 'DONE',
    }
    this.d.setMessages((ms) => {
      if (ms.some((m) => m.id === aid)) return ms.map((m) => (m.id === aid ? { ...m, ...reply } : m))
      return [...ms, { id: aid, role: 'ASSISTANT', createdAt: new Date().toISOString(), ...reply } as ChatMessageView]
    })
    if (dn.proposals?.length) {
      this.d.addProposals(dn.proposals.map((p) => ({ ...p, messageId: p.messageId ?? aid })))
    }
    const added = ctx.tmpId ? 2 : 0
    this.d.patchChat((c) => ({ ...c, running: false, messageCount: c.messageCount + added }))
    this.set({ phase: 'idle', stage: null, startedAt: null, failure: null, endOfTopic: !!dn.endOfTopic })
  }

  private onError(er: TurnErrorEvent, accepted: TurnAcceptedEvent | null, ctx: RunContext) {
    const failure = turnFailure(er.code, er.retryable)
    if (accepted) {
      const aid = accepted.assistantMessageId
      this.d.setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, status: 'FAILED' } : m)))
      this.d.patchChat((c) => ({ ...c, running: false }))
      this.set({ phase: 'failed', stage: null, failure })
      return
    }
    // accepted 전 error — 사용자 메시지가 저장됐는지 모른다: 원문을 돌려주고 서버 상태로 맞춘다.
    this.dropTemp(ctx)
    this.set({ phase: ctx.tmpId ? 'idle' : 'failed', stage: null, notice: { kind: 'error', text: failure.text } })
    void this.syncNew()
  }

  /** 스트림이 열리기 전 봉투 오류(400·404·409·429·422·5xx) 또는 네트워크 실패. */
  private rejected(e: unknown, ctx: RunContext) {
    const err = toErr(e)
    this.dropTemp(ctx)
    const backTo: TurnPhase = ctx.tmpId ? 'idle' : 'failed'
    if (err.status === 404) {
      this.set({ phase: 'idle', stage: null, notice: { kind: 'notFound', text: turnNoticeText(err) } })
      this.d.onNotFound()
      return
    }
    if (err.status === 429) {
      const sec = retryAfterOf(err)
      this.set({ phase: backTo, stage: null, blockedUntil: Date.now() + sec * 1000, notice: { kind: 'rate', text: '', retryAfterSec: sec } })
      return
    }
    if (err.status === 409 && !ctx.tmpId) {
      // 다시 받을 대상이 없다(다른 기기·탭이 이미 끝냈다) — 서버 상태로 맞춘다.
      this.set({ phase: 'idle', stage: null, failure: null })
      void this.syncNew()
      return
    }
    this.set({ phase: backTo, stage: null, notice: { kind: 'error', text: turnNoticeText(err) } })
    // 네트워크 실패·409(같은 사용자의 다른 턴)는 서버에 무엇이 있는지 모른다 — 조용히 맞춘다.
    if (err.status === 0 || err.status === 409) void this.syncNew()
  }

  private lostBeforeAccept(ctx: RunContext) {
    this.dropTemp(ctx)
    this.set({ phase: ctx.tmpId ? 'idle' : 'failed', stage: null, notice: { kind: 'error', text: NETWORK_SEND_ERROR } })
    void this.syncNew()
  }

  private dropTemp(ctx: RunContext) {
    if (!ctx.tmpId) return
    const tmpId = ctx.tmpId
    this.d.setMessages((ms) => ms.filter((m) => m.id !== tmpId))
    if (ctx.text) this.d.restoreText(ctx.text)
  }

  /* ── 폴링 ─────────────────────────────────────────────────────── */

  private startPolling(baseId: string | null) {
    this.stopPolling()
    const p: PollState = { baseId, startedAt: Date.now(), timer: null, inFlight: false }
    this.poll = p
    this.schedule(p)
  }

  private stopPolling() {
    if (this.poll?.timer) clearTimeout(this.poll.timer)
    this.poll = null
  }

  private schedule(p: PollState) {
    if (this.poll !== p || !this.alive) return
    const elapsed = Date.now() - p.startedAt
    p.timer = setTimeout(() => void this.pollOnce(), elapsed < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS)
  }

  private async pollOnce(): Promise<void> {
    const p = this.poll
    if (!p || p.inFlight || !this.alive) return
    if (p.timer) clearTimeout(p.timer)
    p.timer = null
    if (Date.now() - p.startedAt > POLL_MAX_MS) {
      this.stopPolling()
      this.set({ phase: 'failed', stage: null, failure: LOST_FAILURE })
      return
    }
    p.inFlight = true
    try {
      const q = p.baseId ? `?after=${encodeURIComponent(p.baseId)}&limit=50` : '?limit=50'
      const r = await apiGet<ChatDetail>(`${turnPath(this.d.chatId)}${q}`)
      if (this.poll !== p || !this.alive) return
      this.applyServer(r)
      if (!r.chat.running) {
        this.stopPolling()
        const merged = mergeMessages(this.d.getMessages(), r.messages)
        const last = merged[merged.length - 1]
        if (last && last.role === 'ASSISTANT' && last.status === 'DONE') {
          this.set({ phase: 'idle', stage: null, startedAt: null, failure: null })
          this.d.reloadProposals()
        } else {
          this.set({ phase: 'failed', stage: null, failure: LOST_FAILURE })
        }
        return
      }
    } catch (e) {
      if (this.poll !== p || !this.alive) return
      if (toErr(e).status === 404) {
        this.stopPolling()
        this.set({ phase: 'idle', stage: null })
        this.d.onNotFound()
        return
      }
      // 네트워크 오류는 다음 간격에 다시 — 연속 실패만으로 failed 로 가지 않는다(200초 상한만).
    } finally {
      p.inFlight = false
    }
    this.schedule(p)
  }

  private applyServer(r: ChatDetail) {
    this.d.setMessages((ms) => mergeMessages(ms.filter((m) => !isTemp(m)), r.messages))
    this.d.patchChat((c) => ({ ...c, ...r.chat }))
  }

  /** 쉬는 동안 서버와 맞춘다: 새 메시지를 붙이고, 서버가 답하는 중이면 폴링, 마지막이 실패면 [다시 받기]. */
  private async syncNew(): Promise<void> {
    if (!this.alive) return
    const before = this.d.getMessages()
    const after = lastServerId(before)
    try {
      const r = await apiGet<ChatDetail>(`${turnPath(this.d.chatId)}${after ? `?after=${encodeURIComponent(after)}&limit=50` : '?limit=50'}`)
      if (!this.alive || this.busy) return
      this.applyServer(r)
      const merged = mergeMessages(before.filter((m) => !isTemp(m)), r.messages)
      if (r.chat.running) this.attach(turnBaseOf(merged))
      else if (endsWithUnfinishedReply(merged)) this.markFailed()
      else if (this.phase === 'failed') this.set({ phase: 'idle', failure: null })
    } catch (e) {
      if (this.alive && toErr(e).status === 404) this.d.onNotFound()
    }
  }
}

export interface ChatTurn extends TurnState {
  send: (text: string) => Promise<void>
  resume: () => Promise<void>
  attach: (baseId: string | null) => void
  markFailed: () => void
  clearNotice: () => void
}

export function useChatTurn(deps: TurnDeps): ChatTurn {
  const [state, setState] = useState<TurnState>(INITIAL)
  const [ctl] = useState(() => new TurnController(setState))

  // 매 렌더 최신 콜백을 묶는다(타이머·스트림 콜백이 옛 클로저를 붙잡지 않게).
  useEffect(() => {
    ctl.bind(deps)
  })

  useEffect(() => () => ctl.dispose(), [ctl])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') ctl.onVisible()
      else ctl.onHidden()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [ctl])

  return {
    ...state,
    send: ctl.send,
    resume: ctl.resume,
    attach: ctl.attach,
    markFailed: ctl.markFailed,
    clearNotice: ctl.clearNotice,
  }
}
