---
task_id: task-049
title: "챌린지 주제 단어 예문 — AI 가 만든 새 단어에 예문(일·한)을 만들어 VocabAttempt.exampleSnap·exampleKoSnap 에 저장 (DB 승인 2026-10-10)"
status: done
base_ref: 6e97554
risk_level: "R2"
roles_involved: [leader, judge, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-042-topic-words-b2, task-040-improve-challenge-design, task-048-roleplay-endedat]
imp: [IMP-0024]
tags:
  - type/task
  - domain/challenge
  - domain/prompt
  - domain/db
aliases:
  - 주제 단어 예문
  - task-049
created: 2026-10-10
updated: 2026-10-10
demo_gate:
  required: true
  level: "delta"
  status: "drafting"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-049 — 챌린지 주제 단어 예문 (E3)

## 사용자 요청 (원문)
- 2026-10-10 「DB 승인 대기 미구현 5건」 결정(C안) 2번: 「챌린지 주제 단어에 대하여 승인」 → [[db-approval-decisions-2026-10-10]].
- 2026-10-10: 「지금 작업에 대해서 완료되면 알려주고 다음 작업 이어서 진행할 수 있도록 해줘」.

## 관련 과거 이력 요약 (Leader 큐레이션)
- `docs/design/challenge.md` §3-5·§4-3a: 오늘의 단어 B2(AI 가 매일 새 단어)의 A12(`topicWords@v1`)는 **6필드**(`textJa`·`reading`·`meaningKo`·`chunkType`·`jlpt`·`valid`)만 낸다. 예문 E3(`VocabAttempt.exampleSnap`·`exampleKoSnap` 저장)은 **칸이 없고 대기만 늘어난다**(출력 ≈40% 증가 [추측·미측정])는 이유로 E2(받지 않음)를 권고해 1단계에서 뺐다. 이번에 사용자가 DB 칸 승인.
- **코드 확인(2026-10-10 Leader)**: 카드 화면 `VocabCardFace.tsx:203-209` 는 `card.example`·`card.exampleKo` 가 있으면 이미 예문(일본어 `JaText`·한글 읽기 `HangulLine`·한국어 번역)을 그린다. `learning/vocab/sessions.ts:132·209-210` 은 예문을 **`WordEntry`(`a.word`)에서만** 채운다 → AI 단어(`refType='AiWord'`, `wordId` 없음)는 예문이 비어 있다. 즉 **서버가 스냅샷으로 기존 칸을 채우면 화면 컴포넌트는 바뀌지 않을 가능성이 크다**.
- 알려진 한계: 챌린지 첫 세트 생성 대기 6~7초(10-07 운영 반영 기록) — 예문 추가가 이를 더 늘릴 수 있다. `valid` 검사에서 활용형 때문에 오검출 8% 경험(task-008) — 예문에 표기 포함 여부를 하드 실패로 쓰지 않는다.
- 승인된 교훈(`/이슈기록 관련 prompt latency`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- **1차**(설명에 「카드 화면에 예문 줄 추가」 포함, 9파일): `feature` · 1.94 · R2 · opus · standard · demo=**delta**(`JV-ui_change`).
- **2차**(코드 확인 후 실제 변경으로 재접수, 5파일 — 사실이 달라진 것이지 판정을 낮추려는 것이 아님): `feature` · **1.47** · R2 · developer=**opus** · standard · demo=**delta**(`DM-low-confidence`) · roles=designer, PE?, developer, reviewer, qa. 결과 `intake-t049b.result.json`.
- **Leader 해석(투명 기록)**: 데모 게이트가 막는 것은 **화면 코드 작성**이다. 이번 설계는 화면 컴포넌트를 바꾸지 않는다 → 서버·프롬프트 작업은 데모 대기 없이 진행. **`src/components/**` 등 화면 파일을 고쳐야 하는 일이 생기면 즉시 중단하고 데모 또는 사용자의 면제 문장(채팅 직접 입력)을 요청**한다. 예문이 새로 나타나는 모양은 QA 가 360/390/412 캡처로 사용자에게 보인다(배포 확인 때).

## 설계
1. **스키마**: `VocabAttempt.exampleSnap`·`exampleKoSnap`(nullable, 타입은 `WordEntry.example`·`exampleKo` 와 같게) — [[task-048-roleplay-endedat]] 의 `Chat.endedAt` 과 **단일 작성자가 한 번에**(Leader 가 백업 → `migrate diff` → `db push` 1회).
2. **프롬프트(PE) `topicWords@v2`**: 단어마다 `exampleJa`(짧은 예문, 해당 단어를 쓴 자연스러운 일상 문장)·`exampleKo`(한국어 번역) 추가 출력. 검사: 길이·한국어/일본어 문자 구성 정도의 **가벼운 검사**, **예문이 불량이면 그 단어를 버리지 않고 예문만 null**(단어 생성 성공률을 깎지 않음), 표기 포함 여부는 하드 실패 금지. 수준(JLPT) 창 안 어휘 유도.
3. **서버(developer)**: 세트 생성이 `exampleJa/exampleKo` 를 시도 행의 `exampleSnap/exampleKoSnap` 에 저장(AiWord 카드만). 스냅샷을 **복제하는 모든 곳**(다시 풀기·한 세트 더·세션 재생 등 `surfaceSnap` 을 옮기는 코드)에서 예문 칸도 함께 옮긴다. 세션 응답은 `card.example = a.word?.example ?? a.exampleSnap ?? null` 식으로 채운다(`exampleKo` 동일). 옛 행(NULL)은 지금과 같이 예문 없음.
4. **라이브 측정 게이트(PE, 배포 전 필수)**: A12 `v1`(기준) vs `v2`(예문)를 같은 주제·수준·세트 크기로 **각 ≥10회** 측정 — 생성 소요 p50/p95, 1차 통과율·재시도율·최종 실패율, 예문 품질(불량 null 비율·표본 육안 검토 목록), `valid:false` 로 버려지는 단어 비율. **합격선(Leader 제안, 사용자가 조정 가능)**: 증가분 p50 ≤ +2.5초 **그리고** v2 총 p95 ≤ 12초 **그리고** 1차 통과율 ≥ 90% **그리고** `valid:false` 비율 증가 ≤ +5%p. 하나라도 어긋나면 **구현을 멈추고 사용자에게 보고**해 선택지(예: ⓐ 예문을 카드 뒤집을 때 별도 호출로 지연 숨김 ⓑ 앞쪽 N장만 예문 ⓒ DB 칸만 두고 예문 보류)를 묻는다.
5. 정본: `docs/design/challenge.md` §3-5·§4-3a(Leader, 완료), `docs/design/api-contract.md` 카드 필드 설명(필요 시).

## 하지 않는 것
화면 컴포넌트 수정(필요하면 중단·사용자 확인), 단어 은행 표, `JobKind` 값 추가(생성은 동기 호출 유지), 옛 행 백필(옛 세트에는 예문 없음 그대로), 다른 DB 변경.

## 완료 기준
- 스키마 2칸 적용·시험, `topicWords@v2` 계약 시험(스키마 밖 키 제거·예문 불량 null 처리·기존 6필드 검사 유지), 세트 저장·복제·응답 시험, 단위 시험·tsc·eslint·build 통과, 변이 확인.
- **라이브 측정 합격선 통과(또는 사용자가 선택한 대안 확정)**, Reviewer PASS, QA(QA3 챌린지 레인: 세트 생성→카드에서 예문 표시→재풀기에서도 표시·옛 행은 없음) PASS + 360/390/412 캡처.
- 운영 배포는 **사용자 확인 후**(측정 결과·캡처를 함께 보고).

## 상태 로그
- [2026-10-10] Leader — 접수·judge 2회·이 이력서 작성. 다음: 스키마 3칸 단일 작성 → 백업·`migrate diff`·`db push`; 병행해서 PE 가 `topicWords@v2` 와 라이브 측정.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-10 10:17 |

## Developer 기록 (스키마 3칸)

- [10:25] developer(신규 소환, 스키마 단일 작성자) — task-048·049 공용 스키마 3칸을 `prisma/schema.prisma` 에 추가. **커밋·push·`prisma db push` 하지 않음**(Leader 가 백업 → `migrate diff` 확인 → push 1회). 이 블록은 두 이력서에 같은 내용으로 붙인다.

### 변경 (사용자 승인 2026-10-10 의 3칸만)

| # | 칸 | 소속 | 타입 | 위치 |
|---|---|---|---|---|
| 1 | `Chat.endedAt` | task-048 | `DateTime?` (nullable·기본값 없음) | `Chat.reviewedAt` 바로 뒤 |
| 2 | `VocabAttempt.exampleSnap` | task-049 | `String? @db.Text` | `VocabAttempt` 스칼라 블록 뒤, 관계(`session`) 앞 |
| 3 | `VocabAttempt.exampleKoSnap` | task-049 | `String? @db.Text` | 2번 바로 아래 |

- 3번 타입 근거: `WordEntry.example`(`String? @db.Text`)·`WordEntry.exampleKo`(`String? @db.Text`) 를 직접 읽어 확인(schema 864~865행). 두 스냅샷 칸이 이 타입과 같다.
- `git diff --numstat -- prisma/schema.prisma` = `6 0`(추가 6줄·삭제 0). 6줄 = 칸 3줄 + 설명 주석 3줄(`///` 1줄씩). 승인 밖 변경 없음.
- **배치 결정(보고)**: `VocabAttempt` 는 HEAD 에서 `prisma format` 정규 상태다. `exampleKoSnap`(13자)이 기존 이름 열(`surfaceSnap` 11자 기준 폭 12)보다 길어, 기존 블록 안에 넣으면 블록 전체(약 16줄)가 재정렬되어 삭제 줄이 생긴다. 그래서 빈 줄로 분리한 **별도 정렬 그룹**(스칼라 블록 끝 `refId` 뒤)에 넣었다. 효과: ① 기존 줄 0글자 변경 ② `prisma format` 후에도 `VocabAttempt` 블록이 전후 동일(확인) ③ 새 3줄이 format 으로 바뀌지 않음(확인). 대신 「`meaningSnap` 바로 옆」이 아니라 같은 모델 스칼라 끝에 있다.
- **참고(이번 변경과 무관)**: HEAD `prisma/schema.prisma` 는 `prisma format` 기준 **이미 37구간이 비정규**다(`User`·`WordEntry`·`Chat`·1477행 이후 등). 이번 변경 후에도 37구간으로 같다(새 비정규 0). 그래서 파일 전체에 `prisma format` 을 적용하지 않았다(적용하면 무관한 수십 줄이 바뀐다). 정리는 별도 판단 사항.

### 검증 (미러 `~/.node-local/thekaiwa-db048`, `KAIWA_LOCAL_ROOT` 지정·`node_modules` 는 `thekaiwa-t047` 에서 `cp -al`)

- 미러 `prisma/schema.prisma` == NFS 파일(`cmp` 동일) 상태에서 실행.
- `prisma validate` → `The schema at prisma/schema.prisma is valid`.
- `prisma generate` → `Generated Prisma Client (v6.19.3)` 성공. 하드링크 공유 확인: 생성 후 링크 수 1(공유 아님), `thekaiwa-t047` 미러 클라이언트에는 새 칸이 없음(그쪽은 바뀌지 않음).
- `tsc --noEmit`(미러) → 오류 0건(약 15초). 새 칸을 쓰는 코드는 아직 없음.
- `prisma format`(미러 사본 한정): 새 3줄 변경 0, `VocabAttempt` 블록 전후 동일. `Chat` 블록의 다른 줄 정렬은 HEAD 에도 있던 비정규(`id`·`title`·`preview`·`messageCount`·`createdAt`·`updatedAt`)이며 내 `endedAt` 줄은 포함되지 않음.
- 보이지 않는 문자 검사 `git diff -- prisma | grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` → 0건.

### `prisma migrate diff` (읽기 전용 — DB 를 바꾸지 않는 명령)

`prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (미러 `.env` 의 `DATABASE_URL` 은 값을 출력하지 않고 환경변수로만 전달, 종료 코드 0, stderr 없음). 출력 파일: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/db048-migrate.sql`

SQL 전문(193바이트):

```sql
-- AlterTable
ALTER TABLE `Chat` ADD COLUMN `endedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `VocabAttempt` ADD COLUMN `exampleKoSnap` TEXT NULL,
    ADD COLUMN `exampleSnap` TEXT NULL;
```

- 문장 수: `ALTER TABLE` 2문장 / `ADD COLUMN` 3개(`Chat.endedAt`·`VocabAttempt.exampleKoSnap`·`VocabAttempt.exampleSnap`) = 승인 3칸과 1:1. 옛 인덱스 삭제·드리프트·다른 표 변경 **없음**(DB 와 스키마가 이 3칸 외에는 일치).
- 세 칸 모두 nullable·기본값 없음이라 기존 행·구 코드에 영향 없는 additive 변경(구 코드는 새 칸을 SELECT 하지 않으므로 push 직후 구 코드도 동작 — Prisma 가 명시 칸만 읽는 것은 [가능성 높음], 이번에 구 코드 실측은 하지 않음).

### 인계

- 남은 일: Leader 가 NAS DB 백업 → 위 SQL 재확인 → `prisma db push` 1회. 그 뒤 task-048(`finishRolePlay` 쓰기·읽기 판정·백필 스크립트)·task-049(세트 생성 저장·복제 경로·응답 채움)의 서버 구현.
- 주의: 이 단계에서 `Chat.endedAt`·`exampleSnap`·`exampleKoSnap` 을 쓰거나 읽는 코드는 아직 없다. 구현 단계의 developer 는 `db push` 완료 뒤 미러에서 `prisma generate` 를 다시 돌려야 타입이 생긴다.
- 미커밋 파일: `prisma/schema.prisma`(+6줄). 미러 `~/.node-local/thekaiwa-db048` 는 임시(필요 없으면 정리 가능, 약 1GB 하드링크 사본).

## DB 적용 기록 (2026-10-10 10:2x KST, Leader) — task-048·049 공용 스키마 3칸
- 사용자 승인: [[db-approval-decisions-2026-10-10]] 1·2번. 단일 작성 diff = `Chat.endedAt DateTime?` · `VocabAttempt.exampleSnap Text?` · `VocabAttempt.exampleKoSnap Text?`(+6줄, 삭제 0), 승인 밖 변경 0.
- **백업** `files/thekaiwa/backups/thekaiwa-20261010-102226-pre-task048-049.sql.gz`(600, 320,799B, "Dump completed on 2026-10-10 10:22:33", CREATE TABLE 55). 복원(필요 시, 사용자 확인 후): `zcat <파일> | mysql --defaults-extra-file=<임시 600 옵션 파일> thekaiwa`.
- **적용 전 점검**: 스키마 NFS=미러(sha256 앞 16자 `f0aab06bc3403584`) · `migrate diff` 재실행 = 검토본과 바이트 동일(ALTER 2문장·ADD COLUMN 3개).
- **`prisma db push --skip-generate`** 1회: rc=0 「Your database is now in sync」 · 적용 후 `migrate diff` = 「empty migration」. 운영 헬스: `/api/health` 정상(구 코드는 새 nullable 칸을 읽지 않아 영향 없음).
- 다음: 구현 developer 는 미러에서 `prisma generate` 를 다시 돌려 새 칸 타입을 받는다.


## Prompt-Engineer 기록 (task-049 — topicWords@v2·지연 측정)

> **[developer 인계 — 필드 이름·타입]** 모델 출력 항목은 8키 `textJa`·`reading`·`meaningKo`·`chunkType`·`jlpt`·`valid`·**`exampleJa`**·**`exampleKo`**(둘 다 `string | null`, 스키마 required). `assembleTopicWords(...).words[]` 의 통과 단어 타입 `TopicWord` 에 **`exampleJa: string | null`·`exampleKo: string | null`** 이 붙는다 — 항상 **쌍**이다(둘 다 문자열이거나 둘 다 null; v1 모양 응답·불량 예문은 둘 다 null). 결과 `TopicWordsAssembled` 에는 로그·Trace 용 `exampleNulled: number`·`exampleNulledByReason`(`EXAMPLE_MISSING|TYPE|ENGINE_NAME|JA_LEN|JA_CHARS|KO_LEN|KO_CHARS`)이 더해졌다. 버전 `TOPIC_WORDS_PROMPT_VERSION = 'topicWords@v2'`. `route.ts` 의 `build`/`assemble` 연결은 그대로 컴파일된다(`TopicWordItem.exampleJa?/exampleKo?` 는 타입만 optional — learning 로컬 `TopicWordsOutput` 이 v1 모양이어도 깨지지 않게). developer 몫: learning 쪽 로컬 응답·단어 타입에 두 필드를 더하고 `VocabAttempt.exampleSnap/exampleKoSnap` 에 **null 그대로** 저장.

- [10-10 PE] **측정 결과 합격선 판정 = 불합격(FAIL, 4개 중 ① 미달)** — 아래 표. 구현·배포를 이어갈지는 사용자 선택(대안 후보는 아래). 이 도구는 대안을 고르지 않았다.

### 변경 파일 (PE 소유만; 커밋·push·DB 쓰기 없음)
- `src/modules/conversation/prompts/topicWords.ts` — v2: 스키마 8키·system 예문 지시 2줄·`checkTopicExample`(예문 쌍 검사)·`TopicWord`/`TopicWordsAssembled` 확장·상수 `TOPIC_WORDS_EXAMPLE_JA_MAX=60`·`..._KO_MAX=100`.
- `src/modules/conversation/__tests__/topicWords.test.ts` — 64 → 104개(예문 28쌍·응답 8건·불변식·기존 6필드 불변).
- `tests/prompts/fixtures/topic-words.json` — responses 120개 항목을 v2 모양으로 갱신(기대값 kept/dropped/classify 는 그대로) · `tests/prompts/fixtures/topic-words-examples.json` — 신규.
- `tests/live/task049-topicwords-ab.ts` — 신규 A/B 측정 하니스(v1·v2 교대, 실험 팔 v2b) · `tests/live/baseline/topicWords.v1.ts` — 신규, `git show ea8746d` 의 v1 동결본(import 경로만 변경, src 는 import 하지 않음).
- 건드리지 않음: `prisma/schema.prisma`·`learning/**`·`components/**`·`app/**`·`conversation/index.ts`(새 export 는 배럴에 올리지 않았다 — 필요하면 developer 가 한 줄 추가).

### 설계 결정과 근거
1. **키 순서 = `…valid` 뒤에 예문 둘.** 앞 6필드의 생성 조건을 v1 과 같게 두면 `valid:false` 비율·읽기 정확도가 task-042 실측과 같은 분포를 유지한다고 보았다(측정 결과 `valid:false` 0.4% 대 0.4% 로 일치). 예문을 `valid` 앞에 두는 변형(예문을 쓰다 보며 확신을 보정하게 하는 안)은 **측정하지 않았다**.
2. **예문 불량은 단어를 버리지 않는다.** 검사는 쌍 단위 — 일본어: 가나·한자·숫자·일본어 문장부호만(한글·로마자·괄호·개행 불량) + 가나 1자 이상 + 60자 이하, 한국어: 한글 1자 이상 + 가나·한자·개행 없음 + 100자 이하, 비어 있거나 null·엔진명이면 불량. 불량이면 둘 다 null, **단어는 통과**. 스키마에는 예문의 길이·문자 제약을 두지 않았다(한 단어의 예문 때문에 응답 전체가 재시도되면 대기가 두 배가 된다 — lesson@v3·v4 선례). 불변식 시험이 기존 18개 응답 × 4가지 예문 변형(없음·null·불량·500자)에서 통과 단어·버림 이유가 같음을 확인한다.
3. **예문에 표기가 들어 있는지는 검사하지 않는다.** 실측: v2 예문 252개 중 정확 포함 237개(94.0%), 미포함 15개. 그중 어간 대조로도 안 잡힌 14개를 눈으로 보니 **전부 「入れます→入れて」「温めます→温めて」 같은 ます형 활용**이고 예문은 정상이었다(나머지 1개는 확인하지 않음) — 하드 실패로 쓰면 약 5.6% 를 잘못 막는다(task-008 의 8% 경험과 같은 방향). 하니스의 「표본 점검 지표」로만 둔다.
4. **알파벳 금지 문구 보강.** 스모크 1쌍(프롬프트 보강 전)에서 12개 중 2개가 「Lサイズ」「Sサイズ」로 로마자가 들어 null 이 됐다(17%) → system 에 「알파벳도 금지 — S·M·L 은 エス・エム・エル 로」 추가. 본 측정(보강 후)에서는 252개 중 1개(「Mサイズでお願いします。」)만 걸렸다(0.4%). 로마자를 허용하지 않는 이유는 표기(textJa) 규칙과 같은 정책을 따르고 후속 읽기·TTS 정규화가 로마자를 못 다룰 가능성 때문 — 허용으로 바꾸려면 Leader 판단.
5. **수준 유도**는 지시문 한 줄(「어휘·문법은 [수준]과 같거나 한 단계 위·아래만, 어렵거나 확신 없는 표현은 섞지 않습니다」)뿐이다. 코드로 검사하지 못한다(예문 안 단어의 급수를 알 수 없음) — 표본 소견 참조.
6. **프롬프트 길이**: system 1,345 → 1,626자(+281), 스키마 631 → 771자, 요청 프롬프트 평균 2,405 → 2,826자(+421; 설계 목표 ≤3,500 안, 정상 입력 최대 3,378). 시험 문턱을 system <1,700·스키마 <850 으로 갱신(근거 기록).

### 시험·정적 검사·변이
- `node --import tsx --test src/modules/conversation/__tests__/topicWords.test.ts` **104/104**, `src/modules/conversation/__tests__/*.test.ts` 전체 **867/867** (홈 미러 `thekaiwa-pe049`, DB 접촉 없음).
- `tsc --noEmit`: 에러 9건 — **전부 task-048 작업 중 파일의 `endedAt`**(이 미러의 Prisma 클라이언트에 아직 없는 칸: `rolePlay.ts`·`replyPractice.ts`·`scripts/backfill-roleplay-endedat.ts`), 내 파일·`vocab/**` 관련 0건. 변경 파일 4개 eslint 0 오류·0 경고. 보이지 않는 문자 `git diff -- src tests` + 새 파일 모두 0건.
- **변이 9건 모두 잡힘**(scratchpad 복사본, 원복 후 `diff -rq` — `topicWords.ts`·`tests/` 동일; 차이 2건은 다른 에이전트가 작업 중인 `learning/__tests__/task010d*.test.ts` 로 내 변경과 무관): M1 예문 불량이 단어를 버림(8개 실패) · M2 한국어 한글 검사 제거(1) · M3 쌍 깨짐(3) · M4 일본어 상한 60→80(3) · M5 스키마 required 에서 exampleKo 제거(1) · M6 표기 포함을 하드 실패로(6) · M7 키 순서 변경(1) · M8 엔진명 검사 제거(2) · M9 버려지는 단어에도 예문 검사 실행 — **처음엔 못 잡았다**(fixture x03 의 valid=false 단어가 정상 예문이라) → x03 를 불량 예문으로 강화한 뒤 1개 실패로 잡힘.

### 라이브 측정 (v1 vs v2) — 합격선 판정
조건: 운영과 같은 호출 경로(`buildTopicWordsRequest` → `llm.completeJson`, task=`topicWords` fast(haiku)·20초·interactive, tier·timeout 덮어쓰지 않음), 주제 3개(cafe-order N5·ask-directions N5·travel-story N4) × 쌍 20개(팔당 20회, 주제 7/7/6), 목표 10장 → 요청 13개(`dailyWordCount` 기본 10 → `topicWordsRequestCount(10)`), 제외 목록 = 주제 기본 표현(첫날 조건), 쌍마다 같은 주제·`variant`·제외 목록. 실행 순서 **ABBA 교대**(짝수 쌍 v1→v2, 홀수 쌍 v2→v1 — 시간대와 앞 호출 위치 편향을 함께 줄이려고 단순 v1,v2,v1,v2 대신 사용), 호출 간격 1.5초, 시작 2026-10-10 01:27Z(약 10분). 429·즉시 실패 없음. 원 출력 전부 `…/scratchpad/ab.json`(rows[].words 에 모델 원문 항목), 콘솔 `ab.log`.

| 지표 | v1 (6필드) | v2 (+예문) | 차이 | 합격선 | 판정 |
|---|---|---|---|---|---|
| 호출 소요 p50 (ms) | 5,807 | 9,320 | **+3,513** | 증가분 ≤ +2,500 | **✗ 불합격** |
| 호출 소요 p95 (ms, n=20 → 19번째 값) | 7,721 | 10,602 | +2,881 | v2 총 p95 ≤ 12,000 | ✓ |
| 최대 / 평균 (ms) | 16,506 / 6,439 | 11,329 / 9,489 | +3,050(평균) | — | 참고 |
| 쌍별 차(v2−v1) p50 / p95 | — | — | +3,294 / +5,051 (19/20 쌍에서 v2 가 느림) | — | 참고 |
| 1차 통과율 (재시도 없음) | 20/20 | 20/20 = 100% | — | v2 ≥ 90% | ✓ |
| 재시도·최종 실패·타임아웃 | 0·0·0 | 0·0·0 | — | — | — |
| 항목 통과율 | 94.6% (246/260) | 97.3% (253/260) | +2.7%p | — | 참고 |
| `valid:false` 비율 | 0.4% (1/260) | 0.4% (1/260) | **+0.0%p** | 증가 ≤ +5%p | ✓ |
| 목표 장수(10) 이상 통과한 호출 | 20/20 | 20/20 | — | — | — |
| 출력 JSON 길이 평균 (문자) | 1,350 | 2,107 | **+56.1%** (p50 +55.5%) | 설계서 「≈40%」 | 설계서가 **과소 추정** |
| 요청 프롬프트 길이 평균 (문자) | 2,405 | 2,826 | +421 | ≤ 3,500 | ✓ |

- **판정: 불합격.** 4개 중 ① 증가분 p50 이 +3.5초로 합격선(+2.5초)을 1.0초 넘었다. ②③④ 는 통과. 소요 시간은 출력량에 거의 비례한다(전 40행 회귀 4.09ms/글자, r=0.68; 예문 하나 ≈ +58글자 ≈ +0.24초 → 13개 +3.1초로 실측 +3.0~3.5초와 맞음).
- **사용자가 체감할 변화**: 알려진 첫 세트 대기 6~7초는 A12 가 거의 전부이므로 v2 에서는 **약 9~10.5초**로 늘 것이다 [가능성 높음 — 선형 가산 추정, 운영 큐·DB 포함 경로는 미측정]. 엔진 20초·벽시계 30초 한도 안(v2 최대 11.3초, 20회 중 타임아웃 0).
- 주제별 p50 (v1→v2, ms): ask-directions 5,477→9,332 · cafe-order 5,913→8,882 · travel-story 5,978→9,429 — 세 주제 모두 같은 방향.
- 예문 품질 지표: 예문 null 1/253 = **0.4%**(JA_CHARS 1건), 일본어 평균 13.4자(p95 19, 최대 24) · 한국어 평균 13.9자(p95 21, 최대 29), 표기와 같은 예문(그냥 단어만 반복) 0건. 모델이 스스로 `exampleJa` 를 null 로 낸 경우 1건(통과 253개 중 예문 없는 단어가 1개뿐이고 그것이 JA_CHARS 건이므로, 이 1건은 버려진 단어의 항목이다).
- **한계(정직하게)**: 팔당 20회·단일 시간대(약 10분)·haiku·직렬 호출이라 p95 는 19번째 값일 뿐이고, v1 에 16.5초 이상치 1건이 있다(쌍별 차 −5.9초 1건의 원인). 제외 목록이 큰 후반 날(프롬프트 4K 이상)과 운영 큐 경합·DB·`startedAt` 벽시계 경로는 측정 밖. 결론(①만 미달)은 쌍별 차 분포(−5.9초 1건 제외 전부 +1.6~+5.9초)로도 뒤집히지 않는다.

### 대안 후보 (선택은 Leader·사용자 — 이 도구는 고르지 않았다)
- **ⓑ 앞쪽 N장만 예문 — 실험 팔로 측정함**(`ARMS=v1,v2b B_N=5`, 10쌍, 같은 호출 경로·ABBA·`…/scratchpad/ab-b.json`): 예문은 앞 5개 항목에만, 나머지는 null 로 두라는 한 줄만 v2 system 에 더했다(실험이지 `src` 변경 아님). v1 p50 5,976 → v2b p50 8,509 (**+2,533, 합격선 +2,500 을 33ms 넘음**; 쌍별 차 중앙값 +2,821, 범위 +767~+7,543), v2b p95 14,256(n=10 이라 최대값 = 이상치 1건, ② 12,000 초과), 평균 6,264 → 9,112, 1차 통과 10/10, `valid:false` 1/130 대 1/130, 목표 장수 이상 10/10, 출력 길이 +42%(1,352 → 1,925; 나머지 8개 항목의 `"exampleJa":null,"exampleKo":null` 도 글자를 쓴다). 예문은 색인 0~4 에서 50/50, 5 이상에서 0/80 — 지시를 정확히 따랐다. **결론: 전체 예문(ⓑ 아님)보다 약 1초 빠르지만 p50 이 합격선 경계, 이상치 1건 때문에 ②도 이 표본에서는 미달 → 깨끗한 합격이 아니다**(n=10 이라 inconclusive 에 가깝다). null 토큰 비용을 없애려면 예문 키를 스키마 optional 로 바꾸는 변형을 더 시험해야 한다 — 미측정.
- **ⓐ 예문을 카드 뒤집을 때/세트 시작 직후 별도 호출로 채움**: 첫 세트 대기는 v1 그대로(약 5.8초)로 유지된다. 대신 LLM 호출이 세트당 1회 더 생기고(단어 13개의 예문만 쓰면 위 회귀로 약 3~4초 분량 [추정]) 카드 시점에 아직 안 왔을 때의 화면 상태·저장 시점·큐 점유(회화 턴과 같은 직렬 큐)를 정해야 한다 — **미측정**.
- **ⓒ DB 칸만 두고 예문 보류**: 지연 변화 0 (v1 그대로). 사용자 가치(처음 보는 단어의 문맥)는 뒤로 미룸.
- **ⓓ (추가 아이디어, 미측정)** 요청 장수 여유 배수 1.3 을 낮춤(예: 1.15 → 12개). 이번 측정에서 목표 이상 통과 20/20·항목 통과율 97%였지만 후반 날(제외 목록 큼)에는 통과율이 떨어지므로(task-042 깊은 체인) 후반 날 측정 없이는 권하지 않는다. 출력 −8% 정도(약 −0.5초) [추정].

### 예문 품질 표본 (v2 출력 252개 중 무작위 15개, seed 49) — 원어민 검수 아님
| # | 주제/수준 | 단어 (읽기: 뜻) | 예문 | 번역 | 소견 |
|---|---|---|---|---|---|
| 1 | ask-directions N5 | 踏切 (ふみきり: 건널목, 횡단보도) | 踏切を越えてください。 | 건널목을 건너세요. | 문장 자연. 「횡단보도」 뜻은 부정확(단어 쪽, v1 과 같은 위험). 踏切·越える 가 N5 주제 ±1 창을 넘을 수 있음 [추측] |
| 2 | cafe-order N5 | かわいい (かわいい: 귀여운, 예쁜) | このケーキ、かわいいですね。 | 이 케이크, 귀엽네요. | 자연 |
| 3 | ask-directions N5 | 歩きます (あるきます: 걸어요, 걷다) | 駅から五分くらい歩きます。 | 역에서 5분 정도 걸어요. | 자연 |
| 4 | ask-directions N5 | 信号 (しんごう: 신호등) | 信号を渡ってください。 | 신호등을 건너세요. | △ 「信号を渡る」는 통용되지만 「横断歩道を渡る」가 더 자연스러움, 한국어 「신호등을 건너다」도 어색 [추측] |
| 5 | ask-directions N5 | 左に (ひだりに: 왼쪽으로) | 次の信号で左に曲がります。 | 다음 신호등에서 왼쪽으로 꺾어요. | 자연 |
| 6 | travel-story N4 | 楽しかったですか (たのしかったですか: 재미있었어요?) | 京都の旅、楽しかったですか。 | 교토 여행, 재미있었어요? | 자연 |
| 7 | ask-directions N5 | 見えます (みえます: 보입니다, 보이다) | そこから銀行が見えます。 | 그곳에서 은행이 보입니다. | 자연 |
| 8 | ask-directions N5 | どの道 (どのみち: 어느 쪽 길) | どの道で行きますか？ | 어느 길로 가실 건가요? | ✗ 「どのみち」의 일반 뜻은 「어차피」 — 카드 뜻이 어긋나고 예문도 부자연. 단어 쪽 오류(`valid` 가 거르지 못함) |
| 9 | travel-story N4 | 毎日 (まいにち: 매일) | 毎日温泉に入りました。 | 매일 온천에 들어갔어요. | 자연(번역이 직역투) |
| 10 | travel-story N4 | 歩きました (あるきました: 걸었다) | 朝早く起きて、海沿いを歩きました。 | 아침 일찍 일어나서 해변을 따라 걸었어요. | 자연 |
| 11 | ask-directions N5 | どのくらい (どのくらい: 얼마나, 어느 정도) | 駅までどのくらいですか。 | 역까지 얼마나 걸려요? | 자연 |
| 12 | travel-story N4 | 乗りました (のりました: 탔다, 탑승했다) | 初めて新幹線に乗りました。 | 처음으로 신칸센을 탔어요. | 자연 |
| 13 | ask-directions N5 | 渡ります (わたります: 건너요, 건넌다) | 信号を渡ったら駅です。 | 신호를 건너면 역이에요. | △ #4 와 같은 「信号を渡る」 |
| 14 | travel-story N4 | びっくりしました (びっくりしました: 깜짝 놀랐어요, 놀랐어요) | 景色の美しさにびっくりしました。 | 풍경의 아름다움에 놀랐어요. | 자연(景色·美しさ 는 N3 대 — N4 주제 ±1 안) |
| 15 | travel-story N4 | 三日間 (みっかん: 3일간) | 京都に三日間泊まりました。 | 교토에 3일간 묵었어요. | 자연 |

15개 중 문제 없음 12 · 어색 2(#4·#13) · 오류 1(#8, 단어 쪽). 수준 이탈 의심은 #1 한 건 [JLPT 목록과 대조하지 않은 기억 기반 추정]. 표본 15개는 내 읽기이며 원어민 검수가 아니다.

### 미해결·NOT_VERIFIED
- 운영 경로(DB·큐 경합·벽시계 `startedAt`·후반 날 긴 제외 목록)에서의 지연, 예문을 `valid` 앞에 두는 변형, ⓐ·ⓓ·「optional 키」 변형, 로마자 허용 정책의 영향(TTS·읽기 줄)은 측정하지 않았다.
- `docs/design-spec.md` §8 A12 행의 「예문 없음」 문구와 `docs/design/challenge.md` §4-3a E3 행의 「≈40% 증가」 서술은 이번 실측(+56%, p50 +3.5초)으로 갱신이 필요하다 — Leader 사전 협의 전이라 **수정하지 않았다**. Prompt Registry: `package.json` 에 `prompts:sync` 스크립트가 없고 `scripts/*.ts`·`prisma/seed*.ts` 에서 topicWords 버전 목록을 찾지 못했다(grep 0건). 버전은 `route.ts` 드라이버가 `TOPIC_WORDS_PROMPT_VERSION` 을 Trace 의 `promptVersion` 으로 싣는 구조라 상수 변경만으로 반영된다 [확실: grep·route.ts 읽기 기준, 레지스트리 서버 쪽은 확인하지 않음].
- 이 미러의 `tsc` 에 남은 9건은 task-048 의 `endedAt`(Prisma 클라이언트 재생성 전) — 이 task 와 무관.
- 다음 첫 행동(Leader): 사용자에게 ① 그대로 진행(+3.5초 수용) ② ⓑ(경계, 추가 측정 가능) ③ ⓐ ④ ⓒ 중 선택을 묻는다. ⓑ 를 택하면 PE 가 optional-키 변형·N 값별 측정을 이어서 한다.

## 사용자 결정 — 라이브 측정 게이트 결과 (2026-10-10, Leader 기록)
- PE 측정(`topicWords` v1 vs v2 각 20회, 교대, 운영과 같은 호출 경로): **증가분 p50 +3.5초(5.8→9.3초) — Leader 제안 합격선(+2.5초) 초과**, 나머지 3기준(총 p95 10.6초 ≤ 12초 · 1차 통과 20/20 · `valid:false` 증가 +0.0%p)은 통과. 출력 길이는 +56%(설계서 추정 ≈40% 과소).
- 사용자가 선택지 질문(AskUserQuestion)에서 **「그대로 진행 (+3.5초 수용)」** 선택. 합격선은 Leader 가 제안한 값이었고 사용자가 이 초과를 수용했다. 대안(앞쪽 N장만·별도 호출·보류)은 채택하지 않음. 알려진 첫 세트 대기 6~7초 → 약 9~10.5초 [가능성 높음 — 선형 추정, 운영 큐 경로 미측정]. 이 선택은 화면 컴포넌트 변경 없이 서버만 바꾸는 안이라 데모 게이트(화면 코드 작성에만 걸림)에 걸리지 않는다.
- 다음: 서버 구현(developer) → Reviewer → QA(QA3 챌린지 레인, 라이브 LLM) → 사용자 배포 확인.


## Developer 기록 (task-049 — 서버 저장·복제·응답)

- [10:55] developer(신규 소환, opus) — 체크포인트 1(C1 읽기·계획, 코드 변경 전). 미러 `~/.node-local/thekaiwa-e049`(node_modules 는 `thekaiwa-e048` 에서 `cp -al`, `.env` 600 복사) · sync rc=0 · `prisma generate` rc=0(새 클라이언트에 `exampleSnap` 있음, e048 클라이언트 해시 전후 동일 = 하드링크 오염 없음).

### 체크포인트 1 — C1 표 (HEAD `94518d0` 기준 파일:줄)

| # | 항목 | 위치 | 판단 |
|---|---|---|---|
| ① | AiWord 세트 저장 | `sessions.ts:561-564`(`composeTopicSessionLocked` → `insertSession`, 563 에서 `example: null` 고정) · `sessions.ts:365-370`(`insertSession` `createMany` 행: `surfaceSnap/readingSnap/meaningSnap`) · 카드 원천 `topicSet.ts:259-261`(`aiWordCard`) · **`topicSet.ts:402-414`(`recheckTopicWords` 가 5칸만 새 객체로 만들어 예문을 버린다)** | 4곳 모두 고친다. 쓰기 관문은 `insertSession` 한 곳(쌍 정규화·300자 상한·`wordId` 있는 카드는 쓰지 않음) |
| ② | 응답 카드 | `sessions.ts:130-133`(`ATTEMPT_SELECT`) · `203-220`(`toCardDto`, 209-210) · `371-376`(`insertSession` 즉시 응답, 374 `word: c.wordId ? … : null`) · **`643-654`(`toAttemptResult`, #50 응답 649-650)** | #50 도 고친다 — 화면 `useVocabDeck.ts:328-329` 가 답 응답의 `r.example ?? before?.example` 로 카드를 갱신하므로 CHOICE 세트는 #50 이 예문의 첫 출처다 |
| ③ | 스냅샷 복제 지점 | (a) #53 다시 풀기 주제 분기 `sessions.ts:850`(select)·`857-860`(`example: null`) (b) **같은 날 한 세트 더(재사용)** `topicSet.ts:199-205`(`readTodayTopicCards` select)·`252`(`todayTopicState` → `TopicCardSeed`) → `composeTopicCards` 310-315 → `sessions.ts:563` (c) #53 다시 풀기 단어장 분기 `sessions.ts:875`(삭제된 단어 카드의 스냅샷 폴백 — 단어장 카드는 예문 스냅샷을 쓰지 않으므로 변경 없음) (d) `topics/pool.ts:188-205` `topicAiWordHistory` 는 제외 목록·진행 수용 `surfaceSnap` 읽기일 뿐 카드 복제 아님 → 변경 없음 | 고칠 곳 = (a)(b). `grep surfaceSnap`: `challenges/**` 0건, 다른 `VocabAttempt` 쓰기 0건 |
| ④ | 라우트 조합·6층 | `app/api/v1/vocab/sessions/route.ts:16-20` — `assembleTopicWords` 결과(conversation `TopicWord`, 예문 필수 칸)를 learning `TopicWordsDriver.assemble` 의 구조 타입으로 넘김. learning 은 conversation 을 import 하지 않음(`task042.test.ts:842` 시험이 지킴) | 라우트 변경 없음. learning 로컬 타입(`TopicWordsOutput`·`TopicWordCandidate`)에 `exampleJa?/exampleKo?` 추가 |
| ⑤ | 카드 타입 | `src/types/vocab.ts:29-30·80-81·204-205·237-238` 에 `example`·`exampleKo` 이미 있음 | 변경 없음 |
| ⑥ | 화면 변경 필요? | `VocabCardFace.tsx:120-130·203` 은 `card.example` 이 있으면 그린다 · `useVocabDeck.ts:328-329` 는 #50 응답을 합친다 | **화면 변경 불필요**(서버가 기존 칸을 채우면 됨) |

- 계획: `topicSet.ts` 에 순수 함수 `topicExamplePair(ja, ko)`(둘 다 비지 않은 문자열·각 ≤300 코드포인트일 때만 쌍, 아니면 둘 다 null) + 상수 `TOPIC_CARD_EXAMPLE_MAX=300`. `TopicCardSeed` 에 `example/exampleKo`(필수 — 복제 지점 누락을 tsc 가 잡게), `TodayTopicCardRow` 에 `exampleSnap/exampleKoSnap`. 쿼리 수 변화 0(select 칸만 +2: `ATTEMPT_SELECT`·`readTodayTopicCards`·다시 풀기 select).
- 남은 일: C2~C5. 다음 첫 행동: `topicSet.ts` 수정. 미커밋 파일: 없음(아직 코드 변경 전).

- [11:10] 체크포인트 2 — C2~C4 코드 변경 완료(시험은 다음). 변경: `learning/vocab/topicSet.ts`(`TOPIC_CARD_EXAMPLE_MAX=300`·`topicExamplePair`·`TopicWordsOutput/TopicWordCandidate` 예문 칸(선택)·`TopicCardSeed.example/exampleKo`(필수)·`TodayTopicCardRow.exampleSnap/exampleKoSnap`+select·`todayTopicState`/`aiWordCard`/`recheckTopicWords` 가 쌍을 옮김, B1 채움 카드는 null) · `learning/vocab/sessions.ts`(`ATTEMPT_SELECT` +2칸·`exampleOf`(WordEntry > 스냅샷 > null)·`toCardDto`·`toAttemptResult`(export, #50)·`insertSession` 쓰기 관문(단어장 카드 제외·쌍일 때만 칸 기록)·주제 세트 563행·다시 풀기 주제 분기 select/매핑). 기존 시험 리터럴 타입 보정: `task008.test.ts`(1곳)·`task042.test.ts`(4곳) + task042 가짜 DB 가 `select` 를 지키게(`projectAttempt`) — 기존 58/58 통과 유지.
  - 남은 일: C5 시험(task042.test.ts 끝에 task-049 절)·변이·문서·UI 문구 점검. 다음 첫 행동: 시험 작성. 미커밋 파일: topicSet.ts·sessions.ts·task008.test.ts·task042.test.ts.

- [11:30] 체크포인트 3 — C5 시험 작성·변이 완료. `task042.test.ts` 끝에 task-049 절 8개(쌍 정규화·재검사 / #47 저장·B1 칸 없음·FLIP 응답 / #49·#50 응답·옛 행 NULL / 우선순위 WordEntry>스냅샷>null / 복제① 같은 날 재사용 / 복제② 다시 풀기 2단 / 단어장 카드 불변 / 6층 import) + 가짜 DB `projectAttempt`(select 존중 — select 에서 칸을 빼는 변이를 잡기 위해). `toAttemptResult` 를 시험용으로 export. task042 42/42. **주의(함정)**: 첫 판 재사용 시험이 시드 셔플 때문에 약 20% 확률로 깨졌다(order 0·1 로 답할 카드를 골라 예문 없는 단어가 빠질 수 있었음) → 표기로 골라 고정, 8회 반복 0 실패. 변이 11건 전부 잡힘(M1 저장 제거 3 · M2 다시 풀기 select 누락 1 · M3 재사용 select 누락 1 · M4 우선순위 반전 1 · M5 쌍 정규화 제거 2 · M6 단어장 카드에 스냅샷 1 · M7 재검사가 예문 버림 4 · M8 #50 단어장만 1→2 · M9 상한 300→400 2 · M10 다시 풀기 매핑 null 1 · M11 재사용 매핑 누락 1), 원복 뒤 `diff -rq` 차이 0.
  - 남은 일: 전체 시험·tsc·eslint·build·문서 2개·UI 문구 점검·최종 기록. 미커밋: topicSet.ts·sessions.ts·task008.test.ts·task042.test.ts.

- [11:45] 체크포인트 4(최종) — C1~C5 완료. **커밋·push·`prisma db push` 하지 않음.**

### 변경 파일 (미커밋)
| 파일 | 내용 |
|---|---|
| `src/modules/learning/vocab/topicSet.ts` (+36/−9) | `TOPIC_CARD_EXAMPLE_MAX=300`·`topicExamplePair`(쌍·공백·형·길이 → 아니면 둘 다 null) · `TopicWordsOutput.words`·`TopicWordCandidate` 에 `exampleJa?/exampleKo?` · `TopicCardSeed.example/exampleKo`(필수) · `TodayTopicCardRow.exampleSnap/exampleKoSnap` + `readTodayTopicCards` select · `todayTopicState`·`aiWordCard`·`recheckTopicWords` 가 쌍을 옮김(B1 채움 카드는 null) |
| `src/modules/learning/vocab/sessions.ts` (+25/−11) | `ATTEMPT_SELECT` +2칸 · `exampleOf`(WordEntry > 스냅샷 > null) · `toCardDto`·`toAttemptResult`(#50, 시험용 export) · `insertSession` 쓰기 관문(단어장 카드 제외, 쌍일 때만 두 칸 기록 — 같은 `createMany`) · 주제 세트 카드에 `c.example` 전달 · #53 다시 풀기 주제 분기 select·매핑 |
| `src/modules/learning/__tests__/task042.test.ts` (+190/−10) | task-049 절 8개 + 가짜 DB `projectAttempt`(select 존중) + 기존 리터럴 4곳 타입 보정 |
| `src/modules/learning/__tests__/task008.test.ts` (+1) | `attemptBase` 타입 보정(`exampleSnap/exampleKoSnap: null`) |
| `docs/design/challenge.md` | §4-3a E1 행 「≈40%」→ 실측 +56% · E3 행 실측(+56%·p50 5.8→9.3초·p95 10.6·1차 20/20·valid 0%p·사용자 수용) · 권고 문단 끝에 「2026-10-10 E3 채택」 한 줄 |
| `docs/design-spec.md` | §8 A12 행 「예문 없음」→ `topicWords@v2` 예문 포함·저장 칸 · 지연 칸에 v2 p50 9.3s/p95 10.6s |

- 화면 파일(`src/components/**`)·`topicWords.ts`·`tests/prompts/**`·task-048 파일·`prisma/schema.prisma`·`types/vocab.ts`·라우트 **변경 0**.

### 실행 증빙 (미러 `~/.node-local/thekaiwa-e049`, NFS 수정 → sync)
- `node --import tsx --test src/modules/learning/__tests__/task042.test.ts` → **42/42**(8회 반복 0 실패) · task042+task008 → 58/58(변경 전과 같은 기존 시험).
- 전체: `src/modules/learning/**`·`src/modules/conversation/**`·`src/app/**` 시험 파일 89개 → **1352/1352**, fail 0.
- `tsc --noEmit` → **0건** · 변경 파일 4개 `eslint` → 0 · `./node_modules/.bin/next build` → **rc=0**(로그의 error 단어 2건은 기존 Turbopack 경고 코드 조각 — persona·claudeCli, 이번 변경과 무관).
- 보이지 않는 문자 `git diff -- src docs` → 0건 · 엔진명 grep(`topicSet.ts`·`sessions.ts`) → 0건.

### 변이 (scratchpad `mut049/` 복사본, 원복 뒤 `diff -rq` 차이 0)
11건 전부 잡힘 — M1 저장 제거(3) · M2 다시 풀기 select 누락(1) · M3 재사용 select 누락(1) · M4 응답 우선순위 반전(1) · M5 쌍 정규화 제거(2) · M6 단어장 카드에 스냅샷 덮어쓰기(1) · M7 재검사가 예문 버림(4) · M8 #50 을 단어장 예문만으로(2) · M9 상한 300→400(2) · M10 다시 풀기 매핑 null(1) · M11 재사용 매핑 누락(1).

### UI 대기 문구 점검(읽기만, 수정 안 함)
- `src/components/vocab/topicCopy.ts:107` `genBody: '보통 10~20초 걸려요'` 1건. v2 실측 p50 9.3초·p95 10.6초(A12 호출만)라 문구 범위의 아래 끝에 들어간다 — 문구와 모순되지는 않는다 [가능성 높음 — 운영 큐·DB 포함 경로는 미측정]. 바꿀지는 Leader·designer 판단.

### 쿼리·응답 크기
- 쿼리 수 증감 **0**. select 칸만 +2(`ATTEMPT_SELECT`·`readTodayTopicCards`·다시 풀기 attempts select). 응답 필드 이름·형식 그대로(`example`·`exampleKo` 는 원래 있던 칸, 이제 새 단어 카드에도 값).

### 가이드와 달라진 점
1. **#50 `toAttemptResult` 도 고쳤다** — 지시는 세션 응답만 적었지만 화면 `useVocabDeck.ts:328-329` 가 답 응답의 `r.example` 로 카드를 채우므로, CHOICE 세트는 #50 이 예문의 첫 출처다. 안 고치면 새로 고침 전까지 예문이 안 보인다.
2. **같은 날 한 세트 더(재사용)** 도 복제 지점이었다(`todayTopicState` 가 오늘 새 단어 카드 스냅샷을 다음 세트로 옮김) — 지시 목록의 「다시 풀기·한 세트 더·세션 재생」 중 「한 세트 더」 = 이 경로. 「세션 재생」 = `replayOfId`(#53). 「오답 다시 보기」는 카드를 복제하지 않는다(#51 `wrongWords` 는 표기·뜻만, 예문 칸 없음).
3. 쓰기 관문: 쌍이 아니면 칸을 **생략**(DB 기본 NULL) — 같은 `createMany` 안에서 행마다 키가 다른 모양은 기존 `refType/refId` 조건부 펼침과 같은 방식이다. 공백만인 예문도 null.
4. 시험 기반: task042 가짜 DB 가 Prisma `select` 를 지키도록 바꿨다(select 에서 칸을 빼는 변이 M2·M3 을 잡으려고). 기존 시험 결과 불변.
5. 문서: E1 행의 「≈40%」 도 실측으로 바꿨고 권고 문단 끝에 채택 한 줄을 붙였다. **같은 파일의 다른 낡은 서술은 손대지 않음**: `challenge.md:22`(1단계에서 만들지 않는 것 — 「새 단어 예문 저장… 추가 DB 승인 필요」)·`:1146`(설계 판단 표 「E2」)·`:1248`(v2.3 후속 목록) — Leader 정리 대상.

### 알려진 한계·NOT_VERIFIED
- 실제 DB(MariaDB)로 저장·읽기를 돌리지 않았다(가짜 DB 시험만, 운영·dev 서버·라이브 LLM 호출 금지 지시). 첫 실데이터 확인은 QA3 챌린지 레인.
- 화면에서 예문이 실제로 그려지는 모양(360/390/412)·CHOICE 답 직후 표시·FLIP 첫 표시 — 미확인(QA 캡처 몫).
- 옛 행(칸 추가 전 세트)은 예문 없음 그대로(백필 안 함 — 이력서 「하지 않는 것」).
- `native_change: false`.

### Reviewer 에게 넘길 것
- `insertSession` 의 `!c.wordId` 관문: 단어장 세트 다시 풀기에서 **삭제된 단어** 카드(`wordId=null`, 스냅샷 폴백)는 예문 원천이 null 이라 칸을 쓰지 않는다 — 설계 의도와 같은지.
- `toAttemptResult` export 가 공개 API(`learning/index.ts`)에는 올라가지 않았는지(올리지 않음).
- 문서 낡은 서술 3곳(위 5).


## Reviewer 기록 (REV-177 — task-049 서버 감사)

- [2026-10-10 reviewer, sonnet 신규 소환] 대상 = 로컬 커밋 `638948d`(learning/vocab `topicSet.ts`·`sessions.ts` + 시험 2개). **불변 스냅샷**(`git archive 638948d` → scratchpad, `node_modules` `cp -al`)에서 읽고 실행. 소스·시험·설정 수정 0.
- **판정: PASS** (Critical 0 · High 0 · Medium 1 · Low 3 · Info 3). 7영역 중 해당 영역(아키텍처·안정성·성능·보안·학습 원칙·유지보수성) 검토, 운영성은 해당 변경 없음.
- **A(퀴즈 무결성) 결론: PASS** — AiWord 카드의 예문은 일반 단어(`WordEntry`)와 **같은 문 하나**(`toCardDto` `sessions.ts:212-230` `mode==='FLIP' || reveal(답함·DONE)`) 뒤에서만 나간다. CHOICE 미답·ABANDONED 카드에는 `example`/`exampleKo` 키 자체가 없다(시험 `!('example' in c)` + 변이 Me 3건 검출). 이번 변경이 새로 연 응답 경로는 없다.

### 근거 (직접 확인)
1. **A①** `exampleOf`(`sessions.ts:198-201`)는 값만 고르고, 노출 여부는 기존 게이트가 정한다. FLIP 은 api-contract(`#47` 920행 「FLIP 카드는 `meaning`·`example`·`exampleKo` 를 처음부터」)가 정한 기존 규칙이고 `meaning` 도 이미 같이 나간다. #49 는 「답한 카드만」(contract 925행)과 일치.
2. **A②** #50 `toAttemptResult` 는 답이 기록된 뒤에만 반환한다(`recordAttempt` `sessions.ts:673-700`: `flag` 는 `{order,flagged}` 만, 이미 답한 카드는 첫 결과, 새 답은 `updateMany(answer:null)` 뒤 재조회). 답 전에 재호출로 예문을 얻는 경로 없음. 일반 단어와 같은 흐름.
3. **A③** `VocabCardFace.tsx` 에서 `card.example` 은 120-130행(`side==='back'` 측정 키)과 203-209행(뒷면 본문)에서만 쓰이고, 앞면(151-180행)에는 없다. 읽기만, 수정 없음.
4. **B③ 복제 지점 독립 재탐색**(`grep surfaceSnap|readingSnap|meaningSnap|exampleSnap`): `VocabAttempt` 를 쓰는 곳은 `insertSession` 한 곳(`createMany`)뿐. 스냅샷을 옮기는 곳은 ① `insertSession`(저장 관문) ② `todayTopicState`(같은 날 재사용) ③ `replayVocabSession` 주제 분기 ④ `recheckTopicWords`+`aiWordCard` — 개발자 C1 표와 일치, **누락 없음**. 나머지는 읽기 전용: `finishResult` 오답(표기·뜻만)·`vocabRepetitionInputs`·`topicAiWordHistory`(`pool.ts:193`, 제외 목록)·`challenges/**`(0건).
5. **B①②** `topicExamplePair`(`topicSet.ts:89-95`) = 둘 다 비지 않은(`trim`) 문자열 + 각 `cp(v)≤300`(코드포인트) 아니면 둘 다 null. `insertSession` 은 `c.wordId` 가 있으면 항상 `{null,null}`(단어장 카드에 스냅샷 안 씀), 쌍일 때만 같은 `createMany` 행에 두 칸. 칸은 TEXT 라 300자(일본어 최대 ~1.2KB) 안전.
6. **B④ 개발자 질문** 「삭제된 단어 카드는 예문 스냅샷을 쓰지 않는다」 = **설계 의도와 맞음**(단어장 카드는 지금 단어를 읽는다 — 수정이 바로 보임). 단어장 카드에는 스냅샷이 애초에 없으므로 삭제 뒤 폴백 원천이 없고, 변경 전에도 `example:null` 이었다(회귀 아님). → L-3.
7. **B⑤** 같은 날 재사용은 `refId` 별 첫 행을 쓰므로 오전 v1(NULL)·오후 v2 가 섞여도 카드마다 `null`/쌍이 그대로 옮겨지고 응답은 카드 단위로 일관(시험 「복제 ①」이 예문 있는 카드·없는 카드 공존을 고정).
8. **C** 흐름: `assembleTopicWords`(conversation `TopicWord{exampleJa,exampleKo}` 쌍) → `route.ts:16-20` 구조 대입(`TopicWordsDriver.assemble`) → `runTopicWords` 의 `recheckTopicWords`(예문 쌍 재검사) → `composeTopicCards`/`aiWordCard` → `insertSession` 관문 → 응답. `route.ts` 는 변경 없이 객체가 그대로 흐른다. **스냅샷에서 진짜 함수들로 e2e 스크립트(`e2e049.ts`)를 돌려 확인**: 砂糖 예문 보존, 「Lサイズ」 예문은 L2 가 null, v1 모양 단어는 null 로 단어 유지. learning 은 conversation 을 import 하지 않음(grep 0, 시험 842행·신규 6층 시험), `userId` 조건 있음(`readTodayTopicCards` `session:{userId}`, 다시 풀기 `where:{id,userId}`), 엔진명 0, 응답 필드 이름·형식 불변(원래 있던 칸이 새 카드에도 값), `learning/index.ts` export 추가 0, 쿼리 수 증감 0(select 칸 +2).
9. **E** 부모(`23dfba3`) 기준 변경 파일 4개(`sessions.ts`·`topicSet.ts`·`task008/042.test.ts`)뿐 — `src/components`·`prisma`·native·`route.ts` 변경 0. (`git diff 94518d0 638948d` 에는 task-048 의 `rolePlay.ts`·`task048.test.ts` 가 섞여 보이는데, 그 사이 REV-176 수정 커밋 `23dfba3` 가 끼어 있기 때문 — 이 커밋의 변경이 아님.) 보이지 않는 문자 0, `topicCopy.ts:107` 「보통 10~20초 걸려요」는 실측 p50 9.3초·p95 10.6초(A12 호출만)·벽시계 30초와 모순 없음. 문서(작업 트리 미커밋 `challenge.md` E1·E3·`design-spec.md` A12)는 코드와 일치.

### 직접 실행 (스냅샷 `638948d`)
| 항목 | 결과 |
|---|---|
| 시험 `src/modules/learning/**`·`conversation/**`·`app/**` 89파일 | **1352 pass / 0 fail**(개발자 보고와 같음) |
| `tsc --noEmit` | rc=0, 오류 0 |
| eslint(변경 4파일) | rc=0 |
| `next build`(스냅샷 폴더, `sync-local` 미사용) | rc=0 (로그의 `error` 1건은 기존 `SPAWN_FAILED` 코드 조각) |
| `task042`+`task008` 12회 반복 | 12/12 통과(66/66) — 시드 셔플 불안정 재발 없음 |
| 보이지 않는 문자·엔진명 grep | 0 |

**변이 9건 직접 재현**(복사본 → python 치환 → 원복 뒤 `diff -rq` 동일): Ma 우선순위 반전 검출(1) · Mb 단어장 카드에 스냅샷 검출(1) · Mc 재검사가 예문 버림 검출(4) · Md `ATTEMPT_SELECT` 예문 칸 누락 검출(1, #49 경로) · Me CHOICE 미답에도 예문 노출 검출(3) · Mf 쌍 `&&`→`||` 검출(2) · Mi 재사용 select 누락 검출(1) · Mj 다시 풀기 매핑 null 검출(1) · **Mg 길이를 코드포인트 대신 UTF-16 길이로 → 생존(검출 0)**. (함정: 샌드박스에 `prisma/`·`docs/` 링크가 없으면 `task008` 이 로드 실패해 가짜 fail +1 이 붙는다 — 고쳐서 재실행했다.)

### 발견
| ID | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| **M-1** | Medium | `topicSet.ts:77-81`(`TopicWordCandidate.exampleJa?/exampleKo?` 선택 칸)·`route.ts:16-20`·`task042.test.ts:895-902`(가짜 driver) | 핵심 기능(예문이 L2→L3 로 건너가는 이음매)이 **선택 칸의 구조 타입 + 가짜 driver 시험**으로만 지켜진다. conversation 쪽 필드 이름이 바뀌거나 오타가 나도 tsc 는 통과(선택 칸이라 빈 값으로 보임)하고, learning 시험 1352개도 전부 통과한 채 **예문이 조용히 사라진다**. 진짜 함수 연결은 내가 스냅샷에서 e2e 로 확인했을 뿐 저장소에 시험이 없다. | ① 가장 싼 방법: 어셈블된 후보 타입(`TopicWordCandidate`)의 두 칸을 필수 `string\|null` 로 올려 `route.ts` 대입이 tsc 로 지켜지게(모델 원문 `TopicWordsOutput` 은 v1 모양 허용 그대로 선택 칸). ② 또는 `route.ts` 와 같은 조합을 진짜 `assembleTopicWords` → `recheckTopicWords` → `aiWordCard` 로 돌리는 app 층 시험 1개. 배포 전 권고(차단은 아님 — QA3 라이브가 현재 연결을 확인하게 됨). |
| L-1 | Low | `topicSet.ts:93`(`cp(v)<=300`) | 상한은 코드포인트인데 시험은 BMP 문자(`あ`·`가`)만 쓴다. 변이 Mg(UTF-16 길이) 생존 — 서로게이트 쌍(`𠮷` 등) 경계가 고정되지 않았다. 코드 자체는 맞다. | `'𠮷'.repeat(300)` 통과·`repeat(301)` null 한 쌍 추가. |
| L-2 | Low(설계 고려) | A12 `topicWords@v2` 산출 → 카드 | **같은 세트의 다른 단어가 예문에 섞여 정답 힌트가 될 수 있다.** PE 측정 `ab.json` v2 예문 259개를 거칠게 대조하면 같은 세트 다른 단어의 표기·뜻이 들어간 예문이 27개(10.4%, 표기 부분 일치도 센 **상한 추정** [가능성 높음 — 휴리스틱, 육안 검수 아님]). 예: 「入れます」 카드의 예문 「砂糖を少し入れてください」(설탕)가 CHOICE 에서 답한 뒤 나타나면 아직 안 푼 「砂糖」 카드의 뜻이 보인다. 코드 결함이 아니라 「답한 뒤 예문 공개」 계약의 부작용. | 사용자에게 알리고 수용 여부 확인(자습 앱이라 영향 작음). 줄이려면 PE 가 프롬프트에 「예문에 이 요청의 다른 단어를 쓰지 않는다」 한 줄(출력 길이 영향은 재측정). |
| L-3 | Low | `sessions.ts:889`(단어장 다시 풀기, 삭제 단어) | 단어장 카드는 스냅샷이 없으므로 단어를 삭제하면 지난 세트 결과·다시 풀기에서 예문이 사라진다. 변경 전과 같은 동작이라 회귀 아님. | 수용(설계 의도: 단어장 카드는 지금 단어를 읽음). |
| I-1 | Info | `task042.test.ts` 「#49·#50」 | #50 은 `ATTEMPT_SELECT` 가 아니라 시험이 쓴 select 목록으로 `toAttemptResult` 를 호출한다 — `recordAttempt` 전체는 안 돈다. `ATTEMPT_SELECT` 누락은 #49 경로(변이 Md)가 잡으므로 실질 공백은 작다. | 필요 시 `recordAttempt` 한 경로 시험. |
| I-2 | Info | `challenge.md:22`·`:1146`·`:1248` | 개발자 보고대로 낡은 서술 3곳(문서는 Leader 정리). | Leader. |
| I-3 | Info | 신규 시험 | 신규 8개는 대체로 의미 있는 고정(쌍 정규화·CHOICE 미답 키 부재·복제 2경로·단어장 카드 불변)이고, 가짜 DB `projectAttempt` 가 Prisma `select` 를 지켜 「select 에서 칸 빼기」 변이를 잡게 한 것은 좋은 개선이다. 6층 시험(regex 두 파일)은 약하나 기존 842행 시험이 이미 보호. | — |

### QA 인계 — `high_risk_areas` (QA3 챌린지 레인, 라이브 LLM)
1. **세트 생성 → 카드 예문**: 실제 MariaDB 저장·읽기(가짜 DB 시험만 돌았다). FLIP 은 첫 카드부터 뒷면에 예문(일·한), CHOICE 는 **답하기 전 응답·DOM 에 예문 없음**, 답한 직후 같은 카드 뒷면에 예문 표시(`useVocabDeck` 이 #50 응답으로 채움) — 360/390/412 캡처.
2. **재풀기·복제**: 같은 날 한 세트 더(LLM 0회, 예문 유지), #53 다시 풀기(주제 세트: 예문 유지 / 단어장 세트: 지금 단어 예문), 옛 행(칸 추가 전 세트)은 예문 없음.
3. **지연·실패**: 첫 세트 생성 실측(p50 약 9~10초 [가능성 높음]), 20초 호출 한도에서 JSON 재시도가 겹칠 때 B1 풀로 떨어지는 비율, `genLong` 전환 시점.
4. **예문 품질·힌트(L-2)**: 표본에서 같은 세트 다른 단어가 비치는 예문 비율, 로마자 예문이 null 이 되는 비율, 표시가 `line-clamp` 에 잘리는지.
5. **옛 운영 코드 공존**: DB 칸은 이미 적용돼 있으나 구 운영 코드는 칸을 읽지 않는다 — 배포 전후 같은 DB 에서 두 버전이 읽어도 응답이 깨지지 않는지(예문만 없음).

### NOT_VERIFIED
- 실제 DB(MariaDB) 쓰기·읽기, 라이브 LLM 호출, 서버 기동, 화면 렌더(360/390/412) — QA 몫. `native_change: false`.
- 위 L-2 비율은 휴리스틱 상한이며 육안 검수가 아니다.


## Developer 기록 (REV-177 수정 — M-1·L-1)

- [11:2x developer, sonnet 신규 소환] 대상 = 커밋 `638948d` 위 작업 트리(미커밋). 동작 변경 없음 — **타입 1곳 + 시험**. 커밋·push·`prisma db push` 안 함. `docs/**`·conversation·prisma·components 는 손대지 않았다.

### 조치
| 항목 | 조치 | 파일 |
|---|---|---|
| **M-1** 예문 이음매 | `TopicWordCandidate.exampleJa`·`exampleKo` 를 선택 칸(`?:`) → **필수 `string \| null`** 로 올림(모델 원문 `TopicWordsOutput` 은 선택 칸 그대로). `tsc` 확인: **`route.ts` 는 수정 없이 통과**(conversation `TopicWord` 가 이미 필수 `string \| null` 이라 구조 대입이 그대로 성립) — 오류는 시험 보조 3곳(`toCandidate`·`dup`·`w` 헬퍼)뿐이라 두 칸을 채움. 이제 conversation 쪽 이름이 바뀌면 `route.ts:18` 이 컴파일에서 깨진다(변이 M1). | `src/modules/learning/vocab/topicSet.ts`(타입+주석), `src/modules/learning/__tests__/task042.test.ts`(보조 3곳·`toCandidate` 예문 옮김·`exDriver` = `passDriver` 별칭) |
| **M-1** 진짜 연결 시험 | **app 층 시험 신규** — route.ts 를 require 캐시 방식(`task045T4Routes` 와 같음)으로 읽어 `createVocabSession` 가짜가 받은 `topicWords` driver 를 꺼내, `driver.assemble` 이 **진짜 `assembleTopicWords`** 임을 고정: 좋은 예문은 `exampleJa/exampleKo` 로 그대로, 로마자 예문·쌍 아님·v1 모양은 null 이면서 단어 4개 유지, 출력 키가 learning 후보 키와 정확히 같음(`satisfies Record<keyof Candidate, true>` 로 전수 대조). | `src/app/api/v1/__tests__/task049TopicWordsSeam.test.ts`(신규) |
| **L-1** 서로게이트 경계 | `'\u{20BB7}'`(𠮷, UTF-16 2칸)`×300` 통과·`×301` 둘 다 null, 번역 쪽 같은 기준, `recheckTopicWords` 경로(단어 유지·예문만 갈림). | `task042.test.ts` |

### 가이드와 달라진 점 (판단 필요 — 보고)
1. **「assembleTopicWords → recheckTopicWords → aiWordCard → 저장」을 시험 한 개로 잇지 못했다.** 이유: ESLint 6층(`eslint.config.mjs:105`)이 `src/modules/learning/**` 의 `@/modules/conversation` import 를 **테스트 파일에도** 금지한다(실제로 task042 에 넣어 보니 `no-restricted-imports` 오류 — 테스트 면제는 *상대 경로 탈출*에만 적용). 상대 경로로 우회하면 6층 금지를 린트 허점으로 피하는 것이라 하지 않았다. app 층 시험은 learning 내부(`recheckTopicWords`·`aiWordCard`)를 못 본다(index 비공개). 그래서 **두 쪽으로 나눠 같은 후보 키에서 만나게** 했다 — ① app 시험(위): 진짜 L2 출력 키 = learning 후보 키 ② task042: 그 키로 만든 후보가 서버 재검사 → 카드 → 저장 행·FLIP 응답까지(기존 시험, 이제 필수 타입으로 지켜짐). 두 쪽을 하나로 잇고 싶으면 `recheckTopicWords` 를 index 에 내보내거나 fake DB 를 공용 헬퍼로 빼야 한다(설계 변경 → Leader 판단).
2. 가이드는 시험 파일을 task042 로 한정했지만, 위 이유로 app 층 신규 시험 파일 1개를 추가했다.
3. 상한은 **코드포인트 기준**(`topicSet.ts` 의 `cp = [...s].length`) — REV-177 「코드는 맞음」과 일치, 코드 변경 없이 시험만 추가.

### 실행 증빙 (미러 `~/.node-local/thekaiwa-e049`, NFS 수정 → sync, `DATABASE_URL` 가짜)
| 항목 | 결과 |
|---|---|
| `task042` + 신규 seam | 44/44 + 1/1 |
| `src/modules/learning/**`·`conversation/**`·`app/**` 전체 | **1354 pass / 0 fail**(이전 1352 + 신규 2) |
| `tsc --noEmit` | rc=0 |
| eslint(변경 3파일) | rc=0 (첫 시도에서 task042 의 conversation import 가 6층 규칙에 걸려 위 1번 결정) |
| 보이지 않는 문자(`git diff -- src`·신규 파일) | 0건 |

### 변이 5건 (scratchpad `mut049b/` 복사본, 원복 뒤 `diff -rq` 차이 0)
| 변이 | 결과 |
|---|---|
| M1 conversation 에서 `exampleJa` → 다른 이름(인터페이스+push 함께) | **tsc 4건, `route.ts(18,27)` 포함** + 신규 seam 시험 실패 |
| M2 후보 타입을 다시 선택 칸으로 + 같은 이름 변경(원래 M-1 결함 재현) | tsc 에서 `route.ts` 는 **안 잡힘**(오류 3건 전부 conversation 자체 시험 `topicWords.test.ts`) — 선택 칸이 구멍이었음을 확인 · 신규 seam 시험은 **실패(검출)** |
| M3 상한 비교를 `v.length` (UTF-16) 로 | 서로게이트 시험 실패(검출) — REV-177 의 생존 변이 Mg 닫힘 |
| M4 `recheckTopicWords` 가 예문을 버림 | task042 5건 실패 |
| M5 `route.ts` driver.assemble 이 예문을 버림 | 신규 seam 시험 실패 |

### 미해결·NOT_VERIFIED
- 위 「달라진 점」 1번의 끝-대-끝 단일 시험은 구조상 불가 — 필요하면 Leader 가 `recheckTopicWords` 공개 또는 공용 fake DB 헬퍼 여부 결정.
- L-2(예문이 다른 단어 힌트가 되는 문제)·L-3·I-1~I-3 은 이번 지시 밖(손대지 않음).
- `next build`(미러 `thekaiwa-e049`, `./node_modules/.bin/next build > 파일`) **rc=0**.

### 인계 — 미커밋 파일
`src/modules/learning/vocab/topicSet.ts` · `src/modules/learning/__tests__/task042.test.ts` · `src/app/api/v1/__tests__/task049TopicWordsSeam.test.ts`(신규)


## QA 기록 (qa-049 — 주제 단어 예문 라이브 실흐름)

- [qa-049 시작] 서버 `http://127.0.0.1:3075`(커밋 `10cd615` 스냅샷, `/api/health` status=degraded 는 `stt_analysis_worker` 만 false — 이번 항목과 무관), QA3 = `qa-bot3@thekaiwa.test`. 원 출력: `scratchpad/q049/{q1.log,q1c.log,baseline-counts.txt}`.
- **시작 전 행 수 (QA3, 읽기 전용 집계)**: Challenge 0 · VocabSession 0 · VocabAttempt 0 · RepetitionItem 0 · StudyLog 0 · StatsSnapshot 0 · WordEntry 0 · RequestTrace 1(기존 1건, 정리 때 보존) · AiJob 0 · Chat 0 · LearningObservation 0. QA4 = RequestTrace 73 외 전부 0(역할극 회귀 때 Chat 계열 전후 비교용).
- **함정 기록**: ① 서버는 사용자당 하루 A12 생성 시도 상한 3(`TOPIC_WORDS_DAILY_ATTEMPTS`, **서버 메모리**, 재기동 금지라 못 풀음) → 이번 서버에서 QA3 의 새 생성은 최대 3회(S1~S3 로 모두 소진) ② 내 스크립트의 「다른 claude 프로세스 대기」 점검이 명령줄에 들어간 문구 때문에 가짜 양성이 되어 90초씩 낭비(첫 실행이 S3 직전에 timeout) → 점검은 별도 호출로, 스크립트에서는 제거.

### Q1 정상 경로 (QA3, 챌린지 `T1 카페 주문` 7일·words 10장 생성 200 후 3세트)
| # | 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| ① | 생성 소요(요청→응답 ms) | PE p50 9.3초·p95 10.6초와 비교 | S1 FLIP 카페 주문 N5 **9,344** · S2 CHOICE 길 묻기 N5 **9,387** · S3 CHOICE 주말 계획 N4 **11,643** (A12 Trace totalMs 8,581 / 8,719 / 9,697). p50(응답) 9,387 · 최대 11,643. **B1 풀 폴백 0/3**(전부 `source=AI`, `reason=null`, AI 카드 10/10) | PASS(수치 기록) |
| ② | DB `exampleSnap`·`exampleKoSnap` 쌍·길이 | 둘 다 값 or 둘 다 NULL, ≤300자 | 3세트 AiWord **30행 전부 쌍 일치, 30/30 값 있음(NULL 0)**, 최대 길이 일본어/한국어 합쳐 25자 | PASS |
| ③ | CHOICE 답 전 #47·#49 에 `example`·`exampleKo` 키 없음 / 답한 뒤 #50 에 예문 | 키 부재 / 예문 | S2·S3 #47 카드 10장 전부 `example`·`exampleKo`·`meaning` 키 없음, S2 답 전 #49 도 동일, **응답 원문에 DB 예문 텍스트 부재(문자열 검색)**; #50 응답 키 `order,answer,correctText,chosenText,example,exampleKo,answeredAt,flagged`, 예문 「次の信号で左に曲がります。/다음 신호등에서 왼쪽으로 꺾습니다.」 일치 | PASS |
| ④ | FLIP #47 카드에 예문 | 실림 | S1 AiWord 10/10 카드에 `example`·`exampleKo`(DB 값과 일치) | PASS |
| ⑤ | #49 이어가기 일관 | 일관 | FLIP #49 = #47(order·example·exampleKo 동일). CHOICE 1장 답 후 #49: 답한 카드만 예문·안 푼 9장은 키 없음. DONE 후 #49: 예문 있는 10장 전부 공개 | PASS |
| ⑥ | 일반 단어장(`wordId` 있음) 카드 불변 | `WordEntry` 값 그대로 | Q2 단계에서 단어장 단어를 만들어 확인 예정 | (Q2 스크립트에서) |

**예문 표본 5개(단어 / 예문 / 번역)**: 大きい / 大きいサイズをください。 / 큰 사이즈 주세요. · 濃い / コーヒーは濃いのをください。 / 커피는 진한 것으로 주세요. · 角 / 角のコンビニが目印です。 / 코너의 편의점이 표시입니다. · デート / 週末はデートの予定があります。 / 주말에 데이트 예정이 있어요. · 天気 / 週末の天気はどうですか。 / 주말 날씨가 어떨까요?(번역 「어떨까요」는 원문 「どうですか」보다 약간 의역 — 원어민 검수 아님)

- **남은 일**: Q2(① 같은 날 한 세트 더·② 주제 다시 풀기·③ 단어장 세트+단어장 다시 풀기·⑥ 단어장 카드 불변·④ 옛 행 NULL·⑤ task-048 역할극 QA4) → Q3 캡처 → 정리. **다음 첫 명령**: Q2 스크립트(scratchpad `qa049-q2.mts`). **주의점**: 서버 3075 실행 중(끄지 않음)·쿠키 `scratchpad/q049/cookie3`(끝에 삭제)·QA3 에 챌린지 1(T1)·세트 3(DONE)·AiWord 30행·RepetitionItem 생김(정리 미실시). **미정리**: 위 행 전부 + RequestTrace(QA3 topicWords 3건 포함) + StudyLog/StatsSnapshot 증가분.

### 체크포인트 2 — Q1⑥ + Q2 (LLM 호출 0: 재사용·다시 풀기·단어장·옛 행 / 역할극만 LLM)
원 출력: `scratchpad/q049/q2.log`(Q2① 3줄 + 오류 종료: 처음엔 #53 이 「보관한 세트만」이라 409 → `/keep` 을 먼저 부르게 스크립트 수정, 우리 쪽 시험 스크립트 오류) · `q2b.log`(나머지) · `q2e.log`(task-048).

| # | 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| Q1⑥ | 단어장 단어(`wordId` 있음) 카드 | 응답 예문 = `WordEntry` 값, 시도 행 스냅샷 NULL | QA3 단어 5개(예문 4·예문 없는 「本」 1) 로 FLIP 단어장 세트 5장: 응답 `example` 이 5장 모두 `WordEntry.example` 과 일치(「本」은 null), 시도 행 `exampleSnap/exampleKoSnap` 전부 NULL(스냅샷 안 씀) | PASS |
| Q2① | 같은 날 한 세트 더(T1 FLIP) | LLM 0·예문 유지 | 395 ms · `generation {source:MIXED, generatedNow:false, reason:NEW_DONE}` · RequestTrace(topicWords) 3→3 · AiJob 0→0 · AI 카드 8장(S1 에서 2장 답해 제외, refId 8/8 일치) 의 DB 쌍이 S1 원본과 동일 + FLIP 응답 카드 8/8 에 예문 + 단어 은행(B1) 2장은 예문 없음 | PASS |
| Q2② | #53 주제 세트 다시 풀기 | 예문 유지·LLM 0 | FLIP 세트(S1): 200·Trace/AiJob 불변·AI 10/10 DB 쌍 = 원본, 응답 카드 10/10 동일. CHOICE 세트(S2): 답 전 카드 키 없음 + DB 쌍 유지(10행), 답한 뒤 #50 에 예문 「交差点を右に曲がってください。」 | PASS |
| Q2③ | 단어장 세트 다시 풀기 | 기존 동작 | 200·카드 5장·예문 `WordEntry` 값 유지. 단어 「水」를 지운 뒤 다시 풀기도 200(깨지지 않음), 삭제된 단어 카드 `example=null`(REV-177 L-3 예상 그대로 — 스냅샷 없음) | PASS |
| Q2④ | 옛 행(NULL 쌍) | 오류 없이 예문 없음 | S3 의 한 시도 행(`デート`)만 `exampleSnap=exampleKoSnap=NULL` 로 UPDATE(QA3 가 만든 행 1개): #49 200·그 카드만 example 없음·나머지 9장 예문 유지 / 그 세트 다시 풀기 200·NULL 쌍은 NULL 로 복제·나머지 9장 유지 | PASS |
| Q2⑤ | task-048 회귀(QA4, 10cd615 서버) | endedAt 저장·재마치기 replayed:true | 시나리오 201→시작→턴 2→마치기 200 `endedAt=2026-10-10T02:31:45.137Z` `replayed:false` outcome ACHIEVED, DB `Chat.endedAt`==응답==관측 `occurredAt`(ms 일치), 재마치기 200 `replayed:true` 같은 `endedAt`·StudyLog 1·관측 1 불변, 마친 뒤 턴 409. 9/9 PASS. **정리 후 QA4 전 표 수가 시작 전과 동일**(Chat/ChatMessage/Correction/관측/StudyLog/RepetitionItem/StatsSnapshot/Scenario 0 · RequestTrace 73 · Attendance 3 · AiJob 0, `COUNTS_EQUAL true`) | PASS |

- LLM 호출: Q2①~④ 0회(Trace·AiJob 불변으로 확인), Q2⑤ 턴 2 + 판정 1(역할극 마치기), 직렬 단독 실행.
- **남은 일**: Q3 화면 캡처(360/390/412 × FLIP 뒷면·CHOICE 답 직후·긴 예문·후리가나/한글 읽기 켬·끔) → 정리 → 최종 보고. **다음 첫 명령**: 화면 스크립트(scratchpad `qa049-q3.mts`/`.mjs`). **주의점**: 서버 3075 실행 중, QA3 쿠키 `scratchpad/q049/cookie3`·QA4 쿠키 `cookie4`(끝에 삭제). QA3 에 챌린지 1·세트 여러 개·단어 4(「水」는 삭제됨)·예문 NULL 로 바꾼 행 1개 있음. **미정리(QA3)**: Challenge 1·VocabSession·VocabAttempt·RepetitionItem·StudyLog·StatsSnapshot·WordEntry 4·RequestTrace(topicWords 3)·AiJob(없음 확인 예정).

### 체크포인트 3 — Q3 화면 캡처 (실서버 3075 · Playwright)
**재현 조건(데모 게이트 §8)**: viewport 360×740 / 390×844 / 412×892 · DSF 2.625 · `isMobile`+`hasTouch` · Chrome(`/usr/bin/google-chrome` headless, playwright-core) · light(앱 기본, 다크 미검증) · locale ko-KR · timezone Asia/Seoul · `reducedMotion: reduce`(애니메이션 비활성) · 이동 `networkidle` + 1.2초 + 조작 뒤 2.5초(글꼴·후리가나 분석 로드 대기) · 네트워크 fixture **미사용(실서버 실데이터)** — 단 후리가나/한글 읽기 켬·끔은 `GET /api/v1/settings/profile` 응답의 `showFurigana`·`showHangul` 만 브라우저에서 바꿔 끼움(DB 쓰기 0, PUT 시도 0건) · 캡처 범위 = 뷰포트 전체(카드 + 하단 조작부) · 허용 범위: 가로 넘침 0·카드 뷰포트 안·44px 미만 터치 대상 0. 원 출력 `q3-360.log`·`q3-390.log`·`q3-412.log`.
**캡처 상태 7종 × 3폭 = 21장** — 파일: `scratchpad/q049/shots/{flip-back-reading-on, flip-back-reading-off, choice-answered-reading-on, choice-answered-reading-off, flip-back-long-reading-on, choice-answered-long-reading-on, choice-answered-long-reading-off}-{360,390,412}.png`. 세션은 실제 서버가 만든 AI 세트(S1 FLIP·S2 CHOICE)를 #53 다시 풀기로 복제(LLM 0)해 사용. **긴 예문**은 실제 모델 출력이 아니라 QA3 가 만든 시도 행 1개(order 0)의 예문 칸을 직접 UPDATE 한 합성 데이터: 일본어 50자(서버 상한 60 = `EXAMPLE_JA_LEN`)·한국어 57자 — 실측 예문은 15~25자 안팎이라 이 사례는 상한 근처의 최악 사례.

| 폭 | 가로 넘침(`scrollWidth-clientWidth`) | 뷰포트 오른쪽을 넘는 요소 | 44px 미만 터치 대상 | 페이지 세로 스크롤 | 엔진명·model_id 노출 | 카드 위치(left,top,right,bottom) |
|---|---|---|---|---|---|---|
| 360 | 0 (7/7) | 0 | 0 | 없음 | 없음 | 예: FLIP `49,197,311,537` · CHOICE `49,135,311,398` (뷰포트 폭 360 안) |
| 390 | 0 (7/7) | 0 | 0 | 없음 | 없음 | FLIP `52,258,338,598` · CHOICE `52,157,338,497` |
| 412 | 0 (7/7) | 0 | 0 | 없음 | 없음 | FLIP `54,273,358,613` · CHOICE `54,173,358,513` |

- **보통 예문(실제 모델 출력, 15~25자)**: 21장 중 보통 예문 12장 전부 일본어 2줄 칸·번역 1줄 칸이 **잘리지 않음**(scrollHeight = clientHeight, 예: 26/26·37/37·21/21). FLIP 뒤집은 카드·CHOICE 답한 직후 카드 모두 예문 일본어·한글 읽기(켬)·한국어 번역이 보임. 끔 상태에서는 한글 읽기 줄·후리가나가 사라지고 일본어+번역만.
- **긴 예문(합성, 최악)**: 일본어 `line-clamp-2` **잘림**(예: 390 FLIP 켬 scrollHeight 141 → clientHeight 72, 즉 약 4줄 중 2줄만 보이고 `…`), 한국어 번역 `line-clamp-1` 잘림(63→21), 예문 한글 읽기 줄 `line-clamp-1` 잘림(59→20). 360 CHOICE 켬에서는 한글 읽기 줄이 자동으로 빠짐(레이아웃 `dropLevel`)·그 외 폭에서는 1줄만 보임. 읽기 끔은 일본어 102/51 잘림. 가로 넘침·화면 밖 밀림 없음(카드 안에서 잘리는 것). **관찰(Low·외관)**: 켬 + 긴 예문에서 일본어 3번째 줄 후리가나(ルビ) 윗부분 조각이 `line-clamp` 경계 아래 한글/번역 줄 위에 가는 잔상으로 비친다(360 CHOICE·390 FLIP 캡처). 읽기 가능성에는 영향 작음, 상한(60자) 근처 예문에서만.
- 판정: **PASS** (가로 넘침 0·화면 밖 0·터치 44px 위반 0·엔진명 0, 21장 캡처 확보). 다크 모드·실기기 WebView 는 이번 항목 범위 밖(NOT_VERIFIED).
- **남은 일**: 정리(QA3 전 행·쿠키·임시 스크립트·서버 로그 확인)·최종 보고·일지 한 줄. **다음 첫 명령**: scratchpad `qa049-clean.mts` 로 QA3 정리(Challenge·관측·StudyLog·스냅샷·RepetitionItem·시도·세션·단어·RequestTrace·AiJob 중 이번 실행분). **미정리**: QA3 위 전부 + 캡처 PNG 21장(scratchpad, 보고 뒤 삭제).

### 체크포인트 4(최종) — 정리·최종 판정 (qa-049)
**정리 결과(`q049/clean.log`·`att2.log`)**: QA3 삭제 — Challenge 1 · 관측 155 · StudyLog 16 · StatsSnapshot 17 · RepetitionItem 13 · 시도 295 · 세션 31 · 단어 4 · RequestTrace 3(topicWords, cutoff 이후분만) · AiJob 0 · **Attendance 1**(캡처용 브라우저가 앱을 열어 생긴 오늘자 `APP_OPEN` 행 — 내가 만든 것이라 삭제, 처음엔 놓쳐서 정리 뒤 스캔으로 발견). **QA3 의 userId 칸 보유 전 표 수 = 시작 전과 동일**: Attendance 2(10-07·10-08 기존) · Profile 1 · RequestTrace 1(기존 `scenarioVariant` 1건) · UserSpeechSetting 1, 나머지 0(`information_schema` 로 userId 칸 있는 전 표 스캔). **QA4 도 전후 동일**(`COUNTS_EQUAL true`, 스캔 재확인: Attendance 3·Profile 1·RequestTrace 73·UserSpeechSetting 1·UserVoiceSetting 1). QA 계정 전체에 챌린지·세트 잔존 0. 공유 DB 에 `exampleSnap/exampleKoSnap` 값이 남은 시도 행 0(cutoff 이후 세션 기준). QA3 Profile 표시 설정은 건드리지 않음(브라우저 응답 가로채기만, PUT 0). 서버 로그 `qa049-server.log`: error·unhandled 0건, A12 호출 3회 모두 `attempt=1`(1차 통과 3/3, 재시도 0), 끝에 `[claudeCli] 취소 elapsed=11ms` 1줄(task-048 마친 뒤 턴 409 시험 때 즉시 취소로 추정 [추측] — 오류 아님).

**최종 판정: PASS (Critical 0 · High 0 · Medium 0 · Low 1(외관) · Info 3)** — Q1 ①~⑥ · Q2 ①~⑤ 전부 PASS, Q3 가로 넘침 0·캡처 21장·정리 후 행 수 불변. 시험 합산(스크립트 PASS 줄) Q1 14 + Q2 11 + task-048 9 = 34/34(스크립트 버그로 중간에 끊긴 2회는 재실행, 위 함정 기록).

**발견·관찰**
| ID | 심각도 | 내용 | 재현·근거 |
|---|---|---|---|
| QA-049-L1 | Low(외관) | 긴 예문(상한 60자 근처)에서 후리가나 켬 상태일 때 일본어 3번째 줄 후리가나 윗부분 조각이 `line-clamp-2` 경계 아래, 한글 읽기/번역 줄 위에 가는 잔상으로 비친다 | 합성 예문(일본어 50자) 시도 행 1개 UPDATE → 390 FLIP 켬·360 CHOICE 켬 캡처 `flip-back-long-reading-on-390.png`·`choice-answered-long-reading-on-360.png`. 실측 예문은 15~25자라 평소에는 안 나옴. 화면 컴포넌트는 designer 영역 — 수정은 Leader 판단 |
| QA-049-I1 | Info | 긴 예문은 잘림(`line-clamp`), 전체를 볼 방법 없음 — 일본어 2줄 칸 141→72px·번역 1줄 칸 63→21px 잘림. 보통 예문 12장은 전부 안 잘림 | 위 Q3 표 |
| QA-049-I2 | Info | **REV-177 L-2(같은 세트의 다른 단어가 예문에 비침) 재확인, 비율 산정 불가(NOT_VERIFIED)** — 출력된 표본 10개 중 최소 2건이 같은 세트 다른 카드의 표기를 포함: S1 「大きい」예문 「大きいサイズをください。」→ 같은 세트 「サイズ」(사이즈)·S2 「左に」예문 「次の信号で左に曲がります。」→ 같은 세트 「信号」(신호등, 캡처에서 S2 복제 세트에 있음 확인). CHOICE 에서 「左に」를 답하면 아직 안 푼 「信号」의 뜻이 보인다. **정리 때 30개 예문 전체가 삭제되어 비율은 못 셈**(하루 3회 상한이 이번 서버에서 소진돼 재생성 불가, 다른 QA 계정 사용은 지시 범위 밖이라 안 함). 퀴즈 무결성의 코드 경로(답 전 예문 키 부재)는 PASS 이며 이 건은 콘텐츠 성격 | 로그 `q1.log`(표본), 캡처 `choice-answered-reading-on-390.png`(信号 카드) |
| QA-049-I3 | Info | 하루 A12 생성 상한 3회(`TOPIC_WORDS_DAILY_ATTEMPTS`, 서버 메모리)가 새 생성 표본을 3개로 묶음 — 재기동 금지라 못 풀었음. 생성 소요 p50/p95 는 n=3 이라 PE 측정(n=20)의 대체가 아님 | 시작 전 `topicSet.ts:35` 읽기 |

**검증한 것 vs 못 한 것**
- 실 DB·실 LLM 왕복: 새 단어 30행 쌍 일치·NULL 0·최대 25자, CHOICE 답 전 응답에 키·텍스트 모두 부재, 답한 뒤 #50 에만 예문, FLIP 처음부터, #49 일관, 같은 날 재사용(LLM 0·예문 8/8 유지)·다시 풀기(FLIP/CHOICE 주제·단어장·단어 삭제 뒤)·옛 행 NULL 공존, 단어장 카드는 `WordEntry` 값 그대로, 역할극 endedAt 회귀.
- NOT_VERIFIED: ① 예문 NULL 비율의 일반화(실모델 30/30 이 값 있음 — 표본 3세트뿐, 불량 null 발생 경로는 단위 시험이 고정) ② L-2 비율(위) ③ 구 운영 코드(칸을 안 읽는 버전)와 같은 DB 공존 응답 — 코드 읽기만, 이번에 구 버전을 띄우지 않음(QA3 `high_risk_areas` 5번) ④ 다크 모드·실기기 WebView·모바일 Chrome(S25+) 실제 렌더 — 데스크톱 Chrome 모바일 에뮬레이션만 ⑤ 20초 한도에서 JSON 재시도가 겹칠 때 B1 폴백 비율(이번 3회 모두 `attempt=1` 로 0건, 재시도 경로는 미발생) ⑥ `genLong` 전환 시점(UI 대기 문구 `topicCopy.ts:107` 「보통 10~20초」는 실측 9.3~11.6초와 모순 없음, 전환 시점은 안 봄).
- **생성 소요(요청→응답) 회차별**: S1 9,344 ms · S2 9,387 ms · S3 11,643 ms → **p50 9,387 ms**(PE 측정 p50 9.3초와 일치, S3 만 PE p95 10.6초를 넘음 — n=3). 서버 로그 claude 호출 시간 8,553 / 8,709 / 9,686 ms. 재사용 395 ms.
- 산출물: 캡처 PNG 21장은 Leader 가 사용자에게 보일 수 있게 `scratchpad/q049/shots/` 에 남김(프로젝트 밖) — **보인 뒤 Leader 가 삭제**. 쿠키·임시 스크립트(미러 루트)는 삭제 완료. 띄운 프로세스 없음(서버 3075 는 Leader 소유, 끄지 않음).

## 최종 요약 (Leader, 사용자용 — 2026-10-10, 배포 확인 대기)
**결과**: 챌린지 주제 단어(AI 가 만드는 새 단어)에 일본어 예문과 한국어 번역이 생겼습니다. `topicWords@v2` 가 단어마다 예문을 함께 만들고, 서버가 카드 스냅샷(`VocabAttempt.exampleSnap`·`exampleKoSnap`)에 저장해 기존 카드 뒷면의 예문 칸에 보여 줍니다. **화면 컴포넌트는 바뀌지 않았습니다**(카드가 `card.example` 을 이미 그렸습니다). 같은 날 재사용·주제 세트 다시 풀기·재검사에서도 예문이 유지됩니다. 예문이 불량이면 단어는 남기고 예문만 비웁니다.
**지연(사용자 수용)**: 첫 세트 생성이 **약 +3.5초**(PE 라이브 측정 v1 5.8초 → v2 9.3초, 합격선 +2.5초 초과를 사용자가 「그대로 진행」으로 수용). QA 실측 9.3·9.4·11.6초(3회, 모두 1차 성공·폴백 0). 화면 문구 「보통 10~20초 걸려요」(`topicCopy.ts:107`)와 어긋나지 않습니다.
**검증**: 프롬프트 계약 시험 104개·learning/conversation/app 1354 통과·`tsc`·`eslint`·`next build`, 감사 REV-177(PASS, Medium 1 = 예문 이음매를 tsc 가 못 지킴 → 필수 칸으로 올리고 app 층 이음매 시험 추가), QA(qa-049, 라이브): AI 단어 30행 전부 쌍 저장(NULL 0·최대 25자), **퀴즈 무결성**(보기 고르기 답하기 전 #47·#49 응답에 `example`·`exampleKo`·`meaning` 키 없음, 답한 뒤 #50 에만), 일반 단어 카드 불변, 옛 행(NULL) 정상, 캡처 21장(360/390/412) 가로 넘침 0.
**DB**: 사용자 승인 3칸 중 2칸(위 task-048 과 같은 `db push` 1회로 적용 완료, nullable).
**알려진 한계 — 사용자께 알린 것**:
1. **퀴즈 힌트 부작용(REV-177 L-2·QA-049-I2)**: 같은 세트의 다른 단어가 예문에 섞여, 보기 고르기에서 답한 카드의 예문이 아직 안 푼 카드의 뜻 힌트가 될 수 있다. PE 표본 대조 상한 10.4%, QA 표본 10개 중 2건(「大きい」의 예문에 같은 세트의 「サイズ」, 「左に」의 예문에 「信号」). 코드 결함이 아니라 「답한 뒤 예문 공개」 계약의 부작용 — 수용 여부는 사용자 확인.
2. 긴 예문(서버 상한 60자 근처)에서 후리가나를 켜면 3번째 줄 후리가나 윗부분이 `line-clamp` 경계 아래에 가는 잔상(합성 50자로 재현, 실제 예문은 15~25자). 화면 컴포넌트라 designer 판단 — 이번에는 수정하지 않음. 긴 예문은 잘리고 전체를 볼 방법이 없다(Info).
3. 단어장 단어를 지우면 지난 세트·다시 풀기에서 그 카드의 예문이 사라진다(변경 전과 같은 동작).
4. 하루 3회 생성 상한 때문에 지연 표본이 3개, 20초 한도에서 JSON 재시도가 겹치는 경우(B1 폴백)는 관측되지 않아 NOT_VERIFIED. 실기기·다크 모드 미확인.
**남은 일**: 사용자 배포 확인(커밋 `94518d0` 프롬프트·`638948d`·`ff60d2f` 서버) → 배포 후 스모크.

## 배포 기록 (2026-10-10 21:1x KST, Leader) — task-048·049 공용
- 사용자 승인: 배포 확인 질문(예문 대기 +3.5초·퀴즈 힌트 부작용·백필 불필요를 함께 고지)에 「둘 다 지금 배포」 선택.
- `git push origin main`(`6e97554..869e28d`, 로컬 커밋 8개 — 코드 `ad39547`·`23dfba3`·`94518d0`·`638948d`·`ff60d2f`, 문서·vault). QA 검증 코드(`10cd615`)와 push 코드가 같음을 확인(`10cd615`→`HEAD` 사이 `src`·`prisma`·`scripts`·`tests` 변경 0).
- webhook blue/green → **릴리스 `20261010-121054-869e28d6`**, `RELEASE_RESULT ok`(`migrated:false` — DB 3칸은 사전 `db push` 로 이미 적용), 헬스 `ok`(degraded 없음, PRODUCTION), pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` 모두 새 릴리스 경로에서 online. 직전 릴리스 `20261010-064417-402b193e` 는 롤백 대상(`scripts/deploy.sh TheKaiwa --rollback`).
- 운영 읽기 전용 스모크(QA2 쿠키, 데이터 쓰기·LLM 호출 0): `/study/ai?tab=talk|scenario`·`/study/today`·`/plan`·`/drawer/words`·`/ask`·`/settings`·`/study/today/eval/new`·`/plan/challenges`·`/plan/challenge/new`·`/study/ai/scenario/new` 11경로 전부 200.
- **백필 dry-run(운영 DB, UPDATE 0)**: `matched 0`·`updated 0` — 역할극 대화가 0건이라 `--apply` 불필요(실행하지 않음).
- 남음: 운영에서 새 단어 예문이 실제로 나오는지 사용자 실기기 확인(챌린지 주제 단어 세트 시작 → 카드 뒷면) · 역할극을 처음 쓰는 시점에 `endedAt` 저장 확인(DB 가 비어 있어 운영 실흐름은 아직 증명되지 않음 — QA 는 개발 서버+공유 DB 에서 통과).
