'use client'

/**
 * 빈 단어장 안내(screens.md §4-2 A 표) — 빈 칸은 버그로 읽히므로 경우마다 다른 안내를 둔다.
 * `EmptyBlock` 은 글자가 `ink3`(명암비 미달, §1-1)라 쓰지 않고 `Card` 에 `ink`/`ink2` 로 그린다.
 *
 * 조각을 고른 채 0(task-023 데모 `list-empty`·`list-search-empty`): 무엇이 겹쳤는지 쓰고 한쪽씩 푸는 버튼을 둔다.
 * task-068: 검색 + 조각이 0 이면 [‘q’ 추가하기](추가 시트가 그 조각을 미리 고름, J6) + [조각 전체에서 찾기] 두 단추(§28-10 ⑨).
 * 기본 단어 넣기 버튼은 없다(§28-6 A) — 단어가 하나도 없으면 [단어 직접 추가] 하나. 출처 「내 단어」가 0 이면 `noMine`.
 * task-074(§32-4): 「즐겨찾기」 칸이 0 이면 `noFavorite`(조건 없음) / `noFavoriteMatch`(다른 조건과 겹쳐 0) — 두 단추 모두 즐겨찾기 칸만 푼다.
 * 「‘q’ 추가하기」는 내지 않는다.
 */
import { Btn, Card } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import type { WordChunkFilter, WordChunkType } from '@/types/vocab'
import { chunkEmptyText, FAVORITE_COPY, favoriteMatchParts, WORDS_EMPTY_COPY } from './labels'
import type { WordsEmptyVariant } from './validate'

const SMALL_BTN = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold'

export default function WordsEmpty({
  variant,
  q,
  category = null,
  chunk = null,
  archived = false,
  onAdd,
  onShowArchive,
  onShowAll,
  onClearChunk,
  onClearFavorite,
}: {
  variant: WordsEmptyVariant
  q: string
  category?: string | null
  chunk?: WordChunkFilter | null
  archived?: boolean
  /** `presetChunk` = 고른 조각을 추가 시트가 미리 고른다(J6). */
  onAdd: (preset?: string, presetChunk?: WordChunkType) => void
  onShowArchive: () => void
  /** 분류만 푼다(분류 → 전체). */
  onShowAll: () => void
  /** 조각만 푼다(조각 → 전체). */
  onClearChunk?: () => void
  /** 즐겨찾기 칸만 푼다(→ 「전체」 칸, 다른 조건 유지 — task-074 §32-4). */
  onClearFavorite?: () => void
}) {
  let title: React.ReactNode
  let body: React.ReactNode = null
  let actions: React.ReactNode = null

  switch (variant) {
    case 'noWords':
      title = '단어장이 비어 있어요'
      body = WORDS_EMPTY_COPY.noWordsBody
      actions = (
        <Btn className="mt-3 w-full" onClick={() => onAdd()}>
          {WORDS_EMPTY_COPY.addBtn}
        </Btn>
      )
      break
    case 'noMine':
      title = WORDS_EMPTY_COPY.noMineTitle
      body = WORDS_EMPTY_COPY.noMineBody
      actions = (
        <Btn className="mt-3 w-full" onClick={() => onAdd()}>
          {WORDS_EMPTY_COPY.addBtn}
        </Btn>
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
        <div className="mt-3 flex flex-col gap-2">
          {cpLength(q) <= 80 ? (
            <Btn variant="ghost" className="w-full min-w-0" onClick={() => onAdd(q, chunk ?? undefined)}>
              <span className="truncate">
                ‘<span lang="ja">{q}</span>’ 추가하기
              </span>
            </Btn>
          ) : null}
          <button type="button" className={`${SMALL_BTN} w-full`} onClick={onClearChunk}>
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
    case 'noFavorite':
      title = FAVORITE_COPY.noneTitle
      body = FAVORITE_COPY.noneBody
      actions = (
        <Btn variant="ghost" className="mt-3 w-full" onClick={onClearFavorite}>
          {FAVORITE_COPY.noneBtn}
        </Btn>
      )
      break
    case 'noFavoriteMatch': {
      // 「‘ねこ’ 검색 · 보관함 안에서 즐겨찾기만 찾았어요.」 — 글자는 `FAVORITE_COPY.matchBody` 와 같고, 검색어만 `lang="ja"` 로 감싼다.
      const parts = favoriteMatchParts({ q, archived, category, chunk })
      title = FAVORITE_COPY.matchTitle
      body = (
        <>
          {parts.map((p, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : null}
              {p.pre}
              {p.ja !== undefined ? <span lang="ja">{p.ja}</span> : null}
              {p.post}
            </span>
          ))}
          {FAVORITE_COPY.matchBody('')}
        </>
      )
      actions = (
        <Btn variant="ghost" className="mt-3 w-full" onClick={onClearFavorite}>
          {FAVORITE_COPY.matchBtn}
        </Btn>
      )
      break
    }
  }

  return (
    <Card className="text-center">
      <p className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{title}</p>
      {body ? <p className="mt-1 text-[13px] text-ink2 break-keep">{body}</p> : null}
      {actions}
    </Card>
  )
}
