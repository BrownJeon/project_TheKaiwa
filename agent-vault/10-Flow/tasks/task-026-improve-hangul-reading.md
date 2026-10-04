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
updated: 2026-10-04
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 3
  repo_path: "docs/demo/task-026-improve-hangul-reading-v3.html"
  artifact_url: "https://claude.ai/artifact/5h7KYVQKdQh8WkfVHSmpWY"
  content_sha256: "19b8ee5e554d40f04ad925dade0201f2604710815f58b223390badef72ded638"
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

## 사용자 결정 (2026-10-03 18:05) — 범위 확장·데모 v2
- [[IMP-0018-회화방-읽기번역-일괄제어|IMP-0018]](회화방 AI 프로필 아래 읽기·번역 일괄 제어 + 내 발화도 읽기·번역)·[[IMP-0019-한자-후리가나-루비|IMP-0019]](한자 위 후리가나) 를 **026 에 합치고 데모 v2** 로 다시 승인받는다(AskUserQuestion, 권고안). v1 배치(일본어 → 읽기 줄 → [한글] → 번역)는 v2 에서 루비 기준으로 재설계. 내 발화 번역은 서버 작업 추가(5초 예산 밖 비동기). 착수는 사용자 손 4건(F6 나머지·참고 화면·카드 캡처·nginx sudo) 완료 후(사용자 지시).

## 사용자 결정 (2026-10-04 10:45) — 데모 v2 승인
- 데모 v2 게시 https://claude.ai/artifact/5h7KYVQKdQh8WkfVHSmpWY → AskUserQuestion 3문항:
  1. E1~E6 → **"권고안대로 승인 (Recommended)"** = E1-A 후리가나가 히라가나 줄 대신 · E2-A 후리가나+한글 기본 켬 · E3-A 회화방 머리 아래 표시 바 · E4-B 일괄 + 말풍선별 [번역 ▾] · E5-A 내 말 번역도 번역 스위치 · E6-A 내 말 번역 보낼 때마다 비동기 생성(AI 호출 증가 수용).
  2. 스위치 범위 → **"앱 전체 하나 (Recommended)"** — 후리가나·한글·번역 3개 모두 사용자 설정(preferences) 하나, 오늘의 회화 기존 번역 토글도 이 값으로 통합(Designer 확인 3·4 해소).
  3. 표기 관례 → **"'까' 계열 유지 (Recommended)"**(D1-A 확정).
- Leader 가 사양으로 정할 것(Designer 확인 1·2): 형태소별 표기·읽기(루비용 히라가나 + 한글용 발음) 서버 분석 출처·응답 필드·저장, 내 말 번역 비동기 생성·상태 전달·재시도 API. → 다음: developer 조사(읽기 출처) + designer 구현 가이드(`docs/screens.md` §1-3 루비 반영).

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
- [2026-10-04 14:11] codex_gate/C2 engine=jev → codex_required=true · mode=adversarial-review · focus=security · budget_rule=CX-limit-unknown-r2 | overrides=CX-r2-post-review | fallback=- | tokens=1063
- [2026-10-04 15:14] codex_gate/C2 engine=jev → codex_required=true · mode=adversarial-review · focus=concurrency · budget_rule=CX-limit-unknown-r2 · codex_switch=on | overrides=CX-r2-post-review | fallback=- | tokens=998

## Designer 기록

- [22:41] **delta 데모 v1 작성** — `docs/demo/task-026-improve-hangul-reading-v1.html`(`task-026-v1`, 토큰 `src/app/globals.css@sha256:22f382529f92`, 새 색 없음). `check.mjs lint` → `DEMO_LINT_PASSED`. src/** 수정 없음. Artifact 게시·검토 요청은 Leader.
  - 담은 것: 화면 12종 × 대표 상태(회화방 말풍선·교정 카드 / 채팅방 / 채팅방 발음 준비 중(D2-B) / 표현 점검 교정 카드·단어 제안 / 단어장 목록 / 단어 상세 시트 / 오늘의 단어 카드 / 오늘의 회화 ①~⑤(③은 한자 보기·가나 보기 2종) / 설정 › 일본어 표시). 폭 360·390·412·세 폭, 보기 제안·현재·현재 vs 제안, 한글 켬/끔(사용자 설정), 라이트/다크. 결정 A/B 를 고르면 화면이 바로 바뀐다(주소 `#talk` 등으로 상태 직접 열기).
  - 한글은 데모 안 규칙 변환기가 만든 값(표시용 참고 구현 — 가나 → 한글, 장음 `-`·촉음 받침 동화·ん 받침 동화·조사 は·を·へ 소리대로·요음). 세 폭 × 결정 3조합 × 14상태에서 가로 넘침·한글 줄 잘림 0(브라우저 스크립트 확인), 데모 페이지 자체 390 폭 가로 스크롤 0.
  - 핵심 배치 결정(A/B 아님): 순서 **일본어 → 읽기(히라가나) → [한글] → 번역**, 한글 13px ink2(목록·보기 12.5 · 칩 12 · 단어 상세 14 · 단어 카드 15), **대괄호 [ ]** 로 번역 줄과 구분, sr-only "한글 발음:" 머리, 한글 줄 keep-all 금지(`overflow-wrap:anywhere`), 일본어 본문 17px 유지. 제외 자리: 입력칸·메모 칩·인식 중 자막·제목/머리줄·한국어 문장 속 일본어 인용·관리자 콘솔. 오늘의 단어 카드는 카드 [읽기]를 켰을 때만(외우기 힌트라서). 느리게 듣기 글자 가림 중에는 한글도 가림. 단어장 행은 한글 켬이면 64 → 약 82px.
  - **결정 필요 A/B(데모 하단 패널)**: D1 표기 관례 A ‘까’ 계열(구절 첫 글자만 거센소리, 기본 가정) / B ‘카’ 계열 — 샘플 8개(ありがとう·かわいい·とうきょう·がっこう·ちょっと·しんぶん·いただきます·これはいくらですか) 나란히, 사용자 예시 “코레와 이쿠라데스까”는 두 안 사이(A와 く 한 글자, B와 か 한 글자 차이)임을 명시 · D2 읽기 없는 한자 문장 A 표시하지 않음(기본 가정) / B 서버가 읽는 소리를 구해 표시(**디자이너 권장** — 교정문·내 말이 빠지지 않고, 조사 は·띄어쓰기가 소리대로, 선생님 음성과 같은 읽기. 대신 API·서버 작업 → Leader 사양 필요) · D3 토글 위치 A 설정에만 / B 설정 + 화면 안 빠른 토글(기본 가정·권장, IMP-0015) · D4 읽기와의 관계 A 따로(기본 가정·권장) / B 묶음 · D5 데모 범위 A 이 delta 로 결정(권장) / B full v2.
  - **Leader 확인 필요(발견)**: 서버 읽기(`reading`)는 조사 は를 글자 그대로 싣는다(예 `わたしのなまえはぶらうんです`·`こんにちは`) → 앱 규칙만(D2-A)으로는 は→와 판정이 불완전해 "애매하면 숨김"이 필요하고, 읽기에 띄어쓰기가 없어 한글도 붙여 써진다. 테스트 픽스처에 한자가 섞인 reading(`私は元気です`)도 있어 변환기는 가나 외 문자가 있으면 표시하지 않아야 한다. D2-B 를 고르면 우분투 쪽에 이미 있는 가나 읽기 분석(분석 워커)을 쓰는 방향을 developer 조사 대상으로 제안.
  - **full 데모 필요 여부 의견**: 판정 delta(`DM-low-confidence`)이고 영향 화면은 넓지만, 바뀌는 방식이 "일본어 아래 한 줄 + 전역 토글" 하나라 화면 종류별 대표 상태로 시각 판단이 충분하다고 본다(로딩·빈·오류 상태에는 일본어 본문이 없어 변화 없음). 좁은 칸 위험 지점(교정 카드 두 칸·문제 보기·표현 칩·단어장 행)은 v1 에 모두 넣었다. 그래서 **delta 로 충분(D5-A 권장)** — 다만 사용자가 모든 상태를 보고 싶으면 D5-B 로 full v2 를 만든다. 이 판단도 사용자 선택지로 패널에 넣었다.
- [09:43] **delta 데모 v2 작성** — `docs/demo/task-026-improve-hangul-reading-v2.html`(`task-026-v2`, 토큰 `src/app/globals.css@sha256:bf67d6c60da2` — 해시는 바뀌었지만 색 값은 v1 과 같음, 새 색 없음). `check.mjs lint` → `DEMO_LINT_PASSED`. v1 파일 수정 없음, src/** 수정 없음. Artifact 게시·검토 요청은 Leader.
  - **v1 승인 해석(Leader 확인)**: "대기 중인 데모 전부 권고안대로 승인" → D1-A(‘까’ 계열 — 권장 표시 없이 기본 가정뿐이라 A 로 해석) · D2-B(서버가 소리를 구함) · D3-B · D4-A · D5-A. v2 는 이 다섯을 고정하고 패널 상단 표로 보여 준다.
  - **담은 상태(15)**: 회화방 — 일괄 제어·말풍선·교정 카드(`#talk`) / 내 말 준비 중·번역 중(`#talk-pend`) / 내 말 번역 실패 → [다시 가져오기](`#talk-fail`) · 채팅방(`#chat`) · 표현 점검 교정 카드 두 칸·단어 제안(`#review`) · 단어장 목록(`#words`) · 단어 상세 시트(`#wsheet`) · 오늘의 단어 카드(`#deck`) · 오늘의 회화 ①~⑤(`#l1`·`#l2`·`#l3` 한자 보기·`#l3b` 가나 보기·`#l4`·`#l5`) · 설정 › 일본어 표시(`#settings`). 폭 360/390/412/세 폭, 제안/현재/현재 vs 제안, 라이트/다크, 상단 "표시" 3토글(앱 설정 미러).
  - **검증(브라우저 스크립트)**: 15상태 × 3폭 × 5변형(기본·번역 켬·E3-B 패널 열림·E1-B 문장 아래·현재 vs 제안) = 프레임 270개에서 프레임 밖 넘침·가로 스크롤 0(sr-only 제외), 표시 바 넘침 0, 데모 페이지 390 폭 가로 스크롤 0, 콘솔 오류 0(favicon 404 만). 실측 높이: 단어장 한자 행 둘 다 켬 102 · 후리가나만 80 · 한글만 92 · 둘 다 끔 71px, 문제 보기 52 → 80px, 회화방 대화 영역 390×780 에서 563px(표시 바 44 포함).
  - **배치(결정 아님)**: 층 = 후리가나(한자 위, 11px ink2, 送り仮名 제외) → 일본어 17px → [한글] 13px(v1 그대로) → 번역 15px(말풍선 안 구분선 아래, 선생님·내 말 같음). 루비가 있는 블록만 줄간격 1.7 → 2.1, 준비 중에도 미리 넓혀 채워질 때 세로로 밀리지 않게. `ruby-align:center`(읽기가 한자보다 길면 그 한자 양옆만 살짝 빔 — 기본값 space-around 는 한자 사이를 벌려 `面 白`처럼 보여 바꿈). rt 는 선택·복사 제외·`aria-hidden`(스크린리더는 본문만). 말풍선마다 [읽기 ▾] 없앰. v1 의 머리 [한글] 버튼 → 일괄 제어로. 오늘의 회화 도구 줄 [후리가나][한글][번역](③ 문제에도 추가), 단어장 도구 줄 [후리가나][한글], 단어 표제어 옆 읽기 칸 → 표제어 위 후리가나. 오늘의 단어 카드는 예외(카드 [읽기] 켰을 때만 후리가나 16px + [한글]). 달지 않는 곳 v1 그대로(입력칸·메모 칩·인식 중 자막·제목·한국어 속 인용·관리자 콘솔). 내 말 번역 실패는 번역 칸 안 문구 + [다시 가져오기] 44px(토스트·빨강 없음), 후리가나·한글 실패는 빈칸(v1 원칙).
  - **결정 필요 A/B(새로 생긴 것만, 권고안 = 기본 선택)**: E1 읽기 방식 **A 후리가나가 히라가나 줄을 대신(권고)** / B 둘 다·설정에서 "한자 위|문장 아래" · E2 기본 표시 **A 후리가나 켬 + 한글 켬(권고)** / B 한글만 · E3 일괄 제어 위치 **A 머리 아래 44px 표시 바 [후리가나][한글][번역] 늘 보임(권고)** / B 머리 [あ가] 아이콘 → 스위치 3개 패널 · E4 말풍선별 조작 A 일괄만 / **B 일괄 + 말풍선별 [번역 ▾](권고 — 바에서 바꾸면 개별 연 것 초기화)** · E5 내 말 번역 **A 번역 스위치에 같이 묶음(권고)** / B 내 말은 말풍선별 [번역 ▾]만 · E6 내 말 번역 시점 **A 보낼 때마다 뒤에서 미리(권고)** / B 번역을 켤 때만 요청(그동안 "번역 중…"). 번역 기본값은 지금처럼 끔.
  - **Leader 확인 필요**: ① **후리가나 데이터 출처** — 지금 `reading`(문장 전체 히라가나 한 줄)으로는 한자별 정렬이 안 된다. 서버가 형태소 단위 `[{surface, reading(히라가나 — 루비용), pron(발음 가나 — 한글용, は→ワ·장음 ー)}]` 를 내야 한다(데모의 `今日{きょう}は` 표기는 이걸 줄인 모양). D2-B 의 서버 읽기와 **같은 분석 한 번**으로 두 용도를 채우는 사양 권고 — 우분투 분석 워커의 pyopenjtalk(형태소별 read·pron) 또는 M4 `tts.g2p`(지금은 문장 단위 reading 만 반환 → 형태소별 확장 필요) 중 developer 조사. 送り仮名 분리(面白い → 面白 위에만)는 surface·reading 의 앞뒤 가나 맞춤으로 앱/서버 한 곳에서. 단어장 단어(`WordEntry.reading` 단어 단위)는 같은 맞춤으로 서버 없이도 루비 가능할 수 있음. 응답 필드·저장(메시지 행에 둘지, 오래된 메시지 소급 여부 — 없으면 기존 `reading` 이 있을 때 히라가나 줄로 대체 표시 권고)은 Leader 사양. ② **내 말 번역 서버 작업** — USER 메시지 `translation` 생성(LLM 호출 추가, 5초 예산 밖 비동기, E6 에 따라 보낼 때/켤 때), 상태 전달(준비 중·실패 — 폴링 또는 SSE 추가 이벤트), 재시도 API. 채팅방·회화방 공통. ③ **번역 스위치 범위** — 데모는 후리가나·한글·번역 세 값 모두 앱 전체 하나(사용자 설정)로 그렸다. 지금 오늘의 회화 번역 토글은 화면 안 값이라, 앱 전체로 묶으면 회화방에서 켠 번역이 수업에도 켜진다 — 이 범위로 확정할지 Leader 판단. ④ 설정 저장 위치: 지금 `localStorage kaiwa.chat.readingDefault` → `preferences` 사용자 설정 3개(기기 간 동일)로 옮기는 것을 전제로 그림. ⑤ `docs/screens.md` §1-3(“ruby 대신 본문 아래 한 줄”)은 승인 뒤 구현 가이드에서 뒤집어 고친다.
- [17:16] 데모 v2 표시 문구 '후리가나' → '히라가나'(사용자 지시 17:14, v2 파일 그대로 수정 — 승인 전·해시 재기록은 Leader). 71곳 전부 바꿈(`grep -c 후리가나` 0, 코드 주석 2곳은 '루비'로). 동작·레이아웃·식별자(`fu`·`fuLabel`) 변경 없음. 다듬은 문장(히라가나 중복·혼동 방지): 설정 스위치 설명 "한자 위에 작은 히라가나로 읽기를 적어요" → "한자 위에 작게 읽는 법을 적어요" · E3-B 패널 스위치 설명 "한자 위 작은 히라가나" → "한자 위에 작게 읽는 법" · E1 문장 "한자 위 히라가나는…", E1-A 제목 "한자 위 히라가나로 대신"·설명 "문장 아래 히라가나 줄은 없애요"·E1-B 장점 "문장 아래 히라가나 줄이…"·결정 요약 칩 "한자 위 히라가나로 대신" · v1→v2 "(E1-A: 문장 아래 히라가나 줄 없앰)" · 단어 제안/단어장 "표제어 옆 읽기(칸)는 표제어 위로 옮겨요" · 한자 없는 예 4곳 "한자가 없어 위 히라가나 없음"(가나 보기 포함) · 배치 규칙 "(이미 가나·가타카나인 글자 위에는 없음)". 토스트 "히라가나를 보여 줘요/숨겼어요"·미리 보기 "히라가나와 한글을 모두 숨겼어요"·aria "표시 설정 — 히라가나·한글·번역"·`<title>` "히라가나·한글·번역 표시"(조사 그대로 자연스러움). `[읽기]`(E1-B·deck) 그대로. 검증: `check.mjs lint` DEMO_LINT_PASSED · 브라우저 360px 표시 바 [✓히라가나][✓한글][번역] 한 줄(top 동일, scrollW=clientW=360) · 화면 텍스트 '후리가나' 0 · 콘솔 오류 0(favicon 404 만). 구현 가이드·화면 서브태스크도 이 용어로.
- [17:22] (Leader 지시 — 게이트가 같은 버전 재검토 거부) 위 문구 수정을 **데모 v3** `docs/demo/task-026-improve-hangul-reading-v3.html` 로 옮김: `demo-version` task-026-v3 · h1 small "데모 v3 · v2 결정 그대로 + 한자 위 읽기 표시 이름을 ‘히라가나’로 통일(사용자 지시 10-04)"(문구 안에 '후리가나'를 쓰면 grep 0 이 깨져 이렇게 씀; v2 는 아직 승인 전이라 "승인 결정" 대신 "결정") · 비교 라벨 "제안 · v3". "결정 필요 — v2 에서 새로 생긴 것만"·"v1 → v2 바뀐 점"은 v2 에서 생긴 내용을 가리키는 이력이라 그대로 뒀음. v2 는 `git checkout` 으로 검토본 원본 복원(HEAD 와 diff 0). 검증: v3 `grep -c 후리가나` 0 · v3 lint DEMO_LINT_PASSED(--expect task-026-v3) · v2 lint PASS. 게시·게이트 기록은 Leader.

## Developer 기록

### Developer 기록 (서버 사양 조사, 2026-10-04 실측)
- [10:55] **조사만 — 코드·DB·운영 변경 0.** 실측은 dev venv `~/.node-local/thekaiwa-speech-dev`(pyopenjtalk 0.4.1, 운영 venv 와 같은 버전·같은 사전 `open_jtalk_dic_utf_8-1.11` 이미 설치)의 python 으로 스크래치 스크립트만 돌렸다. 운영 venv·pm2·M4 는 호출하지 않았다(M4 `/g2p` 는 코드 분석만).

#### 1. 형태소별 표기·읽기 출처 — 후보 비교 (샘플 5문장 + 데모 v2 문장 8개)
| 후보 | 실행 위치 | 루비(한자 묶음별 히라가나, 送り仮名 제외) | 한글용 발음(は→ワ·へ→エ·を→オ, 장음 ー, 구절 경계) | 지연(문장당) | 판정 |
|---|---|---|---|---|---|
| **P. pyopenjtalk `run_frontend`** (NJD 피처 `string/pos/read/pron/chain_flag`) | 우분투 Python(운영 venv 에 이미 있음 — gateway·worker 공유) | 노드별 `read`(가타카나→히라가나) + 표면형 정규식 정렬로 **5/5·데모 8/8 일치** — `今日{きょう}は何{なに}を食{た}べましたか？` · `持{も}ち帰{かえ}る` · `ご注文{ちゅうもん}はお決{き}まりですか` · `面白{おもしろ}いでした` · `聞{き}き取{と}り` · `一日中`(묶음 하나) · `生{なま}ビール` | `pron` 이 조사 は→**ワ**·へ→**エ**(を 는 **ヲ** 그대로 → 서버가 助詞 ヲ→オ), 장음 **ー**(今日→キョー·映画→エーガ·ましょう→マショー), `chain_flag`=악센트구 경계. 데모 v2 `p` 문자열과 **소리 7/8·경계 6/8 정확히 일치**(차이: `アクション映画` 를 한 구절로 묶음, `いい`→`イイ`(데모는 `イー`)) | 사전 로드 1회 96ms(RSS +2MB, 사전 mmap) · 처음 보는 문장 0.3~7ms · 이후 중앙값 0.03~0.06ms | **권고** |
| M. M4 tts-service `POST /g2p` (`style_bert_vits2` `g2kata_tone`) | 맥 M4 | **불가** — 문장 전체 모라열(`reading`·`accent`·`moras[]`)만 반환, 표면형·형태소 경계 없음. 확장하려면 SBV2 내부 정규화(`normalize_text`) 뒤 텍스트라 원문 위치 대응도 깨진다 | 소리는 맞음(내부가 pyopenjtalk 계열, `pyopenjtalk-dict 0.3.4.dev2` — 우분투 0.4.1 과 사전판이 달라 드물게 읽기 차이 가능) | 미측정(운영 접근 금지). **합성과 같은 1-스레드 러너**(runtime.py)를 써서 실시간 TTS 와 큐를 다툰다 | 기각 |
| N1. Node `Intl.Segmenter('ja')`(내장, 설치 불필요) | 앱 | **불가** — 분절만, 읽기 없음(`食|べ|ま|した` 처럼 활용도 잘게 깸) | 불가 | 0.02~2.4ms | 기각 |
| N2. kuromoji.js(IPADIC) — **설치 안 함, 후보 기록만** | 앱(Next 프로세스) | 토큰별 reading·pronunciation 제공 → P 와 같은 방식 가능 | pronunciation 에 は→ワ·長音 ー 있음 | 공개 자료 기준 사전 로드 ~1s·메모리 수십~100MB+ × blue/green 2프로세스 | 신규 의존성(Leader 승인)·사전 약 17MB 번들. P 가 이미 설치돼 있어 보류 |
| D. 기존 문장 `reading` + 앱 정렬 | 앱 | 깨끗한 문장은 5/5 맞음. 그러나 **조용히 틀림**: `私は母は好き`+`わたしははははすき` → `母{は}`·`好{はす}`(실패 신호 없음). 내 말·교정문·문제 보기·힌트는 `reading` 자체가 없음 | 불가 — `reading` 이 は를 글자 그대로(`こんにちは`·`わたしのなまえは…`), 구절 경계 없음 | 0.01~0.07ms | 폴백도 비권장(“틀린 발음 보이지 않음” 위반 위험) |
- 원문 대응 함정(P, 실측): pyopenjtalk 은 표면형을 바꿔 돌려준다 — 반각→전각(`?`→`？`, `ABC`→`ＡＢＣ`, 공백→`、`), 반각 가나→전각(`ﾃｽﾄ`→`テスト`), **숫자→한자**(`3時`→`三時`, `1,000円`→`千円`), 句点 `。` 의 read 가 `、`. → 서버가 원문 오프셋으로 되돌려 매핑해야 한다. 프로토타입(전각화 비교 + 숫자 묶음 흡수)으로 `3時`→`3{r:null,p:サン}`+`時{じ}`, `1,000円`→`1,000{p:セン}`+`円{えん}`, `ABC`·`ﾃｽﾄ`·`?` 원문 유지 확인. 소수(`2.5時間`)는 대응 실패 → 그 뒤 꼬리를 `r/p=null`(표시 안 함 — “애매하면 숨김”). 기호는 surface 그대로.
- 문맥 다의(何で なんで/なにで·明日 あした/あす·上手) 는 P 도 틀릴 수 있으나 **선생님 TTS 와 같은 엔진 계열**이라 “들리는 소리와 같은 읽기”는 지켜진다. 관리자 발음 사전(PronunciationLexicon)을 분석기에도 반영할지는 후속(pyopenjtalk user dict) — 1차 비범위 권고.

#### 2. 호출 지점·저장 — 텍스트 종류별 현재 읽기 출처
| 텍스트 | 저장 위치 | 지금 읽기 | 루비·한글 출처(권고) |
|---|---|---|---|
| 선생님 말(TALK·CHAT) | `ChatMessage.content` | `ChatMessage.reading`(A1/A2 `replyReading`, 문장 히라가나 한 줄 — 표시 전용, 다른 소비처 없음) | P |
| 내 말 | `ChatMessage.content`(USER) | 없음 | P |
| 교정문·원문 | `Correction.corrected/original` | 없음 | P |
| 레슨 대화·청크·문법 예문·응용/말하기 모범답 | `Lesson.content` JSON(`dialogue[].reading`·`chunks[].reading`·`exampleReading`·`modelReading`) | 문장 히라가나(LLM) | P(문장 `reading` 은 그대로 두고 표시는 P 로 통일) |
| 퀴즈 보기·`promptJa`·`hintJa` | `Lesson.content` | 없음 | P |
| 단어 표제어 | `WordEntry.surface`+`reading`(단어 단위, 사용자 수정 가능) | 있음 | **저장된 `reading` 우선** — 표제어·읽기 정렬로 루비(서버 불필요), 한글은 같은 변환기 규칙(おう·えい 장음) |
| 단어 예문 | `WordEntry.example` | 없음 | P |
| 표현 칩·TopicChunk | `TopicChunk.textJa`+`reading` | 있음 | P(칩 짧음 — 단어처럼 저장 reading 정렬도 가능) |
- **권고 = (B) 표시 시점 계산 + 캐시, DB 저장 안 함.** 근거: 분석이 결정적이고 문장당 1ms 미만이라 저장 이득이 없다 · 옛 메시지·레슨도 소급 적용 · 분석기 버전·사전이 바뀌어도 재계산만 · `Correction.original` 불변·`Lesson.content` 스냅샷을 건드리지 않음 · DB 변경 0. 캐시 = 앱 메모리 LRU(키 `sha256(text)+analyzerVersion`, 예 5,000건) + 클라이언트 메모리 캐시.
- **(A) 저장안(참고, 채택 안 함)**: `ChatMessage.segments Json?` 1칸 — 턴 저장 경로에 외부 호출이 끼고, 레슨 JSON·Correction·WordEntry 는 따로 칸이 필요해 범위가 커진다.
- **응답 모양(권고)**: `POST /api/v1/text/annotate {texts: string[] ≤64, 각 ≤400자}` → `{items: [{segments: [{s, r, p, b}]} | null]}` — `s` 원문 조각(이어 붙이면 원문과 정확히 같음), `r` 루비 히라가나(한자 없는 조각·대응 실패 = null), `p` 발음 가타카나(조사 は→ワ·へ→エ·を→オ, 장음 ー, 대응 실패 = null), `b` 이 조각 앞 경계(`phrase`|`particle`|null). 데모 `ja`(`漢字{よみ}`)·`p`(`' '`=구절, `'|'`=조사 뒤)는 클라이언트가 이걸로 조립. 인증 필수·소유권 무관(본문 저장·로그 안 함, 길이·건수만 계측). 화면 경로별 API 를 고치지 않고 **한 라우트 + 공용 훅**(`useAnnotations(texts)`)으로 모든 화면이 쓴다.
- **6층 배치(권고)**:
  - Python: `speech/gateway` 에 `POST /text/annotate`(X-Internal-Secret, 127.0.0.1 — nginx 는 `/ws/speech` 만 노출하므로 외부 비노출 확인) — pyopenjtalk 은 스레드 안전하지 않아 **전용 1-스레드 executor**, 입력 상한. gateway 를 고른 이유: 이미 상주(pm2)·같은 venv 에 pyopenjtalk 설치됨·HTTP·내부 시크릿 있음. worker 는 DB 큐 폴링이라 동기 응답 불가, M4 는 합성 큐 경합. 대안 = 별도 pm2 `thekaiwa-text`(:8110) — 실시간 STT 와 완전 격리되지만 운영 항목 +1(deploy.sh·ecosystem). 분석 CPU 가 미미해 gateway 안 권고, Leader 판단.
  - L5 `engine/adapters/text/openJtalkHttp.ts`(엔진명은 여기만) + `engine/text/index.ts` 파사드(`annotate(texts)`) — URL·시크릿은 `SPEECH_GATEWAY_URL`·`SPEECH_INTERNAL_SECRET`(infra config, 신규 환경변수 없음). **EngineType enum(STT/TTS/LLM)에 TEXT 를 넣지 않는다**(enum 추가 = DB 변경 + seed·Connection Profile 범위 확대) — 레지스트리 밖 내부 서비스 어댑터로 시작, 관리자 콘솔 연결 관리는 후속.
  - L4 `speech/reading/index.ts`(서버 — LRU 캐시·분석기 불가 시 `null` 반환, 오류 아님) + `speech/reading/client.ts`(클라이언트 안전 순수 모듈 — **가나→한글 변환기 한 곳**, 루비 조립·단어 표제어 정렬 함수, 기존 `speech/tts/client` 패턴). 화면은 `client` 만 import.
  - 분석기 다운 시: 후리가나·한글 자리 빈칸(v1 원칙), 기존 `reading` 히라가나 줄로 대체하지 않음(E1-A 는 그 줄을 없앰).

#### 3. 내 말 번역(E5·E6-A)
- 현재: USER `ChatMessage.translation` 칸은 있으나 늘 null. 비동기 패턴 3종 — ① `AiJob`+`jobs.runJobInBackground`+`GET /api/v1/jobs/:id` 폴링(CHAT_REVIEW·LESSON_GEN 등), ② 턴 SSE `TurnStream`(이벤트 `accepted|status|audio|done|error`, `done` 뒤 종료), ③ 메시지 `GET /api/v1/chats/:id?after=` 폴링(id 기준 — 옛 메시지의 갱신은 못 잡음, ChatMessage 에 updatedAt 없음).
- **핵심 제약(발견)**: Claude CLI 어댑터는 **동시성 1** 의 2레인 큐(interactive 우선, 비선점)다. 내 말마다 별도 번역 호출(haiku, spawn ≈1.9s 포함 ≈3~5s)을 batch 로 띄우면, 그 호출이 도는 중에 들어온 다음 회화 턴(interactive)은 **끝날 때까지 기다린다** → 5초 예산을 최대 수 초 침범. AiJob 으로 하면 `JobKind` enum 추가 = DB 변경.
- 후보:
  | 안 | LLM 호출 | 5초 예산 | DB | 비고 |
  |---|---|---|---|---|
  | **T1 턴 응답에 `userKo` 동승**(A1/A2 응답 계약에 학습자 말 번역 필드 추가, `conversation` 뒤) | **+0**(출력 토큰 +20~40) | 첫 음성 영향 없음(조기 추출은 replyJa), `done`·2번째 문장 합성 시작 +0.2~0.5s 추정 — 실측 필요 | 없음(USER `translation` 에 같은 저장 트랜잭션으로) | prompt-engineer 영역(A1/A2 버전업·회귀). 번역이 `done` 에 실려 와 상태 전달·폴링 불필요. 같이 `replyReading` 을 빼면(표시 전용·P 로 대체) 출력 토큰이 오히려 줄어 순증 0 이하 |
  | T2 보낼 때마다 별도 haiku 호출(batch) | 사용자 말 1건당 +1 (회화 CLI 호출 2배) | 위 큐 경합 위험 | 상태를 `toolLog.translation{state,at}` 에 두면 0(선례: `toolLog.correction`), AiJob 쓰면 enum 변경 | 상태 전달 = 폴링 |
  | T3 home-m4 qwen 별도 호출 | +1(CLI 슬롯 밖) | 경합 없음 | T2 와 같음 | connection `runtime.allowedTasks` 추가·번역 품질 검증 필요 |
- **권고**: 새 턴은 **T1**, 실패·옛 메시지·`[다시 가져오기]` 는 **재시도 API** `POST /api/v1/chats/:id/messages/:messageId/translation`(소유자 검사, USER 메시지만, 이미 있으면 그대로 반환, 사용자당 동시 1·분당 상한) — haiku 단건 호출, **사용자가 기다리는 요청이라 interactive 레인·짧은 타임아웃(≈15s)**, 동기 응답 `{translation}` 또는 `422/503` → 화면은 번역 칸 안 문구 유지. 실패 상태는 저장하지 않고(번역 null + 턴 완료 = “가져오기 실패/없음”) 화면이 [다시 가져오기] 를 보인다 → DB·enum 변경 0. 재시도 프롬프트(작은 번역 모듈)는 prompt-engineer 가 신설.
- T1 이 사용자 결정 E6-A(“보낼 때마다 비동기 생성, AI 호출 증가 수용”)의 취지(보낼 때 미리 만들어 둠)를 호출 증가 없이 만족한다 — Leader 가 사용자에게 그대로 진행해도 되는지 판단. T2 를 고르면 위 큐 경합을 막는 조건(턴 진행·TALK 방 활성 중에는 번역 호출 보류, 방 유휴 N초 뒤 한 번에 묶어 1회)을 사양에 넣어야 한다.

#### 4. 설정 저장(후리가나·한글·번역 3 스위치, 앱 전체 하나)
- 현재: 서버 저장 없음. `localStorage kaiwa.chat.readingDefault`('on'/'off') 를 채팅방(`ChatRoom.tsx`)과 오늘의 회화(`LessonScreen.tsx`)가 같이 씀(히라가나 줄), 오늘의 회화 번역은 화면 상태 `useState(false)`(`StageUnderstand.tsx`), 채팅 말풍선 번역은 말풍선별 상태. `AppSetting` 은 환경 단위(사용자별 아님), `UserSpeechSetting` 은 인식 전용 → 기존 칸으로는 담을 곳이 없다.
- **DB 변경 필요(사용자 승인 사항, 적용 안 함)** — 제안: `Profile` 에 3칸 추가(추가형·기본값 있음 → `prisma db push` 데이터 손실 없음)
  ```prisma
  showFurigana    Boolean @default(true)
  showHangul      Boolean @default(true)
  showTranslation Boolean @default(false)
  ```
  `Profile` 은 “학습 설정·화면 폼 1:1” 이고 `GET/PATCH /api/v1/settings/profile` 경로·`parseProfilePatch` 를 그대로 쓴다(새 테이블 불필요). 대안 = `displayPrefs Json?` 1칸(향후 표시 항목 추가 시 마이그레이션 없음, 대신 타입 검증을 코드로) — 3칸 권고.
- 이관: 첫 로드 때 `kaiwa.chat.readingDefault === 'off'` 이고 서버 값이 기본이면 `showFurigana=false` 를 한 번 PATCH 하고 키 삭제(E1-A 로 히라가나 줄이 후리가나로 바뀌므로 대응). 번역은 기존 화면 상태라 이관 없음.

#### 예상 변경 파일·서브태스크 분할(각 15파일 이하)
- **S1 서버 — 분석(약 12)**: `speech/gateway/kaiwa_gateway/text.py`(신규) · `speech/gateway/kaiwa_gateway/server.py` · `speech/gateway/requirements.txt`(pyopenjtalk==0.4.1 명시 — venv 엔 이미 있어 설치 작업 없음, 그래도 requirements 변경 = Leader 보고) · `speech/gateway/tests/test_text.py` · `src/modules/engine/adapters/text/openJtalkHttp.ts` · `src/modules/engine/text/index.ts` · `src/modules/engine/index.ts` · `src/modules/speech/reading/index.ts` · `src/modules/speech/reading/client.ts` · `src/modules/speech/index.ts` · `src/app/api/v1/text/annotate/route.ts` · `__tests__`(변환기 전수 표·루비 정렬·원문 대응). 배포 = gateway 재기동 포함(deploy.sh 경로).
- **S2 서버 — 설정·내 말 번역(약 10, DB 승인 후)**: `prisma/schema.prisma`(Profile 3칸) · `src/modules/preferences/{index,validate}.ts` · `src/app/api/v1/settings/profile/route.ts`(응답 확인) · `src/modules/conversation/orchestrator/{index,shape}.ts`(USER translation 저장) · `src/modules/conversation/chats/index.ts`(재시도 함수) · `src/app/api/v1/chats/[id]/messages/[messageId]/translation/route.ts`(신규) · `src/modules/engine/router/tasks.ts`(번역 재시도 task 스펙) · `__tests__`. **선행**: prompt-engineer A1/A2 `userKo`(T1)·번역 재시도 프롬프트.
- **화면 A — 공용 + 회화·채팅(≤15)**: 공용 `Ruby`·`HangulLine` 컴포넌트·`useAnnotations`·표시 설정 훅(Profile 3값 + 이관) · `TalkRoom`·`TalkRoomHeader`(표시 바)·`TalkTutorBubble`·`TalkUserActions`/내 말 말풍선(번역 중·실패·[다시 가져오기])·`TalkCorrectionCard` · `ChatRoom`·`MessageBubble`·`MessageList`·교정 카드.
- **화면 B — 오늘의 회화·단어장·기타(≤15)**: `LessonScreen`·`StageUnderstand`·`StageGrammar`·`StageQuiz`·`StageApply`·`StageSpeak`·`parts.tsx`(Toggle 3개) · 단어장 목록·단어 상세 시트·오늘의 단어 카드 · 표현 점검 교정 카드·단어 제안 · 설정 › 일본어 표시.
- 남은 일: Leader 가 (1) 분석 위치 gateway 안 vs 별도 프로세스 (2) T1 채택·prompt-engineer 배정 (3) Profile 3칸 DB 승인 을 정하면 S1 부터 착수 가능(S1 은 DB·프롬프트와 독립). 미커밋 파일: 없음(이 기록만). 스크래치: `/tmp/claude-1000/…/scratchpad/pojt_*.py`·`align.mjs`(저장소 밖).

### Developer 기록 (S1 서버 분석, 2026-10-04 실측)
- [11:40] **체크포인트 1 — Python gateway 완료.** 완료: `speech/gateway/kaiwa_gateway/text.py`(신규 — 원문 전각화 정렬·숫자 흡수·resync·루비 조각·조사 보정·경계) · `server.py`(`POST /text/annotate` 내부 시크릿 401·본문 256KB/64건/400자 상한 413·분석기 FAILED 503·전용 1-스레드 executor warm·health 상세 `textAnalyzer`) · `requirements.txt`(pyopenjtalk==0.4.1) · `tests/test_text.py`(16건 — 데모 8문장 루비 8/8·소리 8/8·구분 정확 6/8). gateway pytest 71/71, ruff·format·mypy 0. 남은 일: TS 어댑터(engine/adapters/text)·파사드·speech/reading(LRU·degrade)·client.ts(가나→한글)·라우트·api-contract·eslint 경계·TS 테스트·dev gateway(:8197) 실측. 다음 첫 행동: `src/modules/infra/secrets.ts` SERVICE_SECRETS 에 `SPEECH_INTERNAL_SECRET→SPEECH_GATEWAY_URL` 추가 후 어댑터 작성. 주의: run_dev.py 는 운영 venv 경로 고정 → 실측은 dev venv uvicorn 직접 실행. 미커밋: 위 4파일.

- [12:20] **체크포인트 2 — TS 층 완료(실측 전).** 완료: `engine/adapters/text/openJtalkHttp.ts`(신규 — 시크릿은 SPEECH_GATEWAY_URL origin 에만, 응답 칸별 검증)·`engine/text/index.ts`(신규 파사드 `annotate`·`isTextAnalyzerError`)·`engine/index.ts`(`text` 파사드)·`infra/secrets.ts`(SERVICE_SECRETS 에 `SPEECH_INTERNAL_SECRET→SPEECH_GATEWAY_URL`)·`speech/reading/index.ts`(신규 — LRU 5,000·6h, 실패 30초 쉼, degrade `available:false`)·`speech/reading/client.ts`(신규 순수 — `kanaToHangul`·`rubyPieces`·`toRubyMarkup`·`pronLine`·`hangulLine`·`alignWordRuby`)·`speech/index.ts`·`app/api/v1/text/annotate/route.ts`(신규 #24r)·`docs/design/api-contract.md`(#24r 행·절)·`eslint.config.mjs`(컴포넌트 허용 `reading/client` + client.ts import 금지 블록)·`speech/__tests__/reading.test.ts`(9건). 미러 tsc 0·eslint(변경 범위) 0·새 테스트 9/9. 남은 일: 전체 eslint·전체 회귀·변이 1건·dev gateway :8197 실측·최종 기록. 주의: speech 테스트는 engine 내부 경로 import 불가(eslint) → 어댑터는 `@/modules/engine` 의 `text` 파사드로 시험.

- [13:45] **S1 구현 완료 — Reviewer 인계.** 화면 파일 수정 0(데모 게이트 대상 아님 — 서버·순수 모듈만). commit·push·db push·npm install 없음. 운영 프로세스·운영 venv 미접촉(운영 venv 는 pyopenjtalk 설치 여부만 읽기 확인 — `pyopenjtalk-0.4.1` + `open_jtalk_dic_utf_8-1.11` 있음).
  - **변경 파일 15**: Python — `speech/gateway/kaiwa_gateway/text.py`(신규) · `speech/gateway/kaiwa_gateway/server.py` · `speech/gateway/requirements.txt`(pyopenjtalk==0.4.1) · `speech/gateway/tests/test_text.py`(신규 16건). TS — `src/modules/engine/adapters/text/annotateHttp.ts`(신규, 엔진명은 이 파일 주석에만) · `src/modules/engine/text/index.ts`(신규 파사드) · `src/modules/engine/index.ts` · `src/modules/infra/secrets.ts`(SERVICE_SECRETS `SPEECH_INTERNAL_SECRET→SPEECH_GATEWAY_URL`) · `src/modules/speech/reading/index.ts`(신규) · `src/modules/speech/reading/client.ts`(신규) · `src/modules/speech/index.ts` · `src/app/api/v1/text/annotate/route.ts`(신규) · `src/modules/speech/__tests__/reading.test.ts`(신규 9건). 문서·설정 — `docs/design/api-contract.md`(#24r 행·절, Leader 지시) · `eslint.config.mjs`(컴포넌트 허용 하위 진입점 `reading/client` + client.ts import 금지 블록).
  - **실측(dev gateway 127.0.0.1:8197, dev venv, 2026-10-04 13:26~13:40)**:
    | 항목 | 결과 |
    |---|---|
    | 데모 v2 8문장 루비(`漢字{よみ}`) | **8/8** 일치 |
    | 발음 줄 소리(구분 기호 제외) | **8/8** 일치 |
    | 발음 줄 구분까지 정확히 | 6/8 — `アクション映画` 한 악센트구(한글 띄어쓰기 1곳 차이) · `いい`→イイ(한글은 둘 다 `이-`) |
    | 데모 v2 발음 줄 → 한글(`kanaToHangul`) | 13/13 데모 `HG.convert(p,'A','B')` 와 동일 |
    | gateway 지연(HTTP 포함) | 1문장 중앙 0.5ms·p95 0.7 / 8문장 1.1·1.3 / 64문장 5.3·5.6 · 첫 배치(사전 warm 뒤) 6.8ms |
    | 앱 경로(`annotateReadings` → 파사드 → 어댑터 → gateway) | 6문장 cold 22.1ms · 캐시 0.06ms |
    | 분석기 다운(포트 닫힘) | `{items:[null], available:false}` 1.8ms, 오류 아님 · 30초 쉼 |
    | 내부 시크릿 없음 | 401 |
  - 원문 대응: `3時`→`3`(サン)+`時{じ}` · `1,000円`→`1,000`(セン)+`円{えん}` · `20人で2.5時間`(소수 `．` 흡수) · `3万円`(뒤 한자 수사 흡수) · `ﾃﾞｰﾀ`·`ABC`·`?`·줄바꿈·전각 공백 원문 유지. 맞출 수 없는 구간(`2026年10月4日` 의 `4日` 등)은 `ruby/pron=null` → 한글 줄 숨김. 사전 밖 글자(읽기 비가나)는 원문을 소리 자리에 흘리지 않음(pron null), 기호(★·😀)만 원문.
  - **실행 증빙**: 미러 `~/.node-local/thekaiwa-dev-010b`(rsync — 스크래치 `sync-010b.sh`) `tsc --noEmit --incremental false` **0** · `eslint .` **0 errors**(경고 5 = 기존 set-state-in-effect, 변경 파일 무관) · 새 테스트 `reading.test.ts` **9/9** · 전체 회귀 `node --import tsx --test $(find src -name '*.test.ts')` **1280 pass / 0 fail / 3 skip (1283)** — 이 미러에는 다른 역할의 진행 중 변경(conversation prompts·userKo 등 미커밋)도 함께 실렸다 · gateway `pytest tests` **71/71**, `ruff check`·`ruff format --check`·`mypy kaiwa_gateway` 0. **변이 2건 모두 잡힘**: TS — `kanaToHangul` 의 '까' 규칙 제거(K 행 늘 거센소리) → 9건 중 4 fail · Python(스크래치 사본) — 조사 を→オ 보정 제거 → 16건 중 2 fail.
  - **Reviewer 인계(볼 곳)**: ① 경계 — 라우트는 `@/modules/speech` 공개 API 만, speech/reading → `@/modules/engine` `text` 파사드만, 어댑터만 infra 시크릿 접근. `client.ts` import 0(eslint 블록 + 테스트). ② 보안 — gateway `/text/annotate` 는 시크릿 상수시간 비교(기존 `_authorized`), 본문 256KB 스트리밍 상한·64건·400자 413, 제어 문자 문장은 분석기에 넣지 않음, 오류 본문에 입력 없음(FastAPI 422 미사용). 앱 → gateway 시크릿은 `SPEECH_GATEWAY_URL` env origin 에만(`readServiceSecretFor`), redirect manual, 응답 2MB 상한·칸별 검증(조각 이어 붙임 = 원문, 루비 히라가나만). ③ 로그 — gateway `n·chars·failed·ms`, 앱 `[reading]` 실패 종류·건수만. ④ executor — 분석기는 전용 1-스레드(실시간 WS 와 분리), 사전 warm 은 lifespan(`load_engine=True` 일 때). health 상세(시크릿 필요)에 `textAnalyzer.state` 추가. ⑤ `infra/secrets.ts` 에 서비스 시크릿 1종 추가(값·이름 노출 경로 변화 없음).
  - **화면 서브태스크에 넘길 것(클라이언트 모듈 API — `@/modules/speech/reading/client`, 컴포넌트 import 허용됨)**:
    - 데이터: `POST /api/v1/text/annotate {texts: string[≤64, 각 ≤400자]}` → `{success, data:{items:[{segments: ReadingSegment[]}|null], available}}`. 사용자당 60/분 — 화면은 한 번에 묶어 요청(공용 훅 `useAnnotations(texts)` 권장, 클라 메모리 캐시, `available:false` 면 다음 진입 때 다시).
    - `rubyPieces(segments): {text, reading|null}[]` → `<ruby>text<rt aria-hidden>reading</rt></ruby>`(reading null 이면 그냥 텍스트) · `hangulLine(segments): string|null`(null = 한글 줄 숨김) · `kanaToHangul(kana)` · `pronLine(segments)` · `toRubyMarkup(segments)`(데모 표기, 테스트용) · `alignWordRuby(surface, reading)`(단어장 표제어 — 저장 `WordEntry.reading` 으로 서버 없이, 단어 한글은 `kanaToHangul(reading)`) · `hasKanji` · 상수 `READING_MAX_TEXTS/CHARS`.
    - 주의: 저장된 단어 읽기를 바로 `kanaToHangul` 에 넣으면 장음이 글자 그대로 나온다(`とうきょう`→`토우꾜우`, 발음 가나 `トーキョー`→`토-꾜-`). 단어장 한글은 표제어를 `texts:[surface]` 로 분석한 `hangulLine` 을 쓰는 편이 선생님 발음과 같다(루비만 `alignWordRuby`).
  - **Leader 판단 필요(구현 안 함)**: (a) `docs/design/module-dependency.md` 에 L4 `speech/reading`·L5 `engine/text`(레지스트리 밖 내부 어댑터) 반영 (b) 관리자 발음 사전(PronunciationLexicon)을 분석기에도 반영할지(1차 비범위) (c) 배포 시 gateway 재기동 필요(`deploy.sh` 경로 — 새 라우트·pyopenjtalk import, 운영 venv 엔 이미 설치) — 앱만 먼저 나가면 `available:false` 로 숨김(안전).
  - 미커밋 파일: 위 15 + 이 이력서·`20-Log/2026-10-04.md`. 스크래치: `scratchpad/{s1_try.py,s1_measure.py,run_gw_dev.py,sync-010b.sh,demo8.json,hg_demo.js,mut1/}`.

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
| v1 | 승인 | docs/demo/task-026-improve-hangul-reading-v1.html | https://claude.ai/artifact/VudBLetAaJmbSpJHWzwpPh | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |
| v2 | 작성중 | docs/demo/task-026-improve-hangul-reading-v1.html | - | v1 승인 무효화 → v2 작성 | 10-04 09:30 |
| v2 | 검토요청 | docs/demo/task-026-improve-hangul-reading-v2.html | https://claude.ai/artifact/5h7KYVQKdQh8WkfVHSmpWY | 사용자 검토 요청 | 10-04 09:44 |
| v2 | 수정요청 | docs/demo/task-026-improve-hangul-reading-v2.html | https://claude.ai/artifact/5h7KYVQKdQh8WkfVHSmpWY | "'후리가나' -> '히라가나' 로 문구 변경해줘" | 10-04 17:16 |
| v3 | 검토요청 | docs/demo/task-026-improve-hangul-reading-v3.html | https://claude.ai/artifact/5h7KYVQKdQh8WkfVHSmpWY | 사용자 검토 요청 | 10-04 17:18 |

## Leader 기록 (서버 사양 조사 수용·결정, 2026-10-04 10:55)
- 조사 수용: 읽기 출처 = **pyopenjtalk**(표기 8/8, 지연 <1ms/문장), M4 `/g2p`·Intl.Segmenter·기존 reading 정렬은 기각(근거는 Developer 기록).
- **결정 1 — 분석 위치: speech/gateway 내부 `POST /text/annotate`(내부 전용, 내부 시크릿)**. 근거: 이미 상주·같은 venv·외부 비노출(nginx 는 /ws/speech 만), 비용 <1ms 라 실시간 STT 와 경합 미미. 별도 pm2 는 운영 부담 대비 이득 작음. 엔진 kind enum(DB) 변경 없이 내부 어댑터로 시작.
- **결정 4 — `speech/gateway/requirements.txt` 에 pyopenjtalk 명시 수용**(설치 작업 없음, 버전 고정 0.4.1).
- **사용자 확인 필요 2건**: (a) 내 말 번역 방식 — 사용자 승인 E6-A("보낼 때마다 비동기 생성, AI 호출 증가")를 **T1(회화·채팅 응답에 userKo 필드 추가, 추가 호출 0, 턴 완료와 함께 도착)** 로 구현해도 되는지(이유: Claude CLI 단일 실행 큐라 별도 호출이 다음 회화 턴을 막아 5초 예산을 깰 수 있음) (b) **Profile 표시 설정 3칸 DB 추가**(showFurigana·showHangul·showTranslation, 추가형·손실 없음) 승인.
- 서브태스크 순서: S1(서버 분석) → [S2(설정·번역 — DB 승인·PE userKo 후)] → 화면 A(회화·채팅) / B(나머지). S1 은 사용자 확인과 독립이라 데모 승인 문장 도착 후 바로 착수 가능(화면 아님 — 서버만이면 지금도 가능).
- **사용자 확인(13:11, AskUserQuestion)**: (a) 내 말 번역 → **"같은 호출에서 함께 (Recommended)"** = T1(A1·A2 응답에 userKo, 추가 호출 0, 실패·예전 말은 재시도 API) — E6-A 의 구현 방식 변경 승인. (b) Profile 표시 설정 3칸 → **"백업 후 추가 (Recommended)"**(showFurigana true·showHangul true·showTranslation false, localStorage readingDefault 1회 이관). db push 는 S2 착수 때 백업 → push → 기록.
- 착수: S1(서버 분석, developer opus — intake 판정 유지) + PE(A1 talk·A2 chat 응답 계약 userKo 추가·replyReading 제거 검토) 병렬. 화면 A·B 는 데모 v2 게이트 approve(사용자 입력 문장) 뒤.

## Prompt-Engineer 기록 (userKo, 2026-10-04 실측)
- [13:40] **완료 — talk@v6→v7, chat@v1→v2.** 학습자 말의 한국어 번역 `userKo` 를 A1·A2 응답 계약에 추가(추가 LLM 호출 0, Developer 조사 T1). 커밋·push 안 함.
- **변경 요지**
  - 스키마(`structuredResponse/schemas.ts`): `TutorResponse.userKo: string`, `TALK_SCHEMA`·`CHAT_SCHEMA`(상속) 최상위 **required, 맨 끝 선언**(`… endOfTopic → proposals → userKo`), `minLength 1`·`maxLength 300`(지시문 권고 200자 — 넘침 허용치 100, 길게 쓴 학습자 말에서 ajv 재시도 ≈+10s 를 피함. `USER_KO_PROMPT_MAX`·`USER_KO_SCHEMA_MAX`).
  - 프롬프트: `talk.ts` 지시문 ① 키 순서 문구에 `→ userKo` ② 필드 줄 `USER_KO_INSTRUCTION_LINE`(94자: "userKo(필수): [입력] 학습자 말의 한국어 번역 — 교정하지 말고 말한 그대로(말투·높임 수준 포함), 자연스러운 한국어로(이중 높임 금지), 200자 이내.") ③ `[순서 예]` 골격 끝 `"proposals":[],"userKo":"<...>"}` — **A5·A11 교훈대로 정확한 이름을 지시 줄·골격·스키마 required·테스트 4곳에 일치**. `chat.ts` 는 같은 줄을 재사용(키 순서 지시는 CHAT 에 원래 없음). persona(`tutor.md`·`--system-prompt`)는 **무변경**(바이트 불변·예열 재사용 유지).
  - 후검증(`checks.ts`): `checkUserKoNaturalness`(이중 높임만 — replyKo 와 같은 정규식, 필드명 파라미터화) 를 TALK `extraCheck` 와 `checkChatResponse` 에 합성(재시도 대상). **비었거나 한글이 없는 값은 재시도하지 않는다**(부가 정보 때문에 12s fail-fast 를 위협하지 않음) → `sanitizeUserKo(input, userKo): string | null`(공백뿐·누락·입력 베끼기·일본어 입력인데 한글 0 → null; 일본어 없는 입력은 한글 유무 불문). `@/modules/conversation` index 에 `checkUserKoNaturalness`·`sanitizeUserKo` 공개.
  - 기존 테스트 3개(`structuredResponse`·`task006`·`task010c`)의 `TutorResponse` 리터럴에 `userKo` 한 줄, `task007` 키 순서 단언에 `userKo`, `prompts.test` 버전 단언 v7 — 계약 변경 추종뿐.
- **replyReading 판단 = 유지(제거 안 함).** grep 결과 지금도 쓰인다: ① `orchestrator/index.ts:273` 가 `ChatMessage.reading` 에 저장 ② `done` 이벤트·`useChatTurn.ts:356`·`types/chat.ts:202` ③ `MessageBubble.tsx:123` 이 말풍선 히라가나 줄로 표시(`chats/index.ts` 조회 응답에도 `reading`). 지금 빼면 새 메시지의 읽기 줄이 사라져 화면 회귀. **제거 가능 시점 = S1(서버 분석)·화면 A 가 배포돼 E1-A(후리가나가 히라가나 줄 대체)가 나간 뒤.** 그때 변경 목록(별도 PE+developer task): talk@v8·chat@v3 에서 `replyJa/replyReading/replyKo` 지시·골격·`TutorResponse`·스키마 required·`orchestrator.saveTurn`(`reading`)·`useChatTurn`·`types/chat.ts`·api-contract #32·픽스처·테스트(`task006/007/028`·`sceneCap`·`talkLength`·`lesson` 리터럴)·`jsonPathStream` 테스트 입력. 예상 이득 = 턴당 출력 −30~45 토큰(히라가나 한 줄 25~60자). 레슨·단어의 `reading` 필드는 별개(영향 없음).
- **측정(우분투 개발 미러 `~/.node-local/thekaiwa-dev-010b-ui`, haiku, 순차·2회·429 없음, `tests/live/user-ko-measure.ts` — v6 기준선은 v7 요청에서 userKo 줄·골격을 되돌리고 스키마에서 뺀 것, 교차 실행)**
  | arm | n | 성공 | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | 출력 JSON 평균자 | userKo 정리 통과 | 키워드 적중 | 이중 높임 | userKo 최대자 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | v6 기준선(TALK) | 24 | 24/24 | 23/24 | 1(u07, 번역 무관) | 3,983 | 5,027 | 344 | - | - | - | - |
  | **v7(TALK)** | 24 | 24/24 | **24/24** | 0 | **3,983** | 5,480 | 370 | 24/24 | 24/24 | 0 | 44 |
  | **chat@v2** | 4 | 4/4 | 4/4 | 0 | 4,026 | 4,514 | 325 | 4/4 | 4/4 | 0 | 14 |
  - **1차 계약 위반(스키마·후검증으로 재시도가 걸린 횟수) v7 0/24·chat 0/4 → 위반율 0%**(목표 ≤5%). v6 기준선의 1건은 userKo 와 무관(지연 7.6s, 재시도).
  - **출력 증가**: JSON 평균 +26자(≈ +20 토큰, 한국어 번역 1줄) — 지연 p50 차이 0(3,983 vs 3,983 ms), p95 +0.45s. `userKo` 가 맨 끝이라 `speech.style`→`replyJa` 조기 추출(첫 음성)·문장 단위 합성에는 영향 없고 `done` 만 위 토큰만큼 늦다. replyReading 까지 제거하면 순증 ≤0(위 추정).
  - **번역 품질**: 24/24 가 한글이 들어간 의미 일치 번역(키워드 anyOf 적중), 이중 높임 0. 1차 문구에서 반문체가 존댓말로 올라가는 사례(`ごめん、ちょっと遅れる。`→「죄송합니다. 좀 늦을 것 같아요.」)가 있어 "(말투·높임 수준 포함)"을 더해 재측정 — u09 3회 중 1회만 반말 유지(「미안해, 좀 늦을 것 같아.」), 나머지는 뜻이 맞는 존댓말(「미안해요」·「죄송합니다」). **말투 보존은 best-effort(haiku)** — 뜻은 항상 맞다. 후속 필요 시 반말 입력 판별을 코드가 헤더에 줄 수 있음(비권고, 예산).
  - **A1 예산**: 사용자 프롬프트(system+창+발화) 전형(빈 이력) 1,800자. 최악 조합(task028 예산 회귀 그리드: 무거운 헤더·altText·긴 이력 × cap 1~4 × 두 교정 모드 × N5/N1) **최대 2,975자 → 마진 25자 ≤3,000 유지**(기존 52자 → 줄·골격 +94·+17 만큼 이력 창이 메시지 1개 줄어 흡수, `WINDOW_ROOM_SLACK` 무변경). 실 CLI 요청 `promptChars`(페르소나·JSON 스키마 원문 포함) v6 3,926~7,561 → v7 +174 가량. 12s fail-fast 무변경.
- **검증**: tsc `--noEmit --incremental false` 0 · eslint(변경 파일) 0 errors · conversation 테스트 신규 `task026.test.ts` 10/10 · **전체 회귀(`src/**/*.test.ts` 1,274건) fail 0**(pass 1,271·skip 3).
- **S2 developer 인계**
  - 필드: 모델 응답(LLM 파싱 결과 `TutorResponse`) 최상위 `userKo: string`(TALK·CHAT 모두). ASK 는 아직 `FEATURE_NOT_READY` 라 해당 없음.
  - 파서 출력: **저장 전에 반드시** `sanitizeUserKo(text, data.userKo)`(`@/modules/conversation`) → `string | null`. null = 번역 실패/없음 → USER `ChatMessage.translation` 을 비워 두고 화면은 [다시 가져오기]. `data.userKo` 를 그대로 저장하지 않는다(원문 베끼기·빈 값 방어).
  - 연결 위치(developer): `orchestrator/shape.ts` `ShapedTurn` 에 `userKo` 한 칸 추가 → `saveTurn` 같은 트랜잭션에서 `tx.chatMessage.update({ where:{id:a.userMessage.id}, data:{translation} })` · `done` 이벤트에 내려줄 필드명·api-contract #32 `done` 갱신. TALK 조기 음성 경로(`jsonPathStream`)는 `userKo` 를 보지 않으므로 무변경.
  - 해당 없는 것(이 요청 범위 밖): 번역 재시도 API 의 단건 haiku 프롬프트(작은 번역 모듈)는 **아직 만들지 않았다** — 이력서 S2 목록에 PE 선행으로 적혀 있으니 Leader 가 별도로 지시해 주세요(`userKo` 줄 문구 재사용 가능). `npm run prompts:sync`(Registry `PromptVersion` talk@v7·chat@v2)는 배포 전 developer/Leader 몫(미실행).
  - 주의: `TutorResponse.userKo` 가 required 라 `TutorResponse` 리터럴을 만드는 다른 테스트·목은 `userKo` 가 필요하다(이번에 고친 3곳 외 `as unknown as`/캐스트 사용 파일은 영향 없음).
- 스크래치: `~/.node-local/thekaiwa-dev-010b-ui/scratch/uko-budget.ts`(저장소 밖). 결과 JSON `/tmp/kaiwa-user-ko-measure.json`. dev 서버는 띄우지 않았다(어댑터 수준 측정).
- 함정 기록: 작업 중 `git stash -- <경로>` 를 한 번 실행했다가 즉시 `pop` 으로 복원(내 파일만, 몇 초 — 충돌·유실 없음). 다른 에이전트가 같은 작업 트리에서 일하는 동안 stash 는 쓰지 말 것.

## Reviewer 기록

### REV-086 — task-026 S1(서버 형태소 분석)·PE(userKo), 2026-10-04 13:44 실측
- **판정: CONDITIONAL_PASS** (Critical 0 · High 1 · Medium 3 · Low 4). High 1 은 임계(≤1)에 걸리지만 "틀린 발음을 보이지 않는다"는 task 핵심 원칙 위반이 실측 재현돼 Strict 로 한 단계 낮춘다 — H1·M1~M3 수정 뒤 경량 재검증(Reviewer)하고 QA 로 넘긴다. native_change=false(네이티브 변경 없음).
- 범위: S1 15파일(gateway text.py·server.py·requirements·test_text, engine text 파사드·어댑터, speech/reading, route #24r, api-contract, eslint) + PE 11파일(talk@v7·chat@v2 userKo, schemas·checks, 테스트·픽스처·live 스크립트). 화면 파일 0.
- **재실행(미러 `~/.node-local/thekaiwa-dev-010b` rsync, NFS 무수정)**: tsc `--noEmit --incremental false` 0 · `eslint .` 0 errors(경고 5 = 기존 set-state-in-effect) · 새 테스트 reading 9 + task026 10 = **19/19** · 전체 회귀 **1283건 pass 1280 / fail 0 / skip 3** · gateway(스크래치 복사본, dev venv) pytest **71/71**·ruff·format·mypy 0.
- **변이(미러·스크래치만, cmp 원복 확인)**: TS 6건(redirect manual→follow · 실패 쿨다운 제거 · sanitize 입력 베끼기 검사 제거 · 실패를 빈 배열로 캐시 · 루비 join 검증 제거 · surface==원문 검증 제거) 전부 1 fail 로 사망 · Python 2건(`/text/annotate` 시크릿 검사 제거 · 제어 문자 skip 제거) 사망 · eslint 2건(client.ts 가 infra import · 컴포넌트가 `speech/reading` 루트 import) 둘 다 error. 표본 밖 검증: 승인 데모 `HG.convert(p,'A','B')` 대 `kanaToHangul` **무작위 200,000 입력 차이 0**, gateway 적대 입력(400자 교차 혼합·숫자·반각·이모지 등 15종) 최대 11ms, 시드 단어·표현 110쌍 읽기 대조 109 일치.
- 데모 게이트: `check.mjs check` → **DEMO_GATE_BLOCKED**(task-026 status=review_requested, 사용자 승인 미기록 — 10:45 결정은 본문에만 있고 `approve` 미실행). 이 묶음은 화면 코드가 없어 영향 없음, **화면 A·B 착수 전 Leader 가 approve 기록 필요**. evidence.jsonl 에 에이전트가 쓴 v2 승인·waive 흔적 없음(task-026 마지막 줄 = 10-01 v1).
- **발견**
  - **H1 (HIGH)** `speech/gateway/kaiwa_gateway/text.py` `annotate_one` — 문장 끝 「静か」가 형태소 분석기에서 `静`(形容動詞語幹, read シズカ) + `か`(終助詞, カ)로 쪼개져 **틀린 후리가나 `静{しずか}か`·발음 `シズカカ`→한글 「시즈카까」**를 그대로 내보낸다. 재현: `この町は静か`·`とても静か`·`静か`·`この町は静か。`(`静かです`·`静かな` 처럼 뒤에 이어지면 정상). 라이브러리 자체 `g2p` 도 シズカカ 라 실패 신호 없음. 시드 단어(words-n5 「静か」)가 유일한 불일치였다. 원칙(추정으로 틀린 발음을 보이지 않는다·애매하면 숨김) 위반, 개발자 8/8 실측은 이 패턴을 못 봤다. 권고: 노드 read 가 다음 노드 read 로 끝나고 그 가나가 노드 표면형에 없으면(`形容動詞語幹`+`か`) 병합하거나 그 구간 ruby/pron=null(숨김) + 회귀 테스트(위 4문장) + 같은 클래스(語幹+助詞 쪼개짐) 전수 스캔.
  - **M1 (MEDIUM)** `speech/reading/client.ts` `alignWordRuby` — 한자 묶음마다 `(.+?)` 를 이은 정규식이라 **치명적 백트래킹**. 실측: 「漢あ」×6·읽기 60자 274ms, ×8·80자 100초 초과(타임아웃). `WordEntry.surface` ≤80·`reading` ≤120(learning/vocab/words.ts)이라 사용자 단어 하나(또는 채택된 LLM 단어)가 단어장 화면을 **영구 정지**시킬 수 있다(삭제도 그 화면에서 해야 함). 지금 호출처는 없고 화면 B 가 쓸 예정. 권고: 선형 정렬(DP/그리디 + 가나 앵커)로 교체하거나 묶음 수·길이 가드 + 초과 시 null, 악성 입력 테스트.
  - **M2 (MEDIUM)** `speech/reading/index.ts` LRU — 항목 수(5,000)만 제한하고 용량 제한이 없다. 400자·400조각 문장 5,000개 ≈ **509MB 힙**(실측)이고 pm2 `thekaiwa` 는 `max_memory_restart: '512M'`(ecosystem.config.js:86, 단일 인스턴스). 인증된 사용자 1명이 분당 3,840문장(60요청×64)으로 약 1.3분에 앱 재시작을 유발할 수 있다. 권고: 조각 수 합계(예 ≤150k) 또는 JSON 문자열 크기로 상한, 초과 시 가장 오래된 것부터 제거.
  - **M3 (MEDIUM)** userKo 스키마가 **부가 필드로 본 응답을 죽일 수 있다**. `schemas.ts` `userKo` required + `minLength:1`·`maxLength:300` — 빈 문자열·누락·300자 초과는 ajv 재시도(≈+10s) 후 또 위반이면 `JsonSchemaError`(engine/json/schemaValidate.ts:414·446)로 **선생님 답 전체가 실패**한다. `checks.ts` 주석·PE 기록의 "비었거나 한글 없는 값은 재시도하지 않는다"는 공백뿐·한글 없음에만 참이고, 테스트(task026.test)도 `userKo:''`→ok:false 를 단언한다. 입력 상한이 1,000자(TURN_TEXT_MAX)라 300자 넘는 번역도 가능. 이중 높임 재시도(`checkUserKoNaturalness`)도 같은 이유로 부가 필드가 재시도를 늘린다. 권고: `minLength` 제거·`maxLength` 를 입력 상한 이상으로(또는 제거 후 `sanitizeUserKo` 에서 폐기), 문서 문구 정정, 이중 높임은 재시도 대신 폐기 검토.
  - **L1** gateway `/text/annotate`: 깊이 100,000 중첩 JSON → `RecursionError` 로 500(`except ValueError` 가 못 잡음). 시크릿 보유자만·앱이 문자열 배열만 보내 실사용 영향은 없음. `except (ValueError, RecursionError)` 권고.
  - **L2** `reading/client.ts` 머리 주석이 존재하지 않는 `speech/__tests__/readingClient.test.ts` 를 가리킨다(실제 `reading.test.ts`).
  - **L3** `api-contract` §67 응답 예시·design-spec §67 에 `userKo` 미반영(S2 에서 #32 `done` 과 함께 갱신 예정이라 추적만) — 그 전엔 "스키마 ↔ api-contract 1:1" 이 일시 어긋남.
  - **L4** 숫자 묶음 한자(`10月`·`4日`)는 `ruby=null`(한글 줄은 정상)이라 `月·日` 위 후리가나가 없다 — 설계상 "애매하면 숨김"이지만 화면 설계가 기대하는지 확인.
- **집중 검토 결과(발견 없음 포함)**
  1. 보안(S1): gateway 시크릿 상수시간 비교(sha256 다이제스트+`hmac.compare_digest`, 변형 5종 401)·본문 256KB 스트리밍/Content-Length 413·64건/400자 413·제어 문자 null·오류 본문 `{error:{code}}` 만(입력 미포함 실측)·로그 `n/chars/failed/ms` 만 — **발견 없음**(L1 제외). nginx `docs/nginx/*.conf` 는 `/ws/speech`(접두 URI 그대로 전달)만 8100 으로 프록시해 `/text/annotate` 외부 비노출, uvicorn 127.0.0.1 바인드. 앱→gateway 시크릿은 `readServiceSecretFor`(env origin 일치만)·`redirect:'manual'(변이로 검증)·응답 2MB/오류 4KB 상한·칸별 검증. `infra/secrets.ts` 항목은 고정 이름 목록 1개 추가뿐(노출 경로 신설 없음, 개발·운영 `.env` 모두 URL 존재·시크릿 ≥16자 확인 — 길이·존재만 봄). 라우트: `requireSession`·사용자당 60/분·본문 256KB·1~64건·400자·`no-store`·응답 엔진명 0.
  2. 6층·엔진명: 라우트→`@/modules/speech`→`engine.text` 파사드→`adapters/text/annotateHttp.ts`→infra. 엔진명(pyopenjtalk)은 어댑터 주석·gateway Python·requirements 에만, `openJtalkHttp` 흔적 0, `client.ts` 순수(변이로 eslint 확인). — **발견 없음**.
  3. 정확성: 한글 변환 데모와 200k 무작위 일치. 원문 정렬(전각화·숫자·소수·반각 가나·영문·이모지)·"맞출 수 없으면 null→숨김"·전용 1-스레드 executor(WS 와 분리)·LRU/실패 비캐시/30초 쉼/`available:false` 확인 — H1 외 **발견 없음**.
  4. PE: 지시줄·골격 끝·스키마 required·테스트 4곳 `userKo` 일치, 맨 끝 배치라 `jsonPathStream` 무영향(엔진 테스트 통과), tutor.md 무변경, `sanitizeUserKo` null 처리 정상. A1 예산: 무작위 60,000(헤더 60자·goal 400·이력 0~20×400·발화 1~1,000·alt·모드·cap) 중 **이력 창이 있는 경우 최대 2,904자·초과 0**, 3,000 초과 666건은 전부 창이 0개(헤더+발화만으로 초과 — 발화 무수정 정책상 기존에도 그렇다). 25자 마진은 이력 창이 메시지 단위로 줄어드는 양자화 결과라 지시문이 더 늘어도 창이 흡수한다. `replyReading` 유지 판단 **타당**(`MessageBubble`·`ChatMessage.reading` 이 아직 사용, 제거는 E1-A 출시 후 별도 task). M3 외 발견 없음.
- **QA high_risk_areas**: ① `静か` 류(문장 끝 형용동사어간+か)·숫자·날짜·소수·반각 가나·영문 혼합 문장의 후리가나/한글 실측(H1 수정 후) ② `POST /text/annotate` 실호출 — 시크릿 없음 401·65건/401자/본문 상한 413·분석기 다운 시 앱 `available:false`·30초 쉼, 외부 `https://kaiwa…/text/annotate` 가 gateway 로 가지 않는지(Next 404) ③ `/api/v1/text/annotate` 세션 없음 401·분당 61번째 429·캐시 적중 지연(사용자당 60/분 ↔ 화면 호출 빈도) ④ talk@v7·chat@v2 5초 p50·12s fail-fast 재실측과 `userKo` 비어 있음/300자 초과 응답 처리(M3 수정 후) ⑤ gateway 재기동(`deploy.sh`)·앱 먼저 나갈 때의 degrade ⑥ pm2 메모리(512M) 캐시 채우기 부하(M2 수정 후) ⑦ `alignWordRuby` 악성 단어(M1 수정 후, 화면 B 와 함께).
- 반려 횟수: 이 묶음 첫 감사(Opus developer) — Opus 승격 권고 해당 없음.

## Leader 기록 (REV-086 수용·수정 배정, 2026-10-04 13:44)
- REV-086 CONDITIONAL_PASS(H1·M3·L4) 수용 — QA 전에 H1·M1·M2·M3 수정 + Reviewer 경량 재확인.
  - developer(opus, 신규 소환): **H1** 문장 끝 「静か」 등 어간+조사 분리 오독(合併 또는 숨김 + 회귀 4문장 + 같은 계열 스캔) · **M1** `alignWordRuby` 선형 정렬 또는 그룹·길이 상한 null · **M2** 읽기 캐시 총량 상한(세그먼트/바이트) · **L1** `/text/annotate` 깊은 중첩 JSON 500 → 400 · **L2** client.ts 주석 경로.
  - prompt-engineer: **M3** userKo 스키마 `minLength` 제거·`maxLength` 상향 또는 제거, 부적합 값은 `sanitizeUserKo` 가 버림(턴 실패 금지), 테스트 갱신.
  - L3(api-contract §67 예시)는 S2 에서, L4(月·日 등 수사 한자 후리가나 없음)는 수용(숨김 원칙 — 틀린 것보다 없음).
- 데모 게이트: v2 approve 미기록(사용자 입력 문장 대기) — 화면 A·B 착수 전 필수.

## Developer 기록 (REV-086 반영, 2026-10-04 실측)
- [13:40] **체크포인트 1 — Python(H1·L1) 완료.** 완료: `speech/gateway/kaiwa_gateway/text.py`(`_absorbs_next_kana`·`_merge_split_stems` — 한자로 끝나는 노드 읽기가 다음 가나 노드로 끝나면 「표기+가나+です」 재분석으로 한 단어(같은 읽기) 확인 시 합침, 미확인 形容動詞語幹 쌍은 읽기 없는 노드로 숨김) · `server.py`(`except (ValueError, RecursionError)` → 400 BAD_JSON) · `tests/test_text.py`(+7: 실분석기 6문장·가짜 노드 합침/숨김 1, 깊이 100,000 중첩 400 단언 추가). 스크래치 사본 pytest 78/78·ruff·format·mypy 0, 변이 H1 3 fail·L1 1 fail. 시드 110쌍 수정 전 109/1 → 수정 후 110/0. 남은 일: M1(alignWordRuby)·M2(캐시 총량)·L2(주석)·TS 검증·최종 기록. 다음 첫 행동: `src/modules/speech/reading/client.ts` 읽기. 미커밋: 위 3파일.

## Prompt-Engineer 기록 (REV-086 M3, 2026-10-04 실측)
- [13:51] **완료 — M3 수정(userKo 가 턴을 죽이지 않게).** 버전 **talk@v7·chat@v2 유지**(둘 다 HEAD 에 없는 미배포 버전이고 지시문·골격 문구는 무변경, 스키마·정리 규칙만 바뀜). 커밋·push·stash 안 함.
- **판단·변경**
  - 스키마(`schemas.ts`): `userKo` 를 **required 에서 제거**, `{type:['string','null']}`·**minLength/maxLength 전부 제거**(`USER_KO_SCHEMA_MAX` 삭제, `USER_KO_PROMPT_MAX` 200 은 지시문 권고로만 유지). `TutorResponse.userKo?: string | null`. 근거: `runJsonWithRetry` 는 스키마 위반이면 1회 재시도 후 `JsonSchemaError` 라 **"두 번째 누락이 턴 실패로 이어지지 않는 구조"는 단일 스키마 경로에서 불가능**(softExtraCheck 는 extraCheck 만 완화) → required 제거. 입력 상한 1,000자라 상한도 의미가 없어 제거. **A5·A11 교훈은 유지**: 지시 줄(`userKo(필수)`)·응답 골격 `"userKo":"<...>"`·`properties` 맨 끝 선언·테스트의 이름 일치 4곳 무변경.
  - 정리(`checks.ts` `sanitizeUserKo(input, userKo: unknown)`): 던지지 않고 null 로 — ① 누락·undefined·null·비문자열·공백뿐 ② **저장 상한 초과 → 자르지 않고 null**(`userKoStoreLimit` = min(2,000, max(200, 입력길이×4)); 문장 중간에서 잘린 번역은 틀린 뜻을 보이므로 [다시 가져오기] 가 낫다) ③ 입력 베끼기 ④ 일본어 입력인데 한글 0 ⑤ **이중 높임**. `USER_KO_STORE_MAX`·`userKoStoreLimit` 공개(`checks.ts`, index 재공개는 하지 않음 — developer 가 필요하면 추가).
  - **이중 높임을 재시도 → 폐기로 전환**(Reviewer 권고 "검토" 수용): `checkUserKoNaturalness` 를 TALK `extraCheck`·`checkChatResponse` 합성에서 뺐다(replyKo 이중 높임 재시도는 그대로). 이유 = 번역은 부가 정보라 재시도(≈+10s)·턴 실패를 만들면 안 된다는 같은 원칙. 실측 0/28 이라 품질 영향 없음.
  - 주석 정정: `talk.ts`·`chat.ts` 머리 주석(required·재시도 서술), `schemas.ts`·`checks.ts` 문서 문구. 지시문 문자열은 무변경(바이트 불변).
- **테스트**(`task026.test.ts` 갱신·추가 — 10→13건, 픽스처 `talk-userko.json` sanitize 10→13건: k11 이중 높임·k12 과길이 201·k13 경계 200): 스키마(required 아님·properties 유지·길이 규칙 없음·누락/빈 값/공백/null/5,000자/이중 높임 전부 **스키마 통과**·number 타입은 위반·다른 필수 키는 그대로) · extraCheck 에 userKo 미합성(이중 높임 userKo 여도 `[]`, replyKo 이중 높임은 여전히 위반) · `sanitizeUserKo` 비문자열 11종·10만자 null · **1,000자 입력 경계**(≈1,000자 정상 번역 통과, 2,000 통과·2,001 null, 짧은 입력 한도 200/400) · TALK·CHAT 응답 전체가 1,000자 입력+초장문 userKo 로도 스키마·extraCheck 통과. `task007.test` required 단언 1줄 갱신. `tests/live/user-ko-measure.ts` 는 null 타입 수정 + 누락·빈 값 집계 줄 추가.
- **검증**(미러 `~/.node-local/thekaiwa-dev-010b-ui`, NFS `src`·`tests` rsync): tsc `--noEmit --incremental false` 0 · eslint(conversation·tests) 0 · conversation 테스트 379/379 · **전체 회귀 1,286건 pass 1,283 / fail 0 / skip 3**.
- **실 LLM 확인(위험 점검 1회, haiku, 24+4건 · 429 없음)**: required 를 뺀 뒤 모델이 userKo 를 빼먹는지 — **v7 누락·빈 값 0/24, chat 0/4**, 정리 통과 28/28·키워드 적중 28/28·이중 높임 0, userKo 최대 43자. 1차 통과 23/24(재시도 1건 = u03 `replyJa 3문장 초과` — userKo 무관), p50 3.9s·p95 5.0s(이전 v7 3.98s/5.48s 와 동등). → required 제거로 번역 누락이 늘지 않음. 결과 `/tmp/kaiwa-user-ko-measure.json`·로그 `/tmp/pe-m3-live.log`.
- **developer(S2) 인계 변경점**: ① `TutorResponse.userKo` 는 선택·null 가능 — **저장은 반드시 `sanitizeUserKo(text, data.userKo)`**(null 이면 `translation` 비움). ② `USER_KO_SCHEMA_MAX` 삭제됨(참조 없음 grep 확인). ③ `TutorResponse` 리터럴에 `userKo` 가 이제 없어도 컴파일된다.
- **남은 일**: 없음(M3 닫힘). api-contract §67 `userKo` 예시(L3)는 S2 에서 "선택·null 가능" 으로 같이 기술하도록 Leader 전달 — 스키마 1:1 요구에 `userKo` 가 required 가 아님을 명시해야 한다.
```json
{"taskId":"task-026","status":"DONE","deliverables":["src/modules/conversation/structuredResponse/schemas.ts","src/modules/conversation/structuredResponse/checks.ts","src/modules/conversation/prompts/talk.ts","src/modules/conversation/prompts/chat.ts","src/modules/conversation/__tests__/task026.test.ts","src/modules/conversation/__tests__/task007.test.ts","tests/prompts/fixtures/talk-userko.json","tests/live/user-ko-measure.ts"],"blockers":[],"risk_level":"LOW","violation_rate":0.0,"prompt_chars":{"talk_userPromptWorstCase":2975}}
```
- [13:55] **REV-086 H1·M1·M2·L1·L2 반영 완료 — Reviewer 경량 재확인 인계.** 화면 파일 0 · conversation·schemas 무접촉(PE 병렬) · commit·push·npm install·운영 접촉 없음.
  - **변경 파일 6**(모두 S1 미커밋 파일 위에 덧댐): `speech/gateway/kaiwa_gateway/text.py`(H1) · `speech/gateway/kaiwa_gateway/server.py`(L1) · `speech/gateway/tests/test_text.py`(+7건, 깊은 중첩 단언) · `src/modules/speech/reading/client.ts`(M1·L2) · `src/modules/speech/reading/index.ts`(M2) · `src/modules/speech/__tests__/reading.test.ts`(+2건).
  - **H1** `_merge_split_stems`: 한자로 끝나는 노드의 읽기가 다음 가나 노드 표기로 끝나는 쌍만 의심 → 「표기+가나+です」를 같은 분석기로 다시 돌려 첫 노드가 그 표기·같은 읽기면 합침(`静か`=シズカ → `静{しず}か`). 확인 안 되면 정상 분리(`人と`·`中か`·`赤か`)로 두되, 形容動詞語幹 쌍은 읽기 없는 한 노드로 만들어 ruby/pron null(숨김). 지연: 의심 쌍이 꽉 찬 400자(`人と、`×133) 첫 5.5ms·중앙 3.6ms, 데모 문장 0.1ms.
  - **M1** `alignWordRuby`: 정규식 → 같은 탐색 순서(앞 묶음부터 최단)의 DFS + (묶음, 읽기 위치) 실패 기억 — 다항. 저장 상한(`WORD_RUBY_MAX_SURFACE` 80·`_READING` 120) 초과는 즉시 null. 실측: 6묶음·60자 0.01ms(전 274ms) · 8묶음·80자 0.01ms(전 >100s) · 40묶음·표제어 80·읽기 120 0.03ms · 끝에서 실패 0.24ms. 무작위 3,000 입력(묶음 ≤3)에서 예전 정규식과 결과 동일.
  - **M2** 캐시 총량 상한: 단위 = 조각 수 + 루비 조각 수, `READING_CACHE_LIMITS = {entries 5,000, units 120,000}`, 넘으면 오래 안 쓴 것부터 퇴출(TTL 만료·같은 키 재설정도 단위 차감), `readingCacheStats()`(테스트·계측). **힙 실측(--expose-gc)**: 최악 400조각·조각마다 루비 5,000건 투입 → 150건·10.6MB / 루비 없음 → 300건·6.8MB / 보통 20조각 6,000건 → 3,000건·11.3MB / 긴 문자열(조각 1개·표기 400자·발음 1,200자) 5,000건 → 16.7MB. 단위당 약 93~98B. 결론: 캐시 상한 ≈ 30MB 이하(전 ≈509MB) — pm2 512M 대비 안전.
  - **L1** `except (ValueError, RecursionError)` → 400 `{error:{code:BAD_JSON}}`(입력 미포함). **L2** 머리 주석 → `speech/__tests__/reading.test.ts`.
  - **같은 계열 스캔(시드 전수 — 단어 50 + 주제 표현 60 = 110쌍, 읽기 = 루비 읽기 + 가나 표기 이어 붙임 대 시드 `reading`)**:
    | 시점 | 일치 | 숨김 | 불일치 | 불일치 목록 |
    |---|---|---|---|---|
    | 수정 전(합침 제거) | 109 | 0 | 1 | words `静か` しずか → しずかか(シズカカ) |
    | 수정 후 | **110** | 0 | **0** | — |
    - 의심 쌍(읽기가 다음 가나로 끝남) 탐지 — 시드 단어·예문·주제 표현 + na형용사 21종×3형태 + 대조 문장 7 = 230문장: 합침 확인 `静か` 계열 5건만(確か·豊か·明らか·穏やか 등 20종은 분석기가 처음부터 한 단어), 정상 분리로 남긴 것 `人と`·`国に`·`赤か`·`子供も`·`中か`. 수정 전후 출력이 바뀐 문장 = `静か` 4건뿐(나머지 226 동일).
    - **범위 밖 잔여(보고만)**: `赤か青か` 의 `青か` 를 분석기가 한 단어(セイカ)로 읽어 `青{せい}か`·セーカ 가 된다 — 노드 표기 안에 가나가 들어간 반대 방향 오분절이라 이번 합침 규칙 대상이 아니다. 시드에는 없음. 처리(사전 보정 또는 숨김 규칙) 여부 Leader 판단.
  - **실행 증빙**: gateway(스크래치 사본 `scratchpad/rev086/speech`, dev venv) `pytest tests` **78/78** · `ruff check`·`ruff format --check`·`mypy kaiwa_gateway` 0. TS 미러 `~/.node-local/thekaiwa-dev-010b`(`sync-010b.sh` rsync) `tsc --noEmit --incremental false` **0** · `eslint .` **0 errors**(경고 5 = 기존 set-state-in-effect, 변경 파일 무관) · `reading.test.ts` **11/11** · 전체 회귀 **1288 / pass 1285 / fail 0 / skip 3**(미러에 PE 진행 중 변경 포함).
  - **변이(사본·미러만, cmp 원복 확인)**: H1 합침 호출 제거 → test_text 3 fail · L1 RecursionError 제거 → 1 fail · M1 길이 상한 제거 → 1 fail · M1 실패 기억 제거 → 테스트가 60초 넘게 멈춤(timeout 종료 — 폭주 재현) · M2 총량 조건 제거 → 1 fail.
  - **Reviewer 재확인 포인트**: ① H1 합침 확인용 재분석(`frontend(joined+"です")`)이 같은 1-스레드 executor 안에서만 돈다(annotate_one 경유) — 실패·예외는 "모름"으로 처리 ② 숨김 노드는 `read=""` 라 기존 "글자인데 읽기 없음" 경로(ruby/pron null) ③ M1 결과 동일성(무작위 3,000 대조) ④ M2 퇴출 시 단위 차감 경로 3곳(TTL·재설정·퇴출) ⑤ 잔여 `青か` 판단.
  - 미커밋 파일: S1 15 + 위 6(중복 제외 시 S1 목록 안) + 이 이력서·`20-Log/2026-10-04.md`. 스크래치: `scratchpad/{h1_probe.py,h1_probe2.py,h1_scan.py,h1_seedscan.py,h1_out.py,h1_diff.py,h1_lat.py,rev086/}`.

## Leader 기록 (REV-086 반영 수용, 2026-10-04 13:55)
- developer H1·M1·M2·L1·L2 · PE M3 수용(PE 가 이중 높임 userKo 를 재시도 → 폐기로 바꾼 것도 같은 원칙이라 수용).
- **「赤か青か」→ `青{せい}か` 오분절(반대 방향)**: 시드 없음·드문 문형 → **이번엔 알려진 한계로 수용**. 후속 후보: 관리자 발음 사전(PronunciationLexicon)을 분석기에도 반영(REV/S1 Leader 판단 (b) 와 같은 건) — task-026 완료 후 별도 IMP/task 로.
- 다음: Reviewer 경량 재확인(REV-087) → Judge C2 → QA. S2 는 재확인 PASS 후 착수(같은 파일 회피).

## Reviewer 기록 (REV-087 — REV-086 반영 재확인, 2026-10-04 14:02 실측)
- **판정: CONDITIONAL_PASS** (Critical 0 · High 0 · Medium 1 · Low 3). QA 진행 가능 — 단 N1(형용동사어간 합침 규칙의 과잉 숨김)은 **수정 또는 수용 결정을 Leader 가 QA 전에** 내려 줄 것(수정은 ~10줄·테스트 1~2건). native_change=false · 화면 파일 0.
- **재실행(미러 `~/.node-local/thekaiwa-dev-010b` 를 NFS 와 rsync, NFS 무수정, 미러 cmp 일치 확인)**: tsc `--noEmit --incremental false` 0 · `eslint .` 0 errors(경고 5 = 기존 set-state-in-effect) · `reading.test.ts` 11/11 + `task026.test.ts` 13/13 · 전체 회귀 **1288 / pass 1285 / fail 0 / skip 3** · gateway(스크래치 복사본·dev venv) pytest 전부 통과·ruff check/format·mypy 0.
- **직접 재현(실 pyopenjtalk)**: 회귀 4문장 `この町は静か`·`とても静か`·`静か`·`この町は静か。` → 발음 シズカ(ruby `静{しず}か`) 4/4. 시드 단어 50 + 주제 표현 60 = **110쌍 일치 110 · 숨김 0 · 불일치 0**(개발자 주장 재현, 읽기 = 루비 읽기 + 가나 표기 이어 붙임 대 시드 reading). 정상 분리 `人と`·`中か`·`国に`·`子供も`·`赤か`·`彼は元気`·`ここは便利か`·`有名だ`·`静かです`·`静かな町` 는 합침 없이 수정 전과 동일 출력. 재분석 비용: 의심 쌍 최악 400자(`人と、`×133·`人と`×200·`国に`×200) **첫 호출 4.5~5.9ms·중앙 4.2~4.7ms**(재분석 133~201회), 64건 한 배치 ≈0.4s < 앱 시간 제한 3s — 상한 주장 재현.
- **변이(미러·스크래치 사본에서만, 매번 cmp 원복 확인)**: M2 `cacheUnits -= hit.units` 제거 → `reading.test` 총량 테스트 1 fail 로 사망 · M1 `failed[key]=1`(실패 기억) 제거 → 25초 안에 안 끝남(타임아웃 종료, 폭주 재현) · H1 숨김 조건을 `if True` 로 넓힘 → `人と話す`·`中か外か` 2 fail 로 사망(정상 분리 보호 테스트 유효).
- **발견**
  - **N1 (MEDIUM)** `speech/gateway/kaiwa_gateway/text.py:254` `_merge_split_stems` — 합침이 확인되지 않은 **形容動詞語幹 쌍을 무조건 숨겨서**, 분석기가 처음부터 맞게 나눈 일상 표현이 새로 숨는다. 실측(수정 전 정상 → 수정 후 `ruby=null·pron=null`, 문장 한글 줄 전체 숨김): `無駄だ`(`無駄{むだ}だ`·ムダダ→숨김) · `派手で`·`派手でも`·`派手であり`(ハデデ→숨김) · `見事と` · `身近か`(비사전어 `高価か`·`平和わ` 등 포함, 9,768문장 스캔에서 총 24건 diff 중 실문장은 이 계열). 틀린 발음이 아니라 **숨김 방향이라 핵심 원칙(틀린 것보다 없음)은 지키지만**, 개발자 보고의 "수정 전후 출력이 바뀐 문장 = `静か` 4건뿐"은 230문장 표본 한정이었고 `無駄だ` 는 실사용 빈도가 높다. 원인: `静か`(분석기 불안정 — 문장 끝에선 静+か, 뒤에 です 가 오면 静か 한 단어)와 `無駄だ`(항상 無駄+だ, 안정)를 가르지 않는다. 재현 근거 노드: `静か`→[静/シズカ, か] vs `静かです`→[静か, です] (불안정) / `無駄だ`→[無駄, だ], `無駄だです`→[無駄, だ, です] (안정). **권고**: 재분석 결과(probe)가 (a) 첫 노드가 합친 표기와 같으면 합침(현재), (b) 첫 노드 표기·읽기가 원래와 같고 둘째 노드 표기가 그 가나이면(= 문맥을 바꿔도 같은 분해, 안정) **정상 분리로 두고 숨기지 않음**, (c) 그 밖(불안정인데 합침도 아님)에만 숨김. `静か`·`人と` 는 (a)·(c 아님)이라 변하지 않는다. 테스트: `test_split_stem_merge_or_hide_with_fake_frontend` 의 "unconfirmed" 케이스는 (b) 와 같은 모양([stem,ka] → probe [stem,ka,です])이라 기대값을 "분리 유지"로 바꾸고, (c) 용 가짜(probe 가 다른 분해)를 새로 넣고, 실분석기 파라미터에 `無駄だ`·`派手で` 추가. 수용하려면(숨김 방향·드묾) Leader 가 `青か` 처럼 "알려진 한계"로 기록하고 QA high_risk 로 둔다.
  - **L5 (LOW)** `reading.test.ts` M1 회귀 방지 — 실패 기억을 빼면 테스트가 실패 단언이 아니라 **끝나지 않음**(동기 폭주라 `performance.now()` 단언·node:test timeout 이 끼어들 수 없다). 지금도 잡히긴 하나(스위트가 멈춤 = 눈에 띔) 진단이 어렵다. 권고(선택): 최악 입력만 `child_process.spawnSync(process.execPath, ['--import','tsx', '-e', …], {timeout: 5000})` 로 돌려 `status===0` 을 단언, 또는 정렬 함수에 탐색 횟수 카운터 훅을 두고 상한(예 n×len² 이하)을 단언. 필수 아님.
  - **L6 (LOW)** `schemas.ts:148` `userKo: { type: ['string','null'] }` — 같은 파일의 모든 nullable 은 `anyOf:[{type:'null'},…]` 관례다. 현재 `--json-schema` 플래그 기본 꺼짐(프롬프트 스키마 + ajv)이라 동작 영향 없음, 켤 때 CLI 가 type 배열을 받는지만 확인하면 됨(또는 관례대로 anyOf).
  - **L7 (LOW)** 알려진 한계(결함 아님 — Leader 결정): `赤か青か`→`青{せい}か`·セーカ. 보고만.
- **집중 검토 결과(발견 없음 포함)**
  1. **H1** 합침 자체 정상: 한자 끝 노드 읽기가 다음 가나로 끝나는 쌍만 의심(`_absorbs_next_kana`), 재분석 실패·예외는 "모름", 같은 1-스레드 executor 안에서만 돈다(annotate_one 경유). 4문장·시드 110쌍 재현. 비용 상한 재현. 정상 분리(名詞 쌍)는 보존(`人と`·`中か`·`国に`·`子供も`·`赤か`). 형용동사어간 쌍 숨김은 N1.
  2. **M1** `alignWordRuby` DFS+실패 기억: 같은 탐색 순서(앞 묶음부터 최단)이고 `end <= len - minRest` 가지치기는 안전. **무작위 60,000 입력(묶음 ≤5·가나 외 문자·々 포함)에서 예전 정규식과 결과 차이 0**(유효 매치 5,052건). 최악(표제어 80·읽기 120·끝 실패 포함 6종) 0.00~0.22ms. 상한(80/120) 초과 즉시 null. 재귀 깊이 ≤ 묶음 수(≤80).
  3. **M2** 총량 상한: 근거 = 단위당 힙 약 93~98B(개발자) → 최악 힙 ≈30MB 이하. 내 재측정(`--expose-gc`): 400조각·루비 → 150건·120,000단위·11.2MB / 200조각 → 200건·6.5MB / 단일 조각 400자 → 5,000건·6.0MB — pm2 512M 대비 안전. 퇴출 = Map 삽입 순서(조회 시 재삽입 → LRU), 단위 차감은 `cacheDelete` 한 곳으로 모아져(TTL·재설정·퇴출 3경로 모두 경유) 변이로 테스트가 잡음, 테스트가 `{entries:5000, units:120000}`·최악 150건 고정.
  4. **M3** `runJsonWithRetry` 는 스키마 위반(JSON 파싱·ajv)과 `extraCheck` 위반만 재시도·`JsonSchemaError` 로 이어지는데, `userKo` 는 required 아님·`['string','null']`·길이 규칙 없음 → 누락·빈 값·null·초장문·이중 높임 전부 스키마 통과, `extraCheck`(TALK = `checkTalkResponse`+`checkReplyKoNaturalness(replyKo)`, CHAT = `checkChatResponse`)에 userKo 검사 없음 → **userKo 때문에 재시도·턴 실패가 나는 경로 없음**(타입 위반 number 등만 스키마 위반 — 모델이 낼 일 없음). 지시 줄 `userKo(필수)`·응답 골격 `"userKo":"<...>"`·properties 맨 끝 유지(테스트 이름 일치 4곳) → 모델은 계속 낸다. `sanitizeUserKo`: 비문자열·공백뿐·상한 `min(2000, max(200, 입력×4))` 초과(자르지 않고 null)·입력 베끼기·일본어 입력인데 한글 0·이중 높임 → null, 어떤 입력에도 던지지 않음(`typeof` 가드 + 순수 문자열 연산). `checkUserKoNaturalness` 를 재시도에서 뺀 것은 replyKo 이중 높임 재시도에 무영향(`talk.ts:324-326` 이 `checkReplyKoNaturalness(data.conversation.replyKo)` 를 그대로 합성, task-028 테스트 통과). 호출처(`sanitizeUserKo` 저장 경로)는 S2 에서 생기므로 **그때 반드시 경유하는지** 재확인 대상.
  5. **L1** 깊이 100,000/130,000(`[`)·`{"a":`×40,000·`{"texts":`×25,000·200KB 중첩+닫힘 → 모두 **400 `{"error":{"code":"BAD_JSON"}}`**, 응답에 입력 일본어 없음(스크래치 사본 TestClient). 256KB 본문 상한 안에서 RecursionError 로 500 이 되는 입력 없음.
  6. 보안·6층·엔진명: 이번 반영분이 건드린 `client.ts` 는 여전히 순수(import 0·엔진명 0, reading 테스트의 정적 검사 통과), gateway 로그에 원문 없음(`n/chars/failed/ms`), 에러 본문에 입력 미포함. 발견 없음.
- 데모 게이트: `check.mjs check` → **DEMO_GATE_BLOCKED**(status=review_requested, 사용자 v2 승인 미기록 — REV-086 과 동일). 이번 묶음은 화면 코드 0이라 영향 없음. evidence.jsonl 에 에이전트가 쓴 v2 approve·waive 흔적 없음(task-026 마지막 줄 = 10-01 v1). **화면 A·B 착수 전 Leader 가 사용자 승인 문장으로 approve 기록 필요.**
- **QA high_risk_areas**: ① `無駄だ`·`派手で`·`見事と` 등 형용동사어간+조사/조동사 문장의 후리가나·한글(N1 수정 여부에 따라 "정상 표기" 또는 "숨김"을 기대값으로) ② `静か` 계열 4문장·문장 끝·뒤에 말이 이어지는 경우(`静かです`·`静かな`) 실호출 ③ 의심 쌍 다수 400자 문장 64건 배치의 gateway 지연(≈0.4s)과 앱 3s 시간 제한·30초 쉼 ④ `POST /text/annotate` 401/413/400(깊은 중첩 BAD_JSON)/503, 외부 `https://kaiwa…/text/annotate` 가 Next 404 인지 ⑤ pm2 `thekaiwa` 메모리(512M)에서 읽기 캐시 가득 채움(150~5,000건) ⑥ `alignWordRuby` 악성 단어(화면 B 와 함께) ⑦ S2 에서 `userKo` 저장이 `sanitizeUserKo` 를 반드시 경유하는지·null 일 때 [다시 가져오기]·talk@v7 5초 p50/12s fail-fast 재실측.
- 반려 횟수: Opus developer 수정분 첫 재확인 — 승격 권고 해당 없음. 변경 없음(코드 수정 0, 미러·스크래치만 변이 후 원복).

## Leader 기록 (REV-087 수용·N1 수정, 2026-10-04 14:04)
- REV-087 CONDITIONAL_PASS. **N1 은 고친다**(無駄だ 등 고빈도 표현의 한글 줄 전체가 사라지는 사용자 체감 손실) — REV-087 권고 3갈래 규칙: (a) 재분석 첫 노드 = 합친 표기 → 합침 (b) 첫 노드 표기·읽기 원래와 같고 둘째가 그 가나 → 정상 분리 유지(숨기지 않음) (c) 그 밖 불안정 → 숨김. 테스트: 가짜 프론트엔드 unconfirmed 기대값 '분리 유지'로, (c) 가짜 케이스 + 실분석기 無駄だ·派手で·見事と·身近か 파라미터, 9,768문장 재스캔 차이 목록.
- L5(M1 테스트 멈춤 방식) — 선택, 이번엔 하지 않음. L6(userKo 스키마 nullable 표기) — `--json-schema` 플래그 켤 때 맞춤(현재 기본 꺼짐), 기록만. L7 = 青か 알려진 한계.

## Developer 기록 (REV-087 N1, 2026-10-04 실측)
- [14:07] **N1 수정 완료.** `speech/gateway/kaiwa_gateway/text.py` `_merge_split_stems` — 「표기+가나+です」 재분석 3갈래: (a) 첫 노드 = 합친 표기·같은 읽기 → 합침(静か, 기존 유지) (b) 첫 노드 표기·읽기가 원래 첫 조각과 같고 둘째 노드 표기가 그 가나 → **안정된 정상 분리, 그대로 둠**(無駄だ·派手で·見事と·身近か) (c) 그 밖(다른 분해·다른 읽기·재분석 예외)인 形容動詞語幹 쌍만 숨김. (c) 는 기존과 같이 語幹 쌍에만 건다(명사 쌍 동작은 H1 이전과 동일). `tests/test_text.py`: 가짜 프론트엔드 unconfirmed → '분리 유지'(`静/シズカ`+`か`) 기대로 바꿈, (c) 가짜 3건(다른 분해 `かで|す`·다른 읽기 `セイ`·재분석 예외) 숨김 단언, 실분석기 파라미터 `赤か`·`無駄だ`(無駄{むだ}だ·ムダダ)·`派手で`(ハデデ)·`見事と`(ミゴトト)·`身近か`(身近{みぢか}か·ミジカカ) 추가 — 静か 4문장·`人と話す`·`中か外か` 회귀 유지.
- **실행 증빙**(스크래치 사본 `scratchpad/dev087n1/speech`, NFS 와 cmp 일치, dev venv `~/.node-local/thekaiwa-speech-dev`): pytest **83 passed** · `ruff check` 0 · `ruff format --check` 17 files formatted · `mypy kaiwa_gateway app.py interfaces.py` 0(※ `mypy .` 은 미수정 커밋 파일 `scripts/measure_stt.py:308` 기존 2건 — 이번 변경 무관).
- **변이**: (b) 분기 제거(`if not stable_split and …` → `if …`) → **5 fail**(실분석기 無駄だ·派手で·見事と·身近か 4건 + 가짜 프론트엔드 1건), 원복 cmp 확인.
- **재스캔**(REV-087 probe1 코퍼스 ∪ probe2 9,768문장 = 고유 **11,673문장**, 실 pyopenjtalk, H1 이전 / H1 / 이번 3자 비교): 차이 28문장.
  - H1 에서 새로 숨던 **24문장 → 전부 H1 이전과 같은 정상 표기로 복구**: 無駄だ·派手で·派手でも·派手であり·見事と·身近か·高価か·平和わ·下手た·勝手て·勝手って·苦手て(각각 단독 + 「この町は」 접두, 12×2).
  - H1 이전 대비 바뀐 것 = **静か 4문장뿐**(`静か`·`静か。`·`この町は静か`·`この町は静か。` → 静{しず}か·シズカ, H1 과 동일).
  - **숨김이 남는 문장: 0건** — 표 없음. 의심 쌍 분기 집계(위험 없는 명사 쌍 포함): (a) 4 · (b) 28 · (c) 0. 즉 이 코퍼스에서 (c) 숨김은 발생하지 않고, 남은 숨김 경로는 재분석이 흔들리거나 실패하는 語幹 쌍(가짜 테스트로만 재현)에 한정.
- 시드 110쌍(probe5): 일치 110·숨김 0·불일치 0, 静か 4문장 シズカ 4/4. 비용(probe4): 400자 최악 첫 호출 ≤4.9ms·중앙 ≤4.4ms(재분석 ≤201회) — REV-087 수치와 동일 범위.
- 남은 일: 없음(Reviewer 재확인). 미커밋: `speech/gateway/kaiwa_gateway/text.py`·`speech/gateway/tests/test_text.py`(이전 반영분 포함). TS·화면·conversation 무수정. commit·push 안 함.

## Reviewer 기록 (REV-088 — N1 재확인, 2026-10-04 14:10 실측)
- **판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 1). N1 해소. QA 진행 가능. native_change=false · 화면 파일 0 · NFS 무수정(스크래치 복사본 `scratchpad/rev088b` 에서만 실행, text.py 는 NFS 와 cmp 일치).
- **(1) 3갈래 대조**: (a) 재분석 첫 노드 = 합친 표기·같은 읽기 → 합침, (b) 첫 노드 표기·읽기 = 원래 첫 조각이고 둘째 노드 표기 = 그 가나 → 안정 분리로 두고 숨기지 않음, (c) 그 밖(다른 분해·다른 읽기·재분석 예외·빈 결과) → 숨김. REV-087 권고와 일치(a 에 "같은 읽기" 조건이 더 붙은 것은 더 보수적). **(c) 를 形容動詞語幹 쌍에 한정한 판단은 타당**: H1 이전 동작을 명사 쌍(人と·中か·国に)에 보존하고, 숨김은 H1 이 원래 노리던 語幹(静か형) 위험군에만 남긴다. 명사 쌍이 불안정하게 흔들릴 때 이중 읽기가 날 가능성은 이론상 남지만 H1 이전과 동일 동작이며 두 코퍼스에서 재현 0 — 결함 아님.
- **(2) 실분석기 직접 재현**: 静か·静か。·この町は静か·この町は静か。·とても静か 5형 → シズカ(ruby 静{しず}か) 전부, 静かです·静かな町 정상. 無駄だ=無駄{むだ}+だ(ムダ·ダ)·派手で/でも/であり·見事と·身近か·高価か·平和わ → 분리 유지 정상 출력(숨김 0). 人と·中か·赤か·国に·子供も·彼は元気·ここは便利か·有名だ·人と話す·中か外か 분리 유지. 알려진 한계 `赤か青か`→青{せい}か·セーカ 그대로(L7).
- **(3) 재스캔(독립 코퍼스)**: Developer 의 probe1/probe2 원본이 스크래치에 남아 있지 않아(코퍼스 빌더 부재) 동일 11,673문장은 못 맞췄고, 대신 내가 시드(단어 50·주제 표현·tests JSON) + 형용동사어간 76종 × 접미 17 × 접두 3 으로 **3,989문장**을 새로 만들어 H1 이전 / H1(`text_h1.py`) / 현재를 3자 비교: 차이 42문장 = H1 이 숨겼다 복구된 36 + 静か 6(静か·静か。·とても静か·とても静か。·この町は静か·この町は静か。 — H1 이전 シズカカ → シズカ). **현재 숨김이 H1 이전 대비 늘어난 문장 0건**, 예외 0. Developer 주장(H1 숨김 24 복구 + 静か 4, 숨김 잔존 0)과 같은 패턴 — 문장 수치(28)는 코퍼스 차이로 재현 불가, 구조는 재현.
- **(4) 실행**: pytest 83 passed(`-p no:warnings`) · `ruff check` 0 · `ruff format --check` 17 formatted · `mypy kaiwa_gateway app.py interfaces.py` 0(9 files). **변이 1건**: (b) 분기 제거(`if not stable_split and …` → `if …`) → **5 fail**(실분석기 無駄だ·派手で·見事と·身近か + 가짜 프론트엔드 1), 원복 후 NFS cmp 일치. 가짜 테스트가 (a)·(b)·(c) 3종과 (c) 세 변형(다른 분해·다른 읽기·재분석 예외)을 모두 단언.
- **발견**: N1 관련 없음. **L8 (LOW, 범위 밖·기존)** pyopenjtalk 사전 한계로 `愚か`→グカ(오로카)·`密か`→ミツカ(ヒソカ) 등 어간 일부 오독이 H1 이전부터 있다(이번 변경과 무관, 코퍼스 diff 에 안 잡힘). 화면 A·B 에서 한글 줄에 노출되면 사용자 교정 대상일 수 있으니 QA 참고만.
- **QA high_risk_areas**: ① 無駄だ·派手で·見事と·身近か 후리가나·한글 줄이 정상 표기(숨김 아님) ② 静か 5형 シズカ ③ 赤か青か(L7) 알려진 한계 ④ REV-087 의 ③~⑦ 그대로 승계(400자 64건 배치 지연·`/text/annotate` 401/413/400/503·pm2 512M 캐시·S2 userKo 저장 경유).
- 데모 게이트: 이번 변경은 화면 코드 0. v2 승인 기록은 REV-087 과 동일(Leader 가 화면 A·B 착수 전 기록 필요). 반려 횟수: 0(N1 첫 재확인 통과).

## Codex 검토 (C2, adversarial-review, focus=security)

### [2026-10-04 14:20] C2 adversarial-review focus=security — done
- judge 판정: 2026-10-04 14:11 codex_gate/C2 engine=jev · 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=bff6192(HEAD_fallback) snapshot=142cfb6d
- **⚠ base_source=HEAD_fallback**: base_ref(055dbcf)가 이미 작업 트리에 커밋되어, 검토 대상이 HEAD(bff6192)로 재설정되었습니다. REV-088 이후 변경이 있을 경우 일부 누락되었을 수 있습니다.
- 지적 2건:
  - [high] speech/gateway/kaiwa_gateway/text.py:374 `TextAnnotator.annotate` — 인증된 사용자의 동시 burst가 max_workers=1 ThreadPoolExecutor 에 쌓임, 큐 상한·세마포어 없음 → 단일 계정이 최대 154만 자 분석 작업을 한 번에 제출 가능하여 정상 사용자 읽기 타임아웃·gateway 메모리·프로세스 재시작 가능(DoS) (권고: gateway 진입점에 명시적 bounded queue/semaphore 추가 + 포화 시 429/503, 앱도 사용자 제한과 별도로 전역 동시 실행·대기 상한 + 요청당 문자 수 상한 + 부하 테스트 추가)
  - [medium] src/modules/infra/secrets.ts:231 `serviceSecretOrigin` — SPEECH_GATEWAY_URL이 원격 평문 HTTP 허용(envOrigin이 임의 호스트의 http/https 모두 인정) → 요청 헤더 검증(origin 일치)만 있고, 설정 오류 시 내부 공유 시크릿(X-Internal-Secret)과 사용자 원문이 네트워크 도청·변조 위험 (권고: HTTP는 loopback(127.0.0.1) 만 허용, 원격은 HTTPS만 / 양방향 시크릿을 분리하거나 HTTPS 강제 + 운영에서 loopback/Unix socket 고정)
- 검토하지 못한 범위: 
  - 실제 운영 서버의 적용된 nginx 설정(`docs/nginx/*.conf`)과 .env의 SPEECH_GATEWAY_URL 값(저장소 밖)
  - 실제 부하·동시성 테스트와 배포 환경 네트워크 캡처
  - pyopenjtalk 및 사전 패키지의 제3자 취약점 데이터베이스 검사
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261004T051223Z-026-C2/raw.txt`
- **지적에 대한 판단은 Reviewer가 수용/기각 결정합니다.** Codex는 읽기 전용 외부 검토이며 코드 수정을 하지 않습니다.

## Reviewer 기록 (Codex C2 지적 판정, 2026-10-04 14:19 실측) — REV-089
- **판정: CONDITIONAL_PASS** (Critical 0 · High 0 · Medium 1 · Low 1). 근거 확인 없이 채택하지 않았다 — 코드 정독 + gateway 실분석기 부하 실측(스크래치 `rev026c2/`, NFS 무수정). native_change=false · 화면 파일 0.
- **검토 대상 확인(base_ref HEAD fallback 우려)**: Codex 스냅샷 `142cfb6`(실행 시점 작업 트리 스냅샷)을 현재 작업 트리와 파일별 `cmp` — 변경·신규 **30개 전부 바이트 일치**(text.py·server.py·secrets.ts·reading/·annotateHttp.ts·route.ts·schemas/checks·테스트·픽스처 포함, REV-088 N1 수정 반영본). `git diff --stat 142cfb6` 의 삭제 표시는 untracked 신규 파일이 index 에 없어서일 뿐 내용 차이 아님. → "REV-088 이후 변경 누락" 우려 **해당 없음**, 지적은 최신 코드 기준이다.

| # | Codex 지적 | 판정 | 심각도(재평가) | 근거 |
|---|---|---|---|---|
| 1 | [high] gateway `text.py:374` 무제한 대기열 DoS | **채택(부분 — 심각도 하향, 수정안 조정)** | **MEDIUM** | 아래 실측. 큐 상한 없음·동시 burst 로 정상 사용자 분석이 밀리는 것은 사실. 그러나 메모리·재시작·실시간 STT 정지 주장은 실측으로 반박. 실제 문제는 gateway 대기열보다 **앱의 프로세스 전역 30초 쉼(cooldown)이 증폭기**라는 점 |
| 2 | [medium] `secrets.ts:231` 원격 평문 HTTP 허용 | **수용(기각 — 변경 불필요)** | LOW(조치 없음) | 운영·개발 `SPEECH_GATEWAY_URL` = `http://127.0.0.1:8100`(loopback, 스킴·호스트 종류만 확인). 전제가 "서버 env 오설정·변조"인데 그 권한이면 시크릿 자체를 바꿀 수 있어 위협 모델이 한 단계 더 높다. 기존 관례와 동일(아래) |

### 지적 1 — 상한 계산·실측
- **입력 상한 계산**: 앱 `/api/v1/text/annotate` 사용자당 60/분(고정 창 — 창 경계에서 2초 내 최대 120건 가능, `infra/http.ts:150`) × 요청당 64문장×400자(25,600자) = 분당 154만 자(Codex 수치 정확). 앱→gateway 시간 제한 3초(`AbortSignal.timeout`) — **fetch 만 끊고 gateway 의 큐에 쌓인 작업은 취소되지 않는다**(uvicorn 은 연결이 끊겨도 핸들러를 계속 실행). 쉼은 첫 실패 *뒤에야* 걸려 동시 burst 에는 무효. gateway 본문 256KB·문장 64·400자, executor `max_workers=1` **대기열 크기 무제한**, `FAILED` 외 503 경로 없음. 앱 쪽 사용자·전역 동시 실행 상한 없음. 업로드 사용자는 초대 코드 보유자(소수)라 외부 공격이 아니라 **초대받은 사용자의 오남용·클라이언트 버그** 시나리오.
- **같은 프로세스·이벤트 루프 공유**: 예. `/text/annotate` 와 `/ws/speech` 는 한 uvicorn 프로세스·한 이벤트 루프(분석만 전용 1-스레드 executor)다. pm2 `instances:1`, `max_memory_restart 1G`(기준 330~510MB).
- **실측(실 pyopenjtalk, 12코어, 스크래치 사본)**: 64문장×400자를 **60요청 동시 제출**(= 분당 한도 전부) — ① 전형 문장: 큐 비움 **7.4s**, 요청당 ≈0.12s ② 적대 입력(`人と、`×133 — 재분석 최악): **14.7s**, 요청당 ≈0.24s ③ 120요청 적대: 29s. ④ **힙: 기준 39MB → 피크 63~66MB(+27MB)** — 큐에 쌓이는 것은 입력 문자열뿐(첫 측정에서 560~770MB 가 보인 것은 내 하네스가 결과를 쥐고 있어서였고, 결과를 버리자 소멸) → **"gateway 메모리 압박·재시작" 주장은 반박**. ⑤ **같은 루프의 지연(5ms 슬립 편차)**: p50 0.1ms · p99 15~17ms · max ≈20ms — 분석 스레드가 GIL 을 쥘 때의 흔들림이며 WS 오디오 프레임(수십~100ms 단위) 처리에는 영향이 미미 → **"실시간 음성 정지" 주장도 반박**(품질 저하는 20ms 수준).
- **실제 영향(MEDIUM)**: 한 계정이 13~25개의 최대 크기 요청(분당 한도 60 이내)을 동시에 보내면 gateway 대기열이 3초를 넘겨 앱의 시간 제한이 터지고, **`cooldownUntil` 은 프로세스 전역(`speech/reading/index.ts`)이라 모든 사용자의 후리가나·한글이 30초간 숨는다**(캐시 적중분 제외). 33초마다 한 번씩 반복하면 상시 숨김 유지 가능(분당 24~45요청, 한도 내). 핵심 기능(회화·채팅·TTS)은 영향 없음(읽기는 degrade=숨김 설계) — 그래서 High 가 아니라 Medium. 다만 이 기능은 이제 사용자 화면의 상시 요소가 되므로(화면 A·B) 수정 후 QA 로 넘기는 것이 맞다.
- **Codex 권고의 보정**: "gateway 세마포어 + 포화 시 503"만 넣으면, 공격 burst 의 초과분 503 을 앱이 *실패*로 보고 **전역 cooldown 을 걸어 증폭이 그대로 남는다.** 그래서 ① gateway 대기 상한 ② 앱 전역·사용자별 동시 실행 상한 ③ **"바쁨"은 실패가 아니라 쉼 없는 일시 degrade** 세 가지를 한 묶음으로 해야 한다.

### Developer 수정 지시 (채택분 — 지적 1, MEDIUM) — 약 40줄 + 테스트
1. **gateway `text.py` `TextAnnotator`**: 대기+실행 중 작업 수 `_pending: int`(이벤트 루프 단일 스레드라 락 불필요), 상수 `MAX_PENDING = 6`(근거: 최악 요청 0.24s×6 ≈ 1.5s < 앱 시간 제한 3s). `annotate()` 시작에서 `if self._pending >= MAX_PENDING: raise TextBusyError`, `+= 1` 후 `try/finally -= 1`(작업 예외·취소 포함). `server.py` `/text/annotate` 가 `TextBusyError` → `_text_error(503, "BUSY")`(본문 `{error:{code:"BUSY"}}`만, 로그는 `busy pending=N` 정도, 입력 없음). `NOT_READY` 와 코드로 구분.
2. **앱 어댑터 `annotateHttp.ts`**: 503 + code `BUSY` → `TextAnalyzerError('BUSY','BUSY')`(`TextFailureKind` 에 `'BUSY'` 추가, `engine/text` 의 타입 export 동기). 그 밖 503 은 기존 `UNAVAILABLE`.
3. **앱 `speech/reading/index.ts`**: (a) 모듈 전역 `inflight` 카운터, `MAX_INFLIGHT = 4`(gateway 6 보다 작게) — 넘으면 **gateway 를 부르지 않고** 캐시 적중 외 칸 null + `available:false` 반환, **cooldown 설정 금지**. (b) 사용자(소유자)별 동시 실행 `OWNER_MAX_INFLIGHT = 2`(`annotateReadings(texts, deps, ownerKey?)` 로 라우트가 `s.user.id` 전달, Map 카운트·0 이면 삭제) — 초과 시 동일 degrade. (c) `catch` 에서 `kind === 'BUSY'` 이면 **cooldown 을 걸지 않고** `available:false` 만 반환(로그는 `busy n=`). 카운터 감소는 `finally`. `TIMEOUT`·`UNAVAILABLE` 등 기존 실패는 쉼 유지(변경 없음).
4. 라우트 `route.ts`·rateLimit 60/분은 유지. 요청 계약·응답 모양·화면 변경 없음(`available:false` 는 기존 degrade 신호). api-contract #24r 에 "과부하 시 `available:false`" 한 줄 보강 권고.
- **테스트 기준**: gateway pytest — ① 가짜 프런트엔드(`threading.Event` 로 블록)로 `MAX_PENDING+3` 동시 `annotate` → 정확히 `MAX_PENDING` 개만 수락·나머지 `TextBusyError`, 해제 후 `_pending==0` 이고 다음 요청 수락 ② 프런트엔드 예외·취소 때도 `_pending` 복구 ③ 라우트 → 503 `{"error":{"code":"BUSY"}}` 와 `NOT_READY` 와의 구분 ④ 기존 83건 유지. 앱 `reading.test.ts` — ⑤ 풀리지 않는 가짜 `annotate` 로 5개 동시 호출 → 4개만 호출 5번째는 호출 없이 `available:false`·**쉼 미설정**(해제 후 다음 호출은 gateway 호출됨) ⑥ 같은 `ownerKey` 3번째 동시 호출 degrade, 다른 `ownerKey` 는 영향 없음 ⑦ `BUSY` 오류 → 쉼 없음(바로 다음 호출이 annotate 호출)이고 `TIMEOUT` → 쉼 유지(회귀 보호) ⑧ 카운터가 예외·성공 후 0 으로 복구. 변이 확인: `finally` 감소 제거·BUSY 쉼 설정 복구 시 각각 1 fail 이상으로 사망해야 함. 완료 후 **Reviewer 경량 재검증 → QA**(high_risk_areas 에 burst 시나리오 추가).

### 지적 2 — 판정 근거 (수정 불요)
- 운영 값: `SPEECH_GATEWAY_URL` = `http://127.0.0.1:8100`(개발·운영 `.env` 둘 다 loopback). gateway uvicorn 은 `--host 127.0.0.1` 바인드라 원격 주소로 바꿔도 같은 호스트 gateway 에는 닿지 않는다(주소를 바꾸려면 gateway 배치도 바꿔야 함).
- **기존 관례와 동일**: `TTS_SERVICE_SECRET` → `TTS_SERVICE_URL=http://192.168.219.100:8200`(M4, 평문 HTTP·사설망), gateway→앱 콜백 `APP_INTERNAL_URL=http://127.0.0.1:3010`. 같은 `readServiceSecretFor`·`envOrigin` 경로라 "HTTP 는 loopback 만"을 일괄 적용하면 **M4 TTS 경로가 깨진다**(사설망 HTTP). 이 정책 결정은 TheKaiwa 전체 운영 정책이라 task-026 범위 밖.
- 이미 있는 방어: 요청 본문 URL 없음·origin 이 서버 env 와 정확히 일치할 때만 시크릿 부여(`readServiceSecretFor`)·`redirect:'manual'`·자격증명 포함 URL 거부·값은 헤더에만(로그·응답·Trace 없음). env 변조 권한이 있으면 `SPEECH_INTERNAL_SECRET` 도 바꿀 수 있어 평문 HTTP 가 추가로 여는 위협이 거의 없다.
- 선택(비차단, Leader 판단): `/api/health` 점검에 "SPEECH_GATEWAY_URL 이 loopback 이 아니면 경고" 한 줄(boolean 만)을 나중에 넣을 수 있다 — 이번 수정 범위에 넣지 않는다. **LOW 로 기록만.**

### 참고 — Codex 가 못 본 범위와 내 확인
- Codex "검토하지 못한 범위": 적용된 nginx·.env 값 → 위에서 값 형태 확인(loopback), `docs/nginx/*.conf` 는 REV-086 에서 `/ws/speech` 만 8100 프록시·`/text/annotate` 외부 비노출 확인. 부하·동시성 → 위 실측. pyopenjtalk 취약점 DB 검사는 하지 않음(범위 밖, 이 라이브러리는 로컬 사전·로컬 호출만).
- 데모 게이트: `check.mjs check` → DEMO_GATE_BLOCKED(status=review_requested — v2 승인 evidence 미기록, REV-086~088 과 동일). 서버·API 묶음이라 화면 영향 없음. **화면 A·B 착수 전 Leader 가 사용자 10-04 10:45 승인 문장으로 approve 기록 필요.** evidence.jsonl 에 에이전트가 쓴 v2 approve·waive 흔적 없음(task-026 마지막 줄 = 10-01 v1).
- 반려 횟수: Opus developer, 이 묶음 Codex 채택 1건 — 승격 권고 해당 없음.

## Leader 기록 (Codex C2·REV-089 수용, 2026-10-04 14:21)
- Codex C2(adversarial-review·security, 호출 1/4) 지적 2건 → REV-089 판정 수용: **#1 부분 채택·MEDIUM**(실측: gateway 메모리·실시간 STT 영향 미미, 실제 위험은 앱 전역 30초 쉼 증폭 → 한 계정 burst 가 전 사용자 읽기 상시 숨김) → 수정 지시(gateway MAX_PENDING=6·503 BUSY / 앱 MAX_INFLIGHT=4·사용자 2·BUSY 쉼 없음 / 테스트 8종·변이 2종 — REV-089 절). **#2 수용**(운영 loopback·127.0.0.1 바인드·M4 TTS 관례, 일괄 강제 시 TTS 경로 파손) — 선택 후속: /api/health 비 loopback 경고.
- 흐름: developer 수정 → Reviewer 경량 재확인 → (C2 재판정 필요 시) → QA.

## Developer 기록 (REV-089 burst 상한, 2026-10-04 실측)
- [14:28] **REV-089 #1 수정 완료.** 지시 4항목 그대로.
  - gateway `speech/gateway/kaiwa_gateway/text.py`: `MAX_PENDING = 6`·`TextBusyError`·`TextAnnotator._pending`(+ 읽기 전용 `pending` 속성). `annotate()` 시작에서 `_pending >= MAX_PENDING` 이면 `TextBusyError`, 아니면 `+= 1` 후 `try/finally -= 1`. 주의(설계 결정): 대기 중 취소는 executor 큐에서 실제로 빠지지만 **이미 실행 중인 작업은 취소돼도 끝까지 돈다** — 1-스레드라 그 차이는 최대 1건(주석에 기록).
  - `server.py`: `except TextBusyError` → `503 {"error":{"code":"BUSY"}}`, 로그 `text annotate busy pending=N`(입력 없음). FAILED 상태 → 기존 `NOT_READY` 그대로(코드로 구분). 모듈 docstring 에 BUSY 한 줄.
  - 어댑터 `engine/adapters/text/annotateHttp.ts`: `TextFailureKind` 에 `'BUSY'`, `503 && code==='BUSY'` → `TextAnalyzerError('BUSY','BUSY')`, 그 밖 503 은 `UNAVAILABLE`. 파사드 `engine/text` 는 타입을 re-export 하므로 변경 없음.
  - 앱 `speech/reading/index.ts`: `MAX_INFLIGHT = 4`·`OWNER_MAX_INFLIGHT = 2`, `annotateReadings(texts, deps, ownerKey?)`. 쉼 검사 뒤·호출 전에 상한 검사 — 넘으면 분석기 호출 없이 `available:false`, **쉼 미설정**. `catch` 에서 `kind==='BUSY'` 면 쉼 없이 `available:false`(로그 `busy n=`). 카운터는 `finally` 감소, 사용자 Map 은 0 이면 삭제. TIMEOUT·UNAVAILABLE 등의 30초 쉼은 그대로. 테스트용 `readingInflightStats()` 추가(공개 API `speech/index.ts` 에는 안 올림).
  - 라우트 `app/api/v1/text/annotate/route.ts`: `annotateReadings(texts, {}, s.user.id)` + 주석 "동시 2건". rateLimit 60/분·요청/응답 계약 무변경.
  - `docs/design/api-contract.md` #24r 절에 과부하 한 줄(해당 줄만 Edit).
- **테스트 추가**: gateway `tests/test_text.py` +3 — ① `MAX_PENDING+3` 동시(가짜 프런트엔드 `threading.Event` 차단) → 정확히 3건 `TextBusyError`·수락 6건, 해제 후 `pending==0`·다음 요청 수락 ② 대기 중 취소 → `pending` 2→1, 실행 완료 → 0, `_run` 예외 → 0 ③ 라우트 503 `{"error":{"code":"BUSY"}}`(본문에 입력 없음 확인) ↔ FAILED 시 `NOT_READY`. TS `reading.test.ts` +3·어댑터 단언 +1 — ⑤ 전역: 동시 5호출 중 4개만 annotate, 5번째 `{items:[null],available:false}`·해제 뒤 같은 문장 바로 호출(쉼 없음) ⑥ 같은 `ownerKey` 3번째 degrade·다른 사용자 호출됨·`{global:3,owners:2}` ⑦ BUSY → 다른 사용자 다음 호출 즉시 annotate, TIMEOUT → 1초 뒤 다른 사용자 호출 안 함(쉼 유지) ⑧ 예외·성공 뒤 `readingInflightStats()` = `{global:0,owners:0}` · 어댑터 503 BUSY → kind `BUSY`.
- **실행 증빙**:
  - gateway(스크래치 사본 `scratchpad/dev089/speech`, NFS 와 text.py·server.py `cmp` 일치, dev venv `~/.node-local/thekaiwa-speech-dev`): `pytest tests` **86 passed**(기존 83 + 3) · `ruff check` All passed · `ruff format --check` 17 files formatted · `mypy kaiwa_gateway app.py interfaces.py` 0.
  - TS(미러 `~/.node-local/thekaiwa-dev-010b`, 스크래치 `sync-010b.sh`): `tsc --noEmit --incremental false` **0** · `eslint .` **0 errors**(경고 5 = 기존 set-state-in-effect, 변경 무관) · `reading.test.ts` **14/14** · 전체 회귀 `node --import tsx --test $(find src -name '*.test.ts')` **1291 tests / 1288 pass / 0 fail / 3 skip**(이 미러에는 다른 역할의 미커밋 변경도 함께 실림).
  - **변이 2종 모두 잡힘**: Python — `finally` 감소를 성공 경로로만 옮김 → `test_pending_recovers_after_error_and_cancel` 1 fail. TS — `finally` 의 `inflight--` 제거 → 5 fail(⑤⑥⑦ + 뒤 테스트 연쇄) · BUSY 분기에 `cooldownUntil = now + COOLDOWN_MS` 복구 → ⑦ 1 fail. 원복 후 NFS 와 `cmp` 일치.
- **burst 실측**(수정본 gateway 를 dev venv uvicorn `127.0.0.1:8197` 로 띄우고 실 pyopenjtalk, 앱은 미러 `speech/reading` 직접 호출, 시크릿은 임시 난수 — 스크래치 `dev089/burst.ts`, 측정 후 gateway 종료):
  | 시나리오 | 결과 |
  |---|---|
  | A. 앱 경로 — 공격 사용자 4명 × 동시 15건(60건, 최악 64문장×400자 `人と、`) | gateway 도달 **4건만**(최대 동시 `{global:4, owners:2}`), 56건은 즉시 degrade(owner 13·global 46), 1.11s 에 종료. **TIMEOUT 0 → 쉼 0** |
  | 같은 시간 정상 사용자 B(100ms 마다 새 문장) | 0.02·0.12·0.22s `hidden`(대기 없이 0~1ms 응답) → **0.33s OK**(783ms) |
  | 공격 직후 다른 사용자 C | **OK(쉼 없음)**, 카운터 `{global:0, owners:0}` |
  | B. gateway 직접(앱 상한 우회) 동시 12건 최악 | **수락 6**(295~1,619ms — 전부 3s 안) · **BUSY 6**(7~10ms 즉시) |
  | gateway 로그 | `busy pending=6` 6줄, 문장 본문 0건(`grep` 0) |
  → 수정 전에는 한 계정 burst 가 시간 초과 → 전역 30초 쉼으로 모든 사용자의 읽기를 숨겼으나(REV-089), 수정 후에는 최악 burst 에도 **시간 초과가 나지 않고 쉼이 걸리지 않아** 다른 사용자는 공격 종료 즉시(이 실측 0.33s) 정상 표시. 공격 중 다른 사용자가 잠깐 `hidden` 인 것은 전역 상한(4)의 설계된 degrade(대기 없음).
- **Reviewer 재확인 포인트**: ① gateway `annotate()` 의 검사→증가가 `await` 이전 동기 구간(이벤트 루프 단일 스레드라 경쟁 없음) ② 취소 시 실행 중 1건 과소 계수(위 주석) — 허용 판단 필요 시 확인 ③ 앱 상한 검사 위치가 **쉼 검사 뒤·캐시 적중 판단 뒤**(캐시 전부 적중이면 상한과 무관하게 `available:true`) ④ BUSY 분기는 `isTextAnalyzerError && kind==='BUSY'` 일 때만, 나머지 실패는 기존 쉼 ⑤ `ownerKey` 는 세션 user id(로그에 싣지 않음) ⑥ 엔진명 누출 테스트(기존) 통과 — 추가 문자열에 엔진명 없음. native_change=false · 화면·conversation 파일 무수정.
- 미커밋(이번 변경): `speech/gateway/kaiwa_gateway/text.py` · `speech/gateway/kaiwa_gateway/server.py` · `speech/gateway/tests/test_text.py` · `src/modules/engine/adapters/text/annotateHttp.ts` · `src/modules/speech/reading/index.ts` · `src/app/api/v1/text/annotate/route.ts` · `src/modules/speech/__tests__/reading.test.ts` · `docs/design/api-contract.md`. commit·push 안 함.

## Reviewer 기록 (REV-090 — burst 상한 재확인, 2026-10-04 14:40 실측)
- **판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 1). REV-089 #1 수정 지시 4항목 전부 충족. native_change=false · 화면 파일 0.
- **(1) 지시 대조**: gateway `MAX_PENDING=6`·`TextBusyError`·`_pending`(검사→증가가 `await` 이전 동기 구간, `try/finally` 감소)·라우트 `503 {"error":{"code":"BUSY"}}`(FAILED→`NOT_READY` 가 먼저라 코드로 구분) / 어댑터 `503 && BUSY → TextAnalyzerError('BUSY')`, 그 밖 503 은 `UNAVAILABLE` / 앱 `MAX_INFLIGHT=4`·`OWNER_MAX_INFLIGHT=2`, 쉼 검사 뒤·분석기 호출 전 상한 검사(초과 시 쉼 미설정), `catch` 의 BUSY 분기 쉼 없음·TIMEOUT·UNAVAILABLE 쉼 유지, 카운터 `finally` 복구, `ownerKey = s.user.id`(route.ts). api-contract #24r 에 과부하 한 줄. 모두 코드에서 확인.
- **(2) "실행 중 취소 시 최대 1 낮아짐" 수용**: 수용. executor 가 1-스레드라 실행 중 작업은 항상 최대 1건이고, 대기 중 취소는 concurrent future 에서 실제로 빠진다 → 과소 계수 ≤1, 시스템 내 최대 7건 × 최악 0.24s ≈ 1.7s < 앱 시간 제한 3s. 더구나 Starlette 는 클라이언트 단절로 핸들러를 취소하지 않아 실경로에서는 거의 발생하지 않는다. 결함 아님.
- **(3) 카운터·맵**: 증가는 상한 검사와 같은 동기 구간(await 없음)에서 `try` 직전 → 이중 증가·경쟁 없음. 감소는 `finally` 한 곳뿐 → 이중 감소 없음, 사용자 카운트는 `left<=0` 이면 delete 라 **맵 크기 ≤ 동시 호출 수(전역 4)**, 사용자 수만큼 키가 쌓이지 않음. `inflight` 음수 경로 없음(증가 없이 finally 에 도달 불가 — 상한 초과 반환은 `try` 이전).
- **(4) 로그**: gateway `busy pending=N`·앱 `n=건수`/`global|owner` 뿐, 문장·ownerKey·사용자 id 로그 0. 오류 본문 코드만. 신규 문자열·`speech/reading`·`engine/text`·route 에 엔진명 grep 0.
- **(5) 재실행(스크래치 사본·미러 — NFS 무수정)**: gateway pytest **86 passed** · ruff check/format 0 · mypy 0. TS 미러 rsync 후 tsc **0** · eslint **0 errors**(경고 5 = 기존) · `reading.test.ts` **14/14** · 전체 회귀 **1291 tests / 1288 pass / 0 fail / 3 skip**.
  - **변이 5종 직접 수행(미러·스크래치 사본에서 하고 원복, `cmp` 일치 확인)**: M1 사용자 맵 delete 제거 → 2 fail · M2 사용자 상한 제거 → 4 not-ok(테스트 11 직접 + 후속 취소) · M3 전역 상한 제거 → 해당 테스트부터 not-ok · M4 상한 초과에 쉼 설정 → 3 fail · gateway `>=`→`>` off-by-one → 2 fail. 전부 잡힘.
- **발견**: LOW 1 — `ownerKey` 미지정 호출은 사용자 상한이 없다(전역만). 현재 호출자는 route 한 곳뿐이고 항상 전달하므로 조치 불요, 신규 호출자 추가 시 전달 필요(주석 한 줄 정도 권고, 비차단).
- 데모 게이트: `check.mjs check` → DEMO_GATE_BLOCKED(status=review_requested, v2 승인 evidence 미기록 — REV-086~089 와 동일, 에이전트가 쓴 흔적 없음: evidence.jsonl 마지막 줄 task-025b). 이번 변경 화면 코드 0 이라 영향 없음. 화면 A·B 착수 전 Leader 가 승인 기록 필요.
- **QA high_risk_areas**: ① burst — 한 계정 동시 다건 요청 시 다른 사용자 읽기가 쉼 없이 즉시 복구되는지(공격 직후 정상 호출 OK) ② 전역 4 초과 시 공격 중 정상 사용자 일시 `available:false`(설계된 degrade, 대기 없음) — 화면이 숨김 후 재요청으로 회복하는지 ③ gateway 직접 동시 12건 → 6 수락·6 BUSY(즉시, 전부 3s 안) ④ `/text/annotate` 401/413/400/503 NOT_READY↔BUSY 구분 ⑤ REV-087·088 승계(400자 64건 배치 지연·pm2 512M 캐시·無駄だ·静か 5형·S2 userKo 저장 경유). 반려 횟수: 0.

## Leader 기록 (REV-090 수용 → QA, 2026-10-04 14:31)
- REV-090 PASS(Low 1 — ownerKey 필수 주석 권고, 비차단). Codex #1 채택분 반영 확인(변이 5종 검출). **C2 재판정 생략** — override 사유: 수정이 Codex 지적 자체의 처방(상한·BUSY)이고 범위가 좁으며 Reviewer 가 실측·변이로 확인, 새 공격면 없음. Codex 호출 1/4.
- QA 발주(S1 서버 분석 + userKo + burst 상한 묶음, 화면 없음).

## QA 기록 (S1·userKo 재실행, 2026-10-04 14:36~14:52 실측)
- **판정: PASS** — Critical 0 · High 0 · Medium 0 · Low 관찰 3(아래 O-1~O-3, 결함 확정 아님·Leader 판단). 이전 QA 보고는 인용하지 않고 전 항목을 이번에 직접 실행했다. 코드·prisma·speech 수정 0, deployer 인계 없음. 화면 변경이 없는 묶음이라 360/390/412·스크린샷 대상 아님(`NOT_APPLICABLE` — 이 묶음은 서버·순수 모듈만).
- **환경(재현 조건)**: NFS `src/`·`tests/` 를 미러 `~/.node-local/thekaiwa-dev-010b-ui` 에 rsync(`diff -rq` 로 NFS 와 동일 확인, 미러 자체는 보존) · dev gateway = dev venv `~/.node-local/thekaiwa-speech-dev` `uvicorn 127.0.0.1:8197`(스크래치 `run_gw_dev.py`, 운영 8100·운영 venv 미접촉) · dev 앱 = 환경변수로만 `SPEECH_GATEWAY_URL=http://127.0.0.1:8197 node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3018`(접속 `http://localhost:3018`, APP_ENV=LOCAL) · 쿠키 `QA_ACCOUNT=1`·`2`(`tests/live/qa-session.ts`, 권한 600 파일). 스크래치: `scratchpad/qa026/`(acc.ts·conc12.py·burst-app.mjs·cachemem.ts·turns.mjs).

### 1. 정확성 — `POST /api/v1/text/annotate`(dev 앱, 계정1) → 클라이언트 `toRubyMarkup`·`pronLine`·`hangulLine` 로 조립 — **PASS**
명령 `node --import tsx scratchpad/qa026/acc.ts <cookie> demo8.json`(28문장 1요청, `HTTP 200 available true n 28`, 28/28 `원문일치=true`).
| 문장 | 루비 | 발음 → 한글 |
|---|---|---|
| 静か / 静か。 | `静{しず}か` / `静{しず}か。` | シズカ → 시즈까 / 시즈까. |
| この町は静か / この町は静か。 | `この町{まち}は静{しず}か` | コノ マチワ\|シズカ → 코노 마찌와 시즈까(.) |
| とても静か | `とても静{しず}か` | トテモ シズカ → 토떼모 시즈까 |
| 無駄だ · 派手で · 見事と · 身近か | `無駄{むだ}だ` · `派手{はで}で` · `見事{みごと}と` · `身近{みぢか}か` | ムダダ · ハデデ · ミゴトト · ミジカカ → 무다다 · 하데데 · 미고또또 · 미지까까 |
| 赤か青か(알려진 한계) | `赤{あか}か青{せい}か` | アカカ セーカ → 아까까 세-까 — **青 가 あお 가 아닌 せい**(Developer 기록된 알려진 한계, 결함 아님, 재확인만) |
- **데모 v2 8문장: 루비 8/8 일치 · 발음 소리 7/8**(차이 1건 = `いいですね` 가 `イイデスネ`, 데모는 `イーデスネ` — Developer 기록과 동일, 한글 줄은 둘 다 `이-데스네`) · 구분(구절 경계)까지 정확히 **6/8**(≠ 2건 = `アクション映画` 한 악센트구·`いい` — Developer 기록과 동일, 한글 띄어쓰기 1곳 차이일 뿐 소리는 틀리지 않음).
- **숫자·날짜·소수·반각·영문 혼합 10문장 — 틀린 표시 0**(맞추거나 null): `3時に会いましょう。`→`3時{じ}に会{あ}いましょう`·サンジニ… ✓ · `1,000円です。`→`1,000円{えん}`·センエンデス ✓ · `2.5時間かかりました。`→ニーテンゴジカン ✓ · `ﾃｽﾄをします。`→반각 원문 유지·テストオ\|シマス ✓ · `ABCを読みます。`→エイビーシーオ… ✓ · `2026年10月4日は日曜日です。`→`2026年{ねん}`(月·日 후리가나 없음 = L4 숨김 원칙)·ニセンニジューロクネン ジューガツ ヨッカワ… ✓ · `TOEIC800点を取りました。`→トーイック ハッピャクテンオ… ✓ · `３人の友達と来ました。`→`３人{にん}`·サンニン… ✓ · `Wi-Fiが使えません。`→**pron null·한글 줄 null(숨김)** ✓ · `0.5キロ歩きました`→レーテン ゴキロ ✓. 추가 관찰 8문장: `1234円`→センニヒャクサンジューヨエン(よえん 정답) · `Ｗｉ-Ｆｉ`→null 등 틀린 표시 없음.
- 관찰 **O-1(Low, 결함 아님)**: 조사 を 앞 단어가 お단 모음으로 끝나면 같은 모음 반복 규칙으로 합쳐진다 — `ピアノを弾きます。`→`피아노- 히끼마스.` · `テストをします。`→`테스또- 시마스.`(실제 발음은 "piano o"). 승인 데모 `HG.convert` 와 `kanaToHangul` 이 20만 무작위 입력에서 동일(REV-086)이라 **데모 규칙 그대로**이며 S1 오류가 아니다 — 필요하면 designer·Leader 가 규칙 조정 여부 판단.

### 2. gateway 직접(127.0.0.1:8197) — **PASS**
| 항목 | 명령·원 출력 |
|---|---|
| 시크릿 없음·틀림 | `curl -X POST :8197/text/annotate` → `401` · `X-Internal-Secret: nope` → `401` |
| 정상 | `{"version":"1","items":[{"segments":[{"surface":"静か","ruby":[["静","しず"],["か",null]],"pron":"シズカ","boundary":null}]}]}` |
| 65건 / 401자 / 본문 308,679B | `{"error":{"code":"TOO_MANY_TEXTS"}} 413` · `{"error":{"code":"TEXT_TOO_LONG"}} 413` · `{"error":{"code":"BODY_TOO_LARGE"}} 413` |
| 깊은 중첩(`[`×100000) | `{"error":{"code":"BAD_JSON"}} 400` · 깨진 JSON `400 BAD_JSON` · `{"texts":[1]}`·`{"texts":[]}` `400 BAD_REQUEST` |
| **동시 12건**(최악 64문장×394자, `conc12.py`) | `{'503 {"error":{"code":"BUSY"}}': 6, '200': 6}` — BUSY 6건 각 **5ms**, 수락 6건 276·533·789·1050·1306·1563ms(전부 3s 안), 전체 1.57s · gateway 로그 `text annotate busy pending=6` 6줄, 문장 본문 0건 |
| 외부 `https://kaiwa.xn--lh0b87pnudm10a4vd.com/text/annotate` GET·POST 각 1회 | **`307 Temporary Redirect → /login?callbackUrl=%2Ftext%2Fannotate`**(`-L` 최종 200 로그인 HTML). 기대는 404 였으나 **gateway 는 외부에 노출되지 않음**(nginx 는 `/ws/speech` 만 gateway 로, 나머지는 Next 미들웨어가 처리 — 같은 방식으로 임의 경로 `/nonexist-xyz` 도 307). 비교: `/ws/speech` GET `404`, `/api/v1/text/annotate` GET `404`(운영에 미배포 라우트). 외부에서 gateway 응답 본문이 나온 경로 0 → 노출 없음 확인, 상태 코드만 기대(404)와 다르다. |

### 3. 앱 API(dev 3018) — **PASS**
- 세션 없음 `{"code":"UNAUTHENTICATED"} 401`, 잘못된 쿠키 `401`, GET `405`.
- 입력 상한(계정2): 65건 `{"code":"VALIDATION"} 400` · 401자 `400` · 400자 1건·64건 `200` · 빈 배열·비배열·비문자열·본문 없음 `400` · 308KB 본문 `400 "요청 본문이 너무 큽니다."` · XSS 문자열(`<img src=x onerror=alert(1)>静か`) `200` — 조각 `surface` 로 그대로 돌려줌(HTML 아님, 화면 렌더는 후속 화면 task 에서 텍스트 노드로 — 이번 묶음 화면 없음) · 응답 `Cache-Control: private, no-store`.
- **61번째 429**: 새 1분 창에서 계정1 61회 순차(`curl` 루프) → `60 200 / 1 429`, 이어 호출 `HTTP/1.1 429 Too Many Requests · retry-after: 60 · {"code":"RATE_LIMITED","details":{"retryAfterSec":60}}`.
- **계정1 동시 burst 12건 중 계정2 즉시 정상**(`burst-app.mjs`, 최악 64×394자, 계정2 는 100ms 간격 새 문장): 
  - 1차 14:41(첫 시도는 위 61회 직후라 계정1 이 전부 429 여서 무효로 폐기하고 창이 풀린 뒤 재실행) `계정1 {"200/available":2,"200/degrade":10}`(사용자 상한 2) · 계정2 `0.66s:200/OK/640ms 0.78s:200/OK/16ms 0.89s:200/OK/15ms 1.01s:200/OK/14ms` · 공격 직후 계정2 `OK 14ms`.
  - 2차 14:48 `계정1 {"200/available":4,"200/degrade":8}`(앞선 건이 끝나며 자리가 나 4건 통과) · 계정2 `125ms·446ms·14ms·15ms` 전부 `200/OK`(`hidden` 0), 공격 직후 `OK 12ms`. 앱 로그 `[reading] 동시 분석 상한 — 빈 결과로 대체: owner n=64`(문장·사용자 id 없음), **전역 쉼 로그 없음**. 계정2 첫 요청이 125~640ms 걸린 것은 gateway 1-스레드 큐에서 계정1 의 무거운 작업 2건 뒤에 선 것(시간 제한 3s 안, 쉼 없음).
- **gateway 다운 쉼(30초)** — 계정2, 요청마다 새 문장. (첫 시도는 PID·경로 오류로 gateway 가 안 내려가 무효였고 폐기, 아래가 재실행): `kill 2751015` 후 listener 0 확인 → `t=0s A: available=False item=null [HTTP 200 0.010s]`(앱 로그 `[reading] 읽기 분석 불가 — 빈 결과로 대체: UNAVAILABLE:ECONNREFUSED n=1`) → gateway 다시 기동(listener 1) → `t=10s B: available=False` · `t=20s B2: available=False` · **그동안 새 gateway 로그 `text annotate n=` 0줄(= gateway 를 부르지 않음, 이미 떠 있는데도 쉼 유지)** → `t=33s C: available=True segments:7`(gateway 로그 1줄) → A 문장 재요청 `available=True`(실패가 캐시되지 않음).
- 로그 위생: gateway·앱 로그에 문장 본문(`静か|休止|人と|テスト|友達`) 0건, 시크릿 값 0건. 응답 본문에 엔진명·내부 주소·포트 grep 0건.

### 4. 캐시 메모리 — **PASS**
명령 `node --expose-gc --env-file=.env --import tsx scratchpad/qa026/cachemem.ts`(미러, 실 gateway :8197, 16문장 배치 순차, 매번 gc 2회):
```
문장 1000건 길이 min 8 p50 68 p95 278 max 374 (평균 95) · 한도 {"entries":5000,"units":120000}
요청 63배치(16문장) available=63 hidden=0 · 1.0s · 캐시 {"entries":833,"units":119920}
heapUsed 전 20.2MB → 후 36.0MB · 차이 15.8MB (rss 전 119 → 후 167)
추가 4,500건(총 5,500문장 투입) 후 캐시 {"entries":860,"units":119811} · heapUsed 36.3MB · 처음 대비 +16.1MB
```
→ 1,000건 +15.8MB, 5,500건까지 넣어도 +16.1MB 로 **총량 상한(units 120,000)에 묶여 증가가 멈춤**(항목 수 한도 5,000 보다 units 한도가 먼저 걸림 — pm2 512M 대비 충분).

### 5. userKo 실호출(실 Claude CLI haiku, 순차, 429 없음) — **PASS(관찰 O-3)**
- 스크립트 `ITEMS=u02,u05,u10 RUNS=1 ARMS=v7,chat CHAT_ITEMS=3 node --env-file=.env --import tsx tests/live/user-ko-measure.ts`:
  `| v7(talk) | 3 | 100% (3/3) | 1차 통과 100% | 재시도 0 | ms p50 4166 | p95 4539 | … | userKo 정리 통과 100% (3/3) | 키워드 100% | 이중높임 0 | userKo 최대자 43 |` · `| chat | 3 | 100% (3/3) | 100% | 0 | p50 4364 | p95 4380 | userKo 정리 통과 100% (3/3) | 키워드 67% (2/3) | 이중높임 0 | 최대 44 |` · `v7·chat userKo 누락·빈 값: 0/3`. 원 출력 예: `{"arm":"v7","id":"u02",…"ko":"어제 영화를 보러 갔어요."}` · `{"arm":"v7","id":"u05","ko":"내일 친구와 쇼핑을 가고 싶어요."}` · `{"arm":"chat","id":"u02","ko":"어제 영화를 보러 갔습니다."}`.
- **O-3(Low, LLM 품질 관찰)**: chat u10 1회가 `"지난주 일요일에 가족과 함께 **경주**에 가서…"` — 입력의 `京都` 를 `경주` 로 오역(정리 규칙·키워드 검사가 못 잡는 종류, sanitize 는 입력 베끼기·길이·형식만 본다). 추가 재실행 u10 chat 4회·talk 2회 → 전부 `교토`(`userko-extra.out`) — **u10 8표본 중 1건(12%)**, 턴 실패 아님. userKo 가 화면에 노출되는 S2·화면 단계에서 "참고용 번역" 표기·재시도 버튼으로 흡수 가능 여부를 Leader/PE 가 판단.
- **앱 경로 확인(실 턴 6회, 계정1, 순차)**: `scratchpad/qa026/turns.mjs` — CHAT 3턴 `accepted>status>status>status>done` 4275·4279·3471ms(p50 **4275ms**) · TALK 3턴 `accepted>status>status>status>audio>audio(>audio)>status>done` 6573·4923·4323ms(p50 **4923ms**) → **성공 6/6, 턴 실패 0, 429 없음**. `done` 키에 `userKo` 없음(저장·노출은 S2 범위 — 이번 묶음에서 기대대로 미구현, 응답 계약만 LLM 호출 단계에서 확인).

### 6. 자동 검증 — **PASS**(미러 `~/.node-local/thekaiwa-dev-010b-ui`, NFS 와 동일 확인)
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` → **`tsc exit 0`**.
- `node node_modules/eslint/bin/eslint.js .` → **`0 errors, 7 warnings`, exit 0** — 경고 5 = 기존 `react-hooks/set-state-in-effect`(DiagnosticsScreen·LearningSettings·OnDeviceDiagnosticsCard·SpeechSettings·VoiceSettings), 나머지 2 = **미러에만 있는 `scratch/m029.mjs`·`m029qa.mjs`**(저장소 파일 아님).
- `node --import tsx --test src/modules/speech/__tests__/reading.test.ts src/modules/conversation/__tests__/task026.test.ts` → `# tests 27 · # pass 27 · # fail 0`(reading 14 + task026 13).
- 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → `# tests 1291 · # pass 1288 · # fail 0 · # skipped 3`, exit 0.
- gateway(스크래치 복사본 `qa026/pycopy/speech`, `text.py` `cmp` 일치, dev venv): `pytest tests` → **`86 passed, 1 warning`** · `tests/test_text.py` `31 passed` · `ruff check` All checks passed · `ruff format --check` 17 files already formatted · `mypy kaiwa_gateway app.py interfaces.py` Success 0 issues.

### 지표(참고)
- annotate: gateway 동시 12건 수락 6 평균 지연 ≈0.9s·BUSY 5ms · 앱 경로 정상 요청 12~16ms(캐시·소문장) · 캐시 heap +16MB(상한).
- userKo 호출 지연(스크립트, 3건): talk p50 4.17s · chat p50 4.36s / 앱 턴(3건): CHAT p50 4.28s · TALK p50 4.92s. 30턴 p95·세트 소요는 이 묶음 범위 아님(`NOT_VERIFIED`).

### 육안·실서비스 확인 필요(NOT_VERIFIED)
- 운영 배포 후 gateway 재기동·`pyopenjtalk` 운영 venv 실행(운영 venv 는 이번에 미접촉) — 배포 시 deployer 스모크.
- 화면(후리가나 `<ruby>`·한글 줄·XSS 리터럴 렌더, 360/390/412) — 화면 A·B 단계(데모 v2 approve 가 `check.mjs` 에 아직 미기록: REV-090 와 동일 상태).
- userKo 저장·노출(S2) · 실기기.

### 정리
- 프로세스: dev 앱(실제 PID 2752231)·dev gateway(2756070 — 처음 2751015 는 kill 후 재기동분) 종료, `ss -ltn` 3018·8197 listener 0(운영 3010·8100 은 내 것이 아니며 그대로). 쿠키 파일 `c1`·`c2`·시크릿 파일 삭제, 미러에 놓았던 `qa026-cnt.mjs`·`qa026-clean.mjs` 삭제, `/tmp/qa-artifacts/TheKaiwa/task-026` 빈 폴더 삭제(스크린샷 0). 미러 `thekaiwa-dev-010b-ui` 는 지침대로 보존.
- DB(QA 계정1, 정확한 id): Chat `cmutedqij0001w1mv9jc8od8n`(CHAT)·`cmutee087000fw1mvqx3465p9`(TALK) — ChatMessage 12·Correction 1(cascade) + 같은 id 를 참조한 LearningObservation 1·RequestTrace 6 삭제, 삭제 후 재조회 `{"chat":0,"chatMessage":0,"correction":0,"obs":0}`. Utterance·TutorProposal·AiJob·StudyLog 는 0건이라 삭제 없음. 남은 것: TALK 턴이 만든 TTS 캐시 wav 3개(`files/thekaiwa/tts-cache/{ba,9c,db}/…`, 내용 해시 캐시라 만료 정리 대상 — 일부러 두었음).

## Leader 기록 (QA 재실행 PASS 수용 → S2 착수, 2026-10-04 14:51)
- 첫 QA(Haiku)는 근거 없는 PASS·기록 0 이라 반려, Sonnet 재실행 PASS(6항목 실행·원 출력 기록) 수용.
- 관찰 판단: 외부 /text/annotate 307(미들웨어 로그인 리다이렉트 — gateway 비노출) 수용 · **O-1** 조사 を 앞 お단 장음 합침(`ピアノを`→`피아노-`)은 승인 데모 규칙에도 있는 결함이지만 실제 소리와 달라 **S2 에서 수정**(조사 を 의 オ 는 장음으로 합치지 않음 — 데모 대비 사소한 개선, 화면 모양 무변경) · **O-3** userKo 오역 1/8(京都→경주)은 LLM 품질 한계로 수용, 화면 단계에서 "참고 번역" 표기 검토.
- **S2 분할**: developer(opus) = Profile 3칸 스키마(+migrate diff SQL 미리보기, db push 는 Leader 가 백업 뒤) · preferences API 노출 · userKo 저장(sanitizeUserKo 경유)·done 이벤트·api-contract · 재시도 API · O-1 수정 / prompt-engineer = 재시도용 단건 번역 프롬프트 모듈(userKo 규칙 재사용).

## Developer 기록 (S2 서버, 2026-10-04 실측)
- [14:58] **체크포인트 1 — (a) Profile 3칸·preferences·O-1 완료.** 완료: `prisma/schema.prisma`(Profile `showFurigana/showHangul @default(true)`·`showTranslation @default(false)`) · `docs/design/domain-model.md`(Profile 블록·규칙 6) · `src/modules/preferences/validate.ts`(`PROFILE_KEYS`+3·`DISPLAY_KEYS`·불리언만, 그 밖 400 `VALIDATION:boolean`) · `preferences/index.ts`(`PROFILE_SELECT`+3) · `preferences/__tests__/validate.test.ts`(+1) · `speech/reading/client.ts`(O-1 — `hangulLine` 이 조사 を 조각을 ヲ 표식으로 넘기고 변환기는 ヲ 를 장음으로 합치지 않음) · `speech/__tests__/reading.test.ts`(+1). `prisma validate` OK · `migrate diff`(아래 SQL) 파괴적 변경 0. 미러는 **새 전용 미러 `~/.node-local/thekaiwa-dev-026s2`**(아래 주의). 남은 일: (b) userKo 저장·done·재시도 API·tasks.ts·api-contract·design-spec §67·테스트·전체 검증. 다음 첫 행동: `orchestrator/shape.ts` `ShapedTurn.userTranslation`. 
  - **주의(함정)**: 기존 미러 `thekaiwa-dev-010b`·`-010b-ui` 의 `node_modules` 는 공유 `~/.node-local/thekaiwa/node_modules` 심볼릭 링크다 — 거기서 `prisma generate` 하면 **공유 생성 클라이언트가 db push 전 칼럼을 SELECT** 해 다른 미러·에이전트의 live 스모크(`prisma.profile.update` 등 select 없는 쿼리)가 깨진다. 그래서 S2 는 `@prisma/client`·`.prisma` 만 개별 복사한 미러(`scratchpad/sync-026s2.sh`)에서 generate 했다(공유 클라이언트 `showFurigana` 0건 확인).
  - migrate diff(`prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, 접속 문자열은 .env 에서만 읽음·출력 안 함):
    ```sql
    -- AlterTable
    ALTER TABLE `Profile` ADD COLUMN `showFurigana` BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN `showHangul` BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN `showTranslation` BOOLEAN NOT NULL DEFAULT false;
    ```
    → 추가 3칸뿐(DROP·타입 변경·다른 테이블 drift 0).
  - 미커밋: 위 7파일.
- [15:06] **체크포인트 2 — (b) 점검 완료(신규 developer 이어받음, 직전 developer maxTurns 종료).** 직전 developer 가 작성한 (b) 코드를 diff 로 전부 확인 — 범위 누락 없음. `ChatMessage.translation`(String? Text) 은 기존 칸이라 (b) 는 스키마 변경 없음. 보완 1건: `chats/translation.ts` 조회·저장이 `translationDeps.messages()` 를 거치게 바꿔 **실제 소유 조건(where)을 단위 테스트로 검사**(종전 테스트는 `loadMessage` 를 통째로 바꿔 끼워 where 에서 userId 를 빼도 통과했음) + 테스트 1건 추가. 남은 일: 전체 회귀·변이·완료 기록. 미커밋: (a) 7파일 + (b) 아래 표.
- [15:08] **완료 — S2 서버((a)+(b)).** commit·push·db push·npm install 안 함. 화면 파일 무접촉.
  - **(b) 변경 파일**
    | 파일 | 내용 |
    |---|---|
    | `src/modules/conversation/orchestrator/shape.ts` | `ShapedTurn.userTranslation` = `sanitizeUserKo(text, data.userKo)`(ASK 는 null) — 모델 값 직접 저장 없음 |
    | `src/modules/conversation/orchestrator/index.ts` | `saveTurn` 본문을 `saveTurnTx(tx, …)` 로 분리(테스트용) · USER 행 갱신(번역 + 교정 표시 메타)을 **같은 트랜잭션 1회 update** 로 합침(교정 시 관측 기록보다 먼저 — 종전 순서) · null 이면 USER 행 무접촉 · `done.userTranslation` |
    | `src/modules/conversation/chats/translation.ts`(신규) | `retryUserTranslation(userId, chatId, messageId)` + `translationDeps`(DB·LLM 경계, `messages()` 로 실제 where 테스트 가능) |
    | `src/modules/conversation/chats/index.ts` | `runningChatIds` export(턴 진행 중 409 판정 재사용) |
    | `src/modules/conversation/index.ts` | `retryUserTranslation`·`UserTranslationResult`·`checkUserKoNaturalness`·`sanitizeUserKo` 공개(PE 의 userTranslation export 2줄 포함) |
    | `src/app/api/v1/chats/[id]/messages/[messageId]/translation/route.ts`(신규) | #32t POST — `requireSession` + `rateLimit(user-translation:<uid>, 20/분)` + `no-store` |
    | `src/modules/engine/router/tasks.ts` | `userTranslation: { tier:'fast', timeoutMs:15_000, lane:'interactive' }`(retryOnTimeout 없음, homeM4 allowedTasks 미추가) |
    | `src/modules/conversation/__tests__/task026s2.test.ts`(신규 13건) | shape 정리·saveTurnTx 쓰기 순서/행·#32t 소유/USER만/cached/정상/경합/실패 코드/409 2종/태스크 키·**실제 where 소유 조건** |
    | `docs/design/api-contract.md` | #11~12 표시 스위치 3칸 · #24r(S1) · #29 USER `translation` · #32 `done.userTranslation` + "내 말 번역" 절(§67 `userKo` 선택·null 가능) · #32t 표 행 + 절 |
    | `docs/design-spec.md` | §67 구조화 응답에 `userKo?`(선택·null 가능, sanitize 후 저장·`done.userTranslation`) |
  - **API 모양**: `done` 에 `userTranslation: string|null`(TALK·CHAT, ASK 늘 null) · #29 대화 조회 USER 메시지 `translation`(기존 칸, 옛 행 null) · **#32t `POST /api/v1/chats/:id/messages/:messageId/translation`** 본문 없음 → `200 {messageId, translation, cached}` / 남의 것·없음·id 이상 `404` / 강사 말 `400 {reason:not_user_message}` / 본문 빈·1,000자 초과 `400 {reason:text_length}`(`UserTranslationInputError` 도 같은 400) / 턴 진행 중 `409 {reason:TURN_RUNNING}` / 같은 사용자 동시 `409 {reason:TRANSLATION_BUSY}`(프로세스 메모리) / 분당 20회 초과 `429` / 정리 폐기 `502 ENGINE_ERROR {reason:TRANSLATION_REJECTED}`(저장 0) / 엔진 `504 ENGINE_TIMEOUT`·`422 ENGINE_UNAVAILABLE`·`502 ENGINE_ERROR`. 저장은 `updateMany where {id, chatId, userId, role:USER, translation:null}` 조건부 — 그사이 저장된 값이 있으면 그 값을 `cached:true` 로(덮어쓰기 없음). 원문·번역 로그 없음.
  - **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-026s2`, `scratchpad/sync-026s2.sh` 로 NFS 동기화 — 이 미러에서만 prisma generate, 공유 클라이언트 `showFurigana` 0건 유지 확인)
    - `tsc --noEmit --incremental false` → exit **0**
    - `eslint .` → **0 errors**, 5 warnings(기존 react-hooks/set-state-in-effect, 변경 파일 무관)
    - `task026s2.test.ts` 13/13 · `userTranslation.test.ts` **13/13 skip 0**(PE 인계 대기 단언 자동 활성 — 키 이름 일치) · `reading.test.ts` 15/15 · `preferences/validate.test.ts` 7/7
    - 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **1,319 tests / pass 1,316 / fail 0 / skip 3**(skip 3 = 기존)
    - engine 이름 grep(`claude|whisper|reazon|style-bert|haiku|sonnet|qwen`) — S2 신규·변경 라우트/모듈 0건
  - **변이**(미러 사본에서만, 원복 후 NFS 와 `cmp` 일치 확인): ① 턴 저장에서 번역 저장 제거(`userRow = {}`) → **2 fail**(saveTurnTx 번역 행·메타 병합) ② 재시도 조회 where 에서 `userId` 제거 → **1 fail**(실제 소유 조건 테스트). 원복 후 13/13.
  - **Reviewer 인계(중점)**: ① saveTurn 분리 후에도 잠금 순서(사용자 → 강사 행 → USER 행 …)·`res.count===0` CONFLICT 동일한지 ② USER 행 update 1회 병합이 교정 메타 기존 동작(writeCorrectionMeta(null, meta))을 바꾸지 않는지 ③ #32t 소유자 404(조회·조건부 저장·재조회 모두 userId 포함)·USER 만·덮어쓰기 없음 ④ inFlight 는 프로세스 메모리라 blue/green 두 인스턴스 사이에서는 중복을 못 막음(조건부 저장이 최종 방어 — LLM 2회 가능성만 남음, 수용 판단 필요) ⑤ 같은 층 import: conversation → preferences(`getProfile`, index 경유 — 기존 chats/index.ts·turnContext.ts 와 같은 방식) ⑥ `prompts:sync`(PromptTemplate `userTranslation`) 미실행 — 배포 전 Leader 판단.
  - **DB**: (a) 의 Profile ADD COLUMN 3개는 **db push 전**(Leader 가 백업 뒤). 그 전에 이 코드를 운영에 내면 `PROFILE_SELECT` 가 없는 칼럼을 읽어 설정·학습자 헤더가 깨진다 → **배포는 db push 뒤**.
  - **화면 서브태스크 인계**
    - 설정 필드: `showFurigana`(기본 true)·`showHangul`(true)·`showTranslation`(false) — `GET/PUT /api/v1/settings/profile`(문서 #11~#12, **PUT 은 보낸 키만**, 불리언 외 400). 앱 전체 한 값(화면별 값 없음 — 말풍선별 [번역 ▾] 는 화면 상태).
    - localStorage 이관(화면 몫): 옛 `kaiwa.chat.readingDefault='off'` 가 있고 서버 값이 기본이면 `{ "showFurigana": false }` 1회 PUT 후 키 삭제(api-contract #11~#12).
    - 내 말 번역: SSE `done.userTranslation`(null = 없음) · 새로고침은 #29 USER `translation` · null 이면 [다시 가져오기] → `POST /api/v1/chats/:id/messages/:messageId/translation` → 200 이면 `translation` 표시, 409 `TURN_RUNNING` 은 턴 끝난 뒤 재시도, 502/504/422/429 는 "번역하지 못했어요 — 다시 시도해 주세요" 류(재시도 가능), 400·404 는 버튼 숨김. O-3 "참고 번역" 표기는 designer/Leader 판단.
    - `@/modules/speech/reading/client` O-1 변경: `hangulLine()` 이 조사 を 조각을 장음으로 합치지 않음(`ピアノを` → `피아노오`, 종전 `피아노-`) — 화면 코드 변경 불필요(함수만 쓰면 됨), 화면 스냅샷/기대 문자열이 있으면 갱신.
  - 미커밋(S2 전체): (a) `prisma/schema.prisma`·`docs/design/domain-model.md`·`src/modules/preferences/{validate.ts,index.ts,__tests__/validate.test.ts}`·`src/modules/speech/reading/client.ts`·`src/modules/speech/__tests__/reading.test.ts` + (b) 위 표 10파일(PE 파일 별도).

## Prompt-Engineer 기록 (userTranslation@v1, 2026-10-04 실측)
- [14:59] **완료 — 내 말 번역 재시도용 단건 번역 프롬프트 `userTranslation@v1`.** 커밋·push·stash 안 함. 라우트·learning·speech·engine·prisma·화면 무접촉(`engine/router/tasks.ts` 도 안 건드림 — 키만 developer 인계).
- **변경 파일**: `src/modules/conversation/prompts/userTranslation.ts`(신규) · `src/modules/conversation/index.ts`(공개 export 2줄) · `src/modules/conversation/__tests__/userTranslation.test.ts`(신규 13건) · `tests/prompts/fixtures/user-translation.json`(신규) · `tests/live/user-translation-measure.ts`(신규 실측 스크립트).
- **설계 요지**
  - A10 `wordEnrich` 와 같은 모양(대화 턴이 아니라 변환 1회): **tutor.md 를 쓰지 않고** 자체 짧은 persona(`user-translation`) — 대화·교정이 JSON 밖으로 새는 위험 제거. system 443자 + persona 85자 ≈ 530자(턴 A1 3,000자의 1/5), 전형 요청 총 ≈ 550자·최대(1,000자 입력) 1,533자.
  - 문체 규칙은 `USER_KO_INSTRUCTION_LINE`(talk.ts) **그대로 재사용** → 턴 번역과 규칙 불일치 없음. 응답 키 `userKo` 이름은 지시 줄·골격 `{"userKo":"<...>"}`·스키마 required·테스트 4곳 일치(A5·A11 교훈).
  - **스키마 `{ userKo: string(minLength 1) }`, `additionalProperties:false`, required** — 단독 호출이라 누락 = 실패이고 ajv 재시도(haiku +2~3s)가 값을 건질 기회. 길이 상한은 스키마에 없음(정리 함수가 자르지 않고 null). **extraCheck 없음**: 이중 높임·한글 없음·베끼기·과길이는 호출자가 저장 전 `sanitizeUserTranslation` 으로 거름(턴 M3 와 같은 "번역 때문에 재시도·실패 만들지 않는다" 원칙).
  - 입력 상한 = `TURN_TEXT_MAX`(1,000, 코드포인트) — 넘으면 자르지 않고 `UserTranslationInputError`(자르면 뜻이 틀어짐). 빈·공백뿐도 같은 오류. 입력은 `[입력] <text>` 메시지로만 가고 system 에는 안 섞인다. 주입 문장은 따르지 않고 그 자체를 번역(전용 문구 — `INJECTION_GUARD` 는 "한국어로 할 수 없다고 말한다" 라 번역 출력에 섞일 수 있어 안 씀).
  - **튜닝 1회**: 1차 측정에서 haiku 가 짧은 반말 의문문(`これ、いくら？`)을 존댓말로 올림(말투 보존 14/16, q2 2/2 실패) → 이 모듈에만 "반말(です·ます 없는 말, 짧은 의문문 포함)은 반말로, 존댓말은 존댓말로. 예: 何してるの？ → 뭐 해?" 줄 추가(예시는 픽스처와 겹치지 않게). 공유 줄(`USER_KO_INSTRUCTION_LINE`)은 무변경(talk@v7·chat@v2 바이트 불변).
- **측정**(우분투 개발 미러 `~/.node-local/thekaiwa-dev-010b-ui`, haiku, 순차, 429 없음, `tests/live/user-translation-measure.ts`; 미러에서 `LLM_TASKS.userTranslation` 은 스크립트가 메모리에만 fast·15s·interactive 로 주입)
  | 구분 | n | 성공 | 1차 통과(재시도 0) → 계약 위반 | 정리(sanitize) 통과 | 키워드 적중 | 이중 높임 | 말투 보존(반말·존댓말 16건) | ms p50 | ms p95 | max | promptChars 최대 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | 1차 문구(말투 줄 전) | 20 | 20/20 | 20/20 → **0%** | 20/20 | 20/20 | 0 | 14/16 | 2,264 | 2,912 | 2,912 | 767 |
  | 말투 줄 추가 후 — 7항목×3회 | 21 | 21/21 | 21/21 → 0% | 21/21 | 21/21 | 0 | 21/21 | 2,200 | 2,436 | 2,498 | 831 |
  | **v1 최종 — 10항목×2회(반말·존댓말·의문·짧은 감탄·혼합 각 2)** | 20 | **20/20** | **20/20 → 0%** | **20/20** | **20/20** | **0** | **15/16** | **2,224** | **2,575** | 2,575 | 839 |
  - 첫 호출(콜드) 2,388ms — 예열 프로세스 없음(`warm=OFF`: 자체 persona 라 talk 예열 키와 다르다 — A10 과 같음)인데도 매 호출 ≈2.2s 라 콜드 부담 없음. 위반율 0%(목표 ≤5%).
  - **번역 품질**: 이중 높임 0/61 · 의미 키워드 적중 61/61 · 말투 보존 최종 15/16(불일치 1 = `これ、いくら？` → 「이거 얼마예요?」, 말투 줄 이후 ≈40건 중 1건) → 합산 36/37. 혼합(말투 혼용) `おいしいですね。でも、ちょっと高いな。` → 「맛있네요. 근데 좀 비싼데.」(혼용 보존). 모델 한계(best-effort) — 뜻은 항상 맞고, 화면은 "참고 번역" 성격이라 수용.
  - 입력이 길면(≈200자 초과) 지시문 "200자 이내" 때문에 번역이 줄 수 있다(턴 번역과 같은 규칙) — 저장 상한(`userKoStoreLimit`)은 넘지 않는다. 학습자 발화는 대개 1~2문장이라 실측 최대 번역 ≈26자.
- **검증**(미러에 NFS `src`·`tests` rsync): tsc `--noEmit --incremental false` **0** · eslint `src tests` **0 errors**(경고 5 = 기존 set-state-in-effect, 변경 파일 무관) · `userTranslation.test.ts` 12 pass + 1 skip · **전체 회귀 1,306건 pass 1,302 / fail 0 / skip 4**(기존 3 + 아래 skip 1). 변이: 지시 줄을 `USER_KO_INSTRUCTION_LINE` 에서 빼면 2 fail · 스키마 required 키를 바꾸면 2 fail(원복·cmp 일치 확인).
- **skip 1건 = 인계 대기 단언**: `엔진 태스크 표: userTranslation = tier fast · timeout ≤ 15s · lane interactive` — `tasks.ts` 에 키가 생기면 자동으로 켜진다. **developer 가 키를 넣은 뒤 이 테스트가 skip 이 아니라 pass 인지 확인**(skip 이면 키 이름 불일치).

### developer 인계 (S2 재시도 번역 API)
- **함수**: `@/modules/conversation` 에서 `buildUserTranslationRequest({ text, level? })` → `LlmJsonRequest<UserTranslationResponse>`(`engine.llm.completeJson` 에 그대로 넘긴다 — `task`·`persona`·`system`·`messages`·`jsonSchema` 모두 채워짐, `timeoutMs`·`tier` 는 task 표 값). `text` = 내 `ChatMessage.text`, `level` = `Profile.level`(선택). 버전 상수 `USER_TRANSLATION_PROMPT_VERSION = 'userTranslation@v1'`.
- **결과 처리(저장 전 필수)**: `sanitizeUserTranslation(text, result.data)` → `string | null`. 문자열이면 `ChatMessage.translation` 저장, **null 이면 이번에도 번역 못 함**(저장 안 함·화면 [다시 가져오기] 유지, 응답 코드는 사용자 문구 "번역하지 못했어요 — 다시 시도해 주세요" 류). `data.userKo` 를 직접 저장하지 않는다. 내부적으로 `sanitizeUserKo`(턴 번역과 같은 규칙 — 입력 베끼기·한글 없음·이중 높임·과길이 폐기).
- **입력 오류**: `UserTranslationInputError`(`userMessage` 있음) — text 비었음 또는 1,000자 초과. 라우트가 400/422 로 매핑(저장된 내 발화는 이미 ≤1,000자라 보통 안 걸림). 공개 상수 `USER_TRANSLATION_TEXT_MAX`.
- **스키마**: 응답 `{ userKo: string }` 하나(required·minLength 1·`additionalProperties:false`). 위반은 `completeJson` 이 1회 재시도 후 `JsonSchemaError`.
- **엔진 태스크 키(`engine/router/tasks.ts`, developer 수정)** — 이름 `userTranslation`(상수 `USER_TRANSLATION_TASK`), 권고 `{ tier: 'fast', timeoutMs: 15_000, lane: 'interactive' }`, `retryOnTimeout` 켜지 않음.
  - tier=fast(haiku): 번역 한 문장은 실측 p50 2.2s·위반 0% 라 sonnet(balanced)의 이득이 없다. 오역 1/8 같은 LLM 한계는 tier 로 안 풀린다.
  - timeout 15s: p95 2.6s·max 2.9s 의 5배 이상 여유이면서 사용자가 버튼을 누르고 기다리는 호출이라 20s(chat·wordEnrich)보다 짧게 끊는다. 한 데드라인 안에서 JSON 재시도(+2~3s)·폴백까지 들어간다. 타임아웃 재시도(retryOnTimeout)는 두 배 대기가 되므로 켜지 않는다(A11 전용).
  - lane=interactive: 사용자가 기다리는 호출이라 batch(레슨 생성·A11)에 굶지 않게 인터랙티브 레인(`claudeCli.ts` pump 가 interactive 를 먼저 꺼냄). 워커 슬롯은 TALK·CHAT 과 공유라, 동시 요청이 많으면 큐 대기만큼 느려질 수 있음 — 호출부에서 사용자당 1건 중복 방지 권장.
  - `homeM4` `runtime.allowedTasks` 에는 **넣지 않는다**(qwen 번역 품질·말투 보존 미측정 — claude 전용). `prisma/seed.ts` `PromptTemplate` 키 목록은 선택(`reviewDecision` 도 없음) — `npm run prompts:sync` 는 배포 전 developer/Leader 몫(미실행).
  - `buildUserTranslationRequest` 의 `task` 는 `unknown` 경유 캐스트(키가 아직 없어도 컴파일되게) — 키를 넣은 뒤 `as unknown as LlmTask` → `as LlmTask` 로 줄여도 되고 그대로 둬도 동작은 같다(필수 아님).
- **api-contract**: 재시도 API 응답은 developer 가 기술. 번역 프롬프트 버전은 `userTranslation@v1`.
- 스크래치·결과: `/tmp/kaiwa-user-translation-measure.json`(마지막 실행)·`/tmp/pe-ut-live{,2,3}.log`. dev 서버는 띄우지 않았다(어댑터 수준 측정).
- **남은 일**: 없음(PE 몫 완료). 후속 판단 후보 — 화면의 "참고 번역" 표기는 designer/Leader(O-3).
```json
{"taskId":"task-026","status":"DONE","deliverables":["src/modules/conversation/prompts/userTranslation.ts","src/modules/conversation/index.ts","src/modules/conversation/__tests__/userTranslation.test.ts","tests/prompts/fixtures/user-translation.json","tests/live/user-translation-measure.ts"],"blockers":[],"risk_level":"LOW","violation_rate":0.0,"prompt_chars":{"userTranslation_systemPlusPersona":528,"userTranslation_typicalTotal":545,"userTranslation_max1000charInput":1533}}
```

## Reviewer 기록 (REV-091 — S2 서버 + PE userTranslation@v1, 2026-10-04 15:13 실측)
- **판정 PASS** — Critical 0 · High 0 · Medium 0 · Low 4. 7영역 검토 완료. 코드 수정 없음(변이는 전용 미러 `~/.node-local/thekaiwa-dev-026s2` 에서만, 원복 후 NFS 와 `cmp` 4파일 일치).
- **재실행(전용 미러, 공유 `~/.node-local/thekaiwa` 의 생성 클라이언트 `showFurigana` 0건 유지)**: tsc `--noEmit --incremental false` exit 0 · `eslint .` 0 errors/5 warnings(기존) · 관련 4파일(task026s2·userTranslation·reading·preferences validate) 48/48 skip 0 · **전체 회귀 1,319 tests / pass 1,316 / fail 0 / skip 3** — Developer 수치와 일치.
- **변이 4건(전부 잡힘, 각 1 fail)**: ① 재시도 조건부 저장 where 에서 `translation:null` 제거 ② shape 에서 ASK 의 null 강제 제거 ③ preferences `bool()` 의 타입 검사 제거 ④ O-1 의 ヲ 표식 제거(`pron` 그대로) — 모두 기존 테스트가 실패, 원복 후 48/48.
- **1 DB**: Profile 에 ADD COLUMN 3개뿐(`showFurigana`·`showHangul` DEFAULT true, `showTranslation` DEFAULT false, DROP·타입 변경 0 — Developer 의 migrate diff 와 schema 대조 일치). domain-model Profile 블록·규칙 6 과 schema 일치. **배포 순서**: `prisma.profile` 접근이 전부 `PROFILE_SELECT`(3칸 포함)·seed 뿐이라 db push 전에 이 코드를 내면 설정·학습자 헤더(`getProfile` 경유 turnContext)·SET_LEVEL 채택 트랜잭션이 깨진다 → Leader 계획대로 **백업 → db push → 배포**(추가형이라 구 코드는 새 칼럼을 모르고 DB 기본값으로 계속 동작 — 롤백도 안전).
- **2 보안·소유(#32t)**: 라우트 `requireSession` → `rateLimit(user-translation:<uid>, 20)` → 서비스. 조회·조건부 저장·재조회 3곳 모두 `(id, chatId, 세션 userId)`(실제 where 를 `translationDeps.messages()` 로 단위 검사). 남의 것·없음·id 이상(공백·40자 초과) 404 · 강사 말 400 · 본문 빈/1,000자 초과 400 · 턴 진행 409(stale PENDING 은 `isStalePending` 으로 제외 — 무한 409 없음) · 같은 사용자 동시 409(`has`→`add` 사이 await 없음) · 분당 20 429 · `translation` 이 이미 있으면 LLM 호출 없이 `cached:true` · 저장은 `role:USER, translation:null` 조건부라 덮어쓰기 없음(경합 시 먼저 저장된 값 반환). 정리 폐기 502(저장 0)·타임아웃 504·엔진 불가 422 는 `classifyError` 매핑과 일치. **blue/green 중복 방지 공백 판정: 수용** — `inFlight`·`rateLimit` 은 프로세스 메모리라 배포 겹침 구간(수십 초)에는 같은 사용자 번역 LLM 이 2회까지 돌 수 있으나 데이터는 조건부 저장이 지켜 무결하고 비용은 사용자당 분당 20·15s 상한. preferences PUT: 3칸 `boolean` 만(문자열·0/1·null·배열 400 `VALIDATION:boolean`), 화이트리스트 밖 키(`readingDefault`·`showReading`)는 `unknown_key` 400.
- **3 트랜잭션·계약**: `shapeTurnResponse` 가 `sanitizeUserKo(text, data.userKo)` 통과값만 `userTranslation` 으로(ASK 는 null) → `saveTurnTx` 가 강사 행 PENDING→DONE 갱신과 **같은 `withTransaction`** 에서 USER 행을 갱신. null 이면 USER 행 무접촉(테스트 확인). 잠금 순서(사용자 행 → 강사 행)·`res.count===0` CONFLICT 동일, 교정 메타(`writeCorrectionMeta(null, meta)`)는 USER 행 갱신 1회로 합쳐졌을 뿐 값·`recordCorrectionProposed` 보다 먼저 쓰는 순서 불변. `Correction.original`·`status` 무접촉. `done.userTranslation`(저장값 그대로)·#29 USER `translation`(MESSAGE_SELECT 가 이미 칼럼을 읽음)·#32t 표·절·§67 `userKo?` 서술이 코드와 일치. **제안→채택 원칙과 충돌 없음** — 번역은 `ChatMessage.translation`(표시용 메타) 한 칸이고 `WordEntry`·`StudyLog`·`StatsSnapshot`·학습 집계에 들어가지 않는다(채택 대상 아님).
- **4 PE userTranslation@v1**: system 에 "JSON 객체 하나만" + 골격 `{"userKo":"<...>"}`, 스키마 required `userKo`(minLength 1·additionalProperties false)와 지시·골격 키 일치, 사용자 입력은 `[입력] …` user 메시지로만(system 미혼합)·주입 문장 번역 지시, tutor.md 미사용 자체 persona(wordEnrich 와 같은 모양), 입력 상한 1,000(자르지 않고 `UserTranslationInputError`→400). `tasks.ts` `userTranslation = fast·15s·interactive`, `retryOnTimeout` 없음, home-m4 `allowedTasks`(['wordEnrich','distractorGen','chatReviewFallback'])에 없음 → claude 전용. 사용자 화면·라우트에 엔진명·model_id 0(신규 라우트·`chats/`·preferences grep 0, PE 모듈은 wordEnrich 와 같은 "Claude Code 기본 시스템 프롬프트" 주석 1건뿐 — 표시·분기 아님).
- **5 O-1**: `hangulLine` 이 `surface 가 を 하나 + pron=オ` 조각만 ヲ 표식으로 넘기고 변환기는 `wo` 모라를 장음 병합에서 제외. を 외 규칙은 코드 경로 불변(ヲ 가 없으면 이전과 동일), 공개 `pronLine` 은 데모 모양(オ) 유지, `kanaToHangul('ピアノオ|…')` 는 '피아노-' 그대로 = 데모 `HG.convert` 와의 차이는 **조사 を 한 곳뿐**. 테스트: お단+を 3종·非お단·ホン+を·단어 안 장음(とおり·おおきい)·직접 입력 `ピアノを`/`ピアノヲ` 확인, 전수 가나 표 불변.
- **6~7 운영·학습 원칙**: 원문·번역 로그 없음(설계 주석·코드 확인), 사용자 노출 문구에 엔진명 없음, `ChatMessage.translation` 은 AI 산출이지만 학습 데이터로 채택되는 값이 아니라 표시용이라 PROPOSED 대상 아님.

### 발견(전부 LOW)
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L1 | LOW | `docs/design/domain-model.md` ERD 블록(L71~)·`Profile` 요약표(L2231), `module-dependency.md` L119(preferences profile 필드 나열)·L132(conversation 공개 API 에 `retryUserTranslation` 없음) | 정본 5종 중 본문(Profile 블록·규칙 6·api-contract)은 갱신됐으나 요약 나열 3곳이 옛 목록 | 화면 서브태스크 문서 갱신 때 같이 보정 |
| L2 | LOW | `src/modules/conversation/prompts/userTranslation.ts:78` | 엔진 키가 생겼는데도 `USER_TRANSLATION_TASK as unknown as LlmTask` 캐스트가 남음(키 이름 오타를 컴파일러가 못 잡음) | `as LlmTask`(또는 `satisfies keyof typeof LLM_TASKS`)로 좁힘 — 동작 동일, 필수 아님 |
| L3 | LOW | `chats/translation.ts` | 채팅 종류(ASK 방 등)를 가리지 않고 USER 메시지면 번역(화면이 ASK 에서 버튼을 안 띄우므로 영향 없음), RequestTrace 도 안 남겨 이 호출의 지연·실패는 로그(건수)로만 보임 | 화면 단계에서 ASK 버튼 비노출 확인, Trace 는 운영에서 필요해지면 후속 |
| L4 | LOW | `prisma/seed.ts` PromptTemplate 키 목록(A10 `wordEnrich` 는 있음) | `userTranslation` 이 Prompt Registry(`prompts:sync`)에 없음 — Console 에서 안 보임(`reviewDecision` 도 같은 상태라 회귀 아님) | 배포 전 Leader 가 키 추가·`prompts:sync` 여부를 정함(PE·Developer 인계서 ⑥ 와 동일) |

### QA 인계
```json
{ "reviewId": "REV-091", "status": "PASS", "issues": [
  { "issue": "정본 요약 나열 3곳 미갱신(ERD·Profile 요약표·module-dependency)", "severity": "LOW", "component": "docs/design/domain-model.md:71,2231 · docs/design/module-dependency.md:119,132", "risk": "문서 드리프트", "evidence": "본문 Profile 블록·규칙 6·api-contract 는 갱신됨", "recommendation": "화면 서브태스크 문서 갱신 때 보정" },
  { "issue": "userTranslation 태스크 키 캐스트 잔존", "severity": "LOW", "component": "src/modules/conversation/prompts/userTranslation.ts:78", "risk": "키 오타를 컴파일러가 못 잡음", "evidence": "tasks.ts 에 키 존재, 캐스트 as unknown as LlmTask 유지", "recommendation": "as LlmTask 로 좁힘" },
  { "issue": "#32t 채팅 종류 무제한·Trace 없음", "severity": "LOW", "component": "src/modules/conversation/chats/translation.ts", "risk": "ASK 방 USER 메시지도 번역 가능(화면이 막음)", "evidence": "loadMessage where 에 chat kind 없음", "recommendation": "화면에서 ASK 버튼 비노출 확인" },
  { "issue": "userTranslation Prompt Registry 미등록", "severity": "LOW", "component": "prisma/seed.ts PromptTemplate 키 목록", "risk": "Console 에서 안 보임", "evidence": "wordEnrich 만 있음, reviewDecision 도 동일", "recommendation": "배포 전 Leader 판단" }
], "summary": { "critical": 0, "high": 0, "medium": 0, "low": 4 },
  "high_risk_areas": [
    "배포 순서: 백업 → prisma db push(Profile ADD COLUMN 3) → 배포(역순이면 getProfile·turnContext·SET_LEVEL 채택이 깨짐). db push 뒤 설정 GET/PUT 에 3칸 노출·기본값 true/true/false 확인, 구 코드 롤백 시에도 동작",
    "#32t 소유·상태 매트릭스(남의 메시지/없음/강사 말/빈·긴 본문/턴 진행 409/동시 409/분당 20 429/이미 번역 cached) — 실 LLM 은 1~2회만",
    "턴 저장: 정상 턴 후 USER 행 translation 저장·done.userTranslation 일치·교정 있는 턴에서 toolLog.correction 메타 유지·번역 null 인 턴에서 USER 행 translation 이 null 로 남아 #32t 로 채워짐",
    "preferences PUT 3칸: boolean 만 통과·문자열/숫자/null 400·unknown_key 400·보낸 키만 변경, 기존 키(correctionMode 등) 회귀 0",
    "O-1: ピアノを→피아노오 이고 とおり·おおきい 같은 단어 안 장음은 그대로(화면 단계 후 실화면 확인)",
    "blue/green 겹침 구간 동시 번역(데이터 무결·cached 반환)"
  ], "native_change": false }
```

## Codex 검토 (C2-S2, adversarial-review, focus=concurrency)

### [2026-10-04 15:23] C2 adversarial-review focus=concurrency — done
- judge 판정: line 85-86 (2026-10-04 15:14 codex_gate/C2) / 호출 차수: 2/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=055dbcf9aa0a(task_file) snapshot=9f97a986a2861
- **지적 2건**:
  1. **[HIGH]** `src/modules/conversation/orchestrator/index.ts:290` — 턴 저장의 무조건 번역 갱신 vs 재시도 API의 조건부 갱신 경합 → 재시도 선커밋 시 번역 덮어쓰기 가능 / 권고: USER 행 갱신도 `translation IS NULL` 조건 추가, 또는 toolLog와 번역 갱신 분리
  2. **[MEDIUM]** `src/modules/conversation/chats/translation.ts:80` — runningChatIds 가 DB PENDING만 검사하는데 startTurn 의 메모리 락 획득 후 PENDING 커밋 전 구간에 재시도 API 호출 가능 → 턴 진행 중 409 계약 깨짐 / 권고: 메모리 락도 함께 검사하거나 사용자 단위 원자적 락 획득 (다중 인스턴스면 DB advisory lock·lease 행·분산 락)
- 검토하지 못한 범위:
  - 실제 MariaDB 두 연결을 사용한 커밋 순서별 통합 경합 시험
  - blue/green 인스턴스 사이의 실제 라우팅 및 LLM 큐 부하 영향
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261004T061856Z-task-026-C2`

## Reviewer 기록 (Codex C2-S2 지적 판정, 2026-10-04 15:24 실측) — REV-092
코드 수정 없음(읽기 전용 판정). 근거 코드: `orchestrator/index.ts` `acceptTurn`·`saveTurnTx`·`processTurn`, `orchestrator/locks.ts`, `chats/index.ts` `runningChatIds`, `chats/translation.ts`.

### 판정 표
| # | Codex | 판정 | 심각도(내 판정) | 요지 |
|---|---|---|---|---|
| 1 | HIGH 턴 저장 무조건 갱신 vs 재시도 조건부 갱신 | **채택(부분 정정)** | **LOW** (Codex HIGH 는 과대) | 겹침 경로는 Codex 가 든 "턴 진행 중"이 아니라 **끊김 복구(resume)** 경로 — 그 경로에서 마지막 쓴 사람이 이기는(lost update) 결함은 실재. 값은 둘 다 정리를 통과한 같은 문장의 번역이라 손상·보안·집계 영향 0 |
| 2 | MEDIUM 진행 중 판정이 DB PENDING 만 봄 | **채택(최소, 프로세스 락 확인만)** | **LOW** (Codex MEDIUM 은 과대) | 창은 수락 커밋 전 ~0.1~0.5s, 그것도 **다른(옛) 사용자 메시지**의 재시도만 통과. 데이터 영향 0, 남는 건 LLM 동시 실행·큐 경쟁뿐. 분산 락은 불필요 |

### 1번 근거 — 시간창을 코드로 따지기
- **정상(비 resume) 턴은 겹칠 수 없다.** 사용자 행 R 과 강사 PENDING 행 A 는 `acceptTurn` 의 **같은 트랜잭션**에서 만들어진다(index.ts 164~172). 재시도는 `loadMessage(R)`(번역 null) → `isChatRunning` 순서라, R 이 보이면 A(PENDING)도 보이므로 `isChatRunning=true` → 409. A 가 PENDING 을 벗어나는 길은 ① `saveTurnTx`(같은 tx 에서 R 번역까지 씀 — 이후 재시도는 `cached` 또는 null 채움, 뒤따르는 턴 저장 없음) ② `markAssistantFailed`(R 무접촉) ③ stale(180s 초과·로컬 미실행 — LLM 예산 12~20s 라 살아 있는 턴이 못 넘음)뿐이다. 늦게 끝난 턴이 이미 FAILED 된 행을 덮는 길은 `status=PENDING, createdAt=pendingSince` 조건부 updateMany(`res.count===0 → CONFLICT`, 사용자 행 갱신 **전**)로 막혀 있다. → "턴 진행 중 재시도가 먼저 커밋 → 턴 저장이 덮어씀"은 불가.
- **실재하는 겹침 = 끊김 복구(resume).** 턴이 FAILED 되면 A=FAILED 이고 R 은 번역 null 로 남는다. 이때 `isChatRunning=false` 라 재시도가 허용되고(LLM 3~15s 후 `translation IS NULL` 조건부로 저장), 사용자가 [다시 받기](resume)로 같은 R·A 를 재실행하면 `saveTurnTx`(index.ts 290~)가 R 을 `{translation: shaped.userTranslation}` 로 **무조건** 갱신한다. 타이밍이 겹치지 않아도(재시도가 몇 분 전에 끝났어도) 순차로 덮인다 — 즉 경합이 아니라 **조건 없는 쓰기**가 본질. 코드 머리 주석·테스트 변이 ①이 약속한 "덮어쓰지 않음"이 턴 저장 쪽에는 적용되지 않았다.
- **영향**: 화면에 보이던 번역이 같은 문장의 다른(둘 다 `sanitizeUserKo`/`sanitizeUserTranslation` 통과) 번역으로 바뀜 + `done.userTranslation`(shaped 값)과 DB 값이 어긋날 수 있음. 교정·집계·StatsSnapshot·제안→채택 무관(번역은 표시용 메타 1칸). 다른 인스턴스(blue/green)여도 결과 동일 — 같은 행 단일 UPDATE 라 DB 가 직렬화한다.
- **채택 이유**: 비용이 작고 이미 문서화된 불변식("저장된 번역은 덮어쓰지 않는다")을 코드가 만족하게 한다. 심각도는 데이터 손상 없는 마지막-쓴-사람-이김이라 LOW.

### 1번 최소 수정안 (Developer 용)
`saveTurnTx` 의 USER 행 갱신을 **번역과 교정 메타로 분리**한다. 한 `UPDATE` 에 `translation IS NULL` 을 걸면 교정 메타(toolLog)까지 같이 skip 되므로 안 된다.
1. 번역: `tx.chatMessage.updateMany({ where: { id: a.userMessage.id, translation: null }, data: { translation: shaped.userTranslation } })` (`shaped.userTranslation` 이 있을 때만). `count===0` 이면 이미 값이 있는 것 → `tx.chatMessage.findUnique({ where:{id}, select:{translation:true} })` 로 저장값을 읽어 이번 턴의 "저장된 번역"으로 삼는다(`done.userTranslation` 은 이 저장값을 내보내도록 `saveTurnTx` 반환에 `userTranslation` 추가 → `processTurn` 의 `done` 이벤트가 `saved.userTranslation` 사용. 행 소실이면 null).
2. 교정 메타(`userRow.toolLog`)는 기존대로 `tx.chatMessage.update({ where:{id}, data:{ toolLog } })` 별도 1회(교정이 있을 때만, 조건 없음 — R 의 toolLog 는 이번 턴만 쓴다).
3. **잠금 순서·트랜잭션 경계 불변**: 사용자 행(`lockUserRow`) → A(`updateMany`) → R(번역 updateMany → toolLog update) → Correction create 순서 유지, 모두 같은 `withTransaction`. 재시도는 R 단일 행만 건드려 사이클이 없다(교착 위험 추가 0). InnoDB `UPDATE … WHERE translation IS NULL` 은 current read 라 잠금 대기 뒤 최신 커밋값으로 조건을 다시 평가한다 → 재시도가 먼저 커밋했으면 turn 쪽 count=0.
4. 기존 순서 약속 유지: 교정 메타는 `recordCorrectionProposed` 보다 먼저(현재 `flushUserRow` 위치 그대로 — 번역 updateMany 도 같은 지점에서).
- 왕복 +1(교정 있는 턴만, 같은 tx 안의 문장 1개 — 커밋 아님). 5초 예산 영향 무시 가능(NAS fsync 는 커밋마다 1회라 불변).

### 2번 근거 — 영향·창
- 문제 구간: `startTurn` 이 메모리 락(`tryAcquireTurnLock`)을 잡은 뒤 `acceptTurn` 커밋(NAS 100~500ms) 전. 이때 DB 에 A 도 새 R 도 없다. 이 창에 재시도가 통과하려면 **같은 방의 옛 USER 메시지**(번역 null, 예: userKo 정리 탈락분)여야 한다 → 턴이 쓰는 행(새 R)과 **다른 행**이라 데이터 충돌 0(1번 수정 여부와 무관). 남는 건 ① LLM 2건 동시 실행(턴 interactive 레인과 같은 큐 — 이번 턴 첫 문장 지연 가능) ② 문서화된 "턴 진행 중 409" 계약이 ~수백 ms 창에서 새는 것.
- 반대 순서(재시도 LLM 이 이미 도는 중에 사용자가 새 턴을 시작)는 **어떤 확인으로도 못 막는다**(`startTurn` 은 번역 inFlight 를 보지 않는다). 즉 Codex 권고를 전부 구현해도 겹침은 남는다 → 상한은 "사용자당 프로세스 동시 1건 + 분당 20 + 15s 타임아웃"이고, 이는 REV-091 의 blue/green 공백 수용 판정과 같은 선. 분산 락(DB advisory·lease 행)은 효과 대비 비용(새 테이블/잠금 경로·기동 정리)이 커서 **불필요**.
- **채택(최소)**: 같은 프로세스 메모리 락을 한 줄 더 본다 — `translationDeps.isChatRunning` 을 `(userId, chatId)` 로 넓혀 `currentTurnLock(userId)?.chatId === chatId` 이거나 기존 DB 판정이면 true. 이미 `chats/index.ts` 가 `../orchestrator/locks` 를 import 하므로 층 위반 없음(같은 conversation 모듈 내부). 락은 `saveTurn` 직후 `release()`(index.ts 571) 되므로 저장 뒤 음성 합성 동안 막히지 않는다. **chatId 비교를 유지**(사용자 락은 방과 무관하지만 문서·계약은 "그 방" — 다른 방 턴까지 막으면 계약이 바뀐다).
- 확인 순서는 현 그대로(번역 이미 있음 → cached 가 먼저, 그다음 400 길이 → 409 TURN_RUNNING → TRANSLATION_BUSY).

### 테스트 기준
단위(기존 `task026s2.test.ts` 패턴, 가짜 tx·`translationDeps` 교체 — 실 DB 불필요):
1. `saveTurnTx`: 번역 갱신이 `where:{id, translation:null}` `updateMany` 이고 `data` 에 `toolLog` 가 섞이지 않는다 · 교정 있는 턴은 toolLog 갱신이 **별도** `update` 로 1회, 번역 skip(count 0)이어도 실행된다 · count 0 이면 저장값 재조회를 반환·`done.userTranslation` 이 그 값 · 번역 null 턴은 번역 쿼리 0 · 쓰기 순서(A updateMany → R 번역 → R toolLog → correction/관측) 단언. **변이 시험**: 조건 `translation:null` 제거 / toolLog 를 번역 조건부 쪽에 합침 / count 0 인데 shaped 값을 그대로 반환 — 각각 1 fail 이어야 한다.
2. 재시도: `tryAcquireTurnLock('u1','c1')` 후 `retryUserTranslation('u1','c1',m)` → 409 `TURN_RUNNING`·LLM 호출 0 · 락 해제 후 정상 · 다른 사용자 락·같은 사용자 다른 방 락은 통과 · 번역이 이미 있는 메시지는 락 중에도 `cached`(기존 순서).
실 MariaDB 시험: **필수 아님**(수정 후 판정은 순수 SQL 의미 — 조건부 UPDATE 단일 행 — 와 가짜 tx 쓰기 순서로 충분). 다만 이번 변경이 "경합 시 값 보존"이라 **결정론적 순차 재현 1건**을 QA 가 권고: 개발·운영 공유 NAS 라 전용 임시 사용자·채팅·R(번역 null)·A(FAILED)를 `try/finally` 로 만들고 지우며, ① `saveIfEmpty` 로 "RETRY" 저장 → ② resume 과 같은 `saveTurnTx`(실 `withTransaction`)에 userTranslation "TURN" → R.translation 이 "RETRY" 로 남고 반환값도 "RETRY". 두 연결 인터리빙(연결 1 이 R 행 잠금을 쥔 채 연결 2 의 조건부 UPDATE 가 대기 → 커밋 후 재평가)까지는 InnoDB 의미가 확립돼 있어 생략해도 된다. 공유 DB 의 실사용자 행에는 쓰지 않는다.

### 출력(reviewer.md 스키마)
```json
{ "reviewId": "REV-092", "status": "CONDITIONAL_PASS", "issues": [
  { "issue": "턴 저장이 USER 행 번역을 조건 없이 갱신 — 재시도로 이미 저장된 번역을 resume 턴이 덮어씀(마지막 쓴 사람이 이김, done.userTranslation 과 DB 값 불일치 가능)", "severity": "LOW", "component": "src/modules/conversation/orchestrator/index.ts:290 (saveTurnTx userRow/flushUserRow)", "risk": "표시용 번역이 같은 문장의 다른 번역으로 바뀜 — 손상·집계·보안 영향 0", "evidence": "R 과 PENDING A 는 acceptTurn 같은 tx 라 정상 턴과는 겹침 불가, 겹침 경로는 FAILED→resume(isChatRunning=false 로 재시도 허용). 번역 updateMany 에 translation:null 조건 없음", "recommendation": "번역은 where{id,translation:null} updateMany 로, 교정 toolLog 는 별도 update 로 분리. count 0 이면 저장값을 재조회해 saveTurnTx 반환·done.userTranslation 에 사용. 잠금 순서·트랜잭션 경계 불변" },
  { "issue": "재시도 API 의 '턴 진행 중 409' 가 DB PENDING 만 봐서 수락 커밋 전 구간(같은 프로세스 메모리 락 보유)에 통과", "severity": "LOW", "component": "src/modules/conversation/chats/translation.ts:isChatRunning (chats/index.ts runningChatIds)", "risk": "옛 USER 메시지 재시도 LLM 이 턴과 같은 interactive 큐에서 동시 실행(비용·지연)만, 데이터 충돌 0", "evidence": "새 R·A 는 수락 커밋 뒤에야 존재, 통과 가능한 건 다른(옛) 행. 반대 순서(재시도 선행)는 어떤 확인으로도 못 막음 — 상한은 사용자당 1건·분당 20·15s", "recommendation": "isChatRunning 을 (userId,chatId) 로 넓혀 currentTurnLock(userId)?.chatId===chatId 확인 추가. 분산 락 불필요" }
], "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 },
  "high_risk_areas": [
    "saveTurnTx 번역/toolLog 갱신 분리 — 교정 있는 턴에서 toolLog.correction 메타 유지(번역 count 0 이어도), 번역 null 턴 USER 행 무접촉, 쓰기·잠금 순서 불변",
    "done.userTranslation 이 DB 저장값과 일치(resume + 사전 재시도 케이스)",
    "재시도 409 TURN_RUNNING: 같은 방 락 중에만, 다른 방·다른 사용자는 통과, 이미 번역 있으면 cached 우선",
    "(권고) 임시 행 순차 재현 1건: 재시도 선저장 → resume 저장 → 값 보존"
  ], "native_change": false }
```
Codex 지적 처리 기록: #1 채택(LOW, 겹침 경로 정정)·#2 채택(LOW, 프로세스 락 한정)·오탐 0·범위 밖 0. Developer 수정 → **Reviewer(REV-093)부터 재순환**, 수정 전까지 QA 진행은 CONDITIONAL(둘 다 LOW 라 QA 병행 가능 여부는 Leader 판단 — 단 S2 서버 최종 PASS 는 수정·재확인 뒤).

## Leader 기록 (Codex C2-S2·REV-092 수용, 2026-10-04 15:25)
- Codex C2-S2(concurrency, 호출 2/4) 2건 → REV-092 둘 다 채택·LOW. **둘 다 수정**(작고 명확): ① 턴 저장 번역 `updateMany{id, translation:null}` + 교정 toolLog 별도 update, count 0 이면 저장값 재조회로 done.userTranslation ② `isChatRunning(userId, chatId)` 에 같은 방 프로세스 턴 락 확인. 테스트 기준·변이 3종은 REV-092 절. 실 MariaDB 경합 시험 불필요, QA 에서 임시 행 순차 재현 1건(권고).
- 흐름: developer(opus) → REV-093 → DB 백업·db push(Leader) → QA → 배포.

## Developer 기록 (REV-092 수정, 2026-10-04 실측)
- [15:30] **완료 — Codex C2-S2·REV-092 2건 수정.** commit·push·db push 안 함. 화면 파일 무접촉. 수정 파일 3개(지시 범위 그대로).
  | 파일 | 내용 |
  |---|---|
  | `src/modules/conversation/orchestrator/index.ts` | `saveTurnTx` USER 행 갱신 분리: 번역 = `updateMany({where:{id, translation:null}, data:{translation}})`, count 0 이면 `findUnique` 로 저장값 재조회(행 소실이면 null) · 교정 toolLog = 별도 `update({where:{id}, data:{toolLog}})`(번역 count 0 이어도 실행) · 번역 null 턴은 번역 쿼리 0 · 반환에 `userTranslation`(저장값) 추가 → `processTurn` `done.userTranslation = saved.userTranslation ?? null`(`?? null` 은 saveTurn 을 바꿔 끼운 옛 테스트 목이 키를 안 돌려줄 때도 계약상 null 로 나가게) |
  | `src/modules/conversation/chats/translation.ts` | `isChatRunning(userId, chatId)` = `currentTurnLock(userId)?.chatId === chatId` **또는** DB PENDING(`hasPendingTurn(chatId)` — 테스트가 DB 없이 실제 락 판정을 타도록 분리). `../orchestrator/locks` 는 같은 conversation 모듈 내부(chats/index.ts 와 같은 import, locks.ts 는 import 0 이라 순환 없음). 확인 순서 불변(cached → 400 길이 → 409 TURN_RUNNING → BUSY) |
  | `src/modules/conversation/__tests__/task026s2.test.ts` | 13 → **19건**. 가짜 tx 에 `userTx`(USER 행 조건부 갱신 count)·`stored`(재조회값)·`findUnique` 추가. saveTurnTx 5건(정상 where·data / null 무접촉 / count 0 저장값 반환·행 소실 null / 교정 턴 쓰기 순서·data 키 / 교정 턴 count 0 에도 toolLog) + 교정 턴 번역 null 1건 + **processTurn `done.userTranslation` = 저장값**(saveTurn 을 saveTurnTx(가짜 tx, count 0) 로 연결) + 재시도 락 2건(같은 방 락 409·LLM 0 / 다른 방·다른 사용자 통과 / 해제 후 통과 / 번역 있으면 락 중에도 cached). `wire()` 는 `isChatRunning` 대신 `hasPendingTurn` 을 바꿔 끼워 실제 락 판정이 돈다 |
  - **쓰기 순서(교정 턴)**: 사용자 행 잠금 → A `updateMany` → `correction.create` → R 번역 `updateMany` → (count 0 이면 R `findUnique`) → R toolLog `update` → 관측 → (selfCheck·제안) → chat. 종전과 같은 자리(`flushUserRow` 위치)에서 R 쓰기만 둘로 나눔 — `correction.create` 가 R 갱신보다 앞서는 것은 **종전 순서 그대로**(toolLog 메타에 교정 행 id 가 필요). Leader 문구 "사용자 행 → A → R → Correction" 은 기존 순서 불변으로 해석했다(R 번역을 correction.create 앞으로 옮기지 않음 — REV-092 4항 "현재 flushUserRow 위치 그대로"). 트랜잭션 경계 불변(전부 같은 `withTransaction`).
  - **남는 동작(의도)**: 번역 null 턴(정리 탈락)은 USER 행을 읽지 않으므로, resume 전에 재시도가 번역을 저장했어도 그 턴의 `done.userTranslation` 은 null — 화면 [다시 가져오기] → #32t 가 `cached` 로 저장값을 준다(REV-092 "번역 null 턴은 번역 쿼리 0" 기준을 따름).
  - **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-026s2`, `scratchpad/sync-026s2.sh` 동기화, prisma generate 안 함)
    - `tsc --noEmit --incremental false` → exit **0**
    - `eslint .` → **0 errors**, 5 warnings(기존 react-hooks/set-state-in-effect, 화면 5파일 — 변경 무관)
    - `task026s2.test.ts` **19/19**
    - 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **1,325 tests / pass 1,322 / fail 0 / skip 3**(skip 3 = 기존)
    - 엔진명 grep(`claude|whisper|reazon|style-bert|haiku|sonnet|qwen`) 변경 2파일 0건
    - 참고: done 테스트는 기존 task007/010c 와 같이 `recordTrace` 가 가짜 사용자 id 로 FK 위반(기록 0건, 경고 로그만)
  - **변이**(미러 사본에서만, 원복 후 NFS 와 `cmp` 일치 → 19/19 확인): ① USER 번역 where 에서 `translation:null` 제거 → **2 fail** ② toolLog 를 번역 조건부 updateMany data 에 합치고 별도 update 생략 → **2 fail** ③ count 0 인데 shaped 값 반환 → **3 fail** ④(추가) isChatRunning 에서 락 확인 제거 → **1 fail** ⑤(추가) 락 방 비교 제거(`!== null`) → **1 fail**
  - **Reviewer(REV-093) 중점**: 쓰기 순서·잠금 순서가 종전과 같은 자리인지 · 교정 toolLog 가 번역 skip 과 무관하게 쓰이는지 · `done.userTranslation` 이 저장값인지 · 락 확인이 같은 방에만 걸리는지(다른 방 턴은 막지 않음) · 확인 순서(cached 먼저)
  - 미커밋(이번 수정분): 위 3파일(`orchestrator/index.ts` 는 S2 미커밋 diff 위에 누적, `chats/translation.ts`·`task026s2.test.ts` 는 S2 신규 미추적 파일).

## Leader 기록 (DB 백업, 2026-10-04 15:31)
- 백업: `mysqldump --single-transaction --routines --triggers --hex-blob thekaiwa`(접속 정보는 `.env` DATABASE_URL → 임시 600 옵션 파일 → 즉시 삭제, 값 미출력) → `/home/brownjeon/NFS/homes/brownjeon/project/files/thekaiwa/backups/thekaiwa-20261004-153102-pre-task026.sql.gz`(600, 180,513B, CREATE TABLE 53, "Dump completed on 2026-10-04 15:31:05"). 복원(필요 시, 사용자 확인 후): `zcat <파일> | mysql --defaults-extra-file=<옵션 파일> thekaiwa` — 공유 DB 전체를 이 시점으로 되돌리므로 먼저 새 칸만 DROP 하는 방법을 검토(`ALTER TABLE Profile DROP COLUMN showFurigana, DROP COLUMN showHangul, DROP COLUMN showTranslation`).
- db push 는 REV-093 PASS 뒤(전용 미러, 추가 3칸만 — migrate diff SQL 은 Developer 체크포인트 1).

## Reviewer 기록 (REV-093 — REV-092 수정 재확인, 2026-10-04 15:40 실측)
코드 수정 없음. 대상: `orchestrator/index.ts`(`saveTurnTx`·`done`) · `chats/translation.ts`(`isChatRunning`·`hasPendingTurn`) · `__tests__/task026s2.test.ts`. 전용 미러 `~/.node-local/thekaiwa-dev-026s2`(공유 미러 generate 없음).
- **(1) 번역 조건부 저장 — 충족.** `flushUserRow`: 번역 있을 때만 `updateMany{id, translation:null}`, `count===1` → shaped 값, 아니면 `findUnique` 저장값(행 소실 null) · 번역 null 턴은 번역 쿼리 0 · 교정 toolLog 는 별도 `update`(번역 count 0 이어도 실행, 변이로 확인). 순서 = 사용자 행 잠금 → A `updateMany` → `correction.create` → R 번역 → R toolLog → 관측 — **HEAD 와 같은 자리**(HEAD 도 correction.create 가 R toolLog update 보다 앞), 같은 `withTransaction`, 경계 불변. 교착: 재시도는 R 단일 행 한 문장이라 사이클 없음. 참고(INFO, 비차단): FK 체크가 R 에 S 잠금 → 이후 R 번역 UPDATE 가 X 로 올라가는 S→X 승격은 **종전부터 있던 패턴**(HEAD 의 toolLog update 동일). 새로 생긴 경쟁자(재시도 UPDATE)가 그 ms 창에 대기하면 InnoDB 가 한쪽을 롤백할 수 있으나, 재시도는 `isChatRunning` 으로 같은 방 PENDING/락 중엔 막히고 걸리는 건 resume 과 정확히 겹친 경우뿐이며 희생자는 보통 1행짜리 재시도(사용자 재시도로 회복). 필요하면 후속에서 번역 updateMany 를 correction.create 앞으로 옮기는 안을 검토(지금은 REV-092 4항 순서 약속 유지가 우선).
- **(2) `done.userTranslation` = 저장값 — 충족.** `saveTurnTx` 반환 `userTranslation` → `done: saved.userTranslation ?? null`. 번역 null 턴(정리 탈락)은 USER 행을 읽지 않아 재시도가 먼저 저장했어도 done 은 null → 화면 [다시 가져오기] 가 #32t `cached` 로 저장값 회복. **수용**: ① 값 손상·덮어쓰기 없음(조건부 저장이 보장) ② 사용자가 보는 건 잠깐의 "번역 없음" 뿐이고 재시도 비용 0(LLM 없이 cached) ③ 같은 번역이 저장된 상태를 쿼리 1개 더 써서 읽는 이득(done 표시 순간 1회)은 5초 예산·NAS 왕복 대비 작음. 요구한 불변식(마지막 쓴 사람이 이기지 않음)은 충족.
- **(3) `isChatRunning(userId, chatId)` — 충족.** `currentTurnLock(userId)?.chatId === chatId || hasPendingTurn(chatId)` — 같은 방만 막고 다른 방(같은 사용자)·다른 사용자 통과, 확인 순서 cached → 400 길이 → 409 TURN_RUNNING → BUSY 불변. import: `../orchestrator/locks` 는 같은 conversation 모듈 내부 상대 import(`chats/index.ts:12` 선례), locks.ts import 0 → 순환 없음, 외부 모듈의 index 우회 아님, `eslint .` 0 error 로 규칙 통과. `translation.ts → ./index(runningChatIds)` 도 chats 폴더 안, 역방향 import 없음.
- **(4) 재실행**: `tsc --noEmit --incremental false` exit 0 · `eslint .` 0 errors / 5 warnings(기존 react-hooks, 화면 5파일, 변경 무관) · `task026s2.test.ts` 19/19 · 전체 회귀 1,325 tests / pass 1,322 / fail 0 / skip 3(기존). **변이(내 것, 개발자 5종과 다른 1건)**: 교정 toolLog update 를 "번역이 이번 턴 값일 때만" 으로 조건화 → `saveTurnTx(REV-092): 교정 턴에서 번역이 건너뛰어져도(count 0) 교정 toolLog 는 반영…` **1 fail 검출**, 미러 원복 후 NFS 와 `cmp` 일치·19/19 복구.
- 엔진명 grep 변경 2파일 0건(주석 외). 화면 변경 없음 → 데모 게이트 해당 없음. 네이티브 변경 없음.
- 실 MariaDB 순차 재현 1건은 REV-092 권고대로 QA 몫(필수 아님).

```json
{ "reviewId": "REV-093", "status": "PASS", "issues": [
  { "issue": "R 번역 UPDATE 가 correction.create 의 FK S 잠금 뒤 X 로 승격 — 재시도 UPDATE 가 그 ms 창에 대기하면 InnoDB 교착 희생 가능(종전부터 있던 S→X 패턴, 재시도는 isChatRunning 으로 대부분 차단)", "severity": "LOW", "component": "src/modules/conversation/orchestrator/index.ts:296 (flushUserRow, correction.create 뒤)", "risk": "resume 과 재시도가 ms 단위로 정확히 겹칠 때 둘 중 하나(대개 재시도)가 500 — 사용자 재시도로 회복, 데이터 손상 0", "evidence": "HEAD 도 correction.create → R toolLog update 순서. 재시도는 단일 행 UPDATE 라 사이클은 없고 승격 대기만 가능", "recommendation": "비차단. 후속에서 번역 updateMany 만 correction.create 앞으로 이동 검토(toolLog 는 교정 행 id 필요라 뒤 유지) — 현재는 REV-092 순서 약속 유지" }
], "summary": { "critical": 0, "high": 0, "medium": 0, "low": 1 },
  "high_risk_areas": [
    "saveTurnTx USER 행 갱신 분리 — 교정 턴 toolLog 가 번역 skip 과 무관하게 남는지(변이로 확인됨), 번역 null 턴 USER 행 무접촉",
    "done.userTranslation = DB 저장값(번역 null 턴은 null → #32t cached 회복)",
    "재시도 409 TURN_RUNNING — 같은 방 락/PENDING 중에만, 다른 방·다른 사용자 통과, cached 우선",
    "(권고) QA 임시 행 순차 재현: 재시도 선저장 → resume 저장 → 값 보존, 공유 NAS 실사용자 행 금지"
  ], "native_change": false }
```
Codex C2-S2 지적 처리 종결: #1·#2 수정 확인(REV-092 채택분 모두 충족, 회귀 0). S2 서버 REV 판정 **PASS**. 다음: Leader DB 백업 후 `db push` → QA.

## Leader 기록 (REV-093 수용·db push, 2026-10-04 15:33)
- REV-093 PASS(Low 1 — FK S→X 승격, 종전 패턴·비차단, 후속 검토).
- **db push 완료**(사용자 승인 10-04 13:11 "백업 후 추가", 백업 `pre-task026` 뒤): 전용 미러 schema = NFS(cmp) → migrate diff = Profile ADD COLUMN 3개 → `prisma db push --skip-generate` "in sync, 3.27s"·데이터 손실 경고 0 → 재확인 diff "empty migration". 공유 미러 `~/.node-local/thekaiwa` prisma generate(showFurigana 포함). 운영(옛 코드) 무영향 확인: pm2 3개 online·restart 0, health ok.
- 다음: QA(S2 + 임시 행 순차 재현) → 서버 묶음(S1·userKo·burst·S2) 배포(gateway 재기동 포함 — deploy.sh 확인).

## QA 기록 (S2 서버, 2026-10-04 15:35~15:55 실측)
- **판정: PASS** — Critical 0 · High 0 · Medium 0 · Low 0 · 관찰 3(N1~N3, 결함 아님). 다른 문서의 수치는 인용하지 않고 전 항목을 이번에 직접 실행했다. 코드·prisma·speech 수정 0, deployer 인계 없음. **화면 변경 없는 서버 묶음이라 360/390/412·스크린샷 `NOT_APPLICABLE`**(스크린샷 0장, 산출물 삭제 대상 없음).
- **환경(재현 조건)**: dev 앱 = 미러 `~/.node-local/thekaiwa-dev-010b-ui` 에서 `./node_modules/.bin/next dev -H 127.0.0.1 -p 3019`(APP_ENV=LOCAL, 접속 `http://localhost:3019`, NFS `src/ tests/ prisma/` 를 `rsync -a --delete` 후 `diff -rq` 3곳 identical, `.env` cmp 동일) · 쿠키 `QA_ACCOUNT=1`·`2`(`tests/live/qa-session.ts`, 600 파일) · LLM = 실 Claude CLI(`.env` 그대로, 순차) · TTS(TALK 3회)는 `.env` 의 M4 · dev gateway(8197)는 O-1 실 조각 확보용으로만 잠깐 띄움(앱은 운영 8100 을 가리키므로 앱 경유 annotate 는 하지 않음).
- **N1(INFO, 환경 함정 — Leader 인계 문구와 다름)**: 인계에 "미러 `thekaiwa-dev-010b-ui` 의 prisma 클라이언트는 이미 새 칸으로 generate" 라고 했으나 실제는 **반쪽**이었다 — `node_modules/.prisma/client/{schema.prisma, wasm}` 만 공유 inode(15:33 갱신), `index.js`·`index.d.ts` 는 10-01 옛 파일(`grep -c showFurigana` → index.js 0 · index.d.ts 0 · schema.prisma 1)이라 그대로 쓰면 Profile 쿼리가 새 칸을 모른다. 조치: `rsync -a ~/.node-local/thekaiwa/node_modules/.prisma/client/ ~/.node-local/thekaiwa-dev-010b-ui/node_modules/.prisma/client/`(공유 쪽은 읽기만, 미러 쪽 생성 산출물만 교체 → index.js 3 · index.d.ts 32 hit). 또 `thekaiwa-dev-026s2` 미러는 클라이언트는 최신이지만 node_modules 가 심볼릭 링크라 **Turbopack 이 `Could not find the Next.js package` 로 모든 라우트 500** → dev 앱은 못 띄움(정적 검사·테스트에는 사용). 두 미러 모두 보존.

### 1. 표시 설정 3칸 — `GET/PUT /api/v1/settings/profile` — **PASS**
명령 `bash settings.sh`(원 출력 핵심):
| 시험 | 원 출력 |
|---|---|
| 쿠키 없음 GET·PUT | `{"code":"UNAUTHENTICATED"} [HTTP 401]` ×2 |
| 원래값 GET | `"showFurigana":true,"showHangul":true,"showTranslation":false … [HTTP 200]`(correctionMode FLUENCY·dailyWordCount 10 등 기존 키 그대로) |
| 각각 바꾸기 | `PUT {"showFurigana":false}` → `showFurigana:false,showHangul:true,showTranslation:false` 200 · `{"showHangul":false}` → `false,false,false` 200 · `{"showTranslation":true}` → `false,false,true` 200 · 이어 GET `false,false,true` 200(**보낸 키만 바뀜**) |
| 되돌리기 | 3번 PUT 뒤 GET `showFurigana:true,showHangul:true,showTranslation:false` 200 |
| boolean 아님 | `"true"`·`1`·`0`·`null`·`[]`·`{}`·`"false"`(showFurigana) · `"yes"`(showHangul) · `1`(showTranslation) 9건 모두 `{"code":"VALIDATION","details":{"field":"…","reason":"boolean"}} [HTTP 400]` |
| 알 수 없는 키 | `showReading`·`readingDefault`·`bogus`(허용 키와 같이)·`role` 4건 모두 `{"reason":"unknown_key"} [HTTP 400]` |
| 메서드 | `PATCH` → `[HTTP 405]`(PATCH 는 정의되지 않은 메서드 — 수정은 PUT) |
- **기존 키 회귀 0**: `PUT {"correctionMode":"BOGUS"}` → `400 field correctionMode reason "FLUENCY|COACH"` · `{"dailyWordCount":"x"}` → `400 reason "5~30"` · `PUT {}` → `200`(값 불변) · `PUT {"correctionMode":"FLUENCY","dailyWordCount":10,"showTranslation":false}` → 200 · 원래값과의 차이는 `updatedAt` 하나뿐(`diff vs orig: {'updatedAt': (…)}`). 응답 모양에 3칸 포함·엔진명 없음.
- **복구 확인(DB 직접)**: `qa-bot` · `qa-bot2` 둘 다 `correctionMode FLUENCY · showFurigana true · showHangul true · showTranslation false · dailyWordCount 10`.

### 2. 턴 저장(실 LLM, 순차) — **PASS**
스크립트 `node turns.mjs c1 ids.json`(CHAT 2턴 + TALK 1턴, 계정1) → `accepted>status>status>status>done`(TALK `…audio>audio>status>done`) ms 5438 · 4795 · 6569, 전 턴 `done` 키에 `userTranslation` 포함(`…endOfTopic,userTranslation,proposals,audioCount,traceId`). 이어 CHAT 4턴 + TALK 2턴(오류 문장) 추가, TALK 교정은 `correctionMode=COACH` 로 임시 전환 후 복구(CHAT 은 설계상 교정 없음 — `shape.ts` 주석·`correction:null`). DB 대조(`dbcheck.ts`, USER 행 id 로 조회):
```
USER rows 9, done==DB 9
CHAT done "어제 영화를 보러 갔습니다."  db "어제 영화를 보러 갔습니다."  MATCH true
TALK done "저는 어제 학교를 갔습니다, 친구가 만났습니다." db 동일 MATCH true · doneCorrId cmutg8op00019w1zwggegi7qz · dbCorr [[그 id,"PROPOSED",original==USER원문 true]] · toolLogKeys ["correction"] · toolLog.correction {id,mode:"COACH",deliver:"NOW",hintKo,selfCheck:"MISSED"}
TALK done "그녀는 책을 읽고 있어요." db 동일 MATCH true · toolLog.correction {id:cmutg8tb2…,mode:"COACH",…}
```
- 교정이 생긴 TALK 2턴 모두 **USER 행 `toolLog.correction` 메타 유지 + Correction 행 `original` = USER 원문(바이트 일치, `cleanup.ts`: `correction.original == USER 원문: [true,true,true]`)**. 교정 PROPOSED 동안 `WordEntry`·`StudyLog` 신규 행 0(`QA1 StudyLog(최근3h) 0 · WordEntry 0 · QA2 0 0`) — 제안→채택 원칙 유지. 강사 행 번역은 `ASSISTANT/DONE` 정상 저장.

### 3. 재시도 API `POST /api/v1/chats/:id/messages/:messageId/translation` — **PASS**(임시 행, QA 계정만)
임시 데이터는 `setup.ts` 로 QA1 방 3개·QA2 방 1개·item 4 방 3개를 직접 만들었다(실사용자 행 0, 아래 정리 참조). 명령 `bash m1.sh`·`m2.sh`·`conc.mjs`·`rl.mjs`:
| 시험 | 원 출력 |
|---|---|
| 쿠키 없음 | `UNAUTHENTICATED [HTTP 401]` |
| 타인(QA2)이 QA1 의 메시지 | `404 {"code":"NOT_FOUND"} 0.029s` |
| 없는 id · 41자 id · 다른 방 id 조합 | 3건 모두 `404 NOT_FOUND`(존재 여부 숨김) |
| 강사 메시지(ASSISTANT) | `400 {"code":"VALIDATION","details":{"field":"messageId","reason":"not_user_message"}}` |
| 1,001자 본문 | `400 {"reason":"text_length"}` |
| 이미 번역 있음(R3) ×2 | `200 {"translation":"QA-PRESET 고양이를 좋아해요.","cached":true}` 0.012s·0.010s(LLM 호출 없음 — 10ms) |
| 턴 진행 중(같은 방에 PENDING 강사 행) | `409 {"code":"CONFLICT","details":{"reason":"TURN_RUNNING"}}` 0.013s — 확인 뒤 그 강사 행을 DONE 으로 정리(방 한정 판정은 단위 테스트 몫) |
| **실호출 1회**(번역 null 임시 행 R1) | `200 {"translation":"어제 영화를 보러 갔어요.","cached":false}` **2.31s** → DB 즉시 `translation:"어제 영화를 보러 갔어요."` 저장 확인 → 같은 R1 재요청 `200 … "cached":true` |
| **동시 2요청**(R2·R8, 한 사용자, `Promise.all`) | `R2 200 cached:false 2809ms` / `R8 409 {"reason":"TRANSLATION_BUSY"} 39ms` → DB R2 저장·**R8 번역 null 그대로**(실패·충돌 쪽은 저장 0) |
| **분당 상한**(QA2, 캐시 경로, `rl.mjs`) | 새 창에서 `1:200c … 20:200c 21:429 22:429` · 첫 시도는 앞선 404 시험 1건이 같은 창에 있어 `20:429`(= 창 안 21번째) — 둘 다 일관. `429 {"code":"RATE_LIMITED","details":{"retryAfterSec":60}}`, `retry-after: 60`. 상한은 404·400 도 센다(서비스 호출 전 `rateLimit`) |
| XSS 문자열 입력 | USER 행 `<img src=x onerror=alert(1)>今日は暑いです。` → `200 "오늘은 덥습니다." cached:false` 2.99s(태그 없는 순수 텍스트, 입력 베끼기 정리 통과) |
- 로그 위생: dev 앱 로그(140줄)에 일본어·한국어 문장·`QA-SENTINEL`·`onerror`·시크릿 단어(`INTERNAL_SECRET`·`JWT`) grep 모두 **0**. 요청 로그는 메서드·경로·상태·ms 만. 응답 본문 어디에도 엔진명·내부 주소 없음.

### 4. 임시 행 순차 재현(REV-092 권고) — **PASS**
공유 NAS 이므로 QA 계정의 임시 채팅(USER 행 번역 null + 강사 행 `FAILED`)만 사용. 스크립트 `node seq.mjs <chat> [sentinel]`: ① 재시도 API 로 먼저 저장 → (선택) 바로 sentinel 로 DB 값을 바꿔 "먼저 저장된 값"을 눈에 띄게 만듦 → ② **실제 resume 경로**(`POST /turns {"resumePending":true}`, 실 LLM)가 같은 USER 행에 턴 저장을 다시 씀 → DB·done 대조.
| 시나리오 | ① 재시도 저장 | ② resume 뒤 DB | ② `done.userTranslation` | 판정 |
|---|---|---|---|---|
| seq1 CHAT(자연) | `어제 친구랑 영화를 봤어요.` cached:false | `어제 친구랑 영화를 봤어요.`(불변) | `어제 친구랑 영화를 봤어요.` | 일치 |
| seq2 CHAT(**sentinel**) | `다음 주에 교토에 가고 싶어요.` → DB 를 `QA-SENTINEL-FIRST-SAVED` 로 | `QA-SENTINEL-FIRST-SAVED`(**resume 턴이 LLM userKo 를 새로 받았어도 덮어쓰지 않음**) | `QA-SENTINEL-FIRST-SAVED`(= 저장값) | 값 보존 |
| seq3 TALK·COACH(**sentinel**) | `그녀는 책을 읽고 있어요.` → `QA-SENTINEL-TALK-FIRST` | `QA-SENTINEL-TALK-FIRST` · **`toolLog:["correction"]`** · Correction 행 생성(`cmutgd4ue001jw1zwj6f9g8l1`, `original`=USER 원문, CONJUGATION, PROPOSED) | `QA-SENTINEL-TALK-FIRST` · `correction:{id…,errorType:"CONJUGATION"}` | **번역 skip 과 무관하게 교정 메타 유지**(REV-093 변이 핵심을 실 DB 로 확인) |
- 세 건 모두 강사 행 `FAILED→DONE`·`toolLog` 키 정상. **이전 코드(무조건 갱신)에서의 덮어쓰기와 대비**하는 실험은 하지 않았다(코드 수정 금지) — 대신 sentinel 이 그대로 남는 것으로 조건부 저장을 확인.
- **한계(NOT_VERIFIED)**: 두 DB 연결이 같은 행을 동시에 갱신하는 인터리빙(InnoDB 잠금 대기→재평가)·blue/green 두 프로세스 동시 번역은 이번에 실행하지 않았다 — REV-092 가 "필수 아님·InnoDB 의미 확립"으로 정리한 항목. 프로세스 메모리 락 구간(수락 커밋 전) 409 는 단위 테스트(`task026s2.test.ts` 락 2건)로만 확인, 라이브로는 DB PENDING 경로만 확인.

### 5. O-1 — 조사 を 와 한글 줄 — **PASS**
명령 `node --env-file=.env --import tsx scratch/qa026s2/o1.mts`(미러 `src/modules/speech/reading/client.ts` 직접 import. 실 조각은 dev gateway 8197 `/text/annotate` 응답을 그대로 `hangulLine` 에 넣음):
```
ピアノを → pron ピアノオ        hangul 피아노오          テストを → テストオ  테스또오
コーヒーを → コーヒーオ         hangul 코-히-오          本を → ホンオ        홍오
ピアノを弾きます。→ 피아노오 히끼마스.   テストをします。→ 테스또오 시마스.   東京を見ます。→ 토-꾜-오 미마스.
とおりに行きます。→ pron トーリニ イキマス。 hangul 토-리니 이끼마스.   おおきい犬です。→ 오-끼- 이누데스.
```
- 조사 を 는 4종 모두 장음으로 안 붙고(`피아노오`·`테스또오`·`코-히-오`·`홍오`), 단어 안 장음(`とおり`·`おおきい`)은 `-` 로 유지. 손으로 만든 조각 `hangulLine([…ピアノ, を(オ)])` 은 `피아노 오`(boundary 'particle' 이면 띄어 씀), 직접 변환기 `kanaToHangul('ピアノヲ')`=`피아노오` · `('ホンヲ')`=`홍오` · `('トオリ')`=`토-리` · `('オオキイ')`=`오-끼-`.
- **N2(INFO, 화면 단계 인계)**: 공개 `kanaToHangul('ピアノオ')` 는 그대로 `피아노-`(ヲ 표식이 없으면 종전 규칙) — **조사 보정은 `hangulLine()` 이 ヲ 표식을 넣을 때만** 적용된다. 현재 `src/` 에서 `kanaToHangul`·`hangulLine` 을 부르는 비테스트 코드는 0건이라 영향 없음. 화면 서브태스크는 `kanaToHangul(pronLine())` 로 우회하지 말고 `hangulLine()` 만 쓸 것.

### 6. 자동 검증 — **PASS**(미러 `thekaiwa-dev-026s2`, NFS 와 `diff -rq` 3곳 identical)
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` → **`tsc exit 0`**
- `node node_modules/eslint/bin/eslint.js .` → **`✖ 5 problems (0 errors, 5 warnings)`** exit 0 — 5 건 모두 기존 `react-hooks/set-state-in-effect`(DiagnosticsScreen·LearningSettings·OnDeviceDiagnosticsCard·SpeechSettings·VoiceSettings, 변경 파일 아님)
- `task026s2.test.ts` **19/19** · `userTranslation.test.ts` **13/13**(skip 0) · `preferences/validate.test.ts` **7/7** · `reading.test.ts` **15/15**(네 파일 묶음 `# tests 54 · pass 54 · fail 0 · skipped 0`)
- 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → **`# tests 1325 · # pass 1322 · # fail 0 · # skipped 3`** exit 0, 42.9s(skip 3 = 기존, Developer·REV-093 수치와 일치)

### 보안·체크리스트 요약
- 인증 401 · 타인 404 · 입력 검증 400(타입·알 수 없는 키·길이·강사 말) · 동시 409(두 종류) · 429 · XSS 문자열 안전(태그 제거된 텍스트) · 응답·로그에 Secret·엔진명·원문 0 · `Correction.original` 불변(원문 일치 3/3) · 채택 전 `WordEntry`·`StudyLog` 0 · 번역은 표시용 메타(집계·스냅샷 무관).
- 관찰 **N3(INFO)**: 재시도 LLM 호출 지연 2.31 · 2.81 · 2.99 s(3건, `fast`/15s 한도 내). 5초 예산 대상 아님(턴 아님) — 30턴 p50/p95·단어 세트 소요는 이 묶음 범위 밖 `NOT_VERIFIED`. 턴 지연 참고(CHAT 5.4/4.8 s, TALK 6.6 s, 교정·번역 포함 3건)는 표본이 작아 지표로 쓰지 않는다.

### 육안·실서비스 확인 필요(NOT_VERIFIED)
- 화면(표시 설정 3칸 UI·내 말 번역 말풍선·[다시 가져오기] 버튼·360/390/412) — 화면 서브태스크 후.
- blue/green 두 인스턴스 동시 번역, 두 연결 InnoDB 인터리빙, 운영 배포 후 `prompts:sync`(PromptTemplate `userTranslation`, REV-091 L4)·gateway 재기동 — 배포 단계(deployer) 확인.
- 프로세스 메모리 턴 락 구간 409 의 라이브 재현(단위 테스트만).

### 정리 — 산출물 정리: 스크린샷 0장, 쿠키 2·스크립트 9·임시 출력 1 파일 삭제 · 프로세스 정리: dev 3019·gateway 8197 종료·포트 비움
- **프로세스**: dev 앱 PID 2860256·2860268(앞서 실패 기동분 2858471·2858489 도 종료) · dev gateway PID 2868977 종료 → `ss -ltn` 에서 `3019`·`8197` listener 0(운영 3010·8100 은 내 것이 아니며 그대로). `ps` 에 내 next dev·run_gw_dev 잔존 0.
- **쿠키**: `c1`·`c2` shred 삭제 · `/tmp/qa026s2.out` 삭제 · 미러 `thekaiwa-dev-010b-ui/scratch/qa026s2/`(내가 만든 스크립트·temp.json·ids.json 9개) 삭제. 미러 3개(`010b-ui`·`026s2`·`010b`)는 보존(026s2 에는 내가 띄우다 실패한 `.next` 캐시가 남음 — 다음 사용 시 자동 재생성).
- **DB(QA 계정, 정확한 id 8방)**: Chat `cmutg6z3z0001w1zwd9f4ebkn`·`cmutg774j000dw1zwn0tr8vm4`(턴 시험) + `cmutga8840001w1du33gljrcy`·`cmutgabcx000fw1duax4l8l28`·`cmutgacdh000lw1dut1w3uwzg`·`cmutgacrx000pw1durdwf8dpw`·`cmutgadwh000vw1dusn9t25ip`·`cmutgaf3s0011w1du715rtke6`(임시 행). 삭제 전 `chats 8 · chatMessage 34 · correction 3(PROPOSED) · requestTrace 12 · learningObservation 3 · tutorProposal 4` → 삭제 후 재조회 **`{"chats":0,"chatMessage":0,"correction":0,"requestTrace":0,"learningObservation":0,"tutorProposal":0}`**. 설정값은 위 1 항에서 원복 확인. 남은 것: TALK 턴이 만든 TTS 캐시 wav(내용 해시 캐시, 만료 정리 대상 — 일부러 두었음).

```json
{ "taskId": "task-026", "status": "DONE", "deliverables": ["agent-vault/10-Flow/tasks/task-026-improve-hangul-reading.md (QA 기록 S2)"], "blockers": [], "risk_level": "LOW", "metrics": { "talk_p50_ms": null, "talk_p95_ms": null, "vocab_set_sec": null, "note": "S2 서버 묶음 — 30턴·단어 세트 지표는 범위 밖 NOT_VERIFIED. 참고: 턴 3건 4.8~6.6s, 재시도 번역 3건 2.3~3.0s" } }
```

## Leader 기록 (서버 묶음 운영 반영, 2026-10-04 15:55)
- 커밋 `f67bf70`(S1·userKo·burst 상한·S2) → webhook 배포(릴리스 `20261004-154727-f67bf709`, gateway 포함 pm2 3개 online·restart 0, health ok).
- 운영 스모크: 006 채팅 **42/42**(턴 p50 4.7s) · 007 회화 **45/45**. 운영 `/api/v1/text/annotate`(QA 세션) → `この町は静か` = `町{まち}`·`静{しず}か`·pron シズカ, available true — gateway 분석기 운영 동작 확인.
- 사용자 체감 변화 없음(화면 미적용) — 회화·채팅 응답에 내 말 번역 저장이 시작됨.
- **남은 것**: 화면 A(회화·채팅)·B(오늘의 회화·단어장·오늘의 단어·표현 점검·설정) — **데모 v2 approve(사용자 입력 문장) 대기**. 화면 인계: 한글 줄은 반드시 `hangulLine()`(O-1 を 보정은 이 경로에만), 단어장 한글은 표제어 annotate 의 `hangulLine`, 설정 3칸·내 말 번역·재시도 API(Developer S2 인계), localStorage readingDefault 이관, O-3 "참고 번역" 표기 검토.

## 사용자 지시 (2026-10-04 17:14) — 표시 문구
> "'후리가나' -> '히라가나' 로 문구 변경해줘"
- 적용: **사용자에게 보이는 모든 문구**에서 '후리가나' → '히라가나'(표시 바·도구 줄 버튼, 설정 스위치 "히라가나 보기", 토스트, 접근성 이름, 데모 설명). 기술 용어(코드 주석·설계 문서의 루비/furigana 설명)는 그대로.
- 운영 화면에는 현재 해당 문구 0건(화면 A·B 미구현) → 데모 v2 문구 수정·재게시(같은 URL, 승인 전이라 v2 유지·해시 재기록) + 구현 가이드·화면 서브태스크에 반영.
- [17:18] Leader: 문구 변경을 **데모 v3** 로(게이트가 같은 버전 재검토 거부) — v2 는 검토 원본으로 복원, v3 = v2 결정 그대로 + '히라가나' 문구. 같은 URL 에 v3 게시(Artifact Version 3), 게이트 changes_requested(사용자 원문) → review_requested v3(sha256 19b8ee5e…). 사용자 승인 문장은 "task-026 데모 v3 승인" 으로 받는다.
