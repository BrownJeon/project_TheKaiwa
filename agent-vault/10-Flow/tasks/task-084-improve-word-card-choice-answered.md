---
task_id: task-084
title: "오늘의 단어 — 객관식으로 답한 카드도 답 확인 뒤에는 일반 정답 확인 카드(보기 없이 기록 한 줄)로 (IMP-0062)"
status: doing
waiting: "push_confirm"
base_ref: 179841b
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-083-improve-word-card-example-hangul, task-060-improve-deck-controls, task-059-improve-today-words-card-first]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 객관식 답한 카드 일반 카드
  - task-084
created: 2026-10-22
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

# task-084 — 객관식으로 답한 카드도 일반 정답 확인 카드로 (IMP-0062)

## 사용자 요청 (원문, 2026-10-22, 스크린샷 2장)
- 「단어를 풀때 바로 정답을 확인한 것과 객관식으로 변경 후 선택한 것이 되돌아서 정답내역을 확인해도 동이휴ㅏ게 나오는데 객관식으로 풀더라도 정답확인 후에는 일반 정답확인 카드로 보여주도록 해줘」 — 「동이휴ㅏ게」 는 오타로 보고 «두 카드가 같은 모양이어야 한다» 로 해석(근거: 스크린샷 두 장이 다르게 보임).

백로그: [[IMP-0062-word-card-choice-answered-normal-card]]

## judge 접수 (2026-10-22)
- `local_fix`·복잡도 0.97·R1·developer **sonnet**·**light 트랙**(데모·QA 면제 — `DM-light-waive`). 입력 `scratchpad/judge-084-intake.json`. 과거 교훈(`cli related`) 해당 없음.

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-059-improve-today-words-card-first]]·[[task-060-improve-deck-controls]] 계열(카드 우선 세트·Ac 상태) — 객관식 답 뒤 보기 4개를 «답했으니 잠김» 으로 남기는 것이 의도된 설계였다(`docs/screens.md` Ac 행 10252·지난 카드 행 10257·의사코드 10281·표 10334). 이번에 그 설계를 사용자 요청으로 **바꾼다**.
- [[task-083-improve-word-card-example-hangul]] — 같은 카드 뒷면 영역 변경(간격). 이번 변경은 카드 면이 아니라 **카드 아래 영역** 분기라 서로 겹치지 않는다.

## 사실 (2026-10-22 — 코드 읽기 [확실])
- 하단 분기(`src/components/vocab/VocabDeck.tsx` 297행): `mode === 'CHOICE' || open || (answered && answeredBy(card, mode) === 'choice')` → `ChoiceList`(보기 4개 + ✓ 정답/✗ 내 답, `locked`), 아니면 `FlipControls`(답한 카드는 `flipRecordedText(card.answer)` 한 줄 — «알았어요/몰랐어요/건너뛴 카드로 기록했어요»).
- `frontier` 는 «첫 안 답한 카드» 라 객관식으로 답한 **직후**에도 `view < frontier`(= isCurrent false) — 코드가 «방금 답함» 과 «돌아가서 봄» 을 구분하지 않는다. 그래서 둘을 같이 바꾼다.
- 위 분기의 `open` 은 카드 우선 세트에서 «보기 열림» 상태 — **답한 뒤에도 true 로 남는지** 개발자가 확인해야 한다(남으면 `open ||` 절이 답한 카드의 보기를 계속 그린다).
- 띠(`resultBand`)는 이미 `answeredBy === 'choice'` 로 «✓ 맞았어요/✗ 틀렸어요» 를 그린다 — 건드리지 않는다.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **카드 우선(FLIP) 세트에서 답한 카드는 방식(직접·객관식)과 상관없이 보기 없이 기록 한 줄**. 이전 4지선다(`CHOICE` 모드) 세트는 그대로(그 모드의 답한 뒤 상태는 screens.md 가 따로 정의함).
- 객관식으로 답한 카드의 기록 한 줄 문구는 띠와 맞춘다: 맞힘 «맞았어요로 기록했어요» · 틀림 «틀렸어요로 기록했어요»(건너뜀은 기존 «건너뛴 카드로 기록했어요»). 직접 답한 카드는 기존 «알았어요/몰랐어요로 기록했어요» 그대로. (객관식 틀림에 «몰랐어요로 기록» 이 붙으면 띠 «틀렸어요» 와 어긋남.)
- «내 답» 표시(보기 목록)는 사라진다 — 결과 목록(`WordResultList`)의 «내 답» 은 그대로라 기록은 남는다. 사용자에게 보고한다.

## 구현 지시 (developer, sonnet — 신규 소환)
1. `VocabDeck.tsx` 하단 분기를 «`mode === 'CHOICE'` 이거나 (보기 열림이면서 아직 안 답함)» 일 때만 `ChoiceList` 로 바꾼다. 판정은 `cardFirst.ts` 의 **순수 함수**(예: `showsChoiceList(mode, card)`)로 빼서 시험한다(소스 문자열 단언 최소). `answered`/`open`/`pending` 상태에서 `ChoiceList` 가 답한 뒤에도 남는 길이 없는지 `useVocabDeck.ts` 의 `open` 갱신을 읽고 확인한다.
2. `FlipControls.tsx`·`labels.ts`: 답한 카드(`isAnswered(card) && card.answer`)의 기록 한 줄에서 객관식으로 답한 카드(`card.chosenText != null`, `SKIPPED` 제외)는 새 문구(`choiceRecordedText` 등)를 쓴다. 직접·건너뜀 문구는 불변.
3. **초점**: 답한 직후 눌렀던 보기 버튼이 사라지므로(예전엔 `ChoiceList` 가 남아 초점이 유지됨) 키보드·스크린리더 사용자의 초점이 어디로 가는지 확인한다 — 직접 답하기(`FlipControls` 버튼이 사라지는 기존 경로)가 이미 같은 문제를 어떻게 푸는지(`nextRef` 이동 등)를 읽고 객관식 경로도 같게 맞춘다. 새 메커니즘을 만들지 않는다.
4. 시험: `src/components/vocab/__tests__/` 의 기존 단언 중 «Ac(객관식으로 답함) 에서 `ChoiceList`» 에 의존하는 것을 새 규칙에 맞춘다(`cardFirstHome.test.ts` 등 — 실행해서 깨지는 것 확인). 새 시험: ① 분기 판정 표(CHOICE 모드 항상 / FLIP 보기 열림·안 답함 / FLIP 답함(직접·객관식·건너뜀)·열림 상태 유지 시) ② 기록 문구 표(객관식 맞힘·틀림·직접·건너뜀). 변이 시험 ≥ 2(임시 파일 + mv 후 원복·`cmp`).
5. `docs/screens.md` 최소 갱신: Ac 행(10252)·지난 카드 행(10257)·의사코드(10281)·표(10334)·Q3 서술(10572 근처 «객관식 답한 뒤 242/302/282») 에 «task-084 로 대체: 보기 없이 기록 한 줄» 을 반영한다. 다른 줄은 건드리지 않는다.
6. 건드리지 말 것: `ChoiceList.tsx`(unanswered·CHOICE 모드가 그대로 씀)·`VocabCardFace.tsx`·`SwipeCardStack`·결과 목록·`CHOICE` 모드 동작·서버/DB/API.
7. 검증: 미러 `bash scripts/make-mirror.sh dev084` 새로 만들고 거기서만 — `src/components/vocab`·`src/components/common` 시험, `tsc --noEmit`, eslint 변경 파일. `npm test`·브라우저·dev 서버·DB·LLM·커밋·푸시·배포 금지. 프로세스는 PID 로만 종료.
8. 기록 `task-084-dev-record.md`(변경·`open` 확인 결과·초점 처리·시험 수·변이·한계). 최종 답 6줄 이내 — 실제 실행한 결과만(결과가 비면 안 된다).

## 완료 기준
- 카드 우선 세트에서 객관식으로 답한 카드(직후·지난 카드 모두)가 보기 없이 기록 한 줄로 보이고, 직접 답한 카드와 같은 아래 영역(`FlipControls` 기록 줄 + 이전·표시·다음 줄)을 쓴다.
- 이전 4지선다 세트·답하기 전 보기 열림(F1·P)·결과 목록은 불변.
- 관련 시험·tsc·eslint 0 오류, 변이 시험이 잡는다. Leader 실브라우저: 카드 우선 세트에서 객관식으로 답한 직후와 «이전» 으로 돌아간 카드 둘 다 보기 없음·기록 줄 문구가 띠와 일치·카드 무대가 겹침 없이 커짐·초점이 «다음 카드» 쪽으로.

## 상태 로그
- 2026-10-22 사용자 요청(스크린샷 2장) → 코드 읽기로 원인 확인(의도된 옛 설계) → judge(light)·IMP-0062·이력서 → developer(sonnet) 소환.
- 2026-10-22 **developer(sonnet) 완료**: `cardFirst.showsChoiceList(mode, card)`(CHOICE 모드 항상 / FLIP 은 보기 열림 + 안 답함) → `VocabDeck.tsx` 하단 분기, `labels.choiceRecordedText`·`flipRecordedText(answer, chosenText)` → `FlipControls`, `docs/screens.md` 5곳, 새 시험 `choiceAnswered.test.ts` 6건. `open` 은 `useVocabDeck.onAnswered` 가 답 응답 때 끈다(확인), 초점은 방식과 상관없이 `onAnswered` 가 [다음 카드]로 보낸다(확인). 변이 5/5. diff 5파일 +33/-15 Leader 가 직접 읽음.
- 2026-10-22 **Leader 재실행**(미러 `dev084` = NFS `src` 동일): vocab·common·lesson 시험 **671건 통과·실패 0·건너뜀 0**, tsc 0, eslint 변경 5파일 0.
- 2026-10-22 **Leader 실브라우저 확인(통과)** — 빌드(미러 `t081int` = NFS `src` 동일, `next build` 종료 0)·3011·QA 계정 4·LLM 호출 0·412×892 다크. 카드 우선(FLIP) 세트 5장: ① 안 답한 카드 탭 → 보기 4개 열림(회귀 없음) ② 객관식으로 답한 **직후** 보기 사라짐·«내 답» 없음·띠 «✗ 틀렸어요» = 기록 줄 «틀렸어요로 기록했어요»·초점 [다음 카드] ③ 직접 답한 카드(알았어요)는 0.4초 뒤 자동 다음 카드(기존 동작) ④ **이전으로 돌아간** 객관식 카드 둘·직접 카드 한 장 모두 보기 없음, 기록 줄 위치 768px 로 동일·버튼 구성(단어 듣기·예문 듣기·이전·표시·다음 카드) 동일 ⑤ 4번 카드(안 답함) 다시 열기 정상 ⑥ 페이지 오류 0. 스크린샷으로 객관식 지난 카드와 직접 지난 카드의 모양이 같음을 눈으로 확인. 정리: QA 세트·시도·출석 행 삭제(기준선 대비 새 행 0·사라진 기존 행 0), 서버(PID 종료)·`.env`·쿠키 삭제, 3011 해제.
- 2026-10-22 **reviewer(sonnet) 감사 `rev-084` PASS_WITH_NOTES (Critical 0·High 0·Medium 1·Low 3)**: 분기·`onAnswered` 한 번의 `patchCard`(깜박임 길 없음)·`flipRecordedText` 호출처 1곳·초점(직접 답하기와 같은 길)·ChoiceList 소비처 1곳·금기 0 확인, 미러에서 새 시험·관련 89건·tsc 직접 재실행 통과. 지적: M-1 `docs/screens.md` 10263 «답이 오면 open=false(보기는 계속 보인다)» 가 새 규칙과 모순 · L-1 낡은 서술(10151·10461~10463·10497·10572·10610) · L-2 10333 «choices 는 결과 목록 내 답에 쓰인다» 는 사실과 다름(`WordResultList` 는 `chosenText` 만 읽음) · L-3 시험 6번(배선) 이 소스 정규식에 의존. 기록 [[task-084-rev-record]].
- 2026-10-22 **Leader 조치**: M-1·L-1·L-2 는 `docs/screens.md` 를 직접 정정(옛 서술에 «task-084 로 대체/옛 기록» 표시, 10333 문장 바로잡음). L-3 은 동작 단언 1~5번이 실제 함수·렌더를 쓰고 6번은 배선 확인용이라 그대로 둔다(수용). 실브라우저에서 reviewer 가 넘긴 «답하는 순간 카드가 커지며 키가 튀나» 확인 — 카드 높이는 340px 로 같고 **위치만 69px 아래로 내려온다**(보기 목록이 빠져 무대 중심이 이동, 내용도 앞→뒷면으로 바뀌는 순간이라 튐은 작음, 사용자 폰 확인 항목).
- 2026-10-22 **커밋·푸시 대기**: 코드 5파일(`VocabDeck.tsx`·`FlipControls.tsx`·`cardFirst.ts`·`labels.ts`·새 시험)·`docs/screens.md`·vault 기록은 미커밋, **푸시 = 운영 배포 — 사용자 승인 대기**.

## 운영 배포
(배포 전)

## 최종 요약 (사용자용 — 작성 전)

(완료 시 Leader 가 작성 — 양식 정본 docs/user-report-format.md §3)

## 데모 검토 (demo gate)

light 트랙 — 데모 게이트 면제(`DM-light-waive`).
