---
tags:
  - type/record
  - domain/vocab
  - domain/prompt
---
# task-073 Reviewer 기록 (REV-073)

> 상위: [[task-073-improve-word-add-copy]] · 구현 기록: [[task-073-dev-record]] (W-2) · [[task-073-pe-record]] (W-3) · 감사자: reviewer(sonnet) · 2026-10-16
> 방법: Read 전용 감사 + 전용 미러 `~/.node-local/thekaiwa-rev073`(증빙 재실행·실호출) + `~/.node-local/thekaiwa-rev073m`(변이 29개, 끝난 뒤 원복·`diff -rq` 0). 저장소 코드는 한 줄도 고치지 않았다.

## 판정

- **코드 판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 4. 사양 L1~L6 충족, 소유 구분·6층 경계·엔진명 비노출 이상 없음, 증빙 보고 수치와 일치, 실호출 14건 전부 통과, 변이 29개 중 28개 즉시 포착.
- **게이트 판정: BLOCKED** — `check.mjs check` 가 `DEMO_GATE_BLOCKED`(task-073 `demo_gate`: required true · level **delta** · status **drafting** · 승인/면제 기록 없음, `waiting: demo_review`). judge 가 15개 파일이라 standard 로 재판정하며 데모 수준을 delta 로 올렸고, 승인·면제 기록이 아직 없다. **내 역할 규정(데모 검토 게이트 §7)상 이 상태는 FAIL 사유**이며, 코드 결함이 아니라 **사용자 승인(delta 데모) 또는 사용자의 명시적 면제가 필요**하다는 뜻이다. 승격·데모·QA 여부는 Leader·사용자 결정이라 나는 코드·증빙만 판정했고(Leader 지시), 게이트가 풀리면(check PASS) 이 판정이 그대로 확정된다. `evidence.jsonl` 마지막 줄은 task-068 이고 task-073 줄은 없다 — 에이전트가 approve·waive 를 대신 실행하거나 `.claude/state/demo-gate/` 를 쓴 흔적 없음(승인된 데모가 없으므로 구현↔데모 차이 분류는 해당 없음).
- 이슈 요약 `{critical:0, high:0, medium:0, low:4}` · `native_change:false`(`plugins/**`·`android/**`·Manifest·`capacitor.config.ts` 무변경, 네이티브 고지·versionCode 해당 없음).

## 체크리스트 결과 (1~10)

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 문구 정확성 | PASS | `labels.ts:311-315` — `hint.surface` 「일본어 발음으로 말해 주세요 (예: インパクト). 칸에 들어간 뒤 고칠 수 있어요.」(L1 문장과 글자 그대로), `hint.example` 「일본어 발음으로 말해 주세요. 예문 끝에 이어 붙고, 칸에 들어간 뒤 고칠 수 있어요.」(같은 말투·예시 없음), `checkNotice` 「잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」. `WordMicField.tsx:141-145` — `<p role="status" className="text-[12px] text-ink2 break-keep">`. `grep -rniE "reazon\|sherpa\|whisper\|style-?bert\|claude\|haiku\|qwen" src/components/vocab`(시험 제외) 0건, diff 추가 줄 0건 |
| 2 | 안내 상태 전이 | PASS | 아래 전이표. 사용자가 직접 고치는 입력 3곳(시트 1단계 표현 `WordAddSheet.tsx:324`, 폼 `WordForm.tsx:91-93` → 표현 `input`·예문 `textarea` 두 곳)만 `edited` 를 부르고, 인식 결과 경로(`onResult` → `set`)는 부르지 않는다(변이 m7 포착). task-069 동작: 결과 반영 규칙(`applyMicToForm`)·바꿔 넣기/이어 붙이기(`MERGE`)·`WordDetailSheet` 무변경(git diff 0)·`WordForm` 의 `mic` 없는 경로는 `mic?.edited` 로 무동작이라 DOM 동일(변이 m8 포착) |
| 3 | 사양과 달라진 점 4개 | 수용 4/4 | 아래 별도 표 |
| 4 | 프롬프트 diff | PASS | `git diff -U2 -- wordEnrich.ts` — 상수 `INVALID_REASON_RULE` 1개 + `system` 배열 참조 1줄 + 주석·버전 라벨뿐. 본인 재계산: HEAD(v2) 파일을 미러에 임시로 올려 `buildWordEnrichRequest` 를 대조 → v3 에서 규칙 1줄을 빼면 **system 11줄·messages·persona·schema 가 v2 와 동일**(sha256 앞 12자 `c42c9fbf4b47` = `c42c9fbf4b47`), 임시 파일은 즉시 삭제. 규칙 문구가 L3 와 일치: 단정(「~가 아닙니다」·「~의 오타입니다」·「틀렸어요」) 금지, 「확인되지 않았어요」·「~처럼 보여요」 완화, 오타 추측 금지, 후보는 「단 하나로 분명할 때만」 같은 문장 안 질문형 한 번·확신 없으면 생략, 영어/한글 입력은 「일본어 표현으로 적어 주시면…」 안내, 한 문장 |
| 5 | 버전·레지스트리 | PASS | `WORD_ENRICH_PROMPT_VERSION` 사용처는 `conversation/index.ts` 재수출·시험·하네스뿐(`grep`), `package.json` 에 `prompts:sync` 없음(`ask.ts:385` 주석이 「만들어지면」), `prisma/seed.ts:98-107` 은 PromptTemplate **키 이름**만 예약(`update: {}`)이라 버전 값 무관 → **DB 쓰기·sync 필요 경로 없음**. 초안 캐시(`learning/vocab/enrich.ts`)는 프로세스 메모리(TTL 24h)라 blue/green 새 프로세스에서 비워져 옛 v2 이유 문장이 남지 않는다 |
| 6 | 시험·픽스처 변경 정당성 | PASS | 상한 2,000→2,400: 본인 재계산 렌더 합계 **2,215자**, 규칙 줄 **483자**, 규칙 뺀 값 **1,731자**(주석의 v2 1,731 과 일치) → 사유 사실. 대화(A1 3,000자·5초)가 아니라 단어 추가의 비실시간 경로라 예산 영향 없음, +483자는 haiku 호출 지연에 의미 있는 차이 없음(실호출 p50 2.85s). `word-enrich-chunk.json` — `passLine {25,22}`·`firstPass 24/25·21/22·5/5` 불변, baseline 라벨·날짜·`previousVersion`(v2 값 보존)만 갱신 → 통과율을 가리는 변경 아님. 검출기 직접 시험(12문장): 「일본어 단어가 아닙니다.」→negation+formal-end, 사례 원문→negation·typo·formal-end·2문장, 「~오타입니다」→typo, 「존재하지 않아요」·「없는 단어예요」→nonexistent, 「틀린/잘못된」→wrong, 「일본어가 아니에요」→negation 로 **검출**, 「일본어 단어로 확인되지 않았어요.」·「영어 단어로 보여서, … 확인할 수 있어요.」·「혹시 インパクト를 …걸까요?」는 **통과** |
| 7 | 실호출 재현 | PASS | 아래 표. 하네스 그대로 실행(`tests/prompts/word-enrich-invalid-live.ts`, `routerDeps.loadChain` 스텁 → DB 접촉 0). `CLAUDE_CLI_PATH` 한 변수만 `~/.node-local/thekaiwa/.env` 에서 환경으로 내보냄(값 미출력), `DATABASE_URL` 은 가짜, 결과·장부는 스크래치패드 |
| 8 | 소유 구분·경계 | PASS | `git diff --stat`: `src/components/**` 는 developer 8개뿐, `src/modules/conversation/**` 는 PE 2개(+새 시험 1)뿐, 교차 침범 0. `WordDetailSheet`·`enrich.ts`·`WordAddSheet` 의 `wordEnrich` 소비 흐름 불변(`WordAddSheet` diff 는 `onChange` 1곳). 하위→상위 import·`index.ts` 우회 추가 0, 새 fetch/spawn/`window.Capacitor` 0. 참고: 새 시험이 `tests/prompts/wordEnrichInvalidCheck.ts` 를 `src/**/__tests__` 에서 import(선례 `task039.test.ts`) — tsc·`next build` 통과 |
| 9 | 통합 시험 | PASS | 전체 4,152 / 통과 4,150 / 실패 0 / 건너뜀 2 — developer 가 본 `wordEnrichChunk` baseline 실패는 PE 완료로 해소됨 |
| 10 | 변이 점검 | PASS(1 생존) | 아래 표 — 29개 중 28개 포착, 1개 생존 |

## W-2 상태 전이표 (표현·예문 칸마다 따로 `MicNotices = {surface, example}`)

| 사건 | 해당 칸 안내 | 다른 칸 | 코드 |
|---|---|---|---|
| 인식 결과가 칸에 들어감(`apply`) | 켜짐 | 변화 없음 | `wordMic.ts:113-114` `micNoticeAfterFinal` ← `useWordMic.ts:58`(`onFinal` 의 empty·ignore 분기가 먼저 `return`) |
| 빈 결과(`empty`) / 누른 칸을 떠난 결과(`ignore`) | 변화 없음(안 뜸) | 변화 없음 | `useWordMic.ts:47-53` |
| 그 칸을 사용자가 직접 고침(타자·붙여넣기·지우기) | 꺼짐 | 변화 없음 | `WordAddSheet.tsx:324`(1단계 표현) · `WordForm.tsx:91-93`(폼 표현·예문) → `useWordMic.ts:102` |
| 다시 말하려고 그 칸을 엶 | 꺼짐 | 변화 없음 | `useWordMic.ts:89`(`speak`) |
| 말로 쓰기 칸을 도로 닫음(`toggle`→null) | 변화 없음 | 변화 없음 | 이미 `speak` 로 꺼져 있음 |
| 뜻 채우기·저장·직접 입력하기·단계 이동(`mic.close()`) | 꺼짐 | 꺼짐 | `WordAddSheet.tsx:166,231,364` → `useWordMic.ts:97`(`leave`, only 없음) |
| 검증 실패 포커스·예문 접기(`mic.close('surface'｜'example')`) | 그 칸만 꺼짐 | 유지 | `WordAddSheet.tsx:152,405` |
| 시트 닫힘 | 소멸 | 소멸 | `WordsScreen.tsx:481` 조건부 마운트(`key`)라 훅 상태가 사라짐 |
| 인식 결과가 값에 들어가는 길(`onResult`→`set`) | `edited` 를 부르지 않음 → 켜진 채 유지 | — | `WordAddSheet.tsx:139-147` |
| 화면 | 글자 모드(입력 칸이 보일 때)에서만 그림, 말로 쓰는 중인 칸·`mic` 없는 수정 시트에는 없음 | | `WordMicField.tsx:138-147` |

## 사양과 달라진 점 4개 (developer 보고) 판정

| # | 내용 | 판정 | 이유 |
|---|---|---|---|
| ① | 파일 +2(`WordForm`·`WordAddSheet` 에 「직접 고침」 신호) | **수용** | 안내를 거두려면 사용자가 칸을 고쳤다는 신호가 필요하고, 입력 `onChange` 는 그 두 파일에 있다. 인식 결과 경로와 분리돼 있고(m7·m3a·m3b·m8 포착) 수정 시트 DOM 불변. 대안(마지막 반영값과 현재값 비교)은 되돌려 쓰면 안내가 다시 뜨는 부작용이 있어 오히려 부정확 |
| ② | 「한국어·영어식 발음은 잘못 적힐 수 있다」를 한 줄에 못 넣고 사전 안내(「일본어 발음으로」)+인식 직후 안내(「잘못 알아들었을 수 있어요」) 두 곳으로 나눔 | **수용** | L1 이 못 박은 문장 그대로이고, 사전 안내가 방향을, 사후 안내가 결과를 말한다. 사전에 결과까지 한 줄에 넣으면 12px 두 줄을 넘는다(360px). 아쉬운 점은 REV073-3 |
| ③ | 표현 힌트에서 「표현이 바뀌어요」 삭제(바꿔 넣기 동작은 불변) | **수용(주의)** | L1 의 literal 문장에 없는 것을 빼라는 지시를 지킨 것. 동작은 `MERGE` 로 그대로(바꿔 넣기). 다만 안내가 줄어든 효과는 REV073-3 |
| ④ | 뜻 채우기·저장·오류 포커스에서도 안내가 사라지는 확장 | **수용** | L2 의 「단계가 넘어가면」을 구체화한 것. 검증 실패 포커스는 그 칸만 지우는 `close(f)`(다른 칸 유지) |
| 시험 | REV069-4 `toggle` 정규식 변경 | **의미 유지** | 이전: `retarget(micToggle(...))` 한 덩어리 → 이후: `const step=micToggle(...)if(!retarget(step))return`. 인자·호출 순서 그대로이고, 새 시험이 `if(!retarget(step))return` 다음에 `setHint(null)` 이 오는 순서(= 칸이 바뀌었을 때만 힌트 거둠)를 따로 고정 |

## 결함·주의 목록

| ID | 등급 | 위치 | 내용·근거 | 권장 |
|---|---|---|---|---|
| REV073-G1 | 게이트(등급 외) | `task-073-improve-word-add-copy.md` frontmatter `demo_gate` | `check.mjs check` → `DEMO_GATE_BLOCKED`(`status: drafting`, 「사용자 승인이 기록되지 않았습니다」). delta 수준인 이유는 judge 재판정(JV-ui_change). 코드는 이미 구현돼 있다 | Leader 가 사용자와 delta 데모 승인 또는 사용자의 명시적 면제를 받아 `check` 를 PASS 로 바꾼 뒤 커밋·푸시·배포. 이 감사가 에이전트 대신 승인/면제를 처리하지 않았다 |
| REV073-1 | Low (시험 공백) | `__tests__/wordMicField.test.ts` 훅 소스 스캔 | 훅 동작은 순수 함수 시험 + 소스 정규식 스캔으로만 고정돼 있고, **`onFinal` 의 `empty` 분기에 `setNotice` 가 끼어들어도 못 잡는다**(변이 m2 생존: 빈 결과에 안내가 붙는데 시험 통과). 순수 함수 쪽(`micNoticeAfterFinal`)은 m2b 로 포착됨. 렌더 훅 시험 없음 | 소스 스캔에서 `empty` 분기 구간(`action.kind==='empty'` ~ `return`)에 `setNotice` 가 없음을 단언 추가, 또는 훅을 실제로 돌리는 시험. 폰 확인 때 「빈 말 → 안내 안 뜸」 1건 확인 |
| REV073-2 | Low (접근성) | `WordMicField.tsx:141-145` | 안내 `<p role="status">` 는 DOM 에 **내용과 함께 새로** 들어온다. 일부 화면 읽기기는 새로 생긴 live region 을 읽지 않는다. 기존 `sr-only role=status` 는 상시 존재하지만 담는 말은 「알아들은 말: …」뿐 | L2 가 `role="status"` 를 지정한 대로 구현됨(결함 아님). 읽히는지가 중요하면 designer 판단으로 상시 live 영역에 안내 문장을 합치기. 폰(TalkBack) 확인 항목에 추가 |
| REV073-3 | Low (안내 손실) | `labels.ts:312` | 옛 힌트가 「표현이 **바뀌어요**」로 말해 주던 「말하면 칸의 기존 표현을 **대체**한다」가 표현 힌트에서 빠졌다(예문은 「이어 붙고」로 남음). 열린 말하기 상자가 칸의 현재 값을 보여 주고(`WordMicField.tsx:103-106`) 동작은 불변이라 데이터 손실 경로는 아님 | L1 문구 그대로라 수정 불요. 사용자 폰 확인 때 「타자 친 표현 위에 말하면 덮어쓴다」가 놀랍지 않은지만 보기 |
| REV073-4 | Low (미측정 범위) | `prompts/wordEnrich.ts:84` | 새 규칙 줄은 Claude(haiku)로만 실측했다. home-m4(qwen) 보조 경로(`homeM4.provider.ts`)에서도 같은 말투를 지키는지는 미측정(PE 한계 6, task-068 과 동일 관행). valid=true 경로는 규칙이 「valid=false 일 때만」이라 영향 없음 | 현행 유지. qwen 으로 도는 일이 생기면 `GROUP=invalid` 하네스로 재측정 |

## PE 의 결정 요청에 대한 의견 (Leader·사용자 결정)

- 「インペクト 에 インパクト 후보를 보일지」: **현행(보수적 생략) 유지를 권한다.** PE 기록에 v3b 에서 후보가 インスペクト 로 틀린 사례가 있고, 이번 task 의 원인이 바로 「틀린 추측의 단정」이다. 내 실호출에서도 インペクト 는 후보를 말하지 않았다(2/2).
- 「한글 외래어 → 영어 단어로 보여서」: 내 실호출 임팩트 2회 중 1회 「영어 단어로 보여서」, 1회 「한글로 적혀 있어서」 — 안내 방향(일본어로 적어 달라)은 같고 틀린 단정이 아니라 수용 가능.
- 이유 문장(「일본어 단어로 확인되지 않았어요.」)이 화면 틀(「일본어 단어로 보기 어려워요. 표현을 확인해 주세요.」)과 뜻이 겹친다(インペクト·asdf 처럼 후보가 없을 때). 단정 제거가 목적이라 결함은 아니고, 중복이 거슬리면 designer 판단.

## 증빙 재실행 (미러 `~/.node-local/thekaiwa-rev073`, 저장소와 `diff -rq src tests` 0, `.env` 없음, `UserWordState` 724건)

| 명령 | 내 결과 | 보고 수치 | 차이 |
|---|---|---|---|
| `tsc --noEmit` | exit 0 | 0 | 없음 |
| `eslint src/components/vocab src/modules/conversation tests/prompts` | exit 0 | 0 | 없음 |
| 전체 시험(`node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')`) | `# tests 4152 · pass 4150 · fail 0 · cancelled 0 · skipped 2` | 4,150/4,152·실패 0·건너뜀 2 | 없음 |
| 새·변경 시험 4개 파일(wordMic·wordMicField·wordEnrich·wordEnrichInvalid) | `# tests 77 · pass 77 · fail 0` | — | — |
| `next build` | exit 0 (경고 3건은 페르소나 파일 stat·spawn 의 기존 「Dynamic filesystem access」, 이번 변경 무관) | 0 | 없음 |

## 실호출 재현 (로컬 Claude CLI haiku fast 티어, 직렬, 14호출, DB·운영 서버 접촉 0)

| 입력 | 구분 | 호출 | 결과 | 단정 | 문장·언어 |
|---|---|---|---|---|---|
| インペクト | invalid | 2 | valid=false 2/2 · 「일본어 단어로 확인되지 않았어요.」×2 (후보·원어 짐작 없음) | 0 | 한 문장·한국어 |
| impact | invalid | 2 | valid=false 2/2 · 「영어 단어로 보여서(,) 일본어 표현으로 적어 주시면 확인할 수 있어요.」×2 | 0 | 〃 |
| 임팩트 | invalid | 2 | valid=false 2/2 · 「영어 단어로 보여서, …」 / 「한글로 적혀 있어서, …」 | 0 | 〃 |
| asdf | invalid | 2 | valid=false 2/2 · 「일본어 단어로 확인되지 않았어요.」×2 | 0 | 〃 |
| 映画 | valid | 2 | valid=true 2/2 · 필드 채움 2/2 · NAME/NAME · NOUN · えいが · N5 | — | — |
| 温い | valid | 2 | valid=true 2/2 · 필드 채움 2/2 · FEELING/FEELING · ADJ_I · ぬくい · N4 | — | — |
| インパクト | valid | 2 | valid=true 2/2 · 필드 채움 2/2 · NAME/NAME · NOUN · いんぱくと · N3/- | — | — |

요약: invalid 8/8 `valid=false`·단정 표현 0·2문장↑ 0·비한국어 0 / valid 6/6 `valid=true`·필드 채움 6/6·chunkType 기대 일치 6/6 / 1차 계약 위반 0/14 · 엔진명 누출 0 · 지연 p50 2,850ms·p95 3,092ms. (사례 원문 「…영어 단어 'inspect'의 오타로 보입니다.」 소멸 확인.) 한계: 소량(입력당 2회) 재현이라 PE 의 48+24+18 호출 통계를 대체하지 않는다.

## 변이 점검 (미러 `rev073m`에서만, 파일마다 원복 후 `diff -rq src tests` 0 확인) — 29개 중 28개 포착, 1개 생존

| ID | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| m1 (a) | 훅 `onFinal` 의 `setNotice(AfterFinal)` 삭제(안내 안 뜸) | 포착 | 훅 배선 스캔 |
| m2 (b) | 훅 `empty` 분기에 안내 켜기(빈 결과에도 뜸) | **생존** | — (REV073-1) |
| m2b (b) | 순수 `micNoticeAfterFinal` 이 ignore 아닌 모든 결과에 붙음 | 포착 | 순수 함수 시험 |
| m3a (c) | 1단계 표현 `onChange` 의 `mic.edited` 삭제(고쳐도 안 사라짐) | 포착 | 폼·시트 배선 스캔 |
| m3b (c) | `WordForm.change` 의 `mic?.edited` 삭제 | 포착 | 〃 |
| m3c (c) | 훅 `edited` 가 아무것도 안 함 | 포착 | 훅 배선 스캔 |
| m4 (d) | `notice[target]`→`notice.surface`(한 칸 안내가 다른 칸에 샘) | 포착 | 칸 렌더·폼 렌더 시험 |
| m5a (e) | `enrich` 의 `mic.close()` 삭제(뜻 채우기 뒤에도 남음) | 포착 | 시트 배선 스캔 |
| m5b (e) | `save` 의 `mic.close()` 삭제 | 포착 | 〃 |
| m5c (e) | 직접 입력하기 이동의 `mic.close()` 삭제 | 포착 | 〃 |
| m5d (e) | 훅 `close` 의 `leave` 삭제 | 포착 | 훅 배선 스캔 |
| m5e (e) | `leave`(only 없음)가 아무것도 안 지움 | 포착 | 순수 함수 시험 |
| m6 | `toggle` 의 `speak` 삭제(다시 말하려고 열어도 남음) | 포착 | 훅 배선 스캔 |
| m7 | `onResult` 가 `mic.edited` 를 불러 안내가 곧바로 사라짐 | 포착 | 폼·시트 배선 스캔 |
| m8 | `mic?.edited`→`mic!.edited`(수정 시트 경로 깨짐) | 포착 | 폼·시트 배선 스캔 |
| m9 | 안내 `<p>` 의 `role="status"` 삭제 | 포착 | 칸 렌더·배선 스캔 |
| m10 | 표현 힌트를 옛 문구로 | 포착 | 열린 칸 렌더 시험 |
| m11 | 예문 힌트에 예시 추가 | 포착 | 〃 |
| w1 (f) | 규칙 줄을 `system` 배열에서 삭제 | 포착 | 규칙 줄 존재·위치 시험 |
| w2 (g) | 규칙에서 단정 금지 예문 제거 | 포착 | 규칙 문구 시험 |
| w2b (g) | 「오타라고 짐작해 말하지 않습니다」 제거 | 포착 | 〃 |
| w2c (g) | 후보 제한 「분명할 때만」 → 「떠오르면」 | 포착 | 〃 |
| h1 (h) | 검출기 typo `/오타/`→`/오탈자/` | 포착 | 검출기 시험 |
| h2 (h) | 검출기 negation 에서 「아닙니다」 제거 | 포착 | 〃 |
| h3 (h) | 검출기 formal-end 무력화 | 포착 | 〃 |
| i1 (i) | 판정 줄 한 글자(오타→오탈자) | 포착 | v2 해시 시험(L4 불변) |
| i2 | valid=true 줄(null 금지→허용) | 포착 | 〃 |
| i3 | 규칙 범위 「valid=false 일 때만」→「항상」 | 포착 | 규칙 줄 시험 |
| v1 | 버전 라벨 v3→v2 | 포착 | 버전 시험 |

(task-069 교훈의 「배선·훅 변이」: 훅·시트·폼 배선 변이 12개(m1·m2·m3a~c·m5a~d·m6·m7·m8) 중 11개 포착, 생존 1개는 빈 결과 분기 — REV073-1.)

## 단계 요약

- 7영역: 아키텍처(6층·소유 구분 이상 없음) / 유지보수성(문구 정본 `labels.ts` 한 곳, 하드코딩 없음) / 안정성(상태 전이 완결·시트 언마운트) / 운영성(DB·ConfigurationVersion 무관, 캐시는 프로세스 메모리) / 성능(A10 비실시간·길이 영향 없음) / 보안(새 입력 경로·Secret·경로·소유자 무관) / 학습 원칙(AI 산출 저장 경로 불변, 엔진명 비노출 0) — 전부 검토, 이슈는 위 Low 4건뿐.
- QA 로 넘길 high_risk_areas(승격되어 QA 가 돌 경우): ① `WordMicField.tsx:141` 안내가 폰(360/390/412px)에서 1~2줄·가로 넘침 없이 뜨는지, ② 실제 마이크 → 안내 → 입력 → 사라짐 → 다시 말하기 흐름(훅 상태는 렌더 시험이 없고 소스 스캔뿐), ③ 빈 말(무음) 뒤 안내가 안 뜨는지(REV073-1), ④ 수정 시트에 마이크·안내 없음, ⑤ 단어 추가에서 インペクト·`impact`·`임팩트` 실화면 문구.
- 재순환 필요: 없음(코드). 게이트(REV073-G1)만 Leader·사용자 몫.

## 재감사(승인 후 보완 라운드) — REV-073b

> 2026-10-17 · reviewer(sonnet) · 대상: 데모 v1 「승인」 뒤 developer 의 DP1·DP2·Low① 보완 3건과 그 영향만(W-2/W-3 의 이미 PASS 한 부분은 재감사 안 함). 저장소 코드는 한 줄도 고치지 않았다.
> 방법: Read 전용 + 전용 미러 `~/.node-local/thekaiwa-rev073b`(증빙 재실행: `rev073` 을 `cp -al` 후 **3개 파일만** 임시 파일→`mv` 로 덮어씀, `.next`·`*.tsbuildinfo` 링크 제거, `.env` 없음, `UserWordState` 724건, 저장소와 `diff -rq src` = task-072 의 `phraseHelp.ts` 2개뿐) + 변이·동적 탐침용 `~/.node-local/thekaiwa-rev073bm`(변이 21회, 끝난 뒤 3개 파일+훅 원복 `==` 확인). 스크립트 `rev073b-mutate.py` 는 스크래치패드(본인 파일). `rev073` 원본은 링크 오염 없음 확인.

### 판정

- **코드 판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · **Low 4**(REV073b-1~4, 모두 접근성·시험 보강 권고, 수정 필수 없음). 1차 감사 Low ①(REV073-1)·② (REV073-2) 는 **해소**를 확인했다.
- **게이트: `check.mjs check` = `DEMO_GATE_PASSED`**(task-073 · approved · approved_version v1 · hash verified). `evidence.jsonl` 41행 `kind:approve` v1 14:29:17(`prompt_ts` 14:28:10 + `quote_sha256` 가 붙은 사용자 프롬프트 훅 기록 형태), 에이전트가 approve·waive 를 대신 실행했거나 `.claude/state/demo-gate/` 를 직접 쓴 흔적은 이 증거 줄의 형태로는 보이지 않는다(그 폴더의 파일 변경 이력 자체는 내가 볼 수 없음 — `[가능성 높음]` 정상).
- 데모 v1(승인본) 대비 구현 차이 분류: DP1 `lang="ja"` 예시·DP2 「상시 줄에 합침 + 보이는 안내 aria-hidden」은 데모 문구(`상시 줄을 「알아들은 말: インペクト. 잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」로 합치고 눈에 보이는 안내는 aria-hidden`)와 일치 = 결함 없음. 사양과 달라진 **얼림**은 눈에 보이는 결과가 같은 내부 구조 차이 = **implementation**(허용, 아래 근거). material 0 · defect 0 → 데모 재승인 불필요.
- 이슈 요약 `{critical:0, high:0, medium:0, low:4}` · `native_change:false`(`plugins/**`·`android/**`·Manifest·`capacitor.config.ts` 무변경).

### 체크리스트 1~6

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | DP1 | **PASS** | `labels.ts:313` `surface` 가 `['일본어 발음으로 말해 주세요 (예: ', 'インパクト', '). 칸에 들어간 뒤 고칠 수 있어요.']` — 이어 붙이면 「일본어 발음으로 말해 주세요 (예: インパクト). 칸에 들어간 뒤 고칠 수 있어요.」로 1차 감사본(`rev073`)의 문자열과 **글자 단위 동일**(`diff` 로 확인, 바뀐 건 이 줄+주석 1줄뿐). `WordMicField.tsx:136-146` 가 문자열이면 그대로, 조각이면 가운데(`hint[1]`)만 `<span lang="ja">`. `hint.example`(`labels.ts:314`)은 문자열 그대로 불변. `WORD_MIC_COPY.hint` 소비처는 `WordMicField.tsx:64` 한 곳뿐(`grep -rn` 비테스트 소스) — 다른 곳이 문자열로 쓰다 깨질 일 없음. 타입은 `typeof hint === 'string'` 좁히기로 `tsc` 0 |
| 2 | DP2 마크업 | **PASS** | 보이는 안내(`:158`) `<p aria-hidden="true" className="text-[12px] text-ink2 break-keep">` — 1차본과 `diff` 로 속성 하나(`role="status"`→`aria-hidden="true"`)와 주석만 다름. 자기 `role` 없음(`<p[^>]*role=` 0건·`role="status"` 파일 전체 1건 = 늘 있는 `sr-only` 줄). 위치(`{children}` 바로 뒤)·클래스·문구(`WORD_MIC_COPY.checkNotice`)·표시 조건(글자 모드 분기 + `mic.notice[target]`) 불변. 읽기용 줄(`:164-166`)은 결과가 들어온 렌더에서 `알아들은 말: インペクト. 잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.` 로 **DOM 변경 1번**에 바뀜(동적 탐침 S1 `srChanges=1`) |
| 3 | 얼림 — 사양과 달라진 점 | **수용** | 아래 「얼림 판정」 |
| 4 | Low① | **PASS** | 내가 직접 다시 깸: M6(빈 결과 분기에 `setNotice`)·M6b(`ignore` 분기에 `setNotice`)·M6c(빈 결과 분기 `return` 제거) **3개 모두 시험이 실패**(훅 스캔). 구간 통째 비교(`between(onFinal,"if(action.kind==='empty')",'refs.current=next')` ==`if(action.kind==='empty'){setHint(STT_HINT_COPY.EMPTY_RESULT)return}`)는 `squash`(주석·공백 제거)된 소스라 **주석·빈 줄 추가(B1)는 통과**(거짓 실패 아님). 다만 동치 리팩터(B2: 얼림 줄에 중괄호+주석)에는 거짓 실패 → REV073b-2(Low) |
| 5 | 불변 | **PASS** | 저장소↔`rev073`(1차 감사 통합본) `diff -rq src`: 이 라운드의 3개 + task-072 의 `phraseHelp.ts` 2개(감사 대상 아님)뿐. `WordForm.tsx`·`WordAddSheet.tsx`·`useWordMic.ts`·`wordMic.ts`·`src/modules/**`(phraseHelp 2개 제외) **바이트 동일**. 엔진명 grep(`reazon|whisper|style-?bert|claude|sherpa`) 변경 2개 소스 0건(+기존 시험이 같은 grep). 수정 시트: `WordForm` 불변·`mic` 없으면 `WordMicField` 미렌더 |
| 6 | 변이 | **PASS** | 아래 표 — 실변이 19개 전부 포착, 생존 0 |

### 얼림 판정 — **수용**(반려 아님)

상태: `srCheck = {n, on}` (`WordMicField.tsx:75-76`).

| 시점 | 계산 | 결과(동적 탐침 실측, 아래) |
|---|---|---|
| 마운트 | `n = announce?.n ?? null`, `on = mic.notice[target]` | 안내 꺼진 채 다시 그려진 칸(예: 예문 접었다 펴기)은 `on=false` → 평소 글 「알아들은 말: …」 |
| 새 결과(n 변경) | 렌더 중 `announce && srCheck.n !== announce.n` 일 때만 `setSrCheck({n: announce.n, on: mic.notice[target]})` | React 가 **커밋 전에 같은 컴포넌트를 즉시 재실행**하므로 첫 커밋부터 합친 글(`srChanges=1`). `onFinal` 의 `setAnnounce`·`setNotice` 가 같은 틱·같은 배치(`useWordMic.ts:56-58`, 사이에 `await` 없음)라 `on` 은 결과와 같은 렌더의 안내 상태 |
| 안내 거둠(고침·다시 열기·단계 넘어감) | **아무것도 안 함**(`n` 이 같다) | 줄의 글 불변 `srChanges=0` — 같은 말 재낭독 사건 없음 |
| 다른 칸 결과 | `announce=null`(target 거름) → 갱신 안 함 | 줄 `''`(S5, 1차에도 있던 동작) |
| 같은 칸 두 번째 결과 | `n+1` → 갱신, `on=true` | 새 글로 1번 변경(S4·S6) |
| 시트 닫힘 | `WordAddSheet` 언마운트로 상태 소멸 | — |

- **React 규칙**: 렌더 중 갱신은 **자기 컴포넌트의 자기 state, 조건 수렴(`n` 이 같아지면 중단)** 인 문서화된 「이전 렌더 정보 저장」 패턴이다. 다른 컴포넌트 갱신 아님·무한 렌더 없음. **StrictMode 이중 렌더**에서도 출력 동일, `console.error` 0(아래 동적 탐침). eslint 0.
- **왜 필요한가(대조 실측)**: 얼림을 풀면(M4, 읽기용 줄이 `mic.notice` 를 직접 봄) S2(한 글자 고침)에서 줄이 「알아들은 말: インペクト」로 **되돌아가 DOM 변경 1번 = 같은 말 재낭독**이 일어난다. 사양 문구 그대로는 결함이므로 developer 의 이탈은 **정당**하고 기록에 명시돼 있다.
- **더 단순한 대안**: 상태 없이 `announce ? 알아들은 말: … . 확인 안내 : ''`(항상 합침, 대안 A)도 S1~S6 흐름에서 **관측 결과가 동일**함을 동적으로 확인했다. 차이는 「안내가 꺼진 채 재마운트」 한 경우뿐(대안 A 는 합친 글, 현행은 평소 글). 즉 상태·렌더 중 갱신 기계가 사는 것은 이 한 경우뿐이다. 그래도 **반려하지 않는 이유**: ① 승인된 디자인(데모)의 「안내가 켜지지 않았으면 평소 글」과 시험이 이 구분을 못 박고 있고 ② 동작이 정확·수렴·StrictMode 안전이 실측되며 ③ 단순화는 동작 이득이 없는 정리 작업이라 승인 후 보완 라운드에서 다시 흔들 가치가 낮다. 추후 정리한다면 **`announce` 객체에 `check` 를 실어 훅(`onFinal`)에서 정하는 쪽**(순수 함수 시험 가능·렌더 중 갱신 불필요)이 가장 깔끔하다(선택, REV073b-3).
- **대가 3가지(수용 가능)**: ① 표현→예문 순서로 둘 다 말하면 표현 칸 줄이 `''` 가 되고 보이는 안내는 `aria-hidden` 이라 표현 칸 경고가 화면 읽기에 남지 않음(S5 실측) — 말한 그 순간에는 한 번 읽힘, 승인된 DP2 설계 대가(REV073b-1) ② 안내를 거둔 뒤에도 합친 글이 DOM 에 남음(탐색 모드로 읽으면 고친 칸에서 같이 읽힘, 낭독 사건은 아님 — S2 실측) ③ 결과가 `。` 로 끝나면 `あった。. 잘못` 구두점 겹침(낭독 영향 없음, REV073b-4).

### 결함·주의 목록

| ID | 등급 | 위치 | 근거 | 권장 수정 |
|---|---|---|---|---|
| REV073b-1 | Low (접근성, 승인된 설계의 대가) | `WordMicField.tsx:158`(aria-hidden)·`:164-166`(칸마다 하나, `mic.announce` 는 전체 하나) | 동적 S5: 예문 칸 결과가 오면 표현 칸 읽기용 줄 `''`, 보이는 안내는 `aria-hidden` → 표현 칸으로 돌아간 화면 읽기 사용자는 「확인하고 고쳐 주세요」를 다시 접할 수 없다. 1차본(`<p role="status">` 가 DOM 에 남음)보다 **다시 읽을 수 있는 범위가 줄었다** | 수정 불요(DP2 승인·말한 순간 1회 낭독). TalkBack 폰 확인 ⑨ 에 「표현→예문 둘 다 말한 뒤 표현 칸으로 돌아가 보기」 추가. 정말 문제면 designer 판단으로 보이는 안내에서 `aria-hidden` 만 빼기(role 없는 일반 문단은 새로 끼워도 낭독 안 됨, 탐색 모드 재독 가능, 대신 탐색 모드에서 읽기용 줄과 중복) |
| REV073b-2 | Low (시험 취약·동작 시험 부재) | `wordMicField.test.ts` 얼림 배선 스캔(「안내를 합칠지는 결과가 들어온 순간에 한 번 정한다」) | 얼림 동작은 소스 정규식으로만 고정(렌더 시험 없음 — DOM 환경 없음). 정규식이 `useState({n:announce?.n??null,on:mic.notice[target]})` 와 `if(announce&&srCheck.n!==announce.n)setSrCheck({…})` 한 줄 모양에 묶여, 동치 리팩터(B2: 중괄호+주석)에 **거짓 실패**한다. 반대로 정규식이 의미를 못 잡는 변종은 없었다(M4·M8·M9·M10 포착). 현재 동작은 내 동적 탐침(jsdom·StrictMode)에서 정확 | 수정 불요(task-069 이래 `squash` 스캔 관례). 정리할 때 REV073b-3 의 `announce.check` 로 옮기면 순수 함수 시험으로 바뀐다. 폰 ⑨ 로 최종 확인 |
| REV073b-3 | Low (복잡도 대비 이득) | `WordMicField.tsx:73-76` | 상태 + 렌더 중 갱신이 관측으로 사는 것은 「안내 꺼진 채 재마운트」 한 경우뿐(대안 A 대조) | 현행 유지. 이후 정리 시 훅에서 `announce.check` 로 확정(선택) |
| REV073b-4 | Low (표시) | `WordMicField.tsx:165` | 결과 문장이 `。` 로 끝나면 읽기용 줄 글이 `…あった。. 잘못…`(구분자 `. ` 고정). 낭독은 영향 없음 — developer 기록과 일치 | 수정 불요(원하면 끝 구두점 검사 한 줄) |

(범위 밖 관찰, 점수 제외: 읽기용 줄에 든 일본어 결과 `announce.text` 에는 `lang` 이 없다 — task-069 이래 동작이며 DP1 과 같은 계열의 a11y Minor. 이 라운드 범위가 아니라 건드리지 않았다.)

### 증빙 재실행 (`~/.node-local/thekaiwa-rev073b`, 보고 수치와 대조)

| 명령 | 내 결과 | 보고 | 대조 |
|---|---|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 0, 출력 0바이트 | 0 | 일치 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 0, 출력 0바이트 | 0 | 일치 |
| 마이크 시험 2개(`wordMic`·`wordMicField`) | `# tests 55 / pass 55 / fail 0 / skipped 0` | 55/55 | 일치 |
| vocab 전체 | `# tests 287 / pass 287 / fail 0 / skipped 0` | 287/287 | 일치 |
| 전체(`find src scripts/seed-build -name '*.test.ts'`, `--test-concurrency=1`) | `# tests 4157 / pass 4155 / fail 0 / skipped 2` | 4,157/4,155/0/2 | 일치 |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build` | 종료 0 (`Compiled successfully in 7.0s`; 로그의 `SPAWN_FAILED` 는 Turbopack NFT 추적 경고의 소스 발췌일 뿐 오류 아님) | 0 | 일치 |
| 데모 게이트 `check.mjs check --task …task-073…` | `DEMO_GATE_PASSED` · approved · v1 · hash verified | — | — |

차이 없음. task-072(PE)가 저장소에서 바꾸는 `phraseHelp.ts` 2개는 미러에 넣지 않았고(미러는 1차 감사 통합본 그대로) 두 영역은 import 로 이어지지 않아 영향이 없다.

### 변이 점검 (미러 `rev073bm`, 한 번에 하나만 깨고 마이크 시험 2개 실행→즉시 `os.replace` 원복, 끝난 뒤 4개 파일 `==` 원본 확인) — 실변이 19개 전부 포착, 생존 0

| # | 깬 곳 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 (a) | 읽기용 줄이 확인 안내를 합치지 않음 | 포착(3) | 읽기용 줄 시험 3개 |
| M2 (b) | 보이는 안내에 `role="status"` 복원(aria-hidden 대체) | 포착(3) | 안내 마크업 · 읽기용 줄 · 칸 스캔 |
| M2b | `role="status"` + `aria-hidden` 둘 다 | 포착(3) | 〃 |
| M3 (c) | 보이는 안내의 `aria-hidden` 제거 | 포착(3) | 〃 |
| M4 (d) | 얼림 해제(읽기용 줄이 `mic.notice` 를 직접 봄) | 포착(1) | 얼림 배선 스캔 |
| M5 (e) | 예시 span 의 `lang="ja"` 제거 | 포착(2) | 열린 칸 · 힌트 스캔 |
| M6 (f) | **훅 빈 결과 분기에 안내 켜기(Low①)** | 포착(1) | 훅 스캔 — 1차에 생존하던 변이 |
| M6b | `ignore` 분기에 안내 켜기 | 포착(2) | 훅 스캔 · R8/R7/R4 |
| M6c | 빈 결과 분기 `return` 제거 | 포착(1) | 훅 스캔 |
| M7 (g) | 읽기용 줄이 다른 칸 결과도 읽음 | 포착(2) | 「그 칸만」 · 읽기용 줄 |
| M8 | 얼린 값이 새 결과마다 갱신 안 됨 | 포착(1) | 얼림 배선 스캔 |
| M9 | 얼린 값이 항상 true | 포착(3) | 읽기용 줄 · 얼림 스캔 |
| M10 | 얼림을 「안내 상태를 따라가는 상태」로 위장 | 포착(1) | 얼림 배선 스캔 |
| M11 | 보이는 안내 12px→13px | 포착(2) | 안내 마크업 · 칸 스캔 |
| M12 | 보이는 안내 표시 조건을 `announce` 로(E3 깨짐) | 포착(6) | 안내 시험 다수 |
| M13 | 읽기용 줄 구분자 `. `→`, ` | 포착(3) | 읽기용 줄 시험 |
| M14 | 표현 힌트 보이는 문구 공백 1글자 | 포착(2) | 열린 칸 · 힌트 스캔 |
| M15 | 확인 안내 문구 변경 | 포착(5) | 문구 정본 · 안내 시험 |
| M16 | 예문 힌트까지 조각 배열로 | 포착(2) | 열린 칸 · 힌트 스캔 |
| B1 (무해) | 훅 빈 결과 분기에 주석·빈 줄만 추가 | **통과**(의도) | 거짓 실패 없음 |
| B2 (무해) | 얼림 줄에 중괄호+주석(동치 리팩터) | 거짓 실패(1) | REV073b-2 |

못 잡는 변이: **없음**(실변이 기준). 시험이 보지 못하는 것: ① 실제 TalkBack 낭독(폰 몫) ② 얼림의 시간 흐름은 정적 스캔뿐 — 아래 동적 탐침으로 내가 별도 확인.

### 동적 탐침(미러 전용, 저장소에 넣지 않음 — 시험 환경에 DOM 이 없어서 VoiceVault 의 `jsdom` 을 읽기 전용으로 빌려 진짜 `WordMicField` 를 `react-dom/client` 로 렌더)

- 일반·StrictMode **각 1회, 둘 다 통과·`console.error` 0**. 줄(`sr-only`)의 DOM 변경 횟수(MutationObserver): S1 결과 도착 1회(합친 글 한 번에) → S2 고침 **0회** → S3 다시 열기 **0회** → S3b 글자로 복귀 0회 → S4 두 번째 결과 1회 → S5 예문 칸 결과 1회(표현 줄 `''`) → S6 다시 표현 결과 1회 → 안내 꺼진 채 재마운트는 평소 글.
- 서버 렌더 탐침 4개(`renderToStaticMarkup`, 상태 초기값을 일부러 낡게 해 렌더 중 갱신 경로를 강제): 한 번에 수렴·합친 글이 첫 출력·StrictMode 동일·다른 칸 결과는 갱신 없음.
- 대조: 얼림 해제(M4)면 S2 에서 줄이 되돌아가 DOM 변경 1회(= 재낭독), 대안 A 는 S1~S6 동일.

### 단계 요약

- 7영역: 아키텍처(6층·`index.ts` 경계 무관, 컴포넌트 3개만) / 유지보수성(문구 정본 `labels.ts` 한 곳, 소비처 1곳 확인, REV073b-3) / 안정성(렌더 중 갱신 수렴·StrictMode·재마운트·언마운트) / 운영성(DB·ConfigurationVersion·Trace 무관) / 성능(재렌더 1회 추가, 무시 가능) / 보안(새 입력·Secret·경로 무관, 엔진명 0) / 학습 원칙(AI 산출 저장 경로 불변) — 전부 검토, 이슈는 위 Low 4건뿐.
- 1차 감사 이월: REV073-1(훅 빈 결과 시험 공백) **해소**, REV073-2(새로 끼운 live region 낭독 불확실) **해소**(상시 줄에 합침), REV073-3·4 는 1차 판정 그대로(수정 불요).
- QA(가 돈다면)·사용자 폰 확인 high_risk_areas: ① TalkBack 으로 말한 뒤 「알아들은 말: …. 잘못 알아들었을 수 있어요. …」가 **한 번** 읽히고 그 칸을 고쳐도 **다시 읽히지 않음**(⑨) ② 표현→예문 둘 다 말한 뒤 표현 칸으로 돌아갔을 때의 화면 읽기(REV073b-1) ③ 힌트의 「インパクト」가 일본어로 읽힘(⑩) ④ 360/390/412px 에서 힌트 두 줄 이내·가로 넘침 없음(문구가 1차보다 길어지지 않음 — 조각만 나눔).
- 재순환 필요: **없음**. 커밋·배포 전 사용자 폰 확인만 남음(light 트랙 QA 없음).
