/** tests/live/talk-length-measure.ts 용 얇은 재수출 — 인덱스와 persona 캐시 초기화를 한 곳에서. 라이브 측정 전용(앱 코드 아님). */
export { buildTalkRequest, checkTalkResponse, countJaSentences } from '../../src/modules/conversation'
export type { TutorResponse } from '../../src/modules/conversation'
export { resetPersonaCache as resetPersonaCacheForMeasure } from '../../src/modules/conversation/persona/loader'
