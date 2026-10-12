---
task_id: task-060
title: "task-060 Reviewer 기록 (오늘의 단어 덱 조작 정리, IMP-0031·0032·0033, light 트랙)"
tags:
  - type/task
  - domain/improvement
  - domain/vocab
created: 2026-10-12
---

# task-060 — Reviewer 기록

이력서 본문: [[task-060-improve-deck-controls]] · 개발 기록: [[task-060-dev-record]]

## REV-060-1 — 최종 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 1 · Low 6 · 정보 5) + 프로세스 고지 1건(light 한계 경계)

감사 범위: `src/components/vocab/**`(수정 11 + 신규 2) + `docs/screens.md` §24. 같은 작업 트리의 회화개선 세션 변경(talk/scenario/conversation/infra)은 보지 않음.

### 지금까지 읽고 확인한 것 (코드 직접 읽음)
- 명세 A(제스처 지도)·B(앞면 52px 예약, 버튼 제거, sr-only 대체)·C(도구 줄 [이전][읽기][표시][한글], 키 H/S)·D(확인 시트)·E(힌트 문구)가 `cardFirst.ts`·`deck.ts`·`VocabDeck.tsx`·`DeckToolbar.tsx`·`FlipControls.tsx`·`SkipConfirmSheet.tsx`·`useVocabDeck.ts` 에 구현돼 있음.
- 사용자 지시 위반 없음: 보이는 [뜻 보기]·[객관식]·[건너뛰기] 버튼 없음(sr-only 칩뿐), 오른쪽 밀기는 `rightAction` → 확인 시트(이전 아님), [읽기]는 `ruby` 만·[한글]은 `faceHangul` 만 켬.
- `SwipeCardStack` 변경은 prop 이름(`canGoPrev`→`canSkip`)·`onUp` boolean 반환·bump 조건 3곳뿐. `touchend preventDefault`·`touchAction:none`·`classifyGesture` 임계(`deck.ts` TAP_MAX 10·UP_MIN 80·SIDE_MIN 60) 무변경. `SwipeCardStack` 호출처는 `VocabDeck` 하나뿐.
- `deck.skip()` 호출은 `VocabDeck` 에서 `SkipConfirmSheet.onConfirm` 한 곳뿐(소스 검색 확인). 열림 경로 3개(오른쪽 밀기 `onRight`·S 키 `skipAsk`·sr-only 버튼 `onSkipAsk`)가 모두 `askSkip` 으로 모인다.
- 시험 변경 5건(deck.test.ts 3 + cardFirst.test.ts 2)은 명세가 요구한 기대값 교체이며 단언 약화 아님(diff 대조).
- 서버 문구 근거: `recordAttempt` skipped → `SKIPPED` + `correctText`(task-060 dev-record 인용, 서버 무변경).

### 게이트 대조 (Leader 스냅샷 `~/.node-local/thekaiwa-rev060`, 결과 `/tmp/claude-1000/rev060/result.txt` 직접 읽음)
- `head=b89d779 overlay_files=13`, 스냅샷의 `src/components/vocab` = 작업 트리와 `diff -rq` 동일(확인) → 게이트가 실제 감사 대상 파일을 검증함.
- tsc=0 · eslint=0(경고 5건 전부 `admin/trace/DiagnosticsScreen`·`settings/*` 기존 파일, vocab 0) · test=0(`# tests 3345 / pass 3344 / fail 0 / skipped 1` — skip 은 미러에 `speech/models` 가 없어 생기는 환경 skip) · build=0(`✓ Compiled successfully`, 경고 3건은 기존 `Dynamic filesystem access`).
- 덱 두 시험 직접 재실행: 61/61 (dev-record 와 같음).
- 데모 게이트 `check.mjs check --task task-060-improve-deck-controls.md` → `DEMO_GATE_PASSED` (`not_required`, DM-light-waive), `evidence.jsonl` 에 task-060 줄 0건 = 에이전트가 approve/waive 를 대신 실행한 흔적 없음.

### 변이 재현 9건 (미러에서만 바꾸고 스냅샷으로 복구, `diff -rq` 동일 확인)
잡힘: M1 `rightAction` 이 답한 카드도 'ask' · M8 S 키 `skipAsk` 가 `deck.skip()` 직행(→ `deck.skip()` 호출 1곳 시험) · M9 `faceHangul` 이 다시 `showReading` 에 묶임.
**안 잡힘(시험 공백)**: M2 `skipOpen` 에서 `!answered` 제거 · M3 `askSkip` 에서 `canAskSkip` 가드 제거 · M7 `VocabDeck.onUp` 이 항상 true(처리 못 한 밀기에도 카드가 튐) · **M10 [한글] 버튼이 `toggleReading` 에 배선** · M11 `hangulAvailable` 항상 true · **M12 H 키가 `toggleReading` 호출**. → 아래 M-1·L-2.

### 명세 충족 판정 (사용자 지시 3건 + 설계 A~E)
| 항목 | 판정 | 근거(파일:줄) |
|---|---|---|
| 지시 1 — 위로 밀기 = 뜻 보기, [뜻 보기]·[객관식] 버튼 제거 | 충족 | `cardFirst.ts:179-185` `upAction`, `VocabDeck.tsx:214-219` `onUp`, `FlipControls.tsx:55-84` 앞면은 안내 `<p aria-hidden>` + sr-only 칩 2개뿐(보이는 버튼 0) |
| 지시 2 — [읽기]에서 [한글] 분리, [건너뛰기] 자리에 [한글] | 충족 | `DeckToolbar.tsx:101-118` 4칸 `[이전][읽기][표시][한글]`, `VocabDeck.tsx:81` `faceHangul = (deck.showHangul && …)`, `VocabCardFace.tsx:171` 한글 줄은 `showReading` 과 무관. 독립성은 `JaText` 가 `ruby` 가 주어지면(`null` 포함) `state` 로 루비를 만들지 않는 것으로 확인(`JapaneseText.tsx:70`) |
| 지시 3 — 오른쪽 밀기 → 안내 → 확인하면 건너뛰기 | 충족 | 열림 경로 3개(`onRight`→`askSkip` `VocabDeck.tsx:222-226` · S 키 `:174-176` · sr-only 칩 `DeckToolbar.tsx:118`) 모두 `askSkip` 으로 모여 `setSkipFor` 만 한다. `deck.skip()` 호출은 `:345-348` 시트 확정 한 곳(소스 검색 + 변이 M8 로 확인). 오른쪽 밀기는 이전으로 가지 않는다(`rightAction` 이 답한·지난 카드에 [이전] 안내만) |
| A 지도 / B 52px 예약 / C 도구 줄·키 H·S / D 시트 / E 힌트 | 충족 | 아래 영역별 확인. 설계와 다른 곳은 dev-record 「설계-코드 차이」 8건 — 전부 받아들일 만함(앞면 슬롯 `h-[52px]` 고정+`line-clamp-2`, ↑ 키 해제, 옛 4지선다 위로 밀기 = 「먼저 답을 골라」 안내 등) |

### 영역별 확인 결과
- **로직 경계(감사 관점 2)**: `upAction`(저장·넘김 중·답한·지난·뜻 없음·이미 뒤집음·옛 4지선다 순서), `canAskSkip`/`rightAction`(저장 중 무반응, 답한·지난 카드 [이전] 안내), 보기 열림에서 ↑ → `deck.flip` 이 `open:false` 로 닫고 뒤집음(`useVocabDeck.ts:431-436`), 마지막·첫 카드는 건너뛰기에 영향 없음. 시트 확정 `setSkipFor(null)` 뒤 `deck.skip()` → `answerGuard`(`pending`·`exiting`·`view≠frontier`) 가 한 번 더 막고, 확정 버튼은 첫 클릭 직후 시트가 언마운트되어 이중 호출 경로 없음. `skipFor` 는 카드 `order` 라 카드가 바뀌거나 답이 들어오면 파생 `skipOpen` 이 false(`VocabDeck.tsx:88`). `askSkip` 은 매 렌더 새로 걸리는 키 핸들러(`:115-181`, 의존 배열 없음)와 함께 최신 상태를 본다 — stale closure 없음. [한글] 저장값: `useStoredString`/`useSyncExternalStore` 의 서버 스냅샷 null 이 쓰기를 일으키지 않고 쓰기는 사용자 토글(`toggleReading`/`toggleHangul`)에서만 → 하이드레이션 덮어쓰기 위험 없음.
- **제스처 영역(3)**: `SwipeCardStack` 변경 3곳(prop 이름·`onUp` boolean·bump 조건). `touchend preventDefault`·`touchAction:'none'`·`classifyGesture` 임계(TAP 10·UP 80·SIDE 60) 무변경(`git diff` 확인). 새 sr-only 버튼 3개는 모두 `FlipControls`/`DeckToolbar` 안 = 제스처 영역 밖. `SwipeCardStack` 호출처는 `VocabDeck` 하나뿐이라 `onUp` 시그니처 변경이 다른 곳을 깨지 않는다.
- **접근성(4)**: 대체 경로는 실제 `<button>`; Tab 으로 닿을 때만 칩(`:focus-visible`) — 빌드 CSS 에서 `focus-visible:inset-0/m-auto/h-8/w-fit/overflow-visible/[clip-path:none]` 와 `group-has-[:focus-visible]/slot:invisible` 규칙 생성 확인(`.next/static/chunks/*.css`), 구체성 (0,2,0) > `.sr-only` (0,1,0). 자동 초점은 `firstRef`(뒷면 [알았어요]·보기 첫 항목)/`nextRef` 뿐이라 보이지 않는 버튼으로 가지 않는다. 시트: 공용 `Sheet`(`role=dialog aria-modal`, Esc·바깥 탭·✕), 첫 초점 [취소](`SkipConfirmSheet.tsx:29-33`, `Sheet` 의 제목 초점 뒤에 도는 `setTimeout 0`), 두 버튼 `aria-describedby`. [한글] 막힘은 `aria-disabled` + 누르면 한 줄(`useVocabDeck.ts:490-497`). 터치 크기: 도구 줄·앞면 슬롯 52px, 시트 버튼 48px.
- **높이·폭(5)**: 앞면 슬롯 `h-[52px]`(`FlipControls.tsx:57`) = 뒷면 버튼 `h-[52px]` = 답한 카드 `min-h-[52px]` → 뒤집어도 첫 줄 높이 불변; 무대 `min-h-[224px]`(`VocabDeck.tsx:260`) 유지. `grid-cols-4 gap-2` 360 폭 칸 76px, `TOOL` 에 `min-w-0`, 라벨 12px 3자("표시됨") 36px 로 안 넘침. 도구 줄 `relative` 래퍼는 클래스가 `relative` 뿐(시험이 잠금) — 높이·여백 영향 없음. (브라우저 실측은 하지 않음 — 아래 NOT_VERIFIED)
- **시험 품질(6)**: 기존 시험 수정 5건은 명세가 요구한 기대값 교체이고 단언 약화 없음(diff 대조 완료). 새 소스 구조 시험은 모두 `readCode`(주석 제거본) 사용, 주석 처리 코드로 통과하는 약한 정규식은 못 찾음. 변이 결과는 위 「변이 재현 9건」.
- **규칙·경계(7)**: 엔진명·model_id 문자열 0(vocab 전체 grep), URL·Secret·`fetch`·`localStorage` 직접 접근 0, 보이지 않는 유니코드 0(U+200B~F·202A~E·2060~4·FEFF·00AD 검색), 서버·API·스키마·네이티브 변경 0, `components/vocab` 새 import 는 `components/common/{Sheet,ui}` 뿐(6층 방향 위반 없음). 서버 문구 근거 확인: `recordAttempt`(`sessions.ts:717-741`) skip → `SKIPPED`, 같은 `order` 재전송은 첫 결과 그대로 → 시트 문구는 사실.

### 지적 사항
**Medium**
- **M-1 핵심 배선을 지키는 시험이 없다** (`VocabDeck.tsx:171-173`·`:322`·`:88-92`·`:214-219`, `useVocabDeck.ts:490-497`). 위 변이 M10([한글] 버튼을 `deck.toggleReading` 에 배선)·M11(`hangulAvailable` 상시 true)·M12(H 키가 `toggleReading` 호출)·M2(`skipOpen` 의 `!answered` 제거)·M3(`askSkip` 가드 제거)·M7(`onUp` 이 항상 true)을 61개 시험이 하나도 못 잡는다. 사용자 지시 2의 핵심("[읽기]와 [한글]을 분리")과 설계 D("카드가 바뀌거나 답이 들어오면 닫힘")가 순수 함수 밖 컴포넌트 식에 있어서다. 코드는 지금 맞다 — 고장이 날 때 잡을 그물이 없다는 뜻. **권고**: ① `skipSheetOpen({skipFor, order, answered, phase})` 를 `cardFirst.ts` 순수 함수로 빼고 단위 시험 ② `VocabDeck` 소스 구조 시험에 `onHangul={() => deck.toggleHangul(hangulBlocked)}`·`case 'hangul':\s*deck.toggleHangul(hangulBlocked)`·`hangulAvailable={!hangulBlocked}`·`return r.kind === 'flip'` 4줄 단언 추가(주석 제거본). 배포를 막지 않음 — 다음 task 에서 해도 된다.

**Low**
- **L-1 터치 고정 힌트가 카드 상태와 무관** (`cardFirst.ts:234`, `KEY_HINT.touch`): 답한·지난 카드·뒤집은 뒷면에서도 「↑ 밀어 뜻 보기 · → 밀어 건너뛰기」가 떠 있는데 그때 ↑ 는 무반응, → 는 「이전 카드는 아래 [이전] 버튼으로 가요」 안내다. 옛 힌트(→ 이전·↑ 표시)는 어느 카드에서나 맞았지만 새 힌트는 안 맞는 상태가 늘었다. 설계 E 가 한 문구로 못 박아 구현 결함은 아님 — designer/Leader 가 상태별 터치 힌트(`fixedHint` 의 coarse 갈래)를 원하는지 판단.
- **L-2 `askSkip` 이 끝내기 확인 시트(`endOpen`)를 보지 않는다** (`VocabDeck.tsx:89-92`): 키는 `sheetOpen` 으로 막히지만 화면 읽기가 모달 뒤의 sr-only [건너뛰기]에 닿으면 두 시트가 겹칠 수 있다. `Sheet` 는 배경을 `inert` 로 만들지 않는다. 가드 한 줄(`endOpen` 이면 return)이면 된다.
- **L-3 `skipFor` 가 닫힐 때 비워지지 않는다** (`VocabDeck.tsx:88`): 파생 `skipOpen` 이 `phase` 가 잠깐 `finishing` 이었다가 `playing` 으로 돌아오면(끝내기 실패) 같은 미답 카드의 시트가 다시 열릴 수 있다. 모달 때문에 실제로는 도달하기 어렵다(끝내기 버튼이 시트 뒤). 효과로 파생 false 일 때 `setSkipFor(null)`, 또는 L-2 와 함께 정리.
- **L-4 sr-only 칩이 잠겨 있을 때 무반응** (`DeckToolbar.tsx:118`, `FlipControls.tsx:61-83`): `aria-disabled` 인데 누르면 아무 안내가 없다(보이는 버튼의 「눌러도 반응 없는 버튼 금지」 규약은 보이는 도구 줄 대상이라 규약 위반은 아님). 저장 중에만 생기는 짧은 구간.
- **L-5 문서 정합** (`docs/screens.md`): §24 서두가 「§5-2 B·C 와 §23 일부를 대체」라 하지만 포인터(⚠)는 §23 서두(10091) 한 곳뿐이다. 옛 서술이 그대로인 줄 — §5-0 5번(1310 「위로 −80px = 표시 토글 … 오른쪽 60px = 이전 카드」) · §5-2 C 표(1628 「오른쪽 → 이전」, 1646 「`F`·`↑` 표시 토글」) · 컴포넌트 표(1802 `canPrev`) · 체크리스트(1924 「위로 80px = 표시 토글 … 오른쪽 = 이전」) · §23 D0 행(10117, ⚠로 덮였음). 각 줄에 「→ §24 로 대체」 한 줄씩. §24 본문은 코드와 일치(문구·키·저장 키·지도·`skipFor` 닫힘 규칙 대조 완료). 같은 파일의 나머지 hunk(3859~10058 부근 task-061/056)는 다른 세션 것이니 커밋 때 hunk 단위로 나눌 것.
- **L-6 새 카드로 넘어간 뒤 키보드 초점이 `body` 로 떨어진다** (dev-record 「남은 의문 2·3」과 같은 건): 앞면 안내 자리에 자동 초점 대상이 없어 [다음 카드]가 사라지면 초점이 body 로 간다. 화면 읽기는 `announce` 라이브 영역이 「N번째 카드」를 읽어 주고 키 단축키는 document 리스너라 계속 동작하므로 영향은 작다. 접근성 개선 후보: 새 카드에서 카드 그룹(`role=group`)에 `tabIndex=-1` 초점.

**정보 (사용자에게 알릴 것)**
1. 오른쪽 밀기가 이전 카드가 아니다 → 이전 카드로 가는 길은 [이전] 버튼과 ← 키뿐(사용자 지시의 결과, 답한·지난 카드에서 밀면 안내가 뜸).
2. 위로 밀기가 뜻 보기이고 다시 볼 카드 표시(★)는 [표시] 버튼·F 키로만 남는다. ↑ 키는 동작 없음.
3. 사용자는 [뜻 보기]·[객관식] 버튼 「제거」를 요청했고 눈에 보이는 버튼은 없지만, 화면 읽기·키보드용 보이지 않는 실제 버튼 3개가 남는다(Tab 으로 닿을 때만 칩으로 보임). Leader 권고안으로 사용자가 승인한 항목이지만 배포 안내에 한 번 적을 것(원치 않으면 지운다).
4. 건너뛰기를 시트에서 확정하면 푼 것으로 세지 않는다(서버·챌린지 규칙: 건너뜀은 공부로 세지 않음 — `sessions.ts` `vocabRepetitionInputs` 주석, `challenge/logic.ts`). 시트 문구는 「건너뜀으로 기록하고 뜻을 보여 드려요」까지만 말한다 — 챌린지 하루 합계에 영향이 있는 점을 시트에 한 줄 넣을지는 designer 판단.
5. [읽기] 는 이제 히라가나만. 처음 열면 [한글]은 [읽기]의 저장값을 이어받아 화면이 바뀌지 않고, [읽기]를 누르는 순간 한글 값이 따로 굳는다.

### 프로세스 고지 — light 한계 경계
- 이 task 의 변경 파일: 소스 11(수정 9 + 신규 `SkipConfirmSheet.tsx`·`srChip.ts`) + 시험 2 = **13개**(dev-record 1차가 「소스 10 + 시험 2 = 12」로 세었고, 수정 라운드의 `srChip.ts` 신규로 13). 시험을 포함해 세면 light 한계(12개 이하)를 1개 넘고, 시험 제외로 세면 11개로 안이다. 신규 화면·마이그레이션·네이티브·인증·Secret 변경은 없다.
- 규칙대로 FAIL 이 아니라 **「light 승격 필요 여부」를 Leader 가 판단**하길 요청한다. 감사자 의견: 사용자가 「검토 후에 배포여부 피드백」이라고 했고 제스처 감각은 어차피 실기기에서만 확인되지만, 이번 감사도 브라우저 실측(360/390/412 높이 불변, 시트 초점)은 하지 못했다. 승격하면 QA 가 그 구간을 실제로 채운다. 승격하지 않는다면 배포 전 사용자 폰 확인을 NOT_VERIFIED 로 명시.

### 하지 않은 것·NOT_VERIFIED
- 브라우저 렌더/실기기 확인 없음(개발 서버 금지 지시) — 52px 슬롯 높이 불변, 360 폭 말줄임, 칩이 [읽기]·[표시] 칸 가운데를 덮는 모습(dev-record 가 정적 픽스처로 측정해 알림), 위 80px·옆 60px 문턱 감각, TalkBack 초점 이동.
- 20-Log 일일 로그에 `→ [[task-060-improve-deck-controls]]` 한 줄은 쓰지 않았다(같은 파일을 다른 세션이 수정 중이라 Leader 몫으로 둠).

### 판정
**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1(M-1 시험 공백) · Low 6(L-1~L-6) · 정보 5. 수정 후 재순환이 필요한 결함은 없다. 다만 light 한계 경계(13개)는 Leader 가 승격 여부를 정해야 한다. 마지막 Developer 수정이 없으면 Reviewer 재감사는 필요 없고, M-1 을 지금 고친다면 시험 파일만 바뀌므로 Reviewer 는 diff 만 재확인.
