---
task_id: task-053-054
title: "task-053·054 Reviewer 기록 (REV-183, 별도 파일)"
tags:
  - type/record
  - domain/vocab
  - domain/scenario
created: 2026-10-11
---

# task-053·054 Reviewer 기록

이력서: [[task-053-improve-today-words-level-weight]] · [[task-054-improve-roleplay-goal-translation]] · Developer 기록: [[task-053-dev-record]] · [[task-054-dev-record]]

## Reviewer 기록 (REV-183)

### 체크포인트
- [중간 1] 스냅샷 `~/.node-local/thekaiwa-rev183-src`(= `1a3f04d`, node_modules `cp -al` predeploy) 생성. tsc exit 0 · eslint(`src/modules/learning src/components/scenario src/app/api/v1/vocab`) exit 0. 전체 시험·`next build`는 진행 중. 코드 읽기 완료: setGenerator(levelFactor·ceilingOf·바닥 가중·ceiling 미지정 경로 = 변경 전 식 그대로), sessions(getProfile import·levelCeilingFor 트랜잭션 밖·POOL_SELECT.jlpt), topicSet(generateWordSet 4인자 호출 그대로), RolePlayGoalCard(훅이 조기 return 앞). 다음: 변이 4종(053) + 변이 1(054) + 변경 전 구현 대조(고정 기대값) + 시험·빌드 재현.
- [중간 2] 재현: tsc exit 0 · eslint exit 0 · 시험(components+learning+infra+types) `# tests 1559 / pass 1559 / fail 0` · `next build` exit 0. 053 고정 기대값 2건을 변경 전 구현(`git show 32d8fd6^:…/setGenerator.ts`)으로 직접 재생성 → 일치(w014…w023 / w013…w008). 변이(전용 사본 `…rev183-mut`, 원본 복원 diff 확인): M1 0.3→0.5 = 2 fail(잡힘) · M2 ceilingOf max→min = 2 fail(잡힘) · M3 FLOOR→0 = 2 fail(잡힘) · **M4 `sessions.ts` 가 `generateWordSet` 에 ceiling 을 안 넘김(M4a) / ceiling 항상 undefined(M4b) = 1551 pass 그대로 → 안 잡힘(시험 공백, QA 라이브로 넘김)**. (사본에 `tests/` 가 없어 `lessonInput.test.ts` 1건이 ENOENT 로 실패한 것은 변이와 무관 — 원본 스냅샷에서는 7 pass.)

### 최종 판정 (REV-183)

| task | 판정 | Critical | High | Med | Low |
|---|---|---|---|---|---|
| 053 (R2, standard) | **PASS** (QA 라이브로 넘기는 시험 공백 1건) | 0 | 0 | 1 | 3 |
| 054 (light) | **PASS** | 0 | 0 | 0 | 1 |

#### task-053 — 이슈
1. **[Med · 확실] 세션 생성 연결부 자동 시험 공백** — `src/modules/learning/vocab/sessions.ts:438,464`. 변이 M4a(`generateWordSet(...)` 에서 `ceiling` 인자 삭제)·M4b(`ceiling` 을 항상 `undefined`) 모두 learning+components+app 시험 1,551건 전부 pass → 안 잡힘. 기능 전체(천장 가중)가 이 두 줄에 걸려 있는데 `createVocabSession` 비주제 경로는 실 prisma 만 써서 가짜 주입 이음매가 없다(task042 시험은 전부 주제 경로). 권고: ① QA 라이브(QA 계정, 쓰기 후 원복)에서 `Profile.level` N5→N3 로 바꿔 40세트 단계 분포가 이동하는지 직접 확인(필수) ② 여유가 있으면 `createVocabSession` 에 `levelReader` 주입점을 `deps` 로 열어 비주제 경로 시험 추가.
2. **[Low · 가능성 높음] 프로필 읽기 실패가 조용히 삼켜진다** — `sessions.ts:419-426` `catch { return undefined }` 로그 없음. 가중이 사라져도 알 길이 없다. 다만 learning 모듈 전체에 logger 호출이 0건이라 코드베이스 관례와는 같다. 권고: 후속에 trace/로그 한 줄.
3. **[Low · 확실] `count` 를 생략하면 `getProfile`(upsert)을 라우트 `route.ts:37` 와 모듈이 각 1회, 총 2회 읽는다.** MySQL 에서 Prisma upsert 는 select+조건부 쓰기라 수 ms 수준(세트 p50 약 2.0초 대비 무시). 개발자 기록과 일치, 조치 불필요.
4. **[Low · 확실] 같은 시드 → 같은 세트 계약의 전제가 늘었다** — 천장(프로필)이 `VocabSession.seed` 에 저장되지 않아 "시드만으로 재현"은 이제 천장 없이는 불가. 시드로 세트를 다시 만드는 코드 경로는 현재 없음(`createRng` 호출은 전부 생성 지점, `requestedModeOf` 는 첫 글자만 읽음) → 오늘 동작에는 영향 0. 설계서 §7-2 의 「같은 시드 → 같은 세트」 문장에 「천장 포함」 한 마디 권고.
- 제품 결과 메모(결함 아님): 프로필 `level` 기본값이 N5 라서, 수준을 안 바꾼 사용자가 **직접 추가한 N2/N1 단어**도 ×0 이 된다(후보가 모자랄 때만 나옴). 사용자 결정(「3단계 이상 ×0」)의 직접 결과이며, QA 가 사용자 보고(「내가 넣은 어려운 단어가 안 나온다」) 가능성만 알고 있으면 된다.

#### task-053 — 질문별 확인 결과
1. `levelFactor` 표(천장 5×단어 5, 단계 없음·천장 없음·모르는 값 → 1)·`ceilingOf`(어려운 쪽·목표 없음·둘 다 모름 → undefined)가 설계와 같음 `[확실]`. 가중 최솟값 = `0.25×0.3×1e-9 ≈ 7.5e-11` > 0, `ln(u)` ∈ [−22.2, 0] → 키 최솟값 ≈ −3e11 유한, `u=1` 이어도 `0/양수=0` → NaN·Infinity·0 경로 없음 `[확실]`(코드 산술). `ceiling` 미지정: 삼항의 else 가 변경 전 `weightOf(c, now)` 그대로, `sampleWeighted`·`shuffle` 불변 → 난수 소비 순서 동일. 고정 기대값 2건을 변경 전 구현(`git show 32d8fd6^:…setGenerator.ts`)으로 직접 재생성해 일치 확인 `[확실]`. 복제형 `legacyGenerateWordSet` 은 새 모듈의 `weightOf`·`sampleWeighted` 를 재사용하므로 접착 코드만 지키고, `weightOf` 등의 표류는 고정 기대값 2건이 지킨다.
2. 6층: `sessions.ts` 의 `@/modules/preferences` import 는 eslint boundary(L105 learning→preferences 허용)와 선례 10개 파일(`challenges/store.ts` 등)에 맞고 eslint exit 0. 프로필 읽기는 `withTransaction` **밖**(`:438`), 실패 시 `undefined` = 변경 전 동작, 세트 생성을 막지 않음. `POOL_SELECT.jlpt` 추가는 `toCardSeed`(필드 선택 복사)·`distinctMeaningCount`·`pickChoices`·`sources: active`(타입상 여분 필드 허용)에 부작용 없음(tsc 0). 천장은 비주제 경로 `generateWordSet` 에만 전달; `topicSet.ts:357` 은 4인자 호출 그대로, 재풀기(`:894-910`)는 카드 복사라 불변. 후보가 전부 천장+3 이상이어도 `Math.min(count, sorted.length)` 로 채움(채움 시험 3건), `mode` 강등식(`pool.length<4 || distinctMeaningCount(active)<4`)은 한 글자도 안 바뀜.
3. 변이: M1(0.3→0.5) 2 fail · M2(`ceilingOf` max→min) 2 fail · M3(`FLOOR`→0) 2 fail → 잡힘. **M4 못 잡음(위 이슈 1).**
4. 설계서 `docs/design-spec.md` §7-2: 공식·계수 표(×1/0.3/0.05/0)·천장 정의·1e-9 바닥·이론 비중 3행·「주제 세트·다시 풀기·보기 생성은 바꾸지 않는다」가 코드·사용자 결정과 일치(이론 비중은 시험이 재계산해 일치 확인).
5. 추가 비용 = 프로필 읽기 1회(upsert) + 후보당 `rankOf`(길이 5 배열 `indexOf`) 2회 + `jlpt` 컬럼 1개. 7천 후보 정렬은 기존 id 정렬·키 정렬 그대로(복잡도 불변) `[확실]` 코드 판단.

#### task-053 — QA high_risk_areas
1. `createVocabSession` → `generateWordSet(…, ceiling)` 연결(시험이 못 잡음): QA 계정으로 `level`/`goalLevel` 을 N5/(없음)·N3/N1 로 바꿔 가며 세트 40개씩의 N1·N2 비중 이동 확인 후 원복.
2. 후보가 천장 대비 모자란/전부 어려운 계정: 세트가 `min(count, 풀)` 장으로 정상 생성되고 CHOICE→FLIP 강등이 그대로인지.
3. 주제 세트(`topicId`)와 「다시 풀기」가 분포 이동 없이 변경 전과 같은지(같은 카드 목록 복사).
4. 세트 생성 지연(이전 p50 약 2.0초) — 추가 upsert 1~2회.
5. 단계 없는 단어·직접 추가한 어려운 단어의 노출(제품 결과 메모).

#### task-054 — 이슈
1. **[Low · 확실] JSX 연결·켬 경로 자동 시험 없음** — `RolePlayGoalCard.tsx:104,120`. 변이 M6(`expressionKo(true, …)`)·M7(`false && ko`) 이 `roomRender.test.ts` 10건 pass 를 안 깨뜨린다(그 시험은 SSR 기본값=꺼짐으로만 그리고 칩에 뜻이 없음을 단정하지 않음), jsdom 류 도구가 repo 에 없음. 순수 함수 변이 M5(`!show`→`show`)는 잡힘(19 pass / 1 fail). 실질 위험은 낮아 아래 수동 대조로 갈음, 사용자 폰 확인 항목.

#### task-054 — 질문별 확인 결과
6. 훅 위치: `useDisplayPrefs()`(`:23`)가 `if (!v) return null`(`:25`) 앞 → 훅 순서 규칙 준수. **꺼짐 DOM 동일**: 전용 사본에서 변경 전 컴포넌트(`1a3f04d^`)와 신 컴포넌트를 `renderToStaticMarkup` 으로 8조합(goalOpen×checksHidden×usedIds)에서 비교 → 바이트 동일 `[확실]`(SSR 기본=꺼짐). 켬: 뜻 있으면 HangulLine 뒤·`sr-only` 앞에 `block` 한 줄(`text-[12px] break-keep [overflow-wrap:anywhere]`), 빈·공백뿐 뜻은 노드 없음, `<script>alert(1)</script>` 는 `&lt;script&gt;…` 로 이스케이프(React 텍스트 자식, `dangerouslySetInnerHTML` 없음) `[확실]`(켠 것으로 고정한 사본 렌더). 칩은 `inline-flex min-w-0 max-w-full` + 뜻 줄 `[overflow-wrap:anywhere]` 로 긴 뜻도 칩 안에서 줄바꿈, 영역은 기존 `GOAL_REGION_MAX`(`max-h-[40dvh] overflow-y-auto`) 안 `[가능성 높음]`(실측은 폰).
7. 즉시 반영: `useSyncExternalStore(displayPrefsStore.subscribe, getSnapshot)` + `emit()` 이 `snap` 교체·리스너 호출 → 방 안 카드를 포함한 모든 구독자가 `set`(낙관) 직후 재렌더 `[가능성 높음]`(코드 판독, 렌더 시험 불가).
8. light 한계 준수: 파일 3개(≤12), 신규 화면·마이그레이션·네이티브·인증 변경 없음, 시작 전 시트·결과 화면 무수정(diff 는 목표 카드 한 파일).
- 후속(Leader): 이력서 설계 3번 `docs/screens.md` 한 줄은 이 커밋에 없음(Leader 몫).

#### 공통 재현 (스냅샷 `1a3f04d`)
tsc exit 0 · eslint exit 0 · 시험(components+learning+infra+types) 1559/1559 pass · `next build` exit 0(경고 3건은 기존 `Dynamic filesystem access`, 무관). 저장소 변경 0(기록 파일만). 임시 사본 `~/.node-local/thekaiwa-rev183-src`·`…-mut` 은 저장소 밖에 남김.
