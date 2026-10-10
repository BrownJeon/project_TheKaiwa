---
task_id: task-052
title: "카카오톡 공유하기 수신 — 안드로이드 공유(text/plain) 대상 등록 + 오늘의 회화 붙여넣기 화면 자동 채움 (IMP-0004, 네이티브·APK)"
status: doing
base_ref: df9df75
risk_level: "R2"
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-003f, task-021, task-010d]
imp: [IMP-0004]
tags:
  - type/task
  - domain/improvement
  - domain/lesson
  - domain/native
aliases:
  - 카톡 공유하기
  - task-052
created: 2026-10-10
updated: 2026-10-10
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-052-share-target-v1.html"
  artifact_url: ""
  content_sha256: "c6851e6d7601298a2798791272196f5284d47aa7f785ce91d93d7bb95505e1a5"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-052 — 카카오톡 공유하기 수신 (IMP-0004)

## 사용자 요청 (원문)
- 2026-09-30 「수지센세가 주기적으로 카톡에 올려주는 학습내용에 대해서 앱에서 동기화할 수있는 방안」 ([[IMP-0004-카톡학습-동기화방안]])
- 2026-09-30 Q3 「우선은 카톡 연동을 수동 붙혀넣기로 해주고 추후 플러그인을 통해서 자동으로 크롤링 하도록 작업해줘」 → 1단계 수동 붙여넣기(완료), 2단계는 별도 task.
- 2026-10-03 사용자 결정(AskUserQuestion, 권고안): **2단계 = 안드로이드 「공유하기」 대상 등록(방안 b)** — 카톡 메시지 길게 누름 → 공유 → Lingofy Japanese 선택 → 오늘의 회화 붙여넣기 화면(`LessonPasteScreen`)에 본문 자동 채움. 자동 수집(알림 접근 등, 방안 d)은 하지 않는다 — 사용자가 고른 글만 들어온다.
- 2026-10-10 「다음 작업 이어서 진행해줘」 → 「두 건 모두 (병행)」(IMP-0007 은 [[task-051-improve-n5-vocab-pack]]).

## 관련 과거 이력 요약 (Leader 큐레이션)
- **현재 코드(2026-10-10 Leader 확인)**: `AndroidManifest.xml` 의 intent-filter 는 LAUNCHER 와 `thekaiwa://auth/callback`(VIEW) 둘뿐 — `ACTION_SEND` 없음. `MainActivity.java`(BridgeActivity 상속, 96줄)는 쿠키 flush·다운로드 위임·키보드 인셋 세 가지만 한다. 붙여넣기 화면은 `/study/today/talk/new/paste` → `LessonPasteScreen.tsx`(일본어 텍스트 50~2000자, 서버가 일본어 비율 판정 후 수업 생성). 네이티브 호출은 `src/modules/infra/native/{bridge,appLogin,index}.ts` 한 곳으로만 간다(초안의 `native/bridge/` 폴더 표기는 오기 — designer 가 바로잡음)(라우트·화면에서 `window.Capacitor` 직접 호출은 금기).
- 앱 버전: `android/app/build.gradle` `kaiwaVersionCode = 3`(1.0.2, task-021) → 이 task 는 **4(1.0.3)** 로 올린다. 서버 `AppRelease.versionCode`·`/api/app/version` 배너와 같은 수여야 한다.
- 승인된 교훈(`/이슈기록 관련 android native apk`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 1.96 · **R2**(`risk_r2`·`r2_path` — 네이티브 경로) · developer=**opus** · **standard** · demo=**delta**(`JV-ui_change`, owner designer) · `next=demo_first` → **사용자가 데모를 승인하기 전에는 화면 코드를 쓰지 않는다.** roles: designer → developer → reviewer → qa(→ deployer APK). 입력·결과: 스크래치 `judge-052-intake*.json`. R2 라 설계 직후 judge C1(`codex_gate`).

## 설계 (Leader 초안 — designer 가 화면 흐름을 정하고 developer 가 네이티브 구현)
1. **Manifest**: `MainActivity` 에 `ACTION_SEND` + `CATEGORY_DEFAULT` + `mimeType text/plain` intent-filter. 다른 MIME·`ACTION_SEND_MULTIPLE` 은 받지 않는다.
2. **수신**: `MainActivity` 가 `onCreate`·`onNewIntent` 의 `EXTRA_TEXT`(문자열)만 읽는다. **공유 본문을 URL·딥링크 쿼리에 싣지 않는다**(길이·로그 노출) — 네이티브가 메모리에 한 번만 꺼낼 수 있게 들고, 웹은 `infra/native/bridge` 의 함수로 가져간다(`consume` 후 비움, 길이 상한 후 자름, 로그에 본문 금지). 앱이 꺼져 있을 때(콜드 스타트)와 켜져 있을 때(`onNewIntent`) 둘 다 동작해야 한다. 플러그인으로 둘지 `MainActivity` 안에 둘지는 developer 가 정하고 reviewer 가 검토한다(새 외부 패키지를 들이면 `/신규도입`, 로컬 코드면 불필요).
3. **웹**: 공유가 들어오면 붙여넣기 화면으로 이동해 본문을 채운다. 기존 길이·일본어 비율 검사를 그대로 쓴다. 로그인 안 된 상태, 화면에 이미 쓰던 글이 있는 상태, 50자 미만·2000자 초과, 일본어가 아닌 글 같은 경우의 흐름은 **designer 데모에서 사용자 승인** 항목이다.
4. **APK**: `kaiwaVersionCode` 3→4(1.0.3), deployer 가 APK 재빌드·`/app/download/latest.apk`·`/api/app/version` 업데이트 안내. **네이티브 변경 고지 없이 배포 금지**(CLAUDE.md 금기).

## 하지 않는 것
- 알림 접근·접근성 서비스 같은 자동 수집(방안 d), 카카오톡 앱 연동/크롤링, 이미지·파일 공유, 공유 본문을 서버·로그·DB 에 먼저 저장하기(사용자가 「수업 만들기」를 누를 때만 기존 경로로 전송).
- iOS(이 저장소는 `android/` 만 있다).

## 완료 기준
1. 사용자가 데모 vN 을 승인(문장 그대로 기록).
2. `typecheck`·lint·단위 시험 통과 + 네이티브 변경 시험(Manifest 필터·인텐트 파싱 단위 시험 가능한 범위), reviewer 재실행 확인.
3. QA: 공유 수신 웹 쪽(브리지 모킹)·3폭 화면·경계(상한·빈 값) + APK 빌드 성공과 Manifest 필터 확인. **실기기에서 카톡 → 공유 → Lingofy 선택은 사용자 확인 항목**(서버에 기기·에뮬레이터가 있는지 QA 가 먼저 확인).
4. APK 배포본 + 업데이트 안내 + 사용자 폰 재설치 확인.

## 상태 로그
- 2026-10-10 접수·묶음(base_ref `df9df75`). 다음: 데모 게이트 init → designer 데모 v1.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-10 15:35 |
| v1 | 검토요청 | docs/demo/task-052-share-target-v1.html | - | 사용자 검토 요청 | 10-10 15:51 |

## Designer 기록 (데모 v1)
- [15:37] 착수 — 읽음: LessonPasteScreen.tsx·paste/page.tsx(로그인 없으면 `/login?callbackUrl=` 로 보냄)·lessonCopy PASTE·TodayLessonCard(붙여넣기 진입 196행)·screens §12-2 C·§12-8 ⓒ·login(앱 로그인도 callbackUrl 을 이어 줌)·validate.ts(50~2,000자·일본어 비율 0.3). 데모 파일 `docs/demo/task-052-share-target-v1.html` 작성 시작.
- [15:41] 체크포인트 A(정상 도착) — 제안: 붙여넣기 화면 맨 위에 얇은 안내 띠 1개(「공유한 글을 넣어 두었어요 / 아직 아무 데도 보내지 않았어요」, `role=status`), 입력칸 자동 포커스 없음(키보드가 글·버튼을 가리지 않게), 나머지 컨트롤(글자 수·안내·버튼)은 현재 그대로.
- [15:41] 체크포인트 B(쓰던 글 있음) — 제안 기본: 공유한 글로 바꿔 넣고 띠에 [쓰던 글로 되돌리기](화면을 떠나기 전까지 되돌릴 수 있음). 대안: 확인 시트 / 뒤에 이어 붙이기. 같은 글이면 안내 없이 그대로.
- [15:41] 체크포인트 C(경계) — 50자 미만: 채우고 현재 안내 그대로. 2,000자 초과: 다 채우고 현재 빨간 안내 + [2,000자에 맞춰 자르기](문장 끝에서 자름, 되돌리기 가능) 제안. 일본어 아님: 미리 막지 않고 보낼 때 서버 판정 → 현재 오류 상자 그대로(기준 한 곳 원칙).
- [15:41] 체크포인트 D(로그인 전) — 로그인 화면에 한 줄 안내 + 로그인 후 같은 붙여넣기 화면으로(앱 로그인도 callbackUrl 을 이어 줌, 본문은 URL 에 싣지 않고 `from=share` 표시만). 로그인 사이 글을 잃으면 토스트로 다시 공유 안내.
- [15:41] 체크포인트 E(빈 공유) — 텍스트가 비면 붙여넣기 화면을 열고 토스트 1회(쓰던 글은 건드리지 않음). 이미지·파일은 공유 목록에 Lingofy 가 아예 나오지 않음(Manifest text/plain 만) → 보일 화면 없음.
- [15:41] 체크포인트 F(진입 카드) — 오늘의 회화 카드·주제 고르기의 붙여넣기 카드 변경 없음. 발견성은 APK 업데이트 메모(`AppRelease.notes`)에 한 줄 제안(앱/웹 분기 3곳 원칙 유지).
- [15:50] 체크포인트 G(현재 vs 제안) — 현재 7단계(복사→앱→오늘→[주제 고르기]→[문장 붙여넣기]→길게 눌러 붙여넣기→만들기) vs 제안 3단계(공유→Lingofy 선택→만들기). 한 폭 보기에서는 현재·제안 휴대폰을 나란히 둠.
- [15:50] 데모 v1 완료 — `docs/demo/task-052-share-target-v1.html`(단일 HTML·인라인만, 토큰 `src/app/globals.css@sha256:a314f18f1807`). `check.mjs lint --expect task-052-v1` → **DEMO_LINT_PASSED**. 엔진명 0건. 상태 탭 9개(G·A·B·C1·C2·C3·D·E·F), 폭 360/390/412/세 폭 나란히, 밝게/어둡게, 휴대폰 안 버튼 실제 동작(로그인→복귀·시트·되돌리기·자르기·서버 판정 흉내·빈 공유). 「결정 필요」 패널에서 안을 고르면 해당 상태가 그 안으로 다시 그려짐(기본 = 권고).
- [15:50] 브라우저 확인(로컬 정적 서버 127.0.0.1:3091 임시, 확인 후 종료·캡처 삭제): JS 오류 0(파비콘 404 만), 페이지 가로 넘침 0(390 뷰포트 포함), 휴대폰 안 가로 넘침 0, 11px 미만 글자 0. [이 문장으로 수업 만들기] 하단 위치(780 중) — A·C1·C3: 360=651·390/412=630, B 도착 후 360=703, **C2 360=771**(버튼은 첫 화면 안, 아래 안내 한 줄만 스크롤), D·E 537~558.
- [15:50] 디자인 스킬: layout·component·design-review·a11y-review(project-ui-system 미적용 — 학습 앱 화면) / 자체 점검 P0 0·P1 0(한 폭 보기에서 현재·제안이 세로로 쌓여 비교가 어려웠던 P1 1건은 나란히 배치로 고침)·P2 2, a11y Critical 0·Major 0·Minor 3. 남은 P2: ① C2 360폭에서 버튼 아래 안내 한 줄이 스크롤로 밀림 ② 50자 미만·2,000자 초과일 때 버튼이 눌리는 모양 그대로(현재 화면 동작 유지 — aria-disabled 만, 누르면 이유 토스트). 남은 Minor: ① 데모는 첫 렌더에 휴대폰마다 `role=status` 띠가 있어 화면 낭독기가 한꺼번에 읽음(실제 앱은 화면 하나) ② D2-B 시트가 자동으로 열릴 때 데모는 초점을 옮기지 않음(구현은 기존 `Sheet` 가 제목으로 옮김) ③ 데모의 처음 토스트(E·D 글 못 받음)는 다음 조작까지 남음(실제는 몇 초 뒤 사라짐).
- [15:50] 사실 확인 메모: 네이티브 브리지 실제 경로는 `src/modules/infra/native/{bridge,appLogin,index}.ts`(이력서 설계 초안의 `.../native/bridge/` 폴더는 없음). `MainActivity` launchMode=`singleTask`. 앱 로그인(`AppLoginArea`·`AppDeepLink`)은 이미 callbackUrl 을 이어 줌 → D 의 「로그인 뒤 같은 화면」은 기존 경로로 가능 [가능성 높음]. 업데이트 시트는 `AppRelease.notes` 를 「바뀐 점」으로 보여 줌 → D6-A 는 화면 코드 없이 배포 메모로 가능 [확실].

### 결정 필요 (사용자 결정 — 데모 「결정 필요」 패널과 같은 내용)
| 항목 | 선택지 | 권고 | 권고 이유 |
|---|---|---|---|
| D1 공유로 들어왔다는 표시 | A 맨 위 안내 띠 / B 토스트 한 번 / C 표시 없음 | **A** | 토스트는 사라져 「왜 글이 들어 있지?」에 답하지 못함. 「아직 아무 데도 보내지 않았어요」는 개인 글이 서버로 갔는지에 대한 안심 문구라 남아 있어야 함. 높이 약 60px로 360폭에서도 버튼이 첫 화면 안에 남음. B·C 는 되돌리기·자르기 버튼을 둘 자리가 없음 |
| D2 쓰던 글이 있을 때 새 공유 | A 바꾸고 띠에 [쓰던 글로 되돌리기] / B 먼저 확인 시트 / C 뒤에 이어 붙이기 | **A** | 방금 한 공유가 가장 분명한 뜻이고 매번 묻지 않음. 화면을 떠나기 전까지 되돌릴 수 있어 잃지 않음. 쓰던 글은 앱이 켜진 채 남은 초안일 때만 생겨 드묾(앱을 새로 켜면 초안이 비어 있음 [가능성 높음]). 단점: 화면을 떠나면 쓰던 글은 되돌릴 수 없음 |
| D3 2,000자 초과 | A 다 넣고 [2,000자에 맞춰 자르기](문장 끝, 되돌리기) / B 자동으로 잘라 넣고 알림 / C 넣지 않고 안내 | **A** | 무엇이 빠지는지 보고 고르고, 한국어 설명을 직접 지워 일본어를 더 남길 수 있음. 직접 붙여넣은 긴 글에도 같은 줄이 생겨 규칙이 하나. C 는 카톡 메시지를 일부만 골라 공유하기 어려워 막힘. 주의: A 는 현재 붙여넣기 동작에도 줄 하나를 더하는 변경 |
| D4 로그인 전 공유 | A 로그인 화면에 한 줄 안내 + 로그인 뒤 붙여넣기 화면 / B 안내 없이 로그인 뒤 붙여넣기 화면 | **A** | 카톡에서 왔는데 로그인 화면만 보이면 글이 사라진 것처럼 보임. 로그인 화면 변경은 문구 한 줄(본문은 주소에 싣지 않고 「공유에서 왔다」 표시만). 단점: 인증 경로 화면을 조금 건드림 |
| D5 글이 빈 공유 | A 붙여넣기 화면 + 토스트 / B 앱만 열고 안내 없음 | **A** | Lingofy 를 고른 행동에 응답이 있고 쓰던 글은 건드리지 않음. 사진·파일 공유는 목록에 Lingofy 가 아예 안 나와 해당 없음 |
| D6 공유 기능 알리기 | A 1.0.3 업데이트 안내 「바뀐 점」에 한 줄 / B 붙여넣기 화면 팁(앱에서만) / C 알리지 않음 | **A** | 화면 코드 변경 없음(`AppRelease.notes`). 앱/웹 분기를 세 곳(로그인·음성 인식·업데이트 띠)으로 둔다는 원칙 유지 — B 는 네 번째 분기를 만듦 |

- F(오늘의 회화 진입 카드): **변경 없음** — 공유는 붙여넣기 화면으로 바로 들어감. 오늘 홈 카드·주제 고르기 붙여넣기 카드·수업 끝 카드의 붙여넣기 링크 모두 그대로.
- 데모가 전제한 동작(사용자 이견 시 v2): 공유 본문은 URL·로그·서버에 싣지 않고 화면에 채운 뒤에는 기존 초안(sessionStorage)에만 / 한 번만 채움 / 앱이 켜져 있으면 보던 화면(수업·회화 중 포함)에서 붙여넣기 화면으로 넘어가고 기기 뒤로 가기는 보던 화면으로, 꺼져 있었으면 앱을 닫고 카톡으로 [가능성 높음 — singleTask] / 입력칸 자동 포커스 없음 / 1만 자 넘는 공유는 앞 1만 자만 받음(앱 메모리 보호, 수치는 developer·reviewer 확정) / 글 공유에만 목록에 나옴.
- 확인 못 한 것: ① 카톡 「공유」가 이 폰에서 안드로이드 공유 목록을 띄우는지·넘어오는 글에 보낸 사람·시간 머리말이 붙는지(실기기 전) ② 수지센세 글의 실제 길이·한국어 설명 비율(서버 기준 일본어 30% 이상 — 한국어 위주 글은 C3 처럼 막힘) ③ 로그인 창이 열린 사이 앱이 메모리에서 밀려나는 빈도(D 「글을 받지 못함」).
- 다음: Leader 가 Artifact 게시·`check.mjs status --to review_requested --version 1` → 사용자 승인 뒤 구현 가이드(`docs/screens.md` §12-2 C 보강, 승인 버전 명시). 그 전에는 `docs/screens.md`·코드 수정 없음.
