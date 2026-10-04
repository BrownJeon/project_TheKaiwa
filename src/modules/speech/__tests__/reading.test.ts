import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  alignWordRuby,
  hangulLine,
  kanaToHangul,
  pronLine,
  rubyPieces,
  toRubyMarkup,
  WORD_RUBY_MAX_READING,
  WORD_RUBY_MAX_SURFACE,
  type ReadingSegment,
} from '../reading/client'
import { annotateReadings, READING_CACHE_LIMITS, readingCacheStats, readingInflightStats, resetReadingCache } from '../reading'
import { text } from '@/modules/engine'

const { TextAnalyzerError } = text
const annotateHttp = text.annotate

/**
 * task-026 S1 — 가나→한글 변환기(데모 v2 `HG.convert(p,'A','B')` 와 같은 결과 — D1-A '까' 계열), 루비·발음 줄 조립, 단어 표제어 정렬,
 * 서버 읽기 모듈(캐시·degrade), 텍스트 분석 어댑터(시크릿 대상·응답 검증), 클라이언트 모듈 경계.
 */

// ── 가나 → 한글 전수 표 ──────────────────────────────────────────────────────────
// 구절 첫 글자(거센소리) / 구절 안(ア 뒤 — 된소리 계열). 기대값은 승인 데모 v2 의 HG.convert 로 만든 값과 같다.
const INITIAL =
  'ア아 イ이 ウ우 エ에 オ오 カ카 キ키 ク쿠 ケ케 コ코 サ사 シ시 ス스 セ세 ソ소 タ타 チ치 ツ츠 テ테 ト토 ナ나 ニ니 ヌ누 ネ네 ノ노 ハ하 ヒ히 フ후 ヘ헤 ホ호 ' +
  'マ마 ミ미 ム무 メ메 モ모 ヤ야 ユ유 ヨ요 ラ라 リ리 ル루 レ레 ロ로 ワ와 ヲ오 ン응 ガ가 ギ기 グ구 ゲ게 ゴ고 ザ자 ジ지 ズ즈 ゼ제 ゾ조 ダ다 ヂ지 ヅ즈 デ데 ド도 ' +
  'バ바 ビ비 ブ부 ベ베 ボ보 パ파 ピ피 プ푸 ペ페 ポ포'
const MID =
  'ア아- イ아이 ウ아우 エ아에 オ아오 カ아까 キ아끼 ク아꾸 ケ아께 コ아꼬 サ아사 シ아시 ス아스 セ아세 ソ아소 タ아따 チ아찌 ツ아쯔 テ아떼 ト아또 ナ아나 ニ아니 ヌ아누 ' +
  'ネ아네 ノ아노 ハ아하 ヒ아히 フ아후 ヘ아헤 ホ아호 マ아마 ミ아미 ム아무 メ아메 モ아모 ヤ아야 ユ아유 ヨ아요 ラ아라 リ아리 ル아루 レ아레 ロ아로 ワ아와 ヲ아오 ン앙 ' +
  'ガ아가 ギ아기 グ아구 ゲ아게 ゴ아고 ザ아자 ジ아지 ズ아즈 ゼ아제 ゾ아조 ダ아다 ヂ아지 ヅ아즈 デ아데 ド아도 バ아바 ビ아비 ブ아부 ベ아베 ボ아보 パ아빠 ピ아삐 プ아뿌 ペ아뻬 ポ아뽀'
const YOON: Record<string, [string, string]> = {
  キャ: ['캬', '아꺄'], キュ: ['큐', '아뀨'], キョ: ['쿄', '아꾜'], シャ: ['샤', '아샤'], シュ: ['슈', '아슈'], ショ: ['쇼', '아쇼'],
  チャ: ['챠', '아쨔'], チュ: ['츄', '아쮸'], チョ: ['쵸', '아쬬'], ニャ: ['냐', '아냐'], ニュ: ['뉴', '아뉴'], ニョ: ['뇨', '아뇨'],
  ヒャ: ['햐', '아햐'], ヒュ: ['휴', '아휴'], ヒョ: ['효', '아효'], ミャ: ['먀', '아먀'], ミュ: ['뮤', '아뮤'], ミョ: ['묘', '아묘'],
  リャ: ['랴', '아랴'], リュ: ['류', '아류'], リョ: ['료', '아료'], ギャ: ['갸', '아갸'], ギュ: ['규', '아규'], ギョ: ['교', '아교'],
  ジャ: ['쟈', '아쟈'], ジュ: ['쥬', '아쥬'], ジョ: ['죠', '아죠'], ビャ: ['뱌', '아뱌'], ビュ: ['뷰', '아뷰'], ビョ: ['뵤', '아뵤'],
  ピャ: ['퍄', '아뺘'], ピュ: ['퓨', '아쀼'], ピョ: ['표', '아뾰'],
}
// 촉음(받침 ㄱ/ㅂ/ㅅ)·ん(ㅁ/ㄴ/ㅇ)·장음(ー·같은 모음)·외래음·조사 구분.
const MISC: Record<string, string> = {
  ガッコー: '각꼬-', ニッポン: '닙뽕', キップ: '킵뿌', マッチャ: '맛쨔', ザッシ: '잣시', カッテ: '캇떼',
  シンブン: '심붕', サンマ: '삼마', ミンナ: '민나', テンキ: '텡끼', ホンヤ: '홍야', パン: '팡',
  コーヒー: '코-히-', トーキョー: '토-꾜-', イイ: '이-', イー: '이-', オカーサン: '오까-상', カワイイ: '카와이-', ぎゅうにゅう: '규-뉴-',
  ファイル: '화이루', ティー: '티-', ウィスキー: '위스끼-', ヴァイオリン: '바이오링', ジェット: '졧또', チェック: '쳭꾸', ディズニー: '디즈니-', ツアー: '츠아-',
  アリガトー: '아리가또-', チョット: '춋또', イタダキマス: '이따다끼마스', 'コレワ|イクラデスカ': '코레와 이꾸라데스까',
}
// 데모 v2 샘플 문장의 발음 줄(p) → 한글.
const DEMO: Array<[string, string]> = [
  ['キョーワ|ナニオ|タベマシタカ？', '쿄-와 나니오 타베마시따까?'],
  ['コンニチワ！ キョーワ|ナニオ|シマシタカ？', '콘니찌와! 쿄-와 나니오 시마시따까?'],
  ['トモダチト エーガオ|ミマシタ。 トテモ オモシロイデシタ。', '토모다찌또 에-가오 미마시따. 토떼모 오모시로이데시따.'],
  ['ソーデスカ。 ドンナ エーガデシタカ？', '소-데스까. 돈나 에-가데시따까?'],
  ['アクション エーガデス。 シュジンコーガ カッコヨカッタデス。', '아꾸숑 에-가데스. 슈징꼬-가 칵꼬요깟따데스.'],
  ['イーデスネ。 マタ ミニ イキタイデスカ？', '이-데스네. 마따 미니 이끼따이데스까?'],
  ['ライシュー、 ゾクヘンオ|ミニ イキマス。', '라이슈-, 조꾸헹오 미니 이끼마스.'],
  ['ハジメマシテ！ ブラウンデス。', '하지메마시떼! 부라운데스.'],
  ['イラッシャイマセ。 ゴチューモンワ|オキマリデスカ。', '이랏샤이마세. 고쮸-몽와 오끼마리데스까.'],
  ['ホットト アイス、 ドチラニ ナサイマスカ。', '홋또또 아이스, 도찌라니 나사이마스까.'],
  ['ツメタイ コーヒーオ、 チーサイ サイズデ オネガイシマス。', '츠메따이 코-히-오, 치-사이 사이즈데 오네가이시마스.'],
  ['モチカエル', '모찌까에루'],
  ['ダイジョーブ', '다이죠-부'],
]

function pairs(table: string): Array<[string, string]> {
  return table.split(' ').map((t) => [t[0], t.slice(1)])
}

test('가나→한글 — 50음·탁음·반탁음(구절 첫 글자·구절 안) 전수', () => {
  for (const [k, h] of pairs(INITIAL)) assert.equal(kanaToHangul(k), h, `첫 글자 ${k}`)
  for (const [k, h] of pairs(MID)) assert.equal(kanaToHangul('ア' + k), h, `구절 안 ${k}`)
  // 히라가나 입력도 같은 결과
  assert.equal(kanaToHangul('か'), '카')
  assert.equal(kanaToHangul('あか'), '아까')
})

test('가나→한글 — 요음 전수·촉음·ん·장음·외래음', () => {
  for (const [k, [first, mid]] of Object.entries(YOON)) {
    assert.equal(kanaToHangul(k), first, `요음 ${k}`)
    assert.equal(kanaToHangul('ア' + k), mid, `요음 구절 안 ${k}`)
  }
  for (const [k, h] of Object.entries(MISC)) assert.equal(kanaToHangul(k), h, k)
})

test('가나→한글 — 데모 v2 문장 발음 줄과 같다', () => {
  for (const [p, h] of DEMO) assert.equal(kanaToHangul(p), h, p)
  // 분석기가 낸 차이 2건(한 악센트구로 묶음·イイ)도 한글 소리는 같다(띄어쓰기 1곳만 차이).
  assert.equal(kanaToHangul('アクションエーガデス。'), '아꾸숑에-가데스.')
  assert.equal(kanaToHangul('イイデスネ。'), '이-데스네.')
})

const SEGS: ReadingSegment[] = [
  { surface: '今日', ruby: [['今日', 'きょう']], pron: 'キョー', boundary: null },
  { surface: 'は', ruby: null, pron: 'ワ', boundary: null },
  { surface: '何', ruby: [['何', 'なに']], pron: 'ナニ', boundary: 'particle' },
  { surface: 'を', ruby: null, pron: 'オ', boundary: null },
  { surface: '食べ', ruby: [['食', 'た'], ['べ', null]], pron: 'タベ', boundary: 'particle' },
  { surface: 'ましたか', ruby: null, pron: 'マシタカ', boundary: null },
  { surface: '？', ruby: null, pron: '？', boundary: null },
]

test('세그먼트 → 루비·발음 줄·한글 줄', () => {
  assert.equal(toRubyMarkup(SEGS), '今日{きょう}は何{なに}を食{た}べましたか？')
  assert.deepEqual(rubyPieces(SEGS).slice(0, 3), [
    { text: '今日', reading: 'きょう' },
    { text: 'は', reading: null },
    { text: '何', reading: 'なに' },
  ])
  assert.deepEqual(rubyPieces(SEGS).slice(-2), [
    { text: '食', reading: 'た' },
    { text: 'べましたか？', reading: null },
  ])
  assert.equal(pronLine(SEGS), 'キョーワ|ナニオ|タベマシタカ？')
  assert.equal(hangulLine(SEGS), '쿄-와 나니오 타베마시따까?')
  // 발음을 못 구한 조각이 하나라도 있으면 한글 줄 전체를 숨긴다.
  const broken = SEGS.map((s, i) => (i === 2 ? { ...s, pron: null } : s))
  assert.equal(pronLine(broken), null)
  assert.equal(hangulLine(broken), null)
  assert.equal(hangulLine([]), null)
  assert.equal(hangulLine([{ surface: '★', ruby: null, pron: '★', boundary: null }]), null)
})

// QA O-1(S2): 조사 を 는 서버가 발음을 オ 로 주지만, 앞 모음이 お단이어도 장음으로 합치지 않는다(실제 소리 piano o).
// 장음 판정(ノオ → ノー)은 발음 줄만으로 조사 위치를 모르므로 hangulLine 이 조각 표기(を)로 표식(ヲ)을 넘긴다.
const wo = (head: ReadingSegment[], tail: ReadingSegment[]): ReadingSegment[] => [...head, { surface: 'を', ruby: null, pron: 'オ', boundary: null }, ...tail]
const VERB: ReadingSegment[] = [
  { surface: '弾き', ruby: [['弾', 'ひ'], ['き', null]], pron: 'ヒキ', boundary: 'particle' },
  { surface: 'ます', ruby: null, pron: 'マス', boundary: null },
  { surface: '。', ruby: null, pron: '。', boundary: null },
]

test('한글 줄 — 조사 を 의 オ 는 앞 お단 모음과 장음으로 합치지 않는다(QA O-1)', () => {
  const cases: Array<[ReadingSegment[], string]> = [
    [wo([{ surface: 'ピアノ', ruby: null, pron: 'ピアノ', boundary: null }], VERB), '피아노오 히끼마스.'],
    [wo([{ surface: 'テスト', ruby: null, pron: 'テスト', boundary: null }], [{ surface: 'し', ruby: null, pron: 'シ', boundary: 'particle' }, { surface: 'ます', ruby: null, pron: 'マス', boundary: null }]), '테스또오 시마스'],
    [wo([{ surface: 'どこ', ruby: null, pron: 'ドコ', boundary: null }], []), '도꼬오'],
    // 앞이 お단이 아니면 원래도 합치지 않았다 — 값 그대로(회귀 없음).
    [wo([{ surface: 'コーヒー', ruby: null, pron: 'コーヒー', boundary: null }], [{ surface: '、', ruby: null, pron: '、', boundary: null }]), '코-히-오,'],
    [wo([{ surface: '本', ruby: [['本', 'ほん']], pron: 'ホン', boundary: null }], VERB), '홍오 히끼마스.'],
    [wo([{ surface: '何', ruby: [['何', 'なに']], pron: 'ナニ', boundary: null }], []), '나니오'],
  ]
  for (const [segs, h] of cases) assert.equal(hangulLine(segs), h, segs.map((x) => x.surface).join(''))
  // 공개 발음 줄은 데모 모양(オ) 그대로 — 표식은 한글 변환 안에서만 쓴다.
  assert.equal(pronLine(wo([{ surface: 'ピアノ', ruby: null, pron: 'ピアノ', boundary: null }], VERB)), 'ピアノオ|ヒキマス。')
  // 조사가 아닌 オ(단어 안 장음 표기 「おおきい」·「とおり」)는 여전히 장음.
  assert.equal(hangulLine([{ surface: '通り', ruby: [['通', 'とお'], ['り', null]], pron: 'トーリ', boundary: null }]), '토-리')
  assert.equal(kanaToHangul('トオリ'), '토-리')
  assert.equal(hangulLine([{ surface: '大きい', ruby: [['大', 'おお'], ['きい', null]], pron: 'オーキー', boundary: null }]), '오-끼-')
  // 저장된 읽기·직접 입력의 を(→ヲ)도 같은 규칙.
  assert.equal(kanaToHangul('ピアノを'), '피아노오')
  assert.equal(kanaToHangul('ピアノヲ'), '피아노오')
  // 표식 없는 발음 줄 문자열(데모 p)은 예전 규칙 그대로 — 승인 데모 HG.convert 와 같은 결과.
  assert.equal(kanaToHangul('ピアノオ|ヒキマス。'), '피아노- 히끼마스.')
})

// QA-L1(task-030): 조사 へ(pron エ)도 を 와 같다 — 앞 단어 끝 모음이 같거나 장음이어도 합치지 않는다(`先生へ` 센세-에 · `家へ` 이에에).
// 픽스처 = dev gateway 실 출력(조사 へ·を·は·に·で × 장음 뒤·같은 모음 뒤·자음 뒤) + 손으로 정한 기대 한글. 조사 는/에/에서는 원래 모음 단독 발음이 아니라 합쳐지지 않는다.
interface ParticleCase {
  text: string
  hangul: string
  segments: ReadingSegment[]
}
const PARTICLE_CASES = (
  JSON.parse(readFileSync(join(__dirname, 'fixtures', 'particleBoundary.json'), 'utf8')) as { cases: ParticleCase[] }
).cases

test('한글 줄 — 조사 へ·を·は·に·で 는 장음·같은 모음 뒤에서도 합치지 않는다(QA-L1, gateway 실 출력 픽스처)', () => {
  assert.ok(PARTICLE_CASES.length >= 20)
  for (const c of PARTICLE_CASES) {
    assert.equal(c.segments.map((x) => x.surface).join(''), c.text, `원문 ${c.text}`)
    assert.equal(hangulLine(c.segments), c.hangul, c.text)
  }
  // 핵심 두 건(QA 재현값)을 문장 끝 へ 형태로 한 번 더 고정.
  const byText = (t: string) => PARTICLE_CASES.find((c) => c.text === t)!.segments
  assert.equal(hangulLine(byText('先生へ')), '센세-에')
  assert.equal(hangulLine(byText('家へ')), '이에에')
  // 공개 발음 줄은 데모 모양(エ) 그대로 — ヱ 표식은 한글 변환 안에서만 쓴다.
  assert.equal(pronLine(byText('先生へ行く。')), 'センセーエ|イク。')
})

test('한글 줄 — 조사 へ 표식은 조사 조각에만(단어 안 エ·ええ·いい 장음 합침은 그대로)', () => {
  const he = (head: string, pron: string): ReadingSegment[] => [
    { surface: head, ruby: null, pron, boundary: null },
    { surface: 'へ', ruby: null, pron: 'エ', boundary: null },
  ]
  assert.equal(hangulLine(he('先生', 'センセー')), '센세-에')
  assert.equal(hangulLine(he('家', 'イエ')), '이에에')
  assert.equal(hangulLine(he('絵', 'エ')), '에에')
  assert.equal(hangulLine(he('ここ', 'ココ')), '코꼬에')
  assert.equal(hangulLine(he('本', 'ホン')), '홍에')
  // へ 가 조사가 아닌 조각(발음 ヘ — 동사 어간 등)은 표식 없이 하→헤 그대로.
  assert.equal(hangulLine([{ surface: 'へ', ruby: null, pron: 'ヘ', boundary: null }]), '헤')
  // 조사 아닌 エ(표기가 へ 가 아님)는 앞 같은 모음과 합친다 — 단, 장음 ー 바로 뒤는 접지 않는다(task-031: センセーエ → 센세-에).
  assert.equal(hangulLine([{ surface: '先生絵', ruby: null, pron: 'センセーエ', boundary: null }]), '센세-에')
  assert.equal(hangulLine([{ surface: 'ええ', ruby: null, pron: 'エエ', boundary: null }]), '에-')
  // 별도 조각이어도 표기가 へ 가 아닌 단독 エ 는 조사가 아니다 — e단 뒤에서 합친다(REV-098 L-1: 표식 조건에서 표기 검사를 빼면 '케에').
  assert.equal(
    hangulLine([
      { surface: 'ケ', ruby: null, pron: 'ケ', boundary: null },
      { surface: '絵', ruby: null, pron: 'エ', boundary: null },
    ]),
    '케-',
  )
  assert.equal(
    hangulLine([
      { surface: 'ケ', ruby: null, pron: 'ケ', boundary: null },
      { surface: 'へ', ruby: null, pron: 'エ', boundary: null },
    ]),
    '케에',
  )
  assert.equal(hangulLine([{ surface: 'いい', ruby: null, pron: 'イイ', boundary: null }]), '이-')
  // 직접 변환기: 표식(ヱ)은 조사 へ 와 같은 취급. 표식 없는 エ 도 장음 ー 바로 뒤라 접지 않는다(task-031).
  assert.equal(kanaToHangul('センセーヱ'), '센세-에')
  assert.equal(kanaToHangul('センセーエ'), '센세-에')
})

// task-031(REV-098 L-2): 장음 ー 바로 뒤의 같은 모음은 접지 않는다 — 経営(ケーエー) = 케-에-(관행). 예전 규칙은 ー 뒤 エ 를 또 '-' 로 접어 '케--'.
// "같은 모음 반복 → -"(ええ·いい·とおり)와 조사 へ·を 분리(先生へ·家へ)는 그대로.
test('한글 줄 — 장음 ー 뒤 같은 모음은 새 음절(経営 케-에-), 같은 모음 반복·조사 분리는 그대로', () => {
  const one = (surface: string, pron: string): ReadingSegment[] => [{ surface, ruby: null, pron, boundary: null }]
  assert.equal(hangulLine(one('経営', 'ケーエー')), '케-에-')
  assert.equal(kanaToHangul('ケーエー'), '케-에-')
  assert.equal(hangulLine(one('経営者', 'ケーエーシャ')), '케-에-샤')
  assert.equal(hangulLine(one('映画', 'エーガ')), '에-가')
  assert.equal(kanaToHangul('ネーエ'), '네-에')
  assert.equal(kanaToHangul('オーオー'), '오-오-')
  assert.equal(kanaToHangul('イーイ'), '이-이')
  // 장음 표기 ー 가 아닌 같은 모음 반복은 예전처럼 접는다.
  assert.equal(hangulLine([{ surface: '通り', ruby: [['通', 'とお'], ['り', null]], pron: 'トーリ', boundary: null }]), '토-리')
  assert.equal(kanaToHangul('トオリ'), '토-리')
  assert.equal(hangulLine(one('ええ', 'エエ')), '에-')
  assert.equal(hangulLine(one('いい', 'イイ')), '이-')
  assert.equal(kanaToHangul('ケエ'), '케-')
  assert.equal(hangulLine(one('大きい', 'オーキー')), '오-끼-')
  // ー 가 두 번 이어져도 '-' 두 번(예전과 같음), 뒤 같은 모음은 새 음절.
  assert.equal(kanaToHangul('ケーーエ'), '케--에')
  // 조사 へ·を 분리(task-030 QA-L1·QA O-1) 그대로.
  const he = (head: string, pron: string): ReadingSegment[] => [
    { surface: head, ruby: null, pron, boundary: null },
    { surface: 'へ', ruby: null, pron: 'エ', boundary: null },
  ]
  assert.equal(hangulLine(he('先生', 'センセー')), '센세-에')
  assert.equal(hangulLine(he('家', 'イエ')), '이에에')
  assert.equal(
    hangulLine([
      { surface: '通り', ruby: [['通', 'とお'], ['り', null]], pron: 'トーリ', boundary: null },
      { surface: 'を', ruby: null, pron: 'オ', boundary: null },
    ]),
    '토-리오',
  )
  // 구절이 바뀌면(' '·'|') 장음 뒤 표시는 이어지지 않는다.
  assert.equal(kanaToHangul('ケー エ'), '케- 에')
})

test('단어 표제어 루비 — 저장된 읽기로 送り仮名 분리, 애매하면 null', () => {
  assert.deepEqual(alignWordRuby('面白い', 'おもしろい'), [
    { text: '面白', reading: 'おもしろ' },
    { text: 'い', reading: null },
  ])
  assert.deepEqual(alignWordRuby('持ち帰る', 'もちかえる'), [
    { text: '持', reading: 'も' },
    { text: 'ち', reading: null },
    { text: '帰', reading: 'かえ' },
    { text: 'る', reading: null },
  ])
  assert.deepEqual(alignWordRuby('注文', 'チュウモン'), [{ text: '注文', reading: 'ちゅうもん' }])
  assert.equal(alignWordRuby('コーヒー', 'こーひー'), null) // 한자 없음
  assert.equal(alignWordRuby('面白い', 'おもしろ'), null) // 정렬 실패(送り仮名 불일치)
  assert.equal(alignWordRuby('3時', 'さんじ'), null) // 숫자
  assert.equal(alignWordRuby('私は元気です', '私はげんきです'), null) // 읽기에 한자
})

// REV-086 M1: 예전 구현(정규식 `(.+?)` 연쇄) — 작은 입력에서 결과가 같은지 대조용.
function alignByRegex(surface: string, reading: string): Array<{ text: string; reading: string | null }> | null {
  const KAN = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/
  const hira = (x: string) => x.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  if (!KAN.test(surface) || !reading || !/^[ぁ-ゖァ-ヺー]+$/.test(reading)) return null
  const parts = surface.match(/[㐀-䶿一-鿿豈-﫿々〆ヶ]+|[^㐀-䶿一-鿿豈-﫿々〆ヶ]+/g) ?? []
  let pattern = '^'
  for (const p of parts) {
    if (KAN.test(p)) pattern += '(.+?)'
    else if (/^[ぁ-ゖァ-ヺー]+$/.test(p)) pattern += '(' + hira(p) + ')'
    else return null
  }
  const m = hira(reading).match(new RegExp(pattern + '$'))
  return m ? parts.map((p, i) => ({ text: p, reading: KAN.test(p) ? m[i + 1] : null })) : null
}

test('단어 표제어 루비 — 정렬이 입력 크기에 다항(악성 단어로 화면 정지 없음), 결과는 예전 정규식과 같다', () => {
  const worst: Array<[string, string]> = [
    ['漢あ'.repeat(6), 'あ'.repeat(60)], // REV-086 실측 274ms
    ['漢あ'.repeat(8), 'あ'.repeat(80)], // REV-086 실측 >100s
    ['漢あ'.repeat(40), 'あ'.repeat(WORD_RUBY_MAX_READING)], // 표제어 80자·읽기 120자 — 상한 최악
    ['漢あ'.repeat(40), 'あ'.repeat(WORD_RUBY_MAX_READING - 1) + 'い'], // 끝에서 실패 — 전부 훑는다
    ['漢ああ'.repeat(26) + '漢あ', 'ああ'.repeat(WORD_RUBY_MAX_READING / 2)],
    ['漢'.repeat(WORD_RUBY_MAX_SURFACE), 'か'.repeat(WORD_RUBY_MAX_READING)],
  ]
  for (const [surface, reading] of worst) {
    assert.ok(surface.length <= WORD_RUBY_MAX_SURFACE)
    const t0 = performance.now()
    alignWordRuby(surface, reading)
    const ms = performance.now() - t0
    assert.ok(ms <= 10, `${surface.length}자·읽기 ${reading.length}자 ${ms.toFixed(1)}ms`)
  }
  assert.equal(alignWordRuby('漢'.repeat(WORD_RUBY_MAX_SURFACE + 1), 'かん'), null) // 저장 상한 밖
  assert.equal(alignWordRuby('漢', 'か'.repeat(WORD_RUBY_MAX_READING + 1)), null)

  // 무작위 작은 입력(묶음 ≤3 — 정규식도 금방 끝나는 크기)에서 예전 정규식과 같은 결과.
  let seed = 7
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n)
  const KANJIS = '漢字読書会'
  const KANAS = 'あいかきしんっーアカ'
  for (let c = 0; c < 3000; c++) {
    let surface = ''
    const groups = 1 + rnd(3)
    for (let g = 0; g < groups; g++) {
      if (rnd(3)) surface += KANAS[rnd(KANAS.length)].repeat(1 + rnd(2))
      surface += KANJIS[rnd(KANJIS.length)].repeat(1 + rnd(2))
    }
    if (rnd(2)) surface += KANAS[rnd(KANAS.length)]
    let reading = ''
    const rl = 1 + rnd(9)
    for (let i = 0; i < rl; i++) reading += 'あいかきしんっーアカ'[rnd(10)]
    assert.deepEqual(alignWordRuby(surface, reading), alignByRegex(surface, reading), `${surface} / ${reading}`)
  }
})

// ── 서버 읽기 모듈 ────────────────────────────────────────────────────────────

test('annotateReadings — 중복 제거·캐시·빈 문장', async () => {
  resetReadingCache()
  const calls: string[][] = []
  const annotate = async (texts: readonly string[]) => {
    calls.push([...texts])
    return texts.map((t) => (t === 'だめ' ? null : [{ surface: t, ruby: null, pron: 'テスト', boundary: null } as ReadingSegment]))
  }
  const r1 = await annotateReadings(['テスト', 'テスト', '', 'だめ'], { annotate })
  assert.equal(r1.available, true)
  assert.deepEqual(calls, [['テスト', 'だめ']])
  assert.equal(r1.items[0], r1.items[1])
  assert.deepEqual(r1.items[2], [])
  assert.equal(r1.items[3], null)
  const r2 = await annotateReadings(['テスト'], { annotate })
  assert.equal(calls.length, 1, '두 번째는 캐시')
  assert.equal(r2.items[0]?.[0].pron, 'テスト')
  await annotateReadings(['だめ'], { annotate })
  assert.equal(calls.length, 2, '분석 실패 칸은 캐시하지 않는다')
  await assert.rejects(annotateReadings(Array(65).fill('a'), { annotate }), /READING_LIMIT/)
})

test('annotateReadings — 캐시는 건수 외에 총량(조각+루비 조각) 상한, 넘으면 오래 안 쓴 것부터 뺀다', async () => {
  resetReadingCache()
  assert.deepEqual(READING_CACHE_LIMITS, { entries: 5_000, units: 120_000 })
  // 400자 문장 최악(400조각·조각마다 루비) = 800 단위 — 건수 상한만이면 5,000건(약 400만 단위)까지 쌓였다.
  const heavy = (t: string): ReadingSegment[] =>
    Array.from({ length: 400 }, (_, i) => ({ surface: '漢', ruby: [['漢', 'かん']], pron: `カン${t}${i}`, boundary: null }) as ReadingSegment)
  let calls = 0
  const annotate = async (texts: readonly string[]) => {
    calls += texts.length
    return texts.map((t) => heavy(t))
  }
  const perEntry = 800
  const fit = Math.floor(READING_CACHE_LIMITS.units / perEntry) // 150
  for (let b = 0; b < 400; b += 64) {
    await annotateReadings(
      Array.from({ length: Math.min(64, 400 - b) }, (_, j) => `t${b + j}`),
      { annotate },
    )
  }
  const st = readingCacheStats()
  assert.ok(st.units <= READING_CACHE_LIMITS.units, `units ${st.units}`)
  assert.equal(st.entries, fit)
  const before = calls
  await annotateReadings(['t399'], { annotate })
  assert.equal(calls, before, '가장 최근 것은 캐시에 있다')
  await annotateReadings(['t1'], { annotate })
  assert.equal(calls, before + 1, '오래된 것은 빠졌다')
  resetReadingCache()
  assert.deepEqual(readingCacheStats(), { entries: 0, units: 0 })
})

test('annotateReadings — 분석기 불가면 빈 결과로 degrade 하고 30초 쉰다', async () => {
  resetReadingCache()
  let now = 1_000_000
  let calls = 0
  const down = async () => {
    calls++
    throw new TextAnalyzerError('UNAVAILABLE', 'ECONNREFUSED')
  }
  const r = await annotateReadings(['今日'], { annotate: down, now: () => now })
  assert.deepEqual(r, { items: [null], available: false })
  now += 10_000
  assert.equal((await annotateReadings(['今日'], { annotate: down, now: () => now })).available, false)
  assert.equal(calls, 1, '쉬는 동안은 부르지 않는다')
  now += 30_000
  await annotateReadings(['今日'], { annotate: down, now: () => now })
  assert.equal(calls, 2)
  resetReadingCache()
})

// REV-089: 동시 실행 상한·바쁨은 쉬지 않음(전역 쉼이 다른 사용자에게 번지지 않게).
function gatedAnnotate() {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const calls: string[][] = []
  const annotate = async (texts: readonly string[]) => {
    calls.push([...texts])
    await gate
    return texts.map((t) => [{ surface: t, ruby: null, pron: 'テスト', boundary: null } as ReadingSegment])
  }
  return { annotate, calls, release }
}

test('annotateReadings — 전역 동시 4건 상한: 5번째는 분석기를 부르지 않고 degrade, 쉬지 않는다', async () => {
  resetReadingCache()
  const g = gatedAnnotate()
  const running = [1, 2, 3, 4].map((i) => annotateReadings([`g${i}`], { annotate: g.annotate }))
  const fifth = await annotateReadings(['g5'], { annotate: g.annotate })
  assert.deepEqual(fifth, { items: [null], available: false })
  assert.equal(g.calls.length, 4)
  assert.equal(readingInflightStats().global, 4)
  g.release()
  for (const r of await Promise.all(running)) assert.equal(r.available, true)
  assert.deepEqual(readingInflightStats(), { global: 0, owners: 0 })
  const again = await annotateReadings(['g5'], { annotate: g.annotate })
  assert.equal(again.available, true)
  assert.equal(g.calls.length, 5, '상한 초과 뒤에도 쉬지 않고 바로 부른다')
  resetReadingCache()
})

test('annotateReadings — 사용자별 동시 2건 상한: 같은 사용자 3번째만 degrade, 다른 사용자는 영향 없음', async () => {
  resetReadingCache()
  const g = gatedAnnotate()
  const a1 = annotateReadings(['o1'], { annotate: g.annotate }, 'user-a')
  const a2 = annotateReadings(['o2'], { annotate: g.annotate }, 'user-a')
  const a3 = await annotateReadings(['o3'], { annotate: g.annotate }, 'user-a')
  assert.deepEqual(a3, { items: [null], available: false })
  assert.equal(g.calls.length, 2)
  const b1 = annotateReadings(['o4'], { annotate: g.annotate }, 'user-b')
  assert.equal(g.calls.length, 3, '다른 사용자는 부른다')
  assert.deepEqual(readingInflightStats(), { global: 3, owners: 2 })
  g.release()
  for (const r of await Promise.all([a1, a2, b1])) assert.equal(r.available, true)
  assert.deepEqual(readingInflightStats(), { global: 0, owners: 0 })
  assert.equal((await annotateReadings(['o3'], { annotate: g.annotate }, 'user-a')).available, true)
  resetReadingCache()
})

test('annotateReadings — 분석기 BUSY 는 쉬지 않고, TIMEOUT 은 30초 쉰다 / 카운터는 예외 뒤에도 0', async () => {
  resetReadingCache()
  let now = 2_000_000
  let calls = 0
  let fail: InstanceType<typeof TextAnalyzerError> = new TextAnalyzerError('BUSY', 'BUSY')
  const annotate = async () => {
    calls++
    throw fail
  }
  assert.deepEqual(await annotateReadings(['今日'], { annotate, now: () => now }, 'user-a'), { items: [null], available: false })
  assert.deepEqual(readingInflightStats(), { global: 0, owners: 0 })
  await annotateReadings(['今日'], { annotate, now: () => now }, 'user-b')
  assert.equal(calls, 2, 'BUSY 뒤 바로 다음 호출은 분석기를 부른다(다른 사용자도)')
  fail = new TextAnalyzerError('TIMEOUT', 'ETIMEDOUT')
  await annotateReadings(['今日'], { annotate, now: () => now }, 'user-a')
  assert.equal(calls, 3)
  now += 1_000
  assert.equal((await annotateReadings(['今日'], { annotate, now: () => now }, 'user-b')).available, false)
  assert.equal(calls, 3, 'TIMEOUT 뒤에는 쉰다(기존 동작 유지)')
  assert.deepEqual(readingInflightStats(), { global: 0, owners: 0 })
  resetReadingCache()
})

// ── 어댑터 ──────────────────────────────────────────────────────────────────

test('어댑터 — 시크릿은 SPEECH_GATEWAY_URL origin 에만, 오류 분류', async () => {
  const saved = { url: process.env.SPEECH_GATEWAY_URL, secret: process.env.SPEECH_INTERNAL_SECRET, fetch: globalThis.fetch }
  try {
    delete process.env.SPEECH_GATEWAY_URL
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 100 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'MISCONFIGURED')
    process.env.SPEECH_GATEWAY_URL = 'http://127.0.0.1:8100'
    process.env.SPEECH_INTERNAL_SECRET = 'x'.repeat(32)
    const seen: Array<{ url: string; secret: string | null; redirect: string | undefined }> = []
    let reply: () => Response = () => Response.json({ version: '1', items: [{ segments: [{ surface: '今日', ruby: null, pron: 'キョー', boundary: null }] }] })
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), secret: new Headers(init?.headers).get('x-internal-secret'), redirect: init?.redirect })
      return reply()
    }) as typeof fetch
    const items = await annotateHttp(['今日'], { timeoutMs: 1000 })
    assert.equal(items[0]?.[0].pron, 'キョー')
    assert.deepEqual(seen[0], { url: 'http://127.0.0.1:8100/text/annotate', secret: 'x'.repeat(32), redirect: 'manual' })
    reply = () => Response.json({ error: { code: 'NOT_READY' } }, { status: 503 })
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 1000 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'UNAVAILABLE' && e.code === 'NOT_READY')
    reply = () => Response.json({ error: { code: 'BUSY' } }, { status: 503 })
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 1000 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'BUSY' && e.code === 'BUSY')
    reply = () => Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 1000 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'MISCONFIGURED')
    globalThis.fetch = (async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' })
    }) as typeof fetch
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 1 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'TIMEOUT')
    await assert.rejects(annotateHttp(['あ'.repeat(401)], { timeoutMs: 1 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'REJECTED')

    // 응답 검증 — 칸 수 불일치는 오류, 칸 하나가 어긋나면 그 칸만 null(화면은 숨김).
    const good = { surface: '今日', ruby: [['今日', 'きょう']], pron: 'キョー', boundary: null }
    let body: unknown = { items: [] }
    globalThis.fetch = (async () => Response.json(body)) as typeof fetch
    await assert.rejects(annotateHttp(['今日'], { timeoutMs: 1000 }), (e: unknown) => e instanceof TextAnalyzerError && e.kind === 'ENGINE_ERROR')
    body = {
      items: [
        { segments: [good] },
        { segments: [{ ...good, surface: '明日' }] }, // 루비 조각이 surface 와 다름
        { segments: [{ ...good, ruby: [['今日', 'キョウ']] }] }, // 루비는 히라가나만
        { segments: [{ ...good, boundary: 'x' }] },
        { segments: [good] }, // 이어 붙인 surface ≠ 원문
        null,
      ],
    }
    assert.deepEqual(await annotateHttp(['今日', '明日', '今日', '今日', '今日は', 'x'], { timeoutMs: 1000 }), [[good], null, null, null, null, null])
  } finally {
    globalThis.fetch = saved.fetch
    if (saved.url === undefined) delete process.env.SPEECH_GATEWAY_URL
    else process.env.SPEECH_GATEWAY_URL = saved.url
    if (saved.secret === undefined) delete process.env.SPEECH_INTERNAL_SECRET
    else process.env.SPEECH_INTERNAL_SECRET = saved.secret
  }
})

// ── 경계 ──────────────────────────────────────────────────────────────────

test('읽기 클라이언트는 순수 모듈 — import 0, 엔진명·서버 설정 없음 / 라우트·서버 모듈에도 엔진명 없음', () => {
  const root = join(__dirname, '..', '..', '..')
  const client = readFileSync(join(__dirname, '..', 'reading', 'client.ts'), 'utf8')
  assert.doesNotMatch(client, /^\s*(import|export)\s[^\n]*from\s/m, 'client.ts 가 무언가를 import/re-export 한다')
  assert.doesNotMatch(client, /process\.env|console\./)
  const ENGINE = /openjtalk|open_jtalk|mecab|sbv2|style-?bert|reazon|whisper|claude/i
  for (const f of [join(__dirname, '..', 'reading', 'client.ts'), join(__dirname, '..', 'reading', 'index.ts'), join(root, 'app', 'api', 'v1', 'text', 'annotate', 'route.ts')]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), ENGINE, f)
  }
})
