---
task_id: task-061
title: "task-061 Developer 기록 — 도우미 버튼 우측 끝 (IMP-0034)"
tags:
  - type/task-record
  - domain/improvement
created: 2026-10-12
---

# task-061 Developer 기록

이력서: [[task-061-improve-helper-button-right-end]]

## Developer 기록

- [착수] 이력서·IMP-0034·`VoiceBar.tsx` 읽음. 화면 파일 수정 전 데모 게이트 확인.
- [BLOCK] `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-061-improve-helper-button-right-end.md`
  - 결과 첫 두 줄: `DEMO_GATE_BLOCKED` / `task: task-061`
  - 사유: `task frontmatter 에 demo_gate 가 없습니다. Leader 가 judge intake 결과로 check.mjs init 을 먼저 실행해야 합니다.`
  - 이력서 frontmatter 에 `demo_gate:` 키 자체가 없다(task-059·060 에는 있음). 이력서 본문 judge 접수 절에는 `demo=none(DM-light-waive)` 로 적혀 있으나 check.mjs 는 frontmatter 만 본다.
- [중단] 규칙(「PASSED 가 아니면 화면 파일을 수정하지 않고 BLOCK 사유를 Leader 에게 보고」)에 따라 **코드·시험 파일을 하나도 수정하지 않았다.** 이 task 의 변경 대상(`src/components/talk/VoiceBar.tsx`·`PhraseHelperTip.tsx`·`TalkRoom.tsx`·`src/components/talk/__tests__/**`)은 모두 `src/components/**` 화면 경로다.
- Developer 는 `init`/`waive` 를 직접 실행하지 않았다(Leader 몫, `waive` 는 `--quote` 로 사용자 발화 기록 대조가 필요).

- [재개] Leader 가 게이트 해소(`init` → `not_required`, `DM-light-waive`). `check` → `DEMO_GATE_PASSED` / `task: task-061` / `status: not_required` 재확인. 구현 착수.
- [설계 확정] `VoiceBar` trailing 있을 때: 행 `[⌨ 44 | 가운데 3분할(빈 1fr·마이크 72·■ 슬롯 1fr, ■ 는 ml-3 justify-self-start) | 우측 44 = 도우미(justify-self-end)]`. trailing 없으면 지금 DOM 그대로(■ 는 우측 44 칸). 안내 말풍선은 `right-4`(말풍선 오른쪽 끝 = 바 오른쪽 − 16 = 도우미 오른쪽 끝, 꼬리 `right-[15px]`+7 = 22 = 도우미 가운데). TalkRoom 은 변경 없음(`<div relative flex-none>` 상자·`trailing={helperButton}` 그대로). 글자 모드 `{helperButton}` 은 `Composer leading` 안 🎤 오른쪽(좌측) — 우측 끝 아님, 고치지 않고 보고만.
- 함정: `roomRender.test.ts` 가 `VoiceBar.tsx` 원문에 `scenario|rolePlay|RolePlay` 문자열이 없어야 함(주석 포함) — VoiceBar 주석에 그 낱말 금지.

- [구현 완료·1차 검증] 변경: `VoiceBar.tsx`(trailing 있을 때 도우미=우측 끝 44 칸 `justify-self-end`, ■=가운데 3분할의 3번째 칸 `ml-3 justify-self-start`; trailing 없으면 DOM 불변) · `PhraseHelperTip.tsx`(`right-[calc((100%-192px)/2+4px)]` → `right-4`) · `PhraseHelperButton.tsx`(주석 한 줄) · 시험 `phraseHelperRender.test.ts`(VoiceBar 슬롯 2건 갱신 + 세 폭 계산 1건 + 말풍선 2건). TalkRoom 변경 없음.
  - 전용 미러 `~/.node-local/thekaiwa-dev061`(dev060 의 node_modules 를 `cp -al`, 스키마 md5 동일 `8f493d1b…`).
  - `node --import tsx --test phraseHelperRender.test.ts` 25/25 · `src/components` 전체 1278/1278 · `eslint src/components/talk` 0 · `tsc --noEmit`(미러 전체) 0.

## 실행 증빙 (light 트랙 — Reviewer 가 재실행)

전용 미러 `~/.node-local/thekaiwa-dev061`(`bash scripts/sync-local.sh` 는 `KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-dev061` 로). 검증한 4개 파일은 NFS 와 `cmp` 동일.

| 명령(미러에서) | 결과 |
|---|---|
| `node --import tsx --test src/components/talk/__tests__/phraseHelperRender.test.ts` | 25/25 통과(새·갱신 시험 5건 포함) |
| `node --import tsx --test --test-concurrency=1 $(find src/components -name '*.test.ts' \| sort)` (talk·scenario·components 전체) | 1278/1278 통과, fail 0 |
| `node node_modules/eslint/bin/eslint.js src/components` | exit 0 (errors 0, warnings 5 — 건드리지 않은 admin/settings 파일의 기존 `set-state-in-effect` 경고) |
| `node node_modules/typescript/bin/tsc --noEmit` (미러 전체, 다른 세션 미커밋 vocab 파일 포함) | exit 0 |
| `node node_modules/next/dist/bin/next build` | exit 0, `Compiled successfully in 6.9s` (로그의 `SPAWN_FAILED` 는 기존 경고에 인용된 소스 조각) |

시험 변경(`phraseHelperRender.test.ts`, 소스 검사 시험은 기존대로 공용 `readCode`): ① `trailing` 없음 → 가운데 `flex justify-center`·■ 가 우측 끝 칸·바이트 동일(기존 유지, ■ 위치 단언 추가) ② `trailing` 있음 → 도우미 우측 끝 `justify-self-end` 칸, ■ 는 `ml-3 justify-self-start` 칸, 마이크 72 가운데, 상태 줄·⌨ 바이트 동일, 마이크·■ 마크업 그대로, DOM 순서 ⌨→마이크→■→도우미 ③ 세 폭(360/390/412) 계산: 클래스 문자열에서 px-4·44·72·ml-3 을 읽어 마이크 가운데·■ 12px·■↔도우미 28/43/54·겹침 0 ④ 말풍선 클래스 `right-4`·옛 공식 없음 ⑤ 말풍선 세 폭: 왼쪽 여백 ≥16·오른쪽 = 바깥 패딩 안쪽·꼬리 가운데 = 도우미 가운데.

### 변이(전용 미러 사본에서만, 매번 NFS 원본으로 복원 후 `cmp` OK) — 47개 중 대상 시험 3파일(phraseHelperRender·phraseHelperBehavior·roomRender)

| # | 변이 | 결과 |
|---|---|---|
| M1 | **JSX 주석 처리** — VoiceBar 우측 끝 칸 `{trailing ? … : …}` 전체를 `{/* … */}` 로 | 실패 2 (슬롯 시험 2건) |
| M2 | ■ 슬롯 `ml-3`→`ml-2` | 실패 2 (슬롯·세 폭 계산) |
| M3 | 말풍선 `right-4` → 옛 공식 `right-[calc((100%-192px)/2+4px)]` | 실패 2 (말풍선 2건) |
| M4 | 꼬리 `right-[15px]`→`right-[11px]` | 실패 1 (말풍선 세 폭) |
| M5 | 마이크 칸 `72px`→`64px` | 실패 2 |
| M6 | ■ 슬롯을 빈 `<span>` 으로(■ 소실) | 실패 2 |
| M7 | **한 줄 주석 처리** — TalkRoom `// trailing={helperButton}` (소스 검사 `readCode` 시험) | 실패 1 (TalkRoom 배선 시험) |
| M8 | 도우미 칸 `justify-self-end`→`start` | 실패 1 (슬롯 시험) |

### 헤드리스 브라우저 실측 (Chromium 147 · isMobile · DSF 2.625 · ko-KR · reducedMotion · 가짜 마이크, 개발 서버 `next dev -H 127.0.0.1 -p 3016`, QA2 쿠키, 응답 전부 가로채기라 DB 쓰기 0·LLM 0 — 스크립트 `scratchpad/t061/m1.mjs`, 결과 `m1-all.log` 208/208 PASS)
SPEAKING 은 `speech/tts` 를 40초짜리 무음 wav 로 가로채고 선생님 말풍선 「다시 듣기」를 눌러 만들었다(`data-talk-state=SPEAKING` 확인). 안내 말풍선은 `helperTipSeen` 을 심지 않고(처음 한 번) 띄워 측정.

| 폭 | 방 | 도우미 right(= vw−16) | 마이크 중심(= vw/2) · 크기 | ■ gap · 크기 | ■↔도우미 간격 | 말풍선 l~r | 꼬리 중심 = 도우미 중심 |
|---|---|---|---|---|---|---|---|
| 360 | 일반·역할극 | 344 | 180 · 72×72 | 12 · 44×44 | **28** | 148~344 | 322 = 322 |
| 390 | 일반·역할극 | 374 | 195 · 72×72 | 12 · 44×44 | **43** | 178~374 | 352 = 352 |
| 412 | 일반·역할극 | 396 | 206 · 72×72 | 12 · 44×44 | **54** | 200~396 | 374 = 374 |

- 모든 조합(3폭 × 2방 × [■ 없음/SPEAKING]): 도우미 44×44, 마이크 72×72 가운데, **마이크 위치가 ■ 없을 때와 SPEAKING 때 동일**(left 159·top 812 @390), ■ 세로 가운데 = 마이크 가운데(848 = 848), 요소(⌨·마이크·■·도우미) 사이 겹침 0, 터치 44 이상, 각 버튼 가운데 `elementFromPoint` 가 그 버튼, 가로 넘침 0(docScrollW = bodyScrollW = vw), 말풍선 화면 안(좌우 ≥16)·오른쪽 = 도우미 오른쪽·도우미 위·`aria-describedby` 연결.
- 동작(390): SPEAKING 중 ■ 탭 → IDLE, SPEAKING 중 도우미(우측 끝) 탭 → 판 열림, 판 입력칸 초점 중 바 숨김(설계) → 초점 빼면 도우미가 우측 끝에 복귀 → 다시 탭 → 판 닫힘.
- 측정 중 알게 된 것: 개발 서버의 좌하단 `NEXTJS-PORTAL`(개발 배지)이 ⌨ 버튼 가운데를 덮어 `elementFromPoint` 가 실패했다 — 개발 모드 전용이라 측정 때만 `display:none`(제품 코드·운영 무관).
- 육안(스크린샷 `shot-360-talk-spk.png`·`shot-390-rp-idle.png`): 도우미 우측 끝 · ■ 마이크 오른쪽 · 말풍선이 도우미 위에서 오른쪽 정렬, 꼬리가 도우미를 가리킴. 역할극 방에서 말풍선이 「대답 연습」 줄을 가리는 면적은 옛 위치보다 줄었다(옛 말풍선 왼쪽 91px@390 → 새 178px).

## 변경 파일 (4)

- `src/components/talk/VoiceBar.tsx` · `src/components/talk/PhraseHelperTip.tsx` · `src/components/talk/PhraseHelperButton.tsx`(주석 한 줄) · `src/components/talk/__tests__/phraseHelperRender.test.ts`
- 변경 없음: `TalkRoom.tsx`(`<div relative flex-none>` 상자·`trailing={helperButton}` 그대로 — 안내 위치 식은 `PhraseHelperTip` 한 곳), 서버·모듈·타입·docs.

## 글자 모드 도우미 위치 (보고만, 고치지 않음)

`TalkRoom.tsx` 의 글자 모드는 `Composer leading={<>🎤 44 · {helperButton}</>}` — 입력창 **왼쪽**(🎤 오른쪽)이다. **우측 끝이 아니다**(우측 끝은 ↑ 보내기). 이번 요청은 음성 입력 바라 그대로 둠. 글자 모드도 옮기려면 별도 결정(보내기 버튼·입력창 폭 180/210/232px 영향).

## `docs/screens.md` §22 가 구현과 다른 곳 (Leader 몫 — 고치지 않음)

- §22-2 말 모드 코드 블록·문장: 「가운데 칸 3분할의 3번째 칸에 도우미 `ml-3 justify-self-start`」·「■ 44 | 빈 칸 44」 → 새 구조(도우미 = 우측 끝 44 칸 `justify-self-end`, ■ = 가운데 3분할의 3번째 칸 `ml-3 justify-self-start`, trailing 없으면 ■ 가 우측 끝 칸 그대로).
- §22-2 실측 줄: 「마이크↔도우미 12px · 도우미↔■ 28/43/54」 → 「마이크↔■ 12px · ■↔도우미 28/43/54」. 「■ 가 없을 때는 빈 44 칸이 자리를 지켜 도우미도 움직이지 않는다」 → 이제는 ■ 없을 때 가운데 3번째 칸이 비고 도우미는 우측 끝 고정.
- §22-2 녹음 중 서술(「링 끝이 도우미 왼쪽 가장자리에 약 2px 닿는다」) → 더는 해당 없음(도우미가 멀고 ■ 는 SPEAKING 에서만 보임).
- §22-3 첫 줄·§22-1-2 「마이크 오른쪽」 표현, `PhraseHelperButton` 소개.
- §22-4 모양·위치 공식: `right-[calc((100%-192px)/2+4px)]` → `right-4`(= 바 오른쪽 − 16 = 도우미 오른쪽 끝), 「360 실측: 말풍선 76~272px」 → 148~344px, 위치 공식 문장·「VoiceBar 의 … ml-3 …」 → 「px-4 · 우측 44 칸」. Tab 순서 서술 → ✕ → ⌨ → 마이크 → (■) → 도우미.

## 실기기에서만 확인할 것

- 도우미가 화면 오른쪽 끝에서 16dp(바깥 패딩) 안쪽 — 안드로이드 제스처 내비의 오른쪽 가장자리 뒤로 가기 스와이프 영역과 탭이 겹쳐 오작동하는지(탭은 영향 없다고 보지만 [추측], 엄지로 누르기 쉬운지는 실기기).
- SPEAKING 중 ■(마이크 오른쪽 12px)와 마이크 barge-in 을 엄지로 헷갈리지 않는지(두 버튼 사이 12px).

## 정리

- 개발 서버(PID 3633687) 종료·포트 3016~3019 빔, 쿠키 파일 `scratchpad/t061/c2` 비움(0바이트), 띄운 프로세스 없음. 방·DB 데이터는 만들지 않음(응답 전부 가로채기, QA2 `User` upsert 는 기존 행이라 변화 없음).
- 남은 것: 전용 미러 `~/.node-local/thekaiwa-dev061`(Reviewer 재실행용으로 둠, 끝나면 정리 대상 — 약 0.9GB 는 dev060 `node_modules` 하드링크), 낡은 dev `.next` 는 `scratchpad/t061/dev-next-cache` 로 미러 밖에 둠.

## 남은 일 / 다음 첫 행동

- 남은 일(Developer): 없음 — 구현·시험·변이 8건·브라우저 실측 208/208 완료. Reviewer 인계 대기.
- 다음 첫 행동: Reviewer 가 위 「실행 증빙」 명령을 전용 미러 `~/.node-local/thekaiwa-dev061` 에서 재실행(미러가 낡았으면 `KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-dev061 bash scripts/sync-local.sh` 로 다시 동기). Leader 는 `docs/screens.md` §22 서술 정정(위 목록).

## 주의점

- `roomRender.test.ts` 가 `VoiceBar.tsx` 원문에 `scenario|rolePlay|RolePlay` 문자열이 없어야 함(주석 포함) — VoiceBar 주석에 그 낱말 금지.
- 안내 말풍선 위치 식은 `PhraseHelperTip` 한 곳(`right-4`). VoiceBar 의 `px-4`·우측 44 칸이 바뀌면 같이 고친다(시험이 두 곳을 같은 클래스에서 읽어 어긋나면 실패).
- 개발 서버로 `elementFromPoint` 를 잴 때는 `NEXTJS-PORTAL`(개발 배지)이 좌하단 ⌨ 를 덮으므로 숨길 것(제품 코드 아님).
- 미커밋 파일(다른 세션): `src/components/vocab/**` 다수 + `SkipConfirmSheet.tsx`(task-059/060). 이 task 와 무관 — 건드리지 않음.

## 미커밋 파일(이 task)

- `src/components/talk/VoiceBar.tsx` · `PhraseHelperTip.tsx` · `PhraseHelperButton.tsx` · `__tests__/phraseHelperRender.test.ts` (수정) · 이 기록 파일(신규). 커밋·인덱스 작업은 하지 않음.
