---
task_id: task-081
title: "task-081 developer 화면 갈래 ③a 기록 — 조각 단계 순수 논리·문구·재생 훅"
type: dev-record
tags:
  - type/task
  - domain/lesson
  - domain/ui
created: 2026-10-21
updated: 2026-10-21
---

# task-081 developer 화면 갈래 ③a (dev-081-ui3a)

> 이력서 [[task-081-improve-lesson-chunk-step]] · 서버 기록 [[task-081-dev-server1-record]] · 가이드 `docs/screens.md` §37-3·37-4·37-8·37-10·37-12-6·37-15·37-16·37-18-1 · 미러 `~/.node-local/thekaiwa-dev081u3a`(`make-mirror.sh` 로 생성). LLM 호출 0, 화면 컴포넌트 0.

## Developer 기록

- [15:05] **CP1 — 논리·문구·재생·진행 구현 + 새 시험 17/17.**
  - 완료 파일: `src/components/lesson/chunkLogic.ts`(새) · `lessonCopy.ts` · `useLessonPlayback.ts` · `useLesson.ts` · `__tests__/task081Chunk.test.ts`(새) · `__tests__/lessonLogic.test.ts:37`.
  - 주의점: 미러에 임시 확인 파일 하나를 `>` 로 새로 만들었다 바로 지움(새 inode — 하드링크 파일 덮어쓰기 아님, 남은 것 없음).
- [15:13] **CP2 — 갈래 ③a 완료(tsc·eslint·회귀·변이).**

### 변경 파일 (모두 미커밋)
| 파일 | 무엇을 |
|---|---|
| `src/components/lesson/chunkLogic.ts` (새) | 37-4-2 함수 전부(아래 표) — React·fetch 0, 엔진명 0 |
| `src/components/lesson/lessonCopy.ts` | 머리 주석 «§12-8·§37» · `STAGE_NAMES[2]='조각'` · `STAGE_COPULA`(새) · `stageLabel` 주석 · `PIECE_TYPE_ORDER`·`PIECE_TYPE_LABEL`(새, 6종) · `U3` 전체 교체. **`HOME`·`GEN`·`U2`·`U4`·`END`·`CHUNK_TYPE_*` 는 손대지 않음**(④ 소유) |
| `src/components/lesson/useLessonPlayback.ts` | `LessonAudioLine{kind,idx,sub?,pace}`·`lessonAudioBody`·`keyActive` export, `playLines` 가 `lessonAudioBody(l)` 로 본문을 만듦, `active` = `keyActive` |
| `src/components/lesson/useLesson.ts` | `Section` export + `'pieces'` 추가(`'quiz'` 는 남김 — 아래 결정 ④) · `patchOf` export + `pieces` 절 · 머리 주석 «응용 답» |
| `src/components/lesson/__tests__/task081Chunk.test.ts` (새) | 17 시험 |
| `src/components/lesson/__tests__/lessonLogic.test.ts` | 37행 `stageLabel(3)` 기대값 `'③ 문제'` → `'③ 조각'`(내 `STAGE_NAMES` 변경의 직접 결과, 한 줄) |
| `src/modules/speech/reading/client.ts` | **변경 없음**(export 추가 불필요 — 아래 결정 ②) |

### ③b·④ 가 가져다 쓸 내보낸 이름
| 파일 | 이름 | 시그니처 · 규칙 |
|---|---|---|
| `chunkLogic.ts` | `ChunkContent` | `{ dialogue: readonly { pieces?: readonly DialoguePiece[] \| null }[] }` — `LessonContent` 그대로 넘기면 됨 |
| 〃 | `PieceRange` · `CollectedPiece` | `{start,end}`(코드포인트) · `{type: PieceType, ja, ko: string, line, j}` |
| 〃 | `chunkMode(content)` | → `'none' \| 'lines'` |
| 〃 | `pieceRanges(pieces, lineJa?)` | → `PieceRange[] \| null` — `lineJa` 를 주면 이은 글 `!==` 원문이면 null(**정확히 같음** — NFC 만 같은 글도 null). **화면은 이 null 을 «조각 없는 줄»(⑦) 로 다룰 것** |
| 〃 | `pieceRuns(state, lineJa, pieces, showFu)` | → `RubyPiece[][]`(조각 순서, 늘 조각 수만큼·각 칸 ≥1) — 끔·대기·실패·분석 글 ≠ 원문·범위 null 이면 조각 글 그대로 |
| 〃 | `pieceHangul(segments, lineJa, pieces)` | → `(string \| null)[]` — type null 조각은 늘 null · 경계를 넘는 분석 조각이 걸친 조각 모두 null |
| 〃 | `pieceHangulLine(segments, lineJa, pieces)` | → `string \| null` — 예 `아따따까이 코-히-오 / 히또쯔 / 쿠다사이`(문장 한글 줄은 `… 코-히- 오 히또쯔 쿠다사이.`). 글 있는 조각 하나라도 null 이면 `hangulLine(segments)` |
| 〃 | `phraseIndexOf(pieces, j)` | → `number` |
| 〃 | `phraseText(pieces, k)` | → **`string \| null`**(가이드 표는 `string` — 서버와 같게 null: 없는 구간·문장부호뿐인 구간). 화면은 null 이거나 조각 글과 같으면 [구간 듣기]를 그리지 않음 |
| 〃 | `collectPieces(content)` | → `CollectedPiece[]` |
| 〃 | `pieceCount(content)` | → `number \| null`(종료 카드 N — ④ `endResultFrom` 에서 쓸 것) |
| 〃 | `pieceKey(line, j)` · `phraseKey(line, k)` | → `'piece:{line}:{j}'` · `'phrase:{line}:{k}'` |
| `useLessonPlayback.ts` | `LessonAudioLine` | `{ kind: AudioKind; idx: number; sub?: number; pace: AudioPace }` — `pb.playLines(pieceKey(i,j), [{kind:'piece', idx:i, sub:j, pace:'normal'}])` · 구간 `[{kind:'phrase', idx:i, sub:k, pace:'normal'}]` |
| 〃 | `lessonAudioBody(l)` · `keyActive(snapshot, key)` | 본문(`sub` 는 piece·phrase 이고 수일 때만) · `pb.active` 판정 |
| `useLesson.ts` | `Section` · `patchOf(p, sections)` | `st.update(p => ({...p, pieces: {seen}}), ['pieces'])` — 모아 보내기(800ms). `patchOf` 가 `seen` 을 중복 없이 오름차순으로 정리 |
| `lessonCopy.ts` | `STAGE_COPULA` · `PIECE_TYPE_ORDER` · `PIECE_TYPE_LABEL` | `readonly ['예요','이에요','이에요','이에요','예요']` · `readonly PieceType[]` · `Record<PieceType,{short,full}>` — ④ 의 `HOME.nextStage(n)` 은 `${stageLabel(n)}${STAGE_COPULA[n-1]}` |

### `U3` 문구 키 (가이드 37-8 글자 그대로)
`title` · `desc` · `descTextOnly` · `counter(i,n)` · `seen(k)` · `cardSr(i)` · `cardHead(role,i)` · `lineAria(i)` · `stopAria` · `tilesAria(n)` · `tilesAriaTextOnly(n)`★ · `tileSrTail(ko)` · `pick` · `pickTextOnly` · `pieceAria` · `playingSr` · `phrase(p)` · **`phraseLead`·`phraseTail`·`phraseStop`(더함)** · `aiNote` · `noPieces` · `prev` · `next` · `gate(k,n)` · `collect` · `collectCount(n)` · `group(label,k)` · `collectPlaySr` · `emptyTitle` · `emptyBody`.

### 결정과 근거
1. **`PIECE_TYPE_ORDER` 는 `lessonCopy.ts`**(가이드 37-8 «새 상수 (lessonCopy.ts)» 위치) — `chunkLogic` 이 거기서 import.
2. **조각별 한글 = `hangulLine(그 조각에 든 분석 조각들, 첫 조각의 boundary 만 null)`** — 문장 한글 줄과 같은 변환 함수를 묶음 단위로 부를 뿐이라 `reading/client.ts` 에 새 export 가 필요 없었다(파일 불변). 조각 첫 글자는 단어 머리로 적힌다(문장 줄에서 구분 없이 이어진 자리라면 자음이 다를 수 있음 — 조각 줄은 띄어 적으므로 수용).
3. **한글 줄 잇기**는 데모 `hgLine` 그대로(type null 조각은 글 없이 `slash` 만 « /», 끝 빗금 삭제) + 한 가지 보강: 빗금 바로 뒤 연결 조각은 붙이지 않고 한 칸 띄움(«… /を» 방지). 가이드 «한 조각이라도 null» 은 **글이 있는 조각**(type ≠ null)에만 적용 — 문장부호 조각은 한글이 없으므로(데모도 건너뜀).
4. **`Section` 의 `'quiz'` 는 남김**(지시대로) — `StageQuiz.tsx` 가 아직 `['quiz']` 를 씀. ③b 가 `StageQuiz` 를 지울 때 `Section`·`patchOf` 의 `quiz` 줄과 함께 뺄 것(코드 주석에 적음).
5. **`playLines` 의 `sub`**: 가이드 «sub 가 있을 때만» 에 더해 **kind 가 piece·phrase 일 때만** 싣는다(서버 `parseAudioBody` 가 다른 kind 의 `sub` 를 400 `not_allowed` 로 막으므로 잘못 넘겨도 요청이 깨지지 않게). 다른 kind 요청 바이트 불변(시험으로 고정).
6. **`collectPieces` 셈 기준 = 서버 `isPiece`**(ja 문자열·type null 또는 문자열) — 서버 `pieceCount` 와 숫자가 어긋나지 않게. 6종 밖 type 이 저장돼 있으면 순서 맨 뒤(화면 묶음엔 안 나옴 — 서버 검증상 생기지 않음).
7. **`pieceRuns` 는 분석 글(`segments` surface 를 이은 것)이 원문과 다르면 루비 없이** — 위치가 어긋난 루비를 그리지 않기 위해(JaText 는 이 검사를 하지 않지만 조각 경계 자르기는 위치가 맞아야 함).

### 실행 증빙 (미러 `~/.node-local/thekaiwa-dev081u3a`)
- `node --import tsx --test --test-concurrency=1 src/components/lesson/__tests__/task081Chunk.test.ts` → **17/17 통과**(범위·루비 자르기·한자 묶음 한가운데·한글 나누기·경계 넘는 분석 조각·`pieceHangulLine`·구간·**`pieceRuleCases.json` phrase 6건·count 5건 서버와 같은 기대값**·모아 보기·키·요청 본문·재생 키 판정(실제 `createTtsPlaybackQueue`)·`patchOf`·문구 3건·배선).
- 관련 기존 시험 15파일(`lesson/__tests__`·`lesson/review/__tests__`·이 파일들을 import 하는 시험) → 168 중 **165 통과·3 실패** — 3건 모두 옛 `U3` 키(문제 단계)를 보는 문제 시험: `task025.test.ts`(«문제 머리…» — `U3.legacyPrompt`) · `task025b.test.ts`(«안내 노트 문구…» — `U3.legacyNote`) · `review/__tests__/reviewRegression.test.ts`(«StageQuiz — variant…» — `U3.sumNote`). 문제 부속 삭제(37-13 ⑥)와 함께 지울 시험.
- `tsc --noEmit` → **내 파일 오류 0**. 남은 39건과 몫: `StageQuiz.tsx` 12(③b — 지움) · `lesson/logic.ts:319,327`(④ — `quizPromptView`·`quizSummaryPrompt` 지움) · `challenge/logic.ts:287,479`(④ — 서버 갈래 2 의 nullable) · `__tests__/task025.test.ts` 6 · `__tests__/task025b.test.ts` 15(④ — `logic.ts` 문제 함수 시험) · `review/__tests__/reviewRegression.test.ts:113,115` 2(④ review 소유, ③b 의 StageQuiz 삭제와 함께).
- eslint(변경 6파일) → 0 오류 0 경고 · 엔진명 grep(`git diff -U0 src/components/lesson` 추가 줄) → 0.
- **변이 시험 9/9 죽음**(임시 파일 + `os.replace` 후 원복, 원복 뒤 NFS 원본과 `filecmp` 9/9 같음, 스크립트 `scratchpad/dev-081-ui3a/mutate.py`): M1 `phraseText` 끝 문장부호 빼기 없앰 → 1 실패 · M2 모아 보기 키를 ja 로만 → 1 · M3 경계 넘는 분석 조각 허용 → 1 · M4 이은 글=원문 검사 없앰 → 1 · M5 다른 kind 에도 sub → 1 · M6 연결 조각도 띄움 → 1 · M7 `chunkMode` some→every → 2 · M8 seen 중복 제거 없앰 → 1 · M9 루비를 조각 경계로 나누지 않음 → 2.

### 가이드와 어긋난 곳
1. `phraseText` 반환 `string | null`(가이드 표 `string`) — 서버 함수·공용 픽스처가 null 을 쓴다.
2. `pieceRanges(pieces, lineJa?)` — 가이드 시그니처는 `pieceRanges(pieces)` 이나 «이은 글 ≠ 원문 → null» 규칙에 원문이 필요해 선택 인자를 더했다(빼면 누적만).
3. `U3` 에 `phraseLead`·`phraseTail`·`phraseStop` 를 더함 — `phrase(p)` 의 일본어 부분에 `lang="ja"` 를 주려면 글을 나눠 그려야 하고(37-8 «일본어 부분 lang=ja»), 재생 중 «■ 멈춤» 이 가이드 문장에만 있어 키로 뺐다. `phrase(p)` 는 가이드 그대로.
4. 한글 줄 잇기 보강(결정 ③ — 빗금 뒤 연결 조각).

### 한계
- 조각별 한글은 실제 분석 조각 모양(경계·발음)에 달려 있다 — 단위 시험은 손으로 만든 분석 조각이다. 실제 분석이 조사·문장부호를 앞 조각과 한 분석 조각으로 묶으면 그 줄은 빗금 없는 문장 한글 줄로 대신된다(정보 손실 없음). 실기기·QA 에서 빗금 줄이 얼마나 나오는지 확인 필요.
- 화면 부품이 없어 `pieceRuns` 결과를 실제 `JaText`/루비로 그려 본 것은 아니다(③b 몫).
- `useLessonPlayback` 훅 자체(React)는 시험하지 않았다 — 순수 부분(`lessonAudioBody`·`keyActive`)만.

### 다음 갈래에게
- **③b**: `StageQuiz.tsx` 삭제 때 `useLesson.ts` 의 `Section` `'quiz'`·`patchOf` 의 `quiz` 줄을 함께 지우고(내 파일이지만 지금 지우면 StageQuiz 컴파일이 깨져 남김), `reviewRegression.test.ts` 의 StageQuiz 시험도 정리 필요. 구간 버튼은 `phraseText(...)` 가 null 이거나 조각 글과 같으면 그리지 않는다(37-4-1).
- **④**: `lesson/logic.ts` 문제 함수 삭제 때 `task025*.test.ts` 의 문제 시험 정리 · `HOME.nextStage` 는 `STAGE_COPULA` 사용 · 종료 카드 N 은 `pieceCount(content)`.
