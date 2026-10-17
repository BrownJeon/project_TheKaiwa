---
task_id: task-072
title: "단어 추가 시트에 일본어 도우미(가あ) 추가 — 회화방 도우미와 같은 방식(한국어 글자 질의 → 일본어 후보 → [표현 칸에 넣기]), 채팅방 없는 새 서버 입구"
status: doing
waiting: device_verify
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
  active: true
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
- 2026-10-17 22:55 [developer] 화면(UI) 구현 완료 → [[task-072-dev-ui-record]]. 공용 `Sheet` Esc 한 줄(`!e.defaultPrevented`, Leader Q1=A) · `WordMicField` 슬롯 · 새 vocab 파일 9개(코드 6·시험 3, 52건) · `WordAddSheet` 배선. tsc 0 · eslint error 0 · 전체 시험 4,263 중 pass 4,261/fail 0/skip 2 · next build 0 · 변이 20/20 · talk·package.json 무수정. 한계: jsdom 없어 Enter/Esc/초점 실동작은 QA 확인(특히 Esc 순서 가정). 다음: reviewer → qa.
- 2026-10-17 [reviewer] 화면(UI) 독립 감사 REV-072U **PASS_WITH_NOTES**(Critical 0·High 0·Medium 1·Low 4; Medium = 훅 전이·카드 클릭 값을 소스 스캔만으로 고정해 동작 변이 5개가 시험을 통과) → [[task-072-rev-ui-record]]. 공용 `Sheet` Esc 순서 가정 **검증됨**(jsdom: `createRoot`/`hydrateRoot(document)` 둘 다, 패널·가あ Esc 시트 유지), 닫기 방식이 달라지는 기존 시트 경로 0, 실제 `WordAddSheet` jsdom 하네스 32/32, 073 `WordMicField` HEAD 대비 7상태 바이트 동일, tsc 0·eslint 0·시험 4,263 중 4,261(실패 0)·build 0 재현. QA 몫: 실제 Esc(WebView)·Enter 암묵 제출·초점·3폭·401 HTTP.
- 2026-10-17 밤 [qa] 서버 #181 실제 HTTP(401/400/429/409/취소/원문 미기록) + 화면 실 Chrome(3폭×2높이·다크·글꼴 근사·Esc 7곳·Enter·IME·서로 닫기·요청 abort 관측·소리 정지·073 회귀·XSS·엔진명) **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 2 — L-A abort 직후 수십 ms 재호출 409(Q2 알려진 한계), L-B 공용 Sheet 포커스 가두기 없음(072 이전부터)) · 미검증 = 푸시투토크 Esc·회화방 교차 409/회귀·수정 시트 실화면·실기기(마이크·TalkBack·IME·스피커·키보드) → [[task-072-qa-record]] 「최종 판정」. 임시 서버·쿠키·`.env`·스크린샷 정리 완료.

## 사용자 데모 승인 (2026-10-17)
- 사용자 **「승인」**(단독 한 단어) — `check.mjs approve --version 1 --quote "승인"` 기록(`approved_at 2026-10-17T14:29:18+09:00`, sha256 `b84f9cdf…`). **Leader 해석(사용자에게 보고)**: 직전 메시지에 데모 두 개(073·072)와 각 ★ 권고(D5·D6·D7·D1′·Q4·Q5)가 있었고 「권고대로」라고만 하셔도 된다고 안내했으므로 **★ 권고 그대로 승인**한 것으로 본다. 즉 D5 넣기만(뜻 채우기는 사용자가) · D6 회화방과 플래그 공유(**회화방 안내를 이미 본 사용자는 단어 시트 안내를 한 번도 못 봄 — 이 결과를 감수**) · D7 409 전용 문구 · D1′ 1단계만 · Q4 찾는 중 [그만두기] · Q5 한글 없는 질의를 화면이 먼저 막기. 사용자가 다르게 뜻했다면 구현 전에 바로잡는다.
- 다음: **prompt-engineer 가 L4(한 단어 질의 → 사전형 표제어인지) 실호출 확인**(진행 중) → 결과에 따라 `phraseHelp@v2`(단어 모드) 여부 결정 → developer 서버(새 입구 `words/phrase-help`) → 화면. **순서 주의**: 화면 작업은 task-073(`WordMicField`·`labels.ts` 수정) 보완 라운드·배포가 끝난 뒤에 시작(같은 라벨 줄 파일). 데모 게이트 `activate` 는 화면 구현 시작 때.
- 2026-10-17 14:55 [prompt-engineer] L4 완료 — `phraseHelp@v1` 한 단어 질의 15종×2회 실호출: 1순위 사전형 표제어 **0/19**, 빈 결과 11/30(37%) → **단어 모드(`mode:'word'`, `phraseHelp@v2`) 구현**(1순위 문장·활용형 0/30, 사전형 26/30(87%), 빈 결과 0, 1차 위반 0, p50 2.5s·p95 3.4s). 회화방 기본 모드는 v1 해시로 고정(바이트 동일). tsc 0·eslint 0·conversation 1,225·전체 4,176(실패 0)·next build 0·변이 14/14. 라벨은 코드 상수라 DB 쓰기·`prompts:sync` 없음. 변경: `prompts/phraseHelp.ts`·`structuredResponse/phraseHelp.ts`·시험 `phraseHelpWord.test.ts`·픽스처/하네스 `tests/prompts/phrase-help-word*`. developer 몫: 서버 함수에서 `mode:'word'` 고정 + `index.ts` 재내보내기 · 기록 [[task-072-pe-record]]
- 2026-10-17 15:20 [developer] 서버 부분 완료 — 새 입구 #181 `POST /api/v1/words/phrase-help`(`helpWordPhrase`: 채팅 의존만 걷고 잠금·엔진·취소·Trace 를 `helpPhrase` 와 내부 조각으로 공유, `mode:'word'`·수준=프로필·장면 null 서버 고정, 한도 키·`inFlight` 잠금 #180 과 공유, 저장·원문 로그 0) + `index.ts` 공개 + 화면용 타입 + `api-contract.md` §1-5 #181. 새 시험 24건, tsc 0·eslint 0·conversation 1,249/0 fail·전체 4,200 중 4,198 통과(실패 0·skip 2)·next build 0·변이 19/19. **화면은 073 배포 뒤.** 기록 [[task-072-dev-server-record]]
- 2026-10-17 [reviewer] 서버 부분 독립 감사 **PASS_WITH_NOTES**(Critical 0·High 0·Medium 1·Low 5) — 회화방 #180 은 HEAD 와 입출력 바이트 동일(요청 3,600조합·보정 480조합·`helpPhrase` 11시나리오·Trace 키), #181 은 실제 라우트 핸들러 in-process 8/8(401·400 한도 미소모·429 합산+`Retry-After`·409 양방향·502/504·취소·원문 0). tsc 0·eslint 0·conversation 1,249/0·전체 4,200 중 4,198 통과(실패 0)·next build 0. 변이 12개 중 10 잡힘·2 생존(잠금 원자성 시험 없음·라우트 `await` 스캔). **Medium M-1: 단어 모드가 `감사합니다`·`죄송합니다` 같은 정형 인사에서 502**(실호출 2/5, 3/5 는 빈 결과) — PE/Developer 보정 권고, 화면 작업은 막지 않음. QA 는 실제 HTTP 로 401·400·429·409·취소·원문 미기록 확인 필요. 기록 [[task-072-rev-server-record]]
- 2026-10-17 [developer] 감사 후 보완 라운드 완료 — M-1: 단어 모드에서 표제어가 하나도 없고 이유가 `JA_NOT_WORD` 뿐이면(정형 인사 `ありがとうございます` 류) 새 최종 상태 `NOT_A_WORD` → 재시도는 그대로 1회, 마지막 시도는 502 가 아니라 200 `{items:[]}`(다른 위반이 섞이면 INVALID 502 그대로) · L-1: 같은 틱 동시 호출 3건 중 정확히 1건 통과 시험 추가(감사 변이 X1 포착) · 회화 모드는 이전 소스와 336,000조합 바이트 동일 · 변이 14/14 포착 · tsc 0·eslint 0·시험 4,211 중 4,209(실패 0, skip 2)·build 0 · 정형 인사 실호출 8행: 200 빈 목록 7·200 표제어 1·502 0(재시도 탄 건 4.5~6.3초 — 5초 예산 초과, 12초 안) → [[task-072-dev-server-record]] §10
- 2026-10-17 [reviewer] 서버 보완 라운드 재감사 REV-072S2 **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 4) — M-1 해소 확인: 단어 모드 `NOT_A_WORD` 는 「남은 항목 0 + 이유가 `JA_NOT_WORD` 뿐」일 때만(독립 오라클 대조 30,941조합 일치), 회화 모드 247,528조합 바이트 동일·`NOT_A_WORD` 0건, developer 차분 시험 직접 재실행 일치, 실제 라우트 핸들러 in-process 13/13(NOT_A_WORD 200 빈 목록·섞이면 502·한도 소모·#180 불변), 변이 12개 중 11 포착(X1 이번에 포착)·X2 생존(Low 유지), tsc 0·eslint 0·conversation 1,260/0·전체 4,211 중 4,209 통과·build 0, 실호출 감사합니다 2/2 → 200 빈 목록(4.5~4.7초, 모델 2회). QA 기대값 갱신: 정형 인사 502 → 200 `{items: []}`. 상세 [[task-072-rev-server-record]] 「재감사 (REV-072S2)」.
- 2026-10-17 22:20 [designer] 화면 구현 가이드 **확정** — `docs/screens.md` §30(줄 13403~13835, 「사용자 데모 승인 2026-10-17(v1, ★ 권고)」, §30 밖 무변경·데모 파일 무수정). 바뀐 것: talk 무수정 전환(카드 `vocab/WordHelperCard` 새로·패널 id `HELPER_PANEL_ID` 재사용·실패 분류는 요청 래퍼의 `wordHelperFailureOf`) · #181 `{ja,ko}` 만(꼬리표·요약 없음 = 데모와 보이는 차이 1건, REV L-4) · Esc 실제 원인(`document` 리스너 공유) 정정 → 공용 `Sheet` 한 줄 `!e.defaultPrevented` 권고 · 공용 `Skeleton` 금지 · 073 안내 보존(`mic.target==='surface'` 일 때만 `mic.close`, 넣기는 `mic.edited`) · 정형 인사 502/빈 목록 막다른 길 없음 · 시험은 순수 함수+정적 렌더+소스 스캔(jsdom 없음). Leader 질문 Q1~Q5(Sheet 한 줄·[그만두기] 직후 409 문구·빈 결과 힌트 문구·요약 칸·jsdom). 기록 [[task-072-designer-record]] 「가이드 확정」

## L4 결과 — 단어 모드 필요(prompt-engineer, 2026-10-17)
- **`phraseHelp@v1` 은 한 단어 질의에 부적합**(실호출 15종×2=30건): 1순위가 사전형 표제어인 응답 **0/19**, OK 응답은 전부 문장형(`ストレスです。`), **11/30(37%)은 `NOT_A_PHRASE` 빈 결과** — 데모의 [추측](문장이 1순위로 올 수 있음)이 맞았다. **단어 모드(`mode:'word'`, `phraseHelp@v2`)**: 같은 15종×2 — 문장·활용형 1순위 0/30, 사전형 26/30(87%, 나머지 4건은 관용구 한 덩어리: 空気を読む ×2·違和感がある ×2), 빈 결과·1차 계약 위반 0, 외래어 6/6 가타카나, p50 2.5s·p95 3.4s(12초 예산 안). **회화방 불변**: mode 생략 시 system 7종·요청 3종·본문 3종이 v1 과 바이트 동일(SHA-256 시험으로 고정), 회귀 실호출 10/10. 버전은 코드 상수 라벨(DB 쓰기·`prompts:sync` 불필요). PE 증빙: tsc 0·eslint 0·conversation 1,225 통과·전체 4,176 중 4,174 통과(실패 0·건너뜀 2)·build 0·변이 14/14.
- **한계**: 「어색하다」는 1순위가 구절(違和感がある) 2/2. 2순위 이하 후보 21개 중 약 6개가 뜻이 어긋난 연상 낱말.
- **Leader 결정(사용자에게 알림)**: **후보 상한은 승인된 3개 유지** — 화면이 첫 카드만 보이고 나머지는 「더 보기」로 접히며 각 후보에 한국어 뜻이 함께 보이고(AI 는 제안만), 2개로 줄이면 승인된 데모(D4)를 바꾸게 된다. 폰에서 어긋난 후보가 거슬리면 2개로 줄이는 후속 조정 가능.
- **API 번호 #181 배정**(코드·`docs/design`·계약 문서에서 미사용 확인 — task-066 기록의 「가칭 #181」은 실제 라우트가 없는 가칭뿐).
- **다음**: developer(sonnet) **서버 부분만** 소환(새 입구 `POST /api/v1/words/phrase-help`·`helpWordPhrase`·한도/잠금 공유·api-contract) — 화면은 task-073 배포 뒤.

## 서버 감사·보완·화면 착수 (2026-10-17 밤, Leader 결정 — 사용자가 바꾸라면 바꾼다)
- **서버 감사 REV-072S**(PASS_WITH_NOTES, Critical 0·High 0·Medium 1·Low 5) → **M-1**: 단어 모드에서 정형 인사(감사합니다·죄송합니다 → `ありがとうございます` 꼬리)가 `JA_NOT_WORD` 로 전부 버려져 재시도도 같으면 **502**. 회화방(#180) 바이트 불변·#181 계약(401/400/429/409/502/504/취소)은 실제 핸들러로 통과. 기록 [[task-072-rev-server-record]].
- **M-1 처리(Leader)**: 재시도는 유지하고, 「남은 항목 0개 + 이유가 `JA_NOT_WORD` 뿐」이면 502 대신 새 최종 상태 `NOT_A_WORD` → **200 빈 목록**(사유 구분 안 함). 프롬프트는 안 바꿈. 인사를 사전형으로 풀어 주는 개선(`감사합니다`→`ありがとう`)은 **PE 별도 작업**으로 남김(사용자가 원하면). L-1(동시 호출 원자성) 시험 추가. developer 보완 [[task-072-dev-server-record]] §10 — 변이 14/14, 전체 4,211 중 4,209(실패 0), 정형 인사 실호출 12회 중 502 0·`ありがとう` 1회. **재감사 REV-072S2 PASS_WITH_NOTES(Critical 0·High 0·Medium 0·Low 4)** — 30,941조합 오라클 대조·회화 모드 247,528조합 바이트 동일.
- **알려진 한계(수용)**: ① 정형 인사는 모델 2회로 4.5~6.3초(5초 예산 초과, 12초 한도 안) ② `NOT_A_WORD` 는 정형 인사만이 아니라 꼬리 없는 17자 이상 복합어·쉼표 든 한 항목도 같은 경로(L-7) → 운영에서 Trace `outcome=NOT_A_WORD` 비율을 보면 모델 품질 저하를 알 수 있다 ③ 라우트 `await requireSession()` 누락은 소스 스캔 시험이 못 잡음(L-2) → **QA 가 실제 HTTP 401 확인 필수** ④ `finalizePhraseHelp` 주석에 `NOT_A_WORD` 누락(Low, PE 영역).
- **화면 가이드 확정**: designer `docs/screens.md` §30 확정(13403~13835줄, [[task-072-designer-record]] 「가이드 확정」). 초안의 처방 2개를 바로잡음 — ⓐ Esc: `stopPropagation` 으로는 `document` 의 `Sheet` 리스너를 못 막는다(Next 16 `hydrateRoot(document)`) ⓑ 회화방 부품(`PhraseHelperButton`·`PhraseHelperCard`) 확장 대신 **회화방 한 줄도 안 고치는** 새 `vocab/WordHelperCard`. 데모와 다른 눈에 보이는 점 1건 = 단어 모드는 `labelKo` 를 안 보내 카드 꼬리표·[다른 후보] 요약이 사라짐.
- **Leader 결정 Q1~Q5**: Q1 = **A 승인** — 공용 `common/Sheet.tsx` Esc 를 `if (e.key === 'Escape' && !e.defaultPrevented) onClose()` 한 줄로(영향: `PushToTalkButton` 녹음 중 Esc 가 지금은 녹음 취소+시트 닫힘, 변경 후 녹음 취소만. 직접 코드 확인 `Sheet.tsx:53`) — **공용 부품이라 고정 시험 필수·reviewer 전수 확인** · Q2 D7 문구 그대로, 자기 [그만두기] 직후 몇 초 409 가능은 알려진 한계 · Q3 데모에 없는 문구 추가 안 함(데모 v2 불필요) · Q4 [다른 후보] 요약 칸 비움 · Q5 jsdom 의존성 추가 안 함(`package.json` 불변).
- **데모 게이트 activate 완료**(`DEMO_GATE_PASSED`·approved v1·hash verified) → developer(UI, Sonnet) 소환. 진행은 [[task-072-dev-ui-record]]. 다음: UI 완료 → reviewer(공용 `Sheet` 전수 포함) → QA(실제 HTTP 401·정형 인사 200 빈 목록·3폭·Esc·409 등) → 사용자 배포 승인.
- 절차 메모: 서버 감사 에이전트 1차가 60턴 한도에서 보고문이 잘렸으나 기록 파일은 완결 → 기록 파일을 직접 읽어 확인(알림 본문 신뢰 금지 원칙 유지).

## 화면 감사·QA·운영 배포 (2026-10-17 밤~10-18)
- **화면 감사 REV-072U**: PASS_WITH_NOTES(Critical 0·High 0·Medium 1·Low 4) → [[task-072-rev-ui-record]]. **Esc 순서 가정 [확실]**: jsdom 26.1+react-dom 19.2.8 에서 `createRoot`·`hydrateRoot(document)` 둘 다 재현 — 패널 안 Esc 는 판만 닫고 시트 유지, 패널 밖 Esc 는 시트 닫힘, 가드를 지우면 하네스 FAIL(검출력 확인). `Sheet` 사용처 43개 파일 전수: 닫기 방식이 달라지는 기존 경로는 단어 추가 시트 한 곳. Medium M-1 = 훅 전이·카드 클릭 값 시험이 소스 스캔뿐(감사자 동작 변이 17개 중 5개 생존; 현재 코드는 jsdom 32/32) → **Leader 결정: 이번 배포 전 시험 보강 안 함(후속)**, QA 가 해당 5동작을 실제 브라우저로 확인. 개발자 기록의 「변이 20/20」은 소스 문자열 스캔 변이였음.
- **judge C2**: `codex_required=false`, 사유 `CX-limit-unknown-hold`(Codex 남은 한도 측정이 2026-09-27 이후 stale → 보류). 도구는 Codex 를 원했고(`wanted_before_budget`) 초점은 `design_assumption`(Esc 순서) — jsdom 재현·QA 실브라우저로 대체. Codex 외부 검토는 사용자가 원하면 한도 확인 후 가능.
- **QA 최종 PASS_WITH_NOTES(Critical 0·High 0·Medium 0·Low 2)** → [[task-072-qa-record]]. 실서버(3011, `APP_ENV=LOCAL`)·실제 Chrome·실제 HTTP: 401(15종+)·400(15종, 한도 미소모)·429+`Retry-After`·409 `PHRASE_BUSY`·취소·원문 미기록(서버 로그·RequestTrace)·정형 인사 200 빈 목록(모델 변동으로 표제어 1개가 나오는 경우도 있음 — 모두 200)·Esc 7곳·다른 시트 5곳 Esc 회귀 0·Enter 암묵 제출 없음·서로 닫기·소리 정지·낭독 줄 초기화·073 회귀 없음·3폭×2높이+다크+글꼴 130% 근사 가로 넘침 0·콘솔 오류 0. **Low**: L-A 취소 직후 수십 ms 안 재호출 409(Q2 수용 한계) · L-B 공용 `Sheet` 에 포커스 가두기 없어 Tab 이 시트 밖으로 샘(기존 동작, 072 무관 → `/개선작업` 후보). **미검증**: 회화방 #180↔#181 교차 409·#180 실호출 회귀(QA 계정에 TALK 채팅 0개; reviewer in-process 247,528조합 바이트 동일로 갈음)·질문 탭 PushToTalk Esc·단어 수정 시트에 가あ 없음의 실화면·실마이크/TalkBack/IME 조합 중 Esc/실기기 키보드/스피커/하루 300 한도. 정리 확인(서버 PID 종료·3011 비움·`.env`·쿠키·스크린샷 삭제).
- **푸시 전 게이트**(HEAD `9a7d267` 별도 미러): prisma 0·tsc 0·eslint 0(경고 5, 기존)·전체 시험 4,263 중 4,261 통과·실패 0·건너뜀 2·`next build` 0.
- **운영 배포 완료**: 사용자 **「지금 커밋·푸시·배포 (권장)」**(AskUserQuestion) → 커밋 `c9ae9f5`(코드·시험·설계 25파일)·`9a7d267`(vault 기록 8파일) → push `b9ce154..9a7d267`(073 배포 기록 문서 커밋 `800ff6b` 동봉) → 웹훅 `RELEASE_RESULT` ok · **릴리스 `20261018-003211-9a7d2672`** · `migrated:false` · **롤백 대상 `20261017-214103-b9ce1546`**. 웹만 배포(DB·네이티브 변경 없음, APK 재빌드 불필요).
- **배포 후 확인(Leader 직접, 읽기 전용 [확실])**: `current` 일치 · health PRODUCTION ok 11/11 degraded [] · pm2 3 online restarts 0 · 번들에 새 문구(「표현 칸에 넣기」「찾기를 멈췄어요」「다른 후보」「물어보기」) 있음 · 라우트 `/api/v1/words/phrase-help` 존재 · 엔진명: 클라이언트 번들 `sherpa` 1건 = `Plugins.SherpaStt` Capacitor 플러그인 식별자(직전 릴리스에도 같은 파일에 동일, 화면 문구 아님), reazon·whisper·style-bert 0. **운영 #181 실호출(QA2 임시 쿠키·127.0.0.1)**: 쿠키 없음 401 · `{queryKo:'abc'}` 400 `no_hangul` · `mode` 키 400 · `임팩트` → 200 `items:[{ja:'インパクト',ko:'영향력, 충격적인 효과'}]` 2.4초 `Cache-Control: private, no-store`. **운영 화면(모의 응답, 단어 저장 POST 차단)**: 처음 안내·「일본어 도우미」 버튼 1개·패널 열림(초점=질의 칸)·Enter 시 도우미 요청 정확히 1건(본문 `{"queryKo":"임팩트"}`)·카드 `インパクト`+[표현 칸에 넣기]·패널 안 Esc=판만 닫고 시트 유지·넣기=`インパクト` 입력·표현 칸 Esc=시트 닫힘·단어 저장 시도 0·콘솔 오류 0. 쿠키·미러 `.env` 삭제 확인.
- **정정(이전 보고의 오류)**: task-073 배포 확인에서 「엔진명 클라이언트 번들 0건」은 존재하지 않는 경로(`.next/static/chunks/app` — 이 Next 16 빌드에는 없음)를 검색한 공허한 통과였다. 실제 범위(`.next/static/chunks`)로는 위의 `SherpaStt` 식별자 1건뿐(073 이전 릴리스에도 동일 파일) → 결론은 같으나 근거를 바로잡는다.
- **알려진 한계(수용)**: 정형 인사는 모델 2회로 4.5~6.3초(5초 예산 초과, 12초 한도 안)이고 표제어가 나오기도·안 나오기도 한다 · `NOT_A_WORD` 가 정형 인사 외 입력(17자 이상 복합어·쉼표 한 항목)에도 걸림 → 운영 Trace `outcome=NOT_A_WORD` 비율로 모델 품질 저하 감시 · 자기 [그만두기] 직후 몇 초 409 가능(D7 문구) · 처음 안내 플래그는 회화방과 양방향 공유(D6) · 후보 상한 3개(PE 관찰: 2번째 이후 후보 약 6/21 어색 → 2개로 줄일지 재결정 가능) · 시험 보강 M-1 후속 · 기존 `Sheet` 포커스 가두기 없음(L-B).
- **사용자 폰 확인 항목(IMP-0046 → 확인 후 `done`)**: ① 단어 추가 시트 표현 라벨 줄의 「가あ」 버튼 위치(오른쪽 끝)·처음 안내 한 번 ② 「임팩트」「어색하다」「귀찮다」를 물어 후보 카드(일본어+한글 뜻)·[표현 칸에 넣기]로 일본어가 들어감(저장·뜻 채우기는 자동 실행 안 됨) ③ 패널 열고 폰의 뒤로가기·Esc 상당 동작·키보드 내림 ④ TalkBack 으로 「표현 N개를 찾았어요」·「표현 칸에 ‘インパクト’를 넣었어요」가 한 번만 읽힘(가あ 다시 열 때 재낭독 여부) ⑤ 「말로 쓰기」와 가あ 서로 닫힘, 073 안내(「알아들은 말…」) 그대로 ⑥ **회화방 일본어 도우미(task-056)가 예전처럼 동작**(이번에 같은 파일을 재배치함 — 실서버 회귀 미검증) ⑦ 글꼴 130%·키보드가 올라온 상태에서 가려지지 않음 ⑧ 정형 인사(「감사합니다」)를 물었을 때 오류 화면이 아니라 「못 찾았어요」 계열 안내 + 직접 입력으로 계속 가능.

## 최종 요약 (사용자용)
- **한 일**: 단어 추가 시트의 표현 칸 옆에 「일본어 도우미」(가あ) 버튼을 달았습니다. 누르면 그 자리에 작은 패널이 열리고, 모르는 말을 한국어로 물으면(예: 임팩트) 일본어 후보 최대 3개가 일본어·한글 뜻 카드로 나옵니다. [표현 칸에 넣기]를 누르면 표현 칸에 **채우기만** 하고, 저장이나 뜻 채우기는 사용자가 따로 누르기 전에는 일어나지 않습니다. 회화방의 일본어 도우미와 같은 방식이고, 하루·분당 사용 한도와 동시 요청 잠금은 회화방 도우미와 합쳐서 셉니다.
- **결과**: 운영 배포 완료(릴리스 `20261018-003211-9a7d2672`). 운영에서 `임팩트` → `インパクト` 확인, 패널 안에서 Esc 를 누르면 패널만 닫히고 시트는 남는 것도 확인했습니다. 서버·화면 모두 독립 감사와 QA 를 통과했습니다(결함: Critical~Medium 0).
- **공용 부품 변경 1건**: 모든 시트가 쓰는 `Sheet` 가 「이미 처리된 Esc 는 닫지 않기」로 바뀌었습니다. 영향받는 기존 경로는 단어 추가 시트 한 곳뿐임을 확인했습니다.
- **알아 둘 것**: 「감사합니다」 같은 정형 인사는 후보가 안 나올 수 있습니다(오류 화면 대신 「못 찾았어요」). 이 경우 표현 칸에 직접 적으시면 됩니다. 인사를 사전형(ありがとう)으로 풀어 주는 개선은 요청하시면 프롬프트 작업으로 따로 할 수 있습니다.
- **사용자가 해 주실 것**: 폰 확인 8개(위 목록) — 특히 ⑥ **회화방 도우미**와 ④ TalkBack. 이상이 있으면 롤백 대상은 `20261017-214103-b9ce1546` 입니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다(`check.mjs init` 이 기록). 이 표는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성 전 | - | - | judge: full (JV-ui_change, Leader 승격 demo_pref=require) | 10-16 |
| v1 | 검토요청 | docs/demo/task-072-word-helper-v1.html (sha256 `b84f9cdf…`) | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | 사용자 검토 요청(결정 D1~D9·D1′·D6′, 질문 Q1~Q5) | 10-16 |
| - | 작성중 | - | - | judge: full (JV-ui_change) | 10-16 09:10 |
| v1 | 검토요청 | docs/demo/task-072-word-helper-v1.html | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | 사용자 검토 요청 | 10-16 09:32 |
| v1 | 승인 | docs/demo/task-072-word-helper-v1.html | https://claude.ai/artifact/6aC7dxocQtpvx7K56pwqXz | "승인" | 10-17 14:29 |
