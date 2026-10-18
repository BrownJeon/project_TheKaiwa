---
task_id: task-076
role: developer
scope: "REV-076U 발견 M-1 — 만들기 화면 핵심 동작의 행동 시험 보강(시험 + 무동작 export/순수 함수 1개)"
tags:
  - type/task-record
  - domain/challenge
created: 2026-10-18
updated: 2026-10-18
---

# task-076 developer 기록 — M-1 행동 시험 보강

> 이력서: [[task-076-improve-challenge-level-generation]] · 감사: [[task-076-reviewer-ui-record]](발견 M-1 · E 직접 변이 18개) · 화면 A 기록: [[task-076-dev-ui-create-record]]
> 데모 게이트: `DEMO_GATE_PASSED` / `status: approved` (approved v2, hash verified) — 화면 파일 수정 전 확인. **제품 동작·화면 모양·문구 변경 0.**

## 한 줄 요약
감사에서 시험을 통과(생존)한 변이 6개(M4·M5·M6·M8·M9·M16)를 모두 죽이는 새 시험 파일 `level076View.test.ts`(12개)를 추가했다. 정적 렌더(`GoalStep`·`ConfirmStep`·`TopicLevelsBody`)와 요소 트리 호출(`LevelPills` onChange·`GoalStep` 연결)로 **동작**을 보고, 화면 본체(하이드레이션 뒤에만 본문) 안의 연결 두 곳과 `page.tsx` 는 소스로 고정했다. **미커밋.**

## 제품 코드 변경 (무동작 — 이것뿐)
| 파일 | 변경 |
|---|---|
| `src/components/challenge/ChallengeCreateScreen.tsx` | `GoalStep`·`ConfirmStep` 앞에 `export` 만 추가(시험이 정적 렌더). 두 함수는 `useId` 외 라우터 훅을 쓰지 않는다 |
| `src/components/challenge/logic.ts` | 순수 함수 1개 `profileLevelProps(p) → { myLevel: p.level, goalLevel: p.goalLevel }` 추가 |
| `src/app/(app)/plan/challenge/new/page.tsx` | `myLevel={profile.level} goalLevel={profile.goalLevel}` → `{...profileLevelProps(profile)}` + import 한 줄. 넘기는 값은 같다 |

그 밖(서버·DB·`docs/**`·`src/components/{lesson,vocab}/**`·네이티브)은 건드리지 않았다. 새 의존성·환경변수·마이그레이션 0.

## 추가한 시험 (`src/components/challenge/__tests__/level076View.test.ts`, 12개)
기대값은 전부 손으로 적은 글/표(구현 식을 되풀이하지 않음). 이름·코드는 `levelLabel` 과 비교하고, 한 곳(`④ 다섯 단계 전부`)은 `SEED_PACK_LABEL.N3 === '중급 (N3)'` 리터럴도 단언.

| # | 시험 | 방식 | 죽이는 변이 |
|---|---|---|---|
| 1 | ③ 고른 난이도(N2, 주제 N4)가 «체크된 radio» 하나뿐, 낭독 글 5칸이 «초보자 (N5), 내 수준 / 초급 (N4), 이 주제 기본 / 중급 (N3), 내 목표 / …» | `GoalStep` 정적 렌더 | M5 |
| 2 | ③ 비교 줄 «내 수준 초보자 (N5) · 내 목표 중급 (N3) · 이 주제 초급 (N4)» + 수준·목표를 서로 바꿔 준 경우·목표 없음(묶음만 빠짐) + `aria-describedby` | 정적 렌더 | 프로필 값 전달(X1·X4) |
| 3 | ③ 안내 줄이 «내 목표»가 아니라 «내 수준» 기준(3단계 위/쉬워요/같음·1단계 위 비움/수준 모름 비움) | 정적 렌더 | M3·M7 계열 |
| 4 | 손대지 않은 값은 주제를 따라가고(5주제) 고른 값은 주제가 바뀌어도 남는다 | 정적 렌더 | M5·M2 계열 |
| 5 | 알약 5칸의 onChange 가 칸마다 «자기 값»을 넘긴다(`['N5','N4','N3','N2','N1']`), 현재 값 N3 을 되풀이하면 실패 | `LevelPills` 직접 호출 → `<input>` onChange 호출 | **M6** |
| 6 | `GoalStep` 이 알약에 고른 값·프로필 값·콜백을 넘기고 클릭하면 부모에게 `{ level }` 이 간다, 비교 줄 묶음 3개 | 훅이 있어 Probe 렌더 안에서 호출해 트리를 잡음 | X2·X4 |
| 7 | ④ «난이도» dd = «중급 (N3)» + «이 주제 기본은 초급 (N4)»(한 덩어리 2개) / 같음·손대지 않음 = «초급 (N4)이 주제 기본» | `ConfirmStep` 정적 렌더 | **M4** |
| 8 | ④ 5×5 전 조합(고른 값 × 주제 난이도) 문장 | 정적 렌더 | M4·X3 |
| 9 | 프로필 → props: 내 수준 = `level`, 내 목표 = `goalLevel`(서로 다른 값), 목표 없음 = null | `profileLevelProps` | **M8**(함수 쪽) |
| 10 | ① 설명 «…보여 드려요: 초보자 (N5) · … · 최상급 (N1). 챌린지 동안 …» 5단계·1단계·빈 목록 «—» | `TopicLevelsBody` 정적 렌더 | 설명 문장(M16 의 받는 쪽) |
| 11 | 연결(소스): 본체가 `levelCtx={{ my: myLevel, goal: goalLevel, topic: topic.level }}` 를 1회, `<TopicLevelsBody levels={(topics.data?.level ?? []).filter(isJlptLevel)} />` 1회 쓴다 + 두 단계 함수 export | 소스 스캔(주석 제거) | **M9**·**M16** |
| 12 | 연결(소스): `page.tsx` 는 `{...profileLevelProps(profile)}` 1회 + import, `myLevel=`/`goalLevel=` 직접 쓰기 0 | 소스 스캔 | **M8**(page 쪽) |

## 변이 재적용 — 생존 6개가 모두 포착됨
임시 복사본 `~/.node-local/thekaiwa-dev076-vmut`(소스 실제 복사 link 1 + node_modules 심볼릭). 변이마다 **임시 파일에 쓰고 `os.replace`**, 끝나면 원본으로 되돌려 같은 파일임을 단언. 대상 시험 = challenge·vocab·lesson `__tests__` **42파일**(새 파일 포함, 518개 통과가 기준선). 스크립트 = 세션 스크래치 `mut2.py`(감사의 `mut.py` 를 복사해 경로·패턴만 바꿈, `mut.py` 는 불변).

| 감사 # | 변이 | 이번 결과 | 잡은 시험 | 새 시험 파일 없이(41파일) |
|---|---|---|---|---|
| M4 | ④ `level` 변수 = `topic.level` | **포착** | 7·8 | 생존 |
| M5 | 알약 `sel` = `topic.level` | **포착** | 1·3·4·6 | 생존 |
| M6 | 알약 onChange 가 `value` 를 보냄 | **포착** | 5 | 생존 |
| M8 | `page.tsx` 수준↔목표 바꿔 전달 (추출 뒤 모양: `profileLevelProps({ level: profile.goalLevel, goalLevel: profile.level })`) | **포착** | 12 | (구조가 바뀌어 비교 대상 아님) |
| M8b | `profileLevelProps` 안에서 수준↔목표 바꿈 | **포착** | 9 | 생존 |
| M8c | `page.tsx` 가 attribute 로 직접 바꿔 넘김 | **포착** | 12 | — |
| M9 | `levelCtx` 내 수준↔목표 뒤바뀜 | **포착** | 11 | 생존 |
| M16 | ① 설명 `levels={[]}` | **포착** | 11 | 생존 |

추가 변이(새 시험이 약해지지 않았는지): X1 알약 `ctx` 에서 내 수준 빠짐 → 포착(1·6) · X2 알약 클릭이 `sel` 을 보냄 → 포착(새 6 + 기존 배선 시험) · X3 확인 작은 글 기준이 고른 값 → 포착(새 7·8 + 기존 배선 시험 — 새 파일 없이도 포착됨) · X4 비교 줄에서 내 목표 빠짐 → 포착(2·6). (시험 번호 = 위 표의 파일 내 순번, 새 파일만 단독으로 돌려 확인)
**기존에 포착되던 12개(감사 M1·M2·M3·M7·M10·M11·M12·M13·M14·M15·M17·M18)도 전부 그대로 포착**(요구는 3개 이상). 새 시험 없이는 M4·M5·M6·M8b·M9·M16·X1 이 모두 생존 → 이 파일이 죽인 것이 맞다.
복원: 변이마다 `os.replace` 뒤 원본 일치 단언, 끝난 뒤 `diff -rq` 저장소 `src` = 변이 복사본 `src` = 개발 미러 `src` 차이 0.

## 증빙 (미러 `~/.node-local/thekaiwa-dev076-ui`, 저장소 `src` 와 `rsync -a --delete` 후 `diff -rq` 0, 가짜 `DATABASE_URL`)
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | rc 0 |
| `./node_modules/.bin/eslint <변경 4파일>`(새 시험·`ChallengeCreateScreen.tsx`·`logic.ts`·`page.tsx`) | 에러 0 · 경고 0 · rc 0 |
| `node --import tsx --test --test-concurrency=1 src/components/challenge/__tests__/*.test.ts src/components/vocab/__tests__/task076Today.test.ts` | tests 75 · pass 75 · fail 0 |
| 새 파일 단독 | tests 12 · pass 12 |
| 제품 코드를 바꿨으므로 전체: `find src scripts/seed-build -name '*.test.ts'` 352파일 | tests **4396** · pass **4391** · fail **0** · skipped 5(= 감사 때의 4384 + 새 12, 건너뜀 5 는 감사와 같은 4파일의 환경 의존 시험) · rc 0 |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | **0** (✓ Compiled, `ƒ /plan/challenge/new` 생성, 경고 = 기존 `persona/loader` 파일 추적) |

## 한계 (정직하게)
1. **본체 `ChallengeCreateScreen` 은 정적 렌더가 안 된다**(`useSyncExternalStore` 서버 스냅샷 = 하이드레이션 전, 주제 목록은 효과에서 읽음). 그래서 본체 안의 연결 두 곳(`levelCtx` 만드는 곳·① `levels`)과 `page.tsx` 의 `profileLevelProps` 호출은 **행동이 아니라 소스 스캔**(정확한 식 1회)으로 고정했다 — 식을 같은 뜻의 다른 모양으로 고치면 스캔 시험도 같이 고쳐야 한다. 진짜 클릭·하이드레이션·주제 전환은 여전히 **QA 실화면**(감사 high_risk_areas 1~3)이 본다.
2. 정적 렌더/트리 호출은 **브라우저 이벤트·포커스·←/→ 키·TalkBack** 를 보지 않는다. 클릭은 `<input>` 의 `onChange` 를 직접 호출한 시뮬레이션이다.
3. 변이 점검은 내가 고른 변이 목록 기준이다(감사의 18개 + 추출 뒤 변형 3 + 추가 4). 모든 변이를 포착한다는 뜻이 아니다.
4. 임시 복사본 `~/.node-local/thekaiwa-dev076-vmut` 은 지우지 않고 남겼다(파괴 명령 게이트 회피) — 필요하면 Leader 가 삭제해도 된다. 저장소·개발 미러와 `diff -rq` 0.
5. 감사가 적은 «`GoalStep`/`ConfirmStep` 을 `createParts` 로 이동» 대신 `export` 만 추가했다(이동은 파일 구조 변경이라 이번 범위 밖).

## 체크포인트
- 완료: 위 시험·export·순수 함수 1개·변이 재점검·전체 시험·build. 남은 일: Reviewer 가 시험 파일 한정으로 재감사(M-1 닫힘 확인), 이후 QA 가 high_risk_areas 1~3 실화면 확인. 다음 첫 행동: Reviewer 인계.
- 미커밋 파일(이번 작업분): `src/components/challenge/__tests__/level076View.test.ts`(신규) · `src/components/challenge/ChallengeCreateScreen.tsx`(export 2) · `src/components/challenge/logic.ts`(함수 1) · `src/app/(app)/plan/challenge/new/page.tsx`(호출 1) · 이 기록. (같은 파일의 앞선 화면 A 변경도 아직 미커밋 상태다.)
- 주의점: 커밋 때 화면 A 변경과 hunk 가 섞인다 — 화면 A/B·서버·이 보강을 한 묶음으로 할지 Leader 가 정한다.
