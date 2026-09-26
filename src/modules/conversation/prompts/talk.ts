/**
 * A1 회화 턴(TALK) 프롬프트 — design-spec §8 A1, tutor.md §3·§6.
 * 예산: 페르소나(절 1·3·4(수준 행)·6(TALK 행))는 `--agents` 시스템 프롬프트, 사용자 프롬프트(오늘·모드·학습자 헤더 ≤300·창·발화)는 ≤3,000자.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkTalkResponse } from '../structuredResponse/checks'
import { TALK_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'
import { buildWindow, type WindowMessage } from '../window'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const TALK_PROMPT_VERSION = 'talk@v1'
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
    '[지시] [입력]의 학습자 말에 선생님으로서 답하세요([대화]는 앞선 맥락입니다).',
    '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 **최대 2문장** — ① 짧은 반응 한 문장 ② 대화를 잇는 질문 한 문장. 교정 설명·「〜ではなく」 같은 고쳐 말하기는 replyJa 에 넣지 않습니다(그건 correction 에만). replyReading 은 replyJa 전체의 히라가나 읽기, replyKo 는 한국어 번역.',
    '- correction: [입력]의 학습자 말에 오류가 있으면 가장 중요한 1건만, 없으면 null. original 에는 [입력]의 학습자 말 **전체**를 한 글자도 바꾸지 말고 그대로 복사하고(일부만 잘라 쓰지 않음), corrected 에 고친 문장을 둡니다. explanationKo 는 한국어로 어느 조각이 왜 틀렸는지 1~2문장.',
    '- learning.grammarPoint 는 이번 턴의 핵심 문법(없으면 null), difficulty 는 학습자 수준. speech.style 은 답의 분위기. 주제가 자연스럽게 끝났으면 endOfTopic=true. proposals 는 학습자가 모르는 새 단어를 단어장에 넣자고 제안할 때만(최대 2개, 보통 빈 배열).',
    INJECTION_GUARD,
  ].join('\n')
}

export function buildTalkRequest(input: TalkInput): LlmJsonRequest<TutorResponse> {
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
