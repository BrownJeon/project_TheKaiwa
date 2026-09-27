/**
 * diff 행 목록(버전 상세·되돌리기 확인·가져오기 미리 보기 공용, screens.md §10-2 I). 종류는 글자 뱃지로(색·기호만 쓰지 않는다).
 * 수정 행은 바뀐 칸만 보인다. 가나 조각은 `lang="ja"`.
 */
import type { LexiconDiffCountsDto, LexiconDiffRowDto, LexiconSnapshotRowDto } from '@/types/lexicon'
import { NeutralBadge } from '../console/Badges'
import { EmptyNote } from '../console/ConsoleStates'
import { CountChip } from './Badges'
import { DIFF_KO, WORD_TYPE_KO } from './lexiconCopy'

/** 대상 id 줄임(모노): 앞 8자 + "…". */
export function shortRef(id: string): string {
  return id.length > 9 ? `${id.slice(0, 8)}…` : id
}

const ja = (s: string) => (
  <span lang="ja" className="text-ink">
    {s}
  </span>
)

function wordTypeText(v: LexiconSnapshotRowDto['wordType']): string {
  return v ? WORD_TYPE_KO[v] ?? v : '없음'
}

function changedParts(b: LexiconSnapshotRowDto, a: LexiconSnapshotRowDto): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  if (b.reading !== a.reading)
    parts.push(
      <span key="r">
        읽기 {ja(b.reading)} → {ja(a.reading)}
      </span>,
    )
  if (b.accentType !== a.accentType) parts.push(<span key="a">악센트 {b.accentType} → {a.accentType}</span>)
  if (b.priority !== a.priority) parts.push(<span key="p">우선 {b.priority} → {a.priority}</span>)
  if ((b.wordType ?? null) !== (a.wordType ?? null)) parts.push(<span key="w">종류 {wordTypeText(b.wordType)} → {wordTypeText(a.wordType)}</span>)
  if ((b.note ?? null) !== (a.note ?? null) && !(b.note === undefined || a.note === undefined)) parts.push(<span key="n">메모 바뀜</span>)
  if (b.enabled !== a.enabled) parts.push(<span key="e">{a.enabled ? '다시 켬' : '끔'}</span>)
  return parts
}

function detail(row: LexiconDiffRowDto): React.ReactNode {
  const { kind, before, after } = row
  if (kind === 'ADDED' && after)
    return (
      <>
        {ja(after.reading)} · 악센트 {after.accentType} · 우선 {after.priority}
      </>
    )
  if (kind === 'DISABLED' && before) return <>{ja(before.reading)} · 이제 쓰지 않아요</>
  if (kind === 'ENABLED' && after) return <>{ja(after.reading)} · 다시 써요</>
  if (kind === 'CHANGED' && before && after) {
    const parts = changedParts(before, after)
    if (parts.length === 0) return '바뀐 칸 없음'
    return parts.map((p, i) => (
      <span key={i}>
        {i > 0 ? ' · ' : ''}
        {p}
      </span>
    ))
  }
  return null
}

export default function LexiconDiffList({ rows, truncated }: { rows: readonly LexiconDiffRowDto[]; truncated: number }) {
  if (rows.length === 0 && truncated === 0) return <div className="mt-2"><EmptyNote>바뀐 항목이 없어요.</EmptyNote></div>
  return (
    <>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((r, i) => (
          <li key={`${r.scope}|${r.scopeRefId ?? ''}|${r.surface}|${i}`} className="min-w-0 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <NeutralBadge>{DIFF_KO[r.kind] ?? r.kind}</NeutralBadge>
              <span lang="ja" className="min-w-0 flex-1 text-[16px] font-semibold [overflow-wrap:anywhere]">
                {r.surface}
              </span>
              <span className="flex-none font-mono text-[12px] text-ink2">
                {r.scope}
                {r.scopeRefId ? ` ${shortRef(r.scopeRefId)}` : ''}
              </span>
            </span>
            <span className="mt-0.5 block min-w-0 text-[13px] text-ink2 [overflow-wrap:anywhere]">
              {typeof r.row === 'number' ? <span className="tabular-nums">{r.row}행 · </span> : null}
              {detail(r)}
            </span>
          </li>
        ))}
      </ul>
      {truncated > 0 ? <p className="mt-1 text-[12px] text-ink2">외 {truncated}개</p> : null}
    </>
  )
}

export function DiffCounts({ counts }: { counts: LexiconDiffCountsDto }) {
  return (
    <ul aria-label="바뀌는 항목 수" className="mt-2 flex flex-wrap gap-1.5">
      <CountChip label="추가" n={counts.added} tone="muted" />
      <CountChip label="수정" n={counts.changed} tone="muted" />
      <CountChip label="끔" n={counts.disabled} tone={counts.disabled > 0 ? 'warn' : 'muted'} />
      <CountChip label="다시 켬" n={counts.enabled} tone="muted" />
    </ul>
  )
}
