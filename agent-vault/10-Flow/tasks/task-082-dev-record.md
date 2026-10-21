---
task_id: task-082
role: developer
tags:
  - type/record
  - domain/vocab
---
# task-082 Developer 기록 (light 트랙)

- [진행] 데모 게이트 `check.mjs check --task task-082` → `DEMO_GATE_PASSED` / status not_required(판정 none, light 면제). 단, 편집 전 훅이 «active task 없음» 경고를 냈다(`activate` 미실행) — 게이트 자체는 통과라 진행, Leader 에게 보고 항목으로 남긴다.
- [진행] 미러 `dev082` 생성(`make-mirror.sh dev082` → MIRROR_OK).
- [진행] `VocabCardFace.tsx` 수정 완료: 표제어 `JaText` + `<HangulLine … inline />` 을 `flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2` 한 줄에, 표제어 `max-w-full truncate`, `DropLevel` 0|1, `nextDropLevel`/`pickDropLevel`/측정 효과 주석·머리 주석 정리.
- [진행] `cardFace.test.ts` 기대값 교체 + 표제어 인라인 소스·SSR 렌더 단언 2건 추가.
- [완료] 실행 증빙(미러 `~/.node-local/thekaiwa-dev082`, `sync-local.sh` 로 채움):
  - `node --import tsx --test --test-concurrency=1 src/components/vocab/__tests__/cardFace.test.ts` → 10 pass / 0 fail(전 9 → 10: 새 단언 2건 추가, 단계 규칙 3건 교체).
  - `src/components/vocab/__tests__/*.test.ts` + `src/components/common/__tests__/*.test.ts` → **489 pass / 0 fail**.
  - `tsc --noEmit -p .` → exit 0(출력 0). `eslint`(VocabCardFace.tsx·cardFace.test.ts) → exit 0.
  - 변이 6종(임시 파일 + `mv`, 매번 원복 후 NFS 원본과 `cmp` 일치): M1 표제어 한글을 `dropLevel` 로 다시 가림 → 5번 실패 · M2 `nextDropLevel` 2단계 부활 → 3·4번 실패 · M3 표제어 `max-w-full` 제거 → 5·6번 실패 · M4 래퍼 `flex-wrap` 제거 → 5·6번 실패 · M5 `inline` 속성 제거 → 5번 실패 · M6 예문 `[한글]` 뺌 단계 제거 → 4번 실패. 전부 잡힘.

## 변경 파일 (2개 + 이 기록)
- `src/components/vocab/VocabCardFace.tsx`: ① 뒷면 표제어 블록 `div.min-w-0.flex-1` → `div.flex.min-w-0.flex-1.flex-wrap.items-baseline.gap-x-2`, `JaText` 에 `max-w-full`(truncate 유지), `<HangulLine state={backHangul} size={13} inline />` 을 `dropLevel` 조건 없이 그림 ② `DropLevel` `0|1`, `nextDropLevel`(`overflow && level < 1 ? 1 : level`)·`pickDropLevel`(`while (level < 1)`)·효과 주석·머리 주석 정리. 앞면·props·측정 키·효과 의존성 `[measureKey, dropLevel]` 은 그대로.
- `src/components/vocab/__tests__/cardFace.test.ts`: 단계 규칙 기대값 교체, 정적 경계(2단계·`dropLevel >= 2` 부재), 표제어 인라인 소스 단언, SSR 렌더 단언(래퍼·truncate·로드 전 한글 줄 없음).

## 결정과 근거
- 시험으로 «한글이 실제로 그려진다» 는 SSR 로 잡을 수 없다: `useDisplayPrefs` 서버 스냅샷이 `loaded:false` 라 `HangulLine` 이 null 을 돌려준다(깜박임 방지 설계). 그래서 소스 단언(`inline`·`dropLevel` 부재) + SSR 구조 단언(래퍼·truncate) 으로 잠갔다. 실제 «한글 발음:» 표시·가로 넘침 0 은 Leader 실브라우저 확인 몫(완료 기준 3번).
- `HangulLine inline` 은 `loading` 상태에서 null(자리 예약 없음)이라 분석이 도착하면 표제어 오른쪽에 줄이 생긴다 — 표제어 줄 높이는 변하지 않고, 긴 표제어가 `flex-wrap` 으로 내려갈 때만 높이가 변한다. 예문 한글 측정은 `backHangul.s` 가 측정 키에 이미 들어 있어 분석 도착 때 다시 잰다(그대로).

## 남은 한계 / reviewer 가 볼 곳
- 표제어가 길어 한글이 아래 줄로 내려가면 그때는 세로 자리를 쓴다 — 그래도 `dropLevel` 로 빼지 않으므로 카드가 아주 낮으면 본문(뜻)이 먼저 `line-clamp`/`overflow-hidden` 으로 잘릴 수 있다(Leader 결정 «번역 우선» 은 예문 한글만 해당).
- `docs/screens.md` §15-11-3 B6(약 8297~8303행)이 옛 «2단계(표제어 `[한글]` 도 뺌)» 규칙을 그대로 적고 있다 — 문서는 Leader 몫이라 건드리지 않았다.
- 훅 경고: 편집 전 `[데모 검토 게이트]` 훅이 «active task 없음»(`check.mjs activate` 미실행)을 냈다. `check --task` 자체는 `DEMO_GATE_PASSED`(not_required, light 면제).
- 미커밋 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts` · 이 기록(`task-082-dev-record.md`). 커밋·푸시·배포·브라우저·DB·LLM 호출 없음, 띄운 프로세스 없음(tsc 는 끝남).

## r2 (Leader 결정 — 표제어 한글 인라인 유지 + 2단계 «최후 수단» 복원)
- [23:45] 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED`(not_required, light 면제). 편집 전 백업: 스크래치패드 `dev-082-r2/`.
- [23:46] `VocabCardFace.tsx`: `DropLevel` `0|1|2`·`nextDropLevel`·`pickDropLevel`·효과 주석을 HEAD 와 동일하게 복원(diff 0), 표제어 `<HangulLine … inline />` 은 인라인 위치 유지 + `dropLevel >= 2 ? null :` 로 가림, 머리 주석(4~9행) 새 의미로 정정.
- [23:48] `cardFace.test.ts`: 단계 기대값 원래 3단계로, 정적 경계(예문 `>= 1`·`DropLevel = 0|1|2`·효과 의존성)와 표제어 단언(inline + `dropLevel >= 2 ? null` 한 줄, 1단계 가림 금지)으로 교체, 항상 참이던 `!html.includes('한글 발음')` 삭제(SSR 은 prefs.loaded=false 라 한글 줄을 못 봄 — 구조 단언만 남김).
- [23:55] 실행 증빙(미러 `~/.node-local/thekaiwa-dev082`, `sync-local.sh` 로 NFS 와 맞춘 뒤 `cmp` 동일 확인, `mirror-audit --check` exit 0):
  - `cardFace.test.ts` → 10 pass / 0 fail. `src/components/vocab/__tests__/*.test.ts` + `src/components/common/__tests__/*.test.ts` → **489 pass / 0 fail**.
  - `tsc --noEmit -p .` → exit 0(출력 0). `eslint`(VocabCardFace.tsx·cardFace.test.ts) → exit 0.
  - 변이 5종(미러에서 임시 파일 + `os.replace`, 끝에 원복 후 NFS 원본과 일치 확인): M1 표제어 한글 가림 조건 제거 → 5번 실패 · M2 `inline` 제거 → 5번 실패 · M3 `nextDropLevel` 상한 2→1 → 2·3번 실패 · M4 표제어 한글을 1단계에서 가림 → 5번 실패 · M5 예문 한글 가림 단계 1→2 → 4번 실패. 전부 잡힘.

### r2 변경 요약
- `VocabCardFace.tsx`(r1 대비 증분): `DropLevel` `0|1|2`·`nextDropLevel`(상한 2)·`pickDropLevel`(`while level < 2`)·효과 주석 `0 → 1 → 2` 는 **HEAD 와 동일(diff 0)**. 표제어 `<HangulLine … inline />` 은 인라인 위치 유지, `dropLevel >= 2 ? null :` 로 가림. 머리 주석(4~9행): 예문 한글 먼저·표제어 한글은 인라인이라 최후 수단으로만(r2). r1 의 `flex-wrap items-baseline gap-x-2`·`max-w-full truncate` 레이아웃은 그대로.
- `cardFace.test.ts`(r1 대비 증분): 단계 기대값 원래 3단계로 복원(`[false,true,true]→0` 한 줄 추가: 짧은 표제어는 2단계에 못 감), 정적 경계 단언 `DropLevel = 0|1|2`·예문 `>= 1`, 표제어 단언 = inline + `dropLevel >= 2 ? null` 한 줄·1단계 가림 금지·옛 세로 블록 부재, 항상 참이던 SSR `!html.includes('한글 발음')` 삭제(SSR 서버 스냅샷은 `prefs.loaded=false` 라 한글 줄을 못 봄 — 래퍼·truncate 구조 단언만 유지).

### r2 한계 / reviewer 가 볼 곳
- **이전보다 나빠지는 경우 없음 — 추론이지 실측 아님**: 짧은 표제어는 한글이 같은 줄이라 본문(`bodyRef`) 높이를 못 줄여 1단계 측정에서 안 넘치면 2단계에 안 간다. 긴 표제어(한글이 아래 줄)에서 1단계 뒤에도 넘칠 때만 2단계가 되어 한글을 뺀다(옛 «번역 우선» 규칙과 같은 결과). 브라우저로는 확인하지 않았다(금지 사항) — 실화면 확인은 Leader.
- 측정은 `card.example` 이 있고 한글 표시가 켜진 뒷면에서만 돈다(`wantMeasure`) — **예문이 없는 카드에서 긴 표제어 한글이 아래 줄로 내려가도 측정이 없어 2단계로 못 간다**(r1 이전부터 있던 동작. 예문 없는 카드는 본문이 비어 자리가 넉넉하다고 보지만 실화면으로 확인하지 않음).
- 시험의 «측정 효과 연결 끊어도 통과(기존 공백)» 는 그대로다(reviewer Low ① 은 범위 밖).
- 미커밋 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts` · 이 기록. 커밋·푸시·배포·브라우저·dev 서버·DB·LLM 호출 없음, 띄운 프로세스 없음(tsc/시험은 끝남).

### 체크포인트 (r2)
- 완료: 위 변경 2파일 + 실행 증빙 + 기록. 남은 일: reviewer 재감사(좁게 — 단계 규칙·표제어 단언)와 Leader 실브라우저 확인(892·780·740·700 에서 «한글 발음:» 표제어 줄 존재·가로 넘침 0, 긴 가나 표제어가 좁은 카드에서 2단계로 한글을 빼고 번역이 안 잘리는지). 다음 첫 행동: Leader 가 `docs/screens.md` §15-11-3 B6 을 r2 의미로 고침. 주의점: 스크래치패드 `dev-082-r2/` 에 r2 직전 백업(`cardFace.test.ts.pre-r2`)·변이 스크립트가 있음(삭제 불필요).

## r3 (Leader 결정 — 2단계는 «표제어 한글이 아래 줄로 내려가 자기 줄을 차지할 때만»)
- [r3-01] 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED`(not_required, light 면제). 편집 전 백업: 스크래치패드 `dev-082-r3/`(`*.pre-r3`).
- [r3-02] `VocabCardFace.tsx`: `hangulOnOwnLine(headwordBottom, hangulTop)` 순수 판정 신설, `nextDropLevel(level, overflow, headwordWrapped = true)`(0→1 넘침만 / 1→2 넘침+아래 줄 / 상한 2 / 내리지 않음), `pickDropLevel(overflowAt, wrappedAt = [])`(생략 = 아래 줄), 표제어 행 `ref={headRef}`, 측정 효과가 `[표제어, 한글]` 자식 둘이 다 있을 때만 `hangulOnOwnLine` 을 읽어 세 번째 인자로 넘김. 머리 주석 정정. (훅 경고 «active task 없음»은 r2 와 같음 — check 는 PASSED/not_required.)
- [r3-03] `cardFace.test.ts`: `pickDropLevel` r3 시험(wrappedAt 7건)·`nextDropLevel` 세 번째 인자 시험(8건)·`hangulOnOwnLine` 경계 시험·정적 «아래 줄 판정 → 2단계» 연결 단언(효과 안 `kids`/`headwordWrapped`/세 번째 인자/호출 한 곳)·표제어 행 정규식에 `ref={headRef}` 반영, 단계 올라가기만 하는 시험은 `headwordWrapped` true/false 양쪽으로 확장.
- [r3-04] 실행 증빙(미러 `~/.node-local/thekaiwa-dev082`, `sync-local.sh` 후 `cmp` 동일·`mirror-audit --check` exit 0): `cardFace.test.ts` 14 pass / 0 fail · `src/components/vocab`+`src/components/common` 시험 **493 pass / 0 fail** · `tsc --noEmit -p .` exit 0 · `eslint`(변경 2파일) exit 0.
- [r3-05] 변이 6종(미러에서 임시 파일 + `os.replace`, 끝에 원복 후 NFS 원본과 `cmp` 동일 확인 — 스크립트 `dev-082-r3/mutate.py`), 전부 잡힘: M1 효과 세 번째 인자 항상 `true` → 8번 실패 · M2 `hangulOnOwnLine` 항상 `true` → 6번 실패 · M3 1→2 조건에서 `headwordWrapped` 제거 → 3·5번 실패 · M4 0→1 이 `headwordWrapped` 에 의존 → 3·5번 실패 · M5 효과의 `headwordWrapped` 식을 항상 `true` → 8번 실패 · M6 `pickDropLevel` `wrappedAt` 생략 기본값 `false` → 2·3번 실패.

### r3 변경 요약
- `VocabCardFace.tsx`(r2 대비 증분): ① `hangulOnOwnLine(headwordBottom, hangulTop) = hangulTop >= headwordBottom - 0.5` 순수 함수 신설·export. ② `nextDropLevel(level, overflow, headwordWrapped = true)` — 0→1 은 `overflow` 만, 1→2 는 `overflow && headwordWrapped`, 상한 2, 내리지 않음. ③ `pickDropLevel(overflowAt, wrappedAt = [])` — 같은 규칙, 생략 = `true`(r2 시험 의미 보존). ④ 표제어 행(`flex … flex-wrap` 컨테이너)에 `ref={headRef}`. ⑤ 측정 효과: `kids = headRef.current?.children`, 자식이 `[표제어, 한글]` 둘일 때만 `hangulOnOwnLine(kids[0].bottom, kids[last].top)` 을 읽어(한글 없음 = 대기·끔·2단계 → `false`) `nextDropLevel` 세 번째 인자로 전달. 의존성 `[measureKey, dropLevel]`·키 변경 시 0단계 재측정·드래그 중 측정 0 은 그대로. ⑥ 머리·타입 주석을 r3 의미로 정정.
- `cardFace.test.ts`(r2 대비 증분): 10 → 14 개. `pickDropLevel` r3(wrappedAt)·`nextDropLevel` 세 번째 인자 표(`(1,true,false)=1`·`(1,true,true)=2`·`(1,false,true)=1`·`(0,true,false)=1` 포함)·`hangulOnOwnLine` 경계(0.5px)·정적 연결 단언(효과 안 `headwordWrapped` 식·세 번째 인자·`nextDropLevel` 호출 한 곳)·표제어 행 정규식에 `ref={headRef}`.

### r3 한계 / reviewer 가 볼 곳
- **브라우저 미확인**(금지 사항) — Leader 실브라우저 수용 기준: 같은 세션 700px(카드 약 187px)에서 표제어 한글 줄 ≥ 1. 추론: 표제어가 `max-w-full truncate` 라 한 줄을 다 채우면 한글이 아래로 내려가 `top >= bottom` 이 되고, 같은 줄이면 `items-baseline` 정렬이라 한글 윗변이 표제어 아랫변보다 위라 `false` — 이 baseline 가정은 시험으로 못 잡는다(실화면 몫).
- 아래 줄 판정은 1단계 그림에서 읽는다(1→2 결정 시점). 0→1 사이에 표제어 행 폭·내용이 바뀌지 않아 0단계 때와 같다.
- `wantMeasure`(예문 있음·한글 켬·뒷면)에서만 도는 것은 r1 이전과 같다 — 예문 없는 카드는 측정 자체가 없다.
- 실제 DOM 효과(측정 → 단계 전이)는 단위 시험으로 못 돌린다 — 정적 단언(효과 안 `headwordWrapped` 식·세 번째 인자)으로 연결만 고정, 동작은 실브라우저 몫.
- `docs/screens.md` §15-11-3 B6 은 Leader 몫(r3 의미: 2단계 = 1단계 뒤에도 넘치고 표제어 한글이 아래 줄일 때만).
- 미커밋 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts` · 이 기록. 커밋·푸시·배포·브라우저·dev 서버·DB·LLM 호출 없음, 띄운 프로세스 없음.

### 체크포인트 (r3)
- 완료: 위 변경 2파일 + 실행 증빙 + 변이 6종 + 기록. 남은 일: reviewer 좁은 재감사(효과의 아래 줄 판정·세 번째 인자 연결)와 Leader 실브라우저(700px 에서 한글 ≥ 1, 긴 가나 표제어 좁은 카드에서는 2단계로 한글을 빼고 번역이 안 잘리는지). 다음 첫 행동: Leader 가 `docs/screens.md` §15-11-3 B6 을 r3 의미로 고침. 주의점: 스크래치패드 `dev-082-r3/` 에 r3 직전 백업(`*.pre-r3`)·변이 스크립트가 있음(삭제 불필요).

## r4 (Leader 결정 — 아래 줄 판정을 변환에 둔감한 offset 좌표로, r3 재검토 Medium r3-1)
- [r4-01] 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED`(not_required, light 면제). 편집 전 백업: 스크래치패드 `dev-082-r4/`(`*.pre-r4`). 편집 훅의 «active task 없음» 경고는 r2·r3 와 같음.
- [r4-02] `VocabCardFace.tsx`: 측정 효과가 `first`/`last`(자식이 둘 이상일 때만 `kids[0]`·`kids[last]`, 아니면 `null`)를 `instanceof HTMLElement` 로 가드한 뒤 `hangulOnOwnLine(first.offsetTop + first.offsetHeight, last.offsetTop)` 로 판정(가드 실패 = `headwordWrapped=false`). `hangulOnOwnLine` 은 이름·위치 유지, 입력 의미를 «표제어 아랫변 offset·한글 윗변 offset» 으로 바꾸고 허용 오차 `- 0.5` → `- 1`, 주석에 «회전 중 `getBoundingClientRect` 는 외접 사각형이 겹쳐 놓친다(task-082 r4)» 명시. `overflowsBody`(본문·자식 bottom, 같은 폭 블록끼리)는 범위 밖이라 그대로.
- [r4-03] `cardFace.test.ts`: `hangulOnOwnLine` 경계 표를 허용 오차 1 로 교체(100/100·100/99 true, 100/98.99·100/98 false, gap·같은 줄·offset 44/44 true·44/12 false), 정적 연결 단언을 offset 판정(`first`/`last` 식·`offsetTop` 2회·`offsetHeight` 1회)으로 갱신하고 효과 슬라이스 길이 가드·«아래 줄 판정(kids/first/last)에 `getBoundingClientRect` 없음» 단언 추가. 시험 개수는 그대로 14(단언만 늘어남).
- [r4-04] 실행 증빙(미러 `~/.node-local/thekaiwa-dev082`, `sync-local.sh` 후 두 파일 NFS 원본과 `cmp` 동일·`mirror-audit --check` exit 0 exposed 0): `cardFace.test.ts` 14 pass / 0 fail · `src/components/vocab`+`src/components/common` 시험 **493 pass / 0 fail** · `tsc --noEmit -p .` exit 0 · `eslint`(변경 2파일) exit 0.
- [r4-05] 변이 6종(미러에서 임시 파일 + `os.replace`, 끝에 원복 후 NFS 원본과 `cmp` 동일 — 스크립트 `dev-082-r4/mutate.py`), 전부 잡힘: M1 offset 을 `getBoundingClientRect` 로 되돌림 → 정적 연결 단언 실패 · M2 허용 오차 제거 → 경계 표 실패 · M3 `hangulOnOwnLine` 항상 `true` → 경계 표 실패 · M4 허용 오차 0.5 → 경계 표 실패 · M5 효과의 `headwordWrapped` 항상 `true` → 정적 연결 단언 실패 · M6 마지막 자식 대신 첫 자식 `offsetTop` → 정적 연결 단언 실패.

### r4 한계 / reviewer 가 볼 곳
- **브라우저 미확인**(금지 사항) — 순수 함수 경계와 정적 연결만 시험으로 고정. 회전 래퍼에서 offset 판정이 결과를 유지한다는 점은 `offsetTop`/`offsetHeight` 가 CSS transform 을 반영하지 않는 레이아웃 좌표라는 명세에 기댄 것이고(시험은 `getBoundingClientRect` 로 되돌리면 실패하게 막을 뿐), 실제 확인은 Leader 실브라우저 수용 기준(높이별 한글 줄 수 2/2/2/2/1 유지, 인라인=false·합성 줄바꿈=true·래퍼 회전해도 같은 결과) 몫.
- `offsetTop` 은 `offsetParent` 기준 — 두 자식은 같은 형제라 같은 `offsetParent` 이므로 비교 가능(표제어 행이 `position` 이 없어도 같은 조상 기준). 한글 `<span>` 이 `display: inline`(인라인 요소)라도 `offsetTop`·`offsetHeight` 는 정의됨(줄바꿈된 인라인 요소는 첫 줄 상자 기준이라 이 구조의 단일 `<span>` 에서 영향 없다고 봄 — 실브라우저 확인 대상).
- 정적 정규식 단언(r3-2)은 서식 변경에 취약한 점이 그대로다 — 이번에 순수 함수 경계 표를 offset 입력 기준으로 바꿔 부분 보강. DOM 효과 자체는 단위 시험으로 못 돌린다.
- 미커밋 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts` · 이 기록. 커밋·푸시·배포·브라우저·dev 서버·DB·LLM 호출 없음, 띄운 프로세스 없음, `npm test` 미사용.

### 체크포인트 (r4)
- 완료: 위 변경 2파일 + 실행 증빙 + 변이 6종 + 기록. 남은 일: reviewer 좁은 재감사(효과의 offset 판정·`hangulOnOwnLine` 허용 오차)와 Leader 실브라우저(r4 수용 기준 ①②). 다음 첫 행동: Leader 가 `docs/screens.md` §15-11-3 B6 판정 설명을 offset 기준으로 맞춤. 주의점: 스크래치패드 `dev-082-r4/` 에 r4 직전 백업(`*.pre-r4`)·변이 스크립트가 있음(삭제 불필요).
