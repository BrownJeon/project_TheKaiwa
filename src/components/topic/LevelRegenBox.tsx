'use client'

/**
 * D4-A 수준 바꿈 상자(screens.md §16-2 S7) — 수준 칸 바로 아래 `role=status`. 묻기([표현 다시 받기][지금 표현 두기]) · 받는 중(스피너·[그만두기]) · 실패 세 겹을
 * 한 격자 칸에 겹쳐 그리고 보이는 겹만 바꾼다 — 상자 높이가 상태마다 같아 아래 칸이 움직이지 않는다(R6). 숨은 겹은 `invisible` 이라 초점·읽기에서 빠진다.
 * 초점은 화면이 옮긴다(누른 버튼이 숨으면 같은 상자 안의 다음 버튼으로 — 스크롤 호출 없음).
 */
import { Btn } from '@/components/common/ui'
import { Spinner } from '@/components/plan/parts'
import type { Failure } from './failure'
import { levelRegenFailLines } from './logic'
import { CREATE, EDIT } from './topicCopy'

export const LVL_REGEN_DOM_ID = 'tp-lvl-regen'
export const LVL_CANCEL_DOM_ID = 'tp-lvl-cancel'
export const LVL_RETRY_DOM_ID = 'tp-lvl-retry'

type Layer = 'ask' | 'busy' | 'fail'

export default function LevelRegenBox({
  from,
  to,
  busy,
  cancelable,
  long,
  failure,
  onRegen,
  onKeep,
  onCancel,
}: {
  from: string
  to: string
  busy: boolean
  cancelable: boolean
  long: boolean
  failure: Failure | null
  onRegen: () => void
  onKeep: () => void
  onCancel: () => void
}) {
  const layer: Layer = busy ? 'busy' : failure ? 'fail' : 'ask'
  const fail = failure ? levelRegenFailLines(failure) : null
  const show = (l: Layer) => (layer === l ? '' : 'invisible')
  return (
    <div role="status" className="grid min-w-0 rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink [&>*]:col-start-1 [&>*]:row-start-1">
      <div className={`flex min-w-0 flex-col ${show('ask')}`}>
        <p className="break-keep">{EDIT.lvlChanged(from, to)}</p>
        <p className="mt-1 text-[12.5px] text-ink2 break-keep">{EDIT.lvlNote}</p>
        <div className="mt-2.5 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn id={LVL_REGEN_DOM_ID} size="sm" className="min-h-11" onClick={() => layer === 'ask' && onRegen()}>
            {EDIT.lvlRegen}
          </Btn>
          <Btn size="sm" variant="ghost" className="min-h-11" onClick={() => layer === 'ask' && onKeep()}>
            {EDIT.lvlKeep}
          </Btn>
        </div>
      </div>

      <div className={`flex min-w-0 flex-col ${show('busy')}`}>
        <p className="flex items-center gap-2 font-semibold break-keep">
          <Spinner />
          {EDIT.lvlGen}
        </p>
        <p className={`mt-1 text-[12.5px] text-ink2 break-keep ${long ? '' : 'invisible'}`}>{CREATE.genLong}</p>
        <Btn id={LVL_CANCEL_DOM_ID} size="sm" variant="ghost" className="mt-2.5 min-h-11 w-full" aria-disabled={!cancelable || undefined} onClick={() => layer === 'busy' && onCancel()}>
          {CREATE.cancel}
        </Btn>
      </div>

      <div className={`flex min-w-0 flex-col ${show('fail')}`}>
        <p className="font-semibold text-bad break-keep">{fail?.text ?? EDIT.lvlFail}</p>
        {fail?.detail ? <p className="mt-1 text-[12.5px] text-ink break-keep">{fail.detail}</p> : null}
        <div className="mt-2.5 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn
            id={LVL_RETRY_DOM_ID}
            size="sm"
            className={fail?.block ? 'min-h-11 opacity-40' : 'min-h-11'}
            aria-disabled={fail?.block || undefined}
            onClick={() => layer === 'fail' && !fail?.block && onRegen()}
          >
            {EDIT.lvlRegen}
          </Btn>
          <Btn size="sm" variant="ghost" className="min-h-11" onClick={() => layer === 'fail' && onKeep()}>
            {EDIT.lvlKeep}
          </Btn>
        </div>
      </div>
    </div>
  )
}
