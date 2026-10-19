---
task_id: task-078
role: developer
tags:
  - type/task-record
  - domain/challenge
  - domain/prompt
aliases:
  - task-078 developer 기록
updated: 2026-10-20
---
# task-078 developer — 챌린지 만들기 ③ 「새 단어 안내」 상자 + `topicWords@v3` 시험 갱신 (dev-078-impl)

상위 이력서: [[task-078-improve-topic-words-level-yield]] · 구현 정본 `docs/screens.md` §35(승인 데모 v1, 「질문 1~4 ★대로 승인」) · Leader 결정 L8 · PE 기록 [[task-078-pe-improve-record]] §5

## 한 줄 요약
§35 그대로 구현했다 — `wordsLevelNote`(주제보다 2단계 이상 어려우면 `{ steps }`) · 문구 상수 `CREATE.wordsNoteHigh` · `GoalStep` 기존 안내 줄의 `aria-live` 를 클래스 없는 `div` 감싸개로 올리고 그 안에 조건부 `InfoBox`. 서버 쪽은 `topicWords.test.ts` 의 깨진 8건을 v3 로 갱신(버전 단언·길이 상한 +317자). 라이브 LLM 호출 0회. **전체 시험 4,535(통과 4,532·실패 0·건너뜀 3)·tsc 0·eslint 0·build 0·변이 8/8 포착.**

## 불편한 사실 · 알아 둘 것 (먼저)
- **§35 와 어긋난 곳 없음**(구현·시험 모두 35-3·35-4·35-5·35-8 표대로). 채택 안 한 안(방향 필드·단어 목표 조건·쉬운 쪽 문구·`role="note"`·`aria-atomic`·`hidden` 토글)의 분기는 만들지 않았다.
- **길이 상한은 «+317자» 를 글자 그대로 더했다**: 정상 입력 3,500 → **3,817**, 제외 목록 상한까지 찬 입력 5,000 → **5,317**, system `< 1,700` → **`< 2,000`**(Leader 지정값). 실측 v3 = system 1,943 · 정상 3,090~3,695 · tw21 5,067 이라 여유는 각각 57 · 122 · 250자다. PE 가 제안한 더 촘촘한 값(3,700·5,100)이 아니라 Leader L8 문구(«+317자 만큼»)를 따랐고, 상수 `V3_SYSTEM_GROWTH = 317` 로 유도 근거를 코드에 남겼다 — 촘촘하게 바꾸려면 상수 두 줄만 고치면 된다(Reviewer 판단).
- 지연 근거 주석은 이력서·브리프 값 **p95 11.84초**를 적었다. PE 기록 본문에는 11.86초로 적힌 곳도 있다(§0-6·§2.4) — 둘 다 A12 한도 20초 아래라 판정 영향 없음.
- `GoalStep` 안 주석(:346 의 JSX 주석)에 §35-5 가 말한 한 마디 외에 «atomic 아님(기존 줄만 바뀌면 상자는 다시 읽지 않는다)» 를 덧붙였다 — 숨은 제약(WHY)이라 남겼다.
- `npm run build` 스크립트는 `cd $HOME/.node-local/thekaiwa`(메인 미러)로 가므로 쓰지 않고 dev078 미러에서 `next build` 를 직접 실행했다.
- 브리프 «변경 파일 수» 기준: 이번 소환이 고친 파일 7개(새 파일 1 포함). 운영 프롬프트 `topicWords.ts` 는 PE 가 이미 고친 상태 그대로이고 손대지 않았다.

## 변경 파일
| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/challenge/logic.ts` | 수정 +8 | `WordsLevelNote` 타입 · `wordsLevelNote(sel, topicLevel)` (`levelHintText` 바로 아래, JSDoc 한 줄 = §35-4 문장) |
| `src/components/challenge/challengeCopy.ts` | 수정 +2 | `CREATE.wordsNoteHigh` = 「이 주제보다 많이 어려운 난이도라, 새 단어가 모자란 날은 주제 표현으로 채워요.」(45자, `levelLow` 바로 다음, 문자열 상수) |
| `src/components/challenge/ChallengeCreateScreen.tsx` | 수정 | `./logic` import 에 `wordsLevelNote` · `const wordsNote = wordsLevelNote(sel, topic.level)` · 기존 `p` 의 `aria-live` 를 `<div aria-live="polite">` 감싸개로 올림(`p` 클래스·글 그대로) + `{wordsNote ? <InfoBox className="mt-2">{CREATE.wordsNoteHigh}</InfoBox> : null}` · :346 주석 덧붙임 |
| `src/components/challenge/__tests__/level078.test.ts` | **새** | 12개 시험 — ① 25칸 전수·반환 키 `steps` 하나 ② 렌더(live 영역 div 1개·순서·`InfoBox` 클래스·`mt-2`, 단어 목표 켬/끔 동일, 내 수준 null, 상자 없음 5조합 × 목표 켬/끔, 3·4단계, role·aria-atomic·경고색·`<svg`·`hidden` 없음) ③ 배선(소스: aria-live 1회·금지 role 없음·감싸개 < 상자 < 구분선, `wordsLevelNote(sel, topic.level)` 1회·그 줄에 `goal.`/`wordsBlocked`/`levelCtx` 없음·조건부 렌더 형태) ④ 문구(글자 그대로·45자·이름/코드/숫자/「세요」/엔진명 없음) |
| `src/components/challenge/__tests__/level076.test.ts` | 수정 1줄(:269) | 배선 정규식 → `<div aria-live="polite">\s*<p className="mt-1 [^"]*">\s*\{levelHintText(levelHint(sel, levelCtx.my))\}\s*</p>` (기대 뜻 그대로) |
| `src/components/challenge/__tests__/level076View.test.ts` | 수정 1줄(:56) | `hintText` 정규식 → `<div aria-live="polite"[^>]*><p[^>]*>(.*?)</p>` (:81~90 기대값 그대로) |
| `src/modules/conversation/__tests__/topicWords.test.ts` | 수정 | 머리 주석 v3 한 줄 · 상수 `V3_SYSTEM_GROWTH = 317`·`NORMAL_PROMPT_MAX`(3,817)·`FULL_EXCLUDE_PROMPT_MAX`(5,317) + 근거 주석(PE 실측 p95 11.84초 < A12 한도 20초 `engine/router/tasks.ts:42`, 문구 줄여 재측정 안 함 L8) · 버전 시험 이름·단언 `topicWords@v3` · 빌더 시험(tw01~tw30 의 길이 단언) 상한 상수로 · «프롬프트 길이 실측 기록(v3)» 이름·설명(system ≈1.94K · 정상 3.09K~3.70K · 상한 ≈5.07K)·system `< 2_000` |

손대지 않음: `parts.tsx`(`InfoBox`) · `createParts.tsx` · 오늘 탭 · 서버·API·DB·prisma · `prompts/topicWords.ts`(PE v3 그대로) · 픽스처 · `docs/**`.

## 실행 증빙 (미러 `~/.node-local/thekaiwa-dev078`, `mirror-audit --check` 종료 0 · 노출 0)
| 명령 | 결과 |
|---|---|
| `KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-dev078 bash scripts/sync-local.sh` | 0 (변경 파일 8개 NFS↔미러 `cmp` 동일 확인) |
| `node node_modules/typescript/bin/tsc --noEmit` | **0** (출력 0줄) |
| `node node_modules/eslint/bin/eslint.js` 변경 7파일 + `prompts/topicWords.ts` | **0** |
| 관련 시험(challenge `__tests__/*` 8개 + `topicWords.test.ts`) | 179/179 통과 |
| **전체 시험** `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)` (361 파일) | **tests 4,535 · pass 4,532 · fail 0 · cancelled 0 · skipped 3** · 290.6초. 건너뜀 3 = 미러에서 docs/저장소가 안 보이는 환경 조건 시험(R5·T25 계약 대조 · #9 배포 manifest) — 기존과 같음 |
| `node node_modules/next/dist/bin/next build` (dev078 미러) | **종료 0** · `/plan/challenge/new` 포함 · Turbopack 경고 3건 = 기존과 같은 것(`persona/loader.ts` 2 · `claudeCli.ts` 1, 동적 파일 접근 추적 — 앞선 빌드 로그 `q053`·`q051b` 와 동일) |
| v3 프롬프트 길이 재측정(LLM 호출 0, 빌더만) | system 1,943 · 스키마 771(불변) · 정상 3,090~3,695(3,500 초과 = tw11 3,694·tw12 3,691·tw13 3,686·tw14 3,690·tw15 3,695) · tw21 5,067 — PE 기록 §5 와 일치 |

로그: 스크래치패드 `dev-078-impl/{tsc,eslint,targeted,all,build}.log` · `mutations.json`.

## 변이 (미러 파일을 임시 파일 + rename 으로 바꾸고 `level078`·`level076`·`level076View` 를 돌린 뒤 원본으로 되돌림 — 8개 모두 포착·복원, 복원 뒤 NFS 와 `cmp` 동일·임시 파일 0)
| 변이 | 실패 시험 수 | 잡은 시험 |
|---|---|---|
| M1 `d >= 2` → `d >= 1` | 2 | ① 25칸 · ② 상자 없음 조합 |
| M2 아래 방향도 보임(`Math.abs(d) >= 2`) | 2 | ① 25칸 · ② 상자 없음(쉬운 쪽 2·3단계) |
| M3 조건에 `goal.words` | 5 | ② 켬/끔·N2/N4·my null·3/4단계 · ③ 조건 줄 |
| M4 감싸개 제거(`p` 에 `aria-live` 복귀) | 9 | ②③ 전부 + task-076 배선(:269) · level076View 안내 줄(:56) |
| M5 감싸개에 `aria-atomic="true"` | 8 | ②③ + task-076 배선 |
| M6 기준을 내 수준으로(`levelCtx.my ?? topic.level`) | 2 | ② 3·4단계(my N4 · 주제 N5) · ③ 조건 줄 |
| M7 `hidden` 토글로 넣고 빼기 | 2 | ② 상자 없음 · ③ 조건부 렌더 형태 |
| M8 문구 쉼표 빠짐 | 4 | ②(글 대조 3) · ④ 글자 그대로 |

## 알려진 한계
- 렌더 시험은 정적 렌더(`renderToStaticMarkup(GoalStep)`)다 — 실제 TalkBack 낭독(한 번에 읽기·상자 재낭독 없음)·높이(63/75px)·130% 2줄은 QA 35-9 · 폰 35-10 몫(NOT_VERIFIED).
- 화면 본체 `ChallengeCreateScreen` 은 하이드레이션 뒤에만 본문을 그려 정적 렌더가 안 되므로 `GoalStep` 단위로만 본다(task-076 시험과 같은 한계).
- 서버 쪽은 시험 상한만 바꿨다 — v3 의 깊은 체인(제외 목록 상한) 지연·합격은 PE 가 미측정으로 남긴 그대로다.

## 체크포인트
- **완료**: §35 구현 3파일 · 새 시험 1 · task-076 정규식 2곳 · `topicWords.test.ts` 8건 갱신 · tsc/eslint/전체 시험/build · 변이 8 · 이 기록 · 이력서 상태 로그 한 줄 · 일일 로그 한 줄.
- **남은 일**: Reviewer 감사 → QA(35-9 대조표, 라이브 LLM 호출 없이) → 사용자 폰(35-10) → 배포는 사용자 승인 뒤.
- **미커밋 파일**: 위 «변경 파일» 7개 + 이 기록 + 이력서·일일 로그 한 줄(커밋·푸시 지시 없음).
