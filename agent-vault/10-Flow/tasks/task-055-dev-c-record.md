---
task_id: task-055
role: developer
tags:
  - type/developer-record
  - domain/drawer
aliases:
  - task-055 Developer C 기록
created: 2026-10-11
---

# task-055 — Developer C 기록 (화면 조립)

> 본 이력서 [[task-055-drawer-corrections]] 의 Developer C(화면 본체) 작업 기록. 서버 [[task-055-dev-a-record]], 밑바탕 [[task-055-dev-b-record]]. 이 파일만 Developer C 가 쓴다. 커밋·push 없음.

## Developer 기록
- [18:40] 착수 — 이력서·screens §21 전체·A/B 기록·B 코드(`logic.ts`·`correctionsCopy.ts`·`DrawerSwitch.tsx`·`correctionsReturn.ts`·`ChunkChips`·`WordSearchBar`)·`CorrectionCard`·`WordsScreen`·`WordsSkeleton`·`TabSkeleton`·`tabSkeletonSizes`·`tabSkeleton.test.ts` 읽음. 데모 게이트 `check` → `DEMO_GATE_PASSED`(task-055). 미러 `~/.node-local/thekaiwa-dev055c` 준비(sync exit 0).
  - 남은 일: 1 카드·유형 칩 → 2 화면 → 3 page → 4 자리표시 → 5 확인. 다음 첫 행동: `src/components/drawer/DrawerCorrectionCard.tsx` 작성.
- [19:20] **체크포인트 1 — 순서 1~4 코드 작성(시험 전).** 새 파일: `drawer/{DrawerCorrectionCard,ErrorTypeChips,CorrectionsScreen,CorrectionsSkeleton}.tsx`·`app/(app)/drawer/corrections/{page,loading}.tsx`. 바꾼 파일: `drawer/logic.ts`(끝에 「화면 상태 전이」 절만 **추가** — Leader 지시 「상태 전이 판단은 logic.ts 순수 함수로」, B 의 기존 코드는 한 줄도 안 바꿈. import 에 `DrawerCorrectionPage` 추가), `shell/tabSkeletonSizes.ts`(`CORRECTION_SKELETON`·`CORRECTION_TYPE_ROW` + `WORD_SKELETON` 주석 292·375 → 344·323), `shell/TabSkeleton.tsx`(`CorrectionCardsSkeleton`·`ErrorTypeRowSkeleton`).
  - 결정: ① 복원 값은 `useSearchParams()`(지금 주소)를 우선 — page.tsx `initial` 은 주소를 못 읽을 때 대비. 이유: 휴대폰 뒤로가기(popstate)는 라우터 캐시의 옛 서버 props 를 다시 쓸 수 있다(`PlanScreen` 이 같은 이유로 `useSearchParams` 를 씀 — plan/page.tsx 주석). 가이드 21-6 C 와 다른 점 → Leader 보고. ② 단어 시트 뒤 다시 읽기는 `silent` 요청 — 자리표시로 바꾸지 않고 받은 목록을 보인 채 읽는다(위치 유지). ③ 카드 높이 상수 280 = 데모 평균 275~287 의 가운데(실측 아님, 주석에 QA 재측정 명시).
  - 실행 증빙: `tsc --noEmit -p .` exit 0 · `eslint src/components/drawer src/components/shell "src/app/(app)/drawer"` exit 0.
  - 남은 일: 시험(카드·칩·logic 화면 상태·tabSkeleton 묶음) → 전체 시험 → `next build`. 다음 첫 행동: `src/components/drawer/__tests__/correctionCard.test.ts` 작성.
  - 미커밋 파일(C): 위 새 파일 6 + 바꾼 파일 3 + 이 기록.
- [19:50] **체크포인트 2 — 시험 작성.** 새 시험 `drawer/__tests__/correctionCard.test.ts`(카드·유형 칩 21건: 강조 문자열 = `CorrectionCard` 소스 REMOVED·ADDED, 유형 칩 클래스 = `ChunkChips` CHIP, 원문 공백·줄바꿈 보존, 200자 초과 강조 없음, 요약 버튼 안 p·div·a·button 0, 한글 줄 HangulLine 만, 접힘/펼침, 날짜 KST, 출처 줄, TALK/CHAT 링크·ASK 링크 없음, 단어 버튼 유무, 시험 문법 줄 위치, 칩 순서·0 칩·빈 facets) · `drawer/__tests__/correctionsScreen.test.ts`(상태 전이 15 + 소스 규칙 8) · `shell/__tests__/tabSkeleton.test.ts` 묶음 시험 5건 추가 + 기존 3건 확장(21-7 D 1~8).
  - 변이 확인: 카드 `text={c.original.trim()}` → 1건 실패, `drawerView` 의 silent 조건 뒤집기 → 3건 실패(복원 후 통과).
  - 보강: 조용한 다시 읽기(단어 시트 뒤)가 실패하면 받은 목록을 지우지 않고 읽는 중만 끝냄(`listFromFirstError` 첫 줄) + 시험 1건.
  - 남은 일: 전체 시험 결과 확인(백그라운드 진행 중) → 바뀐 logic 재시험 → `next build` → 최종 보고. 다음 첫 명령: `tail /tmp/claude-1000/test055c.log`.
- [20:15] **체크포인트 3 — C 범위 완료(커밋·push 없음).**
  - 실행 증빙(미러 `~/.node-local/thekaiwa-dev055c`, 마지막 동기화 뒤):
    - `./node_modules/.bin/tsc --noEmit -p .` → exit 0
    - `./node_modules/.bin/eslint src/components src/app` → exit 0(오류 0, 경고 5 = 기존 파일 `set-state-in-effect`, 이번 변경 파일 0)
    - `DATABASE_URL=mysql://invalid… node --import tsx --test --test-concurrency=1 $(find src/components src/modules/conversation -name '*.test.ts' | sort)` → exit 0, **2017/2017**(silent 실패 보강 전 실행) · 보강 뒤 `src/components/{drawer,shell}/__tests__/*.test.ts` → **148/148**
    - `./node_modules/.bin/next build > build.log` → exit 0, `ƒ /drawer/corrections`·`ƒ /api/v1/drawer/corrections`(경고 3 = 기존 `persona/loader.ts` 파일 추적)
    - 엔진·모델명 grep(drawer 전체·교정 모음 라우트) 0건 — 시험으로 고정
  - 21-12 A 중 시험으로 닫음: A4(조각 「없음」·번역 없음) · A5(카드 클래스·「채택함」/[채택][무시] 없음) · A7(쪽·이어 붙임·끝 표시 조건) · A8(전체 합·0 칩·머리 줄은 첫 쪽 facets) · A9(Enter 확정·40자 안내 — 소스) · A10(E1 링크·버튼 44px) · A11(요청 경합 — 요청 객체 일치) · A13(시트 props·삭제 뒤 조용한 다시 읽기 — 소스) · A14(HangulLine 만) · A17(원문 공백·줄바꿈 보존) · A18(문서 제목·엔진명 0).
  - **QA 실측 대기**: A1 단어장 목록 시작 344(3폭)·점프 ≤8px · A2 교정 모음 목록 시작 298(클래스 합 52+10+42+10+44+6+44+44+8+32+6 = 298 [가능성 높음])·자리표시↔데이터 점프 ≤8px · 실제 카드 높이(켬·접힘 3폭 평균 → `CORRECTION_SKELETON.cardHeight` 280 교체) · A3 분절 초점·`replace` · A6 정보 밀도 · A12 ←/휴대폰 뒤로가기 복원 · A15 3폭 가로 넘침·터치 44 · A16 IDOR(서버 시험은 A) · A19 어두운 화면 · 한 쪽 표시 분석 요청 수(코드상 `annotationClient` 가 한 커밋의 카드 40문장을 setTimeout 0 큐로 묶어 1건 [가능성 높음], 네트워크 확인 필요).
  - 미커밋 파일(C): `src/components/drawer/{DrawerCorrectionCard,ErrorTypeChips,CorrectionsScreen,CorrectionsSkeleton}.tsx` · `src/components/drawer/logic.ts`(절 추가) · `src/components/drawer/__tests__/{correctionCard,correctionsScreen}.test.ts` · `src/app/(app)/drawer/corrections/{page,loading}.tsx` · `src/components/shell/{tabSkeletonSizes.ts,TabSkeleton.tsx,__tests__/tabSkeleton.test.ts}` · 이 기록.
