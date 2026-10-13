---
tags:
  - type/board
---
# 칸반 보드

> 현재 상태·인수인계는 [[ACTIVE]] 참조. 설계 과정 전체 기록은 [[task-001-initial-planning]].

## Done
- [[task-062-cleanup-cancel-test-noise]] — **후속 정리**(2026-10-12): 취소 판정 통합·시험 9파일 `readCode` 이전·`withApi` 끊김 로그 소음 제거. REV-199 PASS_WITH_NOTES·QA PASS, 운영 `20261012-130400-3c0427b8`, **사용자 검증 완료**.
- [[task-061-improve-helper-button-right-end]] — **도우미 버튼 우측 끝(IMP-0034, light)**(2026-10-12): 도우미↔■ 자리 맞바꿈·말풍선 `right-4`(글자 모드는 그대로). REV-198 PASS_WITH_NOTES, 운영 `20261012-130400-3c0427b8`, **사용자 검증 완료**.
- [[task-058-cancel-signal-169-178]] — **#169·#178 요청 취소 신호 전달**(2026-10-11~12): task-056 M1 동일 결함을 대답 연습·첫마디 제안에 적용. REV-197 PASS_WITH_NOTES, 운영 `20261012-003701-6f8301c0`, **사용자 검증 완료**.
- [[task-056-improve-talk-phrase-helper]] — **회화방 일본어 도우미(IMP-0030, P2)**(2026-10-11~12): 한국어로 물어보면 일본어 표현 1~3개 제안(API #180, 저장 없음), 자동 취소·생각 중 잠금. REV-190~195·QA A/B/B2/C/C2 PASS_WITH_NOTES, 운영 `20261012-003701-6f8301c0`, **사용자 검증 완료 2026-10-12**.
- [[task-029-settings-scroll]] — **설정 화면 스크롤(IMP-0023)**(2026-10-04): 셸 `<main>` relative 한 줄. REV-085·QA 36/36, 운영 반영 `0bd8275`. 폰 확인 대기
- [[task-010b3-a11-timeout-retry]] — **A11 타임아웃 1회 재시도·공통 타임아웃 로그**(2026-10-03, 사용자 결정): 재시도는 큐 꼬리 재진입(대화 우선 유지). REV-083→084 PASS·QA 7/7·52/52·42/42, 운영 반영 `65f7d0a`·운영 스모크 52/52·42/42
- [[task-010b2-review-decision-v2]] — **A11 reviewDecision@v2**(2026-10-03): 응답 골격·이 밖의 키 금지 + 관측 신뢰도 가중(0.6). REV-082·QA 52/52, 운영 반영 `717ad99`·운영 스모크 52/52·배포 뒤 계약 위반 0. 남은 것: CLI 무응답 타임아웃(사용자 결정 대기)
- [[task-010b-repetition]] — **반복 학습 완료**(2026-10-03): 서버 1단계(`cb176cc`) + 2단계 화면(오늘 홈 복습 카드·복습 레슨)·QUEUED 판단 재킥·A5 reviewMix@v3(운영 잠재 결함 수정). REV-079~081·QA 화면 451·스모크 52/52, 운영 반영 `d775aac`·운영 스모크 52/52. 후속 [[task-010b2-review-decision-v2]]
- [[task-019-cleanup-lint-env-strip]] — **정리 backlog 3건**(2026-09-29): ESLint 상대경로 교차 모듈 import 금지 · CLI 자식 env 프록시 키 제거 · A4 스키마 밖 필드 제거 요청 옵션화. REV-037 PASS, 운영 반영 `8313dc9`(006·010 PASS)
- [[task-012b-speech-p2]] — **음성 P2 1단계: 분석 STT 파이프라인**(2026-09-29). SpeechJob 적재 게이트·사용자별 디바운스(+20s·상한 5분)·claim SKIP LOCKED+재검사·self-reclaim(인스턴스 id)·#138~#140·#22·#21a·health `stt_analysis_worker`·D-B7 평가 텍스트·Python 워커(whisper_http·pyopenjtalk 비교기). REV-033·Codex C2 2건 수정·QA(운영 모드) PASS, 운영 반영 `8af4542`(007 44/44·011 60/60). **U1·U2 사용자 승인 2026-10-01 → 전부 완료** — pyopenjtalk 운영 venv ✅ · #140 claim 세대 펜싱(attempts=세대)·REV-041·QA PASS · 커밋 `97b31cf` 웹훅 배포(릴리스 `20261001-131341-97b31cf`, `--apps` 에 워커 추가) → pm2 워커 online·restart 0·health `stt_analysis_worker` ok·운영 스모크 007 45/45 (2026-10-01 13:25 Leader 직접 실측)
- [[task-010-today-lesson]] — **Phase 2 오늘의 회화(레슨)**(2026-09-28). 주제/붙여넣기 → A4 5단계(듣기·메모 제안·퀴즈 첫 답 고정·응용·말하기 3과제+발화 연결) → 완료 한 트랜잭션(StudyLog·스냅샷·RepetitionItem 3일)·nextPreview, 오늘 홈 카드. REV-028~031·Codex C2 2건 수정(2차 0)·QA 65/65·UI E2E 61/61, 운영 반영 `67771a5`·운영 스모크 65/65. 붙여넣기 A4 신뢰도 관찰 중
- [[task-018-db-structure-hardening]] — **DB 구조 보강 3건**(2026-09-28, 사용자 승인): Utterance.chatId·chatMessageId unique / ConfigScope LEXICON / LexiconVersion.rollbackOf — 백업→db push→REV-026→webhook 배포 ok·운영 44/44
- [[task-009-release-cutover]] — **운영 blue/green 컷오버·APP_ENV=PRODUCTION**(2026-09-28). `/home/brownjeon/apps/thekaiwa` 릴리스 운영(앱+gateway), 첫 배포 ok·롤백 리허설 통과, 운영 E2E 단어 74·채팅 41·회화 37·음성 3/3, health 필수 503 게이트
- [[task-003h-app-branding]] — **앱 이름 Lingofy Japanese·부제 「일본어가 자연스러워지는 AI 회화」**(2026-09-28). 웹·앱 1.0.1(versionCode 2) 운영 반영, REV-024 PASS
- [[task-003g-lexicon-admin]] — **발음 사전 관리**(2026-09-28). 콘솔 API 9라우트+화면(검색·추가·수정·끄기·미리듣기 비교·Import dryRun/Export·버전 diff·Rollback), 버전+감사 한 트랜잭션·환경 잠금·스냅샷 무결성. REV-017~020·Codex C2 1 반영·QA-017 PASS·화면 E2E 55/55, 운영 반영
- [[task-007-talk-voice-web]] — **AI 회화(음성) 웹 경로**(2026-09-28). 푸시투토크→턴→문장별 청크 TTS(SSE audio)·재생 큐·barge-in·교정 카드 즉시, 예열 CLI·첫 문장 조기 합성으로 손 뗌→첫 음성 바이트 p50 ≈1.8~2.1s, #24 서명 URL·발화 1회 연결. Codex C1 3·C2 2 반영, REV-014~016·QA-016 PASS, 화면 E2E 40/40, 운영 반영·운영 스모크 37/37
- [[task-003e-stt-gateway-web]] — **STT gateway + 웹 음성 인식 + 마이크 테스트**(2026-09-28). pm2 `thekaiwa-speech-gateway`(127.0.0.1:8100, nginx wss), 60초 1회 티켓·Origin 허용 목록·발화 저장/콜백, 합성 20문장 CER 0.57%·final p50 63ms. REV-013→Codex C2 2건→QA-015 PASS, 운영 E2E 215ms
- [[task-003d-tts-p0]] — **TTS P0**(2026-09-27). M4 자체 FastAPI(`:8200` 상시·pf·워치독) + 앱 TTS 플랫폼(정규화·사전·Rendering Plan·Profile·12요소 캐시·상태 판정)·미리듣기·상태 표시등. Codex C1·C2(보안) 각 3건 반영, QA-014 재확인 PASS, 합성 p50 716ms·HIT 24ms. 운영 반영 완료
- [[task-005b-admin-console-skeleton]] — **Admin Console 골격**(2026-09-27). 권한 매트릭스·404/403·Effective Config+출처·Plugins/Connections·Health/Functional Test·Trace·비밀 이름만+감사, 콘솔 화면 14. REV-009+Codex C2(보안)→수정→QA-013(터치 44px)→수정→PASS. 발음 사전·#93b 이월. 19:15 운영 반영
- [[task-008-vocab-today-words]] — **단어장 최소판 + 오늘의 단어**(2026-09-27). 라우트 18(#40~#46b·#47~#54)·가중 샘플링·정답 미노출·서버 채점·finish 단일 트랜잭션·A10 초안, 화면(단어장·오늘 홈·스와이프 덱·결과). REV-008(H1 수정)→PASS·QA-012 PASS(2프로세스 실경합·실브라우저 3폭). 운영 반영(18:26)·Codex C2 지적 2건 수정
- [[task-006-chat-correction]] — **AI 채팅 + 표현 점검 + 교정 채택**(2026-09-27). 서버 13라우트·SSE 턴·사용자당 락·점검(동기/잡)·채택 트랜잭션, 화면 3종. REV-007 PASS_WITH_NOTES·QA-011 PASS(결함 0, 2프로세스 경합 실증). 운영 반영(18:26)·Codex C2 지적 0
- [[task-017-dev-env-judge-codex]] — **개발환경 개선 선도입**(2026-09-27): judge(Jev 판정)·codex(외부 검토) 에이전트 적용, 공용 도구·템플릿, 테스트 18건·독립 리뷰 PASS. 실제 호출 검증은 task-006 진행 중
- [[task-005-settings-attendance]] — **설정 허브·출석**(2026-09-27). API 7개·설정 화면 4섹션·AttendancePing, reviewer 2회(High 1 포함 8건 수정)·QA 9항목 PASS. 미리듣기 소리는 task-003 후
- [[task-004-ai-client-persona]] — **AI 클라이언트·페르소나 로더·프롬프트 3종**(2026-09-27). CLI 지연 원인 2개 해소 → 회화 턴 p50 5.1s·검출 16/16·오탐 0/4, reviewer 2회(Critical 1 수정)·QA 9항목 PASS. 4s 목표·qwen 비교는 후속 → [[llm-japanese-quality]]
- [[task-002-phase0-scaffolding]] — **Phase 0 스캐폴딩 완료**(2026-09-26). 인증 이식·6층 골격+ESLint 경계·앱 셸 5탭·seed·pm2 `thekaiwa` 기동, reviewer 2회·QA 11항목 PASS. 폰 로그인 육안 확인·첫 로그인 후 재시드 남음
- [[task-003c-tts-productization-design]] — **TTS 상용 벤치마크 보완 설계**(5차 기획안 §129~§163, 2026-09-26). TTS Productization 층(발음 사전+버전·정규화·Rendering Plan·SpeechProfile 5종·청크 스트리밍·상태 표시등 = P0 / 관측·타이밍·품질·버전/Canary = P1 제안 / 온디바이스 = P2). SBV2 원 서버 실측 → M4 자체 래퍼. 정본 48→50 모델. 코드 없음
- [[task-003b-tutor-persona-v1]] — **강사 역할정의·페르소나 v1 + 학습 설계 보완**(2026-09-26). 기획서 대조 15건 → 사용자 결정(스케줄 주체=강사, 3~7일 판단·균등 랜덤·FOCUS, 청취 구간·단어 메모·종료 지점). `tutor.md` v1·검증 세트·`learning-personalization-and-llm-data.md`·정본 갱신·정합성 17건. Git 원격 연동 ✅. 코드 없음
- [[task-001-initial-planning]] — **초기 기획·설계 확정**(2026-09-26). 기획서 4종 통합 → `design-spec.md` + 정본 5종 + 설계 문서 33종, 팀 7인 + 강사 페르소나, Agent Vault 구성. 코드 없음.

## Doing
- [[task-065-improve-menu-copy]] — 메뉴 문구 변경(IMP-0035·0036, light·R0, 2026-10-12): 하단 탭 「오늘」→「공부」(+그 메뉴를 가리키는 화면 문구), 회화 홈 제목 「AI와 공부하기」→「자유로운 대화」. 구현·감사(REV-065-1 PASS_WITH_NOTES)·게이트 통과 → **운영 배포 완료 2026-10-12 — 릴리스 `20261012-143811-812b52c1`**(`RELEASE_RESULT ok`, 롤백 대상 `20261012-130808-f9d74f3c`). 남은 일: 사용자 폰 확인 → `done`.
- [[task-064-ask-anything-3a]] — 무엇이든 물어보세요(/ask) 3a(Phase 3, standard·R2, 2026-10-12 착수): 일본어 표현·문법 질문 + 내 학습 기록 근거 답변(정형 조회·출처 카드·needsScope·제안 카드). judge standard·demo full. **데모 v2 사용자 승인 2026-10-12 16:43(D1~D13 권고대로, D2=(b), 3a 는 글자 질문만·음성은 2단계)** → **운영 배포 완료 2026-10-12 23:24 — 릴리스 `20261012-232359-59eb4f85`**(push `812b52c..59eb4f8`, 사용자 승인 「그대로 커밋·푸시·배포」, `migrated:false`, 롤백 대상 `20261012-143811-812b52c1`). 감사 3종 PASS_WITH_NOTES · QA Critical~Medium 0 · 푸시 전 게이트 eslint 0·시험 3,794/3,793·build 0(tsc 첫 실행 낡은 `.next/types` 거짓 실패→재실행 0) · 운영 헬스 ok·pm2 3 online·읽기 전용 스모크 7항목 PASS. 사용자 결정 「ASK 전용 슬롯」 적용(ASK 중 타 사용자 채팅 3.5→14~16초 → 3.0→3.1~3.9초). **남은 일 = 사용자 폰 확인**(질문 탭 일반 질문·긴 답 스크롤·근거 카드·제안 카드). 상세 [[task-064-ask-anything-3a]] 「운영 배포」.
- [[task-066-ask-chatbot-voice]] — 질문 탭 챗봇창 화면 + 글자·마이크 질문 + 보내는 범위 확인 모달 제거(task-064 후속, standard·R1, 2026-10-13): 사용자 요청 → 데모 v1(설명부 줄바꿈 결함으로 수정 요청)→v2 → **사용자 승인 「D1은 B안으로 결정했으며 그외에는 권고안대로 작업해줘」(D1=B 열 때마다 빈 대화)** → 서버 S1′·`ask@v2`·화면 U1/U2·감사 수정 → 감사(REV-S1·U2 PASS_WITH_NOTES, REV-U1 중간종료·F1 High 수정) → QA A5·B5a~d 결함 Critical~Medium 0(F1 실제 Next 라우터 통과·음성 미저장 라이브 증거) → 합본 스냅샷 게이트 tsc 0·eslint 0·시험 3,866/3,865·build 0. **운영 배포 완료 2026-10-13 11:49 — 릴리스 `20261013-114952-fe50f143`**(push `59eb4f8..fe50f14`, 사용자 승인 「그대로 커밋·푸시·배포」, `migrated:false`, 롤백 대상 `20261012-232359-59eb4f85`): 푸시 전 게이트 tsc 0·eslint 0·시험 3,878/3,877·build 0 → 운영 헬스 ok·pm2 3 online·번들 대조(옛 동의 관문 키 0)·읽기 전용 스모크 7항목 PASS. **남은 일 = 사용자 폰 확인**(챗봇창·확인 창 없이 바로 질문·탭 재누름=빈 대화·🎤 일본어 질문·밖으로 떼서 취소·앱 안 온디바이스 인식). 마이크는 일본어 전용·회화 STT 재사용(사용자 정정으로 서버 받아쓰기 경로는 폐기). 상세 [[task-066-ask-chatbot-voice]] 「운영 배포」.
- [[task-067-ask-history-title-paging]] — 질문 탭 후속(task-066 배포 후 사용자 피드백, standard·R1, 2026-10-13): 지난 질문도 같은 챗봇 탭 화면으로 열기(‹ 뒤로 머리 화면 제거)·질문 제목 지정(머리 제목 줄·시트 행 ⋯)·지난 질문 5개씩 페이징(`total` additive)·시트 행 삭제·history 늘리지 않음. 데모 v1 **승인**(10-13 16:19, D1~D6 ★ 전부) → 구현·감사 3회·QA 3갈래 완료(합본 게이트 통과, 결함 Critical~Medium 0) → **운영 배포 완료**(릴리스 `20261013-211110-20813a8d`, 롤백 대상 `…114952-fe50f143`), 남은 일 = 사용자 폰 확인. 설계 [[task-067-designer-record]]
- [[task-060-improve-deck-controls]] — 오늘의 단어 덱 조작 정리(IMP-0031·0032·0033, light 트랙, 2026-10-12 착수): 위로 슬라이드=뜻 보기·하단 [뜻 보기]/[객관식] 버튼 제거 / [읽기]에서 [한글] 분리해 [건너뛰기] 자리에 배치 / 오른쪽 슬라이드=건너뛸지 확인 안내 후 건너뛰기. 사용자가 task-059 배포 뒤 써 보고 낸 요청(D0 스와이프 그대로 결정을 바꿈). **구현·감사(REV-060-1 PASS_WITH_NOTES)·QA(A1·A2·B1·B2 PASS, 결함 0) 완료 → 운영 배포 완료 2026-10-12 — 릴리스 `20261012-130808-f9d74f3c`(`RELEASE_RESULT ok`, 롤백 대상 `20261012-130400-3c0427b8`). 남은 일: 사용자 실기기 확인 → `done`.**
- [[task-063-nas-db-write-settings]] — ⛔ **막힘**(2026-10-12, 사용자 승인): 공유 NAS MariaDB 쓰기 COMMIT 지연(p50 418ms) 설정 조정안(버퍼풀 16→256MiB·`flush_log_at_trx_commit` 1→2·`sync_binlog` 1→0) — 앱 DB 계정이 `thekaiwa.*` 권한뿐이라 적용 불가, 사용자가 NAS 에서 SQL 실행 필요(이력서에 SQL·되돌리기·전후 프로브).
- [[task-059-improve-today-words-card-first]] — 오늘의 단어 카드 우선(IMP-0011, P2, 2026-10-11 착수): 푸는 방식 선택 제거·카드 기본·탭하면 객관식·뜻 보기 면 단어/예문 듣기. 데모 v1 사용자 승인(22:37), REV-186/187 PASS, QA α/β1/β2/γ PASS. **운영 배포 완료 2026-10-12 — 릴리스 `20261012-091540-55861770`**(`RELEASE_RESULT ok`, 스키마·APK 변경 없음, 롤백 대상 `20261012-003701-6f8301c0`). 남은 일: 사용자 실기기 확인 → `done`.
- [[task-026-improve-hangul-reading]] — 히라가나·한글·번역 표시 ✅ **완료·운영 반영**(서버 `f67bf70` + 화면 A·B `726daf7`, QA PASS, 운영 스모크 42/42·45/45) — 후속 Low 6건·범위 밖 화면은 최종 요약 참고
- [[task-030-japanese-display-followup]] — 일본어 표시 후속 Low 6건 ✅ **완료·운영 반영** `4ce98e4`(데모 v1 승인, REV-098~101, Codex C2, QA PASS, 운영 스모크 42/42·45/45)
- task-012b-2·-3·-4 — 음성 P2 후속(재확인 카드·발화 로그 화면=데모 / TTS 지표=DB 추가 / 타이밍=M4 설치) — 승인 뒤 착수
- [[task-010c-correction-mode]] — 교정 방식(유창성 기본·코치 힌트): 데모 v1(delta) **승인 2026-10-01** · PE talk@v3→v5 · **DB 추가 승인·적용 2026-10-01** · 구현 완료 → ✅ 운영 반영(2026-10-03, 같은 릴리스) — REV-055 PASS·REV-058 PASS·Judge C2 Codex 불필요(0/4) · 2차 QA FAIL(#1 reject 409 UI) → 수정·REV-063 PASS_WITH_NOTES · COACH hintKo 서버 필터(`coachHintOf`) · **제한 QA PASS_WITH_NOTES(2026-10-03 07:46, Medium 2 = 수용 한계 확정·결함 #1 종결) → ✅ 운영 반영(2026-10-03)**
- [[task-011-ai-evaluation]] — AI 평가(A6·A7·기록률 100%): **서버·프롬프트 운영 반영(67771a5, 운영 61/61)** · 화면 데모 v1(full) **승인 2026-10-01** · DB `EvaluationItem.textRevealedAt` 적용 · 화면 구현 완료 → ✅ 운영 반영(2026-10-03 `cb176cc`) — REV-046 PASS · Codex C2 1건 채택(REV-051 수정) → REV-057 PASS → **QA PASS** → ✅ 운영 반영(012 와 한 커밋)
- [[task-012-calendar]] — 달력(계획표 탭·기록 삭제 스냅샷 불변): **서버 운영 반영(67771a5, 운영 32/32)** · 화면 데모 v1(full) **승인 2026-10-01** → 화면 구현 완료 → ✅ 운영 반영(2026-10-03 `cb176cc`) · REV-048 CONDITIONAL_PASS(Medium: 평가 원본 링크는 011 과 같은 릴리스) → **QA PASS** → ✅ 011 과 함께 운영 반영
- [[task-012c-console-p2]] — Console P2: **서버 1·2단계 운영 반영**(`6abe464`·`8c22f01`) · 화면 **데모 v2 승인 2026-10-01** → 화면 구현 완료 → ✅ 운영 반영(2026-10-03 `cb176cc`) — REV-047 CONDITIONAL_PASS(M-1) → REV-054 PASS → Codex C2 High → REV-056 → REV-059 PASS_WITH_NOTES → Codex 재검토 Medium → 수정 → REV-062 PASS_WITH_NOTES → Judge Codex 없음(예산 4/4) → QA CONDITIONAL(Medium: FlowBar 가 모바일 키보드 입력칸을 가림) → FlowBar 수정 → REV-065 PASS_WITH_NOTES → **키보드 재측정 QA PASS(144/144, 2026-10-03 08:00) → 결함 #1 종결 → ✅ 운영 반영**(021 과 같은 웹 배치) · 012c-2(Prompt Registry·Playground·Voice)·012c-3(TTS 품질) 후속
- [[task-010d-scenario-roleplay]] — 상황 역할극(Scenario 10개·코치·종료 판정): 데모 v1(full) **승인 2026-10-01** · **DB 추가 승인·적용 2026-10-01** — 구현은 010b·010c 뒤
- [[task-003f-android-ondevice-stt]] — 안드로이드 앱(현 1.0.1 Lingofy Japanese)·온디바이스 STT — 팀 작업·운영 반영 완료, **사용자 폰 F6 실측 대기**(nginx 재적용 ✅ 2026-09-28)
- **개선작업 착수(2026-09-30, 사용자 답변 Q1~Q10 반영)** — 권고 순서(잠정, 사용자 변경 가능): 020 → 021 → 022 → 023 → 024 → 025 → 026
  - [[task-020-improve-tab-label]] — ✅ **완료·운영 반영**(`54199c9`, 리뷰·QA PASS, 운영 빌드 확인 — 실기기 3폭은 사용자) 탭 라벨 '서랍장'→'단어장'(IMP-0006)
  - [[task-021-improve-keyboard-inset]] — 키보드 입력창 가림 공통 수정(IMP-0008, R1·**데모 delta v1 승인 2026-10-01**) — 웹 구현 완료·Reviewer REV-049 PASS(Medium 0) · **QA 웹 E2E 95/95**(Leader 재확인) · **Judge C2 2026-10-03 07:50 — Codex 불필요(CX-limit-unknown-hold)** → ✅ **웹 운영 반영(2026-10-03, 012c FlowBar 와 같은 배치)** · APK 1.0.2(versionCode 3) 빌드·실기기 확인 대기(deployer → 사용자 재설치)
  - [[task-022-improve-voice-range]] — 음성 설정 범위 약 2배(IMP-0005, R1·**데모 delta**) — **서버 완료·운영 반영**(`0e1140c`, QA PASS, 릴리스 `da263a6`과 함께) · **화면(슬라이더 범위)은 데모 v2 승인 2026-10-01 → ✅ 구현·운영 반영(`d068ab0`, 릴리스 `20261001-131341-97b31cf`)** · 사용자 목소리 극단값 청취·D4(피치 하한) 결정 대기
  - [[task-023-improve-vocab-screen]] — 단어장 조각 필터·뱃지·상세 재생(IMP-0001·0002·0003, R1·**데모 delta v1 승인 2026-10-01**) — 구현 완료·REV-050(Medium 1: 필터 전환 시 머리 줄 개수 어긋남) 수정 → REV-053 PASS · Judge C2 Codex 없음 · **QA PASS** → ✅ 운영 반영(웹만 — 실기기 소리 확인은 사용자)
  - [[task-024-improve-talk-length]] — ✅ **완료·운영 반영**(`da263a6`, Reviewer·QA PASS, 운영 스모크 45/45 — 폰 체감은 사용자) 회화 응답 길이 상황별 1~4문장(IMP-0010, talk@v4·sceneCap)
  - [[task-025-improve-today-lesson]] — 오늘의 회화 4건(IMP-0012·0013·0014·0016, R2·**데모 delta v1 승인 2026-10-01**, A4 v8) — 화면 구현 완료 → ✅ 운영 반영(2026-10-03 `cb176cc`) · REV-052 → REV-060 수정 확인 · Codex 지적 0건 ×2 · lesson@v8·reviewMix@v2 · **QA PASS_WITH_NOTES(2026-10-03 09:23 — 12/14 PASS·FAIL 0·Low 1 기존 코드) → ✅ 운영 반영(2026-10-03, 운영 스모크 010 65/65·011 61/61·012 32/32·007 45/45)** · v8 롤백 기준 ①~④ 감시 · 후속 [[task-025b-lesson-hangul-fallback]]
  - [[task-025b-lesson-hangul-fallback]] — 025 후속(퀴즈 질문 한글 폴백 D9 Medium·로그 카운터 분리·④ 활용형 매칭·종료 카드 링크 shrink-0, R1·화면 구조 변경 없음) — **완료·운영 반영 2026-10-03 12:46**(커밋 `9070e11`, 릴리스 `20261003-124555-9070e11e`, Reviewer 3차 PASS·QA 화면 실측 PASS·운영 스모크 010 65/65, ④ 부정 오탐 2회 반려로 Opus 승격)
  - [[task-026-improve-hangul-reading]] — 한글 발음 표기+토글(IMP-0009·0015, R2·**데모 delta v1 승인 2026-10-01**)
  - 보류: IMP-0011(카드 결과 초이스 통일 — Q9 예제 검토 대기) · IMP-0004(카톡 연동 2단계 자동 수집 — 별도 task, 신규도입 검토 필요) · IMP-0007(N5 단어 수 — 단어 출처 결정 대기)

## Todo (2026-10-05 접수 — 026·030 후속)
- [[task-031-japanese-display-polish]] — 일본어 표시 마무리 3건(経営 장음 한글·녹음 중 저장됨 잔류·조각 영구 loading) — ✅ **완료·운영 반영** `32da7d2`(REV-102 PASS_WITH_NOTES, 운영 스모크 42/42·45/45)
- [[task-032-lexicon-to-reading]] — 관리자 발음 사전 → 읽기 분석기 반영(青か·愚か·密か) — ✅ **완료·운영 반영** `afde949`(REV-103·QA PASS, 운영 스모크 42/42·45/45)
- [[task-033-japanese-display-more-screens]] — 일본어 표시 확장(AI 평가·카드 뒷면·복습 카드) — ✅ **완료·운영 반영** `077654f`(데모 v1 승인·REV-105·QA PASS, 운영 스모크 45/45·42/42)
- [[task-034-tts-lexicon-compound-guard]] — ✅ **완료·운영 반영(2026-10-05 15:47, `7d68b1d`·릴리스 `20261005-154632-fc19593e`, 운영 스모크 007 45/45·006 42/42)**: TTS 발음 사전 복합어 경계 가드(`明日香`→アシタ香) + 사전 캐시 경쟁(REV-103 L-1) · judge: local_fix·R1·opus·standard·데모 none · REV-106 PASS_WITH_NOTES · Codex 한도 미기록 보류 · QA PASS(결함 0, 옛 코드는 `アシタガサン`→새 코드 `アスカサン` 실 M4 대조)
- [[task-035-tts-rescan-contract-test]] — ✅ **완료(2026-10-05, task-036 배포와 함께 push·운영 반영 — 동작 변경 없음)**: 034 후속 — 어댑터 `substituteReadings` ↔ L4 `rescanHintSurfaces` 계약 테스트(JSON 픽스처 18사례 공유, M-1) + `lexiconOverlay` 주석 정정, `lead` 는 제거하지 않고 주석만(L-2 전제가 공백 시작 표기에서 깨짐) · judge 분류 실패→안전값 opus·standard · REV-107 PASS_WITH_NOTES(반영) · QA PASS(결함 0, 동작 불변 24만 건·변이 8/8). **동작 변경 없음** — push 는 운영 재배포(pm2 재시작)만 일으킴
- [[task-036-remove-llm-reading-fields]] — ✅ **완료·운영 반영(2026-10-05 20:46, `7aeba66`·릴리스 `20261005-204558-e1c5f296`, 운영 스모크 007 45/45·006 42/42·턴 계약 48/48 — task-035 도 같은 배포로 반영)** · W1 감시 진행(첫 TALK 100턴): 구 `reading`/`replyReading` 제거(talk@v7→v8·chat@v2→v3) · 지연 p50 TALK −337ms·CHAT −546ms·출력 −9.4%/−18.9%(PE 324회), 첫 음성 악화 없음(QA n=40 교차) · judge structural·R2·sonnet·standard · REV-108·REV-109(Codex C2 1건 부분 채택)·QA PASS(결함 0) · ⚠ W1 JSON 구문 슬립 풀링 8/176 vs 1/164(p=0.038) — 수용 + 배포 후 감시·롤백 기준, 후속 037 후보 `extractJson` 좁은 복구. DB 컬럼·마이그레이션 변경 없음

## Backlog (Phase 1, 순서·의존은 design-spec §15)
- task-003 — 온디바이스 STT 플러그인(Kotlin+sherpa-onnx) + gateway 폴백 + **M4 tts-service 자체 FastAPI(정규화·발음 사전 P0·SpeechProfile·RenderingPlan·캐시 키 12요소)** + Capacitor 셸 + **§9 실측 게이트 6항목 + TTFA** (002 후, 003·004·005 병렬)

## 개선 백로그 (사용자 점검분 — 2026-09-30 착수: task-020~026)
- `/개선작업` 으로 추가·조회. 항목은 `improvements/items/`, 표는 `improvements/improvements.base`, 규칙은 [[improvements/README|README]]. 구현팀은 건드리지 않는다.

## 정리 backlog (소규모)
- (033 후속) 교차 보호 대상 문장 읽기를 서버 응답에서 비우기(QA I-1) · 복합어·조각 경계 교차 보호(REV-104 L-1) · 극단 카드 숨긴 예문 줄 루비 비침(L-2) · 평가 "내가 한 말" 스크린리더 비노출
- ~~(032 후속) TTS `明日香`→アシタ香 · REV-103 L-1 사전 캐시 재충전~~ → [[task-034-tts-lexicon-compound-guard]] 로 처리
- [[task-037-json-slip-repair]] — ✅ **완료·운영 반영(2026-10-05 23:47, `8304379`·릴리스 `20261005-234748-fb6af05a`, 운영 스모크 007 45/45·턴 계약 48/48·011 60/60 — 006 은 41/42: 1회차 12초 CLI 타임아웃·2·3회차 6b 자정 날짜 의존, 037 이전 코드 대조 실험도 동일 실패 → 무관)** · W1 감시 진행(로그 `구문 슬립 복구(ROOT_CLOSE)` = Trace `repaired` 턴 수): 036 후속 W1 — TALK·CHAT JSON 루트 조기 닫힘 슬립을 `repairRootClose` 좁은 복구로(요청 단위 옵트인·검증 그대로 엄격) · judge local_fix·R1·sonnet·standard·데모 none · REV-110 PASS_WITH_NOTES(반영)·QA PASS(결함 0) — **실 Claude CLI TALK 128호출 중 자연 슬립 3건 전부 복구 `attempts=1`**, 독립 퍼즈 120만 건 위반 0. 프롬프트 문구·버전·DB·화면 무변경
- [[task-038-smoke-006-daily-robust]] — ✅ **완료(2026-10-06, 로컬 커밋 — `tests/live` 는 webhook 건너뜀 목록 밖이라 push 는 다음 운영 코드 변경과 묶음)**: 006 스모크 6a·6b 날짜 의존 보정(오늘 DAILY 행 제외) · REV-111 PASS_WITH_NOTES·QA PASS(오늘 행 없는 날 42/42 ×2·변이 실제 `FAIL 6b` 확인) · 운영 코드 무변경
- (인프라) webhook `deploy-thekaiwa.sh:22` 의 docs_only 판정이 `git diff --name-only` 의 quotepath 인용 때문에 **한글 파일명(IMP-0024·0025 등)을 코드로 오분류** → 10-06 12:51 vault 전용 push 가 재배포됨(릴리스 `20261006-125144-c8760053`, 동작 변화 없음). ✅ **해결(2026-10-06 14:20, 사용자 승인)** — `git -c core.quotepath=false diff --name-only` 로 수정·시뮬레이션 확인(다른 `deploy-*.sh` 에는 같은 패턴 없음)
- (038 후속) 6a·6b 가 오늘 DAILY 의 **값**(`chatTurns`·`corrections.accepted`) 부당 증가는 못 잡음(REV-111 L-1 — 한 줄 단언 후보) · check id 에 보정 문구가 들어가 출력이 김(L-2)
- (037 후속) ~~`tests/live/task006-smoke.ts` 6b 날짜 의존~~ → task-038 로 처리 · 임시 복제본 `~/.node-local/thekaiwa-pre037/` 정리(사용자 `rm -rf`) · 운영 `claudeCli 타임아웃`(12초) 빈도 관찰
- (036 후속) ~~037 후보 `extractJson` 좁은 복구~~ → 위 task-037 로 처리 · — 루트가 닫힌 뒤 `,"키":…}` 가 이어지면 직전 `}` 를 지우고 재파싱(REV-108 B, W1 JSON 구문 슬립 범주 제거 — 공용 파싱 경로라 R2 + 슬립 원문 회귀 테스트 필수) · O-1 `TurnAudio.metrics().mismatch` 서버 미기록(Trace `TTS_ALIGN` 단계·`console.warn(traceId)` — task-007 C1-3 ③ 미구현) · `docs/screens.md:488·8052·8087`·`.codex/agents/prompt-engineer.toml`(생성본 재생성)·persona `tutor.md:65` "읽기" 문구(다음 persona 수정 때 그 행만) · T-C 슬립→`runJsonWithRetry` `attempts===2` 단언
- (035 후속) `validateLexiconEntry` 가 공백으로 시작하는 표기를 거부하도록(`lexicon.ts` — 손상 스냅샷 방어, 별도 task) · 계약 테스트 사례 수 하한 `>= 10` → 정확 수 단언(REV-107 I-1·QA O-2) · 개발 미러의 다른 세션 임시 파일(`tmp-pe/t49.ts`·`.scratch-021/`) 정리 — `npm run lint` 노이즈
- (034 후속, REV-106) ~~M-1 어댑터↔L4 결합~~ → [[task-035-tts-rescan-contract-test]] 로 처리(공유 픽스처, 위치 기반 치환은 하지 않음 — 엔진 계약 변경이라 별도 판단) · M-2 한자 전용 사용자 표기가 한자 이웃(様·先生·駅)에서 꺼짐 — PERSON·PLACE 접미어 허용 또는 위치 기반 치환 · 관리자 미리듣기 `notHitText` 에 "더 긴 한자 단어의 일부" 사유 문구(designer 경로) · `reading/lexiconOverlay.ts:5` 주석("표시와 소리가 같은 항목") 정정 · `renderingPlan.ts:60` 죽은 코드 `lead` · `ヶ` 한자 클래스 정의(`三ヶ月間` 꺼짐)
- (031 분리, 2026-10-05) REV-093 LOW — `orchestrator/index.ts` flushUserRow 번역 updateMany 를 `correction.create` 앞으로(S→X 승격 대기 축소). 교정 트랜잭션 순서라 R2 보강 대상 → standard+QA 로 별도 처리
- (005b) 발음 사전(Pronunciation Dictionary P0) — task-003 이후 · #93b credentialRef 쓰기·functional test 30초 슬롯 원자성 — Phase 2(012c) · 운영 APP_ENV=LOCAL·dev 상태 점검이 운영 connection 행을 바꾸는 문제 — task-009
- `infra/http.ts` 기본 오류 문구 "AI 엔진…" 사용자 노출 가능 · 공용 `Badge` warn/accent·`ink3` 라이트 명암비 미달 · `ComingSoon` Phase/task 번호 노출
- `conversation/persona/loader.ts` 동적 `statSync` → 빌드 "프로젝트 전체 추적" 경고(정적 경로 또는 `outputFileTracingExcludes`) · webpack dev 에서 `crypto` 해석 실패(Turbopack 기본은 정상)

## Phase 2 이후
- 순서(2026-09-28 사용자 결정 반영, design-spec §15): **010 오늘의 회화** → **010b 반복 학습**(RepetitionItem 3경로·`LearningObservation` 기록·A11·오늘의 복습·A5) → **010c 교정 방식 설정**(`Profile.correctionMode` FLUENCY 기본) → **011 AI평가** → **012 달력** → **010d 상황 역할극**(Scenario, Phase 2 후반) → 012b 음성 P2 → 012c Console P2
- Phase 3: 013 분석·성장기록(+`LearnerSkillState`) · 014 서랍장 전체 · 015 무엇이든 물어보세요(3a→3b MCP, **D2 외부 전송 범위 결정 필요 — 이때 사용자에게**) · 015b 음성 P3 · 016 음성 P4

## 미결정
- **TTS 5차 보완**: 발음 사전 적용 방식(플랫폼 치환 vs SBV2 user_dict 병행) / Timing 산출(narabas vs VITS duration) / TTS P1(품질·버전·지표) Phase 2 vs 4 / TEXT_ONLY UX / 온디바이스 TTS research 조건 → [[task-003c-tts-productization-design]]
- ~~`Scenario`·`LearnerSkillState`·`LearningObservation` 도입 Phase~~ ✅ 2026-09-28 결정(D1 010d·D5 관측만 010b·D6 010c) / 개인 기록의 Claude CLI 전송 범위(D2, task-015 때) / 의미 검색 도입 조건 / M4 LoRA 실험 조건 → `learning-personalization-and-llm-data.md` §8
- Style-Bert-VITS2 기본 모델 화자 id 매핑(Haruka/Sakura/Takumi 표시명 ↔ speaker) — task-003 실측 후
- `EngineMetricsDaily` 물화 vs 뷰 — Phase 3 진입 시
- Redis 도입 여부 — SpeechJob 처리량이 문제될 때만
