/**
 * L4 `speech/tts` — TTS 플랫폼 층 공개면(speech-platform/16 §1.1). 라우트는 `@/modules/speech` 를 통해서만 쓴다.
 */
export { synthesizeSentence, previewSettings, clearTtsSettingCache, TTS_SEGMENT_MAX_CHARS, TTS_SENTENCE_TIMEOUT_MS } from './synthesize'
export { signTtsAudioToken, verifyTtsAudioToken, readSignedTtsAudio, TTS_AUDIO_URL_PATH, TTS_AUDIO_URL_TTL_SEC } from './audioUrl'
export type { SignedTtsAudio, VerifiedTtsAudio, SignedAudioFile } from './audioUrl'
// 단어 timing(task-012b-4) — 라우트가 wav 응답 헤더 `X-Tts-Timing` 을 만들 때.
export { encodeTimingHeader, TTS_TIMING_HEADER_MAX } from './timing'
export { createTurnSpeaker } from './turnSpeaker'
export { synthesizeLessonClips } from './lessonAudio'
export type { LessonAudioClip, LessonAudioPace } from './lessonAudio'
export { synthesizeEvaluationClips } from './evalAudio'
export type { TurnChunkRequest, TurnChunkAudio } from './turnSpeaker'
export type { SynthesizeInput, SynthesizeResult } from './synthesize'
export { getTtsStatus } from './status'
export { TtsRequestError, TtsUnavailableError } from './errors'
export type { TtsRequestProblem } from './errors'
export { SPEECH_PROFILES, isSpeechProfile } from './profiles'
export type { SpeechProfileName } from './profiles'
export { SEGMENT_STYLES, SEGMENT_SPEEDS, LLM_SPEECH_STYLES } from './types'
export type { SegmentStyle, SegmentSpeed, LlmSpeechStyle } from './types'
export { parseTtsRequest, TTS_TEXT_MAX } from './request'
export type { TtsRequest } from './request'
// 발음 사전 관리(task-003g) — admin L0 `admin/speech/lexicon` 이 조합한다(권한·감사·대상 id 확인은 admin 몫).
export {
  listLexiconEntries,
  getLexiconEntry,
  listLexiconVersions,
  getLexiconVersionDiff,
  exportLexicon,
  dryRunLexiconImport,
  activeLexiconVersion,
  writeLexicon,
  afterLexiconCommit,
  immutableKeyErrors,
  LexiconVersionConflictError,
  LexiconEntryNotFoundError,
  LexiconVersionNotFoundError,
  LexiconDuplicateError,
  LexiconEntryInvalidError,
  LexiconImportInvalidError,
  LexiconRollbackRejectedError,
  LexiconSnapshotIntegrityError,
  checkSnapshot,
} from './lexiconStore'
export type { LexiconListQuery, LexiconListResult, LexiconVersionRow, LexiconVersionDiff, LexiconWriteContext, LexiconOp, LexiconWriteResult, CheckedSnapshot } from './lexiconStore'
export { parseEntryInput, collectScopeRefs, scopeRefKey, planRows, countPlan, fieldsOf as lexiconFieldsOf } from './lexiconRules'
export type { ImportRowInput, ImportPlan, ImportRowResult, PlanItem, RawEntryInput } from './lexiconRules'
export { parseLexiconFile, formatLexiconCsv } from './lexiconCsv'
export type { ParsedLexiconFile } from './lexiconCsv'
export { previewLexiconReadings, previewLexiconAudio, PreviewTextTooLongError } from './lexiconPreview'
export type { LexiconPreviewInput, LexiconPreviewAudio } from './lexiconPreview'
// 설정 기능 테스트용 합성(task-012c #105 — AppSetting 미리듣기 문장·기본 목소리)
export { probeTtsSynthesis, currentTtsConnection } from './configProbe'
export type { TtsProbeInput, TtsProbeResult } from './configProbe'
