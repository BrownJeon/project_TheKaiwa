/**
 * 기본 단어 팩 단계별 개수 — 클라이언트가 7천 개 데이터를 싣지 않고도 「N개 넣기」 문구를 그릴 수 있게 하는 상수 맵.
 * 생성 파일: `scripts/seed-build/build.ts` 가 `prisma/seed-data/jlpt/*.json` 의 길이로 다시 쓴다(task-051). 손으로 고치지 않는다.
 * 다섯 단계 모두 검증을 통과한 시드 파일 길이다(거절 행 제외 — OpenJLPT 원본 수보다 작을 수 있다).
 */
export const SEED_PACK_COUNT = { N5: 676, N4: 629, N3: 1649, N2: 1767, N1: 3034 } as const
