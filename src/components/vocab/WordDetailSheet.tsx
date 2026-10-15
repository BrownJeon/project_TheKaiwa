'use client'

/**
 * 단어 상세 시트(screens.md §4-2 C) — view · edit · confirmDelete. 목록 행 값(`preview`)으로 바로 그리고 #42 로 기록·출처를 채운다.
 * 부모가 단어마다 `key` 로 다시 마운트한다. 서버 응답을 받은 뒤에만 반영한다(보관·삭제·수정).
 * 카운터·출처는 읽기 전용(§4-10). 출처 절은 목록 뱃지가 조각으로 바뀐 뒤에도 남긴다(task-023 결정 e).
 * 소리 듣기(task-023): 표현 오른쪽 ▶(단어) + 예문 카드 ▶(예문, #23 한도 100자 넘으면 숨김). 소리는 한 번에 하나이고
 * [수정]·[삭제]로 넘어가거나 시트를 닫으면(언마운트) 멈춘다.
 * task-068(§28-5 B): **기본 단어는 읽기 전용** — [수정]·[삭제] 없이 보관(숨기기) 단추 하나, 「기본 단어」 뱃지, 출처 문장, 「추가한 날」 없음.
 * 내 단어는 [수정][보관하기] + 아래 글자 [삭제] 그대로 + 「내 단어」 뱃지 + 출처 문장 「 · 나만 봐요」. 판정은 응답 값만(`isReadOnlyWord`).
 * 공용 `Sheet` 가 포털이라 서버 렌더 시험이 안 되므로 뱃지·출처·단추는 훅 없는 부품(`DetailOriginBadge`·`DetailSource`·`DetailActions`)으로 뺐다.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { kstDateKey } from '@/components/common/format'
import Sheet from '@/components/common/Sheet'
import { useAnnotation, useWordLayers } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Badge, Btn, BtnRow, LoadingBlock } from '@/components/common/ui'
import type { WordArchiveResponse, WordEntry, WordStats } from '@/types/vocab'
import { formatMonthDay } from './format'
import {
  actionErrorText,
  BASE_ARCHIVE_BTN,
  BASE_SOURCE_SENTENCE,
  BASE_UNARCHIVE_BTN,
  categoryBadgeText,
  CHUNK_LABEL,
  levelLabel,
  MINE_SOURCE_SUFFIX,
  POS_LABEL,
  RESULT_LABEL,
  SOURCE_SENTENCE,
} from './labels'
import {
  archiveToastText,
  diffPatch,
  duplicateOf,
  EXTRA_FIELDS,
  fieldOf,
  firstErrorField,
  formFromWord,
  isReadOnlyWord,
  normalizeWordDetail,
  validateWord,
  type WordDuplicate,
  type WordField,
  type WordFormValues,
} from './validate'
import { WordDuplicateNote } from './WordAddSheet'
import WordForm from './WordForm'
import { BaseBadge, MineBadge } from './WordRow'
import { WordSoundButton, WordSoundLine } from './WordSoundButton'
import { useWordSound } from './useWordSound'
import { soundText } from './wordSound'

type Mode = 'view' | 'edit' | 'confirmDelete'

const ID = 'wedit'

function dateOf(iso: string | null | undefined): string {
  return iso ? formatMonthDay(kstDateKey(iso)) : ''
}

/** 상세 뱃지 줄 끝의 출처 뱃지(§28-5 B) — 기본 단어 = 테두리 「기본 단어」, 내 단어 = 「내 단어」. */
export function DetailOriginBadge({ readOnly }: { readOnly: boolean }) {
  return readOnly ? <BaseBadge /> : <MineBadge />
}

/** 출처 절. 기본 단어는 고정 문장 하나(넣은 날은 내 날짜가 아니라 그리지 않는다), 내 단어는 출처 문장 + 「 · 나만 봐요」 + 교정 링크 + 추가한 날. */
export function DetailSource({ w, readOnly, correction }: { w: WordEntry; readOnly: boolean; correction?: { id: string; chatId: string } }) {
  if (readOnly) {
    return (
      <>
        <h3 className="mt-4 text-[13px] font-semibold text-ink2">출처</h3>
        <p className="mt-1 text-[14px] break-keep">{BASE_SOURCE_SENTENCE}</p>
      </>
    )
  }
  return (
    <>
      <h3 className="mt-4 text-[13px] font-semibold text-ink2">출처</h3>
      <p className="mt-1 text-[14px] break-keep">
        {SOURCE_SENTENCE[w.source] ?? SOURCE_SENTENCE.MANUAL}
        {MINE_SOURCE_SUFFIX}
      </p>
      {correction ? (
        <Link
          href={`/study/ai/chat/${encodeURIComponent(correction.chatId)}/review#cr_${encodeURIComponent(correction.id)}`}
          className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-accent"
        >
          점검 결과 보기 ›
        </Link>
      ) : null}
      {w.createdAt ? <p className="text-[12px] text-ink2">추가한 날 {dateOf(w.createdAt)}</p> : null}
    </>
  )
}

/** 상세 단추. 기본 단어 = 보관 단추 하나(D6 A), 내 단어 = [수정][보관하기] + 아래 가운데 글자 [삭제](지금 그대로). */
export function DetailActions({
  readOnly,
  archived,
  busy,
  onEdit,
  onArchive,
  onDelete,
}: {
  readOnly: boolean
  archived: boolean
  busy: boolean
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  if (readOnly) {
    return (
      <Btn variant="ghost" className="mt-3 w-full" onClick={onArchive} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
        {archived ? BASE_UNARCHIVE_BTN : BASE_ARCHIVE_BTN}
      </Btn>
    )
  }
  return (
    <>
      <BtnRow>
        <Btn variant="ghost" onClick={onEdit} aria-disabled={busy || undefined}>
          수정
        </Btn>
        <Btn variant="ghost" onClick={onArchive} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {archived ? '보관 풀기' : '보관하기'}
        </Btn>
      </BtnRow>
      <div className="mt-1 flex justify-center">
        <button type="button" onClick={onDelete} aria-disabled={busy || undefined} className="min-h-[44px] px-4 text-[14px] font-medium text-bad">
          삭제
        </button>
      </div>
    </>
  )
}

export default function WordDetailSheet({
  wordId,
  preview,
  categories,
  onClose,
  onChanged,
  onRemoved,
  onArchivedChange,
  onOpenWord,
  onNotFound,
  onToast,
}: {
  wordId: string
  preview?: WordEntry
  categories: readonly string[]
  onClose: () => void
  onChanged: (w: WordEntry) => void
  onRemoved: (id: string) => void
  onArchivedChange: (w: WordEntry) => void
  onOpenWord: (id: string) => void
  onNotFound: () => void
  onToast: (msg: string) => void
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [word, setWord] = useState<WordEntry | null>(preview ?? null)
  const [stats, setStats] = useState<WordStats | null>(null)
  const [corrections, setCorrections] = useState<{ id: string; chatId: string }[]>([])
  const [detailState, setDetailState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<WordFormValues | null>(null)
  const [errors, setErrors] = useState<Partial<Record<WordField, string>>>({})
  const [dup, setDup] = useState<WordDuplicate | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [extras, setExtras] = useState(false)
  const onNotFoundRef = useRef(onNotFound)
  useEffect(() => {
    onNotFoundRef.current = onNotFound
  }, [onNotFound])
  const sound = useWordSound()
  // 표제어 = 저장 읽기 루비 + 분석 한글(읽기가 다르면 저장 읽기 재분석, 그것도 안 되면 숨김 — task-071), 예문 = 저장 읽기가 없어 분석(task-026 §15-4-5). 수정 폼에서는 쓰지 않는다.
  const head = useWordLayers(word?.surface ?? '', word?.reading)
  const exAnn = useAnnotation(word?.example ?? '')

  useEffect(() => {
    let cancelled = false
    apiGet<unknown>(`/api/v1/words/${encodeURIComponent(wordId)}`)
      .then((raw) => {
        if (cancelled) return
        const d = normalizeWordDetail(raw)
        if (d.word && typeof d.word.id === 'string') setWord(d.word)
        setStats(d.stats)
        setCorrections(d.corrections)
        setDetailState('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (toErr(e).status === 404) onNotFoundRef.current()
        else setDetailState('error')
      })
    return () => {
      cancelled = true
    }
  }, [wordId])

  if (!word) {
    return (
      <Sheet open title="단어" onClose={onClose}>
        {detailState === 'error' ? (
          <p role="alert" className="py-6 text-center text-[14px] text-bad break-keep">
            단어를 불러오지 못했어요.
          </p>
        ) : (
          <LoadingBlock />
        )}
      </Sheet>
    )
  }
  const w = word
  const readOnly = isReadOnlyWord(w)

  const set = <K extends keyof WordFormValues>(k: K, v: WordFormValues[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f))
    if (errors[k as WordField]) setErrors((e) => ({ ...e, [k]: undefined }))
    if (k === 'surface') setDup(null)
  }

  const focusField = (f: WordField) => {
    if (EXTRA_FIELDS.includes(f)) setExtras(true)
    setTimeout(() => document.getElementById(`${ID}_${f}`)?.focus(), 0)
  }

  const startEdit = () => {
    if (readOnly) return
    sound.stop()
    const f = formFromWord(w)
    setForm(f)
    setErrors({})
    setDup(null)
    setFormError(null)
    setExtras(!!(f.example || f.exampleKo || f.note))
    setMode('edit')
  }

  const saveEdit = async () => {
    if (busy || !form) return
    const errs = validateWord(form)
    const first = firstErrorField(errs)
    if (first) {
      setErrors(errs)
      focusField(first)
      return
    }
    const body = diffPatch(w, form)
    if (Object.keys(body).length === 0) {
      setMode('view')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      const updated = await apiPatch<WordEntry>(`/api/v1/words/${encodeURIComponent(w.id)}`, body)
      const next = { ...w, ...updated }
      setWord(next)
      onChanged(next)
      onToast('고쳤어요')
      setMode('view')
    } catch (e) {
      const err = toErr(e)
      if (err.status === 404) {
        onNotFound()
        return
      }
      const d = duplicateOf(err)
      if (d) {
        setDup(d)
        focusField('surface')
      } else if (err.status === 400 && fieldOf(detailString(err, 'field'))) {
        const f = fieldOf(detailString(err, 'field'))!
        setErrors((x) => ({ ...x, [f]: err.message || actionErrorText(err) }))
        focusField(f)
      } else setFormError(actionErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async () => {
    if (busy) return
    setBusy(true)
    const toArchive = !w.archived
    try {
      const r = await apiPost<WordArchiveResponse>(`/api/v1/words/${encodeURIComponent(w.id)}/${toArchive ? 'archive' : 'unarchive'}`)
      const next: WordEntry = { ...w, ...r, archived: typeof r?.archived === 'boolean' ? r.archived : toArchive }
      setWord(next)
      onArchivedChange(next)
      onToast(archiveToastText(readOnly, next.archived))
    } catch (e) {
      const err = toErr(e)
      if (err.status === 404) onNotFound()
      else onToast(actionErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try {
      await apiDelete(`/api/v1/words/${encodeURIComponent(w.id)}`)
      onRemoved(w.id)
    } catch (e) {
      const err = toErr(e)
      setBusy(false)
      // 이미 없으면 지운 것과 같다(§4-4 #44)
      if (err.status === 404) onRemoved(w.id)
      else onToast(actionErrorText(err))
    }
  }

  let content: React.ReactNode
  if (mode === 'edit' && form) {
    content = (
      <form
        className="flex flex-col gap-3"
        aria-busy={busy || undefined}
        onSubmit={(e) => {
          e.preventDefault()
          void saveEdit()
        }}
      >
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
        />
        <p className="text-[12px] text-ink2 break-keep">맞힘·틀림 기록과 출처는 바꿀 수 없어요.</p>
        {formError ? (
          <p role="alert" className="text-[13px] text-bad break-keep">
            {formError}
          </p>
        ) : null}
        <BtnRow>
          <Btn type="submit" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy ? '저장하는 중…' : '저장'}
          </Btn>
          <Btn variant="ghost" onClick={() => setMode('view')} aria-disabled={busy || undefined}>
            취소
          </Btn>
        </BtnRow>
      </form>
    )
  } else if (mode === 'confirmDelete') {
    content = (
      <div aria-busy={busy || undefined}>
        <p className="text-[17px] font-semibold">이 단어를 삭제할까요?</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep [overflow-wrap:anywhere]">
          ‘<span lang="ja">{w.surface}</span>’를 단어장에서 지워요. 지난 기록과 통계는 그대로 남아요.
        </p>
        <BtnRow>
          <Btn variant="danger" onClick={() => void remove()} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
            {busy ? '삭제하는 중…' : '삭제'}
          </Btn>
          <Btn variant="ghost" onClick={() => setMode('view')} aria-disabled={busy || undefined}>
            취소
          </Btn>
        </BtnRow>
      </div>
    )
  } else {
    const played = w.correctCount + w.wrongCount > 0 || !!w.lastSeenAt
    const correction = !readOnly && w.source === 'CORRECTION' ? corrections[0] : undefined
    const wordText = soundText(w.surface)
    const exText = soundText(w.example)
    content = (
      <div aria-busy={busy || undefined}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <JaText
              text={w.surface}
              state={head.hangul}
              ruby={head.ruby}
              leading={1.8}
              rt={13}
              className="text-[28px] font-semibold leading-tight [overflow-wrap:anywhere]"
            />
            <HangulLine state={head.hangul} size={14} />
          </div>
          {wordText ? <WordSoundButton state={sound.state} target="word" onPress={() => sound.tap('word', wordText)} /> : null}
        </div>
        {wordText ? <WordSoundLine state={sound.state} target="word" onRetry={() => sound.retry('word', wordText)} /> : null}
        <p className="mt-2 text-[17px] font-medium break-keep [overflow-wrap:anywhere]">{w.meaning}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{POS_LABEL[w.partOfSpeech] ?? '기타'}</Badge>
          {w.jlpt ? <Badge tone="neutral">{levelLabel(w.jlpt)}</Badge> : null}
          {categoryBadgeText(w.category, w.jlpt) ? (
            <Badge tone="neutral">
              <span className="block max-w-[200px] truncate">{w.category}</span>
            </Badge>
          ) : null}
          {w.chunkType ? <Badge tone="neutral">{CHUNK_LABEL[w.chunkType]}</Badge> : null}
          <DetailOriginBadge readOnly={readOnly} />
          {w.archived ? <Badge tone="neutral">보관함</Badge> : null}
        </div>
        {w.example ? (
          <div className="mt-3 rounded-[14px] bg-surface2 p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <JaText text={w.example} state={exAnn} leading={2.15} className="whitespace-pre-wrap text-[16px] leading-[1.7] [overflow-wrap:anywhere]" />
                <HangulLine state={exAnn} size={13} />
                {w.exampleKo ? <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink2 break-keep [overflow-wrap:anywhere]">{w.exampleKo}</p> : null}
              </div>
              {exText ? <WordSoundButton state={sound.state} target="ex" onPress={() => sound.tap('ex', exText)} /> : null}
            </div>
            {exText ? <WordSoundLine state={sound.state} target="ex" inCard onRetry={() => sound.retry('ex', exText)} /> : null}
          </div>
        ) : null}
        {w.note ? (
          <>
            <p className="mt-3 text-[12px] text-ink2">메모</p>
            <p className="whitespace-pre-wrap text-[14px] [overflow-wrap:anywhere]">{w.note}</p>
          </>
        ) : null}

        <h3 className="mt-4 text-[13px] font-semibold text-ink2">기록</h3>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px]">
          <div className="min-w-0">
            <dt className="sr-only">전체</dt>
            <dd className="tabular-nums">
              맞힘 {w.correctCount} · 틀림 {w.wrongCount}
            </dd>
          </div>
          {detailState === 'loading' ? (
            <div className="min-w-0 text-ink2">
              <dt className="sr-only">최근 기록</dt>
              <dd>불러오는 중…</dd>
            </div>
          ) : stats ? (
            <>
              <div className="min-w-0">
                <dt className="sr-only">최근 7일</dt>
                <dd className="tabular-nums">
                  최근 7일 맞힘 {stats.last7d.correct} · 틀림 {stats.last7d.wrong}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="sr-only">푼 횟수</dt>
                <dd className="tabular-nums">푼 횟수 {stats.attempts}</dd>
              </div>
              {stats.evalAppearances > 0 ? (
                <div className="min-w-0">
                  <dt className="sr-only">평가</dt>
                  <dd className="tabular-nums">평가에 나온 횟수 {stats.evalAppearances}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {w.lastSeenAt ? (
            <div className="min-w-0">
              <dt className="sr-only">마지막</dt>
              <dd>
                마지막 {dateOf(w.lastSeenAt)}
                {w.lastResult ? `(${RESULT_LABEL[w.lastResult]})` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
        {!played ? <p className="mt-1 text-[13px] text-ink2 break-keep">아직 오늘의 단어에서 풀지 않았어요</p> : null}

        <DetailSource w={w} readOnly={readOnly} correction={correction} />
        <DetailActions
          readOnly={readOnly}
          archived={w.archived}
          busy={busy}
          onEdit={startEdit}
          onArchive={() => void toggleArchive()}
          onDelete={() => {
            sound.stop()
            setMode('confirmDelete')
          }}
        />
      </div>
    )
  }

  return (
    <Sheet open title="단어" onClose={onClose} dismissible={!busy}>
      {content}
    </Sheet>
  )
}
