---
tags:
  - type/decision
  - domain/infra
  - domain/adoption
aliases:
  - 토큰 절감 1차
  - ADP-001 D-10
date: 2026-10-03
---
# 결정: 토큰 절감 1차 — 서브에이전트 규율·judge 임계·light 트랙 (ADP-001 D-10)

**결정** (사용자, 2026-10-03, TheKaiwa 한정)
- developer `maxTurns: 80`·prompt-engineer 100. 끊기면 **신규 소환 + 인수인계**(SendMessage 이어받기 금지).
- 5분 넘게 쉬었고 컨텍스트가 150k 를 넘는 에이전트는 깨우지 않고 신규 소환한다. 훅 `resume-guard` 는 advise 로 시작하고 측정 후 block 으로 전환한다.
- judge 오버라이드:
  - 복잡도 임계 1.5→**2.0**. 매주 추이를 보고 2.25·2.5 로 단계 조정한다.
  - R2 강제 Opus 는 변경 경로 규칙(인증·결제·마이그레이션·비밀·배포·native)일 때만 적용한다.
  - 작은 개선은 `track: light` 로 처리한다 — leader→developer→reviewer, 데모 게이트·QA 면제.
- developer 소환 때는 judge `developer_model` 을 `model` 파라미터로 반드시 넘긴다.

**기각한 대안**
- 서브에이전트 1시간 캐시 TTL 전면 적용: 쓰기단가 2배로 추가 +$949, 회피 이득 $568 → 순손실 $381.
- developer 전부 Sonnet + 실패 시 승격: developer 비용 60~80% 를 절감하지만 보안·네이티브·음성 task 의 품질 위험이 가장 크다.
- 복잡도 임계 2.5 즉시 적용: 효과는 더 크지만(−22~−30%) 사용자가 2.0 에서 시작해 Opus 사용 추이를 보고 조정하기로 했다.
- 컴팩션 창 축소: 전 세션에 일괄 적용되고 요약 손실이 있다. maxTurns + 인수인계가 우선이다.

**근거 파일**
- 결정 원문: `../../../../adoption/ADP-001-typesafe-jev/20-결정.md` D-10
- 설계·변경 파일·롤백: `../../../../adoption/ADP-001-typesafe-jev/cases/C02-dev-request-judge/토큰절감-1차.md`
- 후속 측정의 정본: 워크스페이스 이슈 레지스트리 ISS-0001(`../../../../issues/items/`)
- 고정 기준선: `issues/metrics/ISS-0001/2026-10-02.json`
- 작업 이력: [[task-027-token-saving-r1]]
