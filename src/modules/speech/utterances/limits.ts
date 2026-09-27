/** 발화 업로드·보존 상한(api-contract #19 `upload`·#21, domain-model Utterance "오디오 30일"). */
export const UTTERANCE_MAX_BYTES = 2 * 1024 * 1024
export const UTTERANCE_MAX_DURATION_MS = 60_000
export const UTTERANCE_SAMPLE_RATE = 16_000
export const UTTERANCE_TEXT_MAX = 1_000
export const UTTERANCE_SEGMENTS_MAX = 50
export const UTTERANCE_RETENTION_DAYS = 30
