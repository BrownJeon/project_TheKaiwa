/**
 * 엔진 독립 음성 수치 범위 **정본** — 설정 저장 검증(#14·#18 `validate.ts`)과 speech(L4) TTS Resolver·Rendering Plan 클램프가 같이 읽는다.
 * preferences(L1)는 speech 를 import 할 수 없고(module-dependency §3 행렬) speech → preferences 는 허용이라 여기 둔다.
 *
 * 값(task-022, 2026-09-30 Leader 확정 — M4 실측): pitch 하한만 0.7 인 이유는 0.6 에서 유성 프레임이 −22~26% 줄고 억양 1.4 와
 * 겹치면 −35~43% 로 무너졌기 때문. 범위는 **넓히는 방향만** 옛 저장값과 호환된다(좁히면 기존 행의 재저장이 400 으로 막힌다).
 */
export const VOICE_PARAM_RANGES = {
  styleWeight: [0, 4],
  speed: [0.5, 1.5],
  pitch: [0.7, 1.4],
  intonation: [0.6, 1.4],
} as const satisfies Record<string, readonly [number, number]>

export type VoiceParamRangeKey = keyof typeof VOICE_PARAM_RANGES
