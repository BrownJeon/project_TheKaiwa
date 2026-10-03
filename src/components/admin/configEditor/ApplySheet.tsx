'use client'

/**
 * 적용 확인 창(데모 v2 `applySheet`) — 개발 환경 "설정 적용" / 운영 "운영(PRODUCTION)에 적용"(최고관리자만 이 창을 본다).
 * 대상 · v{지금} → v{다음} · 요약 칩 · 바뀐 키 4줄 · (운영) 요약 해시·기능 테스트 결과 · (첫 적용) 기준선 v1 안내 · 이유(+ PRODUCTION 입력).
 * 실패 갈래는 확정 버튼 위 알림(409 충돌 → [최신 값 기준으로 다시 비교]·[초안 버리기] 등, `flow.writeErrorView`).
 */
import Sheet from '@/components/common/Sheet'
import { useNow } from '@/components/common/useNow'
import type { AdminEnvironment, ConfigDiffDto, ConfigTestDto } from '@/types/admin'
import { StatusBadge } from '../console/Badges'
import { formatClockSec, formatMs } from '../console/format'
import { DiffList, summaryOf, SummaryChips, type ValueNamer } from './DiffView'
import { type NoticeAction, testMinutesLeft } from './flow'
import ReasonFields from './ReasonFields'
import type { SheetNoticeView } from './useConfigEditor'

export const NOTICE_ACTION_KO: Record<NoticeAction, string> = {
  rebase: '최신 값 기준으로 다시 비교',
  discard: '초안 버리기',
  remakeDiff: '변경 요약 다시 만들기',
  retest: '다시 테스트',
  roleLink: '역할 페이지로',
  reload: '새로 불러오기',
}

export function SheetNotice({ notice, onAction }: { notice: SheetNoticeView; onAction: (a: NoticeAction) => void }) {
  return (
    <div role="alert" className="mt-3 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
      <p className="break-keep">{notice.text}</p>
      {notice.actions.length ? (
        <div className="-mb-2 flex flex-wrap gap-x-3">
          {notice.actions.map((a) => (
            <button key={a} type="button" onClick={() => onAction(a)} className="-ml-1 inline-flex h-11 items-center px-1 font-semibold underline">
              {NOTICE_ACTION_KO[a]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 요약 해시 줄임(앞 6 · 뒤 4). */
export function shortHash(h: string | null | undefined): string {
  if (!h) return '—'
  const s = h.replace(/^sha256:/, '')
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s
}

export function TestLine({ test, required }: { test: ConfigTestDto | null; required: boolean }) {
  const now = useNow(true, 30_000)
  if (!required) return <p className="text-[13px] text-ink2">바뀐 키가 모두 실행 확인이 필요 없는 키라 테스트 없이 적용해요.</p>
  if (!test || test.status === 'failed') return <p className="text-[13px] font-semibold text-bad">통과한 기능 테스트가 없어요.</p>
  if (test.status === 'partial' || !test.testResultId) return <p className="text-[13px] font-semibold text-bad">일부 키만 확인돼 운영에 적용할 수 없어요.</p>
  const left = testMinutesLeft(test.expiresAt, now)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <StatusBadge value="PASSED" />
      <span className="text-[13px]">
        {test.latencyMs !== null ? `${formatMs(test.latencyMs)} · ` : ''}
        {left === null ? '30분 유효' : left > 0 ? `${left}분 남음` : <b className="text-bad">만료</b>}
      </span>
      {test.traceId ? <span className="min-w-0 truncate font-mono text-[12px] text-ink2">{test.traceId}</span> : null}
    </div>
  )
}

export default function ApplySheet({
  open,
  production,
  needsConfirm,
  env,
  targetName,
  scopeLabel,
  baseVersion,
  diff,
  diffAt,
  test,
  ja,
  namer,
  reason,
  onReason,
  reasonError,
  confirm,
  onConfirm,
  confirmError,
  notice,
  onNoticeAction,
  applying,
  onSubmit,
  onClose,
}: {
  open: boolean
  production: boolean
  needsConfirm: boolean
  env: AdminEnvironment
  targetName: string
  scopeLabel: string
  baseVersion: number
  diff: ConfigDiffDto | null
  diffAt: number | null
  test: ConfigTestDto | null
  ja?: boolean
  namer?: ValueNamer
  reason: string
  onReason: (v: string) => void
  reasonError: string | null
  confirm: string
  onConfirm: (v: string) => void
  confirmError: string | null
  notice: SheetNoticeView | null
  onNoticeAction: (a: NoticeAction) => void
  applying: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const next = baseVersion === 0 ? 2 : baseVersion + 1
  const hideGo = Boolean(notice?.block)
  return (
    <Sheet open={open} title={production ? '운영(PRODUCTION)에 적용' : '설정 적용'} onClose={onClose} dismissible={!applying}>
      {production ? (
        <div role="note" className="rounded-xl border border-bad bg-surface px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-bad">운영(PRODUCTION) 설정을 바꿔요</p>
          <p className="mt-0.5 break-keep">적용하는 순간 모든 학습자의 요청에 반영돼요(이 서버는 바로, 다른 서버 프로세스는 30초 안에).</p>
        </div>
      ) : null}
      <p className={`text-[14px] font-semibold [overflow-wrap:anywhere] ${production ? 'mt-3' : ''}`}>{targetName}</p>
      <p className="text-[12px] text-ink2">
        {scopeLabel} · v{baseVersion || '0 (초기값)'} → v{next} · {env}
      </p>
      {diff ? (
        <section className="mt-3 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold">변경 요약</h3>
            {production && diffAt ? <span className="text-[12px] tabular-nums text-ink2">{formatClockSec(diffAt)} 만듦</span> : null}
          </div>
          <SummaryChips s={summaryOf(diff)} />
          <DiffList changes={diff.changes} ja={ja} namer={namer} max={4} />
          {production ? (
            <p className="mt-1.5 text-[12px] text-ink2 break-keep">
              요약 해시 <span className="font-mono text-ink">{shortHash(diff.summaryHash)}</span> — 적용할 때 서버가 같은 초안으로 다시 계산해 맞는지 봐요.
            </p>
          ) : null}
        </section>
      ) : null}
      {production ? (
        <section className="mt-3.5 min-w-0">
          <h3 className="mb-1.5 text-[15px] font-semibold">기능 테스트</h3>
          <TestLine test={test} required={diff?.testRequired ?? true} />
        </section>
      ) : null}
      {baseVersion === 0 ? (
        <p className="mt-3 rounded-xl bg-surface2 px-3 py-2.5 text-[13px] break-keep">
          처음 적용이에요 — 지금 값을 <b>기준선 v1</b> 로 먼저 남기고 이번 변경은 <b>v2</b> 가 돼요. 기준선으로 언제든 되돌릴 수 있어요.
        </p>
      ) : null}
      <ReasonFields
        reason={reason}
        onReason={onReason}
        reasonError={reasonError}
        production={production}
        needsConfirm={needsConfirm}
        confirm={confirm}
        onConfirm={onConfirm}
        confirmError={confirmError}
      />
      {notice ? <SheetNotice notice={notice} onAction={onNoticeAction} /> : null}
      <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        {hideGo ? null : (
          <button type="button" aria-busy={applying || undefined} disabled={applying} onClick={onSubmit} className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent disabled:opacity-60">
            {applying ? '적용하는 중…' : production ? 'PRODUCTION 에 적용' : '적용'}
          </button>
        )}
        <button type="button" disabled={applying} onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-60">
          취소
        </button>
      </div>
    </Sheet>
  )
}

/** 초안 버리기·대상 옮기기 확인(데모 v2 discard·switch 시트). */
export function ConfirmDropSheet({ open, title, text, go, onGo, onClose }: { open: boolean; title: string; text: React.ReactNode; go: string; onGo: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <p className="text-[14px] break-keep">{text}</p>
      <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <button type="button" onClick={onGo} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-bad">
          {go}
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink">
          계속 편집
        </button>
      </div>
    </Sheet>
  )
}
