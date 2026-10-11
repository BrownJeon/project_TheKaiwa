---
task_id: task-059
role: developer (Dev-S — 서버)
tags:
  - type/task-record
  - domain/vocab
aliases:
  - task-059 Dev-S 기록
---

# task-059 Dev-S(서버) 기록 — [[task-059-improve-today-words-card-first]]

범위: 세트 생성(카드 우선 FLIP + `choices`)·#50 혼합 수용·#53 새 방식·#51 요약 문구·서버 시험. 스키마·화면·계약 문서 수정 없음.

## Developer 기록

- [23:05] 착수. 읽음: 이력서 「확정 결정」·「서버 명세」·「Leader 결정」1~7, api-contract §2-10 #47·#49·#50·#51·#53, screens.md §23-4·§23-9·§23-10·§23-12, `sessions.ts`·`distractors.ts`·`setGenerator.ts`·라우트, 기존 시험(task008·task042·task053·task049TopicWordsSeam).
  - 전용 미러 `~/.node-local/thekaiwa-dev059s` 동기화(exit 0). **기준선(변경 전)**: `DATABASE_URL=invalid node --import tsx --test --test-concurrency=1 $(find src/modules/learning src/app/api/v1 -name '*.test.ts' | sort)` → exit 0, **530/530 통과**.
  - 사전 확인한 **계약 ↔ 기존 시험 충돌 2곳**(계약을 따르면 반드시 깨짐 — Leader 결정 5 허용 범위 밖):
    1. `task008.test.ts:169` `parseCreateSessionBody({})` → `mode:'CHOICE'` 단언 ↔ 계약 #47 「기본 FLIP」.
    2. `task042.test.ts:689·696` 주제 CHOICE 세트 다시 풀기 → `mode:'CHOICE'`·`!('meaning' in c)` 단언 ↔ 계약 #53 「원래 CHOICE 여도 새 세트는 FLIP+choices」.
  - 판단: 계약대로 구현하고 두 시험은 Leader 승인 전에는 고치지 않는다(보고).
  - `choices` 없는 FLIP 카드의 응답: 계약 문구는 `choices:null` 이지만 `task008.test.ts:136` 이 `flip.choices === undefined`(strict)를 단언 → **키를 싣지 않는다(이전 FLIP 과 같음)**. 화면 `hasChoices` 가 undefined·null·[] 를 모두 없음으로 본다(§23-10 D4) — 동작 차이 없음. Leader 보고 항목.
- [23:20] **Leader 승인 수신**: ① 시험 2곳 수정 승인(아래 표) ② FLIP 의 보기 없는 카드는 **키 생략**(계약 문구는 Leader 가 갱신) ③ 같은 세트 안에서 카드마다 섞이면 안 됨(세트 전체 있음/없음).
- [23:25] **체크포인트 1 — 코드 변경 완료(시험 전)**. `src/modules/learning/vocab/sessions.ts`:
  - `parseCreateSessionBody` 기본 `mode` `'CHOICE'`→`'FLIP'`.
  - `insertSession` 에 필수 `flipChoices` — `mode==='CHOICE' || flipChoices` 면 카드마다 `pickChoices`, 전부 4개면 저장, 하나라도 못 만들면 CHOICE 는 FLIP 강등(이전 그대로)·FLIP 은 전부 null(강등 없음).
  - 내 단어장 #47: 트랜잭션 부분을 `composeWordSessionLocked(tx, userId, input, ceiling, now?)`(export, 시험용)로 분리 — 동작 동일. 재료 조건 `material = 풀 ≥4 && 서로 다른 뜻(active) ≥4` → CHOICE 강등 판정과 FLIP `flipChoices` 에 같이 씀.
  - 주제 #47: `flipChoices: true`(사전 조건 없음 — CHOICE 와 같은 카드별 판정).
  - `toCardDto`: `mode==='CHOICE' || 보기 있음` 일 때만 `choices` 키(보기 없는 FLIP 카드는 키 없음).
  - `recordAttempt`: `choice` 시도의 `mode !== 'CHOICE'` 400 삭제(FLIP 허용, 채점·`not_in_choices` 는 같은 코드), `flip` 시도의 CHOICE 400 `mode` 유지. 시험 주입용 `opts: TxRunner = {}` 추가(라우트 호출 모양 불변).
  - `replayVocabSession`: 주제·단어장 모두 새 세트 `mode:'FLIP'`·`newSeed('FLIP')`(→ `downgraded` false)·`flipChoices:true`, 보기 재료는 늘 조회(주제 = 풀 뜻 ∪ 단어장 뜻 ∪ 세트 뜻, 단어장 = 보관 안 한 단어). select 의 `mode` 삭제(안 씀).
  - finish `summary` 방식 문구: FLIP → 「카드」.
  - 라우트 `src/app/api/v1/vocab/sessions/route.ts` 주석만.
  - 남은 일: 기존 시험 수정 2곳(승인됨) → 새 시험 `task059CardFirst.test.ts` → 미러 동기화 후 tsc·eslint·전체 시험 → 변이 확인. 다음 첫 명령: 새 시험 파일 작성.

### 기존 시험 수정 (Leader 승인 2026-10-11 — reviewer 가 diff 로 대조)

| 파일:줄 | 전 | 후 | 이유 |
|---|---|---|---|
| `src/modules/learning/__tests__/task008.test.ts:169` | `mode: 'CHOICE'` | `mode: 'FLIP'` | 계약 #47 「`mode` 생략 기본 FLIP」 |
| `src/modules/learning/__tests__/task042.test.ts:685`(시험 이름) | 「…(CHOICE 유지)…」 | 「…(새 세트는 카드 우선 FLIP — task-059)…」 | 이름이 바뀐 단언과 어긋나지 않게(문자열만, 단언 아님) |
| `src/modules/learning/__tests__/task042.test.ts:689` | `rep.session.mode, 'CHOICE'` | `rep.session.mode, 'FLIP'`(메시지 갱신) | 계약 #53 「원래 CHOICE 여도 새 세트는 FLIP+choices」 |
| `src/modules/learning/__tests__/task042.test.ts:644·645·646`(Leader 2차 승인) | 세 줄의 `mode: 'CHOICE'` | `mode: 'FLIP'`(다른 키·메시지 그대로) | 계약 #47 「`mode` 생략 기본 FLIP」 — task008:169 와 같은 원인(사전 검색 누락, 전체 시험에서 발견) |
| `src/modules/learning/__tests__/task042.test.ts:696` | `c.choices?.length === 4 && !('meaning' in c)` | `c.choices?.length === 4 && c.meaning === <원 카드 meaningSnap>` | 같은 계약 — 보기 4개 단언 유지 + 뜻이 원 카드 뜻과 같은지 추가(강해지는 방향) |

- [23:50] **Leader 일반 기준 수신(시험 수정)**: 기존 시험이 깨지는 원인이 (a) `mode` 기본값 CHOICE→FLIP(#47) (b) 다시 풀기 새 방식(#53) (c) 요약 문구 「뒤집기」→「카드」(#51) 중 하나이고 기대값 문자열·모드 값 교체뿐(단언 수·강도 유지)이면 진행 + 위 표 기록. 그 밖(채점·`choices` 생성 조건·CHOICE 미노출·`one_answer`·멱등·finish 합산)은 코드 결함 가능성 → 수정 말고 보고.
- [23:55] **체크포인트 2 — 새 시험·검증 완료**.
  - 새 시험 `src/modules/learning/__tests__/task059CardFirst.test.ts`(19건, 가짜 tx — DB 0): 기본 FLIP · FLIP 보기 4개(정답 포함·서로 다름·DB 스냅샷=응답)·셔플 · 재료 부족 3갈래(단어<4·오늘 끝낸 단어 제외로 풀<4·서로 다른 뜻<4) → 전부 키 없음·DB null · CHOICE 명시 호환(미답 키 그대로·강등은 보기 없음) · 주제 FLIP 세트 보기/재료 부족 · `toCardDto` 키 규칙 · #50 FLIP 보기 답 CORRECT/WRONG·`chosenText` 기록·`not_in_choices`·보기 없는 세트 400·CHOICE+`selfResult` 400 `mode`·`one_answer`·방식 바꾼 재전송 멱등·409/404 · #49 복원(보기로 답한 카드/스스로/미답) · #51 혼합(Q9 5장) 합산 2·2·1·`WordEntry` 카운터·반복 항목 4·관측 5·스냅샷·요약 「카드」 · CHOICE 요약 「보기 고르기」 · #53 CHOICE→FLIP+보기·새 시드·삭제 단어 카드 보기·한 카드라도 부족하면 전부 없음.
  - 시험 내 `no-this-alias` lint 오류 → 가짜 tx 를 모듈 함수 `fakeTx(db)` 로 옮겨 해결(disable 주석 안 씀).
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-dev059s`, 동기화 exit 0):
    - `./node_modules/.bin/eslint src/modules/learning src/app/api/v1/vocab` → exit 0, 출력 없음.
    - `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 $(find src/modules/learning src/app/api/v1 -name '*.test.ts' | sort)` → exit 0, **549/549 통과**(기준선 530 + 새 19).
    - `./node_modules/.bin/tsc --noEmit` → exit 2, **7건 모두 `src/components/vocab/**`**(`TodayHome.tsx:358`·`VocabResult.tsx:153·207·210·213`·`__tests__/seedButtons.test.ts:32`·`__tests__/topicLogic.test.ts:206` — Dev-D·Dev-H 진행 중 작업의 `TopicStartToken`·`mixedMode` 타입, 내 파일 아님 → 고치지 않음). 내 파일(`src/modules/learning/**`·`src/app/api/v1/vocab/**`) 오류 0.
  - 남은 일: 변이 확인 → 최종 보고. 다음 첫 명령: 미러 `sessions.ts` 에 변이 1개씩 넣고 새 시험 실행 후 NFS 원본으로 복원.

- [00:15] **완료(DONE) — 최종 실행 증빙·변이 확인**.
  - 미러 = NFS 동일 확인(`cmp`: `sessions.ts`·`route.ts`·`task059CardFirst.test.ts`·`task042.test.ts`·`task008.test.ts` 모두 same).
  - `eslint src/modules/learning src/app/api/v1/vocab` → exit 0.
  - 전체 시험(위 명령) → exit 0, **550/550**(기준선 530 + 새 20).
  - `tsc --noEmit` → exit 2, 7건 **전부 `src/components/vocab/**`**(Dev-D·Dev-H 진행 중), 그 밖 0건.
  - 엔진명 grep(`reazon|whisper|style-bert|claude|haiku|sonnet|opus|qwen`, 바꾼 파일 3개) → 0건.
  - 새 시험 20건(체크포인트 2 의 19건 + 「#53 주제 CHOICE 세트 다시 풀기 → 카드 우선·강등 표시 없음」 1건 — 변이 M9 를 못 잡아 추가).
  - **변이 10종**(미러 `sessions.ts` 에만 넣고 `task059CardFirst`·`task042`·`task008` 실행, 끝나면 NFS 원본으로 복원 — `restored True`): M1 FLIP 보기 안 만듦 → 11 실패 · M2 FLIP 보기 답 거절 복원 → 8 · M3 세트 전체 대신 카드별 보기 → 1(「한 카드라도 모자라면 전부 없음」) · M4 단어장 다시 풀기 원 방식 → 1 · M5 요약 「뒤집기」 → 1 · M6 재료 조건 무시 → 1 · M7 기본 CHOICE → 12 · M8 FLIP 보기 응답 미노출 → 9 · M9 주제 다시 풀기 시드 CHOICE(강등 표시) → 1 · M10 단어장 다시 풀기 시드 CHOICE → 2. **10/10 검출.** 스크립트: 스크래치 `mutate059.py`.
  - 커밋·push 안 함. 미커밋 파일(내 것): `src/modules/learning/vocab/sessions.ts` · `src/app/api/v1/vocab/sessions/route.ts`(주석) · `src/modules/learning/__tests__/task059CardFirst.test.ts`(신규) · `src/modules/learning/__tests__/task008.test.ts`(1줄) · `src/modules/learning/__tests__/task042.test.ts`(5줄 + 시험 이름 1줄) · 이 기록 파일.
  - `20-Log` 는 이번 지시의 수정 허용 범위 밖이라 쓰지 않음(Leader 가 기록).
  - **reviewer 가 볼 위험 지점**: ① L1 — FLIP 카드는 `meaning` 과 `choices` 를 함께 싣는다(채점은 서버 `=== meaningSnap` 그대로, CHOICE 미답 카드의 키 집합은 시험이 그대로 단언). ② `insertSession` 의 전부/전무 규칙과 CHOICE 강등의 분기(`flipChoices` 는 CHOICE 에서 무시, 강등된 FLIP 은 내 단어장 경로에서 `flipChoices=material=false` 라 보기 없음 — 주제 경로는 CHOICE 실패 시 강등만 하고 보기를 다시 만들지 않음). ③ 다시 풀기는 이제 원 방식과 무관하게 보기 재료를 늘 읽는다(단어장 다시 풀기에 `wordEntry.findMany` 1회 추가, 트랜잭션 안) + 삭제 단어 카드도 보기 대상(이전 E4 「삭제 단어 있으면 FLIP 강등」 경로가 새 세트에서 사라짐 → 화면 알림 `deleted` 는 이전 세트에서만).
