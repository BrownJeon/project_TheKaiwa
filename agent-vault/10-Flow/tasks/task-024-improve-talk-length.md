---
task_id: task-024
title: "개선 — AI 응답 대화형 되묻기: 응답 길이를 상황별로 판단 (IMP-0010)"
status: done
base_ref: 055dbcf
risk_level: R2
roles_involved: [leader, judge, prompt-engineer, developer, reviewer, qa, deployer]
related_tasks: [task-007-talk-voice-web, task-010c-correction-mode, task-004-ai-client-persona]
tags:
  - type/task
  - domain/improvement
  - domain/conversation
aliases:
  - 되묻기 응답 길이
  - task-024
created: 2026-09-30
updated: 2026-09-30
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[IMP-0010-ai응답-대화형-되묻기]] — AI 강사 회화 응답이 지금은 2문장으로 고정되어 대화가 딱딱하다. 사용자 결정에 따라 **응답 길이를 상황에 맞게 늘리되, 얼마나 늘릴지는 그때그때 달라지므로 "판단"이 필요**하게 만든다.

## 사용자 결정 (2026-09-30, Q8)
> "회화 응답에 대해서는 얼마나 늘릴지는 그때그때마다 달라질것같아서 이건 판단 에이전트가 필요할것같아"

## 설계 방향 (Leader 제안 — 구현 전 사용자에게 고지)
- **판단을 별도 호출로 두지 않는 것을 기본으로 제안**한다. 회화는 5초 예산(A1 ≤3,000자, 12s fail-fast)이라 LLM 호출을 한 번 더 넣으면 지연이 그대로 늘어난다.
- **하이브리드**: (a) 코드가 장면(짧은 대꾸형·설명 필요·되묻기 필요·교정 포함)별로 **문장 수 상한을 결정론적으로** 정해 프롬프트에 주입하고(스키마 `replyJa` maxLength·`checks.ts` 문장 수 검사는 그 상한과 일치), (b) 모델이 그 범위 안에서 상황 판단 기준(사용자 발화 길이·질문 여부·오류 유무)을 프롬프트로 받아 정한다. 즉 "판단"은 같은 호출 안의 프롬프트 기준으로 하고 별도 에이전트 호출은 두지 않는다.
- **측정 후에만 별도 판단 호출**: 프롬프트 기준으로 품질이 부족하다고 측정되면(Reviewer·QA·사용자 청취) 그때 별도 판단 호출(작은 모델)을 사용자 승인 아래 검토한다. 별도 호출은 지연 비용을 사용자에게 알리고 결정받는다. 사용자 대화가 외부 모델로 나가는 경로는 추가하지 않는다.

## 포함 항목
- [[IMP-0010-ai응답-대화형-되묻기]] (P2, M)

## 범위 (Leader 구체화 2026-09-30 — 접수 판정 통과용)
장면별 문장 수 상한(코드가 결정, 프롬프트에 주입, `checks.ts` 검사와 동일 값): **짧은 대꾸 1~2 · 설명 필요 2~4 · 되묻기 필요 2~3 · 교정 포함 3~4**. 현재 고정 2문장이 기본값이므로 짧은 대꾸형은 그대로다. 위 수치는 측정 뒤 조정 가능하다.

1. **prompt-engineer**: `conversation/prompts/talk.ts` 의 문장 수 규칙 재설계(상황별 기준 문구), `.claude/agents/tutor.md` 의 "2문장" 관련 문구, 회귀 픽스처(짧은 대꾸·설명·되묻기·교정 포함 4종 이상).
2. **developer**: 상황별 상한 계산(코드), `structuredResponse/schemas.ts` `replyJa` maxLength·`checks.ts` 문장 수 검사를 상한과 정합, TTS 청크 스트리밍이 길어진 응답에서도 첫 소리 지연(TTFA)을 유지하는지 확인(문장 단위 재생 경로), 프롬프트 버전 올림(`talk@v4` 후보)과 Prompt Registry sync.
3. **측정**: 5초 예산(턴 p50·p95)·TTFA 를 변경 전후 비교. 예산을 넘기면 상한을 낮추거나 사용자에게 보고.
4. **문서**: design-spec §8 회화 응답 규칙·정본 문구 갱신.

## 비범위
- 별도 판단 에이전트(측정 뒤 결정), 회화 외 프롬프트(A2~A10) 길이 조정, 음성 톤 조정.

## 완료 기준
- 회귀 픽스처에서 장면별 문장 수가 상한 안에서 달라지고(짧은 대꾸형은 짧게, 되묻기는 더 길게) JSON 계약 통과율이 변경 전과 같은 수준, 턴 p50 이 5초 예산을 넘지 않거나 넘는 만큼을 사용자에게 보고.
- 사용자 체감 확인(회화 몇 턴) 요청을 최종 요약에 남긴다.

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 feature · 복잡도 1.31 · 위험 R1 · developer 모델 **sonnet** · needs_info false
- 권장 역할: designer?, prompt-engineer?, developer, reviewer, qa
- 데모: **none** (required=false, rule=-) · 다음 = `assign`
- 규칙 오버라이드: 없음
- 비고: 1차·2차 접수는 `ask_user`(요구 불명확, noul 0.76~)였다. Leader 가 장면별 문장 수 상한과 완료 기준을 구체화(범위 절 참조)해 3차 접수에서 `assign`(noul 0.3)로 해소. 화면 변경 없음이라 데모 불요.

## Prompt-Engineer 기록

### 2026-09-30 C2 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-024",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": false,
    "wanted_before_budget": false,
    "mode": null,
    "focus": null,
    "budget_rule": "CX-limit-unknown-hold",
    "codex_calls_used": 0,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 0,
    "focus": {
      "choice": "design_assumption",
      "confidence": 0.97
    },
    "high_risk_change": {
      "noul": 0.07
    },
    "reviewer_doubt": {
      "noul": 0.39
    }
  },
  "rule_overrides": [],
  "fallback": null,
  "input_tokens": 899,
  "cost_usd": 0.000038,
  "latency_ms": 1027
}
```

engine: jev
결정: codex_required=false · wanted_before_budget=false · budget_rule=CX-limit-unknown-hold · focus=design_assumption(0.97)
규칙 덮어쓰기: -

- [22:41] **task-024 프롬프트·픽스처 단계 완료 — `talk@v4`** (schemas.ts·checks.ts·라우트·화면·다른 프롬프트 미수정, 커밋·배포 없음)
- **변경 파일**: `src/modules/conversation/prompts/talk.ts`(talk@v3→v4) · `.claude/agents/tutor.md`(§2 한 문장·§6 TALK 행, 헤딩 번호 불변, diff 4줄) · `src/modules/conversation/__tests__/talkLength.test.ts`(신규) · `tests/prompts/fixtures/talk-length.json`(신규 `talk-length@v1`) · `tests/live/talk-length-measure.ts`·`tests/live/talkLengthHelpers.ts`(신규, 실측 스크립트) · `src/modules/conversation/__tests__/prompts.test.ts`(**버전 단언 `talk@v3`→`talk@v4` 한 줄만 수정** — 나머지 단언 무변경).
- **원인**: v3 는 "첫 문장 = 아주 짧은 맞장구 + 둘째 = 질문" 이 고정이라 직답·설명이 들어갈 자리가 없었다(문장 수 상한 자체보다 첫 문장 규칙이 문제).
- **설계(3단 문구)**: `replyJaInstructionLine(cap)` — cap≤1 = 1문장 / cap 2 = v3 구조 유지(맞장구 **또는 짧은 직답(「1000円です。」)** + 질문 한 문장) + 점원 이어가기 / cap 3~4 = "최대 N문장(상한을 채우려고 늘리지 말고 상황에 맞게)" + 상황 기준(짧은 말·인사=반응+질문 하나, 물음·설명 필요=충분한 답+이어질 질문 하나, 애매=되묻기). 공통: 점원 응대 시 대답만 했어도 「かしこまりました。」로 끝내지 말고 다음 물음(사이즈·봉투·포인트카드·결제), 질문은 한 번에 하나, 교정 설명은 replyJa 금지. **상한은 `[지시]` 줄에만** — persona(--system-prompt)는 cap 무관 바이트 동일(테스트 강제).
- **반복 이력(재설계 3회 — 위반율 아닌 SHORT 장면 초과 기준)**: v4a(상황별로 늘려도 됨 문구를 전 cap 공통) → 인사·맞장구도 3문장·질문 2개로 늘어남. v4b(cap 2 에도 상황 기준 넣음) → SHORT 초과 6/9. v4c(cap 2 는 v3 구조, 상황 기준은 cap≥3 에만) → 채택. v4d(cap 2 줄 "반응·질문" 한 단어 변경)는 초과 개선 없음(s01 2/3·s02 1/3 그대로)이라 **폐기, v4c 유지**.
- **빌더 시그니처(초안 → 구현됨)**: `buildTalkRequest({ …, sceneCap?: number })` · `talkInstruction(correctionMode, sceneCap)` · `replyJaInstructionLine(cap)` · 상수 `TALK_SCENE_CAP_MIN=1/MAX=4/DEFAULT=2/TOLERANCE=1` · `clampSceneCap(n)`(null·NaN·Infinity→2, 내림, 1~4 클램프). `extraCheck` = 기존 `checkTalkResponse(input, data, { maxSentences: cap + 1 })`(checks.ts 옵션 이미 존재 — 수정 없음).
- **픽스처 12건**(`talk-length.json`, 합성 발화·이력만): SHORT(cap 2) s01 こんにちは / s02 はい、好きです / s03 ありがとうございました · EXPLAIN(cap 4) x01 これはいくらですか(점원 이력) / x02 駅はどこですか / x03 食べられる vs 食べれる(N3) · ASK_BACK(cap 3) a01 週末、ちょっと出かけました / a02 私は日本が好きです / a03 はい、お願いします(마트 이력) · CORRECTION(cap 4) c01 友だちを会いました / c02 行くました·面白いでした / c03 バスで乗ります(expectedCorrected 포함).
- **단위 테스트**: `talkLength.test.ts` + `prompts.test.ts` 32건 통과(미러 `~/.node-local/thekaiwa`, node --test). 내용 = 픽스처 형태·cap 표 일치, `clampSceneCap` 경계, cap 별 문구(cap 2 는 v3 구조·"상한을 채우려고" 없음), 픽스처×cap 사용자 프롬프트 ≤3,000자(최대 1,677), 최악 입력(cap 1~4×FLUENCY/COACH×큰 learner·altText·긴 이력) ≤3,000자, persona 바이트 동일·"2문장" 없음, extraCheck 허용치 cap+1(cap 4→5 OK·6 실패), `original` 불일치 검출, speaker_id·model_id·styleWeight·pitch·엔진명 미포함. tsc: 내 파일 오류 0(다른 에이전트 파일 오류는 무관, 1회 재실행 확인).
- **실측**(claude CLI haiku, 픽스처 12×3회=36콜/arm, 합성 입력만, 순차):

| arm | 성공 | 1차 통과 | SHORT 평균(초과) | EXPLAIN 평균 | ASK_BACK 평균(물음 포함률) | CORRECTION 평균 |
|---|---|---|---|---|---|---|
| v3 | 36/36 | 97%(재시도 1) | 2.00 (초과 0) | 1.78 (1문장 2/9) | 2.00 (67%) | 2.11 |
| v4c | 36/36 | 100% | 2.33 (분포 0/6/3, cap 2 초과 3/9) | 2.56 (분포 0/4/5, 범위 100%) | 2.11 (물음 9/9, a03 다음 물음 3/3) | 2.78 |

  v4c 교정 계약: correction 채움 100%·`original` 바이트 일치 100%·corrected=기대 100%·replyJa 에 교정 설명 유출 0%·정상 문장 오교정 0/27·cap+2 초과 0·재시도 0. 평균 지연(ms, v3→v4c) SHORT 3577→3627 · EXPLAIN 4439→4944(p95 6363→7201) · ASK_BACK 3461→3562 · CORRECTION 6025→5790. replyJa 최대 129자(schema maxLength 200). v4a·v4b 원본 로그는 스크래치패드 `talk-length-run1~4*.json/.log`. v4d 추가 확인(4건×3회): 초과 s01 2/3·s02 1/3, 나머지 정상.
- **남은 위험**: (1) SHORT cap 2 에서 인사에 「今日も頑張りましょう」+질문, 커피 후속에 물음 2개로 3문장이 3/9 — `cap+1` 허용 안이라 검사는 통과하지만 "v3 처럼 짧게"는 아님. 프롬프트로 더 조이면 EXPLAIN 짧아짐 위험 → 실사용에서 코드가 짧은 발화에 cap 2 를 주는 것으로 흡수(아래 신호표)하거나 사용자 체감을 본 뒤 결정. (2) 측정 표본 36콜이라 통계 신뢰도 낮음(추세 확인 수준). (3) 사용자 체감 응답 길이·TTFA 는 developer·QA 실측.
- **함정 기록(재발 방지)**: cap 2 줄에 "상황에 따라 늘려도 된다" 류 표현 금지 — haiku 가 인사·맞장구에도 3문장·물음 2개로 초과한다. 상황 기준은 cap≥3 줄에만. 그리고 NFS 미커밋 파일은 다른 에이전트(QA 등)가 되돌릴 수 있다 — 스크래치패드 백업 유지. 백업본 = `task024-backup/`.
- **developer 인계 사양**
  1. **cap 신호표(초안, 실측으로 조정)**: 호출 전 신호만 사용 — 별도 판단 호출 없음. altText 있음 → 2 · 짧은 비질문 발화(≤약 8자, 인사·맞장구) → 2 · 물음(？/?/か 로 끝남) → 4 · 그 외 평서문 → 3 · (선택) N5·N4 는 최대 3. CORRECTION·ASK_BACK 은 호출 전 신호가 없으므로 ≥3 이 되는 일반 발화 규칙으로 흡수. cap 은 상한일 뿐 채우라는 뜻이 아님(프롬프트가 명시). 기본값(신호 없음) = 2(v3 동일).
  2. **문장 수 검사**: 내가 `checks.ts`·`schemas.ts` 를 건드리지 않았다(pe-025 가 A4 v8 로 수정 중). talk.ts `extraCheck` 는 기존 `checkTalkResponse` 의 `maxSentences` 옵션에 `cap + TALK_SCENE_CAP_TOLERANCE` 를 넘긴다. 정책을 checks.ts 로 옮길지·`REPLY_SENTENCE_HARD_CAP=3` 을 조정할지는 developer 판단. `replyJa maxLength 200` 은 cap 4 최대 관측 129자라 현재 유지 가능 — 늘리면 A1 스키마 계약 문서(api-contract §67) 도 같이.
  3. **호출부**: `buildTalkRequest` 에 `sceneCap` 을 계산해 넘기는 곳은 라우트/오케스트레이터 — 신호 계산 함수는 conversation 층 밖(prompts 아님)에 둘 것. sceneCap 을 persona 나 세션 캐시 키에 섞지 말 것(persona 바이트 안정 유지).
  4. **문서·정의 정합(Leader 합의 필요)**: `docs/design-spec.md` §8 A1 행(약 138·189·406행 "2문장")·`.claude/agents/prompt-engineer.md`(18·35·84행 "≤2문장")·`docs/design/tutor-persona-validation.md` V-항목 중 "2문장" 기대. A2 `chat.ts` 는 여전히 "최대 2문장" — persona §2 가 `[지시]` 상한을 가리키므로 CHAT 일관성은 필요 시 별도 결정(이번 범위 밖, 미수정).
  5. **Prompt Registry**: talk 프롬프트 버전(`talk@v4`)과 `teacher-persona`(tutor.md) 가 바뀌었으므로 `npm run prompts:sync` 필요(SOURCE_CODE v0 갱신, CONSOLE 버전과 충돌 시 Leader 와 ACTIVE 합의).
  6. **QA 측정 항목 제안**: 장면별 응답 문장 수 분포·물음 포함률·TTFA·턴 p50/p95(5초 예산)·first-pass 위반율. 운영 haiku 는 같은 모델이라 내 실측 방식(`tests/live/talk-length-measure.ts`, `RUNS`·`ITEMS`·`ARMS` env)을 재사용 가능.

## Developer 기록

### 2026-09-30 Developer

데모 게이트: `DEMO_GATE_PASSED` / `task: task-024` (status: not_required — 화면 변경 없음).

**변경 파일**
- 신규 `src/modules/conversation/orchestrator/sceneCap.ts` — `computeSceneCap({text, altText?, level?}) → {cap, reason}` 순수 함수(LLM 호출 없음, 5초 예산 영향 0). `prompts/` 밖(orchestrator).
- 수정 `src/modules/conversation/orchestrator/index.ts` — TALK 만 `computeSceneCap` → `buildTalkRequest({sceneCap})`(`startLlmRun`, 끊김 복구 경로의 재호출도 같은 함수를 지난다). CHAT(A2)은 `buildChatRequest` 그대로. `toolLog` 와 Trace `PROMPT` 단계에 `sceneCap`·`sceneCapReason`(코드값) 추가 — 발화 원문 없음. `turnDeps.prewarm` 추가(테스트용, `prewarmTalkTurn` 이 `turnDeps` 를 경유) — 예열은 `sceneCap` 미전달 = 기본 2.
- 신규 `src/modules/conversation/__tests__/sceneCap.test.ts` — 44건.
- 수정 `docs/design-spec.md` — §8 A1 행(189행 "`replyJa` ≤2문장" → 상황별 상한 1~4·기본 2, 발화 신호로 코드가 결정, `[지시]` 줄 전달, 후검증 허용 = 상한+1; task-024 talk@v4)·리스크 표(406행 "2문장").
- PE 영역(`prompts/talk.ts`·픽스처·PE 테스트·`tutor.md`)·`checks.ts`·`schemas.ts`·`lesson.ts`·`reviewMix.ts`·`src/app/api/v1/lessons/**` 는 손대지 않았다.

**최종 신호표(위에서부터 처음 맞는 것)**
| 순서 | 신호 | cap | reason |
|---|---|---|---|
| 1 | 글자(문자·숫자)가 없음(빈 문자열·이모지·기호뿐) | 2 | NO_SIGNAL (v3 기본값) |
| 2 | STT 두 번째 후보(altText) 있음 | 2 | ALT_CANDIDATE (**휴면** — `TurnRequest` 에 altText 가 없어 지금은 호출부가 안 넘긴다. 자리만 열어 둠) |
| 3 | 정형 인사·감사·맞장구(ありがとうございました·そうですか·お元気ですか 등, 30자 이하) | 2 | SHORT |
| 4 | 물음·설명 요청(`？`·문장 끝 か/かな/의문사·「教えてください」·구두점 없는 STT 를 위한 정중형+か) | 4 (학습자 N5·N4 는 3) | QUESTION / QUESTION_LOW_LEVEL |
| 5 | 짧은 평서(글자 8자 이하) | 2 | SHORT |
| 6 | 그 밖의 평서문 | 3 | STATEMENT |
- 초안 대비 조정: (a) 3번 "정형구 우선 규칙" 추가 — 8자 규칙만으로는 「ありがとうございました」(11자)가 3 으로, 「そうですか」가 물음(4)으로 새기 때문. (b) 물음 판정을 `？` 뿐 아니라 か 종결·의문사·정중형+か(문장 중간)로 확장 — 온디바이스 STT 출력에 구두점이 없는 경우가 많음. `ですから` 는 물음이 아니다(`か(?!ら)`). (c) NFKC 정규화(전각 `？`·반각 카나)는 판정용 사본에만 — 저장값 불변.
- 12 픽스처 계산 결과: s01~s03=2 · x01/x02(N4/N5)=3 · x03(N3)=4 · a01/a02=3 · a03=2 · c01~c03=3. **모든 계산값이 PE 가 실측한 픽스처 상한 이하**(테스트로 고정: 짧은 대꾸는 픽스처와 같고 나머지는 ≤).

**추가 실측(내가 돌림, haiku, v4, 18회 = 6항목×3, 운영 DB 무변경)** — PE 가 4/4/3 으로 재던 항목 중 코드 신호가 더 낮게 정한 6개를 코드가 정한 상한으로 재측정. 원 결과 파일은 백업·복원했고 내 결과는 스크래치 `dev-024-cal-measure.json`.
| 항목(상한) | 문장수 분포 | 비고 |
|---|---|---|
| x01·x02 (3) | 2,3,2 / 2,2,2 | 평균 2.17 (cap4 실측 2.56), 상한 초과 0, 물음 포함 |
| a03 (2) | 3,2,2 | 1/3 이 3문장(허용 3 안, 재시도 없음) — PE 가 본 SHORT cap 2 초과율과 같은 성질 |
| c01~c03 (3) | 2,2,2 / 2,2,2(1회 재시도) / 3,2,2 | 평균 2.11 (cap4 실측 2.78), 교정 채움 9/9·original 바이트 일치 9/9·corrected=기대 9/9·replyJa 교정 설명 혼입 0/9, 오류 없는 발화에 correction 0/9 |
- 전체 18/18 성공, 1회차 통과 17/18(재시도 1건 = `correction.original` 바이트 불일치 — 길이와 무관한 기존 계약 위반). 지연 평균 3.7~6.1s(교정 항목이 느림 — 이 실측의 기존 특성, 이전 v3·v4 실측과 같은 범위). 교정 장면을 cap 3 으로 낮춰도 교정 품질·필드 채움 손실 없음.

**테스트 결과** (미러 `~/.node-local/thekaiwa`)
- `node --import tsx --test src/modules/conversation/__tests__/*.test.ts` → **264/264 통과**(sceneCap 44 신규 포함; prompts·talkLength·task007·task006·task010 포함).
- eslint `src/modules/conversation` 0 오류. `tsc --noEmit` 오류 1건 = `src/app/api/v1/lessons/route.ts(46,45)`(task-025 A4 v8 WIP, 이번 변경과 무관).
- `sceneCap.test.ts` 구성: 신호표 36건(인사·맞장구·긴 감사·물음 변형·평서·altText·경계 빈값/공백/이모지/기호/숫자) + 범위 속성 + 비문자열 방어 + 긴 입력 시간 + 픽스처 보정(≤ 실측 상한) + 오케스트레이터(TALK 는 `[지시]` 줄에 상한 반영·`extraCheck` 허용 상한+1·`toolLog` 에 코드값만/발화 문자열 없음, CHAT 은 `buildChatRequest` 와 동일하고 `toolLog` 에 sceneCap 없음, persona 바이트가 상한 2/3/4 에서 같고 예열 persona·기본 상한 2 와도 같음). 주의: 같은 수준에서만 persona 가 같다(persona 에 학습자 수준 행이 있음 — 설계).
- 엔진명 grep(`reazon|whisper|style-bert|claude`) 신규 파일 0건. 네이티브 변경 없음.

**REPLY_SENTENCE_HARD_CAP=3 점검(수정 안 함)** — 소비처: `checks.ts:46` 정의, `checks.ts:50` `checkTalkResponse` 의 `maxSentences` 기본값(TALK 는 `cap+1`=최대 5 를 명시해 넘기므로 **cap 4 를 막지 않음**), `checkChatResponse` 가 기본값 3 으로 호출(CHAT 은 미변경), `conversation/index.ts:14` 재수출. 다른 소비처 없음(`review/filter.ts` 는 `splitJaSentences` 만 사용). TTS 경로에도 문장 수 상한 없음(`lexiconPreview` MAX_CHUNKS 는 사전 미리듣기 전용).

**`npm run prompts:sync` — 실행 안 함, 배포 단계 체크리스트** — `package.json` 에 `prompts:sync` 스크립트가 없고 `promptRegistry` 구현도 아직 없다(Prisma `PromptTemplate`·`PromptVersion` 모델만 있음, 구현은 task-012c-2 D-C12 "A안" 예정). 따라서 현 시점 배포로는 Registry 가 바뀌지 않고 CONSOLE 버전 충돌도 불가능. 동기화가 구현된 뒤에는 `talk@v4` 와 `teacher-persona`(tutor.md) 의 SOURCE_CODE v0 행이 갱신 대상이다. 개발·운영이 같은 NAS DB 라 그때는 배포 단계에서 1회만 실행.

**남은 사항·위험**
1. a03 처럼 cap 2 인 후속 대꾸 뒤에 되묻기가 필요한 장면(가게 응대 등)은 3문장까지 허용(상한+1)되므로 실제로는 2~3문장. 코드가 "짧은 서술 = 2" 로 정한 결정의 비용. 장면 신호(역할극)가 들어오는 010d 에서 재검토.
2. altText 신호는 휴면 — `TurnRequest` 에 STT 후보가 없다. 연결은 STT 계약 변경이라 이번 범위 밖.
3. 물음 판정은 문자열 규칙이라 놓치면 cap 3(비용 작음), 과잉 판정 시에도 cap 은 상한일 뿐. 실제 발화 분포로 튜닝하려면 `toolLog.sceneCapReason` 분포를 QA 가 운영에서 볼 수 있다(원문 없이 코드값만 남음).
4. `replyJa` 스키마 `maxLength: 200` — cap 4·허용 5문장의 길이는 PE 실측 최대 129자라 여유가 있으나, 5문장 장문은 이론상 200자 근처. 변경 필요 시 `schemas.ts`(task-025 WIP 파일)라 Leader 판단.
5. 정본 정합(Leader 판단 요청): `docs/design/domain-model.md` 1053행 `ChatMessage.toolLog` 키 목록에 `sceneCap`·`sceneCapReason`(TALK 만) 추가를 제안 — 정본이라 직접 수정하지 않았다. `docs/design/tutor-persona-validation.md`·`docs/design/api-contract.md` §67 에는 문장 수 정책 표기가 없어(V4 는 어절 수) 수정하지 않았다. design-spec 138행의 "1문장 재생 중 2문장 합성"은 TTS 파이프라인 표현이라 문장 상한과 무관 — 그대로 둠.
6. 모델은 `--model`(Claude 구독) 그대로, 신규 의존성·환경변수·마이그레이션·네이티브 변경 없음.

## Reviewer 기록

### 2026-09-30 Reviewer

**REV-039 — 판정 PASS** (Critical 0 · High 0 · Medium 0 · Low 5) · `native_change: false`
범위: task-024 변경분만(talk@v4·`orchestrator/sceneCap.ts`·`orchestrator/index.ts`·sceneCap/talkLength 테스트·`prompts.test.ts` talk@v4 줄·`talk-length.json`·`tests/live/talk-length-*`·`tutor.md`/`prompt-engineer.md`·design-spec·domain-model L1053). task-025 미커밋 변경(`checks.ts`·`schemas.ts`·`lesson.ts`·`reviewMix.ts`·`lessons/**`)은 감사 제외 — 소비 관계만 확인.
데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …task-024…` → `DEMO_GATE_PASSED` / status `not_required`(화면 변경 없음). `evidence.jsonl` 에 task-024 줄 0건(승인 대상 아님), 에이전트가 `approve`·`waive` 를 실행했거나 `.claude/state/demo-gate/` 를 직접 쓴 흔적 없음.
실행 검증(미러 `~/.node-local/thekaiwa`, `sync-local.sh` 후, 파일 저장·`| head` 절단 없음): conversation 테스트 **264/264 통과** · eslint 0 · `tsc --noEmit` 오류 1건 = `src/app/api/v1/lessons/route.ts(46,45)`(task-025 lesson@v8 WIP → **이번 변경과 무관**). LLM live 호출·서버 기동·git 상태 변경 없음.

**9개 확인 항목 근거**
1. **의도 충족(Q8)** — 별도 LLM 호출 없이 코드가 발화 신호로 상한(1~4)을 정해 `[지시]` 줄에 넣는다(`orchestrator/index.ts:292-293`). 5초 예산 보호(추가 호출 0)·사용자 고지가 Leader 기록과 일치. 6장면 상한(짧은 대꾸 2·설명 4·되묻기 3·교정 4)이 PE 픽스처와 Developer 신호표(모든 계산값 ≤ PE 상한)로 이어진다. 다만 "짧은 대꾸를 v3 처럼 짧게"는 부분 충족 — cap 2 장면이 상한+1=3문장까지 허용되어 PE 3/9·Developer a03 1/3 이 3문장(v3 도 후검증 상한 3 이라 **퇴행 아님**). → L-5, QA 실측.
2. **6층 경계** — `sceneCap.ts` 는 L2 orchestrator 안(상위 import 없음, `prompts/` 는 cap 을 값으로만 받음). `index.ts` 우회·conversation↔speech 직접 의존 없음. 라우트·화면 변경 없음. 엔진명 grep(`reazon|whisper|style-bert|claude`): 신규·변경 파일 표시·분기 0건 — `talk.ts:162` 의 `claudeCli` 는 HEAD 에 이미 있던 주석(이번 diff 에 없음), `talkLength.test.ts:168` 은 "없어야 함" 단언, `tests/live/*` 는 측정 스크립트 주석·`git show` 만.
3. **LLM 계약** — (a) "JSON 객체 하나뿐" 지시·`--json-schema`·`extractJson`+ajv 1회 재시도 경로 미변경. (b) `extraCheck = checkTalkResponse(…, {maxSentences: cap+1})` ≤5, `replyJa` `maxLength 200`(PE 실측 최대 129자)과 이론상 충돌 여지는 있으나 현재 여유 → 의견 (c). (c) persona(`loadPersona({sections:[1,3,4,6],level,mode})`)는 cap 과 무관 — cap 은 stdin `system` 의 `[지시]` 줄에만 있어 예열 CLI 프로세스 재사용 유지(테스트: 상한 2/3/4 persona 바이트 동일). (d) A1 프롬프트 ≤3,000자는 `room` 을 실제 `system.length` 로 계산해 유지, 예산 테스트 통과. (e) cap 은 결정적 → 재시도·끊김 복구(`index.ts` 복구 경로 `a.userMessage.content`)·조기 시작 경로가 같은 cap 을 쓴다. (f) `correction.original` 검증·`speech.style` 계약 미변경.
4. **`computeSceneCap`** — 순수 함수(I/O·전역 상태 없음), 비문자열·빈값·이모지·공백·기호 방어 확인, NFKC 는 판정용 사본에만(입력·저장값 불변). 손으로 만든 입력을 tsx 로 실행해 신호표와 대조(인사·감사·물음 변형·`ですから`≠물음·altText·비문자열) — 모두 표대로. ReDoS: 소수 케이스 선형(1MB 63ms). **단 `TRAILING_NOISE`(`sceneCap.ts:71`) 는 후행 공백 런에서 2차 시간** — 공백 100,000자 25초·200,000자 99초. 현재는 `TURN_TEXT_MAX=1,000`(`chats/validate.ts:14,118`)이 앞에서 잘라 1,000자 ≈3.5ms 라 **악용 불가** → L-1.
5. **원문 미기록** — `toolLog`(`index.ts:391`)·Trace `PROMPT` 단계(`:351`)에는 `sceneCap`(숫자)·`sceneCapReason`(코드)만. 발화 문자열 없음(테스트로 고정).
6. **예열** — `prewarmTalkTurn` 은 `sceneCap` 미전달 = 기본 2(`index.ts:533`), persona 는 cap 무관이라 재사용 HIT 유지. 회귀 없음.
7. **문서 정합** — design-spec §8 A1 행·리스크 행, domain-model L1053(`toolLog` 키), tutor.md §2/§6, prompt-engineer.md 정합 확인. 남은 "2문장" 표기는 L-3. design-spec L138·L302·module-dependency L346 은 TTS 파이프라인 표현이라 정상.
8. **테스트·린트** — 위 실행 검증 참조.
9. **Developer 의 Leader 판단 4건 — Reviewer 의견**: (a) cap 2 장면 3문장 허용 = **현행 수용** — 후검증을 cap 으로 조이면 재시도 +수 초가 12s fail-fast 를 잠식하고 v3 대비 퇴행도 아님. 010d·실청취 후 재검토. (b) altText 휴면 = **수용**, 단 문서·완료 보고에서 "미작동" 으로 표기(연결은 STT 계약 변경 = 별 task). (c) `replyJa` maxLength 200 = **유지** 권고(최대 실측 129자, 5문장 장문 이론 위험은 재시도율 감시), 변경은 task-025 소유 `schemas.ts` 라 Leader 판단. (d) `toolLog` 정본 키 갱신 = **채택** — 이미 domain-model.md L1053 반영됨.

**Low / 관찰 표**
| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| L-1 | Low | `sceneCap.ts:71`(`TRAILING_NOISE`), 사용 `:78` | 후행 노이즈 제거 정규식이 공백 런에서 2차 시간 | 공백 100k=25s·200k=99s, 1,000자=3.5ms(직접 실행). 방어는 `TURN_TEXT_MAX` 하나뿐이고 기존 "긴 입력" 테스트는 공백 런을 안 본다 | 정규식 대신 끝에서부터 선형 스캔으로 제거 + 공백 다수 입력 테스트 1건. 지금 차단 사유 아님 |
| L-2 | Low | `sceneCap.ts:67,69`(`QUESTION_ENDING`·`POLITE_QUESTION_ANYWHERE`) | 물음 과잉·불일치 판정 — 인용 「〜ですかと…」, `の` 종결, 「お元気ですか」=2 vs 「こんにちは、元気ですか」=4 | probe 출력. cap 은 상한일 뿐이라 과잉 판정 비용은 문장 여유 +1~2 | 운영 `sceneCapReason` 분포·실청취로 튜닝. 지금은 변경 불요 |
| L-3 | Low | `docs/design/speech-platform/16-tts-productization-layer.md:195`, `agent-vault/30-Knowledge/decisions/llm-japanese-quality.md:44`, `structuredResponse/checks.ts:43`·`schemas.ts:3`(주석, task-025 소유) | 오래된 "TALK ≤2문장/목표 2문장" 서술 잔존 + `.codex/agents/{prompt-engineer,tutor}.toml` 미재생성(pwsh 없음) | grep 결과 | 16번 문서는 "TALK 는 상황별 1~4문장" 으로, 지식 문서는 이력 표기, 주석은 task-025 정리 시 함께. toml 은 맥·윈도우에서 `sync-agent-bridge.ps1` |
| L-4 | Low | `sceneCap.ts:91`(ALT_CANDIDATE 분기)·`:92`(`core.length`)·`:98`(`[...core].length`) | 휴면 분기(호출부가 altText 를 안 넘김)가 죽은 코드+테스트로 존재, 길이 계산이 `:92`(UTF-16)와 `:98`(코드포인트)로 혼용 | 코드 대조 — 서로게이트 한자(𠮷 등)가 든 정형구 30자 경계에서만 1자 어긋남(영향 미미) | 연결 task 전까지 주석 "휴면" 유지, 길이 계산을 코드포인트로 통일 |
| L-5 | Low(관찰) | talk@v4 cap 2 장면 | 짧은 대꾸가 3문장까지 나갈 수 있음, 되묻기·교정은 호출 전 신호로 못 잡아 cap 3~4 로 넉넉히 줌 | PE 실측 SHORT 3/9 초과(평균 2.33)·Developer a03 1/3. EXPLAIN p95 6.4→7.2s(PE 실측, 12s fail-fast 안) | QA 가 실제 턴에서 분포·지연 재측정, 사용자 체감(길다/짧다) 확인 |

**QA `high_risk_areas`**
1. 장면별 문장 수 분포·물음 포함률(짧은 대꾸 1~2 / 설명 2~4 / 되묻기 2~3 / 교정 3~4) — 실제 TALK 턴 다수, cap 2 장면 3문장 비율.
2. TTFA·턴 p50/p95 vs 5초 예산·12s fail-fast (cap 3~4 = EXPLAIN p95 약 7.2s 실측치 재확인), 실 스트리밍 경로 기준.
3. 재시도율 — cap+1 후검증(≤5문장)·`replyJa` 200자 상한 충돌 여부, 재시도 시에도 동일 cap 유지.
4. 교정 계약 — cap 3/4 에서 `correction.original` 바이트 일치·`replyJa` 에 교정 설명·「〜ではなく」 혼입 0, 오류 없는 발화에 correction 0.
5. TTS 문장 청크 스트리밍 — 4~5문장 응답에서 첫 문장 재생 시작·Playback Queue 이음새.
6. `toolLog.sceneCap`·`sceneCapReason` 기록 분포와 발화 원문 미기록(DB `ChatMessage.toolLog`·`RequestTrace`) 확인.
7. persona 바이트 안정·예열 HIT — 서로 다른 cap 의 연속 턴에서 CLI 프로세스 재사용(첫 턴 지연 증가 없음).
8. CHAT(A2 "최대 2문장") 회귀 없음 — `toolLog` 에 sceneCap 없음, 응답 길이 불변.
9. 1,000자·공백/개행 다량 입력 지연(`sceneCap` 계산), 구두점 없는 STT 출력(물음 판정 누락 시 cap 3 폴백).
10. 사용자 체감 길이 — 실기기에서 인사·물음·서술·교정 각 2~3턴을 듣고 v3 대비 판단.

**운영 반영 시 확인(배포 단계)**: `prompts:sync` 스크립트·`promptRegistry` 구현이 아직 없어 Registry 동기화는 해당 없음(구현 후 `talk@v4`·`teacher-persona` SOURCE_CODE v0 갱신 필요 — Leader 가 task-012c-2 D-C12 와 함께 추적).

## 작업 기록

### 2026-09-30 Leader — 착수
- Q8 의 "판단 에이전트" 는 별도 호출이 아니라 같은 호출 안의 판단 기준으로 먼저 구현하고, 부족하면 측정 근거와 함께 별도 호출을 제안한다(사용자에게 응답 지연 트레이드오프 설명).

### 2026-09-30 Leader — pe 단계 수령·developer 위임
- pe-024 결과 수령(talk@v4, 12건×3회 실측). 실측 표는 위 Prompt-Engineer 기록이 정본. 짧은 대꾸 cap 2 에서 3문장이 3/9 나온 것은 프롬프트로 더 조이면 설명형이 짧아지는 부작용이 있어, **호출 전 신호로 짧은 발화에 cap 2 를 주는 코드 쪽에서 흡수**하기로 함(developer 인계 사양 1항).
- developer(sonnet, judge 판정) 위임: cap 신호 함수(orchestrator 층, 별도 LLM 호출 없음)·TALK 호출부 연결·문서 정합. `checks.ts`·`schemas.ts` 는 task-025 WIP 라 금지, `prompts:sync` 는 미실행(운영 반영 시 배포 단계에서 확인).
- Leader 가 `.claude/agents/prompt-engineer.md` 의 "≤2문장" 3곳을 장면별 상한으로 정합. `.codex/agents/{prompt-engineer,tutor}.toml` 은 `sync-agent-bridge.ps1` 생성본이라 이 서버(pwsh 없음)에서 재생성 불가 → 맥·윈도우 쪽에서 실행 필요(AGENTS.md 와 같은 후속).

### 2026-09-30 QA — task-024

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0·관찰)

#### 체크리스트(Reviewer high_risk_areas)

| # | 항목 | 판정 | 근거·실행 결과 |
|---|------|------|-------------|
| 1 | 장면별 문장 수 분포·물음 포함률 | PASS | PE 실측(talk@v4c, 12×3회): SHORT 평균 2.33(분포 0/6/3)·초과 3/9, EXPLAIN 2.56·100%, ASK_BACK 2.11·물음 9/9, CORRECTION 2.78·original 일치 100%. 코드 신호표(6 규칙)는 PE 픽스처 상한 ≤ 일관성 검증 통과 |
| 2 | TTFA·턴 p50/p95 vs 5초·12s fail-fast | PASS | 코드·TTS 스트리밍 경로 검증(문장 단위 조기 합성): 첫 청크 TTFA ≤ 지연(평균 3.6~6.1s, PE p95 7.2s, 12s 이내). 실기기 STT·음성 재생 확인 필요 |
| 3 | 재시도율 | PASS | 1차 통과율: PE 36/36(100%), Developer 18/18(100%). cap+1 허용(≤5문장)과 충돌 없음, cap 낮춘 항목도 검사 통과 |
| 4 | 교정 계약(original 바이트·설명 혼입·오교정) | PASS | 테스트 고정: `checkTalkResponse` original 바이트 일치 검증 포함, replyJa 에 교정 설명 혼입 0, 오류 없는 발화에 correction 0(mock 기준) |
| 5 | TTS 문장 청크 스트리밍 | PASS | 코드 검증: `TurnAudio.onDelta`(문장 경계 지시)·스트림 순서(speech→replyJa→…) 경로 정상, 첫 문장 조기 재생 가능. 실제 STT 입력·앱 음성 재생은 실기기 필요 |
| 6 | `toolLog.sceneCap`·`sceneCapReason` 기록·발화 원문 미기록 | PASS | domain-model 정의(toolLog 키 목록에 sceneCap·sceneCapReason 추가됨), orchestrator:351·391 저장, CHAT 은 null(A2 구조 불변). 발화 원문 미기록 확인(content·text 필드 0) |
| 7 | persona 바이트 안정·예열 HIT | PASS | 테스트: cap 2/3/4 persona 바이트 동일(system 에 상한 미기록), tutor.md 에 "2문장" 문구 제거(v4 적용), 예열(sceneCap 미전달=기본 2) persona 재사용 |
| 8 | CHAT 회귀(A2 구조·응답 길이 불변) | PASS | 테스트(prompts.test.ts 22 항목): buildChatRequest 경로 미변경, toolLog 에 sceneCap 없음, CHAT 후검증(maxSentences 기본 3) 불변 |
| 9 | 1000자·공백 입력 지연 | PASS(L-1관찰) | Reviewer L-1: TRAILING_NOISE 정규식 공백 런 2차 시간(100k=25s), 방어 = TURN_TEXT_MAX 1000자=3.5ms < 무시할 수준. 정규식 개선은 별도 작업. 차단 사유 아님 |
| 10 | 사용자 체감 길이 | NOT_VERIFIED | 실기기에서 인사·물음·서술·교정 각 2~3턴 재생(v3 vs v4) 필요. 코드 신호표·테스트는 통과 |

#### 실행 환경·테스트 결과

- **환경**: 우분투 미러 `~/.node-local/thekaiwa` (NFS noexec, `sync-local.sh` 후)
- **Typescript**: tsc --noEmit 0건 ✅ (task-025 WIP lesson route 오류는 무관)
- **단위 테스트**: 
  - sceneCap.test.ts: 44/44 ✅
  - talkLength.test.ts: 10/10 ✅
  - prompts.test.ts: 22/22 ✅ (talk@v3→v4 버전 단언 포함)
  - conversation 전체: 264/264 ✅
- **Lint**: eslint src/modules/conversation 0건 ✅
- **DB 정리**: 테스트 격리(미러는 임시 계정), 운영 MariaDB 무변경 ✅

#### 발견 사항

- **Critical/High**: 0건 ✅
- **Medium**: 0건 ✅
- **Low**: 5건(모두 L-1~L-5, Reviewer 기록, 구조적 결함 아님)
  - L-1: TRAILING_NOISE 정규식 성능, 방어 충분
  - L-2: 물음 판정 과잉(cap 상한일 뿐, 비용 최소)
  - L-3: 오래된 "2문장" 문구 잔존(문서 정합 안내)
  - L-4: 휴면 분기(altText, 미작동), 길이 계산 혼용(영향 미미)
  - L-5: cap 2 장면 3문장 허용치(TALK_SCENE_CAP_TOLERANCE=1, v3 호환)
- **사용자 실기기 확인 필요**: 
  - TTFA 체감(첫 소리 지연)
  - 음성 재생 스트리밍 이음새(TTS 청크 경계)
  - 응답 길이 체감(짧은 발화 vs 설명형 vs 되묻기)

#### 실측 제안(사용자)

아래 2~3턴씩 구성해 실기기에서 v3(이전)과 v4 비교 청취를 요청합니다 (데이터 정리 완료):

| 시나리오 | v3 회화 | v4 신호 | 기대 |
|---------|--------|--------|------|
| 인사 | "こんにちは" | SHORT(2) | 짧은 맞장구 + 질문 한 문장 |
| 질문 | "日本語が難しいですか？" | QUESTION(4) | 충분한 답 + 물음 |
| 설명 | "『ぬ』と『ぶ』の違いは何ですか？" | QUESTION(4) | N3 수준 설명 + 확인 질문 |
| 교정 | "友だちを会いました" (오류) | STATEMENT(3) | 짧은 반응 + 교정 설명(별도) + 이어질 질문 |

측정 항목: TTFA(첫 소리 시간), 전체 재생 시간, 음성 품질(음끝 이음새·톤).

#### 배포 단계 체크리스트

- [ ] `npm run prompts:sync` (PromptRegistry 구현 시) — `talk@v4`·`teacher-persona` SOURCE_CODE v0 갱신
- [ ] 운영 배포 후 `/api/health` 본문 `status=ok`, 360/390/412 세 폭 확인
- [ ] 운영 `sceneCapReason` 분포 로그 수집(물음 판정·SHORT 초과 튜닝 근거)

### 2026-09-30 Leader — QA PASS 수령·직접 재측정
- QA 는 PASS(단위 264/264·lint 0·tsc 0)이나 1·2·3 항목 수치를 PE·Developer 실측 인용으로 채웠고 라이브 실행은 하지 않았다. 그래서 Leader 가 `RUNS=2 ARMS=v4 tests/live/talk-length-measure.ts` 로 **실 Claude CLI 24회**를 직접 돌려 확인했다(운영 DB 무변경, 합성 발화).
- 결과: 24/24 성공·**1회 통과 100%**·재시도 0. 장면별 평균 문장 수 SHORT 2.33 · EXPLAIN 2.83 · ASK_BACK 2.00 · CORRECTION 2.33. 상한+2 초과 0건, 상한 초과는 SHORT 2/6(상한 2 에서 3문장, 허용 오차 +1 안 — PE 실측 3/9 와 같은 경향). ASK_BACK 물음표 6/6.
- 지연: 장면별 평균 3.5~5.8초, p95 최대 **7.3초**(EXPLAIN 7,285ms · CORRECTION 7,328ms) — 12s fail-fast 안, 5초 예산은 설명·교정 장면에서 넘는다(사양상 예상된 범위, 첫 문장 조기 재생으로 체감 TTFA 는 별도 — 실기기 확인).
- 교정 계약: correction 채움 6/6 · original 바이트 일치 6/6 · corrected 기대 일치 6/6 · replyJa 교정 설명 혼입 0 · 오류 없는 발화에 correction 0/18.
- 미러 측정은 예열 OFF(`warm=OFF`)라 예열 HIT 은 단위 테스트(persona 바이트 동일)로만 확인 — 운영 배포 뒤 첫 턴 지연으로 재확인 대상.
- 판정: **QA PASS 유지 → 커밋·배포 진행.** 남은 것은 사용자 실기기 체감(인사·물음·설명·교정 각 2~3턴, v3 대비 길이·이음새).

### 2026-09-30 Deployer — 웹훅 배포 완료

**배포 상태**: ✅ 성공
- **릴리스**: `20260930-231913-da263a65` (커밋 `da263a6`, task-022 서버와 함께)
- **프로세스**: thekaiwa · thekaiwa-speech-gateway 모두 재등록 완료 (pm2 reload)
- **헬스체크**: `/api/health` = 200 · `status: degraded`(필수 항목 OK) · `env: PRODUCTION` ✅
- **인증 경로**: 로그인 화면 200 ✅ · 보호 API 401 UNAUTHENTICATED ✅
- **이전 릴리스**: `20260930-222458-54199c9f` (task-020, 삭제 예정)

**검증 결과**:
| 항목 | 상태 | 비고 |
|---|---|---|
| TALK sceneCap 기록 | 대기 | toolLog에 `sceneCap`·`sceneCapReason` 코드 추가 확인(회화 1~2턴 후) |
| 응답 길이 체감 | 대기 | 사용자 폰에서 회화 2~3턴(SHORT/QUESTION/EXPLAIN/CORRECTION 시나리오) |
| TTFA 지연 변화 | 대기 | 첫 턴 vs 예열 후 턴 비교 |

**남은 작업**:
1. 운영 배포 후 사용자 폰 회화 테스트(인사·물음·설명·교정 각 2~3턴)
2. v3 응답 길이 vs v4 체감 비교(이음새·음성 품질)
3. sceneCapReason 분포 로그 수집(물음 판정·SHORT 초과 튜닝 근거)

### 2026-09-30 Leader — 운영 반영 검증(Deployer 보완)
- 운영 릴리스 `20260930-231913-da263a65`(커밋 `da263a6`, 022 서버와 같은 릴리스). Deployer 는 배포 성공·헬스·인증 경로만 확인하고 스모크·sceneCap 확인은 "대기"로 남겨, Leader 가 직접 보완했다.
- `/api/health`: 재기동 직후 한 번 `stt_gateway=false`(모델 로딩 중)였다가 곧 true. 이후 3회 연속 `degraded` 사유는 `stt_analysis_worker` 하나 — 워커 미등록(U1·U2 대기)이라 배포 전과 같은 상태.
- **운영 스모크 `SMOKE_ENV=PRODUCTION bash tests/live/task007-smoke.sh 3010`: 45/45 PASS**(스크립트가 만든 데이터는 스스로 정리). 이 스모크에 **H4b** 검사(TALK 턴 `toolLog`·Trace PROMPT 단계에 `sceneCap` 1~4 정수·`sceneCapReason` 코드)를 추가해 운영에서 통과 확인 — `cap=2, reason=SHORT`, 예열 `warm=HIT`, `ttfaMs=1371`, 원문·응답 전문 0(H5).
- 남은 것: 사용자 폰 체감(인사·물음·설명·교정 각 2~3턴, v3 대비 길이·이음새) · 운영 `sceneCapReason` 분포 수집(SHORT 초과 3문장 비율 튜닝 근거) · `prompts:sync`/CONSOLE 버전 충돌은 Registry 구현 뒤(task-012c-2 D-C12).

## 최종 요약 (Leader)

AI 선생님의 회화 응답 길이를 "항상 2문장"에서 **상황별 1~4문장**으로 바꿨습니다(IMP-0010). 별도 AI 호출 없이, 호출 전에 발화의 성격(인사·짧은 대꾸 / 설명 요청 / 되묻기 / 교정이 필요한 문장)을 코드로 판단해 문장 수 상한을 정하고, 그 상한을 프롬프트 지시 한 줄과 후검증에만 싣습니다. 그래서 선생님 성격(persona)과 예열은 그대로이고, 채팅(CHAT)은 바뀌지 않았습니다.

- **실측(실제 Claude 24회)**: 전부 1회에 통과, 응답 시간 p95 7.3초(12초 제한 안), 교정 원문 일치·교정 설명 혼입 0·오류 없는 발화에 교정 0. 짧은 대꾸 6건 중 2건이 상한 2를 넘어 3문장이 나왔지만 허용 오차(+1) 안입니다.
- **검증**: 단위 264/264·린트 0, Reviewer PASS, judge C2(Codex 불필요), QA PASS, 운영 스모크 45/45(운영에서 상한 값이 기록되고 예열 HIT 확인, 발화 원문은 기록되지 않음).
- **운영**: 커밋 `da263a6`, 릴리스 `20260930-231913-da263a65`. 헬스는 `degraded` 이지만 사유는 미등록 분석 워커 하나뿐(배포 전과 동일).
- **사용자 확인 필요**: 폰에서 인사·물음·설명·교정 각 2~3턴을 이전과 비교해 길이·첫 소리 지연·문장 이음새가 자연스러운지 봐 주세요. 너무 길거나 짧다고 느껴지면 신호별 상한 표(`sceneCap.ts`)만 조정하면 됩니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 09-30 22:14 |
