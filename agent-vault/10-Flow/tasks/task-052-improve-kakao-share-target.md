---
task_id: task-052
title: "카카오톡 공유하기 수신 — 안드로이드 공유(text/plain) 대상 등록 + 오늘의 회화 붙여넣기 화면 자동 채움 (IMP-0004, 네이티브·APK)"
status: done
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
updated: 2026-10-11
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-052-share-target-v1.html"
  artifact_url: ""
  content_sha256: "c6851e6d7601298a2798791272196f5284d47aa7f785ce91d93d7bb95505e1a5"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-11T10:11:48+09:00"
  approval_quote: "데모 v1 승인, D1~D6은 모두 A"
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
| v1 | 승인 | docs/demo/task-052-share-target-v1.html | - | "데모 v1 승인, D1~D6은 모두 A" | 10-11 10:11 |

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

## 사용자 결정·지시 (2026-10-11)
- **데모 v1 승인 2026-10-11 10:11:48** — 원문 「데모 v1 승인, D1~D6은 모두 A」 (task-052 에 대한 승인 — task-051 은 따로 승인됨). 최종 결정: D1 A 맨 위 안내 띠 · D2 A 바꾸고 [쓰던 글로 되돌리기] · D3 A 다 넣고 [2,000자에 맞춰 자르기] · D4 A 로그인 화면 한 줄 안내 + 로그인 뒤 같은 붙여넣기 화면 · D5 A 붙여넣기 화면 + 토스트 · D6 A APK 업데이트 안내 「바뀐 점」 한 줄(`AppRelease.notes`).
- **지시**: 「카톡 공유는 todo로 만들어놓고 apk는 작업은 정상적으로 실시해」 → **카톡 「공유」 실기기 동작 확인은 사용자 todo 로 남기고, 그 확인 결과를 기다리지 않고 APK 작업을 정상 진행한다.** 확인 결과가 「공유 목록에 안 뜸」이면 만든 것의 가치가 줄어든다는 위험은 Leader 가 이미 알렸고 사용자가 알고 결정했다(규칙 7 — 반복하지 않음).

## 사용자 TODO (기다리는 사용자 몫 — 구현을 막지 않음)
- [ ] **카톡 「공유」 동작 확인**(APK 설치 전에도 지금 가능): 카카오톡에서 수지센세 메시지를 길게 눌러 「공유」 → ① 안드로이드 공유 목록(Chrome·메모 같은 앱들)이 뜨는가 ② 넘어오는 글에 보낸 사람·시간 머리말이 붙는가(글자 수·일본어 비율에 영향). 결과를 알려 주세요.
- [ ] **새 APK(1.0.3) 설치 뒤 실기기 확인**: 공유 목록에 Lingofy Japanese 가 나오는가 · 꺼진 앱/켜진 앱 둘 다에서 붙여넣기 화면에 글이 채워지는가 · 로그인 전 공유 · 쓰던 글이 있을 때(되돌리기) · 2,000자 초과(자르기).

## Leader 결정 — 구현 계약 (2026-10-11)
- **judge C1(`codex_gate`, R2)**: `codex_required: false` — Codex 외부 검토 생략(입력·결과 스크래치 `judge-052-c1*.json`).
- **브리지 계약**(`src/modules/infra/native/`, 이름 고정 — dev-N 이 구현, dev-W 가 사용): `peekSharedText(): Promise<boolean>`(보관 중인 공유가 있는지, 본문 안 줌) · `consumeSharedText(): Promise<{ text: string; truncated: boolean } | null>`(**한 번만** 돌려주고 비움; 앱 밖/없음/만료 → null) · `onSharedText(cb: () => void): () => void`(앱이 켜진 채 새 공유가 도착했을 때 신호만 — 본문 없음, 해제 함수 반환). 브라우저(비앱)에서는 전부 no-op(false/null).
- **네이티브**: Manifest `ACTION_SEND`+`CATEGORY_DEFAULT`+`mimeType text/plain` 만(`SEND_MULTIPLE`·이미지·파일 제외) · `MainActivity` 가 `onCreate`/`onNewIntent` 의 `EXTRA_TEXT`(문자열)만 읽음, 활동 재생성 때 같은 인텐트 재처리 방지 · 보관은 **메모리만**(정적 보관, 디스크·로그·URL 금지) · **길이 상한 10,000자**(코드포인트 기준 앞부분, `truncated` 표시) · **TTL 30분**(로그인 왕복 허용) · 소비하면 즉시 비움 · 플러그인 등록은 `MainActivity` 에서 `super.onCreate` 앞.
- **웹 이동**: 앱 셸의 작은 클라이언트 구성요소가 마운트·`resume`·`onSharedText` 때 `peekSharedText()` → 있으면 `/study/today/talk/new/paste?from=share` 로 이동(로그인 전이면 기존 `callbackUrl` 흐름), 붙여넣기 화면이 `consumeSharedText()` 로 채움. 본문은 URL 에 싣지 않는다.
- **APK**: `kaiwaVersionCode` 3→4(1.0.3). 빌드 스크립트의 **배포(복사·`AppRelease` 쓰기) 단계는 사용자 push·배포 승인 전에는 실행하지 않는다** — 로컬 산출물만 만든다.
- **분담**: designer = `docs/screens.md` 구현 가이드 · **dev-N** = `android/**`·`src/modules/infra/native/*.ts`(+시험)·`tests/live/fake-capacitor.js` 확장 · **dev-W**(가이드 뒤) = 앱 셸 구성요소·`LessonPasteScreen.tsx`·로그인 화면 한 줄·시험.

## Designer 구현 가이드 기록 (task-052)
- [10:21] 승인 데모 `docs/demo/task-052-share-target-v1.html` (v1, sha256 앞 12자 `c6851e6d7601` 재확인, 토큰 `globals.css@a314f18f1807` 지금과 같음) → `docs/screens.md` **§20 카카오톡 공유하기 수신** 신규(20-1 결정 최종값 ~ 20-11 데모와 다르게 쓴 곳). 브리지 이름은 Leader 계약 그대로(`peekSharedText`·`consumeSharedText`·`onSharedText`, 기존 `onAppResume`·`isNativeApp`). 문구는 데모 `SH` 객체와 같은 글자.
- [10:21] 바꾼 기존 줄: `docs/screens.md` §12-2 C 끝에 「→ §20」 포인터 한 줄 **추가만**(기존 서술 삭제·수정 없음). §2 화면 목록 행·머리 변경 이력 줄은 손대지 않음.
- [10:21] 데모·계약과 다르게 쓴 곳(§20-11): ① 로그인 안내 줄을 오류·미설정 알림 **아래**, 로그인 버튼 바로 위(데모는 오류 없는 화면만 그림) ② 자르기 줄 문장에 `aria-live`·버튼 `aria-describedby`(모양 같음) ③ 공유 글 `\r\n→\n`·앞뒤 공백 정리 ④ **`ShareReceiver` 를 Leader 계약의 「앱 셸」이 아니라 루트 레이아웃 `src/app/layout.tsx` 에 마운트** — 로그인 전 콜드 스타트는 `(app)` 셸이 그려지지 않아 D4-A 안내가 나올 수 없기 때문(`KeyboardInset` 과 같은 자리) ⑤ `/login` 에 있을 때는 붙여넣기 주소로 이동해 proxy 리다이렉트에 맡기지 않고 로그인 주소의 `callbackUrl` 을 직접 바꿈(결과 주소 같음). 구조 변경(재승인 필요)은 없음 [가능성 높음 — 보이는 화면은 데모와 같고 마운트 위치·이동 방법만 다름].
- [10:21] dev-W 가 헷갈릴 만한 점: ⓐ `consumeSharedText()` 는 **붙여넣기 화면만** 부른다(`ShareReceiver` 는 `peek` 만) ⓑ `?from=share` 마운트에서 `null` 이면 「받지 못했어요」 토스트, 화면에 있는 동안 온 이벤트에서 `null` 이면 **조용히** — 두 경로를 섞지 말 것 ⓒ 받은 뒤 `history.replaceState` 로 `from=share` 를 지워야 새로고침에 토스트가 다시 안 뜸 ⓓ effect 취소 플래그로 consume 결과를 버리면 글을 잃음(StrictMode) — `handledRef` 로만 막음 ⓔ `prev` 는 `textRef` 로 읽음(초안 복원 직후 상태 클로저가 낡음) ⓕ `TrimRow` 는 공유 전용이 아니라 직접 붙여넣기에도 나옴(D3-A) ⓖ `Btn size="sm"` 은 38px → `className="min-h-11"` 로 44px ⓗ 마운트 때는 `router.replace`(뒤로가기 = 앱 닫힘), resume/onSharedText 때는 `router.push`(뒤로가기 = 보던 화면) ⓘ `truncated` 는 화면에서 안 씀.
- [10:21] 확인 못 한 것: ① **D5 빈 공유는 네이티브가 빈/공백/없는 `EXTRA_TEXT` 도 보관(`peek=true`, `consume→{text:''}`)해야 성립 — 계약에 없음, Leader·dev-N 확인 필요**(버리면 D5-B 처럼 앱만 열림) ② 앱 로그인 딥링크(VIEW 인텐트) 도착 때 보관 중인 공유를 지우지 않는지(D4) ③ 콜드 스타트에서 `resume` 이벤트가 같이 오는지(중복은 `pending` ref 로 막음) ④ Next 16 `window.history.replaceState` 의 라우터 연동(안 되면 `router.replace(…, {scroll:false})`) ⑤ 콜드 스타트 뒤 기기 뒤로 가기가 앱을 닫고 카카오톡으로 돌아가는지(`singleTask`, 실기기) ⑥ `replaced` 띠 + `TrimRow` 동시 표시 때 360 버튼 위치(데모에 없는 조합, 첫 화면 밖으로 밀릴 수 있음 — 허용으로 적음).
- [10:21] D6 배포 메모 제안(§20-10): 「카카오톡에서 글을 공유하면 바로 '문장으로 수업 만들기' 화면에 들어가요.」(데모 D6-A 예문 그대로, 엔진명 0건). 디자인 스킬: 이번 단계 새로 읽지 않음 — 데모 v1 자체 점검(P0 0·P1 0·P2 2, a11y Critical 0·Major 0·Minor 3) 승계, 가이드에서 Minor ①(첫 렌더 다중 status)은 실제 화면이 하나라 해당 없음.

## Leader 처리 — designer 구현 가이드(§20) 검토 (2026-10-11)
- 가이드에 승인 버전(v1, sha256 앞 12자 `c6851e6d7601`)이 적혀 있음을 확인 → 데모 게이트 `activate` 완료.
- **편차 5건 중 받아들임**: ① `ShareReceiver` 를 계약의 「앱 셸」 대신 **루트 레이아웃**에 둔다 — 근거: 로그인 전 콜드 스타트에서는 `(app)` 셸이 그려지지 않아 D4-A 안내가 나올 수 없다. 보이는 화면은 데모와 같아 재승인 불필요로 판단. **단, 모든 라우트에 실리는 클라이언트 구성요소라 reviewer 가 SSR 안전·비앱 환경 완전 no-op·하이드레이션·성능을 집중 감사** ② `/login` 에서 `callbackUrl` 직접 변경(결과 주소 같음) ③ 로그인 안내 줄 위치(오류 알림 아래) ④ `aria-live`·`aria-describedby` 보강 ⑤ 공유 글 `\r\n→\n`·앞뒤 공백 정리.
- **계약 보완(D5 때문)**: 빈 공유도 네이티브가 보관해 `peek → true`, `consume → {text:'', truncated:false}` — dev-N 에게 전달함. (b) 로그인 딥링크(VIEW)가 보관을 지우면 안 된다는 점과 (c) `peek` 가 보관을 비우지 않는다는 점은 계약 그대로.
- **알려진 경계(가이드)**: 로그인 대기 중 다른 글을 공유하면 로그인 주소가 바뀌어 대기가 풀릴 수 있다(드묾). 쓰던 글이 있는데 2,000자 넘는 공유가 오면 360폭에서 버튼이 첫 화면 밖으로 밀린다(스크롤 1곳 안이라 허용).
- **D6 문구(deployer 가 `AppRelease.notes` 에 사용)**: 「카카오톡에서 글을 공유하면 바로 '문장으로 수업 만들기' 화면에 들어가요.」 — 1.0.3 에 다른 바뀐 점이 있으면 줄을 나눠 첫 줄로.
- **dev-W**: dev-N 의 브리지 3함수가 들어온 뒤 배정(가이드 20-8 순서 7).

## 감사·QA 결과 (2026-10-11, 대상 커밋 `51d1b33`) — 모두 PASS
- **감사**: REV-181 PASS-with-fixes(High 0·Medium 1·Low 4) → M-1(`replaceState` 가 `history.state` 를 지움 → `dropShareMark` 로 상태 유지)·L-1(공유 후 `EXTRA_HTML_TEXT`·`SUBJECT`·`TITLE` 도 지움) 수정 → **REV-182 PASS**(좁은 재감사, 신규 Low 3·비차단). versionCode 는 올리지 않음(1.0.3 미게시 — `origin/main` 의 `kaiwaVersionCode` 는 3, 게시 흔적 없음).
- **QA 레인 C** [[task-052-qa-c-record]] PASS: 도착·덮어쓰기(되돌리기 왕복)·50자 미만·2,000자 초과 자르기(독립 계산 일치)·한국어 거절(400, LLM 0회)·로그인 전 안내·복귀 후 채움·만료 토스트 1회·빈 공유 토스트, 3폭 가로 넘침 0·터치 44px 미만 0. [수업 만들기] 하단 y 는 가이드 수치보다 일정하게 28px 낮음(데모 폰 상태바 높이로 추정 — 첫 화면 780 안, 실기기 확인).
- **QA 레인 D** [[task-052-qa-d-record]] PASS: 새로고침 후 재채움/토스트 없음 · 콜드·풀 페이지 로드 모두 `history.state` 에 `__NA`·트리 유지 · 뒤로/앞으로 하드 리로드 없이 정상(대조군 `replaceState(null)` 은 증상 재현 → 점검식이 유효) · 신호·resume 15조합 이동 1회·consume 1회 · 일반 브라우저 13화면 콘솔 오류 0·리스너 0 · 변경 전 커밋 대비 DOM 12화면 일치(나머지 1개 = 설계된 로그인 한 줄) · 구 APK·플러그인 오류 4경로 안전 · 루트 레이아웃 5개 라우트 하이드레이션 경고 0 · XSS 문자열 텍스트로만 · 본문이 URL/state/storage/콘솔/요청 34건에 없음.
- **QA 레인 E** [[task-052-qa-e-record]] PASS: 게시 없는 로컬 빌드 성공 · versionCode 4/1.0.3·debuggable 아님·서명 검증 통과·**서명자가 직전 릴리스와 동일(`a4c23dca…`) → 덮어쓰기 설치 시 로그인 유지** · 병합 Manifest 필터 `SEND+DEFAULT+text/plain` 정확히 1개·`SEND_MULTIPLE` 0·직전(1.0.2) 대비 차이는 버전 2줄+필터 1개뿐(권한 4개·exported 2곳 불변) · dex 에 플러그인/보관함 클래스 · APK 452개 항목에 민감 파일 0 · JUnit 12/12 · `adb devices` 0대.
- **알려진 Low (백로그, 웹 쪽이라 APK 없이 고칠 수 있음)**: ① `/paste?from=share` 풀 페이지 로드에서 `consumeSharedText` 가 2번 불림 — `ShareReceiver.tsx` 45행이 `await peek` 뒤에 `window.location` 을 읽는데 그 사이 화면이 `from=share` 를 지워 `stay` 대신 `signal` 로 판정됨. 첫 호출이 성공하면 증상 없음, 실패하는 드문 경우에 「받지 못했어요」 토스트와 「넣어 두었어요」 띠가 같이 뜸. 수정 후보: 위치를 `await` 앞에서 읽기 ② `android/gradlew` 의 git 모드가 100644 라 `git archive` 추출본에서 빌드 실패 → **Leader 가 인덱스 모드를 100755 로 바꿈**(내용 해시 동일) ③ `PlanScreen.tsx` 82·118행에도 `replaceState(null, …)` 가 있음(이 task 범위 밖) ④ `ChallengeScreen` 방식으로 통일 검토.
- **고지**: QA 레인 E 가 AAR 1개를 운영 `thekaiwa-apk/.cache` 에서 읽기 전용으로 복사(수정 없음, sha256 고정값 일치). QA 레인 D 의 `qa-admin` 읽기 전용 이동으로 `qa-admin` 의 오늘자 Attendance 가 1행 늘어 남아 있음(id `cmv36o46f0029w1oz3qzgenq1`, 지시가 QA4 한정이라 지우지 않음).
- **배포 계획(사용자 push·배포 승인 뒤, deployer)**: ① **웹 먼저** push(`git push origin main` → webhook blue/green, task-051 과 함께) ② **그다음 APK**: deployer 가 origin 기준으로 **다시 빌드**(dev-N 의 로컬 APK `thekaiwa-1.0.3-4.apk` 는 L-1 수정 이전 빌드라 **사용 금지**), `releases/thekaiwa-1.0.3.apk` 가 이미 있으면 덮어쓰지 말고 versionCode 를 올린다, `AppRelease.notes` 첫 줄 = 「카카오톡에서 글을 공유하면 바로 '문장으로 수업 만들기' 화면에 들어가요.」 ③ 사용자 폰에서 1.0.3 덮어쓰기 설치 → 실기기 확인(아래 사용자 TODO).
- **상태**: `review` · `waiting: push_confirm`. 데모 게이트 `deactivate` 완료.

## 배포 기록 (2026-10-11, Leader) — 웹 + APK 1.0.3
- **웹**: task-051 과 같은 push·릴리스 `20261011-121420-0250368d`(`RELEASE_RESULT ok`, 헬스 200, pm2 3개 online) — `ShareReceiver`·붙여넣기 화면·로그인 한 줄·브리지가 운영에 올라감(구 APK 에서는 no-op).
- **APK**: `bash scripts/build-apk.sh --publish`(NFS 작업 트리 = push 된 `0250368`, 작업 트리 깨끗) → `rc=0`. **versionCode 4 · versionName 1.0.3 · abi arm64-v8a · 35,216,161 bytes · debuggable 아님 · sha256 `943a014a3655bcdee9186ea9e6893cddb44d163a82d518f79cbec2c0d93ca0d4` · 서명자 SHA-256 `a4c23dca…9e47`(1.0.2 와 동일 → 덮어쓰기 설치·로그인 유지)**. 게시 파일 `DATA_ROOT/releases/thekaiwa-1.0.3.apk`(기존 1.0.0~1.0.2 파일 유지, 덮어쓰기 없음).
- **공개 전 검증(게시될 파일 직접 검사)**: `aapt2` 병합 Manifest 에 `SEND`+`DEFAULT`+`text/plain` 필터, 기존 `MAIN/LAUNCHER`·`VIEW` 딥링크 필터 유지 · dex 에 `SharedTextHolder`·`SharedTextPlugin` · 크기가 1.0.2 보다 88바이트만 큰 것은 압축되지 않은 큰 네이티브 라이브러리가 대부분이라서(새 클래스 존재는 위 검사로 확인).
- **`AppRelease` 행 1개 삽입**(운영·개발 공용 표, 환경 컬럼 없음): versionCode 4 · `1.0.3` · `thekaiwa-1.0.3.apk` · 위 sha256 · `minSupported 2`(변경 없음 — 강제 업데이트 없음) · notes = D6 문구 「카카오톡에서 글을 공유하면 바로 '문장으로 수업 만들기' 화면에 들어가요.」. 되돌려야 하면 versionCode 4 행 하나를 SQL 로 지우면 된다(앱 코드에는 삭제 경로 없음) → `/api/app/version` 이 다시 1.0.2 를 최신으로 돌려줌.
- **공개 후 확인**: `/api/app/version` — 헤더 없음 `latest 1.0.3·latestCode 4` · 구 앱(build 3) `updateAvailable·reinstallRequired true, updateRequired false` · 새 앱(build 4) 전부 false · build 1 `updateRequired true`(기존 규칙). 다운로드 `latest.apk` 로컬·공개 도메인 모두 200·35,216,161 bytes·**sha256 기록값과 일치**.
- **네이티브 변경 고지(CLAUDE.md 금기 이행)**: 이 배포에는 네이티브 변경(Manifest `ACTION_SEND` 필터·`MainActivity`·`SharedTextPlugin`)이 있어 **사용자 폰에서 APK 재설치(덮어쓰기)가 필요**하다. 설치 후 실기기 확인은 위 「사용자 TODO」.
- dev-N 의 로컬 APK(`thekaiwa-apk-052n/out/…-4.apk`)는 L-1 수정 이전 빌드라 **쓰지 않았다**(게시본은 push 된 HEAD 에서 새로 빌드).

## 사용자 확인 (2026-10-11)
- 원문 「APK업데이트 후에 검증완료했어. 이제 다음 작업 이어서 진행해줘」 — **APK 1.0.3 업데이트 후 사용자 검증 완료.** 어떤 항목을 봤는지·이상이 있었는지는 말씀이 없었으므로 「검증 완료」만 기록한다(세부 통과 항목을 추정해 적지 않는다). 사용자 TODO 의 ①카톡 「공유」 확인 ②실기기 확인은 이 보고로 종결로 본다.

## 최종 요약 (Leader, 사용자용 — 2026-10-11)
- **무엇을 했나**: 카카오톡(등 글 공유가 되는 앱)에서 글을 공유하면 Lingofy Japanese 가 공유 목록에 나오고, 선택하면 오늘의 회화 「문장 붙여넣기」 화면에 글이 채워진다. 꺼진 앱에서도, 켜진 앱에서도 동작하며, 로그인 전이면 로그인 뒤 같은 화면으로 돌아온다. 쓰던 글이 있으면 공유 글로 바꾸고 [쓰던 글로 되돌리기]를 주며, 2,000자를 넘으면 [2,000자에 맞춰 자르기]를 준다. 빈 공유는 토스트로 알린다. 공유 글은 [수업 만들기]를 누르기 전에는 서버로 나가지 않는다.
- **구조**: 안드로이드 Manifest 에 `ACTION_SEND text/plain` 필터 → `MainActivity` 가 글을 **메모리에만** 보관(상한 1만 자·30분·한 번만 꺼냄·URL/로그/디스크에 안 남김) → 앱 셸 브리지(`peekSharedText`·`consumeSharedText`·`onSharedText`) → 붙여넣기 화면. 알림 접근 같은 자동 수집은 하지 않았다(사용자가 고른 글만 들어옴).
- **품질 게이트**: 데모 v1 승인(D1~D6 A) · 감사 REV-181(PASS-with-fixes→수정)·REV-182 PASS · QA 레인 C(화면)·D(뒤로가기·호환성)·E(APK·Manifest) 모두 PASS · 푸시 전 게이트 · 운영 읽기 전용 스모크 · 게시 파일 직접 검사(sha256·서명자 동일).
- **배포**: 웹 릴리스 `20261011-121420-0250368d`(task-051 과 함께) + **APK 1.0.3(versionCode 4, sha256 `943a014a…`)**, `AppRelease` 행 1개(`minSupported` 2 유지). 롤백: 웹 `--rollback`, APK 는 versionCode 4 행 삭제.
- **남은 Low(백로그, 모두 웹만으로 수정 가능)**: ① `/paste?from=share` 풀 페이지 로드에서 `consumeSharedText` 2번 호출(첫 호출 실패 시에만 증상) ② `PlanScreen` 의 `replaceState(null, …)` 2곳 ③ QA 가 관찰한 [수업 만들기] 하단 위치 28px 차이(가이드 수치 정정) ④ `qa-admin` Attendance 1행 잔존.
- **IMP-0004** → `done`.
