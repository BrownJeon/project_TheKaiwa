---
task_id: task-059
role: reviewer
tags:
  - type/record
  - domain/vocab
aliases:
  - task-059 REV-186
---

# task-059 Reviewer 기록 (REV-186) — [[task-059-improve-today-words-card-first]]

대상: 고정 스냅샷 `~/.node-local/rev059-tree/`(HEAD `10a4e88` + task-059 33개 파일). Read 전용. 변이는 `~/.node-local/thekaiwa-rev059m` 에서만 하고 `diff -rq` 로 원본 동일 확인함. 범위 밖(talk/·conversation/·engine/·scenario/·phraseHelp·cancel)은 읽지도 지적하지도 않음.

## 판정: **PASS-with-fixes** (Critical 0 · High 0 · Medium 2 · Low 4 · Info 3)

`{ "reviewId":"REV-186", "status":"CONDITIONAL_PASS", "summary":{"critical":0,"high":0,"medium":2,"low":4}, "native_change":false }` — 스키마 판정표상 Critical 0·High ≤1 이므로 PASS 이나, 아래 Medium 2건(계약 문서 정정 · 자리표시 실측)을 QA 전/배포 전에 닫는 조건을 붙여 PASS-with-fixes 로 기록한다. 코드 결함으로 Developer 재순환이 필요한 항목은 없다.

## 확인한 것 (모두 이번 세션에서 직접 읽거나 실행 — [확실])

**A. 서버**
- ① `insertSession`(sessions.ts:362-380): `mode==='CHOICE' || flipChoices` 일 때만 `pickChoices`, 전부 4개면 저장, 아니면 CHOICE 는 FLIP 강등·FLIP 은 전부 null — 「전체 아니면 없음」 [확실]. CHOICE 명시 경로는 이전 코드와 같은 분기(강등 시 보기 null, rng 소비 순서 동일). 미답 CHOICE 카드의 키 구성: `toCardDto`(:222-241)가 `mode==='CHOICE'` 면 `choices` 키를 늘 싣고 뜻·예문·정답은 `FLIP || reveal` 일 때만 → 이전과 동일, 시험이 단언(task008 F1 시험 + 새 시험 :321).
- ② `recordAttempt`(:716-746): 행렬 확인 — FLIP+`chosenText`(`=== meaningSnap` 채점, `∉ choices` 400 `not_in_choices`, 보기 없는 카드도 같은 400) · FLIP+`selfResult` · CHOICE+`selfResult` 400 `mode` · 둘 다 `parseAttemptBody` 의 `one_answer`(모드 검사보다 먼저, :330-ish) · 이미 답한 카드에 다른 방식 재전송은 `a.answer != null` 조기 반환 + `updateMany where answer:null` **이중 방어**로 첫 결과 유지 · `DONE/ABANDONED` 409 · 남의 세트 404(`lockSession` 소유자 조건) · `flagged`/`skipped` 그대로. 세트 행 `FOR UPDATE` 로 동시 요청 직렬화.
- ③ DTO: FLIP 카드는 보기가 있을 때만 `choices` 키(없음·null·[] → 키 없음), 답한 카드의 `chosenText`·`correctText` 는 `reveal` 규칙 그대로.
- ④ 다시 풀기: 새 세트 `FLIP`+`newSeed('FLIP')`(→ `downgraded` false)+`flipChoices:true`. 삭제 단어(`*Snap`) 카드도 보기 대상, 한 카드라도 못 만들면 세트 전체 보기 없음(시험 :554·:569). 추가 쿼리는 `wordEntry.findMany({id,meaning,partOfSpeech})` 1회(트랜잭션 안·사용자 행 잠금 중) — 사용자 7,755 단어 기준 `pickChoices` 30장 실측 **10.2ms**(스크래치 `bench.ts`), 조회는 task-057 실측(풀 조회 72ms)과 같은 규모 → 문제 없음.
- ⑤ `composeWordSessionLocked` 추출: 잠금 순서(`lockUserRow` → `assertNoInProgress`)·빈 상태 3종·카테고리 비교·오늘 DONE 제외·`material = pool≥4 && distinct(active)≥4`(이전 `pool<4 || distinct<4` 의 부정과 동치)·task-053 `ceiling` 전달 [확실]. 차이는 `now` 를 함수 진입에서 한 번 잡아 KST 날짜(제외 집합·세션 `date`)와 가중에 같이 쓰는 것뿐(자정 경계에서 오히려 일관) — Low R-5.
- ⑥ finish: 요약 문구만 변경(`s.mode === 'CHOICE' ? '보기 고르기' : '카드'`, :855). 카운터·통계·반복 항목·관측 미변경. `meta.mode` 는 세션 mode 그대로(R-3).
- 스키마: `prisma/schema.prisma` 스냅샷 = HEAD 동일 [확실] — 변경 0.
- **⑦ L1 판단(Leader 완화) — 수용 가능.** 근거: (a) FLIP 세트는 task-008 F1 부터 `meaning`·`example` 을 처음부터 싣는다 — `choices` 가 정답 정보를 **추가로** 주지 않는다. (b) 위조 시나리오: 클라이언트가 `chosenText = meaning` 을 보내면 서버가 `CORRECT` 로 채점하지만, 같은 FLIP 세트에서 `selfResult:'CORRECT'` 는 이미 무조건 받는다 → 새로 가능해진 위조 능력이 없다. (c) 영향 범위: `WordEntry`·`RepetitionItem`·`StatsSnapshot` 모두 본인 행뿐이고 순위·보상 없음. 챌린지 단어 과제의 완료 조건은 **정답 여부가 아니라 「답한 카드 수」**(`challenges/service.ts:207-209` `answered >= need`) [확실] — 위조 이득 없음. (d) `CHOICE` 명시 세트(정답 미노출)는 시험이 키 집합까지 고정(M3 변이 검출). 한계 1가지(Info I-1): 서버는 사용자가 뜻을 보고 나서 객관식을 골랐는지 알 수 없다 — 클라이언트(`canChoose` 의 `!card.flipped`)만 막는다. 「맞힘」이 자기 보고와 같은 신뢰 수준이라는 뜻이며, 설계 의도(Q9)와 모순되지 않는다.

**B. 덱 화면**
- ① `SwipeCardStack.tsx` 는 33개 변경 목록에 없음(무변경) [확실]. `classifyGesture` 는 `deck.ts` diff 에 없음(키 문맥·`pickNotice` 만 변경). `touchend preventDefault` 유지(`cardFirst.test.ts` 구조 가드). 새 버튼([객관식]·듣기 줄)은 모두 제스처 영역 밖(VocabDeck:244-262), 카드 면(`VocabCardFace`)에 버튼 0.
- ② 카드별 판정: `onTap`=`tapAction`(뜻 보기 면·답함·대기 무반응), `choose`=`answerGuard`+`canChoose`(`open && !flipped`), `toggleChoices`=`canToggleChoices`(`!flipped`), `flip` 이 `open` 을 닫음, `selfGrade` 는 `canPeek && !flipped` 면 거절, 서버는 `one_answer`+첫 결과 유지 → **한 카드에 보기 답과 자기 표시가 함께 가는 길이 클라이언트·서버 양쪽에서 막힘**. (이전 코드와 비교한 `onTap` 의 변화: CHOICE 세트에서 `!isCurrent/answered/pending` 이면 이제 무반응이나, 이 경우는 모두 `side==='back'`(답한 카드)라 이전에도 첫 줄에서 return — 동작 차이 없음.)
- ③ `hasChoices` 하나로 undefined·null·[] 처리, 객관식 숨김 + 알림(`noChoice`) [확실].
- ④ `onAnswered` 의 `r.correctText ?? before.correctText ?? before.meaning` 대체값은 **HEAD 에 이미 있던 줄**(diff 에 없음). #50 응답은 항상 `correctText` 를 싣기 때문에 화면이 정답을 계산하는 길이 아니다 — 지적 없음. 보기의 ✓/✗ 는 `markChoice` 가 `correctText` 로만 그림(미답 FLIP 카드는 `correctText` 없음 → 선공개 없음).
- ⑤ 소리: `view`·`exiting`·`phase` 변화 때 `sound.stop()`(안정된 `useCallback`이라 매 렌더 재실행 아님 — `useWordSound.ts:61-64`), 언마운트·`visibilitychange` 는 훅이 멈춤. `isSoundStopTap` 은 렌더 시점 상태 기준이라 쥔 소리를 틀기 시작한 수십 ms 안의 재탭에서 「소리를 멈췄어요」 알림만 어긋날 수 있음(Dev-D 기록과 동일, Low R-4). 라이브 영역은 `status`·`alert` 두 줄 상시 마운트, `DeckListenRow` 의 `role=status` 는 줄과 함께 마운트(재생 시작 전에 이미 있음).
- ⑥ 키: C(`letterIs`가 `code` 우선 → 한글 자판 KeyC), 열림에서 1~4=보기·Space/Enter 무시·C 닫기, 닫힘에서 숫자 무시, 뜻 보기 면 1·2 유지 — `deck.test.ts` 추가 3건. 초점: 열기(버튼·키)→첫 보기, 닫기→[객관식], 카드 탭은 이동 없음.
- ⑦ 새 문구: `CARD_FIRST`·`KEY_HINT` 원문을 승인 데모 HTML 과 대조 — 11개 중 10개가 데모에 그대로 있고, 나머지 1개(주제 세트 `noChoice` 문구)는 screens.md §23-8 ⑤★ 가 「데모에 없던 것」으로 명시한 문구와 일치. 엔진·모델명 0건(Dev 기록의 grep + 렌더 문구 확인).

**C. 홈·결과·주제**
- ① `mode` 를 #47 에 싣는 곳 0: `TodayHome.tsx:226` `{count, category}`, `topicStartBody`(topicLogic.ts) = `{topicId,count}` 만(옛 토큰 `mode` 는 형식만 검사하고 버림), `useTopicSetStart` 가 `topicStartBody(t)` 사용, `grep "vocab/sessions'"` 로 호출처는 이 둘뿐. `kaiwa.vocab.mode` 는 마운트 때 `writeStore(..., null)` 1회 삭제(`writeStore` 는 try/catch 로 감싸짐).
- ② `MODE_LABEL` 사용처: `labels.ts` 정의 + `cardFirst.ts` 의 `modeTag`/`modeTagAfter`(CHOICE 일 때만) — 다른 곳 0 [확실, grep].
- ③ D5: 합산 타일 그대로, `isMixed`(객관식≥1 && 스스로≥1)일 때만 구분 한 줄·방식 뱃지, `methodTally` 는 `answeredBy`(FLIP: `chosenText != null` → 객관식, SKIPPED 는 어느 쪽에도 세지 않음)로 계산 — 변이 M9·M10 으로 검증.
- ④ 자리표시 `TODAY_CARD_H.word` 230.25/210.75 는 **임시값임이 상수 주석(todaySkeletonSizes.ts:8·16-18)·시험 제목·시험 주석에 명시** — 실측처럼 확정 표기하지 않음 [확실]. H_CLASS 리터럴·`TodaySkeleton.tsx` 구조는 변경 목록에 없음(무변경). 단 닫기 조건은 Medium R-2.
- ⑤ `topicSetStart.ts → ./cardFirst`: 같은 `src/components/vocab/` 폴더 안 import, `cardFirst` 는 `deck`·`labels`·`wordSound`·타입만 의존(서버 모듈 import 0) → module-dependency §4-4 규칙 5(`components/**` 는 서버 모듈 import 금지)와 무관, 순수 모듈 성격(DOM/타이머 의존 없음) 유지.
- ⑥ 360px 뱃지 가로 넘침 → `[QA]`.

**D. 기존 시험 수정 감사(필수)** — `git diff --stat HEAD -- '*test*'` 및 스냅샷 대조로 전수 확인.
| 파일 | 변경 | 판정 |
|---|---|---|
| task008.test.ts:169 | 기대값 `'CHOICE'→'FLIP'` 1줄 | 허용(원인 a), 강도 동일 |
| task042.test.ts:644-646 | 기대값 `'CHOICE'→'FLIP'` 3줄 | 허용(원인 a), 메시지·키 그대로 |
| task042.test.ts:685(제목)·689 | 제목 문자열, `mode` 기대 `'FLIP'` | 허용(원인 b) |
| task042.test.ts:696 | `choices.length===4 && !('meaning' in c)` → `choices.length===4 && c.meaning === 원 카드 meaningSnap` | **보기 4개 단언 유지 + 뜻 단언 추가(강해짐)**. `meaning` 이 undefined 이고 비교 대상도 undefined 인 우연 통과 가능성은 FLIP 이 `meaning` 을 늘 싣는 것으로 차단됨 |
| seedButtons.test.ts:32·47 | `mode`/`onMode` props 줄 2개 삭제 | 허용(props 삭제), 단언 변경 없음 |
| topicLogic.test.ts:206·208 | 같은 props 줄 삭제 | 허용 |
| todaySkeleton.test.ts | 상수 기대값 + 단언 **2개 추가**(74.75 차이) | 허용 — 단언이 늘었음 |
| **deck.test.ts**(Leader 목록 밖) | **+36줄, 삭제 0** (새 `describe` 없이 끝에 3개 `test` 추가) | 추가뿐이라 약화 아님 — 목록 밖 수정이므로 여기 기록 |
그 밖 `labels.test.ts`·`topicSetStart.test.ts` 등은 무수정이며 미러에서 통과(vocab 145/145, learning 87/87 재실행 [확실]). 스냅샷 밖 수정 시험(scenario·prompts·engine·tests/live)은 다른 세션 것이라 범위 밖.

**E. 회귀·호환** — 이전 `CHOICE`(진행 중·보관): 키 집합·채점·요약 문구 유지(시험 :321·:495), 이전 `FLIP`(보기 없음): 카드에 `choices` 키 없음 → 객관식 숨김(시험 :363), 주제/챌린지: 같은 `insertSession`, 챌린지 완료 조건은 답한 장수 기준이라 영향 없음, 계획표 시트 문구: 소비처가 요약 문자열을 파싱하지 않음(`grep 뒤집기` 비시험 코드 0건). 새 시험은 DB 없이 통과(`DATABASE_URL` invalid).

**F. 변이(별도 미러, 13종)** — 시험이 실패하는지:
M1 `recordAttempt` FLIP 보기 답 거절 복원 → **검출**(8건) · M2 `insertSession` FLIP 보기 제거 → 검출(10건) · M3 미답 CHOICE 카드에 `meaning` 노출 → 검출(task008 F1·새 시험 :321) · M4 `a.answer != null` 조기 반환 삭제 → **생존**(동치 변이: `updateMany where answer:null` 이 같은 일을 하는 이중 방어 — 결과 유지에 영향 없음, Info I-2) · **M4b** 조기 반환+조건부 갱신 둘 다 삭제 → 검출 · M5 `one_answer` 완화(`>1`→`>2`) → 검출(2건) · M6 FLIP 에서 `reveal` 선공개 → 검출(4건) · M7 `canChoose` 의 `!flipped` 제거 → 검출 · M8 `topicStartBody` 가 토큰 `mode` 전달 → 검출 · M9 `isMixed` 항상 true → 검출(2건) · M10 `answeredBy` 가 `chosenText` 무시 → 검출(7건) · M11 홈 #47 본문에 `mode` 추가 → 검출 · M12 `tapAction` 의 뜻 보기 면 가드 삭제 → 검출. 실제 결함을 놓친 변이 없음. 미러는 매번 스냅샷으로 복원, 마지막에 `diff -rq` 동일 확인.

## 지적 사항

| ID | 심각도 | 위치 | 내용 · 근거 | 권고 |
|---|---|---|---|---|
| R-1 | **Medium** | `docs/design/api-contract.md` §2-10 #47 (제목 :926 「정답 미포함」, 표 :172, 응답 예시 `"mode":"CHOICE"`, :935 「FLIP 은 `choices` 없음」) | 같은 절의 새 불릿(「카드 우선 세트」 :937-941)과 **모순**: 첫 불릿은 아직 「FLIP 은 choices 없음」·기본 CHOICE 예시·「정답 미포함」을 말한다. 정본이 한 절 안에서 서로 반대 — 후속 구현·QA 가 첫 불릿을 따르면 틀린다. #53(:985) 「삭제된 단어는 `*Snap` 으로 FLIP 카드」도 이전 서술 | Leader 가 제목을 「카드 우선 기본, 정답 미포함은 CHOICE 명시」로, 예시를 `mode` 생략/`FLIP`+`choices` 로, 첫 불릿의 FLIP 문장을 새 불릿 참조로 정정 |
| R-2 | **Medium**(프로세스) | `todaySkeletonSizes.ts:16-23`, `todaySkeleton.test.ts:21-24` | `word` 높이 230.25/210.75 는 클래스 합 임시값이고 시험이 「305−값=74.75」로 **임시값 자체를 고정**한다. 실측이 다르면 홈 로딩→본문 전환에서 레이아웃 점프(task-046 이 막으려던 것). 단어장 빈 상태(240 안팎)는 임시값보다 커져 점프가 확정적 | 배포 전 QA 가 §23-7 A 방법(`t3-heights.mjs ONLY=today`)으로 실측해 상수·시험을 갱신하는 것을 **배포 게이트**에 넣는다 |
| R-3 | Low | `sessions.ts` `vocabObservations`(`meta: { mode, order }`) | 서버 채점 카드도 `meta.mode='FLIP'` 으로 남아 관측 데이터만으로는 객관식/스스로를 구분 못 한다(`VocabAttempt.chosenText` 로는 복원 가능). 학습 개인화가 이 구분을 쓰게 되면 필요 | 지금은 두고 IMP 후속에서 `meta.method` 추가 여부만 기록 |
| R-4 | Low | `VocabDeck.tsx` `onListen` | `isSoundStopTap` 이 렌더 시점 상태라 쥔 소리를 틀기 시작한 직후(`resuming`) 재탭에서 「소리를 멈췄어요」 알림이 잘못 나가거나 더블탭에서 빠질 수 있음(소리 동작 자체는 `soundTapAction` 이 정상 처리) | 허용 — 문서화만 |
| R-5 | Low | `sessions.ts` `composeWordSessionLocked(…, now = new Date())` | `now` 가 사용자 행 잠금 대기 **전**에 잡혀 가중 계산·제외 날짜에 쓰인다(이전엔 잠금 후). 대기가 길어도 수 초 수준 | 허용 |
| R-6 | Low | `DeckNotice.tsx` `noChoice` 문구 | 「뜻이 서로 다른 단어가 4개보다 적어서」는 풀 <4(오늘 끝낸 단어 제외 후)인 경우에도 같은 문구가 나간다 — 이전 `few` 도 같은 문구라 신규 회귀는 아님 | 허용(designer 문구) |

Info: **I-1** 서버는 「뜻을 보고 객관식을 골랐는지」를 알 수 없다(L1 한계, 위 ⑦). **I-2** M4 동치 변이 — 첫 결과 유지가 이중 방어라는 확인. **I-3** 승인 데모 G 탭의 보관 줄 「· 뒤집기 카드」 표기는 Leader 결정 1 로 앱에서 나오지 않는다(사용자 배포 확인 때 고지 — Leader 몫).

## QA 로 넘길 high_risk_areas (실데이터·실기기에서만 확인되는 것)
1. **실제 터치 탭 vs 스와이프**: 10px 미만 탭이 카드 앞면에서 [객관식]과 같은 효과를 내는지, 카드 탭으로 보기가 열릴 때 호환 마우스/click 이 새 보기에 떨어져 **누르지 않은 답이 기록되지 않는지**(`touchend preventDefault` 유지의 실기기 확인).
2. **보기 열림/닫힘 높이**: 360×740·390·412 에서 카드가 하한 200 아래로 가는지(주제 세트+알림+객관식 답한 뒤, §23-7 B) — 이력서 Leader 결정 7.
3. **자리표시 `TODAY_CARD_H.word` 실측**(R-2) 및 단어 0개 빈 상태 점프.
4. **소리 재생**: 뜻 보기 면 [단어 듣기]/[예문 듣기] 실제 음성·후리가나 설정과 무관하게 같은 일본어를 읽는지, 카드 이동 중 소리 멈춤, 브라우저 막힘(blocked) 재시도, 예문 100자 초과·없음.
5. **360px 뱃지/구분 줄**: 결과 화면 방식 뱃지(「스스로 몰랐어요」 등 가장 긴 문구)와 구분 한 줄의 가로 넘침·줄바꿈.
6. **TalkBack**: [객관식] 버튼 `aria-expanded`, 보기 열림/닫힘 알림, 상시 마운트된 status/alert 두 줄이 실제로 읽히는지, 초점 이동(열기→첫 보기, 닫기→[객관식]).
7. **QA 계정 실서버**: 기본 `mode` 생략 세트가 FLIP+보기로 만들어지는지(보기 4개·`meaning` 동시 존재), 이전 `mode:'CHOICE'` 명시 세트 재현, 보기 없는 세트(뜻이 다른 단어 <4) 알림, 혼합 세트(Q9 5장) 합산 2·2·1과 통계 「4문제 중 2개」, 다시 풀기(보관 CHOICE 세트 → 카드 우선), 삭제된 단어 포함 다시 풀기.
8. **롤아웃 60초 창**: 배포 직후 옛 번들이 `mode` 를 실어 보내는 경우(CHOICE 세트가 만들어져도 화면이 호환되는지).

## 요약 (Leader 보고용)
Critical 0 · High 0 · Medium 2(R-1 계약 정본 모순 정정, R-2 자리표시 실측 게이트) · Low 4. Developer 재순환 불필요. L1 완화는 수용 가능(근거 ⑦). 변이 13종 중 실결함 미검출 0(동치 1종 설명). 기존 시험 수정은 허용 범위 안이며 약화 없음, 목록 밖 `deck.test.ts` 는 추가뿐. → R-1(문서)과 R-2(배포 게이트 항목 추가)를 처리한 뒤 QA 진행.

---

# REV-187 (결함 #1 수정분 재검증) — Reviewer, 2026-10-12

대상: Dev-D2 의 한 줄 수정([[task-059-dev-d2-record]]) — `VocabDeck.tsx:220` 카드 무대 `min-h-0` → `min-h-[224px]` + 새 시험 `deckStage.test.ts`. 기준선 `~/.node-local/rev059-tree` ↔ 수정 후 `~/.node-local/rev059b-tree`(실행 미러 `thekaiwa-rev059b/src` 와 `diff -rq` 동일). 소스 수정 0, DB·운영·포트 접근 0. 변이는 `~/.node-local/thekaiwa-rev059bm`(src `cp -a` + node_modules `cp -al`)에서만 했고 끝난 뒤 `diff -rq` 로 스냅샷과 동일 확인.

## 판정: **PASS** (Critical 0 · High 0 · Medium 0 · Low 2 · Info 3) — Developer 재순환 불필요, QA 재측정으로 진행

수정 자체는 결함 #1 의 원인(겹침)을 없앤다. 부작용(4)은 이번 수정을 막을 사유가 아니라 **후속 백로그(designer 결정 필요)** 이고, QA 재측정에서 한 조합이 더 나쁘게 나오면 Medium 으로 올린다(아래 L-1).

## 확인한 것 ([확실] = 이번 세션에서 직접 읽거나 실행)

**1. 변경 범위 — 한 곳뿐.** `diff -rq rev059-tree/src rev059b-tree/src` = `VocabDeck.tsx` 차이 + 새 파일 `__tests__/deckStage.test.ts` 둘뿐. `VocabDeck.tsx` diff 는 220행 클래스 `min-h-0`→`min-h-[224px]` + 바로 위 JSX 주석 1줄이 전부. `SwipeCardStack.tsx` 는 HEAD(`git show HEAD:`)와 **바이트 동일**(0줄). `deck.ts` 는 task-059 로 이미 바뀐 파일이지만 HEAD 대비 diff 에 `classifyGesture`·`resistX`·임계 상수 줄이 0. 카드 상한·하한 `max-h-[340px] min-h-[200px]`(`SwipeCardStack.tsx:134`) 그대로. `touchend preventDefault`(:138·:163) 그대로. 엔진·모델명 grep(VocabDeck.tsx·새 시험) 0건. 기존 시험 파일 변경 0(`__tests__` diff 는 새 파일 하나).

**2. 산술.** `py-3` = 12px(`--spacing` 재정의 없음, 빌드 CSS `padding-block:calc(var(--spacing)*3)`) → 무대 바깥 하한 224 = 카드 하한 200 + 24 = 무대 안쪽 하한 200. 빌드 CSS 에 `.min-h-\[224px\]{min-height:224px}` 생성 확인. 덱 루트 `h-full min-h-[600px] flex-col`(:199), 무대 `flex-1`(= `1 1 0%`)이라 남는 높이가 224 이상이면 지금과 같고, 모자라면 무대만 224 로 버티고 **루트 밖으로 넘친 만큼이 `main`(`(app)/layout.tsx:52` `overflow-y-auto relative min-h-0`)의 스크롤 영역**이 된다. 다른 형제(`BackBar` `flex-none`, 알림·진행·힌트·보기·도구 줄 전부 `flex-none`)는 줄지 않아 한 곳에서만 흡수 — 덱 안쪽 스크롤 상자 새로 없음(§18 화면당 스크롤 1곳 유지). `FinishConfirmSheet` 는 `Sheet`(`createPortal`+`fixed`)라 `main` 스크롤과 무관.
- QA 측정 360×740 주제+`fewer`+보기 답한 뒤: 무대 바깥 179.8 → 224, 안쪽 155.8 → **200 = 카드 하한** → 카드가 무대를 넘지 않아 `items-center` 위·아래 10.1px 번짐 **0**. 페이지 스크롤 = 224 − 179.8 = **44.2px**(Dev-D2 보고와 일치).
- 보기 열림(듣기 줄 전) 같은 조합은 계산상 바깥 223.8 → +0.2px. 반올림에 따라 `scrollHeight−clientHeight` 가 0 또는 1 이 될 수 있다 [추측 — 브라우저 반올림] (QA 확인).

**3. 달라지는 조합 = 무대 바깥이 224 미만이던 곳뿐.** QA β1-3 표(5 크기 × 8 상태)에서 카드가 하한 200 에 안 닿는 상태의 바깥 높이는 카드+24 이므로 모두 ≥ 267.5 → **불변**: F0 340, F1 287.5/340/327.5/340/340, Ac 243.5/303.5/283.5/340/340, B0·Ak 340, 이전 4지선다 처음 287.5/340/327.5. 알림 없는 보기 열림·답한 뒤(360×740 Ac 243.5 → 바깥 267.5)도 불변. 바뀌는 4개(Dev-D2 표, 재계산 일치): 360×740 주제+fewer+답한 뒤 +44.2 · 412×780 같은 조합 +4.2 · 360×740 이전 4지선다+few 답한 뒤 +19.5 · 360×740 주제+fewer+보기 열림 +0.2. 도구 줄은 `pb` 12px 가 있어 **넘침 ≤ 12 면 버튼이 다 보이고(412×780 +4.2), 12 < 넘침 ≤ 38 이면 버튼 아래가 잘리지만 글자는 보이며(+19.5 → 하단 7.5px 잘림), > 38 이면 글자가 접힘선 아래**(+44.2 → 위쪽 19.8px 만 보임) — 클래스 합산(툴바 래퍼 `pt-2` 8 + 버튼 52 + `pb` 12 = 72)으로 확인.
- **QA 표에 없는 조합(계산만, [추측])**: 챌린지 주제 세트는 `TopicDeckLines` 에 챌린지 줄이 하나 더 붙는다(`mt-0.5` 2 + `text-[12.5px]` × body `line-height:1.5`(globals.css:124) ≈ 18.75 → **+약 20.75px**). 그러면 같은 알림 조합의 넘침이 360×740 보기 열림 ≈ +21, 412×780 답한 뒤 ≈ +25, 390×800 답한 뒤 ≈ +5, **360×740 답한 뒤 ≈ +65**(이때 도구 줄 버튼 위쪽이 접힘선 + 1px — 사실상 **안 보임**). 이 조합은 수정 전에는 카드가 알림·듣기 줄을 더 크게 덮던 곳(안쪽 ≈ 135 대 카드 200)이라 수정이 개선이지만, 덮음 대신 도구 줄이 접힘선 아래로 가는 모양이 달라진다.

**4. 부작용 — [다음 카드]가 접힘선 아래로 밀리는 문제.**
- 코드 근거: 답 응답 뒤 `setFocus(kind:'next')`(`useVocabDeck.ts:351`) → `VocabDeck.tsx:74-81` 이 `nextRef.current.focus({ preventScroll: true })`. 즉 **초점이 [다음 카드]에 가 있어도 `preventScroll:true` 라 `main` 이 올라오지 않는다**(:73 주석 「스크롤은 건드리지 않는다」가 의도). 객관식으로 답한 카드는 자동 다음이 없다(자동 다음은 `kind==='self'` 만, 400ms).
- 사용자가 다음으로 가는 경로(전부 코드로 확인): ① **카드 왼쪽 밀기** — 답한 카드는 허용(`canGoNext`), 카드는 접힘선 위에 온전히 보이고 힌트 줄 「← 밀어 다음 · …」(`KEY_HINT.touch`, 터치 기기 고정)이 늘 보임 ② 도구 줄의 보이는 부분 탭(+44.2 에서 위쪽 19.8px × 가로 약 절반, 터치 기준 44px 미만) ③ **알림 [✕ 닫기]**(`DeckNotice` 44×44, `fewer`·`few`·`topicReason`·`noChoice` 는 자동으로 안 닫힘 — 자동 닫힘은 `resume` 4초뿐, `useVocabDeck.ts:227-231`)를 누르면 넘침이 사라짐 ④ 키보드: 초점이 [다음 카드]에 있어 Enter/Space 는 버튼 동작(`keyAction` 이 `focusOnControl` 이면 null → 기본 click), →·방향키는 `next` — 보이지 않아도 동작 ⑤ 화면 읽기: 초점 이동은 `preventScroll` 과 무관하게 읽히고 TalkBack 의 이동은 스스로 스크롤.
- 영향 범위: 앱 목표 화면(S25+ 412×892, 앱 WebView ≈390×844)은 이 조합에서 스크롤 0(QA 390×800·412×780 겹침 없음, 892/844 는 표 불변). 360×740 급 작은 화면·큰 글꼴·챌린지 주제 세트에서만. 이전(겹침)보다 나쁘지 않다 — 이전은 알림·듣기 줄이 카드에 **가려져 눌리지 않거나 읽히지 않았다**.
- 결론: **이번 수정을 막을 사유 아님 → 후속 백로그 (Low).** 단 QA 재측정에서 챌린지 주제 세트+알림+360×740 답한 뒤에 도구 줄이 **완전히 접힘선 아래**이고 **밀기 외에 길이 안 보이면** Medium 으로 올려 처리한다.
- **가장 작은 개선안 (designer/Leader 결정 필요 — 지금 코드의 :73 「스크롤은 건드리지 않는다」 규칙을 건드리므로 reviewer 가 정할 일 아님)**: ⓐ `VocabDeck.tsx:78` 에서 `kind==='next'` 일 때만 `focus()` 뒤에 `el.scrollIntoView({ block: 'nearest', behavior: deck.reducedMotion ? 'auto' : 'smooth' })` 한 줄 — 이미 보이면 아무 일도 안 한다. 비용: 넘칠 때 `main` 이 위로 최대 ≈ 32px(+44.2) / 65px(챌린지) 올라가 [오늘로] 줄이 부분적으로 접힌다. ⓑ (설계 의도에 더 가까움 — `screens.md` §23-4 D 가 알림을 「덱 첫 열기에 한 번 보이는」 것으로 설계) 정보성 알림(`few`·`fewer`·`topicReason`·`noChoice`)을 **첫 답을 기록한 뒤 `resume` 처럼 자동으로 닫기** — 63px 가 사라져 이 문제 자체가 없어진다. 어느 쪽이든 새 데모·승인이 필요한 정도는 아니다(동작 미세 조정) — Leader 가 데모 게이트 `none/delta` 를 판정. `preventScroll:true` 를 그냥 빼는 방법도 되지만 Blink 의 초점 스크롤 정렬은 상황별로 달라 [추측] 결정적이지 않아 권하지 않는다.

**5. 새 시험 품질.** 파일 전체를 읽음 — 소스 클래스 문자열을 파싱해 (1) 카드 상한·하한 200/340 (2) 무대에 `min-h-0` 없음 + 무대 `min-h-[Npx]` 가 카드 하한 + `py`×2 와 **같음** + `flex-1`·`items-center` (3) QA 실측 10 조합 계산표. 변이를 `thekaiwa-rev059bm` 에서 적용·복원하며 `deckStage.test.ts` 만 실행(`DATABASE_URL` 무효값):

| 변이 | 결과 |
|---|---|
| M1 무대 `min-h-[224px]` → `min-h-0` | 3 중 **2 실패**(2·3) |
| M2a `min-h-[200px]` / M2b `[220px]` / M2c `[240px]` | 각각 **2 실패**(2·3) — 240 은 「더 크면 넘치지 않던 조합까지 스크롤」 쪽도 잡는다 |
| M3a `py-3`→`py-2` / M3b `py-4` | 각각 **2 실패**(2·3) |
| M3c `py-3`→`pt-3 pb-3`(형태 변경) | **3 실패**(패딩 파싱 불가 → 닫힘 실패, 의도된 fail-closed) |
| M4 무대 `flex-1` 제거 | 1 실패(2) |
| M5 카드 하한 200→180 / M6 카드 상한 340→360 | 각각 (1)·(3) 포함 실패 — 카드 크기 상수 고정도 지킴 |

원복 뒤 3/3 통과, `diff -rq` 로 스냅샷과 동일. **vocab 시험 전체 `148 tests / 148 pass / 0 fail`**(= 기존 145 + 새 3, 기존 시험 파일 무수정). 게이트 `/tmp/claude-1000/rev059b/result.txt` = `tsc=0 eslint=0 test=0 build=0`, 미러 `src` = 스냅샷과 동일.

**6. 기록 파일 대조.** `task-059-dev-d2-record.md` 의 줄 번호(:220 무대·`SwipeCardStack.tsx:134` 카드)·계산표(O·카드·넘침·추가 스크롤)·「수정 전 3 중 2 실패」·「200px/240px/min-h-0 변이 pass 1 fail 2」가 클래스·내 재실행과 일치. 그 기록의 「남는 위험 ①~④」는 내 4번과 같은 결론 — 빠진 것은 **챌린지 줄(≈ +21px)** 로 위험 조합이 늘어난다는 점뿐.

## 지적 사항
- **L-1 (Low, 후속 백로그 — 조건부 Medium)** 답한 뒤 [다음 카드] 줄이 360×740 + 알림 + 답한 뒤에서 접힘선 아래(위쪽 19.8px 만) — 챌린지 주제 세트는 ≈ +21px 더 밀려 도구 줄이 안 보일 수 있음(계산, 미측정). 근거 `VocabDeck.tsx:78`(`preventScroll:true`)·:220(`min-h-[224px]`). 시나리오: 360폭 폰에서 객관식으로 정답을 누르면 결과 띠는 보이는데 [다음 카드]가 반쯤/전혀 안 보임. 완화 경로 4개(밀기·알림 닫기·키·화면 읽기)가 있음. 권고: 위 ⓐ/ⓑ 중 하나를 designer/Leader 결정으로 별도 task(또는 `/개선작업`)로.
- **L-2 (Low, 문서)** `docs/screens.md` 가 수정 뒤 사실과 어긋남 — §23-0 「반응형」 행 「360/390/412 모두 덱 스크롤 0」, §23-7 B 제목 「(스크롤 0 유지)」, §23-7 B 끝 「위험(미확인) … [추측]」(이제 확인·해결). 3~4 조합은 의도적으로 `main` 스크롤을 허용(= §23-7 B 가 예고한 대로). 권고: 한 줄 보강 + 23-12 ⑨ 에 결과 기록(문서만).
- **I-1 (Info)** 새 시험은 소스 클래스 문자열 고정(정적)이라 실제 겹침은 못 본다(다른 클래스가 덮어쓰기·형제의 `shrink`·DOM 구조 변경 불가시). 프로젝트의 다른 높이 시험과 같은 방식이고 변이 10종을 모두 잡았다 — 실제 겹침 확인은 QA 재측정 몫.
- **I-2 (Info)** `py-3` 은 rem, `min-h-[224px]`·카드 200 은 px — 시스템 글꼴·루트 크기를 키우면 패딩만 커져 카드가 패딩 안쪽으로 몇 px 넘칠 수 있으나 패딩 안이라 이웃은 안 덮는다(15px 패딩이면 안쪽 194 → 3px씩). 영향 없음.
- **I-3 (Info)** 덱 루트 `min-h-[600px]`(키 큰 가로 모드·아주 낮은 화면)에서도 같은 원리로 바닥값 아래로 줄던 무대가 224 에서 멈추고 `main` 스크롤이 는다 — 의도한 동작.

## QA 재측정 때 꼭 볼 항목 (high_risk_areas)
1. **결함 #1 조합 재현**(360×740, 주제 세트 + `fewer` 알림, 보기로 답한 뒤): 카드 높이 200(하한)·알림 박스 아래↔카드 위, 카드 아래↔듣기 줄 **겹침 0**, `main` `scrollHeight−clientHeight` ≈ **44.2**, [다음 카드] 보이는 높이(≈ 19.8), 그 보이는 부분을 눌러 다음 카드로 가는지, 왼쪽 밀기로 가는지, [알림 닫기] 후 스크롤 0 으로 복귀하는지.
2. 같은 조합 **412×780**(≈ +4.2, 도구 줄 다 보임), **390×800**(겹침·스크롤 0), 이전 4지선다+`few` **360×740 답한 뒤**(≈ +19.5, 도구 줄 하단 ≈ 7.5px 잘림·글자 보임), 주제+`fewer`+**보기 열림 360×740**(≈ +0.2 — `scrollHeight` 반올림으로 1px 흔들림이 없는지).
3. **QA 표에 없던 변형**: **챌린지 주제 세트**(챌린지 줄 있음) + 알림 + 360×740/412×780/390×800 에서 보기 열림·답한 뒤 — 예상 +21/+25/+5/**+65**. 도구 줄 보이는 높이, 안 보이면 밀기·알림 닫기로 닿는지(L-1 승격 판단).
4. **불변 대조군**: 40+ 측정 중 F0 340·F1·Ac·B0·Ak·이전 4지선다·390×844·412×892 의 카드 높이와 `main` 스크롤 0 이 수정 전 값과 같은지(바뀌면 이 수정의 부작용).
5. 스크롤된 채(≈44px) 다음 카드로 넘어가면 `main` `scrollTop` 이 0 으로 돌아와 새 카드 윗부분이 잘려 보이지 않는지, 마지막 카드 [결과 보기] 뒤 결과 화면 진입 시 스크롤 위치.
6. 알림이 **3줄**이 되는 큰 글꼴/좁은 폭(360)에서 위 1번 반복(스크롤만 커지고 겹침은 없어야 함 — 하한이라 겹침 불가는 코드 근거).
7. 자동 다음(스스로 알았어요/몰랐어요, 400ms) 경로는 이 수정과 무관하게 같은지(538~550ms 유지).

## 요약 (Leader 보고용)
**PASS** — Critical 0 · High 0 · Medium 0 · Low 2(L-1 [다음 카드] 접힘선 아래 후속 백로그·조건부 Medium, L-2 screens.md §23 문구 보정) · Info 3. 변경은 `VocabDeck.tsx` 한 줄+주석과 새 시험뿐이고 `SwipeCardStack.tsx`(HEAD 바이트 동일)·제스처·카드 상한/하한·`preventDefault` 는 무변경. 무대 하한 224 = 카드 하한 200 + `py-3`×2 라 결함 조합(360×740)에서 카드가 이웃을 못 덮고 `main` 이 44.2px 스크롤. 바뀌는 조합은 바깥 높이가 224 미만이던 4곳뿐, QA 표의 나머지 40+ 측정은 불변. 새 시험은 변이 10종(필수 3종 포함)을 모두 잡고 vocab 148/148. 부작용은 이번 수정을 막지 않음 — 챌린지 주제 세트(+약 21px)에서 도구 줄이 더 밀릴 수 있어 QA 가 그 조합을 꼭 재야 한다.
