'use client'

/**
 * 공유 편집기 첫마디(D5=A — screens.md §16-2 `OpeningField`, 데모 v2 S11 `op*`). 한국어가 주 입력, 일본어는 선생님이 만든 제안(읽기 상자).
 * 상태는 `logic.openingState`(none·koOnly·stale·matched) + 요청(만드는 중·실패) — 한국어를 고치면 일본어가 「오래됨」이 되어 맞출 때까지 저장을 막는다.
 * 비동기 결과는 이 칸 안만 바꾸고(`aria-live`) 초점은 누른 버튼에 그대로 둔다 — 버튼은 상태가 바뀌어도 같은 요소 하나(R6).
 * 일본어 아래 확인 문구는 늘 보인다: #178 은 학습자 자기 말도 첫마디로 옮길 수 있고 코드가 막지 못한다(QA b1 #1, L-6).
 * 읽기는 받은 직후에만 보인다(저장하지 않는다). 버튼 id `dr-opening` 은 저장 검사의 첫 문제 초점 자리(`logic.problemDomId('opening')`).
 */
import { Btn } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { Spinner } from '@/components/plan/parts'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { SOUND_MSG, soundText } from '@/components/vocab/wordSound'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import { applyOpeningDraft, EMPTY_OPENING, oneLine, openingBlock, openingState, type EditableDraft } from './logic'
import { OPENING } from './scenarioCopy'
import { useKeyedSound } from './useKeyedSound'
import { useOpeningDraft } from './useOpeningDraft'

const SOUND_KEY = 'opening'

export default function OpeningField({
  draft,
  setDraft,
  errors,
  placeTitle,
  disabled = false,
}: {
  draft: EditableDraft
  setDraft: (fn: (d: EditableDraft) => EditableDraft) => void
  errors: Record<string, string>
  placeTitle: string | null
  disabled?: boolean
}) {
  const gen = useOpeningDraft()
  const sound = useKeyedSound()
  const tts = useTtsRuntimeStatus()
  const o = draft.opening ?? EMPTY_OPENING
  const st = openingState(draft.opening)
  const busy = gen.phase === 'busy'
  const failure = gen.phase === 'failed' ? gen.failure : null
  const block = openingBlock(draft)
  const koLen = cpLength(oneLine(o.ko))
  const errKo = errors.openingKo
  const errOp = errors.opening
  const playText = st === 'matched' && o.ja ? soundText(o.ja) : null
  const canPlay = !!playText && !busy && tts.snapshot.state !== 'TEXT_ONLY'
  const view = sound.view(SOUND_KEY)
  const line = sound.line(SOUND_KEY)

  const setKo = (ko: string) => {
    gen.clear()
    setDraft((d) => ({ ...d, opening: { ...(d.opening ?? EMPTY_OPENING), ko } }))
  }

  const off = disabled || (!busy && (!!block || !!failure?.block))
  const onMain = () => {
    if (disabled) return
    if (busy) return gen.cancel()
    if (off) return
    sound.stop()
    gen.make(draft, placeTitle, (sentKo, r) => setDraft((d) => ({ ...d, opening: applyOpeningDraft(d.opening, sentKo, r) })))
  }

  const label = busy ? OPENING.cancel : failure ? OPENING.retry : st === 'matched' || st === 'stale' ? OPENING.remake : OPENING.make
  const ghost = busy || (!failure && st === 'matched')
  const reasonId = block === 'noKo' ? 'dr-openingKo-hint' : block === 'noRoles' ? 'dr-opening-roles' : block === 'tooLong' ? 'dr-openingKo-count' : undefined
  const describedBy = errOp ? 'dr-opening-err' : !busy && off ? reasonId : undefined

  return (
    <fieldset className={`min-w-0 rounded-[14px] bg-surface p-3 ${errOp ? 'border-[1.5px] border-bad' : 'border border-line'}`} disabled={disabled}>
      <legend className="float-left mb-2.5 w-full p-0 text-[12.5px] font-medium text-ink2">{OPENING.legend}</legend>
      <div className="clear-both flex min-w-0 flex-col gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="dr-openingKo" className="text-[12px] text-ink2">
            {OPENING.koLabel}
          </label>
          <textarea
            id="dr-openingKo"
            rows={2}
            value={o.ko}
            readOnly={busy}
            aria-invalid={errKo ? true : undefined}
            aria-describedby={`dr-openingKo-count dr-openingKo-hint${errKo ? ' dr-openingKo-err' : ''}`}
            onChange={(e) => setKo(e.target.value)}
            className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink ${errKo ? 'border-bad' : 'border-line'}`}
          />
          <p id="dr-openingKo-count" className={`text-right text-[12px] tabular-nums ${koLen > L.openingKoMax ? 'text-bad' : 'text-ink2'}`}>
            {koLen}/{L.openingKoMax}
          </p>
          {errKo ? (
            <p id="dr-openingKo-err" className="text-[12px] text-bad break-keep">
              {errKo}
            </p>
          ) : null}
          <p id="dr-openingKo-hint" className="text-[12px] text-ink2 break-keep">
            {OPENING.koHint(draft.tutor)}
          </p>
        </div>

        <div aria-live="polite" className="flex min-h-[92px] min-w-0 flex-col justify-center gap-0.5 rounded-xl bg-surface2 px-3 py-2.5">
          <ReadBox st={st} o={o} busy={busy} failure={failure} truncated={gen.truncated} tutor={draft.tutor} level={draft.level} />
        </div>
        {errOp ? (
          <p id="dr-opening-err" className="text-[12px] text-bad break-keep">
            {errOp}
          </p>
        ) : null}
        {block === 'noRoles' && !busy ? (
          <p id="dr-opening-roles" className="text-[12px] text-ink2 break-keep">
            {OPENING.needRoles}
          </p>
        ) : null}

        <div className="flex min-w-0 items-center gap-2">
          <Btn
            id="dr-opening"
            variant={ghost ? 'ghost' : 'primary'}
            className={`min-w-0 flex-1 ${off && !busy ? 'opacity-40' : ''}`}
            aria-disabled={(off && !busy) || undefined}
            aria-busy={busy || undefined}
            aria-describedby={describedBy}
            onClick={onMain}
          >
            {label}
          </Btn>
          <button
            type="button"
            aria-label={view.phase === 'playing' ? OPENING.stopPlay : OPENING.play}
            aria-disabled={!canPlay || undefined}
            aria-busy={view.busy || undefined}
            onClick={() => canPlay && playText && sound.tap(SOUND_KEY, playText)}
            className={`grid h-11 w-11 flex-none place-items-center rounded-full border text-[14px] ${!canPlay ? 'border-line bg-surface text-ink3' : view.look === 'on' ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink'}`}
          >
            <span aria-hidden="true">{view.phase === 'playing' ? '■' : '▶'}</span>
          </button>
        </div>
        {line.kind === 'msg' ? (
          <p role={SOUND_MSG[line.msg].role} className={`text-[12px] break-keep ${SOUND_MSG[line.msg].tone === 'bad' ? 'text-bad' : 'text-ink2'}`}>
            {SOUND_MSG[line.msg].text}
          </p>
        ) : null}
      </div>
    </fieldset>
  )
}

function ReadBox({
  st,
  o,
  busy,
  failure,
  truncated,
  tutor,
  level,
}: {
  st: ReturnType<typeof openingState>
  o: { ja: string | null; reading: string | null }
  busy: boolean
  failure: { text: string; body: string | null } | null
  truncated: boolean
  tutor: string
  level: string
}) {
  if (busy)
    return (
      <>
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <Spinner />
          {OPENING.genTitle}
        </p>
        <p className="text-[13px] text-ink2 break-keep">{OPENING.genSub(tutor, level)}</p>
      </>
    )
  if (failure)
    return (
      <>
        <Warn text={failure.text} />
        {failure.body ? <p className="text-[13px] text-ink2 break-keep">{failure.body}</p> : null}
      </>
    )
  if (st === 'none') return <p className="text-[13px] text-ink2 break-keep">{OPENING.empty}</p>
  if (st === 'koOnly')
    return (
      <>
        <p className="text-[12px] text-ink2">{OPENING.koOnlyHead}</p>
        <p className="text-[13px] text-ink2 break-keep">{OPENING.koOnly}</p>
      </>
    )
  if (st === 'stale')
    return (
      <>
        <Warn text={OPENING.stale} />
        <p className="text-[12px] text-ink2">{OPENING.staleOld}</p>
        <p lang="ja" className="text-[16px] leading-normal text-ink2 line-through [overflow-wrap:anywhere]">
          {o.ja}
        </p>
      </>
    )
  return (
    <>
      <p className="text-[12px] text-ink2">{OPENING.matchedHead}</p>
      <p lang="ja" className="text-[16px] leading-normal text-ink [overflow-wrap:anywhere]">
        {o.ja}
      </p>
      {o.reading ? (
        <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
          {o.reading}
        </p>
      ) : null}
      {truncated ? <p className="text-[13px] text-ink2 break-keep">{OPENING.truncated}</p> : null}
      <p className="mt-1 text-[13px] text-ink2 break-keep">{OPENING.confirmRole(tutor)}</p>
    </>
  )
}

function Warn({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] font-semibold text-bad break-keep">
      <span aria-hidden="true" className="flex-none">
        ⚠
      </span>
      <span className="min-w-0">{text}</span>
    </p>
  )
}
