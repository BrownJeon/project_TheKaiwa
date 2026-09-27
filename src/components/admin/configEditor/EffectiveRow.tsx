'use client'

/**
 * Effective 키 한 줄(screens.md §6-2 I). DEVELOPER 이상은 서버가 `layers`·`sourceRef` 를 줄 때만 펼침이 생긴다(ADMIN 은 펼침 자체가 없다).
 * 시크릿 키: 값 칸에 ref 이름만 — `exists` 는 그리지 않는다(존재 여부는 `secrets.read_ref` + 감사 경로로만).
 */
import type { EffectiveKeyDto } from '@/types/admin'
import { displayValue, refName } from '../console/format'
import { editabilityText } from '../console/labels'
import SourceBadge from './SourceBadge'

export function isExpandable(row: EffectiveKeyDto): boolean {
  return Array.isArray(row.layers) && row.layers.length > 0
}

/** 서버가 준 `shadowed` 가 우선, 없으면 layers 에 마지막과 다른 값이 있는지. */
export function isShadowed(row: EffectiveKeyDto): boolean {
  if (typeof row.shadowed === 'boolean') return row.shadowed
  const layers = row.layers ?? []
  if (layers.length < 2) return false
  const last = JSON.stringify(layers[layers.length - 1].value)
  return layers.slice(0, -1).some((l) => JSON.stringify(l.value) !== last)
}

export default function EffectiveRow({ row, expanded, onToggle }: { row: EffectiveKeyDto; expanded: boolean; onToggle: () => void }) {
  const expandable = isExpandable(row)
  const shadowed = isShadowed(row)
  const value = row.secret ? refName(row.value) : displayValue(row.key, row.value)
  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 font-mono text-[13px] text-ink2 [overflow-wrap:anywhere]">{row.key}</span>
        {row.secret ? (
          <span role="img" aria-label="시크릿 참조" className="flex-none">
            🔒
          </span>
        ) : null}
        {shadowed ? <span className="flex-none text-[12px] text-ink">⚠ 가려진 값</span> : null}
      </span>
      <span className="block font-mono text-[15px] text-ink [overflow-wrap:anywhere]">{value}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <SourceBadge source={row.source} />
        <span className="text-[12px] text-ink2">{editabilityText(row.editability, row.restartRequired)}</span>
        {row.source === 'ENVIRONMENT' ? <span className="text-[12px] text-ink2">env 가 덮고 있어요</span> : null}
        {expandable ? (
          <span aria-hidden="true" className="ml-auto text-ink2">
            {expanded ? '˄' : '˅'}
          </span>
        ) : null}
      </span>
      {row.sourceRef && !expandable ? <span className="block font-mono text-[11.5px] text-ink2 [overflow-wrap:anywhere]">{displayValue('sourceRef', row.sourceRef)}</span> : null}
    </>
  )
  const cls = 'flex min-h-[56px] w-full min-w-0 flex-col gap-1 px-3.5 py-2.5 text-left'
  const layers = row.layers ?? []
  return (
    <li>
      {expandable ? (
        <button type="button" aria-expanded={expanded} onClick={onToggle} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {expandable && expanded ? (
        <ol className="mx-3.5 mb-3 border-l-2 border-line pl-3">
          {layers.map((layer, i) => (
            <li key={`${layer.source}-${i}`} className="py-1 text-[12px]">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <SourceBadge source={layer.source} />
                <span className="min-w-0 font-mono text-ink [overflow-wrap:anywhere]">{row.secret ? refName(layer.value) : displayValue(row.key, layer.value)}</span>
                {i === layers.length - 1 ? <span className="text-ink2">← 사용 중</span> : null}
              </span>
              {layer.sourceRef ? (
                <span className="block font-mono text-[11.5px] text-ink2 [overflow-wrap:anywhere]">{displayValue('sourceRef', layer.sourceRef)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  )
}
