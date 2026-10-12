---
project: TheKaiwa
task: task-060
type: qa-record
role: qa
tags:
  - type/qa
  - domain/vocab
---
# task-060 QA-A 기록 — A1 레이아웃·버튼 구성 · A2 제스처 동작 (QA, 2026-10-12 12:30~ KST)

> 본 이력서: [[task-060-improve-deck-controls]] · 구현 [[task-060-dev-record]] · 감사 [[task-060-rev-record]]. 가이드 `docs/screens.md` §24.
> 환경: 검증 서버 `127.0.0.1:3011`(PID 3781608, cwd `~/.node-local/thekaiwa-rev060`, `NODE_ENV=production next start`, 빌드 12:30) · 미러 소스가 작업 트리 task-060 파일과 동일(`diff -q` 9개 same) · 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스, `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:'reduce'`, CDP `Input.dispatchTouchEvent` 로 스와이프. **QA3 계정만**(QA1·2·4 손대지 않음). 쿠키·`.env` 값은 기록하지 않는다.
> 도구(저장소 밖): scratchpad `q060/b/*.mjs`(task-059 `q059/b1/{lib,dlib}.mjs` 를 복사·수정) · 미러 `~/.node-local/thekaiwa-rev060/qa060/{counts34,cleanup34,dbcard}.ts`.

## ★ 심은 것·정리 방법 (맨 위 고정 — 정리하는 쪽은 이것만 보면 된다)

- 지우는 대상은 **QA3(`qa-bot3@thekaiwa.test`) userId 한정**. 시작 값 = 아래 표(전부 0). 되돌리는 조건 = `qa060/counts34.ts` 출력이 시작 값과 같아질 때.
- 심기: QA3 `POST /api/v1/words/seed-pack {pack:'N5'}` → 676 `WordEntry`. 시험으로 생기는 `VocabSession`(진행 중 1개 + ABANDONED 여러 개)·`VocabAttempt`(cascade)·표시(★) 기록은 같은 userId 로 지운다. **세트는 끝내지 않는다**(`finish` 금지 — A11 LLM 위험, 공부한 날 ≥2 && 반복 ≥2 에서만 걸리지만 시작 값 0 을 지키려고 안 건드림) → `StudyLog`·`StatsSnapshot`·`RepetitionItem`·`LearningObservation` 은 늘지 않아야 한다(늘면 결함 후보).
- 정리 순서: `cd ~/.node-local/thekaiwa-rev060 && node --env-file=.env --import tsx qa060/cleanup34.ts`(dry-run) → 눈으로 확인 → `--yes` → `qa060/counts34.ts` 로 시작 값 대조. 쿠키 `scratchpad/q060/c3` 삭제.

## 시작 값 (심기 전, `qa060/counts34.ts start`, 12:32 KST)

| 테이블 | QA3 | QA4(읽기만) |
|---|---|---|
| Chat / ChatMessage / Correction(ACCEPTED) / TutorProposal | 0 / 0 / 0(0) / 0 | 0 / 0 / 0(0) / 0 |
| WordEntry | **0** | 0 |
| VocabSession / VocabAttempt | **0 / 0** | 0 / 0 |
| StudyLog / StatsSnapshot / RepetitionItem / LearningObservation | **0 / 0 / 0 / 0** | 0 / 0 / 0 / 0 |
| AiJob | **0** | 3(시작값) |
| Profile | `N5/null/10` | `N5/null/10` |

- 시작 전 `ps` `claude --print` = **0**. 쿠키 c3 발급 12:32(1시간, 권한 600).

## 체크포인트

(아래에 항목 끝날 때마다 append)

### 체크포인트 A1 — 레이아웃·버튼 구성 (12:50 KST, `q060/b/a1.mjs`, 3폭 각 1회 + 390 2회 반복 = 일관) — 항목 a·c·d PASS / b 문자 그대로 FAIL(결함 #1)

QA3 `POST /sessions {count:5,category:null}`(FLIP·카드 5장 모두 `choices` 4개) · 폭마다 새 세트(이전 세트는 `qa060/abandon3.ts` 로 상태만 ABANDONED — `finish` 호출 0) · 상태 S1(앞면)·S1o(탭으로 객관식 열림)·S2(위 −81 뒷면)·S3(오른쪽 +100→시트→[건너뛰기] 확정 뒤 답한 상태)·S4(다음 카드 앞면)·S4b(뒤집음)·S5([이전] 지난 카드) + P0(보기 없는 카드: 같은 세트 GET 응답에서 `choices` 만 `page.route` 로 제거, 서버·DB 변경 0).

| 항목 | 360×740 | 390×844 | 412×892 | 판정 |
|---|---|---|---|---|
| a) 보이는 [뜻 보기]·[객관식]·[건너뛰기] 버튼 | 0 (sr-only 3개 1×1) | 0 | 0 | **PASS** — `badVisible []`, 카드 안 `button` 0 |
| a) 하단 첫 줄 자리(앞면) 높이 | 52 | 52 | 52 | **PASS** |
| a) 안내 「카드를 위로 밀면 뜻이 보여요」 | 1줄(h 18.19)·clipX 0·clipY 0, 폭 158 | 같음 | 같음 | **PASS** (`line-clamp:2` 이지만 1줄) |
| a) 보기 없는 카드 안내 「카드를 위로 밀어도 뜻이 보여요」 | 1줄·clip 0·슬롯 52·sr-only 버튼 [뜻 보기] 만 | 같음 | 같음 | **PASS** |
| b) 뒤집기 전/후 **하단 첫 줄 높이·위치** | 52→52, top 616→616 | 52→52, 720→720 | 52→52, 768→768 | **PASS** — 뒷면 [알았어요][몰랐어요] 두 칸 각 h 52, 같은 자리 |
| b) 뒤집기 전/후 **카드 무대 높이** | **491.5→447.5 (−44)** | **595.5→551.5 (−44)** | **643.5→599.5 (−44)** | **FAIL (문자 그대로)** → 결함 #1 |
| c) 도구 줄 안 답한 카드 | [이전][あ 읽기][표시][가 한글] 4칸 76×52 씩 | 83.5×52 | 89×52 | **PASS** — 칸 너비 동일, `scrollWidth<=clientWidth` 전부(칸·하위 요소 `toolClip []`), 격자 right ≤ 뷰포트 |
| c) 답한 뒤(건너뜀)·지난 카드 | [이전][표시][다음 카드 ›] 76/76/160 | 83.5/83.5/175 | 89/89/186, h 52 | **PASS** |
| c) 덱 스크롤 (`main`·document·root 세로/가로) | S1·S1o·S2·S3·S4·S4b·S5 전부 **0/0/0/0**, 가로 넘침 요소 0 | 전부 0 | 전부 0 | **PASS** (task-059 의 360×740 답한 뒤 44px 스크롤 재현 안 됨 — 알림 없는 5장 세트 기준) |
| d) 고정 힌트(360 폭 포함) 한 줄·말줄임 없음 | 앞면 31자 폭 240.3 / 안 답한 뒷면 25자 202.9 / 답한·지난 카드 21자 164.1, `lines 1`·`clipX 0` | 같은 문구·같은 폭 | 같음 | **PASS** — 세 문구 원문이 지시와 일치 |
| 터치 높이 | 도구 줄 52·슬롯 52 (≥44) | 같음 | 같음 | **PASS** |

- **결함 #1 (Low~Medium — 판정은 Leader)**: 뒤집으면 **카드 무대가 −44px** 줄고 카드(h 340, 폭 3종 모두 무대 안에 여유가 있어 크기는 그대로)가 **위로 22px 이동**한다(`group.top` 360: 174.25→152.25, 390: 226.25→204.25, 412: 250.25→228.25; 카드 아래~힌트 거리 75.75→97.75 등). 원인 = `DeckListenRow`(단어/예문 듣기 줄 44px)가 `side==='back'` 일 때만 무대와 힌트 줄 사이에 끼는 것 — `git show HEAD:…/VocabDeck.tsx` 에도 같은 조건이 있어 **task-059 부터의 기존 동작**이고 task-060 이 만든 것이 아니다. 그러나 가이드 §24-1 의 「뒤집어도 카드 무대 높이 불변」과 이번 검증 기준 b) 는 **문자 그대로는 불충족**. 52px 하단 슬롯 예약은 의도대로 동작(슬롯 높이·위치 불변)했고 task-059 결함 #1(알림·듣기 줄·카드 겹침)의 재발은 없다 — 이 5장 세트는 알림이 없다. 재현: QA3 쿠키로 `POST /api/v1/vocab/sessions {count:5,category:null}` → 해당 덱 열기 → 카드 위로 −81px 밀기 → `[role=group][aria-roledescription=카드]` 의 부모(무대) 높이 비교. 보기 없는 카드(P0)도 같음(−44). 제안: 가이드 문구를 「하단 첫 줄 52px 불변(듣기 줄 44px 가 뒷면에 생겨 카드가 22px 오른다)」로 고치거나 듣기 줄 자리를 앞면에도 예약.
- **관찰**: 객관식 열림(S1o) 360×740 은 카드가 287.5 로 줄고(무대 311.5) 스크롤 0; 390·412 는 카드 340 유지. 두 번째 반복(390×844 2회)에서 같은 값 — 환경 오탐 아님. 힌트 말줄임 CSS(`truncate`)는 있으나 실제 `clipX` 는 전 상태 0.
- **LLM**: `claude --print` 자식 0(`pgrep -P 3781608` 0, args 필터 0 — 중간에 본 `1` 은 내 `ps|grep` 자기 매칭 오탐), QA3 `AiJob 0`, `StudyLog·StatsSnapshot·RepetitionItem·LearningObservation` 0 유지. 세트 3~4개(ABANDONED + 진행 중 1), 시도 행 소량, WordEntry 676.
- (A1 당시 남은 일 → 아래 A2 로 이어짐)

### 체크포인트 A2 — 제스처 동작 (13:00 KST, `q060/b/a2.mjs`+`a2b.mjs`(꼬리)+`x1.mjs`(보충), 390×844, CDP `Input.dispatchTouchEvent`) — **전 항목 PASS (결함 0)**

세트 `cmv4pf55z014sw1wolp5sebv6`(FLIP 5장, 보기 4개씩). `a2.mjs` 는 e5 단계에서 **스크립트 오류**(Playwright `tap()` 이 `aria-disabled="true"` 인 첫 카드 [이전] 을 "not enabled" 로 거부 — 제품 결함 아님)로 멈춰 e5 부터를 `a2b.mjs`(같은 세트·좌표 탭)로 이어 실행. 그 앞 단계는 모두 PASS 로 기록돼 있었고 DB 도 `0:SKIPPED, 1~4:null` 로 일치.

| 항목 | 관찰(원 값) | 판정 |
|---|---|---|
| a) 위 −79 | 뜻 안 열림(`flipped false`), 안내 없음, 비-GET `/vocab/` 요청 0, **튐 표본 0**(모션 허용 컨텍스트에서 rAF 로 `transition-duration` 샘플 — `0.16s` 표본 0) | PASS |
| a) 위 −81 | 뒷면(`알았어요` 보임), 같은 카드(`1번째 카드, 모두 5장`), **튐 표본 5개**(`matrix(1,0,0,1,0,-81)→-74.4→-60.6…` 으로 돌아옴), `/vocab/` 비-GET 요청 **0**, DB `answer` 전부 null(뒤집기만으로 기록 안 함) | PASS |
| a) 뒤집은 뒤 위 −100 | 뒷면 유지, 안내 1줄 「알았어요·몰랐어요를 먼저 골라 주세요」, 요청 0 | PASS |
| b) 탭(합 9px: dx5·dy4) | 객관식 열림(`ol[aria-label=보기]` 버튼 4), 요청 0 → 열린 채 위 −81 → **보기 0·뒷면**, 요청 0 | PASS |
| c) 오른쪽 +59 | 시트 안 열림, mid-drag `translateX 59`(저항 없음), 요청 0 | PASS |
| c) 오른쪽 +61 | 시트 열림: 제목 「이 카드를 건너뛸까요?」· 본문 「건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.」· 버튼 [건너뛰기][취소](+우상단 [닫기]), **활성 초점 = 취소**(BUTTON), 두 버튼 `aria-describedby` 연결, 시트 열린 동안 `/attempts` POST 0 | PASS |
| c) [취소] | 시트 닫힘, 카드 그대로(앞면·1번째), POST 0 | PASS |
| c) 다시 밀어 [건너뛰기] | `/attempts` POST **정확히 1건**, 본문 `{"order":0,"skipped":true}`(키 2개), 카드: 띠 「건너뛴 카드」·뜻(양복) 보임·다음 카드 버튼·상태 「건너뛴 카드로 기록했어요」, DB `0:SKIPPED` | PASS |
| c) 같은 카드 다시 오른쪽 +100 | 시트 없음, 안내 「이전 카드는 아래 [이전] 버튼으로 가요」, mid-drag `translateX 25`(= ×0.25), 요청 0 | PASS |
| d) 바깥(배경) 탭 | 시트 닫힘, 요청 0 | PASS |
| d) Escape | 시트 닫힘, 요청 0 | PASS |
| d) 시트 열린 동안 제스처·키 | 카드 위 −81 스와이프 + 키 `f h r c ← → s` + 초점 옮긴 뒤 Space → 시트 유지·카드 안 뒤집힘·보기 0·[읽기][한글][표시] 눌림 상태 불변(`true,true,false`)·요청 0 | PASS |
| (보충) S 키 | 시트만 열림(요청 0), Esc 로 닫음 | PASS |
| e) 왼쪽: 답한 카드 | `2번째 카드` 로 이동 | PASS |
| e) 왼쪽: 안 답한 카드 | 2번째 카드 유지, 안내 「카드를 위로 밀거나 눌러서 먼저 답해 주세요」, mid-drag `translateX −25`, 요청 0 | PASS |
| e) 첫 카드 [이전] | 안내 「첫 카드예요」 | PASS |
| e) 둘째 카드 [이전] | 첫 카드(건너뜀 표시)로 돌아감; 그 카드에서 오른쪽 밀기 → 시트 없음·이전 이동 없음·안내 「이전 카드는 아래 [이전] 버튼으로 가요」 | PASS |
| f) 위로 밀기 ≠ 표시 | 2번째 카드 위 −81 → 뒷면, `[표시] aria-pressed=false`, 요청 0 | PASS |
| f) [표시] 버튼 | 요청 본문 `{"order":1,"flagged":true}`(키 2개), `aria-pressed=true`, 안내 「다시 볼 카드로 표시했어요」, DB `1:null★` | PASS |

- 보충 `x1.mjs`(360×740): **건너뛰기 시트 레이아웃** — 시트 폭 360·높이 161, [건너뛰기] 159×48·[취소] 161×48·[닫기] 44×44, 가로 넘침 0, 제목·본문 1줄·잘림 0, 활성 초점 [취소] (FLIP·옛 4지선다 두 세트 같음). **옛 4지선다(CHOICE) 세트**: 고정 힌트 「← 밀어 다음 · → 밀어 건너뛰기」 1줄·clip 0, 위 밀기 → 안내 「먼저 답을 골라 주세요」(뜻 안 열림), 오른쪽 +100 → 확인 시트(요청 0).
- LLM: 시작·A1·A2·보충 끝 모두 `claude --print` 자식 0 (서버 자식 프로세스 0), QA3 `AiJob 0`·`StudyLog·StatsSnapshot·RepetitionItem·LearningObservation` 0 유지(`counts34.ts mid`). `Attendance`(QA3) 4행(10-07·08·10-11·10-12)은 task-059 QA 가 남긴 것(10-12 행 생성 00:00 KST < 내 시작) — 이번 검증이 늘린 행 아님.
- **NOT_VERIFIED(실기기·실환경)**: S25+ WebView 에서 위 80px·오른쪽 60px 문턱의 손 느낌(대각선 위가 위로 판정되는 기존 규칙 포함), Bluetooth 키보드 Tab 으로 닿는 sr-only 칩 3종(뜻 보기·객관식·건너뛰기) 표시·동작과 TalkBack 초점 이동(이 라운드 범위 밖 — A1/A2 지정 항목 아님), 소리 재생(실제 TTS), 다크 모드 명암비.

### 체크포인트 정리 — 완료 (13:08 KST)

- `qa060/cleanup34.ts` dry-run(QA3 세트 8·단어 676·나머지 0) 확인 → `--yes`: QA3 `VocabSession` 8 삭제(시도 40 cascade)·`WordEntry` 676 삭제 → `qa060/counts34.ts end` 가 **시작 값과 일치**(QA3: Chat 0·ChatMessage 0·Correction 0(ACCEPTED 0)·WordEntry 0·VocabSession 0·VocabAttempt 0·StudyLog 0·StatsSnapshot 0·TutorProposal 0·RepetitionItem 0·LearningObservation 0·AiJob 0·Profile `N5/null/10`). 이 라운드가 `StudyLog·StatsSnapshot·RepetitionItem·LearningObservation·AiJob` 을 늘린 적은 없다(세트를 한 번도 끝내지 않음).
- 참고: 정리 뒤 QA4 가 `WordEntry 676·VocabSession 1·VocabAttempt 10`(시작 값 0) — **내가 건드린 적 없는 계정**(다른 QA 갈래가 쓰는 중). QA4 `AiJob 3` 은 원래 시작값.
- 쿠키 `scratchpad/q060/c3` 삭제. 스크린숏 0장(`/tmp/qa-artifacts/TheKaiwa/task-060` 만든 적 없음 → `산출물 정리: 0개 삭제`). 띄운 프로세스: 없음(헤드리스 크롬은 스크립트 종료와 함께 종료 — `ps` 0개), 서버 3781608·포트 3011 은 그대로 둠. `claude --print` 0.
- 남긴 것(저장소 밖): scratchpad `q060/b/*`(내 스크립트·로그·`a1-*.json`, 쿠키 없음), 미러 `~/.node-local/thekaiwa-rev060/qa060/{counts34,cleanup34,dbcard,abandon3,extra3,extra3b}.ts`. 다른 갈래 파일(`scratchpad/q060/b-*`·`b1-*`·`b2-*`)은 건드리지 않음.

## QA-A 판정 요약

- **A1**: a·c·d **PASS**(3폭), b 는 하단 첫 줄 52px 예약은 PASS 이나 **카드 무대 높이는 뒤집을 때 −44px**(`DeckListenRow` — task-059 부터의 동작)이라 문자 그대로 **FAIL → 결함 #1 (Low~Medium, 판정은 Leader)**.
- **A2**: a~f **전부 PASS**(약 30개 단언), 결함 0건.
