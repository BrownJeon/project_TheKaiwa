'use client'

/**
 * 주제 고르기 `/study/today/talk/new`(screens §12-2 B · 데모 v2 `#topics`·`#topics-sheet`). #56 목록 + 붙여넣기 카드, 행을 누르면 시트.
 * 마운트할 때 #56 과 #58(추천 예고 줄 — 실패하면 조용히 없음)을 함께 읽는다. 붙여넣기 카드는 로딩·오류 중에도 보인다.
 */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import Sheet from '@/components/common/Sheet'
import Toast, { useToast } from '@/components/common/Toast'
import BackBar from '@/components/shell/BackBar'
import { Badge, BtnRow, Btn, Card, EmptyBlock, ErrorBlock } from '@/components/common/ui'
import { kstDateKey } from '@/components/common/format'
import { formatMonthDay } from '@/components/vocab/format'
import type { JlptLevel, LessonRecommendation, Topic, TodayLessons, TopicList } from '@/types/lesson'
import { CHUNK_TYPE_LABEL, CHUNK_TYPE_ORDER, HOME, TOPICS } from './lessonCopy'
import { useLessonCreate } from './useLessonCreate'

const lastDate = (iso: string | null) => (iso ? formatMonthDay(kstDateKey(iso)) : '')

function TopicRow({ t, onOpen }: { t: Topic; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
        className="flex min-h-[72px] w-full min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
            {t.title}
            {t.titleJa ? (
              <span lang="ja" className="ml-1.5 text-[13px] font-normal text-ink2">
                {t.titleJa}
              </span>
            ) : null}
          </span>
          {t.description ? <span className="mt-0.5 line-clamp-2 text-[13px] text-ink2 break-keep">{t.description}</span> : null}
          {t.lessonCount > 0 ? (
            <span className="mt-0.5 text-[12px] text-ink2">{TOPICS.lastLessons(t.lessonCount, lastDate(t.lastLessonAt))}</span>
          ) : (
            <span className="mt-0.5 text-[12px] font-semibold text-good">{TOPICS.never}</span>
          )}
        </span>
        <Badge tone="neutral">{t.level}</Badge>
        <span aria-hidden="true" className="text-[18px] text-ink3">
          ›
        </span>
      </button>
    </li>
  )
}

export function TopicSheet({
  topic,
  rec,
  busy,
  onCreate,
  onClose,
}: {
  topic: Topic | null
  rec: LessonRecommendation | null
  busy: boolean
  onCreate: (t: Topic) => void
  onClose: () => void
}) {
  const t = topic
  const groups = t ? CHUNK_TYPE_ORDER.map((type) => ({ type, items: t.chunks.filter((c) => c.chunkType === type) })).filter((g) => g.items.length) : []
  const continuing = !!t && !!rec && rec.topicId === t.id && rec.reason === 'CONTINUE' && !!rec.nextPreview
  return (
    <Sheet open={!!t} title={t?.title ?? ''} onClose={onClose} dismissible={!busy}>
      {t ? (
        <div className="pb-2">
          <p className="flex items-center gap-2">
            {t.titleJa ? (
              <span lang="ja" className="text-[15px]">
                {t.titleJa}
              </span>
            ) : null}
            <Badge tone="neutral">{t.level}</Badge>
          </p>
          {t.description ? <p className="mt-1 text-[14px] break-keep">{t.description}</p> : null}
          <h3 className="mt-3 text-[15px] font-semibold">{TOPICS.sheetExpr(t.chunks.length)}</h3>
          <div className="mt-2 flex flex-col gap-2.5">
            {groups.map((g) => (
              <div key={g.type}>
                <p className="text-[12px] text-ink2">{CHUNK_TYPE_LABEL[g.type]}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {g.items.map((c) => (
                    <li key={c.id} className="inline-flex max-w-full min-w-0 items-baseline gap-1.5 rounded-[10px] bg-surface2 px-2.5 py-1.5">
                      <span lang="ja" className="text-[15px] [overflow-wrap:anywhere]">
                        {c.textJa}
                      </span>
                      <span className="text-[12px] text-ink2">{c.meaningKo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {t.lessonCount > 0 ? (
            <div className="mt-3 rounded-xl bg-surface2 px-3 py-2.5 text-[13px]">
              <p className="[overflow-wrap:anywhere]">
                {TOPICS.lastLessons(t.lessonCount, lastDate(t.lastLessonAt))}
                {t.lastLessonTitle ? (
                  <>
                    {' '}
                    <span lang="ja">「{t.lastLessonTitle}」</span>
                  </>
                ) : null}
              </p>
              {continuing ? (
                <p className="mt-1 break-keep">
                  <b>{TOPICS.continuePreview}</b> · {rec?.nextPreview?.titleKo}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-[12px] text-ink2 break-keep">{TOPICS.sheetNote}</p>
          <BtnRow>
            <Btn aria-busy={busy || undefined} onClick={() => onCreate(t)}>
              {busy ? HOME.creating : HOME.create}
            </Btn>
            <Btn variant="ghost" aria-disabled={busy || undefined} onClick={() => !busy && onClose()}>
              {TOPICS.close}
            </Btn>
          </BtnRow>
        </div>
      ) : null}
    </Sheet>
  )
}

export default function LessonTopicsScreen({ myLevel }: { myLevel: JlptLevel }) {
  const toast = useToast()
  const { show } = toast
  const { create, busy } = useLessonCreate(show)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [list, setList] = useState<TopicList | null>(null)
  const [rec, setRec] = useState<LessonRecommendation | null>(null)
  const [open, setOpen] = useState<Topic | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiGet<TopicList>('/api/v1/topics').then(
      (d) => {
        if (cancelled) return
        setList(d)
        setState('ready')
      },
      () => !cancelled && setState('error'),
    )
    apiGet<TodayLessons>('/api/v1/lessons/today').then(
      (d) => !cancelled && setRec(d.recommendation),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [tick])

  const close = useCallback(() => setOpen(null), [])
  const levels = list?.level?.length ? list.level : [myLevel]

  return (
    <>
      <BackBar sticky backHref="/study/today" backLabel={TOPICS.back} title={TOPICS.title} subtitle={TOPICS.subtitle} />
      <div className="flex flex-col gap-[18px] px-4 pb-8 pt-3.5">
        <p className="text-[14px] break-keep">{TOPICS.intro(myLevel, levels)}</p>
        {state === 'loading' ? (
          <div>
            <p role="status" className="sr-only">
              {TOPICS.loading}
            </p>
            <div className="flex flex-col gap-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="block h-[86px] rounded-[14px] bg-surface2" />
              ))}
            </div>
          </div>
        ) : state === 'error' ? (
          <ErrorBlock
            message={TOPICS.loadError}
            onRetry={() => {
              setState('loading')
              setTick((n) => n + 1)
            }}
          />
        ) : list && list.items.length ? (
          <ul className="flex flex-col gap-2">
            {list.items.map((t) => (
              <TopicRow key={t.id} t={t} onOpen={() => setOpen(t)} />
            ))}
          </ul>
        ) : (
          <EmptyBlock>{TOPICS.empty}</EmptyBlock>
        )}
        <Card>
          <p className="text-[15px] font-semibold">{TOPICS.pasteTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{TOPICS.pasteBody}</p>
          <Link href="/study/today/talk/new/paste" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
            {TOPICS.pasteBtn}
          </Link>
        </Card>
      </div>
      <TopicSheet topic={open} rec={rec} busy={busy} onClose={close} onCreate={(t) => void create({ topicId: t.id })} />
      <Toast message={toast.message} bottomPx={24} />
    </>
  )
}
