'use client'

/**
 * AI 초안 만들기·고치기 상태(가이드 §3-H·§5) — 단계 `ask → generating → edit → saving`.
 * - 새 상황: 초안(S3 `POST /api/v1/scenarios/drafts`, 동기 — 행 없음)을 받아 고친 뒤 [저장] = #163. **저장 전에는 서버에 아무것도 남지 않는다**(제안→채택).
 *   묻기·초안은 이 탭의 sessionStorage 에만 자동 보관(300ms 디바운스) — 돌아오면 "고치던 초안이 있어요". 저장·버리기에서 지운다.
 * - 고치기(D-6): 상세(#162)를 편집 모양으로 바꿔 시작, [저장] = #164(바뀐 칸만). 보관하지 않는다. 시드·남의 것·없음 = 고칠 수 없음.
 * 초안 API 는 아직 서버에 없을 수 있다(A3b) — 404·501·네트워크 실패는 `dr-gen-fail` 로 다시 시도하게 한다. 벽시계 상한 45초, 15초부터 "오래 걸려요".
 * 검사 문구는 `logic.validateDraft`(서버 한도 그대로), 첫 저장 시도 뒤에는 고칠 때마다 다시 검사한다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiPatch, apiPost, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { readStore, writeStore } from '@/components/common/storage'
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { TopicList } from '@/types/lesson'
import { SCENARIO_LIMITS, type ScenarioDetail } from '@/types/scenario'
import {
  draftFromDetail,
  draftFromResponse,
  draftInput,
  draftPatch,
  genFailureOf,
  isBlankStore,
  oneLine,
  parseStoredDraft,
  saveFailureOf,
  serializeStoredDraft,
  validateDraft,
  type DraftAsk,
  type DraftLevel,
  type DraftProblem,
  type EditableDraft,
  type GenFailure,
  type StoredDraft,
} from './logic'
import { DRAFT, DRAFT_STORE_KEY, SCENARIO_HOME_HREF, scenarioSheetHref } from './scenarioCopy'
import { useScenarioDetail } from './useScenarioDetail'

export const DRAFT_LONG_MS = 15_000
export const DRAFT_TIMEOUT_MS = 45_000
const SAVE_DEBOUNCE_MS = 300

const topicsPath = () => '/api/v1/topics'

export type DraftStage = 'ask' | 'generating' | 'edit' | 'saving'
export type SaveMessage = { kind: 'fail' } | { kind: 'rate' } | { kind: 'text'; text: string }

export interface DraftScreenModel {
  mode: 'new' | 'edit'
  stage: DraftStage
  ask: DraftAsk
  setAsk: (patch: Partial<DraftAsk>) => void
  askError: string | null
  draft: EditableDraft | null
  setDraft: (fn: (d: EditableDraft) => EditableDraft) => void
  edited: boolean
  /** 진입 때 이 탭에 남아 있던 초안(이어 고칠지 묻는다). */
  restore: StoredDraft | null
  acceptRestore: () => void
  dropRestore: () => void
  long: boolean
  genError: GenFailure | null
  generate: () => void
  cancelGenerate: () => void
  problems: DraftProblem[]
  saveMessage: SaveMessage | null
  /** 고칠 수 없는 상황(dr-edit-404) — 고치기 화면의 상세 404·시드·지운 상황, 또는 저장 때 404·409 ARCHIVED. */
  gone: boolean
  /** 고치기 화면 상세 읽기 상태. */
  load: { status: 'loading' | 'ready' | 'error'; reload: () => void }
  topics: { status: 'loading' | 'ready' | 'error'; items: TopicList['items'] }
  /** 고치는 상황에 이미 이어진 장소(주제 목록에 없을 수 있다 — 칩으로 함께 보인다). */
  originalTopics: { id: string; title: string }[]
  /** 저장 — 검사 실패면 문제 목록을 돌려준다(화면이 첫 칸으로 초점). */
  save: () => Promise<DraftProblem[] | null>
  discard: () => void
}

export function useScenarioDraft({ mode, id, defaultLevel }: { mode: 'new' | 'edit'; id: string | null; defaultLevel: DraftLevel }): DraftScreenModel {
  const router = useRouter()
  const [stored] = useState<StoredDraft | null>(() => (mode === 'new' ? parseStoredDraft(readStore('session', DRAFT_STORE_KEY)) : null))
  const [restore, setRestore] = useState<StoredDraft | null>(() => (stored?.draft ? stored : null))
  const [ask, setAskState] = useState<DraftAsk>(() => stored?.ask ?? { desc: '', topicId: null, level: defaultLevel })
  const [askError, setAskError] = useState<string | null>(null)
  const [newDraft, setNewDraft] = useState<EditableDraft | null>(null)
  const [edits, setEdits] = useState<EditableDraft | null>(null)
  const [edited, setEdited] = useState(false)
  const [stage, setStage] = useState<DraftStage>('ask')
  const [long, setLong] = useState(false)
  const [genError, setGenError] = useState<GenFailure | null>(null)
  const [tried, setTried] = useState(false)
  const [server, setServer] = useState<DraftProblem[]>([])
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null)
  const [goneOnSave, setGoneOnSave] = useState(false)
  const req = useRef<{ ac: AbortController | null; timers: ReturnType<typeof setTimeout>[]; timedOut: boolean }>({ ac: null, timers: [], timedOut: false })
  const saving = useRef(false)
  // 자동 보관 타이머와 "보관 끝"(저장 성공·버리기) 표시 — 끝난 뒤 남은 타이머가 지운 초안을 되살리지 않게 한다.
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const storeClosed = useRef(false)
  // 다시 만들기 중 실패·취소하면 고치던 초안으로 돌아간다(묻기 단계로 떨어뜨리지 않는다).
  const newDraftRef = useRef<EditableDraft | null>(null)
  useEffect(() => {
    newDraftRef.current = newDraft
  }, [newDraft])

  const detail = useScenarioDetail(mode === 'edit' ? id : null)
  const topics = useKeyedResource<TopicList>('topics', topicsPath)
  const original: ScenarioDetail | null = mode === 'edit' && detail.data?.isMine ? detail.data : null
  const base = useMemo(() => (original ? draftFromDetail(original) : null), [original])
  const draft = mode === 'edit' ? (edits ?? base) : newDraft
  const editStage: DraftStage = mode === 'edit' ? (stage === 'saving' ? 'saving' : 'edit') : stage
  const gone = goneOnSave || (mode === 'edit' && ((detail.status === 'error' && detail.errStatus === 404) || (detail.status === 'ready' && !detail.data?.isMine)))

  const clearTimers = () => {
    req.current.timers.forEach(clearTimeout)
    req.current.timers = []
  }

  useEffect(
    () => () => {
      req.current.ac?.abort()
      req.current.timers.forEach(clearTimeout)
    },
    [],
  )

  // 자동 보관 — 이어 고칠지 묻는 동안(restore)에는 남은 초안을 덮어쓰지 않는다. 보관을 끝낸 뒤에는 다시 쓰지 않는다.
  useEffect(() => {
    if (mode !== 'new' || restore || storeClosed.current) return
    const t = setTimeout(() => {
      storeTimer.current = null
      if (storeClosed.current) return
      const snap = { ask, draft: newDraft, edited, savedAt: Date.now() }
      writeStore('session', DRAFT_STORE_KEY, isBlankStore(snap) ? null : serializeStoredDraft(snap))
    }, SAVE_DEBOUNCE_MS)
    storeTimer.current = t
    return () => {
      clearTimeout(t)
      if (storeTimer.current === t) storeTimer.current = null
    }
  }, [mode, restore, ask, newDraft, edited])

  /** 저장 성공·버리기 — 예약된 보관을 먼저 취소하고 이 탭의 초안을 지운다. */
  const closeStore = useCallback(() => {
    storeClosed.current = true
    if (storeTimer.current) clearTimeout(storeTimer.current)
    storeTimer.current = null
    writeStore('session', DRAFT_STORE_KEY, null)
  }, [])

  const setAsk = useCallback((patch: Partial<DraftAsk>) => {
    setAskState((a) => ({ ...a, ...patch }))
    setAskError(null)
    setGenError(null)
  }, [])

  const setDraft = useCallback(
    (fn: (d: EditableDraft) => EditableDraft) => {
      setEdited(true)
      setServer([])
      setSaveMessage(null)
      if (mode === 'edit') setEdits((cur) => {
        const from = cur ?? base
        return from ? fn(from) : cur
      })
      else setNewDraft((cur) => (cur ? fn(cur) : cur))
    },
    [mode, base],
  )

  const generate = useCallback(() => {
    if (req.current.ac) return
    const desc = oneLine(ask.desc)
    const n = cpLength(desc)
    if (n < DRAFT.descMin) return setAskError(DRAFT.tooShort)
    if (n > SCENARIO_LIMITS.descriptionMax) return setAskError(DRAFT.descTooLong)
    const ac = new AbortController()
    req.current = { ac, timers: [], timedOut: false }
    req.current.timers.push(setTimeout(() => setLong(true), DRAFT_LONG_MS))
    req.current.timers.push(
      setTimeout(() => {
        req.current.timedOut = true
        ac.abort()
      }, DRAFT_TIMEOUT_MS),
    )
    setStage('generating')
    setLong(false)
    setGenError(null)
    setAskError(null)
    const body = { description: desc, level: ask.level, ...(ask.topicId ? { topicId: ask.topicId } : {}) }
    apiPost<unknown>('/api/v1/scenarios/drafts', body, { signal: ac.signal }).then(
      (res) => {
        if (req.current.ac !== ac) return
        clearTimers()
        req.current.ac = null
        setLong(false)
        const d = draftFromResponse(res, ask)
        if (!d) {
          setGenError({ kind: 'fail' })
          setStage('ask')
          return
        }
        // 새 초안을 받았으니 남아 있던 초안 대신 이것을 보관한다(복구 상자를 닫고 자동 보관을 다시 켠다).
        setRestore(null)
        setNewDraft(d)
        setEdited(false)
        setTried(false)
        setServer([])
        setSaveMessage(null)
        setStage('edit')
      },
      (e: unknown) => {
        if (req.current.ac !== ac) return
        const timedOut = req.current.timedOut
        clearTimers()
        req.current.ac = null
        setLong(false)
        setStage(newDraftRef.current ? 'edit' : 'ask')
        if (isAbort(e) && !timedOut) return
        const f = genFailureOf(toErr(e), timedOut)
        if (f.kind === 'field') setAskError(f.message)
        else setGenError(f)
      },
    )
  }, [ask])

  const cancelGenerate = useCallback(() => {
    const ac = req.current.ac
    if (!ac) return
    req.current.ac = null
    clearTimers()
    ac.abort()
    setLong(false)
    setStage(newDraftRef.current ? 'edit' : 'ask')
  }, [])

  const acceptRestore = useCallback(() => {
    if (!restore?.draft || req.current.ac) return
    setAskState(restore.ask)
    setNewDraft(restore.draft)
    setEdited(restore.edited)
    setRestore(null)
    setStage('edit')
  }, [restore])

  const dropRestore = useCallback(() => {
    writeStore('session', DRAFT_STORE_KEY, null)
    setRestore(null)
    setAskState({ desc: '', topicId: null, level: defaultLevel })
    setNewDraft(null)
    setEdited(false)
  }, [defaultLevel])

  const problems = useMemo(() => {
    const client = tried && draft ? validateDraft(draft) : []
    const keys = new Set(client.map((p) => p.key))
    return [...client, ...server.filter((p) => !keys.has(p.key))]
  }, [tried, draft, server])

  const save = useCallback(async (): Promise<DraftProblem[] | null> => {
    if (!draft || saving.current) return null
    const found = validateDraft(draft)
    if (found.length) {
      setTried(true)
      setServer([])
      return found
    }
    saving.current = true
    setStage('saving')
    setSaveMessage(null)
    try {
      let savedId: string
      if (mode === 'new') {
        savedId = (await apiPost<ScenarioDetail>('/api/v1/scenarios', draftInput(draft, ask))).id
      } else {
        if (!original) throw new Error('no original')
        const patch = draftPatch(draft, original)
        if (Object.keys(patch).length) await apiPatch<ScenarioDetail>(`/api/v1/scenarios/${encodeURIComponent(original.id)}`, patch)
        savedId = original.id
      }
      if (mode === 'new') closeStore()
      router.replace(scenarioSheetHref(savedId, true))
      return null
    } catch (e) {
      saving.current = false
      setStage('edit')
      const f = saveFailureOf(toErr(e))
      if (f.kind === 'invalid') {
        setTried(true)
        setServer(f.problems)
        return f.problems
      }
      if (f.kind === 'gone') setGoneOnSave(true)
      else if (f.kind === 'message') setSaveMessage({ kind: 'text', text: f.text })
      else setSaveMessage({ kind: f.kind })
      return null
    }
  }, [draft, mode, ask, original, router, closeStore])

  const discard = useCallback(() => {
    req.current.ac?.abort()
    if (mode === 'new') closeStore()
    router.replace(SCENARIO_HOME_HREF)
  }, [mode, router, closeStore])

  return {
    mode,
    stage: editStage,
    ask,
    setAsk,
    askError,
    draft,
    setDraft,
    edited,
    // 새 초안을 만드는 동안에는 복구 상자를 숨긴다(실패·취소로 묻기 단계에 돌아오면 다시 보인다).
    restore: editStage === 'ask' ? restore : null,
    acceptRestore,
    dropRestore,
    long,
    genError,
    generate,
    cancelGenerate,
    problems,
    saveMessage,
    gone,
    load: { status: detail.status, reload: detail.reload },
    topics: { status: topics.status, items: topics.data?.items ?? [] },
    originalTopics: original?.topics ?? [],
    save,
    discard,
  }
}
