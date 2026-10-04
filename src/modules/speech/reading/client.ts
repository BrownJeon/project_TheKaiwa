/**
 * 일본어 읽기 표시 — 클라이언트 안전 순수 모듈(task-026 S1). 화면이 후리가나·한글 줄을 만들 때 import 하는 **유일한 변환기**다(화면별 변환 로직 금지).
 * 서버 코드·다른 모듈을 import 하지 않는다(eslint `speech/reading/client.ts` 규칙 + `speech/__tests__/reading.test.ts`).
 *
 * 입력은 `POST /api/v1/text/annotate` 의 세그먼트(서버 형태소 분석 — 표기·한자 묶음별 히라가나·발음 가나·구절 경계).
 *   - 루비: `rubyPieces(segments)` → `[{text, reading|null}]`(送り仮名 제외 — 한자 묶음 위에만 읽기). 데모 표기 `toRubyMarkup`(`今日{きょう}は`).
 *   - 한글: `hangulLine(segments)` = `kanaToHangul(pronLine(segments))`. 발음을 못 구한 조각이 하나라도 있으면 null(줄 전체 숨김 — "애매하면 숨김").
 *   - 단어장 표제어처럼 저장된 읽기가 있으면 서버 없이 `alignWordRuby(surface, reading)`.
 *
 * 가나 → 한글 규칙(데모 v2 `HG.convert(p, 'A', 'B')`, 사용자 결정 D1-A '까' 계열 · D2-B 구절 띄어쓰기):
 *   - 거센소리는 구절 첫 글자만(か=카 … 구절 안 か=까, た=따, ぱ=빠, ち·つ=쯔 계열), 탁음·나머지 행은 그대로.
 *   - 장음 ー·같은 모음 반복(いい·ええ) → '-'(조사 を=ヲ·へ=ヱ 는 합치지 않음 — `hangulLine` 이 조사 を·へ 를 ヲ·ヱ 로 넘긴다, QA O-1·QA-L1).
 *     장음 ー 바로 뒤의 같은 모음은 접지 않는다 — 장음은 이미 '-' 하나로 적었다(経営 ケーエー → 케-에-, task-031 REV-098 L-2). 촉음 っ → 앞 글자 받침(다음 자음에 따라 ㄱ/ㅂ/ㅅ), ん → 받침(ㅁ/ㅇ/ㄴ, 끝·모음 앞은 ㅇ).
 *   - 요음(きゃ·しゅ·ちょ…)·외래음(ファ·ティ·ウィ…), 문장부호는 。→. 、→, 「」→“ ”.
 *   - 발음 줄의 ' '(구절)·'|'(조사 は·を·へ 뒤)는 띄어쓰기 + 다음 글자를 구절 첫 글자로.
 */

export const READING_MAX_TEXTS = 64
export const READING_MAX_CHARS = 400

export type ReadingBoundary = 'phrase' | 'particle'
export interface ReadingSegment {
  surface: string
  /** 한자 묶음별 [표기, 히라가나|null] — 이어 붙이면 surface. 한자 없음·정렬 실패 = null. */
  ruby: Array<[string, string | null]> | null
  /** 발음 가타카나(조사 は→ワ·を→オ, 장음 ー) · 기호·공백은 원문. 못 구함 = null. */
  pron: string | null
  /** 이 조각 앞 구분. */
  boundary: ReadingBoundary | null
}
export interface RubyPiece {
  text: string
  reading: string | null
}

const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/
const KANJI_RUN = /[㐀-䶿一-鿿豈-﫿々〆ヶ]+|[^㐀-䶿一-鿿豈-﫿々〆ヶ]+/g
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/

export function hasKanji(s: string): boolean {
  return KANJI.test(s)
}

function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** 렌더용 루비 조각 — 읽기 없는 이웃 조각은 하나로 합친다. */
export function rubyPieces(segments: readonly ReadingSegment[]): RubyPiece[] {
  const out: RubyPiece[] = []
  const push = (text: string, reading: string | null) => {
    const last = out[out.length - 1]
    if (reading === null && last && last.reading === null) last.text += text
    else out.push({ text, reading })
  }
  for (const s of segments) {
    if (s.ruby) for (const [t, r] of s.ruby) push(t, r)
    else push(s.surface, null)
  }
  return out
}

/** 데모 표기(`今日{きょう}は`) — 테스트·디버그용. */
export function toRubyMarkup(segments: readonly ReadingSegment[]): string {
  return rubyPieces(segments)
    .map((p) => (p.reading ? `${p.text}{${p.reading}}` : p.text))
    .join('')
}

/** 발음 줄(데모 `p` 모양: ' ' 구절, '|' 조사 뒤). 못 구한 조각이 있으면 null. */
export function pronLine(segments: readonly ReadingSegment[]): string | null {
  return buildPronLine(segments, false)
}

/**
 * 모음만으로 된 발음의 조사 조각 — 조사 を(서버가 발음을 オ 로 바꿔 준다)·へ(エ). 표기가 を·へ 하나뿐인 조각은 늘 조사다.
 * 앞 단어 끝 모음과 같아도 장음으로 합치면 안 되므로 한글 변환기에 표식(を→ヲ·へ→ヱ)으로 넘긴다. は(ワ)·に·で·が·と·の 는 모음 단독이
 * 아니라 원래 합쳐지지 않는다.
 */
function particleMark(s: ReadingSegment): 'ヲ' | 'ヱ' | null {
  if ((s.surface === 'を' || s.surface === 'ヲ') && s.pron === 'オ') return 'ヲ'
  if ((s.surface === 'へ' || s.surface === 'ヘ') && s.pron === 'エ') return 'ヱ'
  return null
}

/**
 * `markParticles` 면 조사 を·へ 의 발음을 ヲ·ヱ 로 남긴다 — 발음 줄 문자열만으로는 「ノオ」가 장음인지 「ノ+を」인지 모르므로 한글 변환기에
 * 조사 위치를 넘기는 표식이다(QA O-1: `ピアノを`→`피아노-` 가 아니라 `피아노오`, QA-L1: `先生へ`→`센세--` 가 아니라 `센세-에`).
 * 공개 `pronLine` 은 데모 모양(オ·エ) 그대로.
 */
function buildPronLine(segments: readonly ReadingSegment[], markParticles: boolean): string | null {
  if (segments.length === 0) return null
  let out = ''
  for (const s of segments) {
    if (s.pron === null) return null
    const pron = (markParticles && particleMark(s)) || s.pron
    out += (s.boundary === 'phrase' ? ' ' : s.boundary === 'particle' ? '|' : '') + pron
  }
  const line = out.trim()
  return /[ぁ-ゖァ-ヺ]/.test(line) ? line : null
}

export function hangulLine(segments: readonly ReadingSegment[]): string | null {
  const p = buildPronLine(segments, true)
  return p === null ? null : kanaToHangul(p) || null
}

/** 단어 표제어·읽기 저장 상한(api-contract #41 surface ≤80 · reading ≤120)과 같다 — 넘으면 정렬하지 않는다. */
export const WORD_RUBY_MAX_SURFACE = 80
export const WORD_RUBY_MAX_READING = 120

/**
 * 저장된 단어 읽기(히라가나·가타카나)로 표제어 루비 — 한자 묶음은 1글자 이상 가장 짧게, 가나 부분은 그대로 맞춘다(送り仮名 분리: 面白い → 面白{おもしろ}い).
 * 한자 없음·가나 아닌 글자(숫자·영문)·상한 초과·정렬 실패면 null(루비 없이 표시).
 * 정규식 `(.+?)` 연쇄는 묶음이 많으면 역추적이 지수로 늘어(REV-086 M1: 8묶음·80자 >100s) 화면이 멈춘다 — 같은 탐색 순서를
 * (묶음 번호, 읽기 위치) 실패 기억으로 다항(묶음 수 × 읽기 길이²)에 끝낸다. 결과는 예전 정규식과 같다(가장 앞 묶음부터 최단).
 */
export function alignWordRuby(surface: string, reading: string): RubyPiece[] | null {
  if (!hasKanji(surface) || !reading || !KANA_ONLY.test(reading)) return null
  if (surface.length > WORD_RUBY_MAX_SURFACE || reading.length > WORD_RUBY_MAX_READING) return null
  const parts = surface.match(KANJI_RUN) ?? []
  const kanji = parts.map((p) => KANJI.test(p))
  const literal: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (kanji[i]) literal.push('')
    else if (KANA_ONLY.test(parts[i])) literal.push(kataToHira(parts[i]))
    else return null
  }
  const hira = kataToHira(reading)
  const n = parts.length
  const len = hira.length
  const minRest = new Array<number>(n + 1).fill(0)
  for (let i = n - 1; i >= 0; i--) minRest[i] = minRest[i + 1] + (kanji[i] ? 1 : literal[i].length)
  const failed = new Uint8Array((n + 1) * (len + 1))
  const cut = new Array<number>(n).fill(0)
  const solve = (i: number, pos: number): boolean => {
    if (i === n) return pos === len
    const key = i * (len + 1) + pos
    if (failed[key]) return false
    if (!kanji[i]) {
      if (hira.startsWith(literal[i], pos) && solve(i + 1, pos + literal[i].length)) {
        cut[i] = pos + literal[i].length
        return true
      }
    } else {
      for (let end = pos + 1; end <= len - minRest[i + 1]; end++) {
        if (solve(i + 1, end)) {
          cut[i] = end
          return true
        }
      }
    }
    failed[key] = 1
    return false
  }
  if (!solve(0, 0)) return null
  return parts.map((p, i) => ({ text: p, reading: kanji[i] ? hira.slice(i === 0 ? 0 : cut[i - 1], cut[i]) : null }))
}

// ── 가나 → 한글 ─────────────────────────────────────────────────────────────────

type Cls = 'X' | 'K' | 'G' | 'S' | 'Z' | 'T' | 'D' | 'CH' | 'TS' | 'N' | 'H' | 'B' | 'P' | 'M' | 'R'
type Lead = 'g' | 'kk' | 'n' | 'd' | 'tt' | 'r' | 'm' | 'b' | 'pp' | 's' | 'x' | 'j' | 'jj' | 'ch' | 'k' | 't' | 'p' | 'h'
type Vowel = 'a' | 'ya' | 'e' | 'ye' | 'o' | 'wa' | 'yo' | 'u' | 'wo' | 'we' | 'wi' | 'yu' | 'eu' | 'i'
type Tail = 'k' | 'n' | 'm' | 'p' | 't' | 'ng'

const LEAD: Record<Lead, number> = { g: 0, kk: 1, n: 2, d: 3, tt: 4, r: 5, m: 6, b: 7, pp: 8, s: 9, x: 11, j: 12, jj: 13, ch: 14, k: 15, t: 16, p: 17, h: 18 }
const VOWEL: Record<Vowel, number> = { a: 0, ya: 2, e: 5, ye: 7, o: 8, wa: 9, yo: 12, u: 13, wo: 14, we: 15, wi: 16, yu: 17, eu: 18, i: 20 }
const TAIL: Record<Tail, number> = { k: 1, n: 4, m: 16, p: 17, t: 19, ng: 21 }

const BASE = new Map<string, [Cls, Vowel]>()
function row(chars: string, cls: Cls, vs: readonly (Vowel | '')[]): void {
  for (let i = 0; i < chars.length; i++) if (chars[i] !== '_' && vs[i]) BASE.set(chars[i], [cls, vs[i] as Vowel])
}
const AIUEO: Vowel[] = ['a', 'i', 'u', 'e', 'o']
row('アイウエオ', 'X', AIUEO)
row('カキクケコ', 'K', AIUEO)
row('ガギグゲゴ', 'G', AIUEO)
row('サシスセソ', 'S', ['a', 'i', 'eu', 'e', 'o'])
row('ザジズゼゾ', 'Z', ['a', 'i', 'eu', 'e', 'o'])
row('タ__テト', 'T', ['a', '', '', 'e', 'o'])
BASE.set('チ', ['CH', 'i'])
BASE.set('ツ', ['TS', 'eu'])
row('ダ__デド', 'D', ['a', '', '', 'e', 'o'])
BASE.set('ヂ', ['Z', 'i'])
BASE.set('ヅ', ['Z', 'eu'])
row('ナニヌネノ', 'N', AIUEO)
row('ハヒフヘホ', 'H', AIUEO)
row('バビブベボ', 'B', AIUEO)
row('パピプペポ', 'P', AIUEO)
row('マミムメモ', 'M', AIUEO)
row('ヤユヨ', 'X', ['ya', 'yu', 'yo'])
row('ラリルレロ', 'R', AIUEO)
row('ワヲヰヱ', 'X', ['wa', 'o', 'i', 'e'])
BASE.set('ヴ', ['B', 'u'])

const SMALL_Y: Record<string, Vowel> = { ャ: 'ya', ュ: 'yu', ョ: 'yo' }
const SMALL_V: Record<string, Vowel> = { ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o', ヮ: 'wa' }
const PUNCT: Record<string, string> = { '。': '.', '、': ',', '？': '?', '！': '!', '?': '?', '!': '!', '.': '.', ',': ',', '「': '“', '」': '”', '『': '“', '』': '”', '〜': '~', '～': '~', '…': '…', '・': ' ' }
const FU_V: Partial<Record<Vowel, Vowel>> = { a: 'wa', i: 'wi', e: 'we', o: 'wo', u: 'u', wa: 'wa' }

/** `part` = 조사 を(ヲ)·へ(ヱ) — 앞 모음과 같아도 장음으로 합치지 않는다(「ピアノを」 piano o · 「先生へ」 센세-에). */
type Mora = { k: 'sp'; hard: boolean } | { k: 'long' } | { k: 'gem' } | { k: 'nn' } | { k: 'p'; t: string } | { k: 'raw'; t: string } | { k: 'm'; cls: Cls; v: Vowel; part?: true }

function lead(cls: Cls, initial: boolean): Lead {
  switch (cls) {
    case 'K':
      return initial ? 'k' : 'kk'
    case 'T':
      return initial ? 't' : 'tt'
    case 'P':
      return initial ? 'p' : 'pp'
    case 'CH':
    case 'TS':
      return initial ? 'ch' : 'jj'
    case 'G':
      return 'g'
    case 'S':
      return 's'
    case 'Z':
      return 'j'
    case 'D':
      return 'd'
    case 'N':
      return 'n'
    case 'H':
      return 'h'
    case 'B':
      return 'b'
    case 'M':
      return 'm'
    case 'R':
      return 'r'
    default:
      return 'x'
  }
}

function syllable(l: Lead, v: Vowel): string {
  return String.fromCharCode(0xac00 + (LEAD[l] * 21 + VOWEL[v]) * 28)
}

function tokenize(src: string): Mora[] {
  const s = hiraToKata(src.replace(/\|/g, '| ').replace(/\s+/g, ' ').trim())
  const ms: Mora[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '|') {
      ms.push({ k: 'sp', hard: true })
      i++
      continue
    }
    if (c === ' ') {
      ms.push({ k: 'sp', hard: false })
      continue
    }
    if (c === 'ー') {
      ms.push({ k: 'long' })
      continue
    }
    if (c === 'ッ') {
      ms.push({ k: 'gem' })
      continue
    }
    if (c === 'ン') {
      ms.push({ k: 'nn' })
      continue
    }
    if (PUNCT[c] !== undefined) {
      ms.push({ k: 'p', t: PUNCT[c] })
      continue
    }
    const b = BASE.get(c)
    if (b) {
      let v = b[1]
      const nx = s[i + 1]
      if (nx && SMALL_Y[nx] && v === 'i') {
        v = SMALL_Y[nx]
        i++
      } else if (nx && SMALL_V[nx]) {
        const sv = SMALL_V[nx]
        let used = true
        if (c === 'フ' || c === 'ウ') v = FU_V[sv] ?? sv
        else if (c === 'ヴ' || c === 'テ' || c === 'デ' || c === 'ト' || c === 'ド' || c === 'ツ') v = sv
        else if (c === 'シ' || c === 'ジ' || c === 'チ' || c === 'イ') v = sv === 'e' ? 'ye' : sv
        else used = false
        if (used) i++
      }
      ms.push(c === 'ヲ' || c === 'ヱ' ? { k: 'm', cls: b[0], v, part: true } : { k: 'm', cls: b[0], v })
      continue
    }
    if (SMALL_V[c]) {
      ms.push({ k: 'm', cls: 'X', v: SMALL_V[c] })
      continue
    }
    if (SMALL_Y[c]) {
      ms.push({ k: 'm', cls: 'X', v: SMALL_Y[c] })
      continue
    }
    ms.push({ k: 'raw', t: c })
  }
  return ms
}

/** 읽는 소리 가나(히라가나·가타카나, ' '·'|' 구분 포함) → 한글 표기. 가나가 아닌 글자는 그대로 둔다(호출자가 pronLine 으로 걸러 넣는다). */
export function kanaToHangul(kana: string): string {
  const ms = tokenize(kana)
  const out: string[] = []
  let lastSyl = -1
  let initial = true
  let prevV: string | null = null
  /** 바로 앞이 '-' 로 적은 장음 ー 인가 — 그 뒤 같은 모음은 새 음절로 적는다. */
  let afterLong = false
  const vowelOf = (v: Vowel) => (v === 'eu' ? 'u' : v.slice(-1))
  const nextMora = (j: number): Extract<Mora, { k: 'm' }> | null => {
    for (let q = j + 1; q < ms.length; q++) {
      const m = ms[q]
      if (m.k === 'm') return m
      if (m.k !== 'long') return null
    }
    return null
  }
  const addTail = (t: Tail): boolean => {
    if (lastSyl < 0) return false
    const code = out[lastSyl].charCodeAt(0) - 0xac00
    if (code % 28 !== 0) return false
    out[lastSyl] = String.fromCharCode(0xac00 + code + TAIL[t])
    return true
  }
  for (let j = 0; j < ms.length; j++) {
    const m = ms[j]
    const longBefore = afterLong
    afterLong = false
    if (m.k === 'sp') {
      lastSyl = -1
      prevV = null
      if (out.length && out[out.length - 1] !== ' ') out.push(' ')
      initial = true
      continue
    }
    if (m.k === 'p') {
      out.push(m.t)
      lastSyl = -1
      prevV = null
      const next = ms[j + 1]
      if (/[.,?!]/.test(m.t) && next && next.k !== 'sp' && next.k !== 'p') out.push(' ')
      initial = true
      continue
    }
    if (m.k === 'raw') {
      out.push(m.t)
      lastSyl = -1
      prevV = null
      initial = true
      continue
    }
    if (m.k === 'long') {
      if (prevV) {
        out.push('-')
        afterLong = true
      }
      continue
    }
    if (m.k === 'gem') {
      const n1 = nextMora(j)
      let t: Tail = 't'
      if (n1 && (n1.cls === 'K' || n1.cls === 'G')) t = 'k'
      else if (n1 && (n1.cls === 'P' || n1.cls === 'B')) t = 'p'
      addTail(t)
      initial = false
      continue
    }
    if (m.k === 'nn') {
      const n2 = nextMora(j)
      let t: Tail = 'ng'
      if (n2) {
        if (n2.cls === 'M' || n2.cls === 'B' || n2.cls === 'P') t = 'm'
        else if (n2.cls === 'K' || n2.cls === 'G') t = 'ng'
        else if (/^(S|Z|T|D|N|R|CH|TS)$/.test(n2.cls)) t = 'n'
      }
      if (!addTail(t)) {
        out.push('응')
        lastSyl = -1
      }
      prevV = null
      initial = false
      continue
    }
    if (m.cls === 'X' && !m.part && !longBefore && /^[aiueo]$/.test(m.v) && prevV && prevV === m.v) {
      out.push('-')
      prevV = null
      initial = false
      continue
    }
    out.push(syllable(lead(m.cls, initial), m.v))
    lastSyl = out.length - 1
    prevV = vowelOf(m.v)
    initial = false
  }
  return out
    .join('')
    .replace(/\s+([.,?!”])/g, '$1')
    .replace(/ +/g, ' ')
    .trim()
}
