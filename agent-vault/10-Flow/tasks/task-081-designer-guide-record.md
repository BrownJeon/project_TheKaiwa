---
task_id: task-081
role: designer
title: "task-081 designer 기록 — 구현 가이드 screens.md §37 (승인 데모 v1)"
status: done
created: 2026-10-21
updated: 2026-10-21
tags:
  - type/record
  - domain/lesson
  - domain/improvement
aliases:
  - task-081 designer 가이드 기록
---

# task-081 designer 기록 — 구현 가이드 §37

관련: [[task-081-improve-lesson-chunk-step]] · 데모 기록 [[task-081-designer-record]] · 선례 [[task-077-improve-lesson-speak-translation-helper]] · [[task-080-plan-growth-analysis]]

## 산출

- `docs/screens.md` **§37**(새 절, 15150행~, 약 580줄·82KB) — 첫 줄 `승인 데모: docs/demo/task-081-lesson-chunk-step-v1.html (v1)`, 적용 토큰 이름, 37-0 레이아웃 설계 ~ 37-19 후속.
- 기존 절 머리 안내 4곳: §2 표 `/study/today/talk/[lessonId]` 행(5단계 이름 «조각»·task-081 표기) · §12 머리 «§37 로 일부 대체» · §14(승인 데모 줄 뒤) · §34 «④ 응용도 #185 공유».
- 승인 데모 파일 해시 재확인 `21ebca22782b50ee…`(변경 없음) · `src/**` 변경 0 · 정본 `docs/design/*` 변경 0 · 커밋·푸시 없음.

## §37 절 구성·요점

| 절 | 요점 |
|---|---|
| 37-0·37-1 | 레이아웃 설계 · 확정 결정 표(사용자 D1~D4 · Q1~Q12 ★·Q9 A · Leader L1~L4) |
| 37-2·37-3 | 라우트 그대로, `stage===3` → `StageChunk`. 의사코드 — 한 문장씩·`canNext = reviewing \|\| last \|\| 모두 봄`·`progress.pieces.seen` 모아 보내기·마지막 문장 도착 시 초점 [다음 단계] 로 |
| 37-4 | 부품 6개 파일·props 표, 조각 칸 = 버튼(문장부호·빗금은 aria-hidden 꼬리 묶음), 루비·한글은 문장 전체 분석을 조각 범위로 자름(`cutRubyByRanges` — 새 API 없음), `chunkLogic.ts` 순수 함수 9개(서버와 같은 규칙은 같은 픽스처 시험) |
| 37-5 | ④ `textFirst`·`trCache` prop, 마이크 기본, 알아들은 말에 `JaText`+한글+`SpeakTranslation`, 비교 뒤 «내 문장» 뜻 줄, `via` 화면 메모리만, 결과 도착 시 [비교하기] nearest 스크롤(P2-1) |
| 37-6·37-8 | 그 밖 화면 표 + **문구 표 전부**(새 `U3` 26키·`PIECE_TYPE_LABEL` 6종·`STAGE_COPULA` 받침 표·HOME·GEN·U2·U4·END·RV_*·LESSON_CH·챌린지 9곳) |
| 37-7·37-9~37-11 | 상태 표 31행 · 데모 CSS→Tailwind 값(새 색 0, 밑줄 = protein·accent·carb·good·ink·ink3) · 낭독 순서(고정 live/status 요소) · 3폭·130%·다크 |
| 37-12 | **데이터 계약 초안**: `DialoguePiece{ja,type,ko,slash?}` · LLM 스키마(`pieces` 필수, quiz 제거, v10/v4/scenario v2) · 줄 단위 검증 6규칙(«같음» = NFC 후 완전 일치) · 재생성 임계(절반 초과 → 재시도, 뒤에도 넘으면 null 줄 저장 제안) · 종류 판정 지침 표 · #62c `{kind:'piece'\|'phrase', idx, sub}` · #58 `pieces` · #61 `pieces.seen` · #62 점수 nullable |
| 37-13 | 서버 영향: 새 수업 `score` null·요약에서 «문제» 빼기·스냅샷 키 생략(옛 불변)·반복 항목은 계속 등록(오답 증가 중단)·관측 0건 → 성장 탭 문형·조사 축 한쪽 증거 고정 |
| 37-14~37-16 | ④ 세부(`voiceSharedFrozen` 허용 목록 변경 불필요) · 파일 전수(화면·서버·PE 분리) · 소환 5단계(PE → server → ui③ → ui④+표기 → 마무리) 소유 분리표 · 한 릴리스 배포 |
| 37-17~37-19 | reviewer 7항목 · QA · 실기기 6항목 · 정정/확인 10건 · 후속·정본 반영 목록 |

## 정본·데모와 어긋난 곳 (37-18)

1. [정정] 데모 소리 요청 `{kind,line,piece}` → 지금 계약 모양 `{kind,idx,sub}`.
2. [정정] 데모 문구 `CHUNK_TYPE_LABEL.LINK` → 새 `PIECE_TYPE_LABEL`(6종) — `ChunkType`(단어장·교정 공용 4종) 넓히지 않음.
3. [정정] ④ 알아들은 말 상자 `aria-hidden` → `aria-live="polite"`, 글을 `JaText`+`HangulLine` 으로.
4. [가이드가 더함] 마지막 문장 도착 때 초점 이동 · `tilesAriaTextOnly`(소리 없을 때 «들려요» 안 씀).

## Leader 확인 필요

1. **성장 탭 안내 4줄**(`growthCopy.ts:30,31,106,107` «수업 문제를 풀면…»)이 틀린 안내가 됨 — 제안 문구 37-18 ②(문형·조사 `axisOneSidedSub` 는 빈 값). 데모 밖·사용자 공개 필요.
2. 데모 밖 같은 취지 문구 3곳: `genPhase` «문법과 조각을…» · `U2.desc` «표현과 문형» · `HOME.nextStage` 받침 표(지금 «② 문법예요» 오류도 고침).
3. 질문 탭 `askCopy.ts:209` «점수» — 맥락에 레슨 점수가 실리는지 developer 확인 후 결정.
4. 37-12-4 «부드러운 위반»(재시도 뒤 null 줄 저장) 가능 여부 — 안 되면 «레슨 실패 vs null 저장» 결정.
5. 37-12·37-13 계약 초안 전체 승인 → `api-contract.md` #58~#62·#62c·#185·챌린지 응답, `domain-model.md`, `screens.md` §1-1 반영(목록 37-19).

## PE 에게 넘길 것

- 37-12-2(스키마: quiz 제거·dialogue `pieces` 필수 4키·enum 에 null), 37-12-3(줄 검증 6규칙 — 서버 순수 함수와 같게), 37-12-4(레슨 위반 임계·피드백·계측 `piecesNullLines`), 37-12-5(종류 판정 지침 표·끊어 읽기 2~4 구간·`ko` 형식), 버전 `lesson@v10`·`reviewMix@v4`·`lessonScenario@v2`, 골든 3종 재기록, 라이브 측정(생성 시간·크기·null 줄 비율 — 호출 예산 사용자 승인 뒤) → «보통 1~2분» 문구 판단 근거.

## 디자인 스킬

디자인 스킬: page-layout-designer(37-0) / 자체 점검은 데모 v1 때(P0 0·P1 0·P2 4, a11y Critical 0·Major 0·Minor 3) — P2-1(nearest 스크롤)·Minor-1·2·3(문장 전체 숨김 낭독·고정 live 요소·빗금 낭독 안 함)을 가이드에 반영.

## Designer 기록

- [14:18] §37 구현 가이드 작성(승인 데모 v1 명시)·§2·§12·§14·§34 머리 안내·Leader 확인 5건. `src/**`·데모·정본 변경 0.
