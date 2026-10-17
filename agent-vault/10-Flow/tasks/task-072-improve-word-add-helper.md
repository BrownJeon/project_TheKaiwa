---
task_id: task-072
title: "단어 추가 시트에 일본어 도우미(가あ) 추가 — 회화방 도우미와 같은 방식(한국어 글자 질의 → 일본어 후보 → [표현 칸에 넣기]), 채팅방 없는 새 서버 입구"
status: doing
waiting: demo_review
base_ref: 746d54c
risk_level: "R1"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-056-improve-talk-phrase-helper, task-069-improve-word-add-mic, task-073-improve-word-add-copy, task-068-improve-wordbook]
imp: [IMP-0046]
tags:
  - type/task
  - domain/vocab
  - domain/conversation
  - domain/improvement
aliases:
  - 단어 추가 일본어 도우미
  - task-072
created: 2026-10-16
updated: 2026-10-17
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-072-word-helper-v1.html"
  artifact_url: "https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz"
  content_sha256: "b84f9cdfc0e29b7db5ec18832c2eb5222de1f2cb907da99cb5d79960b9237f33"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-17T14:29:18+09:00"
  approval_quote: "승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-072 — 단어 추가 일본어 도우미 (IMP-0046)

## 사용자 요청 (원문)
- 2026-10-15 밤: 「업로드한 사진의 표시한 영역에서의 회화 메뉴의 방식과 같이 일본어 도우미를 추가해줘.」 — 첨부 사진: 회화방 하단 입력 줄(왼쪽 키보드 · 가운데 마이크 · 오른쪽 둥근 「가あ」 = task-056 일본어 도우미)을 동그라미로 표시. 직전 대화는 단어 추가에서 「임팩트」를 말로 넣다 「インペクト」로 오인식되어 거절된 건.
- Leader 가 범위·내역을 정리(H-1 도우미 + W-2·W-3 문구, W-1·W-4 제외, 두 작업 분리) → 사용자 **「승인」**(2026-10-16). 이 task = **H-1**, 문구 두 건은 [[task-073-improve-word-add-copy]].

백로그: [[IMP-0046-word-add-japanese-helper]]

## judge 접수 (2026-10-16)
- `judge-result@2`: 유형 feature · 복잡도 1.62 · 위험 R1 · developer **sonnet** · **track standard** · 데모 **full**(`JV-ui_change`, owner designer, `demo_pref: "require"` — **사용자 요구가 아니라 Leader 승격 판단**: 새 화면 판 + 새 AI 호출 입구) · `next=demo_first` → **사용자가 데모를 승인하기 전에는 화면 코드를 쓰지 않는다.**
- 첫 판정은 요약의 「마이그레이션 없음」 문구가 R2 키워드(`R2-kw-migration`)에 걸려 R2 로 올라갔다(규칙이 글자만 본다 — 부정문도 걸림). 요약에서 그 단어를 빼고 재판정해 R1. DB 변경 없음은 사실.
- 역할: designer(데모) → prompt-engineer(한 단어 질의 실호출 확인) → developer(server+UI, 필요하면 2소환 분할) → reviewer → qa. 사용자 승인 없이 푸시·배포 금지.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 회화방 도우미 = [[task-056-improve-talk-phrase-helper]](사용자 승인 데모 v1, 결정 ①~⑦). 구성: 한국어 **글자** 질의(음성 제외 — 사용자 결정 「글자 입력으로 시작하자」, 온디바이스 인식기가 일본어 전용) · 후보 최대 3(첫 카드만 + [다른 말투 n개 더 보기]) · 카드 = 일본어 표현·읽기·한국어 뜻·재생·「왜 자연스러운지」·[입력창에 넣기] · 버튼 = 둥근 아이콘 44px + 처음 한 번 안내(`localStorage kaiwa.talk.helperTipSeen='1'`) · 서버 `POST /api/v1/chats/:id/phrase-help`(#180), `phraseHelp@v1`(haiku·12s·interactive 레인·재시도 없음), 분당 10·하루 300·동시 1건(`PHRASE_BUSY`), 질의 100자.
- 화면 설계 정본: `docs/screens.md` §22(회화방 일본어 도우미) · 데모 `docs/demo/task-056-talk-phrase-helper-v1.html`. 재사용 후보 컴포넌트: `src/components/talk/{PhraseHelperButton,PhraseHelperPanel,PhraseHelperCard,PhraseHelperTip,usePhraseHelper}.tsx`·`phraseHelperLogic.ts`·`helperCopy.ts` · 타입 `src/types/phraseHelp.ts`.
- 단어 추가 시트 현재 구조(task-068·069): 1단계 표현 입력 → [뜻 채우기](초안, 저장 안 됨) → 폼; 표현 칸 라벨 줄 오른쪽에 「말로 쓰기」(task-069). 같은 줄에 도우미 버튼이 들어와야 한다.
- 교훈: `/이슈기록 관련` 승인 교훈 없음. 내부 교훈(task-069·070·071): 순수 함수 + 소스 스캔 시험으로 배선 고정, 변이 점검, 소비처 회귀 표. **공용 `Sheet` 의 Tab 포커스 누출(기존)**·시트 안에서 또 시트를 겹치면 포커스·스크롤 문제가 커진다 → 판 형태 결정(D2)에 반영.

## 사실 (2026-10-16 직접 확인 — [확실])
- 회화방 도우미 서버 입구가 **채팅방에 묶여 있다**: `helpPhrase(userId, chatId, body, deps, signal)`(`conversation/chats/phraseHelp.ts:94`)가 대화 소유·`kind=TALK`·종료 여부·역할극 장면을 읽는다. 프롬프트 입력은 `{queryKo, level, scene}` 뿐 → 채팅방 없는 입구를 새로 만들면 프롬프트·검증·엔진·잠금을 재사용할 수 있다.
- 한도·동시성: `rateLimit('phrase-help:<uid>', 10)` · `phrase-help-day:<uid>`(300/일) · 프로세스 메모리 `inFlight`(사용자당 1건). Claude CLI 큐는 전체 직렬이라 도우미가 회화 턴 앞에 서면 회화가 그만큼 늦을 수 있다(task-056 기록).
- 프롬프트 `phraseHelp@v1` 은 「말하려는 표현」용(말투 변형 `labelKo`·`whyKo`)이다 — **한 단어 질의(「임팩트」)가 사전형 표제어(インパクト)로 나오는지는 아직 확인 안 함**(PE 실호출 필요).
- 한국어 음성 질의는 범위 밖(인식기 일본어 전용, 「안드로이드 기본 STT 미사용」 원칙).

## 열린 결정 (designer 가 데모에서 ★ 권고와 함께 보여 준다 — 사용자 승인 필요)
- **D1 버튼 위치·모양**: 표현 칸 라벨 줄 오른쪽 「말로 쓰기」 옆에 둥근 「가あ」 아이콘 44px(★ 회화방과 같은 아이콘·같은 모양, 라벨 줄 오른쪽 끝). 360/390/412px 에서 「말로 쓰기」와 함께 한 줄에 들어가는지 확인. 대안: 입력 칸 아래 줄.
- **D2 판 형태**: ★ 표현 칸 아래로 펼쳐지는 **시트 안 인라인 패널**(시트 위에 또 시트를 겹치지 않음 — 포커스·스크롤 위험). 대안: 별도 하위 시트.
- **D3 질의 입력**: ★ 한국어 **글자**만(회화방과 동일, 한글 1자 이상·100자), 음성 없음. 예시 placeholder 「예: 임팩트, 어색하다」.
- **D4 결과 카드**: ★ 일본어 표기(큰 글씨, 표시 설정의 히라가나·한글 반영) + 한국어 뜻 + 듣기 + [표현 칸에 넣기], 후보 최대 3(★ 첫 카드만 + [다른 후보 n개 더 보기]). 「왜 자연스러운지」 줄은 ★ **단어 추가에서는 숨김**(단어 하나에는 불필요, 회화방은 말투 설명용).
- **D5 [표현 칸에 넣기] 동작**: ★ 표현 칸을 **바꿔 넣고** 패널을 닫고 표현 칸에 포커스, **[뜻 채우기]는 자동 실행하지 않는다**(AI 는 제안만 — 사용자가 확인 후 누름). 대안: [넣고 뜻 채우기] 한 번에.
- **D6 처음 안내**: ★ 회화방과 같은 localStorage 플래그를 공유(`kaiwa.talk.helperTipSeen` — 이미 본 사용자는 다시 안 봄)하되 문구는 단어 추가용(「한국어로 물어보면 일본어 표현을 알려 줘요」). 대안: 별도 플래그.
- **D7 상태 화면**: 대기·입력 중·찾는 중(5초 안내)·결과·**빈 결과**(못 찾음)·**429 한도**·**409 `PHRASE_BUSY`**(「일본어 표현을 찾는 중이에요」)·오프라인·시간 초과(12초). 오류 문구는 `labels` 표(서버 문구 비노출)를 따른다.
- **D8 마이크·뜻 채우기와의 공존**: 도우미 패널이 열린 동안 「말로 쓰기」 열림 상태·[뜻 채우기]·[직접 입력하기]·[저장]이 서로 막히거나 겹치지 않게(상호 닫기 규칙 — 예: 도우미를 열면 말로 쓰기 닫기).
- **D9 표시 설정**: 결과 카드의 히라가나·한글 줄이 단어 추가 시트의 표시 설정(task-071 한글 줄 포함)을 따른다.

## Leader 결정 (서버·프롬프트·범위 — 사용자가 바꾸라면 바꾼다)
- **L1 새 입구**: 채팅방 없는 `POST /api/v1/words/phrase-help`(번호는 구현 지시 시점에 `api-contract.md` 에서 Leader 가 배정 — #180 은 회화 도우미, 재사용 금지 번호 확인). 본문 `{queryKo}`(회화 도우미와 같은 검증: 정리 뒤 1~100자·한글 1자 이상·≤1KB), 응답 `{items:[{ja, ko, labelKo?, whyKo?}]}`(1~3개, 못 찾음·거절은 `items:[]`). 오류: 401 · 400(한도 미소모) · 409 `PHRASE_BUSY` · 429 · 502/504.
- **L2 서버 재사용 방식**: `helpPhrase` 의 **채팅 의존(소유·종류·종료·장면)만 걷어낸** 함수(예: `helpWordPhrase(userId, body, deps, signal)`)를 같은 파일/모듈에 두고 **프롬프트·검증·엔진·재시도 정책·잠금은 그대로 공유**한다(복사 금지). `scene` 은 `null`, `level` 은 프로필. 6층 방향(route → conversation 모듈 → engine) 유지, 엔진명 비노출.
- **L3 한도·잠금은 회화 도우미와 공유**: 같은 사용자 키(`phrase-help:<uid>`·`phrase-help-day:<uid>`)와 `inFlight` 를 공유한다 — 합산 분당 10·하루 300·동시 1건. 단어 추가 중 회화 도우미(또는 반대)를 동시에 쓰면 `PHRASE_BUSY` — 화면이 그 문구를 부드럽게 안내(D7).
- **L4 프롬프트 확인(prompt-engineer, 데모 승인 후)**: `phraseHelp@v1` 에 한 단어 질의(임팩트·어색하다·귀찮다·설레다·눈치·분위기·긍정적·배달 등 ≥12종, 외래어·명사·형용사·동사 섞음)를 실호출로 넣어 **사전형 표제어가 후보 1순위로 나오는지**, 문장형(「インパクトがあります」)만 나오는지 표로 확인. 문장형이 많으면 입력에 `mode: 'word'` 를 더해 `phraseHelp@v2`(단어 모드: 사전형 표제어 + 한국어 뜻, 말투 변형·`labelKo` 없음)를 PE 가 설계 → Leader 결정(사용자에게 알림). 단어 모드가 필요 없으면 `v1` 그대로.
- **L5 저장·기록**: 질의·응답 원문은 저장하지 않고 `RequestTrace`·로그에 남기지 않는다(회화 도우미와 같은 규칙). **DB 변경 없음**, 새 환경변수 없음.
- **L6 범위 밖**: 단어 수정 시트·다른 화면·한국어 음성 질의·판정 실패 시 후보 자동 제안(W-1)·「도우미로 찾기」 연결 링크(필요하면 후속). 회화방 도우미 동작·문구는 바꾸지 않는다(공용 컴포넌트를 재사용·분리하더라도 **회화방 동작·시험은 그대로**).

## 구현 계획 (데모 승인 뒤)
1. **designer**(지금): `docs/demo/task-072-word-helper-v1.html`(full — 상태 전부, 360/390/412 3폭, 라이트/다크) + 구현 가이드 `docs/screens.md` §30(새 절) 초안. 회화방 데모·§22 를 바탕으로 하고 D1~D9 를 ★ 권고와 함께 보인다. 승인 전 화면 코드 금지.
2. **prompt-engineer**(승인 후): L4 실호출 확인 + 필요 시 `phraseHelp@v2` 와 회귀 픽스처. 레지스트리 동기화가 DB 쓰기를 요구하면 쓰지 말고 보고.
3. **developer**(승인 후): 서버(새 입구·함수·시험·`api-contract.md`) → 화면(버튼·인라인 패널·카드·상태·시험) 2소환 분할 가능. 재사용 가능한 회화방 조각은 동작 불변으로 분리·공유하거나 단어 전용 얇은 조각을 새로 만든다. 변이 점검·소비처(회화방) 회귀 표.
4. **reviewer** → **qa**(QA 계정만, 실제 Next 라우터·3폭·키보드 올라온 상태·표시 설정) → Leader. 푸시·배포는 사용자 승인 후.

## 완료 기준
1. 단어 추가 시트 표현 칸 옆 「가あ」 → 한국어로 「임팩트」 입력 → 일본어 후보(インパクト) → [표현 칸에 넣기] → 표현 칸에 들어가고 뜻 채우기는 사용자가 누른다.
2. 한도·동시성·오류·빈 결과·오프라인 상태가 데모대로 동작하고, 말로 쓰기·뜻 채우기·저장과 겹치지 않는다(3폭, 터치 44px, 가로 넘침 0).
3. 질의·응답 원문 미보관, DB 변경 없음, 회화방 도우미 동작 불변(시험으로 확인).
4. tsc 0 · eslint 0 · 시험 통과 · `next build` 0 · reviewer PASS · QA PASS · 사용자 폰 확인.

## 상태 로그
- 2026-10-16 사용자 「승인」(H-1+W-2+W-3, W-1·W-4 제외, 두 작업 분리) → IMP-0046 접수 → judge(feature·R1·standard·demo full(Leader 승격)·sonnet, 첫 판정 R2 는 「마이그레이션」 키워드 오탐) → 이력서 작성(D1~D9·L1~L6). 다음: 데모 게이트 init → designer 데모 v1.
- 2026-10-16 09:30 [designer] 데모 v1 `docs/demo/task-072-word-helper-v1.html`(full — 상태 31·세 폭·현재 vs 제안·결정 D1~D9 + designer 추가 D1′·D6′, ★ 바꾼 것 없음) lint `DEMO_LINT_PASSED`(sha256 앞 16자 `b84f9cdfc0e29b7d`), 자체 시험 1,209칸 넘침 0·작은 터치 0 · 가이드 초안 `docs/screens.md` §30(승인 전) · 기록 [[task-072-designer-record]](질문 Q1~Q7). 다음: Leader 데모 게이트 상태 전이·Artifact 게시 → 사용자 승인.

- 2026-10-16 Leader: designer 데모 v1(`docs/demo/task-072-word-helper-v1.html`, 88KB·상태 31개·3폭·라이트/다크·결정 D1~D9, lint 통과, designer 자체 시험 1,209건 가로 넘침 0·44px 미만 터치 0) **전체를 읽고 확인** — 외부 요청·실데이터 없음. 비공개 Artifact 게시 https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz → 게이트 `review_requested` v1(sha256 `b84f9cdf…`). **사용자 검토 대기** — 승인 전 화면 코드 금지. 구현 때 지킬 함정(designer): 패널이 1단계 `<form>` 안이라 질의 칸 Enter 를 막아야 하고(안 막으면 [뜻 채우기] 실행), 공용 Sheet 는 Esc 로 시트 전체를 닫으므로 패널에서 Esc 전파를 막아야 함. 순서: task-073(`WordMicField`·`labels.ts` 수정)이 먼저 끝나야 072 의 라벨 줄 자리를 넣을 수 있다.

## 사용자 데모 승인 (2026-10-17)
- 사용자 **「승인」**(단독 한 단어) — `check.mjs approve --version 1 --quote "승인"` 기록(`approved_at 2026-10-17T14:29:18+09:00`, sha256 `b84f9cdf…`). **Leader 해석(사용자에게 보고)**: 직전 메시지에 데모 두 개(073·072)와 각 ★ 권고(D5·D6·D7·D1′·Q4·Q5)가 있었고 「권고대로」라고만 하셔도 된다고 안내했으므로 **★ 권고 그대로 승인**한 것으로 본다. 즉 D5 넣기만(뜻 채우기는 사용자가) · D6 회화방과 플래그 공유(**회화방 안내를 이미 본 사용자는 단어 시트 안내를 한 번도 못 봄 — 이 결과를 감수**) · D7 409 전용 문구 · D1′ 1단계만 · Q4 찾는 중 [그만두기] · Q5 한글 없는 질의를 화면이 먼저 막기. 사용자가 다르게 뜻했다면 구현 전에 바로잡는다.
- 다음: **prompt-engineer 가 L4(한 단어 질의 → 사전형 표제어인지) 실호출 확인**(진행 중) → 결과에 따라 `phraseHelp@v2`(단어 모드) 여부 결정 → developer 서버(새 입구 `words/phrase-help`) → 화면. **순서 주의**: 화면 작업은 task-073(`WordMicField`·`labels.ts` 수정) 보완 라운드·배포가 끝난 뒤에 시작(같은 라벨 줄 파일). 데모 게이트 `activate` 는 화면 구현 시작 때.
- 2026-10-17 14:55 [prompt-engineer] L4 완료 — `phraseHelp@v1` 한 단어 질의 15종×2회 실호출: 1순위 사전형 표제어 **0/19**, 빈 결과 11/30(37%) → **단어 모드(`mode:'word'`, `phraseHelp@v2`) 구현**(1순위 문장·활용형 0/30, 사전형 26/30(87%), 빈 결과 0, 1차 위반 0, p50 2.5s·p95 3.4s). 회화방 기본 모드는 v1 해시로 고정(바이트 동일). tsc 0·eslint 0·conversation 1,225·전체 4,176(실패 0)·next build 0·변이 14/14. 라벨은 코드 상수라 DB 쓰기·`prompts:sync` 없음. 변경: `prompts/phraseHelp.ts`·`structuredResponse/phraseHelp.ts`·시험 `phraseHelpWord.test.ts`·픽스처/하네스 `tests/prompts/phrase-help-word*`. developer 몫: 서버 함수에서 `mode:'word'` 고정 + `index.ts` 재내보내기 · 기록 [[task-072-pe-record]]
- 2026-10-17 15:20 [developer] 서버 부분 완료 — 새 입구 #181 `POST /api/v1/words/phrase-help`(`helpWordPhrase`: 채팅 의존만 걷고 잠금·엔진·취소·Trace 를 `helpPhrase` 와 내부 조각으로 공유, `mode:'word'`·수준=프로필·장면 null 서버 고정, 한도 키·`inFlight` 잠금 #180 과 공유, 저장·원문 로그 0) + `index.ts` 공개 + 화면용 타입 + `api-contract.md` §1-5 #181. 새 시험 24건, tsc 0·eslint 0·conversation 1,249/0 fail·전체 4,200 중 4,198 통과(실패 0·skip 2)·next build 0·변이 19/19. **화면은 073 배포 뒤.** 기록 [[task-072-dev-server-record]]

## L4 결과 — 단어 모드 필요(prompt-engineer, 2026-10-17)
- **`phraseHelp@v1` 은 한 단어 질의에 부적합**(실호출 15종×2=30건): 1순위가 사전형 표제어인 응답 **0/19**, OK 응답은 전부 문장형(`ストレスです。`), **11/30(37%)은 `NOT_A_PHRASE` 빈 결과** — 데모의 [추측](문장이 1순위로 올 수 있음)이 맞았다. **단어 모드(`mode:'word'`, `phraseHelp@v2`)**: 같은 15종×2 — 문장·활용형 1순위 0/30, 사전형 26/30(87%, 나머지 4건은 관용구 한 덩어리: 空気を読む ×2·違和感がある ×2), 빈 결과·1차 계약 위반 0, 외래어 6/6 가타카나, p50 2.5s·p95 3.4s(12초 예산 안). **회화방 불변**: mode 생략 시 system 7종·요청 3종·본문 3종이 v1 과 바이트 동일(SHA-256 시험으로 고정), 회귀 실호출 10/10. 버전은 코드 상수 라벨(DB 쓰기·`prompts:sync` 불필요). PE 증빙: tsc 0·eslint 0·conversation 1,225 통과·전체 4,176 중 4,174 통과(실패 0·건너뜀 2)·build 0·변이 14/14.
- **한계**: 「어색하다」는 1순위가 구절(違和感がある) 2/2. 2순위 이하 후보 21개 중 약 6개가 뜻이 어긋난 연상 낱말.
- **Leader 결정(사용자에게 알림)**: **후보 상한은 승인된 3개 유지** — 화면이 첫 카드만 보이고 나머지는 「더 보기」로 접히며 각 후보에 한국어 뜻이 함께 보이고(AI 는 제안만), 2개로 줄이면 승인된 데모(D4)를 바꾸게 된다. 폰에서 어긋난 후보가 거슬리면 2개로 줄이는 후속 조정 가능.
- **API 번호 #181 배정**(코드·`docs/design`·계약 문서에서 미사용 확인 — task-066 기록의 「가칭 #181」은 실제 라우트가 없는 가칭뿐).
- **다음**: developer(sonnet) **서버 부분만** 소환(새 입구 `POST /api/v1/words/phrase-help`·`helpWordPhrase`·한도/잠금 공유·api-contract) — 화면은 task-073 배포 뒤.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다(`check.mjs init` 이 기록). 이 표는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성 전 | - | - | judge: full (JV-ui_change, Leader 승격 demo_pref=require) | 10-16 |
| v1 | 검토요청 | docs/demo/task-072-word-helper-v1.html (sha256 `b84f9cdf…`) | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | 사용자 검토 요청(결정 D1~D9·D1′·D6′, 질문 Q1~Q5) | 10-16 |
| - | 작성중 | - | - | judge: full (JV-ui_change) | 10-16 09:10 |
| v1 | 검토요청 | docs/demo/task-072-word-helper-v1.html | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | 사용자 검토 요청 | 10-16 09:32 |
| v1 | 승인 | docs/demo/task-072-word-helper-v1.html | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | "승인" | 10-17 14:29 |
