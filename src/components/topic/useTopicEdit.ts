'use client'

/**
 * 주제 고치기(S7) 상태(screens.md §16-2 S7·§16-4). 주제 상세 API 가 없어 #56(`level=all`)에서 id 로 찾고, 출처는 #179(`kind=TOPIC`) 사본 id 로 정한다(`topicOrigin`).
 * - 저장: 내 주제·내 버전 → #171(바뀐 칸만, 표현을 보내면 전체 목록 — 원래 표현은 서버 id 그대로) · 기본 주제 → #174(전체 값, 사본 id 의 S6 으로).
 *   바뀐 게 없으면 서버를 부르지 않고 S6 으로. 경로·본문·검사·결과 해석은 `logic.ts` 순수 함수(`runTopicEditSave`·`topicEditFailView`), 더블 탭은 `createOnceGuard`.
 * - D4-A: 수준을 바꾸면 #170(`{지금 이름, 새 수준}`)으로 **표현만** 다시 받아 편집 값만 바꾼다(저장 전 서버 쓰기 0). 요청 흐름은 주제 만들기와 같은 `createTopicDraftFlight`.
 * - 초안 보관(sessionStorage)은 하지 않는다(§16-4 — 주제 만들기 초안에만). 오류 문구는 `failure.ts` 고정 문구(서버 `message` 는 쓰지 않는다).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toErr } from '@/components/common/errors'
import { writeStore } from '@/components/common/storage'
import type { JlptLevel } from '@/types/lesson'
import { draftTopic, forkTopic, getManageTopics, getSeedOverrides, updateTopic } from './api'
import { failureCopy, type Failure } from './failure'
import {
  copyIdSet,
  createOnceGuard,
  createTopicDraftFlight,
  editFlash,
  isTopicEdited,
  levelRegenBody,
  levelRegenPrompt,
  MANAGE_FLASH_KEY,
  MANAGE_HREF,
  regenArrival,
  regenWarnLines,
  retryFailHoldMs,
  runTopicEditSave,
  seedCopyId,
  topicEditFailView,
  topicEditFrom,
  topicEditPatch,
  topicEditRoute,
  topicHref,
  topicOrigin,
  validateTopicEdit,
  TOPIC_DRAFT_IDLE,
  type EditableTopicDraft,
  type Origin,
  type TopicDraftFlightState,
  type TopicDraftOutcome,
  type TopicProblem,
  type WarnLine,
} from './logic'

export type TopicEditStatus = 'loading' | 'ready' | 'error' | 'notFound'
/** 화면이 초점을 옮길 곳 — 숫자가 바뀔 때마다 한 번. */
export type EditFocus = { n: number; to: 'problem' | 'regenBusy' | 'regenFail' | 'regenPrompt' | 'level' | 'copied' }

type Loaded = { orig: EditableTopicDraft; origin: Origin }

export interface TopicEditModel {
  status: TopicEditStatus
  reload: () => void
  /** 화면 머리(← 이름표)용 — 원본 이름. */
  origTitle: string
  /** 서버 표현 id → 서버가 준 원래 일본어 글(행 고치기의 「글을 바꾸면 연습 기록이 처음부터」 안내용). */
  origTexts: ReadonlyMap<string, string>
  origin: Origin | null
  draft: EditableTopicDraft | null
  setDraft: (fn: (d: EditableTopicDraft) => EditableTopicDraft) => void
  edited: boolean
  problems: TopicProblem[]
  saving: boolean
  saveMessage: { text: string; block: boolean } | null
  /** 409 `ALREADY_COPIED` — 다른 화면이 먼저 내 버전을 만들었다(저장 막음, [내 버전 열기]). */
  copied: boolean
  openingCopy: boolean
  save: () => void
  openCopy: () => void
  regenPrompt: { from: JlptLevel; to: JlptLevel } | null
  regenFlight: TopicDraftFlightState
  regenFailure: Failure | null
  regenWarn: WarnLine[]
  regen: () => void
  keepChunks: () => void
  cancelRegen: () => void
  focus: EditFocus
  leave: () => void
}

export function useTopicEdit(id: string): TopicEditModel {
  const router = useRouter()
  const [status, setStatus] = useState<TopicEditStatus>('loading')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [draft, setDraftState] = useState<EditableTopicDraft | null>(null)
  const [forceSeed, setForceSeed] = useState(false)
  const [tried, setTried] = useState(false)
  const [server, setServer] = useState<TopicProblem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ text: string; block: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [openingCopy, setOpeningCopy] = useState(false)
  // 지금 표현이 어느 수준으로 만들어졌는지(처음 = 원본 수준, 다시 받으면 그 수준)와 [지금 표현 두기]로 넘긴 수준.
  const [chunksLevel, setChunksLevel] = useState<JlptLevel | null>(null)
  const [keptLevel, setKeptLevel] = useState<JlptLevel | null>(null)
  const [regenFlight, setRegenFlight] = useState<TopicDraftFlightState>(TOPIC_DRAFT_IDLE)
  const [regenFail, setRegenFail] = useState<{ level: JlptLevel; failure: Failure } | null>(null)
  const [regenWarn, setRegenWarn] = useState<WarnLine[]>([])
  const [focus, setFocus] = useState<EditFocus>({ n: 0, to: 'level' })
  const requestFocus = useCallback((to: EditFocus['to']) => setFocus((f) => ({ n: f.n + 1, to })), [])
  const seq = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 다시 받은 표현이 도착했을 때 그 순간의 편집 값(이름·설명·수준은 그대로 두고 표현만 바꾼다).
  const draftRef = useRef<EditableTopicDraft | null>(null)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // holdFrom: 오류 상자 [다시 시도] 를 누른 시각 — 바로 다시 실패해도 자리표시가 최소 표시 시간(500ms)은 보이도록 실패 반영만 미룬다(성공은 기다리지 않음, 관리 화면과 같은 규칙).
  const load = useCallback(
    (holdFrom?: number) => {
      const my = ++seq.current
      void Promise.all([getManageTopics(), getSeedOverrides('TOPIC')]).then(
        ([topics, overrides]) => {
          if (my !== seq.current) return
          const t = topics.find((x) => x.id === id)
          if (!t) return setStatus('notFound')
          const orig = topicEditFrom(t)
          setLoaded({ orig, origin: topicOrigin(t, copyIdSet(overrides, 'TOPIC')) })
          setDraftState(orig)
          setChunksLevel(orig.level)
          setStatus('ready')
        },
        () => {
          const apply = () => {
            if (my === seq.current) setStatus('error')
          }
          const hold = holdFrom === undefined ? 0 : retryFailHoldMs(true, holdFrom, Date.now())
          if (hold > 0) {
            if (holdTimer.current) clearTimeout(holdTimer.current)
            holdTimer.current = setTimeout(apply, hold)
          } else apply()
        },
      )
    },
    [id],
  )

  useEffect(() => {
    load()
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    }
  }, [load])

  const reload = useCallback(() => {
    setStatus('loading')
    load(Date.now())
  }, [load])

  // 화면 수명 동안 하나씩 — 상태 초기화 함수로 한 번만 만든다(렌더 중 ref 를 읽지 않게).
  const [flightCtl] = useState(() => createTopicDraftFlight({ post: (body, signal) => draftTopic(body, { signal }), onState: setRegenFlight }))
  const [saveGuard] = useState(createOnceGuard)
  const [copyGuard] = useState(createOnceGuard)
  useEffect(() => () => flightCtl.dispose(), [flightCtl])

  const origTexts = useMemo(() => new Map((loaded?.orig.chunks ?? []).flatMap((c) => (c.id ? [[c.id, c.textJa] as [string, string]] : []))), [loaded])

  const origin: Origin | null = loaded ? (forceSeed ? 'SEED' : loaded.origin) : null
  const route = origin ? topicEditRoute(origin) : 'patch'

  const setDraft = useCallback((fn: (d: EditableTopicDraft) => EditableTopicDraft) => {
    setServer([])
    setSaveMessage((m) => (m?.block ? m : null))
    setDraftState((cur) => (cur ? fn(cur) : cur))
  }, [])

  const edited = !!(loaded && draft && isTopicEdited(loaded.orig, draft))

  const problems = useMemo(() => {
    if (!loaded || !draft) return []
    const client = tried ? validateTopicEdit(draft, route, topicEditPatch(loaded.orig, draft)) : []
    const keys = new Set(client.map((p) => p.key))
    return [...client, ...server.filter((p) => !keys.has(p.key))]
  }, [tried, loaded, draft, route, server])

  const save = useCallback(() => {
    if (!loaded || !draft || saving || copied || regenFlight.busy || saveMessage?.block) return
    const input = { id, route, orig: loaded.orig, cur: draft }
    saveGuard.run(async () => {
      setSaving(true)
      setSaveMessage(null)
      const o = await runTopicEditSave(input, { patch: updateTopic, fork: forkTopic })
      if (o.kind === 'unchanged') {
        router.replace(topicHref(id, origin), { scroll: false })
        return
      }
      if (o.kind === 'saved') {
        writeStore('session', MANAGE_FLASH_KEY, JSON.stringify(editFlash(o.route)))
        router.replace(o.id ? topicHref(o.id, o.route === 'fork' ? 'COPY' : origin) : MANAGE_HREF, { scroll: false })
        return
      }
      setSaving(false)
      if (o.kind === 'invalid') {
        setTried(true)
        setServer([])
        requestFocus('problem')
        return
      }
      const v = topicEditFailView(o.failure, input.cur)
      if (v.notFound) return setStatus('notFound')
      if (v.copied) {
        setCopied(true)
        requestFocus('copied')
        return
      }
      if (v.forceSeed) setForceSeed(true)
      if (v.problems.length) {
        setTried(true)
        setServer(v.problems)
        requestFocus('problem')
      }
      setSaveMessage(v.message)
    })
  }, [loaded, draft, saving, copied, regenFlight.busy, saveMessage, id, route, origin, saveGuard, router, requestFocus])

  const openCopy = useCallback(() => {
    copyGuard.run(async () => {
      setOpeningCopy(true)
      try {
        const copyId = seedCopyId(await getSeedOverrides('TOPIC'), id)
        router.replace(copyId ? topicHref(copyId, 'COPY') : MANAGE_HREF, { scroll: false })
      } catch (e) {
        setOpeningCopy(false)
        setSaveMessage({ text: failureCopy('topicFork', toErr(e)).text, block: false })
      }
    })
  }, [copyGuard, id, router])

  const regenPrompt = loaded && draft && chunksLevel ? levelRegenPrompt(chunksLevel, draft.level, keptLevel) : null

  // 실패는 그 수준에 묶는다 — 수준을 다시 바꾸면 새 상자는 묻기부터(하루 한도처럼 버튼을 막는 실패만 수준과 상관없이 남는다).
  const regenFailure = regenFail && draft && (regenFail.failure.block || regenFail.level === draft.level) ? regenFail.failure : null

  const regen = useCallback(() => {
    if (!draft || saving || regenFailure?.block) return
    const level = draft.level
    const body = levelRegenBody(draft)
    if (!body) {
      setRegenFail({ level, failure: failureCopy('topicDraft', { status: 400, message: '', code: null, details: { field: 'title', reason: 'required' }, retryAfterSec: null }) })
      requestFocus('regenFail')
      return
    }
    const onDone = (o: TopicDraftOutcome) => {
      const cur = draftRef.current
      if (o.kind === 'ok' && cur) {
        // 서버 쓰기 없음 — 받은 표현은 편집 값만 바꾼다(저장은 [저장]). 경합 순서는 `regenArrival` 규칙.
        const arrived = regenArrival(cur, { title: body.title, level }, o.draft.chunks)
        if (!arrived) return requestFocus('regenPrompt')
        setDraftState(arrived.draft)
        setServer([])
        setChunksLevel(arrived.chunksLevel)
        setKeptLevel(null)
        setRegenWarn(regenWarnLines(o.warnings, arrived.draft))
        requestFocus('level')
        return
      }
      if (o.kind === 'fail') {
        setRegenFail({ level, failure: o.failure })
        requestFocus('regenFail')
        return
      }
      requestFocus('regenPrompt')
    }
    if (!flightCtl.start(body, onDone)) return
    setRegenFail(null)
    requestFocus('regenBusy')
  }, [draft, saving, regenFailure, flightCtl, requestFocus])

  const keepChunks = useCallback(() => {
    if (!draft || saving || regenFlight.busy) return
    setKeptLevel(draft.level)
    setRegenFail((f) => (f?.failure.block ? f : null))
    requestFocus('level')
  }, [draft, saving, regenFlight.busy, requestFocus])

  const cancelRegen = useCallback(() => flightCtl.cancel(), [flightCtl])

  // 다른 경로(주제 보기)로 가는 이동이라 기본 스크롤을 둔다(R5) — 고친 값은 남기지 않는다.
  const leave = useCallback(() => {
    flightCtl.dispose()
    router.push(topicHref(id, origin))
  }, [flightCtl, router, id, origin])

  return {
    status,
    reload,
    origTitle: loaded?.orig.title ?? '',
    origTexts,
    origin,
    draft,
    setDraft,
    edited,
    problems,
    saving,
    saveMessage,
    copied,
    openingCopy,
    save,
    openCopy,
    regenPrompt,
    regenFlight,
    regenFailure,
    regenWarn,
    regen,
    keepChunks,
    cancelRegen,
    focus,
    leave,
  }
}
