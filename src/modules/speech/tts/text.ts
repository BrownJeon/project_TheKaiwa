/**
 * TTS 텍스트 공용 도우미 — 정규화기·사전이 **같은 좌표계**로 문자열을 보게 한다.
 *
 * `toWorkingText` 는 전각 영숫자·기호(U+FF01–FF5E)·전각 공백·마이너스 기호를 ASCII 로 **1:1(코드 유닛 단위)** 바꾼다.
 * 길이가 변하지 않으므로 working 문자열의 위치가 곧 원문 위치다(token map 을 원문 좌표로 되돌릴 때 보정이 필요 없다).
 */

export function toWorkingText(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xff01 && c <= 0xff5e) out += String.fromCharCode(c - 0xfee0)
    else if (c === 0x3000) out += ' '
    else if (c === 0x2212) out += '-'
    else out += s[i]
  }
  return out
}

/** 가타카나(長音符 포함) 한 글자 — 사전 읽기 검증·모라 수 계산용. */
export const KATAKANA_READING = /^[ァ-ヺー]+$/

const SMALL_KANA = new Set('ァィゥェォャュョヮヵヶ'.split(''))

/** 모라 수: 작은 가나(拗音)는 앞 글자와 한 모라, ッ·ン·ー 는 각각 한 모라. */
export function moraCount(reading: string): number {
  let n = 0
  for (const ch of reading) if (!SMALL_KANA.has(ch)) n++
  return n
}

/** 일본어 글자(가나·한자·長音符) — 공백·물결표 처리에서 문맥 판단에 쓴다. */
export function isJapaneseChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[぀-ヿ㐀-鿿豈-﫿ー々〆]/.test(ch)
}
