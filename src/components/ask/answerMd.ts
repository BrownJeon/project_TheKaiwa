/**
 * 선생님 답 `answerMd` 파서(순수, task-064 screens.md §25-6). 결과는 화이트리스트 노드 값뿐이고 `AnswerMarkdown` 이 React 요소로 그린다 —
 * 문자열을 HTML 로 해석하는 길(innerHTML·DOMParser·마크다운→HTML 라이브러리)은 쓰지 않는다. 링크는 어떤 형태로도 만들지 않는다(3a).
 *
 * 서버가 저장 전에 이미 살균하지만(계약 §2-18-A 8항, `sanitizeAskAnswerMd`) 화면도 같은 규칙으로 한 번 더 지운다 — 옛 행·서버를 우회한 값 대비.
 * 블록 문법: 빈 줄 = 경계 · 그 밖 글 = 문단(줄바꿈 노드) · `- * + ・ •` 목록 · `1. 1)` 번호 목록 · `>` 인용 묶음(예문 판정 — 뜻은 `> →` 줄 또는 일본어 줄 바로 아래 기호 없는 한 줄) · `#` 제목 → 굵은 문단 ·
 * 가로줄·울타리 줄 버림. 인라인: `**`·`__` 굵게, 붙은 `*` 기울임, 그 밖은 글.
 */

export type Inline = { t: 'text'; s: string } | { t: 'strong'; c: Inline[] } | { t: 'em'; c: Inline[] } | { t: 'br' }

export type AskBlock =
  | { k: 'p'; c: Inline[] }
  | { k: 'ul'; items: Inline[][] }
  | { k: 'ol'; start: number; items: Inline[][] }
  | { k: 'ex'; ja: string; meaning: string | null }
  | { k: 'quote'; c: Inline[] }

/** 예문 일본어 줄 상한(코드포인트) — 넘으면 인용 상자로 그려 분석 요청이 커지지 않게. */
export const EXAMPLE_JA_MAX = 200

// 제어 문자(\n·\t 제외)와 보이지 않는 서식 문자 — 서버 `sanitizeAskAnswerMd` 와 같은 범위.
const CONTROL_OR_FORMAT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\p{Cf}/gu
const HTML_COMMENT = /<!--[\s\S]*?-->/g
const HTML_BR = /<br\s*\/?>/gi
// `<https://…>` 꺾쇠 자동 링크도 이 모양이라 같이 지워진다.
const HTML_TAG = /<\/?[A-Za-z!][^>\n]*>/g
const MD_IMAGE = /!\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)/g
const MD_LINK = /\[([^\]\n]*)\]\((?:[^()\n]|\([^()\n]*\))*\)/g
const FOOTNOTE = /\[\^[^\]\s]{1,20}\]/g
const SCHEME = /\b(?:javascript|data|vbscript|file):[^\s)」』]*/gi
const URL_LIKE = /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.)[^\s)」』]+/gi

/** 제어 문자 제거·탭 → 공백·HTML 태그·이미지 지움·링크는 글만·각주 표식·스킴/주소 지움. 줄바꿈은 `\n` 으로 맞춘다. */
export function sanitizeAnswerText(md: string): string {
  let t = md.replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
  t = t.replace(CONTROL_OR_FORMAT, '')
  t = t.replace(HTML_COMMENT, '').replace(HTML_BR, '\n').replace(HTML_TAG, '')
  t = t.replace(MD_IMAGE, '').replace(MD_LINK, (_m, label: string) => label)
  t = t.replace(FOOTNOTE, '')
  t = t.replace(SCHEME, '').replace(URL_LIKE, '')
  return t
}

// ── 인라인 ─────────────────────────────────────────────────────────────────────

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch)

function pushText(out: Inline[], s: string) {
  if (!s) return
  const last = out[out.length - 1]
  if (last && last.t === 'text') last.s += s
  else out.push({ t: 'text', s })
}

/**
 * 인라인 노드. `strong`=false 면 굵게 표식을 글자로(굵게 안 굵게), `em`=false 면 기울임 표식을 글자로.
 * 기울임 `*글*` 은 여는 별표 뒤·닫는 별표 앞이 공백이 아닐 때만(「3 * 4」·짝 없는 별표는 글자).
 */
export function parseInline(s: string, opts: { strong?: boolean; em?: boolean } = {}): Inline[] {
  const allowStrong = opts.strong !== false
  const allowEm = opts.em !== false
  const out: Inline[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\n') {
      out.push({ t: 'br' })
      i++
      continue
    }
    const two = s.slice(i, i + 2)
    if (allowStrong && (two === '**' || two === '__')) {
      const close = s.indexOf(two, i + 2)
      if (close > i + 2) {
        out.push({ t: 'strong', c: parseInline(s.slice(i + 2, close), { strong: false, em: allowEm }) })
        i = close + 2
        continue
      }
    }
    if (allowEm && ch === '*' && s[i + 1] !== '*' && !isSpace(s[i + 1])) {
      let close = -1
      for (let k = i + 2; k < s.length; k++) {
        if (s[k] === '\n') break
        if (s[k] === '*' && !isSpace(s[k - 1]) && s[k + 1] !== '*') {
          close = k
          break
        }
      }
      if (close !== -1) {
        out.push({ t: 'em', c: parseInline(s.slice(i + 1, close), { strong: false, em: false }) })
        i = close + 1
        continue
      }
    }
    if (two === '**' || two === '__') {
      pushText(out, two)
      i += 2
      continue
    }
    pushText(out, ch)
    i++
  }
  return out
}

// ── 블록 ───────────────────────────────────────────────────────────────────────

const RE_FENCE = /^\s*(`{3,}|~{3,})/
const RE_RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const RE_HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/
const RE_UL = /^\s*(?:[-*+]\s+|[・•]\s*)(.*)$/
const RE_OL = /^\s*(\d{1,3})[.)]\s+(.*)$/
const RE_QUOTE = /^\s*> ?(.*)$/

type Line =
  | { k: 'blank' }
  | { k: 'drop' }
  | { k: 'heading'; s: string }
  | { k: 'ul'; s: string }
  | { k: 'ol'; n: number; s: string }
  | { k: 'quote'; s: string }
  | { k: 'text'; s: string; indent: number }

function classify(raw: string): Line {
  if (raw.trim() === '') return { k: 'blank' }
  if (RE_FENCE.test(raw) || RE_RULE.test(raw)) return { k: 'drop' }
  const h = RE_HEADING.exec(raw)
  if (h) return { k: 'heading', s: h[1].replace(/\*\*|__/g, '').trim() }
  const q = RE_QUOTE.exec(raw)
  if (q) return { k: 'quote', s: q[1] }
  const o = RE_OL.exec(raw)
  if (o) return { k: 'ol', n: Number(o[1]), s: o[2] }
  const u = RE_UL.exec(raw)
  if (u && u[1].trim() !== '') return { k: 'ul', s: u[1] }
  const indent = raw.length - raw.trimStart().length
  return { k: 'text', s: raw.trim(), indent }
}

const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const HANGUL = /\p{Script=Hangul}/u
const MEANING = /^(?:→|->)\s*(.*)$/

function unmark(s: string): string {
  return s.replace(/\*\*|\*/g, '').trim()
}

function isJaLine(s: string): boolean {
  const n = Array.from(s).length
  return n >= 1 && n <= EXAMPLE_JA_MAX && JA_CHAR.test(s) && !HANGUL.test(s)
}

/** 기호 없는 뜻 줄 상한(코드포인트) — 일본어 줄과 별개로, 설명 문단이 뜻으로 빨려 들어가지 않게. */
export const EXAMPLE_MEANING_MAX = 120

type QuoteKind = { k: 'JA' | 'M' | 'X'; s: string }

function quoteKinds(lines: string[]): QuoteKind[] {
  return lines
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const u = unmark(l)
      const m = MEANING.exec(u)
      if (m) return { k: 'M' as const, s: m[1].trim() }
      return isJaLine(u) ? { k: 'JA' as const, s: u } : { k: 'X' as const, s: u }
    })
}

/** 모든 줄이 일본어·뜻이고, 첫 줄이 일본어이고, 뜻 줄이 연달아 오지 않을 때만 예문 묶음. */
const isExampleGroup = (kinds: QuoteKind[]) =>
  kinds.length > 0 && kinds[0].k === 'JA' && kinds.every((x, i) => x.k !== 'X' && !(x.k === 'M' && kinds[i - 1]?.k === 'M'))

/**
 * 인용 묶음 바로 다음 줄(`>` 없음, 빈 줄 없이 이어짐)이 마지막 예문의 뜻인가(§25-6 B 정정, REV-064-U H-1). 프롬프트 모듈은 `> 일본어` 아래 기호 없는 한국어 뜻 줄을 낸다.
 * 한글 ≥1자(일본어가 섞여도 됨)·≤120 코드포인트. 목록·번호·제목 표식으로 시작하는 줄은 `classify` 가 이미 text 가 아니라고 걸러 여기 오지 않는다. 앞의 `→` 는 지운다.
 */
function followMeaning(textLine: string): string | null {
  const u = unmark(textLine)
  const m = MEANING.exec(u)
  const s = (m ? m[1] : u).trim()
  const n = Array.from(s).length
  return n >= 1 && n <= EXAMPLE_MEANING_MAX && HANGUL.test(s) ? s : null
}

/** 이 인용 묶음의 마지막 일본어 줄이 뜻을 아직 못 받았고 그 줄이 묶음의 맨 끝(빈 `>` 줄이 끼지 않음)인가 — 다음 줄을 뜻으로 줄 수 있는 모양. */
function canTakeFollowMeaning(lines: string[]): boolean {
  if (lines.length === 0 || lines[lines.length - 1].trim() === '') return false
  const kinds = quoteKinds(lines)
  return isExampleGroup(kinds) && kinds[kinds.length - 1].k === 'JA'
}

/** 인용 묶음 → 예문 블록들 또는 인용 상자 하나. `follow` = 묶음 바로 다음의 기호 없는 뜻 줄(마지막 예문에만). */
function quoteBlocks(lines: string[], follow: string | null = null): AskBlock[] {
  const kinds = quoteKinds(lines)
  if (kinds.length === 0) return []
  if (isExampleGroup(kinds)) {
    const out: AskBlock[] = []
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i].k !== 'JA') continue
      const next = kinds[i + 1]
      const meaning = next?.k === 'M' ? next.s : next === undefined ? follow : null
      out.push({ k: 'ex', ja: kinds[i].s, meaning: meaning ? meaning : null })
    }
    return out
  }
  return [{ k: 'quote', c: parseInline(lines.map((l) => l.trim()).join('\n').trim()) }]
}

/** `answerMd` → 블록 값(살균 포함). 빈 입력이면 []. */
export function parseAnswerMd(md: string): AskBlock[] {
  const out: AskBlock[] = []
  let para: string[] | null = null
  let list: { k: 'ul' | 'ol'; start: number; items: string[] } | null = null
  let quote: string[] | null = null

  const flush = () => {
    if (para) out.push({ k: 'p', c: parseInline(para.join('\n')) })
    if (list) {
      const items = list.items.map((s) => parseInline(s))
      out.push(list.k === 'ul' ? { k: 'ul', items } : { k: 'ol', start: list.start, items })
    }
    if (quote) out.push(...quoteBlocks(quote))
    para = null
    list = null
    quote = null
  }

  for (const raw of sanitizeAnswerText(md).split('\n')) {
    const line = classify(raw)
    switch (line.k) {
      case 'blank':
      case 'drop':
        flush()
        break
      case 'heading':
        flush()
        if (line.s) out.push({ k: 'p', c: [{ t: 'strong', c: parseInline(line.s, { strong: false }) }] })
        break
      case 'quote':
        if (!quote) flush()
        quote = quote ?? []
        quote.push(line.s)
        break
      case 'ul':
      case 'ol': {
        const k = line.k
        const cur = list as { k: 'ul' | 'ol'; start: number; items: string[] } | null
        if (!cur || cur.k !== k || para || quote) {
          flush()
          list = { k, start: line.k === 'ol' ? line.n : 1, items: [] }
        }
        ;(list as unknown as { items: string[] }).items.push(line.s.trim())
        break
      }
      case 'text': {
        if (quote && canTakeFollowMeaning(quote)) {
          const meaning = followMeaning(line.s)
          if (meaning !== null) {
            out.push(...quoteBlocks(quote, meaning))
            quote = null
            break
          }
        }
        const cur = list as { items: string[] } | null
        if (cur && line.indent >= 2) {
          cur.items[cur.items.length - 1] += `\n${line.s}`
          break
        }
        if (!para) flush()
        para = para ?? []
        para.push(line.s)
        break
      }
    }
  }
  flush()
  return out
}

/** 예문 블록의 일본어 줄만 순서대로 — 히라가나·한글 분석은 이것만 요청한다(§25-6 E). */
export function exampleJaLines(blocks: readonly AskBlock[]): string[] {
  const out: string[] = []
  for (const b of blocks) if (b.k === 'ex') out.push(b.ja)
  return out
}
