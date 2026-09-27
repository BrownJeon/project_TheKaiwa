'use client'

/**
 * 항목 목록(screens.md §10-2 B): 컨테이너 ≥720px = `<table>` 7열, <720px = 카드 행. 두 모양 모두 DOM 에 있고 하나는 `display:none`.
 * 표기·읽기는 자르지 않고 줄바꿈한다. 표에서는 첫 칸 버튼이 키보드·스크린리더 진입점이고 `<tr onClick>` 은 마우스 편의일 뿐이다.
 * 꺼진 항목 행을 흐리게 하지 않는다(명암비) — 뱃지 "꺼짐"만.
 */
import type { LexiconEntryDto } from '@/types/lexicon'
import { formatAgo } from '../console/format'
import { EntryStatusBadge } from './Badges'
import { refLabel, WORD_TYPE_KO } from './lexiconCopy'

export default function LexiconList({
  items,
  total,
  page,
  pageSize,
  canWrite,
  voiceName,
  now,
  onOpen,
}: {
  items: readonly LexiconEntryDto[]
  total: number
  page: number
  pageSize: number
  canWrite: boolean
  voiceName: (id: string) => string | null
  now: number
  onOpen: (e: LexiconEntryDto) => void
}) {
  const from = (page - 1) * pageSize + 1
  const to = from + items.length - 1
  return (
    <div className="@container min-w-0">
      <table className="hidden w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-[14px] border border-line bg-surface @min-[720px]:table">
        <caption className="sr-only">
          발음 사전 항목 {total}개 중 {from}–{to}
        </caption>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr className="text-left text-[12px] text-ink2">
            {['표기', '읽기', '악센트', '우선순위', '범위', '상태', '수정'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} onClick={() => onOpen(e)} className="cursor-pointer align-top hover:bg-surface2 [&>td]:border-t [&>td]:border-line [&>td]:px-3 [&>td]:py-2">
              <td>
                <button
                  type="button"
                  aria-label={`${e.surface} ${canWrite ? '고치기' : '보기'}`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onOpen(e)
                  }}
                  lang="ja"
                  className="flex min-h-11 w-full items-start pt-1 text-left text-[16px] font-semibold [overflow-wrap:anywhere]"
                >
                  {e.surface}
                </button>
              </td>
              <td lang="ja" className="pt-3 text-[15px] [overflow-wrap:anywhere]">
                {e.reading}
              </td>
              <td className="pt-3 text-[13px] tabular-nums">
                {e.accentType}
                {e.accentType === 0 ? <span className="text-ink2"> 평판</span> : null}
              </td>
              <td className="pt-3 text-[13px] tabular-nums">{e.priority}</td>
              <td className="pt-3 text-[13px]">
                <span className="font-mono">{e.scope}</span>
                {e.scopeRefId ? <span className="block truncate text-[12px] text-ink2">{refLabel(e, voiceName)}</span> : null}
              </td>
              <td className="pt-3">
                <EntryStatusBadge enabled={e.enabled} />
              </td>
              <td className="pt-3 text-[12px] text-ink2">{formatAgo(e.updatedAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface @min-[720px]:hidden">
        {items.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onOpen(e)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
              <span className="flex w-full min-w-0 items-start gap-2">
                <span lang="ja" className="min-w-0 flex-1 text-[17px] font-semibold [overflow-wrap:anywhere]">
                  {e.surface}
                </span>
                <EntryStatusBadge enabled={e.enabled} />
              </span>
              <span className="min-w-0 text-[13px] text-ink2 [overflow-wrap:anywhere]">
                <span lang="ja" className="text-[15px] text-ink">
                  {e.reading}
                </span>{' '}
                · 악센트 {e.accentType}
                {e.accentType === 0 ? '(평판)' : ''}
              </span>
              <span className="flex w-full min-w-0 gap-2 text-[12px] text-ink2">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono">{e.scope}</span>
                  {e.scopeRefId ? ` ${refLabel(e, voiceName)}` : ''} · 우선 {e.priority}
                  {e.wordType ? ` · ${WORD_TYPE_KO[e.wordType]}` : ''} · {formatAgo(e.updatedAt, now)}
                </span>
                <span aria-hidden="true">›</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <nav aria-label="쪽 이동" className="mt-3 flex items-center justify-between">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-11 px-3 text-[14px] font-medium text-ink disabled:text-ink2">
        ‹ 이전
      </button>
      <span aria-live="polite" className="text-[13px] tabular-nums text-ink2">
        {page} / {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-11 px-3 text-[14px] font-medium text-ink disabled:text-ink2">
        다음 ›
      </button>
    </nav>
  )
}
