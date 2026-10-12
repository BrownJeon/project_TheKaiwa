---
task_id: task-061
title: "회화방 음성 입력 바 — 도우미 버튼을 우측 끝으로 이동(■ 와 자리 맞바꿈, 안내 말풍선 재정렬) (IMP-0034, light 트랙)"
status: done
base_ref: b89d779
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-056-improve-talk-phrase-helper]
imp: [IMP-0034]
tags:
  - type/task
  - domain/improvement
  - domain/conversation
aliases:
  - 도우미 버튼 우측 끝
  - task-061
created: 2026-10-12
updated: 2026-10-12
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

# task-061 — 도우미 버튼 우측 끝 (IMP-0034)

## 사용자 요청 (원문)
- 2026-10-12 「A. 확인완료했으며 도우미 버튼을 우측 끝으로 배치를 이동시켜줘」 + 「작성안 요구안대로 진행해주고 결과알려줘」.

## 관련 과거 이력 요약 (Leader 큐레이션)
- task-056 [[task-056-improve-talk-phrase-helper]]: 도우미 버튼은 `VoiceBar` 의 `trailing` 슬롯으로 가운데 칸 안 마이크 오른쪽(`ml-3`, 마이크와 12px)에 있다. 입력 바 행은 `grid-cols-[44px_minmax(0,1fr)_44px]` = [⌨ | 가운데 | **우측 44px = 선생님 말 정지 ■**]. ■ 는 SPEAKING 중에만 보이고 빈 칸일 때도 자리를 둔다(마이크가 가운데에 고정되게).
- 처음 한 번 안내 말풍선(`PhraseHelperTip`)의 위치 식은 VoiceBar 치수에 의존한다(designer 기록: 360/390/412 에서 꼬리가 도우미 가운데에 오는 산술 — VoiceBar 가 바뀌면 같이 바꿔야 함). 승인된 데모·§22 의 간격 사양: 마이크↔도우미 12px, 도우미↔■ 28/43/54px.
- 승인된 교훈: 없음.

## judge 접수 (Leader 실행)
`local_fix` · 1.06 · R1 · developer=**sonnet** · **light 트랙**(Leader → Developer → Reviewer, QA·데모 면제) · demo=none(`DM-light-waive`). 입력·결과: 스크래치 `judge-061-intake*.json`. light 한계 초과(파일 12개 초과·신규 화면·마이그레이션·네이티브·인증) 시 standard 로 승격.

## 설계 (Leader)
1. 도우미 버튼을 입력 바 행의 **우측 끝 44px 열**로 옮긴다(오른쪽 패딩 `px-4` 안쪽 끝, 44×44 유지).
2. 우측 끝을 쓰던 **■(선생님 말 정지)는 도우미의 옛 자리(마이크 오른쪽, 마이크와 12px, 44×44)로** 옮긴다 — 둘의 자리를 맞바꿈. ■ 가 없을 때(마이크만)는 가운데 칸이 지금처럼 비어 있고 마이크는 가운데 72px 그대로. 도우미 버튼의 열림/흐림/aria-disabled/토스트/잠금 규칙은 그대로.
3. 안내 말풍선은 우측 끝 버튼 위에 뜨고 **오른쪽 화면 가장자리에서 잘리지 않게** 오른쪽 정렬한다(꼬리는 도우미 가운데). 360/390/412 에서 실측.
4. 글자 모드의 도우미 버튼 위치(`TalkRoom.tsx` 의 `{helperButton}` 두 번째 사용처)는 이미 우측 끝이면 그대로 두고, 아니면 보고만 한다(이번 요청은 음성 입력 바).
5. 기능·문구·서버·접근성 이름 변경 없음. `docs/screens.md` §22 의 자리·간격 서술을 새 배치로 고친다(이 한 줄은 Leader 가 쓴다).

## 하지 않는 것
도우미 기능·자동 취소·잠금·판 동작 변경, 글자 모드 배치 변경(위 4), 서버·스키마, 다른 화면의 ■ 위치.

## 완료 기준
1. 360/390/412 × (일반 방·역할극 방)에서 도우미가 우측 끝(바깥 패딩 안쪽), 마이크 72px 가운데 고정, ■ 는 마이크 오른쪽 12px 에서 44px, 서로 겹침 0·가로 넘침 0, 터치 44px 이상(헤드리스 크롬 실측 수치 기록).
2. 안내 말풍선이 어느 폭에서도 화면 밖으로 안 나가고 꼬리가 도우미 가운데.
3. 도우미 열기/닫기/잠금/자동 취소/⑤A 시험이 그대로 통과, `VoiceBar` `trailing` 빈 슬롯 DOM 불변 시험 유지·갱신, eslint·tsc 0, 소스 검사 시험은 공용 `readCode` 사용.
4. reviewer 가 증빙을 재실행(light 트랙 완료 조건).

## 상태 로그
- 2026-10-12 접수(base_ref `b89d779`). 다음: developer(sonnet) → reviewer.
- 2026-10-12 구현 완료 — [[task-061-dev-record]]: `VoiceBar` 도우미(`trailing`)를 우측 끝 44px 열로, ■ 를 마이크 오른쪽 12px 로 맞바꿈, `PhraseHelperTip` 말풍선 `right-4`. 변경 파일 4개(코드 3 + 시험 1), `TalkRoom.tsx` 0줄.
- 2026-10-12 감사 **REV-198 PASS_WITH_NOTES**(Critical·High·Medium 0) — [[task-061-rev-record]]: 시험 1,283/1,283·eslint/tsc/build 0, `trailing` 없는 DOM HEAD 와 바이트 동일, 변이 6건 중 5건 검출(살아남은 ■ `onClick` 배선은 기존 시험 공백). 브라우저 실측(SPEAKING): 도우미 오른쪽 끝 = 화면 − 16, 마이크↔■ 12px, ■↔도우미 28/43/54px(360/390/412), 44×44/72×72, 말풍선 3폭 모두 화면 안·꼬리가 도우미 가운데.
- 2026-10-12 Leader 조치: REV-198 F-1(문서 옛 서술 4곳 — §2 행 81·체크리스트 4230·말풍선 실측 9888·Tab 순서 9890)을 새 배치·실측값으로 정정. F-2(■ 클릭 시험 공백)는 기존 공백이라 수용. light 트랙이라 QA 없음.
- **사용자 몫(실기기)**: ① 제스처 내비(가장자리 16dp)에서 우측 끝 도우미 탭이 뒤로 가기와 겹치지 않는지 ② SPEAKING 중 ■↔마이크 12px 엄지 오터치. **글자 모드 도우미는 입력창 왼쪽(🎤 오른쪽) 그대로** — 우측 끝은 보내기(↑)라 오송신·입력창 축소 때문에 reviewer 권고로 유지(말 모드와 위치가 다름을 사용자에게 알림).

- 2026-10-12 **운영 배포 완료**(사용자 「푸시 및 배포해주고 임시 미러는 정리해줘」): push `5586177..3c0427b` → webhook 릴리스 `20261012-130400-3c0427b8`(`RELEASE_RESULT ok`·`migrated:false`), 롤백 대상 `20261012-091540-55861770`. 헬스 `status ok`(checks 전부 true)·pm2 3개 online(재시작 0, cwd 새 릴리스)·번들에 옛 말풍선 위치 클래스 0개. **남은 일 = 사용자 실기기 확인**(제스처 내비 16dp 탭 겹침·■↔마이크 12px 오터치).

## 최종 요약 (Leader, 2026-10-12)

**결과: 운영 배포 완료 + **사용자 검증 완료**(2026-10-12, 「이 세션의 회화개선작업은 검증되었으니 작업 마무리하고 팀 해제해줘」 — 세부 확인 항목은 말씀 없음, 이상 없다는 별도 언급도 없음).** 커밋 `3c5d281`, 릴리스 `20261012-130400-3c0427b8`(push `5586177..3c0427b`, 사용자 「푸시 및 배포해주고 임시 미러는 정리해줘」), 롤백 대상 `20261012-091540-55861770`.

**무엇이 바뀌었나 (사용자 관점)**: 음성 입력 바에서 **도우미 버튼이 우측 끝**으로 가고, 선생님 말 정지 ■ 가 마이크 오른쪽 12px 로 옮겨 자리를 맞바꿨다(IMP-0034). 안내 말풍선은 우측 끝 버튼 위에 맞춰 세 폭 모두 화면 안에 들어온다. 기능·문구·서버 변경 없음. **글자 입력 모드의 도우미는 입력창 왼쪽(🎤 오른쪽) 그대로** — 우측 끝은 보내기(↑)라 오송신·입력창 축소 위험(reviewer 권고), 말 모드와 위치가 다름을 사용자에게 알렸다.

**검증**: light 트랙(데모·QA 면제), 감사 REV-198 PASS_WITH_NOTES(Critical·High·Medium 0). 브라우저 실측(SPEAKING): 도우미 오른쪽 끝 = 화면 − 16px, 마이크↔■ 12px, ■↔도우미 28/43/54px(360/390/412), 도우미·■ 44×44·마이크 72×72. 배포 뒤 헬스 `status ok`·pm2 3개 online·번들에 옛 말풍선 위치 클래스 0개. 실기기(제스처 내비 16dp 탭·■↔마이크 12px 오터치)는 사용자 검증으로 갈음.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-12 11:54 |
