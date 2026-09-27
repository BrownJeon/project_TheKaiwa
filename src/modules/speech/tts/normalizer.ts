/**
 * JapaneseTextNormalizer(speech-platform/16 §3, P0) — 엔진 정규화에 의존하지 않고 **앱이 읽기를 결정**한다.
 * 결과 `normalizedText` 는 어느 엔진을 쓰든 같아야 한다(캐시 키·사전 매칭·회귀 비교의 기준).
 *
 * 규칙 우선순위(§3.2): ① 사전 보호 구간 → ② 명시 패턴(날짜 > 시간 > 통화·단위 > 조수사 예외 > 일반 숫자)
 *   → ③ 약어·외래어·영문표 → ④ 기호표·공백 → ⑤ 통과. 먼저 차지한 구간은 뒤 규칙이 건드리지 못한다.
 * 읽기 형태는 **한자 숫자 우선**(pyopenjtalk 의 조수사 음편·악센트 사전을 살린다)이고, 문맥으로만 정해지는 읽기
 * (날짜 1日=ついたち, 1人·2人, 20歳=はたち, 기간 1日=いちにち)만 가나로 못박는다 — 골든셋에서 오독이 확인되면 이 표에 더한다.
 *
 * 출력 `tokens` 는 원문 좌표(srcStart/srcEnd, UTF-16 인덱스)다 — 자막 timing(P1)이 원문으로 되돌릴 때 쓴다.
 */
import { integerToKanji, numberToKanji } from './numbers'
import { isJapaneseChar, toWorkingText } from './text'

export type NormalizeRule = 'PROTECTED' | 'DATE' | 'TIME' | 'CURRENCY' | 'UNIT' | 'COUNTER' | 'NUMBER' | 'ABBREVIATION' | 'LOANWORD' | 'SYMBOL' | 'WHITESPACE'

export interface NormalizationToken {
  srcStart: number
  srcEnd: number
  surface: string
  replaced: string
  rule: NormalizeRule
}

export interface NormalizationResult {
  normalizedText: string
  tokens: NormalizationToken[]
  /** 실제로 글자를 바꾼 규칙 적용 수(보호 구간·같은 글자 유지는 세지 않는다) — Trace `TTS_NORMALIZE.rulesApplied`. */
  rulesApplied: number
}

export interface NormalizeOptions {
  /** 사전(Lexicon)이 맡을 구간 — working/원문 좌표(둘은 같다). 정규화기가 손대지 않는다(§3.2 ①). */
  protect?: readonly { start: number; end: number }[]
}

type Replacer = (m: RegExpExecArray, w: string, start: number, end: number) => string | null
interface Rule {
  rule: NormalizeRule
  re: RegExp
  replace: Replacer
}

const K = (n: number | string) => integerToKanji(String(n))

/** 날짜 문맥의 일(日) 읽기 — 사전 단어(二日·二十日 등)는 한자로 두고 문맥 의존 읽기만 가나. */
function dayReading(d: number): string {
  if (d === 1) return 'ついたち'
  if (d === 14) return 'じゅうよっか'
  if (d === 24) return 'にじゅうよっか'
  return `${K(d)}日`
}

const UNIT_READING: Record<string, string> = {
  'km/h': 'キロメートル毎時',
  km: 'キロメートル',
  cm: 'センチメートル',
  mm: 'ミリメートル',
  'm²': '平方メートル',
  '㎡': '平方メートル',
  m: 'メートル',
  kg: 'キログラム',
  mg: 'ミリグラム',
  g: 'グラム',
  mL: 'ミリリットル',
  ml: 'ミリリットル',
  L: 'リットル',
  l: 'リットル',
  '%': 'パーセント',
  '℃': '度',
  '°C': '度',
  '°': '度',
  TB: 'テラバイト',
  GB: 'ギガバイト',
  MB: 'メガバイト',
  KB: 'キロバイト',
  kB: 'キロバイト',
}
const UNIT_ALT = Object.keys(UNIT_READING)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

const CURRENCY_READING: Record<string, string> = { '¥': '円', '￥': '円', $: 'ドル', '€': 'ユーロ', '£': 'ポンド' }

/** 대문자 약어 — 대소문자 그대로 일치할 때만(§3.2 약어표). */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
  OK: 'オーケー', NG: 'エヌジー', JR: 'ジェイアール', ATM: 'エーティーエム', NHK: 'エヌエイチケー', TV: 'テレビ', PC: 'パソコン',
  SNS: 'エスエヌエス', AI: 'エーアイ', USB: 'ユーエスビー', CD: 'シーディー', DVD: 'ディーブイディー', BGM: 'ビージーエム',
  GPS: 'ジーピーエス', ID: 'アイディー', IT: 'アイティー', QR: 'キューアール', SOS: 'エスオーエス', VIP: 'ブイアイピー',
  JLPT: 'ジェイエルピーティー', LINE: 'ライン', DM: 'ディーエム', OL: 'オーエル', SF: 'エスエフ', DJ: 'ディージェイ', UFO: 'ユーフォー',
}

/** 외래어·브랜드 — 소문자 비교(§3.2 외래어표). 없으면 원문 유지(엔진 g2p 에 맡김). */
export const LOANWORDS: Readonly<Record<string, string>> = {
  ok: 'オーケー', netflix: 'ネットフリックス', youtube: 'ユーチューブ', google: 'グーグル', iphone: 'アイフォーン', android: 'アンドロイド',
  amazon: 'アマゾン', instagram: 'インスタグラム', twitter: 'ツイッター', facebook: 'フェイスブック', tiktok: 'ティックトック',
  starbucks: 'スターバックス', "mcdonald's": 'マクドナルド', 'mcdonald’s': 'マクドナルド', mcdonalds: 'マクドナルド', 'wi-fi': 'ワイファイ', wifi: 'ワイファイ',
  email: 'イーメール', 'e-mail': 'イーメール', zoom: 'ズーム', apple: 'アップル', windows: 'ウィンドウズ', suica: 'スイカ', pasmo: 'パスモ',
  uniqlo: 'ユニクロ', sony: 'ソニー', toyota: 'トヨタ', nintendo: 'ニンテンドー', pokemon: 'ポケモン', 'pokémon': 'ポケモン', disney: 'ディズニー',
}

const JLPT_DIGIT = ['', 'イチ', 'ニ', 'サン', 'ヨン', 'ゴ']
const SENTENCE_END = '。！？!?」』）)'
const EMOJI_CLASS = '[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}\\u{20E3}\\u{1F3FB}-\\u{1F3FF}★☆♪♫♬♡♥※→←↑↓⇒⇔●○◎◇◆□■△▲▽▼✓✔]'
const EMOJI = new RegExp(`${EMOJI_CLASS}+`, 'gu')
const EMOJI_TAIL = new RegExp(`${EMOJI_CLASS}+$`, 'u')

/** 지워질 이모지를 건너뛴 직전 글자 — 공백 규칙이 "일본어 사이" 를 판단할 때 쓴다. */
function prevVisible(w: string, start: number): string | undefined {
  const head = w.slice(0, start).replace(EMOJI_TAIL, '')
  return head.length ? head[head.length - 1] : undefined
}

const RULES: readonly Rule[] = [
  // ② 날짜: 2026/9/26 · 2026-09-26
  {
    rule: 'DATE',
    re: /(?<![\d/.-])(\d{4})([/.-])(\d{1,2})\2(\d{1,2})(?![\d/.-])/g,
    replace: (m) => {
      const mo = Number(m[3])
      const d = Number(m[4])
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
      return `${K(m[1])}年${K(mo)}月${dayReading(d)}`
    },
  },
  // 9月26日 · 9月1日(ついたち) — 연도는 일반 숫자 규칙이 맡는다.
  {
    rule: 'DATE',
    re: /(?<![\d.,])(\d{1,2})月\s?(\d{1,2})日/g,
    replace: (m) => {
      const mo = Number(m[1])
      const d = Number(m[2])
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
      return `${K(mo)}月${dayReading(d)}`
    },
  },
  // 시간: 9:30 → 九時三十分 · 0:15 → 零時十五分
  {
    rule: 'TIME',
    re: /(?<![\d:.])(\d{1,2}):(\d{2})(?::(\d{2}))?(?![\d:])/g,
    replace: (m) => {
      const h = Number(m[1])
      const mi = Number(m[2])
      const s = m[3] ? Number(m[3]) : 0
      if (h > 24 || mi > 59 || s > 59) return null
      return `${h === 0 ? '零' : K(h)}時${mi ? `${K(mi)}分` : ''}${s ? `${K(s)}秒` : ''}`
    },
  },
  // 통화 기호 앞붙이: ¥1,200 · $5
  {
    rule: 'CURRENCY',
    re: /([¥￥$€£])\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d])/g,
    replace: (m) => numberToKanji(m[2] + (m[3] ?? '')) + CURRENCY_READING[m[1]],
  },
  // 단위: 5km · 30% · 2.5kg · -3℃
  {
    rule: 'UNIT',
    re: new RegExp(`(?<![A-Za-z\\d.,])([+-]?)(\\d{1,3}(?:,\\d{3})+|\\d+)(\\.\\d+)?\\s?(${UNIT_ALT})(?![A-Za-z])`, 'g'),
    replace: (m) => numberToKanji(m[1] + m[2] + (m[3] ?? '')) + UNIT_READING[m[4]],
  },
  // 조수사 예외(문맥 읽기 — 가나로 고정): 1人·2人·기간 1日·20歳
  { rule: 'COUNTER', re: /(?<![\d.,])1人/g, replace: () => 'ひとり' },
  { rule: 'COUNTER', re: /(?<![\d.,])2人/g, replace: () => 'ふたり' },
  // 一日中(いちにちじゅう)·一日目 은 사전 단어라 한자로 둔다.
  { rule: 'COUNTER', re: /(?<![\d.,])1日(?![中目])/g, replace: () => 'いちにち' },
  { rule: 'COUNTER', re: /(?<![\d.,])20[歳才]/g, replace: () => 'はたち' },
  // JLPT 급수: N5 → エヌゴ
  { rule: 'ABBREVIATION', re: /(?<![A-Za-z\d])N([1-5])(?!\d)/g, replace: (m) => `エヌ${JLPT_DIGIT[Number(m[1])]}` },
  { rule: 'ABBREVIATION', re: /(?<![A-Za-z])No\.\s?(?=\d)/g, replace: () => 'ナンバー' },
  // 일반 숫자: 1,200 · 3.14 · 2026 · 090(자리별)
  {
    rule: 'NUMBER',
    re: /(?<![A-Za-z\d,])(?<!\d\.)([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![A-Za-z\d])/g,
    replace: (m) => numberToKanji(m[1] + m[2] + (m[3] ?? '')),
  },
  // ③ 약어(대소문자 그대로) → 외래어(소문자). 표에 없으면 차지하지 않는다.
  {
    rule: 'ABBREVIATION',
    re: /(?<![A-Za-z])[A-Za-z](?:[A-Za-z'’-]*[A-Za-z])?(?![A-Za-z])/g,
    replace: (m) => ABBREVIATIONS[m[0]] ?? null,
  },
  {
    rule: 'LOANWORD',
    re: /(?<![A-Za-z])[A-Za-zé](?:[A-Za-zé'’-]*[A-Za-zé])?(?![A-Za-z])/g,
    replace: (m) => LOANWORDS[m[0].toLowerCase()] ?? null,
  },
  // ④ 기호
  { rule: 'SYMBOL', re: /[!?]+/g, replace: (m) => (m[0].includes('?') ? '？' : '！') },
  {
    rule: 'SYMBOL',
    re: /\.{2,}|[…‥]+/g,
    replace: (_m, w, _s, end) => {
      const next = w[end]
      if (next === undefined || '」』）)"'.includes(next)) return '。'
      if ('。!?'.includes(next)) return ''
      return '、'
    },
  },
  { rule: 'SYMBOL', re: /[,、]{2,}|,/g, replace: () => '、' },
  { rule: 'SYMBOL', re: /[。｡]{2,}|｡|\./g, replace: () => '。' },
  // 범위 물결표: 3〜5人 · 9時〜10時 → から
  { rule: 'SYMBOL', re: /(?<=[\d時分日月年円人個本回歳%])\s*[~〜]\s*(?=\d)/g, replace: () => 'から' },
  // 장음 물결표: すご〜い → すごーい (일본어 글자 뒤가 아니면 지운다)
  { rule: 'SYMBOL', re: /[~〜]+/g, replace: (_m, w, start) => (isJapaneseChar(w[start - 1]) && w[start - 1] !== 'ー' ? 'ー' : '') },
  { rule: 'SYMBOL', re: EMOJI, replace: () => '' },
  { rule: 'SYMBOL', re: /"/g, replace: () => '' },
  { rule: 'SYMBOL', re: /\(/g, replace: () => '（' },
  { rule: 'SYMBOL', re: /\)/g, replace: () => '）' },
  // 공백: 앞뒤는 지우고, 줄바꿈은 문장 끝, 영숫자 사이는 한 칸, 일본어 사이는 쉼표(쉼 자리)
  {
    rule: 'WHITESPACE',
    re: /\s+/g,
    replace: (m, w, start, end) => {
      const prev = prevVisible(w, start)
      const next = w[end]
      if (prev === undefined || end === w.length) return ''
      if (m[0].includes('\n')) return SENTENCE_END.includes(prev) || prev === '、' ? '' : '。'
      if (/[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next)) return ' '
      if (isJapaneseChar(prev) && isJapaneseChar(next)) return '、'
      return ''
    },
  },
]

export function normalizeJapanese(text: string, opts: NormalizeOptions = {}): NormalizationResult {
  const w = toWorkingText(text)
  const claimed: NormalizationToken[] = []
  const occupied = new Uint8Array(w.length)
  const free = (s: number, e: number) => {
    for (let i = s; i < e; i++) if (occupied[i]) return false
    return true
  }
  const claim = (s: number, e: number, replaced: string, rule: NormalizeRule) => {
    for (let i = s; i < e; i++) occupied[i] = 1
    claimed.push({ srcStart: s, srcEnd: e, surface: text.slice(s, e), replaced, rule })
  }

  for (const p of opts.protect ?? []) {
    if (p.start >= 0 && p.end <= w.length && p.end > p.start && free(p.start, p.end)) claim(p.start, p.end, text.slice(p.start, p.end), 'PROTECTED')
  }
  for (const r of RULES) {
    r.re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = r.re.exec(w))) {
      const s = m.index
      const e = s + m[0].length
      if (e === s) {
        r.re.lastIndex++
        continue
      }
      if (!free(s, e)) continue
      const out = r.replace(m, w, s, e)
      if (out === null) continue
      claim(s, e, out, r.rule)
    }
  }

  claimed.sort((a, b) => a.srcStart - b.srcStart)
  let out = ''
  let pos = 0
  for (const t of claimed) {
    out += text.slice(pos, t.srcStart) + t.replaced
    pos = t.srcEnd
  }
  out += text.slice(pos)
  const rulesApplied = claimed.filter((t) => t.rule !== 'PROTECTED' && t.replaced !== t.surface).length
  return { normalizedText: out.trim(), tokens: claimed, rulesApplied }
}
