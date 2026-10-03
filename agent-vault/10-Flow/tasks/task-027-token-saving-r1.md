---
task_id: task-027
title: "토큰 절감 1차 — judge 프로젝트 오버라이드·light 트랙·maxTurns·resume-guard (ADP-001 D-10)"
status: doing
risk_level: R1
roles_involved: [leader]
related_tasks: [task-017-dev-env-judge-codex]
tags:
  - type/task
  - domain/infra
  - domain/adoption
aliases:
  - ADP-001-C02-D10
created: 2026-10-03
updated: 2026-10-03
---

## 목표 (Leader)
TheKaiwa 7일(09-27~10-03) 에이전트 팀 운영이 추정 $8.7k(활성일 평균 TheMeal 의 3.8배)로 사용 한도를 빠르게 소진했다. 서브에이전트가 84%·developer(Opus)가 60%·비용의 68%가 긴 컨텍스트 재독이었다. 이를 줄이는 1차 개선(B·작은 개선 간소화·D·A)을 적용하고, **적용 후 효과를 측정해 임계를 단계 조정**한다.

## 사용자 결정 (2026-10-03)
- 작은 개선은 화면 변경(데모 delta)이어도 **데모 면제**, judge 가 `track: light` 로 판정하면 leader→developer→reviewer.
- A안: R2 강제 Opus 를 변경 경로 규칙으로 한정 + 복잡도 임계 1.5→**2.0**(2.5 제안을 사용자가 2.0 으로 수정). 개발자의 Opus 사용 추이를 보며 조정.
- 적용 범위 **TheKaiwa 한정**. D안 강제는 "안내(advise) 후 차단(block)".

## 관련 과거 이력 요약
- [[task-017-dev-env-judge-codex]] — judge·codex 선도입. 이번 변경은 그 judge 의 임계·규칙을 TheKaiwa 한정으로 조정하고 훅·에이전트 규칙을 더한 것이다.
- 판정 기록: 25개 task 중 23건이 Opus, R2 17건(경로 규칙 4·키워드만 3·Jev high 만 10). 개선 task(020~026) 7건 중 5건이 데모 delta.

## 산출물 (2026-10-03, 메인 세션 구현 — 코드·문서 정본 위치는 아래 문서의 표)
- **설계·후속 작업 체크리스트·측정 결과 표**: [토큰절감-1차.md](../../../../adoption/ADP-001-typesafe-jev/cases/C02-dev-request-judge/토큰절감-1차.md) ← **이어받을 때 먼저 읽는다**
- **이슈 레지스트리 항목(후속 측정·판정의 정본)**: `../../../../issues/items/ISS-0001-토큰-과다-소진-thekaiwa-—-서브에이전트-팀-운영-비용.md` (ISS-0001, `/이슈기록 점검 ISS-0001`)
- 결정: `adoption/ADP-001-typesafe-jev/20-결정.md` D-10 · 색인: `40-적용사례.md` ADP-001-C02
- 도구: `.claude/tools/jev-judge/`(`project_overrides.TheKaiwa`)·`.claude/hooks/resume-guard/`(TheKaiwa settings 에만 등록, advise)·`.claude/tools/usage-report/`(고정 기준선 `issues/metrics/ISS-0001/2026-10-02.json`, 09-27~10-02)
- 이 저장소: `.claude/agents/{developer,prompt-engineer,leader,reviewer,judge,deployer}.md`·`.claude/settings.json`·`CLAUDE.md`·`improvements/README.md` — **미커밋**(push=webhook 배포이므로 사용자 지시 시에만)

## 후속 작업 (요약 — 상세·기준·명령은 ISS-0001)
1. 첫 작업에서 resume-guard 이벤트(`events.jsonl`) 발화 확인 — SendMessage 에서 훅이 호출되는지 미확인
2. 2~3일 후(≈10-06) `usage-report` 로 기준선 대비 측정
3. 매주 복잡도 임계 2.0→2.25→2.5 단계 조정 판단(Sonnet 반려·승격률·배포 후 결함)
4. advise 1주 후(≈10-10) block 전환 판단
5. 4주 회고(10-25 전후) 유지·확산·원복

## 판단 기록 (judge)
(이 task 자체는 도구·정책 변경이라 judge 판정 없음. 이후 개선 task 의 `track`·`실호출모델` 은 각 task 이력서에 적는다.)

## Reviewer 기록
(미실시 — 효과 측정 후 필요하면 Leader 가 독립 감사를 요청한다.)

## 최종 요약
(측정 완료 후 Leader 가 작성. 그때까지 status=doing.)
