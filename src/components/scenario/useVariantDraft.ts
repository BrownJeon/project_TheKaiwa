'use client'

/**
 * 변형 상황 만들기 A 상태(screens.md §16-2 A·§16-4) — 단계 `pick → (만드는 중) → review → saving`.
 * 기준 상황은 #162 상세로 읽고(남의 것·없음 = 원본 없음), 초안은 #177(행 없음), 저장은 #163(새 상황 한 행) 뒤 그 상황 시트로 `replace`.
 * 초안은 저장 전까지 어디에도 남지 않는다(이 탭 보관도 없음). 오류 문구는 `failure.ts` 고정 문구(서버 `message` 는 쓰지 않는다).
 * 칩·직접 적기·「바뀜」 표시는 React 상태만 바꾼다(스크롤·`key`·주소를 건드리지 않는다 — R1~R6).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { JlptLevel, TopicList } from '@/types/lesson'
import type { ScenarioDetail } from '@/types/scenario'
import { SCENARIO_VARIANT_NO_AXES, type ScenarioVariantAxes, type ScenarioVariantAxisKey } from '@/types/scenarioVariant'
import type { ScenarioFailure } from './failure'
import { saveFailureOf, validateDraft, type DraftProblem, type EditableDraft } from './logic'
import { DRAFT, draftReturn, type DraftFrom } from './scenarioCopy'
import { useScenarioDetail } from './useScenarioDetail'
import {
  VARIANT_IDLE,
  createVariantFlight,
  pickAxis,
  submitBlock,
  variantRequestBody,
  variantResult,
  variantSaveBody,
  type SubmitBlock,
  type VariantDraft,
  type VariantFlight,
  type VariantFlightState,
} from './variantLogic'

const topicsPath = () => '/api/v1/topics'

export type VariantSaveMessage = { text: string; block: boolean }

export interface VariantScreenModel {
  back: { href: string; label: string; listHref: string }
  load: { status: 'loading' | 'ready' | 'error'; reload: () => void }
  base: ScenarioDetail | null
  baseLevel: JlptLevel
  /** 원본을 찾을 수 없음(#162·#177 의 404 — 지웠거나 숨긴 상황). */
  gone: boolean
  axes: ScenarioVariantAxes
  pick: (key: ScenarioVariantAxisKey, value: string) => void
  note: string
  setNote: (v: string) => void
  block: SubmitBlock
  flight: VariantFlightState
  generating: boolean
  /** 축 위에 보일 실패(바꿀 점 없음·만들기 어려움) — 검토 단계에서는 버튼 곁에 보인다. */
  failure: ScenarioFailure | null
  /** 직접 적기 칸 아래 문구(서버 400 `note`). */
  noteError: string | null
  generate: () => void
  cancel: () => void
  result: VariantDraft | null
  draft: EditableDraft | null
  setDraft: (fn: (d: EditableDraft) => EditableDraft) => void
  edited: boolean
  saving: boolean
  problems: DraftProblem[]
  saveMessage: VariantSaveMessage | null
  places: { id: string; title: string }[]
  placesFailed: boolean
  save: () => Promise<DraftProblem[] | null>
  discard: () => void
}

export function useVariantDraft({ id, from = null }: { id: string; from?: DraftFrom }): VariantScreenModel {
  const router = useRouter()
  const ret = useMemo(() => draftReturn(from), [from])
  const detail = useScenarioDetail(id)
  const topics = useKeyedResource<TopicList>('topics', topicsPath)
  const base = detail.status === 'ready' ? detail.data : null
  const baseLevel: JlptLevel = base?.level ?? 'N5'

  const [axes, setAxes] = useState<ScenarioVariantAxes>(SCENARIO_VARIANT_NO_AXES)
  const [note, setNoteState] = useState('')
  const [flight, setFlight] = useState<VariantFlightState>(VARIANT_IDLE)
  const [result, setResult] = useState<VariantDraft | null>(null)
  const [draft, setDraftState] = useState<EditableDraft | null>(null)
  const [edited, setEdited] = useState(false)
  const [tried, setTried] = useState(false)
  const [server, setServer] = useState<DraftProblem[]>([])
  const [saveMessage, setSaveMessage] = useState<VariantSaveMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const flightRef = useRef<VariantFlight | null>(null)
  const getFlight = useCallback(() => {
    if (!flightRef.current) flightRef.current = createVariantFlight({ post: (body, signal) => apiPost<unknown>(`/api/v1/scenarios/${encodeURIComponent(id)}/variants/drafts`, body, { signal }), onState: setFlight })
    return flightRef.current
  }, [id])
  useEffect(() => () => flightRef.current?.dispose(), [])

  const pick = useCallback(
    (key: ScenarioVariantAxisKey, value: string) => {
      setAxes((a) => pickAxis(a, key, value, baseLevel))
      flightRef.current?.clear()
    },
    [baseLevel],
  )
  const setNote = useCallback((v: string) => {
    setNoteState(v)
    flightRef.current?.clear()
  }, [])

  const block = submitBlock(axes, note, baseLevel)
  const generating = flight.phase === 'busy'

  const generate = useCallback(() => {
    if (!base || generating || submitBlock(axes, note, base.level)) return
    getFlight().make(
      variantRequestBody(axes, note, base.level),
      (raw) => variantResult(raw, base.level),
      (v) => {
        setResult(v)
        setDraftState(v.draft)
        setEdited(false)
        setTried(false)
        setServer([])
        setSaveMessage(null)
      },
    )
  }, [base, generating, axes, note, getFlight])

  const cancel = useCallback(() => flightRef.current?.cancel(), [])

  const setDraft = useCallback((fn: (d: EditableDraft) => EditableDraft) => {
    setEdited(true)
    setServer([])
    setSaveMessage(null)
    setDraftState((d) => (d ? fn(d) : d))
  }, [])

  const problems = useMemo(() => {
    const client = tried && draft ? validateDraft(draft) : []
    const keys = new Set(client.map((p) => p.key))
    return [...client, ...server.filter((p) => !keys.has(p.key))]
  }, [tried, draft, server])

  const save = useCallback(async (): Promise<DraftProblem[] | null> => {
    if (!draft || !result || savingRef.current || generating) return null
    const found = validateDraft(draft)
    if (found.length) {
      setTried(true)
      setServer([])
      return found
    }
    savingRef.current = true
    setSaving(true)
    setSaveMessage(null)
    try {
      const saved = await apiPost<ScenarioDetail>('/api/v1/scenarios', variantSaveBody(result, draft))
      router.replace(ret.sheetHref(saved.id, true), { scroll: false })
      return null
    } catch (e) {
      savingRef.current = false
      setSaving(false)
      const f = saveFailureOf(toErr(e), 'scenarioSave')
      if (f.kind === 'invalid') {
        setTried(true)
        setServer(f.problems)
        return f.problems
      }
      setSaveMessage(f.kind === 'message' ? { text: f.text, block: f.block } : { text: DRAFT.saveFail, block: false })
      return null
    }
  }, [draft, result, generating, router, ret])

  const discard = useCallback(() => {
    flightRef.current?.dispose()
    router.replace(ret.sheetHref(id), { scroll: false })
  }, [router, ret, id])

  const places = useMemo(() => {
    const seen = new Set<string>()
    return [...(base?.topics ?? []), ...(topics.data?.items ?? []).map((t) => ({ id: t.id, title: t.title }))].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  }, [base, topics.data])

  const failure = flight.phase === 'failed' ? flight.failure : null
  const gone = (detail.status === 'error' && detail.errStatus === 404) || failure?.kind === 'gone'
  const noteError = failure?.kind === 'field' ? (failure.problems.find((p) => p.field === 'note' && !p.defect)?.text ?? null) : null

  return {
    back: { href: ret.sheetHref(id), label: ret.backLabel, listHref: ret.backHref },
    load: { status: detail.status, reload: detail.reload },
    base,
    baseLevel,
    gone,
    axes,
    pick,
    note,
    setNote,
    block,
    flight,
    generating,
    failure: noteError ? null : failure,
    noteError,
    generate,
    cancel,
    result,
    draft,
    setDraft,
    edited,
    saving,
    problems,
    saveMessage,
    places,
    placesFailed: topics.status === 'error' && places.length === 0,
    save,
    discard,
  }
}
