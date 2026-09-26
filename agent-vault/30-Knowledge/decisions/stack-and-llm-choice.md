---
tags:
  - type/decision
  - domain/infra
date: 2026-09-26
---
# 결정: 클라이언트 스택·LLM 제공자·팀 구성

**결정**: Next.js 16 + Prisma 6(NAS MariaDB) + Capacitor 7 Android(루트) / Claude CLI 구독(`--print --json-schema`) / 7인 팀(leader·designer·developer·prompt-engineer·reviewer·qa·deployer) + 강사 런타임 페르소나.

**기각한 대안**
- React Native(기획서 원안): 참고 대상 주짓수일상이 실제로는 Capacitor+Android(웹 React/Vite)였고, 워크스페이스 가이드(`docs/app-conversion-guide.md`)·VoiceVault·TheMeal 모두 Next.js+Capacitor. TheRoute 의 RN `mobile/` 은 2026-08 이후 정체.
- home-m4-api(qwen2.5:14b) 단독: 스트리밍 없음, 6개 프로젝트 공유 Ollama 콜드로드 147초 사례, 일본어 품질 미검증. 어댑터로만 남김(단어 보강·보기 생성·폴백 후보).
- 5인 팀(기획서 원안): 모바일 화면 설계와 교정·평가 프롬프트 품질이 핵심이라 designer·prompt-engineer 추가(워크스페이스 권장).

**근거 파일**: `docs/design-spec.md` §0·§2, `../../../docs/app-conversion-guide.md`, `TheMeal/CLAUDE.md`.
