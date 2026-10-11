---
project: TheKaiwa
task: task-055
type: reviewer-record
tags:
  - type/review
  - domain/drawer
---
# task-055 Reviewer 기록 (REV-184)

> 대상: 채택 교정 모음 `/drawer/corrections` + API #79. 소스는 고정 스냅샷 `~/.node-local/rev055-tree/`(HEAD `3bca818` + task-055 `src` 26개; Leader 정정으로 task-056 프롬프트 파일 2개(`prompts/phraseHelp.ts`·`structuredResponse/phraseHelp.ts`)는 범위 밖이라 감사·지적하지 않음). 읽기 전용 — `src/**`·데모·계약·이력서 수정 없음. 변이는 `~/.node-local/thekaiwa-rev055m`(복사본)에서만 했고 매번 원본으로 되돌려 `diff -rq` 동일 확인.

## 판정: **PASS-with-fixes** (Critical 0 · High 0 · Medium 1 · Low 4)

Leader 게이트 `/tmp/claude-1000/rev055/result.txt`: `tsc=0 eslint=0(오류 0·경고 5, 전부 task-055 밖 기존 파일) test=0(3105/3106, 건너뜀 1) build=0`. 반려 사유 없음. Medium 1건은 시험 보강(한 줄)이고 제품 동작 결함이 아니다 — QA 를 막지 않고 병행 수정 가능.

데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(approved v1, hash verified, sha256 앞 12자 `56a11a9b6fac` = 이력서 기록과 일치). `evidence.jsonl` 33행 `approve`(version 1, `prompt_ts` 17:07:14 → ts 17:07:19, 세션 729e3300…)는 사용자 문장(해시 `b93fcf50…`) 뒤에 기록된 형태이고, `waive` 흔적·`.claude/state/demo-gate/` 직접 수정 흔적 없음(`git status` 변경 0).

## 항목별 결과

### A. 서버(API #79) — 결함 없음 `[확실]`
- 소유자: `drawerCorrectionWhere` 가 목록·`facets` 가 **같은 함수**를 써서 `userId` 조건이 양쪽에 모두 있음(`modules/conversation/corrections/drawer.ts` where 구성, `facetsOf(db, drawerCorrectionWhere(userId, {...q, errorType: null}))`). `status:'ACCEPTED'`·`resolvedAt:{not:null}` 도 같은 where.
- `savedWord` 는 `w.userId === userId` 일 때만 `{id, surface}`, 직렬화에 `userId` 없음(`serializeDrawerCorrection`). `chat` 은 `{id,title,kind}` 만. 응답에 내부 필드 누출 0.
- 검증: `errorType`/`chunkType` 은 `Object.hasOwn` 으로 열거 값만(소문자·쉼표·`__proto__` 400), `limit` 1~50(`parseLimit` 정규식 `^\d{1,4}$`)·기본 20, `q` 는 `sanitizeText`(제어문자·줄바꿈 제거) 후 코드포인트 40자 초과 400, 해석 불가·400자 초과 커서는 DB 호출 전 400(`decodeCursor`).
- LIKE: `escapeLike` 가 `\`·`%`·`_` 를 `\` 로 이스케이프하고 Prisma `contains` 에 그대로 넘김. 이중 이스케이프 위험은 Prisma 버전 변경 시에만 — `[추측]`(현재 6.19.3 불변이라는 Leader 기록). 실제 MariaDB 동작은 가짜 DB 시험만 있어 **QA 라이브 확인 대상**.
- 커서: `{t: resolvedAt ISO, id}` 키셋, `OR[resolvedAt<t, resolvedAt=t & id<cursor.id]` 를 `AND:[where, after]` 로 감싸 `q` 의 `OR` 와 충돌하지 않음. `resolvedAt` 은 Prisma 기본 `DATETIME(3)` 이라 JS Date ms 와 정밀도 일치 `[가능성 높음]`. `limit+1` 조회로 `nextCursor`, 마지막 쪽 null.
- `cursor` 요청에서 `facets` 생략(`cur ? Promise.resolve(null) : facetsOf`), 첫 쪽은 항목 0개여도 `{errorType: []}`.
- 6층: 라우트가 `@/modules/infra`·`@/modules/conversation`(index) 만 import, 모듈은 `@/modules/infra` index 만. 쓰기·스키마 변경 0(`findMany`/`groupBy` 만).

### B. 돌아오기(`usePlanReturn`) — 결함 없음 `[확실]`
- `currentBackHref` → `pickBackHref` 는 **문자열/null 만** 반환(객체 없음), 서버 스냅샷 `onServer = () => null` 유지. 교정 기록이 없으면 `parseCorrectionsReturn(null)` = null → `plan?.plan ?? corr?.back ?? null` 로 **변경 전 `planReturnHref` 와 같은 값**(계획표 기록 파싱·`samePath`·TTL 코드 무수정, `planReturn.ts`·`BackBar`·`TalkRoomHeader` 무수정을 `git diff --stat` 로 확인).
- 늦은 쪽 선택: `corr.at > plan.at ? corr.back : plan.plan` — `at` 동률은 계획표.
- `isCorrectionsHref` = 길이 ≤700 + `^/drawer/corrections(?:\?[A-Za-z0-9._~%=&-]*)?$`: `javascript:`·`//evil`·`/drawer/corrections/../x`·개행·`+`·해시·다른 경로 거절(JS `$` 는 끝에서만 일치). `%0d%0a` 는 허용 문자(`%`)라 통과하지만 같은 사이트 `/drawer/corrections?…` 쿼리 안의 값일 뿐 — 계획표 선례와 같음.
- `strictEncode` 결과(`[A-Za-z0-9._~%-]`)로 만든 주소는 허용 정규식을 통과. 최악(이모지 40자 = 약 480자 + 유형·조각·focus·n ≈ 600자) 도 700 이내.
- 저장소 접근은 `readStore/writeStore`(전부 try/catch). `rememberCorrectionsReturn` 은 형식 불량이면 기록 자체를 안 함 → ← 가 원래 자리로 갈 뿐 오류 없음.
- `ReadonlyURLSearchParams` 가 Next 16.3.2 에서 `extends URLSearchParams` 라 `parseCorrectionsReturnQuery` 의 `instanceof URLSearchParams` 분기가 맞음(아니면 복원 값이 조용히 버려질 수 있어 확인함).

### C. 화면 — 결함 없음(경미 4건은 아래 Low) `[확실]` 코드 읽기, 동작은 QA
- 경합: 첫 쪽 요청마다 `AbortController` + `++reqRef`, `.then`/`.catch` 둘 다 `id !== reqRef.current` 폐기, 더 보기 시작 때 번호를 들고 가 응답 후 비교, 새 첫 쪽 effect 가 `moreCtrl.abort()`. `more()` 는 `list.query !== query`·`loadingMore` 로 막음. 더 보기는 `list.shown`(받은 목록의 조건)으로 요청해 커서와 조건이 어긋나지 않음.
- 실패: 첫 쪽 실패 `listFromFirstError`(조용한 다시 읽기는 받은 목록 유지), 더 보기 실패는 한 줄 + 받은 항목 유지, facets 는 첫 쪽 것만(`listWithMore` 가 facets 유지).
- 머리 줄·빈 상태: `headCount`(유형 고르면 그 유형 count), `typeChips`(고른 유형 0 칩 유지), `emptyKindOf` 는 `shown` 조건 + 받은 항목 수. 변이 M11·M15 로 시험이 잡음.
- 복원: `useSearchParams()` 값을 `useState` 초기값으로 한 번만 읽고 `history.replaceState(null,'',bare)` 로 쿼리를 지움 — 계획표 `PlanScreen`(`useSearchParams` + `replaceState(null, '', url)` + `forgetPlanReturn` 마운트) 과 **같은 조합**. 페이지가 `await searchParams` 라 동적이어서 Suspense 요구 없음(`build=0`).
- 마크업: 버튼 안은 `span`/`b` 뿐(`JaText as="span"`·`HangulLine as="span"`·`Badge` 는 `span`), 한글 줄은 `HangulLine`, `whitespace-pre-wrap`, `ExtraNoteLine`·`Link`·단어 버튼은 요약 `<button>` 밖(`div#_x`) — 중첩 인터랙티브 0. `REMOVED`/`ADDED` 문자열은 `chat/CorrectionCard.tsx` 와 글자 단위 동일(grep 대조 + `correctionCard.test.ts` 가 묶음). 편집·삭제·채택·무시 UI 0, `target=`/`window.open` 0.
- `original` 무정규화: 카드는 `diffCodepoints(c.original, c.corrected)` 와 `text={c.original}` 만 쓰고 trim 없음. M4(변이 `.trim()`)를 시험이 잡음.

### D. 공용 부품 회귀 — 결함 없음, 시험 구멍 1건(Medium)
- `ChunkChips`: `withNone` 기본 `true`, 분기는 `chips` 필터 한 줄. M6(기본값을 false 로)을 시험이 잡음. `WordSearchBar`: `label`·`placeholder` 기본값은 DOM 시험이 변경 전 렌더 문자열(`PRE_SEARCH_EMPTY`/`PRE_SEARCH_ERR`)을 박아 잡음.
- `WordsScreen`·`WordsSkeleton`: import 1줄 + 분절 1줄뿐(`git diff` 확인), `WordsScreen` 은 `return` 이 하나라 모든 상태에서 분절이 같은 자리.
- `tabSkeletonSizes.ts`: `WORD_SKELETON = { rows: 6, rowHeight: 104 }`·`WORD_CATEGORY_ROW` **값 불변**(주석 숫자만 292→344), `CORRECTION_SKELETON`·`CORRECTION_TYPE_ROW` 추가. `tabSkeleton.test.ts` 새 시험 5개가 상수↔부품(카드 클래스·간격 `gap-2.5`·유형 줄 `mt-1.5`/`py-1`/`h-9`·분절 4곳)을 묶음. `cardHeight: 280` 은 데모 평균에서 가져온 **미실측** 값(상수 주석에 QA 재측정 명시).

### E. 문구·이름·규칙 — 결함 없음
- 엔진·모델·호스트 이름: drawer 전체·라우트·API·`correctionsReturn.ts` grep 0건(시험도 있음).
- 문구: 데모 v1 대조 31개 문자열 모두 일치(`문장이나 설명으로 찾기`·`단어장 보기`·`교정 더 보기`·E1/E2/E3 등). 데모에 없는 것은 문서화된 2건 — `교정을 불러오지 못했어요.`(비네트워크 갈래, screens.md §21-13 ③)·`삭제했어요 · 지난 기록은 그대로 남아요`(`WordsScreen.tsx:368` 과 같은 문구 재사용). 문서 제목 「채택한 교정 · 단어장」(`page.tsx` `metadata`), 앱바 h1 「단어장」(`AppBar title="단어장"`).
- 데모와의 차이 분류: 21-13 ①~⑫ 는 모두 implementation(승인 정보구조·CTA·단계 변화 없음). material 0, defect 0. 데모 재승인 요청 불필요.
- 터치: `LINK_BTN min-h-11`, 오류 [다시 시도] `min-h-11`, E2/E3 `min-h-11`, 칩 보이는 36 + `before:h-11`. 스크롤 1곳(§18) 위반 요소 없음(`main` 안 새 세로 스크롤 상자 0, 칩 줄만 가로 `overflow-x-auto`). **3폭 가로 넘침·실제 44px 는 코드로 확정 불가 → QA.**

### F. 시험 품질 — 변이 15종, 14종 검출 · 1종 생존(M9)
`DATABASE_URL=mysql://x:y@127.0.0.1:1/none` 로 task-055 관련 시험 135개 통과(DB 접속 없음).

| # | 변이 | 결과 |
|---|---|---|
| M1 | `drawerCorrectionWhere` 에서 `userId` 제거 | 3개 실패(소유자·커서+필터·where) |
| M2 | `escapeLike` 제거 | 2개 실패 |
| M3 | `cursor` 요청에도 `facets` 계산 | 1개 실패 |
| M4 | 카드 `text={c.original.trim()}` | 1개 실패 |
| M5 | `usePlanReturn` 스냅샷이 객체 반환 | 1개 실패(소스 정규식) |
| M6 | `ChunkChips` 기본 `withNone=false` | 1개 실패 |
| M7 | `isCorrectionsHref` 를 임의 경로 허용으로 완화 | 1개 실패 |
| M8 | `at` 동률 시 교정 기록 우선 | 1개 실패 |
| **M9** | **`WordSearchBar` 기본값 `commitWhileTyping = true` → `false`** | **0개 실패(생존)** |
| M10 | 남의 `savedWord` 도 내보냄 | 1개 실패 |
| M11 | `headCount` 가 유형을 골라도 합 | 1개 실패 |
| M12 | 돌아오기 주소 엄격 인코딩 약화 | 1개 실패 |
| M13 | `resolvedAt IS NOT NULL` 제거 | 2개 실패 |
| M14 | `status:'ACCEPTED'` 제거 | 2개 실패 |
| M15 | 검색어 있을 때 E3 판정 제거 | 2개 실패 |

## 지적

| # | 심각도 | 내용 | 근거 | 실패 시나리오 · 수정 방향 |
|---|---|---|---|---|
| R1 | **Medium** | 공용 `WordSearchBar` 의 **기본 동작**(`commitWhileTyping = true` = 300ms 디바운스)을 고정하는 시험이 없다 | `components/vocab/WordSearchBar.tsx` 기본값 줄. 변이 M9 가 135개 시험을 모두 통과. `drawerParts.test.ts:53-57` 은 렌더 DOM 만, `:67-71` 은 `typingCommit(…, true)` 순수 함수만 | 누군가 기본값을 `false` 로 바꾸면 단어장 검색이 조용히 입력 중 조회를 멈추고 Enter 로만 동작(DOM 은 그대로라 기존 시험이 못 잡음). 수정: `drawerParts.test.ts` 에 `assert.match(src, /commitWhileTyping = true,/)` 한 줄(또는 `schedule` 경로 시험) |
| R2 | Low | 단어 삭제·없음 뒤 초점 기록(`focusNext`)이 **다시 읽기 완료 전**에도 살아 있어, 그 사이 다른 카드를 펼치면(effect 의존성 `[list, open]`) 초점이 원래 카드 요약 버튼으로 끌려간다. 다시 읽은 목록에 그 카드가 없으면 `focusNext` 가 해제되지 않은 채 남는다 | `CorrectionsScreen.tsx` `afterWordGone`(`focusNext.current = {ids:[cardButtonId(fromId)]…}` 후 `reloadKeep()`)와 초점 effect(`if (!el) return`) | 시트에서 삭제 → 토스트 직후 다른 카드 탭 → 초점 이동. 수정 방향: 초점 effect 를 다시 읽기 응답(`list.query` 가 새 요청일 때)에만 소비하고, 요소가 없으면 `focusNext.current = null` |
| R3 | Low | 단어 삭제 뒤 조용한 다시 읽기는 `limit = reloadLimit(items.length)` 로 **최대 50**이라, 더 보기로 50개를 넘게 받아 둔 사용자는 51번째 이후가 목록에서 사라지고 [교정 더 보기]부터 다시 눌러야 한다(중복·누락 없음, 스크롤 위치 점프 가능) | `logic.ts` `reloadLimit`(상한 50), `CorrectionsScreen.tsx` `reloadKeep`. 이력서 §21-13 ⑨가 최대 50 을 명시한 범위 | 50개 초과 로드 + 단어 삭제 시에만. 수정은 선택(지금 문서화된 한계) |
| R4 | Low | 검색어 40자 초과 안내(`qTooLong`)가 입력을 줄여도 다음 Enter/지우기 전까지 남고 `aria-invalid` 도 유지된다 | `CorrectionsScreen.tsx` `commitSearch`·`clearSearch` 만 `setQTooLong(false)`; `onInput={setQInput}` 은 해제 안 함 | 41자 입력 → Enter → 안내 → 30자로 줄여도 안내 유지. 수정 방향: `onInput` 에서 `cpLength(v) <= 40` 이면 해제(작은 변경) |
| R5 | Low | 화면 동작(경합·복원·초점·`replaceState`)의 시험이 `CorrectionsScreen.tsx` **소스 정규식**과 순수 함수에 한정되고 DOM 렌더 시험이 없다. 소스 정규식은 문장 모양이 바뀌면 의미와 무관하게 깨지거나, 의미가 틀려도 통과할 수 있다 | `drawer/__tests__/correctionsScreen.test.ts:177-215`(`assert.match(screen, …)`) | 결함은 아님. 그래서 QA 라이브 확인 항목을 아래에 늘렸다. 또 Ctrl/⌘·가운데 클릭으로 [원래 대화 보기 ›]를 누르면 `onClick` 이 `replaceState(…focus…)` 와 기록을 남기지만 Link 는 이동하지 않음(계획표 `openSource` 와 같은 선례, 새로고침 시 그 카드가 펼쳐질 뿐 무해) |

## QA 로 넘기는 high_risk_areas (실데이터·실기기에서만 확인되는 것)
1. **LIKE 특수문자 라이브**: QA 계정에 `%`·`_`·`\` 가 든 합성 교정을 두고 `q=%`, `q=_`, `q=\`, `q=100%` 가 글자 그대로만 찾는지(와일드카드로 전부/한 글자에 맞지 않는지). `escapeLike` 와 Prisma `contains` 의 이중 이스케이프 여부는 이 확인으로만 닫힌다 — `[추측]` 으로 남음.
2. **정렬 지연**: `[userId,status,createdAt]` 인덱스라 `resolvedAt desc, id desc` 가 filesort — 개인 앱 규모면 무시 가능 `[추측]`; QA 계정 교정 수(≥50) 로 첫 쪽·`facets` 응답 시간(서버 `toolLog`/curl) 실측. `facets` groupBy 는 첫 쪽에서만(커서 요청 0).
3. **IDOR**: 다른 계정으로 같은 `q`/필터 호출 시 남의 교정 0건, 남의 `savedWord` 가 연결된 교정이 오지 않는지(데이터 구성 가능하면).
4. **뒤로가기 복원**: 조건(유형·조각·검색어)+더 보기 후 카드 펼치고 [원래 대화 보기 ›] → (a) ← 「교정 모음으로」 (b) 휴대폰/WebView 하드웨어 뒤로가기 둘 다 같은 조건·그 카드 펼침·초점 복원, 이후 주소 쿼리 제거(새로고침 시 처음 상태), 같은 방을 계획표와 번갈아 열 때 늦은 쪽 우선, 50개 넘게 읽은 뒤 연 카드(복원 한계 §21-13 ⑦).
5. **경합**: 칩 연타·검색 확정 연타·더 보기 중 조건 변경에서 마지막 조건 결과만 남는지, 오류 뒤 [다시 시도], 더 보기 실패 한 줄 + 받은 항목 유지.
6. **단어 시트**: 삭제/없음 뒤 토스트·그 카드 단어 버튼 소멸·위치 유지·초점(R2 재현 시도 포함).
7. **높이·점프**: A1(단어장 목록 시작 344, 점프 ≤8px)·A2(교정 모음 298±8)·`CORRECTION_SKELETON.cardHeight` 280 실측 후 상수 갱신(상수 주석 지시대로).
8. **3폭 가로 넘침·터치 44px·어두운 화면**(토큰만 쓰는지, 강조 명암비), TalkBack(요약 버튼 이름 길이·칩 radio·분절 `aria-current`).
9. **원문 그대로**: 앞뒤 공백·연속 공백·줄바꿈이 든 합성 교정에서 ✕ 줄 텍스트 = 저장값(루비·sr-only 제외), 이모지 검색어 1자.
10. **회귀**: 단어장(디바운스 검색·분류 칩·분절 위치), 계획표→원본 ←(「계획표로」), 회화방·역할극 방·표현 점검 ← 의 `aria-label`.
11. 역할극 교정이 `kind=TALK` 회화방 `#cr_` 로 열리는지, 단어 시트 「점검 결과 보기 ›」가 회화 출처 단어에서도 열리는지(이력서 「designer 가 못 확인한 것」 ②③).

## 요약 (Leader 보고용)
- **판정 PASS-with-fixes** — Critical 0 · High 0 · Medium 1(R1 시험 구멍) · Low 4(R2~R5). 반려 사유 없음.
- 7영역(아키텍처·유지보수·안정성·운영·성능·보안·학습 원칙) 중 task-055 에 해당하는 것 모두 검토: 읽기 전용 API 라 트랜잭션·ConfigurationVersion·Secret 해당 없음, 소유자·`ACCEPTED`·6층 import·응답 계약 이상 없음, `native_change: false`(웹 배포만, `versionCode` 해당 없음).
- 변이 15종 중 14종을 시험이 잡았고 M9 하나만 생존 — R1 의 한 줄 보강 권고. 시험은 DB 없이 135/135 통과.
- 데모 대비: material 차이 0, defect 0(차이는 모두 screens.md §21-13 에 문서화된 implementation).

```json
{ "reviewId": "REV-184", "status": "CONDITIONAL_PASS", "summary": { "critical": 0, "high": 0, "medium": 1, "low": 4 }, "native_change": false,
  "high_risk_areas": ["LIKE 특수문자 라이브(escapeLike+Prisma contains)", "resolvedAt 정렬 지연/facets groupBy", "IDOR(타 계정 교정·savedWord)", "뒤로가기·← 복원(replaceState+useSearchParams)", "필터 연타·더 보기 경합", "단어 시트 삭제 뒤 초점·목록 다시 읽기", "자리표시 높이 상수(cardHeight 280 미실측)·점프", "3폭 가로 넘침·터치 44px·어두운 화면·TalkBack", "원문 공백·줄바꿈 무정규화"] }
```

---

## REV-185 (수정분 재검증)

> 대상: Developer D 의 R1·R2·R4 수정([[task-055-dev-d-record]]). 소스 = 고정 스냅샷 `~/.node-local/rev055-tree/`(Leader 게이트 미러 `thekaiwa-rev055/src` 와 `diff -rq` 동일), 기준선 = REV-184 변이 복사본. 읽기 전용 — 소스 수정 없음, 변이는 `~/.node-local/thekaiwa-rev055m`(변이마다 원본으로 복구, 끝에 `diff -rq` 동일 확인).
> 게이트(Leader, `/tmp/claude-1000/rev055/result.txt`): `tsc=0 eslint=0 test=0(3111/3112, 건너뜀 1) build=0`. REV-184 의 3105 대비 +6 = 새 시험 6개(drawerParts 1 · correctionsScreen 5)와 일치. 바뀐 파일 4개뿐(`diff -rq` 로 확인): `drawer/logic.ts`·`drawer/CorrectionsScreen.tsx`·`drawer/__tests__/{drawerParts,correctionsScreen}.test.ts`. `WordSearchBar.tsx` 무수정.

### 판정: **PASS** (Critical 0 · High 0 · Medium 0 · Low 2 — 둘 다 선택적 시험 고정)
- **R1 닫힘 · R2 닫힘 · R4 닫힘.** `reloadKeep` 변경은 **실위험 없음**(아래 §3).
- R3(문서화된 한계)·R5(DOM 시험 없음)는 의도적으로 안 고침 — 그대로 남음, 이번 판정에 영향 없음.

### 1. R1 — 닫힘 `[확실]`
- 새 시험(`drawerParts.test.ts:79-90`)이 `WordSearchBar.tsx:30` 의 `commitWhileTyping = true,` 를 소스에서 읽어 `true` 단언 → 그 값을 `typingCommit` 에 넣어 `'debounce'`(빈 칸 포함) → `DEBOUNCE_MS = 300`·`act === 'debounce'` 배선 → 단어장 두 화면이 prop 을 안 넘김. 정규식이 첫 일치로 선언부(30줄)를 잡는다(머리 주석 8줄은 `={false}` 모양이라 안 걸림).
- 변이: 기본값 `false`(REV-184 M9) → **1개 실패**, 기본값 삭제(`commitWhileTyping,`) → **1개 실패**, 원복 → 89/89 통과. `WordSearchBar.tsx` 는 `diff` 무변경.

### 2. R2 — 닫힘 `[확실]` 로직은 실행으로, 화면 배선은 코드 읽기(DOM 시험 없음 — R5)
- `focusWishStep`(`logic.ts:330-337`) 분기 5개: ① `list.query !== after` 이고 `null`/옛 요청 → `wait`(DOM 조회 안 함) ② 더 새 요청(`tick` 큼)의 답 → `drop` ③ `after` 의 답 + 대상 있음 → `apply` ④ 답 + 대상 없음 → `drop`. 시험(`correctionsScreen.test.ts:174-204`)이 wait(옛 목록·null)/apply(성공·조용한 실패)/drop(대상 없음·더 새 요청)/wait(옛 요청) 모두 닫는다. 비교는 객체 동일성(`!==`)이고, 조용한 실패도 `listFromFirstError`(`logic.ts:267`)가 `{...prev, query}` 로 `query` 를 갱신해 `apply` 로 이어진다 — 실행해 확인.
- 화면 effect(`CorrectionsScreen.tsx:147-156`)는 이 결과만 따른다: `wait` → 그대로 / 그 밖 → 기록을 비운 뒤 `apply` 일 때만 `focus`. 옛 `if (!el) return`(기록이 영영 남던 결함 ②) 제거됨.
- **복원 초점(가이드 A12) 보존**: 첫 성공 응답에서 `focusNext = {ids:[go, btn], scroll:true, after:q}`(`:124`) 후 `setOpen`·`setList(next)`(`next.query === q`, `listFromFirstPage`)가 같은 렌더에 반영 → effect 에서 `list.query === after` → `apply`(go 링크가 먼저). 별도 렌더로 갈려도(open 먼저) 첫 렌더는 `wait`, 다음 렌더에서 `apply`. 로직 모델 실행으로 3경우 확인(`apply go_a` / `wait` / `apply`). 한 번만 일어나는 이유: effect 가 `focusNext.current = null` 을 비우고 소비.
- `toggle`(`:216`)·`changeFilter`(`:163`)의 비움이 **복원 직후 첫 조작에서만** 일어나는가 — 복원 기록은 같은 커밋의 effect 가 이미 소비하므로(위) 사용자의 첫 조작 시점엔 `focusNext` 가 이미 `null`, 비움은 no-op. 단어 삭제 경로에서는 응답 전 다른 카드를 누르면 비워져 끌려가지 않는다(요구대로). `onToggle` 은 카드 클릭에서만 호출(`DrawerCorrectionCard.tsx:75`) — 마운트·effect 호출 없음.
- 경쟁: 더 보기 응답이 다시 읽기 중에 와도(`list.query` 가 옛 요청) `wait`; 다시 읽기 두 번(R1 뒤 R2)이면 기록이 R2 로 교체되고 R1 의 답은 `reqRef`·abort 로 반영 안 됨. 더 보기는 `list.query !== query` 로 막힘(`:196`), 다시 읽기 시작 시 `moreCtrl.abort()`(`:109`).
- 변이(전부 원복 확인):

| # | 변이 | 결과 |
|---|---|---|
| M-A | `changeFilter` 가 `focusNext` 를 안 비움 | 1개 실패(배선 시험) |
| M-B | `toggle` 이 안 비움 | 1개 실패(배선 시험) |
| M-C | `reloadKeep` 이 `setQuery(next)` 를 안 함(돌려주기만) | 1개 실패(배선 시험) |
| M-D | 초점 effect 의존성 `[list, open]` → `[open]` | **0개 실패(생존)** → Low L-1 |
| M-E | `listQuery !== after` → `listQuery?.tick !== after.tick` | 0개 실패(생존) — 사실상 동치 변이 `[가능성 높음]`: 틱이 같고 객체가 다른 답은 `reqRef`/abort 로 목록에 반영되지 않는다. 정보 |
| (D 기록 R2a~g 7종) | 기다림 제거 · 대상 없음→wait · 더 새 요청→wait · effect 가 wait 무시 · 옛 effect 모양 · `after` 를 지금 query 로 | D 가 검출 보고, 이번엔 재현하지 않음(위 M-A~C 로 배선 시험의 검출력 표본 확인) |

### 3. `reloadKeep` 변경(범위 밖 변경) — **안전** `[확실]` 근거는 코드, 라이브는 QA
함수형 `setQuery((q)=>…)` → 렌더 시점 `query`·`list.items.length` 로 `next` 를 만들어 `setQuery(next)`·반환(`:170-174`). stale 위험은 **이론상 있고 실제 경로는 닫혀 있다**:
- 부르는 곳은 `afterWordGone`(`:233`) 하나. `onRemoved`·`onNotFound`(PATCH/보관 404)는 단어 시트 안 비동기 핸들러가 **클릭 시점 props** 로 부른다 — 즉 삭제/수정/보관 요청이 도는 동안의 `query`. 그 구간에서 화면 `query` 를 바꿀 수 있는 입구가 없다: 시트는 `aria-modal` 전체 덮개(`Sheet.tsx:66-76`) 아래라 칩·검색을 못 누르고, `dismissible={!busy}`(`WordDetailSheet.tsx:406`)라 요청 중엔 닫히지도 않는다. `retry` 는 오류 상자(목록 없음)에서만 보이고 시트가 열린 상태에선 도달 불가. 복원 응답은 목록이 그려지기 전이라 카드를 못 눌러 시트 자체가 안 열린다.
- 시트가 열 때 시작한 GET 이 404 면 `onNotFoundRef.current()`(`:71-74,93`)가 **매 렌더 갱신되는 ref** 라 최신 클로저 — 오히려 stale 아님.
- 같은 틱 충돌: 이미 삭제된 단어에서 GET 404 와 DELETE 404 가 겹쳐 `afterWordGone` 이 두 번 불리면 두 요청이 같은 `tick` 이고 객체만 다르다. 앞 요청은 abort·`reqRef` 로 폐기, 초점 기록은 뒤 객체로 교체 → 일관(위 모델 실행). 옛 함수형 갱신은 틱이 +2 였을 뿐 차이 없음. 이 중복 호출 자체는 변경 전에도 있던 동작.
- `list.items.length`(→ `reloadLimit`)가 클릭 시점 값인 것은 **변경 전 함수형 코드도 같았다**(`list` 는 클로저). 요청 중 더 보기 응답이 막 도착하면 다시 읽기 개수가 그만큼 작아질 수 있으나 중복·누락은 없고(커서로 이어 읽음) R3 와 같은 종류.
- `moreCtrl` 순서: 다시 읽기 effect 가 `moreCtrl.abort()` 부터 → 더 보기 `catch` 는 `isAbort` 로 무시, `finally` 가 `loadingMore` 를 풀고 `moreCtrl` 을 비움. 커밋 전 틈에 더 보기 응답이 오면 `setList(listWithMore)` 가 먼저 반영되지만 이어서 다시 읽기 응답이 목록을 교체 — 초점 기록은 그 사이 `wait`.
- 선택 사항(필수 아님): 시트가 요청 중에도 닫히게 바뀌는 날을 대비해 `queryRef`/`itemCountRef` 로 최신 값을 읽게 하면 영구히 안전해진다. 지금은 가드가 둘(덮개·`dismissible`)이라 결함으로 세지 않는다.

### 4. R4 — 닫힘 `[확실]`
- `keepSearchTooLong(shown, input) = shown && cpLength(input.trim()) > DRAWER_Q_MAX`(`logic.ts:343`), 화면 `onSearchInput`(`:240-243`) = `setQInput(v)` + `setQTooLong((was) => keepSearchTooLong(was, v))`(순수 갱신자). 안내는 **새로 띄우지 않고**(`shown=false` → false) 유지만 판단. Enter(`commitSearch :178-186`)의 기준도 `v.trim()` 후 `cpLength > 40` 이라 **trim·코드포인트 기준이 같다**(둘 다 `@/components/common/format` 의 같은 `cpLength`).
- 입력 중 조회 0: `onSearchInput` 에 `changeFilter`/`setQuery`/`apiGet` 없음(시험이 본문을 정규식으로 못 박음), `WordSearchBar` 는 `commitWhileTyping={false}` 라 빈 칸이 아니면 `schedule` 이 `none`. 41자→Enter→안내→입력 줄임→해제: 순수 함수 경계(40 해제·41 유지·앞뒤 공백·서로게이트 쌍) 시험 + `error` prop 하나로 `aria-invalid`·`aria-describedby`·`border-bad` 가 모두 묶여(`WordSearchBar.tsx` 입력 속성) 같이 풀린다. IME 조합 중에도 `onChange` 가 `onInput` 을 부르므로 조합 중 해제됨(단어장은 디바운스 300ms 로 곧 확정돼 풀리는 것과 같은 결과).
- 변이: 해제 제거(M-C) → **1개 실패**; D 기록의 trim 제거·`.length`·`onInput={setQInput}` 복귀 등 5종은 D 가 검출 보고.
- 명세 대조: `screens.md:9505` 는 「40자 넘으면 빨간 테두리 + 안내(조회 안 함)」까지만 적고 해제 시점은 안 적음 → 허용 범위 안의 구현 선택(material 차이 아님).

### 5. 회귀 · 시험 위생 `[확실]`
- `logic.ts`: 삭제 줄 0, 타입 2개·함수 2개 **추가만**(`@@ -310,6 +310,40`). `CorrectionsScreen.tsx` 변경은 import · `focusNext` 타입 · 복원 `after: q` · effect · `changeFilter` +1줄 · `reloadKeep` · `toggle` +2줄(주석+비움) · `afterWordGone` · `onSearchInput`·`onInput` — 요청 경합(`reqRef`·`AbortController`·`moreCtrl`)·`more()`·facets·머리 줄·E1/E2/E3·`listFromFirst*` 호출부는 한 줄도 안 건드림.
- 시험 파일 두 개 모두 `diff` 의 삭제 줄 0(기존 시험 삭제·약화 없음, 추가만).
- 이 4개 + `shell/correctionsReturn.test.ts` 를 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid` 로 → **89/89 통과**(DB 접속 없음).
- 로직 모델(실제 `logic.ts` 함수만 부름): 복원 apply · open 먼저 wait · 더 보기 도착 wait · 다시 읽기 응답 apply · 중복 다시 읽기 · 조용한 실패 apply(항목 유지) 전부 기대대로.

### 지적
| # | 심각도 | 내용 | 근거 | 수정 방향 |
|---|---|---|---|---|
| L-1 | Low | 초점 effect 의존성 `[list, open]` 을 시험이 못 박지 않는다(M-D `[open]` 생존). R2 수정은 「`list` 가 바뀔 때 effect 가 다시 돈다」에 기대므로, `[open]` 이 되면 단어 삭제 뒤 초점이 영영 안 옮겨진다(복원은 `open` 이 같이 바뀌어 계속 동작 → 눈에 안 띔) | `CorrectionsScreen.tsx:156` · 변이 M-D 0개 실패 · `eslint` 는 `exhaustive-deps` 경고만 낼 것 `[추측]` | `correctionsScreen.test.ts` 배선 시험에 `assert.match(screen, /\}, \[list, open\]\)\s*\n\s*\/\*\* 사용자가 조건을 바꿈/)` 한 줄(또는 effect 블록 끝 정규식). 선택 |
| L-2 | Low | R4 의 「trim 기준이 확정과 같다」가 `keepSearchTooLong` 쪽만 고정된다. `commitSearch` 의 `v.trim()` 을 빼는 변이(M-F)가 생존 — 둘이 어긋나면 「확정하면 통과할 입력」에 안내가 남거나 그 반대가 생긴다 | `CorrectionsScreen.tsx:179` · 변이 M-F 0개 실패 | 배선 시험에 `assert.match(screen, /const t = v\.trim\(\)\s*if \(cpLength\(t\) > DRAWER_Q_MAX\)/)` 한 줄. 선택 |

둘 다 REV-184 때도 있던 같은 종류의 시험 구멍(R5)이며 제품 동작 결함이 아니다. QA 를 막지 않는다.

### QA 에 추가로 넘기는 항목
1. **단어 삭제 뒤 초점(R2 재현)**: 시트에서 [삭제] → 토스트 직후(응답 전, 네트워크 제한으로 지연) **다른 카드를 탭** → 초점·스크롤이 탭한 카드에 남고 응답 뒤에도 원래 카드로 끌려가지 않는다 / 아무것도 안 누르면 응답 뒤 그 카드의 요약 버튼에 초점(TalkBack 으로 안내 순서).
2. **복원 초점**: 카드 펼치고 [원래 대화 보기 ›] → ← 「교정 모음으로」와 기기 뒤로가기 둘 다 같은 조건·그 카드 펼침·[원래 대화 보기 ›] 초점이 **한 번**, 이어서 다른 카드 첫 탭에서 초점이 끌려가지 않음.
3. **R4 라이브**: 41자(이모지 포함) Enter → 붉은 테두리·「검색어는 40자까지예요」 → 글자를 지워 40자 이하 → 안내·테두리 즉시 사라지고 요청 0(네트워크 탭), 다시 Enter 로만 조회. 한국어/일본어 IME 조합 중에도.
4. **단어 시트 모달성 라이브**: 삭제 요청 중 시트가 닫히지 않고 뒤 칩·검색이 눌리지 않음(`reloadKeep` 안전 근거) — 실기기에서 확인.

```json
{ "reviewId": "REV-185", "status": "PASS", "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 }, "native_change": false,
  "closed": { "R1": "닫힘", "R2": "닫힘", "R4": "닫힘" }, "reloadKeep": "안전(시트 모달·dismissible=!busy, onNotFound ref 최신)",
  "high_risk_areas": ["단어 삭제 뒤 초점(응답 전 다른 카드 탭)", "복원 초점 1회", "40자 안내 해제·IME", "시트 요청 중 모달성"] }
```
