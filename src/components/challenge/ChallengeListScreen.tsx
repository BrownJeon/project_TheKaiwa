'use client'

/**
 * 챌린지 기록 `/plan/challenges`(가이드 §3-6 기록) — #155 `status=ALL&limit=20`, 진행 중 먼저·끝난 것은 끝난 날 역순(서버 순서 그대로). 더 보기는 커서 —
 * 빈 쪽은 훅이 이어 읽고(`readListPages`), 그래도 행 없이 커서만 남으면 빈 상태 대신 [더 보기] 만 그린다.
 */
import Link from 'next/link'
import { useCallback } from 'react'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge, Btn } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import { Spinner } from '@/components/plan/parts'
import { COPY } from './challengeCopy'
import { isListEmpty, listRowView, type ListBadge } from './logic'
import { BtnLink, ErrorBox, Skeleton } from './parts'
import { useChallengeList } from './useChallengeData'

function ListBadgeView({ badge, text }: { badge: ListBadge; text: string }) {
  if (badge === 'active')
    return <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-surface px-2 text-[11.5px] font-semibold text-ink ring-1 ring-ink2">{text}</span>
  return <Badge tone={badge === 'full' ? 'good' : 'neutral'}>{text}</Badge>
}

export default function ChallengeListScreen() {
  const { message, show } = useToast()
  const onMoreFail = useCallback(() => show(COPY.moreFail), [show])
  const list = useChallengeList(onMoreFail)
  return (
    <>
      <BackBar sticky backHref="/plan" backLabel={COPY.toPlan} title={COPY.listTitle} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3">
        {list.status === 'loading' ? (
          <Skeleton heights={[72, 72, 72]} label={COPY.listLoading} />
        ) : list.status === 'error' ? (
          <ErrorBox title={COPY.listError} onRetry={list.reload} />
        ) : isListEmpty(list.items, list.cursor) ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink2">
            <p className="break-keep">{COPY.listEmpty}</p>
            <div className="mt-3 flex">
              <BtnLink href="/plan/challenge/new">{COPY.startCta}</BtnLink>
            </div>
          </div>
        ) : (
          <>
            {list.items.length ? (
              <>
                <ul className="flex flex-col gap-2">
                  {list.items.map((s) => {
                    const v = listRowView(s)
                    return (
                      <li key={s.id} className="min-w-0">
                        <Link
                          href={`/plan/challenge/${encodeURIComponent(s.id)}?from=list`}
                          className="flex min-h-[72px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-3"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <b className="text-[15px] font-semibold [overflow-wrap:anywhere]">{s.title}</b>
                            <span className="text-[12.5px] text-ink2 break-keep">{v.desc}</span>
                          </span>
                          <ListBadgeView badge={v.badge} text={v.badgeText} />
                          <span aria-hidden="true" className="text-[18px] text-ink2">
                            ›
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2.5 text-[12px] text-ink2 break-keep">{COPY.listNote}</p>
              </>
            ) : null}
            {list.cursor ? (
              <Btn variant="ghost" className="mt-3 w-full" aria-busy={list.more === 'busy' || undefined} onClick={list.loadMore}>
                {list.more === 'busy' ? (
                  <>
                    <Spinner />
                    {COPY.moreBusy}
                  </>
                ) : (
                  COPY.more
                )}
              </Btn>
            ) : null}
          </>
        )}
      </div>
      <Toast message={message} bottomPx={24} />
    </>
  )
}
