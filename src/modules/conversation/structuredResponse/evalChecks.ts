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
 * 스키마가 표현 못 하는 다섯 가지: ① kind 별 정확한 개수(draft-07 이라 `minContains` 불가, evalSchemas.ts 주석)
 * ② READING_INPUT `accepted ⊇ {reading}` ③ USAGE_CHOICE 빈칸 표시(`___`) ④ ASSEMBLE `order` 가 `pieces` 의 순서만
 * 바꾼 것인지(다중집합 동일) ⑤ CORRECTION_SPOT `wrongSpan` 이 `sentenceJa` 의 리터럴 부분 문자열인지. 그 위에 재료
 * 비율(60%)·14일 중복·엔진명 누출도 여기서 본다.
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
