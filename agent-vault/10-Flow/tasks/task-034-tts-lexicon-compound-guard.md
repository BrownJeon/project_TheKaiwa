---
task_id: task-034
title: "TTS 발음 사전 복합어 경계 가드 + 사전 캐시 경쟁 정리 (032 후속)"
status: done
base_ref: 3ed4425
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-032-lexicon-to-reading, task-003d-tts-p0, task-003g-lexicon-admin]
tags:
  - type/task
  - domain/speech
  - domain/tts
aliases:
  - TTS 복합어 가드
  - task-034
created: 2026-10-05
updated: 2026-10-05
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[task-032-lexicon-to-reading]] 에서 화면 읽기 줄은 "복합어 유지" 규칙(분석기가 더 긴 단어를 알아본 구간은 사전을 덮지 않음)을 넣었지만, **TTS 경로에는 같은 가드가 없다.** 시드 사전 `明日`=アシタ 가 `明日香`(あすか, 사람 이름) 안에서도 최장 일치로 잡혀 TTS 가 `アシタ香` 로 읽는다. 사용자가 듣는 소리의 결함이다.

1. **복합어 경계 가드**: TTS 사전 매칭이 더 긴 한자 단어의 일부를 잡지 않게 한다. 건너뛴 구간은 엔진 기본 읽기(복합어를 아는 쪽)로 맡긴다 — 틀린 읽기를 만드는 것보다 안전한 방향.
2. **사전 캐시 경쟁 정리(REV-103 L-1)**: `clearLexiconCache()`(커밋 직후 호출)가 진행 중인 옛 조회(`displayInflight`·`loadActiveLexicon` 의 진행 조회)를 버리지 않아, 사전 게시 순간 진행 중이던 조회가 옛 사전을 캐시에 다시 채울 수 있다(≤30초). 세대 번호 비교로 막는다.

## 예상 변경 경로
- `src/modules/speech/tts/lexicon.ts` (매칭 가드·캐시 세대)
- `src/modules/speech/tts/renderingPlan.ts` (필요 시 — `prepareSegments` 호출부)
- `src/modules/speech/tts/__tests__/**` (단위 테스트 추가)
- 화면·DB·네이티브·프롬프트 변경 없음. TTS 캐시 키는 `lexiconDigest`(적용된 hint 요약)를 포함하므로 가드로 hint 가 빠진 문장은 옛 오디오와 키가 달라 옛 `アシタ香` 소리를 재사용하지 않는다(개발자가 확인).

## 설계 판단 (Leader 권고 — 개발자가 실측 후 확정)
- **권고 = 한자 이웃 휴리스틱**: 한자만으로 된 사전 표기가 한자 연속열의 **일부**(앞 또는 뒤 글자가 한자)에 걸려 매칭되면 그 일치를 버린다. 결정적·지연 0·새 의존 없음, 틀리면 "엔진 기본 읽기"로 떨어지는 안전한 방향.
- 대안 = 분석기(`annotateReadings`) 재사용으로 화면과 같은 판정식. 정확하지만 TTS 캐시 조회 전 경로에 분석기 호출이 들어가 지연·장애 전파가 생긴다 → 이번에는 채택하지 않는다.
- 가나가 섞인 표기(`愚か`·`青か`)와 가나 전용 표기는 영향 없음. 사전 미리듣기(003g)도 같은 `prepareSegments` 를 쓰므로 같이 바뀐다 — 관리자 화면 문구 변경 없음.

## 관련 과거 이력 요약
- [[task-032-lexicon-to-reading]]: 화면 읽기 덮어쓰기 규칙 3(복합어 유지)·REV-103 L-1(`displayInflight` 가 `clearLexiconCache` 로 비워지지 않음)·범위 밖 기록 "TTS `明日香`→アシタ香".
- [[task-003d-tts-p0]]: TTS 플랫폼(사전 치환 방식 A·`findLexiconMatches` 최장 일치·캐시 키 12요소).
- [[task-003g-lexicon-admin]]: 사전 관리·미리듣기 비교.
- 승인된 교훈: 없음(`/이슈기록 관련` 0건).

## Judge 판정

- [2026-10-05 14:31] intake engine=jev → task_type=local_fix · risk=R1 · developer_model=opus · track=standard · next=assign | overrides=- | fallback=- | tokens=1362

**결정 요약**
- 유형: local_fix (국소 수정)
- 복잡도: 2.45 (중간)
- 위험: R1 (정상)
- 개발자 모델: Opus
- 트랙: standard (풀 QA)
- 다음 단계: assign (개발자 배정)
- 역할: developer, reviewer, qa
- 데모: 불필요 (none)
- 엔진: jev (규칙 위반·비밀 없음)

**Leader 재확인 (2026-10-05 14:33)**: judge 에이전트가 판정 결과가 아니라 입력 JSON 을 `.out.json` 으로 저장해(`check.mjs init` 거부) Leader 가 `judge.mjs --input /tmp/judge-task-034-intake.json` 을 직접 다시 실행 → `/tmp/judge-task-034-intake.result.json`(`judge-result@2`, engine=jev, fallback 없음). 결정: task_type=local_fix · complexity=2.35 · risk=R1 · developer_model=opus(`MD-judge-failed-opus`) · track=standard · demo=none · next=assign · roles=developer·reviewer·qa. `check.mjs init` → `not_required`(demo_gate 기록 완료). 위 14:31 줄의 복잡도 2.45 는 첫 실행 값(판정 변동 ±0.1, 결론 동일).
- 실호출모델=opus (developer, judge 값 그대로)

## 판단 기록 (judge) — C2

- [2026-10-05 14:58] codex_gate C2 (Leader 가 `judge.mjs --input /tmp/judge-task-034-c2.json` 직접 실행, 결과 `/tmp/judge-task-034-c2.result.json`, `judge-result@2`·engine=jev·fallback 없음) → `codex_required: false` · `wanted_before_budget: true` · `budget_rule: CX-limit-unknown-hold` · `codex_calls_used: 0` · `codex_switch: on`. 입력 요약에 코드·diff·사용자 데이터 없음(기능 수준 서술 + 경로).
- **Codex 보류 사유**: 한도 값이 stale(`remaining_limit_pct: null`, 마지막 관측 2026-09-27) → R1 은 Codex 개입 불가(R2 만 가능). 사용자의 Codex `/status` 값이 `set-limit` 으로 기록되지 않아 이 task 도 Codex 검토 없이 진행 — "Codex 검토 실패" 가 아니라 한도 미기록 보류. override 없음.
- **Leader 판단(REV-106 후속 분류)**: Medium 2·Low 3·Info 2 전부 비차단. M-1(어댑터 재검색 규칙 복사본↔영구 결합 테스트 없음)·M-2(한자 전용 사용자 표기가 한자 이웃에서 꺼짐 — 사양 수용)는 정리 backlog 로, L-1 정본 16 §2·주석 정리는 Leader 가 QA 중 처리, L-2·L-3 은 backlog. Developer 재수정 없음 → QA 진행(`qa-034`, model=sonnet — 실서버 QA 는 명령·원 출력 기록 필수 교훈).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-05 14:33 |

## Developer 기록

- [14:42] 착수(opus). `git status` = 이 이력서만 미추적(clean). 코드 확인 결과:
  - **어댑터 `substituteReadings` 는 표기 재검색 방식**(위치 정보 없음, 정규화 문장에서 hint 표기를 왼쪽부터 최장 일치로 다시 찾아 치환). hint 를 빼는 것만으로는 부족한 경우 2가지: ① 같은 문장에 `明日香`(가드로 버림)와 단독 `明日`(유지)가 함께 있으면 재검색이 둘 다 치환 ② 버린 긴 후보 안에 남은 hint 표기가 있으면(`東京都庁と京都` 에서 `東京都` 버림 → `京都` 재검색이 `東京都` 안을 잡음).
  - 정규화기가 숫자를 한자 숫자로 바꾸므로(`明日3時`→`明日三時`) 어댑터 쪽에서 같은 한자 이웃 가드를 다시 하면 L4 판정과 어긋나 회귀(사전 미적용)가 생긴다 → **어댑터는 바꾸지 않고 L4 에서 해결**: 가드 후 남은 hint 로 어댑터 재검색을 정규화 문장에서 흉내 내 남긴 위치와 다르게 잡히는 표기는 그 세그먼트 hint 에서 통째로 뺀다(고정점까지 반복, 엔진 기본 읽기 = 안전 방향).
  - `findLexiconMatches` 는 화면 읽기(`reading/lexiconOverlay`)도 쓰므로 **바꾸지 않고** 새 함수(`guardCompoundMatches`)를 `prepareSegments` 에서만 적용.
  - 테스트 위치: 기존 관례는 `src/modules/speech/__tests__/` 이나 지시대로 `src/modules/speech/tts/__tests__/` 에 신규 파일(`npm test` 는 src 전체 `*.test.ts` 를 찾음).
  - 남은 일: lexicon.ts(가드·세대) → renderingPlan.ts(재검색 일관성) → 테스트 → 변이 점검 → 증빙. 미커밋 파일: 없음(아직 편집 전).
- [14:46] 체크포인트 — **완료**: `lexicon.ts`(`guardCompoundMatches`·`rescanHintSurfaces` 추가, `findLexiconMatches` 불변 / 캐시 세대 `cacheGeneration`: `clearLexiconCache` 가 세대 증가+`displayInflight` 비움, `loadActiveLexicon`·표시용 조회는 같은 세대일 때만 캐시 기록, 표시용 진행 조회 정리는 자기 자신일 때만) · `renderingPlan.ts`(`prepareSegments` = 후보 → 가드 → 정규화 → 어댑터 재검색 흉내로 다른 자리 잡는 표기 제거, 고정점 반복) · 신규 `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts` 12건. 미러 실행 신규+기존 tts·reading·adapter 7파일 77/77 pass. 실측: speech venv pyopenjtalk 0.4.1 로 엔진 기본 읽기 확인 — `明日香さん`=アスカサン, `日本橋駅`·`秋葉原駅`·`御徒町駅`·`神保町駅`·`等々力駅`·`新日本橋` 모두 정답(시드 항목이 한자 이웃으로 빠져도 회귀 없음), `明日学校`=アシタガッコー.
  - **남은 일**: 변이 점검(가드·세대·inflight 비움·정리 신원·재검색) → typecheck·eslint·전체 npm test → 증빙 기록 → 보고.
  - **다음 첫 행동**: 미러 사본에 변이 1건씩 넣고 신규 테스트 실행 → `bash scripts/sync-local.sh` 로 원복.
  - **주의점**: Prisma 위임 객체는 프록시라 `mock.method` 불가 → 테스트에서 `findFirst` 직접 대입·finally 원복. 어댑터(engine) 무변경.
  - **미커밋 파일**: `src/modules/speech/tts/lexicon.ts`, `src/modules/speech/tts/renderingPlan.ts`, `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts`(신규), 이 이력서.
- [14:51] 테스트 수정 — L4 테스트가 엔진 어댑터 파일(이름에 엔진명 포함)을 import 하지 않게 바꿈: 신규 테스트의 어댑터 출력은 `rescanHintSurfaces` 로 재구성하고, 어댑터 테스트(engine/__tests__/ttsAdapter)가 고정한 `substituteReadings` 예시(`日本橋駅と日本橋`→`ニホンバシエキとニホンバシ`)와 같은 입력·출력으로 맞춤. **실 어댑터 대조는 미러 임시 프로브로 1회 실행 후 삭제**(아래 증빙).
- [14:52] **구현 완료 — Reviewer 인계 대기.**
  - **가드 판정식**: 후보 = 기존 `findLexiconMatches`(최장 일치) 전체 → 표기가 전부 한자(`\p{Script=Han}`+`〆`·`ヶ`, `々` 은 Han 포함)인 후보만 대상 → 바로 앞(서로게이트 쌍 고려)·바로 뒤 글자가 한자이고 그 글자가 **다른 후보**에 속하지 않으면(다른 후보의 end==start / start==end) 버림. 버린 후보도 경계 판정에는 씀(`今日明日香` → `今日` 유지·`明日` 버림).
  - **어댑터 재검색**: `substituteReadings` 는 위치 없는 표기 재검색(코드 확인). 어댑터는 **무변경**. 대신 `prepareSegments` 가 남은 hint 로 어댑터 규칙(중복 제거→긴 표기 먼저→왼쪽부터)을 정규화 문장에서 흉내 내, 보호 구간과 다른 자리를 잡는 표기를 그 세그먼트 hint 에서 통째로 뺌(정규화 다시 → 고정점). 결과: `明日香さんは明日来ます`·`東京都庁と京都` → hint 0(엔진 기본 읽기). 정규화로 생긴 한자 이웃(`明日3時`→`明日三時`)은 원문 판정 유지(アシタ 적용).
  - **캐시 키**: hint 가 빠지면 `lexiconDigest` 가 달라지거나 null 이 되어 키가 바뀜(테스트 확인) → 옛 `アシタ香` 오디오 재사용 없음. hint·정규화문이 같으면 어댑터 출력도 같으므로(어댑터 무변경) 키가 같은 경우 오디오도 정답 → **`TTS_TEXT_VERSION` 올리지 않음**.
  - **캐시 세대**: `clearLexiconCache()` = 세대+1·캐시 비움·표시용 진행 조회 비움. `loadActiveLexicon` 은 반환값 계약 그대로(기다리던 요청은 받은 값 사용), 시작 세대와 같을 때만 캐시 기록. 표시용 진행 조회의 `finally` 는 자기 자신일 때만 삭제.
  - **실행 증빙**
    - `npm run typecheck` → exit 0(출력 오류 0).
    - `node node_modules/eslint/bin/eslint.js src/modules/speech src/modules/engine/adapters/tts`(미러) → exit 0, 출력 0줄.
    - 단위(미러) `node --import tsx --test --test-concurrency=1` 신규 `tts/__tests__/lexiconCompoundGuard.test.ts` + 기존 `ttsLexiconPlan`·`ttsNormalizer`·`readingLexicon`·`reading`·`lexiconAdmin`·`ttsCacheRequest`·`engine/ttsAdapter` → **tests 95 · pass 95 · fail 0 · skip 0**(신규 12/12).
    - 전체 `npm test` → **tests 1466 · pass 1465 · fail 0 · cancelled 0 · skipped 1**, exit 0.
    - 변이(미러 사본, 1건씩 넣고 신규 테스트 → `sync-local` 원복, `diff -rq` 동일 확인): M1 가드 끔 → 5 FAIL · M2 왼쪽 "다른 후보" 경계 제거 → 1 FAIL(`今日明日`) · M3 재검색 일관성 끔 → 1 FAIL(`明日香さんは明日来ます`) · M4 표시용 세대 검사 제거 → 2 FAIL · M5 `loadActiveLexicon` 세대 검사 제거 → 1 FAIL · M6 clear 시 진행 조회 비움 제거 → 1 FAIL · M7 `finally` 신원 검사 제거 → 1 FAIL. **7/7 killed.**
    - 실 어댑터 대조 프로브(미러 임시 파일, 실행 후 삭제·잔존 0): 17문장 `prepareSegments` → 실제 `substituteReadings` 결과가 `rescanHintSurfaces` 재구성과 **17/17 동일**, `アシタ香` 0건(`明日香さん`→그대로, `明日は晴れです`→`アシタは…`, `今日明日香さんが来る`→`キョー明日香…`, `明日3時に会おう`→`アシタ三時に…`).
    - 엔진 기본 읽기 실측(speech venv pyopenjtalk 0.4.1, 프록시): `明日香さん` アスカサン · `日本橋駅` ニホンバシエキ · `秋葉原駅`·`御徒町駅`·`神保町駅`·`等々力駅`·`等々力渓谷`·`新日本橋` 모두 정답 · `明日学校` アシタガッコー · `明日三時` アシタサンジ.
    - 엔진명 grep: 변경 3파일(`lexicon.ts`·`renderingPlan.ts`·신규 테스트)에 엔진명 0건.
  - **남은 위험**: (1) 사용자가 넣은 한자 이름 뒤에 한자 접미어(`様`·`氏`·`君`·`駅` 등)가 붙으면 사전이 빠지고 엔진 기본 읽기 — 엔진이 그 이름을 틀리게 읽으면 사전 효과 상실(후속 후보: 접미어 허용 목록 또는 wordType 예외). (2) 같은 문장에 복합어 안 표기와 단독 표기가 함께 있으면 단독 쪽도 사전 미적용(어댑터가 위치 기반 치환을 하면 해소 — engine 계약 변경이라 범위 밖). (3) 화면 읽기 줄(분석기 판정)과 TTS(한자 이웃 휴리스틱) 판정식이 달라 경계 사례에서 표시·소리가 어긋날 수 있음(`明日学校` 표시 あした·소리 엔진 기본). (4) REV-103 L-1 의 "DB 장애 중 직전 사전 무기한 사용"은 이번 범위 밖(그대로).
  - **미커밋 파일**: `src/modules/speech/tts/lexicon.ts`, `src/modules/speech/tts/renderingPlan.ts`, `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts`(신규), 이 이력서. (`agent-vault/10-Flow/board.md` 변경은 Leader 것 — 손대지 않음.) 커밋·푸시 안 함.

## Reviewer 기록 (REV-106, 2026-10-05, standard 트랙 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 2 · Low 3 · Info 2. `native_change: false`(plugins·android·capacitor·Manifest 무변경, `git status -- src/ plugins android capacitor.config.ts prisma docs` = `lexicon.ts`·`renderingPlan.ts` 수정 + 신규 `tts/__tests__/` 뿐). 어댑터(`engine/adapters/tts/styleBertHttp.ts`)·화면·DB·프롬프트·reading 경로 **무변경 확인**(`findLexiconMatches` diff 0). Medium 이하 전부 **비차단 후속** — QA 진행 가능.

### 영역별 결론
| 영역 | 결론 |
|---|---|
| 1 아키텍처 | 이상 없음. `renderingPlan`→`lexicon`·`normalizer`(같은 층 상대 import)·`lexicon`→`infra` index. 엔진명·`model_id`·`speaker_id` grep 0건(3파일). 라우트·화면 영향 0. |
| 2 유지보수성 | **M-1**(어댑터 재검색 규칙 복사본). 그 밖 하드코딩 없음(KANJI_CHAR·0x… 상수는 규칙 정의). |
| 3 안정성 | 고정점 반복은 **항상 종료**: `ambiguous` 의 모든 표기가 `matches` 표기에서만 나오고(`out.add(m.surface)`·`found`/`expected` 키 모두 matches 유래) 호출부가 그 표기를 통째로 `filter` 로 빼므로 매 회 `matches` 가 1건↑ 줄어든다(≤ 표기 수+1 회). 퍼저 300,000건 무한 루프 0. 캐시 세대 로직 정확(아래 4). |
| 4 운영성 | 새 로그·Trace 필드 없음. `TTS_LEXICON.matches` 건수는 가드 후 값으로 바뀐다(의도). 사용자 문장이 새로 로그에 나가는 경로 0(변경 파일 `console.*` 는 기존 2줄 — 사전 조회 지연·실패, 문장 미포함). |
| 5 성능 | 가드 O(후보 수), 정규화는 ≤ 표기 수+1 회, 입력 ≤100자(`single`). 퍼저 300,000건 총 2.3s(건당 ≈8µs). N+1·네트워크 없음. |
| 6 보안 | 신규 입력면·인증·Secret·`DATA_ROOT` 변경 없음. 테스트가 Prisma 위임 객체 `findFirst` 를 프로세스 안에서만 교체(DB 접속 0) 후 `finally` 원복. |
| 7 학습 원칙·TTS 플랫폼 | 해당 변경 없음(제안→채택·스냅샷 무관). 캐시 키(12요소 + `lexiconDigest`) 불변 — 아래 3. 엔진 파라미터 이름은 어댑터 밖 0건. |

### 점검 중점 결과
1. **가드 판정식** — 한자 전용 표기만 대상(`[...surface].every(isKanjiChar)`; 가나·영숫자 혼합은 면제: `愚か`·`青か`·`JR1番線`·전각 `ＪＲ１番線駅` 모두 hint 유지 실측). 위치는 원문 좌표를 쓰는데 `toWorkingText` 가 코드 유닛 1:1 변환이라 working 좌표와 동일(어긋남 없음, 전각 영숫자 표기·`ＡＢ明日` 퍼저 포함 0건). 서러게이트: `charBefore` 가 쌍이면 `i-2` 의 코드포인트, `charAtCp` 가 코드포인트 단위 — `𠮷明日`·`明日𠮷`·`𠮷𠮷` 정상. 다른 후보 일치의 이웃은 `starts/ends` 집합(후보 전체·버려진 후보 포함)으로 판정해 순서 독립(테스트가 역순 입력으로 확인, `今日明日香`→`今日` 유지·`明日` 버림 재현). 빈 문자열·사전 0건(`selected.size===0` 조기 반환)·표기=문장 전체(`明日` 유지) 실측 정상. 〆·ヶ·々 는 Han+보강 클래스로 처리(`ヶ` 는 가타카나라 보강 필요 — 아래 L-3).
2. **어댑터 재검색 대응** — `rescanHintSurfaces` 와 실제 `substituteReadings` 는 동작 동일(중복 제거 순서=Map/Set 첫 삽입 순서 동일, 길이 내림차순 안정 정렬, 왼쪽부터 최장·건너뛰기). 내가 **무작위 퍼저 300,000건**(표기 15종 중 1~5개, 한자·가나·숫자·공백·전각·서러게이트·ヶ〆々 혼합, hint 발생 37,660건)으로 `prepareSegments` 결과를 **실제 어댑터**에 넣어 "보호 구간만 치환된 문장(독립 재구성)"과 대조 → **불일치 0**. `明日香さんは明日来ます`·`東京都庁と京都`→ hint 0(엔진 기본), `明日3時に会おう`→`アシタ三時…`(정규화가 만든 한자 이웃은 원문 판정 유지) 실측 재현. 어댑터에 같은 가드를 넣지 않은 판단은 **타당**(어댑터는 정규화 뒤 문장을 봐서 숫자→한자 숫자로 이웃이 바뀌므로 L4 판정과 어긋나 `明日三時` 에서 사전 미적용 회귀가 생김).
3. **캐시 키·옛 오디오** — 키 = `normalizedText|voiceProfileId|modelVersion|dictionaryVersion[:lexiconDigest]|speechProfile|…`. hint 가 빠진 문장은 `lexiconDigest` 가 null 이 되거나 달라 키가 바뀐다(테스트가 `明日香さん`·`明日香さんは明日来ます` 로 옛 키와 다름 확인). 키가 같으면 (정규화 문장, hint 목록) 이 같고 어댑터는 두 입력의 순수 함수이므로 오디오도 같다 → 키는 같은데 오디오가 달라지는 경로 없음. **`TTS_TEXT_VERSION` 미증가 판단 타당.** 합성·설정 점검(`configProbe`)·사전 미리듣기(`lexiconPreview` g2p) 세 경로 모두 `p.parts.normalizedText`+`p.hints` 를 같은 `prepareSegments` 결과로 전달.
4. **캐시 세대(REV-103 L-1)** — `loadActiveLexicon`: `cache.get` 직후 await 없이 세대 캡처 → 세대가 같을 때만 `cache.set`(기다리던 요청은 받은 값 사용, 반환 계약 불변). `loadLexiconForDisplay`: 세대 캡처 후 같은 세대일 때만 기록, `clear` 가 `displayInflight` 도 비워 clear 뒤 요청은 옛 진행 조회에 합류하지 않으며, `finally` 는 `displayInflight.get(env) === started` 일 때만 삭제(새 조회 슬롯 보호). 두 경로 변이로 직접 확인(아래). 쓰기 프로세스·타 프로세스 30초 캐시 동작·`afterLexiconCommit` 호출 위치(`lexiconStore.ts:536` 커밋 뒤) 불변. DB 장애 중 직전 사전 무기한 사용은 범위 밖(그대로).
5. **영향 범위** — `findLexiconMatches` 무변경이라 `reading/lexiconOverlay`(화면 읽기) 회귀 없음(테스트·`readingLexicon` 통과). 사전 미리듣기는 같은 `prepareSegments` 를 쓰므로 가드가 같이 적용된다(의도, 문구 변경 없음 — L-1 참고). 6층 방향·`index.ts` 우회 없음.
6. **테스트 품질** — 아래 변이 14건 중 12 killed·2 survived(둘 다 동치/방어 코드로 설명됨). node:test 는 파일별 자식 프로세스(`isolation=process` 기본, `--experimental-test-isolation=none` 미사용 — `package.json` test 스크립트 확인)라 `findFirst` 교체가 다른 파일로 새지 않는다. 같은 파일 안에서는 `finally` 원복·각 테스트 시작/끝 `clearLexiconCache()` 로 순서 독립. 시간 의존은 "영원히 안 끝나는 조회 vs 10ms" 라 불안정하지 않다.

### 지적 표
| # | 심각도 | 위치 | 분류 | 재현·근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | MEDIUM | `speech/tts/lexicon.ts:164-178`(`rescanHintSurfaces`) ↔ `engine/adapters/tts/styleBertHttp.ts:43-55`(`substituteReadings`) | 유지보수성(복사본 드리프트) | L4 가 어댑터의 "위치 없는 표기 재검색" 규칙을 손으로 복사했고, 둘을 묶는 **영구 테스트가 없다**: 신규 테스트의 `substituted()`(test:29-37)는 `rescanHintSurfaces` 를 "어댑터" 대역으로 쓰고, 어댑터 테스트(`ttsAdapter.test.ts:65`)는 `日本橋駅と日本橋` 한 예시만 고정한다. 개발자의 17/17 실 어댑터 대조는 일회성 임시 프로브(삭제됨). 누가 `substituteReadings` 를 바꾸면(우선순위 정렬·위치 기반 치환 등) L4 보정이 조용히 틀어져 `明日香` 류가 부활해도 테스트는 모두 초록이다. (오늘 시점 동일성은 내 퍼저 300,000건으로 확인 — 현재 결함은 아님.) | ① 입력→기대 치환 표를 JSON 픽스처 하나로 두고 L4 테스트(`rescanHintSurfaces` 재구성)와 어댑터 테스트(`substituteReadings`)가 **같은 파일을 읽어** 동시에 검증(층 방향 위반 없이 결합). ② 구조적 해법(후속 Leader 판단 — 엔진 계약 변경): `TtsLexiconHint` 에 정규화 문장 좌표(`start`)를 싣고 어댑터가 위치 기반 치환 → 복사본·M-2 의 "통째 제거" 부작용이 함께 사라진다. |
| M-2 | MEDIUM | `lexicon.ts:149-158`(`guardCompoundMatches`)·`renderingPlan.ts:46-71` | 기능 트레이드오프(사용자 소리) — 문서화된 위험 (1)(2) 확인 | 한자 전용 사용자 표기는 **한자 이웃이 하나라도 있으면** 꺼진다(건너뛴 구간은 엔진 기본 읽기). 실측: `山田先生と山田さん`(`山田`=ヤマダ) → hint 0 — 깨끗한 `山田さん` 자리까지 함께 꺼짐(어댑터 재검색이 위치를 못 가려 표기 통째 제거), `海老名駅`→hint 0, `今日学校に行く`→hint 0. **시드 6건은 안전**: 내가 speech venv pyopenjtalk 0.4.1 로 27개 표기(`明日来ます`·`明日仕事`·`日本橋駅`·`秋葉原電気街`·`等々力渓谷` 등)를 재측정해 엔진 기본 읽기가 사전과 같음 확인(개발자 보고 일치). 영향은 **엔진이 틀리게 읽어서 사용자가 등록한** 한자 전용 이름·지명이 `様·氏·君·先生·駅·市·県…` 접미어와 붙을 때. 관리자 미리듣기는 "걸리지 않았어요" 만 보여 주고 새 사유를 설명하지 않는다. Leader 사양(권고안)·개발자 위험 기록이 이미 인지한 트레이드오프라 **차단 아님**. | 후속 task 후보: `wordType=PERSON·PLACE` 한정 접미어 허용 목록(様·氏·君·殿·先生·駅·市·区·町·村·県…)을 우측 이웃 면제로 두거나, M-1②(위치 기반 치환)로 "복합어 안 표기만" 정확히 끄기. 그 전까지 QA 는 M4 실 엔진 `/g2p` 로 `明日香さん`·`明日来ます` 확인(프록시 pyopenjtalk 와 같은지). |
| L-1 | LOW | `docs/design/speech-platform/16-tts-productization-layer.md:75,97`·`reading/lexiconOverlay.ts:5`·`components/admin/lexicon/lexiconCopy.ts:267`·`LexiconScreen.tsx:42` | 정본·문구 드리프트(Leader/designer 경로) | 16 §2 L-2 는 "최장 일치 우선" 만 적고 TTS 복합어 가드를 언급하지 않는다. 같은 문서 97행의 "알려진 한계: 진행 중 조회가 저장 직후 옛 사전으로 캐시를 다시 채울 수 있음(REV-103 L-1)" 은 이번에 해소됐다. `lexiconOverlay.ts:5` 주석 "표시와 소리가 같은 항목을 고른다" 는 경계 사례에서 표시(분석기)·소리(한자 이웃)가 갈릴 수 있어 부정확. 관리자 `notHitText`(걸리지 않은 이유 안내)에 "더 긴 한자 단어의 일부면 걸리지 않아요" 사유가 없다. task 사양이 "관리자 화면 문구 변경 없음" 이라 결함이 아니라 후속. | Leader 가 16 §2 한 줄·97행 문장 정리, 문구는 designer 경로로 판단(리뷰어는 디자인 결함으로 판정하지 않음). |
| L-2 | LOW | `renderingPlan.ts:60`(`const lead = raw.length - raw.trimStart().length`) | 죽은 방어 코드 | 정규화기 WHITESPACE 규칙이 문장 양끝 공백을 이미 `''` 로 치환하므로 `raw` 에 선행 공백이 남지 않아 `lead` 는 항상 0 — 변이 M11(`lead = 0`)이 **살아남음**. `' 明日、10時'` 테스트(test:111)는 이 줄을 검증하지 못한다(공백이 규칙으로 지워져 어느 쪽이든 통과). | 제거하거나 "방어" 주석을 달고 테스트 설명에서 이 줄을 빼기. 동작 영향 없음. |
| L-3 | LOW | `lexicon.ts:125`(`/^[\p{Script=Han}〆ヶ]$/u`) | 경계 정의 | `ヶ`(U+30F6)는 가타카나인데 한자 클래스에 넣어, `ヶ月` 같은 표기는 "한자 전용" 으로 취급돼 `三ヶ月間` 처럼 한자 숫자 뒤에서는 항상 꺼진다(실측 hint 0). 숫자(`3ヶ月`)는 한자가 아니라 정상. 영향 작음. | 표기 전체가 `ヶ` 로 시작하는 경우만 면제하거나 주석에 명시. |
| I-1 | INFO | `renderingPlan.ts:69`(`expected`⊄`found` 방향) | 과잉 제거(안전 방향) | 변이 M10(이 줄 삭제)이 살아남음: 고정점 반복이 어차피 해소해 주는 방향이라 이 줄은 과다 제거만 만든다(`京明日香学、日香`+`明日`·`香学`·`日香` → hint 0, 이 줄이 없으면 `香学` 이 남음). 안전 방향이고 드문 입력이라 유지 가능. | 조치 불요(정보). |
| I-2 | INFO | task 이력서 "엔진 기본 읽기 실측" | 검증 한계 | 개발자·나 모두 **프록시**(speech venv pyopenjtalk 0.4.1) 로 확인했고 M4 실 엔진(`tts-service` /g2p) 값은 미확인. 실 엔진 g2p 가 같은 사전을 쓰는지는 QA 가 확인할 영역. | QA high_risk_areas 참고. |

### 재실행 결과(개발 미러 `~/.node-local/thekaiwa`, `sync-local` 후 `diff -rq src` 동일 확인, 운영·pm2·운영 포트 무접촉)
- `tsc --noEmit` → exit 0, 출력 0줄.
- `eslint src/modules/speech src/modules/engine/adapters/tts` → exit 0, 0줄.
- 신규 + 기존 7파일(`lexiconCompoundGuard`·`ttsLexiconPlan`·`ttsNormalizer`·`readingLexicon`·`reading`·`lexiconAdmin`·`ttsCacheRequest`·`engine/ttsAdapter`) → **tests 95 · pass 95 · fail 0**(개발자 보고와 동일).
- 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **tests 1466 · pass 1465 · fail 0 · skipped 1**, exit 0(개발자 보고와 동일).
- **변이(미러에서 1건씩 넣고 신규 테스트 실행 → NFS 원본 복사로 원복 → `sync-local`+`diff -rq src` 동일 확인)**: 14건 중 **12 killed** — M1 가드 끔(5 FAIL) · M2a/M2b 좌·우 "다른 후보 경계" 제거(각 1 FAIL) · M3 재검색 일관성 끔(1) · M5 `loadActiveLexicon` 세대 검사 제거(1) · M15 표시용 세대 검사 제거(2) · M16 `clear` 가 진행 조회 안 비움(1) · M17 `finally` 신원 검사 제거(1) · M18 `clear` 가 세대 안 올림(3) · M8 서러게이트 쌍 처리 제거(1) · M9 `〆ヶ` 제거(1) · M12/M13 좌/우 이웃 무시(2/5) · M14 `found⊄expected` 방향 제거(1). **살아남은 2건**: M10(I-1, 안전한 과다 제거 방향) · M11(L-2, 죽은 코드) — 둘 다 동작 결함 아님. 개발자 보고 변이 7건 전부 재현(개발자 M2·M4·M5·M6·M7 = 내 M2a/b·M15·M5·M16·M17).
- **독립 퍼저**(미러 scratch 임시 파일, 실행 후 삭제): 300,000건·hint 발생 37,660건 — `prepareSegments` 출력을 실제 `substituteReadings` 에 넣은 결과 = "가드 통과 후보의 보호 구간만 치환한 문장"(원문에서 독립 재구성) **불일치 0**, 무한 루프·예외 0, 가드 통과 후보 표기가 통째 제거된 과다 제거는 3,249건(1.1%, 알파벳을 충돌이 많게 잡은 적대 분포).

### QA 로 넘기는 high_risk_areas
1. **M4 실 엔진 `/g2p` 대조** — 사전 미리듣기 또는 `/g2p` 로 `明日香さん`(→アスカサン 기대, アシタ香 아님)·`明日来ます`·`日本橋駅`·`山田先生` 가 프록시(pyopenjtalk 0.4.1)와 같은지(I-2).
2. **사용자 사전 USER 범위 한자 이름 + 접미어**(`山田先生`/`山田さん`) — 소리·미리듣기 "걸리지 않았어요" 표시 확인(M-2 영향 범위 실측, 결함이 아니라 현 상태 기록).
3. **캐시 키 분리** — 가드 전 `アシタ香` 로 합성돼 있던 문장(`明日香さん`)이 재합성되어 새 키로 저장되는지(옛 오디오 재사용 0).
4. **사전 게시 직후 반영** — 사전 버전 게시 → 같은 프로세스에서 30초 안에 새 사전으로 합성·읽기 줄(`#24r`)이 갱신되는지(L-1 경쟁 해소).
5. **회귀** — 화면 읽기 줄(`reading/lexiconOverlay` 5분기)·사전 미리듣기 전/후 비교·TTS 합성 일반 문장(한자 이웃 없는 사전 적용 `明日は晴れです`→アシタ).
6. 360/390/412 UI 변경 없음(화면 파일 무변경) — 3폭 검증은 대상 아님.

> 후속(비차단) 권고 요약: M-1 공유 픽스처 또는 위치 기반 치환(Leader 계약 판단), M-2 접미어 허용·wordType 예외 또는 위치 기반 치환, L-1 정본 16 §2·주석·안내 문구 정리(Leader/designer), L-2·L-3 정리. 이 task 에서 Developer 재수정은 **불필요**(PASS_WITH_NOTES).

## QA 기록 (QA, 2026-10-05, standard 트랙 · 코드 수정 0)

**판정: PASS (Critical 0 · High 0 · Medium 0 · Low 0 — 결함 0건)** · 비차단 관찰 4건(아래 O-1~O-4) · 화면(UI) 변경 없음(`git diff` 에 `src/components`·`src/app` 0 — 3폭·실기기 N/A) · 네이티브 무변경 · **외부 서비스(M4 tts :8200)를 쓴 라이브 점검 포함**, 자동 테스트는 mock/fixture 만으로 통과(`npm test` 외부 서비스 의존 0).

### 환경·재현 조건
- 코드 = NFS `src/` 미커밋 변경(`lexicon.ts`·`renderingPlan.ts`·신규 `tts/__tests__/lexiconCompoundGuard.test.ts`) → `bash scripts/sync-local.sh` → 개발 미러 `~/.node-local/thekaiwa`(`diff -rq src` 동일 확인) · `APP_ENV=LOCAL` · 서버 `next dev -H localhost -p 3011`(**새 코드**, PID 39661/39673).
- **옛 코드 대조 서버**: 하드링크 복제본 `~/.node-local/thekaiwa-qa034`(src 는 실복사, `node_modules` 만 하드링크, `.env` 사본) 의 `lexicon.ts`·`renderingPlan.ts` 두 파일만 `git show HEAD:` 버전(가드·세대 이전)으로 교체 → `next dev -H localhost -p 3012`(PID 43348/43360). 같은 DB(LOCAL 사전)·같은 M4 를 본다. 끝에 두 서버 종료·복제본 삭제.
- 계정: QA 전용 `qa-bot`(USER)·`qa-bot2`(USER)·`qa-admin`(ADMIN)·`qa-developer`·`qa-super`(역할 쿠키는 localhost 직접 요청 전용·권한 600 임시 파일).
- M4: `http://192.168.219.100:8200/health` → `{"status":"OK","warmedUp":true}` — 읽기 확인(미리듣기 JSON, 앱 경유 `/g2p`)·합성(#23, 앱 경유)만. M4 설정·배포 변경 0, 운영 `/home/brownjeon/apps/thekaiwa`·pm2·3010·8100 무접촉(읽기도 안 함).
- 화면 점검 재현 조건(데모 게이트 §8 — `demo_gate: not_required`, UI 무변경이라 동작 확인만): Chrome 147.0.7727.101(`/usr/bin/google-chrome` headless, playwright-core) · 1280×900 · DPR 1 · light · ko-KR · Asia/Seoul · reducedMotion=reduce · 네트워크 fixture 없음(실 dev 서버·실 M4) · 스크린샷 미촬영(DOM 텍스트·응답만) · nextjs-portal 배지 숨김.

### 항목별 판정

| # | 항목 | 판정 | 근거(핵심) |
|---|---|---|---|
| 1 | 단위·정적 | **PASS** | typecheck exit 0 · eslint(speech·adapters/tts) exit 0·0줄 · 대상 8파일 **95/95** · 전체 `npm test` **1466 · pass 1465 · fail 0 · skipped 1**(Developer 증빙과 일치, skip = #9 실제 배포 manifest — 미러에 `speech/models` 없음, 무관) |
| 2 | 핵심 결함 해소(합성·실 엔진) | **PASS** | 옛 코드 서버 `明日香さん` hint 1(明日)→어댑터 입력 `アシタ香さん` → M4 읽기 **アシタガサン**(결함 재현) / 새 코드 hint 0 → M4 읽기 **アスカサン**. `明日来ます`·`日本橋駅`·`山田先生` 등 M4 실 엔진 기본 읽기 전부 정답(O-4 표) |
| 3 | 회귀 | **PASS** | `明日は晴れです`→アシタ 유지(M4 아シタワハレデス, 옛·새 키 동일·캐시 공유) · `明日` 단독 유지 · `明日3時に会おう。` 유지(アシタ三時) · `愚か`·`青か`·`青かった` 가나 혼합 불변 · 일반 문장 합성 정상(RIFF·2.5s) — **단 `今日明日`(시드엔 今日 없음)는 미적용**(O-2, 사전에 今日 도 있으면 양쪽 적용) |
| 4 | 옛 오디오 재사용 없음 | **PASS** | 실 합성: 옛 코드가 만든 `明日香さん` 캐시 행(키 `dc3cf9c211…`) 옆에서 새 코드가 **다른 키 `28c5a3fe2f…`·MISS**로 재합성, 재요청 HIT · 옛 행 보존. 오프라인 퍼저 297,981건: 키 동일·소리 상이 **0**, hint 변경(96,156건)인데 키 동일 **0** |
| 5 | 사전 캐시 세대 | **PASS** | 같은 프로세스 즉시 반영(H1/H2) · 경합 재현: **옛 코드 4/4 stale, 새 코드 4/4 새 사전**(실 DB·실 관리자 서비스, 늦은 결과가 게시 완료 뒤 0.8~2.6s 에 도착함을 타임스탬프로 확인) · 끄기/Rollback 원복 · USER 본인만(H4) · 다른 프로세스 ≤30초(OLD 서버가 27s 뒤 정렬) |
| 6 | 사전 미리듣기(003g) | **PASS** | API(M4): 초안 明日=アシタ+`明日香さん` → after.matches 0(걸리지 않음 표시 조건), 초안 明日香=アスカ → DRAFT 1건·アスカサン. 실 Chrome 관리자 화면: 같은 예문에서 「걸리지 않았어요」 안내 ↔ 「이 예문에 1번 적용」 전환, 저장 요청 0, 콘솔 오류 0, 화면·HTML·응답 엔진명 0 |
| 7 | USER 한자 이름(M-2) | **PASS(기록)** | `山田さん` 적용(1) · `山田先生` 미적용(0) · `山田先生と山田さん` 둘 다 꺼짐(0) — 실 합성 trace·미리듣기·오프라인 일치. 사양상 수용(O-1) |
| 8 | 영향 없음 | **PASS** | `/api/v1/text/annotate` 14문장(5분기 포함)이 시드만·확장 사전(青か·愚か·密か·上手 켬) 두 상태 모두 **옛 코드 서버 응답과 JSON 완전 동일**, 최종 Rollback 뒤 시드 상태 응답으로 복귀 · dev 서버 로그 2개(134·54줄)에 사용자 문장·읽기·엔진명 0건 · QA 계정 RequestTrace 76행에 문장·읽기 문자열 0건 · 응답 71+19+11개에 엔진명·model_id·speaker_id 0건 |
| 환경 | PRODUCTION 사전 무영향 | **PASS** | PRODUCTION 버전 1행(ACTIVE v1, 해시 `d5a22588…`)·항목 6·lexicon 감사 0 — 전후 동일 |
| 화면 | 3폭(360/390/412)·터치·safe-area | **N/A** | 화면 파일 무변경(관리자 미리듣기는 동작만 확인, 위 6) |
| 실기기 | STT·TTS 재생·APK | **N/A** | 네이티브·앱 무변경, 웹 배포만 |

### 실행 명령과 원 출력

**1. 단위·정적**
```
$ npm run typecheck > typecheck.log 2>&1; echo "typecheck exit=$?"
typecheck exit=0
> thekaiwa@0.1.0 typecheck
> bash scripts/sync-local.sh && cd $HOME/.node-local/thekaiwa && node node_modules/typescript/bin/tsc --noEmit

$ diff -rq <NFS>/src src; echo "diff exit=$?"            (미러, sync 후)
diff exit=0
$ node node_modules/eslint/bin/eslint.js src/modules/speech src/modules/engine/adapters/tts; echo "eslint exit=$?"; wc -l eslint.log
eslint exit=0
0 eslint.log

$ node --import tsx --test --test-concurrency=1 src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts src/modules/speech/__tests__/{ttsLexiconPlan,ttsNormalizer,readingLexicon,reading,lexiconAdmin,ttsCacheRequest}.test.ts src/modules/engine/__tests__/ttsAdapter.test.ts
exit=0
# tests 95   # suites 0   # pass 95   # fail 0   # cancelled 0   # skipped 0   # todo 0

$ npm test > npm-test.log 2>&1        (bash scripts/sync-local.sh && node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort))
npm test exit=0
# tests 1466   # suites 0   # pass 1465   # fail 0   # cancelled 0   # skipped 1   # todo 0   # duration_ms 45020.849485
ok 1273 - \#9 실제 배포 manifest(speech/models/reazonspeech-int8) 통과 — 저장소가 보이는 곳에서만(미러는 THEKAIWA_REPO) # SKIP 저장소 speech/models 가 없는 실행 위치(미러) — …
```

**2·3·4(오프라인). 렌더링 플랜 — `tests/live/task034-qa-plan.ts`**(실제 `prepareSegments`·실제 어댑터 `substituteReadings`·`ttsCacheKey` 직접 호출, DB 는 LOCAL ACTIVE 사전 읽기뿐)
```
$ node --env-file=.env --import tsx tests/live/task034-qa-plan.ts
LOCAL ACTIVE v53, 선택된 표기: 御徒町 日本橋 明日 神保町 秋葉原 等々力

## A. 대표 문장 — 시드 사전만 (옛 → 새)
  [핵심 결함(あすか)] 明日香さん
     old hints=["明日"] → adapter「アシタ香さん」 key=baf52be650
     new hints=[] → adapter「明日香さん」 key=69fc9c697c  (키 다름)
  [복합어 뒤 한자] 明日来ます
     old hints=["明日"] → adapter「アシタ来ます」 key=348cfda06a
     new hints=[] → adapter「明日来ます」 key=211d7a229a  (키 다름)
  [시드 日本橋 + 한자 접미] 日本橋駅
     old hints=["日本橋"] → adapter「ニホンバシ駅」 key=d6368537f4
     new hints=[] → adapter「日本橋駅」 key=1905ab413d  (키 다름)
  [시드 밖(사전 무관)] 山田先生
     old hints=[] → adapter「山田先生」 key=051019cb67
     new hints=[] → adapter「山田先生」 key=051019cb67  (키 동일)
  [회귀: 明日 단독(가나 이웃)] 明日は晴れです
     old hints=["明日"] → adapter「アシタは晴れです」 key=c7a4957e1b
     new hints=["明日"] → adapter「アシタは晴れです」 key=c7a4957e1b  (키 동일)
  [회귀: 문장 전체=표기] 明日
     old hints=["明日"] → adapter「アシタ」 key=4a945d1594
     new hints=["明日"] → adapter「アシタ」 key=4a945d1594  (키 동일)
  [시드엔 今日 없음 — 한자 이웃] 今日明日
     old hints=["明日"] → adapter「今日アシタ」 key=246e80c90d
     new hints=[] → adapter「今日明日」 key=73eda0ab20  (키 다름)
  [복합어+단독 혼재] 明日香さんは明日来ます
     old hints=["明日","明日"] → adapter「アシタ香さんはアシタ来ます」 key=b63e0a84a4
     new hints=[] → adapter「明日香さんは明日来ます」 key=8894c59bfc  (키 다름)
  [복합어 앞 한자] 今日明日香さんが来る
     old hints=["明日"] → adapter「今日アシタ香さんが来る」 key=f801f06c40
     new hints=[] → adapter「今日明日香さんが来る」 key=9f6b4823d7  (키 다름)
  [정규화가 만든 한자 이웃] 明日3時に会おう
     old hints=["明日"] → adapter「アシタ三時に会おう」 key=e02b86ce44
     new hints=["明日"] → adapter「アシタ三時に会おう」 key=e02b86ce44  (키 동일)
  [시드+접미] 秋葉原駅で会おう
     old hints=["秋葉原"] → adapter「アキハバラ駅で会おう」 key=6ff94c0e9d
     new hints=[] → adapter「秋葉原駅で会おう」 key=80371aa4cb  (키 다름)
  [시드+가나] 神保町に行く
     old hints=["神保町"] → adapter「ジンボーチョーに行く」 key=30e77a1778
     new hints=["神保町"] → adapter「ジンボーチョーに行く」 key=30e77a1778  (키 동일)
  [시드+한자] 等々力渓谷
     old hints=["等々力"] → adapter「トドロキ渓谷」 key=f9b513de5b
     new hints=[] → adapter「等々力渓谷」 key=2799e42486  (키 다름)
  [미시드(참고)] 東京都庁と京都
     old hints=[] → adapter「東京都庁と京都」 key=b882c33eae
     new hints=[] → adapter「東京都庁と京都」 key=b882c33eae  (키 동일)
  [혼재2] 明日の天気は明日香さんに聞く
     old hints=["明日","明日"] → adapter「アシタの天気はアシタ香さんに聞く」 key=542f7963b3
     new hints=[] → adapter「明日の天気は明日香さんに聞く」 key=ca34563d69  (키 다름)
PASS A1 明日香さん: 옛=アシタ香さん(결함 재현) → 새=hint 0·원문 그대로 — old「アシタ香さん」 new「明日香さん」 hints=0
PASS A2 明日香さん: 새 키 ≠ 옛 키(옛 오디오 재사용 없음) — baf52be650f5 vs 69fc9c697cd8
PASS A3 明日は晴れです: 사전 적용 유지(アシタは晴れです), 옛=새·키 동일 — new「アシタは晴れです」
PASS A4 明日 단독: 적용 유지(アシタ) — new「アシタ」
PASS A5 明日香さんは明日来ます: 어댑터 재검색까지 뚫리지 않음(アシタ 0건) — new「明日香さんは明日来ます」 hints=0
PASS A6 明日3時に会おう: 정규화 한자 이웃에도 사전 유지(アシタ三時) — new「アシタ三時に会おう」
PASS A7 日本橋駅: 사전이 한자 이웃으로 빠짐 → hint 0(엔진 기본 읽기 몫) — new「日本橋駅」

## A'. 확장 사전(합성 항목: 愚か·青か·今日·山田·明日香)
  愚か。
     old → 「オロカ。」 hints=1
     new → 「オロカ。」 hints=1
  赤か青か
     old → 「赤かアオカ」 hints=1
     new → 「赤かアオカ」 hints=1
  青かった
     old → 「アオカった」 hints=1
     new → 「アオカった」 hints=1
  愚か者
     old → 「オロカ者」 hints=1
     new → 「オロカ者」 hints=1
  今日明日
     old → 「キョーアシタ」 hints=2
     new → 「キョーアシタ」 hints=2
  今日明日香さんが来る
     old → 「キョーアシタ香さんが来る」 hints=2
     new → 「キョー明日香さんが来る」 hints=1
  山田さん
     old → 「ヤマダさん」 hints=1
     new → 「ヤマダさん」 hints=1
  山田先生
     old → 「ヤマダ先生」 hints=1
     new → 「山田先生」 hints=0
  山田先生と山田さん
     old → 「ヤマダ先生とヤマダさん」 hints=2
     new → 「山田先生と山田さん」 hints=0
  山田は来る
     old → 「ヤマダは来る」 hints=1
     new → 「ヤマダは来る」 hints=1
PASS A8 愚か。(가나 혼합) 불변 — 「オロカ。」
PASS A9 赤か青か(가나 혼합) 불변 — 「赤かアオカ」
PASS A10 青かった(가나 혼합) 불변 — 「アオカった」
PASS A11 今日·明日 둘 다 사전에 있으면 今日明日 양쪽 적용(キョーアシタ) — 「キョーアシタ」
PASS A12 今日明日香さんが来る: 今日 유지·明日 버림(キョー明日香さん…) — 「キョー明日香さんが来る」
PASS A13 [M-2 기록] 山田さん 적용 — 「ヤマダさん」
PASS A14 [M-2 기록] 山田先生 미적용(한자 접미어) — 「山田先生」
PASS A15 [M-2 기록] 山田先生と山田さん: 두 표기 통째로 꺼짐(어댑터 재검색 일관성) — 「山田先生と山田さん」
PASS A16 새 동작에서 アシタ香 0건(전 대표문장) — 0건

## B. 무작위 퍼저(시드 + 확장 사전)
  stats {"total":297981,"hintsChanged":96156,"keySameSoundDiff":0,"hintsChangedKeySame":0,"asitaKa":0,"exceptions":0,"spuriousSubstitution":0,"hintSentences":90108} []
PASS B1 퍼저: 예외 0 — 총 297981건
PASS B2 퍼저: 키가 같은데 어댑터 입력(소리)이 다른 경우 0 — hint 변경 96156건 중
PASS B3 퍼저: hint 목록이 바뀌었는데 키가 같은 경우 0
PASS B4 퍼저: 明日香 포함 문장에서 アシタ香 0
PASS B5 퍼저: 실제 어댑터 치환 횟수 = hint 수(가드가 버린 자리가 어댑터 재검색에 뚫리지 않음) — hint 가 남은 문장 90108건 검사

== task034-qa-plan: 21/21 PASS
```

**2·6. 실 엔진 읽기 확인(M4 `/g2p`) — `tests/live/task034-qa-g2p.ts`**(앱의 사전 미리듣기 JSON 경로, 계정 3개 돌려 분당 10 한도 준수; 저장·캐시 변화 0)
```
$ node --env-file=.env --import tsx tests/live/task034-qa-g2p.ts c-admin c-dev c-super
M4 /health: {"status":"OK","warmedUp":true}

## P. 사전 미리듣기 읽기 확인 = M4 /g2p (before 쪽 = 지금 ACTIVE 사전 + 새 가드)
  明日香さん
   before: norm「明日香さん」 reading「アスカサン」 accent「ア↑スカサン」 matches=[]
  アシタ香さん
   before: norm「アシタ香さん」 reading「アシタガサン」 accent「ア↑シタ↓ガサン」 matches=[]
  明日来ます
   before: norm「明日来ます」 reading「アシタキマス」 accent「ア↑シタ↓キ↑マ↓ス」 matches=[]
  日本橋駅
   before: norm「日本橋駅」 reading「ニホンバシエキ」 accent「ニ↑ホンバシ↓エキ」 matches=[]
  ニホンバシ駅
   before: norm「ニホンバシ駅」 reading「ニホンバシエキ」 accent「ニ↑ホンバシ↓エキ」 matches=[]
  山田先生
   before: norm「山田先生」 reading「ヤマダセンセエ」 accent「ヤ↑マダ↓セ↑ンセ↓エ」 matches=[]
  山田さん
   before: norm「山田さん」 reading「ヤマダサン」 accent「ヤ↑マダサン」 matches=[]
  明日は晴れです
   before: norm「明日は晴れです」 reading「アシタワハレデス」 accent「ア↓シタワハ↑レ↓デス」 matches=["明日→アシタ(ACTIVE)"]
  明日
   before: norm「明日」 reading「アシタ」 accent「ア↓シタ」 matches=["明日→アシタ(ACTIVE)"]
  今日明日
   before: norm「今日明日」 reading「キョオアシタ」 accent「キョ↓オア↑シタ」 matches=[]
  秋葉原駅で会おう
   before: norm「秋葉原駅で会おう」 reading「アキハバラエキデアオオ」 accent「ア↑キハバラ↓エキデ↑ア↓オオ」 matches=[]
  等々力渓谷
   before: norm「等々力渓谷」 reading「トドロキケエコク」 accent「ト↑ドロキケ↓エコク」 matches=[]
  明日香さんは明日来ます
   before: norm「明日香さんは明日来ます」 reading「アスカサンワアシタキマス」 accent「ア↑スカサンワ↓ア↑シタ↓キ↑マ↓ス」 matches=[]
PASS P1 明日香さん → hint 0 · 엔진 읽기 アスカサン (アシタ 아님) — 「アスカサン」
PASS P2 (참고) 옛 치환 アシタ香さん 의 엔진 읽기는 アスカ 가 아니다 — 옛 결함의 소리 재현 — 「アシタガサン」
PASS P3 明日来ます → hint 0 · 엔진 읽기 アシタキマス — 「アシタキマス」
PASS P4 日本橋駅 → hint 0 · 엔진 읽기 ニホンバシエキ(사전 빠져도 회귀 없음) — 「ニホンバシエキ」 / 옛 치환 문장 읽기 「ニホンバシエキ」
PASS P5 山田先生 → hint 0 · 엔진 읽기 ヤマダセンセイ(g2p 표기 ヤマダセンセエ — 長音은 모음 가나로 적힌다) — 「ヤマダセンセエ」
PASS P6 明日は晴れです → 사전 적용 유지(matches 明日, 읽기 アシタワハレデス) — 「アシタワハレデス」
PASS P7 明日 단독 → 적용 유지(matches 明日 · アシタ) — 「アシタ」
PASS P8 秋葉原駅·等々力渓谷 → hint 0 · 엔진 읽기 アキハバラエキ…/トドロキケイコク(g2p 표기 長音=모음 가나) — 「アキハバラエキデアオオ」「トドロキケエコク」
PASS P9 明日香さんは明日来ます → hint 0 · 엔진 읽기 アスカサンワアシタキマス — 「アスカサンワアシタキマス」
  (참고) 今日明日(시드엔 今日 없음 → 明日 이웃 한자로 hint 0): 「キョオアシタ」 matches=0
PASS P10 今日明日 → 엔진 읽기 キョーアシタ/キョウアシタ 류(결함 없음) — 「キョオアシタ」

## D. 사전 미리듣기 compare — 초안 항목
  [明日香さん + 초안 明日=アシタ]
   before: norm「明日香さん」 reading「アスカサン」 accent「ア↑スカサン」 matches=[]
   after : norm「明日香さん」 reading「アスカサン」 accent「ア↑スカサン」 matches=[]
PASS D1 明日香さん + 초안 明日: after.matches 0(「걸리지 않았어요」 표시 조건) · 읽기 변화 없음 — after「アスカサン」
  [明日香さん + 초안 明日香=アスカ — 복합어를 직접 등록]
   before: norm「明日香さん」 reading「アスカサン」 accent「ア↑スカサン」 matches=[]
   after : norm「明日香さん」 reading「アスカサン」 accent「ア↓スカサン」 matches=["明日香→アスカ(DRAFT)"]
PASS D2 초안 明日香=アスカ: after 에 明日香(DRAFT) 걸림 · 읽기 アスカサン — after「アスカサン」
  [明日は晴れです + 초안 明日=アス — 초안이 같은 키의 저장 항목을 대신]
   before: norm「明日は晴れです」 reading「アシタワハレデス」 accent「ア↓シタワハ↑レ↓デス」 matches=["明日→アシタ(ACTIVE)"]
   after : norm「明日は晴れです」 reading「アスワハレデス」 accent「ア↓スワハ↑レ↓デス」 matches=["明日→アス(DRAFT)"]
PASS D3 초안 明日=アス: 가나 이웃 문장은 정상 적용(before アシタ → after アス) — after「アスワハレデス」
  [山田さん + 초안 山田=ヤマダ(USER)]
   before: norm「山田さん」 reading「ヤマダサン」 accent「ヤ↑マダサン」 matches=[]
   after : norm「山田さん」 reading「ヤマダサン」 accent「ヤ↑マダサン」 matches=["山田→ヤマダ(DRAFT)"]
PASS D4 [M-2 기록] 山田さん + 초안 山田: after.matches 1(적용) — after「ヤマダサン」 matches=1
  [山田先生 + 초안 山田=ヤマダ(USER)]
   before: norm「山田先生」 reading「ヤマダセンセエ」 accent「ヤ↑マダ↓セ↑ンセ↓エ」 matches=[]
   after : norm「山田先生」 reading「ヤマダセンセエ」 accent「ヤ↑マダ↓セ↑ンセ↓エ」 matches=[]
PASS D4 [M-2 기록] 山田先生 + 초안 山田: after.matches 0(걸리지 않음 표시) — after「ヤマダセンセエ」 matches=0
  [山田先生と山田さん + 초안 山田=ヤマダ(USER)]
   before: norm「山田先生と山田さん」 reading「ヤマダセンセエトヤマダサン」 accent「ヤ↑マダ↓セ↑ンセ↓エトヤ↑マダサン」 matches=[]
   after : norm「山田先生と山田さん」 reading「ヤマダセンセエトヤマダサン」 accent「ヤ↑マダ↓セ↑ンセ↓エトヤ↑マダサン」 matches=[]
PASS D4 [M-2 기록] 山田先生と山田さん + 초안 山田: after.matches 0(걸리지 않음 표시) — after「ヤマダセンセエトヤマダサン」 matches=0
PASS E1 미리듣기 응답 전체에 엔진명·model_id·speaker_id 0건 — 19개 응답 본문

== task034-qa-g2p: 17/17 PASS
```
추가 M4 읽기(시드 지명 + 한자 접미어, 임시 스크립트 — 사전이 한자 이웃으로 빠진 문장의 엔진 기본 읽기):
```
御徒町駅	matches=[]	reading=オカチマチエキ	accent=オ↑カチマチ↓エキ
神保町駅	matches=[]	reading=ジンボオチョオエキ	accent=ジ↑ンボオチョオ↓エキ
等々力駅	matches=[]	reading=トドロキエキ	accent=ト↑ドロキ↓エキ
新日本橋	matches=[]	reading=シンニホンバシ	accent=シ↑ン↓ニホンバシ
秋葉原電気街	matches=[]	reading=アキハバラデンキガイ	accent=ア↑キハバラデンキ↓ガイ
日本橋三丁目	matches=[]	reading=ニホンバシサンチョオメ	accent=ニ↑ホンバシ↓サ↑ンチョ↓オメ
御徒町で会おう	matches=["御徒町"]	reading=オカチマチデアオオ	accent=オ↑カチ↓マチデ↑ア↓オオ
神保町の古本屋	matches=["神保町"]	reading=ジンボオチョオノフルホンヤ	accent=ジ↓ン↑ボ↓オ↑チョ↓オノフ↑ルホンヤ
```
(M4 g2p 는 長音을 모음 가나로 적는다 — `センセエ`=センセイ, `キョオ`=キョウ. 시드 지명이 한자 이웃으로 사전에서 빠져도 엔진 기본 읽기가 모두 정답이라 회귀 없음.)

**4. 옛 코드(3012) vs 새 코드(3011) 실 합성·캐시 키 — `tests/live/task034-qa-synth.ts`**(#23 `Accept: application/json`, qa-bot, M4 실합성 8회, 만든 TtsCache 행·파일은 키별 삭제)
```
$ node --env-file=.env --import tsx tests/live/task034-qa-synth.ts c-user
## 1. 明日香さん — 옛 코드가 만든 캐시를 새 코드가 재사용하는지
  OLD #1 key=dc3cf9c211 cached=false v20 dur=1140ms bytes=100592 sha=9e747a64e846 matches=1 norm「明日香さん」
  NEW #1 key=28c5a3fe2f cached=false v20 dur=1060ms bytes=93536 sha=be0b4bdac045 matches=0 norm「明日香さん」
  NEW #2 key=28c5a3fe2f cached=true v20 dur=1060ms bytes=93536 sha=be0b4bdac045 matches=0 norm「明日香さん」
PASS S1 옛 코드: 明日香さん 에 hint 1건(明日) 적용 = 결함 재현, MISS 로 캐시 행 생성 — matches=1
PASS S2 새 코드: hint 0건·옛 키와 다른 키·MISS(옛 오디오 재사용 없음) — old dc3cf9c211 → new 28c5a3fe2f cached=false
PASS S3 새 코드 같은 문장 재요청: 같은 새 키 HIT(캐시 정상 동작) — cached=true
PASS S4 옛 코드가 만든 행은 그대로(옛 키 행 존재) — 새 코드 요청이 덮어쓰지 않음 — 두 키 모두 DB 행 존재
  (참고) 음원: OLD 1140ms/100592B vs NEW 1060ms/93536B — 같은 문장이 다른 소리로 합성됨
PASS S5 두 오디오는 서로 다른 소리(길이·바이트 모두 상이) — 1140/100592 vs 1060/93536

## 2. 회귀 — 사전이 정당히 적용되는 문장은 옛·새 키가 같고 오디오를 공유한다
  NEW key=a99a1e04af cached=false v20 dur=1650ms bytes=145574 sha=dae832a4f92a matches=1 norm「明日は晴れです」
  OLD key=a99a1e04af cached=true v20 dur=1650ms bytes=145574 sha=dae832a4f92a matches=1 norm「明日は晴れです」
PASS S6 明日は晴れです: 새·옛 키 동일 · hint 1건(アシタ 적용 유지) · 두 번째(OLD)는 HIT — matches new/old=1/1 oldcached=true
PASS S7 明日 단독: hint 1건 · 정상 합성(RIFF) — key=f8b42d20fd cached=false v20 dur=735ms bytes=64870 sha=b7bd93d79bb0 matches=1 norm「明日」
  NEW key=b134bef04d cached=false v20 dur=1930ms bytes=170270 sha=bb8e941f7a3a matches=1 norm「明日三時に会おう。」
  OLD key=b134bef04d cached=true v20 dur=1930ms bytes=170270 sha=bb8e941f7a3a matches=1 norm「明日三時に会おう。」
PASS S8 明日3時に会おう。: 정규화 한자 이웃에도 사전 유지 — 새·옛 키 동일(hint 1) — new「明日三時に会おう。」
PASS S9 일반 문장 합성 정상(RIFF·길이>0·hint 0) — key=ef7e7accbe cached=false v20 dur=2500ms bytes=220544 sha=ff83fdbe5028 matches=0 norm「今日は天気がいいですね。」

## 3. 혼재 문장
  OLD key=0ee29f3995 cached=false v20 dur=2370ms bytes=209078 sha=764c39840604 matches=2 norm「明日香さんは明日来ます」
  NEW key=0e3f7326d8 cached=false v20 dur=2265ms bytes=199816 sha=a7ab75aa3a10 matches=0 norm「明日香さんは明日来ます」
PASS S10 明日香さんは明日来ます: 옛 hint 2 → 새 hint 0 · 키 상이 · 새는 MISS(재합성) — old matches=2 new=0
PASS E1 #23 응답 전체에 엔진명·model_id·speaker_id 0건 — 11개 응답

정리: 이 실행이 만든 TtsCache 키 8개 삭제(행·파일) — 행 수 623 → 623
PASS C1 TtsCache 행 수 원복 — 623 → 623

== task034-qa-synth: 12/12 PASS
```
첫 실행(`synth.out`)은 **S6 FAIL** 이었다 — `明日は晴れです` 를 새 서버가 합성한 직후 옛 서버가 같은 키(`a99a1e04af`)를 조회했는데 MISS(cached=false). 원인은 **하네스 타이밍**: 캐시 저장은 응답 뒤에 이어지므로(`synthesize.ts` singleFlight 주석, 설계) 다른 프로세스 요청이 저장 도중에 오면 재합성한다(같은 키·같은 입력이라 오디오는 동일 길이 143810B). 코드 결함이 아니라 기존 설계 특성 → 스크립트가 DB 행이 보일 때까지 기다리게 고쳐 재실행 12/12(위 출력). 두 실행 모두 만든 키 8개씩 삭제, TtsCache 623 → 623.

**5. 사전 캐시 세대(REV-103 L-1) — `tests/live/task034-qa-race.ts`**(같은 프로세스 안에서 실 DB·실 관리자 서비스 `createLexiconEntry`·`disableLexiconEntry`(트랜잭션·AuditLog·`afterLexiconCommit`→`clearLexiconCache`); 사전 조회 `findFirst` 의 **첫 호출만** 실질의를 먼저 하고 도착을 3000ms 늦춰 "게시 순간 진행 중이던 옛 조회"를 만든다)
```
$ cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task034-qa-race.ts new      ← 새 코드
모드: 새 코드(미러) — 해소 기대 · 시작: ACTIVE v32 hash d5a22588b2b9 · 버전 행 32
PASS A-create [표시용(loadLexiconForDisplay)] 게시 직후 다음 조회가 새 사전(v33) — 진행 중 조회 결과 v32(옛) · 다음 조회 v33 항목 있음 (게시 v33, 기대 항목 있음) → 새 사전 · 늦은 결과는 게시 완료 1963ms 뒤 도착(경합 성립)
PASS A-disable [표시용(loadLexiconForDisplay)] 게시 직후 다음 조회가 새 사전(v34) — 진행 중 조회 결과 v33(옛) · 다음 조회 v34 항목 없음 (게시 v34, 기대 항목 없음) → 새 사전 · 늦은 결과는 게시 완료 2607ms 뒤 도착(경합 성립)
PASS B-create [합성(loadActiveLexicon)] 게시 직후 다음 조회가 새 사전(v35) — 진행 중 조회 결과 v34(옛) · 다음 조회 v35 항목 있음 (게시 v35, 기대 항목 있음) → 새 사전 · 늦은 결과는 게시 완료 2010ms 뒤 도착(경합 성립)
PASS B-disable [합성(loadActiveLexicon)] 게시 직후 다음 조회가 새 사전(v36) — 진행 중 조회 결과 v35(옛) · 다음 조회 v36 항목 없음 (게시 v36, 기대 항목 없음) → 새 사전 · 늦은 결과는 게시 완료 2031ms 뒤 도착(경합 성립)
PASS R1 항목 青か(GLOBAL) 다시 비활성 · ACTIVE 스냅샷 해시가 시작 때와 동일 — ACTIVE v32 → v36 · 해시 동일 · 버전 행 32 → 36

== task034-qa-race(new): 5/5 기대대로

$ cd ~/.node-local/thekaiwa-qa034 && node --env-file=.env --import tsx tests/live/task034-qa-race.ts old   ← 옛 코드(git HEAD)
모드: 옛 코드(복제본) — 결함 재현 기대 · 시작: ACTIVE v36 hash d5a22588b2b9 · 버전 행 36
PASS A-create [표시용(loadLexiconForDisplay)] 옛 결함 재현: 다음 조회가 옛 사전 재사용 — 진행 중 조회 결과 v36(옛) · 다음 조회 v36 항목 없음 (게시 v37, 기대 항목 있음) → 옛 사전(stale) · 늦은 결과는 게시 완료 836ms 뒤 도착(경합 성립)
PASS A-disable [표시용(loadLexiconForDisplay)] 옛 결함 재현: 다음 조회가 옛 사전 재사용 — 진행 중 조회 결과 v37(옛) · 다음 조회 v37 항목 있음 (게시 v38, 기대 항목 없음) → 옛 사전(stale) · 늦은 결과는 게시 완료 2578ms 뒤 도착(경합 성립)
PASS B-create [합성(loadActiveLexicon)] 옛 결함 재현: 다음 조회가 옛 사전 재사용 — 진행 중 조회 결과 v38(옛) · 다음 조회 v38 항목 없음 (게시 v39, 기대 항목 있음) → 옛 사전(stale) · 늦은 결과는 게시 완료 1835ms 뒤 도착(경합 성립)
PASS B-disable [합성(loadActiveLexicon)] 옛 결함 재현: 다음 조회가 옛 사전 재사용 — 진행 중 조회 결과 v39(옛) · 다음 조회 v39 항목 있음 (게시 v40, 기대 항목 없음) → 옛 사전(stale) · 늦은 결과는 게시 완료 1102ms 뒤 도착(경합 성립)
PASS R1 항목 青か(GLOBAL) 다시 비활성 · ACTIVE 스냅샷 해시가 시작 때와 동일 — ACTIVE v36 → v40 · 해시 동일 · 버전 행 36 → 40

== task034-qa-race(old): 5/5 기대대로
```
(앞선 시도 이력: ① `race-new.out` 3/5 — 하네스가 비활성 항목을 "있음"으로 센 내 오류(`enabled` 미검사, 사전 버전은 이미 새 버전 v22·v24 로 정상) → `enabled !== false` 추가 후 5/5 ② 옛 코드 첫 실행 4/5 — A-disable 한 건은 커밋이 늦은 도착보다 오래 걸려 경합이 성립하지 않은 것 → 경합 성립 증빙(`lateAt > publishEnd`)과 지연 3000ms 를 넣어 위 최종 실행에서 새 4/4·옛 4/4 모두 "경합 성립" 확인.)

**5·7·8. 관리자 API(HTTP)·같은 프로세스 반영·USER 범위·읽기 줄 차분 — `tests/live/task034-qa-http.ts`**(새 서버 3011 관리자 API 로 LOCAL 사전 변경; 읽기 줄은 옛 서버 3012 와 JSON 차분 비교)
```
$ node --env-file=.env --import tsx tests/live/task034-qa-http.ts c-admin c-user c-user2
기준: LOCAL ACTIVE v40 · 버전 행 40 · PRODUCTION 버전 1행 · TtsCache 623

## H1/H2. 게시 직후 같은 프로세스에서 새 사전 반영
PASS H1 青か 켜기(게시 v41) → 곧바로 읽기 줄 青{あお}か · 합성 dictionaryVersion = 새 버전 · 합성 hint 1건 — 읽기=あお · 합성 v41 matches=1
PASS H2 青か 끄기(게시 v42) → 곧바로 읽기 줄 青{せい}か 원복 · 합성 dictionaryVersion = 끈 버전 · hint 0건 — 읽기=せい · 합성 v42 matches=0

## H3. 복합어 직접 등록(明日香=アスカ) — 가드와 공존
PASS H3 明日香=アスカ 등록 → 明日香さん 합성 hint 1건(明日香)·キー가 사전 없을 때와 다름 — matches=1 v43
PASS H3b 明日香さんは明日来ます → hint 1건(明日香만, 복합어 안 明日 아님·뒤 한자 이웃 明日는 가드로 제외) — matches=1

## H4. USER 山田(qa-bot 전용)
PASS H4a 본인(qa-bot): 山田さん → hint 1건(적용) — matches=1
PASS H4b [M-2 기록] 본인(qa-bot): 山田先生 → hint 0건(한자 접미어로 미적용 — 엔진 기본 읽기) — matches=0
PASS H4c 타 사용자(qa-bot2): 山田さん → hint 0건(USER 범위 격리) — matches=0
  (참고) 읽기 줄(annotate) 山田さん — A: [{"surface":"山田","ruby":[["山田","やまだ"]],"pron":"ヤマダ","boundary":null},{"surface":"さん","ruby":null,"pron":"サン","boundary":null}] / B: [{"surface":"山田","ruby":[["山田","やまだ"]],"pron":"ヤマダ","boundary":null},{"surface":"さん","ruby":null,"pron":"サン","boundary":null}]

## H5. Rollback → 시작 버전 내용으로
FAIL H5 Rollback(v40) → 새 버전 vnull · ACTIVE 스냅샷 해시가 시작 버전과 동일 — ACTIVE v46 hash 동일
FAIL H5b Rollback 직후 같은 프로세스 합성 dictionaryVersion = Rollback 버전 — v46

## H6. 읽기 줄(#24r) 5분기 무영향 — OLD(가드 전) vs NEW 응답 동일
PASS H6a 시드만: 14문장 읽기 응답이 OLD 와 완전히 동일 — OLD 캐시 정렬 대기 0s · 차이 0
PASS H6b 青か·愚か·密か·上手 켠 상태: 14문장 읽기 응답이 OLD 와 완전히 동일(5분기: 같음·교체·복합어 유지·활용 같음·숨김) — OLD 캐시 정렬 대기 27s · 사전이 읽기를 바꾼 문장 4개(赤か青か,愚か。,それは密か,上手い) · NEW≠OLD 0
  明日香さん(시드 明日 + 복합어 유지): [{"surface":"明日香","ruby":[["明日香","あすか"]],"pron":"アスカ","boundary":null},{"surface":"さん","ruby":null,"pron":"サン","boundary":null}]
  上手い(활용형 숨김): [{"surface":"上手い","ruby":null,"pron":null,"boundary":null}] / 上手な人: [{"surface":"上手","ruby":[["上手","じょうず"]],"pron":"ジョーズ","boundary":null},{"surface":"な","ruby":null,"pron":"ナ","boundary":null},{"surface":"人","ruby":[["人","ひと"]],"pron":"ヒト","boundary":"phrase"}]
PASS H6c 최종 Rollback → ACTIVE 스냅샷 해시 시작 때와 동일 · 새 버전 — ACTIVE v51
PASS H6d 최종 상태 읽기 응답 = 시드만 상태 응답(원복) — 14문장 비교
PASS E1 이 점검의 모든 응답(관리자·합성·읽기)에 엔진명·model_id·speaker_id 0건 — 71개 응답
PASS V1 PRODUCTION 사전 무영향(버전 행·ACTIVE·해시 전후 동일, lexicon 감사 0) — PRODUCTION 버전 1행 · 감사 0

정리: TtsCache 만든 키 8개 삭제 → 행 623 → 623 · LOCAL 버전 행 40 → 51(+11, 불변 이력)
PASS C1 TtsCache 행 수 원복 — 623 → 623

== task034-qa-http: 14/16 PASS — FAIL: H5 Rollback(v40) → 새 버전 vnull · ACTIVE 스냅샷 해시가 시작 버전과 동일, H5b Rollback 직후 같은 프로세스 합성 dictionaryVersion = Rollback 버전
```
H5 **FAIL 2건은 하네스 기대 오류**: 그 시점 ACTIVE(v46)의 내용이 이미 시작 버전(v40)과 같아 `rollback(v40)` 이 **409 `NO_CHANGE`**(설계된 거절)로 새 버전을 만들지 않았다 — 직접 확인:
```
ACTIVE 51 → rollback(40) status 409 {"code":"CONFLICT","details":{"reason":"NO_CHANGE"}}
```
Rollback 자체는 H6c(확장 사전 → `rollback(v40)` 200, 새 버전 v51, 해시 시작과 동일)에서 통과했고, "Rollback 직후 같은 프로세스 합성이 새 버전을 쓴다"는 별도 확인으로 PASS:
```
start ACTIVE v51; 青か 켜기 → v52 (status 200); 합성 dictionaryVersion=52
Rollback(40) status 200 → 새 버전 v53; 합성 dictionaryVersion=53; ACTIVE v53 해시 시작과 동일
H5 판정: PASS
TtsCache 623 → 623
```

**6·3. 관리자 사전 화면(실 Chrome, 저장 버튼 미클릭) — `tests/live/task034-ui.mjs`**
```
$ NODE_PATH=$HOME/node_modules node --env-file=.env --import tsx tests/live/task034-ui.mjs --base http://localhost:3011 --admin c-admin
PASS  0 사전 목록 화면 열림(관리자) — Lingofy Japanese
PASS  1 문장 읽기 확인: 明日香さん → 읽기 アスカサン(악센트 ↑↓ 표시 제외, アシタ 아님) — 문장으로 읽기 확인 선생님이 이상하게 읽는 문장을 넣어 보고, 틀린 단어를 찾아 항목으로 추가해요. 예문 5/200 목소리 기본 목소리 Haruka Sakura Takumi 읽기
PASS  2a 초안 明日=アシタ + 예문 明日香さん → 「걸리지 않았어요」 안내 · "이 예문에 N번 적용" 없음 —  v53 ア↑スカサン 적용 후 · 이 입력 ア↑スカサン 지금과 같게 읽어요 ⚠ 이 예문에는 이 항목이 걸리지 않았어요. 예문에 표기 「明日」가 있
PASS  2b 초안 明日香=アスカ + 예문 明日香さん → 「이 예문에 1번 적용」 · 걸리지 않음 안내 없음 —  v53 ア↑スカサン 적용 후 · 이 입력 ア↓スカサン 읽기가 달라져요 · 이 예문에 1번 적용 변경 이유* 0/200 오독 수정 새 고유명사 악센트 조정 우선
PASS  2c 미리듣기 API 응답 모두 200(2회+) — 200,200,200
PASS  2d 이 흐름에서 저장 요청 0(사전 버전 불변 — 저장 버튼 미클릭) — 저장 클릭 없음
PASS  3 화면 본문·HTML·미리듣기 응답에 엔진명·model_id·speaker_id 0건 — 본문 1066자 · HTML 46421자 · 응답 3건
PASS  4 콘솔 오류·pageerror 0

== task034-ui: 8/8 PASS
```
(첫 실행 7/8 — 항목 1 FAIL 은 내 정규식이 화면의 악센트 표시 `ア↑スカサン` 의 ↑ 를 몰라 `アスカサン` 연속 일치에 실패한 것, 화면 출력은 정답 `ア↑スカサン`. ↑↓ 를 제거하고 비교하도록 정정 후 8/8.)

**8. 로그·Trace·AuditLog**
```
$ grep -c -E "明日|山田|青か|赤か|愚か|密か|上手|神保町|晴れ|天気|来ます" dev3011.log dev3012.log
dev3011.log (134 lines): 0      dev3012.log (54 lines): 0      (엔진명·[tts]·[reading]·warn·error 검색도 0건)
RequestTrace(QA 계정, 최근 2시간): 76행 {"PREVIEW/speechTts":32,"PLAYGROUND/lexiconPreview":44}  문장·읽기 문자열 검출: []  errorCode: [null]
AuditLog(LOCAL lexicon.*, 최근 2시간): 33 {"lexicon.create":18,"lexicon.disable":13,"lexicon.rollback":2}   ← 버전 +33 과 1:1
```
점검 스크립트 정적 검사: `eslint tests/live/task034-*.ts tests/live/task034-ui.mjs` exit 0 · 전체 `tsc --noEmit` exit 0.

### 메트릭(이 task 범위의 지표)
- 오프라인 퍼저: 297,981문장(시드 사전 + 확장 사전 2종 × 150,000, 무작위 30종 조각) — 예외 0 · 키 동일·소리 상이 0 · hint 변경 96,156건 중 키 동일 0 · `明日香` 포함 문장의 `アシタ香` 0 · **실제 어댑터 치환 횟수 = hint 수 불일치 0(hint 가 남은 90,108문장)**.
- 경합 재현: 옛 코드 4/4 stale(표시용 2·합성 2) ↔ 새 코드 4/4 신선.
- 합성 지연(참고, M4 실합성): `明日香さん` 옛 1140ms/새 1060ms, 일반 문장 2.5s, 혼재 문장 2.3s. 회화 30턴 p50/p95·단어 세트·평가 기록률은 이 task 범위 밖(미측정).

### 하네스 정정(제품 어설션을 완화한 것이 아니라 내 점검 스크립트의 기대·파싱 오류)
1. g2p 장음 표기(`センセエ`·`ケエコク`·`キョオ`·`アオオ`) 기대를 `ー/イ/ウ/オ/エ` 허용으로 정정 — P1·P3·P4·P9(`アスカサン`·`ニホンバシエキ` 등 핵심 판정)는 첫 실행부터 PASS. 2. S6 저장 도중 타이밍(위). 3. 경합 하네스 `enabled` 검사·경합 성립 증빙 추가. 4. H5 NO_CHANGE 기대. 5. UI 악센트 기호. — 모든 정정 뒤 **전 항목을 처음부터 다시 실행**해 최종 출력을 위에 실었다.

### 결함
없음.

### 관찰(결함 아님·비차단 — Leader/후속 판단)
- **O-1 (REV-106 M-2 실측 확인)**: 한자 전용 사용자 표기는 한자 이웃이 하나라도 있으면 꺼진다. `山田`=ヤマダ(USER)일 때 `山田さん` 적용·`山田先生` 미적용·`山田先生と山田さん` **둘 다 꺼짐**(어댑터 재검색 일관성 때문에 깨끗한 `山田さん` 자리까지). 관리자 미리듣기는 이 경우 「이 예문에는 이 항목이 걸리지 않았어요. 예문에 표기가 있는지, **더 긴 표기의 다른 항목이 먼저 걸리지 않았는지** 확인해 주세요」 만 보여 줘 사유(한자 이웃)와 맞지 않는다 — 관리자가 헷갈릴 수 있음. (REV-106 L-1·후속 문구 task 후보와 동일.)
- **O-2 (사양 해석 확인)**: 의뢰문 "`今日明日` 적용 유지"는 **사전에 `今日` 도 있을 때**만 성립한다. 시드(明日만)에서 `今日明日` 는 `明日` 의 앞 글자가 한자라 hint 0(엔진 기본 읽기 `キョオアシタ` 정상 — M4 확인), `今日`=キョー 를 추가하면 양쪽 적용(`キョーアシタ`). Developer 단위 테스트(M2)와 일치하는 의도된 동작이며 소리 결함은 없다.
- **O-3 (기존 설계 특성)**: 다른 프로세스가 캐시 저장(응답 뒤 이어짐) 도중에 같은 키를 요청하면 MISS→재합성한다(오디오는 같은 입력이라 동일). 이 task 와 무관·무해.
- **O-4 (범위 밖 참고)**: 사용자가 `明日香`=アスカ 항목을 등록하면(가나 치환) 엔진 기본 읽기(`ア↑スカサン`)와 악센트가 달라진다(`ア↓スカサン`) — 가나 치환 방식 A 의 기존 특성(미리듣기에 그대로 보임).

### NOT_VERIFIED
- 3폭(360/390/412)·터치 44px·safe-area: **N/A**(화면 파일 무변경). 실기기(STT·TTS 재생·APK·딥링크·마이크 거부)·APK 배너: **N/A**(네이티브·앱 무변경).
- 다른 서버 프로세스의 ≤30초 지연은 OLD 서버가 27초 뒤 정렬된 관찰로만 확인(설계값 30초를 정밀 계측하지 않음).
- 회화 30턴 p50/p95·단어 10장 세트 소요·평가 기록률: 이 task 범위 밖이라 미측정.

### 남긴 데이터·정리
- **LOCAL `PronunciationLexiconVersion` 20 → 53 행(+33, 불변 이력 — AuditLog 166 → 199 와 1:1)**. ACTIVE = v53, 스냅샷 해시 `d5a22588b2b94b99…` = 시작 버전(v20)과 동일(활성 항목 시드 6건). 항목 표 11 → 13행(`明日香` GLOBAL·`山田` USER(qa-bot) 신규 2행, 둘 다 `enabled=false`; 기존 비활성 5행 그대로). **PRODUCTION 변경 0**(버전 1행·ACTIVE v1·항목 6·lexicon 감사 0 — 전후 동일). TtsCache 623 → 623(이 점검이 만든 키 전부 삭제). QA 계정 RequestTrace(PREVIEW/PLAYGROUND, 문장 없음)는 남음(만료 정책).
- **프로세스 정리**: dev 3011·3012 종료(PID 파일 + `ss -ltnp` 로 찾은 PID 로만 종료) → `ss -ltn | grep -E ':(3011|3012|8197)'` 비어 있음, 운영 3010·8100 리슨 그대로. **복제본 정리**: `~/.node-local/thekaiwa-qa034` 삭제(`.env` 사본 shred) — `ls -d ~/.node-local/thekaiwa*` 에 내 복제본 없음(남은 `thekaiwa-dev-030` 등은 기존 것). 미러(`~/.node-local/thekaiwa`)는 NFS src 와 동일 상태.
- 추가 파일(미커밋): `tests/live/task034-lib.ts`·`task034-qa-plan.ts`·`task034-qa-g2p.ts`·`task034-qa-synth.ts`·`task034-qa-race.ts`·`task034-qa-http.ts`·`task034-ui.mjs`. `src/**`·`prisma/**`·`speech/**`·`plugins/**` 수정 0.

### 전달
- verdict=**PASS**(결함 0건). Deployer 인계 시 `post_deploy_checks`: `/api/health` 본문 `status=ok` · (화면 무변경이라 3폭 재확인은 선택) · 운영 합성 스모크 `明日香さん` 이 `アスカ` 로 읽히는지(운영 PRODUCTION 사전은 시드 6건 — 가드가 있으면 `アシタ香` 사라짐) · `migration_required=false` · `reinstall_required=false`(네이티브 무변경).

## 최종 요약 (Leader, 2026-10-05)

**한 일** — TTS 발음 사전이 `明日香`(사람 이름) 안의 `明日` 를 잡아 `アシタ香` 로 읽던 결함을 고쳤다(032 에서 화면 읽기에만 있던 "복합어 유지" 가드를 소리 쪽에도). 한자만으로 된 사전 표기가 더 긴 한자열의 일부에 걸리면 그 일치를 버리고 엔진 기본 읽기에 맡긴다. 겸해서 사전 게시 직후 진행 중이던 옛 조회가 옛 사전을 캐시에 다시 채우는 경쟁(REV-103 L-1)을 세대 번호로 막았다.

**사용자 결정** — 없음(후속 정리 작업). Leader 판단: 분석기 호출을 TTS 경로에 넣는 안(정확하지만 지연·장애 전파)이 아니라 **한자 이웃 휴리스틱**(결정적·지연 0, 틀리면 엔진 기본 읽기로 떨어지는 안전한 방향). 어댑터가 hint 표기를 위치 없이 다시 찾는 문제(`明日香さんは明日来ます`·`東京都庁と京都`)는 어댑터 대신 렌더링 플랜 단계의 반복 정규화로 막았다(어댑터에 같은 가드를 넣으면 `明日3時`→`明日三時` 같은 정규화 이웃 변화로 정상 적용이 꺼지는 회귀).

**검증** — judge: local_fix·R1·opus·standard·데모 none(demo_gate `not_required`) · Developer(Opus) 1회 구현(테스트 12건, 변이 7건) → **REV-106 PASS_WITH_NOTES**(Critical·High 0, Medium 2·Low 3·Info 2 모두 비차단, 재실행 1465/1466·변이 12/14·퍼저 30만 건 불일치 0) → judge C2 `CX-limit-unknown-hold`(Codex 한도 미기록으로 보류, 검토 실패 아님) → **QA PASS**(결함 0): 옛 코드 서버는 `明日香さん` → 어댑터 입력 `アシタ香さん`·M4 읽기 `アシタガサン`, 새 코드는 hint 0·`アスカサン`(실 M4 `/g2p`), `明日来ます`·`日本橋駅`·`山田先生` 등 정상, 옛 캐시와 키 분리(옛 행 보존·새 키 MISS 후 재합성), 오프라인 퍼저 297,981문장 키·소리 불일치 0, 게시 직후 경합 옛 4/4 stale→새 4/4 신선, 읽기 줄 14문장 옛·새 응답 동일, PRODUCTION 사전 무변경. 화면·네이티브·DB·프롬프트·어댑터 무변경(native_change false, 마이그레이션·APK 불필요).

**알려진 한계·후속(정리 backlog 에 기록)** — M-1 어댑터 재검색 규칙을 L4 가 손으로 복사해 둠(공유 픽스처 테스트 또는 위치 기반 치환) · M-2 사용자가 등록한 한자 전용 이름은 `様·先生·駅` 같은 한자 이웃이 붙으면 꺼짐(`山田先生と山田さん` → 둘 다 꺼짐; 시드 6건은 엔진 기본 읽기와 같아 영향 0) · 관리자 미리듣기 "걸리지 않았어요" 문구에 한자 이웃 사유 없음(designer 경로) · 화면(분석기)과 소리(한자 이웃)의 복합어 판정식 차이로 경계 사례에서 표시·소리가 갈릴 수 있음(수용) · 미실행: 3폭·실기기(화면 무변경이라 N/A). 남은 데이터: LOCAL 사전 버전 20→53행(불변 이력·AuditLog 1:1, 삭제 불가)·꺼진 항목 2행(`明日香` GLOBAL·`山田` USER qa-bot).

**배포 상태** — ✅ **운영 반영 완료**(2026-10-05 15:47, 사용자 승인 — AskUserQuestion "배포 진행"). push `3ed4425..fc19593`(코드 `7d68b1d`·vault `fc19593`) → webhook 배포 성공, 릴리스 `20261005-154632-fc19593e`(직전 `20261005-102357-c99e0144`), migrated:false, APK 불필요. Leader 직접 확인: 배포 소스 `lexicon.ts`·`renderingPlan.ts` 가 커밋과 `cmp` 동일 · `/api/health` status=ok·env=PRODUCTION·degraded=[]·checks 전부 true · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online·restart 0·cwd 새 릴리스 · **운영 스모크(`SMOKE_ENV=PRODUCTION`, 포트 3010) 007 PASS 45/45(SKIP 2 = DEV_PID 없음·M4 TEXT_ONLY 단위 갈음, 이전과 동일) · 006 PASS 42/42(턴 p50 4788ms)**. 운영 사전은 시드 6건뿐이라 `明日香さん` 합성은 운영에서 별도 호출하지 않았다 — 같은 코드가 QA(실 M4)에서 `アスカサン` 확인됨(릴리스 소스 = 커밋 소스).

## Deployer 기록 (2026-10-05 15:47)

**배포 결과**: ✅ PASS · Webhook 배포 성공
- **릴리스**: `20261005-154632-fc19593e` (2026-10-05 15:47 UTC+9)
- **커밋**: `fc19593e7bf6f369e93e616941d2169ea3c288c2` (vault commit fc19593)
- **코드 커밋**: `7d68b1d` (포함됨)
- **이전 릴리스**: `20261005-102357-c99e0144`
- **배포 방식**: Webhook (origin/main push 감지, 2026-10-05 06:47 UTC+0 완료)
- **마이그레이션**: false (DB 변경 없음)
- **APK**: 불필요 (네이티브 변경 0)

**Post-Deploy Checks**:
1. ✅ `/api/health` 본문
   - `status`: ok
   - `env`: PRODUCTION  
   - `degraded`: []
   - `checks`: env_database/jwt/oauth/data_root/internal_secret/db/llm/stt_gateway/stt_analysis/stt_analysis_worker/tts 전부 true

2. ✅ pm2 세 프로세스 상태 (16초 전 재부팅)
   - id 217: `thekaiwa` (cluster, 75569, online, restart 0) → 운영 relese 경로 반영
   - id 218: `thekaiwa-speech-gateway` (fork, 75973, online, restart 0)
   - id 219: `thekaiwa-speech-worker` (fork, 76197, online, restart 0)

3. ✅ 배포된 코드 확인
   - `src/modules/speech/tts/lexicon.ts` line 149: `export function guardCompoundMatches` 존재

4. ✅ 운영 도메인 응답
   - HTTPS 상태: 리다이렉트 307 정상 (로그인 페이지로)

**Note**: Webhook 배포 로그에서 3개 프로세스가 옛 경로(`20261005-102357-c99e0144`)를 잡고 있던 것을 감지, delete 후 재등록해 새 경로(`20261005-154632-fc19593e`)로 정상 전환. 오래된 릴리스 `20261004-235353-02082bd8` 자동 삭제.
