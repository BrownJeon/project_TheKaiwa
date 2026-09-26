---
task_id: task-001
title: "초기 기획 — 기획서 4종 통합·6층 아키텍처 재설계·팀·Agent Vault 구성"
status: done
roles_involved: [leader]
related_tasks: [task-002-phase0-scaffolding]
tags:
  - type/task
  - domain/plan
  - domain/infra
  - domain/speech
  - domain/engine
  - domain/admin
aliases:
  - 초기기획
  - 설계확정
created: 2026-09-26
updated: 2026-09-26
---

## 목표 (Leader 작성)
사용자 기획서(일본어회화 앱)를 바탕으로 워크스페이스 13번째 프로젝트 `TheKaiwa` 를 생성하고, 이후 제시된 음성 처리 아키텍처(§1~§24)·Voice/Engine 관리 플랫폼(§25~§77)·Admin Console(§78~§128) 기획안을 하나의 설계안으로 통합한 뒤, DB Entity·API 명세·모듈/패키지 구조·설정 해석 규칙·역할/권한을 6층 플랫폼 아키텍처에 맞게 재설계한다. **구현 코드는 작성하지 않는다.**

## 관련 과거 이력 요약
- 워크스페이스 규칙: 훅은 `$CLAUDE_PROJECT_DIR/../.claude/hooks/agent-vault/` 상대형(TheMeal 복사), 템플릿 `model:` 이 정본, UI 프로젝트 qa 는 `<screen_verification>` 필수, 루트 `CLAUDE.md`/`AGENTS.md` 는 손으로 병행 갱신(pwsh 없음).
- 재사용 자산 실측: 주짓수일상 픽미업은 정오답 퀴즈가 아니라 영상 클립 스와이프 덱(`SwipeCardDeck.jsx` 제스처·셔플·제외집합만 이식), 관장님께 물어보세요는 Claude CLI 자식 프로세스(`masterChat.js` 턴 오케스트레이션·3테이블 이력·SSE+폴링 이식).
- 인프라: 우분투 32GB·GPU 없음·Docker 있으나 앱은 pm2+venv·Redis 없음 / M4 24GB·MPS·Redis 로컬 / 자유 포트 3010·8100+ / TheMeal 이 구조 골격, VoiceVault 가 안드로이드 보정 5종.
- OSS 조사: ReazonSpeech on sherpa-onnx 는 오프라인 zipformer int8 148MB(RTF 0.05, 스트리밍 JA 모델 없음 → VAD 세그먼트 디코드), Style-Bert-VITS2 AGPL·CPU 추론·FastAPI 내장, faster-whisper MIT(VoiceVault 재사용), narabas MIT(일본어 음소 정렬).

## Leader 지시사항
- 본 task 는 Leader 단독 수행(팀 소집 전). 산출물: `.claude/{settings.json,agents/*8}`, `agent-vault/`, `CLAUDE.md`, `docs/design-spec.md`, `docs/design/` 정본 5종 + `speech-platform/00~15` + `admin-console/00~16`, `speech/`·`plugins/` 골격 README, 원문 4종 보존, 워크스페이스 등록부, 메모리.
- 설계 문서 33종은 general-purpose 서브에이전트 5개가 병렬 작성(파일 경계 분리), Leader 가 이름표(엔티티·API·모듈) 를 먼저 고정해 전달하고 교차 검증.

## Developer 기록
- (해당 없음 — 코드 없음)

## Reviewer 기록
- (해당 없음)

## QA 기록
- (해당 없음)

## 최종 요약
- **무엇을**: 기획서 4종을 `docs/design-spec.md` 로 통합하고 6층 플랫폼(app+admin / preferences / conversation / learning / speech / engine / infra) 기준으로 DB Entity(`domain-model.md`)·API(`api-contract.md`)·모듈(`module-dependency.md`)·설정 해석(`configuration-resolution.md`)·권한(`role-permission.md`)을 재설계했다. 음성은 온디바이스 sherpa-onnx+ReazonSpeech 플러그인(gateway 폴백)·M4 Style-Bert-VITS2·VoiceVault whisper 재사용·MariaDB `SpeechJob` 큐로 확정했고, Voice/Engine/Console 은 데이터·설정·버전 기반으로 설계했다.
- **왜**: 기획서의 React Native·네이티브 STT 가정이 실측(주짓수일상=Capacitor, 5초 예산, 사용자 지시)과 달랐고, 세 차례 추가 기획안이 서로 다른 층(음성·엔진 관리·콘솔)을 다뤄 한 번에 정합성을 맞춰야 했다.
- **결과**: 프로젝트 뼈대(팀 7인+강사 페르소나, Agent Vault, 규약 파일)와 설계 문서 33종 + 정본 5종 + 통합 설계안. 코드 0줄.
- **다음 후보**: 사용자 선결 항목(Gitea·DB·OAuth·nginx·M4) 처리 → [[task-002-phase0-scaffolding]] 착수, 이어 003·004·005·005b 병렬.
