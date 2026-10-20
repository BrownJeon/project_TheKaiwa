/**
 * 성장 탭 «공부결과»(screens.md §36-3·36-11 — 데모 `axesRows()`·`axesHow()`, Q2 B 가로 5줄 + 단계 라벨).
 * 한 줄 = 이름(h3) · 단계 글(또는 «아직 판단하기 일러요»·«기록 전») · 숨김 «4단계 중 N단계» · 설명 · 4칸 막대 · 숫자·추세(또는 진행선·쌓이는 곳·링크).
 * 줄 모양은 `rowShapeOf`(36-4 «줄 모양 순서») 하나로 고른다 — 한쪽 증거 줄(L11)은 표본 부족 줄 모양에서 진행선·링크를 뺀 것이다.
 * 판정(enough·oneSided·stage·trend)은 서버가 한다 — 여기서는 그 값을 그대로 그린다. 단계는 색만으로 알리지 않는다(글자 + 칸 수 + 숨김 글).
 * 적음 안내(`fewNote`, L12)는 `GrowthScreen` 이 계산해 넘기고 소개 줄 바로 아래·첫 축 줄 위에 그린다.
 */
import Link from 'next/link'
import type { GrowthSkill } from '@/types/plan'
import { GROWTH, STAGES, type Rich } from './growthCopy'
import { axisRowsOf, countLineOf, minsOf, progressOf, rowShapeOf, showSpark, waitLineOf } from './growthLogic'
import { Sparkline } from './GrowthCharts'
import { GrowthCard, RichText } from './parts'

export const ROLE_PLAY_HREF = '/study/ai?tab=scenario'

const WAIT = 'flex-none whitespace-nowrap text-[14px] font-semibold text-ink2'
const BODY = 'mt-1.5 text-[13px] text-ink break-keep [overflow-wrap:anywhere]'

export default function ResultRows({ skills, weeksCount, fewNote }: { skills: GrowthSkill[]; weeksCount: number; fewNote: Rich | null }) {
  const rows = axisRowsOf(skills)
  const { min, minSession } = minsOf(skills)
  return (
    <GrowthCard title={GROWTH.skillsTitle} side={GROWTH.skillsSide(weeksCount)}>
      <p className="-mt-1 mb-2 text-[12px] text-ink2 break-keep">{GROWTH.skillsIntro}</p>
      {fewNote ? (
        <p data-few-note="" className="mb-2 rounded-[10px] bg-surface2 px-3 py-2.5 text-[13px] text-ink break-keep [overflow-wrap:anywhere]">
          <RichText parts={fewNote} boldClass="font-semibold" />
        </p>
      ) : null}
      <ul>
        {rows.map(({ meta, skill: s }, i) => {
          const shape = rowShapeOf(s)
          const stage = shape === 'stage' ? s.stage : null
          return (
            <li key={meta.axis} data-axis={meta.axis} data-state={shape} className={`min-w-0 border-line ${i === 0 ? 'pb-3 pt-0.5' : 'border-t py-3'}`}>
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <h3 className="min-w-0 text-[15px] font-semibold break-keep">{meta.name}</h3>
                {shape === 'none' ? (
                  <span className={WAIT}>{GROWTH.notRecorded}</span>
                ) : stage === null ? (
                  <span className={WAIT}>{GROWTH.tooEarly}</span>
                ) : (
                  <>
                    <span className="flex-none whitespace-nowrap text-[14px] font-[650]">{STAGES[stage]}</span>
                    <span className="sr-only">{GROWTH.stageSr(stage + 1)}</span>
                  </>
                )}
              </div>
              <p className="mt-px text-[12.5px] text-ink2 break-keep">{meta.desc}</p>
              {shape === 'none' ? (
                <p className={BODY}>{GROWTH.notRecordedBody}</p>
              ) : shape === 'oneSided' ? (
                <OneSided sub={GROWTH.axisOneSidedSub[meta.axis]} />
              ) : stage === null ? (
                <Waiting skill={s} how={meta.how} />
              ) : (
                <>
                  <div aria-hidden="true" data-meter="" className="mt-2 grid h-2 grid-cols-4 gap-0.5">
                    {[0, 1, 2, 3].map((k) => (
                      <i key={k} data-on={k <= stage ? '1' : '0'} className={`block ${k <= stage ? 'bg-protein' : 'bg-protein-soft'} ${k === 0 ? 'rounded-l' : ''} ${k === 3 ? 'rounded-r' : ''}`} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 text-[12.5px] text-ink2 break-keep [overflow-wrap:anywhere]">
                      <b className="font-semibold text-ink">{countLineOf(s)}</b>
                      <br />
                      {s.trend ? (
                        <>
                          <span aria-hidden="true">{GROWTH.trend[s.trend].arrow} </span>
                          {GROWTH.trend[s.trend].text}
                        </>
                      ) : (
                        GROWTH.trendNone
                      )}
                    </p>
                    {showSpark(weeksCount, s) ? <Sparkline points={s.spark} /> : null}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <details className="group mt-2.5 border-t border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
          {GROWTH.howTitle}
          <span aria-hidden="true" className="text-[12px] text-ink2 group-open:hidden">
            ▾
          </span>
          <span aria-hidden="true" className="hidden text-[12px] text-ink2 group-open:inline">
            ▴
          </span>
        </summary>
        <ul className="flex list-disc flex-col gap-1 pb-1.5 pl-5 text-[13px] break-keep [overflow-wrap:anywhere]">
          {GROWTH.how(min, minSession).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </GrowthCard>
  )
}

/** 한쪽 증거 줄 본문(36-4 ⑩) — 이유 + 그 축에서 단계가 보이게 하는 공부. 진행선·숫자·링크 없음(가린 한쪽 숫자를 다시 보이지 않는다). */
function OneSided({ sub }: { sub: string }) {
  return (
    <p className={BODY}>
      {GROWTH.axisOneSided}
      {sub ? <span className="mt-0.5 block text-[12px] text-ink2">{sub}</span> : null}
    </p>
  )
}

function Waiting({ skill: s, how }: { skill: GrowthSkill; how: string }) {
  return (
    <>
      <p className={BODY}>
        {waitLineOf(s)}
        {how ? <span className="mt-0.5 block text-[12px] text-ink2">{how}</span> : null}
      </p>
      <div aria-hidden="true" className="mt-2 h-1 max-w-[160px] overflow-hidden rounded-sm bg-surface2">
        <i className="block h-full rounded-sm bg-ink2" style={{ width: `${Math.round(progressOf(s) * 100)}%` }} />
      </div>
      {s.unit === 'SESSION' ? (
        <p className="mt-1">
          <Link href={ROLE_PLAY_HREF} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent">
            {GROWTH.goRolePlay}
          </Link>
        </p>
      ) : null}
    </>
  )
}
