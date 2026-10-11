---
task_id: task-053
title: "task-053 Developer 기록 (별도 파일 — 이력서 본문은 Leader 소유)"
tags:
  - type/record
  - domain/vocab
created: 2026-10-11
---

# task-053 Developer 기록

이력서: [[task-053-improve-today-words-level-weight]] · 개선 항목: [[IMP-0028-오늘의단어-단계우선가중]]

## 체크포인트
- [16:xx] 착수 — 이력서 설계·`setGenerator.ts`·`sessions.ts`(POOL_SELECT·createVocabSession)·라우트·기존 시험(task008/task042/seam)·`getProfile` 선례 읽음. 전용 미러 `~/.node-local/thekaiwa-lw053` 생성(predeploy node_modules `cp -al`).
- [16:xx] setGenerator.ts 구현(`LevelCode`·`LEVEL_ORDER`·`levelFactor`·`ceilingOf`·`LEVEL_FACTOR_FLOOR`·`SetCandidate.jlpt?`·`generateWordSet(…, ceiling?)`) + sessions.ts(`POOL_SELECT.jlpt`·`levelCeilingFor`·`createVocabSession` 천장 전달). tsc 0.
- [16:xx] 시험 `src/modules/learning/__tests__/task053.test.ts` 작성 → 20 pass. 변이 6종 중 M3(바닥 가중 제거)이 안 잡혀서 "계수 0 단어는 시드마다 다르게 채워진다" 시험 추가 → 21 pass, M3 이제 잡힘.
- [16:xx] 문서 `docs/design-spec.md` §7-2 갱신. 최종 tsc·eslint·learning 전체 시험 통과 → **완료, 인계 대기**.

## 완료 — 변경 파일
| 파일 | 내용 |
|---|---|
| `src/modules/learning/vocab/setGenerator.ts` | 단계 코드 순서·`levelFactor`·`ceilingOf`·`LEVEL_FACTOR_FLOOR`(1e-9)·`SetCandidate.jlpt?`·`generateWordSet(pool,count,rng,now,ceiling?)`. `ceiling` 없으면 `weightOf(c, now)` 그대로(난수 소비 순서 불변) |
| `src/modules/learning/vocab/sessions.ts` | `POOL_SELECT` 에 `jlpt`, `levelCeilingFor(userId, read=getProfile)`(트랜잭션 밖, 실패 시 `undefined`), 내 단어장 세트의 `generateWordSet` 에만 `ceiling` 전달 |
| `src/modules/learning/__tests__/task053.test.ts` | 신규 21 시험(아래) |
| `docs/design-spec.md` | §7-2 공식에 「× 단계 계수」 + 단계 계수 불릿(사용자 결정·이론 비중) — **이력서에 적힌 `docs/design/design-spec.md` 는 없는 경로, 실제 정본은 `docs/design-spec.md`** |

건드리지 않음: `topicSet.ts`·재풀기(`replayVocabSession`)·`pickChoices`·라우트 파일·스키마·화면·`prisma/`. 라우트 파일은 **수정 0** 이라 라우트 층 시험은 새로 만들지 않았다(기존 `task049TopicWordsSeam.test.ts` 가 라우트 이음매를 그대로 통과).

## 프로필 출처 결정 (설계 3번)
- **모듈이 `@/modules/preferences` 의 `getProfile` 로 읽는다**(라우트 수정 0). 이유:
  1. 라우트 `POST /vocab/sessions` 는 `count` 를 **생략했을 때만** `getProfile` 을 읽는다(`input.count ?? (await getProfile(...)).dailyWordCount`). "이미 읽고 있다"가 아니라 조건부라, 옵션 전달로 가면 라우트가 항상 읽도록 바꾸고(`count` 가 있어도) 새 옵션 필드를 `CreateSessionOptions` 에 더해야 해서 변경이 더 크다.
  2. 라우트에서 읽으면 기존 `task049TopicWordsSeam.test.ts`(`count:10` 을 주며 진짜 `getProfile` 은 안 바꿔 둠)가 DB 접속을 시도하게 된다 — "기존 시험 수정 없이 통과" 조건과 충돌 위험.
  3. 6층 규칙: `learning/topics/index.ts`·`repetition/decision.ts`·`lessons/generate.ts` 가 이미 `@/modules/preferences` index 를 import 한다(허용). 기존 시험 중 내 단어장 경로(`topicId` 없음)로 `createVocabSession` 을 부르는 것은 0건(task042 는 전부 주제 경로) — 시험 영향 없음.
- `count` 생략 시 라우트와 모듈이 각각 `getProfile` 을 한 번씩 읽는다(upsert 2회, 지연 무시 가능 — 순수 계산은 250세트 ≈ 450ms, 세트당 약 1.8ms).
- 읽기는 트랜잭션 **밖**(사용자 행 잠금 시간 불변). 프로필 읽기 실패·이상한 값 → `undefined` → 변경 전 동작.

## 설계와 달라진 점 / 보충
1. 바닥 가중은 **계수에 적용**(`weight = base × recency × max(levelFactor, 1e-9)`) — 절대 가중이 아님. 계수 1 이상인 후보는 영향 없음.
2. `levelFactor`·`ceilingOf` 인자 타입을 `string | null | undefined` 로 받는다(모르는 값 → 1 / `undefined`) — DB enum 이 보장하지만 방어적으로.
3. 바닥 가중이 하는 일을 정확히 적어 둔다: 가중 0 을 그대로 두면 키가 `−∞` 가 돼도 정렬 동점 처리(`x.i − y.i`) 때문에 **채움 자체는 되지만 항상 id 앞쪽 단어만** 들어간다(그리고 `u=1` 이면 `0/0=NaN` 키가 비교자를 깨뜨릴 수 있다). 바닥 가중은 채움이 시드마다 달라지게 하고 그 NaN 경로를 없앤다 — 변이 시험으로 확인.

## 시험 내용 (21)
- 계수 표(천장 5 × 단어 5 전부 + 이력서 표 값 + 단계/천장 없음·모르는 값 → 1) · `ceilingOf`(높은 쪽·목표 없음·모르는 값)
- 호환: 변경 전 구현이 만든 **고정 기대값 2건**(`git show HEAD:…` 의 구현으로 생성) + 변경 전 본문 복제와의 비교(ceiling 생략/null/undefined × 60 시드, 단계 붙은 후보) + 단계 없는 후보(모든 천장 × 20 시드) + 천장 이하만 있는 풀 + 입력 순서 무관
- 분포(합성 풀 676/629/1,649/1,767/3,034, 250세트×10장, 시드 고정): 이론 표 일치(71.4/19.9/8.7/0/0 · 35.8/33.3/26.2/4.7/0 · 풀 비중), 천장 N5/N4/N1/없음 각각 ±4%p, 천장 N5 의 N1+N2 = 0장, 천장 N4 의 N1 = 0장, N5≈N4, 천장 없음 대비 N1+N2 비중 감소, 오답 가중은 그대로 곱해짐
- 채움: 전부 천장+3 이상 → `min(count, 풀)`, 천장 이하·근처 먼저 + 모자란 만큼만 계수 0, 후보 충분하면 계수 0 미출현(100 시드), 계수 0 끼리 시드마다 다름, 단계 없는 후보(계수 1)가 먼저
- `levelCeilingFor`: 높은 쪽·읽기 실패(throw·reject)·이상한 값 → `undefined`

## 변이 시험 결과 (미러 사본에만 적용·복원 확인)
| 변이 | 결과 |
|---|---|
| `d===1` 계수 0.3→0.4 | 2 fail (잡힘) |
| `ceilingOf` max→min | 2 fail |
| 바닥 가중 제거 | 처음엔 0 fail(안 잡힘) → 시험 추가 후 1 fail |
| `ceiling` 무시 | 6 fail |
| `d≤0` 계수 1→0.9 | 2 fail |
| `d` 부호 뒤집기 | 10 fail |

## 실행 증빙 (미러 `~/.node-local/thekaiwa-lw053`, DB 접속 없음)
- `./node_modules/.bin/tsc --noEmit` → 출력 없음, exit 0
- `./node_modules/.bin/eslint src/modules/learning src/app/api/v1/vocab` → 출력 없음, exit 0
- `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 $(find src/modules/learning -name '*.test.ts' | sort) src/app/api/v1/__tests__/task049TopicWordsSeam.test.ts` → `# tests 464  # pass 464  # fail 0` (task053 21건 포함, 기존 시험 수정 0)
- 단독 `task053.test.ts` → `# pass 21 # fail 0` (≈3.7s)
- 실측 비중(250세트×10장, 시드 `Cdist-x*`, %): 천장 없음 9.0/7.5/21.4/22.3/39.9 · **천장 N5 72.0/19.0/9.1/0/0** · **천장 N4 35.8/32.5/27.0/4.7/0** · 천장 N3 19.2/16.3/45.1/15.3/4.1 · 천장 N2 12.5/9.7/29.4/31.2/17.2 · 천장 N1 = 천장 없음과 동일

## 미확인
- 진짜 DB 로 `createVocabSession` 을 돌린 통합 실행(DB 접속 금지) — `jlpt` select·`getProfile` upsert 경로는 tsc 와 단위 시험만으로 확인. QA 가 QA 계정으로 40세트 분포를 보면 확인된다.
- 실제 `Profile.level`/`goalLevel` 변경에 따른 천장 이동(프로필 → `levelCeilingFor` 는 가짜 reader 시험만).
- 생성 지연 실측(순수 계산 세트당 약 1.8ms 외에 `getProfile` upsert 1회 추가).

## 미커밋 파일 (내 것만)
`src/modules/learning/vocab/setGenerator.ts` · `src/modules/learning/vocab/sessions.ts` · `src/modules/learning/__tests__/task053.test.ts`(신규) · `docs/design-spec.md` · `agent-vault/10-Flow/tasks/task-053-dev-record.md`(신규). `git status` 에 보이는 `src/components/scenario/__tests__/logic.test.ts`·task-054·IMP-0029 등은 내가 건드리지 않았다.
