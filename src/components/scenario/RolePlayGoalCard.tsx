'use client'

/**
 * 역할극 목표 카드(가이드 §3-D, v1 `goalCard` + 대화 순서). 머리 바로 아래 한 줄로 접혀 있다가 펼치면 역할·대화 순서·핵심 표현 칩을 보인다.
 * 쓴 표현은 서버가 준 id 로만 칠한다(글자 비교 없음). 색만으로 알리지 않는다 — ✓ 글자와 스크린리더 ", 썼어요".
 * 단계 진행값이 없으면(`rp-nostep` — 지금 서버) 대화 순서는 번호만, ✓·● 없이. 마친 역할극이면 요약은 "마침".
 */
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { OFF, useAnnotations } from '@/components/common/japanese/annotations'
import { goalSummary, stepPosition, stepView } from './logic'
import { ROOM } from './scenarioCopy'
import { GOAL_CARD_ID, type RolePlay } from './useRolePlay'

const REGION_ID = 'rp-goal'

export default function RolePlayGoalCard({ rp }: { rp: RolePlay }) {
  const v = rp.view
  const ann = useAnnotations(v && rp.goalOpen ? v.keyExpressions.map((e) => e.ja) : [])
  if (!v) return null
  const total = v.keyExpressions.length
  const used = new Set(rp.progress.usedIds)
  const usedCount = v.keyExpressions.filter((e) => used.has(e.id)).length
  const summary = rp.ended ? ROOM.summaryEnded : goalSummary({ stepIndex: rp.progress.stepIndex, stepCount: v.steps.length, usedCount, total, checksHidden: rp.checksHidden })
  const showChecks = !rp.checksHidden
  const stepsKnown = stepPosition(rp.progress.stepIndex, v.steps.length) !== null
  const need = Math.min(Math.max(v.requiredExpressions, 0), total)
  return (
    <div id={GOAL_CARD_ID} className="flex-none border-b border-line bg-surface">
      <button
        type="button"
        aria-expanded={rp.goalOpen}
        aria-controls={REGION_ID}
        onClick={rp.toggleGoal}
        className="flex min-h-12 w-full min-w-0 items-center gap-2 px-4 text-left"
      >
        <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-accent-soft px-2 text-[12px] font-semibold text-ink">{ROOM.goalTag}</span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{v.goalKo}</span>
        <span className="flex-none text-[12px] text-ink2 tabular-nums">{summary}</span>
        <span aria-hidden="true" className={`flex-none text-[18px] text-ink3 motion-safe:transition-transform ${rp.goalOpen ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {rp.goalOpen ? (
        <div id={REGION_ID} className="min-w-0 px-4 pb-3">
          <p className="text-[13px] text-ink2 break-keep">
            {ROOM.me} <b className="font-semibold text-ink">{v.roles.learner}</b> · {ROOM.tutor} <b className="font-semibold text-ink">{v.roles.tutor}</b>
          </p>
          {v.steps.length > 0 ? (
            <>
              <p className="mt-2 text-[12px] font-semibold text-ink2">{ROOM.stepsTitle}</p>
              <ol className="mt-1 flex min-w-0 flex-col gap-1.5">
                {stepView(v.steps, rp.progress.stepIndex).map((s, i) => (
                  <li
                    key={i}
                    aria-current={stepsKnown && s.state === 'current' ? 'step' : undefined}
                    className={`flex min-w-0 items-start gap-2 text-[14px] break-keep ${stepsKnown && s.state === 'current' ? 'font-semibold text-ink' : 'text-ink2'}`}
                  >
                    <span aria-hidden="true" className="w-5 flex-none text-center tabular-nums">
                      {!stepsKnown ? `${i + 1}.` : s.state === 'done' ? '✓' : s.state === 'current' ? '●' : '○'}
                    </span>
                    <span className="min-w-0 flex-1">
                      {stepsKnown ? <span className="sr-only">{`${i + 1}. `}</span> : null}
                      {s.ko}
                      {stepsKnown && s.state !== 'next' ? <span className="sr-only">{`, ${s.state === 'done' ? ROOM.stepDoneSr : ROOM.stepNowSr}`}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {total > 0 ? (
            <>
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 text-[12px] text-ink2 break-keep">
                  {showChecks ? (
                    <>
                      <b className="font-semibold text-ink tabular-nums">{ROOM.exprCount(usedCount, total)}</b>
                      {ROOM.exprNeed(need)}
                    </>
                  ) : (
                    ROOM.exprHiddenNote(need)
                  )}
                </p>
                <button
                  type="button"
                  aria-pressed={rp.checksHidden}
                  onClick={rp.toggleChecks}
                  className={`relative h-8 flex-none rounded-full border px-3 text-[12px] font-semibold before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
                    rp.checksHidden ? 'border-transparent bg-surface2 text-ink' : 'border-line bg-surface text-ink2'
                  }`}
                >
                  {rp.checksHidden ? ROOM.checksHidden : ROOM.checksShown}
                </button>
              </div>
              <ul className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                {v.keyExpressions.map((e, i) => {
                  const hit = showChecks && used.has(e.id)
                  return (
                    <li
                      key={e.id}
                      className={`inline-flex min-w-0 max-w-full items-baseline gap-1 rounded-[10px] border px-2.5 py-1 motion-safe:transition-colors motion-safe:duration-300 ${
                        hit ? 'border-transparent bg-good-soft' : 'border-line bg-surface'
                      }`}
                    >
                      {hit ? (
                        <span aria-hidden="true" className="flex-none text-[13px] font-semibold text-good">
                          ✓
                        </span>
                      ) : null}
                      <span className="min-w-0">
                        <JaText as="span" text={e.ja} state={ann[i] ?? OFF} className="text-[16px] text-ink [overflow-wrap:anywhere]" rt={11} leading={2.1} />
                        <HangulLine state={ann[i] ?? OFF} size={12} inline className="ml-1" />
                        {hit ? <span className="sr-only">{ROOM.usedSr}</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

