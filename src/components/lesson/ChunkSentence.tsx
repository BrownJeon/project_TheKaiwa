'use client'

/**
 * ③ 조각 단계의 문장 카드 부품(screens §37-4·37-4-1 · 데모 v1 `c-new`·`c-tap`·`c-long`·`c-partial`·`c-textonly`·`c-ttsfail`).
 *  - 조각 글·종류·뜻은 저장된 `dialogue[i].pieces` 에서만, 읽기·한글은 문장 전체 분석을 조각 범위로 자른 `chunkLogic` 결과만 그린다.
 *  - 칸 = `button aria-pressed`, 문장부호(type null)·빗금은 `aria-hidden` 이고 앞 칸의 꼬리 묶음에 붙는다(줄 머리에 오지 않게).
 *  - 카드 머리 `aria-live` 와 재생 `role="status"` 는 문장이 바뀌어도 같은 요소로 남고 글만 바뀐다(데모 Minor-2 — 카드에 문장 `key` 를 주지 않는다).
 */
import { Fragment } from 'react'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { DISPLAY_COPY, useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { HangulLine, HangulPlaceholder, JaText } from '@/components/common/japanese/JapaneseText'
import { hasKanji, type RubyPiece } from '@/modules/speech/reading/client'
import type { DialogueLine, DialoguePiece, PieceType } from '@/types/lesson'
import { phraseIndexOf, phraseKey, phraseText, pieceHangul, pieceHangulLine, pieceKey, pieceRanges, pieceRuns } from './chunkLogic'
import { PIECE_TYPE_LABEL, U3 } from './lessonCopy'
import { lineReplayKey, playLineReplay } from './logic'
import { PlayButton, RoleChip } from './parts'
import type { LessonPlayback } from './useLessonPlayback'

/** 종류별 밑줄·색 띠·뱃지 색(새 색 0 — 기존 토큰, §37-9 Q12). 색은 장식이고 정보는 이름표 글자다. */
export const PIECE_TONE: Record<PieceType, { bar: string; band: string; kc: string }> = {
  NAME: { bar: 'mt-px h-[3px] rounded-sm bg-protein', band: 'bg-protein', kc: 'var(--color-protein)' },
  ACTION: { bar: 'mt-px h-[3px] rounded-sm bg-accent', band: 'bg-accent', kc: 'var(--color-accent)' },
  FEELING: { bar: 'mt-px h-[3px] rounded-sm bg-carb', band: 'bg-carb', kc: 'var(--color-carb)' },
  MODIFIER: { bar: 'mt-px h-[3px] rounded-sm bg-good', band: 'bg-good', kc: 'var(--color-good)' },
  EXPRESSION: { bar: 'mt-px h-0 border-b-[3px] border-dashed border-ink', band: 'bg-ink', kc: 'var(--color-ink)' },
  LINK: { bar: 'mt-0.5 h-0 border-b-2 border-dotted border-ink3', band: 'bg-ink3', kc: 'var(--color-ink3)' },
}

const toneOf = (t: PieceType) => PIECE_TONE[t] ?? PIECE_TONE.EXPRESSION
const labelOf = (t: PieceType) => PIECE_TYPE_LABEL[t] ?? PIECE_TYPE_LABEL.EXPRESSION

/** 이 줄을 칸으로 그릴 수 있으면 조각 배열, 아니면 null(키 없음·null 줄·이은 글 ≠ 원문 — 모두 «조각 없는 줄» ⑦). */
export function usablePieces(line: Pick<DialogueLine, 'ja' | 'pieces'>): DialoguePiece[] | null {
  const ps = line.pieces
  if (!Array.isArray(ps) || ps.length === 0) return null
  return pieceRanges(ps, line.ja) ? ps : null
}

/** 칸 묶음 단위 — 끊어 읽기 구간(／ 뒤에서 나눔) 안의 «꼬리 묶음»(누를 수 있는 칸 + 뒤 문장부호 + 빗금). 앞머리 문장부호는 다음 칸에 붙인다. */
export function tileUnits(pieces: readonly DialoguePiece[]): number[][][] {
  const phrases: number[][][] = []
  let units: number[][] = []
  let lead: number[] = []
  pieces.forEach((p, j) => {
    if (p.type === null) {
      if (units.length) units[units.length - 1].push(j)
      else lead.push(j)
    } else {
      units.push([...lead, j])
      lead = []
    }
    if (p.slash === true) {
      if (lead.length) {
        units.push(lead)
        lead = []
      }
      phrases.push(units)
      units = []
    }
  })
  if (lead.length) units.push(lead)
  if (units.length) phrases.push(units)
  return phrases
}

function RubyRuns({ runs }: { runs: readonly RubyPiece[] }) {
  return (
    <>
      {runs.map((r, k) =>
        r.reading ? (
          <ruby key={k} className="[ruby-align:center] [ruby-position:over]">
            {r.text}
            <rt aria-hidden="true" className="text-[11px] font-normal leading-none tracking-normal text-ink2 select-none">
              {r.reading}
            </rt>
          </ruby>
        ) : (
          <Fragment key={k}>{r.text}</Fragment>
        ),
      )}
    </>
  )
}

/** 조각 칸 묶음(§37-4 `PieceTiles`). `showFu` = 히라가나 켬 + 분석 대기/완료 — 한자가 든 문장이면 루비 자리를 둔다(JaText 규칙). */
export function PieceTiles({
  pieces,
  runs,
  showFu,
  sel,
  onPick,
  textOnly,
}: {
  pieces: readonly DialoguePiece[]
  runs: readonly RubyPiece[][]
  showFu: boolean
  sel: number | null
  onPick: (j: number) => void
  textOnly: boolean
}) {
  const n = pieces.filter((p) => p.type !== null).length
  const reserve = showFu && pieces.some((p) => hasKanji(p.ja))
  const jaStyle = reserve ? { lineHeight: 2.15 } : undefined
  return (
    <div role="group" aria-label={textOnly ? U3.tilesAriaTextOnly(n) : U3.tilesAria(n)} className="mt-0.5 flex min-w-0 flex-wrap items-end gap-y-1">
      {tileUnits(pieces).map((units, k) => (
        <span key={k} className="inline-flex max-w-full min-w-0 flex-wrap items-end gap-x-0.5 gap-y-1">
          {units.map((unit) => (
            <span key={unit[0]} className="inline-flex max-w-full flex-nowrap items-end gap-0.5">
              {unit.map((j) => {
                const p = pieces[j]
                const slash = p.slash === true ? (
                  <span aria-hidden="true" className="self-end px-[3px] pb-[1.3em] text-[17px] text-ink3">
                    ／
                  </span>
                ) : null
                if (p.type === null)
                  return (
                    <Fragment key={j}>
                      <span aria-hidden="true" className="pointer-events-none inline-flex min-w-0 flex-col items-center py-[3px] pr-px">
                        <span lang="ja" className="text-[17px] leading-[1.35] whitespace-nowrap" style={jaStyle}>
                          {p.ja}
                        </span>
                        <span className="mt-px block h-[3px]" />
                        <span className="mt-0.5 text-[11px] leading-[1.3]">&nbsp;</span>
                      </span>
                      {slash}
                    </Fragment>
                  )
                const label = labelOf(p.type)
                return (
                  <Fragment key={j}>
                    <button
                      type="button"
                      aria-pressed={sel === j}
                      onClick={() => onPick(j)}
                      className="inline-flex min-h-11 min-w-11 max-w-full flex-col items-center rounded-[10px] px-[5px] py-[3px] text-ink hover:bg-surface2 aria-pressed:bg-accent-soft aria-pressed:ring-[1.5px] aria-pressed:ring-accent aria-pressed:ring-inset"
                    >
                      <span lang="ja" className="text-[17px] leading-[1.35] whitespace-nowrap" style={jaStyle}>
                        <RubyRuns runs={runs[j] ?? [{ text: p.ja, reading: null }]} />
                      </span>
                      <span aria-hidden="true" className={`block self-stretch ${toneOf(p.type).bar}`} />
                      <span className="mt-0.5 text-[11px] leading-[1.3] whitespace-nowrap text-ink2">
                        {label.short}
                        <span className="sr-only">{U3.tileSrTail(p.ko ?? '')}</span>
                      </span>
                    </button>
                    {slash}
                  </Fragment>
                )
              })}
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}

/** 빗금이 든 한글 한 줄(§37-4 `PieceHangulLine`) — `HangulLine` 과 같은 숨김 접두·`[ ]`. 빗금은 낭독하지 않는다(경계는 [구간 듣기] 이름으로). */
export function PieceHangulLine({ hangul, state }: { hangul: string | null; state: AnnotationState }) {
  const prefs = useDisplayPrefs()
  if (!prefs.loaded || !prefs.showHangul) return null
  if (state.s === 'loading') return <HangulPlaceholder />
  if (state.s !== 'ready' || !hangul) return null
  const parts = hangul.split(' / ')
  return (
    <p lang="ko" className="mt-1.5 block text-[13px] leading-[1.5] text-ink2 select-none [overflow-wrap:anywhere] [word-break:normal]">
      <span className="sr-only">{DISPLAY_COPY.hangulSr}</span>
      <span aria-hidden="true" className="text-ink3">
        [
      </span>
      {parts.map((t, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <>
              <span aria-hidden="true" className="text-ink3">
                {' /'}
              </span>{' '}
            </>
          ) : null}
          {t}
        </Fragment>
      ))}
      <span aria-hidden="true" className="text-ink3">
        ]
      </span>
    </p>
  )
}

/** 고른 조각 줄(§37-4 `PieceStrip`, Q8 A). 소리 없음이면 ▶·구간 버튼을 그리지 않는다. */
export function PieceStrip({
  piece,
  reading,
  hangul,
  phrase,
  playing,
  onPlayPiece,
  onPlayPhrase,
  textOnly,
}: {
  piece: DialoguePiece
  reading: string | null
  hangul: string | null
  phrase: string | null
  playing: 'piece' | 'phrase' | null
  onPlayPiece: () => void
  onPlayPhrase: () => void
  textOnly: boolean
}) {
  const type = piece.type ?? 'EXPRESSION'
  return (
    <div className="mt-2.5 min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <p lang="ja" className="text-[17px] [overflow-wrap:anywhere]">
            {piece.ja}
          </p>
          {reading || hangul ? (
            <p className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
              {reading ? <span lang="ja">{reading}</span> : null}
              {reading && hangul ? ' · ' : null}
              {hangul ? (
                <span lang="ko" className="select-none">
                  <span className="sr-only">{DISPLAY_COPY.hangulSr}</span>
                  <span aria-hidden="true" className="text-ink3">
                    [
                  </span>
                  {hangul}
                  <span aria-hidden="true" className="text-ink3">
                    ]
                  </span>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {!textOnly ? <PlayButton playing={playing === 'piece'} onClick={onPlayPiece} label={U3.pieceAria} /> : null}
      </div>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="inline-flex min-h-[22px] flex-none items-center rounded-md bg-surface pl-2.5 pr-2 text-[12px] font-semibold text-ink shadow-[inset_4px_0_0_var(--kc)]"
          style={{ '--kc': toneOf(type).kc } as React.CSSProperties}
        >
          {labelOf(type).full}
        </span>
        <span className="min-w-0 text-[14px] text-ink break-keep">{piece.ko}</span>
      </div>
      {!textOnly && phrase ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onPlayPhrase}
            className={`inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 rounded-xl border px-3.5 py-1 text-left text-[14px] font-semibold ${playing === 'phrase' ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink'}`}
          >
            {playing === 'phrase' ? (
              U3.phraseStop
            ) : (
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {U3.phraseLead}
                <span lang="ja">{phrase}</span>
                {U3.phraseTail}
              </span>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** 옛 수업(조각 단계 전) 빈 상태(Q5 A). */
export function ChunkEmpty() {
  return (
    <div className="mt-3 rounded-[14px] bg-surface2 p-4">
      <h3 className="text-[15px] font-bold break-keep">{U3.emptyTitle}</h3>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{U3.emptyBody}</p>
    </div>
  )
}

/** 고른 조각의 읽기(히라가나) — 조각에 한자가 있고 루비 읽기를 구했을 때만. */
const readingOf = (piece: DialoguePiece, runs: readonly RubyPiece[] | undefined): string | null =>
  runs && hasKanji(piece.ja) && runs.some((r) => r.reading) ? runs.map((r) => r.reading ?? r.text).join('') : null

/** 문장 카드(§37-4-1). 머리 ▶ = 그 줄 다시 듣기(kind dialogue, 보통 속도 — ① 과 같은 키). */
export function ChunkSentenceCard({
  lineIdx,
  line,
  roleKo,
  ann,
  sel,
  onPick,
  pb,
  textOnly,
}: {
  lineIdx: number
  line: DialogueLine
  roleKo: string
  ann: AnnotationState
  sel: number | null
  onPick: (j: number) => void
  pb: LessonPlayback
  textOnly: boolean
}) {
  const prefs = useDisplayPrefs()
  const fu = prefs.loaded && prefs.showFurigana
  const hg = prefs.loaded && prefs.showHangul
  const tr = prefs.loaded && prefs.showTranslation
  const i = lineIdx + 1
  const pieces = usablePieces(line)
  const lineKey = lineReplayKey(lineIdx)
  const linePlaying = pb.active(lineKey)
  const picked = pieces && sel !== null && pieces[sel] && pieces[sel].type !== null ? pieces[sel] : null
  const k = picked && sel !== null && pieces ? phraseIndexOf(pieces, sel) : null
  const phraseRaw = pieces && k !== null ? phraseText(pieces, k) : null
  const phrase = picked && phraseRaw && phraseRaw !== picked.ja ? phraseRaw : null
  const pieceOn = picked && sel !== null ? pb.active(pieceKey(lineIdx, sel)) : false
  const phraseOn = k !== null ? pb.active(phraseKey(lineIdx, k)) : false
  const playing: 'piece' | 'phrase' | null = pieceOn ? 'piece' : phraseOn ? 'phrase' : null

  const togglePiece = (j: number) => {
    const key = pieceKey(lineIdx, j)
    if (pb.active(key)) return pb.stop()
    pb.playLines(key, [{ kind: 'piece', idx: lineIdx, sub: j, pace: 'normal' }])
  }
  const togglePhrase = (q: number) => {
    const key = phraseKey(lineIdx, q)
    if (pb.active(key)) return pb.stop()
    pb.playLines(key, [{ kind: 'phrase', idx: lineIdx, sub: q, pace: 'normal' }])
  }
  const pick = (j: number) => {
    onPick(j)
    if (!textOnly) togglePiece(j)
  }

  const runs = pieces ? pieceRuns(ann, line.ja, pieces, fu) : null
  const segments = ann.s === 'ready' ? ann.segments : null
  const hangulRow = pieces && segments ? pieceHangulLine(segments, line.ja, pieces) : null
  const pickedHangul = picked && sel !== null && hg && pieces && segments ? pieceHangul(segments, line.ja, pieces)[sel] : null

  return (
    <section aria-label={U3.cardSr(i)} className="mt-2 min-w-0 rounded-[14px] border border-line bg-surface px-3 pt-1.5 pb-3">
      <div className="flex min-h-11 min-w-0 items-center gap-2">
        <RoleChip who={line.speaker} small />
        <span aria-live="polite" className="min-w-0 flex-1 truncate text-[13px] text-ink2">
          {U3.cardHead(roleKo, i)}
        </span>
        {!textOnly ? <PlayButton playing={linePlaying} onClick={() => (linePlaying ? pb.stop() : playLineReplay(pb, lineIdx, 'normal'))} label={U3.lineAria(i)} /> : null}
      </div>
      {pieces && runs ? (
        <>
          <p lang="ja" className="sr-only">
            {line.ja}
          </p>
          <PieceTiles pieces={pieces} runs={runs} showFu={fu && (ann.s === 'loading' || ann.s === 'ready')} sel={picked ? sel : null} onPick={pick} textOnly={textOnly} />
          <PieceHangulLine hangul={hangulRow} state={ann} />
          {tr ? <p className="mt-0.5 text-[13px] text-ink2 break-keep">{line.ko}</p> : null}
          {picked && sel !== null ? (
            <PieceStrip
              piece={picked}
              reading={fu ? readingOf(picked, runs[sel]) : null}
              hangul={pickedHangul ?? null}
              phrase={phrase}
              playing={playing}
              onPlayPiece={() => togglePiece(sel)}
              onPlayPhrase={() => (k !== null ? togglePhrase(k) : undefined)}
              textOnly={textOnly}
            />
          ) : (
            <p className="mt-2.5 text-[13px] text-ink2 break-keep">{textOnly ? U3.pickTextOnly : U3.pick}</p>
          )}
        </>
      ) : (
        <>
          <JaText text={line.ja} state={ann} className="whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
          <HangulLine state={ann} size={13} />
          {tr ? <p className="mt-0.5 text-[13px] text-ink2 break-keep">{line.ko}</p> : null}
          <p className="mt-2 rounded-[10px] bg-surface2 px-3 py-2 text-[13px] text-ink2 break-keep">{U3.noPieces}</p>
        </>
      )}
      <span role="status" className="sr-only">
        {playing ? U3.playingSr : ''}
      </span>
    </section>
  )
}
