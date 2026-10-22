---
task_id: task-083
title: "오늘의 단어 카드 뒷면 — 예문 한글 발음도 항상 보이게(세로 간격·한글 줄 높이 축소) (IMP-0061)"
status: doing
waiting: "push_confirm"
base_ref: 95c895d
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-082-improve-word-card-hangul-inline, task-071-improve-hangul-stored-reading, task-033-vocab-card-face]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 단어 카드 예문 한글
  - task-083
created: 2026-10-22
updated: 2026-10-22
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

# task-083 — 단어 카드 뒷면 예문 한글 항상 보이기 (IMP-0061)

## 사용자 요청 (원문, 2026-10-22)
- 「예문 한글도 항상 보이게 해주고 미커밋에 대한 문서도 커밋 및 푸시 진행해줘」 — task-082 최종 보고의 결정 질문(«예문 한글도 항상 보이게 할지») 에 대한 답 + 남은 미커밋 문서 커밋·푸시(후자는 아래 «상태 로그»).

백로그: [[IMP-0061-word-card-example-hangul-always]]

## judge 접수 (2026-10-22)
- `local_fix`·복잡도 0.87·R1·developer **sonnet**·**light 트랙**(데모·QA 면제 — `DM-light-waive`). 입력 `scratchpad/judge-083-intake.json`.

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-082-improve-word-card-hangul-inline]] — 표제어 한글을 인라인으로(r1~r4). 예문 한글은 «번역 우선·자리 있을 때만» 으로 남겼고, 그 결정을 사용자에게 물었다(→ 이번 요청).
- 카드 면 규칙 C2-A(`docs/screens.md` §15-11-3 B6): 한글 줄은 자리가 없을 때만 뺀다(번역 우선), `DropLevel 0|1|2`. **이 규칙·판정 로직은 이번에 바꾸지 않는다**(마지막 수단으로 그대로 둔다).
- 교훈(task-082): 실브라우저 재측정이 시험·리뷰가 못 본 후퇴를 잡았다 → 이번에도 Leader 가 높이 스윕으로 확인.

## 사실 (2026-10-22 — 코드 값 계산 [확실], 높이 스윕은 구현 뒤 실측)
- 사용자 카드(`来ました`·뜻 1줄·예문 1줄·번역 1줄, 카드 ≈226px)는 예문 한글 줄을 넣으면 ≈232px 필요 → **≈6px 부족**. 구성(px): 패딩 16×2=32 · 표제어 행 44(루비 `leading 2`) · 띠 `mt-2`8 + 27.5 · 본문 `mt-2` 8 · 뜻 28.5 · 예문 `mt-2` 8 + 34.4(`leading 2.15`) · 예문 한글 `mt-0.5`2 + 19.5(`leading-[1.5]`) · 번역 21.
- 위쪽 안내 2줄(주제 B 줄·챌린지 C 줄)은 건드리지 않는다 — AI 안전 고지를 자르지 않는 결정(REV-125 L-4)·챌린지 진행 정보.
- 기준선(r4 = 현재 운영): 같은 QA 카드에서 카드 313~224px 한글 2줄, 187px 1줄 — 구현 뒤 같은 스윕으로 한글 2줄 유지 하한이 내려갔는지 본다.

## Leader 결정 (사용자가 바꾸라면 바꾼다 — 최종 보고에 그대로 적는다)
- **번역 우선은 유지하고 세로 간격을 줄여 예문 한글을 같은 카드에 넣는다**(번역·예문을 자르거나 안내 줄을 건드리지 않음): ① 띠 위 간격 `mt-2` → `mt-1.5` ② 본문 위 간격 `mt-2` → `mt-1.5` ③ 예문 위 간격 `mt-2` → `mt-1` ④ 예문 한글 줄의 위 간격 0 + 줄간격 `leading-[1.5]` → `leading-[1.3]`. 합계 ≈ 13px 절약(6px 부족 → 약 7px 여유).
- 판정 로직(`DropLevel`·`nextDropLevel`·측정 효과)·표제어 한글·앞면은 **그대로**. 마지막 수단(예문 한글 뺌)은 남는다 — 글꼴 130%·2줄 예문처럼 그래도 넘치는 최악만.
- 사용자에게 «항상» 은 «사용자 카드(100%·1줄 예문) 와 일반 조건에서 항상» 이고, 큰 글자·긴 예문에서는 빠질 수 있다고 보고한다.

## 구현 지시 (developer, sonnet — 신규 소환)
1. `src/components/vocab/VocabCardFace.tsx` 뒷면(`side === 'back'` 분기, 183~215행 근처)에서 위 ①~④ 를 적용한다. ④ 는 예문 `<HangulLine state={exampleAnn} size={13} className="line-clamp-1!" />` 에 위 간격 0·줄간격 축소 클래스를 더한다(`HangulLine` 은 읽기만 — 필요하면 `className` 으로, `JapaneseText.tsx` 는 바꾸지 않는다. 블록 기본은 `mt-0.5 block … leading-[1.5]` 이고 중요도 `!` 접미 클래스를 쓰는 선례 `line-clamp-1!` 가 있다).
2. 판정 로직·`DropLevel`·측정 효과·표제어 행·앞면은 건드리지 않는다.
3. 시험(`cardFace.test.ts`): 기존 단언이 이 간격 클래스에 의존하면 맞춘다. 새 단언은 «뒷면 예문 `HangulLine` 이 여전히 `dropLevel >= 1` 로만 가려짐» 과 «간격 클래스 계약(4곳)» 정도만 — 클래스 문자열 정규식은 취약하므로 최소로. 변이 시험 ≥ 2(임시 파일 + mv 후 원복·`cmp`).
4. 검증: 미러 `bash scripts/make-mirror.sh dev083` 새로 만들고 거기서만 — `src/components/vocab`·`src/components/common` 시험, `tsc --noEmit`, eslint 변경 파일. `npm test`·브라우저·dev 서버·DB·LLM·커밋·푸시·배포 금지. 프로세스는 PID 로만 종료.
5. 기록 `task-083-dev-record.md`(변경·시험 수·변이·한계). 최종 답 6줄 이내 — 실제 실행한 결과만(결과가 비면 안 된다).

## 완료 기준
- 위 ①~④ 가 반영되고 판정 로직·앞면·표제어 행이 변하지 않는다.
- 관련 시험·tsc·eslint 0 오류, 변이 시험이 잡는다.
- Leader 실브라우저: 같은 QA 카드의 높이 스윕에서 **한글 2줄(표제어+예문) 유지 하한이 기준선보다 ≥ 10px 내려감**, 사용자 카드와 같은 내용(합성)이 226px 에서 한글 2줄 + 번역 안 잘림, 가로 넘침 0, 번역 줄 잘림 없음.

## 상태 로그
- 2026-10-22 사용자 요청 → judge(light) → IMP-0061·이력서 → developer(sonnet) 소환.
- 2026-10-22 **같은 요청의 두 번째 부분 «미커밋에 대한 문서도 커밋 및 푸시»**: 작업 트리에 남아 있던 타 세션 미커밋을 확인 — `.claude/agents/{leader,deployer}.md`(보고 양식·«포함 작업» 열)·`.codex/agents/*.toml`(그 미러)·`.codex/hooks/agent-vault/*`(훅 중복 방지 ISS-0007, `hook-dedupe.sh` 신규)는 정상적인 문서·도구 변경이라 커밋. **두 묶음으로 분리**: ① `.claude/agents` 문서 커밋 `1276940` → 문서 전용 경로라 **푸시 완료**(`47de696..1276940`, 배포 건너뜀 — 60초 관찰 새 릴리스 0·헬스 ok) ② `.codex/**` 커밋 `95c895d` → **로컬 보류** — `.codex/**` 는 웹훅 «문서 전용 건너뜀» 목록(agent-vault·docs·.claude·CLAUDE.md·AGENTS.md·README.md)에 없어 푸시하면 코드가 같아도 운영 재배포(서비스 재시작)가 일어남. 다음 배포(task-083 승인 시)와 함께 푸시.

- 2026-10-22 **developer(sonnet) 완료**: 뒷면 띠 위·본문 위 `mt-1.5`, 예문 위 `mt-1`, 예문 한글 `line-clamp-1! mt-0! leading-[1.3]!`(Tailwind 4.3.3 컴파일로 `!important` 가 기본값을 이김 확인). `cardFace` 15/15·vocab+common 494/494·tsc 0·eslint 0·변이 7/7(원복 `cmp`). 판정 로직·표제어 행·앞면 불변 — diff 2파일 +20/-5 Leader 가 직접 확인.
- 2026-10-22 **Leader 실브라우저 확인(통과)**: 새 빌드·같은 QA 세션·카드 1 뒷면. **진짜 카드 높이(offsetHeight) 기준** — 새 간격에서 한글 2줄에 필요한 높이 **225.3px**, 같은 페이지에서 옛 간격을 DOM 으로 되돌려 잰 값 237.9px(= 233.3 + 한글 줄 4.6) → **하한 12.6px 하락**(간격 8 + 한글 줄 4.6, 개발자 계산과 일치). 높이 스윕: 카드 228px 이상 한글 2줄, 224px 이하 1줄, **내용 잘림 0·가로 넘침 0**(기준선은 2줄이 카드 240px 이상에서만). **사용자 카드(스크린샷에서 잰 ≈226px, 내용은 한글 없이 ≈209px)**: 한글을 모두 넣으면 옛 간격 ≈252px → 새 간격 ≈218px 필요 → 226px 에 **여유 ≈8px 로 들어간다**(스크린샷 추정 ±3px). 스크린샷(뷰포트 728·카드 경계 높이): `両親 [료-싱]` 인라인·예문 `[료-신니 아이마스.]` 글자 아래 잘림 없음·번역 안 잘림·간격은 촘촘하나 읽힘.
- 2026-10-22 **재검토(`rev-083`) PASS_WITH_NOTES (Critical 0·High 0·Medium 0·Low 3)**: 변경 hunk 4개뿐·`!` 문법·소비처 영향 0·금기 0. Low: 시험이 클래스 문자열 계약이라 렌더 높이를 못 봄(Leader 실측이 대신함)·정규식이 한 줄 포맷에 묶임·`docs/screens.md` 8292행 `mt-2` 서술이 낡음(Leader 가 갱신함, B6 대체 문단에 task-083 추가).
- 2026-10-22 **최종 전체 시험**(미러 `t081int` = NFS, `diff -rq` 동일): **4,851건 중 통과 4,848·실패 0·건너뜀 3**, tsc 0, eslint 0, 빌드 종료 0. 정리: QA 세트·시도·출석 행 삭제(기준선 대비 새 행 0·사라진 기존 행 0), 서버·`.env`·쿠키 삭제.
- 2026-10-22 **정정 이력**: task-082 에서 내가 보고한 «카드 313/298/261/224/187px» 는 카드가 아닌 다른 요소의 높이였다(진짜 카드 892 → 340px). 줄 수·결론은 유효, 이후 표기는 offsetHeight. 기록: task-082 이력서·IMP-0060 정정 줄.
- 2026-10-22 **커밋·푸시 대기**: 코드(`VocabCardFace.tsx`·`cardFace.test.ts`·`docs/screens.md`)·vault 기록은 로컬 커밋 예정, **푸시 = 운영 배포 — 사용자 승인 대기**. 푸시에는 보류 중이던 `.codex/**` 커밋 `95c895d` 도 함께 나간다(어차피 이 배포로 재시작되므로 따로 재배포하지 않음).

## 운영 배포
(배포 전)

## 최종 요약 (사용자용 — 작성 전)

(완료 시 Leader 가 작성 — 양식 정본 docs/user-report-format.md §3)

## 데모 검토 (demo gate)

light 트랙 — 데모 게이트 면제(`DM-light-waive`).
