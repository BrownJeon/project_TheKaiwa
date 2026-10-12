# task-065 — Developer 기록

이력서 본문: [[task-065-improve-menu-copy]]

## 요약
- 하단 탭 「오늘」→「공부」(라우트 `/study/today` 불변), 회화 홈 제목 「AI와 공부하기」→「자유로운 대화」(실제 화면·로딩 자리표시 둘 다), 「오늘 탭/오늘로/오늘 화면」처럼 **그 탭·화면을 가리키는** 문구를 「공부 …」로.
- 기능 이름(「오늘의 단어/회화/평가/복습/표현」)·날짜 표현·주석·라우트/API/키/시험 이름은 그대로. 서버(`src/modules/**`)·프롬프트·docs 무변경.
- **파일 수 주의: 변경 17개(소스 15 + 시험 2) — light 한계 「12개 초과」 초과.** 전부 문구 문자열 치환이라 위험은 R0 그대로지만 규칙상 Leader 가 승격 여부를 판단해 달라.

## 진행
- 데모 게이트: `DEMO_GATE_PASSED`(not_required, judge none).
- 전용 미러 `~/.node-local/thekaiwa-dev065`(`KAIWA_LOCAL_ROOT` sync + `thekaiwa-predeploy/node_modules` `cp -al`, package.json 동일 확인).
- 찾는 법: `TypeScript` 파서(`src/components/__tests__/sourceCode.ts` 의 `stripComments`)로 `src/**/*.ts(x)` 의 **주석을 걷은** 소스에서 `오늘` 포함 줄 443개를 뽑아 분류(스크래치 스크립트, 저장소 밖). `AI와 공부하기` 는 같은 방식으로 전수 → 화면 문자열 2곳뿐(나머지는 주석).
- 치환은 주석 줄(`//`·`*`·`/*`·`{/*` 로 시작)을 건너뛰는 한 번짜리 스크립트로 `오늘 탭→공부 탭`, `오늘로→공부로`, `오늘 화면→공부 화면` 만 바꿨고, `git diff -U0` 로 변경 줄을 전부 눈으로 확인했다(기존 파일 16개 69줄(+69/−69), 모두 화면 문구·상수·시험 단언 — 신규 시험 파일 1개 별도).

## 문구 분류표

### 바꾼 것 (화면에 보이는 문구)
| 파일 | 바뀐 문구 |
|---|---|
| `shell/TabBar.tsx` | 탭 라벨 `오늘`→`공부` |
| `app/(app)/study/ai/(tab)/page.tsx` | `AppBar title` `AI와 공부하기`→`자유로운 대화` |
| `chat/StudyAiSkeleton.tsx` | 같은 제목 `자유로운 대화`(실제 화면과 동일) |
| `eval/evalCopy.ts` | 뒤로 `오늘로`→`공부로`(5곳), `오늘로 돌아가기`→`공부로 돌아가기`(2), 안내 `오늘 탭에서 …`→`공부 탭에서 …`(열 수/이어서 풀/결과/다시 채점 4곳) |
| `lesson/lessonCopy.ts` | 뒤로 `오늘로`→`공부로`(4곳), `오늘로 돌아가기`→`공부로 돌아가기`, `다 되면 오늘 탭에서 열 수 있어요`→`공부 탭에서` |
| `lesson/review/reviewCopy.ts` | `오늘로`→`공부로`, `오늘로 돌아가기`→`공부로 돌아가기`, 안내 `오늘 탭에서 …`(3곳)→`공부 탭에서 …` |
| `vocab/topicCopy.ts` | `back`·`today` `오늘로`→`공부로`, `tomorrowSub` `내일 오늘 탭에서`→`내일 공부 탭에서`, `toToday` `오늘 탭 ›`→`공부 탭 ›` |
| `vocab/VocabDeck.tsx` | `backLabel` `오늘로`→`공부로` |
| `vocab/VocabResult.tsx` | `backLabel`·버튼 글자 `오늘로`→`공부로`, 토스트 `오늘 탭 ‘보관한 세트’에서…`→`공부 탭 …`, 안내 `보관하면 오늘 탭에서…`→`공부 탭에서…` |
| `vocab/VocabSessionScreen.tsx` | `backLabel` 2곳·버튼 글자 `오늘로`→`공부로`, `오늘 화면에서 새 세트를 …`→`공부 화면에서 …` |
| `plan/CalendarSection.tsx`·`plan/DaySheet.tsx` | 빈 달력/빈 날 안내 `오늘 탭에서 단어 N장부터…`, 버튼 `오늘 탭으로`→`공부 탭…` |
| `plan/logic.ts` | 지난 복습 안내 `오늘 탭에서 이어서 할 수 있어요`→`공부 탭에서 …` |
| `challenge/challengeCopy.ts` | `shortMemo`·`flash`·`goToday`(`공부 탭에서 하기`)·`lessonRule`(`공부 탭 회화 카드에서 [오늘 수업 만들기]…`)·`같은 주제면 공부 탭 어디서 공부해도…` |
| `challenge/logic.ts` | 과제 줄 이동 버튼 `go`(하기/이어서/보기/시작/다시)·`내일 공부 탭에서 만들어요`·`그날 공부 탭에서 할 수 있어요`(2)·`아직 안 만들었어요 · 공부 탭에서 누르면 1분쯤`·`공부 탭에서 [오늘 수업 만들기]`·안내문 `같은 주제면 공부 탭 어디서…` |

시험 단언: `challenge/__tests__/logic.test.ts` 의 `오늘 탭에서 …` 단언 7줄만 `공부 탭에서 …` 로(단언 약화 없음, 시험 이름·설명은 그대로).

### 바꾸지 않은 것 (의도적)
- **기능 이름**: 오늘의 단어 / 오늘의 회화 / 오늘의 평가 / 오늘의 복습 / 오늘의 표현, `[오늘 수업 만들기]` 버튼(`vocab/topicCopy.ts` `make`), `오늘 수업을 끝냈어요`, `오늘 평가`, `오늘 단어 완료`, `오늘 챌린지 목표 달성`, `오늘 할 일`(TaskRows 라벨) — 기능·진행 상황 이름.
- **날짜 표현**: `오늘 N/M장`, `오늘 푼 장수`, `오늘 끝낸 세트`, `오늘 자정에 마감돼요`, `오늘은 …을 더 만들 수 없어요`(일일 한도, 서버 메시지 포함), `오늘 시작`, 달력의 `오늘` 버튼·범례, 챌린지 칸 `오늘`(TODAY), 관리자 기록 필터 `오늘`, `LEVEL.today`·`HOME.today`(날짜 자리), `formatSessionDate` `오늘`, 접근성 `…, 오늘`.
- 서버/모듈 메시지(`modules/learning/**` 의 일일 한도·`오늘의 회화/복습` 요약), 프롬프트(`modules/conversation/prompts/**`, `[오늘] 날짜` 헤더 포함), `appUpdateCopy` `오늘은 그만 보기`, `displayPrefs` 예문 `오늘은 뭘 먹었어요?`.
- 주석(`TabBar.tsx`·`page.tsx`·`studyAiTabs.ts`·`StudyAiHome.tsx` 의 「AI와 공부하기」「오늘 탭」, `globals.css` 오늘 홈 띠, `AndroidManifest.xml` 주석), 라우트(`/study/today`)·API·키·시험 이름/설명(예: `task025b` 의 `"오늘로" 링크` 제목, `logic.test` 의 `링크는 오늘 탭`).

### 애매한 후보 (바꾸지 않음 — Leader 판단)
1. **`/study/today` 화면 제목 「오늘의 공부」** — `app/(app)/study/today/(tab)/page.tsx`·`vocab/TodaySkeleton.tsx` 의 `AppBar title`(둘이 같아 task-046 규칙 유지) + 시험 `vocab/__tests__/todaySkeleton.test.ts` 가 `<h1>오늘의 공부</h1>` 단언. 탭 이름 「오늘」이 아니라 「오늘의 …」 구절이라 기능 이름 규칙대로 두었다. 탭이 「공부」가 된 뒤 화면 제목이 「오늘의 공부」면 어색하다고 판단하면 **세 파일(page·TodaySkeleton·todaySkeleton.test)을 같이** 바꿔야 한다(제목이 다르면 로딩→실화면 전환 때 깜빡임).
2. **`eval/evalCopy.ts` `START.sub: '오늘'`**(AI 평가 시작 화면 소제목) — 승인 데모 `task-011-ai-evaluation-v1.html` 도 `bar('오늘로', …, 'AI 평가 시작', '오늘')`. 탭 이름(→「공부」)인지 날짜(「오늘」)인지 문서로 판별 불가. 같은 화면의 뒤로 글자는 「공부로」로 바뀌었으므로 소제목이 탭 이름이라면 「공부」로 맞춰야 한다. (다른 평가 화면 소제목은 `종류 · 레벨`·`AI 평가`·날짜라 이 건만 특이.)
3. **`chat/StudyAiHome.tsx`·`StudyAiSkeleton.tsx` `Segmented ariaLabel="공부 방식"`** — 회화 홈 분절(회화/채팅/상황)의 읽기 도구용 이름. 메뉴 이름이 아니고 상단 제목과 별개라 그대로 두었다. 제목이 「자유로운 대화」로 바뀐 뒤에도 「공부 방식」이 맞는지(또는 새 탭 「공부」와 헷갈리는지)는 designer 판단 몫.
4. **`challenge/challengeCopy.ts`·`logic.ts` 「공부 탭 어디서 공부해도 인정돼요」** — 기계 치환 결과 「공부」가 두 번 나온다. 의미는 맞지만 어색하면 「공부 탭 어느 화면에서 해도」 같은 문장 손질이 필요(문구 결정은 Leader/designer).
5. **주석의 옛 이름**(`AI와 공부하기 홈`, `오늘 탭`)은 규칙대로 두어 코드 주석과 화면이 어긋난다. 필요하면 후속 정리 task.
6. 화면 밖: `docs/screens.md`·로드맵의 「오늘」「AI와 공부하기」 문구는 Leader 몫.

## 시험 추가
- `src/components/shell/__tests__/menuCopy.test.ts`(신규, 2개): ① 탭 라벨 5개와 경로 ② 회화 홈 `AppBar title` 이 page·로딩 자리표시에서 같은 `자유로운 대화`. 주석을 걷은 소스(`readCode`)만 읽는다. 불필요하다고 보면 이 파일만 빼면 된다(다른 변경과 독립).

## 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev065`)
- 기준선(수정 전 소스+시험 동일 미러, 첫 실행): `src/components` 시험 1,290 중 **2 fail** — 둘 다 `challenge/__tests__/logic.test.ts` 의 옛 문구 단언(의도한 파급) → 단언 7줄 갱신.
- 갱신 후 `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/components -name '*.test.ts' | sort)` → **exit 0, `# tests 1292 / # pass 1292 / # fail 0`**(= 1,290 + 신규 2).
- `./node_modules/.bin/tsc --noEmit` → **exit 0**, 출력 없음.
- `./node_modules/.bin/eslint src` → **exit 0**, `✖ 5 problems (0 errors, 5 warnings)` — 경고 5건은 기존 파일의 `react-hooks/set-state-in-effect` 등(이 task 파일 아님).
- `./node_modules/.bin/next build > log 2>&1` → **exit 0**, `✓ Compiled successfully in 6.1s`, 정적 21/21. 경고는 기존(`persona/loader`·`claudeCli` Dynamic filesystem access) — 이 task 와 무관. 산출물 `.next/server/**/*.js` 에 `자유로운 대화` 있음, `AI와 공부하기` 는 소스맵(주석)에만.
- 잔여 점검: 주석 제외 `src` 에 `오늘 탭|오늘 화면|오늘 홈|오늘로|오늘으로|오늘 메뉴` **0건**(시험 제외).
- 개발 서버는 띄우지 않았다. 커밋·push·`git add` 하지 않음. 미러 `~/.node-local/thekaiwa-dev065` 는 남겨 둔다(Leader 가 정리).

## 변경 파일 (미커밋)
소스 15: `src/app/(app)/study/ai/(tab)/page.tsx` · `src/components/{challenge/challengeCopy.ts,challenge/logic.ts,chat/StudyAiSkeleton.tsx,eval/evalCopy.ts,lesson/lessonCopy.ts,lesson/review/reviewCopy.ts,plan/CalendarSection.tsx,plan/DaySheet.tsx,plan/logic.ts,shell/TabBar.tsx,vocab/VocabDeck.tsx,vocab/VocabResult.tsx,vocab/VocabSessionScreen.tsx,vocab/topicCopy.ts}`
시험 2: `src/components/challenge/__tests__/logic.test.ts`(수정) · `src/components/shell/__tests__/menuCopy.test.ts`(신규)

## 남은 일 / 다음 첫 행동
- Leader: 파일 17개로 light 한계 초과 — 승격 여부 결정, 애매한 후보 1·2·3·4 결정, `docs/screens.md` 문구 정정. 사용자 확인 필요 시 후보 1·2.
- Reviewer: 위 증빙 재실행(미러 `thekaiwa-dev065` 재사용 가능, `bash scripts/sync-local.sh` 로 다시 동기화).
