---
tags: [type/task-note, domain/vocab]
---
# task-068 QA-W2 기록 — 단어 추가·수정·상세·읽기 전용·중복·보관·사용자 격리

이력서: [[task-068-improve-wordbook]] · 감사 인계: [[task-068-rev-b-record]]
환경: 검증 서버 127.0.0.1:3011 (BUILD_ID `6AsaTjChU7esylTbQXz_I`, 공유 NAS DB), 계정 QA3(주)·QA1(보조). 시작 시 두 계정 모두 `source=mine` 0·보관함 0·`baseTotal` 7,757.
작업 폴더: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/q068/w2/`

## 진행 기록 (항목마다 바로 append)

### A. 읽기 전용 — PASS
- 기본 단어 id `cmv7qro090004w1uw8y5swcfa`(赤い) 대상. QA3·QA1 둘 다 `PATCH {meaning}` → 403 `FORBIDDEN` + `details.code='READ_ONLY'`(문구 「기본 단어는 고칠 수 없어요.」), `PATCH {chunkType}` 도 403, `DELETE` → 403 `READ_ONLY`(「기본 단어는 지울 수 없어요.」). 이어서 재조회: 뜻 「빨간」 그대로, 전체 필드 JSON 동일 [확실].
- 존재하지 않는 id: GET·PATCH·DELETE·archive 모두 404. 쿠키 없음 PATCH → 401.
- 기본 단어 DTO 에 `userId`·`seedKey` 키 없음, `origin='BASE'`·`readOnly=true` 확인.
- 다른 사용자 단어 id → 404 는 B 에서 확인.

### B. 내 단어 생성·수정·삭제·격리 — PASS (관찰 3건)
- ① `POST /api/v1/words` 조각 포함 정상 생성 → **HTTP 200**(`{word,saved:true}`), `origin='MINE'`·`readOnly=false`·`source='MANUAL'`·`jlpt=null`, DTO 에 `userId`·`seedKey` 키 없음. [관찰] 지시문은 201 이라 했지만 api-contract #41 은 상태 코드를 200 으로 정한 적이 없고 task-068 이전부터 200 이다 — 결함 아님.
- ② 본문에 `jlpt` → 400 `VALIDATION {field:'jlpt',reason:'unknown_key'}`.
- ③ `NAME·ACTION·FEELING·MODIFIER·EXPRESSION` 5유형 모두 200 으로 저장(응답 `chunkType` 일치). 잘못된 값 `'none'`·`'verb'`·`''`·`'expression'`(소문자)·숫자 5 → 400 `{field:'chunkType'}`. [관찰] `chunkType:null`/생략은 200 으로 저장(조각 없는 내 단어) — 계약 「#41 `chunkType` 선택」(빠른 넣기·채택 경로용, 28-10 L1)과 일치. 화면 폼은 검사로 막는다(F 에서 확인).
- ④ 같은 사용자 내 단어끼리 같은 표기(읽기 다르거나 없음) → 409 `CONFLICT` + `existingId`, `details.code` 없음(= `BASE_DUPLICATE` 아님). 문구 「단어장에 같은 표현이 이미 있어요.」
- ⑤ `PATCH`: 뜻+조각 변경 200(`EXPRESSION` 으로 바뀜 확인), `chunkType:null` → 400 `{field:'chunkType',reason:'required'}`, `jlpt:'N5'`·`jlpt:null` → 400 `{field:'jlpt',reason:'read_only'}`, 잘못된 조각 400, `correctCount`·`source` 400 `read_only`, 표기를 다른 내 단어와 같게 → 409 `{existingId}`. 조각 없는 옛 내 단어에 뜻만 PATCH 는 200(서버는 강제하지 않음 — 「조각 골라야 저장」은 화면 검사 몫).
- ⑥ 삭제 `DELETE` → 200 `{deleted:true,snapshotKept:true}`, 이후 GET·PATCH·DELETE 404, 목록 검색 0.
- 격리(QA1 → QA3 의 내 단어): 목록 `source=mine` 0·검색 0, GET·PATCH·DELETE·archive·unarchive 모두 404 `NOT_FOUND`. QA3 의 단어는 그대로. `categories`: QA1 응답에 QA3 가 만든 분류 「QA시험」 없음, QA3 응답에는 있음.

### C. 기본 단어와 중복(D9) — PASS (관찰 2건)
- 기본 단어 赤い/あかい 와 같은 표기·읽기 `POST` → 409 `CONFLICT` + `details.code='BASE_DUPLICATE'` + `existingId=cmv7qro090004w1uw8y5swcfa`(그 기본 단어 id). 읽기 앞뒤 공백(`'  あかい '`)도 같음. 읽기 생략·빈 문자열 + 같은 표기 → 같은 409.
- 同表記 `日`(기본 단어 ひ N4 · にち N3): 읽기 없음 → `existingId`=ひ(N4, 순서 첫 행), `にち` → にち 의 id, `ひ` → ひ 의 id. **같은 표기·다른 읽기(`じつ`) → 200 저장**(`origin=MINE`). 이어서 같은 표기 내 단어를 한 번 더 넣으면 내 단어 중복 409(`code` 없음).
- 내 단어를 기본 단어 표기·읽기로 `PATCH`(`surface+reading`) → 409 `BASE_DUPLICATE`. [관찰] 표기만 `PATCH`(`{surface:'赤い'}`)는 기존 읽기(다른 읽기)가 남아 200 — 「합쳐진 읽기」로 판정하는 것으로 보이며 계약 ② 표현 「입력 읽기」와 한 줄 어긋나 보이나 위험은 없다 [가능성 높음 — 수용].
- 뜻 채우기 `POST /api/v1/words {surface,enrich:true}`(※ 지시문의 `/api/v1/words/enrich` 라우트는 존재하지 않고 enrich 는 `POST /api/v1/words` 의 본문 플래그) — `映画`·` 映画 `(공백)·`映画`+읽기 → 409 `BASE_DUPLICATE` `existingId=cmv7qro0a002ew1uwnuz24vbc`, 응답 5~28ms(LLM 이면 수 초), `draft` 없음, `ps` 의 `claude --print` 0개 — **LLM 호출 0** [확실]. (`赤い`·`日` 는 이미 내가 만든 내 단어와 겹쳐 내 단어 중복 409 가 먼저 나옴 — 규칙대로.)

### D. 보관(사용자별 상태) — PASS
- 기본 단어 X=赤い(`cmv7qro090004w1uw8y5swcfa`) — 시작: QA3 [활성 7,765 · 보관 0](기본 7,757 + 내 단어 8), QA1 [7,757 · 0].
- QA3 `POST /archive` → 200 `archived=true`·`origin='BASE'`·`readOnly=true`, 두 번째 호출도 200 이고 `archivedAt` 그대로. 기본 단어 내용(보관·카운터 칸 제외 전체 필드) 불변 [확실].
- QA3 목록: 활성(`archived=0`)에서 X 사라지고 보관함(`archived=1`)에 나옴, 총계 [7,764 · 1], `baseTotal` 7,757 불변, `categories` 의 미분류 묶음 `archivedCount` 1.
- **QA1 은 그대로**: 활성 목록에 X 보임, 보관함 0, 상세 `archived=false`, 총계 [7,757 · 0].
- QA1 도 X 를 보관 → 각자 보관함 1개씩(QA3 [7,764·1], QA1 [7,756·1]). QA3 만 풀기 → QA3 복귀(7,765·0)·QA1 은 여전히 보관 1(7,756·1) — 상태가 섞이지 않음. 풀기를 두 번 눌러도 200. QA1 풀기 후 두 계정 [활성 전체 · 보관 0].
- 내 단어(ACTION 단어) 보관 → 200 `origin='MINE'`, `source=mine&archived=1` 에 나오고 풀면 복귀.
- 정리 상태: 보관한 기본 단어 모두 풀림(QA3·QA1 보관함 0). 남은 `UserWordState` 행은 3개(QA3×2·QA1×1)로 값은 모두 `archived=false`(행만 남음 — 서버 설계상 upsert).

### E. 상세 stats(#42) 나의 기록 — PASS (긍정 대조 일부 미확인)
- 읽기 전용 DB 조회(이 계정 쓰기 없음): 기본 단어 97개에 **QA 계정 한 명**의 `VocabAttempt` 100건이 있음(다른 사용자의 기록이 실제로 존재). 그 97단어 전부를 QA3·QA1 로 `GET /api/v1/words/:id` → `stats.attempts`·`last7d`·`evalAppearances` 합 **모두 0**, `correctCount/wrongCount` 도 0(두 계정 모두). 다른 사용자 기록이 섞이지 않음 [확실].
- 미확인: 「내 기록은 내 상세에 정확히 센다」의 긍정 쪽(세트 풀기 = 쓰기 범위 밖). 시험 T14 가 가짜 DB 로 덮는다.

## [마무리 F·G] 2026-10-14 (QA-W2 마무리 소환) — 진행 체크포인트 1
환경: 서버 3011 그대로(BUILD_ID `6AsaTjChU7esylTbQXz_I`), 계정 QA3(주)·QA1(격리 읽기). 작업 폴더 `scratchpad/q068/w2b/`(스크립트 f1~f4 · results.jsonl). 시작 시 QA3 에 **이전 소환이 남긴 내 단어 2개**(`QA画面語`·`QA画面語三` — F 시도 중 생성, 정리 누락)가 있어 삭제하고 0 으로 맞춘 뒤 시작. 화면 쓰기 허용 범위만 사용(내 단어 생성·수정·삭제, 기본 단어 보관/해제). enrich 는 `page.route` 모의(映画 한정 실서버 통과 — 서버가 LLM 전에 409 하는 것을 API 단계에서 확인한 바로 그 경로).
- **완료(F1·F2·F3·F4·F5·F8 일부, 390×780 라이트)**:
  - F① 추가 시트(직접 입력): 「수준」 글자·select 0, 조각 라디오 5개(이름·액션·느낌·꾸밈·표현, 묶음 이름 「조각*」·`aria-required=true`), 5유형 힌트 문구가 가이드 28-3 A 표와 글자 그대로 일치, 조각 미선택 저장 → 「조각을 골라 주세요」(`role=alert`, 묶음 `aria-invalid=true`, 초점 = 첫 칩 `wadd_chunkType`, **저장 요청 0건**), 칩 고르면 오류 사라짐, 저장 본문 `{surface,meaning,partOfSpeech,reading,chunkType}`·`jlpt` 키 없음, 저장 후 시트 닫힘·토스트 「단어장에 넣었어요 · 내 단어는 나만 봐요」·**목록 맨 위 행 = 새 단어 + 「내 단어」 + 「액션 조각」** [확실]. (이전 소환 f1.json 의 「맨 위 행이 会う」는 목록 다시 읽기 전에 읽은 시점 문제 — 재현 안 됨.)
  - F② 시트 첫 단계: 버튼 = [뜻 채우기]·[직접 입력하기] 뿐, 「넣기」 글자 0 — PASS.
  - F③ 초안(`page.route` 모의 4회): `chunkType:'ACTION'` → 「액션」 미리 선택 + 안내 「선생님이 고른 조각이에요 · 바꿀 수 있어요」; 칩을 「느낌」으로 바꾸면 안내 사라짐; [다시 채우기]로 `EXPRESSION` 초안 → 「표현」 미리 선택 + 안내 다시; `chunkType` 키 없음·`null` → 미리 선택 0·안내 0·그대로 저장하면 「조각을 골라 주세요」 차단; 직접 입력 → 안내 0 — 전부 PASS.
  - F④ 실제 `映画`: 직접 입력 `映画/えいが` [저장] → 서버 409 `BASE_DUPLICATE`(`existingId=cmv7qro0a002ew1uwnuz24vbc`), 표현 칸 아래 `role=alert` 「기본 단어에 이미 있어요」+[그 단어 보기]+안내문, 표현 칸 `aria-invalid`, 초점 = 표현 칸; [그 단어 보기] → 추가 시트가 닫히고 기본 단어 상세(「기본 단어」 뱃지, 수정·삭제 없음)가 열리고 초점은 시트 제목 「단어」; 뜻 채우기 단계에서도 같은 409(실서버, LLM 없음) · 표현을 고치면 안내 사라짐 — PASS.
  - F⑤ 기본 단어(会う): 폼·입력칸 0, 버튼 = 「보관 — 목록 · 오늘의 단어에서 숨기기」 하나, 뱃지 줄 = 명사·초보자 (N5)·액션 조각·기본 단어, 출처 문장 = 가이드 28-5 D 원문, 「추가한 날」·「내 단어」·「나만 봐요」 0. 보관 → 토스트 「보관했어요 · 목록과 오늘의 단어에서 숨겨요(나에게만)」·단추 「보관 풀기 — 다시 보이기」·「보관함」 뱃지·초점이 단추에 남음, 풀기 → 토스트 「보관을 풀었어요 · 다시 보여요」·서버 `archived=false` 복귀. `?word=<기본 id>` 로 상세가 열리고 URL 이 `/drawer/words` 로 정리됨. **편집 우회**: 코드가 읽는 쿼리는 `word`·`add` 둘뿐(`page.tsx`) — `?word=<id>&edit=1`·`&mode=edit`·`&edit=true#edit`·`&action=edit`·`?edit=1&word=<id>` 모두 읽기 전용 상세만 열림(form/input 0, [수정] 0), `?edit=<id>` 단독은 시트 자체가 안 열림 — PASS.
  - F⑧ 목록 행: 기본 단어 행 「会 액션 조각」 — 「내 단어」 없음·조각 뱃지 있음 PASS.
- **남은 일**: F⑥(내 단어 상세·출처 문장·단추 구성)·F⑦(수정 폼 조각 변경 반영)·F⑨(500 모의 오류 문구·폼 값 유지)·G(교정 모음)·H′(접근성·터치 44·11px·가로넘침·Esc/초점)·360/412·다크.
- **다음 첫 명령**: `node scratchpad/q068/w2b/f5.mjs` (F⑥⑦⑨) — 아직 없으면 새로 작성.
- **주의/정리 목록**: QA3 내 단어 `QA画面語甲`(F① 생성, id 는 `w2b/own.jsonl`) — 최종에 전부 DELETE. 보관한 기본 단어 없음(会う 는 풀었음, `archived.jsonl` 기록). 쿠키 `w2b/c3`·`c1`(600) — 끝에 삭제. 서버 3011·3010 건드리지 않음.

### [마무리 F·G] 최종 — F⑥~⑨ · G · H′ (checkpoint 2, 소환 종료 시점)
환경 동일(서버 3011·BUILD_ID `6AsaTjChU7esylTbQXz_I`, QA3 쓰기·QA1 읽기). LLM 호출 0: enrich 는 `page.route` 모의(映画 한정 실서버 409 통과), 8분 표본 수집(`ps` 1초 간격)에서 `claude --print` 0건. 판정 근거는 전부 실브라우저(Chrome headless=new, 모바일 에뮬레이션 DPR 2.625, ko-KR/Asia/Seoul, reducedMotion).
- **F⑥ 내 단어 상세 — PASS**: 뱃지 줄 = 기타·액션 조각·**내 단어**, 출처 「내가 넣은 단어예요 · 나만 봐요」, 「추가한 날」 있음, 단추 [수정](175×48)·[보관하기](175×48) 한 줄 + 아래 가운데 글자 [삭제](58×44), 「기본 단어」 글자 0.
- **F⑦ 수정 — PASS**: 폼에 「수준」 0·조각 칩 현재값(액션) 체크·안내 「맞힘·틀림 기록과 출처는 바꿀 수 없어요.」. 꾸밈으로 바꾸고 뜻 수정 저장 → `PATCH {meaning,chunkType:"MODIFIER"}`(`jlpt` 키 없음) → 토스트 「고쳤어요」·상세에 「꾸밈 조각」·목록 행 「내 단어 꾸밈 조각 …(수정)」·서버 값 일치.
- **F⑧ 목록 행 — PASS**: 기본 단어 행(`会あう 액션 조각 만나다`) 「내 단어」 없음·조각 뱃지 있음 / 내 단어 행 「내 단어」+조각 뱃지. 보관한 기본 단어는 활성 목록 7행에서 빠지고(전·후 7행) 보관함 보기에 1건으로 나옴, 보관함에서 풀면 비어 보임(「보관한 단어 0개」)·QA1 보관함 0 — 화면 기준 PASS(이전 소환 D 는 API 기준).
- **F⑨ 오류 — PASS**: 추가 [저장] 500 모의 → `role=alert` 한 줄(높이 19.5px = 한 줄) 「처리하지 못했어요. 다시 시도해 주세요.」, 시트 열린 채·표현/읽기/뜻/조각(느낌) 값 그대로·[저장] 글자 복귀. 수정 저장 500 도 같은 한 줄·뜻 입력값 유지. 문구에 엔진 단어·서버 원문(`Internal Server`)·상태 숫자 0.
- **G 교정 모음 — PASS**: ① `GET /api/v1/drawer/corrections?chunkType=EXPRESSION` → **400** `{field:'chunkType'}`(`none`·소문자 `expression` 도 400, `NAME` 은 200). ※ 지시문의 `/api/v1/corrections?chunkType=…` 는 #34(교정 목록)로 `chunkType` 파라미터가 없어 무시되고 200 — 조각 필터 라우트는 #79 `/api/v1/drawer/corrections`(계약 §2-17). 결함 아님. ② 화면: QA3 는 채택 교정이 0건이라 칩 줄 자체가 안 그려진다 → **이 경우 칩 검사는 공허**하므로 `page.route` 로 목록 응답을 모의(교정 2건 + facets)해 칩 줄을 그렸다 — 「조각」 묶음 = [전체 (모든 조각), 이름, 액션, 느낌, 꾸밈] **5개**(전체+4, 「표현」·「없음」 0), 칩 「액션」 누르면 요청 `?chunkType=ACTION&limit=20`, 360/390(라이트·다크)/412 가로 넘침 0. ③ 코드 변경은 `ChunkChips` prop 이름만(`withNone={false}` → `variant="corrections"` 두 곳, git diff 2줄) — 문구 불변. (※ `w2b/results.jsonl` 의 `G-screen-*` 첫 4줄(g1)은 빈 상태라 공허한 PASS 였으므로 **무효**, g2 줄로 대체.)
- **H′ 접근성·터치 — PASS(관찰 1건)**: 360/390/412 × 라이트/다크 6조합 × 9개 상태(목록·추가 1단계·폼·조각 오류·초안 안내·기본 단어 중복 안내·기본 상세·내 상세·수정 폼). 가로 넘침 요소 0·페이지 가로/세로 스크롤 0·터치 44px 미만 0(칩은 보이는 36 + `::before` 44 히트영역 포함 계산)·11px 미만 0(최소 11.5px). 측정기는 일부러 나쁜 요소(30×20 단추·9px 글자·500px 폭)를 넣은 대조에서 셋 모두 잡는 것을 확인했다(공허하지 않음). 다크 토큰 반전: body 배경 `rgb(246,247,244)`→`rgb(20,24,22)`·글자 `rgb(30,36,32)`→`rgb(236,239,233)`. 실브라우저 AX 트리(CDP): 폼 라디오 묶음 이름 「조각」(`required`, 오류 때 `invalid`+`describedby`=「조각을 골라 주세요」)·라디오 이름 「이름·액션·느낌·꾸밈·표현」(checked 상태 정확), 오류 줄 `role=alert`. 첫 화면 CTA [＋ 추가] 가 뷰포트 안(y=4, 67.7×44). Esc: 추가 시트·상세·수정 모두 닫힘, 초점은 열었던 [＋ 추가] / 그 행 단추로 복귀. 시트 처음 초점: 추가 = 표현 입력, 상세 = 시트 제목 「단어」.
- **결함: 0건.** Critical/High/Medium/Low 모두 없음.
- **관찰(결함 아님)**: ⑥ 공용 `components/common/Sheet.tsx`(작업 트리 미수정 — task-068 밖)가 `aria-modal="true"` 이면서 Tab 초점 가두기가 없다 — 추가 시트에서 [취소] 다음 Tab 이 뒤쪽 페이지(앱바·목록 단추)로 샌다(CDP 로 40회 Tab 추적). 기존 동작이라 task-068 범위 밖, 공용 시트 개선 후보 [확실 — 실측, 원인 코드 읽음]. ⑦ 지시문의 `page.route('/api/v1/words/enrich')` 는 없는 경로 — 뜻 채우기는 `POST /api/v1/words {enrich:true}`(이전 소환 C 에서도 확인) 라 그 본문 플래그로 모의했다. ⑧ f2 실행 직후 `ps` 에 `claude --print` 1건이 한 번 보였으나(원인 미상 — enrich 는 모의로 서버에 안 갔고 그 뒤 8분 표본에서는 0건) 내 요청과 연결되지 않는다 [추측: 다른 레인 또는 앱 예열].
- **미확인(NOT_VERIFIED)**: 실기기 TalkBack(Q13)·앱 WebView 글꼴 130%·실기기 키보드 가림 / 목록 조각 칩 줄 끝 「표현」이 360 에서 밀어서 닿는지(Q12 — 이번 소환 F·G·H′ 범위 밖, 가로 넘침 0 만 확인) / 쪽 넘김·쪽 이동 시트·D2(Q1·Q2·Q4) / 교정 채택 시트의 기본 단어 연결(Q7 L4)·오늘의 단어 세트 / 선생님 초안의 실제 LLM 조각 품질(이전 소환 H 가 덮음) / 내 기록 긍정 대조(세트 풀기 = 쓰기 범위 밖).
- **정리 완료**: QA3·QA1 모두 `source=mine` 0·보관함 0·활성 7,757(기본 단어 전체) 확인(cleanup 로 내 단어 `QA画面語甲` 1개 삭제 — 이 소환 중 만든 것 전부 + 시작 때 지운 이전 소환 잔여 2개). 보관한 기본 단어 모두 해제(会う — 서버 `archived=false`). `UserWordState` 행 1개 추가 생성(会う, 값 `archived=false` — 서버 upsert 설계). 쿠키 파일(`w2b/c3`·`c1`) 삭제. 스크린샷 폴더 `/tmp/qa-artifacts/TheKaiwa/task-068-w2b/` 삭제(산출물 정리: 스크립트가 찍은 PNG 전부 삭제 — 삭제 직전 개수를 세지 못했고 스크립트 구성상 약 46장). 내가 띄운 `ps` 표본 루프 PID 종료. 헤드리스 크롬은 스크립트 종료 때마다 `browser.close()`(실패한 첫 f4 시도는 pipe 종료로 같이 종료) — 종료 후 `playwright_chromiumdev` 프로세스 0. 서버 3011(·3010)은 그대로(리스닝 확인), 3012 없음.
- **판정**: F①~⑨ PASS · G PASS · H′ PASS · 결함 0건 — **QA-W2 마무리 PASS**(미확인 항목은 실기기·타 레인).
