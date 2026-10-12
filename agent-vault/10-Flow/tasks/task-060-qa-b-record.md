---
project: TheKaiwa
task: task-060
type: qa-record
role: qa
tags:
  - type/qa
  - domain/vocab
---
# task-060 QA-B 기록 — B1 [읽기]/[한글] 독립·저장 · B2 키보드·접근성·옛 세트

> 본 이력서: [[task-060-improve-deck-controls]] · 구현 [[task-060-dev-record]] · 감사 [[task-060-rev-record]]. 같은 시각 다른 QA(QA-A)가 QA1~QA3 을 쓴다 — 이 기록은 **QA4(`qa-bot4@thekaiwa.test`) 한정**.
> 환경: 서버 `127.0.0.1:3011` 리스너 PID 3781608(cwd `~/.node-local/thekaiwa-rev060`, `NODE_ENV=production next start`) — **Leader 가 끝낸다, 건드리지 않음**. 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스(`isMobile`·`hasTouch`·DSF 2.625·ko-KR·Asia/Seoul). 도구(저장소 밖): scratchpad `q060/b-*.mjs`(task-059 `q059/b1/{lib,dlib}.mjs` 복사본), 미러 `~/.node-local/thekaiwa-rev060/qa060/b-{counts4,cleanup4,dbcard,dropsess4}.ts`. 값(쿠키·DB URL·비밀) 기록 안 함. 스크린숏은 `/tmp/qa-artifacts/TheKaiwa/task-060/` 에만(끝나면 삭제).

## ★ 심은 것·정리 방법 (맨 위 고정)

- 지우는 대상 = **QA4 userId 한정**. 시작 값(아래 표)으로 되돌아오면 정리 끝. 도구: `cd ~/.node-local/thekaiwa-rev060 && node --env-file=.env --import tsx qa060/b-cleanup4.ts`(dry-run) → 눈으로 확인 → `--yes` → `qa060/b-counts4.ts` 로 시작 값과 대조.
- 심기: `POST /api/v1/words/seed-pack {pack:'N5'}`(`source=SEED, jlpt=N5`) → `WordEntry` 676. 테스트로 생기는 `VocabSession`·`VocabAttempt`(cascade)·`StatsSnapshot`·`StudyLog` 가 있으면 같은 userId 로 지운다. **AiJob 3건은 시작 값이라 지우지 않는다.**
- 세트는 `finish` 를 부르지 않는다(LLM 위험). 세트마다 DB 로 `b-dropsess4.ts <id>`(QA4 userId 한정 삭제)로 치운다.
- 브라우저 localStorage 는 컨텍스트마다 새로 만들므로 서버에 남는 것 없음. 앱 표시 설정(`Profile.showHangul`)을 끄는 시험은 **PUT 을 모의(`page.route`)** 로만 — 서버 값 변경 0(변경 시 원복 기록).
- 시작·끝 `ps -eo cmd | grep '[c]laude --print'` = 0 확인.

## 시작 값 (심기 전, QA4, 2026-10-12 12:3x KST, `qa060/b-counts4.ts start`)

| 테이블 | QA4 |
|---|---|
| Chat / ChatMessage / Correction(ACCEPTED) | 0 / 0 / 0(0) |
| WordEntry | **0** |
| VocabSession / VocabAttempt | **0 / 0** |
| StudyLog / StatsSnapshot | **0 / 0** |
| TutorProposal / RepetitionItem / LearningObservation | 0 / 0 / 0 |
| AiJob | **3**(시작 값 — 지우지 않음) |
| Profile | `N5/null/10` |

`claude --print` 프로세스: 시작 전 0.

## 체크포인트

### 체크포인트 B1-1 — 4조합·저장 이어받기 PASS 31/31 (12:4x KST, 390×844, `b1-a.mjs`)
- 세트: QA4 `POST /api/v1/vocab/sessions {count:10,category:null}`(mode 안 보냄) → FLIP·카드 10장(전부 보기 4), 첫 카드 「海/うみ」. 심은 것: QA4 `seed-pack N5` 676단어 + 세트 1개(미삭제, 아래 정리). `claude --print` 0.
- **B1a 4조합**(둘 다 켬에서 시작, 버튼 클릭): 켬/켬 `rt=[うみ]`·한글 줄 1(「[우미]」) → [읽기] 끔: `rt 0`·한글 줄 유지(저장 off/on) → [한글] 끔: `rt 0`·한글 줄 0(off/off) → [읽기] 켬: `rt=[うみ]`·한글 줄 0(on/off) → [한글] 켬: 둘 다 복귀(on/on). 단계마다 `aria-pressed` 가 상태와 일치. 아이콘 `あ`/`가`, 라벨 `읽기`/`한글`, 버튼 83.5×52px(≥44).
- **키 R/H**: R=읽기만, H=한글만(대문자 `H` 포함) 독립 토글 확인(저장 값도 같이 바뀜).
- **B1b 저장 키**: ① 키 없음 → 읽기·한글 모두 켬(진입만으로 localStorage 쓰지 않음, 둘 다 null 유지) ② `r=off` 만 → 한글도 꺼짐(rt 0·한글 줄 0, `h` 는 null 유지) → [읽기] 켬 → 저장 `on/off`(굳음)·한글 꺼진 채, 새로고침 뒤 `rt>0`·한글 꺼진 채 유지 ③ `r=on` 만 → 한글 켬 → [읽기] 끔 → 저장 `off/on`, 새로고침 뒤 읽기 끔·한글 켠 채 유지 ④ `r=off,h=on`·`r=on,h=off`·`h=off` 만(r 없음 → 읽기 기본 on) 모두 기대대로.
- **남은 일**: B1c(뒷면 루비 늘 보임·한글은 앱 설정만, [한글] 막힘 2종) · 다음 카드에서도 두 설정 유지 · B2 전체. **다음 첫 명령**: `cd scratchpad/q060 && node b1-c.mjs <sid>`(작성 예정). 세트 id = `cmv4p6m6q011lw1wop7p6xzcy`(IN_PROGRESS, 정리 때 `qa060/b-dropsess4.ts` 로 삭제).

### 체크포인트 B1-2 — B1c 뒷면·막힘·다음 카드 PASS 23/23 (+1) → **B1 전체 PASS** (12:5x KST, `b1-c.mjs`·`b1-d.mjs`)
- 첫 실행 ERR 1건은 **스크립트 오류**(Playwright 는 `aria-disabled="true"` 버튼을 "not enabled" 로 보고 클릭을 기다리다 30초 타임아웃) → `click({force:true})` 로 고쳐 재실행(실사용자는 눌러짐). 제품 결함 아님.
- **뒷면(Space 로 뜻 보기)**: 읽기/한글 켬·끔 두 조합 모두 `rt=[うみ,うみ,ひろ]`(표제어+예문 루비) 늘 보임, 한글 줄 2(표제어 「[우미]」·예문 「[우미와 히로이데스.]」) — [한글] 상태와 무관. 뒷면에서 [한글]·[읽기] 를 눌러도 뒷면 `rt`·`ko` 불변(버튼 `aria-pressed`·저장값만 바뀜). 뜻 보기·토글에서 서버 쓰기(`/attempts`·finish) 0건.
- **앱 한글 설정만 따름**: `GET /api/v1/settings/profile` 을 `showHangul:false` 로 모의(PUT 은 abort, 실제 PUT 0건·서버 설정 불변): 앞면 한글 줄 0·[한글] `aria-disabled=true`+`aria-pressed` 없음 → 누르면 화면에 「설정에서 한글 표기를 켜 주세요」, 저장값 불변(on/on), H 키도 같은 안내 / 뒷면: 한글 줄 0·루비 `rt>0`(b1-d).
- **분석 없음 막힘**: `POST /api/v1/text/annotate` 를 500 으로 모의 → [한글] `aria-disabled=true` → 누르면 「이 카드는 한글 표기가 없어요」, 저장값 불변.
- **다음 카드 유지**: `r=off,h=on` 에서 Space→`1`(알았어요) → 다음 카드 「再来年」에서도 `rt 0`·한글 줄 1(「[사라이넹]」)·`aria-pressed` 읽기 false/한글 true. 서버 `/attempts` 정확히 1건(`{order:0,selfResult:"CORRECT",responseMs}`).
- 미정리 추가: 세트 `cmv4p6m6q011lw1wop7p6xzcy` 에 attempt 1건(order 0 CORRECT) — 세트 삭제 때 cascade. `claude --print` 0.
- **남은 일**: B2 전체(a 키·시트, b 숨은 대체 버튼·초점, c 옛 CHOICE 세트). **다음 첫 명령**: `node b2-a.mjs <새 sid>`(작성 예정; 먼저 현 세트 삭제 `cd ~/.node-local/thekaiwa-rev060 && node --env-file=.env --import tsx qa060/b-dropsess4.ts cmv4p6m6q011lw1wop7p6xzcy` 후 새 세트).

### 체크포인트 B2-1 — B2a 키·확인 시트 PASS 19/19 (13:0x KST, `b2-a.mjs`, 세트 `cmv4pdbgt014cw1woh323l5ma`)
- 첫 세트 `cmv4p6m6q011lw1wop7p6xzcy` 는 삭제(`b-dropsess4.ts` dropped 1), 새 FLIP 세트로 재실행. **1차 실행의 FAIL 6건은 스크립트 오류**(오탐): ① 「두 버튼 aria-describedby」 검사가 시트 머리의 [닫기] ✕ 까지 포함 ② 시트가 열린 채 `Space` 를 누르면 초점이 있는 [취소] 버튼이 네이티브로 눌려 시트가 닫히고, 이어지는 c/h/r/f 키가 정상적으로 덱에 먹은 것(그 결과 F 의 `flagged` POST 가 섞여 뒤 항목도 연쇄 오염). 제품 동작은 맞음(시트 열린 채 Space → 시트만 닫히고 카드는 앞면 그대로를 새 항목으로 단언). 스크립트 고쳐 재측정 — 19 PASS / 0 FAIL.
- 실측(390×844): Space=뜻 보기(뒷면 노출, 서버 쓰기 0) · C=객관식 열림/닫힘 · F=표시 on/off(요청 `{order,flagged}` 만) · **ArrowUp=변화 0(표시 안 켜짐·뒷면 아님·보기 안 열림·POST 0)** · **S=시트 열림, `/attempts` POST 0건** · 시트 `role=dialog aria-modal=true`, 제목 「이 카드를 건너뛸까요?」, 본문 「건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.」, **첫 초점 [취소]**, [건너뛰기]·[취소] 둘 다 `aria-describedby`→본문 id(텍스트 원문 일치) · 시트 열린 동안 c/h/r/f/s/1/2/←/→/↑ 전부 무시(카드 앞면 그대로·보기 닫힘·표시 불변·한글 줄·저장값 불변·POST 0) · Space=[취소] 활성화로 시트만 닫힘(뜻 보기 안 됨) · Escape=시트 닫힘(POST 0, 초점 body) · [취소]=닫힘 · **[건너뛰기]=`/attempts` POST 정확히 1건 `{"order":0,"skipped":true}`**(selfResult·chosenText 없음), DB `answer=SKIPPED` · 답한 카드에서 S=시트 안 열림(초점 [다음 카드 ›]).
- 세트 `cmv4pdbgt014cw1woh323l5ma`: 카드 0 SKIPPED(attempt 1건). `claude --print` 0.
- **남은 일**: B2b(숨은 대체 버튼·Tab 칩·초점) · B2c(CHOICE 세트). **다음 첫 명령**: `node b2-b.mjs cmv4pdbgt014cw1woh323l5ma`(작성 예정, 카드 1 飲む 이후가 현재 카드).

### 체크포인트 B2-2 — B2b 숨은 대체 버튼·Tab 칩·초점 PASS 25/25 + 가시성 3/3 (13:1x KST, `b2-b.mjs`·`b2-b2.mjs`, 390×844, 세트 `cmv4pdbgt014cw1woh323l5ma`)
- **1차 실행 FAIL 3건 = 스크립트 오류**(오탐): 「초점 전후 이웃 위치 불변」 비교가 초점 요소·조상을 목록에서 빼서 배열 길이가 어긋나 `shift 66` 으로 나옴 — 첫 Tab 정지([오늘로])에서도 똑같이 66 이 나온 것이 증거. 요소 고유 id 로 비교하도록 고쳐 재측정(`main` 안 66개 요소): **Tab 정지 10곳 전부 `shift 0`**.
- **접근성 트리**: `getByRole('button',{name,exact})` 로 [뜻 보기]·[객관식]·[건너뛰기] 각 정확히 1개, 모두 `<button>`·`aria-hidden` 아님·`disabled` 속성 없음, 평소 `1×1`·`position:absolute`·`clip-path:inset(50%)`·`.sr-only` 안. [객관식] 은 `aria-expanded="false"`.
- **Tab 순서·칩**: 오늘로 → 끝내기 → 알림 닫기 → **[뜻 보기](65.5×32)** → **[객관식](61.9×32)** → [이전] → [읽기] → [표시] → [한글] → **[건너뛰기](73.8×32)**. 칩 3개 모두 `:focus-visible`·높이 32·너비 >60, **초점 전후 이웃 요소 위치·크기 변동 0**(카드 무대·도구 줄 칸·힌트 줄 포함). 가시성: 칩 중앙 `elementFromPoint` = 자기 자신, 화면 안, 테두리 1px·흰 배경·`clip none`, 슬롯 칩 초점 때 안내 글 `visibility:hidden`(겹침 없음). [건너뛰기] 칩은 [읽기]·[표시] 칸과 각 1,054px²(≈33×32) 겹침 — screens.md §24-5 「알려진 한계」 그대로(레이아웃은 안 밀림).
- **활성화**: 칩 [건너뛰기] 에서 Enter → 시트(POST 0) → Esc → **초점이 연 칩([건너뛰기])으로 복귀**. 숨은 [뜻 보기] 클릭(click 이벤트 = 화면 읽기 활성화) → 뒤집힘·**초점 [알았어요]** · 숨은 [객관식] 클릭 → 보기 열림·초점 첫 보기 「1번, …」 · 숨은 [건너뛰기] 클릭 → 시트(POST 0) → 시트 [건너뛰기] → POST 1건 `{"order":1,"skipped":true}`.
- **초점 이동**: 건너뛴 뒤 [다음 카드 ›] 초점 → Enter 로 새 카드 → `document.activeElement = body`(숨은 대체 버튼 아님) · 새 카드에서 Space → 초점 [알았어요] · C 로 보기 열면 첫 보기, C 로 닫으면 `body`(숨은 버튼 아님) · 객관식으로 답하면 초점 [다음 카드 ›].
- 세트 `cmv4pdbgt014cw1woh323l5ma` 현재 카드 0~4 답함(SKIPPED×3 등), `claude --print` 0.
- **남은 일**: B2c(옛 CHOICE 세트: 고정 힌트·위로 밀기 안내·오른쪽 밀기 시트·도구 줄·카드 탭=읽기만). **다음 첫 명령**: 이 세트 삭제(`b-dropsess4.ts cmv4pdbgt014cw1woh323l5ma`) 후 `node b-mk.mjs CHOICE 5` → `node b2-c.mjs <sid>`.

### 체크포인트 B2-3 — B2c 옛 4지선다 세트 PASS 18/18 (13:2x KST, `b2-c.mjs`, 390×844 터치, 세트 `cmv4pgwro0159w1woeaxp4ne8` = `mode:'CHOICE'` 5장)
- 고정 터치 힌트 = 「← 밀어 다음 · → 밀어 건너뛰기」 정확히 1줄(↑·뜻 보기 없음). 도구 줄 보이는 버튼 = [이전][읽기][표시][한글] (보이는 [뜻 보기]·[객관식]·[건너뛰기] 없음), 숨은(sr-only) 버튼은 [건너뛰기] 칩 하나뿐([뜻 보기]·[객관식] 숨은 버튼은 CHOICE 세트에 없음 — FlipControls 미사용).
- **위로 밀기(CDP 터치, dy −170)**: 뒷면 안 열림·카드 글 불변, 안내 「먼저 답을 골라 주세요」, 서버 쓰기 0, 표시(★) 안 켜짐. **오른쪽 밀기(dx +170)**: 확인 시트(「이 카드를 건너뛸까요?」…) 열림, POST 0, Esc 로 닫힘. (참고) 안 답한 카드를 왼쪽으로 밀면 다음으로 안 가고 같은 안내.
- **카드 탭(<10px)**: [r=on,h=off]·[r=off 만]·[r=on,h=on] 3가지 모두 **읽기(루비)만 토글**, 한글 줄 유무·[한글] `aria-pressed` 불변(꺼진 한글이 켜지지 않음), 객관식 열림·시트 없음·서버 쓰기 0. 저장: r=off 만에서 탭 → `on/off`(한글 꺼짐으로 굳음).
- `claude --print` 0. 세트 `cmv4pgwro0159w1woeaxp4ne8` 미삭제(카드 0 답 없음).
- **남은 일**: 보강 확인(스와이프 뜻 보기 뒤 초점·오른쪽 밀기→확인 [건너뛰기] 실클릭·수정키 조합 S·시트 Tab 순환) 후 정리. 다음 첫 명령: `node b2-d.mjs <새 FLIP sid>`.

### 체크포인트 B2-4 — 보강 B2d 11/12(관찰 1건) · 정리 완료 (13:3x KST)
- `b2-d.mjs`(FLIP 세트 `cmv4pinpb0166w1wob3aneuf9`, 터치): 스와이프 ↑ → 뜻 보기·서버 쓰기 0·표시 안 켜짐·**초점 [알았어요]** / 뒷면에서 ↑ 다시 → 변화 없음 + 「알았어요·몰랐어요를 먼저 골라 주세요」 / 뒷면(안 답함)에서 오른쪽 밀기 → 확인 시트(POST 0) / 시트 [건너뛰기] **실클릭** → POST 정확히 1건 `{"order":0,"skipped":true}`, 초점 [다음 카드] / 건너뛴 카드에서 오른쪽 밀기 → 시트 없음·카드 불변·「이전 카드는 아래 [이전] 버튼으로 가요」·POST 0 / [다음 카드] 탭 → 새 카드 초점 `body`(숨은 버튼 아님) / **Ctrl+S·Meta+S·Alt+S·Ctrl+H·Ctrl+R 은 덱 동작 안 함**(시트 없음·저장값 불변·페이지 그대로) / [알았어요] 클릭 → POST 1건 `{"order":1,"selfResult":"CORRECT","responseMs":2348}` → 자동 다음 뒤 초점 `body`. 12번째 항목(시트 Tab 가둠)만 FAIL → 아래 **관찰 O-1**.
- **관찰 O-1 (Low, 사전 존재·공용 컴포넌트)**: 건너뛰기 확인 시트가 열린 동안 Tab 이 시트 밖으로 나간다(`b2-e.mjs`: [취소]에서 Tab → 「오늘로」「끝내기」「알림 닫기」「뜻 보기」「객관식」「이전」「읽기」… 전부 `OUT`). `b2-f.mjs`: 그 상태에서 숨은 [뜻 보기]에 Enter → **시트가 열린 채 뒤의 카드가 뒤집힌다**(시트는 그대로 남고, 이후 시트의 [건너뛰기]는 정상). 원인: 공용 `src/components/common/Sheet.tsx` 에 포커스 가둠(trap)·배경 `inert` 가 없음 — `git diff` 상 task-060 이 건드린 파일이 아니고(`Sheet.tsx` 변경 0), `FinishConfirmSheet` 등 모든 시트가 같다. 영향: 상태는 일관(시트 열린 카드가 바뀌면 `skipSheetOpen` 이 닫음), 마우스·터치 사용자는 무관, 키보드/스위치 사용자에게만. task-060 결함으로 올리지 않고 별도 개선 후보로 보고.
- **정리(end)**: `qa060/b-dropsess4.ts`(세트 id 지정 삭제, 세트 4개 전부) → `b-cleanup4.ts` dry-run(WordEntry 676 외 전부 0 — 눈으로 확인) → `--yes`(WordEntry 676 삭제) → `b-counts4.ts end` = **시작 값과 일치**(Chat 0·ChatMessage 0·Correction 0/0·WordEntry 0·VocabSession 0·VocabAttempt 0·StudyLog 0·StatsSnapshot 0·TutorProposal 0·RepetitionItem 0·LearningObservation 0·**AiJob 3**·Profile `N5/null/10`). 쿠키 파일 `scratchpad/q060/b-c4` 삭제, 스크린숏 0장(`/tmp/qa-artifacts/TheKaiwa/task-060/` 없음 — 산출물 정리 0개 삭제), `claude --print` 시작·중간·끝 모두 0, 헤드리스 크롬 0, 3011 서버(PID 3781608)는 손대지 않고 그대로. 저장소 코드 수정 0, 커밋·add 0.
- 도구(저장소 밖) 남김: scratchpad `q060/b*.mjs`·`b-*.log`, 미러 `~/.node-local/thekaiwa-rev060/qa060/b-*.ts`(미러 정리 때 같이 삭제).

## QA-B 판정 (B1·B2)
| 항목 | 판정 | 근거 요약 |
|---|---|---|
| B1a [읽기]/[한글] 독립 4조합 | **PASS** | 31/31 (루비 `rt`·한글 줄 DOM, `aria-pressed`, あ/가·읽기/한글 라벨, 버튼 83.5×52) |
| B1b 저장 키·이어받기·유지 | **PASS** | 키 없음/r만/r+h/h만 6조합, 굳음(`on/off`·`off/on`), 새로고침·다음 카드 유지 |
| B1c 뒷면·막힘 | **PASS** | 뒷면 루비 늘 보임·한글=앱 설정만, 막힘 2종(`aria-disabled`+안내 원문, 저장 불변) 재현 성공 |
| B2a 키·확인 시트 | **PASS** | 19/19 (S=시트만, POST 0 → [건너뛰기] 1건 `skipped:true`, ArrowUp 무반응, 시트 중 덱 키 무시) |
| B2b 숨은 대체 버튼·초점 | **PASS** | 25/25 + 3/3 (실제 `<button>`, 평소 1×1, Tab 때만 칩, 이웃 변동 0, 초점 규칙) |
| B2c 옛 CHOICE 세트 | **PASS** | 18/18 (힌트·↑ 안내·→ 시트·도구 줄·탭=읽기만) |
| 관찰 O-1 | 관찰(Low, 사전 존재) | 공용 Sheet 포커스 가둠 없음 |
| NOT_VERIFIED | — | 실기기 터치 문턱(위 80px/좌우 60px) 체감·TalkBack 초점·Bluetooth 키보드 Tab 칩 (헤드리스 CDP 터치로만 확인) |
