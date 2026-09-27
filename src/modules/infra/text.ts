/**
 * 사용자 입력 문자열 공통 처리(api-contract §0-2 문자열 폭 검증) — 도메인을 모른다.
 *
 * - 길이는 **코드포인트** 기준이다(서로게이트 쌍 = 1자). MariaDB `VARCHAR(n)`(utf8mb4)도 문자 수로 세므로 검증과 저장 한도가 일치하고,
 *   이모지(서로게이트 쌍) 하나가 2자로 세어져 한도가 줄어드는 일이 없다.
 * - 제어문자: C0(0x00–0x1F)·DEL(0x7F)·C1(0x80–0x9F)을 지운다. 여러 줄 입력은 `\n`·`\t` 를 남긴다(task-006 D10). `\r\n`·`\r` 은 `\n` 으로 맞춘다.
 * - 짝 없는 서로게이트(JSON `"\ud83d"` 같은 입력)는 U+FFFD 로 바꾼다 — 그대로 두면 DB(UTF-8) 왕복 뒤 값이 달라져 바이트 비교가 깨진다.
 */

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
const CONTROL_MULTILINE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g
const CONTROL_SINGLE_LINE = /[\u0000-\u001F\u007F-\u009F]/g

export function codePointLength(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++, n++) {
    const hi = s.charCodeAt(i)
    if (hi >= 0xd800 && hi <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) i++
    }
  }
  return n
}

/**
 * 입력 정리: 줄바꿈 정규화 → 짝 없는 서로게이트 치환 → 제어문자 제거 → 앞뒤 공백 제거.
 * `multiline=false` 면 줄바꿈·탭도 제어문자로 보고 지운다(제목·단어 같은 한 줄 필드).
 */
export function sanitizeText(input: string, opts: { multiline?: boolean } = {}): string {
  const normalized = input.replace(/\r\n?/g, '\n').replace(LONE_SURROGATE, '�')
  const stripped = normalized.replace(opts.multiline ? CONTROL_MULTILINE : CONTROL_SINGLE_LINE, '')
  return stripped.trim()
}

let segmenter: Intl.Segmenter | null | undefined
function graphemes(s: string): Iterable<string> {
  if (segmenter === undefined) segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null
  if (!segmenter) return Array.from(s)
  return Array.from(segmenter.segment(s), (x) => x.segment)
}

/**
 * 코드포인트 `max` 이하로 자른다. 자를 때는 **글자(그래핌) 경계**에서 끊고 끝에 `…` 를 붙인다(`…` 포함 `max` 이내) —
 * 서로게이트 쌍은 물론 이모지 결합(ZWJ·국기·피부색)도 반쪽이 남지 않는다.
 */
export function truncateCodePoints(s: string, max: number): string {
  if (codePointLength(s) <= max) return s
  const room = Math.max(0, max - 1)
  let out = ''
  let used = 0
  for (const g of graphemes(s)) {
    const n = codePointLength(g)
    if (used + n > room) break
    out += g
    used += n
  }
  return `${out}…`
}

/** 목록 미리보기용 — 줄바꿈·탭·연속 공백을 한 칸으로 접고 `max` 코드포인트로 자른다. */
export function toPreview(s: string, max: number): string {
  return truncateCodePoints(s.replace(/\s+/g, ' ').trim(), max)
}
