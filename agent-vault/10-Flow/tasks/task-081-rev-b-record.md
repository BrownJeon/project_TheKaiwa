---
tags:
  - type/review
  - domain/prompt
task: task-081
reviewer: rev-081-b
status: 최종 — PASS_WITH_NOTES (B + B2 통합: Critical 0·High 0·Medium 2·Low 12)
---
# task-081 감사 B — 프롬프트·LLM 계약·측정 하네스 (REV-081-B)

## 중간 기록 (임시 — 최종 판정 때 이어서 완성)

확인한 것(직접 읽고/실행): `lessonPieces.ts` 전체, `checks.ts`·`repair.ts`·`schemas.ts`·`index.ts` diff, `prompts/{lesson,reviewMix,piecesInstruction}.ts`, 엔진 `runJsonWithRetry`/`evaluateAttempt`, `tutor.md` diff + 모드별 persona 내용, 골든 2개 diff 요약(필드별), 측정 하네스 가드, `task-081-pe-data/` 요약 JSON 재계산, 범위 시험 5묶음(미러 `thekaiwa-t081int`: lessonPieces·LiveReg·Live·lesson·reviewMix 173/173, lessonScenario·talkScenario·task039·wordEnrichChunk 59/59 통과).

반례 실행(미러, `node --import tsx`): 직접 만든 40여 건 경계 입력 + 무작위 2만 건 불변식 시험(글 이음·type 열·길이·꼬리 slash 없음·멱등·slash 개수 비증가·LINK 앞 slash 잔존 0) — 위반 0건.

### 발견(잠정)
| # | 심각도 | 위치 | 내용 |
|---|---|---|---|
| 1 | Low | `lessonPieces.ts:171` | `slashMoved` 가 «옮긴 뒤 줄 끝에 닿아 꼬리 정리가 다시 지우는» 이동도 센다(`私は` → moved 1, slash 0). 데이터 영향 없음, 계측 지표만 부풀 수 있음. |
| 2 | Low | `lessonPieces.ts:124-136` | 같음 판정은 NFC 정규화 뒤 비교인데 저장은 원본 조각(`p.ja`)이라 NFD 조각이 NFC 줄과 «같음» 으로 통과할 수 있다. 화면 `chunkLogic.pieceRanges` 가 정확 일치만 인정하므로(읽기 없는 평문 폴백) 깨지진 않음 — 수용 가능, 문서화 권고. |
| 3 | Low | `.claude/agents/tutor.md` | 요청 설명(«§1 한 구절»)과 달리 hunk 2개: §1 한 줄 + §6 표 LESSON 행(`quiz` → `pieces`). TALK/CHAT/REVIEW persona 는 §1 만 바뀜(LESSON persona 만 §6 행도 바뀜 — 모드별 로드로 확인). 다른 모드 골든 바이트는 안 바뀜(talk 골든 = persona 해시 8개 + 라벨만). |
| 4 | Low | 골든 라벨 | `lesson-general-golden.json` `capturedFrom` 이 «PE 1단계» — 해시는 현재(3단계 보정 후) 바이트와 일치(시험 통과), 라벨만 낡음. `lesson.ts` 주석 «10,215» ≠ 실측 10,218(천장 10,250). |
| 5 | Low | `reviewMix.ts` | A5 는 `stripAdditionalProperties` 미사용(Leader 결정 ④) — pieces 항목에 군더더기 키 1개만 붙어도 ajv 위반→재시도(+40s). A4 는 시험으로 보호. |
| 6 | Low-Med | 측정 하네스 | `HARD_CAP`·`MAX_CALLS` 는 «실행 1회» 상한이다. 원장(`*.calls.json`)은 기록만 하고 상한 판정에 읽히지 않는다(새 OUT 이면 처음부터 다시 셈). `npm test` 는 안전(첫 spawn 에서 `LIVE_OK` 삭제, 둘째는 틀린 값)이나 «총량 40회 강제» 문구는 과장. |

다음에 볼 것: lessonScenario 경로 주입 표면, screens.md §37-12 ↔ 코드 대조, 새 시험의 단언 품질(공허 통과 여부), 측정 해석(표본 구성·수준별 null 편중).

---
## B2 (rev-081-b2, 이어받기) — 중간 기록 1 (항목 1·2 완료, 3·4 진행)

### 항목 1 — lessonScenario 경로 주입 표면 [확실, 코드 읽기 + `git diff` 비주석 줄 전수]
- **새 주입 표면 없음.** v10 에서 `renderScenarioBlock`·`clipScenarioText`·`SCENARIO_RENDER`·`LESSON_SCENARIO_BLOCK_MAX`(460) 코드는 한 줄도 안 바뀌었다(diff 의 비주석 변경 = import 2·버전 상수·CAP·instruction 문장·extraCheck). 사용자 글(상황·주제·원문)은 `messages[0].content`(user 메시지)에만 들어가고, 조각 지침 줄(`PIECES_INSTRUCTION_LINE`)은 `system` 의 `lessonInstruction` 안 — `dialogue` 줄 다음·`SCENARIO_LESSON_LINE` 앞 — 이라 **사용자 글보다 앞**이다(`INJECTION_GUARD` 는 instruction 맨 끝, 그대로).
- 새로 저장되는 LLM 글은 조각 `ko`(≤30자) 뿐이고(조각 `ja` 는 줄 `ja` 와 NFC 일치라 새 글이 아님), 다른 프롬프트로 되먹임되는 곳이 없다(`grep pieces src/modules/conversation/prompts` = lesson·reviewMix·piecesInstruction 외엔 evalGen 의 무관한 ASSEMBLE `prompt.pieces` 뿐). 엔진명 검사(`checks.ts`)는 조각 `ja`·`ko` 까지 넓어졌다 — 시험 있음(lesson.test.ts:522).
- 3경로 공유: A4 일반·붙여넣기·상황(WITH_TOPIC/ONLY)은 **같은 `lessonInstruction`·같은 `extraCheck`**(isLast 면 `tolerateContentMismatch`+`tolerateInvalidPieces`)를 쓴다. A5 `reviewMix` 는 같은 **지침 줄 상수**(시험 reviewMix.test.ts:48 이 동일성 고정)를 쓰지만 `extraCheck` 는 **별도 복사본**이다 — 조각 임계만 면책하고(`tolerateContentMismatch` 는 켜지 않음 = v3 이전부터의 차이), 면책 조건이 `strictDetailed.some(kind==='pieces')`. 동작 차이는 의도된 것으로 읽힌다. → 아래 Low-1.
- 길이 한도 시험 범위: A4 주제(a)·(b 실제 한도 최악 ≤10,250)·sourceText(a/b)·상황(delta ≤780)을 덮는다. **A5 reviewMix 는 프롬프트 총길이 시험이 없다**(헤더 600 시험뿐 — 변경 전 HEAD 에도 없었음 = 기존 공백, 이번에 quiz 줄 -690 → 조각 줄 +1,198 로 순증가 ≈ +500자). 상황 시험은 실제 최악을 재지 않고 **하드코딩 10_215**(실측 10,218 — Low #4)에 delta 를 더한다.
### 항목 2 — screens.md §37-12 ↔ 코드 대조(어긋남 목록, 문서 거짓/낡음)
| # | 문서 위치 | 문서 주장 | 코드 사실 | 판단 |
|---|---|---|---|---|
| D1 | 37-12-3 규칙 6, 37-12-1 `slash?` | «slash 는 **마지막 조각이면** 지운다» | `lessonPieces.ts:172-177`: **뒤에 type 있는 조각이 하나도 없으면**(문장부호 조각만 남아도) 지운다 — 실행 확인: `ください／。` → `ください。`(slash 사라짐) | **문서 수정**(코드 파일 머리 «PE 확정 1» 로 의도됨, 37-12-6 `phraseText` 방어와 일관) |
| D2 | 37-12-3 규칙 7 | «slash 가 켜진 조각 바로 뒤가 LINK 면 …끝으로 옮긴다» | `type === null` 조각의 slash 는 **옮기지 않는다**(`:94`), 구간 안 다른 LINK 의 slash 는 **접는다**(`:98`) — 실행 확인 `私／を／は` → `私 を は／` | **문서 수정**(예외 두 개 명시) |
| D3 | 37-12-2 | 골든 3종 `{lesson,lesson-general-golden,review-mix}.json` 재기록 | `lesson.json`·`review-mix.json` 은 **입력 픽스처**(quiz·pieces 키 0, 안 바뀜). 재기록된 골든은 `lesson-general-golden.json` 하나(+talk 골든은 persona 해시) | **문서 수정** |
| D4 | 37-12-2 | `type:{type:['string','null'],enum:[…,null]}` | 실제는 `anyOf [{type:'null'},{type:'string',enum}]`(`schemas.ts` 주석: 구조화 출력이 type 배열+enum null 을 안정적으로 못 다룸) | 문서 수정(의미 같음) |
| D5 | 37-12-3 머리 / 37-15 표 | 검증 함수가 «서버 `content.ts` 순수 함수»·`toStoredContent`(줄별 validatePieces) | 규칙은 `conversation/structuredResponse/lessonPieces.ts`(L2) 단독 소유이고 `content.ts` 는 **재검증 없이** `Array.isArray(d.pieces) ? d.pieces : null` 만(`content.ts:101`). 정리는 `extraCheck` 가 한다 | **문서 수정**. 코드 쪽 방어 공백은 아래 Low-2 |
| D6 | 37-12-4 Leader 추가 문장 | 스키마 하드 한계 = «조각 ja 40자·ko 30자·pieces 1~24·slash 필수» | 한계 목록이 **불완전**: 같은 스키마 층에서 걸리는 것에 `type` 열거값(6값·null 밖), `ja` ≥1자, 필수 키(`pieces`·`ko`·`type`) 누락도 있다(`schemas.ts` lessonPiece). 이들은 «null 저장» 이 아니라 재시도→실패 | **문서 수정**(목록 보강; 문장 취지는 맞음) |
| D7 | 37-12-5 `ko` 줄 | «높임·정중은 괄호(`드세요(높임)`)» | 프롬프트(`piecesInstruction.ts`)에 **없다**(대신 문말 よ «~요(강조)»·«~이에요 금지»·に «~에/~하러» 가 있다). 예산 천장(10,250) 때문에 뺀 것으로 보임 | **문서 수정**(또는 «프롬프트에는 싣지 않음» 표기) |
| D8 | 37-12-5 마지막 줄 | «명사+です 등 애매한 경우는 PE 가 규칙을 정하고 골든에 넣는다» | PE 가 정했다: です/ます/でした/ました 는 앞 조각에 붙임(学生です=NAME), 문말 か·ね·よ 만 LINK, 떼어 낸 ですか 를 EXPRESSION 으로 만들지 않음, 수량=NAME, する동사/〜ている=ACTION, 정형 인사·부탁·부사+です=EXPRESSION — 그런데 **표는 FEELING 행에만 «です 는 앞에 붙임»**, 나머지 확정은 코드 주석에만 있다. «골든에 넣는다» 도 사실 아님(골든은 프롬프트 바이트 해시, 판정 골든은 `lesson-pieces-cases.json` 은 결정적 검증용) | **문서 수정**(확정 내용을 표로 옮길 것) |
| D9 | 37-12-4 «`toolLog` 에 piecesNullLines·piecesTotal» | — | `generate.ts:345-348` SAVE 단계 steps 에 있다(RequestTrace). 일치 ✔ | 일치 |
- 일치 확인: 규칙 1~5(길이·NFC 같음·type↔문장부호·ko 1~30·typed≥1), 임계 «위반 줄 × 2 > 줄 수»(`lessonPieces.ts:206`), 마지막 시도 면책 → 위반 줄 null(`lesson.ts`·`reviewMix.ts` 둘 다), 종류 표(NAME·ACTION·FEELING·MODIFIER·EXPRESSION·LINK)·끊어 읽기 지침, 필수 `slash:boolean`·`ko` 30자·`ja` 1~40.
- **코드 수정이 필요한 어긋남은 없다.** 전부 문서 수정(D1~D8). D5 만 코드 방어(Low-2) 선택지.

---
## B2 — 항목 3·4 + 최종 판정 (rev-081-b2)

### 항목 3 — 새 시험 단언 품질 (변이는 미러 `~/.node-local/thekaiwa-t081int`, 임시 파일+`mv`, 매번 원복 후 NFS 원본과 `cmp` 일치 확인 — 전부 `restored==NFS ok`, 미러 링크 수 1·`mirror-audit --check` exposed 0)
기준선: `lessonPiecesLive+lessonPieces+LiveReg` 88/88 통과.
| 변이 | 결과 | 해석 |
|---|---|---|
| B `scoreVerdicts` G6 세 경계를 모두 `<`/`>` 로 | 1건 실패 | `mk(30,8)` 이 틀림 정확히 5%(2/40)라 **틀림 ≤5% 경계만** 잡힘 |
| **B2 `right >= 0.70` → `>`** | **12/12 통과(생존)** | **맞음 ≥70% 경계(28/40)가 시험에 없다** — 1차 판정 67.5%·2차 75% 가 경계에서 멀어 결론엔 영향 없음 |
| **B3 `right+awk >= 0.92` → `>`** | **생존** | 92% 경계 미시험(37/40=92.5%) — 같은 이유로 결론 영향 없음 |
| **C `rows.length >= MAX_CALLS \|\| rows.length >= HARD_CAP` → `false`(상한 제거)** | **17/17 통과(생존)** | **main 루프의 호출 상한은 행동으로 시험되지 않는다** — 시험은 상수값(`KIND_CAP`·`HARD_CAP`)과 «`LIVE_OK` 없으면 호출 0» 만 본다(라이브 호출 없이는 루프를 못 돌리므로 불가피하지만 이 가드가 «시험으로 보호된다» 는 말은 틀림). 이전 중간 기록 #6 의 근거 보강 |
| P4 G2a `<= 2/12+1e-9` → `<` | 1건 실패(잡힘) | «12회 중 2» 경계는 시험이 고정 |
| P2 마지막 시도에서 `tolerateContentMismatch` 제거 | 3건 실패(잡힘) | A4 기존 ④ 면책 보호 유지 |
| K1 스키마 `slash` 필수 제거 · K2 대화 줄 `pieces` 필수 제거 | 각 2건 실패(잡힘) | 구조화 출력 계약 보호됨 |
| P3 `reviewMix` 면책 조건에서 `some(kind==='pieces')` 제거 | 생존 | 로그 문구만 달라지는 **동치 변이**(무시) |
- 픽스처 `lesson-pieces-cases.json` 은 경계(24/25조각·ja 40/41·ko 30/31·서로게이트·NFC/NFD·ー·slash 꼬리/옮김/접힘/문장부호 보호)를 촘촘히 덮는다 — 이 파일은 강하다 [확실, 목록 전수 확인].
- **공허/약한 단언(읽기 근거)**: ① `lessonPieces.test.ts:55` `assert.deepEqual(c.pieces, JSON.parse(JSON.stringify(c.pieces)))` — «입력을 건드리지 않는다» 주장인데 `c.pieces` 는 `checkPieces` 에 한 번도 넘겨지지 않고(항상 `structuredClone`) 자기 JSON 왕복과 비교하므로 **항상 참**. ② `lessonPiecesLive.test.ts:143` `gate(summarize([])).every(g => g.pass === null || typeof g.pass === 'boolean')` — 타입상 늘 참(동어반복). ③ `:121` `c.r2.gate.G2a.pass === true` 는 행 1개(재시도 0)라 사실상 스모크. ④ **`completeJson` 수준 통합 시험이 pieces 에는 없다** — `extraCheck` 제자리 정리가 «저장되는 응답» 에 반영되려면 엔진이 `extraCheck` 에 넘긴 객체를 그대로 돌려줘야 하는데(읽기로 확인: `schemaValidate.ts:424-425` 호출·`:453·463` 같은 `data` 반환 [확실]) 시험은 `extraCheck` 를 직접 부를 뿐이다(v7 `completeJson` 시험은 `application` 의 군더더기 키만 봄). ⑤ **A5 reviewMix 프롬프트 총길이 시험이 없다**(헤더 600 시험뿐, HEAD 에도 없던 공백 — 이번에 quiz 줄 ≈-690 → 조각 줄 +1,198 로 ≈+500자) · 상황 예산 시험은 실제 최악 대신 **하드코딩 `10_215`**(실측 10,218)에 delta 를 더한다(`lessonScenario.test.ts:227`) — 실제 최악이 천장 10,250 까지 올라도 11,000 단언은 안 깨진다.

### 항목 4 — 측정 해석의 정직성 [확실: 저장 행으로 하네스 `summarize/gate` 재계산, 보고 수치와 전부 일치]
- **산수·정의**: core G1a 42.6s·G1b 80.2s·G2a 2/12(`≤ 2/12+1e-9` — 정확히 경계에서 통과, 재시도 2건은 `speaking[2].modelAnswerJa`·`application 항목 수` 로 **조각과 무관**)·G3a 5/102(4.9%)·G4 0/528·G5a 2/137(1.46%)·**G5b 6/102(5.88%) 불합격**, r2 6/6 호출 0/52줄(G5b 0%)·재시도 0·G4 0/255. 코드 `GATE` 숫자 = 이력서 «사전 등록» 줄(111행)과 일치(2/12·10%·3%·3%·5%·G6 5/70/92%·n≥40). G6 는 **한 함수**(`scoreVerdicts`)로 1차 27/40=67.5%(불합격 −2.5%p)·2차 30/40=75%(합격)를 같은 정의로 판정 — 판정 파일 머리가 «기준·판정 정의는 1차와 같다» 라 명시.
- **«열쇠 열기 전 고정»**: 파일 시각은 모순이 없다(core 시트 15:01 → 판정 15:07, r2 시트 15:28 → 요약 15:29 → 판정 15:32, reg 15:38). 다만 **키 파일 atime=mtime(NFS)이라 열람 시점은 파일로 증명되지 않는다** — 판정자(Leader) 진술에 의존. 시트는 단일 arm 이라 키가 알려 주는 건 «어느 호출·주제» 뿐이라 누출 위험은 작다. [확실 사실 / 판단: 허용]
- **과장·누락 4가지(사용자 보고 문구 권고)**: ① **헤드라인 «G5b 5.9% → 0%»** 는 사전 등록된 좁은 휴리스틱(い/な형용사 뒤 です 분리)이다 — 같은 하네스의 넓은 지표 `lonelyCopulaLines` 는 core **18/102줄(17.6%) → r2 0/52**, `slashBeforeLink` 14 → 0(단, r2 는 **결정적 보정 뒤 저장 데이터**라 0 은 구성상 값이고 보정이 옮긴 건 2/52줄 — 모델 원출력 비율은 13.7% → 3.8%). 규모를 정직하게 말하려면 넓은 지표를 같이 쓸 것. ② **G6 67.5% → 75%** 는 통계적으로 구분되지 않는다(Wilson 95% 52~80% vs 60~86%, Fisher p≈0.62 [계산]) — 개선의 증거는 %가 아니라 **원인별 제거**(① 5줄→0·③ 3줄→0·④ 1줄→0, 남은 10줄 전부 ② 종류)다. 사용자 보고에도 «어색 13→10줄, 남은 건 종류 표기» 로 쓸 것. ③ **② 종류 계열은 오히려 안 줄었다** — 하네스 지표 `greetingAsAction` core 1/102줄 → r2 4/52줄, 이 지표들은 G5 게이트에 들어 있지 않다(사전 등록 밖). 이력서가 이미 «알려진 한계» 로 공개 결정 — 유지하되 «정형 인사 액션 오분류가 보정 뒤 늘었다» 를 같이 적을 것. ④ **표본 구성 차이**: r2 는 «어색이 몰린 주제(자기소개·카페·여행)를 일부러 포함» 한 TOPIC 6호출(풀 52줄 중 40줄=77% 표본)이고 core 는 12호출(풀 102줄 중 40줄=39%, 복습 2·상황 1·붙여넣기 1 포함, **보정 전 지침**) — 같은 입력이 아니다. 복습·상황·붙여넣기는 **보정 후 각 n=1**(reg 3호출)이고 눈가림 없이 Leader 훑기(26줄 중 틀림급 1)라 «경로별 품질 확인» 이 아니라 «계약·지연 회귀 확인» 으로만 말할 것. reg 에서 null 1줄(`type_null_mismatch`, 두 문장 줄)은 원본 미보존으로 **원인 미상**. + 판정 기준(지침 표)과 보정 지침이 같은 뿌리(암묵 규칙 «부사+です» 가 보정 지침 규칙이 됨)·1인 판정 — «팀 기준에 맞춤» 이지 독립 품질 보증이 아님(최종은 폰 확인).
- **호출 횟수 표기**: 이력서의 «누적 21» 은 **호출 수**다. core 는 «CLI 시도 14(재시도 2)» 라 재시도 포함 실제 CLI 실행은 **23회**(core 14+r2 6+reg 3). 40회 승인 안(승인이 «호출» 기준이면 21, «실행» 기준이면 23)이라 어느 쪽이든 안전하나 보고는 «호출 21(재시도 포함 CLI 23)» 로 쓸 것.
- **#6(하네스 총량 40 «강제») 한 줄 권고**: 사용자 보고에는 «하네스는 실행마다 상한(core 12·r2 6·reg 3, 한 번에 20 초과 불가)을 걸고 원장으로 사후 집계했으며, 총 40회 한도는 소환 지시와 원장 합산(호출 21·CLI 23)으로 지켰다» 로 쓰고 «하네스가 40회를 강제했다» 는 쓰지 말 것 — 상한 루프는 시험으로도 보호되지 않는다(변이 C 생존).

### 최종 발견 목록 (B + B2 통합)
| # | 심각도 | 위치 | 내용(권고) |
|---|---|---|---|
| B1~B5 | Low ×5 | 이전 중간 기록 #1~#5 | 그대로(slashMoved 과계수·NFD «같음» 통과·tutor.md hunk 2개·골든 라벨/주석 10,215·A5 strip 미사용) |
| B6 → M2 | **Medium**(엄격 집계) | 하네스 `HARD_CAP`/`MAX_CALLS` + `lesson-pieces-live.ts:565` | 상한은 실행당이고 총량은 소환 규율·원장 사후 집계. 루프 상한은 변이 생존 = 미시험. 권고: 문구 정정(위) · 필요 시 원장 합산을 읽어 막는 코드는 후속 |
| M1 | **Medium** | `docs/screens.md` 37-12-1·2·3·4·5·15 | 문서가 코드와 다르다 D1(rule 6 «마지막 조각» ↔ 코드 «뒤에 type 조각 없음»)·D2(rule 7 예외 2개)·D3(골든 3종 ↔ 1종)·D4(type 스키마 모양)·D5(검증 위치 `content.ts` ↔ `lessonPieces.ts`·`toStoredContent` 재검증 없음)·D6(스키마 하드 한계 목록 불완전: type 열거·ja ≥1·필수 키 누락 추가)·D7(높임 괄호 지침은 프롬프트에 없음)·D8(です 붙임 등 PE 확정이 표에 없음). **전부 «문서 수정»**, 코드 수정 필요 0 |
| L6 | Low | `reviewMix.test.ts` | A5 프롬프트 총길이 시험 없음(순증 ≈+500자) |
| L7 | Low | `lessonScenario.test.ts:227` | 하드코딩 10_215(실측 10,218) |
| L8 | Low | `lessonPieces.test.ts:55`·`LiveTest:143` | 공허한 단언(항상 참) |
| L9 | Low | `lessonPiecesLive.test.ts` | G6 70%·92% 경계 변이 생존(결론 영향 없음) |
| L10 | Low | 시험 공백 | `completeJson` 수준 pieces 정리 반영 시험 없음(엔진 참조 동일성은 읽기로 확인) |
| L11 | Low | `content.ts:101` | `toStoredContent` 가 `Array.isArray(d.pieces)` 만 보고 재검증 없음 — `extraCheck` 를 우회하는 생성 경로가 생기면 미검증 조각 저장(화면은 평문 폴백·`audioText` 는 `isPiece` 가드로 안전). 현재 호출처는 A4·A5 둘뿐이고 둘 다 `extraCheck` 를 단다 [확실] |
| L12 | Low | 이력서 보고 문구 | 헤드라인 수치·통계 구분·표본 구성·n=1·CLI 23회(위 4가지) — 사용자 보고 시 보정 |
- 집계: **Critical 0 · High 0 · Medium 2(M1 문서 드리프트·M2 호출 상한 문구/미시험) · Low 12**. 코드 결함(Critical/High) 없음, 줄 단위 불변식 2만 건·경계 40여 건 위반 0(이전 기록), 3경로(일반·상황·복습) 지침 줄·`extraCheck` 구조 일관, 새 주입 표면 0.
- **판정: PASS_WITH_NOTES** (Critical 0·High 0). 필수 후속 = M1 문서 수정(D1~D8, Leader/designer), M2 보고 문구. 코드 수정 요구 없음(권고: L6·L7 시험 보강은 선택).

### QA 에 넘길 high_risk_areas
1. **새 수업 생성 E2E(실제 `completeJson`→저장)**: 저장된 `dialogue[].pieces` 가 정리 상태인지(`slash:false` 키 없음·꼬리 slash 없음·`ko` 공백 제거·문장부호 `ko:null`) — 통합 시험이 없는 구간(L10·L11).
2. **복습(A5)·상황(`lessonScenario@v2`)·붙여넣기 경로** 각 1회 이상 생성: 지연·재시도·null 줄 수(보정 후 라이브는 각 n=1).
3. **마지막 시도 면책 → 모든 줄 null** 화면(«나누지 못했어요»)·Trace `piecesNullLines/piecesTotal`.
4. **스키마 하드 한계 초과 → 수업 FAILED**(M1 수용분, 문서 문구 반영 확인 후) 와 사용자 재생성 흐름.
5. 조각 종류 표기(② よろしくお願いします·수량·する동사)·`type_null_mismatch` 형 null 줄(두 문장 줄) 폰 확인.
6. 문서 D1~D8 수정 뒤 §37-12 ↔ 코드 재대조(Leader).
- `native_change: false`(이번 감사 범위에 `plugins/**`·`android/**`·`capacitor.config.ts` 변경 없음 — 확인한 범위: B 감사 대상 파일만).
- **못 본 것**: UI(`StageChunk` 등)·서버 라우트·정본 api-contract(감사 A·C 몫), 라이브 LLM 재현(금지), 키 파일 열람 시점(증명 불가).
