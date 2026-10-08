/**
 * 오늘 탭 자리표시(task-046 IMP-0027, T3) — 서버 `loading.tsx`·`TodayHome` 의 첫 화면(요청이 모두 끝나기 전)·카드 하나가 늦을 때의 몸통이 **같은 부품**을 쓴다.
 * 그래서 「서버 자리표시 → 클라이언트 자리표시 → 데이터」 사이에 모양이 바뀌지 않는다. 훅이 없어 서버·클라이언트 양쪽에서 쓴다.
 *
 * 정적으로 아는 것(앱바 제목·카드 제목)은 실제 글자를 그대로 그리고, 데이터가 정하는 몸통만 회색 블록이다. 「불러오는 중…」 글자·가짜 빈 상태·가짜 [시작하기]
 * 버튼은 그리지 않는다. 높이는 `todaySkeleton.ts`(실측 상수)에서 CSS 변수로 읽는다 — 폭이 좁으면 글줄이 한 줄 더 감겨 카드가 커지므로 두 값을 폭으로 가른다.
 */
import { HOME as EVAL_HOME } from '@/components/eval/evalCopy'
import { HOME as LESSON_HOME } from '@/components/lesson/lessonCopy'
import AppBar from '@/components/shell/AppBar'
import { SKELETON_SR_LABEL } from '@/components/shell/tabSkeleton'
import { SkeletonRegion } from '@/components/shell/TabSkeleton'
import { cardHeightVars, type TodayCardKind } from './todaySkeleton'
import { WORDS_CARD } from './topicCopy'

/** 카드 높이 클래스 — 숫자는 `cardHeightVars` 가 변수로 넘기고, 좁은 폭 경계(`narrowBelow`)만 클래스에 있다. Tailwind 가 정적으로 찾도록 리터럴로 쓴다. */
const H_CLASS: Record<TodayCardKind, string> = {
  word: 'h-[var(--h-n)] min-[370px]:h-[var(--h-w)]',
  lesson: 'h-[var(--h-w)]',
  eval: 'h-[var(--h-n)] min-[362px]:h-[var(--h-w)]',
}

/** 카드 하나의 자리표시 — 실제 `Card` 와 같은 테두리·여백·제목, 몸통은 회색 블록 하나. */
export function TodayCardSkeleton({ kind, title, first = false }: { kind: TodayCardKind; title: string; first?: boolean }) {
  return (
    <section className={first ? 'min-w-0' : 'mt-[18px] min-w-0'}>
      <div style={cardHeightVars(kind)} className={`flex min-w-0 flex-col rounded-[14px] border border-line bg-surface p-3.5 ${H_CLASS[kind]}`}>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="mt-2 block min-h-0 flex-1 rounded-xl bg-surface2" />
      </div>
    </section>
  )
}

/** 오늘 홈의 세 카드 — 단어 · 오늘의 회화 · AI 평가. 챌린지 띠·복습 카드·통계 같은 조건부 섹션은 넣지 않는다. */
export function TodayCardsSkeleton() {
  return (
    <SkeletonRegion>
      <TodayCardSkeleton kind="word" title={WORDS_CARD.title} first />
      <TodayCardSkeleton kind="lesson" title={LESSON_HOME.title} />
      <TodayCardSkeleton kind="eval" title={EVAL_HOME.title} />
    </SkeletonRegion>
  )
}

/** 서버 `loading.tsx` 의 내용 — 앱바(실제 부품) + 카드 자리표시. 여기엔 데이터 요청이 없다: 진짜 화면이 올라오면 그쪽이 불러온다. */
export default function TodaySkeleton() {
  return (
    <>
      <AppBar title="오늘의 공부" />
      <div className="px-4 pb-8">
        <TodayCardsSkeleton />
      </div>
    </>
  )
}

/** 카드 안쪽 몸통 자리표시 — 요청이 상한 시간을 넘겨서 카드가 먼저 보이거나(`TODAY_HOLD_MS`), [다시 시도] 뒤 다시 읽는 동안. 카드 전체 높이가 `TODAY_CARD_H` 와 같아진다. */
export function CardLoadingBody({ kind }: { kind: TodayCardKind }) {
  return (
    <>
      <p role="status" className="sr-only">
        {SKELETON_SR_LABEL}
      </p>
      <span aria-hidden="true" style={cardHeightVars(kind, true)} className={`mt-2 block rounded-xl bg-surface2 ${H_CLASS[kind]}`} />
    </>
  )
}

