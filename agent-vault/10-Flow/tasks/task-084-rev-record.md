---
task_id: task-084
role: reviewer
tags:
  - type/record
  - domain/vocab
---
# task-084 Reviewer 기록 (light 트랙) — REV-084

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 3 · native_change false. light 범위 안(변경 코드 4파일 + 새 시험 1 + docs 1, 신규 화면·마이그레이션·네이티브·인증·서버 변경 없음) → «light 승격 필요» 없음.

## 확인한 것 (직접 읽기·실행)
1. **`showsChoiceList(mode, card)` 가 모든 상태에서 의도대로** [확실] — `cardFirst.ts:69-77`: `mode==='CHOICE'` 면 항상 true, 아니면 `!!card && !!card.open && !isAnswered(card)`. 상태별: CHOICE 답하기 전·후 = 보기(옛 `mode==='CHOICE' ||` 와 같다) · FLIP 안 답함+열림 = 보기(F1·P) · FLIP 닫힘/`open` 없음 = FlipControls · FLIP 답함(직접·객관식·건너뜀) = 기록 한 줄 — `open` 값이 남아 있어도. 옛 분기 `mode==='CHOICE' || open || (answered && answeredBy==='choice')` 에서 `open = !!card.open && !answered` 였으므로(VocabDeck.tsx:202) 바뀐 것은 마지막 절 하나뿐이다.
2. **«확인 중…» 이 끊기거나 깜박이는 길이 없다** [확실] — `useVocabDeck.ts` 흐름: `choose`(~398) → `patchCard({pending:true, chosen})` 한 번(보기 열림·안 답함이라 `showsChoiceList` true 유지, «확인 중…» 표시) → 응답 `onAnswered`(337-368)가 `answered:true·pending:false·chosen:null·open:false·flipped:true` 를 **한 번의 `patchCard`(= 한 번의 `setCards`)** 로 넣고 같은 틱에 `setFocus`. 보기→기록 줄 전환은 한 렌더이고 `answered && open` 인 중간 렌더가 없다. 실패(`onAttemptFailed`)는 `pending:false, chosen:null` 만 되돌려 `open` 이 남아 보기가 풀린 채 돌아온다. `apply('refresh')`(146-150)는 `open: openBefore && !isAnswered(c)` 라 다른 기기에서 답이 들어와도 닫힌다. `skip`(~417)은 열린 채 `pending` 이 되었다가 응답이 오면 FlipControls(건너뜀 문구) — 옛 분기도 건너뜀은 보기에서 제외였으므로 같다.
3. **`flipRecordedText` 호출처는 FlipControls 하나** [확실] — `grep -rn flipRecordedText src` → `FlipControls.tsx:52` 외에는 정의(`labels.ts:447`)와 새 시험뿐. `chosenText` 처리: `chosenText != null` 로 가르므로 `undefined`(#49 옛 응답·인자 생략)·`null`(직접·건너뜀)은 직접 문구, `''` 는 객관식으로 읽히지만 서버가 `chosenText` 를 `!body.chosenText` 로 거부하고(`sessions.ts:338`) 직접·건너뜀 행은 `chosenText:null` 로 저장(795)하므로 빈 문자열은 나올 수 없다. `answeredBy`(cardFirst.ts:30)도 같은 `!= null` 규칙이라 띠(`VocabCardFace.tsx:204`)와 기록 줄이 늘 같은 방식을 가리킨다. #50 응답이 `chosenText` 를 싣는다(`sessions.ts:751-764 toAttemptResult`)는 것도 확인 — 답한 **직후** 화면이 «알았어요/몰랐어요» 로 잘못 뜨는 길이 없다.
4. **초점·스크린리더** [확실] — `onAnswered` 의 `setFocus({kind:'next'})` 는 `kind` 분기 밖(359행)이고 `VocabDeck` 의 `deck.focus` 효과가 rAF 뒤 `nextRef` 로 옮긴다. 답한 카드의 도구 줄이 `answered` 변형으로 바뀌며 `nextRef` 가 붙는다(`DeckToolbar.tsx:78-90`) — 같은 렌더에서. 누른 보기 버튼이 사라지는 것은 직접 답하기의 [알았어요] 버튼 소멸과 같은 상황(`goTo` 도 답한 카드는 `'next'`, useVocabDeck.ts:256). 새 메커니즘 없음. SR: `FlipControls` 의 `<p role="status">` 는 답과 같은 렌더에 **새로 마운트**되므로 라이브 영역으로는 안정적이지 않다 — 실제 낭독은 늘 마운트된 `aria-live` 줄(`deck.say`, onAnswered 345-358)이 맡고, screens.md §23-6 C 도 같은 전제다. 직접 답하기도 같은 구조(알림 문구 = 기록 줄 문구)라 이번에 새로 생긴 약점이 아니다. 객관식은 알림 «맞았어요. 정답 {뜻}» + 새 줄 «맞았어요로 기록했어요» 가 겹쳐 읽힐 수 있으나 정보 손실은 없다(아래 노트).
5. **보기 존재에 기대는 곳 grep** [확실] — `grep -rn "ChoiceList\|data-choice\|aria-label=\"보기\"" src tests`: 소비처는 `VocabDeck.tsx:297-299` 하나뿐. `tests/live/p2b-qa/challenge-today-live-ui.ts:185-189` 는 `ol[aria-label="보기"] button` 으로 **답하기 전** 보기를 눌러 답을 넣는 도구라 답한 뒤 상태를 보지 않는다(CHOICE 세트용). 키 처리 `keyAction`(deck.ts:219-)은 `ctx.answered` 면 숫자 키 null·Space/Enter `advance`, `choicesState` 도 답한 카드는 `'none'` — 보기 존재에 안 기댄다. `tapAction`·`upAction`·`fixedHint`·`frontHint` 모두 `answered` 를 먼저 본다. `WordResultList.tsx:43` 의 «내 답» 은 `card.chosenText` 만 읽는다(`card.choices` 는 `ChoiceList`·`VocabDeck.tsx:153` 키 선택 말고는 안 읽음). `DeckNotice`·`GestureHint`·`DeckToolbar` 에 보기 참조 없음.
6. **금기** [확실] — 엔진명 grep 0(`cardFirst/labels/FlipControls/VocabDeck`). 서버·DB·API·네이티브·`ChoiceList.tsx`·`VocabCardFace.tsx`·`SwipeCardStack`·`WordResultList` diff 0, 6층 경계(components/vocab 안 변경)·`index.ts` 우회 없음. 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED`(not_required, light 면제), `.claude/state/demo-gate/evidence.jsonl` 의 task-084 줄 0건 — 에이전트가 `approve/waive` 를 실행한 흔적 없음. dev 기록의 «active task 미지정» 훅 경고는 warn 단계의 활성화 안내일 뿐 승인 부재가 아님(판정에 영향 없음).
7. **실행 증빙 재실행**(미러 `~/.node-local/thekaiwa-dev084`; 6개 소스 `cmp` 동일, `mirror-audit --check` exit 0): `node --import tsx --test choiceAnswered.test.ts cardFirst.test.ts deck.test.ts` → **89 pass / 0 fail**(새 시험 6 포함) · `tsc --noEmit` exit 0. 개발 기록의 묶음 505 pass·eslint·변이 5종은 재실행하지 않았다(턴 예산·읽기 전용) — 변이 M1~M5 가 각각 `showsChoiceList` 의 `!isAnswered`·`flipRecordedText` 의 `chosenText`·덱 분기식·FlipControls 인자·`onAnswered` 초점 분기를 직접 깨므로 시험 단언과 구조적으로 대응한다는 것만 코드로 대조했다.

## 이슈
- **M-1 (Medium, 문서) `docs/screens.md:10263` 이 바뀐 동작과 정면으로 모순** — 「답이 오면 `open=false`(보기는 `answeredBy==='choice'` 라서 계속 보인다)」. 이번 변경이 바로 그 «계속 보인다» 를 없앴고 `open` 규칙을 설명하는 문단이라 다음 개발자가 보기를 되살릴 근거가 된다. 지시서가 갱신 5곳(10252·10257·10281·10334·Q3)만 지목해 개발자가 범위를 지킨 것이므로 개발 결함이 아니라 **지시 범위 누락**. 권고: 이 문장을 «…(task-084: 보기는 답하면 사라지고 기록 한 줄이다)» 로 한 줄 정정.
- **L-1 (Low, 문서) 같은 계열의 낡은 서술 목록** — ① `10151` 반응형 행 «객관식으로 답한 뒤에만 듣기 줄만큼 작아진다(−40px)·360×740+알림+객관식으로 답한 뒤 → main 스크롤» (카드 우선 세트에서는 더는 해당 없음, 이전 4지선다 답한 뒤에만) ② `10461-10463` 데모 실측·QA β1 위험 조합 기록 («객관식으로 답한 뒤 242/302/282», 결함 #1 조합) — 역사 기록이라 지우지 말고 «task-084 이후 FLIP 은 해당 없음» 주석만 ③ `10497` 이전 4지선다 행 «객관식 답한 카드와 같은 높이» ④ `10572` Q4 위험 조합 «객관식 답한 뒤» (지금은 이전 4지선다 세트만) ⑤ `10610` ⑨ «높이 위험 해결됨» 항목의 같은 조합. 이번 지시 범위 밖(dev 기록이 Q4·10462 근처를 이미 보고함). 권고: Leader 가 한 번에 «task-084 로 FLIP 에선 해당 없음» 한 줄씩 덧붙이거나 `screens.md` 정리 task 로 미룸.
- **L-2 (Low, 문서) `docs/screens.md:10333` 표의 근거 문장이 사실과 다름** — «`choices` 는 결과 목록·「내 답」에 쓰이므로 계속 같이 온다». 결과 목록의 «내 답» 은 `chosenText` 를 읽고(`WordResultList.tsx:43`) `choices` 를 읽지 않는다. #49 계약(「FLIP 카드도 choices」)이 이유라면 그렇게 적는 편이 맞다. 동작 영향 없음.
- **L-3 (Low, 시험) 배선 단언이 소스 문자열이다** — 새 시험 6번(`choiceAnswered.test.ts`)이 덱 분기(`\{showsChoiceList\(mode, card\) \? \(`)·`onAnswered` 안 `open: false` 와 들여쓰기 6칸 고정 `^      setFocus\(…'next'…\)$` 를 정규식으로 잠근다(`readCode` 가 주석은 걷어 주석 위장 통과는 없음). 들여쓰기·줄바꿈이 바뀌면 거짓 실패하지만 거짓 통과 길은 못 찾았다. 동작 쪽은 순수 함수(1~3번)와 `FlipControls` 실제 렌더(5번, `renderToStaticMarkup`)로 단언해 소스 의존이 가장 큰 곳은 «배선» 한 곳뿐이다. `VocabDeck` 전체 렌더나 훅의 상태 전이를 보는 시험은 없다(저장소에 DOM 시험 틀이 없는 알려진 한계). 권고: 지금은 둬도 된다.

## 노트 (이슈 아님)
- **카드 무대가 답하는 순간 커진다**(보기 4개 ≈ 232px → 기록 줄 52px, 동시에 뒷면으로 뒤집힘). 겹침 위험은 줄어드는 쪽이지만 «보기 → 기록 줄» 전환에서 카드 키가 한 번 점프한다. 코드 읽기로는 판정 불가 — Leader 실브라우저 항목(완료 기준)에 이미 있음. 디자인 판단이라 결함으로 올리지 않는다.
- **정보 손실은 Leader 결정대로**: 틀린 객관식에서 «내가 고른 보기(✗ 내 답)» 가 카드 화면에서 사라진다(결과 목록 «내 답» 은 남음). 사용자 보고 항목.
- 직접 답은 0.4초 뒤 자동 다음, 객관식은 자동 다음 없음 — 바뀌지 않았고 screens.md Ac 행(자동 아님, D2)과 일치.
- 이전 4지선다(`CHOICE`) 세트·답하기 전 보기 열림(F1·P)·결과 목록·띠(`resultBand`)는 diff 0 / 동작 불변.

## QA 전달 (light 트랙은 QA 없음 — Leader 실브라우저용 high_risk_areas)
- 카드 우선 세트: 객관식으로 답한 **직후**와 [이전] 으로 돌아간 카드 둘 다 보기 없음·기록 줄 문구 = 띠(맞았어요/틀렸어요)·초점이 [다음 카드]로.
- 틀린 보기를 골랐을 때 «확인 중…» → 기록 줄 전환이 한 번에 되는지, 360px+알림+주제 세트에서 무대가 겹치지 않는지.
- 이전 4지선다 세트가 답한 뒤에도 ✓ 정답/✗ 내 답 보기 그대로인지(회귀).
