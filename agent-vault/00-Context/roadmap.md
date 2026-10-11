---
type: roadmap
project: TheKaiwa
updated: 2026-10-11
phases:
  - { id: 0, name: "스캐폴딩·6층 골격", status: done }
  - { id: 1, name: "Phase 1 음성·채팅·단어장 기반", status: done }
  - { id: 2, name: "Phase 2 학습 심화(회화·복습·평가·달력·콘솔 편집)", status: doing }
  - { id: 3, name: "Phase 3 분석·서랍장·질문·발음 분석", status: todo }
  - { id: 4, name: "Phase 4 Voice Package·Admin 분리", status: todo }
tags: [type/roadmap]
---

# TheKaiwa 로드맵 (Lingofy Japanese)

## 로그인·시작 · public
### / | 시작 주소
- [x] (0) 루트 접속 시 오늘 탭으로 이동, 미로그인은 로그인으로 이동 [[task-002-phase0-scaffolding]]
- [x] (0) 앱 셸·하단 탭 5개(회화·오늘·계획표·단어장·질문)와 상단 아바타 [[task-002-phase0-scaffolding]]
- [x] (1) 하단 탭 라벨 서랍장을 단어장으로 변경 IMP-0006 [[task-020-improve-tab-label]]

### /login | 로그인
- [x] (0) Google 계정 로그인(httpOnly 쿠키 세션) [[task-002-phase0-scaffolding]]
- [x] (1) 앱 로그인(Chrome 창 대기·딥링크 복귀·마무리 덮개) [[task-003f-android-ondevice-stt]]
- [x] (0) 로그인 실패 안내(oauth_error) [[task-002-phase0-scaffolding]]

### /invite | 초대코드 가입
- [x] (0) 초대코드 입력으로 가입 [[task-002-phase0-scaffolding]]
- [x] (1) 초대 뒤 앱으로 돌아가기 [[task-003f-android-ondevice-stt]]

## 학습 앱 · login
### /study/ai | AI와 공부하기
- [x] (1) 회화·채팅 전환 홈(목록·채택 대기 교정 요약) [[task-006-chat-correction]]
- [x] (1) 새 채팅 시작 시트 [[task-006-chat-correction]]
- [x] (1) 회화 목록·새 회화 시작 [[task-007-talk-voice-web]]
- [ ] (2) 상황 카드 메뉴로 역할극 고르기 IMP-0017 [[task-010d-scenario-roleplay]]

### /study/ai/chat/[chatId] | 채팅방
- [x] (1) 글로 대화(SSE 턴·사용자당 락) [[task-006-chat-correction]]
- [x] (1) 표현 점검 요청과 교정 제안 [[task-006-chat-correction]]
- [x] (1) 교정 채택·무시(채택해야만 저장) [[task-006-chat-correction]]
- [x] (1) 제안 카드(단어 추가 등) [[task-006-chat-correction]]
- [x] (1) 키보드가 올라와도 입력창이 가려지지 않음 IMP-0008 [[task-021-improve-keyboard-inset]]
- [x] (1) 한자 위 후리가나·한글 발음 줄·번역 표시와 방 메뉴 토글 IMP-0009 IMP-0018 IMP-0019 [[task-026-improve-hangul-reading]] [[task-030-japanese-display-followup]] [[task-031-japanese-display-polish]]

### /study/ai/chat/[chatId]/review | 표현 점검 결과
- [x] (1) 문장별 점검 결과 목록 [[task-006-chat-correction]]
- [x] (1) 교정 채택 시트 [[task-006-chat-correction]]

### /study/ai/talk/[chatId] | 음성 회화방
- [x] (1) 푸시투토크 음성 입력(웹 서버 인식·앱 온디바이스 인식) [[task-007-talk-voice-web]] [[task-003e-stt-gateway-web]]
- [x] (1) 문장 단위 선생님 음성 재생(청크 스트리밍·끼어들기)과 목소리 상태 표시등 [[task-007-talk-voice-web]] [[task-003d-tts-p0]]
- [x] (1) 틀린 표현 교정 카드 즉시 표시 [[task-007-talk-voice-web]]
- [x] (2) 교정 방식(유창성·코치 힌트)과 모아 둔 교정 시트 [[task-010c-correction-mode]]
- [x] (1) 응답 길이 상황별 1~4문장·번역 줄 한국어·수준별 쉬운 교정 설명 IMP-0010 IMP-0020 IMP-0022 [[task-024-improve-talk-length]] [[task-028-talk-translation-explanation]]
- [~] (2) 일상회화 우선 설명과 JLPT 식 추가 설명 칸 IMP-0025 [[task-039-improve-tutor-explanation]]
- [ ] (2) 상황 역할극(목표·표현 체크·코치·결과·단계 진행) IMP-0021 [[task-010d-scenario-roleplay]]
- [ ] (2) 재확인 필요 발화 두 안 중 고르기 카드

### /study/today | 오늘
- [x] (1) 오늘의 단어 카드·최근 기록·보관한 세트 [[task-008-vocab-today-words]]
- [x] (2) 오늘의 회화 카드 [[task-010-today-lesson]]
- [x] (2) 오늘의 복습 카드(강사가 3~7일 판단·근거 한 줄) [[task-010b-repetition]] [[task-010b2-review-decision-v2]] [[task-010b3-a11-timeout-retry]]
- [x] (2) AI 평가 카드 [[task-011-ai-evaluation]]
- [ ] (2) 챌린지 오늘 할 일(주제 단어·주제 수업) 연동 IMP-0024

### /study/today/words/[sessionId] | 단어 카드 덱
- [x] (1) 스와이프 카드 덱(고르기·뒤집기 모드) [[task-008-vocab-today-words]]
- [x] (1) 서버 채점·정답 미노출·카드마다 즉시 저장 [[task-008-vocab-today-words]]
- [x] (1) 끝내기 확인·세트 결과·다시 풀기 [[task-008-vocab-today-words]]
- [x] (2) 세트 결과·복습 칩의 히라가나·한글 표시 [[task-033-japanese-display-more-screens]]
- [ ] (2) 카드 결과 선택 통일·재생 버튼 우선 IMP-0011

### /study/today/talk/new | 오늘의 회화 주제 고르기
- [x] (2) 주제 목록(시드 5개)과 확인 시트 [[task-010-today-lesson]]
- [x] (2) 수업 만들기 요청 후 진행 화면으로 이동 [[task-010-today-lesson]]

### /study/today/talk/new/paste | 문장 붙여넣기
- [x] (2) 붙여넣은 문장으로 수업 만들기 [[task-010-today-lesson]]

### /study/today/talk/[lessonId] | 오늘의 회화 수업
- [x] (2) 만드는 중·실패 화면(잡 진행 표시) [[task-010-today-lesson]]
- [x] (2) 이해 단계: 청취 구간 반복·들린 단어 메모(제안 카드) [[task-010-today-lesson]]
- [x] (2) 문법·문제 단계(퀴즈 첫 답 고정) [[task-010-today-lesson]]
- [x] (2) 응용·말하기 단계(발화 연결) [[task-010-today-lesson]]
- [x] (2) 완료 한 트랜잭션(기록·스냅샷·복습 등록)과 다음 수업 예고 [[task-010-today-lesson]]
- [x] (2) 복습 레슨(강사가 섞어 만든 복습) [[task-010b-repetition]]
- [x] (2) 이해 문장별 다시 듣기·표현 재생·문제 한국어 뜻·응용 차이 비교 IMP-0012 IMP-0013 IMP-0014 IMP-0016 [[task-025-improve-today-lesson]]
- [x] (2) 퀴즈 질문 한글 폴백·활용형 매칭·종료 카드 링크 [[task-025b-lesson-hangul-fallback]]

### /study/today/eval/new | AI 평가 시작
- [x] (2) 종류(단어·회화)·주제 선택 [[task-011-ai-evaluation]]
- [x] (2) 단어 부족 안내·진행 중 평가 이어가기 [[task-011-ai-evaluation]]

### /study/today/eval/[evaluationId] | AI 평가
- [x] (2) 문항 만들기(내 단어장 60% 이상) [[task-011-ai-evaluation]]
- [x] (2) 10분 문항 풀이(객관식 즉시 채점) [[task-011-ai-evaluation]]
- [x] (2) 제출·서술형 채점·기록률 100% 트랜잭션 [[task-011-ai-evaluation]]
- [x] (2) 결과(점수·등급·문항별 정답)와 레벨 제안 [[task-011-ai-evaluation]]
- [x] (2) 평가 화면 일본어 표시(히라가나·한글)·정답 보호 [[task-033-japanese-display-more-screens]]

### /study/today/eval/history | AI 평가 기록
- [x] (2) 평가 기록 목록(진행 중 포함) [[task-011-ai-evaluation]]

### /plan | 계획표
- [x] (2) 월 달력(출석·학습 종류·시간 표시) [[task-012-calendar]]
- [x] (2) 하루 시트(그날 기록·복습 예정) [[task-012-calendar]]
- [x] (2) 학습 기록 열기·삭제(집계 스냅샷은 그대로) [[task-012-calendar]]
- [~] (2) 챌린지 설계서·데모(주제 선택형 매일 학습) IMP-0024 [[task-040-improve-challenge-design]]
  - [ ] (2) 챌린지 만들기(주제·기간·하루 목표)
  - [ ] (2) 챌린지 현황 카드(수행 연속·달성률)
  - [ ] (2) 챌린지 상세(날짜 띠·주제 표현 익힘)
- [ ] (3) 분석·성장 기록(능력 축·추이)

### /ask | 무엇이든 물어보세요
- [ ] (3) 일본어 표현·문법 질문
- [ ] (3) 학습 기록 근거 답변과 출처 표시

### /drawer/words | 단어장
- [x] (1) 단어 추가·수정·삭제·보관(카테고리·검색·정렬) [[task-008-vocab-today-words]]
- [x] (1) 단어 AI 보강 초안(제안) [[task-008-vocab-today-words]]
- [x] (1) 기본 단어 팩 [[task-008-vocab-today-words]]
- [x] (2) 조각 필터·조각 뱃지·단어 상세 소리 듣기 IMP-0001 IMP-0002 IMP-0003 [[task-023-improve-vocab-screen]]
- [~] (2) JLPT 5단계 기본 단어(초보자 (N5)~최상급 (N1) 7,755개)·목표 수준 보조 버튼·설정 출처 줄 — 배포됨, 사용자 표본 검수 대기 IMP-0007 [[task-051-improve-n5-vocab-pack]]
- [ ] (3) 채택 교정 모음(서랍장 전체)

### /settings | 설정
- [x] (1) 기본정보·목표·학습 설정 [[task-005-settings-attendance]]
- [x] (1) AI 선생님 목소리(스타일·속도·높낮이·억양·미리듣기) [[task-005-settings-attendance]] [[task-003d-tts-p0]]
- [x] (1) 음성 인식 모드와 마이크 테스트 [[task-003e-stt-gateway-web]]
- [x] (1) 출석 체크인 카드 [[task-005-settings-attendance]]
- [x] (2) 음성 조절 범위 약 2배 IMP-0005 [[task-022-improve-voice-range]]
- [x] (2) 교정 방식 설정(유창성·코치) [[task-010c-correction-mode]]
- [x] (2) 일본어 표시 설정(히라가나·한글·번역 스위치) IMP-0009 [[task-026-improve-hangul-reading]]
- [x] (1) 설정 끝에서 페이지 전체가 밀리지 않음 IMP-0023 [[task-029-settings-scroll]]

## 관리자 콘솔 · admin
### /admin | 콘솔 진입
- [x] (1) 콘솔 권한 가드(권한 없으면 앱 공통 404) [[task-005b-admin-console-skeleton]]
- [x] (1) 설정 화면 관리자 행에서 대시보드로 이동 [[task-005b-admin-console-skeleton]]

### /admin/dashboard | 대시보드
- [x] (1) 역할별 엔진·연결·모델·상태 한눈에 보기 [[task-005b-admin-console-skeleton]]
- [ ] (2) 대시보드·TTS 품질 지표

### /admin/speech/realtime | 실시간 음성 인식
- [x] (1) 지금 쓰는 연결·Health·기능 테스트 [[task-005b-admin-console-skeleton]]
- [x] (2) 예비 순서 편집 [[task-012c-console-p2]]

### /admin/speech/analysis | 분석 음성 인식
- [x] (1) 지금 쓰는 연결·Health·기능 테스트 [[task-005b-admin-console-skeleton]]
- [x] (2) 분석 워커 상태 표시(health) [[task-012b-speech-p2]]
- [ ] (2) 발화 로그·재확인 화면

### /admin/speech/tts | 음성 합성
- [x] (1) 지금 쓰는 연결·Health·기능 테스트 [[task-005b-admin-console-skeleton]]
- [x] (1) 합성 미리듣기 [[task-003d-tts-p0]]
- [x] (2) 예비 순서 편집 [[task-012c-console-p2]]
- [ ] (2) 합성 관측·품질 지표
- [ ] (2) 합성 타이밍(M4 설치)

### /admin/speech/tts/lexicon | 발음 사전
- [x] (1) 검색·범위 필터 [[task-003g-lexicon-admin]]
- [x] (1) 항목 추가·수정·끄기·다시 켜기 [[task-003g-lexicon-admin]]
- [x] (1) 적용 전후 미리듣기 비교 [[task-003g-lexicon-admin]]
- [x] (1) 가져오기(dryRun)·내보내기 [[task-003g-lexicon-admin]]
- [x] (2) 사전을 화면 읽기 줄에도 반영 [[task-032-lexicon-to-reading]]
- [x] (2) 복합어 경계 가드(明日香 오독 수정) [[task-034-tts-lexicon-compound-guard]]

### /admin/speech/tts/lexicon/versions | 발음 사전 버전
- [x] (1) 버전 기록과 상세 diff [[task-003g-lexicon-admin]]
- [x] (1) 되돌리기(새 버전으로 기록) [[task-003g-lexicon-admin]]

### /admin/llm | LLM
- [x] (1) 지금 쓰는 연결·Health·기능 테스트 [[task-005b-admin-console-skeleton]]
- [x] (2) 예비 순서 편집 [[task-012c-console-p2]]
- [ ] (2) 프롬프트 편집·버전(Prompt Registry)
- [ ] (2) Playground

### /admin/voices | 목소리
- [x] (1) 목소리 목록(읽기 전용) [[task-005b-admin-console-skeleton]]
- [ ] (4) Voice Package 가져오기·스타일·Preset
- [ ] (4) Voice Versions·Canary

### /admin/connections | 연결
- [x] (1) 연결 목록과 Health [[task-005b-admin-console-skeleton]]
- [x] (1) 비밀 값은 이름만 보이는 참조 시트 [[task-005b-admin-console-skeleton]]

### /admin/connections/[id] | 연결 상세
- [x] (1) Health·기능 테스트·최근 결과 [[task-005b-admin-console-skeleton]]
- [x] (2) 설정 편집·사용 여부·비밀 참조 연결 [[task-012c-console-p2]]

### /admin/plugins | 플러그인
- [x] (1) 플러그인 로드 상태 목록 [[task-005b-admin-console-skeleton]]

### /admin/plugins/[id] | 플러그인 상세
- [x] (1) 플러그인 스키마 보기 [[task-005b-admin-console-skeleton]]

### /admin/configuration | 설정값
- [x] (1) 실제 적용값(Effective)과 출처 배지 [[task-005b-admin-console-skeleton]]
- [x] (2) 설정 편집(Form·Raw JSON)·검증·기능 테스트·Diff·적용 [[task-012c-console-p2]]
- [x] (2) 운영 환경 변경은 SUPER_ADMIN 확인 [[task-012c-console-p2]]
- [x] (2) 비밀 값 저장 거부·credentialRef 만 저장 [[task-012c-console-p2]]

### /admin/diagnostics | 진단
- [x] (1) Health 기록 [[task-005b-admin-console-skeleton]]
- [x] (1) 요청 Trace 목록 [[task-005b-admin-console-skeleton]]
- [ ] (3) E2E 점검·Debug 도구

### /admin/diagnostics/traces/[traceId] | Trace 상세
- [x] (1) 요청 Trace 상세 [[task-005b-admin-console-skeleton]]

### /admin/history | 설정 이력
- [x] (2) 설정 버전 기록과 되돌리기(새 버전) [[task-012c-console-p2]]
- [x] (2) 감사 기록 [[task-012c-console-p2]]

## 서버 API · api
### /api/auth | 인증
- [x] (0) Google OAuth·세션 쿠키 [[task-002-phase0-scaffolding]]
- [x] (1) 앱용 60초 1회용 코드 교환 [[task-003f-android-ondevice-stt]]

### /api/health | 헬스
- [x] (0) 서버 상태 확인 [[task-002-phase0-scaffolding]]
- [x] (1) 필수 구성요소 이상 시 503 게이트 [[task-009-release-cutover]]

### /api/v1/chats | 채팅·회화
- [x] (1) 글 채팅 턴(SSE·사용자당 락) [[task-006-chat-correction]]
- [x] (1) 음성 회화 턴(문장별 TTS 스트림·5초 예산) [[task-007-talk-voice-web]]
- [x] (1) 표현 점검(동기·잡) [[task-006-chat-correction]]

### /api/v1/corrections | 교정
- [x] (1) 교정 목록·채택·무시(원문 무수정) [[task-006-chat-correction]]

### /api/v1/proposals | 제안
- [x] (1) AI 제안 목록·채택(채택 전 다른 표 행 0) [[task-006-chat-correction]]

### /api/v1/words | 단어장
- [x] (1) 단어 CRUD·카테고리·보관·AI 보강 [[task-008-vocab-today-words]]
- [x] (1) 기본 단어 팩 추가 [[task-008-vocab-today-words]]

### /api/v1/vocab | 오늘의 단어
- [x] (1) 세트 생성(가중 샘플링·정답 미노출) [[task-008-vocab-today-words]]
- [x] (1) 카드 답 저장·finish 단일 트랜잭션 [[task-008-vocab-today-words]]
- [x] (1) 통계 [[task-008-vocab-today-words]]

### /api/v1/lessons | 오늘의 회화
- [x] (2) 레슨 생성 잡·단계 저장·완료 트랜잭션 [[task-010-today-lesson]]
- [x] (2) 청취 구간·표현 오디오 [[task-025-improve-today-lesson]]
- [x] (2) 말하기 과제 발화 연결 [[task-010-today-lesson]]

### /api/v1/reviews | 반복 학습
- [x] (2) 복습 항목 3경로 등록과 관측 기록 [[task-010b-repetition]]
- [x] (2) 복습 판단 응답 계약·관측 신뢰도 가중 [[task-010b2-review-decision-v2]]
- [x] (2) 복습 판단 타임아웃 1회 재시도 [[task-010b3-a11-timeout-retry]]

### /api/v1/evaluations | AI 평가
- [x] (2) 출제·답 저장·제출·결과·이력 [[task-011-ai-evaluation]]

### /api/v1/plan | 계획표
- [x] (2) 월 달력·하루 상세 조회 [[task-012-calendar]]
- [ ] (2) 챌린지 목록·만들기·상세·오늘·그만두기 [[task-040-improve-challenge-design]]

### /api/v1/study-logs | 학습 기록
- [x] (2) 기록 목록·삭제(스냅샷 불변) [[task-012-calendar]]

### /api/v1/speech | 음성
- [x] (1) 음성 설정·티켓·온디바이스 모델 목록 [[task-003e-stt-gateway-web]]
- [x] (1) 음성 합성 요청·상태·미리듣기 [[task-003d-tts-p0]]
- [x] (1) 발화 저장·조회 [[task-003e-stt-gateway-web]]
- [x] (2) 분석 결과 반영(재확인 필요 판정) [[task-012b-speech-p2]]

### /api/v1/settings | 설정
- [x] (1) 프로필·음성·음성 인식 설정 저장 [[task-005-settings-attendance]]
- [x] (2) 교정 방식·일본어 표시 설정 [[task-010c-correction-mode]] [[task-026-improve-hangul-reading]]

### /api/v1/attendance | 출석
- [x] (1) 출석 체크인(하루 2회 열어도 1행) [[task-005-settings-attendance]]

### /api/v1/text | 일본어 읽기 분석
- [x] (2) 히라가나·한글 읽기 분석(annotate) [[task-026-improve-hangul-reading]]
- [x] (2) 읽기 분석에 관리자 발음 사전 반영 [[task-032-lexicon-to-reading]]

### /api/admin/v1 | 콘솔 API
- [x] (1) 콘솔 조회·Health·기능 테스트·Trace [[task-005b-admin-console-skeleton]]
- [x] (1) 발음 사전 관리 API [[task-003g-lexicon-admin]]
- [x] (2) 설정 편집·버전·되돌리기·감사 API [[task-012c-console-p2]]

### /api/internal | 내부 API
- [x] (1) 발화 저장 콜백(음성 게이트웨이→앱) [[task-003e-stt-gateway-web]]
- [x] (2) 분석 작업 클레임·결과 반영(워커→앱) [[task-012b-speech-p2]]

### /api/app | 앱 버전
- [x] (1) 앱 버전 확인과 업데이트 안내 [[task-003f-android-ondevice-stt]]

## 서버 서비스 · service
### thekaiwa | 웹 앱 서버
- [x] (0) Next.js 앱 pm2 기동 [[task-002-phase0-scaffolding]]
- [x] (1) 운영 blue/green 릴리스·APP_ENV=PRODUCTION [[task-009-release-cutover]]
- [x] (1) 예열 CLI 풀로 회화 첫 음성 약 2초 [[task-007-talk-voice-web]]

### thekaiwa-speech-gateway | 실시간 음성 인식 게이트웨이
- [x] (1) WebSocket 스트림·1회용 티켓·Origin 허용 목록 [[task-003e-stt-gateway-web]]
- [x] (1) 합성 20문장 인식 실측(오류율·지연) [[task-003e-stt-gateway-web]]

### thekaiwa-speech-worker | 분석 음성 인식 워커
- [x] (2) SpeechJob 큐·클레임·재청구 [[task-012b-speech-p2]]
- [x] (2) 분석 인식·실시간 결과 비교(재확인 필요 판정) [[task-012b-speech-p2]]
- [x] (2) 운영 pm2 등록·분석용 읽기 도구 설치 [[task-012b-speech-p2]]
- [ ] (3) 발음 분석(모라·長音·促音·피치·유창성)

### tts-service | 음성 합성 서비스(M4)
- [x] (1) 자체 FastAPI 합성 서버(사전·pitch·스트리밍) [[task-003d-tts-p0]]
- [x] (1) 워치독·방화벽 [[task-003d-tts-p0]]
- [ ] (2) 합성 타이밍·관측

### claude-cli | 강사 AI 호출
- [x] (1) llm 파사드·라우터·어댑터와 프롬프트(회화·채팅·점검) [[task-004-ai-client-persona]]
- [x] (1) 강사 페르소나 v1(일본인 원어민·교정 철저) [[task-003b-tutor-persona-v1]]
- [x] (2) 응답 계약에서 구 reading 필드 제거 [[task-036-remove-llm-reading-fields]]
- [x] (2) 응답 JSON 구문 슬립 좁은 복구 [[task-037-json-slip-repair]]
- [x] (2) 자식 프로세스 env 프록시 키 제거 [[task-019-cleanup-lint-env-strip]]

## 안드로이드 앱 · app
### android-shell | 앱 셸·APK
- [x] (1) Capacitor 7 셸(server.url·edge-to-edge·쿠키 flush·키보드 inset) [[task-003f-android-ondevice-stt]]
- [x] (1) 앱 이름 Lingofy Japanese 1.0.1 [[task-003h-app-branding]]
- [x] (1) 서버 연결 실패 화면과 앱 업데이트 띠 [[task-003f-android-ondevice-stt]]
- [x] (1) APK 배포본·다운로드 주소·versionCode 관리 [[task-003f-android-ondevice-stt]]
- [x] (1) 키보드가 입력창을 가리지 않음(APK 1.0.2) IMP-0008 [[task-021-improve-keyboard-inset]]
- [x] (2) 카톡 등 외부 앱에서 공유하기로 학습 자료 받기(APK 1.0.3, 사용자 실기기 검증 완료) IMP-0004 [[task-052-improve-kakao-share-target]]

### sherpa-stt | 온디바이스 음성 인식 플러그인
- [x] (1) Kotlin 플러그인(sherpa-onnx·VAD) [[task-003f-android-ondevice-stt]]
- [x] (1) 인식 파일 다운로드·이어받기·모델 전환 [[task-003f-android-ondevice-stt]]
- [x] (1) 인식 실패 시 서버 인식으로 폴백 [[task-003f-android-ondevice-stt]]
- [x] (1) 실기기 실측 통과(디코드 110ms·메모리 425MB) [[task-003f-android-ondevice-stt]]

## 배포·인프라 · infra
### deploy | 배포(blue/green·webhook)
- [x] (1) scripts/deploy.sh 릴리스 배포와 롤백 리허설 [[task-009-release-cutover]]
- [x] (1) 운영 스모크(SMOKE_ENV=PRODUCTION)와 health 필수 게이트 [[task-009-release-cutover]]
- [x] (1) push 로 자동 배포(문서만 바뀐 push 는 건너뜀)

### db | MariaDB·Prisma
- [x] (0) Prisma 정본 스키마·seed [[task-002-phase0-scaffolding]]
- [x] (1) 구조 보강 3건(발화-메시지 유일 제약 등) [[task-018-db-structure-hardening]]

### lint-boundaries | 6층 경계 린트
- [x] (0) ESLint 6층 import 경계 규칙 [[task-002-phase0-scaffolding]]
- [x] (2) 상대경로 교차 모듈 import 금지 [[task-019-cleanup-lint-env-strip]]

### live-tests | 라이브 스모크·계약 시험
- [x] (1) task별 라이브 스모크(tests/live) 체계 [[task-006-chat-correction]]
- [x] (2) TTS 어댑터 재검색 계약 테스트 18사례 [[task-035-tts-rescan-contract-test]]
- [x] (2) 채팅 스모크 날짜 의존 보정 [[task-038-smoke-006-daily-robust]]

### nginx | nginx 설정
- [x] (0) vhost·wss·APK 경로 [[task-002-phase0-scaffolding]]
- [x] (1) 내부 API 외부 404 차단
