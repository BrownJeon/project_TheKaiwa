import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-025b D9 의 문제 머리 시험(promptKo 한글 판정·일본어 폴백·안내 노트)은 «문제» 단계가 «조각» 으로 바뀌며 지웠다(task-081 §37-13 ⑥).
// 같은 task 의 종료 카드 링크 회귀 감시는 문제와 무관해 남긴다.

test('종료 카드 "오늘로" 링크: 스크롤 영역 안에서 찌그러지지 않게 shrink-0(390×780 에서 20px 로 줄던 결함)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/lesson/LessonEnd.tsx'), 'utf8')
  const m = /<Link href="\/study\/today" className="([^"]*)"/.exec(src)
  assert.ok(m, '"오늘로" 링크를 찾을 수 없다')
  const cls = m[1].split(/\s+/)
  assert.ok(cls.includes('h-11'), 'h-11 유지')
  assert.ok(cls.includes('shrink-0'), 'shrink-0 필요')
})
