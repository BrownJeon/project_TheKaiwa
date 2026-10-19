---
task_id: task-073
title: "단어 추가 문구 두 건 — (W-2) 「말로 쓰기」 안내를 일본어 발음 예시+인식 직후 확인 안내로, (W-3) 뜻 채우기 판정 실패 이유의 오타 단정 완화"
status: done
waiting: ""
base_ref: 746d54c
risk_level: "R1"
roles_involved: [leader, judge, developer, prompt-engineer, reviewer]
related_tasks: [task-069-improve-word-add-mic, task-068-improve-wordbook, task-072-improve-word-add-helper]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 단어 추가 문구 정리
  - task-073
created: 2026-10-16
updated: 2026-10-19
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-073-word-add-copy-v1.html"
  artifact_url: "https://claude.ai/artifact/9EkX8f4Zbqi2pGpeLAhfRB"
  content_sha256: "5a17ca685c0598de2006e4b510ca09b82c25842be6fe5c5ceba52d2b41ce1d9f"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-17T14:29:17+09:00"
  approval_quote: "승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-073 — 단어 추가 문구 두 건 (IMP-0047·IMP-0048)

## 사용자 요청 (원문)
- 2026-10-15 사용자 스크린샷(단어 추가 시트 표현 칸 「インペクト」 + 「일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다.」) → Leader 가 원인 확정·범위 정리(W-1~W-4) → 사용자 **「승인」**(2026-10-16): **H-1(도우미 → [[task-072-improve-word-add-helper]]) + W-2 + W-3 진행, W-1·W-4 제외, 두 작업으로 분리**.
- 이 task = **W-2**([[IMP-0047-word-add-mic-hint-copy]]) + **W-3**([[IMP-0048-word-enrich-invalid-reason-soften]]).

## judge 접수 (2026-10-16)
- `judge-result@2`: 유형 local_fix · 복잡도 1.09 · 위험 R1 · developer **sonnet** · **track light**(Leader → Developer → Reviewer, QA·데모 면제 — `DM-light-waive`).
- Leader 추가: W-3 은 **프롬프트 변경**이라 prompt-engineer 를 둔다(역할은 judge 가 안 넣었지만 `wordEnrich` 규칙·회귀 픽스처는 PE 몫).
- **light 승격 조건**(보이면 standard 로): 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증.

## 트랙 승격 (2026-10-16, 사용자 결정 「standard 승격 — 데모 delta + QA」)
- 구현이 끝난 뒤 실제 변경 파일을 세니 **15개**(운영 코드 7 + 시험·픽스처·점검 도구 8)로 light 한도(12개)를 넘었다. 실제 경로로 judge 재판정(`judge-073-final`): 유형 feature · 복잡도 1.87 · R1 · **track standard**(`track_blockers: too_many_paths`) · 데모 **delta**(`JV-ui_change`, owner designer) · 역할 designer·prompt-engineer?·developer·reviewer·qa · `next=demo_first`.
- Leader 가 사용자에게 「light 유지(데모·QA 면제, 권장)」와 「standard 승격」을 물었고 사용자가 **standard 승격**을 골랐다. 데모 게이트를 `drafting`(delta)로 다시 init.
- **절차 편차(숨기지 않고 기록)**: 접수 때 light 로 분류해 데모 승인 없이 화면 코드(W-2)를 먼저 썼다 — 승격된 트랙의 「데모 승인 후 화면 코드」 순서와 어긋난다. 접수 시점에 파일 수(예상 4개 → 실제 15개)를 과소평가한 것이 원인이다. 대응: designer 가 **이미 구현된 화면과 같은 모습의 delta 데모**를 만들어 사용자가 검토·승인하고, 승인이 나오지 않거나 바꿀 점이 있으면 구현을 고친다(커밋·푸시 전이라 되돌림 비용 낮음). 승인 전 커밋·푸시·배포 금지.
- 이후 순서: reviewer 감사(진행 중) ‖ designer delta 데모 → 사용자 검토·승인 → QA(QA 계정만, 실제 Next 라우터·3폭) → Leader. 푸시·배포는 사용자 승인 후.

## 감사·데모 진행 (2026-10-16)
- **reviewer REV-073**: 코드 **PASS_WITH_NOTES**(Critical·High·Medium 0, Low 4) — 재실행 tsc 0·eslint 0·전체 4,152 중 4,150 통과(실패 0·건너뜀 2)·`next build` 0, **실호출 14회 재현**(invalid 8/8 단정 0, valid 6/6), 프롬프트 규칙 줄 1개를 빼면 나머지 v2 와 동일(직접 재계산), `v3` 는 코드 라벨뿐(DB 쓰기·`prompts:sync` 불필요 확인), A10 상한 2,400 사유 사실, 변이 29개 중 28개 포착(생존 1 = Low①). 사양과 달라진 점 4개 수용. 데모 게이트 `BLOCKED`(사용자 승인 전)는 의도한 상태.
- Low: ① 훅의 빈 결과 분기에 안내를 켜는 변이 생존 ② 새로 삽입되는 `role="status"` 안내가 일부 화면 읽기기에서 안 읽힐 수 있음(designer DP2 와 같은 지적) ③ 표현 힌트에서 「표현이 바뀌어요」 삭제 ④ home-m4(qwen) 보조 경로 미측정.
- **designer delta 데모 v1**: `docs/demo/task-073-word-add-copy-v1.html`(88KB·848줄·상태 23개·3폭·글꼴 100/130%·라이트/다크, lint 통과, 자체 시험 690칸 가로 넘침 0·44px 미만 터치 0) **전체를 읽고 확인** — 외부 요청·엔진명 0. 비공개 Artifact https://claude.ai/artifact/9EkX8f4Zbqi2pGpeLAhfRB → 게이트 `review_requested` v1(sha256 `5a17ca68…`). **사용자 검토 대기**. 실측: 새 안내 문구 모두 2줄 이하(줄임안 없음), 인식 직후 안내 1줄(+24px, 키보드 모형에서도 스크롤 없음), 360px·글꼴 130% 에서 인식 직후 안내 여유 1px(실기기에서 2줄 가능, 넘침 없음). designer 가 바꾼 ★ 없음(모두 「구현 그대로」). designer 제안 DP1(힌트 속 예시에 `lang="ja"`)·DP2(인식 직후 안내를 상시 「알아들은 말」 줄에 합치기).
- 사용자가 고를 것: E5(インペクト 에 후보를 보일지, ★ 생략)·E1(말하기 전 안내에 「한국어·영어식 발음은 틀리게 적힐 수 있어요」까지 넣을지, ★ 인식 직후 안내가 맡음)·DP1·DP2(이번에 같이 고칠지, designer 권고 이번에).
- 경위: designer 가 테스트용 Chrome 정리 중 `pgrep -f` 패턴이 자기 셸에 걸려 그 명령 하나가 중단됨(다른 프로세스 영향 없음, 남은 Chrome 없음 확인).

## 사용자 데모 승인 (2026-10-17)
- 사용자 **「승인」**(단독 한 단어) — `check.mjs approve --version 1 --quote "승인"` 기록(`approved_at 2026-10-17T14:29:17+09:00`, sha256 `5a17ca68…`), `activate`. **Leader 해석(사용자에게 보고)**: 직전 메시지에 데모 두 개(073·072)와 각 ★ 권고가 있었고 「권고대로」라고만 하셔도 된다고 안내했으므로, **두 데모를 ★ 권고 그대로 승인**한 것으로 본다 — 073 은 E1~E5 ★(구현 그대로) + **designer 제안 DP1·DP2 포함**(권고가 「이번에 같이」였고 다른 말이 없음). 사용자가 다르게 뜻했다면(예: 073 만, 또는 DP 제외) 바로 고친다.
- 승인 범위 구현: **DP1**(힌트 예시 `lang="ja"`) · **DP2**(인식 직후 안내를 상시 「알아들은 말」 줄에 합치고 눈에 보이는 안내는 `aria-hidden` — reviewer Low② 와 같은 문제도 해소) · **Low①**(생존 변이를 죽이는 시험) — developer 보완 라운드 소환. 이후 reviewer 재감사(좁게) → QA(QA 계정만) → 배포 승인.

## 보완 라운드·재감사·QA (2026-10-17)
- **보완 라운드(developer)**: DP1·DP2·Low① 구현 — 변경 3개(`labels.ts`·`WordMicField.tsx`·`wordMicField.test.ts`), 변이 15/15 포착. **사양과 달라진 점 1건**: 읽기용 줄에 합칠지를 결과가 들어온 순간 한 번 정해 **얼린다**(안 얼리면 안내를 거둘 때 줄이 되돌아가 같은 말이 다시 읽힘).
- **reviewer 좁은 재감사(REV-073b)**: **PASS_WITH_NOTES**(Critical·High·Medium 0, Low 4) — DP1·DP2·Low① 확인, **얼림 수용**(진짜 `WordMicField` 를 jsdom 에서 일반·StrictMode 로 돌려 통과·`console.error` 0, 안내 거두는 3경우 DOM 변경 0회·새 결과마다 1회, 얼림을 풀면 되돌아가 재낭독이 재현됨), 변이 19개 전부 포착(동치 리팩터 거짓 실패 1 = Low), 재실행 tsc 0·eslint 0·마이크 55/55·vocab 287/287·전체 4,157 중 4,155(실패 0·건너뜀 2)·build 0. Low: REV073b-1 표현→예문 둘 다 말하면 표현 칸 경고는 화면 읽기에 남지 않음(승인된 DP2 설계의 대가) · -2 얼림 줄 고정 시험이 동치 리팩터에 취약 · -3 상태 기계를 `announce.check` 로 옮기면 더 단순(선택) · -4 결과가 `。` 로 끝나면 읽기용 줄 구두점 겹침. 폰 확인 ⑨ 에 「표현→예문 둘 다 말한 뒤 표현 칸으로 돌아가 보기」 추가 권고.
- **QA(qa, 팀 표의 Haiku 대신 Sonnet — e2e 스크립트 작성이 필요해 Leader 가 모델 상향, 편차 기록)**: 소환 — 통합 최종 상태 미러(`thekaiwa-rev073b` 복제 `thekaiwa-qa073`)에서 QA 서버 3011·QA 계정·가짜 온디바이스 STT 로 실제 Next 라우터·3폭 검증, 단어 저장 없음. **알려진 주의**: 저장소 `src/modules/conversation/{prompts,structuredResponse}/phraseHelp.ts` 에 task-072 PE 의 작업 중 변경이 섞여 있어(073 과 무관·import 로 이어지지 않음) QA 는 저장소 대신 미러를 쓴다. 배포 전에 PE 완료 후 통합 시험을 다시 돌린다.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 「말로 쓰기」(task-069): `labels.ts` `WORD_MIC_COPY`(`byVoice`·`byText`·`field`·`voiceBox`·`hint.surface`/`hint.example`), `WordMicField.tsx`·`useWordMic.ts`·`wordMic.ts`. 현재 안내: 「일본어로 말하면 표현이 바뀌어요. 칸에 들어간 뒤 고칠 수 있어요.」(예문은 「…예문 끝에 이어 붙어요…」). **task-069 의 시험은 문구를 단정하는 것이 있을 수 있다 — 문구를 바꾸면 시험도 같이 갱신**.
- 뜻 채우기(task-008·068): `prompts/wordEnrich.ts` `wordEnrich@v2` — `valid=false` 이면 `invalidReason`(한국어 한 문장). 규칙 줄: 「가장 먼저 이 표현이 실제 일본어 단어·관용 표현인지 판단합니다. 한국어·영어·오타·의미 없는 문자열이면 valid=false 로 하고 invalidReason 에 한국어로 이유를 한 문장…」(`:92`). 화면 틀 `DRAFT_INVALID` = 「일본어 단어로 보기 어려워요. 표현을 확인해 주세요.」는 이미 부드럽다 — 문제는 그 아래 LLM 이유 줄.
- 실제 사례(2026-10-15, 사용자 스크린샷): 표현 `インペクト`(올바른 건 インパクト) → 이유 「일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다.」 — 틀린 추측을 단정.
- 교훈: `/이슈기록 관련` 승인 교훈 없음. **task-069·070·071 감사 교훈(내부)**: light 트랙은 QA 가 없어 변이 점검이 사실상 유일한 독립 확인.

## 사실 (2026-10-16 직접 확인 — [확실])
- 인식기는 일본어 고정(`speech/speech.config.yml:63`) → 한국어·영어식 발음의 외래어는 오인식(インペクト). 이 task 는 **인식을 바꾸지 않고 안내만** 바꾼다.
- `wordEnrich` 판정 기준(어떤 입력이 valid=true/false 인가)은 바꾸지 않는다 — 바꾸는 것은 **valid=false 일 때 이유 문장 규칙뿐**.
- 소비처: 단어 추가 시트 `WordAddSheet`(표현 단계의 `surfaceMsg.reason` 렌더 — 「선생님 설명」), 서버 `enrich` 라우트가 `invalidReason` 을 그대로 내려준다.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **L1 W-2 마이크 안내 문구**: `hint.surface` = 「**일본어 발음으로** 말해 주세요 (예: インパクト). 칸에 들어간 뒤 고칠 수 있어요.」, `hint.example` = 「일본어로 말하면 예문 끝에 이어 붙어요 …」 형태로 같은 말투 유지(예시는 표현 칸만). **한국어·영어식 발음은 잘못 받아 적힐 수 있다**는 점이 한 줄 안에 드러나게(길면 한 줄에 `break-keep`, 360px 한 줄~두 줄 허용, 가로 넘침 0).
- **L2 W-2 인식 직후 안내**: 인식 결과가 칸에 **들어간 직후** 칸 아래에 작은 안내 한 줄 — 「잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」(`text-[12px] text-ink2`, `role="status"` 한 번 읽힘). 사용자가 그 칸을 고치거나 다시 말하거나 시트가 닫히면 사라진다. 새 버튼·새 화면 요소 없음. 표현·예문 두 칸 모두.
- **L3 W-3 판정 이유 규칙(프롬프트)**: `valid=false` 의 `invalidReason` 에서 **단정 표현을 금지**한다 — 「~가 아닙니다」·「~의 오타입니다」 대신 「일본어 단어로 확인되지 않았어요」·「~처럼 보여요」 같은 완화. 의도했을 법한 일본어 표기가 **확실할 때만** 「혹시 ○○를 말씀하신 걸까요?」 **질문형 한 번**까지 허용하고, 확신이 없으면 추측하지 않고 생략한다. 영어·한국어 입력이면 「일본어 표현으로 적어 주세요」 방향 안내. 한 문장(기존 `invalidReason` 한 문장 규칙·길이 한도 유지).
- **L4 불변**: `valid` 판정 기준·JSON 스키마·응답 구조·`DRAFT_INVALID` 틀·`wordEnrich` 의 valid=true 경로(읽기·뜻·품사·조각·예문)·단어 추가 흐름·`phraseHelp`. **valid=true 단어의 통과율이 변하면 안 된다**(회귀 픽스처로 확인).
- **L5 프롬프트 버전·레지스트리**: 규칙 문구가 바뀌면 `wordEnrich` 버전(`v2` → `v3` 등)·Prompt Registry/시험이 고정한 값이 따라간다. **레지스트리 동기화가 공유 DB 쓰기를 요구하면 쓰지 말고 멈춰 보고**(Leader → 사용자 승인). 코드로만 정의돼 있으면 그대로 진행. (task-068 의 `wordEnrich@v2` 는 DB 변경 없이 배포됐다 — 어떤 방식이었는지 확인해 기록.)
- **L6 W-1·W-4 제외**: 가까운 후보 자동 제안·한국어 음성 인식은 하지 않는다. 가까운 후보 질문형 언급(L3)은 **문장 안에서만**이고 별도 칩·API 없음.

## 구현 지시
**소유 구분(파일 충돌 방지)**: developer(sonnet) = W-2 — `src/components/vocab/{labels.ts,WordMicField.tsx,useWordMic.ts,wordMic.ts}` + `vocab/__tests__/{wordMic,wordMicField}.test.ts`. prompt-engineer(sonnet) = W-3 — `src/modules/conversation/prompts/wordEnrich.ts`(+ 버전·레지스트리가 요구하는 파일) + `src/modules/conversation/__tests__/` 안의 wordEnrich 시험·회귀 픽스처. 서로의 파일은 건드리지 않는다. 합쳐 12개 이하(light).
1. **developer**: L1·L2. 먼저 `WordMicField.tsx`·`useWordMic.ts`·`wordMic.ts`·`labels.ts` `WORD_MIC_COPY` 와 기존 시험을 읽고, 안내 문구 변경 + 결과 반영 직후 안내 한 줄(상태는 순수 함수로, 소스 스캔 시험으로 배선 고정 — task-069 교훈). 문구를 단정하는 기존 시험은 갱신. **변이 점검 6개 이상**.
2. **prompt-engineer**: L3~L5. 먼저 `prompts/wordEnrich.ts`·그 시험·`modules/conversation/prompts/` 안의 레지스트리 관련 파일을 읽고, 규칙 문구 수정 + **실호출 회귀**(로컬 Claude CLI, 운영 서버 접촉 금지): invalid 입력 ≥8종(インペクト·`impact`·`임팩트`·`inspect`·`こんにちわ`·무의미 `あああ`·한글 문장·`asdf`) 에서 `invalidReason` 에 단정 표현(「아닙니다」·「오타입니다」)이 **0건**이고 한 문장·한국어인지, valid 입력 ≥8종(映画·温い·インパクト·食べる·よろしくお願いします·ぬるい 등)의 `valid=true` 통과율·필드 채움이 **변하지 않는지** 표로 기록. 기록은 `agent-vault/10-Flow/tasks/task-073-pe-record.md`.
3. 확인 명령(각자 자기 미러에서): `tsc --noEmit` 0 · `eslint <변경 폴더>` 0 · 관련 시험 + 전체 시험 · `./node_modules/.bin/next build > log 2>&1`(`npm run build/dev` 금지, 출력 자르지 말 것). 미러는 `cp -al ~/.node-local/thekaiwa-dev071 ~/.node-local/thekaiwa-dev073-<역할>` 로 만들고 `grep -c UserWordState …/index.d.ts` ≥ 1 확인 후 저장소 `src/`·`tests/`·`package.json` 을 `rsync -a --delete` 로 맞춘다. **다른 미러(`thekaiwa`·`thekaiwa-rev068`·`thekaiwa-dev069*/070/071`·`thekaiwa-rev0**`·`thekaiwa-predeploy`)는 건드리지 않는다.**
4. 하지 않는 일: 커밋·푸시·배포·**DB 쓰기**·QA 서버 기동(3011 포함)·운영 포트(3010/3002/3012/307x) 접촉·`.env` 영구 복사·`pkill`. 실기기 확인은 사용자 몫.
5. 기록: developer → `task-073-dev-record.md`(변경 파일·결정·증빙·변이 표), PE → `task-073-pe-record.md`. 끝나면 이 이력서 「상태 로그」에 한 줄씩.

## 완료 기준
1. 「말로 쓰기」 안내가 「일본어 발음으로 … (예: インパクト)」를 말하고, 인식 결과가 들어간 직후 「잘못 알아들었을 수 있어요…」 한 줄이 칸 아래에 보였다 사라진다(표현·예문).
2. valid=false 이유가 단정 없이 완화된 한 문장이고(오타·아닙니다 0건), valid 입력의 통과율은 그대로다.
3. tsc 0 · eslint 0 · 시험 통과 · `next build` 0 · reviewer PASS · 사용자 폰 확인(마이크 안내·판정 문구).

## 상태 로그
- 2026-10-16 사용자 「승인」(H-1+W-2+W-3, W-1·W-4 제외, 두 작업 분리) → IMP-0047·0048 접수 → judge(local_fix·R1·light·demo 면제·sonnet) → 이력서 작성(L1~L6). 다음: developer(W-2) + prompt-engineer(W-3) 병렬.
- 2026-10-16 [developer] W-2 구현 완료 → [[task-073-dev-record]] — 파일 8개(코드 6+시험 2, 사양보다 WordForm·WordAddSheet 2개 늘어남), tsc 0·eslint 0·마이크 시험 50/50·vocab 282/282·`next build` 0, 변이 18개 전부 잡힘. 전체 시험 4149/4152 — 실패 1건은 PE 작업 중인 `wordEnrichChunk` baseline(v2→v3, W-3). 네이티브 변경 없음. 다음: PE 완료 후 reviewer.
- 2026-10-16 [prompt-engineer] W-3 구현 완료 → [[task-073-pe-record]] — `wordEnrich@v2→v3`(`invalidReason` 말투 규칙 1줄 추가, 판정·스키마·valid=true 경로는 v2 와 해시 동일), 파일 7개(프롬프트 1+시험 2+점검기·픽스처·하네스 3+조각 baseline 1). 실호출: invalid 8종×6회 48/48 `valid=false`·단정 표현 0·한 문장·한국어(v2 는 21/21 단정·합쇼체, インペクト → inspect 오타 단정 소멸), valid 8종 24/24+borderline 18/18 통과율·chunkType v2 와 동일, 25단어 조각 24/25 동일. tsc 0·eslint 0·conversation 1,206/1,206·전체 4,150/4,152(실패 0, 건너뜀 2)·`next build` 0·변이 10개 전부 잡힘. 레지스트리/DB 쓰기 없음(버전은 코드 상수 라벨). 결정 요청: インペクト 에 インパクト 후보를 보일지(현행은 보수적으로 생략). 다음: reviewer.
- 2026-10-16 [reviewer] REV-073 → [[task-073-rev-record]] — **코드 PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 4): W-2 전이표 완결·사양과 달라진 점 4개 수용, W-3 v3 에서 규칙 1줄을 빼면 v2 와 동일(system·messages·persona·schema)·DB 쓰기/sync 불필요, 실호출 14건(invalid 8/8 단정 0·valid 6/6 통과), 증빙 재실행 tsc 0·eslint 0·전체 4152(통과 4150·실패 0·건너뜀 2)·`next build` 0 이 보고와 일치, 변이 29개 중 28개 포착(생존 1: 훅 빈 결과 분기 시험 공백 REV073-1). **단 `check.mjs check` = DEMO_GATE_BLOCKED**(frontmatter delta·drafting, 사용자 승인/면제 기록 없음) — 내 역할 규정상 FAIL 사유라 게이트 해소(사용자 delta 데모 승인 또는 명시적 면제)는 Leader·사용자 몫, 해소 전 커밋·푸시·배포 금지.
- 2026-10-16 [designer] delta 데모 v1 작성 → `docs/demo/task-073-word-add-copy-v1.html`(lint `DEMO_LINT_PASSED --expect task-073-v1`, 88,424 B) · 기록 [[task-073-designer-record]] — **구현된 문구·동작 그대로**(★ = 구현, designer 가 바꾼 ★ 없음), 상태 23개를 「현재 vs 제안」으로 나란히, 결정 E1·E1′·E2~E5, 안내 전이 표 13행, W-3 실호출 원문 표(지어낸 문장 없음, E5 대안 B 만 「가상」 표시). 헤드리스 Chrome 자체 시험 690칸 가로 넘침 0·44px 미만 0, 새 안내 문구 세 폭·글꼴 100/130% 모두 2줄 이하(줄임안 불필요), 인식 직후 안내 1줄 = 1단계 본문 +24px(키보드 모형에서도 스크롤 없음). 구현과 다른 곳 없음. designer 제안 2건(DP1 예시 `lang="ja"`, DP2 안내를 상시 읽기 줄에 합침 — 둘 다 a11y Minor). 다음: Leader 게시·`status --to review_requested` → 사용자 검토.
- 2026-10-17 [developer] 승인 후 보완 라운드 — DP1(힌트 예시 `lang="ja"`)·DP2(확인 안내를 상시 읽기 줄에 합침·보이는 안내 `aria-hidden`·자기 `role` 제거; 합칠지는 결과 순간에 얼려 재낭독 방지)·Low①(훅 빈 결과 분기 안내 변이를 잡는 스캔) 구현 → 변경 3개(labels.ts·WordMicField.tsx·wordMicField.test.ts) · tsc 0 · eslint 0 · 마이크 55/55 · vocab 287/287 · 전체 4,157 중 4,155 통과·실패 0·건너뜀 2 · next build 0 · 변이 15개(L1 포함) 전부 포착 · 기록 [[task-073-dev-record]] 「승인 후 보완 라운드」. 다음: reviewer 재감사.
- 2026-10-17 [reviewer] REV-073b 재감사(승인 후 보완 라운드) → [[task-073-rev-record]] 「재감사」 — **코드 PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 4: 접근성·시험 보강 권고뿐, 수정 불요) · 게이트 `DEMO_GATE_PASSED`(approved v1) · DP1(`lang="ja"` 조각, 보이는 문구 글자 단위 동일, 소비처 1곳)·DP2(보이는 안내 `aria-hidden`·자기 role 없음, 위치·클래스·문구 불변) PASS · **얼림 수용**(동적 jsdom 탐침: 안내 거두어도 읽기용 줄 DOM 변경 0회·새 결과마다 1회·StrictMode 동일·console.error 0, 얼림 해제 대조에서는 재낭독 재현) · Low①(REV073-1)·②(REV073-2) 해소, 내가 직접 깬 빈 결과 분기 변이 3종 포착 · 변이 실19개 전부 포착(거짓 실패 1: 얼림 줄 동치 리팩터) · 증빙 tsc 0·eslint 0·마이크 55/55·vocab 287/287·전체 4,157 중 4,155 통과·실패 0·건너뜀 2·next build 0 이 보고와 일치. 다음: 사용자 폰 확인(⑨ 표현→예문 둘 다 말한 뒤 표현 칸 재방문 추가) → 커밋·배포 판단은 Leader.
- 2026-10-17 [qa] 실서버(`next start` 3011, 미러 `thekaiwa-qa073`)·실 Chrome·3폭(360/390/412)·라이트/다크·가짜 온디바이스 STT → [[task-073-qa-record]] — **결함 0건(Critical·High·Medium·Low 0)**: Q1 안내 문구·`lang="ja"` 일치·모든 폭 2줄·가로 넘침 0·44px 미만 0(칩 히트 영역 제외)·대비 6.2/7.7, Q2 인식 직후 안내(표현·예문 각각, `aria-hidden`·자기 role 없음)·sr 줄 「알아들은 말: …. 잘못 알아들었을 수 있어요…」, Q3 사라지는 시점 전부(고침·다시 열기·뜻 채우기·직접 입력·빈 결과 안 뜸·시트 재열기)+얼림(sr 줄 DOM 변경 0회), Q4 실호출 6건 이유 문장 단정 0·한 문장·한국어(インペクト → 「일본어 단어로 확인되지 않았어요.」, 2.6~3.4초)·valid `インパクト` 초안 정상, Q5 불변(키보드·직접 입력·기본 단어 409·목록 7개씩) 콘솔 오류 0, XSS 리터럴·엔진명 노출 0. **미확인(사용자 폰)**: 실제 인식·마이크·TalkBack 낭독·글꼴 130%/키보드 상태. **위험 메모**: 운영 wordEnrich 가 home-m4(qwen)로 갈 수 있고 v3 효과는 Claude CLI 경로로만 측정됨 → 배포 후 `インペクト` 한 번 확인 권고. 정리: 서버 PID 종료·3011 비움·`.env`·쿠키·스크린샷 삭제.
- 2026-10-17 [leader] **운영 배포 완료** — 사용자 「073만 지금 커밋·푸시·배포 (권장)」 → 푸시 전 게이트(HEAD `b9ce154` 를 `git archive` 로 별도 미러에 풀어 prisma generate·tsc 0·eslint 0·전체 시험 4,157 중 4,155 통과·실패 0·건너뜀 2·`next build` 0) → push `746d54c..b9ce154` → 웹훅 `RELEASE_RESULT` ok · 릴리스 `20261017-214103-b9ce1546` · migrated false · 롤백 대상 `20261015-205751-10d0a2c2`. 배포 후 확인은 아래 「운영 배포」. 다음: 사용자 폰 확인(⑨⑩).

## 운영 배포 (2026-10-17)
- **범위**: 코드 15개 파일(단어 추가 시트 문구·`WordMicField` 안내 상태·`wordEnrich@v3`) + 시험·픽스처. DB·네이티브 변경 없음(APK 재빌드 불필요, 웹 배포만). 같은 작업트리의 task-072 미커밋 변경(서버 입구 #181·`phraseHelp@v2`)은 **명시 경로 스테이징으로 제외**했고 운영에 나가지 않았다.
- **서버 쪽 확인(읽기 전용, [확실] — 직접 실행)**: `current` → `20261017-214103-b9ce1546` · `/api/health` PRODUCTION·점검 11개 · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` 모두 online·restarts 0 · 번들에 새 문구(「일본어 발음으로 말해 주세요」·「잘못 알아들었을 수 있어요」·「알아들은 말: 」) 포함, 옛 문구(「일본어로 말하면 표현이 바뀌어요」·「…예문 끝에 이어 붙어요」) 0건, 엔진명: 클라이언트 번들(`.next/static/chunks`)에 화면 문구로 노출된 엔진명 없음 — **정정(2026-10-18)**: 처음 적은 「0건」은 이 Next 16 빌드에 없는 경로(`chunks/app`)를 검색한 공허한 통과였고, 실제 범위의 `sherpa` 1건은 `Plugins.SherpaStt` Capacitor 플러그인 식별자(직전 릴리스에도 동일 파일에 존재)이며 reazon·whisper·style-bert 는 0건.
- **운영 화면 확인(QA2 임시 쿠키·127.0.0.1 직접·저장 POST 는 브라우저에서 차단, `enrich:true` 초안 요청만)**: ① 단어 추가 시트에서 [말로 쓰기]를 열면 새 힌트 「일본어 발음으로 말해 주세요…」가 보이고 옛 힌트 2종은 없음 · ② `インペクト` [뜻 채우기] → 200(2.7초) · 틀 「일본어 단어로 보기 어려워요. 표현을 확인해 주세요.」 + 이유 「**일본어 단어로 확인되지 않았어요.**」 한 문장 — 「아닙니다」·「오타입니다」 등 단정 0, `inspect` 추측 소멸(배포 전 사용자 스크린샷의 「…'inspect'의 오타로 보입니다.」와 대비). 콘솔 오류·페이지 오류 0, 저장 시도 0건. 쿠키 파일·미러 `.env` 삭제 확인.
- **QA 위험 메모 해소 여부**: QA 는 「운영 wordEnrich 가 home-m4(qwen)로 갈 수 있고 v3 효과는 Claude CLI 경로로만 측정됨」을 남겼다. 이번 운영 확인의 이유 문장은 단정 없이 나왔으나 **어느 엔진 경로를 탔는지는 화면에서 알 수 없다**(엔진명 비노출 원칙) — `home-m4-lan` 폴백 경로의 v3 효과는 **여전히 미측정**([추측]: 평소 Claude CLI 가 1순위라 폴백을 탈 일은 드묾).
- **알려진 한계(수용)**: TalkBack 낭독 동작은 폰에서만 확인 가능 · 표현→예문 둘 다 말한 뒤 표현 칸 경고는 읽기 줄에 남지 않음(승인된 DP2 설계의 대가, REV073b-1) · 글꼴 130%·소프트 키보드 상태는 헤드리스에서 재현 불가 · 후보 상한 3개 유지(PE 관찰: 2번째 이후 후보 중 약 6/21 이 어색 — 072 에서 2개로 줄일지 재결정 가능).
- **사용자 폰 확인 항목(IMP-0047·0048 → 확인 후 `done`)**: ⑨ TalkBack 으로 「알아들은 말: …. 잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」가 한 번 읽히고 그 칸을 고쳐도 다시 안 읽힘 + **표현→예문 둘 다 말한 뒤 표현 칸으로 돌아가 보기** · ⑩ 힌트의 「インパクト」가 일본어로 읽힘 · 일본어로 실제 말해 인식·마이크 권한·키보드 올라온 상태에서 안내 줄이 가리지 않는지 · 글꼴 크기 130%에서 힌트가 두 줄 이내 · 모르는 철자(`インペクト`)로 [뜻 채우기] 시 이유가 단정하지 않는지.

## 최종 요약 (사용자용)
- **한 일**: 단어 추가 「말로 쓰기」 안내를 「일본어 발음으로 말해 주세요 (예: インパクト)」로 바꾸고, 말한 직후에 「잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」가 칸 아래에 잠깐 보이게 했습니다. 뜻 채우기가 일본어가 아니라고 판단했을 때의 이유는 「~의 오타입니다」처럼 단정하지 않고 「일본어 단어로 확인되지 않았어요」처럼 부드럽게 말하도록 규칙을 바꿨습니다(`wordEnrich@v3`).
- **결과**: 운영 배포 완료(릴리스 `20261017-214103-b9ce1546`). 운영 화면에서 `インペクト` 로 확인했더니 이유가 「일본어 단어로 확인되지 않았어요.」 한 문장으로 나왔고, 예전처럼 'inspect 의 오타'라고 단정하지 않았습니다. 올바른 단어 판정(통과율)은 그대로입니다.
- **이번에 하지 않은 것**: 한국어 음성 인식(인식기가 일본어 전용), 가까운 단어 후보 자동 제안.
- **사용자가 해 주실 것**: 폰에서 위 확인 항목 ⑨⑩ 등. 이상이 있으면 롤백 대상은 `20261015-205751-10d0a2c2` 입니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-16 09:10 |
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-16 09:56 |
| v1 | 검토요청 | docs/demo/task-073-word-add-copy-v1.html | https://claude.ai/artifact/9EkX8f4Zbqi2pGpeLAhfRB | 사용자 검토 요청 | 10-16 10:12 |
| v1 | 승인 | docs/demo/task-073-word-add-copy-v1.html | https://claude.ai/artifact/9EkX8f4Zbqi2pGpeLAhfRB | "승인" | 10-17 14:29 |
