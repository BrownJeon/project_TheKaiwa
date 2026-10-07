'use client'

/**
 * 주제 만들기 상태(screens.md §16-2 S3·S4, §16-4) — 단계 `ask → generating → review → saving`(T5-3b 가 상황 초안·`partial` 을 더한다).
 * - #170 초안은 행이 없다. 고친 뒤 [주제 저장] = #57(주제 + 기본 표현 한 트랜잭션) → 새 주제 보기로 `replace` + 돌아왔을 때 토스트.
 * - 요청 흐름(한 번에 하나·취소 잠금·15초·60초)은 `logic.createTopicDraftFlight`, 저장 더블 탭은 `logic.createOnceGuard` — 이 훅은 상태만 잇는다.
 * - 묻기·초안은 이 탭 sessionStorage `kaiwa.topic.draft` 에만 자동 보관(300ms 디바운스, 화면이 하이드레이션 뒤에만 이 훅을 쓴다).
 *   저장 성공·버리기에서 지운다. 보관 값은 입력·초안 본문뿐이다(토큰·서버 문구 없음).
 * - 오류 문구는 `failure.ts` 고정 문구(서버 `message` 는 쓰지 않는다).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import { createTopic, draftTopic } from './api'
import { failureCopy, type Failure } from './failure'
import {
  createOnceGuard,
  createTopicDraftFlight,
  isBlankTopicStore,
  MANAGE_FLASH_KEY,
  MANAGE_HREF,
  readTopicStore,
  serializeTopicStore,
  serverTopicProblems,
  topicAskBody,
  topicAskProblem,
  topicCreateBody,
  topicHref,
  topicWarnLines,
  TOPIC_DRAFT_IDLE,
  TOPIC_DRAFT_STORE_KEY,
  validateTopicDraft,
  type EditableTopicDraft,
  type ManageFlash,
  type StoredTopicDraft,
  type TopicAsk,
  type TopicDraftFlightState,
  type TopicDraftOutcome,
  type TopicProblem,
  type WarnLine,
} from './logic'
import { FAIL } from './topicCopy'
import type { DraftLevel } from '@/components/scenario/logic'
import type { TopicWarningCode } from '@/types/topicWrite'

const SAVE_DEBOUNCE_MS = 300

export type TopicDraftStage = 'ask' | 'generating' | 'review' | 'saving'
/** 화면이 초점을 옮길 곳 — 숫자가 바뀔 때마다 한 번. */
export type FocusRequest = { n: number; to: 'problem' | 'ask' | 'failure' | 'arrived' }

export interface TopicDraftModel {
  stage: TopicDraftStage
  ask: TopicAsk
  setAsk: (patch: Partial<TopicAsk>) => void
  askError: string | null
  genFailure: Failure | null
  /** 그만두기 직후 안내(입력을 고치거나 다시 만들면 사라진다). */
  canceled: boolean
  flight: TopicDraftFlightState
  generate: () => void
  cancelGenerate: () => void
  restore: StoredTopicDraft | null
  acceptRestore: () => void
  dropRestore: () => void
  draft: EditableTopicDraft | null
  setDraft: (fn: (d: EditableTopicDraft) => EditableTopicDraft) => void
  edited: boolean
  warnLines: WarnLine[]
  arrivalTitle: string
  problems: TopicProblem[]
  saveMessage: { text: string; block: boolean } | null
  save: () => void
  focus: FocusRequest
  /** BackBar ← 의 [나가기] — 초안은 이 탭에 남긴다. */
  leave: () => void
  discard: () => void
}

export function useTopicDraft(defaultLevel: DraftLevel, userId: string): TopicDraftModel {
  const router = useRouter()
  // 보관 값이 지금 사용자 것이 아니면(다른 계정·옛 형식·손상) 읽지 않고 지운다 — 같은 탭에서 계정을 바꿔도 남의 초안이 이어 고치기 카드로 보이지 않게(REV-162 M-1).
  const [stored] = useState<StoredTopicDraft | null>(() => {
    const r = readTopicStore(readStore('session', TOPIC_DRAFT_STORE_KEY), userId)
    if (r.discard) writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
    return r.store
  })
  const [restore, setRestore] = useState<StoredTopicDraft | null>(() => (stored?.draft ? stored : null))
  const [ask, setAskState] = useState<TopicAsk>(() => stored?.ask ?? { title: '', level: defaultLevel })
  const [askError, setAskError] = useState<string | null>(null)
  const [genFailure, setGenFailure] = useState<Failure | null>(null)
  const [canceled, setCanceled] = useState(false)
  const [flight, setFlight] = useState<TopicDraftFlightState>(TOPIC_DRAFT_IDLE)
  const [stage, setStage] = useState<TopicDraftStage>('ask')
  const [draft, setDraftState] = useState<EditableTopicDraft | null>(null)
  const [warnings, setWarnings] = useState<TopicWarningCode[]>([])
  const [warnLines, setWarnLines] = useState<WarnLine[]>([])
  const [arrivalTitle, setArrivalTitle] = useState('')
  const [edited, setEdited] = useState(false)
  const [tried, setTried] = useState(false)
  const [server, setServer] = useState<TopicProblem[]>([])
  const [saveMessage, setSaveMessage] = useState<{ text: string; block: boolean } | null>(null)
  const [focus, setFocus] = useState<FocusRequest>({ n: 0, to: 'arrived' })
  const requestFocus = useCallback((to: FocusRequest['to']) => setFocus((f) => ({ n: f.n + 1, to })), [])

  const draftRef = useRef<EditableTopicDraft | null>(null)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // 화면 수명 동안 하나씩 — 상태 초기화 함수로 한 번만 만든다(렌더 중 ref 를 읽지 않게).
  const [flightCtl] = useState(() => createTopicDraftFlight({ post: (body, signal) => draftTopic(body, { signal }), onState: setFlight }))
  const [saveGuard] = useState(createOnceGuard)

  // 자동 보관 — 이어 고칠지 묻는 동안(restore)은 남은 초안을 덮어쓰지 않고, 보관을 끝낸 뒤(저장·버리기)에는 다시 쓰지 않는다.
  const storeClosed = useRef(false)
  const snapRef = useRef<Omit<StoredTopicDraft, 'version' | 'savedAt'> | null>(null)
  const flush = useCallback(() => {
    const snap = snapRef.current
    if (storeClosed.current || !snap) return
    writeStore('session', TOPIC_DRAFT_STORE_KEY, isBlankTopicStore(snap) ? null : serializeTopicStore({ ...snap, savedAt: Date.now() }))
  }, [])
  useEffect(() => {
    snapRef.current = restore ? null : { userId, ask, draft, warnings, arrivalTitle, edited }
    if (restore || storeClosed.current) return
    const t = setTimeout(flush, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [restore, userId, ask, draft, warnings, arrivalTitle, edited, flush])

  useEffect(
    () => () => {
      flightCtl.dispose()
      flush()
    },
    [flightCtl, flush],
  )

  const closeStore = useCallback(() => {
    storeClosed.current = true
    writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
  }, [])

  const setAsk = useCallback((patch: Partial<TopicAsk>) => {
    setAskState((a) => ({ ...a, ...patch }))
    setAskError(null)
    setCanceled(false)
    setGenFailure((f) => (f?.block ? f : null))
  }, [])

  const setDraft = useCallback((fn: (d: EditableTopicDraft) => EditableTopicDraft) => {
    setEdited(true)
    setServer([])
    setSaveMessage((m) => (m?.block ? m : null))
    setDraftState((cur) => (cur ? fn(cur) : cur))
  }, [])

  const arrive = useCallback((d: EditableTopicDraft, codes: TopicWarningCode[], title: string, wasEdited: boolean) => {
    setRestore(null)
    setDraftState(d)
    setWarnings(codes)
    setWarnLines(topicWarnLines(codes, d))
    setArrivalTitle(title)
    setEdited(wasEdited)
    setTried(false)
    setServer([])
    setSaveMessage(null)
    setGenFailure(null)
    setStage('review')
  }, [])

  const onDone = useCallback(
    (o: TopicDraftOutcome) => {
      if (o.kind === 'ok') {
        arrive(o.draft, o.warnings, o.draft.title, false)
        requestFocus('arrived')
        return
      }
      const hasDraft = !!draftRef.current
      setStage(hasDraft ? 'review' : 'ask')
      if (o.kind === 'canceled') {
        if (!hasDraft) setCanceled(true)
        return
      }
      const f = o.failure
      const askField = f.kind === 'unfit' || (f.kind === 'field' && f.problems[0]?.field === 'title')
      if (askField && !hasDraft) {
        setAskError(f.text)
        requestFocus('ask')
      } else {
        setGenFailure(f)
        if (hasDraft) requestFocus('failure')
      }
    },
    [arrive, requestFocus],
  )

  const generate = useCallback(() => {
    if (genFailure?.block) return
    const p = topicAskProblem(ask.title)
    if (p) {
      setAskError(p)
      requestFocus('ask')
      return
    }
    if (!flightCtl.start(topicAskBody(ask), onDone)) return
    setStage('generating')
    setGenFailure(null)
    setAskError(null)
    setCanceled(false)
  }, [ask, genFailure, onDone, requestFocus, flightCtl])

  const cancelGenerate = useCallback(() => flightCtl.cancel(), [flightCtl])

  const acceptRestore = useCallback(() => {
    if (!restore?.draft || flight.busy) return
    setAskState(restore.ask)
    arrive(restore.draft, restore.warnings, restore.arrivalTitle || restore.draft.title, restore.edited)
    requestFocus('arrived')
  }, [restore, flight.busy, arrive, requestFocus])

  const dropRestore = useCallback(() => {
    writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
    setRestore(null)
    setAskState({ title: '', level: defaultLevel })
    setDraftState(null)
    setEdited(false)
  }, [defaultLevel])

  const problems = useMemo(() => {
    const client = tried && draft ? validateTopicDraft(draft) : []
    const keys = new Set(client.map((p) => p.key))
    return [...client, ...server.filter((p) => !keys.has(p.key))]
  }, [tried, draft, server])

  const save = useCallback(() => {
    const d = draft
    if (!d || stage !== 'review' || saveMessage?.block) return
    const found = validateTopicDraft(d)
    if (found.length) {
      setTried(true)
      setServer([])
      requestFocus('problem')
      return
    }
    saveGuard.run(async () => {
      setStage('saving')
      setSaveMessage(null)
      try {
        const res = await createTopic(topicCreateBody(d))
        closeStore()
        const id = res?.topic?.id
        const flash: ManageFlash = { kind: 'created', title: typeof res?.topic?.title === 'string' ? res.topic.title : d.title }
        writeStore('session', MANAGE_FLASH_KEY, JSON.stringify(flash))
        router.replace(typeof id === 'string' && id ? topicHref(id) : MANAGE_HREF, { scroll: false })
      } catch (e) {
        setStage('review')
        const f = failureCopy('topicSave', toErr(e), { chunkCount: d.chunks.length })
        if (f.kind === 'field') {
          const s = serverTopicProblems(f.problems, d)
          if (s.problems.length) {
            setTried(true)
            setServer(s.problems)
            requestFocus('problem')
          }
          if (s.defect || !s.problems.length) setSaveMessage({ text: FAIL.field.defect, block: false })
          return
        }
        setSaveMessage({ text: f.text, block: f.block })
      }
    })
  }, [draft, stage, saveMessage, closeStore, router, requestFocus, saveGuard])

  // 나가기·버리기는 다른 경로로 가는 이동이라(R5 「다른 경로로 이동 → 맨 위」) 기본 스크롤을 둔다 — `{ scroll: false }` 면 관리 화면이 검토 화면의
  // `main` 스크롤 위치에서 열린다. 저장 성공은 새 주제 보기가 머리 제목에 초점을 두어(돌아왔을 때 토스트) 맨 위가 보인다.
  const leave = useCallback(() => {
    flush()
    router.push(MANAGE_HREF)
  }, [flush, router])

  const discard = useCallback(() => {
    flightCtl.dispose()
    closeStore()
    router.replace(MANAGE_HREF)
  }, [closeStore, router, flightCtl])

  return {
    stage,
    ask,
    setAsk,
    askError,
    genFailure,
    canceled,
    flight,
    generate,
    cancelGenerate,
    // 새 초안을 만드는 동안에는 이어 고치기 상자를 숨긴다(실패·취소로 묻기 단계에 돌아오면 다시 보인다).
    restore: stage === 'ask' ? restore : null,
    acceptRestore,
    dropRestore,
    draft,
    setDraft,
    edited,
    warnLines,
    arrivalTitle,
    problems,
    saveMessage,
    save,
    focus,
    leave,
    discard,
  }
}
