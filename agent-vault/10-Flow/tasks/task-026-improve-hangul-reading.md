---
task_id: task-026
title: "개선 — 일본어 한글 발음 표기(모든 일본어 부분·숨김 토글) (IMP-0009·0015)"
status: doing
base_ref: 055dbcf
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-010-today-lesson, task-008-vocab-today-words, task-007-talk-voice-web, task-006-chat-correction]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - 한글 발음 표기
  - task-026
created: 2026-09-30
updated: 2026-09-30
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-026-improve-hangul-reading-v1.html"
  artifact_url: "https://claude.ai/artifact/VudBLetAaJmbSpJHWzwpPh"
  content_sha256: "1d7a37f6e6abb63fd2f0b650145358024a8420670e474f6e417729422c1a9f2e"
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

## 목표 (Leader)
[[IMP-0009-일본어-한글발음-표기]]·[[IMP-0015-오늘의회화-한글표기-토글]] — 일본어 문장·단어 아래에 한글 발음을 표시하고, 필요 없는 사용자는 토글로 숨길 수 있게 한다.

## 사용자 결정 (2026-09-30, Q7)
> "한글 발음은 모든 일본어 부분에 추가해주고 토글로 감추는걸 만들어줘"

## 포함 항목
- [[IMP-0009-일본어-한글발음-표기]] (P3, L) · [[IMP-0015-오늘의회화-한글표기-토글]] (P3, M — 0009 의 오늘의 회화 부분)

## 핵심 설계 제약 (Leader)
- **LLM 에게 한글 발음을 내게 하지 않는다.** 응답 계약이 일본어 필드의 한글 혼입을 막고(`checks.ts` `hasHangul`), 발음은 **앱 쪽 규칙 기반 표시 전용**이어야 한다. 새 공용 변환기(가나 → 한글)를 한 곳에 두고 모든 화면이 그것을 쓴다(화면별 변환 로직 금지).
- 한자 포함 텍스트는 **읽기(히라가나) 필드가 있을 때만** 변환 가능하다. 읽기가 없는 문장의 처리(① 읽기 필드가 있는 경로만 표시 ② `tts.g2p`/pyopenjtalk 로 읽기 확보)는 **developer 조사 후 designer 와 정한다**(추정으로 틀린 발음을 보이지 않는다 — 없으면 표시하지 않음이 기본).
- 표기 규칙(사용자 예: か → '까')은 **어떤 표기 관례를 쓸지 데모 샘플로 사용자에게 확인**한다. 후보: 일반 학습서식(국립국어원 외래어 표기법에 가까운 か=카) 대 회화 발음식(か=까). 사용자 예시가 '까'였으므로 데모는 **'까' 계열을 기본 가정**으로 하되 샘플로 비교 제시하고 승인 시 확정한다.

## 범위
1. **변환기** — 가나(히라가나·가타카나) → 한글 규칙 변환, 장음(ー·おう)·촉음(っ)·발음(ん) 처리 규칙 표, 단위 테스트(50음+탁음·반탁음·요음·촉음·장음 전수 표).
2. **적용 화면** — 회화(talk)·채팅(chat)·단어장(vocab)·오늘의 회화(lesson 5단계)·교정 카드 등 **일본어가 나오는 모든 곳**. 화면별 적용 위치는 designer 가 정한다(후리가나 토글과의 관계 포함 — 후리가나 위/한글 아래 등).
3. **토글** — 사용자 설정(`preferences`)에 저장, 기본 ON(사용자 "모든 일본어 부분에 추가"). 위치(설정 화면 vs 화면 내 빠른 토글)는 데모에서 정한다.
4. **문서** — `docs/screens.md` §1~3·§12, `CLAUDE.md` 모바일 UI 원칙 후리가나 항목과 정합.

## 비범위
- LLM 프롬프트·스키마 변경, 한글 → 일본어 방향 표기, TTS 발음 변경.

## 데모 게이트
- 거의 모든 화면에 영향 → judge intake 로 판정(예상: **full**). designer 가 버전별 HTML 데모(`docs/demo/task-026-improve-hangul-reading-v1.html`)를 만들고 표기 관례 샘플 포함, 사용자 승인 후 구현. 변환기·설정 저장 서버 작업은 데모와 병행 가능하나 화면 코드는 승인 뒤.

## 완료 기준
- 변환 규칙 표 단위 테스트 통과, 지정한 모든 화면에서 토글 ON/OFF 반영, 읽기 없는 한자 텍스트에 틀린 발음을 표시하지 않음, 360/390/412 폭에서 줄 겹침·잘림 없음.
- `tsc`·`eslint`·QA 스모크 0 fail.

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 feature · 복잡도 2.1 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: designer, prompt-engineer?, developer, reviewer, qa
- 데모: **delta** (required=true, rule=DM-low-confidence) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: 없음
- 비고: 데모 수준 판정 규칙이 `DM-low-confidence`(신뢰도 낮음 → delta). 실제 화면 영향 범위가 넓어 designer 가 데모 v1 범위를 정할 때 사용자에게 전체 데모(full) 필요 여부를 확인한다.

## Designer 기록

- [22:41] **delta 데모 v1 작성** — `docs/demo/task-026-improve-hangul-reading-v1.html`(`task-026-v1`, 토큰 `src/app/globals.css@sha256:22f382529f92`, 새 색 없음). `check.mjs lint` → `DEMO_LINT_PASSED`. src/** 수정 없음. Artifact 게시·검토 요청은 Leader.
  - 담은 것: 화면 12종 × 대표 상태(회화방 말풍선·교정 카드 / 채팅방 / 채팅방 발음 준비 중(D2-B) / 표현 점검 교정 카드·단어 제안 / 단어장 목록 / 단어 상세 시트 / 오늘의 단어 카드 / 오늘의 회화 ①~⑤(③은 한자 보기·가나 보기 2종) / 설정 › 일본어 표시). 폭 360·390·412·세 폭, 보기 제안·현재·현재 vs 제안, 한글 켬/끔(사용자 설정), 라이트/다크. 결정 A/B 를 고르면 화면이 바로 바뀐다(주소 `#talk` 등으로 상태 직접 열기).
  - 한글은 데모 안 규칙 변환기가 만든 값(표시용 참고 구현 — 가나 → 한글, 장음 `-`·촉음 받침 동화·ん 받침 동화·조사 は·を·へ 소리대로·요음). 세 폭 × 결정 3조합 × 14상태에서 가로 넘침·한글 줄 잘림 0(브라우저 스크립트 확인), 데모 페이지 자체 390 폭 가로 스크롤 0.
  - 핵심 배치 결정(A/B 아님): 순서 **일본어 → 읽기(히라가나) → [한글] → 번역**, 한글 13px ink2(목록·보기 12.5 · 칩 12 · 단어 상세 14 · 단어 카드 15), **대괄호 [ ]** 로 번역 줄과 구분, sr-only "한글 발음:" 머리, 한글 줄 keep-all 금지(`overflow-wrap:anywhere`), 일본어 본문 17px 유지. 제외 자리: 입력칸·메모 칩·인식 중 자막·제목/머리줄·한국어 문장 속 일본어 인용·관리자 콘솔. 오늘의 단어 카드는 카드 [읽기]를 켰을 때만(외우기 힌트라서). 느리게 듣기 글자 가림 중에는 한글도 가림. 단어장 행은 한글 켬이면 64 → 약 82px.
  - **결정 필요 A/B(데모 하단 패널)**: D1 표기 관례 A ‘까’ 계열(구절 첫 글자만 거센소리, 기본 가정) / B ‘카’ 계열 — 샘플 8개(ありがとう·かわいい·とうきょう·がっこう·ちょっと·しんぶん·いただきます·これはいくらですか) 나란히, 사용자 예시 “코레와 이쿠라데스까”는 두 안 사이(A와 く 한 글자, B와 か 한 글자 차이)임을 명시 · D2 읽기 없는 한자 문장 A 표시하지 않음(기본 가정) / B 서버가 읽는 소리를 구해 표시(**디자이너 권장** — 교정문·내 말이 빠지지 않고, 조사 は·띄어쓰기가 소리대로, 선생님 음성과 같은 읽기. 대신 API·서버 작업 → Leader 사양 필요) · D3 토글 위치 A 설정에만 / B 설정 + 화면 안 빠른 토글(기본 가정·권장, IMP-0015) · D4 읽기와의 관계 A 따로(기본 가정·권장) / B 묶음 · D5 데모 범위 A 이 delta 로 결정(권장) / B full v2.
  - **Leader 확인 필요(발견)**: 서버 읽기(`reading`)는 조사 は를 글자 그대로 싣는다(예 `わたしのなまえはぶらうんです`·`こんにちは`) → 앱 규칙만(D2-A)으로는 は→와 판정이 불완전해 "애매하면 숨김"이 필요하고, 읽기에 띄어쓰기가 없어 한글도 붙여 써진다. 테스트 픽스처에 한자가 섞인 reading(`私は元気です`)도 있어 변환기는 가나 외 문자가 있으면 표시하지 않아야 한다. D2-B 를 고르면 우분투 쪽에 이미 있는 가나 읽기 분석(분석 워커)을 쓰는 방향을 developer 조사 대상으로 제안.
  - **full 데모 필요 여부 의견**: 판정 delta(`DM-low-confidence`)이고 영향 화면은 넓지만, 바뀌는 방식이 "일본어 아래 한 줄 + 전역 토글" 하나라 화면 종류별 대표 상태로 시각 판단이 충분하다고 본다(로딩·빈·오류 상태에는 일본어 본문이 없어 변화 없음). 좁은 칸 위험 지점(교정 카드 두 칸·문제 보기·표현 칩·단어장 행)은 v1 에 모두 넣었다. 그래서 **delta 로 충분(D5-A 권장)** — 다만 사용자가 모든 상태를 보고 싶으면 D5-B 로 full v2 를 만든다. 이 판단도 사용자 선택지로 패널에 넣었다.

## Developer 기록

## 작업 기록

### 2026-09-30 Leader — 착수
- 표기 관례(까/카)와 읽기 없는 한자 처리는 데모 단계에서 사용자에게 확인할 결정 항목으로 남긴다.

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-026-improve-hangul-reading-v1.html | https://claude.ai/artifact/VudBLetAaJmbSpJHWzwpPh | 사용자 검토 요청 | 09-30 22:42 |
