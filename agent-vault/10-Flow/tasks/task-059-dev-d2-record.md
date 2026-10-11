---
task_id: task-059
role: developer (Dev-D2 — 덱 높이 결함 #1 수정)
tags:
  - type/record
  - domain/vocab
---
# task-059 Dev-D2 기록 — [[task-059-improve-today-words-card-first]]

QA 결함 #1(β1, [[task-059-qa-record]]) — 360×740 주제 세트 + `fewer` 알림 + 객관식으로 답한 뒤 카드(하한 200)가 무대(안쪽 155.8)보다 커서 알림·듣기 줄을 위아래 10.1px 덮음.

## Developer 기록
- [00:18] 착수 — 원인 코드 확인: 무대 `VocabDeck.tsx:219` `flex min-h-0 flex-1 items-center justify-center px-4 py-3` — `min-h-0` 이 flex 기본 `min-height:auto`(내용 기준 하한 ≈ 카드 200 + py 24)를 꺼서 무대가 180 아래로 줄어들고, 카드는 `SwipeCardStack.tsx:134` `h-full max-h-[340px] min-h-[200px]` 하한 때문에 200 을 유지 → `items-center` 로 위아래 대칭으로 넘침. 넘침이 무대 패딩 12px 를 넘으면 이웃(알림 박스 아래·듣기 버튼 위, 듣기 줄은 `-mt-1` 로 4px 더 올라와 있음)과 겹친다. `main`(`(app)/layout.tsx:52`)이 `overflow-y-auto` 라 덱 루트(`h-full min-h-[600px]`) 밖으로 나간 내용은 `main` 스크롤이 받는다.
  - 선택: **대책 A** — 무대 `min-h-0` → `min-h-[224px]`(카드 하한 200 + `py-3` 12×2). 카드 상한·하한·`SwipeCardStack`·제스처·덱 `min-h-[600px]` 무변경.
- [00:21] 시험 먼저 작성 — 새 파일 `src/components/vocab/__tests__/deckStage.test.ts`(3 케이스: 카드 상한·하한 200/340 그대로 · 무대 `min-h-0` 없음 + 무대 하한 = 카드 하한 + `py` 패딩×2(소스 클래스를 읽어 계산) · QA 실측 10 조합 계산표). 수정 전 코드에서 실패하는지 먼저 본다.
- [00:20] **체크포인트 — 수정·검증 완료, 빌드만 남음.**
  - 완료: `src/components/vocab/VocabDeck.tsx:220` 무대 클래스 `flex min-h-0 flex-1 items-center justify-center px-4 py-3` → `flex min-h-[224px] flex-1 items-center justify-center px-4 py-3` + 바로 위 한 줄 JSX 주석(이유). 새 시험 `__tests__/deckStage.test.ts` 3 케이스. 기존 시험 무수정.
  - 시험 먼저: 수정 전 코드에서 deckStage 3 중 **2 실패**(`min-h-0` 단언·계산표 `false == true`), 수정 뒤 3/3.
  - 실행 증빙(전용 미러 `~/.node-local/thekaiwa-dev059d2`, sync-local 뒤): `./node_modules/.bin/tsc --noEmit` exit 0(출력 0줄) · `./node_modules/.bin/eslint src/components/vocab` exit 0 · `DATABASE_URL=mysql://invalid… node --import tsx --test --test-concurrency=1 $(find src/components/vocab -name '*.test.ts' | sort)` exit 0 — **tests 148 / pass 148 / fail 0**.
  - 변이 확인(미러에서만 바꾸고 원복, NFS 와 diff 0 확인): 무대 클래스를 `min-h-0` / `min-h-[200px]` / `min-h-[240px]` / (min-h 없음) 으로 되돌리면 deckStage 각각 **pass 1 · fail 2**(예: 200px → 「카드 200 > 무대 안쪽 176」, 240px → 390×800 카드 215.8→216 변함).
  - 남은 일: `next build` 확인(Tailwind 가 `min-h-[224px]` 를 생성하는지 CSS 에서 grep) → Leader 보고.
  - 미커밋 파일: `src/components/vocab/VocabDeck.tsx` · `src/components/vocab/__tests__/deckStage.test.ts`(신규) · 이 기록 파일.
- [00:21] **완료 — Leader 보고.** `next build`(전용 미러) exit 0, 빌드 CSS `.next/static/chunks/*-tw.css` 에 `.min-h-\[224px\]{min-height:224px}` 생성 확인. 빌드 경고 3건은 모두 「Dynamic filesystem access causes tracing」(대화·페르소나 쪽 기존 경고, 이번 변경과 무관). 엔진·모델명 0건.
  - 계산표(무대 바깥 O = QA 실측 무대 안쪽 + 24 → 고친 뒤 max(O,224), 카드 = clamp(안쪽,200,340), 추가 `main` 스크롤 = max(0,224−O)):
    | 조합 | O | 카드 전→후 | 카드가 무대 밖으로(한쪽) 전→후 | 추가 main 스크롤 |
    |---|---|---|---|---|
    | 360×740 주제+fewer+객관식 답한 뒤(결함 #1) | 179.8 | 200→200 | 10.1(이웃 덮음)→0 | +44.2 |
    | 412×780 같은 조합 | 219.8 | 200→200 | 0(패딩 안 2.1)→0 | +4.2(도구 줄 아래 패딩 12 안 — 버튼은 다 보임) |
    | 390×800 같은 조합 | 239.8 | 215.8→215.8 | 0→0 | 0 |
    | 360×740 이전 4지선다+few 답한 뒤 | 204.5 | 200→200 | 0(패딩 안 9.75)→0 | +19.5 |
    | 360×740 주제+fewer+보기 열림(계산, QA 미측정) | 223.8 | 200→200 | 0→0 | +0.2(반올림 0~1px) |
    | 그 밖 β1-3 표 전부(F0 340·F1 287.5/340/327.5·Ac 243.5/303.5/283.5·B0·Ak 340, 390×844·412×892) | ≥267.5 | 그대로 | 0 | 0 |
  - 남는 위험: ① 결함 조합(360×740)에서 [다음 카드] 줄이 화면 아래로 44px 밀려 버튼 위쪽 약 20px 만 보인다 — 답 뒤 초점 이동은 `preventScroll:true`(설계 규칙)라 자동으로 안 올라온다. 카드 왼쪽 밀기(답한 뒤 허용)나 카드 밖을 끌어 스크롤로 닿는다. 자동 스크롤 여부는 designer 결정 사항. ② §23-7 B 「덱 스크롤 0」은 표준 조합에서는 그대로지만, 위 3 조합은 이제 겹침 대신 `main` 스크롤(Leader 대책 A 의 의도) — QA 재측정 때 0 이 아닌 값이 정상. ③ 가로 모드·아주 낮은 화면(덱 `min-h-[600px]` 바닥)에서 보기 열림 등도 무대가 224 아래로 줄던 곳은 그만큼 스크롤이 늘어난다. ④ 실기기 글꼴로 알림이 3줄이 되어도 하한이라 겹침은 없다(스크롤만 늘어남).
  - 20-Log 는 이번 지시의 수정 허용 범위 밖이라 쓰지 않음(Leader 가 기록).
