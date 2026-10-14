/**
 * task-068 S-B2 시험 공용 — 세트·평가·메모·복습 시험의 기존 가짜 DB 에 「내 단어 + 기본 단어 · 나의 UserWordState」를 끼운다.
 * `visibleWordWhere`·`activeWordWhere`(AND·OR·`states.none/some`)와 learning 이 쓰는 스칼라 조건(`in`·`not`·값)만 해석하고,
 * 모르는 키·연산은 던진다(시험이 조용히 통과하지 않게). 단어장 전용 가짜 DB 는 S-B1 의 `wordFakeDb.ts`.
 */
type Row = Record<string, unknown>

function matchScalar(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null
  if (typeof cond !== 'object') return value === cond
  for (const [op, arg] of Object.entries(cond as Row)) {
    if (op === 'in') { if (!(arg as unknown[]).includes(value)) return false } else if (op === 'not') { if (matchScalar(value, arg)) return false } else throw new Error(`fake where: 모르는 연산 ${op}`)
  }
  return true
}

/** `states` = 단어 관계 `states`(UserWordState) 를 판정할 때 보는 행들. */
export function matchWhere(row: Row, where: Row | undefined, states: readonly Row[] = []): boolean {
  if (!where) return true
  for (const [k, cond] of Object.entries(where)) {
    if (cond === undefined) continue
    if (k === 'AND') { if (!(cond as Row[]).every((w) => matchWhere(row, w, states))) return false; continue }
    if (k === 'OR') { if (!(cond as Row[]).some((w) => matchWhere(row, w, states))) return false; continue }
    if (k === 'states') {
      const c = cond as { some?: Row; none?: Row }
      const mine = states.filter((s) => s.wordId === row.id)
      if (c.none && mine.some((s) => matchWhere(s, c.none))) return false
      if (c.some && !mine.some((s) => matchWhere(s, c.some))) return false
      if (!c.none && !c.some) throw new Error('fake where: states 조건')
      continue
    }
    if (!(k in row)) throw new Error(`fake where: 모르는 칸 ${k}`)
    if (!matchScalar(row[k], cond)) return false
  }
  return true
}

export function stateRow(userId: string, wordId: string, over: Row = {}): Row {
  return { userId, wordId, correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null, ...over }
}

function pick(row: Row, select?: Row): Row {
  if (!select) return { ...row }
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]))
}

/**
 * 가짜 `userWordState` 면 — `bumpWordStates`·`loadWordStates`·`loadActiveWordStates` 가 쓰는 findMany·createMany(skipDuplicates)·updateMany(increment).
 * `ops` 에 호출을 남긴다(시험이 「공용 행이 아니라 상태 행에 썼다」를 확인).
 */
export function fakeUserWordState(db: { states: Row[]; words: Row[] }, ops: string[] = []) {
  return {
    findMany: async ({ where, select }: { where?: Row; select?: Row }) => (ops.push('state:findMany'), db.states.filter((s) => matchWhere(s, where)).map((s) => pick(s, select))),
    createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
      ops.push('state:createMany')
      let count = 0
      for (const d of data) {
        if (db.states.some((s) => s.userId === d.userId && s.wordId === d.wordId)) {
          if (!skipDuplicates) throw new Error('unique violation')
          continue
        }
        if (!db.words.some((w) => w.id === d.wordId)) throw new Error('fk violation')
        db.states.push(stateRow(d.userId as string, d.wordId as string, d))
        count += 1
      }
      return { count }
    },
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      ops.push('state:updateMany')
      const hit = db.states.filter((s) => matchWhere(s, where))
      for (const s of hit) for (const [k, v] of Object.entries(data)) s[k] = v && typeof v === 'object' && 'increment' in v ? (s[k] as number) + (v as { increment: number }).increment : v
      return { count: hit.length }
    },
  }
}
