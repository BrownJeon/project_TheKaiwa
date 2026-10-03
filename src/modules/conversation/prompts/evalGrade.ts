/**
 * A7 평가 채점(EVAL_GRADE) — design-spec §7-5·§8 A7 행, api-contract #68, task-011 Leader's Plan L3.
 * 서술형(LISTEN_RESPOND·SITUATION_RESPOND·CORRECTION_SPOT)만 채점 대상이고, 객관식(WORDS 전부 + TALK 의 ASSEMBLE)은
 * 이미 코드가 채점을 끝낸 뒤라 **요약**(`objectiveSummary`)으로만 넘긴다 — WORDS 평가처럼 서술형이 0개여도 루브릭
 * 5차원(정확성·어휘·문법·자연스러움·조각 조립)·comment_ko·next_focus 는 항상 필요해서(#66 result 예시), A7 은
 * "서술형 문항·답"뿐 아니라 이 요약까지 함께 보고 전체를 평가한다(design-spec 표의 "서술형 문항·답"을 좁게 해석하면
 * WORDS 평가의 루브릭 근거가 사라진다 — 이 확장은 prompt-engineer 판단, task history 에 기록).
 *
 * **총점(`total`)은 스키마에 없다** — `EVAL_GRADE_SCHEMA` 가 `additionalProperties:false` 라 모델이 붙여도 버려지고,
 * 프롬프트도 "계산하지 마라"고 명시한다. 총점은 라우트가 객관식 실제 점수(#67) + 이 모듈의 `finalizeEvalGradeItems`
 * 결과를 합쳐 `Σscore/Σmax×100` 으로 낸다(task-011 목표 "LLM total 무시").
 *
 * **v3(2026-10-01, task-011 (f)=A — 틀린 곳 찾기를 "문장 조각 탭 선택"으로)**: 입력 모양(`answerText: string`)은 그대로 두고,
 * CORRECTION_SPOT 답이 조각을 눌러 고른 경우 learning 이 한 줄 `고른 곳 「…」 / 고친 말·이유: …` 로 넘기는 것을 읽도록 지시문을
 * 더했다(조각 없이 적은 옛 문항·음성 답은 예전처럼 자유 글). 고른 조각이 정답 자리인지는 LLM 이 글자 겹침을 어림하지 않게
 * **코드가 `prompt.segments` 와 `wrongSpan` 으로 미리 계산해 문항 줄에 「정답 조각」으로 싣는다**(`findWrongSegmentRange`).
 * wrongSpan 이 조각 둘에 걸칠 수 있어 고른 조각 하나가 그중 어느 쪽이든 정답으로 인정한다. 「고친 말·이유」는 한국어 이유도
 * 허용하므로 "일본어가 아니면 0~2" 규칙의 예외다.
 * 실측(2026-10-01, 루브릭 28건)에서 정답 조각이 둘(「飲む」「たいです。」)일 때 LLM 이 앞 조각만 정답으로 읽어 뒤 조각을 고른
 * 답을 5점으로 깎았다 → **고른 조각이 정답 조각과 일치하는지는 코드가 판정해 한 줄(`고른 곳 판정`)로 싣고** LLM 은 그대로 따른다
 * (`judgeSpotPick`). 한국어 이유만 쓴 답은 4~6 으로 못 박는 문구를 더 단단히 했다.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkEvalGradeResponse, findWrongSegmentRange } from '../structuredResponse/evalChecks'
import {
  buildEvalGradeSchema,
  EVAL_DIMS,
  type EvalCorrectionSpotItem,
  type EvalGradeResponse,
  type EvalKind,
  type EvalListenRespondItem,
  type EvalSituationRespondItem,
} from '../structuredResponse/evalSchemas'
import type { JlptLevel } from '../structuredResponse/schemas'
import { INJECTION_GUARD } from './header'

export const EVAL_GRADE_PROMPT_VERSION = 'evalGrade@v3'
/** 학습자 답(#67 `answerText` 상한 2,000자) 렌더 상한 — 실제 발화·타이핑 답은 훨씬 짧다, 방어적 절단. */
export const EVAL_GRADE_ANSWER_RENDER_MAX = 600
/** 배치(120s) 잡. 서술형 최대 5개(TALK: LISTEN_RESPOND2+SITUATION_RESPOND2+CORRECTION_SPOT1) × 답 600자 최악 조합도
 * 넉넉히 담는다 — `__tests__/evalGrade.test.ts` 예산 회귀. */
export const EVAL_GRADE_USER_PROMPT_CAP = 8_000

export type EvalGradeSubjectiveKind = 'LISTEN_RESPOND' | 'SITUATION_RESPOND' | 'CORRECTION_SPOT'

export interface EvalGradeSubjectiveItem {
  order: number
  kind: EvalGradeSubjectiveKind
  prompt: EvalListenRespondItem['prompt'] | EvalSituationRespondItem['prompt'] | EvalCorrectionSpotItem['prompt']
  expected: EvalListenRespondItem['expected'] | EvalSituationRespondItem['expected'] | EvalCorrectionSpotItem['expected']
  /** 학습자 답(REALTIME_STT 최종 텍스트 또는 TEXT 입력). 미답이면 빈 문자열. */
  answerText: string
}

export interface EvalGradeObjectiveSummary {
  kind: string
  correct: number
  total: number
}

export interface EvalGradeInput {
  evalKind: EvalKind
  level: JlptLevel
  /** 코드가 이미 채점한 객관식 결과 요약(WORDS 전부 + TALK 의 ASSEMBLE). 없으면 빈 배열. */
  objectiveSummary: EvalGradeObjectiveSummary[]
  /** 서술형 문항(순서는 호출자 자유, 렌더는 order 오름차순으로 정렬한다). 0개면 WORDS 평가(객관식 요약만으로 채점). */
  subjectiveItems: EvalGradeSubjectiveItem[]
}

export class EvalGradeInputError extends Error {
  readonly userMessage = '채점할 내용이 없어요.'
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`
}

function renderObjectiveSummary(items: EvalGradeObjectiveSummary[]): string | null {
  if (items.length === 0) return null
  const lines = items.map((s) => `- ${s.kind}: ${s.correct}/${s.total}`)
  return ['[객관식 요약] (이미 코드가 채점을 끝냈습니다 — 참고만 하세요)', ...lines].join('\n')
}

function renderSubjectivePrompt(it: EvalGradeSubjectiveItem): string {
  if (it.kind === 'LISTEN_RESPOND') {
    const p = it.prompt as EvalListenRespondItem['prompt']
    const e = it.expected as EvalListenRespondItem['expected']
    return `들려준 문장 "${clip(p.textJa, 80)}"(지시: ${clip(p.instructionKo, 80)}) — 좋은 응답: ${clip(e.expectedGistKo, 200)}`
  }
  if (it.kind === 'SITUATION_RESPOND') {
    const p = it.prompt as EvalSituationRespondItem['prompt']
    const e = it.expected as EvalSituationRespondItem['expected']
    return `상황 "${clip(p.situationKo, 200)}" — 좋은 응답: ${clip(e.expectedGistKo, 200)}`
  }
  const p = it.prompt as EvalCorrectionSpotItem['prompt']
  const e = it.expected as EvalCorrectionSpotItem['expected']
  const range = Array.isArray(p.segments) ? findWrongSegmentRange(p.segments, p.sentenceJa, e.wrongSpan) : null
  const spotChips = range && p.segments ? `${p.segments.slice(range.from, range.to + 1).map((c) => `「${clip(c, 40)}」`).join('')}` : ''
  const chipsPart = spotChips ? `, 정답 조각 ${spotChips}` : ''
  return `문장 "${clip(p.sentenceJa, 120)}" 의 틀린 곳("${clip(e.wrongSpan, 40)}"${chipsPart}) 찾기 — 정답: ${clip(e.correctedJa, 120)}`
}

/** learning 이 조각을 골랐을 때 넘기는 한 줄(`고른 곳 「…」 / 고친 말·이유: …`)에서 고른 조각 글자를 꺼낸다. 이 모양이 아니면 null. */
const SPOT_PICK_RE = /^고른 곳 「([\s\S]*?)」 \/ 고친 말·이유: /

/**
 * 틀린 곳 찾기에서 학습자가 고른 조각이 정답 조각(wrongSpan 과 겹치는 조각들 중 하나)인지 **코드가** 판정한다.
 * `MATCH`/`MISS` = 판정됨, null = 판정할 수 없음(조각 없는 옛 문항·자유 글 답·조각이 문항에 없음 — LLM 이 예전처럼 판단).
 * 실측에서 정답 조각이 둘일 때 LLM 이 겹침 규칙을 어긴 사례가 있어 글자 비교는 코드 몫으로 둔다.
 */
export function judgeSpotPick(it: Pick<EvalGradeSubjectiveItem, 'kind' | 'prompt' | 'expected' | 'answerText'>): 'MATCH' | 'MISS' | null {
  if (it.kind !== 'CORRECTION_SPOT') return null
  const p = it.prompt as EvalCorrectionSpotItem['prompt']
  const e = it.expected as EvalCorrectionSpotItem['expected']
  if (!Array.isArray(p.segments)) return null
  const picked = SPOT_PICK_RE.exec(it.answerText.trim())?.[1]
  if (picked === undefined) return null
  const range = findWrongSegmentRange(p.segments, p.sentenceJa, e.wrongSpan)
  if (!range) return null
  if (!p.segments.includes(picked)) return null
  return p.segments.slice(range.from, range.to + 1).includes(picked) ? 'MATCH' : 'MISS'
}

function renderSubjectiveItems(items: EvalGradeSubjectiveItem[]): string | null {
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const lines = sorted.map((it) => {
    const answer = it.answerText.trim() ? clip(it.answerText.trim(), EVAL_GRADE_ANSWER_RENDER_MAX) : '(미답)'
    const verdict = judgeSpotPick(it)
    const verdictLine = verdict === 'MATCH' ? '\n  고른 곳 판정(코드 확인): 정답 조각입니다' : verdict === 'MISS' ? '\n  고른 곳 판정(코드 확인): 정답 조각이 아닙니다' : ''
    return `- order=${it.order} [${it.kind}] ${renderSubjectivePrompt(it)}\n  학습자 답: ${answer}${verdictLine}`
  })
  return ['[서술형 문항]', ...lines].join('\n')
}

function evalGradeInstruction(allowedOrders: number[]): string {
  const rubricLine = EVAL_DIMS.join('·')
  return [
    '[지시] 아래 [객관식 요약]과 [서술형 문항]을 보고 이번 평가 전체를 채점하세요.',
    allowedOrders.length > 0
      ? `- items 배열에는 [서술형 문항]의 order(${allowedOrders.join(', ')}) 각각에 대해 정확히 하나씩 채점 결과를 넣습니다. 학습자가 답하지 않은 문항("(미답)")도 score=0 으로 넣고 feedback_ko 에 그 이유를 씁니다.`
      : '- 이번 평가에는 서술형 문항이 없습니다(WORDS 평가). items 는 빈 배열로 둡니다.',
    '- score 는 0~10 정수 — 내용이 전달되면 0 이 아니게, 정확하고 자연스러울수록 만점에 가깝게 줍니다. feedback_ko 는 무엇이 좋았고 무엇을 고치면 좋을지 한국어 1~2문장(원문을 다시 쓰지 말고 평가만).',
    '- **답이 일본어가 아니면**(한국어·영어 등) 의미가 통하더라도 이 평가는 일본어 표현력을 보는 것이므로 score 는 0~2 로 낮게 줍니다(아래 CORRECTION_SPOT 의 「고친 말·이유」 한국어 이유는 예외).',
    '- CORRECTION_SPOT 은 **틀린 곳을 짚는 것과 고친 문장을 제시하는 것 둘 다** 있어야 완성입니다. 틀린 곳만 짚고 고친 문장(정답 형태)을 전혀 안 썼으면 절반 이하(0~5)로 줍니다.',
    '- CORRECTION_SPOT 답이 `고른 곳 「…」 / 고친 말·이유: …` 모양이면 학습자가 문장 조각 하나를 눌러 틀린 곳을 짚고 고친 말이나 이유를 적은 것입니다. 정답 조각이 둘 이상 적혀 있으면 **그중 어느 하나만 골라도** 바르게 짚은 것입니다. `고른 곳 판정(코드 확인)` 줄이 있으면 그 판정을 그대로 따릅니다(정답 조각입니다 = 바르게 짚음, 정답 조각이 아닙니다 = 짚기 실패라 0~3 이며 고친 말이 맞아도 3 을 넘기지 않습니다). 그 줄이 없으면 「고른 곳」이 정답 조각(없으면 wrongSpan)과 글자가 겹치는지 직접 봅니다. 바르게 짚은 경우: 「고친 말·이유」에 정답 고친 형태(correctedJa)와 같은 고침이 일본어로 들어 있으면 8~10, **고친 일본어 형태 없이 한국어 이유 설명만 있으면 설명이 정확해도 최대 6(4~6)**, 고친 말·이유가 틀리거나 엉뚱하면 3~5. 이 줄의 한국어 이유는 「일본어가 아니면 0~2」 규칙으로 깎지 않습니다. 이 모양이 아니면(조각 없이 자유롭게 적은 답) 위 규칙을 그대로 적용합니다.',
    `- rubric 은 [서술형 문항]뿐 아니라 [객관식 요약]까지 포함해 이번 평가 전체를 보고 ${rubricLine} 을 각각 0~5 로 매깁니다.`,
    '- comment_ko 는 학습자에게 보여줄 총평 한국어 2~3문장(격려를 한 줄 포함). next_focus 는 다음에 연습하면 좋을 항목 0~3개(짧게, 명사구로).',
    '- 발음·억양·말속도는 채점하지 않습니다(텍스트로 옮겨진 답만 봅니다). **총점(total)은 여기서 계산하지 않습니다** — items 와 rubric 만 정확히 채우세요.',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildEvalGradeRequest(input: EvalGradeInput): LlmJsonRequest<EvalGradeResponse> {
  if (input.subjectiveItems.length === 0 && input.objectiveSummary.length === 0) {
    throw new EvalGradeInputError('objectiveSummary 와 subjectiveItems 가 모두 비어 있다')
  }
  const allowedOrders = input.subjectiveItems.map((it) => it.order)
  const persona = loadPersona({ sections: [1, 3, 4, 6], level: input.level, mode: 'EVAL_GRADE' })
  const system = ['[모드] EVAL_GRADE', `[평가 종류] ${input.evalKind} · [난이도] ${input.level}`, evalGradeInstruction(allowedOrders)].join('\n')
  const dataBlock = [renderObjectiveSummary(input.objectiveSummary), renderSubjectiveItems(input.subjectiveItems)].filter((x): x is string => Boolean(x)).join('\n\n')
  const maxOrder = allowedOrders.length > 0 ? Math.max(...allowedOrders) : 0
  return {
    task: 'evalGrade',
    persona,
    system,
    messages: [{ role: 'user', content: dataBlock }],
    jsonSchema: buildEvalGradeSchema(maxOrder, Math.max(allowedOrders.length, 1)),
    extraCheck: (data) => checkEvalGradeResponse({ allowedOrders }, data),
  }
}
