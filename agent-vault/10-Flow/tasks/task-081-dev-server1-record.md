---
task_id: task-081
title: "task-081 developer 서버 갈래 1 기록 — 생성 연결·내용·진행·소리·오늘"
type: dev-record
tags:
  - type/task
  - domain/lesson
  - domain/server
created: 2026-10-21
updated: 2026-10-21
---

# task-081 developer 서버 갈래 1 (dev-081-server1)

> 이력서 [[task-081-improve-lesson-chunk-step]] · PE 인계 [[task-081-pe-record]] §4 · 가이드 `docs/screens.md` §37-12·37-13·37-15·37-16·37-18-1 · 미러 `~/.node-local/thekaiwa-dev081s1`(`make-mirror.sh` 로 생성). LLM 호출 0.

## Developer 기록

- [14:56] **CP1 — 생성 연결·타입 완료.** tsc 의 `LessonGenOutput` 불일치 2곳(`app/api/v1/lessons/route.ts:33`·`app/api/v1/_lib/review.ts:73`) 해결 — `LessonGenOutput.dialogue[i].pieces: StoredPiece[] | null` 추가·`quiz` 제거(라우트 코드는 손대지 않음: PE 의 `extraCheck`·`tolerateInvalidPieces` 는 `buildLessonRequest`/`buildReviewMixRequest` 안에 이미 연결돼 있고 상황 수업도 `buildLessonRequest` 경로라 타입만 맞으면 됨). `types/lesson.ts`: `PieceType`·`DialoguePiece`·`DialogueLine.pieces?`·`AudioKind += piece|phrase`·`TodayLessonItem.pieces?`·`LessonProgress`/`ProgressPatch` `pieces?`. **`LessonContent.quiz` 는 필수 그대로 둠**(아래 «가이드와 어긋난 곳» ①). 기존 시험 117/117 통과. tsc 남은 오류는 `components/challenge/logic.ts` 2건뿐 — 서버 갈래 2 의 `types/challenge.ts` nullable 변경 때문(내 파일 아님).
  - 완료 파일: `src/modules/learning/lessons/{content,validate,progress,today,generate,speaking}.ts`·`src/types/lesson.ts`·`src/app/api/v1/lessons/[id]/audio/route.ts`(주석만)·`src/modules/learning/__tests__/task010.test.ts`(옛 수업 픽스처를 `stored()` 로).
  - 남은 일: 새 시험 파일(`lessons/__tests__/task081Server1.test.ts`)·공용 픽스처(`pieceRuleCases.json`)·변이 시험 4건·eslint·최종 기록.
  - 다음 첫 행동: 시험 파일 작성 → 미러 sync → `node --import tsx --test`.
  - 주의점: `ProgressLimits.dialogueCount` 는 **선택** — lifecycle.ts 63행(서버 갈래 2 소유)에 `dialogueCount: h.content.dialogue.length` 를 넣어야 `progress.pieces` 가 받아진다(빠지면 늘 400, 닫힌 쪽). 서버 갈래 2 에 SendMessage 로 칸 이름 전달함.
  - 미커밋 파일: 위 완료 파일 전부.
- [15:01] **CP2 — 서버 갈래 1 완료(내용·소리·진행·오늘·시험·변이).**
  - **변경 파일**: `src/modules/learning/lessons/content.ts`(`PieceType`·`StoredPiece`·`LessonGenOutput.pieces`·`StoredQuizItem` 독립 정의·`NewStoredLessonContent`·`toStoredContent`(quiz 키 버림·빠진 pieces→null)·`readStoredContent`(quiz 선택·있으면 배열·없으면 `[]`·옛 수업은 같은 객체)·`AUDIO_KINDS += piece|phrase`·`AUDIO_SUB_KINDS`·`phraseText`·`pieceCount`·`audioText(…, sub)`) · `validate.ts`(`parseAudioBody` `sub`, `AUDIO_SUB_MAX=23`) · `progress.ts`(`pieces.seen` 검증·합집합 병합·`ProgressLimits.dialogueCount?`·머리 주석) · `today.ts`(`pieces: pieceCount(content)`) · `generate.ts`(SAVE 단계 계측 `piecesTotal`·`piecesNullLines`) · `speaking.ts`(`getLessonAudioSource` 가 `sub` 전달 — 소유 목록 밖이지만 가이드 37-15 서버 표의 항목이고 서버 갈래 2 금지 목록에도 없음, 한 줄) · `types/lesson.ts` · `app/api/v1/lessons/[id]/audio/route.ts`(주석만) · 시험 `lessons/__tests__/task081Server1.test.ts`(14)·`lessons/__tests__/pieceRuleCases.json`(phrase 6·count 5) · `__tests__/task010.test.ts`(옛 수업 픽스처 `stored()`) · `app/api/v1/lessons/_lib/__tests__/lessonInput.test.ts`(`lessonScenario@v2` 기대값 — PE 버전 올림 반영).
  - **결정과 근거**: ① 조각 정규화(`slash:false` 삭제·`ko` 공백 제거·꼬리 slash 삭제)는 PE `applyLessonPieces`(extraCheck 안)에만 있음을 확인 — L3 에 복사본을 두지 않았다(L3→L2 import 금지, 중복 금지). `toStoredContent` 는 «키가 빠진 줄 → null» 만 한다. ② `readStoredContent` 는 `quiz: null` 도 손상으로 본다(«있으면 배열»을 `undefined` 만 없음으로 해석). ③ `parseAudioBody` 반환은 piece·phrase 에만 `sub` 를 싣는다(다른 kind 반환 모양 불변 — 기존 deepEqual 시험 그대로 통과). 사유 코드: 빠짐 `required`·형식 `invalid`·다른 kind `not_allowed`(모두 `field:'sub'`). ④ `phraseText` 는 문장부호뿐인 구간도 null(→ 400 `out_of_range`) — 픽스처 «「 ／ はい」» 사례. ⑤ `pieceCount` 는 가이드 37-4-2 그대로 «어느 줄에도 배열이 없으면 null» — 전 줄 null 인 새 수업도 null(조각 0 이 아니라). ⑥ 계측은 `RequestTrace` SAVE 단계 메타(숫자만) — 레슨 생성에는 `ChatMessage.toolLog` 가 없어서 PE 가 말한 «toolLog» 를 이 자리로 옮겼다. ⑦ 캐시 키·한도·TTS 경로: 오디오 라우트는 `audioText` 가 고른 글을 줄 재생과 같은 `synthesizeLessonClips({userId,text,pace,lessonId,topicId})`·`rateLimit('tts:…',60)` 로 보낸다 — 새 규칙 없음(코드 확인).
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-dev081s1`): `node --import tsx --test src/modules/learning/lessons/__tests__/task081Server1.test.ts` → 14/14 · `find src/modules/learning src/app/api/v1/lessons src/app/api/v1/_lib -name '*.test.ts'` 전부 → 처음 697 중 695 통과·1 실패(`lessonScenario@v1` 기대값 — PE 버전 올림)·1 skip → 고친 뒤 다시 전부 697 중 **696 통과·0 실패·1 skip** · `tsc --noEmit` → 내 파일 오류 0, 남은 2건은 `src/components/challenge/logic.ts:287·479`(서버 갈래 2 의 `types/challenge.ts` nullable 변경 → 화면 갈래 몫) · eslint(내 파일 전부) 0 오류 0 경고 · 엔진명 grep(diff 추가 줄) 0.
  - **변이 시험 7/7 죽음**(임시 파일 + `os.replace` 후 원복, 원복 뒤 NFS 원본과 `filecmp` 일치 7/7, 스크립트 `scratchpad/dev-081-server1/mutate.py`): M1 `sub` 필수 조건 빼기 → 1 실패 · M2 `pieces.seen` 중복 허용 → 1 · M3 `readStoredContent` 가 quiz 없으면 null → 5 · M4a `phraseText` 끝 문장부호 빼기 없앰 → 2 · M4b 구간 경계(slash 조각을 다음 구간으로) → 2 · M5 다른 kind 의 `sub` 허용 → 1 · M6 `pieceCount` 를 `ja` 로만 셈 → 1.
  - **가이드와 어긋난 곳**: ① **`types/lesson.ts` `LessonContent.quiz` 를 선택(`quiz?`)으로 바꾸지 않고 필수로 뒀다** — 선택으로 바꾸면 `StageQuiz.tsx` 12곳·`logic.ts:181` 이 tsc 오류(«possibly undefined»)라 «tsc 초록 유지» 지시와 충돌. 서버 응답은 `readStoredContent` 를 거쳐 새 수업도 `quiz: []` 를 내려 보내므로 필수 타입이 실제 응답과 맞다. 화면 갈래가 `StageQuiz` 를 지울 때 칸·`LessonQuiz` 를 함께 정리(주석에 적음). ② 그래서 #60 응답의 새 수업 `content` 에는 `quiz: []` 가 실린다(저장 JSON 에는 키 없음 — api-contract #60 개정 «돌려줄 때 `quiz ?? []`» 와 같은 뜻으로 읽었다). ③ `ProgressLimits.dialogueCount` 는 선택 — 서버 갈래 2 가 lifecycle.ts 63행에 `dialogueCount: h.content.dialogue.length` 를 넣었다고 알려 옴(14:5x). 빠지면 `progress.pieces` 는 400 `unsupported`. ④ `CompleteResult`(#62 응답 타입)의 score nullable 은 건드리지 않았다 — 생산자가 lifecycle(서버 갈래 2)이고 화면이 읽는 타입이라 그쪽·화면 갈래 몫.
  - **한계**: `today.ts` 의 `pieces` 는 DB 가 필요한 `getTodayLessons` 라 단위 시험 없음(순수 `pieceCount` 만 시험) · 짧은 조각(조사 한 글자) 소리 품질은 실기기(37-17 ⓐ) · `phraseText` 의 «문장부호뿐인 구간 = null» 을 화면 `chunkLogic` 도 같은 값으로 다뤄야 함(픽스처 `phrase[4]`).
  - **화면 갈래에게**: `src/modules/learning/lessons/__tests__/pieceRuleCases.json` 을 `chunkLogic.phraseText`·`pieceCount` 시험에 그대로 읽어 쓸 것(기대값 = 손 계산, null 의미는 파일 `note`).
  - **reviewer 가 볼 곳**: `validate.ts` `parseAudioBody`(sub 분기·`onlyKeys` 순서 — 글 키가 먼저 `unknown_key`) · `content.ts` `audioText`(piece 는 `type !== null` 만, 모양 어긋난 저장 조각은 null) · `readStoredContent`(옛 수업 같은 객체 반환 — 동작 불변) · `toStoredContent`(quiz 키 버림) · `progress.ts` `parsePiecesSeen`·`mergeProgress`(저장값 어긋남에 던지지 않음) · `task010.test.ts` 의 `stored()`(옛 수업 저장 JSON 흉내 — pieces 키 제거·quiz 추가).
  - 미커밋 파일: 위 변경 파일 전부(커밋·푸시·배포·DB 쓰기 없음).
