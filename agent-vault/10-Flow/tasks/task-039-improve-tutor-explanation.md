---
task_id: task-039
title: "강사 응답·교정: 일상회화 문법·단어 중심 + JLPT 식 추가 설명 칸 (IMP-0025, 방안 B)"
status: in_progress
base_ref: 5c3a701
risk_level: "R2"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-028-talk-translation-explanation, task-010c-correction-mode, task-006-chat-correction, task-036-remove-llm-reading-fields, task-037-json-slip-repair]
imp: [IMP-0025]
tags:
  - type/task
  - domain/improvement
  - domain/conversation
aliases:
  - 강사 응답 일상회화 우선
  - 추가 설명 칸
  - task-039
created: 2026-10-06
updated: 2026-10-06
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-039-improve-tutor-explanation-v1.html"
  artifact_url: "https://claude.ai/artifact/Pe9SAjkHevZvsEgvUte4a6"
  content_sha256: "212d9e93b2aeed79e95e01bd1078e7e3a3a69c04849ddba901077b0940c39f77"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-06T15:20:05+09:00"
  approval_quote: "승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
개선 항목 [[IMP-0025-강사-일상회화-우선-jlpt-추가설명]](P2, `/개선작업 착수` 2026-10-06 — 사용자 결정 **방안 B**):

> AI강사가 응답하거나 교정해 줄때는 일상회화에서 주로 사용하는 문법이나 단어를 메인으로 알려주고 JLPT와 같은 문법적인 표현들은 추가 설명으로 알려줬으면 좋겠어. (사용자 원문)

**하는 것(방안 B)**: ① **규칙**: 페르소나·프롬프트에 "일상회화에서 실제로 쓰는 문법·단어가 메인, JLPT 식 문법 표현(급수·문형·시험 대비 설명)은 추가 설명으로" 를 넣는다(TALK 은 페르소나 §2 를 싣지 않으므로 반영 위치를 §1 또는 §3 으로 잡는다) ② **응답 계약**에 "추가 설명" 칸을 additive 로 더한다 ③ **교정 카드**(그리고 문법 칩이 있는 말풍선)에 **접이식 "추가 설명" 줄**을 둔다 ④ 라이브 샘플로 효과·비용(지연·토큰)을 측정한다.

## 설계 방침 (Leader — 팀이 실측으로 확정, 단 계약 이름은 아래로 통일)
- **새 응답 칸**: `correction.extraNoteKo`(string | null, **nullable·선택**, 한국어, 길이 상한은 PE 가 측정으로 확정 — 초안 ≤160자) — "JLPT·교과서식 문법/문형 설명·시험 대비 정보". **없으면 null**(출력 토큰 증가를 필요할 때만으로 제한). 메인 `explanationKo`(교정 이유)와 `learning.grammarPoint` 는 **일상회화에서 실제로 쓰는 말** 기준으로 쓰게 한다. 레슨 A4 문법 단계·표현 점검 A3·AI 평가 설명에도 같은 원칙을 적용할지는 PE 가 범위를 제안(TALK·CHAT·A3 우선, A4 는 문구만).
- **저장**: 교정은 `Correction` 행으로 저장된다(`explanation` 컬럼 1개) — 선택지 ① **새 nullable 컬럼 `Correction.extraNoteKo`**(권고) ② `explanation` 에 합쳐 저장(스키마 무변경이지만 분리 표시 불가). **DB 스키마 변경(`db push`)은 사용자 승인 사항** — 컬럼이 확정되면 **승인 요청 → 백업 → `db push` → 코드 활성화** 순서를 따르고, 승인 전에는 그 컬럼을 읽고 쓰는 코드를 운영에 활성화하지 않는다(개발·운영이 같은 MariaDB, 환경 분리 컬럼 없음 — additive nullable 이라 하위 호환).
- **화면**: 교정 카드(`CorrectionCard.tsx:92`)에 접이식 "추가 설명(시험 문법)" 줄 — 기본 접힘, 일본어 표시 설정(후리가나·한글)과 일관, 360/390/412 폭·터치 44px. 말풍선 문법 칩(`MessageBubble.tsx:232-249`·`TalkTutorBubble.tsx`)의 표시 방식은 designer 가 delta 데모에서 제안. **화면 변경이 있으므로 judge 가 데모 수준을 판정하고(예상 delta), 데모 → 사용자 승인 뒤에만 화면 코드를 쓴다**(데모 검토 게이트).
- **예산**: TALK 5초 예산·`done` 지연 비악화(출력 토큰 증가를 `extraNoteKo` null 허용·길이 상한으로 억제), A1 프롬프트 ≤3,000자 마진(`WINDOW_ROOM_SLACK`)·TALK 페르소나 한도 2,800자(여유 약 250자 — `persona.test.ts:20`), ajv 1차 통과율·교정 검출률(16/16·오탐 0/4)·`repairRootClose`(task-037) 와의 호환(키 순서 `… correction → learning → …` 안에서 새 키 위치 — 조기 추출 `speech.style`→`replyJa` 앞 순서 불변).
- **버전**: `talk@v8→v9`, `chat@v3→v4`(CHAT 은 교정 없음 — 규칙 문구만이면 불변 가능), `chatReview@v1→v2`, 필요 시 `lesson@v8→v9`. 프롬프트 키 버전은 코드 상수로 릴리스에 실려 간다(Registry sync 명령 없음 — task-036 PE 조사).

## 예상 변경 경로
- 페르소나·프롬프트: `.claude/agents/tutor.md`(§1 또는 §3 규칙 1줄), `src/modules/conversation/prompts/{talk,chat,chatReview,lesson}.ts`(문구·키 순서·골격·버전)
- 계약·서버: `structuredResponse/schemas.ts`(`correction.extraNoteKo`)·`checks.ts`·`TutorCorrection` 타입·`orchestrator/index.ts`(교정 행 저장)·`chats/**`(교정 DTO)·`learning/repetition/index.ts:27`(교정 → 복습 입력, 필요 시)
- DB: `prisma/schema.prisma` `Correction.extraNoteKo String? @db.VarChar(…)`(**사용자 승인 후**)
- 화면: `src/components/chat/CorrectionCard.tsx`(접이식 줄)·`MessageBubble.tsx`·`TalkTutorBubble.tsx`·`src/types/chat.ts`·`messages.ts`(교정 DTO)
- 테스트: `persona.test.ts`·`prompts.test.ts`·`task028.test.ts`("문법 용어는 쓰지 않습니다" 단언 갱신)·`structuredResponse.test.ts`·`task010c.test.ts`·`task006.test.ts`·화면 테스트
- 문서: `docs/design/api-contract.md`·`domain-model.md`(Correction)·`docs/screens.md`(교정 카드 — designer)
- 라이브 측정: `tests/live/talk-correction-mode-measure.ts`·`chat-review-measure.ts`·`lesson-measure.ts` 응용(설명 품질 판정 기준 추가)

## 완료 기준 (QA 가 실행으로 확인)
1. **규칙 반영**: 교정·응답 샘플(수준 N5~N3 · 일상 표현 오류 · 시험식 문형이 걸린 오류 각 n≥20)에서 **메인(`explanationKo`·`grammarPoint`)이 일상회화에서 실제로 쓰는 문법·단어 중심**이고 JLPT 급수·문형 용어·시험 대비 설명은 `extraNoteKo` 로 가는 비율을 규칙 기반 판정(키워드·급수 표기)+샘플 눈 판정으로 보고(기준선 talk@v8 대비 개선).
2. **계약 안전**: `extraNoteKo` 가 지시·골격·스키마·타입·테스트에 일치(A5·A11 교훈), null 허용·길이 상한, 옛 키·모르는 필드 처리(`additionalProperties:false`), ajv 1차 통과율 **비하락**(talk@v8 기준선), 교정 검출률 **16/16·오탐 0/4 유지**, 지연 p50 **비악화(≤ +10% 이내)**·TALK `done`·첫 음성 비악화(`task007-latency`), 슬립 복구(task-037) 호환.
3. **저장·표시**: 새 교정 행에 `extraNoteKo` 저장(컬럼 승인·적용 뒤)·옛 행(`null`) 정상 표시·교정 `original` 불변·제안→채택 원칙 유지·접이식 줄 키보드·스크린리더·360/390/412·`reduced-motion`.
4. 운영 스모크(`SMOKE_ENV=PRODUCTION`) 006·007 유지, 새 필드가 로그·Trace·Export 에 학습자 원문을 새로 싣지 않음. APK 재설치 불필요(웹 변경).

## 관련 과거 이력 요약
- [[task-028-talk-translation-explanation]]: 교정 설명 수준별 쉬운 한국어(N5·N4 문법 용어 금지) — `talk@v6`.
- [[task-010c-correction-mode]]: 교정 방식(유창성 기본·코치 힌트) — `[교정]` 줄이 단일 출처, 헤더에 교정 모드 칸 없음.
- [[task-036-remove-llm-reading-fields]]·[[task-037-json-slip-repair]]: 응답 계약 슬림화·JSON 슬립 복구 옵트인 — 새 키가 슬립 위험/예산에 미치는 영향 측정 필요(PE 측정 방식 `tests/live/task036-reading-ab.ts` 재사용).
- 재확인 조사(2026-10-06 Explore): IMP-0025 분류 메모 참고(문구 위치·예산 여유 250자·영향 테스트 목록).
- 승인된 교훈: 없음(`/이슈기록 관련` 0건 — 착수 시 한 번 더 조회).

## Judge 판정

- [2026-10-06 14:50] intake (Leader 가 `judge.mjs --input /tmp/judge-task-039-intake.json` 직접 실행 ×2 — 같은 결과, `/tmp/judge-task-039-intake.result1.json`, `judge-result@2`·engine=jev·fallback 없음, `origin:"improvement"` + 예상 변경 경로 전달) → task_type=**feature** · complexity=2.22~2.24 · risk=**R2**(`R2-migration,R2-kw-secret` — 요약의 "컬럼 추가 가능성"·스키마 경로) · developer_model=**opus** · track=**standard**(`track_blockers`: risk_r2·r2_path·needs_info) · demo=**delta**(`JV-ui_change`, `partial_restructure` 0.81) · **next=`ask_user`**(`needs_info` noul 0.63, blocking_gate=requirements) · roles=designer·prompt-engineer?·developer·reviewer·qa.
- **Leader 덮어쓰기(`ask_user` → 데모 우선)**: `needs_info` 는 규칙이 아니라 모델 신호다. 사용자가 방안 B 를 결정했고 이력서가 새 칸 이름(`correction.extraNoteKo`)·예산·검증 기준을 이미 닫았으며, 남은 세부(저장 방식=새 nullable 컬럼 vs 합쳐 저장·추가 설명 범위·접이식 줄 위치)는 **delta 데모 검토 단계에서 사용자에게 보여 주고 결정**한다. DB 컬럼은 **데모 승인 뒤 별도 승인 요청**(승인 전엔 그 컬럼을 읽고 쓰는 코드를 운영에 활성화하지 않음). `check.mjs init` → `drafting`·`delta`·`JV-ui_change`. R2 라벨 그대로(마이그레이션·`Correction` 불변 원칙 근처) — C1·C2 Codex 판정 대상(한도 미기록이어도 R2 는 개입 가능).
- 실호출모델: developer=opus(judge 값, r2_path), PE=sonnet, designer=opus.
- [2026-10-06 18:35] codex_gate/C1 engine=jev (Leader 가 `judge.mjs --input /tmp/judge-task-039-c1.json` 직접 실행) → **codex_required=true · mode=adversarial-review · focus=data_integrity** · budget_rule=CX-limit-unknown-r2(한도 미기록 — R2 만 개입) · codex_calls_used=0 · codex_switch=on | overrides=- | fallback=- | tokens=884. 다음: codex 에이전트가 읽기 전용 검토(C1) → 채택분은 설계(`### Developer 인계`)에 반영 → developer.

## Leader 기록 (데모 승인, 2026-10-06 15:20)

- **사용자 승인**: delta 데모 v1(`docs/demo/task-039-improve-tutor-explanation-v1.html`, sha256 `212d9e93…`, Artifact https://claude.ai/artifact/Pe9SAjkHevZvsEgvUte4a6) — 원문 "승인" 을 `check.mjs approve` 로 기록(`approved_by: user`, 15:20:05+09:00). 당시 승인 대기 항목이 이 데모 하나뿐이어서 이 데모 승인으로 해석했다.
- **결정 칸 D1~D4**: 사용자가 바꾼 말씀이 없어 **권고안 A 로 기록**(데모 기본값과 동일) — D1 추가 설명은 **교정 카드 안에만**(문법 칩 시트·선생님 말 쪽 새 응답 칸은 이번 범위 밖 → judge 재판정 불필요) · D2 **늘 접힘** · D3 줄 이름 **'시험 문법 더 보기'**(펼치면 '시험 문법 접기') · D4 회화방에도 **같은 줄을 접힌 채로** 표시. 이후 사용자가 다른 안을 원하면 새 버전(v2)로 간다.
- **DB 컬럼은 데모 승인에 포함되지 않았고 별도로 확인받았다 → ✅ 사용자 승인(2026-10-06, AskUserQuestion "새 칼럼 추가 승인")**: `Correction.extraNoteKo String? @db.VarChar(400)`(nullable·additive — 옛 행 NULL·기존 열·데이터 무변경, 개발·운영 같은 MariaDB 라 `db push` 1회로 두 환경 적용, 하위 호환). **순서: 승인(완료) → developer 가 스키마·코드·단위 테스트 작성(`prisma generate` 만, DB 접속 변경 없음) → Reviewer PASS 뒤 Leader 가 백업(`files/thekaiwa/backups/…-pre-task039.sql.gz`) → 미러에서 `prisma db push` → QA 라이브 검증 → 코드 배포(webhook, 컬럼이 이미 있으므로 안전).** 승인 범위는 이 컬럼 1개뿐이다(다른 컬럼·표 추가 불가).
- 이후: PE 결과(`pe-039`) 확인 → developer(opus, judge R2) 구현(orchestrator 저장·교정 DTO·화면 접이식 줄) → reviewer → [judge C2 → Codex?] → QA(라이브 포함·3폭) → deployer.

## Leader 기록 (PE 결과 판정, 2026-10-06 16:40)

pe-039b 보고(최종 A/B·계약 안전 판정·Developer 인계)를 받아 아래를 정한다. 데모 승인(D1~D4=A)·DB 컬럼 1개 승인 범위는 그대로이고, 아래 결정은 모두 그 범위 안이다.

- **① A3 `extra_note_ko` 추가 = 예(결정)**: 승인된 데모의 표현 점검 카드(`#rv`)가 줄을 그리므로 A3 응답에도 같은 칸이 있어야 데모 그대로 구현된다. 새 DB 컬럼 없음(같은 `Correction.extraNoteKo`), 사용자 확인이 필요한 범위 축소가 아니다. → PE 가 chatReview@v3(스키마 1줄·지시 1줄·테스트·A3 3~5회 측정)를 한다. developer 는 그 뒤 `review/filter.ts`·`review/index.ts`·`ReviewItemDto` 에서 전달·저장.
- **② TALK "조각" 언급 감소(63→46%, p=0.09) = 이번엔 튜닝하지 않는다(결정)**: A1 요청 천장 마진이 9자라 문구를 더하려면 다른 문구와 맞바꿔야 하고, 화면이 조각 칩을 따로 그리므로 학습자 손실은 작다고 PE 가 본다(눈 판정 아님 — `[추측]`). **감시 항목으로 둔다**: Reviewer 가 persona §3-5 와의 정합을, QA 가 운영 스모크 표본에서 조각 언급 비율을 다시 본다. 기준선 대비 30%p 이상 떨어지면 후속 튜닝 task.
- **③ `extraNoteKo` 채움률 53%(서버 정리 후 약 47%)·정확도 약 90% = 허용(결정)**: 줄은 기본 접힘(D2)이라 화면 부담이 작다. 일상 문장에서도 34%가 채워져 "대부분 null"은 부분 충족 — 사용자 보고에 그대로 쓴다. 지시를 더 조이는 재측정은 하지 않는다(이득 대비 천장 마진 소진).
- **④ 사용자에게 정직하게 알릴 것**: TALK 메인 설명 본문의 JLPT 어휘 감소는 **입증하지 못했다**(14% vs 16%, 기준선이 이미 낮았다). 측정으로 입증된 것은 ⓐ grammarPoint 의 쓰임 이름화(31→13%, p=0.028·CHAT 50→8%) ⓑ A3 JLPT 식 42→7% ⓒ 추가 설명 칸 분리(시험식 문장 89% vs 일상 34%).
- **다음 순서**: PE(chatReview@v3) → judge C1(R2 — Codex 개입 판정, Codex 연계 on) → developer(opus, judge R2) → Reviewer → [judge C2 → Codex?] → Leader 백업·`prisma db push` → QA(라이브·3폭) → deployer.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-06 14:25 |
| v1 | 검토요청 | docs/demo/task-039-improve-tutor-explanation-v1.html | https://claude.ai/artifact/Pe9SAjkHevZvsEgvUte4a6 | 사용자 검토 요청 | 10-06 14:57 |
| v1 | 승인 | docs/demo/task-039-improve-tutor-explanation-v1.html | https://claude.ai/artifact/Pe9SAjkHevZvsEgvUte4a6 | "승인" | 10-06 15:20 |

## Designer 기록

- [14:55] v1 작성(docs/demo/task-039-improve-tutor-explanation-v1.html, 90,057 B, sha256 212d9e93…) — delta, 토큰 `globals.css@sha256:bf67d6c60da2`(새 색 없음), 맨 위 사용자 결정 4건 + 화면 10개(현재 HEAD vs 제안): 표현 점검 `#rv`(①N5 활용·②N3 문법 긴 설명 160자 컷·③추가 설명 null)·`#rv-open`·`#rv-done`(채택·무시 뒤 줄 유지)·`#rv-old`(옛 교정 = 현재와 같음) / 회화방 `#talk`·`#talk-open`(말하는 중 펼침)·`#talk-coach`(정답 보기 전 줄 없음 → 보기 뒤 접힘)·`#talk-later`(모아 둔 교정 시트) / 문법 칩 `#chip`·`#chip-sheet`. 제안 UI = 설명 바로 아래 접이식 글자 버튼(카드 폭 × 44px, `aria-expanded`·`aria-controls`, ▾/▴) → 펼치면 왼쪽 선 상자 14px ink2, 「」 은 lang=ja 만(히라가나·한글 없음 §15-1 F), 채택·무시 위. 결정(권고 전부 A): **D1** A 교정 카드 안만 / B + 문법 칩 시트(learning 쪽 새 칸 필요 → 범위 확장) · **D2** A 늘 접힘 / B 늘 펼침 · **D3** A ‘시험 문법 더 보기’(펼치면 ‘시험 문법 접기’) / B ‘JLPT 참고’ / C ‘더 알아보기’ · **D4** A 회화방에도 같은 줄 / B 회화방 숨김(회화 교정은 볼 곳 없어짐). 참고 패널: 저장 방식 ① 새 칸(권고) ② 설명에 이어 붙임(다시 열면 한 단락) — 데모 승인 뒤 Leader 가 별도 승인 요청. 개발 메모(`<details>`)에만 계약 이름 `correction.extraNoteKo`·매핑 위치·길이 컷(서버 160자, 화면은 안 자름)·스크롤 따라가기 주의·D1-B 범위.
- [14:55] 검증: `check.mjs lint` **DEMO_LINT_PASSED** · 인라인 스크립트 `node --check` OK · 헤드리스 Chrome(playwright-core) 10화면 × 360/390/412 × 780/892 × 변형 4(기본·결정 B/C 전부·히라가나/한글 끔+다크·번역 켬) = 240 조합 현재·제안 가로 넘침 0 · 접이식 줄·칩 버튼 터치 ≥44px · JS 오류 0 · 외부 요청 0 · 휴대폰 안 엔진명·코드 이름·task 번호 0 · Enter/Space 펼침·접힘 + 포커스 링 · reduced-motion 애니메이션 none · 데모 페이지 390 뷰어 가로 넘침 0. 실측: ② 긴 설명 펼친 상자 360 에서 167px(7줄), 회화방 360×780 에서 펼친 카드가 목록보다 김 → D2-A 근거. 스크린샷·스크립트는 scratchpad 에만.
- [14:55] 디자인 스킬: layout·component(project-ui-system 미적용 — 학습 앱 화면, design-skills §3) / 자체 점검 P0 0·P1 0·P2 3(왼쪽 선 `--line` 이 라이트에서 옅음 — 들여쓰기로 구분 · D3-A 라벨이 펼치면 바뀜(‘접기’) · D1-B 칩 버튼 모양이 교정 칩과 다름 — B 선택 시만), a11y Critical 0·Major 0·Minor 2(표현 점검에 같은 이름 버튼 3개 — `aria-describedby` 선택 권고, 개발 메모 ③ · 라벨 변경 + aria-expanded 이중 안내).

## Prompt-Engineer 기록 (2026-10-06)

- [14:35] **착수 — 계획·호출 수 사전 계산.** 읽은 것: 이력서·IMP-0025 분류 메모·`tutor.md`·`talk.ts`·`chat.ts`·`chatReview.ts`·`lesson.ts`·`schemas.ts`·`checks.ts`·`orchestrator/shape.ts`·`orchestrator/index.ts` 저장부·`repairRootClose.ts`·`task036-reading-ab.ts`. 확인된 사실: ① `shapeTurnResponse` 는 `correction = {...c, original: text}` 로 **모르는/새 필드도 그대로 펼쳐 둔다**(`ShapedTurn.correction`) 하지만 `saveTurnTx` 는 `Correction` 행을 만들 때 필드를 **명시적으로 골라 쓰고**(`explanation: c.explanationKo` …) `done.correction` 은 `saved.correction`(명시 필드)이라 `extraNoteKo` 는 저장·SSE·`toolLog.meta`(learning·style·endOfTopic·warning 만) 어디에도 새로 실리지 않는다 → **스키마에만 있고 서버가 모르는 중간 상태는 안전**(코드 변경 없이 무시됨, 개발 미러 한정). ② `hintKo` 가 `required`(nullable)로 추가된 선례, `userKo` 는 선택(REV-086 M3) — `extraNoteKo` 는 부가 정보라 **선택(required 아님)·null 허용**으로 둬 이 필드 때문에 ajv 재시도·턴 실패가 없게 한다. ③ CHAT 스키마는 `correction:{type:'null'}` 이라 **CHAT 계약은 불변**(추가 칸이 correction 안이라) — CHAT 은 문구만. ④ persona 는 TALK=§1·3·4·6, CHAT=§1·2·4·6, A3=§1~6·8, LESSON=§1·2·4·5·6·8, EVAL_GRADE=§1·3·4·6 → §3 에 한 줄을 더하면 **TALK·A3·EVAL_GRADE** persona 바이트가 바뀐다(A7 은 의미 영향 없음 — 아래에 기록).
- **호출 수 사전 계산(Claude CLI·구독)**: 기준선 TALK 스타일 세트 60(haiku) + A3 3회 + A4 레슨 8회(sonnet, 느림) ≈ 71 · 문구 튜닝 부분 세트 2회전 ≈ 48 · **A/B 본측정**: TALK 스타일 60×2팔 + 교정 검출 20×2팔 = 160, CHAT grammarPoint 24×2팔 = 48 · A3 작업본 3 + A4 작업본 8 ≈ 11 → **합계 ≈ 340 호출**(TALK 은 haiku ≈ 5s → 총 약 40분, 레슨만 sonnet). 429 나오면 즉시 중단, 호출 간격 1.5s.
- [15:55] **중간 기록(완료 / 남은 일 / 다음 첫 행동).** 완료: ① 기준선(HEAD talk@v8·chat@v3·chatReview@v1·lesson@v8) TALK 스타일 60·A3 3회·A4 5회·CHAT 24 ② 규칙·계약 구현(미커밋) — `tutor.md` §3-9 + §6 TALK 행, `talk.ts`(talk@v9)·`chat.ts`(chat@v4)·`chatReview.ts`(chatReview@v2)·`lesson.ts`(lesson@v9)·`schemas.ts`(`correction.extraNoteKo`)·`checks.ts`(`sanitizeExtraNoteKo`) ③ 오프라인 테스트 `task039.test.ts`(신규 17건) + 기존 테스트 갱신, 전체 conversation 442/442·tsc·eslint 통과 ④ 튜닝 4회전(work 팔 60+60+60+30). 남은 일: 최종 A/B(교차) 결과 수집·표 작성, A3·A4 work 팔, 범위 제안·방안 B 비용·분리 기준 문서화, 잔재 정리. 다음 첫 행동: `ab-style.json`·`ab-corr.json`·`w-chat.json` 요약.
- [16:10경] **이어받기(pe-039b) 중간 기록.** 완료: ① 오프라인 재확인 — conversation 442/442 pass·tsc rc=0·eslint rc=0(내가 직접 재실행, 로그 scratchpad `pe039/final-*.log`) ② 최종 A/B 수치를 JSON 에서 직접 재계산(`pe039/final-calc.mts`·`final-calc.out`) — **w4(30)+ab-style work(30)=최종 프롬프트 60문장**임을 per-item promptChars 차이(w3 대비 둘 다 −13자)로 확인했고 w3·w1·w2 는 중간 프롬프트라 제외. ③ A3·A4 작업본 측정(`w-rl.json`) 진행 중. 남은 일: A3·A4 결과 요약 → 표·범위 제안·Developer 인계 절 작성 → git status 확인. 다음 첫 행동: `w-rl.log` 완료 확인 후 `SUMMARIZE_ONLY=base-rl.json,w-rl.json` 요약.

### 최종 A/B 결과 (pe-039b, 16:28) — 수치는 scratchpad `pe039/*.json` 에서 `final-calc.mts` 로 직접 재계산

**표본·방법**: head=HEAD 프롬프트·HEAD tutor.md(talk@v8·chat@v3·chatReview@v1·lesson@v8) / work=작업본. **work 최종 프롬프트 = `ab-style` work 30 + `w4-style` 30(= 60문장, 항목별 1회)** — w4·ab 가 같은 프롬프트임은 항목별 `promptChars` 가 w3 대비 둘 다 정확히 −13자인 것으로 확인했고, w1·w2·w3 는 튜닝 중간 프롬프트라 제외. 스타일 세트 비교는 head `base-style` 60(14:45) vs work 60(15:40~15:53) **항목 매칭·시간 비교차**이고, 교차(번갈아 순차) 표본은 `ab-style` 30+30·`ab-corr` 20+20(지연 판단은 이 교차 표본만 쓴다). CHAT 은 head 24(15:02) vs work 24(16:00) 비교차. 규칙 판정=`tests/live/task039-style-classify.ts`(급수·시험 표지 / 교과서식 강한 용어 / grammarPoint 용어 라벨 — 키워드만 본다, **눈 판정은 아래 별도**). p 값은 Fisher 정확검정(양측).

| 지표 | head | work(최종) | 비고 |
|---|---|---|---|
| (a) TALK 메인 설명 JLPT식(explJlpt) | 9/57 (16%) | 8/57 (14%) | p=1.00 — **개선 입증 못 함**(기준선이 이미 낮다. 교차 30v30 은 7%→18% p=0.42, 짝 분석 head만 6·work만 5) |
| (a) 설명 일상표지 | 11/57 (19%) | 15/57 (26%) | p=0.50 n.s. |
| (a) grammarPoint 문법 용어 라벨 | 18/59 (31%) | 8/60 (13%) | **p=0.028**(head 표본 90 합치면 30/89 34% vs 13% p=0.007). N3 는 6/19→0/20 |
| (a) 메인 어느 쪽이든 JLPT식 | 24/60 (40%) | 16/60 (27%) | p=0.175(합친 head 42% p=0.058) — 방향만 |
| (a) extraNoteKo 비null(교정 행) | 0/57 | 35/57 (61%) | work 안 키 존재 100%(null 도 키를 씀) |
| (b) 교정 검출(corr 20, 교차) | 16/16 · 오탐 0/4 | **16/16 · 오탐 0/4** | original 바이트 일치 16/16 양쪽, 교정문 일치 75→88%, 유형 일치 69→69% |
| (b) 스타일 세트 검출(오류만 60) | 57/60 (95%) | 57/60 (95%) | original 불변 57/57, 교정문 일치 78→75%, 유형 63→63% (n.s.) |
| (c) TALK ajv·검사 1차 통과(재시도 0) | 107/110 (97%) [92–99] | 79/80 (99%) [93–100] | p=0.64 — **비하락**. 최종 실패 0/0. 재시도 사유는 문장 상한·`corrected==original` 같은 의미 검사 포함(스키마 위반만 센 것이 아니다). n4d04 는 양 팔 공통 문제 항목 |
| (c) CHAT 1차 통과 | 21/24 (88%) | 24/24 (100%) | p=0.23 n.s. — **grammarPoint 개선 효과로 주장하지 않는다**(head 재시도 3건 중 grammarPoint 80자 초과는 1건, 2건은 replyJa 3~4문장 — chat.ts 주석 정정) |
| (d) 지연 p50(교차 50 vs 50) | 4,836ms | 5,024ms | +188ms(+3.9%), 부트스트랩 95%CI [−1.0%, +8.5%] → 상한이 +10% 안. 재시도 행 제외 시 +4.2% CI [−0.2%, +9.1%] |
| (d) 지연 p95 | 6,406ms | 5,993ms | **불확정** — 표본 50 의 p95 는 3번째 큰 값이고 head 의 재시도 2건(9.8s·10.4s)이 head 쪽을 끌어올렸다. p90 차이 −74ms CI [−728, +396]. "p95 비악화" 라고 쓰지 않는다 |
| (d) 출력 JSON 평균자 | 489.7 | 508.3 | +18.5자(+3.8%) — null 칸 `,"extraNoteKo":null` ≈19자가 대부분. 토큰 수는 **측정 안 함**([추측] 턴당 +7~25 토큰) |
| (d) 조기 추출(교차 50) | style 완료 p50 1,650 · 첫문장 1,786ms | 1,603 · 1,763ms | 필터 통과·prefix 일치·style 먼저 모두 50/50 → 순서 불변 |
| (d) 프롬프트 | persona 2,530자 / 요청 6,552 | 2,745 / 6,830 | A1 최악 조합 여유 **9자**(2,991/3,000), TALK persona 최대 2,765/2,800(여유 35) |
| (f) CHAT grammarPoint 문법 용어 라벨 | 11/22 (50%) | 2/24 (8%) | **p=0.003**(비교차 n=24). 〜 문형 표기 64→88%, grammarPoint null 2→0 |

**(e) extraNoteKo 분포** (work 최종, 교정 73행 = 스타일 57 + corr 16): 채움 39/73 (53%). 길이 n=39 min 6 · p50 19 · p90 34 · max 43 — 권고 40 초과 2건(43·41), 100자 초과 0, 160자 초과 0 → **권고 40·저장 상한 200·컬럼 400 은 적절**(상향 불필요, 200 초과는 서버가 null 처리). **시험 문형일 때만 채워지는가 → 부분 충족**: 시험식(EXAM) 25/28 (89%) vs 일상(DAILY) 10/29 (34%) vs corr(일상 오류 16) 4/16 (25%) — 구분은 뚜렷하지만(p<0.001) 일상 문장에서도 1/3 이 채워진다(〜てもいい·〜すぎる·〜てしまう 처럼 교과서 문형이 걸린 문장이라 정의상 틀린 것은 아님). 채워진 39건: 〜 문형 표기 포함 36(92%)·급수/시험 표지 0·강한 용어 11. **눈 판정(1인)**: 부정확·불일치 3/39 (n5x07 「〜ないでください: 명령형(금지)」 — 오류는 走るない→走らない, n3x09 「〜なかった: 형용사의 과거형」 — grammarPoint 〜たところ 와 무관, n3x05 사역수동 설명 불명확), 24/39(62%)는 grammarPoint 와 같은 문형 이름으로 시작하며 접속 형태·대비 표현 한 줄을 덧붙이는 형태(중복 일부 — 「〜たい(希望)」 처럼 정보가 없는 것도 있다). 즉 추가 설명은 **쓸 만하지만 haiku 로는 정확도 약 90%·중복 일부**.

**(g) A3·A4 작업본(sonnet, 비교차·소표본)**: ① **A3 chatReview** — 3회씩 head(`base-rl`, review#3 은 90s 상한 초과 실패 → n=2) vs work. 1차 문구(v2 초안)는 JLPT식 42%→10%(3/29)로 줄였지만 **설명에서 "조각" 언급을 16/19(84%)→0/29(0%) 로 지웠다**(persona §3-5 "조각 단위로 짚습니다" 위반, 단 화면은 조각 칩을 따로 그림) → 지시를 "먼저 어느 조각(이름·액션·느낌·꾸밈)이 틀렸는지 짚고(예: "액션 조각 …"), 이어서 일상 쓰임 중심으로" 로 **보정**(chatReview.ts 한 줄, 테스트 1단언 추가). 보정본(`w-rl2`, 3회): 1차 통과 3/3, JLPT식(강한 용어·급수) **2/27 (7%)** vs head 8/19 (42%) p=0.009, 일상표지 23/27 (85%) vs 42% p=0.004, **조각 언급 27/27**, 정답 메시지 오탐 0, 설명 평균 81→118자(+45% — 카드가 길어진다), 결과 3,096 vs 2,852자, 프롬프트 6,484 vs 6,283자(+3%), ms 24.5/29.3/32.5s(head 1차 통과 28.1/24.9s) — 항목은 같은 14메시지 반복이라 독립 표본이 아니다(방향만). ② **A4 lesson@v9**(문구 "(일상 회화 위주)" 9자) — work 5/5 성공·1차 통과·`checkLessonResponse` 위반 0, ms p50 40.7s(head 38.7s, head 는 source#1 180s 상한 초과 1건·재시도 1건), 프롬프트 +10자. 규칙 판정 JLPT식 18%(2/11)→40%(6/15) p=0.40 은 て형·た형 접속 표기가 잡힌 것으로 **눈으로 본 문체 차이 없음**(두 팔 모두 장면·쓰임 중심) — n 이 작아 불확정이며 문구 9자 변경의 효과는 주장하지 않는다(회귀 없음만 주장).

**TALK 부작용(미보정)**: 메인 설명의 "조각" 언급이 head 36/57 (63%) → work 26/57 (46%) p=0.09(corr 세트 합쳐 45/73 vs 32/73 p=0.046). A3 와 같은 보정 문구를 TALK 에 시험했으나 A1 최악 조합이 3,018자로 3,000자 천장을 넘어(테스트 3건 실패) **되돌렸다**(현재 마진 9자). 화면이 조각 칩(`CHUNK_LABEL`)을 따로 그리므로 학습자에게 보이는 손실은 작다고 본다([추측] — 눈 판정 아님). 해소하려면 천장 협의(Leader) 또는 「(て형 등)」·「(80자 이내)」 같은 문구와 맞바꾸는 새 튜닝 1회전(≈120호출).

### 범위 제안 (Leader 결정용)

| 지점 | 이번 변경 | 바이트·계약 영향 | 근거·남은 위험 |
|---|---|---|---|
| A1 TALK `talk@v9` | persona §3-9 + §6 TALK 행 · `[지시]`(메인 설명 80자·문법 용어/급수/문형 이름 금지, grammarPoint=쓰임 이름, 새 칸 `correction.extraNoteKo`) · 스키마 additive | persona +215자(TALK 최대 2,765/2,800) · 요청 +278자(최악 조합 여유 **9자**) · 계약 additive(선택·null·`required` 아님) | grammarPoint 쓰임 이름화 ✔(p=0.028), 추가 칸 분리 ✔(시험식 89% vs 일상 34%), **메인 설명 본문의 JLPT 어휘는 개선 입증 못 함**(14% vs 16%). 부작용 "조각" 언급 63→46%(미보정) |
| A2 CHAT `chat@v4` | grammarPoint 한 줄 문구만 | 스키마·persona **불변**(CHAT 은 §3 미적재 → persona 바이트 동일) · 요청 평균 4,409→4,398자(−11) | grammarPoint 문법 용어 라벨 50→8%(p=0.003, 비교차). 1차 통과 개선은 주장 안 함 |
| A3 표현 점검 `chatReview@v2` | persona §3-9 + `explanation_ko` 문구(먼저 조각, 이어서 일상 쓰임) | 스키마 **불변** · persona +127자(4,117) · 요청 +201자(6,283→6,484) | JLPT식 42→7%, 조각 언급 84%→100%(보정 후). **새 칸 없음 → 승인 데모의 표현 점검 줄이 새 점검에는 안 뜬다**(아래 인계 4) |
| A4 레슨 `lesson@v9` | `grammar` 줄에 "(일상 회화 위주)" 9자 | 스키마·persona(§3 미적재) **불변**, 요청 +10자 | 5/5 통과·위반 0. 효과는 주장 안 함(회귀 없음만) |
| A7 EVAL_GRADE | **프롬프트·스키마 불변, persona 바이트만 +215자**(§3 공유) | 점수 기준은 A7 요청 본문(루브릭)이 정하고 §3-9 는 "설명 방식" 규칙이라 의미 영향 없음 [가능성 높음 — 루브릭 측정 결과는 아래 g2 에 기록] | 오프라인 evalGrade 테스트 통과(442/442) |
| 그 밖 A5·A6(EVAL_GEN)·A11·ASK 등 | 없음 | persona 가 §3 을 싣지 않는다(`prompts/*.ts` `sections:` 확인: 1·4·6 / 1·2·6·7·8 / 1·2·4·5·6·8) | — |

- **persona 바이트가 바뀌는 지점**은 §3 을 싣는 TALK·A3·A7 세 곳뿐이다(`loadPersona({sections})` 확인). §3-9 본문은 `extraNoteKo` 이름을 쓰지 않는다(추가 칸이 없는 A3·A7 이 같은 절을 싣기 때문 — 이름을 쓰면 없는 키를 만든다). 칸 정의는 §6 TALK 행에만 있다(테스트가 단언).
- **방안 B 비용**: 출력 JSON +18.5자/턴(+3.8%, 토큰은 미측정), 지연 p50 +3.9%(CI 상한 +8.5%), 조기 추출 순서 불변. 문서 비용: A1 요청 천장 마진 9자·TALK persona 마진 35자로 **소진**(이후 TALK 문구 추가는 천장 협의 또는 맞바꿈 필요).
- **메인/추가 분리 기준**: 모델 지시는 "메인=일상에서 어떻게 쓰는지(쓰임), 추가=문형 이름·접속 형태·급수(시험 대비), 시험 문형이 확실할 때만·아니면 null". 측정의 규칙 판정은 급수·시험 표지(JLPT·N5~N1·시험·급수…)·교과서식 강한 용어(문형·접속 형태·て형·조동사·어미·용법 …)·grammarPoint 용어 라벨(過去形·助詞·活用 …) 정규식이고 **키워드만 보는 거친 판정**이다(extra 안 〜 표기는 JLPT식으로 센다 — "extra 안 JLPT식 100%" 는 정의상 거의 항상 참이라 의미 없다). 질적 결론은 위 눈 판정을 따른다.

### Developer 인계

PE 산출(지시·스키마·타입·테스트)은 이미 코드에 있고 **서버는 아직 이 칸을 쓰지 않는다**. 서버가 할 일:

1. **컬럼**: `prisma/schema.prisma:751` `model Correction` 에 `extraNoteKo String? @db.VarChar(400)` 한 줄(사용자 승인됨 — 이 컬럼 1개뿐). developer 는 `prisma generate` 까지, `db push`(백업 → 미러 push)는 Leader.
2. **정리 함수**: `checks.sanitizeExtraNoteKo(explanationKo, extraNoteKo): string | null` — 순수·던지지 않음·재시도 없음. null 이 되는 경우: ① 누락·null·문자열 아님·공백 ② 길이 > `EXTRA_NOTE_STORE_MAX`(200, **자르지 않고 null**) ③ 한글 없음 ④ `explanationKo` 와 같거나 통째로 포함 ⑤ 엔진·모델 이름 노출. **호출 위치 권고: `orchestrator/shape.ts` 의 `shapeTurnResponse`(33행 `correction = { ...c, original: text }`)에서 `extraNoteKo: sanitizeExtraNoteKo(c.explanationKo, c.extraNoteKo)`** — `sanitizeUserKo`(43행)와 같은 자리라 저장 행과 SSE `done.correction` 이 같은 값을 보게 된다. Leader 사양대로 `saveTurnTx` 에서만 해도 되지만 그러면 `SavedCorrection` 에도 같은 변수를 넣어야 한다. 지금 `shaped.correction` 은 `{...c, original}` 라 **정리 전 원값이 이미 들어 있다**(`task039.test.ts:133` 이 이 동작을 단언 — shape 에서 정리하면 그 기대를 갱신).
3. **저장**: `orchestrator/index.ts:310` `tx.correction.create({ data: { …, explanation: c.explanationKo, …, extraNoteKo: <정리값 | null> } })`. `Correction.original` UPDATE 금지는 그대로이고 `extraNoteKo` 도 **생성 시에만** 쓴다(수정 경로를 만들지 않는다 — 제안→채택 원칙, 채택은 별개).
4. **DTO·타입**: `SavedCorrection`(`orchestrator/index.ts:218`)·SSE `done.correction`(api-contract) 에 `extraNoteKo: string | null` · `corrections/serialize.ts:6` `CORRECTION_SELECT` + `serializeCorrection`(교정 목록 #29·모아 둔 교정·`chats/index.ts:258` 메시지 목록의 교정이 모두 이 select 를 쓴다) · 화면 매핑 `src/types/chat.ts:84·195`, `src/components/chat/messages.ts:103`, `ChatReview.tsx:66`, `TalkCorrectionCard.tsx` — 옛 클라이언트는 모르는 필드를 무시한다. 문서: `api-contract.md`(교정 응답)·`domain-model.md`(Correction).
5. **[갱신 — pe-039c 에서 갭 해소: chatReview@v3 가 `extra_note_ko` 를 낸다, 아래 `### pe-039c` ⑥ 참조]** **표현 점검(A3) — 확인 결과: `chatReview@v2` 는 추가 설명을 응답에 포함하지 않는다**(`CHAT_REVIEW_SCHEMA`·지시문에 없고 테스트가 없음을 단언). `review/index.ts:147` 의 `tx.correction.create`·`ReviewItemDto`(26행)는 새 칸을 null 로 두면 된다(화면은 null 이면 줄을 그리지 않는다). **갭**: 승인된 데모의 채팅 표현 점검 카드(`#rv`)도 줄을 그리는데 A3 가 칸을 안 내므로 새 점검 결과에는 줄이 뜨지 않는다. **Leader 결정 필요** — ① A3 `extra_note_ko`(선택·null 허용) 추가: PE 가 chatReview@v3(스키마 1줄·지시 1줄·테스트·A3 3~5회 측정), developer 가 `review/filter.ts:47`(`mergeReviewCandidates` 필드 선택)·`review/index.ts:147·152`·`ReviewItemDto` 전달 ② 이번엔 회화(TALK) 교정만 — 표현 점검 카드는 줄 없음(깨지지 않음, 데모 D1 범위를 줄이는 결정이라 사용자 확인 필요) → 후속으로 미룸.
6. **옛 행**: 컬럼 NULL → 줄 없음(데모 `#rv-old` 와 동일). 마이그레이션·백필 없음.
7. **로그·Trace·Export**: `toolLog.meta`(learning·style·endOfTopic·warning)·`correctionToolLog`(`writeCorrectionMeta` — id·mode·deliver·hintKo·selfCheck)·`RequestTrace`·콘솔 로그에 `extraNoteKo` 값을 싣지 않는다(존재 여부·길이 정도의 불리언·숫자만 허용). 복습·관측(`learning/repetition/index.ts:27`·`learning/observations/corrections.ts`)은 `explanation` 만 쓰므로 변경하지 않는다(추가 설명은 복습 입력에 넣지 않는 것이 의도).
8. **테스트 제안**: shape→save→DTO 왕복(채움·null·200 초과·explanation 동일·엔진명), 옛 행 DTO null, A3 항목 null, 로그·toolLog 스냅샷에 extra 문자열 부재, 교정 `original` 불변 회귀.
9. **중간 상태 안전성(재확인)**: 프롬프트·스키마만 먼저 나가고 서버가 칸을 안 써도 **안전** — `saveTurnTx` 는 필드를 명시해 쓰고 `done.correction`·`toolLog.meta` 도 명시 필드라 `extraNoteKo` 는 저장·전송되지 않고 버려질 뿐이며 비용은 출력 +18.5자/턴이다. **위험한 순서는 반대**: 새 칸을 select/create 하는 빌드가 컬럼(`db push`)보다 먼저 운영에 나가면 교정 조회·저장이 전부 실패한다 → 컬럼 `db push`(additive nullable — 옛 코드의 Prisma client 는 알려진 컬럼만 명시 조회해 영향 없음 [가능성 높음, 이번 세션 미실행]) → 코드 배포 순서를 지킨다.
10. **화면**: designer 승인 데모(`docs/demo/task-039-improve-tutor-explanation-v1.html`, D1~D4=A: 교정 카드 안 접이식 '시험 문법 더 보기'·늘 접힘·회화방에도 같은 줄)대로. 화면은 자르지 않는다(저장 ≤200). A3 설명이 평균 118자로 길어져(+45%) 표현 점검 카드 높이를 데모 ② 긴 설명 케이스로 확인.
- [16:28] **`sanitizeExtraNoteKo` 를 실측 출력 39건에 실제로 돌린 결과**(scratchpad `pe039/sanitize-check.mts`): 통과 34/73행 (47%), 버려짐 5건 — 전부 ③ "한글 없음"(「〜たい(希望)」「〜てもいいですか(許可を求める)」「な形容詞: きれい·親切·丁寧 など」처럼 일본어만의 문형 표기 반복)이라 **정보가 없는 항목이 서버 정리에서 걸러진다**. 즉 화면에 실제로 뜰 비율은 약 47%(시험식 문장 위주). ①②④⑤ 로 버려진 건 0건.

**(g2) A7 EVAL_GRADE 루브릭 20+8건(`eval-grade-rubric-measure.ts` 28건, persona 만 head/work 교체 — `TUTOR_PERSONA_PATH`)**: work(§3-9 포함) 범위 내 **27/27**(실패 1 = g26 CLI 150s 상한 초과) · head 범위 내 26/26(실패 2 = g02·g17 같은 150s 초과). 둘 다 성공한 25건 중 점수 동일 23, 다른 2건은 1점 차(g03 0→1, g18 5→6, 둘 다 기대 범위 안). ms 평균 7.4s vs 7.6s, 재시도 0/0. → **A7 의미 영향 없음**(동일 점수 92%·범위 이탈 0). 타임아웃이 양 팔에 흩어져 있어 persona 때문이 아니라 sonnet CLI 의 간헐 장시간 대기로 보인다([추측] — 이번 세션 head 팔 A3 90s·A4 180s·A7 150s ×2 포함 head 4건 vs work 1건, n 이 작아 귀속 불가). 이 간헐 타임아웃은 **재발 가능한 함정**: 배치형 sonnet 지점(A3·A4·A7)의 측정은 실패를 분모에서 빼지 말고 따로 센다.

### 완료 기준 2(계약 안전) 판정 — 통과/미달

| 항목 | 판정 | 근거 |
|---|---|---|
| 지시·골격·스키마·타입·테스트 일치(A5·A11 교훈) | **통과** | `task039.test.ts` 17건(이름 일치·키 순서·required 아님·null/누락/빈값/초장문 통과·비문자열만 위반·모르는 키는 `additionalProperties` 위반·CHAT 불변·persona 절 배치) + conversation 442/442 · tsc rc=0 · eslint rc=0(내가 3회 재실행) |
| null 허용·길이 상한 | **통과** | 스키마 선택·무제한(재시도·턴 실패 방지), 서버 저장 전 `sanitizeExtraNoteKo` 200자 초과 null, 권고 40(실측 최대 43) |
| 옛 키·모르는 필드 | **통과** | `extraNoteKo2` 같은 모르는 키는 여전히 위반(테스트) |
| ajv 1차 통과 비하락 | **통과** | TALK 97%→99%(p=0.64), CHAT 88→100%(n.s.) |
| 교정 검출 16/16·오탐 0/4·original 무수정 | **통과** | 16/16·0/4·16/16 (스타일 세트 57/57 포함) |
| 지연 p50 비악화(≤+10%) | **통과(조건부)** | +3.9%, CI 상한 +8.5% — n=50 한 번의 교차 측정. **p95 는 불확정**(주장 안 함) |
| TALK `done`·첫 음성 비악화(`task007-latency`) | **미실행(확인 못 함)** | 서버·DB 가 필요한 QA 몫. 대리 지표(스트림 style 완료·첫 문장 확정 p50, 필터·prefix·순서)는 불변 |
| 슬립 복구(task-037) 호환 | **통과(오프라인)** | `extraNoteKo` 는 correction 객체 맨 끝이라 최상위 순서·조기 추출 불변, 끊긴 JSON 복구 테스트 통과. 라이브 슬립 사례 없음 |
| **완료 기준 1(규칙 반영)** | **부분 통과** | grammarPoint 쓰임 이름화·추가 칸 분리·A3 JLPT식 42→7%는 입증. **TALK 메인 설명 본문의 JLPT 어휘 감소는 입증 못 함**(14% vs 16%, n.s.), TALK 조각 언급 감소 부작용 |

### Prompt-Engineer 완료 기록 (pe-039b, 2026-10-06 16:34)

- **완료**: 최종 A/B 표(a~f)·A3·A4·A7 측정·범위 제안·Developer 인계·완료 기준 2 판정·잔재 확인. 코드 변경(내 손): `chatReview.ts`(A3 지시 보정 + 헤더 주석), `chat.ts`(주석 정정 — 재시도 원인 서술이 틀렸다), `checks.ts`(주석 80→40자 정정), `task039.test.ts`(A3 단언 1줄). **동작이 바뀐 것은 chatReview@v2 의 지시 한 줄뿐**이고 TALK 은 시험 후 되돌려 측정본 그대로(바이트 동일 확인).
- **남은 일(Leader 결정)**: ① **A3 `extra_note_ko` 추가 여부**(인계 5 — 승인 데모의 표현 점검 줄이 새 점검에 안 뜨는 갭) ② TALK 조각 언급 감소를 둘지(천장 9자 마진 — 협의 또는 맞바꿈 튜닝 1회전) ③ 추가 설명 정확도(약 90%)·`extraNoteKo` 채움률(53%, 서버 정리 후 47%)을 허용할지, 지시를 더 조일지(재측정 필요) ④ `task007-latency`·운영 스모크는 QA.
- **다음 첫 행동**: Leader 가 ①~③ 을 정하면 → ①이 "추가"면 PE 가 chatReview@v3(스키마 1줄·지시 1줄·테스트·A3 3~5회) → developer 구현(컬럼 승인 완료, `db push` 는 Leader 백업 후) → Reviewer.

### pe-039c (A3 chatReview@v3)

- [16:45] **중간 기록(완료 / 남은 일 / 다음 첫 행동).** 완료: ① `CHAT_REVIEW_SCHEMA` 항목에 `extra_note_ko: { type: ['string','null'] }`(선택·`required` 아님·길이 무제한·`additionalProperties:false` 유지·선언 순서 항목 맨 끝) + `ReviewItem.extra_note_ko?: string | null` ② `chatReview.ts` → `chatReview@v3`: 새 `[지시]` 줄 1개(`- extra_note_ko 는 JLPT 식 정보(문형 이름·접속 형태·급수)를 한국어 한 줄(40자 이내)로 적는 선택 칸입니다. 시험에 나오는 문형이 확실할 때만 쓰고, 단순 활용·조사 실수이거나 확실하지 않으면 null(대부분 null).`)를 `explanation_ko` 줄 **바로 뒤에 따로** 둠 — `explanation_ko` 줄(먼저 조각 → 일상 쓰임)은 바이트 그대로 · 40자는 `EXTRA_NOTE_PROMPT_MAX` 재사용, 새 상수·새 정리 함수 없음 ③ `tutor.md`·`talk.ts`·`chat.ts`·`lesson.ts`·서버·화면·prisma 미수정 ④ 테스트 `task039.test.ts`: A3 단언 갱신(버전 v3, `extra_note_ko` 한 줄에 한 번·`explanation_ko` 줄 불변·TALK 이름 `extraNoteKo` 혼입 없음·persona 에 이름 없음) + 신규 2건(A3 스키마: required 아님·null/누락/빈/5,000자 통과·비문자열·모르는 키·카멜 `extraNoteKo` 위반·키 순서 / A3 후검증·정리: `checkChatReview` 가 값에 무관·`sanitizeExtraNoteKo(explanation_ko, extra_note_ko)` 재사용) ⑤ **내가 직접 재실행**: conversation **444/444**(직전 442 + 신규 2, 로그 scratchpad `pe039c/conv-1.log`) · tsc rc=0 · eslint(저장소 파일) 0 errors/5 warnings(전부 기존 `react-hooks/set-state-in-effect`, conversation 쪽 0) — 참고: 미러 루트의 `tmp-pe/t49.ts`(저장소 밖 잔재, 내 것 아님) 때문에 `eslint .` 전체는 2 errors(no-explicit-any) 로 나오므로 그 폴더·`.scratch-021` 을 제외하고 쟀다. 남은 일: A3 라이브 측정(v2 복사본 vs v3, 5회×2팔, sonnet — 실패는 분모에 포함·따로 셈) → 결과 기록·Developer 인계 5번 갱신. 다음 첫 행동: `pe039c/rl-v3.log` 완료 확인 후 `SUMMARIZE_ONLY` 요약.
- [17:03] **완료 기록(pe-039c, A3 chatReview@v3).** 상태: 코드·테스트·측정 완료, **"20회 위반율 ≤5% 확인"만 못 채움**(아래 ⑤·위험).

**변경 파일(내 손, 미커밋)**: `src/modules/conversation/structuredResponse/schemas.ts`(`CHAT_REVIEW_SCHEMA` 항목 `extra_note_ko: {type:['string','null']}`·`required` 아님·선언 순서 항목 맨 끝·`additionalProperties:false` 유지 / `ReviewItem.extra_note_ko?: string | null` / `EXTRA_NOTE_PROMPT_MAX` 주석에 A3 추가) · `prompts/chatReview.ts`(`chatReview@v3`, 새 `[지시]` 줄 1개를 `explanation_ko` 줄 **뒤에 따로** — `explanation_ko` 줄은 바이트 그대로, 40자는 `EXTRA_NOTE_PROMPT_MAX` 재사용, 새 상수·새 정리 함수 없음, 헤더 주석 v3 단락) · `__tests__/task039.test.ts`(A3 단언을 반대로 갱신 + 신규 2건) · `tests/live/task039-review-lesson-ab.ts`(A3 `extra_note_ko` 키·채움·서버 정리·길이·문장 종류별·'조각' 언급 기록, **구독 세션 한도 즉시 실패 2연속 시 중단**). **미수정**: `tutor.md`·`talk.ts`·`chat.ts`·`lesson.ts`·서버(`review/**`·`orchestrator/**`)·화면·`prisma/schema.prisma`·`checks.ts`. persona 는 A3 가 싣는 §3-9 에 필드 이름이 없고(테스트 단언) 이름은 지시문에만 있다.

**① 오프라인(내가 직접 최종 재실행, 로그 scratchpad `pe039c/conv-2.log`·`tsc-3.log`·`eslint-3.log`)**: conversation **444/444**(직전 442 + 신규 2) · tsc rc=0 · eslint(저장소 파일) **0 errors**(5 warnings 전부 기존 `react-hooks/set-state-in-effect`, conversation 0) — 미러 루트 `tmp-pe/t49.ts`(저장소 밖 잔재)가 `eslint .` 전체에서 2 errors 를 내므로 그 폴더와 `.scratch-021` 을 제외했다.

**② 테스트가 지키는 것**: 버전 v3 · `extra_note_ko` 는 지시문에 한 줄·한 번(snake_case, TALK `extraNoteKo` 혼입 없음)·`explanation_ko` 줄에는 없음("먼저 어느 조각… 짚고" 문구 유지 단언) · 스키마: required 아님, null·누락·빈 문자열·5,000자 통과, 비문자열·모르는 키(`extra_note_ko2`)·카멜 `extraNoteKo` 는 위반, 키 순서 불변 · `checkChatReview` 는 값에 무관 · `sanitizeExtraNoteKo(explanation_ko, extra_note_ko)` 가 TALK 과 같은 규칙(null·상한 200 초과 null·한글 없음 null·메인 설명 베끼기 null) · A3·EVAL_GRADE·CHAT·LESSON persona 에 두 이름 모두 없음.

**③ 라이브 A3 측정(sonnet, v2 복사본=head vs v3=work 같은 시간대 교차, 5회×2팔×2배치, 간격 1.5s)** — v2 복사본 `~/.node-local/thekaiwa-v2-039`(내 임시 사본, 저장소 밖 — 작업본에서 `extra_note_ko` 지시 줄·스키마 키만 뺀 것, persona 동일, 숫자는 이전 v2 단독 측정 `w-rl2` 과 같은 사전으로 재현 확인: 조각 27/27·JLPT식 2/27·일상표지 23/27·설명 118자). 같은 14메시지(일상 6·시험식 6·정답 2)가 반복되므로 **항목은 독립 표본이 아니다 — 방향만**. 원자료 `pe039c/rl-v3.json`·`rl-v3b.json`, 계산 `pe039c/calc.py`(Fisher 정확검정 양측).

| 지표 | v2(head) | v3(work) | 비고 |
|---|---|---|---|
| 호출 / 최종 성공 | 10 / 9 | 10 / 10 | v2 의 1건 = `JsonSchemaError`(JSON 파싱 실패, 재시도 후에도) — **타임아웃 아님**. 429·타임아웃 0 |
| ajv 1차 통과 | 9/10 | 9/10 | v3 의 1건 = 모르는 키 `corrected_note` 를 지어내 재시도(63s, 90s 안) |
| `extra_note_ko` 키 존재 | - | 95/95 | null 도 키를 씀 |
| 채움(원값=서버 정리 후) | - | 57/95 (60%) | 정리 통과 57/57(버려진 것 0 — 길이·한글·베끼기·엔진명 전부 통과) |
| 시험식 / 일상 / 정답 메시지 | - | 47/49 (96%) / 10/46 (22%) / 해당 항목 없음(오탐 0) | 일상 채움 10건은 전부 r03 「遅れるしまいました」=〜てしまう(교과서 문형이 걸린 문장) |
| 길이(비null 57) | - | min 7·p50 19·p90 24·max 26 | 권고 40 초과 0, 200 초과 0 |
| 설명 '조각' 언급(`/조각/`) | 84/84 | 95/95 | 이전 27/27 수준 유지(보정 문구 불변) |
| 설명 JLPT식(규칙 판정) | 15/84 (18%) | 20/95 (21%) | Fisher p=0.71 — **차이도 회귀 없음도 입증 못 함**. 일상 5/41 vs 9/46(p=0.40), 시험식 10/43 vs 11/49(p=1.0). 방향은 v3 가 약간 높다(r03 5/9→9/10·r07 4/9→7/10·r08 1/9→3/10 은 높고 r12 5/9→1/10 은 낮음). v2 자체도 이전 단독 측정은 2/27(7%)이라 변동 7~18% |
| 설명 일상표지 | 63/84 (75%) | 64/95 (67%) | p=0.32 n.s. |
| 정답 메시지 오탐 항목 | 0 | 0 | |
| 요청 / 결과 평균자(1차 통과분) | 6,484 / 3,118 | 6,664 / 3,427 | 요청 +180자(+2.8%), 결과 +309자(+9.9%, `extra_note_ko` 키·값) |
| ms p50(성공분) | 30,501 | 32,501(1차 통과분 32,167) | +6.6%(+5.5%) — n=9/10, 재시도 1건 63s 가 평균을 끌어올림 |

**눈 판정(1인, 같은 6문장 반복이라 중복 큼)**: 채워진 57건 중 명백한 오정보 0, 부정확·불완전 약 3~4건 — r09 「ばかりのに」의 일부 답이 「ばかり」를 빼고 '명사+なのに'로만 적음(예: `명사+なのに (역접 표현)`, `な+のに 접속`). r03 〜てしまう·r07 ように/ために·r08 ことにする·r11 によると/によって·r12 ば형은 정확. 43/57 이 「〜」 문형 이름으로 시작해 괄호나 「+」 로 접속 형태·대비 한 줄을 덧붙이는 형태(TALK 과 같은 모양), 6건은 「vs/구분」 대비형. 「N4」 급수 표기가 든 것은 6건(`〜てしまう(의도치 않은 결과, N4 문형)` 류 — 급수는 추가 설명 칸에만 있다).

**④ 이번 변경에서 안 한 것**: `explanation_ko` 지시(조각 먼저 → 일상 쓰임) 불변 · TALK·CHAT·A4·persona 불변 · 서버 필드 선택은 developer.

**⑤ 못 채운 것·위험(중요)**:
1. **3배치(v3 단독 10회, "20회 위반율" 표본 채우기)가 전부 즉시 실패** — 10건 모두 `ClaudeCliExecError: exit=1, stderr 없음` ≈1.8s. 원인은 내가 직접 1회 호출해 확인: `You've hit your session limit · resets 6pm (Asia/Seoul)`(구독 세션 한도, stdout 으로만 나옴 — 기존 429 정규식이 못 잡아 10건을 소진했다 → 스크립트에 즉시 실패 2연속 중단 추가). 이 10건은 프롬프트 결과가 아니라 **분모에서 제외**했고 여기에 따로 센다. **즉 v3 표본은 10회뿐이라 "20회 호출 ≤5%" 는 확인 못 했다**: v3 1차 위반 1/10(Wilson 95% 1.8~40%), 최종 실패 0/10. v2 도 1/10 이라 v3 가 더 나쁘다는 근거는 없다.
2. **새로운 위반 유형 `corrected_note`(모르는 키) 1건** — v3 의 `extra_note_ko` 근처에서 모델이 비슷한 이름의 키를 지어냈을 가능성이 있다(`[추측]`, 1건·인과 입증 못 함). `additionalProperties:false` 라 재시도(≈+30s)로 이어지고 A3 는 90s 타임아웃·`softExtraCheck`(스키마 위반은 여전히 재시도)다. 완화 문구(예: "키는 위 스키마의 이름만")는 **측정 없이 넣지 않았다**.
3. **구독 세션 한도는 같은 로그인을 쓰는 다른 에이전트의 Claude CLI 호출에도 걸릴 가능성이 높다(`[가능성 높음]` — 직접 확인한 것은 이 프로세스의 호출 1건뿐) — 18:00 KST 이전에는 라이브 측정·QA 가 같은 방식으로 즉시 실패할 수 있다**(Leader 확인 필요).
4. JLPT식 비율은 위 p=0.71 — "회귀 없음"이라고 쓸 수 없고 "입증된 차이 없음, 방향은 약간 높음"이다. 후속이 필요하면 한도 리셋 뒤 아래 명령으로 v3 단독 10~20회를 더하면 된다(`pe039c/calc.py` 로 합산).

**재측정 명령(한도 리셋 뒤, 미러에서)**: `cd ~/.node-local/thekaiwa && BASE_SRC=$HOME/.node-local/thekaiwa-v2-039/src BASE_PERSONA=$HOME/.node-local/thekaiwa-v2-039/tutor.md SETS=review ARMS=head,work RUNS_REVIEW=10 OUT=<scratchpad>/rl-v3d.json node --env-file=.env --import tsx tests/live/task039-review-lesson-ab.ts`(20+20 호출 ≈ 20분, 한도 소모 큼 — v3 단독이면 `ARMS=work`).

**⑥ `### Developer 인계` 5번 갱신(갭 해소 — 이제 A3 응답이 `extra_note_ko` 를 낸다)**: 서버 전달은 developer 몫이다.
1. `review/filter.ts` — `ReviewCorrectionDraft`(14행)에 `extraNoteKo: string | null` 을 더하고 `toDraft`(42행)에서 `extraNoteKo: sanitizeExtraNoteKo(it.explanation_ko, it.extra_note_ko)` (`checks` 에서 이미 `splitJaSentences` 를 import 중). `mergeReviewCandidates` 의 후보 병합(마지막 후보 우선·나머지로 보충) 로직은 그대로 두고 **항목이 가진 값이 draft 와 함께 운반**되게만 한다(정리는 `toDraft` 에서 한 번).
2. `review/index.ts` — `tx.correction.create({ data: { …, extraNoteKo: d.extraNoteKo } })`(147행) · `ReviewItemDto`(26행)에 `extraNoteKo: string | null` · `out.push`(152행)에 같은 값. 저장은 **생성 시에만**(UPDATE 경로 없음 — `original` 불변과 같은 원칙).
3. 재방문·목록(`corrections/serialize.ts` `CORRECTION_SELECT`, `chats/index.ts` 메시지 목록)은 TALK 인계 4번과 같은 select 라 그쪽 작업으로 함께 해소된다. 화면 매핑(`ChatReview.tsx`·`types/chat.ts`)도 TALK 인계 4번 그대로.
4. 로그: `review/index.ts:107` payload 는 `userMessages`·`chars` 뿐이라 `extra_note_ko` 값이 새로 실리지 않는다 — 유지(값은 로그·Trace·`toolLog`·Export 에 싣지 않는다).
5. **중간 상태 안전성**: 프롬프트·스키마만 먼저 나가면 `toDraft` 가 필드를 명시해 draft 를 만들므로 `extra_note_ko` 는 저장·전송되지 않고 버려진다(비용 = 출력 +≈310자/호출). 위험한 순서는 TALK 과 같다 — 컬럼 `db push` 전에 `extraNoteKo` 를 create/select 하는 빌드를 내보내면 점검 저장이 실패한다.
6. 테스트 제안: `mergeReviewCandidates` 가 항목의 extra 를 운반(채움·null·200 초과·explanation 동일·여러 후보 병합 시 선택된 항목의 값) · `ReviewItemDto` 왕복 · 옛 응답(키 없음) → null · A3 응답 한 건에서 `extra_note_ko` 만 비정상(문자열 아님)이면 ajv 위반이라는 점(저장 전 정리가 아니라 스키마 단계에서 재시도됨)을 알고 있을 것.

### pe-039d (A3 v3 보충 측정)

- [20:30] **착수(pe-039d, 신규 소환).** 목적: REV-115 M-2 — pe-039c 가 구독 세션 한도로 v3 단독 표본 10회뿐이라 "20회 위반율 ≤5%" 를 못 채운 것을 보충. 측정·기록 전용(코드·프롬프트·스키마·테스트·서버·화면 미수정, 커밋·푸시·db push·배포 안 함).
- **DB 안전 확인 `[확인]`**: `tests/live/task039-review-lesson-ab.ts` 는 `llm.completeJson` 호출뿐이고 `Correction` 등 업무 표를 읽거나 쓰지 않는다 — 스크립트 자체에 `prisma`/`.correction` 참조 0건(grep), 엔진 라우터(`engine/router/index.ts:47·54`)가 `EngineFallbackPolicy`·`EngineConnection` 을 **읽기만** 한다(create/update/upsert 0건, `llm/`·`adapters/llm/`·`json/` 에 `prisma.` 호출 없음). 새 컬럼(`Correction.extraNoteKo`)을 건드리는 경로 없음. 합성 입력(`tests/prompts/fixtures/chat-review-style.json` 14메시지: 일상 6·시험식 6·정답 2)만 쓴다.
- **동기 확인 `[확인]`**: 미러(`~/.node-local/thekaiwa`)의 `chatReview.ts`(`chatReview@v3`)·`schemas.ts`·`checks.ts`·측정 스크립트·`tutor.md`·fixture 가 NFS 작업본과 `cmp` 동일. 측정 대상 = 작업본 v3(= REV-115 가 감사한 버전, pe-039c 이후 `chatReview.ts` 변경 없음).
- 계획: `ARMS=work RUNS_REVIEW=10` 을 2배치 이상(sonnet, 간격 1.5s, 항목은 같은 14메시지라 독립 표본 아님 — 호출 단위 판정). 즉시 실패 2연속·429·세션 한도면 즉시 중단·기록.
- [20:35] **중간 기록(배치 1 `rl-d1` 완료).** 한도 해제 확인(즉시 실패 0) — 10/10 성공·**10/10 1차 통과**·재시도 0·타임아웃 0(ms 27.7~40.2s). pe-039c 의 v3 성공 10회와 합치면 v3 20회: 1차 통과 19/20(위반 1 = `corrected_note`, pe-039c 에서 나온 그 1건), 최종 실패 0/20. 이어서 배치 2~4(`rl-d2`~`rl-d4`, 체인 스크립트 `pe039d/chain.sh`, 한도·중단 감지 시 자동 정지)를 돌리는 중. 남은 일: 배치 2~4 결과 합산(`pe039d/calc2.py`) → 아래 최종 절 작성. 다음 첫 행동: `pe039d/chain.log` 로 체인 종료 확인.
- [21:15] **완료 기록(pe-039d).** 상태: **측정 완료, 판정 = 스키마 위반율 ≤5% "입증 못 함(점추정 4.0%, 구간 상한 13.5%)" · 최종 실패율은 6.0% 로 미달(전부 타임아웃)**. 한도·429·즉시 실패 **0건**(18:00 리셋 이후 정상) — 20:26~21:08 사이 v3 40회 + v2 대조 20회, 중단 없음. 코드·프롬프트·스키마·테스트·서버·화면 수정 없음(내 손으로 바꾼 파일 = 이 이력서뿐), 커밋·푸시·db push·배포 안 함.

**방법**: `ARMS=work RUNS_REVIEW=10` 4배치(`rl-d1`~`rl-d4`, 간격 1.5s, sonnet, A3 `timeoutMs` 90s = 운영 `engine/router/tasks.ts:25` 와 동일) + pe-039c 의 v3 성공 10회 = **v3 50회**(전부 유효 호출, 분모 밖 즉시 실패 0). 추가로 **v2 대조 30회**(= 이번 `ARMS=head` 20회 `rl-h1`·`rl-h2` + pe-039c v2 10회, v2 복사본 `~/.node-local/thekaiwa-v2-039`). v3 와 v2 는 시간대·교차가 다르다(이번 대조는 v3 배치 뒤 순차) — 비교는 방향만. 같은 14메시지(일상 6·시험식 6·정답 2)가 반복되므로 **항목은 독립 표본이 아니고 호출 단위로 판정**한다. 위반 유형은 rows JSON 에 저장되지 않아 로그의 `[json] 1차 응답 계약 위반 → 재시도: …` 줄을 다음 행에 귀속해 읽었다(`pe039d/calc2.py`, Wilson 95%·Fisher 정확검정 양측).

| 지표 | v3 (n=50) | v2 대조 (n=30) | 비고 |
|---|---|---|---|
| 1차 통과 | 45/50 (90.0%) | 28/30 (93.3%) | 1차 비통과 10.0% [Wilson 4.3–21.4] vs 6.7% [1.8–21.3], Fisher p=0.71 |
| **스키마(계약) 위반 → 재시도** | **2/50 (4.0%)** [1.1–13.5] · 응답 반환 47건 기준 4.3% [1.2–14.2] | 2/30 (6.7%) — 지어낸 키 1 + JSON 파싱 실패 1 | v3 2건 모두 `/items/3: 허용되지 않은 필드 'corrected_note'` → 재시도 후 통과 |
| 최종 계약 실패(JSON/스키마로 끝내 실패) | **0/47** (상한 7.6%) | 1/30 (JSON 파싱 실패, 64s) | |
| **타임아웃(CLI 90s, 첫 호출 중 — 로그에 `[json]` 위반 줄 없음)** | **3/50 (6.0%)** [2.1–16.2] | 0/30 [0–11.4] | p=0.29 — 판단 불가. 3건 = `rl-d2#1`·`rl-d3#8`·`rl-d4#3` |
| **최종 실패(스키마 + 타임아웃)** | **3/50 (6.0%)** [2.1–16.2] | 1/30 (3.3%) [0.6–16.7] | p=1.00 |
| 재시도 후 성공 | 2 (62.9s·65.3s, 재시도 비용 ≈ +32s) | 1 (66.1s, `corrected_hint` @`/items/0`, +36s) | 재시도 호출도 90s 안(여유 ≈25s) |
| 지연 p50(성공분) / p90 | 31.7s / 38.6s (n=47) | 30.5s / 34.8s (n=29) | +3.9%, **비교차** — pe-039c 의 같은 시간대 교차분은 +6.6% |

**항목 지표(v3 성공 47회·446항목)**: `extra_note_ko` 키 존재 446/446(null 도 키를 씀) · 비null 253 (57%): 시험식 207/231 (90%)·일상 46/215 (21% — 전부 r03 「〜てしまう」 46/47, r01·r02·r06 은 0/47)·정답 메시지 항목 0(오탐 0) · **서버 정리 통과 237/446 (53%): 버려진 16건(비null 의 6.3%)은 전부 "한글 없음"**(「〜たばかりなのに」「〜ことにする」「目的の『ように』と『ために』の違い」처럼 일본어만의 문형 표기 — pe-039c 의 "57/57 통과"는 표본이 작아서였다, 화면에 줄이 안 뜨는 쪽으로 걸러지므로 안전 방향) · 길이 min 5·p50 17·p90 23·max 30, 권고 40 초과 0·200 초과 0 · 설명 '조각' 언급 446/446 · 설명 JLPT식(규칙 판정) 87/446 (19.5%) vs v2 42/272 (15.4%) p=0.19 n.s. · 설명 평균 109자 vs 114자 · 요청 6,664자 vs 6,484자.

**판정 (REV-115 M-2 / 목표 "20회 호출 위반율 ≤5%")**
1. **표본 20회 이상 요건은 채웠다**(v3 50회) — 그러나 **≤5% 는 입증하지 못했다.** 스키마 위반 점추정 4.0% 는 5% 이하이지만 Wilson 상한이 13.5% 다(0건이어도 상한 ≤5% 에는 약 75회가 필요하고 이번엔 2건이 나왔다). → **"확인 못 함"**. 효과·안전을 주장하지 않는다.
2. **최종 실패율 6.0% (3/50) > 5% → 점추정 미달**, 단 구간 [2.1–16.2] 이 5% 를 포함하므로 "초과 확정"도 아니다. 3건 모두 스키마와 무관한 CLI 90s 타임아웃(`ClaudeCliTimeoutError`, 첫 호출 중). v2 대조는 0/30 이지만 p=0.29 라 v3 탓인지 간헐 대기인지 **가리지 못한다**(같은 날 pe-039b 에서는 v1 A3 head 1/3·A7 head 2건·A4 head 1건도 타임아웃 — 배치형 sonnet 지점의 알려진 간헐 현상, [추측] v3 의 +180자 프롬프트가 원인일 근거는 없음).
3. **지어낸 키와 `extra_note_ko` 의 연관 — 지지되지 않음.** v2(`extra_note_ko` 가 스키마·프롬프트에 없음)도 `corrected_hint` 를 냈다(1/30). v3 2/50 vs v2 1/30 p=1.0. v3 의 `corrected_note` 두 건은 모두 `/items/3`(0 부터 센 네 번째 항목)이고 재시도 뒤 최종 출력의 같은 자리(`items[3]`)는 두 건 다 r06 이지만(r06 의 `extra_note_ko` 는 47회 전부 null), 1차 raw 응답은 저장하지 않아 어느 메시지에서 낸 키인지는 **확정 못 한다**([추측] — v2 의 `corrected_hint` 는 `/items/0` 이라 위치 고정도 아니다). 결론: 간헐적인 "교정 항목에 `corrected_*` 보조 키를 붙이는" sonnet 습관일 가능성이 더 크고(`[추측]`), v3 가 그 빈도를 키웠다는 증거는 없다 — 단 표본이 작아 몇 %p 의 증가는 배제 못 한다.
4. 지연: p50 +3.9%(비교차)·재시도 한 번 ≈ +32s(호출의 4%) — 이전 pe-039c(+6.6%)와 같은 범위, 새로 관찰된 악화 없음.

**`stripAdditionalProperties: true` 오프라인 추정 (코드 변경 없음)** — `pe039d/strip-replay.mts`(합성 응답에 엔진의 `extractAndValidate` 를 그대로 호출, 출력 `strip-replay.out`). **주의: 1차 raw 응답이 없어 위 위반을 재생한 것이 아니라, 로그 문구(`/items/3: … 'corrected_note'`)를 재현한 합성 입력이다 — 메커니즘만 확인.** 결과: ⓐ 항목 안 지어낸 키(`corrected_note`)·ⓑ 최상위 지어낸 키·ⓒ 카멜 `extraNoteKo` → 옵션 끄면 위반(재시도), **켜면 재시도 없이 통과**(로그는 키 경로만: `[json] 스키마 밖 필드 제거: items/3/corrected_note`) · ⓓ 필수 필드 이름이 바뀐 경우(`explanation_ko`→`explanation`)와 ⓔ 타입 위반(`extra_note_ko: 3`)은 켜도 **여전히 위반**(필수·타입은 건드리지 않음 — 안전). A3 스키마는 object/array/`anyOf`(chunk_type)뿐이라 엔진의 정리 함수가 따라가는 구성과 호환된다(`schemaValidate.ts` 주석: `oneOf`·`allOf`·`$ref` 만 못 따라감 — 이 스키마엔 없음). **이번 표본에 적용하면**: 지어낸 키 2건의 재시도가 사라져 1차 비통과 5→3, 호출 4% 가 각 ≈32s 덜 걸린다(스키마 위반 1차 4.0%→0%). **효과가 없는 것**: 타임아웃 3건(첫 호출 중 발생)·JSON 파싱 실패(v2 1건). 즉 최종 실패율 6.0% 는 이 옵션으로 줄지 않는다. 비용·위험: 서버가 지어낸 키를 어디에도 쓰지 않으므로(`review/filter.ts` 가 필드를 명시 선택) 버려도 손실 없음 — 다만 모델 이탈 신호가 로그의 키 경로로만 남는다.

**권고 (Leader 결정)**
- ① **(선택·작은 변경)** A3 요청(`buildChatReviewRequest` 반환 객체)에 `stripAdditionalProperties: true` 한 줄 — 레슨이 이미 켬(`lesson.ts:336`), 엔진 구현·테스트 있음. 도입하면 developer 가 한 줄 + 테스트 1건(스키마 밖 키 항목이 재시도 없이 통과·필수 이름 변경은 여전히 위반). 이번 task 필수 아님(최종 실패는 안 줄어듦, 지연·재시도 비용 절감용).
- ② **타임아웃 6%(3/50)는 프롬프트로 풀 문제가 아니다.** 완화 문구를 측정 없이 넣지 않았다. QA 가 운영 스모크에서 A3 타임아웃 시 사용자 화면(오류 문구·다시 시도)이 깨지지 않는지 확인하고, 필요하면 타임아웃/재시도 정책은 developer·Leader 결정.
- ③ REV-115 M-2 는 "표본 보충 완료, ≤5% 입증 못 함, 새 위험(악화) 신호 없음"으로 닫을 수 있다고 본다 — 닫을지는 Reviewer·Leader 몫.

**측정 중 코드 변동 `[확인]`**: 20:31 에 dev-039c 가 `checks.ts`(`sanitizeExtraNoteKo`)를 바꿨고 미러에도 반영됐다 — 따라서 위 "서버 정리 통과 237/446" 은 배치별로 옛·새 sanitizer 가 섞여 있다(`rl-d1` 은 옛 것으로 시작). 프롬프트·스키마·persona 는 **불변**임을 확인했다(`chatReview.ts` 16:37·`schemas.ts` 16:37·`tutor.md` 15:39 mtime 이 측정 전 그대로이고 미러와 `cmp` 동일, 호출별 `promptChars` 가 v3 2,547·v2 2,367 로 일정) → 스키마 위반·타임아웃·채움 수치에는 영향이 없고, 버려진 16건의 사유가 전부 "한글 없음"이라 이번 sanitizer 변경(제어문자·원문 NFKC 비교)과 무관하다.

**확인 못 한 것**: 1차 raw 응답(어느 메시지에서 지어낸 키가 나왔는지)·타임아웃 원인(CLI 대기 vs 모델 생성 지연)·v3 와 v2 의 같은 시간대 교차 비교(이번 대조는 순차)·`stripAdditionalProperties` 의 실제 응답 재생·p95·운영 부하 하의 지연. **재발 가능한 함정**: ⓐ `ClaudeCliTimeoutError` 메시지가 "…상한 초과로 **중단**" 이라 래퍼에서 `중단` 을 한도 감지에 grep 하면 오탐(내 체인 스크립트가 한 번 멈춤 — 정규식은 `즉시 실패 2회 연속|session limit|429/사용 한도 감지` 로 좁힘) ⓑ 측정 스크립트는 `attempts==2` 의 위반 사유와 raw 1차 응답을 rows 에 저장하지 않아 사후 재생이 안 된다 — 후속 측정이 있으면 스크립트에 사유·raw(합성 입력이라 저장해도 안전)를 넣으면 좋다(이번엔 수정 금지라 하지 않음) ⓒ 서버 정리 통과율은 작은 표본(57/57)에서 낙관적이었다 — 큰 표본 53%(비null 의 94%).
**원자료**: scratchpad `pe039d/`(`rl-d1~d4.{json,log}` v3, `rl-h1~h2.{json,log}` v2 대조, 이전분 `pe039c/rl-v3*.json`) · 계산 `calc2.py`(v3)·`calc2-v2.py`(v2)·출력 `calc2.out`·`calc2-v2.out` · `strip-replay.mts`·`.out` · 실행 래퍼 `run.sh`·`run-head.sh`·`chain*.sh`·`chain.log`.

## Developer 기록

- [18:35] **dev-039(서버) 중간 체크포인트.** 완료: `prisma/schema.prisma`(`Correction.extraNoteKo String? @db.VarChar(400)` + `///` 주석 1줄) → 미러 `prisma generate` 만(**db push·DB 접속 변경 없음**, 운영 릴리스 `node_modules/.prisma` 는 미러와 별개임을 확인) · `checks.sanitizeExtraNoteKo(explanationKo, extraNoteKo, learnerText?)`(Codex C1 2건: 학습자 원문 통째 포함 → null(공백 제외 4자 이상), 공백류 한 줄 접기·제어문자 null·정규화 후 길이) · `orchestrator/shape.ts`(정리 위치)·`orchestrator/index.ts`(create·`SavedCorrection`)·`corrections/serialize.ts`(select·DTO)·`review/filter.ts`(`reviewExtraNote` — 메시지 전체·짚은 문장 둘 다로 원문 검사)·`review/index.ts`(create·`ReviewItemDto`) · `task039.test.ts:133` 단언 갱신. tsc rc=0, conversation 443/444(갱신 전 133 단언 1건 실패 — 갱신함). 남은 일: 서버 왕복 테스트 새 파일 `task039server.test.ts` · 문서 3종 · 최종 실행(conversation·tsc·eslint) · 인계. 다음 첫 행동: 새 테스트 파일 작성. 주의: 미러에서 dev 서버·라이브 스모크 금지(컬럼이 DB 에 없다 — 새 Prisma client 는 include/무 select 조회에서도 이 컬럼을 고른다). 미커밋: 위 파일 전부 + PE 산출.
- [18:50] **dev-039(서버) 완료 — Reviewer 인계.** 상태: 서버 구현·단위 테스트·문서 완료, **컬럼 미적용(db push 는 Leader)**. 화면은 dev-039b.

**변경 파일(내 손, 미커밋)**

| 파일 | 변경 |
|---|---|
| `prisma/schema.prisma` | `model Correction` 에 `extraNoteKo String? @db.VarChar(400)` + `///` 주석 1줄(승인 범위 컬럼 1개 그대로, 다른 컬럼·표 없음) |
| `src/modules/conversation/structuredResponse/checks.ts` | `sanitizeExtraNoteKo(explanationKo, extraNoteKo, learnerText?)` — **Codex C1 2건 반영**: ⓐ `learnerText`(서버가 가진 학습자 원문)를 공백을 뺀 비교로 통째 포함하면 null(원문 공백 제외 `EXTRA_NOTE_LEARNER_MIN`=4자 이상일 때만, 인자 생략 = 검사 없음 → 기존 두 인자 호출 호환) ⓑ 한 줄 정규화 `\s+`→공백 하나·trim, 정규화 **후** 길이(≤200)·제어문자(U+0000–001F·U+007F) 잔존 → null, 저장값은 정규화 문자열. 메인 설명 비교도 같은 정규화(개행이 달라도 베끼기 탐지). `explanationKo` 가 문자열이 아니어도 던지지 않음 |
| `src/modules/conversation/orchestrator/shape.ts` | `correction.extraNoteKo = sanitizeExtraNoteKo(c.explanationKo, c.extraNoteKo, text)` — `ShapedTurn.correction.extraNoteKo: string \| null`(정리 전 원값이 남지 않음) |
| `src/modules/conversation/orchestrator/index.ts` | `saveTurnTx` `tx.correction.create` 에 `extraNoteKo`(생성 시에만), `SavedCorrection.extraNoteKo` → SSE `done.correction` |
| `src/modules/conversation/corrections/serialize.ts` | `CORRECTION_SELECT.extraNoteKo` · `serializeCorrection` → `extraNoteKo: c.extraNoteKo ?? null` |
| `src/modules/conversation/corrections/index.ts` | `CorrectionUpdate` 에서 `extraNoteKo` 제외(갱신 경로 타입 차단 — `original` 과 같은 방식) |
| `src/modules/conversation/review/filter.ts` | `ReviewCorrectionDraft.extraNoteKo` · `reviewExtraNote()`(원문 검사를 **메시지 전체 + 짚은 문장 `original`** 양쪽으로) · `toDraft` 에서 한 번 정리해 draft 와 함께 운반 |
| `src/modules/conversation/review/index.ts` | `tx.correction.create`·`ReviewItemDto`·`out.push` 에 `extraNoteKo` |
| `src/modules/conversation/__tests__/task039.test.ts` | 133행 shape 단언 갱신(원값 → 정리값, 키 없음 → null, 원문 복사 → null) |
| `src/modules/conversation/__tests__/task039server.test.ts`(신규, 23건) | C1 원문 복사·공백 차이·조각/짧은 원문 통과·두 인자 호환 / 개행·CRLF·탭·\\v\\f·전각 공백 접기·NUL·DEL·ESC·U+001C·BS null·정규화 후 길이 200/201 / 기존 규칙 유지 / TALK 왕복 9경우(채움·null·키 없음·200 초과·메인 설명·엔진명·원문 포함·여러 줄·제어문자: shape = create.data = saved(done) = DTO) / 모르는 키 → create 칸 고정 / DTO select·옛 행 null / A3 병합 9경우·여러 후보(마지막 후보 값·재시도가 빠뜨린 항목은 앞 후보 값)·모르는 키 / `startTurn` TALK 전체: done 값 = 저장값, 강사 행 toolLog·교정 메타 toolLog·사용자 행 갱신·RequestTrace(가로챔 — DB 미기록)·콘솔에 추가 설명 문자열 0 / `@ts-expect-error` 로 `CorrectionUpdate` 에 original·extraNoteKo 불가 / 소스 스캔: `correction.create` 2곳(orchestrator·review)이 모두 extraNoteKo 를 싣는다 |
| `docs/design/api-contract.md` | #29 예시·task-039 줄(교정 객체 공통, #34·LATER 포함), #32 `done` 예시·정리 규칙 줄, #33 예시·추가 설명 단락 |
| `docs/design/domain-model.md` | Prisma 블록 `Correction.extraNoteKo`(생성 시에만·nullable·환경 분리 불필요·복습 미사용) · 엔티티 표 행 |
| `docs/design/learning-personalization-and-llm-data.md` | §2-1 아래 한 단락 — 추가 설명은 표시 전용, 관측·복습 뜻 스냅샷은 `explanation` 만 |

**실행 증빙(미러 `~/.node-local/thekaiwa`, `bash scripts/sync-local.sh` 뒤, 로그 scratchpad `conv2.log`·`tsc2.log`·`eslint1.log`·`rest1.log`)**: `prisma generate` 성공(`.prisma/client/index.d.ts` 에 extraNoteKo 54회) · conversation **467/467**(PE 기준 444 + 신규 23) · 나머지 모듈 전체 1075 중 pass 1074·fail 0·skip 1 · `tsc --noEmit` rc=0 · eslint(내가 바꾼 9개 파일) rc=0.

**컬럼 적용 전 실행 금지를 지킨 방법**: `db push`·DB 접속 설정 변경 없음 · 미러에서 dev 서버·라이브 스모크 실행 안 함(실행 중 next-server 7개의 cwd 확인 — 미러에서 도는 프로세스 0, 운영 `thekaiwa` 는 `apps/thekaiwa/releases/20261006-140216-5c3a7019` 의 **자기 `node_modules/.prisma`** 라 미러 generate 영향 없음) · 단위 테스트는 가짜 tx·`turnDeps` 대체·`prisma.requestTrace` 가로채기로 Correction 테이블을 읽고 쓰지 않는다. **주의(다음 사람)**: 새 Prisma client 는 select 없는 조회·`include` 에서도 이 컬럼을 고른다 → 미러에서 `npm run dev`·라이브 스모크(`tests/live/task006-smoke.ts:352` 의 select 없는 `findUnique` 등)는 **db push 뒤에만**. 배포 순서 = 백업 → `db push` → QA → 코드 배포(인계 9번 그대로).

**남은 위험·확인 못 한 것**
1. `[확인 못 함]` 실제 MariaDB 에서 insert/select — 컬럼이 없어 실행하지 않았다(QA 가 db push 뒤 라이브로).
2. `[가능성 높음]` 원문 복사 검사의 오탐: 학습자 원문이 공백 제외 4자 이상이고 추가 설명이 그 말을 통째 인용하면(예: 원문 「そうです」 를 설명이 「そうです」 로 인용) 정상 값도 null 이 된다. 4자 짧은 원문에서만 생길 수 있고 결과는 "줄 없음"(안전한 쪽). 실측 채움 39·57건 원자료로 다시 돌려 보지는 않았다(PE scratchpad 원자료에 학습자 문장이 따로 있어 확인 가능 — Reviewer/QA 판단).
3. `[추측]` `\s` 가 전각 공백(U+3000)·NBSP 도 공백 하나로 접는다 — 일본어 인용 안 전각 공백이 반각으로 바뀐다(표시 영향 미미).
4. Codex C1 권고 중 "Export 는 allowlist 로 필드 제외" — 이 저장소에 교정 Export 경로가 없어(grep: admin·learning·app/api) 해당 없음. 기록 조회(Phase 3 `getRecentCorrections`)가 생기면 그때 결정.
5. A3 저장(`review/index.ts` create·`ReviewItemDto`)은 DB 의존이 커서 **실행 테스트 대신** 타입(`ReviewItemDto` 필수 칸)과 소스 스캔 테스트로만 지켰다 — 라이브 확인은 QA.

**dev-039b(화면) 인계**
- 필드 이름·타입: **`extraNoteKo: string | null`**(카멜, 모든 응답 공통). `null` = 줄을 그리지 않는다(옛 행 포함). 값은 이미 한 줄·≤200자·한글 포함으로 정리돼 오므로 화면은 자르거나 다시 거르지 않는다.
- 들어오는 응답 객체: ① SSE `done.correction`(TALK, #32) ② #29 `GET /api/v1/chats/:id` 의 `messages[].corrections[]` ③ #34 `GET /api/v1/corrections`(목록·`chatId=`·`deliver=LATER` 모아 둔 교정 시트 모두) ④ #33 `POST /api/v1/chats/:id/review` 동기 결과 `items[]`(잡 경로는 ③ 으로 다시 읽음).
- 서버 타입 위치(참고, 화면에서 import 하지 말 것): `SavedCorrection`(`src/modules/conversation/orchestrator/index.ts`), `CorrectionDto = ReturnType<typeof serializeCorrection>`(`corrections/serialize.ts`), `ReviewItemDto`(`review/index.ts`). 화면 쪽 매핑 대상(dev-039b 영역, 내가 안 건드림): `src/types/chat.ts`(교정 DTO 84·195행 부근, `ReviewItemDto` 231행), `src/components/chat/messages.ts:103`, `ChatReview.tsx:59 normalizeItem`, `TalkCorrectionCard.tsx`·`CorrectionCard.tsx`.
- 키 이름이 응답마다 같다(#33 항목도 `extraNoteKo` — A3 원응답의 snake_case `extra_note_ko` 는 서버에서 끝난다).

**다음 첫 행동(Leader)**: Reviewer 감사 → PASS 면 백업 → 미러 `prisma db push` → QA 라이브(006·007 스모크·추가 설명 저장 확인) → dev-039b 화면은 병행 가능(서버 DTO 확정).

### dev-039b (화면)

- [18:56] **중간 체크포인트.** 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED` / `status: approved` · `approved_version: v1`. 완료(미커밋): ① 공용 「」 도구 `common/japanese/jaQuotes.ts`(`splitJaQuotes` 이동)·`JaQuoted.tsx`(TeacherWhy 에서 이동 — 데모 개발 메모 ③), `lesson/review/reviewLogic.ts` 는 re-export(기존 import·테스트 유지), `TeacherWhy.tsx` 는 공용 import ② `types/chat.ts` — `CorrectionDto`·`TurnCorrection`·`ReviewItemDto` 에 `extraNoteKo?: string | null`(옛 응답에 없을 수 있어 선택) ③ `chat/messages.ts` — `correctionFromDone` 이 `extraNoteKo: c.extraNoteKo ?? null`, `ChatReview.normalizeItem` 을 순수 `correctionFromReviewItem` 으로 옮겨 테스트 가능하게(같은 매핑 + `extraNoteKo ?? null`) ④ `chat/labels.ts` `EXTRA_NOTE_LABEL`(D3-A) ⑤ 새 `chat/ExtraNoteLine.tsx`(접힘 시작·글자 버튼 `min-h-11 w-full`·`aria-expanded`·`aria-controls=cr_{id}_xn`·`aria-describedby=cr_{id}_head`·▾/▴ aria-hidden·펼친 상자 `border-l-2 border-line pl-3 text-[14px] text-ink2`·「」만 lang=ja·`motion-safe:` 160ms 페이드·null/빈/공백 → 렌더 없음) ⑥ `CorrectionCard.tsx` 설명 바로 아래·PROPOSED 안내 위에 줄(상태 무관), 머리줄 id 는 추가 설명이 있을 때만(옛 카드 DOM 그대로) ⑦ 스크롤 따라가기(⑧): 새 `chat/followHold.ts` 컨텍스트 + `MessageList` 가 펼침 직후 500ms 안 첫 높이 증가는 따라가지 않고 실제 위치로 바닥 여부를 다시 잼, 펼친 줄은 `scrollIntoView({block:'nearest'})` ⑧ `globals.css` `@keyframes extra-note-in`(색 없음). TalkCorrectionCard·LaterCorrectionsSheet 는 `CorrectionCard` 를 쓰므로 무변경(코치 힌트 숨김 카드는 줄 없음). 남은 일: 테스트 파일·`turnAudio.test.ts` deepEqual 에 `extraNoteKo: null` 1줄·Tailwind 임의 변형 컴파일 확인·테스트/tsc/eslint 실행·기록. 미커밋 파일: 위 전부.
- [19:00] **dev-039b(화면) 완료 — Reviewer 인계.** 데모 게이트 `DEMO_GATE_PASSED`(approved v1, sha256 212d9e93…). 데모 v1(D1~D4=A)과 다르게 구현한 곳 **없음**. 서버(`src/modules/**`)·프롬프트·prisma·`docs/screens.md`·데모 파일 미수정, 커밋 없음.

**변경 파일(내 손, 미커밋)**

| 파일 | 변경 |
|---|---|
| `src/components/chat/ExtraNoteLine.tsx`(신규) | 접이식 줄 한 컴포넌트 — `ExtraNoteView`(모양만: 글자 버튼 `min-h-11 w-full min-w-0`·`aria-expanded`·`aria-controls=cr_{id}_xn`·`aria-describedby`·▾/▴ `aria-hidden`·`focus-visible` 링 / 상자 `hidden`·`border-l-2 border-line pl-3 text-[14px] leading-[1.6] text-ink2 break-keep [overflow-wrap:anywhere]`·일본어 조각 `word-break:normal`·`motion-safe:` 160ms 페이드) + `ExtraNoteLine`(로컬 `useState(false)`·값 없음/빈/공백 → `null` 렌더·펼칠 때만 따라가기 유예 + `scrollIntoView({block:'nearest'})`, reduced-motion 이면 `auto`) · `hasExtraNote`·`extraNoteBoxId` |
| `src/components/chat/followHold.ts`(신규) | `FollowHoldContext`·`FOLLOW_HOLD_MS`(500)·순수 `contentGrowthAction(now, holdUntil, atBottom)` |
| `src/components/chat/MessageList.tsx` | 컨텍스트 제공 · 내용 증가 RO: 유예 안 첫 증가 = 따라가지 않고 실제 위치로 바닥 여부 재측정(벗어났으면 "새 메시지 ↓" 기준 id 기록), 그 밖은 기존 규칙 그대로 |
| `src/components/chat/CorrectionCard.tsx` | 설명 바로 아래·PROPOSED 안내/채택·무시 위에 `<ExtraNoteLine>`(상태 무관 — 채택·무시·기한 지남 뒤에도) · 머리줄 `id=cr_{id}_head` 는 **추가 설명이 있을 때만**(옛 카드 마크업 완전 동일 — 테스트로 단언) |
| `src/components/chat/labels.ts` | `EXTRA_NOTE_LABEL = { more: '시험 문법 더 보기', less: '시험 문법 접기' }`(D3-A) |
| `src/components/chat/messages.ts` | `correctionFromDone` → `extraNoteKo: c.extraNoteKo ?? null` · `ChatReview` 의 `normalizeItem` 을 순수 `correctionFromReviewItem`(#33 → 교정 모양, 같은 매핑 + `extraNoteKo ?? null`)으로 이동 |
| `src/components/chat/ChatReview.tsx` | `normalizeItem` 삭제 → `correctionFromReviewItem` 사용(동작 동일) |
| `src/types/chat.ts` | `CorrectionDto`·`TurnCorrection`·`ReviewItemDto` 에 `extraNoteKo?: string \| null`(옛 응답·옛 화면 상태에 없을 수 있어 선택 — 매핑 함수가 null 로 맞춤) |
| `src/components/common/japanese/jaQuotes.ts`·`JaQuoted.tsx`(신규) | 데모 개발 메모 ③ "공용 위치로 옮겨 재사용" — `splitJaQuotes`·`JaQuoted` 이동(코드 동일) |
| `src/components/lesson/review/reviewLogic.ts`·`TeacherWhy.tsx` | 이동한 것을 re-export·import(복습 화면 동작·기존 테스트 import 경로 불변) |
| `src/app/globals.css` | `@keyframes extra-note-in`(opacity·2px 이동만 — 색 없음) |
| `src/components/chat/__tests__/extraNote.test.ts`(신규, 20건) | 아래 |
| `src/components/chat/__tests__/turnAudio.test.ts` | `correctionFromDone` deepEqual 기대값에 `extraNoteKo: null` 1줄 추가(새 칸이 늘 실리므로 — 기존 단언 내용은 그대로) |

**`TalkCorrectionCard.tsx`·`LaterCorrectionsSheet.tsx` 무변경**: 둘 다 `CorrectionCard` 를 쓰므로 같은 줄이 그대로 붙는다(D4-A). 코치 힌트 숨김 카드(정답 보기 전)는 `CorrectionCard` 를 안 써서 줄이 없고, 정답 보기 뒤 새로 마운트돼 접힌 채 시작(#talk-coach) — 테스트로 고정.

**테스트(`extraNote.test.ts` 20건 — DOM 라이브러리 없음, `renderToStaticMarkup`)**: ① null·undefined·빈·공백 → 빈 마크업, 옛 교정(필드 없음) = null = 공백 카드 마크업 완전 동일·줄/머리줄 id/이름/aria 없음 ② 값 있음 → 접힘 시작·버튼 이름·`aria-expanded="false"`·`aria-controls`·상자 `hidden`, 펼친 모양(`ExtraNoteView open`) → '시험 문법 접기'·▴·`aria-expanded="true"`·hidden 없음 ③ 매핑: `correctionFromDone`·`correctionFromReviewItem` 필드 누락 → null, 값은 공백 포함 그대로, #33 매핑 나머지 칸 = 옛 `normalizeItem` 과 같음 ④ 「」 조각만 `lang="ja"`(4개)·`<ruby>/<rt>`/한글 줄 없음·글 그대로(199자 안 자름)·엔진명 정규식 0 ⑤ 카드 안 순서(설명 < 줄 < 채택 안내 < [채택])·설명 없어도 줄·ACCEPTED/REJECTED/EXPIRED 뒤에도 줄 · 코치 힌트 전 없음/후 접힘 · 시트가 `CorrectionCard` 사용(소스) · 360 대비 클래스(`min-w-0`·`w-full`·`break-keep`·`[overflow-wrap:anywhere]`)·새 색 없음·애니메이션은 `motion-safe:` 만 · 스크롤 판정 `contentGrowthAction` 5경우 + MessageList/ExtraNoteLine 소스(유예는 펼칠 때만·한 번 쓰고 지움·nearest).

**실행 증빙(미러 `~/.node-local/thekaiwa`, `scripts/sync-local.sh` 뒤, 로그 scratchpad `t39b-*.log`·`tsc39b.log`·`eslint39b.log`)**: 새 테스트 **20/20** · `src/components`+`src/types` 전체 **480/480**(fail 0·skip 0) · DB 안 쓰는 `src/app` 테스트 2파일 **4/4** · `tsc --noEmit` **rc=0** · eslint(바꾼 14개 파일) **rc=0, 0 problems** · Tailwind 컴파일 확인(`@tailwindcss/node` `compile().build`): `[&_[lang=ja]]:[word-break:normal]` → `… [lang=ja] { word-break: normal }`, `motion-safe:animate-[extra-note-in_160ms_ease-out]` → `@media (prefers-reduced-motion: no-preference)` 안에만 생성. **실행 안 한 것**: dev 서버·라이브 스모크·`next build`·`src/modules` 테스트·DB 접속(컬럼 미적용 — 지시대로).

**남은 위험·확인 못 한 것**
1. `[확인 못 함]` 실화면 360/390/412 가로 넘침·펼친 상자 높이·터치 44px 실측 — 컬럼 `db push` 뒤 QA(데모 실측: ② 긴 설명 360 에서 167px).
2. `[확인 못 함]` 스크롤 따라가기 실동작(ResizeObserver·`scrollIntoView` 순서) — 판정 함수만 단위 테스트, 브라우저 미실행. `[가능성 높음]` 펼친 상자가 바닥 근처 120px 를 넘게 밀면 "바닥 아님"으로 바뀌어 이후 선생님 문장은 따라가지 않고 새 메시지에서 "새 메시지 ↓" 가 뜬다(기존 규칙과 같은 판정 — 의도).
3. `[추측]` 회화방 목록이 `role="log" aria-live="polite" aria-relevant="additions"` 라 상자를 펼칠 때 스크린리더가 내용을 한 번 더 읽을 수 있다(데모 회화방도 같은 role=log 구조 — 디자인 판단 필요 시 Leader→designer).
4. 펼친 상태는 카드 로컬이라 회화방에서 목록을 다시 읽어도(key=교정 id 유지) 남지만, 화면을 나갔다 오면 접힌다(D2-A 의도).

**QA 에 넘길 체크(db push 뒤)**: ① 360/390/412 × 표현 점검(①N5 짧은 값·②N3 긴 값·③null)·회화방 인라인·모아 둔 교정 시트 — 가로 넘침 0·버튼 높이 ≥44px·카드 폭 전체가 눌림 ② 키보드 Tab → Enter/Space 로 펼침·접힘, 포커스 링, `aria-expanded` 토글·스크린리더가 "시험 문법 더 보기, 버튼, 접힘" + 카드 머리줄(유형) 읽음 ③ 회화방에서 바닥 근처 카드 펼치기 → 누른 줄이 위로 튀지 않음, 선생님 말하는 중 펼쳐도 재생·녹음 영향 없음, 펼친 상자가 화면 밖이면 그만큼만 스크롤 ④ 코치 힌트: 정답 보기 전 줄 없음 → 보기 뒤 접힘 ⑤ 채택·무시 뒤 줄 유지 ⑥ 옛 교정(NULL) 카드가 지금과 같음 ⑦ reduced-motion 에서 페이드 없음 ⑧ 다크 모드 왼쪽 선·글자 색(기존 토큰) ⑨ 히라가나·한글 토글을 켜도 상자 안에는 루비·한글 줄 없음.

### dev-039c (REV-115 L-1·M-1 / Codex C2)

- [20:2x] **중간 체크포인트.** 완료(미커밋): ① `checks.ts` — `\p{Cf}` 거부(접기 전 원값 검사, U+FEFF 가 JS `\s` 라 접기 전이어야 함)·`oneLine` 이 U+0085 도 접음·`hasControlChar` 에 U+0080–009F 추가·원문 비교 `comparable`(NFKC + `[\s\p{P}]` 제거, 하한 정규화 후 4자) ② `jaQuotes.ts` 에 `splitJaRuns` 추가(`splitJaQuotes` 무변경) + 새 `JaRuns.tsx` · `ExtraNoteLine` 만 `JaRuns` 로 교체(`TeacherWhy`·`JaQuoted` 무변경) ③ 테스트: `task039server` +6건, `extraNote` +5건·기존 ④ 단언(「」 만 4개 → 5개, NOTE 의 「い형용사」 い) 갱신 — 두 파일 54/54. 실데이터 재생(옛 판 함수를 스크립트에 그대로 옮겨 항목별 대조, `scratchpad/d39c/replay.mts`): TALK 39 → 옛 34·새 34 **항목별 차이 0**, A3 57 → 57·57 **차이 0**, 서식·C1·줄 구분 문자 포함 원값 0. `splitJaRuns` 재생(`d39c/runs.mts`): 96건 중 「」 밖 일본어가 lang 없이 남은 값 96 → **0**, 「」 밖 ja 구간 중 한글·라틴·숫자 포함 0, 글 복원 불일치 0. 남은 일: conversation·components 전체·tsc·eslint·기록. 주의: 도구 입력에서 `<U+2028>`·`<U+FEFF>` 등이 **실제 보이지 않는 문자로 바뀌어** 파일에 들어갔다 — python 으로 이스케이프로 되돌리고 6개 파일 Cc/Cf/Zl/Zp 스캔 0 확인(재발 가능 함정). 데모 게이트 `check.mjs check` 는 화면 파일 첫 편집 **뒤**에 실행했다(결과 `DEMO_GATE_PASSED`, approved v1 — 순서 위반은 기록해 둔다).
- [20:46] **dev-039c 완료 — Reviewer 인계.** 범위: REV-115 L-1(ⓐ·ⓑ)·M-1 + Codex C2 low 1건. 프롬프트·persona·스키마·`prisma/**`·서버 저장 경로(orchestrator·review·serialize)·`JaQuoted`·`TeacherWhy`·`reviewLogic` 무변경, db push·dev 서버·라이브 스모크·배포·커밋 없음. `native_change: false`.

**변경 파일(내 손, 미커밋)**

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/structuredResponse/checks.ts` | `FORMAT_CHAR_RE=/\p{Cf}/u` 를 **접기 전 원값**에 검사 → null · `oneLine` 이 `[\s\u0085]+` 접기 · `hasControlChar` 에 U+0080–009F · 원문 비교 `comparable`(NFKC → `[\s\p{P}]` 제거, 양쪽 같은 정규화, 하한 = 정규화 후 4자) · `noSpace` 제거 · 접기/거부 표 주석 1단락. 두 인자 호출 호환·정규화 뒤 길이(≤200)·제어문자 재검사 순서 유지. 호출부(`shape.ts`·`review/filter.ts`)는 그대로 — 새 동작이 자동 적용 |
| `src/components/common/japanese/jaQuotes.ts` | `splitJaRuns` 추가(`splitJaQuotes` 무변경) — 「」 조각은 그대로, 밖 글에서 가나·한자 1자 이상 연속 구간만 ja. 장음·반복·〜～・ｰﾞﾟ゛゜ 는 가나·한자와 붙을 때만, 、。 는 일본어 사이에 낄 때만 이어 붙임 |
| `src/components/common/japanese/JaRuns.tsx`(신규) | `JaQuoted` 와 같은 span 구조 + 「」 밖 구간 `lang="ja" style="word-break:inherit"`(아래 줄바꿈 실측) |
| `src/components/chat/ExtraNoteLine.tsx` | `<JaQuoted>` → `<JaRuns>`(1줄) + 머리 주석. 상자·버튼 클래스 무변경 |
| `src/modules/conversation/__tests__/task039server.test.ts` | +6건(NEL·U+2028/2029 접기, `\p{Cf}` 24개 코드포인트 × 앞/중간/끝 거부·BOM 이 `\s` 라 접기 전 검사 근거·덮어쓰기 뒤집힌 값, C1 7개 거부·NBSP 접기, NFKC·구두점 원문 복제 6경우 + A3 `reviewExtraNote` 2경우, 하한 정규화 후 3/4자·전각 저장값 보존·두 인자 호환, 정상 문형 설명 7개 통과) |
| `src/components/chat/__tests__/extraNote.test.ts` | ④ 단언 갱신(「」 만 4 → 5, NOTE 「い형용사」 의 い) + 6건(「〜たら(N4): 동사 た형+ら」 분할·ja 구간에 한글/숫자/괄호 없음·글 그대로, 빈/일본어만/한글만/혼합/「3〜7일」/ー 단독/・/、。/반각, 「」 밖 일본어 없으면 `JaRuns`=`JaQuoted` 마크업·`splitJaRuns`=`splitJaQuotes`, `TeacherWhy`·`reviewLogic` 재노출 불변, 줄바꿈 style 은 「」 밖만·상자 클래스 불변·글꼴/색/크기 style 없음, null/빈 → 줄 없음·루비 없음) |

**접기·거부 문자 표**(코드 주석과 동일)

| 문자 | 처리 |
|---|---|
| JS `\s` 공백류(U+0009–000D·0020·00A0·1680·2000–200A·202F·205F·3000) + 줄바꿈류 U+0085(NEL)·U+2028·U+2029 | 공백 하나로 **접기** |
| `\p{Cf}` 전부 — U+200B–200F(ZWSP·ZWNJ·ZWJ·LRM·RLM)·U+202A–202E·U+2060–2064·U+2066–2069·U+FEFF·U+00AD·U+061C·U+E0001·U+E0020–E007F(태그) 등 | **거부**(접기 전 원값으로 — U+FEFF 는 `\s` 라 접은 뒤엔 사라져 통과했다) |
| 접은 뒤 남은 U+0000–001F·U+007F·U+0080–009F | **거부**(기존 C0·DEL + C1) |

결정 근거: Leader 권고(거부)를 따랐고, 지시 목록보다 넓게 `\p{Cf}` 전체를 택했다 — 목록 밖 BiDi 표시(U+061C ALM)·태그 문자(보이지 않는 글 숨기기에 쓰임)도 같은 이유로 막아야 하고, 실데이터 96건에 Cf 가 0건이라 오탐 비용이 없다. 변이 선택자(U+FE00–FE0F·U+E0100–)는 Cf 가 아니라(Mn) 통과.

**줄바꿈 처리 — 지시와 다르게 한 곳(Leader 판단 필요)**: 지시는 "「」 밖 일본어 span 도 데모 개발 메모 ③(일본어 조각 `word-break:normal`)을 따른다"였으나, 상자의 `[&_[lang=ja]]:[word-break:normal]` 을 그대로 받으면 「」 밖 짧은 문형이 한국어 어절 한가운데서 끊긴다. 헤드리스 Chrome(`/usr/bin/google-chrome`, 정적 HTML — dev 서버 아님) 실측, 실제 출력 94건(중복 제거) × 폭 150~320px 2px 간격 86단계, 현재 마크업(`JaQuoted`) 대비 줄 내용이 달라진 경우: **normal = 50건·932경우**(「〜てください: 동사て / 형+ください」·「어간+ま / しょう」·「きれい·親 / 切」) vs **`word-break:inherit` = 2건·2경우**(글꼴이 일본어로 바뀌며 글자 폭이 달라 줄 끝 어절 하나가 넘어감 — 폭 188·246px 각 1회). 그래서 「」 밖 구간만 `style="word-break:inherit"`(둘레 한국어 keep-all 을 따름), 「」 조각은 기존대로 normal. 가로 넘침은 3방식 모두 같은 1건(폭 150px, 기존부터 있음). 스크립트·결과: scratchpad `d39c/page.mts`·`lb-out3.html`. Tailwind 클래스 대신 인라인 style 을 쓴 이유: 상자의 `[lang=ja]` 규칙(특이성 0,2,0)을 클래스로 이기려면 `!important` 가 필요한데 저장소에 그 관례가 없다.

**데모와 달라진 시각 요소**: 「」 밖 일본어 구간(예 「〜たら」)이 `:lang(ja)`(globals.css) 를 받아 **일본어 글꼴(한자 일본식 자형)·`line-break:strict`** 로 그려진다 — 「」 안 조각과 같은 모양으로 통일되는 것이고 screens.md §1-2 규칙("일본어가 들어가는 요소는 lang=ja")과 일치. 크기·색·자간·여백·줄바꿈 규칙(keep-all)은 그대로. 승인 데모 예시는 전부 「」 안이라 데모 화면 자체와의 차이는 없다.

**실행 증빙**(미러 `~/.node-local/thekaiwa`, `bash scripts/sync-local.sh` 뒤, `env -u DATABASE_URL`, 로그 scratchpad `d39c/`): conversation 전체 **473/473**(fail 0·skip 0, 467 + 6) · `src/components`+`src/types` **486/486**(fail 0·skip 0, 480 + 6) · `tsc --noEmit` **rc=0, 출력 0줄** · eslint(바꾼 6개 파일) **rc=0, 0 problems** · 바꾼 파일 Cc/Cf/Zl/Zp 리터럴 스캔 0.

**실데이터 재생**(옛 판 `sanitizeExtraNoteKo` 를 스크립트에 그대로 옮겨 항목별 대조, `d39c/replay.mts`): TALK 원값 39 → 옛 34·새 34, **항목별 차이 0** · A3 57 → 옛 57·새 57(`reviewExtraNote`, 짚은 문장 포함), **차이 0** · 원값 중 서식·C1·줄 구분 문자 포함 0 → 오탐 변화 없음, 정규화 범위 축소 불필요. Reviewer `rev115/fp.mts`·`fp3.mts` 재실행도 34/34·57/57. `splitJaRuns` 재생(`d39c/runs.mts`, 96건): 「」 밖 일본어가 lang 없이 남은 값 96 → **0**, ja 구간 187개 중 「」 밖인데 한글·라틴·숫자 포함 0, 글 복원 불일치 0.

**남은 위험·확인 못 한 것**
1. `[확인 못 함]` 실기기(S25+) 글꼴: 서버 Chrome 에는 Noto Sans JP 가 없어 대체 글꼴로 쟀다 — 폭 차이로 줄 끝 어절이 넘어가는 경우(위 2경우)는 기기 글꼴에 따라 다를 수 있다. QA 3폭 실측 때 「」 밖 문형 줄을 같이 볼 것.
2. `[추측]` 스크린리더(TalkBack)가 짧은 ja 구간(「た」「ら」 한 글자)마다 언어를 바꿔 읽으며 끊기는 느낌이 날 수 있다 — 실측 전에는 판단 불가(M-1 의 목적과 맞바꾼 비용). QA SR 실측 항목에 추가 권고.
3. `[가능성 높음]` `\p{Script=Han}` 은 한국어 속 한자도 일본어로 본다 — 실데이터 0건, 추가 설명 맥락상 드묾.
4. 원문 비교 하한: 정규화가 구두점을 빼므로 「はい、そうです。」 같은 원문은 이제 6자로 검사 대상(전엔 공백만 빼서 8자 — 어차피 대상). 짧은 원문 전체를 설명이 「」 로 인용하면 null 이 되는 기존 한계(dev-039a 위험 2)는 그대로 — 실데이터 0건.
5. 함정(재발 가능): 이 세션 도구 입력에서 `'<U+2028>'`·`'<U+FEFF>'`·`'<U+202E>'` 같은 이스케이프가 **실제 문자로 풀려** 파일·스크립트에 들어갔다(정규식 리터럴에 U+2028 이 들어가 "Unterminated regular expression"). 보이지 않는 문자를 다루는 코드는 저장 뒤 python `unicodedata.category` 스캔으로 확인할 것.

**다음 첫 행동(Leader)**: Reviewer 재감사(범위: 위 6개 파일 + 줄바꿈 처리 판단 — `inherit` 채택 여부는 Leader/designer) → 그 뒤 기존 H-1 순서(백업 → `migrate diff` → db push → QA).

### dev-039d (REV-116 L-7·L-8 / Codex C2 3차)

- [21:59] **중간 체크포인트.** 완료(미커밋): ① `checks.ts` — `FORMAT_CHAR_RE` → `INVISIBLE_CHAR_RE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cs}\u{2800}]/u`(접기 전 원값 검사 유지)·`comparable` 이 같은 집합도 지움·메인 설명 복제 검사를 `comparable(t).includes(comparable(main))`(빈 결과면 건너뜀) ② `task039server.test.ts` +5건 ③ `api-contract.md:792` 정리 규칙 문장 교체. 미러 결과: conversation **478/478**·components+types **486/486**·tsc rc=0(0줄)·eslint 2파일 rc=0(0줄), 변이 4종(옛 거부 집합·comparable 확장 제거·옛 메인 비교·빈 문자열 건너뛰기 제거) 전부 테스트가 잡음. 실데이터 재생 TALK 39·A3 253(57+196) 옛 판 대비 **차이 0**. 남은 일: 주석·NBSP 이스케이프 정리 뒤 재실행·최종 기록. 주의: 첫 스캔에서 내 주석의 이모지 예시(U+2764 U+FE0F 리터럴)와 dev-039c 의 NBSP 리터럴(테스트 128행)이 잡혀 둘 다 이스케이프 글로 바꿨다.
- [22:01] **dev-039d 완료 — Reviewer 인계.** 범위: REV-116 L-7·L-8 + Codex C2(3차) low 1건. 프롬프트·persona·스키마·`prisma/**`·서버 저장 경로(orchestrator·review·serialize)·화면 무변경, db push·dev 서버·라이브 스모크·DB 읽기·배포·커밋 없음. `native_change: false`. A3 경로(`review/filter.ts` `reviewExtraNote`)는 코드 그대로 새 규칙을 자동으로 받는다.

**변경 파일(내 손, 미커밋)**

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/structuredResponse/checks.ts` | `FORMAT_CHAR_RE` → `INVISIBLE_CHAR_RE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cs}\u{2800}]/u`(접기 **전** 원값 검사, 순서 그대로) · `comparable` 이 NFKC 뒤 `[\s\p{P}]` + 같은 보이지 않는 문자 집합도 지움(비교 **상대** — 학습자 원문·메인 설명 — 에 낀 문자로 복제를 놓치지 않게) · 메인 설명 복제 검사 `main && t.includes(main)`(oneLine) → `main && comparable(t).includes(comparable(main))`(정규화 결과가 빈 문자열이면 건너뜀) · 접기/거부 표 주석 2행 추가, 이모지 거부 근거 주석 1줄, docstring ②⑥⑦ 갱신 |
| `src/modules/conversation/__tests__/task039server.test.ts` | +5건(①-c): 거부 15종(U+FE0F·FE00·E0100·034F·3164·115F·1160·FFA0·17B4·180B·2800 + 짝 없는 서로게이트 D800·DBFF·DC00·DFFF) × 앞/중간/끝, 한글 채움 단독·유일한 "한글"·FFA0+진짜 한글·FE0F 이모지 시퀀스 null, 짝 맞는 서로게이트(𠮷 U+20BB7) 통과 / 15종 × {원문·메인 설명 각 글자 사이에 끼운 추가 설명, 원문·메인 설명 **쪽**에 낀 문자 + 깨끗한 복제} + Cf 3종 비교 상대 쪽 + A3 메시지 CGJ / 메인 설명 띄어쓰기·구두점·전각만 바꾼 베끼기 null·일부 겹침 통과 / 메인 설명이 정규화 후 빈 문자열(``·공백·`。、！？`·`「」`·ZWSP·U+3164)이면 건너뜀 / 정상 문형 8개(전각 괄호·장음·・·促音·「〜たい(希望)」 류) 통과 · 128행 NBSP 리터럴 → `\u{a0}` 이스케이프(값 동일) · 보이지 않는 문자는 전부 `String.fromCodePoint`/`fromCharCode` 로 생성 |
| `docs/design/api-contract.md:792` | 정리 규칙 문장 교체(L-8) — ① 거부(접기 전): `\p{Cf}`·`\p{Default_Ignorable_Code_Point}`(→ FE0F 이모지 포함)·U+2800·짝 없는 서로게이트 ② 접기: JS `\s`·U+0085·U+2028·U+2029 ③ 그 밖 null: 공백뿐·접은 뒤 200자 초과·접은 뒤 C0/C1/DEL·한글 0·메인 설명 복제·학습자 말 통째 포함·엔진명, 두 복제 비교는 NFKC + 공백·구두점·①문자 제거 뒤(원문은 정규화 후 4자 이상만, 메인은 빈 결과면 건너뜀). `domain-model.md:1173-1176`·`api-contract.md:730`("≤200자·개행 없음")·`:826`("TALK 과 같은 정리")·`learning-personalization…md:169`(칸만 언급)은 여전히 맞아 무변경 — grep `공백을 뺀 비교\|제어문자\|4자` 로 다른 서술 없음 확인 |

**최종 접기·거부 문자 표**(코드 주석과 동일)

| 문자 | 처리 |
|---|---|
| JS `\s` 공백류(U+0009–000D·0020·00A0·1680·2000–200A·202F·205F·3000) + U+0085(NEL)·U+2028·U+2029 | 공백 하나로 **접기** |
| `\p{Cf}` 전부(U+200B–200F·202A–202E·2060–2064·2066–2069·FEFF·00AD·061C·180E·E0001·E0020–E007F 등) | **거부**(접기 전 원값) |
| `\p{Default_Ignorable_Code_Point}` — U+034F·115F·1160·3164·FFA0·FE00–FE0F·E0100–E01EF·17B4·17B5·180B–180F·FFF0–FFF8·1BCA0–1BCA3 등(Cf 와 겹치는 것 포함) | **거부**(접기 전) — 따라서 U+FE0F·ZWJ 가 든 이모지 시퀀스도 거부 |
| U+2800(점자 빈 칸 — 기본 무시 문자 아님) · 짝 없는 서로게이트(`\p{Cs}` — 짝 맞는 쌍은 하나의 코드 포인트라 해당 없음) | **거부**(접기 전) |
| 접은 뒤 남은 U+0000–001F·U+007F·U+0080–009F | **거부** |
| 위 거부 집합 | 복제 비교(`comparable`)에서는 **지우고** 비교(추가 설명 쪽은 이미 거부, 상대 쪽만 실효) |

결정 근거: 한글 채움 U+3164·U+115F·U+1160 은 `EXTRA_NOTE_HANGUL_RE` 범위 안이라 한글 검사보다 먼저 걸러야 했다 — 거부를 접기 전 맨 앞에 두는 기존 순서가 이를 보장해 정규식만 넓혔다(한글 정규식은 그대로). U+FEFF 가 JS `\s` 인 것과 같은 이유로 거부는 접기 **전** 원값에서. Node 20.20.2 에서 각 코드 포인트·짝 없는 서로게이트(앞·중간·끝)·짝 맞는 쌍(비해당)·`normalize('NFKC')` 가 짝 없는 서로게이트에 던지지 않음을 먼저 실측했다. NFKC 는 U+3164·U+FFA0 → U+1160 으로 바꾸고 U+1160 도 기본 무시 문자라 비교에서 함께 지워진다.

**실행 증빙**(미러 `~/.node-local/thekaiwa`, `bash scripts/sync-local.sh` 직후 미러·NFS 두 파일 `cmp` 동일, `env -u DATABASE_URL`, 로그 scratchpad `d39d/` — 최종값은 주석·NBSP 정리 **뒤** 재실행분 `*2.log`): conversation 전체 **478/478**(fail 0·skip 0 = 473 + 5) · `src/components`+`src/types` **486/486**(fail 0·skip 0) · `tsc --noEmit` **rc=0, 출력 0줄** · eslint(`checks.ts`·`task039server.test.ts`) **rc=0, 출력 0줄** · task039server+task039 두 파일 53/53. **변이 검사**(미러 사본에만 적용 후 원복, `cmp` 동일 확인): M1 거부 집합을 옛 `\p{Cf}` 로 → 1건 실패 · M2 `comparable` 확장 제거 → 1건 · M3 메인 비교를 옛 `oneLine`+`includes` 로 → 2건 · M4 빈 문자열 건너뛰기 제거 → 2건 — 새 테스트가 4변이 모두 잡음(`mut1~4.log`).

**보이지 않는 문자 리터럴 스캔**: 변경 3파일에 `grep -nP`(U+0080–009F·00A0·00AD·034F·061C·115F·1160·17B4·17B5·180B–180F·200B–200F·2028–202E·2060–206F·2800·3164·FE00–FE0F·FEFF·FFA0·E0000–E0FFF) **0건**(양성 대조 파일 4줄 잡힘 — grep 동작 확인) + python `unicodedata` Cc(개행·탭 제외)/Cf/Zl/Zp/Cs/Co·위 목록 스캔 3파일 **모두 0**. 첫 스캔에서 잡힌 2건(내 주석의 ❤ 뒤 U+FE0F, dev-039c 테스트 128행 NBSP)은 이스케이프 글로 바꾼 뒤 0.

**실데이터 재생**(`d39d/replay.mts` — dev-039c 판 함수를 스크립트에 그대로 옮겨 항목별 대조): TALK 원값 39 → 옛 34·새 34, **차이 0** · A3 `pe039c` rl-v3·v3b·v3c 57 → 57·57, **차이 0** · A3 `pe039d` rl-d1~d4 196 → 180·180, **차이 0**(버려진 16건은 둘 다 한글 없음 — REV-116 재확인과 같음) · **새로 버려지는 정상 값 0** · 원값·메인 설명·학습자 원문 중 거부 집합 문자 포함 0, U+FE0F·ZWJ 포함 0(이모지 성격 문자는 ↔ U+2194 1건·→ U+2192 4건 — FE0F 없어 통과) · 정규화한 메인 설명 최소 길이 35자.

**남은 위험·확인 못 한 것**
1. `[확인]` 사용자 영역(U+E000–F8FF, Co)·미할당(Cn)·FE0F 없는 이모지(😊·↔)는 통과한다 — 보이지 않는 문자가 아니라(두부 상자·그림으로 보임) 지시 범위 밖으로 두었다. 막아야 한다면 Leader 판단.
2. `[가능성 높음]` 모델이 화살표를 `↔`+U+FE0F(FE0F 붙음)로 쓰면 그 추가 설명은 통째로 버려진다(줄이 안 보일 뿐) — 실데이터 0/292. 일본 한자 이체자 선택자(IVS U+E0100–)도 같은 처리 — 실데이터 0.
3. `[확인]` 메인 설명 복제 검사에 최소 길이가 없다(지시대로 빈 결과만 건너뜀) — 정규화 결과가 1~3자인 아주 짧은 메인 설명이면 그 글자를 포함한 정상 추가 설명이 버려질 수 있다. 옛 `includes` 도 같은 성질이었고 정규화로 범위가 조금 넓어졌다. 실데이터 최소 35자라 영향 0.
4. `[확인]` REV-116 의 `～`(U+FF5E → NFKC `~`, Sm) 비대칭은 그대로(범위 밖, 실영향 거의 0).
5. 관찰(범위 밖, 손대지 않음): 이 이력서 파일 자체에 보이지 않는 문자 리터럴 11개가 있다 — 373·410행(dev-039c 기록: U+2028·FEFF·202E)·470행(REV-115 기록: U+200B·200F·202A·202E·2066·2069). U+202E(RLO)는 Obsidian 표시 순서를 뒤집을 수 있다 — Leader 가 해당 기록 소유자에게 이스케이프 글로 바꾸게 할지 판단.

**다음 첫 행동(Leader)**: Reviewer 재감사(범위: 위 3파일 — 작음) → 그 뒤 기존 H-1 순서(백업 → `migrate diff` → db push → QA).

## Codex 검토

### [2026-10-06 09:32] C1 adversarial-review focus=data_integrity — done

- judge 판정: [2026-10-06 14:50] intake → task_type=feature · complexity=2.22~2.24 · risk=R2 · developer_model=opus · demo=delta / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=5c3a70(task_file) · snapshot=b8e8e75
- 지적 **2건**:
  - **[medium]** `src/modules/conversation/structuredResponse/checks.ts:139` — 모델이 extraNoteKo에 한글 접두어와 학습자 원문을 함께 복사할 때(예: `'참고: <학습자 발화>'`), sanitizeExtraNoteKo가 explanationKo만 인자로 받아 공백·길이·한글 검사만 하므로 원문 전체 비교 불가 → 학습자 원문이 새 컬럼에 중복 저장되고 DTO로 전송, 후속 Export·진단 경로에서 원문 우회 반출 위험 (권고: 정리 함수에 서버 원문 인자 추가, 원문 전체/REVIEW 문장 전체 포함 시 null 처리, shape→save·A3 테스트에 한글 접두어+원문 사례 추가, Export는 allowlist로 필드 제외)
  - **[low]** `src/modules/conversation/structuredResponse/checks.ts:141` — 모델이 200자 이하 한글을 포함한 개행·탭·제어문자를 extraNoteKo로 반환할 때, 계약은 "한 줄"을 요구하지만 정규화하지 않음(trim만 수행) → 다중 행 값이 DB에 영구 저장되어 카드 레이아웃·CSV/텍스트 출력의 행 경계 파괴 (권고: CR/LF·제어문자를 거부하거나 공백 하나로 정규화, 정규화 후 길이 재검사, 개행·CRLF·탭·NUL 회귀 테스트 추가)
- 검토하지 못한 범위: 아직 구현되지 않은 Prisma 컬럼·저장/select/DTO/UI 코드의 실제 diff · 실제 NAS MariaDB db push·운영 배포 · 사용자 데이터 Export 기능의 런타임 동작
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T093209Z-task-039-C1/raw.txt`


### [2026-10-06 20:23] C2 adversarial-review focus=data_integrity — done

- judge 판정: [2026-10-06 14:50] intake → task_type=feature · risk=R2 · developer_model=opus / 호출 차수: 2/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=5c3a70(task_file) · snapshot=342ab25
- 지적 **1건**:
  - **[low]** `src/modules/conversation/structuredResponse/checks.ts:136` — LLM이 추가 설명에 U+0085 NEL, U+200B ZWSP, U+202A~U+202E 양방향 제어문자 또는 U+2066~U+2069 isolate 문자를 포함할 때, `oneLine` 은 해당 문자들을 공백으로 접지 않으며 `hasControlChar` 는 U+0000~U+001F 와 U+007F 만 거부한다. 따라서 한글이 하나라도 포함된 값은 `sanitizeExtraNoteKo` 를 통과해 DB 에 저장되고 `ExtraNoteLine` 이 그대로 렌더링한다 → 한 줄 불변식이 U+0085 에서 깨질 수 있고, BiDi 및 영폭 문자가 설명의 시각적 순서나 표시 내용을 저장된 논리 문자열과 다르게 만들어 교정 카드의 표시 무결성과 접근성을 훼손할 수 있다 (권고: 정리 단계에서 최소한 U+0085 와 Unicode Cf 범주의 BiDi 제어문자 및 영폭 문자를 제거하거나 값을 null 로 거부하고, 이 문자군을 포함하는 저장·렌더 회귀 테스트를 추가)
- 검토하지 못한 범위:
  - 실제 MariaDB 컬럼 반영 및 구·신 코드 혼합 배포 왕복
  - 360/390/412 실제 브라우저 렌더링과 스크린리더 동작
  - 운영 LLM 및 지연 스모크
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T112322Z-task-039-C2/raw.txt`

**Codex 요약**: TALK 와 A3 모두 정리된 `extraNoteKo` 를 Correction 생성 시 한 번만 저장하고, 명시적 select 와 DTO 에서 옛 행 및 누락 필드를 null 로 정규화한다. 상태 전이 타입은 `original` 과 `extraNoteKo` 를 제외하므로 일괄 채택·거절 과정에서 두 값이 덮어써지는 경로도 보이지 않았고, `toolLog` 및 `RequestTrace` 에 추가 설명 본문을 싣는 변경도 발견하지 못했다. 남은 구체적 문제는 정리 함수가 C0/DEL 외의 줄 구분 및 방향 제어문자를 허용해 저장 문자열과 실제 표시가 달라질 수 있다는 점이다.

**Codex 요약**: nullable additive 컬럼을 DB에 먼저 적용하고 코드를 나중에 배포하는 순서는 기존 코드가 명시 필드만 create/select한다는 전제에서 안전이며, TALK/A3의 선택 필드와 additionalProperties:false도 직접 모순은 없음. 다만 현재 정리 계약은 학습자 원문을 인자로 받지 않아 새 필드로 원문이 복제되는 것을 막을 수 없고, 한 줄 계약도 강제하지 않으므로 구현 전에 정리 함수 입력·회귀 테스트를 보강 필요.

## Reviewer 기록 (REV-115)

- **판정: PASS_WITH_NOTES** — Critical 0 · High 1(운영 게이트, 코드 결함 아님) · Medium 2 · Low 6. 대상: task-039 미커밋 작업 트리 전체(PE·dev-039a·dev-039b, base `5c3a701`). 코드·문서 수정 없음(감사만). `native_change: false`(플러그인·android·Manifest·capacitor 무변경 — `versionCode` 해당 없음).
- **데모 게이트**: `check.mjs check --task` 재실행 → `DEMO_GATE_PASSED`(approved v1, hash verified). evidence.jsonl 17행 = 사용자 프롬프트 uuid `ceac5fc3…`(transcript 에서 `type: user`, 내용 "승인", 15:19:28) 에 묶인 approve — 에이전트가 승인·면제를 만든 흔적 없음. 15:20 당시 대기 데모는 이것 하나(task-040 v1 은 15:30 요청). 승인 데모 v1 대비 분류: **material 0 · defect 0 · implementation 2**(아래 L-3, M-1 의 내용 형식). 화면 CSS·마크업은 데모 `.xn-t`/`.xn-b`·개발 메모 ③과 1:1(버튼 `min-h-11 w-full`·px 0.5·13px/600·ink2, 상자 `mb-1.5 ml-0.5 border-l-2 border-line py-0.5 pl-3 14px/1.6 break-keep anywhere`, `[lang=ja]` word-break normal, 160ms 페이드는 `motion-safe` 만) 확인.

### 직접 재실행 결과 `[확인]` (미러 `~/.node-local/thekaiwa`, `scripts/sync-local.sh` 직후, DB·dev 서버·라이브 스모크 실행 없음 — `DATABASE_URL` 미설정 셸, `--env-file` 없음)

| 항목 | dev 주장 | 내가 잰 값 |
|---|---|---|
| conversation 전체(`src/modules/conversation`, concurrency 1) | 467/467 | **467/467** pass 0 fail 0 skip 0 (로그 scratchpad `conv.log`) |
| `src/components` + `src/types` | 480/480 | **480/480** pass 0 fail 0 skip 0 (`comp.log`) |
| `tsc --noEmit` | rc=0 | **rc=0**, 출력 0줄 (`tsc.log`) |
| eslint(git 변경·신규 `.ts/.tsx` 35개: src 31 + tests/live 3 …) | rc=0 | **rc=0, 0 problems** (`eslint.log`) |
| A1 요청 천장 최악 조합 마진 | 9자 | **9자**(`3/COACH/N5/t=1000/alt=60`, `rev115/margin.mts`) · TALK persona 최대 **2,765/2,800 = 마진 35자** |
| sanitizer 실데이터 재생 | (dev 는 미재생이라 적음) | PE 원자료로 **현재 코드(학습자 원문 인자 포함)** 재생: TALK 원값 39건 → 옛 34/새 34(원문 검사로 새로 버려진 값 **0**), A3 57건 → 57/57(**0**) → 오탐 0 (`rev115/fp.mts`·`fp3.mts`) |

### 지적 표

| # | 심각도 | 영역 | 근거(파일:줄) | 위험 | 고칠 방법 |
|---|---|---|---|---|---|
| H-1 | **High(운영 게이트 — 코드 변경 없음)** | 배포 순서 | `prisma/schema.prisma:759` 컬럼 1개 · `corrections/serialize.ts:8` `CORRECTION_SELECT`(#29·#34·모아 둔 교정) · `orchestrator/index.ts:313`·`review/index.ts:150` create · `docs/deploy-order.md:394` "push = 운영 배포"(webhook, `--migrate` 없음) · 새 Prisma client 는 select 없는 조회에서도 이 컬럼을 고른다 | 컬럼(`db push`)보다 이 빌드가 먼저 운영에 나가면(= push 가 먼저면) 교정 조회·저장이 전부 실패. 반대 순서(컬럼 먼저)는 옛 릴리스가 알려진 컬럼만 쓰므로 안전 `[가능성 높음 — 옛 client 영향은 이번 세션 미실행]` | **절대 순서**: ① 백업 ② `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` 로 SQL 이 `ALTER TABLE Correction ADD COLUMN extraNoteKo VARCHAR(400) NULL` **한 줄뿐**인지 확인(개발·운영이 같은 DB 라 `db push` 는 파일과 DB 의 *모든* 차이를 적용 — 드리프트 방어) ③ 그다음 `db push` ④ QA 라이브 ⑤ 그 뒤에만 push. Reviewer·QA PASS 전 push 금지 |
| M-1 | Medium(디자인·접근성 — Leader→designer) | 화면 | `common/japanese/JaQuoted.tsx`(「…」 만 `lang="ja"`) · 실제 모델 출력 재생: **추가 설명 96건 전부(96/96)가 「」 밖에 일본어**("〜たら(N4): 동사 た형+ら"·"〜ことがある: …" 처럼 머리말이 일본어 문형) — 「」 가 있는 건 4건뿐이고 그것도 일부 조각만. 승인 데모의 예시는 전부 「」 안 완결 문장("N5 문법 · … 「楽しい」→「楽しかった」")이라 규칙이 성립했다 | 상자 안 일본어가 `lang=ja` 없이 한국어 문서로 읽힘 → 스크린리더가 한국어 음성으로 읽을 수 있음 `[추측 — 실기기·SR 미확인]`. persona §6 TALK 행 예시 「〜ように: 동사 기본형+ように」 는 한국어까지 「」 로 감싸 모델이 흉내 내면 한국어에 `lang=ja` 가 붙는다(실측 0건) | designer 판단: `JaQuoted` 가 「」 밖 가나·한자(〜 포함) 구간에도 `lang=ja` 를 달지(순수 화면 변경, 프롬프트 예산 불필요) · persona §6 예시에서 「」 제거(−2자, 마진 증가). 결함 판정 아님(구현은 승인 규칙 그대로) |
| M-2 | Medium(미검증) | LLM 계약 A3 | `chatReview@v3`: PE 기록 ③·⑤-2 — v3 단독 10회(1차 통과 9/10, 새 위반 유형 모르는 키 `corrected_note` 1건, 재시도 +≈30s·A3 타임아웃 90s), **"20회 위반율 ≤5%" 확인 못 함**(구독 세션 한도로 10건 즉시 실패 → 분모 제외). `prompts/chatReview.ts` 요청은 `stripAdditionalProperties` 를 켜지 않음(레슨만 켬: `lesson.ts:336`) | 모델이 `extra_note_ko` 근처에서 비슷한 키를 지어내면 재시도(+30s) 또는 90s 초과 가능 `[추측 — 인과 입증 못 함]`. 최종 실패 0/10 | 한도 리셋 뒤 PE 가 `ARMS=work RUNS_REVIEW=10~20` 로 v3 단독 표본 보충(재측정 명령은 PE 기록 ⑤). 반복되면 A3 요청에 `stripAdditionalProperties: true` 검토(스키마 밖 키를 버려 재시도 제거) — 이번 task 필수 아님 |
| L-1 | Low | `sanitizeExtraNoteKo` | `checks.ts:156-166` — 내가 재현(`rev115/edge*.mts`): ⓐ 학습자 원문에 끝 구두점(。)이 있는데 설명이 구두점 없이 인용하면 통과(공백만 제거해 비교) · NFKC 차이(반각/전각)도 통과 ⓑ U+0085(NEL)·U+0080–009F(C1)·BiDi 덮어쓰기(U+202E)·ZWSP(U+200B) 는 접히지도 거부되지도 않음(`\s` 가 못 잡음, `hasControlChar` 는 ≤U+001F·U+007F 만) | 원문 복제 방어·한 줄 계약이 완전하지 않음. 실영향은 작다(React 텍스트 노드라 렌더 안전, 같은 행에 `original` 이 이미 평문, Export 경로 없음) | 비교 전 NFKC + 구두점·공백 제거로 정규화, 제어문자 검사에 `\u0080-\u009f<U+200B>-<U+200F><U+202A>-<U+202E><U+2066>-<U+2069>` 추가(후속 task 로 충분) |
| L-2 | Low | 문서 | `docs/screens.md` 에 task-039 절·"시험 문법" 없음(task 예상 경로에는 있음) · `.claude/agents/prompt-engineer.md:29` 계약 요약에 `hintKo`(task-010c)부터 `extraNoteKo` 까지 correction 칸이 빠져 있음(선행 드리프트) | 구현 가이드 정본이 데모뿐 — 다음 사람이 칸·줄을 찾기 어렵다 | Leader→designer/PE 가 후속으로 한 단락씩 |
| L-3 | Low(implementation 분류) | 데모 대비 | 데모 개발 메모 "길이: 서버에서 160자로 맞춘다 — 넘으면 마지막 문장 끝에서 자르고(없으면 159자+…)" ↔ 구현 `EXTRA_NOTE_STORE_MAX=200`, **넘으면 자르지 않고 null**(`checks.ts:130`, `sanitizeUserKo` 와 같은 방침, 데모는 "프롬프트·개발 담당이 정한다"고 열어 둠) · 데모 ② "긴 설명 160자" 예시는 문장형이고 실제 출력은 p50 19자·최대 43자(문형 표기 한 줄) | 펼친 상자가 데모 ② 보다 훨씬 짧음(오히려 안전). 200자는 상한일 뿐 | 조치 불필요. Leader 가 QA 3폭 실측 시 "짧은 한 줄" 기준으로 보도록 안내 |
| L-4 | Low | 감시 항목 | PE ② Leader 결정: TALK 메인 설명 "조각" 언급 63→46%(p=0.09), 메인 설명 본문 JLPT 어휘 감소는 입증 못 함(14% vs 16%), A1 마진 9자 — 테스트(`task039.test.ts` A1 예산)는 천장(≤3,000)만 단언하고 마진 값을 고정하지 않음 | 다음 TALK 문구 추가가 천장 테스트로만 잡힘(의도된 관문) | QA 가 운영 스모크 표본에서 조각 언급 비율 재확인(기준선 −30%p 이상이면 후속 튜닝) |
| L-5 | Low `[추측]` | 접근성 | 회화방 목록이 `role="log" aria-live="polite" aria-relevant="additions"` — 상자 `hidden` 해제가 "추가"로 낭독될 수 있음(dev 위험 3 과 같음, 데모 구조도 동일) | 펼칠 때 내용 중복 낭독 가능 | QA 스크린리더 실측 후 필요 시 designer |
| L-6 | Low | 스크롤 | `MessageList.tsx` 유예 500ms 안에 같은 목록에서 다른 높이 증가(새 문장)가 겹치면 그것도 한 번 따라가지 않음(`contentGrowthAction` 'hold' 는 첫 증가 하나만 소비하고 `holdUntil=0`). 유예 밖·유예 없음 경로는 기존 `if (h>last && atBottom) scrollTop=scrollHeight` 와 **동일**(코드 대조 확인) | 드물게 한 번 덜 따라감 — 다음 증가에서 복귀 | 조치 불필요 |

**발견 없음(확인한 것)**: 소유자·capability 검사 영향 없음(새 select 는 기존 `where userId` 그대로) · 라우트 spawn/fetch 추가 없음 · 화면→서버 모듈 직접 import 없음(`ExtraNoteLine`·`followHold`·`JaQuoted` 는 `@/components/**` 만) · 엔진명 grep(`reazon|whisper|style-bert|claude`) 변경 파일 0건 · `dangerouslySetInnerHTML` 없음 · 새 색 없음 · `Correction.original` UPDATE 경로 없음(`correction.updateMany` 는 `corrections/index.ts:19` 한 곳, 타입 `CorrectionUpdate` 가 `original`·`extraNoteKo` 제외 — `@ts-expect-error` 테스트로 고정) · `WordEntry` 생성은 accept 경로만(이번 diff 가 건드리지 않음).

### 감사 초점별 판정 (Leader 요청 1~11)

1. **DB 승인 범위 `[확인]`**: `git diff prisma/schema.prisma` = `///` 주석 1줄 + `extraNoteKo String? @db.VarChar(400)` 1줄뿐(+2행). `git status prisma` 도 `schema.prisma` 하나. 다른 컬럼·표·인덱스 없음. 승인 범위 일치. 배포 순서 위험은 **H-1**(QA·Leader high_risk).
2. **`original` 불변·create-only `[확인]`**: `extraNoteKo` 쓰기는 `orchestrator/index.ts:313`·`review/index.ts:150` 의 `create` 2곳뿐(소스 스캔 테스트가 2곳 모두 싣는지 고정). `CorrectionUpdate` 에서 뺀 것(dev-039a 의 지시 밖 추가) — **타당·채택**: 컴파일 타임 가드일 뿐 런타임 동작 변화 0, `original` 과 같은 선례, 나중에 수정 경로가 필요하면 그때 풀면 된다. 제안→채택(채택 전 `WordEntry` 없음) 유지.
3. **sanitizer·Codex 지적**: 아래 별도 판정. 공백 제거 비교·4자 하한·`learnerText` 생략 시 호환·길이는 정규화 후 — 모두 코드 그대로 확인(`checks.ts:156-166`).
4. **LLM 계약 `[확인]`**: TALK `extraNoteKo`(지시 `EXTRA_NOTE_LINE`·스키마 `correctionObject`·타입 `TutorCorrection`·테스트)·A3 `extra_note_ko`(지시·`CHAT_REVIEW_SCHEMA`·`ReviewItem`·테스트) 이름 일치, 둘 다 선택·`required` 아님·null 허용·`additionalProperties:false` 유지, 선언 순서 correction/항목 맨 끝(`task039.test.ts` 단언 + 최상위 순서 `speech→conversation→correction→…→userKo` 불변), `repairRootClose` 호환 테스트 통과. 골격 `[순서 예]` 는 `"correction":null` 이라 새 칸이 안 보이는데 `hintKo` 와 같은 처리(결함 아님). 버전 `talk@v9·chat@v4·chatReview@v3·lesson@v9` 코드 상수·테스트·주석 일치(옛 `talk@v8` 문자열은 역사 서술에만 남음 — grep). CHAT 계약 불변(`correction:{type:'null'}`, 요청 지시·스키마·persona 에 이름 0 — 테스트). **`tutor.md` §3-9 는 `extraNoteKo` 이름을 쓰지 않음**(테스트 단언) · §6 은 loader 의 **모드 행 필터**(`persona/loader.ts` `filterTableRows`)로 TALK 모드 행만 싣는다 — PE 설명대로 A3·CHAT·LESSON·EVAL_GRADE persona 에는 두 이름이 없다(테스트 `persona §3-9` 단언). §6 TALK 행(「시험 문형이 확실할 때만…단순 활용·조사 실수면 null」)과 지시문(「JLPT 문형 한 줄(40자), 대부분 null」)은 같은 뜻 — 충돌 없음. 단 §6 예시가 한국어까지 「」 로 감싼다(M-1).
5. **예산 `[확인]`**: 위 표 — A1 마진 9자·persona 마진 35자 실측과 PE 주장 일치. 테스트는 천장(≤3,000·≤2,800)만 고정(L-4). 출력 토큰·지연: PE 측정(p50 +3.9%·CI 상한 +8.5%·A3 +6.6% n=9/10)은 **내가 재현하지 않음**(구독 한도·라이브 금지) — **p95·`task007-latency` 미실행 → QA high_risk**.
6. **기존 테스트 단언 변경 `[확인]`**: `task028`: 옛 N5·N4 만의 "문법 용어는 쓰지 않습니다" → **전 수준 공통** "문법 용어(て형 등)·급수·문형 이름은 쓰지 않습니다"(5수준 전부 단언) + N5·N4 는 "쉬운 말로." 유지(N3+ 에는 없음 단언 유지) → 쉬운 말 보장은 **약해지지 않고 오히려 N3~N1 까지 넓어졌다**. `task026`·`prompts`·`lesson` 테스트는 버전 문자열만, `turnAudio.test.ts` 는 `correctionFromDone` 이 이제 `extraNoteKo` 키를 늘 싣기 때문에 기대값에 `extraNoteKo: null` 1줄 — 기존 단언 내용 보존.
7. **서버 저장·DTO `[확인]`**: `shape.ts` 한 곳에서 `sanitizeExtraNoteKo(c.explanationKo, c.extraNoteKo, text)` → 저장 행·`done.correction`·DTO 같은 값(`task039server` 왕복 9경우·`startTurn` 전체 테스트). `serialize.ts` 가 #29·#34·모아 둔 교정 공통 select(`chats/index.ts:258`·`corrections/index.ts:115·150·164` 모두 `CORRECTION_SELECT` 사용) · `review/filter.ts` `reviewExtraNote` 가 메시지 전체+짚은 문장 양쪽 검사, `toDraft` 에서 한 번 정리해 병합 중 값 유실 없음(여러 후보·재시도가 빠뜨린 항목은 앞 후보 값 — 테스트) · 옛 행 `?? null`. `toolLog.meta`·`correctionToolLog`·Trace·콘솔에 값 안 실림(diff 상 create·`SavedCorrection` 외 참조 없음 + 가로채기 테스트).
8. **화면 `[확인]`(코드·테스트 수준)**: `ExtraNoteLine` 접힘 기본·라벨 '시험 문법 더 보기'/'시험 문법 접기'·`aria-expanded`/`aria-controls=cr_{id}_xn`·`aria-describedby=cr_{id}_head`(머리줄 id 는 추가 설명이 있을 때만 — 옛 카드 마크업 동일 테스트)·`min-h-11` 터치·`lang=ja` 는 「」 만·루비/한글 병기 없음·null/빈/공백이면 렌더 없음·채택/무시/기한 지남 뒤에도 유지·코치 힌트 숨김 카드(`TalkCorrectionCard` 의 별도 `<li>`)는 줄 없음 → 정답 보기 뒤 새로 마운트돼 접힘. 스크롤 따라가기: `contentGrowthAction` 판정 정확(유예 안 → hold, 아니면 바닥이면 follow·아니면 none), 타이머·구독·리스너 새로 없음(타임스탬프 비교라 정리할 것이 없음), `scrollIntoView` 는 펼칠 때만(`revealRef`) `block:'nearest'`, reduced-motion 이면 `auto`. `JaQuoted`·`splitJaQuotes` 는 `common/japanese` 로 이동, `reviewLogic.ts` 가 `export { splitJaQuotes, type QuotePart }` 로 재노출해 기존 import·`review.test.ts` 불변, `TeacherWhy` 는 공용 import. `globals.css` 는 `@keyframes extra-note-in` 만(색 없음), 사용은 `motion-safe:` 안에서만. **데모와 다르게 구현된 곳**: L-3(길이 처리)뿐, 나머지 일치. **실화면 3폭·SR 은 확인 못 함**(아래 11).
9. **문서 `[확인]`**: `api-contract.md`(#29 예시·task-039 줄, #32 `done` 예시·정리 규칙 단락, #33 예시·A3 단락)·`domain-model.md`(Prisma 블록·엔티티 표)·`learning-personalization-and-llm-data.md`(관측·복습은 `explanation` 만) 가 코드와 일치(정리 규칙 7가지·200자·null·생성 시에만 모두 대조). 누락은 L-2.
10. **재실행**: 위 표(467/467 · 480/480 · tsc 0 · eslint 0) — dev 주장과 **일치**.
11. **확인 못 한 것**: 실화면 360/390/412·펼친 상자 높이·터치 44px 실측 · 스크린리더 낭독(L-5·M-1) · MariaDB 실제 insert/select(컬럼 미적용) · A3 `chatReview@v3` 20회 위반율 ≤5%(M-2, 구독 한도) · p95·`task007-latency`(미실행) · `next build`(Tailwind 임의 변형·`'use client'` 경계는 dev 의 `compile().build` 확인에 의존) · 옛 Prisma client 가 컬럼 추가 후에도 정상인지(`[가능성 높음]`).

### Codex 검토(C1) 지적 판정

| # | Codex 지적 | 판정 | 근거 |
|---|---|---|---|
| 1 (medium) | `sanitizeExtraNoteKo` 가 학습자 원문 비교 못 함 → 「참고: <학습자 발화>」 가 새 컬럼에 복제·반출 | **채택(구현 적정) · 위험 전제는 과장** | 구현: `learnerText` 선택 인자·공백 제거 비교·공백 제외 4자 미만 건너뜀·인자 생략 시 호환, A3 는 `reviewExtraNote` 가 메시지 전체+짚은 문장 양쪽. 내가 재현: `참고: 〈원문〉`·띄어쓰기 변형 → `null`, 3자 원문은 통과. 실데이터 재생 TALK 39·A3 57 에서 새로 버려진 정상 값 **0**(오탐 0). 다만 "원문 반출 위험" 은 약하다 — 같은 행 `Correction.original` 에 원문이 이미 평문이고 DTO 도 `original` 을 싣고 교정 Export 경로가 없다(dev grep: admin·learning·app/api) → 새 노출이 아니라 중복·품질 방어. 한계: 끝 구두점·NFKC 차이는 우회(L-1) |
| 2 (low) | 개행·탭·제어문자를 정규화 안 함(한 줄 계약 불강제) | **채택** | 구현: `\s+`→공백 하나·trim·정규화 뒤 길이(≤200)·제어문자(≤U+001F·U+007F) 잔존 시 null, 저장값은 정규화 문자열. 내가 재현: CRLF·탭·U+2028·전각 공백 → 한 줄, NUL·DEL·ESC·U+001C·BS → null, 200자 일치 통과·201자 null, 개행 100개 접힌 뒤 102자 통과. 한계: U+0085·C1·BiDi·ZWSP 통과(L-1, Low) |
| (권고) | Export 는 allowlist 로 필드 제외 | **범위 밖/해당 없음** | 교정 Export 경로 자체가 없음. Phase 3 기록 조회(`getRecentCorrections`)가 생기면 그때 결정(dev 위험 4 와 같음) |

### QA 에 넘길 high_risk_areas

1. **배포 순서(H-1)**: 백업 → `migrate diff` 로 SQL 이 컬럼 1줄뿐인지 → `db push` → 라이브 검증 → push(webhook=운영 배포). 컬럼 전에 이 빌드가 나가면 #29·#32·#33·#34 가 전부 실패. 미러에서 `npm run dev`·라이브 스모크(`tests/live/task006-smoke.ts:352` 의 select 없는 `findUnique` 포함)는 `db push` 뒤에만.
2. **교정 저장 왕복(실 DB)**: TALK 한 턴·표현 점검 한 번에서 `Correction.extraNoteKo` 채움/null/200 초과(자르지 않고 null)·옛 행 NULL DTO·`done.correction`·#29·#34 가 같은 값. `original` 바이트 일치·채택 전 `WordEntry` 행 0 대조. `RequestTrace`·로그·`toolLog` 에 추가 설명 문자열 없음 샘플 grep.
3. **지연·계약**: `task007-latency`(TALK `done`·첫 음성)·**p95**(PE 는 불확정으로 남김)·ajv 1차 통과율·교정 검출 16/16·오탐 0/4 라이브 재확인, A3 v3 20회 위반율(한도 리셋 뒤).
4. **화면 3폭×(표현 점검 ①짧은 값 ②긴 값 ③null · 회화방 인라인 · 모아 둔 교정 시트)**: 가로 넘침 0·버튼 높이 ≥44px·카드 폭 전체가 눌림·Tab→Enter/Space·`aria-expanded` 토글·스크린리더 낭독(M-1·L-5)·reduced-motion·다크·히라가나/한글 토글 켜도 상자 안에 루비·한글 줄 없음·옛 교정(NULL) 카드가 지금과 동일.
5. **회화방 스크롤 따라가기**: 바닥 근처 카드 펼침 시 누른 줄이 위로 튀지 않음·펼친 상자가 화면 밖이면 그만큼만 스크롤·말하는 중 펼쳐도 재생·녹음 영향 없음·펼침 직후 새 문장이 와도 어긋나지 않음(L-6).
6. **감시**: TALK 메인 설명 "조각" 언급 비율(운영 스모크 표본, 기준선 대비 −30%p 이상이면 후속 task)·`extraNoteKo` 채움률(약 47%)·정확도(약 90%, 일상 문장 34% 채움 — 줄 이름 '시험 문법' 과 내용이 안 맞는 사례 눈으로 보고).

### 다음 단계

Critical 0·High 1(게이트)·Medium 2 → **QA 진행 가능**(코드 수정 요구 없음). Leader: ① judge C2(R2 — Codex 개입 판정) ② M-1 을 designer 에게(순수 화면·persona 예시 한 줄) ③ M-2 는 한도 리셋 뒤 PE 보충 측정 ④ H-1 순서대로 백업 → `migrate diff` → `db push`. Developer 수정이 생기면 Reviewer 부터 재순환. 재생 스크립트·로그: scratchpad `rev115/`(저장소 밖).

```json
{ "reviewId": "REV-115", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 1, "medium": 2, "low": 6 }, "native_change": false,
  "high_risk_areas": ["배포 순서(컬럼 db push 전 push 금지)", "교정 저장 왕복(실 DB)·original 불변·채택 전 WordEntry 0", "p95·task007-latency·A3 v3 20회 위반율(미측정)", "3폭·스크린리더·스크롤 따라가기", "TALK 조각 언급·extraNoteKo 채움률/정확도 감시"] }
```

## Reviewer 기록 (REV-116)

- **판정: PASS_WITH_NOTES** — Critical 0 · High 0(REV-115 H-1 운영 게이트는 코드 변경 없이 **이월**) · Medium 0 · Low 4(신규) · Info 1. 대상: dev-039c(REV-115 L-1·M-1 + Codex C2 low 1건) + pe-039d(A3 v3 보충 측정) 재감사. 코드·문서 수정 없음(감사만). `native_change: false`(plugins·android·Manifest·capacitor 무변경).
- **범위 이탈 `[확인]`**: 20:20 이후 바뀐 파일 = 대상 6개(`checks.ts`·`jaQuotes.ts`·`JaRuns.tsx`·`ExtraNoteLine.tsx`·`task039server.test.ts`·`extraNote.test.ts`) + 이력서·로그·타 task(task-040 데모·이력서) + **`scripts/sync-local.sh`(21:27, 아래 L-10)**. `prisma/schema.prisma`(18:39)·`prompts/*`(talk 16:16·chatReview 16:37)·`schemas.ts`(16:37)·`tutor.md`(15:39)·`orchestrator/*`·`review/*`·`corrections/serialize.ts`(18:38~18:39)·`TeacherWhy`·`reviewLogic`·`JaQuoted`(18:54) 는 REV-115 시점 이후 mtime 변화 0 — 프롬프트·스키마·서버 저장 경로 그대로. 엔진명 grep(`reazon|whisper|style-bert|claude`)·`spawn|fetch(|window.Capacitor|dangerouslySetInnerHTML|localStorage|console.` 변경 4개 소스 0건(주석 1줄은 "금지" 문구), import 방향 위반 없음(`JaRuns`·`jaQuotes` 는 로컬만, `ExtraNoteLine` 은 `@/components/**` 만), 환경값·URL 하드코딩 0.
- **데모 게이트**: `check.mjs check --task` 재실행 → `DEMO_GATE_PASSED`(approved v1, hash verified). evidence.jsonl 18행 중 task-039 는 17행(15:20 approve, 세션 `729e3300…`, REV-115 가 사용자 프롬프트 "승인" 에 묶임을 확인한 그 줄) 하나뿐 — 18행(20:30)은 TheAdmin task-001 approve(다른 세션·프로젝트)로 이번 task 와 무관. 에이전트가 만든 approve·waive 흔적 없음. dev-039c 는 화면 파일 첫 편집 **뒤**에 check 를 돌렸다고 스스로 기록(Info 1 — 승인 v1 유효·결과 영향 없음).

### 직접 재실행 결과 `[확인]` (미러 `~/.node-local/thekaiwa`, `scripts/sync-local.sh` 직후, `DATABASE_URL` 미설정 셸 + `env -u DATABASE_URL`, dev 서버·라이브 스모크·DB 읽기 없음)

| 항목 | dev 주장 | 내가 잰 값 |
|---|---|---|
| conversation 전체(concurrency 1) | 473/473 | **473/473** pass 0 fail 0 skip 0 (`rev116/conv.log`) |
| `src/components` + `src/types` | 486/486 | **486/486** pass 0 fail 0 skip 0 (`comp.log`) |
| `tsc --noEmit` | rc=0 | **rc=0**, 출력 0줄 (`tsc.log`) |
| eslint(변경 6파일) | rc=0·0 problems | **rc=0**, 출력 0줄 (`eslint.log`) |
| 6파일 보이지 않는 문자 리터럴 | 0 | `grep -nP`(U+2028·2029·FEFF·200B–200F·202A–202E·2066–2069·0085·2060–2064·00AD·061C) **0건** — 양성 대조 파일(U+2028·FEFF·202E 를 일부러 넣음)에서 같은 grep 이 3줄을 잡아 grep 자체가 동작함을 확인 · python `unicodedata` Cc/Cf/Zl/Zp 스캔 6파일 **모두 0** |
| 줄바꿈 실측(헤드리스 Chrome, 94건 × 폭 150~320px 86단계) | normal 932경우·50건 / inherit 2경우·2건 | **동일**(dev 스크립트를 내 scratchpad 로 복사해 재실행: `new` 2경우·2건, `nrm` 932경우·50건, 넘침 1건(폭 150px·기존부터)) |
| sanitizer 실데이터 재생 | TALK 39→34/34·A3 57/57·차이 0 | **동일**(`d39c/replay.mts`·`rev115/fp.mts`·`fp3.mts` 재실행: 34/34·57/57·cf/c1/sep 문자 0) |
| `splitJaRuns` 재생 | 「」 밖 일본어 96→0 | 94건(중복 제거)에서 **「」 밖 일본어 남은 값 0**·「」 밖 ja 구간 177개 중 한글·라틴·숫자 포함 0·글 복원 불일치 0 |
| pe-039d 수치 | 아래 M-2 표 | 원자료(`pe039c/rl-v3*.json`·`pe039d/rl-d1~4·rl-h1~2.json`)에서 **내 코드로 재계산해 일치** |

### 지적 표 (신규)

| # | 심각도 | 영역 | 근거(파일:줄) | 위험 | 고칠 방법 |
|---|---|---|---|---|---|
| L-7 | Low | `sanitizeExtraNoteKo` 잔여 | `checks.ts:131`(`EXTRA_NOTE_HANGUL_RE` = `ㄱ-ㆎ` 포함)·`:147`(`FORMAT_CHAR_RE = /\p{Cf}/u`) — 내가 재현(`rev116/edge.mts`·`edge2.mts`): **Cf 가 아닌 보이지 않는 문자**는 통과 — 한글 채움 문자 U+3164(**한글 검사까지 만족시켜** `"〜た<U+3164>"`·`"<U+3164>"` 단독도 저장)·U+115F·U+1160·U+034F(CGJ)·U+2800(점자 빈칸)·U+FE0F(변이 선택자)·고립 서로게이트·사용자 영역 U+E000, 반각 한글 채움 U+FFA0 도 진짜 한글이 함께 있으면 통과(`edge3.mts`). U+180E 만 Cf 라 null. U+2800 을 뺀 나머지는 모두 `Default_Ignorable_Code_Point` | Codex C2 의 위험 모델(저장 문자열과 보이는 글의 **순서·줄 구조** 불일치)은 이 문자들이 만들지 못한다 — BiDi·영폭·NEL 은 전부 닫힘. 남는 것은 "빈 칸처럼 보이는 줄이 저장·표시될 수 있음" 뿐이고 LLM 이 낼 개연성은 아주 낮다(실데이터 94건 중 Default_Ignorable 0·Cf 0). 보안·무결성 영향 없음 | 선택(한 줄): `FORMAT_CHAR_RE` 를 `/[\p{Cf}\p{Default_Ignorable_Code_Point}<U+2800>]/u` 로 넓히면 U+3164·115F·034F·FE0F 가 거부되고 실데이터 오탐 0 `[확인]`. 채택하면 `task039server.test.ts` 에 3줄 추가 + Reviewer 소재순환(작음). 안 해도 이번 판정은 유지 |
| L-8 | Low | 정본 문서 드리프트 | `docs/design/api-contract.md:792`(18:46 작성) 정리 규칙 문장 = "공백류(개행·탭) 접기 … 제어문자 잔존 … 학습자 말을 통째 포함(공백 제외 4자 이상, **공백을 뺀 비교**)" — dev-039c 가 바꾼 규칙(서식 문자 `\p{Cf}` 전부 거부·U+0085·U+2028·U+2029 접기·C1 거부·**NFKC+공백·구두점 제거** 비교·하한은 정규화 **후** 4자)이 반영 안 됨. 그 밖 정본(`domain-model.md`·`learning-personalization…md`)은 칸만 말해 영향 없음 | 정본 계약이 코드와 어긋남 — 다음 사람이 문서만 보고 "서식 문자는 지워 저장" 또는 "구두점 차이로 우회 가능"이라 오해 | Leader/developer: 한 문장 교체 — "…접은 뒤 200자 초과·**서식 문자(영폭·BiDi·BOM 등 `\p{Cf}`)**·제어문자(C0·DEL·C1) 잔존·한글 0·메인 설명 포함·학습자 말 통째 포함(**NFKC·공백·구두점을 지운 비교, 정규화 후 4자 이상**)·엔진명 → `null`; 줄바꿈류(NEL·U+2028/2029 포함)는 공백 하나로 접는다" |
| L-9 | Low `[가능성 높음]` | REV-115 M-1 의 둘째 반쪽 미적용 | `.claude/agents/tutor.md:66` TALK 행 예시가 한국어까지 「」 로 감싼다(「〜ように: 동사 기본형+ように」) — `splitJaRuns` 는 「」 조각을 **통째로** ja 로 둔다(`jaQuotes.ts:36~38`). 모델이 예시를 흉내 내면 한국어(동사 기본형)에 `lang="ja"` 가 붙는다 | 실측 영향 0 — 94건 중 「」 조각 5개에 한글 0(`runs2.mts`). 오독(스크린리더가 한국어를 일본어 음성으로)은 일어난다면 그 조각 안에서만 | 선택 둘 중 하나: ⓐ `splitJaRuns` 에서 한글이 든 「」 조각은 일반 글처럼 구간 분리(순수 함수 몇 줄·`splitJaQuotes` 불변) ⓑ persona 예시에서 「」 제거(−2자, PE 몫·A1 마진 증가). QA SR 실측에서 문제가 보일 때만 |
| L-10 | Low(커밋 위생) | 범위 밖 변경 | `scripts/sync-local.sh:18` `LOCAL_ROOT="${KAIWA_LOCAL_ROOT:-$HOME/.node-local/thekaiwa}"`(mtime 21:27 — dev-039c 완료 20:46·pe-039d 완료 21:15 이후) · 미추적 `agent-vault/10-Flow/tasks/task-039-improve-tutor-explanation.md.bak` | 앞은 기본값이 그대로라 동작 불변 — 주석 "병렬 developer 는 전용 미러(cp -al)" 로 보아 병렬 task(task-040 등)의 변경 `[추측]`. 이 task-039 커밋에 섞여 나가면 출처 불명. `.bak` 은 vault 복사본이라 Obsidian·그래프에 중복 노트로 잡힘 | Leader: sync-local.sh 변경의 소유 task 를 확인하고 별도 커밋(또는 task-039 커밋에서 제외) · `.bak` 은 삭제 또는 커밋 제외(나는 읽기 전용이라 지우지 않음) |
| I-1 | Info(프로세스) | 데모 게이트 순서 | dev-039c 기록 "check.mjs 는 화면 파일 첫 편집 뒤에 실행" | 승인 v1 이 이미 유효해 결과는 PASS 동일 — 훅이 warn 단계라 차단 아님 | 조치 없음. 다음부터 편집 전에 check |

### 감사 초점별 판정 (Leader 요청 1~6)

1. **`sanitizeExtraNoteKo` 보강 `[확인]`** — 접기/거부 표와 코드가 **일치**: `FORMAT_CHAR_RE.test(원값)` → `oneLine`(`[\s\u0085]+` → 공백 하나·trim) → 접은 뒤 길이(≤200) → `hasControlChar`(U+0000–001F·007F–009F) → 한글 → 메인 설명 → 원문 복제 → 엔진명 순서(`checks.ts:169~183`). U+FEFF 가 JS `\s` 에 들어가므로 **접기 전에 검사**해야 하는 이유도 직접 확인(앞·중간·끝 어디의 BOM 이든 null, 접은 뒤 검사였다면 trim 으로 사라져 통과). 내가 만든 64경우 재현(`rev116/edge.out`): NEL·U+2028·U+2029·CRLF·탭·NBSP·전각 공백 → **한 줄로 접어 저장**(`"〜ました: 동사 과거"`); ZWSP·ZWNJ·ZWJ·LRM·RLM·LRE·RLO·PDF·isolate(U+2066·2069)·BOM·U+00AD·U+061C·U+2060·태그 문자(U+E0041) → **null**; C1(U+0090·009F)·NUL·DEL·ESC·U+001C~001F → null; 201자 → null, 공백 200개로 부풀린 201자 → 접어서 `"가 나"` 통과, 200자 + 끝 NBSP → 통과(정규화 뒤 길이). 원문 복제: 한글 접두어·띄어쓰기 변형·끝 `。`·반각 `.`·`、` 삽입·`「」` 인용·반각 가타카나(ｷﾞﾝｺｳ)·전각 영숫자·`〜` 위치 → 전부 null, 정규화 후 4자 미만(`は、い、。`=2자·`はい`) → 통과, 4자 이상(`そうですね` 5자) → null(3/4자 경계는 dev 테스트가 고정), 인자 생략(두 인자 호출) → 호환(`"참고: 昨日…"` 통과), `explanationKo` 가 문자열이 아니어도 던지지 않음. **정상 값 오탐 없음**: `「〜ように」(N4): 동사 기본형+ように, 목적/변화 — 「〜ために」와 비교`·`시험에서는 「〜ことにする」(N4)와 헷갈려요! 어떻게 구분할까요?`·전각 콜론 `：`·전각 공백 낀 값(→ 반각 공백으로 접힘, 표시 영향 미미) 모두 통과, 실데이터 TALK 39→34/34·A3 57/57 이 **옛 판과 항목별 동일**(차이 0, 서식·C1·줄 구분 문자 0). 잔여: L-7(Cf 밖 보이지 않는 문자). 사소한 비대칭 `[확인]`: NFKC 가 전각 `～`(U+FF5E)를 `~`(Sm — `\p{P}` 아님)로 바꿔 구두점 제거에 안 걸린다 — 학습자 말에 `～` 가 있고 설명이 `〜`(U+301C)로 바꿔 인용하는 경우만 복제 검사를 빠져나간다(`edge2.out`). 실영향 거의 0이라 조치 불필요. ReDoS 없음(두 정규식 모두 선형, 입력 ≤200자 + 원문).
2. **`lang="ja"` 구간 `[확인]`** — `splitJaRuns` 는 「」 조각을 `splitJaQuotes` 와 **같은 결과로 그대로** 두고(「」 밖에 일본어가 없으면 두 함수 출력 JSON 동일 — 3경우 `SAME`), 「」 밖에서만 가나·한자(`Script=Hiragana|Katakana|Han`) 1자 이상 연속 구간을 ja 로 잡는다. 장음·반복·물결·가운뎃점·반각 탁점(`ーー々〆〜～・ｰﾞﾟ゛゜`)은 가나·한자와 붙을 때만, `、。` 는 일본어 글자 사이에 끼었을 때만 — 재현: `3〜7일`·`1〜2회`·`ー 장음`·`・`·`、。` 단독·`〜 ` 뒤 공백·ASCII `~`·`〒`·숫자·라틴·한글은 **ja 아님**, `〜と、〜は`·`〜ばよかった`·`ｶﾞ`·`々`·`ヶ月`·`ゝゞ`·`〆切` 은 ja. 94건 실데이터: 「」 밖 ja 구간 177개(p50 4자·p90 6자·최대 9자 `〜ことになっている`), 한글·라틴·숫자 포함 0, 일본어가 ja 밖에 남은 값 0, 글 복원 불일치 0. `splitJaQuotes`·`TeacherWhy`·`JaQuoted`·`reviewLogic.ts` 재노출은 REV-115 시점 이후 mtime·내용 불변(`git diff` = 이동·재노출뿐), `JaRuns` 사용처는 `ExtraNoteLine` **하나**뿐이라 다른 화면 영향 0. 한계 둘: ⓐ `Script=Han` 은 한국어 문장 속 한자어(大韓民國)도 ja 로 본다 — 이 상자는 일본어 문형 설명이라 한자는 대체로 일본어(실데이터 한자만 구간 9개 = 許可·希望·親切·丁寧·例·伝聞·条件形 전부 일본어 용어), 영향 낮음 ⓑ 한 글자 구간(「た」「ら」)이 **177개 중 30개(17%)** — TalkBack 이 구간마다 언어를 바꿔 읽으며 끊길 수 있다 `[추측 — 실기기 미확인]` → QA SR 항목. `JaRuns` 가 「」 조각을 `p.text.startsWith('「')` 로 구분하는 것은 「」 밖 구간이 `「` 로 시작할 수 없어(JA_CORE 에 없음) 정확하다(`jaQuotes` 가 `quoted` 플래그를 주면 더 깔끔하나 결함 아님).
   **`word-break:inherit` 채택 판정 — 허용(implementation 분류, 시각 결함 아님, material 아님)**. 근거: ⓐ 데모의 `[lang=ja]{word-break:normal}` 은 **「」 안 완결 문장**을 위해 쓰인 규칙이다 — 데모 마크업의 `J()`(demo 437행)는 「…」 만 `lang="ja"` 로 감싸고 승인 예시 일본어는 **전부 「」 안**이라, 「」 밖 일본어에 ja 규칙이 적용된 적이 없다. 그 부분은 승인 화면에서 **그냥 한국어 문맥의 `keep-all` 글**이었다 ⓑ 그래서 「」 밖 구간에 상자의 normal 을 그대로 받게 하면 **승인된 줄바꿈 동작을 바꾼다** — 내가 같은 실측을 재현: 기존(`JaQuoted`) 대비 줄 내용이 달라진 경우 `normal` = 50건·932경우(「〜ましょう: 어간+ま / しょう」·「動詞て / 形」·「親 / 切」처럼 짧은 문형이 **어절 한가운데서** 끊김), `inherit` = 2건·2경우(일본어 글꼴로 바뀌며 글자 폭이 달라져 줄 끝 어절 하나가 넘어감) — 즉 `inherit` 가 승인된 모습을 **보존**하는 쪽이다 ⓒ 줄바꿈이 한국어·문형 어절 가운데서 끊기지 않게 하는 것이 `break-keep` 을 상자에 둔 승인 의도(데모 `.xn-b{word-break:keep-all; overflow-wrap:anywhere}`)에 맞고, 긴 일본어는 「」 안(normal 유지)에서 끊긴다 ⓓ 안전망: 상자에 `[overflow-wrap:anywhere]` 가 남아 있어 keep-all 에서 못 끊는 구간이 길어도 넘치지 않고(최대 9자라 실제로 큰 빈칸도 안 생김), 가로 넘침은 3방식 모두 같은 1건(폭 150px·기존부터). 인라인 `style` 은 상자 `[lang=ja]` 규칙(특이성 0,2,0)을 `!important` 없이 이긴다(실측으로 확인). 주의: ⓔ 데모 개발 메모 ③ 의 **글자 그대로의 문장**("일본어 조각은 word-break:normal")과는 다르다 — 데모 파일은 hash 로 보호되는 승인본이라 **고치지 말고** 이 task 기록(dev-039c·이 절)을 정본으로 삼는다. ⓕ 서버 Chrome 에 Noto Sans JP 가 없어 대체 글꼴로 쟀다 → 기기 글꼴에서 줄 끝 한 어절이 넘어가는 경우의 빈도는 QA 3폭 실측 항목.
3. **데모 대비 시각 변화 `[확인]`** — 「」 밖 일본어에 `:lang(ja)`(`globals.css:170` — `font-family` 일본어 글꼴 + `line-break: strict` 둘뿐; 이 규칙 밖에 `lang` 선택자 CSS 없음 — grep)가 적용돼 **글꼴(한자 일본식 자형)과 금칙 처리만** 바뀐다. 크기(14px)·색(ink2)·자간·여백·행간(1.6)·줄바꿈 규칙(keep-all)은 불변이고 `JaRuns` 의 style 은 `wordBreak` 하나(테스트 `extraNote.test.ts:178` 이 "글꼴·색·크기 style 없음" 고정). 승인 데모 화면과의 차이: 데모 예시 일본어는 전부 「」 안이라 **데모 화면 자체와의 차이는 없고**, 실제 모델 출력(「」 밖 문형 머리말)이 「」 안과 같은 모양으로 통일된다(screens.md §1-2 "일본어가 들어가는 요소는 `lang=ja`" 와 일치). 서로 다른 글꼴이 한 줄에 섞일 때 줄 높이가 1px 안팎 달라질 수 있다 `[추측 — 실기기 미확인]`(「」 조각은 데모에서도 이미 같은 조건). 분류: **implementation**(material 0·defect 0).
4. **REV-115 노트 종결** — 아래 표.
5. **범위 이탈** — 위 "범위 이탈" 단락: 6파일 + 이력서·로그 밖은 L-10 하나(소스 외 변경 `sync-local.sh`), `prisma/`·프롬프트·스키마·저장 경로 그대로.
6. **재실행** — 위 표. 주장과 **전부 일치**(473·486·tsc 0·eslint 0·리터럴 0).

### REV-115 노트 종결 판정

| REV-115 | 상태 | 근거 |
|---|---|---|
| **L-1** ⓐ 원문 복제 비교 우회(끝 구두점·NFKC) | **종결** | `comparable`(NFKC → `[\s\p{P}]` 제거) 양쪽 적용, 끝 `。`·반각 `.`·`、`·`「」`·반각 가타카나·전각 영숫자 전부 null(재현), 하한 정규화 후 4자, 두 인자 호출 호환 — 위 초점 1. 사소 비대칭(`～`↔`〜`)은 실영향 0 |
| **L-1** ⓑ NEL·C1·BiDi·ZWSP | **종결**(+L-7 잔여 Low) | 접기/거부 표 = 코드 = 재현. Codex C2 가 든 4계열(U+0085·ZWSP·BiDi U+202A–202E·isolate U+2066–2069) 전부 처리. 거부(지우지 않음)를 택한 근거(값 오염 신호·오탐 0)도 타당 |
| **M-1** `lang=ja` 「」 밖 | **종결(코드·시각)** · 실기기 낭독은 QA | `splitJaRuns` 재생 96→0·94건 재현 0, 한 글자 구간 17% 는 SR 실측 대기, 한국어가 든 「」 조각(L-9)은 실데이터 0 |
| **M-2** A3 v3 위반율 | **조건부 종결 — "측정 요건 충족, ≤5% 입증 못 함, 새 악화 신호 없음(통계적으로 구분 불가)"; 차단 아님·감시 이관** | 아래 표 |
| L-2 `docs/screens.md` 에 039 절 없음·`prompt-engineer.md` 계약 요약 드리프트 | **이월(열림)** | `docs/screens.md` 미변경 — Leader→designer/PE 후속 |
| L-3·L-4·L-5·L-6 | **이월(변화 없음)** | 이번 변경 영향 밖 |
| **H-1** 배포 순서(컬럼 `db push` → 그 뒤 push) | **이월(운영 게이트, 코드 변경 없음)** | `prisma/schema.prisma` 18:39 이후 불변 |

**M-2 재계산 `[확인]`**(원자료에서 내 코드로 — 이력서 값과 같음): v3 50회 = pe-039c 10(5+5)+pe-039d 40(10×4), 성공 47(1차 통과 45·재시도 후 성공 2)·최종 실패 3(전부 `ClaudeCliTimeoutError` 90.6s), 성공분 p50 31,718ms·p90 38,615ms · 스키마 위반 2/50(4.0%, Wilson [1.1–13.5]·둘 다 `/items/3 … 'corrected_note'`) · 최종 실패 3/50(6.0%, [2.1–16.2]) · 1차 비통과 5/50(10.0%, [4.3–21.4]) · v2 대조 30회(pe-039c 10 + 이번 20): 성공 29·재시도 후 성공 1(`corrected_hint`)·JSON 파싱 실패 1(64s) · Fisher 양측 p: 타임아웃 3/50 vs 0/30 = **0.288**, 스키마 2/50 vs 1/30 = 1.0, 최종 실패 3/50 vs 1/30 = 1.0 · 항목 446개 중 `extra_note_ko` 키 446/446·비null 253(57%)·서버 정리 통과 237 — **버려진 16건은 전부 한글 없음**(`〜ことにする`·`〜たばかりなのに` 같은 일본어만의 문형 표기, 16/16 재확인). 판정: 구간이 5%를 가로지르므로 "≤5%" 도 "초과" 도 말할 수 없다. 타임아웃 6% 는 v2 와 **구분되지 않고**(p=0.29) 프롬프트로 풀 문제가 아니다(pe-039d ②에 동의 — 같은 날 v1 head 도 타임아웃이 있었다). 지어낸 키가 v2 에도 있어(1/30) `extra_note_ko` 와의 연관은 지지되지 않는다. **`stripAdditionalProperties: true`(pe-039d 권고 ①)는 필수 아님 — 이번 task 에서 하지 않는 쪽을 권한다**: 최종 실패율은 줄지 않고(타임아웃·JSON 파싱엔 무효) 호출 4%의 재시도 ≈32s 만 줄며, A3 요청을 바꾸면 Reviewer 재순환이 필요하다. 감시 후 반복되면 별도 후속(IMP). "새 악화 신호 없음" 은 *악화를 입증하지 못했다*는 뜻이지 "문제없음"이 아니다 — 아래 QA 항목으로 운영 실측을 남긴다.

### Codex 검토(C2) 지적 판정

| # | Codex 지적 | 판정 | 근거 |
|---|---|---|---|
| 1 (low) | U+0085·ZWSP·BiDi(U+202A–202E)·isolate(U+2066–2069) 가 정리를 통과 | **채택·해결됨 (L-7 잔여 Low 따로)** | NEL 은 접고 나머지 Cf 는 거부 — 직접 재현 위 초점 1. 권고 "회귀 테스트"도 `task039server.test.ts` 에 6건(C2 NEL·Cf 24코드포인트×앞/중간/끝·C1·L-1 ⓐ 2건·정상 문형 7개)·`extraNote.test.ts` 6건으로 충족. Cf 밖 보이지 않는 문자는 L-7 로 분리 |

### QA 에 넘길 high_risk_areas (REV-115 항목 이월 + 신규)

1. **(이월·H-1) 배포 순서**: 백업 → `migrate diff` 로 SQL 이 컬럼 1줄뿐인지 → `db push` → 라이브 검증 → push(webhook=운영 배포). 컬럼 전에 이 빌드가 나가면 #29·#32·#33·#34 전부 실패.
2. **(이월) 교정 저장 왕복(실 DB)**: `Correction.extraNoteKo` 채움/null/200 초과(null)/옛 행 NULL DTO 가 `done.correction`·#29·#34 에서 같은 값. 새로 추가: **저장값이 접힌 한 줄**임(개행·NEL·전각 공백이 공백 하나) 샘플 대조, 서식 문자 포함 값이 **null** 로 저장되는지. `original` 바이트 일치·채택 전 `WordEntry` 0, `RequestTrace`·`toolLog`·로그에 추가 설명 문자열 0 grep.
3. **A3 타임아웃·위반율 운영 실측**: pe-039d 는 최종 실패 6.0%(전부 90s 타임아웃, 구간 [2.1–16.2])를 못 닫았다. 운영 스모크에서 A3(`chatReview@v3`)를 가능한 만큼(≥10회) 돌려 1차 통과율·타임아웃 수 기록, **타임아웃·FAILED 시 화면**(`ChatReview.tsx:50` `FAIL_TEXT` "점검을 끝내지 못했어요…" + [다시 시도])이 깨지지 않고 교정·채택 행이 **중복·부분 저장되지 않는지**. 타임아웃이 10회 중 1건 이상 반복되면 Leader 가 타임아웃·재시도 정책/`stripAdditionalProperties` 를 판단.
4. **화면 3폭(360/390/412) × 「」 밖 일본어 줄**: 「〜ましょう: 어간+ましょう」·「〜てください」·「〜ことになっている」 같은 줄이 **어절 한가운데서 끊기지 않는지**, 가로 넘침 0, **기기 글꼴(Noto Sans JP/CJK JP)** 에서 줄 끝 어절 하나가 넘어가는 경우(서버 Chrome 은 대체 글꼴로 2경우)의 빈도, 일본어 글꼴로 바뀐 줄의 높이·정렬(`[추측]` 1px).
5. **스크린리더(TalkBack)**: 「」 밖 일본어 구간마다 언어가 바뀌어 읽히는지, **한 글자 구간(「た」「ら」 — 실데이터 177구간 중 30개)** 에서 끊김이 거슬리는지, 한국어가 든 「」 조각(L-9)이 일본어 음성으로 읽히는지, 상자 펼침 시 `role="log"` 중복 낭독(REV-115 L-5).
6. **(이월) 지연·채움 감시**: `task007-latency`·p95, TALK 조각 언급 비율(기준선 −30%p), `extraNoteKo` 채움률(서버 정리 후 약 47%)·정확도 — 정리에서 버려지는 비율은 로그에 값이 없으므로 DB 컬럼 NULL 비율로 본다.

### 다음 단계

Critical 0·High 0(H-1 이월)·Medium 0 → **QA 진행 가능**(코드 수정 요구 없음). Leader: ① `word-break:inherit` 를 "implementation 보정"으로 task 에 기록(데모 파일은 hash 보호라 수정 금지) ② L-8 정본 문장 한 줄 교체(developer/Leader) ③ L-10 `sync-local.sh`·`.bak` 정리 ④ L-7·L-9 는 선택 — 적용하면 Reviewer 재순환(작음), 미적용이면 QA SR 결과로 판단 ⑤ M-2 는 위 QA 항목 3 으로 운영 실측 이관 ⑥ H-1 순서대로 백업 → `migrate diff` → `db push`. 재현 스크립트·로그: scratchpad `rev116/`(저장소 밖 — `edge.mts`·`edge2.mts`·`page.mts`·`runs*.mts`·`*.out`·`lb-out.html`).

```json
{ "reviewId": "REV-116", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 0, "medium": 0, "low": 4 }, "carried": { "high": ["REV-115 H-1 배포 순서(운영 게이트)"] }, "native_change": false,
  "high_risk_areas": ["배포 순서(컬럼 db push 전 push 금지)", "교정 저장 왕복(실 DB)·접힌 한 줄·서식 문자 null·original 불변·채택 전 WordEntry 0", "A3 v3 타임아웃 6%·FAILED 화면·운영 실측", "3폭 × 「」 밖 일본어 줄바꿈·기기 글꼴", "TalkBack 한 글자 ja 구간·한국어가 든 「」 조각", "p95·task007-latency·조각 언급·채움률 감시"] }
```


## Reviewer 기록 (REV-117)

- **판정: PASS_WITH_NOTES** — Critical 0 · High 0(REV-115 H-1 운영 게이트는 코드 변경 없이 **이월**, 아래 "H-1 갱신") · Medium 0 · Low 2(신규, 둘 다 선택) · Info 2. 대상: dev-039d(REV-116 L-7·L-8 + Codex C2 3차 low 1건) — `checks.ts`·`task039server.test.ts`·`api-contract.md:792`. 코드·문서 수정 없음(감사만). `native_change: false`.
- **범위 이탈 `[확인]`**: REV-116 이후 mtime 이 바뀐 task-039 영역 파일 = 대상 3개(checks.ts 21:59·task039server.test.ts 21:59·api-contract.md 21:58) + 이력서·로그뿐. `ExtraNoteLine`·`JaRuns`·`jaQuotes`·`extraNote.test.ts`(20:32~20:43)·프롬프트(talk 16:16·chatReview 16:37)·`schemas.ts`(16:37)·`tutor.md`(15:39)·`orchestrator/*`·`review/*`·`corrections/*`(18:38~18:41)·화면 컴포넌트(18:54~18:57)는 REV-116 시점 그대로. `git diff` 기준 `checks.ts` 변경 = `sanitizeExtraNoteKo` 관련 +70줄뿐(010d·040·041 코드 없음 — `challenge.md:817` 이 010d 가 같은 파일을 고친다고 적었으므로 **task-039 를 먼저 커밋**하면 경계가 깨끗하다). `api-contract.md` 변경 hunk 6개 전부 `extraNoteKo` 관련. 이번 감사 범위 밖(DB0·task-040·041·010d): `prisma/schema.prisma`·`src/modules/learning/{challenges,scenarios,index.ts}`·`tests/live/qa-session.ts`·`docs/design/challenge.md` — 무시했으나 H-1 에는 영향(아래).

### 직접 재실행 결과 `[확인]` (미러 `~/.node-local/thekaiwa`, `scripts/sync-local.sh` 직후 — checks.ts·테스트 파일 NFS↔미러 `cmp` 동일, `env -u DATABASE_URL`, dev 서버·라이브·DB 읽기 없음, 로그 scratchpad `rev117/`)

| 항목 | dev 주장 | 내가 잰 값 |
|---|---|---|
| conversation 전체(concurrency 1) | 478/478 | **478/478** pass 0 fail 0 skip 0 (`conv.log`) |
| `src/components` + `src/types` | 486/486 | **486/486** pass 0 fail 0 skip 0 (`comp.log`) |
| `tsc --noEmit` | rc=0·0줄 | **rc=0, 출력 0줄** (`tsc.log`) — 작업 트리에 DB0 등 남의 미완성 변경이 섞여 있어도 이 task 범위 밖 오류 없음 |
| eslint(`checks.ts`·`task039server.test.ts`) | rc=0·0줄 | **rc=0, 출력 0줄** (`eslint.log`) |
| 실데이터 재생(dev `d39d/replay.mts` 재실행) | TALK 39→34/34·A3 57/57·196→180/180·차이 0·메인 설명 최소 35자 | **동일** — TALK raw 39 old 34 new 34 · A3 pe039c 57/57 · pe039d 196→180/180 · diff 0 · newlyDropped 0 · 보이지 않는 문자 든 원값·메인·원문 0 · `min comparable(main) length 35` (옛 판 비교 함수는 dev 가 재구성한 것을 그대로 썼다 — 내가 새로 만든 옛 판 아님) |
| 3파일 보이지 않는 문자 리터럴 | 0 | `grep -nP`(U+0080–009F·00A0·00AD·034F·061C·115F·1160·17B4·17B5·180B–180F·2000–200F·2028–202F·205F–206F·2800·3000·3164·FE00–FE0F·FEFF·FFA0·FFF0–FFFC·E000–F8FF·E0000–E0FFF) `checks.ts` 0 · `api-contract.md` 0(파일 전체) · `task039server.test.ts` **1줄(U+3000, 아래 I-2)** · python `unicodedata`(Cc 개행·탭 제외/Cf/Zl/Zp/Cs/Co/Zs≠U+0020 + 위 목록) 같은 결과. 양성 대조(U+2028·FEFF·202E·3164·2800 을 넣은 파일)에서 grep·python 둘 다 잡음 → 스캔이 동작함. **task-039 이력서 자체 0건**(Leader 가 `<U+XXXX>` 로 바꾼 뒤 — grep·python 모두) |

### 우회·오탐 직접 재현 `[확인]` (dev 테스트와 별개로 내가 쓴 `rev117/repro.mts`·`fuzz.mts`, 미러의 실제 함수 호출)

- **A. 전수 스캔** — 고립 서로게이트를 뺀 **1,112,064개 코드 포인트 전부**를 문형 설명 한가운데에 넣어 분류: Cf 170개 전부 null(통과 0) · Cc 65개 = 59 null + 6 접힘(U+0009–000D·U+0085) · Zs 17+Zl 1+Zp 1 전부 접힘 · 기본 무시 코드 포인트(Lo 4 = U+115F·1160·3164·FFA0, Mn 263 = FE00–FE0F·034F·E0100–E01EF 등, Cn 3,769)·U+2800(So 1) 전부 null. **"위험군(Cc/Cf/Zs/Zl/Zp/기본 무시/White_Space)인데 통과" 코드 포인트 0개.** 접힘 집합 25개 = 정확히 JS `\s` 중 U+FEFF 만 빼고 + U+0085(`\s` 이면서 거부되는 FEFF 는 접기 전 거부). 고립 서로게이트 2,048개 × 앞/중간/끝 = 6,144건 중 통과 **0**. 통과하는 것은 사용자 영역 Co 137,468·미할당 Cn 810,961·보이는 결합 부호 Mn 1,796 등(dev 보고 #1 과 같음).
- **B. 복제 우회** — 보이지 않는 코드 포인트 **4,211종**(Cf·기본 무시 전부 + U+2800 + 고립 서로게이트 4종, 지시 대상 U+FE0F·034F·3164·115F·1160·2800·D800·DBFF·DC00·DFFF 포함) × 6형태(추가 설명의 원문 각 글자 사이 / 메인 설명 각 글자 사이 / 접두 삽입 / 학습자 쪽 삽입+깨끗한 복제 / 메인 설명 쪽 삽입+깨끗한 복제 / A3 `reviewExtraNote` 메시지 쪽 삽입) = 25,266건 중 null 아닌 것 **0**. Codex C2(3차)가 지적한 우회는 닫혔다.
- **B2. 남은 틈 1건(L-11)** — NFKC 뒤에 보이지 않는 문자를 지우므로, **학습자·메인 설명 쪽**에 "か + U+034F + U+3099(결합 탁점)" 처럼 합성을 막는 보이지 않는 문자가 끼어 있으면 NFKC 가 か+゛ 를 が 로 합치지 못해 깨끗한 「が」 복제가 통과한다(재현: 학습자 `か<U+034F><U+3099>んばります` · 추가 설명 `참고: がんばります` → 통과, 합성 차단 문자 없는 NFD 학습자는 null 로 닫힘). 닫힌 B 의 인터리브(미리 합성된 글자 사이 삽입)와 다른 경로다.
- **C. 정상 값 오탐** — 내가 만든 정상 문형 설명 16개(「〜たい(希望)」·전각 괄호·장음·반각 가나 ｶﾀｶﾅ·々·ヶ·〆·확장 한자 U+20BB7·↔ 와 →(FE0F 없음)·①②③·반각 가운뎃점·`～`/`〜`·한글 자모 ㅎ·ば형 등) 중 값이 바뀌거나 버려진 것 **0**. dev 테스트 15개(8+7)와 합쳐 31개 오탐 0. `comparable()` 확장 자체(보이지 않는 문자 지우기)가 만드는 새 오탐은 없다 — 추가 설명 쪽은 이미 거부됐고 상대 쪽에서만 지우므로 "더 많이 같다고 보는" 방향은 진짜 복제뿐이다. 새로 넓어진 곳은 **메인 설명을 `comparable` 로 정규화한 것**(D).
- **D. 짧은 메인 설명 부작용(L-12)** — 정규화 후 1~3자 메인 설명이면 같은 글자가 든 정상 추가 설명이 버려진다: `main="に"`·`"「に」"`(→ `に`)·`"조사"`·`"N5"` 일 때 `〜に(N5): 조사 に 는 장소를 나타내요` → null, `main="동사"` 일 때 `〜たら(N4): 동사 た형+ら` → null. 옛 판(`oneLine`+`includes`)은 `「に」` 를 **구두점째** 찾았으므로 정규화로 범위가 넓어진 것이 맞다(dev 보고 #3 와 같은 진단). 빈 문자열(`''`·`。`)은 건너뛰어 통과.
- **E. 퍼징** — 난수 60,000건(고립 서로게이트·C0/C1·Cf·한글 채움·결합 부호 섞음): throw 0 · 통과값 4,201건 전부 `보이지 않는 문자 없음·개행/탭/NEL 없음·≤200자·앞뒤 공백 없음·연속 공백 없음`(위반 0) · 비문자열 인자 11종(undefined·null·0·bigint·객체·배열·함수·Symbol·String 객체·NaN·true)을 세 인자 위치에 넣어도 throw 0. 성능: 추가 설명 5MB 47ms(길이 검사에서 null)·학습자 1MB 14ms·공백 2백만 개 10ms — ReDoS·지연 없음.
- **F. 테스트 변이(내 사본 `rev117/mirror`, 공유 미러·저장소 불변 — `cmp` 로 복원 확인)** — task039+task039server 두 파일에서 baseline 대비 실패 증가: M-a 기본 무시 코드 포인트 제거 +1 · M-b `\p{Cs}` 제거 +1 · M-c U+2800 제거 +1 · M-d `comparable` 에서 기본 무시·Cs·2800 제거 +1 · M-e 메인 설명 비교를 옛 방식으로 +2. 5변이 전부 새 테스트가 잡는다(사본에 tests/ 와 `.claude/` 가 없어 baseline 에 2건이 이미 실패 — 사본 구성 탓, 증가분만 의미).

### 지적 표 (신규)

| # | 심각도 | 영역 | 근거(파일:줄) | 위험 | 고칠 방법 |
|---|---|---|---|---|---|
| L-11 | Low(선택) `[확인]` 재현 · 도달성 `[추측]` 거의 없음 | `comparable` 정규화 순서 | `checks.ts:174`(`s.normalize('NFKC').replace(/[\s\p{P}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cs}\u{2800}]/gu, '')`) — 합성 차단 문자를 NFKC **뒤**에 지움(B2 재현) | 학습자 말이나 메인 설명에 "결합 부호 앞의 보이지 않는 문자"가 있는 극히 인위적인 경우만 복제 검사 통과. 학습자 본인의 말이 본인 화면 추가 설명 칸에 되비칠 뿐(타 사용자·Secret·데이터 노출 없음), STT·일반 키보드로는 생기지 않고 LLM 이 메인 설명에 쓸 일도 없다 | `comparable` 을 "보이지 않는 문자 먼저 지움 → NFKC → 공백·구두점·보이지 않는 문자 지움" 로(한 줄 + 테스트 1건). 안 해도 이번 판정 유지 |
| L-12 | Low(선택) `[확인]` 재현 · 도달성 `[가능성 높음]` 낮음 | 메인 설명 복제 검사 하한 없음 | `checks.ts:189`(`const main = … comparable(explanationKo)`·`:190` `if (main && tc.includes(main)) return null`) · 스키마 `schemas.ts:80`·`:212` `explanationKo`/`explanation_ko` = `minLength 1·maxLength 400`(한글 요건 없음) · 프롬프트 `talk.ts:249` "한국어 1~2문장(**80자 이내**)"(상한만) · `chatReview.ts:93` "어느 조각이 틀렸는지 짚고 이어서 쓰임 중심으로"(두 부분 지시) · 서버가 메인 설명을 만드는 경로 없음(grep — 항상 모델 값) · 실데이터 정규화 최소 35자(n=292) | 모델이 정규화 후 ≤3자 메인 설명을 내면(스키마는 허용) 같은 글자가 든 정상 추가 설명이 버려진다 — 결과는 "추가 설명 줄이 안 보임"뿐이라 부가 정보 손실이고 보안·무결성 영향 없음. 지시·실데이터로 보아 실제 발생 개연성은 낮다 | 하한 2줄: `if (main && (main.length >= EXTRA_NOTE_LEARNER_MIN ? tc.includes(main) : tc === main)) return null` — 학습자 쪽 하한(4자)과 같은 정책, 짧은 메인은 정확히 같을 때만 복제로 본다. 테스트는 `main='조사'` 두 케이스. 안 해도 이번 판정 유지 |
| I-2 | Info | 테스트 위생 | `task039server.test.ts:68` 에 U+3000(전각 공백) 리터럴 1개 — dev-039c 이전부터의 "전각 공백 접기" 입력으로 보이는 폭 넓은 공백(Zs)이라 서식 문자가 아니고 dev 스캔 목록(U+2800·3164·FE00–FE0F·FEFF·FFA0 등)에도 없던 문자 | 에디터·포매터가 반각으로 바꾸면 그 케이스가 조용히 약해진다(통과는 유지) | 원하면 U+3000 이스케이프 글(백슬래시 u 3000)(값 동일). 조치 필수 아님 |
| I-3 | Info(수용된 설계) | 이모지 거부 범위 | `checks.ts:145`(`INVISIBLE_CHAR_RE`) — U+FE0F 가 붙는 이모지(`⚠`+U+FE0F 류)를 든 추가 설명은 **값 전체가 null** | 모델이 FE0F 이모지를 쓰면 줄이 통째로 안 보임. 실데이터 0/292, 지우지 않고 버리는 방침(REV-116 과 동일)이며 Codex 권고 "이모지는 유효한 경우만 허용" 은 채택하지 않고 전부 거부 — 정당한 선택이다(이 칸에 이모지 필요 없음) | 조치 없음. 운영에서 NULL 비율이 이상하게 높으면 그때 재검토 |

### 감사 초점별 판정 (Leader 요청 1~5)

1. **Codex C2(3차)·L-7 닫힘 `[확인]`** — U+FE0F·034F·3164·115F·1160·FFA0·2800·고립 서로게이트는 어디에 있어도(앞·중간·끝) null, 원문·메인 설명 각 글자 사이 삽입 복제는 4,211종 전부 null(위 A·B). 정상 일본어 문형 설명 31개 오탐 0·실데이터 차이 0. `comparable()` 확장이 새 오탐을 만들지는 않는다(C). 유일한 잔여는 NFKC 순서 틈 L-11(인위적 입력). **L-7 종결.**
2. **메인 설명 복제 검사 부작용 `[확인]` 재현 · 위험도 Low** — 경로 확인: 스키마는 1자도 허용(`minLength 1`)하나 지시는 80자 상한·A3 는 두 부분 지시이고 서버 합성 경로가 없으며 실데이터 최소 35자. 정규화로 옛 판보다 넓어진 것도 사실(`「に」`→`に`). 하한을 두는 편이 낫다(L-12) — 비용 2줄·학습자 쪽 정책(4자)과 일치, 단 막지 않는다.
3. **문서 정확성 `[확인]`** — `api-contract.md:792` 를 코드와 항목별 대조: ① 거부(접기 전 원값) = `INVISIBLE_CHAR_RE` 4집합 ② 접기 = `[\s\u0085]+` ③ 접은 뒤 200자·C0/C1/DEL·한글 0·메인 복제·학습자 통째 포함·엔진명 순서와 의미 일치 · 비교 정규화(NFKC → 공백·`\p{P}`·① 문자 제거)·학습자 4자 하한(정규화 후)·메인 빈 결과 건너뜀·"저장값은 정규화하지 않는다" 일치. 다른 서술: `api-contract.md:730`("≤200자·개행 없음")·`:826`("TALK 과 같은 정리"·메시지 전체+짚은 문장 양쪽)·`domain-model.md:1173-1176`("≤200자·개행 없음"·생성 시에만)·`learning-personalization…md:169`(칸만) 모순 없음, `grep` 으로 옛 서술("공백을 뺀 비교"·"공백류(개행·탭) 접기")이 다른 문서·소스 주석에 남은 곳 없음(`FORMAT_CHAR_RE` 잔존 0). 사소: ②의 "U+2028·U+2029" 는 JS `\s` 에 이미 들어 있어 중복 표기(틀리지 않음). **L-8 종결.**
4. **범위 이탈·보이지 않는 문자 `[확인]`** — 위 범위 단락·스캔 표. 변경 3파일에 서식·제어·기본 무시 문자 리터럴 0(테스트 U+3000 1개는 I-2), 이력서 0.
5. **재실행 `[확인]`** — 위 표. 주장과 전부 일치(478·486·tsc 0·eslint 0·재생 차이 0).

### REV-116 노트 종결 판정

| REV-116 | 상태 | 근거 |
|---|---|---|
| **L-7** Cf 밖 보이지 않는 문자 | **종결** | 위 1번. 잔여는 L-11(인위적) |
| **L-8** `api-contract.md:792` 드리프트 | **종결** | 위 3번 |
| L-9 `tutor.md:66` 한국어가 든 「」 예시 | **이월(변화 없음)** | `tutor.md` 15:39 불변 |
| L-10 `scripts/sync-local.sh`·`.bak` | **이월(열림)** | `sync-local.sh` 21:27 그대로·미추적 `task-039-….md.bak` 여전히 있음(Leader 정리 대상) |
| I-1 데모 게이트 순서 | 종결(조치 없음) | — |
| REV-116 `～`(U+FF5E)↔`〜`(U+301C) 비대칭 | 이월(Info, 실영향 거의 0) | `comparable` 불변 |

### Codex 검토(C2 3차) 지적 판정

| # | Codex 지적 | 판정 | 근거 |
|---|---|---|---|
| 1 (low) | `\p{Cf}` 만 거부해 U+FE0F·U+034F·U+3164·U+2800 등이 통과하고 비교 문자열에도 남아 복제가 우회 | **채택·해결됨** (잔여 L-11 Low 선택) | 직접 재현 위 A·B — 전수 스캔 위험군 통과 0, 복제 우회 25,266건 0. 권고 3개: 「기본 무시 코드 포인트 거부」 채택 · 「U+FE0F·034F·3164 삽입 회귀 테스트」 충족(변이 5종을 모두 잡는 5건) · 「이모지는 유효한 경우만 허용」 은 **미채택**(전부 거부 — I-3, 수용) |

### H-1 갱신 (이월 운영 게이트) — 코드 변경 아님

`prisma/schema.prisma` 는 이제 `git diff` +69줄이고 task-039 칸(`extraNoteKo String? @db.VarChar(400)` — 정의 불변 `[확인]`) 외에 DB0 일괄분(`Challenge`·`ChallengeStatus`·`VocabSession.topicId`·`VocabAttempt.refType/refId`·`EngineMetricsDaily` TTS 칸 — 파일 머리 주석 "사용자 "전부 승인", 추가만")이 같이 들어 있다. 승인 기록 자체는 읽지 못했다 `[추측]`. REV-116 high_risk_areas ① 의 "`migrate diff` 가 컬럼 1줄뿐인지" 확인은 **더 이상 맞지 않는다** — 같은 push 에 DB0 변경이 함께 나간다(`challenge.md:292·1211` 도 "push 전 범위 확인"을 요구). Leader: 백업·승인 문구가 DB0 묶음 전체를 덮는지 확인하고, task-039 칸이 빠진 채 컬럼 없이 이 빌드가 먼저 나가면 #29·#32·#33·#34 가 실패하는 위험(H-1)은 그대로다.

### QA 에 넘길 high_risk_areas (REV-116 이월 + 신규)

1. **(이월·H-1 갱신) 배포 순서**: 백업 → `migrate diff`(**DB0 묶음 포함 SQL 전체**를 승인 범위와 대조) → `db push` → 라이브 검증 → push(webhook=운영 배포). 컬럼 전에 이 빌드가 나가면 교정 조회·저장 전부 실패.
2. **(이월·갱신) 교정 저장 왕복(실 DB)**: 채움/null/200 초과(null)/옛 행 NULL DTO 가 `done.correction`·#29·#34 에서 같은 값, **저장값이 접힌 한 줄**(개행·NEL·전각 공백 → 공백 하나), **서식·기본 무시 문자 포함 값이 NULL 로 저장**(실 DB 는 U+FE0F 이모지 시퀀스·U+3164·U+034F 값도 NULL 인지 샘플 대조 — 미러 테스트는 가짜 tx 라 `extraNoteKo` 컬럼 왕복은 실 DB 에서만 확인 가능). `original` 바이트 일치·채택 전 `WordEntry` 0, `RequestTrace`·`toolLog`·로그에 추가 설명 문자열 0 grep.
3. **A3 타임아웃·위반율 운영 실측**(REV-116 항목 3 그대로): 운영 스모크 `chatReview@v3` ≥10회, 최종 실패·타임아웃 수, FAILED 화면([다시 시도])·부분 저장 없음.
4. **화면 3폭(360/390/412) × 「」 밖 일본어 줄바꿈·기기 글꼴**, 5. **TalkBack**(한 글자 `lang=ja` 구간·한국어가 든 「」 조각), 6. **(이월) 지연·채움 감시**: `task007-latency`·p95, 조각 언급 비율, `extraNoteKo` 채움률 — 운영에서 NULL 비율이 비정상적으로 높으면 정리(거부)가 값을 과하게 버리는지 L-12·I-3 순으로 본다.

### 다음 단계

Critical 0·High 0(H-1 이월)·Medium 0 → **QA 진행 가능**(코드 수정 요구 없음). 선택: L-11(`comparable` 순서 한 줄)·L-12(하한 2줄)는 둘 다 인위적/낮은 개연성이라 미적용이어도 되고, 적용하면 Reviewer 소재순환(작음). Leader: ① task-039 를 010d 보다 먼저 커밋(checks.ts 경계 — 위 범위 단락) ② `.bak`·`sync-local.sh` 정리(L-10) ③ H-1 갱신 반영 ④ I-2 는 편의로만. 재현 스크립트·로그: scratchpad `rev117/`(저장소 밖 — `repro.mts`·`fuzz.mts`·`scan.py`·`*.out`·`*.log`).

```json
{ "reviewId": "REV-117", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 }, "carried": { "high": ["REV-115 H-1 배포 순서(운영 게이트 — DB0 일괄 push 와 묶임)"] }, "native_change": false,
  "closed": ["REV-116 L-7", "REV-116 L-8", "Codex C2 3차 low"],
  "high_risk_areas": ["배포 순서·DB0 묶음 db push 범위 대조", "교정 저장 왕복(실 DB)·접힌 한 줄·서식/기본 무시 문자 NULL·original 불변·채택 전 WordEntry 0", "A3 v3 타임아웃·FAILED 화면·운영 실측", "3폭 × 「」 밖 일본어 줄바꿈·기기 글꼴", "TalkBack 한 글자 ja 구간·한국어가 든 「」 조각", "p95·조각 언급·채움률·NULL 비율 감시"] }
```


## Codex 검토

### [2026-10-06 21:50] C2 adversarial-review focus=design_assumption — done
- judge 판정: codex_gate/C2 (2026-10-06 18:35, mode=adversarial-review, focus=design_assumption) / 호출 차수: 3/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a701(task_file) snapshot=304bb0b8
- 지적 1건: [Low] src/modules/conversation/structuredResponse/checks.ts:147 — `FORMAT_CHAR_RE`가 `\p{Cf}` 만 거부하여 U+FE0F(Variation Selector), U+034F(CGJ), U+3164(한글 채움), U+2800(점자) 등 Cf 범주 밖의 보이지 않는 문자가 통과하고, 비교 문자열(`comparable`)에도 남아있어 화면상 동일한 원문 복제가 필터를 우회할 수 있음 → 보이는 문자열과 저장 문자열의 불일치 가능성 · 권고: Default_Ignorable_Code_Point 제거 또는 거부, 이모지 시퀀스는 유효한 경우만 허용, U+FE0F·U+034F·U+3164 삽입 회귀 테스트 추가
- 검토하지 못한 범위: TalkBack 실측(접근성 낭독), 실데이터 경로 미상세로 독립 재검증 불가
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T125033Z-task-039-C2

## Leader 기록 (DB0 통합 `db push` 완료, 2026-10-06 22:17)

- **사용자 승인**: AskUserQuestion 2026-10-06 "DB 구조 변경 전부 승인". Reviewer REV-118 PASS_WITH_NOTES(승인 목록 9문장 1:1 일치·승인 밖 0·운영 공존 안전).
- **실행 순서(체크리스트 1~6 준수)**: ① 감사한 5파일 sha256 앞 16자·`git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 그대로 확인 ② **백업** `files/thekaiwa/backups/thekaiwa-20261006-221627-pre-p2db.sql.gz`(600, 227,836 B, "Dump completed on 2026-10-06 22:16:31", 53개 표) ③ **`migrate diff` 재실행**(`--from-schema-datasource` → 파일): 9문장·sha256 앞 16자 `66c04634550da524`(검토본과 동일)·삭제/경고/이름 변경 0 ④ **`prisma db push --skip-generate`**(`--accept-data-loss` 없음) 22:17:00~22:17:42 rc=0 "Your database is now in sync" ⑤ **검증**: `migrate diff` 재실행 = "This is an empty migration"(드리프트 0) · `information_schema`: `Challenge` 16칸·FK 2(`userId`·`topicId`)·인덱스 `activeKey` 유니크 + `(userId,status,startDate)` + `(userId,endedAt)` · 새 칸 10개 존재(`Correction.extraNoteKo`·`EngineMetricsDaily` 6·`VocabAttempt.refType/refId`·`VocabSession.topicId`) · 행 수 Correction 7·VocabSession 6·Challenge 0 · 운영 `/api/health` success·`status:ok`·`degraded:[]` · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online restarts 0(로그의 Prisma 오류 줄은 10-06 00:17 의 기존 `[jobs]` 줄 — push 와 무관) ⑥ 메인 미러 `prisma generate` 완료.
- **SQL 소속 task**: `Correction.extraNoteKo` = task-039 · `EngineMetricsDaily` 6칸 = task-012b-3 · `VocabAttempt.refType/refId`·`VocabSession.topicId`(+인덱스·FK) = task-042 · `Challenge` 표(유니크 1·인덱스 2·FK 2) = task-041. 이 push 로 **네 task 의 DB 선행이 충족**됐다(운영 코드는 추가분을 select 하지 않으므로 영향 없음).
- 복구 1순위: 새 칸·표만 역순으로 되돌리기(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸). 백업 전체 복원은 공유 DB 전체 되돌림이라 최후 수단.
- 이후: `git push` 는 사용자 지시대로 **전부 끝난 뒤 한 번** — 커밋은 pathspec(`git add -A` 금지).

## QA 기록 (qa-039, 2026-10-06 22:50 ~ 2026-10-07 01:05 KST)

**판정 요약: 결함 Critical 0 · High 0 · Medium 0 — 코드 결함 발견 없음(관찰·Low 6건, 아래).** 단 `[판단은 Leader]` 수치 2건(LLM 단계 p50 +8.6%·A3 p95 82s)과 NOT_VERIFIED(STT 경유 지연·TalkBack·실기기·녹음 중 펼침)가 남는다.

### 환경·재현 조건
- 미러 `~/.node-local/thekaiwa-qa039`(원본 `~/.node-local/thekaiwa` 에서 `rsync --link-dest` 로 node_modules 만 하드링크·`.cache`·`.prisma` 제외 → `KAIWA_LOCAL_ROOT` sync-local → 미러에서 `prisma generate`(extraNoteKo 54회 확인)). **작업 트리 스냅샷 22:49 시점**(다른 WP — 챌린지 T1·T2·TTS 관측 — 의 미완성 변경이 섞여 있었으나 빌드·tsc 모두 통과, 임의로 남의 파일을 고치지 않음). 기준선(HEAD `5c3a701`) 미러 `~/.node-local/thekaiwa-qa039-head`(`git archive HEAD` — talk@v8·chat@v3·chatReview@v1·lesson@v8).
- dev 서버 `next dev -H 127.0.0.1 -p 3030`(`APP_ENV=LOCAL`, `.env` 확인 — PRODUCTION 아님), 운영 3010·pm2·운영 DB 쓰기·`db push`·커밋 없음. QA 계정 `qa-bot`(주)·`qa-bot2`(IDOR)만. DB 는 Leader 가 22:17 에 적용한 공유 MariaDB(`Correction.extraNoteKo varchar(400) NULL` 확인 — information_schema).
- **QA 시각 검증 재현 조건**: Chrome 147.0.7727.101 headless(`/usr/bin/google-chrome`, playwright-core) · viewport 360/390/412 × 780·892(다크는 390×892) · DSF 2.625·isMobile·hasTouch · locale ko-KR · tz Asia/Seoul · `document.fonts.ready` 대기 + 루비 로드 대기 · 시나리오별 reducedMotion(reduce 기본 / no-preference 별도 1회) · 네트워크 fixture 없음(실 dev 서버·실 DB) · 일본어 글꼴 `Noto Sans CJK JP`(fc-match 확인 — CSS 폴백 목록과 일치, S25+ 와 같은 계열) · 캡처 범위 = 표현 점검 결과 전체·회화방·모아 둔 교정 시트·390 라이트/다크 대표 각 1장(눈으로만 확인 후 삭제). 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED`(approved v1, hash 212d9e93 = 파일). **데모 v1 과 구현의 대조**: 데모 `#p_rv-e2` 를 같은 조건으로 펼쳐 계산값을 구현(회화방·점검 실측)과 비교 — 버튼 44px·상자 14px·글자색 rgb(90,99,89)·왼쪽 선 rgb(221,226,217) 2px·왼쪽 안 여백·word-break keep-all **전부 일치**, 카드 안 순서(설명 → 줄 → 안내 → 채택·무시) 일치. 데모 화면은 라틴 폴백 글꼴이라 글자 모양이 다르다(허용 범위: 글꼴·합성 문구·상자 높이는 내용 길이 따라 다름).

### 체크리스트 결과(원 출력 요약)
| # | 항목 | 실행 | 결과 |
|---|---|---|---|
| 1 | 컬럼·조회·저장(#29·#32·#33·#34) | `qa039/dbcheck.ts`·`live.ts`·`review-live.ts` | **PASS** 컬럼 varchar(400) NULL 확인, 실패 0(200 오류 0). #34 가 옛 행(NULL) 5건에 `extraNoteKo:null`(키 존재) 반환 |
| 2 | 교정 저장 왕복(실 DB) | TALK 160턴(작업본 A·A′) + A3 12회 | **PASS** `done.correction`=DB=#29=#34 `extraNoteKo` 일치 (TALK 149건·A3 122건, 불일치 0, 키 존재 100%) · `Correction.original` 바이트 일치(입력·done·DB) 149/149, A3 original 이 메시지 안 인용(바이트) 122/122 · 저장값 형식(null 또는 한 줄·≤200·한글 포함) 위반 0 · 채택 전 WordEntry·StudyLog 행 수 불변 160/160 · toolLog·RequestTrace.steps 에 추가 설명 문자열 0(toolLog/steps 대조 ≈320건 + A3 trace 13건·AiJob payload/result 0종) · dev 서버 로그 0(키 이름 `extraNoteKo` 출현도 0) · 200 초과→null·접힌 한 줄·서식문자 null 은 **LLM 이 안 내므로 라이브로 못 만든다 → 단위 테스트로 갈음**(`task039server.test.ts` — 전체 1762/1763 통과) |
| 2b | 제안→채택 불변 | `adopt-check.ts`(합성 교정 3건) | **PASS 10/10** — 채택 전 WordEntry·StudyLog 0 · addWord 채택 WordEntry 1(CORRECTION·sourceRefId)·StudyLog 0 · 채택·무시 뒤 original·corrected·explanation·extraNoteKo 불변(DB·#34) · 재채택·무시 409 · 타 사용자 404 |
| 3 | 지연·계약(작업본 vs HEAD) | `live.ts` corr20+style60 ×(작업본 A, HEAD B, 작업본 A′) | 아래 수치 표 · 교정 검출 **16/16·오탐 0/4**(A, A′ 각각 동일, HEAD 15/15 + 1턴 12s 타임아웃) · 1차 통과 작업본 157/160(98.1%)·HEAD 79/79 |
| 3b | A3 chatReview@v3 운영형 12회 | `review-live.ts RUNS=12` | 성공 12/12·**타임아웃 0**·최종 실패 0·서버 내부 재시도 2(runs 2·3, 각 ≈+37s) → 1차 통과 10/12 · ms p50 41.6s·p95 82.3s·max 82.3s(평균 48.3s) · 교정 122건 중 추가 설명 63(52%) · 시험식 52/65·일상 11/57 · 설명 '조각' 언급 122/122 |
| 3c | 실패 시 화면·부분 저장 | `review-fail.mjs`·`talk-fail.ts`(서버를 `CLAUDE_CLI_PATH=없는 경로` 로 기동 — **타임아웃이 아니라 엔진 실패 주입**) | **PASS 13/13** — #33 502 `ENGINE_ERROR` "AI 분석 도구를 사용할 수 없습니다…"(엔진·경로 문자열 0) · 교정 0·reviewedAt null·제안 0·WordEntry 0·AiJob FAILED · 다시 시도 = 같은 실패·중복/부분 행 0 · 3폭 FAIL_TEXT 표시·[다시 점검하기] 48px·가로 넘침 0·화면 시도 뒤에도 행 0 · TALK 턴 `error`(retryable)·사용자 말 바이트 보존·강사 행 FAILED·교정 0 |
| 4 | 기존 스모크 | `tests/live/*.ts`(미러에서, 직렬) | 006: 1회차 **39/42**(10c·3a·3b 타이밍 3건) → 2회차 쿠키 만료(401, QA 도구 문제) 중단 → 3회차 **42/42** · 007 **47/47**(스크립트 현행 개수) · 턴 계약 `task037-qa-turns … 3` **71/71** · 011 **60/60** · 010 **64/65 — 9d 실패, HEAD 에서도 동일(64/65)** |
| 4b | 정적·단위 | `env -u DATABASE_URL node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` · `tsc --noEmit` · `eslint src tests qa039` | 단위 **1762 pass / 0 fail / 1 skip (1763, 153파일)** · tsc rc=0 · eslint: task-039 파일 **0 error**(에러 1건은 `learning/__tests__/task042.test.ts` — 다른 WP, 경고는 기존 `set-state-in-effect`) |
| 5 | 화면 3폭 | `ui.mjs`(실 Chrome) | **PASS 520/520**(REVIEW 343·TALK 168·기타 9, 360/390/412 × 780·892 + 다크 390). 표현 점검 ①짧은 값 ②200자 ③null ④XSS · 회화방 인라인 짧은 값·긴 값(194자)·null · 모아 둔 교정 시트(XSS). 가로 넘침 0·페이지 레벨 세로 스크롤 0(접힘·펼침 모두) · 버튼 높이 ≥44px · 카드 폭 전체가 눌림(버튼 폭=카드 안쪽 폭, 오른쪽 끝 점 hit) · 접힘 시작·aria-expanded 토글·aria-controls/describedby 대상 존재 · NULL 카드는 줄·머리줄 id·상자 없음 · Tab 도달→포커스 링(`:focus-visible` 2px solid #C8471F / 다크 #F06A45, offset 2px)·Enter 펼침·Space 접힘·포커스 유지 · reduced-motion=reduce `animation-name:none` / no-preference `extra-note-in 0.16s` · 다크 토큰 반전(bg rgb(246,247,244)→rgb(20,24,22), 글자 rgb(90,99,89)→rgb(174,182,172)), 상자 글자 대비 라이트 5.81:1·다크 8.61:1 · 히라가나·한글 표시 켠 채로(기본값) 상자 안 `ruby`·한글 줄 0 · 「」 밖 일본어 `lang="ja"` 누락 0 · XSS 리터럴 img/script/b 요소 0·`window.__xss` 미실행·글자로 표시 · 긴 값 200자 안 자르고 전체 표시(360 에서 상자 206px, 390/412 에서 183px) · 엔진·모델명 문자열 0·콘솔/페이지 오류 0·5xx 0 |
| 5b | 옛 교정(NULL) 카드 | `old-card.mjs` HEAD 서버 vs 작업본 서버 같은 방 | **PASS** 360/390/412 모두 `li` outerHTML(id 정규화) **바이트 동일**·높이 동일(388.88·411.38 / 279.69·302.19 / 279.69·302.19px) |
| 5c | 줄바꿈(REV-116 `word-break:inherit`) | `boxAudit` Range 줄 측정 | 한국어 어절 한가운데 줄바꿈 **0**(전 폭·전 값) · 한글↔일본어 경계(공백 없음) 1건(412 긴 값 `」|(` — 어절 중간 아님) · 일본어 「」 안 줄바꿈 1~2/값(`word-break:normal` 설계대로) |
| 6 | 회화방 스크롤 따라가기 | `ui.mjs`(390×780)·`ui-playback.mjs` | **PASS**(a) 바닥에서 마지막 카드 펼침: scrollTop 6944→6944, 눌린 줄 top 311→311(Δ0), 펼친 상자 bottom 538 < 목록 bottom 663(보임) (b) 중간 위치 펼침: 눌린 줄 이동 0.3px·상자 보임 · 재생 중 펼침(Web Audio 노드 추적, 360/390/412 각 1회): 재생 큐 1.29s+2.90s 노드, 펼침 클릭은 첫 노드 재생 중(시작 후 ≈120ms), `stop()` 0회·전부 자연 종료 → **끊김 없음**(첫 컨텍스트의 첫 노드가 3초대로 늘어나는 현상은 폭·펼침과 무관 — 순서 바꾸기·펼침 없음 대조 모두 재현, headless 오디오 클럭 워밍업으로 보임 `[추측]`) |

### 측정 수치(보고만 — 판단은 Leader)
**작업본(A 80턴 + A′ 80턴, 시간 분리 2회) vs HEAD(B 79턴 + 타임아웃 1)** — 같은 입력(합성 픽스처 corr 20 + style 60)·같은 서버 경로(TEXT 입력 → SSE `done`·첫 `audio`)·같은 QA 계정·순차 실행(교차 아님: A 22:58~23:10, B 00:14~00:28, A′ 00:35~00:49). A 와 A′ 의 `done` p50 이 6,536 / 6,531ms 로 시간 변동은 작았다. 부트스트랩 95% CI.
| 지표(ms) | 작업본 p50 / p95 (n=160) | HEAD p50 / p95 (n=79) | p50 차이 [CI] | p95 차이 [CI] |
|---|---|---|---|---|
| `done` | 6,536 / 9,746 | 6,290 / 9,116 | **+3.9% [−3.2, +14.7]** | +6.9% [−13.5, +19.3] |
| 첫 `audio` | 1,733 / 3,717 | 1,747 / 4,097 | −0.8% [−13.8, +16.2] | −9.3% [−32.3, +16.8] |
| LLM 단계(Trace) | 4,543 / 5,661 | 4,182 / 5,337 | **+8.6% [+4.8, +12.9]** (+361ms) | +6.1% [−4.7, +15.7] |
| LLM 첫 문장 | 1,064 / 1,219 | 1,017 / 1,506 | +4.6% [+2.5, +8.0] | −19.1% |
| ACCEPT 단계 | 903 / 2,324 | 915 / 2,634 | −1.3% | −11.8% |
| `TTS[0]` ttfaServer | 414 / 1,808 (n=140) | 205 / 2,545 | 비교 불가(캐시 적중 변동 — CI −47%~+2956%) | |
- 부분집합: corr 20 `done` p50 작업본 5,389(A)/6,164(A′) vs HEAD 5,322 · style 60 작업본 6,907(A)/6,550(A′) vs HEAD 6,557. 첫 턴 컴파일 제외 시 `done` p50 +5.5% [−3.8, +18.6]·LLM p50 +6.9% [+3.0, +11.5].
- **눈여겨볼 것**: LLM 단계 p50 의 CI 상한(+12.9%)이 +10% 선을 넘는다(PE 모듈 수준 측정은 +3.9%[CI −1.0~+8.5]). `done`·첫 음성 기준으로는 선 안(상한 +14.7%·+16.2% 로 CI 는 넓다). 서버 `ACCEPT`(DB 왕복) 약 0.9s 가 양쪽에 같이 들어 있어 사용자 체감 5초 예산 해석은 Leader 몫. 표본은 합성 문장 80종 × 2.
- **ajv/계약 1차 통과**: 작업본 157/160(98.1% — 위반 3건: chunkType `"GRAMMAR"` 허용값 밖 1·`correction.original` 전체 복사 규칙 2) · HEAD 79/79. Fisher p=0.245 — 비하락 판정은 Leader. 최종 계약 실패 0/160(작업본), `extraNoteKo` 관련 위반 0건(서버 로그 `[json] 1차 응답 계약 위반` 줄에 extra 없음). HEAD 의 1턴은 `ENGINE_TIMEOUT`(12s fail-fast, 사용자 안내문 표시 정상).
- **교정 검출·원문**: 작업본 149/152 · 오탐 0/8 · HEAD 73/75 · 오탐 0/4. 미검출은 양쪽 같은 항목(n5d10 「行ってもいいです」·n4x10 「あげました」). 교정문이 기대와 다른 항목은 대부분 허용 가능한 다른 교정.
- **감시 수치**: TALK 메인 설명 '조각' 언급 **작업본 78/149(52%)** vs HEAD 43/73(59%) — 7%p 하락, p=0.41(PE 의 −17%p 보다 작음, 기준선 −30%p 선 훨씬 안) · 스타일 세트만(n=117) 65/117(56%) · 메인 설명 JLPT식(규칙) 14/149(9%) vs 12/73(16%)(p=0.35 n.s.) · **`extraNoteKo` 채움(서버 정리 후)** 작업본 TALK 61/149(41%)(PE 서버 정리 후 47%) — 시험식 문장 40/58(69%)·일상 문장 16/59(27%) / A3 63/122(52%)(시험식 52/65·일상 11/57) · 길이 min/p50/max TALK 7/22/37·A3 6/—/31(권고 40 초과 0·200 초과 0).
- **정확도 눈 판정(1인, 동의 약한 기준)** TALK 첫 실행 채워진 28건 전수: 오정보 **1건**(n5x03 `〜前に(ぜんに)` — 前의 읽기가 まえ 인데 「ぜんに」), 줄 이름 '시험 문법'과 내용이 안 맞는 일상 활용 규칙 **3건**(e11 「い형용사 과거: 寒い→寒かった」·n5d01 「ありがとうございました：과거형 경어」·e08 「〜ことです: 명사화 표현」은 경계), grammarPoint 와 같은 문형 이름을 다시 쓰는 저정보 줄이 다수(n4d01 「〜てもいい: ~해도 괜찮다」·n3x10 「〜によると: ~에 따르면」 류 약 10건). 나머지는 정확하고 `〜`·「」 문형 표기·접속 형태 한 줄.
- **LLM 호출 수·실패**: 합계 약 **340회**(TALK 턴 240+8(준비·프로브)·A3 12(+서버 내부 재시도 2)·스모크 006 ×3 ≈42·007 ≈9·턴 계약 6·011 5·010 ×3 ≈14). 실패·타임아웃: TALK 12s 타임아웃 1(HEAD 팔), A3 90s 타임아웃 0, 세션 한도·429 0, 호출 간격 ≥5.6s(분당 12턴 제한)·직렬. M4 TTS 는 TALK 턴마다 합성(운영과 공유, 약 1시간 40분에 걸쳐 분산).

### 결함·관찰
- **결함 없음(Critical/High/Medium 0).** 관찰·Low:
  1. **[Low·환경] 006 1회차 3건 실패(10c·3a·3b)** — 둘 다 "긴 이모지 턴이 진행 중일 때" 전제인 동시성 타이밍 검사. 같은 코드에서 3회차 42/42, 별도 프로브(`conc-probe.ts` — B 진행 중 A 턴 → 409 `runningMessageId` 정상)는 통과. 서버 `ACCEPT` 약 0.9s·`POST /chats` 2회 4s 등 DB(NAS) 지연 때문에 진행 중이던 턴이 먼저 끝난 것으로 `[추측]`. 재현 안 됨.
  2. **[Low·테스트 환경] 010 스모크 9d(`reviewDecisionJobId`·`nextReview` null 기대)** — HEAD(`5c3a701`)와 작업본 모두 64/65 로 **동일하게 실패**(작업본 2회·HEAD 1회) → task-039 와 무관. 원인(코드 읽기, `[가능성 높음]`): `reviewGuardOf` 는 studyDays ≥ 2·items ≥ 2 이면 해제되는데 QA 계정 qa-bot 에 기존 DAILY(10-03·10-05)가 있어 오늘 수업 완료 때 A11 판단 잡이 걸린다. 스모크 기대값이 환경 상태에 의존 — Developer 가 스모크에서 학습일을 심거나 기대를 느슨하게 할 것(비차단).
  3. **[Low] A3 응답 시간** p50 41.6s·p95 82.3s(PE 31.7s) — 90s 상한에 근접(runs 2·3 은 서버 재시도 1회가 끼어 80s대). 12회 표본은 타임아웃 ≤6%(PE 3/50)를 가르지 못한다. 타임아웃·실패 화면은 엔진 실패 주입으로 확인(13/13). `stripAdditionalProperties`·재시도 정책은 Leader 판단(pe-039d 권고 ①).
  4. **[Info] 추가 설명 품질**: 위 눈 판정(오정보 1/28·줄 이름 불일치 3/28·저정보 중복 다수). 코드 결함 아님, 감시 항목.
  5. **[Info] 줄바꿈**: 412 긴 값에서 「」 다음 `(` 앞 줄바꿈 1건(공백 없는 한글↔일본어 경계, 어절 중간 아님).
  6. **[Info] 도구**: 스크린샷 왼쪽 아래 둥근 "N" 은 Next dev 도구 표시(개발 서버 한정, 운영 빌드 아님). 세션 쿠키 TTL ≈ 1시간(긴 QA 때 중간 갱신 필요 — README 에 적음).

### 확인 못 함(NOT_VERIFIED)·사용자 육안 필요
- **스크린리더(TalkBack)**: 「」 밖 한 글자 `lang=ja` 구간 끊김(실데이터 30개)·한국어가 든 「」 조각 낭독·`role="log"` 안 펼침 중복 낭독 — 확인 못 함(실기기 필요).
- **실기기 S25+**(Noto Sans JP 실글꼴·소프트 키보드·터치 감촉)·APK 웹뷰 — 확인 못 함(웹 변경이라 APK 재설치 불필요).
- **녹음 중 펼침**(마이크 입력 경로)·**STT 경유 TALK 지연**(`task007-latency` 의 gateway WS 경유 — 운영 gateway 8100 이 운영 앱(3010)에 콜백을 걸어 3010 접촉이 생기므로 하지 않았고, 개발 gateway 는 띄우지 않았다) — 확인 못 함. 대신 TEXT 입력 경로(LLM→TTS)의 `done`·첫 음성만 측정(STT 구간은 이 task 가 안 건드림).
- **펼침 직후 새 문장이 동시에 도착하는 경합**(REV-115 high_risk 5의 3번째) — 자연 재현 불가(유예 500ms 안에 첫 증가가 와야 함), 판정 함수 단위 테스트만 — 확인 못 함.
- **200 초과 null·접힘·서식문자 null 의 실 DB 왕복** — LLM 이 안 내므로 라이브로 못 만든다(단위 테스트·가짜 tx 로 갈음). 합성 값(짧은 값·200자·null·XSS)은 화면용으로 QA 가 DB 에 직접 넣은 것(LLM 출력 아님).
- **운영 스모크(`SMOKE_ENV=PRODUCTION`)** — 운영 배포 전이라 해당 없음(배포 후 deployer·QA).

### 정리 내역
- 만든 행: QA 계정 채팅 방(작업본 160턴·A3 12·ui-prep 3·old-card 1 등 — API DELETE·`cleanup.ts` 로 삭제)·`TutorProposal`·`AiJob`·`RequestTrace`·`LearningObservation`·`Attendance`·`LearnerErrorStat`·오늘 DAILY(10-06·10-07) 행 모두 `SINCE=2026-10-06T13:50Z` 기준 삭제(최종 `baseline.ts` 대조: baseline0 에서 프로브 기여분 — chat 1·message 2·correction 1·trace 1·observation 1·DAILY 1 — 외 변화 없음, 레벨 N5 유지). **부수 영향(스모크 기존 규칙)**: 010·011 스모크가 시작 시 QA 두 계정의 반복 항목·제안을 비우도록 돼 있어 이전 레인이 남긴 `RepetitionItem` qa-bot 30·qa-bot2 20, `TutorProposal` 7·1 이 함께 삭제됐다(QA 계정 행뿐, 운영 사용자 무관). 기존 DAILY(10-03·10-05)는 그대로.
- 산출물 정리: `/tmp/qa-artifacts/TheKaiwa/task-039/` 스크린샷 12개(+데모 캡처 1) 삭제, 세션 쿠키 파일 삭제.
- 프로세스 정리: dev 3030(작업본·HEAD·실패 주입 판 모두)·3031 종료, `ss -ltn` 로 포트 비움 확인. 미러 `~/.node-local/thekaiwa-qa039`·`thekaiwa-qa039-head` 는 남아 있다(삭제는 사용자 몫). 개발 서버 3030 이 00:49 에 자체 종료됐는데 같은 시각 다른 프로젝트 next-server 여럿도 재시작돼 있었다(원인 미상, 내 작업은 이미 끝난 뒤였고 영향 없음).
- 코드·프롬프트·스키마·문서 수정 0. 추가한 것은 `tests/live/task039-qa/*`(QA 도구 14개, lint 0·tsc 0)와 `tests/live/README.md` 한 항목뿐.

## Leader 기록 (2026-10-07, QA 판정 후)

- **qa-039 PASS_WITH_NOTES** — Critical·High·Medium 0, Low·Info 6건. 컬럼·저장 왕복 PASS(TALK 149·A3 122 불일치 0, `original` 바이트 일치), 채택·불변 10/10, 검출 16/16·오탐 0/4, 화면 3폭 520/520, 스크롤·재생 PASS, 엔진 실패 주입 13/13. 기존 스모크: 006 42/42(1회차 39/42 → 3회차 재현 안 됨)·007 47/47·턴 계약 71/71·011 60/60·010 64/65(9d 는 HEAD 에서도 동일 실패 — task-039 무관)·단위 1762/1763(skip 1).
- **수치 2건 Leader 판단**:
  1. **LLM 단계 p50 +8.6%[CI +4.8, +12.9]** — 완료 기준 "지연 p50 비악화(≤+10%)·TALK `done`·첫 음성 비악화"는 사용자 체감 지표인 `done` +3.9%(CI −3.2~+14.7)·첫 음성 −0.8% 로 충족, LLM 단계는 점추정이 선 안(+8.6%)이고 PE 교차 측정(+3.9%·+6.6%)과 같은 범위. CI 상한이 선을 넘는 것은 순차(비교차) 측정·표본 한계. **수용 — 운영 감시 항목**(TALK `done` p50, `extraNoteKo` 채움률 41%/52%·NULL 비율). 악화가 확인되면 `extraNoteKo` 길이 상한을 줄이는 것이 첫 조치.
  2. **A3 응답 p95 82.3s(상한 90s)** — 12/12 성공·타임아웃 0, 서버 내부 재시도가 낀 2건이 80s대. HEAD 도 같은 모양(PE 측정 head review#3 은 90s 초과 실패)이라 task-039 가 만든 문제가 아니다. **이 task 에서 코드를 바꾸지 않는다** — `stripAdditionalProperties: true`(pe-039d 권고 ①, 재시도 감소) 는 **후속 백로그**(적용하면 Reviewer→QA 재순환 필요). 타임아웃 시 [다시 점검하기] 화면은 13/13 확인.
- **품질 관찰(Info 4)**: 추가 설명 1건 오정보(`〜前に(ぜんに)`)·'시험 문법' 줄 이름과 안 맞는 일상 활용 규칙 3건·grammarPoint 되풀이 다수 — 프롬프트 모듈의 후속 튜닝 후보(운영 샘플 관찰 뒤).
- **확인 못 한 것(사용자 몫)**: TalkBack·실기기(S25+)·녹음 중 펼침·STT 경유 TALK 지연(운영 gateway 8100 → 운영 앱 3010 콜백 구조라 하지 않음).
- **로컬 커밋**: `f01e469`(task-039 53파일) + `2f073ec`(JaQuoted 이동 누락분). 푸시는 최종 통합 단계.
- **후속 백로그 추가**: 010 스모크 9d 가 qa-bot 의 10-03·10-05 DAILY 잔여 때문에 실패(가능성 높음) — 스모크 시작 정리 규칙 보강 후보.
