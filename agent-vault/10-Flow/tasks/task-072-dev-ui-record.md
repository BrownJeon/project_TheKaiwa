---
task_id: task-072
role: developer
title: "task-072 화면(UI) 구현 — 단어 추가 시트 「일본어 도우미」(가あ 버튼·인라인 패널·카드·처음 안내)"
created: 2026-10-17
tags:
  - type/task-record
  - domain/vocab
  - domain/ui
---

# task-072 Developer 기록 (화면 부분)

이력서: [[task-072-improve-word-add-helper]] · 서버 부분: [[task-072-dev-server-record]] · 서버 감사: [[task-072-rev-server-record]] · 설계: [[task-072-designer-record]] · 가이드 정본 `docs/screens.md` §30(13403~13835줄)

범위: 구현 순서 ⓪~⑦(§30-13). 데모 게이트 `DEMO_GATE_PASSED`(task-072, approved v1, hash verified). 네이티브·DB·환경변수·`package.json` 변경 없음(`native_change: false`). 커밋·푸시·배포 없음.

미러: `~/.node-local/thekaiwa-dev072-ui`(`thekaiwa-dev072-fix` 를 `cp -al` 한 뒤 `.next` 링크 제거 + 저장소 `src/`·`tests/`·`package.json` 동기화). 결과 파일만 저장소로 복사한다.

## Leader 결정 반영 (Q1~Q5)
- Q1 = A: 공용 `common/Sheet.tsx` Esc 한 줄(`!e.defaultPrevented`) — **공용 부품 변경**, 한 줄 고정 시험 추가.
- Q2 승인된 D7 문구 그대로(자기 [그만두기] 직후 409 는 알려진 한계 — 아래) · Q3 빈 결과 힌트에 새 문구 없음 · Q4 [다른 후보] 요약 칸 비움 · Q5 jsdom 없음(`package.json` 불변).

## 진행 (단계마다 추가)
- [01] ⓪ 데모 게이트 확인(`DEMO_GATE_PASSED`) · 미러 생성·동기화(UserWordState 724) · 정본 §30 전체·참조 코드(WordAddSheet·WordMicField·Sheet·talk 도우미 7개·useWordMic·시험 2개) 읽기 · `WordMicField` 기존 마크업 기준값 5종 추출(골든)
- [02] ① `vocab/wordHelperCopy.ts`(문구 단일 출처 — 같은 문장은 `HELPER` 참조) · `vocab/wordHelperLogic.ts`(순수 규칙) 신설 + `__tests__/wordHelperLogic.test.ts` 17건 통과. 문구는 승인 데모 HTML 과 글자 대조(함수 문구 3종 포함 전부 일치).
- [03] ② `vocab/WordMicField.tsx` 에 선택 prop `trailing?`·`afterLabel?` 추가(둘 다 없으면 DOM 바이트 동일). 슬롯 도입 전 마크업을 먼저 5종(닫힘·확인 안내+낭독·막힘·열림·예문 열림) 뽑아 두고 변경 뒤 `cmp` 로 **BYTE-IDENTICAL** 확인 → 골든으로 시험에 고정. 기존 `wordMicField.test.ts` 33건 그대로 통과.
- [04] ③ `WordHelperTip`·`WordHelperCard`·`WordPhraseHelper`(+`GHOST` 상수) 신설 + `__tests__/wordHelperRender.test.ts` 19건(골든 5종·슬롯 순서·패널 phase 10종·불변식 10 phase 전부 `<form` 0/모든 버튼 `type="button"`/스크롤 상자 0/라이브 영역 2줄·카드·안내 줄·엔진명 0).
- [05] ④ `useWordPhraseHelper`(요청 래퍼가 단어 규칙 실패를 지역 변수에 담고 `createHelperRequester` 에 맡김) · 결말 합치기 `wordHelperOutcomeOf`·소리 열쇠 `wordHelperSoundKey` 를 순수 모듈로 빼 시험(logic 19건). tsc 0 · eslint(vocab) 0 — 린트가 한 번 걸림: `helperQueryKeyDown(askNow)` 를 렌더 중 호출하면 `askRef` 를 렌더에서 읽는 것으로 오탐 → `onKeyDown={(e) => helperQueryKeyDown(() => askNow())(e)}`.
- [06] ⑤ **공용 부품 변경** — `common/Sheet.tsx` Esc 처리 한 줄: `if (e.key === 'Escape' && !e.defaultPrevented) onClose()` (WHY 주석 2줄 추가). 고정 시험: 소스 한 줄 + 그 처리기 본문을 가짜 이벤트로 실행(`defaultPrevented` 참이면 0회·거짓이면 1회·Enter 0회). `Sheet.tsx` 를 읽는 기존 시험(`scrollBoxPosition`·`removalA11y`)은 그대로 통과.
- [07] ⑥ `vocab/WordAddSheet.tsx` 배선: 훅 호출(`mic` 블록 바로 뒤) · 처음 안내 효과(ref 가드 `claimHelperTip`) · 렌더 중 이전 값 비교(말로 쓰기 새로 열림 → 판 닫기) · `toggleHelper`(`mic.target === 'surface'` 일 때만 `mic.close('surface')`) · `closeToButton` · `fillFromHelper` · 1단계 JSX(`trailing`·`afterLabel`·낭독 줄·패널) · `enrich()` 의 `abort()` 다음 줄에 `helper.cancelPending(); helper.close()` · [직접 입력하기]에 같은 두 호출. `__tests__/wordHelperWiring.test.ts` 14건. **기존 시험과 맞추려고 한 선택 두 가지**: ⓐ `wordMicField.test.ts` 가 `mic.edited(` 를 시트 소스에서 정확히 1번만 허용하고(`/mic\.edited\(/g` 길이 1) `mic.close()` 다음에 `abortRef…`·`setFromDraft(false)` 가 곧바로 오기를 요구하므로, 넣기 순서(edited → set → fill → focus)를 순수 함수 `fillSurfaceFromHelper`(logic)로 빼고 시트는 `edited: mic.edited` 로 넘기며, 도우미 호출은 `abort()` 뒤·`mic.close()` 앞에 끼웠다 → 그 시험 파일은 **한 글자도 안 고침**. ⓑ `removalA11y.test.ts` 가 파일 안 `describedBy=` 를 Sheet prop 으로 읽는 정규식이라 가あ 의 같은 이름 prop 은 `{...(tipShown ? { describedBy } : {})}` 펼침으로 넘김(그 시험의 허용 목록을 넓히지 않음).
- [08] ⑦ 확인 — 자기 미러 `~/.node-local/thekaiwa-dev072-ui`(저장소 `src/`·`tests/`·`package.json` 과 `diff -rq` 동일) 에서 아래 증빙. 정리 구간은 아래 §1~§7.

## 1. 실행 증빙 (명령 → 결과)
| 명령 | 결과 |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | exit 0, 출력 없음 (중간에 시험 파일 정규식 `s` 플래그 TS1501 1건 → 고쳐 재확인) |
| `eslint src/components src/modules/conversation tests/prompts` | **error 0**, warning 5 — 전부 이번에 건드리지 않은 기존 파일(`admin/trace/DiagnosticsScreen`·`settings/{Learning,OnDeviceDiagnostics,Speech,Voice}Settings` 의 `set-state-in-effect`). 내 파일 0건 |
| 새 시험 3파일 (`wordHelperLogic` 19 · `wordHelperRender` 19 · `wordHelperWiring` 14) | 52건 통과 |
| 기존 `wordMicField.test.ts` (한 글자도 안 고침) | 33건 통과 |
| **전체 시험** `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` | tests 4,263 · pass 4,261 · **fail 0** · skipped 2 (228초) |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | **0** (경고 3개는 기존 `persona/loader.ts`·`claudeCli.ts` 의 「동적 파일 접근」 — 내 파일 무관). 빌드된 CSS 에 새 클래스 20여 개(`w-[min(100%,236px)]`·`before:border-b-ink`·`h-[104px]`·`aria-disabled:opacity-40`…) 생성 확인 |
| `git diff --stat -- src/components/talk` / `-- package.json` | 둘 다 **빈 출력**(무수정) |
| 엔진명 grep (새 6파일, 시험 포함) | 0건 (`reazon|whisper|style-bert|claude|haiku|sonnet|opus|qwen|sherpa|speaker_id|model_id`) |

중간에 시험이 잡은 것 한 건: 전체 시험 직전 `removalA11y.test.ts`(Sheet 호출처 시험)가 `WordAddSheet.tsx` 안 `describedBy=` 를 **시트 prop 으로 오탐**해 실패 → 가あ(`PhraseHelperButton`)의 prop 을 펼침 객체로 넘겨 해결(그 시험의 허용 목록은 안 넓힘).

## 2. 변경 파일 (코드 12 + vault)
| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/common/Sheet.tsx` | 수정 · **공용 부품 변경** | Esc: `if (e.key === 'Escape' && !e.defaultPrevented) onClose()` + WHY 주석 2줄 |
| `src/components/vocab/WordMicField.tsx` | 수정 | `trailing?`·`afterLabel?` 슬롯(없으면 DOM 바이트 동일). 토글 버튼을 `toggle` 변수로 뺌 |
| `src/components/vocab/WordAddSheet.tsx` | 수정 | 배선 +67줄(§[07]) |
| `src/components/vocab/wordHelperCopy.ts` | 새 | 문구 단일 출처 `WORD_HELPER` |
| `src/components/vocab/wordHelperLogic.ts` | 새 | 순수 규칙 17종 + `WORD_HELPER_IDS` |
| `src/components/vocab/useWordPhraseHelper.ts` | 새 | 상태 훅(#181, 메모리만) |
| `src/components/vocab/WordPhraseHelper.tsx` · `WordHelperCard.tsx` · `WordHelperTip.tsx` | 새 | 패널 · 카드 · 처음 안내 줄 |
| `src/components/vocab/__tests__/wordHelper{Logic,Render,Wiring}.test.ts` | 새 | 52건 |
| 이 기록 · 이력서 「상태 로그」 한 줄 · `20-Log/2026-10-17.md` 한 줄 | vault | |

**공용 부품 변경(Leader Q1=A) 영향 조사 — [확실]** `'Escape'` 전수 grep(2026-10-17): 앱에서 Esc 에 `preventDefault` 하는 곳은 ⓐ 새 패널(`panelEscapeKeyDown`) ⓑ `talk/PhraseHelperButton`(열린 가あ — 회화방과 이 시트 둘 다) ⓒ `talk/phraseHelperLogic.closeOnEscape`(회화방 판 — 시트 아님) ⓓ `speech/PushToTalkButton`(`cancelOutside` 가 있을 때 녹음 중 Esc). ⓓ 의 `cancelOutside` 는 `ask/useAskInput`(질문 탭 입력) 한 곳만 넘기고, 그 입력은 `Sheet` 안이 아니다(`AskNewConversation` 의 `Sheet` 는 메뉴 시트이고 입력과 형제). `WordMicField` 의 마이크 버튼은 `cancelOutside` 를 안 넘긴다 → **Esc 동작이 바뀌는 기존 시트 경로 없음**. 남는 미세 변화: 질문 탭 메뉴 시트를 연 채 녹음 중 Esc → 전에는 녹음 취소 + 시트 닫힘, 이제는 녹음 취소만(Leader 가 「의도에 가까움」으로 판단한 것과 같다).

## 3. 결정과 근거
1. **훅이 `askDisabled`·`rateLeft`·`rateWaiting`·`msg` 까지 계산해 돌려준다**(`useCountdown` 이 훅 안). 가이드 30-10 반환 목록은 `askDisabled` 를 훅 몫으로 적어 두었고, 이렇게 해야 렌더 시험이 `Date.now()` 없이 값을 직접 줄 수 있다.
2. **넣기 순서를 순수 함수 `fillSurfaceFromHelper`(logic)로 뺐다**: 기존 `wordMicField.test.ts` 가 `WordAddSheet.tsx` 안 `mic.edited(` 를 정확히 1번만 허용(직접 입력 경로 고정)하기 때문에 시트에는 `edited: mic.edited` 로 넘긴다. 부수 이득 — 순서(안내 거둠 → 값 → 판 닫기 → 초점)와 「다음 행동 안 부름」이 가짜 함수로 실제 실행 시험된다.
3. **도우미 취소·닫기 위치** — 가이드는 「`mic.close()` 옆」. 기존 시험이 `return}mic.close()abortRef.current?.abort()` 연속을 고정하므로 `abort()` 바로 뒤에 둔다(순서: 검증 통과 → `mic.close()` → 이전 뜻 찾기 `abort()` → `helper.cancelPending()` → `helper.close()` → 새 요청). [직접 입력하기]는 `mic.close()` 앞(그 시험은 `mic.close()setFromDraft(false)` 연속만 고정).
4. **실패 합치기 `wordHelperOutcomeOf`**: 수명주기 컨트롤러가 알린 결말 중 시간 초과만 믿고 나머지는 요청 래퍼가 단어 규칙으로 가른 값을 쓴다(없으면 오류) → talk 파일 수정 0, 회화방 동작 불변.
5. **카드의 `GHOST` 상수는 `WordHelperCard` 에서 export 해 패널이 쓴다**(같은 값 한 곳).

## 4. 변이 점검 (20/20 잡힘, 기준 실패 0)
별도 작업 디렉터리(`~/.node-local/thekaiwa-dev072-uimut`, `node_modules` 읽기 전용 링크)에서 한 번에 한 파일씩 고쳐 새 시험 3파일 + `wordMicField.test.ts` 를 돌리고 매번 원본으로 되돌렸다.
| # | 변이 | 잡은 시험 |
|---|---|---|
| M01 | `Sheet` 에서 `!e.defaultPrevented` 제거 | wiring(Sheet 한 줄 + 처리기 실행) |
| M02 | 패널 [물어보기]를 `type="submit"` 으로(함정 ①ⓒ) | render 5건 + wiring |
| M03 | 질의 칸 Enter 의 `preventDefault` 제거(함정 ①ⓑ) | logic |
| M04 | 판 안 Esc 의 `preventDefault` 제거(함정 ②) | logic |
| M05 | 가あ 열기에서 `mic.target === 'surface'` 조건 제거(함정 ⑨) | wiring |
| M06 | 슬롯 없어도 감싸는 상자를 그림(DOM 동일성) | render 3건(골든) |
| M07 | `enrich` 검증 앞에서 도우미 취소(함정 ③) | wiring 2건 |
| M08 | [직접 입력하기]의 도우미 취소 제거 | wiring |
| M09 | 패널에 `overflow-y-auto` 추가(함정 ⑥) | render 3건 |
| M10 | 409 `PHRASE_BUSY` 를 일반 오류로(D7) | logic |
| M11 | 넣기에서 `edited` 누락(함정 ⑨) | logic + wiring |
| M12 | 요청 본문에 `mode` 키(함정 ⑫) | wiring |
| M13 | 보낸 뒤 `blur()`(초점 누출) | wiring |
| M14 | 카드가 `labelKo` 를 그림(L-4) | render + wiring |
| M15 | 처음 안내에 별도 저장 키(D6) | wiring |
| M16 | 한글 없음도 흐림 처리(Q5) | logic |
| M17 | 말로 쓰기 새로 열림 비교를 효과로 대체(함정 ④) | wiring |
| M18 | 패널 id 변경(`aria-controls` 불일치) | render + wiring |
| M19 | 요청 래퍼의 실패 분류 제거 | wiring |
| M20 | 패널 `onKeyDown` Esc 처리 제거 | wiring |

## 5. 가이드(§30)와 다른 점
**화면 모양·문구·동작 의미는 같다(변경 없음).** 구현 구조만 아래가 다르다.
1. §3 의 1~5 (훅 반환 확장 · `fillSurfaceFromHelper` · 취소 위치 · 결말 합치기 · `GHOST` export).
2. 순수 함수 `wordHelperApply`·`wordHelperOutcomeOf`·`wordHelperTipShown`·`wordHelperSoundKey` 를 `wordHelperLogic.ts` 에 더했다(가이드 목록 밖, 시험 가능하게 뺀 것).
3. 가이드 30-14 ③ 의 「`mic.edited('surface')` → `set('surface'` → `surfaceRef` 초점」 소스 스캔은 `fillSurfaceFromHelper` 본문 + 시트의 `fillFromHelper` 호출 인자 두 곳에서 본다.
4. `PhraseHelperButton` 의 `describedBy` 는 펼침 객체로 넘긴다(§1 말미 사유).
→ **screens.md 를 고쳐야 할 것은 없다.** (고칠 권한도 없다.)

## 6. 알려진 한계
- **jsdom 이 없어 Enter 암묵 제출 차단·Esc 로 시트가 안 닫힘·초점 이동·키보드 내림·서로 닫기는 실제 클릭으로 못 돌렸다.** 순수 함수 + 정적 렌더 + 소스 스캔 + 처리기 본문 실행으로만 고정했다 → **QA 가 실제 Next 라우터 브라우저에서 반드시 확인**(W3·W4·W5·W6·W14).
- **Esc 처방 A 는 「React 의 `document` 리스너가 `Sheet` 의 리스너보다 먼저 등록돼 있다」는 순서에 기댄다**(둘 다 `document` 의 버블 단계). 정본이 읽은 `hydrateRoot(document, …)` 구조라 [가능성 높음]이지만 이 세션에서 브라우저로 직접 확인하지 못했다(QA W6 — 패널 안·가あ 에서 Esc 시 시트가 닫히면 이 가정이 틀린 것이고, 그때는 대안 B 또는 `Sheet` 리스너를 capture 로 옮기는 별도 결정이 필요).
- **자기 [그만두기] 직후 다시 물으면 몇 초 동안 409 `PHRASE_BUSY`**(서버 잠금이 취소된 요청의 AI 호출 차례가 올 때 풀림, Q2) → 「다른 화면에서…」 문구가 틀리지만 [다시 시도]로 풀린다. Leader 결정대로 문구는 D7 그대로.
- **처음 안내 플래그 양방향 공유**(D6, 사용자 수용): 회화방 안내를 본 프로필은 단어 시트 안내가 안 뜬다.
- 시각 자체 점검(세 폭·다크·글꼴 130%·키보드)은 브라우저 기동 금지라 못 했다. 대신 빌드된 CSS 의 클래스 생성과 정적 마크업(구조·`min-w-0`·터치 크기 클래스)만 확인 — 폭 계산은 데모 실측(§30-17)과 같은 클래스 값에 기댄다.
- 질문 탭 메뉴 시트를 연 채 녹음 중 Esc: 이제 녹음 취소만(§2).

## 7. QA 가 볼 곳 (서버 `http://localhost:3011` — 기동은 QA 몫)
§30-15 W1~W15 전부, 특히:
1. **W4 Enter** — 패널 질의 칸 Enter·키보드 「검색」 키가 [뜻 채우기]를 부르지 않음(네트워크에 `/api/v1/words` POST 0), 표현 칸 Enter 는 지금처럼 [뜻 채우기](패널이 열린 채로도). IME 조합 중 Enter.
2. **W6 Esc** — 패널 안·가あ(열림) Esc → 패널만 닫힘 + 초점 가あ / 패널 닫힘·표현 칸 Esc → 시트 닫힘 / 다른 시트들 Esc 닫기 회귀 없음.
3. **W5 서로 닫기** — 말로 쓰기 열림(녹음 중 포함) → 가あ / 패널 열림 → 말로 쓰기 / 마이크 막힌 환경에서 토글 눌러도 패널 유지 / 찾는 중 [뜻 채우기]·[직접 입력하기] / 빈 표현 [뜻 채우기]는 패널 그대로 / **073 확인 안내**: 말로 쓰기 결과 → 가あ 열고 닫아도 안내 유지 → [표현 칸에 넣기] 하면 사라짐(W10).
4. **W14 초점·키보드(실기기)** — 보낸 뒤 `document.activeElement` 가 [물어보기], 키보드 내려감, 360×780 + 키보드에서 질의 칸이 보임, 패널 안 스크롤 상자 0.
5. **W7 처음 안내** — 새 프로필에서 한 번만, ✕/가あ 로 닫힘, 회화방 양방향.
6. **W8/W9** — 400(`<임팩트>` → 서버 문구)·409·429·오프라인·502·12초 / 「감사합니다」(서버 보완 뒤 빈 결과) 에서도 질의 칸·표현 칸·[직접 입력하기] 사용 가능.
7. **W13** — `git diff -- src/components/talk` 0줄, talk 시험 무수정 통과, 회화방 도우미 실화면 한 번.
