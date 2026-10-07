'use client'

/**
 * 지우기·내 버전 지우기·기본으로 되돌리기·숨기기 확인 시트(S8·S9 — screens.md §16-2, 데모 v2 `del`·`revert`). 한 컴포넌트, `mode` 4가지.
 * 본문 숫자·제목은 #172 미리보기(409 뒤에는 `details.preview`)에서만 — `logic.ts` `removalView`. 서버 `message` 는 쓰지 않는다(`failure.ts`).
 * 실행 중에는 시트를 닫을 수 없고(`dismissible=false`) 두 버튼 모두 `aria-busy`/`aria-disabled`. 결과(`done`·`gone`)는 부르는 쪽이 이동·토스트로 받는다.
 * 409 로 바뀌면 맨 위 알림 줄로 초점을 옮긴다(시트 안 — 뒤 화면 `main` 은 시트가 잠가 둔다). 닫으면 공용 `Sheet` 가 연 버튼으로 초점을 돌린다.
 */
import { useEffect, useRef } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { ErrorBox, InfoBox, Skeleton } from '@/components/challenge/parts'
import { removalActionLabel, removalView, type RemovalLine } from './logic'
import { REMOVAL } from './topicCopy'
import { useTopicRemoval, type RemovalState, type RemovalTarget } from './useTopicRemoval'

const DANGER = 'border-bad text-bad'

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

  useEffect(() => {
    if (state.changed && state.phase === 'ready') changedRef.current?.focus()
  }, [state.changed, state.phase, state.preview])

  const mode = target?.mode ?? 'delete'
  const busy = state.phase === 'busy' || state.phase === 'done'
  const ready = state.phase === 'ready'
  const p = state.preview
  const view = p && (ready || busy) ? removalView(mode, p) : null
  // 확인에 실패한 동안은 「확인하는 중…」이 아니라 막힌 실행 글자 그대로.
  const actionLabel = state.phase === 'loadFail' ? REMOVAL.btn[mode] : removalActionLabel(mode, view ? p : null, busy)

  return (
    <Sheet open={target !== null} title={REMOVAL.title[mode]} onClose={onClose} dismissible={!busy}>
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
                <div className="rounded-xl border-[1.5px] border-bad bg-bad-soft px-3.5 py-3 text-[13px] text-ink">
                  <p className="flex items-center gap-1.5 font-bold text-bad">
                    <span aria-hidden="true">⚠</span>
                    {view.warn.title}
                  </p>
                  <p className="mt-1 break-keep">{view.warn.text}</p>
                </div>
              ) : (
                <InfoBox>
                  <p>{view.warn.text}</p>
                </InfoBox>
              )
            ) : null}
            {view.leads.map((l) =>
              l.info ? (
                <InfoBox key={l.text}>
                  <p>{l.text}</p>
                </InfoBox>
              ) : (
                <p key={l.text} className="break-keep">
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
          <p role="alert" className="mt-3 text-[13px] font-semibold text-bad break-keep">
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
