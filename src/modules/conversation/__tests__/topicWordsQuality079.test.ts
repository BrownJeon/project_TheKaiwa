/**
 * task-079 갈래 A — A12 새 단어 검사 두 가지(LLM 호출 0, 오프라인).
 *  ① IMP-0057: 표기가 전부 가타카나면 읽기도 가타카나로 정규화(기본 사전 SEED 규칙 528/528).
 *  ② IMP-0058: 중국어 전용 한자(간체자 등)가 표기·예문에 있으면 버린다(`SURFACE_SIMPLIFIED`·`EXAMPLE_JA_SIMPLIFIED`).
 *
 * 핵심은 ②의 **오탐 0**이다 — 일본어에 쓰는 글자를 막으면 멀쩡한 단어를 잃는다. 그래서 차단 목록(`chineseOnlyHanzi.ts`)을 세 가지로 묶는다:
 *   (a) 기본 사전 JLPT 시드 7,755개·그 밖 시드 JSON 의 모든 문자열에 한 글자도 없음
 *   (b) 런타임 디코더가 아는 일본어 한자(Shift_JIS = JIS X 0208+NEC/IBM 확장, EUC-JP = JIS X 0208+0212 — 6,682+5,801자)와 겹치지 않음
 *   (c) 목록 전부가 GBK 한자(= 중국어에 있는 글자)
 * (b)·(c) 는 목록을 만든 Python 코덱과 **다른 도구**(Node `TextDecoder`)로 다시 확인하는 독립 검산이다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assembleTopicWords,
  checkTopicExample,
  normalizeTopicReading,
  readingMatchesSurface,
  toHiragana,
  toKatakana,
  type TopicWordDropReason,
} from '../prompts/topicWords'
import { CHINESE_ONLY_HANZI, hasChineseOnlyHanzi } from '../structuredResponse/chineseOnlyHanzi'

// ── 시드 읽기(미러 루트 = process.cwd(), 다른 시드 시험과 같은 방법) ─────────────────────────────────

interface SeedWord { surface: string; reading: string; meaning: string; example?: string | null; exampleKo?: string | null }
const SEED_DIR = join(process.cwd(), 'prisma/seed-data')
const JLPT_FILES = ['n5', 'n4', 'n3', 'n2', 'n1'].map((n) => join(SEED_DIR, 'jlpt', `${n}.json`))

function seedWords(): SeedWord[] {
  for (const f of JLPT_FILES) assert.ok(existsSync(f), `시드 파일이 없다(건너뛰지 않는다): ${f}`)
  return JLPT_FILES.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as SeedWord[])
}

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) collectStrings(x, out)
}

const w = (textJa: string, reading: string, over: Record<string, unknown> = {}) => ({
  textJa, reading, meaningKo: '뜻', chunkType: 'NAME', jlpt: null, valid: true, exampleJa: null, exampleKo: null, ...over,
})
const one = (item: ReturnType<typeof w>, level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' = 'N3') => assembleTopicWords({ words: [item] }, { level })

// ── ① IMP-0057 가타카나 읽기 정규화 ───────────────────────────────────────────────────────────────

test('IMP-0057 정규화 표: 전부 가타카나인 표기(ー·・ 포함)는 읽기를 가타카나로 / 히라가나·한자가 섞인 표기는 그대로', () => {
  const rows: Array<[string, string, string]> = [
    // 표기, 모델이 낸 읽기, 기대
    ['コーヒー', 'こーひー', 'コーヒー'],
    ['アイスクリーム', 'あいすくりーむ', 'アイスクリーム'],
    ['ピアノ', 'ぴあの', 'ピアノ'], // 반탁음
    ['ヴァイオリン', 'ゔぁいおりん', 'ヴァイオリン'], // ゔ → ヴ, 작은 ぁ → ァ
    ['チョコレート', 'ちょこれーと', 'チョコレート'],
    ['コーヒー', 'こーヒー', 'コーヒー'], // 섞여 와도 한 종류로
    ['ケーキ', 'ケーキ', 'ケーキ'], // 이미 가타카나 — 불변
    ['ホット・ドッグ', 'ほっと・どっぐ', 'ホット・ドッグ'], // 가운뎃점 표기, ・ 는 그대로
    ['メール便', 'めーるびん', 'めーるびん'], // 한자 섞임 — 불변
    ['お茶', 'おちゃ', 'おちゃ'], // 히라가나·한자 — 불변
    ['ありがとう', 'ありがとう', 'ありがとう'], // 전부 히라가나 — 불변(가타카나 표기가 아니다)
    ['いただきます', 'いただきます', 'いただきます'],
  ]
  for (const [surface, reading, want] of rows) assert.equal(normalizeTopicReading(surface, reading), want, `${surface} / ${reading}`)
  // 소리 없는 부호만 있는 표기는 가타카나 표기로 보지 않는다(읽기를 건드리지 않는다)
  assert.equal(normalizeTopicReading('ー', 'ー'), 'ー')
  assert.equal(normalizeTopicReading('・', 'ぁ'), 'ぁ')
})

test('IMP-0057 assembleTopicWords: 통과 항목의 읽기만 정규화 · 읽기 불일치는 여전히 버린다(느슨해지지 않음) · 중복 키는 표기 기준', () => {
  const ok = one(w('コーヒー', 'こーひー'))
  assert.deepEqual(ok.words.map((x) => [x.textJa, x.reading]), [['コーヒー', 'コーヒー']])
  assert.deepEqual(ok.droppedByReason, {})
  // 소리가 다른 읽기(長音 → 'う')는 정규화 이전에 READING_MISMATCH 로 버려진다 — 가나 종류만 접는다
  const bad = one(w('コーヒー', 'こうひい'))
  assert.equal(bad.words.length, 0)
  assert.deepEqual(bad.droppedByReason, { READING_MISMATCH: 1 })
  // 한자 섞인 표기·히라가나 표기는 모델이 낸 읽기 그대로
  assert.equal(one(w('メール便', 'めーるびん')).words[0].reading, 'めーるびん')
  assert.equal(one(w('お茶', 'おちゃ')).words[0].reading, 'おちゃ')
  // 같은 표기를 읽기 종류만 바꿔 두 번 내도 중복(표기 키) — 읽기 정규화가 중복 판정을 바꾸지 않는다
  const dup = assembleTopicWords({ words: [w('ケーキ', 'けーき', { meaningKo: '케이크' }), w('ケーキ', 'ケーキ', { meaningKo: '케이크 한 조각' })] }, { level: 'N3' })
  assert.deepEqual(dup.words.map((x) => x.reading), ['ケーキ'])
  assert.deepEqual(dup.droppedByReason, { DUP_RESPONSE: 1 })
  // 제외 목록과 같은 표기는 읽기와 상관없이 DUP_EXCLUDED
  assert.deepEqual(assembleTopicWords({ words: [w('コーヒー', 'こーひー')] }, { level: 'N3', exclude: ['コーヒー'] }).droppedByReason, { DUP_EXCLUDED: 1 })
  // 출력 칸은 그대로 — 새 칸 없음(라우트 이음매 시험 task049TopicWordsSeam 이 키 전수를 대조한다)
  assert.deepEqual(Object.keys(ok.words[0]).sort(), ['chunkType', 'exampleJa', 'exampleKo', 'jlpt', 'meaningKo', 'reading', 'textJa'])
})

test('IMP-0057 기본 사전 SEED 와 같은 규칙: 가타카나 표기 전부(528) 가타카나 읽기 · 정규화는 SEED 읽기에 대해 항등 · 히라가나로 바꿔 와도 SEED 읽기로 돌아온다', () => {
  const kata = seedWords().filter((s) => /^[ァ-ヺー・]+$/.test(s.surface) && /[ァ-ヺ]/.test(s.surface))
  assert.ok(kata.length >= 528, `가타카나 표기 시드 ${kata.length}개`)
  for (const s of kata) {
    assert.match(s.reading, /^[ァ-ヺー・]+$/, `SEED 가타카나 표기는 가타카나 읽기: ${s.surface} → ${s.reading}`)
    assert.equal(normalizeTopicReading(s.surface, s.reading), s.reading, `항등: ${s.surface}`)
    const hira = toHiragana(s.reading)
    assert.ok(readingMatchesSurface(s.surface, hira), `모델이 히라가나로 낸 읽기도 ③+ 검사는 통과한다: ${s.surface}`)
    assert.equal(normalizeTopicReading(s.surface, hira), s.reading, `정규화하면 SEED 읽기: ${s.surface}`)
  }
  // 가나 변환 왕복 — 히라가나 쪽 범위(ぁ-ゖ)와 가타카나 쪽 범위(ァ-ヶ)가 한 칸씩 대응한다
  assert.equal(toKatakana('ぁ-ゖ'), 'ァ-ヶ')
  assert.equal(toHiragana(toKatakana('あいうえおかきくけこがぎぐげござじずぜぞゔぱぴぷぺぽっゃゅょゎ')), 'あいうえおかきくけこがぎぐげござじずぜぞゔぱぴぷぺぽっゃゅょゎ')
})

// ── ② IMP-0058 간체자 차단 ───────────────────────────────────────────────────────────────────

test('IMP-0058 차단: 간체자가 든 표기는 SURFACE_SIMPLIFIED 로 버린다 — 이 반의 실례 怎样ですか 포함', () => {
  const rows: Array<[string, string, string]> = [
    ['怎样ですか', 'いかがですか', '样'], // PE 때 본 실례
    ['这个', 'このこ', '这'],
    ['我们', 'われわれ', '们'],
    ['记念品', 'きねんひん', '记'],
    ['买い物', 'かいもの', '买'],
    ['请问', 'しつもん', '请'],
    ['谢谢', 'ありがとう', '谢'],
    ['说明', 'せつめい', '说'],
    ['学习', 'がくしゅう', '习'], // 学 은 일본어 신자체라 통과하고 习 가 잡는다
    ['电话', 'でんわ', '电'],
  ]
  for (const [surface, reading, why] of rows) {
    assert.ok(hasChineseOnlyHanzi(surface), `${surface} — ${why}`)
    assert.ok(CHINESE_ONLY_HANZI.includes(why), `${why} 가 목록에 있다`)
    const r = one(w(surface, reading))
    assert.equal(r.words.length, 0, surface)
    assert.deepEqual(r.droppedByReason, { SURFACE_SIMPLIFIED: 1 }, surface)
    assert.deepEqual(r.dropped, [{ textJa: surface, reason: 'SURFACE_SIMPLIFIED' as TopicWordDropReason }])
  }
})

test('IMP-0058 오탐 0: 흔한 일본어 한자(신자체·구자체·일본식 한자)는 막지 않는다', () => {
  const ok = [
    '記念品', '体験', '点滴', '商品', '品質', '点', '体', '品', '国', '学', '気', // Leader 임시 후보 목록이 간체자로 잘못 잡았던 것 포함
    '経験', '関係', '会議', '学校', '国際', '駅', '売る', '続く', '読む', '団体', '円', '実', '頭', '島', '岡', '蘭', '衛', '師', '鳥', '馬', '魚', '貝', '見', '車', '門',
    '開', '説', '請', '問', '謝', '習', '電話', '観', '関', '歯', '齢', '竜', '亀', '塩', '嘘', '掴', '躓', '鷹', '靴', '画', '図', '写', '広', '験', '医者', '医院',
    '々', '々々', // 반복 부호
  ]
  for (const t of ok) assert.equal(hasChineseOnlyHanzi(t), false, t)
  // 단어 검사 전체를 통과시킨 결과로도 확인 — 읽기는 합성이라 다른 이유(READING_*)로 버려질 수 있고, 이 시험은 SURFACE_SIMPLIFIED 가 없다는 것만 본다
  for (const t of ['記念品', '体験', '点滴', '商品', '品質', '国際', '学校']) {
    assert.equal(one(w(t, 'あ'.repeat([...t].length * 3))).droppedByReason.SURFACE_SIMPLIFIED, undefined, t)
  }
  // 일본어 한자 ↔ 같은 뜻의 간체자: 일본어 쪽은 통과, 중국어 쪽은 차단
  const pairs: Array<[string, string]> = [['記', '记'], ['電', '电'], ['説', '说'], ['謝', '谢'], ['買', '买'], ['請', '请'], ['習', '习'], ['学習', '学习'], ['質問', '质问']]
  for (const [ja, zh] of pairs) {
    assert.equal(hasChineseOnlyHanzi(ja), false, ja)
    assert.equal(hasChineseOnlyHanzi(zh), true, zh)
  }
})

test('IMP-0058 오탐 0 (a): 기본 사전 JLPT 시드 7,755개의 표기·예문과 그 밖 시드 JSON 의 모든 문자열에 차단 글자가 하나도 없다', () => {
  const seeds = seedWords()
  assert.ok(seeds.length >= 7755, `시드 ${seeds.length}개`)
  const hits: string[] = []
  for (const s of seeds) {
    for (const [field, text] of [['surface', s.surface], ['reading', s.reading], ['example', s.example ?? '']] as const) {
      if (hasChineseOnlyHanzi(text)) hits.push(`${field}: ${text}`)
    }
  }
  assert.deepEqual(hits, [], '시드의 일본어 칸에 차단 글자')
  // 시드 표기를 실제 검사에 통과시켜도 SURFACE_SIMPLIFIED 는 0 (다른 이유로 버려지는 것은 이 시험의 관심사가 아니다)
  const asm = assembleTopicWords({ words: seeds.map((s) => w(s.surface, s.reading, { meaningKo: s.meaning })) }, { level: 'N3' })
  assert.equal(asm.received, seeds.length)
  assert.equal(asm.droppedByReason.SURFACE_SIMPLIFIED, undefined)
  // 그 밖 시드 JSON(주제·시나리오·사전·칸 재분류 등) — 어느 칸이든 문자열 전부
  const files = [
    ...readdirSync(SEED_DIR).filter((f) => f.endsWith('.json')).map((f) => join(SEED_DIR, f)),
    ...readdirSync(join(SEED_DIR, 'jlpt')).filter((f) => f.endsWith('.json')).map((f) => join(SEED_DIR, 'jlpt', f)),
  ]
  assert.ok(files.length >= 10, `시드 JSON ${files.length}개`)
  for (const f of files) {
    const strings: string[] = []
    collectStrings(JSON.parse(readFileSync(f, 'utf8')) as unknown, strings)
    const bad = strings.filter((t) => hasChineseOnlyHanzi(t))
    assert.deepEqual(bad.slice(0, 5), [], `${f} 에 차단 글자`)
  }
})

/** 런타임(Node/ICU) 디코더로 2바이트 한자를 열거한다 — 목록을 만든 Python 코덱과 다른 도구. */
function decodeHanzi(label: string, leads: number[], trails: number[], prefix: number[] = []): Set<string> {
  const d = new TextDecoder(label, { fatal: true })
  const out = new Set<string>()
  for (const a of leads) {
    for (const b of trails) {
      try {
        const s = d.decode(Uint8Array.from([...prefix, a, b]))
        if ([...s].length === 1 && /[㐀-䶿一-鿿]/.test(s)) out.add(s)
      } catch {
        // 빈 칸 — 건너뜀
      }
    }
  }
  return out
}
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

test('IMP-0058 오탐 0 (b)·(c): 차단 목록은 일본어 문자 표준 한자(Shift_JIS·EUC-JP·JIS X 0212)와 겹치지 않고 전부 GBK 한자다 — 독립 디코더 검산', () => {
  const sjis = decodeHanzi('shift_jis', [...range(0x81, 0x9f), ...range(0xe0, 0xfc)], range(0x40, 0xfc))
  const eucjp = decodeHanzi('euc-jp', range(0xa1, 0xfe), range(0xa1, 0xfe))
  const jisx0212 = decodeHanzi('euc-jp', range(0xa1, 0xfe), range(0xa1, 0xfe), [0x8f])
  const gbk = decodeHanzi('gbk', range(0x81, 0xfe), range(0x40, 0xfe))
  // 디코더가 실제로 일하는지(ICU 없는 Node 에서 빈 집합이 되어 시험이 헛통과하는 것 방지)
  assert.ok(sjis.size > 6000, `shift_jis 한자 ${sjis.size}`)
  assert.ok(eucjp.size > 6000, `euc-jp 한자 ${eucjp.size}`)
  assert.ok(jisx0212.size > 5000, `JIS X 0212 한자 ${jisx0212.size}`)
  assert.ok(gbk.size > 20000, `gbk 한자 ${gbk.size}`)
  const jp = new Set([...sjis, ...eucjp, ...jisx0212])
  const block = [...CHINESE_ONLY_HANZI]
  assert.deepEqual(block.filter((c) => jp.has(c)), [], '일본어 한자와 겹치는 차단 글자')
  assert.deepEqual(block.filter((c) => !gbk.has(c)), [], 'GBK 한자가 아닌 차단 글자')
  // 일본어 한자 전수 통과 — 표준 한자 6,682자 + JIS X 0212 5,801자 중 하나라도 막히면 실패
  const blockedJp = [...jp].filter((c) => hasChineseOnlyHanzi(c))
  assert.deepEqual(blockedJp, [], '막힌 일본어 한자')
})

test('IMP-0058 목록 고정점: 2,275자·중복 없음·한자만 · 간체자 대표는 있고 일본어 신자체는 없다 (목록을 손으로 고치면 여기서 깨진다)', () => {
  const chars = [...CHINESE_ONLY_HANZI]
  assert.equal(chars.length, 2275)
  assert.equal(new Set(chars).size, chars.length)
  for (const c of chars) assert.match(c, /^[一-鿿]$/, `한자가 아님: ${c} U+${(c.codePointAt(0) ?? 0).toString(16)}`)
  for (const c of '样这们记买请谢说习电话问员图团对时见') assert.ok(CHINESE_ONLY_HANZI.includes(c), `간체자 ${c}`)
  for (const c of '国学気体点品経関駅売続読円実頭島岡蘭衛師鳥馬魚貝見車門開説謝習') assert.equal(CHINESE_ONLY_HANZI.includes(c), false, `일본어 한자 ${c}`)
})

/**
 * 목록 내용 고정(REV-079 F-1). 위 (b) 의 독립 검산은 Node 디코더가 아는 표준(JIS X 0208·0212·Shift_JIS)만 열거한다 — Node 에는 JIS X 0213 이 없어서
 * 0213 에만 있는 한자를 사람이 목록에 넣어도 (a)(b)(c) 가 모두 통과한다(변이 M1b: 龟 → 丏 한 글자 교체가 14개 시험을 모두 통과했다).
 * 그 구멍을 두 가지로 막는다: ① 일본어 표준 안에 있는 간체 모양 대표 글자가 **목록에 없음** ② 정렬한 목록의 sha256 고정.
 * 목록을 의도해서 다시 계산했다면 아래 해시를 함께 갱신한다(실패 메시지가 새 해시를 보여 준다). 재계산 방법은 `chineseOnlyHanzi.ts` 머리 주석.
 */
const CHINESE_ONLY_HANZI_SHA256 = '8b244eb78b2f4aa720eec8b9252c8f49d47382c56a1c294c24a9b643b061475f'

test('IMP-0058 목록 내용 고정(REV-079 F-1): JIS 안의 간체 모양은 목록에 없어야 한다 · 정렬한 목록 sha256 고정 · 크기 2,275', () => {
  const inJapaneseStandards: Record<string, string> = {
    个: 'JIS X 0208', 吧: 'JIS X 0212/0213', 你: 'JIS X 0212/0213', 她: 'JIS X 0212/0213', 两: 'JIS X 0212/0213', 哪: 'JIS X 0212/0213', 运: 'JIS X 0212/0213',
    开: 'JIS X 0213 전용', 关: 'JIS X 0213 전용', 么: 'JIS X 0213 전용', 养: 'JIS X 0213 전용', 种: 'JIS X 0213 전용', 阴: 'JIS X 0213 전용', 荣: 'JIS X 0213 전용', 复: 'JIS X 0213 전용',
    丏: 'JIS X 0213 전용(GB2312 밖)',
  }
  for (const [c, why] of Object.entries(inJapaneseStandards)) {
    assert.equal(CHINESE_ONLY_HANZI.includes(c), false, `${c} (${why}) 는 일본어 문자 표준에 있어 목록에 넣으면 오탐이다`)
    assert.equal(hasChineseOnlyHanzi(c), false, c)
  }
  // 알려진 미탐 — 의도다(오탐 0 의 대가, 이 변경 전과 같은 상태). 이 줄을 «고치려고» 목록에 글자를 더하면 위 단언이 먼저 깨진다.
  for (const missed of ['开始', '关于', '你好', '养成']) assert.equal(hasChineseOnlyHanzi(missed), false, `알려진 미탐: ${missed}`)
  assert.equal(hasChineseOnlyHanzi('这么'), true, '这 는 목록에 있어 걸린다(么 는 없다)')

  const chars = [...CHINESE_ONLY_HANZI]
  assert.equal(chars.length, 2275)
  const sorted = [...chars].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)).join('')
  const sha = createHash('sha256').update(sorted, 'utf8').digest('hex')
  assert.equal(sha, CHINESE_ONLY_HANZI_SHA256, `목록 내용이 바뀌었다 — 의도했다면 시험의 해시를 ${sha} 로 갱신하고, JIS X 0213 전용 글자가 섞이지 않았는지 확인한다`)
})

// ── ② 예문 ─────────────────────────────────────────────────────────────────────────────────────

test('IMP-0058 예문: 간체자가 든 일본어 예문은 예문 쌍만 null(EXAMPLE_JA_SIMPLIFIED), 단어는 남는다 · 정상 예문은 통과', () => {
  const bad = checkTopicExample('这个很好です。', '이것은 좋아요.')
  assert.deepEqual(bad, { exampleJa: null, exampleKo: null, reason: 'EXAMPLE_JA_SIMPLIFIED' })
  assert.deepEqual(checkTopicExample('記念品を買いました。', '기념품을 샀어요.'), { exampleJa: '記念品を買いました。', exampleKo: '기념품을 샀어요.', reason: null })
  // 다른 불량이 먼저면 그 이유(순서: 문자 구성 → 간체자)
  assert.equal(checkTopicExample('这个 (kore)', '이것').reason, 'EXAMPLE_JA_CHARS')
  const asm = one(w('買い物', 'かいもの', { exampleJa: '我们は买い物をします。', exampleKo: '우리는 쇼핑을 해요.' }))
  assert.equal(asm.words.length, 1, '단어는 유지')
  assert.deepEqual([asm.words[0].exampleJa, asm.words[0].exampleKo], [null, null])
  assert.equal(asm.exampleNulled, 1)
  assert.deepEqual(asm.exampleNulledByReason, { EXAMPLE_JA_SIMPLIFIED: 1 })
  // 시드 예문: 간체자 이유로 null 이 되는 예문은 0
  const reasons = seedWords().map((s) => checkTopicExample(s.example, s.exampleKo).reason)
  assert.equal(reasons.filter((r) => r === 'EXAMPLE_JA_SIMPLIFIED').length, 0)
})
