---
task_id: task-030
title: "후속 — 일본어 표시 Low 6건 (장음 뒤 へ 한글·토글 터치·말풍선 높이·셸 알림)"
status: done
base_ref: a130443
risk_level: R1
origin: improvement
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-026-improve-hangul-reading]
tags:
  - type/task
  - domain/improvement
  - domain/ui
  - domain/speech
aliases:
  - 일본어 표시 후속
  - task-030
created: 2026-10-04
updated: 2026-10-04
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-030-japanese-display-followup-v1.html"
  artifact_url: "https://claude.ai/artifact/LYf7kFgV4ExRAb1fSuiPwu"
  content_sha256: "2383be5bbaa99f80b23f705b99126651c85ed2eeec47d060fdae90c93cf5cabe"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-04T21:52:51+09:00"
  approval_quote: "task-030 데모 v1 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[task-026-improve-hangul-reading]] 운영 반영(`726daf7`) 뒤 남은 비차단 Low 6건을 한 번에 정리한다. 화면 구조·흐름은 바꾸지 않는다(승인 데모 v4 그대로) — 수치·규칙 보정만.

관련 과거 이력 요약: task-026 서버 묶음(`f67bf70`)·화면 A·B(`726daf7`), REV-094~097, QA(화면 A·B) PASS. 가이드 정본 `docs/screens.md` §15. 한글 줄은 반드시 `hangulLine()`(O-1 を 보정이 이 경로에만 있음).
관련 승인 교훈 없음.

## 범위
1. **QA-L1 (우선)** `src/modules/speech/reading/client.ts` `hangulLine` — 장음(ー/長音 pron) 뒤 조사 へ(pron エ)가 앞 장음과 합쳐짐. `先生へ` → 기대 `센세-에`(현재 `센세--`), `家へ` → 기대 `이에에`(현재 `이에-`). 조사 경계(segment.boundary/surface へ)에서는 장음 합치기를 하지 않는다. 같은 원인으로 を(오)·は(와) 등 조사 앞 모음 합침도 함께 점검. 회귀 픽스처 추가.
2. **QA-L2** `src/components/common/japanese/JapaneseText.tsx` 표시 토글 바 — 유효 터치 높이 41px → 44px↑(overflow-x-auto·하단선이 확장 영역을 자르지 않게).
3. **QA-L3** `src/components/chat/MessageBubble.tsx` — 번역 켬일 때 분석 도착 시 내 말풍선 +5.5px → ≤4px(자리 예약 높이 보정).
4. **REV-097 L-1** `useClearSuccessOnSaveFail` 의 `onToast('',0)` 를 잠그는 테스트 + 가이드 §15-3 B 한 줄.
5. **REV-097 L-2** 셸 저장 실패 알림이 회화 방에서 상태 줄을 가림 — 회화 방에서는 방 토스트 위치(136)와 같은 높이로, 녹음 중이면 회화 방 notify 지연 규칙과 같게.
6. **REV-097 L-3** 겹친 flush 가 429 를 받으면 재시도 횟수를 중복 소모 — 같은 조각의 실패 기록은 한 번의 요청에 대해 한 번만 증가.

범위 밖(별도 task): 평가·카드 뒷면·복습 카드 표시 적용(화면 변경 → 데모 게이트), 구 `reading`/`replyReading` 필드 제거, 관리자 발음 사전 → 분석기 반영, REV-093 LOW.

## Judge 판정

- [2026-10-04 00:00] intake engine=jev → task_type=local_fix · risk=R2 · developer_model=sonnet · track=standard · demo=delta/designer(JV-ui_change,DM-kw-risky-cta) · next=ask_user | overrides=R2-kw-auth,MD-r2-path-only | fallback=- | tokens=1344

## 요구사항 명확화 필요

다음 항목을 사용자에게 확인해야 합니다:

1. **셸 알림 위치/지연 규칙** — 회화 방 토스트 위치(y=136px) 및 녹음 중 지연 시간값이 구체적인지 확인
2. **내 말풍선 높이 보정** — 번역 켬일 때만 적용되는지, 다른 메시지 타입(제안/교정)에 미치는 범위 확인

demo_gate는 judge 판정 후 처리해야 합니다(delta 수준).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-04 21:17 |
| v1 | 검토요청 | docs/demo/task-030-japanese-display-followup-v1.html | https://claude.ai/artifact/LYf7kFgV4ExRAb1fSuiPwu | 사용자 검토 요청 | 10-04 21:28 |
| v1 | 승인 | docs/demo/task-030-japanese-display-followup-v1.html | https://claude.ai/artifact/LYf7kFgV4ExRAb1fSuiPwu | "task-030 데모 v1 승인" | 10-04 21:52 |

## Leader 기록 (접수 판정 수용·명확화 답, 2026-10-04 21:18)
- judge 판정 수용: standard · developer sonnet · demo delta. 명확화 2건은 코드·가이드로 Leader 가 답한다(사용자 질문 불필요):
  1. 셸 알림 — 회화 방(`/study/ai` 회화 모드)에서는 방 자체 토스트와 같은 bottom 위치(TalkRoom 토스트 기준값을 상수로 공유), 녹음 중에는 TalkRoom `notify` 의 지연 규칙을 그대로 따른다(새 수치 도입 금지). 다른 화면은 지금 위치(84) 유지.
  2. 말풍선 높이 보정 — **내 말풍선 + 번역 켬**일 때만(분석 도착 전 한글/번역 자리 예약 높이 보정). 선생님 말풍선·교정/제안 카드는 범위 밖(QA 측정상 이미 ≤4px).
- 진행 분할: **1단계(지금)** QA-L1 `src/modules/speech/reading/client.ts`(화면 파일 아님) — developer. **2단계(데모 v1 승인 뒤)** L2·L3·REV-097 L-1·L-2·L-3(`src/components/**`) — designer delta 데모 v1 → 사용자 승인 → developer.

## Developer 기록 (1단계 QA-L1, 2026-10-04 21:27 실측)
- [21:27] **완료 — QA-L1.** commit·push 안 함. 화면 파일(`src/components/**`)·서버 API·DB 무접촉(데모 게이트 대상 아님 — `speech/reading/` 순수 모듈).
- **원인**: gateway 는 조사 へ 를 `{surface:'へ', pron:'エ'}` 별도 조각으로 준다(`先生`=センセー + `へ`=エ). `kanaToHangul` 의 "같은 모음 반복 → '-'" 규칙이 `センセーエ`·`イエエ` 에서 조사 エ 를 앞 모음(e)과 합쳐 `센세--`·`이에-` 가 됨. 조사 を 는 O-1 에서 ヲ 표식으로 이미 보정했으나 へ 는 빠져 있었다.
- **수정**: `src/modules/speech/reading/client.ts` — `isParticleWo` → `particleMark`(を→ヲ · へ→ヱ, 표기가 を·へ 하나뿐인 조각의 pron オ·エ 일 때만), `buildPronLine(markParticles)`, 모라 플래그 `wo`→`part`(ヲ·ヱ 둘 다), 주석 갱신. 공개 `pronLine` 은 エ·オ 그대로(표식은 한글 변환 안에서만). 점검 결과 **모음 단독 발음 조사는 を·へ 뿐** — は(ワ=`wa`)·に·で·が·と·の 는 병합 조건(`^[aiueo]$` 의 X 행)에 걸리지 않아 원래 합치지 않음(실 gateway 출력 + 픽스처로 확인). 단어 내부 장음(`센세-`·`토-꾜-`·`오-끼-`)·を O-1 보정·'까' 계열은 불변.
- **실측**(dev gateway = dev venv `~/.node-local/thekaiwa-speech-dev` uvicorn 127.0.0.1:8197, 스크래치 `run_gw_dev.py`, 측정 후 종료·8197 listener 0, 운영 8100·pm2 무접촉): 45문장 중 へ 8·を 7·は 5·に 3·で 3 등 `/text/annotate` 응답 확인 → 픽스처화.
- **회귀 픽스처**: `src/modules/speech/__tests__/fixtures/particleBoundary.json`(신규, gateway 실 출력 22건 + 손으로 정한 기대 한글 — へ 6[先生·家·絵·本·ここ·ビー+문장 끝 先生へ·ピアノへ·家へ]·を 3·は 4·に 3·で 3 = 조사 5종 × 장음 뒤/같은 모음 뒤/자음 뒤) · `reading.test.ts` 신규 2건(픽스처 22건 일괄 + QA 재현 `先生へ`→`센세-에`·`家へ`→`이에에` 고정 / へ 표식은 조사 조각에만, 非조사 エ·ええ·いい·ヘ(동사 어간)·직접 변환기 `ヱ` 규칙). 기존 `reading.test.ts` 15건 전부 유지.
- **변이 3건(미러에서만 되돌림)**: M1 へ 표식 제거 → 새 2건 FAIL(15 pass/2 fail) · M2 `!m.part` 경계 조건 제거 → 새 2건 + 기존 O-1 FAIL(14/3) · M3 を 표식 제거 → O-1·새 픽스처 FAIL(15/2). 원복 후 `cmp` 일치.
- **실행 증빙**(미러 `~/.node-local/thekaiwa-dev-030`, `node_modules`→`~/.node-local/thekaiwa` 심볼릭, NFS `src/` rsync): `tsc --noEmit --incremental false` **exit 0** · `eslint .` **0 errors 5 warnings**(기존 `react-hooks/set-state-in-effect` 5건, 변경 파일 아님) · `reading.test.ts` **17/17**(기존 15 + 2) · 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` **# tests 1382 · pass 1379 · fail 0 · skipped 3**(skip 3 = 기존).
- **미커밋 파일**: `src/modules/speech/reading/client.ts` · `src/modules/speech/__tests__/reading.test.ts` · `src/modules/speech/__tests__/fixtures/particleBoundary.json`(신규).
- **주의점**: 한글 줄은 계속 `hangulLine()` 으로만(표식은 이 경로에만). 직접 `kanaToHangul('センセーエ')` 는 표식 없는 데모 규칙 그대로 `센세--`. 알려진 한계 없음(조사 へ 가 별도 조각이 아닌 형태소 분석 결과가 나오면 표식이 안 붙음 — 현재 gateway text.py 는 助詞 へ 를 항상 별도 조각으로 낸다).
- 다음 첫 행동(2단계): 데모 v1 승인 뒤 L2·L3·REV-097 L-1~L-3(`src/components/**`) — 이 단계에서는 착수 금지.

```json
{ "taskId": "task-030", "status": "DONE", "deliverables": ["src/modules/speech/reading/client.ts", "src/modules/speech/__tests__/reading.test.ts", "src/modules/speech/__tests__/fixtures/particleBoundary.json", "agent-vault/10-Flow/tasks/task-030-japanese-display-followup.md (Developer 기록 1단계 QA-L1)"], "blockers": [], "risk_level": "LOW", "self_check": { "unit_test": true, "lint": true, "type_check": true, "engine_name_leak": false, "native_change": false } }
```

## Reviewer 기록 (REV-098 · 1단계 QA-L1 장음 뒤 조사 へ 한글, 2026-10-04)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 2). 코드 수정 없음(Read 전용). 미러 `~/.node-local/thekaiwa-rev-026b` 에 NFS `src/` rsync 후 검증.

- **실행**: `tsc --noEmit` exit 0 · `eslint src/modules/speech` 0 · `reading.test.ts` 17/17 · 전체 `node --test` 1382 pass / 0 fail.
- **(1) 표식 누수 없음**: `ヱ`·`ヲ` 는 `buildPronLine(…, true)` → `kanaToHangul` 안에서만 쓰인다. 공개 `pronLine` 은 `buildPronLine(…, false)`(オ·エ 그대로). 독립 gateway 출력(dev venv `pyopenjtalk` + `annotate_one` 으로 28문장 + 픽스처 22건)에서 `pronLine`·`hangulLine` 어디에도 ヲ·ヱ 0건, `pronLine` 결과 구 코드와 동일. annotate 응답·화면 히라가나 경로는 이 파일 밖(`kanaToHangul|pronLine` 화면 호출 금지 테스트 `japaneseDisplay.test.ts:807`·`display.test.ts:92` 통과).
- **(2) 조사 판정은 조사 조각에만**: `particleMark` = 표기가 を(ヲ)·へ(ヘ) **하나뿐**이면서 pron 이 オ·エ 일 때만. gateway `text.py:312` 가 `pos==助詞 && read∈{ハ,ヘ,ヲ}` 일 때만 pron 을 ワ·エ·オ 로 바꾸므로 표기 へ+pron エ ⇒ 조사. 구 코드(HEAD) vs 신 코드를 50건(독립 28 + 픽스처 22)에 대조 → **차이 8건 전부 조사 へ**(`先生へ` 센세--→센세-에, `家へ` 이에-→이에에, `絵へ` 에-→에에 …), 그 밖 변화 0. 확인한 오판 없음 입력: `ええ`(에-)·`へえ`/`へー`(헤-)·`部屋へ`/`へやへ`(헤야에)·`これはへそ`(헤소)·`上手へた`·`おおきいえき`(오-끼 이에끼)·`映画を`(에-가오)·`ビールを`·`会社へは`·`駅へと`·문장 끝 `東京へ。`·동사 활용 `行く/帰る` — 단어 내부 エ·ヘ·장음 합침 규칙 불변.
- **(3) 픽스처 기대값**: 22건을 손으로 검토 — 장음 뒤 へ(센세-에·비-에·토-꾜-에), 같은 모음 뒤(이에에·에에), 자음/ん 뒤(홍에 — ん 모음 앞 ㅇ 규칙), を(코-히-오·피아노오·홍오), は(센세-와·하하와·홍와 — ワ 는 wa 라 합침 조건 밖), に·で(센세-니·이에데·혼데 — ん+N·D→ㄴ) 모두 현행 변환 규칙(D1-A '까' 계열·D2-B 구절 띄어쓰기·ん 받침)과 일관되고 일본어 발음 관행에 맞다(へ→에, を→오, は→와). 픽스처 segments 는 실 gateway 출력과 동일 형태(surface 이어 붙이면 원문, boundary·pron 형식 일치). 독립 gateway 출력과도 모순 없음.
- **(4) 「한글 줄은 hangulLine 경로만」 유지**: `kanaToHangul` 호출처 = `client.ts:108`(hangulLine) + 테스트뿐, `src/components/**`·API·스크립트 0건. 가드 테스트 2곳 통과.
- **(5) 6층·엔진명**: `speech/reading/client.ts` 는 외부 import 없는 순수 모듈, 엔진명(`reazon|whisper|style-bert|claude`) 신규 0건. 변경은 `src/modules/speech/**` 3파일뿐 — DB·API·인증·Secret·네이티브·화면 파일 무접촉(`versionCode` 해당 없음, `native_change:false`). light 범위 아님·standard 1단계로 문제 없음(파일 3개).
- **독립 변이 5건**(미러만, 원복 후 `cmp` 일치): MA へ 조건 pron エ→ヘ → 새 테스트 2건 FAIL(15/2) ✔ · MC 토크나이저 ヱ 의 part 플래그 제거 → FAIL 2건 ✔ · MD 공개 `pronLine` 도 표식 사용 → 기존·신규 3건 FAIL ✔(공개 pronLine 불변식 잠금) · ME pron `endsWith('エ')` 로 완화 → 17/17 유지(조사 pron 은 항상 단독 エ 라 동치, 허용) · **MB へ 표식에서 surface 조건 제거(pron==='エ' 만) → 17/17 통과 = 생존**(아래 L-1).

### 이슈 (reviewer.md 스키마)
```json
{ "reviewId": "REV-098", "status": "PASS", "issues": [
  { "issue": "표기가 へ 가 아닌 단일 pron 'エ' 조각(예: surface 絵·え)이 e단 모음 뒤에 올 때 구 규칙대로 합쳐지는지 잠그는 테스트가 없다 — 변이 MB(surface 조건 제거)가 생존",
    "severity": "LOW", "component": "src/modules/speech/reading/client.ts:80-81 · src/modules/speech/__tests__/reading.test.ts:181-204",
    "risk": "미래에 particleMark 가 pron 만 보게 바뀌어도 테스트가 못 잡음. 실제 오판 입력은 현재 gateway 에서 확인 못 함(조사 아닌 エ 단독 조각은 e단 뒤에 거의 안 옴).",
    "evidence": "변이 MB: `if (s.pron === 'エ') return 'ヱ'` 로 바꿔도 reading.test.ts 17/17 pass",
    "recommendation": "[{surface:'ケ',pron:'ケ'},{surface:'絵',pron:'エ',boundary:null}] 같은 조각 → 한글 '케-' 유지 단언 1건 추가(조사 아닌 エ 는 합침)." },
  { "issue": "(기존·범위 밖) 단어 내부 같은 모음 합침 규칙이 長音 뒤 같은 모음을 접는다 — `経営`(ケーエー) → '케--' (관행 '케-에-'). 이번 변경과 무관(구 코드 동일 출력 확인)",
    "severity": "LOW", "component": "src/modules/speech/reading/client.ts:385 (kanaToHangul 같은 모음 → '-')",
    "risk": "한자어 중 ー+エ/オ 가 이어지는 단어(経営·通り 등)의 한글 줄이 어색 — 사용자 결정 '같은 모음 반복 → -' 규칙의 부작용",
    "evidence": "독립 gateway 출력 `経営へ進む。` pron ケーエーエ|ススム。 → 한글 `케--에 스스무.`; HEAD 코드와 동일(8 diff 에 불포함)",
    "recommendation": "별도 개선(IMP) 후보로만 기록. task-030 범위·승인 수치 변경 사항 아님." } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 },
  "high_risk_areas": [
    "hangulLine: 조사 を·へ 외 모음 단독 pron 조각(조사 아닌 エ·オ) 합침 불변 — 단어 내부 ええ·いい·おおきい 계열",
    "공개 pronLine·annotate 응답에 ヲ·ヱ 비누출(발음 줄 오・エ 그대로)",
    "화면 한글 줄 hangulLine 단일 경로(kanaToHangul·pronLine 직접 호출 0)",
    "실 gateway 출력으로 へ·を·は·に·で × 장음 뒤·같은 모음 뒤·자음 뒤 + 문장 끝(운영 화면 값 확인 필요)",
    "먼저 올 화면 2단계(L2·L3·REV-097 L-1~L-3)는 데모 v1 승인 전 착수 금지(데모 파일 docs/demo/task-030-…-v1.html 은 작성 중)" ],
  "native_change": false }
```
- 데모 게이트: 1단계는 화면 파일 무접촉(`speech/reading/` 순수 모듈) — material 차이 대조 대상 아님. `check.mjs` 는 2단계 화면 변경 때 재실행(이번 단계 해당 없음).
- Codex 검토: 이 단계 judge 개입 판정·Codex 결과 없음(task 이력서 `## Codex 검토` 부재) — 판정 기준 영향 없음.
- 순환: PASS → QA(1단계는 서버 순수 로직 — 픽스처·스모크 재확인 정도) 인계 가능. 채택해야 할 수정 없음(L-1 은 권고, 비차단).

## Designer 기록
- [21:28] **delta 데모 v1 작성·게시·검토 요청 등록.** 파일 `docs/demo/task-030-japanese-display-followup-v1.html`(lint `DEMO_LINT_PASSED`, `check.mjs status → review_requested v1`, sha256 `2383be5b…`) · Artifact https://claude.ai/artifact/LYf7kFgV4ExRAb1fSuiPwu · 상태 id `#toggle`·`#bubble`·`#toast`·`#decision`. 390 기준, 360/412 토글, 현재 vs 제안·측정 표시·테마 토글. "현재"는 HEAD `a130443` 소스의 클래스 값을 그대로 옮김 — 데모 안 실측이 QA 운영 실측과 일치(내 말풍선 번역 켬 113.2→118.7 **+5.5**, 끔 +1.5).
  - **1 토글(QA-L2)**: 원인 = `DisplayBar` `h-11 border-b overflow-x-auto` → 안쪽 43px 에 토글 `before:-inset-y-1.5` 가 잘림(데모 계산 43, QA 실측 41). 제안 = 바 아래 선을 `border-b` → 안쪽 1px 선(`shadow-[inset_0_-1px_0_var(--color-line)]`, 같은 색·자리)으로 바꿔 안쪽 44 + 토글 터치 `before:-inset-y-[7px]`(46, 바 안에서는 44로 잘림). **겉모양 변화 0**(알약 32 그대로, 0.5px 아래). 단어장·수업 도구 줄은 46.
  - **2 말풍선(QA-L3)**: 원인 = `HangulPlaceholder` `mb-1` 이 번역 칸 `mt-2` 와 여백 겹침 → 기다리는 자리 18px vs 한글 줄 21.5px(+3.5) + 루비 본문 +2 = +5.5. 제안 = 내 말풍선 막대 자리를 한글 줄과 같은 높이(위 2 + 19.5, 막대 12 가운데, 아래 여백 없음) → 데모 실측 **+2**(번역 끔도 +2). 막대 모양 그대로, 적용은 내 말풍선만(Leader 범위).
  - **3 셸 알림(REV-097 L-2)**: 현재 bottom 84 → 음성 입력 바(116)와 33px 겹침·상태 줄 24px 전부 가림(QA 실측 765~808 과 일치), 녹음 중에도 즉시. 제안 = 회화방 음성 모드 136(`VOICE_TOAST_BOTTOM`)·겹침 0·간격 19, 녹음 중 미룸 → 손 뗄 때 1회, 글자 입력 모드 84(방 `TEXT_TOAST_BOTTOM` 과 같음), 다른 화면 84 유지. 상황 4종(말하지 않을 때·녹음 중·손을 뗀 직후·글자 입력) 나란히.
  - **결정 사항 없음**(데모 `#decision` 에 명시) — Leader 명확화 답(위치·지연 = 회화방 기존 값, 새 수치 없음)을 그대로 반영. 사용자 문구 '히라가나'만, '후리가나'·엔진명 0건(grep).
  - 다음: 사용자 승인(Leader 기록) 뒤 구현 가이드(`docs/screens.md` §15 추가 절, 승인 데모 v1 명시) 인계. src 미수정.
- [21:55] **구현 가이드 완료(승인 데모 v1 기준)** — `docs/screens.md` §15-10 신설(A 표시 바 안쪽 1px 선 `shadow-[inset_0_-1px_0_var(--color-line)]`·토글 `before:-inset-y-[7px]` → 바 44/도구 줄 46 · B 내 말풍선만 대기 자리 = 한글 줄 높이(위 2 + 19.5, 막대 가운데, 하단 margin 0) · C 회화방이 저장 실패 알림을 맡음(음성 136·글자 84·녹음 중 미룸 → 손 뗀 뒤 1회, 맡은 동안 셸 0·성공 지우기 생략, 다른 화면 84) · D L-3·REV-098 L-1 · E 파일 6+테스트 2) + §15-2 C·G·§15-3 B(L-1 한 줄)·§15-6 1·3·20 갱신·21·22 추가. src·데모 무수정.

## Leader 기록 (REV-098 PASS 수용, 2026-10-04 21:29)
- 1단계 REV-098 PASS 수용. L-1(단일 エ 비조사 조각 `[ケ][絵 エ]` → 케- 유지 단언)은 2단계 developer 터치에 포함. L-2(経営 → 케-- , 관행 케-에-)는 기존 동작·범위 밖 — 후속 후보로 기록.
- 1단계는 단독 배포하지 않고 2단계와 함께 QA → 배포(QA 1회).

## Developer 기록 (2단계, 2026-10-04 22:08 실측)
- [22:08] **완료 — 2단계 6건(L2·L3·REV-097 L-1·L-2·L-3 + REV-098 L-1).** commit·push 안 함. 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED`(approved v1). 서버·DB·API·네이티브 변경 0(웹 배포만, APK 재빌드 없음).
- **L-2 최종 방식 = Leader 지시(§15-10 C "방이 맡는다")**. 처음 만든 "셸이 위치를 아는 스토어(toastSlot, 셸 136/84 분기)" 변형은 지시 수신 즉시 **삭제**하고 맡기 방식으로 교체: `displayPrefs.ts` 에 `SaveFailureClaims`(맡기·해제·`route(fallback)`, 한 번에 하나·나중에 맡은 쪽이 이기고 해제는 자기 것일 때만) + `useClaimDisplaySaveFailure`. `TalkRoom` 이 `() => notify(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS)` 로 맡음(기존 `notify`: 녹음 중 `deferredToastRef`, 끝나면 1회, 방 `<Toast bottomPx={voice?136:84}>` 그대로 — **새 수치·상수 이동 0**). 셸 `DisplaySaveNotice` 는 `saveFailureClaims.route(() => toast.show(...))` 로만 띄움(맡은 동안 0). `clearFreshSuccessToast(shownAt, now, onToast, claims)` 를 분리해 `useClearSuccessOnSaveFail` 이 호출 — **맡은 화면이 있으면 `onToast('',0)` 안 부름**.
- **변경 파일(7 + 테스트 2)**: `components/common/japanese/JapaneseText.tsx`(A 바·토글 · B `HangulPlaceholder asLine`/`HangulLine waitAsLine`/`HANGUL_LINE_SLOT_CLASS` · L-1 호출) · `components/chat/MessageBubble.tsx`(내 말풍선만 `waitAsLine`) · `common/japanese/displayPrefs.ts`(맡기·`clearFreshSuccessToast`) · `shell/DisplaySaveNotice.tsx` · `talk/TalkRoom.tsx`(맡기 1줄 + import) · `common/japanese/annotations.ts`(L-3 flush 직렬화) · 테스트 `common/__tests__/japaneseDisplay.test.ts`(신규 5건 + 정적 1건 갱신) · `speech/__tests__/reading.test.ts`(REV-098 L-1 단언).
- **L-3 방식**: 겹친 flush 의 429 는 "우리 자신의 동시 요청"이 서버 사용자별 동시 상한에 닿은 것이라, `flush()` 를 클라이언트당 한 번에 하나(`draining` 약속 + 끝에서 큐 재확인)로 직렬화 — 한 조각의 실패 기록은 요청 1회당 정확히 1(실패 단위 테스트 `n===1`). 재시도 규칙(35초·2회) 불변.
- **Leader 지시와 데모의 차이 1건**: 지시문은 "내 말풍선 + 번역 켬일 때만"이나 승인 데모·가이드 §15-10 B 는 번역 켬·끔 모두 내 말풍선 대기 자리를 한 줄 높이로(끔도 +2) — **데모를 따랐다**(끔 +1.5 → +2, 기준 ≤4 이내).
- **테스트**: 신규 — QA-L2(클래스 파싱으로 안쪽 44·알약 32·확장 7 → 유효 ≥44) · QA-L3(슬롯 19.5+2 = 한글 줄 13×1.5+2, SSR 마크업으로 막대 여백 0·기본 막대 `mb-1 mt-1.5` 불변·내 말풍선만 prop) · L-1(신선/오래됨/맡음 3분기) · L-2(맡은 화면·셸 양 경로: 맡기 없음→셸 / 맡는 동안 방 1·셸 0 / 나중 맡기 우선·옛 해제 무효 / 해제 뒤 늦은 실패→셸 + 방 정적 배선) · L-3(겹친 3 flush 동시 1·429 시뮬레이션 0·실패 `n===1`).
- **변이 9건 전부 FAIL**(미러만, 원복 후 sync): M1 바 border-b 복원 · M2 토글 확장 1.5 · M3 내 말풍선 prop 제거 · M4 슬롯 높이 18 · M5 `onToast('',0)` 줄 제거(L-1) · M6 route 가 맡은 화면 무시 · M7 맡았어도 성공 토스트 지움 · M8 flush 직렬화 제거 · M9 reading 표식 surface 조건 제거(REV-098 L-1).
- **실행 증빙**(미러 `~/.node-local/thekaiwa-dev-030`, NFS src·tests rsync): `tsc --noEmit --incremental false` **exit 0** · `eslint .` **0 errors 5 warnings**(기존 `react-hooks/set-state-in-effect` 5건, 변경 파일 아님; ecosystem.config.js 는 이 미러에 없음) · 두 대상 테스트 **65/65** · 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` **# tests 1387 · pass 1384 · fail 0 · skipped 3**(skip 3 = 기존; 1단계 때 1382 → +5).
- **화면 실측**(dev 앱 `next dev -H 127.0.0.1 -p 3023`, 접속 localhost, QA_ACCOUNT=1 쿠키, Playwright+google-chrome, 데이터·실패는 전부 `page.route`(회화 #29·표시 설정 GET/PUT 500·#24r 지연·ticket 무응답) → DB·QA 계정 설정 무변경):
  - 토글 실제 hit test(elementFromPoint 0.25px 스캔) — 360/390/412 × 3토글 **44.0px**(HEAD 같은 방법 42.75) · 알약 32 불변 · 가로 넘침 0.
  - 내 말풍선 390×892 — 번역 켬 116.69→118.69 **+2.0**(HEAD 113.19→118.69 +5.5) · 끔 77.19→79.19 **+2.0**(HEAD +1.5) · 대기 자리 19.5·막대 12.
  - 저장 실패 알림 — 회화 음성 모드 **bottom 136·알림 1개·음성 입력 바와 겹침 0** · 글자 모드 **84** · 설정 화면(셸) **84** · 녹음 중 실패(스위치 누른 직후 PUT 1.5초 뒤 실패 + PTT 누름, aria-pressed=true): 값은 즉시 되돌아가고 알림 **0개(화면·live region 모두)** → 손 뗀 뒤 **1개(136)** → 2.2초 뒤 사라짐 · 방을 떠난 뒤(2.5초 뒤 실패) 늦은 실패 → 셸 **84, 1개**.
- **정리**: dev 3023 종료(listener 0)·쿠키 shred·미러 `.env` shred·스크린샷 0장·임시 스크립트 삭제. 미러 `thekaiwa-dev-030` 은 보존 — 단, `node_modules` 를 심볼릭 링크에서 `~/.node-local/thekaiwa/node_modules` 하드링크 복사본으로 바꿨고(Turbopack 이 루트 심볼릭 링크를 거부) `.next` 캐시가 생김.
- **주의점**: ① 방이 맡은 동안 녹음 중에 도착한 실패를 PTT 를 놓기 전에 방을 떠나면(언마운트) 미룬 알림은 사라진다(가이드 범위 밖의 희귀 경우 — 필요하면 후속). ② `docs/screens.md` §15-3 B 의 `onToast('',0)` 한 줄은 designer 영역이라 건드리지 않았다(§15-10 C 에 이미 기재). ③ 한글 줄 `hangulLine` 단일 경로 유지(이번 변경 무관).
- **미커밋 파일**: 위 변경 파일 + 1단계 3파일(`speech/reading/client.ts`·`reading.test.ts`·`fixtures/particleBoundary.json`). `docs/screens.md`·`docs/demo/…-v1.html` 은 designer 것.
- 다음 첫 행동: Reviewer(REV-099) → QA → 배포(1·2단계 한 번에).

```json
{ "taskId": "task-030", "status": "DONE", "deliverables": ["src/components/common/japanese/JapaneseText.tsx", "src/components/chat/MessageBubble.tsx", "src/components/common/japanese/displayPrefs.ts", "src/components/shell/DisplaySaveNotice.tsx", "src/components/talk/TalkRoom.tsx", "src/components/common/japanese/annotations.ts", "src/components/common/__tests__/japaneseDisplay.test.ts", "src/modules/speech/__tests__/reading.test.ts"], "blockers": [], "risk_level": "LOW", "self_check": { "unit_test": true, "lint": true, "type_check": true, "engine_name_leak": false, "native_change": false } }
```

## Reviewer 기록 (REV-099 · 2단계 L2·L3·REV-097 L-1~L-3 + REV-098 L-1, 2026-10-04)

**판정: PASS** (Critical 0 · High 0 · Medium 1 · Low 4). 코드 수정 없음(Read 전용). 미러 `~/.node-local/thekaiwa-rev-026b` 에 NFS src·tests rsync 후 검증. Medium 1건(M-1)은 3줄 수준이라 **QA 전에 Developer 가 고치길 권고**(고치면 이 파일들만 Reviewer 좁은 재검).

- **실행**: `tsc --noEmit --incremental false` exit 0 · `eslint src/components src/modules/speech` 0 errors(기존 warning 5) · 대상 2파일 65/65 · 전체 `node --test` **1387 pass / 0 fail**(skip 0). 데모 게이트 `check.mjs check` = **DEMO_GATE_PASSED**(approved v1, hash verified). `evidence.jsonl` 승인 줄(21:52:51, session 3b58d83f)은 `prompts.jsonl` 의 사용자 프롬프트 "task-030 데모 v1 승인"(21:52:48)과 일치, `waive` 0건, 에이전트가 state 파일을 쓴 흔적 없음.
- **(1) 데모 v1·가이드 일치**: 토글 `before:-inset-y-[7px]`(46→바 안 44)·알약 `h-8` 불변·바 `border-b`→`shadow-[inset_0_-1px_0_var(--color-line)]`(높이 `h-11` 그대로) = 가이드 §15-10 A. 내 말풍선 대기 자리 `mt-0.5 flex h-[19.5px]`(=실제 한글 줄 `mt-0.5`+13×1.5)·막대 `h-3 w-[62%]`·하단 여백 0, `waitAsLine` 은 `MessageBubble.tsx:195` 내 말풍선 한 곳만(선생님 말풍선 240·CorrectionCard·TalkCorrectionCard·ProposalCard·단어·수업은 기본값 `mb-1 mt-1.5` 불변, grep 확인). 클래스·수치는 모두 승인본과 같다 → **material 차이 0**. Leader 지시("번역 켬일 때만")와 승인 데모·가이드(번역 켬·끔 둘 다 +2)의 차이는 developer 가 **데모를 따른 것이 맞다**(implementation 분류, 데모 재승인 불필요 — Leader 문구가 오기). 수업·단어장 도구 줄 토글은 터치 46px 로 가이드가 명시(wrap 줄 gap-2 의 터치 영역 6px 겹침은 설계 수치 — 결함 아님).
- **(2) SaveFailureClaims**: 맡기/해제 토큰 identity(`this.current === mine`)로 옛 해제 무효·나중 맡기 우선 OK. Strict Mode 이중 effect(claim→cleanup→claim)는 최종 맡은 상태로 끝난다. 방→방 전환은 cleanup 이 먼저 돌지만 순서가 뒤집혀도 identity 로 안전. 두 방 동시 마운트는 라우트상 불가(해제 시 이전 방 복원 없음 = 스택 아님, 셸 폴백이라 무손실). 알림 1개 불변식: 맡은 동안 셸 `route` → 방 `notify` 한 곳, `clearFreshSuccessToast` 는 맡았으면 `onToast('',0)` 미호출(변이 MI 로 잠금 확인). 호스트가 맡지 않는 화면(채팅방·단어장·수업·설정)은 HEAD 와 동일. **그러나 아래 M-1·L-1·L-2.**
- **(3) L-3 flush 직렬화**: `draining` 약속 + `while(queue)` 재확인 + `.finally` 해제. 새 request 가 끝 직전·끝 직후·진행 중 어느 시점에 와도 큐가 고아가 되지 않음(`flush` 가 `scheduled=false` 를 먼저 내리고, React uSES 갱신 microtask 가 `.finally` 보다 앞서 request 를 호출해도 setTimeout flush 가 `draining=null` 뒤에 돌아 새 drain 을 만든다 — 순서 추적). 교착 없음: `withTimeout` 12s 가 모든 post 를 끝낸다. 에러 시 `.finally` 가 해제. 35초·2회(`canRetryAnnotate`) 불변(변경 없음). 요청량 불변·**지연은 증가**: 진행 중 요청이 있으면 뒤 요청이 그 뒤로 직렬(독립 실측: 첫 post 300ms 일 때 둘째 post 시작 @301ms; HEAD 는 병렬). 첫 화면(한 `request` 호출)은 HEAD 도 묶음 순차라 동일. 최악은 진행 중 묶음의 12s 타임아웃 — 허용 범위(L-3 참고).
- **(4) TalkRoom 부작용**: 변경은 훅 1줄 + import. STT·TTS·`notify`·`recordingRef`·Toast 자리 불변, 훅은 모든 조기 return(914·922행) 앞이라 훅 순서 안전. 음성 경로 접촉 0. **단 조기 return 화면에는 `<Toast>` 가 없다 → M-1.**
- **(5) 경계·게이트**: 엔진명·`window.Capacitor`·`innerHTML`·`localStorage` 직접 호출 0, 화면에 `kanaToHangul|pronLine` 0, 사용자 문구 '후리가나' 0, `readingDefault` 는 기존 이관 경로(HEAD 와 동일)·가드 테스트 통과. 6층: 변경은 `components/**`(app 층)·`speech/reading`(순수) 뿐, 서버·DB·API·인증·Secret·네이티브 무접촉(`native_change:false`, versionCode 해당 없음). 파일 12개 이하지만 화면·standard 트랙이라 light 승격 이슈 없음.
- **독립 변이 9건**(미러만, 원복·`diff -rq` 일치): MA 해제 identity 검사 제거 → FAIL ✔ · MB 토글 확장 7→5px → FAIL ✔ · MC `while`→`if`(큐 재확인 제거) → FAIL ✔ · MD `draining=null` 제거 → 9건 FAIL ✔ · ME `route` 가 맡은 화면+셸 둘 다 → FAIL ✔ · MG 대기 자리 19.5→22px → FAIL ✔ · MH `flush` 의 `scheduled=false` 제거 → 8건 FAIL ✔ · MI 맡았어도 성공 토스트 지움 → FAIL ✔ · **MF `useClaimDisplaySaveFailure` 가 해제 함수를 안 돌려줌(언마운트 해제 누락) → 65/65 생존**(L-2). 추가 시나리오 스크래치(미러에서만, 삭제): 어긋난 서버 항목(`segments:[null]`)이 오면 drain 이 throw → 그 조각이 영구 `loading`(L-4).

### 이슈 (reviewer.md 스키마)
```json
{ "reviewId": "REV-099", "status": "PASS", "issues": [
  { "issue": "회화방이 마운트 즉시 저장 실패 알림을 맡는데, 방이 로드 중·오류·없음 화면(조기 return)일 때는 <Toast> 가 렌더되지 않아 실패 알림이 0개가 된다(셸은 맡은 동안 숨김) — '알림 정확히 1개' 불변식 위반",
    "severity": "MEDIUM", "component": "src/components/talk/TalkRoom.tsx:245(훅) · 914-947(조기 return, Toast 없음) · 1106(Toast 는 최종 return 에만)",
    "risk": "다른 화면(단어장·채팅방)에서 누른 표시 스위치 PUT 이 회화방 진입 직후 실패하면(나쁜 네트워크에서는 PUT 10s 타임아웃과 방 로드 지연/오류가 같이 일어나기 쉽다) 값은 조용히 되돌아가고 알림은 어디에도 안 뜬다. notFound·error 화면은 계속 맡은 채라 영구적. 로드가 2.2초 안에 끝나면 useToast 메시지가 남아 보일 수 있어 일부만 구제.",
    "evidence": "TalkRoom.tsx:245 훅은 load 상태와 무관, :914-947 `load==='loading'`·`notFound||!chat` 반환 JSX 에 <Toast> 없음, Toast 는 :1106. HEAD 에서는 셸이 84 로 항상 띄웠다(회귀).",
    "recommendation": "맡기를 방 본 화면이 그려질 때만 — 예: `useClaimDisplaySaveFailure(fn, { enabled: load==='ready' && !!chat })`(enabled 가 false 면 해제) 또는 조기 return 에도 <Toast> 를 둔다. 테스트: 정적 배선(enabled 조건) 단언 1건." },
  { "issue": "방이 녹음 중에 도착한 실패 알림을 미룬 채 언마운트되면(PTT 누른 채 뒤로가기) 미룬 알림이 사라진다 — developer 주의점 ① 판단: LOW. 같은 구간의 부수 현상: 토글 직후 2.2초 안에 녹음을 시작하면 되돌려진 값 위에 성공 토스트가 최대 2.2초 남는다(맡은 동안 onToast('',0) 생략 + 실패는 미룸)",
    "severity": "LOW", "component": "src/components/talk/TalkRoom.tsx:236-241,457-468 · src/components/common/japanese/displayPrefs.ts:354-359",
    "risk": "값은 이미 서버 값으로 되돌아가 있어 잘못된 상태가 남지 않고 안내만 빠짐. 조건 = PUT 실패(≤10s 창) ∧ 녹음 중 ∧ 녹음 중 방 이탈, 또는 토글 후 2.2초 내 녹음 시작.",
    "evidence": "deferredToastRef 는 컴포넌트 ref 라 언마운트 때 폐기, claim 해제 후 셸 폴백으로 넘기는 경로 없음. 성공 토스트는 notify 로 이미 표시된 뒤 실패가 deferred 슬롯으로만 들어간다.",
    "recommendation": "필수 아님. 하려면 방 언마운트 cleanup 에서 deferredToastRef 가 실패 알림이면 셸 폴백(saveFailureClaims 해제 뒤 같은 문구를 셸에 위임)으로 넘긴다 — 후속 후보로만." },
  { "issue": "맡기 해제(언마운트 cleanup)가 테스트로 잠겨 있지 않다 — 변이 MF(해제 함수 미반환) 생존",
    "severity": "LOW", "component": "src/components/common/japanese/displayPrefs.ts:362-368 · src/components/common/__tests__/japaneseDisplay.test.ts:822-870",
    "risk": "해제가 빠지면 방을 떠난 뒤에도 죽은 방의 notify 로만 알림이 가 셸 알림이 영구 사라진다(REV-096 #2 회귀). 현재 코드는 올바르다.",
    "evidence": "MF: `useEffect(() => { claim(...) }, [])` 로 바꿔도 65/65 pass. 현 테스트는 SaveFailureClaims 단위·정적 배선만.",
    "recommendation": "정적 소스 단언(`useEffect(() => saveFailureClaims.claim(` 형태 — 반환값이 effect 로 직결)을 1건 추가." },
  { "issue": "(기존·회귀 아님) 서버 응답 항목의 segments 배열에 null 등 어긋난 원소가 있으면 drain 의 forEach 가 throw → 그 묶음 조각이 status 'inflight' 로 남아 영구 loading·재시도 없음, flush 거부(unhandled)",
    "severity": "LOW", "component": "src/components/common/japanese/annotations.ts:227-243",
    "risk": "서버 계약 위반 입력에서만. HEAD 의 flush 도 같은 forEach 라 동일(회귀 아님) — 직렬화로 악화되지 않고 `.finally` 가 draining 은 해제한다.",
    "evidence": "스크래치(미러): post→{available:true,items:[{segments:[null]}]} → flush throw, stateOf=loading, 재 request·flush 후에도 post 1회.",
    "recommendation": "후속 후보: batch.forEach 를 try/catch 로 감싸 조각별 fail 처리." },
  { "issue": "L-3 직렬화로 겹친 요청의 시작이 진행 중 요청 뒤로 밀린다(지연 증가, 429 중복 소모 제거와 맞바꾼 것)",
    "severity": "LOW", "component": "src/components/common/japanese/annotations.ts:205-215",
    "risk": "채팅 중 새 말이 와도 직전 묶음이 끝나야 요청 시작(정상 시 수백 ms, 서버 정지 시 최대 12s 타임아웃). 사용자 체감 영향 작음, 허용.",
    "evidence": "스크래치: 첫 post 300ms → 둘째 post 시작 @301ms(HEAD 는 병렬).",
    "recommendation": "조치 불필요 — QA 가 체감만 확인." } ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 4 },
  "high_risk_areas": [
    "회화방 진입 직후·로드 중/오류/없음 화면에서 저장 실패 알림이 0개가 되는지(M-1 수정 후 enabled 조건 포함 재확인)",
    "회화방 음성 모드 실패 알림 bottom 136·겹침 0 / 글자 모드 84 / 설정·단어장·채팅방 84 / 방을 떠난 뒤 늦은 실패 = 셸 84 1개 — 알림 정확히 1개(이중·0개 없음)",
    "녹음 중 실패 → 값은 즉시 되돌아가고 알림은 화면·live region 모두 미룸 → 손 뗀 뒤 1회",
    "표시 바 토글 hit 44(360/390/412)·알약 32 불변·바 아래 선 겉모양 불변(다크 테마 포함), 단어장·수업 도구 줄 46 이 이웃 컨트롤을 덮지 않는지",
    "내 말풍선 번역 켬·끔 대기→채움 높이 변화 ≤4px(+2 예상), 선생님 말풍선·교정/제안 카드 높이 회귀 0",
    "분석기 429 상태에서 재시도 기록이 요청 1회당 1·35초 간격·최대 3회(최초 포함) 불변, 새 말 도착이 진행 중 요청 뒤로 밀려도 결국 채워짐(영구 loading 없음)",
    "1단계 한글 줄 先生へ→센세-에·家へ→이에에·コーヒーを→코-히-오 그대로(운영 화면 값)" ],
  "native_change": false }
```
- 데모 게이트: material 차이 0, defect 0(M-1 은 승인본에 없는 로드 상태 처리 공백 — 구현 결함으로 분류, 데모 재승인 불필요).
- Codex 검토: 이 단계 judge 개입 판정·Codex 결과 없음(`## Codex 검토` 부재) — 판정 기준 영향 없음.
- 순환: **PASS** — QA 인계 가능. 단 M-1 은 3줄 수정이라 QA 전에 Developer 반영을 권고(반영 시 TalkRoom.tsx·displayPrefs.ts·테스트만 Reviewer 좁은 재검 → QA). Leader 가 그대로 QA 로 보내면 위 high_risk_areas 첫 줄을 QA 가 반드시 재현해야 한다. Sonnet 반려 이력 없음(Opus 승격 권고 해당 없음).

## Developer 기록 (REV-099 M-1, 2026-10-04 22:15)

- 데모 게이트: `DEMO_GATE_PASSED` / task: task-030 / status: approved (v1)
- **M-1**: `displayPrefs.ts` — `claimWhile(enabled, fn, claims)` 추가(enabled 면 `claims.claim`, 아니면 undefined), `useClaimDisplaySaveFailure(onFail, enabled = true)` 가 `useEffect(() => claimWhile(...), [enabled])` 로 enabled 전환 시 해제·재맡기. `TalkRoom.tsx:245` 는 `load === 'ready' && !!chat` 전달 — 로드 중·오류·없음 화면은 맡지 않아 셸이 띄운다.
- **L-2**: `japaneseDisplay.test.ts` 에 REV-099 테스트 1건(enabled false→셸 / true→방 / false→셸 / 언마운트→셸 + 훅·방 정적 배선), REV-097 L-2 의 정적 배선 정규식 갱신.
- 변이: enabled 무시(`claims.claim(fn)` 항상) → FAIL 1 · 해제 누락(effect 가 반환 안 함) → FAIL 1 · 원복 diff 일치.
- 실행 증빙(미러 `~/.node-local/thekaiwa-dev-030` rsync 후): tsc --noEmit exit 0 · eslint src/components src/modules/speech 0 errors(기존 warning 5) · japaneseDisplay.test.ts 49 pass/0 fail · 전체 node --test 1385 pass/0 fail · demo-gate PASSED.
- 변경 파일(미커밋): `src/components/talk/TalkRoom.tsx` · `src/components/common/japanese/displayPrefs.ts` · `src/components/common/__tests__/japaneseDisplay.test.ts`. L-1(녹음 중 언마운트 시 미룬 알림 소실)·L-4는 범위 밖, 손대지 않음.
- [2026-10-04 22:16] codex_gate/C2 engine=jev → codex_required=true · mode=adversarial-review · focus=concurrency · budget_rule=CX-limit-unknown-r2 · codex_switch=on | overrides=CX-r2-post-review | fallback=- | tokens=963

## Reviewer 기록 (REV-099b · REV-099 M-1·L-2 좁은 재검, 2026-10-04)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0 신규). 코드 수정 없음(Read 전용). 미러 `~/.node-local/thekaiwa-rev-026b` 에 src rsync 후 `tsc --noEmit --incremental false` exit 0 · eslint(TalkRoom·displayPrefs) 출력 0 · `japaneseDisplay.test.ts` 49/49 · 데모 게이트 `check.mjs` approved v1 hash verified. 확인: ① 로드 중·오류·없음 화면 — `TalkRoom.tsx:246` 이 `load==='ready' && !!chat` 만 enabled 로 넘겨(`setLoad('ready')` 는 chat 세팅 뒤 549행, 조기 return 은 915·923행) 맡지 않으므로 셸 `route` 가 폴백으로 띄운다. ② ready 전환 시 `[enabled]` effect 가 cleanup(`undefined`)→`claimWhile` 로 맡는다. 재시도(`setLoad('loading')`)·notFound 로 돌아가면 해제. ③ 해제 토큰 — `claimWhile` 이 `claims.claim` 의 identity 클로저를 그대로 돌려줘 enabled 토글·언마운트 모두 자기 토큰만 푼다(REV-099 (2) 의 identity 검사 유지). ④ Strict Mode claim→cleanup→claim 은 최종 맡은 상태로 끝나고 enabled=false 에서는 `undefined` 라 cleanup 호출 자체가 안전. 테스트가 배선을 실제로 잠근다 — 독립 변이(미러만, 원복·`diff -rq` 일치): enabled 무시 → FAIL 1 · deps `[]` → FAIL 1 · 방이 항상 맡음(`true`) → FAIL 2 · `load!=='loading'` → FAIL 2 · effect 가 해제 미반환(REV-099 L-2 의 MF 에 해당) → FAIL 1(이전엔 생존, 이제 잠김). 생존 1건 = 기본값 `enabled=true→false` 변이(호출처가 항상 명시 인자를 넘겨 동작 무영향 — 허용). 알림 정확히 1개 불변식 유지, 데모·승인본 영향 없음(화면 변경 0). L-1(녹음 중 언마운트 시 미룬 알림 소실)·L-4 는 REV-099 판정대로 범위 밖 후속 후보.

```json
{ "reviewId": "REV-099b", "status": "PASS", "issues": [], "summary": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "high_risk_areas": [
    "회화방 진입 직후·로드 중/오류/없음 화면에서 PUT 실패 → 셸 84 알림 1개 / ready 후 실패 → 방 토스트(음성 136·글자 84) 1개, 이중·0개 없음 (M-1 수정분 실측)",
    "오류 화면 '다시 시도'(load→loading→ready) 중 실패 알림 — 중간엔 셸, ready 후 방",
    "방을 떠난 뒤 늦은 실패 = 셸 84 1개 / 녹음 중 실패는 값 즉시 복원·알림은 손 뗀 뒤 1회(L-1 잔여: 녹음 중 방 이탈 시 소실 가능 — 허용)",
    "표시 바 토글 hit 44(360/390/412)·알약 32·내 말풍선 대기→채움 ≤4px·분석기 429 재시도 간격(REV-099 목록 유지)" ],
  "native_change": false }
```
- 순환: **PASS** — QA 인계 가능(REV-099 high_risk_areas 를 위 갱신분으로 대체). Codex 검토 없음, Sonnet 반려 이력 없음.

## Codex 검토 (C2 adversarial-review focus=concurrency, 2026-10-04 22:18)

### [2026-10-04 22:18] C2 adversarial-review focus=concurrency — 지적 2건
- judge 판정: 231줄 / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=a130443(task_file) snapshot=ca8f9a6
- 지적 2건 (Medium 1 / Low 1):
  1. [Medium] `src/components/common/japanese/displayPrefs.ts:375` — 회화방 ready→loading/error/notFound 전환 직후 cleanup 전 저장 실패 완료 시 claim 수명이 passive effect 에만 의존하면서 route가 이전 방 callback 호출 → 알림 0개(방·셸 모두 미표시), 중복·누락 0 불변식·로드 상태 폴백 위반 (권고: 호출 시점에 화면이 실제 표시 가능한지 확인, claimant가 handled 반환 또는 동기적 활성 토큰)
  2. [Low] `src/components/talk/TalkRoom.tsx:238` — 녹음 중 저장 실패 후 녹음 종료 전 언마운트/ready 벗어남 시 deferredToastRef 가 셸로 이관 안 됨 → 알림 영구 소실 (권고: claim 해제 시 미표시 deferred 를 셸 대기열로 이관 또는 녹음 중 방 claim이 실패 처리 불가 반환)
- 검토하지 못한 범위: 브라우저 React 스케줄러 commit·passive-effect cleanup 사이 타이밍 재현 · 범위 밖 서버 응답 segments 내부 비정상
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261004T131805Z-task-030-C2/

## Reviewer 기록 (REV-100 · Codex C2 지적 2건 판정, 2026-10-04)

**판정: PASS 유지 + 두 지적 모두 채택(둘 다 LOW, 수정 권고)** (Critical 0 · High 0 · Medium 0 · Low 2). 코드 수정·실행 없음(Read 전용, `displayPrefs.ts`·`TalkRoom.tsx`·`DisplaySaveNotice.tsx`·테스트·§15-10 C·Codex 원본 직접 확인). 새 근거: `TalkRoom.tsx` 의 `setLoad('notFound'|'error')`(320·562행)는 모두 **비동기 콜백(기본 우선순위)** 에서 오므로 passive effect cleanup 이 커밋 뒤 스케줄러 태스크로 밀린다 — 그 사이 `pump` 의 PUT 실패(fetch reject·10초 타임아웃 콜백, 별도 매크로태스크)가 끼어들 수 있다.

| # | Codex | 판정 | 근거 요약 |
|---|---|---|---|
| 1 | MEDIUM `displayPrefs.ts:375` claim 수명이 passive effect 에 의존 → 커밋~cleanup 사이 실패는 죽은 방 콜백으로 감(알림 0) | **채택 · LOW 로 하향** | 코드로 재현 가능한 경로: `route` 는 `current` 만 보고(339행), `watchSaveFailures` 는 `seen=now` 를 먼저 소비(310행)해 재전달 없음. 방 콜백 = `notify→showToast` 인데 그 시점 `<Toast>` 가 없는 트리(또는 언마운트된 컴포넌트)라 소실. **범위는 Codex 가 말한 ready→loading/error/notFound 뿐 아니라 방 언마운트(화면 이동)도 같다**(해제가 passive cleanup 이라). 다만 창이 커밋~다음 스케줄러 태스크(수 ms~렌더 부하 시 수십 ms)이고 소실 = 안내 토스트 1건(상태 되돌림·저장 데이터는 정상)이라 REV-099 M-1(정상 상태에서 항상 0개)보다 낮은 LOW. |
| 2 | LOW `TalkRoom.tsx:238` 녹음 중 미룬 알림이 방 언마운트/비ready 전환 때 소실 | **채택 · LOW** | REV-099 L-1 과 동일(Leader 가 범위 밖으로 둔 건). 코드로 확인: 미룸은 `deferredToastRef` 한 칸(238행)이고 비움은 `recording` 이 false 가 되는 effect(459행)뿐 — 언마운트·비ready 에서는 아무도 안 비움, 셸은 이미 소비된 실패를 다시 못 본다. **추가 발견(같은 뿌리, 더 흔함)**: 이 한 칸은 모든 `notify` 가 공유하므로 녹음 중 다른 토스트(`modeWhileRecording` 857행·`replayWhileRecording` 716행)가 오면 **미룬 저장 실패 알림을 덮어쓴다** → 가이드 §15-10 C "손을 뗀 뒤 1회" 위반. 수정은 둘을 한꺼번에 막는다. |

**가이드 §15-10 C 충돌 검토**: Codex 의 2번 권고 후반("녹음 중엔 방 claim 이 처리 실패를 반환해 셸이 즉시 fallback")은 **부결** — 셸 토스트가 녹음 중 즉시 뜨면 스크린리더 음성이 마이크로 들어가는 문제(§9-0 ⑨)와 "알림은 화면·스크린리더 모두 미룸" 규칙을 어긴다. 전반("해제 시 미표시 deferred 를 셸로 이관")만 채택한다. 1번 권고의 `handled boolean` 은 부분 채택이 아니라 **더 작은 수정으로 대체**(아래 A) — boolean 도 "방 `<Toast>` 가 지금 떠 있는가"를 동기로 알려 줄 신호가 필요한데 그 신호가 곧 layout effect 라서 A 가 B 를 포함한다.

### 가장 작은 수정안

**A. (#1) claim 수명을 layout effect 로** — `displayPrefs.ts` `useClaimDisplaySaveFailure` 의 `useEffect(() => claimWhile(...), [enabled])` → `useLayoutEffect(...)`(import 한 단어 추가). 해제·재맡기가 **커밋 단계 안에서 동기**로 끝나 커밋과 cleanup 사이 창이 없다(언마운트·비ready 전환 모두). `claimWhile`·`SaveFailureClaims` 의미 불변, 파일 1곳 2줄. React 19 는 서버 렌더에서 useLayoutEffect 경고가 없고 `MessageList`·`Composer` 등 이미 쓴다. `ref.current = onFail` 갱신 effect 는 그대로 둔다(콜백 최신화는 영향 없음).
  - 선택(불필요, 권하지 않음): 방 claim 콜백이 `boolean`(handled)을 돌려 `route` 가 false 면 셸 — A 가 창을 없애므로 중복.

**B. (#2) 해제 시 미표시 실패를 셸로 1회 이관 + 한 칸 공유 덮어쓰기 제거**
1. `SaveFailureClaims`: `claim(fn, takeLeftover?: () => boolean)` — 해제 함수가 **자기 토큰일 때만**(기존 identity 검사 안) `takeLeftover?.()` 가 true 면 `this.shell?.()` 를 1번 부른다. `setShell(fn: () => void): () => void`(등록·해제 함수 반환, `route` 의 fallback 인자는 그대로 유지해 기존 테스트 호환).
2. `DisplaySaveNotice`: `useEffect(() => saveFailureClaims.setShell(() => toast.show(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS)), [toast.show])`(기존 `route` 폴백 줄은 유지 — 알림 문구·84px·2.2초 불변).
3. `useClaimDisplaySaveFailure(onFail, enabled, takeLeftover?)` → `claimWhile(enabled, fn, claims, takeLeftover)` 로 전달.
4. `TalkRoom`: **저장 실패 전용 ref** `saveFailDeferredRef`(boolean). claim 콜백 = `() => { if (recordingRef.current) saveFailDeferredRef.current = true; else showToast(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS) }`(`notify` 를 거치지 않아 `deferredToastRef` 와 안 섞임). 녹음 종료 effect(459행)에서 기존 `deferredToastRef` 를 먼저 `showToast` 한 **뒤** `saveFailDeferredRef` 면 비우고 `showToast(saveFailed)`(토스트는 한 칸이라 실패 알림이 마지막에 남음 — 녹음 중 여러 번 실패해도 1회). `takeLeftover = () => { const v = saveFailDeferredRef.current; saveFailDeferredRef.current = false; return v }`(읽고 비움 → 이관 정확히 1회).
   - 일반 `deferredToastRef`(재생·모드 안내 등)는 방 한정 안내라 이관하지 않는다(기존 동작 유지, 범위 밖).
   - 이관 때 셸 토스트(84)가 뜨는 경우는 방 언마운트(녹음도 함께 끝남)·비ready 전환뿐이라 스크린리더→마이크 문제는 사실상 없다.

### 테스트 기준 (`japaneseDisplay.test.ts`, node:test — DOM 없음)
- **T1(#1, 정적)**: 훅이 `useLayoutEffect(() => claimWhile(enabled, ...), [enabled])` 이고 `useEffect` 로 claim 하지 않음. 기존 REV-099 테스트의 정규식(`useEffect\(\(\) => claimWhile…`)을 갱신. (타이밍 자체는 DOM 없이 재현 불가 — Codex `not_reviewed` 와 같음; QA 는 실기기에서 재현 어렵다고 명시.)
- **T2a**: `claim(fn, () => true)` 해제 → 셸 sink 정확히 1회, `() => false` → 0회. **T2b**: 이미 새 claim 에 밀린(stale) 토큰 해제 → 이관 0(이중 알림 금지). **T2c**: takeLeftover 가 읽고 비우므로 같은 해제를 2번 불러도 1회. **T2d**: `setShell` 미등록(셸 없음)에서도 throw 0·해제 뒤 `setShell` 해제 함수 호출 시 이관 0.
- **T2e(모델)**: 녹음 중 모사 — 방 claim 콜백이 deferred 만 세우고 `route` 호출 동안 셸 0 · 녹음 종료 모사에서 1회 · 녹음 중 다른 notify(덮어쓰기)가 와도 저장 실패 1회 유지 · 방 해제(언마운트 모사)에서 deferred 가 남았으면 셸 1회, 이미 표시했으면 0.
- **T2f(정적)**: `TalkRoom` 이 `saveFailDeferredRef`·`takeLeftover` 를 `useClaimDisplaySaveFailure` 에 넘기고 claim 콜백이 `deferredToastRef` 를 쓰지 않음, `DisplaySaveNotice` 가 `setShell` 등록. 기존 정적 단언(`useClaimDisplaySaveFailure\(\(\) => notify\(…\)`)은 새 콜백 모양으로 갱신.

### 독립 변이(Reviewer 재검에서 미러에 적용 → 모두 FAIL 이어야 유효)
M1 `useLayoutEffect→useEffect`(T1) · M2 해제가 이관을 안 부름(T2a) · M3 이관을 identity 검사 밖에서 호출(T2b) · M4 `takeLeftover` 가 비우지 않음(T2c) · M5 이관을 leftover 무관하게 항상 호출(T2a false) · M6 claim 콜백이 녹음 중 즉시 `showToast`(§15-10 C 위반, T2e) · M7 claim 콜백이 `notify`/`deferredToastRef` 로 되돌아감(덮어쓰기 재발, T2e·T2f) · M8 녹음 종료 effect 가 `saveFailDeferredRef` 를 안 비움(2회 표시, T2e).
회귀 확인: 기존 49 단언 유지, `tsc --noEmit`·eslint, 데모 게이트 `check.mjs`(화면 구조·문구·색 불변이라 material 아님 — implementation 분류, 재승인 불필요).

```json
{ "reviewId": "REV-100", "status": "PASS", "issues": [
  { "issue": "저장 실패 알림 claim 이 passive effect 수명이라 커밋~cleanup 사이(방 비ready 전환·언마운트) 실패 시 알림 0개", "severity": "LOW", "component": "src/components/common/japanese/displayPrefs.ts:375", "risk": "안내 토스트 1건 소실(상태 되돌림·데이터 정상) — 창은 수 ms~수십 ms", "evidence": "route(339행)는 current 만 확인·watchSaveFailures(310행)는 실패를 소비 후 재전달 안 함·TalkRoom setLoad(320·562행)는 비동기 콜백이라 cleanup 이 스케줄러로 밀림", "recommendation": "useLayoutEffect 로 claim/해제를 커밋 안에서 동기 처리(2줄)" },
  { "issue": "녹음 중 미룬 저장 실패 알림이 방 언마운트/비ready 전환 때 소실되고, 녹음 중 다른 notify 가 한 칸 deferredToastRef 를 덮어써 1회 보장도 깨짐", "severity": "LOW", "component": "src/components/talk/TalkRoom.tsx:238", "risk": "녹음 중 실패 후 이동하거나 다른 안내가 오면 알림 영구 소실(§15-10 C '손 뗀 뒤 1회' 위반)", "evidence": "비움 지점은 recording→false effect(459행)뿐·notify(236~241행)가 deferredToastRef 공유·857/716행 notify 가 녹음 중 호출됨", "recommendation": "저장 실패 전용 ref + claim(fn, takeLeftover) 해제 시 셸 1회 이관(셸은 setShell 등록), 녹음 중 즉시 셸 폴백은 하지 않음" } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 },
  "high_risk_areas": [
    "회화방 비ready 전환(오류·없음·재시도)·언마운트 직후 PUT 실패 → 셸 84 알림 1개(0개 아님) — 방 이탈 직후 실기기 어려움, 단위 모델 의존",
    "녹음 중 실패 → 값 즉시 복원·알림 화면·스크린리더 미룸 → 손 뗀 뒤 1회, 녹음 중 모드·재생 안내가 와도 실패 알림 유지",
    "녹음 중 실패 후 방 이탈 → 셸 1회(중복·0 없음)",
    "알림 정확히 1개 불변식(맡은 동안 셸 0·성공 토스트 지우기 생략)·문구 2.2초·136/84 자리 불변" ],
  "native_change": false }
```
- **다음**: 채택 2건은 Developer 수정(미러·테스트 포함) → Reviewer(REV-101 좁은 재검: 위 변이 M1~M8 + 49 단언 회귀) 재순환 → QA. 둘 다 LOW 이므로 Leader 가 #2(REV-099 L-1 재제기)를 이번 배포에 포함할지 사용자 보고와 함께 결정(권고: 수정 범위가 3파일·화면 불변이라 포함). Sonnet 반려 이력 없음·화면 구조 불변이라 데모 재승인 불필요.

## Leader 기록 (REV-100 수용, 2026-10-04 22:22)
- Codex C2 지적 2건 REV-100 판정 수용 — 둘 다 LOW, **이번 터치에 포함**: A(`useLayoutEffect` 로 맡기 해제 동기화) · B(저장 실패 전용 `saveFailDeferredRef` + 해제 시 미표시분 셸 1회 이관, 다른 notify 가 덮어쓰지 않음). 녹음 중 셸 즉시 폴백 권고는 부결(§15-10 C 위반) 수용. 화면·문구 불변 → 데모 재승인 불필요.
- 다음: developer 수정 → REV-101 좁은 재검(변이 M1~M8) → QA → 배포. Codex 추가 호출 없음.

## Developer 기록 (REV-100, 2026-10-04 22:26 실측)
- 완료: 수정안 A(`useClaimDisplaySaveFailure` 맡기·해제를 `useLayoutEffect` 로, import 한 단어) · B(`SaveFailureClaims.claim(fn, takeLeftover?)` — 자기 토큰 해제 때만 `takeLeftover()` true 면 `shell` 1회 · `setShell` 등록/해제 · `claimWhile`/훅이 `takeLeftover` 전달(ref 로 최신값) · `DisplaySaveNotice` 가 `setShell` 등록(route 폴백 줄 유지) · `TalkRoom` 저장 실패 전용 `saveFailDeferredRef`: claim 콜백은 `notify` 를 안 거치고 녹음 중이면 표식만, 녹음 종료 effect 가 일반 `deferredToastRef` 를 먼저 낸 뒤 저장 실패를 마지막 1회로 냄, takeLeftover 는 읽고 비움). 문구·136/84·2.2초 불변, 녹음 중 셸 즉시 폴백 없음(§15-10 C).
- 변경 파일(미커밋): `src/components/common/japanese/displayPrefs.ts` · `src/components/shell/DisplaySaveNotice.tsx` · `src/components/talk/TalkRoom.tsx` · `src/components/common/__tests__/japaneseDisplay.test.ts`.
- 테스트: 기존 REV-097/099 정적 단언 3줄을 새 호출 모양에 맞게 갱신(나머지 기존 단언 그대로), 신규 T1·T2a~f 7개(총 56).
- 실행 증빙(미러 `~/.node-local/thekaiwa-dev-030`, rsync 후): `tsc --noEmit --incremental false` 0 · eslint 0 errors(경고 5건은 기존 파일 — admin/settings, 내 변경 파일 0) · `japaneseDisplay.test.ts` 56/56 · 전체 `node --test` 1395 중 pass 1392·fail 0(3 skip) · demo-gate check `DEMO_GATE_PASSED`(approved v1).
- 변이 M1~M8(미러 적용→FAIL 확인→원복, 원복 후 NFS 소스와 diff 0): M1 #43·44 · M2 #45·47·48·49 · M3 #46 · M4 #50(T2f 정적) · M5 #45·46·47·49 · M6 #42 · M7 #42·50 · M8 #50(T2f 정적) — 8개 모두 FAIL.
- 화면 실측(포트 3023)은 선택이라 생략 — 커밋~cleanup 창은 DOM 없이 재현 불가(Codex not_reviewed 와 동일), QA 는 단위 모델 의존.
- 주의: M4·M8 은 TalkRoom 내부 ref 동작이라 정적 단언(T2f)으로만 잡힌다(T2c·T2e 는 동일 로직의 모델).

## Reviewer 기록 (REV-101 · REV-100 수정분 좁은 재검, 2026-10-04)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0 · 관찰 2). 코드 수정 없음 — 미러 `~/.node-local/thekaiwa-rev-026b` 에 NFS `src/` rsync(diff 0) 후 확인·변이는 미러에서만 적용하고 매번 원복(최종 `diff -rq` CLEAN).

**실행**: `tsc --noEmit --incremental false` 0 · eslint(변경 4파일) 0 · `japaneseDisplay.test.ts` 56/56 · 전체 `node --test` 1395/1395 pass·fail 0 · 데모 게이트 `check.mjs` approved v1·hash verified(화면 구조·문구·색·136/84·2.2초 불변 → implementation, 재승인 불필요). `evidence.jsonl` 의 승인 줄(task-030·v1·세션 3b58d83f)은 대화 흐름과 일치, 에이전트의 approve/waive 대행 흔적 없음.

**확인 결과**
- **A `useLayoutEffect`**: `[enabled]` 맡기·해제가 커밋 안 동기. 서버 렌더 경고 없음 — React 19.2.8 은 서버 `useLayoutEffect` 경고를 제거했고(훅은 `'use client'` TalkRoom 안에서만 불림, 서버는 effect 를 실행하지 않음) 같은 저장소의 `MessageList`·`Composer`·`useRealtimeStt` 등이 이미 같은 방식. 콜백·`takeLeftover` 최신화는 passive effect(ref)라 해제 시점 stale 우려 없음(둘 다 ref 읽기).
- **B 셸 이관**: 해제는 자기 토큰(`current === mine`)일 때만 `takeLeftover()` → true 면 `shell` 정확히 1회(T2a·c). stale 토큰 해제는 이관 0(T2b·M3 FAIL로 입증), `takeLeftover` 가 읽고 비워 이중 해제도 1회(T2c·M4), `setShell` 미등록 시 throw 0·해제 뒤 이관 0·밀린 셸 해제가 현재 셸을 풀지 않음(T2d). `DisplaySaveNotice` 는 `useToast().show`(안정 useCallback)로 `[show]` 등록 → 재등록 없음.
- **`saveFailDeferredRef`**: 맡은 콜백이 `notify`·`deferredToastRef` 를 거치지 않아 `modeWhileRecording`·`replayWhileRecording` 안내가 덮어쓰지 못함(M7·T2e). 녹음 종료 effect 는 일반 deferred 를 먼저, 저장 실패를 마지막에 1회 → 토스트 한 칸에 실패 알림이 남고 여러 번 실패해도 1회(M8). 녹음 중 셸 폴백 없음(M6 FAIL: 즉시 `showToast` 로 바꾸면 #42 가 잡음). 같은 커밋에서 enabled 해제+녹음 종료가 겹쳐도 layout cleanup 이 먼저 비우므로 이중 표시 없음.
- **알림 정확히 1개 불변식(전 경로)**: ① 맡은 방+비녹음 → 방 1(셸 0) ② 맡은 방+녹음 중 → 0 → 종료 후 방 1 ③ 녹음 중 후 방 이탈/비ready → 셸 1(방 0) ④ 방이 이미 낸 뒤 해제 → 셸 0 ⑤ 맡은 방 없음 → 셸 1 ⑥ 해제 뒤 늦은 실패 → 셸 1(REV-096 #2). 중복·누락 경로 발견 없음.
- **회화 음성 경로(STT·TTS)**: `TalkRoom.tsx` 변경은 import·맡는 훅 호출·`saveFailDeferredRef`·녹음 종료 effect 의 4줄 추가뿐(+24줄) — `useRealtimeStt`·TTS 재생·턴 로직 미접촉, `recordingRef` 는 읽기만. 부작용 없음.

**변이 직접 재현(미러 적용→FAIL 확인→원복)**: M1(useLayoutEffect→useEffect) #43·44 · M2(해제가 이관 안 부름) #45·47·48·49 · M3(identity 검사 밖 이관) #46 · **M4**(takeLeftover 안 비움) #50 · M5(leftover 무관 항상 이관) #45·46·47·49 · M6(녹음 중 즉시 showToast) #42 · M7(notify 로 복귀) #42·50 · **M8**(종료 effect 가 ref 안 비움) #50 — **8건 전부 FAIL(개발자 보고와 일치)**. 원복 후 56/56.

**관찰(이슈 아님, QA 참고)**
1. M4·M8 은 TalkRoom 내부 ref 동작이라 정적 단언(T2f 정규식)으로만 잡히고 T2c·T2e 는 같은 로직의 모델이다. 커밋~cleanup 타이밍은 DOM 없이 재현 불가(Codex `not_reviewed` 와 동일) — QA 는 단위 모델 의존임을 명시.
2. 이론상 틈: 녹음 중 방이 `ready→error` 로만 바뀌면(언마운트 아님) 셸 84 토스트가 녹음 중 뜰 수 있으나 `setLoad('error')` 는 재시도·초기 로드 경로(녹음 시작 전)라 실사용 경로 없음. stale 토큰이 새 claim 에 밀리면 옛 방의 미룬 알림은 버려지지만(T2b 의도) React 는 삭제 cleanup 을 새 마운트 layout 보다 먼저 실행해 정상 경로에서 발생하지 않는다.

```json
{ "reviewId": "REV-101", "status": "PASS", "issues": [],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "high_risk_areas": [
    "REV-097~101 통합: 회화방 표시 설정(히라가나·한글·번역) 저장 실패 알림 정확히 1개 — 맡은 방(136/84)·셸(84)·해제 뒤 늦은 실패·방 비ready/언마운트 직후 실패(layout effect 동기 해제, 단위 모델 의존·실기기 재현 어려움)",
    "녹음 중 저장 실패 → 값 즉시 복원·알림은 화면·스크린리더 모두 미룸 → 손 뗀 뒤 1회, 녹음 중 모드·재생 안내(notify)가 와도 실패 알림 유지·여러 번 실패해도 1회",
    "녹음 중 실패 후 방 이탈/언마운트 → 셸 1회(중복·0 없음), 녹음 중 셸 즉시 폴백 없음(§15-10 C)",
    "성공 토스트 정리(clearFreshSuccessToast: 맡은 방이면 생략)와 실패 알림 겹침·순서 — 앞 REV-097 L-1",
    "REV-098·099 1단계: 장음 뒤 조사 へ 한글 읽기(particleBoundary 픽스처)·한글 읽기 서버 조각 주석 클라이언트(AnnotationClient 단일 flush·429 중복 방지·재시도 backoff)",
    "표시 설정 GET·PUT 10초 상한·낙관 반영→실패 되돌림·옛 readingDefault 1회 이관 — 회귀 확인 필요",
    "내 말 번역(#32t) 오류→칸 문구 매핑(409 reason 분기·429·400/404·그 밖) — REV-094 L-2",
    "360/390/412px 세 폭 토스트 자리(136 음성/84 글자)·가로 스크롤 0 — 화면 구조 불변이나 실측 필요",
    "회화 음성 경로(STT·TTS·턴) 비접촉 확인 — 실기기 회화 1턴 스모크" ],
  "native_change": false }
```
- **다음**: QA 인계(변이 8건 입증·전체 회귀 1395/1395). Sonnet 반려 이력 없음. 커밋·배포는 Leader 지시.

## QA 기록 (task-030, 2026-10-04 22:31~23:20 실측)
- **판정: PASS (Critical 0 · High 0 · Medium 0 · Low 결함 1 · 관찰 3)** — 코드·prisma·speech 수정 0. 이전 Developer·Reviewer 수치는 인용하지 않고 이번에 직접 실행. 데모 게이트 `check.mjs check` → `status: approved · approved_version: v1 · hash: verified`(승인 데모 v1 = 가이드 §15-10 = 이번 비교 기준). Low 1건이 있어 deployer 직접 인계는 하지 않고 Leader 판단.
- **환경**: 미러 `~/.node-local/thekaiwa-dev-030`(NFS src·tests rsync, `diff -rq` 동일) `next dev -H 127.0.0.1 -p 3023`(접속 `http://localhost:3023`) · 비교 기준(HEAD `a130443`)은 `git archive HEAD src` 로 만든 별도 미러 `next dev -p 3024` · dev gateway = dev venv uvicorn 127.0.0.1:8197(`SPEECH_GATEWAY_URL` 덮어씀, 운영 3010·8100·pm2 미접촉) · 쿠키 `QA_ACCOUNT=1` · 실패 주입은 전부 `page.route`(PUT /settings/profile 500, 방 GET 지연·500, ticket 무응답) → 표시 설정 DB 값은 `true/true/false` 에서 시작해 중간에 번역·층 끔 시험으로 바꿨다가 **원래 값 `true/true/false` 로 복구**(삭제 후 DB 재조회 확인).
- **QA 시각 검증 재현 조건**: Google Chrome(/usr/bin/google-chrome, headless, playwright-core) · viewport 360×892·390×892·412×892, deviceScaleFactor 2.625, isMobile+hasTouch · locale ko-KR · timezone Asia/Seoul · 라이트 · 일반 모션 · 시스템 글꼴, `networkidle`+2.2~3초 대기 후 측정 · 가짜 마이크(`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, 마이크 권한 허용) · 네트워크 fixture = 기본 실 dev 서버·실 gateway, 장애·실패 시험만 `page.route` · 캡처 = 상태별(viewport 단위) · Next dev 오버레이 숨김 · 허용 범위 = 레이아웃은 px 측정치로 판정(스크린샷 픽셀 비교는 알약 줄만, 임계 8/255). 스크린샷 28장은 scratchpad `qa030/shots/`(프로젝트 밖).
- **시드(QA 계정 전용)**: 채팅 3방(`QA030 talk`·`QA030 chat`·`QA030 corr`, 메시지 28·교정 1·제안 1) — 종료 시 정확한 id 로 삭제: 삭제 전 `{"chats":3,"messages":28,"corrections":1,"proposals":1,"traces":0}` → 삭제 후 전부 0, `titleQA030` 0, QA1 기존 채팅 3개·프로필 `true/true/false` 불변.

### 항목별 판정
| # | 항목 | 판정 | 실행·원 출력·측정 |
|---|---|---|---|
| 1 | 한글 줄(조사 へ·を·は·で) | **PASS** | `h1.mjs`(채팅·회화방 실 gateway, 말풍선 `p[lang=ko]`): `先生へ行きます。`→`[센세-에 이끼마스.]` · `家へ帰る。`→`[이에에 카에루.]` · `学校を休む。`→`[각꼬-오 야스무.]` · `東京は大きい。`→`[토-꾜-와 오-끼-.]` · `駅で会う。`→`[에끼데 아우.]` · `コーヒーを飲みます。`→`[코-히-오 노미마스.]` · 사용자 말 `今日は先生へ行きました。`→`[쿄-와 센세-에 이끼마시따.]`. 12줄 전부 기대와 일치, DOM(`page.content()`) 에 ヲ·ヱ **0**. 공개 `POST /api/v1/text/annotate`(8문장, `api1.mjs`) 응답 raw 2403바이트 `hasヲ false hasヱ false`, 조사 へ 조각 `{"surface":"へ","pron":"エ"}`·を `オ` 그대로. 히라가나(rt)는 `せんせい|い|きょう…` 정상. 참고: HEAD 미러의 같은 입력은 구 코드 `센세--`(대조용, 이 항목 판정 아님). |
| 2 | 토글 hit 44·알약 32·겉모양 | **PASS(경계값 주석)** | `h2e.mjs`(elementFromPoint 0.01px 스캔, 3토글×3폭): **NEW `55.02..99.01 = 43.99`**(360·390·412 동일), **HEAD `55.52..98.49 = 42.97`** → +1.02. 알약 `pill 62..94 = 32`(HEAD 61.5..93.5 = 32) 불변, 바 높이 44·`border-bottom 0px`(HEAD 1px)·`box-shadow` 안쪽 선. **겉모양**: 바 영역(클립 `y=g.y-2`, 높이 `g.height+6`) NEW vs HEAD 픽셀 비교 `h2.mjs`+sharp — 360 `0px of 123795`, 390 `0px of 134144`, 412 `0px of 141742`가 임계(8/255) 초과, 채널 최대차 7·5·5(안티앨리어싱) → **겉모양 동일**. 가로 스크롤 0·넘침 0·바 `scrollW==clientW`. 단어장 도구 줄 토글 `153.02..197.99 = 44.97`(HEAD 42.97, 가이드 46 대비 1px 짧음 — 아래 관찰 O-2). ⚠ 정수 프로브 방식(`TOUCH`, 이전 QA 와 같은 방법)은 NEW 표시 바 `eh 43`·HEAD `eh 41`로 나온다 — 같은 함수로 정확히 44px 인 보정 버튼을 심어 재 보니 `44→44, 48→48, 43→43`(`h2d.mjs`)이라 함수는 정확하고, 실제 hit 창이 레이아웃 박스(56..100) 대비 약 −0.95px 어긋나 있다(위 스캔 55.02..99.01) 때문에 정수 프로브가 1칸 덜 잡는다. 높이 자체는 바 높이 44 가 상한이라 43.99 = 사실상 44. |
| 3 | 내 말풍선 높이(번역 켬/끔)·선생님·카드 | **PASS** | `h3.mjs`·`h3b.mjs`(annotate 3.5초 지연, 390×892, 번역 켬·끔 서버값 PUT 후 시험·복구). **내 말풍선(채팅·회화)**: 번역 켬 NEW `116.69→118.69 = +2.00`(HEAD `113.19→118.69 = +5.50`) · 번역 끔 NEW `77.19→79.19 = +2.00`(HEAD +1.50) · 가나만 있는 말 `+0`(HEAD +3.5) — 전부 ≤4, 완료 높이는 NEW=HEAD(118.69·79.19). 교정 카드 있는 방(`corr`) 내 말풍선도 켬 `+2.00`/끔 `+2.00`(HEAD +5.50/+1.50). **선생님 말풍선** NEW `+1.5`×6 = HEAD `+1.5`×6, 한글이 2줄로 감기는 문장 `+21`(NEW=HEAD) · **교정 카드·제안 카드** `[+21, +1.5]` NEW=HEAD 동일 → 회귀 0. |
| 4 | 저장 실패 알림 정확히 1개 | **PASS**(×3폭) | `h4.mjs`(360·390·412 각각, 표본 80ms, 보이는 `[role=status]` 알림 수·bottom·나타난 횟수): <br>**S1 회화 음성 모드**: `maxVisible 1, appearances 1, bottoms 136`(toast y 713~756), 2.2초 뒤 사라짐(`+1564ms -3764ms`), 스위치 `true→false→true`(되돌림), 상태 줄(786~806)·PTT(812~884)·키보드 버튼 겹침 면적 **0**. <br>**S2 글자 모드** `bottom 84`(765~808), 입력창(816~) 겹침 0, 1개. <br>**S3 다른 화면 단어장·S3b 설정** `bottom 84` 각 1개. <br>**S4 로드 중 화면**(방 GET 9.5초 지연, 단어장에서 PUT 5초 뒤 실패, SPA 이동): 실패 시점 화면 텍스트 `유 유우 불러오는 중…`·표시 바 없음 → **셸 84, 1개**(`appearances 1`), 방 로드 끝난 뒤 추가 알림 0(12초 관찰). <br>**S5 오류 화면**(방 GET 500): 텍스트 `회화를 불러오지 못했어요. 다시 시도`·바 없음 → **셸 84, 1개**. <br>**S6 방 이탈 뒤 늦은 실패**(PUT 4초 지연, 0.6초 뒤 `/study/ai` 로 이동): **셸 84, 1개**. <br>**S7 녹음 중 실패**(PTT 마우스 누름 유지, `aria-pressed=true`, 스위치 클릭 뒤 PUT 1.5초 실패 + 녹음 중 DOM 클릭으로 추가 실패 PUT 1건): 스위치 `클릭 직후 false → 녹음 중 true`(즉시 복원), **녹음 중 구간 `maxVisible 0, maxLiveText 0`(화면·live region 모두 0)**, 손 뗀 뒤 **`appearances 1`, `bottom 136`, 2.2초**. `h4b.mjs` 대조: 녹음 중 `다시 듣기`·`글자로 입력하기`(=다른 안내 `말하는 중에는 …`) 누른 뒤 놓으면 실패 문구가 남는다(`replay+fail`·`keyboard+fail` 모두 `["표시 설정을 저장하지 못했어요. 다시 눌러 주세요","온라인"]`), 실패 없이 다른 안내만 있을 땐 `["말하는 중에는 들을 수 없어요"]` — 다른 안내가 와도 실패 알림 유지(2건 모두). <br>**S8 녹음 중 실패 후 방 이탈**: 이탈 직전 live 문구 0, 이탈 뒤 **셸 84 1회**(`appearances 1`). 헤드리스 녹음 모사 = 가짜 마이크+ticket 무응답으로 `aria-pressed=true` 상태 유지(실제 마이크 입력·인식은 아님). |
| 5 | 분석 429 재시도·층 끔·읽기 지연 | **PASS** | `h5.mjs`(항상 429, 응답 1.2초 지연): 초기 로드 직후 **겹침 유발**(한글 OFF→ON ×3 + visibilitychange·online) → 호출 `["0.5"]`(1회, 35초 안 재시도 0) · 35초 뒤 wake → `["0.5","39.1"]` · 직후 겹침 이벤트 호출 2 그대로 · 다시 35초 뒤 → `["0.5","39.1","78.9"]`(**최초 포함 3회**) · 4번째 기회(t=122s) 3회에서 정지 · 40초 무조작 3 유지(폴링 0). **층 끔**: 둘 다 끔 → 채팅·회화·회화(교정)·단어장 `annotate 요청 0`, `ruby/ko 0` · 히라가나만 켬 → 채팅 요청 1·`rt 21`·`ko 0`. 이후 프로필 `true/true/false` 복구 확인. **읽기 체감**(`h6.mjs` 4회씩, 실 gateway): 채팅 첫 히라가나·한글 12줄 중앙값 NEW **490ms** / HEAD 479ms, 회화 NEW **492ms** / HEAD 570ms, 요청 1회(12문장) 동일 — 직렬화로 늘어난 지연 없음. |
| 6 | 가로 스크롤·금지어 | **PASS** | `h7.mjs`(3폭 × 채팅·회화·회화(교정)·단어장·설정·목록): `hScroll false · over 0 · pageV false` 전부, 화면 글자·마크업 금지어(`reazon|whisper|style-bert|sherpa|model_id|speaker_id|claude|gateway|127.0.0.1|openjtalk|후리가나`) **0/0**, console error·warning 0(3폭). |
| 7 | 성공 경로 회귀 | **PASS** | `h9.mjs` 실 PUT: 토글 성공 시 토스트 `한글 발음을 숨겼어요 · 모든 화면에 적용돼요` 1종, 실패 문구 0, 서버 `true/false/false` → 원복 `true/true/false`. |
| 자동 | tsc·eslint·테스트 | **PASS** | 미러 `tsc --noEmit --incremental false` exit 0 · `eslint src/components src/modules/speech` `0 errors, 5 warnings`(기존 set-state-in-effect 5) · `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` **`# tests 1395 · # pass 1392 · # fail 0 · # skipped 3`** |

### 결함·관찰 (재현·기대·실제)
- **[결함 #1] [Low]** `src/components/common/japanese/displayPrefs.ts`(`clearFreshSuccessToast`) · `TalkRoom.tsx` 맡기 경로 / 재현: 회화방(음성 모드)에서 표시 스위치를 누르고(성공 토스트 "…모든 화면에 적용돼요" 즉시 표시) 곧바로 PTT 를 누른 채(녹음 중) PUT 이 1.2초 뒤 실패하게 한다(`h4b.mjs` replay+fail 변형, 390) / 실제: 값은 1.2초에 복원되는데 **성공 토스트가 원래 수명(2.6초)까지 약 1.4초 더 남아** 녹음 중 `"한글 발음을 숨겼어요 · 모든 화면에 적용돼요"`가 보인다(실패는 미룸). 녹음 중이 아니면 실패 문구가 즉시 덮는다 · 기대: 실패가 확정되면 거짓 "적용돼요" 가 남지 않는 것(task-030 이전은 `onToast('',0)`로 즉시 지웠음) / 원인 추정: §15-10 C 의 "맡았으면 `onToast('',0)` 안 부름 — 실패 문구가 자연히 덮음"이 녹음 중(실패 문구 미룸)에는 덮어 줄 문구가 없어 성공 토스트가 만료까지 남는다. 영향: 표시 설정을 누른 직후 1~2초 안에 말하기 시작하고 PUT 이 실패하는 드문 경합 — 화면 문구가 약 1초 틀릴 뿐 값·알림 횟수는 정확.
- 관찰 O-1: 표시 바 hit 창이 레이아웃 박스보다 위로 약 0.95px 어긋나 측정됨(55.02..99.01 vs 박스 56..100, HEAD 도 55.52..98.49) — 모바일 에뮬레이션 서브픽셀 위치 때문으로 보이며 높이는 43.99. 실기기 확인 대상(아래).
- 관찰 O-2: 단어장 도구 줄 토글 hit 44.97(가이드 §15-6 #1 "46"). 아래 1px 이 다음 요소 겹침으로 잘린 값, ≥44 충족이라 결함 아님.
- 관찰 O-3: 방 로드 중·오류 화면의 셸 알림은 방 토스트 위치와 무관하게 84(가이드 §15-10 C 표대로).

### NOT_VERIFIED(육안·실기기 필요)
실제 마이크 녹음(헤드리스는 가짜 마이크+ticket 무응답으로 `aria-pressed=true` 상태만 모사) 중 스크린리더(TalkBack) 낭독 혼입·알림 낭독 지연 · S25+/앱 WebView ≈390 실화면 터치 감(표시 바 토글 실제 손가락 44px) · 실제 `isMobile` 서브픽셀(O-1) · APK(네이티브 변경 0, `native_change:false`) · 5초 예산·30턴 p50/p95·단어 세트 소요(이번 task 대상 아님 — 화면·한글 규칙 보정) · 실 STT/TTS 회화 1턴 스모크(REV-101 high_risk "회화 음성 경로 비접촉" — 코드상 비접촉, 실기기 1턴 권장).

### 정리
- 프로세스 정리: dev 앱 3023·HEAD 비교 앱 3024·dev gateway 8197 종료 → `ss -ltn` 3023·3024·8197 listener 0(운영 3010·8100 은 내 것이 아니며 그대로) · 쿠키 `c1`·미러 `.env` 2개 shred(`ls` 없음 확인) · 내가 만든 HEAD 비교 미러 `thekaiwa-qa030-head`·`thekaiwa-dev-030/scratch/qa030` 삭제(`ls -d ~/.node-local/thekaiwa*` 에 없음) · 기존 미러 `thekaiwa-dev-030` 은 보존(개발자 것).
- 산출물: 스크린샷 28장은 사용자 요청 경로 `…/scratchpad/qa030/shots/`(프로젝트 밖)에 남김, 측정 스크립트 `…/scratchpad/qa030/h*.mjs`.

```json
{ "taskId": "task-030", "status": "DONE", "deliverables": ["agent-vault/10-Flow/tasks/task-030-japanese-display-followup.md (QA 기록 task-030)"], "blockers": [], "risk_level": "LOW", "metrics": { "talk_p50_ms": null, "talk_p95_ms": null, "vocab_set_sec": null, "note": "화면·한글 규칙 보정 묶음 — 30턴·단어 세트 지표 범위 밖 NOT_VERIFIED. 참고: 채팅 첫 읽기 중앙값 NEW 490ms/HEAD 479ms, 회화 NEW 492ms/HEAD 570ms" } }
```

## Leader 기록 (QA PASS 수용·배포, 2026-10-04 22:57)
- QA PASS 수용. QA-#1 Low(스위치 직후 녹음 시작 + PUT 실패 → 값 복원되지만 성공 토스트 ~1.4초 잔존, §15-10 C 의 "맡았으면 onToast('',0) 안 부름" 부작용)는 비차단 — 후속 후보. 관찰(hit 창 −0.95px, 단어장 도구 줄 44.97)은 조치 불요.
- 1·2단계 한 커밋으로 배포. 웹만(native_change false).

## 최종 요약 (Leader, 2026-10-04 23:10)

**무엇이 바뀌었나** — task-026(일본어 표시) 뒤에 남은 작은 문제를 정리했습니다.
- 한글 발음: 장음 뒤 조사 へ 가 이제 따로 읽힙니다(`先生へ` → 센세-에, `家へ` → 이에에). を·は·に·で 도 실측 문장으로 확인했습니다.
- 히라가나·한글·번역 토글 버튼의 누르는 영역이 44px 이 됐습니다(겉모양 그대로).
- 번역을 켠 상태에서 내 말풍선이 한글·번역 도착 때 늘어나는 폭이 +5.5px → +2px 로 줄었습니다.
- 표시 설정 저장 실패 알림: 회화방에서는 방이 직접 띄웁니다(음성 모드 136px 로 마이크 바와 안 겹침, 녹음 중에는 손 뗀 뒤 1번). 방을 나가거나 방이 아직 준비되지 않았으면 앱 아래쪽에 1번 뜹니다.
- 읽기 분석 요청을 한 번에 하나씩 보내 재시도 횟수가 겹쳐 줄어드는 문제를 없앴습니다(첫 화면 읽기 지연 변화 없음).

**배포** — `4ce98e4`(릴리스 `20261004-225727-4ce98e44`). 운영 스모크 채팅 42/42·회화 45/45, 운영 읽기 분석 응답에 내부 표식 노출 0, 주요 화면 200. 웹 배포만.

**검증 경로** — judge(R2·standard·sonnet·데모 delta) → 데모 v1 사용자 승인 → 1단계 REV-098 → 2단계 REV-099·099b → Codex C2(concurrency) 2건 → REV-100 채택 → REV-101 → QA PASS.

**후속(배포 차단 아님)**
1. QA-#1: 스위치 직후 녹음 시작 + 저장 실패 시 "저장됨" 안내가 ~1.4초 남음.
2. REV-098 L-2: `経営` → 케--(관행 케-에-) — 단어 내부 같은 모음 연속 장음 처리.
3. task-026 이월: 범위 밖 일본어 화면(AI 평가·카드 뒷면·복습 카드) 표시 적용(데모 필요), 구 `reading`/`replyReading` 필드 제거, 관리자 발음 사전 → 분석기(青か·愚か·密か), REV-093 LOW, 서버 이상 응답 시 조각 영구 loading(REV-099 L-3).
