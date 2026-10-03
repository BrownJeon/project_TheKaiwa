'use client'

/**
 * 적용 막대(데모 v2 `.flow`) — 바뀐 값이 있을 때만 화면 아래(콘솔 본문 폭 — ≥1024 는 사이드바 232px 오른쪽)에 붙는다. 단계 4칸(검증·테스트·요약·적용) +
 * 한 줄 안내 + [초안 버리기] + 지금 단계 버튼 하나. 권한 없는 단계는 버튼을 그리지 않고 🔒 로만 보인다(비활성 버튼으로 남기지 않는다).
 * 내용이 짧아도 아래에 붙도록 `fixed` 로 두고, 본문 끝에 막대 높이만큼 빈 자리를 둬 마지막 칸이 가려지지 않게 한다.
 * 키보드가 열린 동안(`<html data-kb>`)은 하단 탭과 같은 규칙으로 막대만 숨긴다 — 줄어든 화면에서 막대가 키보드 위로 따라 올라와
 * 아래쪽 입력 칸을 덮는데, 입력 칸 드러내기(`KeyboardInset`)는 막대 높이를 모른다(012c QA 결함 #1). 빈 자리는 남겨 마지막 칸 여유를 지킨다.
 */
import type { FlowButtonId, FlowView, MsgPart, StepState } from './flow'

const STEP_TONE: Record<StepState, string> = {
  done: 'bg-good-soft font-semibold text-good',
  err: 'bg-bad-soft font-semibold text-bad',
  cur: 'bg-surface font-bold text-ink ring-[1.5px] ring-inset ring-accent',
  lock: 'bg-surface text-ink2 ring-1 ring-inset ring-line',
  skip: 'bg-surface text-ink2 line-through ring-1 ring-inset ring-line',
  idle: 'bg-surface2 text-ink2',
}

export function MsgLine({ parts }: { parts: MsgPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <b key={i} className="font-semibold text-ink">
            {p.b}
          </b>
        ),
      )}
    </>
  )
}

export default function FlowBar({ view, onButton }: { view: FlowView; onButton: (id: FlowButtonId) => void }) {
  return (
    <>
      <div aria-hidden="true" className="h-[150px] lg:h-[84px]" />
      <div
        role="region"
        aria-label="적용 단계"
        className="fixed inset-x-0 bottom-0 z-[8] border-t border-line bg-surface px-4 pb-2.5 pt-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)] lg:left-[232px] lg:px-6 [:root[data-kb]_&]:hidden"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid min-w-0 max-w-[912px] gap-1.5 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)_auto] lg:items-center lg:gap-x-4">
          <ol aria-label="적용 단계" className="flex min-w-0 gap-1">
            {view.steps.map((s) => (
              <li
                key={s.id}
                aria-current={s.state === 'cur' || (s.state === 'err' && s.id !== 'apply') ? 'step' : undefined}
                className={`flex h-[26px] min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg text-[12px] ${STEP_TONE[s.state]}`}
              >
                {s.sym ? <span aria-hidden="true">{s.sym}</span> : null}
                {s.label}
              </li>
            ))}
          </ol>
          <p aria-live="polite" className="min-w-0 text-[12px] text-ink2 break-keep">
            <MsgLine parts={view.message} />
          </p>
          <div className="flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1 lg:[&>*]:flex-none">
            {view.buttons.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-busy={b.busy || undefined}
                aria-haspopup={b.id === 'apply' || b.id === 'discard' ? 'dialog' : undefined}
                disabled={b.disabled}
                onClick={() => onButton(b.id)}
                className={`inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl px-3.5 text-[14px] font-semibold disabled:opacity-40 ${
                  b.primary ? 'bg-accent text-on-accent' : 'border border-line bg-surface text-ink'
                }`}
              >
                <span className="truncate">{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
