---
task_id: task-069
title: "단어 추가 시트에 마이크(말해서) 입력 추가 — 키보드와 둘 다 가능 (표현·예문 칸)"
status: done
waiting: ""
base_ref: 473de65
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-068-improve-wordbook, task-066-ask-chatbot-voice, task-007-ai-talk-web]
tags:
  - type/task
  - domain/vocab
  - domain/speech
  - domain/improvement
aliases:
  - 단어 추가 마이크 입력
  - task-069
created: 2026-10-15
updated: 2026-10-19
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

# task-069 — 단어 추가 마이크 입력 (IMP-0043)

## 사용자 요청 (원문, 2026-10-15)
> 단어 추가할때 키보드로 작성하는것과 마이크로 말해서 입력하는 것 둘다 가능하도록 해줘

백로그: [[IMP-0043-words-add-mic-input]]

## judge 접수 (2026-10-15)
- `judge-result@2`: 유형 feature · 복잡도 1.66 · 위험 R1 · developer **sonnet** · **track light**(Leader → Developer → Reviewer, QA·데모 게이트 면제 — 사용자 결정 2026-10-03, `DM-light-waive`) · ui_change `behavior_change`.
- **light 승격 조건**(보이면 standard 로): 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증. 이번 계획은 새 컴포넌트·훅 2~3개 + 기존 2~3개 수정 + 시험 — 여기에 해당 없음.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 단어 추가 시트 구조·동작: [[task-068-improve-wordbook]] — 2단계(표현 한 칸 → [뜻 채우기] → 폼), 같은 `WordForm` 을 단어 수정 시트도 쓴다. 조각 필수·중복 409 안내·기본 단어 중복 안내가 이미 있다. **이 동작들은 바꾸지 않는다.**
- 음성 입력 선례(재사용 대상): 수업 ④ 「말로 쓰기」(`StageApply.tsx` + `useLessonVoice.ts` — 칸마다 「글자로/말로」 전환, `PushToTalkButton`, `purpose:'MIC_TEST'` = 원음 저장 안 함) · 질문 탭 말 모드(`useAskInput.tsx`, 같은 `MIC_TEST`) · 회화방(`TalkRoom.tsx`, `TURN`).
- 교훈: `/이슈기록 관련` 승인 교훈 없음.

## 사실 (2026-10-15 직접 확인 — [확실])
- 실시간 인식 언어는 **일본어 고정**: `speech/speech.config.yml:63` `language: ja`(자동 감지 끔). → 마이크는 일본어 칸에만 쓸 수 있다.
- `useRealtimeStt({ purpose, config, maxSec, onFinal })`(`src/components/speech/useRealtimeStt.ts`): `purpose` 는 `'TURN' | 'MIC_TEST'` 둘뿐이고 `MIC_TEST` 는 gateway 가 저장·콜백을 건너뛴다. `config` 는 `useSpeechConfig()`(`useLessonVoice.ts` 안, #19 한 번 읽기)가 주고 인식이 막힌 환경이면 `textFirst`.
- 단어 추가 시트: 1단계 표현 입력은 `WordAddSheet.tsx` 안 `<input id="wadd_surface">`, 폼 단계 표현·읽기·뜻·예문 등은 `WordForm.tsx`(`text()`·`area()` 도우미). 읽기 칸은 길이(120자)만 검사한다(히라가나 검사 없음).
- 본문 CLAUDE.md 금기: 사용자 음성·대화를 저장·학습에 쓰지 않는다 → `MIC_TEST` 만 쓴다.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **L1 범위**: 마이크를 붙이는 칸 = **표현**(1단계 입력 + 폼 단계 표현) + **예문**(펼침 안). **읽기는 제외** — 인식 결과가 한자 섞인 표기라 히라가나 읽기 칸에 맞지 않는다. **뜻·예문 뜻·메모·분류는 한국어라 키보드만**(인식기가 일본어 고정).
- **L2 방식**: 수업 「말로 쓰기」와 같다 — 칸 옆 「말로」 버튼 → 그 칸이 「누르고 말하기」(`PushToTalkButton`)로 바뀌고 → 인식 결과가 칸에 들어가며 글자 모드로 돌아와 **사용자가 확인·고친 뒤** 저장. 키보드 입력은 그대로(끄지 않음). 새 인식 경로·새 엔진 호출을 만들지 않는다.
- **L3 결과 반영**: 표현은 **바꿔 넣기**(한 번 더 말하면 다시 말하기), 예문은 **끝에 이어 붙이기**(빈 칸이면 그대로). 길이는 코드포인트 기준으로 기존 한도(표현 80자·예문 한도)를 넘으면 자르지 말고 기존 검증 문구가 보이게 둔다. 결과가 비면 수업과 같은 빈 결과 안내.
- **L4 저장 금지**: `purpose:'MIC_TEST'` 고정. 원음·인식 문장은 React 상태에만 둔다(로그·Trace·DB 없음). 인식 결과는 자동 저장·자동 [뜻 채우기]하지 않는다 — 사용자가 확인 후 기존 버튼을 누른다.
- **L5 불가 환경**: 서버 인식 꺼짐·비보안 주소·지원 안 함·마이크 거부이면 마이크 버튼을 숨기지 말고 **비활성+이유 한 줄**(기존 `micPreflight`·오류 띠 재사용), 키보드 입력은 항상 가능. 앱(온디바이스)과 웹(gateway) 양 경로는 기존 `useRealtimeStt` 가 고른다.
- **L6 수정 시트 제외**: 요청은 「추가할 때」. `WordDetailSheet` 의 수정 폼에는 마이크를 붙이지 않는다(`WordForm` 에 옵션 prop 으로 두고 기본 꺼짐).
- **L7 불변**: 기본 단어 중복·조각 필수·409 안내·429 잠금·`enrich` 흐름·엔진명 비노출·새 API/DB/네이티브 변경 없음. 360/390/412 폭에서 가로 넘침 없음·터치 44px↑(누르고 말하기 ≥64px)·`env(safe-area-inset-*)`.

## 구현 지시 (developer, sonnet)
1. 위 L1~L7. 수업 「말로 쓰기」(`StageApply.tsx`·`useLessonVoice.ts`)와 질문 탭(`useAskInput.tsx`)을 먼저 읽고, **복사·붙여넣기 대신 공용 조각을 재사용**한다. 수업 전용 로직(재생 큐 `pb`·토스트)이 훅에 박혀 있으면 단어용 얇은 훅(`useWordMic` 등)을 새로 만든다 — 기존 수업·질문·회화 동작은 한 줄도 바꾸지 않는다.
2. 파일 범위(예상): `src/components/vocab/{WordAddSheet,WordForm,labels}.tsx|ts` 수정 + 새 `WordMicButton.tsx`·`useWordMic.ts`(이름 자유) + 시험 `__tests__/`. 12개를 넘기면 멈추고 Leader 에게 알린다(standard 승격).
3. 시험: 결과 반영 규칙(표현 바꿔 넣기·예문 이어 붙이기·빈 결과·한도), 불가 환경에서 키보드가 막히지 않음, 수정 시트에는 마이크 없음. 순수 로직은 단위 시험, 화면은 기존 시험 방식(`renderToStaticMarkup` 등 저장소 관례)을 따른다. **변이 점검**(핵심 규칙을 일부러 깨 보면 시험이 실패하는지) 몇 개.
4. 확인 명령(미러에서): `tsc --noEmit` 0 · `eslint` 0 · 관련 시험 + 전체 시험 · `./node_modules/.bin/next build > log 2>&1`(`npm run build/dev` 금지). 증빙(명령·결과 줄)을 기록에 남긴다 — reviewer 가 재실행한다.
5. **하지 않는 일**: 커밋·푸시·배포·DB 쓰기·QA 서버 기동(3011 포함)·운영 포트(3010/3002/3012/307x) 접촉·`.env` 영구 복사·`pkill`. 실기기(마이크 권한·온디바이스) 확인은 사용자 몫이다.
6. 기록: `agent-vault/10-Flow/tasks/task-069-dev-record.md` 에 변경 파일·결정·증빙·알려진 한계. 끝나면 이 이력서 「상태 로그」에 한 줄.

## 완료 기준
1. 단어 추가 시트 표현 칸(1단계·폼 단계)과 예문 칸에서 「말로」를 눌러 일본어로 말하면 결과가 칸에 들어가고, 키보드로 쓰던 것도 그대로 된다.
2. 뜻 등 한국어 칸에는 마이크가 없고, 단어 수정 시트에도 없다.
3. 인식이 안 되는 환경에서도 키보드로 단어를 추가할 수 있고 마이크 버튼은 이유를 보인다.
4. 음성은 저장되지 않는다(`MIC_TEST`). 기존 추가 흐름(뜻 채우기·중복 안내·조각 필수·저장)은 불변.
5. tsc 0 · eslint 0 · 시험 통과 · `next build` 0 · reviewer PASS · 사용자 폰 확인.

## 상태 로그
- 2026-10-15 사용자 요청 → 현재 구현 확인(`WordAddSheet`·`WordForm`·`useRealtimeStt`·`StageApply`, 인식기 일본어 고정) → IMP-0043 접수 → judge 접수(feature·R1·light·demo 면제·sonnet) → 이력서 작성(L1~L7). 다음: developer.
- 2026-10-15 developer 구현 완료(미커밋) — 코드 7(신규 `wordMic.ts`·`useWordMic.ts`·`WordMicField.tsx` + 수정 `WordForm`·`WordAddSheet`·`labels`)·시험 2(24개), 전체 시험 4090/4088 통과·tsc 0·`src` eslint 오류 0·`next build` 0, 변이 점검 12개 전부 시험 실패로 잡음. 사양과 달라진 점·알려진 한계·reviewer 확인처는 [[task-069-dev-record]]. 다음: reviewer(light) → 사용자 폰 확인.
- 2026-10-15 reviewer **REV-069 PASS_WITH_NOTES**(Critical 0·High 0·Medium 1·Low 4) — 재실행 tsc 0·eslint(vocab) 0·마이크 시험 24/24·vocab 249/249·전체 4090 중 4088 통과(1건은 내 임시 파일, 제거 후 통과)·건너뜀 2·`next build` 0, `WordForm` 꺼진 경로 DOM 이 HEAD 와 바이트 동일, 사양과 달라진 점 4개 모두 수용. Medium = 훅·시트 배선 시험 구멍(리뷰어 변이 11개 중 7개 생존, 커밋 전 소스 스캔 보강 권고·차단 아님). 상세 [[task-069-rev-record]]. 다음: Leader 가 Medium 보강 여부 결정 → 사용자 폰 확인.
- 2026-10-15 11:34 developer **REV069 수정 라운드 완료**(미커밋) — REV069-1(Medium) 훅 press/final/retarget·시트 결과 합치기를 `wordMic.ts` 순수 함수로 내리고 순수 시험 5 + 소스 스캔 6 추가, REV069-3 `focusField('surface')`, REV069-4 칸이 바뀌면 보이던 오류를 넘김(`retarget`), REV069-2 결과 반영·오류 띠 뒤 전환 버튼으로 포커스(신규 파일 0, `src/components/vocab/` 6개). 감사에서 살아남은 변이 7개(R1·R2·R3·R4·R7·R8·R9) 전부 이번에 잡힘, 신규 영역 포함 변이 19개 생존 0. tsc 0·eslint(vocab) 0·마이크 시험 35/35·vocab 260/260·전체 4101 중 4099 통과(건너뜀 2)·`next build` 0. 한계: 훅·effect 는 실행 시험이 없어(DOM 도구 없음) 소스 스캔+폰 확인. 상세 [[task-069-dev-record]] 「REV069 수정 라운드」. 다음: reviewer 재확인 → 사용자 폰 확인.
- 2026-10-15 reviewer **REV-069 재감사 PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 신규 2 + 후속 1) — REV069-1~4 해소 확인. 리팩터 동등성: 옛 인라인 ref 로직 ≡ 새 순수 함수 위임(이벤트열 271,453개 차분 시험 동일), 요구 변이 7개(+변형 포함 17개) 전부 시험이 잡음·생존은 기존 훅 분기 3개(X2~X4), `WordForm` mic 꺼진 경로 DOM 은 HEAD 와 바이트 동일 재확인. 재실행 tsc 0·eslint(vocab) 0·마이크 시험 35/35·vocab 260/260·전체 4101 중 4099 통과(실패 0·건너뜀 2)·`next build` 0 — developer 보고와 일치. 신규 Low: REV069-6 결과 반영 뒤 포커스가 다른 입력 칸을 빼앗을 수 있음(선택 수정), REV069-7 훅 분기 3개 시험 밖(선택). 상세 [[task-069-rev-record]] 「재감사 (수정 라운드)」. 다음: 사용자 폰 확인(커밋·푸시·배포는 사용자 승인 후).
- 2026-10-15 사용자 승인 「이대로 커밋·푸시·배포 (권장)」(AskUserQuestion, Low 2건 후속으로 두고 배포) → 커밋 `88eb756`(코드 8파일)·`ad7bbee`(볼트) → 푸시 전 게이트(HEAD `ad7bbee` 아카이브 새 미러): prisma generate 0·tsc 0·eslint 0·전체 시험 4101 중 4099 통과(실패 0·건너뜀 2)·`next build` 0 → 푸시 `c3ffa32..ad7bbee`(task-068 문서 커밋 2개 동반) → 웹훅 배포 `RELEASE_RESULT {"status":"ok","release":"20261015-120043-ad7bbee1","migrated":false}`, **롤백 대상 `…/releases/20261014-162727-c3ffa322`**.

## 운영 배포 (2026-10-15)
- 릴리스 `20261015-120043-ad7bbee1`(sha `ad7bbee1d78b…`, 마이그레이션 없음 — DB·스키마·네이티브·API 변경 0, 웹 배포만). 헬스 PRODUCTION ok 11/11 · pm2 `thekaiwa`·gateway·worker online 재시작 0 · `current` 심볼릭 링크가 새 릴리스.
- 번들(`.next/static`): 새 문구 「일본어로 말하면 표현이 바뀌어요」·「예문 끝에 이어 붙어요」 각 9개 파일에 있음, `MIC_TEST` 5개 파일, 엔진명(`reazon`·`sherpa`·`whisper`·`style-bert`) `chunks/app` 0.
- 운영 읽기 전용 스모크(QA2 쿠키 임시 발급 → 즉시 삭제, GET 만): `/api/health`·`/drawer/words`·`/study/today`·`/api/v1/words?page=1&limit=7`·`/api/v1/speech/config` 모두 200, 단어 목록 `total 7757 · pages 1109 · items 7`(task-068 결과 유지). 미러 `.env`·쿠키 파일 삭제 확인.
- **이 스모크가 확인하지 못한 것**: 마이크 버튼의 실제 동작(권한 창·녹음·인식 결과 반영)은 서버 쪽 GET 으로는 볼 수 없다 — 웹(gateway)·앱(온디바이스) 양 경로 모두 **사용자 폰 확인** 몫.
- 되돌리기: 웹 배포만이라 `bash scripts/deploy.sh TheKaiwa --rollback`(→ `…20261014-162727-c3ffa322`)으로 즉시 가능. 데이터 영향 없음.

## 최종 요약 (2026-10-15)
**한 일**
- 단어 추가 시트의 **표현**(1단계 입력과 폼 단계)과 **예문** 칸에 「말로 쓰기」를 붙였습니다. 칸 옆 「말로 쓰기」를 누르면 「누르고 말하기」로 바뀌고, 일본어로 말하면 인식 결과가 칸에 들어가며 글자 모드로 돌아와 고친 뒤 저장합니다. **키보드 입력은 그대로**라 둘 다 쓸 수 있습니다.
- 표현은 말할 때마다 **바꿔 넣고**, 예문은 **끝에 이어 붙입니다**. 인식 결과는 자동 저장·자동 뜻 채우기를 하지 않습니다. 음성은 저장되지 않는 용도(`MIC_TEST`)로만 씁니다.
- 인식이 안 되는 환경(서버 인식 꺼짐·마이크 거부 등)에서는 마이크 버튼이 이유 한 줄과 함께 막히고, 키보드로는 언제나 추가됩니다.

**하지 않은 것(결정 L1·L6)**: 인식기가 일본어 고정이라 **뜻·예문 뜻·메모·분류(한국어 칸)에는 마이크가 없습니다**. 읽기 칸은 인식 결과가 한자 섞인 표기라 맞지 않아 뺐고, 단어 수정 시트에도 붙이지 않았습니다(요청이 「추가할 때」).

**검증**: 감사 2회(1차 Medium 1·Low 4 → 수정 → 재감사 새 High/Medium 0), tsc 0 · eslint 0 · 전체 시험 4,101 중 4,099 통과 · `next build` 0 · 변이 19개 모두 시험이 검출, 푸시 전 게이트 통과, 운영 읽기 전용 스모크 통과.

**남은 일 / 알려진 한계**
1. **사용자 폰 확인**: ① 표현 칸 「말로 쓰기」 → 일본어 한 마디 → 칸에 들어간 값에 `。` 같은 문장부호가 붙는지[추측] ② 앱에서 첫 누름은 권한 창만 뜨고 안내가 맞게 나오는지 ③ 마이크 거부 상태에서 버튼이 막히고 키보드로는 추가되는지 ④ 손 뗀 직후 다른 칸의 「말로 쓰기」를 누르면 앞 결과가 버려지는 설계가 놀랍지 않은지 ⑤ 360px(큰 글꼴 포함)에서 가로 넘침이 없는지, 칸마다 +26px 이 답답하지 않은지(답답하면 designer 판단).
2. 알려진 Low: REV069-6 손을 뗀 뒤 결과가 오기 전에 다른 입력 칸을 누르면 결과 도착 시 포커스가 전환 버튼으로 빼앗김(키보드가 닫히는 정도·데이터 영향 없음) · REV069-7 훅의 빈 결과 안내 등 분기 3개가 시험 밖 · REV069-5 단어 시트 번들에 수업 재생 코드가 딸려 옴(기존 질문·평가와 같은 방식, `useSpeechConfig` 를 speech 폴더로 옮기면 정리).
3. 결과가 들어간 뒤 포커스가 입력 칸이 아니라 전환 버튼으로 가서 키보드 사용자는 바로 고치려면 Tab 한 번이 더 듭니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-15 10:54 |
