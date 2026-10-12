---
task_id: task-060
title: "오늘의 단어 덱 조작 정리 — 위로 슬라이드=뜻 보기·[뜻 보기]/[객관식] 버튼 제거 / [읽기]에서 [한글] 분리(건너뛰기 자리) / 오른쪽 슬라이드=건너뛰기 확인 (IMP-0031·0032·0033, light 트랙)"
status: review
waiting: device_verify
base_ref: 4f3fb38
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-059-improve-today-words-card-first, task-008-vocab-today-words, task-023-improve-vocab-screen]
imp: [IMP-0031, IMP-0032, IMP-0033]
tags:
  - type/task
  - domain/improvement
  - domain/vocab
aliases:
  - 덱 조작 정리
  - task-060
created: 2026-10-12
updated: 2026-10-12
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

# task-060 — 오늘의 단어 덱 조작 정리 (IMP-0031·0032·0033)

## 사용자 요청 (원문, 2026-10-12 — task-059 운영 배포 직후)
> 1. 단어장 카드의 위로 슬라이드하는 것을 '뜻 보기'기능으로 변경하고 하단의 '뜻 보기' 버튼과 '객관식' 버튼은 제거해줘.
> 2. 카드 하단의 '읽기' 버튼을 히라가나 표기와 한글표기가 함께있는데 이것을 분리해줘. 한글표기는 '한글'이라는 버튼으로 생성해주고 '건너뛰기' 버튼을 제거하고 그자리에 배치해줘.
> 3. 2번의 '건너뛰기' 버튼 제거에 대하여 해당 기능은 카드를 오른쪽 슬라이드하게되면 건너뛸것인지에 대한 안내 문구를 띄워주고 사용자가 확인하면 건너뛰기가 되도록 변경해줘

「단어장 카드」 = 오늘의 단어 덱 `VocabDeck`(카드 스와이프 화면은 이것 하나뿐 — `SwipeCardStack`·`DeckToolbar` 사용처 확인).

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-059-improve-today-words-card-first]](운영 배포 `20261012-091540-55861770`): 푸는 방식 선택 제거·카드 기본·탭하면 객관식. 확정 결정 **D0 = 스와이프 그대로** 를 이번 요청이 바꾼다(위: 표시→뜻 보기, 오른쪽: 이전→건너뛰기 확인). 사용자는 task-059 배포 뒤 직접 써 보고 이 요청을 냈다 — task-059 의 「실기기 확인」은 이 task 로 이어진다.
- 현재 코드(2026-10-12 직접 읽음): 제스처 `SwipeCardStack`+`VocabDeck` — 탭=객관식 열기(보기 있는 카드)/뜻 보기(보기 없는 카드), 위=표시 토글(`toggleFlag`), 왼쪽=다음(`next`, 답한 뒤에만), 오른쪽=이전(`prev`). 하단 첫 줄 `FlipControls`(앞면 [뜻 보기][객관식] / 뒷면 [알았어요][몰랐어요] / 답한 뒤 기록 한 줄, 높이 52px 고정), 둘째 줄 `DeckToolbar`(안 답한 지금 카드 [이전][읽기][표시][건너뛰기] / 그 밖 [이전][표시][다음 카드]). 읽기 = `useVocabDeck` 의 `readingPref`(localStorage `kaiwa.vocab.readingDefault`, 기본 on) 한 값이 앞면 표제어 후리가나와 한글 표기(`faceHangul`)를 같이 켠다. 건너뛰기 = `deck.skip` → `answerGuard` → `send({skipped:true})`. 키: F 표시·R 읽기·S 건너뛰기·C 객관식·Space 뜻 보기.
- 승인된 교훈(`/이슈기록 관련 화면 UI 덱 카드`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 2.0 · R1 · developer=**opus** · **light 트랙**(Leader → Developer → Reviewer, 데모·QA 면제 — 사용자 결정 ADP-001 D-10) · demo=none(`JV-ui_change`+`DM-light-waive`). 입력·결과: 스크래치 `judge-060-intake*.json`.
- **light 한계(초과 시 standard 승격)**: 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증. 해당 없음(예상 변경 파일 약 9~12개, 새 화면 없음, 서버·스키마 변경 없음). 단, 제스처 지도가 바뀌는 task 라 **사용자 실기기 확인이 사실상 유일한 UX 검증**이다 — 배포 때 NOT_VERIFIED 로 밝힌다.

## 설계 (Leader — 사용자 지시 + 지시에 없던 가장자리 결정은 권고안으로 확정, 사용자가 바꾸라면 바꾼다)

### A. 제스처 지도 (터치)
| 제스처 | 이전(task-059) | 지금 |
|---|---|---|
| 탭 | 객관식 열기/닫기(보기 있는 카드) · 뜻 보기(보기 없는 카드) | **그대로** |
| ↑ 위로 | 표시(★) 토글 | **뜻 보기** (`deck.flip()` — 지금 카드·안 답함·뜻이 있는 카드·아직 안 뒤집음일 때만. 보기가 열려 있으면 닫고 뒤집는다 = `flip()` 이 이미 하는 일) |
| ← 왼쪽 | 다음(답한 뒤에만) | **그대로** |
| → 오른쪽 | 이전 | **건너뛰기 확인** (안 답한 지금 카드에서만 확인 시트를 연다) |

- 위로 밀기가 처리되지 않는 경우(이미 뒤집음·답한 카드·지난 카드·뜻 없는 카드·답 저장 중)는 카드가 튀지 않고(`bump` 는 실제로 뜻이 열릴 때만) 한 줄 안내만: 이미 뒤집음 → 기존 `HINT.selfFirst`, 뜻 없는 카드 → `CARD_FIRST.selfToPeek`, 답한/지난 카드 → 안내 없음(뒷면이 이미 보임).
- 오른쪽 밀기가 처리되지 않는 경우(답한 카드·지난 카드·저장 중)는 **×0.25 저항**(왼쪽의 `resistX` 와 같은 방식 — `canGoPrev` 자리를 `canSkip` 으로) + 한 줄 안내 「이전 카드는 아래 [이전] 버튼으로 가요」(지난 카드·답한 카드). **이전 카드로 가는 길은 [이전] 버튼과 키(←)만 남는다** — 사용자 지시로 오른쪽 밀기의 뜻이 바뀐 결과이므로 배포 때 한 번 알린다.
- 「다시 볼 카드 표시(★)」는 도구 줄 [표시] 버튼·F 키로만 남는다(위로 밀기를 뜻 보기에 넘김).
- 제스처 영역(가운데 80%) 안에 버튼 금지·`touchend preventDefault` 유지(task-059 규칙 그대로).

### B. 하단 첫 줄 (`FlipControls`) — 앞면의 [뜻 보기]·[객관식] 제거
- 앞면(`side==='front'`, 뜻이 있는 카드)에서 두 버튼을 그리지 않는다. **자리(52px)는 비우지 않고 예약**한다 — 뒤집을 때 [알았어요][몰랐어요] 줄이 생겨 카드 무대 높이가 바뀌면 360×740 에서 카드가 튀기 때문. 예약 자리에는 안내 한 줄(보기가 있는 카드: 「카드를 위로 밀면 뜻이 보여요 · 탭하면 객관식으로 풀어요」 / 보기 없는 카드: 「카드를 위로 밀거나 탭하면 뜻이 보여요」, `text-[13px] text-ink2` 가운데, `min-h-[52px]`). 문구는 개발자가 `CARD_FIRST` 에 상수로 두고 위 의미를 지킨다(한 줄에 안 들어가면 두 줄로 줄바꿈 허용, 52px 안).
- 뒷면 [알았어요][몰랐어요]·답한 카드 기록 한 줄·객관식 보기 목록(`ChoiceList`)·뜻 없는 카드의 앞면 [알았어요][몰랐어요] 는 **그대로**.
- 키보드 Space(뜻 보기)·C(객관식) 는 그대로 유지한다(버튼이 없어지므로 키가 유일한 비제스처 경로).
- **스크린리더·스위치 접근 대체 경로**: 제스처만으로 하는 동작은 단일 포인터 대체 수단이 필요하다(WCAG 2.5.1). 눈에 안 보이는 `sr-only` 버튼 [뜻 보기]·[객관식(보기 있는 카드·안 답함)]·[건너뛰기(안 답한 지금 카드)] 를 **제스처 영역 밖**(도구 줄 근처)에 둔다. 시각적으로는 사용자 요청대로 버튼이 없다. 누르면 같은 동작(`deck.flip`·`deck.toggleChoices('btn')`·건너뛰기 확인 시트 열기). → 사용자에게 한 번 알리고, 원하지 않으면 지운다.

### C. 도구 줄 (`DeckToolbar`)
- 안 답한 지금 카드: **[이전][읽기][표시][한글]** (4번째 칸 = 옛 [건너뛰기] 자리). 그 밖(답함·지난 카드): [이전][표시][다음 카드 ›](마지막이면 [결과 보기 ›]) **그대로**.
- **[읽기] = 히라가나 표기만**(앞면 표제어 후리가나). **[한글] = 한글 표기만**(`faceHangul` — 앞면 한글 표기 줄). 서로 독립.
- 상태 저장: [읽기] 는 기존 `readingPref`(localStorage `kaiwa.vocab.readingDefault`). [한글] 은 새 키 `kaiwa.vocab.hangulDefault`(`VOCAB_KEYS.hangulDefault` 추가), 값 `'on'|'off'`. **새 키가 비어 있으면 기존 `readingDefault` 값을 이어받는다**(그 값이 없으면 `on`) — 이미 [읽기]를 꺼 둔 사용자의 화면이 갑자기 바뀌지 않게.
- [한글] 막힘: 이 카드에 한글 표기가 없거나(레이어 `hangul` 없음) 앱 한글 설정이 꺼져 한글 층을 받지 않으면 `aria-disabled` + 누르면 한 줄 안내(예: 「이 카드는 한글 표기가 없어요」 — 앱 설정이 원인이면 「설정에서 한글 표기를 켜 주세요」로 가른다. 원인 판별은 개발자가 `annotations` 층을 읽고 정한다). 눌러도 반응 없는 버튼 금지(`DeckToolbar` 기존 규약).
- 아이콘: [읽기] 는 기존 「あ」, [한글] 은 「가」(`aria-hidden`, 라벨 텍스트는 「한글」).
- 키: R = 읽기(히라가나)·**H = 한글**(새)·F = 표시·C = 객관식·Space = 뜻 보기·**S = 건너뛰기 확인 시트 열기**(바로 건너뛰지 않는다 — 제스처와 같은 확인을 거친다).
- 옛 4지선다(`mode==='CHOICE'`) 세트의 카드 탭은 지금 `reading` 토글이다 → **히라가나([읽기])만** 토글하도록 둔다(그대로의 의미 유지, 한글은 [한글] 로).

### D. 건너뛰기 확인 시트 (새 UI 1개, 새 화면 아님)
- `FinishConfirmSheet`(끝내기 확인)와 같은 바닥 시트 패턴·같은 초점/ESC/바깥 탭 규칙을 따른다(`SkipConfirmSheet`). 열림 상태는 `VocabDeck` 의 지역 상태(`endOpen` 과 같은 방식).
- 문구: 제목 「이 카드를 건너뛸까요?」 · 본문 「건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.」(개발자가 서버가 정말 그렇게 동작하는지 — 건너뛴 뒤 정답 표시·다시 풀기 불가 — 확인하고 사실과 다르면 문구를 사실에 맞게 줄인다) · 버튼 [건너뛰기](강조) [취소]. 초기 초점은 [취소](실수로 확인을 누르지 않게).
- [건너뛰기] 확정 → 기존 `deck.skip()` 그대로(`answerGuard`·`send({skipped:true})`·`onAnswered`). 시트가 열려 있는 동안 제스처·키보드 입력은 막는다(`sheetOpen` 처리 기존 규칙 — `document.querySelector('[role="dialog"][aria-modal="true"]')`).
- 시트를 연 사이 카드가 바뀌거나 답이 들어오면(자동 다음 등) 시트를 닫는다.

### E. 힌트 줄 (`GestureHint`/`KEY_HINT`)
- 터치 고정 힌트: `'← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시'` → 의미에 맞게 `'↑ 밀어 뜻 보기 · ← 밀어 다음 · → 밀어 건너뛰기'`. 키 힌트(`KEY_HINT`)는 새 키(H, S=확인)에 맞춰 고친다. 상태별로 갈리는 구조(`fixedHint`)는 유지.
- 다른 곳에 남은 옛 서술 정리: `CARD_FIRST.answerFirst`('뜻 보기나 객관식으로 먼저 답해 주세요') 등 버튼 이름을 가리키던 문구를 버튼 없는 현재 상태에 맞게(예: 「카드를 밀거나 눌러서 먼저 답해 주세요」 수준으로) 고친다 — 뜻이 틀리지 않는 범위에서만.

### F. 범위 밖 (건드리지 않는다)
서버·API(#47~#54)·스키마·`SwipeCardStack` 의 `touchend preventDefault`·`touch-action:none`·3장 스택·`classifyGesture` 임계값(탭 <10, 위 dy<−80, 좌우 |dx|>60)·결과 화면·오늘 홈. 네이티브 변경 없음(웹 배포만).

## 구현 담당·파일 (developer 1명, 파일 충돌 없음)
`VocabDeck.tsx` · `DeckToolbar.tsx` · `FlipControls.tsx` · `GestureHint.tsx`(필요 시) · `SwipeCardStack.tsx`(prop 이름·저항 규칙·`bump` 조건 — 위 규칙만) · `useVocabDeck.ts`(`showHangul` 상태·`toggleHangul`·`HINT` 사용) · `deck.ts`(`keyAction`: H 추가·S 의 의미, 순수 함수 보강) · `cardFirst.ts`(문구·`fixedHint`·`tapAction`) · `hooks.ts`(`VOCAB_KEYS.hangulDefault`) · 신규 `SkipConfirmSheet.tsx` · 시험(기존 시험 중 옛 동작을 단언하는 것만 새 동작으로 고치고, 새 시험 추가).

## 완료 기준
1. A~E 의 동작이 코드·시험으로 확인된다(순수 함수 단위 시험: 제스처→의도 매핑, `keyAction`(H·S·C·Space·R·F), 한글 상태 이어받기, 처리 불가 조건; 소스 정규식 시험은 `src/components/__tests__/sourceCode.ts`(주석 제거)만 쓴다).
2. 기존 시험 전체 통과, `tsc` 0, `eslint src` 오류 0, `next build` 0(미러에서 `./node_modules/.bin/next build > log 2>&1` — `npm run build`·`| head` 금지).
3. 360/390/412 폭 높이 예산: 앞면 하단 첫 줄 52px 예약 유지로 **뒤집을 때 카드 무대 높이 불변**, [한글] 칸이 `grid-cols-4` 안에서 넘치지 않음(소스·계산 근거).
4. 서버 규약 위반 없음(제스처 의미만 바뀜), 엔진명 노출 없음, 스키마·API 변경 0.
5. Reviewer 가 실행 증빙을 재실행해 PASS. light 트랙이므로 QA·데모는 면제.

## 구현·감사·QA 결과 (2026-10-12, Leader)
- **구현**: developer 1차(시험 먼저 18 빨강→초록) + 수정 라운드 3회(① 초점·안내 중복·옛 4지선다 터치 힌트 ② 도구 줄 숨은 [건너뛰기] 칩 ③ 감사 지적 M-1·L-1·L-2·L-3). 최종 변경 13개 — `src/components/vocab/`: DeckToolbar·FlipControls·SwipeCardStack·VocabCardFace·VocabDeck·cardFirst·deck·hooks·useVocabDeck + 신규 `SkipConfirmSheet.tsx`·`srChip.ts` + 시험 `__tests__/{cardFirst,deck}.test.ts`. 서버·API·스키마·네이티브 변경 0. 기록 [[task-060-dev-record]].
- **감사 REV-060-1 PASS_WITH_NOTES**(Critical 0·High 0·Medium 1·Low 6·정보 5, [[task-060-rev-record]]): M-1(핵심 배선 시험 공백)·L-1(상태와 무관한 터치 힌트)·L-2(끝내기 시트와 겹침 가드)·L-3(`skipFor` 되살아남) 반영, L-4(저장 중 숨은 칩 무반응)·L-6(새 카드 초점이 body) 수용, L-5 문서 포인터 처리. 변이 시험 18개 모두 잡힘.
- **게이트(Leader 스냅샷 = 커밋된 HEAD `b89d779` + task-060 변경만 덧씌움, 읽기 전용)**: tsc 0 · eslint 오류 0(경고 5 기존) · 시험 3,352건 중 3,351 통과·실패 0·건너뜀 1 · `next build` 0.
- **QA (light 트랙은 QA 면제이나 Leader 재량으로 추가 — 시험 포함 변경 파일 13개로 light 한계 12개 경계, 브라우저 실측 공백)**: 서버 3011(스냅샷 빌드)·QA3/QA4·헤드리스 Playwright 터치 이벤트, [[task-060-qa-a-record]]·[[task-060-qa-b-record]].
  - **A2 제스처 PASS**(위 −79 무반응/−81 뜻 보기, 오른쪽 +59/+61 시트, 취소 POST 0·확정 POST 정확히 1건 `skipped:true`, 답한 카드 오른쪽 밀기 = [이전] 안내+저항 ×0.25, 표시는 위로 밀어 안 켜지고 [표시] 버튼만).
  - **A1 레이아웃 PASS + 관찰 1**: 3폭에서 보이는 [뜻 보기]/[객관식]/[건너뛰기] 0개, 하단 첫 줄 52px 불변, 도구 줄 4칸 같은 너비·넘침 0, 힌트 한 줄 말줄임 0, `main` 스크롤 0. **관찰**: 뒤집으면 카드 무대가 −44px(카드 22px 위로) — 뒷면에서만 생기는 듣기 줄(`DeckListenRow`)이 원인이고 **task-059 부터 있던 동작**(HEAD 코드 동일). §24-1 문구를 「하단 첫 줄은 불변, 카드는 22px 올라감」으로 정정.
  - **B1 [읽기]/[한글] PASS**(4조합 DOM 독립, 저장 키 이어받기·굳히기·새로고침 유지, 뒷면은 앱 설정만, 막힘 안내 2종 재현). **B2 키보드·접근성 PASS**(H·S 확인·Space·C·F·↑ 무동작·Esc, 시트 aria, 숨은 버튼 3개 동작·Tab 칩·이웃 66개 위치 변동 0, 자동 초점 눈에 안 보이는 버튼으로 안 감, 옛 4지선다 세트 동작).
  - **관찰 O-1(기존 문제, task-060 아님)**: 공용 `Sheet.tsx` 에 초점 가둠(trap)·배경 `inert` 가 없어 키보드로 Tab 하면 시트 밖 숨은 버튼에 닿을 수 있다(끝내기 시트도 같음) → 개선 후보.
  - 중간 FAIL 은 전부 스크립트 오류(Playwright 가 `aria-disabled` 클릭 거부 등), 재측정으로 확인.
- **정리**: QA3·QA4 시작 값 복원(Leader 가 `counts34.ts` 로 직접 대조: 전부 0·Profile N5/null/10), 서버 PID 3781608 cwd 확인 후 PID 로만 종료·3011 비움, 미러 `.env`·쿠키 삭제, `claude --print` QA 서버 자식 0(정리 시점 순간 3개는 다른 세션/운영 소속, 곧 0).
- **NOT_VERIFIED**: S25+ 실기기 손 느낌(위 80px·오른쪽 60px 문턱, 대각선), TalkBack 초점 이동, Bluetooth 키보드 Tab 칩, 실제 소리·다크 모드 명암비.
- **사용자에게 알릴 것(검토 요청)**: ① 오른쪽 밀기가 이전이 아니게 됨 — 이전 카드는 [이전]·← 만 ② 위로 밀기로는 ★ 표시 불가 — [표시]·F 만, ↑ 키 무동작 ③ 눈에 안 보이는 대체 버튼 3개(스크린리더·키보드용, 원치 않으면 삭제) ④ 건너뛴 카드는 맞힘·틀림·공부한 수에 안 들어감(시트는 「건너뜀으로 기록하고 뜻을 보여 드려요」까지만 말함) ⑤ [한글] 초기값은 [읽기] 저장값을 이어받음 ⑥ 뒤집을 때 카드가 22px 올라감(task-059 부터).
- **상태**: 운영 배포 완료(아래 「운영 배포」). 사용자 폰 확인 대기.

## 운영 배포 (2026-10-12 13:08 KST, Leader — 사용자 「task-060 배포 후 이어서 다음 작업들도 진행해줘」)
- **커밋**: 코드 `c3a6322`(`src/components/vocab/**` 13개) · 문서 `beab41d` · (회화개선 세션 docs `f9d74f3` 가 위에 얹힘, 문서뿐). 회화개선 세션의 task-061·062 는 사용자 확인 뒤 그쪽이 먼저 push·배포했다(릴리스 `20261012-130400-3c0427b8`) — 이 push 에 남의 코드는 없었다.
- **푸시 전 게이트**(HEAD `beab41d`, `git archive` 사본): prisma generate 0 · tsc 0 · eslint 오류 0(경고 5 기존) · 시험 3,378건 중 3,377 통과·실패 0·건너뜀 1 · `next build` 0. push 직전 `git fetch` 로 origin/main=`3c0427b`·미 push 범위 `c3a6322`+`beab41d`+`f9d74f3`(마지막은 문서뿐) 확인.
- **push** `3c0427b..f9d74f3` → webhook blue/green → 릴리스 **`20261012-130808-f9d74f3c`** `RELEASE_RESULT ok`·`migrated:false`(스키마·APK 변경 없음). **롤백 대상 `20261012-130400-3c0427b8`**(`scripts/deploy.sh TheKaiwa --rollback`).
- **배포 직후 확인**: 헬스 200(`env PRODUCTION`·`status ok`)·pm2 3개 online(재시작 0)·cwd 새 릴리스. 번들 대조: 「이 카드를 건너뛸까요」 7개 파일·「카드를 위로 밀면 뜻이 보여요」 3개·`kaiwa.vocab.hangulDefault` 5개 있음, 옛 문구 「뜻 보기나 객관식으로 먼저」 0개. 운영 읽기 전용 스모크(QA2, GET 만 — POST·LLM·DB 쓰기 없음): `/study/today`·`/study/ai`·`/plan`·`/settings`·`/drawer/words`·`/drawer/corrections` 200, `GET /api/v1/vocab/sessions`·`/stats` 200, 쿠키 삭제.
- **아직 못 본 것**: 새 세트를 푸는 덱 화면(세트 생성 POST 는 운영 쓰기라 안 함) — 개발 미러 QA(A1·A2·B1·B2)로 대체. **사용자 실기기(S25+ WebView·APK)**: 위로 밀기=뜻 보기, 오른쪽 밀기=건너뛰기 확인 시트, [읽기]/[한글] 독립, 하단 안내 한 줄, 숨은 버튼(스크린리더). 확인되면 task-060·IMP-0031·0032·0033 `done`.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-12 |

## 상태 로그
- 2026-10-12 사용자 요청 3건 → IMP-0031·0032·0033 등록(planned) → judge 접수(light) → 이 이력서 작성. 다음: developer 구현 → reviewer.
- 2026-10-12 사용자 결정(직접 입력): 「권고안으로 작업하고 완료되면 알려줘. 검토 후에 배포여부 피드백해줄께」 — 설계 A~F 의 가장자리 결정(오른쪽 밀기=이전 대체·sr-only 대체 버튼·52px 예약 안내·[한글] 이어받기·S=확인 시트)을 그대로 확정. **배포(push)는 사용자가 검토 뒤 따로 피드백할 때까지 하지 않는다.** 완료되면 알린다.
