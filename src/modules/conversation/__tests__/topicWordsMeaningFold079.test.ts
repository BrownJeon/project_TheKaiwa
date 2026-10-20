/**
 * task-079 2차 — A12 `meaningKo` 같은 뜻 반복 접기(LLM 호출 0, 오프라인).
 * v4 지시(IMP-0055)의 부작용: 한국어 뜻이 한자음과 같은 단어에서 «업무, 업무»·«동료, 동료»·«보고, 보고» 처럼 같은 낱말을 두 번 낸다(PE 측정 P09 입력에서 3개).
 * 규칙: 쉼표로 나눈 토큰이 앞에 나온 토큰과 앞뒤 공백을 뗀 문자열이 같으면 뒤쪽을 접는다. 첫 뜻·남는 토큰·순서는 그대로, 접을 것이 없으면 입력 문자열 그대로.
 * 접기 위치는 `assembleTopicWords` 가 `meaningKo` 를 읽는 줄 — ④ 문자·길이 검사와 ⑦ 뜻 중복 키가 화면에 나갈 문자열을 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assembleTopicWords, foldRepeatedMeanings } from '../prompts/topicWords'

const w = (textJa: string, reading: string, meaningKo: string, over: Record<string, unknown> = {}) => ({
  textJa, reading, meaningKo, chunkType: 'NAME', jlpt: null, valid: true, exampleJa: null, exampleKo: null, ...over,
})
const asm = (items: Array<ReturnType<typeof w>>, ctx: { exclude?: string[]; excludeMeanings?: string[] } = {}) => assembleTopicWords({ words: items }, { level: 'N3', ...ctx })

test('접기 대표 사례(사용자 결정): 業務 «업무, 업무» → 업무 · 同僚 «동료, 동료» → 동료 · 報告 «보고, 보고» → 보고', () => {
  for (const [dup, want] of [['업무, 업무', '업무'], ['동료, 동료', '동료'], ['보고, 보고', '보고']]) assert.equal(foldRepeatedMeanings(dup), want, dup)
  const r = asm([w('業務', 'ぎょうむ', '업무, 업무'), w('同僚', 'どうりょう', '동료, 동료'), w('報告', 'ほうこく', '보고, 보고')])
  assert.deepEqual(r.words.map((x) => x.meaningKo), ['업무', '동료', '보고'])
  // 항목을 버리지 않고 글만 고친다
  assert.equal(r.received, 3)
  assert.deepEqual(r.dropped, [])
  assert.deepEqual(r.droppedByReason, {})
})

test('접기 규칙: 3중 반복 · 떨어진 반복 · 공백 차이 · 남는 토큰의 글자와 순서는 그대로', () => {
  const rows: Array<[string, string]> = [
    ['업무, 업무, 업무', '업무'], // 3중
    ['업무,업무,업무,업무', '업무'],
    ['정식, 식사, 식사', '정식, 식사'], // 뒤쪽 반복
    ['정식, 식사, 정식', '정식, 식사'], // 첫 뜻이 뒤에서 되풀이
    ['정식, 식사, 정식, 식사, 한 끼', '정식, 식사, 한 끼'],
    ['b, a, b', 'b, a'], // 순서는 처음 나온 순서
    [' 업무 ,  업무 ', '업무'], // 앞뒤 공백은 같은 문자열로 본다
    ['한 끼 식사, 한 끼 식사', '한 끼 식사'], // 토큰 안쪽 공백은 그대로 비교
    ['정식,  식사,식사', '정식,  식사'], // 남는 토큰은 원문 그대로(구분 공백도 보존)
  ]
  for (const [input, want] of rows) assert.equal(foldRepeatedMeanings(input), want, input)
})

test('접을 것이 없으면 입력 그대로: 쉼표 없는 뜻 · 서로 다른 뜻 · 구분 공백이 달라도 한 글자도 안 바뀐다', () => {
  for (const same of ['업무', '정식, 한 끼 식사', '정식,한 끼 식사', ' 정식 , 식사 ', '영수증, 계산서, 청구서', '', '  ', '한 끼 식사, 한끼 식사']) {
    assert.equal(foldRepeatedMeanings(same), same, JSON.stringify(same))
  }
  // 빈 토큰은 비교 대상이 아니다 — 쉼표만 이어져도 만지지 않는다
  for (const odd of ['a,,b', 'a,,,b', ', 업무', '업무,', '업무,, 식사']) assert.equal(foldRepeatedMeanings(odd), odd, odd)
})

test('한 글자 차이는 접지 않는다 · 앞 토큰을 포함하거나 포함되는 토큰도 다른 뜻이다 · 공백만 다르면 같은 뜻', () => {
  for (const r of ['업무, 업모', '보고, 보고서', '보고서, 보고', '보고하다, 보고', '동료, 동료들', '정식, 정 식']) assert.equal(foldRepeatedMeanings(r), r, r)
  assert.equal(foldRepeatedMeanings('정식, 정식 '), '정식') // 끝 공백만 다름
  // 대소문자·전각 같은 정규화로 같아 보이는 것은 «같은 문자열» 이 아니므로 접지 않는다(⑦ 키가 따로 본다)
  assert.equal(foldRepeatedMeanings('Menu, menu'), 'Menu, menu')
})

test('assembleTopicWords: 서로 다른 뜻·쉼표 없는 뜻·정상 보조 뜻은 모양 그대로 · 출력 칸은 그대로', () => {
  const r = asm([w('定食', 'ていしょく', '정식, 한 끼 식사'), w('領収書', 'りょうしゅうしょ', '영수증'), w('予約', 'よやく', '예약,예매')])
  assert.deepEqual(r.words.map((x) => x.meaningKo), ['정식, 한 끼 식사', '영수증', '예약,예매'])
  assert.deepEqual(Object.keys(r.words[0]).sort(), ['chunkType', 'exampleJa', 'exampleKo', 'jlpt', 'meaningKo', 'reading', 'textJa'])
  assert.deepEqual(Object.keys(r).sort(), ['dropped', 'droppedByReason', 'exampleNulled', 'exampleNulledByReason', 'received', 'words'])
})

test('접기 뒤에도 ④ 문자 검사가 그대로 동작한다: 가나·한글 없음은 접어도 버려진다 · 보조 뜻 쪽의 가나도 그대로 걸린다', () => {
  assert.deepEqual(asm([w('宿題', 'しゅくだい', 'ありがとう, ありがとう')]).droppedByReason, { MEANING_CHARS: 1 }) // 접어도 가나
  assert.deepEqual(asm([w('宿題', 'しゅくだい', 'homework, homework')]).droppedByReason, { MEANING_CHARS: 1 }) // 접어도 한글 없음
  assert.deepEqual(asm([w('宿題', 'しゅくだい', '숙제, ありがとう')]).droppedByReason, { MEANING_CHARS: 1 }) // 접을 게 없고 둘째가 가나
  assert.deepEqual(asm([w('宿題', 'しゅくだい', ',  ,')]).droppedByReason, { MEANING_CHARS: 1 }) // 한글 없음
  assert.equal(asm([w('宿題', 'しゅくだい', '숙제, 숙제')]).words[0].meaningKo, '숙제')
})

test('접기 뒤에도 ⑦ 뜻 중복 키가 정상 동작한다: 접은 뜻으로 앞 항목·기본 표현과 비교 · 접기 전 키(업무업무)로는 새던 중복이 잡힌다', () => {
  // 기본 표현의 뜻이 «업무» 인데 AI 가 «업무, 업무» 를 내면 같은 뜻이다
  assert.deepEqual(asm([w('業務', 'ぎょうむ', '업무, 업무')], { excludeMeanings: ['업무'] }).droppedByReason, { DUP_MEANING: 1 })
  // 앞 항목의 뜻과 접은 뒤 같은 뜻
  const seq = asm([w('仕事', 'しごと', '업무'), w('業務', 'ぎょうむ', '업무, 업무')])
  assert.deepEqual(seq.words.map((x) => x.textJa), ['仕事'])
  assert.deepEqual(seq.dropped, [{ textJa: '業務', reason: 'DUP_MEANING' }])
  // 뜻 두 개짜리의 반복도 접은 뒤 키가 같다
  const two = asm([w('定食', 'ていしょく', '정식, 식사'), w('食事', 'しょくじ', '정식, 식사, 정식')])
  assert.deepEqual(two.dropped, [{ textJa: '食事', reason: 'DUP_MEANING' }])
  // 접어도 서로 다른 뜻이면 둘 다 통과
  const ok = asm([w('仕事', 'しごと', '일'), w('業務', 'ぎょうむ', '업무, 업무')])
  assert.deepEqual(ok.words.map((x) => x.meaningKo), ['일', '업무'])
  // 접기와 무관한 ⑦(공백·부호를 뗀 키)은 그대로: «정식, 식사» ↔ «정식식사»
  assert.deepEqual(asm([w('定食', 'ていしょく', '정식, 식사'), w('食事', 'しょくじ', '정식식사')]).droppedByReason, { DUP_MEANING: 1 })
})

test('접기는 다른 계측을 건드리지 않는다: exampleNulled 위치·표기 중복·읽기 정규화는 접기 항목에서도 같다', () => {
  const bad = asm([
    w('業務', 'ぎょうむ', '업무, 업무', { exampleJa: '', exampleKo: '' }), // 예문 비어 있음 → 단어는 남고 예문만 null
    w('報告', 'ほうこく', '보고, 보고', { exampleJa: '報告します。', exampleKo: '보고해요.' }),
    w('コーヒー', 'こーひー', '커피, 커피', { exampleJa: 'コーヒーをください。', exampleKo: '커피 주세요.' }), // 접기 + 가타카나 읽기 정규화가 함께
  ])
  assert.deepEqual(bad.words.map((x) => [x.textJa, x.meaningKo, x.reading]), [['業務', '업무', 'ぎょうむ'], ['報告', '보고', 'ほうこく'], ['コーヒー', '커피', 'コーヒー']])
  assert.equal(bad.exampleNulled, 1)
  assert.deepEqual(bad.exampleNulledByReason, { EXAMPLE_MISSING: 1 })
  assert.equal(bad.words[1].exampleJa, '報告します。')
  // 같은 표기는 접기와 상관없이 DUP_RESPONSE
  assert.deepEqual(asm([w('業務', 'ぎょうむ', '업무, 업무'), w('業務', 'ぎょうむ', '직무')]).droppedByReason, { DUP_RESPONSE: 1 })
})

test('기본 사전 시드 뜻 7,755개에는 접기가 걸리지 않는다(2,366개는 쉼표 뜻) — 정상 뜻을 건드리지 않는다는 코퍼스 증거', () => {
  const dir = join(process.cwd(), 'prisma/seed-data/jlpt')
  const all = ['n5', 'n4', 'n3', 'n2', 'n1'].flatMap((n) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8')) as Array<{ surface: string; meaning: string }>)
  assert.ok(all.length >= 7755, `시드 ${all.length}개`)
  const multi = all.filter((s) => s.meaning.includes(','))
  assert.ok(multi.length >= 2000, `쉼표 뜻 ${multi.length}개 — 시험이 헛통과하지 않으려면 쉼표 뜻이 충분히 있어야 한다`)
  const changed = all.filter((s) => foldRepeatedMeanings(s.meaning) !== s.meaning).map((s) => `${s.surface}: ${s.meaning}`)
  assert.deepEqual(changed, [])
})
