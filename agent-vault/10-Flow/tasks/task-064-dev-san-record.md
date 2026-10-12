---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-san
---
# task-064 answerMd 살균 보강(dev-san) — Developer 기록

> 상위: [[task-064-ask-anything-3a]] · 발견: [[task-064-rev-s-record]] REV-064-S1 [Medium]. 정본 `docs/design/api-contract.md` §2-18-A 8항(HTML 태그·마크다운 링크/이미지·스킴 URL·제어 문자 제거).
> 쓰기 범위: `src/modules/conversation/prompts/askResponse.ts`(`sanitizeAskAnswerMd` 구역만) + 새 시험 `src/modules/conversation/__tests__/askSanitize.test.ts`. 프롬프트 텍스트·오케스트레이터·화면·docs 는 안 만졌다.
> 전용 미러 `~/.node-local/thekaiwa-dev064san`(`KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` + predeploy `node_modules` `cp -al`).

## 원인 (실측)

- ① 태그 제거 정규식이 **단일 패스** → `<<<b>b>script>` 류가 지운 뒤 `<script>` 로 재조립(옛 코드로 2중 중첩부터 재현). ② `[^>\n]` 가 줄바꿈을 못 잡아 `<img src=x⏎onerror=…>` 잔존.
- 같은 결함이 링크(`[[x](javascript:…)](…)` → `[x]()`)·스킴 쪼개기(``java`script:`` 은 백틱 제거가 **스킴 삭제 뒤**라 재조립)에도 있었다.
- **추가 발견(요청 밖이지만 같은 함수의 선형 요구)**: 옛 구현은 `'a'×20만` 한 줄에 **20.4초**(URL 정규식 `[a-z][a-z0-9+.-]*:\/\/` 의 이차 역추적). `[ \t]+$`(긴 공백 열)·제목 정규식 `.+?\s*#*\s*$`·링크 `\[[^\]\n]*\]` 도 이차였다.

## 구현 (`askResponse.ts`)

- `sanitizeAskAnswerMd` = **고정점까지 `sanitizePass` 반복**(상한 `SANITIZE_MAX_PASSES=16`, 정상 글은 2패스). 상한까지 안 끝나면 `hardStrip`(태그 시작 문자 앞 `<` **연속열 통째** + `]` 뒤 `(` 연속열)으로 지우고 한 번 더 돈다 — 그래도 안 끝나면(도달 불가에 가깝다) `<`·`[`·`]`·백틱을 버리고 스킴을 마지막으로 지운다. 선택 인자 `opts.maxPasses` 는 상한 경로 시험용 이음매(호출처는 안 씀).
- 패스 순서: 제어/서식 문자 → `�` → **`stripHtml`** → **`stripMdLinks`**(한 패스 안 32겹까지 반복 — 바깥 링크 주소부를 스킴 삭제가 먼저 갉아 `)` 가 남는 것 방지) → **`stripUrls`**(스킴 정규식 · `://` 수동 스캔 · `www.`) → 줄 단위 서식 변환(제목·표·목록·펜스·구분선) → 인라인 코드·`__굵게__`·빈 줄 정리.
- `stripHtml`(선형): `<` + **영문자·`/`·`!`·`?`** 만 태그 시작. `>` 까지 **줄바꿈 포함**, 속성 값(`=` 바로 뒤 따옴표) 안의 `>` 는 끝이 아님, `<!-- -->` 주석, `<br>` 은 줄바꿈. `lastIndexOf('>')`·"다음 `>` 거리 > 2,000자" 로 끝이 없는 태그를 O(1) 에 판정(같은 곳을 다시 훑지 않음).
- **태그를 포기하는 조건(정상 글 보호)**: `>` 가 없거나 2,000자보다 멀거나, 가는 길에 **빈 줄** 또는 **줄 머리 `> `(공백이 따르는 인용·예문 표지)** 를 만나면 불완전 태그로 보고 `<` **연속열만** 지운다(글자는 남음). 안 그러면 글 한가운데 `a<b` 하나가 뒤의 설명과 예문 블록(`> 窓が…`)을 첫 `>` 까지 통째로 지운다(Leader 지시 `[\s\S]` 를 그대로 쓰면 생기는 부작용 — 아래 "열린 의문" 1).
- 이차 폭주 제거: `[ \t]+$` → `trimEndBlank`(수동), 제목 → `headingInner`(수동 꼬리 떼기), 링크 → `](` 기준 역탐색 + 주소부 `urlTailEnd`(한 단계 중첩 괄호, 옛 정규식과 같은 문법), `://` → `://` 기준 역탐색(영문자로 시작하는 스킴 열).

## 허용 기준 (정상 글 보존) — 시험으로 고정

| 입력 | 결과 |
|---|---|
| `> 昨日は雨でした。` / `> → 어제는…`(인용·예문), `**굵게**`·`*기울임*`·`- 목록`, `「N5: 食べる」`, `N5: 기본 문형`, `metadata:`·`profile:` | **그대로** |
| `3 < 5 이고 7 > 4`, `a>b`, `x <= y`, `3<5`, `→ A > B`, `1 < 2 > 0`, `<-`·`->`, `< script>`(공백) | **그대로**(`<` 뒤가 글자가 아니면 글자다) |
| `a<b 설명⏎> 窓が…`, `a<b 설명⏎⏎… x > y` | `ab 설명…` — **`<` 만** 지움, 뒤 글·예문 유지 |
| `a<b`(뒤에 `>` 없음) | `ab`(`<` 만) — **영문자가 바로 붙은 `<` 는 태그 시작 후보**라는 한계(옛 구현도 `>` 가 같은 줄에 있으면 `a<b c>d` 를 `ad` 로 지움) |
| `data:`/`file:`/`javascript:` 로 시작하는 낱말(`data: 숫자`) | 옛 동작 그대로 **지워진다**(스킴 규칙 — 변경 안 함) |
| 스킴 꼬리 | 공백·`)`·`」`·`』` 에서 끝남 → `javascript:alert(1)` 은 `)` 한 글자가 남는다(옛 동작 그대로, 무해) |

## 시험 (먼저 작성 → 옛 코드에서 실패 확인 → 구현)

- 새 `askSanitize.test.ts` **23건**. 옛 구현에서 22건 중 **15건 실패**(나머지 7건은 보존·회귀 가드; 이후 1건 추가) → 구현 후 23/23.
  - 중첩 태그 1·2·3·5·9겹, `parseAskResponse` → 2차 살균(멱등), 줄바꿈 태그, 속성 안 `>`(`"`·`'`), 불완전 태그(`<scr`·`<img … onerror` 꼬리 없음·`</`·`<!doctype`·`<?php`), 대소문자·`<SCRIPT⏎>`·`<script/x>`·ZWSP/NUL 끼움·`<svg/onload>`·`<br>` 변형, `< script`(보존), 빈 줄·줄 머리 `> ` 포기
  - 중첩 링크 1·2·5·9겹(`javascript:`·`data:`), 이미지·배지·중첩 이미지, 스킴 4종·대소문자·`://`·`www.`·태그/백틱/ZWSP 로 쪼갠 조각, 제목 `**` 제거로 `](` 재결합
  - 제어·BiDi·영폭·BOM·소프트 하이픈·`�`
  - 보존 3건(인용·예문·서식·콜론 글 / 부등호 일상 글 / 서식 변환)
  - **성질 시험** 5,000개 무작위 조각 조합(결정적 LCG): 위험 표지 0 + 멱등
  - 상한: 깊이 40·200·50,000, 링크 600겹(= 512겹 상한 초과), `maxPasses:1` 강제 경로, 상한 뒤에도 `[1]`·`(괄호)`·코드가 살아 있음(블런트 폴백이 아니라 `hardStrip` 으로 끝났다는 증거)
  - **20만 자 56종**(선형): 각 2초 이내 + 정확한 기대값이 있는 것은 정확 일치 + 위험 표지 0 + 멱등. 전체 **0.3초**(옛 코드는 첫 케이스 하나가 20.4초)
- **변이 11건 전부 사망**(미러 사본에만 적용 후 복원): 고정점 반복 제거(10건 실패) · 줄바꿈 든 태그 제외(4) · `hardStrip` 제거(1) · 따옴표 인식 제거(1) · `[ \t]+$` 정규식 복원(1) · 불완전 태그 `<` 유지(5) · 링크 내부 반복 제거(1) · 공백 뒤 `<` 도 태그(4) · 줄 머리 `> ` 포기 제거(1) · 빈 줄 포기 제거(1) · `://` 정규식 복원(1). 처음에 살아남은 2건(`hardStrip` 제거 — 블런트 폴백이 가려줌, 빈 줄 포기 제거 — 줄 머리 `> ` 규칙이 가려줌)은 가려지지 않는 시험을 추가해 잡았다.

## 실행 증빙 (전용 미러, NFS 원본 sync 직후)

- `./node_modules/.bin/tsc --noEmit` → exit 0
- `./node_modules/.bin/eslint src` → exit 0 (경고 5건은 이번 변경 밖 — `admin/trace/DiagnosticsScreen`·`settings/{Learning,OnDeviceDiagnosticsCard,Speech,Voice}Settings` 의 `react-hooks/set-state-in-effect`)
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/modules/conversation -name '*.test.ts' | sort)` → **1,139건 통과 · 실패 0**(기존 `ask.test.ts` **47/47**, `askTurn.test.ts` **21/21**, `askApi` 15/15, `askRouteGuard` 9/9 회귀 없음 + 새 23)
- `./node_modules/.bin/next build > log 2>&1` → exit 0

## 클라이언트 `src/components/ask/answerMd.ts` (고치지 않음 — 별도 감사)

`sanitizeAnswerText` 에 **같은 결함이 있다**(읽기·실측만): 태그 `/<\/?[A-Za-z!][^>\n]*>/g` 단일 패스 → `<<<b>b>script>alert(1)</b>` → `<<b>script>alert(1)` 잔존, `<img src=x⏎onerror=alert(1)>` 그대로 남음, `[[x](javascript:alert(1))](…)` → `[x]()`, `java<b>script:alert(1)` → `)`; `URL_LIKE` 가 `'a'×20만` 에 **21.7초**(이차). 화면은 결과를 React 텍스트 노드로만 그리고(`dangerouslySetInnerHTML`·`innerHTML` 0건 grep) 입력은 서버가 4,000자 이하로 저장한 값이라 실제 위험은 낮다 — 다만 "서버를 우회한 값 대비" 두 번째 방어선 주석과 실제 성능이 어긋난다. 필요하면 서버 구현(`stripHtml`·`stripMdLinks`·`stripAuthorityUrls`)을 공용으로 옮겨 쓰는 후속 task 를 권한다.

## 열린 의문 (Leader/Reviewer 판단)

1. **태그 포기 조건(빈 줄·줄 머리 `> `·2,000자)은 지시(`[\s\S]` = 줄바꿈 무제한)에서 벗어난 설계 판단**이다. 근거: 무제한이면 `a<b` 하나 뒤의 모든 글이 첫 `>`(예: 예문 줄의 `> `)까지 지워진다. 대가: 공격 모양 `<img src=x⏎⏎onerror=…>`(빈 줄 낀 태그)는 태그로 못 알아보고 `<` 만 지워 `img src=x⏎⏎onerror=…>` 글자가 남는다(`<` 가 없으니 태그가 아니다, 위험 표지 검사 통과). 무제한을 원하면 `scanTag` 의 두 `return -1` 조건 제거(시험 `살균(태그): 글 한가운데…` 만 바뀜).
2. 영문자가 바로 붙은 `a<b` 는 `>` 가 없으면 `<` 만 지워 `ab` 가 된다. 수식 모양 글(`x<y`)은 ASK 의 한국어 설명에서 드물다고 보고 수용했다.
3. 겹친 링크 32겹×패스 16회(= 512겹)를 넘는 입력은 `hardStrip` 이 `](` 의 `(` 를 떼어 링크 문법만 끊는다(바깥 `)` 가 남을 수 있음).

## 변경 파일 (커밋·`git add` 안 함)

- `src/modules/conversation/prompts/askResponse.ts` (`sanitizeAskAnswerMd` 구역 교체 — 파일은 저장소에 미추적 상태)
- `src/modules/conversation/__tests__/askSanitize.test.ts` (신규)
- `agent-vault/10-Flow/tasks/task-064-dev-san-record.md` (이 파일)
