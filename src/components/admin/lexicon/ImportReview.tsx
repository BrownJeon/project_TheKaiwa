/**
 * 가져오기 미리 보기 결과(screens.md §10-2 G): 개수 칩 5개(0 도 보인다) · 범위별 끄기 수(REPLACE_SCOPE) · 끄기 경고 · 행별 오류표 · 바뀌는 항목.
 * 행 번호는 서버 값 그대로(파일 기준).
 */
import type { LexiconImportErrorDto, LexiconImportMode, LexiconImportResultDto } from '@/types/lexicon'
import { CountChip } from './Badges'
import { importErrorText } from './lexiconCopy'
import LexiconDiffList, { shortRef } from './LexiconDiffList'

export function ImportErrorTable({ errors, total, truncated }: { errors: readonly LexiconImportErrorDto[]; total: number; truncated: number }) {
  return (
    <div className="@container mt-2 min-w-0">
      <p className="text-[13px] font-semibold text-bad">
        오류 {total}행{truncated > 0 ? ` (앞 ${errors.length}개만 보여요)` : ''}
      </p>
      <table className="mt-1 hidden w-full table-fixed text-[13px] @min-[560px]:table">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '24%' }} />
          <col />
        </colgroup>
        <thead>
          <tr className="text-left text-[12px] text-ink2">
            <th scope="col" className="py-1 font-medium">
              행
            </th>
            <th scope="col" className="py-1 font-medium">
              칸
            </th>
            <th scope="col" className="py-1 font-medium">
              사유
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={`${e.row}-${e.field ?? ''}-${i}`} className="align-top [&>td]:border-t [&>td]:border-line [&>td]:py-1.5">
              <td className="tabular-nums">{e.row}</td>
              <td className="font-mono text-ink2 [overflow-wrap:anywhere]">{e.field ?? '—'}</td>
              <td className="break-keep">{importErrorText(e.field, e.code)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-surface @min-[560px]:hidden">
        {errors.map((e, i) => (
          <li key={`${e.row}-${e.field ?? ''}-${i}`} className="px-3 py-2 text-[13px] break-keep">
            <span className="font-semibold tabular-nums">{e.row}행</span>
            {e.field ? <span className="font-mono text-ink2"> · {e.field}</span> : null} — {importErrorText(e.field, e.code)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ImportReview({ result, mode }: { result: LexiconImportResultDto; mode: LexiconImportMode }) {
  const c = result.counts
  const changeCount = c.add + c.update + c.disable
  const scopes = (result.scopes ?? []).filter((s) => s.disable > 0 || mode === 'REPLACE_SCOPE')
  return (
    <>
      <div aria-live="polite" className="mt-3 rounded-xl border border-line bg-surface2 p-3">
        <p className="text-[14px] font-semibold">
          {result.rows}행 확인 · 지금 사전 v{result.baseVersion} 기준
        </p>
        <ul aria-label="변경 개수" className="mt-1.5 flex flex-wrap gap-1.5">
          <CountChip label="추가" n={c.add} />
          <CountChip label="수정" n={c.update} />
          <CountChip label="끄기" n={c.disable} tone={c.disable > 0 ? 'warn' : 'plain'} />
          <CountChip label="그대로" n={c.unchanged} />
          <CountChip label="오류" n={c.error} tone={c.error > 0 ? 'error' : 'plain'} />
        </ul>
        {mode === 'REPLACE_SCOPE' && scopes.length > 0 ? (
          <p className="mt-1.5 text-[13px] break-keep [overflow-wrap:anywhere]">
            바뀌는 범위: {scopes.map((s) => `${s.scope}${s.scopeRefId ? ` ${shortRef(s.scopeRefId)}` : ''}(끄기 ${s.disable})`).join(' · ')}
          </p>
        ) : null}
      </div>
      {c.disable > 0 ? (
        <p role="alert" className="mt-2 rounded-xl border border-bad bg-surface px-3 py-2 text-[13px] font-semibold text-bad break-keep">
          ⚠ 적용하면 {c.disable}개 항목이 꺼져요.
        </p>
      ) : null}
      {result.errors.length > 0 ? <ImportErrorTable errors={result.errors} total={c.error} truncated={result.errorsTruncated ?? 0} /> : null}
      {result.changes.length > 0 ? (
        <details className="mt-2">
          <summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">바뀌는 항목 보기 ({changeCount})</summary>
          <LexiconDiffList rows={result.changes} truncated={result.changesTruncated ?? 0} />
        </details>
      ) : null}
    </>
  )
}
