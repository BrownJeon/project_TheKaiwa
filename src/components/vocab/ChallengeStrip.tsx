'use client'

/**
 * 오늘 탭 챌린지 띠(task-044 가이드 §3-2) — 카드들 위, 전체가 계획표 링크. 상태는 글자 + 모양(✓ · 일부 반원 그림 · 빈 원)으로 함께 보인다(색만으로 구분하지 않음).
 * 일부는 반원 글자 대신 `PartialMark` 그림 — 반원 글자는 기기 글꼴에 따라 점·빈 네모로 보인다.
 * #158 실패면 `role=alert` 한 줄 + [다시 시도](단어·회화 카드는 지금 화면 그대로).
 */
import Link from 'next/link'
import { PartialMark } from '@/components/challenge/parts'
import type { StripModel } from './topicLogic'
import { STRIP } from './topicCopy'

function Mark({ state }: { state: 'DONE' | 'SHORT' | 'OTHER' }) {
  if (state === 'DONE')
    return (
      <span aria-hidden="true" className="grid h-4 w-4 flex-none place-items-center rounded-full bg-good-soft text-[10px] font-bold text-good">
        ✓
      </span>
    )
  if (state === 'SHORT')
    return (
      <span aria-hidden="true" className="grid h-4 w-4 flex-none place-items-center rounded-full bg-warn-soft text-[10px] font-bold text-ink">
        <PartialMark />
      </span>
    )
  return <span aria-hidden="true" className="h-4 w-4 flex-none rounded-full border-[1.5px] border-ink3" />
}

const markOf = (s: string): 'DONE' | 'SHORT' | 'OTHER' => (s === 'DONE' ? 'DONE' : s === 'SHORT' ? 'SHORT' : 'OTHER')

export function ChallengeStripError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2 rounded-xl bg-bad-soft px-3.5 py-1.5 text-[13px] text-bad">
      <p className="min-w-0 flex-1 break-keep py-1.5">{STRIP.loadError}</p>
      <button type="button" onClick={onRetry} className="min-h-11 flex-none font-semibold underline underline-offset-4">
        {STRIP.retry}
      </button>
    </div>
  )
}

export default function ChallengeStrip({ model }: { model: StripModel }) {
  return (
    <Link
      href="/plan"
      aria-label={model.aria}
      className="mb-3 flex min-h-14 min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[14px] font-semibold break-keep [overflow-wrap:anywhere]">{model.title}</b>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink2">
          <span className="break-keep">{model.sub}</span>
          {model.kind === 'progress' && model.words ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Mark state={markOf(model.words.state)} />
              {model.words.label}
            </span>
          ) : null}
          {model.kind === 'progress' && model.lesson ? (
            <span className="inline-flex items-center gap-1">
              <Mark state={markOf(model.lesson.state)} />
              {STRIP.lesson}
            </span>
          ) : null}
        </span>
      </span>
      <span aria-hidden="true" className="flex-none text-[13px] font-semibold text-ink">
        {STRIP.toPlan}
      </span>
    </Link>
  )
}
