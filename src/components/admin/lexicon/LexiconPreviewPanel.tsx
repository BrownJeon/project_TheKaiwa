'use client'

/**
 * 미리듣기(screens.md §10-2 E). compare = 적용 전(지금 사전) / 적용 후(이 입력) 두 줄, current = 지금 사전 한 줄.
 * 초안은 저장되지 않는다(`draftEntries`) — 이유·확인 문구를 묻지 않는다. 자동재생 없음: ▶ 탭 안에서만.
 * 높낮이는 목소리가 실제로 읽을 것을 그대로 보인다(입력한 악센트와 달라도 오류가 아니다, §10-11 ①).
 */
import { useId, useState } from 'react'
import { cpLength } from '@/components/common/format'
import { Btn } from '@/components/common/ui'
import type { AdminVoiceDto } from '@/types/admin'
import type { LexiconPreviewSideDto } from '@/types/lexicon'
import { autoGrow } from './autoGrow'
import { draftKey, spokenAccent, stripArrows } from './kana'
import type { DraftEntryBody, PreviewBody } from './lexiconApi'
import { fieldErrorText, notHitText, PREVIEW, PREVIEW_TEXT_MAX } from './lexiconCopy'
import { INPUT, LABEL, TEXTAREA } from './lexiconStyles'
import { type PreviewSide, useLexiconPreview } from './useLexiconPreview'

function PlayButton({
  side,
  label,
  playing,
  loading,
  disabled,
  onClick,
}: {
  side: PreviewSide
  label: string
  playing: boolean
  loading: boolean
  disabled: boolean
  onClick: (side: PreviewSide) => void
}) {
  return (
    <button
      type="button"
      aria-label={playing ? '멈추기' : label}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={() => onClick(side)}
      className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface text-ink disabled:opacity-40"
    >
      {loading ? (
        <span aria-hidden="true" className="text-[15px] leading-none">
          …
        </span>
      ) : playing ? (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 2.5v11l8.5-5.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}

function ReadingRow({
  label,
  side,
  which,
  playLabel,
  className = '',
  preview,
}: {
  label: string
  side: LexiconPreviewSideDto
  which: PreviewSide
  playLabel: string
  className?: string
  preview: ReturnType<typeof useLexiconPreview>
}) {
  const shown = side.accent || side.reading
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink2">{label}</p>
        {shown ? (
          <p lang="ja" aria-label={spokenAccent(shown)} className="text-[16px] leading-[1.7] [overflow-wrap:anywhere]">
            {shown}
          </p>
        ) : (
          <p className="text-[13px] text-ink2">{PREVIEW.readingFailed}</p>
        )}
        {side.accent && side.reading && stripArrows(side.accent) !== side.reading ? (
          <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
            {side.reading}
          </p>
        ) : null}
      </div>
      <PlayButton
        side={which}
        label={playLabel}
        playing={preview.playing === which}
        loading={preview.audioLoading === which}
        disabled={preview.stale || preview.cooling}
        onClick={preview.play}
      />
    </div>
  )
}

export function usableVoices(voices: readonly AdminVoiceDto[]): AdminVoiceDto[] {
  return voices.filter((v) => v.status === 'AVAILABLE' && v.enabled)
}

export default function LexiconPreviewPanel({
  mode,
  draft,
  draftValid = true,
  initialText = '',
  voices,
  lockedVoiceId = null,
  onInvalidDraft,
  embedded = false,
}: {
  mode: 'compare' | 'current'
  draft?: DraftEntryBody | null
  draftValid?: boolean
  initialText?: string
  voices: readonly AdminVoiceDto[]
  lockedVoiceId?: string | null
  onInvalidDraft?: () => void
  /** 문장 확인(목록 머리)처럼 제목·소개를 바깥이 그리는 곳. */
  embedded?: boolean
}) {
  const uid = useId()
  const [ownText, setOwnText] = useState<string | null>(null)
  const [ownVoice, setOwnVoice] = useState('')
  const [textError, setTextError] = useState<string | null>(null)
  const text = ownText ?? (mode === 'compare' ? draft?.surface ?? '' : initialText)
  const voiceId = lockedVoiceId ?? ownVoice
  const draftPart = mode === 'compare' && draft ? [draft.surface, draft.reading, draft.accentType, draft.priority, draft.scope, draft.scopeRefId, draft.wordType] : []
  const key = draftKey([mode, ...draftPart, text, voiceId])
  const p = useLexiconPreview(key)
  const usable = usableVoices(voices)
  const lockedName = lockedVoiceId ? voices.find((v) => v.id === lockedVoiceId)?.displayName ?? null : null

  const onCheck = () => {
    if (mode === 'compare' && (!draftValid || !draft)) {
      onInvalidDraft?.()
      return
    }
    const t = text.trim()
    const n = cpLength(t)
    if (!t || n > PREVIEW_TEXT_MAX) {
      setTextError(fieldErrorText('text', !t ? { code: 'REQUIRED' } : { code: 'TOO_LONG', n }))
      document.getElementById(`${uid}-text`)?.focus()
      return
    }
    setTextError(null)
    const body: PreviewBody = { text: t, ...(voiceId ? { voiceId } : {}), compare: mode === 'compare', ...(mode === 'compare' && draft ? { draftEntries: [draft] } : {}) }
    void p.check(body)
  }

  const d = p.result?.data ?? null
  const after = d?.after ?? null
  const draftSurface = draft?.surface ?? ''
  const hits = after ? (after.matches.some((m) => m.source === 'DRAFT') ? after.matches.filter((m) => m.source === 'DRAFT').length : after.matches.filter((m) => m.surface === draftSurface).length) : 0
  const changed = d && after ? d.before.accent !== after.accent || d.before.reading !== after.reading : false

  return (
    <section aria-labelledby={embedded ? undefined : `${uid}-title`} aria-label={embedded ? PREVIEW.title : undefined} className={embedded ? '' : 'mt-4'}>
      {embedded ? null : (
        <>
          <h3 id={`${uid}-title`} className="text-[14px] font-semibold">
            {PREVIEW.title}
          </h3>
          <p className="text-[12px] text-ink2 break-keep">{mode === 'compare' ? PREVIEW.compareHelp : PREVIEW.currentHelp}</p>
        </>
      )}
      <div className="mt-2 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={`${uid}-text`} className={LABEL}>
            예문
          </label>
          <span className="text-[12px] tabular-nums text-ink2">
            {cpLength(text)}/{PREVIEW_TEXT_MAX}
          </span>
        </div>
        <textarea
          id={`${uid}-text`}
          lang="ja"
          rows={1}
          value={text}
          aria-invalid={textError ? true : undefined}
          aria-describedby={textError ? `${uid}-text-err` : undefined}
          onChange={(e) => {
            setOwnText(e.target.value)
            setTextError(null)
            autoGrow(e.currentTarget, 3)
          }}
          className={`${TEXTAREA} mt-1.5`}
        />
        {textError ? (
          <p id={`${uid}-text-err`} className="mt-1 text-[12px] text-bad">
            {textError}
          </p>
        ) : null}
      </div>
      <div className="mt-2 min-w-0">
        <label htmlFor={`${uid}-voice`} className={LABEL}>
          목소리
        </label>
        {lockedVoiceId ? (
          <>
            <select id={`${uid}-voice`} disabled value={lockedVoiceId} className={`${INPUT} mt-1.5`} onChange={() => undefined}>
              <option value={lockedVoiceId}>{lockedName ?? '고른 목소리'}</option>
            </select>
            <p className="mt-1 text-[12px] text-ink2">{PREVIEW.lockedVoice}</p>
          </>
        ) : (
          <select id={`${uid}-voice`} value={ownVoice} onChange={(e) => setOwnVoice(e.target.value)} className={`${INPUT} mt-1.5`}>
            <option value="">기본 목소리</option>
            {usable.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </select>
        )}
      </div>
      <Btn variant="ghost" className="mt-2 w-full" aria-busy={p.phase === 'checking'} disabled={p.cooling} onClick={onCheck}>
        {p.phase === 'checking' ? PREVIEW.checking : p.cooling ? `${p.remaining ?? ''}초 뒤 다시` : PREVIEW.check}
      </Btn>
      {mode === 'compare' && !draftValid ? <p className="mt-1 text-[12px] text-ink2">{PREVIEW.invalidDraft}</p> : null}
      <div aria-live="polite" className="min-w-0">
        {d ? (
          <div className={`mt-2 rounded-xl border border-line bg-surface2 p-3 ${p.stale ? 'opacity-60' : ''}`}>
            <ReadingRow
              label={mode === 'compare' ? `적용 전 · 지금 사전 v${d.dictionaryVersion}` : `지금 사전 v${d.dictionaryVersion}`}
              side={d.before}
              which="before"
              playLabel={mode === 'compare' ? '적용 전 읽기 듣기' : '지금 사전으로 듣기'}
              preview={p}
            />
            {after ? (
              <ReadingRow label="적용 후 · 이 입력" side={after} which="after" playLabel="적용 후 읽기 듣기" className="mt-2 border-t border-line pt-2" preview={p} />
            ) : null}
            {after ? (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink break-keep">
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-none rounded-full ${changed ? 'bg-good' : 'bg-ink2'}`} />
                <span>
                  {changed ? PREVIEW.changed : PREVIEW.same}
                  {hits > 0 ? ` · 이 예문에 ${hits}번 적용` : ''}
                </span>
              </p>
            ) : null}
            {after && hits === 0 ? <p className="mt-1 text-[13px] text-ink break-keep">{notHitText(draftSurface)}</p> : null}
            {p.stale ? <p className="mt-1 text-[12px] text-ink2">{PREVIEW.stale}</p> : null}
          </div>
        ) : null}
        {p.notice ? <p className="mt-2 text-[13px] text-ink break-keep">{p.notice}</p> : null}
      </div>
    </section>
  )
}
