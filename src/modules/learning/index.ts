/**
 * L3 Learning Platform — 공개 API(module-dependency L3). task-005: 출석. task-006: 단어 저장 최소판·오류 통계·학습 기록(채택 경로)·DAILY 스냅샷·주제 읽기.
 * conversation·speech 를 import 하지 않는다(라우트가 조합). 쓰기 함수는 라우트가 연 트랜잭션(`tx`)을 받는다.
 */
export { checkIn, listMonth, computeStreak } from './attendance'
export { createWord, parseWordInput, toWordDto, PARTS_OF_SPEECH } from './vocab/words'
export type { WordInput, WordDto } from './vocab/words'
export { recordErrorStat, getErrorStats, errorPatternFor } from './learningHistory'
export type { ErrorStat } from './learningHistory'
export { recordStudyLog, recordAcceptedChatLog, recordCorrectionAccepted } from './studyLog'
export type { StudyLogEntry, AcceptedChatLogInput } from './studyLog'
export { bumpDailySnapshot, mergeDaily, emptyDaily } from './snapshots'
export type { DailyData, DailyDelta } from './snapshots'
export { getTopicRef } from './topics'
