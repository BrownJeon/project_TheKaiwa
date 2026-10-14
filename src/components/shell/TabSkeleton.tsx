/**
 * 탭 화면 공용 자리표시 부품(task-046 IMP-0027) — 정적 회색 블록만 그린다. 「불러오는 중…」 글자·가짜 빈 상태·가짜 버튼은 그리지 않는다.
 * 서버 `loading.tsx` 와 클라이언트 로딩 구간이 **같은 부품**을 써서 「서버 자리표시 → 클라이언트 자리표시 → 데이터」 사이에 모양이 바뀌지 않는다.
 * 훅이 없어 서버·클라이언트 양쪽에서 쓴다.
 */
import { CHAT_SKELETON, CORRECTION_SKELETON, CORRECTION_TYPE_ROW, SKELETON_SR_LABEL, WORD_CATEGORY_ROW, WORD_SKELETON } from './tabSkeletonSizes'

/**
 * 자리표시 묶음 — 보이는 블록은 읽기에서 숨기고 `role=status` 한 줄만 알린다. `sr-only` 는 absolute 라 셸 `<main>`(relative) 안에서만 쓴다.
 * 알림은 `aria-busy` 래퍼 **밖**(형제)에 둔다 — busy 인 동안 변경 알림을 미루는 보조기기에서 이 한 줄이 읽히지 않을 수 있어서다(REV-171 L-2).
 * 한 화면에는 이 알림(`role=status`)을 한 곳만 둔다.
 */
export function SkeletonRegion({ children, label = SKELETON_SR_LABEL }: { children: React.ReactNode; label?: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-busy="true" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

/** 회화·채팅 목록 자리표시 — 카드 줄 N개(실제 줄과 같은 `gap-2`·둥근 모서리) */
export function ChatRowsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="flex min-w-0 flex-col" style={{ gap: CHAT_SKELETON.gap }}>
        {Array.from({ length: CHAT_SKELETON.rows }, (_, i) => (
          <span key={i} className="block rounded-[14px] bg-surface2" style={{ height: CHAT_SKELETON.rowHeight }} />
        ))}
      </div>
    </SkeletonRegion>
  )
}

/** 단어장 목록 자리표시 — 실제 목록과 같은 테두리 상자 + 줄 N개(줄마다 회색 막대 둘). `label` = 읽기 알림 한 줄(화면 첫 읽기는 「단어장을 불러오고 있어요」). */
export function WordRowsSkeleton({ label }: { label?: string } = {}) {
  return (
    <SkeletonRegion label={label}>
      <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {Array.from({ length: WORD_SKELETON.rows }, (_, i) => (
          <div key={i} className="flex flex-col justify-center gap-2 px-3.5" style={{ height: WORD_SKELETON.rowHeight }}>
            <span className="block h-[18px] w-2/5 rounded-md bg-surface2" />
            <span className="block h-3.5 w-3/5 rounded-md bg-surface2" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}

/** 채택 교정 모음 카드 자리표시(task-055 §21-7 C) — 실제 카드와 같은 테두리 상자 N개, 안에 회색 막대 4개(데모 `cardSkeletons`). */
export function CorrectionCardsSkeleton() {
  return (
    <SkeletonRegion>
      <div className="flex min-w-0 flex-col" style={{ gap: CORRECTION_SKELETON.gap }}>
        {Array.from({ length: CORRECTION_SKELETON.rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-3.5" style={{ height: CORRECTION_SKELETON.cardHeight }}>
            <span className="block h-3.5 w-[34%] rounded-md bg-surface2" />
            <span className="block h-5 w-[82%] rounded-md bg-surface2" />
            <span className="block h-5 w-[64%] rounded-md bg-surface2" />
            <span className="block h-3.5 w-[92%] rounded-md bg-surface2" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}

/**
 * 교정 모음 「유형」 칩 줄 자리 — 라벨 「유형」 + 회색 칩 4개, 실제 줄(`mt-1.5` 래퍼 + `py-1` + `h-9` 칩)과 같은 높이. 알림은 카드 쪽 한 줄뿐(한 화면에 하나).
 * 라벨 글자는 `drawer/correctionsCopy` 의 `typeLabel` 과 같다(시험이 묶는다 — 이 파일은 화면 모듈을 import 하지 않는다).
 */
export function ErrorTypeRowSkeleton() {
  return (
    <div aria-hidden="true" className="-mr-4 flex min-w-0 items-center gap-2" style={{ marginTop: WORD_CATEGORY_ROW.top }}>
      <span className="w-[30px] flex-none text-[12px] font-semibold text-ink2">유형</span>
      <span className="flex min-w-0 flex-1 gap-2 overflow-hidden" style={{ paddingBlock: WORD_CATEGORY_ROW.pad }}>
        {CORRECTION_TYPE_ROW.widths.map((w, i) => (
          <span key={i} className="block flex-none rounded-full bg-surface2" style={{ width: w, height: WORD_CATEGORY_ROW.chip }} />
        ))}
      </span>
    </div>
  )
}
