---
tags:
  - type/review
  - domain/ask
task: task-064
reviewer: REV-064-SCROLL (질문 방 답 도착 스크롤 위치, QA64-B2-1)
status: 완료 (PASS_WITH_NOTES)
---
# REV-064-SCROLL — 질문 방 답 도착 스크롤 위치 구현 감사

감사 대상: `src/components/chat/arrivalAlign.ts`(신규) · `MessageList.tsx`(`arrivalAlign`·`pillLabel` hunk) · `src/components/ask/AskRoom.tsx`(355-356행) · 시험 `chat/__tests__/arrivalAlign{,Wiring}.test.ts`. 규칙 정본 = `docs/screens.md` §25-5 J. (의뢰문의 「J-8 합격선」은 문서상 **J-7**, J-8 은 후속 후보 목록.)
검증 장소: 전용 미러 `~/.node-local/thekaiwa-dev064s`(작업 트리와 `diff -rq` 대조 후 `rsync -a --delete`; 차이는 `askLimits.ts` 한 파일뿐이었음). 다른 미러·포트 미사용. 변이·임시 파일은 모두 원복해 `diff -rq src tests` 0 확인. 작업 트리 소스·docs 수정 0, git 쓰기 0.

## 판정: PASS_WITH_NOTES (Critical 0 · High 0 · Medium 0 · Low 4 · 정보 2)

## 게이트 (미러, 작업 트리와 동일 소스)
- `chat`·`ask`·`talk` 시험 340건 통과 / 0 실패. `src/components` 전체 `--test-concurrency=1` 1,457건 중 통과 1,455 · 실패 0 · skipped 2 (개발 기록과 동일).
- `tsc --noEmit --incremental false` rc 0 · `eslint`(변경 5파일) rc 0.
- 엔진명·model_id 문자열 0건, import 는 `./followHold`·`./arrivalAlign` 상대 경로뿐 — 6층 경계·네이티브·Secret 영향 없음(클라이언트 스크롤만).

## 항목별 결과

1. **회화·채팅·역할극 불변 — OK.**
   - 기본값 `'bottom'` 에서 새 분기는 실행되지 않음: `scrollToBottom` 의 `if (alignAnswerStart)`(MessageList.tsx:216) · `onScroll`(:247) · 메시지 효과(:259) · 내용 관찰자의 `alignAnswerStart ? … : contentGrowthAction`(:321-323, 기본은 기존 함수 그대로) · 만짐 리스너 효과(:349, `!alignAnswerStart` 면 리스너 0개) · `showPill`(:360) · `data-mid`(:424, 기본은 속성 없음) · 알약 글(:490-497, 기본 「새 메시지 ↓」).
   - 추가된 것은 ref 대입 효과 1개·`useState(pillId)` 1개·상수 의존성뿐(`alignAndWatch`/`alignTo`/`settleBottom`/`setPill` 은 `useCallback` 안정 참조) — 재실행 횟수·렌더 횟수 불변.
   - 직접 대조: HEAD 의 `MessageList.tsx` 를 미러에 임시 복사해 같은 props 로 `renderToStaticMarkup` 비교 — 6가지 메시지 상태(빈 방·질문+답·대기·꼬리 대기·실패·날짜 구분) × 3가지 옵션(기본·`followContent`·`hasOlder`+`tail`+`liveOff`) = **18건 마크업 문자열 동일**. 임시 파일은 삭제.
   - 호출처: `arrivalAlign`/`pillLabel` 을 넘기는 곳은 AskRoom 하나(시험 ① 이 고정).
2. **계산 정확성 — OK.** `arrivalTarget`(arrivalAlign.ts:26-30)은 J-1 과 항별로 일치: `lead = qTop 없음 ? 0 : min(max(0, aTop−qTop), ⌊C/3⌋)`, `target = min(max(aTop−lead−pad, 0), max)`. `clientHeight`·`scrollHeight`·질문/답 윗면은 `measureArrivalTarget` 이 호출 순간 DOM 에서, `pad` 는 `alignTo` 가 매번 `getComputedStyle().paddingTop` 으로 잼(MessageList.tsx:191). 짧은 답 경계: 정렬 위치 ≥ 바닥 ⟺ `C ≥ lead + 답 + pad + padB` 가 J-1 의 「lead + 답 행 + pad×2 ≤ C」와 같음(시험 「경계」가 ±1 고정). 실제 함수로 계산한 J-7 대조(질문 `<li>` 윗면 = 700, 답 `<li>` = 질문 + 행 높이 + 간격 12, 누가 줄 36):

   | 경우 | 질문 윗면 − 목록 위 | 답 article 윗면 | J-7 범위 |
   |---|---|---|---|
   | 360 (C583) 질문 1줄 79 / 2줄 102, article 793 | 12 / 12 | 139 / 162 | [48,242] OK |
   | 390 (C687) article 799, 1줄 | 12 | 139 | [48,277] OK |
   | 412 (C735) article 800, 2줄 | 12 | 162 | [48,293] OK |
   | 360 4,000자 article 5,743 | 12 | 139 | [48,242] OK (시작이 5,100px 위로 밀리지 않음) |
   | 360 짧은 답 article 214 | 바닥(max−target=0), 질문 윗면 230 — 질문·답 모두 목록 안 | — | 바닥 ±1 OK |
   | 360 질문 8줄(300) | −106(끝부분만) | 답 `<li>` = 206 = 12+⌊C/3⌋(194) | OK |
   | 키보드 C283, 질문 1줄 / 2줄 | 12 / −8 | 답 `<li>` 103 / 106 (≤106), article 보이는 높이 144 / 141 (≥130) | OK |
3. **효과 순서·함정(J-6) — OK.**
   - 선언 순서 `messagesRef` 효과(:164) → 메시지 효과(:254) → `[pendingVisible, turn.phase]` 효과(:293). 메시지 효과의 `alignAndWatch → alignTo → settleBottom`(:194-195, :181-185)이 `scrollTop` 대입 직후 `atBottomRef`·`atBottom` 을 새 위치로 재측정하므로, 같은 커밋의 :293 효과(`atBottomRef.current` 일 때만 바닥)와 내용 관찰자 `follow` 가 되돌리지 못함. 긴 답은 `false`, 짧은 답은 `true`(= 같은 바닥).
   - 2초 창: `performance.now()` 비교만(`setTimeout/setInterval/requestAnimationFrame` 0건 — 시험 ④ 고정). 관찰자는 효과 반환에서 `disconnect`(:343), 만짐 리스너 4종은 같은 이름으로 `removeEventListener`(:355-357), prop(`alignAnswerStart`) 변경 시 효과 재실행으로 정리됨. `MutationObserver` 는 쓰지 않음.
   - 사용자 만짐: `pointerdown·touchstart·wheel·keydown` → `touched` → `windowGrowthAction` 이 `realign` 을 끊음; 펼침 hold 가 `realign` 보다 우선(:85-86). 새 정렬(`alignAndWatch`)마다 창·`touched` 가 새로 시작.
   - StrictMode(개발) 이중 효과 추적: 2차 실행은 `statusRef` 덕분에 도착으로 오인되지 않고 `atBottomRef` 가 `false` 라 정렬 위치 유지(짧은 답은 `true` 라 같은 바닥).
4. **알약 — OK(해석 1건 정보).** 위로 올려 둔 채 도착하면 `answerStartPlan`=`pill` → 위치 유지(앞붙임 동반 시 그 보정만, :272) + 답 윗면이 안 보일 때만 `setPill`(:274). 누름 `onArrivalPill`(:232-236) = `alignAndWatch` + `focusList()`(`preventScroll`, `focusable` 일 때만). 사라짐: 누름·`onScroll` 의 바닥 도달/윗면 보임(:247-251)·`scrollToBottom`(:216-219). 알약 버튼은 `role=log` 상자 밖 형제(:484-499)라 `aria-live` 중복 발화 없음, `↓` 는 `aria-hidden`, 글은 `ASK_COPY.newAnswer`(「새 답」, 하드코딩 없음).
5. **재진입·대기/실패·널 방어 — OK.** `answerStartPlan`: 마지막이 끝난 답이 아니면(대기·실패·내 질문뿐·빈 방) `default`(= 맨 아래), 첫 로드 + 끝난 답이면 `align`. `questionIdBefore` 는 `findIndex`=−1·첫 행·앞이 답인 경우 모두 `null`, `measureArrivalTarget` 은 질문 행이 DOM 에 없어도 답 윗면 기준, 답 행이 없으면 `null` → `alignTo` false → 기본 바닥 규칙으로 폴백(:267-268 `handled=false`). 변이 M08(널 방어 제거)을 시험이 잡음.
6. **변이 30건** (아래 표). 25 잡힘 · 5 생존. 생존 5건은 전부 **동등 변이가 아닌 MessageList 연결의 시험 공백**(브라우저 QA 가 닫아야 함).
7. **접근성·회귀 후보 — OK.** 이동은 모두 `scrollTop` 대입(즉시) — `smooth`·`scrollIntoView`·`scrollTo` 0건(시험 ⑤ 고정)이라 `prefers-reduced-motion` 영향 없음. DOM 순서·`role=log`·`liveOff`·도착 status 줄 불변(바뀐 것은 `scrollTop` 과 알약 하나). `focusList` 는 이전 단계 코드 그대로(`focusable` 게이트·`preventScroll`). 키보드 열림: 정렬 뒤 `clientHeight` 가 줄어도 `atBottomRef=false` 라 기존 clientHeight 관찰자가 바닥으로 끌지 않음(짧은 답은 `true` 라 바닥 유지 — 기존 동작).

## 변이 표 (미러 사본에만 적용, 매번 원복)

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M01 | 정렬 기준을 답 윗면(lead 0) | 잡힘 | J-7 긴 답·4,000자 3폭 등 |
| M02 | ⌊C/3⌋ 상한 제거 | 잡힘 | 8줄 질문·키보드·소수점 버림 |
| M03a | 클램프 아래끝(0) 제거 | 잡힘 | clamp 아래끝 |
| M03b | 클램프 위끝(max) 제거 | 잡힘 | 짧은 답 3폭·clamp 위끝 |
| M04 | 기본값 `'answer-start'` | 잡힘 | ② 기본값·기본 렌더 동일(3건) |
| M05a | `settleBottom` 의 `atBottomRef` 갱신 제거 | 잡힘 | ⑤ J-6 ① |
| M05b | `alignTo` 의 `settleBottom` 호출 제거 | 잡힘 | ⑤ J-6 ① |
| M06 | 알약 글 하드코딩 | 잡힘 | ① AskRoom·③ 알약 |
| M07a | 2초 창 길이 0(MessageList) | **생존** | — (공백 G1) |
| M07b | 창 판정(`windowGrowthAction`) 제거 | 잡힘 | windowGrowthAction 창 안 |
| M08 | 질문 행 찾기 널 방어 제거 | 잡힘 | questionIdBefore |
| M09a | 만짐 리스너 해제 제거 | 잡힘 | ④ 정리 |
| M09b | 내용 관찰자 `disconnect` 제거 | 잡힘 | ④ 정리 |
| M10 | 창 판정이 `touched` 무시 | 잡힘 | windowGrowthAction 만졌거나 |
| M11 | `scrollToBottom` 이 창을 안 끝냄 | 잡힘 | ⑤ J-6 ② |
| M12 | `scrollToBottom` 이 알약을 안 지움 | 잡힘 | ⑤ J-6 ② |
| M13 | `isArrival` 이 `prevStatus` 무시 | 잡힘 | isArrival·answerStartPlan |
| M14 | align/pill 뒤바꿈 | 잡힘 | answerStartPlan 규칙 1·2 |
| M15 | 알약 누름 뒤 초점 이동 제거 | 잡힘 | ⑤ J-4 |
| M16 | `alignTo` 가 `padTop` 을 0 으로 | **생존** | — (공백 G2) |
| M17 | `data-mid` 상시 | 잡힘 | ② 기본 렌더(2건) |
| M18 | 정렬한 커밋도 기본 규칙 실행 | 잡힘 | ⑤ J-6 ③④ |
| M19 | 윗면이 보여도 알약 띄움 | **생존** | — (공백 G3) |
| M20 | 정렬 창 `touched` 초기값 true | **생존** | — (공백 G4) |
| M21 | 기본 알약 글 변경 | 잡힘 | ② 기본 모드 |
| M22 | `realign` 이 아무것도 안 함 | 잡힘 | ⑤ J-3 |
| M23 | `hold` 우선순위 제거 | 잡힘 | windowGrowthAction hold |
| M24 | 알약 사라짐에서 바닥 도달 조건 제거 | 잡힘 | ⑤ J-6 ② |
| M25 | 알약 누름이 정렬 대신 맨 아래 | 잡힘 | ⑤ J-4 |
| M26 | 재진입(firstLoad)을 default 로 | 잡힘 | answerStartPlan 규칙 3 |
| M27 | 알약 가지의 앞붙임 보정 제거 | **생존** | — (공백 G5) |
| M28 | 만짐 이벤트에서 `wheel` 제거 | 잡힘 | ④ 정리 |
| M29 | 기본 방이 `windowGrowthAction` 사용 | 잡힘 | ⑤ J-3 |
| M30 | `rowTop` 이 `scrollTop` 미반영 | 잡힘 | rowTop·measureArrivalTarget |

주의: `MessageList` 쪽 시험(wiring)은 소스 정규식이라 「그 줄이 있다」만 확인하고 「효과가 실제로 돈다」는 못 닫는다 — 아래 생존 5건이 그 한계다(jsdom/브라우저 훅 시험 도구가 이 저장소에 없음).

## 발견 목록

- **REV-SCROLL-1 [Low, 시험 공백]** `MessageList.tsx` 연결의 5곳이 시험으로 보호되지 않음: G1 `until: performance.now() + ARRIVAL_WINDOW_MS`(:203) · G2 `padTop` 읽기(:191) · G3 도착 시 「윗면이 보이면 알약 안 띄움」(:274) · G4 `touched: false` 초기값(:203) · G5 알약 가지의 앞붙임 보정(:272). 재현 = 위 변이 M07a·M16·M19·M20·M27(사본에서 모두 시험 통과). 권고(비차단): 판정 몇 줄을 순수 함수(예: 새 창 만들기 `newAlignWindow(now)`, 알약 표시 판정)로 빼 단위 시험, 또는 QA 브라우저 확인으로 대체(아래 QA 항목 2·4·5).
- **REV-SCROLL-2 [Low, 가이드 공백 해석]** 위로 올려 둔 채 도착했는데 그 순간 답 `<li>` 윗면이 이미 보이는 영역 안이면 알약을 띄우지 않음(MessageList.tsx:274). J-2 규칙 2 문구엔 없음(「윗면이 들어옴 → 사라진다」만). 합리성 판단: 윗면이 보이면 첫 `onScroll` 에서 어차피 사라질 알약이고 사용자는 답 시작을 직접 보므로 타당 [가능성 높음]. 윗면이 영역 맨 아래 끝에 걸려 아바타 줄만 보이는 경우 도착 인지가 늦어질 수 있음 → designer 가 규칙 2에 한 문장 명시 권고.
- **REV-SCROLL-3 [Low, 가이드 표기 불일치]** J-5 의 `isArrival(prev, next)` 는 구현이 `isArrival(prevStatus, last)`(같은 id 의 직전 상태 — 임시 말풍선이 걷히며 옛 답이 마지막이 되는 경우의 오인 방지, 시험으로 고정). 동작은 옳고 문서만 어긋남 → designer/Leader 가 J-5 문구 정정.
- **REV-SCROLL-4 [Low, 추측]** 2초 창의 「만짐」 판정이 `pointerdown·touchstart·wheel·keydown` 뿐 — TalkBack 이중 탭의 접근성 클릭이 포인터 이벤트 없이 `click` 만 낸다면 [추측] 도착 후 2초 안에 사용자가 [n개 더 보기]를 열 때 `SourceList` 는 `FollowHoldContext` 를 쓰지 않아(`ExtraNoteLine` 만 씀) `realign` 이 열린 줄을 위로 끌어올 수 있음. 영향 = 도착 직후 2초 한정. 권고(비차단): 목록에 `click` 도 만짐 이벤트로 추가.
- **[정보]** `pillLabel` 은 `arrivalAlign` 과 무관하게 알약 글에 적용된다(가이드는 `answer-start` 일 때 쓴다고 함). 호출처가 AskRoom 하나이고 시험 ① 이 고정 → 현재 영향 없음.
- **[정보]** 첫 로드 직후 입력 바·표시 바 높이가 바뀌어 `C` 가 달라지면 첫 정렬 값이 어긋날 수 있음(개발 기록에도 있음) — 형제 효과 순서상 `MessageList` 효과가 `Composer` 보다 먼저 돌므로 QA 재진입 실측에서 확인.

## QA 가 브라우저에서 꼭 확인할 것 (high_risk_areas)

1. SSE `done` 로 긴 답 도착(A1·A2) 360/390/412: 질문 `<li>` 윗면 − 목록 위 = 12±2, `article` 범위 360 [48,242]·390 [48,277]·412 [48,293]; **도착 직후 5~10프레임 뒤에도 그 자리에 머무는지**(J-6 ① 순서 — 단위 시험은 소스 정규식뿐).
2. 폴링 도착(이어받은 대기)에서 제안 카드가 늦게 붙어도 질문 윗면 ≤2px 이동(2초 창 길이·`touched` 초기값 — 생존 변이 G1·G4), 도착 직후 목록을 만지면 더 이상 당겨 가지 않음, 도착 2초 안 [n개 더 보기].
3. `pad` 반영(글자 크기 200%·시스템 글자 확대): 질문 윗면이 목록 위 `pad` 에 오는지(G2).
4. 위로 올려 둔 채 도착: `scrollTop` 변화 0(±1), 「새 답 ↓」 1개(보이는 36·히트 44), 누르면 정렬 + `document.activeElement` = 목록, 바닥 도달·다음 보내기에서 사라짐; 윗면이 이미 보이는 영역일 때(G3)와 앞붙임(이전 메시지 보기)과 동시일 때(G5).
5. 짧은 답(되묻기 A3): 바닥 ±1·질문·칩 4개 보임. 재진입 4방 × 3폭, 이어받은 대기·실패 카드는 맨 아래 ±1.
6. 키보드 열림(C≈283) 도착, 입력 바 높이 변화 직후 첫 로드의 정렬 오차.
7. **회귀: 채팅·회화·역할극 방**에서 긴 답 도착·재진입·위로 올림의 `scrollTop`(바닥)과 알약 글 「새 메시지 ↓」가 이전 빌드와 같음.
8. 실기기(Android WebView·TalkBack): 소수 DPR 에서 `scrollTop` 대입 오차, 접근성 클릭 직후 2초 창(REV-SCROLL-4).

native_change: false. 개발 판정 기준표: Critical 0 · High 0 → PASS 상당, 다만 시험 공백 5건·문서 불일치 2건을 기록하므로 PASS_WITH_NOTES.
