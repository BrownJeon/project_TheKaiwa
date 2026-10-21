---
task_id: task-081
title: "task-081 developer 화면 갈래 ③b 기록 — 조각 단계 컴포넌트 + «문제» 화면 제거"
type: dev-record
tags:
  - type/task
  - domain/lesson
  - domain/ui
created: 2026-10-21
updated: 2026-10-21
---

# task-081 developer 화면 갈래 ③b (dev-081-ui3b)

> 이력서 [[task-081-improve-lesson-chunk-step]] · ③a 기록 [[task-081-dev-ui3a-record]] · 서버 기록 [[task-081-dev-server1-record]] · 가이드 `docs/screens.md` §37-3·37-4·37-7·37-9·37-10·37-11·37-15·37-18-1 · 미러 `~/.node-local/thekaiwa-dev081u3b`(`make-mirror.sh` 로 생성). LLM 호출 0, 브라우저·dev 서버 0, 커밋·푸시·배포·DB 쓰기 0.

## Developer 기록

- [15:18] **CP1 — 부품 3파일·LessonScreen 배선·StageQuiz 삭제 완료, tsc 내 파일 0.**
  - 주의점: `git rm --cached` 를 한 번 실수로 실행했다가 즉시 `git restore --staged` 로 되돌림 — 인덱스 변화 0 확인(`git diff --cached --stat` 빈 값). StageQuiz 는 작업트리에서만 지움(원본 사본 `scratchpad/dev-081-ui3b/StageQuiz.tsx.bak`).
- [15:24] **CP2 — 갈래 ③b 완료(렌더 시험 18·변이 10/10·eslint 0·tsc 내 파일 0).**

### 변경 파일 (모두 미커밋)
| 파일 | 무엇을 |
|---|---|
| `src/components/lesson/ChunkSentence.tsx` (새) | `ChunkSentenceCard`·`PieceTiles`·`PieceStrip`·`PieceHangulLine`·`ChunkEmpty` + 보조 `PIECE_TONE`(종류별 밑줄·띠·뱃지 토큰)·`usablePieces(line)`·`tileUnits(pieces)` |
| `src/components/lesson/PieceCollect.tsx` (새) | `PieceCollect`(default, 접힘 상자) + `PieceCollectList`(펼친 본문 — 시험용으로 분리 export) |
| `src/components/lesson/StageChunk.tsx` (새) | 37-3 전체 + `firstChunkLine(n, seen, reviewing)` export |
| `src/components/lesson/LessonScreen.tsx` | `stage === 3` → `<StageChunk … pb={pb} …/>` · `StageQuiz` import 제거·`StageChunk` import · `st.replace` 의 `score: r.lesson.score ?? null` · 머리 주석 «§12-8·§37»(③ 문구 variant 언급 제거). **`complete()`/`EndResult` 는 손대지 않음**(④) |
| `src/components/lesson/StageQuiz.tsx` | **삭제** |
| `src/components/lesson/useLesson.ts` | `Section` 에서 `'quiz'` 제거(+③a 가 남긴 주석) · `patchOf` 의 quiz 줄 제거. 머리 주석 «응용 답» 은 ③a 가 이미 고침 |
| `src/components/lesson/__tests__/task081ChunkUi.test.ts` (새) | 18 시험 |
| `src/components/lesson/__tests__/display.test.ts` | B 파일 목록 `StageQuiz` → 새 3파일 · 도구 줄 키 시험 ③ = `['fu','hg','tr']`(StageChunk) · «StageQuiz 정적» 시험 1개 삭제(`quizPromptLayerState` 순수 시험은 `logic.ts` ④ 소유라 남김) |
| `chunkLogic.ts`·`lessonCopy.ts`·`useLessonPlayback.ts` | **변경 없음**(요청할 export 없음) |

### 결정과 근거
1. **모든 줄 null 인 새 수업 판정** — `chunkMode`(③a)·서버 `pieceCount` 는 «배열 없음» 을 모두 'none'/null 로 본다. 가이드 37-3-1 은 그 경우 빈 상태가 아니라 줄마다 «나누지 못했어요» 를 요구하므로 `StageChunk` 가 `oldLesson = chunkMode(c)==='none' && !dialogue.some(d => d.pieces === null)` 로 가른다(옛 수업 = 키 없음, 새 수업 실패 줄 = 키 null — 서버 `toStoredContent` 가 빠진 줄을 null 로 저장). chunkLogic 은 그대로(서버와 같은 규칙 유지). **④ 참고**: 이 수업의 종료 카드 N 은 `pieceCount` = null → 2칸(서버 #58 `pieces` 도 null)이라 화면·서버가 어긋나지 않는다. 모아 보기는 0개면 상자째 그리지 않는다.
2. **«조각 없는 줄» = `usablePieces(line) === null`** — 키 없음·null·빈 배열·이은 글 ≠ 원문(`pieceRanges(pieces, line.ja)` null, ③a 인계대로) 모두 ⑦ 화면. Q10 고지(`aiNote`)도 같은 판정으로 숨김.
3. **본 문장 저장** — [다음 문장]으로 처음 간 문장만 `seen` 에 더하고 `st.update(p => ({...p, pieces:{seen: 정렬}}), ['pieces'])`(모아 보내기, `immediate` 없음). 여는 순간의 지금 문장은 화면 `seen` 에만 넣고 저장하지 않는다(가이드는 이동 때만 저장 — 다시 열면 같은 문장부터라 손실 없음). **다시 보기(`reviewing`)는 쓰지 않는다**(① 과 같은 규칙 — 가이드에 명시 없음).
4. **초점** — 마지막 문장 도착 = `footerRef` 첫 버튼(가이드 37-3). 더해서 **[이전 문장]으로 첫 문장에 도착하면 사라지는 [이전 문장] 대신 [다음 문장]으로** 옮긴다(같은 이유 — 가이드에 없던 경우, `data-chunk-next` 로 찾음. `Btn` 이 ref 를 받지 않아 컨테이너 querySelector).
5. **재생** — 칸 누름 = `onPick(j)` + (소리 있음) 그 조각 토글(같은 칸 재생 중이면 멈춤). 카드 머리 ▶ = 줄 다시 듣기(`playLineReplay(pb, i, 'normal')`, ① 과 같은 `line:{i}` 키 — 새 kind 아님, ③ 은 ① 을 끝낸 뒤라 보통 속도). 실패 토스트는 `pb` 그대로. 카드 머리 ▶·조각 ▶ 은 `parts.PlayButton`(37-9 클래스와 같음, `U2.stopAria`=`U3.stopAria`='멈추기').
6. **고른 조각 줄의 읽기·[한글]** — 읽기는 히라가나 켬 + 조각에 한자 + 루비 읽기를 구했을 때만, [한글]은 한글 켬 + `pieceHangul` 값이 있을 때만(표시 스위치를 따름 — 가이드에 스위치 관계 명시 없음).
7. **재생 상태 `role="status"`** — 카드 안 고정 sr-only 1개(조각·구간 재생 중 «듣는 중», 아니면 빈 글). 줄 다시 듣기는 버튼 이름(«멈추기»)으로만 알린다.
8. **구간 듣기 버튼** — `PlayWide` 는 `label: string` 이라 일본어 부분 `lang="ja"` 를 못 넣어 같은 클래스로 직접 그림(`U3.phraseLead`·`<span lang="ja">`·`phraseTail`, 재생 중 `phraseStop`). 긴 구간이 360 폭을 넘지 않게 `h-11` → `min-h-11 max-w-full` + 줄바꿈 허용(PlayWide 와 다른 점).
9. **칸 루비 줄간격** — 문장 단위로 맞춘다(히라가나 켬 + 분석 대기/완료 + 문장 조각 중 한자 있음 → 모든 칸 `line-height 2.15`). 칸마다 다르면 `items-end` 로 묶인 칸들의 글자 기준선이 어긋나서.
10. **문장부호 칸** — 앞 칸 꼬리 묶음에 붙이고, 문장 앞머리 문장부호(「 등)는 다음 칸 묶음 앞에 붙인다(`tileUnits` — 줄 끝에 여는 괄호가 홀로 남지 않게). 빗금은 `slash` 조각 바로 뒤, 같은 묶음.

### 실행 증빙 (미러 `~/.node-local/thekaiwa-dev081u3b`)
- `node --import tsx --test --test-concurrency=1 src/components/lesson/__tests__/task081ChunkUi.test.ts` → **18/18 통과**(tileUnits 4모양 · 칸 버튼 5·`aria-pressed` 1/4·빗금 1·문장부호가 버튼 밖 `aria-hidden` · 빗금이 앞 칸 꼬리 묶음 안 · 카드 머리 `aria-live` 1·`role="status"` 1·sr-only 문장 · 고른 조각 줄(뱃지·뜻·▶·구간 「あたたかいコーヒーを」)·재생 중 «듣는 중»·멈추기·구간 재생 중 «■ 멈춤» · 구간=조각이면 구간 버튼 없음 · 소리 없음 ▶ 0(버튼=칸 5개뿐) · null 줄·이은 글≠원문 줄 ⑦ · `firstChunkLine` · c-new(게이트·footer 없음·모아 보기 7개 닫힘) · c-last·c-review(다 안 봐도 footer) · null 줄 고지 숨김·모든 줄 null 새 수업 = 줄마다 알림(빈 상태 아님)·모아 보기 없음 · c-old 빈 상태+footer · 모아 보기 접힘/`aria-controls`/0개면 없음 · 종류 순서 6종·«はい» 한 번·소리 있음 버튼 7/없음 0 · 배선(StageChunk·StageQuiz 없음·Section quiz 없음·piece/phrase+sub·pieces 절·다시 보기 미저장) · 경계(엔진명·fetch·Capacitor·16진 색 0)).
- 관련 시험 20파일(`lesson/__tests__/*`·`lesson/review/__tests__/*`·lesson 부품을 import 하는 시험) → **211 통과·3 실패**(아래 «④ 몫» 3건뿐 — 모두 ③a 때부터 실패하던 것 + reviewRegression 은 파일 통째).
- `tsc --noEmit` → **내 파일 오류 0**. 39 → **28**(StageQuiz 12 사라짐, reviewRegression import 1 새로 생김). 남은 28 = `challenge/logic.ts:287,479`(2, ④) · `lesson/logic.ts:319,327`(2, ④) · `review/__tests__/reviewRegression.test.ts:17,113,115`(3, ④) · `__tests__/task025b.test.ts`(15, ④) · `__tests__/task025.test.ts`(6, ④).
- eslint(변경 7파일) → 0 오류 0 경고 · 엔진명 grep(`git diff -U0 src/components/lesson` 추가 줄 + 새 3파일 전체) → 0.
- **변이 시험 10/10 죽음**(미러 파일을 임시 파일 + `os.replace` 로 바꾸고 원복, 원복 뒤 NFS 원본과 `filecmp` 10/10 같음, 스크립트 `scratchpad/dev-081-ui3b/mutate.py`): M1 문장부호도 버튼 → 3 실패 · M2 문장부호를 앞 칸에 안 붙임 → 1 · M3 다시 보기에서도 게이트(처음엔 살아남음 → 시험 보강 «다시 보기 + 본 문장 0» 후 1) · M4 구간=조각이어도 버튼 → 1 · M5 머리 `aria-live` 제거 → 1 · M6 소리 없음에도 줄 ▶ → 1 · M7 모아 보기 순서 뒤집음 → 1 · M8 모든 줄 null 새 수업을 빈 상태로 → 1 · M9 다시 보기에서도 진행 쓰기 → 1 · M10 이은 글≠원문 검사 제거 → 1.

### ④ 몫으로 남긴 시험·참조 (건드리지 않음 — 지시)
- **`src/components/lesson/review/__tests__/reviewRegression.test.ts` — 파일 전체가 실행되지 않는다**(`Cannot find module '../../StageQuiz'` → 14 시험 모두 못 돎, 이전엔 13 통과·1 실패). 고칠 곳: 17행 import·109~116행 «StageQuiz — variant» 시험, 14행 `U3` import 의 옛 키 사용. **④ 가 먼저 이 두 곳을 지워야 나머지 13개 복습 회귀 시험이 다시 돈다**(위험 — 그 사이 복습 화면 회귀를 못 잡음).
- `__tests__/task025.test.ts` «문제 머리…»(`U3.legacyPrompt`) · `__tests__/task025b.test.ts` «안내 노트 문구…»(`U3.legacyNote`) — ③a 때와 같은 실패.
- 주석에만 남은 `StageQuiz`: `src/components/lesson/logic.ts:371`(④) · `src/types/lesson.ts:183`(④) · `src/modules/conversation/prompts/lesson.ts:79`(PE, 역사 기록 주석).

### 가이드와 어긋난 곳
1. 37-3 의사코드의 `mode === 'none'` 빈 상태 → 실제 판정은 «`pieces` 키가 하나도 없음»(결정 1 — 37-3-1 을 지키려고).
2. 부품 props 에 없는 export 를 더함: `usablePieces`·`tileUnits`·`PIECE_TONE`(ChunkSentence) · `PieceCollectList`(PieceCollect) · `firstChunkLine`(StageChunk) — 시험·공유용, 기존 props 는 표 그대로. `PieceTiles` 의 `showFu` 는 «루비 자리를 둘지»(히라가나 켬 + 분석 대기/완료) 뜻으로 받는다.
3. 구간 듣기 버튼 높이 `h-11` → `min-h-11` + 줄바꿈(결정 8).
4. 첫 문장 도착 초점 이동(결정 4) — 가이드에 없던 경우.

### 한계
- 서버 렌더(`renderToStaticMarkup`) 시험이라 표시 설정이 늘 «로드 전»(히라가나·한글·번역 끔, 분석 `off`) — 루비가 칸에 실제로 그려지는 모습·한글 줄 빗금·번역 줄·클릭/초점 이동·재생 토글은 실행으로 확인하지 못했다(QA·실기기 몫).
- 360·130% 가로 넘침·780 높이 첫 화면 위치(37-11)는 측정하지 않았다(브라우저 금지).

### reviewer 가 볼 곳
- `StageChunk.tsx` `oldLesson` 판정 · `move()`(stop·sel 해제·seen 추가·다시 보기 미저장·초점 플래그) · `canNext`.
- `ChunkSentence.tsx` `usablePieces`·`tileUnits`(앞머리 문장부호·문장부호 slash) · `PieceTiles` 버튼/`aria-hidden` 분리 · `ChunkSentenceCard` 의 `picked`(type null 칸은 고를 수 없음)·`phrase`(같으면 null)·`playing`·고정 status · 소리 없음 분기 3곳.
- `PieceCollect.tsx` 재생 키 = 첫 등장 `pieceKey(line, j)`.

### QA 확인 항목
1. **한글 줄 빗금이 실제로 얼마나 나오나** — 한글 켬, 새 수업(조각 있는 것) 3개 이상에서 줄마다 [한글] 줄에 « / » 가 보이는지 센다. 분석 조각이 조사·문장부호를 앞 조각과 한 묶음으로 내면 그 줄은 빗금 없는 문장 한글 줄로 대신된다(정보 손실 없음 — ③a 한계). 비율이 낮으면 ③a `pieceHangul` 규칙 재검토 대상.
2. 히라가나 켬에서 칸 루비(한자 위 읽기)·경계가 한자 묶음 한가운데일 때 그 묶음 읽기만 빠지는지 · 고른 조각 줄 «읽기 · [한글]».
3. 칸 누름 → 소리·같은 칸 다시 누름 → 멈춤·다른 칸 → 바뀜 · [▶ 구간 듣기] · 카드 ▶ · 소리 실패 토스트(37-7 ③-8).
4. 마지막 문장 도착 때 초점이 [다음 단계]로, 첫 문장 도착 때 [다음 문장]으로 · TalkBack 카드 머리 polite 한 번.
5. 360·390·412 × 100·130% 칸 줄바꿈(한 칸 안 줄바꿈 없음)·긴 구간 버튼.
6. 진행 중 옛 수업(빈 상태) · 끝낸 단계 다시 보기(이동 자유·[지금 단계로]).

### 미커밋 파일
위 «변경 파일» 표 전부(새 4 · 수정 3 · 삭제 1).
