---
tags: [type/task-note, domain/vocab]
task: task-068
role: reviewer
---
# task-068 감사 C — 화면(U1·U2) + `wordEnrich@v2`(PE) (REV-068C)

이력서: [[task-068-improve-wordbook]] · 개발 기록 [[task-068-dev-u1-record]] · [[task-068-dev-u2-record]] · [[task-068-pe-record]]

## 최종 판정 (REV-068C) — PASS_WITH_NOTES

```json
{ "reviewId": "REV-068C", "status": "PASS_WITH_NOTES",
  "summary": { "critical": 0, "high": 0, "medium": 2, "low": 3 },
  "native_change": false }
```
Critical 0 · High 0 · Medium 2 · Low 3. `native_change: false`(`android/`·`plugins/`·`capacitor.config.ts`·Manifest 변경 0 — 감사 대상 파일 목록과 `git status` 로 확인). 7영역 중 이 감사 범위(화면·프롬프트)에 해당하는 아키텍처(엔진명·직접 fetch 없음)·학습 원칙(AI 산출은 초안만, 사용자 화면에 엔진명 0, `jlpt` 미전송)·보안(기본 단어 수정/삭제 단추·경로 없음)·성능(7개 쪽·`limit=7`)은 이슈 없음, 안정성에서 REV-068C-1·3.

| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-068C-1 | Medium | `wordsPaging.ts:178` | 쪽 넘기는 중 끼어든 「다시 읽기」가 실패하면 `paging` 에 갇힘(쪽 단추 셋 모두 흐림·회색 자리 고정) — 실행으로 확인 |
| REV-068C-3 | Medium | `WordsScreen.tsx` 배선 | 컨트롤러 배선 변이 10건 전부 생존(옛 응답 무시·삭제 뒤 다시 읽기 등은 QA 목록에도 없음) |
| REV-068C-2 | Low | `labels.ts:155` ↔ 프롬프트 | 「でも」 를 힌트·시드는 표현, 선생님 초안은 꾸밈(4/4) |
| REV-068C-4 | Low | `WordsScreen.tsx:479` | 안내 띠 ✕ 가 머리 줄 스크롤까지 일으킴 |
| REV-068C-5 | Low | `word-enrich-chunk-live.ts:28` | 기본 경로에 세션 /tmp 경로가 박힘 |

**권고 순서**: REV-068C-1 은 한두 줄(`settleWords` reload 실패 분기에서 `status==='paging'` 이면 `pageError`) + 시험 1건이다. 보조 확인으로 그 한 줄을 미러에 적용해 봐도 387건이 그대로 통과했다(변이 W17 — 원복, NFS 파일 변경 0). 고치면 Reviewer 부터 재순환하되 이 REV-068C-1 만 좁게 확인하면 된다. 나머지는 후속/QA 확인.

### 변이 결과 — 실행 27회(요청 9항목 = 10회 · 배선·보조 W1~W16 = 16회 · 수정 확인 W17 = 1회), 요청 9항목 전부 잡힘
요청 목록: ① 7→8 잡힘(10건 실패) ② `ceil`→`floor` 잡힘(4) ③ 쪽 번호 검증 완화(숫자 아닌 글자 지우기) 잡힘(T6) ④ 난이도 이름 칩 되살림 잡힘(3) ⑤ 「없음」 칩 되살림 잡힘(2) ⑥ 기본 단어 상세 [수정][삭제] 되살림 잡힘(T22) ⑦ `jlpt` 저장 본문(create/diffPatch 둘 다) 잡힘(각 2) ⑧ 조각 검사 제거 잡힘(T18) ⑨ `aria-disabled`→`disabled` 잡힘(T4). 
보조(W11~W16 6건 잡힘, W1~W10 10건 생존): W11 요청 `source` 고정 잡힘 · W12 조건 열쇠에서 조각 뺌 잡힘 · W13 초안 안내를 늘 붙임 잡힘 · W14 `BASE_DUPLICATE` 판별 제거 잡힘 · W15 안내 띠가 닫힘 표지를 무시 잡힘 · W16 `startEdit` 가드 제거 잡힘. **W1~W10(WordsScreen 배선)은 전부 생존 → REV-068C-3.** 모든 변이는 `~/.node-local/thekaiwa-rev068c` 안에서만, 매번 NFS 원본과 `cmp` 일치로 원복 확인(마지막에 감사 대상 6개 폴더 `diff -rq` 차이 0).

### 소유 밖 변경 (U1·U2·PE 소유 목록 가이드 28-8 A 대조)
- U 소유 목록에 없는 변경: `src/components/drawer/__tests__/{correctionsScreen,drawerParts}.test.ts`(prop 이름 `withNone`→`variant` 갱신 — 필요한 변경, 고정 문자열 유지). 결함 아님.
- PE: 소유 목록 밖 변경 없음(`wordEnrich.ts`·`wordEnrich*.test.ts`·`word-enrich*.json`·`word-enrich-chunk-live.ts` 만). `structuredResponse/*`·`tutor.md` 무변경.
- 참고(다른 담당 몫): `types/seedPack.ts`(S-B), `types/topic.ts`·`conversation/__tests__/task037.test.ts`(S-A), `task055drawer.test.ts`·`drawer.ts`(S-B2), `tests/live/*`(S-B), `package.json`(S-A 스크립트 추정).

### QA 에 넘길 high_risk_areas (실제 Next 라우터·실화면으로만 확인되는 것)
1. **쪽 경합·복구**(C-1·C-3 W1): 쪽을 넘기는 도중 앱을 백그라운드로 보냈다 돌아오기(화면 복귀 다시 읽기) · 네트워크 끊고 같은 동작 → 쪽 단추가 살아 있는지(오류 상자 [다시 시도] 나오는지) · 연타·빠른 두 쪽 이동에서 늦게 온 옛 응답이 화면을 덮지 않는지.
2. **삭제·보관 뒤 같은 쪽 다시 읽기 + 빈 쪽 보정**(W4·W5, J4): 마지막 쪽의 단어 1개일 때 지우면 앞 쪽으로 가는지·머리 줄 초점·쪽 줄 숫자.
3. **쪽 이동 시트**(W2·W7·W8, Q2): 숫자 키보드·`2000`/`0`/빈 칸 안내·같은 쪽 [이동]=닫기만·[마지막 쪽]·시트 닫힌 뒤 초점.
4. **D2 쪽 기억**(W3·W6, Q4): 상세/추가 시트 닫기→그 쪽, 조건 바꿈→1쪽, 다른 탭 갔다 오면 1쪽·출처 「전체」·정렬은 남음, 「최근 추가」에서 넣기→1쪽 맨 위 내 단어.
5. **쪽 도착 후 머리 줄 위치·초점**(W9, Q1) 및 **안내 띠 ✕ 가 화면을 끌어올리는지**(REV-068C-4).
6. **기본 단어 상세**: 수정·삭제 단추 없음·보관만, 개발자 도구로 #43·#44 를 기본 단어 id 로 보내면 403(Q6) — 화면은 단추를 안 그리므로 서버 쪽이 마지막 방어선.
7. **선생님 초안 조각**: 勉強·準備 → 액션 미리 선택, 「でも」 처럼 모호한 낱말에서 사용자가 칩을 바꿀 수 있는지(REV-068C-2), 칩을 바꾸면 안내가 사라지는지.
8. 360/390/412 × 라이트·다크: 조각 칩 줄 끝 「표현」 밀어서 보임 · 행 「내 단어」+「표현 조각」 두 뱃지에서 표제어만 줄임 · 폼 조각 칩 줄바꿈 · 쪽 줄 한 줄·44px · 마지막 쪽 빈 자리로 쪽 줄 위치 변화(QA Q1 ≤2px, 한글 줄 없는 행이 섞이면 실제 행이 숨은 행보다 낮아 흔들릴 수 있음).

## 감사 중 기록 (최종 판정의 근거)

확인 완료: C-1 쪽 조회 로직(`wordsPaging.ts`·`WordsScreen.tsx`·`WordsPager`·`WordsJumpSheet`·`BaseWordBand`) · C-3 폼·상세·행(`validate`·`WordForm`·`WordAddSheet`·`WordDetailSheet`·`WordRow`·`WordChunkPicker`) · C-2 필터/분류 칩(`labels`·`CategoryChips`·`ChunkChips`) · C-6 프롬프트(`wordEnrich.ts`, J12 스캔, 시험 26건 통과) · 기본선(c 미러에서 vocab 시험 88건 통과).
변이 요청 9건(+보조 1) 전부 잡힘, 컨트롤러 배선 변이 10건 전부 생존(REV-068C-3). tsc 0 · eslint 0(감사 대상 폴더) · vocab+shell+drawer 시험 387 통과. 남음: 최종 정리.

### 지금까지의 지적
- **REV-068C-1 (Medium) — 쪽 넘기는 중 「다시 읽기」가 실패하면 화면이 영원히 `paging` 에 갇힌다.** `wordsPaging.ts:178` — `settleWords` 가 `req.kind === 'reload'` 실패를 `state: s` 그대로 돌려주는데, 쪽을 넘기는 중(`status='paging'`)에 `reload` 가 끼어들면(`visibilitychange` → `reloadAll`, `WordsScreen.tsx:336-342`) `beginWords('reload')` 는 `paging` 을 그대로 두고(`:158-159`) 앞의 쪽 요청은 abort(`:299`) 되므로, 이 `reload` 가 실패하면 상태가 `paging` 으로 남는다. 증거: 변이 없이 실제 함수 실행 — ready → `beginWords('page')` → `beginWords('reload')` → `settleWords(reload 실패)` ⇒ `STATUS AFTER RELOAD FAIL = paging`. 결과: 회색 자리 7줄·쪽 단추 셋 모두 흐림(`wordsPagerView` 의 `busy`)·`ul aria-busy` 로 굳고, 조건을 바꾸거나 다른 탭에 갔다 오거나 화면 복귀로 다시 성공할 때까지 못 쓴다. 시험 구멍: `wordsPaging.test.ts:177-198` 의 「다시 읽기 실패」 단언은 `ready` 상태에서만 확인한다(`paging` 중 reload 실패 0건). 권고: `settleWords` 의 reload 실패 분기에서 `s.status === 'paging'` 이면 `pageError` 로 바꾸거나(쪽 오류 [다시 시도] 로 복구) `beginWords('reload')` 가 `paging` 을 `ready` 로 되돌리지 않게 하되 실패 때 `status` 를 직전 안정 상태로 복원 + 시험 한 건. [확실 — 실행 확인]
- **REV-068C-2 (Low) — 선생님 초안과 화면 도움말·시드가 「でも」 에서 서로 다른 조각을 말한다.** 폼 힌트(`labels.ts:155` `CHUNK_DEF.EXPRESSION.ex` = 「はじめまして · なるほど · でも」)와 S-A 재분류(이음말 = 표현)는 でも 를 표현으로 보는데, `wordEnrich@v2` 라이브 실측은 でも → MODIFIER 4/4(`word-enrich-chunk.json` baseline.knownMisses.c24). 실제 영향: 사용자가 「でも」 를 뜻 채우기로 추가하려 하면 기본 단어에 이미 있어(`BASE_DUPLICATE`) 거기서 막히므로 저장 경로로는 드물다. 다만 같은 계열의 이음말(예: 「けれども」 처럼 기본 단어에 없는 접속 표현)을 넣을 때 칩이 「꾸밈」으로 미리 골라지고 힌트에는 「이음말 = 표현」 이 적혀 있어 어긋난다. 사용자가 칩을 바꿀 수 있고(미리 선택일 뿐) 안내 문구가 「바꿀 수 있어요」 라 위험은 낮다. 권고: 프롬프트 한 줄에 「접속사(문장 앞에서 앞 말을 잇는 말)」 를 이음말에 덧붙이는 안(PE 기록이 이미 제시)을 후속으로 — 이번 배포 차단 아님. [확실 — 코드·픽스처]

- **REV-068C-3 (Medium) — `WordsScreen` 컨트롤러 배선을 지키는 시험이 없다(변이 10건 전부 생존).** 공용 `Sheet` 가 포털이고 `WordsScreen` 이 효과·요청 번호·시트 상태를 한 군데에 모은 클라이언트 컴포넌트라, 순수 함수(`wordsPaging.ts`)와 부품(`WordsPageList`·`WordsPager`·`WordsJumpBody`)만 시험되고 **배선은 시험 0**이다(task-067 REV-067A-1 과 같은 종류). 아래를 일부러 고쳐도 `components/vocab`+`shell`+`drawer` 시험 387건이 전부 통과했다(미러 `thekaiwa-rev068c`, 매번 NFS 원본과 `cmp` 일치 확인).
  - W1 `WordsScreen.tsx:286` 늦게 온 옛 응답 무시(`id !== reqRef.current`) 제거 · W2 쪽 이동 시트 `onGo` 가 `p + 1` 로 감(`:528`) · W3 단어 추가 뒤 `pageAfterAdd` 대신 늘 0쪽(`:494`) · W4 보관 뒤 다시 읽기 없음(`:511`) · W5 삭제 뒤 다시 읽기 없음(`:515`) · W6 상세를 닫으면 0쪽으로 보냄(D2, `:506`) · W7 가운데 단추 `onJump` 가 아무것도 안 함(`:420`) · W8 쪽 이동 시트에 `pages=1` · W9 쪽 도착 뒤 머리 줄 초점 제거(`:309`) · W10 [이전] 이 `page + 1`(`:418`). 
  - 가이드 28-9 의 QA 항목으로 덮이는 것: W2·W7·W8(Q2) · W3·W6(Q4) · W4(Q6) · W9·W10(Q1). **덮이지 않는 것: W1(옛 응답 무시), W5(삭제 뒤 같은 쪽 다시 읽기·J4 「쪽이 비면 앞 쪽」)** — Q 목록에 삭제 시나리오와 요청 경합이 없다.
  - 실패 시나리오: 리팩터링에서 위 줄 하나를 잘못 바꿔도 시험이 초록이라 사용자 폰에서 처음 드러난다. 권고: ① 순수 결정 함수로 뺄 수 있는 것은 빼서 시험(예: `request` 가 만드는 다음 `nav` — `navTo` 는 이미 시험됨 — 와 「시트 닫기는 nav 를 건드리지 않음」을 `reducer` 형으로) ② QA 에 W1·W5 를 명시 항목으로 인계(아래 high_risk_areas). [확실 — 변이 실행]
- **REV-068C-4 (Low) — 안내 띠 ✕ 를 누르면 화면이 머리 줄로 스크롤된다.** `WordsScreen.tsx:479` `onClosed={() => setFocusTick(...)}` 가 쪽 도착과 같은 효과(`:303-312`)를 타서 `scrollIntoView({block:'start'})` 까지 한다. 가이드 28-7 A 는 「안내 띠 ✕ → 초점 머리 줄」 만 정했고 스크롤은 쪽 넘김 한정(28-1 G). 맨 위에서 ✕ 를 누르면 검색·출처·조각 줄이 화면 밖으로 밀려 올라간다(사용자 의도 없는 스크롤). 권고: 띠 닫기와 삭제는 `focus({preventScroll:true})` 만. QA 확인 항목. [가능성 높음 — 코드 읽기, 실화면 미확인]
- **REV-068C-5 (Low) — 실측 스크립트 기본 경로에 이 세션의 /tmp 경로가 박혀 있다.** `tests/prompts/word-enrich-chunk-live.ts:28` `PE068_SCRATCH` 기본값이 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-…/scratchpad`. 다른 세션에서 돌리면 폴더가 없어 쓰기 실패. 권고: 기본값을 `os.tmpdir()` 아래로. 호출 상한(40)·`.env` 미접근·시험 파일(`*.test.ts`) 아님은 확인. [확실]

### 확인했고 문제 없음 (근거)
- C-1: `wordsPaging.ts` — `wordPages`(ceil) 7755→1108·7758→1109, `parseJumpPage` 엄격(`1.5`·`12a`·`0`·`1110`·빈 값 null, 전각 `１２`→11, `1,109`→1108; 가이드대로 NFKC 라 `①`(→1)도 받아들이지만 무해), `pagerView`·`fillerCount` 가이드 28-1 B 와 일치. 요청 번호(`reqRef`)+`AbortController`+조건 바뀌면 `navForKey` 로 1쪽, 시트 닫기는 `nav` 불변, 마운트 시 1쪽, 쪽 오류에는 옛 행을 그리지 않음(`WordsPageList` `shownRows = busy||failed ? 0`), 보정(`clamp`)은 한 번만(시험 T8), 쪽 단추 `aria-disabled`(변이 M9 잡힘), 터치 `h-11`.
- C-2: 난이도 이름 6개 정확 일치(`types/seedPack.ts:35`) · `visibleCategories` 이중 방어(변이 M4 잡힘) · 오늘 카드도 같은 `CategoryChips` · 「없음」 칩 없음(M5 잡힘) · 교정 모음 `variant="corrections"` 4칩·고정 문자열 시험 유지 · 출처 칩·안내 띠(`baseTotal` 읽음, 닫기 `kaiwa.words.baseBand`) 확인.
- C-3: `jlpt` 가 저장/수정 본문에 안 실림(`validate.ts` `toCreateBody`/`diffPatch`, 변이 M7a·M7b 잡힘) · 조각 꼭 고르기(M8 잡힘) · 초안 조각 미리 선택은 `draft.chunkType ?? presetChunk`(null/undefined 면 미리 고르지 않음) · `BASE_DUPLICATE` 는 `details.code` 로 판별(서버 `words.ts:200` 코드와 문자열 일치, W14 잡힘) · 기본 단어 상세는 단추 자체를 안 그림(M6 잡힘)+`startEdit` 가드(W16 잡힘) · 「내 단어」는 행에만, 「기본 단어」는 상세에만 · 넣기 UI 3곳·훅·문구·`seed-pack` 호출 소스 0건(T21 스캔 통과, `src` 전체 grep 으로도 확인) · 설정 도움말 `levelHelpText()` 가이드 문구.
- C-4: 엔진명 정규식(`reazon|whisper|style-bert|claude|ollama|qwen|sherpa|model_id|speaker_id|haiku|sonnet`) 대상 파일 0건 · 11px 미만 글자는 이번 변경 파일에 없음(기존 `ChallengeStrip` 10px 은 이번 변경 아님) · 새 색 0(토큰만) · 새 문구 28-1 H·28-2 G·28-4 F·28-5 D·28-6 E 와 `labels.ts` 대조 일치, 데모 문구와도 일치(`grep` 15개 문구 모두 데모에 존재).
- C-6: `wordEnrich@v2` 출력 스키마 `chunkType` 필수·null|5값 enum, valid=true 면 null 금지(`checkWordEnrichV2`)·valid=false 면 null, `extraCheck`·ajv 1회 재시도 계약 유지, 지시문 유형 정의가 28-3 A 와 같은 뜻, 길이 +308자(상한 2,000 이내), J12: 다른 프롬프트·스키마의 조각 enum 4값 그대로(소스 스캔+변이 시험, `tutor.md` EXPRESSION 0건), 시험 26건 통과.
- 데모 게이트: `check.mjs check --task` → `DEMO_GATE_PASSED`(v1 approved, hash `568bdb54…` verified), `evidence.jsonl` 40행 approve(2026-10-14 12:55:03, prompt 12:54:41, 이 세션) — 에이전트가 approve/waive 를 대신 실행한 흔적 없음.
