/**
 * A1 역할극 모드 `[상황]` 헤더 — task-010d A1-PE(`talkScenario@v1`). `buildTalkRequest({ scenario })` 가 쓴다(talk.ts 가 이 파일을 import 한다 — 반대는 없다).
 *
 * 설계 원칙
 *  - **stdin 쪽에만 얹는다**(`system`). persona(`--system-prompt`)는 (model, level, mode) 로만 정해지는 불변 조건 그대로 — 예열 CLI 재사용이 깨지지 않는다.
 *  - **하드 상한**: 상황 JSON 이 아무리 길어도(사용자가 고친 AI 초안 포함) 블록은 `SCENARIO_BLOCK_MAX`(460자)를 넘지 않는다. 항목별 상한(`LIMITS`)과 3단 축약(FULL → COMPACT →
 *    MINIMAL)이 그 보증이다. 어느 단계를 쓸지는 호출 쪽 예산(요청 3,000자에서 나머지 블록·이번 발화·최소 이력 자리를 뺀 값)이 정한다 — 발화가 길수록 블록이 줄어든다.
 *  - **표현 id 는 싣지 않는다.** D-4(Leader): 대화 중 진행 값은 서버가 코드로 계산하고 A1 응답에 칸을 더하지 않으므로 모델이 id 를 낼 일이 없다. 표기(`ja`)만 싣는다. id·뜻(`ko`)은
 *    입력 타입에 남겨 둔다(종료 판정 `scenarioVerdict` 가 같은 입력 모양을 쓴다).
 *  - 상황 글은 DB·사용자 초안에서 오므로 줄바꿈·제어문자를 공백으로 접어 줄을 위조하지 못하게 한다(`[지시]` 같은 가짜 머리말 방지). 안의 지시문을 따르지 않는 가드는 talk.ts 의 `INJECTION_GUARD` 가 이미 있다.
 *  - 첫마디(`opening`)는 서버가 이미 저장한다(D-3). 모델이 반복하지 않도록 **있다는 사실만** 한 구절로 알린다(본문은 [대화]에 이미 있다 — 창이 밀려 보이지 않아도 반복할 이유가 없다).
 */

export const TALK_SCENARIO_PROMPT_VERSION = 'talkScenario@v1'

/** `[상황]` 블록 하드 상한(learning-personalization §1-4 "≤400자" 를 실측 자수에 맞춰 60자 여유). */
export const SCENARIO_BLOCK_MAX = 460

export interface TalkScenarioExpression {
  /** `readScenarioExpressions` 결과 id — A1 은 싣지 않고 종료 판정이 쓴다. */
  id: string
  ja: string
  ko?: string | null
}

/** 호출부(A3b)가 `Scenario` 행을 읽어 만드는 정규화된 입력. 글자 수는 이 파일이 자른다. */
export interface TalkScenarioInput {
  roles: { learner: string; tutor: string }
  goalKo: string
  successCriteria?: readonly string[]
  steps?: readonly { ko: string }[]
  expressions: readonly TalkScenarioExpression[]
  /** 필수 표현 수(`scenarioRequiredExpressions` 결과). */
  requiredExpressions: number
  /** 서버가 이미 저장한 첫마디(없으면 학습자가 먼저 말을 건다). 본문은 프롬프트에 싣지 않고 있는지 여부만 쓴다. `readScenarioOpening` 결과(`{ja, ko}`)를 그대로 줘도 된다. */
  opening?: string | { ja?: string | null } | null
}

const hasOpening = (o: TalkScenarioInput['opening']): boolean => (typeof o === 'string' ? o.trim().length > 0 : Boolean(o && typeof o.ja === 'string' && o.ja.trim()))

export type ScenarioBlockTier = 'FULL' | 'COMPACT' | 'MINIMAL'

/** 단계별 항목 상한(코드포인트). 합산이 `SCENARIO_BLOCK_MAX` 안이 되도록 정했다(테스트가 최대 입력으로 확인). */
const LIMITS: Record<ScenarioBlockTier, { role: number; goal: number; criteria: [number, number]; steps: [number, number]; expressions: [number, number] }> = {
  FULL: { role: 12, goal: 48, criteria: [3, 22], steps: [5, 18], expressions: [5, 18] },
  COMPACT: { role: 10, goal: 40, criteria: [0, 0], steps: [4, 14], expressions: [4, 14] },
  MINIMAL: { role: 6, goal: 28, criteria: [0, 0], steps: [0, 0], expressions: [3, 10] },
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'] as const

/** 줄바꿈·제어문자·연속 공백을 한 칸 공백으로, 코드포인트 기준으로 자르고 잘렸으면 `…`. 빈 글은 null. */
export function clipScenarioText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  const cps = Array.from(clean)
  return cps.length <= max ? clean : `${cps.slice(0, Math.max(1, max - 1)).join('')}…`
}

function renderTier(s: TalkScenarioInput, tier: ScenarioBlockTier): string {
  const L = LIMITS[tier]
  const tutor = clipScenarioText(s.roles?.tutor, L.role) ?? '상대'
  const learner = clipScenarioText(s.roles?.learner, L.role) ?? '학습자'
  const goal = clipScenarioText(s.goalKo, L.goal) ?? '대화를 이어 가기'
  const lines = [`[상황] 역할극 선생님 「${tutor}」·학습자 「${learner}」. 목표: ${goal}`]
  const criteria = (s.successCriteria ?? []).map((c) => clipScenarioText(c, L.criteria[1])).filter((c): c is string => Boolean(c)).slice(0, L.criteria[0])
  if (criteria.length) lines.push(`성공 조건: ${criteria.join(' / ')}`)
  const steps = (s.steps ?? []).map((st) => clipScenarioText(st?.ko, L.steps[1])).filter((c): c is string => Boolean(c)).slice(0, Math.min(L.steps[0], CIRCLED.length))
  if (steps.length) lines.push(`순서: ${steps.map((st, i) => `${CIRCLED[i]}${st}`).join(' ')}`)
  const exprs = (s.expressions ?? []).map((e) => clipScenarioText(e?.ja, L.expressions[1])).filter((c): c is string => Boolean(c)).slice(0, L.expressions[0])
  if (exprs.length) {
    const total = Math.min(Math.max(0, s.expressions.length), 12)
    const req = Math.max(0, Math.min(total, Math.floor(Number.isFinite(s.requiredExpressions) ? s.requiredExpressions : 0)))
    lines.push(`핵심 표현(${req}개 이상 쓰면 성공): ${exprs.join('・')}`)
  }
  lines.push(hasOpening(s.opening) ? '시작: 첫마디는 이미 했음(반복 금지)' : '시작: 학습자가 먼저 말을 검')
  return lines.join('\n')
}

/**
 * `[상황]` 블록 — `maxChars` 안에 드는 가장 풍부한 단계. MINIMAL 도 안 들면 MINIMAL 을 그대로 돌려준다(MINIMAL 의 최대 자수는 테스트가 고정).
 * 호출 쪽이 `Math.min(SCENARIO_BLOCK_MAX, 남은 예산)` 을 넘긴다.
 */
export function renderScenarioBlock(s: TalkScenarioInput, maxChars: number = SCENARIO_BLOCK_MAX): { text: string; tier: ScenarioBlockTier } {
  const cap = Math.min(SCENARIO_BLOCK_MAX, Math.floor(maxChars))
  for (const tier of ['FULL', 'COMPACT'] as const) {
    const text = renderTier(s, tier)
    if (text.length <= cap) return { text, tier }
  }
  return { text: renderTier(s, 'MINIMAL'), tier: 'MINIMAL' }
}
