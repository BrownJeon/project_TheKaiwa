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

- [06:08] **REV-017 수정·커밋 `171763e`**. M1(CSV 짧은 행): `lexiconCsv.parseCsvFile` 이 머리글보다 짧은 행의 뒤쪽 칸은 **키를 만들지 않는다** → `parseEntryInput` 의 `present()` 가 false → 머리글에 없는 열과 같이 갱신은 기존 값 유지·추가는 기본값. **값 없음 vs 빈 값** 규칙 고정: 값 없음(머리글에 없는 열·짧은 행 뒤쪽 칸·JSON 에 없는 키) = 유지 / 빈 값(칸이 있는 `""`·JSON `null`) = 기본값으로 되돌림(accentType 0·priority 10·scope GLOBAL·scopeRefId/wordType/note null·enabled true). JSON 은 원래 같은 규칙(없는 키 = `present()` false)이었음을 테스트로 확인. **꺼진 항목 + `enabled` 값 없음 → 꺼진 채 다른 값만 갱신**(판단: 일괄 가져오기가 파일이 말하지 않은 켜기를 하면 안 된다 — 되살리려면 `enabled=true` 를 적는다. 단건 POST 의 되살림은 화면에서 한 항목을 명시적으로 추가하는 행위라 다르다; dryRun `changes` 에서 kind 가 ENABLED 가 아니라 CHANGED 로 보인다). 긴 행은 그대로 `E_ROW_FORMAT`. api-contract §7-2a Import 행에 규칙 추가, 코드 주석(lexiconCsv 머리·lexiconRules planImport) 갱신.
  - 테스트: 단위 +3 — 짧은 행 같은 값 UNCHANGED(꺼진 채)·읽기만 바꾼 짧은 행 UPDATE(priority 500·COMMON·메모·enabled false 유지, kind CHANGED)·짧은 새 항목 기본값 / 빈 칸 = 기본값(kind ENABLED)·note 만 빈 칸·JSON 없는 키 UNCHANGED·JSON null 지움 / **가짜 tx 로 dryRun 계획 = 실제 적용**(counts·항목 표·버전 스냅샷 일치, 꺼진 항목 꺼진 채) + 적용 뒤 Export → REPLACE_SCOPE 변경 0. 전체 **425/425**, tsc 0, eslint 0 error. 라이브 `task003g-smoke.sh` **53/53**(신규 6c2: 짧은 행으로 기존 USER 항목 dryRun → UNCHANGED) — B `task003g-ui-e2e` 실행 중 아님을 `pgrep -f "[t]ask003g-ui-e2e"` 로 확인 후 실행, 원복 대조 8 PASS(LOCAL v1·항목 6), dev 3011 PID 로 종료.
  - **Low 판단**: L1(`PREVIEW_PROBLEM.TEXT_TOO_LONG` 도달 불가) → **제거**(예문 초과는 speech 가 `PreviewTextTooLongError` 로 올려 422 `E_PREVIEW_TEXT_TOO_LONG`, 주석으로 이유). L2(`findAuditsByTargets` 인덱스) → **이번엔 안 함**: 스키마 변경 = 공유 DB db push(사용자 승인)이고, 쿼리가 `action LIKE 'lexicon.%'`(Prisma `startsWith`, 접두 일치라 인덱스 사용 가능)를 함께 걸어 기존 `@@index([action, createdAt])` 범위 스캔으로 lexicon 감사 행(= 사전 버전 수 + QA 행)만 훑는다 — 규모상 문제 없음. AuditLog 가 커져 느려지면 `@@index([environment, targetId])` 를 후속 db push 후보로.

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

### REV-017 (2026-09-28, 서버 5f8d9c1+a408f00)

**대상**: `5f8d9c1`(A API 구현, 39파일) + `a408f00`(smoke 설명 1행). B 의 미커밋 화면·`kana.test.ts` 는 대상 아님(별도 REV 예정). 정본 대조: api-contract.md §0-5·§1-3·§7-2·§7-2a, domain-model.md(PronunciationLexicon*·§5·§6), role-permission.md §3·§6, admin-console/06·09(ROLLED_BACK 의미), speech-platform/16 §2, module-dependency.md §11·226행 import 행렬.

**독립 재실행**: `~/.node-local/thekaiwa-revcheck-003g` 에 `git archive a408f00` 추출 + `~/.node-local/thekaiwa/node_modules` 하드링크(cp -al) — 운영 미러 무변경, 검증 후 삭제.
- `tsc --noEmit -p tsconfig.json` → 0 오류.
- `eslint`(변경된 전 파일: admin/speech/lexicon.ts·speech/tts/lexicon*.ts·wav.ts·types/lexicon.ts·app/api/admin/v1/lexicon/**·admin/index.ts·learning/refs.ts·infra/{users,audit,http,multipart,index}.ts·engine/{index,tts/index,registry/types}.ts·engine/adapters/tts/{styleBertHttp,styleBertVits2.provider}.ts·speech/tts/{index,synthesize}.ts) → `--max-warnings=0` 0건.
- `node --import tsx --test` 신규 22건(`admin/__tests__/lexicon.test.ts` 6·`speech/__tests__/lexiconAdmin.test.ts` 16) 스크래치에서 단독 재실행 → **22/22 PASS**, A 자체 보고와 일치.
- 라이브 `tests/live/task003g-smoke.ts`(52건)는 **재실행하지 않음** — 운영 pm2 가 `APP_ENV=LOCAL` 이라 이 사전이 실사용자 발음이고(task 이력서 A 기록 확인), 재실행은 실제 LOCAL DB·M4 TTS·TtsCache 를 다시 건드린다. 대신 스크립트 전문을 정독해 (a) `finally` 블록의 원복 로직이 항목·버전·상태·TtsCache·Trace 를 모두 시작 전 스냅샷과 비교해 되돌리고 `check('8 원복', …)`으로 재검증함 (b) 52개 체크가 완료 기준 2~6·8 을 실제로 커버함을 확인. 재현 가능성 판단 근거는 있으나 라이브 수치 자체는 A 보고를 신뢰.

#### 1. 권한 (PASS)
- `requireCapability`(005b 인프라, 이번 diff 로 변경 없음) 체인 확인: 세션 없음 → 401 `UNAUTHENTICATED` · `console.access` 없음(USER, `voices.read`만 보유) → **모든 7 라우트 동일하게 404**(`hiddenNotFound()`, capability 종류와 무관 — `guard.ts:74`에서 capability 확인보다 먼저 걸림) · capability 부족 → 403 `details.missing`.
- `voices.read`/`voices.manage` 매트릭스: `can()` 단위 테스트(`lexicon.test.ts:26-31`)로 USER=voices.read만·ADMIN/DEVELOPER/SUPER_ADMIN=voices.manage 확인.
- PRODUCTION 쓰기: `admin/speech/lexicon.ts:113-118` `authorizeLexiconWrite` 가 `assertCapability(actor,'voices.manage',{targetEnvironment:actor.environment, productionSensitive:true})` 로 **create/update/disable/import/rollback 전부**에 `config.apply.production`(SUPER_ADMIN 전용, matrix 상 ADMIN/DEVELOPER 는 없음)을 요구 — role-permission 매트릭스의 Voice 프로필 규칙("disable/delete 만 P")보다 넓지만, api-contract.md 의 **기존**(A 변경 전) 문구 "PRODUCTION 은 SUPER_ADMIN 확인(사전 변경은 발음 전체에 영향)"과 Leader §10-11 ⑧ 요청과 정확히 일치 — 의도된 확장이며 정본과 충돌 없음. `confirm` 불일치(소문자 `'production'` 포함) → 403 `PRODUCTION_CONFIRMATION_REQUIRED`, 우회 경로 0(`lexicon.test.ts:33-44` 로 재검증, 라우트 레벨 `requireCapability('voices.manage')` 는 컨텍스트 없이 1차 게이트 — 방어 심층화일 뿐 우회 아님).
- 발견 없음.

#### 2. 버전·감사 무결성 (PASS)
- `writeLexicon`(`lexiconStore.ts:327-458`): 트랜잭션 = 환경 잠금(`lockAndRead` — 가장 오래된 버전 행 `FOR UPDATE`) → `baseVersion` 확인(불일치 409 `VERSION_CONFLICT`) → 항목 변경 → 직전 ACTIVE `SUPERSEDED`(Rollback 은 `ROLLED_BACK`) → 새 ACTIVE(`max+1`) → (호출자가 같은 tx 로) `AuditLog` 1행. 변경 0(`items.length===0`) 이면 버전·감사 없이 `changed:false` 조기 반환(`lexiconStore.ts:394-408`) — Rollback 만 `NO_CHANGE`/`ALREADY_ACTIVE` 로 명시적 거부.
- **동시 쓰기 직렬화**: `withTransaction`(`infra/tx.ts:25-38`, 기존 인프라·이번 diff 무변경)이 `isolationLevel: ReadCommitted` 를 명시 — MariaDB 기본(REPEATABLE READ)이 아니라 READ COMMITTED 이므로 `FOR UPDATE` 로 대기했다가 풀린 뒤의 평범한 SELECT 가 그 사이 커밋된 최신 행을 정확히 본다(격리 수준을 코드로 확인). 잠그는 행 = "그 환경에서 번호가 가장 작은 버전 행"(물리 삭제 없어 불변) → 두 프로세스(blue/green) 쓰기가 이 행 하나를 두고 직렬화. **버전 0개 환경**(첫 쓰기)은 잠글 행이 없어 두 첫 쓰기가 경합할 수 있으나 `@@unique([environment, version])` 가 마지막 방어(P2002 → `isUniqueViolation` 매핑 → 409) — 코드·주석·단위 테스트(`lexiconAdmin.test.ts` "버전 전이") 모두 일치. 라이브 3l(같은 baseVersion 동시 POST 2건 → 200/409, ACTIVE 1)로 A 가 실측했다고 기록 — 재실행은 안 했으나 잠금 논리 자체는 코드로 안전성 확인됨.
- **ROLLED_BACK 의미**: `writeLexicon:428`이 "현재 ACTIVE" 를 `ROLLED_BACK` 으로 바꾸고 복원 대상(과거 버전) 행은 건드리지 않음 — `docs/design/admin-console/09-configuration-rollback-api.md:59` "현재 ACTIVE → ROLLED_BACK(복원 대상 :id 의 상태는 그대로)" 와 정확히 일치. domain-model·schema.prisma 주석은 A 가 이번 diff 로 정정(스키마 구조 변경 0, 주석만) — 확인함.
- `E_LEXICON_DUPLICATE`(활성 키 중복) 시 꺼진 동일 키는 되살림(`revived:true`, 같은 id, 물리 행 증가 없음) — `planCreate`(`lexiconRules.ts:331-337`)·라이브 3i·단위 테스트로 3중 확인.
- 발견 없음(설계 의도와 구현 1:1).

#### 3. Import/Export 보안 (PASS, MEDIUM 1건)
- **상한이 파서 이전에 강제됨을 코드로 확인**: `readFormDataCapped`(`infra/multipart.ts` 신규) → `readBodyCapped`(`infra/http.ts:112-128`, 기존)가 `Content-Length` 선검사 + 스트림을 상한(288KB = 256KB+32KB 여유) 넘는 순간 `reader.cancel()` 하고 `null` 반환 — **CSV/JSON 파싱은 이 함수가 통과시킨 바이트만 본다**(`importLexicon`: `form = await readFormDataCapped(...)` 이 먼저, 이후 `file.size > importMaxBytes` 재검사, 그 다음에야 `parseLexiconFile`). 2,000행 상한(`lexiconCsv.ts:121,143`)은 레코드 분해 뒤 개수만 비교(파일 자체가 이미 256KB 로 막혀 있어 자원 고갈 위험은 없음).
- 인코딩: `TextDecoder('utf-8',{fatal:true})` 로 깨진 UTF-8 은 즉시 `E_IMPORT_FORMAT`. BOM 은 CSV·JSON 양쪽에서 제거 후 파싱.
- **전부 아니면 전무**: `planImport` 의 `counts.error>0` 이면 `writeLexicon` 이 커밋 전에 `LexiconImportInvalidError` 던짐(`lexiconStore.ts:378`) → 422 `E_IMPORT_HAS_ERRORS`, DB 변화 0(dryRun 경로는 애초에 트랜잭션 밖).
- **REPLACE_SCOPE 범위 한정**: `planImport`(`lexiconRules.ts:457-468`)이 파일에 실제로 등장한 `(scope,scopeRefId)` 쌍만 `pairs` 에 넣고 그 쌍 안에서만 비활성 — 다른 범위 영향 없음(단위 테스트 12·라이브 6d 확인).
- **CSV 인젝션**: `escapeCsvCell`/`unescapeCsvCell`(`lexiconCsv.ts:14-24`) — `=+-@\t\r'` 로 시작하는 셀에 `'` 접두, Import 시 그 접두만 제거 → 왕복 불변을 코드·단위 테스트("CSV 인젝션")·라이브 6f(`,'=1+1,` 확인) 3중으로 검증. 셀이 원래 `'` 로 시작해도(`''...`) 대칭적으로 복원됨을 정규식으로 확인.
- **Export = 항목 표(스냅샷 아님)의 정합성**: `exportLexicon`(`lexiconStore.ts:249-256`)이 `PronunciationLexiconEntry` 테이블을 직접 읽고 `consistent = (activeSnapshotHash === snapshotHash(entries))` 로 스냅샷과의 차이(시드 v1 처럼 `note` 가 없던 시절 등)를 헤더(`X-Lexicon-Consistent`)로 알림 — 왕복 불변(Export→Import dryRun 변화 0)이 스냅샷 기준이었다면 깨졌을 케이스(시드 메모 없음)를 항목 표 기준으로 우회한 결정이 타당함. 단위 테스트("왕복 불변")·라이브 6h 로 확인.
- **MEDIUM-1 — CSV 짧은 행(열 수 부족)이 기존 값 보존 대신 기본값으로 조용히 재설정됨.**
  - 위치: `src/modules/speech/tts/lexiconCsv.ts:123-130`(`parseCsvFile` — `raw[c] = unescapeCsvCell(rec.cells[i] ?? '')`, 행이 머리글보다 짧으면 없는 칸을 `''` 로 채움) + `src/modules/speech/tts/lexiconRules.ts:58-60,101-107`(`present()`/`has()` — "칸이 있고 빈 문자열"과 "명시적으로 비움"을 구분하지 않고 둘 다 "기본값으로 재설정" 분기로 감).
  - 근거: 스크래치에서 재현 — 머리글 9열, 데이터 행 2열(`明日,アシタ`)인 CSV 를 파싱해 기존 항목(`priority:500, wordType:'COMMON', note:'keep me', enabled:false`)에 patch 적용한 결과 `{priority:10, wordType:null, note:null, enabled:true}`, 오류 0건. **꺼져 있던 항목이 되살아나고(enabled:false→true) priority·wordType·note 가 조용히 지워짐** — 행 길이 검사(`lexiconCsv.ts:128`)는 머리글보다 **긴** 행만 `E_ROW_FORMAT` 으로 잡고 짧은 행은 경고조차 없음. 이는 같은 함수의 문서화된 계약(`lexiconRules.ts:394-397` "빠진 열은 기존 값 유지(갱신)·기본값(추가)")과 정면으로 어긋난다 — 이 계약은 "헤더에 그 열 자체가 없는" 경우에만 실제로 지켜지고(`present()` 가 정확히 false), "헤더엔 있지만 이 행만 짧은" 경우엔 깨진다.
  - 위험: MERGE Import 로 손으로 만들거나 외부에서 받은 열 수가 적은 CSV(예: `surface,reading` 두 칸만으로 새 단어를 추가하려는 파일)를 올렸을 때, 그 표기·범위 키가 **이미 존재**하면(특히 비활성 상태였다면) 의도치 않게 되살아나고 세부 설정이 사라진다. Export→Import 표준 왕복(항상 9열 전부 씀)은 영향 없음.
  - 완화 요인: dryRun 의 `changes` 배열이 이 변경을 `before/after` 로 보여주므로(예: `enabled:false→true`) 신중히 검토하면 적용 전에 발견 가능하고, 적용 후에도 Rollback 으로 되돌릴 수 있어 영구 손실은 아니다. 이 때문에 CRITICAL/HIGH 가 아니라 MEDIUM.
  - 권고: 행이 머리글보다 짧을 때 누락된 뒤쪽 칸은 `raw[c]='` 대신 아예 키를 만들지 않아(헤더에 없는 열과 같은 취급) `present()` 가 false 를 돌려주게 하거나, 열 수 불일치를 **길든 짧든** 행 오류(`E_ROW_FORMAT`)로 잡아 admin 이 명시적으로 인지하게 한다.

#### 4. Preview (PASS)
- DB·버전·TtsCache 변화 0: `previewLexiconAudio`(`lexiconPreview.ts:192-237`)가 `tts.synthesize`(엔진 파사드)를 **직접** 호출 — `synthesizeSentence`/`flights`(singleFlight)/`storeCachedAudio`/`rememberRecentAudio` 를 전혀 거치지 않음을 import·호출 그래프로 확인(캐시 관련 함수 어디에도 안 씀). 라이브 5c(`before===after` 스냅샷 대조 + `cacheLeak===0`)로도 확인.
- `draftEntries`(≤20) 검증·상한(`parsePreviewBody`, `admin/speech/lexicon.ts:500-523`) 확인. `Accept: audio/wav`+`side` 는 route 레벨에서 `requireCapability('voices.manage')` 이후 분기(읽기 확인과 같은 권한, `voices.read` 단독 불가) — 분당 제한도 읽기 확인·소리 각각 별도 키(`lexicon-preview:`·`lexicon-preview-audio:`)로 10회(라이브 5g 확인, `rateLimit` 자체는 기존 인프라의 프로세스 내 메모리 버킷 — blue/green 2 프로세스면 사실상 최대 20/분 가능성 있으나 이는 기존 rateLimit 유틸의 일반적 특성이지 이번 diff 의 신규 결함 아님, 참고만).
- 100자 초과 처리: 서버 계약은 `text≤200`(화면 상한 100 은 B 권한) → `packChunks`(60자 단위) + `MAX_CHUNKS=8` 로 문장 분할·이어 합성(200ms 간격), 그래도 넘으면 `PreviewTextTooLongError`→422 `E_PREVIEW_TEXT_TOO_LONG`. `prepareSentence` 내부에서 나는 `TtsRequestError('TEXT_TOO_LONG')` 도 `lexiconPreview.ts:92-97`(`run()`)에서 같은 오류로 변환됨을 확인.
- 엔진명 0: `previewCorpus` 정규식 검사(라이브 5f) + 코드 전체 grep(`style-bert|sbv2|reazon|whisper` 등)으로 `admin/speech/lexicon.ts`·`speech/tts/lexicon*.ts`·`types/lexicon.ts`·API 라우트에서 0건 확인. `g2pHttp`(엔진 어댑터, `engine/adapters/tts/styleBertHttp.ts`)만 엔진 세부(모델·시크릿 헤더)를 알고, 응답은 가나·악센트 문자열만 상위로 올라옴.
- **LOW-1 — `mapPreviewError`(`admin/speech/lexicon.ts:525-546`)의 `PREVIEW_PROBLEM.TEXT_TOO_LONG`(400) 분기가 도달 불가능한 죽은 코드.** `prepareSentence` 가 내는 `TtsRequestError('TEXT_TOO_LONG')` 은 `lexiconPreview.ts` 의 `run()` 클로저에서 이미 `PreviewTextTooLongError` 로 변환돼 상위로 나가므로(먼저 잡힘), `mapPreviewError` 가 raw `TtsRequestError('TEXT_TOO_LONG')` 를 받을 경로가 없다(실제 동작은 항상 422 `E_PREVIEW_TEXT_TOO_LONG` 로 귀결 — 버그는 아니고 유지보수성 문제). 권고: 그 항목을 `PREVIEW_PROBLEM` 에서 빼거나 "도달 불가·방어용" 주석 추가.

#### 5. 6층 경계 (PASS)
- `admin/speech/lexicon.ts` 는 `@/modules/speech`(barrel, `export * from './tts'` 로 lexicon 심볼 전부 노출) 와 `@/modules/learning`(barrel, `topicExists`·`lessonExists` 추가 export) 만 import — 둘 다 `module-dependency.md:226` `admin: ['conversation','learning','speech','preferences','engine','infra']` 에 이미 허용된 방향(신규 `learning/refs.ts` 는 "소유 목록 밖" 이라는 A 의 겸손한 자기신고와 달리, 실제로는 admin→learning 자체는 기존에 이미 허용된 경로 — A 가 "이 파일이 새로 생겼다"는 뜻으로 쓴 말이지 경계 위반은 아님). `speech`→`admin` 역방향 import 는 grep 으로 0건 확인.
- `speech/tts/lexicon*.ts` 어디에도 `admin` import 없음(권한·감사는 전부 `admin/speech/lexicon.ts` 조합, `lexiconStore.ts` 헤더 주석과 실제 코드 일치).
- `refs.ts`(`topicExists`/`lessonExists`)·`infra/users.ts`(`userExists`/`userBriefs`) 모두 읽기 전용, 소유 테이블(`ConversationTopic`/`Lesson`/`User`) 밖 컬럼 접근 없음, `environment` 컬럼이 애초에 없는 테이블이라(글로벌 콘텐츠·계정) 환경 필터 누락이 문제 되지 않음을 스키마로 확인.
- 엔진명 누출 0(위 4번과 동일 grep 결과 재확인).

#### 6. 캐시 무효화 (PASS — "특히 확인" 항목 결론: 오염 불가능)
- 즉시·지연 반영 메커니즘: `writeLexicon` 커밋 성공 시 호출자(`admin/speech/lexicon.ts:218` `commit()`)가 `afterLexiconCommit()`→`clearLexiconCache()`(`speech/tts/lexicon.ts:186-188`)로 **쓴 프로세스**의 30초 메모리 캐시(`loadActiveLexicon`)를 즉시 비움. 다른 프로세스(blue/green 상대)는 자기 캐시가 있으면 최대 30초 뒤에야 새 버전을 읽음 — 설계 의도대로 동작.
- **"30초 동안 옛 사전으로 합성된 오디오가 새 버전 키로 캐시되는 오염 가능성"**: 없음. 근거 — (1) `PronulciationLexiconVersion` 행은 생성된 뒤 `snapshot`이 **불변**(상태만 바뀜, Rollback 도 새 행 생성), 즉 버전 번호 하나는 영원히 같은 내용 하나만 가리킨다. (2) `prepareSentence`(`synthesize.ts:192-204`)에서 캐시 키의 `dictionaryVersion`(`parts.dictionaryVersion`)과 실제 치환에 쓴 사전 항목(`selected`/`hints`)이 **같은 `loadActiveLexicon()` 호출 결과**(`lex`)에서 나온다 — 즉 어떤 프로세스가 아무리 오래된 캐시(예: v1)를 들고 있어도, 그 요청은 캐시 키에 `dictionaryVersion=1` 을 찍고 실제로 v1 사전으로 합성한 오디오를 그 키에 저장한다(내용과 키가 항상 일치). 버전 번호가 재사용되지 않으므로 "v1 캐시 키인데 실제로는 v2 사전으로 합성됨" 같은 어긋남이 구조적으로 발생할 수 없다. (3) Preview 경로(`lexiconPreview.ts`)는 애초에 `tts.synthesize` 직접 호출로 캐시에 아무것도 쓰지 않으므로(4번 항목) 이 경로에서 오염이 생길 여지 자체가 없다.
- 발견 없음.

#### 7. 검증 규칙·테스트 충분성 (PASS)
- 표기(1~40, `E_SURFACE`·`E_SURFACE_CHARS`·`E_SURFACE_NOT_JA`) · 읽기(가타카나+ー 만, ≤60, `KATAKANA_READING=/^[ァ-ヺー]+$/` 로 히라가나 확실히 거부 — `text.ts`, 기존 코드 재사용 확인) · 악센트(0~모라 수) · 우선순위(0~1000) · `scopeRefId` 존재 확인(COURSE=Topic·LESSON=Lesson·VOICE=VoiceProfile·USER=User, 전부 스키마상 `environment` 컬럼이 없어 환경 무관 존재 확인이 맞음) 모두 DB 컬럼 폭(`VarChar(40/60/20/200)`)·`LEXICON_LIMITS` 상수·검증 함수 3자가 일치.
- `E_IMMUTABLE`(표기·범위·대상 변경 금지)·스코프 GLOBAL=null 대 그 외 필수 규칙 확인.
- 신규 단위 테스트 22건 스크래치 독립 재실행 **22/22 PASS**(위 "독립 재실행" 절). 커버리지: 권한·PRODUCTION·쓰기 메타·목록 쿼리·미리듣기 본문·감사 대상·정규화·검증·패치·키·계획(추가/중복/되살림/수정/비활성)·Import(MERGE/REPLACE_SCOPE)·Rollback 계획·diff·CSV 인젝션·CSV 파서(BOM/CRLF/따옴표/빈 줄)·파일 파서(헤더/2,000행/JSON)·왕복 불변·미리듣기 forced 우선순위·문장 조각·WAV 잇기·**가짜 tx 버전 전이 전 과정**(위 2번 확인) — 실사용 시나리오를 폭넓게 덮음.
- 라이브 smoke 52건은 재실행하지 않았으나 스크립트 정독으로 원복 절차의 건전성(시작 전/후 항목·버전·상태 완전 대조, `AuditLog` 만 의도적으로 남김 + 재실행 시 버전 번호 재사용에 대비한 `AUDIT_SKEW_MS` 처리)을 확인함.

#### 종합 판정

```json
{
  "reviewId": "REV-017",
  "status": "PASS",
  "issues": [
    {
      "issue": "CSV Import 에서 머리글보다 짧은 데이터 행의 누락된 뒤쪽 칸이 '기존 값 유지' 대신 '빈 값→기본값 재설정'으로 처리됨(문서화된 계약과 불일치)",
      "severity": "MEDIUM",
      "component": "src/modules/speech/tts/lexiconCsv.ts:123-130, src/modules/speech/tts/lexiconRules.ts:58-60,101-107",
      "risk": "MERGE Import 로 열 수가 적은 CSV(예: surface,reading 두 칸)를 올리면 같은 키의 기존 항목이 비활성 상태였어도 조용히 되살아나고(enabled:false→true) priority·wordType·note·accentType 이 기본값으로 초기화됨. 경고·오류 0.",
      "evidence": "스크래치(a408f00) 독립 재현: 2열 CSV 행 + base={priority:500,wordType:'COMMON',note:'keep me',enabled:false} → parseEntryInput 결과 {priority:10,wordType:null,note:null,enabled:true}, errors:[] (행 길이 검사는 머리글보다 긴 행만 E_ROW_FORMAT 으로 잡음, lexiconCsv.ts:128)",
      "recommendation": "행이 머리글보다 짧을 때 누락된 칸은 raw 객체에 키 자체를 넣지 않아 present() 가 false 를 반환하게 하거나(헤더에 없는 열과 동일 취급), 열 수 불일치를 길든 짧든 E_ROW_FORMAT 오류로 잡는다."
    },
    {
      "issue": "mapPreviewError 의 PREVIEW_PROBLEM.TEXT_TOO_LONG(400) 분기가 도달 불가능한 죽은 코드",
      "severity": "LOW",
      "component": "src/modules/admin/speech/lexicon.ts:525-546",
      "risk": "실제 동작에는 영향 없음(항상 422 E_PREVIEW_TEXT_TOO_LONG 로 귀결) — 유지보수 시 혼동 가능",
      "evidence": "lexiconPreview.ts:92-97 run() 이 prepareSentence 의 TtsRequestError('TEXT_TOO_LONG')을 이미 PreviewTextTooLongError 로 변환해 상위로 던지므로 mapPreviewError 는 PreviewTextTooLongError 분기(첫 줄)에서 항상 먼저 잡힘",
      "recommendation": "PREVIEW_PROBLEM 에서 TEXT_TOO_LONG 항목 제거 또는 '도달 불가·방어용' 주석 추가"
    },
    {
      "issue": "findAuditsByTargets(targetId IN + action prefix) 접근 패턴에 맞는 인덱스 없음",
      "severity": "LOW",
      "component": "src/modules/infra/audit.ts:56-67, prisma/schema.prisma:558-561",
      "risk": "현재 개인 규모 앱에서는 문제 없으나 AuditLog(전 관리 기능 공유 테이블)가 커지면 GET /lexicon/versions* 페이지 로드마다 비효율적 스캔 가능",
      "evidence": "기존 인덱스 [environment,createdAt]·[actorUserId,createdAt]·[scope,targetId,createdAt]·[action,createdAt] 중 targetId 를 선두로 갖는 것이 없음",
      "recommendation": "필요 시 @@index([environment, targetId]) 후속 추가(지금은 블로킹 아님)"
    }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 2 },
  "high_risk_areas": [
    "Import MERGE — 열 수가 적은(짧은) CSV 행으로 기존 비활성 항목을 재활성화·설정 초기화할 수 있는지 재현(MEDIUM-1), dryRun 화면에서 이 변경이 실제로 눈에 띄게 표시되는지(B 화면 몫)",
    "동시 쓰기 2건(같은 baseVersion) 라이브 재현 — 200/409 분리·ACTIVE 1행 유지(A 자체 라이브 3l 보고, Reviewer 는 코드·단위테스트로만 확인, 라이브 재현 권장",
    "PRODUCTION confirm 우회 경로(대소문자·공백 변형 등) 화면에서도 동일하게 막히는지(B 화면 통합 후)",
    "미리듣기 분당 10회 제한이 blue/green 2 프로세스 운영에서 실질적으로 몇 회까지 허용되는지(기존 rateLimit 인프라 특성, 참고 항목)"
  ],
  "native_change": false
}
```

**결론**: Critical 0·High 0·Medium 1·Low 2 → **PASS**. MEDIUM-1(CSV 짧은 행 재설정)은 표준 Export→Import 왕복에는 영향 없고 Rollback 으로 되돌릴 수 있어 QA·배포를 막을 사유는 아니나, Developer 가 후속 커밋으로 고치는 것을 권고(수정 시 Reviewer 재순환 원칙에 따라 그 부분만 재검증하면 됨 — 새 Critical/High 가 아니므로 전체 재순환 불필요 판단은 Leader 몫). B(화면)는 이번 REV 대상이 아니며 완료 시 별도 REV-01x 로 진행한다.

### REV-018 (2026-09-28, 화면 760c50e)

**대상**: `760c50e`(B 화면·콘솔 공용 파일 4종 수정, 41파일). 서버(A, `5f8d9c1`+`a408f00`)는 REV-017 대상 — 이번 REV 는 화면만. 비교 기준: `docs/screens.md` §10(설계 가이드 전문 — §10-0~10-11)·§6(콘솔 공통) · task 이력서 G4·설계 확정 19건·"### A(서버)" B 계약 요약·"### B(화면)" 기록·REV-017.

**독립 재실행**: `~/.node-local/thekaiwa-revcheck-003g-b`(REV-017 과 동일 방식 — `git archive 760c50e` + `~/.node-local/thekaiwa/node_modules` 하드링크, 검증 후 삭제 완료).
- `tsc --noEmit -p tsconfig.json` → 0 오류.
- `eslint --max-warnings=0`(`src/components/admin/lexicon`·`src/components/common/api.ts`·`src/modules/admin/console/menu.ts`·`src/components/admin/console/{labels,RoleScreen}.tsx`·lexicon 라우트 2개) → 0건.
- 전체 프로젝트 단위 테스트(`find src -name '*.test.ts'`, 57개 파일) 재실행 → **422/422 PASS**(B 보고와 정확히 일치). lexicon 3종 테스트 파일만 따로도 재확인: `kana.test.ts` 8·`lexiconCopy.test.ts` 13·`access.test.ts` 6 = 27건 전부 PASS(B 는 "29"로 기록했으나 실측 27 — 사소한 계수 오차, 전체 합계 422 는 B 보고와 정확히 일치해 영향 없음, 지적 대상 아님).

#### 1. 6층·eslint 경계 (PASS)
- `eslint.config.mjs:75` 의 컴포넌트 경계 규칙(`boundary('src/components/**', ['engine','admin','conversation','learning','preferences'], ['speech','infra'], …, ['native','dates','stt/client','tts/client'], true, ['speech'])`)을 직접 해석·검증: `@/modules/speech/**` 하위 경로는 `native`·`dates`·`stt/client`·`tts/client` 4개만 예외이고 `tts/lexicon*`·`text`(정규화 규칙)는 이 예외에 없어 **정규식 자체가 컴포넌트의 서버 사전 규칙 import 를 error 로 막는다** — B 가 `kana.ts` 를 서버 함수 재호출 대신 "골든 표 고정" 방식으로 우회한 것이 임기응변이 아니라 **툴링이 강제하는 유일한 합법 경로**임을 확인.
- `kana.test.ts` 골든 표 정확성 실측 대조: 서버 `src/modules/speech/tts/text.ts`(`KATAKANA_READING`·`SMALL_KANA`·`moraCount`)와 `lexiconRules.ts`(`normalizeSurface`·`JAPANESE_CHAR`·`BAD_SURFACE_CHAR`·`SCOPE_REF_RE`·`cleanNote`·검증 순서"길이→숨은 문자→일본어")를 직접 읽어 `kana.ts` 의 같은 이름 함수·정규식과 **문자 단위로 동일**함을 확인(표기·읽기·악센트·우선순위 0~1000 상수 일치, `LEXICON_LIMITS` 값도 `src/types/lexicon.ts` 원본과 대조). 드리프트 위험은 "서버가 바뀌면 골든을 다시 떠야 한다"는 문서화된 구조적 한계일 뿐, 지금 시점 불일치는 0건 — 경계 테스트를 통과하면서 관리 가능한 수준으로 대응함.
- admin 이 `(app)` 컴포넌트를 쓰는 예외는 `@/components/speech/ttsAudio`(`unlockTtsAudio`·`playWav`) 한 곳(`useLexiconPreview.ts:12`)뿐 — §10-11 ⑪ 그대로, 문구 없는 재생 유틸 한정 확인.
- `src/types/admin.ts` diff 없음(0줄 변경) — A 의 "`types/admin.ts` 에 Lexicon DTO 재정의 금지" 계약을 B 가 그대로 지킴(설계 가이드 §10-4 는 애초에 `types/admin.ts` 안에 DTO 를 적었으나, A 가 이미 `@/types/lexicon` 을 만들어 두어 B 가 계약대로 그쪽을 단일 출처로 따름 — 가이드보다 최신 A 계약을 올바르게 우선함).
- 발견 없음.

#### 2. 권한 렌더 (PASS)
- `useLexiconAccess`(`lexiconAccess()`)가 screens.md §10-1 표·`useLexiconForm` 등과 정확히 같은 4갈래 계산식을 그대로 구현, `access.test.ts`(가짜 capability)로 6개 조합 모두 확인.
- **DOM 부재 확인**: `LexiconScreen.tsx:89` `openEntry` 가 `access.canWrite ? 'edit' : 'view'` 로 시트 모드 자체를 가르기 때문에, 쓰기 버튼(저장·끄기·다시 켜기)이 렌더되는 `'add'|'edit'|'confirmDisable'|'confirmEnable'` 모드는 `canWrite=false` 인 경로로는 애초에 도달 불가(가짜 캡을 렌더링 조건으로 흉내내는 게 아니라 상태 전이 자체가 막힘) — `LexiconActions`(추가·가져오기 버튼)·`LexiconEntrySheet`(저장·끄기 버튼)·`VersionDetailSheet`(되돌리기 버튼, `rollbackSlot()` 이 `canWrite` 요구) 세 곳 모두 코드로 직접 추적해 확인, `access.test.ts:37-48`(`renderToStaticMarkup` 로 "항목 추가"·"가져오기" 문자열 부재)·`access.test.ts:116-123`(`rollbackSlot`)이 이를 재확인.
- SUPER_ADMIN + PRODUCTION: `needsConfirm=true` 일 때만 `WriteConfirmFields.tsx:80-105` 의 확인 문구 입력이 렌더(그 밖엔 DOM 에 없음), `kana.ts:202`(`validateWriteMeta`) 가 대소문자까지 정확히 `PRODUCTION`(앞뒤 공백만 trim)과 일치해야 통과 — `access.test.ts:50-60`·`kana.test.ts:150-156` 로 이중 확인.
- USER 404: 두 `page.tsx` 모두 `requireConsolePage('voices.read', …)` → `!g.allowed` 시 `ConsoleForbidden`(기존 005b 인프라, 이번 diff 로 미변경) — 서버 재검사가 항상 최종 결정이고, 클라 `useLexiconAccess` 는 "숨김용"이라는 주석·구조 그대로.
- 발견 없음.

#### 3. 계약 정합 (PASS)
- DTO 단일 출처(`@/types/lexicon`) 준수(위 1번). `apiDelete(path, body)`(URL 에 이유 없음)·`preview({...,compare:true})`+`Accept: audio/wav`+`side`(`lexiconApi.ts:132-136`) 확인.
- 409 `VERSION_CONFLICT`: `useLexiconForm.ts` 의 catch 블록이 `draft`·`reason`·`confirm` 상태를 전혀 건드리지 않고 `notice`·`onConflictVersion` 만 갱신 — 입력 유지 확인(코드 추적, `writeErrorNotice` 문구도 "입력한 내용은 그대로예요" 일치).
- `E_LEXICON_DUPLICATE` → `[그 항목 열기]`: `LexiconEntrySheet.tsx:130-133`(`onOpenExisting`) → `existing` 있으면 그 항목으로 `mode: access.canWrite?'edit':'view'` 전환, 없으면 검색 필터로 대체 — §10-11 ⑥ 그대로.
- `E_IMMUTABLE`: `useLexiconForm.ts:189-197`(`HIDDEN_IN_EDIT` 로 표기·범위·대상 칸 오류를 지우고 남는 게 없으면 알림 `IMMUTABLE_TEXT`) 확인.
- `revived`·`NO_CHANGE`·`ALREADY_ACTIVE`·`E_IMPORT_HAS_ERRORS` 모두 `lexiconCopy.ts`(`savedToast`·`writeErrorNotice`)에서 서버 `details.reason`/`data.code` 갈래로 정확히 분기, **서버 `message` 는 코드 전체에서 한 번도 읽지 않음**(단위 테스트 "서버 message 는 어떤 문구에도 섞이지 않는다" PASS 로 재확인, `err.message` grep 0건).
- 가타카나 변환(`toKatakana`)·읽기 ≤60·우선순위 0~1000 이 서버와 문자 단위로 일치(위 1번), `EntryForm.tsx` 의 우선순위 칸이 `type="text" inputMode="numeric"`(B 가 `type="number"` 를 피한 이유 — 지수 표기 등으로 빈 값이 되어 기본값으로 몰래 저장되는 것을 막음)로 구현돼 있어 정직한 선택.
- 발견 없음.

#### 4. Import/Export UI (MEDIUM 1건)
- 256KB·확장자 사전 거부: `useLexiconImport.ts:20-24`(`fileProblem`)가 `dryRun()` 진입 전에 검사, 실패 시 요청 0(코드 확인) — §10-9 체크리스트 항목과 일치.
- dryRun 오류 0 일 때만 적용 버튼: `canApply()`(`r.counts.error===0 && add+update+disable>0`)와 `LexiconImportSheet.tsx:103-107` 의 렌더 분기 일치.
- REPLACE_SCOPE 끄기 수 3곳: ① `MODE_OPTIONS` 방식 설명의 `warn` 문구(`LexiconImportSheet.tsx:24`) ② `ImportReview.tsx:74-78` "바뀌는 범위: …(끄기 N)" ③ 적용 버튼 라벨의 `({disable}개 끄기 포함)`(`LexiconImportSheet.tsx:123`) — 3곳 모두 코드로 확인.
- 다운로드 안전: `common/api.ts` 신규 `apiGetFile`(401→로그인 이동, 실패→봉투 오류, 성공→blob+`Content-Disposition` 파싱) + `lexiconApi.ts:downloadExport`(객체 URL 을 클릭 직후 `setTimeout(…,0)` 으로 revoke, 같은 틱 revoke 로 인한 빈 파일 문제를 주석으로 명시 회피) — 안전.
- **MEDIUM-1(신규) — `LexiconDiffList` 의 `ENABLED`/`DISABLED` 종류 표시가 같은 변경에 동반된 다른 칸 값 변화(우선순위·종류·메모·악센트)를 완전히 숨긴다.**
  - 위치: `src/components/admin/lexicon/LexiconDiffList.tsx:42-63`(`detail()` 함수) — `kind==='ENABLED'` 는 `{after.reading} · 다시 써요` 만, `kind==='DISABLED'` 는 `{before.reading} · 이제 쓰지 않아요` 만 렌더한다. 반면 `kind==='CHANGED'` 행은 `changedParts()`(38번 줄까지, `reading`·`accentType`·`priority`·`wordType`·`note`·`enabled` 전부 비교)로 바뀐 칸을 전부 보여준다.
  - 근거: 서버 `diffKind()`(`src/modules/speech/tts/lexiconRules.ts:512-516`)를 직접 대조 — `before.enabled` 와 `after.enabled` 가 다르면(꺼짐→켜짐 또는 켜짐→꺼짐) **다른 칸이 몇 개 바뀌었든 무조건 `ENABLED`/`DISABLED` 로 분류되고 `CHANGED` 가 되지 않는다**(`diffKind` 는 enabled 전이를 최우선으로 본다). 이 분류 자체는 서버 코드라 REV-017 대상이지만, **화면 쪽에서 `ENABLED`/`DISABLED` 행에 대해 다른 필드 변화를 아예 렌더하지 않는 결정은 B 의 몫**이고, `LexiconDiffRowDto` 의 `before`/`after` 에는 두 상태의 전체 스냅샷(우선순위·종류·메모·악센트 포함)이 이미 들어 있어 렌더할 재료는 있다.
  - 재현: 스크래치에서 `LexiconDiffList`·`detail()` 을 직접 호출해 재확인 — `before={priority:500,wordType:'COMMON',note:'keep me',enabled:false,...}`, `after={priority:10,wordType:null,note:null,enabled:true,...}` (REV-017 MEDIUM-1 이 재현한 CSV 짧은 행 결과와 동일 모양)를 `kind:'ENABLED'` 행으로 넣으면 화면 출력은 정확히 `"{reading} · 다시 써요"` 뿐 — 우선순위 500→10·종류 COMMON→없음·메모 삭제는 화면 어디에도 나타나지 않는다.
  - 영향 범위: 이 컴포넌트는 세 곳에서 재사용된다 — 가져오기 dryRun 검토(`ImportReview.tsx:89`), 버전 상세 "직전 버전과 비교"(`VersionDetailSheet.tsx:152`), 되돌리기 확인 "지금과 비교"(`VersionDetailSheet.tsx:174`). 세 곳 모두 같은 맹점을 공유한다.
  - 위험: REV-017 이 MEDIUM-1(서버 CSV 짧은 행 문제)을 QA·배포를 막지 않는 이유로 든 완화 요인이 "**dryRun 의 changes 배열이 이 변경을 before/after 로 보여주므로 신중히 검토하면 적용 전에 발견 가능**"이었고, REV-017 은 이 점을 `high_risk_areas` 에 "dryRun 화면에서 이 변경이 실제로 눈에 띄게 표시되는지(B 화면 몫)" 로 명시해 확인을 요청했다. 이번 실측 결과 **그 완화 요인이 성립하지 않는다** — 관리자가 dryRun 화면만 보고는 우선순위·종류·메모가 조용히 초기화된다는 사실을 알 수 없다. 서버 CSV 버그 없이도(예: 정상적인 "다시 켜기 + 다른 칸 동시 수정" PUT 요청) 같은 맹점이 발생할 수 있어 순수 서버 버그의 파생물만은 아니다.
  - 완화 요인: 되돌리기(Rollback)로 항상 원복 가능해 영구 손실은 아니고, API 응답 자체(`before`/`after` 전체 객체)에는 정보가 남아 있어 API 로 직접 확인하면 알 수 있다(화면 전용 맹점). 이 때문에 REV-017 MEDIUM-1 과 같은 급으로 MEDIUM 유지(HIGH 로 올리지 않음).
  - 권고: `LexiconDiffList.tsx` 의 `detail()` 에서 `ENABLED`/`DISABLED` 케이스도 `changedParts()` 로 계산한 그 외 칸 차이를 이어 붙인다(예: `{reading} · 다시 써요 · 우선 500 → 10 · 종류 COMMON → 없음 · 메모 바뀜`). CountChip 요약(추가/수정/끄기/그대로/오류)과 무관하게 상세 행 텍스트만 고치면 되는 국소 수정.
- 발견 그 외 없음.

#### 5. 버전 화면 (PASS)
- `?v=` 상세: `VersionDetailSheet` 가 `versionDetailPath(version,'previous')` 로 열 때 한 번 비교, 되돌리기 확인은 `versionDetailPath(version,'active')` 로 별도 호출 — §10-11 ② L8a 계약과 일치.
- 되돌리기 확인 diff: `mode==='confirmRollback'` 에서만 `against` 리소스를 가져와 `DiffCounts`+`LexiconDiffList` 로 렌더, `isAllZero()` 면 확정 버튼 대신 "되돌릴 것이 없어요"+돌아가기 — 코드 확인.
- ACTIVE 에 되돌리기 없음: `rollbackSlot()` 이 `d.status==='ACTIVE' || d.version===active` 면 `'current'`(안내 문구만, 버튼 없음) 반환 — `access.test.ts:116-120` 로 4가지 경우 모두 확인.
- 하이드레이션 수정 방식 타당성 평가: `useHydrated()`(`useSyncExternalStore(noopSubscribe, ()=>true, ()=>false)`)는 "서버 스냅샷=false, 클라 스냅샷=true" 조합으로 하이드레이션 직후 리렌더를 강제하는 React 공식 패턴(SSR 환경에서 `isClient` 를 안전하게 얻는 표준 관용구)이다. `useEffect`+`useState` 로도 같은 효과를 얻을 수 있지만 `useSyncExternalStore` 쪽이 React 가 "이 값은 서버·클라가 다를 수 있다"고 인지하는 공식 경로라 하이드레이션 경고를 구조적으로 막는다는 점에서 **더 정확한 해법** — 임기응변이 아니라 정답에 가까운 선택으로 판단.
- 발견 없음.

#### 6. 접근성·3폭·터치·엔진명·XSS (PASS)
- `dangerouslySetInnerHTML`·`innerHTML`·`eval(` grep 0건(`src/components/admin/lexicon/**`·`app/(admin)/admin/speech/tts/lexicon/**`) — 표기·읽기·메모·`changeSummary` 등 사용자/관리자 입력이 전부 JSX 텍스트 자식으로만 렌더됨을 직접 확인, XSS 벡터 없음.
- 엔진명 0: 단위 테스트("엔진명 0: src/components/admin/lexicon 의 코드") PASS + 별도 수동 grep(`g2p|style-?bert|sbv2|reazon|whisper|claude|haiku|sonnet|opus|qwen`, 대소문자 무시)으로 코드 전체 0건 재확인(주석 제외 기준과 별개로 문자열 리터럴 자체도 없음).
- 터치 44px: 버튼 클래스 `h-11`(44px)·`h-12`(48px) 일관 사용, `Btn size="sm"` 미사용(grep 0건) 확인.
- 로컬 저장소 미사용: `localStorage|sessionStorage` grep 0건(설계 "소리·초안을 브라우저 저장소에 두지 않는다"·"용도별 컴포넌트는 상태로만" 원칙과 일치).
- `console.log`·`.message` 직접 참조 0건(서버 message 비노출 원칙과 일치, 3번 항목과 중복 확인).
- 발견 없음.

#### 7. 공용 변경 회귀 (PASS)
- `common/api.ts`: `apiDelete<T>(path, body?)` — 기존 시그니처(1인자)는 `body` 가 `undefined` 로 `request()` 에 전달돼 동작 무변화. 실제 기존 호출부 2곳(`ChatMenuSheet.tsx:90`·`WordDetailSheet.tsx:192`, 모두 1인자)을 grep 으로 확인 — 회귀 없음. 신규 `apiGetFile` 은 독립 함수로 추가, 기존 함수 수정 없음.
- `menu.ts`: 신규 행 1개 추가만(기존 행 무변경), 소유자 A 에게 알림 기록(§10-11 ⑫ 그대로) — `git diff` 로 순수 추가 확인.
- `labels.ts`·`RoleScreen.tsx`: 각각 `MENU_SUB` 키 1개, TTS 역할 페이지 조건부 `<Section>` 1개 추가 — 기존 분기·기존 역할 렌더에 영향 없음(추가된 블록은 `role==='TTS' && can('voices.read')` 신규 조건이라 다른 role 렌더 경로를 전혀 타지 않음).
- 전체 회귀 테스트: 프로젝트 전체 422개 단위 테스트 재실행 결과 422/422 PASS(0 실패) — 공용 파일 4종 수정이 기존 화면·모듈 테스트를 깨지 않았음을 직접 확인(위 "독립 재실행" 참고).
- 발견 없음.

#### 8. 테스트 재실행 (PASS)
- 위 "독립 재실행" 절 참고. tsc 0·eslint 0·lexicon 단위 27/27·전체 프로젝트 422/422 모두 B 자체 보고와 일치(테스트 개수 소계 표기 오차 1건은 위에서 별도 명시, 심각도 없음).

#### 종합 판정

```json
{
  "reviewId": "REV-018",
  "status": "PASS",
  "issues": [
    {
      "issue": "LexiconDiffList 의 ENABLED/DISABLED 종류 표시가 같은 변경에 동반된 다른 칸(우선순위·종류·메모·악센트) 값 변화를 숨긴다 — REV-017 MEDIUM-1 이 기댄 'dryRun 화면에서 눈에 띄게 표시되는지' 완화 요인이 성립하지 않음을 확인",
      "severity": "MEDIUM",
      "component": "src/components/admin/lexicon/LexiconDiffList.tsx:42-63(detail 함수, ENABLED/DISABLED 분기)",
      "risk": "가져오기 dryRun 검토·버전 상세 diff·되돌리기 확인 diff 세 화면 모두에서, enabled 전이가 동반된 행은 다른 필드 변화(예: 우선순위 500→10·종류 초기화·메모 삭제)를 관리자가 화면만 보고는 전혀 알 수 없다. Rollback 으로 원복 가능하고 API 응답 자체엔 정보가 남아 영구 손실은 아니라 MEDIUM 유지.",
      "evidence": "서버 diffKind()(src/modules/speech/tts/lexiconRules.ts:512-516)는 enabled 전이를 최우선으로 분류해 다른 필드 변화 여부와 무관하게 kind 를 ENABLED/DISABLED 로 고정한다. detail()(LexiconDiffList.tsx)의 ENABLED/DISABLED 분기는 changedParts() 를 호출하지 않아 그 재료(전체 before/after 스냅샷)가 있음에도 렌더하지 않는다 — 스크래치에서 before={priority:500,wordType:'COMMON',note:'keep me',enabled:false}/after={priority:10,wordType:null,note:null,enabled:true} 를 kind:'ENABLED' 로 넣어 직접 재현, 출력은 '{reading} · 다시 써요' 뿐",
      "recommendation": "detail() 의 ENABLED/DISABLED 분기에도 changedParts(before,after) 결과를 이어 붙여(예: '{reading} · 다시 써요 · 우선 500 → 10 · 종류 COMMON → 없음 · 메모 바뀜') 세 화면(ImportReview·VersionDetailSheet 비교·되돌리기 확인) 모두가 자동으로 혜택을 보게 한다 — LexiconDiffList.tsx 한 파일의 국소 수정"
    }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 0 },
  "high_risk_areas": [
    "MEDIUM(신규): ENABLED/DISABLED diff 행의 숨은 필드 변화 — QA 가 REV-017 MEDIUM-1 시나리오(CSV 짧은 행)를 재현할 때 dryRun 화면에 우선순위·종류·메모 변화가 안 보인다는 점을 실제 화면으로도 재확인 권장(API 응답과 대조)",
    "PRODUCTION 확인 문구·역할별 쓰기 버튼 부재는 전부 단위 테스트(가짜 capability)로만 확인됨(voices.read 단독 역할이 실사용자 계정에 없음, §10-11 ⑬) — QA 도 동일 제약이라 실기기·실역할 재현 불가능은 기존 한계이지 이번 REV 결함 아님"
  ],
  "native_change": false
}
```

**결론**: Critical 0·High 0·Medium 1·Low 0 → **PASS**(REV-017 서버 PASS 와 별개로 화면 자체도 PASS). 신규 MEDIUM(ENABLED/DISABLED diff 표시 누락)은 REV-017 MEDIUM-1(서버 CSV 짧은 행 재설정)과 사실상 같은 근본 위험을 공유하므로, **Developer 가 두 건을 한 번에 고치는 것을 권고**(서버 CSV 파서 수정 + `LexiconDiffList.detail()` 수정) — 수정 후 Reviewer 재순환은 두 파일(`lexiconCsv.ts`/`lexiconRules.ts`·`LexiconDiffList.tsx`)만 국소 재검증하면 되고 전체 재순환은 불필요(Leader 최종 판단). QA 인계: 위 `high_risk_areas` 참고, 특히 REV-017 이 이미 요청한 "dryRun 화면 가시성" 항목은 이번 실측으로 **"안 보임"이 확정**됐으니 QA 체크리스트에서 "화면에 표시되는지 확인"이 아니라 "표시되지 않음을 API 응답과 대조해 인지하고 넘어간다"로 갱신해 진행. 그 외 6영역(6층 경계·권한 렌더·계약 정합·Import/Export·버전 화면·접근성/XSS/공용 회귀) 전부 발견 없음.

## QA 기록

## 최종 요약
