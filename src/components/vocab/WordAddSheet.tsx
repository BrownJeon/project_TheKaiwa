'use client'

/**
 * 단어 추가 시트(screens.md §4-2 B·§4-3). 표현 한 칸 → [뜻 채우기](#41 `enrich:true`, **초안만 — 저장되지 않음**) → 확인·수정 → [저장].
 * 부모가 열 때마다 `key` 로 다시 마운트해 상태를 초기화한다.
 *
 * - `valid:false`(일본어 아님, F8)는 표현 단계에 머물고 선생님 설명(`invalidReason`)을 보인다.
 * - 409 는 오류가 아니라 [그 단어 보기] 안내다 — 내 단어 중복과 기본 단어 중복(`BASE_DUPLICATE`, task-068 D9 A)을 가른다.
 *   429 는 초를 세며 [뜻 채우기]를 잠근다.
 * - task-068: 조각을 꼭 고른다(`WordForm` 의 조각 칸). 선생님 초안이 조각을 고르면 안내를 붙이고, 사용자가 바꾸면 안내를 지운다.
 *   빈 검색 결과의 [‘q’ 추가하기]는 고른 조각을 미리 고른다(`presetChunk`, J6). 맨 아래 기본 단어 넣기 줄은 없다(§28-6 A ③).
 * - 오류 문구는 `labels.ts` 표(서버 문구는 400 만) — 뜻 채우기 실패 문구에 엔진 용어가 새지 않게.
 */
import { useEffect, useRef, useState } from 'react'
import { apiPost, isAbort } from '@/components/common/api'
import { detailString, retryAfterOf, toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { elapsedSec, useCountdown, useNow } from '@/components/common/useNow'
import type { WordChunkType, WordEntry, WordEnrichResponse, WordSaveResponse } from '@/types/vocab'
import { actionErrorText, BASE_DUPLICATE_HINT, BASE_DUPLICATE_TEXT, CHUNK_PICK_DRAFT, DRAFT_INVALID, DUPLICATE_TEXT, enrichErrorText, OPEN_EXISTING_WORD } from './labels'
import {
  draftIsEmpty,
  duplicateOf,
  EXTRA_FIELDS,
  emptyForm,
  fieldOf,
  firstErrorField,
  formFromDraft,
  toCreateBody,
  validateSurface,
  validateWord,
  type WordDuplicate,
  type WordField,
  type WordFormValues,
} from './validate'
import WordForm, { INPUT } from './WordForm'

type Step = 'surface' | 'enriching' | 'form'

const ID = 'wadd'
const TEXT_BTN = 'inline-flex min-h-[44px] items-center text-[13px] font-medium text-accent'

export function DuplicateNote({ id, onOpen }: { id: string; onOpen: () => void }) {
  return (
    <div id={id} role="alert" className="flex flex-wrap items-center gap-x-2 text-[12px] text-bad">
      <span className="break-keep">{DUPLICATE_TEXT}</span>
      <button type="button" onClick={onOpen} className={TEXT_BTN}>
        {OPEN_EXISTING_WORD}
      </button>
    </div>
  )
}

/** 기본 단어와 같은 표현(§28-4 E) — [그 단어 보기]는 그 기본 단어 상세(읽기 전용)를 연다. 상세 시트(내 단어 수정)도 같이 쓴다. */
export function BaseDuplicateNote({ id, onOpen }: { id: string; onOpen: () => void }) {
  return (
    <div id={id} role="alert" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-bad">
        <span className="break-keep">{BASE_DUPLICATE_TEXT}</span>
        <button type="button" onClick={onOpen} className={TEXT_BTN}>
          {OPEN_EXISTING_WORD}
        </button>
      </div>
      <p className="text-[12px] text-ink2 break-keep">{BASE_DUPLICATE_HINT}</p>
    </div>
  )
}

/** 중복 409 안내 하나 — 기본 단어면 `BaseDuplicateNote`, 내 단어끼리면 `DuplicateNote`. */
export function WordDuplicateNote({ id, dup, onOpenWord }: { id: string; dup: WordDuplicate; onOpenWord: (id: string) => void }) {
  return dup.base ? <BaseDuplicateNote id={id} onOpen={() => onOpenWord(dup.id)} /> : <DuplicateNote id={id} onOpen={() => onOpenWord(dup.id)} />
}

export default function WordAddSheet({
  presetSurface,
  presetChunk,
  defaultCategory,
  categories,
  onClose,
  onSaved,
  onOpenWord,
}: {
  presetSurface?: string
  /** 조각을 고른 채 빈 검색 결과에서 열면 그 조각을 미리 고른다(J6). */
  presetChunk?: WordChunkType | null
  defaultCategory?: string | null
  categories: readonly string[]
  onClose: () => void
  onSaved: (word: WordEntry) => void
  onOpenWord: (id: string) => void
}) {
  const [step, setStep] = useState<Step>('surface')
  const [form, setForm] = useState<WordFormValues>(() => emptyForm(presetSurface ?? '', defaultCategory ?? '', presetChunk ?? ''))
  const [chunkNote, setChunkNote] = useState<string | null>(null)
  const [fromDraft, setFromDraft] = useState(false)
  const [draftEmpty, setDraftEmpty] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<WordField, string>>>({})
  const [surfaceMsg, setSurfaceMsg] = useState<{ text: string; reason?: string | null } | null>(null)
  const [dup, setDup] = useState<WordDuplicate | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [enrichStartedAt, setEnrichStartedAt] = useState<number | null>(null)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [blockedSec, setBlockedSec] = useState(0)
  const [extras, setExtras] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const surfaceRef = useRef<HTMLInputElement>(null)

  const now = useNow(step === 'enriching')
  const left = useCountdown(blockedUntil)
  const blocked = blockedUntil !== null && left !== 0
  const waitSec = left ?? blockedSec

  // 시트가 제목에 포커스를 준 **뒤에** 표현 입력으로 옮긴다(자식 effect 가 시트 effect 보다 먼저 돈다).
  useEffect(() => {
    const id = requestAnimationFrame(() => surfaceRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  const set = <K extends keyof WordFormValues>(k: K, v: WordFormValues[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k as WordField]) setErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'surface') {
      setDup(null)
      setSurfaceMsg(null)
    }
    if (k === 'chunkType') setChunkNote(null)
  }

  const focusField = (f: WordField) => {
    if (EXTRA_FIELDS.includes(f)) setExtras(true)
    setTimeout(() => document.getElementById(`${ID}_${f}`)?.focus(), 0)
  }

  const enrich = async () => {
    if (step === 'enriching' || blocked) return
    const surface = form.surface.trim()
    const bad = validateSurface(surface)
    if (bad) {
      setErrors({ surface: bad })
      if (step === 'surface') surfaceRef.current?.focus()
      else focusField('surface')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const backTo: Step = step
    setStep('enriching')
    setEnrichStartedAt(Date.now())
    setSurfaceMsg(null)
    setDup(null)
    setErrors({})
    setFormError(null)
    try {
      const r = await apiPost<WordEnrichResponse | WordSaveResponse>('/api/v1/words', { surface, enrich: true }, { signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      if (r.saved) {
        onSaved(r.word)
        return
      }
      const d = r.draft ?? {}
      if (d.valid === false) {
        setStep('surface')
        setSurfaceMsg({ text: DRAFT_INVALID, reason: d.invalidReason ?? null })
        return
      }
      const empty = draftIsEmpty(d)
      const next = formFromDraft(surface, d, form.category, form.chunkType)
      setForm(next)
      setChunkNote(d.chunkType ? CHUNK_PICK_DRAFT : null)
      setFromDraft(!empty)
      setDraftEmpty(empty)
      setExtras(!!(next.example || next.exampleKo))
      setStep('form')
    } catch (e) {
      if (isAbort(e)) return
      const err = toErr(e)
      setStep(backTo === 'form' ? 'form' : 'surface')
      const d = duplicateOf(err)
      if (d) {
        setDup(d)
        return
      }
      if (err.status === 429) {
        const sec = retryAfterOf(err)
        setBlockedSec(sec)
        setBlockedUntil(Date.now() + sec * 1000)
        return
      }
      setSurfaceMsg({ text: enrichErrorText(err) })
    }
  }

  const stopEnrich = () => {
    abortRef.current?.abort()
    setStep('surface')
  }

  const save = async () => {
    if (submitting) return
    const errs = validateWord(form)
    const first = firstErrorField(errs)
    if (first) {
      setErrors(errs)
      focusField(first)
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const r = await apiPost<WordSaveResponse>('/api/v1/words', toCreateBody(form))
      onSaved(r.word)
    } catch (e) {
      const err = toErr(e)
      setSubmitting(false)
      const d = duplicateOf(err)
      if (d) {
        setDup(d)
        focusField('surface')
        return
      }
      if (err.status === 400) {
        const f = fieldOf(detailString(err, 'field'))
        if (f) {
          setErrors((x) => ({ ...x, [f]: err.message || actionErrorText(err) }))
          focusField(f)
        } else setFormError(actionErrorText(err))
        return
      }
      setFormError(actionErrorText(err))
    }
  }

  const surfaceEmpty = !form.surface.trim()
  // 80자 초과는 누르기 전에 입력 아래에 바로 보인다(§4-2 B). 빈 표현은 버튼 아래 이유 문구로 알린다.
  const tooLong = !surfaceEmpty && !!validateSurface(form.surface)
  const surfaceError = errors.surface ?? (tooLong ? validateSurface(form.surface) : null)
  const surfaceInvalid = !!surfaceError || !!dup || !!surfaceMsg
  const enrichDisabled = blocked || surfaceEmpty || tooLong

  const blockedLine = blocked ? (
    <p role="status" className="text-[12px] text-bad break-keep">
      {enrichErrorText({ status: 429 }, waitSec)}
    </p>
  ) : null

  let content: React.ReactNode
  if (step === 'enriching') {
    const sec = elapsedSec(now, enrichStartedAt)
    content = (
      <div className="flex flex-col gap-3">
        <p lang="ja" className="text-[20px] font-semibold [overflow-wrap:anywhere]">
          {form.surface.trim()}
        </p>
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-[14px] bg-surface2 p-3.5 text-[14px] text-ink">
          <span aria-hidden="true" className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink2" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink2 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink2 [animation-delay:300ms]" />
          </span>
          <span className="break-keep">
            {sec >= 8 ? '조금 오래 걸리고 있어요' : '선생님이 뜻을 찾고 있어요'} · {sec}초
          </span>
        </div>
        <Btn variant="ghost" className="w-full" onClick={stopEnrich}>
          그만두기
        </Btn>
      </div>
    )
  } else if (step === 'surface') {
    content = (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void enrich()
        }}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${ID}_surface`} className="text-[12.5px] font-medium text-ink2">
            표현
          </label>
          <input
            id={`${ID}_surface`}
            ref={surfaceRef}
            lang="ja"
            value={form.surface}
            autoComplete="off"
            enterKeyHint="go"
            placeholder="예: 映画, 食べる, よろしくお願いします"
            onChange={(e) => set('surface', e.target.value)}
            aria-invalid={surfaceInvalid || undefined}
            aria-describedby={surfaceInvalid ? `${ID}_surface_err` : undefined}
            className={`${INPUT} ${surfaceInvalid ? 'border-bad' : 'border-line'}`}
          />
          {dup ? (
            <WordDuplicateNote id={`${ID}_surface_err`} dup={dup} onOpenWord={onOpenWord} />
          ) : surfaceError ? (
            <p id={`${ID}_surface_err`} className="text-[12px] text-bad break-keep">
              {surfaceError}
            </p>
          ) : surfaceMsg ? (
            <div id={`${ID}_surface_err`} role="alert">
              <p className="text-[12px] text-bad break-keep">{surfaceMsg.text}</p>
              {surfaceMsg.reason ? <p className="mt-0.5 text-[13px] text-ink2 break-keep">{surfaceMsg.reason}</p> : null}
            </div>
          ) : null}
          {blockedLine}
        </div>
        <Btn
          type="submit"
          className={`mt-1 w-full ${enrichDisabled ? 'opacity-40' : ''}`}
          aria-disabled={enrichDisabled || undefined}
          aria-describedby={surfaceEmpty && !blocked ? `${ID}_enrich_why` : undefined}
        >
          뜻 채우기
        </Btn>
        {surfaceEmpty && !blocked ? (
          <p id={`${ID}_enrich_why`} className="text-[12px] text-ink2 break-keep">
            표현을 적으면 누를 수 있어요.
          </p>
        ) : null}
        <p className="text-[12px] text-ink2 break-keep">선생님이 읽기·뜻·예문을 채워 줘요. 확인하고 저장해야 단어장에 들어가요.</p>
        <Btn
          variant="ghost"
          className="w-full"
          onClick={() => {
            setFromDraft(false)
            setDraftEmpty(false)
            setChunkNote(null)
            setErrors({})
            setStep('form')
          }}
        >
          직접 입력하기
        </Btn>
      </form>
    )
  } else {
    content = (
      <form
        className="flex flex-col gap-3"
        aria-busy={submitting || undefined}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {fromDraft ? (
          <p className="rounded-xl bg-accent-soft p-2.5 text-[13px] text-ink break-keep">
            선생님이 채운 초안이에요. 틀린 곳은 고쳐 주세요. 저장해야 단어장에 들어가요.
          </p>
        ) : null}
        {draftEmpty ? <p className="rounded-xl bg-surface2 p-2.5 text-[13px] text-ink2 break-keep">뜻을 찾지 못했어요. 직접 입력해 주세요.</p> : null}
        {surfaceMsg ? (
          <p role="alert" className="text-[12px] text-bad break-keep">
            {surfaceMsg.text}
          </p>
        ) : null}
        {blockedLine}
        <WordForm
          values={form}
          errors={errors}
          onChange={set}
          categories={categories}
          expandExtras={extras}
          onToggleExtras={() => setExtras((x) => !x)}
          idPrefix={ID}
          surfaceNote={dup ? <WordDuplicateNote id={`${ID}_dup`} dup={dup} onOpenWord={onOpenWord} /> : null}
          surfaceNoteId={dup ? `${ID}_dup` : undefined}
          chunkNote={chunkNote}
        />
        {formError ? (
          <p role="alert" className="text-[13px] text-bad break-keep">
            {formError}
          </p>
        ) : null}
        <BtnRow>
          <Btn type="submit" aria-disabled={submitting || undefined} aria-busy={submitting || undefined}>
            {submitting ? '저장하는 중…' : '저장'}
          </Btn>
          <Btn variant="ghost" onClick={onClose} aria-disabled={submitting || undefined}>
            취소
          </Btn>
        </BtnRow>
        {fromDraft ? (
          <button type="button" onClick={() => void enrich()} aria-disabled={blocked || submitting || undefined} className={`${TEXT_BTN} self-center`}>
            다시 채우기
          </button>
        ) : null}
      </form>
    )
  }

  return (
    <Sheet open title="단어 추가" onClose={onClose} dismissible={!submitting && step !== 'enriching'}>
      {content}
    </Sheet>
  )
}
