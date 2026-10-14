/**
 * L3 Learning Platform — 공개 API(module-dependency L3). task-005: 출석. task-006: 단어 저장 최소판·오류 통계·학습 기록(채택 경로)·DAILY 스냅샷·주제 읽기.
 * task-008: 단어장(목록·상세·수정·삭제·보관·카테고리·A10 보강 실행)·오늘의 단어(세트 생성·답·끝내기·보관·다시 풀기·통계).
 * task-010: 주제 목록(#56)·오늘의 회화(#58~#62·#62a~#62c — 생성 잡·진행·완료 트랜잭션·메모 후보·말하기 확인·오디오 문장)·
 * 반복 학습 항목 등록(`registerRepetitionItems`, 010b 가 교정·단어 경로에서 재사용).
 * conversation·speech 를 import 하지 않는다(라우트가 조합). 쓰기 함수는 라우트가 연 트랜잭션(`tx`)을 받는다.
 */
export { checkIn, listMonth, computeStreak } from './attendance'
// task-068: 기본 단어는 공용 읽기 전용 행(#46b 기본 단어 넣기 폐지), 사용자별 상태·보관은 UserWordState — 보이는 범위 도우미는 vocab/wordState
export {
  createWord, parseWordInput, toWordDto, PARTS_OF_SPEECH, WORD_SORTS, WORD_CHUNK_TYPES, WORD_SOURCE_FILTERS, assertEnrichSurfaceFree, isBlankMeaning,
  parseEnrichSurface, parseWordListQuery, listWords, getWordDetail, parseWordPatch, updateWord, deleteWord, setWordArchived, listCategories,
} from './vocab/words'
export type {
  WordInput, WordDto, WordOrigin, WordChunkType, WordSourceFilter, WordListQuery, WordListPage, WordSort, WordDetail, WordPatch, CategoryCount, CreateWordOptions,
} from './vocab/words'
export { visibleWordWhere, notArchivedBy, activeWordWhere, loadWordStates, bumpWordStates } from './vocab/wordState'
export type { WordStateRow, WordStateDelta } from './vocab/wordState'
export { enrichWord } from './vocab/enrich'
export type { WordEnrichOutput, WordDraft } from './vocab/enrich'
export {
  parseCreateSessionBody, createVocabSession, parseSessionListQuery, listVocabSessions, getVocabSession, parseAttemptBody, recordAttempt,
  finishVocabSession, finishVocabSessionDetailed, parseKeepBody, keepVocabSession, replayVocabSession, SET_COUNT_MIN, SET_COUNT_MAX,
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
// ── task-012 달력(#70·#71)·학습 기록 목록·삭제(#72·#73) — 대화 원본 존재 확인은 라우트가 `refs` 로 넘긴다 ──
export { getCalendar, getDay, parseCalendarMonth, parseDayDate, listStudyLogs, deleteStudyLog, parseStudyLogQuery, STUDY_TYPES, STUDY_LOG_RANGE_MAX_DAYS } from './studyLog'
export type { CalendarDto, CalendarDayDto, DayDto, StudyLogDto, StudyLogRefs, StudyLogListQuery } from './studyLog'
export { bumpDailySnapshot, mergeDaily, emptyDaily } from './snapshots'
export type { DailyData, DailyDelta, VocabSessionSnapshotData, LessonSnapshotData } from './snapshots'
export { getTopicRef, listTopics, parseTopicQuery } from './topics'
// task-045 REV-152a M-1 — #28 새 채팅 저장의 주제 FK 위반(P2003) → 404 TOPIC_GONE
export { mapTopicGone } from './topics/visible'
export type { TopicDto, TopicChunkDto, TopicQuery } from './topics'
// task-045 T2 — #57 내 주제 만들기 · #171 고치기
export { createUserTopic, defaultTopicWriteDeps } from './topics/create'
export type { TopicWriteDeps } from './topics/create'
export { updateUserTopic } from './topics/update'
export { topicExists, lessonExists } from './refs'
// ── task-010 오늘의 회화 · 반복 학습 항목 ──
export * from './lessons'
export { registerRepetitionItems, repetitionRefId, normalizeRefText, clampInterval, REPETITION_LESSON_ITEM_CAP, REPETITION_FOCUS_FEEDBACK, repetitionSourceOf } from './repetition'
export type { RepetitionItemInput, RegisteredItem, RepetitionRefType, RepetitionSource } from './repetition'
// ── task-010b 반복 학습 — A11 판단 잡(라우트가 conversation 으로 만든 함수 묶음을 넘긴다)·오늘의 복습(#58·#63·#64)·완료 뒤 판단 ──
export { scheduleReviewDecision, REVIEW_FALLBACK_REASON_KO } from './repetition/decision'
export type { ReviewDecisionDriver, ReviewDecisionMaterials, ReviewDecisionCandidate, ReviewDecisionPlan, ReviewDecisionPlanItem, ReviewDecisionTrigger } from './repetition/decision'
export { REVIEW_FALLBACK_RATIONALE_KO, reviewSessionSize } from './repetition/review'
export type { ReviewGuard, NextReviewGroup } from './repetition/review'
export { skipReview, startReview, loadReviewMixMaterials, afterStudyCompleted, isReviewId } from './reviewSchedule'
export type { TodayReviewState, TodayReviewDto, ReviewItemDto, LessonNextReview, TodayNextReview, ReviewMixMaterials, ReviewMixMaterialItem, StartReviewResult } from './reviewSchedule'
// ── task-011 AI 평가(#65~#69·#67a·#67b) — A6·A7 요청은 라우트가 conversation 으로 만들어 넘긴다 ──
export * from './evaluation'
// ── task-010c 학습 관측(append-only, 호출자 tx) — 코치 자기수정이 첫 사용처, 010b 가 단어·교정·레슨 관측을 더한다 ──
export { recordObservations, observationRow, OBSERVATION_SKILL, OBSERVATION_META_MAX, correctionSkill } from './observations'
export type { ObservationInput } from './observations'
// ── task-010b 교정 사건 관측(제안·채택·거절) — Correction 은 L2 라 라우트·훅이 값으로 넘겨 같은 tx 에 쓴다 ──
export { recordCorrectionsProposed, registerAcceptedCorrection, recordCorrectionIgnored } from './observations/corrections'
export type { CorrectionEventInput, AcceptedCorrectionInput } from './observations/corrections'
// ── Phase 2 — 챌린지(task-041)·상황 역할극(task-010d) 공개 API 는 각 하위 index.ts 에만 더한다(이 파일은 이 두 줄 그대로) ──
export * from './challenges'
export * from './scenarios'
// ── task-045 시드 사용자별 관리(UserSeedOverride) — 공개 API 는 seedOverride/index.ts 에만 더한다 ──
export * from './seedOverride'
// ── task-064 ASK 기록 조회(recordRetrieval — conversation askRouter 가 읽는 5번째 공개 읽기) — 공개 API 는 recordRetrieval/index.ts 에만 더한다 ──
export * from './recordRetrieval'
