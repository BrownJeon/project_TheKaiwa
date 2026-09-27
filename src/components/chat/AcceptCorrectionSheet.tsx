'use client'

/**
 * 교정 채택 시트(screens.md §3-2 F, #35). 단어장 추가는 **선택** — "단어장에 넣고 채택" / "단어장 없이 채택만".
 * 부모가 `key={correction.id}` 로 다시 마운트해 폼을 초기화한다. 첫 입력에 자동 포커스하지 않는다(키보드가 시트를 가림).
 */
import { useState } from 'react'
import { apiPost } from '@/components/common/api'
import Sheet from '@/components/common/Sheet'
import { Btn, Field } from '@/components/common/ui'
import type { CorrectionAcceptBody, CorrectionAcceptResponse, CorrectionDto } from '@/types/chat'
import { detailString, toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { actionErrorText } from './labels'

type FieldName = 'surface' | 'reading' | 'meaning' | 'category'

const INPUT = 'h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink placeholder:text-ink3'

function validate(f: Record<FieldName, string>): Partial<Record<FieldName, string>> {
  const out: Partial<Record<FieldName, string>> = {}
  const s = cpLength(f.surface.trim())
  const m = cpLength(f.meaning.trim())
  if (s < 1 || s > 80) out.surface = '표현을 적어 주세요 (80자 이내)'
  if (m < 1 || m > 200) out.meaning = '뜻을 적어 주세요 (200자 이내)'
  if (cpLength(f.reading.trim()) > 120) out.reading = '읽기는 120자까지 쓸 수 있어요'
  if (cpLength(f.category.trim()) > 40) out.category = '분류는 40자까지 쓸 수 있어요'
  return out
}

/** 서버 `details.field`(예: `addWord.meaning`)를 시트 입력에 맞춘다. */
function fieldOf(raw: string | null): FieldName | null {
  if (!raw) return null
  const last = raw.split('.').pop() ?? raw
  return (['surface', 'reading', 'meaning', 'category'] as const).find((f) => f === last) ?? null
}

export default function AcceptCorrectionSheet({
  correction,
  onClose,
  onDone,
  onConflict,
}: {
  correction: CorrectionDto | null
  onClose: () => void
  onDone: (updated: CorrectionDto, withWord: boolean) => void
  /** 이미 처리된 교정(409) — 부모가 닫고 목록을 다시 읽는다. */
  onConflict: () => void
}) {
  const [form, setForm] = useState<Record<FieldName, string>>(() => ({
    surface: correction && cpLength(correction.corrected) <= 80 ? correction.corrected : '',
    reading: '',
    meaning: '',
    category: '교정',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [duplicate, setDuplicate] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!correction) return null
  const c = correction
  const localErrors = validate(form)
  const wordValid = Object.keys(localErrors).length === 0
  const errors = { ...(showErrors ? localErrors : {}), ...serverErrors }

  const set = (k: FieldName, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (serverErrors[k]) setServerErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'surface') setDuplicate(false)
  }

  const submit = async (withWord: boolean) => {
    if (submitting) return
    if (withWord && !wordValid) {
      setShowErrors(true)
      return
    }
    const surface = form.surface.trim()
    const body: CorrectionAcceptBody = withWord
      ? {
          addWord: {
            surface,
            reading: form.reading.trim() || undefined,
            meaning: form.meaning.trim(),
            category: form.category.trim() || undefined,
            partOfSpeech: surface === c.corrected ? 'EXPRESSION' : undefined,
            chunkType: c.chunkType ?? undefined,
          },
        }
      : {}
    setSubmitting(true)
    setFormError(null)
    try {
      const r = await apiPost<CorrectionAcceptResponse>(`/api/v1/corrections/${encodeURIComponent(c.id)}/accept`, body)
      onDone({ ...c, status: r.correction.status, savedWordId: r.correction.savedWordId ?? null, resolvedAt: r.correction.resolvedAt }, withWord)
    } catch (e) {
      const err = toErr(e)
      setSubmitting(false)
      if (err.status === 409 && detailString(err, 'existingId')) {
        setDuplicate(true)
        return
      }
      if (err.status === 409) {
        onConflict()
        return
      }
      if (err.status === 400) {
        const f = fieldOf(detailString(err, 'field'))
        if (f) setServerErrors((x) => ({ ...x, [f]: err.message || actionErrorText(err) }))
        else setFormError(err.message || actionErrorText(err))
        return
      }
      setFormError(actionErrorText(err))
    }
  }

  const input = (k: FieldName, label: string, opts: { ja?: boolean; placeholder?: string } = {}) => (
    <Field label={label} htmlFor={`acs_${k}`}>
      <input
        id={`acs_${k}`}
        lang={opts.ja ? 'ja' : undefined}
        value={form[k]}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] || (k === 'surface' && duplicate) ? true : undefined}
        aria-describedby={errors[k] || (k === 'surface' && duplicate) ? `acs_${k}_err` : undefined}
        className={`${INPUT} ${errors[k] || (k === 'surface' && duplicate) ? 'border-bad' : 'border-line'}`}
      />
      {k === 'surface' && duplicate ? (
        <p id={`acs_${k}_err`} role="alert" className="text-[12px] text-bad break-keep">
          단어장에 같은 표현이 이미 있어요
        </p>
      ) : errors[k] ? (
        <p id={`acs_${k}_err`} className="text-[12px] text-bad break-keep">
          {errors[k]}
        </p>
      ) : null}
    </Field>
  )

  return (
    <Sheet open title="교정 채택" onClose={onClose} dismissible={!submitting}>
      <div className="flex flex-col gap-3" aria-busy={submitting || undefined}>
        <div>
          <p className="text-[12px] text-good">이렇게 고쳐요</p>
          <p lang="ja" className="mt-1 rounded-xl bg-surface2 p-2.5 text-[17px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]">
            {c.corrected}
          </p>
          <p className="mt-1.5 text-[13px] text-ink2 break-keep">채택하면 선생님이 내가 자주 틀리는 부분으로 기억해요.</p>
        </div>
        <hr className="border-line" />
        <p className="text-[15px] font-semibold">단어장에도 넣을까요? (선택)</p>
        {input('surface', '표현', { ja: true })}
        {input('reading', '읽기', { ja: true, placeholder: '히라가나 (선택)' })}
        {input('meaning', '뜻', { placeholder: '한국어 뜻 (예: 어제 영화를 보러 갔어요)' })}
        {input('category', '분류')}
        {formError ? (
          <p role="alert" className="text-[13px] text-bad break-keep">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 pb-1">
          <Btn
            variant={duplicate ? 'ghost' : 'primary'}
            className={`w-full ${!wordValid || submitting ? 'opacity-60' : ''}`}
            aria-disabled={!wordValid || submitting || undefined}
            onClick={() => void submit(true)}
          >
            {submitting ? '처리 중…' : '단어장에 넣고 채택'}
          </Btn>
          <Btn
            variant={duplicate ? 'primary' : 'ghost'}
            className={`w-full ${submitting ? 'opacity-60' : ''}`}
            aria-disabled={submitting || undefined}
            onClick={() => void submit(false)}
          >
            단어장 없이 채택만
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
