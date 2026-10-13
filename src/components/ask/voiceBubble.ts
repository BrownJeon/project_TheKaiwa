/**
 * 말로 물은 질문 말풍선 도우미(task-066 §26-7 F) — 순수. `AskRoom`(U1)이 import 만 한다.
 * 「말로 물었다」 = USER 메시지의 `inputSource === 'REALTIME_STT'`(서버가 받은 값 그대로 저장해 #29 로 돌려준다).
 */
import type { ChatMessageView } from '@/types/chat'

type Msg = Pick<ChatMessageView, 'id' | 'role' | 'content' | 'inputSource'>

export function isVoiceQuestion(m: Pick<Msg, 'role' | 'inputSource'>): boolean {
  return m.role === 'USER' && m.inputSource === 'REALTIME_STT'
}

/** [고쳐서 묻기]를 달 말풍선 — **마지막 USER 메시지**가 말로 물은 것일 때만 그 id(글자 질문이 뒤에 있으면 null). 답이 그 뒤에 있어도 같다. */
export function lastUserVoiceId(messages: readonly Msg[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'USER') continue
    return isVoiceQuestion(m) ? m.id : null
  }
  return null
}

/** 읽기 층(히라가나·한글)을 요청할 말 질문 글 — 중복 없이, 빈 글 제외. 답 예문 줄과 합쳐 `useAnnotations` 한 번에 넘긴다. */
export function voiceQuestionTexts(messages: readonly Msg[]): string[] {
  const out = new Set<string>()
  for (const m of messages) if (isVoiceQuestion(m) && m.content.trim() !== '') out.add(m.content)
  return [...out]
}
