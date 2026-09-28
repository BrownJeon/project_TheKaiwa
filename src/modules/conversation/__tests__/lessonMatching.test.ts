/**
 * `structuredResponse/matching.ts` 동치성 고정(2026-09-28 Leader 3차 결정) — conversation 은 서버
 * `learning/lessons/matching.ts` 를 import 하지 않는다(module-dependency §3-1, eslint 로도 막힘). 대신 같은
 * 정규식을 옆에 그대로 복사해 썼다(`normalizeForLessonMatch`/`kataToHira`). 이 파일의 골든 케이스는 서버 쪽
 * `learning/__tests__/task010.test.ts` 가 `normalizeForMatch`/`kataToHira` 에 대해 이미 검증한 것과 **같은
 * 입력·같은 기대값**이다 — 두 파일 중 하나가 정규식을 바꾸면 그 반대쪽도 같이 바꿔야 하고, 이 골든 케이스가
 * 어긋나면(둘 중 하나만 고쳐졌다는) 신호다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkAppearsIn, normalizeForLessonMatch } from '../structuredResponse/matching'

test('kataToHira/normalizeForLessonMatch 골든 케이스 — 서버 learning/__tests__/task010.test.ts 의 kataToHira·normalizeForMatch 테스트와 같은 입출력', () => {
  // 서버: assert.equal(kataToHira('コーヒー'), 'こーひー') — kataToHira 는 직접 export 하지 않으므로 normalizeForLessonMatch 로 관찰한다.
  assert.equal(normalizeForLessonMatch('コーヒー'), 'こーひー')
  // 서버: assert.equal(normalizeForMatch(' ｺｰﾋｰ を、ください。 '), 'こーひーをください') — 반각 가타카나(NFKC 로 전각화) 포함.
  assert.equal(normalizeForLessonMatch(' ｺｰﾋｰ を、ください。 '), 'こーひーをください')
  // 서버: assert.equal(normalizeForMatch('〜てください！'), 'てください')
  assert.equal(normalizeForLessonMatch('〜てください！'), 'てください')
})

test('normalizeForLessonMatch: 공백·구두점 제거, 대소문자 무시(로마자), 장음 ー 는 남긴다, 한자는 안 바꾼다', () => {
  // kataToHira 는 가타카나만 히라가나로 바꾼다 — 願 같은 한자는 그대로 남는다(한자→읽기 변환이 아니다).
  assert.equal(normalizeForLessonMatch('コーヒー、お願いします。'), 'こーひーお願いします')
  assert.equal(normalizeForLessonMatch('  カフェ  ラテ  '), 'かふぇらて')
  assert.equal(normalizeForLessonMatch('Coffee'), 'coffee')
  assert.equal(normalizeForLessonMatch(''), '')
})

test('chunkAppearsIn: textJa 가 그대로 담기면 true(외래어 가타카나)', () => {
  const chunk = { textJa: 'コーヒー', reading: 'こーひー' }
  assert.equal(chunkAppearsIn('コーヒーをお願いします。', chunk), true)
})

test('chunkAppearsIn: reading(히라가나)만 담겨도 true — textJa 가 가타카나라도 답이 히라가나로 적었으면 인정', () => {
  const chunk = { textJa: 'コーヒー', reading: 'こーひー' }
  assert.equal(chunkAppearsIn('こーひーが好きです。', chunk), true)
})

test('chunkAppearsIn: 어느 쪽도 없으면 false', () => {
  const chunk = { textJa: 'コーヒー', reading: 'こーひー' }
  assert.equal(chunkAppearsIn('紅茶をお願いします。', chunk), false)
})

test('chunkAppearsIn: 구두점·공백이 섞여 있어도 정규화 뒤 비교한다', () => {
  const chunk = { textJa: '会社員', reading: 'かいしゃいん' }
  assert.equal(chunkAppearsIn('わたしは、会社員です。', chunk), true)
})

test('chunkAppearsIn: 빈 모범 답은 항상 false', () => {
  const chunk = { textJa: '会社員', reading: 'かいしゃいん' }
  assert.equal(chunkAppearsIn('', chunk), false)
})
