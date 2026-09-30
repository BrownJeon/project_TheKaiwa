---
task_id: task-021
title: "개선 — 키보드가 입력창을 가리는 문제 공통 수정 (IMP-0008)"
status: doing
base_ref: 055dbcf
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-007-talk-voice-web, task-010-today-lesson, task-006-chat-correction, task-003f-android-ondevice-stt]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - 키보드 입력창 가림
  - task-021
created: 2026-09-30
updated: 2026-09-30
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-021-improve-keyboard-inset-v1.html"
  artifact_url: "https://claude.ai/artifact/63bJb9WYeKjddPgKDbds1h"
  content_sha256: "8cc701cce1832b89bf1c8548d968dac61f96c322385da475ef5e1751fffa0371"
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
개선 백로그 [[IMP-0008-키보드-입력창-가림]] — 키보드가 올라오면 입력창이 가려져 무엇을 입력하는지 볼 수 없다. **입력창이 있는 모든 화면**에서 같은 방식으로 해결한다(화면별 땜질 금지, 공통 해법).

## 사용자 결정
- 사용자 원문 그대로 진행(앱 내 입력창 전체 공통). 순서는 Leader 권고안(P1) 채택.

## 포함 항목
- [[IMP-0008-키보드-입력창-가림]] (P1, M)

## 현황 (착수 시점 Leader 재확인)
- 이미 있음: 루트 `interactiveWidget: 'resizes-content'`(`layout.tsx`), Manifest `adjustResize`, `useKeyboardInset`+`--kb-inset` 은 `ChatRoom`·`TalkRoom`(텍스트 모드)·`LessonScreen`(5단계)에만 적용.
- 빠진 곳: `Sheet.tsx` 바텀시트 계열(`WordAddSheet`·`NewChatSheet`·`AcceptCorrectionSheet`·`ChatMenuSheet` 등), `LessonPasteScreen`·`StageApply`·`StageUnderstand` 메모 입력, 설정 입력(`VoiceSettings`·`LearningSettings`).
- 미확정: 사용자가 재현한 화면(회화방 텍스트 모드)에서도 왜 안 먹는지 — targetSdk 35 edge-to-edge 에서 `adjustResize` 만으로 창이 안 줄 수 있다는 Manifest 주석이 있다. **원인은 웹 뷰포트 경로(웹 Chrome)와 앱 WebView 경로가 다를 수 있다.**

## 범위·진행 순서
1. **원인 확인** — 웹(Chrome)과 앱(WebView)에서 키보드가 뜰 때 `visualViewport`·`window.innerHeight`·안전 영역 값이 어떻게 변하는지 조사. 데스크톱 브라우저 에뮬레이션은 논리 검증까지만이고 **실기기(사용자 S25+) 확인이 최종 게이트**다.
2. **웹 전용 공통 해법 우선** — `useKeyboardInset` 을 앱 셸 수준으로 끌어올려(전역 `--kb-inset`) 바텀시트·입력 화면이 같은 값으로 입력창을 키보드 위에 유지. 시트는 열린 입력창이 가려지지 않게 스크롤/오프셋.
3. **네이티브가 필요하다고 확인될 때만** Manifest·Capacitor 설정(`capacitor.config.ts`)·플러그인 변경 — 이 경우 **`versionCode` 증가·APK 재빌드·업데이트 안내(deployer)** 가 따르고 사용자 재설치가 필요하다. 그 시점에 사용자에게 알리고 진행한다(웹으로 충분하면 웹 배포만).

## 비범위
- 화면 레이아웃 재설계, 입력창 위치 이동, 음성 입력 경로 변경.

## 완료 기준
- 입력창이 있는 모든 화면 목록(시트 포함)을 표로 만들어 각각 "키보드가 떠도 입력 중인 줄이 보임"을 확인(웹 360/390/412 에뮬레이션 + 사용자 실기기 웹·앱 재확인 요청).
- `tsc`·`eslint`·단위 테스트 0 fail. 네이티브 변경이 있으면 versionCode·고지 완비.
- **사용자 폰 확인은 QA 가 대신할 수 없다** — 배포 후 사용자 확인 항목으로 남긴다(F6 과 함께).

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 None · 복잡도 1.92 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: (판정 없음 — Leader 지정)
- 데모: **delta** (required=true, rule=JV-ui_change) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: developer_model=opus(MD-judge-failed-opus)
- 비고: 판정 도구가 역할 목록을 내지 못해(`MD-judge-failed-opus`) developer 를 opus 로 올렸다. 역할은 Leader 가 designer → developer → reviewer → qa 로 지정.

## Designer 기록

- [22:40] delta 데모 v1 작성 — `docs/demo/task-021-improve-keyboard-inset-v1.html` (`check.mjs lint --expect task-021-v1` → DEMO_LINT_PASSED, 토큰 `src/app/globals.css@sha256:22f382529f92`). Artifact 게시·검토 요청은 Leader.
  - 구성: 공통 규칙 R1~R7 · 입력 화면 유형 6개(회화방 텍스트[사용자 재현] · 채팅방 · 시트 입력[새 채팅/단어 추가/교정 채택] · 단어장 검색 · 설정 폼 · 수업 메모·긴 글) × 3칸(키보드 없음 = 현재·제안 동일 / 키보드 있음 현재 / 키보드 있음 제안) + "직접 눌러 보기"(칸을 누르면 모의 키보드 올라옴, ⌄ 로 내림) · 폭 360/390/412 · 높이 780/892 · 모의 키보드 높이 280/320/360(임의 값) · 입력창 있는 화면 전체 목록 17행(지금 보정 여부·적용 규칙) · 하단 결정 패널.
  - 핵심 설계 결정: ① 키보드가 없을 때 화면은 그대로(구조·입력창 위치·음성 경로 불변) ② 키보드 높이는 앱 셸 한 곳에서 재고 전 화면이 같은 값(R1) ③ 하단 입력 바는 키보드 바로 위, 목록은 맨 아래 유지, 제스처 바 여백 제거(R2) ④ 시트는 통째로 키보드 위, 최대 높이 = 남은 높이 85%, 시트 안쪽만 스크롤해 입력 칸 아래 16px 여유(R4) ⑤ 스크롤 폼은 입력 칸(여러 줄이면 커서 줄)이 키보드 위 16px 이상에 오도록 1회 스크롤(R5) ⑥ 위쪽 입력(검색)은 제자리, 목록 끝만 키보드 위(R6) ⑦ 토스트도 키보드 위, 닫히면 원위치·스크롤 유지(R7).
  - "현재" 열은 사용자 재현(키보드가 덮고 화면이 줄지 않음)을 같은 원인으로 다른 화면에 적용해 그린 것 — 웹 Chrome 에서 채팅방은 이미 제안처럼 동작할 수 있음을 데모에 명시(환경별 확정은 개발 원인 조사).
  - 결정 필요 A/B: **D1 키보드가 열려 있을 때 하단 탭** — A 숨김(디자이너 의견) / B 키보드 위로 따라 올라감. **D2 시트 안 입력 중 주 버튼** — A 제자리(시트 내용 끝, 디자이너 의견) / B 키보드 위 고정(비범위 "레이아웃 재설계"에 걸침).
  - 확인: 하단 탭 라벨은 현행 '단어장'(task-020) 반영. 목소리 설정은 슬라이더뿐이라 키보드 대상 아님(목록에 "확인만").

## Developer 기록

## 작업 기록

### 2026-09-30 Leader — 착수
- 실기기 재현이 첫 단계라고 IMP-0008 메모에 적었으나 사용자 폰은 세션에서 조작할 수 없다 → 코드·뷰포트 논리 조사와 에뮬레이션으로 원인 후보를 좁히고, 최종 확인은 사용자 폰으로 넘긴다.

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-021-improve-keyboard-inset-v1.html | https://claude.ai/artifact/63bJb9WYeKjddPgKDbds1h | 사용자 검토 요청 | 09-30 22:40 |
