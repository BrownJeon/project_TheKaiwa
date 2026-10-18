---
task_id: task-074
role: qa
title: "task-074 서버·데이터 QA 기록 — 실제 서버·실제 HTTP 로 본 즐겨찾기(#182/#183·목록 favorite 필터)"
tags:
  - type/task-record
  - domain/vocab
created: 2026-10-18
---

# task-074 서버 QA — 실제 HTTP 검증 기록

이력서 [[task-074-improve-word-favorites]] · 서버 구현 [[task-074-dev-server-record]] · 서버 감사 [[task-074-rev-server-record]]

범위: 서버·데이터(화면은 다른 QA). 대상: `http://127.0.0.1:3011`(QA 서버, 127.0.0.1 전용, cwd `~/.node-local/thekaiwa-qa074`, 헬스 200). 계정 QA1·QA2·QA3 만 사용(QA4 미사용). 금지 준수: 3011 외 접촉 0·DB 직접 접속 0·코드/문서 수정 0·서버 재기동 0.
환경 주의: 개발·운영이 같은 NAS DB 를 본다 → 시험은 QA 계정 데이터만 만든다.

## 진행 기록 (항목마다 덧붙임)
- [00] 시작. 이력서 요약·dev 기록·rev 기록·api-contract #40~#52·#182/#183 읽음. 쿠키 3개(12:19 발급) 유효(`GET /words?limit=1` 3개 모두 200). 도우미 스크립트 `scratchpad/q74.sh`(쿠키 값 출력 안 함).
- [01] **항목 1 인증 — PASS.** 쿠키 없이 `POST /words/:id/favorite`·`/unfavorite`·`/archive`(비교)·`GET ?favorite=1`·`GET /words`·`GET /words/:id` → 전부 401 `UNAUTHENTICATED`(실제 단어 id·없는 id 둘 다 401 — 존재 노출 없음). 쓰레기 쿠키 `thekaiwa_session=garbage` → 401. `await requireSession` 누락 없음(실서버 증거).
- [02] **항목 2 교차 격리 — PASS.** 기준: QA1~3 모두 시작 때 내 단어 0·별 0(`favorite=1` total 0·pages 1·baseTotal 7757). QA1 이 기본 단어 X 와 자기 내 단어 Y(`POST /words` → 응답 `{saved,word}`)에 별 → QA2 `favorite=1` total 0, QA2 의 X 상세 `favorite=false`, QA2 내 단어 목록 0건, QA2 의 Y 상세/PATCH → 404. **QA2 가 Y 에 `/favorite`·`/unfavorite`·`/archive` → 전부 404 `NOT_FOUND`("단어를 찾을 수 없어요.", 403 아님).** 없는 id·`00000000`·`a%20b`·`%00`·41자·500자·`..%2F..%2Fetc` → favorite·archive 모두 동일 404(보관과 같은 동작). QA2 가 X 를 켜고(자기 `favoritedAt` 03:21:57) 끈 뒤에도 QA1 의 X 별(`favoritedAt` 03:21:29)·QA1 `favorite=1`(2건) 불변, QA2 목록에 QA1 별 0.
- [03] **항목 3 켜기/끄기 계약 — PASS.** 응답 = `WordEntry` 전체(키 26개: `favorite`·`favoritedAt`·`archived`·`archivedAt`·`category`·`chunkType`·`correctCount`·`wrongCount`·`lastResult`·`lastSeenAt`·`readOnly`·`source`·`origin` 등), `userId`·`seedKey` 없음, 보관 응답과 **키 집합 동일**. 멱등: 이미 켠 단어에 켜기 2번 → `favoritedAt` 03:21:29.807Z 동일(기본·내 단어 모두). 켜기→켜기→끄기→끄기→켜기: 켜기 2번째 `favoritedAt` 유지, 끄기 `favoritedAt` null, 다시 켜면 새 시각(03:22:19→03:22:28). **별·상태 행 없는 기본 단어 끄기 2번 → 200, `favorite=false`·`favoritedAt=null`, 오류·`favorite=1` 목록 부작용 0**(행 수 직접 대조는 DB 접근 금지라 미검증 — 응답·목록으로만 확인). 켜기에 본문 `{"favorite":false}` 를 실어도 무시되고 켜짐(본문 미사용 — 기대대로). GET/PUT/DELETE `/favorite` → 405.
- [04] **항목 4 목록 `favorite` 필터 — PASS.** 고정: QA3 가 별 6개(기본 X2·B1·B2 + 내 단어 アルファ·ベータ·デルタ) 중 デルタ 보관, 내 단어 ガンマ 별 없음. `favorite=1` total 5·pages 1·baseTotal 7757 / `limit=2` → pages 3, 1쪽 2개·3쪽 1개·4쪽(초과) `items:[]`+total 5 유지. `archived=1&favorite=1` = デルタ 1건, `archived=0&favorite=1` = 5건. `source=mine` 2 / `base` 3 / `mine&archived=1` 1. `chunkType=ACTION` 1·`NAME` 2(기본 「赤」 포함)·`category=qa074a` 1(+`archived=1` 1)·`q=QA074` 2·`q=ベータ` 1·`q=zzznone` 0(pages 1). `sort=recent|surface|wrong` 모두 total 5·별만(surface 순 정렬 유효). **`favorite` 없음/`0`/빈 값 → 조건 없음**: total 7760(= 7757 + 내 단어 4 − 보관 1), 별 단어가 「전체」에 그대로 보임(`S` 표시 확인). 반복 파라미터 `favorite=1&favorite=0` → 첫 값(1) 적용 total 5, `0&1` → 7760. **잘못된 값 `2`·`true`·`01`·`-1`·`yes`·`null`·`%20`·`1%20`·`+`·`1,0`·전각 `１`(퍼센트 인코딩) → 400 `VALIDATION {field:favorite, reason:"0|1"}`, 보관 `archived=2`/`%20` 와 같은 모양(메시지 「favorite 는 0 또는 1 이어야 합니다.」).** 별 0개 계정(QA2) `favorite=1` → `{items:[],total:0,page:1,pages:1,limit:20,baseTotal:7757}`, `page=5` 도 total 0·pages 1. 하네스 메모: 인코딩 안 한 전각 문자·공백을 URL 에 그대로 넣으면 Node 가 앱 이전에 400(본문 없음) — 앱 결함 아님.
- [05] **항목 5 보관과 독립 — PASS.** 별 켠 기본 단어 X2: 보관→풀기→보관 모두 `favoritedAt` 03:22:28.645Z 불변, `archivedAt` 만 변함. 보관 상태에서 별 끄기(`favorite=false, archived=true` 유지)·다시 켜기(새 `favoritedAt`, `archivedAt` 유지)·풀기 모두 정상. 내 단어 アルファ 보관/풀기도 별 유지. `archived=1&favorite=1` = 보관한 즐겨찾기만(2→별 끈 뒤 1건), `archived=1` 단독은 별 아닌 보관 단어도 포함.
- [06] **항목 6 채점/세트가 별을 안 지움 — PASS (실서버).** QA3 가 `POST /vocab/sessions {count:10}`(FLIP, LLM 없음) 만들고 세트 단어 10개 중 앞 6개(order 0~5)에 별, 뒤 4개(6~9)는 별 없음으로 두고 답: 0·3·6 CORRECT / 1·4·7 WRONG / 2·5·8 skipped / 9 미답 → `POST /finish` 200(correct 3·wrong 3·skipped 4, `studyLogId` 있음). **끝낸 뒤 10개 모두 `favorite`·`favoritedAt` 값 불변**(별 6개 `favoritedAt` 03:24:55~58 그대로, 별 없는 4개 `false/null` 그대로 — finish 가 새 상태 행을 만든 단어 포함), 카운터만 변함(c 1/w 1 등). 실제 정렬 확인(M-2의 실서버 확인): 틀린 단어를 만든 뒤 `favorite=1&sort=wrong` → 별인 틀린 단어(order 4·1) 앞, **별 아닌 틀린 단어(order 7) 제외**, total 11(= 별 중 보관 안 한 것), `limit=3` 1·2쪽 이어붙이기 정상 / `sort=wrong` 전체에선 order 7 이 맨 앞. 평가(Evaluation) 제출 경로는 LLM 필요 → **미검증**(단위 시험 F12·T74 가 덮음).
- [07] **항목 7 WordEntry 응답에 `favorite` 실림 — PASS (채택 연결 #35·#38 만 LLM 필요 → 미검증).** 실서버에서 `favorite`·`favoritedAt` 확인: 목록 항목(#40)·생성 `{saved,word}` 의 `word`(#41, `false/null`)·상세(#42, `corrections`·`stats` 외 25키 중 포함)·수정(#43, 별 유지: 별 켠 단어 이름 수정 후 `favoritedAt` 03:23:32.271Z 동일, `{}` 빈 패치도 200)·보관/풀기(#45)·`/favorite`·`/unfavorite`(#182/#183). 응답에 `userId`·`seedKey` 없음. **PATCH 본문의 `favorite`·`favoritedAt`(true/false/null/ISO)·`archived` → 400 `VALIDATION {field, reason:"read_only"}`(별 칸 변조 불가, `favorite`+`meaning` 같이 보내도 400 이고 아무것도 안 바뀜 — 사후 별·이름 불변 확인).** 기본 단어 PATCH: 일반 키 → 403 `READ_ONLY`(기존), `favorite` 키 → 400 read_only(`archived` 와 같은 처리). POST 생성에 `favorite`/`favoritedAt` → 400 `unknown_key`. 관찰(존재 노출 없음): QA2 가 남의 단어·없는 id 에 `{"favorite":true}` PATCH → 둘 다 400(구분 불가), 일반 키는 둘 다 404. 단어 삭제 후 `/favorite`·`/unfavorite`·상세 → 404, `favorite=1` total 12→11(cascade 로 별도 사라짐).
- [08] **항목 8 동시성 — PASS (5xx 0·유니크 충돌 500 0), 부하 관찰 Low 1건.** 별 상태 행이 **한 번도 없던 단어**(첫 행 생성 경합이 가장 위험한 경우)로: ① QA3 가 같은 단어에 `favorite` 20병렬 → 200×20, 끝난 상태 켜짐·`favoritedAt` 한 값 ② 같은 단어에 켜기/끄기 교차 20병렬 → 200×20(최대 11.7s·평균 8.8s) 끝 상태 켜짐, 상세·`favorite=1` 목록 일치 ③ 서로 다른 단어 5개 × (켜기·끄기 각 4) 40병렬 → 200×40, 상세와 목록이 모든 단어에서 서로 일치(F2 켜짐·F3~F6 꺼짐, 단어별 일치 확인) ④ **같은 기본 단어를 QA1·QA2·QA3 이 각자 7병렬 동시 켜기(21) → 200×21(최대 1.1s), 세 계정 각자 독립적으로 켜짐(서로 다른 `favoritedAt`), 서로의 목록에 남의 별 없음** ⑤ 과부하 확인: QA3 가 한 단어에 켜기/끄기 교차 **30병렬** → 200×30(최대 14.6s·평균 5.9s), 같은 시간에 QA1 의 다른 단어 켜기 24회 전부 200(최대 0.9s), QA2 목록 읽기 24회 전부 200이나 **폭풍이 시작될 때 한 번 5.7s 정체**(나머지 0.1~0.9s). 
  - 관찰(Low, 결함 아님·알려진 설계): 쓰기 1건 ≈ 0.5~2s(NAS DB 왕복+사용자 행 잠금, **보관(archive) 6회 측정 0.5~3.4s 로 같은 수준**), 한 사용자의 잠금 대기열은 직렬이라 N병렬이면 대기 ≈ 0.5s×N. 30병렬이 14.6s 로 트랜잭션 15s 한도에 근접 → 한 사용자가 **~30건 넘게 동시에** 쏘면 시간 초과 오류가 날 수 있음(미검증 — 공유 서버라 그 이상은 시험하지 않음). 분당 한도 없음은 Leader 결정(D-c). 화면은 낙관적 갱신·연타 방지가 필요(화면 QA 확인 사항).
- [09] **항목 9 성능 관찰 — 이상 없음(색인 사용 미확인).** QA3 별 56개·전체 7,760단어: `favorite=1&limit=20` ≈ 85~100ms(6회), 2쪽 ≈ 78~90ms, `sort=wrong` ≈ 90~97ms, `sort=surface` ≈ 85~91ms, `q=い` ≈ 87~93ms, `limit=50` ≈ 92~95ms — **별 필터 목록이 필터 없는 목록(≈118ms)·`sort=wrong` 전체(≈167ms)보다 빠름**. 별 0개 계정(QA2) `favorite=1` ≈ 79ms(6회). 이상치: 별 계정 `favorite=1` 4회(0.31·0.56·0.63·0.96s)와 0개 계정 2회(0.51·0.57s) — 별 개수와 무관하게 0개 계정에서도 같은 크기의 이상치가 나오고 다른 QA 활동과 겹친 시각이라 **별 필터 고유 원인으로 보기 어려움 [추측: 공유 서버·NAS DB 부하]**. #46 categories 23ms. DB 실행계획은 볼 수 없어 **`UserWordState_userId_favorite_idx` 사용 여부는 미확인**(별 56개·단어 7.8천 규모에서 체감 문제 없음).
- [10] **항목 10 회귀·노출 — PASS.** 별 필터 없이: 생성(#41)·수정(#43)·보관/풀기(#45)·삭제(#44)·검색(`q`)·정렬(`recent|surface|wrong`)·쪽 이동(`source=mine&limit=2` 1·2쪽 + 3쪽 빈 `items`, `favorite=1&limit=7` 8쪽을 끝까지 걸어 56건 = total 56 = 중복 0)·`limit=0|101|abc`·`page=0`·`cursor`·`sort=bad`·`source=bad` → 전부 400(기존 모양) / 전체 total 7,760 = 7,757 + 내 단어 4 − 보관 1 로 일치, #46 categories 개수(qa074a 2·보관 1 등) 별과 무관. **응답 13.7KB(목록·상세·토글·401/404/400 오류) 전수 grep: `reazon|whisper|style-bert|model_id|speaker_id|sherpa|claude|anthropic|DATABASE_URL|secret|credential|password|/home/|.node-local|prisma|mariadb|스택 흔적` 0건.** 응답 헤더에 `x-powered-by`·`set-cookie`·`server` 없음.
- [11] **추가 관찰(결함 아님, 보관 라우트와 동일한 기존 동작).** (a) `/favorite`·`/archive` 모두 본문을 읽지 않음 — 잘못된 JSON·200KB 본문에도 200. (b) 서버 쪽 Origin/Sec-Fetch-Site 검사 없음 — `Origin: https://evil.example` + `Sec-Fetch-Site: cross-site` 로 보내도 200(쿠키 SameSite 에만 의존하는 기존 자세, 이번 변경 범위 밖). (c) 켜기/끄기는 상태 행이 있어도 끈 뒤에도 행은 남는다(행 수 직접 대조는 DB 접근 금지라 미검증).

## 결과 표
| # | 항목 | 판정 | 근거 요약 |
|---|---|---|---|
| 1 | 인증(쿠키 없음 401) | PASS | favorite·unfavorite·목록 `?favorite=1` 모두 401, 쓰레기 쿠키 401 |
| 2 | 교차 격리 | PASS | 남의 내 단어 favorite/unfavorite/archive/상세/PATCH → 404(403 아님), 없는 id·이상한 id 404 동일, 기본 단어 별 독립 |
| 3 | 켜기/끄기 계약 | PASS | WordEntry 전체+`favorite`/`favoritedAt`, 멱등(`favoritedAt` 유지), 끄기 null, 상태 없는 단어 끄기 안전 |
| 4 | 목록 `favorite` 필터 | PASS | archived/source/chunkType/q/category/sort AND, total/pages/baseTotal 정확, `favorite=0`·없음 = 조건 없음, 잘못된 값 400(보관과 같은 모양), 별 0개 빈 목록 |
| 5 | 보관과 독립 | PASS | 보관/풀기가 별 불변, 보관 상태 별 켜기/끄기, `archived=1&favorite=1` |
| 6 | 채점/세트가 별을 안 지움 | PASS | 맞힘·틀림·건너뜀·미답 10장 세트 끝낸 뒤 별 6/6 불변·새 행 단어도 별 없음 유지 |
| 7 | WordEntry 응답에 `favorite` | PASS(일부 미검증) | 목록·생성·상세·수정·보관·토글 실서버 확인, PATCH `favorite` read_only 400. 채택(#35·#38) 연결은 LLM 필요 → 미검증 |
| 8 | 동시성 | PASS | 20·40·21·30병렬 전부 200, 5xx 0, 상태 일치. 관찰: 직렬 대기(30병렬 14.6s) |
| 9 | 성능 관찰 | PASS(색인 미확인) | 별 56개 `favorite=1` ≈ 90ms, 이상치는 별 0개 계정에서도 발생 |
| 10 | 회귀·노출 | PASS | 회귀 전부 정상, 금지 문자열 0건 |

## 결함
**0건** (Critical 0 · High 0 · Medium 0 · Low 0).

## 관찰·권고 (결함 아님 — Leader 판단용)
1. **[Low 관찰] 한 사용자의 연타/폭주는 직렬화되어 길어진다.** 쓰기 1건 0.5~3.4s(NAS DB 왕복, 보관과 동일 수준) × 사용자 행 잠금 → 30병렬 최대 14.6s(트랜잭션 15s 한도 근접), 폭풍 시작 순간 다른 사용자 읽기 1회 5.7s 정체(나머지 0.1~0.9s). 5xx 는 30병렬까지 0. **~30건 이상 동시에 쏘는 경우는 미검증**(공유 서버라 시험하지 않음) — 시간 초과 시 응답이 어떻게 나오는지 모른다. 정상 사용(손가락 연타)에서는 문제 없을 것으로 [가능성 높음]. 화면은 낙관적 갱신·요청 중 버튼 잠금/디바운스로 막는 것이 안전(화면 QA 확인 사항).
2. **[Info] 보관과 같은 기존 자세**: 본문 미사용·Origin 검사 없음(위 [11]).

## 정리 확인
- 만든 내 단어: QA1 2개(`QA074テスト一`·`二`)·QA3 4개(アルファ·ベータ·ガンマ·デルタ) + 삭제 시험용 1개 → **전부 DELETE 200**(QA2 는 만든 것 없음; 빈 id DELETE 308 은 하네스 빈 줄 artifact).
- 별: 62개 `unfavorite` 200×62, 보관 1개 `unarchive` 200. **정리 후 검증**: QA1·QA2·QA3 모두 `favorite=1`(archived 0/1) 0건, `archived=1` 0건, 내 단어 0건, 전체 total 7,757(시작 때와 동일).
- 남긴 것: QA3 의 오늘의 단어 세트 1건(DONE, `cmvd9hzn…`)·세트 채점으로 올라간 단어 카운터(c/w)·`UserWordState` 의 `favorite=false` 상태 행(끄기 뒤 남는 행). QA 계정 데이터이고 실사용자 데이터 접촉 0. 서버(3011)·프로세스 재기동/종료 0, QA4 쿠키·계정 미사용, DB 직접 접속 0.
- 산출물(스크래치패드 임시 파일: `q74.sh`·`par.sh`·`qa074-*.txt|ids|json`)은 세션 스크래치패드 안에만 있고 저장소에는 없음. 쿠키 값·비밀 출력 0.

## 최종 판정 — **PASS_WITH_NOTES**
- 심각도: **Critical 0 · High 0 · Medium 0 · Low 0** (결함 0건), 관찰 2건(위).
- **미검증 목록**: ① 교정·제안 채택 시 기본 단어 연결 응답(#35·#38)의 `favorite` — LLM 교정 생성 필요(단위 시험 F10 이 덮음) ② 평가(Evaluation) 제출 전후 별 불변 — LLM 필요(단위 F12·T74) ③ `UserWordState` 행 수 직접 대조·`EXPLAIN`/색인 사용 — DB 접근 금지 ④ 한 사용자 ~30건 초과 동시 토글의 시간 초과 동작 ⑤ 만료 토큰 401(토큰 위조 불가) ⑥ 화면(다른 QA 몫).
- 다음: 결함이 없으므로 Developer 반송 없음. Leader 가 위 관찰 1번(폭주 시 시간 초과 응답)을 받아들일지 판단.
