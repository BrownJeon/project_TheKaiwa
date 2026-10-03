'use client'

/**
 * 변경 요약(#106, 데모 v2 Diff 탭·적용 시트): 요약 칩(바뀜·엄격·효력 없음·비밀 참조) + 키마다 전 → 후, 양쪽 출처 뱃지, editability, 엄격, 실행 검증.
 * 종류는 색이 아니라 글자 뱃지(바뀜·추가). env 가 이기는 키는 "효력 없음"(저장은 되지만 실제 값은 그대로). 값은 서버가 가린 그대로(비밀은 참조 이름만).
 */
import type { ConfigDiffChangeDto, ConfigDiffDto } from '@/types/admin'
import { displayValue, refName } from '../console/format'
import { editabilityText } from '../console/labels'
import SourceBadge from './SourceBadge'
import { VERIFIABLE_KO } from './configCopy'
import { NeutralTag, StrictBadge } from './ui'

export type ValueNamer = (key: string, v: unknown) => string | null

/** 값 한 개 → 글자(비밀 참조는 이름만, 서버 경로·가림 값은 console/format 규칙). */
export function valueText(key: string, v: unknown, namer?: ValueNamer): string {
  const named = namer?.(key, v)
  if (named !== null && named !== undefined) return named
  if (/credentialRef$/.test(key)) return v === null || v === undefined ? '(없음)' : refName(v)
  if (v === null) return '(없음)'
  return displayValue(key, v)
}

export function ValueSpan({ k, v, ja, namer, strike = false }: { k: string; v: unknown; ja?: boolean; namer?: ValueNamer; strike?: boolean }) {
  const text = valueText(k, v, namer)
  return (
    <span lang={ja ? 'ja' : undefined} className={`${ja ? '' : 'font-mono text-[14px]'} ${strike ? 'text-ink2 line-through decoration-1' : 'text-ink'} [overflow-wrap:anywhere]`}>
      {text}
    </span>
  )
}

export interface DiffSummaryCounts {
  changed: number
  strict: number
  blocked: number
  secretTouched: boolean
}

export function summaryOf(d: Pick<ConfigDiffDto, 'summary'>): DiffSummaryCounts {
  return { changed: d.summary.changed, strict: d.summary.strict, blocked: d.summary.shadowed, secretTouched: d.summary.secretTouched }
}

export function SummaryChips({ s, testRequired }: { s: DiffSummaryCounts; testRequired?: boolean | null }) {
  const chip = 'inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium'
  return (
    <ul aria-label="변경 요약 수" className="mt-2 flex flex-wrap gap-1.5">
      <li className={`${chip} bg-surface2 text-ink`}>
        바뀜 <b className="tabular-nums">{s.changed}</b>
      </li>
      <li className={`${chip} ${s.strict ? 'border border-bad bg-surface text-bad' : 'bg-surface2 text-ink'}`}>
        엄격 <b className="tabular-nums">{s.strict}</b>
      </li>
      {s.blocked ? (
        <li className={`${chip} border border-bad bg-surface text-bad`}>
          효력 없음 <b className="tabular-nums">{s.blocked}</b>
        </li>
      ) : null}
      <li className={`${chip} bg-surface2 text-ink`}>비밀 참조 {s.secretTouched ? '바뀜' : '그대로'}</li>
      {testRequired !== undefined && testRequired !== null ? <li className={`${chip} bg-surface2 text-ink`}>기능 테스트 {testRequired ? '필요' : '불요'}</li> : null}
    </ul>
  )
}

export function DiffRow({ c, ja, namer }: { c: ConfigDiffChangeDto; ja?: boolean; namer?: ValueNamer }) {
  const blocked = c.blocked
  return (
    <li className="min-w-0 px-3 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <NeutralTag>{c.changeType === 'ADDED' ? '추가' : '바뀜'}</NeutralTag>
        <span className="min-w-0 flex-1 font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{c.key}</span>
        {c.strict ? <StrictBadge /> : null}
      </div>
      <div className="mt-1 text-[15px] [overflow-wrap:anywhere]">
        {c.changeType === 'ADDED' && (c.storedBefore === undefined || c.storedBefore === null) && (c.before === null || c.before === undefined) ? null : (
          <>
            <ValueSpan k={c.key} v={c.before} ja={ja} namer={namer} strike />
            <span aria-hidden="true" className="px-1 text-ink2">
              →
            </span>
            <span className="sr-only">에서 다음으로</span>
          </>
        )}
        <ValueSpan k={c.key} v={c.after} ja={ja} namer={namer} />
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-ink2">
        <SourceBadge source={c.beforeSource} />
        <span aria-hidden="true">→</span>
        <SourceBadge source={c.afterSource} />
        <span>{editabilityText(c.editability)}</span>
        <span>{VERIFIABLE_KO[c.verifiable]}</span>
      </div>
      {blocked ? (
        blocked.code === 'SHADOWED_BY_ENVIRONMENT' ? (
          <p className="mt-1.5 rounded-lg bg-warn-soft px-2 py-1.5 text-[12.5px] text-ink break-keep">
            <b>효력 없음</b> — 환경 변수가 이겨요. 저장은 되지만 실제 값은 그대로예요.
          </p>
        ) : (
          <p className="mt-1.5 rounded-lg border border-bad bg-surface px-2 py-1.5 text-[12.5px] text-bad break-keep">
            <b>적용할 수 없는 키</b> — {blocked.message}
          </p>
        )
      ) : null}
    </li>
  )
}

export function DiffList({ changes, ja, namer, max }: { changes: readonly ConfigDiffChangeDto[]; ja?: boolean; namer?: ValueNamer; max?: number }) {
  const shown = max ? changes.slice(0, max) : changes
  return (
    <>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
        {shown.map((c) => (
          <DiffRow key={c.key} c={c} ja={ja} namer={namer} />
        ))}
      </ul>
      {max && changes.length > max ? <p className="mt-1 text-[12px] text-ink2">외 {changes.length - max}개</p> : null}
    </>
  )
}

/** 서버 요약을 만들기 전 초안 미리 보기(전 → 후만). */
export function DraftPreviewList({ rows, ja, namer }: { rows: { key: string; before: unknown; after: unknown; strict: boolean; label?: string }[]; ja?: boolean; namer?: ValueNamer }) {
  return (
    <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.key} className="min-w-0 px-3 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <NeutralTag>바뀜</NeutralTag>
            <span className="min-w-0 flex-1 font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{r.key}</span>
            {r.strict ? <StrictBadge /> : null}
          </div>
          <div className="mt-1 text-[15px] [overflow-wrap:anywhere]">
            <ValueSpan k={r.key} v={r.before} ja={ja} namer={namer} strike />
            <span aria-hidden="true" className="px-1 text-ink2">
              →
            </span>
            <span className="sr-only">에서 다음으로</span>
            <ValueSpan k={r.key} v={r.after} ja={ja} namer={namer} />
          </div>
        </li>
      ))}
    </ul>
  )
}
