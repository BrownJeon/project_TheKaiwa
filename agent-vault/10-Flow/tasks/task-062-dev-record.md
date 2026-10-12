---
task_id: task-062
role: developer
tags:
  - type/record
  - domain/tech-debt
created: 2026-10-12
---

# task-062 Developer 기록

이력서: [[task-062-cleanup-cancel-test-noise]]

- [체크포인트 0] 착수. 전용 미러 `~/.node-local/thekaiwa-dev062`(기본 미러 `node_modules` 를 `.prisma` 만 빼고 `cp -al`, `.prisma` 는 `thekaiwa-predeploy` 에서 실복사, `prisma/schema.prisma` md5 `8f493d1b…` NFS 와 동일) + `KAIWA_LOCAL_ROOT=…/thekaiwa-dev062 bash scripts/sync-local.sh`. 기본 미러·predeploy·타 `thekaiwa-*` 미러, 포트 3010~3015 미접촉. `.next` 는 만들지 않았다(빌드 때 자기 미러에서만 생김).
- [체크포인트 1] 항목 1 완료·항목 2 변환 완료(변이 전). **항목 1**: `chats/phraseHelp.ts` 의 `isAbortError`·`cancelledError` 사본 삭제 → `./requestCancel` import(동작 불변 — 정의 두 개가 글자까지 같았다: `name === 'AbortError'`, `new ApiError('CONFLICT','요청이 취소됐어요.',{reason:'CANCELLED'})`). `requestCancel.ts` 머리 주석의 「phraseHelp 는 따로 갖고 있다」 서술을 현재 사실로 정정. 세 서비스(`replyPractice`·`openingDraftRun`·`phraseHelp`) 모두 `requestCancel` 사용 확인(grep). **항목 2**: `scenario/__tests__` 8파일(`qaP2cAFixes`·`roomFlow`·`resultWiring`·`resultLogic`·`variant`·`variantButtonStable`·`variantHeldKey`·`variantStatusOrder`)의 `readFileSync(…,'utf8')`+자작 정규식 주석 제거 → 공용 `readCode`. 단언 본문 0 수정. 기준선 164/164 → 변환 후 164/164(양성 단언이 실제 코드에서 그대로 통과 — 주석에 기댄 단언 없음). 남은 일: 변이 확인 · `roomRender`(279행 raw)·`editorScroller`(33행 raw)는 지시 목록 밖이라 검토 후 보고 · 항목 3 · 새 시험(공용 정의 가드·withApi) · eslint/tsc/전체 시험/build. 다음 첫 행동: 변이(미러 사본). 미커밋 파일(내 것): `src/modules/conversation/chats/{phraseHelp,requestCancel}.ts` · `src/components/scenario/__tests__/{qaP2cAFixes,roomFlow,resultWiring,resultLogic,variant,variantButtonStable,variantHeldKey,variantStatusOrder}.test.ts`.
- [체크포인트 2] 항목 2 변이 확인 완료(미러 사본만 변이, 매번 NFS 원본으로 복사 후 `cmp` 동일 — 15건 모두 `restored_cmp_equal: true`; 각 변이마다 **옛 시험(HEAD 본)**과 **새 시험**을 같은 변이 소스에 돌려 대조). 옛 시험은 통과(거짓 통과)·새 시험은 실패한 변이 9건: V1a(TalkRoom `srMsg` state 줄 `//`) · V2a(useRolePlay `setSheet(...)` 줄 `//`) · V2b(`runFinish({` → `/* … */`) · V3a(LessonEnd `<LessonScenarioCard/>` → `{/* */}`) · V3b(LessonScenarioCard `source` 줄 `//`) · V4a(useRolePlayResult `useKeyedResource` import·사용 둘 다 `//`) · V4b(RolePlayResultScreen `onClick` → 여는 태그 안 `/* */`) · V6a(VariantDraftScreen `above` 줄 → `''// …` 따옴표 뒤 줄 주석 — 옛 자작 정규식 `[^:'"\`]` 가 못 거르는 모양) · V6b(useVariantDraft 막힘 가드 → `''// …`). 옛·새 둘 다 실패(옛 정규식이 이미 거르던 모양, 새 시험도 유지)는 V1b·V5·V7a·V7b·V7c·V6c. V6c 의 `variantButtonStable` 은 Pick 의 GenStatus 를 단언하지 않아 둘 다 통과(해당 없음). 실행기: 스크래치 `mutate.py`. 주의: `"x"// {…}` 를 JSX 자식 자리에 넣은 첫 시도(V6a 초안)는 JSX 글자라 **실제 코드**여서 새·옛 모두 통과 — TS 파서가 맞다(JSX 자식의 `//` 는 주석이 아니다). 비JSX 자리로 다시 짰다.
- [체크포인트 3] 항목 3 재현·구현. **재현**(미러 전용 probe 라우트 `/api/probe062` = `withApi`+`readJsonObject`, 미러 `next dev -p 3027`, raw TCP 클라이언트 — probe 는 미러 밖(스크래치)으로 옮겨 정리, 서버 종료, NFS 에는 없음): ① **본문 절반만 보내고 소켓 destroy** → `readBodyCapped` 의 `reader.read()` 가 `Error('aborted')`(`code: 'ECONNRESET'`)로 거절, catch 시점 `req.signal.aborted === true`(3/3 일관) → `[api] 처리되지 않은 예외: Error: aborted` 1줄 · ② 본문 전부 보내고 즉시 destroy → 핸들러가 안 돌아 로그 0 · ③ 본문 읽은 뒤 1.5초 처리 중 destroy → 오류 없음(응답을 닫힌 소켓에 쓸 뿐), 로그 0 · ④ **신호가 살아 있는** 요청에서 같은 `Error('aborted')`(code ECONNRESET) 던짐 → 로그 1줄+500 · ⑤ 정상 요청 200. 즉 소음 원천 = **본문 읽는 중 끊김**이고 설계 조건(`req.signal.aborted === true` + 'aborted' 계열)이 그 한 갈래를 정확히 잡는다. 운영 `pm2-err.log`(읽기 전용 grep)에는 같은 줄이 09-30 23:10 1건만 남아 있다(로그가 짧음/회전 [추측]). **구현**(`src/modules/infra/http.ts`): `isClientGoneNoise(req, e)`(신호 없는/살아 있는 요청 → false, 아니면 `message === 'aborted'` 또는 `code === 'ECONNRESET'` 또는 `name === 'AbortError'`) + `toErrorResponse(e, {clientGone?})` 선택 인자 — `INTERNAL` 이고 `clientGone` 이 아닐 때만 `console.error`. 응답(`fail(c.code, …)`)·`classifyError`·`withApi` 시그니처·반환 불변. 구현 후 같은 probe 로 재확인: ① 로그 0 · ④ 로그 1+500 유지. 남은 일: 새 시험(infra `task062ClientGone`, conversation `task062SharedCancel`) · 변이 · eslint/tsc/전체 시험/build. 다음 첫 행동: 시험 작성. 미커밋 파일 추가: `src/modules/infra/http.ts`.
- [체크포인트 4] 새 시험 2파일 작성·통과(11/11): `src/modules/infra/__tests__/task062ClientGone.test.ts`(withApi — ① 끊긴 요청+aborted 계열(message·code·name·DOMException) 로그 0·응답 그대로 500 ② 살아 있는 신호 같은 오류 로그 1·응답 동일 ③ 일반 오류 신호 무관 로그 1+500(문자열 throw 포함) ④ ApiError·엔진 이름(404/409/504) 로그 0·봉투 불변 ⑤ 신호 없는 호출({}·undefined·null) 로그 1 ⑥ 정확 일치 아닌 문구·다른 code 계속 기록 + 정상 응답 통과·`toErrorResponse` 옵션 없음 기록 불변) · `src/modules/conversation/__tests__/task062SharedCancel.test.ts`(세 서비스가 `./requestCancel` import·자체 정의 없음·같은 취소 분기, `readCode` 로 읽어 주석 위장 불통과). eslint(수정·신규 13파일) exit 0 · tsc --noEmit exit 0(자기 미러의 낡은 `.next` 는 미러 밖 스크래치로 옮겨 정리 — probe 라우트 타입 참조 때문). **변이 13건 전부 실패로 잡힘**(미러 사본 변이 후 NFS 원본 복사·`cmp` 동일): H1 신호 조건 제거 · H2 반전 · H3 ECONNRESET 제거 · H4 AbortError 제거 · H5 message 정확→포함 · H6 clientGone 무시 · H7 항상 clientGone · H8 clientGone 미전달 · H9 응답 변경 · C1 phraseHelp 자체 재정의 · C2 import 주석 · C3 취소 분기 신호 조건 제거 · C4 import 를 줄 끝 주석으로 위장. 남은 일: 전체 시험·next build·최종 기록. 다음 첫 행동: 전체 시험(백그라운드). 미커밋 파일 추가: `src/modules/infra/__tests__/task062ClientGone.test.ts` · `src/modules/conversation/__tests__/task062SharedCancel.test.ts`.

## 마무리 (developer, 2026-10-12)

### 변경 파일 (미커밋 — `git add -A`·커밋·push 안 함)
- 서비스·인프라: `src/modules/conversation/chats/phraseHelp.ts`(중복 두 정의 삭제 → `./requestCancel` import) · `src/modules/conversation/chats/requestCancel.ts`(머리 주석 정정) · `src/modules/infra/http.ts`(`isClientGoneNoise` 신설, `toErrorResponse(e, {clientGone?})` 선택 인자, `withApi` 가 넘김 — 시그니처·반환 불변)
- 소스 검사 시험 8파일(`src/components/scenario/__tests__/`): `qaP2cAFixes`·`roomFlow`·`resultWiring`·`resultLogic`·`variant`·`variantButtonStable`·`variantHeldKey`·`variantStatusOrder` (`readFileSync(…,'utf8')`+자작 정규식 → `readCode`, 단언 본문 0 수정; `roomFlow` 의 중복 주석 제거 정규식 1줄 삭제)
- 신규 시험 2파일: `src/modules/infra/__tests__/task062ClientGone.test.ts`(8 test) · `src/modules/conversation/__tests__/task062SharedCancel.test.ts`(3 test)
- 이 task 밖 미커밋(건드리지 않음): `src/components/talk/**`·`docs/screens.md`(task-061), `src/components/vocab/**`(task-060), vault 문서.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev062`, 포트 3027 만 잠깐 사용·종료)
- 기준선(변환 전) `node --import tsx --test src/components/scenario/__tests__/*.test.ts` → 164/164 · 변환 후 → **164/164**.
- 새 시험 2파일 → **11/11**.
- `eslint`(수정·신규 13파일) → exit 0 · `tsc --noEmit` → **exit 0**(0줄).
- 전체 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` → **3368 tests · pass 3367 · fail 0 · skipped 1**(기존 skip) · 233s.
- `next build` → **exit 0**(`build62.log`).
- 참고: 프로젝트 전체 `eslint .` 은 exit 1 이지만 **내 파일 0건** — 오류 54건은 전부 `tests/live/**`(no-explicit-any 등, 기존), 경고 일부는 `src/components/{admin/trace,settings}/**`(내가 안 건드린 파일). 수정·신규 13파일로 좁힌 eslint 는 0.

### 변이 결과 (미러 사본만 변이, 매번 NFS 원본을 덮어 복사 후 `cmp` 동일 확인 — 28건(+ 무효였던 초안 V6a 1건) 모두 `restored_cmp_equal: true`)
- **항목 2** 15건: 옛 시험(HEAD 본)은 통과하고 새 시험만 실패한 거짓 통과 변이 **9건** — V1a `TalkRoom` state 줄 `//` · V2a `useRolePlay.setSheet` 줄 `//` · V2b `runFinish({` → `/* */` · V3a `LessonEnd` 카드 `{/* */}` · V3b `LessonScenarioCard.source` 줄 `//` · V4a `useRolePlayResult` `useKeyedResource` import·사용 `//` · V4b `RolePlayResultScreen` `onClick` → 여는 태그 안 `/* */` · V6a `VariantDraftScreen.above` → `''// …` · V6b `useVariantDraft` 가드 → `''// …`. 옛·새 모두 실패(이미 거르던 모양, 새 시험이 유지) V1b·V5·V7a·V7b·V7c·V6c(`variantStatusOrder`). V6c 의 `variantButtonStable` 은 Pick 의 GenStatus 를 단언하지 않아 해당 없음.
- **항목 1·3** 13건 전부 새 시험이 실패로 잡음: H1~H9(신호 조건 제거·반전, ECONNRESET/AbortError 갈래 제거, message 정확→포함, `clientGone` 무시/항상/미전달, 응답 변경) · C1~C4(phraseHelp 자체 재정의, import 주석, 취소 분기 신호 조건 제거, import 를 줄 끝 주석으로 위장).

### 'aborted' 오류가 던져지는 위치 (재현 확인)
- **본문 읽기 중 끊김**: `readJsonObject`→`readBodyCapped` 의 `reader.read()` 가 `Error('aborted')`(`code: 'ECONNRESET'`)로 거절 → `withApi` catch → `toErrorResponse` 가 INTERNAL 로 보고 `[api] 처리되지 않은 예외: Error: aborted` 기록. catch 시점 `req.signal.aborted === true` (미러 `next dev` + raw TCP 로 본문 절반만 보내고 destroy, **3/3 일관**). 본문 전부 보낸 뒤 즉시 destroy 는 핸들러가 안 돌아 로그 0, 본문 읽은 뒤 처리 중 destroy 는 오류 없이 닫힌 소켓에 쓸 뿐 로그 0. 신호가 살아 있는데 같은 오류를 던지면(합성 probe) 로그 1줄+500 유지.
- 구현 후 같은 probe: 본문 중 끊김 → 로그 0 · 신호 살아 있는 합성 오류 → 로그 1+500 · 정상 200.
- 운영 `pm2-err.log`(읽기 전용) 에는 같은 줄이 2026-09-30 23:10 에 1건만 보인다 — 이력서의 「09-30 부터 기존 현상」과 일치하나 빈도는 낮다(로그 회전 여부는 확인 못 함 [추측]).

### 이탈·미실행
- 지시 목록의 「5파일」은 실제로 **8파일**(`variant*` 가 4개 — `variant`·`variantButtonStable`·`variantHeldKey`·`variantStatusOrder`). 모두 지시 목록(`variant*`) 안.
- 지시에 없던 추가: 신규 시험 `task062SharedCancel`(세 서비스 정의 공유 가드) — 「세 서비스가 같은 정의를 쓰는지 확인」을 시험으로 고정. `requestCancel.ts` 머리 주석 정정(사실과 어긋나게 된 서술).
- `roomRender.test.ts`(279행)·`editorScroller.test.ts`(33행)도 소스를 읽지만 **지시 목록 밖이라 안 건드렸다**: `roomRender` 는 이미 `readCode` 를 쓰고 279행만 부정 단언을 의도적으로 원문으로 본다(주석에 쓴 근거). `editorScroller` 는 양성 단언 두 개(`<DraftEditor` 포함으로 화면 찾기, `overflow-y-auto` 상자 ≥1)가 원문 기준이라 주석 위장에 약하다 → 열린 질문.
- 실기기·QA 갈래(개발 서버 abort 소음 확인)는 이 단계 범위 밖. 미러 dev 서버 재현으로 대체 확인했다.
- 기본 미러·predeploy·타 `thekaiwa-*` 미러·포트 3010~3016 미접촉(다른 개발자의 `thekaiwa-dev061` dev 서버가 3016 을 쓰는 것을 확인하고 건드리지 않음). 내 dev 서버(3027)는 종료했고 probe 라우트는 미러 밖 스크래치로 옮겼다.

### 열린 질문 (Leader 판단)
1. `editorScroller.test.ts` 도 `readCode` 로 옮길까? (같은 약점, 변환 1~2줄, 위험 낮음.)
2. `isClientGoneNoise` 는 지시대로 `code === 'ECONNRESET'` 를 단독 갈래로 둔다 — 손님이 이미 끊긴 요청에서만 적용되지만, 그 요청 처리 중 **상류(게이트웨이·M4 등)** 의 ECONNRESET 이 났을 때도 로그가 빠진다(응답을 읽을 손님이 없으니 사용자 영향은 없음). reviewer 가 엄격히 볼 지점 — 문제 되면 `message === 'aborted'` 만 남기고 code 갈래를 `message` 와 AND 로 좁히는 안이 있다(현 재현에서는 둘이 함께 온다).
3. Next 개발 서버의 접근 로그는 끊긴 요청에 `POST … 200 in 50ms` 를 찍는다(Next 자체 출력, 우리 응답과 무관) — 손대지 않았다.

## Leader 추가 지시 (2026-10-12) — 처리 결과

### 1. `code === 'ECONNRESET'` 단독 갈래 제거
- `src/modules/infra/http.ts` `isClientGoneNoise`: `req.signal.aborted === true` **그리고** (`message === 'aborted'` 또는 `name === 'AbortError'`). `code` 갈래 삭제. 주석에 「상류 ECONNRESET 은 백엔드 장애 신호라 관측성을 유지」 근거를 적음. 실제 재현 모양(`message:'aborted'`+`code:'ECONNRESET'`)은 message 갈래로 그대로 잡힌다.
- 시험(`task062ClientGone.test.ts`, 8→9개) 갱신: ① 끊긴 요청 `message:'aborted', code:'ECONNRESET'` → 로그 0·500 봉투 그대로 · ② 끊긴 요청의 `code:'ECONNRESET'` 만(message `socket hang up`·`read ECONNRESET`·`connect failed`) → **로그 1회**(`Error: <message>` 문구까지 단언) · ③ 살아 있는 요청의 같은 오류(message+code 모양, code 만 모양, AbortError) → 로그 1회·응답 동일 · ④ 끊긴 요청 `name:'AbortError'`(Error 이름·DOMException)·`message` 만 → 로그 0. 「정확히 일치하지 않는 문구·code·이름」 시험에 「code 만 ECONNRESET」 추가.
- 변이 10건(`mutate2.py H`, 매번 원본 복사 후 `cmp` 동일 `True`) 전부 실패로 잡힘: H1 신호 조건 제거(③·신호 없음 실패) · H2 반전(4개 실패) · **H3 code 갈래 되돌림(② 실패 — 좁히기 보호)** · H3b message 갈래 제거(① 2개 실패) · H4 AbortError 갈래 제거(① ④ 실패) · H5 message 정확→포함 · H6~H9(`clientGone` 무시/항상/미전달/응답 변경).
- 실행 증빙(미러 `~/.node-local/thekaiwa-dev062`): `task062ClientGone`+`editorScroller`+`task062SharedCancel` → **16/16** · eslint(수정·신규 14파일) **exit 0** · `tsc --noEmit` **exit 0**(0줄) · 전체 시험 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` → **3371 tests · pass 3370 · fail 0 · skipped 1**(기존 skip, 111s) · `next build` **exit 0**(재빌드 전 이전 `.next` 는 미러 밖 스크래치로 이동).

### 2. `editorScroller.test.ts` 와 같은 부류 점검
- `src/components/scenario/__tests__/editorScroller.test.ts`: `readFileSync(…,'utf8')` → `readCode(…)`(33행 1곳, import 정리). 단언 의미 불변 — `classStrings`/`tokens` 판별기·4개 test 본문 0 수정. 변환 후 4/4 통과.
- 주석 처리 변이 2건(`mutate.py E`, 원본 복사·`cmp` 동일 `True`), **옛 시험(HEAD)은 4/4 통과(거짓 통과)·새 시험은 실패**: E1 `VariantDraftScreen` 의 `overflow-y-auto` 스크롤 상자 div 를 `{/* … */}` 로 위장하고 실제 div 는 `overflow-y-auto` 제거 → 새 시험 3 통과/**1 실패**(「스크롤 상자를 찾지 못함」) · E2 `VariantDraftScreen` 의 `<DraftEditor …/>` 를 `{/* */}` 로 → 새 시험 2 통과/**2 실패**(「DraftEditor 를 쓰는 화면으로 잡혀야 함」 외).
- 훑기 `grep -ln "readFileSync" src/components/scenario/__tests__/*.ts` 결과 (변환 전 2파일): `editorScroller.test.ts`(→ 변환함) · `roomRender.test.ts`(279행). `node:fs`·`readFile`·`require(` 로 확장해 다시 훑어도 같은 2파일뿐. **`roomRender.test.ts:279` 는 옮기지 않았다**: 같은 파일의 TalkRoom 읽기는 이미 `readCode`(257행)이고, 279행은 `TalkTutorBubble`·`useTalkPlayback`·`VoiceBar` 에 「scenario/rolePlay 참조 없음」을 보는 **부정 단언**이라 코드 주석에 이름이 있어도 실패하는 쪽(원문)이 더 엄격하고 주석 처리로는 없던 참조를 숨길 수 없다는 근거가 파일에 적혀 있다 — 주석 위장이 통과로 이어지는 양성 단언이 아니다. 이 task 로 `scenario/__tests__` 의 소스 원문 읽기는 `readCode` 9파일(8+editorScroller) + 의도적 원문 1곳(roomRender:279)이다. 다른 폴더(`talk`·`vocab` 등)는 점검·수정하지 않았다.
- 변경 파일 추가: `src/components/scenario/__tests__/editorScroller.test.ts`. (`http.ts`·`task062ClientGone.test.ts` 는 위 1번 갱신.)
