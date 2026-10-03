'use client'

/**
 * 시크릿 참조 시트(#101, screens.md §6-2 H). **시트를 열 때만** 조회한다 — 조회마다 서버가 감사 로그 1행을 남기므로
 * 페이지 진입만으로는 부르지 않는다. 값은 없다: ref 이름·있는지·사용 연결·마지막 사용만.
 */
import Sheet from '@/components/common/Sheet'
import { Badge } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { SecretRefDto } from '@/types/admin'
import { ConsoleLoading, EmptyNote, LoadError } from './ConsoleStates'
import { formatAgo, refName } from './format'
import { useAdminResource } from './useAdminResource'

export default function SecretsSheet({ open, highlightRef, onClose }: { open: boolean; highlightRef?: string | null; onClose: () => void }) {
  // 열릴 때마다 path 가 null → 주소로 바뀌어 한 번 읽는다(열 때마다 감사 1행).
  const res = useAdminResource<SecretRefDto[]>(open ? '/api/admin/v1/secrets' : null)
  const now = useNow(open, 30_000)
  // 연결에 걸린 참조만(#101 은 허용됐지만 아무도 안 쓰는 참조도 싣는다 — 그 목록은 [비밀 참조 연결] 시트가 보여 준다, task-012c).
  const rows = (res.data ?? []).filter((s) => s.usedBy.length > 0)
  return (
    <Sheet open={open} title="시크릿 참조" onClose={onClose}>
      <p className="text-[13px] text-ink2 break-keep">값은 보이지 않아요. 참조 이름·있는지·마지막 사용만 보여 줘요. 열 때마다 조회 기록(감사 로그)이 남아요.</p>
      {res.status === 'loading' ? <ConsoleLoading /> : null}
      {res.status === 'error' && res.err ? <LoadError err={res.err} name="시크릿 참조" onRetry={res.reload} /> : null}
      {res.status === 'ready' && rows.length === 0 ? (
        <div className="mt-3">
          <EmptyNote>연결에 걸린 시크릿 참조가 없어요.</EmptyNote>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((s) => {
            const on = highlightRef && s.ref === highlightRef
            const used = s.usedBy.map((u) => u.key || u.id).join(', ')
            return (
              <li key={s.ref} className={`min-w-0 py-2.5 ${on ? 'rounded-xl bg-accent-soft px-2' : ''}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere]">{refName(s.ref)}</span>
                  {s.exists ? <Badge tone="good">있음</Badge> : <Badge tone="bad">없음</Badge>}
                </div>
                <p className="mt-0.5 text-[12px] text-ink2 [overflow-wrap:anywhere]">
                  {s.source === 'file' ? '파일' : '환경 변수'} · 사용 연결 <span className="font-mono">{used || '없음'}</span> ·{' '}
                  {s.lastUsedAt ? `마지막 사용 ${formatAgo(s.lastUsedAt, now)}` : '사용 기록 없음'}
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Sheet>
  )
}
