/**
 * A9 무엇이든 물어보세요(ASK, `ask@v3` — 응답 스키마는 v1 과 같다) 응답 계약 — 스키마 · 후검증 · 정리(`parseAskResponse`). 프롬프트·입력 직렬화는 `prompts/ask.ts`.
 * (이 파일을 `structuredResponse/` 가 아니라 `prompts/` 에 둔 것은 task-064 범위 지시 때문이다 — 옮기려면 import 경로만 바꾸면 된다.)
 *
 * 설계 근거 (api-contract §2-18-A 3·8·9)
 *  - **LLM 은 `sources[]` 를 만들지 않는다.** 응답은 `sourceKeys`(프롬프트에 붙인 턴 안 임시 키 `S#`)만 내고, 서버가 그 키를 실제 조회 행의 `{type,id,date,label}` 로 푼다.
 *    그래서 내부 id 가 프롬프트에 나가지 않고 근거 일치율이 구조적으로 100% 다. 이 파일은 키가 **이번 턴에 프롬프트에 실린 키의 부분집합**임을 `extraCheck` 로 강제한다(모델이 없는
 *    키를 지어내면 근거를 지어냈다는 신호라 JSON 재시도 1회 — 서버가 조용히 버리면 지어낸 기록이 근거 카드 없이 본문에만 남는다).
 *  - **스키마는 구조만** 본다(형·enum·필수·느슨한 길이). 항목 단위로 고칠 수 있는 것(제안 한 건의 모양, 마크다운 서식)은 재시도 없이 `parseAskResponse` 가 고치거나 그 항목만 버린다
 *    (재시도 = 최대 120s 예산에서 수십 초 — phraseHelp·topicDraft 와 같은 원칙). 고칠 수 없는 것(답이 비었음·4,000자 초과·한글 없음·엔진 이름 노출·제공하지 않은 키)만 위반이다.
 *  - 키 순서 = 출력 순서 지시: `needsScope → answerMd → sourceKeys → confidence → proposals`. 되묻기 여부를 본문보다 먼저 정해 "되묻기인데 본문이 긴 답" 모순을 줄이고,
 *    확신도는 답을 쓴 뒤에 판단하게 한다. (순서가 품질에 주는 영향은 task-064 PE 기록의 측정 절 참고.)
 *  - `answerMd` 정리(`sanitizeAskAnswerMd`)는 서버 저장 전 살균(§2-18-A 8)의 **첫 방어선**이다 — HTML·링크·이미지·URL·스킴·제어 문자를 글자만 남기고 지우며, 화이트리스트 밖 서식
 *    (제목·표·번호 목록·코드)을 허용 서식으로 바꾼다. 서버·클라이언트의 독립 살균/렌더 화이트리스트를 대체하지 않는다.
 */
import { llm } from '@/modules/engine'
import { JLPT_LEVELS, type JlptLevel } from '../structuredResponse/schemas'

export const ASK_CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type AskConfidence = (typeof ASK_CONFIDENCES)[number]

/**
 * 근거 유형(api-contract §2-18-A 3·5) — 빌더가 받는 조회 항목의 `type` 화이트리스트이기도 하다(그 밖의 유형은 프롬프트에 싣지 않는다).
 * 단어장 단어(`WORD`)는 사용자가 본 동의 문구(보내는 범위 시트)에 없어 외부 전송 범위 밖이다 — 유형 자체가 없다.
 */
export const ASK_SOURCE_TYPES = ['LESSON', 'CORRECTION', 'SCENARIO', 'REVIEW', 'STUDY_LOG', 'EVALUATION'] as const
export type AskSourceType = (typeof ASK_SOURCE_TYPES)[number]

/**
 * ASK 3a 가 낼 수 있는 제안 종류(api-contract §2-18-A 3, Leader 정정 2026-10-12). `SCHEDULE_REVIEW` 는 A11 복습 판단의 정식 경로로만 생성되고,
 * `ADD_TOPIC` 은 채택 경로(`proposals` 의 `ACCEPTABLE`)가 아직 없어 3a 에서 서버가 내지 않는다 — 스키마에도 없다(모델이 내면 계약 위반 → 재시도).
 */
export const ASK_PROPOSAL_KINDS = ['ADD_WORD', 'ADD_STUDY_LOG', 'SET_LEVEL'] as const
export type AskProposalKind = (typeof ASK_PROPOSAL_KINDS)[number]

/** 턴 안 임시 근거 키 — `S1`…`S99`. 서버(learning/recordRetrieval)가 붙이고 빌더는 형식만 검사한다. */
export const ASK_KEY_RE = /^S[1-9][0-9]?$/
export const isAskKey = (v: unknown): v is string => typeof v === 'string' && ASK_KEY_RE.test(v)

/** 한도 — 지시문·스키마·정리가 같은 값을 쓴다(어긋나면 단위 시험이 잡는다). */
export const ASK_LIMITS = {
  /** #32 요청 text 상한(api-contract §2-18-A 3). */
  userTextMax: 1_000,
  /** answerMd 상한(코드포인트) — 스키마 `maxLength` 와 같다. */
  answerMax: 4_000,
  scopePromptMax: 120,
  sourceKeysMax: 20,
  proposalsMax: 3,
  wordSurfaceMax: 80,
  wordReadingMax: 120,
  wordMeaningMax: 200,
  studyLogSummaryMax: 120,
} as const

// ── 응답 타입 ─────────────────────────────────────────────────────────────────

export type AskProposalDraft =
  | { kind: 'ADD_WORD'; payload: { surface: string; reading: string; meaning: string } }
  | { kind: 'ADD_STUDY_LOG'; payload: { summaryKo: string } }
  | { kind: 'SET_LEVEL'; payload: { level: JlptLevel } }

/** 모델이 내는 원응답 모양(스키마 통과 뒤). 서버는 이 값을 그대로 저장하지 않고 `parseAskResponse` 를 거친다. */
export interface AskResponse {
  needsScope: { prompt: string } | null
  answerMd: string
  sourceKeys: string[]
  confidence: AskConfidence
  proposals: AskProposalDraft[]
}

// ── 스키마 ────────────────────────────────────────────────────────────────────

const proposalWord = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'payload'],
  properties: {
    kind: { type: 'string', enum: ['ADD_WORD'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['surface', 'reading', 'meaning'],
      properties: {
        surface: { type: 'string', minLength: 1, maxLength: 160 },
        reading: { type: 'string', maxLength: 240 },
        meaning: { type: 'string', minLength: 1, maxLength: 400 },
      },
    },
  },
} as const

const proposalStudyLog = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'payload'],
  properties: {
    kind: { type: 'string', enum: ['ADD_STUDY_LOG'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['summaryKo'],
      properties: { summaryKo: { type: 'string', minLength: 1, maxLength: 400 } },
    },
  },
} as const

const proposalLevel = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'payload'],
  properties: {
    kind: { type: 'string', enum: ['SET_LEVEL'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['level'],
      properties: { level: { type: 'string', enum: [...JLPT_LEVELS] } },
    },
  },
} as const

/**
 * A9 응답 스키마. 선언 순서 = 출력 순서(`withJsonOnly` 가 이 스키마를 프롬프트에 그대로 싣는다 — `description` 도 함께 실린다).
 * `answerMd` 의 `maxLength` 는 contract 상한이다 — 넘으면 자르지 않고 ajv 위반(1회 재시도)이다(잘린 마크다운은 틀린 설명을 보인다).
 * 제안 항목은 종류별 엄격 모양(anyOf)으로 스키마가 곧 계약 설명이 되게 하되, 길이는 DB 칸보다 넉넉히 두고 실제 한도는 `parseAskResponse` 가 항목 단위로 건다.
 */
export const ASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['needsScope', 'answerMd', 'sourceKeys', 'confidence', 'proposals'],
  properties: {
    needsScope: {
      description: '기록 질문인데 기간이 모호할 때만 한국어 되묻기 한 문장. 아니면 null',
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['prompt'],
          properties: { prompt: { type: 'string', minLength: 1, maxLength: ASK_LIMITS.scopePromptMax } },
        },
      ],
    },
    answerMd: {
      type: 'string',
      minLength: 1,
      maxLength: ASK_LIMITS.answerMax,
      description: '한국어 마크다운 답. 문단·굵게·"- " 목록·"> " 예문 블록만. HTML·마크다운 링크/이미지·URL·제목·표·코드 금지',
    },
    sourceKeys: {
      type: 'array',
      maxItems: ASK_LIMITS.sourceKeysMax,
      items: { type: 'string', minLength: 1, maxLength: 12 },
      description: '답에 실제로 쓴 [기록 조회] 항목의 키(S1…)만. 일반 질문·기록 없음이면 []',
    },
    confidence: { type: 'string', enum: [...ASK_CONFIDENCES] },
    proposals: {
      type: 'array',
      maxItems: ASK_LIMITS.proposalsMax,
      items: { anyOf: [proposalWord, proposalStudyLog, proposalLevel] },
    },
  },
} as const

// ── 글자 도구 ─────────────────────────────────────────────────────────────────

const cpLen = (s: string): number => Array.from(s).length
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/
const JA_LETTER = /[぀-ヿ㐀-䶿一-鿿]/
const KANA_READING = /^[぀-ヿー・〜\s]*$/
/** 제어 문자(\n·\t 제외) — 보이지 않는 서식 문자(\p{Cf}: ZWSP·BiDi·BOM·소프트 하이픈…)도 같이 지운다. */
const CONTROL_OR_FORMAT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\p{Cf}/gu

/** 한 줄 글 칸 정리 — 숨은 글자·줄바꿈 제거, 공백 정리. */
function cleanLine(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(CONTROL_OR_FORMAT, '').replace(/\s+/g, ' ').trim()
}

const URL_LIKE = /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.)\S+/i
const SCHEME_LIKE = /\b(?:javascript|data|vbscript|file):/i
/** 제안·되묻기 같은 짧은 칸의 안전 검사 — 꺾쇠·URL·스킴·엔진 이름이 있으면 거부. */
function unsafeShort(t: string): boolean {
  return /[<>]/.test(t) || URL_LIKE.test(t) || SCHEME_LIKE.test(t) || llm.mentionsEngineIdentity(t)
}

// ── answerMd 정리 ─────────────────────────────────────────────────────────────

export interface AskMdFixes {
  controlChars: number
  html: number
  links: number
  images: number
  urls: number
  codeFences: number
  inlineCode: number
  headings: number
  tables: number
  orderedLists: number
  rules: number
}
const emptyFixes = (): AskMdFixes => ({ controlChars: 0, html: 0, links: 0, images: 0, urls: 0, codeFences: 0, inlineCode: 0, headings: 0, tables: 0, orderedLists: 0, rules: 0 })

/**
 * 살균 반복 상한. 한 번 지우면 이웃 조각이 이어 붙어 위험 표지가 다시 생기는 입력(`<<<b>b>script>`·`[[x](javascript:…)](…)`·`java<b>script:`)은 고정점까지 반복해 지운다.
 * 정상 글은 2회(바뀐 한 번 + 안 바뀐 확인 한 번)에 끝난다. 상한까지 안 끝나는 건 일부러 깊이 겹친 입력뿐이라 `hardStrip` 이 남은 표지를 한꺼번에 지운다.
 */
const SANITIZE_MAX_PASSES = 16
/** 한 패스 안에서 겹친 마크다운 링크를 벗기는 횟수 상한(깊이 32 넘는 중첩은 바깥 `)` 가 남을 수 있다 — 위험하진 않다). */
const LINK_INNER_PASSES = 32

const WS = /\s/
/** HTML 태그 시작 문자(`<` 바로 뒤): 영문자 · `/` · `!` · `?`. `< script`·`3 < 5`·`3<5` 처럼 그 밖의 `<` 는 글자다. */
const isTagStartCode = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 47 || c === 33 || c === 63
/** 한 태그를 따라가 볼 최대 길이 — `>` 가 이보다 멀면 태그가 아니라고 본다(태그 시작이 많아도 이차가 되지 않는 상한). */
const TAG_SCAN_MAX = 2_000

/**
 * 태그 끝(`>` 다음 위치) — `from` 은 `<` 다음 글자 위치. 없으면 -1(불완전 태그).
 * 속성 값(`=` 바로 뒤 따옴표) 안의 `>` 는 끝이 아니다(따옴표를 인식하는 쪽을 먼저, 못 찾으면 따옴표를 무시하고 첫 `>`).
 * 태그 안 줄바꿈은 허용하되(`<img src=x⏎onerror=…>`), **빈 줄이나 줄 머리 `> `(공백이 따르는 인용·예문 표지)를 만나면 태그가 아니라고 본다** — 글 한가운데 `a<b` 하나 때문에 뒤의 설명과 예문 블록이 통째로 지워지지 않게.
 */
function tagEnd(s: string, from: number): number {
  const quoted = scanTag(s, from, true)
  return quoted !== -1 ? quoted : scanTag(s, from, false)
}

function scanTag(s: string, from: number, honorQuotes: boolean): number {
  const limit = Math.min(s.length, from + TAG_SCAN_MAX)
  let quote = 0
  let prev = 0
  let lineStart = false
  for (let j = from; j < limit; j++) {
    const c = s.charCodeAt(j)
    if (c === 10) {
      if (lineStart) return -1
      lineStart = true
      continue
    }
    if (lineStart) {
      if (c === 32 || c === 9) continue
      if (c === 62 && (s.charCodeAt(j + 1) === 32 || s.charCodeAt(j + 1) === 9)) return -1
      lineStart = false
    }
    if (quote !== 0) {
      if (c === quote) {
        quote = 0
        prev = c
      }
      continue
    }
    if (honorQuotes && (c === 34 || c === 39) && prev === 61) {
      quote = c
      continue
    }
    if (c === 62) return j + 1
    if (c > 32) prev = c
  }
  return -1
}

/** `<br>`·`<br/>`·`<BR />` (줄바꿈으로 바꾼다) — 태그 구간 [lt, end) 가 정확히 그 모양인가. */
function isBrTag(s: string, lt: number, end: number): boolean {
  if (end - lt < 4 || (s.charCodeAt(lt + 1) | 32) !== 98 || (s.charCodeAt(lt + 2) | 32) !== 114) return false
  let j = lt + 3
  while (j < end - 1 && WS.test(s[j])) j++
  if (j < end - 1 && s.charCodeAt(j) === 47) j++
  return j === end - 1
}

/**
 * HTML 주석·태그 삭제(`<br>` 은 줄바꿈). 태그 = `<` + 영문자·`/`·`!`·`?` 로 시작해 `>` 까지(줄바꿈 포함 — 속성 값 안의 `>` 는 끝이 아님).
 * `>` 가 없거나 너무 멀거나(빈 줄·줄 머리 `>` 를 넘음) 한 불완전 태그는 `<` 연속열만 지운다(글자는 남는다). 선형 — `indexOf` 와 `lastIndexOf('>')` 로 "이 뒤엔 끝이 없다"를 한 번에 알아 같은 곳을 다시 훑지 않는다.
 */
function stripHtml(s: string, f: AskMdFixes): string {
  let lt = s.indexOf('<')
  if (lt === -1) return s
  const lastGt = s.lastIndexOf('>')
  let noCommentEnd = false
  let nextGt = -1
  const out: string[] = []
  let from = 0
  while (lt !== -1) {
    if (!isTagStartCode(s.charCodeAt(lt + 1))) {
      lt = s.indexOf('<', lt + 1)
      continue
    }
    let end = -1
    if (!noCommentEnd && s.startsWith('<!--', lt)) {
      const c = s.indexOf('-->', lt + 4)
      if (c === -1) noCommentEnd = true
      else end = c + 3
    }
    if (end === -1 && lt < lastGt) {
      if (nextGt <= lt) nextGt = s.indexOf('>', lt + 1)
      if (nextGt - lt <= TAG_SCAN_MAX) end = tagEnd(s, lt + 1)
    }
    f.html++
    if (end === -1) {
      let run = lt
      while (run > from && s.charCodeAt(run - 1) === 60) run--
      out.push(s.slice(from, run))
      from = lt + 1
    } else {
      out.push(s.slice(from, lt), isBrTag(s, lt, end) ? '\n' : '')
      from = end
    }
    lt = s.indexOf('<', from)
  }
  out.push(s.slice(from))
  return out.join('')
}

/** `(?:[^()\n]|\([^()\n]*\))*\)` — 링크 주소부(한 단계 중첩 괄호까지, 줄바꿈 없음). `(` 다음(i)에서 시작해 닫는 `)` 다음 위치, 없으면 -1. 선형. */
function urlTailEnd(s: string, i: number): number {
  for (let j = i; j < s.length; j++) {
    const c = s.charCodeAt(j)
    if (c === 41) return j + 1
    if (c === 10) return -1
    if (c === 40) {
      let k = j + 1
      while (k < s.length) {
        const d = s.charCodeAt(k)
        if (d === 41) break
        if (d === 40 || d === 10) return -1
        k++
      }
      if (k >= s.length) return -1
      j = k
    }
  }
  return -1
}

/**
 * 마크다운 이미지 `![레이블](주소)`(통째로 삭제)와 링크 `[레이블](주소)`(레이블만 남김). `](` 를 기준으로 거꾸로 `[` 를 찾는다(`]`·줄바꿈을 만나면 레이블이 아님) —
 * `[` 가 많은 입력에서 정규식이 매번 끝까지 훑는 이차 폭주를 피한다. 겹친 링크는 바깥쪽이 다음 패스에서 지워진다.
 */
function stripMdLinks(s: string, f: AskMdFixes): string {
  if (!s.includes('](')) return s
  const out: string[] = []
  let from = 0
  let search = 0
  for (;;) {
    const p = s.indexOf('](', search)
    if (p === -1) break
    let b = p - 1
    while (b >= from) {
      const c = s.charCodeAt(b)
      if (c === 91 || c === 93 || c === 10) break
      b--
    }
    const tail = b >= from && s.charCodeAt(b) === 91 ? urlTailEnd(s, p + 2) : -1
    if (tail === -1) {
      search = p + 1
      continue
    }
    if (b - 1 >= from && s.charCodeAt(b - 1) === 33) {
      out.push(s.slice(from, b - 1))
      f.images++
    } else {
      out.push(s.slice(from, b), s.slice(b + 1, p))
      f.links++
    }
    from = tail
    search = tail
  }
  out.push(s.slice(from))
  return out.join('')
}

const SCHEME_RE = /\b(?:javascript|data|vbscript|file):[^\s)」』]*/gi
const WWW_RE = /\bwww\.[^\s)」』]+/gi
const isSchemeChar = (c: number): boolean => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 43 || c === 45 || c === 46
const isAlphaCode = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)
/** URL 꼬리의 끝(공백·`)`·`」`·`』`). */
function isUrlStop(c: number): boolean {
  if (c === 41 || c === 0x300d || c === 0x300f) return true
  if (c <= 32) return c === 32 || (c >= 9 && c <= 13)
  return c >= 128 && WS.test(String.fromCharCode(c))
}

/** `scheme://꼬리` 삭제 — `://` 를 기준으로 거꾸로 스킴(영문자로 시작하는 `[a-z0-9+.-]` 열)을 찾는다(정규식은 긴 영문 열에서 이차). */
function stripAuthorityUrls(s: string, f: AskMdFixes): string {
  if (!s.includes('://')) return s
  const out: string[] = []
  let from = 0
  let search = 0
  for (;;) {
    const q = s.indexOf('://', search)
    if (q === -1) break
    let b = q
    while (b > from && isSchemeChar(s.charCodeAt(b - 1))) b--
    while (b < q && !isAlphaCode(s.charCodeAt(b))) b++
    let te = q + 3
    while (te < s.length && !isUrlStop(s.charCodeAt(te))) te++
    if (b === q || te === q + 3) {
      search = q + 1
      continue
    }
    out.push(s.slice(from, b))
    f.urls++
    from = te
    search = te
  }
  out.push(s.slice(from))
  return out.join('')
}

/** `javascript:`·`data:`·`vbscript:`·`file:` 스킴, `://` 주소, `www.` 를 꼬리까지 삭제. */
function stripUrls(s: string, f: AskMdFixes): string {
  const t = stripAuthorityUrls(s.replace(SCHEME_RE, () => (f.urls++, '')), f)
  return t.replace(WWW_RE, () => (f.urls++, ''))
}

const HEADING_PREFIX = /^\s{0,3}#{1,6}\s+/
/** `## 제목 ##` 의 제목 부분(없으면 null). 뒤쪽 공백·`#` 열을 손으로 떼어 정규식의 `.+?\s*#*\s*$` 이차 역추적을 피한다. */
function headingInner(line: string): string | null {
  const m = HEADING_PREFIX.exec(line)
  if (!m) return null
  const rest = line.slice(m[0].length)
  if (rest === '') return null
  let e = rest.length
  while (e > 0 && WS.test(rest[e - 1])) e--
  while (e > 0 && rest.charCodeAt(e - 1) === 35) e--
  while (e > 0 && WS.test(rest[e - 1])) e--
  return e === 0 ? rest.slice(0, 1) : rest.slice(0, e)
}

/** 뒤쪽 공백·탭 제거(`/[ \t]+$/` 는 긴 공백 열에서 이차). */
function trimEndBlank(s: string): string {
  let e = s.length
  while (e > 0) {
    const c = s.charCodeAt(e - 1)
    if (c !== 32 && c !== 9) break
    e--
  }
  return e === s.length ? s : s.slice(0, e)
}

/** 살균 한 번 — 위험 표지를 지우고 서식을 허용 서식으로 바꾼다. 지운 조각이 이웃과 이어 붙어 새 표지를 만들 수 있어 호출하는 쪽이 고정점까지 되풀이한다. */
function sanitizePass(input: string, f: AskMdFixes): string {
  let t = input.replace(CONTROL_OR_FORMAT, () => (f.controlChars++, ''))
  t = t.replace(/�/g, () => (f.controlChars++, ''))
  t = stripHtml(t, f)
  // 겹친 링크는 안쪽부터 한 겹씩 벗겨진다 — 스킴 삭제가 바깥 링크의 주소부를 먼저 갉아먹어 `)` 가 남지 않게 여기서 끝까지(상한 안에서) 벗긴다.
  for (let i = 0; i < LINK_INNER_PASSES; i++) {
    const next = stripMdLinks(t, f)
    if (next === t) break
    t = next
  }
  t = stripUrls(t, f)
  const out: string[] = []
  for (const raw of t.split('\n')) {
    let line = trimEndBlank(raw)
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      f.codeFences++
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      f.rules++
      continue
    }
    const heading = headingInner(line)
    if (heading !== null) {
      f.headings++
      const inner = heading.replace(/\*\*/g, '').trim()
      line = inner ? `**${inner}**` : ''
    } else if (/^\s*\|/.test(line) && /\|\s*$/.test(line)) {
      f.tables++
      if (/^[\s|:-]+$/.test(line) && /-/.test(line)) continue
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      line = cells.length ? `- ${cells.join(' · ')}` : ''
    } else if (/^\s*\d{1,2}[.)]\s+\S/.test(line)) {
      f.orderedLists++
      line = line.replace(/^\s*\d{1,2}[.)]\s+/, '- ')
    } else if (/^\s*[*+]\s+\S/.test(line)) {
      line = line.replace(/^\s*[*+]\s+/, '- ')
    } else if (/^\s+-\s+\S/.test(line)) {
      line = line.replace(/^\s+-\s+/, '- ')
    }
    if (/^\s*>/.test(line)) line = line.replace(/^\s*(?:>\s*)+/, '> ')
    out.push(line)
  }
  t = out.join('\n')
  t = t.replace(/`([^`\n]+)`/g, (_m, inner: string) => (f.inlineCode++, JA_LETTER.test(inner) ? `「${inner}」` : inner))
  t = t.replace(/`+/g, '')
  t = t.replace(/__([^_\n]+)__/g, '**$1**')
  return t.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 상한까지 수렴하지 않은 입력(일부러 깊이 겹친 것)에서 남은 위험 표지를 한꺼번에 지운다:
 * ① 태그 시작 문자 바로 앞의 `<` 연속열 전체 ② `]` 바로 뒤의 `(` 연속열(링크 문법을 끊음). 열 단위로 지워 지운 뒤 이웃과 다시 붙지 않는다. 선형.
 */
function hardStrip(s: string, f: AskMdFixes): string {
  let t = s
  let lt = t.indexOf('<')
  if (lt !== -1) {
    const out: string[] = []
    let from = 0
    while (lt !== -1) {
      let e = lt
      while (e < t.length && t.charCodeAt(e) === 60) e++
      if (isTagStartCode(t.charCodeAt(e))) {
        out.push(t.slice(from, lt))
        f.html++
        from = e
      }
      lt = t.indexOf('<', e)
    }
    out.push(t.slice(from))
    t = out.join('')
  }
  let p = t.indexOf('](')
  if (p !== -1) {
    const out: string[] = []
    let from = 0
    while (p !== -1) {
      let e = p + 1
      while (e < t.length && t.charCodeAt(e) === 40) e++
      out.push(t.slice(from, p + 1))
      f.links++
      from = e
      p = t.indexOf('](', e)
    }
    out.push(t.slice(from))
    t = out.join('')
  }
  return t
}

/**
 * `answerMd` 정리(순수) — 허용 서식(문단·굵게·"- " 목록·"> " 예문 블록)만 남긴다. 던지지 않는다. 지운 것은 **개수만** 센다(값은 로그에 남기지 않는다).
 *  · 제어/서식 문자 삭제 · HTML 주석·태그 삭제(`<br>` 은 줄바꿈 · 태그 안 줄바꿈(빈 줄·줄 머리 `>` 전까지)·속성 값 안 `>` 포함 · 끝이 없는 불완전 태그는 `<` 만) · 마크다운 이미지 삭제 · 마크다운 링크는 글자만
 *  · `://` URL·`www.`·`javascript:`/`data:`/`vbscript:`/`file:` 스킴 삭제
 *  · 코드 펜스 줄 삭제(안의 글은 남김) · 인라인 코드는 일본어면 「」, 아니면 글자만 · `#` 제목은 굵게 한 줄 · 표는 "- 칸 · 칸" 목록 · 번호 목록·`*`/`+` 목록은 "- " · 구분선 삭제
 *  · 목록 들여쓰기 삭제 · `__굵게__` → `**굵게**` · 3줄 이상 빈 줄은 2줄로.
 * **고정점까지 되풀이한다**(REV-064-S1): 한 번 지운 자리에서 이웃 조각이 이어 붙어 `<script>`·`javascript:`·`[x](…)` 가 다시 생기므로(중첩 `<<<b>b>script>`, 쪼갠 `java<b>script:`, 백틱을 끼운 ``java`script:``)
 * 한 번 더 돌려도 안 바뀔 때까지 돈다. 상한(`SANITIZE_MAX_PASSES`)까지 수렴하지 않으면 `hardStrip` 으로 남은 표지를 지우고 한 번 더 돈다 — 그래도 안 끝나면(도달 불가에 가깝다) 위험 문자를 통째로 버린다.
 * 정상 글은 훼손하지 않는다: 줄 머리 `>`(인용·예문), `3 < 5`·`a>b`(`<` 뒤가 글자가 아님)는 그대로.
 * `opts.maxPasses` 는 상한 경로를 시험하려는 이음매다(호출처는 쓰지 않는다).
 */
export function sanitizeAskAnswerMd(md: string, opts: { maxPasses?: number } = {}): { text: string; fixes: AskMdFixes } {
  const f = emptyFixes()
  const maxPasses = Math.max(1, opts.maxPasses ?? SANITIZE_MAX_PASSES)
  let t = md.replace(/\r\n?/g, '\n')
  for (let round = 0; round < 2; round++) {
    for (let pass = 0; pass < maxPasses; pass++) {
      const next = sanitizePass(t, f)
      if (next === t) return { text: t, fixes: f }
      t = next
    }
    t = hardStrip(t, f)
  }
  // 도달 불가에 가까운 방어 — 위험 표지가 만들어질 수 있는 문자를 통째로 버리고 스킴을 마지막으로 지운다.
  t = stripUrls(sanitizePass(t, f).replace(/[<\[\]`]/g, ''), f)
  return { text: t, fixes: f }
}

/**
 * 예문 블록 읽기(참조 문법 — 시험·실측용). 규칙: 빈 줄로 구분된 덩어리의 **첫 줄이 "> " 로 시작**하면 예문 블록이고, 그 줄의 나머지가 일본어 한 문장, **바로 다음 줄**(있으면)이 한국어 뜻이다.
 * 화면의 `AnswerMarkdown`(designer `docs/screens.md` §25)이 정한 문법과 다르면 이 함수와 `ask.ts` 의 지시문(`ASK_EXAMPLE_SYNTAX_LINES`)을 같이 고친다.
 */
export function askExampleBlocks(answerMd: string): { ja: string; ko: string | null }[] {
  const blocks: { ja: string; ko: string | null }[] = []
  for (const chunk of answerMd.split(/\n{2,}/)) {
    const lines = chunk.split('\n')
    if (!/^>\s?\S/.test(lines[0] ?? '')) continue
    const ja = lines[0].replace(/^>\s*/, '').trim()
    const ko = lines[1] !== undefined && !/^>/.test(lines[1]) ? lines[1].trim() : null
    blocks.push({ ja, ko })
  }
  return blocks
}

// ── 후검증(extraCheck) ────────────────────────────────────────────────────────

export interface AskParseContext {
  /** 이번 턴에 프롬프트에 **실제로 실린** 기록 키(`fitAskRecords().shownKeys`). 일반 질문이면 []. */
  shownKeys: readonly string[]
  /** 학습자 질문 원문 — 엔진 이름 검사의 예외 판정용(질문에 이미 나온 이름이면 답에 나와도 노출이 아니다, 예: 시(俳句)의 로마자 표기를 묻는 질문). */
  userText?: string
}

/** 프롬프트 구조·내부 필드 이름이 답 본문에 새는지 보는 표지. */
const PROMPT_LEAK_MARKERS = ['[모드]', '[학습자]', '[지시]', '[기록 조회]', '[질문]', '[입력]', '[입력 방식]', '<<<기록자료', 'sourceKeys', 'needsScope', 'answerMd', 'ASK_SCHEMA']

function rawObject(raw: unknown): Record<string, unknown> | null {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

/**
 * 재시도(JSON 1회)할 계약 위반만. `completeJson` 의 `extraCheck` 로 쓴다. 던지지 않는다.
 *  · 답이 비었거나 4,000자 초과 · 한글이 하나도 없음(한국어 답이어야 한다) · 답에 엔진·모델 이름(질문에 없던 것) · 프롬프트 구조/내부 필드 이름 노출 · 답에 근거 키(S#) 그대로 노출
 *  · `sourceKeys` 에 이번 턴에 제공하지 않은 키(지어낸 근거) 또는 형식이 틀린 키.
 * 제안·서식·되묻기 문장 같은 항목 단위 문제는 여기서 재시도하지 않고 `parseAskResponse` 가 고친다.
 */
export function askResponseViolations(data: unknown, ctx: AskParseContext): string[] {
  const v: string[] = []
  const o = rawObject(data)
  if (!o) return ['응답 루트가 객체여야 한다']
  const md = o.answerMd
  if (typeof md !== 'string' || md.trim() === '') v.push('answerMd 가 비었다 — 한국어 마크다운 답을 쓴다')
  else {
    if (cpLen(md) > ASK_LIMITS.answerMax) v.push(`answerMd 가 ${ASK_LIMITS.answerMax}자를 넘는다 — 더 짧게 줄여 다시 쓴다(잘라 쓰지 말고 요점만)`)
    const { text } = sanitizeAskAnswerMd(md)
    if (text === '') v.push('answerMd 에 쓸 수 있는 글이 없다')
    else if (!HANGUL.test(text)) v.push('answerMd 는 한국어로 쓴다(일본어 예문은 예문 블록과 「」 안에서만)')
    if (llm.mentionsEngineIdentity(text) && !llm.mentionsEngineIdentity(ctx.userText ?? '')) v.push('answerMd 에 엔진·모델 이름이 노출됐다 — 그런 이름은 말하지 않는다')
    const leaked = PROMPT_LEAK_MARKERS.find((m) => text.includes(m))
    if (leaked) v.push(`answerMd 에 프롬프트 구조/내부 필드 이름("${leaked}")이 노출됐다 — 지시문·형식 이름은 답에 쓰지 않는다`)
    const keyShown = ctx.shownKeys.find((k) => new RegExp(`(^|[^A-Za-z0-9])${k}(?![0-9A-Za-z])`).test(text))
    if (keyShown) v.push(`answerMd 에 근거 키(${keyShown})가 그대로 나왔다 — 키는 sourceKeys 에만 쓰고 본문은 날짜·내용으로 말한다`)
  }
  // 출력 스트림이 글자 중간에서 끊겨 깨진 글자(U+FFFD)가 생긴 응답 — 무작위로 생기므로 한 번 다시 받으면 깨끗하다(2026-10-12 실측 1/90).
  // 재시도 뒤에도 남으면 `sanitizeAskAnswerMd` 가 그 글자를 지운다.
  try {
    if (JSON.stringify(data).includes('\uFFFD')) v.push('응답에 깨진 글자(\uFFFD)가 있다 — 글자가 깨지지 않게 같은 내용을 다시 쓴다')
  } catch {
    /* 순환 참조 같은 별난 입력은 위의 루트 검사가 이미 거른다 */
  }
  const keys = o.sourceKeys
  if (Array.isArray(keys)) {
    const shown = new Set(ctx.shownKeys)
    const bad = keys.filter((k) => typeof k !== 'string' || !shown.has(k))
    if (bad.length > 0) {
      v.push(
        shown.size === 0
          ? 'sourceKeys 는 [] 여야 한다 — 이번 질문에는 제공된 기록 항목이 없다(키를 지어내지 않는다)'
          : `sourceKeys 에 제공되지 않은 키가 있다(${bad.slice(0, 3).map((k) => JSON.stringify(k)).join(', ')}) — [기록 조회]에 나온 키(${[...shown].slice(0, 6).join('·')}…)만 쓴다`,
      )
    }
  }
  return v
}

// ── 정리(parseAskResponse) ────────────────────────────────────────────────────

export interface AskParseNotes {
  /** `sourceKeys` 에서 버린 키 수(제공하지 않은 키·형식 오류·중복). */
  keysDropped: number
  proposalsDropped: number
  /** 되묻기 문장이 못 쓸 값이라 null 로 바꿨는가. */
  needsScopeDropped: boolean
  /** 되묻기가 있어 근거 키·제안을 비웠는가. */
  clearedByNeedsScope: boolean
  /** 확신도가 없거나 틀려 LOW 로 둔 경우. */
  confidenceDefaulted: boolean
  mdFixes: AskMdFixes
}

export interface AskParsed {
  /** 정리된 한국어 마크다운(≤4,000자). */
  answerMd: string
  confidence: AskConfidence
  /** ⊆ ctx.shownKeys, 중복 제거, 모델이 쓴 순서 그대로. 서버가 이 키를 실제 조회 행으로 풀어 `sources[]` 를 만든다. */
  sourceKeys: string[]
  needsScope: { prompt: string } | null
  proposals: AskProposalDraft[]
  notes: AskParseNotes
}

export type AskParseResult = { ok: true; value: AskParsed } | { ok: false; reasons: string[] }

function normalizeProposal(raw: unknown): AskProposalDraft | null {
  const o = rawObject(raw)
  const p = o ? rawObject(o.payload) : null
  if (!o || !p) return null
  switch (o.kind) {
    case 'ADD_WORD': {
      const surface = cleanLine(p.surface)
      const meaning = cleanLine(p.meaning)
      let reading = cleanLine(p.reading)
      if (!surface || cpLen(surface) > ASK_LIMITS.wordSurfaceMax || !JA_LETTER.test(surface) || HANGUL.test(surface) || unsafeShort(surface)) return null
      if (!meaning || cpLen(meaning) > ASK_LIMITS.wordMeaningMax || !HANGUL.test(meaning) || unsafeShort(meaning)) return null
      if (reading && (cpLen(reading) > ASK_LIMITS.wordReadingMax || !KANA_READING.test(reading))) reading = ''
      return { kind: 'ADD_WORD', payload: { surface, reading, meaning } }
    }
    case 'ADD_STUDY_LOG': {
      const summaryKo = cleanLine(p.summaryKo)
      if (!summaryKo || cpLen(summaryKo) > ASK_LIMITS.studyLogSummaryMax || !HANGUL.test(summaryKo) || unsafeShort(summaryKo)) return null
      return { kind: 'ADD_STUDY_LOG', payload: { summaryKo } }
    }
    case 'SET_LEVEL': {
      const level = p.level
      return typeof level === 'string' && (JLPT_LEVELS as readonly string[]).includes(level) ? { kind: 'SET_LEVEL', payload: { level: level as JlptLevel } } : null
    }
    default:
      return null // SCHEDULE_REVIEW 를 포함한 그 밖의 종류
  }
}

/**
 * 모델 응답 → 저장·전달 재료. **던지지 않는다.** 고칠 수 없는 것(루트가 객체 아님·답이 비었음·답이 4,000자 초과 — 자르지 않는다)만 `ok:false`(reasons 는 고정 문구, 값 없음)이고,
 * 나머지는 항목 단위로 정리한다: 키는 `ctx.shownKeys` 안의 것만 중복 없이, 확신도는 틀리면 LOW, 되묻기 문장은 못 쓰면 null(되묻기를 낼 수 없는 값이면 일반 답으로 취급),
 * 제안은 종류별 모양을 만족하는 항목만(종류당 상한: ADD_WORD 3·나머지 1, 전체 3).
 * 되묻기(`needsScope`)가 있으면 근거 키와 제안은 비운다 — 아직 답하지 않은 턴에 카드를 붙이지 않는다.
 */
export function parseAskResponse(raw: unknown, ctx: AskParseContext): AskParseResult {
  const o = rawObject(raw)
  if (!o) return { ok: false, reasons: ['응답 루트가 객체가 아님'] }
  if (typeof o.answerMd !== 'string' || o.answerMd.trim() === '') return { ok: false, reasons: ['answerMd 없음'] }
  if (cpLen(o.answerMd) > ASK_LIMITS.answerMax) return { ok: false, reasons: ['answerMd 가 상한을 넘음(자르지 않음)'] }
  const { text: answerMd, fixes } = sanitizeAskAnswerMd(o.answerMd)
  if (answerMd === '') return { ok: false, reasons: ['answerMd 에 남는 글이 없음'] }

  const confidenceDefaulted = !(typeof o.confidence === 'string' && (ASK_CONFIDENCES as readonly string[]).includes(o.confidence))
  const confidence: AskConfidence = confidenceDefaulted ? 'LOW' : (o.confidence as AskConfidence)

  const shown = new Set(ctx.shownKeys)
  const seen = new Set<string>()
  const sourceKeys: string[] = []
  let keysDropped = 0
  const rawKeys = Array.isArray(o.sourceKeys) ? o.sourceKeys : []
  if (o.sourceKeys !== undefined && !Array.isArray(o.sourceKeys)) keysDropped++
  for (const k of rawKeys) {
    if (typeof k === 'string' && isAskKey(k) && shown.has(k) && !seen.has(k)) {
      seen.add(k)
      sourceKeys.push(k)
    } else keysDropped++
  }

  let needsScope: { prompt: string } | null = null
  let needsScopeDropped = false
  const ns = rawObject(o.needsScope)
  if (o.needsScope !== null && o.needsScope !== undefined) {
    const prompt = ns ? cleanLine(ns.prompt) : ''
    if (prompt && cpLen(prompt) <= ASK_LIMITS.scopePromptMax && HANGUL.test(prompt) && !unsafeShort(prompt) && !/[*#>`\[\]]/.test(prompt)) needsScope = { prompt }
    else needsScopeDropped = true
  }

  const proposals: AskProposalDraft[] = []
  let proposalsDropped = 0
  const perKind: Partial<Record<AskProposalKind, number>> = {}
  const seenWord = new Set<string>()
  const rawProposals = Array.isArray(o.proposals) ? o.proposals : []
  if (o.proposals !== undefined && !Array.isArray(o.proposals)) proposalsDropped++
  for (const item of rawProposals) {
    const p = normalizeProposal(item)
    if (!p) {
      proposalsDropped++
      continue
    }
    const used = perKind[p.kind] ?? 0
    const cap = p.kind === 'ADD_WORD' ? 3 : 1
    if (used >= cap || proposals.length >= ASK_LIMITS.proposalsMax || (p.kind === 'ADD_WORD' && seenWord.has(p.payload.surface))) {
      proposalsDropped++
      continue
    }
    perKind[p.kind] = used + 1
    if (p.kind === 'ADD_WORD') seenWord.add(p.payload.surface)
    proposals.push(p)
  }

  const cleared = needsScope !== null && (sourceKeys.length > 0 || proposals.length > 0)
  return {
    ok: true,
    value: {
      answerMd,
      confidence,
      sourceKeys: needsScope ? [] : sourceKeys,
      needsScope,
      proposals: needsScope ? [] : proposals,
      notes: { keysDropped, proposalsDropped, needsScopeDropped, clearedByNeedsScope: cleared, confidenceDefaulted, mdFixes: fixes },
    },
  }
}

/** 추적용 요약 — 숫자만(질문·기록·답 본문 없음, api-contract §2-18-A 7). */
export function askParseTrace(r: AskParsed): Record<string, number | boolean> {
  return {
    answerChars: cpLen(r.answerMd),
    exampleBlocks: askExampleBlocks(r.answerMd).length,
    sourceKeys: r.sourceKeys.length,
    keysDropped: r.notes.keysDropped,
    proposals: r.proposals.length,
    proposalsDropped: r.notes.proposalsDropped,
    needsScope: r.needsScope !== null,
    needsScopeDropped: r.notes.needsScopeDropped,
    confidenceDefaulted: r.notes.confidenceDefaulted,
    mdFixes: Object.values(r.notes.mdFixes).reduce((a, b) => a + b, 0),
  }
}
