---
task_id: task-022
title: "개선 — 음성 설정 조절 범위 약 2배 확대(속도·높낮이·억양·말투) (IMP-0005)"
status: doing
base_ref: 055dbcf
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-003d-tts-p0, task-005-settings-attendance, task-003c-tts-productization-design]
tags:
  - type/task
  - domain/improvement
  - domain/speech
aliases:
  - 음성 설정 범위 확대
  - task-022
created: 2026-09-30
updated: 2026-09-30
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 2
  repo_path: "docs/demo/task-022-improve-voice-range-v2.html"
  artifact_url: "https://claude.ai/artifact/3k9kDwwLFcPD1n7AjUa4Z5"
  content_sha256: "8eabcf93748e58be8c7509837aac41dbbebbbe341f809f933fdfac3adb915b4f"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
개선 백로그 [[IMP-0005-ai강사-음성-부자연스러움]] — 사용자가 어색하다고 느낀 곳은 **설정 화면의 미리듣기**였다. 그래서 우선 **설정에서 억양·말투·속도 변경 폭을 지금의 약 2배까지** 조절할 수 있게 한다. 다른 화면(회화·오늘의 회화)의 어색함은 사용자가 더 써 보고 다시 알려 주기로 했다 → 이 task 는 **범위 확대만** 한다.

## 사용자 결정 (2026-09-30, Q4)
> "내가 ai강사를 어색하다고 느낀건 설정화면의 미리듣기였는데 다른곳도 약간 어색하긴하지만 이건 더 테스트해봐야할것같아. 일단은 설정에서 억양, 말투, 속도의 변경 차이를 지금의 2배가량 더 넓게 설정할수있도록 해줘"

## 포함 항목
- [[IMP-0005-ai강사-음성-부자연스러움]] (P1, S~M)

## 현재 값 (착수 시점)
- `src/modules/speech/tts/parameterResolver.ts` `RANGES`: speed 0.6~1.2 · pitch 0.8~1.2 · intonation 0.8~1.2 · styleWeight 0~2. `renderingPlan.ts` 가 `round3(clamp(x, RANGES.*))` 로 강제.
- 화면: `VoiceSettings.tsx` 슬라이더가 min/max 를 하드코딩(L155~157, step 0.05). 말투는 음성이 가진 스타일 선택(자동+Neutral·Happy 등)이고 styleWeight(말투 세기)는 draft 에만 있고 슬라이더는 없다(확인 필요).
- M4 `speech/tts-service/kaiwa_tts/params.py` 는 범위를 자르지 않는다 → **M4 배포 없이 앱 쪽만 바꿔도 값은 통과**한다. 단 pitch/intonation ≠ 1.0 이면 pyworld 후처리(+≈0.25s·약간의 음질 저하)가 붙는다.

## 범위
1. **"약 2배"의 해석** — 각 축의 **1.0 기준 편차를 두 배로**: pitch·intonation 0.8~1.2 → 약 0.6~1.4, speed 는 하한 0.6 이 이미 느림 쪽으로 넓어 상·하한을 M4 실측 후 결정(예: 0.5~1.5 안팎), styleWeight 0~2 → 0~4 후보. **최종 수치는 M4 실측 뒤 Leader 확정**(음질이 무너지는 값은 상한으로 두지 않는다).
2. **일관성** — 같은 범위를 한 곳(`RANGES`)에서 읽어 슬라이더 min/max·저장 검증(`preferences`)·resolver 클램프·문서가 어긋나지 않게 한다. 하드코딩된 슬라이더 값을 `RANGES` 참조로 바꾼다.
3. **말투** — 스타일 선택지는 음성 모델이 가진 스타일로 제한된다(시드 3종은 Neutral·Happy 뿐). 말투 변화폭은 ① styleWeight 범위 확대 ② 화면 노출 여부(슬라이더가 없다면 UI 추가 = judge 가 데모 수준 판정) 두 가지를 조사해 사실대로 보고한다. 스타일 종류 추가는 M4 쪽 모델 스타일 벡터가 필요해 이 task 밖.
4. **문서** — `docs/design/domain-model.md`(L983~987)·`docs/design/api-contract.md`(L24 오류 예시·L466 설정 검증)의 범위 문구를 새 값으로 갱신. `screens.md` 슬라이더 설명.
5. **기존 저장값** — 이미 저장된 사용자 값(옛 범위 안)은 그대로 유효해야 한다(범위를 넓히는 방향이라 호환).

## 비범위
- 새 스타일·새 음성 모델 추가(M4), 미리듣기 외 화면의 억양 튜닝, LLM `speech.style` 매핑 변경.

## 완료 기준
- 새 범위 양 끝값에서 M4 합성이 실제로 성공하고(지연 p50·p95 기록, 음질 청취 확인 메모) 슬라이더로 도달 가능, 범위 밖 값은 서버가 거부(**400 VALIDATION** — api-contract §0-5 는 422 를 도메인 규칙 위반에 쓰고 #14 설정 검증은 400 이라 기존 규약을 따른다. 2026-09-30 Leader 정정).
- 옛 범위 값 저장·재생 회귀 없음. `tsc`·`eslint`·단위 테스트 0 fail. 캐시 키(12요소)가 값 변경에 따라 달라짐을 확인.
- 사용자 체감 확인(폰에서 미리듣기) 요청을 최종 요약에 남긴다.

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 feature · 복잡도 2 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: designer, prompt-engineer?, developer, reviewer, qa
- 데모: **delta** (required=true, rule=JV-ui_change) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: 없음

## Designer 기록

### 2026-09-30 C2 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-022",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": false,
    "wanted_before_budget": true,
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
      "confidence": 0.86
    },
    "high_risk_change": {
      "noul": 0.1
    },
    "reviewer_doubt": {
      "noul": 0.89
    }
  },
  "rule_overrides": [
    {
      "field": "codex_required",
      "value": false,
      "rule_id": "CX-limit-unknown-hold"
    }
  ],
  "fallback": null,
  "input_tokens": 1065,
  "cost_usd": 0.000045,
  "latency_ms": 250
}
```

engine: jev
결정: codex_required=false · wanted_before_budget=true · budget_rule=CX-limit-unknown-hold(override: CX-limit-unknown-hold) · focus=design_assumption(0.86) · reviewer_doubt=0.89
규칙 덮어쓰기: CX-limit-unknown-hold

- [22:40] delta 데모 v1 작성 — `docs/demo/task-022-improve-voice-range-v1.html` (`check.mjs lint --expect task-022-v1` → DEMO_LINT_PASSED, 토큰 `src/app/globals.css@sha256:22f382529f92`). Artifact 게시·검토 요청은 Leader.
  - 수치: Leader 범위 확정값 그대로 — 속도 0.5~1.5 · 높낮이 0.7~1.4 · 억양 0.6~1.4 · 말투 세기 0~4, 한 칸 0.05. "양 끝값에서 생기는 일" 표는 Developer M4 실측 수치를 옮겼다(엔진명 없이). 미측정 조합(높낮이 0.7 + 억양 1.4)은 "확인 필요"로 표시.
  - 구성: 범위 비교 막대(현재 vs 제안, 기본 1.0 점선) · 설정 > AI 선생님 목소리 카드 현재/제안 나란히(슬라이더·말투·목소리 조작 가능) · 제안만 · 세 폭(360/390/412) · 바뀐 곳 표시 · 양 끝값 표 · 폭별 한 칸 이동 거리 표 · 하단 결정 패널.
  - 핵심 설계 결정: ① 슬라이더 줄 = 이름(왼쪽) · 값 15px 고정폭 숫자 + 방향 말(느리게/빠르게, 낮게/높게, 평평하게/크게, 옅게/진하게) ② 눈금 3개(최저 · 기본 1.0 · 최고) + 기본 자리 눈금선 ③ 채움은 기본 1.0 에서 손잡이까지만(1.0 이면 채움 없음) ④ 입력 높이 44px · 손잡이 26px · aria-valuetext "1.30배, 기본보다 빠르게" ⑤ 말투 세기는 자동·차분일 때 "거의 달라지지 않아요 · ‘밝은’에서 차이가 커져요" 안내를 항상 보인다(Leader 지시) ⑥ 저장값 호환 — 위치만 가운데 쪽으로 이동. 카드 순서·미리듣기 동작은 불변.
  - 결정 필요: **D1 말투 세기 슬라이더** — A 말투 바로 아래 신설(디자이너 의견) / B 슬라이더 묶음 맨 끝 신설 / C 만들지 않음. **D2 넓어진 구간 안내 한 줄** — A 보임(높낮이 0.8 미만은 "조금 거칠어질 수 있어요" 문구, 디자이너 의견) / B 없음. **D3 기본값 되돌리기** — A 바꾼 값이 있을 때만 "↺ 기본값으로 되돌리기"(저장은 안 함, 디자이너 의견) / B 없음.
  - 참고: 말투 세기는 0~4 · 0.05 단위라 한 칸이 3~4px(360~412) — 손가락으론 대략, 값 표시로 맞춤(0.1 단위 여부는 developer·Leader 판단 사항으로 남김).
- [22:44] **v1 은 고치지 않고 v2 를 새로 만들었다** — `docs/demo/task-022-improve-voice-range-v2.html` (`check.mjs lint --expect task-022-v2` → DEMO_LINT_PASSED). Leader 요청은 "v1 파일만 수정"이었으나, v1 은 이미 `review_requested`(v1·content_sha256 `68bf679d…`) 상태라 제자리 수정은 게이트 규칙 위반(검토에 올린 버전 수정 금지)이고 도구로도 막힌다: `gate.mjs:281` 승인 시 해시가 다르면 "v2 로 다시 검토 요청하세요"로 거부, `gate.mjs:247` 같은 버전 재검토 요청 거부. v1 파일은 그대로(해시 `68bf679d…` 유지 확인). Leader: `status --to review_requested --version 2 --repo-path docs/demo/task-022-improve-voice-range-v2.html` 로 다시 요청 필요.
  - v2 변경 ① 양 끝값 표 "확인 필요" → 실측: 높낮이 0.7 + 억양 1.4 동시 끝 = 성대가 울리는 구간 −30.5%·−34.2%(기준 −25% 넘음), 목소리 평균 높이 0.79·0.76배(기대 0.7배), 첫 소리까지 약 0.81초. 단독은 높낮이 0.7 −19.5%·억양 1.4 −2.7% 로 기준 안. 높낮이 0.7 단독 행도 −19.5% 로 갱신. 엔진명 없음(grep 0건).
  - ② D2 = A 안내에 조합 문구 추가 — 높낮이 < 0.8 이면서 억양 > 1.2 일 때 슬라이더 묶음 아래 한 줄: "높낮이를 낮게, 억양을 크게 — 둘을 동시에 끝 쪽으로 두면 소리가 갈라지거나 얇아질 수 있어요. 한쪽을 가운데 쪽으로 옮겨 보세요." D2 = B 설명에 "조합 음질 저하도 알리지 않는다" 단점 추가.
  - ③ 결정 **D4 높낮이 하한** 추가 — A 0.7 유지(배지 "권고 · 청취 후 재검토", 근거: 단독 0.7 은 기준 안 · 문제는 억양 1.2 초과와 동시일 때만이며 안내로 알림 · "약 2배"에 더 가까움 · 하한은 코드 상수 한 곳이라 청취 후 바꾸기 쉬움) / B 0.8 로 조임(안전, 낮은 쪽 확대 없음, 0.8 단독 약 −6%).
  - ④ D4 연동 — 슬라이더 최솟값·눈금(0.7↔0.8, 기존 값은 새 하한으로 올림)·범위 비교 막대와 설명·양 끝값 표(높낮이 최저 행·조합 행)·한 칸 이동 거리 표(높낮이 14↔12칸)·캡션·결정 요약이 함께 바뀐다. B 에서 높낮이 0.8 + 억양 1.4 는 "측정하지 않음"으로 표시.
  - 확인: 360·390 가로 넘침 없음(scrollWidth = innerWidth), 양 끝값 표 첫 열 줄바꿈 보정. 머리 "데모 v2"·"v1 → v2 바뀐 점" 안내 추가.

## Developer 기록

### 2026-09-30 M4 범위 실측
- [22:28] M4 `/synthesize` 직접 호출(직렬, 총 49회 = health 1·voices 1·합성 47, 실패 0). voice jvnv-F1-jp(teacher_haruka) spk0, 예문 S1 「ありがとうございます。」·S2 「明日の午後、駅の近くのカフェで友達と会う予定です。」. 스크립트·raw/report JSON·wav 는 스크래치패드 `task022/`(레포 밖).
- 기준(1.0×3회): 지연 S1 300~328ms·S2 313~403ms, 길이 S1 1354ms·S2 4253ms(편차 ±1.3%), F0 평균 S2 403~405Hz(±0.3%). F0 은 numpy YIN(pyworld 없음 — 우분투 venv 미설치) — 합성 톤·켑스트럼으로 교차 확인.
- speed 0.5/0.6/1.2/1.5: 전부 200, 길이비 1.75~1.82/1.47~1.55/0.86~0.88/0.71(기대 2.0/1.67/0.83/0.67, 오차 −12.5~+6.7% — 짧은 문장 쪽 앞뒤 무음 때문에 큼). 지연 +0~104ms.
- pitch 0.6/0.7/1.3/1.4: F0 평균비 0.60~0.61/0.71~0.73/1.25~1.30/1.34~1.37 — 전부 ±15% 안. 단 낮은 쪽은 유성(주기성) 프레임이 0.7 −11~19%·0.6 −22~26% 줄어듦(0.8 은 −6%) → 음질 저하 신호. 지연 +167~208ms(S1)·+437~484ms(S2).
- intonation 0.6/0.7/1.3/1.4: S2 F0 σ비 0.54/0.73/1.22/1.37 — 방향·크기 기대대로. S1(1.3s)은 기준 σ 자체가 ±20% 흔들려 판정 불가. 지연 pitch 와 같음.
- pyworld 적용 요청(값 무관 ≠1.0) 지연 p50/p95: S1 496/514ms · S2 843/895ms(최대 922ms = 현행 pitch 1.2). 미적용 S1 309/354 · S2 320/471. 전부 기준 +1.5s 이내. `X-Kaiwa-Adjust` 전부 applied(skipped 0).
- styleWeight(Happy) 2/3/4: 전부 200, Happy 1 대비 F0 평균 +3~6%, 길이·무음·유성 변화 없음(붕괴 신호 없음). Neutral 4 는 기준 편차 수준 — Neutral 은 스타일 벡터 평균(id 0)이라 weight 가 거의 효과 없음(SBV2 구현 `mean+(style−mean)×w`).
- 결합: pitch1.4+inton0.6 통과(F0비 1.35~1.37·σ비 0.62). **pitch0.6+inton1.4 는 S2 F0비 0.70(기대 0.6, +16%)·유성 −35~43% → 기준 불통과**(낮게 내려가는 구간 F0 이 `0.6m+1.4(f−m)` 로 0 근처까지 떨어짐).
- 클리핑은 전부 <0.003%지만 SBV2 가 출력 피크를 1.0 으로 정규화해 이 지표는 왜곡을 못 잡는다. NaN·빈 오디오 0, SR 44100.
- 권고(청취 전 수치 근거): speed 0.5~1.5(0.5 는 M4 스키마 하한) · intonation 0.6~1.4 · pitch 안전 0.7~1.4, 0.6 은 경계 · styleWeight 0~4(3~4 경계). pitch 하한 0.6 이면 intonation 상한과의 결합이 깨진다 → 하한 0.7 또는 결합 제한 필요(Leader 판단). **청취 품질은 사용자 확인 필요**(자연스러움은 측정하지 않음).
- 조사(a): `VoiceSettings.tsx` 에 styleWeight 슬라이더 없음 — draft·PUT 에 불러온 값(기본 null)을 그대로 실어 보낼 뿐. 말투 선택지 = `자동 · 차분(Neutral) · 밝은(Happy)`(목소리 바꾸면 자동으로 초기화). 자동·차분에서는 weight 를 넓혀도 효과가 거의 없다. M4 `/voices` 는 모델마다 7스타일(Neutral·Angry·Disgust·Fear·Happy·Sad·Surprise)을 갖고 있고 DB 에는 2종만 등록돼 있음 — 스타일 추가에 M4 모델 작업이 꼭 필요하지는 않음(범위 판단은 Leader).
- 조사(b) 범위 하드코딩 위치: 코드 `speech/tts/parameterResolver.ts:12`(RANGES) · `renderingPlan.ts:106~109`(clamp)·`:102`(VERY_SLOW 하한 0.6 하드코딩) · `preferences/validate.ts:115~118`(RANGES 미참조, 400 VALIDATION — 422 아님) · `VoiceSettings.tsx:155~157` · `speech/tts/types.ts:16` 주석 · 테스트 `preferences/__tests__/validate.test.ts:28~33`(1.3·0.7·2.5 거부 단언). 문서 `domain-model.md:983~987` · `api-contract.md:24`·`:466` · `configuration-resolution.md:184` · `module-dependency.md:373` · `speech-platform/01:55~57`·`13:23~26`·`16:165` · `admin-console/11:43`. M4 스키마 상한(speed 0.5~2.0·pitch 0.5~1.5·intonation 0~2·styleWeight 0~5)은 새 범위를 모두 수용.

### 2026-09-30 서버 구현
- [22:40] 범위 정본 = **`src/modules/preferences/voiceRanges.ts` `VOICE_PARAM_RANGES`**(speed 0.5~1.5 · pitch 0.7~1.4 · intonation 0.6~1.4 · styleWeight 0~4, index 재export). preferences→speech 는 ✗, speech→preferences 는 ✓(module-dependency §3)라 여기 둠 — infra 는 "도메인을 모른다"(§L6)라 후보에서 뺌. `speech/tts/parameterResolver` `RANGES` 는 그 객체 그대로(`RANGES === VOICE_PARAM_RANGES`), `preferences/validate.ts` 는 하드코딩 대신 정본을 읽음(위반 400 VALIDATION, reason `"0.5~1.5"`). `speech/tts/types.ts` 주석은 숫자 대신 정본 가리킴.
- [22:40] 학습 프로필 회귀 방지: `renderingPlan.ts` 에 `DERIVED_SPEED_FLOOR = 0.6` — 배율(프로필·라벨·SLOW·VERY_SLOW)이 내리는 속도의 하한은 옛 0.6, base 가 0.6 보다 느릴 때만 base 까지. SLOW 스냅(최저 0.6)은 base 를 넘지 않게 `min(snap, base)`. 옛 범위 base(0.6~1.2, 0.05 간격) × 프로필 5 × 라벨 6 × SLOW/VERY_SLOW 3 × learningSpeed 3 전 조합이 확대 전 계산과 같음을 테스트로 고정. 기본 1.0 에서 최저는 0.6, base 0.5·0.55 면 모든 조합이 base.
- [22:40] 동작 변화(기본값 영향 없음): 억양·말투 세기의 라벨 배율이 옛 상한에서 잘리던 값이 이제 새 상한까지 적용(예: 저장 억양 1.1 + EMPHASIS ×1.15 → 1.2 였던 것이 1.265). 기존 테스트 기대값 1곳 갱신(`ttsLexiconPlan.test.ts`).
- [22:40] 테스트: 신규 `speech/__tests__/task022.test.ts` 6건(정본 동일성·Resolver 양 끝/바로 밖·Plan 클램프 양 끝·속도 회귀 전 조합·새 하한 조건·캐시 키 12종 값 전부 다른 키 + 옛 값 같은 키), `preferences/__tests__/validate.test.ts` 범위 단언 교체(양 끝 통과·끝 바로 밖 8건 400·NaN/문자열/null 거부) + 옛 범위 회귀 1건. 관련 4파일 29/29, 전체 855건 854 pass·0 fail·1 skip. eslint 전체 0 error(기존 warning 5). tsc: 내 파일 0 error — 프로젝트 전체 1건은 `src/app/api/v1/lessons/route.ts`(conversation lesson WIP 의 `LessonQuizItem.promptKo` 타입, 내 변경 무관).
- [22:40] 문서: domain-model(UserVoiceSetting 주석, styleWeight 주석 추가) · api-contract L24·#14 · configuration-resolution §4 · module-dependency §4-2 흐름·L1 공개 API(`VOICE_PARAM_RANGES`) · speech-platform/01 표+정본 위치 문장(옛 `speech/voices/profiles.ts` → preferences) · 13 표+같은 문장 · 16 §4.3 SLOW/VERY_SLOW 행·clamp 문장 · admin-console/11. `prisma/schema.prisma` 는 domain-model 과 같은 `///` 주석만(DB 변경 없음, `prisma validate` 통과, db push 불필요). `docs/screens.md` 에는 범위 숫자가 없어 수정 없음. 화면(`VoiceSettings.tsx`) 미수정 — 슬라이더가 좁아도 서버는 그대로 받음.
- [22:40] M4 조합 확인(합성 2회, 스크래치패드 `task022/combo.py`·`combo.json`, 분석 설정은 report.py 와 같음): **pitch 0.7 + intonation 1.4 → 유성 프레임 −30.5%·−34.2%(기준 −25% 불통과)**. F0 평균비 0.79·0.76(기대 0.7), σ비 1.28·1.25, 지연 813·807ms(adjust applied), NaN·빈 오디오 0. 참고: pitch 0.7 단독 −19.5%, intonation 1.4 단독 −2.7%, pitch 0.6+inton 1.4 −43.4%. 조합 제한은 구현하지 않음 → **Leader 결정 필요**(선택지: 낮은 pitch 에서 억양 상한 축소(값 미측정)·pitch 하한 0.8 유지·청취 후 수용).
- [22:40] 참고(후속 화면 작업): 컴포넌트는 preferences 를 import 할 수 없다(eslint) — 슬라이더 min/max 를 정본에서 받으려면 라우트(page)가 props 로 넘기거나 설정 API 응답에 싣는 방식이 필요.

## 작업 기록

### 2026-09-30 Leader — 착수
- Q4 답변에 따라 "원인 튜닝"이 아니라 "설정 범위 확대"로 범위를 좁힘. IMP-0005 의 다른 원인(스타일 2종뿐·상황 조정폭 작음)은 이 task 에서 손대지 않고 사용자 재테스트 뒤 판단.

### 2026-09-30 Leader — 범위 확정(M4 실측 반영)
- **확정 범위**: speed **0.5~1.5** · pitch **0.7~1.4** · intonation **0.6~1.4** · styleWeight **0~4**(검증·클램프 값. 화면 노출은 데모에서 정함).
- 근거: 실측에서 speed 0.5~1.5·intonation 0.6~1.4 는 방향·크기가 기대대로였고, pitch 는 0.6 에서 유성 프레임이 −22~26% 줄어 음질 저하 신호가 있어 안전선인 0.7 로 잡았다(0.6 은 억양 1.4 와 함께 쓰면 −43% 로 기준 불통과). "2배가량"에 조금 못 미치는 곳은 pitch 낮은 쪽뿐이며, 사용자가 폰에서 들어 보고 더 넓히길 원하면 0.6 을 조합 제한과 함께 재검토한다.
- 미측정 조합: **pitch 0.7 + intonation 1.4** — developer 가 구현 뒤 M4 로 1회 합성해 유성 프레임 비율을 확인하고(기준: 기준음 대비 −25% 이내), 넘으면 Leader 에게 보고한다(조합 제한 여부는 그때 결정).
- 캐시 키 12요소에는 이미 speed·pitch·intonation·styleWeight 가 들어 있어 값이 달라지면 키가 달라진다(단위 테스트로 확인).
- 이 task 는 **범위 확대만** 한다. 말투(스타일) 종류 추가는 M4 모델에 스타일 7종이 이미 있어 DB·화면 등록 작업이 될 수 있으나(실측 조사 (a)) 사용자 재테스트 뒤 판단한다. styleWeight 슬라이더 신설은 화면 변경이라 데모 v1 에서 사용자가 결정한다.
- 서버 쪽(RANGES·검증·클램프·테스트·문서)은 데모와 무관해 선행하고, `VoiceSettings.tsx` 슬라이더 min/max 는 데모 승인 뒤 변경한다.

### 2026-09-30 Leader — 높낮이 0.7 + 억양 1.4 조합 결정(서버 구현 보고 반영)
- 실측: 유성 프레임 −30.5%·−34.2%(내 기준 −25% 불통과). 단독은 높낮이 0.7 −19.5%·억양 1.4 −2.7% 로 기준 안. 두 슬라이더를 **동시에 양 끝**으로 놓을 때만 넘는다.
- 결정: **서버에서 조합 제한을 두지 않는다**(측정하지 않은 완화값을 임의로 정하지 않음, 사용자의 "약 2배 확대" 의도 유지). 범위 정본이 `voiceRanges.ts` 한 곳이라 하한을 0.8 로 조이는 것은 상수 1줄 변경이다.
- 사용자에게 사실을 그대로 보여 준다: 데모 D2(넓어진 구간 안내)에 이 실측을 넣고, **D4 높낮이 하한(0.7 유지 / 0.8 로 조임)** 을 사용자 결정으로 추가한다. 사용자 청취(배포 후 폰) 결과로 재조정한다.
- 서버 구현 산출 검토는 데모와 무관하므로 Reviewer 로 먼저 진행한다. `VoiceSettings.tsx` 슬라이더 변경은 데모 승인 뒤.

## Reviewer 기록

### 2026-09-30 Reviewer (task-022 서버)
- **REV-038 · PASS** (critical 0 · high 0 · medium 0 · low 3) — 범위는 화면과 무관한 서버·문서 부분만(`VoiceSettings.tsx` 슬라이더는 데모 승인 뒤라 이번 감사 대상 아님). 작업 트리의 다른 task(024·025) 미커밋 변경은 제외했고, 어떤 파일도 되돌리거나 수정하지 않았다(읽기 전용).
- **1 아키텍처·단일 출처**: 범위 정본은 `preferences/voiceRanges.ts` `VOICE_PARAM_RANGES` 하나(`as const satisfies`)이고 `preferences/index.ts` 재수출을 거쳐 `speech/tts/parameterResolver.ts` `RANGES` 가 그 객체를 그대로 받는다(`RANGES === VOICE_PARAM_RANGES`, 테스트 고정). 방향은 speech(L4)→preferences(L1) 로 eslint 경계(`speech` 허용 목록 preferences·engine·infra, `preferences` 허용 목록 infra)와 일치, `index.ts` 외 내부 경로 import 0, 반대 방향 없음. `validate.ts`(L1)는 같은 폴더 `./voiceRanges` 만 읽는다. `src` 안에 옛 범위 리터럴 재하드코딩 0건(남은 곳은 아래 LOW-1 과 미승인 화면 `VoiceSettings.tsx:155~157`).
- **2 검증**: `voiceNum()` 이 정본을 읽어 `num()` 으로 넘기고, 비숫자·NaN·±Infinity·범위 밖은 전부 `ApiError('VALIDATION', …, {field, reason:"min~max"})` = 400(422 아님 — api-contract §0-5·#14 계약과 일치). `styleWeight` 만 nullable. `parseVoiceDraft` 호출자는 `/api/v1/settings/voice`(#14)·`/api/v1/voices/preview`(#18) 둘뿐이라 두 경로가 함께 넓어진다. Resolver 쪽 `num(v, range)` 도 유한·범위 안 값만 받고 페르소나 `speedMax` 상한도 `RANGES.speed` 로 잘린다. 양 끝 통과·끝 바로 밖 8건 400 이 단위 테스트에 있다.
- **3 학습 프로필 회귀 방지**: `DERIVED_SPEED_FLOOR=0.6`(`renderingPlan.ts:66`)이 배율이 내리는 하한을 옛 값으로 유지하고, base<0.6 이면 `min(0.6, base)`=base 가 하한이라 배율이 사용자 값보다 빠르게도 느리게도 만들지 않는다. SLOW 스냅은 `min(snap(speed*0.8), base.speed)`. 직접 대조: base≥0.6 이면 `min(snap,base)`=`snap`(스냅 결과가 늘 base 이하)이고 상한 1.2→1.5 는 모든 속도 배율이 ≤1 이라 비활성 → 옛 결과와 같다. 신규 테스트가 옛 계산(`legacySpeed`)과 base 13종 × 프로필 5 × 라벨 6 × SLOW/VERY_SLOW × learningSpeed 3 전 조합을 대조해 통과. 기본 1.0 결과: SLOW 0.8·VERY_SLOW 0.6·LEARNING_SLOW×EXPLANATION 0.6·PRONUNCIATION 0.72 유지, base 0.5·0.55 는 전 조합이 base.
- **4 동작 변화·캐시 키**: 억양·말투 세기 라벨 배율이 옛 상한에서 잘리던 구간이 새 상한(1.4·4)까지 올라간다(예: 저장 억양 1.1 × EMPHASIS 1.15 = 1.2 → 1.265) — 기본 설정 사용자에게는 영향 없음, `ttsLexiconPlan.test.ts` 기대값 갱신은 이 의도에 맞다. 캐시 키는 이미 `styleWeight·speed·pitch·intonation`(`f3()`) 포함 12요소라 값이 다르면 키가 갈리고, 옛 값은 같은 키를 유지해 기존 캐시가 무효화되지 않음(테스트 12종 고정). M4 tts-service 스키마(speed 0.5~2.0·pitch 0.5~1.5·intonation 0~2·styleWeight 0~5)가 새 범위를 전부 수용해 M4 422 는 나올 수 없다.
- **5 엔진명·Secret·DB**: `src`·`docs/design` 변경분에 엔진명·model_id·speaker_id 신규 노출 0, `styleBertHttp` 어댑터의 SBV2 파라미터 변환은 무변경. Secret·토큰·로그 변경 0. `prisma/schema.prisma` 는 `///` 주석 3~4줄만(컬럼·인덱스 무변경 → db push 불필요, Developer 가 `prisma validate` 통과 기록). 라우트·화면에서 spawn/fetch 신규 0.
- **6a (높낮이 0.7 + 억양 1.4 조합, 서버 코드 관점)**: **서버 안전상 결함 아님**. 조합 제한이 없어도 ① 어댑터가 pyworld 실패 시 `without_pitch_adjust` 폴백과 `X-Kaiwa-Adjust` 를 돌려주고 ② 문장당 8s fail-fast·`min(호출 예산, connection.timeoutMs)` 가 적용되며 ③ Developer 실측이 NaN 0·빈 오디오 0·지연 약 0.8s(adjust applied). 유성 프레임 −30.5%·−34.2%(내부 기준 −25% 초과)는 음질 판단이라 Leader 결정(서버 무제한, 하한은 상수 1줄)과 데모 D4 로 사용자에게 넘겨져 있다 — 이번 감사가 다시 뒤집을 사안 아님. 다만 LOW-2 참고.
- **6b (후속 메모, 결함 아님)**: 컴포넌트는 preferences 를 import 할 수 없다(eslint 경계). 화면 작업 때 슬라이더 min/max 를 정본에서 받으려면 라우트(page)가 props 로 넘기거나 설정 API 응답에 실어야 하고, `VoiceSettings.tsx:155~157` 의 옛 0.6~1.2·0.8~1.2·0.8~1.2 를 다시 하드코딩하면 정본이 둘이 된다.
- **7 실행 검증**: `bash scripts/sync-local.sh` 후 미러에서 지정 3파일 21/21 pass, 해석·계획·검증·캐시 경로 4파일 37/37 pass·0 fail · eslint 0 error(기존 warning 5, `VoiceSettings.tsx:73` set-state-in-effect 포함 — 이번 변경 무관) · `tsc --noEmit` 프로젝트 1건 `src/app/api/v1/lessons/route.ts(46,45)` TS2322(`LessonQuizItem.promptKo` string|null) — **task-025(A4 v8 WIP) 소관, 이번 task 와 무관**, 이번 변경 파일 0 error.

**이슈 (LOW)**
| # | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|
| LOW-1 | `speech/speech.config.yml:84` | `style_weight_default: 1.0  # [RT] 0~2 범위` 주석이 옛 범위(0~4 로 확대됨) | Developer 변경 목록·grep 결과에 없음, `src`·docs 는 모두 갱신됨 | 주석을 "0~4(정본 `VOICE_PARAM_RANGES`)" 로. 값 자체는 기본값이라 동작 무관 |
| LOW-2 | `speech/tts/renderingPlan.ts:93~106` | ENCOURAGING ×1.1·EMPHASIS ×1.15 라벨이 저장 억양이 슬라이더 끝(1.4)이 아니어도 상한 1.4 에 도달 → 높낮이 0.7 과 함께 쓰면 실측한 "유성 −30%대" 조합이 슬라이더 양 끝을 안 밟고도 나올 수 있음(예: 저장 억양 1.3 × 1.1 = 1.43 → 1.4) | 코드 계산·`ttsLexiconPlan.test.ts` 1.3→1.4 클램프 케이스. 데모 D2 안내는 슬라이더 양 끝 조합만 다룸 | 서버 코드 수정은 불필요. 사용자 청취 뒤 높낮이 하한을 0.8 로 조이면(`voiceRanges.ts` 1줄) 함께 해소. 데모 D2 문구에 "말투에 따라 억양이 더 올라갈 수 있음" 한 줄 추가 검토 |
| LOW-3 | M4 실측 공백 | speed 0.5(오디오 길이 약 2배 → pyworld 처리도 약 2배) + 높낮이/억양 ≠1.0 + 최대 길이 문장의 합성 지연이 8s 문장 fail-fast 에 얼마나 근접하는지 미측정(실측 S2 843~895ms 는 4.3s 오디오·speed 1.0 기준) | Developer 실측 표에 해당 조합 없음 | QA 가 실합성 1~2회로 지연 확인(4s→8s 급 오디오 + 0.5×·pitch 0.7) |

- **의도 검증**: Leader 사양(범위 speed 0.5~1.5·pitch 0.7~1.4·intonation 0.6~1.4·styleWeight 0~4, 검증·Resolver·Plan 단일 출처, 학습 프로필 회귀 방지, 캐시 키 유지, 화면은 데모 뒤)을 충족. 사양에 없는 추가 변경 없음.
- **데모 게이트**: `check --task` = `DEMO_GATE_BLOCKED`(`review_requested` v1·v2, 승인 미기록) — 이번 서버 범위는 화면 파일 변경 0건(`git status src/components` 비어 있음, `VoiceSettings.tsx` 무변경)이라 위반 아님. **`VoiceSettings.tsx` 변경은 승인 기록 뒤에만** 허용되고, 승인 전에 화면 변경이 들어오면 FAIL 이다. `evidence.jsonl` 에 task-022 줄 0건 = approve/waive 대행 흔적 없음.
- **QA `high_risk_areas`**: ① #14·#18 확대 범위 검증(양 끝 200, 끝 바로 밖 400 `VALIDATION`+`reason`) ② 기본 1.0 사용자의 학습 프로필 속도(SLOW 0.8·VERY_SLOW 0.6·LEARNING_SLOW×EXPLANATION 0.6·PRONUNCIATION 0.72) 불변 ③ 저장 속도 0.5 + LEARNING_SLOW 재생이 0.5 유지(배율이 base 보다 빠르게 만들지 않음) ④ 높낮이 0.7 + 억양 1.4 실합성(지연·품질, 라벨로 억양 상한 도달 포함) ⑤ speed 0.5 + 조정 ≠1.0 + 긴 문장 지연(8s fail-fast 근접, LOW-3) ⑥ 네 수치별 캐시 키 분리·옛 값 저장 사용자의 기존 캐시 적중 ⑦ 옛 저장값(0.6~1.2·0.8~1.2·0~2) 그대로 유효 ⑧ 운영 `/api/v1/settings/voice`·`/voices/preview` 범위 확대 동작.
- `native_change: false`(플러그인·`android/`·`capacitor.config.ts`·Manifest·`versionCode` 무관). 후속은 화면 승인 뒤 `VoiceSettings.tsx` 변경분 별도 감사(6b 메모 포함).

### 2026-09-30 QA (task-022 서버)

**종합 판정: PASS** — 검증 경계·회귀·캐시·엔진명 누출 모두 확인됨, 외부 서비스(M4) 미측정은 저수준 항목.

**체크리스트 결과**:
| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 단위·통합 테스트 | ✅ PASS | `npm test` 855건 중 854 pass·0 fail·1 skip |
| 2 | 검증 경계 | ✅ PASS | validate.test.ts 양 끝값(0.5/1.5/0.7/1.4/0.6/1.4/0/4) 200 통과, 끝 바로 밖(0.49/1.51·0.69/1.41·0.59/1.41·-0.01/4.01) 8건 모두 400 VALIDATION+reason |
| 3 | 회귀 | ✅ PASS | task022.test.ts 학습 프로필 속도 1000+ 조합(base 0.6~1.2×프로필×라벨×SLOW/VERY_SLOW×learningSpeed 3) 모두 확대 전과 동일, 기본 1.0 에서 SLOW 0.8·VERY_SLOW 0.6·LEARNING_SLOW×EXPLANATION 0.6·PRONUNCIATION 0.72 고정 |
| 4 | 캐시 키 | ✅ PASS | 12종 변형값마다 다른 키(HashSet.size==variants.length), 옛 범위 저장값(0.8·1.1·0.9)은 옛 유효값과 같은 키 |
| 5 | 엔진명 누출 | ✅ PASS | git diff 대상 7파일에 reazon·whisper·style-bert·claude·model_id·speaker_id 신규 노출 0건 |
| 6a | M4 실합성 (pitch 0.7+inton 1.4) | ✅ 기록 참고 | Developer 실측: 유성 프레임 −30.5%·−34.2%(기준 −25% 불통과), 단독은 각 −19.5%·−2.7% 안전 |
| 6b | M4 실합성 (LOW-3 지연) | ⚠️ NOT_VERIFIED | speed 0.5 + pitch 0.7 + intonation 1.4 + 긴 문장 합성 지연 — 외부 서비스(내부 인증 필요), 실기기 확인 필요 |
| 7 | 운영 엔드포인트 | ✅ PASS | `https://kaiwa.미라클펭귄.com/api/health` 200 OK (PRODUCTION, status degraded·stt_analysis_worker OFF 제외) |
| 8 | git status | ✅ PASS | QA 변경 0건(다른 task 미커밋 제외) |

**지연 측정 (Developer 기록·m4 직접 호출 불가 사유: 내부 인증)**:
- pitch 0.7 단독: S1 (1.3s) +167~208ms, S2 (4.3s) +437~484ms, pyworld 적용
- intonation 1.4 단독: 위와 동일
- 조합(pitch 0.7+inton 1.4): 미합성(유성 기준 불통과, LOW-2 주의 사항 있음)

**저수준 발견 (Reviewer 기록 참고)**:
- LOW-1: `speech/speech.config.yml:84` 주석(범위 0~4 로 갱신 필요, 값 무관)
- LOW-2: 라벨 배율로 인해 슬라이더 끝을 안 밟아도 새 상한 도달 가능 — 사용자 청취 후 높낮이 하한 0.8 조정 시 함께 해소 가능
- LOW-3: speed 0.5 + 조정 ≠1.0 + 긴 문장 지연 — 실기기 실측 필요(8초 fail-fast 근접도)

**결론**: 서버 구현은 **설계 사양(범위·검증·회귀·캐시)을 100% 충족**하고, 음질 판단(pitch 0.7+inton 1.4 조합)과 LOW-3 지연은 사용자 청취·실기기 확인 후 재조정 가능.

### 2026-09-30 Leader — 서버 범위 QA 수령·LOW 처리
- Reviewer REV-038 PASS → QA(서버) PASS(단위·통합 854/855·검증 경계 200/400·학습 프로필 회귀·캐시 키·엔진명 누출 0). QA 는 M4 합성이 내부 시크릿 필요라며 6b(LOW-3) 를 미실행으로 남겼고, Leader 가 Developer 의 측정 스크립트(`measure.py`)를 재사용해 직접 채웠다.
- **LOW-3 실측(M4 `/synthesize` 직접 6회, 실패 0, 65자 일본어 1문장 — 기준 오디오 9.3초)**: 속도 0.5 만 → 오디오 16.9초·지연 0.97초(pyworld 미적용) / **속도 0.5 + 높낮이 0.7 + 억양 1.4 → 오디오 17.0초·지연 2.71·2.76·2.81초(3회, `X-Kaiwa-Adjust` applied)** / 속도 1.5 + 높낮이 1.4 + 억양 0.6 → 오디오 6.8초·지연 1.38초. NaN·빈 오디오 0. 문장 분할 기준(100자) 안에서 최악 조합도 8초 fail-fast 의 약 1/3 — 결함 아님. 참고: 속도 0.5 는 문장 길이 대비 오디오가 약 1.8배라 긴 문장은 재생이 길다(기대 동작).
- LOW-1: `speech/speech.config.yml:84` 주석 "0~4(정본 …)" 로 Leader 가 수정. LOW-2: 데모 D4(높낮이 하한)로 사용자 결정 대기. 6b(슬라이더 min/max 를 컴포넌트가 정본에서 받는 방법)는 화면 착수 시 route props 로 전달 — 화면 작업 메모.
- 남은 것: 데모 v2 승인 → `VoiceSettings.tsx` 슬라이더 변경(별도 Reviewer·QA). D4 가 0.8 이면 `voiceRanges.ts` pitch.min 1줄 + 테스트 기대값 갱신. 서버 커밋은 화면과 무관하게 나갈 수 있다(UI 가 옛 범위를 유지하므로 노출 없음).

### 2026-09-30 Deployer — 웹훅 배포 완료

**배포 상태**: ✅ 성공
- **릴리스**: `20260930-231913-da263a65` (커밋 `da263a6`, task-024 번들됨)
- **프로세스**: thekaiwa · thekaiwa-speech-gateway 모두 재등록 완료 (pm2 reload)
- **헬스체크**: `/api/health` = 200 · `status: degraded`(필수 항목 OK) · `env: PRODUCTION` ✅
- **gateway**: 포트 8100 응답 정상, 배포 직후 음성 서비스 체크 일부 지연 중(일시적)
- **이전 릴리스**: `20260930-222458-54199c9f` (task-020, 삭제 예정)

**검증 결과**:
| 항목 | 상태 | 비고 |
|---|---|---|
| 설정 API 범위 검증 | 대기 | 데모 D4 승인 후 사용자 폰 테스트 대상 |
| TALK sceneCap 로그 | 대기 | toolLog 확인은 사용자 회화 1~2턴 후 |
| 예열 TTFA 지연 | 대기 | 첫 턴 측정 후 대비 |

**남은 작업**:
1. 데모 v2(D4 높낮이 하한) 사용자 승인 → `VoiceSettings.tsx` 변경
2. 운영 배포 후 사용자 폰에서 음성 설정 범위 체감(미리듣기 4~5회)
3. TALK 응답 길이 체감(회화 2~3턴, 상황별)

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-022-improve-voice-range-v1.html | https://claude.ai/artifact/GgAKW58uorkF5eK1kpGG94 | 사용자 검토 요청 | 09-30 22:40 |
| v2 | 작성중 | docs/demo/task-022-improve-voice-range-v1.html | - | - | 09-30 22:45 |
| v2 | 검토요청 | docs/demo/task-022-improve-voice-range-v2.html | https://claude.ai/artifact/3k9kDwwLFcPD1n7AjUa4Z5 | 사용자 검토 요청 | 09-30 22:45 |
