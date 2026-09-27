/** 채팅 화면의 브라우저 저장소 키. 읽기·쓰기는 `@/components/common/storage`(try/catch 공용 헬퍼). */
export const KEYS = {
  readingDefault: 'kaiwa.chat.readingDefault',
  draft: (chatId: string) => `kaiwa.chat.draft.${chatId}`,
  nudge: (chatId: string) => `kaiwa.chat.nudge.${chatId}`,
  reviewJob: (chatId: string) => `kaiwa.review.job.${chatId}`,
} as const
