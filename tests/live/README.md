# tests/live — 실서버·실엔진 검증 스크립트 (우분투 미러에서만)

| 파일 | 용도 |
|---|---|
| `llm-measure.ts` | Claude CLI 실측(A1 TALK, 지연·계약·교정 품질) — `decisions/llm-japanese-quality.md` |
| `chat-review-measure.ts` | Claude CLI 실측(A3 REVIEW, `buildChatReviewRequest`) — 지연·검출률·오탐·인용 규칙(`isVerbatimQuote`) 준수·계약 위반(dropped). 픽스처 `tests/prompts/fixtures/chat-review.json`(합성 채팅 1건). `--runs`(기본 3) — task-006 지시로 총 호출 6회 이내. |
| `word-enrich-measure.ts` | Claude CLI 실측(A10 WORD_ENRICH, `buildWordEnrichRequest`) — 지연(20s 예산)·JSON 재시도·`valid` 판정 정확도·reading/partOfSpeech/jlpt/meaning 품질·엔진명 누출. 픽스처 `tests/prompts/fixtures/word-enrich.json`(합성 표현 12건: 유효 9·무효 3). 픽스처 전체 1패스(12회) + `--repeat-ids`(기본 `w01,w04,w07`) × `--repeat-runs`(기본 2) = 총 18회 이내(task-008 지시). |
| `qa-session.ts` | **QA 테스트 계정** `qa-bot@thekaiwa.test`(provider `test`, role USER, 비밀번호 없음) 세션 쿠키를 권한 600 파일로 만든다. `QA_ACCOUNT=2` 면 두 번째 계정 `qa-bot2@thekaiwa.test`(IDOR 검증용). 127.0.0.1(3010·스모크용 3011)에서 인증 API 를 검증할 때만 쓰고(서버가 localhost 직접 요청에서만 QA 토큰을 인정), 쿠키 값은 출력·커밋하지 않는다. 실사용자 계정과 섞이지 않게 이메일 도메인을 `.test` 로 고정했다. |
| `task006-smoke.sh` / `task006-smoke.ts` | task-006 채팅·턴(SSE)·표현 점검(동기·잡)·교정/제안 채택·IDOR(두 번째 QA 계정)·입력 검증·엔진명 누출·턴 p50 을 항목별 PASS/FAIL 로 찍는다(Leader 완료 기준 2~12·14). 서버를 따로 띄운 뒤(예: 미러에서 `next dev -H 127.0.0.1 -p 3011`) `bash tests/live/task006-smoke.sh 3011`. Claude CLI 약 16회(턴 10회 p50 포함), 분당 턴 제한 시험 전 61초 대기로 총 4~5분. 만든 행은 QA 계정 소유만이고 끝에 지운다. |
| `task008-smoke.sh` / `task008-smoke.ts` | task-008 단어장(#40~#46b)·오늘의 단어(#47~#54) — Leader 완료 기준 2~11 + 동시 요청(세트 생성 2·같은 order 답 5·finish 3·seed-pack 2·단어 삭제+finish·답+finish)·IDOR(두 번째 QA 계정)·입력 검증·엔진명 누출·attempt p50/세트 서버 총시간을 항목별 PASS/FAIL 로 찍는다. 서버를 따로 띄운 뒤(미러에서 `next dev -H 127.0.0.1 -p 3011`) `bash tests/live/task008-smoke.sh 3011`. Claude CLI 3회(A10 보강 — 나머지 보강 요청은 메모리 캐시·분당 21번째 429 확인), 약 1분. **QA 두 계정의 단어·세트·WORDS 기록·VOCAB_SESSION 스냅샷을 시작과 끝에 비운다**(DAILY 는 이 실행이 만든 행만). 같은 dev 서버로 1분 안에 다시 돌리면 보강 분당 창이 이어져 11e 가 어긋날 수 있다. |

실행 위치는 `~/.node-local/thekaiwa`(NFS noexec). 예: `node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/kaiwa-qa-cookie`
