/**
 * 오늘의 회화(Lesson) — api-contract #58~#62·#62a~#62c(task-010). 트랜잭션 구조·잠금 순서는 `rows.ts`·`lifecycle.ts` 머리말.
 */
export { parseCreateLessonBody, parseProgressBody, parseCompleteBody, parseMemoBody, parseSpeakingBody, parseAudioBody, isLessonId, LESSON_SOURCE_TEXT_MIN, LESSON_SOURCE_TEXT_MAX } from './validate'
export type { CreateLessonInput, MemoRequestWord, AudioPace } from './validate'
export { loadLessonMaterials, createLesson } from './generate'
export type { LessonMaterials, LessonGeneration, CreateLessonResult, LessonGenKind } from './generate'
export { getLesson, assertOwnedLesson, updateLessonProgress, completeLesson, completeLessonDetailed, LESSON_COMPLETE_MIN_STAGE } from './lifecycle'
export type { CompleteLessonResult, CompleteLessonOptions, LessonDetailDto } from './lifecycle'
export { getTodayLessons, TOPIC_ROTATE_AFTER } from './today'
export type { TodayLessonsDto, TodayLessonItem, LessonRecommendation } from './today'
export { planLessonMemo, memoDraftFromEnrich, saveLessonMemo } from './memo'
export type { MemoPlan, MemoPlanEntry, MemoWordDraft, MemoSkipReason } from './memo'
export { checkLessonSpeaking, saveSpeakingAttempt, speakingModel, getLessonAudioSource } from './speaking'
export { lockLessonForWrite } from './rows'
export type { LessonDto, LessonWriteHandle } from './rows'
export type { LessonGenOutput, StoredLessonContent, SpeakingCheck, AudioKind } from './content'
export { MEMO_PER_LESSON_MAX, MEMO_PER_SEGMENT_MAX } from './progress'
export type { LessonProgress, MemoProcessed, MemoDraft } from './progress'
