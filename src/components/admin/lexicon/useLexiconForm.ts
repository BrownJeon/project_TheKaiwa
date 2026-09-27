'use client'

/**
 * 항목 시트 입력·저장 상태(screens.md §10-3 B). 모든 실패에서 입력을 지키고, 요청 전 검사(칸·이유·확인 문구)가 틀리면
 * 요청 없이 첫 오류 칸으로 포커스한다. 서버 칸 오류(400/422)는 같은 문구 표를 탄다 — 같은 코드 안의 세부(빈 값·길이)는
 * 클라이언트 검사 결과로 가른다(서버 코드 E_SURFACE 는 빈 값과 40자 초과를 함께 쓴다).
 */
import { useCallback, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'
import type { LexiconEntryDto, LexiconWriteResultDto } from '@/types/lexicon'
import { focusField } from './focus'
import {
  cleanNote,
  type DraftField,
  emptyDraft,
  type FieldError,
  type FieldErrors,
  firstErrorField,
  type LexiconDraft,
  moraCount,
  normalizeSurface,
  priorityValue,
  toKatakana,
  validateDraft,
  validateWriteMeta,
} from './kana'
import { createEntry, type CreateBody, disableEntry, updateEntry, type UpdateBody, type WriteMeta } from './lexiconApi'
import { fieldErrorText, IMMUTABLE_TEXT, mapServerFieldErrors, NO_CHANGE_TOAST, type WriteKind, writeErrorNotice, type WriteNotice } from './lexiconCopy'

export type EntryWriteKind = Extract<WriteKind, 'save' | 'disable' | 'enable'>

const HIDDEN_IN_EDIT: readonly DraftField[] = ['surface', 'scope', 'scopeRefId']

export function draftFromEntry(e: LexiconEntryDto): LexiconDraft {
  return {
    surface: e.surface,
    reading: e.reading,
    accentType: e.accentType,
    priority: String(e.priority),
    scope: e.scope,
    scopeRefId: e.scopeRefId ?? '',
    wordType: e.wordType ?? '',
    note: e.note ?? '',
  }
}

/** edit 에서 원래 값과 다른가(이유 칸은 넣지 않는다). */
export function isDirty(mode: 'add' | 'edit', d: LexiconDraft, entry: LexiconEntryDto | null): boolean {
  if (mode === 'add' || !entry) {
    const e = emptyDraft()
    return (
      d.surface.trim() !== '' ||
      d.reading.trim() !== '' ||
      d.note.trim() !== '' ||
      d.scopeRefId.trim() !== '' ||
      d.accentType !== e.accentType ||
      d.priority.trim() !== e.priority ||
      d.wordType !== e.wordType ||
      d.scope !== e.scope
    )
  }
  return (
    toKatakana(d.reading) !== entry.reading ||
    d.accentType !== entry.accentType ||
    priorityValue(d.priority) !== entry.priority ||
    (d.wordType || null) !== (entry.wordType ?? null) ||
    (cleanNote(d.note) || null) !== (entry.note ?? null)
  )
}

/** 요청 본문(§10-3 B). 빈 선택값은 null, 문자열은 앞뒤 공백 제거, 읽기는 가타카나로. */
export function buildBody(kind: EntryWriteKind, mode: 'add' | 'edit', d: LexiconDraft, meta: WriteMeta): Record<string, unknown> {
  const tail: WriteMeta = { reason: meta.reason.trim(), baseVersion: meta.baseVersion, ...(meta.confirm ? { confirm: meta.confirm.trim() } : {}) }
  if (kind === 'disable') return { ...tail }
  if (kind === 'enable') return { enabled: true, ...tail }
  const common = {
    reading: toKatakana(d.reading),
    accentType: d.accentType,
    priority: priorityValue(d.priority),
    wordType: d.wordType || null,
    note: cleanNote(d.note) || null,
  }
  if (mode === 'edit') return { ...common, ...tail }
  return {
    surface: normalizeSurface(d.surface),
    ...common,
    scope: d.scope,
    scopeRefId: d.scope && d.scope !== 'GLOBAL' ? d.scopeRefId.trim() : null,
    ...tail,
  }
}

export interface LexiconFormCallbacks {
  onSaved: (res: LexiconWriteResultDto, kind: EntryWriteKind) => void
  onNoChange: () => void
  /** 409 VERSION_CONFLICT 의 `details.currentVersion` — 부모가 곧바로 다음 저장의 baseVersion 으로 쓴다. */
  onConflictVersion?: (currentVersion: number) => void
  toast: (msg: string) => void
}

export function useLexiconForm(mode: 'add' | 'edit', entry: LexiconEntryDto | null, baseVersion: number | null, needsConfirm: boolean, cb: LexiconFormCallbacks) {
  const [draft, setDraft] = useState<LexiconDraft>(() => (entry ? draftFromEntry(entry) : emptyDraft()))
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [metaErrors, setMetaErrors] = useState<{ reason?: FieldError; confirm?: FieldError }>({})
  const [notice, setNotice] = useState<{ value: WriteNotice; err: Err; kind: EntryWriteKind } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const clientErrors = validateDraft(draft, mode)
  const dirty = isDirty(mode, draft, entry)

  const change = useCallback((patch: Partial<LexiconDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setServerErrors((s) => {
      const keys = Object.keys(patch) as DraftField[]
      if (!keys.some((k) => s[k])) return s
      const next = { ...s }
      for (const k of keys) delete next[k]
      return next
    })
  }, [])

  const changeReason = useCallback((v: string) => {
    setReason(v)
    setMetaErrors((m) => (m.reason ? { ...m, reason: undefined } : m))
  }, [])
  const changeConfirm = useCallback((v: string) => {
    setConfirm(v)
    setMetaErrors((m) => (m.confirm ? { ...m, confirm: undefined } : m))
  }, [])

  const kata = toKatakana(draft.reading)
  const ctx = { scope: mode === 'add' ? draft.scope : entry?.scope ?? null, moras: moraCount(kata) }
  const shownFieldError = (f: DraftField): string | undefined => {
    const server = serverErrors[f]
    const client = clientErrors[f]
    const err = server ? client ?? server : showErrors ? client : undefined
    return err ? fieldErrorText(f, err, ctx) : undefined
  }
  const fieldErrors: Partial<Record<DraftField, string>> = {}
  for (const f of Object.keys({ ...clientErrors, ...serverErrors }) as DraftField[]) {
    const t = shownFieldError(f)
    if (t) fieldErrors[f] = t
  }
  const metaText = {
    reason: metaErrors.reason ? fieldErrorText('reason', metaErrors.reason) : undefined,
    confirm: metaErrors.confirm ? fieldErrorText('confirm', metaErrors.confirm) : undefined,
  }

  const submit = useCallback(
    async (kind: EntryWriteKind) => {
      if (submitting) return
      setNotice(null)
      const checkDraft = kind === 'save'
      const errs = checkDraft ? validateDraft(draft, mode) : {}
      const meta = validateWriteMeta(reason, confirm, needsConfirm)
      const firstDraft = firstErrorField(errs)
      if (firstDraft || meta.reason || meta.confirm) {
        setShowErrors(true)
        setMetaErrors(meta)
        focusField(firstDraft ?? (meta.reason ? 'reason' : 'confirm'))
        return
      }
      if (kind === 'save' && mode === 'edit' && !isDirty(mode, draft, entry)) {
        cb.toast(NO_CHANGE_TOAST)
        return
      }
      const wm: WriteMeta = { reason, baseVersion: baseVersion ?? 0, ...(needsConfirm ? { confirm } : {}) }
      const body = buildBody(kind, mode, draft, wm)
      setSubmitting(true)
      try {
        let res: LexiconWriteResultDto
        if (kind === 'disable' && entry) res = await disableEntry(entry.id, body as unknown as WriteMeta)
        else if (mode === 'edit' || kind === 'enable') {
          if (!entry) return
          res = await updateEntry(entry.id, body as unknown as UpdateBody)
        } else res = await createEntry(body as unknown as CreateBody)
        if (!res.changed) cb.onNoChange()
        else cb.onSaved(res, kind)
      } catch (e) {
        if (isAbort(e)) return
        const err = toErr(e)
        const cur = err.details.currentVersion
        if (err.status === 409 && typeof cur === 'number') cb.onConflictVersion?.(cur)
        const mapped = mapServerFieldErrors(err)
        // edit 에는 표기·범위·대상 칸이 없다 — 그 칸 오류(E_IMMUTABLE 등)는 칸 아래가 아니라 알림으로.
        if (mapped && mode === 'edit') for (const k of HIDDEN_IN_EDIT) delete mapped.fields[k]
        if (mapped && (Object.keys(mapped.fields).length > 0 || mapped.reason || mapped.confirm)) {
          setServerErrors(mapped.fields)
          setMetaErrors({ reason: mapped.reason, confirm: mapped.confirm })
          const f = firstErrorField(mapped.fields)
          focusField(f ?? (mapped.reason ? 'reason' : 'confirm'))
        } else if (mapped && mode === 'edit') {
          setNotice({ value: { text: IMMUTABLE_TEXT }, err, kind })
        } else {
          const existing = err.details.existing as Partial<LexiconEntryDto> | undefined
          setNotice({
            value: writeErrorNotice(err, kind, {
              baseVersion,
              surface: typeof existing?.surface === 'string' ? existing.surface : normalizeSurface(draft.surface) || entry?.surface,
              existingDisabled: existing?.enabled === false,
            }),
            err,
            kind,
          })
        }
      } finally {
        setSubmitting(false)
      }
    },
    [submitting, draft, mode, reason, confirm, needsConfirm, entry, baseVersion, cb],
  )

  const revealErrors = useCallback(() => {
    setShowErrors(true)
    const f = firstErrorField(validateDraft(draft, mode))
    if (f) focusField(f)
  }, [draft, mode])

  return {
    draft,
    change,
    revealErrors,
    reason,
    setReason: changeReason,
    confirm,
    setConfirm: changeConfirm,
    fieldErrors,
    metaText,
    notice,
    clearNotice: () => setNotice(null),
    submitting,
    dirty,
    submit,
    validDraft: Object.keys(clientErrors).length === 0,
  }
}
