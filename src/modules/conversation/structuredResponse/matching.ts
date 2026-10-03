/**
 * A4 레슨 — application·speaking 의 모범 답(modelAnswerJa)이 자기 목표 chunk 표현을 실제로 담고 있는지 보는
 * 정규화·매칭(2026-09-28 Leader 3차 결정 — task-010 UI E2E 스모크에서 speaking[0].targetIds 를 모범 답이 어느
 * 쪽도 담지 않아 화면에 "아직 안 쓴 표현"이 뜨는 사례 1건 관측).
 *
 * 정규화(NFKC → 가타카나→히라가나 → 소문자 → 공백·구두점 제거)는 서버 `learning/lessons/matching.ts` 의
 * `normalizeForMatch`/`kataToHira` 와 **문자 단위로 동일한 정규식**을 쓴다(옆에 그대로 복사) — 그러나 그 파일을
 * import 하지 **않는다**(module-dependency §3-1, conversation(L2) 은 learning(L3) 을 import 하지 않는다 — 6층
 * 경계, eslint `no-restricted-imports` 로도 막혀 있다). 동치성은 `__tests__/lessonMatching.test.ts` 의 골든
 * 케이스로 고정한다 — 서버 쪽 `matching.ts` 가 이 두 정규식을 바꾸면 그 파일도 같이 바꿔야 한다(재발 가능한 함정,
 * task 이력서에도 기록).
 *
 * 서버 쪽은 **학습자의 자유 발화**를 판정하는 용도라 의미가 다르다(`chunkForms`/`cores` 의 정중형·사전형 어미 제거) —
 * 그래서 아래 활용형 경로(task-025b O2)는 서버에 반영하지 않고 이 파일에만 둔다. 골든 동치 대상은 `kataToHira`·
 * `normalizeForLessonMatch` 두 정규식뿐이다. 여기서 보는 건 **모델이 스스로 만든 모범 답**(정돈된 문장)이고, 1차는
 * textJa 또는 reading 이 정규화한 모범 답에 부분 문자열로 있는지, 2차(`inflectedForms`)는 동사 목표 표현이 같은 동사의
 * 활용형으로 나타나는지(예: 목표 `曲がります` ↔ 모범 답 `曲がってください`)만 본다.
 */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g

export function normalizeForLessonMatch(s: string): string {
  return kataToHira(s.normalize('NFKC')).toLowerCase().replace(STRIP, '')
}

const KANJI_RE = /[\u3400-\u9fff々]/

// 정중형 어미(긴 것 먼저). 부정(ません·ませんでした)은 뜻이 반대라 활용형 경로에서 아예 제외한다.
const POLITE_ENDINGS = ['ましょう', 'ました', 'ます'] as const
const NEGATIVE_POLITE_RE = /ません(でした)?$/

type GodanRow = { i: string; e: string; te: string; ta: string }
const GODAN_ROWS: Record<string, GodanRow> = {
  う: { i: 'い', e: 'え', te: 'って', ta: 'った' },
  く: { i: 'き', e: 'け', te: 'いて', ta: 'いた' },
  ぐ: { i: 'ぎ', e: 'げ', te: 'いで', ta: 'いだ' },
  す: { i: 'し', e: 'せ', te: 'して', ta: 'した' },
  つ: { i: 'ち', e: 'て', te: 'って', ta: 'った' },
  ぬ: { i: 'に', e: 'ね', te: 'んで', ta: 'んだ' },
  ぶ: { i: 'び', e: 'べ', te: 'んで', ta: 'んだ' },
  む: { i: 'み', e: 'め', te: 'んで', ta: 'んだ' },
  る: { i: 'り', e: 'れ', te: 'って', ta: 'った' },
}
const I_ROW_TO_DICT = new Map(Object.entries(GODAN_ROWS).map(([dict, r]) => [r.i, dict]))
// 1단 동사 어간은 e단·i단 가나(食べ·起き) 또는 한자(出来)로 끝난다.
const I_ROW = new Set([...I_ROW_TO_DICT.keys(), 'じ', 'ぢ', 'ひ', 'ぴ'])
const E_ROW = new Set(['え', 'け', 'げ', 'せ', 'ぜ', 'て', 'で', 'ね', 'へ', 'べ', 'ぺ', 'め', 'れ'])
// 긍정 활용만(ない·なかっ·ませ·たく 는 부정 활용과 겹쳐 뜻이 뒤집히므로 뺐다).
const ICHIDAN_TAILS = ['て', 'た', 'ます', 'ました', 'ましょう', 'たい', 'る', 'れば']

function isUsableStem(stem: string): boolean {
  return [...stem].length >= 2 && KANJI_RE.test(stem)
}

function godanForms(stem: string, dict: string): string[] {
  const r = GODAN_ROWS[dict]
  const forms = [
    ...['ます', 'ました', 'ましょう', 'たい'].map((t) => stem + r.i + t),
    stem + r.e + 'ば',
    stem + r.te,
    stem + r.ta,
    stem + dict,
  ]
  // 行く 는 て·た 형이 불규칙(行って·行った) — 持って行く·出て行く 같은 복합형도 같다.
  if (dict === 'く' && stem.endsWith('行')) forms.push(`${stem}って`, `${stem}った`)
  return forms
}

/**
 * 정규화된 목표 표현이 동사(정중형 ます·ました·ましょう 또는 사전형)일 때 같은 동사의 활용형 후보(어간+완전한 활용 꼬리)를
 * 만든다 — task-025b O2(목표 `曲がります` 가 모범 답에서 `曲がってください` 로 쓰이면 ④ 위반으로 오판하던 건).
 *
 * **오탐 0 이 최우선**이라 의도적으로 좁다: 어간은 2글자 이상이면서 한자를 1개 이상 포함해야 하고(`あ`·`い`·`行` 같은 짧은 어간·
 * 가나뿐인 조각은 다른 단어와 겹친다 — 行った 는 行く·行う 둘 다 된다), 어간에 **완전한 활용 꼬리 전체**를 붙인 것만 후보로 삼는다
 * (어간 부분 문자열만 보면 食べ→食べ物, 曲が→曲がり角 이 통과한다). 부정형 목표·です·형용사·て형 목표·サ변 부정(しない) 같은 불규칙·
 * 가능/수동/사역/의지형은 후보를 만들지 않는다 — 그 경우는 기존 동작(정확 일치 실패 → 마지막 시도 완화)을 그대로 따른다.
 */
function inflectedForms(target: string): string[] {
  if (!target || NEGATIVE_POLITE_RE.test(target)) return []
  const forms: string[] = []
  const addIchidan = (stem: string) => {
    if (isUsableStem(stem)) forms.push(...ICHIDAN_TAILS.map((t) => stem + t))
  }
  const addGodan = (stem: string, dict: string) => {
    if (isUsableStem(stem)) forms.push(...godanForms(stem, dict))
  }
  const polite = POLITE_ENDINGS.find((e) => target.endsWith(e))
  if (polite) {
    const base = target.slice(0, -polite.length)
    const last = base.slice(-1)
    if (!last) return []
    // 1단: 어간 = base. 5단: base 가 i단 가나로 끝나면 그 가나를 뺀 것이 어간(曲がり → 曲が). 둘 다 가능하면 둘 다 본다(借り·手伝い).
    if (E_ROW.has(last) || I_ROW.has(last) || KANJI_RE.test(last)) addIchidan(base)
    const dict = I_ROW_TO_DICT.get(last)
    if (dict) addGodan(base.slice(0, -1), dict)
    return forms
  }
  if (target.endsWith('です')) return [] // 繋辞는 동사가 아니다(お疲れ様です 의 활용으로 でした 를 인정하지 않는다)
  const dict = target.slice(-1)
  if (!GODAN_ROWS[dict]) return []
  const stem = target.slice(0, -1)
  const last = stem.slice(-1)
  // 사전형 …る 는 어간이 e단·i단 가나로 끝나면 1단(食べる·起きる), 아니면 5단(曲がる)으로만 본다 — 엉뚱한 가설의 활용형을 만들지 않는다.
  if (dict === 'る' && (E_ROW.has(last) || I_ROW.has(last))) addIchidan(stem)
  else addGodan(stem, dict)
  return forms
}

// 활용형 바로 뒤에 부정이 이어지면(食べていません·食べてない·食べたくありません·食べたことがありません·食べることができません) 뜻이 뒤집히므로 그 출현은 세지 않는다.
// 꼬리 て·た 가 부분 문자열이라 이 뒤이음을 안 보면 목표 `食べます` 가 부정문에 걸린다(REV-066). 오탐 0 우선이라 미탐(食べたくなりました 는 `くな` 로 막힘)은 허용한다.
// 아래 문장 스캔(NEGATION_TOKENS)과 합집합으로 쓴다 — 스캔에 없는 は·くな 만 이 바로 뒤 검사가 따로 잡는다(나머지는 스캔 토큰을 포함해 중복).
const NEGATION_AFTER = [
  'いません', 'いない', 'いなかっ', // て형+いる 부정: 食べていません·食べていない
  'ない', 'なか', 'なく', 'ません', // て형 바로 뒤 부정: 食べてない·食べてなかった·食べてなくて·食べてません
  'くな', 'くあり', // 希望형 부정: 食べたくない·食べたくありません
  'ことがな', 'ことがありませ', 'ことはな', 'ことはありませ', 'ことない', // 경험 부정: 食べたことがない·…ありません
  'ことができな', 'ことができませ', 'つもりはな', 'つもりはありませ', // 가능·의도 부정
  'は', // 食べてはいけません
] as const

// 부정 꼬리(ない·ず·ぬ·せん)와 한자·구어·방언 표기, 부정과만 어울리는 부사, 부정 대답·거짓, 금지·불가능·거절·중단·취소·망각·시늉 술어 — 활용형과 부정 사이에 무엇이 끼든(REV-069) 같은 문장 안에 있으면 부정으로 본다.
const NEGATION_TOKENS = [
  'ない', 'なか', 'なく', 'なさそ', 'せん', 'ず', 'ぬ', 'できな', 'じゃ', 'では', 'いけ', 'だめ', '駄目', '無理', 'むり', '不可', '難しい',
  '無い', '無く', '無かっ', '無し', 'なし', 'なけれ', 'なきゃ', 'ねえ', 'へん', 'あかん', 'おらん', 'ものか', 'もんか', 'たまるか', 'ng',
  '一度も', 'いちども', '全然', 'ぜんぜん', '決して', 'けっして', '少しも', 'すこしも', 'ちっとも', 'めったに', '二度と', 'にどと', '未',
  'いいえ', '嘘', 'うそ', '嫌', 'いや', '苦手', '不要', '禁', '控え', '遠慮', 'やめ', '止め', '中止', 'きゃんせる', '延期', '断', '忘れ', '諦め', 'あきらめ', 'ふりを',
] as const

// 금지형 な·부정 의지 まい. 바로 뒤(食べるな、…·食べるまいと)는 활용형이 사전형일 때 — サ변 후보는 `勉強す` 라 る 가 하나 낀다(なら·など·なんて 는 긍정).
// 떨어진 곳(食べることはするなと言われた·…するまい)은 사전형 꼬리(u단) 뒤만 본다 — おいしくなって 같은 〜くなる 는 금지가 아니다.
const PROHIBITIVE_AFTER = /^る?(?:な(?!ら|ど|んて)|まい)/
const PROHIBITIVE_IN = /[うくぐすつぬぶむる]な[とよ]|[うぐすつぬぶむる]なって|[くぐすつぬぶむる]まい/
// 문장 끝 금지형 な(ここで食べてみるな)·완곡 거절(食べるのは、ちょっと…·…は結構です)·아직 아님(食べるのはまだです).
const NEGATION_AT_END = /(?:な|ちょっとね?|結構です|けっこうです|まだ(?:です|だ)?)$/
// 술어가 열린 채 끝나는 문장(食べたことは。·食べたかったのに。·食べたかったけど。)은 뜻이 도치·생략된 곳에 있어 그 문장의 출현은 긍정으로 세지 않는다.
const OPEN_END = /(?:[はもが]|けど|けれど|のに)$/

const OPEN_BRACKETS = '「『(（[［【〔〈《'
const CLOSE_BRACKETS = '」』)）]］】〕〉》'
const SENTENCE_END = '。｡．!！?？'
const COMMAS = '、､,，'
const CONTRAST_TAIL = /(?:が|けど|けれど|けれども)\s*$/

/** 종결 부호가 문장을 끊는지 — 괄호 안(「食べた。」とは言えません)·인용 と/って 앞(食べた？と聞かれた)·닫는 괄호 앞은 끊지 않는다. */
function endsSentence(chars: string[], i: number, depth: number): boolean {
  const ch = chars[i]
  const next = chars[i + 1] ?? ''
  if (depth > 0 || next === 'と' || next === 'っ' || CLOSE_BRACKETS.includes(next)) return false
  if (SENTENCE_END.includes(ch)) return true
  // 반각 마침표는 소수점(3.5)·말줄임(...)·로마자(Mr.)가 아닐 때만.
  return ch === '.' && chars[i - 1] !== '.' && !/[.0-9a-z]/i.test(next)
}

/**
 * 원문(정규화 전 — 구두점이 남아 있을 때)을 문장 → 절로 나눈다. 끊는 곳을 줄일수록 부정이 같은 문장에 남아 안전하므로 말줄임(…)·줄바꿈·
 * 쉼표로는 끊지 않는다(食べたいけど…無理です·食べたことは、一度もありません). 단 대비 접속(が·けど·けれど(も)) 뒤 쉼표는 절 경계로 둔다 —
 * 앞 절의 부정은 뒤 절 술어를 부정하지 못한다(まだ食べていませんが、あとで食べてください). 절 경계는 활용형 **앞쪽** 검사에만 쓴다.
 */
function splitSentenceClauses(raw: string): string[][] {
  const chars = [...raw]
  const sentences: string[][] = []
  let clauses: string[] = []
  let cur = ''
  let depth = 0
  const endClause = () => {
    clauses.push(cur)
    cur = ''
  }
  chars.forEach((ch, i) => {
    if (OPEN_BRACKETS.includes(ch)) depth += 1
    else if (CLOSE_BRACKETS.includes(ch) && depth > 0) depth -= 1
    if (endsSentence(chars, i, depth)) {
      endClause()
      sentences.push(clauses)
      clauses = []
    } else if (depth === 0 && COMMAS.includes(ch) && CONTRAST_TAIL.test(cur)) {
      endClause()
    } else {
      cur += ch
    }
  })
  endClause()
  sentences.push(clauses)
  return sentences
}

// 부정 판정용 사본만 장음 ー 를 지우고 작은 모음을 큰 모음으로 편다(食べてなーい·食べてねぇよ) — 일치가 늘기만 하므로 과차단 쪽이다.
function negationView(s: string): string {
  return s.replace(/ー/g, '').replace(/[ぁぃぅぇぉ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 1))
}

/** before = 같은 절의 앞부분, after = 문장 끝까지의 뒷부분(정규화본). 어느 검사든 걸리면 부정 출현이다(오탐 0 우선, 과차단 허용). */
function negatedAround(rawBefore: string, rawAfter: string): boolean {
  const before = negationView(rawBefore)
  const after = negationView(rawAfter)
  return (
    NEGATION_AFTER.some((n) => after.startsWith(n)) ||
    PROHIBITIVE_AFTER.test(after) ||
    NEGATION_AT_END.test(after) ||
    PROHIBITIVE_IN.test(before) ||
    PROHIBITIVE_IN.test(after) ||
    NEGATION_TOKENS.some((t) => before.includes(t) || after.includes(t))
  )
}

function appearsPositively(modelAnswerJa: string, forms: string[]): boolean {
  if (forms.length === 0) return false
  return splitSentenceClauses(modelAnswerJa).some((rawClauses) => {
    const clauses = rawClauses.map(normalizeForLessonMatch)
    if (OPEN_END.test(clauses.join(''))) return false
    return clauses.some((clause, i) => {
      const rest = clauses.slice(i + 1).join('')
      return forms.some((form) => {
        for (let at = clause.indexOf(form); at >= 0; at = clause.indexOf(form, at + 1)) {
          if (!negatedAround(clause.slice(0, at), clause.slice(at + form.length) + rest)) return true
        }
        return false
      })
    })
  })
}

/**
 * 목표 chunk 의 textJa 또는 reading 중 하나라도 modelAnswerJa(정규화)에 부분 문자열로 있으면 true. 정확 일치가 실패했을 때만
 * 동사 활용형 경로(`inflectedForms`, textJa 기준 — reading 은 한자가 없어 어간 가드를 통과할 수 없다)를 본다 — 활용형은 부정이 없는
 * 문장(앞쪽 대비 절 제외)에 나타날 때만 센다(`appearsPositively`).
 * 가타카나 외래어(정규화 후 히라가나)와 reading(히라가나) 경로는 그대로다.
 */
export function chunkAppearsIn(modelAnswerJa: string, chunk: { textJa: string; reading: string }): boolean {
  const hay = normalizeForLessonMatch(modelAnswerJa)
  if (!hay) return false
  const text = normalizeForLessonMatch(chunk.textJa)
  if (hay.includes(text) || hay.includes(normalizeForLessonMatch(chunk.reading))) return true
  return appearsPositively(modelAnswerJa, inflectedForms(text))
}
