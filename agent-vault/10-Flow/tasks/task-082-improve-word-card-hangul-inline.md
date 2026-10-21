---
task_id: task-082
title: "오늘의 단어 카드 뒷면 — 표제어 한글 발음을 표제어 옆(같은 줄)에 두어 카드 높이가 모자라도 항상 보이게 (IMP-0060)"
status: done
waiting: ""
base_ref: 8fed098
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-071-improve-hangul-stored-reading, task-060-improve-deck-controls, task-033-vocab-card-face]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 단어 카드 한글 인라인
  - task-082
created: 2026-10-21
updated: 2026-10-22
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

# task-082 — 단어 카드 뒷면 한글 발음(표제어) 항상 보이기 (IMP-0060)

## 사용자 요청 (원문, 2026-10-21)
- 「단어에서 한글표기도 추가해줘」(스크린샷: 「자기소개」 새 단어 5장 + 챌린지 안내가 붙은 오늘의 단어 화면, 2번 카드 `来ました` 를 틀린 보기로 답한 뒤 «지난 카드 보는 중» — 카드에 루비·뜻·예문은 있는데 한글 발음 줄 없음)

백로그: [[IMP-0060-word-card-back-hangul-always]]

## judge 접수 (2026-10-21)
- `local_fix`·복잡도 1.07·R1·developer **sonnet**·**light 트랙**(Leader → Developer → Reviewer, 데모 게이트·QA 면제 — `DM-light-waive`). 입력 `scratchpad/judge-082-intake.json`.

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-071-improve-hangul-stored-reading]](IMP-0045) — 분석기 읽기 ≠ 저장 읽기라 숨겨지던 한글 줄을 저장 읽기로 보이게 함(다른 원인). 이번은 **분석·설정이 아니라 카드 높이 부족**.
- task-060(덱 조작 정리)·task-033(카드 면 C2-A «한글 줄은 자리가 없을 때만 뺀다»)의 규칙이 이번 현상의 직접 원인.
- 이슈 교훈 조회(`/이슈기록 관련`)는 이 작은 UI 수정에 해당 없음.

## 사실 (2026-10-21 직접 확인 — [확실])
1. 이 사용자의 앱 한글 설정 `Profile.showHangul = true`(읽기 전용 SELECT, 불리언만 확인). 기본값도 «켬» — **설정 문제 아님**.
2. 한글 표기 기능은 이미 있다 — `VocabCardFace.tsx` 뒷면 표제어 `HangulLine`(183~198행)·예문 `HangulLine`(205행). QA 계정(기본 세트 `出す`)으로 같은 «지난 카드·틀렸어요» 화면을 열면 `[다스]`·`[테오 다시떼 쿠다사이.]` 가 나온다(스크린샷 확인).
3. 분석 API `POST /api/v1/text/annotate` 는 `来ました`·«去年 日本に来ました。» 에 정상 발음(キ·マシ·タ …)을 돌려준다 — 데이터 문제 아님.
4. **원인 = 카드 높이**: 뒷면은 «카드에 자리가 없을 때만 한글 줄을 뺀다(C2-A, 번역 우선 — 예문 줄 → 그래도 넘치면 표제어 줄, 되돌림 없음)» 규칙이다. 주제 세트·챌린지 화면은 카드 위에 안내 2줄(«AI 가 만든 단어…»·«챌린지 · 오늘 2/4장…»)이 더 붙어 카드가 눌린다 — 사용자 화면의 카드 ≈ 226 css px(기본 세트 ≈ 339px).
5. **재현**: QA 계정 같은 카드(뒷면)에서 뷰포트 높이만 줄이면 — 카드 313px 에서 한글 줄 2개, 298 → 2, 261 → 2, **224 → 1, 187 → 0**. 사용자 카드는 내용이 더 길어 226px 에서 0개.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **표제어 한글을 표제어와 같은 줄 오른쪽(인라인)에 둔다** — 세로 공간을 쓰지 않아 카드가 눌려도 항상 보인다(긴 표제어는 flex-wrap 으로 아래 줄에 내려가며 그때는 공간을 쓴다). **표제어 한글은 더 이상 «자리 부족» 으로 빼지 않는다**(`DropLevel` 2 단계 폐지 → 0|1).
- **예문 한글 줄은 지금처럼 자리가 있을 때만**(번역 우선 유지). 따라서 사용자의 이 카드(226px)에서는 표제어 한글은 나오고 예문 한글은 여전히 빠질 수 있다 — 최종 보고에 명시하고, 더 원하면 후속(안내 2줄 압축 등).
- 앞면·다른 화면(회화방·수업·단어장)·문구·API·DB 는 건드리지 않는다. 신규 문구 0.

## 구현 지시 (developer, sonnet — 신규 소환, 이어받기 없음)
1. `src/components/vocab/VocabCardFace.tsx` 뒷면 표제어 블록(183~198행): `JaText`(표제어)와 `<HangulLine state={backHangul} size={13} inline />` 을 `flex min-w-0 flex-wrap items-baseline gap-x-2` 한 줄에 둔다(표제어 `JaText` 에 `max-w-full` 을 더해 `truncate` 가 유지되게). `HangulLine` 의 `inline` 속성(span, 일본어 뒤 흐름)은 이미 있다 — 새 컴포넌트 불필요. 더 이상 `dropLevel >= 2 ? null : …` 로 가리지 않는다.
2. 단계 정리: `DropLevel` 을 `0 | 1`(1 = 예문 `[한글]` 뺌)로, `nextDropLevel`·`pickDropLevel`·측정 효과(139~149행)·머리 주석(4~8행 «예문 줄 → 그래도 넘치면 표제어 줄»)을 맞춘다. 표제어 줄은 단계와 무관하게 항상 그린다.
3. 시험: `src/components/vocab/__tests__/cardFace.test.ts` 의 `nextDropLevel`/`pickDropLevel` 기대값을 새 규칙으로(예: `nextDropLevel(1,true)===1`, `pickDropLevel([true,true])===1`), 뒷면 표제어 한글이 `inline` 으로 `dropLevel` 과 무관하게 그려지는 소스·렌더 단언(기존 시험 방식 따라) 추가. 변이 시험 ≥ 2(임시 파일 + mv 후 원복·`cmp`).
4. 범위 밖: 앞면 `[한글]`(task-060), `useVocabDeck`·`VocabDeck`·`DeckToolbar` 로직, `JapaneseText.tsx`(필요하면 읽기만 — 바꿔야 하면 멈추고 보고), 문구·API·DB. 엔진·모델명 0. 파일 12개 초과·신규 화면·마이그레이션이 필요해 보이면 멈추고 Leader 에게(standard 승격).
5. 검증(light 트랙 실행 증빙): 미러 `bash scripts/make-mirror.sh dev082` 새로 만들고 거기서만 — 관련 시험(`src/components/vocab` 전체·`src/components/common`)·`tsc --noEmit`·eslint 변경 파일. `npm test` 금지. 브라우저·dev 서버·DB·LLM 호출 금지(실화면 확인은 Leader). 커밋·푸시·배포 금지.
6. 기록 `agent-vault/10-Flow/tasks/task-082-dev-record.md`(변경 파일·결정과 근거·시험 수·변이 결과·한계·reviewer 가 볼 곳). 최종 답 8줄 이내 — 실제 실행한 결과만.

## 완료 기준
- 뒷면 표제어 한글이 카드 높이와 무관하게 항상 그려진다(긴 표제어는 아래 줄로 내려가도 보임), 예문 한글은 자리 있을 때만.
- 관련 시험·tsc·eslint 0 오류, 변이 시험이 새 규칙을 잡는다.
- Leader 실브라우저 확인: 뷰포트 892·780·740·700 에서 `한글 발음:` 표제어 줄이 모두 존재, 가로 넘침 0, 표제어 truncate 유지.

## 상태 로그
- 2026-10-21 사용자 스크린샷·요청 → Leader 가 코드·설정·분석 API·재현으로 원인 확정(사실 1~5) → IMP-0060 접수 → judge(light) → 이력서 작성 → developer(sonnet) 소환.

- 2026-10-21 **developer(sonnet) 완료**: `VocabCardFace.tsx` 뒷면 표제어 + `<HangulLine inline />` 을 `flex-wrap items-baseline gap-x-2` 한 줄에, `DropLevel` `0|1`, `cardFace.test.ts` 10건·`vocab`+`common` 시험 489건 통과·`tsc` 0·eslint 0·변이 6/6 잡힘(원복 `cmp`). diff 2파일 +61/-21 — Leader 가 diff 직접 확인(범위·규칙 일치).
- 2026-10-21 **Leader 실브라우저 확인**(미러 `t081int` 를 NFS 와 동기화해 새로 빌드, 종료 0·`APP_ENV=LOCAL`·LLM 차단·3011): 같은 재현 세션·같은 카드(뒷면)에서 뷰포트 높이별 한글 줄 수 — **수정 전** 카드 313/298/261/224/187px → 2/2/2/1/0개, **수정 후** → 2/2/2/**2/1**개(표제어 한글은 187px 에서도 남음). 가로 넘침 0(740·700). 700px 스크린샷: `出す [다스]` 가 한 줄, 예문 한글만 빠짐(번역 우선, 설계대로). 긴 표제어(합성 «一生懸命頑張って出しましょう…»)는 한 줄 말줄임 + 한글이 아래 줄로, 넘침 0. 정리: 재현용 QA 세트 1건·시도 5건 삭제(기준선 대조 새 행 0·사라진 기존 행 0), 서버 종료·`.env`·쿠키 삭제.
- 2026-10-21 `docs/screens.md` §15-11-3 B6 의 옛 «표제어 한글도 뺌 2단계» 서술 위에 «task-082 로 대체» 표시를 붙임(이력 보존).
- 2026-10-21 **못 본 것**: 사용자 폰(WebView)·글꼴 130%·실제 AI 단어 세트의 카드 높이(≈226px) 에서의 실화면 — QA 에서 높이만 줄여 재현한 근사. 사용자 카드는 내용이 더 길어 예문 한글은 여전히 빠질 수 있음.

- 2026-10-21 **reviewer 결과(`rev-082`, 기록 `task-082-rev-record.md`) — PASS_WITH_NOTES (Critical 0·High 0·Medium 1·Low 4)**: 의도 충족·소비처·금기 이상 없음, 재실행 숫자 일치. **Medium**: 긴 가나 표제어(예 `ありがとうございます`)는 한글이 아래 줄로 내려가 세로 자리를 쓰는데 이제 되찾을 수단이 없어 카드 ≈226px 에서 번역 줄이 잘릴 수 있음 — **맞는 지적**(옛 «번역 우선» 원칙 후퇴). Low: ① 측정 효과 연결을 끊어도 시험 전부 통과(기존 공백) ② `screens.md:8392` QA 6번이 옛 2단계 서술 ③ 분석 대기 중 inline 한글이 자리를 안 잡아 줄 넘어가는 표제어는 도착 때 본문이 ≈19.5px 밀림(측정 키에 `backHangul.s` 가 있어 재측정됨) ④ SSR 단언 `!html.includes('한글 발음')` 이 항상 참(한계 기록됨).
- 2026-10-21 **Leader 결정 r2 (Medium 반영)**: `DropLevel` 을 **다시 `0|1|2`** 로 되돌리되 표제어 한글은 **인라인 유지** — 2단계(표제어 한글 뺌)는 «예문 한글을 뺀 뒤에도 넘칠 때» 만 오는 최후 수단. 짧은 표제어는 한글이 같은 줄이라 세로 비용 0 → 1단계 측정에서 안 넘쳐 2단계에 도달하지 않음 → **표제어 한글이 보이는 쪽으로만 바뀌고 이전보다 나빠지는 경우 없음**, 긴 표제어가 아래 줄로 내려가고 카드가 아주 좁은 최악만 옛 «번역 우선» 규칙대로 한글을 뺀다. 사용자에게 알린 «표제어 한글은 더 이상 자리 부족으로 빼지 않는다» 를 이 refinement 로 정정해 보고. developer(sonnet) r2 신규 소환.

- 2026-10-21 **r2 Leader 실브라우저 재측정에서 결함 발견(r3 필요)**: r2(`DropLevel 0|1|2`, 2단계 = 표제어 한글 뺌) 빌드로 새 QA 세트·1번 카드(壁) 뒷면 높이별 한글 줄 수 — 카드 313/298/261/224px → 2/2/2/2개(r1 과 같음)지만 **187px(뷰포트 700) 에서 0개**(r1 은 1개). 원인: 2단계 조건이 «1단계(예문 한글 뺌) 뒤에도 넘침» 뿐이라, 넘침의 원인이 한글이 아닌 아주 좁은 카드에서도 **세로 자리를 쓰지 않는 인라인 한글을 불필요하게 지움**(빼도 이득 0). → **r3 결정**: 2단계는 «1단계 뒤에도 넘치고 **표제어 한글이 아래 줄로 내려가 자기 줄을 차지할 때만**» 간다(인라인으로 한 줄에 있으면 빼도 높이가 안 줄므로 유지). 측정 효과에서 표제어 한글 요소가 표제어보다 아래에 있는지(`top >= 표제어 bottom − 0.5`) 읽어 `nextDropLevel(level, overflow, headwordWrapped)` 로 넘긴다. 수용 기준(브라우저): 같은 세션 700px 에서 한글 줄 ≥ 1(표제어).

- 2026-10-21 **r3 Leader 실브라우저 확인(통과)**: r3 빌드로 같은 재현 세션 — 카드 313/298/261/224px → 한글 줄 2개, **187px → 1개(표제어 `壁 [카베]` 인라인, 번역 줄 안 잘림, 예문 한글만 빠짐)**, 가로 넘침 0. 전체 시험 **4,850건 중 4,847 통과·실패 0**(최종 상태), `cardFace` 14/14·tsc 0·eslint 0 독립 재확인. 정리: 재현 세트·시도 5건 삭제(기준선 대비 새 행 0·사라진 기존 행 0), 서버 종료·`.env`·쿠키 삭제.
- 2026-10-21 **재검토(`rev-082-r3`) PASS_WITH_NOTES (Critical 0·High 0·Medium 1·Low 2)**: **Medium r3-1** — 아래 줄 판정이 `getBoundingClientRect()`(변환 반영) top/bottom 비교라, 위로 밀기로 뒤집을 때 첫 측정 시점의 카드 래퍼가 `rotate(shownX*0.05deg)` → `none` 전환의 **시작값(회전 상태)** 이면 줄바꿈된 한글을 놓친다(리뷰어 시뮬레이션: ±0.2° 부터 false). 놓치면 2단계로 못 가 긴 표제어 + 아주 좁은 카드에서 번역이 잘린 채 남음(탭 뒤집기는 정상 → 재현 어려운 증상). r3 가 새로 들인 취약성 — **맞는 지적**. Low r3-2 정적 정규식 단언은 DOM 동작을 못 잡음(조용히 통과 안 함), r3-3 예문 없는 카드는 측정 없음(r1 이전부터).
- 2026-10-21 **Leader 결정 r4**: 판정을 변환에 둔감한 레이아웃 좌표로 — `kids[last].offsetTop >= kids[0].offsetTop + kids[0].offsetHeight - 1`(두 자식의 `offsetParent` 같음·정수라 허용 오차 1). 순수 함수 `hangulOnOwnLine` 은 입력만 offset 값으로 바꾸고 허용 오차를 1 로. 수용 기준(브라우저): ① 같은 세션 높이별 한글 줄 수 유지(2/2/2/2/1) ② 페이지 안에서 offset 판정이 인라인=false·합성 줄바꿈=true·**카드 래퍼를 회전시켜도 같은 결과**(getBoundingClientRect 판정은 회전에서 틀림) 를 보임.

- 2026-10-22 **r4 완료·Leader 실브라우저 확인(통과)**: developer(sonnet) r4 — 아래 줄 판정을 `offsetTop`·`offsetHeight`(`instanceof HTMLElement` 가드·허용 오차 1)로, `hangulOnOwnLine` 경계 표·정적 단언 갱신, 변이 6/6 잡힘. (개발자의 채팅 최종 보고에는 결과가 빠지고 일일 로그 얘기뿐이어서 **소스·기록·시험을 Leader 가 직접 확인**: diff·기록 r4 절·`cardFace` 14/14·tsc 0·eslint 0 독립 재실행.) 새 빌드로 새 QA 세트·1번 카드 뒷면: **높이별 한글 줄 — 카드 313/298/261/224px → 2개, 187px → 1개**(r1·r3 와 같음). **판정 비교(실브라우저)**: ① 인라인 offset false·rect false ② 합성 줄바꿈 offset true·rect true ③ **줄바꿈 + 카드 회전 0.2°·0.5°·1° → offset true·rect false(r3 결함 재현, r4 해결)** ④ 인라인 + 회전 → 둘 다 false(오탐 없음). 정리: 세트·시도 5건·오늘 출석 행 1건 삭제(기준선 대비 새 행 0·사라진 기존 행 0), 서버·`.env`·쿠키 삭제.

- 2026-10-22 **재검토(`rev-082-r4`) PASS (Critical 0·High 0·Medium 0·Low 1)**: r3-1 해소 확인(효과의 `first`/`last`·`instanceof HTMLElement` 가드·offset 판정·허용 오차 1·deps 불변), 시험 경계 표 일치·정적 단언 슬라이스 정확, 금기·범위 0. Low r4-1(부정 단언은 한 줄 단위 — 양성 정규식이 보완, 조치 불필요). 재실행 `cardFace` 14·vocab+common 493·tsc 0·eslint 0 일치.
- 2026-10-22 **최종 상태 전체 시험**(미러 `t081int` = NFS, `diff -rq` 동일): **4,850건 중 통과 4,847·실패 0·건너뜀 3**, tsc 0, eslint 0, 빌드 종료 0(r4 빌드로 실브라우저 확인). 커밋 대상: `src/components/vocab/VocabCardFace.tsx`·`__tests__/cardFace.test.ts`·`docs/screens.md`(§15-11-3 B6 대체 표시·QA 6번) + vault 기록. **배포 = push(webhook) — 사용자 승인 대기**(사용자에게 «배포 전에 한 번 더 여쭙겠다» 고 약속함).

- 2026-10-22 **커밋·푸시·운영 배포(사용자 «커밋하고 푸시해서 배포해줘»)**: 커밋 `69a43da`(3파일 +135/-18, 경로 지정 — `.claude/agents/{deployer,leader}.md`·`.codex/**` 는 타 작업이라 제외, 비밀 값 스캔 0, 원격 0/0) → `git push origin main`(`8fed098..69a43da`, 08:08 KST) → webhook 자동 배포 → 릴리스 `20261022-080918-69a43da0`(롤백 대상 `20261021-162422-b2b1d141`), `current` 전환 08:10. 운영 확인: 헬스 `ok`(`PRODUCTION`·degraded 없음)·pm2 `thekaiwa`·`-speech-gateway`·`-speech-worker` online·재시작 0·새 릴리스 cwd·무인증 `GET /lessons/today`·`/vocab/sessions` 401·로그인 200·번들에 새 판정(`instanceof HTMLElement … offsetTop>=e-1`, 3인자 `nextDropLevel`) 포함(이전 릴리스 0개). DB 변경 없음·네이티브 변경 없음(APK 재설치 불필요).

## 운영 배포
| 일시(KST) | 커밋 | 릴리스 | 방식 | 포함 작업 | 결과 | 롤백 대상 |
|---|---|---|---|---|---|---|
| 2026-10-22 08:08~08:10 | `69a43da` (`8fed098..69a43da`) | `20261022-080918-69a43da0` | git push → webhook 자동 배포(blue/green) | task-082(단독) | 헬스 ok·pm2 3개 online(재시작 0)·무인증 401·번들 새 판정 포함 — 앱 재설치 불필요 | `20261021-162422-b2b1d141` |
- 2026-10-22 **종료** — 사용자 «폰에서 확인완료했고»(2026-10-22): 폰 확인 완료 → status done·waiting 비움. (확인 결과의 세부 — 예문 한글을 항상 보이게 할지 — 는 사용자가 따로 알리지 않아 **그 결정은 열린 채**로 둔다.)

## 최종 요약 (사용자용 — 2026-10-22 Leader 작성, 양식 docs/user-report-format.md §3 · 사용자 폰 확인 완료 2026-10-22)

### [task-082] 오늘의 단어 카드 — 단어 한글 발음이 카드가 눌려도 보이게

- **상태**: ✅ 완료 — 운영 반영·사용자 폰 확인 완료(2026-10-22)
- **무엇이 바뀌었나**: 카드 뒷면의 단어 한글 발음(`[키마시타]`)을 단어 오른쪽 같은 줄에 두어 세로 공간을 쓰지 않게 했다. 주제 세트·챌린지 화면에서 위쪽 안내 2줄 때문에 카드가 눌려 한글 줄이 통째로 빠지던 문제(기능은 이미 있었고 «자리 없으면 빼는 규칙» 이 원인)를 고쳤다. 긴 단어는 한글이 아래 줄로 내려가고, 카드가 아주 좁을 때만 마지막 수단으로 뺀다. 예문 한글은 지금처럼 자리가 있을 때만 나온다(번역 우선).
- **배포**: ✅ 운영 반영 — 커밋 `69a43da` · 2026-10-22 08:08~08:10 KST · push(webhook, blue/green) · 릴리스 `20261022-080918-69a43da0` · 결과 ok(헬스 ok·pm2 3개 online)
  - 같은 배포에 함께 실린 작업: 없음(task-082 단독, 직전 배포는 task-081 `b2b1d141`)
  - 앱 재설치 불필요(웹 배포만, DB 변경 없음). 롤백: `bash scripts/deploy.sh TheKaiwa --rollback`(대상 `20261021-162422-b2b1d141`)
- **AI 가 검증한 것**: tsc 0·eslint 0·전체 시험 4,850건 중 4,847 통과(실패 0)·reviewer 재검토 최종 PASS(Critical·High·Medium 0)·실제 Chrome 에서 카드 313~224px 한글 2줄/187px 표제어 한글 1줄·가로 넘침 0·카드 회전 중 판정 유지·운영 헬스/번들/무인증 401
  - 검증 못 한 것: 사용자 폰(WebView)·글꼴 130%·실제 AI 단어 세트의 카드 높이(≈226px, 화면 높이를 줄여 근사)·아주 긴 단어(합성만)
- **👉 사용자가 확인할 것**:
  1. 오늘의 단어 → 주제 세트(「자기소개」 등)에서 카드를 풀고 「이전」으로 돌아가 뒷면을 본다(지금부터 가능).
  2. 단어 오른쪽에 한글 발음이 나오면 정상. 긴 단어는 한글이 단어 아래 줄로 내려가도 정상.
  3. 예문 한글은 위쪽 안내 2줄이 있는 화면에서는 여전히 빠질 수 있다(번역 우선) — 정상.
- **👉 사용자가 결정할 것**: 예문 한글도 항상 보이게 할지 — 권고: 폰에서 단어 한글을 먼저 확인한 뒤 결정(하려면 위쪽 안내 2줄을 한 줄로 합치는 별도 작업 필요, 번역과 자리를 다툼)
- **남은 일**: IMP-0060·task-082 는 폰 확인 뒤 `done`.
- **이슈·위험**: 구현을 r1~r4 네 번 거침(검증에서 r2 의 불필요한 한글 삭제·r3 의 카드 회전 중 판정 오류가 나와 모두 수정). developer 가 한 번 채팅 보고에 결과를 빠뜨려 소스·기록·시험을 Leader 가 직접 확인. 작업 트리의 타 작업 미커밋(`.claude/agents/{deployer,leader}.md`·`.codex/**`)은 이번 커밋에서 제외. 되돌리기 쉬움(한 파일).

## 데모 검토 (demo gate)

light 트랙 — 데모 게이트 면제(`DM-light-waive`).
