---
project: TheKaiwa
updated: 2026-09-26
tags:
  - type/context
---
# 제약 조건 (사용자 소유 — 에이전트는 읽기만)

- 개인용 1인 앱. 실사용자 1명(SUPER_ADMIN = `OWNER_EMAIL`). 상용 배포 없음(라이선스 의무는 개인 이용 범위).
- 안드로이드 기본 STT/TTS 사용 금지 — 음성은 §9 별도 스택만.
- Claude 구독(CLI) 사용량은 6개 프로젝트가 공유한다. 회화 턴은 haiku 고정, 분석·레슨은 batch 레인.
- 개발·운영이 같은 NAS MariaDB 를 쓴다. `prisma migrate dev` 금지, `db push` 만. 설정 엔티티는 `environment` 컬럼으로 분리.
- 우분투에는 GPU 가 없다. 무거운 추론(TTS)은 맥 M4. Redis 는 도입하지 않는다(필요 시 사용자 승인).
- 사용자 대화·음성 데이터는 모델 학습에 쓰지 않는다(§71). 원음 보존 30일.
- 사용자 화면에 엔진명·모델명 노출 금지. Secret 은 앱·DB·Export·Trace·로그 어디에도 평문 없음.
