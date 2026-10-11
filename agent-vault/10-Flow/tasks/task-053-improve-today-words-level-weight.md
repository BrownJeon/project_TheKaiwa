---
task_id: task-053
title: "오늘의 단어 단계 우선 가중 — 천장(지금·목표 수준 중 높은 쪽) 위 단계 단어를 줄여 세트가 어려운 쪽으로 쏠리지 않게 (IMP-0028, 서버 모듈만)"
status: doing
base_ref: 9b1675b
risk_level: "R2"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-051-improve-n5-vocab-pack, task-008-vocab-today-words]
imp: [IMP-0028]
tags:
  - type/task
  - domain/improvement
  - domain/vocab
aliases:
  - 오늘의 단어 단계 가중
  - task-053
created: 2026-10-11
updated: 2026-10-11
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

# task-053 — 오늘의 단어 단계 우선 가중 (IMP-0028)

## 사용자 요청·결정 (원문)
- 2026-10-11 「다음 작업 이어서 진행해줘」 → 다음 작업 선택(복수) 응답 「오늘의 단어 단계 우선 가중 (Recommended), 열려 있는 task 정리, Phase 3 방향 논의」.
- 가중 강도 **「중간 (Recommended)」** — 천장 위 1단계 ×0.3 · 2단계 ×0.05 · 3단계 이상 ×0. 천장 **「포함: 천장 = 지금·목표 중 높은 쪽 (Recommended)」** (AskUserQuestion, 2026-10-11). 근거 수치는 [[IMP-0028-오늘의단어-단계우선가중]] 와 [[task-051-improve-n5-vocab-pack]] QA 레인 A(A4).

## 관련 과거 이력 요약 (Leader 큐레이션)
- 현재 가중 `weightOf` = `clamp(1 + 2·wrong − 0.5·correct, 0.25, 8) × recency(미노출 2.0 / 7일↑ 1.5 / 1~7일 1.0 / 24h 0.3)`, 가중 비복원 샘플링(Efraimidis–Spirakis) 뒤 섞기. **같은 시드 + 같은 후보 → 같은 결과**가 계약(`VocabSession.seed`). 후보 타입 `SetCandidate` 에 단계 정보가 없다.
- 호출처 둘: `vocab/sessions.ts`(내 단어장 세트 — 후보 `WordEntry`, `POOL_SELECT`) · `vocab/topicSet.ts`(주제 세트의 보충 후보 — 주제 풀 항목, `jlpt` 없음, 사용자가 주제를 직접 고르는 흐름). **이번 범위는 내 단어장 세트(`sessions.ts`)만**; 주제 세트는 바꾸지 않는다.
- `WordEntry.jlpt`(`JlptLevel?` N5~N1)이 단계 칸이고 `Profile.level`·`Profile.goalLevel` 이 수준이다(스키마 변경 없음). 단계를 가진 사용자 단어는 task-051 기본 단어 팩(source=SEED)과 직접 추가분.
- QA 레인 A 실측(전 단계 7,755개 보유 계정 40세트 400장): N1 41.5 · N2 22.5 · N3 20.8 · N4 10.3 · N5 5.0 % — 가중이 풀 비중과 같음.
- 승인된 교훈(`/이슈기록 관련 vocab weight`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 1.63 · **R2** · developer=**sonnet** · **standard**(`risk_r2` — light 불가) · demo=none. 역할 developer → reviewer → qa. 입력·결과: 스크래치 `judge-053-intake*.json`. C1(`codex_gate`)은 설계 직후.

## 설계 (Leader — 사용자 결정 반영)
1. **`setGenerator.ts`(순수 함수 유지, DB 없음)**: 단계 코드 `N5<N4<N3<N2<N1`(쉬움→어려움 순서 `LEVEL_ORDER`). `levelFactor(wordLevel, ceiling)`: 단어 단계가 없거나 천장이 없으면 **1**; `d = 순위(단어) − 순위(천장)`; `d ≤ 0 → 1` · `d = 1 → 0.3` · `d = 2 → 0.05` · `d ≥ 3 → 0`. `ceilingOf(level, goalLevel)` = 둘 중 어려운 쪽(목표가 없으면 level). `SetCandidate` 에 선택 칸 `jlpt?: 단계|null`, `generateWordSet(pool, count, rng, now, ceiling?)` — **`ceiling` 을 안 주면 지금과 한 글자도 다르게 동작**(같은 시드 → 같은 결과, 기존 시험이 그대로 통과해야 함).
2. **가중 0 처리**: 계수 0 인 단어는 후보에서 빼지 않는다 — **아주 작은 양수 가중**(예 `1e-9`)으로 두어, 천장 이하/근처 후보로 `count` 를 못 채울 때만 마지막에 뽑히게 한다(세트가 비거나 `count` 보다 적어지지 않게). 후보가 충분하면 사실상 나오지 않는다.
3. **`sessions.ts`**: `POOL_SELECT` 에 `jlpt` 추가, 내 단어장 세트 생성에서 `ceiling` 을 `ceilingOf(Profile.level, Profile.goalLevel)` 로 구해 넘긴다. 프로필 조회는 라우트가 이미 읽고 있으면 옵션으로 받고, 아니면 모듈이 `preferences` 공개 함수로 읽는다(6층 규칙: `index.ts` 경유, `challenges/store.ts` 의 `getProfile` 선례) — 어느 쪽이 작은 변경인지 developer 가 정하고 이유를 적는다. 프로필을 못 읽으면 `ceiling` 없이(=현행 동작) 진행하고 세트 생성을 막지 않는다.
4. **건드리지 않는 것**: `topicSet.ts`(주제 세트)·재풀기(#53, 카드 목록 복사)·`choices` 보기 생성·스키마·화면·API 응답 모양·`VocabSession.seed` 계약.
5. **시험**: ① `levelFactor` 표(단계 없음·천장 없음·d 0/1/2/3/4, 천장 N5~N1 전부) · `ceilingOf` ② **분포 시험(시드 고정, 결정적)**: 실제 개수(N5 676·N4 629·N3 1,649·N2 1,767·N1 3,034)를 닮은 합성 풀에서 초보자·천장 N5 일 때 N1/N2 비중이 현저히 낮고(규칙 시험 문턱은 이력서 표의 이론값 71.4/19.9/8.7/0/0 에 통계 오차 허용), 천장 N4 일 때 N5·N4 가 비슷, 천장이 없으면 풀 비중과 같음 ③ **채움 시험**: 모든 후보가 천장보다 3단계 이상 높아도 `min(count, pool.length)` 장이 나온다 ④ **호환 시험**: `ceiling` 없이 호출한 결과가 변경 전과 같은 시드에서 같다(고정 기대값 또는 변경 전 구현 복제) ⑤ 단계가 없는 후보는 가중이 변하지 않음. 6층 ESLint 규칙에 맞게 시험을 층별로 나눌 것(모듈 시험 vs 라우트 시험).
6. **문서**: `docs/design/design-spec.md` §7-2 공식에 「× 단계 계수」 한 줄과 사용자 결정 표를 갱신(그 문단만).

## 하지 않는 것
- 화면·스키마·API 계약 변경, 주제 세트(`topicSet.ts`)·챌린지 풀 변경, 단어 삭제/보관 기능, 가중 강도를 사용자 설정으로 노출(결정 사항 밖).

## 완료 기준
1. 기존 세트 생성 시험이 수정 없이 통과(비호환 없음) + 새 시험 통과, tsc·eslint 0.
2. reviewer 가 실행 증빙을 재실행하고 변이(계수 표 값 하나 바꾸기·천장 계산 뒤집기)를 시험이 잡는지 확인.
3. QA(QA 계정만, 쓰기 후 원복): 전 단계 보유 계정의 40세트 분포가 이론값 근처로 이동, 천장 변경(프로필 `level`/`goalLevel`)에 따라 분포가 따라 움직임, 후보가 모자란 경우 세트가 정상 생성, 생성 지연이 크게 늘지 않음(이전 p50 약 2.0초).
4. 배포 후 읽기 전용 스모크(웹만, DB 변경·APK 없음).

## 상태 로그
- 2026-10-11 접수·묶음(base_ref `9b1675b`). 다음: judge C1 → developer(sonnet).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-11 16:03 |

## Leader 기록 (2026-10-11) — 구현 확인·정정
- **경로 정정(Leader 오기)**: 위 「설계」 6번과 judge 입력의 `docs/design/design-spec.md` 는 없는 경로 — 실제 정본은 **`docs/design-spec.md`** (§7-2). developer 가 올바른 파일을 고쳤다.
- **developer(sonnet) 완료**: 커밋 `32d8fd6`. `setGenerator.ts`(`levelFactor`·`ceilingOf`·`LEVEL_FACTOR_FLOOR`·`generateWordSet(…, ceiling?)`)·`sessions.ts`(프로필은 **모듈에서** `preferences.getProfile` 로, 트랜잭션 밖, 실패 시 천장 없이 진행 — 라우트는 `count` 생략 때만 프로필을 읽어 옵션 전달 쪽이 변경이 컸고 항상 읽게 하면 기존 `task049TopicWordsSeam.test.ts` 가 DB 접속을 시도함)·시험 21개(기존 시험 수정 0). 바닥 가중은 절대 가중이 아니라 **계수**에 적용(`weightOf × max(계수, 1e-9)`).
- **Leader 직접 확인**: diff 정독(설계와 일치) · 통합 게이트(053+054 합친 최종 작업 트리, 새 미러): Prisma 생성 0 · tsc 0 · eslint 오류 0 · 전체 시험 3,010 중 3,009 통과(건너뜀 1) · `next build` 0.
- **분포 시험(합성 풀 250세트×10장, 시드 고정)** vs 이론값: 천장 N5 → 72.0/19.0/9.1/0/0 (이론 71.4/19.9/8.7/0/0) · 천장 N4 → 35.8/32.5/27.0/4.7/0 (이론 35.8/33.3/26.2/4.7/0) · 천장 없음 → 9.0/7.5/21.4/22.3/39.9(풀 비중). 허용 ±4%p. 변이 6종을 시험이 잡음(바닥 가중 제거만 처음 못 잡아 시험 추가).
- **확인 못 한 것(→ QA 라이브)**: 실제 DB `createVocabSession` 통합 실행 · 프로필 `level`/`goalLevel` 변경 시 천장이 실제로 따라 움직이는지 · 생성 지연(순수 계산은 세트당 약 1.8ms, 추가는 프로필 읽기 1회).
- 다음: REV-183(054 와 함께, [[task-053-054-rev-record]]) → QA(QA 계정, 전 단계 보유 후 천장을 바꿔 가며 분포·지연 실측, 원복) → 웹 배포.
