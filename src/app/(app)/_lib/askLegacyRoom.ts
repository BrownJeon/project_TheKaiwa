import { askChatHref, isAskId } from '@/components/ask/logic'

/**
 * 옛 지난 대화 주소 `/ask/<id>`(task-064·066) → 질문 탭 `/ask?chat=<id>`(task-067 D5). 형식 검사·주소 모양은 탭이 `?chat=` 을 읽는 규칙
 * (`isAskId`·`askChatHref`)을 그대로 쓴다. DB 를 보지 않는 문자열 변환이라 없는 id·남의 id 도 같은 모양으로 넘어가고(존재 여부가 드러나지 않는다),
 * 소유 확인은 탭이 #29 로 한다. 형식이 아닌 값은 탭이 어차피 버리므로 쿼리 없이 `/ask`(새 빈 대화)로 보낸다.
 */
export function legacyAskRoomTarget(chatId: unknown): string {
  return isAskId(chatId) ? askChatHref(chatId) : '/ask'
}
