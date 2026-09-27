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

### B(화면)

## Reviewer 기록

## QA 기록

## 최종 요약
