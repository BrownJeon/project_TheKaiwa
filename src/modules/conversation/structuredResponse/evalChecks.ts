/**
 * A6(EVAL_GEN)·A7(EVAL_GRADE) 후검증 + 결정적 보정 — `evalSchemas.ts` 짝. task-011 Leader's Plan L2·L3.
 *
 * **DB 저장 전제(중요, developer 인계)**: `EvaluationItem.prompt`·`.expected` 는 **A6 가 돌려준 원본을 그대로** 저장한다
 * (api-contract #66 의 `LISTEN_RESPOND` 예시처럼 `prompt.textJa` 를 `{audioUrl,textHidden:true,instructionKo}` 로
 * 바꿔치는 것은 **`GET /evaluations/:id` 응답을 만들 때의 직렬화 단계**일 뿐, DB 컬럼 자체를 고치는 게 아니다). 그래야
 * 아래 `computeEvalItemHash` 를 과거 문항에도 **똑같이** 적용해 14일 중복 검사용 해시 목록을 다시 만들 수 있다 — 저장
 * 시점에 `prompt.textJa` 를 지워 버리면 그 문항은 영영 해시를 재현할 수 없다.
 */
import { createHash } from 'node:crypto'
import { llm } from '@/modules/engine'
import {
  EVAL_DIMS,
  EVAL_GEN_ITEM_COUNTS,
  EVAL_GEN_TOTAL_ITEMS,
  EVAL_SEGMENT_RUN_MAX,
  EVAL_SEGMENTS_MAX,
  EVAL_SEGMENTS_MIN,
  type EvalGenItem,
  type EvalGenResponse,
  type EvalGradeItemOut,
  type EvalGradeResponse,
  type EvalItemKind,
  type EvalKind,
  type EvalRubric,
} from './evalSchemas'

/** design-spec §7-5·api-contract #65 — [재료] 단어장에서 고른 문항이 전체의 60% 이상이어야 한다. */
export const EVAL_GEN_MATERIAL_RATIO_MIN = 0.6

// ── 14일 중복 회피 해시(sha1(kind|정규화 핵심)) ──────────────────────────────

/** `repetition/index.ts` `normalizeRefText` 와 같은 규칙(NFKC + 공백·문장부호·물결표 제거) — conversation 은 learning 을
 * import 할 수 없어(6층 경계) 여기 따로 둔다. `___`(USAGE_CHOICE 빈칸 표시)도 정규화에서 제거해 빈칸 위치 차이로
 * 해시가 달라지지 않게 한다. */
function normalizeHashCore(text: string): string {
  return text.normalize('NFKC').replace(/[\s　、。，．,.!！?？・「」『』〜~…_]/g, '')
}

/** kind 별 "핵심" 필드 — 문항의 정체성을 대표하는 텍스트 하나. `wordSurface` 가 있으면 그것을 우선한다(재료 링크가
 * 가장 안정적인 식별자라서). */
function hashCoreText(item: EvalGenItem): string {
  switch (item.kind) {
    case 'MEANING_CHOICE':
    case 'READING_INPUT':
      return item.wordSurface ?? item.prompt.surface
    case 'USAGE_CHOICE':
      return item.wordSurface ?? item.prompt.sentenceJa
    case 'CHUNK_CLASSIFY':
      return item.wordSurface ?? item.prompt.textJa
    case 'LISTEN_RESPOND':
      return item.prompt.textJa
    case 'ASSEMBLE':
      return [...item.expected.order].sort().join('')
    case 'SITUATION_RESPOND':
      return item.prompt.situationKo
    case 'CORRECTION_SPOT':
      return item.prompt.sentenceJa
  }
}

/** sha1(`kind|정규화 핵심`) — hex 40자. developer 는 과거 `EvaluationItem` 행(최근 14일)을 이 타입으로 복원해 같은
 * 함수로 해시를 다시 계산한 뒤 `Set` 으로 만들어 `buildEvalGenRequest`/`checkEvalGenResponse` 에 넘긴다. */
export function computeEvalItemHash(item: EvalGenItem): string {
  return createHash('sha1').update(`${item.kind}|${normalizeHashCore(hashCoreText(item))}`, 'utf8').digest('hex')
}

// ── 문자열 전부 훑기(엔진 식별 정보 누출 검사용) ─────────────────────────────

function collectStrings(node: unknown, acc: string[] = []): string[] {
  if (typeof node === 'string') acc.push(node)
  else if (Array.isArray(node)) node.forEach((v) => collectStrings(v, acc))
  else if (node !== null && typeof node === 'object') for (const v of Object.values(node)) collectStrings(v, acc)
  return acc
}

// ── EVAL_GEN 후검증 ──────────────────────────────────────────────────────────

export interface CheckEvalGenInput {
  kind: EvalKind
  /** [재료]로 프롬프트에 실은 단어 표기 목록(≤15) — `wordSurface` 가 이 안에 있는 문항만 "재료 사용"으로 센다. */
  candidateSurfaces: string[]
  /** 최근 14일 출제 해시(코드가 과거 `EvaluationItem` 에서 계산). */
  recentHashes: ReadonlySet<string>
}

/**
 * 스키마가 표현 못 하는 여섯 가지: ① kind 별 정확한 개수(draft-07 이라 `minContains` 불가, evalSchemas.ts 주석)
 * ② READING_INPUT `accepted ⊇ {reading}` ③ USAGE_CHOICE 빈칸 표시(`___`) ④ ASSEMBLE `order` 가 `pieces` 의 순서만
 * 바꾼 것인지(다중집합 동일) ⑤ CORRECTION_SPOT `wrongSpan` 이 `sentenceJa` 의 리터럴 부분 문자열인지 ⑥ CORRECTION_SPOT
 * `prompt.segments` 계약(evalGen@v4 — `checkCorrectionSpotSegments`). 그 위에 재료 비율(60%)·14일 중복·엔진명 누출도 여기서 본다.
 */
export function checkEvalGenResponse(input: CheckEvalGenInput, data: EvalGenResponse): string[] {
  const v: string[] = []
  const wanted = EVAL_GEN_ITEM_COUNTS[input.kind]
  const total = EVAL_GEN_TOTAL_ITEMS[input.kind]
  if (data.items.length !== total) v.push(`items 는 정확히 ${total}개여야 한다(현재 ${data.items.length}개)`)

  const counts: Partial<Record<EvalItemKind, number>> = {}
  for (const it of data.items) counts[it.kind] = (counts[it.kind] ?? 0) + 1
  for (const [kind, need] of Object.entries(wanted) as [EvalItemKind, number][]) {
    if ((counts[kind] ?? 0) !== need) v.push(`kind='${kind}' 문항은 정확히 ${need}개여야 하는데 ${counts[kind] ?? 0}개다`)
  }
  for (const kind of Object.keys(counts) as EvalItemKind[]) {
    if (!(kind in wanted)) v.push(`kind='${kind}' 는 ${input.kind} 평가에 쓸 수 없는 종류다`)
  }

  const candidateSet = new Set(input.candidateSurfaces)
  let materialLinked = 0
  const seenInThisResponse = new Set<string>()

  data.items.forEach((it, i) => {
    const where = `items[${i}]`
    if (it.wordSurface != null && candidateSet.has(it.wordSurface)) materialLinked++

    switch (it.kind) {
      case 'READING_INPUT':
        if (!it.expected.accepted.includes(it.expected.reading)) {
          v.push(`${where}.expected.accepted 는 expected.reading('${it.expected.reading}')을 포함해야 한다`)
        }
        break
      case 'USAGE_CHOICE':
        if (!it.prompt.sentenceJa.includes('___')) v.push(`${where}.prompt.sentenceJa 는 빈칸을 "___"(밑줄 3개)로 표시해야 한다`)
        break
      case 'ASSEMBLE': {
        const a = [...it.prompt.pieces].sort()
        const b = [...it.expected.order].sort()
        const same = a.length === b.length && a.every((x, idx) => x === b[idx])
        if (!same) v.push(`${where}.expected.order 는 prompt.pieces 와 정확히 같은 조각들을 순서만 바꿔 담아야 한다(다른 조각을 지어내거나 빠뜨렸다)`)
        break
      }
      case 'CORRECTION_SPOT':
        if (!it.prompt.sentenceJa.includes(it.expected.wrongSpan)) {
          v.push(`${where}.expected.wrongSpan 은 prompt.sentenceJa 안에 글자 그대로 들어 있는 부분 문자열이어야 한다`)
        }
        if (it.expected.correctedJa === it.prompt.sentenceJa) v.push(`${where}.expected.correctedJa 가 prompt.sentenceJa 와 같다 — 실제로 고친 문장을 써야 한다`)
        // evalGen@v4 — 새 출제물은 segments 가 반드시 있어야 한다(extraCheck 가 먼저 repairEvalGenCorrectionSegments 로 채운다)
        for (const msg of checkCorrectionSpotSegments(it.prompt.sentenceJa, it.prompt.segments, it.expected.wrongSpan)) v.push(`${where}.prompt.segments ${msg}`)
        break
      default:
        break
    }

    const hash = computeEvalItemHash(it)
    const core = hashCoreText(it)
    if (input.recentHashes.has(hash)) {
      v.push(`${where}('${core}')는 최근 14일 안에 이미 낸 것과 핵심이 같다 — '${core}'는 [재료]에서 오답이 많아도 이번에는 쓰지 말고, 다른 단어나 문장으로 바꿔라`)
    }
    if (seenInThisResponse.has(hash)) v.push(`${where}('${core}')는 이번 응답의 다른 문항과 핵심이 겹친다 — 서로 다른 표현을 써라`)
    seenInThisResponse.add(hash)
  })

  const ratio = data.items.length > 0 ? materialLinked / data.items.length : 0
  if (ratio < EVAL_GEN_MATERIAL_RATIO_MIN) {
    v.push(`[재료] 단어장에서 고른 문항이 ${Math.round(ratio * 100)}%뿐이다(${Math.round(EVAL_GEN_MATERIAL_RATIO_MIN * 100)}% 이상 필요) — wordSurface 를 [재료] 목록의 표기 그대로 더 채워라`)
  }

  if (collectStrings(data).some((t) => llm.mentionsEngineIdentity(t))) v.push('응답 어딘가에 엔진·모델 이름이 노출됐다')

  return v
}

export interface EvalGenRepairResult {
  /** 입력에도 있고 문항 핵심 표기도 같은데 `wordSurface` 가 비어 있던 것을 채운 개수. */
  linked: number
}

/**
 * 결정적 보정(LLM 재호출 없음 — `repair.ts`/decisions §8 의 "이미 아는 데이터로만 채운다" 원칙과 동일). MEANING_CHOICE·
 * READING_INPUT·CHUNK_CLASSIFY 는 문항의 핵심 표기(`prompt.surface`/`prompt.textJa`)가 [재료] 후보 목록의 한 단어와
 * **글자 그대로** 같은데 모델이 `wordSurface` 채우는 걸 깜빡했을 때만 그 표기를 그대로 옮겨 붙인다 — 새 값을 지어내지
 * 않는다(안전). USAGE_CHOICE(문장 속 한 단어)·서술형(TALK)은 어느 단어가 핵심인지 결정적으로 골라낼 수 없어 손대지
 * 않는다 — 그런데도 재료 비율이 부족하면 `checkEvalGenResponse` 가 재시도로 보낸다.
 *
 * `buildEvalGenRequest.extraCheck` 가 `checkEvalGenResponse` 보다 **먼저** 이 함수를 불러 in-place 로 고친다(엔진
 * `data` 참조 동일성은 `repair.ts` 상단 주석 참고 — 이 프로젝트의 `completeJson` 경로는 lesson@v2 때 이미 확인했고
 * evalGen 도 같은 경로를 탄다).
 */
export function repairEvalGenWordLinks(input: { candidateSurfaces: string[] }, data: EvalGenResponse): EvalGenRepairResult {
  const candidates = new Set(input.candidateSurfaces)
  let linked = 0
  for (const it of data.items) {
    if (it.wordSurface != null) continue
    let core: string | null = null
    if (it.kind === 'MEANING_CHOICE' || it.kind === 'READING_INPUT') core = it.prompt.surface
    else if (it.kind === 'CHUNK_CLASSIFY') core = it.prompt.textJa
    if (core && candidates.has(core)) {
      it.wordSurface = core
      linked++
    }
  }
  return { linked }
}

/**
 * CHUNK_CLASSIFY 의 top-level `chunkType`(Prisma `EvaluationItem.chunkType` 권위값)을 `expected.chunkType` 기준으로
 * 맞춘다(둘 다 스키마가 같은 enum 을 강제하지만, 모델이 서로 다른 값을 낼 가능성은 남는다 — LLM 재호출 없이 값 하나를
 * 다른 값에 맞추는 것뿐이라 "새로 만들어 내는" 보정이 아니다). 2026-09-28 A6 실측(WORDS 2회)에서 `expected` 를 빈
 * 객체로 요구했을 때 1차 응답의 `expected` 필드 자체가 누락되는 사고가 2회 모두 발생해([[llm-japanese-quality]] §9)
 * `expected.chunkType` 을 top-level 과 같은 자연스러운 값으로 바꿨다 — 그 대신 둘이 어긋날 여지가 생겨 이 보정을 둔다.
 */
export function repairEvalGenChunkTypeSync(data: EvalGenResponse): { synced: number } {
  let synced = 0
  for (const it of data.items) {
    if (it.kind !== 'CHUNK_CLASSIFY') continue
    if (it.chunkType !== it.expected.chunkType) {
      it.chunkType = it.expected.chunkType
      synced++
    }
  }
  return { synced }
}

// ── CORRECTION_SPOT `prompt.segments`(evalGen@v4, task-011 (f)=A "틀린 곳 탭 선택") ─────────────────
//
// 학습자는 문장을 어절 조각으로 끊어 놓은 칩 중 **하나**를 탭한다(learning 의 `spotIndex` = `prompt.segments` 인덱스). 그래서
// 조각이 ① 원문을 글자 하나 안 바꾸고 이어 붙이면 그대로 되고 ② 칩으로 쓸 만한 크기(3~12개, 조사·구두점 혼자 조각 금지)이고
// ③ 정답(`wrongSpan`)이 너무 많은 조각에 걸쳐 있지 않아야 한다. 모델이 이걸 못 지키면 재시도가 아니라 **코드가 `sentenceJa`
// 에서 결정적으로 다시 만든다**(`repairEvalGenCorrectionSegments`) — lesson `promptKo`/읽기 보정과 같은 원칙([[llm-japanese-quality]]
// §8·§14). 14일 해시(`computeEvalItemHash`)는 `prompt.sentenceJa` 만 쓰므로 segments 는 해시에 영향이 없다.

/** 혼자 조각이 되면 안 되는 조사·접속 조각(구두점을 떼고 비교). */
const SEGMENT_PARTICLES: ReadonlySet<string> = new Set([
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'も', 'の', 'や', 'か', 'ね', 'よ', 'から', 'まで', 'より', 'って', 'など', 'でも', 'しか', 'だけ', 'ほど', 'には', 'では', 'とは', 'へは',
])
const SEGMENT_PUNCT_CHARS = '、。，．,.!！?？「」『』（）()・…〜~'
const SEGMENT_PUNCT_RE = new RegExp(`[${SEGMENT_PUNCT_CHARS.replace(/[\]\\^-]/g, '\\$&')}\\s]`, 'g')
const SEGMENT_PUNCT_ONLY_RE = new RegExp(`^[${SEGMENT_PUNCT_CHARS.replace(/[\]\\^-]/g, '\\$&')}\\s]+$`)

function stripSegmentPunct(piece: string): string {
  return piece.replace(SEGMENT_PUNCT_RE, '')
}

export interface CorrectionSegmentStats {
  /** 조각 수(배열이 아니면 0). */
  count: number
  /** `segments.join('') === sentenceJa`. */
  joinEqual: boolean
  /** 빈 문자열·공백 포함 조각 수. */
  emptyOrSpaced: number
  /** 구두점(「」 포함)만으로 된 조각 수. */
  punctOnly: number
  /** 조사(は·が·を·に…)만으로 된 조각 수 — 칩 하나가 조사 한 글자면 정답을 그대로 드러내거나 탭하기 어렵다. */
  particleOnly: number
  /** 구두점을 뗀 글자 수가 1인 조각 수(조사 제외) — 품질 지표(하드 위반 아님). */
  singleChar: number
  /** `wrongSpan` 이 걸친 연속 조각 범위(양끝 포함 인덱스). join 이 다르거나 wrongSpan 이 문장에 없으면 null. */
  range: { from: number; to: number } | null
  /** `wrongSpan` 이 걸친 조각 수(range 없으면 0). */
  runLength: number
}

/**
 * `wrongSpan` 이 걸친 조각 범위 — 문장에서 `wrongSpan` 이 **처음** 나오는 위치 기준(같은 말이 문장에 두 번 있으면 앞쪽).
 * 끝 구두점(「行きます。」의 「。」)은 조각에 붙어 있어도 된다(글자 겹침으로 본다). `segments.join('') !== sentenceJa`
 * 이거나 `wrongSpan` 이 문장에 없으면 null. 화면이 "정답 칩"을 강조하거나 A7 입력의 고른 곳이 정답 범위와 겹치는지 볼 때 쓴다.
 */
export function findWrongSegmentRange(segments: readonly string[], sentenceJa: string, wrongSpan: string): { from: number; to: number } | null {
  if (wrongSpan.length === 0 || segments.join('') !== sentenceJa) return null
  const start = sentenceJa.indexOf(wrongSpan)
  if (start < 0) return null
  const end = start + wrongSpan.length
  let from = -1
  let to = -1
  let pos = 0
  segments.forEach((seg, i) => {
    const a = pos
    const b = pos + seg.length
    pos = b
    if (a < end && b > start) {
      if (from < 0) from = i
      to = i
    }
  })
  return from < 0 ? null : { from, to }
}

export function analyzeCorrectionSegments(sentenceJa: string, segments: readonly string[] | undefined, wrongSpan: string): CorrectionSegmentStats {
  if (!Array.isArray(segments)) return { count: 0, joinEqual: false, emptyOrSpaced: 0, punctOnly: 0, particleOnly: 0, singleChar: 0, range: null, runLength: 0 }
  let emptyOrSpaced = 0
  let punctOnly = 0
  let particleOnly = 0
  let singleChar = 0
  for (const seg of segments) {
    if (typeof seg !== 'string' || seg.length === 0 || /\s/.test(seg)) {
      emptyOrSpaced++
      continue
    }
    if (SEGMENT_PUNCT_ONLY_RE.test(seg)) {
      punctOnly++
      continue
    }
    const core = stripSegmentPunct(seg)
    if (SEGMENT_PARTICLES.has(core)) particleOnly++
    else if (core.length === 1) singleChar++
  }
  const range = findWrongSegmentRange(segments, sentenceJa, wrongSpan)
  return {
    count: segments.length,
    joinEqual: segments.join('') === sentenceJa,
    emptyOrSpaced,
    punctOnly,
    particleOnly,
    singleChar,
    range,
    runLength: range ? range.to - range.from + 1 : 0,
  }
}

/**
 * CORRECTION_SPOT `prompt.segments` 하드 계약 위반 문구(없으면 빈 배열). `checkEvalGenResponse` 가 문항마다 부른다 —
 * 문구 앞에는 호출부가 `items[i].prompt.segments ` 를 붙이므로 여기서는 술어부터 쓴다(재시도 프롬프트에 그대로 실린다).
 */
export function checkCorrectionSpotSegments(sentenceJa: string, segments: readonly string[] | undefined, wrongSpan: string): string[] {
  if (segments === undefined) {
    return ['가 없다 — sentenceJa 를 어절 3~12개로 끊은 배열을 넣어라(문장이 너무 짧거나 히라가나뿐이라 끊기 어려우면 한자·가타카나가 섞인 더 긴 문장으로 바꿔라)']
  }
  const st = analyzeCorrectionSegments(sentenceJa, segments, wrongSpan)
  const v: string[] = []
  if (st.count < EVAL_SEGMENTS_MIN || st.count > EVAL_SEGMENTS_MAX) v.push(`는 ${EVAL_SEGMENTS_MIN}~${EVAL_SEGMENTS_MAX}개여야 한다(현재 ${st.count}개)`)
  if (st.emptyOrSpaced > 0) v.push('에 빈 조각이나 공백이 든 조각이 있다')
  if (!st.joinEqual) v.push('를 이어 붙인 결과가 sentenceJa 와 글자 하나까지 같아야 한다 — 글자를 더하거나 빼거나 바꾸지 말고 문장을 앞에서부터 그대로 끊어라')
  if (st.punctOnly > 0) v.push('에 구두점만 있는 조각이 있다 — 구두점(、。「」)은 앞 조각에 붙여라')
  if (st.particleOnly > 0) v.push('에 조사(は·が·を·に…) 한 글자만 있는 조각이 있다 — 조사는 앞 단어에 붙여 한 조각으로 만들어라')
  if (st.joinEqual && wrongSpan.length > 0 && sentenceJa.includes(wrongSpan)) {
    if (st.range === null) v.push('에서 wrongSpan 이 걸친 조각을 찾지 못했다')
    else {
      if (st.runLength > EVAL_SEGMENT_RUN_MAX) v.push(`에서 wrongSpan 이 조각 ${st.runLength}개에 걸쳐 있다(최대 ${EVAL_SEGMENT_RUN_MAX}개) — 틀린 부분이 한두 조각 안에 들어오게 끊어라`)
      if (st.count - st.runLength < 1) v.push('에서 wrongSpan 이 모든 조각에 걸쳐 있다 — 틀리지 않은 조각이 남게 더 잘게 끊거나 문장을 늘려라')
    }
  }
  return v
}

const SEG_IS_KANJI = /[㐀-䶿一-鿿々〆ヶ]/
const SEG_IS_KATA = /[ァ-ヿㇰ-ㇿ]/
const SEG_IS_LATIN = /[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/
const SEG_IS_HIRA = /[ぁ-ゟ]/
const SEG_CLOSE_STRONG = /[、。，．！？!?,.]/
const SEG_CLOSE_QUOTE = /[」』）)]/
const SEG_OPEN_QUOTE = /[「『（(]/
const SEG_KANJI_RUN = /[一-鿿々〆]{4,}/

function isContentChar(c: string): boolean {
  return SEG_IS_KANJI.test(c) || SEG_IS_KATA.test(c) || SEG_IS_LATIN.test(c)
}

/** 한자만 4자 이상 이어진 덩어리(毎日学校)를 단어 경계로 쪼갠다 — `Intl.Segmenter` 가 있을 때만, 한 글자 토큰은 다음 토큰에 붙인다. */
function splitKanjiRun(run: string): string[] {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return [run]
  const toks = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(run)].map((t) => t.segment)
  const merged: string[] = []
  let carry = ''
  for (const t of toks) {
    const cur = carry + t
    if (t.length === 1 && carry === '') {
      carry = cur
      continue
    }
    merged.push(cur)
    carry = ''
  }
  if (carry) {
    if (merged.length > 0) merged[merged.length - 1] += carry
    else merged.push(carry)
  }
  return merged.length >= 2 ? merged : [run]
}

/** 글자 종류(문자 스크립트) 기반 1차 분할 — 「한자·가타카나·알파벳 덩어리 + 뒤따르는 히라가나」 하나가 한 조각(어절). */
function scriptRunPieces(sentence: string): string[] {
  const pieces: string[] = []
  let cur = ''
  let phase: 'none' | 'lead' | 'content' | 'tail' = 'none'
  let leadLen = 0
  const flush = () => {
    if (cur) pieces.push(cur)
    cur = ''
    phase = 'none'
    leadLen = 0
  }
  for (const c of sentence) {
    if (SEG_OPEN_QUOTE.test(c)) {
      flush()
      cur = c
      phase = 'content'
      continue
    }
    if (SEG_CLOSE_STRONG.test(c)) {
      if (cur) {
        cur += c
        flush()
      } else if (pieces.length > 0) pieces[pieces.length - 1] += c
      else cur = c
      continue
    }
    if (SEG_CLOSE_QUOTE.test(c)) {
      if (cur) {
        cur += c
        phase = 'tail'
      } else if (pieces.length > 0) pieces[pieces.length - 1] += c
      continue
    }
    if (isContentChar(c)) {
      if (phase === 'tail') {
        flush()
      } else if (phase === 'lead' && leadLen > 2) {
        flush()
      }
      cur += c
      phase = 'content'
      continue
    }
    if (SEG_IS_HIRA.test(c)) {
      if (phase === 'content' || phase === 'tail') {
        cur += c
        phase = 'tail'
      } else if (phase === 'lead') {
        cur += c
        leadLen++
      } else {
        cur += c
        phase = 'lead'
        leadLen = 1
      }
      // 목적격 「を」는 히라가나 단어 안에 거의 나오지 않아 안전하게 어절 끝으로 본다(りんごを|たべます) — 뒤 구두점은 앞 조각에 붙는다
      if (c === 'を') flush()
      continue
    }
    cur += c // 그 밖의 문자(공백 등)는 현재 조각에 그대로 — join 동일성을 해치지 않는다
  }
  flush()
  return pieces
}

function splitLongKanjiRuns(pieces: string[]): string[] {
  const out: string[] = []
  for (const p of pieces) {
    const m = SEG_KANJI_RUN.exec(p)
    if (!m) {
      out.push(p)
      continue
    }
    const parts = splitKanjiRun(m[0])
    if (parts.length < 2) {
      out.push(p)
      continue
    }
    const head = p.slice(0, m.index)
    const tail = p.slice(m.index + m[0].length)
    parts.forEach((part, i) => out.push(`${i === 0 ? head : ''}${part}${i === parts.length - 1 ? tail : ''}`))
  }
  return out
}

/** 조각 수가 상한을 넘으면 붙은 글자 수가 가장 적은 이웃 둘을 합친다. */
function mergeToMax(pieces: string[]): string[] {
  const out = [...pieces]
  while (out.length > EVAL_SEGMENTS_MAX) {
    let best = 0
    let bestLen = Infinity
    for (let i = 0; i < out.length - 1; i++) {
      const len = out[i].length + out[i + 1].length
      if (len < bestLen) {
        bestLen = len
        best = i
      }
    }
    out.splice(best, 2, out[best] + out[best + 1])
  }
  return out
}

const SEG_SIMPLE_PARTICLE = /[はがをにへでともの]/

/**
 * 한 조각 안에서 「한자 덩어리 | 히라가나 꼬리」 경계를 찾아 나눌 자리(앞 조각의 길이)를 돌려준다(없으면 -1).
 * ① 꼬리가 조사 한 글자(は·が·に…)로 시작하면 그 조사까지 앞 조각에 붙인다(先生が|です) — 단 「学生です」의 で 처럼 뒤가 す 면 조사가 아니다.
 * ② 아니면 경계에서 그대로 나누되 앞 조각이 2자 이상(飲|む 같은 한 글자 어간 분리 금지)이고 꼬리가 조사 하나가 아닐 때만.
 */
function minSplitPoint(p: string): number {
  let k = -1
  for (let i = 1; i < p.length; i++) {
    if (isContentChar(p[i - 1]) && SEG_IS_HIRA.test(p[i])) {
      k = i
      break
    }
  }
  if (k < 0) return -1
  const next = p[k + 1]
  if (SEG_SIMPLE_PARTICLE.test(p[k]) && next !== undefined && next !== 'す' && !SEG_CLOSE_STRONG.test(next) && !SEG_CLOSE_QUOTE.test(next)) return k + 1
  if (k < 2) return -1
  const core = stripSegmentPunct(p.slice(k))
  if (core.length < 2 || SEGMENT_PARTICLES.has(core)) return -1
  return k
}

/** 조각 수가 하한보다 적으면 가장 긴 조각부터 `minSplitPoint` 에서 나눈다(나눌 곳이 없으면 멈춘다). */
function splitToMin(pieces: string[]): string[] {
  const out = [...pieces]
  while (out.length < EVAL_SEGMENTS_MIN) {
    let bestIdx = -1
    let bestAt = -1
    let bestLen = 0
    out.forEach((p, i) => {
      const at = minSplitPoint(p)
      if (at > 0 && at < p.length && p.length > bestLen) {
        bestLen = p.length
        bestIdx = i
        bestAt = at
      }
    })
    if (bestIdx < 0) break
    const p = out[bestIdx]
    out.splice(bestIdx, 1, p.slice(0, bestAt), p.slice(bestAt))
  }
  return out
}

/**
 * `sentenceJa` 를 어절 조각으로 **결정적으로** 끊는다(LLM 없음). 항상 `join('') === sentenceJa` 이고 3~12개를 맞추려 노력하지만,
 * 히라가나뿐이거나 너무 짧은 문장은 3개에 못 미칠 수 있다(호출부가 `checkCorrectionSpotSegments` 로 다시 확인한다).
 */
export function splitSentenceIntoSegments(sentenceJa: string): string[] {
  if (sentenceJa.length === 0) return []
  return mergeToMax(splitToMin(splitLongKanjiRuns(scriptRunPieces(sentenceJa))))
}

export interface EvalGenSegmentsRepairResult {
  /** 모델이 낸 조각이 계약을 지켜 그대로 둔 문항 수. */
  kept: number
  /** 조각이 없거나 계약을 못 지켜 코드가 `sentenceJa` 에서 다시 만든 문항 수. */
  derived: number
  /** 다시 만들어도 계약을 못 채워 `segments` 를 지우고 위반으로 남긴(재시도로 넘긴) 문항 수. */
  unresolved: number
}

/**
 * CORRECTION_SPOT 문항마다 `prompt.segments` 를 계약에 맞게 만든다(in-place, `extraCheck` 가 `checkEvalGenResponse` 앞에서 부른다).
 * ① 모델이 낸 조각이 `checkCorrectionSpotSegments` 를 통과하면 **그대로 둔다**(모델이 어절을 더 잘 나눈다 — 히라가나 위주 N5 문장 등).
 * ② 없거나 위반이면 `splitSentenceIntoSegments(sentenceJa)` 로 채운다(새 글자를 지어내지 않고 원문을 끊기만 하므로 안전).
 * ③ 그래도 계약을 못 채우면(문장이 너무 짧거나 히라가나뿐) `segments` 를 지워 `checkEvalGenResponse` 가 재시도를 요구하게 한다.
 * `wrongSpan`·`sentenceJa`·`correctedJa` 는 건드리지 않는다(정답·원문 무수정).
 */
export function repairEvalGenCorrectionSegments(data: EvalGenResponse): EvalGenSegmentsRepairResult {
  const r: EvalGenSegmentsRepairResult = { kept: 0, derived: 0, unresolved: 0 }
  for (const it of data.items) {
    if (it.kind !== 'CORRECTION_SPOT') continue
    const { sentenceJa } = it.prompt
    const { wrongSpan } = it.expected
    if (it.prompt.segments !== undefined && checkCorrectionSpotSegments(sentenceJa, it.prompt.segments, wrongSpan).length === 0) {
      r.kept++
      continue
    }
    const derived = splitSentenceIntoSegments(sentenceJa)
    if (checkCorrectionSpotSegments(sentenceJa, derived, wrongSpan).length === 0) {
      it.prompt.segments = derived
      r.derived++
    } else {
      delete it.prompt.segments
      r.unresolved++
    }
  }
  return r
}

// ── EVAL_GRADE(A7) 후검증 + 마무리(클램프·누락 0점) ─────────────────────────

export interface CheckEvalGradeInput {
  /** 이번 평가에서 채점 대상인 서술형 문항의 `order` 목록(입력 그대로, 코드가 정함). */
  allowedOrders: number[]
}

/** `order ⊆ 입력`·중복 없음·엔진명 누출만 본다 — 개수(누락)는 위반으로 보지 않는다(`finalizeEvalGradeItems` 가 0점으로 채운다, task-011 Leader's Plan L3). */
export function checkEvalGradeResponse(input: CheckEvalGradeInput, data: EvalGradeResponse): string[] {
  const v: string[] = []
  const allowed = new Set(input.allowedOrders)
  const seen = new Set<number>()
  data.items.forEach((it, i) => {
    if (!allowed.has(it.order)) v.push(`items[${i}].order ${it.order} 는 이번 서술형 문항 목록에 없는 값이다`)
    if (seen.has(it.order)) v.push(`items[${i}].order ${it.order} 가 다른 항목과 중복이다`)
    seen.add(it.order)
  })
  const texts = [data.comment_ko, ...data.next_focus, ...data.items.map((it) => it.feedback_ko)]
  if (texts.some((t) => llm.mentionsEngineIdentity(t))) v.push('응답 어딘가에 엔진·모델 이름이 노출됐다')
  return v
}

const EVAL_GRADE_FALLBACK_FEEDBACK_KO = '이 문항은 채점 결과를 받지 못해 0점으로 처리했습니다.'

/**
 * 최종 문항별 점수(코드 후검증, task-011 Leader's Plan L3 "범위 클램프·누락 문항 0점·order ⊆ 입력"). `allowedOrders`
 * 각각에 대해 정확히 하나씩 돌려준다(오름차순) — `data.items` 에 없으면 0점으로 채우고, 있으면 점수를 0~10 정수로
 * 자른다(ajv 가 이미 그 범위를 강제하지만, `softExtraCheck` 경로로 검증을 통과하지 못한 데이터가 넘어올 수도 있어
 * 여기서 한 번 더 지킨다). **총점(`total`)은 여기서 계산하지 않는다** — 객관식 코드 채점 결과(#67)까지 합쳐 라우트가
 * `Σscore/Σmax×100` 으로 낸다(LLM 이 낸 `total` 은 애초에 스키마에 없어 받지도 않는다).
 */
export function finalizeEvalGradeItems(input: { allowedOrders: number[] }, data: EvalGradeResponse): EvalGradeItemOut[] {
  const byOrder = new Map(data.items.map((it) => [it.order, it]))
  return [...input.allowedOrders]
    .sort((a, b) => a - b)
    .map((order) => {
      const found = byOrder.get(order)
      if (!found) return { order, score: 0, feedback_ko: EVAL_GRADE_FALLBACK_FEEDBACK_KO }
      const score = Math.min(10, Math.max(0, Math.round(found.score)))
      const feedback_ko = found.feedback_ko.trim() || EVAL_GRADE_FALLBACK_FEEDBACK_KO
      return { order, score, feedback_ko }
    })
}

/** 루브릭 5차원 방어적 클램프(같은 이유로 `finalizeEvalGradeItems` 와 짝) — 누락 차원은 0. */
export function clampRubric(rubric: Partial<EvalRubric> | null | undefined): EvalRubric {
  const out = {} as EvalRubric
  for (const d of EVAL_DIMS) {
    const raw = rubric?.[d]
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
    out[d] = Math.min(5, Math.max(0, n)) as EvalRubric[typeof d]
  }
  return out
}
