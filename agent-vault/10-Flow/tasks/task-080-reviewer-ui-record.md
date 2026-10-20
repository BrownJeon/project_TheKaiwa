---
type: reviewer-record
task: task-080
tags:
  - type/record
  - domain/plan-growth
---
# task-080 화면 갈래 감사 (REV-080-U) — reviewer 기록

감사 대상: 성장 탭 화면 갈래(`src/app/(app)/plan/growth/*`·`src/components/plan/{PlanSwitch,GrowthScreen,…,useGrowthData,growthCopy,growthLogic,growthSkeletonSizes}`·`PlanScreen/PlanSkeleton/parts/logic/CalendarSection` 수정·시험). 사양 `docs/screens.md` §36, 승인 데모 v4. 미러 `~/.node-local/thekaiwa-rev080u`(`make-mirror.sh` 로 생성 — 감사 `exposed_*=0`), 스크래치 `rev-080-ui/`. 소스 수정 0.

## 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 1 · Low 4 · Info 5)

native_change=false(plugins·android·capacitor.config·Manifest 변경 0). 서버 갈래(`snapshots/growth.ts`·#78·백필)는 `rev-080-server` 몫이라 여기서 보지 않음.

## 직접 재실행한 것(개발자 보고를 믿지 않고)
| 항목 | 결과 |
|---|---|
| plan 시험 7파일 + `copyNoSeyo` | **72/72 통과** |
| `src/components`·`src/modules/infra`·`src/app` 시험 전체(회귀) | **2144 중 2143 통과·실패 0** |
| `tsc --noEmit` 전체 | 0 오류 |
| eslint(plan·app/plan·copyNoSeyo·dates·types/plan) | 0 |
| 달력 일요일 시작 독립 계산 — 2000-01~2100-12 모든 달 `monthGrid` 앞 빈칸·날짜 수 vs UTC 요일 | 불일치 0 · 시간대 UTC/Asia/Seoul/America/Los_Angeles 모두 동일 · `WEEK_HEADERS`=일월화수목금토 · 2026-09=2·2026-10=4(10/1 목) · `weekStartOf` 2025-12~2027-12 전수 일요일·0~6일 앞 |
| 계산 경계 직접 대입(growthLogic) | 칸 상태 7종·`late`(since==from 아님/+1)·적음 안내 0·1·2축·기록 1일째·`needCount`(19)/`needDays`(20건·2일, 25건·2일)/`needSession`(4번)·진행선 0.5/0.667/0.6/1·눈금 9값(5→1 · 6→2/6 · 11→5/15 · 26→10/30 · 51→20/60)·x 라벨 4/8/12주(`1111`·`01010101`·`001001001001`)·`barPick` 경계·평가 종류 유지/첫째·일요일 보조 글 — **전부 사양 36-6 D 와 일치** |
| 변이 10건(임시 파일 + `os.replace`, 끝에 NFS 와 `cmp` 일치 확인 OK) | 포착 6 · **생존 4**(아래 L2·L3·L1 근거) |
| 데모 게이트 `check` | `DEMO_GATE_PASSED`(approved v4, hash verified). 승인 줄 1개(prompt_ts 23:18:47 → approve 23:19:04), waive·`state/demo-gate` 직접 쓴 흔적 없음 |
| 문구 ↔ 데모 v4 | growthCopy 문자열 조각 132 중 데모에 없는 10 = 전부 사양이 정한 것(`docTitle`·L3 `needDays`·`countLine` 삼항·L4 두 곳·낭독 4조각·`loadingSr`). **L3·L4 반영 확인**: `metricNote.turns`·`how[0]` 이 «…계산해요.», `needDays`·«일부»·«넘김» 괄호 밖, 12주 둘째 줄 빼기(`showEvalNoneBody`) |
| 옛 이름·엔진명·JLPT | «날마다»·«능력 다섯 가지»·«대화 말 수»·엔진·모델 이름 0(plan 비시험 파일 grep). «단어 세트» 는 달력의 기존 기록 라벨(`logic.ts:118` — 성장 아님)뿐. 급수 «N4» 는 AI 평가 문장·표의 수준 칸에만, 공부결과 단계 이름·안내에 없음 |

변이 표(미러 `thekaiwa-rev080u` 에서 적용 → NFS 원본 복사로 원복, `cmp` 일치):
| # | 변이 | 결과 |
|---|---|---|
| R1 | `metricNote.turns` «…역할극만 세요.» 복귀 | 포착(growthCopy.test 1) |
| R1b | 같은 변이 — `copyNoSeyo.test.ts` 만 실행 | **생존** |
| R2 | 지난 주 끝 라벨 항상 `D일` | 포착(2) |
| R3 | `needDays` 분기 제거 | 포착(2) |
| R4 | 진행선 날짜 분기 제거 | 포착(1) |
| R5 | › `aria-disabled` 제거 | **생존** |
| R5b | ‹ 끝 칸 클릭 방어(`!atStart &&`) 제거 | **생존** |
| R6 | 체크내역 표 최근 주 위 → 오래된 주 위 | 포착(1) |
| R7 | `isLate` `>`→`>=` | 포착(1) |
| R8 | 기간 바꿔도 고른 주 유지(`picked` 비교 제거) | **생존** |

## 지적

### Critical / High — 발견 없음

### Medium
**M1. `useGrowthData` 상태 기계에 자동 시험이 없다 — 재시도 500ms 유예·기간별 캐시·오류 잊기가 실행으로만(개발자 시각 하네스) 확인됨**
- `src/components/plan/useGrowthData.ts:21-89`. 분기 10여 개(기간 바뀌면 오류 잊기·`busy`·`reload` 의 `retrying`+`retryFailHoldMs`·늦게 온 응답·언마운트 뒤 타이머 정리)인데 시험은 정적 렌더 + 소스 정규식 3줄(`GrowthScreen` 의 `replaceState`·초점 코드 모양)뿐이다. 이 미러엔 DOM 도구(jsdom 등)가 없어 나도 동적 재현은 못 했다.
- 읽기 검토 결과 **결함은 못 찾음**: 요청 중복은 `inflight` 로 막고(StrictMode 이중 effect 도 안전), 기간별 응답은 캐시 키라 늦게 온 응답이 다른 기간을 덮지 않으며, 캐시는 `useState` 라 사용자 간·화면 간 새지 않고, `apiGet` 은 `no-store`·same-origin·401 로그인 이동, 토큰·로그·저장소 사용 0. 재시도 중 `inflight` 에 걸려 `retrying` 이 영영 안 풀리는 길도 없음(오류 상태에선 요청이 비어 있음).
- 권고: QA 가 36-16 #6 을 실제 브라우저로 꼭 본다(처음 고른 기간 = 앞 내용 유지 + `aria-busy` · 오류 → [다시 불러오기] 자리표시 최소 500ms → 성공 시 고른 기간 라디오·실패 시 오류 제목으로 초점 · 기간 4→12→4 왕복). 가능하면 후속에 훅 시험(react-test-renderer 류) 추가.

### Low
**L1. 기간을 바꿨다 같은 기간으로 돌아오면 «고른 주» 가 복원된다 (사양 36-6 D «기간을 바꾸면 다시 이번 주» 와 다름)** [확실 — 코드 읽기, 동적 재현 안 함]
- `src/components/plan/WeeklyBars.tsx:27-32`. `picked` 는 `pick()` 에서만 바뀌고 `WeeklyBars` 는 기간을 바꿔도 같은 요소(키 없음, `GrowthScreen.tsx:96`)라 상태가 산다. 4주에서 «지난 주»를 고름 → 8주(다른 `n`·`first` 라 이번 주로 보임) → 다시 4주(캐시·`n`·`first` 같음) → `picked` 가 맞아 «지난 주» 가 다시 보인다. 변이 R8 로도 시험이 못 잡는다.
- 재현: 4주에서 ‹ 한 번 → [최근 8주] → [최근 4주] → 읽기 줄이 «이번 주» 가 아니라 지난 주.
- 권고: 기간이 바뀔 때(`n`·`first` 가 달라질 때) `picked` 를 비우거나(렌더 중 상태 맞추기), `WeeklyBars` 에 `key={shownWeeks}`.

**L2. ‹ › 끝 칸의 `aria-disabled`·클릭 방어를 고정하는 시험이 없다 (R5·R5b 생존)**
- `WeeklyBars.tsx:61-88`. 사양 36-12 «끝 칸은 `aria-disabled`(초점 받음, 눌러도 아무 일 없음)» — 지금 코드는 맞다. 그러나 방어(`!atStart && pick(sel-1)`)가 사라지면 `pick(-1)` → `sel=-1`(`picked.j < n` 만 검사) → `weeks[-1].weekStart` TypeError 로 **화면 전체가 렌더 오류**가 되는 지점이라, 속성 단언(정적 렌더로 가능)이라도 두는 편이 안전하다.
- 권고: `growthScreen.test.ts` 에 «이번 주일 때 다음 주 단추 `aria-disabled="true"`, 첫 주일 때 이전 주 단추» 단언 추가 + `sel` 계산에 `picked.j >= 0` 방어.

**L3. `copyNoSeyo.test.ts` 에 `plan/growthCopy.ts` 를 넣었지만 그 정규식으로는 실제 되살아날 문장을 못 잡는다 (R1b 생존)**
- `challenge/__tests__/copyNoSeyo.test.ts` 의 `COUNT_SEYO` 앞말 목록에 «만»·«을»·«를» 이 없어 승인 데모의 «…역할극만 세요.»·«…기록(관측)을 세요.» 는 통과한다. 실제 방어는 `plan/__tests__/growthCopy.test.ts` 의 자체 정규식(R1 포착)이고, 파일 안 주석도 그렇게 적고 있다 — 동작은 안전하지만 «copyNoSeyo 가 growthCopy 를 훑는다» 는 보고가 곧 보호라는 뜻은 아니다.
- 권고: 공용 정규식에 `만|을|를` 를 넣되 다른 파일 오탐을 확인하거나, 지금 주석을 유지하고 보호 주체가 growthCopy.test 임을 Leader 보고에 명시.

**L4. «주 시작 상수 하나» 원칙이 성장 체크내역에는 부분만 적용 — 요일 배열 복제·일요일 고정**
- `growthLogic.ts:14`·`CheckHistoryStrip.tsx:12`·`logic.ts:14` 에 `['일','월',…]` 가 3벌. 달력은 `WEEK_START_DOW` 로 머리를 돌리지만, 체크내역의 행 이름(`CheckHistoryStrip` `WD`)과 [주별로 보기] 표의 `WD[k]`(`stripRowsOf`)는 «주 시작 = 일요일» 을 박아 두었다. 상수를 바꾸면 달력만 따라가고 성장 탭 요일이 어긋난다. 사용자 결정이 일요일이라 지금 결함은 아님(사양 36-12 도 일~토 고정) — 유지보수 메모.

### Info
- **I1 (알려진 사항, 판단만)** 첫 화면 밀림: 코드 쪽 원인은 `fewNoteOf`(데이터 조건부) 하나이고 자리표시에 없는 것도 그것뿐이다(사양 36-13·§17-1 ③). 자리표시 부품은 서버 `GrowthSkeleton` 과 `GrowthScreen` 첫 요청 중 `GrowthSkeletonBody` 가 같은 부품·같은 상수라 두 자리표시 사이 점프는 없다. 안내 높이를 예약할지는 designer 판단.
- **I2** `growthSkeletonSizes` 단언(`growthScreen.test.ts` 마지막 `deepEqual` {36, 88, 330, 347})은 값을 고정할 뿐 실제 렌더 높이와 묶여 있지 않다(`topic/rowHeight.test.ts` 처럼 클래스↔값 연결이 아님). 개발자가 3폭 실측 중앙값을 근거로 적어 두었고 QA 36-16 #9 가 점프를 잰다.
- **I3** `EvalRadarSection` 레이더 상자는 너비를 재기 전까지 높이가 0 이라 응답 직후 한 프레임 레이아웃이 튈 수 있다(막대 상자는 높이 고정). 화면 아래쪽이라 첫 화면에는 영향 없음.
- **I4** 달력 «오늘» 단추 42px 는 2026-10-03 부터 있던 것(범위 밖, 판단 안 함).
- **I5** 동적 확인 한계: 이 감사는 정적 읽기·시험 재실행·변이·독립 계산이다. 실제 브라우저/서버 기동은 하지 않았다(미러에 DOM 도구 없음, 개발자의 헤드리스 하네스 108/108·12/12 보고는 재현하지 않음 — QA 가 36-16 으로 확인).

## 영역별 결론
1. 문구·원칙: 사양과 일치(L3·L4 반영 확인). 엔진·모델 이름·옛 이름 0. 급수·능력 단계 분리 OK. → 지적 L3(보호 주체).
2. 접근성: `role=status` 읽기 줄은 `WeeklyBars` 에 늘 마운트된 `<p>` 하나(글만 바뀜), 정상 화면 알림 1개·자리표시 1개·오류 `role=alert` 1개(시험 + 코드). `aria-labelledby` 5개·SVG `aria-hidden`·숨김 요약 문장+표 대체·색 병기 라벨·`aria-current`·`aria-disabled`·포커스 이동(분절 TTL=`DrawerSwitch` 와 줄 단위 동일·재시도 후 초점) 모두 코드 확인. 터치 44px(칩·분절 `::before`·‹ ›·summary·링크) 클래스 확인. DOM 순서 ‹ → 읽기 줄 → › 는 승인 데모와 같음. → 지적 L2(시험).
3. 데이터 훅: 앱 관례(`apiGet`·`no-store`·401 이동) 그대로, 라우트·화면의 `fetch` 직접 호출 0, 사용자 간 캐시 누출·민감정보 저장 0. → 지적 M1(시험 없음), L1(고른 주).
4. 라우트·분절: `growth/` 가 `(tab)` 형제·아래 `page`·`loading` 두 파일뿐·`plan/loading.tsx` 없음(시험 + 구조 확인) → 달력 자리표시 누수 없음. 비로그인 `redirect('/login?callbackUrl=/plan/growth')`, `proxy.ts` 기본 비공개, `FOCUS_ROUTE_PREFIXES` 에 안 들어가 하단 탭 «계획표» 켜짐(`match:'/plan'`). 문제 없음.
5. 달력 일요일 시작: 위 독립 계산 통과. 다른 소비처 없음(`monthGrid`·`WEEK_HEADERS` 는 `CalendarSection` 만, `arrowDelta`·챌린지 띠는 칸 단위). 코드에 남은 월요일 가정 0. → 지적 L4(성장 쪽 복제만).
6. 계산 정확성: 위 경계 대입 전부 사양과 일치.
7. 6층·금기: `src/components/**` 가 부르는 모듈은 `@/modules/infra/dates` 하나(기존 `plan/logic.ts` 와 같은 선례), 그 밖 `@/modules/**` 우회 import 0, spawn/`Capacitor`/`localStorage`/`console`/`dangerouslySetInnerHTML` 0, 새 16진 색 0(`globals.css` 변경 없음·`color-mix` 토큰 혼합), 모든 링크 고정 상수.
8. 시험의 질: 정적 렌더 시험은 문구·구조를 실제로 고정(변이 6/10 포착), 단 상호작용(클릭·상태 전환)은 시험이 없다 → M1·L1·L2.

## QA(Leader)가 볼 곳 (high_risk_areas)
1. **기간 전환·재시도 실제 브라우저(36-16 #6)** — 처음 고른 기간 앞 내용 유지 + `aria-busy`, 오류 → [다시 불러오기] 500ms 자리표시 → 초점 규칙, 기간 4→12→4 왕복 뒤 «고른 주»(L1).
2. **주 경계(36-16 #3)** — 오늘이 일요일·토요일일 때 «이번 주»·읽기 줄·체크내역 마지막 열·질문 탭 `THIS_WEEK` 가 같은 일~토.
3. **달력(36-16 #7)** — 2026-05(6줄)·2026-11(5줄)·2026-02(4줄) 줄 수 = 자리표시 줄 수, 2026-10 앞 빈칸 4, 하루 시트·방향키·기록 지우기 회귀.
4. **첫 화면 밀림(알려진 사항)** 실측 값 기록(체크내역 67px/360 103px) — designer 판정 대기.
5. **TalkBack/실기기(NOT_VERIFIED 로 사용자 몫)** — 읽기 줄 «… 일요일부터 … 토요일까지» 한 번 읽힘, 그림 건너뜀, 분절 «현재 페이지».
6. 사용자 보고: L3·L4 문구 전·후(승인 글과 다른 5곳)를 최종 요약에 공개(Leader 결정 L3·L4).

## 사양(§36)·승인 데모와 구현 차이 분류
- material: 없음. · implementation: 문구 L3·L4(사양이 명시한 변경), `PlanSwitch` 아래 간격 `mb-0`(사양 36-2 ⑩). · defect: 없음(L1 은 사양 36-6 D 한 줄과의 작은 불일치로 Low).
