---
tags:
  - type/record
  - domain/plan
aliases:
  - task-080 dev-fix-ui
---
# task-080 화면 수정 라운드 — developer 기록 (dev-080-fix-ui)

상위: [[task-080-plan-growth-analysis]] · 사양 screens.md §36-17-2·36-17-3 · 감사 [[task-080-reviewer-ui-record]] · 점검 [[task-080-designer-check-record]] · 서버 [[task-080-dev-fix-server-record]]

## Developer 기록
- [체크포인트 1] 완료: growthCopy `axisOneSided`·`axisOneSidedSub`(36-5 글자 그대로) · growthLogic `rowShapeOf`(36-4 줄 모양 순서)·`fewNoteOf` 기준 `rowShapeOf==='stage'`·고른 주 순수 함수(`weekKeyOf`·`syncWeekPick`·`selectedWeekOf`·`stepWeek`) · ResultRows(`fewNote` prop·`data-state`·`OneSided`) · GrowthSummaryTiles 안내 제거 · GrowthScreen(`fewNoteOf` 전달, 기간은 훅이 소유) · WeeklyBars(렌더 중 고른 주 비우기·`WeekNav` 분리·값 `whitespace-nowrap`) · 새 `growthLoader.ts`(상태 기계 컨트롤러)·`useGrowthData`(useSyncExternalStore) · CalendarSection «오늘» `-inset-y-[7px]` · growthSkeletonSizes 주석 · fixtures `oneSided:false`+`oneSidedFixture`.
  남은 일: 시험(loader·rowShape·weekPick·WeekNav·MonthNav·한쪽 증거 렌더·안내 위치) · copyNoSeyo 보강 · tsc/eslint · 시각 검증 · 변이.
  주의점: 기간 상태를 GrowthScreen `useState` 에서 훅(컨트롤러)으로 옮김 — 렌더 중 외부 스토어를 바꾸지 않으려고(바꾸는 순간 같은 렌더에 busy·오류 잊기 반영).
  미커밋: 위 파일 전부(NFS).
- [체크포인트 2] 완료: 시험 — 새 `growthLoader.test.ts`(8: 첫 로딩·기간별 캐시·늦은 응답·오류 잊기·재시도 500ms·stop 뒤 무변화/StrictMode·컨트롤러 간 누출 없음·getView 안정) · growthLogic(줄 모양 순서·안내 센 기준·고른 주 왕복·‹ › 한 칸) · growthScreen(안내 위치 L12·`data-state`·한쪽 증거 정적 렌더·`WeekNav` 끝 칸 클릭 방어·읽기 줄 nowrap·«오늘» 눌림 높이 계산 ≥44) · growthCopy(L11 글자·금지 낱말) · copyNoSeyo(`만|을|를` + 양/음 사례). 미러 실행: plan 7파일 + copyNoSeyo **90/90 통과**, `tsc --noEmit` 전체 **0 오류**(fixtures:76 해소), eslint(plan·app/plan·copyNoSeyo) **0**.
  남은 일: 시각 검증(미러 build + 3021) · 변이 ≥5.
  미커밋: + `__tests__/growthLoader.test.ts`(새), `challenge/__tests__/copyNoSeyo.test.ts`.
- [체크포인트 3 — 시각 검증] 미러 `next build`(APP_ENV=LOCAL) 종료 0 → `next start -H 127.0.0.1 -p 3021`(PID 파일, 이번엔 부모가 곧 `next-server` 단일 PID) → 끝나고 PID 로 종료·cwd 확인·3021 빈 것 확인. 하네스 `scratchpad/dev-080-fix-ui/screens.ts`(성장·달력 GET 은 fixture, 쓰기 요청은 403 차단, QA 계정 id 만 읽어 메모리 토큰). 결과는 아래 «시각 검증 표». 하네스 함정: Playwright 는 `aria-disabled="true"` 단추를 «비활성»으로 보고 `click()` 이 30초 기다린다 → 끝 칸 누르기는 `force: true`. 전역 `div[role=alert]`(앱 셸) 가 있어 오류 카드 선택자는 `p[role="alert"]`.
  남은 일: 변이 ≥5 · 기록 마무리.
- [08:01] **완료 — 화면 수정 라운드(L11·L12·L13 + 감사 M1·L1·L2·L3 + 정정 ⑮⑯), LLM 호출 0, 커밋·푸시·배포·DB 쓰기 없음.**

### 변경 파일 (16, 전부 미커밋 · NFS)
| 파일 | 내용 |
|---|---|
| `src/components/plan/growthCopy.ts` | `axisOneSided`·`axisOneSidedSub`(축 5키 `satisfies Record<GrowthAxis,string>`, 듣고 응답·대화 유지 = 빈 값) — 36-5 글자 그대로. 머리 주석에 L11 새 글 표시 |
| `growthLogic.ts` | `RowShape`·`rowShapeOf`(36-4 순서: none → wait(`!enough`) → oneSided → stage → wait) · `fewNoteOf` 가 `rowShapeOf(s)==='stage'` 로 셈 · 고른 주 `WeekPick`·`weekKeyOf`·`syncWeekPick`·`selectedWeekOf`(음수·범위 밖 → 이번 주)·`stepWeek`(끝 칸 null) |
| `ResultRows.tsx` | `fewNote` prop(소개 줄 아래·첫 축 줄 위, `mb-2`, `data-few-note`) · `li[data-state]` · `OneSided`(본문+안내 한 문단, 진행선·막대·숫자·링크·숨김 단계 글 없음) · 분기는 `rowShapeOf` 하나 |
| `GrowthSummaryTiles.tsx` | 안내·`fewNoteOf`·`skills` 제거(숫자 카드 3만) |
| `GrowthScreen.tsx` | `fewNoteOf(data)` 계산·전달 · 기간 상태를 훅이 소유(`g.weeks`·`g.setWeeks`) |
| `growthLoader.ts` (새) | 상태 기계 컨트롤러(React 없음, 요청·시계·타이머 주입) — 캐시·shown·failed·retry·inflight·active |
| `useGrowthData.ts` | 컨트롤러 1개 + `useSyncExternalStore` + mount `start`/unmount `stop` |
| `WeeklyBars.tsx` | 렌더 중 `syncWeekPick` 되쓰기(기간 바뀌면 이번 주, 지표 칩 유지, `key` 안 씀) · `WeekNav` 분리(끝 칸 `aria-disabled`+`onPick` 안 부름) · 값 조각 `font-[650] whitespace-nowrap` |
| `CalendarSection.tsx` | «오늘» `before:-inset-y-1.5` → `before:-inset-y-[7px]` 한 토막 |
| `growthSkeletonSizes.ts` | 주석만(옛 «적음은 체크내역 67px 내려감» 정정), 상수 그대로 |
| `__tests__/growthFixtures.ts` | `skill()` 기본 `oneSided:false`(tsc 오류 해소) · `oneSidedFixture`(문형·조사 n=119·3일·`enough&&oneSided`, 어휘 회상 단계) |
| `__tests__/growthLoader.test.ts` (새) | M1 8건 |
| `__tests__/growthLogic.test.ts` · `growthScreen.test.ts` · `growthCopy.test.ts` | 줄 모양·안내 기준·고른 주 왕복·‹ ›·안내 위치·한쪽 증거 렌더·`WeekNav` 클릭·nowrap·«오늘» 눌림 높이(렌더 마크업 클래스로 30+2·inset 계산)·배선 가드·L11 글 |
| `src/components/challenge/__tests__/copyNoSeyo.test.ts` | 정규식에 `만|을|를` + 잡음/안 잡음 사례 시험. 기존 5파일 새 위반 0 |

### 실행 증빙 (미러 `~/.node-local/thekaiwa-dev080u`)
- `node --import tsx --test src/components/plan/__tests__/*.test.ts src/components/challenge/__tests__/*.test.ts` → **165/165 통과**
- `tsc --noEmit`(전체) → **0 오류** · eslint `src/components/plan` + copyNoSeyo → **0**

### 변이 (임시 파일 + `os.replace` 후 원복, 끝에 NFS 와 `cmp` 6파일 OK) — **16/16 포착**
V1 줄 모양 순서 뒤집기 · V2 `fewNoteOf` 를 `enough` 로 · V3a `syncWeekPick` 이 j 유지(왕복 복원) · V3b 렌더 중 되쓰기 삭제(배선 — **소스 가드 시험으로만 잡힘**) · V4 «오늘» 7→6px · V5a 한쪽 증거 분기 제거 · V5b `rowShapeOf` 판정 제거 · V6 안내 안 그림 · V7 재시도 500ms 유예 제거 · V8 기간 바꿔도 오류 유지 · V9 stop 뒤 응답 반영 · V10 ‹ 클릭 방어 제거 · V11 nowrap 제거 · V12 음수 방어 제거 · V13 안내에 «역할극» · V14 기록 전 판정 제거. 스크립트 `scratchpad/dev-080-fix-ui/mutate.py`.

### 시각 검증 표 (`next build` + `127.0.0.1:3021`, APP_ENV=LOCAL, GET fixture·쓰기 403 차단)
| 항목 | 조합 | 결과 |
|---|---|---|
| 성장 상태 few@4·oneSided@4·oneSided@12·normal@4·rich@12·empty@4 | ×360/390/412 ×100·px130 ×라이트·다크 = 72 | **72/72** — 가로 넘침 0 · 44px 미만 누를 것 0 · 11px 미만 글 0 · 콘솔 오류 0 · `role=status` 1 · 엔진명 0 · 쓰기 요청 0. few·oneSided 는 안내가 «공부결과» 카드 안. oneSided 문형·조사 = `data-state=oneSided`·진행선/막대/링크 0·두 문장 글자 일치·숫자 0·오른쪽 «아직 판단하기 일러요» 잘림 0 |
| 안내 이동 뒤 밀림(자리표시 → 정상, 응답 1.5초 지연, few) | 390 / 412 | 체크내역 Δ0 · 주마다 공부량 Δ−1(안내 높이 79 / 59) — **안 밀림** |
| 〃 | 360 | 체크내역 Δ+17 · 주마다 공부량 Δ+38 — 안내(79)와 무관, 기존 한계(360 숫자 칸 105·체크내역 352 > 중앙값 상수 88·330, 상수 주석에 이미 적힘) |
| «오늘» 단추 | 360/390/412 ×100·px130 | 보이는 높이 32 그대로 · 눌림 **44px** · 중심 ±21 잡힘·±23 안 잡힘 (6/6) |
| 기간 왕복(390, rich) | 4주 «지난 주» → 8 → 4, 다시 ‹‹ → 8 → 12 → 4 | 둘 다 «이번 주» · 지표 칩(단어) 유지 · 이번 주 › / 첫 주 ‹ = `aria-disabled` 이고 눌러도 그대로 |
| 재시도(390, 늘 500) | [다시 불러오기] | 자리표시 → 오류 825ms(≥500) · 초점 = 오류 `h2` · 요청 2회 |
| 정리 | — | 서버 PID 로 종료(cwd·cmdline 확인), 3021 빈 것 확인, 미러 cwd 의 next 프로세스 0 |
캡처: `scratchpad/dev-080-fix-ui/shots/`(390 라이트·다크, 360 px130 다크, `rows-oneSided-*`).

### 사양과 어긋난 곳 · 판단
- `fewNoteOf` 는 `stage !== null` 대신 **`rowShapeOf(s)==='stage'`**(= `recorded && enough && !oneSided && stage!==null`)로 센다. 서버 계약(`stage!==null ⇔ enough && !oneSided`)에서는 같은 값이고, 서버가 어긋나도 «안내가 가리키는 줄 = 실제로 단계가 그려진 줄» 이 되게 했다.
- 기간 상태를 `GrowthScreen` `useState` → 훅(컨트롤러)으로 옮김(사양 밖 구조 변경, 화면 동작 같음). 까닭: 컨트롤러를 렌더 중에 바꾸지 않으면서 기간을 바꾼 그 렌더에 `busy`·오류 잊기를 반영하려고.
- 재시도 중 표시는 요청 클로저 대신 `retry{weeks,from}` 상태로 든다 — 같은 기간 요청이 이미 날아가는 중에 재시도해도 그 응답이 자리표시를 풀어 준다(옛 훅은 이 경로에서 영영 loading 이 될 수 있었음, 도달 불가로 보였던 길).

### 한계
- 상태 전환의 React 배선(렌더 중 되쓰기·`useSyncExternalStore` 연결)은 DOM 도구가 없어 단위 시험이 아니라 **소스 가드 + 헤드리스 왕복·재시도 실측**으로 묶었다.
- 360px 자리표시 → 정상 전환에서 체크내역 +17·주마다 공부량 +38 은 이번 라운드 전부터 있던 중앙값 상수 한계(안내와 무관).
- 하네스의 px130 은 글꼴 130% 모형(§35-9), 실기기 글꼴 배율 아님.

### reviewer 가 볼 곳
1. `growthLoader.ts` — `stop()` 에서 유예 타이머를 지우면 `retry=null`(재마운트 뒤 다시 요청), `emit()` 은 `active` 일 때만 알림, `getView` 같은 객체 규칙. 옛 훅과 같은 동작인지(시험 8건).
2. `WeeklyBars.tsx` 렌더 중 `setPicked` 패턴(옛 `useGrowthData` 의 `prevWeeks` 와 같은 방식) · `WeekNav` 분리 뒤 DOM 순서 ‹ → 읽기 줄 → › 그대로.
3. `ResultRows` 한쪽 증거 줄 클래스(36-11)·낭독 한 문단(36-12) · 안내 `mb-2`(옛 `mt-2` 없음).
4. `copyNoSeyo` 정규식 확대가 다른 문구 파일에 오탐을 만들지 않는지(지금 5파일 0건).

### 폰 확인 제안
① 성장 탭(적음 계정): 안내가 «공부결과» 카드 소개 줄 바로 아래에 보이고 체크내역·주마다 공부량이 로딩 뒤 밀리지 않는지 ② 백필 뒤 한쪽 증거가 되는 축(문형·조사 예상)이 «아직 판단하기 일러요 · 교정 기록이 대부분이라…» 줄로 나오고 숫자·진행선이 없는지 ③ 주마다 공부량에서 지난 주를 고른 뒤 8주 → 4주로 돌아오면 «이번 주» ④ 달력 «오늘» 단추 위·아래 가장자리를 눌러도 잘 눌리는지 ⑤ TalkBack: 한쪽 증거 줄이 이름 → «아직 판단하기 일러요» → 설명 → 본문·안내 순서로 읽히는지.
