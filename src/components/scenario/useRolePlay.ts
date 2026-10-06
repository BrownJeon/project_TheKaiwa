'use client'

/**
 * 역할극 회화방 상태(task-010d B2 — 가이드 §3-D~§3-F·§5). `TalkRoom` 은 이 훅 하나와 부품 몇 개만 얹는다(SSE·재생·말풍선은 그대로).
 *  - 시작값 = #29 `chat.scenario`(S6). 진행은 #32 `done.scenario`(S7)를 받을 때마다 최댓값 규칙으로 합친다(`mergeProgress`). `stepIndex` 는
 *    지금 서버가 늘 null 이라 단계는 번호만 보인다(`rp-nostep`).
 *  - 목표 카드와 대답 연습 판은 한 번에 하나만 펼친다. 카드는 내 말 0개면 펼친 채 시작하고 첫 말 뒤 한 번 접는다(직접 펼쳤거나 카드 안 초점이면 안 접음).
 *    대답 연습 판은 펼칠 때의 선생님 말에 묶인다 — 말을 보내거나 새 말이 오면 저절로 닫힌다(다음 말에는 접힌 줄로).
 *  - 마치기(S8 = #167)는 이 방의 시트에서만 요청한다(D-9) — 성공하면 결과 화면으로 바꿔 간다. 요청은 동시에 하나(서버도 멱등).
 *  - 마친 역할극에 말이 거절되면(409 ROLEPLAY_ENDED) #29 를 다시 읽어 마친 뒤 바로 바꾼다.
 * 엔진·모델 이름은 다루지 않는다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import { actionErrorText } from '@/components/chat/labels'
import type { ChatDetail, ChatInfo, ChatMessageView, RolePlayChatView, RolePlayProgress, RolePlayResultView, TurnDoneEvent } from '@/types/chat'
import { autoCollapseStep, createSingleFlight, endBlockedReason, finishFailureOf, learnerTurns, mergeProgress, practiceTargetOf, progressNews, withRo } from './logic'
import { practiceModeOf, PRACTICE_MODES, type PracticeFailure, type PracticeMode } from './practiceLogic'
import { END, PRACTICE, ROOM, ROOM_STORE, rolePlayResultHref, rolePlayResultStoreKey, SCENARIO_HOME_HREF } from './scenarioCopy'
import { useKeyedSound } from './useKeyedSound'
import { usePractice } from './usePractice'

/** 목표 카드 바깥 상자 id — 자동 접힘 때 카드 안에 초점이 있는지 본다(방 하나에 카드 하나). */
export const GOAL_CARD_ID = 'rp-goal-card'

export type EndSheetPhase = 'confirm' | 'empty' | 'busy' | 'fail' | 'quitting'
type Panel = { k: 'goal' } | { k: 'practice'; id: string } | null

export interface RolePlayDeps {
  chatId: string
  chat: ChatInfo | null
  messages: ChatMessageView[]
  /** 방 화면 상태(`deriveTalkState`) — 대답 연습은 IDLE·SPEAKING 에서만 보인다. */
  talkState: string
  turnBusy: boolean
  listening: boolean
  /** 녹음 중이면 끝난 뒤로 미루는 방 토스트. */
  notify: (msg: string, ms?: number) => void
  /** 화면에 띄우지 않는 스크린리더 한 줄(녹음 중이면 끝난 뒤). */
  srAnnounce: (msg: string) => void
  /** 방 재생(선생님 말)이 소리를 내는 중 — 연습 소리를 멈춘다(한 번에 하나). */
  roomSounding: boolean
  stopRoom: () => void
}

function storedMode(): PracticeMode {
  const s = readStore('session', ROOM_STORE.practiceMode)
  return (PRACTICE_MODES as readonly string[]).includes(s ?? '') ? (s as PracticeMode) : 'choose'
}

export function useRolePlay(d: RolePlayDeps) {
  const { chatId, chat, messages, notify, srAnnounce, stopRoom } = d
  const router = useRouter()
  const [fresh, setFresh] = useState<RolePlayChatView | null>(null)
  const view: RolePlayChatView | null = fresh ?? chat?.scenario ?? null
  const active = !!view
  const ended = !!view?.ended

  /* ── 진행 값(최댓값 규칙) ── */
  const [extra, setExtra] = useState<RolePlayProgress | null>(null)
  const progress = useMemo<RolePlayProgress>(() => (view ? mergeProgress(view.progress, extra, view.keyExpressions) : { usedIds: [], stepIndex: null }), [view, extra])
  const progressRef = useRef(progress)
  const viewRef = useRef(view)
  useEffect(() => {
    progressRef.current = progress
    viewRef.current = view
  }, [progress, view])

  const onDone = useCallback(
    (dn: TurnDoneEvent) => {
      const v = viewRef.current
      if (!v || !dn.scenario) return
      const prev = progressRef.current
      const next = mergeProgress(prev, dn.scenario, v.keyExpressions)
      progressRef.current = next
      setExtra(next)
      // 방의 스크린리더 칸은 한 줄이라 여러 소식은 한 번에 붙여 낸다(따로 내면 마지막 줄만 남는다).
      const news = progressNews(prev, next, v)
      if (news.length) srAnnounce(news.join(' '))
    },
    [srAnnounce],
  )

  /* ── 다시 읽기(409 ROLEPLAY_ENDED·연습 ENDED) ── */
  const reload = useCallback(async () => {
    try {
      const r = await apiGet<ChatDetail>(`/api/v1/chats/${encodeURIComponent(chatId)}?limit=1`)
      if (r.chat.scenario) setFresh(r.chat.scenario)
    } catch {
      /* 다음 조회 때 맞춰진다 */
    }
  }, [chatId])

  /* ── 펼침(목표 카드 ↔ 대답 연습) ── */
  const turns = learnerTurns(messages)
  const [panel, setPanel] = useState<Panel>(null)
  const [initFor, setInitFor] = useState<string | null>(null)
  if (view && initFor !== view.id) {
    setInitFor(view.id)
    setPanel(turns === 0 && !view.ended ? { k: 'goal' } : null)
  }
  const panelRef = useRef<Panel>(panel)
  const userOpenedRef = useRef(false)
  const autoDoneRef = useRef(false)
  useEffect(() => {
    panelRef.current = panel
  }, [panel])
  useEffect(() => {
    const focusInside = !!document.getElementById(GOAL_CARD_ID)?.contains(document.activeElement)
    const step = autoCollapseStep(autoDoneRef.current, { active, turns, userOpened: userOpenedRef.current, goalOpen: panelRef.current?.k === 'goal', focusInside })
    autoDoneRef.current = step.done
    if (step.collapse) setPanel(null)
  }, [active, turns])

  const toggleGoal = useCallback(() => {
    if (panelRef.current?.k === 'goal') setPanel(null)
    else {
      userOpenedRef.current = true
      setPanel({ k: 'goal' })
    }
  }, [])

  const [checksHidden, setChecksHidden] = useState(() => readStore('session', ROOM_STORE.checksHidden) === '1')
  const toggleChecks = useCallback(() => {
    const next = !checksHidden
    writeStore('session', ROOM_STORE.checksHidden, next ? '1' : null)
    setChecksHidden(next)
  }, [checksHidden])

  /* ── 대답 연습 ── */
  const target = active && !ended ? practiceTargetOf(messages) : null
  const practiceShown = !!target && (d.talkState === 'IDLE' || d.talkState === 'SPEAKING')
  const practiceOpen = practiceShown && panel?.k === 'practice' && panel.id === target
  const sound = useKeyedSound()
  const { stop: stopSound, tap: tapSound } = sound
  const onPracticeFailure = useCallback(
    (f: PracticeFailure) => {
      if (f.kind !== 'stale' && f.kind !== 'ended') return
      setPanel((p) => (p?.k === 'practice' ? null : p))
      if (f.kind === 'stale') notify(PRACTICE.stale)
      else void reload()
    },
    [notify, reload],
  )
  const { state: practiceState, load: loadPractice, cancel: cancelPractice } = usePractice(chatId, target, onPracticeFailure)
  const [mode, setModeState] = useState<PracticeMode>(storedMode)
  const readyView = practiceState.phase === 'ready' ? practiceState.view : null
  const practiceMode: PracticeMode = readyView ? practiceModeOf(mode, !!readyView.choose) : mode
  const setPracticeMode = useCallback((m: PracticeMode) => {
    setModeState(m)
    writeStore('session', ROOM_STORE.practiceMode, m)
  }, [])

  const openPractice = useCallback(() => {
    if (!target) return
    setPanel({ k: 'practice', id: target })
    loadPractice(target)
  }, [target, loadPractice])
  const closePractice = useCallback(() => {
    setPanel((p) => (p?.k === 'practice' ? null : p))
    cancelPractice()
  }, [cancelPractice])

  useEffect(() => {
    if (!practiceOpen || d.roomSounding) stopSound()
  }, [practiceOpen, d.roomSounding, stopSound])
  const playPractice = useCallback(
    (key: string, ja: string) => {
      stopRoom()
      tapSound(key, ja)
    },
    [stopRoom, tapSound],
  )

  /* ── 마치기 ── */
  const [sheet, setSheet] = useState<{ open: boolean; phase: EndSheetPhase }>({ open: false, phase: 'confirm' })
  const [flight] = useState(createSingleFlight)
  const blocked = endBlockedReason({ ready: !!chat, listening: d.listening, turnBusy: d.turnBusy })

  const openEnd = useCallback(() => {
    if (blocked) {
      notify(blocked)
      return
    }
    setPanel((p) => (p?.k === 'practice' ? null : p))
    setSheet({ open: true, phase: turns > 0 ? 'confirm' : 'empty' })
  }, [blocked, notify, turns])

  const finish = useCallback(async () => {
    // 성공하면 잠근 채 이동한다 — 결과 화면으로 넘어가는 동안 "정리 중"을 유지하고 두 번째 요청을 내지 않는다(서버도 멱등).
    const r = await flight.run(() => {
      setSheet({ open: true, phase: 'busy' })
      return apiPost<RolePlayResultView>(`/api/v1/chats/${encodeURIComponent(chatId)}/scenario/finish`)
    }, true)
    if (!r.ran) return
    if (r.ok) {
      writeStore('session', rolePlayResultStoreKey(chatId), JSON.stringify(r.value))
      router.replace(rolePlayResultHref(chatId))
      return
    }
    const f = finishFailureOf(toErr(r.error))
    if (f === 'noTurns') setSheet({ open: true, phase: 'empty' })
    else if (f === 'busy') {
      setSheet({ open: false, phase: 'confirm' })
      notify(ROOM.endWhileTurn)
    } else setSheet({ open: true, phase: 'fail' })
  }, [chatId, flight, notify, router])

  /** 마무리 띠 [마치고 결과 보기] — 확인 단계를 건너뛰고 바로 기록. */
  const finishNow = useCallback(() => {
    if (blocked) notify(blocked)
    else void finish()
  }, [blocked, finish, notify])

  const closeEnd = useCallback(() => {
    if (flight.isBusy()) return
    setSheet((s) => ({ open: false, phase: s.phase }))
  }, [flight])

  /** 0턴 [그만두기](D-7) — 빈 대화를 #31 로 지우고 시나리오로. 이미 없으면(404) 그대로 나간다. */
  const quit = useCallback(async () => {
    const r = await flight.run(() => {
      setSheet({ open: true, phase: 'quitting' })
      return apiDelete(`/api/v1/chats/${encodeURIComponent(chatId)}`)
    }, true)
    if (!r.ran) return
    if (r.ok) {
      notify(END.quitDone)
      router.replace(SCENARIO_HOME_HREF)
      return
    }
    const err = toErr(r.error)
    if (err.status === 404) {
      router.replace(SCENARIO_HOME_HREF)
      return
    }
    setSheet({ open: true, phase: 'empty' })
    notify(err.status === 0 ? actionErrorText(err) : END.quitFail)
  }, [chatId, flight, notify, router])

  /** 마친 뒤 [결과 보기] — 이미 받은 결과를 첫 그림용으로 넣어 두고 이동. */
  const openResult = useCallback(() => {
    if (view?.ended) writeStore('session', rolePlayResultStoreKey(chatId), JSON.stringify(view.ended))
    router.push(rolePlayResultHref(chatId))
  }, [chatId, router, view])

  return {
    active,
    ended,
    view,
    progress,
    turns,
    /* 목표 카드 */
    goalOpen: panel?.k === 'goal',
    toggleGoal,
    checksHidden,
    toggleChecks,
    /* 대답 연습 */
    practiceShown,
    practiceOpen,
    practiceState,
    practiceMode,
    setPracticeMode,
    openPractice,
    closePractice,
    sound,
    playPractice,
    stopSound,
    /* 마치기 */
    openEnd,
    sheet,
    closeEnd,
    finish,
    finishNow,
    quit,
    /* 턴·결과 */
    onDone,
    reload,
    openResult,
    /** 글자 모드 입력창 안내 — 역할극이면 내 역할로. */
    placeholder: view ? ROOM.textPlaceholder(withRo(view.roles.learner)) : null,
    /** 머리 prop(역할 태그·[마치기]·← 시나리오로). 일반 회화면 빈 묶음 — 머리가 지금과 같다. */
    header: view
      ? {
          roleTag: { text: ROOM.roleTag(view.roles.tutor), sr: ROOM.srTitle(view.title) },
          endAction: view.ended ? undefined : { label: ROOM.end, disabled: !!blocked, onClick: openEnd },
          back: { href: SCENARIO_HOME_HREF, label: ROOM.back },
        }
      : {},
  }
}

export type RolePlay = ReturnType<typeof useRolePlay>
