import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SEED_PACK_COUNT, SEED_PACKS } from '@/types/seedPack'
import DataCreditRow, { DATA_CREDIT, DataCreditBody } from '../DataCreditRow'

const LEAK = /claude|haiku|sonnet|opus|qwen|gemini|gpt|엔진|모델|trace/i

test('출처 시트: 합계는 SEED_PACK_COUNT 다섯 값의 합(천 단위 쉼표), Tatoeba·N1 옛 이름·엔진 이름 없음', () => {
  const total = SEED_PACKS.reduce((s, p) => s + SEED_PACK_COUNT[p], 0)
  const body = renderToStaticMarkup(createElement(DataCreditBody, { onClose: () => {} }))
  assert.ok(body.includes(`<b class="font-semibold">${total.toLocaleString('ko-KR')}</b>`))
  assert.ok(body.includes('<b class="font-semibold">OpenJLPT</b>'))
  assert.doesNotMatch(body, /Tatoeba|원어민|7,811/i)
  assert.doesNotMatch(body, LEAK)
  for (const s of DATA_CREDIT.sources) assert.ok(body.includes(s.at) && body.includes(s.name))
  assert.equal(DATA_CREDIT.sources.length, 3)
  assert.ok(body.includes(DATA_CREDIT.licenseAt) && body.includes(DATA_CREDIT.notOfficial) && body.includes(DATA_CREDIT.aiNote))
  // 주소는 글자만 — 링크로 만들지 않는다.
  assert.ok(!body.includes('<a ') && !body.includes('href='))
})

test('출처 줄: 대화상자를 여는 버튼 하나, 56px, 두 줄 글자, 닫힌 시트는 그리지 않는다', () => {
  const row = renderToStaticMarkup(createElement(DataCreditRow))
  assert.ok(row.includes('aria-haspopup="dialog"') && row.includes('min-h-[56px]'))
  assert.ok(row.includes(DATA_CREDIT.title) && row.includes(DATA_CREDIT.rowSub))
  assert.ok(!row.includes('role="dialog"'))
  assert.doesNotMatch(row, LEAK)
})
