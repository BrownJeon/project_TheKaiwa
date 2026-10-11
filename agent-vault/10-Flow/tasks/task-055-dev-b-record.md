---
task_id: task-055
role: developer
tags:
  - type/developer-record
  - domain/drawer
aliases:
  - task-055 Developer B 기록
created: 2026-10-11
---

# task-055 — Developer B 기록 (클라이언트 기반 부품)

> 본 이력서 [[task-055-drawer-corrections]] 의 Developer B(클라이언트 기반) 작업 기록. 서버는 [[task-055-dev-a-record]](Developer A), 화면 본체는 Developer C. 이 파일만 Developer B 가 쓴다. 커밋·push 없음.

## Developer 기록
- [17:40] 착수 — 이력서·screens §21 전체·api-contract §2-17·`usePlanReturn`/`planReturn`/`BackBar`/`TalkRoomHeader`(읽기만)·`ChunkChips`·`WordSearchBar`·`Segmented`·`WordsSkeleton`·`WordsScreen` 읽음. `DrawerCorrectionItem` 타입은 아직 없음(A 진행 중) → 순서 1~4 먼저, 5(logic.ts) 마지막. 미러 `~/.node-local/thekaiwa-dev055b` 준비. 변경 전 `ChunkChips`·`WordSearchBar` 렌더 문자열을 스크래치에 떠 둠(기본값 DOM 불변 시험의 기준).
- [18:05] **체크포인트 1 — 순서 1~4 완료.** 데모 게이트 `check` → `DEMO_GATE_PASSED`(task-055, approved v1).
  - 완료: `shell/correctionsReturn.ts`(새, 키 `kaiwa.correctionsReturn`·라벨 「교정 모음으로」·TTL=계획표 2h·주소 `^/drawer/corrections(\?[A-Za-z0-9._~%=&-]*)?$` ≤700·원본 경로 ≤300·`pickBackHref` 두 기록 중 늦은 쪽(같으면 계획표)·`backLabelOf`·`currentBackHref`) + 시험 10건 → `usePlanReturn.ts`(이름·인자·반환 그대로, 스냅샷 `currentBackHref(pathname)` 문자열/null, 서버 null, 라벨 `backLabelOf`). `drawer/correctionsCopy.ts`(21-9, 데모 원문 grep 대조). `drawer/DrawerSwitch.tsx`(Link replace·aria-current·현재 항목 preventDefault·초점 기록 20s 유효·placeholder 는 `nav inert` + 효과 없음). `WordsScreen`·`WordsSkeleton` 각 한 줄. `ChunkChips withNone`(판별 유니온 — false 면 값 타입 `ChunkType`), `WordSearchBar label·placeholder·commitWhileTyping`(false: Enter 만, 빈 칸이면 즉시 `onCommit('')` — `typingCommit` 순수 함수). 시험 `drawer/__tests__/drawerParts.test.ts` 13건(착수 시점 렌더 문자열 박제 비교).
  - 실행 증빙: `tsc --noEmit` exit 0 · `eslint`(바꾼 경로 전부) exit 0 · `node --test` correctionsReturn+planReturn+roomRender 27/27, drawerParts 13/13.
  - 남은 일: 5 `drawer/logic.ts` + 시험(A 타입 `DrawerCorrectionItem` 등 `src/types/chat.ts` 에 생김 — 확인함). 다음 첫 행동: `src/types/chat.ts` 174~205행 읽기.
  - 미커밋 파일(B): `src/components/shell/{correctionsReturn.ts,usePlanReturn.ts,__tests__/correctionsReturn.test.ts}`, `src/components/drawer/{correctionsCopy.ts,DrawerSwitch.tsx,__tests__/drawerParts.test.ts}`, `src/components/vocab/{WordsScreen,WordsSkeleton,ChunkChips,WordSearchBar}.tsx`.
- [18:25] **체크포인트 2 — 순서 5 완료, B 범위 끝.** A 타입(`DrawerCorrectionItem`·`DrawerCorrectionFacets`·`DrawerCorrectionPage`, `src/types/chat.ts` 174~201행) 확인 후 `drawer/logic.ts` + `drawer/__tests__/logic.test.ts` 17건(21-10 ② (a)~(f) 전부 + 더 보기 중복 제거·다시 읽기 개수·오류 문구).
  - logic.ts export: `DRAWER_ERROR_TYPES`(9, 선언 순 — 서버 모듈을 import 하지 않고 클라이언트에 둠, 라벨 표 키와 같음을 시험) · `DRAWER_CHUNK_TYPES`(4) · `DRAWER_PAGE_SIZE` 20 · `DRAWER_LIMIT_MAX` 50 · `DRAWER_Q_MAX` 40 · `DRAWER_CORRECTIONS_PATH` · `DrawerCorrectionFilter{errorType,chunkType,q}` · `DRAWER_FILTER_NONE` · `isDrawerErrorType`/`isDrawerChunkType`/`validQ`/`hasCondition` · `reloadLimit(n)`(20~50) · (a) `drawerCorrectionsUrl(f,{limit,cursor})` · (b) `facetTotal`·`typeChips(facets, selected)` · (c) `headCount(facets, selected)` · (d) `emptyKindOf(shown, itemCount)`→`'first'|'filter'|'search'|null`·`searchHasOtherCondition` · `appendUnique` · `loadErrorText({status})` · (e) `sourcePathOf`·`sourceHrefOf` · (f) `correctionsReturnUrl(shown,{focus,n})`·`parseCorrectionsReturnQuery(URLSearchParams | searchParams 객체)`→`CorrectionsInitial{filter,focus,n}`.
  - 결정 메모: ① `emptyKindOf` 는 facets 대신 받은 항목 수로 E1 을 정한다 — 계약상 조건 없는 첫 쪽 0개 ⇔ facets 합 0 이고, 집계·목록 사이에 채택이 끼는 경합에서도 「조건 없음 + 0개」가 E2 로 잘못 가지 않는다. ② `pickBackHref` 같은 `at` 이면 계획표(기존 동작 쪽). ③ 분절 초점 기록은 20초 유효(취소된 이동이 나중에 다른 길로 들어온 단어장의 초점을 가로채지 않게 — 가이드에 없는 보강). ④ 「빈 칸이 되면 바로 해제」(21-13 ②)는 `WordSearchBar` 가 `commitWhileTyping={false}` 일 때 `onCommit('')` 로 처리 — 화면은 `onCommit('')` 을 q 해제로 받으면 된다.
  - 실행 증빙(미러 `~/.node-local/thekaiwa-dev055b`, 동기화 직후):
    - `./node_modules/.bin/tsc --noEmit -p .` → exit 0(A 의 작업 중 파일 포함 전체 0)
    - `./node_modules/.bin/eslint src/components/shell/correctionsReturn.ts src/components/shell/usePlanReturn.ts src/components/shell/__tests__/correctionsReturn.test.ts src/components/drawer src/components/vocab/{WordsScreen,WordsSkeleton,ChunkChips,WordSearchBar}.tsx` → exit 0
    - `DATABASE_URL=mysql://invalid… node --import tsx --test --test-concurrency=1 src/components/{drawer,shell,scenario,vocab}/__tests__/*.test.ts` → exit 0, **370/370**(내 시험 40 = correctionsReturn 10 · drawerParts 13 · logic 17, 기존 planReturn 7·roomRender·tabSkeleton 등 그대로 통과)
    - 소비처 확인 `src/components/{lesson/__tests__/display,topic/__tests__/{draftHookGuard,originHint}}.test.ts src/components/{talk,chat}/__tests__/*.test.ts` → exit 0, **137/137**
    - 엔진·모델명 grep(drawer·correctionsReturn·usePlanReturn) 0건
  - 남은 일(B 범위 밖 — Developer C): `tabSkeletonSizes.ts` 의 `WORD_SKELETON` 주석 숫자(292·375 → 344·323) 갱신과 단어장 첫 화면 점프 ≤8px 실측(21-7 A), 화면 본체.
