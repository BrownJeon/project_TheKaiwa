---
task_id: task-071
title: "한글 표기가 숨겨지는 단어에 저장된 읽기로 한글 줄 보이기 — 분석기 읽기 ≠ 저장 읽기일 때 저장 읽기를 같은 분석기에 한 번 더 넣는다"
status: doing
waiting: implementation
base_ref: 051c9a7
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-026-improve-hangul-reading, task-070-improve-deck-swipe-prev, task-060-improve-deck-controls]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 한글 줄 저장 읽기 대체
  - task-071
created: 2026-10-15
updated: 2026-10-15
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-light-waive"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-071 — 숨겨진 한글 줄을 저장 읽기로 보이기 (IMP-0045)

## 사용자 요청 (원문, 2026-10-15)
- 질문: 「확인사항은 모두 정상이야. 다만 단어 중에 한글표기가 안돠는 단어가 있는데 왜 그런 거야?」(스크린샷: 오늘의 단어 4/10 「温い」 — 「이 카드는 한글 표기가 없어요」)
- Leader 가 원인·규모와 A/B/C 안을 보고 → 결정: **「a로 진행해줘」**(A안 = 불일치일 때 분석기 대신 저장된 읽기로 한글 줄을 만들어 보여 줌).

백로그: [[IMP-0045-hangul-fallback-stored-reading]]

## judge 접수 (2026-10-15)
- `judge-result@2`: 유형 local_fix · 복잡도 0.96 · 위험 R1 · developer **sonnet** · **track light**(Leader → Developer → Reviewer, QA·데모 면제 — `DM-light-waive`) · ui_change minor_visual. (첫 시도는 내 요약이 300자 한도를 넘어 `blocked_input` 으로 기본값(opus)이 나왔고, 169자로 줄여 재판정했다 — 도구 문제가 아니라 입력 실수.)
- **judge 가 못 보는 것**: judge 는 요약·경로 4개만 본다. 실제 영향은 **공용 훅 한 곳이 소비처 6곳에 반영**되는 것이므로, 아래 「소비처 회귀 확인」을 필수로 한다(경도가 낮다고 건너뛰지 않는다).
- **light 승격 조건**(보이면 standard 로): 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 숨기는 규칙의 출처: [[task-026-improve-hangul-reading]] — **「서로 어긋난 발음을 보이지 않는다」(★ Leader 확인 ①, 사용자 승인 데모의 핵심 보호 규칙)** 과 `hangulLine`「애매하면 숨김」. 이번 변경은 이 규칙의 **취지(어긋난 발음 금지)를 지키면서** 숨기는 대신 저장 읽기 기준으로 보이는 것이다 — 두 번째 분석도 어긋나면 그대로 숨긴다.
- 덱의 [한글] 버튼·「한글 표기가 없어요」 문구(`cardFirst.hangulBlock`·`CARD_FIRST.hangul.none`)는 task-060. **문구는 그대로 둔다**(남는 극소수용).
- 교훈: `/이슈기록 관련` 승인 교훈 없음. **task-069·070 감사 교훈(내부)**: light 트랙은 QA 가 없어 변이 점검이 사실상 유일한 독립 확인 → 배선도 **순수 함수 추출 + 소스 스캔 시험**으로 고정한다.

## 사실 (2026-10-15 직접 확인 — [확실])
- 한글 줄 상태: `AnnotationState = off | loading | ready{segments} | none`(`annotations.ts:28`). 단어 표제어는 `useWordLayersList(words)`(:405)가 `useAnnotations(surfaces)` → `wordHangulState(on, st, w.reading)`(:387)로 정한다. `wordHangulState` 는 `ready` 이고 `!readingMatches(segments, stored)` 면 `NONE`. `hangulLine(segments)` 가 null(발음 못 구한 조각 있음)이면 앞단에서 `none` 처리. 소비처는 `layers[i].hangul`(AnnotationState)을 그대로 읽는다.
- 한글 켬이면 `needsAnnotation` 이 **모든 비어 있지 않은 텍스트**(히라가나만 있어도)를 분석 요청으로 보낸다(`annotations.ts:301`) → 저장 읽기(히라가나)를 두 번째 `useAnnotations` 로 넣어도 요청이 나간다.
- 분석 API: `POST /api/v1/text/annotate` 최대 64개/요청, 사용자당 분당 60회(`rateLimit`), 서버 동시 2건 상한(클라이언트 큐가 지킴).
- **개념 검증(읽기 전용, 운영 분석 API, QA2 임시 쿠키)**: 기본 단어 7,757개 중 숨겨진 289개(불일치 286 + 발음 못 구함 3)의 **저장 읽기를 분석기에 넣으면 288개가 저장 읽기와 일치·한글 생성, 1개(七 しち)만 발음을 못 구함**. 출력 예: 温い(ぬるい)→누루이 · 丈夫(じょうぶ)→죠-부 · 黄色(きいろ)→키-로 · 四(し)→시 · 毎年(まいねん)→마이넹 · 何(なん)→낭 · 昨夜(ゆうべ)→유-베. 같은 분석기라 기존 표기법(장음 「-」·어중 경음 「따/까」)과 일치. 결과 파일: 스크래치패드 `hangul-fallback-out.json`(읽기 전용 참고).
- 소비처(`useWordLayers`/`useWordLayersList`/`wordHangulState` 사용): `vocab/VocabDeck.tsx`(덱, `hangulBlock` 은 `loading` 이면 막지 않음)·`vocab/WordResultList.tsx`·`vocab/WordsScreen.tsx`·`vocab/WordDetailSheet.tsx`·`chat/ProposalCard.tsx`·`eval/EvalItems.tsx`·`challenge/createParts.tsx`. 기존 시험: `common/__tests__/japaneseDisplay.test.ts`·`vocab/__tests__/cardFace.test.ts`·`lesson/__tests__/display.test.ts`·`modules/conversation/__tests__/topicWords.test.ts`.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **L1 대체 규칙(사용자 결정 A)**: 표제어 분석이 `ready` 인데 (a) 저장 읽기와 불일치이거나 (b) `hangulLine` 이 null 이면, **저장 읽기(히라가나)를 같은 분석기에 한 번 더 넣어** 그 분석 결과로 한글 줄을 만든다. 정상(저장 읽기와 일치·`hangulLine` 있음)은 **지금과 완전히 같다**(두 번째 요청 0).
- **L2 보호 규칙 유지**: 두 번째 분석 결과도 (a) `readingMatches(두 번째 segments, 저장 읽기)` 가 거짓이거나 (b) `hangulLine` 이 null 이거나 (c) 분석 실패·`none` 이면 **기존처럼 숨김**(`none`). 어긋난 발음을 보이는 경로를 새로 만들지 않는다. 실측: 남는 건 七(しち) 1개.
- **L3 저장 읽기 없는 단어**(`reading` null/빈 값): 대체 불가 — 지금 동작 그대로(첫 분석을 그대로 쓰고 불일치 검사도 하지 않음).
- **L4 상태 전이**: 첫 분석이 불일치/발음 없음으로 판정된 순간 두 번째 분석이 아직 끝나지 않았으면 **`loading`**(지금처럼 `none` 으로 번쩍이지 않게 — 덱은 `loading` 이면 「한글 표기가 없어요」를 안 보이고 자리 막대를 보인다). 두 번째가 `ready`+유효 → `ready`(두 번째 segments), 그 밖 → `none`. 첫 분석이 `loading`/`off`/`none`(분석 불가) 이면 두 번째를 요청하지 않는다(요청 0 — 불필요한 호출·분당 60회 한도 보호).
- **L5 구현 위치·모양**: `annotations.ts` 에 **순수 함수**(예: `pickWordHangul(on, first, stored, second)`)를 두고 `useWordLayersList` 는 `useAnnotations` 를 한 번 더 호출(불일치로 판정된 단어만 저장 읽기 텍스트, 나머지 `''` — 빈 문자열은 요청하지 않는다)해 그 순수 함수로만 정한다. 기존 `wordHangulState` 의 외부 약속(한글 끔=`off`, 그 밖은 분석 상태)은 바꾸지 말고 새 함수가 감싸거나 시그니처를 확장하되 **호출처 전부를 맞춘다**(grep). 훅 호출 개수는 렌더마다 같아야 한다(React 규칙).
- **L6 불변**: 후리가나 루비(`alignWordRuby`·`showFurigana`)·한글 끔(`off`)·분석 불가(`available:false`)·단어가 아닌 문장 분석(`useAnnotations(문장)` 소비처 — 교정 카드 문장·회화 말풍선 등)·한글 줄 렌더(`HangulLine`)·`CARD_FIRST.hangul` 문구·[한글] 버튼 동작·저장 읽기 자체(DB·시드 변경 없음). 새 API·DB·네이티브 없음. 6층 경계.
- **L7 부하**: 추가 요청은 불일치 단어에만(전체의 3.7%) — 덱 10장에서 평균 0.4개. 기존 큐·동시 2건·중복/실패 재시도 상한(클라이언트가 거름)을 그대로 쓴다. 새 타이머·폴링 금지.
- **L8 문서**: `docs/screens.md` 의 한글 줄 보호 규칙 서술(`어긋난 발음`·`readingMatches`·`저장 읽기와 어긋나면`·「한글 표기가 없어요」 조건)을 찾아(grep) task-071 개정을 반영 — 옛 서술은 `[⚠ task-071 → …]` 표기(task-060·070 때와 같은 방식)로 정리해 거짓 서술이 남지 않게. 코드 주석(`cardFirst.hangulBlock`·`annotations.ts` 머리말)도 새 규칙에 맞춘다.
- **L9 후속은 이번 범위 밖**: 저장 읽기 검수(후보 C — 私=わたくし·一月=ひとつき 등 의심 사례), 七(しち) 1개 해결, 안내 문구 구체화(B). 건드리지 않는다.

## 소비처 회귀 확인 (필수 — 순수 함수만이 아니라 각 소비처가 새 상태 전이를 받는지)
`VocabDeck`(덱 카드: `hangulBlock`·[한글] 버튼·`layerHangul`)·`WordResultList`/`WordsScreen`(행)·`WordDetailSheet`(상세 `HangulLine`)·`ProposalCard`·`EvalItems`·`createParts` 가 `loading` → `ready`/`none` 전이를 지금과 같은 방식으로 받는지 **코드로 확인하고 표로 기록**(특히 `loading` 때 자리 막대·레이아웃 흔들림 없음, `ready` 의 segments 가 두 번째 분석 것이어도 `hangulLine(segments)` 로 문제없이 렌더).

## 구현 지시 (developer, sonnet)
1. 위 L1~L9. 먼저 읽을 것: `src/components/common/japanese/annotations.ts`(`AnnotationState`·`useAnnotations`·`readingMatches`·`wordHangulState`·`useWordLayersList`·`needsAnnotation`) → `src/modules/speech/reading/client.ts`(`hangulLine`·`pronLine`) → 소비처 6곳의 `.hangul` 사용 줄 → 시험 `japaneseDisplay.test.ts`·`cardFace.test.ts`·`display.test.ts`·`topicWords.test.ts`.
2. 파일 범위(예상 4~6): `annotations.ts`(+필요 시 `cardFirst.ts` 주석) + 시험(`japaneseDisplay.test.ts`·`cardFace.test.ts` 갱신 + 새 시험) + `docs/screens.md`. 12개를 넘기면 멈추고 보고(standard 승격).
3. 시험(순수 함수 우선, **개념 검증 사례를 고정 시료로**): ① 정상 유지(두 번째 요청 0, 결과 동일) ② 불일치 → 두 번째 대기 중 `loading` ③ 불일치 + 두 번째 ready·일치·hangulLine 있음 → `ready`(두 번째 segments) ④ 두 번째도 불일치 → `none` ⑤ 두 번째 `hangulLine` null(七 しち 형) → `none` ⑥ 두 번째 실패/`none` → `none` ⑦ 첫 분석이 발음 없음(noPron, 何々 형) → 두 번째 시도 ⑧ 저장 읽기 없음 → 기존 동작 ⑨ 한글 끔 → `off`·요청 0 ⑩ 첫 분석이 `loading`/`none` → 두 번째 요청 0. 시료 segments 는 `ReadingSegment` 모양(`surface`·`ruby`·`pron`·`boundary`)으로 합성: 예) 温い/저장 ぬるい — 첫 분석 `ruby:[['温','ぬく'],['い',null]]`·`pron:'ヌクイ'`(불일치), 두 번째 분석 `surface:'ぬるい'`·`ruby:null`·`pron:'ヌルイ'`(일치 → 한글 「누루이」). 훅 배선은 소스 스캔(`useWordLayersList` 가 두 번째 `useAnnotations` 를 부르고 순수 함수로만 상태를 정함)으로 고정. **변이 점검 10개 이상**(핵심 규칙·배선을 일부러 깨 보면 시험이 실패하는지), 결과 표를 기록에 남긴다.
4. 확인 명령(미러에서): `tsc --noEmit` 0 · `eslint src/components/common src/components/vocab` 0 · 관련 시험 + 전체 시험 · `./node_modules/.bin/next build > log 2>&1`(`npm run build/dev` 금지, 출력 자르지 말 것). 증빙은 기록에 남긴다 — reviewer 가 재실행한다.
5. 하지 않는 일: 커밋·푸시·배포·DB 쓰기·QA 서버 기동(3011 포함)·**운영 포트(3010/3002/3012/307x) 접촉(분석 API 직접 호출 포함 — 실측은 Leader 몫)**·`.env` 영구 복사·`pkill`. 저장 읽기·시드·DB 변경 금지. 실기기 확인은 사용자 몫.
6. 기록: `agent-vault/10-Flow/tasks/task-071-dev-record.md` — 변경 파일, 결정, 소비처 회귀 확인 표, 증빙, 변이 표, 알려진 한계. 끝나면 이 이력서 「상태 로그」에 한 줄.

## 완료 기준
1. 저장 읽기가 있고 분석기 읽기와 불일치(또는 발음 없음)인 단어(예: 温い)의 한글 줄이 저장 읽기 기준으로 보이고(누루이), 정상 단어는 지금과 같다.
2. 대체 분석도 어긋나거나 발음을 못 구하면 숨김(七 しち 형), 저장 읽기 없는 단어·한글 끔·분석 불가는 지금 동작.
3. `loading` 중 「한글 표기가 없어요」가 번쩍이지 않고, 소비처 6곳이 새 전이를 받는다.
4. 추가 분석 요청은 불일치 단어에만 나간다.
5. tsc 0 · eslint 0 · 시험 통과 · `next build` 0 · reviewer PASS · 사용자 폰 확인(温い 등 N5 21개 카드).

## 상태 로그
- 2026-10-15 사용자 질문(한글표기 안 되는 단어) → 원인 조사(보호 규칙: 분석기 ≠ 저장 읽기면 숨김)·전수 점검(숨김 289/7,757)·A/B/C 안 제시 → 사용자 「a로 진행해줘」 → 개념 검증(구제 288/289) → IMP-0045 접수 → judge(local_fix·R1·light·demo 면제·sonnet) → 이력서 작성(L1~L9). 다음: developer.
- 2026-10-15 developer 구현 완료(미커밋) — `annotations.ts` 에 `wordFallbackText`·`pickWordHangul` + `useWordLayersList` 두 번째 `useAnnotations`, 새 시험 17개 · 변이 17/17 kill · tsc 0 · eslint 0 · 전체 시험 4,125 중 4,123 통과(0 실패·2 건너뜀) · `next build` 0. 파일 9개(코드·문서). 기록 [[task-071-dev-record]]. 다음: reviewer(light).
- 2026-10-15 reviewer 감사 완료(REV-071) — **PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 3: 훅 렌더 시험은 소스 스캔뿐·렌더마다 재계산 약 2.5ms/500단어·발음 자체는 대조하지 않음). 증빙 재실행이 developer 보고와 일치(tsc 0 · eslint 0 · 전체 4,125 중 4,123 통과·0 실패·2 건너뜀 · next build 0), 직접 낸 변이 12개 전부 killed(생존 0), 가장자리(읽기 일치·발음 없음)는 수용, light 승격 불필요, 데모 게이트 PASSED. 기록 [[task-071-rev-record]]. 다음: 커밋·푸시·배포는 사용자 승인 후 → 사용자 폰 확인.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-15 20:27 |
