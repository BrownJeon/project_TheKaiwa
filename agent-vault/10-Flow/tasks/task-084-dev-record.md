---
task_id: task-084
type: dev-record
updated: 2026-10-22
tags:
  - type/task
  - domain/vocab
---
# task-084 Developer 기록 (sonnet, light 트랙) — 객관식으로 답한 카드도 기록 한 줄

이력서: [[task-084-improve-word-card-choice-answered]] · 백로그 [[IMP-0062-word-card-choice-answered-normal-card]]

## 완료
- **분기 판정을 순수 함수로**: `cardFirst.showsChoiceList(mode, card)` = `mode === 'CHOICE'` 이거나 (`card.open` 이면서 `!isAnswered(card)`). `VocabDeck.tsx` 아래 영역이 이 함수 하나로 `ChoiceList`/`FlipControls` 를 가른다. 옛 `answered && answeredBy(card, mode) === 'choice'` 줄과 `answeredBy` import 삭제.
- **기록 한 줄 문구**: `labels.choiceRecordedText(answer)` 신설(맞힘 «맞았어요로 기록했어요»·틀림 «틀렸어요로 기록했어요»), `flipRecordedText(answer, chosenText?)` 가 `chosenText != null`(건너뜀 제외)이면 이를 쓴다. 직접(알았어요/몰랐어요)·건너뜀 문구 불변. `FlipControls` 는 `flipRecordedText(card.answer, card.chosenText)` 한 줄만 바뀜.
- **`docs/screens.md`**: Ac 행·지난 카드 행·의사코드(D)·카드(#49) 표·Q3 의 «242/302/282» 근처만 `[⚠ task-084 …]` 로 갱신(기존 줄은 취소선으로 남김). 다른 줄 불변.
- **시험**: 새 파일 `src/components/vocab/__tests__/choiceAnswered.test.ts` 6개 — ① 분기 판정 표(CHOICE 모드 8조합+카드 없음 / FLIP 안 답함·열림 5 / FLIP 답한 카드 직접·객관식·건너뜀 × 열림 값 남은 상태 / answer 만 온 카드) ② 기록 문구 표(객관식 맞힘·틀림·직접 2·건너뜀·건너뜀+잔여 chosenText) ③ `FlipControls` 렌더(객관식 맞힘/틀림·직접·건너뜀 = 버튼·`ol` 없음, 마크업이 문구만 다름) ④ 배선(덱은 `showsChoiceList(mode, card)` 하나·`answeredBy(` 없음·`onAnswered` 가 `open: false` 와 무조건 `setFocus(next)` 를 가짐).

## 확인 결과 (요청한 두 가지)
- **① `open` 은 답한 뒤 true 로 남지 않는다 [확실 — 코드 읽음]**: `useVocabDeck.onAnswered` 가 답 응답 때 `open: false` 로 패치(방식 무관, 353행) · `apply(refresh)` 는 `open: openBefore && !isAnswered(c)` · `VocabDeck` 의 `const open = !!card.open && !answered`. 그래도 화면 판정이 이 로컬 값에 기대지 않도록 `showsChoiceList` 가 답함을 한 번 더 본다(시험에 «열림 값이 남은 상태» 케이스). 응답을 기다리는 `pending` 동안은 아직 안 답한 카드라 보기가 «확인 중…» 으로 남는다(의도, 실패하면 열린 채 돌아옴).
- **② 초점 이동은 직접 답하기와 같은 길 [확실 — 코드 읽음]**: `onAnswered` 가 `kind`(choice·self·skip) 상관없이 `setFocus({kind:'next'})` → `VocabDeck` 의 `deck.focus` 효과가 `requestAnimationFrame` 뒤 `nextRef`([다음 카드]/[결과 보기])로 초점을 옮긴다. 새 메커니즘 없음. 예전 `ChoiceList` 가 남아 있어도 초점은 이미 [다음 카드]로 갔고, 지금은 누른 보기 버튼이 unmount 되는 것이 달라진 점이다 — 직접 답하기의 [알았어요] 버튼 unmount 와 같은 상황(unmount 직후 한 프레임은 body, 다음 프레임에 [다음 카드]). 시험은 `onAnswered` 의 `setFocus` 가 `kind` 분기 안에 있지 않음을 잠근다.
- 차이 하나(불변): 직접 답은 0.4초 뒤 자동 다음(`FLIP_AUTO_NEXT_MS`), 객관식은 자동 다음 없음(screens.md Ac «자동 아님, D2»). 이번에 건드리지 않았다.

## 기존 시험
- «Ac 에서 `ChoiceList`» 에 기대는 기존 단언은 **없었다** — `src/components/vocab`·`common` + `lesson/__tests__/display.test.ts` 505개가 수정 없이 전부 통과(`cardFirst.test.ts` 의 `answeredBy` 시험은 판별 함수 자체라 그대로 유효).

## 실행 증빙 (미러 `~/.node-local/thekaiwa-dev084`, `make-mirror.sh dev084` + `sync-local.sh`, `mirror-audit --check` exit 0)
- 새 시험: `node --import tsx --test src/components/vocab/__tests__/choiceAnswered.test.ts` → **6 pass / 0 fail**.
- 묶음: `src/components/vocab`+`src/components/common` 36개 파일 + `lesson/__tests__/display.test.ts` → **505 pass / 0 fail**.
- `node node_modules/typescript/bin/tsc --noEmit` → **exit 0**(오류 0).
- `eslint` 변경 5파일(`VocabDeck.tsx`·`FlipControls.tsx`·`labels.ts`·`cardFirst.ts`·새 시험) → **exit 0**(경고·오류 0).
- **변이 시험 5개, 모두 잡힘·복원 후 `cmp` 동일**(임시 파일 + `os.replace`):
  - M1 `showsChoiceList` 가 `!isAnswered` 제거 → 시험 3 실패
  - M2 `flipRecordedText` 가 `chosenText` 무시 → 시험 4·5 실패
  - M3 덱 분기를 옛 규칙(`… || (answered && card.chosenText != null)`)으로 → 시험 6 실패
  - M4 `FlipControls` 가 `chosenText` 를 안 넘김 → 시험 5·6 실패
  - M5 `onAnswered` 초점을 `kind === 'self'` 일 때만 → 시험 6 실패

## 주의점·한계
- **게이트 훅 경고(Leader 확인 필요)**: `check.mjs check --task` 는 `DEMO_GATE_PASSED`(`not_required`, judge `none`)인데, 화면 파일 편집 전 훅이 «active task 가 지정되지 않음 — Leader 가 `check.mjs activate --task` 로 지정해야 한다» 경고를 냈다(warn 단계라 편집은 허용). 승인 부재가 아니라 활성 task 미지정 경고로 판단해 이력서 지시 범위 안에서 진행했다. 규칙상 «멈추고 보고» 항목이므로 Leader 가 `activate` 를 하거나 무시 여부를 정해 달라.
- `docs/screens.md` Q4(주제 세트 + 알림 + 객관식 답한 뒤 + 360×740 위험 조합)와 10462행 근처 실측 서술은 **지시 범위 밖이라 건드리지 않았다.** 카드 우선 세트에서는 그 위험 조합의 «객관식 답한 뒤» 가 더는 보기 4개를 안 그려 무대가 더 크다(이전 4지선다 세트에만 해당). 정리가 필요하면 Leader 결정.
- 결과 목록(`WordResultList`)의 «내 답» 은 그대로 — 기록은 남는다. 카드 면 보기 목록의 «내 답»(✗) 표시는 사라진다(Leader 결정, 사용자 보고 필요).
- 실브라우저·폰 확인 안 함(금지). Leader 실브라우저 확인 항목: 객관식 답한 직후·«이전» 으로 돌아간 카드 둘 다 보기 없음·기록 줄 문구가 띠와 일치·무대가 겹침 없이 커짐·초점이 [다음 카드].

## 변경 파일 (미커밋)
- `src/components/vocab/cardFirst.ts` · `labels.ts` · `VocabDeck.tsx` · `FlipControls.tsx`
- `src/components/vocab/__tests__/choiceAnswered.test.ts` (신규)
- `docs/screens.md`
- 이 기록 파일. 서버·DB·API·네이티브·`ChoiceList.tsx`·`VocabCardFace.tsx`·`SwipeCardStack` 변경 없음.
