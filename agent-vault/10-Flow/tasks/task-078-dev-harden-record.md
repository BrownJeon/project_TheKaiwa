---
task_id: task-078
role: developer
tags:
  - type/task-record
  - domain/challenge
  - domain/prompt
aliases:
  - task-078 developer 보강 기록
  - dev-078-harden
updated: 2026-10-20
---
# task-078 developer 보강 — REV-078 F-1·F-4 시험 + F-3·F-5 주석 (dev-078-harden)

상위 이력서: [[task-078-improve-topic-words-level-yield]] · 감사 [[task-078-reviewer-record]](F-1·F-3·F-4·F-5, 항목 6 변이 표) · 앞 구현 [[task-078-dev-record]]
미러 `~/.node-local/thekaiwa-dev078`(작업 전 `mirror-audit.sh --check` 종료 0 · 공유 파일 0) · 스크래치 `…/scratchpad/dev-078-harden/` · **라이브 LLM 호출 0회**(하네스 실행·import 없음).

## 결과 한 줄
**DONE** — 시험 2개 추가 + 기존 시험 2곳 강화. 감사 생존 변이 6개(P1~P5·M6) **6/6 포착**, 기존 포착 9개도 그대로 포착(15/15), 추가 탐침 6개 6/6 포착. `SYSTEM_PROMPT` sha256 전후 동일. 소스 변경은 시험·주석뿐(화면·프롬프트 문구·검사 로직 0).

## 바꾼 파일 (전부 미커밋)
| 파일 | 변경 |
|---|---|
| `src/modules/conversation/__tests__/topicWords.test.ts` | 새 시험 1개(F-1) · 길이 상한 근거 주석 1줄(F-3) |
| `src/components/challenge/__tests__/level078.test.ts` | `liveRegion()` 를 짝 `</div>`(중첩 카운트)까지 자르고 «감싸개 뒤 fieldset 끝까지 빈 글» 단언 · 새 렌더 시험 1개 · ③ 배선 시험에 소스 단언 1개(F-4) |
| `src/modules/conversation/prompts/topicWords.ts` | v3 주석 2줄만(F-3) — `SYSTEM_PROMPT` 문자열 불변 |
| `tests/prompts/topic-words-level-live.ts` | 머리 주석 1줄(F-5) — 코드 변경 0 |

## 추가·강화한 시험
| 시험 | 고정하는 것 | 기대값 출처 |
|---|---|---|
| `system 프롬프트 v3 문구 고정(task-078, REV-078 F-1)` (topicWords.test.ts, 기존 system 시험 바로 뒤) | ① 줄 뼈대 17줄의 시작 글(`[모드]`·`[지시]`·`- 주제 안에서`·`- 난이도:`·…·`[출력]`) ② `[지시]` 줄 «[수준]에서 배울 만한 것» ③ `- 난이도:` 줄 하나 + «카드의 절반 이상은 급수가 [수준]인 표현으로 고르고»·«[수준]보다 두 단계 이상 쉬운 기초어는 내지 않습니다»·«N5·N4 기초어는 제외»·«난이도를 맞추려고 주제 밖 단어를 내지는 않습니다» ④ `- jlpt:` 줄 하나 + «N5 → N5·N4, N2 → N3·N2·N1»·«이 범위 밖 급수는 내지 않습니다»·«실제 급수를 쓰고 [수준]에 맞추려고 바꾸지 않습니다»·«모르면 null», system 전체에 v2 «그보다 어려운 단어는 내지 않습니다» 없음 ⑤ L5 «주제 밖 단어와» ⑥ **null 화이트리스트**: `[출력]` 줄을 뺀 모든 줄의 문장 중 null 을 말하는 문장 = «급수를 확신할 때만 N5~N1 로 쓰고, 모르면 null(따옴표 없는 JSON null)입니다.» 하나뿐, `[출력]` 줄의 null = «"jlpt":"N5"(또는 null)» 한 곳, 권유 정규식 3개(`맞지 않으면 null`·`애매하면 null`·`null 로 쓰/내/달/표시`) 불일치 ⑦ `[출력]` 예시 키 순서 = 스키마 required 순서 | 손으로 옮긴 글(`SYSTEM_PROMPT` import 안 함, `buildTopicWordsRequest(...).system` 으로 얻음) |
| `② 렌더: 상자는 감싸개 «안»` (level078.test.ts) | 고른 N2·주제 N4 — 짝 `</div>` 안에 상자·글, 그 뒤 글 없음 | 손으로 옮긴 `NOTE` |
| `liveRegion()` 강화(②의 모든 렌더 시험에 적용) | 감싸개 = 여는 `<div aria-live="polite">` ~ 짝 `</div>`, 그 뒤 `</fieldset>` 까지 빈 글(§35-5 «감싸개가 fieldset 의 마지막 자식») | §35-5 마크업 |
| ③ 배선 소스 단언 | `{CREATE.wordsNoteHigh}` 와 그 뒤 첫 `</fieldset>` 사이 닫는 `</div>` 정확히 1개 | §35-5 마크업 |

- 입력 블록 5줄·스키마 8키·required 순서는 **이미 있는 시험**(빌더 30케이스·`TOPIC_WORDS_SCHEMA` 시험·기존 system 시험)이 고정하므로 새로 만들지 않았다. `[출력]` 줄 키 순서만 기존 시험이 없어 새 시험 안에 한 줄 넣었다.

## 변이 결과 (미러, 임시 파일 + `rename` 으로 바꾸고 같은 방식으로 원복, 4파일 = level078·level076·level076View·topicWords)
정의는 reviewer `rev-078/mutate.mjs` 를 읽어 그대로 옮긴 `dev-078-harden/mutate.mjs`(+탐침 `mutate-x.mjs`).
| 변이 | 감사 때 | 지금 | 잡은 단언 |
|---|---|---|---|
| **P1** `- 난이도:` 줄 삭제 | 생존 | **포착** | 줄 뼈대 «system 은 17줄: 16» |
| **P2** `jlpt` 줄 v2 문구로 | 생존 | **포착** | jlpt 줄 «N5 → N5·N4, N2 → N3·N2·N1» |
| **P3** «주제 밖 단어와» 삭제 | 생존 | **포착** | «L5: 주제 밖 단어 금지 유지» |
| **P4** jlpt 줄에 «애매하면 null 로 쓰세요» | 생존 | **포착** | null 문장 화이트리스트 deepEqual |
| **P5** `[지시]` 의 `[수준]` 삭제 | 생존 | **포착** | «[지시]: 단어를 고르는 기준에 [수준]» |
| **M6** `InfoBox` 를 감싸개 밖으로 | 생존 | **포착(7건)** | «감싸개가 fieldset 의 마지막 자식» + 새 렌더 시험 + 소스 단언 |
| M1·M2·M3·M4·M5·M7·M8·M9·M10 | 포착 | 포착(2·10·6·5·9·2·9·3·9건) | `liveRegion` 변경으로 약해진 곳 없음 |
| 탐침 X1 난이도 줄에 «…jlpt 를 null 로 둡니다» | — | 포착 | null 화이트리스트 |
| 탐침 X2 jlpt 줄 끝에 «범위 밖이면 null.» | — | 포착 | null 화이트리스트 |
| 탐침 X3 «절반 이상은» → «일부는» | — | 포착 | 난이도 줄 문구 |
| 탐침 X4 «난이도를 맞추려고 주제 밖 단어를…» 삭제 | — | 포착 | 난이도 줄 문구 |
| 탐침 X5 `[출력]` «(또는 null)» → «(애매하면 null)» | — | 포착 | `[출력]` 예시 문구 |
| 탐침 X6 jlpt 줄에 v2 문장 덧붙임 | — | 포착 | «v2 문구가 돌아오지 않는다» |
- 원복 확인: 변이 대상 4파일(`ChallengeCreateScreen.tsx`·`logic.ts`·`challengeCopy.ts`·`topicWords.ts`) 미러 = NFS `cmp` 동일, 임시 파일(`*.dev078hardentmp`) 0개.

## SYSTEM_PROMPT 불변 (PE 측정 문구와 바이트 동일 유지)
| 시점 | sha256(`buildTopicWordsRequest(...).system`) | 길이 | 줄 |
|---|---|---|---|
| 편집 전(NFS→미러 동기 직후) | `04e53de418403bdb38b54f71abb49db220fce5a62db2eb50311a915bd1b1755c` | 1,943 | 17 |
| 편집 후 | `04e53de418403bdb38b54f71abb49db220fce5a62db2eb50311a915bd1b1755c` | 1,943 | 17 |
- 입력(N2 주말 계획 / N5 카페 주문·제외 1개)이 달라도 system 은 같다(편집 전 확인). `git diff HEAD` 의 비주석 줄은 PE 가 바꾼 4줄(버전·`[지시]`·난이도·jlpt) 그대로이고 이번 편집은 `*` 주석 줄뿐.

## 주석 내용 (F-3·F-5)
- `topicWords.ts` v3 주석 2줄 추가: «늘어난 것은 통과 장수이고 난이도는 거의 안 움직였다: N2 호출의 사전 대조 급수 이동 −0.38(완전 이동이면 −2), N2 통과의 86% 가 N3 급 라벨, 합격 여유는 요청 100장 중 1장(통과 81 vs 합격선 80)» · «측정 조건 한정: 첫날(제외 = 기본 표현 12개)·단일 주제 weekend-plan·단일 모델 haiku — 깊은 체인·다른 주제·다른 모델은 v3 로 재지 않았다».
- `topicWords.test.ts` 상한 근거 1줄: 측정한 프롬프트는 첫날 조건 **3,134~3,147자**뿐(이번에 픽스처 weekend-plan × N2/N3/N5/N4 × variant 0~7 로 오프라인 계산, 호출 없음) — `NORMAL_PROMPT_MAX` 3,817 도 그보다 길고 `FULL_EXCLUDE_PROMPT_MAX` 5,317(깊은 체인)은 측정 범위 밖(+317자 ≈ +6% 증분으로 미루어 본 상한).
- 하네스 머리 1줄: «v3 반영 뒤 `ARM=base` = 현재 운영(`topicWords@v3`) — 진단의 v2 기준선은 이 도구로 재현되지 않고 진단 결과 JSON 에만 있다».

## 실행 증빙 (미러 `~/.node-local/thekaiwa-dev078`)
| 명령 | 결과 |
|---|---|
| `KAIWA_LOCAL_ROOT=…/thekaiwa-dev078 bash scripts/sync-local.sh` | 종료 0, 바꾼 4파일 미러 = NFS `cmp` 동일 |
| 관련 4파일 `node --import tsx --test --test-concurrency=1 level078 level076 level076View topicWords` | **146/146 통과**(감사 기준선 144 + 새 시험 2) |
| 전체 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)` → `scratchpad/dev-078-harden/all.log` | 종료 0 · **tests 4,537 · pass 4,534 · fail 0 · skipped 3**(앞 구현 4,535 + 2) · 155초 |
| `node node_modules/typescript/bin/tsc --noEmit` | 종료 0 · 출력 0줄 |
| `node node_modules/eslint/bin/eslint.js` 바꾼 4파일 | 종료 0 · 출력 0 |
| `node node_modules/next/dist/bin/next build` → `build.log` | 종료 0 · Compiled successfully · 정적 21/21 · Turbopack 경고 3건(`persona/loader.ts` 동적 파일 접근 — 앞 구현 빌드 `dev-078-impl/build.log` 와 같은 3건, 이번 변경과 무관) |
| 변이 `mutate.mjs`(15) + `mutate-x.mjs`(6) | 21/21 포착 · 원복 `cmp` 동일 · 임시 파일 0 |
| 라이브 LLM | 0회(하네스 실행·import 없음 — sha·길이 계산 스크립트는 `topicWords.ts`·`engine/llm`·`schemaValidate` 만 import) |

## §35 와 어긋난 곳
- 없음. 새 단언(«감싸개 = fieldset 의 마지막 자식»·«상자와 `</fieldset>` 사이 `</div>` 1개»)은 §35-5 «바뀐 뒤» 마크업 그대로다. 화면 파일은 고치지 않았다(데모 게이트 `check` → `DEMO_GATE_PASSED`, approved v1 — 시험 파일이 `src/components/**` 라 확인함).

## 알아 둘 것
- 새 F-1 시험은 **문구를 고정**한다 — PE 가 v4 로 문구를 바꾸면 이 시험이 실패하는 것이 의도다(다시 재고 기대 글을 고친다). 줄 뼈대(17줄)도 고정하므로 줄을 더하거나 빼도 실패한다.
- null 화이트리스트는 문장을 «`.` 뒤 공백» 으로 나눈다 — 마침표 없이 이어 쓴 null 권유(예: 쉼표로 붙임)는 그 문장 안에 묻혀 «허용 문장과 글이 달라짐» 으로 잡힌다(deepEqual 이 문장 전체를 비교).
- `liveRegion()` 의 짝 찾기는 `<div`/`</div>` 만 센다 — 감싸개 태그를 `section` 등으로 바꾸면 «감싸개 `<div aria-live="polite">` 가 있다» 에서 먼저 실패한다.
- 이번 범위 밖(손대지 않음): 감사 F-2(결과 편향 — 결함 아님, 사용자 보고 몫)·F-6(최종 요약 서술)·F-7·F-8. F-5 의 설계서 A12 행은 Leader 가 이미 정정했다(일일 로그 10-20), 이번엔 하네스 머리 한 줄만.
