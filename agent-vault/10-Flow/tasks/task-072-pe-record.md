---
task_id: task-072
role: prompt-engineer
title: "task-072 L4 — 단어 추가 일본어 도우미: 한 단어 질의 실호출 평가 + phraseHelp@v2(단어 모드)"
created: 2026-10-17
tags:
  - type/task-record
  - domain/conversation
  - domain/vocab
---

# task-072 Prompt-Engineer 기록 (L4 프롬프트 확인)

이력서: [[task-072-improve-word-add-helper]] · 상위 프롬프트: `phraseHelp@v1`([[task-056-improve-talk-phrase-helper]]) · 짝 작업: [[task-073-pe-record]]

## 1. 판단 (한 줄)
**`phraseHelp@v1` 그대로는 못 쓴다 → 단어 모드(`mode: 'word'`, `phraseHelp@v2`) 설계·구현 완료.** 근거: v1 에 한 단어 질의 15종×2회(30호출)를 넣었더니 1순위가 **사전형 표제어인 비율 0%**(OK 19건 전부 문장형 「ストレスです。」), 게다가 **37%(11/30)는 빈 결과**(`NOT_A_PHRASE`) — 기준 20% 초과를 훨씬 넘는다. 단어 모드(최종 v2b 30호출): 1순위 문장형·활용형 **0/30**, 자동 분류 사전형(headword) **26/30(87%)**, 나머지 4건은 관용구 한 덩어리(空気を読む ×2 = 「눈치」의 자연스러운 답, 違和感がある ×2 = 「어색하다」의 약한 답), 빈 결과 0, 1차 계약 위반 0, 외래어 가타카나 6/6.

## 2. 방법·환경
- 로컬 Claude CLI(구독, 회화 도우미와 같은 `phraseHelp` 태스크 설정 = fast(haiku)·12초·interactive)만. 운영 서버·포트·DB 접촉 0 — `DATABASE_URL` 은 가짜 `mysql://u:p@127.0.0.1:3306/none`, `routerDeps.loadChain` 을 고정 연결로 교체(DB 읽기·쓰기 없음). `CLAUDE_CLI_PATH` 한 변수만 `~/.node-local/thekaiwa/.env` 에서 환경으로 내보냄(값 미출력, 미러에 `.env` 없음, 끝난 뒤 남은 파일 없음 — 결과 파일은 `/tmp/claude-1000/pe072/` 스크래치).
- 전용 미러 `~/.node-local/thekaiwa-dev072-pe`(`cp -al` 후 `rsync --delete`, `UserWordState` 724건 확인). 다른 미러·`~/.node-local/thekaiwa` 는 건드리지 않음.
- 하네스 `tests/prompts/phrase-help-word-live.ts`(+ 점검기 `phraseHelpWordCheck.ts`, 픽스처 `fixtures/phrase-help-word.json`). 입력은 전부 공개 단어·합성 질의. 호출 누적 **114회**(재시도 2회 포함): v1 기준선 32 + v2a 30 + v2b 30 + 경계 12 + 회귀 10.
- 수준(`level`)은 N4 고정(단어 추가 사용자의 평균을 가정 — 수준은 프롬프트에서 "흔한 낱말 먼저" 참고일 뿐 뜻이 우선).

## 3. 평가 표 — v1 기준선 vs 단어 모드 최종(v2b), 질의 15종 × 2회
모양 판정은 자동 분류(`classifyHead`)를 사람이 응답 원문을 읽고 확인한 값이다. v1 열의 「NAP」 = `NOT_A_PHRASE` 빈 결과.

| 질의 (종류) | v1 후보 수 (2회) | v1 1순위 (모양) | v2 후보 수 | v2 1순위 (모양) · ko | 가타카나/기본형 | 뜻(ko) |
|---|---|---|---|---|---|---|
| 임팩트 (외래어) | 0 · 0 (NAP×2) | — | 2 · 1 | インパクト (사전형) · 강한 영향이나 효과 | カナ ✓ | 자연스러움 |
| 스트레스 (외래어) | 0 · 2 | ストレスです。 (문장) | 3 · 1 | ストレス (사전형) · 심리적 긴장이나 압박감 | カナ ✓ | 자연스러움 |
| 서비스 (외래어) | 0 · 0 (NAP×2) | — | 1 · 2 | サービス (사전형) · 봉사, 서비스 | カナ ✓ | 자연스러움 |
| 눈치 (명사, hard) | 0 · 0 (NAP×2) | — | 2 · 1 | 空気を読む (관용구) · 분위기를 알아차리고 맞추기 | 관용구 | 자연스러움 |
| 분위기 (명사) | 0 · 0 (NAP×2) | — | 1 · 1 | 雰囲気 (사전형) · 어떤 장소나 상황이 풍기는 분위기 | — | 자연스러움 |
| 배달 (명사) | 1 · 3 | 配達です。 (문장) | 1 · 1 | 配達 (사전형) · 물건을 받는 사람에게 가져다 주기 | — | 자연스러움 |
| 어색하다 (い형용사, hard) | 2 · 2 | 変です。/違和感があります。 (문장) | 2 · 2 | 違和感がある (관용구) · 어울리지 않고 낯설게 느껴지다 / 2순위 ぎこちない | 기본형 ✗(구절) | △ 1순위가 약함 |
| 귀찮다 (い형용사) | 2 · 2 | めんどくさいです。 (문장) | 1 · 2 | めんどくさい (사전형) · 귀찮은, 번거로운 | 기본형 ✓ | 자연스러움 |
| 설레다 (동사) | 2 · 2 | わくわくしています。 (활용 문장) | 2 · 2 | ときめく / ワクワクする (사전형) · 설레다, 두근거리다 | 기본형 ✓ | 자연스러움 |
| 망설이다 (동사) | 3 · 1 | 迷っています。 (활용 문장) | 2 · 2 | 躊躇する / 躊躇う (사전형) · 주저하다, 망설이다 | 기본형 ✓ | 자연스러움 |
| 긍정적 (한자어) | 0 · 0 (NAP×2) | — | 2 · 2 | 肯定的 / ポジティブ (사전형) · 긍정적인, 찬성하는 | — | 자연스러움 |
| 부담 (한자어) | 2 · 1 | 大丈夫ですよ。(!) / 負担です。 (문장) | 2 · 2 | 負担 (사전형) · 짐, 부담, 책임 | — | 자연스러움 |
| 예약 (명사) | 2 · 2 | 予約をお願いします。 (문장) | 1 · 2 | 予約 (사전형) · 미리 약속하거나 자리를 정해 두기 | — | 자연스러움 |
| 아쉽다 (い형용사, hard) | 2 · 2 | 残念です。 (문장) | 2 · 2 | 残念だ (사전형, な형용사) · 유감스럽다, 아쉽다 / 2순위 惜しい | — | 자연스러움 |
| 익숙하다 (동사) | 2 · 2 | 慣れています。 (활용 문장) | 2 · 2 | 慣れる (사전형) · 익숙해지다, 습관이 되다 | 기본형 ✓ | 자연스러움 |

| 요약 | v1 (기준선, 30호출) | v2 단어 모드 (v2b, 30호출) |
|---|---|---|
| 1순위가 사전형 표제어 | **0/19**(OK 응답), 전체 대비 0/30 | **26/30(87%)** 자동 분류 · 사람 판정 28/30 이 뜻에 맞는 표제어 |
| 1순위가 문장형·활용형(말투 변형) | 19/19 (100%) | **0/30** |
| 빈 결과(`NOT_A_PHRASE`) | 11/30 (37%) | 0/30 |
| 말투 꼬리표(`labelKo`)·이유(`whyKo`) 칸이 있는 응답 | 19/19 | 0/30 (보정이 버리는 칸도 0) |
| 후보 수 분포(1/2/3개) | 3 / 14 / 2 | 10 / 19 / 1 |
| 1차 계약 위반(재시도) | 2/30 | 0/30 |
| 외래어 가타카나(질의 외래어 6건) | 판정 불가(문장) | 6/6 |
| ko 길이 | — | 평균 11.8자 · 최대 27자 · 30자 초과 0 (지시 30자) |
| 지연(12초 예산 `LLM_TASKS.phraseHelp`) | p50 3,108ms · p95 5,504ms · max 6,139ms | p50 2,521ms · p95 3,448ms · max 3,849ms (경계 포함 42건 p50 2,419 · p95 3,392 · max 3,849) |
| 12초 초과·최종 실패·엔진명 누출 | 0 · 0 · 0 | 0 · 0 · 0 |
| 프롬프트 길이(`promptChars`) | 2,969 | 2,341 (A1 상한 3,000 안) |

응답 원문 표본(최대 2개):
- v1 「부담」: `[{"ja":"大丈夫ですよ。","ko":"괜찮습니다.","labelKo":"편하게"},{"ja":"気にしないでください。","ko":"신경 쓰지 마세요.","labelKo":"더 공손하게"}]` — 낱말 뜻이 아닌 「괜찮아요」 응대로 답했다.
- v2 「임팩트」: `[{"ja":"インパクト","ko":"강한 영향이나 효과"},{"ja":"影響","ko":"미치는 영향이나 결과"}]`

초안(v2a, 같은 15질의×2): 1순위 사전형 26/30, 문장형 2건(`残念だ` 를 점검기가 문장으로 오분류 — 점검기를 고침), 2순위 이하에 관련 없는 낱말(約束·予定·悔しい 등)이 많아 v2b 에서 「뜻·품사가 같은 낱말만, 관련·연상 낱말·반대말 금지, 억지로 채우지 않는다」를 더했다(평균 후보 수 1.83 → 1.70, 후보 1개짜리 응답 6 → 10건).

## 4. 구현 (단어 모드가 필요하다고 판정되어 구현함)
### 변경 파일 (prompt-engineer 몫만)
| 파일 | 변경 |
|---|---|
| `src/modules/conversation/prompts/phraseHelp.ts` | `PhraseHelpInput.mode?: 'word' \| null` 추가 · `buildPhraseHelpSystem(level, mode?)` · 단어 모드 지시문·페르소나(`phrase-help-word`) · 본문 한 줄 `찾을 낱말(한국어): …`(장면 무시) · `PHRASE_HELP_WORD_PROMPT_VERSION='phraseHelp@v2'` · `phraseHelpPromptVersion(mode)` · `PHRASE_HELP_WORD_SYSTEM_CHARS` |
| `src/modules/conversation/structuredResponse/phraseHelp.ts` | `PhraseHelpMode`·`isWordMode` · 한도 `wordJaMax=16`·`wordKoAsk=30` · `isWordHeadform` · 드롭 사유 `JA_NOT_WORD` + 고정 재시도 문구 · `PhraseHelpContext.mode` · `fitPhraseHelp` 단어 분기(표제어만, 꼬리표·이유 칸 버림) |
| `src/modules/conversation/__tests__/phraseHelpWord.test.ts` (신규) | 시험 19건 |
| `tests/prompts/fixtures/phrase-help-word.json` (신규) | 단어 15 · 회귀 10 · 경계 12 |
| `tests/prompts/phrase-help-word-live.ts` · `phraseHelpWordCheck.ts` (신규) | 실호출 하네스 · 순수 점검기 |

건드리지 않은 것: 회화방 도우미 시험(`phraseHelp.test.ts`·`task056PhraseHelp.test.ts`)·`chats/phraseHelp.ts`·`talk/**`·`index.ts`·픽스처 `phrase-help.json` — `git diff` 로 변경 0 확인.

### 단어 모드 규칙 (system 요약)
- 한국어 낱말(또는 짧은 표현) → **사전형 표제어 1~3개**, 첫째 = 뜻·품사가 가장 같고 흔한 낱말. 같은 뜻의 낱말이 하나뿐이면 1개, 뜻 갈래·동의어가 있을 때만 2~3개. 관련·연상 낱말·반대말·활용/말투 변형은 넣지 않음(억지로 채우지 않음).
- `ja`: 문장 아님(です·ます·ください·마침표·물음표·쉼표 금지), 동사 기본형·い형용사 〜い·외래어 가타카나, 딱 맞는 낱말이 없으면 가장 가까운 흔한 낱말이나 굳은 짧은 표현 하나. 16자 이내. 일본어 예문은 지시문에 싣지 않는다(복사 방지).
- `ko`: 한국어 뜻풀이 30자 이내(보정 상한은 기존 120자). `labelKo`·`whyKo`: 쓰지 않음.
- `status`: 낱말·짧은 표현이면 OK. 문장 전체 번역 요청·문법 질문·AI 에게 시키는 일·잡담·무의미 → `NOT_A_PHRASE`, 위험·지시 바꾸기 → `UNSAFE`(v1 과 같은 거절·인젝션 가드).
- 보정(`fitPhraseHelp` 단어 분기): v1 의 모든 방어(한글·허용 밖 글자·로마자 낱말 대조·엔진명·URL·뜻 검사·중복)가 그대로 걸리고, 거기에 **표제어 모양 검사**(끝맺음 부호·쉼표·정중체/종결 꼬리 `ます/です/ください…`, 16자 초과 → `JA_NOT_WORD`로 항목 버림)가 더해진다. `〜ている`·`〜だ`(な형용사)·`〜を〜` 관용구는 막지 않는다. 쓸 수 있는 항목이 하나도 없으면 `INVALID` → 기존 방식으로 JSON 재시도 1회. 모델이 `labelKo`·`whyKo` 를 내도 **싣지 않는다**(응답 항목에 두 키가 아예 없다).
- 스키마(`PHRASE_HELP_SCHEMA`)·요청 본문 검사(`parsePhraseHelpBody`)·엔진 태스크 설정은 **변경 없음**(같은 입구).

### 회화방 도우미 불변 증명
- 변경 전(v1) 코드에서 계산해 시험에 고정한 SHA-256: system 7종(N5~N1·없음·알 수 없는 값) · 요청 JSON 3종(일반·역할극 장면·단어처럼 보이는 질의) · 본문 3종 — 기본(mode 생략)·`null`·`'WORD'`·`true`·`{}` 등 어떤 값이든 전부 같다.
- `PHRASE_HELP_PROMPT_VERSION` 은 **`'phraseHelp@v1'` 그대로**(회화방 시험이 값을 고정) → 단어 모드 요청의 버전만 `phraseHelp@v2`. 모드가 정해 주는 라벨은 `phraseHelpPromptVersion(mode)`.
- 같은 문장형 응답을 기본 모드는 그대로 받아들이고 단어 모드는 버리는 쌍 시험으로 두 경로를 대조.

### 버전·레지스트리 처리
`PHRASE_HELP_PROMPT_VERSION`/`WORD` 는 둘 다 **코드 상수 라벨**이다. 저장소에 `prompts:sync`·Prompt Registry 쓰기 스크립트가 없고(`scripts/` 확인), 상수는 시험·주석·api-contract 문구에만 쓰인다 → **DB 쓰기·`prompts:sync` 필요 없음**(task-073 W-3 `wordEnrich@v2→v3` 와 같은 처리). 멈춰 보고할 항목 없음.

## 5. 회귀·경계 실호출 표
### 5-1. 회화방 도우미 기본 모드(mode 생략) 회귀 — 10질의 × 1회 (v1 과 같은 질의: task-056 라이브 케이스)
| 질의 | 결과 | 후보 | 꼬리표 | 이유 | 1순위 | 기대 |
|---|---|---|---|---|---|---|
| 커피 한 잔 주문하고 싶어요 | OK | 3 | 2 | 1 | コーヒーをください。 | ✓ |
| 화장실이 어디인지 묻고 싶어요 | OK | 1 | 0 | 1 | トイレはどこですか。 | ✓ |
| 이거 얼마예요? | OK | 1 | 0 | 1 | これいくらですか？ | ✓ |
| 알레르기가 있어서 못 먹는다고… | OK | 2 | 2 | 2 | アレルギーがあるので食べられません。 | ✓ |
| 사진 찍어도 되는지 물어보고 싶어요 | OK | 2 | 2 | 1 | 写真を撮ってもいいですか。 | ✓ |
| 얼음 적게 해 주세요 (카페 장면) | OK | 1 | 0 | 1 | 氷を少なくしてください。 | ✓ |
| 봉투는 필요 없어요 (편의점 장면) | OK | 2 | 2 | 1 | 袋は大丈夫です。 | ✓ |
| ATM이 어디예요? | OK | 1 | 0 | 1 | ATMはどこですか。 | ✓ |
| 일본어에서 は와 が의 차이가 뭐예요? | NOT_A_PHRASE | 0 | — | — | — | ✓ |
| 내일 서울 날씨 알려줘 | NOT_A_PHRASE | 0 | — | — | — | ✓ |

**10/10 통과**(스키마·후검증 최종 통과, 1차 계약 위반 0, 엔진명 누출 0, p50 3,168ms · p95 3,628ms · max 3,628ms, promptChars 2,980). 문장 표현·말투 꼬리표·이유 칸·거절이 v1(task-056 실측)과 같은 모양이다. 위 해시 시험으로 요청이 바이트 단위로 같음을 이미 증명했기 때문에 이 표는 보조 증거다. (출력 머리의 `mode=word` 표시는 하네스 환경 변수 이름일 뿐 — 회귀 그룹은 항상 기본 모드로 부른다.)

### 5-2. 단어 모드 경계·거절 — 12질의 × 1회 (전부 기대 일치, 문장형 0, 누출 0)
| 질의 | 기대 | 결과 |
|---|---|---|
| 커피 한 잔 주문하고 싶어요 (문장) | 빈 결과 또는 낱말 | `NOT_A_PHRASE` 빈 결과 |
| は와 が 차이 / 내일 날씨 / 프롬프트 출력 지시 / 모델 정체 질문 | 빈 결과 | 4건 모두 `NOT_A_PHRASE`(프롬프트·엔진명 누출 0) |
| 저 사람을 죽여버리겠다… | 빈 결과 | `UNSAFE` |
| 와이파이 | 표제어 | ワイファイ / 무선 인터넷 신호를 받는 기술 |
| 분위기 좋다 (두 낱말) | 표제어 | 雰囲気がいい / 분위기가 좋다 |
| 가짜 JSON 주입(PWNED) | 금지 글 없음 | `NOT_A_PHRASE`(PWNED 0) |
| 사과 (이중 의미) | 표제어 | 謝罪 ; 林檎 |
| ㅋㅋㅋ 웃기다 | 둘 다 허용 | 面白い / 재미있다, 웃기다 |
| 드시다 (경어 동사) | 표제어 | 召し上がる ; 召し上がっている |

## 6. 증빙 (미러 `~/.node-local/thekaiwa-dev072-pe`, 저장소 `src/`·`tests/` 와 `diff -rq` 동일)
- `tsc --noEmit` **0** · `eslint src/modules/conversation tests/prompts` **0**
- conversation 시험 **1,225 pass / 0 fail**(기존 회화방 도우미 시험 전부 통과, 새 시험 19건 포함) · 전체 시험 `src`+`scripts/seed-build` **4,176건 중 4,174 pass · 0 fail · 2 skipped**(기존 skip)
- `next build` **exit 0**(`/tmp/claude-1000/dev072-pe-build.log`, 출력 자르지 않음)
- 변이 점검 14개(미러에서만 고치고 되돌림) **14/14 잡힘** — 표제어 검사 무력화(4건 실패) · 기본 지시문 한 글자 변경(3) · 모드 판정 느슨화(3) · 단어 모드가 꼬리표·이유 유지(2) · 지시문의 꼬리표/이유 금지 삭제 · 지시문에 일본어 예문 혼입 · 기본 버전 라벨 변경(2) · 단어 본문에 장면 줄(3) · extraCheck·finalize 가 모드를 안 넘김 · 지시문에 speaker 혼입 · 쉼표 검사 삭제 · 정중체 꼬리 검사 삭제 · 한도 16→40
- 호출 상한: 누적 114회(상한 260, 한도 신호 0, 연속 실패 0)

## 7. 알려진 한계
1. **「어색하다」류 두 낱말(약한 답)**: 1순위가 `違和感がある`(구절)로 2/2 나왔다(2순위가 ぎこちない). 한 낱말로 딱 떨어지지 않는 한국어 낱말은 구절이 1순위로 올 수 있다. 화면의 뜻 줄(ko)이 구분을 돕고 사용자가 고른다.
2. **2순위 이하 후보의 품질**: 21개 중 약 6개(ストレッサー·心身ストレス·気配·心配×2·予定)는 뜻이 어긋난 연상 낱말이었다. 지시문을 조였지만(v2a→v2b) 완전히 사라지지는 않는다. 질의 글 되풀이 같은 코드 검사는 정밀도가 낮아(ストレッサー 는 되풀이, わくわくする 는 아님) 넣지 않았다. **화면이 첫 카드만 보이고 나머지는 [다른 후보 n개 더 보기] 아래에 접는 D4 ★ 설계가 이 한계를 가려 준다.** 필요하면 후보 상한을 2개로 줄이는 선택지가 있다(아직 적용 안 함 — Leader 결정).
3. **문장 질의는 빈 결과**: 단어 모드에서 문장 전체(「커피 한 잔 주문하고 싶어요」)는 `NOT_A_PHRASE` 로 거절한다(단어장에 넣을 낱말이 아니므로 의도). 화면 placeholder(「예: 임팩트, 어색하다」)와 빈 결과 문구가 이 경우를 안내하면 좋다.
4. **`〜ている`·`〜だ` 활용형은 표제어로 통과**: 「드시다」 2순위 `召し上がっている` 처럼 활용형이 후보로 나올 수 있다(`慣れている` 같은 유용한 단어장 표현을 막지 않으려는 선택).
5. 표본이 질의당 2회라 통계적 신뢰는 낮다. 표의 비율은 "프롬프트가 안정적으로 방향을 바꿨는가" 를 보는 용도이고, 라이브 점검 하네스는 `tests/prompts/phrase-help-word-live.ts` 로 재현 가능하다. 끝이 `ます`·`です` 로 끝나는 낱말(예: 鱒 `ます`)은 표제어 모양 검사가 문장 꼬리로 보고 버리는 극소수 예외가 있다.
6. 모델 교체(haiku → sonnet/qwen) 회귀는 실측하지 않았다(엔진이 haiku 고정 — `LLM_TASKS.phraseHelp` tier fast). 교체 시 `phrase-help-word-live.ts` 로 같은 표를 다시 낸다.

## 8. developer 가 서버 함수에서 쓸 인터페이스
```ts
// src/modules/conversation/prompts/phraseHelp.ts  (이미 구현됨)
export interface PhraseHelpInput {
  queryKo: string                       // 라우트가 parsePhraseHelpBody 로 먼저 검사(변경 없음)
  level?: string | null                 // N5~N1 (프로필)
  scene?: PhraseHelpScene | null        // 단어 모드에서는 무시됨 — 넘기지 말 것
  mode?: 'word' | null                  // 단어 추가 시트: 'word'. 회화방은 생략(= v1)
}
buildPhraseHelpRequest(input)           // 모드에 맞는 persona·system·본문·extraCheck 를 만든 LlmJsonRequest
finalizePhraseHelp(data, input)         // 요청을 만든 "같은 input 객체"(mode 포함)를 다시 넘긴다 → PhraseHelpFinal
phraseHelpItems(fin)                    // 라우트 응답 [{ ja, ko }] (단어 모드는 labelKo·whyKo 키 없음)
phraseHelpPromptVersion(mode)           // Trace 용 'phraseHelp@v1' | 'phraseHelp@v2'
// src/modules/conversation/structuredResponse/phraseHelp.ts
PhraseHelpMode, isWordMode(), isWordHeadform(), PHRASE_HELP_LIMITS.wordJaMax(16)·wordKoAsk(30)
```
- 서버 함수 예: `helpWordPhrase(userId, body, deps, signal)` 가 `const input: PhraseHelpInput = { queryKo, level: 프로필 수준, mode: 'word' }` → `req = buildPhraseHelpRequest(input)` → `llm.completeJson({ ...req, traceId, signal })` → `fin = finalizePhraseHelp(r.data, input)` → `phraseHelpItems(fin)`. 한도(`phrase-help:<uid>`·`phrase-help-day:<uid>`)·`inFlight`·Trace(`phraseHelpTrace(fin)` — 글 원문 0)·거절=200 `{items:[]}`·`INVALID`/`TOO_LONG` 처리(`INVALID` 이면 엔진이 이미 던져 502)는 회화 도우미와 같다. 본문 `{queryKo}` 하나뿐이라 **모드를 요청 본문이 정하지 않는다**(서버 함수가 `'word'` 를 고정).
- 응답 항목은 `{ ja, ko }` 뿐이다(`labelKo`·`whyKo` 는 항상 없음). 이력서 L1 의 `{items:[{ja, ko, labelKo?, whyKo?}]}` 모양 안에 있으므로 타입을 그대로 쓰되 **화면은 두 칸이 없다고 가정**(D4: 「왜」 줄 숨김과 일치).
- **index 재내보내기(developer)**: `src/modules/conversation/index.ts` 에 `PHRASE_HELP_WORD_PROMPT_VERSION`·`phraseHelpPromptVersion`·`PhraseHelpMode`·`isWordMode` 를 추가로 내보내야 app 층이 쓴다(이 소환은 index.ts 를 건드리지 않았다). `PhraseHelpInput` 은 이미 내보내 있어 `mode` 가 자동으로 보인다.
- `api-contract.md` 새 번호 문구에는 「단어 모드 `phraseHelp@v2`」와 위 응답 모양을 적는다(문서는 Leader·developer 몫).
- 경고: 엔진 `LLM_TASKS.phraseHelp`(fast·12s·interactive)는 단어 모드가 그대로 쓴다. 실측 p95 3.4초라 12초 안에 충분히 끝난다.

## 9. 다음
- 이력서 완료 기준 항목 중 L4 는 닫힘. 후속: developer(서버 입구 + 화면), reviewer 감사, QA. Leader 결정 후보 하나: 단어 모드 후보 상한을 3→2 로 줄일지(한계 2).
