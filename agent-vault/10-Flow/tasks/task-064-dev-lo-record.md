---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-lo
---
# task-064 Low 4건(dev-lo) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 근거: QA [[task-064-qa-b1-record]] 의 QA64-B1-1, 최종 감사 [[task-064-rev-s-record]] 판정 표 S-5(M6f·M7c·M8d). 전용 미러 `~/.node-local/thekaiwa-dev064f`(`.env` 없음 — `node_modules` 는 `cp -al` 하드링크, 소스·시험은 `rsync`).

## 수정한 파일 목록 (미커밋 · `git add` 없음)

| 구분 | 파일 | 변경 |
|---|---|---|
| **소스 1곳** | `src/components/ask/AskRoom.tsx` | 방 오류 분기 감싸는 칸 `px-4 pt-6` → `px-4 pt-6 [&_button]:min-h-11` (줄 289, 클래스 한 곳) |
| 시험 | `src/components/ask/__tests__/askRoom.test.ts` | + `ErrorBlock` import, 새 시험 1건(B1-1) |
| 시험 | `src/modules/conversation/__tests__/askApi.test.ts` | 새 시험 1건(M6f, `askLimits` 단위) |
| 시험 | `src/app/api/v1/chats/_lib/__tests__/turnRoute.test.ts` | + `ASK_PER_DAY`·`ASK_PER_MINUTE` import, 새 시험 2건(M6f 라우트·M7c) |
| 시험 | `src/modules/conversation/__tests__/askTurn.test.ts` | + `loadAskPrev` import, 새 시험 1건(M8d) |
| 기록 | `agent-vault/10-Flow/tasks/task-064-dev-lo-record.md` | 이 파일 |

건드리지 않음: 공용 `components/common/ui.tsx`(`ErrorBlock`)·`askLimits.ts`·`turnRoute.ts`·`orchestrator/ask.ts`·prompts·docs·prisma. **`loadAskPrev` 위치 정정**: 지시문은 `askRouter` 라 했으나 실제 정의는 `src/modules/conversation/orchestrator/ask.ts`(askRouter/readers 의 두 읽기 함수와는 다른 함수)다 — 시험은 그 함수를 직접 부른다.

## Developer 기록

- [착수] 읽음: QA-B1 기록(B1-1 = 방 `ErrorBlock` [다시 시도] 높이 20px)·REV-S 판정 표 S-5·`AskRoom.tsx`·`AskHome.tsx`(목록 오류 상자는 버튼에 `min-h-11` 직접)·공용 `ErrorBlock`(className 받지 않음, 다른 9개 화면이 공유)·`askLimits.ts`·`turnRoute.ts`·`orchestrator/ask.ts`. 전용 미러 생성(`cp -al` 0.4초·파일 28,275개 = 원본과 같음), 기준선: 대상 4개 시험 파일 64건 통과.
- [체크포인트 1] 구현+시험 작성 완료, 69건 통과(64 + 신규 5). 남은 일: 변이 확인 → 전체 게이트 → 기록 마감.
- [체크포인트 2] 변이 확인 완료(전용 미러의 소스 **사본**에만 적용 → 시험 → 원복, 끝나고 `diff -rq` 로 NFS 원본과 동일 확인, `*.orig` 잔재 0). 아래 표.
- [체크포인트 3] 게이트 통과·기록 마감. 아래 「게이트」·「남은 위험」.

## 4건 처리 결과

| # | 항목 | 변경 | 새 시험 | 비고 |
|---|---|---|---|---|
| 1 | **QA64-B1-1** 방 불러오기 실패 [다시 시도] 20px → 44px | `AskRoom.tsx` 289행 오류 분기 감싸는 칸 `px-4 pt-6` → `px-4 pt-6 [&_button]:min-h-11`. 공용 `ErrorBlock`(`className` 을 받지 않고 다른 9개 화면이 공유)은 그대로. 같은 방식의 선례 `ConsoleSegmented.tsx`(`[&_button]:min-h-11`). 새 DOM 0 | `askRoom.test.ts` 「QA64-B1-1 방 불러오기 오류 …」 | 목록 쪽(`AskHome`)은 버튼에 클래스를 직접 달지만 방은 `ErrorBlock` 이 버튼을 안에서 만들어 부모 칸 선택자가 유일한 길 |
| 2 | **S-5/M6f** 수락 전 실패 `refund` 가 분·하루 몫 복구 | 시험만 | `askApi.test.ts` 「refund(수락 전 실패)는 분 몫과 하루 몫을 둘 다 되돌린다 …」(askLimits 단위) · `turnRoute.test.ts` 「수락 전 실패가 거듭돼도 사용자 몫은 그대로 …」(라우트: `startTurn` 이 던지는 실패를 하루 한도+1=61번 반복해도 매번 `startTurn` 까지 가고 429 가 아님 → 정상 턴 3건 통과·4번째 `ASK_RATE`) | 기존 시험은 **분 몫만** 잡았다(M6f-a 가 기존 시험에 생존했음을 변이 표에서 확인) |
| 3 | **S-5/M7c** `turn.done` 거절 시 `release` 호출·처리되지 않은 거절 0 | 시험만 | `turnRoute.test.ts` 「턴이 거절(reject)로 끝나도 슬롯을 풀고 처리되지 않은 Promise 거절을 남기지 않는다 …」 | `done` 을 라우트가 처리기를 단 뒤에야 거절시키는 가짜 턴 + `process.on('unhandledRejection')` 수집 + `release` 호출 횟수 1. `try/finally` 로 결함 시에도 슬롯을 풀어 뒤 시험(전역 슬롯 3칸 공유)에 연쇄 실패를 퍼뜨리지 않음 |
| 4 | **S-5/M8d** `loadAskPrev` where 의 `userId` | 시험만 | `askTurn.test.ts` 「⑧ 직전 되묻기 판정(loadAskPrev)도 이 방(chatId)·이 사용자 행만 읽는다 …」 | 같은 방 id 에 타인(u2)의 더 최근 되묻기·같은 사용자(u3)의 다른 방(c9) 되묻기를 넣은 가짜 DB(`where` 에 적힌 칸만 거름). 결과 단언 4건 + `where.chatId/userId` 단언. **정의 위치는 `orchestrator/ask.ts`** |

## 변이 결과 (변이 → 실패한 시험)

| 변이 (미러 소스 사본) | 실패한 시험 |
|---|---|
| B1a 오류 칸의 `[&_button]:min-h-11` 제거 | QA64-B1-1 |
| B1b 선택자를 `[&_a]:min-h-11` 로 | QA64-B1-1 |
| B1c `min-h-9`(36px) 로 | QA64-B1-1 |
| **M6f-a** `refund` 가 하루 몫만 안 되돌림 (기존 시험은 **통과 = 공백**) | `turnRoute` 「수락 전 실패가 거듭돼도 …」 · `askApi` 「refund 는 분 몫과 하루 몫을 둘 다 …」 |
| M6f-b `refund` 가 분 몫만 안 되돌림 | 위 둘 + 기존 「ASK 한도는 거절된 시도를 세지 않는다 …」 |
| M6f-c `refund` 가 슬롯을 안 풂 | `turnRoute` 6건(409 시험·거듭 실패·M7c·검증 순서·TALK/CHAT·정적 시험 — 새는 슬롯 연쇄) |
| M6f-d `refund` 통째 no-op | `turnRoute` 6건 + `askApi` 2건 |
| M6f-e 라우트 catch 에서 `admission.refund()` 제거 | `turnRoute` 6건(위와 같은 연쇄 포함: 409 시험·거듭 실패 …) |
| **M7c-a** `.then(release)` (거절 처리기 제거) | `turnRoute` 「턴이 거절(reject)로 끝나도 …」 (이 한 건만) |
| M7c-b `.then(release, () => {})` (삼키되 release 안 함) | 같은 한 건 |
| M7c-c `.finally(release)` (release 는 되지만 거절 전파) | 같은 한 건 — `failureType: 'unhandledRejection'`, release 횟수·슬롯 단언은 통과 → **처리되지 않은 거절 검사가 독립 신호** |
| M7c-d release 줄 통째 제거 | 기존 포함 11건 전부 |
| **M8d-a** `loadAskPrev` where 에서 `userId` 제거 | `askTurn` 「⑧ 직전 되묻기 판정 …」 |
| M8d-b `loadAskPrev` where 에서 `chatId` 제거 | 같은 한 건 |
| M8d-c `userId` 를 `{ not: "" }` 로(소유 조건 무력화) | 같은 한 건 |
| M8d-d(대조) `loadAskHistory` where 에서 `userId` 제거 | 기존 「⑧ 이력 창은 이 방·이 사용자·DONE 만 …」 (기존 시험 정상 동작 확인) |

변이 16건 전부 실패로 잡힘(생존 0). M6f-a·M7c-a/c·M8d-a 가 REV-S 가 지목한 공백 3건 본체이고, 신규 시험 없이는 생존했다.

## 게이트 (전용 미러 `~/.node-local/thekaiwa-dev064f`, NFS 원본 `rsync` 직후)

- 브라우저 실측(헤드리스 Chrome, Tailwind 4.3.3 로 컴파일한 실제 CSS + 공용 `ErrorBlock` 과 같은 마크업, 폭 390): [다시 시도] **전 19.5 × 51.5 → 후 44 × 51.5** (QA 실측 20 과 일치). 생성 CSS = `.\[\&_button\]\:min-h-11 button { min-height: calc(var(--spacing) * 11) }`(= 44px).
- `./node_modules/.bin/tsc --noEmit` → **exit 0**
- `./node_modules/.bin/eslint <변경·추가 5개 파일>` → **exit 0**(오류·경고 0)
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/components/ask src/modules/conversation src/app/api/v1/chats -name '*.test.ts')` → **65개 파일 · 1,251건 중 1,251 통과 · 실패 0 · 건너뜀 0**
- 보강: `src/components` 전체 시험 132개 파일 → 1,409건 중 1,407 통과 · 실패 0 · 건너뜀 2(기존)
- 대상 4개 파일 기준선 64건 → 신규 5건 추가 후 69건 통과(`askApi` +1 · `turnRoute` +2 · `askTurn` +1 · `askRoom` +1)
- 소스 변경 확인: `AskRoom.tsx` 한 줄(289행)뿐 — `rev064` 미러의 같은 파일과 `diff` 한 줄. `ui.tsx`·`askLimits.ts`·`turnRoute.ts`·`orchestrator/ask.ts` 는 `rev064` 미러 사본과 동일. `next build`·`npm run dev`·QA 서버(3011)·`thekaiwa-rev064` 안 실행·수정 0(읽기 `ls`/`du`/`diff` 와 `node_modules` `cp -al` 원본 읽기뿐).

## 남은 위험 / Leader 에게

1. **[가능성 높음] 같은 변이로 이 시험이 약해질 곳**: B1-1 시험은 소스 문자열(주석 제거본)로 부모 칸의 클래스를 잠그고, 선택자가 가리킬 `<button>` 이 `ErrorBlock` 에 있는지 렌더로 확인한다. `ErrorBlock` 이 나중에 자체 `min-h-11` 을 받으면 이 시험은 여전히 통과하지만(중복일 뿐 해롭지 않음) 방 쪽 클래스를 지울 이유가 생긴다 — 그때 시험을 같이 정리하면 된다. 공용 `ErrorBlock` 자체를 44px 로 올리는 편이 근본이지만 다른 9개 화면에 영향이라 이번 범위 밖으로 두었다(후속 후보).
2. **[확실] 이 시험들은 전역 한도 상태를 쓴다**: `turnRoute.test.ts` 는 프로세스 전역 슬롯 3칸을 모든 시험이 공유한다. 새 두 시험은 고유 사용자 id(`u-refund`·`u-reject`)를 쓰고 끝날 때 슬롯이 0 이다. M7c 시험은 `finally` 로 방어.
3. **[확실] 기록 B1-2(429 잠금 `aria-label` 초 원값)·B1-3(알 수 없는 근거 유형의 빈 원)** 는 이번 범위(Low 4건)에 없어 건드리지 않았다.
4. 미러 `~/.node-local/thekaiwa-dev064f` 는 남겨 둔다(정리는 Leader 지시 시). 임시 파일은 scratchpad 에만 있다.
