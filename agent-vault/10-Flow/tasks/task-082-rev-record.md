---
task_id: task-082
role: reviewer
tags:
  - type/record
  - domain/vocab
---
# task-082 Reviewer 기록 (REV-082, light 트랙)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 4 (+ Info 1). light 승격 필요 없음(변경 파일 2개, 신규 화면·마이그레이션·네이티브·인증 변경 없음 — `git diff --stat` 로 확인). Sonnet developer 반려 0회.

## 직접 재실행한 증빙 (미러 `~/.node-local/thekaiwa-dev082`, `mirror-audit --check` exposed 0, NFS 원본과 `cmp` 일치)
- `cardFace.test.ts` → 10 pass / 0 fail (개발 보고와 같음)
- `vocab/__tests__/*.test.ts` + `common/__tests__/*.test.ts` → 489 pass / 0 fail (같음)
- `tsc --noEmit -p .` → exit 0, 출력 0줄 · `eslint` 변경 2파일 → exit 0
- 데모 게이트 `check --task` → `DEMO_GATE_PASSED`(not_required, judge none·light 면제). `evidence.jsonl` 에 task-082 줄 없음 → 에이전트가 approve/waive 를 대신 실행한 흔적 없음.
- 독립 변이 1건(미러, 임시 파일 + `mv`, 원복 후 `cmp` 일치·audit exposed 0): 측정 효과 `nextDropLevel(dropLevel, overflowsBody(...))` → `nextDropLevel(dropLevel, false)` → **10/10 그대로 통과**(아래 L-2).

## 영역별 확인 (코드 읽기)
1. **의도 충족 [확실]**: `VocabCardFace.tsx:196` 표제어 한글은 `dropLevel` 조건 없이 `inline` 으로 그려진다. 예문 한글만 `:206` `dropLevel >= 1 ? null`. `DropLevel = 0|1`(`:47`)·`nextDropLevel`(`:51`)·`pickDropLevel`(`:57`)·효과 주석(`:142`)·머리 주석(`:7-8`) 일관, `>= 2`·`level < 2` 잔재 0. 앞면(`:154-178`) diff 0.
2. **다른 소비처 [확실]**: `DropLevel`·`nextDropLevel`·`pickDropLevel`·`overflowsBody` 는 `src` 안에서 `VocabCardFace.tsx` 와 `cardFace.test.ts` 만 쓴다. `VocabDeck.tsx` 는 `backHangul` prop 만 넘긴다(변경 없음). `cardFirst.test.ts:842`·`lesson/__tests__/display.test.ts:55` 는 앞면 `<HangulLine state={hangul} size={15} />`·옛 읽기 키 부재만 본다 → 영향 없음.
4. **금기 [확실]**: 변경 2파일에 엔진명·모델명·`fetch(`·`Capacitor` 0건, 새 사용자 문구 0(컴포넌트 diff 는 클래스·주석뿐), 6층 import 변화 0(테스트가 `common/japanese/annotations` 를 import — 같은 층 이하).
- 7영역 중 API·DB·인증·Secret·LLM·학습 원칙은 이 변경이 닿지 않아 «해당 없음».

## 발견

| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| 1 | Medium | `VocabCardFace.tsx:185-197` | **긴 표제어(+긴 한글)에서 한글이 아래 줄로 내려가면 세로 자리를 쓰고, 더는 빼지 않는다.** 옛 2단계는 이 경우 표제어 한글(≈21.5px)을 되찾아 번역을 지켰지만 이제 되찾을 방법이 없다. 카드가 ≈226px 인 주제 세트·챌린지 화면에서 번역 줄이 잘릴 수 있다. | `[가능성 높음]` 폭 ≈300px 안에서 `ありがとうございます`(22px×10 + 한글 ≈11자×13px + gap 8 > 300)처럼 가나 열 자 이상 표현은 한 줄에 안 들어간다. 측정은 `bodyRef` 자식만 재므로(`:147`) 머리 높이 증가는 «예문 한글 뺌» 으로만 흡수된다. Leader 결정(「긴 표제어는 flex-wrap 으로 내려가며 그때는 공간을 쓴다」)·개발 기록 한계 항목에 이미 적혀 있어 **결함이 아니라 미확인 위험**. 실브라우저 미확인 → `[추측]` 수준의 크기. | Leader 실브라우저에서 긴 가나 표현 카드를 892·780·740·700 에서 확인. 번역이 잘리면 후속으로 머리 한글 `line-clamp-1` 또는 측정에 머리 포함을 검토(이번 task 범위 밖). |
| 2 | Low | `cardFace.test.ts` (효과 연결) | 측정 효과의 연결(`:148`)을 끊어도 시험이 통과한다(독립 변이 → 10/10). 시험은 의존성 배열·`drop.key === measureKey` 글자만 고정한다. | 변이 재현 [확실]. 이번 변경이 만든 공백이 아니라 기존 시험도 같은 수준(회귀 아님). | 후속에서 효과를 순수 함수로 빼거나 `nextDropLevel(dropLevel, overflowsBody(` 글자 단언 추가(선택). |
| 3 | Low | `docs/screens.md:8392` (§15-11-8 QA 6번) | 옛 규칙이 그대로: 「2단계(§15-11-3 B6) … 예문·표제어 `[한글]` 둘 다 빠지고 … 892 에서는 … 표제어 `[한글]` 보임」. `:8297` 의 «task-082 로 대체» 주석은 8298~8304(이력) 블록에만 붙어 있어 QA 체크 문구가 새 규칙과 어긋난다. `:8304` 의 «측정값 열 → 0/1/2»·«2단계일 때 표제어 히라가나 보임» 도 낡음(이력 블록 안이라 허용 가능). | `rg` 로 확인 [확실]. 문서는 읽기만 했다. | Leader 가 8392 를 «표제어 `[한글]` 은 늘 보임» 으로 정정하거나 대체 주석 추가. |
| 4 | Low | `VocabCardFace.tsx:196` + `JapaneseText.tsx:138` | 로딩 중 `inline` `HangulLine` 은 `null`(자리 예약 없음)이다. 옛 블록 줄은 막대 자리(≈18px)가 있었다. 한 줄에 들어가는 보통 표제어는 도착 때 높이 변화 0이지만, 줄이 넘어가는 표제어는 분석 도착 시 머리가 ≈19.5px 늘어 본문이 밀린다(`backHangul.s` 가 측정 키라 재측정은 됨). | 코드 읽기 [확실], 실제 체감은 못 봄. | 브라우저(네트워크 느림)에서 긴 표제어 카드로 확인. |
| 5 | Low | `cardFace.test.ts` SSR 단언 | `!html.includes('한글 발음')` 는 SSR 에서 항상 참(`useDisplayPrefs` 서버 스냅샷 `loaded:false`)이라 새 동작을 검증하지 않는다. «늘 그려진다» 는 소스 정규식(클래스 문자열 고정 — 클래스 순서만 바꿔도 깨지는 취성)으로만 잠겼다. 개발 기록과 시험 제목이 이 한계를 정직하게 적었다. | 시험·개발 기록 대조 [확실]. | 조치 불필요(Leader 실브라우저가 실제 보증). |
| i | Info | 개발 기록 | 편집 전 훅이 «active task 없음» 경고(`activate` 미실행). `check --task` 는 통과. 개발자가 보고했다. | 개발 기록 | Leader 참고. |

## 판단하지 못한 것 (못 봄)
- 실제 렌더: `한글 발음:` 표시, 가로 넘침(360/390/412), 표제어 truncate 실동작, 별 위치.
- `items-baseline` + `truncate`(overflow:hidden) 항목의 baseline 정렬 — 한글이 표제어 글자 baseline 에 앉는지, 44px 상자 아래 가장자리로 내려가 머리가 커지는지. `[추측]`: 표준(CSS Align)상 내용 baseline 을 쓰지만 브라우저별 차이는 확인 못 함.
- TalkBack 읽는 순서(`sr-only` 「한글 발음:」 는 같은 DOM 순서라 이전과 같을 것 `[가능성 높음]`).

## high_risk_areas (Leader 실브라우저 확인용)
1. 짧은 표제어(`来ました` → `[기마시타]`): 표제어 오른쪽에 같은 줄, 892·780·740·700 모두 `한글 발음:` 존재, 가로 넘침 0.
2. 긴 가나 표현(`ありがとうございます`·`よろしくお願いします`): 한글이 아래 줄 왼쪽 정렬로 내려가는지, 표제어 말줄임은 표제어 혼자 폭을 넘을 때만인지, 별(★) 자리 밀림 없는지, **카드 ≈226px(주제 세트+챌린지 안내)에서 번역 줄 잘림 여부(발견 1)**.
3. 머리 줄 높이: 루비 있는 표제어 한 줄(44px 안팎)에서 한글이 baseline 에 맞는지, 옛 화면보다 머리가 커지지 않는지.
4. 분석 도착 전후(느린 네트워크)에 긴 표제어 카드의 본문 밀림(발견 4).
5. 예문 `[한글]` 은 자리 부족일 때만 빠지고 드래그 중 재측정 없음, 앞면 그대로.

native_change: false

## r3 재검토 (REV-082-r3, r2·r3 변경분만 — `VocabCardFace.tsx`·`cardFace.test.ts`)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 2. light 승격 불필요(변경 2파일, 신규 화면·마이그레이션·네이티브·인증 없음). 금기 0(엔진명·`fetch`·`Capacitor`·새 문구 grep 0, 앞면 분기 diff 0).

### 직접 재실행한 증빙 (미러 `~/.node-local/thekaiwa-dev082`, 두 파일 NFS 원본과 `cmp` 일치, `mirror-audit --check` exposed 0)
- `cardFace.test.ts` **14 pass / 0 fail** · `src/components/vocab`+`src/components/common` 시험 **493 pass / 0 fail** · `tsc --noEmit -p .` exit 0 · eslint(변경 2파일) exit 0. 개발 기록 숫자와 일치. 브라우저·dev 서버·빌드·DB·LLM 호출 없음.

### 확인한 것 (코드 읽기)
1. 자식 구성 `[확실]`: 표제어 행(`headRef`)의 자식은 `JaText`(span, 항상 첫째) + `HangulLine inline`(단일 `<span>` 또는 `null` — `JapaneseText.tsx:136-143`: 설정 미로드·끔·`loading`·`ready` 아님·한글 문자열 없음이면 `null`)뿐이다. `kids.length >= 2` 일 때 마지막 = 한글, 한글이 없으면(대기·끔·2단계) `headwordWrapped=false` — 1→2 로 안 가는 것이 맞다(뺄 한글이 없다). `kids[0]` = 표제어. 별(★)은 `headRef` 밖.
2. 단계 전이 `[확실]`: `nextDropLevel` 0→1 넘침만, 1→2 넘침+아래 줄, 2 고정, 하향 없음 → 재측정은 최대 2회, 무한 루프 없음. 키가 바뀌면 `dropLevel` 이 0 으로 돌아가 한글이 다시 들어간 채 재측정(키에 `backHangul.s` 포함 → 분석 대기→도착도 재측정). 의존성 `[measureKey, dropLevel]` 충분(eslint exhaustive-deps 통과). 드래그는 deps 에 없음. 예문 없는 카드·한글 끔은 `wantMeasure` false → 측정 없음(`wantMeasure` 줄 HEAD 와 동일).
3. 소비처 `[확실]`: `rg nextDropLevel|pickDropLevel|hangulOnOwnLine|DropLevel src` → 정의 파일 + 시험뿐. 효과의 호출은 세 인자 명시, 기본값 `true` 에 기대는 호출은 `pickDropLevel`·시험뿐.
4. 시험 `[확실]`: `pickDropLevel`·`nextDropLevel`·`hangulOnOwnLine` 표는 공허하지 않다(예: `(1,true,false)=1`·`[true,true,true]/[true,false,true]→1`·경계 99.5/99.4). 정적 단언은 effect 슬라이스를 못 찾으면 정규식이 **실패**(조용히 통과 안 함).

### 발견
| # | 심각도 | 위치 | 내용 · 근거 | 권고 |
|---|---|---|---|---|
| r3-1 | **Medium** `[가능성 높음]`(실브라우저 못 봄, 규칙상 금지) | `VocabCardFace.tsx:162-164` + `SwipeCardStack.tsx:107-122,179` | 아래 줄 판정이 `getBoundingClientRect()`(변환 반영)의 `top`·`bottom` 비교라 **카드 래퍼가 회전돼 있으면 «아래 줄»을 놓친다**. 줄바꿈된 한글은 표제어 아랫변에 gap 0 으로 붙어 있어(`gap-x-2` 만) 여유가 0.5px 뿐이고, 넓은 표제어 상자와 좁은 한글 상자의 회전 외접 사각형이 겹친다. 시뮬레이션(스크래치패드 `rev082r3-rot.mjs`, 카드 300×250·표제어 250×44·한글 100×20): 회전 0.1° 까지는 true, **±0.2° 부터 false**(인라인은 항상 false). 래퍼는 드래그 중 `rotate(shownX*0.05deg)`(`SwipeCardStack:118`)이고, 위로 밀기(`classifyGesture`: `dy<-UP_MIN` 이면 가로 이동과 무관하게 'up')는 같은 이벤트에서 `setDrag({0,0,inactive})`+`onUp()`(뒷면 뒤집기)이 한 배치라, 뒷면 첫 측정 레이아웃 효과 시점에 래퍼 transform 은 `none` 으로의 0.3s 전환 **시작값(회전 상태)** 이다 — 즉 가로로 ≈4px(0.2°) 이상 흘린 위로 밀기에서 긴 표제어가 줄바꿈돼 넘쳐도 2단계로 못 가 번역·예문이 잘린 채 남는다. 탭·버튼 뒤집기(회전 0)는 정상이라 «밀면 잘리고 누르면 안 잘리는» 재현이 어려운 증상이 된다. r2(넘침만으로 2단계)와 기존 `overflowsBody`(같은 폭 블록끼리 비교라 회전에 둔감)에는 없던 취약성으로 r3 가 새로 들였다. | 판정을 변환에 둔감한 레이아웃 좌표로: `kids[last].offsetTop >= kids[0].offsetTop + kids[0].offsetHeight - 1`(두 항목 `offsetParent` 같음, 정수라 허용 오차 1). 순수 함수 `hangulOnOwnLine` 은 입력만 offset 값으로 바꾸고 시험 유지. 실브라우저 수용 기준 추가: **카드 ≈224px 에서 위로 밀기(가로 8~20px 흘림)로 뒤집어도** 번역 줄이 안 잘림. (Leader 의 313/298/261/224/187px 확인이 탭·직접 상태 경로였다면 이 경로는 미확인.) |
| r3-2 | Low | `cardFace.test.ts` 신규 정적 단언 | 효과 연결(`kids`·`headwordWrapped` 식·세 번째 인자)을 정규식으로 소스 문자열에 고정 — 서식 변경(줄바꿈·헬퍼 추출)에 깨지고, 반대로 DOM 동작(실제 아래 줄 판정·회전 영향)은 못 잡는다(r3-1 이 시험을 통과한 이유). 조용히 통과하지는 않는다. | r3-1 수정 때 offset 입력 순수 함수 시험으로 보강하면 정규식 의존을 줄일 수 있음. 지금은 허용. |
| r3-3 | Low (r1 이전부터, 변화 없음) | `VocabCardFace.tsx:136` | 예문 없는 카드는 `wantMeasure` false 라 긴 표제어 한글이 아래 줄로 내려가도 측정·단계 이동이 없다(본문이 비어 자리가 넉넉하다는 가정, 실화면 미확인). | 조치 불필요, 인지만. |

### 못 봄
- 실제 DOM: 위 r3-1 의 «전환 시작값 = 회전 상태» 가 브라우저에서 그대로인지(CSS Transitions 상 t=0 값이 시작값이라는 추론), baseline 정렬 가정(`items-baseline` + `truncate`)의 브라우저별 차이 — Leader 의 실측(313~224px 한글 2줄, 187px 1줄, 가로 넘침 0)은 이 가정과 모순되지 않음.

native_change: false

## r4 재검토 (REV-082-r4, r4 변경분만 — `VocabCardFace.tsx`·`cardFace.test.ts`)

**판정: PASS** — Critical 0 · High 0 · Medium 0 · Low 1. r3 Medium r3-1(회전 중 `getBoundingClientRect` 외접 사각형이 줄바꿈된 한글을 놓침)은 offset 판정으로 해소됨. light 승격 불필요(src 변경 2파일, 신규 화면·마이그레이션·네이티브·인증 없음).

### 직접 재실행한 증빙 (미러 `~/.node-local/thekaiwa-dev082`, 두 파일 NFS 원본과 `cmp` 일치, `mirror-audit --check` exposed 0)
- `cardFace.test.ts` **14 pass / 0 fail** · `src/components/vocab`+`src/components/common` 시험 **493 pass / 0 fail** · `tsc --noEmit -p .` exit 0 · eslint(변경 2파일) exit 0 — 개발 기록 r4-04 숫자와 일치. 브라우저·dev 서버·빌드·DB·LLM 호출 없음.

### 확인한 것
1. 효과(`VocabCardFace.tsx:160-173`) `[확실]`: `first`=`kids[0]`(표제어 `JaText` span)·`last`=`kids[last]`(한글 `HangulLine inline` 단일 `<span>`, `JapaneseText.tsx:136-143`) 는 자식이 2개 이상일 때만, 아니면 `null` → `instanceof HTMLElement` 가드 실패 = `headwordWrapped=false`(한글 없음 = 뺄 것 없음, r3 와 같은 의미). 두 자식은 같은 flex 컨테이너(`headRef`)의 형제라 `offsetParent` 가 같고, flex 항목은 블록화되므로 인라인 `span` 이어도 `offsetTop`·`offsetHeight` 가 단일 박스 값(줄바꿈 인라인 첫 줄 상자 문제 없음). CSSOM 상 offset 값은 요소·조상 transform 을 무시하므로 래퍼 회전·스케일에 둔감(Leader 실브라우저: 줄바꿈+0.2°/0.5°/1° offset true — r3 결함 재현 후 해소). `row gap` 없음(`gap-x-2` 만)이라 줄바꿈된 한글 윗변 = 표제어 아랫변. 허용 오차 1 = 정수 반올림 오차(윗변·높이 각 ±0.5) 상한을 정확히 덮음(경계 포함 `>=`). 인라인(baseline 정렬)은 한글 윗변이 표제어 박스(≥44px) 안쪽이라 오차 1 로는 오탐 불가. `display:none`(전부 0)이면 `hangulOnOwnLine(0,0)=true` 지만 같은 레이아웃에서 `overflowsBody` 도 false(rect 전부 0)라 `nextDropLevel` 이 level 유지 — 영향 없음(r3 도 동일).
2. 의존성·재측정 `[확실]`: deps `[measureKey, dropLevel]` 불변, `headRef` 는 ref 라 dep 아님, 드래그 값 없음. 같은 레이아웃 상태에서 `getBoundingClientRect`(본문 측정) 뒤 offset 을 읽을 뿐 추가 강제 레이아웃 없음. `overflowsBody`(같은 폭 블록끼리 rect)는 r3 와 동일·범위 밖.
3. 시험 `[확실]`: `hangulOnOwnLine` 경계 표(100/100·100/99 true, 100/98.99·100/98 false, gap·같은 줄·44/44 true·44/12 false)가 `hangulTop >= headwordBottom - 1` 과 전부 일치. 정적 단언은 효과 슬라이스(`useLayoutEffect… if (!measureKey) return` ~ `const shell = `)만 대상, `effect.length > 100` 가드(못 찾으면 실패), 부정 단언 `(?:kids|first|last)\b[^\n;]*getBoundingClientRect` 는 한 줄 단위라 정당한 `getBoundingClientRect`(164행 `bottoms`·171행 `overflowsBody` 호출 — 두 줄 모두 kids/first/last 단어 없음)와 혼동하지 않고 통과. `offsetTop` 2·`offsetHeight` 1 계수·세 번째 인자 연결·`nextDropLevel(` 1회 모두 실제 코드와 일치. 공허 단언 없음(양성 정규식이 판정식 전체를 고정해 부정 단언이 줄바꿈 서식으로 우회돼도 잡힘).
4. 금기 `[확실]`: `git diff -- src` 의 추가·삭제 줄에서 엔진명·`fetch(`·`Capacitor` grep 0, 새 사용자 문구 0(`DISPLAY_COPY.hangulSr` 기존), 앞면 분기 diff 0(변경은 뒷면 표제어 행·판정 함수뿐), src 변경 2파일 외 없음(`docs/screens.md` 5줄 = Leader 의 offset 판정 설명, 이미 반영됨).

### 발견
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| r4-1 | Low | `cardFace.test.ts` 정적 단언 | 부정 단언은 한 줄 단위라 `first\n.getBoundingClientRect()` 같은 줄바꿈 서식은 못 잡는다. 양성 정규식(판정식 전체 고정)이 보완해 실질 위험 낮음. 효과의 실제 DOM 동작은 단위 시험으로 못 돌려 실브라우저(Leader 확인 완료) 몫 — r3-2 와 같은 구조적 한계. | 조치 불필요. |

### 못 봄
- 실제 DOM(브라우저 금지): Leader 의 r4 빌드 실측(offset true/false 표, 313/298/261/224px 한글 2줄·187px 1줄)을 신뢰. r3 의 «위로 밀기 뒤집기 직후 transform 시작값 = 회전» 경로는 offset 이 transform 을 무시하므로 설계상 닫혔으나, 해당 제스처 자체의 실브라우저 재현은 못 봄.

native_change: false · QA 에 넘길 high_risk_areas: 표제어 한글 줄바꿈 + 위로 밀기(가로 흘림) 뒤집기 경로 · 카드 ≈224px 번역·예문 잘림 없음.
