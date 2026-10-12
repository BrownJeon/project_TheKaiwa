---
task_id: task-061
title: "task-061 Reviewer 기록 — 도우미 버튼 우측 끝 (REV-198)"
tags:
  - type/task-record
  - domain/improvement
created: 2026-10-12
---

# task-061 Reviewer 기록 (REV-198)

이력서: [[task-061-improve-helper-button-right-end]] · Developer: [[task-061-dev-record]] · IMP-0034

## Reviewer 기록 (REV-198)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2 (Info 2). light 트랙 완료 조건(developer 증빙 직접 재실행)을 모두 충족했고, 재실행 결과가 developer 주장과 일치한다. `native_change: false`. QA 인계 없음(light 트랙).

### 재실행 결과 (전용 미러 `~/.node-local/thekaiwa-rev061`, `sync-local.sh` 후 변경 5개 파일 NFS 와 `cmp` 동일, 스키마 md5 `8f493d1b…` 동일)

| 항목 | 결과 |
|---|---|
| `eslint src/components/talk` (변경 4개 파일 포함) | exit 0, 오류·경고 0 (`react-hooks` 규칙 포함) |
| `tsc --noEmit` (미러 전체, 다른 세션 vocab 미커밋 파일 포함) | exit 0 |
| `phraseHelperRender.test.ts` | 25/25 |
| `src/components` 전체(`--test-concurrency=1`, talk·scenario 포함) | **1283/1283**, fail 0·cancelled 0·skipped 0 (developer 1278 과 5건 차이 = 그 뒤 다른 세션(task-060/062)이 들인 시험, 이 task 와 무관) |
| `next build` | exit 0, `Compiled successfully in 6.4s`, TypeScript 19.5s, 경고 3건은 기존 `persona/loader.ts` 동적 파일 접근 |
| 범위 | 변경 파일 = `VoiceBar.tsx`·`PhraseHelperTip.tsx`·`PhraseHelperButton.tsx`(주석 한 줄)·`phraseHelperRender.test.ts` 4개. `TalkRoom.tsx` `git diff` 0줄, 서버·모듈·`docs/**`(Leader 몫 제외) 무변경 |
| 데모 게이트 | `check.mjs check` → `DEMO_GATE_PASSED` · `status: not_required`(judge `DM-light-waive`). `evidence.jsonl` 에 task-061 줄 0건 = 에이전트가 `approve`/`waive` 를 대신 실행한 흔적 없음, 이력서 frontmatter `waived_by`·`approved_by` 비어 있음 |

### 동작 불변 · DOM 불변 (직접 확인)

- **trailing 없음 → HEAD 와 바이트 동일**: HEAD 의 `VoiceBar.tsx` 를 `VoiceBarOld` 로 두고 새 `VoiceBar` 와 `renderToStaticMarkup` 비교 — 상태 5 × `showStop` 2 × 키보드 막힘 2 × `db` 2 × trailing 4종(undefined·null·false·'') = **160조합 전부 동일**. (`stop ?? <span h-11 w-11/>` 가 옛 삼항과 같은 DOM.)
- **trailing 있음 DOM 순서** = ⌨ → 마이크 → ■ → 도우미(코드·시험 모두). 브라우저 Tab 실측(390, 안내 말풍선 표시 상태): IDLE `안내 닫기 → 글자로 입력하기 → 일본어 도우미`, SPEAKING `안내 닫기 → 글자로 입력하기 → 선생님 말 멈추기 → 일본어 도우미`(마이크는 내 필터 목록에 없어 안 찍힘, DOM 상 ⌨ 와 ■ 사이).
- 도우미 열림/흐림/`aria-disabled`/토스트/잠금/자동 취소/⑤A/`accepted` 닫힘/대답 연습 배타는 `src/components` 전체 1283건(관련 `phraseHelper*` 5개 파일 포함)이 그대로 통과. `TalkRoom.tsx` 가 바뀌지 않았으므로 배선·상태 로직은 불변.
- ■ 의 `aria-label`(`TALK_ROOM.stopTeacher`)·마크업은 바이트 동일(시험이 비교), `onClick={onStop}` 동작은 브라우저에서 확인(아래 F-2 참조).

### 헤드리스 브라우저 실측 (Chrome, isMobile, DSF 2.625, `next dev -H 127.0.0.1 -p 3017`, QA2 쿠키, API 전부 가로채기 → DB 쓰기·LLM 0, 개발 배지 `nextjs-portal` 만 측정 때 숨김)

1. **developer 스크립트 `t061/m1.mjs` 재실행: 208/208 PASS** (3폭 × 일반·역할극 × IDLE·SPEAKING + 말풍선 + 동작).
2. **내 독립 스크립트 `t061/r1.mjs`** (`rev061/r1.log`) — SPEAKING 상태 값(좌표 px):

| 폭 | 도우미 right − vw | 마이크 중심 − vw/2 | 마이크↔■ | ■↔도우미 | ⌨↔마이크 | 가로 넘침 | 행 열 |
|---|---|---|---|---|---|---|---|
| 360 | −16 (344) | 0 | 12 | **28** | 84 | 0 | 44 / 240 / 44 |
| 390 | −16 (374) | 0 | 12 | **43** | 99 | 0 | 44 / 270 / 44 |
| 412 | −16 (396) | 0 | 12 | **54** | 110 | 0 | 44 / 292 / 44 |

   모두 승인 사양(28/43/54)과 일치. 모든 폭에서 ■ 를 눌러 IDLE 로 돌아가도 마이크 `Δ=(0,0)`·도우미 `Δ=(0,0)` = **■ 있음/없음 두 상태에서 마이크·도우미 자리 불변**. 도우미·■·⌨ 44×44, 마이크 72×72.
3. **안내 말풍선**(developer 스크립트 포함 208건 내): 세 폭 모두 말풍선 오른쪽 = 도우미 오른쪽(344/374/396), 왼쪽 ≥ 16(148/178/200), 꼬리 중심 = 도우미 중심(322/352/374), 도우미 위, `aria-describedby` 연결, 가로 넘침 0.
4. **글자 모드(변경 없음 확인)**: 360 — 도우미 64~108, 입력창 116~296(180px), 보내기 304~348; 412 — 입력창 116~348(232px), 보내기 356~400. 가로 넘침 0, 이번 변경 영향 없음(`Composer leading` 그대로).
5. **큰 글자 흉내**(html font-size 1.3배, 360): 도우미 right 339.2(= 360 − 1rem×1.3), 마이크 가운데 180, ■ 간격 15.6, 가로 넘침 0 — `right-4` 와 `px-4` 가 같은 rem 단위라 글자 확대에도 말풍선과 도우미가 같이 움직인다.
6. **키보드 초점 링**: 360 에서 도우미 `outline 2px solid, offset 2px` → 링 오른쪽 끝 348 ≤ 360(잘림 없음).

### 변이 재현 (내 전용 미러 사본 `rev061m` 에서만, 매번 NFS 원본으로 복원 후 `cmp` OK — 대상: `phraseHelperRender`·`phraseHelperBehavior`·`scenario/roomRender` 47건)

| # | 변이 | 결과 |
|---|---|---|
| R1 | **JSX 주석 처리** — VoiceBar ■ 슬롯 줄 `{/* stop ? … */}` | 실패 2 (슬롯 시험·세 폭 계산) — 사망 |
| R2 | 도우미 칸 `justify-self-end` → `justify-self-center` | 실패 1 (슬롯 시험) — 사망 |
| R3 | 말풍선 `right-4` → `right-5` | 실패 2 (말풍선 2건) — 사망 |
| R4 | trailing 없을 때 ■ 를 `ml-3` div 로 감쌈(비-trailing DOM 변경) | 실패 2 (불변 시험·슬롯 시험) — 사망 |
| R5 | ■ `onClick={onStop}` → `onClick={onKeyboard}` | **생존** 47/47 통과 → F-2 |
| R7 | **한 줄 주석** — TalkRoom `// trailing={helperButton}` | 실패 1 (`readCode` 기반 TalkRoom 배선 시험) — 사망 |

   6건 중 5건 사망(주석 처리 2건 포함 모두 사망). developer 의 8건 주장과 겹치지 않는 변이(R1·R2·R3·R4·R5)까지 다시 확인했다. 시험은 배치(도우미 우측 끝 열·■ 옛 자리·`justify-self-end`·말풍선 `right-4`)를 실제로 잠근다.

### 발견 사항

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| F-1 | Low | `docs/screens.md` 줄 81 · 4230 · 9888 · 9890 | Leader 반영이 놓친 옛 서술 4곳. ① 줄 81 라우트 표 「마이크 오른쪽 44px 원형 버튼」 ② 줄 4230 체크 「도우미 버튼 44px 원형이 마이크 오른쪽에 들어가도 PTT 위치…」 ③ 줄 9888 「360 실측: 말풍선 76~272px」 → 실제 **148~344px**(내 실측·시험 모두) ④ 줄 9890 Tab 순서 「✕ → ⌨ → 마이크 → 도우미」 → ■ 가 보이면 「… → 마이크 → ■ → 도우미」(developer 도 이 수정을 요청했음). 구현은 맞고 문서만 낡았다 — Leader 가 한 줄씩 정정 권고. 나머지 반영분(§9-2 F·§22-2 코드 블록·실측 줄·H1)은 구현과 일치함을 대조했다. |
| F-2 | Low (기존 공백) | `VoiceBar.tsx` ■ 버튼 `onClick={onStop}` | 정적 렌더 시험은 ■ 의 **클릭 핸들러 배선**을 못 본다(R5 생존). 이 task 가 ■ 를 `const stop` 으로 빼 옮기며 변경 범위에 든 코드지만, 이전에도 이 배선은 시험이 없었다(`onStop` 을 참조하는 시험 0). 동작 자체는 브라우저에서 확인: developer 208 중 「■ 탭 → SPEAKING 해제」 PASS, 내 r1 의 「■ 탭 → IDLE, ■ 사라짐」 3폭 PASS. 권고(선택): `readCode` 로 `aria-label={TALK_ROOM.stopTeacher}` 와 `onClick={onStop}` 이 같은 `<button>` 에 있음을 소스 검사로 잠그거나, 이대로 수용. 막을 사유 아님. |
| I-1 | Info | `~/.node-local/thekaiwa-rev061{,m}` | 내가 만든 미러 두 개가 남았다(하드링크라 디스크 부담은 작고 `rev061/.next` 정도). 삭제 명령이 환경 가드에 막혀 못 지웠다 — Leader/deployer 가 정리(내 것이라 안전: `rm -rf ~/.node-local/thekaiwa-rev061 ~/.node-local/thekaiwa-rev061m`). 개발 서버(3017)는 종료·포트 3016~3019 빔, QA2 쿠키 파일 `scratchpad/rev061/c2` 0바이트. |
| I-2 | Info | `thekaiwa-dev061` | developer 미러 — 이 task 끝나면 정리 대상(developer 기록 §정리와 동일). 내가 손대지 않았다. |

### 판단 요청에 대한 의견

- **안드로이드 제스처 내비 vs 우측 끝 16dp** — [가능성 높음] 위험 낮음, 코드 변경 불필요. 근거: ① 도우미는 **탭** 대상이라 가장자리 스와이프(뒤로)와 시작 지점만 겹칠 뿐이고, 시스템 제스처는 움직임이 시작돼야 가로채며 순수 탭은 앱에 전달된다 ② 버튼 중심이 가장자리에서 38dp 라 기본 제스처 감응 구간(약 24~30dp)을 벗어나 있다 ③ 왼쪽 ⌨ 가 같은 16dp 위치로 이미 운영 중이라 오른쪽만 새 위험이 되지는 않는다(대칭). 키보드 링 4px 도 화면 안. 실기기에서 「오른쪽 가장자리에서 밀어 뒤로」 후에도 도우미 탭이 되는지 한 번 확인하면 충분하다. 문제가 나오면 처방은 바 좌우 패딩(`px-4`) 키우기 하나이고, 말풍선 `right-4` 가 같은 토큰이라 함께 움직이게 해 두는 편이 낫다(이미 같은 rem 단위).
- **SPEAKING 중 ■↔마이크 12px 엄지 오터치** — [가능성 높음] 결과가 가볍다: 의도가 「선생님 말 멈춤」일 때 마이크를 잘못 눌러도 barge-in 으로 재생이 끊긴다(목적 달성), 반대로 말하려다 ■ 를 눌러도 재생만 멈추고 마이크를 다시 누르면 된다. 간격 12px 은 마이크 눌림 링 상자(+6px)가 번져도 6px 남는다. 별도 완충 불필요, 실기기에서 엄지로 헷갈리는지만 보면 된다.
- **글자 모드 도우미 위치** — 이번 범위 밖이고 지금(🎤 오른쪽, 입력창 왼쪽)을 유지하길 권한다. 글자 모드 우측 끝은 **보내기 ↑**(304~348 @360)라 도우미를 거기 두면 보내기와 맞닿아 오송신 위험이 생기고, 입력창이 180/210/232px 에서 더 줄어든다. 불일치(말 모드는 우측 끝, 글자 모드는 왼쪽)는 사실이므로 Leader 가 사용자에게 한 줄 알리고, 원하면 별도 IMP 로 받는 것이 맞다.

### 확인 못 한 것

- 실기기(S25+ WebView·APK) 제스처 내비·엄지 오터치·TalkBack 낭독 순서 — 실기기 항목으로 남김([추측] 수준의 위 의견).
- 다크 테마·역할극 방 말풍선 시각 품질(디자인 판단은 designer 몫 — 여기서는 수치만).
- `ecosystem` 운영 배포·번들 대조(이 task 는 아직 배포 전).

### 인계

- Developer 수정 요청: **없음**(F-1 은 Leader 문서, F-2 는 선택).
- QA: light 트랙이라 QA 없음. high_risk_areas 로 남길 것은 없고, 실기기 두 항목(제스처 내비 탭·SPEAKING 오터치)만 사용자 확인 목록에 유지.
- 반려 횟수·결함 클래스: 해당 없음(1회 PASS_WITH_NOTES, Sonnet developer).
