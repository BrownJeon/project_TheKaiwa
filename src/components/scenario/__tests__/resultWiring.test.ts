import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (s: string, needle: string) => s.split(needle).length - 1

test('수업 종료 카드 자리(§3-I): 주제 있는 새 수업 분기 안 — 다음 수업 카드 아래·[이어서 말하기] 위, 복습·붙여넣기 분기에는 없음', () => {
  const src = read('src/components/lesson/LessonEnd.tsx')
  assert.equal(count(src, '<LessonScenarioCard'), 1)
  const review = src.indexOf('{isReview ? (')
  const topic = src.indexOf(') : topic ? (')
  const nextLesson = src.lastIndexOf('END.nextLesson}')
  const card = src.indexOf('<LessonScenarioCard lesson={lesson} />')
  const talk = src.indexOf('{END.talk}')
  const pasted = src.indexOf('{END.otherText}')
  assert.ok(review >= 0 && topic > review, '복습 분기가 먼저')
  assert.ok(topic < nextLesson && nextLesson < card, '다음 수업 카드 아래')
  assert.ok(card < talk, '[이어서 말하기] 위')
  assert.ok(talk < pasted, '붙여넣은 수업 분기 앞(그 분기에는 없음)')
})

test('회화 목록 뱃지(§3-J): 답하는 중이 먼저, 그다음 역할극, 그다음 점검 완료', () => {
  const src = read('src/components/chat/ChatListItem.tsx')
  const running = src.indexOf('{chat.running ? (')
  const rp = src.indexOf(') : rp ? (')
  const reviewed = src.indexOf(') : chat.reviewedAt ? (')
  assert.ok(running >= 0 && running < rp && rp < reviewed)
  assert.match(src, /const status = chat\.running \? '답하는 중' : rp \?/)
})
