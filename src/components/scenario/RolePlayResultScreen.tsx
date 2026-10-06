'use client'

/**
 * 역할극 결과(가이드 §3-G · 승인 v1 `#res-ok`·`#res-almost`·`#res-not` + 판단 없음·채택 대기 교정·다음 상황 없음).
 * #29 의 `chat.scenario.ended` 를 **읽기만** 한다 — 여는 것만으로 기록이 생기지 않는다(D-9, 마치기는 방 안 시트). 쓰기는 사용자가 누른
 * [다시 해 보기](#28 새 역할극)·시트의 [역할극 시작]뿐이다. 판정·개수는 서버 값 그대로(`resultLogic`), 문구는 `scenarioCopyResult`.
 * BackBar 52 + 본문 한 곳만 스크롤. 첫 초점 = 결과 제목(h2).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { useAnnotations } from '@/components/common/japanese/annotations'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, Card, ErrorBlock } from '@/components/common/ui'
import { ExprChip } from '@/components/lesson/parts'
import BackBar from '@/components/shell/BackBar'
import { dateLabel } from './logic'
import { nextPlan, outcomeView, resultChips, retryFailureText, type EndedRolePlay } from './resultLogic'
import ScenarioSheet from './ScenarioSheet'
import { SCENARIO_HOME_HREF, talkRoomHref } from './scenarioCopy'
import { RESULT } from './scenarioCopyResult'
import { useRolePlayResult } from './useRolePlayResult'
import { useStartRolePlay } from './useStartRolePlay'

const linkPrimary = 'flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent'
const linkGhost = 'flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold'
const linkText = 'flex h-11 shrink-0 items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4'

export default function RolePlayResultScreen({ chatId }: { chatId: string }) {
  const { state, reload } = useRolePlayResult(chatId)
  const view = state.kind === 'ready' ? state.view : null
  const subtitle = view ? RESULT.subtitle(view.title, dateLabel(view.ended.endedAt)) : undefined
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref={SCENARIO_HOME_HREF} backLabel={RESULT.back} title={RESULT.barTitle} subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-8 pt-3.5" aria-busy={state.kind === 'loading' || undefined}>
        {state.kind === 'loading' ? (
          <>
            <p role="status" className="sr-only">
              {RESULT.loadingSr}
            </p>
            {[64, 180, 120].map((h) => (
              <div key={h} aria-hidden="true" className="w-full flex-none rounded-[14px] bg-surface2 motion-safe:animate-pulse" style={{ height: h }} />
            ))}
          </>
        ) : state.kind === 'error' ? (
          <ErrorBlock message={RESULT.error} onRetry={reload} />
        ) : state.kind === 'gone' ? (
          <Missing title={RESULT.goneTitle} href={SCENARIO_HOME_HREF} label={RESULT.goneBtn} />
        ) : state.kind === 'notEnded' ? (
          <Missing title={RESULT.notEndedTitle} href={talkRoomHref(chatId)} label={RESULT.notEndedBtn} />
        ) : (
          <ResultBody chatId={chatId} view={state.view} />
        )}
      </div>
    </div>
  )
}

function Missing({ title, href, label }: { title: string; href: string; label: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className="flex flex-col gap-4 pt-6">
      <h2 ref={ref} tabIndex={-1} className="text-center text-[16px] font-semibold outline-none break-keep">
        {title}
      </h2>
      <Link href={href} className={linkPrimary}>
        {label}
      </Link>
    </div>
  )
}

function ResultBody({ chatId, view }: { chatId: string; view: EndedRolePlay }) {
  const router = useRouter()
  const r = view.ended
  const o = outcomeView(r, { count: view.steps.length, stepIndex: view.progress?.stepIndex })
  const used = resultChips(view.keyExpressions, r.expressions.usedIds)
  const missed = resultChips(view.keyExpressions, r.expressions.missedIds)
  const anns = useAnnotations([...used, ...missed].map((t) => t.ja))
  const plan = nextPlan(r)
  const next = plan.next
  const start = useStartRolePlay()
  const toast = useToast()
  const [sheetId, setSheetId] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const nextHeadId = useId()
  const starting = start.state.phase === 'starting'

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const { state: startState, reset: resetStart } = start
  const { show } = toast
  useEffect(() => {
    if (startState.phase !== 'failed') return
    show(retryFailureText(startState.failure))
    resetStart()
  }, [startState, show, resetStart])

  const retry = async () => {
    if (starting) return
    await start.start(view.id)
  }

  const retryBtn = (
    <Btn variant={plan.primary === 'retry' ? 'primary' : 'ghost'} className="w-full" aria-busy={starting || undefined} onClick={() => void retry()}>
      {starting ? RESULT.retrying : RESULT.retry}
    </Btn>
  )
  const nextCard = next ? (
    <section aria-labelledby={nextHeadId} className="rounded-[14px] bg-accent-soft p-3.5">
      <p className="text-[13px] text-ink2">{RESULT.nextLabel}</p>
      <h3 id={nextHeadId} className="mt-0.5 text-[17px] font-bold text-ink break-keep">
        {next.title}
      </h3>
      {next.titleJa ? (
        <p lang="ja" className="mt-0.5 text-[13px] text-ink2 [overflow-wrap:anywhere]">
          {next.titleJa}
        </p>
      ) : null}
      <p className="mt-0.5 text-[14px] text-ink break-keep">{next.goalKo}</p>
      <Btn variant={plan.primary === 'next' ? 'primary' : 'ghost'} className="mt-3 w-full" disabled={starting} onClick={() => setSheetId(next.id)}>
        {RESULT.nextBtn}
      </Btn>
    </section>
  ) : (
    <Link href={SCENARIO_HOME_HREF} className={linkGhost}>
      {RESULT.pickOther}
    </Link>
  )

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid h-[52px] w-[52px] flex-none place-items-center rounded-full text-[22px] font-bold ${o.achieved ? 'bg-good-soft text-good' : 'bg-surface2 text-ink2'}`}
        >
          {o.icon}
        </span>
        <div className="min-w-0">
          <h2 ref={titleRef} tabIndex={-1} className="text-[20px] font-bold outline-none break-keep">
            {o.title}
          </h2>
          {view.titleJa ? (
            <p lang="ja" className="text-[14px] [overflow-wrap:anywhere]">
              {view.titleJa}
            </p>
          ) : null}
          <p className="text-[12px] text-ink2 break-keep">{view.title}</p>
        </div>
      </div>
      <Card>
        <dl aria-label={RESULT.verdictAria} className="flex flex-col gap-2">
          {o.rows.map((row) => (
            <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-3">
              <dt className="flex-none text-[13px] text-ink2">{row.label}</dt>
              <dd className={`min-w-0 text-right text-[14px] break-keep ${row.ok ? 'font-semibold text-good' : 'text-ink'}`}>{row.value}</dd>
            </div>
          ))}
        </dl>
        {o.note ? <p className="mt-3 text-[13px] text-ink break-keep">{o.note}</p> : null}
        {r.expressions.usedIds.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink2 break-keep">{RESULT.usedNone}</p>
        ) : used.length ? (
          <>
            <h3 className="mt-3 text-[15px] font-semibold">{RESULT.usedTitle}</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {used.map((t, i) => (
                <ExprChip key={t.id} ja={t.ja} ko={t.ko} ann={anns[i]} tone="good" tail={<span aria-hidden="true" className="text-[12px] font-bold text-good">✓</span>} />
              ))}
            </ul>
          </>
        ) : null}
        {missed.length ? (
          <>
            <h3 className="mt-3 text-[15px] font-semibold">{RESULT.missedTitle}</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missed.map((t, i) => (
                <ExprChip key={t.id} ja={t.ja} ko={t.ko} ann={anns[used.length + i]} />
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-3 text-[12px] text-ink2 break-keep">{RESULT.stats(r.turns, r.hintsUsed, r.selfCorrections)}</p>
        {r.pendingCorrections > 0 ? (
          <Link href={talkRoomHref(chatId)} className="mt-2 flex min-h-11 items-center border-t border-line pt-2 text-[13px] font-semibold text-accent break-keep">
            {RESULT.pending(r.pendingCorrections)}
          </Link>
        ) : null}
      </Card>
      {plan.primary === 'next' ? (
        <>
          {nextCard}
          {retryBtn}
        </>
      ) : (
        <>
          {retryBtn}
          {nextCard}
        </>
      )}
      <div>
        <Link href={SCENARIO_HOME_HREF} className={linkText}>
          {RESULT.home}
        </Link>
        <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{o.recordNote}</p>
      </div>
      <Toast message={toast.message} bottomPx={24} />
      <ScenarioSheet id={sheetId} onClose={() => setSheetId(null)} onPickOther={() => router.push(SCENARIO_HOME_HREF)} />
    </>
  )
}
