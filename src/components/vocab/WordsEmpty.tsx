'use client'

/**
 * 빈 단어장 안내(screens.md §4-2 A 표) — 빈 칸은 버그로 읽히므로 경우마다 다른 안내를 둔다.
 * `EmptyBlock` 은 글자가 `ink3`(명암비 미달, §1-1)라 쓰지 않고 `Card` 에 `ink`/`ink2` 로 그린다.
 *
 * 조각을 고른 채 0(task-023 데모 `list-empty`·`list-search-empty`): 무엇이 겹쳤는지 쓰고 한쪽씩 푸는 버튼을 둔다.
 * 검색 중이면 [‘q’ 추가하기] 대신 [조각 전체에서 찾기] — 여기서 넣은 단어는 조각이 비어 이 목록에 다시 안 보이기 때문이다.
 */
import { Btn, Card } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import type { SeedPack } from '@/types/seedPack'
import type { WordChunkFilter } from '@/types/vocab'
import type { SeedLevels } from './hooks'
import { chunkEmptyText, SEED_COPY } from './labels'
import type { WordsEmptyVariant } from './validate'

const SMALL_BTN = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold'
const TEXT_BTN = 'inline-flex min-h-[44px] items-center text-[13px] font-medium text-accent break-keep'

/**
 * 기본 단어 넣기 버튼(§19-4 A·C) — 빈 단어장 카드와 오늘 카드가 같이 쓴다. 채운 버튼은 지금 수준 하나뿐이고,
 * 목표 수준(정해 두었고 지금과 다를 때)은 바로 아래 ghost. 넣는 동안 누른 버튼만 「넣는 중…」, 넣기 버튼은 모두 `aria-disabled`.
 * 단계를 모르면 넣기 버튼을 그리지 않는다 — 읽기에 실패했으면 「다시 시도」 글자 버튼 하나(§19-3).
 * 긴 보조 문구(목표 최상급)는 360폭에서 두 줄이 될 수 있어 줄바꿈을 허용한다(`truncate` 금지, §19-8).
 */
export function SeedPackButtons({
  levels,
  seedingPack,
  onSeed,
  retryClassName = 'self-start',
}: {
  levels: SeedLevels
  seedingPack: SeedPack | null
  onSeed: (pack: SeedPack) => void
  retryClassName?: string
}) {
  const { main, goal } = levels
  if (main === null) {
    return levels.status === 'error' ? (
      <button type="button" onClick={levels.retry} className={`${TEXT_BTN} ${retryClassName}`}>
        {SEED_COPY.levelRetry}
      </button>
    ) : null
  }
  const seedBtn = (pack: SeedPack, variant: 'primary' | 'ghost', label: string) => {
    const busy = seedingPack === pack
    return (
      <Btn
        variant={variant}
        className="w-full whitespace-normal break-keep leading-[1.25]"
        onClick={() => onSeed(pack)}
        aria-disabled={seedingPack !== null || undefined}
        aria-busy={busy || undefined}
      >
        {busy ? SEED_COPY.busy : label}
      </Btn>
    )
  }
  return (
    <>
      {seedBtn(main, 'primary', SEED_COPY.mainBtn(main))}
      {goal ? seedBtn(goal, 'ghost', SEED_COPY.goalBtn(goal)) : null}
    </>
  )
}

export default function WordsEmpty({
  variant,
  q,
  category = null,
  chunk = null,
  archived = false,
  levels,
  seedingPack,
  onSeed,
  onAdd,
  onShowArchive,
  onShowAll,
  onClearChunk,
}: {
  variant: WordsEmptyVariant
  q: string
  category?: string | null
  chunk?: WordChunkFilter | null
  archived?: boolean
  levels: SeedLevels
  seedingPack: SeedPack | null
  onSeed: (pack: SeedPack) => void
  onAdd: (preset?: string) => void
  onShowArchive: () => void
  /** 분류만 푼다(분류 → 전체). */
  onShowAll: () => void
  /** 조각만 푼다(조각 → 전체). */
  onClearChunk?: () => void
}) {
  let title: React.ReactNode
  let body: React.ReactNode = null
  let actions: React.ReactNode = null

  switch (variant) {
    case 'noWords':
      title = '단어장이 비어 있어요'
      body = levels.main ? SEED_COPY.emptyBody(levels.main) : SEED_COPY.emptyBodyNoLevel
      actions = (
        <div className="mt-3 flex flex-col gap-2">
          <SeedPackButtons levels={levels} seedingPack={seedingPack} onSeed={onSeed} retryClassName="w-full justify-center text-center" />
          <Btn variant="ghost" className="w-full" onClick={() => onAdd()}>
            직접 추가
          </Btn>
        </div>
      )
      break
    case 'allArchived':
      title = '보관하지 않은 단어가 없어요'
      body = '보관함에서 꺼내거나 새 단어를 넣어 보세요.'
      actions = (
        <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="ghost" onClick={onShowArchive}>
            보관함 보기
          </Btn>
          <Btn variant="ghost" onClick={() => onAdd()}>
            단어 추가
          </Btn>
        </div>
      )
      break
    case 'noSearch':
      title = (
        <>
          ‘<span lang="ja">{q}</span>’에 맞는 단어가 없어요
        </>
      )
      actions =
        cpLength(q) <= 80 ? (
          <Btn variant="ghost" className="mt-3 w-full min-w-0" onClick={() => onAdd(q)}>
            <span className="truncate">
              ‘<span lang="ja">{q}</span>’ 추가하기
            </span>
          </Btn>
        ) : null
      break
    case 'noSearchChunk':
      title = (
        <>
          ‘<span lang="ja">{q}</span>’에 맞는 단어가 없어요
        </>
      )
      body = chunk ? chunkEmptyText({ q, category, chunk, archived }).body : null
      actions = (
        <div className="mt-3 flex gap-2 [&>*]:flex-1">
          <button type="button" className={SMALL_BTN} onClick={onClearChunk}>
            조각 전체에서 찾기
          </button>
        </div>
      )
      break
    case 'noChunk': {
      const t = chunk ? chunkEmptyText({ q: '', category, chunk, archived }) : { title: null, body: null }
      title = t.title
      body = t.body
      actions = (
        <div className="mt-3 flex gap-2 [&>*]:flex-1">
          <button type="button" className={SMALL_BTN} onClick={onClearChunk}>
            조각 전체 보기
          </button>
          {category !== null ? (
            <button type="button" className={SMALL_BTN} onClick={onShowAll}>
              분류 전체 보기
            </button>
          ) : null}
        </div>
      )
      break
    }
    case 'noCategory':
      title = '이 분류에 단어가 없어요'
      actions = (
        <Btn variant="ghost" className="mt-3 w-full" onClick={onShowAll}>
          전체 보기
        </Btn>
      )
      break
    case 'noArchived':
      title = '보관한 단어가 없어요'
      body = '오늘의 단어에서 빼고 싶은 단어는 눌러서 보관할 수 있어요.'
      break
  }

  return (
    <Card className="text-center">
      <p className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{title}</p>
      {body ? <p className="mt-1 text-[13px] text-ink2 break-keep">{body}</p> : null}
      {actions}
    </Card>
  )
}
