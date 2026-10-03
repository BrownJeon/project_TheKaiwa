/**
 * ④ 응용 글자 비교(task-025, IMP-0016) — **채점이 아니라 표시만** 나눈다. 정오 판정·저장·기록을 바꾸지 않는다.
 *
 * 채팅 교정 카드와 같은 코드포인트 LCS(`chat/diff.ts` `diffCodepoints`)를 쓰고, 문장부호·공백만 다른 글자는
 * 글자 하나씩 "같음"으로 돌린다(묶음 단위로 돌리면 "。です" 같은 섞인 조각이 통째로 사라진다).
 * 불변식: 조각을 이어 붙이면 원문(내 문장·모범 답안)과 한 글자도 다르지 않다 — 단위 테스트가 지킨다.
 */
import { diffCodepoints, type DiffSeg } from '@/components/chat/diff'

const IGNORABLE = /^[\s\p{P}]$/u

export type AnswerCompare =
  | { kind: 'none' }
  | { kind: 'same' }
  | { kind: 'diff'; mine: DiffSeg[]; model: DiffSeg[]; onlyMine: string[]; onlyModel: string[] }

function settle(segs: readonly DiffSeg[]): DiffSeg[] {
  const out: DiffSeg[] = []
  for (const s of segs) {
    for (const ch of Array.from(s.text)) {
      const changed = s.changed && !IGNORABLE.test(ch)
      const last = out[out.length - 1]
      if (last && last.changed === changed) last.text += ch
      else out.push({ text: ch, changed })
    }
  }
  return out
}

/**
 * 내 문장 ↔ 모범 답안. 쓰지 않고 봤으면(모르겠어요)·200 코드포인트를 넘으면 `none`(표시 없이 두 상자만).
 * 문장부호·공백 차이만 있으면 `same`.
 */
export function compareAnswer(mine: string | null | undefined, model: string): AnswerCompare {
  if (typeof mine !== 'string' || !mine.trim()) return { kind: 'none' }
  const d = diffCodepoints(mine, model)
  if (!d) return { kind: 'none' }
  const a = settle(d.a)
  const b = settle(d.b)
  const onlyMine = a.filter((s) => s.changed).map((s) => s.text)
  const onlyModel = b.filter((s) => s.changed).map((s) => s.text)
  if (!onlyMine.length && !onlyModel.length) return { kind: 'same' }
  return { kind: 'diff', mine: a, model: b, onlyMine, onlyModel }
}
