/**
 * 아라비아 숫자 → 한자 숫자(speech-platform/16 §3.2 "한자 숫자 우선" — pyopenjtalk 사전의 조수사 음편·악센트를 살린다).
 * 4자리 단위로 万·億·兆 를 넣는다. 범위를 넘거나 0 으로 시작하는 숫자열(전화번호 등)은 자리별로 읽는다.
 */

const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const GROUP_UNITS = ['', '万', '億', '兆']
/** 자리별 읽기(가타카나) — 0 으로 시작하는 숫자열·소수점 아래. 한자 〇 은 엔진마다 レイ/ゼロ 로 갈려 가나로 고정한다. */
const DIGIT_KANA = ['ゼロ', 'イチ', 'ニー', 'サン', 'ヨン', 'ゴー', 'ロク', 'ナナ', 'ハチ', 'キュー']

function group4(n: number): string {
  const d3 = Math.floor(n / 1000) % 10
  const d2 = Math.floor(n / 100) % 10
  const d1 = Math.floor(n / 10) % 10
  const d0 = n % 10
  let s = ''
  if (d3) s += (d3 === 1 ? '' : KANJI[d3]) + '千'
  if (d2) s += (d2 === 1 ? '' : KANJI[d2]) + '百'
  if (d1) s += (d1 === 1 ? '' : KANJI[d1]) + '十'
  if (d0) s += KANJI[d0]
  return s
}

/** 자리별 가타카나 읽기(`090` → ゼロキューゼロ). */
export function digitsToKana(digits: string): string {
  let s = ''
  for (const ch of digits) {
    const d = ch.charCodeAt(0) - 48
    if (d >= 0 && d <= 9) s += DIGIT_KANA[d]
  }
  return s
}

/** 정수 문자열(쉼표 없음) → 한자 숫자. 17자리 이상·앞자리 0 은 자리별 가나. */
export function integerToKanji(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits
  if (digits.length > 1 && digits.startsWith('0')) return digitsToKana(digits)
  if (digits.length > 16) return digitsToKana(digits)
  if (/^0+$/.test(digits)) return 'ゼロ'
  const groups: number[] = []
  for (let end = digits.length; end > 0; end -= 4) groups.unshift(Number(digits.slice(Math.max(0, end - 4), end)))
  let s = ''
  groups.forEach((g, i) => {
    if (g === 0) return
    s += group4(g) + GROUP_UNITS[groups.length - 1 - i]
  })
  return s
}

/** 소수점 아래는 자리별로 읽는다(`14` → 一四). 0 만 가나(ゼロ). */
function fractionToKanji(digits: string): string {
  let s = ''
  for (const ch of digits) {
    const d = ch.charCodeAt(0) - 48
    s += d === 0 ? 'ゼロ' : KANJI[d]
  }
  return s
}

/** `1,200` · `3.14` · `-5` 형태 → 한자 숫자(부호 マイナス/プラス, 소수점 点). */
export function numberToKanji(raw: string): string {
  const m = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(raw)
  if (!m) return raw
  const sign = m[1] === '-' ? 'マイナス' : m[1] === '+' ? 'プラス' : ''
  const intPart = integerToKanji(m[2].replace(/,/g, ''))
  const frac = m[3] ? `点${fractionToKanji(m[3])}` : ''
  return sign + intPart + frac
}
