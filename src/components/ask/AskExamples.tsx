import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'

/**
 * 예시 칩 4개(screens.md §25-4 C). 누르면 `onPick(질문)` 만 부른다 — 입력창을 **채우기만** 하고 보내지 않는다(D1, Leader 결정).
 * `wrap` = 지난 질문 0개(제목·설명 + 줄바꿈), `row` = 그 밖(「예시」 + 가로 한 줄 스크롤).
 */
export default function AskExamples({ mode, onPick }: { mode: 'wrap' | 'row'; onPick: (text: string) => void }) {
  const wrap = mode === 'wrap'
  return (
    <section className="min-w-0">
      <h3 className="text-[13px] font-semibold text-ink2">{wrap ? ASK_COPY.examplesTitle : ASK_COPY.examplesRowTitle}</h3>
      {wrap ? (
        <p className="mt-1 text-[13px] text-ink2 break-keep">
          {ASK_COPY.examplesDescHead}
          <span className="font-semibold text-ink">{ASK_COPY.examplesDescBold}</span>
          {ASK_COPY.examplesDescTail}
        </p>
      ) : null}
      <div className={wrap ? 'mt-2 flex flex-wrap gap-2' : 'no-scrollbar -mr-4 mt-2 flex gap-2 overflow-x-auto pr-4'}>
        {ASK_COPY.examples.map((e) => (
          <button
            key={e.q}
            type="button"
            onClick={() => onPick(e.q)}
            className={`inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-left text-[14px]${wrap ? '' : ' flex-none whitespace-nowrap'}`}
          >
            <span className="inline-flex h-5 flex-none items-center rounded-md bg-surface2 px-1.5 text-[11.5px] font-semibold text-ink2">{e.tag}</span>
            <span className="min-w-0">
              <JaRuns text={e.q} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
