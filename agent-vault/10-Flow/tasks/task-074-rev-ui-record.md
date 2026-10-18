---
task_id: task-074
role: reviewer
review_id: REV-074U
title: "task-074 화면(UI) reviewer 기록 — REV-074U (행 별·출처 4칸·빈 화면·시트 머리 별·공용 Sheet headerAction·교정 모음 연결)"
status: PASS_WITH_NOTES
tags:
  - type/task-record
  - domain/vocab
  - domain/ui
created: 2026-10-18
---

# REV-074U — task-074 화면(UI) 독립 감사 (Reviewer 기록)

이력서 [[task-074-improve-word-favorites]] · 구현 기록 [[task-074-dev-ui-record]] · 가이드 정본 `docs/screens.md` §32 · 서버 감사 [[task-074-rev-server-record]] · 승인 데모 `docs/demo/task-074-word-favorites-v2.html`(읽기 전용) · 미러 `~/.node-local/thekaiwa-rev074u`(검증)·`-mut`(변이) — 저장소 원본·다른 미러·DB·서버 기동·운영 포트 접촉 0.

## 판정 — **PASS_WITH_NOTES**

```json
{ "reviewId": "REV-074U", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 0, "medium": 1, "low": 6 }, "native_change": false,
  "high_risk_areas": ["아래 「QA 가 실제로 확인할 곳」 1~12"] }
```

**불편한 사실부터.**
1. **화면 쪽 동작 시험은 얇다 — 내가 넣은 새 변이 18개 중 17개가 시험을 통과(생존)했다.** dev 의 변이 점검 31+16 이 전부 포착이라는 숫자는 정확하지만, 그것은 `favorite.ts` 의 순수 규칙·부품 함수에 몰려 있다. 가이드가 「반드시 시험·QA 로 고정」이라 적은 W4~W6·W13(연타·실패 되돌림·404 시트 닫기·저장/보관 응답이 별을 되돌리지 않음·즐겨찾기 칸에서 끈 뒤 다시 읽기+초점)의 **배선**(`WordsScreen` 효과 처리, `WordDetailSheet` 의 `readAt` 찍기, 훅의 `sendFavorite` 경로·`dispose`)은 jsdom 이 없어 동작 시험이 0이고, S1 소스 스캔이 몇 글자만 고정한다. 코드를 읽어 확인한 바로는 **지금 배선은 맞다**(결함은 못 찾았다). 하지만 이 시험은 누군가 한 줄을 바꿔도 알려주지 않는다 — 특히 `sendFavorite` 의 켜기/끄기 경로가 뒤집혀도 모든 시험이 통과한다(A12).
2. **얇은 여유 하나**: 히라가나·한글을 모두 끈 70px 행에서 누르는 곳(44×44)의 아래 끝이 행 아래 끝과 0.63px(내 Chrome 글꼴에서는 1.63px)밖에 안 떨어져 있다. 지금은 겹치지 않지만 폰 글꼴이 1px 만 달라도 여유가 0 에 닿는다.
3. **승인 데모에 없던 화면에 별이 하나 더 노출된다**(채택 교정 모음 → 단어 상세 시트). Leader 가 「같은 시트라 일관성」으로 결정했고 게이트 상태는 `DEMO_GATE_PASSED` 이지만, 사용자가 본 적 없는 노출이므로 최종 요약에서 한 줄 알려야 한다.

## 지적 표

| # | 심각도 | 지적 | 위치 | 근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | **Medium** | 화면 배선의 동작 시험 부재 — 새 변이 18개 중 17개 생존(A1~A9·A11a/b·A12~A17). 포착 1개(A10)도 소스 스캔 | `WordsScreen.tsx` onEffect·listReadAt·focusCheck / `WordDetailSheet.tsx` `favStamp`·`setReadAt` / `useWordFavorites.ts` `sendFavorite`·dispose / `WordsEmpty.tsx` 버튼 배선 / `WordRow.tsx` `line3Pad`·`top` 배선 | 아래 「직접 변이 표」. 확인용으로 생존 17개를 **한꺼번에** 적용하고 전체 시험을 돌린 결과: 「전체 적용」 줄 참조 | (a) `WordsScreen` 의 효과 처리를 `correctionsFavoriteEffect` 처럼 순수 함수(`wordsFavoriteEffect(x, ctx) → {toast, closeSheet, reloadAll, reload+focusCheck}`)로 빼고 동작 시험 · (b) `sendFavorite` 를 가짜 `fetch` 로 돌려 URL(`/favorite`↔`/unfavorite`)·상태 매핑 고정 · (c) 시트의 「요청 보내기 직전 stamp → 응답 뒤 `setReadAt(t)`」를 작은 순수 헬퍼 또는 최소 S1 스캔으로 고정 · (d) `WordsEmpty` 두 버튼의 `onClearFavorite` 배선 스캔. **QA 를 막지 않는다** — 대신 아래 QA 항목 2·3·4·5·6·9 를 실제 Chrome 으로 반드시 본다 |
| L-1 | Low | 행 별 누르는 곳 아래 여유가 글꼴에 기대는 1px 안팎 | `FavoriteStar.tsx` ROW_BOX(`before:-bottom-[5px]`)·가이드 32-2 | 독립 실측 최소 1.63px(dev 0.63px, 70px 행). 위쪽 여유는 25px 이상 | 글꼴 130%·폰 글꼴에서 QA W8 로 재확인. 여유가 0 이하로 보이면 `-bottom-[4px]`(위 12)로 한 칸 이동 |
| L-2 | Low | 별 요청에 클라이언트 시간 제한이 없다 — 느린/멈춘 망에서 그 별은 **보이는 변화 없이** 눌러도 반응이 없다(D5 A 의 「잠김은 안 보임」과 겹침) | `useWordFavorites.ts` `sendFavorite`(`apiPost` 에 timeout 없음) | 코드 확인 — 응답이 안 오면 `pending` 이 풀리지 않음. 다른 보관/수정 요청도 같은 한계 | 이번 범위는 아님(디자인 D5 수용). QA 「느린 망」에서 체감 확인 후 필요하면 designer/Leader 가 별도 결정(예: 10초 `withTimeout` → `NETWORK_ERROR`) |
| L-3 | Low | 시트의 처음 값이 목록 미리보기(`readAt=0`)인데 GET 이 실패하면 별 기록이 서버 값을 영구히 이긴다 | `WordDetailSheet.tsx` `useState(0)` | 가이드 32-5 가 정한 그대로 — 좁은 경우(GET 실패+다른 기기 변경) | 수용(가이드 설계) |
| L-4 | Low | 가이드 §32 가 구현과 어긋난 곳이 갱신되지 않음 — 교정 모음 연결, 훅 인자(`useWordFavorites({inFavoriteView,onEffect})`), 「돌려주는 `view` 는 렌더마다 같은 함수」(실제로는 상태가 바뀔 때만 새 함수) | `docs/screens.md` §32-5·32-9 | dev 기록 「가이드와 다른 점」 2·1 | designer/Leader 가 §32 에 한 줄씩 반영(코드 변경 불필요) |
| L-5 | Low | 즐겨찾기 칸에서 별을 끄는 중에 칸을 바꾸면(응답 대기 0.3~0.6초) 지금 깔린 목록 기준으로 「즐겨찾기에서 뺐어요」 토스트가 뜰 수 있다 | `WordsScreen.tsx` `inFavoriteView: () => listRef.current.shown?.source === 'favorite'` | 설계(가이드 32-9 「응답 순간 지금 깔린 목록」)의 부작용. 토스트만 어긋나고 데이터는 맞다 | 수용. QA 가 눈으로 보면 폰 확인 목록에만 올림 |
| L-6 | Low(고지) | 채택 교정 모음의 단어 상세에도 머리 별(승인 데모에 없던 노출) | `CorrectionsScreen.tsx`(+13줄)·`correctionsFavorite.ts` | `git diff` 확인, `fav={fav}` 한 줄이 노출 스위치. 별 값을 되먹일 목록이 없어 별 기록은 시트만 본다 | 수용(같은 승인 부품·같은 시트). Leader 가 최종 요약에 「교정 모음 시트에도 별이 보입니다」를 쓸 것. 사용자가 원치 않으면 `fav={fav}` 한 줄만 지우면 된다 |

## 관점별 결과

1. **공용 `Sheet`** — 문제 없음 **[확실]**. `git diff -U0` 의 `-` 줄 0, 변경은 prop 타입·구조분해·`{headerAction}` 한 줄뿐. 변경 전 `Sheet.tsx`(`git show HEAD:`)를 별도 파일로 두고 title 4 × dismissible 3 × describedBy 2 × children 7형태 × open 2 = **336조합**을 서버 렌더로 새·옛 비교 → 전부 바이트 동일(+`headerAction` `undefined`·`null`·`false` 명시도). dev 골든 파일이 옛 Sheet 렌더와 일치함도 독립 확인(골든 자체 검증). 넘길 때는 `</h2>` 와 닫기 `<button` 사이에 감싸는 요소 없이 끼움. 호출 `<Sheet` 51곳·43파일(가이드 수와 같음), `headerAction` 을 넘기는 곳은 `WordDetailSheet` 1곳뿐. effects(초점은 제목 `h2`, 스크롤 잠금, Esc `!defaultPrevented`)는 diff 에 없음 → 기존 동작 불변. (Esc/초점 가두기 없음은 task-072 때 알려진 기존 한계)
2. **행 구조·버튼 중첩·실측** — 결함 없음 **[확실]**. 별은 `li` 안 열기 단추의 **형제**, `li` 에 처리기 없음(B2), 별이 `z-[1]` 로 위(6점 `elementFromPoint` 가 전부 별), `FillerRow`·`PagingRow`·스켈레톤 불변. H2 판정 `rowStarLayout` = `HangulLine`(`!loaded`/`!showHangul` → null, loading → 자리표시, `ready` 이고 `hangulLine` 이 falsy → null, 그 밖 → 그림)과 `JaText`(`givenRuby !== undefined` 라서 `ruby !== null` 이 `reserve`) 조건을 코드로 대조해 일치. **독립 실측**: 빌드된 CSS + 실제 `WordsPageList`/`WordRow`/`JaText`(실제 `<ruby><rt>`)/`HangulLine` 마크업(설정 로드는 `useSyncExternalStore` 를 시험 프로세스에서만 바꿔 흉내, dev 의 정규식 끼워넣기와 다른 방식) → 헤드리스 Chrome. 정렬 2 × 히라가나 켬/끔 × 한글 ready/none/off/loading × 행 5종 × 폭 360/390/412 = **240행**: 아이콘↔글자·뱃지 겹침 0 · 누르는 곳이 행 안(최소 아래 여유 **1.63px**, 위 25.38) · 아이콘 오른쪽 끝=뱃지 오른쪽 끝(차 0.00) · 아이콘 위↔뱃지 아래 ≥2.75px · 누르는 곳이 덮는 글자 최대 410.8px²(≤525). 첫 측정은 내 도구 오류(뷰포트 밖 `elementFromPoint`·`truncate` 밖으로 긴 Range 사각형)로 58행이 나쁨으로 나왔다가 도구를 고쳐 0 — 결함 아님. 관찰: 뱃지 있는 행은 첫 줄이 27→28.63(히라가나 끔)으로 1.63px 커지는데 측정이 이미 포함. **못 한 것**: 글꼴 130%·실제 폰 글꼴·TalkBack → QA/폰.
3. **상태 규칙·경쟁** — 코드 판독으로 결함 못 찾음 **[가능성 높음]**(동작 시험 부재라 확신은 '읽기'까지). 연타(`pending` 이면 요청 0), 낙관적→성공/실패(실패는 `before` 복원, `!to` 아님), 행·시트 공유 기록(`favoriteView` 시각 비교), 저장/보관 응답이 옛 별 값을 들고 와도 `readAt`(보내기 직전 stamp) < 별 확정 시각이면 기록이 이김, 서버 응답 `favorite` 없으면 요청 값, 404 → 토스트 1번+시트 닫기+`reloadAll`, StrictMode 에서 효과 재실행 시 컨트롤러가 다시 만들어져 살아 있음(`ctrlRef` 교체), 언마운트 뒤 응답 무시(`dispose`), 오프라인 `ApiError(status 0)` → `NETWORK_ERROR`. 즐겨찾기 칸 끄기 → `request('reload')`(+분류 숫자는 안 건드림)+`focusCheckRef`→rAF 에서 `body` 면 머리 줄 초점, 쪽 clamp 는 기존 경로가 처리하고 clamp 재요청 응답이 플래그를 소비. L-2·L-3·L-5 는 좁은 한계.
4. **필터·URL·표시** — 이상 없음. 즐겨찾기 칸 = `source=all&archived=0&favorite=1&sort=…&page=1&limit=7`(정확 단언 U1), 다른 칸은 `favorite` 키 자체가 없음(0 도 안 보냄), `wordsCondKey` 는 `f.source` 가 이미 열쇠라 칸마다 달라 1쪽(U2), 머리 줄 앞말 순서 보관함>검색>즐겨찾기>출처와 조건 「즐겨찾기」 규칙(U3, `listHeader` 가 필터 전체를 `listConditionText` 에 넘김을 코드로 확인), 빈 화면 우선순위(U4)·두 경우 문구·「‘q’ 추가하기」 없음(U5), 스켈레톤은 `WORD_SOURCE_OPTIONS` 상수 공유라 4칸(`TabSkeleton` 에는 출처 분절 없음 확인).
5. **접근성** — 이상 없음. 별 이름 고정(「{단어} 즐겨찾기」, 단어 `lang="ja"`)+`aria-pressed`(늘 `"true"/"false"`), 잠김은 `aria-disabled`(`disabled` 아님)·`title` 없음, 초점 순서 열기→별(B2), 시트 머리 44×44·제목→별→닫기, 색은 `fill-warn stroke-ink`/`stroke-ink2` 토큰만(빌드 CSS 에 `.fill-warn`·`.stroke-ink`·`.stroke-ink2` 확인, 새 색 0). TalkBack 은 `::before` 영역이 아니라 28×28 상자 기준으로 짚는다는 점은 가이드가 이미 Minor 로 기록.
6. **문구·데모 일치** — 이상 없음 **[확실]**. 데모 v2 `var C`(476~494행) 의 `star·seg·cond·lead·noneT/B/Btn·matchT/B/Btn·removed` 와 `err.fail/offline/gone` 을 `FAVORITE_COPY`(키 11개) 및 `GENERIC_ERROR`·`NETWORK_ERROR`·`WORD_NOT_FOUND` 와 글자 단위로 직접 대조해 전부 일치. 데모 대안 문구(`act`·`added`·`formRow*`·`addRow*`)·429 문구는 구현에 0건. 엔진명·model_id·`fetch(`·`window.Capacitor`·`localStorage` 0(새·바꾼 화면 파일 grep).
7. **교정 모음 연결** — 이상 없음. `inFavoriteView` 늘 false(그래서 `reload`/「뺐어요」 토스트가 안 생김, F1), 404 는 그 단어 시트가 열려 있을 때만 이 화면의 기존 `afterWordGone`(토스트 1번), 훅은 첫 비어 있음 조기 반환보다 앞(eslint rules-of-hooks 통과), 이 화면의 기존 줄 수정·삭제 0(+13줄). 단 L-6.
8. **시험의 질** — 아래 구분표·변이 표. 기존 시험 3개 변경은 `git diff HEAD` 줄 단위로 **약화 아님**: `labels.test.ts` 한 줄은 출처 칸을 3→4칸으로 의도대로 고침(메시지 추가), `wordDetailOrigin.test.ts`·`wordsScreenParts.test.ts` 는 도우미에 새 props 만 추가(단언 변경 0).
9. **데모 게이트** — `check.mjs check` → `DEMO_GATE_PASSED`(task-074 approved v2, 해시 verified `f07f84a68f567968…`, §32 머리말과 같음). `evidence.jsonl` 43행 `approve v2`(prompt_ts 10:09:17) 확인, 이 감사는 `.claude/state/demo-gate/` 를 쓰지 않았고 에이전트가 직접 쓴 흔적도 못 찾음.

### 가이드와 다른 점 7개 판정 (dev 기록)

| # | 내용 | 분류 | 판정 |
|---|---|---|---|
| 1 | `WordDetailSheet` 호출처 `CorrectionsScreen` 하나 더 → Leader 결정으로 연결 | implementation(승인 부품의 다른 호스트 노출) — 사용자에게는 새 노출 | **수용 + 고지 필요**(L-6). `screens.md` 반영은 L-4 |
| 2 | 훅 모양 `useWordFavorites({inFavoriteView,onEffect})`, 컨트롤러를 효과 안에서 생성 | implementation | **수용** — StrictMode(`reactStrictMode: true`) 재마운트 대응이 근거, 코드로 확인. `view` 가 상태 변화 때만 새 함수인 것도 행에는 원시값만 넘겨 무해 |
| 3 | `send` 실패를 `Error+{status}` 로 다시 던짐 | implementation | **수용** |
| 4 | `ok`·`fail` 무시 조건 확대(처리 중 아닌 기록도) | implementation | **수용** — 잠금 때문에 정상 흐름에선 안 생기는 중복 응답 방어 |
| 5 | 목록 `readAt` 갱신을 성공 응답에만 | implementation(방어적) | **수용** — 오류 응답이 시각을 앞당겨 더 새로운 기록을 지는 경로를 막음. 읽기로 정당 |
| 6 | `noFavoriteMatch` 본문을 `favoriteMatchParts`+`matchBody('')` 로 조립 | implementation | **수용** — 글자 단일 출처, U5 가 `matchBody('‘ねこ’ 검색')` 와 같음을 고정 |
| 7 | 히라가나 끔 `2.021em` | 가이드 값 그대로 | **수용** — 내 독립 실측에서도 겹침 0(L-1 여유만) |

수정 요구 0. material(재승인 필요) 0.

### 시험 구분표

| 파일 | 개수 | 성격 |
|---|---|---|
| `vocab/__tests__/favorite.test.ts` | C1~C7 | **동작** — 가짜 `send` 로 컨트롤러를 약속째로 돌림 |
| | V1~V2, L1~L2, U1~U4, U6 | **동작(순수 함수)** — 규칙 표·URL·열쇠·머리 줄·빈 화면·문구 |
| | U5, B4 | **정적 렌더** — 빈 화면 문구, 목록 마크업(설정 로드 전 상태만) |
| | B1~B3 | **요소 트리/처리기 직접 호출** — 부품 함수를 렌더 문맥 안에서 불러 처리기 호출 |
| | S1 | **소스 스캔** — `.favorite` 직접 사용 0·헤더 별 조건·`favView`/`onClearFavorite` 한 줄 |
| `common/__tests__/sheetHeaderAction.test.ts` | H1·H2 | **정적 렌더(골든 바이트 비교)** — 내가 독립 검증 |
| | H3 | 소스 스캔 |
| `drawer/__tests__/correctionsFavorite.test.ts` | F1~F4 | **동작(순수 함수)** · F5 요소 트리 · S1 스캔(배선 X1~X6) |
| **없는 것(M-1)** | | `WordsScreen` 효과 처리, `WordDetailSheet` readAt 배선, `sendFavorite` 경로, 훅 dispose, `WordsEmpty` 버튼 배선, `WordRow` 의 `line3Pad`·`top` 배선(로드된 설정 상태의 행 렌더) |

### 직접 변이 표 (별도 `-mut` 미러, 임시 파일+rename 으로만 쓰고 저장소 원본에서 복원 — 매번 `restored True`, 판정 시험 = `vocab`+`common`+`drawer` 538개)

| # | 변이 | 결과 |
|---|---|---|
| A1 | `WordRow` 셋째 줄 `pr-6` 를 `layout.line3Pad` 무시하고 항상 | **생존** |
| A2 | `WordRow` 별 `top` 을 `2.471em` 고정(배선) | **생존** |
| A3 | `WordsScreen` 끈 뒤 초점 확인(rAF) 판정 제거 | **생존** |
| A4 | `WordsScreen` `setListReadAt` 제거(기록이 서버 값을 늘 이김) | **생존** |
| A5 | `WordDetailSheet` 저장(PATCH) 뒤 `setReadAt(t)` 제거 | **생존** |
| A6 | `WordDetailSheet` 보관 뒤 `setReadAt(t)` 제거 | **생존** |
| A7 | 저장의 `favStamp()` 를 요청 보내기 전이 아니라 응답 뒤로 | **생존** |
| A8 | 훅 정리에서 `dispose()` 누락 | **생존** |
| A9 | 404 때 열린 시트를 닫지 않음 | **생존** |
| A10 | 시트 머리 별을 보기 모드에서만 | 포착(S1 스캔) |
| A11a/b | 빈 화면 두 버튼이 `onClearFavorite` 대신 `onShowAll` | **생존** ×2 |
| A12 | 훅 `sendFavorite` 경로 뒤집힘(켜기↔끄기) | **생존** |
| A13 | `inFavoriteView` 가 늘 false(칸에서 꺼도 행 안 빠짐) | **생존** |
| A14 | `WordsScreen` `onStar` 가 보인 값을 한 번 더 뒤집어 보냄 | **생존** |
| A15 | 별 실패 토스트 제거 | **생존** |
| A16 | 즐겨찾기 칸에서 끈 뒤 다시 읽기 제거 | **생존** |
| A17 | 단어장 상세 시트에 `fav` 안 넘김 | **생존** |
| C1~C7 | (대조) `aria-pressed` 반전 · H2 판정 반대 · `favoriteView` 비교 방향 반전 · 주소 `favorite=true` · 4번째 칸 label 변경 · 시트 별이 보인 값을 뒤집어 보냄 · 별을 열기 단추보다 앞으로 | **7/7 포착** |

새 변이 18개(A) 중 **포착 1·생존 17**, 대조 7/7 포착 → 순수 규칙·부품 함수는 단단하고 배선이 비어 있다는 뜻. 생존 17개 전체 적용 후 전체 시험: **(아래 「전체 적용」 줄)**

## 증빙 숫자 대조

| 항목 | dev 보고 | 내 재실행(미러 `rev074u`, 저장소 `src` 와 `diff -rq` 동일, package.json 동일, `prisma generate` 안 함) |
|---|---|---|
| `tsc --noEmit` | 0 | **0** (`--incremental false`) |
| `eslint src/components src/modules/learning src/app/api/v1/words` | 오류 0 · 경고 5(기존 다른 파일) | **오류 0 · 경고 5**(`settings/*`·`admin/trace/*` set-state-in-effect, 같음) |
| 전체 시험(가짜 `DATABASE_URL`, 동시성 1) | 4,317 중 통과 4,314·실패 0·건너뜀 3 | **4,320 중 통과 4,317·실패 0·건너뜀 3**(= dev 숫자 + 내 Sheet 비교 3개) |
| 건너뜀 3(문서·모델 대조) | 미러에 docs/ 없음 | `KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO` 에 저장소 경로를 주고 `task074FavoriteRoutes`·`task068Words`·`modelPackage` 실행 → **25/25 통과·건너뜀 0** |
| `next build` | exit 0 | **exit 0** |

## QA 가 실제 서버·실제 Chrome·실제 DB 로 확인할 곳 (high_risk_areas)

1. **2계정 교차 격리** — 계정 A 가 켠 별이 B 의 목록·즐겨찾기 칸·시트에 안 보임, B 가 A 의 내 단어 id 로 `/favorite` → 404(화면은 404 문구+목록 다시 읽기).
2. **켜기/끄기 방향** — 행·시트에서 누르면 실제 요청이 켜기 `POST …/favorite`, 끄기 `POST …/unfavorite` 인지 네트워크 탭으로(시험이 못 잡는 A12).
3. **연타** — 행에서 빠르게 5번, 행↔시트 번갈아 눌러도 요청 1건씩, 초점 유지, 느린 망(throttle)에서 잠김 동안 눌러도 요청 안 늘어남(L-2: 멈춘 망 체감).
4. **실패·오프라인·404** — 응답 가로채기로 500·오프라인·404: 누르기 전 값으로 되돌림+문구, 404 는 열린 시트 닫힘+토스트 정확히 1번+목록 다시 읽기(A9·A15).
5. **즐겨찾기 칸에서 끄기** — 행이 빠지고 토스트 1번, 머리 줄 숫자·쪽 수·합계, 마지막 쪽에서 비면 clamp, 키보드로 끄면 초점이 머리 줄로(A3·A13·A16). 끄는 중 칸을 바꿨을 때 토스트(L-5).
6. **시트↔목록 동기화(W6)** — 시트에서 별을 켜고 곧바로 [수정][저장]/[보관하기] 를 이어 눌러도 시트·목록 행 별 값 불변(A4~A7). 시트에서 켠 뒤 닫으면 목록 행도 켜짐.
7. **히라가나 끔·한글 끔 행(W8)** — 별이 뱃지 바로 아래, 글자 겹침 0, 아래 행 침범 0(L-1: 폰 글꼴), 히라가나 켬 행과 비교.
8. **글꼴 130%·360/390/412** — 별 자리·겹침·4칸 분절 잘림 0(내가 못 한 조합), 한글 줄 있는 행에서 셋째 줄이 짧아지지 않음·없는 행만 짧아짐(A1·A2).
9. **다크 B2 윤곽** — 흰 테두리처럼 보이는 것은 사용자 승인된 모습인지 확인만(새 색 없음).
10. **시트 머리 별 키보드·Esc** — 제목→별→닫기 탭 순서, Enter/Space 로 토글(시트 안 닫힘), Esc 는 시트를 닫음, 수정 모드에서도 같은 자리·삭제 확인에서는 없음(A10), 별 누른 뒤 [취소] 해도 별 유지.
11. **채택 교정 모음 → 단어 상세**(L-6) — 시트 머리 별 노출·토글·끄기 토스트 **없음**, 실패 토스트 1번, 404 시 시트 닫힘+토스트 1번, 단어장 탭의 「즐겨찾기」 칸에 반영.
12. **StrictMode 개발 모드** — `next dev` 에서 별이 눌리고 응답을 받는지(효과 재실행 뒤 컨트롤러 생존, A8), 단어 추가 시트 변화 0, 출처 4칸·빈 화면 두 경우·「‘q’ 추가하기」 없음, 보관·삭제·수정·페이징·검색·정렬 회귀 0.

## Developer 에게 (필수 아님 — M-1 권고, QA 병행 가능)
- 시험 보강 후보 4개: `wordsFavoriteEffect` 순수화+동작 시험 · `sendFavorite` 가짜 `fetch` 시험(URL·status) · 시트 `readAt` stamp 순서 고정 · `WordsEmpty` 버튼 배선 스캔. 보강하면 위 A 변이 17개를 같은 스크립트로 다시 돌려 포착 수를 적는다(스크립트 scratchpad `rev074u/mut.py`, 저장소 밖).
- 제품 코드 수정 요구는 없다. 보강 후에는 Reviewer 부터 재순환이 원칙이지만, 시험만 바뀐 경우 변경 목록으로 가볍게 재확인한다.

## 재확인 (REV-074U2) — 감사 후 시험 보강 리팩터 (최종)
- 범위: developer 「감사 후 시험 보강(REV-074U M-1)」의 순수 함수 리팩터가 동작 보존인지, 시험이 실제 동작을 고정하는지. 기준 = 미러 `~/.node-local/thekaiwa-dev074-ui2/src`(리팩터 직전, 읽기 전용), 작업 미러 `~/.node-local/thekaiwa-rev074u2`(+`-mut`).
- [착수] 이력서·dev 기록·이전 감사 기록 읽음. 다음: ① diff 줄 단위 ② 렌더 cmp ③ 변이 ④ 시험 질 ⑤ 증빙.
- [중간 1] **ui2 미러 = 리팩터 직전 확인**: `diff -rq ui2/src repo/src` 결과가 정확히 6개 파일(고침 4 = `WordsScreen.tsx`·`useWordFavorites.ts`·`WordDetailSheet.tsx`·`__tests__/wordsPaging.test.ts`, 새 2 = `wordsFavoriteEffect.ts`·`__tests__/favoriteWiring.test.ts`)뿐 → developer 가 밝힌 변경 목록과 일치, 그 밖 파일 변경 0. 미러 `rev074u2`(=저장소 `src`·`tests`·`prisma`·`package.json` `diff -rq` 동일, `.next` 삭제, `prisma generate` 0)·`-pre`(= ui2 src)·`-mut`(= 저장소 src) 생성, 세 미러의 변경 파일 inode 가 ui2 와 서로 다름 확인.
- [중간 1] **동작 보존(제품 코드 diff 줄 단위 읽음)** — 호출 순서·인자·조건·타이밍이 바뀐 곳 0. 상세는 아래 「동작 보존 표」. **렌더 불변**: 내 독립 스크립트(`scratchpad/rev074u2/snap2.tsx`, 새 헬퍼 import 0) 990종(목록 920 · 상세 시트 32 · 빈 화면 20 · `WordsScreen` 전체 18) 전/후 `cmp` **바이트 동일**(4,293,445B, 서로 다른 HTML 212종, 시트 보기/수정/삭제 확인 서로 다름·별은 보기·수정에만, 수화 전/후 화면 다름 = 공허하지 않음). 다음: 변이 재실행 → 시험 질 → 증빙 재실행.

### REV-074U2 판정 — **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 2 · 정보 1)
- 불편한 사실 먼저: ① **리팩터 전 상태는 git 에 없다** — 동작 보존의 증거는 `ui2` 미러와의 diff·렌더 비교뿐이고, 그 미러가 정말 직전인지부터 확인했다(위 [중간 1]: 차이 = 정확히 6개 파일). ② developer 가 「생존 7개」라 쓴 것은 **실제 16개**다(같은 종류의 배선 줄을 내가 9개 더 찾았다). 분류와 한계 서술은 맞지만 숫자가 낮게 적혔다. ③ 그래도 제품 동작·DOM·요청은 **변하지 않았고**(아래 근거 3겹), 이전 M-1 의 핵심 — 「동작 시험 부재」 — 은 감사자 변이 **21/21 포착**(이전 1/18)으로 해소됐다. 남은 것은 시험이 닿지 못하는 **한 줄짜리 통과 배선**이고 QA 실제 Chrome 항목으로 덮인다(두 항목 추가 권고). 이전 Medium M-1 → **Low L-1 로 하향**.

| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| L-1 | Low | `WordsScreen.tsx` 효과·응답 꼬리 인자 줄, `useWordFavorites.ts` 훅 본문, `WordDetailSheet.tsx` GET 효과 | 시험이 닿지 못하는 한 줄짜리 배선 변이 **16개 생존**(developer 표기 7). 같은 종류: 화면 인자 줄 11(R1~R7·`nextFrame` 즉시 실행·`activeElement` 늘 null·효과 `reloadAll` 빈 함수·효과 `focusCheck` 다른 ref) · 훅 3(`stamp` 늘 0·`view` 의존성 `[]`·**`press` 가 보인 값을 뒤집음**) · 시트 GET 경로 2(stamp 를 응답 뒤로·`setReadAt` 제거). 가장 사용자 영향이 큰 것은 훅 `press` 방향 뒤집힘(N11c): 핸들러 층(`wordsStarHandler`, W5)과 컨트롤러는 시험이 잡지만 그 사이 훅의 `useCallback` 한 줄은 안 닿는다. | 변이 표(아래) 57회 중 생존 16, 전부 `restored True` | 제품 코드 수정 불필요. QA 에 「시트 GET 응답 전에 별 누르기(느린 망)」·「훅 방향: 네트워크 탭 켜기 `/favorite`·끄기 `/unfavorite`」 확인을 **필수**로(아래 QA 갱신). 선택: 이 16개를 잡는 소스 스캔(wiring 줄 고정) 또는 훅 실행 하네스는 후속 소작업 후보. |
| L-2 | Low | `favoriteWiring.test.ts` W3 제목 「진짜 컨트롤러 + 화면 배선」 | 시험 안에서 `inFavoriteView`·`onEffect` 두 줄을 직접 이어 붙인다 — **진짜 `WordsScreen` 의 줄을 실행하지 않는다**(R3·R4·R6·R7 이 생존한 이유). 제목만 보면 화면 배선이 증명된 것처럼 읽힌다. | R3/R4/R6/R7 생존 + W3 소스 | 제목·주석을 「컨트롤러 + 실행 함수 결합」으로 정정하거나 L-1 한계에 명시. |
| (정보) | - | `useWordFavorites.ts` 의 `stampedSend` | 순수 함수가 `'use client'` 훅 파일에 있어 `WordDetailSheet` 의 import 가 타입 → 값으로 바뀜. 번들은 둘 다 클라이언트라 영향 0, 순환 없음(`useWordFavorites` 는 시트를 import 하지 않음), build 통과. | 소스·build | 취향 — 다음에 만지면 `wordsFavoriteEffect.ts` 쪽으로. |

### 동작 보존 표 (옛 인라인 ↔ 새 함수, 제품 코드 diff 3개를 줄 단위로 대조)
| # | 옛 인라인 | 새 코드 | 같은 결정? |
|---|---|---|---|
| 1 | `if (x.toast) showToast(x.toast)` 가 맨 먼저(404·끔·실패 모두 1번) | `runWordsFavoriteEffect` 첫 줄 `if (p.toast) d.showToast(p.toast)`, 계획 표가 세 경우 모두 `toast: x.toast` | 동일 |
| 2 | 404: `setSheet(s => s?.kind==='detail' && s.id===x.id ? null : s)` 후 `reloadAll()` | `p.closeDetailId`(=x.id, notFound 일 때만)→`detailSheetAfterGone`(`s!==null && kind==='detail' && id 일치`), `p.reloadAll`→`reloadAll()` | 동일(가드 `!== null` 은 `x.id` 가 늘 문자열이라 늘 참 — 널이어도 옛 갱신 함수가 상태를 안 바꿨음) |
| 3 | `else if (x.reload)`: `focusCheckRef.current=true` → `request('reload')`, 404 가 우선 | 계획 표: `notFound` 를 먼저 return, 실행: `focusCheck=true` → `request('reload')` | 동일(순서·우선순위) |
| 4 | 칸 판정 `listRef.current.shown?.source === 'favorite'` | `wordsInFavoriteView(list)` 같은 식 | 동일 |
| 5 | 행 별 `useCallback((w, shownOn) => favPress(w.id, shownOn), [favPress])` | `useMemo(() => wordsStarHandler(favPress), [favPress])` | 동일(같은 의존성·같은 안정성) |
| 6 | 응답 꼬리: `if (res.ok) setListReadAt(readAt)` → 토스트 → `out.focusHead` 면 `setFocusReq(scroll:true)` → 초점 확인 걸려 있으면 소비 + `requestAnimationFrame` 안에서 `document.activeElement`/`document.body` 를 그때 읽어 `!a || a===body` 면 `scroll:false` | `finishWordsArrival`: `ok`→`setListReadAt(readAt)` → 토스트 → `focusHead(true)`(화면이 `scroll` 값 그대로 `setFocusReq`) → 소비 + `nextFrame(rAF)` 콜백 안에서 `activeElement()`/`body()` 지연 평가 | 동일(순서·지연 평가·rAF) — **그 위치**도 같음: clamp 조기 return 뒤 |
| 7 | 컨트롤러 수명: 효과 안에서 만들기 → `ctrlRef.current=c` → 정리: `c.dispose()` → 자기 것일 때만 비움 | `mountFavoriteController(ctrlRef, 같은 deps)` 가 같은 순서, 효과는 `useEffect(() => mount(...), [])` 로 정리 함수를 그대로 돌려줌 | 동일(StrictMode 껐다 켜기 포함) |
| 8 | 시트 GET: `const t = favStamp()` → `apiGet(...)` | `stampedSend(favStamp, () => apiGet(...))`: `readAt = stamp()` 를 **먼저** 평가한 뒤 `send()` | 동일(보내기 직전) |
| 9 | 시트 저장/보관: `favStamp()` 가 `try` 밖, `apiPatch|apiPost` 호출 | `try` 첫 줄에서 `stampedSend`(stamp → 요청), `await res` 뒤 `setWord`→`setReadAt(t)` 순서 그대로 | 동일(차이 = stamp 가 `try` 안으로 한 줄 이동; `favStamp` 는 시계라 던지지 않음) |
| 새 분기·새 부수효과·순서 변경 | - | **0** (위 표 밖에 새 조건·새 호출 없음, `onStar` 외 의존성 배열 변경 0, `useCallback` import 만 `useMemo` 로 교체) | - |

- **렌더 불변(독립)**: 내 스크립트 990종 전/후 `cmp` **바이트 동일** — 목록 920(설정 5상태 × 항목 3벌[1개·12개·0개] × 층 4벌 × 즐겨찾기 3벌[없음·모두 켬+잠김·홀짝] × 쪽 4벌[1쪽·중간·끝·총수 모름] × 정렬 2 × 상태 3 중 결정적 부분집합) · 상세 시트 32(기본/보관/내 단어/보관 내 단어 × 별 없음·꺼짐·켬·잠김 × 보기·수정·삭제 확인) · 빈 화면 20(10종 × 조건 2) · `WordsScreen` 전체 18(수화 전/후 × 설정 3 × 평범·`initialWordId`·`initialAdd`). developer 130종과 겹치지 않는 항목(항목 12개 벌·1개 벌·0개·쪽 4벌·시트 수정/삭제 확인 모드·수화 후 화면)을 포함. 공허하지 않음: 서로 다른 HTML 212종, 시트 보기/수정/확인 모두 다름, 별은 보기·수정에만, 수화 전/후 화면 다름. (한계: 서버 렌더 기준 — 효과 뒤 DOM 은 아님. 그 부분은 위 동작 표 + W2·W3·W6 시험이 보증.)

### 변이 재실행 (별도 `-mut` 미러, 임시 파일+`os.replace` 로만 씀, 57회 모두 `restored True`, 판정 = `vocab`+`common`+`drawer` 551개, 기준 551/551)
| 묶음 | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| 감사자 A1~A17 (A11 a/b 포함 18개) | A1 `pr-6` 늘 · A2 별 `top` 고정 · A3 초점 판정 제거 · A4 `setListReadAt` 제거 · A5/A6 시트 저장/보관 뒤 `setReadAt` 제거 · A7 저장 stamp 를 응답 뒤로 · A8 `dispose` 누락 · A9 404 시트 안 닫음 · A10 머리 별 보기에서만 · A11a/b 빈 화면 단추 → `onShowAll` · A12 켜기↔끄기 뒤집힘 · A13 칸 판정 늘 false · A14 행 별 뒤집음 · A15 토스트 제거 · A16 다시 읽기 제거 · A17 시트에 `fav` 안 넘김 | **18/18 포착** | E1 · W6(A3·A4) · C9(A5·A7·A10) · C10(A6) · B7(A8) · W2/W3(A9·A15·A16) · D1(A11) · B5(A12) · W3/W4(A13) · W5(A14) · W7(A17) — A10 은 S1 스캔과 별개로 C9(동작)도 잡음을 따로 확인 |
| 같은 의도, 다른 자리 | A7b `stampedSend` 가 보낸 뒤 찍음 · A7c 보관 stamp 응답 뒤 · A9b `detailSheetAfterGone` 늘 그대로 | **3/3 포착** | C8 · C10 · W2 |
| 대조 C1~C7 | aria-pressed 반전 · H2 판정 반대 · 비교 방향 반전 · 주소 `true` · 4번째 칸 label · 시트 별 뒤집음 · 별 순서 | **7/7 포착** | B1 · L1 · F1 · U1 · T24 · … |
| 새 변이(developer 표와 겹치지 않음) N1~N10, N14, N15, N20 | N1 끔 응답 `focusCheck=false` · N2 초점 확인을 요청 뒤에 · N3 확인 소비 안 함 · N4 쪽 도착 `scroll:false` · N5 오류 토스트 제거 · N6 다른 단어 시트까지 닫음 · N7 정리가 자기 것 확인 없이 slot 비움 · N8 slot 에 안 둠 · N9 404 전체 다시 읽기 안 함 · N10 id 인코딩 제거 · N14 시트 저장 stamp 원천 상수 · N15 다음 그림 안 기다리고 바로 판정 · N20 화면 `focusHead` 가 `scroll` 무시 | **13/13 포착** | W1 · W2 · W6 · B7 · B5 · C9 · wordsPaging REV-068C-4(N20) |
| developer 가 밝힌 「생존」 R1~R7 | 화면이 헬퍼에 넘기는 `focusCheck`·`setListReadAt`·`setSheet`·`inFavoriteView`·`useMemo(wordsStarHandler)`·`showToast`·`request` 를 빈 함수/상수로 | **7/7 생존**(주장과 일치) | - |
| 새 변이 생존 9개 | N11a 훅 `stamp` 늘 0 · N11b 훅 `view` 의존성 `[]` · **N11c 훅 `press` 가 보인 값을 뒤집음** · N12 시트 GET stamp 응답 뒤로 · N13 시트 GET `setReadAt` 제거 · N16 `nextFrame` 즉시 실행(다음 그림 안 기다림) · N17 `activeElement` 늘 null(늘 머리 줄로 초점 이동) · N18 효과 `reloadAll` 빈 함수 · N19 효과 `focusCheck` 가 다른 ref 객체 | **9/9 생존** | - |
- 합계 57회: 포착 41 · 생존 16(R 7 + 새 9). 위험도 평가: 생존 16개는 전부 **이름이 같은 값을 그대로 넘기는 한 줄**이라 타입이 「빠뜨림」은 막지만 「빈 함수·상수·뒤집힘」은 못 막는다. 사용자 영향이 큰 순서 = ① 훅 `press` 뒤집힘(N11c)/행 `onStar`(R5): 켜기와 끄기가 반대로 나감 — 가장 눈에 띄는 오류라 QA 네트워크 탭에서 첫 클릭에 드러남 ② `nextFrame`/`activeElement`/`focusCheck` 계열(R1·N16·N17·N19): 즐겨찾기 칸에서 키보드로 끈 뒤 초점이 사라지거나 엉뚱히 이동 — 키보드 사용자만 영향 ③ `setSheet`/`reloadAll`/토스트(R3·R6·N18): 404 때 시트가 안 닫히거나 목록이 안 갱신 — 드문 경로 ④ `stamp`/`readAt`(R2·N11a·N12·N13): 낙관 값이 서버 응답에 덮이거나 반대 — 빠른 연타·느린 망에서만 ⑤ `view` 의존성(N11b): 별이 눌려도 화면이 안 바뀜 — 첫 클릭에 드러남. **이것이 QA 실제 Chrome 항목으로 충분한가**: 이전 감사 high_risk 2~6 이 ①②③④⑤ 대부분을 이미 덮는다. 빠진 것은 **시트 GET 응답 전에 별 누르기**(N12·N13)뿐이라 아래에 추가한다. 따라서 Medium 으로 올리지 않는다.

### 시험의 질 (4번)
- `favoriteWiring.test.ts` 16개는 **소스 스캔이 아니라 동작 시험**: 진짜 컨트롤러·진짜 `sendFavorite`/`apiPost`(가짜 전역 `fetch`)·진짜 시트 처리기(저장·보관·보관 풀기·실패·삭제 확인 모드)·진짜 `WordsEmpty`/`WordsPageList` 를 실행한다. 한계는 L-2.
- **누출 없음**: 대체한 전역(`globalThis.fetch`·`React.useState`·`React.useSyncExternalStore`)은 전부 `try/finally` 로 복원되고, 이 프로젝트의 시험은 `node --import tsx --test` 로 **파일마다 별도 프로세스**(Node 20.20.2 — 파일 격리 기본)라 다른 시험으로 샐 수 없다. 같은 파일 안에서도 시험이 순차라 끼어들기 없음. 5회 반복 16/16 — 변동 없음.
- `wordsPaging.test.ts` 정규식 1 → 3 갱신은 **약화가 아님**: 옛 단언(`if (out.focusHead) setFocusReq(… scroll:true …)`)의 데이터 흐름을 세 토막으로 같은 강도로 고정(화면이 `focusHead: out.focusHead` 를 꼬리에 넘김 + 화면 `scroll` 매핑 + 꼬리 `if (a.focusHead) d.focusHead(true)`) — 실제로 N20(화면이 `scroll` 무시)을 잡았고 꼬리 쪽은 W6(N4)이 동작으로 잡는다. 강도는 같거나 더 높다.

### 증빙 대조 (별도 미러 `rev074u2`, 저장소 `src`·`tests`·`prisma`·`package.json` `diff -rq` 동일, `prisma generate` 0)
| 항목 | developer | 내 재실행 |
|---|---|---|
| `tsc --noEmit --incremental false` | 0 | **0** (첫 실행의 exit 2 는 내 임시 스냅샷 스크립트 `tmp_u2/snap2.tsx` 1건 — 제품 오류 아님, 미러에서 치우고 재실행해 0) |
| `eslint src/components` | 오류 0 · 경고 5 | **오류 0 · 경고 5**(기존 `settings/*`·`admin/trace/*` 같은 파일) |
| 화면 시험 `vocab`+`common`+`drawer` | 551 | **551/551** |
| 전체 시험(가짜 `DATABASE_URL`, 동시성 1) | 4,333 중 통과 4,330 · 건너뜀 3 | **4,333 중 통과 4,330 · 실패 0 · 건너뜀 3** |
| 건너뜀 3(문서 필요) | `KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO` 로 25/25 | 같은 두 값으로 `task074FavoriteRoutes`·`task068Words`+`THEKAIWA_REPO` 시험 파일 묶음 **28/28 · 건너뜀 0** |
| `next build` | exit 0 | **exit 0**(경고 3 = 기존 파일 추적 경고) |
- 바꾼 4개 제품 파일에서 엔진명·`model_id`·`speaker_id`·`window.Capacitor`·`localStorage`·직접 `fetch(`·`spawn` grep **0건**. 6층 경계 위반 없음(전부 `components` 층 안, 순환 import 없음).
- **데모 게이트**: `check.mjs check --task task-074-improve-word-favorites.md` → `DEMO_GATE_PASSED`(approved v2, hash verified). `evidence.jsonl` 의 task-074 줄은 `approve` v2 한 줄(10:09:48)이고 파일 마지막 수정이 10:09:48 로 리팩터(11:31~)보다 앞 → 에이전트의 approve/waive 흔적 없음. 이번 변경은 렌더 990종이 바이트 동일이라 승인 데모 대비 차이 분류 = material 0 · implementation 0 · defect 0.
- **독립성·무결성**: 저장소 원본 수정 0, `ui2`·`ui3`·`rev074u`·`rev074u-mut` 쓰기 0(11:56 이후 변경 파일 0), 변이 57회 복원 `-mut` `src` == 저장소 `src`, DB 접촉·서버 기동·커밋·푸시·배포 0. 저장소 밖 산출: `scratchpad/rev074u2/{snap2.tsx,mut2.py,mut2.log,ev.sh,full.log}`.

### QA 가 특히 볼 것 (REV-074U 목록에 **추가·강조**)
1. **(추가·필수) 시트 GET 응답 전 별 누르기** — 단어 상세 시트를 열자마자(DevTools 느린 망 throttle) 응답이 오기 전에 머리 별을 누른 뒤 응답이 도착해도 별 값이 **되돌아가지 않음**, 시트를 닫은 뒤 목록 행도 같은 값(N12·N13·R2·N11a).
2. **(강조) 방향** — 행·시트·(교정 모음 상세) 모두 첫 클릭의 실제 요청이 켜기 `POST …/favorite`·끄기 `POST …/unfavorite` 이고 화면이 즉시 바뀜(N11b·N11c·R5; 훅 한 줄이라 시험이 못 잡음).
3. **(강조) 즐겨찾기 칸에서 끄기(키보드·마우스 모두)** — 코드 규칙은 「다시 읽은 응답을 깐 다음 그림 뒤 초점이 body·없음이면 머리 줄로, 화면은 끌어올리지 않음(scroll:false), 초점이 다른 곳에 남아 있으면 건드리지 않음」이다. 키보드로 끈 뒤 초점이 머리 줄에 가는지, 다른 요소에 초점이 남은 경우 안 뺏기는지(R1·N16·N17·N19), 페이징 도착은 머리 줄로 끌어올려지는지(scroll:true)를 실제로 본다. (마우스로 끌 때의 초점은 브라우저마다 달라 QA 가 실측)
4. **(강조) 404** — 열린 시트가 닫히고 토스트 **정확히 1번** + 전체 다시 읽기(R3·R6·N18); 끄기 성공은 토스트 1번 + 같은 쪽 다시 읽기(R6·R7).
5. 이전 high_risk 1(2계정 격리)·3(연타·throttle)·4(500·오프라인)·7~12(자리·글꼴·다크·키보드·교정 모음·StrictMode)는 그대로.
