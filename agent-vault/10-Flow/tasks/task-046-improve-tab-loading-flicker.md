---
task_id: task-046
title: "탭 이동 깜빡임 (IMP-0027) — '불러오는 중' 문구·가짜 빈 상태를 같은 높이 자리표시로 바꾸고 탭 누름 즉시 반응"
status: done
base_ref: cb95612
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-045-improve-topic-scenario-manager, task-043-challenge-screens, task-044-today-integration]
imp: [IMP-0027]
tags:
  - type/task
  - domain/improvement
  - domain/ux
aliases:
  - 탭 깜빡임
  - task-046
created: 2026-10-08
updated: 2026-10-08
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-light-waive"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-046 — 탭 이동 깜빡임 (IMP-0027)

## 사용자 요청 (원문)
- 2026-10-07: "앱에서 메뉴이동시 화면이 깜빡이는 현상이 있는데 이건 DB조회가 느려서인건가? 해당현상에 대한 원인확인해줘." → 원인 확인 뒤 "'불러오는 중' 화면은 제거하고 메뉴를 클릭하면 우선 빈데이터로 해당 화면을 렌더링하고 DB조회 후 데이터를 세팅하는 형태로 처리하면 깜빡이는 느낌도 없고 자연스러울 것" 제안.
- 2026-10-08: "다음 작업 이어서 진행해줘" — 대기 중이던 IMP-0027 착수로 해석(Leader 가 대기 중 권고안 B → 탭 즉시 반응을 적용, C 캐시는 B 측정 뒤 별도 결정).

## 관련 과거 이력 요약 (Leader 큐레이션)
- 원인(측정·코드 읽기, 2026-10-07): DB 가 느린 것이 아니다 — 탭 페이지 SSR 3~12ms·마운트 직후 API 4~19ms(운영 localhost, QA 계정). 각 탭이 마운트 때마다 `loading` 으로 시작해 카드·목록 안의 「불러오는 중…」/스켈레톤을 그린 뒤 API 2~7개를 병렬로 불러 응답이 따로 도착하고(`src/components/plan/usePlanData.ts:24` `useKeyedResource` 캐시 없음), `loading.tsx` 가 없다. 측정 도구: 세션 scratchpad `flicker.mjs`·`flicker-local.txt`·`flicker-slow.txt`(390×844·DSF 2.625·왕복 150ms), 대상 파일 `src/components/shell/TabBar.tsx`·`src/app/(app)/{study/today,plan}/page.tsx`·`TodayHome.tsx`·`ChatList.tsx`·`WordsScreen.tsx`.
- 디자이너·개발자 검토 결론(IMP-0027 본문): 「빈 데이터」 그대로는 「없음」으로 읽혀 **가짜 빈 상태·가짜 CTA**(오늘 탭 [기본 단어 50개 넣기]·[시작하기], 회화 「아직 채팅이 없어요」)가 뜬다 → **같은 높이의 정적 자리표시(B)** → **탭 누름 즉시 반응** → (선택) **탭 전환 사이 마지막 데이터 캐시(C)**. 지연 표시(D)는 단독 비권고.
- **task-045 에서 배운 것(자리표시 높이)**: 자리표시 높이를 클래스 합산으로 정하면 실제와 어긋난다 — 반드시 **QA 계정으로 실제 렌더 높이를 `getBoundingClientRect` 로 재서** 상수로 쓰고(근거 주석), 도착 뒤 점프 ≤ 8px 를 합격선으로 삼는다(`src/components/topic/TopicDetail.tsx` `DetailSkeleton`·`logic.ts` 높이 상수·`rowHeight.test.ts`/`uiAFix.test.ts` 의 상수-클래스 고정 시험 패턴). 자리표시는 출처·상태별로 모양이 달라지는 부분(뱃지·상태 상자)을 맞춰야 한다. 오류 상자 [다시 시도]는 실패 반영만 500ms 미루기(`useManageData` 패턴). 스크롤 규칙 R1~R6(`key` 변경·remount·`scrollIntoView`·`scrollTo` 금지, 안쪽 `overflow-y-auto` 에는 `relative`).
- 승인된 교훈(`/이슈기록 관련 ux`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `local_fix` · 복잡도 1.88 · R1 · developer=**sonnet** · track=**light** · demo=**none**(`DM-light-waive`) · roles=developer, reviewer. 결과 JSON scratchpad `intake-imp27.result.json`.
- **Leader 보정**: light 트랙이라 QA 가 면제되지만 task-045 에서 자리표시·점프를 **실측으로만** 잡을 수 있었으므로 **QA 실측(점프·깜빡임 단계 수)은 유지**한다. 범위가 12파일을 넘으면 standard 로 승격한다. 화면 구조·문구는 바꾸지 않는다(로딩 표시만 — 데모 불필요 판단의 전제).

## 범위 (이번 task)
1. **B 자리표시**: 오늘·회화·단어장·계획표 탭의 로딩 구간에서 「불러오는 중…」 문구와 **가짜 빈 상태·가짜 CTA 를 그리지 않고**, 도착 뒤와 **같은 높이의 정적 자리표시**(스켈레톤 블록)를 그린다. 공용 자리표시 부품(`src/components/challenge/parts.tsx` `Skeleton` 재사용 또는 확장)을 쓰고 높이는 실측값 상수.
2. **탭 누름 즉시 반응**: `TabBar` 에서 누르는 즉시 눌린 탭이 활성 표시(`useLinkStatus` 류 — Next 16 에서 사용 가능한 방식 확인). **`prefetch` 를 강제하지 않는다**(오늘 탭 API 가 복습 판단 잡을 만든다).
3. **측정**: 변경 전·후로 탭 전환의 **시각 상태 수(깜빡임 단계)**·**자리표시→도착 점프(px)** 를 같은 방법(`flicker.mjs` 방식, 390×844·왕복 150ms 스로틀)으로 잰다.
4. **하지 않는 것**: C 캐시(탭 전환 사이 마지막 데이터 유지) — B 측정 결과를 보고 사용자와 별도 결정(사용자 간 데이터 노출·오래된 [시작] 버튼·「실패하면 지난 값을 유지하지 않는다」 규칙 충돌 검토 필요). DB·API·네이티브 변경 없음.

## 완료 기준
- 4개 탭 전환에서 「불러오는 중…」 문구·가짜 빈 상태·가짜 CTA 가 보이지 않는다(자리표시만). 도착 뒤 레이아웃 점프 ≤ 8px(세 폭 360/390/412).
- 탭 누름 즉시 활성 표시. 기존 기능(오늘 [시작]·단어 50개 넣기·회화 목록·계획표)·스크롤·접근성(`aria-busy`/`role=status`) 회귀 없음. 단위 시험·tsc·eslint·build 통과.
- 운영 배포는 **사용자 확인 후**.

## 상태 로그
- [2026-10-08] Leader — 접수·judge·이 이력서 작성. 다음: 현재 4개 탭 로딩 UI 조사 + T2(공용 자리표시·회화·단어장·탭 반응) developer 소환.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-08 10:08 |

## QA 기록 (qa-046-base — 변경 전 기준선)

> 2026-10-08 10:08~10:27 · qa(신규 소환, sonnet) · 대상 커밋 `cb95612`(= 운영과 같은 앱 코드) · 읽기 전용 화면 이동 120회 · Claude(LLM) 미호출(`CLAUDE_CLI_PATH=/bin/false`) · 소스 수정 0.

### 한 줄 결론
- **가장 큰 문제 탭 = 오늘**: 본문이 300px → 969px(+669px, `main` 스크롤 높이 771→1031 +260px)로 자라고 CLS 0.171~0.25, 「불러오는 중…」이 80~103ms(로컬)/474~577ms(왕복 150ms) 보인 뒤 한꺼번에 채워진다. 다음은 계획표(+258px)·회화(계정1 +355px)·단어장(+78px). 질문은 로딩 없음.
- **탭 누름 반응 없음 구간**: 눌린 탭 활성 표시·주소·화면 내용이 **모두 같은 시각**(= 서버 컴포넌트 RSC 응답 도착 직후)에 바뀐다 — 로컬 32~56ms, 왕복 150ms 조건 **181~192ms**. 그 사이 옛 화면·옛 활성 탭이 그대로다.
- **[확인] `loading.tsx` 0개**(`find src/app -name loading.tsx` 출력 없음), 하단 탭 사라짐 0회(447개 상태 중 `NOTAB` 0), 정적 자원(`/_next/*`) 요청 0건(개발 서버 컴파일·재검증이 측정에 섞이지 않음).

### 재현 조건
- 서버: `cb95612` 를 `git archive` 로 `~/.node-local/thekaiwa-qa046base`(격리 복제본)에 풀고 `next dev -H 127.0.0.1 -p 3062`(APP_ENV=LOCAL, LLM 불가). **개발 서버라 React StrictMode 로 마운트 효과가 2번 돈다 → API 호출 수가 운영의 2배(오늘 14=7×2, 나머지 4=2×2)**. 운영 서버(3010)·DB 스키마·시드는 건드리지 않음.
- 브라우저: Google Chrome 147.0.7727.101 headless(Playwright `playwright-core`), `isMobile+hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, 애니메이션 끄지 않음. 폭×높이 **360×740 · 390×844 · 412×892**. 스로틀 두 가지: 없음 / 왕복 150ms·다운 1.6Mbps·업 750kbps(`Network.emulateNetworkConditions`, 워밍업 뒤에 켬).
- 워밍업: 5개 탭을 스로틀 없이 한 번씩 돌려 컴파일을 끝낸 뒤 측정(결과 버림). 측정 순서(출발→도착): 회화→오늘→계획표→단어장→질문→회화→단어장→오늘→회화→계획표→오늘 (탭당 2~3표본, 모든 표본에서 최종 높이 동일).
- 계정: QA 1(채팅 3·교정 5·단어 0·회화 0·세트 0·평가 0) · QA 2(전부 0). **두 계정 모두 단어 0개라 단어장/오늘 단어 카드는 「비어 있음」이 최종 상태** — 아래 NOT_VERIFIED 참고.
- 개발 서버의 하단 왼쪽 개발 표시(`nextjs-portal`)가 맨 왼쪽 탭(회화)을 가려 탭이 막혀 측정 도구에서만 CSS 로 숨김(앱 코드 무관).
- 측정 방법: 탭 터치 → `pointerdown`(캡처)을 시각 0 으로 삼고 `requestAnimationFrame` 마다 서명(경로·활성 탭·로딩 문구·`.animate-pulse`·`aria-busy`·빈 상태 문구 줄·버튼/링크 라벨·`main.scrollHeight`·텍스트 해시·하단 탭 유무)을 기록, 600ms+ 변화 없을 때(최종 안정) 종료. CLS 는 `hadRecentInput` 포함 합계와 제외 합계 둘 다 기록(이전 도구는 제외 값만 봐서 과소 계상 — 로컬 조건에서 전체 0.1~0.25 인데 제외 값은 0).
- 스크립트: `tests/live/p3-qa-ui/flicker/measure.mjs`(측정) · `report.mjs`(표 생성: summary/states/blocks/heights/jump) · `seedhash.mjs`(시드 해시). 실행 `node measure.mjs <결과.json> <쿠키1> <쿠키2>`(`ONLY="1:390:slow"` 로 부분 실행). 원본 결과·표: scratchpad `qa046-results.json`·`qa046-summary-all.md`·`qa046-jump-all.md`·`qa046-heights.md`·`qa046-states-1-390-slow.txt`(세션 종료 시 사라질 수 있으니 필요하면 `ONLY=` 로 재생성).

### 1. 탭별 시각 상태·나쁜 상태·안정까지 (390×844, 표본 범위)
상태 수 = 탭 누른 뒤 서로 다른 시각 상태(경로·활성 탭·로딩 문구·스켈레톤·빈 상태·버튼 수·높이 20px 구간 조합). 로딩 문구 = 「불러오는 중…」 계열 문구가 `main` 안에 보인 시간. 안정 = 마지막 변화 시각.

| 탭 | 조건 | 상태 수 | 「불러오는 중」 ms | 안정까지 ms | 활성·주소 변경 ms | CLS 전체/입력제외 | 본문 높이 변화 | main 스크롤 높이 |
|---|---|---|---|---|---|---|---|---|
| 회화 | 로컬 | 2 | 17~33 | 49~66 | 32~37 | 0.107(계정1)·0(계정2) / 0 | 계정1 268→623(+355), 계정2 268→371(+103) | 771→771(0) |
| 회화 | 150ms | 2 | 183~184 | 366~383 | 182~183 | 0.141(계정1)·0 / 0 | 위와 동일 | 0 |
| 오늘 | 로컬 | 3~4 | 80~103 | 132~153 | 34~52 | 0.171~0.25 / 0 | 300→969.4(+669.4) | 771→1031(+260) |
| 오늘 | 150ms | 3~4 | 474~577 | 665~766 | 185~192 | 0.171~0.25 / 같음 | 위와 동일 | +260 |
| 계획표 | 로컬 | 2~3 | 29~47 | 82~99 | 37~56 | 0.072~0.172 / 0 | 909→1166.9(+257.9) | 973→1231(+258) |
| 계획표 | 150ms | 3 | 212~229 | 399~415 | 184~187 | 0.071 / 0 | 위와 동일 | +258 |
| 단어장 | 로컬 | 2 | 17~33 | 50~66 | 32~33 | 0.008 / 0 | 301.5→379.5(+78), 블록 5→4 | 771→771(0) |
| 단어장 | 150ms | 2 | 165~181 | 349~366 | 181~185 | 0.008~0.022 / 0 | 위와 동일 | 0 |
| 질문 | 로컬/150ms | 1 | 0 | 33/182 | 33/182 | 0 | 0 | 0 |

- 상태 순서(계정1, 390, 150ms): **회화** 옛 화면 → 183ms 새 경로 + 「불러오는 중」(섹션 114px) → 366ms 목록·「아직 회화가 없어요」+[첫 회화 시작하기] → 383ms 안정. **오늘** 192ms 새 경로(앱바만, 본문 300px) → 516ms 평가 카드만 도착(나머지 로딩) → 666ms 전부 도착(+260px). **계획표** 186ms 스켈레톤(`aria-busy`, 본문 909px) → 382ms 챌린지 카드 도착(973→1079) → 415ms 달력 도착(→1231). **단어장** 185ms 분류 칩 줄 + 「불러오는 중」 → 350ms 「단어장이 비어 있어요」+버튼 → 366ms 칩 줄이 정렬 칩 줄로 바뀜(12px 이동).
- 가짜 빈 상태·가짜 CTA 시간: 회화 0ms(로딩 중엔 CTA 없음 — LoadingBlock 만), 오늘·단어장은 **측정 불가(NOT_VERIFIED)** — 두 계정 모두 단어 0개라 「단어장이 비어 있어요」+[기본 단어 50개 넣기]가 최종 화면에서도 정당하게 보여 로딩 중 노출과 구분되지 않는다. 관측 사실: 오늘에서 단어 카드의 빈 상태+CTA 는 다른 카드가 아직 로딩(L=1)일 때 먼저 그려져(로컬 132ms, 150ms 조건에서 ≈660ms) 마지막 도착(`lessons/today`)과 같은 프레임에 합쳐진다.
- 이전 운영(3010) 측정(`flicker-slow.txt`, 150ms)과 비교: 로딩 표시 구간 회화 167→183~184ms · 오늘 315→474~577ms · 계획표 197→212~229ms · 단어장 183→165~181ms. 오늘만 개발 서버가 느린 것(StrictMode 중복 호출·`lessons/today` 498ms 도착)이며 나머지는 비슷하다.

### 2. 점프(첫 프레임 → 최종) — 본문 블록 기준 (scrollHeight 는 뷰포트보다 짧은 화면에서 변화를 숨기므로 블록 높이로 잰다)
| 탭 | 360 | 390 | 412 | 첫 프레임 블록 [top,h] → 최종 블록 |
|---|---|---|---|---|
| 회화(계정1) | 268→623 | 268→623 | 268→623 | [62,42][118,48][184,114] → [62,42][118,48][184,234][?,217] |
| 회화(계정2) | 268→371 | 268→371 | 268→371 | [..][184,114] → [..][184,217] |
| 오늘 | 300→1024.9(+724.9) | 300→969.4(+669.4) | 300→969.4 | [62,80][160,76][160+,76] → [62,240][320,253.6/…][…] (카드 3장 190.6~253.6) |
| 계획표 | 933→1190.9(+257.9) | 909→1166.9(+257.9) | 889.5→1147.4(+257.9) | [64,172][254,554][826,115] → [64,278.4][360.4,705.5][1083.9,115] (360: 729.5) |
| 단어장 | 301.5→399(+97.5) | 301.5→379.5(+78) | 301.5→379.5(+78) | [62,44][112,44][164,38][210,32][248,83.5] → [62,44][114,38][160,32][198,211.5] (360: 231) |
| 질문 | 0 | 0 | 0 | 변화 없음 |
- **현재 스켈레톤/로딩 틀은 높이가 맞지 않는다**: 계획표 달력 스켈레톤 554px ↔ 실제 705.5(−151.5), 요약 카드 172 ↔ 278.4(−106.4); 단어장 로딩 5블록 ↔ 최종 4블록(칩 줄이 사라지고 정렬 줄이 12px 위로, 빈 상자 211.5 vs 로딩 83.5); 회화 로딩 섹션 114 ↔ 217~234; 오늘 로딩 카드 80+76×2 ↔ 240+253.6×3.
- 합격선(점프 ≤ 8px) 대비: **4개 탭 모두 현재 0/4 통과**(질문 제외).

### 3. 최종 안정 화면의 실제 블록 높이 (자리표시 상수의 근거 — 모두 `getBoundingClientRect`, `main` 기준 [top, height], 표본 간 동일)
본문 = `main` 의 앱바(`header.sticky`, **높이 52px 모든 탭 동일**) 아래 `div.px-4.pb-8`. 데이터 상태 두 가지(계정1=채팅 3·교정 5 / 계정2=빈 계정)가 다른 곳은 회화뿐이었다(오늘·계획표·단어장은 두 계정이 같은 값).

| 탭 | 폭 | main 스크롤 H | 본문 h (top) | 최상위 블록 [top,h] |
|---|---|---|---|---|
| 회화 계정1 | 360/390/412 | 685/771/819 | 623 (62) | 탭줄[62,42] · [＋ 새 회화][118,48] · 섹션[184,234](제목 22.5 + 목록 `ul` 179.5=행 3×58.5~59.5 + 안내 `p` 18) · 섹션[?,217] |
| 회화 계정2 | 360/390/412 | 667/771/819 | 371 (62) | 탭줄[62,42] · [＋ 새 회화][118,48] · 섹션[184,217] |
| 오늘 | 360 | 1087 | 1024.9 (62) | [62,240] · 섹션 3장[320, 217.1~253.6] · sr-only[1053.9,1] |
| 오늘 | 390 / 412 | 1031 / 1031 | 969.4 (62) | [62,240] · 섹션 3장[320, 190.6~253.6](합 ≈ 649) · sr-only[998.4,1] |
| 계획표 | 360 | 1255 | 1190.9 (64) | [64,278.4] · [360.4,729.5] · [1107.9,115] |
| 계획표 | 390 | 1231 | 1166.9 (64) | [64,278.4] · [360.4,705.5] · [1083.9,115] |
| 계획표 | 412 | 1211 | 1147.4 (64) | [64,278.4] · [360.4,705.5] · [1083.9,95.5] |
| 단어장(단어 0개) | 360 | 667 | 399 (62) | 검색 `form`[62,44] · 정렬 줄[114,38] · 개수 줄[160,32] · 빈 상자[198,231] |
| 단어장(단어 0개) | 390 / 412 | 771 / 819 | 379.5 (62) | [62,44] · [114,38] · [160,32] · 빈 상자[198,211.5](제목 22.5·본문 39·버튼 줄 104) |
| 질문 | 360/390/412 | 667/771/819 | 149 (62) | [79,19.5][102.5,25.5][140,54] |
- **데이터에 따라 높이가 달라지는 블록**: ① 회화 「채택을 기다리는 교정」 섹션(교정이 있을 때만 +234+18) — 계정1 vs 2 차이 [가능성 높음: 두 번째 217px 섹션이 빈 회화 목록 상자] ② 오늘 카드 3장(190.6↔253.6: 단어 카드 빈 상태/준비됨, 평가·수업 카드 상태 — 개별 카드 매핑은 `report.mjs blocks` 로 깊이 4까지 확인 가능) ③ 단어장 빈 상자 211.5(단어가 있으면 행 목록으로 대체 — **행 높이 NOT_VERIFIED**) ④ 계획표 달력은 5주/6주 달에 따라 달라질 수 있음(이번 10월 기준만 측정) ⑤ 360px 에서 오늘 +55.5px·계획표 달력 +24px·단어장 빈 상자 +19.5px(글줄 바꿈) — 폭에 따라 달라지는 블록은 자리표시에 폭별 값이 필요.
- 자리표시 설계 시사점(개발자 인계): 회화·오늘은 **조건부 섹션(교정 대기)·카드 상태에 따라 최종 높이가 달라져** 단일 상수로는 점프 ≤ 8px 를 맞출 수 없다 — 「가장 흔한 상태의 높이」로 고정하거나 조건부 섹션을 자리표시에서 제외하는 결정이 필요(Leader/Designer). 실측으로 정할 수 있는 상수는 위 표(앱바 52, 계획표 [278.4/705.5(360은 729.5)/115·412는 95.5], 단어장 [44/38/32], 회화 [42/48]).

### 4. 탭 누름 반응 지연 (터치 → …)
| 조건 | 활성 탭 표시 | 주소 변경 | 화면 내용 변경 | RSC 응답 끝 | 비고 |
|---|---|---|---|---|---|
| 로컬 | 32~56ms | 32~56ms | 32~56ms | 19~29ms | 세 값이 같은 프레임 |
| 150ms | 181~192ms | 181~192ms | 181~192ms | 163~171ms | 활성 표시 = 주소 = 내용 |
- 눌린 탭의 활성 표시는 **경로가 바뀌는 순간에만** 바뀐다(`TabBar` 가 `usePathname` 으로만 `aria-current` 계산). 서버 컴포넌트 페이지가 RSC 를 돌려주기 전엔 아무 변화가 없다 → 「누름 반응 없음 구간」 = RSC 왕복(≈ 왕복 시간 + 15ms). 질문 탭도 150ms 조건에서 182ms.

### 5. 서버 컴포넌트·로딩 구조·API 호출 (개발자 인계)
| 탭 | `page.tsx` 가 서버에서 하는 일 | `loading.tsx` | 클라이언트가 부르는 API(고유 호출 수; 개발 서버 표시는 ×2) |
|---|---|---|---|
| 회화 `/study/ai` | `searchParams` 만 읽음(인증·DB 없음) → `StudyAiHome` | 없음 | `corrections?…`, `chats?kind=TALK&limit=20` (2) |
| 오늘 `/study/today` | `auth()` + `getProfile()`(DB) → `TodayHome` | 없음 | `evaluations`, `challenges/today`, `words/categories`, `vocab/sessions`×2, `vocab/stats`, `lessons/today` (7; `lessons/today` 가 가장 늦음 — 로컬에서 마지막 API 도착 117~147ms·150ms 조건 ≈498ms) |
| 계획표 `/plan` | `auth()` + `getProfile()` → `<Suspense fallback={null}>` 안 `PlanScreen` | 없음 | `plan/calendar?month=…`, `challenges/today` (2) |
| 단어장 `/drawer/words` | `searchParams` 만 읽음 → `WordsScreen` | 없음 | `words?archived=0&sort=recent&limit=30`, `words/categories` (2) |
| 질문 `/ask` | (이번에 읽지 않음) | 없음 | 없음 (0) |
- `src/app` 아래 `loading.tsx` **0개**. 탭 마운트마다 각 훅이 `loading` 으로 시작(캐시 없음)해 위 API 를 병렬로 부르고 응답이 따로 도착해 단계적으로 그려진다.

### 6. 판정·NOT_VERIFIED
- 판정: **기준선 측정 완료(PASS 아님 — 변경 전 수치)**. 구현이 이 값을 쓴다.
- `NOT_VERIFIED`: ① 단어가 있는 계정의 단어장 행 높이·오늘 단어 카드(준비됨) 높이·로딩 중 가짜 빈 상태/CTA 노출(QA 1·2 모두 단어 0개 — 읽기 전용 제약으로 데이터 생성 불가; 필요하면 Leader 가 임시 데이터 허용(예: 앱의 「기본 단어 50개 넣기」 후 되돌리기)을 승인) ② 회화 목록(TALK) 행 높이(회화 0건) ③ `/study/ai?tab=chat|scenario` 하위 탭 로딩(탭바 이동 대상 아님, 미측정) ④ 질문 `page.tsx` 구조 ⑤ 실기기(S25+ WebView) 체감 — 사용자 육안 확인 필요 ⑥ 운영 빌드(production) 수치 — 개발 서버 측정(StrictMode 중복 호출·`lessons/today` 지연이 오늘 탭을 부풀림).
- 안전 확인: 시드 해시 시작·끝 `e826f3ef09237a9c` 동일(topics 5·scenarios 10), QA 1·2 의 최근 40분 생성 행(userId+createdAt 보유 모델 전체) 0건, 운영 서버(3010)·pm2·배포·`db push` 접촉 0.

### 체크포인트 (qa-046-base 종료)
- 완료: 탭 4+1개 × 세 폭 × 계정 2 × 스로틀 2 = 12개 실행·120회 전환 측정, 표 생성, 시드 해시 불변, 서버 종료.
- 남은 일: **변경 후 재측정**(같은 스크립트·같은 조건으로 변경 커밋 스냅샷에 대해 실행, 합격선 점프 ≤ 8px·로딩 문구 0·누름 반응 지연 ≈ 0).
- 다음 첫 명령: `Q=$HOME/.node-local/thekaiwa-qa046after; git archive <변경커밋> | tar -x -C $Q && cp .env $Q/.env && chmod 600 $Q/.env && cd $Q && npm ci && prisma generate` → `next dev -H 127.0.0.1 -p 3062` → 쿠키 `QA_ACCOUNT=1/2 … qa-session.ts` → `node tests/live/p3-qa-ui/flicker/measure.mjs <결과.json> <쿠키1> <쿠키2>` → `node report.mjs <결과.json> summary|jump|heights`.
- 주의점: 쿠키는 1시간 유효. 개발 서버 개발 표시(`nextjs-portal`)는 측정 도구가 숨김. 비교는 개발 서버 vs 개발 서버로만(운영 빌드와 섞지 않음).
- 미정리 행·폴더: 없음 (프로세스 정리: dev 3062 종료·포트 비움·자식 0, 복제본 `~/.node-local/thekaiwa-qa046base`·`.env` 사본·쿠키 삭제, 스크린샷 0장).

## Developer 기록 (T2 — 탭 눌림 반응·loading.tsx·회화·단어장 자리표시)

> developer(sonnet, light 트랙) · 대상 base cb95612 · 커밋·push 없음 · native_change: false

- [10:53] **변경 파일**: 수정 5 — `src/components/shell/TabBar.tsx`·`src/components/chat/ChatList.tsx`·`src/components/chat/StudyAiHome.tsx`(`TABS`→`STUDY_AI_TABS` export 뿐)·`src/components/vocab/WordsScreen.tsx`·(이동) `src/app/(app)/study/ai/page.tsx` → `src/app/(app)/study/ai/(tab)/page.tsx`(내용 그대로, 일반 `mv` 라 인덱스는 건드리지 않음 — 커밋할 때 삭제+신규 두 경로를 함께 add). 신규 — `shell/tabPress.ts`·`shell/tabSkeleton.ts`·`shell/TabSkeleton.tsx`·`chat/StudyAiSkeleton.tsx`·`vocab/WordsSkeleton.tsx`·`app/(app)/study/ai/(tab)/loading.tsx`·`app/(app)/drawer/words/loading.tsx`·시험 `shell/__tests__/{tabPress,tabSkeleton}.test.ts`·측정 `tests/live/p3-qa-ui/flicker/{t2-heights,t2-press}.mjs`(새 파일). 오늘·계획표·`TodayHome`·`plan/**` 는 건드리지 않음(T3).
- [10:53] **눌림 반응**: `useLinkStatus` 대신 TabBar 로컬 `pressed`(href) 상태 — 근거: 한 번에 하나만 켜야(눌린 탭 켬 + 옛 활성 탭 끔) 경로가 바뀌는 순간 모양이 다시 바뀌지 않는데 `useLinkStatus` 는 Link 하나의 `pending` 만 알아 옛 탭을 끌 수 없다. 전이는 순수 함수(`tabPress.ts`: `isPlainClick`·`nextPressed`·`tabIsOn`, 이미 활성인 탭/수정키 클릭은 눌림 아님), 경로가 바뀌면 렌더 중 조정으로 풀리고(효과로 풀면 한 프레임 늦음) `PRESS_TIMEOUT_MS` 8초 뒤에도 풀림. **접근성**: `aria-current="page"` 는 실제 경로로만, 눌림은 `data-pending="true"` + 글자색·굵기 모양만. `prefetch` 건드리지 않음(시험이 `prefetch` 문자열 금지로 고정).
- [10:53] **loading.tsx 적용 범위**: 회화는 `study/ai/(tab)/` 라우트 그룹(주소 `/study/ai` 그대로) — `study/ai/` 바로 아래에 두면 `chat/[chatId]`·`talk/…`·`scenario/…` 로 들어갈 때도 목록 자리표시가 뜬다. 단어장은 `drawer/words/` 에 page.tsx 뿐이라 그 폴더에 직접. 실측으로 확인: 채팅 목록 → 채팅방 진입 프레임에서 `aria-busy` 자리표시 0회·앱바 제목이 곧바로 방 제목, `?tab=chat` 분절 전환(`router.replace`)에서도 자리표시 0회(라디오는 즉시 바뀜). 시험 `tabSkeleton.test.ts` 가 `study/ai/loading.tsx`·`drawer/loading.tsx`·오늘/계획표 loading 이 없음을 고정.
- [10:53] **자리표시 방식**: 서버 `loading.tsx` 와 클라이언트 로딩 구간이 같은 부품(`ChatRowsSkeleton`·`WordRowsSkeleton`·`WordCategoryRowSkeleton`)을 쓴다. 정적으로 아는 부분은 실제 부품을 그대로 그리고 `inert`(눌림·포커스·읽기 모두 막음): 회화 = 앱바·탭줄(`Segmented`)·[＋ 새 회화], 단어장 = 앱바·검색·조각 칩·정렬 줄·보관함·개수 줄·표시 토글. 목록만 정적 회색 블록(`animate-pulse` 없음), `aria-busy="true"` + `role="status"` `sr-only` 「불러오고 있어요」. 「불러오는 중…」 글자·가짜 빈 상태·가짜 CTA 0(`LoadingBlock` 은 ChatList·WordsScreen 에서 뺌, 다른 화면 사용은 그대로). 서버 loading 화면은 데이터 요청 없음(진짜 화면이 올라오면 그쪽이 불러옴 — 시험으로 고정).
- [10:53] **자리표시 상수 표(근거 = 단어 50개 시드한 QA3·채팅 3개 QA1 의 `getBoundingClientRect`, 360/390/412 동일, 스크립트 `t2-heights.mjs`)**:

| 항목 | 값 | 실측 근거 |
|---|---|---|
| 회화·채팅 줄 | 67.5 × 5줄, 줄 사이 8 | 실제 줄 67.5·67.5·68.5(뱃지 줄 +1), 목록 `ul` 219.5 = 3줄+gap 16, 섹션 머리 30.5 → 자리표시 섹션 [184,400] |
| 단어장 줄 | 104 × 6줄 (+테두리 2) | 단어 30행 `ul` 3120.7 → (3120.7−2)/30 ≈ 104 (행 93.8~105.8: 루비·한글 줄 켬 기본). 6줄 = 626, 360×740 첫 화면(목록 시작 292, 보이는 375)도 채움 |
| 단어장 분류 칩 줄 자리 | 래퍼 mt 6 + py 4×2 + 칩 36 = 50 | 실제 [112,44] |
| 앱바 / 회화 탭줄 / [＋ 새 회화] / 단어장 검색·조각·정렬·개수 | 52 / 42 / 48 / 44·44·38·32 (실제 부품) | 점프 0 (자리표시 아님) |

- [10:53] **변경 후 측정(390×844, `measure.mjs` 재사용·같은 조건, 개발 서버)**: 회화 첫 프레임 [62,42][118,48][184,400] → 최종 [..][184,217](QA3·TALK 0건 빈 상태 상자) — **위쪽 블록 위치 이동 0**, 마지막 블록 높이만 −183(5줄 자리표시 → 빈 상자). 단어장(QA3, 단어 50) 첫 [62,44][112,44][156,44][208,38][254,32] → 최종 같은 위치 — **top 이동 0(세 폭 360/390/412)**, 목록(마지막 블록)만 626 → 3120.7. 상태 수 2(서버 자리표시 = 클라이언트 자리표시 → 데이터, 중간 모양 없음; 왕복 150ms 안정까지 회화 366ms·단어장 455~457ms — 기준선 366~383/349~366 과 비슷). 보이는 「불러오는 중」 0프레임(`measure.mjs` 의 「로딩문구ms」 열은 `sr-only` 알림 문구도 세므로 0이 아님 — 도구 한계). 누름 반응(`t2-press.mjs`, 왕복 150ms 스로틀): 탭 누른 뒤 **25~60ms 에 `data-pending`·켜진 모양이 눌린 탭으로** 옮겨감(기준선: 경로 변경 181~192ms 까지 반응 없음), 경로 변경·`aria-current` 이동은 그대로 약 190~210ms 에 같은 프레임, 활성 탭 다시 누름은 아무 변화 없음. 경로 변경 프레임부터 자리표시가 바로 보임.
- [10:53] **보정 측정**: QA3 에 `POST /api/v1/words/seed-pack`(N5, added 50)으로 시드 → 측정 → `WordEntry` 50행 삭제(QA3 userId 한정). 전후 QA3 행 수(userId 보유 전 모델) `{"Profile":1,"UserSpeechSetting":1,"Attendance":2,"RequestTrace":1}` 동일, 시드 중 새로 생긴 행은 `WordEntry` 뿐. 서버(3063)·쿠키 파일 정리 완료, 운영(3010)·`db push`·`seed.ts` 접촉 0. 채팅 줄 높이는 QA1 읽기 전용(화면 이동만)으로 쟀다.
- [10:53] **실행 증빙**: `src/components/**` 단위 시험 **946/946 통과**(신규 12건: `tabPress.test.ts` 5 · `tabSkeleton.test.ts` 7), `tsc --noEmit` rc=0, 변경 파일 eslint rc=0, `next build` rc=0(`t2-build.log`), 보이지 않는 문자 0건(diff+신규 파일), **변이 10건 모두 시험이 잡음**(nextPressed 활성 분기 제거·tabIsOn 눌림 무시·data-pending 삭제·prefetch 강제·채팅 gap 8→6·칩 높이 36→32·`study/ai/loading.tsx` 추가·`animate-pulse` 추가·회화 inert 제거·자리표시에 「불러오는 중」 노출 — 격리 복사본에서만 변경, NFS 원본 불변).
- [10:53] **가이드와 달라진 점**: ① `useLinkStatus` 대신 로컬 상태(사유 위). ② 회화 `page.tsx` 를 `(tab)` 그룹으로 이동(주소·내용 불변). ③ 단어장 분류 칩 줄 자리를 `WordsScreen` 에도 추가(`catPending` — 분류 응답 전 자리표시, 실패하면 거둠): 단어가 있는 흔한 상태에서 칩이 도착할 때 아래 줄이 50px 밀리던 것을 막는다. ④ ChatList 오류 [다시 시도] 는 자리표시가 생겨 `useManageData` 의 `retryFailHoldMs`(500ms)를 그대로 가져와 바로 다시 실패해도 오류 상자가 500ms 뒤에 돌아온다.
- [10:53] **알려진 한계(Leader 결정 필요)**: (1) 회화 「채택을 기다리는 교정」 카드는 있을 때만 생기고 별도 요청이라, 교정이 있는 계정(QA1)은 자리표시 섹션이 [184] → 카드 도착 후 [436] 으로 252px 밀린 뒤 목록이 도착한다(자리표시에 안 넣기로 한 조건부 섹션 — 해소하려면 교정 카드·목록을 한 번에 보여 주는 화면 구조/요청 합치기 결정이 필요). (2) 단어가 하나도 없는 계정은 자리표시의 분류 칩 줄·조각 줄이 응답 뒤 접혀(−94px) 정렬·개수 줄 등이 위로 올라간다(첫 사용자만; 흔한 쪽을 따름). (3) 목록 줄 수(회화 5·단어장 6)는 중간값이라 실제 줄 수에 따라 마지막 블록 높이가 변한다(위쪽은 안 움직임). (4) 개발 서버 첫 이동은 라우트 컴파일로 ~1초 걸림(측정 제외, 운영 빌드 아님). (5) 운영 빌드의 prefetch 동작·실기기 체감은 미확인. (6) 서버 `loading` 의 `DisplayToggles`(단어장)는 표시 설정 저장소 로딩을 한 번 앞당긴다(공유 저장소라 중복 요청 없음).
- [10:53] **환경 메모(재발 방지)**: `cp -al` 로 만든 `node_modules` 에 다른 에이전트의 임시 심볼릭 링크(`node_modules/node_modules` → 시나리오 scratchpad)가 같이 따라와 Turbopack 이 「Symlink … points out of the filesystem root」 로 500 → 내 미러에서만 `unlink`. `bash scripts/sync-local.sh` 를 `KAIWA_LOCAL_ROOT` 없이 한 번 실행해 기본 미러(`~/.node-local/thekaiwa`)에 NFS 현재 소스가 동기화됨(원본이 NFS 라 내용 동일, 해 없음). `pkill -f` 에 서버 명령 문자열을 쓰면 자기 셸이 죽는다(exit 144) — 포트로 pid 를 찾아 종료.
- [10:53] **체크포인트(T2 종료)**: 완료 — 눌림 반응·회화/단어장 loading.tsx·공용 자리표시·클라이언트 로딩 구간·보정 측정·시험/빌드. 남은 일 — **T3 오늘·계획표**(오늘: 로딩 `80+76×2` ↔ 최종 `240+253.6×3`, +260px(계정 상태 따라 +306); 계획표: 스켈레톤 달력 554 ↔ 705.5, 요약 172 ↔ 278.4 — 둘 다 아직 점프 258~306px 이고 `loading.tsx` 도 없음; 오늘 `TodayHome`·`plan/**` 는 T3 에서 수정), 변경 후 QA 재측정, Reviewer. 다음 첫 행동 — T3 developer 가 `tabSkeleton.ts` 에 오늘/계획표 상수를 더하고 `study/today/(tab)`·`plan` loading 을 같은 방식으로 둔다(오늘 쪽은 `study/today/words|talk|eval` 하위 경로가 있으니 회화처럼 라우트 그룹 필수, `plan/challenge*` 도 하위 경로). 주의점 — 자리표시 상수는 반드시 실제 렌더 실측으로, 시험은 상수-클래스 고정. 미커밋 파일 — 위 「변경 파일」 전부(`git status` 기준 수정 4 + 삭제 1 + 신규 다수).

## Developer 기록 (T2b — 교정 카드·목록 동시 표시)

> developer(sonnet, light 트랙) · 대상 IMP-0027 T2b · 커밋·push 없음 · native_change: false

- [11:40] **변경 파일**: 수정 3 — `src/components/chat/StudyAiHome.tsx`(본문을 로컬 `TalkChatPanel` 로 묶고 판단 상태 3개·상한 타이머를 쥠. 회화/채팅 두 갈래 JSX 는 한 컴포넌트로 합쳤고 DOM 은 그대로) · `PendingCorrectionsCard.tsx`(`onSettled`·`hold` 추가) · `ChatList.tsx`(`hold`·`onSettled` 추가, 오류 상자 경로 불변). 신규 — `chat/listHold.ts`(순수 함수 `shouldHoldList(cardSettled, capElapsed)`·`shouldHoldCard(listSettled)`·상수 `LIST_HOLD_CAP_MS = 1500`) · `chat/__tests__/listHold.test.ts`(9건) · 측정 `tests/live/p3-qa-ui/flicker/t2b-card-list.mjs`(새 파일). 금지 영역(shell·vocab·plan·app·TodayHome) 접촉 0.
- [11:40] **동작**: 카드 요청(#34)과 목록 요청(#27)이 둘 다 끝난 뒤 한 번에 그린다. 그 전에는 목록 자리표시(`ChatRowsSkeleton`) 유지·카드는 아무것도 안 그림. 카드 실패(`.catch`)도 「끝남」으로 쳐서 목록을 막지 않는다. 카드가 1500ms 안에 안 끝나면 카드를 기다리지 않고 목록을 그리고, 그 뒤 카드가 늦게 오면 기존처럼 위에 생긴다(이 경우만 밀림). 목록이 이미 그려진 뒤 화면 복귀로 다시 읽을 때는 자리표시로 돌아가지 않는다(`hold` 는 시간이 갈수록 true→false 로만 바뀜 + `items !== null` 갱신 경로 그대로). 오류 상자([다시 시도])·T2 의 `retryFailHoldMs` 500ms·스크롤 규칙·시나리오 탭 불변.
- [11:40] **실행 증빙**: `src/components/**` 단위 시험 **955/955 통과**(신규 9건 포함; 동시에 작업 중인 T3 의 변경분이 섞인 미러 상태) · `tsc --noEmit` rc=0 · 변경 파일 eslint rc=0 · `next build` rc=0 · 보이지 않는 문자 0건(diff + 신규 파일) · **변이 11건 모두 시험이 잡음**(상한 제거·상한 1500→3000·카드 항상 그림·목록/카드 hold 배선 제거·카드 실패를 끝남으로 안 침·카드 hold 무시·오류 상자를 hold 로 가림·유예 뒤 오류 settled 누락·상한 타이머 제거·다시 시도 500ms 제거 — 격리 복사본에서만, NFS 원본 md5 불변 확인).
- [11:40] **실측(개발 서버, 홈 미러 `thekaiwa-t046-t2b`, 포트 3065, LLM 불가, 스로틀 없음 + 요청 지연 주입; 72 실행 = 폭 360/390/412 × 계정 2(QA1 교정 3건 있음·QA2 없음) × 진입 3(`talk`=/ask 에서 하단 탭 회화 누름·`chat`=`?tab=chat` 전체 로드·`switch`=회화→채팅 분절) × 지연 4)**: 프레임(requestAnimationFrame)마다 [자리표시·카드·실제 목록·목록 섹션 top] 기록. 「카드가 먼저」=카드는 보이는데 목록은 자리표시인 프레임, 「목록이 먼저」=목록은 보이는데 카드가 나중에 생기는 프레임.

| 계정 / 진입 / 지연 | 폭 360·390·412 공통 모양 | 카드 먼저 | 목록 먼저 | 목록 top 이동 |
|---|---|---|---|---|
| 교정 있음 / talk·chat / 지연 없음 | 자리표시@184 → **카드+목록 한 프레임**@436 (도착 175~452ms) | 0 | 0 | 1회 +252 |
| 교정 있음 / talk·chat / 카드 300ms 지연 | 자리표시 → 카드+목록 동시(도착 464~775ms) | 0 | 0 | 1회 +252 |
| 교정 있음 / talk·chat / 목록 300ms 지연 | 자리표시 → 카드+목록 동시(도착 485~590ms) | 0 | 0 | 1회 +252 |
| 교정 있음 / talk·chat / 카드 2000ms 지연(상한 경로) | 자리표시 → **목록만**@184(1655~1890ms, 상한) → 카드 도착(2175~2405ms)에 +252 | 0 | 31프레임(허용된 경우) | 1회 +252(카드 도착 때) |
| 교정 없음 / talk·chat / 지연 없음·카드 300·목록 300 | 자리표시@184 → 목록@184 (카드 0건이면 곧바로 풀림; 도착 = 느린 쪽 요청 끝) | 0 | 0 | 0 |
| 교정 없음 / 카드 2000ms 지연 | 자리표시 → 목록@184(1638~1897ms, 상한) | 0 | 0 | 0 |
| 모든 계정 / switch(회화→채팅) | 변화 프레임 0 — 자리표시·재대기 없음, 카드·목록은 그대로 | 0 | 0 | 0 |

  위반 0건(카드 먼저 >0, 상한 경로 밖 목록 먼저 >0, 이동 2회 이상 모두 0). 중간 모양 0프레임, 최종 위치(436)로 한 번에. **같은 방법의 기준선**(= T2 시점 동작: `StudyAiHome` 의 두 `hold` 만 끈 격리 미러, 포트 3066, QA1 390폭): 카드 300ms 지연 → 목록 먼저 17~18프레임(`--L@184` 뒤 카드가 생기며 +252), 목록 300ms 지연 → 카드 먼저 19프레임(`SC-@436` — 자리표시가 184→436 으로 252px 내려감), 지연 없는 자연 경주(채팅 진입)에서도 카드 먼저 46프레임. 즉 측정 도구가 문제를 잡고, 변경이 그것을 없앤다.
- [11:40] **가이드와 달라진 점**: ① 카드도 hold 한다(`shouldHoldCard`) — 가이드의 한 방향(목록만 hold)이면 「② 카드가 먼저 오면 자리표시가 252px 내려간다」 가 남는다(기준선 `SC-@436` 19프레임으로 확인). 카드는 목록이 첫 결과(데이터·오류)를 받은 뒤에만 그린다. ② 상한은 `elapsedMs` 인자가 아니라 `TalkChatPanel` 의 `setTimeout(…, LIST_HOLD_CAP_MS)` → 불리언 `capElapsed` (순수 함수는 `shouldHoldList(cardSettled, capElapsed)`). ③ `onSettled` 는 `useEffect` 가 아니라 요청 `.then/.catch` 안에서 `setData` 와 같은 틱에 부른다 — 효과로 미루면 비긴급 갱신의 효과가 페인트 뒤에 돌아 부모가 한 프레임 늦게 풀려 「중간 모양」 1프레임이 생길 수 있다([가능성 높음] — 효과 방식은 실측하지 않고 처음부터 요청 핸들러 방식으로 구현). 콜백은 ref 로 읽어 정체성이 바뀌어도 다시 요청하지 않는다. ④ 판단 상태를 쥐는 `TalkChatPanel` 을 `StudyAiHome.tsx` 안에 둠 — 시나리오 탭에서 돌아올 때 상한 타이머·상태를 새로 시작하려면 카드·목록과 같은 수명의 컴포넌트여야 한다.
- [11:40] **Leader 가정과 실측이 다른 점(확인 필요)**: 「탭(talk/chat)을 바꾸면 카드가 다시 마운트되므로 상태가 초기화」 는 **아니다** — 회화·채팅 두 갈래는 같은 자리의 Fragment 라 React 가 `PendingCorrectionsCard`·`ChatList` 를 재사용한다(실측 switch 변화 0프레임). 그래서 회화→채팅 전환에서 「탭마다 한 번 기다림」 은 없고(재대기·자리표시 없음) 지금 동작 그대로다. 코드 읽기상 `ChatList` 는 `kind` 가 바뀌어도 `items` 를 비우지 않아 새 응답이 올 때까지 이전 종류의 줄이 보인다(T2 이전부터 있던 동작, 이번 범위 밖이라 안 고침 · 높이 측정은 안 함). 고치려면 `key={tab}` 로 재마운트하는 방법이 있는데, 그러면 전환마다 자리표시+카드 대기가 되풀이되므로 별도 결정이 필요하다.
- [11:40] **알려진 한계**: (1) 교정이 있는 계정은 자리표시 → 최종 사이 목록이 +252px 한 번 내려간다 — 자리표시에 카드 자리를 미리 잡지 않기로 한 T2 결정 그대로(조건부 섹션이라 미리 알 수 없음). 중간 모양 없이 한 번에 바뀐다는 것까지가 이번 목표. (2) 카드 요청이 느리면(≤1500ms) 교정이 없는 계정도 목록이 그만큼 늦게 나타난다 — 두 요청은 병렬이라 늦는 시간 = max(카드, 목록)이지 합이 아니다. 로컬 실측 지연 없음: 도착 173~452ms. (3) 상한(1500ms) 뒤에 카드가 늦게 오면 목록이 252px 밀린다(허용 조건, 위 표 상한 경로). (4) 목록 오류 상자는 hold 로 막지 않는다(목록이 먼저 오류를 내고 카드가 나중에 오면 상자가 밀릴 수 있음 — 드문 경로). (5) 목록이 있고 교정이 없는 계정은 QA 계정에 없어 측정 못 함(QA1 은 채팅 3개·교정 3건, QA2~4 는 둘 다 0건) — 빈 상태 상자로만 확인. (6) 개발 서버 측정이라 운영 번들 타이밍과 다를 수 있다.
- [11:40] **정리**: 서버(3065·3066)·쿠키 파일(`cookie1~4`)·측정 부산물 정리. 운영(3010)·`db push`·`seed.ts`·실사용자 데이터 접촉 0, QA 계정은 읽기만(화면 이동). 홈 미러는 `~/.node-local/thekaiwa-t046-t2b`(+기준선용 `-base`). 환경 메모: `cp -al` 한 미러의 `.next`(728M)는 원 미러와 하드링크라 개발 서버가 쓰면 서로 오염된다 → 복사 직후 `.next` 를 지우고 시작.
- [11:40] **체크포인트(T2b 종료)**: 완료 — 카드·목록 동시 표시(양방향 hold + 상한 1500ms), 시험·변이·실측. 남은 일 — Reviewer(재실행 대상: listHold 시험 9건, 변이 스크립트 `scratchpad/t2b-mut.py`, 측정 `t2b-card-list.mjs`). 다음 첫 행동 — Leader 가 diff 확인 후 경로 지정 커밋. 미커밋 파일: `src/components/chat/{StudyAiHome,PendingCorrectionsCard,ChatList}.tsx`(T2 변경 위에 얹은 수정) · `src/components/chat/listHold.ts` · `src/components/chat/__tests__/listHold.test.ts` · `tests/live/p3-qa-ui/flicker/t2b-card-list.mjs`.

## Developer 기록 (T3 — 오늘·계획표 자리표시·loading.tsx)

> developer(sonnet, light 트랙) · 앞선 T3 개발자가 구현을 끝내고 80회 한도에서 끊긴 것을 이어받아 점검·시험·실측·기록 · 커밋·push 없음 · native_change: false

- [11:58] **변경 파일** — 앞선 개발자(구현, 이번에 내용 점검만): 수정 9 — `vocab/{TodayHome,TodayWordsCard,TopicWordsCard}.tsx` · `eval/EvalHomeCard.tsx`(`onSettled`) · `lesson/TodayLessonCard.tsx` · `challenge/ChallengePlanCard.tsx`(자리표시 172 → `PLAN_SKELETON.challengeCardH`) · `plan/{CalendarSection,PlanScreen,parts}.tsx`(요약 칸 로딩 틀 `mb-1`→`mb-0.5`, `GrowthSoonCard` 공용 부품) / 이동 2 — `src/app/(app)/study/today/page.tsx` → `(tab)/page.tsx`, `src/app/(app)/plan/page.tsx` → `(tab)/page.tsx`(내용 그대로, 일반 `mv` 라 인덱스에는 삭제+신규로 보임 — 커밋할 때 두 경로를 함께 add) / 신규 — `(tab)/loading.tsx` 2 · `vocab/{todaySkeleton.ts,TodaySkeleton.tsx,todayHold.ts}` · `plan/{planSkeleton.ts,PlanSkeleton.tsx}` · 시험 3 · 측정 `tests/live/p3-qa-ui/flicker/{t3-heights,t3-jump,t3-report,t3-cap}.mjs`·`t3-rows.mts`. **이번 마무리 수정(2파일)**: `plan/PlanSkeleton.tsx`(아래 결함 1) · `plan/__tests__/planSkeleton.test.ts`(시험 2건 추가). T2/T2b 영역(chat·Words*·TabBar·tabPress·tabSkeleton·TabSkeleton·study/ai·drawer) 접촉 0.
- [11:58] **QA3 단어 데이터 정리** — 발견: QA3(`cmuwvwbju…`)에 `WordEntry` 50행(source SEED, 2026-10-08 11:00 KST — 앞선 개발자의 N5 시드, 정리 기록 없음). 조치: userId·id 목록·SEED·10:50 이후 조건을 모두 걸어 50행만 지움(대상 id 목록은 세션 scratchpad `qa3-word-ids-before.json`). 전 `{WordEntry:50,Profile:1,UserSpeechSetting:1,Attendance:2,RequestTrace:1}` → 후 `{0,1,1,2,1}`. 실측을 위해 `POST /api/v1/words/seed-pack`(N5)으로 다시 50행을 넣었고 끝에 같은 방법(대상 50행 id 확인 후)으로 지움 → 최종 `{WordEntry:0,Profile:1,UserSpeechSetting:1,Attendance:2,RequestTrace:1}` — 시작과 같다. QA 1·2·4·admin·developer·super 의 단어는 처음부터 끝까지 0, 실사용자 계정의 시드 단어 50행은 건드리지 않음(전체 `WordEntry` 100 → 50). 운영(3010)·`db push`·`seed.ts` 접촉 0. (참고: 이전 기록의 `/api/v1/vocab/seed` 는 없는 경로이고 실제 경로는 `/api/v1/words/seed-pack`.)
- [11:58] **코드 점검 a~h**
  - (a) `loading.tsx` 범위 — 구조는 맞다. 둘 다 `(tab)` 라우트 그룹 안(주소는 그대로)이라 `study/today/{words,talk,eval}/…`·`plan/{challenge/[id],challenge/new,challenges}` 는 그룹의 형제이지 자식이 아니다. 시험 + **실측**(왕복 150ms, `next.router.push`): 하위 5곳 진입에서 탭 자리표시가 보인 프레임 0, 대조군(회화 → 오늘 30프레임, 회화 → 계획표 130프레임)은 잡힘.
  - (b) `inert`·`aria-hidden` — React 19.2.8 에서 `inert` 는 불리언 속성이고 `tsc` rc=0. 실측: 보류 중 래퍼 `inert=true`·`aria-hidden="true"`·`visibility:hidden`·첫 버튼 포커스 불가 / 공개 뒤 세 속성 모두 없음·버튼 포커스 가능·`role=status` 문구 0.
  - (c) 높이 유지 — 단어가 있는 상태에서 세 폭 모두 자리표시 블록 = 최종 블록(점프 0·Δh 0, 아래 표). 상한 경로(회화 요청 2000ms 지연)에서도 몸통 자리표시 상태의 회화 카드가 253.6 으로 같아 공개 시 위치 이동 0. 단어 0개 상태는 단어 카드가 240(자리표시 285.5/305) → 45.5/65px(알려진 한계).
  - (d) 공개 뒤 되돌아감 — 없다. `setShown(false)` 없음(시험 + 변이), 홈 효과는 `tick` 재읽기 때 `loadState` 를 `loading` 으로 되돌리지 않음. 실측: 화면 복귀(`visibilitychange`) 뒤 오버레이 0/110프레임, 로딩 알림 0.
  - (e) 스크롤 규칙 — diff 에 새 `key`·`scrollIntoView`·`scrollTo` 없음(grep 에 걸린 2건은 주석 1과 기존 `KeptSets key={loadSeq}` 줄의 들여쓰기 변경). 진짜 카드는 `display:none` 이 아니라 `invisible` 로 제자리 마운트라 `cardRef` 좌표가 최종 좌표. `PlanSkeleton` 의 `CalendarGrid key={month}` 는 `PlanScreen` 의 기존 `key={month}` 와 같은 규칙.
  - (f) `todayKst()` — `loading.tsx` 와 `page.tsx` 가 같은 서버 함수를 부르고, 클라이언트는 `serverToday` → 응답의 `today` 로 이어진다. 같은 달·주 수를 만든다(월 쿼리 `?month=2026-09` 진입에서 자리표시 제목 「2026년 9월」·날짜 칸 38 → 최종 38, 운영 빌드). 자정 경계: 말일 → 1일 밤 직전에 만들어졌거나 라우터 캐시에 남은 자리표시만 이전 달 격자를 그려 `PlanScreen` 이 새 달로 한 번 바뀐다 — 한 달에 한 번, 몇 분 안(실측 안 함).
  - (g) 요청 — diff 에서 새 `apiGet/apiPost/fetch` 0, 새 효과는 타이머 하나(1500ms)와 `EvalHomeCard` 의 콜백 호출뿐. 시험이 홈 요청 경로 5개 문자열을 고정.
  - (h) 문구 — 엔진명·모델명 0, 새 「AI」 0(제목 「AI 평가」는 기존), 「세요」 0, 보이지 않는 문자 0(diff + 새 파일, `LC_ALL=C.UTF-8` grep).
- [11:58] **발견한 결함 1건(수정함)** — `next build` rc=1: `useSearchParams() should be wrapped in a suspense boundary at page "/plan"`. `loading.tsx` 의 `PlanSkeleton` 이 `useSearchParams()` 를 Suspense 경계 밖에서 불렀다(`loading.tsx` 자신이 경계의 fallback 자리). **개발 서버는 이 검사를 하지 않아 앞선 개발자의 실측에서는 드러나지 않았다**(빌드를 못 돌리고 끊김). 수정: `PlanSkeleton` 을 `<Suspense fallback={<PlanSkeletonView month=이번 달/>}>` + `PlanSkeletonFromUrl`(훅) + `PlanSkeletonView`(그림)로 나눔 — 실제 요청에서는 훅이 주소의 `?month=` 를 바로 읽어 fallback 은 쓰이지 않음. 시험 1건(경계 안에서만 호출·호출 지점 1곳). 재빌드 rc=0, `/plan` 은 `ƒ`(동적)로 남음. 시험 갭 1건: 요약 칸 로딩 틀 `mb-0.5` 는 변이로 확인했을 때 시험이 못 잡아 고정 시험을 추가(변이 M8).
- [11:58] **자리표시 상수 표(세 폭, 근거 = QA3 단어 50 상태 `getBoundingClientRect`, 개발 서버; 운영 빌드의 `main` scrollHeight 도 같음; 자리표시 첫 프레임 = 최종 블록)**

| 화면 | 블록 | 360 | 390 | 412 | 근거 |
|---|---|---|---|---|---|
| 오늘 | 단어 카드(준비) | 305 | 285.5 | 285.5 | 폭 370 미만이 한 줄 더 감김(`min-[370px]`) |
| 오늘 | 오늘의 회화 카드(시작) | 253.6 | 253.6 | 253.6 | 폭 무관 |
| 오늘 | AI 평가 카드(시작) | 217.1 | 199.1 | 199.1 | 폭 362 미만(`min-[362px]`) |
| 오늘 | 카드 사이 / 앱바 | 18 / 52 | 18 / 52 | 18 / 52 | 실제 `section.mt-[18px]` |
| 계획표 | 챌린지 카드 자리(챌린지 없음) | 278.4 | 278.4 | 278.4 | 전에는 172 |
| 계획표 | 달력 구간 자리표시 → 최종(기록이 있는 달) | 576 → 576 | 552 → 552 | 552 → 552 | 최종 − 자리표시 = 153.5 = 「아직 이번 달 공부 기록이 없어요」 안내 상자(141.5) + 위 간격 12 → 기록 없는 계정에서만 생김 |
| 계획표 | 「분석 · 성장 기록」 카드 | 115 | 115 | 95.5 | 정적 부품 그대로(점프 없음) |

- [11:58] **변경 전/후 비교(QA3 단어 50, 개발 서버 같은 조건, 칸마다 표본 4(REPEAT=2), 왕복 150ms = slow, 지연 없음 = none)** — 점프 = 첫 화면(뷰포트 안) 블록의 위치 이동 최댓값. 보이는 「불러오는 중」 프레임·가짜 CTA(자리표시 첫 프레임의 눌리는 버튼)는 변경 후 전부 0.

| 탭 | 폭 | 상태 수 전→후 | 점프 px 전→후 | 마지막 블록 높이 변화 전→후 | CLS 전→후 | 안정까지 ms(slow) 전→후 |
|---|---|---|---|---|---|---|
| 오늘 | 360 | 3~4 → 2 | 402.6 → 0 | 225 / 177.6 / 141.1 → 0 / 0 / 0 | 0.236~0.316 → 0 | 665 → 698 |
| 오늘 | 390 | 3~4 → 2 | 383.1 → 0 | 205.5 / 177.6 / 123.1 → 0 / 0 / 0 | 0.197~0.284 → 0 | 666 → 699 |
| 오늘 | 412 | 3~4 → 2 | 383.1 → 0 | 205.5 / 177.6 / 123.1 → 0 / 0 / 0 | 0.187~0.277 → 0 | 666 → 699 |
| 계획표 | 360 | 2~3 → 2~3 | 106.4 → 0 | 106.4 / 151.5 / 0 → 0 / 153.5(뷰포트 밖) / 0 | 0.073 → 0 | 399 → 403 |
| 계획표 | 390 | 2~3 → 2~3 | 106.4 → 0 | 같음 | 0.07~0.17 → 0 | 402 → 405 |
| 계획표 | 412 | 2~3 → 2~3 | 106.4 → 0 | 같음 | 0.07~0.17 → 0 | 406 → 405 |

  - 오늘 후 상태 2 = 「서버 loading 자리표시 → 클라이언트 겹친 자리표시(같은 부품·같은 위치라 상태 서명이 같음)」 → 「한 번에 공개된 최종 화면」. 서버 `loading.tsx` 에서 클라이언트로 넘어갈 때 모양이 바뀌지 않는다(`t3-cap` 의 서버 틀 합계 높이 774.2 = 285.5+18+253.6+18+199.1 = 오버레이 합).
  - 계획표 상태 3(slow)은 챌린지 카드가 먼저 오는 구간(높이 278.4 그대로)과 달력이 오는 구간이라 위치 이동은 없다. 아래 153.5 는 기록 없는 계정의 안내 상자 도착 때만(`MonthNoteBlock`, 뷰포트 밖 868 — 세 폭 모두 접힌 부분 아래).
  - 안정까지 시간이 오늘에서 +33ms 늘었다 = 네 곳의 요청이 모두 끝난 뒤 한 번에 보이므로(최대값이지 합이 아님). 지연 없음(none) 조건은 개발 서버에서 135~432ms 로 흩어졌는데 가장 느린 요청(`lessons/today`) 응답 시간이 바뀌는 것이다.
  - **운영 빌드(`next start`, 변경 후만)**: 오늘 상태 2·점프 0·CLS 0·보이는 「불러오는 중」 0, 안정 49~66ms(none)·632~649ms(slow) / 계획표 점프 0·CLS 0·안정 32ms(none, 자리표시 없이 바로 최종)·516ms(slow). 운영 빌드의 변경 전 기준선은 따로 재지 않았다.
- [11:58] **단어 0개 상태(QA3 시드 전)** — 변경 후 오늘: 점프 **45.5px(360폭 65px)** = 단어 카드가 「단어장이 비어 있어요」 상태일 때 240 으로 자리표시(285.5/305)보다 작음(변경 전 337.6). 자리표시는 단어가 있는 흔한 상태를 따랐다 — 첫 사용자만. 완료 기준의 ≤8px 를 이 상태에서는 못 맞춘다(Leader 결정 필요: 그대로 둠 / 자리표시를 240 으로 줄이고 단어가 있는 쪽을 +45.5 로 둠). 계획표는 단어 상태와 무관(점프 0).
- [11:58] **상한·실패·하위 경로 확인(390폭, 오늘 탭, 요청 하나를 지연)** — 상한: `lessons/today` 2000ms 지연 → 36ms 서버 자리표시 → 350ms 겹친 자리표시 → **1851ms 에 공개**(상한 1500ms + 진입 시간, 단어·평가 카드는 도착한 상태, 회화 카드는 몸통 자리표시) → 2387ms 응답 도착 때 위쪽 블록 이동 0(아래 접힌 구간에 조건부 카드 하나 추가). 실패(600ms 뒤 500): `lessons/today`·`evaluations`·`challenges/today`·`words/categories` **네 곳 모두 나머지를 막지 않고 공개**됨(오류 카드/띠 하나만 그 자리에 생김: 회화·단어·평가 실패는 해당 카드가 133.5 오류 카드로 바뀌어 아래가 올라오고, 챌린지 실패는 맨 위 63px 띠 + 아래 +75). 이 실패 경로의 위치 이동은 오류 표시가 도착하는 한 번뿐.
- [11:58] **실행 증빙** — `src/components/**` 단위 시험 **978/978 통과**(T3 새 시험 23건: todayHold 4·todaySkeleton 12·planSkeleton 7, 이번에 +2) · `tsc --noEmit` rc=0 · 변경 파일 38개 eslint rc=0 · `next build` rc=0(1차 rc=1 → 수정 후 2차 rc=0, 경고 3건은 기존 `persona/loader`·`claudeCli` 추적 경고로 이번 변경과 무관) · 보이지 않는 문자 0건 · **변이 14건 모두 시험이 잡음**(격리 복사본 `mutB` 에서만; 원복 뒤 `diff -rq` 동일): M1 상한 1500→3000 · M2 공개 조건에서 챌린지 빠짐 · M3 회화 카드 높이 253.6→250 · M4 `inert` 제거 · M5 자리표시 `absolute` 제거 · M6 공개 뒤 `setShown(false)` 추가 · M7 챌린지 카드 278.4→172 · **M8 요약 칸 `mb-0.5`→`mb-1`(처음에는 못 잡아 시험 추가 후 잡음)** · M9 자리표시에서 성장 기록 카드 제거 · M10 월 이동 줄 `inert` 제거 · M11 `study/today/loading.tsx` 추가 · M12 `plan/loading.tsx` 추가 · M13 `Suspense` 제거 · M14 `useSearchParams` 를 경계 밖으로.
- [11:58] **가이드와 달라진 점** — ① 자리표시를 `loading.tsx` 만이 아니라 `TodayHome` 안에서 진짜 카드 위에 겹쳐(`absolute`) 그리고 진짜 카드는 `invisible`+`inert`+`aria-hidden` 로 제자리에 먼저 마운트(요청 수·시점 불변, 스크롤 좌표 불변). ② 오늘은 요청 4곳이 끝난 뒤 한 번에 보이고 상한 1500ms(회화 탭 목록의 `LIST_HOLD_CAP_MS` 와 같은 값). ③ 계획표 `PlanSkeleton` 의 `Suspense` 분리(위 결함).
- [11:58] **알려진 한계** — (1) 단어 0개 상태 오늘 탭 점프 45.5/65px(위). (2) 기록이 없는 달: 안내 상자 도착 때 아래 구간이 +153.5(접힌 부분 아래라 첫 화면은 안 움직임, 기록이 있는 계정은 0 — 기록 있는 계정은 QA 계정에 없어 실측 못 함 [가능성 높음]). (3) 진행 중·내일 시작·끝남 챌린지 카드 높이는 만들지 못해 NOT_VERIFIED(자리표시는 챌린지 없음 상태 278.4). (4) 챌린지 요청이 실패하면 63px 띠가 공개 때 위에 생겨 아래가 +75. (5) 오늘 탭의 조건부 섹션(챌린지 띠·복습 카드·「곧 열려요」·통계·보관 세트)은 자리표시에 넣지 않음 — 있으면 위·아래로 한 번에 나타남(공개 프레임과 같음). (6) 자정·월 경계(위 f).
- [11:58] **NOT_VERIFIED** — 실기기(S25+ WebView) 체감 · 운영 빌드의 변경 전 기준선 · 챌린지 진행 중 계정의 계획표/오늘 높이 · 기록이 있는 달의 계획표 최종 높이 · 월 경계 밤의 자리표시 달 · 단어가 일부(1~49개)만 있는 계정의 단어 카드 높이(분류가 둘 이상이면 285.5 보다 큼 — 코드 주석).
- [11:58] **정리** — 개발 서버 3064·3065·운영 빌드 서버 3064 종료(포트 비움), 쿠키 파일·미러 루트의 임시 스크립트 삭제, 측정 부산물은 세션 scratchpad 에만(`jump-*.json`·`t3-*.mjs`). 홈 미러 `~/.node-local/thekaiwa-t046-t3`(+기준선 `-t3base`)는 남겨 둠. 운영(3010)·`db push`·`seed.ts`·실사용자 데이터 접촉 0.
- [11:58] **체크포인트(T3 종료)** — 완료: 구현 점검 a~h · 결함 1건 수정(빌드 Suspense) · 시험/변이/빌드 · 실측(전·후, 세 폭, 상한·실패·하위 경로·복귀·접근성). 남은 일: Reviewer(재실행 대상: `todayHold`·`todaySkeleton`·`planSkeleton` 시험 23건, 변이 스크립트 scratchpad `mut3.py`·`mut13.py`, 측정 `t3-jump.mjs`·`t3-cap.mjs`·`t3-heights.mjs`), 필요 시 Leader 결정 — 단어 0개 상태 45.5px 처리. 다음 첫 행동: Leader 가 diff 확인 후 경로 지정 커밋(이동 2 + 신규 + 수정, `(tab)` 폴더·`__tests__` 포함). 미커밋 파일: 위 「변경 파일」 전부(T2/T2b 변경분과 같은 작업 트리에 섞여 있으니 경로로 나눌 것).

## Reviewer 기록 (REV-171 — task-046 B단계 `d4065cc`, base `cb95612`)

> reviewer(sonnet) · 읽기 전용 · 불변 스냅샷(`git archive d4065cc`, 홈 밖 scratchpad + `cp -al node_modules`)에서 감사 · 소스·시험·설정 수정 0 · native_change: **false**(`android/`·`plugins/`·`capacitor.config.ts`·Manifest 변경 0 — 변경은 `src/**` 32개(시험 제외) + 시험 6 + `tests/live/p3-qa-ui/flicker/` 11 = 49개)

### 판정: CONDITIONAL_PASS (Critical 0 · High 0 · Medium 1 · Low 7)

산식으로는 PASS(Critical 0·High ≤1)이지만, Medium M-1 이 **이 task 의 완료 기준(탭 이동에서 보이는 내용이 바뀌지 않는다)을 채팅방 뒤로가기·시나리오 진입 경로에서 어긴다**고 판단해 한 단계 낮췄다. Developer 수정이 작고(자리표시 한 컴포넌트) 서버·데이터 영향이 없으므로 수정 후 **좁은 재감사(M-1 만)** 를 권한다. Leader 가 수용한다면 QA 가 아래 high_risk_areas 1번을 실측해도 된다.

### 직접 실행(스냅샷) — 개발자 보고와 일치
| 항목 | 결과 |
|---|---|
| `src/components/**` 단위 시험(`DATABASE_URL` 더미) | **978/978 통과**, rc=0 (보고 978/978 일치) |
| `npx tsc --noEmit` | rc=0 |
| 변경 src 파일 eslint | rc=0, 출력 0 |
| `next build > 파일; echo $?` | rc=0, `/plan`·`/study/ai`·`/study/today`·`/drawer/words` 모두 `ƒ`(동적) — `loading.tsx` 의 `todayKst()` 는 요청 시 계산(빌드 시각 고정 아님) |
| 보이지 않는 문자 diff 검사 | 0건 |
| 데모 게이트 `check.mjs check --task` | `DEMO_GATE_PASSED`(not_required, judge DM-light-waive) · `evidence.jsonl` 에 task-046 줄 0 = 대리 승인 흔적 없음 |
| React 19.2.8 `inert={false}` | 속성이 제거됨(렌더로 확인) · `inert` 참이면 `inert=""` |

### 영역별 판정
| 영역 | 판정 | 요지 |
|---|---|---|
| A-① 회화 탭 상태기계 | **PASS** | 카드는 `!listSettled` 동안, 목록은 `!cardSettled && !capElapsed` 동안만 hold. 목록이 영영 안 와도(요청 무한 대기) 목록은 원래도 자리/로딩이었고 카드만 그만큼 숨는다 — 동일 조건에서 이전엔 카드만 보였을 뿐 화면은 어차피 미완성. 오류 상자는 `items === null && error` 로 hold 에 가려지지 않고, `retryFailHoldMs` 지연 경로에서 `onSettled` 가 **`setError` 와 같은 타이머 콜백**에서 불려 오류 상자 표시 시점과 일치(코드로 확인). `retryAt` 이 성공 뒤에도 남지만 `max(0, …)` 라 이후 가시성 복귀 실패에 500ms 이상 영향 없음. |
| A-② 오늘 탭 공개 | **PASS** | 네 신호 모두 `.then/.catch` 로 성공·실패에서 loading 을 벗어난다(`loadState` ready/error, `lessonToday` ready/error, `challenge` ready/error, `EvalHomeCard` ready/error). 응답 무한 대기여도 `TODAY_HOLD_MS` 1500ms 로 풀린다. |
| A-③ 되돌아감 | **PASS** | `shown` 은 `setShown(true)` 뿐(`setShown(false)` 없음, 시험도 고정). `tick`·`lessonTick`·`reloadKey`·가시성 복귀는 `shown` 을 건드리지 않고 카드 안 몸통 자리표시만 쓴다. 화면 이탈 뒤 복귀는 재마운트라 상태가 새로 시작(정상). |
| A-④ 정리·StrictMode·렌더 중 setState | **PASS** | 상한 타이머 둘(`TalkChatPanel`, `TodayHome`)과 `TabBar` 8초 타이머 모두 cleanup 있음, 이중 마운트에서 타이머 재설정만. 렌더 중 `setSeenPath/setPressed`·`setShown(true)` 는 자기 컴포넌트 상태·조건이 단조(한 번 참이면 끝, 경로가 같으면 불발)라 무한 루프·"다른 컴포넌트 갱신" 경고 경로 없음. 훅은 모두 조기 return 앞. |
| A-⑤ `ChatList` kind 변경 | **PASS_WITH_NOTES** | `items` 를 비우지 않는 동작은 기준선(`cb95612`)도 동일 — 두 갈래가 같은 자리 Fragment 라 재사용. 이번 hold 는 `listSettled` 이후 false 라 새 상호작용 없음. L-3 로 기록. |
| B 접근성 | **PASS_WITH_NOTES** | `aria-current` 는 실제 경로로만, 눌림은 `data-pending`+모양만(적절). `invisible`+`aria-hidden`+`inert` 는 공개 때 셋 모두 해제(렌더로 확인). 펄스 애니메이션 없음(정적 블록) → `prefers-reduced-motion` 문제 없음. L-2: `aria-busy` 래퍼 안의 유일한 `role=status`·계획표 2개. |
| C-① loading 범위·구조 | **PASS** | `(tab)` 그룹에 `page.tsx`+`loading.tsx`, 하위 경로는 형제 폴더라 안 감싼다. 이동한 page 는 내용 불변(rename 100%), `layout`/`error` 는 상위에 그대로. 시험이 `study/ai`·`study/today`·`plan`·`drawer` 직하 `loading.tsx` 부재를 고정. |
| C-② `useSearchParams`·Suspense | **PASS** | 신규 사용처는 `PlanSkeletonFromUrl` 하나, Suspense 안(시험 고정). `next build` rc=0 로 확인. |
| C-③ 요청 수·시점·권한·서버 | **PASS_WITH_NOTES** | `apiGet/apiPost/fetch` 신설 0(diff grep), 서버·API·권한·DB 변경 0, `prefetch` 문자열 0. 한 가지 이동: 단어장 `loading.tsx` 안 `DisplayToggles` 가 `ensureLoaded()` 로 `/api/v1/settings/profile` GET 한 번을 **로딩 단계로 앞당긴다** — 전역 저장소가 단일 비행이라 중복 요청은 없고 개발자 보고(한계 6)와 일치. 읽기 전용. |
| C-④ 스크롤 규칙 | **PASS** | 신규 `scrollIntoView`·`scrollTo`·`key` 변경 0(`key={i}`·`key={month}` 는 자리표시 안 정적 목록·기존 달 격자). 오늘 홈은 자리표시를 `absolute` 로 겹치고 진짜 카드를 `invisible` 로 **제자리 마운트**해 `display:none` 이 아니므로 기존 `scrollIntoView` 좌표가 유지됨(시험이 `display:none`·`hidden=`·`h-0 overflow-hidden` 금지를 고정). `relative` 래퍼 추가됨. |
| C-⑤ 하이드레이션 | **PASS** | `todayKst()` 는 서버 `loading.tsx` 에서만 호출, `PlanSkeleton` 은 prop 으로만 받음(`new Date` 없음). `TodayHome` 첫 렌더 상태는 서버·클라이언트가 같다. |
| C-⑥ 교차 import | **PASS_WITH_NOTES** | `challenge/ChallengePlanCard → plan/planSkeleton.ts`(상수만, 순환 없음)·`eval/EvalHomeCard → vocab/TodaySkeleton`·`app/**/loading.tsx → @/modules/infra/dates`(선례: `plan/(tab)/page.tsx`·`plan/challenge/new/page.tsx` 가 같은 import)는 컴포넌트 폴더 간 선례(`eval → vocab/format` 등)와 같고 엔진명·`@/modules/*` 직접 import 없음. L-1·L-6 기록. |
| D 시험의 질 | **PASS_WITH_NOTES** | 순수 함수(`todayRevealed`(네 신호 각각 단독 미완료·전부 미완료·상한 지남; 16조합 전수는 아님)·`shouldHoldList/Card`(4조합 중 단조성 포함)·`tabPress`)는 경계를 덮는다. 상수↔클래스 고정은 일부만 의미 있음: 카드 틀 클래스를 `common/ui.tsx` 에서 읽어 대조하는 시험은 **실제를 고정**하지만, `TODAY_CARD_H`/`cardHeightVars` deepEqual 은 **상수 자기 확인**(실측 정합성은 시험이 아니라 QA 실측이 담보). 상태기계 배선은 소스 정규식 시험뿐. 변이 4건 재현 결과 아래. |
| E 문구·규칙 | **PASS** | 새 화면 문구는 「불러오고 있어요」 한 줄(해요체, 「세요」 0), 엔진명·모델명 0, 새 「AI」 0(기존 「AI 평가」·「AI와 공부하기」 제목만). 비밀 값·쿠키·운영 주소 쓰기: `tests/live/.../flicker/*.mjs` 는 쿠키를 **인자 파일**로 받고 BASE 기본이 `127.0.0.1:306x`(운영 3010 아님). 삭제는 `t3-rows.mts --delete-words` 하나(L-5). |
| F 문서 후속 | 위치 지목 | 아래 「Leader 문서 후속」. |

### 발견
| ID | 심각도 | 위치 | 근거 | 권고 |
|---|---|---|---|---|
| **M-1** | **Medium** | `src/components/chat/StudyAiSkeleton.tsx:25-37`(서버 `study/ai/(tab)/loading.tsx` 가 그림) | `loading.tsx` 는 `searchParams` 를 읽을 수 없는데 자리표시가 **회화 탭을 하드코딩**: `Segmented value="talk"`(렌더 확인: 「회화」 `aria-checked="true"`), 버튼 「＋ 새 회화」, 섹션 머리 `TALK_HOME.section`. `/study/ai?tab=chat`·`?tab=scenario` 로 **새 세그먼트 진입**하는 경로 — 채팅방 뒤로가기(`ChatRoomHeader.tsx:51`, `ChatRoom.tsx:136,162`, `ChatReview.tsx:401,410`, `TurnNotice.tsx:34`), 채팅 삭제 뒤 `ChatMenuSheet.tsx:88`, 시나리오 저장 뒤 `SCENARIO_HOME_HREF`(`scenarioCopy.ts:10`) — 에서는 서버 응답 전 자리표시가 틀린 탭(회화 선택)을 그렸다가 응답 뒤 채팅/시나리오로 바뀐다. 기준선(loading 없음)에는 없던 **새 깜빡임**이고 이 task 가 겨냥한 현상 그 자체다. 개발자의 실측(T2)은 「채팅 목록→채팅방」과 `router.replace` 분절 전환만 있어 이 방향을 재지 않았다. [가능성 높음 — 코드·SSR 렌더로 확인, 보이는 길이는 왕복 시간에 달려 브라우저 실측은 NOT_VERIFIED] | `PlanSkeleton` 이 이미 쓴 패턴(`useSearchParams` + Suspense, fallback=talk)으로 `tab` 을 읽어 `value`·버튼 라벨·섹션 머리를 정하고, `tab=scenario` 는 세그먼트만(버튼·목록 자리표시 없이) 그리거나 목록 영역을 비운다. 시험: 렌더로 `?tab=chat` 일 때 「채팅」 선택·「＋ 새 채팅」·섹션 「채팅」, `?tab=scenario` 일 때 목록 자리표시 없음. |
| L-1 | Low | `shell/TabSkeleton.tsx`↔`tabSkeleton.ts`, `vocab/TodaySkeleton.tsx`↔`todaySkeleton.ts`, `plan/PlanSkeleton.tsx`↔`planSkeleton.ts` | 확장자만 다르고 **대소문자만 다른 짝** 3쌍. 대소문자를 구분하지 않는 파일 시스템(macOS 체크아웃)에서 `./PlanSkeleton` 이 먼저 시도하는 `.ts` 로 `planSkeleton.ts` 에 해석될 수 있다(우분투·CI 는 무관). | 상수 파일을 `*Metrics.ts`/`*.consts.ts` 등 다른 이름으로. |
| L-2 | Low | `shell/TabSkeleton.tsx:SkeletonRegion` | `aria-busy="true"` 래퍼 **안**에 이 화면의 유일한 `role="status"`. busy 동안 변경 알림을 미루는 보조기기에서 「불러오고 있어요」 가 읽히지 않을 수 있다. 계획표 자리표시는 `role="status"` 2개(챌린지 카드 + 요약 줄, 기존 부품) — 서버 자리표시→클라이언트 자리표시로 재마운트될 때 같은 문구가 되풀이될 수 있다. | `role="status"` 를 `aria-busy` 래퍼 밖 형제로. 계획표는 한 곳만 읽히게. |
| L-3 | Low (기존) | `chat/ChatList.tsx` `kind` 변경 효과 | `kind` 가 바뀌어도 `items` 를 비우지 않아 새 응답 전까지 이전 종류 줄이 **새 종류의 `basePath` 링크**로 보인다. 기준선도 같고 T2b 가 고지. 이번 변경의 회귀 아님. | 별도 개선 후보(렌더 중 조정으로 `kind` 바뀔 때 `items` 초기화). |
| L-4 | Low | 시험 전반 | 상태기계 배선은 **소스 정규식 시험**이라 같은 호출 수를 유지한 의미 오류를 못 잡는다. **변이 재현 M2**: `ChatList` 의 재시도 실패 유예 경로에서 `settledRef.current?.()` 를 타이머 **앞**으로 옮겨(호출 3곳 유지) 카드가 오류 상자보다 먼저 나오게 해도 `listHold.test.ts` 9/9 통과. 렌더·가짜 타이머 시험이 없다. | 렌더 시험 도구가 없으면 최소한 `ChatList` 의 유예 분기를 순수 함수로 빼 단위 시험. 실측(QA)이 담보한다는 점을 이력서에 명시. |
| L-5 | Low | `tests/live/p3-qa-ui/flicker/t3-rows.mts` | `--delete-words` 가 `wordEntry.deleteMany`. 가드는 있음(`qa-bot3@thekaiwa.test` + `provider==='test'`)이지만 개발·운영이 같은 NAS DB 이고 인자 한 개로 삭제가 되는 스크립트가 저장소에 남는다. | 현 가드 유지 + 파일 머리에 「운영 DB 와 같은 DB — 실행 전 DATABASE_URL 확인」 한 줄. 그대로 둬도 무방. |
| L-6 | Low | `chat/StudyAiSkeleton.tsx:15`·`vocab/WordsSkeleton.tsx:19` | 서버 `loading.tsx` 가 가져오는 자리표시가 **화면 모듈 전체**(`StudyAiHome`·`WordsScreen`)를 import 해 상수(`STUDY_AI_TABS`·`WORD_SORT_OPTIONS`)만 쓴다. 로딩 화면이 담아야 할 클라이언트 묶음이 불필요하게 커질 수 있다(동작 영향 없음, 같은 묶음이 곧 필요함). | 상수를 가벼운 모듈로 분리. M-1 수정 때 함께. |
| L-7 | Low (NOT_VERIFIED) | `plan/planSkeleton.ts` `challengeCardH: 278.4`, `ChallengePlanCard` | 「챌린지 없음」 상태 실측값. 진행 중·내일 시작·끝남 카드는 미실측(개발자 고지). 오늘 탭에는 「가장 흔한 상태 = 데이터 있는 상태」 정책을 썼는데 계획표 챌린지 자리는 **없는 상태**를 따랐다. 기준선(172)보다는 맞을 가능성이 높아 회귀는 아님. | QA 가 진행 중 챌린지 계정으로 점프를 재서 정책 일관성을 판단. |

### 변이 재현(스냅샷 복사본만, 원본 복구 확인)
| # | 변이 | 결과 |
|---|---|---|
| M1 | `todayRevealed` 에서 챌린지 신호를 무시(`|| true`) | `todayHold.test.ts` **fail 1** — 잡음 |
| M2 | `ChatList` 재시도 실패 유예 경로에서 `onSettled` 를 타이머 앞으로(호출 수 3 유지) | `listHold.test.ts` **9/9 통과 — 놓침**(L-4) |
| M3 | `TodayHome` 의 `inert={!shown}` → `inert={false}` | `todaySkeleton.test.ts` **fail 1** — 잡음 |
| M4 | `PRESS_TIMEOUT_MS` 8000 → 80000 | `tabPress.test.ts` **fail 1** — 잡음 |
개발자 보고 변이(T2 10·T2b 11·T3 14)는 표본만 재현했고 M2 가 놓친 것은 변이 문구가 아니라 **의미 오류에 대한 정규식 시험의 한계**다.

### light 트랙 점검 (Reviewer 지침)
judge 가 `track: light`(파일 12개 이하·신규 화면 없음)로 접수했으나 실제 변경은 **49개 파일**(src 32 + 시험 6 + 측정 스크립트 11), 로딩 화면 4개 신설·라우트 그룹 3개 구조 변경이다. 지침상 **「light 승격 필요」** 로 Leader 에 알린다(FAIL 아님). 이력서 `roles_involved` 에 qa 가 이미 있고 qa-046-base 도 돌았으므로 QA 단계는 살아 있다. 남는 것은 **데모 게이트 면제(DM-light-waive) 유지 여부** — 「오늘 탭은 최대 1.5초 동안 자리표시만 보이다 한 번에 공개」·「회화 탭 카드·목록 동시 공개」 는 사용자가 제안한 「빈 데이터로 먼저 그리고 채우기」와 다른 동작이라 Leader 가 사용자에게 한 줄 확인했는지 이력서에 남기길 권한다.

### QA 에 넘길 high_risk_areas
1. **`/study/ai?tab=chat`·`?tab=scenario` 신규 진입**(채팅방 ← 뒤로, 채팅 삭제 후, 시나리오 저장 후) — 자리표시가 틀린 탭을 그리는지(M-1), 세 폭 360/390/412, 왕복 150ms 스로틀.
2. **계획표 · 진행 중 챌린지 계정** — 자리표시 278.4 대비 점프(L-7), 오늘 탭 챌린지 띠(조건부 섹션)가 공개 순간 본문을 미는 양.
3. **회화 탭 상한 경로** — 카드 응답 ≥1500ms·목록 오류·[다시 시도] 실패 연타에서 카드·오류 상자 순서(L-4 M2 가 시험으로 못 잡는 영역).
4. **오늘 탭 상한(1500ms)** — 4요청 중 1개 지연/실패 때 공개 시점과 카드 안 몸통 자리표시 높이, 평가 카드 `role=status` 중복.
5. **TabBar 눌림** — 이동이 막히는 경우(오프라인·무응답) 8초까지 눌린 모양이 남는 것, 수정키 클릭, 활성 탭 재누름, 빠른 연타.
6. **스크린리더**(실기기 TalkBack) — 자리표시의 「불러오고 있어요」 낭독 여부(L-2), `inert` 구간.
7. **단어 0개 계정의 오늘 탭 점프 45.5px(360폭 65px)** — Leader 결정으로 알려진 한계(재론 안 함, 기록만).
8. 운영 번들 `next start` 에서 `loading.tsx` prefetch 동작·실기기 체감(개발 서버 측정은 보조).

### NOT_VERIFIED
브라우저 실측 전부(점프 px·프레임·타이밍 — 이 감사에서 서버를 띄우지 않음) · M-1 이 보이는 실제 길이 · 실기기 WebView 체감 · 보조기기 낭독 · 운영 빌드의 prefetch 동작 · 진행 중 챌린지 계정 높이.

### Leader 문서 후속(위치만)
- `docs/screens.md` §2(네비게이션·하단 탭)에 「탭 누름 즉시 반응 — `aria-current` 는 경로 변경 후, 눌림은 `data-pending`+모양」, §3-3(회화 상태 관리, 472행)에 「카드·목록 동시 공개 + 상한 1500ms」, §5-3(오늘 상태 관리, 1707행)에 「4신호 공개 규칙·`invisible`+`inert` 제자리 마운트·상한 1500ms」, §4-3(단어장 상태, 1048행)에 「`catPending` 분류 칩 자리」, 그리고 공통 규칙으로 「화면 로딩 = 정적 자리표시(글자·가짜 빈 상태·가짜 CTA 금지), 높이는 `getBoundingClientRect` 실측 상수+상수↔클래스 시험, `loading.tsx` 는 `(tab)` 라우트 그룹에」 한 절.
- **낡은 문구**: `docs/screens.md` 735행(공통 문구 「불러오는 중…」), 1376행(오늘 단어 카드 `loading` = 머리줄 + 「불러오는 중…」), 6140행(오늘의 회화 `#home-loading`), 6427행 근처 — 이제 카드 로딩은 몸통 자리표시다.
- `CLAUDE.md` 디렉토리 구조의 `(app)/{study/{ai,today},plan,drawer,…}` 에 `(tab)` 그룹(주소 불변)과 `loading.tsx` 위치 한 줄.

### 요약 카운트
Critical 0 · High 0 · Medium 1 · Low 7 · native_change false · 재순환: M-1 수정(Developer) → Reviewer(좁은 재감사) → QA

## Developer 기록 (REV-171 수정 — M-1·L-1·L-2·L-4·L-6)

> developer(신규 소환, sonnet) · 대상: 로컬 커밋 `d4065cc` 위의 작업 트리(커밋·push 하지 않음) · 미러 `~/.node-local/thekaiwa-t046-fix1` · native_change: **false**(`android/`·`plugins/`·`capacitor.config.ts`·Manifest·서버 API·prisma 변경 0)
> 범위 밖 항목: L-3(기존 동작)·L-5·L-7(기록만) — 손대지 않음.

### 변경 파일 (21개 = 이름 변경 3쌍 + 수정 15 + 신규 3)
- 이름 변경(`git mv`, 인덱스에 올라 있음): `shell/tabSkeleton.ts`→`tabSkeletonSizes.ts` · `vocab/todaySkeleton.ts`→`todaySkeletonSizes.ts` · `plan/planSkeleton.ts`→`planSkeletonSizes.ts`
- 수정: `src/app/(app)/study/ai/(tab)/page.tsx`(탭 판정을 `parseStudyAiTab` 로 — 동작 불변) · `challenge/ChallengePlanCard.tsx`(import 경로 + 로딩 분기 알림 제거) · `chat/{ChatList.tsx,StudyAiHome.tsx,StudyAiSkeleton.tsx,listHold.ts}` · `shell/TabSkeleton.tsx` · `vocab/{TodaySkeleton.tsx,WordsScreen.tsx,WordsSkeleton.tsx,labels.ts}` · 시험 `chat/__tests__/listHold.test.ts`·`shell/__tests__/tabSkeleton.test.ts`·`vocab/__tests__/todaySkeleton.test.ts`·`plan/__tests__/planSkeleton.test.ts`
- 신규: `chat/studyAiTabs.ts` · `chat/__tests__/studyAiSkeleton.test.ts` · `tests/live/p3-qa-ui/flicker/t4-tabparam.mjs`(측정, 읽기 전용)

### 항목별 조치
- **M-1** `StudyAiSkeleton` 이 주소의 `?tab=` 을 읽는다: `PlanSkeleton` 과 같은 방식으로 `useSearchParams` 를 Suspense 안 클라이언트 부품(`StudyAiSkeletonFromUrl`)에서 읽고 fallback 은 회화 모양. 판정은 서버 `page.tsx` 와 **같은 함수** `parseStudyAiTab`(`chat`·`scenario` 외 모두 회화; 같은 이름이 여러 번이면 서버 `searchParams` 처럼 배열이라 회화 — 자리표시는 `getAll('tab')` 으로 같은 모양을 만든다). 탭별 문구(`＋ 새 회화`/`＋ 새 채팅`, 섹션 머리 `회화`/`채팅`)도 한 곳(`studyAiTabs.ts`)에서 화면·`ChatList`·자리표시가 함께 읽는다. 시나리오는 탭줄만 그리고 목록 자리표시·버튼은 없다(알림 한 줄만).
- **L-1** 상수 모듈 3개 이름을 `*Sizes.ts` 로 바꾸고 import·시험·주석을 맞췄다. 옛 이름 참조 grep(`src tests docs`) 0건. 이력서·vault 안의 옛 이름은 수정하지 않았다(기록 보존).
- **L-2** `SkeletonRegion`: 알림(`role=status`)을 `aria-busy` 래퍼 **밖 형제**로(`aria-busy`+`aria-hidden` 은 보이는 블록 래퍼에 — 옛 측정 스크립트의 `[aria-busy]` 탐지 호환). 계획표: `ChallengePlanCard` 로딩 분기의 `role=status`(「챌린지를 불러오는 중…」)를 없애고 aria-hidden 블록으로 — 자리표시 전체 알림은 달력 한 곳. 오늘 탭: 공개 전 알림은 `TodayCardsSkeleton` 한 곳이고 진짜 카드 묶음은 `aria-hidden`+`inert`(시험으로 고정). 시험으로 개수 고정: 채팅·단어·오늘 자리표시 각 1, 계획표 1, 시나리오 자리표시 1.
- **L-4** `listHold.ts` 에 `settleFirstFailure(holdMs, {showError, settle}, schedule)` — 오류 상자와 「첫 결과 정해짐」 알림이 **한 호출에서 이 순서로**, 유예가 있으면 둘 다 유예 뒤. `ChatList` 의 실패 처리가 이 함수에 위임한다(동작 불변: 오류 상자가 보이는 시점 = settled 시점). 가짜 타이머 시험 3건 + `ChatList` 연결 확인(실패 경로의 `settledRef` 는 `settle` 콜백 안 한 곳뿐).
- **L-6** `STUDY_AI_TABS`→`chat/studyAiTabs.ts`, `WORD_SORT_OPTIONS`→`vocab/labels.ts`(순수 라벨 표 — 새 파일을 만들지 않고 기존 라벨 모듈에 둠). 화면과 자리표시 모두 거기서 import, `StudyAiHome`/`WordsScreen` 은 더 이상 상수를 내보내지 않는다.

### 실측 — `/study/ai?tab=…` 새 진입 (개발 서버, QA 계정 1, 읽기 전용, 왕복 150ms + 300kbps, 클라이언트 라우터 이동, 두 서버 같은 방법)
변경 전 = 미러 `thekaiwa-t046-t3`(`d4065cc` 코드, :3066) · 변경 후 = fix1 미러(:3067). 서버 `loading.tsx` 자리표시는 탭줄 묶음이 `inert` 인 구간으로 가려냈다(목록 자리표시는 진짜 화면 `ChatList` 도 그리므로 기준이 아님). 프레임 약 17ms.

| 폭 | 주소 | 변경 전: 서버 자리표시 (선택/버튼/섹션) → 도착 후 | 변경 후: 서버 자리표시 → 도착 후 | 탭 모양이 바뀐 프레임 (전→후) |
|---|---|---|---|---|
| 360 | `?tab=chat` | 회화/＋ 새 회화/회화 (18프레임) → 채팅/＋ 새 채팅/채팅 | 채팅/＋ 새 채팅/채팅 (19프레임) → 같음 | 1 → **0** |
| 360 | `?tab=scenario` | 회화/＋ 새 회화/회화 (18) → 시나리오/＋ 내 상황 만들기 | 시나리오/버튼 없음/섹션 없음 (18) → 시나리오 (버튼·섹션이 **붙기만** 함) | 1 → **0**(추가 1) |
| 390 | `?tab=chat` | 회화…(18) → 채팅… | 채팅…(19) → 같음 | 1 → **0** |
| 390 | `?tab=scenario` | 회화…(19) → 시나리오… | 시나리오(18) → 시나리오 | 1 → **0**(추가 1) |
| 412 | `?tab=chat` | 회화…(18) → 채팅… | 채팅…(18) → 같음 | 1 → **0** |
| 412 | `?tab=scenario` | 회화…(18) → 시나리오… | 시나리오(18) → 시나리오 | 1 → **0**(추가 1) |
| 360/390/412 | `?tab=talk` · 주소 `tab` 없음 · `?tab=zzz` | 회화/＋ 새 회화/회화 → 같음 | 같음 | 0 → 0 |

- 탭줄 위치(`segDelta`)는 전·후 모두 0(62px 고정). 목록 첫 줄 top 이 자리표시 214.5 → 도착 466.5(+252)로 움직이는 것은 이 QA 계정에 「채택을 기다리는 교정」 카드가 있어 도착 때 위에 끼는 높이이며 전·후 동일(카드는 있을 때만 생기는 섹션이라 자리표시에 넣지 않는 것이 T2b 의 의도).
- 변경 전 결함은 세 폭 모두 재현됨(약 18프레임≈0.3초 동안 틀린 탭 모양) — 리뷰 M-1 확인.
- `ScenarioHome` 자체 로딩: `Skeleton heights={[88,88,88]}` + sr-only `HOME.loadingSr`(「상황을 불러오는 중…」). 보이는 「불러오는 중」 글자는 아니다(보고만, 이번 범위에서 안 바꿈).
- 로그: `scratchpad/fix1/t4-before.log`·`t4-after.log`.

### 실행 증빙
| 항목 | 결과 |
|---|---|
| `src/components/**` 단위 시험 (`DATABASE_URL` 더미, `node --import tsx --test`) | **993/993 통과**(기준 978 + 신규 15), rc=0 |
| 영향 시험 5개 파일(구현 직후) | 50/50 통과 |
| `npx tsc --noEmit` | rc=0 |
| 변경 파일 `eslint` (측정 스크립트 포함) | 0 error·0 warning |
| `next build > 파일; echo $?` | rc=0, `/plan`·`/study/ai`·`/study/today`·`/drawer/words` 동적(ƒ). 경고 3건은 기존(persona loader·spawn 추적) — 이번 변경과 무관 |
| 보이지 않는 문자 (diff·신규 파일) | 0건 |
| 엔진명/모델명/새 「AI」 (신규·변경 화면 문구) | 0건(식별자 `STUDY_AI_TABS` 등 코드 이름만) |

### 변이 (별도 복사본, 원복 후 `diff -rq` = 0) — 9/9 잡힘
| # | 변이 | 결과 |
|---|---|---|
| 1 | 자리표시가 `?tab=` 을 읽지 않음(항상 회화) | studyAiSkeleton 3건 fail |
| 2 | 시나리오 자리표시에도 새 버튼 | 1건 fail |
| 3 | 알림을 `aria-busy` 래퍼 안으로 되돌림 | tabSkeleton 2건 fail |
| 4 | 계획표 챌린지 카드 알림 복원(알림 2개) | planSkeleton 1건 fail |
| 5 | **L-4 M2-a**: `settleFirstFailure` 에서 `settle` 을 유예보다 먼저 | listHold **동작 시험** 1건 fail(가짜 타이머) |
| 6 | **L-4 M2-b**: `ChatList` 에서 알림 직접 호출을 유예 앞으로 | `ChatList` 연결 확인 1건 fail |
| 7 | **L-4 M2-c**: `settle` 콜백을 비우고 직접 호출로 이동(정규식 개수는 그대로) | `ChatList` 연결 확인 1건 fail(콜백 몸통 모양 고정으로 잡음) |
| 8 | L-1: `TodaySkeleton` 이 옛 이름 `tabSkeleton` 을 import | 모듈 없음으로 시험 파일 fail |
| 9 | L-6: `WordsSkeleton` 이 다시 `./WordsScreen` import | tabSkeleton 시험 1건 fail |

### 가이드와 달라진 점 · 알려진 한계 · NOT_VERIFIED
- **변경 파일 21개** — 가이드 상한 14개를 넘었다. 원인: 이름 변경 3쌍의 import 갱신 + M-1 의 공용 판정 모듈·서버 `page.tsx`(같은 함수 사용) + 시험 5개. 로직이 큰 파일은 `ChatList`·`StudyAiSkeleton` 둘뿐이고 나머지는 import·한두 줄이다.
- 가이드에 없던 파일을 건드렸다(필요한 최소): `ChallengePlanCard.tsx`(L-1 import 경로 + L-2 알림 제거 — `challenge/` 는 허용 목록 밖), `src/app/.../study/ai/(tab)/page.tsx`(판정을 공용 함수로 — 동작 불변). `challenge/challengeCopy.ts` 의 `cardLoading` 문구는 이제 쓰이지 않는 죽은 문구가 됐다(허용 밖 파일이라 남김 — 후속 정리 후보).
- **L-4 의 한계(정직하게)**: 순서 보장은 순수 함수 `settleFirstFailure` 의 **동작 시험**(변이 5)으로 잡히지만, `ChatList` 가 그 함수에 콜백을 제대로 연결했는지는 렌더 도구(jsdom 등)가 없어 **소스 모양 확인**(변이 6·7)이 담보한다. 컴포넌트 렌더 시험은 이 저장소에 없다.
- **L-2 의 미해결**: 오늘 탭에서 공개 **뒤** 상한(1.5초) 초과로 몇몇 카드가 아직 로딩 중이면 카드별 `CardLoadingBody` 알림이 카드마다 하나씩(최대 3) 읽힌다 — 변경 전(카드마다 「불러오는 중…」 `role=status`)과 같은 수라 회귀는 아니고, 하나로 합치려면 `TodayHome` 공개 로직·`TodayLessonCard`·`EvalHomeCard` 를 건드려야 해 이번 범위(공개 로직 수정 금지)에서 하지 않았다.
- 서버 자리표시는 클라이언트 이동에서 개발 서버·느린 회선(300kbps)일 때 약 0.3초 보였다. 빠른 회선·운영 번들에서는 더 짧거나 보이지 않을 수 있다(NOT_VERIFIED: 운영 `next start` 에서의 노출 시간, 실기기 WebView, 하드 로드 `?tab=chat` 의 자리표시 노출).
- 같은 URL 에서 분절을 눌러 탭을 바꾸는 경우(`router.replace`)는 이번에 재지 않았다.
- 서버·자식 프로세스 종료, 쿠키·임시 `.env` 사본 삭제 완료. 운영 서버·DB 쓰기·`db push`·`seed.ts` 없음(QA 계정 세션 발급만 — 기존 계정 upsert).

### 체크포인트
- 완료: M-1·L-1·L-2·L-4·L-6 + 실측·변이·빌드. 남은 일: Reviewer 좁은 재감사(M-1) → QA. 다음 첫 행동: Leader 가 `git add -A src tests/live/p3-qa-ui/flicker/t4-tabparam.mjs` 경로로 커밋(이름 변경 3쌍은 이미 인덱스에 올라 있음).
- 미커밋 파일: 위 「변경 파일」 21개 + (vault) 이 기록·일지.

## Reviewer 기록 (REV-172 — REV-171 수정 재감사, 로컬 커밋 `1be738e` vs `d4065cc`)

> reviewer(신규 소환, sonnet) · 읽기 전용 좁은 재감사 · 불변 스냅샷(`git archive 1be738e` → scratchpad + `cp -al node_modules`)에서 확인 · 소스·시험·설정 수정 0(변이는 스냅샷 안에서만, 원복 후 `diff -rq pristine snap` 동일 확인) · native_change: **false**(`android/`·`plugins/`·`capacitor.config.ts`·Manifest·`prisma/`·`src/app/api`·`src/modules` 변경 0 — 변경 21개 = `src/components` 19(이름 변경 3쌍 포함) + 서버 `page.tsx` 1 + `tests/live/.../t4-tabparam.mjs` 1)

### 판정: PASS (Critical 0 · High 0 · Medium 0 · Low 3 신규 + 참고 2) — **M-1 해소됨**

REV-171 의 M-1·L-1·L-2·L-4·L-6 은 모두 코드와 직접 실행으로 확인했다. 새로 찾은 것은 시험이 지키지 못하는 자리(Low)뿐이고 동작 결함은 없다. QA 로 넘겨도 된다.

### 직접 실행(스냅샷) — 개발자 보고와 일치
| 항목 | 결과 |
|---|---|
| `src/components/**` 단위 시험(`DATABASE_URL` 더미) | **993/993 통과**, fail 0, rc=0 (보고 993/993 일치) |
| `npx tsc --noEmit` | rc=0 |
| 변경 파일 eslint(`d4065cc..1be738e` 의 .ts·.tsx·.mjs 전부) | rc=0, 출력 0 |
| `next build > 파일; echo $?` | rc=0. `/study/ai`·`/study/today`·`/plan`·`/drawer/words` 모두 `ƒ`(동적). 경고 3건은 기존(동적 파일 시스템 추적 — persona loader·spawn)이고 이번 변경 무관. `useSearchParams` 정적 검사 오류 없음 |
| `git diff d4065cc 1be738e` 보이지 않는 문자 | 0건 |
| 네이티브·서버 API·DB 변경 | 0건 (`src/app` 에서는 `(tab)/page.tsx` 한 줄 — 아래 6) |
| 데모 게이트 `check.mjs check --task` | `DEMO_GATE_PASSED`(not_required, judge DM-light-waive), `evidence.jsonl` 의 task-046 줄 0 = 대리 승인 흔적 없음 |

### 항목별 판정
| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | **M-1 해소** | **PASS** | `StudyAiSkeleton.tsx` — `useSearchParams` 를 Suspense **안** 클라이언트 부품 `StudyAiSkeletonFromUrl` 에서 읽고(`sp.getAll('tab')` → 한 번이면 문자열·여러 번이면 배열) 서버 `study/ai/(tab)/page.tsx` 와 **같은 함수** `parseStudyAiTab`(`studyAiTabs.ts`)으로 판정. 서버 page 의 옛 인라인 판정(`tab === 'chat' ? … : 'talk'`)과 새 함수는 의미가 같다(배열은 둘 다 회화). 새 버튼 문구·섹션 머리는 `newButtonLabel`/`listSectionTitle`(상수는 `studyAiTabs.ts` 한 곳)을 화면(`StudyAiHome`→`TalkChatPanel`)·`ChatList`·자리표시가 함께 읽는다. 시나리오는 분절 컨트롤(`inert`)과 `SkeletonRegion{null}` 알림 한 줄만 그려 `ScenarioHome`(그 자체로 버튼·소개·자체 로딩 `Skeleton heights=[88,88,88]`)과 겹치지 않는다. Suspense fallback 은 회화 모양. `next build` rc=0. 하이드레이션: 첫 렌더에 시계·랜덤·브라우저 값 없음, 동적 라우트라 서버도 요청의 `searchParams` 를 읽는다(서버 렌더 `tab=talk|chat|scenario` 렌더로 확인). 변이 N1(`get` 으로 되돌림)·N6(공유 함수 드리프트)·N5(서버 page 드리프트) 모두 시험이 잡음. |
| 2 | **L-1 이름 변경** | **PASS** | `tabSkeletonSizes.ts`·`todaySkeletonSizes.ts`·`planSkeletonSizes.ts`. 옛 경로·옛 이름 참조 `src tests docs scripts` grep **0건**. `git ls-tree` 로 확장자 뗀 이름의 대소문자 쌍을 전수 확인하면 이번 3쌍은 사라졌다. **남은 쌍 1개는 기존**: `vocab/TopicSetStart.tsx` ↔ `vocab/topicSetStart.ts`(기준 `cb95612` 에도 있음, task-046 범위 밖 — 참고 R-2). |
| 3 | **L-2 알림** | **PASS_WITH_NOTES** | `SkeletonRegion` 은 `<div><p role=status class=sr-only/><div aria-busy aria-hidden>…</div></div>` — 알림이 `aria-busy` 래퍼 **밖 형제**. 렌더로 센 `role="status"`(자리표시 한 화면, 낭독 가능 기준): 회화·채팅·시나리오 서버 자리표시 **1**, 단어장 자리표시 전체 **1**, 오늘 서버 자리표시 **1**, 계획표 자리표시 **1**(달력의 「2026년 10월 달력을 불러오는 중…」). 오늘 홈 클라이언트 첫 프레임(`TodayHome` 렌더): DOM 의 `role=status` 6개 중 1개가 자리표시이고 나머지(카드 몸통 3 + 토스트 + 빈 라이브 영역)는 전부 `aria-hidden="true" inert=""` 래퍼 안 — 낭독되지 않는다. 시험이 개수를 고정한다: 채팅·시나리오 자리표시 각 1, 오늘 `TodayCardsSkeleton`·`TodaySkeleton` 1, 계획표 1, `SkeletonRegion`·`ChatRowsSkeleton`·`WordRowsSkeleton` 1 + 순서(알림이 busy 보다 앞). 메모: 단어장 **페이지 전체** 개수는 시험이 아니라 내 렌더가 확인(부품 `WordRowsSkeleton` 만 시험 고정). 참고 R-1·신규 L-9 아래. |
| 4 | **L-4 `settleFirstFailure`** | **PASS** | 수정 전 `ChatList`: `holdMs<=0` 이면 `setError`→`settled` 를 같은 블록에서, 아니면 타이머 콜백 안에서 `setError`→`settled`. 새 함수 `fire()` = `showError(); settle()` 이고 `holdMs<=0` 이면 `fire()` 즉시·아니면 `schedule(fire, holdMs)` — 시점·순서·`cancelled` 보호(콜백마다 `if (!cancelled)`)·React 배치가 동일(오류 상자가 보이는 순간 = settled 알림 순간, `retryFailHoldMs` 500ms 유예 경로 포함). 동작 시험 3건(즉시·유예 500ms·음수 유예)이 가짜 타이머로 순서·타이머 수·시점을 고정. **변이 재현**: L4-a(유예 전에 `settle` 선호출)→ 동작 시험 1건 fail, L4-b(`fire` 안 순서 뒤바꿈)→ 동작 시험 3건 fail, C1(`ChatList` 의 `settle` 콜백을 비움)→ 소스 모양 시험 fail, C1b(`ChatList` 에서 직접 호출 선행, 호출 개수 유지)→ 소스 모양 시험 fail. 보고(함수 안 변이 = 동작 시험, `ChatList` 연결 변이 = 소스 모양 시험)와 일치. 소스 모양 정규식은 변수·속성 이름·순서(`showError` 다음 `settle` 이 마지막)까지 고정해 **엄격한 쪽**이고(이름만 바꾸는 리팩터링도 깨짐), 느슨해서 놓치는 경우는 찾지 못했다. 사소한 관찰: 즉시 경로에서 `holdTimer = settleFirstFailure(...)` 가 `undefined` 를 대입해 이전 유예 타이머 참조를 덮는다 — 그 타이머가 나중에 불려도 콜백이 `cancelled` 보호라 효과 없음(참고 R-3). |
| 5 | **L-6 상수 분리** | **PASS** | `STUDY_AI_TABS` → `chat/studyAiTabs.ts`(값 불변: 회화/시나리오/채팅 순), `WORD_SORT_OPTIONS` → `vocab/labels.ts`(값 불변: 최근 추가/많이 틀린/가나다순). 이 둘을 가져오는 곳은 이제 `StudyAiHome`/`WordsScreen`/자리표시이고, 자리표시·`loading.tsx`(4개) 경로에 `StudyAiHome`·`WordsScreen`·`ScenarioHome`·`TodayHome`·`PlanScreen` import 0건(`grep`). 새 상수 모듈의 import 는 `talkCopy`(import 없음)·`labels`(타입 import 만)이라 가볍다. `StudyAiHome`/`WordsScreen` 은 더 이상 상수를 내보내지 않는다(시험이 고정). |
| 6 | **회귀 없음** | **PASS** | 동작이 바뀐 곳은 위 항목뿐. `ChatList.tsx` — 실패 처리 위임 + 섹션 머리 함수 호출만(요청 수·시점·`prefetch`·스크롤 변화 없음, `key`·`scrollIntoView`·`scrollTo` 신설 0). `StudyAiHome.tsx` — 상수·문구 함수 import 로 교체(렌더 결과 동일). `ChallengePlanCard.tsx` — import 경로 + 로딩 분기에서 알림 제거(보이는 모양 동일: 알림은 `sr-only` 였음). `WordsScreen.tsx` — 상수 이동. `(tab)/page.tsx` — 판정을 공용 함수로(의미 동일). `git diff` 의 `apiGet/apiPost/fetch/prefetch/scrollIntoView/scrollTo` 신규 사용은 **시험의 가짜 라우터 객체와 측정 스크립트 안 `scrollTop` 읽기뿐**(앱 코드 0). 문구: 사용자에게 새로 보이는 글자 없음(탭별 문구는 기존 값). `challenge/challengeCopy.ts` 의 `cardLoading`(「챌린지를 불러오는 중…」)은 더 쓰이지 않는 죽은 문구가 됨 — 기록만(수정 안 함). `t4-tabparam.mjs`: 쿠키는 인자 파일, BASE 기본 `127.0.0.1:3067`, GET 이동만(쓰기·삭제 없음). |
| 7 | **직접 실행** | **PASS** | 위 「직접 실행」 표. 보고와 모두 일치. 서버를 띄우는 실측은 하지 않음(QA 몫). |

### 새로 찾은 것
| ID | 심각도 | 위치 | 근거 | 권고 |
|---|---|---|---|---|
| L-8 | Low | `chat/__tests__/studyAiSkeleton.test.ts`, `ChatList.tsx`, `StudyAiHome.tsx` | M-1 의 불변식(「자리표시와 진짜 화면이 같은 문구·머리 상수를 읽는다」)은 코드 구조로만 유지되고, **진짜 화면 쪽**을 고정하는 시험이 없다. 변이 N3(`ChatList` 섹션 머리를 `talk ? TALK_HOME.section : '채팅 목록'` 으로 되돌림)·N4(`StudyAiHome` 버튼 문구를 `'＋ 새 대화'` 로 되돌림) 둘 다 **993/993 그대로 통과**. 나중에 누군가 화면 쪽만 문구를 바꾸면 자리표시 → 화면 전환 때 글자가 바뀌는 M-1 류 깜빡임이 조용히 되살아난다. 시험은 자리표시 쪽 문구만 고정한다. | `studyAiSkeleton.test.ts` 에 소스 모양 두 줄: `ChatList.tsx` 가 `listSectionTitle(` 을, `StudyAiHome.tsx` 의 `TalkChatPanel` 이 `newButtonLabel(tab)` 을 쓰는지. 급하지 않음(QA 전에 안 해도 됨). |
| L-9 | Low (접근성, 좁은 경우) | `challenge/ChallengePlanCard.tsx` 로딩 분기, `plan/PlanScreen.tsx:169` | L-2 의 권고대로 알림을 달력 한 곳으로 모은 결과, **달력 요청이 먼저 끝나고 챌린지 요청이 늦는** 구간(실제 화면 `PlanScreen`)에서는 챌린지 자리의 회색 블록이 `aria-hidden` 이라 보조기기에는 로딩 알림이 전혀 없다(수정 전엔 카드마다 「챌린지를 불러오는 중…」). 보이는 화면 변화는 없고 낭독만 비는 구간이다. 개발자가 의도한 교환(`서버→클라이언트 자리표시 되풀이 방지`)의 비용. | 현 상태 수용 가능. QA 가 TalkBack 으로 계획표 진입 때 낭독이 비는 구간이 거슬리는지만 확인. 거슬리면 `PlanScreen` 쪽에서 챌린지가 로딩이고 달력이 끝났을 때만 알림 한 줄을 내는 방식을 검토(범위 밖). |
| L-10 | Low (시험 공백, 실영향 없음) | `StudyAiSkeleton.tsx` Suspense fallback | fallback 의 `tab="talk"` 은 시험이 고정하지 않는다(변이 N2: `tab="chat"` 으로 바꿔도 993/993 통과). 동적 라우트라 fallback 은 실제로 쓰이지 않아(빌드 rc=0·동적 확인) 영향은 없다. | 필요하면 한 줄 소스 모양 시험. 선택. |

### 참고(이슈 아님)
- **R-1** 오늘 홈: 상한(1.5초) 뒤 일부 카드가 아직 로딩이면 공개 후 카드마다 「불러오고 있어요」가 최대 3개 낭독된다 — 수정 전과 같은 수이며 개발자가 이미 고지했다(첫 프레임 렌더로 확인: 카드 몸통 3 + 자리표시 1).
- **R-2** 대소문자만 다른 기존 쌍 `vocab/TopicSetStart.tsx`/`vocab/topicSetStart.ts`(task-045 이전부터) — 이번 task 범위 밖, 같은 L-1 부류. 대소문자 비구분 파일 시스템 체크아웃을 쓰게 될 때 후속 후보.
- **R-3** `ChatList` 효과 안 `holdTimer = settleFirstFailure(...)` 의 덮어쓰기 — 효과 없음(위 4), 정리 시 `?? holdTimer` 한 줄로 막을 수 있음.

### 변이 재현(스냅샷 복사본만, 마지막에 `diff -rq pristine/src snap/src`·`tests` = 동일 확인) — 10건
| # | 변이 | 결과 |
|---|---|---|
| L4-a | `settleFirstFailure` 가 유예 전에 `settle` 선호출 | 동작 시험 fail 1 — 잡음 |
| L4-b | `fire` 안 순서를 `settle`→`showError` | 동작 시험 fail 3 — 잡음 |
| C1 | `ChatList` 의 `settle` 콜백을 비움 | 소스 모양 시험 fail 1 — 잡음 |
| C1b | `ChatList` 에서 `settledRef` 직접 호출을 `settleFirstFailure` 앞에 둠 | 소스 모양 시험 fail 1 — 잡음 |
| N1 | 자리표시가 `sp.get('tab')` 사용(배열 판정 소실) | fail 2(렌더 시험 + 소스 모양) — 잡음 |
| N5 | 서버 `page.tsx` 가 `parseStudyAiTab(Array.isArray(tab) ? tab[0] : tab)` | fail 1(소스 모양) — 잡음 |
| N6 | 공유 함수 `parseStudyAiTab` 가 배열 첫 값을 받음 | fail 2 — 잡음 |
| N2 | Suspense fallback `tab="talk"`→`"chat"` | 993/993 통과 — **놓침**(L-10) |
| N3 | `ChatList` 섹션 머리 문구 하드코딩 드리프트 | 993/993 통과 — **놓침**(L-8) |
| N4 | `StudyAiHome` 새 버튼 문구 하드코딩 드리프트 | 993/993 통과 — **놓침**(L-8) |
(소환 한도 지침의 변이 5~7건보다 많이 돌렸으나 시험 1회가 약 15초라 한도에는 영향 없음.)

### QA 에 넘길 high_risk_areas (REV-171 목록 갱신)
1. **`/study/ai?tab=chat`·`?tab=scenario`·`?tab=talk`·없음·`?tab=zzz`·`tab=chat&tab=talk` 새 진입** — 클라이언트 이동(채팅방 뒤로, 채팅 삭제 뒤, 시나리오 저장 뒤)과 **주소창 하드 로드** 둘 다, **운영 번들 `next start`** 에서 자리표시의 선택 탭·버튼·섹션 머리가 도착 후와 같은지(개발 서버 실측만 있고 운영 번들의 prefetch 된 `loading.tsx` 안 `useSearchParams` 동작은 미검증), 360/390/412.
2. **시나리오 자리표시 → `ScenarioHome`**: 탭줄 위치 불변·아래로 붙기만 하는지, 낭독이 「불러오고 있어요」→「상황을 불러오는 중…」 두 번 나오는 것이 거슬리는지.
3. **회화 탭 실패 경로**: `/api/v1/chats` 실패 + [다시 시도] 직후 재실패 연타에서 오류 상자와 교정 카드 공개가 같은 순간인지(L-4), 그리고 목록이 늦을 때 카드가 먼저 나오지 않는지.
4. **계획표**: 달력 응답이 먼저·챌린지 응답이 늦는 구간의 TalkBack 낭독 공백(L-9), 진행 중 챌린지 계정의 높이 점프(REV-171 L-7 이월).
5. 오늘 탭 상한(1500ms) 경계 — 느린 카드 3개 동시 낭독(R-1), 단어 0개 계정 점프 45.5px(Leader 결정, 기록만).
6. TabBar 눌림(오프라인·무응답·연타·수정키)·운영 번들 prefetch·실기기 WebView 체감 — REV-171 high_risk 5·8 이월.

### NOT_VERIFIED
브라우저 실측 전부(자리표시 프레임·점프 px·타이밍 — 개발자의 150ms+300kbps 개발 서버 실측을 재현하지 않음) · 운영 번들(`next start`)에서 prefetch 된 `loading.tsx` 의 `useSearchParams` 가 이동 대상 주소를 읽는지 · 주소창 하드 로드의 첫 페인트 · 실기기 WebView 체감 · TalkBack 낭독 · `TodayHome`/`PlanScreen` 의 응답 지연 조합(서버 미기동).

### 요약 카운트
Critical 0 · High 0 · Medium 0 · Low 3(L-8·L-9·L-10) + 참고 3 · native_change false · 재순환: 없음(Low 는 선택 보완) → **QA**

## QA 기록 (qa-046-a — 오늘·단어장 운영 빌드 실측)

> 2026-10-08 12:5x~ · qa(신규 소환, sonnet) · 대상 `1be738e`(REV-172 PASS) · **운영 빌드 `next start` 127.0.0.1:3070**(미러 `~/.node-local/thekaiwa-t046-qa`, `APP_ENV=LOCAL`, `CLAUDE_CLI_PATH=/bin/false` → LLM 불가) · 소스 수정 0 · 운영(3010)·`db push`·`seed.ts` 접촉 0.
> 재현 조건: Google Chrome(headless) · `isMobile+hasTouch` · DSF 2.625 · ko-KR · Asia/Seoul · 폭×높이 360×740 / 390×844 / 412×892 · 네트워크 두 조건 = 지연 없음 / 왕복 150ms·다운 1.6Mbps·업 750kbps(`Network.emulateNetworkConditions`, 웜업 뒤에 켬) · 애니메이션 끄지 않음 · 개발 표시 숨김(운영 빌드엔 없음) · 웜업: 5개 탭 한 번씩 + 5개 주소 직접 한 번씩(JS 캐시) 뒤 측정, 각 묶음 첫 표본 버림(표본 3개/묶음) · 측정 도구는 scratchpad `qa046a/qa046a-{jump,report,cap}.mjs`(기존 `t3-jump.mjs`/`t3-cap.mjs` 복사본 — 도착 탭 선택·주소 직접 진입·가짜 빈 상태 프레임·API 요청 수 추가) · 허용 범위: 첫 화면 점프 ≤ 8px, 보이는 「불러오는 중」·가짜 CTA·가짜 빈 상태 프레임 0.
> 지표 정의: ① 상태 수 = 탭 누름(또는 주소 입력) 뒤 target 경로에서 서로 다른 시각 상태(경로·자리표시 여부·블록 위치/높이·불러오는중 문구·글자 해시) ② 첫→최종 점프 = 첫 target 프레임과 최종 프레임의 공통 블록 중 뷰포트 안 블록의 |Δtop| 최대 ③ 마지막 블록 Δh ④ CLS(`hadRecentInput` 포함 전체) ⑤ 보이는 「불러오는 중」·자리표시 첫 프레임의 눌리는 버튼(오늘·이전 달·다음 달 제외)·자리표시 중 가짜 빈 상태 문구(`비어 있어요`/`아직 …없어요`) 프레임 수 ⑥ 중간 모양 = 상태 수가 2(자리표시→최종)를 넘는지.

### A1. 오늘 탭 — 단어 0개 계정(QA 2, 읽기 전용 화면 이동) · 운영 빌드 · 판정: **PASS(승인된 알려진 한계 값과 일치)**
원 출력: scratchpad `qa046a/a1-today-qa2.json`·`a1-summary.md`·`a1-run.log`(세션 종료 시 사라짐 — `BASE=…:3070 TARGET=오늘 node qa046a-jump.mjs <out> 2=<쿠키>` 로 재생성).

| 폭 | 네트워크 | 진입(회화→오늘 / 질문→오늘 / 주소 직접) | 상태 수 | 마지막 상태 시각 ms | 첫→최종 점프 px | CLS | 「불러오는 중」·가짜 CTA·가짜 빈 상태 프레임 | 요청 수 |
|---|---|---|---|---|---|---|---|---|
| 360 | 없음 | 셋 다 | 2 | 48–65 / 48–49 / 82–86 | **65** | 0 | 0·0·0 | 7 / 7 / 8 |
| 360 | 150ms | 셋 다 | 2 | 632 / 649 / 821–830 | **65** | 0 | 0·0·0 | 7 / 7 / 8 |
| 390 | 없음 | 셋 다 | 2 | 48–49 / 49 / 83–102 | **45.5** | 0 | 0·0·0 | 7 / 7 / 8 |
| 390 | 150ms | 셋 다 | 2 | 633–649 / 632–649 / 820–823 | **45.5** | 0 | 0·0·0 | 7 / 7 / 8 |
| 412 | 없음 | 셋 다 | 2 | 48–49 / 48–49 / 76–85 | **45.5** | 0 | 0·0·0 | 7 / 7 / 8 |
| 412 | 150ms | 셋 다 | 2 | 649 / 632–649 / 825–831 | **45.5** | 0 | 0·0·0 | 7 / 7 / 8 |

- 상태 순서(전 표본 동일): `자리표시(서버 loading 과 클라이언트 겹침이 같은 모양, 블록 [62,285.5][365.5,253.6][637.1,199.1] @390)` → `최종 한 번에 공개([62,240][320,253.6][591.6,199.1][808.8,190.6])`. **중간 모양 0**(상태 수 3 이상 없음), 주소 직접 진입에서도 서버 `loading.tsx` 자리표시 → 하이드레이션 → 공개 사이 모양 변화 없음(첫 프레임이 이미 자리표시 3/3).
- 점프 45.5px(360폭 65px) = Leader 승인 「알려진 한계」 값과 **정확히 일치**(단어 카드가 「단어장이 비어 있어요」 상태일 때 240 ↔ 자리표시 285.5/305; 아래 두 카드가 위로 올라옴). 이 값 말고 새 점프·중간 모양은 없음. 합격선 ≤ 8px 와는 다르다(승인된 예외 — Leader 가 보고에서 기록). 마지막 블록 Δh(−8.5/360폭 +11)는 최종에 자리표시에 없는 4번째 블록(정체 미확인 [추측: 주제 고르기 카드], top 808.8 ≥ 뷰포트 771)이 생겨 비교 대상이 달라진 것이며 뷰포트 밖.
- **요청**: 탭 누름 진입 = 7회(`evaluations`·`challenges/today`·`words/categories`·`vocab/sessions` 2(두 번 다른 쿼리)·`vocab/stats`·`lessons/today` 각 1) — 기준선 §5 의 「7 고유 호출(개발 서버 StrictMode 로 14)」과 **개수·구성 동일**. 주소 직접 진입은 +1(`speech/tts/status` — 앱 셸 첫 마운트 때만, 탭 이동엔 없음). 요청 시점(탭 누른 뒤 첫 요청 64–68ms)은 운영 빌드 기준선이 없어 변경 전과의 **시점 비교는 NOT_VERIFIED**(개발자 주장 「요청 수·시점 불변」은 새 `apiGet/fetch` 0건 + 요청 개수 동일로만 뒷받침).
- 체크포인트(A1 종료) — 완료: A1. 남은 일: A2(QA3 시드→측정→정리→행 수 비교), A3(상한·실패 경로). 다음 첫 명령: `node qa046a-jump.mjs a2-today-qa3.json 3=cookie3` (TARGET=오늘 → 단어장). 주의점: 서버 3070(Leader 기동분) 유지, 쿠키 `qa046a/cookie{1,2,3}`(600), QA3 시작 행 수 `{"Profile":1,"UserSpeechSetting":1,"Attendance":2,"RequestTrace":1}`(WordEntry 0). 미정리: 없음(A1 은 읽기만).


## QA 기록 (qa-046-b — 계획표·탭 누름·tab 진입·회화 운영 빌드 실측)

> 2026-10-08 · qa(신규 소환, sonnet) · 대상 `1be738e`(REV-172 PASS) · **운영 빌드 `next start` 127.0.0.1:3070**(미러 `~/.node-local/thekaiwa-t046-qa`, `APP_ENV=LOCAL`, `CLAUDE_CLI_PATH=/bin/false`) · 소스 수정 0 · 운영 3010·`db push`·`seed.ts` 접촉 0 · QA 계정 1·2(필요 시 4)만, QA3 미사용, 데이터 생성/삭제 0.
> 재현 조건: Google Chrome 147.0.7727.101 headless(Playwright `playwright-core`, `isMobile+hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, 애니메이션 끄지 않음), 폭 360×740·390×844·412×892, 네트워크 ① 지연 없음 ② 왕복 150ms·다운 1.6Mbps·업 750kbps(CDP, 워밍 뒤에 켬), 개발 표시 숨김 CSS(운영 빌드엔 해당 없음). 표본: 워밍업(버림) 뒤 칸마다 3~8회. 원 출력·스크립트: 세션 scratchpad `qa046b/`(b1-*.json·b1-*.log). 사용 스크립트: 기존 `tests/live/p3-qa-ui/flicker/t3-jump.mjs`(재사용) + 새 파일 `qa046b-plan.mjs`(scratchpad; hard/month/sub — 쓰기 API 는 `route.abort` 로 막고 셈).
> 화면이 스스로 보내는 출석 체크인(`POST /api/v1/attendance/check-in`)은 `qa046b-plan.mjs` 에서 전부 abort(조건당 54~65건 차단 확인). `t3-jump.mjs` 구간은 차단 없이 화면의 기존 동작대로 둠(기준선과 동일 조건, 멱등).

### B1. 계획표 탭 + 하위 경로 새지 않음 — 판정: PASS (월 이동 자리표시 복귀는 별도 관찰 O-1)

**1) 탭 누름 진입**(t3-jump, QA1·QA2 × 3폭 × 2네트워크, 계획표 도착 표본 8/칸). 기준선(변경 전, 390): 본문 909→1166.9 **+257.9px 점프**, 상태 2~3, CLS 0.07~0.17, 「불러오는 중」 29~47ms(로컬)/212~229ms(150ms).

| 폭 | 네트워크 | 상태 수 | 안정까지 ms | 첫 화면 점프 px | 블록별 Δh (챌린지/달력/성장) | scrollH 첫→최종 | CLS | 「불러오는 중」 프레임 | 가짜 CTA(자리표시 첫 프레임 버튼) |
|---|---|---|---|---|---|---|---|---|---|
| 390 | 없음 | 1 | 31–33 | **0** | 0 / 0 / 0 | 1231→1231 | 0 | 0 | 0 |
| 390 | 150ms | 3 | 515–516 | **0** | 0 / 153.5 / 0 | 1077→1231 | 0 | 0 | 0 |
| 360 | 없음 | 1(1~2) | 32–49 | **0** | 0 / 0~153.5 / 0 | 1255(일부 1101→1255) | 0 | 0 | 0 |
| 360 | 150ms | 3 | 515–516 | **0** | 0 / 153.5 / 0 | 1101→1255 | 0 | 0 | 0 |
| 412 | 없음 | 1(1~2) | 32–49 | **0** | 0 / 0~153.5 / 0 | 1211(일부 1058→1211) | 0 | 0 | 0 |
| 412 | 150ms | 3 | 515–516 | **0** | 0 / 153.5 / 0 | 1058→1211 | 0 | 0 | 0 |

- 상태 순서(390, 150ms): 32ms 자리표시(챌린지 카드 278.4 · 달력 552 · 성장 115, 버튼 0개) → ~490ms 챌린지 카드 도착(높이 278.4 그대로, 진짜 버튼 생김) → 515ms 달력 도착(552→705.5). 첫 화면(뷰포트 안) 블록 위치 이동 0. 달력 구간 +153.5 = 「아직 이번 달 공부 기록이 없어요」 안내 상자(+12 간격) — 첫 화면 아래(알려진 한계, 값만 기록). 두 계정 같은 값.
- 오늘 탭(참고, 범위 밖): 로컬 점프 45.5(360폭 65) = 단어 0개 계정의 알려진 한계 값과 일치.

**2) 주소 직접 진입 `/plan`**(`qa046b-plan.mjs hard`, QA2, 문서 시작부터 rAF 기록, 표본 3/칸=첫 표본 버림): 6칸 모두 첫 화면 점프 **0**, 블록 Δh [0, 153.5, 0], CLS 0, 「불러오는 중」 0, 가짜 CTA 0, 첫 프레임이 이미 자리표시. 상태 수 3~5, 안정까지 로컬 45~360ms / 150ms 1458~1470ms. 중간 모양 없음: 서버 `loading.tsx` 자리표시(`inert` 월 이동) → 클라이언트 자리표시(월 이동 활성, 같은 블록 [64,278.4][360.4,552][930.4,115]) → 챌린지 카드 → 달력. (`/plan` 이 `/plan?month=2026-10` 으로 주소만 바뀌는 것은 앱의 기존 동작, 블록 불변.)

**3) 월 이동(이전·이전·다음·다음 ×2 = 8회/칸, 6칸)** — 관찰 O-1: **달력 격자가 매번 자리표시로 돌아갔다가 데이터로 바뀐다.** 150ms 조건에서 `aria-busy` 격자 10프레임(≈165ms), 로컬 1프레임; 상태 3(이전 달 화면 → 자리표시 → 새 달). 위쪽 블록(챌린지 카드·월 머리·요약)의 위치 이동 0, CLS 0, 「불러오는 중」 글자 0, 하지만 달력 구간 높이가 705.5 ↔ 552(자리표시) ↔ 607.5/622→677.5(새 달) 로 바뀌어 **달력 아래(범례·성장 카드)가 55.5~153.5px 움직인다**(달 줄 수·안내 상자 유무 차이). 근거: `git diff cb95612 1be738e -- src/components/plan/` 에 `usePlanData.ts`·월 이동 코드 변경 없음(PlanScreen 은 `GrowthSoonCard` 교체뿐) → **변경 전부터 있던 동작**이며 B단계의 회귀가 아님. 완료 기준(탭 전환 4개)에도 월 이동은 없음 → Leader 판단 항목(Low): 월 이동 시 이전 달 격자를 유지하거나 자리표시 높이를 새 달에 맞추는 후속.

**4) 하위 경로에 탭 자리표시가 새지 않음**(`qa046b-plan.mjs sub`, QA2, 4조건 {390·360·412 × 150ms, 390 × 없음} × 25 probe = 100 probe; 쓰기 API 차단): 계획표 하위 `/plan/challenges`·`/plan/challenge/new`·`/plan/challenge/[id]`(존재하지 않는 id → 앱의 오류/없음 화면) × {`/ask`에서 클라이언트 이동, `/plan`에서 클라이언트 이동, 주소 직접 진입} + 오늘 하위 `/study/today/{words/new, talk/new, talk/new/paste, eval/new, eval/history, words/[id], talk/[id], eval/[id]}` × {`/ask`에서 클라이언트 이동, 주소 직접 진입}. 기준 = 이동 시작 뒤 앱바 제목이 탭 제목(계획표·오늘의 공부)이면서 `aria-busy`/`inert` 인 프레임(탭 자리표시) 수.
  - **탭 자리표시 프레임 0 (100/100 probe)** — 단 하나의 예외 `/study/today/words/new`: 토큰 없이 열면 앱(TopicSetStart)이 스스로 `/study/today` 로 이동해 **도착한 오늘 탭의** 자리표시가 보인다(경로가 `/study/today` 가 된 뒤라 정당; 하위 경로 위에서는 0). 모든 probe 의 최종 경로·제목이 목표와 일치(오류 0).
  - 대조(탭 사이 이동): `/ask`→`/plan` 자리표시 프레임 39(150ms)/1(없음), `/ask`→`/study/today` 56(150ms)/2(없음) — 탭 사이에서는 뜬다(측정이 잡는다).
  - 안전: 차단된 쓰기 = 출석 체크인 POST 뿐(조건당 65건), 그 밖의 비-GET 요청 0.
- 체크포인트(B1 종료): 완료 B1. 남은 일 B2(누름·prefetch·`?tab=`)·B3(회화·교정 카드·목록). 다음 첫 명령: `chain2.sh` 가 B2/B3 를 직렬 실행 중(scratchpad `qa046b/chain2.out`·`chain2.done`). 주의점: 서버 3070 은 끄지 않음, 쿠키 `qa046b/cookie{1,2,4}`(권한 600, 끝나면 삭제). 미정리 행·폴더: 없음.

### A2. QA 3 단어 50개(N5 팩, `POST /api/v1/words/seed-pack` added 50) 시드 후 — 오늘 탭 + 단어장 탭 · 운영 빌드 · 판정: **PASS(관찰 Low 3건)**
원 출력: scratchpad `qa046a/a2-today-qa3.json`·`a2-words-qa3.json`·`a2-words-norm.txt`·`a2-sub-390.txt`.

**오늘 탭 (단어 있음, 3폭 × 2네트워크 × 회화→오늘/질문→오늘/주소 직접)**: 상태 수 **2**(자리표시 → 공개), 첫→최종 점프 **0px**(18칸 전부), 연속 상태 최대 이동 **0px**, CLS **0**, 「불러오는 중」·가짜 CTA·가짜 빈 상태 프레임 **0**, 첫 프레임이 자리표시 3/3. 공개 직후 카드 안 상태 재변경 없음(상태가 2개뿐이고 공개 상태 뒤 변화 없음). 안정까지: 지연 없음 48–81ms(주소 직접 69–88, 412폭 한 표본 383) · 150ms 632–650ms(주소 직접 810–836ms). 최종에 자리표시에 없던 4번째 블록(top 854.3@390 ≥ 뷰포트 771)이 공개 때 아래에 붙어 scrollH 868→1077(360폭 906→1152) — 위쪽 이동 아님. 자리표시 블록 `[62,285.5][365.5,253.6][637.1,199.1]`(360: `[62,305][385,253.6][656.6,217.1]`) = 최종 앞 세 블록과 동일(개발자 상수 표와 일치).

**단어장 탭 (단어 50개)** — 서버 자리표시가 칩·정렬·개수 3줄을 한 묶음 div 로 그려 블록 번호 정렬이 어긋나 기본 점프 지표가 84px 로 잘못 나와서(도구 한계) **블록 위치 집합 비교**(`qa046a-words-norm.mjs`)로 다시 계산:

| 폭 | 네트워크 | 진입 | 상태 수 | 목록 top 최대 이동 | 최종에 없던 위쪽 블록 위치 프레임 | 목록 높이 단계 | CLS | 「불러오는 중」·가짜 CTA·가짜 빈 상태 |
|---|---|---|---|---|---|---|---|---|
| 360/390/412 | 없음 | 회화·질문→단어장 | **1**(첫 프레임이 이미 최종 — 데이터가 한 프레임 안에 도착; 412 질문 한 표본만 2) | 0 | 0 | 3120.7 | 0 | 0·0·0 |
| 360/390/412 | 없음 | 주소 직접 | 3–4 | 0 | 0 | 626 → 3158.2 → 3120.7 | 0.001–0.002 | 0·0·0 |
| 360/390/412 | 150ms | 회화·질문→단어장 | **4** | **0** | **0** | 626 → 3120.7 | 0 | 0·0·0 |
| 360/390/412 | 150ms | 주소 직접 | 6–7(아래 L-C 의 1프레임 포함) | 0 | 0 | 626 → 3158.2 → 3120.7 | 0.002 | 0·0·0 |

- 150ms 탭 진입의 상태 4개(390폭 표본): ① 32ms 서버 `loading.tsx`(검색·칩·정렬·개수 회색/비활성 틀 + 목록 회색 626px) ② 332ms 클라이언트가 이어받아 검색·조각 칩이 활성(같은 자리) ③ 482ms 분류 칩 줄이 같은 [156,44] 자리에 「전체 50」「N5 기초 50」으로 채워짐(분류 응답) ④ 566ms 목록 3120.7px + 더 보기 줄 48px(목록 응답). 이동한 블록 0, 마지막 목록 블록만 높이 변동(허용). 요청 2(`words`·`categories`), 주소 직접은 +`settings/profile`·`text/annotate`.
- 관찰(Low, 판정 영향 없음): **L-A** 150ms 에서 상태가 4개 — 분류 칩이 목록보다 약 85ms 먼저 와서 자리 안에서 한 번 더 바뀐다(개발자 보고 「상태 2」는 도구 서명 차이; 위치 이동은 0). **L-B** 주소 직접 진입에서 `text/annotate`(후리가나) 응답이 목록을 3158.2→3120.7(−37.5px, 줄당 ≈−1.25px)로 줄여 첫 화면 아래쪽 줄이 최대 수 px 올라옴(CLS 0.002, 마지막 목록 블록 변동으로 허용 범위; 변경 전 수치 없음 — 이 변경이 만든 것인지 [추측: 기존 동작]). **L-C** 주소 직접 150ms 에서 `<main>` 은 있고 본문이 비어 있는 1프레임(≈14–17ms, `[62,0]`)이 3표본 중 390폭 3개·360폭 2개·412폭 1개에서 보인 뒤 서버 자리표시가 올라옴 — 스트리밍 HTML 조각 경계 [추측], 오늘 탭 주소 직접에서는 0건.

**하위 경로 진입에서 오늘 탭 자리표시 누출 (390폭, 150ms, 클라이언트 라우터 `window.next.router.push`, `qa046a-sub.mjs`)**: 대조군 회화→오늘은 누출 프레임 1(탐지기 작동). 오늘→평가 기록(`/study/today/eval/history`)·회화→평가 기록·오늘→평가 새로(`eval/new`)·오늘→오늘의 회화 새로(`talk/new`)·회화→문장으로 수업 만들기(`talk/new/paste`): **누출 0, 새 화면 반영 164–174ms 한 번에 전환**(상태 2개). 오늘→단어장(`?add=1`): 단어장 자신의 틀(`busy=1`)만 나오고 오늘 카드 자리표시 0; 단어장→단어장(`?add=1`, 같은 경로 쿼리만 변경): 자리표시 0·상태 3(주소 변화뿐). **NOT_VERIFIED**: 「오늘의 단어 시작 화면」 — `/study/today/words/new` 는 화면이 sessionStorage 시작 토큰을 요구하고 없으면 곧바로 `/study/today` 로 되돌아가 오늘 탭(목적지 자체) 자리표시가 나온다. 토큰을 만들려면 [시작]을 눌러 단어 세션을 생성해야 해(QA3 행 추가, 정리 도구 범위 밖) 하지 않았다. 단어장→단어 상세는 별도 라우트가 없다(`drawer/words` 아래 page·loading 뿐).

**QA 3 행 수 전·후(userId 보유 전 모델 `count`, 미러 `.env` 읽기 전용)**: 시작 전 `{"Profile":1,"UserSpeechSetting":1,"Attendance":2,"RequestTrace":1}`(WordEntry 0) → 시드 후 `{…,"WordEntry":50,…}`(다른 모델 변화 0) → 정리(`t3-rows.mts --delete-words`, 코드로 qa-bot3·provider test 한정 확인, `deleted WordEntry 50`) 후 **시작 전과 동일** `{"Profile":1,"UserSpeechSetting":1,"Attendance":2,"RequestTrace":1}`. 오늘 탭 진입이 부른 `lessons/today`·`challenges/today` 등은 QA3 에 새 행을 만들지 않았다(LLM 불가). 다른 계정·`db push`·`seed.ts` 접촉 0.
- 체크포인트(A2 종료): 완료 A2 + QA3 정리. 남은 일: 없음(A3 은 아래).

### A3. 오늘 탭 상한·실패 경로 · 운영 빌드 · QA 3(단어 50 시드 상태에서 실행) · 판정: **PASS(알려진 한계 1건 값 일치)**
원 출력: scratchpad `qa046a/a3-all.txt`(`qa046a-cap.mjs` — 회화 탭에서 오늘 탭 누름, Playwright `route`).

| 시나리오 | 폭 | 결과 |
|---|---|---|
| ⓐ `GET /api/v1/lessons/today` 2000ms 지연 | 390 | 33ms 자리표시 → **1533ms 공개**(상한 1500 + 진입 33) → 2067ms 응답 도착. 공개 전 자리표시 프레임 0 남음 없음, **공개 뒤 첫 블록 top 이동 0**, 응답 도착 때 아래에 4번째 블록만 붙음(scrollH 868→1077). 공개 때 카드는 `[62,285.5][365.5,253.6][637.1,199.1]` 그대로(회화 카드 몸통만 자리표시) |
| ⓐ 같은 시나리오 | 360 / 412 | 360: `[62,305][385,253.6][656.6,217.1]`, 공개 1533ms, 이동 0, 도착 때 scrollH 906→1152 / 412: 390과 동일, 공개 1533ms, 이동 0 |
| ⓑ `GET /api/v1/evaluations` 500(300ms 뒤) | 390 | 자리표시 → **334ms 에 오류 상태로 곧바로 공개**(평가 카드 199.1→오류 카드 133.5, [다시 시도] 버튼 1개). 위쪽 두 블록 top 이동 0(아래 블록만 −65.6). 오류 중 「불러오는 중」·가짜 CTA 0 |
| ⓑ [다시 시도] 성공(이후 통과) | 390 | 누른 뒤 57ms: 평가 카드가 몸통 자리표시 199.1(= 최종 높이)로 바뀌고 `sk`(전체 자리표시 겹침) **0 유지**, 83ms 에 최종. **전체 자리표시로 되돌아감 0**, 요청 `evaluations` 정확히 1회 추가(합 2) |
| ⓑ [다시 시도] 다시 실패 | 390 | 몸통 자리표시 199.1 → 300ms 뒤 오류 카드 133.5 로 복귀, 전체 자리표시 0, 요청 +1 |
| ⓒ `GET /api/v1/challenges/today` 500(300ms 뒤) | 390 | **333ms 에 오류 상태로 곧바로 공개**: 맨 위에 63px 오류 띠가 생겨 카드 3장이 **+75px**(285.5 카드 top 62→137) 내려감 — **개발자 보고 알려진 한계 (4) 와 값 일치**(공개 프레임에서 한 번), 공개 뒤 이동 0 |
| ⓒ [다시 시도] 성공 | 390 | 4582ms: 띠가 사라지며 카드가 **−75px** 한 번에 올라와 최종 레이아웃(중간 몸통 자리표시 없음, 전체 자리표시 0), 요청 `challenges/today` +1 |
| ⓒ [다시 시도] 다시 실패 | 390 | 눈에 보이는 변화 없음(띠 유지, 상태 추가 0), 요청 +1 |

- **요청 수**(오늘 탭 진입 1회, 운영 빌드): `evaluations` 1 · `challenges/today` 1 · `words/categories` 1 · `vocab/sessions` 2 · `vocab/stats` 1 · `lessons/today` 1 = **7** — 기준선 §5(고유 7, 개발 서버 StrictMode 14)와 같음. 재시도는 눌린 요청 하나만 +1(자동 재시도·연쇄 요청 0).
- 해석: ⓐ 상한이 약 1.5초에 풀려 자리표시가 영영 남지 않음 ✔ · ⓑⓒ 오류가 즉시 공개 ✔ · 공개 뒤 위쪽 블록 이동 0 ✔(ⓒ 만 공개 순간 +75 — 첫 화면 전체가 한 번 내려가는 점은 알려진 한계 (4) 그대로이며 챌린지 API 실패 때만) · [다시 시도] 후 전체 자리표시 복귀 0 ✔.
- 체크포인트(A3 종료): 완료 A1·A2·A3 전부. 남은 일: 최종 보고. 미정리: 쿠키 파일 3개·scratchpad 부산물(아래 정리에서 삭제).

### QA 종합 (qa-046-a)
| 항목 | 판정 | 핵심 수치 |
|---|---|---|
| A1 오늘 탭 단어 0개(QA2) | PASS | 상태 2·「불러오는 중」 0·가짜 CTA/빈 상태 0·CLS 0·중간 모양 0, 점프 45.5px(360폭 65px) = 승인된 알려진 한계 값과 일치, 요청 7 |
| A2 오늘 탭 단어 50(QA3) | PASS | 상태 2·점프 0·CLS 0 (18칸 전부), 요청 7 |
| A2 단어장 탭 단어 50(QA3) | PASS | 위쪽 블록·목록 top 이동 0, 마지막 목록 블록만 626→3120.7, CLS ≤ 0.002, 보이는 불러오는 중/가짜 CTA/빈 상태 0. 관찰 Low 3(L-A~C) |
| A2 하위 경로 누출 | PASS(5곳) · NOT_VERIFIED(오늘의 단어 시작 화면) | 누출 프레임 0, 대조군 1 |
| A3 상한·실패 | PASS | 상한 1533ms 공개·오류 즉시 공개·재시도 후 자리표시 복귀 0, 요청 수 불변 |
| QA3 행 수 | PASS | 전·후 동일 |
- 합격선(완료 기준 ≤ 8px) 대비: 오늘·단어장·계획표 외 항목에서 위반은 **단어 0개 계정(45.5/65px)** 과 **챌린지 API 실패 공개 순간(+75px)** 둘 — 둘 다 개발자가 보고한 알려진 한계이며 Leader 승인(전자) / 오류 경로 한정(후자). 계획표·회화 탭은 이번 소환 범위가 아니다.
- **NOT_VERIFIED**: ① 실기기(S25+ WebView) 체감·TalkBack 낭독 ② 오늘의 단어 시작 화면에서의 자리표시 누출(위) ③ 요청 **시점** 비교(운영 빌드 기준선 부재 — 개수·구성만 같음 확인) ④ 단어 1~49개 계정·챌린지 진행 중 계정의 오늘 탭 높이 ⑤ 월 경계 밤의 계획표 ⑥ 앱 WebView 의 prefetch 동작.
- 산출물 정리: 스크린샷 0장(찍지 않음). 프로세스 정리: 이번 소환이 띄운 프로세스 없음(브라우저는 각 스크립트가 종료) — **서버 3070 은 Leader 기동분이라 끄지 않음**. 쿠키 3개·smoke.json 삭제.

### qa-046-b · B2. 탭 누름 즉시 반응 · prefetch 불변 · `?tab=` 새 진입 — 판정: PASS (관찰 O-2·O-3 기록)
스크립트: 새 파일 `qa046b-press.mjs`(a 누름 지연·b 연타/수정키·d prefetch)·`qa046b-hang.mjs`(c 무응답 8초·수정키 합성 클릭)·`qa046b-tabparam-hard.mjs`(e 하드 로드) + 기존 `t4-tabparam.mjs`(e 클라이언트 이동) 재사용. QA2(누름·prefetch)·QA1(`?tab=`) · 운영 빌드. 원 출력 `qa046b/b2-*.json|log`.

**ⓐ 눌린 탭이 켜지는 시각**(터치 pointerdown = 0, rAF 프레임 단위, 이동 쌍 9종 × 반복: 390 은 18표본/조건, 360·412 는 9표본/조건)

| 폭 | 네트워크 | 눌린 탭 켜짐(`text-accent`) ms | `data-pending` ms | 경로·`aria-current` 변경 ms | 동시에 켜진 탭 최대 | 눌림 중 `aria-current` 가 눌린 탭으로 선행 |
|---|---|---|---|---|---|---|
| 390 | 없음 | 14–16 (중앙 16) | 14–16 | 32–35 (중앙 33) | 1 | 0/18 |
| 390 | 150ms | 16–16 | 16–16 | 33–33 | 1 | 0/18 |
| 360 | 없음 / 150ms | 15–16 / 14–16 | 15–16 / 14–16 | 32–34 / 31–33 | 1 | 0/9 |
| 412 | 없음 / 150ms | 15–16 / 16–16 | 15–16 / 16–16 | 32–35 / 33–33 | 1 | 0/9 |
- 기준선(개발 서버, 변경 전): 활성 표시 = 주소 = 내용 = 32~56ms(로컬)/181~192ms(150ms). 지금(운영 빌드): 눌린 탭은 **첫 프레임(≈16ms)** 에 켜지고, 경로·`aria-current` 는 ≈33ms 에 따라온다 — 150ms 왕복에서도 33ms 인 것은 프리패치된 `loading.tsx` 셸이 서버 응답 없이 바로 커밋되기 때문(개발 서버는 프리패치를 하지 않아 기준선과 직접 비교는 아님). `aria-current` 는 경로가 바뀐 뒤에만 옮겨졌고(눌림 중 선행 0/54), 켜진 탭은 항상 1개. 오늘 탭 이동(회화→오늘, 오늘→회화)도 같은 값.

**ⓑ 연타·재누름·수정키**(150ms)
- 회화→단어장 → 80ms 뒤 회화(A→B→A): 16ms 단어장 켜짐 → 33ms 단어장 경로 → 116ms 회화 눌림(단어장 꺼짐, 켜진 탭 1개) → 216ms 회화 경로 복귀. 최종 회화 활성·`data-pending` 없음. 회화→단어장→질문: 최종 질문 활성·눌림 없음.
- 이미 활성인 탭(질문 화면에서 질문) 다시 누름: 눌림 표시 0·모양 변화 0 프레임.
- 실제 클릭 Ctrl·Shift·가운데 버튼: 눌림 표시 0(탭 열림 팝업은 닫음). Meta+클릭은 리눅스 크롬이 같은 탭에서 이동해 기록이 사라짐 → **합성 클릭으로 대체**(앱 `onClick` 만 시험, 문서 기본 동작 차단): meta·ctrl·shift·alt·가운데(button=1) 모두 `data-pending` 없음·`text-accent` 없음, 일반 클릭만 켜짐. (`isPlainClick` 단위 시험이 같은 규칙을 고정.)

**ⓒ 서버 무응답 8초**: 단어장 문서·RSC 요청(프리패치 포함 5건)을 응답 없이 붙잡고 `/study/ai` 에서 단어장 탭을 누름 → 200ms~7.9s 내내 `data-pending=단어장`·단어장 켜짐·`aria-current`=회화(경로 `/study/ai` 유지), **8.2s 샘플에서 풀림**(`pending` 없음·회화 켜짐) → `PRESS_TIMEOUT_MS`=8000 일치(7.9s↔8.2s 사이). 풀린 뒤 단어장 재누름 → 다시 켜짐, 다른 탭(질문) 누름 → 정상 이동. 변형: RSC 요청만 abort → Next 가 하드 이동으로 대체해 단어장에 도착(기록은 문서 교체로 소실). (프리패치를 허용한 첫 시도는 셸이 즉시 커밋돼 8초 경로를 타지 않음 — 정상.)
- 관찰 O-3(참고, 기존 동작): 서버가 영영 안 답하는 인위 조건에서 눌림 표시는 풀리지만 화면이 멈춘 것을 알리는 표시(오류/재시도)는 없다. Next 기본 동작이며 B단계 범위 밖.

**ⓓ prefetch 불변**(`/ask`·`/study/ai`·`/plan`·`/drawer/words` 각각 하드 로드 후 15초 아무것도 누르지 않음, 캐시 없음): **`/api/v1/lessons/today` 호출 0/4**, 오늘 탭 전용 API(`evaluations`·`vocab/sessions`·`vocab/stats`) 호출 0. 나간 `/api/` GET 은 각 화면 자기 것뿐(회화 `corrections`·`chats`, 계획표 `plan/calendar`·`challenges/today`, 단어장 `settings/profile`·`words`·`words/categories`) + 화면의 출석 체크인 POST 1(차단). Link 뷰포트 프리패치는 RSC(`?_rsc`, `Next-Router-Prefetch`) GET 으로 하단 탭 5개·설정·화면 안 링크(계획표: `/plan/challenges`·`/plan/challenge/new`) 각 1~2건 — 오늘 탭도 RSC 만 나가고 API 는 없음. `git diff cb95612 1be738e -- src/components/shell/TabBar.tsx` 에 `prefetch` 속성 추가 없음(주석뿐).

**ⓔ `/study/ai?tab=…` 새 진입**(`chat`·`scenario`·`talk`·`zzz`·없음, + 하드 로드는 `?tab=chat&tab=talk`)
- 클라이언트 이동(`t4-tabparam.mjs`, 운영 빌드, 왕복 150ms + 300kbps, 3폭 × 5종, QA1): 서버 자리표시 구간 18프레임에서 **선택 탭·버튼 문구·섹션 머리가 도착 후와 같음 → 바뀐 프레임 0**(chat/talk/none/zzz). scenario 는 선택 탭 `시나리오` 고정에 버튼·섹션이 **붙기만**(added 1, 탭줄 위치 62 고정). 목록 첫 줄 +252 = QA1 의 「채택을 기다리는 교정」 카드 높이(세 폭 같음, 허용값). 개발 서버 측정(REV-171 수정 기록)과 일치.
- 주소창 하드 로드(`qa046b-tabparam-hard.mjs`, 문서 시작부터 rAF, 3폭 × {없음, 150ms+300kbps} × 6종 = 36칸): **첫 프레임부터 선택 탭 정확(불일치 0/36), 탭 모양이 바뀐 프레임 0**(scenario 의 changed 1 은 「추천 상황」 섹션 목록 도착, 탭 모양 변화 아님). 마지막 모양은 전 칸 도착 후와 같음. `?tab=chat&tab=talk`→회화(서버 `parseStudyAiTab` 규칙 일치).
- 관찰 O-2(Low, 하드 로드 + 느린 회선 한정): 150ms·300kbps 하드 로드에서 첫 **2~3프레임(≈40ms)은 탭줄만** 있고 [＋ 새 회화/채팅] 버튼·섹션 머리·목록 자리표시가 그 뒤에 붙는다(탭줄 top 62 고정 → 위쪽 블록 이동 0, 아래로 붙기만). 서버 `loading.tsx` 자리표시는 하드 로드에서 보이지 않음(`inert` 프레임 0). 로컬 회선에서는 첫 프레임부터 자리표시까지 완비(2상태).
- 체크포인트(B2 종료): 완료 B2. 남은 일 B3. 서버 3070 유지, 정리 전.

### qa-046-b · B3. 회화·채팅 탭 — 교정 카드·목록·상한·실패 경로, 단어장 — 판정: PASS (결함 D-1 Low 1건, 관찰 O-4)
스크립트: 기존 `t2b-card-list.mjs`(재사용, QA1=교정 카드 있음·QA2=없음) + `t3-jump.mjs` 복사본(시퀀스만 회화/단어장으로 바꾼 `qa046b-jump2.mjs`, 보고기 `qa046b-report2.mjs`) + 새 파일 `qa046b-fail.mjs`(목록 500·[다시 시도] 3회). 운영 빌드. `measure.mjs` 복사본도 한 번 돌렸으나 `innerText` 가 sr-only 「불러오고 있어요」를 「불러오는 중」으로 세고 블록을 인덱스로 비교해 거짓 점프(66px)가 나와 **판정에 쓰지 않음**(측정 도구 한계, 결과는 폐기).

**회화 탭 3폭 × 2네트워크**(표본 6/칸, 워밍 버림): 첫 화면 위쪽 블록(탭줄·[＋ 새 회화]) 점프 **0**(전 12칸), 「불러오는 중」 보이는 프레임 0, 가짜 CTA 0, 자리표시 틀: 서버 자리표시(`inert`, 32ms) → 클라이언트가 이어받음(~330ms, 버튼 활성만 — 모양 불변) → 데이터(~499ms). 로컬은 1상태·안정 32ms.
| 계정 | 네트워크 | 상태 수 | 안정 ms | 점프 | CLS | 목록 위치 이동 |
|---|---|---|---|---|---|---|
| QA1(교정 3건) | 없음 | 1 | 32–33 | 0 | 0 | 없음(첫 표본부터 최종) |
| QA1 | 150ms | 3 | 498–499 | 0 | 0.137–0.197 | 목록 top 184→436 **한 번 +252**(교정 카드 높이, 허용) |
| QA2(교정 없음) | 없음/150ms | 1 / 3 | 32 / 482–499 | 0 / 0 | 0 / 0 | 0 |
- 기준선(변경 전, 390): QA1 본문 268→623(+355)·QA2 268→371(+103), CLS 0.107~0.141 → 지금 위쪽 점프 0, QA2 CLS 0, QA1 은 카드 +252 한 번.

**카드·목록 순서**(t2b-card-list, 3폭 × 계정 2 × 진입 3{하단 탭 회화·`?tab=chat` 하드 로드·분절 전환} × 지연 4{없음·카드 300ms·목록 300ms·카드 2000ms} = **72 실행, 오류 0**):
- 「카드가 먼저」 프레임 **0/72**, 「목록이 먼저」 프레임 **0**(카드 2000ms 상한 경로 제외). 교정 있는 계정은 자리표시@184 → **카드+목록 같은 프레임**@436 로 한 번 이동(+252); 도착 시각: 지연 없음 111–135ms, 카드/목록 300ms 지연 408–437ms(= 느린 쪽 요청 끝, 합 아님).
- 상한 경로(카드 2000ms 지연): 목록이 **1600–1616ms** 에 먼저 나옴(≈1.5s + 진입 시간, 교정 있는 계정 30~31프레임) → 카드는 2137ms 에 생기며 목록 +252(허용값). 교정 없는 계정은 같은 지연에서 목록 1590–1617ms, 이동 0.
- 회화↔채팅 분절 전환(`router.replace`): 변화 프레임 0, 자리표시 0, 이동 0(전 지연 조건).

**실패 경로**(`qa046b-fail.mjs`, `/api/v1/chats` → 500, QA1, 3폭): 진입 시 오류 상자(`role=alert` + [다시 시도]) 표시, [다시 시도] 3회 모두 **자리표시가 정확히 500·500·501ms 보인 뒤 오류 상자가 돌아옴**(첫 진입 자리표시 15–22ms는 요청 전 구간). 자리표시 중 [다시 시도] 버튼 없음(연타 불가) 9/9. 재시도 중 교정 카드는 유지(자리표시@436 아래).
- **결함 D-1 (Low)**: 첫 실패에서 **카드가 오류 상자와 같은 프레임이 아니라 1프레임(16–18ms) 뒤에** 공개된다 — 390: 오류 상자 131ms(카드 없음) → 147ms 카드 생김(오류 상자가 252px 아래로 밀림); 360: 112→129ms; 412: 115→131ms. 기대(REV-171 L-4: 오류 상자와 카드가 한 순간)와 다름. 영향: 실패 경로 첫 진입에서 1프레임 점프. 재현: 교정 카드가 있는 계정으로 `/api/v1/chats` 를 500 으로 막고 하단 탭 회화를 눌러 rAF 로 [오류 상자, 카드] 프레임 기록. 원인 추정: `settleFirstFailure` 가 `showError`+`settle` 을 한 호출에서 부르지만 카드 공개(부모 상태 → `PendingCorrectionsCard` `hold` 해제)가 다음 렌더로 밀림(성공 경로는 같은 프레임 — 72/72).

**단어장 탭**(QA1·QA2, 단어 0개 — 읽기 전용이라 QA3 시드 안 씀): 로컬 1상태·점프 0·CLS 0·안정 32ms; 150ms: 상태 3~4·안정 481–500ms·「불러오는 중」 프레임 0·가짜 CTA 0, 위쪽 블록 이동: 검색 줄 0, 정렬 줄 112→114(+2)·개수 줄 156→160(+4) → **최대 4px(≤8)**, 이어 목록 상자 top 292→198(−94)·scrollH 950→771(−179) = 응답 뒤 분류 칩 줄이 접히고 빈 상자가 자리표시(626)보다 작아지는 **알려진 한계(첫 사용자 한정)**, CLS 0.017–0.085. (O-4: 개발자 보고의 「top 이동 0」은 단어 50개 계정 기준이라 단어 0개 계정과 값이 다름.)

### qa-046-b 종합 (verdict)
- B1 PASS · B2 PASS · B3 PASS(D-1 Low). Critical 0 · High 0 · Medium 0 · Low 1(D-1) · 관찰 O-1(월 이동 시 달력이 자리표시로 돌아감, 변경 전부터)·O-2(하드 로드 느린 회선 첫 ≈40ms 탭줄만)·O-3(서버 무응답 시 알림 없음, 기존)·O-4(단어 0개 단어장 −94). 오늘 탭 단어 0개 점프 45.5/65 는 승인된 알려진 한계 값과 일치.
- NOT_VERIFIED: 실기기(S25+ WebView) 체감·TalkBack 낭독(R-1·L-9) · 진행 중 챌린지 계정의 계획표/오늘 높이 · 기록이 있는 달의 계획표 · 단어가 1개 이상 있는 계정의 단어장(QA3 규칙으로 미사용) · 시나리오 자리표시 낭독 중복 · 오프라인 모드(문서 교체로 눌림 관찰 불가).
- 정리: 쿠키 파일 3개·scratchpad 측정 JSON 외 산출물 없음(스크린샷 0장), 서버 3070 은 지시대로 유지, 내 프로세스(chain/브라우저) 종료, QA 데이터 생성·삭제 0(화면의 출석 체크인 POST 는 `route.abort` 또는 t3-jump 구간에서 앱 기존 동작, 새 행 의도적 생성 0).

## 상태 로그 (이어서 — 2026-10-08 Leader)
- 구현 T2(탭 눌림·`loading.tsx`·회화·단어장) → T2b(교정 카드·목록 동시 표시) → T3(오늘·계획표; 앞선 개발자가 80회 한도에서 끊겨 T3b 가 마무리 — QA3 에 남은 시드 단어 50행 정리·`next build` 실패(`/plan` 자리표시의 `useSearchParams` Suspense) 수정). 로컬 커밋 `d4065cc`.
- **범위 초과 → standard 승격**: 변경이 49파일(src 32·시험 6·측정 스크립트 11)로 light 트랙 상한 12를 넘어 reviewer·QA 를 모두 수행했다. 데모 게이트는 **면제 유지**(화면 구조·문구·기능·API 불변, 로딩 표시만 바뀐 점이 전제) — 단 사용자의 원 제안(「빈 데이터로 먼저 그리기」)과 다른 방식(같은 높이 자리표시 + 모두 끝나면 한 번에 공개, 상한 1.5초)이라 사용자 확인 때 이 점을 알린다.
- 감사 REV-171 CONDITIONAL_PASS(Medium 1: 서버 `loading.tsx` 가 `?tab=` 을 몰라 항상 회화 모양 → 채팅/시나리오 새 진입 때 새 깜빡임) → 수정(`parseStudyAiTab` 공용, Suspense 안 클라이언트 부품) + Low 4(L-1 대소문자 파일 쌍·L-2 알림 개수·L-4 시험 보강·L-6 import) → 로컬 커밋 `1be738e` → 재감사 REV-172 PASS(Critical 0·High 0·새 Low 3은 시험 고정 빈틈).
- QA(운영 빌드 `next start`, 커밋 `1be738e`): qa-046-a(오늘·단어장) PASS, qa-046-b(계획표·탭 누름·`?tab=`·회화) PASS(Low 결함 D-1 1건 = 알려진 한계와 같은 경로).
- 문서: `docs/screens.md` §17 신설 + §5-3·§12 로딩 표기 대체 주석, 프로젝트 `CLAUDE.md` 디렉토리 구조에 `(tab)` 그룹 주석.
- **상태: done-deploy-pending** — 로컬 커밋만(미 push·미배포). 운영 배포는 사용자 확인 후.

## 최종 요약 (Leader, 사용자용)

**결과**: 하단 탭으로 화면을 옮길 때의 깜빡임(옛 화면 → 「불러오는 중」 → 가짜 빈 상태/CTA → 실제 내용으로 모양이 3~4번 바뀌며 화면이 자라던 것)을 오늘·회화·단어장·계획표 4개 탭에서 줄였습니다. 운영 빌드 실측에서 **오늘 탭(단어 있는 계정) 첫 화면 점프 383~402px → 0, 계획표 → 0, 회화 위쪽 블록 이동 0**, 「불러오는 중」·가짜 CTA 프레임 0, 누른 탭이 켜지는 시각 181~192ms → 약 16ms 입니다. DB·API·서버·네이티브·화면 구조·문구는 바꾸지 않았고 로딩 표시만 바뀌었습니다.

**원 제안과 다른 점(먼저 알립니다)**: 「불러오는 중」을 없애고 빈 데이터로 먼저 그린 뒤 채우는 방식이 아니라, **같은 높이의 회색 자리표시를 그리다가 요청이 모두 끝나면 한 번에 보여 주는 방식**입니다(최대 1.5초 기다린 뒤 도착한 것만 공개). 빈 데이터로 그리면 「단어 0개」「채팅 없음」 같은 가짜 빈 상태와 가짜 [시작] 버튼이 잠깐 보이기 때문입니다. 이 선택은 사용자 승인이 아니라 Leader 권고(B 단계)였으므로 기기에서 보신 뒤 다르게 느껴지면 알려 주세요.

**무엇이 바뀌었나**
- 하단 탭: 누른 탭이 서버 응답 전에 바로 켜집니다(스크린리더가 읽는 현재 위치는 화면이 실제로 바뀐 뒤에만 바뀝니다). `prefetch` 는 켜지 않았습니다(오늘 탭 API 가 복습 판단 잡을 만들기 때문) — 운영 빌드에서 탭을 누르지 않은 상태의 오늘 탭 API 호출 0 확인.
- 회화·단어장·오늘·계획표: 탭을 누르면 서버 응답 전에 즉시 뜨는 로딩 화면(`loading.tsx`)이 있고, 하위 화면(채팅방·오늘의 단어/회화/평가·챌린지 화면)으로 들어갈 때는 뜨지 않습니다(100/100 프로브).
- 회화: 「채택을 기다리는 교정」 카드와 목록이 같은 순간에 나타납니다(72/72). `?tab=chat`·`?tab=scenario` 로 새로 들어올 때도 자리표시가 처음부터 맞는 탭 모양입니다(감사에서 잡은 새 깜빡임 1건 수정).
- 계획표: 기존 자리표시 높이(캘린더 554·요약 172·챌린지 172)가 실제와 어긋나 있던 것을 실측으로 바로잡았습니다.

**알려진 한계(수용)**: ① 단어가 0개인 계정의 오늘 탭은 첫 화면이 45.5px(360폭 65px) 움직입니다(자리표시가 「단어가 있는 흔한 상태」 기준) ② 오늘 탭에서 챌린지 요청이 실패하면 공개 순간 오류 띠로 +75px ③ 목록 요청이 먼저 실패하고 교정 카드가 늦으면 오류 상자가 252px 밀림(드묾) ④ 하드 로드+느린 회선에서 첫 약 40ms 는 탭줄만 보임 ⑤ 계획표 **월 이동**은 달력이 자리표시로 돌아갔다가 바뀌어 아래가 55~154px 움직입니다 — 이번 변경 전부터 있던 동작이고 탭 전환 범위 밖이라 후속 후보로 남겼습니다.

**확인하지 못한 것(NOT_VERIFIED)**: 실기기(S25+ WebView)·TalkBack 낭독, 진행 중 챌린지 계정의 계획표/오늘 높이, 기록이 있는 달의 계획표, 단어 1~49개 계정의 단어장. 모든 측정은 개발/운영 빌드 로컬 서버(QA 계정)에서 했습니다.

**하지 않은 것**: 탭 전환 사이 **데이터 캐시(C 단계)** — 사용자별 열쇠·로그아웃 시 비움·무효화·「실패하면 지난 값을 유지하지 않는다」 규칙과의 충돌 검토가 필요해 이번 측정 결과를 보고 별도 결정합니다.

**검증**: 단위 시험 `src/components/**` 993/993·`tsc`·`eslint`·`next build` 통과, 변이 시험 다수(개발자 단계별 10·11·14·9건, 감사 각 10건), 감사 REV-171(CONDITIONAL_PASS→수정)·REV-172(PASS), QA 운영 빌드 실측 2갈래 PASS. QA 계정 데이터는 전후 행 수가 같도록 복구했습니다(QA3 단어 시드 50행 정리 확인).

**남은 일**: ① 사용자 확인 후 `git push`(= 운영 배포; 롤백 대상은 직전 릴리스 `20261008-082829-6896ac31`, `scripts/deploy.sh TheKaiwa --rollback`) ② 실기기 확인 ③ 월 이동 깜빡임·C 캐시는 별도 결정.

## 배포 기록 (2026-10-08 14:54 KST)
- 사용자 승인: 배포 확인 질문(원 제안과 다른 방식임을 함께 고지)에 「지금 배포」 선택.
- `git push origin main`(`cb95612..5d0d8f8`, 로컬 커밋 3개) → webhook blue/green → **릴리스 `20261008-145346-5d0d8f8d`**, `RELEASE_RESULT ok`(`migrated:false`), 헬스 200(env=PRODUCTION), pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` 모두 새 릴리스 경로에서 online. 직전 릴리스 `20261008-082829-6896ac31` 은 롤백 대상(`scripts/deploy.sh TheKaiwa --rollback`).
- 운영 읽기 전용 스모크(QA2 쿠키, 데이터 쓰기·LLM 호출 0): `/study/ai?tab=talk|chat|scenario`·`/study/today`·`/plan`·`/drawer/words`·`/ask`·`/study/today/eval/history`·`/plan/challenges` 9경로 전부 200. HTML 안의 「불러오는 중…」은 `sr-only` 낭독 문구뿐(보이는 글자 아님).
- 남음: 사용자 실기기(S25+ WebView) 확인 — 다르게 느끼면 조정. 후속 후보: 계획표 월 이동 깜빡임·C 캐시·감사 Low(L-8·L-10).
