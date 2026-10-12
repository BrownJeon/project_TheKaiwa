---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-fx2
---
# task-064 보정 2(dev-fx2) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 근거: 화면 감사 [[task-064-rev-u-record]] (REV-064-U1 PASS_WITH_NOTES) 중 Leader 가 고치기로 한 3묶음 — H-1(예문 뜻 줄 두 형식) · L-2(서버 요약에서 「연속 출석」 제외) · M-1·M-2(공용 부품 기본값 보호 시험 + 행동 시험). 정본 `docs/screens.md` §25-6 B·§25-11 ⑯, `docs/design/api-contract.md` §2-18-A 5항.
> 전용 미러 `~/.node-local/thekaiwa-dev064fx2`(predeploy `node_modules` `cp -al` + `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh`).

## Developer 기록

- [착수] 감사 기록·`answerMd.ts`·`answerMd.test.ts`·`recordRetrieval/sources.ts`·픽스처 `ask.json`(읽기 전용)·§25-6 B/§25-11 읽음. 전용 미러 생성(package.json 동일).
- [체크포인트 1] **H-1 완료(시험 먼저 → 빨강 5 → 구현 → 20/20 초록)**:
  - `components/ask/answerMd.ts` — 인용 묶음 바로 다음의 `>` 없는 한 줄을 마지막 예문의 뜻으로(`followMeaning`: 한글 ≥1자·≤120 코드포인트·`**` 지움·앞 `→` 지움 / 목록·번호·제목·빈 줄 뒤는 `classify`/흐름이 걸러 문단 / 묶음 끝이 빈 `>` 줄이면 「바로 다음」 아님 / 예문 묶음이 아니면 가져가지 않음 / `> →` 줄이 이미 있으면 그것이 우선). `quoteBlocks(lines, follow)` 로 리팩터, `EXAMPLE_MEANING_MAX=120` export. 기존 `> →` 동작 불변.
  - `components/ask/__tests__/answerMd.test.ts` — H-1 ①~⑧ 신규(픽스처 `tests/prompts/fixtures/ask.json` 의 선생님 답 `> 窓が開いている。\n창문이 열려 있어요.` 모양을 `process.cwd()` 에서 읽어 그대로 `parseAnswerMd` 에 넣는 교차 시험 포함 · 두 형식·혼합·여러 예문·일본어 섞인 뜻·경계 120/121·빈 줄·목록 표식·렌더 상자 안 확인). **기존 시험 1건 수정**: ②의 「블록 종류가 바뀌면…」 입력 마지막이 `> 窓が開いている。\n끝` 이었는데 새 규칙(§25-6 B 정정)에서 「끝」(한글 1자)은 뜻이 되므로 `> → 창문` 줄을 끼워 같은 블록 종류 열(`p,ul,ol,ex,p`)을 유지.
  - **알려진 부작용(정본대로)**: JA 한 줄 바로 아래 빈 줄 없이 이어진 짧은 한국어 설명 문장(≤120자)은 뜻으로 가져간다 — 프롬프트가 늘 빈 줄로 띄우고 뜻을 바로 아래에 붙이므로 정상 출력에선 일치.
- [체크포인트 1] **L-2 완료**: `learning/recordRetrieval/sources.ts` 진도 요약에서 `연속 출석 N일` 줄·`recentAttend` 쿼리(출석 날짜 400개 읽기)·`computeStreak` import·`streak` 변수·`SOURCE_CAPS.streakDays` 제거. **판단 1건**: 요약 후보를 내는 조건에서 `|| streak > 0` 도 뺐다 — 연속만 있고 기간 활동·출석이 0 인 경우(예: 지난주를 묻는데 오늘 연속 출석 중) 이전엔 「전부 0」 요약이 나갔으나 이제는 요약 없음(=「관련 기록 없음」 신호). 연속 일수가 안 나가는 이상 그것만으로 요약을 내는 근거가 없어서. 머리 주석 2곳(`sources.ts`·`types.ts`) 갱신. 시험 `recordRetrieval.test.ts` ②: `연속 출석 3일` 기대 → `출석 4일`, 모든 항목 `text`·`label`·`sourceMap.label` 에 「연속」 0건 부정 단언 추가(빨강 확인 후 초록 26/26).
- [체크포인트 2] **M-1·M-2 구현 부분 완료(시험은 다음)** — 시험을 위해 순수 함수로 뺀 것(동작 불변, tsc 통과):
  - `chat/turnBody.ts`(신규) `buildTurnBody(text, opts)` — `scope`·`utteranceId`·`clientTimings`·`coachRevealed` 는 있을 때만 키가 생김. `useChatTurn.send` 가 이것을 호출.
  - `chat/messages.ts` `annotatable`·`annotatedMessages(messages, annotate = true)` — `MessageList` 가 분석 요청 대상을 이것으로 고름.
  - `ask/homeLogic.ts` `createAskRoom(deps, text)` — 방 만들기 잠금·성공 시 잠금 유지·실패 시 해제. `AskHome.create` 가 호출. 기존 `askHome.test.ts` 의 `apiPost<CreatedChat>(… title: askTitleOf(text))` 정규식 단언은 새 위치에 맞게 2줄로 갱신.
  - `ask/logic.ts` `scopeSheetRestoreText(held)` — 보내는 범위 시트 취소·Esc·배경 때 입력 바로 돌려줄 글. `AskRoom.closeScopeSheet` 가 호출.
- [체크포인트 3] **M-1·M-2 시험 작성 완료(초록)**: 신규 `chat/__tests__/sharedDefaults.test.ts`(11건 — buildTurnBody scope 키 없음·`useChatTurn` 이 buildTurnBody 만 쓰는 구조·`annotatedMessages` 기본/false·MessageList 기본값 소스·Composer 정적 렌더 기본 `lang="ja"`/「메시지 입력」/busy 보내기 이름·ProposalCard 기본 context 채팅 문구·모르는 종류 `''`·DisplayBar 기본 3토글/2토글), 신규 `ask/__tests__/askBehavior.test.ts`(9건 — `createAskRoom` 연타 1방·성공 시 잠금 유지·실패 해제·SSR 프로브로 관문 첫 렌더 `null`·`scopeSheetRestoreText`·`closeScopeSheet` 배선·AskPending 경과 초 `aria-hidden`·칩 뒤 `focusList`·근거 카드 돌아오기 기록 가드). 남은 일: 변이 ≥6 확인 → 전체 tsc/eslint/시험/build → 기록 마감.
- [체크포인트 4] **변이 확인 + 게이트**(전용 미러 `~/.node-local/thekaiwa-dev064fx2`, 변이는 미러 사본에만 적용 후 재동기화, 끝나고 `diff -rq src` 로 NFS 원본과 동일 확인):
  - **변이 26건 적용 → 25건 잡힘, 1건 생존(동치 변이)**. 잡힌 것: ⑯ `scope` 항상 싣기(2건 실패) · Composer 기본 `lang` ko · Composer 기본 `busyReason` 변경 · DisplayBar 기본 키에서 `tr` 제거 · MessageList `annotate` 기본 false · ProposalCard 모르는 종류 폴스루(2) · ProposalCard `context` 기본 ask(2) · `annotatedMessages` 필터 제거 / M-2 `createAskRoom` 잠금 확인 제거(3) · 실패 시 잠금 유지 · 관문 서버 스냅샷 `null→true` · 시트 닫기 복원 제거 · 복원이 `fromComposer` 무시 · 방 쪽 관문 `=== true` → `!== false` · 경과 초 `aria-hidden` 제거 · 칩 뒤 `focusList` 제거 · 근거 카드 항상 돌아오기 기록 / H-1 뜻 줄 한글 조건 제거 · 120→200 · 기호 없는 뜻 붙이기 끔(5) · 묶음 끝 빈 `>` 줄 허용 · 마지막이 뜻 줄이어도 다음 줄 소비 · 예문 묶음 아니어도 뜻 가져감 · 굵게 표식 안 지움 · 목록 줄도 뜻으로 / L-2 `연속 출석` 줄 복구. **생존 1건** = `createAskRoom`/`quoteBlocks` 의 `next?.k==='M' ? … : next===undefined ? follow : null` 두 갈래 순서 뒤집기 — 두 조건이 서로 배타라 결과가 같은 동치 변이(의미 있는 우선순위 변이는 「마지막이 뜻 줄이어도 다음 줄 소비」로 잡힘).
  - **실행 증빙**(NFS 원본 `sync-local.sh` 직후, 저장소 전체): `./node_modules/.bin/tsc --noEmit` → exit 0 · `./node_modules/.bin/eslint src` → exit 0(경고 5건은 기존 `set-state-in-effect`, 이번 변경 밖) · `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → **3,718건 중 3,717 통과 · 실패 0 · 건너뜀 1**(건너뜀 = 기존 `#9 실제 배포 manifest`, 미러에 `speech/models` 없음) — 이 중 이번에 늘어난 시험은 answerMd +8 · sharedDefaults 11 · askBehavior 9 · recordRetrieval 부정 단언 추가(건수 불변). dev-fx 기록의 3,668 → 3,718(+50): 이번 신규는 28건(answerMd 8·sharedDefaults 11·askBehavior 9), 나머지 22건은 이번 변경 밖의 시험 추가(작업트리에 다른 에이전트 산출이 함께 있음 — 출처는 확인하지 않음).
  - `next build` → exit 0 (`/tmp/claude-1000/fx2-build.log`).
- **변경 파일(NFS 원본, 미커밋·`git add` 없음)**:
  - 화면 파서: `src/components/ask/answerMd.ts`(`EXAMPLE_MEANING_MAX`·`followMeaning`·`canTakeFollowMeaning`·`quoteBlocks(lines, follow)`)
  - 서버 요약: `src/modules/learning/recordRetrieval/sources.ts`(연속 출석 줄·쿼리·`streakDays` 제거) · `…/types.ts`(머리 주석 한 줄)
  - 순수 함수로 뺀 곳(동작 불변): `src/components/chat/turnBody.ts`(신규) · `chat/useChatTurn.ts` · `chat/messages.ts` · `chat/MessageList.tsx` · `ask/homeLogic.ts` · `ask/AskHome.tsx` · `ask/logic.ts` · `ask/AskRoom.tsx`
  - 시험: `ask/__tests__/answerMd.test.ts`(+8, 기존 1건 입력 보정) · `ask/__tests__/askBehavior.test.ts`(신규 9) · `ask/__tests__/askHome.test.ts`(정규식 1줄 → 2줄) · `chat/__tests__/sharedDefaults.test.ts`(신규 11) · `modules/learning/recordRetrieval/__tests__/recordRetrieval.test.ts`(기대 갱신 + 「연속」 부정 단언)
  - 건드리지 않음: `prompts/**`·`tests/prompts/fixtures/ask.json`(읽기만)·docs·prisma.
- **남은 의문 / Leader 에게**:
  1. **새 규칙의 부작용 1건**(정본대로): JA 한 줄 바로 아래 빈 줄 없이 이어진 ≤120자 한국어 한 줄은 무엇이든 뜻으로 간다. 모델이 예문 밑에 곧바로 설명 문장을 붙이면 그 문장이 예문 상자 안 뜻이 된다 — 프롬프트(`ask.ts`)가 「예문은 앞뒤를 빈 줄로 띄운 두 줄」 이라 정상 출력에선 일치. 기존 시험 1건(`② … 블록 종류가 바뀌면…`)이 바로 이 모양(`> JA\n끝`)이라 `> → 창문` 줄을 끼워 보정했다.
  2. **판단 1건(L-2)**: 요약을 내는 조건에서 `|| streak > 0` 까지 뺐다(연속만 있고 기간 활동·출석이 0 이면 이전엔 「전부 0」 요약이 나갔고 이제는 요약 없음 = 「관련 기록 없음」). 원치 않으면 되돌리되 연속 일수를 읽는 쿼리를 다시 넣어야 한다.
  3. **PE 픽스처가 아직 「연속 출석」을 모델링**: `tests/prompts/fixtures/ask.json` p01 S1 `text` 「…, 연속 출석 4일」 과 `header.streakDays: 4`(학습자 헤더의 `연속 출석 4일` 줄은 「학습자 정보」 범위로 보낸다고 이해했으나, 이것도 동의 문구 열거어에는 없음). 서버가 이제 이 글을 만들지 않으므로 픽스처 p01 글에서 「연속 출석 4일」 을 빼는 것이 일관적이다(PE 몫 — 읽기만 했다).
  4. `ProposalCard` 의 모르는 kind → 아무것도 안 그림(`return null`)은 감사가 의도된 개선이라 한 대로 시험으로 잠갔다. `ChatMenuSheet`(TALK/CHAT 문구)·`TurnNotice` 기본 문구는 ⑯ 목록에 있으나 이번 지시의 5개(useChatTurn·Composer·MessageList·ProposalCard·DisplayBar)에 없어 시험하지 않았다 — 필요하면 다음 보정에서.
