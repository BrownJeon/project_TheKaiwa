---
task_id: task-031
title: "일본어 표시 마무리 — 経営 장음 한글·녹음 중 저장됨 안내 잔류·조각 영구 loading"
status: doing
base_ref: 26b6322
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-026-improve-hangul-reading, task-030-japanese-display-followup]
tags:
  - type/task
  - domain/ui
  - domain/speech
aliases:
  - 일본어 표시 마무리
  - task-031
created: 2026-10-05
updated: 2026-10-04
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

## 목표 (Leader)
[[task-030-japanese-display-followup]] 최종 요약의 "후속(배포 차단 아님)" 중 화면 구조를 바꾸지 않는 작은 보정 3건을 한 번에 정리한다. 화면 흐름·배치는 승인 데모(026 v4·030 v1) 그대로.

1. **経営 장음 한글**(REV-098 L-2): 단어 안 같은 모음 합침 규칙이 長音 뒤 같은 모음을 접어 `経営`(ケーエー) → `케--`. 관행 `케-에-`. 長音(ー) 바로 뒤의 같은 모음은 접지 않는다. 사용자 결정 규칙 "같은 모음 반복 → -" 는 유지.
2. **녹음 중 저장 실패 시 "저장됨" 안내 1.4초 잔류**(030 QA-#1): 스위치 직후 녹음 시작 + 저장 실패면 성공 안내가 ~1.4초 남는다 → 실패 확정 때 성공 안내를 바로 지운다(실패 알림은 기존 규칙대로 손 뗀 뒤 1번).
3. **조각 영구 loading**(REV-099 L-3): 읽기 분석 서버가 이상 응답(형식 불일치 등)을 주면 해당 조각이 loading 으로 남는다 → "모름"(읽기 줄 숨김)으로 끝낸다. 틀린 것보다 없음 원칙.
4. ~~**번역 UPDATE 순서**~~ (2026-10-05 사용자 결정으로 분리 — 범위 밖, board 정리 backlog)(REV-093 LOW): `orchestrator/index.ts` flushUserRow 에서 번역 updateMany 를 `correction.create` 앞으로 옮겨 S→X 승격 대기 창을 없앤다(toolLog update 는 교정 행 id 가 필요해 뒤 유지). 데이터 손상 위험은 원래 0 — 재시도 500 확률만 줄인다. `Correction.original` 무수정.

완료 기준: 각 항목 회귀 테스트(経営·通り·先生へ 한글, 녹음 중 실패 토스트 순서, 이상 응답 → 숨김) + 전체 회귀 통과 + 운영 스모크 채팅 42/42·회화 45/45.

## 예상 변경 경로
- `src/modules/speech/reading/client.ts`(한글 변환 규칙) + 테스트
- `src/components/common/japanese/annotations.ts`(이상 응답 → 숨김)
- `src/components/talk/TalkRoom.tsx` · `src/components/shell/DisplaySaveNotice.tsx` · `src/components/common/japanese/displayPrefs.ts`(성공 안내 지우기)
- 관련 `__tests__`

## 관련 과거 이력 요약
- [[task-026-improve-hangul-reading]]: 읽기 출처 pyopenjtalk(gateway `kaiwa_gateway/text.py`), 한글 줄은 앱 `speech/reading/client.ts` 변환, "틀린 발음보다 없음" 원칙, REV-092 쓰기 순서 약속(REV-093 LOW 는 그 약속 아래 비차단).
- [[task-030-japanese-display-followup]]: 장음 뒤 조사 へ 한글 분리, 저장 실패 알림 역할 분리(회화방 = 녹음 중 미룸 → 손 뗀 뒤 1번, 셸 = 그 밖). Codex 녹음 중 즉시 표시 권고는 불채택(승인 규칙 유지).
- 승인된 교훈: 없음(`/이슈기록 관련 ui` 조회 2026-10-05).

## Judge 판정
- [2026-10-04 23:37] intake engine=jev → task_type=local_fix · risk=R1 · developer_model=opus · track=light · demo=none · next=assign | overrides=TR-light,DM-light-waive | fallback=- | tokens=1423

## Leader 기록 (접수 판정 검토, 2026-10-05)
- judge 판정 수용: light · developer opus · demo none(DM-light-waive).
- **R2 보강 해당 검토**: 4번(번역 UPDATE 를 `correction.create` 앞으로 이동)은 교정 저장 트랜잭션 순서를 바꾼다 — leader.md `<judge_codex>` R2 보강(`Correction.original`·트랜잭션) 대상에 걸린다. light 트랙(QA 면제)과 맞지 않아 **사용자 확인 대기**: 4번을 빼고 1~3번만 light 로 진행할지, 4번 포함 standard(R2) 로 올릴지.

## Developer 기록
- [23:49] **완료 — 1~3번(light, ④ 범위 밖 무수정).** commit·push·배포 안 함. 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED`(not_required, judge none). 서버·DB·API·네이티브 변경 0(웹 배포만, APK 재빌드 없음). 화면 구조·배치·문구 변경 0.
- **변경 파일(소스 4 + 테스트 2)**: `src/modules/speech/reading/client.ts` · `src/components/common/japanese/annotations.ts` · `src/components/common/japanese/displayPrefs.ts` · `src/components/talk/TalkRoom.tsx` · 테스트 `src/modules/speech/__tests__/reading.test.ts` · `src/components/common/__tests__/japaneseDisplay.test.ts`. (`DisplaySaveNotice.tsx` 는 바꿀 필요 없음 — 셸 경로 불변.)
- **1 経営 장음**: `kanaToHangul` 에 `afterLong`(바로 앞 모라가 '-' 로 적은 ー) 표시 — 그 다음 모라 하나만 같은-모음 합침에서 빠진다. 経営 ケーエー → `케-에-`, 先生絵(조사 아님) センセーエ → `센세-에`(기존 단언 `센세--` 2곳을 새 규칙으로 갱신 — 같은 결함의 다른 모양). 유지: とおり/トオリ·ええ·いい·ケエ → 합침, 通り トーリ → `토-리`, 先生へ `센세-에`·家へ `이에에`·通りを `토-리오`, ーー 연속은 `--`, 구절 경계(' '·'|')에서 표시 초기화.
- **2 녹음 중 저장 실패 → 성공 안내 즉시 지움(030 QA-#1)**: 원인 = §15-10 C "맡았으면 `onToast('',0)` 안 부름"이 녹음 중(실패 문구 미룸)에는 덮어 줄 문구가 없어 성공 안내가 만료까지 남음. 방식 — `SaveFailureClaims.claim(fn, takeLeftover, deferring?)` + `isDeferring()` 추가, `clearFreshSuccessToast` 는 "맡았고 **미루지 않을 때만**" 건너뛴다(녹음 중이면 2.2초 안의 성공 안내를 지움). `claimWhile`·`useClaimDisplaySaveFailure` 에 `deferring` 인자 전달(ref 최신값). `TalkRoom` 은 `() => recordingRef.current` 를 넘기고, `notify` 가 **빈 문구(지우기)는 녹음 중에도 미루지 않는다** — 미뤄 둔 안내가 있으면 그것이 가장 최근 안내라 버리고, 없으면 떠 있는 안내를 `showToast('', 0)` 로 지움(소리 없음 → §9-0 ⑨ 무관). 실패 알림 규칙(방이 맡음·녹음 중 미룸 → 손 뗀 뒤 1번·셸은 그 밖) 불변, 녹음 중이 아닐 때 순서도 예전 그대로(지우지 않고 실패 문구가 덮음).
- **3 이상 응답 → 모름(REV-099 L-3)**: 원인 = `segments:[null]` 같은 칸에서 `s.surface` 가 throw → drain 이 끊겨 `status` 가 inflight 로 남아 영구 loading(뒤 조각까지). 방식 — `isReadingSegment`(#24r 계약 모양: surface string · pron string|null · boundary phrase|particle|null · ruby null|[string, string|null][]) 로 칸 검사, 하나라도 어긋나면 그 칸 null 캐시(none·재요청 없음 — available:true null 칸과 같은 취급). 칸 처리는 try/catch/finally 로 감싸 어떤 throw 도 `status.delete` 를 건너뛰지 않음(catch = 실패 기록 → none). 정상·available:false·HTTP/429 재시도(35초·2회) 경로 불변.
- **결정·주의**: (a) 기존 정적 정규식 테스트 3개(claimWhile 호출 모양·claim 인자·layout effect)는 인자 추가로 갱신. (b) 2번 경계 사례 — 녹음 중 스위치(성공 안내도 미뤄짐) 뒤 실패면 미뤄 둔 성공 안내만 버리고 떠 있는 다른 안내는 그대로(테스트 ②). 2.2초 지난 뒤 실패면 아무것도 지우지 않음(테스트 ④). (c) 스모크는 미러 `scratch/` 에만 둠(저장소 파일 아님).
- **실행 증빙**(미러 `~/.node-local/thekaiwa-dev-030` — NFS src/prisma/tests/scripts(.ts)/설정 rsync, 운영 미러·릴리스 무접촉):
  - `node node_modules/typescript/bin/tsc --noEmit` → exit 0
  - `node node_modules/eslint/bin/eslint.js .` → exit 0, `0 errors, 5 warnings`(전부 기존 파일 `set-state-in-effect`: DiagnosticsScreen·LearningSettings·OnDeviceDiagnosticsCard·SpeechSettings·VoiceSettings — 변경 파일 0)
  - 관련 단위 `node --import tsx --test --test-concurrency=1 src/modules/speech/__tests__/reading.test.ts src/components/common/__tests__/japaneseDisplay.test.ts` → tests 79 · pass 79 · fail 0
  - 전체 단위 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → tests 1401 · pass 1398 · fail 0 · skipped 3 · exit 0
  - 스모크(실 gateway 127.0.0.1:8100 → 서버 `annotateReadings` → `hangulLine`) `node --env-file=<NFS>/.env --import tsx scratch/task031-smoke.ts` → available true · **6/6 PASS**: 経営 ケーエー→케-에- · 通り トーリ→토-리 · 先生へ センセーエ→센세-에 · 家へ イエエ→이에에 · ええ エー→에- · いい イイ→이-
  - 변이 확인(미러만, 원복 후 `diff -rq` 일치): M1 `!longBefore` 제거 → fail 2 · M2 `clearFreshSuccessToast` 를 예전 `isClaimed()` 만으로 → fail 2 · M3 TalkRoom 이 deferring 미전달 → fail 1 · M4 annotations HEAD 판 → fail 2. 새 테스트가 세 수정을 모두 잠근다.
- 남은 일: 없음(Reviewer 인계). 다음 첫 행동(재작업 시): 이 기록의 변경 파일 6개만 보면 된다. 미커밋 파일: 위 6개.

## Reviewer 기록
- **REV-102 — PASS_WITH_NOTES (light 트랙, 2026-10-05)** · Critical 0 · High 0 · Medium 0 · Low 2 · native_change false. 코드 수정 없음(Read 전용).
- **light 범위 확인**: 변경 파일 6(소스 4 + 테스트 2, ≤12) · 신규 화면·마이그레이션·네이티브·인증/권한/Secret 변경 0 · 서버·DB·API 불변 → **standard 승격 불필요**. 데모 게이트 `check.mjs check` = `not_required`(judge none, DM-light-waive) — 승격·차단 없음. 화면 구조·배치·문구 변경 0(승인 데모 대조 대상 아님).
- **재실행 증빙**(미러 `~/.node-local/thekaiwa-dev-030` 에 NFS src·tests·prisma rsync --delete 후, `diff -rq` 일치): `tsc --noEmit` exit 0 · `eslint .` exit 0 (0 errors, 5 warnings — 전부 기존 파일 set-state-in-effect, 변경 파일 0) · 관련 단위(reading + japaneseDisplay) tests 79 · pass 79 · fail 0 · 전체 단위 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` tests 1401 · pass 1398 · fail 0 · skipped 3 · exit 0. developer 증빙(79/79·1398/0/3·tsc 0·eslint 0)과 동일.
- **1 한글 변환 — 이상 없음**: `afterLong` 은 장음 ー(앞 모라가 있어 '-' 를 실제로 적은 경우)에서만 켜지고 **다음 모라 1개**에만 적용된다(`longBefore` 를 매 모라 시작에 읽고 즉시 false 로 초기화 — 공백·구절·조사·ん·っ·문장부호도 모두 리셋). ケーエー→케-에-, トーリ→토-리, トオリ→토-리(합침 유지), エエ→에-, イイ→이-, 先生+へ(ヱ 표식)→센세-에, 家+へ→이에에, ケーーエ→케--에, 'ケー エ'→'케- 에'. 기존 기대값 2건(センセーエ·先生絵 `센세--`→`센세-에`) 변경은 정당: 옛 값은 絵(え)의 음절 하나가 통째로 사라진 결함(経営 `케--` 와 같은 뿌리), 사용자 규칙 "같은 모음 반복→-"는 ー 로 적지 않은 반복(ええ·いい·とおり)에 그대로 유지돼 위반 아님. Leader 사양(長音 바로 뒤는 접지 않음)과 일치.
- **2 저장 실패 안내 — 이상 없음(노트 1건)**: `deferring` 은 `clearFreshSuccessToast` 의 건너뜀 조건(`isClaimed && !isDeferring`)에만 영향. 실패 알림 담당(`route`·claim fn)·"맡은 방 1회/셸 그 밖"·`takeLeftover` 규칙 불변, 녹음 중이 아니면 순서도 예전 그대로(실패 문구가 같은 토스트 칸을 덮음). 다른 claim 사용처는 TalkRoom 1곳뿐이고 셸 경로는 deferring 미지정(false). `notify('')`(녹음 중) = 미룬 안내가 있으면 폐기(방 이탈 후 손 뗀 뒤 flush 되는 거짓 "적용돼요" 제거), 없으면 `showToast('',0)`. **§9-0 ⑨ 위반 아님**: `<Toast>` 는 `role=status aria-live=polite` 이며 빈 문구는 읽을 텍스트가 없고(opacity-0) 소리 없음 — 새 문구를 띄우는 것이 아니라 지우는 동작. 실패 알림 자체는 여전히 녹음 중 미루고 손 뗀 뒤 1번(`saveFailDeferredRef`). 2.2초 창 = `DISPLAY_TOAST_MS`(성공 토스트 표시 시간) 와 동일 상수로 "아직 떠 있을 때만 지움" — 근거 타당. 녹음 중 스위치로 미뤄진 성공 안내가 2.2초 뒤 실패로 남는 경우도 손 뗀 뒤 flush 순서(성공→실패 같은 커밋, 같은 칸)로 실패 문구가 즉시 덮어 사용자에게 거짓 안내가 보이지 않음.
  - **LOW-1(비차단)**: `notify('')` 가 "미뤄 둔 안내 1건"을 무조건 버린다 — 2.2초 안에 스위치 성공 안내 뒤 **다른** 녹음 중 안내(예: 재생 불가)가 `deferredToastRef` 를 덮어썼다면 그 안내도 함께 사라진다(단일 슬롯 구조). 영향 = 사용자 정보성 안내 1건 유실, 데이터·안전 영향 0, 발생 조건(저장 실패+녹음+2.2초 안 다른 안내) 극히 드묾. 권고: 후속에서 성공 안내만 식별해 버리거나 현 동작 유지(문서화).
- **3 이상 응답 → 모름 — 이상 없음(노트 1건)**: `isReadingSegment` 는 서버 `parseSegment`(annotateHttp.ts) 의 부분집합 모양 검사(surface string · pron string|null · boundary phrase|particle|null · ruby null|[string, string|null][])로, 서버가 내보내는 정상 모양을 거부하지 않는다(서버는 4필드를 항상 null 포함 직렬화, route 는 `{segments}`/null 그대로 통과). 어긋난 칸은 재시도 없이 null 캐시(none) — "틀린 것보다 없음" 원칙에 부합하고(재시도해도 같은 이상 응답이 올 확률이 높고 부하만 늘림), `item===null`(available:true) 취급과 동일. 정상 경로·`available:false`·HTTP/429·객체 아님/segments 누락(= 재시도 35초·2회)은 분기 불변. try/catch/finally 로 칸 단위 `status.delete` 보장 → 뒤 조각 loading 고착 해소(변이 M4 로 새 테스트가 잠금).
  - **LOW-2(비차단)**: 클라이언트 모양 검사가 서버보다 느슨하다(surface 빈 문자열·ruby 빈 배열 허용). 서버가 이미 거르므로 실해 없음, 방어 심도 차원 메모. 조치 불요.
- **7영역 점검**: 이번 변경은 웹 프론트(순수 UI 로직·텍스트 변환) 한정 — 인증·소유자·capability·Secret·DB·라우트·6층 import(`speech/reading/client` 는 기존 위치, 신규 import 0)·LLM 계약·학습 데이터(Correction·StatsSnapshot)·엔진명 노출 접점 변경 0, "발견 없음". 정본 필드명·하드코딩(엔진명·키) 추가 0. 360/390/412 레이아웃 변경 0.
- **판정**: Critical 0·High 0 → **PASS_WITH_NOTES**(LOW 2 비차단). QA 단계 없음(light) — 배포 가능. 회귀 위험 구간(배포 후 스모크 권고): 채팅 42/42·회화 45/45 운영 스모크(완료 기준) · 회화방에서 표시 토글 직후 녹음 시작 + 저장 실패 시나리오는 실기기 확인 대상이나 단위 테스트(순서 ①~④)로 잠겨 있음. 반려 0회(Sonnet 승격 권고 해당 없음).

## 최종 요약


## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-04 23:39 |
