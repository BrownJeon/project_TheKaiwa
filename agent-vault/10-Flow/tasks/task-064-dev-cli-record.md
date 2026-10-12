---
task_id: task-064
role: developer
part: dev-cli (Claude CLI 어댑터 UTF-8 조각 경계 디코딩 수정)
tags:
  - type/task-record
  - domain/llm
  - domain/engine
aliases:
  - task-064 dev-cli
created: 2026-10-12
---

# task-064 — Developer 기록 (dev-cli: `claudeCli.ts` 조각 경계 UTF-8 깨짐)

## 원인
- `collect()` 가 자식 프로세스 stdout·stderr 를 **`data` 조각마다 따로** `d.toString('utf8')` 로 디코딩했다. 파이프 읽기 경계가 3바이트(한글·일본어)·4바이트(이모지) 글자의 중간에 걸리면 앞 조각 끝 바이트와 뒤 조각 첫 바이트가 각각 U+FFFD 로 바뀐다(예: 「훨�. 많이」). task-064 라이브 측정 90호출 중 1건에서 실제로 나타났다.
- 시험으로 재현: 1바이트·2바이트 조각이면 수정 전 코드에서 stdout(text·stream-json)·stderr·예열 HIT 경로 모두 전부 깨짐(수정 전 9건 전부 fail, 실패 사유 = `����…` 로 바뀐 글자 확인).

## 바꾼 곳 — `src/modules/engine/adapters/llm/claudeCli.ts` (+11 −2)
- `import { StringDecoder } from 'node:string_decoder'` 추가.
- `collect()` 안: 스트림마다 `StringDecoder('utf8')` 하나(`stdoutDecoder`·`stderrDecoder`). stdout 은 `onStdout(stdoutDecoder.write(d))`, stderr 는 `err += stderrDecoder.write(d)`(기존 `err.length < 100_000` 가드 그대로).
- `close` 처리(`finish` 콜백 맨 앞, `aborted`/`timedOut` 판정보다 먼저): `stdoutDecoder.end()` 결과를 `onStdout` 으로, `stderrDecoder.end()` 결과를 `err` 에(같은 가드) 보낸다. 자식이 글자 중간에서 끊긴 경우 예전(조각 단위 디코딩)처럼 U+FFFD 한 글자로 남고 조용히 사라지지 않는다. `finish` 안이라 첫 정산 때 한 번만 돈다.
- `setEncoding('utf8')` 대신 `StringDecoder` 를 고른 이유: 예열 경로는 풀(`claudeWarmPool`)이 이미 같은 스트림에 Buffer 리스너를 붙였다 뗀 스트림을 이어받는다 — 스트림 인코딩 상태를 바꾸지 않는 쪽이 안전하고, 디코더 비우기가 코드에 드러나 변이 시험으로 잠글 수 있다.
- **바꾸지 않은 것(한 글자도)**: argv·타임아웃·`feed` 줄 버퍼·`OUTPUT_CHAR_CAP` 과다 출력 처리·워밍 `initial` 처리·`runWarm`/`runCold`. `initial?.stdout`(풀이 미리 읽은 문자열)은 그대로 `onStdout` 으로 간다.

## 바꾸지 않은 곳과 이유
- `probeClaudeCliVersion`(약 867줄, `--version` 첫 4,096자 수집): 같은 조각 단위 디코딩이지만 **결과에 영향이 없다** — 출력은 첫 줄만 쓰고, `VERSION_TOKEN = /^[\w.\-+ ()]{1,60}$/` 는 ASCII 만 통과시켜 멀티바이트 글자는 깨지든 말든 `version: null` 로 같다. 줄바꿈(0x0A)은 멀티바이트 시퀀스에 들어갈 수 없어 첫 줄 경계도 안 바뀐다. 최소 변경 원칙으로 두었다.

## 시험 — `src/modules/engine/__tests__/claudeUtf8Chunks.test.ts` (신규, 9건)
- 방식: 기존 `claudeTimeoutRetry`·`claudeWarm` 시험과 같은 **가짜 CLI(`CLAUDE_CLI_PATH` 실행 파일)**. 시스템 프롬프트 `CFG:<json>` 로 stdout/stderr 바이트·조각 크기·종료코드를 받아 조각 사이 4ms 를 두고 파이프로 흘린다 → 어댑터의 `data` 이벤트 경로 그대로. 라이브 LLM·서버·DB 없음.
- 표본: `훨씬 많이 しゃべりましょう 😀 café 🎌 終わり` (3바이트·4바이트·2바이트 글자 혼합).
- 케이스: ① text 출력 1바이트·2바이트 조각 ② stream-json+`onTextDelta`(delta 목록 deepEqual·result·`onEvent` 에 U+FFFD 없음) 1·2바이트 ③ stderr(비정상 종료 `ClaudeCliExecError` 메시지) 1·2바이트 ④ 예열 HIT 경로(대기 프로세스를 꺼낸 뒤 1바이트 조각) ⑤ 끝이 잘린 stdout → `abc�` (조각 1·2·100 모두 같다) ⑥ 끝이 잘린 stderr → `…エラー�`.
- 수정 전: 9건 전부 fail(깨진 글자 확인). 수정 후: 9/9 pass, 연속 3회 모두 통과(조각 합쳐짐으로 인한 불안정 없음).
- 변이 확인(미러 파일만 바꾸고 NFS 로 재동기화해 복구, 복구 후 `diff` 동일 확인) — 모두 시험이 잡음:
  1. stdout 디코더 제거(`d.toString`) → 6 fail(1·2바이트 text, 1·2바이트 stream-json, 예열 HIT, 끝 잘린 stdout)
  2. stdout `end()` 비우기 제거 → 1 fail(끝 잘린 stdout)
  3. stderr 만 조각 단위 디코딩 유지 → 3 fail(stderr 1·2바이트 + 끝 잘린 stderr)
  4. stderr `end()` 비우기 제거 → 1 fail(끝 잘린 stderr)

## 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev064cli`, NFS 원본 sync 후)
- `tsc --noEmit` → exit 0, 출력 없음.
- `eslint src` → exit 0, `✖ 5 problems (0 errors, 5 warnings)` — 기존 파일 경고 5건(`claudeCli.ts`·새 시험 파일 경고 0).
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/modules/engine -name '*.test.ts' | sort)` → exit 0, `# tests 180 / # pass 180 / # fail 0` (새 9건 포함, 기존 171건 회귀 없음).
- `next build > 로그 2>&1` → exit 0, `✓ Compiled successfully in 6.3s`. 경고 3건은 기존(`Dynamic filesystem access` — `persona/loader.ts`·`claudeCli.ts` 등).
- 전체 tsc/build 가 다른 에이전트의 미완성 파일 때문에 깨지지는 않았다(미러에 NFS 현재 `src/` 전체가 들어간 상태에서 통과).

## 영향 범위
- `engine/llm/index.ts`(→ `claudeCli.provider`) 가 이 어댑터의 유일한 소비자이므로 **Claude CLI 를 거치는 모든 LLM 호출**(회화 턴·채팅·교정·복습 판단·레슨·평가·질문 답변·단어 보강 등)의 stdout/stderr 디코딩이 바뀐다. cold·예열(`runWarm`) 경로가 같은 `collect()` 를 쓰므로 둘 다 적용된다. 스트리밍 `feed`(NDJSON 줄 버퍼)와 `onTextDelta`·`onEvent` 로 흘러가는 문자열도 이제 글자 단위로 온전하다.
- 정상 출력(깨지지 않던 경우)의 결과는 바뀌지 않는다 — 디코딩 결과가 같고 `end()` 는 빈 문자열이다.

## 남은 의문
1. **`claudeWarmPool.ts` 139·142줄**에 같은 패턴이 있다: `e.stdout += d.toString('utf8')`(최대 64,000자)·`e.stderr += …`(8,000자). 예열 프로세스가 **꺼내지기 전에** 낸 출력만 조각 단위로 디코딩해 `initial.stdout` 문자열로 넘긴다. 예열 프로세스는 요청 전에는 `system init` 류 이벤트 정도만 내므로 실제 영향 가능성은 낮지만(멀티바이트가 들어갈 여지는 경로·도구 이름 정도), 이번 task 쓰기 범위(`claudeCli.ts` 와 그 시험)를 벗어나 **고치지 않았다**. 고치려면 풀에도 `StringDecoder` 를 두고 `take()` 시점에 `end()` 를 불러야 한다(풀↔collect 경계에서 글자가 갈리는 건 사실상 불가능 — 풀이 떼어진 뒤에야 요청이 들어간다). Leader 결정 필요.
2. 라이브에서 깨졌던 90호출 중 1건이 이 경로였다는 것은 **[가능성 높음]** 이지 라이브 재현으로 확인한 것이 아니다(라이브 호출 금지). 조각 경계 시험이 같은 증상(「�」 연속)을 재현·해소했다는 것까지가 확인된 사실이다. 수정 후 라이브 재측정에서 U+FFFD 0건인지 보는 것이 최종 확인이다.
3. 이 task 의 실행은 조각 사이 4ms 간격에 의존한다 — 이 간격에서 읽기 쪽이 조각을 합쳐 읽으면 시험이 "통과해야 할 것을 우연히 통과"할 수 있다(거짓 통과 방향). 수정 전 코드에서 9건이 모두 fail 이었고 변이 4종이 모두 잡혔으므로 실효성은 확인했지만, 극단적으로 느린 CI 에서는 이론상 약해질 수 있다.

## 미커밋 파일
- `src/modules/engine/adapters/llm/claudeCli.ts` (수정)
- `src/modules/engine/__tests__/claudeUtf8Chunks.test.ts` (신규)
- `agent-vault/10-Flow/tasks/task-064-dev-cli-record.md` (이 기록, 신규)
- 커밋·push·`git add` 는 하지 않았다(Leader).
