/**
 * A6 평가 출제(EVAL_GEN) — design-spec §7-5·§8 A6 행, api-contract #65, task-011 Leader's Plan L2.
 * 입력 상은 design-spec 이 명시한 대로 **학습자 헤더를 쓰지 않는다**(kind·level·topic?·재료·14일 해시뿐) — TALK 처럼
 * 개인화된 대화가 아니라 "이 수준·이 재료로 문항을 만들라"는 생성 작업이라서다.
 *
 * 14일 중복 회피(`recentHashes`)는 **프롬프트 텍스트에 넣지 않는다** — 해시는 sha1 hex 라 모델이 읽고 피할 수 있는
 * 정보가 아니다(사람이 읽을 수 있는 "최근에 낸 단어 목록"을 주면 오히려 그 단어들 자체를 프롬프트에 실어야 해서
 * 예산·복잡도만 늘고, 그 단어들을 "쓰지 말라"는 지시를 모델이 완벽히 지킨다는 보장도 없다). 대신 코드가 생성 뒤
 * `checkEvalGenResponse` 로 해시를 계산해 겹치면 위반 문구로 **어느 문항이 왜 겹쳤는지** 짚어 1회 재시도한다 —
 * LESSON 의 targetIds 검증과 같은 "생성 후 검증+재시도" 패턴([[llm-japanese-quality]] §8).
 *
 * **v3(2026-09-28, Leader 지시 — developer 스모크: TALK 출제 4회 중 3회 재시도·1회 FAILED)**: `LISTEN_RESPOND`·
 * `SITUATION_RESPOND` 의 `expected.modelReading`(모범 답 문장 전체 읽기)이 히라가나만 허용해 외래어(コーヒー 등)가
 * 있으면 위반이 났다 — `evalSchemas.ts` 의 `EVAL_SENTENCE_READING_PATTERN`(히라가나+가타카나, `lesson@v3` 와 동일
 * 원인·해법)으로 그 두 필드만 넓혔다. `READING_INPUT` 의 단어 읽기는 그대로 히라가나만(판단 근거는 그 상수 옆
 * 주석) — 대신 지시문에 "가타카나 외래어도 히라가나로" 문구를 A10 과 같은 톤으로 보강했다.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkEvalGenResponse, computeEvalItemHash, repairEvalGenChunkTypeSync, repairEvalGenWordLinks } from '../structuredResponse/evalChecks'
import {
  buildEvalGenSchema,
  EVAL_GEN_ITEM_COUNTS,
  EVAL_GEN_TOTAL_ITEMS,
  type EvalGenResponse,
  type EvalItemKind,
  type EvalKind,
} from '../structuredResponse/evalSchemas'
import type { JlptLevel } from '../structuredResponse/schemas'
import { INJECTION_GUARD, renderToday } from './header'

export const EVAL_GEN_PROMPT_VERSION = 'evalGen@v3'
/** Leader's Plan L2 — 코드가 오답 우선 가중으로 고른 재료 상한. */
export const EVAL_GEN_MATERIALS_MAX = 15
/** 배치(60s) 잡이라 A1(3,000)만큼 타이트하지 않지만 무한정 두지 않는다 — `__tests__/evalGen.test.ts` 예산 회귀. */
export const EVAL_GEN_USER_PROMPT_CAP = 4_500

export { computeEvalItemHash }

export interface EvalGenWordCandidate {
  surface: string
  reading: string | null
  meaning: string
  /** 오답 횟수 — 0보다 크면 "우선 사용" 힌트를 함께 보여준다. */
  wrongCount: number
}

export interface EvalGenTopicInput {
  title: string
  titleJa?: string | null
}

export interface EvalGenInput {
  todayKst: string
  kind: EvalKind
  level: JlptLevel
  /** TALK 권장(상황·소재 참고용), 없어도 된다. */
  topic?: EvalGenTopicInput | null
  /** 코드가 이미 고른 재료(오답 우선, `EVAL_GEN_MATERIALS_MAX` 초과분은 여기서 자른다). */
  materials: EvalGenWordCandidate[]
  /** 최근 14일 출제 해시(코드가 과거 `EvaluationItem` 에서 계산) — 프롬프트에는 싣지 않고 `extraCheck` 에서만 쓴다. */
  recentHashes: string[]
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`
}

function renderMaterials(materials: EvalGenWordCandidate[]): string {
  if (materials.length === 0) return '[재료] 없음 — 전부 강사가 이 수준에 맞는 자연스러운 단어·문장으로 새로 만드세요.'
  const lines = materials.map((m) => {
    const reading = m.reading ? `(${clip(m.reading, 40)})` : ''
    const wrong = m.wrongCount > 0 ? ` [오답 ${m.wrongCount}회 — 우선 사용]` : ''
    return `- ${clip(m.surface, 40)}${reading} — ${clip(m.meaning, 60)}${wrong}`
  })
  return ['[재료] (학습자 단어장에서 고른 단어 — 오답이 많을수록 먼저 쓰세요)', ...lines].join('\n')
}

function renderTopic(topic: EvalGenTopicInput): string {
  const titleJa = topic.titleJa ? ` (${clip(topic.titleJa, 40)})` : ''
  return `[주제] ${clip(topic.title, 60)}${titleJa} — TALK 문항의 상황·소재로 참고하세요(꼭 쓸 필요는 없습니다).`
}

function kindRules(kind: EvalKind): string {
  if (kind === 'WORDS') {
    return [
      '- MEANING_CHOICE: prompt.surface(단어 표기)·prompt.reading(히라가나 읽기)·prompt.choices(서로 다른 한국어 뜻 4개, 정답 1개 포함). expected.answer 는 정답 뜻의 인덱스(0~3).',
      '- READING_INPUT: prompt.surface(한자 등 표기)만. expected.reading(정확한 히라가나 읽기)·expected.accepted(허용되는 다른 표기를 포함해 1~5개, reading 자신도 반드시 포함). **surface 가 가타카나 외래어(예: サイズ)여도 reading·accepted 는 항상 히라가나로 적습니다**(さいず — 가타카나를 그대로 옮기지 않습니다).',
      '- USAGE_CHOICE: prompt.sentenceJa(빈칸을 "___" 로 표시한 자연스러운 한 문장)·prompt.choices(자연스러운 후보 4개, 정답 1개). expected.answer 는 정답 인덱스.',
      '- CHUNK_CLASSIFY: prompt.textJa(단어나 짧은 구)·prompt.reading(히라가나, 모르면 null). 정답 조각 유형(NAME·ACTION·FEELING·MODIFIER)을 expected.chunkType 과 top-level chunkType 두 곳에 **똑같이** 적습니다(expected 를 빈 객체로 두지 않습니다).',
    ].join('\n')
  }
  return [
    '- LISTEN_RESPOND: prompt.textJa(학습자가 듣게 될 자연스러운 일본어 문장 — 학습자에게는 글자로 보이지 않고 음성으로만 재생됩니다)·prompt.instructionKo(무엇을 하라는 한국어 지시, 예: "들은 말에 자연스럽게 답해 보세요"). expected.expectedGistKo(좋은 응답이 담아야 할 내용, 한국어 요지)·expected.modelAnswerJa/modelReading(모범 응답 예시 1개 — modelReading 은 히라가나로 쓰되 외래어는 자연스러운 가타카나 표기 그대로 써도 됩니다, 한자·로마자·한글은 쓰지 않습니다).',
    '- ASSEMBLE: prompt.promptKo(무엇을 조립하라는 한국어 지시)·prompt.pieces(3~7개 조각, 순서를 섞어서 나열). expected.order 는 pieces 와 **정확히 같은 조각들**을 올바른 순서로 나열한 배열(새 조각을 더하거나 빼면 안 됩니다).',
    '- SITUATION_RESPOND: prompt.situationKo(상황을 한국어로 설명 — 학습자는 이 상황에 일본어로 답합니다). expected.expectedGistKo·expected.modelAnswerJa/modelReading(LISTEN_RESPOND 와 같은 규칙 — 외래어는 가타카나 표기 허용).',
    '- CORRECTION_SPOT: prompt.sentenceJa(오류가 하나 있는 일본어 문장). expected.wrongSpan(그 문장 안의 틀린 부분을 글자 그대로 인용 — 새로 만들지 않음)·expected.correctedJa(고친 문장 전체)·expected.explanationKo(왜 틀렸는지 한국어 한 줄).',
  ].join('\n')
}

function evalGenInstruction(kind: EvalKind): string {
  const wanted = EVAL_GEN_ITEM_COUNTS[kind]
  const total = EVAL_GEN_TOTAL_ITEMS[kind]
  const countLine = (Object.entries(wanted) as [EvalItemKind, number][]).map(([k, n]) => `${k} ${n}개`).join(' · ')
  return [
    `[지시] 학습자를 위한 ${kind === 'WORDS' ? '단어' : '회화'} 평가 문항 ${total}개를 만드세요. **정확히 다음 개수**여야 합니다: ${countLine}.`,
    '- items 배열의 각 항목은 kind·dims·wordSurface·chunkType·prompt·expected 를 모두 채웁니다. dims 는 accuracy(정확성)·vocabulary(어휘)·grammar(문법)·naturalness(자연스러움)·assembly(조각 조립) 중 이 문항이 주로 재는 것 1~3개.',
    '- wordSurface: [재료] 목록의 단어를 그 문항의 핵심으로 썼으면 그 표기를 **그대로** 적고, 강사가 새로 만든 문항이면 null 입니다. **전체 문항의 60% 이상은 [재료]에서 골라야 합니다**(오답이 많은 단어를 우선 쓰세요).',
    '- chunkType 은 CHUNK_CLASSIFY 문항에서만 정답 조각 유형을 적고, 그 밖의 모든 문항은 null 입니다.',
    kindRules(kind),
    '- 같은 문항 안에서, 그리고 이전에 낸 문항들과 겹치지 않게 다양한 단어·문장·상황을 고르세요.',
    '- 일본어 필드에 한국어를 섞지 않고, 한국어 필드(promptKo·situationKo·instructionKo·explanationKo·expectedGistKo 등)에는 일본어를 섞지 않습니다.',
    '- speaker·모델 이름 같은 엔진 식별 정보는 어디에도 쓰지 않습니다.',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildEvalGenRequest(input: EvalGenInput): LlmJsonRequest<EvalGenResponse> {
  const materials = input.materials.slice(0, EVAL_GEN_MATERIALS_MAX)
  const persona = loadPersona({ sections: [1, 4, 6], level: input.level, mode: 'EVAL_GEN' })
  const system = [renderToday(input.todayKst), '[모드] EVAL_GEN', `[평가 종류] ${input.kind}`, `[난이도] ${input.level}`, evalGenInstruction(input.kind)].join('\n')
  const dataBlock = [input.topic ? renderTopic(input.topic) : null, renderMaterials(materials)].filter((x): x is string => Boolean(x)).join('\n\n')
  const candidateSurfaces = materials.map((m) => m.surface)
  const recentHashes = new Set(input.recentHashes)
  return {
    task: 'evalGen',
    persona,
    system,
    messages: [{ role: 'user', content: dataBlock }],
    jsonSchema: buildEvalGenSchema(input.kind),
    extraCheck: (data) => {
      repairEvalGenWordLinks({ candidateSurfaces }, data)
      repairEvalGenChunkTypeSync(data)
      return checkEvalGenResponse({ kind: input.kind, candidateSurfaces, recentHashes }, data)
    },
  }
}
