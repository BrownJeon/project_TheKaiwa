/**
 * 후보 → 외부 전송 항목. 상한 적용 순서(계약 5항, 시험으로 고정):
 *   1) 함수별 목록을 의도의 함수 순서대로 한 칸씩 번갈아 합친다(`interleave` — 각 함수의 첫 항목 = 집계가 먼저 온다).
 *   2) 같은 실제 행(`type:id`)은 처음 것만(집계 `id=null` 은 중복 판단 안 함).
 *   3) 항목 글 ≤300자는 각 함수가 이미 적용(넘친 꼬리를 `…` 로 자름 — `cut`).
 *   4) 앞에서부터 담되 건수 20 에 닿으면 멈추고, 총 글자(`text`+`label` 코드포인트 합) 2,000 을 넘기는 항목은 **건너뛰고** 다음 항목을 본다
 *      (작은 뒤 항목이 남은 자리를 쓴다 — 순서는 그대로).
 *   5) 남은 항목에 `S1`…`Sn` 을 순서대로 붙인다.
 * `truncated` = 2)를 뺀 이유로 빠진 후보가 있거나 3)에서 잘린 글이 실렸을 때.
 */
import { codePointLength } from '@/modules/infra'
import { interleave, type Candidate } from './sources'
import { RECORD_RETRIEVAL_LIMITS, type ExternalRecordItem, type RecordSourceRef } from './types'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export interface Assembled {
  items: ExternalRecordItem[]
  sourceMap: Record<string, RecordSourceRef>
  truncated: boolean
}

export function assemble(lists: readonly (readonly Candidate[])[]): Assembled {
  const seen = new Set<string>()
  const picked: Candidate[] = []
  let total = 0
  let truncated = false
  for (const c of interleave(lists)) {
    if (!c.text || !DATE.test(c.dateKst)) continue
    if (c.id !== null) {
      const k = `${c.type}:${c.id}`
      if (seen.has(k)) continue
      seen.add(k)
    }
    if (picked.length >= RECORD_RETRIEVAL_LIMITS.items) {
      truncated = true
      break
    }
    const size = codePointLength(c.text) + codePointLength(c.label)
    if (total + size > RECORD_RETRIEVAL_LIMITS.totalChars) {
      truncated = true
      continue
    }
    if (c.cut) truncated = true
    picked.push(c)
    total += size
  }
  const items: ExternalRecordItem[] = []
  const sourceMap: Record<string, RecordSourceRef> = Object.create(null) as Record<string, RecordSourceRef>
  picked.forEach((c, i) => {
    const key = `S${i + 1}`
    // 허용 칸만 골라 새 객체로 — 후보의 다른 칸(id·fn·cut)은 외부 항목에 섞이지 않는다.
    items.push({ key, type: c.type, dateKst: c.dateKst, text: c.text, label: c.label })
    sourceMap[key] = { type: c.type, id: c.id, date: c.dateKst, label: c.label }
  })
  return { items, sourceMap, truncated }
}
