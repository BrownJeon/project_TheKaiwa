'use client'

/**
 * 숨긴 기본 항목(screens.md §16-2 — 데모 v2 `mgr:hiddenSheet`). 줄 = 종류 뱃지 + 시드 이름 + [다시 보기](#176 `{kind, seedId}`, `ack` 없음 —
 * 숨김·고아 경로는 override 만 지운다). 줄 목록은 시트를 열 때의 값으로 고정하고(부르는 쪽이 넘긴다) 누른 줄만 「다시 보이게 했어요」로 바뀐다 —
 * 줄이 빠지거나 다시 그려지지 않아 시트 스크롤·초점이 그대로다(R1). 404 `NOT_OVERRIDDEN` 은 이미 돌아온 것으로 보고 같은 처리.
 * 목록 다시 읽기·토스트는 닫을 때 부르는 쪽이 한 번(`onClose(restoredCount)`).
 * 두 종류를 한 시트에 — 관리 화면의 「숨긴 기본 항목 n개」가 두 탭 모두 주제·상황 합계(T5-1 `hiddenSeedCount`)라 시트도 같은 범위다.
 */
import { useRef, useState } from 'react'
import { toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Badge, Btn } from '@/components/common/ui'
import type { SeedOverrideItem } from '@/types/seedOverride'
import { restoreSeed } from './api'
import { failureCopy } from './failure'
import { HIDDEN } from './topicCopy'

type RowState = { phase: 'busy' } | { phase: 'shown' } | { phase: 'fail'; text: string }

export default function HiddenSeedSheet({ items, onClose }: { items: SeedOverrideItem[] | null; onClose: (restored: number) => void }) {
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [said, setSaid] = useState('')
  /** 더블 탭 — 상태가 다시 그려지기 전 두 번째 탭도 막는다(요청 1건). */
  const inFlight = useRef(new Set<string>())
  const anyBusy = Object.values(rows).some((r) => r.phase === 'busy')
  const keyOf = (o: SeedOverrideItem) => `${o.kind}:${o.seedId}`

  const close = () => {
    if (anyBusy) return
    const restored = Object.values(rows).filter((r) => r.phase === 'shown').length
    setRows({})
    setSaid('')
    onClose(restored)
  }

  const show = async (o: SeedOverrideItem) => {
    const k = keyOf(o)
    if (inFlight.current.has(k) || rows[k]?.phase === 'shown') return
    inFlight.current.add(k)
    setRows((r) => ({ ...r, [k]: { phase: 'busy' } }))
    let next: RowState
    try {
      await restoreSeed({ kind: o.kind, seedId: o.seedId })
      next = { phase: 'shown' }
    } catch (e) {
      const f = failureCopy('hiddenRestore', toErr(e))
      next = f.kind === 'shown' ? { phase: 'shown' } : { phase: 'fail', text: f.text }
    }
    inFlight.current.delete(k)
    setRows((r) => ({ ...r, [k]: next }))
    if (next.phase === 'shown') setSaid(HIDDEN.shown)
  }

  return (
    <Sheet open={items !== null} title={HIDDEN.title} onClose={close} dismissible={!anyBusy}>
      <p className="text-[13px] text-ink2 break-keep">{HIDDEN.intro}</p>
      <p role="status" className="sr-only">
        {said}
      </p>
      {items && items.length ? (
        <ul className="mt-2 pb-2">
          {items.map((o) => {
            const k = keyOf(o)
            const st = rows[k]
            const title = o.seedTitle?.trim() ? o.seedTitle : HIDDEN.noTitle
            return (
              <li key={k} className="flex min-h-14 min-w-0 items-center gap-2.5 border-b border-line py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Badge>{o.kind === 'TOPIC' ? HIDDEN.kindTopic : HIDDEN.kindScenario}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
                  </span>
                  {st?.phase === 'fail' ? (
                    <span role="alert" className="text-[12px] text-bad break-keep">
                      {st.text}
                    </span>
                  ) : null}
                </span>
                {/* 다시 보이게 한 뒤에도 같은 버튼을 둔다(글자만 바뀜) — 누른 버튼에 초점이 그대로 남는다. */}
                <Btn
                  variant="ghost"
                  size="sm"
                  className={`flex-none ${st?.phase === 'shown' ? 'border-transparent text-good' : ''}`}
                  aria-label={st ? undefined : HIDDEN.showAria(title)}
                  aria-busy={st?.phase === 'busy' || undefined}
                  aria-disabled={st?.phase === 'busy' || st?.phase === 'shown' || undefined}
                  onClick={() => void show(o)}
                >
                  {st?.phase === 'busy' ? HIDDEN.showing : st?.phase === 'shown' ? HIDDEN.shown : HIDDEN.show}
                </Btn>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 pb-4 text-[13px] text-ink2">{HIDDEN.empty}</p>
      )}
    </Sheet>
  )
}
