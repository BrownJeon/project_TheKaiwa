---
task_id: task-054
title: "task-054 Developer 기록 (역할극 목표 카드 표현 칩 번역, IMP-0029, light 트랙)"
tags:
  - type/task
  - domain/improvement
  - domain/scenario
created: 2026-10-11
---

# task-054 — Developer 기록

이력서 본문: [[task-054-improve-roleplay-goal-translation]]

## 변경 파일 (3개, 모두 지정 범위)
- `src/components/scenario/logic.ts` — 순수 함수 `expressionKo(show, ko)` 추가(`requiredOf` 바로 위, 7줄). `show` 꺼짐·`ko` 가 문자열이 아님 → null, 켜짐이면 `trim()` 후 빈 값 → null, 아니면 정리된 문자열.
- `src/components/scenario/RolePlayGoalCard.tsx` — `useDisplayPrefs()` 로 `showTranslation` 읽기(조기 `return null` 보다 앞, `useAnnotations` 와 같은 위치), 칩마다 `expressionKo(showTranslation, e.ko)`, null 이 아니면 `<span className="block text-[12px] text-ink2 break-keep [overflow-wrap:anywhere]">` 한 줄을 HangulLine 다음·`sr-only` 앞에 추가.
- `src/components/scenario/__tests__/logic.test.ts` — 시험 1개 추가(켬/끔 반전·빈 문자열·공백/탭/줄바꿈뿐·null/undefined·앞뒤 공백 제거·끔+빈/null). 구현보다 먼저 작성해 빨강(19 pass / 1 fail) 확인 후 구현.

## 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-rp054`, `KAIWA_LOCAL_ROOT` sync, node_modules `cp -al` predeploy)
- `./node_modules/.bin/tsc --noEmit` → exit 0, 출력 없음.
- `./node_modules/.bin/eslint src/components/scenario` → exit 0, 출력 없음.
- `node --import tsx --test $(find src/components/scenario -name '*.test.ts')` (DATABASE_URL 가짜) → exit 0, `# tests 164 / # pass 164 / # fail 0`.
- 같은 방식 `src/components` 전체 → exit 0, `# tests 1039 / # pass 1039 / # fail 0`.
- `./node_modules/.bin/next build > /tmp/…log 2>&1` → exit 0, `✓ Compiled successfully in 5.8s`. 경고 3건(`Dynamic filesystem access causes tracing of the whole project`, 페르소나 파일 stat — 이 task 와 무관한 기존 경고).
- 변이 확인(미러에서만 바꿨다가 NFS 원본으로 재동기화, `diff` 로 복구 확인): ① `!show` → `show` 반전 → 시험 19 pass / 1 fail ② `return t ? t : null` → `return t`(빈 문자열 통과) → 19 pass / 1 fail. 두 변이 모두 잡힘.

## 끔일 때 DOM 이 변경 전과 같다는 근거
- 추가한 JSX 는 `{ko ? <span …>{ko}</span> : null}` 하나뿐이고, `showTranslation` 이 false 면 `expressionKo` 가 null → React 는 null 을 아무 노드로도 그리지 않는다. 다른 엘리먼트·클래스·속성은 건드리지 않았다(`git diff` 의 JSX 변경은 이 한 줄과 `const ko =` 한 줄뿐).
- 훅은 `useDisplayPrefs()` 한 번 추가(`useSyncExternalStore`+`useEffect`) — DOM 영향 없음. `JaText`·`HangulLine` 이 이미 같은 저장소를 구독 중이라 서버 요청은 늘지 않는다(첫 구독 GET 1회 공유).

## 설계-코드 차이
- 없음. 한 가지 선택: 번역 줄을 `sr-only`(", 썼어요") **앞**에 넣었다 — 스크린리더가 "일본어 한글 뜻, 썼어요" 순으로 읽도록(뒤에 넣으면 "…, 썼어요 뜻"). 끔일 때는 DOM 순서도 변경 전과 같다.

## 미확인
- 실기기(360/390/412 폭)에서 긴 뜻이 카드 폭 안에서 줄바꿈하는지·`GOAL_REGION_MAX` 스크롤과의 어울림은 소스로만 판단(칩 `min-w-0 max-w-full`, 번역 줄 `break-keep`+`[overflow-wrap:anywhere]`). 사용자 폰 확인 필요.
- 설정 「번역 펼쳐 두기」를 켠 뒤 방 안에서 즉시 반영되는지(저장소 구독이라 가능성 높음)는 렌더 시험 없이 코드로만 판단.
- 커밋 안 함(Leader).
