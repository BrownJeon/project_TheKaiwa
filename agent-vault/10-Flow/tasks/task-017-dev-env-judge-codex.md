---
task_id: task-017
title: "개발환경 개선 선도입 — judge(Jev 판정)·codex(외부 검토) 에이전트 적용"
status: done
risk_level: R1
roles_involved: [leader, judge, codex, reviewer]
related_tasks: [task-005-settings-attendance, task-004-ai-client-persona]
tags:
  - type/task
  - domain/infra
  - domain/adoption
aliases:
  - ADP-001-C02
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
워크스페이스 개발환경 개선([작업계획서](../../../../docs/Claude메인_Codex보조_Jev_작업계획서_2026-09-27.md) v1.4)을 TheKaiwa에 먼저 적용한다. judge 에이전트가 Jev로 작업 접수 분류·Codex 개입을 판정하고, codex 에이전트가 판정된 체크포인트에서만 Codex 읽기 전용 검토를 한다. 적용 후 재개 첫 task(task-006)부터 이 운용으로 진행한다.

## 사용자 결정 (2026-09-27, 계획서 §14)
- F-1 선도입 = TheKaiwa · F-4~F-6 judge·codex 신설, judge가 Codex 개입 판정, 공통 템플릿 + TheKaiwa 먼저
- Q-A4: task당 Codex 최초 1회 + 재검토 3회, 남은 한도 10% 미만이면 R2만, **Codex 실패 시 다음 단계로 진행하고 사용자에게 실패 내역 보고**
- Q-A5: judge 관찰 단계 없이 바로 운용 · Q-A8: 모델 판정 실패 시 Opus
- Q-A6: 비민감 요약만 전송(코드·diff·비밀·학습자 데이터 제외) · Q-B3: 28일 $5 · Q-B4: ADP-001-C02 등록(D-07)
- 나머지 A군(A1·A2·A3·A7·A9·A10)은 권고안

## 관련 과거 이력 요약
- 2026-09-27 사용자 지시로 Phase 1 일시 정지("점검·개발환경 개선 후 재개"). 재개 순서 task-006 → 008 → 005b → 003 → 007.
- `sync-projects.ps1` 실행은 1차 구현 후로 보류(09-26) — 이번 작업도 `.codex/agents` 생성 안 함(Q-A10).

## 산출물 (2026-09-27, 메인 세션 구현)
| 구분 | 경로 |
|---|---|
| 판정 도구 | `../.claude/tools/jev-judge/` (spec·rules·lib·CLI·config·테스트 16건) |
| Codex 래퍼 | `../.claude/tools/codex-review/` (스냅샷 worktree·비밀 파일 차단·시간 상한·결과 JSON) |
| 공통 템플릿 | `../.claude/agents/_template-judge.md`, `_template-codex.md` |
| TheKaiwa 역할 | `.claude/agents/judge.md`, `codex.md` 신설, `leader.md`(`<judge_codex>`)·`reviewer.md`(Codex 지적 판정) 갱신 |
| 문서 | TheKaiwa `CLAUDE.md` 팀 표·소집 문구, 워크스페이스 `CLAUDE.md`·`AGENTS.md` 팀 표, ADP-001 D-07·C02 |

## 0단계 확인 항목 (운용 시작 전) — 2026-09-27 사용자 결정: **실제 호출 검증은 맥 환경의 별도 세션**에서 진행. 맥 워크스페이스 = `/Volumes/homes/brownjeon/project`
- [ ] 워크스페이스 `.claude/secrets/jev-judge.env` 에 `TYPESAFE_API_KEY` (없으면 judge는 규칙 엔진으로만 동작) — 키·상태 파일은 NAS 워크스페이스 하위(사용자 결정 2026-09-27)
- [x] Codex 자동 리뷰 게이트 비활성 확인(사용자, 2026-09-27)
- [x] `node --test .claude/tools/jev-judge/test/judge.test.mjs` Linux에서 통과 — 2026-09-27 18/18(테스트 2건 환경 독립화: 가짜 fetch 타임아웃의 unref 타이머·실제 키 파일 격리)
- [x] `codex exec --help`·`codex exec review --help` 확인 → `config.env` 작성(review 모드, `-c sandbox_mode="read-only"`, 폴백 exec `-s read-only`) (2026-09-27)
- [x] 첫 실제 Codex 실행 — 2026-09-27 task-006 C1: codex-cli 0.128.0 `exec review` 가 `--commit` 과 표준입력 프롬프트 동시 수용 **불가**(exit 2) → `config.env` 기본 `CODEX_MODE=exec`. task-006 C2 exec 모드 성공(183초, exit 0, stderr 는 모델 캐시 경고뿐). NFS git dubious ownership 은 `GIT_CONFIG_COUNT/KEY_0/VALUE_0` 환경변수로 해결. 래퍼 `.sh`·`config.env` CRLF→LF 변환
- [x] 한도 기록 — 2026-09-27 사용자 "토큰 초기화" → `set-limit 100`
- [x] Q-A9: push 로 자동배포가 돼도 지금은 상관없음(사용자, 2026-09-27)
- [ ] 맥: `timeout` 부재 대응 — `brew install coreutils`(gtimeout) 권장, 없으면 perl alarm 폴백(윈도우에서 미검증, 맥에서 시간 초과 1회 확인)
- [ ] 판정 1회 시험: `--dry-run` 으로 전송 본문 확인 → 실제 intake 1회 → `--budget` 확인

## 판단 기록 (judge)
- (운용 시작 후 append)

## Codex 검토
- (해당 시 append)

## Reviewer 기록
- [2026-09-27] 1차 CONDITIONAL_PASS — High: codex-review 비밀 파일 차단 범위 부족(jks·keystore·SSH 키 등) / Medium: Codex 4회 한도가 수기 입력에 의존 / Low: 40자 git SHA 오탐, 스냅샷 dangling 커밋(보류)
- 수정: `SECRET_FILE_RE` 확장(접두어 붙은 credentials 포함, `.npmrc`·`credentials.ts` 오탐 제외), task별 실행 횟수 파일(`counts/<task>.json`)을 judge 가 직접 읽음, 40자 hex SHA 예외. 테스트 18/18
- [2026-09-27] 재검증 **PASS**

## 최종 요약
**무엇을**: TheKaiwa 팀에 judge(Jev 판정)·codex(Codex 외부 검토) 에이전트를 추가하고, leader 가 접수·체크포인트마다 이들을 쓰도록 절차를 넣었다. 공용 도구(`.claude/tools/jev-judge`·`codex-review`)와 템플릿을 워크스페이스에 두어 다른 프로젝트로 확산할 수 있다.
**검증**: 판정 도구 테스트 18건·Codex 래퍼 가짜 실행(두 모드·시간 초과·비밀 파일 차단·저장소/기준 커밋 자동 결정) 통과, 독립 리뷰 PASS. 사용자 결정으로 **실제 호출 검증은 실제 작업 중에** 한다 — Jev 는 task-006 접수(intake)에서, Codex 는 Linux 세션의 첫 C2 에서.
**사용자 결정 반영**: Codex 재검토 3회·한도 10% 미만 R2만·실패 시 진행 후 보고, judge 바로 운용, 모델 판정 실패 시 Opus, Jev 28일 $5, 키·상태 파일은 워크스페이스 `.claude/secrets`·`.claude/state`, 리뷰 게이트 off 확인, push→자동배포 무관.
**남은 것**: Codex 첫 실행 시 `runs/<run>/stderr.txt`(sandbox_mode 경고)·`parsed` 확인 → 실패면 `config.env` 의 `CODEX_MODE=exec`. `set-limit` 미기록이면 R2 작업만 Codex 가 개입한다.
