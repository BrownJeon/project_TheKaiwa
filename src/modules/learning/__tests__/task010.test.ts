import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type Tx } from '@/modules/infra'
import { assignSegments, checkSpeaking, lessonRepetitionItems, readStoredContent, scoreQuiz, segmentSizes, summarizeExpressions, toStoredContent, audioText, type LessonGenOutput } from '../lessons/content'
import { chunkForms, grammarForms, kataToHira, matchTargets, normalizeForMatch } from '../lessons/matching'
import { mergeProgress, parseProgressPatch, readProgress, withSpeaking, type LessonProgress } from '../lessons/progress'
import { japaneseRatio, parseAudioBody, parseCompleteBody, parseCreateLessonBody, parseMemoBody, parseProgressBody, parseSpeakingBody } from '../lessons/validate'
import { applyWordbook, memoDraftFromEnrich, planMemoEntries } from '../lessons/memo'
import { clampInterval, mergeRepetitionInputs, normalizeRefText, registerRepetitionItems, repetitionRefId, REPETITION_LESSON_ITEM_CAP } from '../repetition'
import { levelWindow, parseTopicQuery } from '../topics'

const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || (e.details as { reason?: string } | undefined)?.reason === reason)

/** A4 응답 픽스처(스키마 모양) — 주제 조각 c1·c2 재사용 + 새 표현 new-1, 문법 g1·g2. */
function gen(over: Partial<LessonGenOutput> = {}): LessonGenOutput {
  const line = (speaker: 'A' | 'B', ja: string, reading: string, ko: string) => ({ speaker, ja, reading, ko })
  return {
    title: 'カフェで注文する',
    titleKo: '카페에서 주문하기',
    rolesKo: { A: '점원', B: '손님' },
    dialogue: [
      line('A', 'いらっしゃいませ。ご注文はお決まりですか。', 'いらっしゃいませ。ごちゅうもんはおきまりですか。', '어서 오세요. 주문하시겠어요?'),
      line('B', 'ホットコーヒーをください。', 'ほっとこーひーをください。', '따뜻한 커피 주세요.'),
      line('A', 'サイズはどうしますか。', 'さいずはどうしますか。', '사이즈는요?'),
      line('B', '小さいサイズでお願いします。', 'ちいさいさいずでおねがいします。', '작은 사이즈로 부탁해요.'),
      line('A', 'こちらでお召し上がりですか。', 'こちらでおめしあがりですか。', '여기서 드세요?'),
      line('B', 'いいえ、持ち帰ります。', 'いいえ、もちかえります。', '아니요, 가져갈게요.'),
      line('A', 'かしこまりました。', 'かしこまりました。', '알겠습니다.'),
      line('B', 'ありがとうございます。', 'ありがとうございます。', '감사합니다.'),
    ],
    chunks: [
      { id: 'c1', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', isNew: false },
      { id: 'c2', textJa: '持ち帰ります', reading: 'もちかえります', meaningKo: '가져갑니다', chunkType: 'ACTION', isNew: false },
      { id: 'new-1', textJa: '注文', reading: 'ちゅうもん', meaningKo: '주문', chunkType: 'NAME', isNew: true },
      { id: 'new-2', textJa: '小さい', reading: 'ちいさい', meaningKo: '작다', chunkType: 'MODIFIER', isNew: true },
    ],
    grammar: [
      { id: 'g1', pattern: '〜をください', explanationKo: '~을 주세요', exampleJa: '水をください。', exampleReading: 'みずをください。', exampleKo: '물 주세요.' },
      { id: 'g2', pattern: 'Nでお願いします', explanationKo: '~로 부탁해요', exampleJa: '小さいサイズでお願いします。', exampleReading: 'ちいさいさいずでおねがいします。', exampleKo: '작은 사이즈로 부탁해요.' },
    ],
    quiz: [
      { id: 'q1', promptKo: '커피', promptJa: null, choices: ['コーヒー', 'お茶', '水', 'ケーキ'], answer: 0, targetIds: ['c1'], explanationKo: '.' },
      { id: 'q2', promptKo: '가져가다', promptJa: null, choices: ['食べます', '持ち帰ります', '飲みます', '見ます'], answer: 1, targetIds: ['c2'], explanationKo: '.' },
      { id: 'q3', promptKo: '빈칸에 알맞은 말은? (물 ＿＿)', promptJa: '水を＿＿', choices: ['ください', 'です', 'ます', 'だ'], answer: 0, targetIds: ['g1', 'c1'], explanationKo: '.' },
      { id: 'q4', promptKo: '주문', promptJa: null, choices: ['注文', '会計', '予約', '席'], answer: 0, targetIds: ['new-1'], explanationKo: '.' },
      { id: 'q5', promptKo: '작다', promptJa: null, choices: ['大きい', '小さい', '高い', '安い'], answer: 1, targetIds: ['new-2', 'g2'], explanationKo: '.' },
    ],
    application: [
      { id: 'a1', promptKo: '.', hintJa: null, modelAnswerJa: '紅茶をください。', modelReading: 'こうちゃをください。', modelKo: '.', targetIds: ['g1'] },
      { id: 'a2', promptKo: '.', hintJa: null, modelAnswerJa: '持ち帰ります。', modelReading: 'もちかえります。', modelKo: '.', targetIds: ['c2'] },
      { id: 'a3', promptKo: '.', hintJa: null, modelAnswerJa: '小さいサイズでお願いします。', modelReading: 'ちいさいさいずでおねがいします。', modelKo: '.', targetIds: ['g2'] },
    ],
    speaking: [
      { id: 's1', promptKo: '.', targetIds: ['c1', 'g1'], modelAnswerJa: 'コーヒーをください。', modelReading: 'こーひーをください。', modelKo: '.' },
      { id: 's2', promptKo: '.', targetIds: ['c2'], modelAnswerJa: '持ち帰ります。', modelReading: 'もちかえります。', modelKo: '.' },
      { id: 's3', promptKo: '.', targetIds: ['new-2', 'g2'], modelAnswerJa: '小さいサイズでお願いします。', modelReading: 'ちいさいさいずでおねがいします。', modelKo: '.' },
    ],
    nextPreview: { titleKo: '계산하기', teaserKo: '다음엔 계산할 때 쓰는 말을 배워요.' },
    ...over,
  }
}

// ── L2 청취 구간 ─────────────────────────────────────────────────────────

test('L2 구간 크기: 2~3줄, 1줄 구간 없음(결정적)', () => {
  assert.deepEqual(segmentSizes(6), [3, 3])
  assert.deepEqual(segmentSizes(7), [3, 2, 2])
  assert.deepEqual(segmentSizes(8), [3, 3, 2])
  assert.deepEqual(segmentSizes(9), [3, 3, 3])
  assert.deepEqual(segmentSizes(10), [3, 3, 2, 2])
  assert.deepEqual(segmentSizes(4), [2, 2])
  assert.deepEqual(segmentSizes(5), [3, 2])
  assert.deepEqual(segmentSizes(1), [1])
  assert.deepEqual(segmentSizes(0), [])
  for (let n = 4; n <= 30; n++) {
    const s = segmentSizes(n)
    assert.equal(s.reduce((a, b) => a + b, 0), n, `합 = ${n}`)
    assert.ok(s.every((x) => x === 2 || x === 3), `${n}: ${s}`)
  }
})

test('L2 저장 모양: 대화 줄마다 segment(1부터)·segmentCount, 원래 칸 보존', () => {
  const c = toStoredContent(gen())
  assert.equal(c.v, 1)
  assert.deepEqual(c.dialogue.map((d) => d.segment), [1, 1, 1, 2, 2, 2, 3, 3])
  assert.equal(c.segmentCount, 3)
  assert.equal(c.dialogue[1].ja, 'ホットコーヒーをください。')
  assert.deepEqual(assignSegments(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => ({ x }))).map((d) => d.segment), [1, 1, 1, 2, 2, 3, 3])
  assert.ok(readStoredContent(JSON.parse(JSON.stringify(c))), '저장 후 다시 읽힌다')
  assert.equal(readStoredContent({ ...c, v: 2 }), null)
  assert.equal(readStoredContent(null), null)
  assert.equal(readStoredContent({ v: 1, title: 'x' }), null, '배열 칸 없으면 손상')
})

test('L2 옛 레슨 읽기(lesson@v7 이하): 저장된 quiz.promptKo 가 null 이어도 그대로 읽히고 채점된다', () => {
  const c = toStoredContent(gen())
  const legacy = JSON.parse(JSON.stringify({ ...c, quiz: c.quiz.map((q, i) => (i === 2 ? { ...q, promptKo: null } : q)) }))
  const read = readStoredContent(legacy)
  assert.ok(read, '옛 저장 JSON 도 손상으로 보지 않는다')
  assert.equal(read.quiz[2].promptKo, null)
  assert.equal(read.quiz[2].promptJa, '水を＿＿')
  assert.equal(scoreQuiz(read.quiz, [0, 1, 0, 0, 1]).correct, 5)
})

// ── L4 서버 재채점 ─────────────────────────────────────────────────────────

test('L4 재채점: 정답 index 대조, 미답은 틀림으로 세지 않되 분모에 든다', () => {
  const q = gen().quiz
  const all = scoreQuiz(q, [0, 1, 0, 0, 1])
  assert.deepEqual([all.correct, all.total, all.answered, all.score], [5, 5, 5, 100])
  const some = scoreQuiz(q, [0, 2, null, 0])
  assert.deepEqual(some.outcomes, ['CORRECT', 'WRONG', null, 'CORRECT', null])
  assert.deepEqual([some.correct, some.answered, some.score], [2, 3, 40])
  assert.equal(scoreQuiz(q, undefined).score, 0)
  assert.equal(scoreQuiz([], []).score, 0)
})

// ── L1 표현 매칭 ─────────────────────────────────────────────────────────

test('L1 정규화: 가타카나→히라가나·NFKC·구두점/공백 제거, 장음 유지', () => {
  assert.equal(kataToHira('コーヒー'), 'こーひー')
  assert.equal(normalizeForMatch(' ｺｰﾋｰ を、ください。 '), 'こーひーをください')
  assert.equal(normalizeForMatch('〜てください！'), 'てください')
})

test('L1 조각 판정: 표기 또는 읽기 포함, 정중형·사전형 어미 조금 봐준다', () => {
  const t = (text: string, textJa: string, reading?: string) => matchTargets(text, [{ id: 'x', forms: chunkForms(textJa, reading) }]).matchedIds.length === 1
  assert.ok(t('冷たいコーヒーをください', 'コーヒー', 'こーひー'))
  assert.ok(t('こーひーください', 'コーヒー'), '가타카나 표기를 히라가나로 말해도')
  assert.ok(t('ちゅうもんします', '注文', 'ちゅうもん'), '한자 조각을 읽기로 말해도')
  assert.ok(t('猫が好き', '好きです', 'すきです'), 'です 뗀 핵심')
  assert.ok(t('昨日パンを食べました', '食べる', 'たべる'), '사전형 어간')
  assert.ok(!t('行きました', '行く', 'いく'), '어간이 1자면 봐주지 않는다')
  assert.ok(!t('お茶ください', 'コーヒー', 'こーひー'))
  assert.ok(!t('', 'コーヒー'))
})

test('L1 문법 판정: 〜·자리표시·용어 조각을 걸러 남은 조각 모두 포함', () => {
  assert.deepEqual(grammarForms('〜をください')[0], ['をください'])
  assert.deepEqual(grammarForms('Nでお願いします')[0], ['でお願いします'].map(normalizeForMatch))
  assert.deepEqual(grammarForms('V-ます形 + ましょう')[0], ['ましょう'])
  assert.deepEqual(grammarForms('〜は…です'), grammarForms('〜は…です'))
  assert.deepEqual(grammarForms('〜'), [], '남는 조각 없음 → 판정 불가')
  assert.deepEqual(grammarForms('명사 + 이다'), [], '한글만 → 판정 불가')
  const r = matchTargets('一緒に行きましょう', [{ id: 'g', forms: grammarForms('V-ます形 + ましょう') }])
  assert.deepEqual(r.matchedIds, ['g'])
  const kana = matchTargets('ちいさいさいずでおねがいします', [{ id: 'g', forms: grammarForms('Nでお願いします') }])
  assert.deepEqual(kana.matchedIds, ['g'], '한자 문형을 가나로 말해도(한자 건너뛴 조각)')
  assert.deepEqual(matchTargets('小さいのでいいです', [{ id: 'g', forms: grammarForms('Nでお願いします') }]).missedIds, ['g'])
  const u = matchTargets('はい', [{ id: 'g', forms: grammarForms('〜') }])
  assert.deepEqual([u.matchedIds, u.missedIds, u.unknownIds], [[], [], ['g']])
})

test('L1 말하기 확인: used = 판정 가능한 목표를 모두 사용, 없는 과제 null', () => {
  const c = toStoredContent(gen())
  const ok1 = checkSpeaking(c, 's1', 'ホットコーヒーをください。')!
  assert.deepEqual([ok1.used, ok1.matchedIds, ok1.missedIds], [true, ['c1', 'g1'], []])
  const half = checkSpeaking(c, 's1', 'コーヒーお願いします')!
  assert.deepEqual([half.used, half.matchedIds, half.missedIds], [false, ['c1'], ['g1']])
  const s3 = checkSpeaking(c, 's3', 'ちいさいサイズでおねがいします')!
  assert.equal(s3.used, true, '히라가나로 말해도(読み) 표현 사용')
  assert.equal(checkSpeaking(c, 's9', 'x'), null)
  const sum = summarizeExpressions(c, [ok1, { itemId: 's3', matchedIds: ['new-2'], missedIds: ['g2'] }])
  assert.deepEqual(sum.usedIds.sort(), ['c1', 'g1', 'new-2'])
  assert.deepEqual(sum.missedIds.sort(), ['c2', 'g2'], '시도하지 않은 과제(s2)의 목표도 못 쓴 표현')
})

// ── L5 반복 항목 ─────────────────────────────────────────────────────────

test('L5 refId: 주제 조각이면 TopicChunk(조각 id), 새 표현은 Expr sha1(정규화), 문법은 Grammar sha1(문형)', () => {
  const c = toStoredContent(gen())
  const items = lessonRepetitionItems(c, { topicChunkIds: new Set(['c1', 'c2']), outcomes: scoreQuiz(c.quiz, [0, 0, 0, null, 1]).outcomes })
  const by = new Map(items.map((i) => [i.contentId, i]))
  assert.deepEqual([by.get('c1')!.refType, by.get('c1')!.refId, by.get('c1')!.itemType], ['TopicChunk', 'c1', 'CHUNK'])
  assert.deepEqual([by.get('new-1')!.refType, by.get('new-1')!.itemType], ['Expr', 'EXPRESSION'])
  assert.equal(by.get('new-1')!.refId, repetitionRefId('注文'))
  assert.equal(by.get('new-1')!.refId.length, 40)
  assert.deepEqual([by.get('g1')!.refType, by.get('g1')!.refId, by.get('g1')!.itemType], ['Grammar', repetitionRefId('〜をください'), 'GRAMMAR'])
  // q1 정답(c1), q2 오답(c2), q3 정답(g1·c1), q4 미답, q5 정답(new-2·g2)
  assert.deepEqual([by.get('c1')!.correct, by.get('c1')!.wrong], [2, 0])
  assert.deepEqual([by.get('c2')!.correct, by.get('c2')!.wrong], [0, 1])
  assert.deepEqual([by.get('new-1')!.correct, by.get('new-1')!.wrong], [0, 0], '미답은 카운터 변화 없음')
  assert.deepEqual(items.map((i) => i.contentId), ['c1', 'c2', 'new-1', 'new-2', 'g1', 'g2'], '조각 먼저')
})

test('L5 주제 밖 id(목록에 없는 조각)는 Expr 로 — 잘못된 TopicChunk 참조를 만들지 않는다', () => {
  const c = toStoredContent(gen())
  const items = lessonRepetitionItems(c, { topicChunkIds: new Set(['c2']), outcomes: [] })
  assert.equal(items.find((i) => i.contentId === 'c1')!.refType, 'Expr')
  assert.equal(items.find((i) => i.contentId === 'c1')!.refId, repetitionRefId('コーヒー'))
})

test('L5 상한 12(조각 우선)·정규화 해시 안정', () => {
  const many = gen({
    chunks: Array.from({ length: 11 }, (_, i) => ({ id: `new-${i + 1}`, textJa: `表現${i}`, reading: 'ひょうげん', meaningKo: '표현', chunkType: 'NAME' as const, isNew: true })),
  })
  const items = lessonRepetitionItems(toStoredContent(many), { topicChunkIds: new Set(), outcomes: [] })
  assert.equal(items.length, REPETITION_LESSON_ITEM_CAP)
  assert.equal(items.filter((i) => i.refType === 'Grammar').length, 1, '조각 11 + 문법 1')
  assert.equal(normalizeRefText(' 〜を ください。'), 'をください')
  assert.equal(repetitionRefId('〜をください'), repetitionRefId('～をください'), '전각/반각 물결표 같은 항목')
  assert.notEqual(repetitionRefId('カ'), repetitionRefId('か'), '가나 종류는 구분')
})

test('L5 간격 클램프 3~7, FOCUS ≤3 / 같은 키 입력 합치기', () => {
  assert.deepEqual([clampInterval(1, 'NORMAL'), clampInterval(5, 'NORMAL'), clampInterval(30, 'NORMAL'), clampInterval(null, 'NORMAL'), clampInterval(7, 'FOCUS')], [3, 5, 7, 3, 3])
  const m = mergeRepetitionInputs([
    { itemType: 'EXPRESSION', refType: 'Expr', refId: 'a', textJa: 'x', meaningKo: null, correct: 1 },
    { itemType: 'EXPRESSION', refType: 'Expr', refId: 'a', textJa: 'y', meaningKo: null, wrong: 2 },
    { itemType: 'GRAMMAR', refType: 'Grammar', refId: 'a', textJa: 'z', meaningKo: null, correct: -5 },
  ])
  assert.equal(m.length, 2)
  assert.deepEqual([m[0].textJa, m[0].correct, m[0].wrong], ['x', 1, 2])
  assert.equal(m[1].correct, 0, '음수 증가 무시')
})

/** 가짜 tx — registerRepetitionItems 가 쓰는 두 메서드만. */
function fakeRepTx(existing: { id: string; refType: string; refId: string; intervalDays: number; priority: 'NORMAL' | 'FOCUS' }[]) {
  const calls: { op: string; args: unknown }[] = []
  let n = 0
  const tx = {
    repetitionItem: {
      findMany: async () => existing,
      update: async (args: unknown) => {
        calls.push({ op: 'update', args })
        return {}
      },
      create: async (args: unknown) => {
        calls.push({ op: 'create', args })
        return { id: `new${++n}` }
      },
    },
  }
  return { tx: tx as unknown as Tx, calls }
}

test('L5 등록: 없는 항목 create(3일·FALLBACK·studied 1), 있는 항목 update(증가만·기존 간격 클램프·FOCUS ≤3)', async () => {
  const { tx, calls } = fakeRepTx([{ id: 'r1', refType: 'TopicChunk', refId: 'c1', intervalDays: 9, priority: 'NORMAL' }, { id: 'r2', refType: 'Expr', refId: 'e', intervalDays: 6, priority: 'FOCUS' }])
  const out = await registerRepetitionItems(
    'u1',
    [
      { itemType: 'CHUNK', refType: 'TopicChunk', refId: 'c1', textJa: 'コーヒー', meaningKo: '커피', correct: 2 },
      { itemType: 'EXPRESSION', refType: 'Expr', refId: 'e', textJa: '注文', meaningKo: '주문', wrong: 1 },
      { itemType: 'GRAMMAR', refType: 'Grammar', refId: 'g', textJa: '〜をください', meaningKo: '~주세요' },
    ],
    tx,
    { today: '2026-09-28', now: new Date('2026-09-28T03:00:00Z') },
  )
  assert.deepEqual(out.map((o) => [o.id, o.created]), [['r1', false], ['r2', false], ['new1', true]])
  const u1 = calls[0].args as { data: Record<string, unknown> }
  assert.deepEqual(u1.data.studiedCount, { increment: 1 })
  assert.deepEqual(u1.data.correctCount, { increment: 2 })
  assert.equal(u1.data.intervalDays, 7, '9 → 7 클램프')
  assert.equal((u1.data.nextDueAt as Date).toISOString().slice(0, 10), '2026-10-05')
  assert.equal(u1.data.decidedBy, 'FALLBACK')
  const u2 = calls[1].args as { data: Record<string, unknown> }
  assert.equal(u2.data.intervalDays, 3, 'FOCUS 는 3 이하')
  const c = calls[2].args as { data: Record<string, unknown> }
  assert.deepEqual([c.data.studiedCount, c.data.intervalDays, c.data.decidedBy, c.data.userId], [1, 3, 'FALLBACK', 'u1'])
  assert.equal((c.data.nextDueAt as Date).toISOString().slice(0, 10), '2026-10-01')
  assert.deepEqual(await registerRepetitionItems('u1', [], tx), [])
})

// ── progress(#61) ────────────────────────────────────────────────────────

const LIM = { segmentCount: 3, quizCount: 5, applicationCount: 3 }

test('#61 progress: 클라이언트 칸만, 서버 칸·모르는 키 400, 8KB 상한', () => {
  assert.throws(() => parseProgressPatch({ speaking: [] }, LIM), code('VALIDATION', 'unknown_key'))
  assert.throws(() => parseProgressPatch({ listen: { proposed: [] } }, LIM), code('VALIDATION', 'unknown_key'))
  assert.throws(() => parseProgressPatch({ extra: 1 }, LIM), code('VALIDATION', 'unknown_key'))
  assert.throws(() => parseProgressPatch([], LIM), code('VALIDATION'))
  assert.throws(() => parseProgressPatch({ application: { answers: ['あ'.repeat(201)] } }, LIM), code('VALIDATION'))
  assert.throws(() => parseProgressPatch({ quiz: { answers: [4] } }, LIM), code('VALIDATION'))
  assert.throws(() => parseProgressPatch({ quiz: { answers: [0, 0, 0, 0, 0, 0] } }, LIM), code('VALIDATION'))
  assert.throws(() => parseProgressPatch({ listen: { segmentsDone: [4] } }, LIM), code('VALIDATION'))
  assert.throws(() => parseProgressPatch({ application: { answers: ['x'.repeat(3000), 'y'.repeat(3000), 'z'.repeat(3000)] } }, LIM), code('VALIDATION', 'TOO_LARGE'))
  const p = parseProgressPatch({ listen: { segmentsDone: [2, 1, 2], played: { slow: [1] }, memo: [{ segment: 1, ja: ' 注文 ' }] }, quiz: { answers: [1, null] } }, LIM)
  assert.deepEqual(p.listen, { segmentsDone: [1, 2], played: { slow: [1] }, memo: [{ segment: 1, ja: '注文' }] })
})

test('#61 메모 초안 한도: 구간 5·레슨 15·같은 구간 중복·비일본어', () => {
  const memo = (seg: number, n: number) => Array.from({ length: n }, (_, i) => ({ segment: seg, ja: `語${seg}${i}` }))
  assert.throws(() => parseProgressPatch({ listen: { memo: memo(1, 6) } }, LIM), code('VALIDATION', 'LIMIT'))
  assert.throws(() => parseProgressPatch({ listen: { memo: [...memo(1, 5), ...memo(2, 5), ...memo(3, 5), { segment: 3, ja: '追加' }] } }, { ...LIM }), code('VALIDATION', 'LIMIT'))
  assert.throws(() => parseProgressPatch({ listen: { memo: [{ segment: 1, ja: '注文' }, { segment: 1, ja: '注文' }] } }, LIM), code('VALIDATION', 'DUPLICATE'))
  assert.throws(() => parseProgressPatch({ listen: { memo: [{ segment: 1, ja: 'coffee' }] } }, LIM), code('VALIDATION', 'NOT_JAPANESE'))
})

test('#61 병합: 서버 칸 보존·quiz 첫 답 고정·segmentsDone 합집합·application 보낸 칸만', () => {
  const cur: LessonProgress = {
    listen: { segmentsDone: [1], proposed: [{ ja: '注文', segment: 1, result: 'PROPOSED', proposalId: 'p1', wordId: null }] },
    quiz: { answers: [2, null] },
    application: { answers: ['紅茶をください', null] },
    speaking: [{ itemId: 's1', text: 'x', matchedIds: [], missedIds: [], utteranceId: null, at: 't' }],
  }
  const next = mergeProgress(cur, parseProgressPatch({ listen: { segmentsDone: [2] }, quiz: { answers: [0, 1, 3] }, application: { answers: [null, '持ち帰ります'] } }, LIM))
  assert.deepEqual(next.listen?.segmentsDone, [1, 2])
  assert.deepEqual(next.listen?.proposed, cur.listen?.proposed, '서버 칸 보존')
  assert.deepEqual(next.quiz?.answers, [2, 1, 3], '이미 답한 q1 은 바뀌지 않음')
  assert.deepEqual(next.application?.answers, ['紅茶をください', '持ち帰ります'])
  assert.deepEqual(next.speaking, cur.speaking)
  const again = withSpeaking(next, { itemId: 's1', text: 'y', matchedIds: ['c1'], missedIds: [], utteranceId: 'u', at: 't2' })
  assert.equal(again.speaking?.length, 1, '같은 과제는 교체')
  assert.equal(again.speaking?.[0].text, 'y')
  assert.deepEqual(readProgress('x'), {})
})

// ── 본문 검증 ────────────────────────────────────────────────────────────

test('#59 본문: topicId·sourceText 정확히 하나, 문장 50~2,000자·일본어 ≥30%', () => {
  assert.deepEqual(parseCreateLessonBody({ topicId: 't1' }), { kind: 'topic', topicId: 't1' })
  assert.throws(() => parseCreateLessonBody({}), code('VALIDATION', 'one_of'))
  assert.throws(() => parseCreateLessonBody({ topicId: 't1', sourceText: 'x' }), code('VALIDATION', 'one_of'))
  assert.throws(() => parseCreateLessonBody({ topicId: '../x' }), code('VALIDATION'))
  assert.throws(() => parseCreateLessonBody({ sourceText: '短い' }), code('VALIDATION'))
  assert.throws(() => parseCreateLessonBody({ sourceText: 'This is an English sentence, not Japanese at all. '.repeat(2) }), code('VALIDATION', 'NOT_JAPANESE'))
  assert.throws(() => parseCreateLessonBody({ extra: 1, topicId: 't' }), code('VALIDATION', 'unknown_key'))
  const text = '今日は友達とカフェに行きました。コーヒーを飲みながら、週末の予定について話しました。とても楽しかったです。'
  const r = parseCreateLessonBody({ sourceText: `  ${text}  ` })
  assert.equal(r.kind, 'text')
  assert.ok(japaneseRatio(text) > 0.9)
})

test('#61·#62·#62a·#62b·#62c 본문 검증', () => {
  assert.throws(() => parseProgressBody({}), code('VALIDATION', 'required'))
  assert.throws(() => parseProgressBody({ stageDone: 6 }), code('VALIDATION'))
  assert.deepEqual(parseProgressBody({ stageDone: 3 }), { stageDone: 3, progress: undefined })
  assert.throws(() => parseCompleteBody({ score: 101 }), code('VALIDATION'))
  assert.doesNotThrow(() => parseCompleteBody({ score: 80 }))
  assert.throws(() => parseCompleteBody({ extra: 1 }), code('VALIDATION', 'unknown_key'))
  const memo = parseMemoBody({ segments: [{ segment: 1, words: ['注文', 'coffee', ' ホット '] }] })
  assert.deepEqual(memo.map((m) => [m.segment, m.ja]), [[1, '注文'], [1, null], [1, 'ホット']])
  assert.throws(() => parseMemoBody({ segments: [{ segment: 1, words: ['一', '二', '三', '四', '五', '六'] }] }), code('VALIDATION'))
  assert.throws(() => parseMemoBody({ segments: [] }), code('VALIDATION'))
  assert.throws(() => parseMemoBody({ segments: Array.from({ length: 4 }, (_, i) => ({ segment: i + 1, words: ['一', '二', '三', '四'] })) }), code('VALIDATION', 'LIMIT'))
  assert.deepEqual(parseSpeakingBody({ itemId: 's1', text: ' コーヒー ', utteranceId: 'u_1' }), { itemId: 's1', text: 'コーヒー', utteranceId: 'u_1' })
  assert.throws(() => parseSpeakingBody({ itemId: 's1', text: '  ' }), code('VALIDATION', 'empty'))
  assert.throws(() => parseSpeakingBody({ itemId: 's1', text: 'a', utteranceId: '../x' }), code('VALIDATION'))
  assert.deepEqual(parseAudioBody({ kind: 'dialogue', idx: 2 }), { kind: 'dialogue', idx: 2, pace: 'normal' })
  assert.throws(() => parseAudioBody({ kind: 'quiz', idx: 0 }), code('VALIDATION'))
  assert.throws(() => parseAudioBody({ kind: 'dialogue', idx: 0, pace: 'fast' }), code('VALIDATION'))
  assert.throws(() => parseAudioBody({ kind: 'dialogue', idx: 0, speed: 1.2 }), code('VALIDATION', 'unknown_key'))
  const c = toStoredContent(gen())
  assert.equal(audioText(c, 'dialogue', 1), 'ホットコーヒーをください。')
  assert.equal(audioText(c, 'grammar', 0), '水をください。')
  assert.equal(audioText(c, 'speaking', 2), '小さいサイズでお願いします。')
  assert.equal(audioText(c, 'application', 3), null)
})

// ── 메모 계획(#62a) ────────────────────────────────────────────────────────

test('#62a 메모 계획: 조각(표기·읽기) → 조각 뜻, 없으면 보강 대상, 요청 중복·한도·이전 결과', () => {
  const c = toStoredContent(gen())
  const words = [
    { segment: 1, ja: 'ちゅうもん', raw: 'ちゅうもん' },
    { segment: 1, ja: 'ホット', raw: 'ホット' },
    { segment: 1, ja: 'ホット', raw: 'ホット' },
    { segment: 2, ja: null, raw: 'hot' },
    { segment: 2, ja: 'コーヒー', raw: 'コーヒー' },
  ]
  const { entries, surfaces } = planMemoEntries(c, 'ls1', { drafts: [], processed: [{ ja: 'コーヒー', segment: 1, result: 'IN_WORDBOOK', proposalId: null, wordId: 'w9' }] }, words)
  assert.deepEqual(entries.map((e) => e.action), ['PROPOSE', 'ENRICH', 'SKIP', 'SKIP', 'KNOWN'])
  const p = entries[0] as Extract<(typeof entries)[number], { action: 'PROPOSE' }>
  assert.deepEqual([p.draft.surface, p.draft.reading, p.draft.meaning, p.draft.via, p.draft.memo, p.draft.lineIdx], ['注文', 'ちゅうもん', '주문', 'CHUNK', 'ちゅうもん', 0])
  assert.equal(p.draft.example, c.dialogue[0].ja, '예문 = 그 단어가 나온 대화 줄')
  const e = entries[1] as Extract<(typeof entries)[number], { action: 'ENRICH' }>
  assert.equal(e.lineIdx, 1, '같은 구간 줄')
  assert.deepEqual([(entries[2] as { reason: string }).reason, (entries[3] as { reason: string }).reason], ['DUPLICATE', 'NOT_JAPANESE'])
  assert.deepEqual(surfaces, ['注文', 'ホット'])
  const wb = applyWordbook(entries, new Map([['ホット', 'w1']]))
  assert.deepEqual([wb[1].action, (wb[1] as { reason?: string }).reason, (wb[1] as { wordId?: string }).wordId], ['SKIP', 'IN_WORDBOOK', 'w1'])
})

test('#62a 메모 한도: 기존 초안 포함 구간 5·레슨 15 → LIMIT, 이미 적은 단어는 한도에 다시 세지 않음', () => {
  const c = toStoredContent(gen())
  const drafts = Array.from({ length: 5 }, (_, i) => ({ segment: 1, ja: `語${i}` }))
  const r = planMemoEntries(c, 'ls1', { drafts, processed: [] }, [
    { segment: 1, ja: '語0', raw: '語0' },
    { segment: 1, ja: '新語', raw: '新語' },
    { segment: 2, ja: '別語', raw: '別語' },
  ])
  assert.deepEqual(r.entries.map((e) => (e.action === 'SKIP' ? e.reason : e.action)), ['ENRICH', 'LIMIT', 'ENRICH'])
  const full = Array.from({ length: 15 }, (_, i) => ({ segment: (i % 3) + 1, ja: `全${i}` }))
  const r2 = planMemoEntries(c, 'ls1', { drafts: full, processed: [] }, [{ segment: 3, ja: '追加', raw: '追加' }])
  assert.equal((r2.entries[0] as { reason?: string }).reason, 'LIMIT')
})

test('#62a 보강 결과 → 초안: valid=false 는 null(NOT_JAPANESE), 예문은 대화 줄 우선', () => {
  const entry = { memo: 'ホット', segment: 1, action: 'ENRICH' as const, surface: 'ホット', lineIdx: 1, example: 'ホットコーヒーをください。', exampleKo: '따뜻한 커피 주세요.' }
  const base = { surface: 'ホット', valid: true, invalidReason: null, reading: 'ほっと', meaning: '따뜻한 음료', partOfSpeech: 'NOUN' as const, jlpt: 'N5' as const, example: 'ホットにします。', exampleKo: '따뜻한 걸로.' }
  const d = memoDraftFromEnrich(entry, 'ls1', base)!
  assert.deepEqual([d.via, d.meaning, d.example, d.exampleKo, d.lessonId], ['ENRICH', '따뜻한 음료', 'ホットコーヒーをください。', '따뜻한 커피 주세요.', 'ls1'])
  assert.equal(memoDraftFromEnrich({ ...entry, example: null, exampleKo: null }, 'ls1', base)!.example, 'ホットにします。')
  assert.equal(memoDraftFromEnrich(entry, 'ls1', { ...base, valid: false, meaning: null }), null)
})

// ── 주제(#56) ────────────────────────────────────────────────────────────

test('#56 수준 창 ±1·쿼리 검증', () => {
  assert.deepEqual(levelWindow('N5'), ['N5', 'N4'])
  assert.deepEqual(levelWindow('N3'), ['N4', 'N3', 'N2'])
  assert.deepEqual(levelWindow('N1'), ['N2', 'N1'])
  assert.deepEqual(parseTopicQuery(new URLSearchParams('level=N4&mine=1')), { level: 'N4', mine: true })
  assert.deepEqual(parseTopicQuery(new URLSearchParams('')), { level: null, mine: false })
  assert.throws(() => parseTopicQuery(new URLSearchParams('level=N6')), code('VALIDATION'))
  assert.throws(() => parseTopicQuery(new URLSearchParams('sort=x')), code('VALIDATION', 'unknown_key'))
})
