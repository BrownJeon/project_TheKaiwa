/**
 * task-081 PE — 라이브 측정 하네스(`tests/prompts/lesson-pieces-live.ts`)의 순수 부분 시험. 호출 0 — import 만으로 `main()` 이 돌지 않는 것도 여기서 확인한다(task-078 호출 초과 사고 교훈).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HARD_CAP, GATE, KIND_CAP, analyzeData, applyPiecesOverride, blindSheet, buildPlan, buildRequest, compareRuns, gate, parseLogs, scoreVerdicts, summarize, type DialogueDump, type Row } from '../../../../tests/prompts/lesson-pieces-live'
import { PIECES_INSTRUCTION_LINE } from '../prompts/piecesInstruction'
import type { LessonResponse } from '../structuredResponse/schemas'

test('하네스: import 만으로는 아무것도 호출하지 않는다(여기까지 왔다는 것 자체가 증거) · 호출 계획은 상한 안', () => {
  const core = buildPlan('core')
  const extra = buildPlan('extra')
  assert.equal(core.length, 12)
  assert.equal(extra.length, 6)
  assert.ok(core.length + extra.length <= HARD_CAP, `core+extra ${core.length + extra.length} > HARD_CAP ${HARD_CAP}`)
  assert.equal(new Set([...core, ...extra].map((p) => p.id)).size, core.length + extra.length, '계획 id 중복 없음(RESUME 이 id 로 건너뛴다)')
  const kinds = core.reduce<Record<string, number>>((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {})
  assert.deepEqual(kinds, { TOPIC: 8, SCENARIO: 1, SOURCE: 1, REVIEW: 2 })
})

test('하네스(PE 3단계): r2 계획은 6회 — core 와 같은 (주제, 수준) 조합이 없고, 계획별 호출 상한(KIND_CAP)이 6 이다', () => {
  const r2 = buildPlan('r2')
  const core = buildPlan('core')
  assert.equal(r2.length, 6)
  assert.equal(KIND_CAP.r2, 6, '재측정 소환의 호출 한도 6 — 환경변수가 더 커도 이 값을 넘지 않는다')
  assert.equal(new Set(r2.map((p) => p.id)).size, 6)
  assert.ok(r2.every((p) => !core.some((c) => c.id === p.id)), 'core 와 같은 id(주제+수준) 없음')
  const topics = new Set(r2.map((p) => p.topicKey))
  for (const must of ['self-intro', 'cafe-order', 'travel-story']) assert.ok(topics.has(must), `${must} 포함(눈가림에서 어색이 몰린 주제)`)
  assert.ok(r2.every((p) => p.kind === 'TOPIC'))
})

test('하네스: 모든 계획 입력이 요청으로 만들어지고 조각 지침 한 줄이 들어가며 quiz 는 스키마에 없다', () => {
  for (const p of [...buildPlan('core'), ...buildPlan('extra'), ...buildPlan('r2')]) {
    const req = buildRequest(p)
    assert.equal(req.system.split(PIECES_INSTRUCTION_LINE).length - 1, 1, `${p.id}: 조각 지침 정확히 1번`)
    assert.ok(!(req.jsonSchema as { required: string[] }).required.includes('quiz'), p.id)
  }
  const sc = buildRequest(buildPlan('core').find((p) => p.kind === 'SCENARIO')!)
  assert.ok(sc.system.includes('상황 수업([상황])'))
})

test('하네스: 조각 지침 대체는 정확히 한 번 나올 때만 — 변형 시험에서 운영 파일은 불변', () => {
  const req = buildRequest(buildPlan('core')[0])
  const replaced = applyPiecesOverride(req.system, '- dialogue[].pieces(변형): 테스트')
  assert.ok(replaced.includes('- dialogue[].pieces(변형): 테스트') && !replaced.includes(PIECES_INSTRUCTION_LINE))
  assert.equal(applyPiecesOverride(req.system, null), req.system)
  assert.throws(() => applyPiecesOverride('지침 없는 system', '변형'), /0번 나온다/)
})

const data = (pieces: DialogueDump['pieces'], extraLines = 0) =>
  ({ dialogue: [{ speaker: 'A', ja: '温かいコーヒーを一つください。', ko: 'x', reading: 'x', pieces }, ...Array.from({ length: extraLines }, () => ({ speaker: 'B', ja: '駅', ko: 'x', reading: 'x', pieces: null }))] }) as unknown as LessonResponse

test('analyzeData: 분해 플래그(조사가 LINK 아님·활용 분리·です 분리) · null 줄·구간 수·ko 길이', () => {
  const m = analyzeData(data([
    { ja: '食べ', type: 'ACTION', ko: '먹', slash: false }, { ja: 'ます', type: 'ACTION', ko: '요', slash: false },
    { ja: '静か', type: 'FEELING', ko: '조용', slash: true }, { ja: 'です', type: 'LINK', ko: '~예요', slash: false },
    { ja: 'を', type: 'NAME', ko: '~을', slash: false }, { ja: '。', type: null, ko: null, slash: false },
  ], 1))
  assert.equal(m.lines, 2)
  assert.equal(m.nullLines, 1)
  assert.equal(m.flags.splitLines, 1)
  assert.equal(m.flags.particleNotLink, 1)
  assert.equal(m.flags.particlePieces, 1)
  assert.equal(m.slashes, 1)
  assert.equal(m.typedCount, 5)
})

test('parseLogs: 엔진 로그에서 조각 요약·재시도 원인·면책을 뽑는다(글 내용 없음)', () => {
  const f = parseLogs([
    '[json] 1차 응답 계약 위반 → 재시도: dialogue 줄 6개 중 4개의 pieces 가 규칙을 어겼다(절반을 넘으면 수업을 다시 만든다)',
    '[lesson] 마지막 시도 — 눈감고 통과시킨 위반: ④매칭 0건·조각 위반 줄 4/6 trace=- attempt=2/2',
    '[lesson] pieces — lines=6 nullLines=4 pieces=12 koNoHangul=1 reasons={"join_mismatch":4}',
  ])
  assert.deepEqual(f.pieces, { lines: 6, nullLines: 4, pieces: 12, koNoHangul: 1, reasons: { join_mismatch: 4 } })
  assert.ok(f.retryReason?.includes('pieces 가 규칙을 어겼다'))
  assert.ok(f.tolerated?.includes('조각 위반 줄 4/6'))
})

test('parseLogs(PE 3단계): 로그 끝의 slashMoved 를 읽고, 없는 옛 형식도 그대로 읽는다', () => {
  const f = parseLogs(['[lesson] pieces — lines=8 nullLines=0 pieces=60 koNoHangul=0 reasons={} slashMoved=3'])
  assert.deepEqual(f.pieces, { lines: 8, nullLines: 0, pieces: 60, koNoHangul: 0, reasons: {}, slashMoved: 3 })
  const g = parseLogs(['[reviewMix] pieces — lines=6 nullLines=1 pieces=40 koNoHangul=0 reasons={"join_mismatch":1} slashMoved=0'])
  assert.equal(g.pieces?.slashMoved, 0)
  assert.equal(g.pieces?.reasons.join_mismatch, 1)
})

test('analyzeData(PE 3단계): 눈가림 «어색» 원인 휴리스틱 — 홀로 떨어진 です·동사 꼴 FEELING·수량이 NAME 아님·인사가 ACTION·よ 풀이·명사-조사 사이 slash', () => {
  const m = analyzeData({ dialogue: [{ speaker: 'A', ja: 'x', ko: 'x', reading: 'x', pieces: [
    { ja: '写真', type: 'NAME', ko: '사진', slash: true }, { ja: 'を', type: 'LINK', ko: '~을/를', slash: false },
    { ja: '混んでいました', type: 'FEELING', ko: '붐볐어요', slash: false }, { ja: 'です', type: 'FEELING', ko: '~입니다', slash: false },
    { ja: '二人', type: 'MODIFIER', ko: '두 명', slash: false }, { ja: 'お先に失礼します', type: 'ACTION', ko: '먼저 가요', slash: false },
    { ja: 'ですか', type: 'EXPRESSION', ko: '~인가요?', slash: false }, { ja: 'よ', type: 'LINK', ko: '~이요(강조)', slash: false },
  ] }, { speaker: 'B', ja: 'y', ko: 'y', reading: 'y', pieces: [
    { ja: '静かです', type: 'FEELING', ko: '조용해요', slash: false }, { ja: '三枚', type: 'NAME', ko: '세 장', slash: false },
    { ja: 'いただきます', type: 'EXPRESSION', ko: '잘 먹겠습니다', slash: false }, { ja: 'よ', type: 'LINK', ko: '~요(강조)', slash: false },
  ] }] } as unknown as LessonResponse)
  assert.equal(m.flags.slashBeforeLink, 1)
  assert.equal(m.flags.feelingVerbForm, 1)
  assert.equal(m.flags.lonelyCopula, 2, 'です·ですか')
  assert.equal(m.flags.lonelyCopulaLines, 1)
  assert.equal(m.flags.quantityNotName, 1, '二人(MODIFIER) 만 — 三枚(NAME) 은 정상')
  assert.equal(m.flags.greetingAsAction, 1, 'お先に失礼します(ACTION) 만 — いただきます(EXPRESSION) 은 정상')
  assert.equal(m.flags.koYoBad, 1, '~이요(강조) 만 — ~요(강조) 는 정상')
})

test('compareRuns: core·r2 를 같은 분석기로 나란히 계산한다 — 저장된 dialogue 로 플래그를 다시 센다(호출 0)', () => {
  const bad = row({ id: 'core1' })
  bad.dialogue = [{ speaker: 'A', ja: 'x', ko: 'x', pieces: [{ ja: '写真', type: 'NAME', ko: '사진', slash: true }, { ja: 'を', type: 'LINK', ko: '~을/를' }, { ja: '緊張しています', type: 'FEELING', ko: '긴장해요' }] }]
  const good = row({ id: 'r2a' })
  good.dialogue = [{ speaker: 'A', ja: 'x', ko: 'x', pieces: [{ ja: '写真', type: 'NAME', ko: '사진' }, { ja: 'を', type: 'LINK', ko: '~을/를', slash: true }, { ja: '緊張しています', type: 'ACTION', ko: '긴장해요' }] }]
  good.logs = { pieces: { lines: 1, nullLines: 0, pieces: 3, koNoHangul: 0, reasons: {}, slashMoved: 1 } }
  const c = compareRuns([bad], [good])
  assert.equal(c.core.flags.slashBeforeLink, 1)
  assert.equal(c.core.flags.feelingVerbForm, 1)
  assert.equal(c.r2.flags.slashBeforeLink, 0)
  assert.equal(c.r2.flags.feelingVerbForm, 0)
  assert.equal(c.r2.flags.slashMoved, 1)
  assert.equal(c.core.flags.slashMoved, null, '옛 파이프라인 결과에는 slashMoved 로그가 없다')
  assert.equal(c.core.calls, 1)
  assert.equal(c.r2.gate.G2a.pass, true)
})

function row(over: Partial<Row> & { id: string }, nullLines = 0): Row {
  const d = data([{ ja: '温かい', type: 'FEELING', ko: '따뜻한', slash: false }, { ja: 'コーヒー', type: 'NAME', ko: '커피', slash: false }, { ja: 'を', type: 'LINK', ko: '~을/를', slash: false }], nullLines)
  return { kind: 'TOPIC', level: 'N5', arm: 'v10', ok: true, elapsedMs: 45_000, attempts: 1, promptChars: 9000, metrics: analyzeData(d), logs: {}, dialogue: d.dialogue.map((x) => ({ speaker: x.speaker, ja: x.ja, ko: x.ko, pieces: x.pieces as DialogueDump['pieces'] })), ...over }
}

test('게이트: 합격선 숫자 경계 — 중앙값 60초·최대 100초·재시도 2/12·null 줄 10%·120초 초과', () => {
  const rows = Array.from({ length: 12 }, (_, i) => row({ id: `r${i}`, elapsedMs: 60_000 }))
  const pass = (r: Row[], id: string) => summarize(r).gate.find((g) => g.id === id)!.pass
  assert.equal(pass(rows, 'G1a'), true, '중앙값 정확히 60초는 통과')
  assert.equal(pass(rows.map((r) => ({ ...r, elapsedMs: 60_001 })), 'G1a'), false)
  assert.equal(pass([...rows.slice(0, 11), row({ id: 'x', elapsedMs: 100_001 })], 'G1b'), false)
  assert.equal(pass([...rows.slice(0, 11), row({ id: 'x', elapsedMs: 121_000, attempts: 2 })], 'G1c'), false)
  assert.equal(pass([...rows.slice(0, 10), row({ id: 'a', attempts: 2 }), row({ id: 'b', attempts: 2 })], 'G2a'), true, '2/12 는 통과')
  assert.equal(pass([...rows.slice(0, 9), row({ id: 'a', attempts: 2 }), row({ id: 'b', attempts: 2 }), row({ id: 'c', attempts: 2 })], 'G2a'), false, '3/12 는 실패')
  assert.equal(pass([...rows.slice(0, 11), { ...row({ id: 'f' }), ok: false, error: 'x', errorName: 'JsonSchemaError', metrics: undefined }], 'G2b'), false)
  // null 줄 비율: 1줄 대화 11개 + (1줄 + null 1줄) → 12 줄 중 1 null
  assert.equal(pass([...rows.slice(0, 11), row({ id: 'n' }, 1)], 'G3a'), true, '1/13 ≈ 7.7%')
  assert.equal(pass([...rows.slice(0, 9), row({ id: 'n1' }, 1), row({ id: 'n2' }, 1), row({ id: 'n3' }, 1)], 'G3a'), false, '3/15 = 20%')
  assert.equal(GATE.g6MinSample, 40)
  assert.equal(gate(summarize([]) as never).every((g) => g.pass === null || typeof g.pass === 'boolean'), true)
})

test('눈가림 표: arm·호출 id 가 새지 않고 null 줄은 빠지며 같은 시드면 같은 순서 — 키 파일만 매핑을 갖는다', () => {
  const rowsA = [row({ id: 'T-secret-id', arm: 'armA' }, 2)]
  const rowsB = [row({ id: 'T-other-id', arm: 'armB' }, 0)]
  const a = blindSheet([rowsA, rowsB], 10, 81)
  const b = blindSheet([rowsA, rowsB], 10, 81)
  assert.equal(a.md, b.md, '시드 고정 → 재현')
  assert.equal(a.count, 2, 'null 줄 2개는 빠지고 정상 줄 2개만')
  assert.ok(!/armA|armB|T-secret-id|T-other-id/.test(a.md), '표에 arm·호출 id 가 있으면 안 된다')
  assert.deepEqual(Object.keys(a.key).sort(), ['S01', 'S02'])
  assert.deepEqual(new Set(Object.values(a.key).map((k) => k.arm)), new Set(['armA', 'armB']))
  const sc = scoreVerdicts({ S01: '맞음', S02: '틀림', S99: '맞음' }, a.key)
  assert.equal(Object.values(sc).reduce((n, x) => n + x.total, 0), 2, '키에 없는 줄 번호는 무시')
})

test('판정 집계: 표본 40 미만이면 G6 은 판단 보류(null), 40 이상이면 틀림 5%·맞음 70%·맞음+어색 92% 경계', () => {
  const key = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`S${i + 1}`, { arm: 'a' }]))
  const mk = (right: number, awkward: number) => Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`S${i + 1}`, i < right ? '맞음' : i < right + awkward ? '어색' : '틀림']))
  assert.equal(scoreVerdicts(mk(30, 8), key).a.g6, true, '맞음 75%·어색 20%·틀림 5% = 통과')
  assert.equal(scoreVerdicts(mk(27, 10), key).a.g6, false, '맞음 67.5% < 70%')
  assert.equal(scoreVerdicts(mk(30, 7), key).a.g6, false, '틀림 7.5% > 5%')
  const small = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`S${i + 1}`, '맞음']))
  assert.equal(scoreVerdicts(small, key).a.g6, null)
})
