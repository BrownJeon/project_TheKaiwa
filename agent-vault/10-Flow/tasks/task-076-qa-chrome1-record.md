---
task_id: task-076
role: qa
record: QA-076-CHROME1
status: done
verdict: PASS_WITH_OBSERVATIONS
tags:
  - type/task-record
  - domain/challenge
created: 2026-10-18
updated: 2026-10-18
---

# QA-076-CHROME1 — 챌린지 만들기 ①~④ · 계획표 챌린지 카드 헤드리스 Chrome 실검증 (1부)

> 이력서: [[task-076-improve-challenge-level-generation]] · 감사: [[task-076-reviewer-ui-record]] (high_risk_areas 1~5·7~9) · 정본 `docs/screens.md` §33 · 승인 데모 `docs/demo/task-076-challenge-level-v2.html`
> QA 서버 `127.0.0.1:3011`(APP_ENV=LOCAL), 계정 QA4 만. 코드·DB 직접 접속 0, 서버 기동·종료 0.

## 원상 복구 (시작 → 끝)

| 항목 | 시작 | 끝 |
|---|---|---|
| QA4 프로필 | `level=N5`, `goalLevel=null`, `goalTopics=null`, `goalDeadline=null`, `dailyWordCount=10` | **같은 값으로 복구, `GET` 확인 완료**(`PUT` 은 `level`·`goalLevel` 두 칸만 바꿈) |
| 진행 중 챌린지 | 없음 | 없음(`GET /challenges/today` → `challenge:null`) |
| 이번에 만든 챌린지 | — | 4건(화면 3 + API 1, 한도 20/일 중) 전부 `end` → 목록 `ENDED` 4건(N2·N2·N5·N3) |
| 프로세스 | — | 브라우저는 스크립트마다 종료, 남은 headless chrome 0, 내가 띄운 서버 0 (3011 은 Leader 것) |

## 판정 요약

Critical 0 · High 0 · Medium 0 · 이번 task 가 만든 결함 0. 관찰(OBSERVED) 6건은 아래 O1~O6(알려진 Low 확인 1·기존 부품 3·모형 한계 1·데이터 1). **실제 폰·TalkBack 은 NOT_VERIFIED**(아래).

| # | 항목 | 판정 | 근거 (측정값) |
|---|---|---|---|
| V1 | ① 주제 카드 뱃지·설명 쌍점 꼴 | **PASS** | 뱃지 「초보자 (N5)」·「초급 (N4)」 한 줄(`whitespace-nowrap` span 줄 수 1, 12조합 전부). 설명 「내 수준에 맞는 주제를 보여 드려요: 초보자 (N5) · 초급 (N4) · 중급 (N3). 챌린지 동안 매일 이 주제로 공부해요.」 — 쌍점 꼴, 괄호 겹침 `((`·`))` 0, 이름+코드 묶음 3개 모두 한 줄. 360/390/412 × 100/b130/c130 + 다크 가로 스크롤 0 |
| V2 | ③ 목표 단계 구조 | **PASS** | h2 「목표를 정해요」· `fieldset[aria-describedby]` legend h3 「어느 난이도로 할까요?」· `input[type=radio]` 5개(`[role=radio]` 0개) · 칸 = 위 이름 / 아래 코드(초보자 N5·초급 N4·중급 N3·고급 N2·최상급 N1) · 기본 체크 = 고른 주제 난이도(N4 주제 → N4, N5 주제 → N5) · 비교 줄 「내 수준 초급 (N4) · 내 목표 중급 (N3) · 이 주제 초급 (N4)」· `p[aria-live=polite]` 존재(빈 줄 자리 유지) · 구분선(`border-t`) 아래 h3 「하루에 무엇을 할까요?」+ 내용 불변. **프로필 연동**: N4/N3 → 위 줄, N4/null → 「내 수준 초급 (N4) · 이 주제 초급 (N4)」(내 목표 묶음만 빠짐), N3/N2 → 「내 수준 중급 (N3) · 내 목표 고급 (N2) · 이 주제 초급 (N4)」, N5/N1 → 「내 수준 초보자 (N5) · 내 목표 최상급 (N1) · 이 주제 초급 (N4)」 — 알약 낭독 꼬리말(내 수준→내 목표→이 주제 기본)도 값을 따라감 |
| V3 | 상호작용 | **PASS** | (내 수준 N4) 알약 클릭 → checked 이동·선택 모양(바깥 테두리 투명 + 안쪽 2px accent, 굵기 700 ↔ 미선택 500, 미선택 box-shadow none). 안내 줄: N5 → 「내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.」, N4·N3 → 빈 줄, N2 → 「내 수준보다 2단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.」, N1 → 「…3단계…」. 내 수준 N5·N3 로 바꿔 보면 기준이 «내 수준» 으로 따라가 N5 프로필 N1 선택 → 「4단계」, N3 프로필 N4 선택 → 「쉬워요」. [다음] `aria-disabled` 없음(항상 눌림, 매 선택 뒤 확인). 키보드: N4 포커스 → →→←←← 로 N3·N2·N3·N4·N5 이동(native), 체크 칸만 탭 정지 — Tab 한 번에 묶음을 지나 다음 체크박스로, Shift+Tab 으로 돌아오면 같은 radio. **주제 바꿔도 손댄 값 유지**: N2 고른 뒤 ③→①→자기소개(N5)→③ = N2 그대로·안내 「2단계」·비교 줄 「이 주제 초보자 (N5)」·sr-only 「이 주제 기본」은 N5 칸으로 이동. **손 안 댄 값은 따라감**: 주말 계획(N4)→자기소개(N5) 시 체크 N4→N5, 안내 「쉬워요」 |
| V4 | ④ 확인 + 만들기 | **PASS** | dl 「난이도」 dd = 「고급 (N2)」+ small 「이 주제 기본은 초급 (N4)」(고른 값이 주제 값과 같으면 「이 주제 기본」, 시험: N4 선택 → 「초급 (N4)」「이 주제 기본」) · 주제 줄 「주말 계획 週末の予定」— 「· N4」 없음 · 「고급 (N2)」·「초급 (N4)」 각각 한 줄. **POST `/api/v1/challenges` 요청 본문 키 = topicId·lengthDays·start·dailyGoal·`level`, `level:"N2"`** (고른 값과 같음), 성공 후 `/plan` 이동, `GET /challenges/today` `level` = N2, `GET /challenges/:id` `level` = N2. 손대지 않은 기본(자기소개)도 `level:"N5"` 를 늘 실어 보내고 today `level` N5 |
| V5 | 계획표 카드 부제 | **PASS / OBSERVED** | 부제 「난이도 고급 (N2) · 10월 18일 ~ 10월 24일」(손 안 댄 기본은 「난이도 초보자 (N5) · …」). 「난이도 …」·날짜 묶음 각각 한 줄. 360/390/412 × 100·b130 모두 부제 1줄(subtitle 높이 18.8 → b130 24.4). **360px × c130(글자+rem 모두 ×1.3) 만 2줄**(묶음 사이 줄바꿈, 높이 48.8 = +24.4, 줄 끝에 「·」 남음). 카드 실높이 411.3(390·412 100%) / 429.8(360 100%) / 514.2~563(b130) / 581.7~701.6(c130) — 자리표시 278.4 와는 원래 크기가 다름(278.4 는 「챌린지 없음」 카드 실측값, `planSkeletonSizes.ts` 주석)이라 이번 변경 몫이 아님. 이번 task 몫의 높이 변화 = 부제 두 줄이 되는 360×c130 의 +24.4px 뿐 (O2) |
| V6 | 다시 도전·실패 시 값 유지 | **PASS / OBSERVED** | `again=<지난 N2 챌린지>` → ④ 「고급 (N2)」+「이 주제 기본은 초급 (N4)」. ③ 으로 돌아가면 N2 체크·안내 「2단계」 이나 설명이 「…처음엔 주제 난이도로 골라 두었어요.」 그대로 → **알려진 Low(L-1) 화면 확인 = 어긋나 보임**(O1). **오프라인**(`ctx.setOffline(true)`) 후 [챌린지 시작] → 푸터 `role=alert` 「챌린지를 만들지 못했어요. 연결을 확인하고 다시 눌러 주세요.」, URL step=4 유지, 난이도 줄 「고급 (N2)」 유지 → 온라인 복귀 후 같은 버튼 → POST 본문 `level:"N2"`(2번 모두), `/plan` 이동, today `level` N2 |
| V7 | 레이아웃·접근성 수치 | **PASS (O3·O4 관찰)** | 아래 표. 모든 폭×글꼴×테마에서 `scrollWidth <= clientWidth`, 페이지 세로 스크롤 0, `right > clientWidth` 요소 0, 알약 이름·코드 `scrollWidth <= clientWidth`(잘림 0), 알약 5칸 높이 48(b130·100%) / 62.4(c130, `min-h-12`=3rem 이 루트와 함께 커짐), 비교 줄은 묶음 안에서 줄이 안 바뀌고(묶음별 줄 수 1) 묶음 사이에서만 바뀜(360 b130: 2줄 — 첫 줄 「내 수준 … · 내 목표 … ·」, 둘째 줄 「이 주제 …」), 초점 링 `solid 2px, offset 2px` accent |
| V8 | 일반 | **PASS** | 콘솔 에러 0(예외 1건 = 오프라인 모사 때 브라우저가 낸 `net::ERR_INTERNET_DISCONNECTED`, 의도된 상황), 페이지 오류 0, 외부 호스트 요청 0, 엔진·모델 이름(`reazon|whisper|style-bert|sbv2|qwen|claude|sherpa|model_id|speaker_id|gateway|anthropic|haiku|sonnet|opus|ollama|vits`) 노출 0 — ①·③(N2 고름)·④·계획표 × 라이트·다크의 `innerText`·`.sr-only`·`aria-label|title|alt|placeholder` 전수 검색 |

### V7 세부 수치

알약 이름 칸(「초보자」·「최상급」, 가장 긴 이름 3글자) 안쪽 폭 − 글자 폭 = 여유 px. 안쪽 폭 = 칸 폭 − 6(테두리 2 + 좌우 패딩 4). 데모 실측과 b130 이 소수점까지 같다.

| 폭 | 칸 폭 | 100% | b130(글자 ×1.3) | c130(글자·rem ×1.3) |
|---|---|---|---|---|
| 360 | 59.2 (c130 55.4) | +17.3 | **+6.6** | **+2.8** |
| 390 | 65.2 (c130 61.4) | +23.3 | +12.6 | +8.8 |
| 412 | 69.6 (c130 65.8) | +27.7 | +17.0 | +13.2 |

- 이름 잘림 0건(12조합 전부 `nameCut=false·codeCut=false`) — 데모 §33 한계 항목(360·130% +6.6) 해소 확인. **가장 빠듯한 c130 360px 도 +2.8px 로 잘리지 않음.** 칸 간격 8→6 대책 불필요.
- 터치 44: 알약 칸 높이 48(100%·b130) / 62.4(c130). 이번 화면의 새 요소 중 44 미만 0. 측정에 걸린 44 미만 요소 = 기존 부품(O3).
- 색 대비(WCAG 비텍스트 3:1): 선택 칸 안쪽 2px accent ÷ surface = **4.80(라이트)·5.22(다크)**, 초점 링 accent ÷ 실제 바탕(`.bg-ground`) = **4.46(라이트)·5.85(다크)**, 칸 글자(이름 13px·코드 11px ink·ink2) ÷ surface = 15.81(라이트)·13.77(다크). 미선택 칸 테두리 ÷ surface = 1.32·1.39 (O4).
- 접근성 트리(CDP `Accessibility.getFullAXTree`): `group` 「어느 난이도로 할까요?」 설명 = 비교 줄 글자(「내 수준 초급 (N4) · 내 목표 중급 (N3) · 이 주제 초급 (N4)」), `radio` 이름 = 「초보자 (N5)」·「초급 (N4), 내 수준, 이 주제 기본」(checked)·「중급 (N3), 내 목표」·「고급 (N2)」·「최상급 (N1)」 — 보이는 두 줄 중복 낭독 없음(`aria-hidden`), `paragraph` live=polite 존재.
- 다크 모드: 토큰이 실제로 반전(accent 200,71,31 → 240,106,69, surface 255,255,255 → 29,35,32) — 선택 알약 안쪽 링·초점 링 모두 보임(스크린샷 확인).
- 진행 중 챌린지가 있을 때 ③(high_risk 5): InfoBox 「이미 진행 중인 챌린지가 있어요」 아래 h2·난이도 묶음·알약 5칸·비교 줄 정상(360 b130·390·360 b130 다크), 가로 스크롤 0, [다음] 은 막힌 채(점선 모양) 눌러도 step 3 유지.

## 관찰 (결함 아님 — 판단은 Leader/designer)

| ID | 분류 | 내용 |
|---|---|---|
| O1 | 알려진 Low(L-1) **화면 확인** | `again` 으로 ③ 에 돌아가면 값은 N2(지난 값)이고 비교 줄은 「이 주제 초급 (N4)」, 안내 「2단계 어려워요」인데 설명은 「…처음엔 주제 난이도로 골라 두었어요.」 → 사실과 어긋나 보임. 스크린샷 `shots/again-step3-390.png`. 문구는 데모 표에 대안 없음 → designer/Leader 판단 |
| O2 | 모형 한계·카드 높이 | 360px × c130 에서만 계획표 부제가 두 줄(+24.4px, 줄 끝 「·」 남음). b130 은 한 줄. 카드가 자리표시(278.4 = 「챌린지 없음」 카드)와 다른 건 task-046 부터 알려진 설계(주석에 명시) |
| O3 | 기존 부품(이번 diff 밖) | ③ 아래 「하루에 무엇을 할까요?」의 장수 칩(5·10·15장) 시각 높이 36, 시작일 분절(오늘/내일) 36 — 둘 다 `before:h-11` 로 터치 영역 44(코드 확인). 진행 중 InfoBox 의 버튼 「진행 중 챌린지 보기」는 360px × b130 모형에서 라벨이 두 줄로 접혀 위아래가 잘려 보임(`h-12` 고정 + 글자 ×1.3, `seeActive` 문구·InfoBox 는 HEAD 와 같음, c130 에서는 버튼이 커져 정상) — 스크린샷 `shots/s3-active-360-b130.png`. 이번 task 가 건드린 코드 아님 |
| O4 | 데모 기지 Minor | 미선택 알약 테두리 대비 1.32(라이트)·1.39(다크) < 3:1. 칸 안 글자 대비는 13.77 이상이라 칸을 알아볼 수 있고 기존 장수 칩과 같은 방식(데모 한계 항목에 이미 적힘) |
| O5 | 데이터 한계 | 시드 주제는 N5 ×3·N4 ×2 뿐이라 내 수준 N2(창 N3·N2·N1)이면 ① 이 「고를 수 있는 주제가 없어요.」 로 ③ 에 못 간다(확인: 프로필 N2/N1). task-076 이전부터인 데이터 문제 — 수준 N3 는 창에 N4 가 들어 ③ 에 도달함 |
| O6 | 화면 이동 | ③ 처음 들어올 때 초점이 h2(「목표를 정해요」)로 가는 건 단계 이동 규칙대로 |

## 이 파일이 다루지 않은 것

- **NOT_VERIFIED**: 실제 폰(S25+)·APK WebView 의 글꼴 130%(위 b130/c130 은 모형 — 실제 안드로이드 설정은 rem 도 같이 커지는 c130 쪽에 가깝다고 보나 확인 못 함), **TalkBack 낭독**(접근성 트리로 이름·설명·live 속성까지만 확인), 터치 제스처·키보드 올라온 상태.
- 오늘 탭 회화 뱃지·챌린지 칩·「내 단어장 세트」 준비 줄(감사 high_risk 6)은 이 1부 범위 밖 — 2부.
- 서버 규칙(T 결정표)·LLM 생성 결과 난이도 준수는 이 검증의 대상 아님.

## 증빙·재현

- 스크립트(세션 scratchpad `qa076-chrome1/`): `lib.cjs`(공용·글꼴 모형·측정) · `s1-matrix.cjs`(①·③ 행렬) · `s2-interact.cjs`(상호작용·프로필 연동) · `s3-create.cjs`(④·POST·계획표·다시 도전·오프라인) · `s4-misc.cjs`(대비·엔진명 검색) · `s5-focus.cjs`(초점 링) · `s6-ax-active.cjs`(접근성 트리·진행 중). 결과 JSON `s1~s4-result.json`.
- 재현 조건(데모 게이트 §QA 시각 검증): Chrome headless(`/usr/bin/google-chrome`) · 뷰포트 폭 360/390/412 × 높이 892 · DPR 2.625 · 라이트·다크(`colorScheme`) · locale ko-KR · timezone Asia/Seoul · 글꼴 모형 b130/c130(위) · 네트워크 = 실제 QA 서버(fixture 없음) · 캡처 = 뷰포트 + 카드 요소.
- 스크린샷(전부 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/qa076-chrome1/shots/`, 총 53장):
  - ① 주제: `s1-{360,390,412}-{100,b130,c130}.png` · `s1-360-b130-dark.png` · `s1-360-c130-dark.png` · `s1-390-100-dark.png`
  - ③ 목표(난이도): `s3-{360,390,412}-{100,b130,c130}.png`(+`-bottom`) · `s3-360-b130-dark.png` · `s3-360-c130-dark.png` · `s3-390-100-dark.png` · `s3-A-N1-390.png`(N1 고름·「3단계」) · `s3-A-focus-390.png`(키보드 초점 링) · `s3-focus-dark-390.png` · `s3-B-goalnull-360-b130.png`(목표 없음) · `s3-active-360-b130.png`(진행 중 InfoBox)·`s3-active-360-b130-dark.png`
  - ④ 확인: `s4-390-100-N2.png` · `s4-360-b130-N1.png`(가장 긴 「최상급 (N1)」+「이 주제 기본은 초급 (N4)」) · `s4-360-c130-N4same-dark.png` · `again-step4-390.png` · `again-step3-390.png` · `offline-fail-390.png`
  - 계획표 카드: `plan-card-390-100.png` · `plan-card-360-b130.png` · `plan-card-360-c130.png`(부제 2줄) · `plan-card-360-b130-dark.png` · `plan-page-360-b130.png`
- Leader 가 본 뒤 정리: 위 `qa076-chrome1/` 폴더는 세션 scratchpad 안이라 프로젝트에 남는 파일 없음(이 기록 파일 외). 정리는 Leader 판단에 맡김(삭제 안 함 — 육안 확인용).
