'use client'

/**
 * 감사 기록 탭(#137, 데모 v2 `histAudit`, 결정 d3 = A): 분류 칩(scope) + 기간 + [필터 더 보기](작업·사람, 다른 환경은 최고관리자만).
 * 행 = 시각 · 작업 이름 · action 코드 · 대상 · 작업자 · 이유. 펼치면 키마다 "전 → 후" 한 줄(저장 때 이미 가린 값 — 비밀은 참조 이름만),
 * DEVELOPER 이상(trace.read)은 [원문 JSON] 펼침. 발음 사전 분류는 분류가 생기기 전 옛 기록(scope 없음)도 함께 — "옛 기록" 뱃지.
 */
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { useNow } from '@/components/common/useNow'
import type { AdminEnvironment, AuditItemDto } from '@/types/admin'
import { ChipRadio, type ChipOption } from '../console/ChipRadio'
import { ConsoleError, EmptyNote, loadErrorText } from '../console/ConsoleStates'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { formatClockSec } from '../console/format'
import { ACTION_FILTERS, actionLabel } from '../configEditor/configCopy'
import type { ConfigAccess } from '../configEditor/configAccess'
import { ValueSpan } from '../configEditor/DiffView'
import { NeutralTag } from '../configEditor/ui'
import { actorOptions, actorText, AUDIT_CATEGORIES, type AuditCategory, auditLines, auditPath, type AuditPeriod, dayLabel, isOldLexicon, isReadAudit, PERIOD_OPTIONS } from './historyQuery'
import { usePaged } from './usePaged'

const SELECT = 'mt-1 h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-2.5 text-[16px] text-ink'

function AuditRow({ a, open, onToggle, canTrace, onVersion }: { a: AuditItemDto; open: boolean; onToggle: () => void; canTrace: boolean; onVersion: (id: string) => void }) {
  const lines = auditLines(a)
  const ja = lines.some((l) => /defaultText/.test(l.key)) || a.action.startsWith('lexicon.')
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
        <span className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12px] tabular-nums text-ink2">{formatClockSec(a.createdAt).slice(0, 5)}</span>
          <span className="text-[14px] font-semibold">{actionLabel(a.action)}</span>
          {isOldLexicon(a) ? <NeutralTag>옛 기록</NeutralTag> : null}
          <span aria-hidden="true" className="ml-auto text-ink2">
            {open ? '˄' : '˅'}
          </span>
        </span>
        <span className="font-mono text-[11.5px] text-ink2">{a.action}</span>
        <span className="text-[13px] [overflow-wrap:anywhere]">{a.summary ?? a.targetId ?? '—'}</span>
        <span className="w-full min-w-0 truncate text-[12px] text-ink2">
          {actorText(a.actor)}
          {a.reason ? ` · “${a.reason}”` : ''}
        </span>
      </button>
      {open ? (
        <div className="mx-3.5 mb-3 border-l-2 border-line pl-3 text-[13px]">
          {isReadAudit(a.action) ? <p className="text-[12.5px] text-ink2">조회만 — 값은 기록하지 않아요.</p> : null}
          {lines.length ? (
            lines.map((l) => (
              <div key={l.key} className="grid min-w-0 gap-0.5 border-t border-dashed border-line py-1.5 first:border-t-0">
                <span className="font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{l.key}</span>
                <span className="[overflow-wrap:anywhere]">
                  {l.hasBefore ? (
                    <>
                      <ValueSpan k={l.key} v={l.before} ja={ja} strike /> <span aria-label="에서">→</span>{' '}
                    </>
                  ) : null}
                  <b>
                    <ValueSpan k={l.key} v={l.after} ja={ja} />
                  </b>
                </span>
              </div>
            ))
          ) : !isReadAudit(a.action) && !canTrace ? (
            <p className="text-[12.5px] text-ink2">바뀐 값 요약이 없는 기록이에요.</p>
          ) : null}
          {canTrace && (a.before !== null || a.after !== null) ? (
            <details className="group mt-0.5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="inline-block text-ink2 group-open:rotate-90">
                  ▸
                </span>
                원문 JSON
              </summary>
              <div className="grid gap-2 @container">
                <div className="grid gap-2 @min-[440px]:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[12px] text-ink2">before</p>
                    <pre className="m-0 whitespace-pre-wrap rounded-[10px] bg-surface2 px-2.5 py-2 font-mono text-[12px] leading-[1.5] [overflow-wrap:anywhere]">{JSON.stringify(a.before, null, 2)}</pre>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-ink2">after</p>
                    <pre className="m-0 whitespace-pre-wrap rounded-[10px] bg-surface2 px-2.5 py-2 font-mono text-[12px] leading-[1.5] [overflow-wrap:anywhere]">{JSON.stringify(a.after, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </details>
          ) : null}
          <p className="mt-1 text-[12px] text-ink2">
            환경 {a.environment}
            {a.ip ? ` · IP ${a.ip}` : ''}
            {isOldLexicon(a) ? ' · 분류 없음(옛 기록)' : ''}
          </p>
          {a.versionId || (a.traceId && canTrace) ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3">
              {a.versionId ? (
                <button type="button" onClick={() => onVersion(a.versionId!)} className="inline-flex min-h-11 items-center px-1 text-[12.5px] font-medium text-accent">
                  버전 보기 ›
                </button>
              ) : null}
              {a.traceId && canTrace ? (
                <Link href={`/admin/diagnostics/traces/${encodeURIComponent(a.traceId)}`} className="inline-flex min-h-11 items-center px-1 text-[12.5px] font-medium text-accent">
                  Trace {a.traceId.slice(0, 10)} ›
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export default function AuditTab({ access, env, onVersion }: { access: ConfigAccess; env: AdminEnvironment; onVersion: (id: string) => void }) {
  // 기간 시작은 화면을 연 시각 기준(하루에 한 번만 다시 잰다) — 분마다 바뀌면 경로가 바뀌어 [더 보기]로 붙인 목록이 처음부터 다시 읽힌다.
  const now = useNow(true, 86_400_000)
  const [category, setCategory] = useState<AuditCategory>('all')
  const [period, setPeriod] = useState<AuditPeriod>('7d')
  const [action, setAction] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [environment, setEnvironment] = useState<AdminEnvironment | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const minute = now ? Math.floor(now / 60_000) * 60_000 : 0
  const pathFor = useCallback((cursor: string | null) => (minute ? auditPath({ category, period, action, actorUserId, environment }, minute, cursor) : ''), [category, period, action, actorUserId, environment, minute])
  const list = usePaged<AuditItemDto>(minute ? pathFor : null)
  const actors = useMemo(() => actorOptions(list.items), [list.items])

  let lastDay = ''
  const groups: { day: string; items: AuditItemDto[] }[] = []
  for (const a of list.items) {
    const d = dayLabel(a.createdAt, now)
    if (d !== lastDay) {
      groups.push({ day: d, items: [a] })
      lastDay = d
    } else groups[groups.length - 1].items.push(a)
  }
  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const catOptions: ChipOption<AuditCategory>[] = AUDIT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))

  return (
    <>
      <p className="mt-3 text-[13px] text-ink2 break-keep">관리자가 한 일(적용·되돌리기·비밀 참조 연결·켜기/끄기·민감 조회)이 시간순으로 남아요. 값은 저장할 때 이미 가려져 있고, 비밀은 참조 이름만 있어요.</p>
      <div className="mt-2">
        <ChipRadio ariaLabel="분류" options={catOptions} value={category} onChange={setCategory} />
      </div>
      <div className="mt-1.5">
        <ConsoleSegmented ariaLabel="기간" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>
      <details className="group mt-1">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-block text-ink2 group-open:rotate-90">
            ▸
          </span>
          필터 더 보기 — 작업 · 사람{access.canOtherEnv ? ' · 환경' : ''}
        </summary>
        <div className="grid gap-2 rounded-[14px] border border-line bg-surface p-3.5">
          <label className="text-[12.5px] font-medium text-ink2">
            작업
            <select value={action} onChange={(e) => setAction(e.target.value)} className={SELECT}>
              {ACTION_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12.5px] font-medium text-ink2">
            사람
            <select value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} className={SELECT}>
              <option value="">전체</option>
              {actors.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {access.canOtherEnv ? (
            <label className="text-[12.5px] font-medium text-ink2">
              환경 (최고관리자만)
              <select value={environment ?? ''} onChange={(e) => setEnvironment((e.target.value || null) as AdminEnvironment | null)} className={SELECT}>
                <option value="">{env} (지금)</option>
                {(['LOCAL', 'PRODUCTION'] as const)
                  .filter((x) => x !== env)
                  .map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <p className="text-[12px] text-ink2">지금 환경({env}) 기록만 보여요.</p>
          )}
        </div>
      </details>
      {category === 'lex' ? <p className="mt-2 rounded-xl bg-surface2 px-3 py-2.5 text-[12.5px] break-keep">발음 사전 분류에는 분류가 생기기 전(9월 28일 전) 기록도 함께 나와요 — “옛 기록” 표시.</p> : null}
      {list.err && list.items.length === 0 ? (
        <div className="mt-2.5">
          <ConsoleError message={loadErrorText(list.err, '감사 기록')} onRetry={list.reload} />
        </div>
      ) : list.loading ? (
        <p role="status" className="py-8 text-center text-[13px] text-ink2">
          불러오는 중…
        </p>
      ) : list.items.length === 0 ? (
        <div className="mt-2.5">
          <EmptyNote>조건에 맞는 기록이 없어요.</EmptyNote>
        </div>
      ) : (
        <div className="mt-2.5">
          {groups.map((g) => (
            <div key={`${g.day}-${g.items[0].id}`}>
              <p className="mb-1.5 mt-3 text-[12px] font-semibold text-ink2">{g.day}</p>
              <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
                {g.items.map((a) => (
                  <AuditRow key={a.id} a={a} open={openIds.has(a.id)} onToggle={() => toggle(a.id)} canTrace={access.canTrace} onVersion={onVersion} />
                ))}
              </ul>
            </div>
          ))}
          {list.err ? (
            <div className="mt-2">
              <ConsoleError message={loadErrorText(list.err, '감사 기록')} onRetry={list.loadMore} />
            </div>
          ) : null}
          {list.nextCursor ? (
            <button type="button" aria-busy={list.loadingMore || undefined} disabled={list.loadingMore} onClick={list.loadMore} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink disabled:opacity-60">
              {list.loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          ) : null}
        </div>
      )}
    </>
  )
}
