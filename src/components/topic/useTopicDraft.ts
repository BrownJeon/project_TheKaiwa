'use client'

/**
 * 주제 만들기 상태(screens.md §16-2 S3~S5, §16-4) — 단계 `ask → generating → review → saving → partial`.
 * - #170 초안은 행이 없다. 고친 뒤 [저장] = #57(주제 + 기본 표현 한 트랜잭션) → 받은 id 로 체크한 상황을 #163 하나씩(`logic.runTopicCreateSave`).
 *   전부 성공 → 새 주제 보기로 `replace` + 토스트. 상황만 실패 → `partial`(주제는 그대로, [상황 다시 저장]은 주제를 다시 만들지 않는다).
 * - 상황 초안(#166, 인라인 `topic`)은 주제 초안 도착 이벤트마다 자동 한 번(`createScenarioDraftFlight.autoOnce`) + [하나 더] 한 번(최대 2, 병렬 금지).
 * - 요청 흐름(한 번에 하나·취소 잠금·15초·60초)은 `logic.createTopicDraftFlight`, 저장 더블 탭은 `logic.createOnceGuard` — 이 훅은 상태만 잇는다.
 * - 묻기·초안은 이 탭 sessionStorage `kaiwa.topic.draft` 에만 자동 보관(300ms 디바운스, 화면이 하이드레이션 뒤에만 이 훅을 쓴다).
 *   저장 성공·버리기에서 지운다. 보관 값은 입력·초안 본문뿐이다(토큰·서버 문구 없음).
 * - 오류 문구는 `failure.ts` 고정 문구(서버 `message` 는 쓰지 않는다).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import { oneLine, validateDraft, type DraftProblem, type EditableDraft } from '@/components/scenario/logic'
import { createScenario, createTopic, draftScenario, draftTopic } from './api'
import type { Failure } from './failure'
import {
  createOnceGuard,
  createScenarioDraftFlight,
  createTopicDraftFlight,
  nextScenarioSlotKey,
  partialView,
  runTopicCreateSave,
  scenarioDraftBody,
  scenarioMoreProblem,
  scenarioPick,
  scenarioSeedDescription,
  scenarioSlotProblems,
  scenariosToSave,
  slotServerProblems,
  toggleScenarioKeep,
  type PartialView,
  type ScenarioDraftOutcome,
  type ScenarioSaveFail,
  type ScenarioSlot,
  type ScenarioSlotKey,
  type TopicCreateSaveProgress,
  isBlankTopicStore,
  MANAGE_FLASH_KEY,
  MANAGE_HREF,
  readTopicStore,
  serializeTopicStore,
  serverTopicProblems,
  topicAskBody,
  topicAskProblem,
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
import type { ScenarioDraftForTopicBody } from './api'
import { FAIL, SCDRAFT } from './topicCopy'
import type { DraftLevel } from '@/components/scenario/logic'
import type { TopicWarningCode } from '@/types/topicWrite'

const SAVE_DEBOUNCE_MS = 300

export type TopicDraftStage = 'ask' | 'generating' | 'review' | 'saving' | 'partial'
/** 화면이 초점을 옮길 곳 — 숫자가 바뀔 때마다 한 번. */
export type FocusRequest = { n: number; to: 'problem' | 'ask' | 'failure' | 'arrived' | 'partial' }

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
  /* T5-3b 상황 초안 */
  scenarios: ScenarioSlot[]
  pick: { k: number; n: number }
  scFlight: TopicDraftFlightState
  scFailure: Failure | null
  /** 체크한 카드마다 문제(저장 시도 뒤 검사 + 서버 400). */
  scProblems: Map<ScenarioSlotKey, DraftProblem[]>
  toggleKeep: (key: ScenarioSlotKey, keep: boolean) => void
  setScenarioDraft: (key: ScenarioSlotKey, fn: (d: EditableDraft) => EditableDraft) => void
  /** [하나 더] — 입력 문제면 그 문구, 아니면 null(보냈거나 보낼 수 없음). */
  requestMore: (desc: string) => string | null
  retryScenario: () => void
  cancelScenario: () => void
  /** 주제는 저장됨 — 있으면 주제 칸은 읽기 전용. */
  savedTopicId: string | null
  partial: PartialView | null
  progress: TopicCreateSaveProgress | null
  /** `partial` 의 [주제 보기로] — 남은 초안은 버리고 새 주제 보기로. */
  goToTopic: () => void
}

export function useTopicDraft(defaultLevel: DraftLevel, userId: string): TopicDraftModel {
  const router = useRouter()
  // 보관 값이 지금 사용자 것이 아니면(다른 계정·옛 형식·손상) 읽지 않고 지운다 — 같은 탭에서 계정을 바꿔도 남의 초안이 이어 고치기 카드로 보이지 않게(REV-162 M-1).
  const [stored] = useState<StoredTopicDraft | null>(() => {
    const r = readTopicStore(readStore('session', TOPIC_DRAFT_STORE_KEY), userId)
    if (r.discard) writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
    return r.store
  })
  // 주제를 이미 저장했으면(상황 일부만 실패) 이어 고칠지 묻지 않고 `partial` 로 연다 — 주제를 다시 만들지 않는다.
  const [resumed] = useState<StoredTopicDraft | null>(() => (stored?.draft && stored.savedTopicId ? stored : null))
  const [restore, setRestore] = useState<StoredTopicDraft | null>(() => (stored?.draft && !stored.savedTopicId ? stored : null))
  const [ask, setAskState] = useState<TopicAsk>(() => stored?.ask ?? { title: '', level: defaultLevel })
  const [askError, setAskError] = useState<string | null>(null)
  const [genFailure, setGenFailure] = useState<Failure | null>(null)
  const [canceled, setCanceled] = useState(false)
  const [flight, setFlight] = useState<TopicDraftFlightState>(TOPIC_DRAFT_IDLE)
  const [stage, setStage] = useState<TopicDraftStage>(resumed ? 'partial' : 'ask')
  const [draft, setDraftState] = useState<EditableTopicDraft | null>(resumed?.draft ?? null)
  const [warnings, setWarnings] = useState<TopicWarningCode[]>(resumed?.warnings ?? [])
  const [warnLines, setWarnLines] = useState<WarnLine[]>([])
  const [arrivalTitle, setArrivalTitle] = useState(resumed?.arrivalTitle ?? '')
  const [edited, setEdited] = useState(resumed?.edited ?? false)
  const [scenarios, setScenarios] = useState<ScenarioSlot[]>(resumed?.scenarios ?? [])
  const [savedTopicId, setSavedTopicId] = useState<string | null>(resumed?.savedTopicId ?? null)
  const [scAsked, setScAsked] = useState(resumed?.scAsked ?? false)
  const [scFlight, setScFlight] = useState<TopicDraftFlightState>(TOPIC_DRAFT_IDLE)
  const [scFailure, setScFailure] = useState<Failure | null>(null)
  const [scServer, setScServer] = useState<Partial<Record<ScenarioSlotKey, DraftProblem[]>>>({})
  const [scFails, setScFails] = useState<ScenarioSaveFail[]>([])
  const [progress, setProgress] = useState<TopicCreateSaveProgress | null>(null)
  // `partial` 을 한 번이라도 거쳤는지 — 첫 저장의 상황 단계(주제는 저장됨·상황 저장 중)를 `partial` 로 그리지 않게.
  const [wasPartial, setWasPartial] = useState(!!resumed)
  const [tried, setTried] = useState(false)
  const [server, setServer] = useState<TopicProblem[]>([])
  const [saveMessage, setSaveMessage] = useState<{ text: string; block: boolean } | null>(null)
  const [focus, setFocus] = useState<FocusRequest>({ n: 0, to: 'arrived' })
  const requestFocus = useCallback((to: FocusRequest['to']) => setFocus((f) => ({ n: f.n + 1, to })), [])

  const draftRef = useRef<EditableTopicDraft | null>(null)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  // 저장 흐름이 기다리는 동안 바뀐 값을 읽으려고(요청 사이 체크·저장 표시) 상태와 같이 둔다.
  const scenariosRef = useRef<ScenarioSlot[]>(scenarios)
  const savedTopicRef = useRef<string | null>(savedTopicId)
  useEffect(() => {
    scenariosRef.current = scenarios
  }, [scenarios])

  // 화면 수명 동안 하나씩 — 상태 초기화 함수로 한 번만 만든다(렌더 중 ref 를 읽지 않게).
  const [flightCtl] = useState(() => createTopicDraftFlight({ post: (body, signal) => draftTopic(body, { signal }), onState: setFlight }))
  const [saveGuard] = useState(createOnceGuard)
  const [scFlightCtl] = useState(() => createScenarioDraftFlight({ post: (body, signal) => draftScenario(body, { signal }), onState: setScFlight }))
  const arrivalSeq = useRef(0)
  const scLastRef = useRef<{ body: ScenarioDraftForTopicBody; key: ScenarioSlotKey } | null>(null)

  // 자동 보관 — 이어 고칠지 묻는 동안(restore)은 남은 초안을 덮어쓰지 않고, 보관을 끝낸 뒤(저장·버리기)에는 다시 쓰지 않는다.
  const storeClosed = useRef(false)
  const snapRef = useRef<Omit<StoredTopicDraft, 'version' | 'savedAt'> | null>(null)
  const flush = useCallback(() => {
    const snap = snapRef.current
    if (storeClosed.current || !snap) return
    writeStore('session', TOPIC_DRAFT_STORE_KEY, isBlankTopicStore(snap) ? null : serializeTopicStore({ ...snap, savedAt: Date.now() }))
  }, [])
  useEffect(() => {
    snapRef.current = restore ? null : { userId, ask, draft, warnings, arrivalTitle, edited, scenarios, savedTopicId, scAsked }
    if (restore || storeClosed.current) return
    const t = setTimeout(flush, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [restore, userId, ask, draft, warnings, arrivalTitle, edited, scenarios, savedTopicId, scAsked, flush])

  useEffect(
    () => () => {
      scFlightCtl.dispose()
      flightCtl.dispose()
      flush()
    },
    [flightCtl, scFlightCtl, flush],
  )

  /** 저장 표시는 디바운스를 기다리지 않고 곧바로 보관한다(새로 고침이 300ms 안에 와도 주제·상황을 두 번 만들지 않게). 같은 자동 보관 경로(`flush`)를 쓴다. */
  const keepNow = useCallback(
    (patch: Partial<Pick<StoredTopicDraft, 'scenarios' | 'savedTopicId'>>) => {
      if (snapRef.current) snapRef.current = { ...snapRef.current, ...patch }
      flush()
    },
    [flush],
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

  const onScenarioDone = useCallback((o: ScenarioDraftOutcome, body: ScenarioDraftForTopicBody, key: ScenarioSlotKey) => {
    if (o.kind === 'canceled') return
    if (o.kind === 'fail') {
      // 뒤에서 도는 요청이라 초점을 옮기지 않는다(위 칸을 고치는 중일 수 있다) — 실패 상자가 `role=alert` 로 알린다.
      setScFailure(o.failure)
      return
    }
    setScFailure(null)
    setScenarios((cur) => (cur.some((s) => s.key === key) ? cur : [...cur, { key, desc: body.description, draft: o.draft, keep: true, savedId: null }]))
  }, [])

  /** 주제 초안 도착 이벤트 — 옛 상황 초안을 비우고 자동 상황 초안을 한 번 보낸다(같은 도착 번호로는 다시 보내지 않는다). */
  const autoScenario = useCallback(
    (d: EditableTopicDraft) => {
      scFlightCtl.dispose()
      setScenarios([])
      setScFailure(null)
      setScServer({})
      setScFails([])
      arrivalSeq.current += 1
      const body = scenarioDraftBody(d, scenarioSeedDescription(d), d.title)
      if (scFlightCtl.autoOnce(arrivalSeq.current, body, (o) => onScenarioDone(o, body, 'sc0'))) {
        scLastRef.current = { body, key: 'sc0' }
        setScAsked(true)
      }
    },
    [scFlightCtl, onScenarioDone],
  )

  const onDone = useCallback(
    (o: TopicDraftOutcome) => {
      if (o.kind === 'ok') {
        arrive(o.draft, o.warnings, o.draft.title, false)
        requestFocus('arrived')
        autoScenario(o.draft)
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
    [arrive, requestFocus, autoScenario],
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
    // 받아 둔 상황 초안은 그대로 — 자동 요청을 다시 보내지 않는다(실패했거나 끊겼으면 [하나 더]로 만든다).
    setScenarios(restore.scenarios ?? [])
    setScAsked(restore.scAsked ?? false)
    requestFocus('arrived')
  }, [restore, flight.busy, arrive, requestFocus])

  const dropRestore = useCallback(() => {
    writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
    setRestore(null)
    setAskState({ title: '', level: defaultLevel })
    setDraftState(null)
    setEdited(false)
  }, [defaultLevel])

  const scProblems = useMemo(() => {
    const out = new Map<ScenarioSlotKey, DraftProblem[]>()
    const client = tried ? scenarioSlotProblems(scenarios, validateDraft) : new Map<ScenarioSlotKey, DraftProblem[]>()
    for (const s of scenariosToSave(scenarios)) {
      const c = client.get(s.key) ?? []
      const keys = new Set(c.map((p) => p.key))
      const all = [...c, ...(scServer[s.key] ?? []).filter((p) => !keys.has(p.key))]
      if (all.length) out.set(s.key, all)
    }
    return out
  }, [tried, scenarios, scServer])

  const problems = useMemo(() => {
    const client = tried && draft && !savedTopicId ? validateTopicDraft(draft) : []
    const keys = new Set(client.map((p) => p.key))
    const sc: TopicProblem[] = [...scProblems].map(([k, ps]) => ({ key: `sc:${k}`, message: SCDRAFT.problems(ps.length) }))
    return [...client, ...server.filter((p) => !keys.has(p.key)), ...sc]
  }, [tried, draft, savedTopicId, server, scProblems])

  const partial = useMemo(() => (wasPartial && (stage === 'partial' || stage === 'saving') ? partialView(scenarios, scFails) : null), [wasPartial, stage, scenarios, scFails])

  const finishSaved = useCallback(
    (id: string | null, title: string, saved: number) => {
      closeStore()
      const flash: ManageFlash = { kind: 'created', title, scenarios: saved }
      writeStore('session', MANAGE_FLASH_KEY, JSON.stringify(flash))
      router.replace(typeof id === 'string' && id ? topicHref(id, 'MINE') : MANAGE_HREF, { scroll: false })
    },
    [closeStore, router],
  )

  const onTopicSaved = useCallback(
    (id: string) => {
      savedTopicRef.current = id
      setSavedTopicId(id)
      keepNow({ savedTopicId: id })
    },
    [keepNow],
  )

  const onScenarioSaved = useCallback(
    (key: ScenarioSlotKey, id: string) => {
      const next = scenariosRef.current.map((s) => (s.key === key ? { ...s, savedId: id } : s))
      scenariosRef.current = next
      setScenarios(next)
      keepNow({ scenarios: next })
    },
    [keepNow],
  )

  const save = useCallback(() => {
    const d = draft
    const resaving = stage === 'partial'
    if (!d || (stage !== 'review' && !resaving) || saveMessage?.block || scFlight.busy) return
    if (resaving && partial?.block) return
    const found = resaving ? [] : validateTopicDraft(d)
    if (found.length || scenarioSlotProblems(scenarios, validateDraft).size) {
      setTried(true)
      setServer([])
      requestFocus('problem')
      return
    }
    saveGuard.run(async () => {
      setStage('saving')
      setSaveMessage(null)
      setScFails([])
      const r = await runTopicCreateSave(
        { draft: d, savedTopicId: savedTopicRef.current, slots: scenariosRef.current },
        { createTopic, createScenario },
        { onTopicSaved, onScenarioSaved, onProgress: setProgress },
      )
      setProgress(null)
      if (r.kind === 'done') {
        finishSaved(r.topicId, r.title, r.saved)
        return
      }
      if (r.kind === 'partial') {
        setScFails(r.failed)
        const fieldProblems: Partial<Record<ScenarioSlotKey, DraftProblem[]>> = {}
        for (const x of r.failed) if (x.failure.kind === 'field') fieldProblems[x.key] = slotServerProblems(x.failure)
        setScServer(fieldProblems)
        setWasPartial(true)
        setStage('partial')
        requestFocus('partial')
        return
      }
      setStage('review')
      const f = r.failure
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
    })
  }, [draft, stage, saveMessage, scFlight.busy, partial, scenarios, requestFocus, saveGuard, onTopicSaved, onScenarioSaved, finishSaved])

  const goToTopic = useCallback(() => {
    const d = draftRef.current
    finishSaved(savedTopicRef.current, d ? oneLine(d.title) : '', scenariosRef.current.filter((s) => s.savedId).length)
  }, [finishSaved])

  const toggleKeep = useCallback((key: ScenarioSlotKey, keep: boolean) => setScenarios((cur) => toggleScenarioKeep(cur, key, keep)), [])

  const setScenarioDraft = useCallback((key: ScenarioSlotKey, fn: (d: EditableDraft) => EditableDraft) => {
    setEdited(true)
    setScServer((m) => (m[key] ? { ...m, [key]: undefined } : m))
    setScenarios((cur) => cur.map((s) => (s.key === key ? { ...s, draft: fn(s.draft) } : s)))
  }, [])

  const sendScenario = useCallback(
    (body: ScenarioDraftForTopicBody, key: ScenarioSlotKey) => {
      if (!scFlightCtl.start(body, (o) => onScenarioDone(o, body, key))) return
      scLastRef.current = { body, key }
      setScFailure(null)
    },
    [scFlightCtl, onScenarioDone],
  )

  const requestMore = useCallback(
    (desc: string): string | null => {
      const p = scenarioMoreProblem(desc)
      if (p) return p
      const d = draftRef.current
      const key = nextScenarioSlotKey(scenariosRef.current)
      if (d && key) sendScenario(scenarioDraftBody(d, desc, arrivalTitle), key)
      return null
    },
    [arrivalTitle, sendScenario],
  )

  const retryScenario = useCallback(() => {
    const d = draftRef.current
    const key = nextScenarioSlotKey(scenariosRef.current)
    if (!d || !key || scFailure?.block) return
    const last = scLastRef.current
    sendScenario(last && last.key === key ? last.body : scenarioDraftBody(d, scenarioSeedDescription(d), arrivalTitle), key)
  }, [arrivalTitle, scFailure, sendScenario])

  const cancelScenario = useCallback(() => scFlightCtl.cancel(), [scFlightCtl])

  // 나가기·버리기는 다른 경로로 가는 이동이라(R5 「다른 경로로 이동 → 맨 위」) 기본 스크롤을 둔다 — `{ scroll: false }` 면 관리 화면이 검토 화면의
  // `main` 스크롤 위치에서 열린다. 저장 성공은 새 주제 보기가 머리 제목에 초점을 두어(돌아왔을 때 토스트) 맨 위가 보인다.
  const leave = useCallback(() => {
    flush()
    router.push(MANAGE_HREF)
  }, [flush, router])

  const discard = useCallback(() => {
    flightCtl.dispose()
    scFlightCtl.dispose()
    closeStore()
    router.replace(MANAGE_HREF)
  }, [closeStore, router, flightCtl, scFlightCtl])

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
    scenarios,
    pick: scenarioPick(scenarios),
    scFlight,
    scFailure,
    scProblems,
    toggleKeep,
    setScenarioDraft,
    requestMore,
    retryScenario,
    cancelScenario,
    savedTopicId,
    partial,
    progress,
    goToTopic,
  }
}
