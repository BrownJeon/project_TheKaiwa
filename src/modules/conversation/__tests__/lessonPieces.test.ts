/**
 * task-081 PE — 조각(pieces) 결정적 검증·정리(`structuredResponse/lessonPieces.ts`) 시험. DB·LLM 없음.
 * 기대값은 `tests/prompts/fixtures/lesson-pieces-cases.json`(좋은 줄 26·나쁜 줄 26 — 파이썬 독립 구현으로 만든 정리 결과). learning 쪽에 방어용 복사본을 두면 같은 파일을 같은 시험으로 돌려 묶는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PIECES_VIOLATION_REASONS,
  applyLessonPieces,
  checkPieces,
  isPunctuationOnly,
  piecesOverThreshold,
  piecesViolationMessages,
  scanLessonPieces,
  validatePieces,
  type PiecesViolationReason,
} from '../structuredResponse/lessonPieces'
import { PIECES_INSTRUCTION_LINE } from '../prompts/piecesInstruction'

interface Case {
  name: string
  note: string
  lineJa: string
  pieces: unknown
  expect: { ok: true; pieces: unknown[]; slashMoved?: number } | { ok: false; reason: PiecesViolationReason }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson-pieces-cases.json'), 'utf8')) as { cases: Case[] }

test('픽스처: 좋은 줄·나쁜 줄 목록이 있고, 나쁜 줄은 모든 위반 이유를 한 번 이상 다룬다', () => {
  assert.ok(fixture.cases.length >= 50)
  const good = fixture.cases.filter((c) => c.expect.ok)
  const bad = fixture.cases.filter((c) => !c.expect.ok)
  assert.ok(good.length >= 20 && bad.length >= 20)
  const reasons = new Set(bad.map((c) => (c.expect as { reason: string }).reason))
  for (const r of PIECES_VIOLATION_REASONS) assert.ok(reasons.has(r), `위반 이유 ${r} 를 다루는 나쁜 줄이 있어야 한다`)
  assert.equal(new Set(fixture.cases.map((c) => c.name)).size, fixture.cases.length, '이름 중복 없음')
})

for (const c of fixture.cases) {
  test(`checkPieces/validatePieces: ${c.name}`, () => {
    const r = checkPieces(c.lineJa, structuredClone(c.pieces))
    if (c.expect.ok) {
      assert.equal(r.ok, true, JSON.stringify(r))
      if (!r.ok) return
      assert.deepEqual(r.pieces, c.expect.pieces)
      if (c.expect.slashMoved !== undefined) assert.equal(r.slashMoved, c.expect.slashMoved, 'slash 를 조사로 옮긴(접은) 구간 수')
      assert.deepEqual(validatePieces(c.lineJa, structuredClone(c.pieces)), c.expect.pieces)
      // 멱등 — 정리된 배열을 다시 넣어도 같은 결과(저장 단계·재검증이 안전하다).
      assert.deepEqual(validatePieces(c.lineJa, r.pieces), r.pieces, '정리는 멱등')
      const again = checkPieces(c.lineJa, r.pieces)
      assert.equal(again.ok && again.slashMoved, 0, '정리된 배열을 다시 넣으면 옮길 것이 없다(멱등)')
      // 입력을 건드리지 않는다(비파괴).
      assert.deepEqual(c.pieces, JSON.parse(JSON.stringify(c.pieces)))
    } else {
      assert.equal(r.ok, false, '위반이어야 한다')
      if (r.ok) return
      assert.equal(r.reason, c.expect.reason, r.detail)
      assert.equal(validatePieces(c.lineJa, structuredClone(c.pieces)), null)
      assert.ok(!/[぀-ヿ一-鿿]/.test(r.detail), `위반 문구에 일본어 글을 싣지 않는다: ${r.detail}`)
    }
  })
}

test('isPunctuationOnly: 문장부호·기호·공백뿐이어야 참 — ー(장음)·가나·한자·숫자는 거짓', () => {
  for (const t of ['。', '、', '？', '！', '「', '」', '〜', '…', '・', ' ', '　', '。！', '?', '!', ',', '♪']) assert.equal(isPunctuationOnly(t), true, JSON.stringify(t))
  for (const t of ['ー', 'あ', 'ア', '駅', '1', 'a', '', '。あ']) assert.equal(isPunctuationOnly(t), false, JSON.stringify(t))
})

test('레슨 임계: «위반 줄 수 × 2 > 줄 수» — 6줄이면 3줄까지 허용·4줄부터 위반, 7줄이면 3줄 허용·4줄 위반, 줄이 없으면 위반 아님', () => {
  assert.equal(piecesOverThreshold(3, 6), false)
  assert.equal(piecesOverThreshold(4, 6), true)
  assert.equal(piecesOverThreshold(3, 7), false)
  assert.equal(piecesOverThreshold(4, 7), true)
  assert.equal(piecesOverThreshold(5, 10), false)
  assert.equal(piecesOverThreshold(6, 10), true)
  assert.equal(piecesOverThreshold(0, 0), false)
})

const goodLine = { ja: '駅です。', pieces: [{ ja: '駅', type: 'NAME', ko: '역', slash: false }, { ja: 'です', type: 'LINK', ko: '~예요', slash: false }, { ja: '。', type: null, ko: null, slash: false }] }
const badLine = { ja: '駅です。', pieces: [{ ja: '駅', type: 'NAME', ko: '역', slash: false }] }
const mk = (flags: boolean[]) => flags.map((good) => structuredClone(good ? goodLine : badLine))

test('scanLessonPieces: 줄별 결과·위반 수·임계 — pieces 키가 없는 줄도 위반(not_array)', () => {
  const s = scanLessonPieces([...mk([true, true, false, false, true, true]), { ja: '駅' } as { ja: string }])
  assert.equal(s.total, 7)
  assert.equal(s.invalid, 3)
  assert.equal(s.overThreshold, false, '3×2=6 > 7 아님')
  assert.equal(s.lines[6].result.ok, false)
  assert.equal(scanLessonPieces(mk([true, false, false, false])).overThreshold, true, '3×2=6 > 4')
})

test('piecesViolationMessages: 줄 번호와 규칙만(글 없음) · 최대 4줄 + 나머지 요약', () => {
  const s = scanLessonPieces(mk([false, false, false, false, false, false, true]))
  const m = piecesViolationMessages(s)
  assert.equal(m.length, 1 + 4 + 1)
  assert.match(m[0], /dialogue 줄 7개 중 6개의 pieces 가 규칙을 어겼다/)
  assert.ok(m[1].startsWith('dialogue[0].') && m[4].startsWith('dialogue[3].'))
  assert.match(m[5], /그 밖에 2줄/)
  for (const x of m) assert.ok(!/[぀-ヿ一-鿿]/.test(x), x)
})

test('applyLessonPieces: 통과한 줄은 정리된 배열, 못 넘은 줄은 null(제자리) · 요약 계측 · 멱등', () => {
  const dialogue = mk([true, false, true]) as { ja: string; pieces: unknown }[]
  dialogue[0].pieces = [
    { ja: '駅', type: 'NAME', ko: ' 역 ', slash: true },
    { ja: 'です', type: 'LINK', ko: '~예요', slash: true },
    { ja: '。', type: null, ko: null, slash: true },
  ]
  const sum = applyLessonPieces(dialogue)
  // PE 확정 3 — 駅(NAME) 의 slash 는 바로 뒤 LINK(です)로 옮겨지고, 옮겨진 slash 는 줄 끝(뒤에 type 있는 조각 없음)이라 꼬리 정리가 지운다.
  assert.deepEqual(dialogue[0].pieces, [{ ja: '駅', type: 'NAME', ko: '역' }, { ja: 'です', type: 'LINK', ko: '~예요' }, { ja: '。', type: null, ko: null }])
  assert.equal(dialogue[1].pieces, null)
  assert.equal(Array.isArray(dialogue[2].pieces), true)
  assert.deepEqual(sum, { piecesTotal: 3, piecesNullLines: 1, pieceCount: 6, byReason: { join_mismatch: 1 }, koNoHangul: 0, slashMoved: 1 })
  const again = applyLessonPieces(dialogue)
  assert.equal(again.piecesNullLines, 1)
  assert.deepEqual(again.byReason, { null_line: 1 }, '이미 null 인 줄은 null_line 으로 센다(재정리해도 값은 그대로)')
  assert.deepEqual(dialogue[0].pieces, [{ ja: '駅', type: 'NAME', ko: '역' }, { ja: 'です', type: 'LINK', ko: '~예요' }, { ja: '。', type: null, ko: null }])
  assert.equal(again.slashMoved, 0, '재정리해도 더 옮길 것이 없다(멱등)')
})

test('PE 확정 3 slashMoved: 줄마다 옮긴 구간 수가 합산되고, 글·순서·종류는 그대로이며 줄은 null 이 되지 않는다', () => {
  const dialogue = [
    { ja: '写真を撮りましたか。', pieces: [{ ja: '写真', type: 'NAME', ko: '사진', slash: true }, { ja: 'を', type: 'LINK', ko: '~을/를', slash: true }, { ja: '撮りましたか', type: 'ACTION', ko: '찍었어요?' }, { ja: '。', type: null, ko: null }] },
    { ja: '友だちと映画を見ます。', pieces: [{ ja: '友だち', type: 'NAME', ko: '친구', slash: true }, { ja: 'と', type: 'LINK', ko: '~와' }, { ja: '映画', type: 'NAME', ko: '영화', slash: true }, { ja: 'を', type: 'LINK', ko: '~을/를' }, { ja: '見ます', type: 'ACTION', ko: '봐요' }, { ja: '。', type: null, ko: null }] },
    { ja: 'ここで待ちます。', pieces: [{ ja: 'ここ', type: 'NAME', ko: '여기' }, { ja: 'で', type: 'LINK', ko: '~에서', slash: true }, { ja: '待ちます', type: 'ACTION', ko: '기다려요' }, { ja: '。', type: null, ko: null }] },
  ] as { ja: string; pieces: unknown }[]
  const before = dialogue.map((d) => (d.pieces as { ja: string; type: string | null }[]).map((p) => `${p.ja}|${p.type}`))
  const sum = applyLessonPieces(dialogue)
  assert.equal(sum.slashMoved, 3, '1번 줄 1 + 2번 줄 2 + 3번 줄 0')
  assert.equal(sum.piecesNullLines, 0)
  dialogue.forEach((d, i) => assert.deepEqual((d.pieces as { ja: string; type: string | null }[]).map((p) => `${p.ja}|${p.type}`), before[i], '조각 글·순서·종류 불변'))
  const slashJa = (i: number) => (dialogue[i].pieces as { ja: string; slash?: true }[]).filter((p) => p.slash).map((p) => p.ja)
  assert.deepEqual(slashJa(0), ['を'], '명사 사진의 slash 는 조사 を 로')
  assert.deepEqual(slashJa(1), ['と', 'を'])
  assert.deepEqual(slashJa(2), ['で'], '옮길 대상 없음 — 그대로')
})

test('koNoHangul: ko 에 한글이 하나도 없는 type 있는 조각은 위반이 아니라 세기만 한다(PE 확정 2)', () => {
  const r = checkPieces('駅です', [{ ja: '駅', type: 'NAME', ko: 'eki', slash: false }, { ja: 'です', type: 'LINK', ko: '~예요', slash: false }])
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.koNoHangul, 1)
})

// ── 지침 줄(PE 3단계 보정) ─────────────────────────────────────────────────────────────────

test('PE 3단계 지침: 눈가림 «어색» 원인 4가지 보정 규칙이 모두 들어 있다', () => {
  const L = PIECES_INSTRUCTION_LINE
  // ① です/ですか 를 앞 조각에서 떼지 않음
  assert.ok(L.includes('바로 앞 조각에 붙이고 따로 떼지 않습니다'))
  assert.ok(L.includes('문말 か・ね・よ 만 LINK 로 따로'))
  assert.ok(L.includes('떼어 낸 ですか 를 EXPRESSION 으로 만들지 않습니다'))
  // ② 종류: 수량=NAME · する동사/〜ている 상태 동사=ACTION · 정형 인사·부탁·부사+です 대답=EXPRESSION
  assert.ok(L.includes('수량') && L.includes('꾸밈이 아니라 NAME'))
  assert.ok(L.includes('〜ている 상태 동사도 느낌이 아니라 ACTION'))
  assert.ok(L.includes('부사+です 대답도') && L.includes('동사 꼴 정형 인사·부탁도 EXPRESSION'))
  // ③ 뜻 풀이: よ «~요(강조)»(이에요·이요 금지) · に 목적 «~하러»
  assert.ok(L.includes('문말 よ 는 "~요(강조)"') && L.includes('"~이에요"·"~이요" 로 풀지 않습니다'))
  assert.ok(L.includes('목적 "~하러"'))
  // ④ 끊어 읽기: 명사-조사 사이에서 끊지 않음
  assert.ok(L.includes('명사와 조사 사이는 끊지 않고 조사 조각에 slash'))
  // 기존 계약은 그대로: 같음 규칙·읽기 금지·null 조각
  assert.ok(L.includes('조각의 ja 를 순서대로 이으면 줄의 ja 와 글자 하나까지 같아야 합니다') && L.includes('읽기는 쓰지 않습니다') && L.includes('type·ko 를 null'))
})

test('PE 3단계 지침: 길이는 보정 전(869자)보다 450자 넘게 늘지 않는다 — 1,319자 이하', () => {
  assert.ok(PIECES_INSTRUCTION_LINE.length <= 869 + 450, `조각 지침 ${PIECES_INSTRUCTION_LINE.length}자 > 1,319`)
  assert.ok(PIECES_INSTRUCTION_LINE.length >= 1_000, '규칙을 줄인 것이 아니라 늘렸다는 확인(보정 4가지가 들어갈 최소 길이)')
})

test('PE 3단계 지침: 눈가림 표(G6 판정에 쓴 40줄)의 문장·낱말을 새 규칙의 예시로 쓰지 않았다 — 재측정이 시험 문제를 아는 상태가 되지 않게', () => {
  // 기존 예문 두 개(温かいコーヒーを一つください・いいえ、家でゆっくり飲みます)는 core 12회와 같은 바이트로 유지(비교 가능성) — 그 두 문장은 제외하고 본다.
  const rest = PIECES_INSTRUCTION_LINE.replace('温かいコーヒーを一つください', '').replace('いいえ、家でゆっくり飲みます', '')
  for (const w of ['もちろんです', 'うれしい', 'よろしくお願いします', 'お召し上がり', '緊張しています', '田中です', '何です', '混んでいました', '旅行に行く', '写真を撮り', '会社員', '勉強しています', 'お土産', '楽しみです', '大切ですよ', '買いましたよ']) {
    assert.ok(!rest.includes(w), `눈가림 표의 낱말이 지침에 들어 있다: ${w}`)
  }
  // 새 예시 낱말은 지침에 실제로 있다
  for (const w of ['二人', '三枚', '学生です', '食べました', '練習しています', 'まだです', 'いただきます', 'お先に失礼します', '散歩に行く']) assert.ok(PIECES_INSTRUCTION_LINE.includes(w), w)
})
