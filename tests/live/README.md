# tests/live — 실서버·실엔진 검증 스크립트 (우분투 미러에서만)

| 파일 | 용도 |
|---|---|
| `llm-measure.ts` | Claude CLI 실측(지연·계약·교정 품질) — `decisions/llm-japanese-quality.md` |
| `qa-session.ts` | **QA 테스트 계정** `qa-bot@thekaiwa.test`(provider `test`, role USER, 비밀번호 없음) 세션 쿠키를 권한 600 파일로 만든다. `127.0.0.1:3010` 에서 인증 API 를 검증할 때만 쓰고, 쿠키 값은 출력·커밋하지 않는다. 실사용자 계정과 섞이지 않게 이메일 도메인을 `.test` 로 고정했다. |

실행 위치는 `~/.node-local/thekaiwa`(NFS noexec). 예: `node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/kaiwa-qa-cookie`
