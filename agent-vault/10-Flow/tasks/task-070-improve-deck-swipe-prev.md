---
task_id: task-070
title: "오늘의 단어 카드 스와이프 방향 변경 — 왼쪽 = 이전 카드, 오른쪽 = 다음 카드(푼 카드) / 건너뛰기 확인(안 푼 카드)"
status: doing
waiting: implementation
base_ref: b317b27
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-060-improve-deck-controls, task-059-improve-today-words-card-first, task-069-improve-word-add-mic]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 덱 스와이프 이전 카드
  - task-070
created: 2026-10-15
updated: 2026-10-15
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

# task-070 — 덱 스와이프 방향 변경 (IMP-0044)

## 사용자 요청 (원문, 2026-10-15)
> 오늘의 단어 카드 스와이프할때 왼쪽으로 스와이프하면 지금은 건터뛰기가 되는데 이전 카드로 이동하는 걸로 변경해줘

백로그: [[IMP-0044-deck-swipe-left-prev]]

### 사용자 결정 (AskUserQuestion, 2026-10-15)
요청 문장의 전제(왼쪽 = 건너뛰기)가 코드와 달라(왼쪽 = 다음 카드, 오른쪽 = 건너뛰기) Leader 가 현재 방향 지도를 보이고 3안을 제시했다. 사용자 선택: **「왼쪽=이전, 오른쪽=다음·건너뛰기」** — 왼쪽 밀기 = 이전 카드 · 오른쪽 밀기 = **푼 카드는 다음 카드, 안 푼 카드는 건너뛰기 확인**(지금과 같음). 두 방향 모두 제스처로 앞·뒤를 다닌다.

## judge 접수 (2026-10-15)
- `judge-result@2`: 유형 feature · 복잡도 1.91 · 위험 R1 · developer **sonnet** · **track light**(Leader → Developer → Reviewer, QA·데모 면제 — `DM-light-waive`) · ui_change `behavior_change`.
- **light 승격 조건**(보이면 standard 로): 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증.

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-060-improve-deck-controls]] (IMP-0031~0033, 사용자 요청): 위 밀기 = 뜻 보기, **오른쪽 밀기 = 이전 → 건너뛰기 확인으로 대체**, [한글] 분리. 건너뛰기 기록(#50 `skipped`)은 확인 시트의 [건너뛰기]에서만. 화면 읽기 전용 [건너뛰기] 버튼·`S` 키가 있다. 이번 변경은 그때 만든 「오른쪽 = 건너뛰기 확인」을 푼 카드에서는 「다음」으로 갈라 쓰는 것이다.
- 이전 카드 길: 하단 [이전] 버튼·← 키(`deck.prev`) — 이번에 왼쪽 밀기가 추가된다.
- 키보드는 이미 ← = 이전, → = 다음이다(`deck.ts keyAction`) — 새 제스처와 방향이 일치한다(GestureHint 주석: 화살표는 손가락이 움직이는 방향).
- 교훈: `/이슈기록 관련` 승인 교훈 없음. **task-069 감사 교훈(내부)**: light 트랙은 QA 가 없어 변이 점검이 사실상 유일한 독립 확인 → 제스처 배선도 순수 함수 추출 + 소스 스캔 시험으로 고정한다.

## 사실 (2026-10-15 직접 확인 — [확실])
- 지금 왼쪽 밀기 = `next()`(`useVocabDeck.ts:301`): 안 푼 카드면 막고 안내(`blockedNextHint`), 마지막 카드를 푼 상태면 결과(`doFinish`), 아니면 카드가 날아가며(`exiting`, `FLY_MS` 180ms) 다음 카드. 오른쪽 밀기 = `rightAction`(`cardFirst.ts:214`) → 안 푼 지금 카드면 건너뛰기 확인 시트, 아니면 이전 카드 안내.
- `SwipeCardStack` 은 `VocabDeck` 하나만 쓴다 → 오늘의 단어와 주제 덱이 같은 동작을 공유한다.
- 방향 판정은 `deck.ts classifyGesture`(탭 <10 → 위 dy<−80 → 좌우 |dx|>60), 막힌 방향 저항은 `resistX(x, canGoNext, canSkip)`(×0.25, `RESIST`).
- 화면 설계 문서 `docs/screens.md` 에 제스처 지도 서술이 여러 곳(§5·§24 등, 예: 1313·1631·10120·10587 줄 부근).
- `GestureHint` 의 고정 힌트는 `cardFirst.fixedHint` 가 만들고 손가락 방향 기준 문구를 쓴다.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **L1 방향 지도**(사용자 결정): 왼쪽 = 이전 카드(첫 카드면 「첫 카드예요」 안내 + 저항) · 오른쪽 = **지금 보이는 카드가 푼 카드면 다음 카드**(마지막 카드를 푼 상태면 결과 — 지금 왼쪽 밀기가 하던 것과 같게), **안 푼 카드면 건너뛰기 확인 시트**(지금과 같음, 저장/넘기는/끝내는 중이면 막힘).
- **L2 저항**: `resistX` 를 새 지도로 — 왼쪽은 이전 카드가 있을 때만 자유(없으면 ×0.25), 오른쪽은 다음 카드(또는 결과)로 가거나 건너뛰기 확인을 열 수 있을 때만 자유. 마지막 카드를 푼 상태의 오른쪽·왼쪽 규칙은 **지금 왼쪽 밀기가 마지막 푼 카드에서 하는 것과 같게 오른쪽으로 옮긴다**(코드를 읽고 맞춘다).
- **L3 카드가 날아가는 방향**: 다음 카드로 넘어갈 때 카드가 날아가는 방향을 **오른쪽**으로 바꾼다(제스처 방향과 일치; 버튼·키로 넘어가도 오른쪽으로 통일 — 방향이 트리거마다 다르면 오히려 헷갈린다). reduced-motion 은 기존대로 날아가기 없음. 이전 카드는 기존처럼 바로 전환(새 카드가 투명에서 나타남).
- **L4 순수 함수 우선**: 오른쪽 동작은 `cardFirst.rightAction` 이 `next | ask | none…` 같은 종류를 돌려주게 확장하고(부모는 그 결과로만 분기), 왼쪽은 `deck.prev` 직결. 배선 회귀를 시험이 잡도록 소스 스캔 시험(`onLeft`가 prev에, `onRight`가 rightAction에 연결 등)을 둔다.
- **L5 불변**: 위로 밀기(뜻 보기)·탭·답하기 로직·건너뛰기 기록(#50 `skipped` 는 확인 시트에서만)·[이전]/[다음 카드]/[건너뛰기(화면 읽기 전용)] 버튼·키보드(← → S F 등)·재생 중 스와이프 동작(다음/이전으로 가면 소리가 멈추는 규칙 — 기존 `goTo` 경로 그대로)·6층 경계. 키보드 → 는 안 푼 카드에서 막힘 안내(지금과 같음) — 제스처만 문맥 의존이라는 비대칭은 의도된 것이다.
- **L6 안내 문구**: `fixedHint` 등 제스처 안내 문구와 aria 라벨을 새 지도에 맞게 고친다(손가락 방향 기준, 360px 한 줄 `truncate` 에 들어가게). 문구 변경이 많아지면 `labels` 가 아니라 기존 `cardFirst.fixedHint` 안에서 끝낸다.
- **L7 문서**: `docs/screens.md` 제스처 지도에 task-070 개정을 반영한다 — 옛 서술은 task-060 때와 같은 방식(「[⚠ task-070 → …]」 표기 또는 현행 표 갱신)으로 정리하고, 거짓 서술이 남지 않게 `왼쪽 = 다음`·`오른쪽 = 건너뛰기 확인` 서술을 찾아 모두 맞춘다(grep).

## 구현 지시 (developer, sonnet)
1. 위 L1~L7. 파일을 읽을 순서: `SwipeCardStack.tsx`(머리말·`onLeft/onRight`·날아가기 `exiting`) → `VocabDeck.tsx`(`onRight`·`rightAction`·`canAskSkip`·`skipCtx`) → `deck.ts`(`classifyGesture`·`resistX`·`canNext`) → `cardFirst.ts`(`rightAction`·`canAskSkip`·`fixedHint`) → `useVocabDeck.ts`(`next`·`prev`·`exiting`) → 시험 `deck.test.ts`·`cardFirst.test.ts`·`deckStage.test.ts`.
2. 파일 범위(예상 7~9): `SwipeCardStack.tsx`·`VocabDeck.tsx`·`deck.ts`·`cardFirst.ts`·(필요 시 `useVocabDeck.ts`) + 시험 + `docs/screens.md`. 12개를 넘기면 멈추고 보고(standard 승격).
3. 시험: `resistX` 새 지도(왼쪽 첫 카드 저항·오른쪽 푼 카드/안 푼 카드/막힘), `rightAction` 새 종류(푼 카드=다음, 마지막 푼 카드, 안 푼=건너뛰기 확인, 막힘=none), 배선 소스 스캔(왼쪽→prev·오른쪽→rightAction·날아가기 방향), 기존 시험 중 옛 지도를 단정하던 것 갱신. **변이 점검 8개 이상**(핵심 규칙·배선을 일부러 깨 보면 시험이 실패하는지), 결과 표를 기록에 남긴다.
4. 확인 명령(미러에서): `tsc --noEmit` 0 · `eslint src/components/vocab` 0 · 관련 시험 + 전체 시험 · `./node_modules/.bin/next build > log 2>&1`(`npm run build/dev` 금지, 출력 자르지 말 것). 증빙은 기록에 남긴다 — reviewer 가 재실행한다.
5. 하지 않는 일: 커밋·푸시·배포·DB 쓰기·QA 서버 기동(3011 포함)·운영 포트(3010/3002/3012/307x) 접촉·`.env` 영구 복사·`pkill`. 위 밀기·탭·답하기·건너뛰기 기록 로직 변경 금지. 실기기 확인은 사용자 몫.
6. 기록: `agent-vault/10-Flow/tasks/task-070-dev-record.md` — 변경 파일, 결정, 증빙, 변이 표, 알려진 한계. 끝나면 이 이력서 「상태 로그」에 한 줄.

## 완료 기준
1. 왼쪽으로 밀면 이전 카드로 가고(첫 카드면 안내), 오른쪽으로 밀면 푼 카드는 다음 카드(마지막이면 결과)로, 안 푼 카드는 건너뛰기 확인 시트가 열린다.
2. 막힌 방향은 ×0.25 저항이고 카드가 날아가는 방향은 다음 카드일 때 오른쪽이다.
3. 위로 밀기·탭·버튼·키보드·건너뛰기 기록이 불변이고 안내 문구·`docs/screens.md` 가 새 지도와 맞다.
4. tsc 0 · eslint 0 · 시험 통과 · `next build` 0 · reviewer PASS · 사용자 폰 확인.

## 상태 로그
- 2026-10-15 사용자 요청 → 코드 확인(왼쪽=다음, 오른쪽=건너뛰기: 요청 전제와 다름) → 방향 지도 제시·사용자 결정 「왼쪽=이전, 오른쪽=다음·건너뛰기」 → IMP-0044 접수 → judge(feature·R1·light·demo 면제·sonnet) → 이력서 작성(L1~L7). 다음: developer.
- 2026-10-15 12:41 developer 구현 완료(미커밋, 파일 10개) → [[task-070-dev-record]] · tsc 0 · eslint 0 · 시험 4108 중 4106 통과(건너뜀 2 기존) · next build 0 · 변이 35/35 사망. 사양 외 추가 2건(D4 무대 `overflow-x-clip`, D5 `fixedHint` 답함 분기 선행) reviewer 판단 요청. 다음: reviewer.
- 2026-10-15 reviewer 감사 REV-070 **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 3) → [[task-070-rev-record]] · 전체 시험 재실행 4108 중 4106 통과·0 실패·2 건너뜀(dev 보고 일치) · 변이 23개 중 20 사망·3 생존(`exitingRef` 가드·소리 멈춤 효과 — 모두 task-070 이전 기존 구멍) · D4·D5 수용 · Low=`docs/screens.md` 옛 서술 5곳(1632·1659·10210·10258·10263) 표기 누락·시험 구멍 2. 다음: 문서 Low 정리(Leader 판단) → 커밋·푸시·배포는 사용자 승인 후 → 사용자 폰 확인.

- 2026-10-15 Leader: 감사 REV070-1(Low) 문서 5곳(1632·1659·10210·10258·10263)에 `[⚠ task-070 → §24-6]` 표기 후 현행 서술로 정리, 선택 정리 대상 10156(「제스처 의미 그대로 유효」)도 표기. 1743(`next()` 상태표)은 함수 자체는 불변이라 그대로. 남은 것: 커밋·푸시·배포는 **사용자 승인 대기**, 이후 사용자 폰 확인.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-15 12:25 |
