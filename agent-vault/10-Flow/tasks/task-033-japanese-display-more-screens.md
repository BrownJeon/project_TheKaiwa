---
task_id: task-033
title: "일본어 표시(히라가나·한글) 확장 — AI 평가·단어 카드 뒷면·복습 카드"
status: todo
base_ref: 26b6322
risk_level: "R1"
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-026-improve-hangul-reading, task-030-japanese-display-followup, task-011-ai-evaluation, task-010b-repetition, task-008-vocab-today-words]
tags:
  - type/task
  - domain/ui
  - domain/improvement
aliases:
  - 일본어 표시 확장
  - task-033
created: 2026-10-05
updated: 2026-10-04
demo_gate:
  required: true
  level: "delta"
  status: "drafting"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[task-026-improve-hangul-reading]] 에서 회화방·채팅·오늘의 회화·단어 카드 앞면에 넣은 일본어 표시(한자 위 히라가나·아래 한글 줄·설정의 표시 3칸)를, 범위 밖으로 남겨 둔 화면에도 같은 규칙으로 넣는다.

대상 화면(후보 — 데모에서 확정):
- AI 평가(`src/components/eval/**` — 문항·결과·기록)
- 단어 카드 뒷면(`src/components/vocab/VocabCardFace.tsx` 뒷면·상세)
- 복습 카드(`src/components/lesson/review/**` — 오늘 홈 복습 카드·복습 레슨 문항)

원칙: 공용 `src/components/common/japanese/JapaneseText.tsx`·`displayPrefs.ts` 재사용(새 표시 규칙 만들지 않음), 정답 미노출(평가·카드 앞뒤 정답 노출 규칙 유지 — 읽기 줄이 정답을 흘리면 안 됨), 3폭 360/390/412 잘림 0, 터치 44px.

## 예상 변경 경로
- `src/components/eval/**` · `src/components/vocab/**` · `src/components/lesson/review/**`
- (필요 시) 읽기 분석 요청 대상 확장 — 서버 라우트 #24r 재사용

## 관련 과거 이력 요약
- [[task-026-improve-hangul-reading]]: 데모 v4 승인(F1=A), 표시 설정 Profile 3칸, 읽기 분석은 조각 단위 요청·429 재시도, 화면 A·B 파일 목록.
- [[task-030-japanese-display-followup]]: 토글 44px·말풍선 높이·저장 실패 알림 역할.
- [[task-011-ai-evaluation]]·[[task-008-vocab-today-words]]: 정답 미노출·`textRevealedAt`.
- 승인된 교훈: 없음.

## Judge 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "intake",
  "task_id": "task-033",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.5.0",
  "model": "jev-1.13.0",
  "decision": {
    "task_type": "feature",
    "complexity": 1.85,
    "risk": "R1",
    "developer_model": "sonnet",
    "track": "light",
    "demo": {
      "required": false,
      "level": "none",
      "owner": null,
      "rule_id": "DM-light-waive",
      "waived_level": "delta"
    },
    "next": "assign",
    "next_actions": ["assign_developer"],
    "roles": ["developer", "reviewer"]
  },
  "rule_overrides": [
    {"rule_id": "DM-kw-risky-cta"},
    {"rule_id": "TR-light"},
    {"rule_id": "DM-light-waive"}
  ],
  "fallback": null,
  "input_tokens": 1430,
  "cost_usd": 0.00006
}
```

engine: jev
결정: task_type=feature · risk=R1 · developer_model=sonnet · track=light · demo=none/(DM-light-waive) · next=assign
규칙 덮어쓰기: DM-kw-risky-cta, TR-light, DM-light-waive

## Leader 기록 (접수 판정 검토, 2026-10-05)
- judge 판정: light · sonnet · demo none(DM-light-waive, waived_level delta).
- **사용자 결정(2026-10-05 AskUserQuestion)**: "delta 데모 후 구현 (Recommended)" → **standard 로 올림**(데모 delta·designer·QA 복원). 사유: 여러 화면에 표시 줄 신설 + 평가·카드에서 읽기 줄이 정답을 흘릴 위험. override 판정 파일 `/tmp/judge-task-033-intake.leader.json` 으로 `check.mjs init`(drafting·delta·JV-ui_change). developer_model 은 judge 값 sonnet 유지(승격 규칙 적용).
- 착수 순서: 031 → 032 → 033.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge light → 사용자 결정 delta (JV-ui_change) | 10-05 |
| — | — | — | — | — | — |
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-04 23:41 |

## 최종 요약

