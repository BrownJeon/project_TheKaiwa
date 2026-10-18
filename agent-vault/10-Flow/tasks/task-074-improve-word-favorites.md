---
task_id: task-074
title: "단어장 즐겨찾기 — 목록 행에서 바로 등록·조회 필터·상세/수정 화면에서도 등록 (IMP-0049)"
status: doing
waiting: device_verify
base_ref: 6445dba
risk_level: "R2"
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-068-improve-wordbook, task-072-improve-word-add-helper, task-073-improve-word-add-copy]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 단어장 즐겨찾기
  - task-074
created: 2026-10-18
updated: 2026-10-18
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 2
  repo_path: "docs/demo/task-074-word-favorites-v2.html"
  artifact_url: "https://claude.ai/artifact/M5bzzSFuMH8xrTYLJdwDCZ"
  content_sha256: "f07f84a68f567968ac53ae6381614a9e4b5ec9f5372fae3d199b9f9239ced5b8"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: "user"
  approved_at: "2026-10-18T10:09:48+09:00"
  approval_quote: "B2로 승인, 한글 줄 없는 행은 H2, DB 칸 추가도 승인."
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-074 — 단어장 즐겨찾기 (IMP-0049)

## 사용자 요청 (원문)
「확인사항은 모두 정상이야. 추가적으로 단어장에 즐겨찾기 기능을 추가해줘. 단어목록에서 바로 등록할수있도록 해주고 조회필터에 즐겨찾기를 추가해줘. 또한 즐겨찾기 추가는 상세화면과 수정화면에서도 등록할 수 있도록 해줘」 (2026-10-18)
- 앞부분 「확인사항은 모두 정상」 = task-072·073 폰 확인 → IMP-0046·0047·0048 `done` 처리함. (task-068·069·071 폰 확인은 같은 말인지 불분명해 `planned` 그대로 — 사용자에게 한 줄 확인.)

## judge 접수 (2026-10-18)
`feature` · 복잡도 1.95 · **R2**(track_blockers: `risk_r2`·`r2_path` = `prisma/schema.prisma` 경로) · developer **opus** · 트랙 **standard** · 데모 **delta**(`DM-low-confidence`) · next `demo_first`. 결과 JSON `judge-result@2`.
- R2 는 정확한 판정이다 — DB 칸 추가가 있다(개발·운영이 같은 NAS DB → **사용자 승인 사항**).

## 관련 과거 이력 요약 (Leader 큐레이션)
- 보관(`archived`)이 같은 구조의 선례: `UserWordState`(`prisma/schema.prisma:903`) = 사용자별 단어 상태(기본·내 단어 공통, 행이 없으면 상태 0·보관 안 함) · `POST /api/v1/words/[id]/archive`·`unarchive`(#44/#45) · 목록 쿼리 `archived=0|1`(`parseWordListQuery`, `wordListFilter`) · 화면 `ArchiveToggle`(필터 줄)·상세 시트 [보관하기]. 즐겨찾기도 이 모양을 따른다. [[task-068-improve-wordbook]]
- 교훈: `/이슈기록 관련 단어장 vocab` → 승인된 교훈 없음. **task-072·073 교훈(내부)**: ① 공용 부품(`Sheet`) 변경은 전수 조사 ② 소스 문자열 스캔 시험은 동작 변이를 못 잡는다(화면 로직은 순수 함수로 빼 동작 시험) ③ 번들 grep 은 존재하는 경로로 ④ QA 서버는 `APP_ENV=LOCAL`.

## 사실 (2026-10-18 직접 확인 — [확실])
- `WordEntry`(기본 단어는 `userId NULL`+`source=SEED`+`seedKey`, 읽기 전용 공용 / 내 단어는 `userId`). 사용자별 학습 상태·보관 = `UserWordState`(`@@unique([userId, wordId])`, `archived`·`archivedAt`·`correctCount`…). **기존 즐겨찾기 흔적 없음**(`src` 전수 검색 0건).
- 목록 `GET /api/v1/words`(#40) 쿼리: `q`(≤40)·`category`·`chunkType`·`source`(all|mine|base)·`archived`(0|1)·`sort`·`page`·`limit`, 조건은 AND. 응답 `{items,total,page,pages,limit,baseTotal}`, 항목은 `WordEntry` + 요청자 상태 칸(`archived`·`archivedAt`·카운터).
- 화면: `WordsScreen`(검색 `WordSearchBar`·출처 `Segmented`·분류 `CategoryChips`·조각 `ChunkChips`·정렬 `Segmented`·`ArchiveToggle`), 행 `WordRow`, 상세 `WordDetailSheet`(모드 view·edit·confirmDelete, 수정 폼 = `WordForm` — 단어 추가 시트도 같은 폼). **`WordRow` 는 행 전체가 하나의 `<button>`**(누르면 상세) → 안에 별 버튼을 넣으면 버튼 중첩이므로 **행을 「열기 버튼 + 별 버튼」 형제 구조로 바꿔야 한다**(접근성·기존 시험 영향).
- **기본 단어는 읽기 전용**: 상세는 보관 단추 하나·[수정][삭제] 없음. 내 단어 상세는 [수정][보관하기] + 글자 [삭제]. 즐겨찾기는 둘 다 할 수 있어야 하므로 「수정」 화면이 없는 기본 단어는 목록·상세에서만 가능.
- API 번호: #181 까지 사용(`api-contract.md`), 새 번호는 #182~ 배정.

## Leader 사전 결정 (사용자가 바꾸라면 바꾼다 — designer 가 데모에서 ★ 권고와 함께 사용자에게 보인다)
- **L1 저장**: `UserWordState.favorite Boolean @default(false)` + `favoritedAt DateTime?` + `@@index([userId, favorite])`. **추가 전용(additive)**이라 운영에서 도는 옛 코드는 새 칸을 모르고도 동작한다(새 행은 DB 기본값 false). 반영은 **사용자 승인 뒤 `prisma db push`**(`migrate dev` 금지), **반영 전 mysqldump 백업**(임시 defaults 파일 600). 승인 전에는 스키마 파일 편집·DB 접촉 모두 하지 않는다 — 코드 구현은 승인 뒤에 시작.
- **L2 API(보관과 같은 모양)**: `POST /api/v1/words/[id]/favorite` · `POST /api/v1/words/[id]/unfavorite`(번호는 api-contract 에서 #182·#183 배정). 멱등. 보이는 단어(내 단어 + 기본 단어)만, 다른 사용자 단어는 404. 응답에 갱신된 `favorite`·`favoritedAt`. 사용자당 분당 한도는 보관과 같은 기준.
- **L3 목록**: `favorite=0|1` 쿼리(`archived` 와 같은 검증), 조건 AND. 응답 항목에 `favorite: boolean`·`favoritedAt?`. 합계(`total`)는 조건 반영, `baseTotal` 불변. 분류 칩 숫자(#46)는 이번에 **바꾸지 않는다**(즐겨찾기 필터를 켜도 칩 숫자는 지금 기준 — 데모에서 사용자가 보고 결정).
- **L4 보관과의 관계**: 즐겨찾기는 보관과 **독립**(보관해도 즐겨찾기 상태는 그대로, 해제하지 않는다). 즐겨찾기 필터는 현재 보기(보관 아님/보관함)의 안에서 AND — 「보관함 + 즐겨찾기」는 보관된 즐겨찾기만. 데모에서 사용자 확인.
- **L5 수정 화면**: 별은 폼 [저장]과 **무관하게 즉시 반영**(별도 요청, 실패 시 되돌림+안내). 이유: ① 기본 단어(수정 불가)의 상세에서 쓰는 방식과 같아야 일관 ② [취소] 때 「별은 저장됐나」 혼란 방지. 데모에서 대안(폼 저장 시 함께)과 비교해 보인다.
- **L6 범위 밖**: 단어 추가 시트의 별(사용자는 「수정화면」만 말함 — 데모 질문으로만), 오늘의 단어 덱 「즐겨찾기만 풀기」, 즐겨찾기 우선 정렬, 즐겨찾기 개수 표시, 주제 단어 세트·교정 제안·평가 결과 화면의 별.
- **L7 행 구조**: `WordRow` 를 형제 두 버튼(열기 / 별)으로 분리 — 터치 44px, 별 탭이 행 열기를 일으키지 않음, 스크린리더로 행 이름이 바뀌지 않게. ~~접근 가능한 이름 「즐겨찾기에 넣기」「즐겨찾기에서 빼기」 + `aria-pressed`~~ → **정정(designer D11, Leader 수용)**: 이름을 바꾸면서 `aria-pressed` 를 함께 쓰면 「즐겨찾기에서 빼기, 선택됨」처럼 상태를 두 번·반대로 읽는다(토글 버튼은 이름을 고정하고 상태는 `aria-pressed` — WAI-ARIA 표준). ★ = 고정 이름 「즐겨찾기」(행은 「{단어} 즐겨찾기」) + `aria-pressed`. 내 사전 결정이 틀렸고 designer 가 바로잡았다.
- **L8 갱신 방식**: 서버 응답 뒤 반영(보관·삭제·수정과 같은 원칙) 또는 낙관적 갱신+되돌림 — designer 권고, 빠른 연타는 마지막 값 우선·요청 취소.

## 데모 v1 사용자 피드백 → v2 (2026-10-18)
- 사용자 답(승인 문장 없음 → 승인으로 기록하지 않음, `status --to changes_requested` 로 기록): 「D1은 D안으로 해주고 D8은 B안으로 해줘. 그리고 D9의 경우 우측의 조각, 내단어 표기 아래에 조그마하게 표기하는 형태로 해줘」
  - **D1 = D**: 출처 분절 4번째 칸 「즐겨찾기」(별 토글 폐기). 규칙: 이 칸 = `source=all`+`favorite=1`, 다른 칸 = `favorite=0` → **「내 단어 + 즐겨찾기」·「기본 단어 + 즐겨찾기」 조합은 화면에서 만들 수 없다**(서버 `favorite` 는 독립 파라미터로 유지). 4칸 폭 실측: 칸 최소 폭 360px 78.3·390px 85.8·412px 91.3, 글꼴 130% 에서도 잘림 0.
  - **D8 = B**: 켜진 별 금색(`--warn`). 사실: 금색만(B1)은 라이트 흰 바탕 **2.95:1 < 3:1**. B2 = 금색 + 가는 `ink` 윤곽(라이트 윤곽↔바탕 15.81·금색↔윤곽 5.37; 다크는 윤곽이 흰 테두리로 보임, 금색↔바탕은 다크에서 이미 7.54). ★ B2, 사용자가 B1 을 고르면 그대로.
  - **D9 = 사용자 지정**: 별을 행 오른쪽 [내 단어][조각] 뱃지 바로 아래에 작게(아이콘 18, 누르는 곳 44×44, 열기 버튼과 형제). 열기 버튼은 지금 폭 그대로. **대가**: 누르는 곳이 뱃지 아래쪽·셋째 줄 숫자 위쪽을 덮어 그 자리를 누르면 별이 눌림(최대 525px² = 행 면적의 1.6%, 360px·100%). 한글 줄이 없는 행: H2 ★(셋째 줄 오른쪽 24 비움) / H1(빈 줄, 행 +약 21px). 처음 그린 상태에서 누르는 곳이 아래 행을 2.4px 침범 → 위 11·아래 5 로 옮겨 0.
- **v2 데모**: `docs/demo/task-074-word-favorites-v2.html`(122,324B, sha256 `f07f84a6…`, `DEMO_LINT_PASSED`, v1 파일 해시 불변 확인) · designer 자체 점검 2,016칸 실패 0(가로 넘침·44px 미만·행 64 미만·별↔글자 겹침·열 어긋남·이웃 행 침범·4칸 잘림) · Artifact(비공개) https://claude.ai/artifact/M5bzzSFuMH8xrTYLJdwDCZ · 게이트 `review_requested` v2(승인 대기). 남은 결정 D2~D7·D10·D11 은 ★ 그대로이며 **사용자 승인 전**. 429 문구는 삭제(보관 라우트와 같이 한도 없음 — Leader).
- 사용자에게 물을 것: Q-U2(B1/B2) · Q-U3(누르는 곳 겹침 수용 + 한글 줄 없는 행 H2/H1) · Q1(D3)·Q3(D2)·Q4(D7) + **DB 칸 추가 승인(L1)** 별도.

## 사용자 승인 (2026-10-18 10:09) — 데모 v2 + DB 칸 추가
- 사용자 **「B2로 승인, 한글 줄 없는 행은 H2, DB 칸 추가도 승인.」** → `check.mjs approve --version 2 --quote …`(sha256 `f07f84a6…`, `approved_at 2026-10-18T10:09:48+09:00`) + `activate`. **Leader 해석(사용자에게 보고)**: 데모 v2 를 승인하되 ① 금색 별은 **B2**(금색 + `ink` 윤곽) ② 한글 줄 없는 행은 **H2**(셋째 줄 오른쪽 24 비움, 이 선택으로 D9 누르는 영역 겹침을 수용한 것으로 봄) ③ 말씀이 없던 D2~D7·D10·D11 은 **★ 권고 그대로 포함**. 다르게 뜻하셨다면 바로 바로잡는다.
- **DB 칸 추가 승인(별개)**: `UserWordState.favorite Boolean @default(false)` · `favoritedAt DateTime?` · `@@index([userId, favorite])`. 추가 전용. 승인 범위 = 이 3가지(칸 2 + 색인 1)뿐 — 다른 DB 변경·삭제·기존 칸 수정은 승인 범위 밖.
- **최종 결정표**: D1 = D(출처 4번째 칸 「즐겨찾기」, 사용자) · D2 A(독립 AND) · D3 A(해제하면 같은 쪽 다시 읽기, 행 빠짐+토스트) · D4 A(시트 머리 별, 즉시 반영) · D5 A(낙관적+잠금+되돌림) · D6 A(분류 칩 숫자 불변) · D7 A(추가 시트 별 없음) · D8 = B2(사용자 색 + Leader 선택 윤곽) · D9 = 뱃지 아래 작은 별 + H2(사용자) · D10 A · D11 A(고정 이름+`aria-pressed`). 429 없음(한도 없음).
- **DB 백업(변경 전)**: `~/db-backups/thekaiwa-pre-task074-20261018-101004.sql.gz`(930,483B, 600, `mysqldump --single-transaction`, 테이블 56, gz 무결성 OK) — 임시 접속 파일(600)은 즉시 삭제. 복원 시 이 파일.
- **DB 반영 절차(Leader 가 직접, 이 순서)**: ① developer 가 스키마 3줄 + 정본 문서(domain-model·api-contract)를 편집하고 `prisma migrate diff`(스키마 ↔ 실제 DB) SQL 을 **파일로만** 산출(db push 안 함) ② Leader 가 SQL 이 `ADD COLUMN`×2 + `CREATE INDEX`×1 뿐인지 눈으로 확인 ③ 개발 미러에서 `prisma db push --skip-generate`(`--accept-data-loss` 금지) ④ 다시 diff 가 비어 있는지 확인. 이후 서버 코드·화면 코드 진행. 운영 코드는 새 칸을 몰라도 동작(DB 기본값).

## DB 반영 완료 (2026-10-18, Leader 직접)
- 순서: 백업(`~/db-backups/thekaiwa-pre-task074-20261018-101004.sql.gz`) → developer 서버 구현 완료([[task-074-dev-server-record]], 스키마 ↔ 스키마 SQL 2문) → **스키마 변경분 눈 확인**(칸 `favorite BOOLEAN NOT NULL DEFAULT false`·`favoritedAt DATETIME(3) NULL`·색인 `(userId, favorite)` + 문서 주석 한 줄, 승인 범위와 동일) → **실제 DB ↔ 새 스키마 diff**(읽기 전용 introspection): 정확히 `ALTER TABLE UserWordState ADD COLUMN`×2 + `CREATE INDEX UserWordState_userId_favorite_idx`×1, **드리프트·DROP·MODIFY 없음** → `prisma db push --skip-generate`(손실 허용 옵션 없음) exit 0 「Your database is now in sync」(7.29s) → 재diff `-- This is an empty migration.`
- **운영 안전 확인(읽기 전용 [확실])**: 현재 운영 릴리스 `20261018-003211-9a7d2672`(task-072, 즐겨찾기 모름) — 헬스 PRODUCTION ok degraded [] 11/11 · QA2 임시 쿠키로 `GET /api/v1/words`(`limit=3` → 200 items 3 total 7,757 / `archived=1` 200 / `source=mine` 200) 정상 → **새 칸이 있어도 옛 코드는 영향 없음**. 쿠키·`.env` 삭제 확인.
- **순서 제약**: DB 칸이 먼저 있어야 새 코드가 동작한다(배포 전 DB 반영 — 완료). 롤백: 새 코드를 되돌려도 DB 칸은 남지만 무해(기본값). 칸 제거는 별도 승인 사항.

## QA 최종 판정 (2026-10-18, Leader 종합)
- **QA-HTTP(실서버 3011·QA1~3)**: PASS_WITH_NOTES — Critical 0·High 0·Medium 0·Low 0([[task-074-qa-http-record]]). 인증 401(favorite·unfavorite·`?favorite=1`·잘못된 쿠키) · **교차 격리**: 남의 내 단어에 favorite/unfavorite/archive → 404(없는 id 와 응답 동일, 존재 노출 없음)·같은 기본 단어에 세 계정이 각자 켜도 독립 · 멱등·응답 WordEntry 전체+`favorite`·`favoritedAt` · 필터 AND·`total`·`pages`·`baseTotal` 정확·`favorite=0`/미지정 = 조건 없음·잘못된 값 400 · 보관과 독립 · **채점이 별을 안 지움**(10장 세트를 맞힘·틀림·건너뜀·미답으로 끝낸 뒤 별 6개 `favorite`·`favoritedAt` 그대로 — 서버 감사 Medium 1 의 실서버 확인) · 수정 #43 `favorite` 키 400 `read_only`·생성 #41 `unknown_key` · **동시성**(20~40 병렬 토글 5xx 0, 끝난 뒤 상세·목록 일치) · 성능(별 56개 `favorite=1` 목록 약 90ms) · 회귀·엔진명 0. 정리: QA1~3 별 0·보관 0·내 단어 0·전체 7,757 로 복원.
- **QA-UI(실제 Chrome·QA4)**: PASS_WITH_NOTES — Critical 0·High 0·Medium 0·신규 결함 0([[task-074-qa-ui-record]]). 켜기=`POST …/favorite`·끄기=`…/unfavorite` 확인 · 금색 채움+`ink` 윤곽 2px·`aria-pressed`·이름 「{단어} 즐겨찾기」·새로고침 유지 · **별 위치 실측(W8·W9)**: 폭 360/390/412 × 글꼴 100%·130%(근사) × 히라가나·한글 4조합 — 아이콘↔글자·뱃지 겹침 0·열 편차 0.00px·이웃 행 침범 0 · 필터 4칸(요청 `source=all&archived=0&favorite=1`, 다른 칸은 `favorite` 키 없음)·4칸 글자 잘림 0·빈 화면 두 가지·「‘q’ 추가하기」 없음 · 즐겨찾기 칸에서 끄기(토스트 정확히 1번·마지막 쪽 비면 앞 쪽·키보드로 끄면 초점 머리 줄) · 연타(응답 2.5초 지연 5연타 → 요청 1건)·500/오프라인/404 되돌림+문구 1번·404 때 시트 닫힘+토스트 1번 · 시트 머리 별(탭 순서 제목→별→닫기·Esc 로 시트 닫힘·수정 모드 같은 자리·삭제 확인 없음)·[저장] 응답이 옛 별 값을 줘도 유지·**시트 GET 응답 전 별 누르기 후 되돌아가지 않음** · 다크 B2 대비 계산값이 가이드와 일치 · 문구 10종이 데모 v2 와 글자 일치 · 콘솔·페이지 오류 0·외부 요청 0. 정리: 별 전부 끔·헤더 토글 복원·내 단어 삭제.
- **Low 2(알려진 한계 재확인)**: L-1 한글·히라가나를 모두 끈 행에서 별 누르는 곳의 행 아래 여유가 `html{font-size:130%}` 근사에서 **0.45px**(100% 2.25px, 글자까지 ×1.3 근사 4.13px) — 이웃 행 침범 0. **Leader 결정: 이번에 위치를 고치지 않는다**(바꾸면 `-bottom-[4px]` 1칸 이동이 가이드 §32·시험·QA 숫자를 연쇄로 바꾸고, 영향은 행 맨 가장자리 1px 이내 탭이 이웃 행 대신 별로 가는 정도) → **폰 확인 항목 W8 로 남김** · L-2 별 요청에 클라이언트 시간 제한 없음(응답이 영영 안 오면 잠긴 채, 보관·수정 요청도 같은 한계).
- **관찰(결함 아님)**: 한 사용자가 30개를 동시에 토글하면 최대 14.6초(트랜잭션 한도 15초에 근접), 그 사이 다른 사용자의 목록 읽기가 한 번 5.7초 지연 — 쓰기 1건 0.5~3.4초는 NAS DB 특성이고 보관과 같은 수준, 같은 별 연타는 클라이언트가 막고 낙관적 갱신이라 비현실적 폭주 · favorite/archive 라우트는 본문을 읽지 않고 Origin 검사가 없음(보관 때부터 동일 — 쿠키 SameSite 로 악용 경로 제한, 별도 보안 개선 후보).
- **미검증(폰·운영 관찰로 이월)**: 채택 교정 모음 → 단어 상세 별(QA4 에 채택 교정 0건, LLM 으로 만들지 않음 — **사용자에게 보이는 노출이므로 폰 확인 필수**) · 교정·제안 채택 시 기본 단어 연결과 평가 제출 전후 별 불변(AI 호출 필요) · 색인 사용 여부(DB 접근 금지) · 한 사용자 30건 초과 동시 토글 · 만료 토큰 401 · StrictMode 개발 모드 · 실기기 TalkBack·소프트 키보드·실제 폰 글꼴 배율 · 실제 두 탭 동시 조작 · 다른 시트 outerHTML 의 실브라우저 비교(공용 `Sheet` 는 336조합 렌더 바이트 동일로 갈음).
- **QA 환경 정리 완료**: 서버 PID 종료(`/proc/<pid>/cwd` 확인 후)·3011 비움·미러 `.env`·QA 쿠키 4개 삭제·운영 3010 무영향(릴리스 `20261018-003211-9a7d2672`, health ok). 남은 Chrome 8프로세스는 BJJ 작업(25~32일 전) 것이라 건드리지 않음. 미러 `thekaiwa-qa074`·`rev074*`·`dev074-*` 등은 사용자 지시 시 정리.

## 운영 배포 (2026-10-18 오후)
- 사용자 **「지금 커밋·푸시·배포 (권장)」**(AskUserQuestion) → 커밋 `51a4ad3`(코드·시험·설계·데모 43파일)·`89fcefc`(vault 기록) → **푸시 전 게이트**(HEAD `89fcefc` 별도 미러): prisma 0·tsc 0·eslint 0(오류 0·경고 5, 기존)·전체 시험 4,333 중 통과 4,330·실패 0·건너뜀 3·`next build` 0 → push `9a7d267..89fcefc`(task-072 배포 기록 문서 커밋 `6445dba` 동봉) → 웹훅 `RELEASE_RESULT` ok · **릴리스 `20261018-125304-89fcefc0`** · `migrated:false`(DB 칸은 이미 반영됨) · **롤백 대상 `20261018-003211-9a7d2672`**. 웹만 배포(네이티브 변경 없음).
- **배포 후 확인(Leader 직접, 읽기 전용 + 왕복 1회)**: `current` 일치 · health PRODUCTION ok degraded [] 11/11 · pm2 3 online restarts 0 · 번들(존재하는 경로 `.next/static/chunks` 로 검색): 새 문구 4종 있음·라우트 `favorite`·`unfavorite` 존재·엔진명 `sherpa` 1건 = `Plugins.SherpaStt` 플러그인 식별자(직전 릴리스와 같은 파일, 화면 문구 0). **운영 API(QA2 임시 쿠키·127.0.0.1)**: 쿠키 없음 401 · 목록 응답에 `favorite` 필드 · `favorite=2` 400 · 기본 단어 1개 켜기 → `favorite=true`·`favoritedAt` 있음 → `favorite=1` 필터에 1개 → 끄기 → `false`·`null` → 별 0개로 복원. **운영 화면**: 행 별 7개(이름 「会う 즐겨찾기」·`aria-pressed`)·출처 4칸·버튼 중첩 0·별이 행 안·열기 폭 = 행 폭·켜기 `POST …/favorite`·즐겨찾기 칸 요청 `source=all&archived=0&favorite=1&sort=recent&page=1&limit=7`·머리 줄 「즐겨찾기 1개」·끄기 `POST …/unfavorite`·빈 화면+토스트 「즐겨찾기에서 뺐어요」·콘솔 오류 0·외부 요청 0. 정리: QA2 별 0 복원·임시 쿠키 삭제.
- **알려진 한계(수용)**: ① 한글·히라가나를 모두 끈 행에서 별 누르는 곳의 행 아래 여유 0.45px(130% 근사) — 폰 확인 ② 별 요청에 클라이언트 시간 제한 없음(응답이 영영 안 오면 잠긴 채) ③ 두 탭·기기 동시 조작은 마지막 도착이 이김, 목록 응답은 트랜잭션 스냅샷이 아님(보관과 동일) ④ favorite/archive 라우트가 본문을 읽지 않고 Origin 검사가 없음(보관 때부터 동일, 별도 보안 개선 후보) ⑤ 한 사용자의 30개 이상 동시 토글은 최대 약 15초(트랜잭션 한도 근접, 비현실적 폭주) ⑥ 가이드 §32 와 구현의 차이는 §32-17 에 반영.
- **사용자 폰 확인 항목(IMP-0049 → 확인 후 `done`)**: ① 단어장 목록 행의 별 위치(뱃지 아래·금색 채움+윤곽)·누르면 상세가 안 열리고 별만 바뀜 ② 출처 줄 4번째 칸 「즐겨찾기」→ 즐겨찾기한 단어만, 머리 줄 「즐겨찾기 n개」, 별을 끄면 행이 빠지고 토스트 ③ 상세 시트 머리 별(기본 단어·내 단어)과 수정 모드에서도 같은 자리에서 켜지고 꺼짐, [저장]/[보관하기] 직후에도 별 유지 ④ **한글·히라가나를 모두 끈 행에서 별이 이웃 행과 닿지 않는지(0.45px — 가장 빠듯함)**, 글꼴 큰 설정 ⑤ **「채택한 교정」 탭에서 단어를 열면 시트 머리에 별이 보이는지**(승인 데모에 없던 노출 — QA 에 데이터가 없어 미검증, 원치 않으면 `fav={fav}` 한 줄 삭제) ⑥ 연타·느린 망에서 별이 어긋나지 않는지 ⑦ TalkBack 이 「{단어} 즐겨찾기, 선택됨」을 읽는지 ⑧ 보관·삭제·수정·검색·정렬·쪽 이동이 예전처럼 동작.

## 최종 요약 (사용자용)
- **한 일**: 단어장에 **즐겨찾기**를 추가했습니다. ① 목록의 각 단어 오른쪽(뱃지 아래)에 작은 별이 있어 눌러서 바로 등록·해제됩니다(상세는 열리지 않음). ② 조회 필터의 출처 줄에 네 번째 칸 **「즐겨찾기」**가 생겨 즐겨찾기한 단어만 모아 봅니다. ③ 단어 상세 화면과 수정 화면 위쪽에도 같은 별이 있어 거기서도 등록·해제됩니다(기본 단어도 가능). 켜진 별은 금색 채움에 윤곽선입니다.
- **결과**: 운영 배포 완료(릴리스 `20261018-125304-89fcefc0`). 운영에서 실제로 켜고 끄는 왕복, 즐겨찾기 필터, 끄면 행이 빠지고 빈 화면이 나오는 것까지 확인했고 별은 원상 복구했습니다. 서버·화면 모두 독립 감사와 Codex 외부 검토, 실서버 QA(두 계정 교차 격리, 채점 후 별 유지, 병렬 요청 포함)를 통과했습니다.
- **DB 변경**: 사용자 승인을 받아 백업 후 단어별 사용자 상태에 `favorite`·`favoritedAt` 두 칸과 색인 1개를 추가했습니다(추가 전용, 운영 코드 무영향 확인).
- **알아 둘 것**: 「내 단어 + 즐겨찾기」처럼 두 조건을 한 번에 고르는 것은 이 화면 구성에서는 안 됩니다(출처 칸이 하나만 골라지기 때문 — 사용자 선택). 「채택한 교정」 탭의 단어 상세에도 별이 보입니다(같은 시트라 일관성을 위해 제가 연결 — 원치 않으면 말씀해 주세요).
- **사용자가 해 주실 것**: 폰 확인 8개(위 목록) — 특히 ④ 한글·히라가나를 모두 끈 행의 별 위치와 ⑤ 교정 탭의 별. 이상이 있으면 롤백 대상은 `20261018-003211-9a7d2672` 입니다(DB 칸은 남아도 무해).

## 구현 계획 (데모 승인 + DB 칸 추가 승인 뒤)
1. **designer**: 데모(`docs/demo/task-074-word-favorites-v1.html`, delta) — 행(별 위치·크기·상태)·필터(어디에 어떤 모양, 보관 토글과의 관계)·상세 시트(기본/내 단어)·수정 폼·즐겨찾기 필터 켠 상태의 빈 결과·해제하면 목록에서 사라지는 방식·실패 안내. 결정 목록(★ 권고) + 사용자 질문. 구현 가이드 `docs/screens.md` 새 절.
2. **사용자 승인 두 가지**: 데모 승인(`check.mjs approve --quote`) + **DB 칸 추가 승인**(L1).
3. **developer(opus) 서버**: 스키마·`wordState`·`words.ts`(필터·응답)·라우트 2개·타입·`api-contract.md`·시험. **developer(opus) 화면**: `WordRow` 분리·필터·상세·수정 폼·순수 함수 상태 규칙+동작 시험(소스 스캔만 의존 금지). 서버와 화면은 소유 파일을 나눠 순차(서버 먼저).
4. **reviewer**(서버 → 화면) → **qa**(QA 서버 3011 `APP_ENV=LOCAL`, QA 계정, 실제 HTTP·Chrome·3폭) → 사용자 배포 승인.
5. DB 반영 순서: 승인 → mysqldump 백업 → `prisma db push`(개발 미러에서) → 개발·QA 검증 → 배포(운영 코드가 새 칸을 쓰기 전에 DB 칸이 먼저 있어야 한다).

## 완료 기준
1. 목록 행에서 별을 눌러 등록·해제된다(상세가 열리지 않음). 기본 단어·내 단어 모두.
2. 조회 필터에 즐겨찾기가 있고 다른 조건과 AND 로 동작한다(빈 결과 안내 포함).
3. 상세 화면(기본/내 단어)과 수정 화면에서 등록·해제된다.
4. 보관·삭제·수정·페이징·검색·정렬이 예전과 같다(회귀 없음). 다른 사용자의 단어 즐겨찾기는 404.
5. tsc 0 · eslint 0 · 전체 시험 · `next build` 0 · reviewer PASS · QA PASS · DB 백업 확인 · 사용자 폰 확인.

## 상태 로그
- 2026-10-18 사용자 요청 → IMP-0049 접수(`planned`) → judge intake(feature·R2·standard·delta·opus) → 이력서 작성(L1~L8). 다음: 게이트 init → designer 데모 v1.
- 2026-10-18 [designer] delta 데모 v1 → `docs/demo/task-074-word-favorites-v1.html`(103,390B, sha256 `f0b22c41…`, `DEMO_LINT_PASSED`) · 결정 D1~D11(★ 권고) · 자체 점검 2,244칸 — ★안 가로 넘침 0·44px 미만 0·행 높이 64 미만 0·별 겹침 0·잘림 0 · 기록 [[task-074-designer-record]]. 화면 구현 가이드 초안 `docs/screens.md` §32(승인 전 초안).
- 2026-10-18 [leader] 데모 전체(965줄) 읽고 Artifact 비공개 게시 https://claude.ai/artifact/3SEXH5VRewD6313LVUxrQA → `check.mjs status --to review_requested`(v1). **Leader 판단**: ① D11(designer 안 A) 수용 — L7 정정 ② L2 「한도」: 보관 라우트(#45)에 분당 한도가 없음을 코드로 확인([확실]) → 즐겨찾기도 **한도 없음**(보관과 같은 기준, 인증+보이는 단어만); designer 가 준비한 429 문구는 쓰지 않는다 ③ 공용 `Sheet` 에 선택 prop `headerAction` 추가(상세·수정 머리 별) → 안 넘기는 호출 43곳은 DOM 불변이어야 하며 task-072 교훈대로 전수 확인 ④ 쪽 번호 방식이라 D3 B(제자리 유지)는 [다음]에서 뺀 개수만큼 단어를 건너뛴다 → ★ 즉시 제거 근거. 다음: **사용자에게 데모 결정 D1~D11 + DB 칸 추가 승인** 요청.
- 2026-10-18 09:34 designer 데모 v1 `docs/demo/task-074-word-favorites-v1.html`(lint 통과, sha256 앞 16 `f0b22c4130180052`, 결정 D1~D11 ★·질문 Q1~Q4, D11 은 L7 과 다름) + screens.md §32 초안 → Leader 게시·승인 요청 대기. [[task-074-designer-record]]
- 2026-10-18 10:06 [designer] 데모 v2 `docs/demo/task-074-word-favorites-v2.html`(lint 통과, sha256 앞 16 `f07f84a68f567968`) — 사용자 지정 D1=D(출처 4번째 칸)·D8=B(금색, ★B2 윤곽)·D9(뱃지 아래 작은 별, ★H2), 나머지 ★ 승인 전 · 자체 시험 2,016칸 실패 0 · §32 v2 초안 → Leader 게시·승인 요청 대기. [[task-074-designer-record]]
- 2026-10-18 10:52 [designer] 화면 구현 가이드 확정 — `docs/screens.md` §32(13857~14115행, 승인 데모 v2 기준, 초안 표시 제거). 데모가 안 그린 「히라가나 끔」 행의 별 자리(`2.021em`)를 추가하고 QA W8 로 실측 고정, 응답 덮어쓰기 방지는 `favoriteView`(읽은 시각 비교). Leader 질문 없음(확인 2건). [[task-074-designer-record]]
- 2026-10-18 [developer] 서버 구현 완료(미커밋) — 스키마 3줄(칸 2·색인 1)·`wordState`/`words.ts`(필터·토글·응답)·#182/#183 라우트·타입·정본 문서·시험(F1~F10·R1~R5). migrate diff = ALTER 1(ADD COLUMN 2)+CREATE INDEX 1(DB 접촉 0, Leader 확인 대기) · tsc 0·eslint 0·전체 4,278 중 4,277 통과·실패 0·build 0·변이 16/16. [[task-074-dev-server-record]]
- 2026-10-18 [reviewer] 서버 감사 REV-074S — **PASS_WITH_NOTES**(Critical 0·High 0·Medium 2·Low 5): 서버 코드 결함 0, 시험 공백 지적(세트 끝내기가 별을 덮어써도·`sort=wrong`×즐겨찾기 조합·잠금 순서·색인 제거를 시험이 못 잡음 — 변이 16개 중 5 생존, 현재 코드는 탐침으로 정상 확인). 증빙 재실행: tsc 0·eslint 0·전체 4,278 중 통과 4,275·실패 0(건너뜀 3 = 미러에 docs 없음, R5·T25 따로 통과)·build 0. QA high_risk 10건. [[task-074-rev-server-record]]
- 2026-10-18 [developer] 서버 감사 지적 시험 보강 완료(제품 동작 변경 0) — 새 시험 8개(F11~F16·T74×2)+F4 강화, 감사자의 생존 변이 5개 **5/5 포착** + 새 변이 12개 **12/12 포착**(1차에서 N5 생존 → 가짜 DB 충실도·종단 시험 보강 후 포착), 문구 3곳 보정(api-contract #40 오류 행·라우트 JSDoc 2·`loadActiveWordStates` 주석). tsc 0·eslint 0·전체 4,286 중 통과 4,283·실패 0(건너뜀 3, 문서 지정 시 34/34). **사고**: 하드링크 미러에서 `cp` 로 다른 미러(`dev074-sv`·`dev074-ui`·`rev074s`) 시험 파일 2종을 잠시 바꿨다가 즉시 원본 복구. [[task-074-dev-server-record]] 「감사 후 시험 보강」
- 2026-10-18 [developer] 교정 모음 상세 연결 완료(미커밋) — 채택 교정 모음의 단어 상세 시트에도 머리 별(Leader 결정: 같은 시트라 일관성, 데모 재승인 불필요). 새 `drawer/correctionsFavorite.ts`+`CorrectionsScreen.tsx` +13줄, 새 시험 6개, 변이 16/16 포착, tsc 0·eslint 오류 0·전체 시험 4,317 중 통과 4,314·실패 0·건너뜀 3·`next build` 0. 알려진 한계 1번 해소. [[task-074-dev-ui-record]] 「교정 모음 상세 연결」
- 2026-10-18 11:30 [designer] 가이드 동기화(감사 L-4) — `docs/screens.md` §32 에 줄만 더함(13857~14157행, 원문 삭제·수정 0 · §32 앞 13,856줄 `cmp` 동일): 구현 후 정정 3곳(머리·32-5·32-9) + 새 32-17(교정 모음 호스트·훅 모양·그 밖 4건·감사 요약) + 확인표 W17~W23(켜기/끄기 방향·느린 망·끄는 중 칸 바꿈·교정 모음·StrictMode·시트 키보드·다크 B2)·감사 high_risk 12↔W 대응. 결정·상태 표·문구·순서 불변, 코드·데모·`docs/design` 무변경. [[task-074-designer-record]] 「가이드 동기화」
- 2026-10-18 11:54 [developer] 화면 감사 M-1 시험 보강 완료(미커밋, 화면 동작·DOM·문구·요청 불변 — 렌더 130종 `cmp` 동일) — 새 `vocab/wordsFavoriteEffect.ts`(효과 계획·실행·응답 꼬리·행 처리기) + `useWordFavorites` 의 `mountFavoriteController`·`stampedSend` + 새 시험 `favoriteWiring.test.ts` 16개(가짜 fetch·시험 한정 `useState`/`useSyncExternalStore` 대체, jsdom 0). 감사자 A 변이 **18/18 포착**(감사 때 1/18), 대조 7/7, `WordsScreen` 배선 잔여 7개는 생존(한계로 기록). tsc 0·eslint 오류 0·전체 4,333 중 통과 4,330·실패 0·건너뜀 3(문서 지정 시 25/25)·build 0. [[task-074-dev-ui-record]] 「감사 후 시험 보강(REV-074U M-1)」
- 2026-10-18 [reviewer] 재확인 REV-074U2 — **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 2): 시험 보강 리팩터는 **동작 보존**(제품 diff 줄 단위 + 독립 렌더 990종 전/후 `cmp` 동일, 새 분기·부수효과·순서 변경 0), 감사자 변이 A 18/18+변형 3 + 대조 7/7 + 새 13 **포착**, 생존 16(developer 표기 7 → 실제 16: 화면 인자 줄 11·훅 3·시트 GET 2)은 한 줄 통과 배선이라 QA Chrome 로 덮음(이전 Medium M-1 → Low L-1). 증빙 tsc 0·eslint 0/5·화면 551·전체 4,333/4,330/건너뜀 3·build 0 일치. QA 추가: 시트 GET 응답 전 별 누르기·훅 방향·키보드 초점. 기록 [[task-074-rev-ui-record]]
- 2026-10-18 [qa] 서버·데이터 실HTTP 검증 완료(QA 서버 3011, QA1~3) — **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 0, 결함 0건): 인증 401·남의 단어 404(403 아님)·멱등·`favorite` 필터 AND·`favorite=0`=조건 없음·잘못된 값 400·보관과 독립·세트 채점 후 별 6/6 불변·PATCH `favorite` read_only 400·동시 20·21·30·40병렬 전부 200(5xx 0)·`favorite=1` 목록 ≈90ms. 관찰: 한 사용자 30병렬 최대 14.6s(트랜잭션 15s 근접, 다른 사용자 읽기 1회 5.7s 정체). 미검증: 채택 연결·평가(LLM)·행 수/EXPLAIN(DB 금지)·30건 초과 폭주. 정리 완료(별 62 끄기·내 단어 7 삭제·보관 1 풀기, 3계정 total 7,757 복귀). 기록 [[task-074-qa-http-record]].
- 2026-10-18 [qa] 화면 QA(실제 서버 3011·실제 Chrome, QA4) **PASS_WITH_NOTES** — Critical 0·High 0·Medium 0·신규 결함 0·Low 2(기존 한계 재확인: 한글·히라가나 끔 행 누르는 곳 아래 여유 rem-130% 근사 0.45px · 별 요청 시간 제한 없음). 핵심: 요청 방향 켜기 `/favorite`·끄기 `/unfavorite` 행·시트 모두 확인, 36조합 별 겹침 0·열 편차 0, 5연타 요청 1건, 500·오프라인·404 되돌림+문구 1번, 즐겨찾기 칸 끄기 토스트 1번+초점 머리 줄+앞 쪽 물러남, **PATCH 가 옛 별 값을 돌려줘도·시트 GET 응답 전 별을 눌러도 별 값 불변**. **미검증**: 채택 교정 모음→단어 상세(데이터 없음)·StrictMode 개발 모드·실기기(TalkBack·폰 글꼴 배율)·W12 실브라우저. 정리 완료(별 0·시험 단어 삭제·토글 원복·산출물 25개 삭제), 서버 3011 은 Leader 정리 대기. [[task-074-qa-ui-record]]

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-18 09:13 |
| v1 | 검토요청 | docs/demo/task-074-word-favorites-v1.html | https://claude.ai/artifact/3SEXH5VRewD6313LVUxrQA | 사용자 검토 요청 | 10-18 09:35 |
| v1 | 수정요청 | docs/demo/task-074-word-favorites-v1.html | https://claude.ai/artifact/3SEXH5VRewD6313LVUxrQA | "D1은 D안으로 해주고 D8은 B안으로 해줘. 그리고 D9의 경우 우측의 조각, 내단어 표기 아래에 조그마하게 표기하는 형태로 해줘" | 10-18 09:47 |
| v2 | 검토요청 | docs/demo/task-074-word-favorites-v2.html | https://claude.ai/artifact/M5bzzSFuMH8xrTYLJdwDCZ | 사용자 검토 요청 | 10-18 10:07 |
| v2 | 승인 | docs/demo/task-074-word-favorites-v2.html | https://claude.ai/artifact/M5bzzSFuMH8xrTYLJdwDCZ | "B2로 승인, 한글 줄 없는 행은 H2, DB 칸 추가도 승인." | 10-18 10:09 |

## Codex 검토 (C2)

### [2026-10-18 12:15] C2 adversarial-review focus=concurrency — done
- judge 판정: 44행 `codex_required: true` mode=`adversarial-review` focus=`concurrency` / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=6445dba(HEAD_fallback) snapshot=ac19c31
- 지적 2건: 
  - [medium] `src/modules/learning/vocab/words.ts:611` — 두 탭에서 favorite/unfavorite 연타 시 요청 발행 순서를 보존하지 않아 마지막 사용자 의도와 반대의 DB 상태가 될 수 있음 (권고: mutationVersion 추가 또는 API 계약 명시)
  - [medium] `src/modules/learning/vocab/words.ts:377` — favorite 필터 목록의 count/findMany/loadWordStates가 독립 쿼리라 한 HTTP 응답 내부에서도 스냅샷 불일치 가능, 한 페이지 안에서 total/favorite 항목이 모순될 수 있음 (권고: 트랜잭션 또는 일관된 스냅샷으로 통합)
- 검토하지 못한 범위: 
  - 실제 MariaDB 동시 요청 재현 (DB 명령 금지, 읽기 전용 제약)
  - 실제 Chrome 다중 탭·오프라인 복귀 동작 (코드 경로만 검토)
  - UI 배치·접근성·회귀 시험 (범위 외)
- 소요: 67초
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261018T031451Z-task-074-C2/raw.txt`

### Leader 판정 (2026-10-18) — 두 건 모두 **채택하지 않음**(코드 변경 없음, 알려진 한계로 기록). 판정자는 reviewer 가 아니라 Leader 이며 근거는 코드 사실이다. 사용자가 더 엄격한 보장을 원하면 바꾼다.
- **지적 1 `words.ts:611` 요청 순서 미보존 → 비채택**. 근거 [확실]: ① 토글은 「켜기/끄기」로 상태를 명시하는 **멱등** API 이고 `setWordFavoriteTx` 가 `lockUserRow(tx, userId)` 안에서 직렬화한다(같은 파일 538·569·586행 다른 변경 함수도 쓰는 기존 도구) ② 같은 탭은 클라이언트 별 단위 잠금으로 순서 역전이 불가능 ③ 두 탭·두 기기에서 지연이 겹치면 「나중에 도착한 요청이 이긴다」인데 이는 보관·수정 등 모든 변경 API 와 같은 의미 ④ 영향 = 다른 탭이 다음 읽기 전까지 옛 별 표시, 데이터 손실·권한 문제 없음. 순서 번호(버전 토큰)는 토글에는 과한 설계.
- **지적 2 `words.ts:377` 목록 조회 스냅샷 불일치 → 비채택**. 근거 [확실]: `count → findMany → loadWordStates` 를 트랜잭션 없이 읽는 구조는 **HEAD 에 이미 있었다**(`git show HEAD:…words.ts` 364·365·145행) — task-068 부터 `archived` 필터에도 똑같이 적용돼 온 성질이다. 영향 = 같은 사용자가 다른 탭에서 몇 ms 사이에 별을 끌 때 한 응답 안에서 합계·항목이 어긋나거나 즐겨찾기 보기에 별이 꺼진 행이 한 번 섞임(다음 읽기에서 교정, 데이터는 맞음, 화면은 항목 자체의 `favorite` 값을 그리므로 꺼진 별로 보일 뿐). 고치려면 모든 목록 읽기를 트랜잭션/단일 쿼리로 묶어야 해서 이 task 범위 밖이고 위험이 더 크다.
- **알려진 한계로 이월**: ① 두 탭·기기 동시 조작 시 마지막 도착 요청이 이김(다른 탭은 다음 읽기까지 옛 별) ② 목록 응답은 트랜잭션 스냅샷이 아님(보관과 동일, 동시 조작 시 한 응답 안의 일시적 불일치). 사용자 폰 확인에는 올리지 않는다(재현 어려움).
