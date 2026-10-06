'use client'

/**
 * 챌린지 만들기 `/plan/challenge/new`(S3, 가이드 §3-3·D3~D6) — 주제 → 기간 → 목표 → 확인 4단계를 한 경로에서(`?step=`, 휴대폰 뒤로 = 이전 단계).
 * 입력값은 컴포넌트 상태 + sessionStorage 초안(새로 고침·뒤로 보존, 성공하면 지움). 초안은 브라우저에만 있으므로 하이드레이션이 끝난 뒤에 본문을 그린다.
 * `?again=<끝난 챌린지>` 면 #157 로 같은 주제·기간·목표를 채워 ④ 확인에서 연다(바로 만들지 않는다). 만들면 계획표로(replace) + 토스트 한 번.
 * 본문 한 곳만 스크롤하고 행동 줄은 아래에 붙는다(sticky 없음). LLM 호출 없음(#56·#156·#157·#158 만).
 */
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Segmented from '@/components/common/Segmented'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn } from '@/components/common/ui'
import { Spinner } from '@/components/plan/parts'
import { dayLabel } from '@/components/plan/logic'
import BackBar from '@/components/shell/BackBar'
import type { ChallengeDetail, ChallengeLength, ChallengeWordCount, CreateChallengeBody } from '@/types/challenge'
import type { Topic } from '@/types/lesson'
import { CREATE, DRAFT_KEY, FLASH_KEY } from './challengeCopy'
import { ChoicePills, CheckCard, RadioCard, StepIndicator, TopicRadioCard } from './createParts'
import {
  acceptLine,
  addDaysTo,
  autoTitle,
  createErrorOf,
  EMPTY_DRAFT,
  effectiveGoal,
  goalSummary,
  goalTasks,
  isChallengeIdParam,
  md,
  minAnsweredOf,
  parseDraft,
  parseStep,
  rangeLabel,
  serializeDraft,
  taskRowView,
  wordCountOptions,
  type CreateError,
  type Draft,
} from './logic'
import { BtnLink, ctaClass, ErrorBox, InfoBox, Skeleton, TaskRows } from './parts'
import { useChallengeToday, useTopics } from './useChallengeData'

const noopSubscribe = () => () => {}
const NEW = '/plan/challenge/new'

export default function ChallengeCreateScreen({ today, dailyWordCount }: { today: string; dailyWordCount: number }) {
  const router = useRouter()
  const sp = useSearchParams()
  const step = parseStep(sp.get('step'))
  const rawAgain = sp.get('again')
  const again = isChallengeIdParam(rawAgain) ? rawAgain : null
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [draft, setDraft] = useState<Draft>(() => parseDraft(readStore('session', DRAFT_KEY)) ?? EMPTY_DRAFT)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitErr, setSubmitErr] = useState<CreateError | null>(null)
  const busyRef = useRef(false)
  const headRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)
  const { message, show } = useToast()
  const topics = useTopics()
  const chToday = useChallengeToday()
  const radioName = useId()
  const reasonId = useId()
  const blockId = useId()

  const topic: Topic | null = topics.data?.items.find((t) => t.id === draft.topicId) ?? null
  const goal = effectiveGoal(draft, topic, dailyWordCount)
  const startDate = draft.start === 'TODAY' ? today : addDaysTo(today, 1)
  const when = draft.start === 'TODAY' ? '오늘' : '내일'
  const active = chToday.data?.challenge?.status === 'ACTIVE' ? chToday.data.challenge : null

  useEffect(() => {
    if (hydrated) writeStore('session', DRAFT_KEY, serializeDraft(draft))
  }, [draft, hydrated])

  // 지난 챌린지로 다시 도전 — 같은 주제·기간·목표를 채워 확인 단계로.
  useEffect(() => {
    if (!again) return
    let cancelled = false
    apiGet<ChallengeDetail>(`/api/v1/challenges/${encodeURIComponent(again)}`).then(
      (d) => {
        if (cancelled) return
        if (!d.topic.id) {
          show(CREATE.againFail)
          router.replace(`${NEW}?step=1`)
          return
        }
        setDraft({
          topicId: d.topic.id,
          lengthDays: ([7, 14, 30] as const).includes(d.lengthDays as ChallengeLength) ? (d.lengthDays as ChallengeLength) : 7,
          lesson: d.dailyGoal.lesson,
          words: d.dailyGoal.words,
          wordCount: (d.dailyGoal.wordCount as ChallengeWordCount | null) ?? null,
          start: 'TODAY',
        })
        router.replace(`${NEW}?step=4`)
      },
      () => {
        if (cancelled) return
        show(CREATE.againFail)
        router.replace(`${NEW}?step=1`)
      },
    )
    return () => {
      cancelled = true
    }
  }, [again, router, show])

  // 주제 없이 2단계 이상으로 들어오면 1단계로(주제 목록을 읽은 뒤).
  const lost = !again && step >= 2 && topics.status === 'ready' && !topic
  useEffect(() => {
    if (lost) router.replace(`${NEW}?step=1`)
  }, [lost, router])

  // 단계가 바뀌면 그 단계 제목으로 초점(처음 들어올 때는 옮기지 않는다).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headRef.current?.focus()
  }, [step])

  const go = useCallback(
    (n: number) => {
      setTried(false)
      router.push(`${NEW}?step=${n}`)
    },
    [router],
  )

  let block: string | null = null
  if (active || submitErr?.kind === 'active') block = CREATE.activeTitle
  else if (!topic) block = CREATE.needTopic
  else if (step >= 3 && !goal.lesson && !goal.words) block = CREATE.needGoal

  const submit = useCallback(async () => {
    if (busyRef.current || !topic) return
    busyRef.current = true
    setBusy(true)
    setSubmitErr(null)
    const body: CreateChallengeBody = {
      topicId: topic.id,
      lengthDays: draft.lengthDays,
      start: draft.start,
      dailyGoal: { lesson: goal.lesson, words: goal.words, ...(goal.words && goal.wordCount ? { wordCount: goal.wordCount } : {}) },
    }
    try {
      await apiPost<ChallengeDetail>('/api/v1/challenges', body)
      writeStore('session', DRAFT_KEY, null)
      writeStore('session', FLASH_KEY, '1')
      router.replace('/plan')
    } catch (e) {
      busyRef.current = false
      setBusy(false)
      setSubmitErr(createErrorOf(toErr(e)))
    }
  }, [draft.lengthDays, draft.start, goal.lesson, goal.words, goal.wordCount, router, topic])

  const onNext = () => {
    if (busy) return
    if (block) {
      setTried(true)
      return
    }
    if (step < 4) go(step + 1)
    else void submit()
  }

  const footReason =
    tried && block && !(active || submitErr?.kind === 'active')
      ? block
      : submitErr?.kind === 'fail'
        ? CREATE.failed
        : submitErr?.kind === 'rate'
          ? CREATE.rateLimited
          : null

  const back = step === 1 ? { href: '/plan', label: CREATE.backFirst } : { href: `${NEW}?step=${step - 1}`, label: CREATE.backPrev }
  const ready = hydrated && !again

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref={back.href} backLabel={back.label} title={CREATE.title} subtitle={`${step} / 4 · ${CREATE.stepNames[step - 1]}`} />
      <StepIndicator step={step} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {active || submitErr?.kind === 'active' ? (
          <InfoBox title={CREATE.activeTitle} className="mb-3">
            <p>{CREATE.activeBody}</p>
            <div className="mt-2 flex gap-2">
              <BtnLink href={`/plan/challenge/${encodeURIComponent(active?.id ?? (submitErr?.kind === 'active' ? (submitErr.challengeId ?? '') : ''))}`} replace>
                {CREATE.seeActive}
              </BtnLink>
              <BtnLink href="/plan" variant="ghost">
                {CREATE.backFirst}
              </BtnLink>
            </div>
          </InfoBox>
        ) : null}
        {!ready ? (
          <Skeleton heights={[86, 86, 86]} label={again ? CREATE.againLoading : CREATE.topicLoading} />
        ) : step === 1 || lost ? (
          <fieldset className="min-w-0">
            <legend className="contents">
              <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold outline-none">
                {CREATE.q1}
              </h2>
            </legend>
            <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.q1Body((topics.data?.level ?? []).join(' · ') || '—')}</p>
            <div className="mt-3">
              {topics.status === 'loading' ? (
                <Skeleton heights={[86, 86, 86, 86]} label={CREATE.topicLoading} />
              ) : topics.status === 'error' ? (
                <ErrorBox title={CREATE.topicError} onRetry={topics.reload} />
              ) : !topics.data?.items.length ? (
                <InfoBox>{CREATE.topicEmpty}</InfoBox>
              ) : (
                <ul className="flex flex-col gap-2">
                  {topics.data.items.map((t) => (
                    <TopicRadioCard key={t.id} topic={t} name={radioName} checked={t.id === draft.topicId} onSelect={() => setDraft((d) => ({ ...d, topicId: t.id }))} />
                  ))}
                </ul>
              )}
            </div>
          </fieldset>
        ) : !topic ? (
          <Skeleton heights={[86, 86]} label={CREATE.topicLoading} />
        ) : step === 2 ? (
          <fieldset className="min-w-0">
            <legend className="contents">
              <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold outline-none">
                {CREATE.q2}
              </h2>
            </legend>
            <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.q2Body(when)}</p>
            <div className="mt-3 flex flex-col gap-2">
              {CREATE.lengths.map((l) => (
                <RadioCard
                  key={l.days}
                  name={radioName}
                  checked={draft.lengthDays === l.days}
                  onSelect={() => setDraft((d) => ({ ...d, lengthDays: l.days }))}
                  title={l.name}
                  sub={l.sub}
                  extra={rangeLabel(startDate, l.days)}
                />
              ))}
            </div>
          </fieldset>
        ) : step === 3 ? (
          <GoalStep
            topic={topic}
            draft={draft}
            goal={goal}
            today={today}
            headRef={headRef}
            reasonId={reasonId}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
        ) : (
          <ConfirmStep topic={topic} draft={draft} goal={goal} startDate={startDate} when={when} headRef={headRef} err={submitErr} onFix={go} />
        )}
      </div>
      <div className="flex-none border-t border-line bg-surface px-4 pt-2.5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {footReason ? (
          <p id={blockId} role="alert" className="mb-2 text-[12.5px] text-bad break-keep">
            {footReason}
          </p>
        ) : null}
        <Btn
          className={ctaClass(busy)}
          aria-disabled={!!block || busy || undefined}
          aria-describedby={footReason ? blockId : undefined}
          aria-busy={busy || undefined}
          onClick={onNext}
        >
          {busy ? (
            <>
              <Spinner />
              {CREATE.starting}
            </>
          ) : step === 4 ? (
            CREATE.start
          ) : (
            CREATE.next
          )}
        </Btn>
      </div>
      <Toast message={message} bottomPx={88} />
    </div>
  )
}

function GoalStep({
  topic,
  draft,
  goal,
  today,
  headRef,
  reasonId,
  onChange,
}: {
  topic: Topic
  draft: Draft
  goal: { lesson: boolean; words: boolean; wordCount: ChallengeWordCount | null }
  today: string
  headRef: React.Ref<HTMLHeadingElement>
  reasonId: string
  onChange: (patch: Partial<Draft>) => void
}) {
  const opts = wordCountOptions(topic.chunks.length)
  const n = goal.wordCount ?? 10
  const wordsReasonId = `${reasonId}-w`
  return (
    <fieldset className="min-w-0">
      <legend className="contents">
        <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold outline-none">
          {CREATE.q3}
        </h2>
      </legend>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.q3Body}</p>
      <div className="mt-3 flex flex-col gap-2">
        <CheckCard
          checked={goal.words}
          disabled={!!opts.wordsBlocked}
          onToggle={() => onChange({ words: !goal.words, wordCount: goal.wordCount })}
          title={CREATE.wordsName(n)}
          body={CREATE.wordsBody(topic.title)}
          rule={CREATE.wordsRule(acceptLine(n))}
          reasonId={wordsReasonId}
        />
        {opts.wordsBlocked ? (
          <p id={wordsReasonId} className="text-[12px] text-ink2 break-keep">
            {opts.wordsBlocked}
          </p>
        ) : null}
        <CheckCard checked={goal.lesson} onToggle={() => onChange({ lesson: !goal.lesson })} title={CREATE.lessonName} body={CREATE.lessonBody(topic.title)} rule={CREATE.lessonRule} />
      </div>
      {goal.words ? (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-ink2">{CREATE.countLabel}</p>
          <ChoicePills label={CREATE.countLabel} options={opts.options} value={goal.wordCount} onChange={(v) => onChange({ wordCount: v })} reasonId={reasonId} />
          {opts.reason ? (
            <p id={reasonId} className="mt-2 text-[12px] text-ink2 break-keep">
              {opts.reason}
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-ink2 break-keep">{acceptLine(n)}</p>
        </div>
      ) : null}
      <div className="mt-4">
        <p className="mb-2 text-[12.5px] text-ink2">{CREATE.startLabel}</p>
        <Segmented
          ariaLabel={CREATE.startLabel}
          value={draft.start}
          onChange={(v) => onChange({ start: v })}
          options={[
            { value: 'TODAY', label: `오늘 ${md(today)}` },
            { value: 'TOMORROW', label: `내일 ${md(addDaysTo(today, 1))}` },
          ]}
        />
        {draft.start === 'TODAY' ? <p className="mt-2 text-[12px] text-ink2 break-keep">{CREATE.todayMemo}</p> : null}
      </div>
    </fieldset>
  )
}

function ConfirmStep({
  topic,
  draft,
  goal,
  startDate,
  when,
  headRef,
  err,
  onFix,
}: {
  topic: Topic
  draft: Draft
  goal: { lesson: boolean; words: boolean; wordCount: ChallengeWordCount | null }
  startDate: string
  when: string
  headRef: React.Ref<HTMLHeadingElement>
  err: CreateError | null
  onFix: (step: number) => void
}) {
  const later = draft.start === 'TOMORROW'
  const tasks = goalTasks({ ...goal, wordsMinAnswered: goal.wordCount ? minAnsweredOf(goal.wordCount) : null })
  const rows = tasks.map((t) => taskRowView(t, { later, preview: true }))
  const endDate = addDaysTo(startDate, draft.lengthDays - 1)
  return (
    <div className="min-w-0">
      {err?.kind === 'over' ? (
        <ErrorBox
          className="mb-3"
          title={CREATE.overTitle}
          body={CREATE.overBody(topic.title, err.poolSize, goal.wordCount ?? 0)}
          onRetry={() => onFix(3)}
          retryLabel={CREATE.overBtn}
        />
      ) : err?.kind === 'topic' ? (
        <ErrorBox className="mb-3" title={CREATE.topicGoneTitle} body={CREATE.topicGoneBody} onRetry={() => onFix(1)} retryLabel={CREATE.topicGoneBtn} />
      ) : null}
      <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold outline-none">
        {CREATE.q4}
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-[14px] border border-line bg-surface p-3.5">
        <dt className="text-[12.5px] text-ink2">{CREATE.rowName}</dt>
        <dd className="text-[14px] font-semibold [overflow-wrap:anywhere]">{autoTitle(topic.title, draft.lengthDays)}</dd>
        <dt className="text-[12.5px] text-ink2">{CREATE.rowTopic}</dt>
        <dd className="text-[14px] [overflow-wrap:anywhere]">
          {topic.title}
          {topic.titleJa ? (
            <span lang="ja" className="ml-1 text-[13px] text-ink2">
              {topic.titleJa}
            </span>
          ) : null}{' '}
          · {topic.level}
        </dd>
        <dt className="text-[12.5px] text-ink2">{CREATE.rowLength}</dt>
        <dd className="text-[14px] tabular-nums break-keep">
          {dayLabel(startDate)} ~ {dayLabel(endDate)} · {draft.lengthDays}일
        </dd>
        <dt className="text-[12.5px] text-ink2">{CREATE.rowGoal}</dt>
        <dd className="text-[14px] break-keep">{goalSummary(goal)}</dd>
      </dl>
      <h3 className="mt-4 text-[15px] font-semibold">{CREATE.firstTasks(when)}</h3>
      <TaskRows rows={rows} label={CREATE.firstTasks(when)} />
      <h3 className="mt-4 text-[15px] font-semibold">{CREATE.rulesTitle}</h3>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[12.5px] break-keep">
        {CREATE.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}
