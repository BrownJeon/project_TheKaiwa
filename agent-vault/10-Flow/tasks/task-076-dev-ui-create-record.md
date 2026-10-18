---
task_id: task-076
role: developer
scope: "화면 A — 챌린지 만들기 흐름(①·③·④) + 계획표 챌린지 카드"
tags:
  - type/task-record
  - domain/challenge
created: 2026-10-18
updated: 2026-10-18
---

# task-076 developer 기록 — 화면 A (챌린지 만들기 + 계획표 카드)

> 이력서: [[task-076-improve-challenge-level-generation]] · 서버 기록: [[task-076-dev-server-record]] · 정본: `docs/screens.md` §33 · 승인 데모 v2(`docs/demo/task-076-challenge-level-v2.html`)

## 한 줄 요약
챌린지 만들기 ③ 「목표를 정해요」 맨 위에 난이도 알약 5칸(native radio, 두 줄 이름/코드)·비교 줄·안내 줄을 넣고, ④ 확인에 「난이도」 줄, ① 주제 뱃지·설명과 계획표 카드 부제를 「이름 (코드)」 표기로 바꿨다. 고른 값은 초안(`Draft.level`)에 남고 #156 본문 `level` 로 늘 보낸다. **미커밋.**

## 변경 파일
| 파일 | 내용 |
|---|---|
| `src/components/challenge/challengeCopy.ts` | 새 문구(데모 문구 표 그대로): `q3Title`·`levelQ`·`levelBody`·`levelSr.*`·`levelCompareHead.*`·`levelHigh(d)`·`levelLow`·`rowLevel`·`rowLevelSame`·`rowLevelDiff(t)`/`rowLevelDiffHead`·`COPY.planLevel(lv)` · `q1Body` 쌍점 꼴 + `q1BodyParts`. 난이도 이름은 적지 않음 |
| `src/components/challenge/logic.ts` | `Draft.level: JlptLevel \| null`(+`EMPTY_DRAFT`·`parseDraft` — 옛 초안/잘못된 값 = null) · `isJlptLevel` · `selectedLevel` · `levelRank` · `levelHint`/`levelHintText`(D8 A) · `LevelContext` · `levelPillSr` · `levelCompareGroups`/`levelCompareText`(D3 A) · `confirmLevelNote` · `planLevelText`(D10 A) · `createBody`(#156 본문, level 늘 포함) |
| `src/components/challenge/createParts.tsx` | 새 `LevelText`(nowrap 한 덩어리) · `TopicLevelsBody`(① 설명) · `LevelPills`(native radio 5칸, 두 줄 aria-hidden + sr-only) · `ConfirmLevelValue`(④ dd) · `LevelCompareLine`(묶음 nowrap) · `TopicRadioCard` 뱃지 = `LevelText` |
| `src/components/challenge/ChallengeCreateScreen.tsx` | props `myLevel`·`goalLevel` · ① 설명 `TopicLevelsBody` · ③ `GoalStep` 재구성(h2 `q3Title` headRef → 난이도 fieldset(aria-describedby 비교 줄, aria-live 안내) → `mt-5 border-t pt-4` → 하루에 할 것 fieldset(h3 `q3`, 내용 불변)) · ④ 주제 줄 「· 코드」 삭제 + 「난이도」 줄 · `?again=` 이 #157 `level` 을 초안에 · 본문 `createBody` |
| `src/components/challenge/ChallengePlanCard.tsx` | 진행 중/내일 시작 카드 부제 = `<nowrap>난이도 중급 (N3)</nowrap> · <nowrap>10월 18일 ~ 10월 24일</nowrap>` |
| `src/app/(app)/plan/challenge/new/page.tsx` | 이미 부르는 `getProfile` 의 `level`·`goalLevel` 을 props 로(한 줄 + 머리 주석) |
| `src/components/challenge/__tests__/level076.test.ts` | 새 시험 17개(아래) |

## §33 과 어긋난 곳 · 구현 결정
1. **프로필 수준 읽는 곳(결정)**: 새 API·클라이언트 요청 없이 `page.tsx` 가 이미 부르는 `getProfile` 값을 props 로 넘겼다(담당 파일 목록 밖이지만 화면 A 전용 경로 파일 — 화면 B 와 겹치지 않음). 그래서 「프로필 읽기 실패」 경로는 새로 생기지 않는다(그 경우 지금도 페이지 자체가 실패). 컴포넌트는 `myLevel`/`goalLevel` 이 null 이면 그 묶음·꼬리말·안내만 빼고 고르기는 그대로 되게 짰다.
2. **#156 `level` 은 늘 보낸다(결정 — §33-3 은 「선택」)**: 손대지 않았으면 주제 난이도 값을 싣는다. 이유: 확인 단계에 보인 값 = 저장 값(주제 목록을 읽은 뒤 주제 난이도가 바뀌어도 사용자가 본 값으로 만든다). 서버는 같은 값이면 생략과 결과가 같다. 옛 서버(400 `unknown_key`)와는 맞지 않으므로 **L9(서버 먼저 배포)** 전제.
3. **알약 꼬리말 순서**: §33-2 의사코드(내 수준 → 내 목표 → 이 주제 기본)를 따랐다. 데모 스크립트 내부는 이 주제 → 내 수준 순으로 조립하지만 데모 낭독 표·§33 P1 예시(「초급 (N4), 내 수준, 이 주제 기본」)가 §33-2 와 같아 정본대로.
4. **계획표 날짜 꼴**: 데모는 「10/18 ~ 10/24」로 그렸지만 §33-2 가 `{md(start)} ~ {md(end)}`(지금 꼴 「10월 18일 ~ 10월 24일」)라 날짜 꼴은 바꾸지 않고 nowrap 만 더했다.
5. **designer/Leader 확인 필요(Low)**: `levelBody` 「…처음엔 주제 난이도로 골라 두었어요.」는 [다시 도전](`?again=`)으로 들어와 ③ 으로 돌아간 경우 사실과 다를 수 있다(그때 처음 값 = 지난 챌린지 난이도). 데모 문구 표에 대안이 없어 문구는 그대로 두었다.
6. **알려진 레이아웃 영향**: 계획표 카드 부제가 길어져(「난이도 최상급 (N1) · 10월 18일 ~ 10월 24일」) 360px·글꼴 130% 에서 두 줄이 되면 카드가 약 17px 길어진다 — 자리표시 높이 `PLAN_SKELETON.challengeCardH`(278.4, 100% 실측)와 차이. §33 범위 밖이라 그대로 둠(QA 실측 항목).

## 시험 갱신 (`level076.test.ts`, 17개 — 동작 13 · 배선 3 · 표기 1)
| 시험 | 보는 것 |
|---|---|
| 표기 정본 | 다섯 단계 `LevelText`·`planLevelText`·`levelPillSr`·비교 묶음이 `SEED_PACK_LABEL` 과 바이트 일치 |
| 조사 없음 | 새 문구 전 조합(5×5)에 「(N4)은/는…」 꼴 없음 |
| 보이는 선택 D9 A | 손대지 않음 → 주제 따라감 / 고름 → 주제 바꿔도 유지 / 주제와 같은 값을 골라도 유지 |
| 초안 | level 왕복 · 옛 초안(칸 없음) = null · 잘못된 값 6종 = null |
| 안내 줄 D8 A 전수 | 내 수준 5 × 고른 값 5 = 25칸, 차이 −4..+4 전부 문구 단언 · 내 수준 모름 = 비움 |
| 비교 줄 D3 A | 목표 있음/없음/내 수준 모름/둘 다 없음 |
| 비교 줄 렌더 | 묶음마다 nowrap span(「… ·」 포함), 목표 없으면 그 묶음만 빠짐 |
| 알약 sr 글 | 꼬리말 맞는 것만·순서 |
| 알약 렌더 | native radio 5·N5→N1·같은 name·고른 칸만 checked·role=radio 없음·min-h-12·13/11px·sr-only·선택/초점 모양 |
| #156 본문 | 손대지 않음 = 주제 난이도 · 고름 = 고른 값 · 단어 끔 → 장수 빠짐 · 실패 뒤 초안 재사용 = 같은 값 |
| ④ 확인 줄 | 다름 → 「이 주제 기본은 <nowrap>초급 (N4)</nowrap>」 / 같음 → 「이 주제 기본」 |
| ① 설명 | 쌍점 꼴 글 = `q1Body(...)`, 이름 (코드) 3덩어리, 목록 모름 = 「—」 |
| ① 주제 뱃지 | 「초급 (N4)」 한 덩어리, 코드만 없음 |
| 계획표 부제 | `<nowrap>난이도 중급 (N3)</nowrap> · <nowrap>날짜</nowrap>` |
| 배선 ×3 | 챌린지 파일에 난이도 이름 하드코딩 없음 · ③ 구조 순서(h2 headRef → fieldset describedby → aria-live(경고색 없음) → 구분선 → h3) · ④ 줄 순서·「· 코드」 없음·다시 도전 level·`createBody` |

기존 시험: 손대지 않음(`logic.test.ts` 초안 왕복 단언은 `level: null` 이 들어간 `EMPTY_DRAFT` 로 그대로 통과).

## 변이 점검 — 21/21 포착
임시 미러 `~/.node-local/thekaiwa-dev076-ui-mut`(소스 복사 + node_modules 심볼릭 링크)에서 파일 하나를 바꾸고(임시 파일 → `rename`) 챌린지 시험 6파일을 돌린 뒤 원본으로 되돌림. 끝난 뒤 `diff -rq` 차이 0 확인 → 임시 미러 삭제, 작업 미러·저장소 7파일 `cmp` 같음. 스크립트: 세션 스크래치 `mut076ui.mjs`.

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | 고른 값을 주제 변경 때 덮어씀(주제 우선) | 포착 | 보이는 선택 D9 A |
| M2 | 안내 임계 2→1 | 포착 | 안내 줄 전수 |
| M3 | 「쉬워요」 임계 −1→−2 | 포착 | 안내 줄 전수 |
| M4 | 요청에 level 누락 | 포착 | #156 본문 |
| M5 | 손대지 않으면 level 생략 | 포착 | #156 본문(결정 2 를 고정) |
| M6 | 초안 level 무시 | 포착 | 초안 · #156 본문 |
| M7 | 목표 없을 때 묶음 깨짐 | 포착 | 비교 줄 · 비교 줄 렌더 |
| M8 | 확인 dd 가 topic.level | 포착 | 배선 ④ (소스) |
| M9 | 알약 이름 하드코딩 | 포착 | 배선 이름 하드코딩 (소스) |
| M10 | 알약 checkbox | 포착 | 알약 렌더 |
| M11 | 비교 줄 묶음 줄바꿈 허용 | 포착 | 비교 줄 렌더 |
| M12 | 꼬리말 순서 바뀜 | 포착 | 알약 sr · 알약 렌더 |
| M13 | 다시 도전이 #157 level 버림 | 포착 | 배선 ④ (소스) |
| M14 | 계획표 부제 코드만 | 포착 | 계획표 부제 렌더 |
| M15 | 안내 줄 aria-live 빠짐 | 포착 | 배선 ③ (소스) |
| M16 | ① 주제 뱃지 코드만 | 포착 | ① 주제 뱃지 렌더 |
| M17 | 확인 작은 글 같음/다름 뒤집힘 | 포착 | ④ 확인 줄 렌더 |
| M18 | ① 설명 괄호 꼴 | 포착 | ① 설명 렌더 |
| M19 | 계획표 「난이도」 앞말 빠짐 | 포착 | 표기 정본 · 계획표 부제 |
| M20 | ③ h2 가 옛 제목 | 포착 | 배선 ③ (소스) |
| M21 | 확인 주제 줄 「· 코드」 되살림 | 포착 | 배선 ④ (소스) |

한계: M8·M9·M13·M15·M20·M21 은 소스 배선 시험으로만 잡힌다(`GoalStep`·`ConfirmStep`·다시 도전 효과는 라우터 훅이 있는 화면 안 함수라 정적 렌더를 하지 않음) — 실제 동작은 QA 화면 확인 몫.

## 증빙 (미러 `~/.node-local/thekaiwa-dev076-ui`)
미러에는 내 파일만 rsync(임시 파일 → rename, 링크 수 1 확인). 화면 B 파일은 미러에서 옛 판이라 아래 결과는 「화면 A + 서버 + 옛 화면 B」 조합이다 — 두 화면을 합친 최종 확인은 Leader/QA 몫.
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 0 |
| `./node_modules/.bin/eslint src/components/challenge/ "src/app/(app)/plan/challenge/new/page.tsx"` | 0(출력 없음) |
| 챌린지 시험 6파일 + `plan/__tests__/planSkeleton` + `scenario/__tests__/variant` | 66/66(새 시험 넣기 전) · 챌린지 6파일 52/52(새 시험 포함) |
| 전체 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)`(가짜 `DATABASE_URL`) | tests 4373 · pass 4368 · fail 0 · skipped 5 · rc 0 |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | 0(✓ Compiled successfully, 경고 1 = 기존 `persona/loader.ts` 파일 추적 경고 — 무관) |
| 변이 | 21/21 포착(위) |
| 데모 게이트 | `DEMO_GATE_PASSED` / `task: task-076` |

## 알려진 한계
- 360/390/412 × 글꼴 130% 실측은 하지 않았다(QA 가 실서버에서) — 클래스·크기는 §33·데모 값(칸 `min-h-12`, 이름 13px/코드 11px `text-ink2`, `grid-cols-5 gap-2`, 비교·안내 12.5px)을 그대로 옮겼다. 데모 실측상 360px·130% 알약 이름 여유 +6.6px — 실제 기기에서 「최상급」·「초보자」가 잘리면 첫 대책은 칸 사이 간격 8→6px(§33-7, designer 결정).
- 위 「어긋난 곳」 5·6.

## reviewer 가 볼 곳
- `logic.ts` 끝의 task-076 블록(순수 함수) · `createBody` 가 level 을 늘 싣는 결정(위 2).
- `createParts.tsx` `LevelPills`(native radio·sr-only 꼬리말·`peer-*` 모양) · `LevelCompareLine`(묶음 nowrap).
- `ChallengeCreateScreen.tsx` `GoalStep`(초점 `headRef` 이 h2 에 남는지, fieldset `aria-describedby`, `aria-live`) · `ConfirmStep` 줄 순서 · `?again=` 의 level.
- `page.tsx` props 2개(새 요청 없음).

## 폰 확인 제안
1. ③ 목표 단계: 알약 5칸이 두 줄(이름/코드)로 보이고 360px·글꼴 130% 에서 「최상급」·「초보자」가 잘리지 않는지.
2. TalkBack: 알약 한 칸이 「초급 (N4), 내 수준, 이 주제 기본, 라디오 버튼, 선택됨」처럼 한 번만 읽히는지(이름·코드 따로 두 번 읽지 않음), 묶음 진입 때 비교 줄이 설명으로 읽히는지.
3. 내 수준보다 2단계 위를 고르면 안내 줄이 잠시 뒤 읽히고, [다음]은 막히지 않는지.
4. 주제를 바꿔도(① 로 돌아가 다른 주제) 손대지 않았으면 새 주제 난이도로, 골랐으면 고른 값 그대로인지.
5. ④ 확인 「난이도」 줄과 만든 뒤 계획표 카드 「난이도 … · 날짜」가 같은 값인지.
6. 계획표 카드 [다시 도전] → ④ 에 지난 난이도가 채워지는지.

## 진행 체크포인트
- [착수] 데모 게이트 `DEMO_GATE_PASSED`(approved v2, hash verified). 미러 = 저장소 src 와 차이 0(착수 시점).
- [완료] 변이 21/21 · 전체 시험 fail 0 · build 0. 다음 = reviewer 화면 감사(화면 B 와 함께) → judge C2 → QA. 커밋은 Leader 지시.
- [구현 1차 끝] challenge 시험 52/52 · eslint 0 · tsc 0. 주의: 화면 B developer 가 저장소의 `lesson/**`·`vocab/{labels,topicCopy,TodayHome,TodayWordsCard,topicLogic,TopicWordsCard}` 를 동시에 고치는 중 — 미러에는 **내 파일만** rsync(그쪽 파일은 미러에서 옛 판). labels.ts 변경은 `todayLevelLine` 인자 추가뿐이라 내가 쓰는 `levelLabel`·`levelName`·`JLPT_LEVELS` 와 무관. 미커밋 파일: 위 「변경 파일」 전부 + 이 기록.
