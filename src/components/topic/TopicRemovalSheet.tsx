'use client'

/**
 * 지우기·내 버전 지우기·기본으로 되돌리기·숨기기 확인 시트(S8·S9 — screens.md §16-2, 데모 v2 `del`·`revert`). 한 컴포넌트, `mode` 4가지.
 * 본문 숫자·제목은 #172 미리보기(409 뒤에는 `details.preview`)에서만 — `logic.ts` `removalView`. 서버 `message` 는 쓰지 않는다(`failure.ts`).
 * 실행 중에는 시트를 닫을 수 없고(`dismissible=false`) 두 버튼 모두 `aria-busy`/`aria-disabled`. 결과(`done`·`gone`)는 부르는 쪽이 이동·토스트로 받는다.
 * 409 로 바뀌면 맨 위 알림 줄로, 그 뒤 일반 실패가 이어지면 새 실패 문구로 초점을 옮긴다(시트 안 — 뒤 화면 `main` 은 시트가 잠가 둔다).
 * 닫으면 공용 `Sheet` 가 연 버튼으로 초점을 돌린다.
 * 대화상자 설명(`aria-describedby`)은 데모 v2 S9 와 같은 규칙 — 진행 중 챌린지 경고·안내 상자가 있으면 그 상자, 없으면 첫머리 안내 문단.
 * 되돌릴 수 없는 확인이라 스크린리더가 제목 다음에 이 문단을 읽는다(위험 버튼으로 바로 건너뛰지 않게).
 */
import { useEffect, useId, useRef } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { ErrorBox, InfoBox, Skeleton } from '@/components/challenge/parts'
import { removalActionLabel, removalView, type RemovalLine, type RemovalView } from './logic'
import { REMOVAL } from './topicCopy'
import { useTopicRemoval, type RemovalState, type RemovalTarget } from './useTopicRemoval'

const DANGER = 'border-bad text-bad'

/** 대화상자 설명으로 묶을 문단 — 경고·안내 상자가 있으면 그것, 없으면 첫머리 안내 문단(둘 다 없으면 묶지 않는다). */
export function removalDescribeTarget(view: Pick<RemovalView, 'warn' | 'leads'>): 'warn' | 'lead' | null {
  return view.warn ? 'warn' : view.leads.length ? 'lead' : null
}

/**
 * 초점이 갈 줄 — 실행 실패 문구가 있으면 그것(방금 생긴 것), 없고 409 로 다시 그렸으면 맨 위 알림 줄.
 * 409 뒤 다시 눌러 일반 실패가 오면 옛 알림 줄이 아니라 새 실패 문구로 간다(`changed` 는 시트가 닫힐 때까지 켜져 있다).
 */
export function removalFocusTarget(s: Pick<RemovalState, 'phase' | 'changed' | 'error'>): 'error' | 'changed' | null {
  if (s.phase !== 'ready') return null
  if (s.error) return 'error'
  return s.changed ? 'changed' : null
}

export default function TopicRemovalSheet({
  target,
  onClose,
  onDone,
  onGone,
}: {
  /** null 이면 닫힘. */
  target: RemovalTarget | null
  onClose: () => void
  onDone: (s: RemovalState & { result: NonNullable<RemovalState['result']>; preview: NonNullable<RemovalState['preview']> }) => void
  onGone: (kind: 'gone' | 'notOverridden') => void
}) {
  const { state, confirm, retryLoad } = useTopicRemoval(target)
  const changedRef = useRef<HTMLParagraphElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const descId = useId()
  const doneRef = useRef(onDone)
  const goneRef = useRef(onGone)
  useEffect(() => {
    doneRef.current = onDone
    goneRef.current = onGone
  })

  useEffect(() => {
    if (state.phase === 'done' && state.result && state.preview) doneRef.current({ ...state, result: state.result, preview: state.preview })
    else if (state.phase === 'gone') goneRef.current(state.goneKind ?? 'gone')
  }, [state])

  const focusTarget = removalFocusTarget(state)
  useEffect(() => {
    if (focusTarget === 'error') errorRef.current?.focus()
    else if (focusTarget === 'changed') changedRef.current?.focus()
  }, [focusTarget])

  const mode = target?.mode ?? 'delete'
  const busy = state.phase === 'busy' || state.phase === 'done'
  const ready = state.phase === 'ready'
  const p = state.preview
  const view = p && (ready || busy) ? removalView(mode, p) : null
  const describe = view ? removalDescribeTarget(view) : null
  const idOf = (t: 'warn' | 'lead') => (describe === t ? descId : undefined)
  // 확인에 실패한 동안은 「확인하는 중…」이 아니라 막힌 실행 글자 그대로.
  const actionLabel = state.phase === 'loadFail' ? REMOVAL.btn[mode] : removalActionLabel(mode, view ? p : null, busy)

  return (
    <Sheet open={target !== null} title={REMOVAL.title[mode]} onClose={onClose} dismissible={!busy} describedBy={describe ? descId : undefined}>
      <div className="pb-2" aria-busy={busy || state.phase === 'loading' || undefined}>
        {state.changed && view ? (
          <p ref={changedRef} tabIndex={-1} role="alert" className="mb-3 rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] font-semibold text-ink outline-none break-keep">
            {REMOVAL.changed}
          </p>
        ) : null}

        {state.phase === 'loading' || state.phase === 'idle' ? (
          <Skeleton heights={[72, 96, 72]} label={REMOVAL.loading} />
        ) : state.phase === 'loadFail' ? (
          <ErrorBox title={state.error ?? REMOVAL.loadFail} onRetry={retryLoad} retryLabel={REMOVAL.retry} />
        ) : view ? (
          <div className="flex min-w-0 flex-col gap-3 text-[14px]">
            {view.warn ? (
              view.warn.tone === 'bad' ? (
                <div id={idOf('warn')} className="rounded-xl border-[1.5px] border-bad bg-bad-soft px-3.5 py-3 text-[13px] text-ink">
                  <p className="flex items-center gap-1.5 font-bold text-bad">
                    <span aria-hidden="true">⚠</span>
                    {view.warn.title}
                  </p>
                  <p className="mt-1 break-keep [overflow-wrap:anywhere]">{view.warn.text}</p>
                </div>
              ) : (
                <InfoBox>
                  <p id={idOf('warn')} className="[overflow-wrap:anywhere]">{view.warn.text}</p>
                </InfoBox>
              )
            ) : null}
            {view.leads.map((l, i) =>
              l.info ? (
                <InfoBox key={l.text}>
                  <p id={i === 0 ? idOf('lead') : undefined}>{l.text}</p>
                </InfoBox>
              ) : (
                <p key={l.text} id={i === 0 ? idOf('lead') : undefined} className="break-keep">
                  {l.text}
                </p>
              ),
            )}
            <Lines head={REMOVAL.goneHead} lines={view.gone} />
            <Lines head={REMOVAL.restoreHead} lines={view.back} />
            <Lines head={REMOVAL.keepHead} lines={view.keep} />
          </div>
        ) : null}

        {ready && state.error ? (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-[13px] font-semibold text-bad outline-none break-keep">
            {state.error}
          </p>
        ) : null}

        <BtnRow>
          <Btn
            variant="ghost"
            className={DANGER}
            aria-busy={busy || undefined}
            aria-disabled={!ready || undefined}
            onClick={() => {
              if (ready) void confirm()
            }}
          >
            {actionLabel}
          </Btn>
          <Btn
            variant="ghost"
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onClose()
            }}
          >
            {REMOVAL.cancel}
          </Btn>
        </BtnRow>
      </div>
    </Sheet>
  )
}

function Lines({ head, lines }: { head: string; lines: RemovalLine[] }) {
  if (!lines.length) return null
  return (
    <div className="min-w-0">
      <h3 className="text-[13px] font-semibold text-ink2">{head}</h3>
      <ul className="mt-1 flex flex-col gap-1.5">
        {lines.map((l) => (
          <li key={l.text} className="min-w-0 break-keep">
            <span className="block">{l.text}</span>
            {l.sub ? <span className="block text-[13px] text-ink2 break-words">{l.sub}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
