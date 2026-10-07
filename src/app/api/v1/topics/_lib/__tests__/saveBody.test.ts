/**
 * task-045 T2 — #57·#171 저장 본문 검사(`saveBody.ts`). 한도 경계 · 이모지 허용(REV-148 L-8) · 꺾쇠·URL·비밀·숨은 문자 거절 · 표현 규칙(초안과 같은 함수) · 중복.
 * 보이지 않는 문자는 `String.fromCodePoint` 로 만든다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOPIC_DRAFT_LIMITS } from '@/modules/conversation'
import { TOPIC_SAVE_LIMITS } from '@/types/topicWrite'
import { parseTopicCreateBody, parseTopicUpdateBody, topicSaveWarnings } from '../saveBody'

const cp = (...c: number[]) => String.fromCodePoint(...c)
const ROWS: Array<[string, string, string, string]> = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'], ['NAME', '受付', 'うけつけ', '접수'],
  ['ACTION', '待ちます', 'まちます', '기다려요'], ['ACTION', '呼びます', 'よびます', '불러요'], ['ACTION', '飲みます', 'のみます', '마셔요'], ['ACTION', '休みます', 'やすみます', '쉬어요'],
  ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['FEELING', '眠いです', 'ねむいです', '졸려요'], ['FEELING', '大変です', 'たいへんです', '힘들어요'],
  ['MODIFIER', '少し', 'すこし', '조금'], ['MODIFIER', '毎日', 'まいにち', '매일'], ['MODIFIER', '右に', 'みぎに', '오른쪽으로'], ['MODIFIER', '早く', 'はやく', '빨리'],
  ['NAME', '番号', 'ばんごう', '번호'], ['NAME', '保険証', 'ほけんしょう', '보험증'], ['ACTION', '払います', 'はらいます', '내요'], ['MODIFIER', '後で', 'あとで', '나중에'],
  ['NAME', '熱', 'ねつ', '열'],
]
const chunks = (n = 12) => ROWS.slice(0, n).map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo }))
const body = (o: Record<string, unknown> = {}) => ({ title: '병원 진료', titleJa: '病院で診察', level: 'N5', description: '병원에서 증상을 말해요.', chunks: chunks(), ...o })

function fails(fn: () => unknown, field: string, reason: string): void {
  try {
    fn()
  } catch (e) {
    const d = (e as { code?: string; details?: { field?: string; reason?: string } })
    assert.equal(d.code, 'VALIDATION')
    assert.deepEqual([d.details?.field, d.details?.reason], [field, reason])
    return
  }
  assert.fail(`expected 400 ${field} ${reason}`)
}

test('한도 = AI 초안 계약(TOPIC_DRAFT_LIMITS) — 어긋나면 이 시험이 잡는다', () => {
  const L = TOPIC_DRAFT_LIMITS
  assert.deepEqual(
    [TOPIC_SAVE_LIMITS.titleMax, TOPIC_SAVE_LIMITS.titleJaMax, TOPIC_SAVE_LIMITS.descriptionMax, TOPIC_SAVE_LIMITS.textJaMax, TOPIC_SAVE_LIMITS.readingMax, TOPIC_SAVE_LIMITS.meaningMax, TOPIC_SAVE_LIMITS.chunksMin],
    [L.titleMax, L.titleJaMax, L.descriptionMax, L.textJaMax, L.readingMax, L.meaningMax, L.chunksMin],
  )
  assert.equal(TOPIC_SAVE_LIMITS.chunksMax, 20)
})

test('#57 정상: 정리된 값(줄바꿈 접기·앞뒤 공백·뜻 쉼표) · 빈 일본어 제목·설명은 null · 안내 코드', () => {
  const v = parseTopicCreateBody(body({ title: '  병원 진료 ', titleJa: '', description: '병원에서\n증상을 말해요.', chunks: chunks(9).map((c, i) => (i === 0 ? { ...c, meaningKo: '병원 ,의원' } : c)) }))
  assert.equal(v.title, '병원 진료')
  assert.equal(v.titleJa, null)
  assert.equal(v.description, '병원에서 증상을 말해요.')
  assert.equal(v.chunks[0].meaningKo, '병원, 의원')
  assert.deepEqual(topicSaveWarnings(v), ['CHUNKS_SHORT', 'TYPE_THIN_FEELING', 'TYPE_THIN_MODIFIER', 'TITLE_JA_MISSING'])
  assert.equal(parseTopicCreateBody(body({ titleJa: null, description: null })).description, null)
})

test('#57 경계: 제목 20/21 · 일본어 제목 20/21·한글·가나 없음 · 설명 120/121 · 표현 7/8/20/21 · 수준', () => {
  parseTopicCreateBody(body({ title: '가'.repeat(20) }))
  fails(() => parseTopicCreateBody(body({ title: '가'.repeat(21) })), 'title', 'max_length')
  fails(() => parseTopicCreateBody(body({ title: '  ' })), 'title', 'required')
  fails(() => parseTopicCreateBody(body({ title: undefined })), 'title', 'required')
  fails(() => parseTopicCreateBody(body({ title: 3 })), 'title', 'type')
  parseTopicCreateBody(body({ titleJa: 'あ'.repeat(20) }))
  fails(() => parseTopicCreateBody(body({ titleJa: 'あ'.repeat(21) })), 'titleJa', 'max_length')
  fails(() => parseTopicCreateBody(body({ titleJa: '病院 진료' })), 'titleJa', 'not_japanese')
  fails(() => parseTopicCreateBody(body({ titleJa: 'Hospital' })), 'titleJa', 'not_japanese')
  parseTopicCreateBody(body({ description: '가'.repeat(120) }))
  fails(() => parseTopicCreateBody(body({ description: '가'.repeat(121) })), 'description', 'max_length')
  fails(() => parseTopicCreateBody(body({ chunks: chunks(7) })), 'chunks', 'count')
  parseTopicCreateBody(body({ chunks: chunks(8) }))
  parseTopicCreateBody(body({ chunks: chunks(20) }))
  fails(() => parseTopicCreateBody(body({ chunks: chunks(21) })), 'chunks', 'count')
  fails(() => parseTopicCreateBody(body({ chunks: undefined })), 'chunks', 'required')
  fails(() => parseTopicCreateBody(body({ level: 'N0' })), 'level', 'enum')
  fails(() => parseTopicCreateBody(body({ tags: ['x'] })), 'tags', 'unknown_key')
})

test('#57 학습자 글(제목·설명): 이모지 VS16·ZWJ 허용 · 꺾쇠·URL·비밀 모양·숨은 문자 400(조용히 지우지 않음)', () => {
  const VS16 = cp(0xfe0f)
  const ZWJ = cp(0x200d)
  assert.equal(parseTopicCreateBody(body({ title: `여행 ✈${VS16}` })).title, `여행 ✈${VS16}`)
  assert.equal(parseTopicCreateBody(body({ description: `요리 👩${ZWJ}🍳 이야기를 해요.` })).description, `요리 👩${ZWJ}🍳 이야기를 해요.`)
  fails(() => parseTopicCreateBody(body({ title: '<b>병원' })), 'title', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ title: 'a->b' })), 'title', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ description: '여기 https://evil.example 보세요' })), 'description', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ description: 'password=hunter2hunter2' })), 'description', 'secret_like')
  fails(() => parseTopicCreateBody(body({ title: `병${cp(0x200b)}원` })), 'title', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ title: `병${ZWJ}원` })), 'title', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ titleJa: `病院${cp(0x202e)}` })), 'titleJa', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ title: '!!!' })), 'title', 'no_text')
})

test('#57 표현: 초안과 같은 규칙(checkTopicChunkFields) — 칸 위치·이유 · 중복 표기·뜻 · id 는 만들기에서 금지', () => {
  const at = (i: number, o: Record<string, unknown>) => chunks().map((c, j) => (j === i ? { ...c, ...o } : c))
  fails(() => parseTopicCreateBody(body({ chunks: at(4, { reading: 'まちまし' }) })), 'chunks[4].reading', 'reading')
  fails(() => parseTopicCreateBody(body({ chunks: at(2, { reading: '医者' }) })), 'chunks[2].reading', 'chars')
  fails(() => parseTopicCreateBody(body({ chunks: at(2, { reading: '' }) })), 'chunks[2].reading', 'required')
  fails(() => parseTopicCreateBody(body({ chunks: at(1, { textJa: '薬(くすり)' }) })), 'chunks[1].textJa', 'chars')
  fails(() => parseTopicCreateBody(body({ chunks: at(1, { textJa: 'あ'.repeat(21), reading: 'あ'.repeat(21) }) })), 'chunks[1].textJa', 'max_length')
  fails(() => parseTopicCreateBody(body({ chunks: at(3, { meaningKo: 'くすり' }) })), 'chunks[3].meaningKo', 'chars')
  fails(() => parseTopicCreateBody(body({ chunks: at(3, { meaningKo: '<i>약</i>' }) })), 'chunks[3].meaningKo', 'forbidden_char')
  fails(() => parseTopicCreateBody(body({ chunks: at(3, { chunkType: 'VERB' }) })), 'chunks[3].chunkType', 'enum')
  fails(() => parseTopicCreateBody(body({ chunks: at(5, { textJa: '病院', reading: 'びょういん' }) })), 'chunks[5].textJa', 'duplicate')
  fails(() => parseTopicCreateBody(body({ chunks: at(5, { meaningKo: '병원' }) })), 'chunks[5].meaningKo', 'duplicate')
  fails(() => parseTopicCreateBody(body({ chunks: at(0, { id: 'c1' }) })), 'chunks[0].id', 'unknown_key')
})

test('#171 본문: 보낸 칸만 · 빈 본문 400 empty · 표현 id 허용(형식 검사) · 설명 null 은 지우기', () => {
  fails(() => parseTopicUpdateBody({}), 'body', 'empty')
  assert.deepEqual(parseTopicUpdateBody({ title: '새 이름' }), { title: '새 이름' })
  assert.deepEqual(parseTopicUpdateBody({ description: null }), { description: null })
  const v = parseTopicUpdateBody({ chunks: chunks(8).map((c, i) => (i < 2 ? { ...c, id: `c${i}` } : c)) })
  assert.deepEqual(v.chunks!.slice(0, 3).map((c) => c.id), ['c0', 'c1', undefined])
  fails(() => parseTopicUpdateBody({ chunks: chunks(8).map((c, i) => (i === 0 ? { ...c, id: 5 } : c)) }), 'chunks[0].id', 'id')
  fails(() => parseTopicUpdateBody({ title: '가'.repeat(21) }), 'title', 'max_length')
  fails(() => parseTopicUpdateBody({ chunks: chunks(7) }), 'chunks', 'count')
})
