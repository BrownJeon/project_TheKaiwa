# REV-080-R2U — 수정 라운드 화면 분 좁은 재감사 (reviewer, Read 전용)

> 중간 기록 시작 (턴 3). 체크포인트가 아래에 쌓인다. 최종 판정은 맨 아래 «최종 판정».

## 체크포인트
- [CP0] 시작 — 사양·변경 파일 목록 확인. 미러 `~/.node-local/thekaiwa-rev080r2` 재사용 예정.
- [CP1, 턴 6] 로더 분리 읽음. 코드(`growthLoader.ts` 146줄·`useGrowthData.ts` 33줄) 정독: 캐시는 인스턴스(`useState` 초기화) — 모듈 전역 없음, 요청은 `apiGet` 경유(직접 fetch 0), 언마운트 뒤 응답·타이머 무시, 구독 해제 OK, 레이스(4→8→12 늦은 응답) 안전. 기간 분절은 오류 카드·자리표시(`inert`)에서 눌릴 수 없어 `retry` 와 `setWeeks` 교차는 UI 에서 도달 불가. 발견(아래 이슈에 이어서): L-A `compute()` 의 `this.retry ? 'loading'` 가 기간 비교 없음(도달 불가 잠재).
- [CP2, 턴 9] 줄 모양·새 글 읽음. `rowShapeOf`(growthLogic.ts:307-313) = 36-4 순서 그대로(none → !enough → oneSided → stage → wait). `ResultRows` 한쪽 증거 줄: 진행선·막대·숫자·링크·숨김 단계 글 없음, 본문+안내 한 `<p>`. `oneSided` undefined(옛 응답)면 falsy 로 단계/표본 부족 분기로 안전. growthCopy `axisOneSided`·`axisOneSidedSub` 3개가 36-5/36-17-3 ① 글자와 일치, «세요»(L4 정당 사용 주석 제외)·엔진명·급수 0. `fewNoteOf` 는 `rowShapeOf==='stage'` 로 센다(서버 계약 `stage!==null ⇔ enough&&!oneSided` 와 같은 값).
- [CP3, 턴 14] 변이 재현(미러 `~/.node-local/thekaiwa-rev080r2`, 임시 파일 + `os.replace`, 매번 NFS 와 동일 복원 assert): 기준 plan+challenge 165/165. M1 줄 모양 순서 뒤집기 · M2 `fewNoteOf` 를 `enough` 로 · M3 «오늘» 7→6px · M4 재시도 500ms 유예 제거 — 4/4 포착(개발자 변이 V1·V2·V4·V7 재현 일치).
- [CP4, 턴 18] 변이 M5(한쪽 증거 줄을 `Waiting` 로 보냄) · M6(`syncWeekPick` 이 j 유지) · M7(V3b 렌더 중 되쓰기 삭제) · M8(로더 캐시를 전역으로) — 4/4 포착(M7 은 `growthScreen.test.ts:169` 소스 문자열 단언이 잡음 — 알려진 약점 V3b 재현). 합계 8/8, 복원 후 NFS 와 동일(스크립트가 매번 assert). 기준선 165/165, tsc 0, eslint 0(변경 파일 `src/components/plan` + `copyNoSeyo.test.ts`). 렌더 점검(미러 정적 렌더, 스크래치 `rev-080-r2u/render.mts`): enough+oneSided → `data-state=oneSided`·본문 한 문단·진행선/링크 없음; `!enough+oneSided` → 표본 부족(진행선 15%); `oneSided` undefined(옛 서버) → 거짓 취급·단계/표본 부족 분기, 오류 없음.
- [CP5, 턴 26] 로더 추가 변이 6건(M9 stop 뒤 응답 반영 · M10 setWeeks 오류 잊기 제거 · M11 중복 요청 방지 제거 · M12 구독 해제 무력화 · M14 getView 매번 새 객체 · M15 stop 이 타이머 안 지움): 5/6 포착, **M12(구독 해제가 리스너를 안 지움)는 시험이 못 잡음** → Low(시험 틈, 실해는 없음: 언마운트 뒤 `emit` 이 `active` 로 막히고 로더는 컴포넌트와 함께 사라짐). 누적 변이 14건 중 13 포착.

## 최종 판정 (턴 30) — REV-080-R2U: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 2 · Info 5)

범위: 화면 수정 라운드(L11·L12·L13 + 감사 M1·L1·L2·L3 + 정정 ⑮⑯). 코드 수정·커밋·서버 기동·LLM 호출 없음. 디자인 판단 안 함. 6층·금기: 화면 파일의 `@/modules` import 는 `infra/dates` 두 곳뿐(기존 패턴), 직접 `fetch`·`localStorage`·`window.Capacitor` 0, 새 16진 색 0, 엔진명·급수 0.

### 재실행 증빙 (미러 `~/.node-local/thekaiwa-rev080r2`, `scripts/mirror-audit.sh --check` exposed 0)
- `node --import tsx --test plan/__tests__/*.test.ts challenge/__tests__/*.test.ts` → **165/165** · `tsc --noEmit` **0** · `eslint src/components/plan + copyNoSeyo.test.ts` **0**.
- 변이 14건(임시 파일 + `os.replace`, 매번 NFS 와 동일 복원 assert, 끝에 `cmp` 5파일 same·`*.mut.tmp` 0): M1 줄 모양 순서 뒤집기 · M2 `fewNoteOf`→`enough` · M3 «오늘» 7→6px · M4 재시도 유예 제거 · M5 한쪽 증거→`Waiting`(진행선·링크 부활) · M6 `syncWeekPick` j 유지 · M7 V3b 렌더 중 되쓰기 삭제 · M8 캐시 전역화 · M9 stop 뒤 응답 반영 · M10 setWeeks 오류 잊기 제거 · M11 중복 요청 방지 제거 · M14 getView 매번 새 객체 · M15 stop 이 타이머 안 지움 — **13/14 포착**, 미포착 1건 = M12(아래 L-2). 스크래치 `rev-080-r2u/mut.py`·`render.mts`.

### 영역별 결과
1. **데이터 로더 분리 — 동작 보존 OK.** 캐시는 인스턴스(`useState` 초기화)라 사용자·방문 간 누출 없음(M8 이 7건 실패로 증명). 요청은 `apiGet` 경유(기존 `usePlanData`/`useKeyedResource` 와 같은 래퍼, 직접 fetch 0). 재시도 500ms 유예(`retryFailHoldMs`)·기간별 캐시·오류 잊기·언마운트 뒤 무변화·StrictMode 재마운트(요청 중복 방지)·`getView` 안정(useSyncExternalStore 규칙) 모두 시험이 실제 결함을 잡는다(M4·M8~M11·M14·M15 포착). 4→8→12 늦은 응답은 보이는 기간을 덮지 않음(시험 3번). 기간 분절은 오류 카드(분절 없음)·자리표시(`inert`)에서 눌릴 수 없어 재시도와 기간 전환이 UI 에서 엇갈리지 않는다. 기간 상태 이동(`GrowthScreen`→로더)은 분절 `value`·`aria-checked`·`aria-busy`·재시도 뒤 초점(`periodRef` 라디오 / `errRef` h2)을 그대로 유지(코드 정독 + 개발자 헤드리스 실측 기록).
2. **한쪽 증거 행·줄 모양 — 사양 일치.** `rowShapeOf`(growthLogic.ts:307-313) = 36-4 순서. 정적 렌더 4케이스 확인: `enough+oneSided` → `data-state=oneSided`, 본문+안내 한 `<p>`, 진행선·막대·숫자·링크·숨김 단계 글 0 · `!enough+oneSided` → 표본 부족(진행선 15%, 모순 문장 없음) · `oneSided` undefined(옛 서버) → 거짓 취급, 오류 없음 · `oneSided+stage 비null`(서버 어긋남) → 한쪽 증거(가림 우선). 새 글(`axisOneSided`·`axisOneSidedSub` 3개)은 36-5/36-17-3 ① 와 글자 일치, 셈 뜻 «세요»·급수·엔진명·숫자 0(시험이 사양 문자열로 단언), 안내 없는 두 축은 빈 값 → 줄 안 그림.
3. **안내 이동(L12) OK.** `fewNote` 는 `ResultRows` 소개 줄 아래·첫 축 줄 위(DOM 순서 = 낭독 순서), `GrowthSummaryTiles` 에서 제거, 자리표시는 예약 안 함(`growthSkeletonSizes.ts` 주석만 정정, 상수 그대로 330/347/88/36).
4. **달력·기간(L13·L1) OK.** «오늘» `before:-inset-y-[7px]` = 패딩 상자 30 + 14 = 눌림 44(CalendarSection.tsx:56), `::before` 는 배경 없음 → 보이는 h-8 알약 불변, 소비처는 `PlanScreen`·`PlanSkeleton` 의 같은 `MonthNav` 뿐, 줄 높이 44(‹ › 가 44)라 잘림 없음. 기간 바뀌면 이번 주 복귀(렌더 중 `syncWeekPick` 되쓰기, 4→8→4 포함)·지표 칩 유지(`WeeklyBars` 에 `key` 없음)·끝 칸 `aria-disabled`+클릭 방어(`WeekNav`)·굵은 값 `whitespace-nowrap` 확인.
5. **시험 질.** 위 변이 표. `copyNoSeyo` 정규식(`만|을|를` 추가)은 양/음 사례 시험이 있고 기존 5파일에 새 위반 0 — 과탐 위험은 «…을 세요» 가 실제로 쓰일 때뿐이라 낮다.
6. 6층·금기·정적 검사 OK(위).

### 이슈
- **Low L-1** `growthLoader.ts:134` `compute()` 가 `this.retry ? 'loading'` 만 보고 `retry.weeks === this.weeks` 를 비교하지 않는다. 재시도 중 다른 기간으로 `setWeeks` 하면 그 기간이 캐시에 있어도 'loading'. 지금 UI 에서는 재시도 중 화면이 자리표시(`inert` 분절)라 **도달 불가** — 컨트롤러 단독 계약상의 잠재 결함. 권고: `this.retry?.weeks === this.weeks` 로 좁히고 시험 한 건 추가(후속, 이번 배포 차단 아님).
- **Low L-2** `growthLoader.ts:54-59` 구독 해제가 리스너를 지우는지 시험이 없다(M12 미포착). 실해는 없음(언마운트 뒤 `emit` 은 `active` 로 막히고 로더는 컴포넌트와 함께 사라짐). 권고: `subscribe` 반환 함수를 부른 뒤 `notified` 가 늘지 않는 단언 1줄.
- **Info I-1** V3b(고른 주 되쓰기 삭제)는 `growthScreen.test.ts:169-175` 의 소스 문자열 단언만 잡는다(M7 재현). 순수 부분(`syncWeekPick`·`selectedWeekOf`·`stepWeek`)은 행동 시험(M6 포착)이라 놓칠 위험은 «React 배선(렌더 중 되쓰기)이 바뀌되 문자열은 같은 경우» 한 가지뿐이고, 되쓰기를 `useEffect` 로 옮기는 정상 리팩터링은 오히려 거짓 경보를 낸다 → **실결함을 놓칠 위험은 낮다**. QA 가 실제 브라우저로 4→8→4 왕복 1회만 확인하면 닫힌다.
- **Info I-2** `fewNoteOf` 는 사양 문자 그대로의 `stage !== null` 대신 `rowShapeOf(s)==='stage'` 로 센다(개발자 기록에 명시). 서버 계약 안에서는 같은 값이고, 서버가 어긋나도 «안내가 가리키는 줄 = 실제로 단계가 그려진 줄» 이 되는 쪽이라 방어적으로 낫다. 사양 문장(36-4 ②a)과 글자는 다르므로 Leader 가 알고 있으면 충분.
- **Info I-3** 비동기 읽기 관용구가 plan 폴더에 둘이다(`useKeyedResource` 의 seq 방식 vs `GrowthLoader`). 기간별 캐시·busy 의미 때문에 재사용이 어려웠다는 점은 이해되나, 같은 `apiGet` 위에서 갈라진 설계라 후속 정리 후보(이번 범위 밖).
- **Info I-4** 캐시가 컴포넌트 인스턴스 수명이라 안전하지만, 나중에 `cacheComponents`(Activity 로 상태 보존)를 켜면 성장 탭을 떠났다 돌아올 때 오래된 캐시가 남는다. 현재 `next.config.ts` 에는 없음(Next 16.3.2) — 켤 때 점검 항목.
- **Info I-5** `copyNoSeyo` 의 대상은 `growthCopy.ts` 한 파일이다. 성장 화면 TSX(`ResultRows`·`GrowthSkeleton` 등)에 직접 박힌 글은 이 시험이 보지 않는다(`growthCopy.test.ts`·화면 시험이 일부 보완). 현재 직접 박힌 사용자 글 없음.

### 데모 게이트·혼입
화면 수정이며 승인 데모 v4 대비 차이는 designer 보강(36-17-3)이 분류한 L12(안내 위치)·L11(새 글) 뿐 — 둘 다 사용자 응답으로 승인된 사항이라 material 재승인 요청 없음(implementation 허용). `.claude/state/demo-gate/` 직접 쓰기 흔적은 이번 범위에서 보지 않음(좁은 재감사).

### QA 가 볼 곳 (high_risk_areas)
1. 실제 브라우저로 성장 탭 4→8→4 왕복 1회: 주마다 공부량이 둘 다 «이번 주»로 돌아오고 지표 칩이 유지되는지(I-1).
2. 오프라인 → [다시 불러오기] 반복: 자리표시 ≥500ms, 성공 뒤 초점 = 고른 기간 라디오, 또 실패 시 초점 = 오류 제목.
3. 백필 뒤 한쪽 증거가 되는 축이 있는 계정(문형·조사): 진행선·숫자·링크 없이 두 문장만, TalkBack 에서 이름 → «아직 판단하기 일러요» → 설명 → 두 문장 한 문단.
4. 적음 계정: 안내가 «공부결과» 소개 줄 아래, 체크내역·주마다 공부량이 로딩 뒤 밀리지 않음(390/412), 360 은 기존 한계.
5. 달력 «오늘» 단추 위·아래 가장자리 탭(44px), 글꼴 130% 360px 에서 읽기 줄 굵은 값(특히 «교정 채택 N개») 가로 넘침 없음.
