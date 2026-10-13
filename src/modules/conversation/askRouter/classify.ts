/**
 * ASK 의도 분류 — **규칙만**(LLM 호출 없음, 사용자 결정 2026-10-12 — api-contract §2-18-A 6항). 대표 질문 기대값은 `__tests__/askIntentCases.ts`.
 *
 * 판단 순서:
 *  1) 정규화: NFKC(전각 → 반각·반각 가나 → 전각) + 소문자 + 공백 접기, 앞 1,000자만. 따옴표 안 글(「…」·‘…’ 등)은 물어보는 대상이라 신호에서 뺀다.
 *     한국어 낱말은 띄어쓰기 차이를 없애려고 공백을 지운 글에서 찾는다.
 *  2) 기록 신호 R = 학습 활동어(교정·틀린·배운…/진도·복습·남은·점수…) 또는 (1인칭·지난번·「뭐였지」·기간어 + 표현·단어·문장·조사·문법).
 *     1인칭·기간어 혼자는 기록 신호가 아니다(「내가 일본에 가면 뭐라고 해?」).
 *  3) 일반 신호 G = 질문 표지(차이·뜻·어떻게 말해·일본어로·설명해…·意味·違い…). 일본어 글자만 있으면 약한 신호(기록 신호가 있으면 무시).
 *  4) R+G → MIXED, R → 활동어 점수로 EXPRESSION/PROGRESS(같으면 MIXED), G(약한 것 포함) → GENERAL, 둘 다 없음 → MIXED(애매).
 *  3-b) (task-066) **일본어 글자만 있고 한글이 없는 입력**(마이크·글자 모두 — 「大丈夫」「お疲れ様でした」「先週の復習」)은 그 일본어의 뜻을 묻는 질문이라 무조건 GENERAL(기록 조회 0).
 *     기록 신호·기간 키워드가 전부 한국어라 이미 그렇게 분류되지만, 키워드 목록에 일본어 낱말이 더해져도 이 경로가 열리지 않도록 규칙으로 고정한다.
 *  5) 기간어(한국어·일본어 — 「전체 문장」처럼 말감이 붙은 「전체」는 제외) → 범위(여럿이면 가장 넓은 것). 기록 의도 + 기간 없음 + 범위에 민감(집계어, 또는 교정·배운·진도 목록류)이면 needsScope.
 *     지금 상태(복습 남은 것·연속·레벨·약점)와 특정 기억 찾기(뭐였지·쓰던·저번에)는 묻지 않는다. MIXED 인데 본인 활동 단서가 없으면(평가·점수 같은 명사만) 묻지 않는다.
 * 되묻기 칩 답(`ctx.scopeKey`)은 **직전 질문(`ctx.prevUserText`)의 의도**에 칩 범위를 붙인다 — 칩 글자로 분류하지 않는다.
 * 직전 질문을 이어받았으면 `basedOnPrev:true` — 호출자는 `classifiedQuestion(c, text, prevUserText)` 글로 검색어를 뽑는다(계약 3항 「직전 USER 질문의 의도에 결합」).
 */
import { isAskScopeKey, normalizeRecordSearchTerms, type AskIntent, type AskScope, type AskScopeKey } from '@/modules/learning'

export interface AskClassification {
  intent: AskIntent
  needsScope: boolean
  scope: AskScope | null
  /** 직전 질문(`prevUserText`)의 의도를 이어받았으면 true(칩 답·기간만 쓴 짧은 답) — 이때 검색어도 직전 질문에서 뽑아야 한다(`classifiedQuestion`). */
  basedOnPrev: boolean
}

export interface ClassifyContext {
  /** 직전 USER 질문 — 직전 ASSISTANT 답이 needsScope 였을 때만 넘긴다. */
  prevUserText?: string
  /** 되묻기 칩 답(#32 `scope.key`). 계약 밖 값은 무시한다. */
  scopeKey?: string
}

const TEXT_MAX = 1000

const PERIODS: [AskScopeKey, string[]][] = [
  ['ALL', ['지금까지', '여태', '그동안', '처음부터', '통틀어', '모든기간', '전기간', '全期間', 'これまで']],
  ['LAST_30D', ['30일', '삼십일', '한달', '이번달', '지난달', '저번달', '지난주', '저번주', '어제', '그제', '그저께', '엊그제', '요즘', '요새', '최근', '며칠전', '일주일', '最近', '先週', '先月', '今月', '昨日']],
  ['THIS_WEEK', ['이번주', '금주', '요번주', '오늘', '今週', '今日']],
]
/** 「전체」는 기간(전체 기간·전체로 봐 줘)이기도 하고 「전체 문장을 번역」의 수식어이기도 하다 — 뒤에 말감이 바로 붙으면 기간이 아니다. */
const ALL_BARE = /전체(?!문장|단어|표현|조사|문법|어휘|적|의)/

const LEARN_PROGRESS = ['진도', '복습', '남은', '남았', '얼마나했', '얼마나공부', '공부얼마나', '몇번했', '몇번이나', '레슨몇', '공부한', '공부했', '공부량', '학습량', '출석', '연속', '스트릭', '점수', '성적', '평가', '레벨', '약점', '통계', '할거', '해야할', '해야하', '늘었', '실력']
const LEARN_EXPRESSION = ['교정', '고쳐', '고친', '틀린', '틀렸', '틀리', '틀려', '실수', '배운', '배웠', '외운', '외웠', '단어장', '저장한', '저장했', '쓰던', '썼던', '말했던', '연습한', '연습했', '레슨에서', '수업에서', '역할극', '상황연습']
const RECALL = ['뭐였', '뭐더라', '있었지', '있었더라', '기억이안', '기억안', '생각이안', '생각안', '까먹', '잊어버']
const PAST_REF = ['저번에', '지난번', '아까', '그때']
const DOMAIN_NOUNS = ['표현', '단어', '문장', '조사', '문법', '어휘']
const GENERAL_KO = [
  '차이', '다른점', '뭐가달라', '어떻게달라', '어떻게다르', '구분', '뜻', '의미', '무슨말', '어떻게말', '뭐라고', '일본어로', '한국어로', '번역', '해석',
  '용법', '쓰임', '쓰는법', '사용법', '예문', '읽는법', '발음', '존댓말', '경어', '반말', '자연스럽', '어색', '설명해', '설명좀', '맞는지', '맞나', '말하는법', '어떻게써', '어떻게해',
]
const GENERAL_JA = ['意味', '違い', 'どう言', '何と言', '使い方', '文法', 'どういう']
const AGGREGATE = ['자주', '많이', '몇', '얼마나', '목록', '전부', '모두', '다보여', '정리', '요약', '통계', '가장', '제일', '어땠', '어때', '늘었']
const CURRENT = ['복습', '남은', '남았', '할거', '해야', '연속', '출석', '스트릭', '레벨', '약점', '실력']
const LIST_TOPIC = ['교정', '고쳐', '고친', '틀린', '틀렸', '틀리', '배운', '배웠', '공부한', '공부했', '진도', '점수', '성적', '평가', '기록', '연습한', '연습했', '외운']

const FIRST_PERSON = /(?:^|[\s,.!?~])(?:내가|내|나의|나는|나한테|제가|제|저의|저한테|우리)(?=[\s,.!?~]|$)/
const JA_CHAR = /[぀-ヿ㐀-䶿一-鿿々〆〜]/
const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/
const QUOTED = /「[^」]*」|『[^』]*』|‘[^’]*’|“[^”]*”|'[^']*'|"[^"]*"/g

const RANK: Record<AskScopeKey, number> = { THIS_WEEK: 1, LAST_30D: 2, ALL: 3 }

function normalize(text: string): string {
  return Array.from(text.slice(0, TEXT_MAX * 2).normalize('NFKC')).slice(0, TEXT_MAX).join('').toLowerCase().replace(/\s+/g, ' ').trim()
}

const hits = (hay: string, words: readonly string[]) => words.filter((w) => hay.includes(w)).length
const any = (hay: string, words: readonly string[]) => words.some((w) => hay.includes(w))

interface Signals {
  empty: boolean
  record: boolean
  generalStrong: boolean
  generalWeak: boolean
  /** 일본어 글자가 있고 한글이 하나도 없다 — 「이 일본어가 무슨 뜻이야」 입력(task-066). 기록 의도가 될 수 없다. */
  japaneseOnly: boolean
  exprScore: number
  progScore: number
  period: AskScopeKey | null
  recallOrPast: boolean
  /** 본인의 지난 활동을 가리키는 단서(1인칭·지난번·「뭐였지」·교정/틀린/배운 같은 활동어). 진도·점수 같은 명사만으로는 아니다. */
  personal: boolean
  current: boolean
  aggregate: boolean
  listTopic: boolean
}

function signals(raw: string): Signals {
  const n = normalize(raw)
  const outside = n.replace(QUOTED, ' ').replace(/\s+/g, ' ').trim()
  const c = outside.replace(/\s/g, '')
  let period: AskScopeKey | null = null
  for (const [key, words] of PERIODS) {
    const hit = any(c, words) || (key === 'ALL' && ALL_BARE.test(c))
    if (hit && (!period || RANK[key] > RANK[period])) period = key
  }
  const recall = any(c, RECALL)
  const past = any(c, PAST_REF)
  const domainCombo = (FIRST_PERSON.test(outside) || past || recall || period !== null) && any(c, DOMAIN_NOUNS)
  const learnProg = hits(c, LEARN_PROGRESS)
  const learnExpr = hits(c, LEARN_EXPRESSION)
  return {
    empty: n.length === 0,
    record: learnProg > 0 || learnExpr > 0 || domainCombo,
    generalStrong: any(c, GENERAL_KO) || any(outside, GENERAL_JA),
    generalWeak: JA_CHAR.test(n),
    japaneseOnly: JA_CHAR.test(n) && !HANGUL.test(n),
    exprScore: learnExpr + (recall || past ? 1 : 0) + (domainCombo ? 1 : 0),
    progScore: learnProg,
    period,
    recallOrPast: recall || past,
    personal: FIRST_PERSON.test(outside) || recall || past || learnExpr > 0,
    current: any(c, CURRENT),
    aggregate: any(c, AGGREGATE),
    listTopic: any(c, LIST_TOPIC),
  }
}

function fromSignals(s: Signals): AskClassification {
  if (s.empty || s.japaneseOnly) return { intent: 'GENERAL', needsScope: false, scope: null, basedOnPrev: false }
  let intent: AskIntent
  if (s.record && s.generalStrong) intent = 'MIXED'
  else if (s.record) intent = s.exprScore > s.progScore ? 'EXPRESSION' : s.progScore > s.exprScore ? 'PROGRESS' : 'MIXED'
  else if (s.generalStrong || s.generalWeak) intent = 'GENERAL'
  else intent = 'MIXED'
  if (intent === 'GENERAL') return { intent, needsScope: false, scope: null, basedOnPrev: false }
  if (s.period) return { intent, needsScope: false, scope: { key: s.period }, basedOnPrev: false }
  // 일반 질문 표지가 같이 있는데 본인 활동 단서가 없으면(「평가를 일본어로 뭐라고 해?」) 되묻지 않는다 — 기록은 기본 범위로 곁들이기만.
  return { intent, needsScope: s.record && rangeSensitive(s) && (s.personal || !s.generalStrong), scope: null, basedOnPrev: false }
}

function rangeSensitive(s: Signals): boolean {
  if (s.recallOrPast) return false
  if (s.current) return false
  if (s.aggregate) return true
  return s.listTopic
}

/** 기간만 쓴 짧은 글(「지난주」·「전체로 봐 줘」) — 되묻기에 글로 답한 경우. */
function isPeriodOnlyReply(text: string, s: Signals): boolean {
  return s.period !== null && !s.record && !s.generalStrong && normalize(text).replace(/\s/g, '').length <= 20
}

export function classifyIntent(text: string, ctx: ClassifyContext = {}): AskClassification {
  const prev = typeof ctx.prevUserText === 'string' && ctx.prevUserText.trim() ? ctx.prevUserText : null
  if (isAskScopeKey(ctx.scopeKey)) {
    const base = fromSignals(signals(prev ?? (typeof text === 'string' ? text : '')))
    if (base.intent === 'GENERAL') return { ...base, basedOnPrev: prev !== null }
    return { intent: base.intent, needsScope: false, scope: { key: ctx.scopeKey }, basedOnPrev: prev !== null }
  }
  if (typeof text !== 'string') return { intent: 'GENERAL', needsScope: false, scope: null, basedOnPrev: false }
  const own = signals(text)
  if (prev && isPeriodOnlyReply(text, own)) {
    const base = fromSignals(signals(prev))
    if (base.intent !== 'GENERAL') return { intent: base.intent, needsScope: false, scope: { key: own.period as AskScopeKey }, basedOnPrev: true }
  }
  return fromSignals(own)
}

/** 분류·검색어에 실제로 쓴 질문 글 — 직전 질문을 이어받았으면(`basedOnPrev`) 그 글, 아니면 이번 글. 조회 검색어는 이 글에서만 뽑는다. */
export function classifiedQuestion(c: Pick<AskClassification, 'basedOnPrev'>, text: string, prevUserText?: string): string {
  return c.basedOnPrev && typeof prevUserText === 'string' && prevUserText.trim() ? prevUserText : typeof text === 'string' ? text : ''
}

const QUOTED_TERM = /「([^」]{1,60})」|『([^』]{1,60})』|‘([^’]{1,60})’|“([^”]{1,60})”|'([^']{1,60})'|"([^"]{1,60})"/g
const JA_RUN = /[぀-ゟ゠-ヿ㐀-䶿一-鿿々〆ー]+/g
const KANJI = /[㐀-䶿一-鿿々]/

/**
 * 표현 찾기 검색어 — 따옴표 안 말(어느 글자든) + 따옴표 밖 일본어 덩어리(한자가 있거나 가나 2자 이상). 한 글자 가나(に·で)는 거의 모든 문장과 맞아 버린다.
 * 최대 3개·각 20자(정규화는 learning 과 같은 함수). 질문 원문은 이 함수 밖으로 나가지 않는다.
 */
export function extractSearchTerms(text: string): string[] {
  if (typeof text !== 'string' || !text) return []
  const n = Array.from(text.slice(0, TEXT_MAX * 2).normalize('NFKC')).slice(0, TEXT_MAX).join('')
  const out: string[] = []
  for (const m of n.matchAll(QUOTED_TERM)) out.push(m.slice(1).find((g) => g !== undefined) ?? '')
  for (const run of n.replace(QUOTED_TERM, ' ').match(JA_RUN) ?? []) if (KANJI.test(run) || Array.from(run).length >= 2) out.push(run)
  return normalizeRecordSearchTerms(out)
}
