---
tags:
  - type/decision
  - domain/db
  - domain/scenario
  - domain/challenge
  - domain/speech
aliases:
  - DB 승인 대기 5건 결정
  - 2026-10-10 DB 결정
created: 2026-10-10
---
# 「DB 승인 대기 미구현 5건」 사용자 결정 (2026-10-10, C안 = 항목별 지정)

배경: 2026-10-06 DB 승인 목록([[task-p2-db0-schema]] 「사용자 승인」표)에 없어 **미구현으로 남은 5묶음**을 사용자가 항목별로 결정했다. 정본 근거: [[task-p2-db0-schema]] 「승인 밖」, [[phase2-batch-plan]] §0-1·§0-2·§8-1(U-P1·U-P2), [[task-010d-scenario-roleplay]] (F안), `docs/design/challenge.md` §3-5·§4-3a, `docs/design/domain-model.md` TTS 확장 절.

| # | 항목 | 사용자 결정 (원문 요지) | 처리 |
|---|---|---|---|
| 1 | `Chat.endedAt DateTime?` | 「역할극을 끝내는 건 사용자가 끝낸 것에 대해서 끝냄 처리를 하도록」 | **DB 승인.** 사용자가 [마치기]로 끝낸 역할극에만 `Chat.endedAt` 표식. → [[task-048-roleplay-endedat]] |
| 2 | `VocabAttempt.exampleSnap`·`exampleKoSnap` | 「챌린지 주제 단어에 대하여 승인」 | **DB 승인**(nullable 2칸). A12 출력 증가(≈40%·대기) **라이브 측정 게이트** 포함. → [[task-049-topic-word-examples]] |
| 3 | `EngineMetricsDaily.queueDelayMs`·`modelLoadMs` | 「그렇게 해줘」 (= DB 변경 없이 문서 정정) | `domain-model.md` 제안 본문 정정 완료(승인·구현은 6칸뿐, 두 칸은 철회). |
| 4 | 012c-3 표 3개(`TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare`) | 「Phase 4 로 이관하고 결정사항은 종료」 | **Phase 4 이관, 이 결정 사항 종료.** `design-spec.md` 012c-3 행·`CLAUDE.md` Phase 4 행에 반영. Phase 4 에서 **DB 승인 여부부터 재결정**(10-06 승인 목록에는 없었음 — `design-spec` 의 「사용자 승인」 문구와 어긋나 있던 것을 정정). |
| 5 | `JobKind`·`SnapshotKind` 값 추가 | 「보류했다가 Phase 4 에서 4번이 작업된 후에 연계하여 다시 결정」 | **보류.** Phase 4 에서 012c-3(TTS 품질)이 작업된 뒤 `JobKind.TTS_QUALITY_RUN`·챌린지 T6 의 `SnapshotKind` 값을 함께 재결정. 그 전에는 추가하지 않는다. |

## 이후 규칙
- 1·2번의 DB 변경은 **단일 작성자가 스키마를 쓰고 Reviewer 가 승인 목록과 1:1 대조 → Leader 가 백업 → `migrate diff` 확인 → `db push` 한 번**(task-045 선례). 승인된 칸 외의 DB 변경은 하지 않는다.
- 새 enum 값 추가(5번)는 공유 NAS DB 에서 구 코드가 새 값 행을 읽다 실패할 수 있어([[phase2-batch-plan]] §0-2) Phase 4 에서 배포 순서까지 정해 승인받는다.
- Phase 4 재개 때 이 문서의 4·5번을 먼저 읽는다.
