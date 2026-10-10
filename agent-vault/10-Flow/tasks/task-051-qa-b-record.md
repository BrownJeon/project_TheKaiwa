---
task: task-051
role: qa-B (화면 360/390/412)
tags:
  - type/record
  - domain/vocab
---
# task-051 QA 레인 B 기록 — 화면 (screens.md §19, 데모 v1 C·A·B·B·A·A)

> 이력서 본문: [[task-051-improve-n5-vocab-pack]]. 이 파일만 append. 대상 커밋 `46efd74`.

## QA 시각 검증 — 재현 조건 (데모 게이트 §8)
- 서버: `git archive 46efd74` → `~/.node-local/thekaiwa-qa051b`(node_modules = seed051b 하드링크, `.env` 복사 600), `next build` exit 0 → `APP_ENV=LOCAL CLAUDE_CLI_PATH=/bin/false next start -H 127.0.0.1 -p 3012`(LLM 호출 불가로 부작용 차단). 헬스 `degraded: stt_analysis_worker` 만(이번 항목과 무관).
- 브라우저: playwright-core + `/usr/bin/google-chrome` headless **147.0.7727.101**. viewport 360×800 · 390×844 · 412×892, DSF 2.625, isMobile+hasTouch, locale ko-KR, timezone Asia/Seoul, reducedMotion reduce, light(다크 미검증), 이동 `networkidle` + 1.8초 대기. 네트워크 fixture: B1·B2·B3 미사용(실서버 실데이터), B4 만 `page.route` 로 #11 차단/지연. 캡처 범위 = 뷰포트(상태별). 허용 범위: 가로넘침 0·페이지 세로스크롤 0·터치 ≥44px·글자 잘림 0.
- 계정: **QA4**(`qa-bot4@thekaiwa.test`, 레인 A 는 QA1 사용 중 — 시작 때 QA1 words=676 관측). 시작 전 QA4: Profile level=N5·goalLevel=null, words 0, Attendance 3·RequestTrace 73·UserSpeechSetting 1·UserVoiceSetting 1·Profile 1. (admin 줄 순서 확인용으로 `qa-admin` 읽기 전용 화면 이동만 — 시작 전 Attendance 1·RequestTrace 23.)
- 스크립트: 미러 루트 `qa051b-*.mts`(미러와 함께 삭제), 원 출력 scratchpad `q051b/*.log`. 쿠키 scratchpad `q051b/cookie4`·`cookieadmin`(끝에 삭제).

## 체크포인트 B1 — 빈 단어장·추가 시트·오늘 카드 (QA4 words 0)
- **판정: PASS** — 3상태(S1 N5/없음 · S2 N5/N4 · S3 N3/N1) × 3폭 × (단어장 빈 카드·추가 시트·오늘 카드) 자동 점검 **144/144 PASS**(문구는 `SEED_PACK_LABEL`·`SEED_PACK_COUNT` 에서 계산한 기대 문자열과 일치 비교).
- 문구: 주 `초보자 (N5) 단어 676개 넣기`, 보조 `목표 수준 초급 (N4) 단어 629개 넣기`, 최장 `목표 수준 최상급 (N1) 단어 3,034개 넣기`, 본문 `{이름} 기본 단어 {n}개로 바로 시작하거나, …`, 시트 `… 개 한 번에 넣기 ›`·`목표 수준 … 한 번에 넣기 ›` 전부 일치.
- **보조 버튼(최장 문구, 360)**: 높이 **48px**, 폭 298px, **줄 수 1**(가이드 추정 「글자 자리 268px·두 줄 허용」과 달리 한 줄에 들어감), 잘림(scrollWidth>clientWidth) 0, 배경 `rgb(255,255,255)`+테두리 1px(ghost). 주 버튼 배경 `rgb(200,71,31)`(채운 accent) 하나뿐, 높이 48. 390 폭 328px·412 폭 350px 에서도 1줄·48px. 직접 추가 버튼 48px.
- 추가 시트: 맨 아래 글자 버튼 2개 높이 **44px**·1줄·잘림 0·색 accent(`rgb(200,71,31)`)·배경 투명, 시트 안 스크롤 상자 ≤1, 가로넘침 0. 360 시트 높이 447.8px(상단 352.3).
- **오늘 카드 증가량**: 보조 버튼 없음 240px → 있음 296px = **+56px**(3폭 동일). 홈 CTA 「수업 만들기」(오늘의 회화 카드, 이 상태의 [시작하기] 자리) 위치: 보조 없음 top 510.6/bottom 558.6, 보조 있음 top 566.6/bottom **614.6** — 하단 탭 상단(360×800: 727 · 390×844: 771 · 412×892: 819) **위**에 있어 첫 화면 안. 카드는 오늘 홈 첫 화면(≈780px)에서 안 밀려남. ※ 단어가 없는 상태에는 words 카드의 [시작하기]가 없다 — 준비 상태 카드의 [시작하기] 위치는 B3(단어 676개)에서 확인.
- 가로넘침(`right > clientWidth` 요소) 0 · `docScrollWidth == clientWidth` · 페이지 세로스크롤 0(`scrollHeight == clientHeight`) 전 조합.
- **남은 일**: B2 → B3 → B4. **다음 첫 명령**: `cd ~/.node-local/thekaiwa-qa051b && node --env-file=.env --import tsx qa051b-b2.mts`(작성 예정). **주의점**: 서버 3012(PID 파일 scratchpad `q051b/server.pid` = 815875)·QA4 Profile 지금 level=N3·goalLevel=N1(마지막에 N5/null 복원)·쿠키 1시간짜리(만료 시 `QA_ACCOUNT=4 … tests/live/qa-session.ts` 재발급). **미정리**: QA4 Attendance(오늘자 APP_OPEN 가능)·RequestTrace 증가분 점검 필요, 미러·서버·스크린샷 `/tmp/qa-artifacts/TheKaiwa/task-051`.

## 체크포인트 B2 — 설정(지금·목표 수준 두 줄 분절 · 출처 줄 `DataCreditRow` · 출처 시트)
- **판정: PASS** — 웹·앱(fake-capacitor `appBuild 2·appVersion 1.0.1`) × 3폭(USER QA4) + 관리자(`qa-admin`, 읽기 전용 화면 이동) 웹·앱 390 자동 점검 **104/104 PASS**.
- **두 줄 분절**: 지금 수준 5칸·목표 수준 6칸 모두 칸 높이 **48px**, 위 줄 이름·아래 줄 코드(`초보자/N5`…`최상급/N1`), 칸 `aria-label` = `초보자 (N5)`·`초급 (N4)`·`중급 (N3)`·`고급 (N2)`·`최상급 (N1)`·`없음`, 고른 칸 `aria-checked=true`(지금 N3·목표 N1). **글자 잘림 0**(span `scrollWidth>clientWidth` 0개 + 글자 폭 ≤ 칸 안쪽폭): 360 에서 가장 좁은 칸 = 목표 수준 「최상급」 — 칸 폭 46.2px·안쪽폭 42px·글자 폭 34.5px(12.5px 글꼴), **최소 여유 7.5px**; 390 여유·412 최소 여유 16.5px(안쪽폭 51px). 지금 수준 칸 폭 56px(360).
  - 측정 도중 내 첫 지표(`span.clientWidth`)가 shrink-to-fit 이라 여유를 −0.1px 로 잘못 보여 **측정식을 칸 안쪽폭 기준으로 고쳐 재측정**(위 값이 정정값).
- 도움말: 「선생님 대화와 기본 단어 넣기가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — 최상급은 가장 높은 급수(N1)예요.」 일치, `aria-describedby=levelHelp` 가 이 글을 가리킴(3폭·웹·앱).
- **출처 줄**: 높이 **69px**(규칙은 `min-h-[56px]` — 글 두 줄 + p-3.5 + 테두리로 min 보다 큼, 가이드 「56px」는 최소값 해석), 폭 = 뷰포트−32. 순서: 웹 USER = 설정 맨 아래(출처 줄 다음 줄 없음), 웹 관리자 = 출처 줄 → 관리자 줄(공통 부모 자식 index 6→7), 앱 USER = 앱 버전 줄(`Lingofy Japanese v…`) → 출처 줄(6→7), 앱 관리자 = 버전 줄 → 출처 줄 → 관리자 줄(6→7→8). (내 첫 순서 점검이 상단 업데이트 띠를 버전 줄로 잘못 집어 앱 USER 를 거짓 PASS 시킬 뻔해 `main` 안 요소로 한정해 재측정.)
- **출처 시트**(웹·앱 3폭): 열면 `document.activeElement` = 시트 제목 `H2 「단어 자료 출처」`(초점이 시트 안), **Esc 로 닫힘, 닫으면 초점이 출처 줄 버튼(`BUTTON`, 「단어 자료 출처 OpenJLPT 외 · CC BY-SA」)으로 복귀**, 시트 안 세로 스크롤 상자 0개(내용이 시트 598.8px 안에 다 들어감 — 규칙 ≤1), `<a>` 링크 0, 가로넘침 0, [닫기] 높이 ≥44. 문구: 합계 **7,755**(= `SEED_PACK_COUNT` 합), 「JLPT 공식 단어 목록이 아니에요」, OpenJLPT/Tanos/JMdict 3줄, AI 안내, CC BY-SA 4.0 주소 글자. **금칙어 `Tatoeba|원어민|reazon|whisper|style-bert|claude|haiku|sonnet|opus|qwen|gpt|model_id|speaker_id|sherpa` 0건**(시트 본문과 설정 화면 전체 `innerText` 둘 다).
- 가로넘침 0·페이지 세로스크롤 0(설정은 `main` 안쪽 스크롤 1곳, 페이지 높이 4,423px 중 페이지 레벨 넘침 0).
- **남은 일**: B3(단어 676개 넣기 → 상세·입력·분류 칩·출처 문장) → B4. **다음 첫 명령**: QA4 단어 0 확인 후 `POST /api/v1/words/seed-pack {pack:'N5'}`(시간 측정) → `qa051b-b3.mts`. **주의점**: QA4 Profile level=N3·goal=N1 상태(마지막에 N5/null 복원), 서버 3012 실행 중(PID 815875). **미정리**: B1·B2 스크린샷 `/tmp/qa-artifacts/TheKaiwa/task-051`, QA4/qa-admin Attendance·RequestTrace 증가분 점검.

## 체크포인트 B3 — 단어 상세·입력·분류 칩 (QA4 에 `POST /api/v1/words/seed-pack {pack:'N5'}` → 200 `added 676·skipped 0`, 2,754ms, 전 676행 QA4 userId)
- **판정: PASS** — 3폭 자동 점검 **48/48 PASS**(측정식 보정 2회 후 — sr-only 1px 요소는 잘림에서 제외, 가로 스크롤 칩 줄 안쪽 요소는 넘침에서 제외; 둘 다 기존 화면 요소).
- 분류 칩: `전체 676`·`초보자 (N5) 676`(단계 이름 칩, 옛 `N5 기초` 칩 없음 — QA4 는 기존 50개 없는 새 계정).
- 상세(첫 단어 `日本語`, jlpt N5, category `초보자 (N5)`, source SEED): 뱃지 줄 = `명사`·`초보자 (N5)`·`이름 조각` — **「초보자 (N5)」 뱃지 하나**(수준 뱃지와 분류가 같은 글이라 중복 안 그림), 옛 「N5」 단독 뱃지·「N5 기초」 0, 출처 문장 「기본 단어 팩에서 넣었어요」 있음(옛 「기본 단어(N5) 팩」 0), 잘림 0·금칙어 0·가로넘침 0.
- 입력 폼 「수준」 select: 옵션 = `선택 안 함 / 초보자 (N5) / 초급 (N4) / 중급 (N3) / 고급 (N2) / 최상급 (N1)`. 가장 긴 글 「초보자 (N5)」·「최상급 (N1)」 글자 폭 **79.7px**(16px) ↔ select 폭 360: 159px(안쪽 133px)·390: 약 172px·412: 185px(안쪽 159px) — 화살표 약 20px 을 빼도 **잘림 0**, select 높이 44, 2열(품사·수준) 폭 360 = 159·159(≥150).
- **B4 회귀(한 줄 Segmented, 변경 전 DOM 대조)**: `git show 524adee:Segmented.tsx` 의 한 줄 변형(`relative min-w-0 flex-1 rounded-[9px] px-1 before:… ${sm: h-8 text-xs | md: h-9 text-[13.5px]} ${on…}`·`<span class="block truncate">라벨</span>`·`aria-label` 없음·그룹 `aria-describedby` 없음)과 **실제 DOM 이 클래스 문자열·안쪽 HTML 까지 같음**, `::before` 높이 44px, 칸 높이 32px(sm), 잘림 0 — 단어장 「정렬」(4칸)·오늘의 단어 준비 카드 「카드 장수」(5칸)·「푸는 방식」(2칸) 3폭 전부(설정의 한 줄 분절 5개(대화 문체·교정 강도·설명 자세히·단어 개수·공부 시간)도 B2 스크린샷에서 정상 확인).
- 오늘 홈(단어 676개): [시작하기] 360: top 304·bottom 352(h 48, 하단 탭 상단 727 위), 412: top 284.5·bottom 332.5(탭 상단 819 위), 넣기 버튼 0개(준비 카드), 가로넘침 0.
- **남은 일**: B4(프로필 #11 실패·재시도·정렬, 로딩 높이 변화) → 정리. **다음 첫 명령**: QA4 단어 676 삭제(대상 행 수 출력 후 userId 한정 `deleteMany`) → `qa051b-b4.mts`. **주의점**: 지금 QA4 words=676·Profile level=N5·goal=null. **미정리**: QA4 WordEntry 676, 스크린샷, 쿠키, 미러·서버(3012, PID 815875).

## 체크포인트 B4 — 오류·로딩·회귀 (QA4 words 0 로 되돌린 뒤)
- **판정: PASS(결함 0) + 관찰 1건(Low)** — 오류 상태 자동 점검 **42/42**(그중 로딩 12건은 점검이 아니라 측정값 기록이라 아래 수치로 직접 판정).
- **#11 실패 → 「수준을 불러오지 못했어요 · 다시 시도 ›」**: 단어장(빈 단어장)·오늘 카드 × 3폭 전부 표시. #11 을 `route.abort`(360·412 + 390 오늘) / HTTP 500(390 단어장)로 막음 — 둘 다 같은 결과. 넣기 버튼 0개·직접 추가 버튼 유지, 본문 「아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.」(단어장)·「오늘의 단어는 내 단어장에서 골라요.」(오늘). 버튼: 높이 **44px**·13px·accent `rgb(200,71,31)`·잘림 0 — 단어장 폭 = 카드 안쪽 전폭(298/328/…), 오늘 카드 폭 209.7.
- **정렬**: 빈 단어장 = **가운데**(글자 중심 180 = 카드 중심 180 @360, 195=195 @390, `justify-content:center`) / 오늘 카드 = **왼쪽**(글자 왼쪽 31 − 카드 왼쪽 16 = 15px = 카드 안쪽 여백, 글자 중심 135.9 ≠ 카드 중심 180, `align-self:flex-start`) — 둘 다 가이드(데모 `.tlink.ctr`·왼쪽) 일치.
- **눌러서 재시도**: 차단 해제 뒤 [다시 시도] 누름 → 2초 안에 「다시 시도」 사라지고 `초보자 (N5) 단어 676개 넣기` 1개(목표 수준 보조 없음) 복귀 — 단어장·오늘 × 3폭 6/6.
- **로딩 높이 변화**(#11 을 2.5초 지연, 50ms 간격 표본; 「비어 있어요」 문구만 먼저 보였다가 버튼이 끼어든 표본 **0건** → 버튼이 늦게 끼어드는 일은 없음):
  - 단어장: 스켈레톤(본문 하단 856) → 빈 카드+버튼 최종 하단 716(360)·760(390)·808(412) — **줄어듦(−140/−96/−48px), 커짐 0**. 목표 수준 있음(S2)도 같은 값.
  - 오늘 카드(「오늘의 회화」 카드 상단 y 로 환산): 목표 없음(S1) 스켈레톤 400(360)·380.5(390·412) → 최종 335 = **−65/−45.5px(줄어듦)**. **목표 수준 있음(S2, 보조 버튼 +56px) 390·412: 380.5 → 391 = +10.5px(스켈레톤 대비 커짐)**, 360: 400 → 391 = −9px(줄어듦).
  - 해석: 이 task 의 목적(「버튼이 늦게 끼어들며 이미 보인 카드가 커짐」)은 충족. 다만 스켈레톤 높이가 최종 카드 높이와 같지는 않아 스켈레톤→내용 전환 때 아래 카드가 −65~+10.5px 움직인다(상태에 따라). **[관찰 QA-051B-O1 Low]**: 목표 수준을 정해 둔 사용자(S2)에게는 390·412 에서 +10.5px 아래로 밀림 — 설계 한계(스켈레톤은 목표 유무를 모름)이며 수정 필요 여부는 Leader·designer 판단.
- **회귀(한 줄 Segmented, 다른 화면 2곳)**: 단어장 「정렬」(sm 4칸)·오늘의 단어 준비 카드 「카드 장수」(5칸)·「푸는 방식」(2칸), 3폭 — 변경 전(`524adee`) 코드가 만드는 DOM 과 **클래스 문자열·안쪽 HTML(`<span class="block truncate">`)·`aria-label` 없음·그룹 `aria-describedby` 없음·`::before` 44px·칸 높이 32px·잘림 0 모두 일치**(자동 대조 B3 에 포함, 18/18 PASS). 시각 비교 캡처는 찍지 않음(DOM·계산값 동일로 갈음 — 변경 전 서버를 따로 띄우지 않았다).

## 최종 판정 (QA 레인 B) — 화면 360/390/412
| 항목 | 판정 | 근거 |
|---|---|---|
| B1 빈 단어장·추가 시트·오늘 카드 | **PASS** | 144/144, 보조 버튼 최장 문구 360 에서 1줄·48px·잘림 0, 오늘 카드 +56px, 홈 CTA 탭바 위 |
| B2 설정(분절·출처 줄·시트) | **PASS** | 104/104, 「최상급」 칸 360 최소 여유 7.5px, 초점 이동·Esc·복귀, 금칙어 0 |
| B3 상세·입력·분류 칩 | **PASS** | 48/48, 뱃지 하나·출처 문장·select 「최상급 (N1)」 79.7px ≪ 133px |
| B4 오류·로딩·회귀 | **PASS**(관찰 O1) | 42/42 + 로딩 수치, 회귀 DOM 동일 |
- 결함: **Critical 0 · High 0 · Medium 0 · Low 0**, 관찰 Low 1(O1), Info 2: ① 가이드 §19-8 의 「360 에서 보조 버튼 한 줄이 빠듯[추측]·두 줄 허용」은 실측과 다름 — 실제 1줄에 들어가 2줄 허용 장치는 안 쓰임(문서 정정 후보) ② 출처 줄 높이는 69px(가이드 「56px」 = `min-h`) ③ 단어장 가로 스크롤 칩 줄(조각 필터)의 오른쪽 일부는 화면 밖(스크롤 상자 안, 기존 화면).
- **NOT_VERIFIED(사용자 육안·실기기 S25+ 필요)**: ① 안드로이드 기본 select 선택 창에서 「최상급 (N1)」 표시(Chrome 헤드리스 계산만) ② 실제 앱 WebView·`window.Capacitor`(앱 모드는 fake-capacitor 시뮬레이션) ③ 안드로이드 뒤로가기 버튼으로 출처 시트 닫기·초점 ④ 다크 모드 ⑤ 넣는 중 「넣는 중…」 상태·다른 넣기 버튼 `aria-disabled`·3,034개 삽입 시간·실패 롤백(레인 A 범위 — 이 레인에서는 안 눌러 봄) ⑥ 출처 문구의 CC BY-SA 4.0 표기 요건 충족(법률 판단 아님) ⑦ 표본 검수 완료 전까지 「사람은 일부만 확인했어요」 문구는 사실 아님(M1 게이트, REV-180).
- **정리**: QA4 단어 676 → 0(대상 행 수 출력 후 userId 한정 삭제), QA4 Profile level=N5·goalLevel=null 로 복원(원래 값, `updatedAt` 도 원래 `2026-10-06T22:57:33.759Z` 로 복원), qa-admin 오늘자 Attendance(APP_OPEN, 내가 화면을 열어 생긴 1행) 삭제. userId 칸 보유 전 표 행 수 스캔: **QA4 = 시작 전과 동일**(Attendance 3·Profile 1·RequestTrace 73·UserSpeechSetting 1·UserVoiceSetting 1), **qa-admin = 시작 전과 동일**(Attendance 1·Profile 1·RequestTrace 23·UserSpeechSetting 1·UserVoiceSetting 1). LLM 호출 0(`CLAUDE_CLI_PATH=/bin/false`, 다른 `claude --print` 프로세스 없음 확인).
- **프로세스·산출물 정리(최종)**: 서버 3012(PID 파일 815875)만 종료 → `ss -ltn` 3012 비어 있음. 격리 복제본 `~/.node-local/thekaiwa-qa051b` 삭제(`ls -d` 없음 확인, 원본 `thekaiwa-seed051b/node_modules` 394개 그대로). 스크린샷 64개(`/tmp/qa-artifacts/TheKaiwa/task-051`) 삭제 — 증빙은 위 측정값 글로 대체. 쿠키·PID 파일 삭제. `/tmp/qa-artifacts/` 루트의 다른 세션 `*.png` 4개는 내 것이 아니라 그대로 둠(24시간 청소 훅 대상). 재현 스크립트 15개는 scratchpad `q051b/scripts/`(프로젝트 밖)에 보관.
