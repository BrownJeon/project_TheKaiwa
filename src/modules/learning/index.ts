/**
 * L3 Learning Platform — 공개 API(module-dependency L3). task-005: 출석. task-006: 단어 저장 최소판·오류 통계·학습 기록(채택 경로)·DAILY 스냅샷·주제 읽기.
 * task-008: 단어장(목록·상세·수정·삭제·보관·카테고리·기본 팩·A10 보강 실행)·오늘의 단어(세트 생성·답·끝내기·보관·다시 풀기·통계).
 * conversation·speech 를 import 하지 않는다(라우트가 조합). 쓰기 함수는 라우트가 연 트랜잭션(`tx`)을 받는다.
 */
export { checkIn, listMonth, computeStreak } from './attendance'
export {
  createWord, parseWordInput, toWordDto, PARTS_OF_SPEECH, WORD_SORTS, findWordIdBySurface, isBlankMeaning, parseEnrichSurface, parseWordListQuery, listWords, getWordDetail,
  parseWordPatch, updateWord, deleteWord, setWordArchived, listCategories,
} from './vocab/words'
export type { WordInput, WordDto, WordListQuery, WordSort, WordDetail, WordPatch, CategoryCount } from './vocab/words'
export { SEED_PACKS, parseSeedPackBody, addSeedPack } from './vocab/seedPack'
export type { SeedPack } from './vocab/seedPack'
export { enrichWord } from './vocab/enrich'
export type { WordEnrichOutput, WordDraft } from './vocab/enrich'
export {
  parseCreateSessionBody, createVocabSession, parseSessionListQuery, listVocabSessions, getVocabSession, parseAttemptBody, recordAttempt,
  finishVocabSession, parseKeepBody, keepVocabSession, replayVocabSession, SET_COUNT_MIN, SET_COUNT_MAX,
} from './vocab/sessions'
export type {
  VocabSessionDto, VocabCardDto, CreateSessionResult, SessionSummaryDto, AttemptInput, AttemptResultDto, FinishResultDto, EmptyReason,
} from './vocab/sessions'
export { parseStatsDays, getVocabStats } from './vocab/stats'
export type { VocabStatsDto } from './vocab/stats'
export { recordErrorStat, getErrorStats, errorPatternFor } from './learningHistory'
export type { ErrorStat } from './learningHistory'
export { recordStudyLog, recordAcceptedChatLog, recordCorrectionAccepted } from './studyLog'
export type { StudyLogEntry, AcceptedChatLogInput } from './studyLog'
export { bumpDailySnapshot, mergeDaily, emptyDaily } from './snapshots'
export type { DailyData, DailyDelta, VocabSessionSnapshotData } from './snapshots'
export { getTopicRef } from './topics'
export { topicExists, lessonExists } from './refs'
