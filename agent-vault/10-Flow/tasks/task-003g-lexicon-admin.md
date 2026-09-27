---
task_id: task-003g
title: "발음 사전 관리 — 관리자 콘솔 Speech › TTS › Pronunciation Dictionary (API + 화면)"
status: in-progress
base_ref: 0c493c6
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, codex]
related_tasks: [task-003d-tts-p0, task-005b-admin-console-skeleton, task-007-talk-voice-web]
tags:
  - type/task
  - domain/speech
  - domain/tts
  - domain/admin
aliases:
  - 발음 사전 관리
  - task-003g
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-005b 완료 기준 중 이월분 "**Pronunciation Dictionary**(검색·추가·수정·비활성·Import/Export·미리듣기·버전 Rollback)" — 관리자(개발자)가 선생님 목소리의 **읽기가 틀린 단어**(인명·지명·외래어·숫자 예외 등)를 콘솔에서 고치고, 바로 들어 보고, 잘못 고쳤으면 이전 버전으로 되돌릴 수 있게 한다. 사전 엔티티·적용(방식 A: 앱 플랫폼 치환)·버전 스냅샷·시드는 [[task-003d-tts-p0]] 에서 이미 만들어졌다 — 이 task 는 **관리 API + 콘솔 화면**.

정본: `docs/design/api-contract.md` §7(5차 변경표) `GET/POST/PUT/DELETE /api/admin/v1/lexicon`·`import`·`export`·`preview`·`versions`·`rollback`(grep "admin/v1/lexicon") · `docs/design/speech-platform/16-tts-productization-layer.md` §2(사전·범위 우선순위·버전·방식 A)·§12 · `docs/design/domain-model.md` `PronunciationLexiconEntry`·`PronunciationLexiconVersion`(§5 상태 전이·§6 삭제 정책) · `docs/design/admin-console/01-console-information-architecture.md`(Speech › TTS › Pronunciation Dictionary 행)·02~16 중 편집·버전·감사 규칙 · `docs/design/role-permission.md`(`voices.read`·`voices.manage`, PRODUCTION = SUPER_ADMIN 확인) · `docs/design/configuration-resolution.md`(환경 분리) · `speech/tts-service/README.md` §2(`/g2p`).

## 관련 과거 이력 요약
- [[task-003d-tts-p0]]: `src/modules/speech/tts/lexicon.ts`(ACTIVE `PronunciationLexiconVersion.snapshot` 을 읽어 USER>VOICE>LESSON>COURSE>GLOBAL·최장 일치·priority), 캐시 키에 `dictionaryVersion[:lexiconDigest]` → 사전이 바뀌면 캐시 자동 미적중. 시드 GLOBAL 6건(`prisma/seed-lexicon.ts`). M4 `/g2p`(읽기·악센트 확인) 있음, `lexiconHints`·`/admin/lexicon/apply` 는 미구현(방식 A 라 불필요). QA-014 가 LOCAL 에 USER 항목 추가→버전 증가→비활성→원복을 라이브로 검증.
- [[task-005b-admin-console-skeleton]]: 콘솔 골격·capability 가드(USER `/admin` 404)·Effective Config·Connections·Health/Test·Trace·History 읽기. **발음 사전은 G1 로 이 task 에 이월**(screens §6 "메뉴·링크 없음"). 콘솔 화면 규칙·컴포넌트는 `docs/screens.md` §6.
- [[task-007-talk-voice-web]]: 턴 TTS·서명 URL·방금 합성 오디오 보관소. 사전 변경은 다음 턴부터 반영(캐시 키).
- 운영 주의: 운영 pm2 `APP_ENV=LOCAL`(콘솔 배지 LOCAL — PRODUCTION 보호 규칙은 코드로 구현하되 지금 운영에선 발동 안 함), 공유 DB 스키마 변경·db push 금지(필요하면 사용자 승인), 미러 build 금지(격리 복제본).

## Leader's Plan (2026-09-28)

### 범위 결정
- **G1 API(developer A)** — 정본 표 그대로: 검색(`q`·`scope`·`scopeRefId`·`enabled`·페이지), 추가·수정·비활성(`DELETE`=`enabled=false`, 물리 삭제 없음), Import(CSV/JSON, `mode=MERGE|REPLACE_SCOPE`, `dryRun=1` 이면 변경 예정 표만), Export(CSV/JSON, 현재 ACTIVE 스냅샷), Preview(`{text≤200, voiceId?, draftEntries?[]}` → `/g2p` 읽기·악센트 + 합성 오디오 — 초안 항목을 **저장하지 않고** 적용해 들어 보기, `bypassCache`), 버전 목록·Rollback(과거 스냅샷을 새 ACTIVE 버전으로 복제, 되돌려진 버전 `ROLLED_BACK` 표시).
- **G2 변경 규칙**: 모든 변경(추가·수정·비활성·Import 적용·Rollback)은 **한 트랜잭션**에서 항목 변경 + 새 `PronunciationLexiconVersion`(ACTIVE, 직전 SUPERSEDED, `snapshotHash`) + `AuditLog`(누가·무엇을·이유·전후 요약). 관리자 설정 변경 원칙("ConfigurationVersion+AuditLog 없이 저장 금지")에 대해 사전은 **자체 버전 엔티티가 ConfigurationVersion 역할**을 한다고 보고 — 정본(admin-console 문서)이 ConfigurationVersion 도 함께 요구하면 그것을 따른다(A 가 확인·기록). 동시 편집은 `baseVersion`(현재 ACTIVE 번호) 불일치 시 `409 VERSION_CONFLICT`. PRODUCTION 환경 변경은 SUPER_ADMIN + 확인 문구(`confirm`), 그 외 역할 403. `reason` 필수(≤200).
- **G3 검증**: `surface` 1~40자(일본어 문자 포함, 제어문자 0), `reading` 가나만(히라가나/가타카나·장음·促音, 1~80자), `accentType` 0~모라 수 범위 정수 또는 null, `priority` 0~100, `scope` ∈ {GLOBAL,COURSE,LESSON,VOICE,USER} + `scopeRefId` 규칙(GLOBAL 은 null, 나머지 필수·존재 확인), 같은 (environment, scope, scopeRefId, surface) 활성 중복 금지. Import 는 행별 오류 표(행 번호·사유)·최대 2,000행·파일 256KB, CSV 인젝션(`=+-@` 시작 셀) Export 시 이스케이프.
- **G4 화면(designer → developer B)**: 콘솔 메뉴 Speech › TTS › **발음 사전**(`/admin/speech/tts/lexicon`)·**버전**(`…/lexicon/versions`). 목록(검색·범위 필터·비활성 포함 토글·페이지), 항목 추가/수정 시트(표기·읽기·악센트·우선순위·범위, **저장 전 미리듣기** = draftEntries preview — 사전 적용 전/후 읽기 비교 + ▶), 비활성(확인), Import(파일 선택 → dryRun 결과 표 → 이유 입력 → 적용), Export(다운로드), 버전 목록(번호·시각·작업자·요약·항목 수) → Rollback(확인·이유). 390px 모바일도 동작(콘솔 기존 규칙 §6), 데스크톱 우선. `voices.read` 만 있으면 읽기 전용(버튼 숨김). 엔진명 비노출(“읽기 확인” 결과는 가나·악센트 표기만).
- **G5 미리듣기 오디오**: 사전 미리듣기 합성은 캐시에 쓰지 않는다(`bypassCache` — 초안이 캐시를 오염시키지 않게). 응답은 `audio/wav` 또는 JSON(`{reading, accent, audioUrl}`) 중 A 가 정하되, audioUrl 을 쓰면 task-007 서명 URL 규칙(사용자 결속·10분·실패 404)을 따른다. 분당 제한(관리자 10회).
- **G6 운영**: 스키마 변경 없음 예상(엔티티 있음). 필요하면 사용자 승인 사항으로 멈춘다. QA PASS 후 격리 빌드 → 미러 빌드 → `pm2 restart thekaiwa`.

### 구현 전략 · 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §10 발음 사전 관리(목록·시트·미리듣기 비교·Import dryRun 표·버전·Rollback·읽기 전용·오류 문구·데스크톱/390) + §6 콘솔 메뉴 행 갱신 | 1 |
| developer A (Opus, 서버) | G1~G3·G5 API(`src/app/api/admin/v1/lexicon/**`), 서비스(`src/modules/speech/tts/lexicon*` 또는 `src/modules/admin/speech/lexicon` — module-dependency 판독대로 A 가 정하고 기록), 감사·버전 트랜잭션, 단위 테스트, 라이브 스모크 `tests/live/task003g-smoke.*`, api-contract 개정(구현과 일치) | 1 |
| developer B (Opus, 화면) | G4 콘솔 화면·컴포넌트(`src/components/admin/lexicon/*`·`src/app/(admin)/admin/speech/tts/lexicon/**`)·메뉴 연결·화면 스모크(3폭 + 데스크톱) | 2(designer 후) |
| judge·codex | intake · C1(설계) · C2(보안 — 권한·CSV 인젝션·Import 파서·PRODUCTION 보호·감사 누락) | |
| reviewer·qa | 권한 매트릭스(USER 404·ADMIN/DEVELOPER/SUPER_ADMIN)·버전·감사 1:1·캐시 무효화·Import 경계·엔진명 | |

### 완료 기준 (qa)
1. tsc·lint·test 통과, 격리 build exit 0.
2. 권한: 세션 없음 401, USER `/api/admin/**` 404·화면 404, `voices.read` 만 → 쓰기 403·화면 읽기 전용, `voices.manage` → 쓰기 가능, PRODUCTION 환경 쓰기는 SUPER_ADMIN+confirm 만(나머지 403).
3. 추가·수정·비활성·Import 적용·Rollback 각각 → 새 ACTIVE 버전 1개 + AuditLog 1행(행 수 대조), 직전 버전 SUPERSEDED, 물리 삭제 0, `baseVersion` 불일치 409.
4. 사전 변경 후 같은 문장 #23 TTS → 캐시 미적중(새 `dictionaryVersion`)·읽기 반영, Rollback 후 원래 읽기 복귀.
5. Preview: draftEntries 가 저장 없이 적용(DB 행·버전·TtsCache 변화 0), `/g2p` 읽기·악센트 표시, 오디오 재생.
6. Import: dryRun 은 DB 변화 0 + 행별 오류표, MERGE/REPLACE_SCOPE 결과 정확, 2,000행·256KB 초과 거부, 잘못된 가나·중복·scopeRefId 오류 행 표시. Export → 다시 Import 하면 변화 0(왕복 불변), CSV 인젝션 이스케이프.
7. 화면: 목록·검색·필터·추가/수정·미리듣기 비교·비활성·Import dryRun→적용·Export·버전·Rollback 이 콘솔에서 동작, 데스크톱 + 390/412 넘침 0, 읽기 전용 역할 버튼 0, 엔진명 0.
8. QA 데이터(LOCAL 사전 항목·버전)는 끝나면 원복 — 시드 GLOBAL 6건 무변경 확인.

### 네이티브 변경
없음.

### 설계 확정 — designer §10-11 (Leader, 2026-09-28)
- **① 악센트 칸 유지** + 칸 아래 "지금은 읽기만 소리에 반영되고 높낮이는 목소리가 정해요" 안내, 미리듣기 "적용 후" 에 실제 높낮이 표시(designer 권장 채택). 방식 B(엔진 사용자 사전)는 후속 후보로 기록.
- **② 버전 diff API 추가(A)**: `GET /api/admin/v1/lexicon/versions/:v?compare=previous|active` → `{버전 필드, compare, against, counts, rows(≤100), truncated}` — 서버가 두 스냅샷 비교(스냅샷 전체를 내려보내지 않음). api-contract 에 추가.
- **③ 미리듣기**: 한 번 호출 `compare:true` → `{dictionaryVersion, before, after?}`(읽기·악센트·`matches`). 소리 전달 방식은 A 가 하나로 정해 계약에 고정(서명 `audioUrl` 이면 task-007 규칙 — 사용자 결속·10분·실패 404, 아니면 같은 라우트 `Accept: audio/wav`+`side`). `draftEntries` 는 범위 문맥과 무관하게 이번 요청에 적용, 같은 키(범위·대상·표기) 저장 항목을 대체. 캐시·DB 변화 0.
- **④ 예문 화면 상한 100자**(합성 1회 상한), 서버 계약 ≤200 은 문장 분할 시에만 의미 — A 가 100 초과를 422 로 할지 분할할지 정해 기록.
- **⑤ 목록 파라미터 채택**: `enabled=1|all`·`pageSize=50`·정렬 `updatedAt desc`·응답 `dictionaryVersion`·`counts`·`active`, 히라가나 검색어는 서버가 가타카나로 바꿔 읽기에도 매칭.
- **⑥ 중복 409** `E_LEXICON_DUPLICATE` + `details.existing`(항목 DTO, 꺼진 항목 포함).
- **⑦ 검증은 정본(현 코드 `validateLexiconEntry`·domain-model·16 §2.2) 우선** — Leader G3 의 "히라가나 허용·80자·우선순위 0~100" 은 **철회**: 읽기 = **가타카나·ー만, ≤60**(DB `VarChar(60)`), 우선순위 **0~1000**. 화면은 히라가나 입력을 보내기 전에 가타카나로 바꾼다(저장값은 늘 가타카나). 표기 오류 코드 `E_SURFACE_NOT_JA`·`E_SURFACE_CHARS` 는 A 가 채택 여부 기록.
- **⑧ PRODUCTION 확인**: task-005b 콘솔이 이미 쓰는 PRODUCTION 확인 방식이 있으면 그것을 따르고(일관성), 없으면 본문 `confirm:"PRODUCTION"`. A 가 확정해 B 계약에 적는다. 쓰기 버튼은 SUPER_ADMIN 에게만.
- **⑨ Import 는 전부 아니면 전무**: 오류 행 ≥1 이면 적용 거절 422 `E_IMPORT_HAS_ERRORS`. multipart `file`·`reason`·`baseVersion`·`confirm`, 쿼리 `mode`·`dryRun`, 결과 `changes`(≤100)·`scopes`·`errors`(≤200).
- **⑩ 저장 1번 = 버전 1개**(묶음 게시는 스키마 필요 — 이번 범위 밖).
- **⑪ admin 에서 `components/speech/ttsAudio` 재생 유틸 import 허용**(문구 없는 유틸 한정 예외). B 가 작게 끝낼 수 있으면 `components/common/audio` 로 옮기고 import 를 고쳐도 된다(판단·기록은 B).
- **⑫ 메뉴 행은 B 가 `menu.ts` 에 추가**하고 A 에 알린다.
- **⑬ 읽기 전용 화면은 단위 테스트(가짜 capability)로 확인** — 실제 역할 중 `voices.read` 단독은 없음.
- **⑭ ROLLED_BACK = 밀려난 직전 ACTIVE**(admin-console/09 §5·A 해석). `schema.prisma` 주석·domain-model·16 §2.3 의 반대 서술은 **A 가 주석·문서로 정리**(스키마 구조 변경 없음 — 주석만).
- **⑮ 되돌림 표시는 `changeSummary`**("v7 로 되돌림: {이유}"), 작업자 = `actorUserId` → User 조인 `actor{name, role}`, 없으면 "시스템". `entryCount`·`enabledCount` 는 서버 계산.
- **⑯ `AuditLog.scope=null` + `action='lexicon.*'`**(ConfigScope enum 에 LEXICON 추가는 db push = 사용자 승인 사항이라 하지 않음).
- **⑰ COURSE·LESSON·USER 대상은 id 직접 입력**(서버 존재 확인), VOICE 만 목록 선택.
- **⑱ 비활성은 본문으로 이유 전달**(URL 에 이유 금지): `DELETE` + 본문 또는 A 가 `POST …/:id/disable` — A 가 정해 B 계약에 적는다. B 는 `apiDelete` 선택 본문 인자 추가 가능.
- **⑲ 메뉴 라벨**은 구현 `menu.ts` 한국어 값을 따른다(§6-1 표 정리는 다음 §6 task).

## 판단 기록 (judge)

- [2026-09-28 10:15] intake engine=jev → feature / R2 / opus / ask_user | overrides=- | fallback=- | tokens=1048
  - **override**(Leader): `next=ask_user` 미적용 — 사용자 지시(2026-09-28 "사용자가 필요할 때까지 계속 작업 진행")이고, 범위·API·검증·권한·버전 규칙이 정본(api-contract §7 lexicon 표·domain-model·role-permission·speech-platform/16 §2)과 Leader's Plan G1~G6 에 확정돼 있어 물을 미결이 없다. 스키마 변경이 필요해지면 그때 사용자 승인으로 멈춘다. risk R2 채택.
- [2026-09-28 10:16] codex_gate/C1 engine=jev → codex_required=false / focus=security / budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=862

## Codex 검토

## Designer 기록

- [05:21] 화면 가이드 완료 → `docs/screens.md` **§10 관리자 콘솔 — 발음 사전**(10-0~10-11) + 변경 이력·§2 콘솔 행·§6 머리말·§6-1 메뉴 4a 행·§6-2 E(TTS 링크)·§6-10 문구 갱신. 결정 요약:
  - 경로 `/admin/speech/tts/lexicon`(목록 + 항목·가져오기·내보내기 시트, 필터·쪽은 URL 쿼리 — 서버 page 가 검증해 `initialParams`) · `/admin/speech/tts/lexicon/versions`(`?v=` 상세 시트·되돌리기). 메뉴 "엔진 › 발음 사전"(`speech-tts-lexicon`, `voices.read`, 음성 합성 바로 아래) + TTS 역할 페이지 링크 카드.
  - 목록: 컨테이너 ≥720 = `<table>` 7열 / <720 = 카드, 표기·읽기는 자르지 않고 줄바꿈. 쓰기 4갈래(`useLexiconAccess`): voices.read 만 → 보기 전용 · voices.manage → 쓰기·미리듣기 · PRODUCTION 비 SUPER_ADMIN → 보기+미리듣기 · SUPER_ADMIN PRODUCTION → 확인 문구 `PRODUCTION` + "PRODUCTION 에 저장".
  - 항목 시트: 읽기 히라가나 입력 허용 → 보내기 전 가타카나 변환, 악센트 = 모라 칩(radiogroup) + ↑↓ 표기, 이유 필수 + 빠른 이유 칩, `baseVersion` 409 는 입력 유지 + [새로 불러오기], 끄기(물리 삭제 없음 문구)·다시 켜기·닫기 확인. 미리듣기 = 적용 전(지금 사전 v{n}) / 적용 후 두 줄 + 각 ▶(탭 안 `unlockTtsAudio`), 입력 바뀌면 stale.
  - 가져오기: 파일(≤256KB 클라 선검사) + MERGE/REPLACE_SCOPE(끄기 위험 세 곳 표시) → dryRun 개수·행별 오류표·바뀌는 항목 → 오류 0 일 때만 이유 → 적용(dryRun 의 baseVersion). 내보내기 CSV/JSON(fetch→blob, 앱 WebView 안내). 버전: 상태 3종 뱃지·상세 diff·되돌리기(지금과 비교 + 이유 + PRODUCTION 확인).
  - developer B 파일: `src/app/(admin)/admin/speech/tts/lexicon/{page,versions/page}.tsx` · `src/components/admin/lexicon/*`(19 컴포넌트 + 8 순수/훅 + 테스트 3) · `types/admin.ts` Lexicon 절 · 수정 `menu.ts`(1행, 소유 확인 필요)·`labels.ts`·`RoleScreen.tsx`·`common/api.ts`(`apiDelete` 본문 인자).
  - **Leader 확인 요청 19건(§10-11)** 중 중요: ① 방식 A 치환이라 `accentType` 이 소리에 반영 안 됨 → 화면이 정직하게 안내(숨길지 사용자 결정) ② 버전 상세 diff API `GET …/versions/:v?compare=previous|active` 가 정본에 없음(A 추가 요청) ③ preview 는 `compare:true` 한 번에 before/after + 소리는 `audioUrl` 또는 `Accept: audio/wav`+`side`, draftEntries 는 범위 문맥 무시·같은 키 대체 ④ 예문 화면 상한 100자(합성 1회 상한) ⑦ 읽기 60자·가타카나 저장(정본) vs G3 80자·히라가나 — 화면은 변환 후 60 ⑨ 가져오기는 오류 0 일 때만 적용(422 `E_IMPORT_HAS_ERRORS`) ⑬ voices.read 만인 역할이 실제로 없어 읽기 전용은 단위 테스트로 ⑭ ROLLED_BACK = 밀려난 직전 ACTIVE(A 판독과 일치, prisma/domain 주석과 반대) ⑯ `ConfigScope` 에 LEXICON 없음.

## Developer 기록

### A(서버)
- [05:06] 착수 — 정본 판독: api-contract §7-2 lexicon 5행·§0-5 오류 코드·domain-model `PronunciationLexiconEntry/Version`(§5 상태 전이·§6 삭제)·16 §2·role-permission §6~§7·admin-console 06/09(ROLLED_BACK = **대체된 직전 ACTIVE**, 복원 대상 상태 불변)·module-dependency §11(admin L0 `admin/speech/lexicon` → `speech/tts` 공개 함수). **ConfigurationVersion 은 만들지 않는다**(domain-model·16 §2.3 "별도 ConfigurationVersion 행은 만들지 않고 AuditLog 만" — 자체 버전 테이블이 정본). DB 현황: LOCAL·PRODUCTION 각각 v1 ACTIVE(시드 GLOBAL 6) 뿐, lexicon AuditLog 0행. **운영 pm2 가 APP_ENV=LOCAL 이라 LOCAL 사전 = 실사용자 발음** → 스모크는 QA 계정 USER scope·가짜 표기만 쓰고 끝에 버전·항목을 기준선으로 되돌린다.
- [05:46] **구현 완료·커밋 `5f8d9c1`**(Leader 설계 확정 ①~⑱ 반영). 층 배치: 라우트 `src/app/api/admin/v1/lexicon/**`(얇음) → L0 `src/modules/admin/speech/lexicon.ts`(권한·PRODUCTION·입력·대상 확인·트랜잭션+감사·DTO) → L4 `src/modules/speech/tts/{lexiconStore,lexiconRules,lexiconCsv,lexiconPreview}.ts`(소유 테이블 쓰기·순수 규칙·CSV/JSON·미리듣기) → L5 `engine.tts.g2p`(신규 — 어댑터 `styleBertHttp.g2pHttp` 가 사전 힌트 치환 후 `/g2p {text}`). DTO 단일 출처 `src/types/lexicon.ts`. 기존 코드 변경: `lexicon.selectEntries(…, forced?)`(초안 우선)·`synthesize.prepareSentence` 입력 `lexicon` 재정의(미리듣기 전용)·`wav.concatWav`·infra `UNPROCESSABLE`(422)·`findAuditsByTargets`·`userExists/userBriefs`·`readBodyCapped` export·learning `topicExists/lessonExists`(신규 `refs.ts` — 소유 목록 밖이지만 COURSE·LESSON 대상 확인에 필요, 읽기 전용 2함수).
  - **동시성(잠금 방식)**: 쓰기마다 환경의 **가장 오래된 버전 행**(번호 최소, 삭제 경로 없어 고정)을 `SELECT … FOR UPDATE` → 모든 쓰기 직렬화(두 관리자·blue/green 두 프로세스), 잠금 뒤 일반 SELECT 는 READ COMMITTED 라 앞 커밋의 ACTIVE·최대 번호를 본다 → 번호 충돌·ACTIVE 2행 없음. 버전 행이 없는 환경의 첫 쓰기는 `@@unique(environment, version)` P2002 → 409. 라이브 3l: 같은 baseVersion 동시 POST 2건 → 200·409, ACTIVE 1.
  - **정본과 다르게/새로 정한 것**: ① ConfigurationVersion 미생성(정본 문구대로 — 자체 버전 테이블) ② AuditLog.scope=null(`ConfigScope` 에 LEXICON 없음, db push 안 함 — ⑯) ③ 오류 봉투에 **`UNPROCESSABLE`(422) 추가**(api-contract §0-5 행 추가) — 갈래는 `details.reason`(E_LEXICON_ENTRY_INVALID·E_IMPORT_*·E_PREVIEW_TEXT_TOO_LONG). 409 는 `CONFLICT`+reason(VERSION_CONFLICT·E_LEXICON_DUPLICATE·ALREADY_ACTIVE·NO_CHANGE) ④ 표기 규칙 `E_SURFACE_NOT_JA`·`E_SURFACE_CHARS` **채택**(라틴 약어는 정규화기 약어표 몫) ⑤ 읽기 = 가타카나·ー만 ≤60(NFKC 로 반각 가나만 전각으로 받고 **히라가나는 422 E_READING** — ⑦), 우선순위 0~1000 ⑥ **수정은 키(표기·범위·대상) 불변**(`E_IMMUTABLE` — 화면 규칙과 맞춤, 항목 이력이 키로 이어지게) ⑦ POST 가 **꺼진 같은 키면 되살림**(`revived:true`, 같은 id — 활성이면 409 E_LEXICON_DUPLICATE+existing) ⑧ **변경 0 이면 버전·감사 없음**(`changed:false`), Rollback 만 409 `NO_CHANGE` ⑨ 되돌림 `changeSummary` = "v7 로 되돌림: {이유}"(⑮) ⑩ 스냅샷에 `note` 추가(해시엔 불포함 — 시드 v1 은 note 없음 → Rollback 은 현재 메모 유지, diff 는 메모 비교 생략) ⑪ **Export 는 항목 표 기준**(= ACTIVE 스냅샷 내용 + 메모; 시드 v1 스냅샷엔 메모가 없어 스냅샷 기준이면 왕복 불변이 깨짐) + 헤더 `X-Lexicon-Consistent` ⑫ **미리듣기 소리 = `Accept: audio/wav` + `side`**(서명 URL 안 씀 — ③ 중 ㉡: 읽기 확인이 가볍고 합성은 ▶ 누를 때만), 읽기 확인·소리 **각각** 분당 10 ⑬ **예문 >100 은 분할**(④): 문장 단위 60자 조각마다 읽기 확인·합성, 소리 200ms 간격으로 이음 → 화면 상한 200 가능, 그래도 넘으면 422 `E_PREVIEW_TEXT_TOO_LONG` ⑭ 미리듣기 목소리 수치 = 중립(AUTO·1.0)+NATIVE(관리자 개인 설정 미적용), 서버 상태 판정(서킷)에 안 넣음 ⑮ VOICE 대상도 존재 확인(⑰ 은 COURSE·LESSON·USER — 목록 선택이라도 무해) ⑯ ROLLED_BACK 주석 정리: `schema.prisma`(주석만, db push 불필요)·domain-model(모델 주석·§5 표)·16 §2.2 L-4·§2.3·§2.5 ⑰ 목록 `enabled` 기본 all(화면은 1 을 보냄), `scope=ALL` 허용.
  - **한계**: 사전 캐시 30초 — 다른 프로세스(운영 pm2·blue/green 상대)는 쓰기 후 ≤30초 뒤 반영(쓴 프로세스는 커밋 직후 비움). `accentType` 은 방식 A 치환이라 소리에 반영 안 됨(①, 화면 안내). 묶음 게시 없음(⑩). PRODUCTION 경로는 QA 역할 토큰이 PRODUCTION 서버에서 인정되지 않아 **단위 테스트로만**(ADMIN/DEVELOPER 403 missing `config.apply.production`, SUPER_ADMIN confirm 없음/소문자 403 `PRODUCTION_CONFIRMATION_REQUIRED`, confirm 일치 통과). `voices.read` 단독 역할 없음(⑬) → 쓰기 403 라이브 불가, 단위 테스트(`can`).
  - **검증**: tsc 0 · eslint 0 error · 단위 신규 22(`speech/__tests__/lexiconAdmin.test.ts` 17 — 검증 코드·패치·키·계획·Import MERGE/REPLACE_SCOPE·Rollback 해시 불변·diff 종류·CSV 인젝션/파서/왕복·미리듣기 초안 우선·조각·WAV 잇기·**가짜 tx 로 버전 전이 전 과정**(SUPERSEDED·409 둘·E_IMMUTABLE·NOOP·되살림·Import 거절·ROLLED_BACK·NO_CHANGE·ALREADY_ACTIVE) / `admin/__tests__/lexicon.test.ts` 6 — 권한·PRODUCTION·메타·목록 쿼리·미리듣기 본문) — 전체 422 중 421 PASS, 실패 1 은 **B 진행 중 파일** `components/admin/lexicon/__tests__/kana.test.ts` 가 `@/modules/speech/tts/{text,lexiconRules}` 를 import(컴포넌트 경계 테스트 `sttClientBoundary` — B 몫). 격리 build(`thekaiwa-buildcheck-a`, cp -al) **exit 0**(B 화면 라우트 포함) 후 삭제. **라이브 `tests/live/task003g-smoke.sh 3011` 52/52 PASS**(M4 실제: #23 합성 3·미리듣기 소리 2·읽기 확인 12) — 권한 401/USER 404×7/역할 3종, 칸 오류 422 코드 7종, 추가·수정·NOOP·비활성·되살림·동시 쓰기 잠금, **#23 캐시 미적중(v1→v2)·매칭 1 → Rollback 뒤 미적중·매칭 0**, 미리듣기 before/after 읽기(`ヨミカエタ`)·WAV 둘·DB/TtsCache 변화 0·Trace PLAYGROUND, Import dryRun 오류표·거절 422·MERGE·REPLACE_SCOPE·상한 5종, Export 왕복 3종 변경 0·적용 applied:false, 버전 목록(작업자·이유)·diff previous/active·Rollback(해시=대상·ROLLED_BACK)·NO_CHANGE, 감사=버전=요청 8(1:1), 분당 10 → 429.
  - **QA 데이터 원복**: 스모크 `finally` 가 LOCAL 항목(QA 가짜 표기 4행 삭제)·버전(v2~ 삭제, v1 ACTIVE 복원)·TtsCache(사전 버전 > 기준 또는 가짜 표기 포함 행+파일)·QA Trace 를 지우고 **시작 전과 행 단위 동일**을 대조(8번 항목). 확인: LOCAL v1 ACTIVE·항목 6(GLOBAL 시드 6 무변경). **AuditLog 는 불변이라 남음**(lexicon.* QA 계정 16행 = 2회 실행) — 버전 목록은 버전보다 먼저 생긴 감사 행을 무시(5초 여유)하므로 나중에 같은 번호로 생긴 실제 버전과 섞이지 않는다. 재실행은 30초 뒤(서버 사전 캐시). dev 3011 은 PID 로 종료(3012 는 B 것으로 보여 두었다).
  - **Leader 확인 요청**: (a) `UNPROCESSABLE`(422) 전역 코드 추가 승인(api-contract §0-5 에 적음) (b) learning `refs.ts` 추가(소유 목록 밖) (c) `ConfigScope` LEXICON enum 은 사용자 승인 시 db push 로 추가 가능 — 지금은 scope=null.

#### A → B 계약 요약(고정, 2026-09-28 05:46 — 정본 api-contract §7-2a)
- **타입**: 전부 `@/types/lexicon`(LEXICON_LIMITS·LEXICON_SCOPES·LEXICON_WORD_TYPES·LEXICON_CSV_COLUMNS·LEXICON_PRODUCTION_CONFIRM·LexiconEntryDto·LexiconListDto·LexiconWriteResultDto·LexiconImportResultDto·LexiconDiffRowDto·LexiconVersionDto·LexiconVersionListDto·LexiconVersionDetailDto·LexiconRollbackResultDto·LexiconPreviewDto·LexiconPreviewSideDto·LexiconFieldCode·LexiconErrorReason). `types/admin.ts` 에 다시 정의하지 말 것. **컴포넌트는 `@/modules/speech/**` 를 import 할 수 없다**(경계 테스트) — 히라가나→가타카나(`[ぁ-ゖ]` +0x60)·모라 수(작은 가나 ァィゥェォャュョヮヵヶ 제외, ッ·ン·ー 는 1모라)는 화면 쪽 순수 함수로.
- **공통 쓰기 본문**: `baseVersion`(목록 `dictionaryVersion`, 쓰기 성공 뒤 `res.version.version` 으로 즉시 갱신) · `reason`(1~200) · `confirm`(PRODUCTION 일 때만 `"PRODUCTION"`). PRODUCTION 쓰기 = SUPER_ADMIN(`config.apply.production`)만.
- **L1 `GET /api/admin/v1/lexicon`** `q`·`scope`(ALL|5종)·`scopeRefId`·`enabled=1|all`(기본 all)·`sort=recent|surface`(기본 recent=updatedAt desc)·`page`·`pageSize`(≤100, 기본 50) → `{environment, items, page, pageSize, total, dictionaryVersion, counts{enabled, disabled}, active: LexiconVersionDto|null}`(counts·active 는 사전 전체). 히라가나 검색어는 서버가 읽기에도 매칭.
- **L2 `POST /lexicon`** 항목 필드 + 공통 → `{changed, entry, version{version, createdAt}, previousVersion, revived?}`. **L3 `PUT /lexicon/:id`** 바꿀 필드만(`reading, accentType, priority, wordType, note, enabled`; 표기·범위·대상 바꾸면 422 `E_IMMUTABLE`) — 같은 값이면 `changed:false`. **L4 `DELETE /lexicon/:id` 본문** `{baseVersion, reason, confirm?}`(이유 URL 금지) — `apiDelete` 본문 인자.
- **L5 `POST /lexicon/import?mode=MERGE|REPLACE_SCOPE&dryRun=1|0` multipart** `file`(.csv/.json ≤256KB ≤2,000행) + 적용 때 `baseVersion`(dryRun 응답의 `baseVersion`)·`reason`·`confirm?`(선택 `format`) → `{dryRun, mode, format, baseVersion, rows, counts{add, update, disable, unchanged, error}, scopes[{scope, scopeRefId, disable}], changes[≤100 LexiconDiffRowDto{kind, surface, scope, scopeRefId, before, after, row}], changesTruncated, errors[{row, field|null, code}≤200], errorsTruncated, warnings, applied, version{version, createdAt}|null}`. 적용은 오류 행 ≥1 이면 422 `E_IMPORT_HAS_ERRORS`(details `counts·errors`). 변경 0 적용은 `applied:false`(토스트 "바뀐 내용이 없어요").
- **L6 `GET /lexicon/export?format=csv|json`** 파일(`Content-Disposition` 파일명 `lexicon-<env>-v<n>-<yyyymmdd>.<ext>`, 헤더 `X-Lexicon-Dictionary-Version`). 봉투 아님 — 실패만 JSON 봉투.
- **L7 `POST /lexicon/preview`** `{text(≤200 — 서버가 문장 분할), voiceId?, draftEntries?[≤20], compare?:true}` → `{dictionaryVersion, voiceId, before, after|null, traceId}`, 쪽 = `{normalizedText, reading, accent, matches[{surface, reading, accentType, scope, source:'DRAFT'|'ACTIVE'}](등장마다 — 개수 = 적용 횟수), audioUrl:null}`. before = 지금 사전, after = 지금 사전 + 초안(범위 무관·같은 키 대체). **소리 = 같은 L7 에 같은 본문 + `side:'before'|'after'` + `Accept: audio/wav`**(`apiPostAudio`) → WAV. 429 는 읽기 확인·소리 각각 분당 10. 읽기(가나)는 엔진 발음형이라 長音 ー 가 모음으로 나온다(ワード→ワアド).
- **L8 `GET /lexicon/versions?page=&pageSize=`**(≤50, 기본 20) → `{environment, items: LexiconVersionDto[], page, pageSize, total, activeVersion}`; `LexiconVersionDto{version, status, createdAt, actor{name, role}|null(→ "시스템"), changeSummary, entryCount, enabledCount, snapshotHash, reason, action, restoredFrom}`. **L8a `GET /lexicon/versions/:v?compare=previous|active`** → 버전 필드 + `{compare, against, counts{added, changed, disabled, enabled}, rows[≤100], truncated}`(active = 되돌리면 생길 변화). **L9 `POST /lexicon/versions/:v/rollback`** 공통 → `{version{version, createdAt}, replaced{version, status:'ROLLED_BACK'}, restoredFrom, counts{add, update, disable}}`.
- **오류**: status 먼저 → `details.reason`. 400 VALIDATION(`details.field` — baseVersion·쿼리·text·side 등) · 403(`details.missing` 또는 `reason:'PRODUCTION_CONFIRMATION_REQUIRED'`) · 404 · 409 CONFLICT(`VERSION_CONFLICT`{baseVersion, currentVersion} · `E_LEXICON_DUPLICATE`{existing(항목 DTO, 꺼진 것 포함), existingId} · `ALREADY_ACTIVE` · `NO_CHANGE`) · **422 UNPROCESSABLE**(`E_LEXICON_ENTRY_INVALID`{errors[{field, code, message}], fields{field: code}, index?(초안)} · `E_IMPORT_HAS_ERRORS` · `E_IMPORT_TOO_LARGE`{maxBytes} · `E_IMPORT_TOO_MANY_ROWS`{rows, maxRows} · `E_IMPORT_FORMAT` · `E_IMPORT_HEADER` · `E_PREVIEW_TEXT_TOO_LONG`) · 422 ENGINE_UNAVAILABLE(목소리 서비스 없음) · 429 · 502/504(목소리 서비스). 칸 코드 = §10-8 ⓑ 표 그대로(`E_SURFACE`·`E_SURFACE_NOT_JA`·`E_SURFACE_CHARS`·`E_READING`·`E_ACCENT`·`E_PRIORITY`(0~**1000**)·`E_SCOPE`·`E_SCOPE_REF`·`E_SCOPE_REF_NOT_FOUND`·`E_WORD_TYPE`·`E_NOTE`·`E_ENABLED`·`E_IMMUTABLE`·`E_REASON`, 행: `E_DUPLICATE_IN_FILE`·`E_ROW_FORMAT`). 확인 문구 불일치는 칸 오류가 아니라 403.

### B(화면)
- [05:24] 착수 — screens §10(10-0~10-11)·§6 콘솔 공통·Leader 확정 19건·A 타입(`@/types/lexicon`) 판독. 순수 모듈(`kana`·`lexiconCopy`·`lexiconParams`·`lexiconApi`)부터.
- [05:58] **구현 완료·커밋 `760c50e`**. 파일: `src/app/(admin)/admin/speech/tts/lexicon/{page,versions/page}.tsx` · `src/components/admin/lexicon/*`(화면 19 + 훅 4 + 순수 9 + 테스트 3) · 수정 `menu.ts`(1행 `speech-tts-lexicon`, 음성 합성 바로 아래 + 머리 주석 — **A 에 알림 ⑫**)·`labels.ts`(MENU_SUB)·`RoleScreen.tsx`(TTS "발음 사전" 링크 카드)·`common/api.ts`(`apiDelete(path, body?)` + 새 `apiGetFile` — 내보내기 blob·`Content-Disposition` 파일명, 401·봉투 오류 규칙 공유) · `tests/live/task003g-ui-e2e.mjs`.
  - **가이드와 다르게/새로 정한 것**: ① DTO 는 A 의 `@/types/lexicon` 단일 출처 — `types/admin.ts` Lexicon 절은 **만들지 않음**(A 계약) ② **서버 대조 테스트 = 골든 표**: 컴포넌트는 `@/modules/speech/**` import 금지(경계 테스트 `sttClientBoundary` 를 한때 깨뜨림 → Leader 지시로 수정) → A 커밋 a408f00 의 `text`·`lexiconRules` 로 한 번 계산한 값(가나 표본 30·초안 28 사례의 오류 칸)을 `kana.test.ts` 에 고정. **서버 규칙이 바뀌면 골든을 다시 떠야 한다** ③ 예문 상한 **200**(A 분할 결정 — 가이드 100 대신, `LEXICON_LIMITS.previewTextMax`) ④ 우선순위 0~**1000**(공유 상수), 칸은 `type=text inputMode=numeric`(type=number 는 "1.5e" 등이 빈 값이 되어 기본값으로 몰래 저장될 수 있어서) ⑤ 표기 오류 문구 "공백이나 보이지 않는 문자가 섞여 있어요"(서버 `E_SURFACE_CHARS` 가 공백도 막음) ⑥ 새 문구: 되살림(`revived`) 토스트 "꺼져 있던 항목을 다시 켜서 저장했어요 · 사전 v{n}", **30초 캐시 안내**(적용 규칙 4번째 줄·저장 줄 "(다른 서버 프로세스에는 최대 30초 뒤)"), `E_IMMUTABLE` → 칸이 없어 알림 "표기·범위는 바꿀 수 없어요 — 끄고 새로 추가해 주세요." ⑦ 서버 칸 오류 `E_SURFACE`·`E_READING` 은 빈 값/길이를 같이 쓰므로 화면 검사 결과로 세부 문구를 고른다 ⑧ ⑪ `ttsAudio` 는 옮기지 않고 import 예외 사용(범위 최소) ⑨ `?v=` 로 열린 채 시작하는 버전 시트는 **하이드레이션 뒤에만** 그림(`useSyncExternalStore`) — 공용 `Sheet` 가 서버에서 null 이라 초기 열림이면 하이드레이션 불일치(실측 발견) ⑩ URL 동기화 = params → effect `router.replace`(같은 주소면 부르지 않음), 쪽 번호 초과는 렌더 중 조정 ⑪ 모드 전환 포커스는 직전 모드 비교(개발 모드 effect 이중 실행에도 1회) ⑫ 미리듣기 적용 횟수 = `after.matches` 중 `source:'DRAFT'` 수 ⑬ `baseVersion` = max(목록 `dictionaryVersion`, 마지막 쓰기·409 `currentVersion`) — 버전 번호는 늘 커져서 재조회를 기다리지 않는다.
  - **검증**: tsc 0 · eslint 0 error(내 파일 경고 0) · 단위 신규 29(`kana` 8·`lexiconCopy` 14 — 엔진명 0 grep 포함·`access` 7 — 권한 4갈래·쓰기 버튼 DOM·확인 문구 칸·목록 고치기/보기·diff 표시·되돌리기 버튼 자리, `renderToStaticMarkup`) 포함 **전체 422/422 PASS**. **라이브 `tests/live/task003g-ui-e2e.mjs` 55/55 PASS**(dev 3012 하드링크 복제본, DEVELOPER·ADMIN·USER QA 계정, M4 실제): 목록 표·메뉴 활성·넘침 0(1a-c) · 추가 요청 전 검사·히라가나→가타카나·모라 칩 10·頭高 표기(2a-f) · 미리듣기 before/after·"1번 적용"·▶ Accept wav 200·흐림+▶ 잠금(3a-d) · 저장 토스트·DB 가타카나/악센트(4a-d) · 중복 409 → 그 항목 열기(5a) · API 동시 저장 → 409 (v{a} → v{b}) 입력 유지 → 새로 불러오기 → 저장(6a-c) · 검색 URL·변경 없음 요청 0·끄기(물리 삭제 없음)·꺼진 항목 포함·다시 켜기(7a-g) · 버전 ?v= diff·**새로 고침 하이드레이션 오류 0**·되돌리기·ROLLED_BACK·사용 중 버전 버튼 없음(8a-e) · 가져오기 256KB·확장자 요청 전 거절·오류표(잘못된 가나·없는 대상)·적용 버튼 없음·MERGE 적용·**REPLACE_SCOPE 끄기 수 3곳**(9a-h) · 내보내기 CSV/JSON·시트 유지·**왕복 변화 0**(10a-d) · 문장 읽기 확인(11) · 360/390/412 목록 카드·시트 4종·버전 넘침 0·터치 ≥44·콘솔 오류 0(12) · USER 404×2(13) · 엔진명 0(1d·1e) · 원복(14).
  - **QA 데이터 원복**: e2e `finally` 가 A 스모크와 같은 방식으로 LOCAL 항목(QA USER 범위 가짜 표기 画面検証甲·乙·丙 삭제)·버전(v2~ 삭제, v1 ACTIVE 복원)·QA Trace 삭제 후 **행 단위 동일 대조 PASS**. 최종 확인: LOCAL `[v1 ACTIVE]`·항목 6(GLOBAL 6 사용 중)·테스트 TtsCache 0. AuditLog(lexicon.* QA 행)는 불변이라 남음(3회 실행분). dev 3012 PID 종료 → `ss -ltn` 3011/3012 비어 있음 · 복제본 `~/.node-local/thekaiwa-lexb` 삭제 · QA 쿠키 파일 삭제. 미러 build 안 함.
  - **한계**: PRODUCTION 갈래(확인 문구·버튼 이름)·`voices.read` 단독은 단위 테스트(가짜 capability)로만(⑬). 소리는 헤드리스 Chrome 에서 WAV 200·"멈추기" 표시까지(청취는 안 함). 앱 WebView 내보내기 파일 저장은 미검증(앱에서만 안내 한 줄). 오류표·diff 는 서버 상한(≤200·≤100) 그대로 그리고 "외 n개"만 표시. e2e 는 A 스모크와 동시에 돌리면 서로의 원복이 상대 행을 지운다 — 스크립트가 `task003g-smoke` 프로세스를 보면 시작하지 않는다.

## Reviewer 기록

## QA 기록

## 최종 요약
