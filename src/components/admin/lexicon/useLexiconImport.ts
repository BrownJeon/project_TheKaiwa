'use client'

/**
 * 가져오기 상태(screens.md §10-3 D): 파일 고르기 → dryRun → (오류 0 · 바뀌는 것 있음) 이유 → 적용.
 * 파일·방식을 바꾸면 미리 본 결과를 버린다. 적용은 dryRun 때의 `baseVersion` 을 보낸다 — 그 사이 사전이 바뀌면 409 → 다시 미리 보기.
 * 파일은 `File` 로만 들고 있다(화면이 내용을 읽거나 파싱하지 않는다 — 크기·확장자만 보고 내용 검증은 서버 결과를 그린다).
 */
import { useCallback, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'
import { LEXICON_LIMITS, type LexiconImportMode, type LexiconImportResultDto } from '@/types/lexicon'
import { validateWriteMeta, type FieldError } from './kana'
import { importLexicon } from './lexiconApi'
import { fieldErrorText, mapServerFieldErrors, writeErrorNotice, type WriteNotice } from './lexiconCopy'
import { focusField } from './focus'

export type ImportStep = 'pick' | 'checking' | 'reviewed' | 'applying'

/** 요청 전 파일 검사: 확장자 csv/json · 256KB. 통과면 null. */
export function fileProblem(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.(csv|json)$/i.test(file.name)) return 'CSV 나 JSON 파일만 올릴 수 있어요.'
  if (file.size > LEXICON_LIMITS.importMaxBytes) return `파일이 256KB 를 넘어요(${Math.ceil(file.size / 1024)}KB). 나눠서 올려 주세요.`
  return null
}

/** 적용할 수 있는 결과인가: 오류 0 이고 바뀌는 것이 있을 때만. */
export function canApply(r: Pick<LexiconImportResultDto, 'counts'>): boolean {
  return r.counts.error === 0 && r.counts.add + r.counts.update + r.counts.disable > 0
}

export function useLexiconImport(needsConfirm: boolean, onApplied: (res: LexiconImportResultDto) => void) {
  const [file, setFileState] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [mode, setModeState] = useState<LexiconImportMode>('MERGE')
  const [step, setStep] = useState<ImportStep>('pick')
  const [review, setReview] = useState<LexiconImportResultDto | null>(null)
  const [reason, setReasonState] = useState('')
  const [confirm, setConfirmState] = useState('')
  const [metaErrors, setMetaErrors] = useState<{ reason?: FieldError; confirm?: FieldError }>({})
  const [notice, setNotice] = useState<{ value: WriteNotice; err: Err | null } | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  const reset = () => {
    ctrlRef.current?.abort()
    setReview(null)
    setStep('pick')
    setNotice(null)
  }

  const setFile = (f: File | null) => {
    reset()
    setFileState(f)
    setFileError(f ? fileProblem(f) : null)
  }
  const setMode = (m: LexiconImportMode) => {
    if (m === mode) return
    reset()
    setModeState(m)
  }

  const dryRun = useCallback(async () => {
    if (!file) {
      setFileError('파일을 골라 주세요')
      return
    }
    const problem = fileProblem(file)
    if (problem) {
      setFileError(problem)
      return
    }
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setStep('checking')
    setNotice(null)
    setReview(null)
    try {
      const res = await importLexicon(file, mode, true, undefined, { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      setReview(res)
      setStep('reviewed')
    } catch (e) {
      if (isAbort(e) || ctrl.signal.aborted) return
      const err = toErr(e)
      setNotice({ value: writeErrorNotice(err, 'import'), err })
      setStep('pick')
    }
  }, [file, mode])

  const apply = useCallback(async () => {
    if (!file || !review || step === 'applying') return
    const meta = validateWriteMeta(reason, confirm, needsConfirm)
    if (meta.reason || meta.confirm) {
      setMetaErrors(meta)
      focusField(meta.reason ? 'reason' : 'confirm')
      return
    }
    setStep('applying')
    setNotice(null)
    try {
      const res = await importLexicon(file, mode, false, { reason: reason.trim(), baseVersion: review.baseVersion, ...(needsConfirm ? { confirm: confirm.trim() } : {}) })
      onApplied(res)
    } catch (e) {
      if (isAbort(e)) return
      const err = toErr(e)
      const mapped = mapServerFieldErrors(err)
      if (mapped && (mapped.reason || mapped.confirm) && Object.keys(mapped.fields).length === 0) {
        setMetaErrors({ reason: mapped.reason, confirm: mapped.confirm })
        focusField(mapped.reason ? 'reason' : 'confirm')
      } else {
        setNotice({ value: writeErrorNotice(err, 'import', { baseVersion: review.baseVersion }), err })
      }
      setStep('reviewed')
    }
  }, [file, review, step, reason, confirm, needsConfirm, mode, onApplied])

  return {
    file,
    fileError,
    setFile,
    mode,
    setMode,
    step,
    review,
    dryRun,
    apply,
    reason,
    setReason: (v: string) => {
      setReasonState(v)
      setMetaErrors((m) => (m.reason ? { ...m, reason: undefined } : m))
    },
    confirm,
    setConfirm: (v: string) => {
      setConfirmState(v)
      setMetaErrors((m) => (m.confirm ? { ...m, confirm: undefined } : m))
    },
    metaText: {
      reason: metaErrors.reason ? fieldErrorText('reason', metaErrors.reason) : undefined,
      confirm: metaErrors.confirm ? fieldErrorText('confirm', metaErrors.confirm) : undefined,
    },
    notice,
    clearNotice: () => setNotice(null),
  }
}
