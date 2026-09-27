/**
 * 키·값 목록(screens.md §6-2 C). 카드 폭 <420px 이면 위아래, ≥420 이면 두 칸(컨테이너 쿼리).
 * 값은 `displayValue` 를 거친다 — 서버 경로·시크릿 의심 값은 화면에서도 가린다(방어선). `node` 를 주면 그대로 그린다(링크·버튼 자리).
 */
import { displayValue, isEmptyValue } from './format'

export interface KvItem {
  key: string
  label?: string
  value?: unknown
  /** 값 대신 그릴 노드(이미 안전한 값으로 만든 것만). */
  node?: React.ReactNode
  mono?: boolean
  /** 스키마 타입(`PATH` 면 경로 규칙). */
  type?: string
}

export default function KeyValueList({ items, className = '', mono = false }: { items: KvItem[]; className?: string; mono?: boolean }) {
  if (items.length === 0) return <p className={`text-[13px] text-ink2 ${className}`}>항목이 없어요.</p>
  return (
    <dl className={`@container grid min-w-0 gap-y-2 ${className}`}>
      {items.map((it) => {
        const m = it.mono ?? mono
        const empty = it.node === undefined && isEmptyValue(it.value)
        return (
          <div key={it.key} className="grid min-w-0 gap-0.5 @min-[420px]:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] @min-[420px]:gap-3">
            <dt className={`min-w-0 text-[12.5px] text-ink2 [overflow-wrap:anywhere] ${m && !it.label ? 'font-mono' : ''}`}>{it.label ?? it.key}</dt>
            <dd className={`min-w-0 [overflow-wrap:anywhere] ${m ? 'font-mono text-[13px]' : 'text-[14px]'} ${empty ? 'text-ink2' : 'text-ink'}`}>
              {it.node !== undefined ? it.node : displayValue(it.key, it.value, it.type)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
