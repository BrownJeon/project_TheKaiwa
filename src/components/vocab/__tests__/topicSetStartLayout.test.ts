import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 360px 에서 BtnRow 반폭 버튼의 라벨("내 단어장으로 풀기")이 어절 한가운데("풀 / 기")에서 끊겼다(qa-p2a 044 #2).
// 호출 쪽 className 의 `break-keep`(word-break: keep-all)만으로 어절 경계에서만 끊기게 한다 — 공용 Btn·BtnRow 는 고치지 않는다.
const src = readFileSync(join(process.cwd(), 'src/components/vocab/TopicSetStart.tsx'), 'utf8')

test('대기 화면 BtnRow 3곳의 버튼·링크는 모두 break-keep — 어절 단위 줄바꿈', () => {
  const rows = [...src.matchAll(/<BtnRow>([\s\S]*?)<\/BtnRow>/g)].map((m) => m[1])
  assert.equal(rows.length, 3, 'busy409 포기 · 오류 · 비어 있음')
  const tags = rows.flatMap((row) => [...row.matchAll(/<(?:Btn|Link)\b[^>]*>/g)].map((m) => m[0]))
  assert.equal(tags.length, 4, '다시 시도 2 + 내 단어장 1 + 오늘로 1')
  for (const tag of tags) assert.ok(/\bbreak-keep\b/.test(tag), `${tag} — break-keep 없음`)
})

test('skipBtn(주제 표현으로 바로 풀기)은 전폭·반폭 두 모양 모두 break-keep', () => {
  const m = /className=\{full \? '([^']*)' : '([^']*)'\}/.exec(src)
  assert.ok(m, 'skipBtn className 분기')
  assert.ok(/\bbreak-keep\b/.test(m[1]) && /\bbreak-keep\b/.test(m[2]), `${m[1]} / ${m[2]}`)
})
