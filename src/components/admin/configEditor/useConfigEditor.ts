'use client'

/**
 * 설정 편집 컨트롤러(task-012c) — 설정 화면(Form·Raw JSON·Diff 탭)·연결 상세 편집·예비 순서 편집이 함께 쓴다.
 * 초안 하나(Form·Raw JSON 공유) → 검증(#104) → 기능 테스트(#105) → 변경 요약(#106) → 적용(쓰기 함수는 호출자가 준다: #107·#111·#93·#100).
 *
 * - 대상이 바뀌면 호출자가 `key` 로 다시 마운트한다. 같은 대상을 다시 불러오면(409 뒤 [최신 값 기준으로 다시 비교]) 초안은 남기고 기준값과 같아진
 *   키만 화면에서 뺀다(`liveDraft`).
 * - 운영 적용은 확인 문구·요약 해시·(필요하면) 테스트 결과 id 를 싣는다 — 서버가 다시 검사한다(화면 검사는 안내용).
 * - 이유·확인 문구는 이 상태에만 두고 로그·저장소에 남기지 않는다.
 * - Raw JSON 편집 중에는 Raw 글이 초안의 원본이다 — Form 편집도 그 글에 넣고 다시 읽는다. 적용은 변경 요약을 만든 초안과 같은 변경을 뜻하는
 *   글만 #111 로 보내고, 아니면 초안 patch 를 #107 로 보내 `rawIgnored` 로 알린다(REV-047 M-1).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, retryAfterOf, toErr } from '@/components/common/errors'
import { useCountdown, useNow } from '@/components/common/useNow'
import type { ConfigApplyResultDto, ConfigDiffDto, ConfigIssueDto, ConfigTestDto } from '@/types/admin'
import * as api from './configApi'
import type { ConfigAccess } from './configAccess'
import {
  applyPayload,
  type Draft,
  docText,
  docWithDraft,
  draftCount,
  EMPTY_DRAFT,
  type FieldModel,
  flatFromDoc,
  parseRawText,
  rawTextWithField,
  renameRawKey,
  requestPatch,
  RESET_VALUE,
  resetDraftKey,
  sameValue,
  setDraftValue,
} from './draft'
import {
  checkConfirmInput,
  checkReasonInput,
  FLOW_START,
  flowAfterEdit,
  type FlowState,
  type NoticeAction,
  requestErrorText,
  testStateOf,
  writeErrorView,
} from './flow'

export interface EditorTarget {
  ref: api.TargetRef
  name: string
  baseVersion: number
  fields: FieldModel[]
  /** Raw JSON 저장값 문서(#110) — DEVELOPER 이상만. */
  rawDoc?: Record<string, unknown> | null
}

export type Writer = (a: { patch: Record<string, unknown>; meta: api.WriteMeta; rawText: string | null }) => Promise<ConfigApplyResultDto>

export interface SheetNoticeView {
  text: string
  actions: NoticeAction[]
  block: boolean
}

const SLOT_MS = 30_000

/**
 * 다시 불러온 저장값과 같아진 초안 키는 뺀다(렌더 중 계산 — 상태를 고치지 않는다). 저장값이 없던 키는 그대로 둔다:
 * Raw JSON 에서 적어 넣은 키는 저장값을 새로 쓰는 변경이다(서버 #111 도 그렇게 본다).
 */
export function liveDraft(d: Draft, fields: readonly FieldModel[]): Draft {
  const byKey = new Map(fields.map((f) => [f.key, f]))
  let changed = false
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d.patch)) {
    const f = byKey.get(k)
    if (f && f.hasStored && sameValue(v, f.stored)) {
      changed = true
      continue
    }
    patch[k] = v
  }
  return changed ? { patch, unknown: d.unknown } : d
}

export function useConfigEditor({
  target,
  access,
  writer,
  onApplied,
  onReload,
  onDiffReady,
}: {
  target: EditorTarget
  access: Pick<ConfigAccess, 'production' | 'needsConfirm' | 'canApply'>
  writer: Writer
  onApplied?: (r: ConfigApplyResultDto) => void
  onReload?: () => void
  onDiffReady?: () => void
}) {
  const [rawDraft, setRawDraft] = useState<Draft>(EMPTY_DRAFT)
  const draft = useMemo(() => liveDraft(rawDraft, target.fields), [rawDraft, target.fields])
  const [flow, setFlow] = useState<FlowState>(FLOW_START)
  const [serverErrors, setServerErrors] = useState<Record<string, ConfigIssueDto>>({})
  const [localErrors, setLocalErrors] = useState<Record<string, ConfigIssueDto>>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'validate' | 'test' | 'diff'>(null)
  const [test, setTest] = useState<ConfigTestDto | null>(null)
  const [testAt, setTestAt] = useState<number | null>(null)
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [diff, setDiff] = useState<ConfigDiffDto | null>(null)
  const [diffAt, setDiffAt] = useState<number | null>(null)
  // Raw JSON: 편집 중 글·문법 오류 위치.
  const [rawEditing, setRawEditing] = useState(false)
  const [rawText, setRawTextState] = useState<string | null>(null)
  const [syntax, setSyntax] = useState<{ line: number; column: number } | null>(null)
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 적용 시트
  const [sheet, setSheet] = useState<null | 'apply' | 'discard'>(null)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reasonErr, setReasonErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<SheetNoticeView | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<ConfigApplyResultDto | null>(null)
  // 적용 때 Raw JSON 글이 확인한 변경 요약과 달라 초안(요약) 기준으로 보냈다 — 화면이 알린다(REV-047 M-1).
  const [rawIgnored, setRawIgnored] = useState(false)
  const [rebased, setRebased] = useState(false)
  const testCtrl = useRef<AbortController | null>(null)

  const count = draftCount(draft)
  const cooldownSec = useCountdown(cooldownUntil) ?? 0
  const now = useNow(flow.t === 'run', 1000)
  const testSec = flow.t === 'run' && testStartedAt && now ? Math.max(0, Math.floor((now - testStartedAt) / 1000)) : 0
  // 30초 대기가 끝나면 테스트 단계를 다시 연다(상태를 고치지 않고 보이는 값만 — 다음 편집·테스트가 덮는다).
  const waitOver = flow.t === 'wait' && cooldownSec === 0 && cooldownUntil !== null
  const shownFlow: FlowState = waitOver ? { ...flow, t: null } : flow

  // 초안이 있으면 새로 고침·창 닫기 전에 한 번 묻는다(브라우저 확인).
  useEffect(() => {
    if (count === 0) return
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [count])

  useEffect(() => () => {
    if (parseTimer.current) clearTimeout(parseTimer.current)
    testCtrl.current?.abort()
  }, [])

  const errors = useMemo(() => ({ ...serverErrors, ...localErrors }), [serverErrors, localErrors])

  const touched = useCallback(() => {
    setFlow((f) => flowAfterEdit(f))
    setServerErrors({})
    setTest(null)
    setDiff(null)
    setApplied(null)
    setRawIgnored(false)
    setRequestError(null)
  }, [])

  /** 300ms 뒤 읽기 예약을 취소한다. 예약이 있었으면 true(글이 아직 초안에 안 들어갔다). */
  const cancelParse = useCallback(() => {
    const pending = parseTimer.current !== null
    if (parseTimer.current) clearTimeout(parseTimer.current)
    parseTimer.current = null
    return pending
  }, [])

  const clearDraft = useCallback(() => {
    cancelParse()
    setRawDraft(EMPTY_DRAFT)
    setLocalErrors({})
    setRawEditing(false)
    setRawTextState(null)
    setSyntax(null)
    setRebased(false)
    touched()
  }, [cancelParse, touched])

  // ── Raw JSON ──
  const rawView = useMemo(() => (target.rawDoc ? docText(docWithDraft(target.ref.scope, target.rawDoc, draft)) : null), [target.rawDoc, target.ref.scope, draft])
  const knownKeys = useMemo(() => target.fields.map((f) => f.key), [target.fields])
  const storedFlat = useMemo(() => {
    if (target.rawDoc) return flatFromDoc(target.ref.scope, target.rawDoc)
    const out: Record<string, unknown> = {}
    for (const f of target.fields) if (f.hasStored) out[f.key] = f.stored
    return out
  }, [target.rawDoc, target.fields, target.ref.scope])

  const applyParse = useCallback(
    (text: string) => {
      const r = parseRawText(text, target.ref.scope, storedFlat, knownKeys)
      if (!r.ok) {
        setSyntax({ line: r.line, column: r.column })
        return
      }
      setSyntax(null)
      setRawDraft(r.draft)
      const local: Record<string, ConfigIssueDto> = {}
      for (const k of r.missing) local[k] = { key: k, rule: 'required', message: '저장값의 키를 지울 수 없어요 — 값을 바꿔 주세요.' }
      for (const k of r.blocked) local[k] = { key: k, rule: 'unknownKey', message: '쓸 수 없는 키 이름이에요(__proto__·constructor·prototype) — 지워 주세요.' }
      setLocalErrors(local)
      touched()
    },
    [target.ref.scope, storedFlat, knownKeys, touched],
  )

  const setRawText = useCallback(
    (text: string) => {
      setRawTextState(text)
      cancelParse()
      parseTimer.current = setTimeout(() => {
        parseTimer.current = null
        applyParse(text)
      }, 300)
    },
    [cancelParse, applyParse],
  )

  const toggleRaw = useCallback(
    (on: boolean) => {
      cancelParse()
      if (on) {
        setRawTextState(rawView)
        setRawEditing(true)
      } else {
        setRawEditing(false)
        setRawTextState(null)
        setSyntax(null)
      }
    },
    [cancelParse, rawView],
  )

  const suggestRaw = useCallback(
    (from: string, to: string) => {
      const base = rawText ?? rawView
      if (!base) return
      cancelParse()
      const next = renameRawKey(base, target.ref.scope, from, to)
      setRawTextState(next)
      applyParse(next)
    },
    [rawText, rawView, target.ref.scope, cancelParse, applyParse],
  )

  /**
   * Raw JSON 편집 중의 Form 편집은 Raw 글에 넣고 그 글을 다시 읽어 초안으로 삼는다(REV-047 M-1 — 적용이 보내는 글 = 요약한 초안).
   * Raw 에서 따로 고친 내용은 남는다. 글에 문법 오류가 있으면 Form 변경을 받지 않고 오류 위치를 보인다(Form 이 잠긴다). 처리했으면 true.
   */
  const editViaRaw = useCallback(
    (f: FieldModel, value: unknown): boolean => {
      if (!rawEditing || rawText === null) return false
      cancelParse()
      const next = rawTextWithField(rawText, target.ref.scope, f, value)
      if (next === null) {
        applyParse(rawText)
        return true
      }
      setRawTextState(next)
      applyParse(next)
      return true
    },
    [rawEditing, rawText, target.ref.scope, cancelParse, applyParse],
  )

  const setField = useCallback(
    (f: FieldModel, value: unknown) => {
      if (editViaRaw(f, value)) return
      setRawDraft((d) => setDraftValue(d, f, value))
      touched()
    },
    [editViaRaw, touched],
  )

  const resetField = useCallback(
    (key: string) => {
      const f = target.fields.find((x) => x.key === key)
      if (f && editViaRaw(f, RESET_VALUE)) return
      setRawDraft((d) => resetDraftKey(d, key))
      setLocalErrors((e) => {
        if (!e[key]) return e
        const n = { ...e }
        delete n[key]
        return n
      })
      touched()
    },
    [target.fields, editViaRaw, touched],
  )

  // ── 검증 · 테스트 · 요약 ──
  const candidate = useMemo(() => ({ patch: requestPatch(draft) }), [draft])

  const fieldErrorsFrom = (list: readonly ConfigIssueDto[]) => {
    const m: Record<string, ConfigIssueDto> = {}
    for (const e of list) if (!m[e.key]) m[e.key] = e
    return m
  }

  const runValidate = useCallback(async () => {
    if (syntax || count === 0) return
    setBusy('validate')
    setRequestError(null)
    try {
      const v = await api.validate(target.ref, candidate.patch)
      const m = fieldErrorsFrom(v.errors)
      setServerErrors(m)
      const bad = !v.valid || Object.keys(localErrors).length > 0
      setFlow((f) => ({ ...f, v: bad ? 'err' : 'ok', d: false }))
    } catch (e) {
      const err = toErr(e)
      const list = Array.isArray(err.details.errors) ? (err.details.errors as ConfigIssueDto[]) : null
      if (err.status === 400 && list?.length) {
        setServerErrors(fieldErrorsFrom(list))
        setFlow((f) => ({ ...f, v: 'err' }))
      } else setRequestError(requestErrorText(err, '검증'))
    } finally {
      setBusy(null)
    }
  }, [syntax, count, target.ref, candidate, localErrors])

  const runTest = useCallback(async () => {
    if (cooldownSec > 0) return
    testCtrl.current?.abort()
    const ctrl = new AbortController()
    testCtrl.current = ctrl
    setBusy('test')
    setRequestError(null)
    setTestStartedAt(Date.now())
    setFlow((f) => ({ ...f, t: 'run', d: false }))
    try {
      const r = await api.test(target.ref, candidate, { signal: ctrl.signal })
      setTest(r)
      setTestAt(Date.now())
      setFlow((f) => ({ ...f, t: testStateOf(r) }))
      if (r.runs.length > 0) setCooldownUntil(Date.now() + SLOT_MS)
    } catch (e) {
      if (isAbort(e)) return
      const err = toErr(e)
      if (err.status === 429) {
        setCooldownUntil(Date.now() + retryAfterOf(err) * 1000)
        setFlow((f) => ({ ...f, t: 'wait' }))
      } else {
        const list = Array.isArray(err.details.errors) ? (err.details.errors as ConfigIssueDto[]) : null
        if (err.status === 400 && list?.length) {
          setServerErrors(fieldErrorsFrom(list))
          setFlow((f) => ({ ...f, v: 'err', t: null }))
        } else {
          setRequestError(requestErrorText(err, '기능 테스트'))
          setFlow((f) => ({ ...f, t: null }))
        }
      }
    } finally {
      setBusy(null)
    }
  }, [cooldownSec, target.ref, candidate])

  const runDiff = useCallback(async () => {
    setBusy('diff')
    setRequestError(null)
    try {
      const d = await api.diff(target.ref, candidate)
      setDiff(d)
      setDiffAt(Date.now())
      setFlow((f) => ({ ...f, d: true }))
      onDiffReady?.()
    } catch (e) {
      const err = toErr(e)
      const list = Array.isArray(err.details.errors) ? (err.details.errors as ConfigIssueDto[]) : null
      if (err.status === 400 && list?.length) {
        setServerErrors(fieldErrorsFrom(list))
        setFlow((f) => ({ ...f, v: 'err', d: false }))
      } else setRequestError(requestErrorText(err, '변경 요약'))
    } finally {
      setBusy(null)
    }
  }, [target.ref, candidate, onDiffReady])

  const skipTest = useCallback(() => {
    if (access.production) return
    setFlow((f) => ({ ...f, t: 'skip' }))
    void runDiff()
  }, [access.production, runDiff])

  // ── 적용 ──
  const openApply = useCallback(() => {
    setNotice(null)
    setReasonErr(null)
    setConfirmErr(null)
    setSheet('apply')
  }, [])
  const openDiscard = useCallback(() => setSheet('discard'), [])
  const closeSheet = useCallback(() => {
    if (applying) return
    setSheet(null)
    setNotice(null)
  }, [applying])

  const discard = useCallback(() => {
    setSheet(null)
    setNotice(null)
    clearDraft()
  }, [clearDraft])

  const submitApply = useCallback(async () => {
    const rErr = checkReasonInput(reason, access.production)
    const cErr = checkConfirmInput(confirm, access.needsConfirm)
    setReasonErr(rErr)
    setConfirmErr(cErr)
    if (rErr || cErr) return
    // 요약 뒤에 고친 Raw 글을 아직 읽기 전이면 지금 읽어 초안에 넣고(요약이 지워진다) 요약부터 다시 하게 한다.
    if (rawEditing && rawText !== null && cancelParse()) {
      applyParse(rawText)
      setNotice({ text: 'Raw JSON 이 변경 요약 뒤에 바뀌었어요. 변경 요약을 다시 만든 뒤 적용해 주세요.', actions: ['remakeDiff'], block: true })
      return
    }
    // 적용은 지금 초안으로 만든 변경 요약이 있을 때만(개발 환경도) — 초안이 바뀌면 요약이 지워진다.
    if (!diff) {
      setNotice({ text: '변경 요약을 먼저 만들어 주세요.', actions: ['remakeDiff'], block: true })
      return
    }
    if (access.production && diff.testRequired && (!test || test.status !== 'ok' || !test.testResultId)) {
      setNotice({ text: '통과한 기능 테스트가 없어요. 다시 테스트한 뒤 적용해 주세요.', actions: ['retest'], block: true })
      return
    }
    const meta = api.writeMeta({
      baseVersion: target.baseVersion,
      reason,
      production: access.production,
      confirm,
      summaryHash: diff.summaryHash ?? null,
      testResultId: diff.testRequired || !access.production ? (test?.testResultId ?? null) : null,
    })
    const payload = applyPayload({ draft, rawText: rawEditing ? rawText : null, scope: target.ref.scope, storedFlat, knownKeys })
    setApplying(true)
    setNotice(null)
    try {
      const r = await writer(payload.kind === 'raw' ? { patch: requestPatch(draft), meta, rawText: payload.text } : { patch: payload.patch, meta, rawText: null })
      setApplied(r)
      setRawIgnored(payload.kind === 'patch' && payload.rawIgnored)
      cancelParse()
      setSheet(null)
      setReason('')
      setConfirm('')
      setRawDraft(EMPTY_DRAFT)
      setLocalErrors({})
      setRawEditing(false)
      setRawTextState(null)
      setSyntax(null)
      setRebased(false)
      setFlow(FLOW_START)
      setServerErrors({})
      setTest(null)
      setDiff(null)
      onApplied?.(r)
    } catch (e) {
      const view = writeErrorView(toErr(e) as Err, { changeCount: count })
      if (view.kind === 'reason') setReasonErr(view.text)
      else if (view.kind === 'confirm') setConfirmErr(view.text)
      else if (view.kind === 'fields') {
        setSheet(null)
        setServerErrors(fieldErrorsFrom(view.errors))
        setFlow((f) => ({ ...f, v: 'err', d: false }))
      } else setNotice({ text: view.text, actions: view.actions, block: view.block })
    } finally {
      setApplying(false)
    }
  }, [reason, confirm, access.production, access.needsConfirm, diff, test, target.baseVersion, target.ref.scope, writer, draft, rawEditing, rawText, storedFlat, knownKeys, cancelParse, applyParse, count, onApplied])

  const noticeAction = useCallback(
    (a: NoticeAction) => {
      if (a === 'discard') {
        discard()
        return
      }
      setSheet(null)
      setNotice(null)
      if (a === 'rebase' || a === 'reload') {
        onReload?.()
        setRebased(a === 'rebase')
        setFlow(FLOW_START)
        setTest(null)
        setDiff(null)
      } else if (a === 'remakeDiff') {
        setFlow((f) => ({ ...f, d: false }))
        setDiff(null)
      } else if (a === 'retest') {
        setFlow((f) => ({ ...f, t: null, d: false }))
        setTest(null)
        setDiff(null)
      }
    },
    [discard, onReload],
  )

  return {
    draft,
    count,
    setField,
    resetField,
    flow: shownFlow,
    errors,
    requestError,
    busy,
    test,
    testAt,
    testSec,
    cooldownSec,
    diff,
    diffAt,
    raw: { editing: rawEditing, text: rawEditing ? rawText : rawView, syntax, toggle: toggleRaw, setText: setRawText, suggest: suggestRaw },
    runValidate,
    runTest,
    runDiff,
    skipTest,
    sheet,
    openApply,
    openDiscard,
    closeSheet,
    discard,
    reason,
    setReason: (v: string) => {
      setReason(v)
      setReasonErr(null)
    },
    confirm,
    setConfirm: (v: string) => {
      setConfirm(v)
      setConfirmErr(null)
    },
    reasonErr,
    confirmErr,
    notice,
    noticeAction,
    applying,
    submitApply,
    applied,
    rawIgnored,
    rebased,
  }
}

export type ConfigEditor = ReturnType<typeof useConfigEditor>
