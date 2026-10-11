import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-059 QA 결함 #1(360×740 주제 세트 + 알림 + 객관식으로 답한 뒤): 무대가 카드 하한보다 작아지면 카드가 `items-center` 로
// 위아래로 넘쳐 알림·듣기 줄을 덮는다. 무대 하한 = 카드 하한 + 위아래 패딩이어야 넘친 높이가 `main` 스크롤로 간다.

const read = (f: string) => readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')

function px(cls: string, prefix: 'min-h' | 'max-h'): number | null {
  const m = cls.match(new RegExp(`(?:^|\\s)${prefix}-\\[(\\d+(?:\\.\\d+)?)px\\](?=\\s|$)`))
  return m ? Number(m[1]) : null
}

/** Tailwind 간격 1 = 4px(`--spacing: 0.25rem`). `py-N` 하나만 본다 — `pt-`/`pb-` 로 나뉘면 이 시험부터 고친다. */
function padY(cls: string): number | null {
  const m = cls.match(/(?:^|\s)py-(\d+(?:\.\d+)?)(?=\s|$)/)
  return m ? Number(m[1]) * 4 : null
}

function cardClass(): string {
  const src = read('SwipeCardStack.tsx')
  const root = src.slice(src.indexOf('role="group"'), src.indexOf('style={{ touchAction'))
  const m = root.match(/className="([^"]+)"/)
  assert.ok(m, 'SwipeCardStack 바깥 상자 className')
  return m[1]
}

function stageClass(): string {
  const src = read('VocabDeck.tsx')
  const at = src.indexOf('<SwipeCardStack')
  const open = src.lastIndexOf('className="', at)
  assert.ok(at > 0 && open > 0, '카드 무대(<SwipeCardStack> 를 감싼 div)')
  return src.slice(open + 'className="'.length, src.indexOf('"', open + 'className="'.length))
}

function sizes() {
  const card = cardClass()
  const stage = stageClass()
  const cardMin = px(card, 'min-h')
  const cardMax = px(card, 'max-h')
  const stageMin = px(stage, 'min-h')
  const pad = padY(stage)
  assert.ok(cardMin !== null && cardMax !== null, `카드 하한·상한 클래스: ${card}`)
  assert.ok(pad !== null, `무대 위아래 패딩 클래스: ${stage}`)
  return { card, stage, cardMin, cardMax, stageMin, pad }
}

test('덱 높이: 카드 크기 상한·하한은 그대로(200~340, §23-10 B)', () => {
  const { cardMin, cardMax } = sizes()
  assert.equal(cardMin, 200)
  assert.equal(cardMax, 340)
})

test('덱 높이: 무대 하한 = 카드 하한 + 위아래 패딩 — 무대 안쪽이 카드 하한보다 작아지지 않는다(결함 #1)', () => {
  const { stage, cardMin, stageMin, pad } = sizes()
  assert.doesNotMatch(stage, /(?:^|\s)min-h-0(?=\s|$)/, '무대에 min-h-0 이 있으면 카드가 이웃을 덮는다')
  assert.ok(stageMin !== null, `무대 min-h-[Npx] 가 있어야 한다: ${stage}`)
  // 같음까지 묶는다 — 더 크면 넘치지 않던 조합(390×800·412×892 등)까지 `main` 스크롤이 생긴다.
  assert.equal(stageMin, cardMin + 2 * pad, `무대 하한 ${stageMin} ≠ 카드 하한 ${cardMin} + 패딩 ${pad}×2`)
  assert.match(stage, /(?:^|\s)flex-1(?=\s|$)/, '무대는 남는 높이를 채운다(flex-1)')
  assert.match(stage, /(?:^|\s)items-center(?=\s|$)/)
})

// QA β1 실측(무대 바깥 높이 = 덱이 무대에 남겨 준 높이, px) → 고친 뒤 계산. 카드 = clamp(무대 안쪽, 하한, 상한).
const QA_STAGE_OUTER: { name: string; outer: number; card: number }[] = [
  { name: '360×740 주제+fewer 알림+객관식 답한 뒤(결함 #1)', outer: 155.8 + 24, card: 200 },
  { name: '412×780 주제+fewer 알림+객관식 답한 뒤', outer: 195.8 + 24, card: 200 },
  { name: '390×800 주제+fewer 알림+객관식 답한 뒤', outer: 215.8 + 24, card: 215.8 },
  { name: '360×740 이전 4지선다+few 알림 답한 뒤', outer: 180.5 + 24, card: 200 },
  { name: '360×740 객관식 답한 뒤(알림 없음)', outer: 243.5 + 24, card: 243.5 },
  { name: '390×800 객관식 답한 뒤(알림 없음)', outer: 303.5 + 24, card: 303.5 },
  { name: '412×780 객관식 답한 뒤(알림 없음)', outer: 283.5 + 24, card: 283.5 },
  { name: '360×740 보기 열림', outer: 287.5 + 24, card: 287.5 },
  { name: '412×780 보기 열림', outer: 327.5 + 24, card: 327.5 },
  { name: '앞면(상한)', outer: 340 + 24 + 40, card: 340 },
]

test('덱 높이: QA 실측 조합 — 카드는 무대 안쪽을 넘지 않고, 카드 높이는 그대로', () => {
  const { cardMin, cardMax, stageMin, pad } = sizes()
  assert.ok(stageMin !== null)
  for (const s of QA_STAGE_OUTER) {
    const outer = Math.max(s.outer, stageMin)
    const inner = outer - 2 * pad
    const card = Math.min(cardMax, Math.max(cardMin, inner))
    assert.ok(card <= inner + 1e-9, `${s.name}: 카드 ${card} > 무대 안쪽 ${inner}`)
    assert.equal(Math.round(card * 10) / 10, s.card, `${s.name}: 카드 높이가 바뀜`)
  }
})
