'use client'

/**
 * AI 평가 시작 `/study/today/eval/new`(데모 v1 `#start-*`) — 종류(단어 10 · 회화 6)·레벨(기본 = 내 레벨)·회화면 주제를 고르고 #65.
 * 자막만이면 회화 평가를 고를 수 없다(결정 b=B). 단어가 모자라면(서버 기준 단어 6·회화 4 — 보관하지 않은 단어 수) [문제 만들기]를 막고
 * 단어장으로 안내한다. 진행 중인 평가가 있으면(409) 토스트 후 그 평가로 간다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge, Btn } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { categoryTotals, normalizeCategories } from '@/components/vocab/validate'
import type { CreateEvaluationResult, EvalKind } from '@/types/evaluation'
import type { JlptLevel, TopicList } from '@/types/lesson'
import { KIND_NAME, START } from './evalCopy'
import { LEVELS, NEED_WORDS, startBlock } from './logic'
import { BookIcon, ClockIcon, LockIcon, MicIcon } from './parts'
import { evalPath, genAtKey } from './paths'

function KindOption({ kind, checked, blocked, onPick, onBlocked }: { kind: EvalKind; checked: boolean; blocked: boolean; onPick: () => void; onBlocked: () => void }) {
  const desc = kind === 'WORDS' ? START.wordsDesc : START.talkDesc
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={blocked || undefined}
      onClick={() => (blocked ? onBlocked() : onPick())}
      className={`grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-2.5 rounded-[14px] border p-3.5 text-left ${
        blocked ? 'border-line bg-surface2' : checked ? 'border-accent bg-surface shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line bg-surface'
      }`}
    >
      <span aria-hidden="true" className={`mt-px grid h-[22px] w-[22px] place-items-center rounded-full border-2 ${blocked ? 'border-line' : checked ? 'border-accent' : 'border-ink3'}`}>
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 text-[16px] font-semibold">
          {KIND_NAME[kind]}
          {kind === 'TALK' && !blocked ? <Badge tone="neutral">{START.mic}</Badge> : null}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink2 break-keep">
          {desc[0]}
          <br />
          {desc[1]}
        </span>
        {blocked ? <span className="mt-1.5 block text-[13px] font-semibold text-bad break-keep">{START.talkBlocked}</span> : null}
      </span>
    </button>
  )
}

export default function EvalStartScreen({ myLevel, initialKind }: { myLevel: JlptLevel; initialKind: EvalKind }) {
  const router = useRouter()
  const toast = useToast()
  const { show } = toast
  const tts = useTtsRuntimeStatus()
  const textOnly = tts.snapshot.state === 'TEXT_ONLY'
  const [picked, setPicked] = useState<EvalKind>(initialKind)
  const kind: EvalKind = picked === 'TALK' && textOnly ? 'WORDS' : picked
  const [level, setLevel] = useState<JlptLevel>(myLevel)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [topics, setTopics] = useState<{ state: 'loading' | 'ready' | 'error'; items: { id: string; title: string }[] }>({ state: 'loading', items: [] })
  const [have, setHave] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet<unknown>('/api/v1/words/categories').then(
      (raw) => {
        if (!cancelled) setHave(categoryTotals(normalizeCategories(raw))?.active ?? null)
      },
      () => undefined,
    )
    apiGet<TopicList>('/api/v1/topics').then(
      (t) => !cancelled && setTopics({ state: 'ready', items: (t.items ?? []).map((x) => ({ id: x.id, title: x.title })) }),
      () => !cancelled && setTopics({ state: 'error', items: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const block = startBlock(kind, textOnly, have)
  const shortage = block === 'FEW' ? { have: have ?? 0, need: NEED_WORDS[kind] } : null

  const make = async () => {
    if (busy) return
    if (block === 'FEW') return show(START.fewWhy(NEED_WORDS[kind]))
    setBusy(true)
    try {
      const r = await apiPost<CreateEvaluationResult>('/api/v1/evaluations', { kind, level, topicId: kind === 'TALK' ? topicId : null })
      writeStore('session', genAtKey(r.evaluationId), String(Date.now()))
      router.push(evalPath(r.evaluationId))
    } catch (e) {
      setBusy(false)
      const err = toErr(e)
      const reason = detailString(err, 'reason')
      if (err.status === 409 && reason === 'IN_PROGRESS') {
        const id = detailString(err, 'evaluationId')
        show(START.inProgress)
        if (id) setTimeout(() => router.push(evalPath(id)), 900)
        return
      }
      if (err.status === 400 && reason === 'NOT_ENOUGH_WORDS') {
        const h = Number(err.details.have)
        return setHave(Number.isFinite(h) ? h : 0)
      }
      if (err.status === 404) return show(START.topicMissing)
      if (err.status === 429) return show(START.rateLimited)
      show(err.status === 0 ? err.message : START.failed)
    }
  }

  const rules: { icon: React.ReactNode; text: React.ReactNode }[] = [
    { icon: <ClockIcon />, text: <><b className="font-semibold">{START.ruleTime[0]}</b>{START.ruleTime[1]}</> },
    { icon: <LockIcon />, text: <><b className="font-semibold">{START.ruleLock[0]}</b>{START.ruleLock[1]}</> },
    { icon: <BookIcon />, text: <>{START.ruleBook[0]}<b className="font-semibold">{START.ruleBook[1]}</b>{START.ruleBook[2]}</> },
    ...(kind === 'TALK' ? [{ icon: <MicIcon size={16} />, text: <>{START.ruleMic[0]}<b className="font-semibold">{START.ruleMic[1]}</b>{START.ruleMic[2]}</> }] : []),
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel={START.back} title={START.title} subtitle={START.sub} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
        <div>
          <h2 id="eval-kind-q" className="text-[15px] font-semibold">
            {START.question}
          </h2>
          <div role="radiogroup" aria-labelledby="eval-kind-q" className="mt-2 flex flex-col gap-2">
            {(['WORDS', 'TALK'] as const).map((k) => (
              <KindOption
                key={k}
                kind={k}
                checked={kind === k && !(k === 'TALK' && textOnly)}
                blocked={k === 'TALK' && textOnly}
                onPick={() => setPicked(k)}
                onBlocked={() => show(START.talkBlocked)}
              />
            ))}
          </div>
        </div>

        <div>
          <span id="eval-level-l" className="block text-[12.5px] font-medium text-ink2">
            {START.level}
          </span>
          <div role="radiogroup" aria-labelledby="eval-level-l" className="mt-1.5 flex gap-[3px] rounded-xl bg-surface2 p-[3px]">
            {LEVELS.map((l) => {
              const on = level === l
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLevel(l)}
                  className={`flex h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-[9px] text-[14px] leading-[1.15] ${on ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'font-medium text-ink2'}`}
                >
                  {l}
                  {l === myLevel ? <small className="text-[11px] font-medium text-ink2">{START.myLevel}</small> : null}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink2 break-keep">{START.levelNote}</p>
        </div>

        {kind === 'TALK' ? (
          <div>
            <span id="eval-topic-l" className="block text-[12.5px] font-medium text-ink2">
              {START.topic}
            </span>
            <div role="radiogroup" aria-labelledby="eval-topic-l" className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto py-1.5">
              {[{ id: null as string | null, title: START.topicAuto }, ...topics.items].map((t) => {
                const on = topicId === t.id
                return (
                  <button
                    key={t.id ?? 'auto'}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTopicId(t.id)}
                    className={`relative inline-flex h-8 flex-none items-center rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
                      on ? 'border-ink bg-ink font-semibold text-surface' : 'border-line bg-surface'
                    }`}
                  >
                    {t.title}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-[12px] text-ink2 break-keep">{topics.state === 'error' ? START.topicsError : START.topicNote}</p>
          </div>
        ) : null}

        <section className="rounded-[14px] bg-surface2 p-3.5">
          <h3 className="text-[15px] font-semibold">{START.rulesTitle}</h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {rules.map((r, i) => (
              <li key={i} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
                <span aria-hidden="true" className="grid h-[26px] w-[26px] place-items-center rounded-full bg-surface text-ink2">
                  {r.icon}
                </span>
                <p className="min-w-0 text-[14px] break-keep">{r.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {shortage ? (
          <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
            <p className="font-bold">{START.few(shortage.have)}</p>
            <p className="mt-1">{START.fewBody(KIND_NAME[kind], shortage.need)}</p>
            <Link href="/drawer/words" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]">
              {START.fewGo}
            </Link>
          </div>
        ) : null}

        <div>
          <Btn className="w-full aria-busy:opacity-70 aria-disabled:opacity-40" aria-disabled={block !== null || undefined} aria-busy={busy || undefined} onClick={() => void make()}>
            {busy ? START.making : START.make}
          </Btn>
          <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{START.makeNote}</p>
        </div>
      </div>
      <Toast message={toast.message} bottomPx={24} />
    </div>
  )
}
