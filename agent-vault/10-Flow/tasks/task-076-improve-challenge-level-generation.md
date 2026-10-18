---
task_id: task-076
title: "오늘의 단어·회화 생성을 챌린지 난이도 기준으로, 챌린지가 없으면 프로필 목표수준 기준으로 — 챌린지 만들 때 난이도(목표) 설정 (IMP-0051)"
status: doing
waiting: dev_server
base_ref: fd2d939
risk_level: "R1"
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-040-improve-challenge-design, task-053-improve-today-words-level-weight, task-074-improve-word-favorites]
tags:
  - type/task
  - domain/challenge
  - domain/vocab
  - domain/lesson
  - domain/improvement
aliases:
  - 챌린지 난이도 기준 생성
  - task-076
created: 2026-10-18
updated: 2026-10-18
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 2
  repo_path: "docs/demo/task-076-challenge-level-v2.html"
  artifact_url: "https://claude.ai/artifact/GNoNjxpVfPQs9f1cc1rmi7"
  content_sha256: "90a51f2f6b52488dc9fe74b73a2839276a8b33b4307996c4f5dc00b3f276c8dd"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-18T18:19:44+09:00"
  approval_quote: "D1~D11 권고대로 승인, 질문 5는 a로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-076 — 챌린지 난이도·프로필 목표수준 기준 생성 + 챌린지 난이도(목표) 설정 (IMP-0051)

## 사용자 요청 (원문)
`/개선작업 프로젝트:일본어교육` — 「오늘의 단와 회화를 생성할때 챌린지의 난이도에 따라서 생성하도록 해주고 챌린지가 없다면 프로필에 생성되어있는 목표수준에 맞춰서 생성할수있도록해줘. 그렇게 하려면 챌린지를 설정할때 목표를 설정할수있도록 해줘」(2026-10-18) → 접수 IMP-0051(`inbox`).
착수 지시: 「승인할테니 작업 진행해줘」(2026-10-18). **이 말은 특정 데모·DB 변경 승인이 아니다** — 아래 열린 결정(Q1~Q5)은 Leader 의 ★ 권고로 데모에 올리고 사용자가 데모 승인 문장으로 확정한다. DB 칸 추가가 필요해지면 별도 승인을 받는다.

## judge 접수 (2026-10-18)
1차(경로 10개): light·데모 면제 → **Leader 거절**(화면 구조 변경(챌린지 만들기에 단계 추가)이 있고 실제 변경 파일이 12개를 넘음; task-073 때와 같은 이유). 2차(경로 18개·화면 구조 변경 명시): `feature` · 복잡도 2.03 · **R1** · developer **opus** · 트랙 **standard**(`too_many_paths`) · 데모 **delta**(`JV-ui_change`) · roles designer·prompt-engineer?·developer·reviewer·qa · next `demo_first`. 결과 JSON `judge-result@2`.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 챌린지 기능 [[task-040-improve-challenge-design]]·task-041~044(구현): `Challenge`(`prisma/schema.prisma:1350`) = 주제·기간·`level JlptLevel`·`dailyGoal`(얼린 하루 과제)·`activeKey`(사용자당 진행 중 1개). **`level` 은 만들 때 선택한 주제의 `level` 을 그대로 복사**(`challenges/service.ts:107`)하고 사용자가 정하지 않는다. 만들기 화면(`ChallengeCreateScreen.tsx`, `/plan/challenge/new`)의 단계는 「주제 → 기간 → 목표 → 확인」이고 「목표」 = 하루 과제(`dailyGoal`: 레슨 여부·단어 개수).
- 오늘의 회화(레슨): 활성 챌린지가 있으면 챌린지 `level` 로 추천(`lessons/today.ts:97`, `progress.ts:157`), 챌린지 없이 자유로 만들면 `profile.level`(`lessons/generate.ts:134`) — `goalLevel` 은 안 쓴다.
- 오늘의 단어: 세트 상한 `ceilingOf(profile.level, profile.goalLevel)` = **둘 중 높은 쪽**(`vocab/sessions.ts:442-451`, `setGenerator.ts:111`), 활성 챌린지 `level` 은 읽지 않는 것으로 보임. 단계 우선 가중은 [[task-053-improve-today-words-level-weight]](IMP-0028: 내 수준보다 어려운 단계가 풀 비중대로 쏠리지 않게).
- 프로필 `level`(현재 수준, 기본 N5)·`goalLevel`(목표 수준, null 가능)·`goalTopics`·`goalDeadline`(`schema.prisma` Profile).
- 교훈(`/이슈기록 관련`): 승인된 교훈 없음. 내부 교훈: ① 소스 스캔 시험은 동작 변이를 못 잡는다 — 수준 결정 규칙은 순수 함수 동작 시험으로 ② 공용 부품 변경은 전수 조사 ③ 하드링크 미러는 임시 파일에 쓰고 `mv` ④ 환경은 Leader 가 먼저 갖춘다.

## 열린 결정 Q1~Q5 — Leader ★ 권고 (사용자가 데모에서 승인/변경)
- **Q1 「챌린지를 설정할 때 목표」 = ★ (a) 챌린지 난이도(JLPT 단계)를 사용자가 직접 고른다.** 챌린지 만들기에 「난이도」 선택(N5~N1)을 넣고 **기본값 = 선택한 주제의 난이도**(고르지 않으면 지금과 같음). 저장은 **기존 `Challenge.level` 을 그대로 쓴다 → DB 칸 추가 없음**. 사용자가 말한 「목표」는 이 챌린지의 목표 수준(=생성 기준 난이도)으로 해석한다. 대안 (b) 기간 끝에 도달할 목표 수준을 `level` 과 별도로 둔다 → DB 칸 필요·의미가 겹쳐 비권장, (c) 지금의 하루 과제 설정을 가리킨 말이었다면 UI 변경 없이 생성 규칙만 바꿈.
- **Q2 적용 범위 = ★ 오늘의 회화 + 오늘의 단어 둘 다.** ~~챌린지 **주제 단어 세트**(`topicId` 세트)는 주제 자체의 단어이므로 수준 상한 변경 대상이 아님(착수 후 코드로 확인해 기록).~~ **[10-18 정정 — designer 이견 수용]** 코드 사실(`topicSet.ts:536`): 챌린지 중 오늘 탭의 단어 카드는 주제 세트이고 그 「새 단어」는 AI 가 **주제 수준**으로 만든다. 주제 세트를 제외하면 챌린지 난이도를 바꿔도 오늘 탭 단어 카드가 그대로라 요청이 화면에서 거의 안 보인다 → 데모 D4 ★ = 회화 + 챌린지 주제 「새 단어」(AI 생성 수준) + 내 단어장 세트(가중 기준). 주제 **기본 표현**(고정 문장)은 그대로. 사용자가 질문 2 로 최종 확정.
- **Q3 목표 수준이 없는(null) 프로필 = ★ 현재 수준(`level`)으로 되돌린다**(지금 동작 유지).
- **Q4 규칙 합치기 = ★ 기준 수준 `T` 를 한 곳(순수 함수)에서 정한다**: `T = 활성 챌린지가 있으면 challenge.level, 없으면 profile.goalLevel ?? profile.level`.
  - 오늘의 회화: 레슨 수준 = `T`.
  - 오늘의 단어: 활성 챌린지가 있으면 상한 = `challenge.level`(내 현재 수준보다 낮아도 챌린지 난이도를 따른다 — 사용자 요청), 챌린지가 없으면 지금처럼 `ceilingOf(level, goalLevel)` 유지. **단계 우선 가중(IMP-0028)은 `T` 주변을 기준으로 유지**해 어려운 단계가 쏠리지 않게 한다.
  - 대안: 챌린지가 없을 때도 상한을 `goalLevel` 로 고정(현재 수준보다 낮은 목표면 쉬운 단어만) — 목표가 현재보다 낮으면 어색해 비권장.
- **Q5(추가) 화면 단서**: 오늘의 단어/회화 화면에 「챌린지 N4 기준」「내 목표 N3 기준」 같은 한 줄 단서를 둘지 — 데모에서 designer 가 ★ 와 대안(안 둠)을 비교한다.

## Leader 사전 결정 (사용자가 바꾸라면 바꾼다)
- **L1 DB**: Q1 ★ 라면 **DB 변경 없음**. (b) 로 바뀌거나 필요가 생기면 멈추고 사용자 승인(백업→db push 절차)을 받는다 — 승인 전 스키마·DB 접촉 금지.
- **L2 기존 챌린지**: 이미 만든 챌린지의 `level` 은 바꾸지 않는다(만들 때 얼림 원칙). 생성 규칙만 새로 적용 — 기존 진행 중 챌린지는 주제 난이도 = 지금 `level` 이므로 결과가 달라지지 않는다.
- **L3 수준 규칙 한 곳**: `resolveTargetLevel(userId)` 같은 순수 규칙 함수 하나를 두고 오늘의 회화·오늘의 단어가 같이 쓴다(서버). 화면 쪽 선택은 만들기 요청 본문 `level`(선택, 기본 주제 난이도) 한 칸.
- **L4 API**: 챌린지 만들기 요청(번호는 `api-contract.md` 에서 확인)에 선택 필드 `level` 추가 — 허용값 JLPT 5단계, 잘못된 값 400, 미지정 = 주제 난이도(기존 동작). 응답·목록의 `level` 은 이미 있음.
- **L5 프롬프트**: 레슨 생성 프롬프트(A4)가 받는 입력은 이미 `level` 이라 **프롬프트 문구는 바꾸지 않는다** — 다른 수준 값을 넘길 뿐. prompt-engineer 는 필요 시(수준 값이 챌린지 `level` 로 낮아졌을 때 레슨 품질)만 부른다(judge `prompt-engineer?`).
- **L6 범위 밖**: 프로필 목표수준 설정 화면 변경(이미 있음), 챌린지 결과 집계 규칙, 주제 단어 세트, 평가(오늘의 평가) 수준 규칙.

## 구현 계획 (데모 승인 뒤)
1. **designer(opus)**: delta 데모 `docs/demo/task-076-challenge-level-v1.html` — 챌린지 만들기 단계에 난이도 선택(기본값 표시·고르지 않으면 주제 난이도 안내·내 수준과 비교 단서), 확인 단계/상세 화면의 난이도 표기, (Q5) 오늘의 단어/회화 단서 유무, 결정 Q1~Q5 의 ★ 와 대안, 상태(주제 난이도 기본·바꿈·너무 높음/낮음 안내)·세 폭·다크·글꼴 130%. 규칙 표(수준 기준 `T` 결정표)도 데모에 포함. 구현 가이드 `docs/screens.md` 새 절(승인 전 초안).
2. **사용자 데모 승인** → 게이트 `activate`.
3. **developer(opus) 서버**: `resolveTargetLevel` 순수 함수·오늘의 회화/단어 연결·챌린지 만들기 `level` 검증·`api-contract`/`challenge.md` 갱신·동작 시험(규칙 표 전수)·변이 점검. **developer(opus) 화면**: 만들기 화면 단계·문구·순수 로직 시험. 서버 먼저 → 화면.
4. **reviewer**(서버 → 화면) → **qa**(QA 서버 3011 `APP_ENV=LOCAL` `-H 127.0.0.1`, QA 계정, 실제 HTTP·Chrome) → 사용자 배포 승인.

## 완료 기준
1. 챌린지 만들기에서 난이도를 고를 수 있고 기본값은 주제 난이도다. 고른 값이 챌린지 `level` 로 저장된다.
2. 활성 챌린지가 있으면 오늘의 회화·오늘의 단어가 그 난이도를 기준으로 만들어진다. 챌린지가 없으면 프로필 목표수준(없으면 현재 수준)을 기준으로 한다.
3. 규칙은 한 함수에서 결정되고 표 전수 시험이 있다. 기존 챌린지·오늘의 단어 가중(IMP-0028)·평가는 회귀 없음.
4. tsc 0 · eslint 0 · 전체 시험 · build 0 · reviewer PASS · QA PASS · 사용자 폰 확인.

## 상태 로그
- 2026-10-18 `/개선작업` 접수(IMP-0051 `inbox`) → 사용자 「승인할테니 작업 진행해줘」 → judge intake 1차(light — Leader 거절) → 2차(standard·delta·opus·R1) → IMP-0051 `planned` → 이력서 작성(Q1~Q5 ★·L1~L6). 다음: 게이트 init → designer 데모 v1.
- 2026-10-18 17:10 designer 데모 v1 `docs/demo/task-076-challenge-level-v1.html`(lint PASSED, sha256 앞 16자 `61c6b95346e6c762`, 자체 시험 1,344칸 ★ 실패 0) · 결정 D1~D10(★ DB 변경 없음, D4 는 designer 이견 — 챌린지 주제 새 단어 포함) · 사용자 질문 4개 · screens.md §33 승인 전 초안 · 기록 [[task-076-designer-record]]. 다음: Leader 게시·사용자 승인.
- 2026-10-18 17:12 Leader 가 데모 파일 전체(798줄)를 읽고 비공개 Artifact 게시(https://claude.ai/artifact/MShNwwYwwwSxw5YSSBuMtV) → 게이트 `review_requested` v1 기록. 사용자 「승인할테니 작업 진행해줘」는 데모 승인이 아님을 재확인(승인 문장이 오기 전까지 구현 착수 금지). 구현 때 반영할 정정: ① Q2 범위(위) ② 레슨 추천 응답에 기준 출처 `levelSource`(`CHALLENGE|GOAL|LEVEL`) 추가 → api-contract 갱신 ③ #156 이 모르는 키를 400 으로 막으므로 **서버 먼저 배포** ④ `generate.ts:128` 이 `topic.level` 을 쓰므로 수업 재료 수준도 `T` 로 ⑤ 붙여넣은 글·상황 수업에 `T` 를 쓸지 사용자/Leader 결정 ⑥ L2 부분 오류 — 진행 중 챌린지(난이도=주제)도 목표가 더 어려운 사용자는 「내 단어장 세트」 가중이 바뀜(데모 결정표 4번 줄, 질문 4). 다음: 사용자 답(D1~D10·질문 1~4)과 승인 문장.
- 2026-10-18 사용자 수정 요청(승인 아님): 「난이도에 대해 표기해줄때 프로필에서와 같이 초보자 ~ 최상급 까지의 표기도 함께 표기해주도록 해줘」 → 게이트 `changes_requested`(v1, 인용 기록). 프로필 표기 정본 = `src/types/seedPack.ts` `SEED_PACK_LABEL`(N5 초보자 · N4 초급 · N3 중급 · N2 고급 · N1 최상급, 설정 화면은 위 이름·아래 코드 두 줄). designer 에게 **v2**(`task-076-challenge-level-v2.html`) 지시: 076 이 새로 만들거나 바꾸는 모든 난이도 표기에 이름 병기, 좁은 곳은 360px·글꼴 130% 실측, 결정 D11(표기 형식) 추가, 같은 흐름 안 기존 N 코드 단독 표기 목록 → 사용자 질문 5. 아직 D1~D10·질문 1~4 에 대한 사용자 답과 승인 문장은 없음 — v2 게시 후 다시 요청한다. 같은 메시지로 075 배포 여부 질문에는 답이 없어 075 도 미커밋 대기.
- 2026-10-18 designer **데모 v2** `docs/demo/task-076-challenge-level-v2.html`(126,550B, 1,033줄, sha256 앞 16자 `90a51f2f6b52488d`, lint PASSED, v1 파일 불변·§33 만 갱신 확인, 자체 시험 2,898칸 ★ 실패 0) — Leader 가 전체를 읽고 코드 인용 7곳(createParts:91·ChallengePlanCard:140·TodayLessonCard:251/457·topicCopy:35·challengeCopy:144·LearningSettings:88)과 `levelLabel`/`levelName`/`todayLevelLine`(labels.ts:99-100)을 직접 대조 → 비공개 Artifact https://claude.ai/artifact/GNoNjxpVfPQs9f1cc1rmi7 게시 → 게이트 `review_requested` v2. 새 결정 **D11**(★ A: 알약 5칸 = 설정처럼 위 이름·아래 코드 두 줄/칸 높이 48, 문장·줄·뱃지·칩 = 「중급 (N3)」 한 덩어리·뒤에 조사 없음, 챌린지 칩은 난이도를 주제 이름 앞에 `챌린지 · 중급 (N3) · 「카페 주문」`, 안내 줄은 값이 없어 그대로) · 새 **질문 5**(표기 범위: a ★ 챌린지 흐름 안만(① 주제 카드 뱃지·설명 포함) / b a+회화 「주제 고르기」 / c 앱 전체) · 새 발견 P10(D6 A 면 챌린지 중 준비 줄 「지금 수준(…) 단어가 가장 많이 나와요」가 틀린 말 → 챌린지 중에만 「챌린지 난이도(…)까지의 단어가 주로 나와요」). 한계: 360px·130% 에서 알약 이름 여유 +6.6px(첫 대책 칸 사이 8→6px) — 폰 확인 항목. 대안 D(알약 한 줄)·E(칩 끝)·C(이름만)는 실측으로 잘림. 아직 D1~D11·질문 1~5 에 대한 사용자 답/승인 문장 없음.
- 2026-10-18 18:19 **사용자 데모 승인** 「D1~D11 권고대로 승인, 질문 5는 a로」 → 게이트 `approve --version 2`(인용 기록)·`activate` → `DEMO_GATE_PASSED`(approved v2, hash verified). `docs/screens.md` §33 머리를 「승인 데모 v2」로 고침. **확정 결정(전부 ★)**: D1 a(난이도 N5~N1 직접 고르기, 저장 = 기존 `Challenge.level`, **DB 변경 없음**) · D2 B(③ 목표 단계 맨 위 native radio 5칸, 단계 4개) · D3 A(비교 줄) · D4 A(회화 + 챌린지 주제 「새 단어」 + 내 단어장 세트) · D5 A(목표 없음 → 내 수준) · **D6 A**(`T = 챌린지 ? challenge.level : (goalLevel ?? level)`, 내 단어장 세트 가중 기준 = 챌린지 중 `challenge.level`/아니면 지금 그대로 `ceilingOf(level, goalLevel)`, 질문 3 = 요청 그대로(상한 없음)) · D7 B · D8 A · D9 A · D10 A · D11 A(알약 두 줄·그 밖 「중급 (N3)」·칩은 난이도 먼저) · 질문 5 a(챌린지 흐름 안만). **주의(Leader 실수 정정)**: Leader 가 사용자에게 보낸 예시 문장에 「질문 4 B」(D6 B)가 들어 있었으나 ★ 는 A 였다 — 사용자는 「D1~D11 권고대로」라고만 답해 **글자 그대로 ★(D6 A)로 확정**했고, 이 불일치와 영향(진행 중 챌린지에서 목표가 더 어려운 분의 내 단어장 세트 가중 변화·준비 줄 문구 P10)을 사용자에게 알렸다. D6 B 로 바꾸라는 말이 오면 한 규칙·한 문구만 바뀌므로 구현은 그 한 곳을 한 함수로 격리한다.
- **Leader 추가 결정 L7(사용자가 바꾸라면 바꾼다)**: 오늘의 회화 수업 수준 T 적용 범위 = **주제 수업(추천·챌린지·「다른 주제」로 고른 주제)**만. **붙여넣은 글 수업(`kind:'text'`, 지금 profile.level)과 상황 수업(`kind:'scenario'`, 사용자가 상황에 정한 수준)은 지금 그대로** — 사용자가 말한 「오늘의 회화」가 주제 수업 흐름이고 상황 수준은 사용자가 직접 정한 값이므로 최소 변경. **L8**: 추천 응답 `LessonRecommendation.level` 의 의미는 바꾸지 않고(주제 난이도 — 「주제 고르기」 등 다른 소비처 보호) 새 필드(수업 난이도 `lessonLevel` + 출처 `levelSource: 'CHALLENGE'|'GOAL'|'LEVEL'`)를 더한다 — 이름은 developer 가 api-contract 와 맞춰 확정하고 UI 가 새 필드를 쓴다. **L9**: 구현 순서 = 서버(opus) → 서버 감사 → 화면(opus) → 화면 감사 → judge C2 → QA(Leader 가 QA 환경 먼저) → 사용자 배포 승인. #156 이 모르는 키를 400 으로 막으므로 서버를 먼저 배포한다(화면이 `level` 을 보내기 전).
- 2026-10-18 18:50 developer(opus) 서버 구현 완료(미커밋): 규칙 함수 `learning/targetLevel.ts`(task042 import 경계 시험 때문에 `challenges/` 가 아니라 learning 직하), #156 `level`, 주제 수업 재료 T, **A4 프롬프트 수준이 주제 행 수준을 쓰던 것(`lessonInput.ts`)을 `m.level` 로**(골든 바이트 불변), #58 새 칸 `lessonLevel`·`levelSource`, 주제 세트 새 단어 수준, `mineSetCeiling`(D6 A 한 곳). tsc 0·eslint 0·**전체 시험 4,356 중 실패 0**(건너뜀 5 — 3개는 저장소 경로로 재실행 통과, 2개는 미러에 `android/` 가 없어서)·build 0·변이 17개 중 16 포착(생존 M9 = 상황 수업에 T 적용, 코드 불변으로 보증). 기록 [[task-076-dev-server-record]]. **Leader 판정(알려진 한계 ①)**: 「진행 중」 판정은 기존 단일 정의 `isChallengeInProgress`(시작 전 포함)를 **유지** — 「내일 시작」 챌린지를 만든 당일(최대 하루)에 회화 수업 수준·뱃지가 챌린지 기준이 되는 것은 사용자가 방금 고른 난이도를 따르는 것이고, 두 번째 정의를 만들면 REV-152a 의 「판정 하나」 원칙을 깨기 때문. 사용자 폰 확인 항목으로 남김(기간 안만으로 좁히려면 `getInProgressChallengeLevel` 한 줄). 동시에 서버 감사(reviewer, REV-076S)·화면 A(챌린지 만들기·계획표 카드)·화면 B(오늘 탭 회화 카드·챌린지 칩·준비 줄) 병행 착수 — 미러 `thekaiwa-rev076s`·`-dev076-ui`·`-dev076-ui2`(node_modules 만 하드링크).
- 2026-10-18 19:20 reviewer 서버 감사 **REV-076S PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 5·Info 4) — 증빙 재실행 tsc 0·eslint 0·영향 시험 105/105·learning 계열 108파일 1,874건 fail 0, `prisma` diff 0, 직접 변이 17개 중 15 포착(생존 2 = 상황·붙여넣은 글 수업에 T 적용 — diff 에 없는 분기라 현재 결함 아님, **QA 라이브로 보증**). 한계 ①②(시작 전·단어만 챌린지)는 허용 가능한 차이로 판정(Leader 판정과 일치). `Challenge.level` 의미 변화의 파급: 서버에서 읽는 곳 3곳(view·store·targetLevel)뿐, 주제 난이도와 비교·필터링하는 곳 없음. 기록 [[task-076-reviewer-server-record]]. **Leader 처리**: L-1 `screens.md` §33-3 추천 응답 행을 구현에 맞게 정정(추천 `level` = 주제 난이도 불변, 새 `lessonLevel`·`levelSource`) · L-2 `api-contract.md` #156 색인 행에 `level?` 추가 · `domain-model.md` `Challenge.level` 설명 정정(둘 다 문서만, 스키마 불변). L-3(상황·붙여넣은 글 수업 T 비적용 단언 시험 없음)·L-4(챌린지 난이도가 주제와 2단계 이상 다를 때 A4·A12 생성 품질 오프라인 확인 불가)·L-5(JLPT 상수 중복)는 **QA 라이브 샘플로 확인**(L-4 는 prompt-engineer 점검 여부를 QA 결과를 보고 판단). **최종 요약에 반드시 쓸 것(I-4)**: 챌린지가 없는 사용자의 모든 주제 수업도 이제 수업 수준이 `goalLevel ?? level` 로 바뀐다(`Lesson.level`·페르소나 입력 포함, 결정표 5~8줄로 승인된 범위). 다음: 화면 A·B 완료 → 화면 감사 → judge C2 → QA.
- 2026-10-18 19:40 화면 A(챌린지 만들기·계획표 카드, [[task-076-dev-ui-create-record]])·화면 B(오늘 탭 뱃지·칩·준비 줄, [[task-076-dev-ui-today-record]]) 구현 완료. Leader 판정: A-1 요청에 `level` 항상 전송(확인 단계 값 = 저장 값, 서버·화면 같은 릴리스라 L9 간극 없음 — 부분 롤백 금지) · A-2 프로필 수준은 `page.tsx` props(새 요청 0) · A-3 「처음엔 주제 난이도로 골라 두었어요」는 다시 도전 경로에서 사실과 다름(Low L-1) — **승인 데모 문구라 바꾸지 않고** 사용자 보고·폰 확인 · A-4 계획표 부제 130% 줄바꿈은 QA 실측 · B-1 서버가 수업 난이도를 못 정하면 「초급 (N4)」 이름 포함 폴백(D11 일치) · B-2 P10 「챌린지 중」은 서버와 같은 정의(시작 전 포함·과제 꺼짐 무관).
- 2026-10-18 20:05 reviewer 화면 감사 **REV-076U PASS_WITH_NOTES**(Critical 0·High 0·**Medium 1**·Low 3·Info 6; 에이전트는 60턴에 잘렸지만 기록 파일은 완결) — **합쳐진 상태 첫 재실행**: tsc 0·eslint 에러 0(경고 5 = diff 밖)·전체 시험 **4,384 중 4,379 통과·실패 0·건너뜀 5**(건너뛴 4파일을 저장소 경로로 재실행 27/29 통과, 2개는 미러에 `android/` 없음)·build 0. 데모 차이: material 0·defect 0·implementation 3. **M-1(Medium)**: 만들기 화면 핵심 동작(고른 난이도 표시·알약 클릭·프로필 값 전달·① 설명)이 행동 시험 없이 소스 정규식·QA 에만 의존 — 독립 변이 18개 중 6 생존(M4 확인 단계·M5 알약 선택·M6 onChange·M8 page.tsx 수준/목표 뒤바뀜·M9 levelCtx 뒤바뀜·M16 ① 설명). 기록 [[task-076-reviewer-ui-record]]. **Leader 처리**: M-1 은 시험 한정 보강(developer sonnet, 제품 동작 불변 — 무동작 export/순수 함수 추출만 허용)으로 착수 → 끝나면 QA. L-2(계획표 부제 130% 줄바꿈·자리표시 높이 278.4 차이)는 QA 실측. L-3(`submit` 의존성)은 선택(미처리).
- 2026-10-18 20:10 **judge C2 `codex_required:false`**(`budget_rule: CX-limit-unknown-hold` — Codex 한도 미확인이라 보류, `wanted_before_budget: true`). 결과 `judge-076-c2.result.json`(scratchpad) — Codex 외부 검토 없이 진행. 위험 판단: R1 유지(DB·인증·네이티브 변경 없음)이나 수업 프롬프트 입력 수준·단어 가중이 바뀌므로 **QA 라이브 샘플(A4·A12 생성 품질, 상황·붙여넣은 글 수업 불변)을 Leader 가 직접 본다**.

- 2026-10-18 developer(서버) 구현 완료(미커밋): 규칙 `src/modules/learning/targetLevel.ts`(task042 import 경계 때문에 challenges/ 밖) · #156 `level` · 주제 수업 T · #58 `lessonLevel`/`levelSource` · 챌린지 주제 새 단어 · 내 단어장 천장(D6 A `mineSetCeiling` 한 곳) · **발견: A4 프롬프트 수준이 주제 행 수준이라 `lessonInput.ts` 도 고침** · tsc/eslint 0 · 전체 시험 fail 0 · build 0 · 변이 16/17 → [[task-076-dev-server-record]] (Leader 확인 권장: 시작 전 챌린지도 「진행 중」).
- 2026-10-18 reviewer 서버 감사 REV-076S **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 5·Info 4) — tsc/eslint 0·영향 시험 1,874 중 fail 0·DB 변경 0·직접 변이 17개 중 15개 포착(생존 2 = 상황/붙여넣은 글 수업 T 적용, 코드 불변 확인·QA 라이브로 보증), 한계 ①② 허용 판정, 화면 단계 주의 4개(특히 screens.md §33-3 마지막 행 stale) → [[task-076-reviewer-server-record]]
- 2026-10-18 18:52 developer 화면 B(오늘 탭) 구현 완료(미커밋): P6 회화 뱃지 두 곳(추천 `lessonLevel`·`levelSource` / 챌린지 카드 `ctx.level`+챌린지, 보이는 글 aria-hidden+낭독 문장) · P7 칩 난이도 앞 · P10 준비 줄(`mineSetChallengeLevel` = D6 전환 한 곳, 서버 「진행 중」 집합 그대로) · tsc/eslint 0 · 새 시험 11 · 전체 시험 fail 0 · build 0 · 변이 17/17 · **확인 필요: T 미확정 시 뱃지 폴백을 「N4」 대신 「초급 (N4)」(D11)로 그림** → [[task-076-dev-ui-today-record]]

- 2026-10-18 developer(화면 A — 만들기 ①·③·④ + 계획표 카드) 구현 완료(미러 `thekaiwa-dev076-ui`, 미커밋): 난이도 알약·비교 줄·안내 줄·확인 「난이도」 줄·① 뱃지/설명·계획표 부제, `page.tsx` 가 프로필 수준을 props 로 · #156 `level` 늘 보냄(결정) · tsc/eslint 0 · 전체 시험 fail 0 · build 0 · 변이 21/21 → [[task-076-dev-ui-create-record]] (designer/Leader 확인 필요 Low 1: 다시 도전 때 `levelBody` 「처음엔 주제 난이도」 문구).

- 2026-10-18 reviewer 화면 감사 **REV-076U PASS_WITH_NOTES**(Critical 0·High 0·Medium 1·Low 3·Info 6) — 두 화면 합친 상태 첫 재실행: tsc 0·eslint 에러 0(경고 5 diff 밖)·전체 시험 4,384 중 fail 0(건너뜀 5 → 4파일 따로 27/29 통과, brand 2는 android 필요·무관)·build 0·데모 게이트 `DEMO_GATE_PASSED` v2. 직접 변이 18개 중 12 포착·**6 생존**(확인 단계 `level` 변수·알약 `sel`·알약 onChange·`page.tsx` 내 수준↔목표·`levelCtx`·① 설명) = 화면 핵심 동작 행동 시험 구멍 M-1(권고: `GoalStep`/`ConfirmStep` export 후 정적 렌더 시험, 아니면 QA 실화면 확인 조건). 데모 차이 material 0·defect 0. native_change false → [[task-076-reviewer-ui-record]]

- 2026-10-18 developer **M-1 행동 시험 보강 완료**(미커밋, [[task-076-dev-ui-m1-record]]) — 새 `level076View.test.ts` 12개(GoalStep·ConfirmStep 정적 렌더·알약 onChange 호출·`profileLevelProps`·① 설명), 감사 생존 변이 6개(M4·M5·M6·M8·M9·M16) 전부 포착 + 기존 포착 12개 유지, 제품 코드는 무동작(`GoalStep`·`ConfirmStep` export · `profileLevelProps` 1개 · page.tsx 호출). tsc 0·eslint 0·전체 시험 4,396 중 fail 0·build 0. 한계: 본체 연결 2곳·page.tsx 는 소스 스캔 — 실화면은 QA.

- 2026-10-18 21:00 developer(sonnet) **M-1 시험 보강 완료**(제품 동작 불변 — `GoalStep`·`ConfirmStep` `export`, 순수 함수 `profileLevelProps`(page.tsx 가 spread)): 새 시험 12개, **생존 6개 변이 모두 포착**·기존 포착 12개 유지·추가 변이 4개 포착, tsc 0·eslint 0·전체 시험 **4,396 중 실패 0**(건너뜀 5)·build 0. 기록 [[task-076-dev-ui-m1-record]]. Leader 가 page.tsx diff 로 무동작 확인.
- 2026-10-18 21:40 **QA 4갈래 + 측정 1** (QA 서버 127.0.0.1:3011, APP_ENV=LOCAL, 최종 코드 빌드, 계정 QA1~QA4 + 원상 복구 확인): **QA-HTTP-1 PASS**(결함 0) — #156 `level` 거절 12종 400·모르는 키 400·저장값이 #157/#155/#158 전부 일치, #58 새 칸(GOAL/LEVEL/CHALLENGE), 내 단어장 세트 가중 통계(챌린지 N5 에서 N5 비중 20%→73%, N3 42%→9%, 이론값 ±3%p) [[task-076-qa-http1-record]] · **QA-HTTP-2**: 레슨 수준 6건 PASS(챌린지 없음 N3·N5 / 챌린지 N2·N5 / 붙여넣은 글 N5 불변 / 상황 수업 불변 — 시드 상황은 상황 수준=대표 주제 수준이라 구분 못 함) [[task-076-qa-http2-record]] · **QA-Chrome-1 PASS**(만들기 ①~④·계획표 카드, 12조합 잘림 0·넘침 0, POST 본문 `level`=고른 값, 오프라인 실패→복귀 성공) [[task-076-qa-chrome1-record]] · **QA-Chrome-2 PASS**(오늘 탭 뱃지·칩·준비 줄, 전 폭×글꼴 한 줄·잘림 0, 요약 호출 실패 폴백) [[task-076-qa-chrome2-record]]. Leader 가 스크린샷 3장 직접 확인(③ 360px·130%, 오늘 탭 챌린지 펼침, 계획표 카드).
- 2026-10-18 21:50 **A12 통과율 측정**(QA 서버 재기동으로 일일 한도 리셋, 내 주제 N4 3개 12조각으로 QA1 변형 vs QA3 대조) [[task-076-qa-a12-record]]: **한 단계 차이 N3·N5 = 10/10 통과(대조 N4 와 같음), 두 단계 차이 N2 = 0/10 전부 폴백**(앞선 QA 와 합쳐 N2: 0·2·0 — 우연으로 보기 어려움). 원인 후보: AI 가 단 jlpt 가 챌린지 수준 ±1 창(`topicWordsLevelWindow`)에 들어야 통과 — N4 단어는 N3·N5 창엔 들어가고 N2 창(N3~N1)엔 못 들어감(탈락 사유가 응답에 없어 미확인). **한 단계 차이도 실제 단어 난이도 이동은 작아 보임**(QA 추정·확신 낮음: N3 변형 약간 어려움, N5 변형 눈에 띄게 쉬워지지 않음). 폴백은 계약대로 동작(주제 표현으로 채움, 하루 8장 규칙 유지). 부수 관찰(이번 변경 무관): 어색한 한국어 뜻·예문 빈 카드 1·외래어 읽기 히라가나/가타카나 혼재. → **한계로 사용자에게 보고, A12 프롬프트 개선(prompt-engineer)은 후속 또는 배포 전 선택지로 제시**.
- 2026-10-18 21:55 QA 정리: QA 서버(PID cwd 확인 후 종료)·미러 `.env`·쿠키 4개 삭제, 3011 리스너 0. 미러 `thekaiwa-qa076`·`dev076*`·`rev076*` 는 사용자 지시 시 삭제. **다음: 사용자 배포 승인 + 결정 2건(수업 과제 끈 챌린지의 회화 난이도·A12 고난이도 처리) → 커밋(076 파일만, 명시 경로) → 푸시 전 게이트 → push → 웹훅 확인 → 운영 스모크(QA2 임시 쿠키).**

## 최종 요약 (사용자용 — 배포 승인 대기)
- **바뀐 것**: ① 챌린지를 만들 때 **난이도(초보자 N5 ~ 최상급 N1)를 직접 고릅니다**(③ 「목표를 정해요」 단계 맨 위, 처음엔 주제 난이도가 골라져 있어 손대지 않으면 지금과 같음). 내 수준·내 목표·이 주제 난이도를 한 줄로 비교해 보여 주고, 내 수준보다 2단계 이상 높거나 낮으면 부드러운 안내만 합니다(막지 않음). ② **오늘의 회화 주제 수업의 난이도**와 **오늘의 단어** 기준이 「진행 중 챌린지가 있으면 챌린지 난이도, 없으면 프로필 목표 수준, 목표가 없으면 내 수준」으로 정해집니다. ③ 난이도를 보이는 곳(만들기·확인·계획표 카드·오늘 탭 회화 뱃지·챌린지 칩·준비 줄)에 프로필과 같은 「초급 (N4)」 이름을 함께 씁니다. DB 변경은 없습니다.
- **알아 두실 동작(확인 요청)**: (a) **챌린지가 없는 분의 오늘의 회화 주제 수업도 이제 목표 수준(없으면 내 수준)으로 만들어집니다**(추천 주제 목록은 지금처럼 내 수준 ±1에서 고르고 수업 난이도만 바뀜) — 목표가 내 수준보다 훨씬 높으면 수업이 눈에 띄게 어려워질 수 있습니다. (b) **수업 과제를 끈(단어만) 챌린지에서도** 회화 수업 난이도는 챌린지 난이도를 따릅니다. (c) 「내일 시작」 챌린지를 만든 당일에도 챌린지 난이도를 따릅니다(최대 하루). (d) 챌린지 중 「내 단어장 세트」는 챌린지 난이도 기준으로 뽑혀, 목표가 챌린지보다 어려운 분은 그 단계 단어가 덜 나옵니다(승인한 D6 A). 붙여넣은 글 수업·상황 수업은 지금 그대로입니다.
- **한계(불편한 사실)**: 챌린지 주제의 AI 「새 단어」는 **주제 난이도에서 한 단계 차이(N3·N5)까지만 정상(10/10)이고, 두 단계 이상(예: N4 주제에 N2)은 AI 새 단어가 0~2장이라 대부분 주제 표현으로 채워집니다**(하루 8장 규칙은 유지). 한 단계 차이도 단어 난이도가 크게 달라 보이지는 않았습니다(QA 추정). 프롬프트 개선이 필요하며 후속 작업을 권합니다. 그 밖에 기존 이슈로 어색한 한국어 뜻·예문 빈 카드가 가끔 보입니다.
- **검증**: 서버·화면 독립 감사 PASS_WITH_NOTES(막는 결함 0), 시험 보강 후 전체 시험 4,396 중 실패 0·build 0, QA 실서버 4갈래 PASS(결함 0), 스크린샷 직접 확인. Codex 외부 검토는 한도 미확인으로 보류(judge).
- **폰에서 확인해 주세요(8)**: ① 만들기 ③ 알약 5칸이 두 줄(이름·코드)로 보이고 360px·글꼴 크게에서 이름이 안 잘리는지 ② 알약을 눌러 선택·←/→ 이동·안내 줄 ③ 비교 줄의 내 수준·목표가 설정과 같은지 ④ 만들면 확인 단계·계획표 카드 「난이도 …」가 고른 값인지 ⑤ 다시 도전에서 ③ 문구 「처음엔 주제 난이도로…」가 어긋나 보이는지(Low, 승인 문구라 안 바꿈) ⑥ 오늘 탭 회화 뱃지 「중급 (N3) · 내 목표/챌린지」·챌린지 칩·준비 줄 ⑦ 글꼴 크게(130%)에서 계획표 부제 두 줄·카드 높이 ⑧ TalkBack 낭독(알약 한 칸이 한 번만).
- **롤백**: 직전 릴리스 `20261018-185956-3becac89`(075) 로 `scripts/deploy.sh TheKaiwa --rollback` — DB 변경이 없어 안전하며 서버·화면이 같은 릴리스라 부분 롤백은 하지 않습니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-18 16:54 |
| v1 | 검토요청 | docs/demo/task-076-challenge-level-v1.html | https://claude.ai/artifact/MShNwwYwwwSxw5YSSBuMtV | 사용자 검토 요청 | 10-18 17:12 |
| v1 | 수정요청 | docs/demo/task-076-challenge-level-v1.html | https://claude.ai/artifact/MShNwwYwwwSxw5YSSBuMtV | "난이도에 대해 표기해줄때 프로필에서와 같이 초보자 ~ 최상급 까지의 표기도 함께 표기해주도록 해줘" | 10-18 17:46 |
| v2 | 검토요청 | docs/demo/task-076-challenge-level-v2.html | https://claude.ai/artifact/GNoNjxpVfPQs9f1cc1rmi7 | 사용자 검토 요청 | 10-18 18:10 |
| v2 | 승인 | docs/demo/task-076-challenge-level-v2.html | https://claude.ai/artifact/GNoNjxpVfPQs9f1cc1rmi7 | "D1~D11 권고대로 승인, 질문 5는 a로" | 10-18 18:19 |
