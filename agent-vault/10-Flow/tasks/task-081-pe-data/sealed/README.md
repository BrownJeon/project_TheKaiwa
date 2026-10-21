# sealed — 열쇠 보관 (Leader 가 판정 JSON 을 확정하기 전에는 열지 않는다)

`blind-sheet.key.json` = 눈가림 표 `blind-sheet.md` 의 S01~S40 → 호출·줄 매핑(arm 은 이번 측정이 단일 arm(v10)이라 모두 같다).
집계: `SCORE=1 VERDICTS=<판정.json> KEY=<이 폴더의 blind-sheet.key.json> node --env-file=.env --import tsx tests/prompts/lesson-pieces-live.ts` (미러 `~/.node-local/thekaiwa-pe081`).
판정.json 형식: `{"S01":"맞음","S02":"어색","S03":"틀림",…}` (40개 전부).

## r2 (PE 3단계 재측정, 2026-10-21)
`blind-sheet-r2.key.json` = 눈가림 표 `blind-sheet-r2.md`(S01~S40, 시드 82, 풀 52줄) 의 매핑 — 단일 arm(`v10r2`). **Leader 판정 확정 전에는 열지 않는다.**
집계: `SCORE=1 VERDICTS=<판정.json> KEY=<이 폴더의 blind-sheet-r2.key.json> node --env-file=.env --import tsx tests/prompts/lesson-pieces-live.ts`.
