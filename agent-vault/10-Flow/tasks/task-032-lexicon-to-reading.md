---
task_id: task-032
title: "관리자 발음 사전을 읽기 분석기(히라가나·한글 표시)에도 반영 — 青か·愚か·密か 오분절"
status: todo
base_ref: 26b6322
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-026-improve-hangul-reading, task-003g-lexicon-admin, task-003d-tts-p0]
tags:
  - type/task
  - domain/speech
  - domain/admin
aliases:
  - 발음 사전 읽기 반영
  - task-032
created: 2026-10-05
updated: 2026-10-04
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
지금 관리자 발음 사전(PronunciationLexicon, [[task-003g-lexicon-admin]])은 TTS 에만 쓰이고, 화면의 히라가나·한글 줄을 만드는 읽기 분석기(gateway pyopenjtalk, [[task-026-improve-hangul-reading]])는 모른다. 그래서 `赤か青か` 의 `青か` 를 한 단어(セイカ)로 읽어 `青{せい}か`·세-카 가 된다(愚か·密か 도 같은 계열 — 026 L7 "알려진 한계").

관리자가 사전에 고친 읽기가 화면 읽기 줄에도 같게 나오도록, 활성 사전 버전을 읽기 분석 경로에 반영한다.

검토할 설계 질문(C1 전 Leader·developer):
- 반영 위치: (a) 앱 L4 `speech/reading` 이 분석 결과를 사전으로 후처리 vs (b) gateway 에 사전 버전을 넘겨 pyopenjtalk 사용자 사전으로 분석. 엔진명은 adapter·`speech/common` 밖으로 내지 않는다.
- 캐시 키에 사전 버전 포함(사전 변경 뒤 옛 읽기 잔존 금지), 환경(DEVELOPMENT/PRODUCTION) 분리.
- 사전 항목이 "표기 → 읽기"라 분절 자체를 바꾸는 경우(青か → 青+か) 처리 가능 범위.

완료 기준: 青か·愚か·密か 와 사전에 추가한 임의 항목이 읽기·한글 줄에 반영, 사전 끄기/롤백 시 원복, 기존 읽기 회귀 0, 첫 화면 읽기 지연 악화 없음, 엔진명 누출 0.

## 예상 변경 경로
- `src/modules/speech/reading/**` · `src/modules/engine/adapters/text/annotateHttp.ts`
- `speech/gateway/kaiwa_gateway/text.py` · `speech/gateway/app.py` · `speech/gateway/tests/test_text.py`
- (조회만) 발음 사전 버전 조회 경로 — `ConfigurationVersion`·`LexiconVersion` 쓰기는 하지 않음

## 관련 과거 이력 요약
- [[task-003g-lexicon-admin]]: 사전 버전+감사 한 트랜잭션, 환경 잠금, Rollback 은 새 버전(ConfigScope LEXICON — [[task-018-db-structure-hardening]]).
- [[task-026-improve-hangul-reading]]: 읽기 출처 pyopenjtalk, 형용동사 어간 합침/숨김 규칙(N1), 1-스레드 executor, "틀린 것보다 없음".
- 승인된 교훈: 없음.

## Judge 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "intake",
  "checkpoint": null,
  "task_id": "task-032",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.5.0",
  "model": "jev-1.13.0",
  "decision": {
    "task_type": "feature",
    "complexity": 2.44,
    "needs_info": false,
    "risk": "R1",
    "developer_model": "opus",
    "roles": [
      "designer?",
      "prompt-engineer?",
      "developer",
      "reviewer",
      "qa"
    ],
    "demo": {
      "required": false,
      "level": "none",
      "owner": null,
      "publish": "artifact+repo",
      "source": "jev",
      "rule_id": null,
      "rule_ids": [],
      "waiver_requested": false,
      "configuration_error": null
    },
    "track": "standard",
    "next": "assign",
    "next_actions": [
      "assign_developer"
    ],
    "blocking_gate": null
  },
  "signals": {
    "task_type": {
      "choice": "feature",
      "confidence": 0.5
    },
    "complexity": {
      "score": 2.44,
      "confidence": 0.56
    },
    "needs_info": {
      "noul": 0.59
    },
    "risk": {
      "choice": "normal",
      "probabilities": {
        "low": 0,
        "normal": 0.72,
        "high": 0.28
      }
    },
    "ui_detect": "listed",
    "ui_change": {
      "valid": true,
      "choice": "none",
      "confidence": 0.98,
      "probabilities": {
        "behavior_change": 0.01,
        "new_screen": 0,
        "minor_visual": 0,
        "none": 0.99,
        "partial_restructure": 0,
        "overhaul": 0
      }
    }
  },
  "rule_overrides": [],
  "fallback": null,
  "input_tokens": 1362,
  "cost_usd": 0.000057,
  "latency_ms": 271
}
```

**기록**:
- [2026-10-04 23:37] intake engine=jev → task_type=feature · risk=R1 · developer_model=opus · next=assign | overrides=- | fallback=- | tokens=1362

## 최종 요약

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-04 23:39 |
