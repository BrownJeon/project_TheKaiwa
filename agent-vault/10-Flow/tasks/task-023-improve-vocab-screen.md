---
task_id: task-023
title: "개선 — 단어장 화면: 조각 필터·조각 뱃지·단어 상세 음성 재생 (IMP-0001·0002·0003)"
status: doing
base_ref: 055dbcf
risk_level: R1
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-008-vocab-today-words, task-003d-tts-p0, task-010-today-lesson]
tags:
  - type/task
  - domain/improvement
  - domain/vocab
aliases:
  - 단어장 조각 필터
  - task-023
created: 2026-09-30
updated: 2026-09-30
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-023-improve-vocab-screen-v1.html"
  artifact_url: "https://claude.ai/artifact/LhB2Mvj6R4xXBgmfGNWbdZ"
  content_sha256: "361cb080c0bc4687598a593ae144e4116e0437e35844eb32f7503778b81d5a46"
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
단어장(옛 서랍장 → [[task-020-improve-tab-label]]) 화면의 세 가지 개선을 한 묶음으로 처리한다.
- [[IMP-0001-단어상세-음성재생]] — 단어 상세 시트에서 소리 듣기.
- [[IMP-0002-단어장-필터-조각속성]] — 단어 목록을 조각(NAME/ACTION/FEELING/MODIFIER)으로 거르기.
- [[IMP-0003-단어목록-조각속성표기]] — 목록 행의 출처 뱃지를 조각 뱃지로 교체.

## 사용자 결정 (2026-09-30)
- **Q1** "조각 필터와 카테고리 칩을 병행해줘" → 카테고리 칩은 그대로 두고 조각 필터를 **추가**한다(둘은 AND 로 겹쳐 적용).
- **Q2** "출처뱃지를 모두 조각 뱃지로 교체해줘" → 행의 출처 뱃지(SEED '기본 단어' 등)는 **전부 없애고** 조각 뱃지로 바꾼다. 조각이 없는 단어(시드 2건 포함)의 표기는 designer 가 정한다(뱃지 생략 또는 '미분류').

## 포함 항목
- [[IMP-0001-단어상세-음성재생]] (P2) · [[IMP-0002-단어장-필터-조각속성]] (P2) · [[IMP-0003-단어목록-조각속성표기]] (P2)

## 범위
1. **조각 필터** — `listWords` where 절에 `chunkType`(단일 또는 다중 선택은 designer 결정)·'조각 없음' 조건 추가. `GET /api/v1/words` 쿼리 파라미터 + 입력 검증(허용값 4종 + none), 정본 api-contract #40·`docs/screens.md` §4 갱신. 카테고리 칩과 함께 조합될 때 결과 수·빈 상태 문구.
2. **조각 뱃지** — `WordRow.tsx`(L10 SEED 뱃지)에서 출처 뱃지 제거, `labels.ts` 의 `CHUNK_LABEL` 을 뱃지 색·문구와 함께 사용. 출처 정보가 화면에서 사라져도 **상세 시트에는 남길지**는 designer 가 정한다(사용자 결정은 "목록 뱃지 교체").
3. **소리 듣기** — `WordDetailSheet.tsx` 에 예약된 소리 슬롯(E9)에 단어 재생. 기존 `POST /api/v1/speech/tts`·`useVoicePreview`·`ttsAudio.ts` 재사용, 새 API 를 만들지 않는다. **예문 재생**을 함께 넣을지는 데모에서 제안한다. 재생 중 상태·실패 표시(TTS 엔진 다운 시 조용한 실패 금지, 엔진명 비노출).
4. **문서** — api-contract #40, `docs/screens.md` §4.

## 비범위
- 조각 값 편집·일괄 분류, 단어 추가 시트 변경, 정렬 기준 변경.

## 데모 게이트
- 화면 구조 변경이므로 judge intake 로 데모 수준을 판정한다(예상: **delta** — 기존 단어장 화면에 필터 줄·뱃지·재생 버튼만 추가). full/delta 면 designer 가 `docs/demo/task-023-improve-vocab-screen-v1.html` 을 만들고 사용자 승인 뒤에만 화면 코드를 쓴다. 서버(listWords·API)와 문서 작업은 데모와 무관하게 선행 가능.

## 완료 기준
- 조각 필터 4종+없음이 카테고리 칩과 동시에 동작하고 결과 수가 서버 집계와 일치, 목록에 출처 뱃지 0개·조각 뱃지 표시, 상세 시트에서 단어 재생 성공/실패 표시. 360/390/412 폭 검증.
- `tsc`·`eslint`·단위 테스트·QA 스모크(신규 쿼리 파라미터 잘못된 값 400) 0 fail.

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 feature · 복잡도 1.77 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: designer, prompt-engineer?, developer, reviewer, qa
- 데모: **delta** (required=true, rule=JV-ui_change) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: 없음

## Designer 기록

- [22:31] delta 데모 v1 작성 → `docs/demo/task-023-improve-vocab-screen-v1.html` (`check.mjs lint` → `DEMO_LINT_PASSED`, meta `task-023-v1`, 토큰 `src/app/globals.css@sha256:22f382529f92`). 헤드리스 확인: 24개 상태 × 360/390/412 에서 JS 오류 0 · 가로 넘침 0 · 폰 화면 안 엔진·모델명 0. 검토 요청·Artifact 게시·승인 기록은 Leader 몫이라 하지 않았다. `src/**`·`docs/screens.md`·frontmatter `demo_gate` 도 건드리지 않았다.
  - 담은 것: 목록·상세 **현재 vs 제안**, 상태 24개(주소 `#<id>`로 바로 열림: `list-compare`·`list-and`·`list-empty`·`detail-fail`·`detail-textonly` 등), 폭 360/390/412/세 폭 전환, 높이 780/892, 라이트·다크, 시연 조작(재생 실패·시간 초과·소리 막힘·자막만·1분 한도·인터넷 끊김).
  - 핵심 결정(designer, 결정 필요 A/B 와 별개)
    1. **조각 줄 배치**: 분류 칩 바로 아래 한 줄, 왼쪽 고정 라벨 "조각" + 가로 스크롤 칩(전체·이름·액션·느낌·꾸밈[·없음]). 분류 칩과 같은 모양·같은 선택색이라 새 색 없음. 목록과 함께 스크롤(스크롤 1곳 유지). 실측(390×780): 목록 위 조작 영역 186 → **230px(+44)**, 첫 화면에 다 보이는 행 6 → **5개**.
    2. **칩 숫자 없음** — 분류와 겹친 개수는 새 집계가 필요해서. 결과 수는 목록 머리 한 줄에 조건과 함께("단어 9개 · N5 기초 · 느낌 조각", 숫자 = #40 `total`).
    3. 보관함을 켜면 분류는 지금처럼 전체로, **조각 선택은 유지**.
    4. AND 결과 0 빈 상태: "‘일상’에 액션 조각 단어가 없어요" + [조각 전체 보기] [분류 전체 보기]. 검색어가 있을 때는 [‘q’ 추가하기] 대신 [조각 전체에서 찾기].
    5. 행 뱃지 = 조각 뱃지(`CHUNK_LABEL`, 기존 `Badge neutral` 톤 그대로). 초록·빨강은 맞힘·틀림 뜻이라 조각 구분에 쓰지 않음.
    6. 소리 버튼 = task-010 v2 승인본 예문 듣기와 같은 44px 원형(대기 ▶ → 불러오는 중 → 재생 중 ■, 다시 누르면 멈춤·취소). 소리는 한 번에 하나, 시트 닫기·수정 진입 시 정지. 실패는 누른 버튼 바로 아래 한 줄(실패·시간 초과·오프라인 = `bad-soft` + [다시 듣기], 자막만 = 안내 + [다시 확인], 1분 한도·소리 막힘 = 안내). 문구에 엔진·서버 이름 없음. 빠르기는 사용자 설정(`speechProfile` 생략), `text` = 표현(발음 사전 적용).
  - **결정 필요 A/B** (데모 하단 패널, 권고 = designer)
    - (a) 조각 없는 단어 행 표기 — **A 뱃지 생략(권고)** / B "조각 없음" 테두리 뱃지. 요청의 '미분류'는 이 앱에서 "분류"가 카테고리 이름이라 문구를 바꿈. 직접 넣은 단어는 조각이 늘 비고 지금 고칠 수 없어 B 면 최근 추가 맨 위가 같은 뱃지로 채워짐.
    - (b) 조각 필터 선택 — **A 하나만(권고)** / B 여러 개(쉼표 목록, 조각끼리 OR·분류와 AND).
    - (c) 조각 줄 "없음" 칩 — **A 보임(권고)** / B 숨김. 서버 `chunkType=none` 은 어느 쪽이든 만든다.
    - (d) 예문 재생 — A 단어만 / **B 단어+예문(권고)**. #23 한도(100자) 넘는 예문은 버튼 숨김(기본 단어 예문 최대 14자). IMP-0011 과 같은 버튼 공유.
    - (e) 상세 시트 출처 절 — **A 남김(권고)** / B 제거. A 면 교정 단어의 [점검 결과 보기] 길 유지.
  - Leader 참고: 서버는 #40 `chunkType`(단일 값 또는 목록 — (b) 결과에 따름, `none` 포함, 그 밖 400)만 추가. 목록 응답에 `chunkType` 은 이미 있음(`WORD_SELECT`). 소리는 #23 그대로, 새 API 없음.

## Developer 기록

## 작업 기록

### 2026-09-30 Leader — 착수
- Q1·Q2 반영. 시드 단어 50건 중 조각 미설정 2건의 표기 규칙을 데모에서 확정한다.

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-023-improve-vocab-screen-v1.html | https://claude.ai/artifact/LhB2Mvj6R4xXBgmfGNWbdZ | 사용자 검토 요청 | 09-30 22:33 |
