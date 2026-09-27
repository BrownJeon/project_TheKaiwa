'use client'

/**
 * 교정 카드(screens.md §3-2 E). **원문은 한 글자도 바꾸지 않는다** — trim·정규화·자르기 없이 그대로 그리고,
 * 바뀐 글자 강조는 `<span>` 분할만 한다(`diff.ts` 가 조각을 이으면 원문과 같음을 테스트로 보증).
 * 원문 | 교정은 카드 폭 기준 컨테이너 쿼리로 나란히(≥320px) ↔ 위아래(<320px, 뷰포트 360)를 바꾼다.
 */
import { Badge, Btn, BtnRow } from '@/components/common/ui'
import type { CorrectionDto } from '@/types/chat'
import { diffCodepoints, type DiffSeg } from './diff'
import { CHUNK_LABEL, ERROR_TYPE_LABEL, STATUS_LABEL } from './labels'

const JA_TEXT = 'whitespace-pre-wrap [overflow-wrap:anywhere] text-[17px] leading-[1.7]'

function Segments({ segs, kind }: { segs: DiffSeg[]; kind: 'removed' | 'added' }) {
  return (
    <>
      {segs.map((s, i) =>
        s.changed ? (
          <span
            key={i}
            className={
              kind === 'removed'
                ? 'rounded-sm bg-bad-soft text-bad line-through decoration-1'
                : 'rounded-sm bg-good-soft text-good underline decoration-2 underline-offset-4'
            }
          >
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

export default function CorrectionCard({
  correction,
  index,
  total,
  busy,
  highlighted,
  onAccept,
  onReject,
}: {
  correction: CorrectionDto
  index: number
  total: number
  busy: boolean
  highlighted: boolean
  onAccept: (c: CorrectionDto) => void
  onReject: (c: CorrectionDto) => void
}) {
  const c = correction
  const diff = diffCodepoints(c.original, c.corrected)
  const chunk = c.chunkType ? CHUNK_LABEL[c.chunkType] : null

  return (
    <li
      id={`cr_${c.id}`}
      className={`@container min-w-0 scroll-mt-16 rounded-[14px] border bg-surface p-3.5 transition-colors ${
        highlighted ? 'border-accent ring-2 ring-accent' : 'border-line'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex-none text-[12px] text-ink2">
          {index}/{total}
        </span>
        <Badge>{ERROR_TYPE_LABEL[c.errorType] ?? '기타'}</Badge>
        {c.severity === 'MAJOR' ? <Badge tone="bad">중요</Badge> : null}
        {chunk ? <span className="min-w-0 truncate text-[12px] text-ink2">{chunk}</span> : null}
        <span className="ml-auto flex-none">
          {c.status === 'ACCEPTED' ? <Badge tone="good">{STATUS_LABEL.ACCEPTED}</Badge> : null}
          {c.status === 'REJECTED' ? <Badge>{STATUS_LABEL.REJECTED}</Badge> : null}
          {c.status === 'EXPIRED' ? <Badge>{STATUS_LABEL.EXPIRED}</Badge> : null}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2.5 @min-[320px]:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-surface2 p-2.5">
          <p className="text-[12px] text-ink2">내 문장</p>
          <p lang="ja" className={`mt-0.5 ${JA_TEXT}`}>
            {diff ? <Segments segs={diff.a} kind="removed" /> : c.original}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-surface2 p-2.5">
          <p className="text-[12px] text-good">이렇게 고쳐요</p>
          <p lang="ja" className={`mt-0.5 ${JA_TEXT}`}>
            {diff ? <Segments segs={diff.b} kind="added" /> : c.corrected}
          </p>
        </div>
      </div>

      {c.explanation ? <p className="mt-2.5 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]">{c.explanation}</p> : null}

      {c.status === 'PROPOSED' ? (
        <>
          <p className="mt-2 text-[12px] text-ink2 break-keep">선생님 제안이에요. 채택해야 저장돼요.</p>
          <BtnRow>
            <Btn onClick={() => !busy && onAccept(c)} aria-disabled={busy || undefined} className={busy ? 'opacity-60' : ''}>
              채택
            </Btn>
            <Btn variant="ghost" onClick={() => !busy && onReject(c)} aria-disabled={busy || undefined} className={busy ? 'opacity-60' : ''}>
              무시
            </Btn>
          </BtnRow>
        </>
      ) : c.status === 'ACCEPTED' ? (
        <p className="mt-2.5 text-[13px] text-good">채택했어요{c.savedWordId ? ' · 단어장에 저장했어요' : ''}</p>
      ) : c.status === 'REJECTED' ? (
        <p className="mt-2.5 text-[13px] text-ink2">무시했어요 · 기록에 남지 않았어요</p>
      ) : (
        <p className="mt-2.5 text-[13px] text-ink2">기한이 지난 교정이에요</p>
      )}
    </li>
  )
}
