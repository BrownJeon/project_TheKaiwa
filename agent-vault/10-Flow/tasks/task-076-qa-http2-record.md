---
task_id: task-076
role: qa
tags:
  - type/task-record
  - domain/lesson
  - domain/vocab
updated: 2026-10-18
---
# task-076 QA 기록 — 2부 AI 생성 라이브 검증 (QA3 계정, 서버 127.0.0.1:3011, APP_ENV=LOCAL)

> 사용자 지시 원문 맥락: 「D1~D11 권고대로 승인, 질문 5는 a로」(task-076 데모 v2 승인). QA 지시: Leader 가 기동한 QA 서버·QA3 계정만 사용, 코드 수정 금지, 생성 샘플을 기록해 Leader 가 품질을 판단.

## 0. 시작 시점 QA3 원상 복구 기준 (복구 의무)
GET /api/v1/settings/profile (시작 전):
```json
{"displayName":null,"teacherName":null,"level":"N5","politeness":"POLITE","goalLevel":null,"goalTopics":null,"goalDeadline":null,"dailyWordCount":10,"dailyMinutes":15,"strictness":"STRICT","correctionMode":"(응답에 없음)","explainLang":"ko","explainDepth":"NORMAL","showFurigana":true,"showHangul":true,"showTranslation":false,"updatedAt":"2026-10-06T16:19:42.812Z"}
```
복구 목표: level=N5, goalLevel=null (나머지 필드는 건드리지 않는다). 진행 중 챌린지: (확인 중)

진행 중 챌린지: 없음(GET /challenges?status=ACTIVE → items 0).
QA3 주제(시드): 자기소개 N5·카페 주문 N5·길 묻기 N5 / 주말 계획 N4(`cmuihjv9i0013w1dgfxsr6q74`)·여행 이야기 N4(`cmuihjy36001gw1dg8d3uubat`).

## E1a. 주제 수업, 챌린지 없음, 프로필 level N5 · goalLevel N3, 주제 「주말 계획」(N4)
- PUT /settings/profile `{"level":"N5","goalLevel":"N3"}` → 200 (GET 재확인 level N5, goalLevel N3).
- GET /lessons/today `recommendation` = `{topicTitle:"자기소개", level:"N5", lessonLevel:"N3", levelSource:"GOAL"}` (추천 level 은 주제 난이도 그대로, 새 칸이 T).
- POST /lessons `{"topicId":"…주말 계획"}` → 200 `reused:false` → 잡 DONE (생성 73초, 서버 측 LLM).
- GET /lessons/:id → **`level` = N3, `status`=READY, `source`=TOPIC** → 기대 N3(goalLevel ?? level) **PASS** (주제 난이도 N4 아님).
- 샘플(제목 週末の予定 / 주말 계획): 표현 週末(しゅうまつ)·映画(えいが)·友だち(ともだち)·見に行きます·会う予定です / 문법 〜予定です("~할 예정이다")·たぶん〜と思います·〜で疲れました / 대화 A「週末の予定、もう決まりましたか。」B「はい、久しぶりに友だちと会う予定です。」A「いいですね。何をするんですか。」B「一緒に映画を見に行きます。たぶん新しい映画を見ると思います。」 — (참고: 표층 난이도는 N5~N4 정도로 보임, 적합성 판단은 Leader)

## E1b. 주제 수업, 챌린지 없음, 프로필 level N5 · goalLevel null, 주제 「여행 이야기」(N4)
- PUT `{"level":"N5","goalLevel":null}` → 200. GET /lessons/today `recommendation.lessonLevel` = N5, `levelSource` = LEVEL.
- (같은 날 같은 주제 「주말 계획」은 E1a 레슨이 READY 라 `reused:true` 가 되므로 다른 N4 주제 사용 — 계약 동작.)
- POST /lessons `{"topicId":"…여행 이야기"}` → 200 `reused:false` → 잡 DONE(73초). GET /lessons/:id → **`level` = N5, status READY** → 기대 N5 **PASS**.
- 샘플(旅行の話 / 여행 이야기): 표현 温泉(おんせん)·行ってきました·泊まりました·写真を撮りました·きれいでした / 문법 〜てきました·〜でした(な형용사 과거)·思ったより〜 / 대화 A「先週、温泉に行ってきました。」B「いいですね。どこに泊まりましたか。」A「小さい旅館に泊まりました。初めての旅行でした。」B「温泉はどうでしたか。」

## 준비 — E1a 레슨 끝내기(같은 날 같은 주제 재생성용)
- 「주말 계획」 E1a 레슨은 READY 라 같은 날 재요청 시 `reused:true` → 새 레슨을 만들려고 `PATCH /lessons/:id/progress {"stageDone":4}` 후 `POST /lessons/:id/complete {}` 로 DONE(QA3 데이터 변경: StudyLog·스냅샷 1세트, `reviewDecisionJobId:null` → A11 LLM 잡 없음). (complete 는 처음 `409 STAGES_LEFT {required:4}` — 계약 동작.)

## E2a. 주제 수업, 챌린지 진행 중 — 난이도 N2, 주제 「주말 계획」(N4)
- 프로필 level N5 · goalLevel N2 로 변경(PUT 200).
- POST /challenges `{..."level":"N6"}` → **400 VALIDATION `{field:"level", reason:"N5|N4|N3|N2|N1"}`** (잘못된 값 거절 확인).
- POST /challenges `{"topicId":"…주말 계획","lengthDays":7,"start":"TODAY","dailyGoal":{"lesson":true,"words":true,"wordCount":10},"title":"QA076 N2","level":"N2"}` → 200, 응답 `level:"N2"`, `status:"ACTIVE"`, `wordsMinAnswered:8`, id `cmvdong1v00sbw17a7906c3zq`.
- GET /lessons/today `recommendation` = `{topicTitle:"주말 계획", level:"N4"(주제 난이도 불변), lessonLevel:"N2", levelSource:"CHALLENGE", reason:"CONTINUE"}` (오늘 이미 주말 계획 수업을 끝냈으므로 CONTINUE — 계약상 CHALLENGE 이유는 아직 안 끝낸 경우).
- POST /lessons `{"topicId":"…주말 계획"}` → `reused:false`, 잡 DONE 55초. GET /lessons/:id → **`level` = N2** → 기대 N2 **PASS**.
- 샘플(週末の予定、何かある？ / 주말 계획, 뭐 있어?): 표현(주제 고정 조각) 週末·友だち·会う予定です·家でゆっくりします·楽しみです / 문법 〜つもりだ·〜た分("~한 만큼")·〜んじゃない？(회화체 제안) / 대화 A「週末の予定、もう決まってる？」B「うん、久しぶりに映画を見に行くつもりなんだ。」A「いいね！誰かと一緒に行くの？」B「友だちと会う予定なんだけど、たぶん映画の後にご飯も食べると思う。」 — **E1a(N3) 대화는 です・ます체 평이문, E2a(N2)는 반말(회화체)·〜た分·〜んじゃない 등으로 올라감**(문법/문체 차이는 눈에 보임; 적합성은 Leader).

## E3. 붙여넣은 글 수업(불변) — 프로필 level N5 · goalLevel N2 + 진행 중 챌린지 N2 (T 후보가 전부 N2 인 최악 조건)
- POST /lessons `{"sourceText":"昨日は友だちと一緒に新しいカフェに行きました。そこでコーヒーとケーキを注文して、二時間ぐらいおしゃべりをしました。店の人はとても親切で、また来たいと思いました。来週は妹も連れて行くつもりです。"}` (96자) → `reused:false`, 잡 DONE 69초.
- GET /lessons/:id → **`level` = N5, `source` = TEXT, `topic` = null** → 기대 N5(프로필 level, goalLevel·챌린지 아님) **PASS**.
- 샘플(新しいカフェに行きました / 새로운 카페에 갔어요): 표현(전부 new) 新しいカフェ·友だちと一緒に·注文する·連れて行く·親切だ / 문법 〜ました（過去形）·〜つもりです·〜て、〜(て형 연결) / 대화 A「昨日、新しいカフェに行きました。」B「いいですね。だれと行きましたか。」A「友だちと一緒に行きました。」B「何を食べましたか。」 — 평이한 です・ます, N5 수준 문법.

## E4. 상황 수업(불변) — 같은 조건(goalLevel N2 + 챌린지 N2), 시드 상황 `scn_cafe-order-drink`(「음료의 온도·크기 정해서 주문하기」, 상황 level N5, 대표 주제 「카페 주문」 N5)
- POST /lessons `{"scenarioId":"scn_cafe-order-drink"}` → `reused:false`, 잡 DONE 44초 → GET /lessons/:id **`level` = N5**, `source`=TOPIC, `topic`={카페 주문}. 기대(상황 자신의 수준 N5, T=N2 의 영향 없음) **PASS**.
- 제한: 시드 상황은 모두 대표 주제 수준 = 상황 수준이라 「상황 수준 vs 대표 주제 수준」 구분은 이 데이터로 못 가름(둘 다 N5). 코드 주석상 `Lesson.level` = 대표 주제 수준(없으면 상황 수준).
- 샘플(カフェで注文 / 카페에서 주문하기): 표현 コーヒー(読み「こーひー」)·ケーキ(「けーき」)·ください·甘いです·温かいです / 문법 〜でお願いします·〜がいいです·〜も一つください / 대화 B「いらっしゃいませ。ご注文は何にしますか。」A「コーヒーをください。」B「ホットとアイス、どちらにしますか。」A「温かいコーヒーがいいです。ホットでお願いします。」 — (참고: 외래어 읽기가 히라가나 「こーひー」로 나옴 — 표기 관례상 가타카나 「コーヒー」 읽기 칸이 히라가나인 것은 의도일 수 있음, Leader 판단)

## E5. 챌린지 주제 세트 「새 단어」(A12) — 진행 중 챌린지 N2(주제 「주말 계획」 N4)
- **제약 발견**: 새 단어 생성 시도는 사용자당 하루 3회 상한(`TOPIC_WORDS_DAILY_ATTEMPTS=3`, 성공·실패 모두 계산, 서버 프로세스 메모리 카운터 — `beginTopicWordsGeneration`). 같은 날 같은 주제는 첫 성공 이후 재생성 안 함(오늘 만든 단어 재사용, `NEW_DONE`). 그래서 「같은 주제를 N5 로 다시」는 같은 날 불가. **API 응답에는 단어별 `jlpt` 가 없다**(A12 응답 안에서만 쓰고 카드에 저장 안 함) → 분포 집계는 QA 의 JLPT 수준 추정(사전 근거 아님)으로 대체.
- **E5a 챌린지 주제 「주말 계획」(N4 주제, 챌린지 N2) 1차**: POST /vocab/sessions `{"count":10,"topicId":"…주말 계획"}` → 200 (10.5초) `generation = {source:"TOPIC", generatedNow:false, reason:"INVALID"}`, `topic.aiCardCount=0` → AI 새 단어 0장, 전부 주제 표현 폴백(友だち·ひまです·家でゆっくりします·疲れました·たぶん·見に行きます·一緒に·映画·会う予定です·久しぶりに). 응답 정상, 세트 열림(폴백 동작은 계약대로).
- **E5a 2차**(0장 답 → `POST …/finish` → `ABANDONED` 로 닫고 같은 요청 재시도): 200 (11.3초) `generation = {source:"MIXED", generatedNow:true, reason:"SHORT"}`, `aiCardCount=2` → 새 단어 2장만 통과: 雑貨屋(ざっかや, 잡화점, 例: 雑貨屋で買い物をするのが好きです。)·ショッピングモール(쇼핑몰, 例: ショッピングモールで買い物をします。), 나머지 8장은 주제 표현(疲れました·たぶん·ひまです·会う予定です·一緒に·久しぶりに·見に行きます·楽しみです).
- **E5c 대조 — 챌린지 주제가 아닌 N4 주제 「여행 이야기」, 같은 N2 챌린지 진행 중**: 200 (10.8초) `generation = {source:"AI", generatedNow:true, reason:null}`, `aiCardCount=10` → 새 단어 10장 전부 통과: 予定(계획·일정)·天気(날씨)·移動(이동)·観光地(관광지)·宿泊(숙박)·景色(경치)·海岸(해안)·記念品(기념품)·名物(특산품)·体験(체험), 예문 전부 있음. QA 추정 수준: 天気 N5, 予定·移動·景色 N4, 観光地·宿泊·海岸·記念品·名物·体験 N3 전후 → **주제 수준 N4 창(N5~N3) 안**, N2 챌린지 수준 아님.
- 해석(QA 판단 — 확신도 [가능성 높음]): 같은 날·같은 N2 챌린지 아래 **챌린지 주제만** 새 단어가 거의 통과하지 못했고(INVALID → SHORT 2장), 비(非)챌린지 주제는 주제 수준 단어가 10장 모두 통과 → 「챌린지 주제만 챌린지 난이도, 그 밖 주제는 주제 수준」 동작과 일치. 다만 jlpt 필드가 API 에 없어 N2 창(N1~N3)을 직접 증명하진 못함. **관찰된 품질 문제**: N4 주제에 N2 챌린지를 걸면 A12 새 단어가 창(N1~N3)에 걸러져 1차 INVALID·2차 2/10장 통과 → 사용자는 새 단어가 거의 없는 세트를 받음(폴백은 정상). 시도 3회 중 2회를 이 주제에서 소진.
- **N5 챌린지 비교 실행은 하지 못함**: 하루 3회 상한 중 이 계정의 시도 3회를 모두 썼음(주말 계획 INVALID·SHORT + 여행 이야기 대조). → **NOT_VERIFIED(오늘)** — 내일(KST) 또는 Leader 가 서버를 재기동해 메모리 카운터를 초기화하면 「N5 챌린지로 새 주제에 세트 생성」 1회 실행 가능.

## E2b. 주제 수업, 챌린지 진행 중 — 난이도 N5, 주제 「주말 계획」(N4) (E2a 와 같은 주제)
- 준비: E2a 레슨을 끝내고(`stageDone 4` → `complete`, `reviewDecisionJobId:null`) N2 챌린지 `end`(200 `ENDED`) → 새 챌린지 `"level":"N5"` 생성(200, id `cmvdouzvq012lw17azud4let2`, `ACTIVE`, `level:"N5"`).
- **구분력을 높이려고 프로필을 level N4 · goalLevel N2 로 바꿔 둠** — T 후보가 챌린지 N5 / 목표 N2 / 내 수준 N4 로 전부 달라 결과가 N5 면 챌린지 값이 쓰인 것.
- GET /lessons/today `recommendation` = `{level:"N4"(주제 난이도 불변), lessonLevel:"N5", levelSource:"CHALLENGE"}`.
- POST /lessons `{"topicId":"…주말 계획"}` → `reused:false`, 잡 DONE 50초 → **`level` = N5** → 기대 N5 **PASS**.
- 샘플(今週末は映画を見に行きます / 이번 주말엔 영화 보러 가요): 표현 映画·友だち·見に行きます·会う予定です·家でゆっくりします / 문법 〜予定です·〜に行きます(목적 이동)·〜から(이유) / 대화 A「週末の予定、もう決まった？」B「うん、友だちと映画を見に行きます。」A「いいですね。久しぶりに会うんですか？」B「はい、久しぶりに会う予定です。とても楽しみです。」 — **E2a(N2: 반말 회화체·〜た分·〜んじゃない？·〜つもりだ) 대비 E2b(N5: 〜に行きます·〜から 같은 초급 문형)** — 어려움 차이는 문법 항목에서 분명하나, 대화 문체는 둘 다 짧은 일상문(E2b 도 반말 섞임 「決まった？」).
- 추가 확인(비LLM): 챌린지 N5 상태에서 #155 `?status=ACTIVE` · #157 상세 · #158 today 모두 `level:"N5"` 로 응답.
- 부가 확인: `POST /challenges {…"level":"N6"}` → 400 `VALIDATION {field:"level", reason:"N5|N4|N3|N2|N1"}`.

## 결과 요약
| 항목 | 판정 | 근거 |
|---|---|---|
| E1a 주제 수업·챌린지 없음·goalLevel N3 | PASS | `level` N3(주제 N4, 프로필 level N5) |
| E1b 같은 조건·goalLevel null | PASS | `level` N5 |
| E2a 챌린지 N2 | PASS | `level` N2, #58 `lessonLevel` N2/`levelSource` CHALLENGE |
| E2b 챌린지 N5 (프로필 level N4·goal N2) | PASS | `level` N5 |
| E3 붙여넣은 글(level N5·goal N2·챌린지 N2) | PASS | `level` N5, `source` TEXT |
| E4 상황 수업(같은 조건) | PASS (제한) | `level` N5 = 상황·대표 주제 수준. 시드 상황은 상황 수준 = 대표 주제 수준이라 둘의 구분은 못 함 |
| E5 챌린지 주제 새 단어 | OBSERVED | 챌린지(N2) 주제: 1차 INVALID(0장)·2차 SHORT(2/10장). 비챌린지 N4 주제: AI 10/10장, 수준 N5~N3 추정. `jlpt` 가 API 에 없어 직접 분포 집계 불가 |
| E5 N5 챌린지 비교 | NOT_VERIFIED | 하루 A12 시도 3회 상한(서버 메모리) 소진 |

## 원상 복구 확인 (끝)
- 챌린지 2건(N2 `cmvdong1v00sbw17a7906c3zq`, N5 `cmvdouzvq012lw17azud4let2`) 모두 `ENDED`. GET `/challenges?status=ACTIVE` → items [].
- 프로필 `PUT {"level":"N5","goalLevel":null}` 후 GET: level N5, goalLevel null, 나머지(displayName null·teacherName null·politeness POLITE·dailyWordCount 10·dailyMinutes 15·strictness STRICT·explainLang ko·explainDepth NORMAL·표시 스위치 true/true/false) 시작값과 동일. (참고: 시작 GET 은 `correctionMode` 키가 없었는데 PUT 이후 GET 은 `correctionMode:"FLUENCY"`(기본값) 가 있음 — 이번 task 와 무관해 보이는 기존 GET/PUT 응답 모양 차이, 원인 미조사. `updatedAt` 은 당연히 바뀜.)
- 진행 중 단어 세트 0(`/vocab/sessions?status=IN_PROGRESS` → []). 세트 3개는 0장 답으로 `ABANDONED`(StudyLog·스냅샷 없음).

## 미정리 행 (QA3 계정 데이터, 지시상 남겨도 됨)
- 레슨 6건: E1a(주말 계획, DONE)·E1b(여행 이야기, READY)·E2a(주말 계획 N2, DONE)·E2b(주말 계획 N5, READY)·E3(붙여넣기, READY)·E4(카페 상황, READY). DONE 2건은 score 0 으로 StudyLog·StatsSnapshot(LESSON·DAILY)·RepetitionItem 이 QA3 에 쌓임.
- 챌린지 2건(ENDED), 단어 세트 3건(ABANDONED).
- 띄운 프로세스 없음(서버 3011 은 Leader 소유, 손대지 않음). 임시 파일은 세션 scratchpad `q76/` 에만(쿠키 값 없음).

## 체크포인트
- 완료: E1a·E1b·E2a·E2b·E3·E4 PASS, E5 OBSERVED(N5 비교 NOT_VERIFIED), 원상 복구 완료.
- 남은 일: 없음(Leader 판단 대기). 후속 제안: ① N5 챌린지 새 단어 비교와 비챌린지 대조 1회씩을 서버 재기동 또는 다음 KST 날에 재실행 ② E5 관찰 결과(높은 챌린지 난이도에서 새 단어 통과율 급감) 처리 여부 결정.
- 다음 첫 명령: (없음)
