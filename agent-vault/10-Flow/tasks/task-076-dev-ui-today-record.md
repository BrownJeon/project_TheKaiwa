---
task_id: task-076
role: developer
scope: "화면 B — 오늘 탭 회화 뱃지(P6)·챌린지 단어 칩(P7)·내 단어장 세트 준비 줄(P10)"
tags:
  - type/task-record
  - domain/lesson
  - domain/vocab
created: 2026-10-18
updated: 2026-10-18
---

# task-076 developer 기록 — 화면 B (오늘 탭)

> 이력서: [[task-076-improve-challenge-level-generation]] · 정본 `docs/screens.md` §33(P6·P7·P10, 33-1a) · 승인 데모 v2(「D1~D11 권고대로 승인, 질문 5는 a로」) · 서버 계약 [[task-076-dev-server-record]] 「API 계약 변경」.

## 한 줄 요약
오늘 탭 회화 카드 두 곳(챌린지 없음 추천 카드·챌린지 카드)의 수준 뱃지를 「중급 (N3) · 내 목표/챌린지/내 수준」 + 낭독 「수업 난이도 중급 (N3), 내 목표 기준」으로(P6), 챌린지 단어 칩을 「챌린지 · 중급 (N3) · 「카페 주문」」(난이도 앞)으로(P7), 챌린지 진행 중 「내 단어장 세트」 준비 줄을 「챌린지 난이도(중급 (N3))까지의 단어가 주로 나와요.」로(P10, D6 A) 바꿨다. 서버·DB·화면 A 파일·075 파일 변경 없음.

## 변경 파일 (전부 미커밋)
| 파일 | 내용 |
|---|---|
| `src/components/lesson/lessonCopy.ts` | `LEVEL_SRC`(CHALLENGE 챌린지 · GOAL 내 목표 · LEVEL 내 수준) · 타입 `LessonLevelSource`·`LessonLevelBadge` · 순수 `lessonLevelBadge(level, source, fallback)` → `{text, sr}`(둘 중 하나라도 없으면 `{text: levelLabel(fallback), sr: null}`) · `levelLabel` 을 `vocab/labels` 에서 import |
| `src/components/lesson/TodayLessonCard.tsx` | 내부 `LevelBadge`(공용 `Badge` 그대로 + 안쪽 `whitespace-nowrap` span; 꼬리표 있으면 보이는 글 `aria-hidden` + `sr-only` 낭독) · 추천 카드 `lessonLevelBadge(rec.lessonLevel, rec.levelSource, rec.level)` · 챌린지 카드 `lessonLevelBadge(ctx.level, 'CHALLENGE', ctx.level)` |
| `src/components/vocab/topicCopy.ts` | `WORDS_CARD.chip(title, level?)` = `챌린지 · ${levelLabel(level)} · 「title」`(난이도 모르면 지금 모양) |
| `src/components/vocab/TopicWordsCard.tsx` | 칩에 `ctx.level` 전달(`TopicChip` 의 `truncate` 그대로) |
| `src/components/vocab/labels.ts` | `todayLevelLine(l, challengeLevel?)` — 챌린지 난이도가 오면 챌린지 문장(1인자 호출·기존 시험 호환) |
| `src/components/vocab/topicLogic.ts` | `ChallengeCtx.level` 타입 `string` → `JlptLevel`(원천 #158 `ChallengeSummary.level` 이 이미 `JlptLevel`, 호출부 모두 통과) · **순수 `mineSetChallengeLevel(res, todayKey)` = D6 A↔B 전환 한 곳**(B 면 본문 `return null` 한 줄, 서버 `mineSetCeiling` 과 함께) |
| `src/components/vocab/TodayWordsCard.tsx` | 선택 prop `challengeLevel` → `todayLevelLine(myLevel, challengeLevel)` (지금 카드·`MineSetPanel` 펼침 공용 몸통) |
| `src/components/vocab/TodayHome.tsx` | `mineChallengeLevel = challenge.state === 'ready' ? mineSetChallengeLevel(challenge.data, data?.today ?? nowKey) : null` → `wordsCardProps.challengeLevel`(myLevel 옆). 지금 카드·챌린지 카드 펼침 둘 다 이 props 를 받는다 |
| `src/components/vocab/__tests__/task076Today.test.ts` (새) | 11개 — 아래 표 |

## §33 와 어긋난 곳 · 결정 (designer/Leader 확인 필요 표시)
1. **P6 서버가 T 를 못 정한 경우(`lessonLevel`·`levelSource` null/없음)** — §33 에 없는 상태. 서버 기록은 「화면은 지금 뱃지 = `level`」이라 했으나 **D11(076 이 바꾸는 자리는 이름+코드)** 을 따라 **꼬리표 없이 `levelLabel(rec.level)`**(예 「초급 (N4)」, 낭독은 보이는 글 그대로)로 그렸다. 근거: 이 경우 서버 #59 도 주제 수업 수준을 `T ?? topic.level` = 주제 난이도로 만들므로 보이는 값이 실제 수업 수준과 같다. 코드(「N4」)만 원하면 `lessonCopy.ts` `lessonLevelBadge` 마지막 줄 하나만 바꾸면 된다. → **designer/Leader 확인 필요**(가벼움).
2. **P6 챌린지 카드의 값** — #58 추천이 아니라 #158 `ctx.level` + 출처 `CHALLENGE` 로 고정. 챌린지 카드는 기간 안 진행 중 챌린지에서만 보이고 그때 서버 T = 챌린지 난이도(진행 중 ⊂ 서버 「진행 중」)라 값이 같다. #58 이 실패해도 뱃지가 맞게 나온다.
3. **P10 「챌린지 진행 중」 판정** — 띠·카드 모드(`challengeCtxOf`, 기간 안만)가 아니라 **서버 가중 기준과 같은 집합**(`isChallengeInProgress`: ACTIVE ∧ 주제 있음 ∧ 종료일 ≥ 오늘 — **시작 전 포함**, 과제 켜짐 무관)을 #158 값으로 옮겼다. 그래서 ① 「내일 시작」 챌린지를 만든 날 ② 챌린지에 단어 과제가 꺼져 지금 단어 카드가 보일 때도 준비 줄이 챌린지 문장이다(서버가 이미 챌린지 기준으로 뽑으므로 문장이 맞다). 서버 기록의 「Leader 확인 권장(시작 전 포함)」과 같은 쟁점 — 서버를 바꾸면 이 함수도 같이 바꾼다.
4. 데모 D7 C(내 단어장 세트 카드 새 한 줄)·흐름 밖 N 뱃지(주제 고르기·평가·단어장)는 만들지/건드리지 않음(질문 5 a). 화면 문구는 데모 `#copy` 표 문구 그대로, 새 문구 없음.

## 시험 (새 `task076Today.test.ts` 11개)
| # | 내용 | 종류 |
|---|---|---|
| 1 | 출처 꼬리표 표 3칸(손 정답) | 동작 |
| 2 | 뱃지 글·낭독 5줄(손 정답, 데모 문구 표) | 동작 |
| 3 | 5단계 × 출처 3 = 15칸 `SEED_PACK_LABEL` 바이트 일치·조사 없음·주제 난이도 미사용 | 동작 |
| 4 | null 폴백 4종(둘 다 null·옛 응답 칸 없음·출처만 없음·수준만 없음) | 동작 |
| 5 | 칩 문자열(손 정답 + 5단계)·난이도가 「 앞·조사 없음·난이도 모름 = 지금 모양 | 동작 |
| 6 | `todayLevelLine` 분기(1인자 호환·null·undefined·챌린지·같은 단계·5단계) | 동작 |
| 7 | `mineSetChallengeLevel` 11줄 표(없음·기간 안·마지막 날·내일 시작·기간 지남 정산 전·다 함·그만둠·주제 지워짐·오늘 모름) + 카드 모드와 다른 점 | 동작 |
| 8 | 렌더: 지금 카드(챌린지 없음/있음)·챌린지 카드 펼침(`MineSetPanel`) 준비 줄 + P7 칩 마크업(sr 「챌린지 주제: 」 + truncate) | 렌더 |
| 9 | 렌더: 추천 카드 `aria-hidden` nowrap 보이는 글 + sr-only 문장, 주제 난이도 없음 / 옛 응답 폴백 | 렌더 |
| 10 | 렌더: 챌린지 카드 = 챌린지 난이도 + 「챌린지」(추천 GOAL 과 무관) | 렌더 |
| 11 | 배선 소스: `LevelBadge` 2곳·옛 `{rec|ctx.level}` 뱃지 0·이름 하드코딩 0(6파일)·TodayHome→TodayWordsCard→TopicWordsCard 연결 | 소스 |
- 기존 시험 수정 없음(`labels.test` `todayLevelLine('N5')`·`seedButtons` J13 그대로 통과 — 1인자 호환).

## 변이 점검 (임시 미러 `~/.node-local/thekaiwa-dev076-ui2mut`, 대상 시험 = task076Today·labels·seedButtons) — 17/17 포착
| # | 변이 | 결과 |
|---|---|---|
| M1 | 꼬리표 GOAL↔LEVEL 뒤바꿈 | 포착(3) |
| M2 | 추천 카드가 `lessonLevel` 대신 `level` | 포착(2) |
| M3 | 칩 순서 뒤집기(난이도 끝) | 포착(2) |
| M4 | 챌린지 없을 때도 챌린지 문장 | 포착(4, 기존 labels·seedButtons 포함) |
| M5 | null 폴백이 이름 없이 코드만 | 포착(2) |
| M6 | 출처 null 검사 누락 | 포착(1) |
| M7 | 이름 하드코딩(동작 같음) | 포착(1, 소스 스캔만) |
| M8 | 추천 카드 누락(옛 코드 뱃지) | 포착(2) |
| M9 | 챌린지 카드 누락(옛 코드 뱃지) | 포착(2) |
| M10 | 시작 전 챌린지 제외(서버와 어긋남) | 포착(1) |
| M11 | TodayHome 이 챌린지 난이도를 안 넘김 | 포착(1, 소스 스캔만 — TodayHome 은 요청 4개를 묶어 렌더 시험이 없다) |
| M12 | 준비 줄이 `challengeLevel` 무시 | 포착(2) |
| M13 | 뱃지 `whitespace-nowrap` 빠짐 | 포착(2) |
| M14 | 보이는 글 `aria-hidden` 빠짐(두 번 읽힘) | 포착(2) |
| M15 | 끝난 챌린지(COMPLETED)도 챌린지 문장 | 포착(1) |
| M16 | 칩이 난이도를 안 받음 | 포착(2) |
| M17 | 낭독에서 「기준」 빠짐 | 포착(4) |
- 원본 복원 확인: 변경 9파일 `cmp` 임시 미러 = 미러 = 저장소 일치.

## 증빙 (미러 `~/.node-local/thekaiwa-dev076-ui2`, 가짜 `DATABASE_URL`)
- `./node_modules/.bin/tsc --noEmit` → 0
- `./node_modules/.bin/eslint <변경 9파일>` → 0
- 영향 시험(vocab labels·seedButtons·topicLogic·cardFirstHome·todaySkeleton·todayHold·task076Today + lesson/__tests__ 전부) → 132/132
- 전체 시험 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' | sort)` → **tests 4,367 · pass 4,362 · fail 0 · cancelled 0 · skipped 5**(서버 기록과 같은 건너뜀 5), exit 0
- `./node_modules/.bin/next build > log 2>&1; echo $?` → **0**(경고 3개는 기존 `persona/loader.ts` 파일 추적 경고, 이번 변경과 무관)
- 미러 차이: 저장소와 다른 파일은 화면 A 진행 중 파일(`components/challenge/**`·`plan/challenge/new/page.tsx`)뿐 — 이 증빙은 화면 A 변경 **없이** 돌린 결과다. 두 화면을 합친 상태의 tsc·전체 시험·build 는 화면 감사 전에 한 번 더 필요.

## 알려진 한계
1. #158 실패·로딩 중이면 준비 줄은 지금 문장(「지금 수준 …」) — 서버는 챌린지 기준으로 뽑았을 수 있다(오류 띠가 이미 보이는 상태).
2. 360/390/412 × 130% 실측은 하지 않았다(브리프대로 QA 실서버). 값은 §33 그대로 — 뱃지 최대 「최상급 (N1) · 내 목표」(데모 실측 130% 162px 한 줄), 칩은 지금처럼 끝 말줄임.
3. `TodayHome` 배선은 소스 확인만(M11). 렌더 시험이 없는 기존 구조 그대로.

## reviewer 가 볼 곳
- `lessonCopy.ts` `lessonLevelBadge` 폴백(위 결정 1) · `TodayLessonCard.tsx` `LevelBadge`(sr-only 가 공용 `Badge` 안에 들어감 — `Badge` 는 고치지 않음).
- `topicLogic.ts` `mineSetChallengeLevel` ↔ 서버 `topics/visible.ts` `isChallengeInProgress`·`vocab/sessions.ts` `mineSetCeiling` 집합 일치(결정 3).
- `ChallengeCtx.level` 타입 좁힘(덱 `useVocabDeck` 도 같은 타입을 쓰지만 값은 그대로).
- 6층·엔진명: 화면 파일만, fetch·`window.Capacitor`·엔진명 없음.

## 폰 확인 제안
1. 챌린지 없음 · 목표 있음: 회화 카드 「추천 주제」 옆 뱃지 「{목표} · 내 목표」 한 줄(글꼴 130%에서도 줄바꿈 없음).
2. 챌린지 중: 회화 카드 「챌린지 주제」 옆 「{챌린지 난이도} · 챌린지」, 단어 카드 칩 「챌린지 · {난이도} · 「주제」」 — 긴 주제 이름이면 끝만 「…」.
3. 챌린지 중 [내 단어장으로 풀기] 펼침: 「챌린지 난이도({…})까지의 단어가 주로 나와요.」 / 챌린지 없음: 「지금 수준(…) 단어가 가장 많이 나와요.」
4. TalkBack: 회화 뱃지 「수업 난이도 중급 (N3), 내 목표 기준」 한 번만 읽힘(보이는 글 중복 낭독 없음).
5. 「내일 시작」 챌린지를 만든 날: 단어 카드 준비 줄이 챌린지 문장인지(결정 3).

## 진행 체크포인트
- [완료] 사전 파악 → 구현 8파일 + 새 시험 1파일(미커밋) → 미러 반영(임시 파일 + mv) → tsc 0 · eslint 0 · 영향 시험 132/132 · 변이 17/17 · 전체 시험 fail 0 · build 0 (18:52).
- 서버 감사 REV-076S 「화면 단계 주의」 4개 대조: ① `lessonLevel`·`levelSource` 사용(§33-3 마지막 행 stale 은 따르지 않음 — 문서 정리는 designer/Leader) ② #156 은 화면 A 몫 ③ P10 판정 = `isChallengeInProgress` 집합(Leader 판정 「시작 전 포함 유지」와 일치) ④ 칩 문구에 「주제 난이도」로 읽힐 말 없음(「챌린지 · 중급 (N3) · 「주제」」).
- 다음: reviewer 화면 감사(화면 A 와 합친 상태로 tsc·전체 시험·build 재확인 권장).
- 미러: `~/.node-local/thekaiwa-dev076-ui2`(소스 link 1, node_modules 하드링크) · 변이 임시 미러 `~/.node-local/thekaiwa-dev076-ui2mut`(node_modules 는 심볼릭 링크, 끝나면 지워도 됨).
- 미커밋 파일: `src/components/lesson/{TodayLessonCard.tsx,lessonCopy.ts}` · `src/components/vocab/{labels.ts,topicCopy.ts,topicLogic.ts,TopicWordsCard.tsx,TodayWordsCard.tsx,TodayHome.tsx}` · `src/components/vocab/__tests__/task076Today.test.ts`(새) · 이 기록.
