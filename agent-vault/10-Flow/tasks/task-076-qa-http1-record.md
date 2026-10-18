---
task_id: task-076
role: qa
record: qa-http1
created: 2026-10-18
updated: 2026-10-18
tags:
  - type/task-record
  - domain/challenge
  - domain/lesson
  - domain/vocab
---

# task-076 QA 기록 — 서버 실제 HTTP 검증 1부 (QA1 계정 · 127.0.0.1:3011 · APP_ENV=LOCAL)

> 이력서 [[task-076-improve-challenge-level-generation]] · 서버 감사 [[task-076-reviewer-server-record]]. 코드 수정 없음, HTTP 호출만. 쿠키·비밀 값은 기록하지 않는다.

## 시작 상태 (원상 복구 기준 — 맨 위 고정)

- QA1 `GET /settings/profile` (시작 시점): `level=N5` · `goalLevel=null` · `goalTopics=null` · `goalDeadline=null` · `politeness=POLITE` · `dailyWordCount=10` · `dailyMinutes=15` · `strictness=STRICT` · `correctionMode=FLUENCY` · `explainLang=ko` · `explainDepth=NORMAL` · `showFurigana=true` · `showHangul=true` · `showTranslation=false` · `displayName=null` · `teacherName=유우` · `updatedAt=2026-10-11T08:09:26Z`
- `GET /challenges/today` (시작): `challenge=null` (진행 중 없음, 끝낼 것 없음)
- 복구 의무: 끝날 때 profile 을 위 값으로 `PUT`(level=N5, goalLevel=null) 후 `GET` 확인, 만든 챌린지 전부 `end`.

## 진행 로그 (체크포인트)

(아래에 append)

### 체크포인트 1 — 항목 A 완료 (챌린지 생성 7회 사용 / 한도 12회 중 · 전부 end 됨)

- 주제: «주말 계획» (id `cmuihjv9i0013w1dgfxsr6q74`, 주제 난이도 **X = N4**). 기본 본문 `{lengthDays:7,start:'TODAY',dailyGoal:{lesson:true,words:true,wordCount:5}}`. 에러 응답 모양은 `{success:false,data:{code,details},message}`.
- **A-1 거절 12종 → 전부 PASS**: `"N6"`·`"n3"`·`" N3"`·`"N3 "`·`"N3\n"`·`"Ｎ３"`(전각)·`3`·`0`·`true`·`["N3"]`·`""`·`{}` → HTTP 400 `data.code='VALIDATION'`, `data.details={field:'level',reason:'N5|N4|N3|N2|N1'}`. 이 시도로 만들어진 챌린지 0건(`/challenges?status=ALL` 0건 유지).
- **A-2 unknown_key → PASS**: `{foo:1}`·`{level:'N3',foo:1}`·`{Level:'N3'}` → 400 `VALIDATION` `details={field:<그 키>,reason:'unknown_key'}` (`level` 과 함께 보내도 `foo` 를 먼저/함께 거절, 만든 행 0).
- **A-3 저장 level 표 → 전부 PASS** (응답·#157·#155 `status=ALL`·#158 `challenge.level` 4곳 모두 같음, end 후 #157 도 같음 = 얼려짐):

| 요청 level | 응답 level | #157 | #155 | #158 | 기대 | 판정 |
|---|---|---|---|---|---|---|
| (생략) | N4 | N4 | N4 | N4 | N4(X) | PASS |
| `null` | N4 | N4 | N4 | N4 | N4(X) | PASS |
| N5 | N5 | N5 | N5 | N5 | N5 | PASS |
| N4 | N4 | N4 | N4 | N4 | N4 | PASS |
| N3 | N3 | N3 | N3 | N3 | N3 | PASS |
| N2 | N2 | N2 | N2 | N2 | N2 | PASS |
| N1 | N1 | N1 | N1 | N1 | N1 | PASS |

- **A-4 진행 중 1개 제한 → PASS**: 진행 중일 때 두 번째 #156 → HTTP 409 `data.code='CONFLICT'`, `details={reason:'ACTIVE_EXISTS',challengeId:<진행 중 id>}`. (계약 표기 `409 ACTIVE_EXISTS{challengeId}` 와 달리 코드 필드는 `CONFLICT` + `reason:'ACTIVE_EXISTS'` — 기존 task-041 동작 그대로이며 task-076 변경 아님. OBSERVED.)
- 끝난 뒤 `/challenges/today` challenge=null 확인(정리 상태: 진행 중 0).
- 다음: B (프로필을 N4/goal N3 으로 바꾼 뒤 #58 관찰) — **프로필 복구 필수(level=N5, goalLevel=null)**.

### 체크포인트 2 — 항목 B 완료 (챌린지 생성 누계 10회 / 한도 12 — 항목 C 용 1회 + 여유 1회 남음 · 전부 end 됨)

QA 서버 DB 의 주제는 N5 3개(자기소개·카페 주문·길 묻기)·N4 2개(주말 계획·여행 이야기)뿐이라 N3 이상 주제는 없다. 추천 주제는 «주말 계획»(주제 난이도 N4) 또는 «자기소개»(N5).

| # | 조건 | 관찰한 #58 `recommendation` | 기대 | 판정 |
|---|---|---|---|---|
| B-1 | 챌린지 없음 · level N4 / goalLevel N3 | `level`=N4(주제 난이도), `lessonLevel`=**N3**, `levelSource`=**GOAL**, `reason`=START | lessonLevel N3·GOAL, rec.level 은 주제 난이도(≠ lessonLevel) | PASS |
| B-2 | goalLevel null · level N4 | `level`=N4, `lessonLevel`=**N4**, `levelSource`=**LEVEL** | 프로필 level·LEVEL | PASS |
| B-3 | level N3 / goalLevel N4 (목표가 더 쉬움) | `level`=N4(주제), `lessonLevel`=**N4**, `levelSource`=**GOAL** | `goalLevel ?? level` 이므로 N4 (관찰만) | OBSERVED — 예고대로 목표가 level 보다 쉬워도 목표를 따른다 |
| B-3b | level N5 / goalLevel N5 | 주제 «자기소개»(N5), `lessonLevel`=N5, GOAL | (추가) | OBSERVED |
| B-3c | level N2 / goalLevel N1 | `recommendation`=**null**(N2 주제가 DB 에 없어 추천 주제 없음 → 새 칸도 없음) | (추가) | OBSERVED — 추천이 없으면 `lessonLevel` 도 없다(null 안전). 이 계정 데이터 한계 |
| B-4 | 챌린지 진행 중(N2 선택 · 주제 N4 · 오늘 시작 · 수업 과제 켜짐) · 프로필 N4/goal N3 | `level`=N4(주제), `lessonLevel`=**N2**, `levelSource`=**CHALLENGE**, `reason`=**CHALLENGE** | N2·CHALLENGE·CHALLENGE | PASS |
| B-4' | 같은 챌린지를 end 한 직후 | `lessonLevel`=N3, `levelSource`=GOAL, `reason`=START (즉시 프로필 규칙으로 복귀) | (추가) | PASS |
| B-5 | 챌린지 `start:'TOMORROW'`(N2, 시작 전) | `lessonLevel`=**N2**, `levelSource`=**CHALLENGE**, **`reason`=START**(CHALLENGE 아님). #158 `challenge.status`=ACTIVE·`startDate`=내일·`today`=null | 관찰만 | OBSERVED — 알려진 한계 그대로: 시작 전도 «진행 중»으로 T 에 포함되고, `reason:'CHALLENGE'` 는 기간 안일 때만이라 **새 칸(CHALLENGE)과 reason(START)이 어긋난다** |
| B-6 | 챌린지 수업 과제 끔(`dailyGoal.lesson:false`, 단어만 · N2 · 오늘 시작) | `lessonLevel`=**N2**, `levelSource`=**CHALLENGE**, `reason`=START | 관찰만 | OBSERVED — 수업 과제를 꺼도 T 는 챌린지 난이도(개발자 기록 «문자 그대로» 와 일치), reason 은 수업 과제 켜짐일 때만 CHALLENGE |

- 프로필은 B 도중 level/goalLevel 을 여러 번 바꿨다. **현재 N4 / goal N3 (항목 C 기준 상태)** — 마지막에 level=N5·goalLevel=null 로 복구해야 한다.
- 생성한 챌린지(B): `cmvdoi5ak000jw17atbw3jwig`(B-4) · `cmvdoi64u000lw17ac9d34q97`(B-5) · `cmvdoi6wq000nw17ay0hy2it8`(B-6) — 모두 end 확인(`status=ENDED`). A 에서 만든 7개도 모두 ENDED.

### 체크포인트 3 — 항목 C 완료 (챌린지 생성 누계 **12회 = 한도 12 사용** · 전부 end 됨)

방법: `POST /vocab/sessions {count:30}`(내 단어장 세트 — `topicId` 없음, `mode` 생략 = FLIP) → 카드 `wordId` 를 `GET /words/:id` 의 `jlpt` 로 단계 판정 → 답 0장으로 `POST /vocab/sessions/:id/finish`(= `ABANDONED`, 기록·스냅샷·카운터 변화 0 — 다음 세트를 만들려고) → 반복. 세트당 30장 × 10세트 = 300장. 프로필 level N4 / goalLevel N3(천장 N3). 공용 기본 단어 풀 7,757개(보관 0): N5 678 · N4 629 · N3 1,649 · N2 1,767 · N1 3,034.

| 시나리오 | 세트 | 카드 | N5 | N4 | N3 | N2 | N1 |
|---|---|---|---|---|---|---|---|
| P1 챌린지 없음 (천장 N3 = max(N4, goal N3)) | 10/10 성공 | 300 | 60 (20.0%) | 58 (19.3%) | 125 (41.7%) | 48 (16.0%) | 9 (3.0%) |
| 이론 기대 P1 (풀 개수 × 계수 1·1·1·0.3·0.05) | | | 18.6% | 17.3% | 45.3% | 14.6% | 4.2% |
| P2 챌린지 **N5** 진행 중 (천장 N5) | 10/10 성공 | 300 | 220 (73.3%) | 53 (17.7%) | 27 (9.0%) | 0 (0%) | 0 (0%) |
| 이론 기대 P2 (계수 1·0.3·0.05·0·0) | | | 71.4% | 19.9% | 8.7% | 0% | 0% |
| P3(추가) 챌린지 **N1** 진행 중 (천장이 위로) | 10/10 성공 | 300 | 24 (8.0%) | 28 (9.3%) | 59 (19.7%) | 51 (17.0%) | 138 (46.0%) |
| 풀 그대로(가중 없음) | | | 8.7% | 8.1% | 21.3% | 22.8% | 39.1% |

- **C-1 챌린지 N5 쪽에서 N5 비중 증가·N3/N4 감소 → PASS**: N5 20.0% → 73.3%, N3 41.7% → 9.0%, N2·N1 16.0%·3.0% → 0%·0%. 실측이 풀 구성 기반 이론값(단계 계수 1/0.3/0.05/0/0)과 ±3%p 안에서 일치한다(표본 300장×시나리오).
- **주의(기대 문구 보정)**: 「N3 단어 가중 거의 0」은 **가중(계수 0.05)** 이지 **비중** 이 아니다. N3 풀이 1,649개로 N5(678)·N4(629)보다 커서 N3 가 챌린지 N5 에서도 약 9% 나온다 — 구현 결함이 아니라 설계 계수 그대로의 결과(이론 8.7%). 단계 계수가 의도한 뜻(너무 어려운 단어를 눌러 줌)은 N3 41.7% → 9.0% 로 나타난다.
- **C-2 챌린지 중 내 단어장 세트가 5xx 없이 생성 → PASS**: 챌린지 N5·N1 진행 중 각 10/10 `200`, 챌린지 없음 10/10 `200`. 병렬 읽기 실패 폴백(가중 없이 세트)은 이번 HTTP 로는 유발할 수 없어 감사 기록(R10)에 맡긴다.
- **C-3(추가) 천장이 위로 올라가는 방향 → PASS**: 챌린지 N1 이면 프로필 천장(N3)과 무관하게 N1 이 3.0% → 46.0%(풀 그대로 39.1% 근방)로 늘고 N5 는 20.0% → 8.0%. D6 A(진행 중 챌린지가 있으면 그 난이도가 천장) 와 일치. 단 N2 17.0%(풀 22.8%)·N1 46.0%(39.1%) 는 300장 표본 변동(약 ±2.4σ)이며 방향성만 판정한다.
- 세트 생성 확인 중 만든 세트 총 31개(`ABANDONED` — 시작 점검용 1개 포함), `IN_PROGRESS` 0개.

## 원상 복구 확인 (끝)

- 챌린지: 이번에 만든 12개 전부 `ENDED`. `/challenges?status=ACTIVE` 0건, `/challenges/today` challenge=null (`recentlyEnded` 만 있음).
- 프로필: `PUT {level:'N5', goalLevel:null}` 후 `GET` — 시작 값과 비교해 `updatedAt` 외 차이 0 (level N5 · goalLevel null · 나머지 필드 불변).
- 만든 `ABANDONED` 세트·`ENDED` 챌린지 행은 남아 있음(삭제 API 없음 — 계정 QA1 전용, 점수·기록 변화 0).

## 최종 판정 — **PASS (결함 0건)**

| 항목 | 판정 | 요약 |
|---|---|---|
| A. #156 `level` 검증 | **PASS** | 거절 12종 400 `VALIDATION field=level`, `unknown_key` 3종 400, 저장 level 7종(생략·null=주제 난이도 N4, N5/N4/N3/N2/N1=그 값) 응답·#157·#155·#158 4곳 일치·end 뒤에도 유지, 진행 중 1개 제한 409 확인 |
| B-1 목표 있음 | PASS | lessonLevel N3 · GOAL · rec.level N4(주제) |
| B-2 목표 null | PASS | lessonLevel=level(N4) · LEVEL |
| B-3 목표가 더 쉬움 | OBSERVED | level N3/goal N4 → lessonLevel N4(`goalLevel ?? level`) |
| B-4 챌린지 진행 중 | PASS | lessonLevel N2 · CHALLENGE · reason CHALLENGE · rec.level N4 |
| B-5 시작 전(TOMORROW) | OBSERVED | lessonLevel N2 · CHALLENGE 인데 reason=START(알려진 한계: 새 칸과 reason 이 어긋남) |
| B-6 수업 과제 끔 | OBSERVED | lessonLevel N2 · CHALLENGE · reason=START(수업 과제 꺼도 T 는 챌린지 난이도 — 개발 기록과 일치) |
| C. 내 단어장 세트 천장 | **PASS** | 챌린지 N5: N5 20.0→73.3%, N3 41.7→9.0%, N2/N1 → 0%, 5xx 0, 이론값과 일치 |

- 결함 번호 없음. Leader 판단 거리(결함 아님): ① B-5 시작 전 챌린지에서 `lessonLevel/levelSource`(CHALLENGE) 와 `reason`(START) 가 어긋남 — 화면이 두 값을 같은 문장에서 쓰면 문구가 상충할 수 있다(개발 기록 한계 ①과 동일, 폰 확인 거리). ② B-6 단어만 챌린지가 회화 수업 수준까지 바꾼다(규칙 «문자 그대로»).
- 이 문서가 못 본 것(NOT_VERIFIED): 화면(360/390/412)·실기기 · 실제 주제 수업 생성(#59, LLM) 이 T 를 쓰는지 · 챌린지 주제 새 단어 A12 수준 · 병렬 읽기 실패 폴백 — 이번 1부는 HTTP 만, LLM 호출 없음.
- 프로세스·산출물: 서버 기동/종료 없음, 임시 파일은 스크래치패드에만(프로젝트에 남긴 파일은 이 기록 파일 하나). 다른 `claude --print` 프로세스 1개는 이 QA 호출 이전부터 있었음(내가 띄운 것 아님).
