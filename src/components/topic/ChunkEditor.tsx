'use client'

/**
 * 「기본 표현 n개 · 8~20개」(screens.md §16-2 S4) — 종류 4묶음, 행 = 일본어 16px·읽기 13px(늘 보임)·뜻 13px + ⋯ 메뉴 시트[고치기·위로·아래로·지우기].
 * 고치기는 시트가 아니라 행 자리에서 아래로 펼친다(보이는 이름표, [바꾸기][취소]). 위로·아래로는 같은 종류 안에서만 자리를 바꾼다.
 * 스크롤 규칙(R1·R3·R4): 메뉴·펼침은 React 상태만 바꾸고(목록 `key` 는 표현 열쇠로 고정) 스크롤을 옮기지 않는다. 메뉴를 닫으면 `Sheet` 가 ⋯ 버튼으로 초점을 돌린다.
 * 지운 뒤·펼침을 닫은 뒤에는 바로 옆 ⋯ 버튼(없으면 [＋ 표현 더하기])으로 초점을 둔다 — 화면에 보이는 가까운 요소라 위치가 움직이지 않는다.
 * S7 주제 고치기(T5-4)도 같은 편집기를 쓴다 — 행의 서버 `id` 는 고쳐도 그대로 두고(위로·아래로는 행 객체를 옮길 뿐), 새로 더한 표현만 id 가 없다.
 */
import { useEffect, useRef, useState } from 'react'
import Segmented from '@/components/common/Segmented'
import Sheet from '@/components/common/Sheet'
import { Btn, Field } from '@/components/common/ui'
import { TOPIC_CHUNK_TYPES, type TopicChunkType } from '@/types/topic'
import { TOPIC_SAVE_LIMITS } from '@/types/topicWrite'
import {
  chunkCanMove,
  chunkFieldProblems,
  chunkGroupsOf,
  chunkMove,
  chunkNeighborKey,
  chunkProblemKey,
  chunkRowDomId,
  chunkTextRetexted,
  chunkUpsert,
  nextAddedKey,
  topicProblemDomId,
  type ChunkField,
  type ChunkValues,
  type EditableChunk,
} from './logic'
import { EDIT, REVIEW } from './topicCopy'

const FIELDS: readonly ChunkField[] = ['textJa', 'reading', 'meaningKo']
const FIELD_LABEL: Record<ChunkField, string> = { textJa: REVIEW.fJa, reading: REVIEW.fReading, meaningKo: REVIEW.fMeaning }
const TYPE_OPTIONS = TOPIC_CHUNK_TYPES.map((t) => ({ value: t, label: REVIEW.type[t] }))
export const CHUNK_ADD_DOM_ID = 'tp-chunk-add'
const RETEXT_NOTE_DOM_ID = 'tp-chunk-retext-note'

type Editing = { key: string; isNew: boolean; values: ChunkValues; problems: Partial<Record<ChunkField, string>> }

export default function ChunkEditor({
  chunks,
  onChange,
  errors,
  disabled = false,
  origTexts,
}: {
  chunks: EditableChunk[]
  onChange: (fn: (chunks: EditableChunk[]) => EditableChunk[]) => void
  /** 문제 열쇠(`chunks`·`chunk:<열쇠>:<칸>`) → 문구. */
  errors: Record<string, string>
  disabled?: boolean
  /** S7 전용 — 서버 표현 id → 서버가 준 원래 일본어 글. 있으면 기존 행 고치기에서 글이 달라질 때 연습 기록 안내를 보인다(S4 는 넘기지 않는다). */
  origTexts?: ReadonlyMap<string, string>
}) {
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const [edit, setEdit] = useState<Editing | null>(null)
  // 시트가 닫히며 연 버튼으로 초점을 돌린 다음 프레임에 옮길 곳(지운 행·닫힌 펼침).
  const focusNext = useRef<string | null>(null)
  // 새 행 열쇠 번호 — 한 번 쓴 번호를 다시 쓰지 않는다(`nextAddedKey`).
  const addNo = useRef(0)
  useEffect(() => {
    const id = focusNext.current
    if (!id || menuKey !== null) return
    focusNext.current = null
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  })

  const full = chunks.length >= TOPIC_SAVE_LIMITS.chunksMax
  const menuChunk = menuKey ? (chunks.find((c) => c.key === menuKey) ?? null) : null
  const groups = chunkGroupsOf(chunks)

  const closeEdit = (focusKey: string | null) => {
    setEdit(null)
    focusNext.current = focusKey ? chunkRowDomId(focusKey) : CHUNK_ADD_DOM_ID
  }

  const apply = () => {
    if (!edit || disabled) return
    const others = chunks.filter((c) => c.key !== edit.key)
    const found = chunkFieldProblems(edit.values, others)
    const first = FIELDS.find((f) => found[f])
    if (first) {
      setEdit({ ...edit, problems: found })
      document.getElementById(topicProblemDomId(chunkProblemKey(edit.key, first)))?.focus()
      return
    }
    // S7 고치기: 행 자리에서 고친 표현은 서버가 준 `id` 를 그대로 들고 간다(글이 바뀌었는지는 서버가 보고 새 id 를 정한다). 새 표현은 id 가 없다.
    const keepId = edit.isNew ? undefined : chunks.find((c) => c.key === edit.key)?.id
    const next: EditableChunk = {
      key: edit.key,
      ...(keepId ? { id: keepId } : {}),
      ...edit.values,
      textJa: edit.values.textJa.trim(),
      reading: edit.values.reading.trim(),
      meaningKo: edit.values.meaningKo.trim(),
    }
    onChange((cs) => chunkUpsert(cs, next))
    closeEdit(edit.key)
  }

  const cancel = () => {
    if (!edit) return
    closeEdit(edit.isNew ? null : edit.key)
  }

  const add = () => {
    if (disabled || full || edit?.isNew) return
    const k = nextAddedKey(chunks, addNo.current)
    addNo.current = k.n
    setEdit({ key: k.key, isNew: true, values: { chunkType: 'NAME', textJa: '', reading: '', meaningKo: '' }, problems: {} })
  }

  const menuAction = (kind: 'edit' | 'up' | 'down' | 'remove') => {
    const c = menuChunk
    if (!c) return
    if (kind === 'up' || kind === 'down') {
      const dir = kind === 'up' ? -1 : 1
      if (!chunkCanMove(chunks, c.key, dir)) return
      onChange((cs) => chunkMove(cs, c.key, dir))
    } else if (kind === 'remove') {
      const near = chunkNeighborKey(chunks, c.key)
      onChange((cs) => cs.filter((x) => x.key !== c.key))
      if (edit?.key === c.key) setEdit(null)
      focusNext.current = near ? chunkRowDomId(near) : CHUNK_ADD_DOM_ID
    } else {
      setEdit({ key: c.key, isNew: false, values: { chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo }, problems: {} })
    }
    setMenuKey(null)
  }

  const retextedFor = (e: Editing) => {
    if (e.isNew || !origTexts) return false
    const id = chunks.find((c) => c.key === e.key)?.id
    return chunkTextRetexted(id === undefined ? undefined : origTexts.get(id), e.values.textJa)
  }

  const editorFor = (e: Editing) => (
    <ChunkFields
      e={e}
      errors={errors}
      locked={disabled}
      retexted={retextedFor(e)}
      onValues={(patch) => setEdit((cur) => (cur ? { ...cur, values: { ...cur.values, ...patch }, problems: {} } : cur))}
      onApply={apply}
      onCancel={cancel}
    />
  )

  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="tp-chunks-h">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <h2 id="tp-chunks-h" className="min-w-0 text-[15px] font-semibold">
          {REVIEW.chunksHead(chunks.length)}
        </h2>
        <span id="tp-chunks-range" className="flex-none text-[12px] tabular-nums text-ink2">
          {REVIEW.chunksRange}
        </span>
      </div>
      <p role="note" className="flex min-w-0 gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-[13px] text-ink">
        <span aria-hidden="true" className="flex-none">
          ⚠
        </span>
        <span className="min-w-0 break-keep">
          <b className="font-semibold">{REVIEW.readingWarn}</b> {REVIEW.readingWarnSub}
        </span>
      </p>
      {errors.chunks ? (
        <p id={topicProblemDomId('chunks')} tabIndex={-1} className="text-[12px] font-semibold text-bad break-keep outline-none">
          {errors.chunks}
        </p>
      ) : null}
      {groups.map((g) => (
        <div key={g.type} className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[12.5px] font-semibold text-ink2">{REVIEW.type[g.type]}</h3>
          <ul className="flex min-w-0 flex-col gap-2">
            {g.items.map((c) => (
              <ChunkRow key={c.key} c={c} errors={errors} disabled={disabled} onMenu={() => !disabled && setMenuKey(c.key)}>
                {edit && !edit.isNew && edit.key === c.key ? editorFor(edit) : null}
              </ChunkRow>
            ))}
          </ul>
        </div>
      ))}
      {edit?.isNew ? <div className="rounded-xl border border-line bg-surface p-3">{editorFor(edit)}</div> : null}
      <Btn
        id={CHUNK_ADD_DOM_ID}
        variant="ghost"
        size="sm"
        className={`min-h-11 w-full ${full ? 'opacity-40' : ''}`}
        aria-disabled={disabled || full || !!edit?.isNew || undefined}
        aria-describedby={full ? 'tp-chunks-range' : undefined}
        onClick={add}
      >
        {REVIEW.addChunk}
      </Btn>

      <Sheet open={!!menuChunk} title={menuChunk ? REVIEW.menu(menuChunk.textJa) : ''} onClose={() => setMenuKey(null)}>
        {menuChunk ? (
          <div className="flex flex-col pb-2">
            <MenuItem onClick={() => menuAction('edit')}>{REVIEW.menuEdit}</MenuItem>
            <MenuItem off={!chunkCanMove(chunks, menuChunk.key, -1)} onClick={() => menuAction('up')}>
              {REVIEW.menuUp}
            </MenuItem>
            <MenuItem off={!chunkCanMove(chunks, menuChunk.key, 1)} onClick={() => menuAction('down')}>
              {REVIEW.menuDown}
            </MenuItem>
            <MenuItem bad onClick={() => menuAction('remove')}>
              {REVIEW.menuRemove}
            </MenuItem>
          </div>
        ) : null}
      </Sheet>
    </section>
  )
}

function ChunkRow({ c, errors, disabled, onMenu, children }: { c: EditableChunk; errors: Record<string, string>; disabled: boolean; onMenu: () => void; children: React.ReactNode }) {
  const rowErrs = FIELDS.map((f) => errors[chunkProblemKey(c.key, f)]).filter((m): m is string => !!m)
  const errId = `${chunkRowDomId(c.key)}-err`
  return (
    <li className={`flex min-w-0 flex-col rounded-xl border bg-surface px-3 py-2.5 ${rowErrs.length ? 'border-bad' : 'border-line'}`}>
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <p lang="ja" className="text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {c.textJa}
          </p>
          <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
            {c.reading}
          </p>
          <p className="text-[13px] text-ink break-keep [overflow-wrap:anywhere]">{c.meaningKo}</p>
          {rowErrs.length ? (
            <ul id={errId} className="mt-1 flex flex-col gap-0.5">
              {rowErrs.map((m, i) => (
                <li key={i} className="text-[12px] text-bad break-keep">
                  {m}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          id={chunkRowDomId(c.key)}
          type="button"
          aria-label={REVIEW.menu(c.textJa)}
          aria-haspopup="dialog"
          aria-describedby={rowErrs.length ? errId : undefined}
          aria-disabled={disabled || undefined}
          onClick={onMenu}
          className="grid h-11 w-11 flex-none place-items-center rounded-full text-[18px] text-ink2"
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </div>
      {children}
    </li>
  )
}

function ChunkFields({
  e,
  errors,
  locked,
  retexted,
  onValues,
  onApply,
  onCancel,
}: {
  e: Editing
  errors: Record<string, string>
  /** 저장 중·표현 받는 중 — [바꾸기]를 막는다(입력은 이 편집기 안 값이라 막지 않는다). */
  locked: boolean
  /** 일본어 글이 서버 원래 글과 정규화 기준으로 달라짐(기존 행만). */
  retexted: boolean
  onValues: (patch: Partial<ChunkValues>) => void
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-3 rounded-xl bg-surface2 p-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{REVIEW.fType}</span>
        <Segmented<TopicChunkType> size="sm" ariaLabel={REVIEW.fType} options={TYPE_OPTIONS} value={e.values.chunkType} onChange={(v) => onValues({ chunkType: v })} />
      </div>
      {FIELDS.map((f) => {
        const id = topicProblemDomId(chunkProblemKey(e.key, f))
        const err = e.problems[f] ?? (e.isNew ? undefined : errors[chunkProblemKey(e.key, f)])
        const note = f === 'textJa' && retexted
        const described = [err ? `${id}-err` : null, note ? RETEXT_NOTE_DOM_ID : null].filter(Boolean).join(' ') || undefined
        return (
          <Field key={f} label={FIELD_LABEL[f]} htmlFor={id}>
            <input
              id={id}
              type="text"
              lang={f === 'meaningKo' ? undefined : 'ja'}
              value={e.values[f]}
              aria-invalid={err ? true : undefined}
              aria-describedby={described}
              onChange={(ev) => onValues({ [f]: ev.target.value })}
              className={`h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink ${err ? 'border-bad' : 'border-line'}`}
            />
            {err ? (
              <p id={`${id}-err`} className="text-[12px] text-bad break-keep">
                {err}
              </p>
            ) : null}
            {note ? (
              <p id={RETEXT_NOTE_DOM_ID} role="note" className="flex min-w-0 gap-2 text-[12.5px] text-ink">
                <span aria-hidden="true" className="flex-none">
                  ⚠
                </span>
                <span className="min-w-0 break-keep">{EDIT.textChanged}</span>
              </p>
            ) : null}
          </Field>
        )
      })}
      <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <Btn size="sm" className={`min-h-11 ${locked ? 'opacity-40' : ''}`} aria-disabled={locked || undefined} onClick={onApply}>
          {REVIEW.apply}
        </Btn>
        <Btn size="sm" variant="ghost" className="min-h-11" onClick={onCancel}>
          {REVIEW.cancel}
        </Btn>
      </div>
    </div>
  )
}

function MenuItem({ children, onClick, off = false, bad = false }: { children: React.ReactNode; onClick: () => void; off?: boolean; bad?: boolean }) {
  return (
    <button
      type="button"
      aria-disabled={off || undefined}
      onClick={() => !off && onClick()}
      className={`flex h-12 w-full items-center border-b border-line px-1 text-left text-[15px] last:border-b-0 ${bad ? 'text-bad' : 'text-ink'} ${off ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}
