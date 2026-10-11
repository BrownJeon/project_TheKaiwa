---
task_id: task-055
role: developer
tags:
  - type/developer-record
  - domain/drawer
aliases:
  - task-055 Developer D 기록
created: 2026-10-11
---

# task-055 — Developer D 기록 (감사 REV-184 지적 R1·R2·R4 수정)

> 본 이력서 [[task-055-drawer-corrections]] 의 Developer D 작업 기록. 감사 [[task-055-rev-record]](REV-184 PASS-with-fixes) 의 R1·R2·R4 만 고친다(R3 문서화된 한계·R5 시험 형태는 범위 밖). 화면 설계는 [[task-055-dev-c-record]]. 이 파일만 Developer D 가 쓴다. 커밋·push 없음.

## Developer 기록
- [18:05] 착수 — 감사 기록 R1~R5·변이 표, dev-c 기록, screens.md §21-5·21-6·21-11, 현재 작업트리 `CorrectionsScreen.tsx`·`logic.ts`·`WordSearchBar.tsx`·`drawer/__tests__/{drawerParts,correctionsScreen}.test.ts` 읽음. 전용 미러 `~/.node-local/thekaiwa-dev055d` 준비(sync exit 0).
- [18:22] **완료 — R1·R2·R4 수정(커밋·push 없음).**
  - **R1 (시험만, 컴포넌트 무수정)**: `drawerParts.test.ts` 에 시험 1건 — `WordSearchBar.tsx` 소스에서 `commitWhileTyping = (true|false),` 기본값을 읽어 `true` 인지 확인하고, **그 값을 `typingCommit` 에 그대로 넣어** `'debounce'` 가 나오는지(빈 칸 포함) 확인 + `DEBOUNCE_MS = 300`·`act === 'debounce'` 일 때 `setTimeout(onCommit, DEBOUNCE_MS)` 배선 + `WordsScreen`·`WordsSkeleton` 이 prop 을 넘기지 않음(기본값 사용). 기존 시험의 `schedule → typingCommit(v, commitWhileTyping)` 묶음과 이어져 「기본 prop → schedule → 디바운스」 사슬이 닫힌다.
  - **R2 (동작)**: `logic.ts` 에 순수 함수 `focusWishStep(wish, listQuery, lookup)` + 타입 `DrawerFocusWish{ids, scroll, after}`·`DrawerFocusStep`. 규칙: 목록이 `after` 요청의 답이 아니면 `wait`(DOM 조회도 안 함), 더 새 요청(`tick` 큰)의 답이 깔렸으면 `drop`, `after` 의 답이면 `ids` 앞에서부터 찾은 요소로 `apply`, 없으면 `drop`. 화면: effect 는 이 함수 결과만 따른다(`wait` 면 그대로 두고, 아니면 기록을 비운 뒤 `apply` 일 때만 초점). `toggle`(펼침·접음)과 `changeFilter`(조건 변경)는 기록을 비운다. `reloadKeep` 이 내보낸 조용한 다시 읽기 요청 객체를 돌려주고 `afterWordGone` 이 그 객체를 `after` 로 묶는다. 돌아오기 복원은 `after: q`(지금 반영하는 첫 쪽 요청).
  - **R4 (동작)**: `logic.ts` 에 `keepSearchTooLong(shown, input)` = `shown && cpLength(input.trim()) > 40`. 화면 `onInput={onSearchInput}` → `setQInput(v)` + `setQTooLong((was) => keepSearchTooLong(was, v))`. 입력 중에는 안내를 새로 띄우지 않고 조회도 하지 않는다(Enter 확정 규칙 그대로).
  - 바꾼 파일: `src/components/drawer/logic.ts`(「화면 상태 전이」 절 끝에 함수 2개·타입 2개 **추가**만) · `src/components/drawer/CorrectionsScreen.tsx` · `src/components/drawer/__tests__/drawerParts.test.ts`(시험 1) · `src/components/drawer/__tests__/correctionsScreen.test.ts`(시험 5: 초점 기록 2·배선 1, 40자 안내 1·배선 1). `WordSearchBar.tsx`·`logic.test.ts` 무수정.
  - 실행 증빙(미러 `~/.node-local/thekaiwa-dev055d`, 마지막 수정 뒤 sync exit 0):
    - `./node_modules/.bin/tsc --noEmit` → exit 2, 오류 4건 **전부 `src/modules/conversation/__tests__/phraseHelp.test.ts:312~315`**(task-056 다른 세션의 미완성 파일 — 고치지 않음). drawer·vocab 오류 0.
    - `./node_modules/.bin/eslint src/components/drawer src/components/vocab` → exit 0(오류 0·경고 0).
    - `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 $(find src/components src/modules/conversation -name '*.test.ts' | sort)` → exit 0, **2046/2046**(건너뜀 0). drawer 시험만 79/79.
  - 변이 확인(미러에서 하나씩 적용 → 해당 시험 실행 → 원본으로 되돌려 재실행, 끝에 NFS 원본과 `cmp` 동일 3파일): **13종 모두 검출, 되돌리면 0 실패.**
    | 변이 | 실패 |
    |---|---|
    | R1 `WordSearchBar` 기본값 `true→false`(감사 M9) | 1 |
    | R2a `focusWishStep` 기다림 제거(바로 적용 — 원래 결함 ①) | 2 |
    | R2b 대상 없음 → `wait`(기록 남김 — 원래 결함 ②) | 1 |
    | R2c 더 새 요청의 답이어도 `wait` | 1 |
    | R2d `toggle` 이 기록을 안 비움 | 1 |
    | R2e effect 가 `wait` 를 무시 | 1 |
    | R2f effect 를 옛 모양(`apply` 아니면 기록 남긴 채 return) | 1 |
    | R2g `afterWordGone` 의 `after` 를 다시 읽기 요청이 아닌 지금 `query` 로 | 1 |
    | R4a 안내가 입력으로 절대 안 풀림 | 1 |
    | R4b trim 없이 길이 셈 | 1 |
    | R4c 코드포인트 대신 `.length` | 1 |
    | R4d `onSearchInput` 에서 안내 판단 제거 | 1 |
    | R4e `onInput={setQInput}` 으로 되돌림 | 1 |
  - 감사 기록·가이드와 다른 점:
    1. `reloadKeep` 을 함수형 갱신(`setQuery((q) => …)`)에서 **지금 렌더의 `query` 로 만든 객체를 넘기고 돌려주는** 모양으로 바꿨다 — 초점 기록이 기다릴 요청 객체를 알아야 해서다(갱신 함수 안에서 ref 에 쓰면 StrictMode 이중 호출 때 버려지는 객체를 가리킬 수 있다). `changeFilter` 가 이미 같은 방식. 단어 시트가 열려 있는 동안 화면 조건은 바뀌지 않아(시트가 앞을 막음) 낡은 `query` 를 볼 위험은 낮다 `[가능성 높음]` — 시트의 `onNotFound` 는 ref 로 최신 props 를 부르고, `onRemoved` 는 삭제 요청 시작 때의 렌더 값이다. 감사 시험 `reloadLimit(list.items.length), { silent: true }` 정규식은 그대로 통과.
    2. 감사 수정 방향은 「`list.query` 가 새 요청일 때만 소비」였는데, 요청 **객체**(`after`)로 묶고 `tick` 비교로 「더 새 요청이 이겼으면 버림」을 더했다. 펼침·접음 외에 **조건 변경도** 기록을 비운다(사용자 조작 — `clearRestoreQuery` 와 같은 자리).
    3. R4 해제 기준은 **앞뒤 공백을 뺀** 코드포인트 수 — 확정(`commitSearch`)이 `v.trim()` 으로 재기 때문에 「확정하면 통과할 입력」에 안내가 남지 않게 맞췄다. 그래서 공백 포함 41자라도 trim 후 40자면 풀린다.
  - 남은 일(QA 라이브): R2 재현 — 시트에서 삭제 → 토스트 직후(다시 읽기 응답 전) 다른 카드 탭 → 초점이 그 카드에 남는지, 응답 뒤 초점이 끌려가지 않는지. R4 — 41자 Enter → 안내 → 40자로 줄이면 안내·`aria-invalid`·붉은 테두리가 사라지는지. 화면 DOM 시험은 여전히 없음(R5 범위).
  - 미커밋 파일(D): `src/components/drawer/{logic.ts,CorrectionsScreen.tsx}` · `src/components/drawer/__tests__/{drawerParts,correctionsScreen}.test.ts` · 이 기록. `20-Log` 는 이번 지시의 수정 허용 범위 밖이라 쓰지 않음(Leader 가 일일 로그에 반영).
