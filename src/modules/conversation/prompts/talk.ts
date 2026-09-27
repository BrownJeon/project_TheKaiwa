/**
 * A1 회화 턴(TALK) 프롬프트 — design-spec §8 A1, tutor.md §3·§6.
 * 예산: 페르소나(절 1·3·4(수준 행)·6(TALK 행))는 `--agents` 시스템 프롬프트, 사용자 프롬프트(오늘·모드·학습자 헤더 ≤300·창·발화)는 ≤3,000자.
 *
 * task-007 K4(음성 회화 TTFA): 스키마(`structuredResponse/schemas.ts`)·후검증(`checks.ts`)의 필드·제약은 그대로 두고
 * **출력 순서만 지시문으로 민다**(이 두 파일은 이 task 의 소유 경계 밖).
 *  1. JSON 최상위 키 순서 speech → conversation → correction → learning → endOfTopic → proposals, conversation 안은
 *     replyJa → replyReading → replyKo. developer 가 `--include-partial-messages` 스트림에서 `speech.style`(TTS 톤) →
 *     `replyJa`(문장 단위 조기 합성) 순으로 증분 추출하므로 이 둘이 최대한 먼저 나와야 한다.
 *  2. replyJa 첫 문장은 「そうですね。」처럼 아주 짧은 맞장구 — 문장 경계(。！？)가 빨리 나올수록 TTS 첫 청크(TTFA)가 빨라진다.
 *  ⚠ 순서 준수는 모델의 자연어 지시 해석에 달려 있을 뿐이다 — JSON Schema 는 키 순서를 표현하지 못하고, `engine/json/schemaValidate.withJsonOnly`
 *  가 이 프롬프트 뒤에 덧붙이는 원본 스키마 텍스트는 `schemas.ts` 선언 순서(conversation·correction·learning·speech·…) 그대로라
 *  상충 신호가 될 수 있다 — 실측 결과와 상충 메모는 [[llm-japanese-quality]] §6. 강제(재시도)하지 않는다.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkTalkResponse } from '../structuredResponse/checks'
import { TALK_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'
import { buildWindow, type WindowMessage } from '../window'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const TALK_PROMPT_VERSION = 'talk@v2'
export const TALK_USER_PROMPT_CAP = 3_000
export const TALK_HEADER_CAP = 300

export interface TalkInput {
  todayKst: string
  learner: LearnerHeader
  /** 이번 발화 이전의 대화(오래된 것 → 최근). */
  history: WindowMessage[]
  /** 이번 학습자 발화(STT 최종 텍스트 또는 입력). */
  text: string
  /** 인식이 불확실할 때의 두 번째 후보(requiresReview) — 있으면 교정 대신 되묻는다(tutor §3-7). */
  altText?: string | null
}

export function talkInstruction(): string {
  return [
    '[지시] [입력]의 학습자 말에 선생님으로서 답하세요([대화]는 앞선 맥락입니다). **JSON 키 순서를 반드시 지킵니다**: speech → conversation(replyJa→replyReading→replyKo) → correction → learning → endOfTopic → proposals.',
    '- speech.style: 답의 분위기.',
    '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 **최대 2문장** — ① 「そうですね。」「いいですね！」처럼 아주 짧은 맞장구 한 마디 ② 대화를 잇는 반응·질문 한 문장. 교정 설명·「〜ではなく」 같은 고쳐 말하기는 replyJa 에 넣지 않습니다(그건 correction 에만). replyReading 은 replyJa 전체의 히라가나 읽기, replyKo 는 한국어 번역.',
    '- correction: [입력]의 학습자 말에 오류가 있으면 가장 중요한 1건만, 없으면 null. original 에는 [입력]의 학습자 말 **전체**를 한 글자도 바꾸지 말고 그대로 복사하고(일부만 잘라 쓰지 않음), corrected 에 고친 문장을 둡니다. explanationKo 는 한국어로 어느 조각이 왜 틀렸는지 1~2문장.',
    '- learning.grammarPoint 는 이번 턴의 핵심 문법(없으면 null), difficulty 는 학습자 수준. 주제가 자연스럽게 끝났으면 endOfTopic=true. proposals 는 학습자가 모르는 새 단어를 단어장에 넣자고 제안할 때만(최대 2개, 보통 빈 배열).',
    '[순서 예] {"speech":{"style":"<...>"},"conversation":{"replyJa":"<...>","replyReading":"<...>","replyKo":"<...>"},"correction":null,"learning":{"grammarPoint":null,"difficulty":"<...>"},"endOfTopic":false,"proposals":[]}',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildTalkRequest(input: TalkInput): LlmJsonRequest<TutorResponse> {
  // task-007 K4-3(예열 CLI 프로세스 확인): `persona`(→ claudeCli `--system-prompt`)는 (model, level, mode) 로만 정해진다 —
  // 오늘 날짜·학습자 헤더(약점·연속 출석 등 턴마다 바뀔 수 있는 값 포함)·altText·이력 창·이번 발화는 전부 `system`/`messages`
  // (stdin) 쪽으로만 간다. 같은 학습자·같은 수준이 이어지는 한 `--system-prompt` 는 턴마다 바이트 그대로라 developer 의
  // K2-1 예열 프로세스가 재사용할 수 있다 — 이미 그런 구조였고 이번에 고친 내용은 없다(확인만). `buildChatRequest` 도 동일.
  const persona = loadPersona({ sections: [1, 3, 4, 6], level: input.learner.level, mode: 'TALK' })
  const head = [renderToday(input.todayKst), '[모드] TALK', renderHeader(input.learner, TALK_HEADER_CAP)]
  if (input.altText) head.push(`[인식 후보] 학습자 말이 「${input.altText}」로도 들렸습니다. 둘 중 어느 쪽인지 먼저 되묻고 교정하지 마세요.`)
  const system = [...head, talkInstruction()].join('\n')
  // 사용자 프롬프트 상한에서 헤더·지시·발화를 뺀 나머지를 창에 준다(최대 2,000자·6개).
  const room = Math.max(0, Math.min(2_000, TALK_USER_PROMPT_CAP - system.length - input.text.length - 40))
  const window = buildWindow(input.history, { maxCount: 6, maxChars: room })
  return {
    task: 'talk',
    persona,
    system,
    messages: [...window, { role: 'user', content: input.text }],
    jsonSchema: TALK_SCHEMA,
    extraCheck: (data) => checkTalkResponse(input.text, data),
  }
}
