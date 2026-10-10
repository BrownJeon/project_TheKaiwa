---
task_id: task-051
title: "task-051 developer A1 기록 — JLPT 시드 데이터 파이프라인·생성"
status: doing
tags:
  - type/task-record
  - domain/vocab
aliases:
  - task-051-A1
created: 2026-10-10
---

# task-051 developer A1 기록 ([[task-051-improve-n5-vocab-pack]] 의 별도 기록 파일)

> 범위: `scripts/seed-build/**`·`prisma/seed-data/jlpt/*.json`·`prisma/seed-data/SOURCES.md`·`src/types/seedPackCounts.ts`(생성)·[[task-051-sample-review]]. 화면·`seedPack.ts`·`src/types/seedPack.ts` 는 A2·B 소관이라 건드리지 않는다.

## Developer 기록
- [16:54] 착수 — task-051 이력서(사용자 결정·설계 v2·Leader 결정·PE 기록 전부)·PE 하니스(`run.mjs`·`verify.ts`·`vocabEnrich.ts`=이력서 초안과 바이트 동일)·원본 `raw/n{5..1}.json`·`words-n5.json`(7필드, 50개, chunkType null 2)·`seedPack.ts`(`asSeedWords` 가 example/exampleKo 를 **빈 값 불가**로 검사)·`words.ts`(api #41 한도 surface ≤80·reading ≤120·meaning ≤200)·`claudeCli.buildClaudeArgs` 확인. 사실: `scripts/sync-local.sh` 의 scripts rsync 는 `--include '*.ts' --exclude '*'` 라 **하위 폴더(`scripts/seed-build/`)를 미러에 보내지 않는다** → tsc·eslint 범위에서 빠진다.
- [17:01] 체크포인트 1 — **완료**: `scripts/seed-build/{enrich.ts,build.ts,validate.ts,enrich.test.ts}` 작성(PE draft3 프롬프트 문장 그대로, `VOCAB_ENRICH_PROMPT_VERSION='vocabEnrich@1(draft3)'`), `scripts/sync-local.sh` 한 줄 수정(`-m --include '*/'` — 하위 폴더 `.ts` 를 미러에 보내 tsc·eslint 범위에 넣음, **소유 밖 파일이라 Leader 보고 대상**). 전용 미러 `~/.node-local/thekaiwa-seed051a1`(기본 미러를 `cp -al`, `.next`·`.env` 제외 → sync 가 `.env` 복사) + 미러 `node_modules/.prisma` 만 복사본으로 바꿔 `prisma generate`(DB 접속 없음, 기본 미러 무변경 — 원본 링크는 `.prisma-hardlinked-orig`). 단위 시험 6/6 통과, eslint 0. PE 실행 출력 재생: G1 198 ok+2 null(EXAMPLE_NULL) · G2 198+2 retry · G3 197+3 null · J2 36+4 null.
  - **설계에서 바꾼 점**: ① 예문이 null 인 행도 'null'(재시도 1회 후 거절) — `seedPack.ts` `asSeedWords` 가 example·exampleKo 빈 값을 받지 않는다(PE 초안은 예문 null 행을 ok 로 둠) ② 앱 `claudeCli` 어댑터 대신 자체 spawn(같은 플래그 + `--output-format json` 계측; 어댑터는 infra/config·큐를 끌고 오고 토큰을 안 냄) ③ 프롬프트 안 N1 수준 이름은 측정한 문장 유지를 위해 「원어민급」 그대로(화면 이름 「최상급」과 무관).
  - **남은 일**: 전체 실행(백그라운드 17:01 시작, 로그 `~/.node-local/thekaiwa-seedwork/build.log`, 진행 `build/progress.json`) → 단계별 검증 → `SOURCES.md`·`README.md` → 표본 파일(`build.ts sample`) → tsc·lint·validate 증빙.
  - **다음 첫 행동(끊기면)**: `cat ~/.node-local/thekaiwa-seedwork/build/progress.json`; 실행 중이 아니면 미러에서 같은 명령 `node --import tsx scripts/seed-build/build.ts run --repo <NFS 저장소>` 로 재개(체크포인트 `build/<L>/state.json`).
  - **주의점**: tsc 에서 `seedPack.ts` 가 `prisma/seed-data/jlpt/n?.json` 을 찾지 못하는 오류 5건은 A2 가 이미 동적 import 로 바꿔 놓은 것 — 데이터 파일이 생기면 사라진다. 기본 미러 Prisma client 는 오래돼(exampleSnap 등 없음) `npm run typecheck` 를 기본 미러에서 돌리면 무관한 오류 40여 건이 난다.
  - **미커밋 파일**: `scripts/seed-build/*`, `scripts/sync-local.sh`, (생성 예정) `prisma/seed-data/jlpt/*.json`·`SOURCES.md`·`src/types/seedPackCounts.ts`·`task-051-sample-review.md`.
- [17:05] 체크포인트 2 — **N5 완료 674/674**(haiku 배치 40, 호출 18, 출력 27,911tok·입력 47,126tok, 단계 벽시계 82s, API 환산 $0.21) · `validate --levels N5` **VALIDATE_PASSED**(hard 0, soft 어간만 106·면제 2·괄호 3). 거절 1건(`コピーする` — 예문 「コピーして」인데 어간 규칙이 태그 `vs` 의 する 붙은 표제어를 몰라 `EXJA_NO_HEADWORD`)은 **검사기 오판** → `stemOf` 보강(する 붙은 표제어·`vk` 来る 복합·`いい` 형용사 복합) + `build.ts recheck`(모델 재호출 없이 마지막 원 출력 재판정) 추가 → N5 거절 0. 고친 검사기로 N3 이후가 돌도록 실행 중단·재시작(17:04, N4 진행분은 배치 단위로 저장돼 이어감 — 중단 때 진행 중이던 배치 최대 3개분 호출은 버림). SOURCES.md·README.md 작성. 단위 시험 7/7.
  - 사실: 기존 `words-n5.json` 과 (표기, 읽기) 겹침 46 · 표기만 47 — `私` 는 기존 わたし / OpenJLPT わたくし 라 (표기, 읽기) 규칙이면 별개 단어로 들어간다(A2 의 건너뜀 규칙: 「같은 표기 + 읽기 같거나 기존 읽기 빈 값」이면 **わたくし 행이 추가됨**).
  - 다음 첫 행동(끊기면): `cat ~/.node-local/thekaiwa-seedwork/build/progress.json` → 실행 중 아니면 같은 run 명령으로 재개, 끝나면 `recheck`(전 단계) → `validate` → `sample`.
- [17:13] 체크포인트 3 — **N4 완료 629/630**(haiku, 호출 17, 출력 29,047tok, 단계 33s(재시작 뒤 남은 분), 거절 1 `つき`(예문이 「月」로 씀 — 표제어 표기 불일치, 정당한 거절)) · **N3 완료 1,649/1,659**(sonnet 배치 20, 호출 85, 출력 88,434tok·입력 220,665tok, 단계 442s, $1.98, 거절 10 = 예문 null 7(접두·접미사 御·旧·昨·全·不·丸·来 — 모델이 예문을 안 씀) + 뜻 null 3(`で`=outflow·`どうか`=copper coin·`よると` — OpenJLPT 표기-읽기/뜻 이상 행)). N2·N1 진행 중.
  - 주의: `calls.jsonl` 토큰 합은 17:04 중단 때 진행 중이던 호출(최대 3개, haiku N4)을 세지 못한다(기록 전에 끊김) — 총량이 그만큼 약간 적게 나온다.
- [17:22] 체크포인트 4 — **N2 완료 1,767/1,778**(sonnet, 호출 91, 출력 107,877tok·입력 238,134tok, 단계 557s, $2.30). 거절 11 = 표제어 불일치 8(OpenJLPT 표기가 **가나**인데 모델이 한자로 예문을 씀: あいかわらず→相変わらず·あわただしい→慌ただしい·おだいじに→お大事に·ひゃっかじてん→百科事典 등, 두 번 모두 — 규칙대로 거절) + 뜻 null 2(`佚`·`助教授`) + 예문 null 1(`ウーマン`). N1(154배치) 진행 중 — 끝나면 recheck → validate → sample → tsc·lint.
- [17:40] **완료 체크포인트** — 전체 실행 1회(17:01~17:37, 재시작 포함 벽시계 약 33분·N3~N1 1,963s), `recheck`(살아난 행 0), 검증·표본·tsc·lint 통과.
  - **최종 개수**(OpenJLPT 대비): N5 674/674 · N4 629/630 · N3 1,649/1,659 · N2 1,767/1,778 · N1 3,034/3,070 = **7,753/7,811(거절 58)**. `src/types/seedPackCounts.ts` = `{ N5: 674, N4: 629, N3: 1649, N2: 1767, N1: 3034 }`.
  - **모델별 실측**(`build/<L>/summary.json` 합, 17:04 중단 때 진행 중이던 호출 최대 3개 미포함): haiku(N5·N4) 호출 35·실패 0·출력 56,958tok·입력 92,304tok·API 환산 $0.43 · sonnet(N3~N1) 호출 335·실패 0·출력 379,874tok·입력 883,583tok·$8.30. 합계 출력 **약 43.7만 tok**(PE 추정 427K 와 같은 수준), 429·한도 오류 0건.
  - **거절 58 분류**: 예문 null 26(접두·접미사 御·旧·相·宛 등 — 모델이 예문을 안 씀) · 뜻 null 21(OpenJLPT 표기-읽기 이상: どうか=copper coin·一定=いちじょう·少女=おとめ·溝=こう(수사) 등) · 표제어 불일치 9(가나 표제어를 한자로 예문: あいかわらず→相変わらず, つき→月 등) · 뜻 문자 위반 2·품사 enum 1(N1). 목록 `~/.node-local/thekaiwa-seedwork/rejected-n{5..1}.json`.
  - **검증 결과**: hard 0 전 단계, 단계 간 (표기, 읽기) 중복 0, 단계 간 표기만 같은 단어 105(읽기 다름 — OpenJLPT 원본 114 중 거절분 제외), 기존 `words-n5.json` 과 (표기, 읽기) 46·표기만 47(`私` 기존 わたし vs N5 わたくし).
  - **설계에서 더 바꾼 점**: 검사기 `stemOf` 보강(する 붙은 표제어·来る 복합·いい 복합) + `recheck` 명령, `posHints` 의 vs-s/vs-i/vs-c 를 VERB 로(표본의 「품사?」 오표시 수정 — 판정에는 안 씀). `sync-local.sh` scripts rsync 에 `-m --include '*/'`.
  - **표본**: [[task-051-sample-review]] — N5·N4 40개, N3·N2·N1 30개(seed 51051) + 단계별 「품사 확인 표본」 최대 10개, ☐ 217칸.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-seed051a1`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 직후)
```
$ node --import tsx scripts/seed-build/validate.ts --repo /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa
N5: 674개 · 원본 674 · hard 0 {} · soft {"EXJA_STEM_ONLY":107,"EXJA_INCLUDE_EXEMPT":2,"MEANING_PAREN":3}
N4: 629개 · 원본 630 · hard 0 {} · soft {"EXJA_STEM_ONLY":161,"MEANING_PAREN":6}
N3: 1649개 · 원본 1659 · hard 0 {} · soft {"EXJA_STEM_ONLY":192}
N2: 1767개 · 원본 1778 · hard 0 {} · soft {"EXJA_STEM_ONLY":267,"MEANING_PAREN":3}
N1: 3034개 · 원본 3070 · hard 0 {} · soft {"EXJA_STEM_ONLY":287,"EXJA_READING_ONLY":6,"MEANING_PAREN":6}
단계 간 (표기, 읽기) 중복: 0
단계 간 표기만 같은 단어(읽기 다름 — 정상): 105
기존 words-n5.json 50개와 겹침(정상 — 삽입 때 건너뜀): (표기, 읽기) 46 · 표기만 47 · 표기는 같고 읽기가 다른 것: 私/わたし
seedPackCounts.ts 대조: 일치
결과: VALIDATE_PASSED
validate exit 0
$ node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   → tsc exit 0   (미러 Prisma client 를 현 스키마로 generate 한 뒤 — 기본 미러에서는 무관한 Prisma 타입 오류가 남)
$ node node_modules/eslint/bin/eslint.js scripts/seed-build/ src/types/seedPackCounts.ts   → eslint exit 0
$ node --import tsx --test scripts/seed-build/enrich.test.ts   → # tests 7 · # pass 7 · # fail 0
```
- 20-Log 기록은 하지 않았다(Leader 지시 「기록은 별도 파일에만」). 커밋 안 함.
