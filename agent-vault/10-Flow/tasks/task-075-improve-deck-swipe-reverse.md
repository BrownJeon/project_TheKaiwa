---
task_id: task-075
title: "오늘의 단어 카드 스와이프 방향 맞바꿈 — 왼쪽 밀기 = 다음·건너뛰기 확인, 오른쪽 밀기 = 이전 (IMP-0050)"
status: done
waiting: ""
base_ref: fd2d939
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-070-improve-deck-swipe-prev, task-060-improve-deck-controls, task-074-improve-word-favorites]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 스와이프 방향 되돌림
  - task-075
created: 2026-10-18
updated: 2026-10-18
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

# task-075 — 오늘의 단어 카드 스와이프 방향 맞바꿈 (IMP-0050)

## 사용자 요청 (원문)
`/개선작업 프로젝트:일본어교육` — 「오늘의 단어 카드의 슬라이드를 반대로 반응하게 적용해. 카드를 왼쪽으로 스와이프하면 다음 및 건너뛰기, 오른쪽으로 스와이프하면 이전 으로 되도록 기존의 스와이프와 반대로 처리되도록 해줘」(2026-10-18) → 접수 IMP-0050(`inbox`).
착수 지시: 「승인할테니 작업 진행해줘」(2026-10-18). (이 말은 특정 데모·DB 변경 승인이 아니라 IMP-0050·0051 착수 지시로 해석 — 이 task 는 데모 면제·DB 변경 없음.)

## judge 접수 (2026-10-18)
`feature` · 복잡도 1.56 · **R1** · developer **sonnet** · 트랙 **light**(DM-light-waive, 데모 면제) · roles developer·reviewer · next `assign`. 결과 JSON `judge-result@2`.
- light 트랙 한계: 파일 12개 초과·신규 화면·DB·네이티브·인증이 보이면 standard 로 승격한다. QA 없음 — 대신 developer 의 실행 증빙(lint·typecheck·시험·build)을 reviewer 가 재실행하고, 터치 제스처 실기기 확인은 사용자 몫.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **task-070(IMP-0044, 2026-10-15)** 이 현재 방향을 만들었다: 왼쪽 밀기 = 이전 카드, 오른쪽 밀기 = 푼 카드는 다음 카드·안 푼 카드는 건너뛰기 확인 시트(사용자가 방향 지도를 보고 직접 선택, 폰 확인 정상). 변경 파일: `src/components/vocab/{deck.ts,cardFirst.ts,SwipeCardStack.tsx,VocabDeck.tsx,useVocabDeck.ts}`(+ `SkipConfirmSheet`·`DeckToolbar` 주석)·시험·`docs/screens.md` §24-6. 기록 [[task-070-dev-record]]·[[task-070-improve-deck-swipe-prev]].
- task-060(IMP-0031·0032·0033): 위로 밀기 = 뜻 보기, [한글] 분리, 오른쪽 밀기 = 건너뛰기 확인(그 전 방향은 왼쪽 = 다음).
- 이번 요청은 task-070 방향의 **좌우를 맞바꾸는** 것이다(옛 task-060 방향으로의 복귀가 아님 — 왼쪽에 다음과 건너뛰기를 함께, 오른쪽은 이전).
- 교훈(`/이슈기록 관련`): 승인된 교훈 없음. 내부 교훈: ① 소스 문자열 스캔 시험은 동작 변이를 못 잡는다 — 방향 규칙은 순수 함수 동작 시험으로 ② 하드링크 미러는 임시 파일에 쓰고 `mv` 로 교체.

## Leader 결정 (사용자가 바꾸라면 바꾼다)
- **L1 방향 맞바꿈**: 왼쪽 밀기 = **푼 카드 → 다음 카드 / 안 푼 카드 → 건너뛰기 확인 시트**(지금 오른쪽 밀기의 동작), 오른쪽 밀기 = **이전 카드**(지금 왼쪽 밀기의 동작).
- **L2 가장자리·막힘 동작은 task-070 그대로, 방향만 바꾼다**: 첫 카드에서 이전, 마지막 카드에서 다음, 안 푼 카드의 안내/시트, 이동 중 잠금 등 모든 분기와 문구의 의미를 유지한다(developer 가 070 기록·코드로 확인해 표로 적는다).
- **L3 움직임 방향**: 카드가 끌려가고 날아가는 방향·기울기는 **손가락 방향과 같게**(왼쪽으로 밀면 왼쪽으로 사라져 다음 카드, 오른쪽으로 밀면 오른쪽으로 사라져 이전 카드). 070 의 규칙이 다르게 구현돼 있으면 어떻게 다른지 기록하고 새 방향에 맞게 정리한다.
- **L4 방향을 말하는 모든 곳을 같이 바꾼다**: 제스처 힌트(`GestureHint`)·툴바/시트 문구·`aria-label`·주석의 「왼쪽/오른쪽」 표현을 `grep` 으로 전수 찾아 새 방향에 맞게 교체(문구 단일 출처가 있으면 거기서). 엔진명·내부 용어 노출 없음.
- **L5 키보드 화살표는 바꾸지 않는다** — 사용자 요청에 없고 관례(←=이전, →=다음)가 이미 맞다. 단, 키보드가 스와이프와 묶여 있었다면(공용 핸들러) 어떻게 묶였는지 기록하고 키보드 동작은 지금과 같게 유지한다.
- **L6 범위 밖**: 위로 밀기(뜻 보기)·버튼 조작·서버·DB·다른 화면·`docs/screens.md`(개발자는 수정 금지 — §24-6 의 방향 서술은 구현 뒤 designer/Leader 가 동기화).

## 구현 지시
1. **developer(sonnet)**: `vocab/{deck.ts,cardFirst.ts,SwipeCardStack.tsx,VocabDeck.tsx,useVocabDeck.ts}` 와 방향 문구가 있는 파일, 방향 단언이 있는 시험을 읽고 L1~L6 구현. 방향 판정은 순수 함수(`deck.ts` 등)에서 한 곳에 두고 **동작 시험**(방향×카드 상태(푼/안 푼/첫/마지막) 표 전수)을 추가·갱신. 변이 점검 8개 이상. 미러 `cp -al ~/.node-local/thekaiwa-dev074-ui3 ~/.node-local/thekaiwa-dev075` → `rm -rf .next`·**임시 파일에 쓰고 `mv`**·`prisma generate` 금지. 기록 `task-075-dev-record.md`.
2. **reviewer(sonnet)**: 방향 맞바꿈이 모든 분기에서 정확한지(표 전수), 기존 시험 변경이 약화가 아닌지, 문구 누락(grep), 증빙 재실행. 터치 제스처 자체는 실기기 확인 대상으로 남긴다.
3. 확인 명령: `tsc --noEmit` 0 · `eslint src/components/vocab` 0 · 시험 + 전체 시험(가짜 `DATABASE_URL`) · `./node_modules/.bin/next build > log 2>&1; echo $?`.

## 완료 기준
1. 왼쪽 밀기: 푼 카드는 다음 카드, 안 푼 카드는 건너뛰기 확인 시트. 오른쪽 밀기: 이전 카드. 가장자리·막힘 동작은 이전과 같다.
2. 방향을 말하는 문구·힌트·`aria-label` 이 새 방향과 일치한다.
3. 위로 밀기·버튼·키보드·서버는 그대로. tsc 0 · eslint 0 · 시험 · build 0 · reviewer PASS · 사용자 폰 확인.

## 상태 로그
- 2026-10-18 `/개선작업` 접수(IMP-0050 `inbox`) → 사용자 「승인할테니 작업 진행해줘」 → judge intake(feature·R1·light·demo none·sonnet) → IMP-0050 `planned` → 이력서 작성(L1~L6). 다음: developer.
- 2026-10-18 developer 구현 완료(미커밋): 방향 지도 `cardFirst.swipeAction` 단일 출처(왼쪽 = 푼 카드 다음·안 푼 카드 건너뛰기 확인, 오른쪽 = 이전), 날아가기 왼쪽 복원, 터치 힌트 4문구 교체. tsc 0 · eslint 0 · 전체 시험 4340/4337 통과·skip 3(따로 41/41) · build 0 · 변이 50/50 포착. L3 괄호의 「이전 카드도 오른쪽으로 날아감」은 현행에 없던 연출이라 미추가(Leader 확인 필요), `docs/screens.md` §5·§23·§24 방향 서술 동기화 필요. 기록 [[task-075-dev-record]]. 다음: reviewer.
- 2026-10-18 reviewer REV-075 **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 2): 방향 지도·움직임·문구·키보드·범위(A~D) 코드로 확인, 독립 변이 18개 중 16 포착(분기 뒤집기·안 푼→next·FLY_OUT 부호 포함), 증빙 재실행 tsc 0·eslint 0·대상 시험 85/85·전체 4340/4337(skip 3), 데모 게이트 PASSED(not_required). Low: F1 끌 때 `translateX(${shownX}px)` 부호를 시험이 안 묶음(변이 R05·R06 생존, 코드는 맞음, 소스 스캔 한 줄 권고) · F2 이전 카드 전환에 날아가기 없음(L3 괄호와 차이, Leader D7 동의 — 추가 안 함). light 승격 불필요·native_change false. 남은 것: 사용자 폰 확인(하단 high_risk_areas 6개). 기록 [[task-075-reviewer-record]]. 다음: Leader(docs/screens.md 동기화·커밋/배포 판단).
- 2026-10-18 Leader 판정: **D7(이전 카드로 갈 때 오른쪽으로 날아가는 연출) 미추가** — 070 에서도 없었고 폰 확인 정상, L2(방향만) 범위 밖, 훅 렌더 시험 없음 → 사용자가 원하면 후속 요청. **D5(`overflow-x-clip`) 유지.** REV-075 F1 은 developer 가 시험 1개 추가(소스 스캔: `translateX(${shownX}px)` 정확히 2곳·부호 반전 없음)로 닫음 — Leader 가 미러에서 재실행해 대상 시험 **86/86 통과**·저장소와 미러 파일 `cmp` 동일 확인(변이 4/4 포착은 developer 보고). F2(L3 괄호와 현행 차이)는 위 D7 로 종결.
- 2026-10-18 designer(sonnet) `docs/screens.md` 방향 서술 070 → 075 동기화 완료(§5·§23·§24-1·§24-6, 취소선+`[⚠ task-075 → §24-6]` 표기). Leader 가 `git diff` 로 확인: 방향 동기화 hunk + §33(task-076 초안 +78줄) 불변, 옛 방향이 현재 동작처럼 남은 줄 없음. 기록 [[task-075-designer-record]]. 다음: **사용자에게 커밋·푸시(=운영 배포) 승인 요청**. 승인 뒤 푸시 전 게이트(HEAD 별도 미러 tsc·eslint·전체 시험·build) → push → 웹훅 `RELEASE_RESULT` 확인. 터치 제스처는 이 환경에서 못 만지므로 **사용자 폰 확인 6개**(reviewer 기록 목록) 후 IMP-0050 `done`.
- 2026-10-18 18:59 **운영 배포 완료**(사용자 「075는 먼저 배포해줘」): 커밋 `01e4929`(코드 9파일+screens.md 075 hunk 30개만 — 같은 파일의 task-076 §33 hunk 는 `git apply --cached` 로 제외)·`3becac8`(vault 문서) → 푸시 전 게이트(HEAD `3becac8` 별도 미러: prisma 0·tsc 0·eslint 0·전체 시험 4,341 중 4,338 통과·실패 0·건너뜀 3·build 0) → push `89fcefc..3becac8` → 웹훅 `RELEASE_RESULT` ok · 릴리스 `20261018-185956-3becac89` · `migrated:false` · **롤백 대상 `20261018-125304-89fcefc0`**. 배포 후 확인: current 일치 · health PRODUCTION ok 11/11 · pm2 3 online(restarts 0) · 번들(`.next/static/chunks`, 경로 존재 확인) 새 힌트 「← 밀어 건너뛰기 · → 밀어 이전」·「← 밀어 다음 · → 밀어 이전」 각 3개 파일 · 옛 문구 「← 밀어 이전 · → 밀어 건너뛰기」·「→ 밀어 다음」 0 · `translateX(-120%) rotate(-8deg)` 3·옛 `translateX(120%) rotate(8deg)` 0 · 엔진명 0 · 운영 `/login` 200. **터치 제스처는 운영에서도 실행해 보지 못했다** — 사용자 폰 확인 6개(아래 「최종 요약」) 후 IMP-0050 `done`. 미커밋으로 남은 것은 task-076 작업뿐.

## 최종 요약 (사용자용)
- **바뀐 것**: 오늘의 단어 카드를 **왼쪽으로 밀면** 푼 카드는 다음 카드(마지막이면 결과), 안 푼 카드는 건너뛰기 확인 창이 뜹니다. **오른쪽으로 밀면** 이전 카드입니다(첫 카드는 조금만 따라오고 「첫 카드예요」). 다음 카드로 넘어갈 때 카드는 왼쪽으로 날아갑니다. 아래 터치 안내 문구 4종도 새 방향으로 바꿨습니다. 위로 밀기(뜻 보기)·[이전]/[다음 카드] 버튼·키보드 ←/→·서버·DB 는 그대로입니다.
- **의도적으로 안 한 것**: 이전 카드로 갈 때 카드가 오른쪽으로 날아가는 연출은 넣지 않았습니다(이전에도 없었고 사용자가 폰에서 정상으로 확인한 동작, 방향만 바꾼다는 범위 밖). 원하시면 후속 요청으로 하겠습니다.
- **검증**: 독립 감사 PASS_WITH_NOTES(막는 결함 0, Low 2 — 시험 공백은 보강), 푸시 전 게이트 통과, 운영 번들 새 문구 확인.
- **폰에서 확인해 주세요(6)**: ① 푼 카드를 왼쪽으로 밀면 왼쪽으로 날아가며 다음 카드(마지막이면 결과) ② 안 푼 카드를 왼쪽으로 밀면 건너뛰기 확인 창(취소하면 그대로) ③ 오른쪽으로 밀면 이전 카드, 첫 카드는 조금만 따라오고 「첫 카드예요」 ④ 터치 안내 한 줄이 360px 폭에서 잘리지 않는지 ⑤ 옛 습관(오른쪽 = 다음)으로 밀면 이전으로 가는 점과 이전 카드 전환에 날아가기가 없는 점 ⑥ 위로 밀기·버튼·키 회귀 없음.
- **롤백**: 문제가 있으면 `scripts/deploy.sh TheKaiwa --rollback` 으로 직전 릴리스(`20261018-125304-89fcefc0`)로 돌릴 수 있습니다(DB 변경 없음).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-18 16:54 |
