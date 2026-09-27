/**
 * 교정 카드의 "바뀐 글자" 강조(screens.md §3-2 E). **표시만 나눈다** — 조각을 이어 붙이면 입력과
 * 한 글자도 다르지 않아야 한다(`Correction.original` 무수정 원칙). 단위 테스트가 이 불변식을 지킨다.
 *
 * 코드포인트 단위 LCS: 이모지·서로게이트 쌍을 반으로 가르지 않는다. 200 코드포인트를 넘으면
 * O(n·m) 표가 커지고 강조도 읽기 어려워지므로 null(강조 없이 원문 그대로).
 */

export interface DiffSeg {
  text: string
  changed: boolean
}

export function diffCodepoints(a: string, b: string, max = 200): { a: DiffSeg[]; b: DiffSeg[] } | null {
  const A = Array.from(a)
  const B = Array.from(b)
  if (A.length > max || B.length > max) return null

  const n = A.length
  const m = B.length
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = A[i] === B[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const outA: DiffSeg[] = []
  const outB: DiffSeg[] = []
  const put = (out: DiffSeg[], ch: string, changed: boolean) => {
    const last = out[out.length - 1]
    if (last && last.changed === changed) last.text += ch
    else out.push({ text: ch, changed })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      put(outA, A[i], false)
      put(outB, B[j], false)
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      put(outA, A[i], true)
      i++
    } else {
      put(outB, B[j], true)
      j++
    }
  }
  for (; i < n; i++) put(outA, A[i], true)
  for (; j < m; j++) put(outB, B[j], true)
  return { a: outA, b: outB }
}
