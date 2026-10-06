/**
 * 챌린지(Challenge — 설계서 `docs/design/challenge.md` v2.3, task-041 T1) 공개 API. `learning/index.ts` 가 `export *` 로 다시 내보낸다.
 * 소유 표 = `Challenge` 하나. 하루 결과는 저장하지 않고 `StatsSnapshot(LESSON·VOCAB_SESSION)` 을 읽을 때 계산한다(metrics.ts).
 * import: `../topics`·`../topics/pool`·`preferences`·`infra` 만 — `../lessons`·`../vocab`·`../studyLog` 는 import 하지 않는다(그쪽이 이 모듈을 단방향으로 읽는다).
 */
export { parseCreateChallengeBody, parseEndChallengeBody, parseChallengeListQuery, isChallengeId, CHALLENGE_TITLE_MAX } from './validate'
export type { CreateChallengeInput, ChallengeListQuery, ChallengeListStatus } from './validate'
export { createChallenge, endChallenge, getChallengeDetail, getChallengeToday, listChallenges, CHALLENGE_CREATE_PER_DAY } from './service'
export { challengeProgressAfter, challengeDayStates, getActiveChallengeTopic } from './progress'
export type { ChallengeSnapKind, ChallengeCalendarDay, ChallengeDayStatesResult, ActiveChallengeTopic } from './progress'
export { settleExpired as settleExpiredChallenges } from './settle'
export { CHALLENGE_LENGTHS, CHALLENGE_WORD_COUNTS, CHALLENGE_RULE_VERSION, wordsMinAnsweredOf } from './metrics'
export type { ChallengeDeps } from './store'
