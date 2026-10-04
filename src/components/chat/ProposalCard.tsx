'use client'

/**
 * 강사 제안 카드(screens.md §3-2 G) — `ADD_WORD`(채팅방, 해당 강사 말풍선 아래) · `ADD_STUDY_LOG`(점검 결과 상단).
 * **AI 는 제안만 한다**: 채택·거절은 응답을 받은 뒤에만 반영하고(낙관적 갱신 없음), 채택 전엔 "저장됨" 류 문구를 보이지 않는다.
 * task-026(screens §15-4-2 MOV ②): 단어 표제어는 옆 읽기 대신 위 히라가나(저장 읽기 정렬) + 아래 `[한글]`. 처리된 줄은 머리줄이라 달지 않는다.
 */
import { useState } from 'react'
import { apiPost } from '@/components/common/api'
import { Btn, BtnRow } from '@/components/common/ui'
import { OFF, useWordLayers } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import type { ProposalAcceptResponse, ProposalDto, ProposalRejectResponse, ProposalStatus, StudyLogPayload } from '@/types/chat'
import { detailString, toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { actionErrorText } from './labels'

const STATUSES: readonly ProposalStatus[] = ['PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED']

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export default function ProposalCard({
  proposal,
  onChange,
  onToast,
  caption,
  note,
}: {
  proposal: ProposalDto
  onChange: (p: ProposalDto) => void
  onToast: (msg: string) => void
  /** 머리 캡션(기본 "단어 제안") — 오늘의 회화 메모 제안은 출처(대화 몇 번째 줄·선생님이 찾아본 뜻)를 싣는다(screens §12-2 F). */
  caption?: string
  /** 뜻 아래 한 줄(메모를 사전 모양으로 바꿨을 때 등). */
  note?: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [meaning, setMeaning] = useState(() => str(proposal.payload.meaning))
  const [inlineError, setInlineError] = useState<string | null>(null)
  const isWord = proposal.kind === 'ADD_WORD'
  const wordOpen = isWord && proposal.status === 'PROPOSED'
  const word = useWordLayers(wordOpen ? str(proposal.payload.surface) : '', wordOpen ? str(proposal.payload.reading) || null : null)

  const handleConflict = (e: unknown) => {
    const err = toErr(e)
    if (err.status === 409) {
      if (isWord && detailString(err, 'existingId')) {
        setInlineError('단어장에 이미 있는 단어예요')
        return
      }
      const status = detailString(err, 'status') as ProposalStatus | null
      if (status === 'EXPIRED') onToast('기한(30일)이 지난 제안이라 채택할 수 없어요')
      else onToast('이미 처리된 제안이에요')
      if (status && STATUSES.includes(status)) onChange({ ...proposal, status })
      return
    }
    if (err.status === 400) {
      setInlineError(err.message || actionErrorText(err))
      return
    }
    onToast(actionErrorText(err))
  }

  const accept = async () => {
    if (busy) return
    let body: { payloadOverride?: { meaning: string } } = {}
    if (isWord && editing) {
      const m = meaning.trim()
      if (cpLength(m) < 1 || cpLength(m) > 200) {
        setInlineError('뜻을 적어 주세요 (200자 이내)')
        return
      }
      if (m !== str(proposal.payload.meaning)) body = { payloadOverride: { meaning: m } }
    }
    setBusy(true)
    setInlineError(null)
    try {
      const r = await apiPost<ProposalAcceptResponse>(`/api/v1/proposals/${encodeURIComponent(proposal.id)}/accept`, body)
      onChange({ ...proposal, status: r.proposal.status, result: r.proposal.result ?? null })
      onToast(isWord ? '단어장에 추가했어요' : '공부 기록에 남겼어요')
    } catch (e) {
      handleConflict(e)
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (busy) return
    setBusy(true)
    setInlineError(null)
    try {
      const r = await apiPost<ProposalRejectResponse>(`/api/v1/proposals/${encodeURIComponent(proposal.id)}/reject`)
      onChange({ ...proposal, status: r.status })
    } catch (e) {
      handleConflict(e)
    } finally {
      setBusy(false)
    }
  }

  if (isWord) {
    const surface = str(proposal.payload.surface)
    if (proposal.status !== 'PROPOSED') {
      const line =
        proposal.status === 'ACCEPTED'
          ? { cls: 'text-[13px] text-good', text: '✓ 단어장에 추가했어요 · ' }
          : proposal.status === 'REJECTED'
            ? { cls: 'text-[12px] text-ink2', text: '건너뛴 단어 제안 · ' }
            : { cls: 'text-[12px] text-ink2', text: '기한이 지난 제안 · ' }
      return (
        <p className={`min-w-0 py-1 ${line.cls} [overflow-wrap:anywhere]`}>
          {line.text}
          <span lang="ja">{surface}</span>
        </p>
      )
    }
    return (
      <div aria-busy={busy || undefined} className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
        <p className="text-[12px] text-ink2">{caption ?? '단어 제안'}</p>
        <JaText text={surface} state={OFF} ruby={word.ruby} leading={2} className="mt-1 min-w-0 text-[18px] font-semibold [overflow-wrap:anywhere]" />
        <HangulLine state={word.hangul} />
        {editing ? (
          <div className="mt-2 flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`pm_${proposal.id}`} className="text-[12.5px] font-medium text-ink2">
              뜻
            </label>
            <input
              id={`pm_${proposal.id}`}
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink"
            />
          </div>
        ) : (
          <p className="mt-0.5 text-[15px] break-keep [overflow-wrap:anywhere]">{str(proposal.payload.meaning)}</p>
        )}
        {note ? <p className="mt-1 text-[12px] text-ink2 break-keep [overflow-wrap:anywhere]">{note}</p> : null}
        <p className="mt-1.5 text-[12px] text-ink2 break-keep">선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요.</p>
        {inlineError ? (
          <p role="alert" className="mt-1.5 text-[12px] text-bad break-keep">
            {inlineError}
          </p>
        ) : null}
        <BtnRow>
          <Btn onClick={accept} aria-disabled={busy || undefined} className={busy ? 'opacity-60' : ''}>
            {busy ? '처리 중…' : '단어장에 추가'}
          </Btn>
          <Btn variant="ghost" onClick={reject} aria-disabled={busy || undefined}>
            괜찮아요
          </Btn>
        </BtnRow>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="mt-1 inline-flex h-11 items-center text-[13px] font-medium text-ink2">
            ✎ 뜻 고쳐서 추가
          </button>
        ) : null}
      </div>
    )
  }

  // ADD_STUDY_LOG
  const payload = proposal.payload as StudyLogPayload
  const counts =
    typeof payload.messageCount === 'number' && typeof payload.correctionCount === 'number'
      ? `메시지 ${payload.messageCount}개 · 교정 ${payload.correctionCount}건`
      : null
  return (
    <div aria-busy={busy || undefined} className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <p className="text-[15px] font-semibold">공부 기록 남기기</p>
      {proposal.status === 'PROPOSED' ? (
        <>
          <p className="mt-1 text-[14px] break-keep">이 채팅을 공부 기록으로 남길까요?</p>
          {counts ? <p className="mt-0.5 text-[13px] text-ink2">{counts}</p> : null}
          <p className="mt-1.5 text-[12px] text-ink2 break-keep">남기면 달력과 통계에 기록돼요. 선생님 제안이라 남기기를 눌러야 저장돼요.</p>
          {inlineError ? (
            <p role="alert" className="mt-1.5 text-[12px] text-bad break-keep">
              {inlineError}
            </p>
          ) : null}
          <BtnRow>
            <Btn onClick={accept} aria-disabled={busy || undefined} className={busy ? 'opacity-60' : ''}>
              {busy ? '처리 중…' : '기록 남기기'}
            </Btn>
            <Btn variant="ghost" onClick={reject} aria-disabled={busy || undefined}>
              남기지 않기
            </Btn>
          </BtnRow>
        </>
      ) : (
        <p className={`mt-1 text-[13px] ${proposal.status === 'ACCEPTED' ? 'text-good' : 'text-ink2'}`}>
          {proposal.status === 'ACCEPTED' ? '✓ 공부 기록에 남겼어요' : proposal.status === 'REJECTED' ? '기록하지 않았어요' : '기한이 지난 제안이에요'}
        </p>
      )}
    </div>
  )
}
