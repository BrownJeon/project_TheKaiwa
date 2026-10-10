---
task: task-051
role: developer
agent: A3
tags:
  - type/task-record
  - domain/vocab
---
# task-051 Developer A3 기록 — REV-179 반영 (데이터 공백·간체자·L 항목·M2 결정성)

본 이력서: [[task-051-improve-n5-vocab-pack]] · 감사: [[task-051-rev-record]] · 이전: [[task-051-dev-a1-record]] · [[task-051-dev-a2-record]]

## 체크포인트
- [착수] 읽음: REV-179 전체·A1/A2 기록·이력서 「Leader 결정/처리」 절, `build.ts`·`enrich.ts`·`validate.ts`·`enrich.test.ts`·README·SOURCES·`task051SeedPack.test.ts`·`words.ts findSameSurface`·`generate.ts buildItemRows`·`memo.ts wordbookMatches`. 전용 미러 `~/.node-local/thekaiwa-seed051a3`(node_modules = a1 미러 `cp -al`). 체크포인트 백업 `~/.node-local/thekaiwa-seedwork/build.bak-a3-*`.
- [측정] 현 데이터 전수 스캔(scratch `scan.mjs`): cp932 불가 1건(N5[112] お父さん 예문 `员`) · 예문 ASCII `!` 1건(N4[0] あ) · 뜻 되풀이 1건(N4[557] 見える) · 번역 `「」` 1건(N2[198] おやすみ) · 번역 끝 `。` 2건(N1[263] 演出·N1[2342] 反射) = **6행**. 기존 50개(words-n5.json)는 새 규칙에 0건. 예문 ASCII `,`/`.`·번역 `！？『』、` 은 0건.
- [코드] `enrich.ts`: cp932 집합(`TextDecoder('shift_jis')` 로 1·2바이트 전수 디코딩, 9,364자 — ～∥－ 포함) `nonCp932Chars`, 예문 `EXJA_NOT_CP932`·`EXJA_ASCII_PUNCT`(`!?,.`), 번역 `EXKO_JA_PUNCT`(`。！？「」『』、`), 뜻 `MEANING_REPEAT`, `checkRow` 원본 표기·읽기 `SOURCE_NOT_CP932`, `LEGACY_SPELLING_VARIANTS`·`mergeLegacyN5`. `validate.ts`: `NOT_CP932`(표기·읽기), 원본 없음 `RAW_MISSING` hard(`--allow-missing-raw` → `VALIDATE_INCOMPLETE` 종료 4, 그때 표제어 검사는 soft `EXJA_HEADWORD_UNCHECKED`), N5 병합 행 규칙(`LEGACY_CHANGED`·`LEGACY_ORDER`·원본 행이 병합 행 뒤면 `ORDER`), 「기존 50개 → N5 보장」 hard. `build.ts`: 체크포인트 `rawSha256`(없으면 채택+경고, 다르면 거부 — `checkpointMismatch`), N5 확정 때 병합, `recheck` 가 새 규칙에 걸린 ok 행을 `requeued{codes,before}` 와 함께 대기로, `sample` 재작성(①리뷰어 지적 ②다시 만든 행 전후 ③병합 행 ④무작위).
- [실행] `recheck`(전 단계) → 6행 대기·N3 재확정(n3.json 바이트 동일) → `run --levels N5,N4,N2,N1 --conc 3`: 호출 4번(haiku 2·sonnet 2), **6행 모두 1차 ok**, 거절 0. N5 병합 2(`私/わたし`·`日本語/にほんご`), 철자 짝 2(`ご飯→御飯`·`友だち→友達`)는 병합 안 함. 로그 `~/.node-local/thekaiwa-seedwork/build-a3.log`.
  - お父さん 새 예문 「お父さんは会社に行きます。」 — 모델이 `会社員` 자체를 쓰지 않았다(員 으로 고쳐 쓴 게 아니라 문장을 바꿈). 손 수정 없음.
- [문서] README: OpenJLPT 커밋 `bf4e1eecd5d11406aaecdee910464507aef7fcdc`(GitHub API 로 vocab 트리 `ada3a00c…` 일치, n5 sha256 일치 확인) + 원본 sha256 5개, 받는 명령을 커밋 고정으로, recheck→run 절차, 병합·알려진 한계, 새 검사 규칙. SOURCES: 영어 뜻 출처 Waller(NOTICE 23행)·JMdict 는 id·품사·읽기/표기/잘린 뜻 보정(24행), Tatoeba 「입력에 쓰지 않음 + 우연 3건」, 가공 6·7항(병합·재생성).
- [표본] `task-051-sample-review.md` 재생성(seed 51051) — 전체 7,755(N5 676·N4 629·N3 1,649·N2 1,767·N1 3,034), ①리뷰어 지적 5행 ②다시 만든 6행 전후 ③병합 2행 ④무작위.
- **다음 첫 행동(끊기면)**: 미러 `~/.node-local/thekaiwa-seed051a3` 에서 시험·tsc·eslint 실행 → 아래 실행 증빙 기록.
- **미커밋 파일**: `scripts/seed-build/{build,enrich,validate,enrich.test}.ts`·`README.md`, `prisma/seed-data/jlpt/{n5,n4,n2,n1}.json`·`SOURCES.md`, `src/types/seedPackCounts.ts`, `package.json`(test 한 줄), `src/modules/learning/{vocab/words.ts,evaluation/generate.ts,lessons/memo.ts}`, `src/modules/learning/__tests__/{task051SeedPack,task051Homograph(신규)}.test.ts`, 이 기록·표본 파일.
- [M2] `words.ts findSameSurface` 에 `orderBy [{createdAt:'asc'},{id:'asc'}]`(409 정책은 그대로) · `generate.ts buildItemRows` 는 [재료] 순서의 앞 행 고정(뒤 행이 덮지 않음, A6 는 표기만 돌려줘 읽기로 가를 수 없음) · `memo.ts wordbookMatches` 는 같은 정렬 + `db` 주입 인자(기본 prisma)·export(시험용). 시험 `__tests__/task051Homograph.test.ts` 3개(정렬 인자를 기록하는 가짜 DB).
- [시험 교체] `task051SeedPack.test.ts` 마지막 시험을 셋으로: 단계 사이 중복 0 / **병합 보장**(기존 50개가 N5 에 (표기, 읽기)로 — 허용 목록 `ご飯→御飯`·`友だち→友達` 만 상대 표기로, 끝 2행 = 기존 값 그대로) / **멱등**(옛 50개 사용자: added 628·skipped 48, 두 번째 added 0·skipped 676, 철자 짝 두 표기 공존 확인).
- [17:58 무렵] **완료 체크포인트**.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-seed051a3`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 직후, DB 접속 없음)
```
$ node --import tsx scripts/seed-build/validate.ts --repo <NFS 저장소>
N5: 676개 · 원본 674 · 기존 50개 병합 포함 · hard 0 {} · soft {"EXJA_STEM_ONLY":107,"EXJA_INCLUDE_EXEMPT":2,"MEANING_PAREN":3}
N4: 629개 · 원본 630 · hard 0 {} · soft {"EXJA_STEM_ONLY":161,"MEANING_PAREN":6}
N3: 1649개 · 원본 1659 · hard 0 {} · soft {"EXJA_STEM_ONLY":192}
N2: 1767개 · 원본 1778 · hard 0 {} · soft {"EXJA_STEM_ONLY":267,"MEANING_PAREN":2}
N1: 3034개 · 원본 3070 · hard 0 {} · soft {"EXJA_STEM_ONLY":287,"EXJA_READING_ONLY":6,"MEANING_PAREN":6}
단계 간 (표기, 읽기) 중복: 0
단계 간 표기만 같은 단어(읽기 다름 — 정상): 105
기존 words-n5.json 50개와 겹침(정상 — 삽입 때 건너뜀): (표기, 읽기) 48 · 표기만 48 · 표기는 같고 읽기가 다른 것: 없음
기존 50개 → N5 보장: 빠진 것 0 · 철자 차이 짝으로 대신한 것: 友だち→友達/ともだち ご飯→御飯/ごはん
seedPackCounts.ts 대조: 일치
결과: VALIDATE_PASSED                                     (exit 0)
$ … validate.ts --raw /nonexistent --levels N4            → 결과: VALIDATE_FAILED (hard 1) · exit 1
$ … validate.ts --raw /nonexistent --levels N4 --allow-missing-raw → 결과: VALIDATE_INCOMPLETE (원본 없음) · exit 4
$ node --import tsx --test --test-concurrency=1 scripts/seed-build/enrich.test.ts …/task051SeedPack.test.ts src/types/seedPack.test.ts …/task051Homograph.test.ts …/task008.test.ts …/task010.test.ts …/task011.test.ts
# tests 90 · # pass 90 · # fail 0 · # skipped 0
$ node --import tsx --test --test-concurrency=1 $(find src/modules/learning src/types -name '*.test.ts' | sort) scripts/seed-build/enrich.test.ts   (36+1 파일)
# tests 456 · # pass 456 · # fail 0 · # cancelled 0 · # skipped 0
$ node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json      → tsc exit=0   (첫 실행 validate.ts(110) TS2352 캐스트 1건 → `as unknown as` 로 수정 후)
$ node node_modules/eslint/bin/eslint.js scripts/seed-build/ src/types/seedPackCounts.ts src/modules/learning/{vocab/words,evaluation/generate,lessons/memo}.ts …/task051SeedPack.test.ts …/task051Homograph.test.ts   → eslint exit=0
```
- 데이터 diff: n5·n4·n2·n1 에서 바뀐 레코드 줄 정확히 6행(+ n5 끝 2행 추가), n3 바이트 동일. `seedPackCounts.ts` = `{ N5: 676, N4: 629, N3: 1649, N2: 1767, N1: 3034 }`(합 7,755).

### 설계-코드 차이 (Leader 확인 필요)
1. **철자 차이 짝 2개(`ご飯`·`友だち`)는 N5 에 병합하지 않았다** — 지시 문구(「(표기,읽기)가 없는 행을 병합」)대로면 4행을 붙이는데, 그러면 N5 에 `御飯`+`ご飯`, `友達`+`友だち` 가 함께 들어가 **신규 사용자 전원**이 같은 단어를 두 번 받는다. 지시가 적은 한계 범위(「옛 50개 사용자만 해당」)와 맞추려고 짝 목록(`LEGACY_SPELLING_VARIANTS`)으로 제외했다. 결과 N5 676(4행 병합이면 678). 옛 50개 사용자의 added 는 두 방식 모두 628. 되돌리려면 목록을 비우고 `recheck --levels N5`.
2. 예문 ASCII 검사를 `!?` 뿐 아니라 `,.` 까지(현 데이터 0건), 번역 검사를 `。「」` 뿐 아니라 `！？『』、` 까지(0건) 넣었다 — 같은 원칙(일본어 문장=전각, 한국어 번역=일본어 부호 금지). 번역의 ASCII `!` 는 한국어 부호라 허용.
3. 원본 없이 `--allow-missing-raw` 로 돌리면 표제어 검사를 soft(`EXJA_HEADWORD_UNCHECKED`)로 낮춘다 — 품사태그 없이는 활용형 예문을 판정할 수 없어서(안 낮추면 N4 에서 156건 오판). 기본(플래그 없음)은 원본 없음 자체가 실패.
4. 해시 도입 전 체크포인트 5개는 첫 로드 때 지금 원본 해시를 채택했다(경고 출력). 그 전 실행이 같은 원본이었다는 근거는 README 의 sha256 = GitHub 커밋 `bf4e1eec…` 의 n5.json sha256 일치(직접 대조) — n4~n1 은 GitHub 원본과 대조하지 않았다 [가능성 높음].
5. `memo.ts wordbookMatches` 를 export 하고 `db` 인자(기본 prisma)를 받게 했다(시험 주입용). `lessons/index.ts` 공개 API 에는 넣지 않았다.

### 미확인
- 실제 MariaDB 의 `orderBy createdAt` 동작·인덱스 비용(`@@index([userId, surface])` 아래 소량 정렬이라 영향 작을 것 [가능성 높음]) — DB 접속 금지.
- 평가 생성에서 같은 표기 재료 둘이 함께 뽑혔을 때 A6 가 어느 읽기로 문제를 냈는지는 알 수 없다 — 앞 행 고정은 결정성만 보장하고 「맞는 행」을 보장하지 않는다(근본 해결은 재료 단계에서 같은 표기를 하나만 뽑는 것, `materials.ts` — 소유 밖).
- 다시 만든 6행·병합 2행·리뷰어 지적 5행의 한국어 품질은 사용자 표본 검수 대상(원어민 검수 아님). `おやすみ` 새 뜻 「휴일, 안녕히 주무세요」는 뜻 순서가 표준과 다를 수 있다 [추측].
- `npm test` 전체(scripts 범위 추가 후)는 기본 미러 Prisma client 가 낡아 이번에 돌리지 않았다 — `find src scripts/seed-build` 로 enrich.test.ts 가 범위에 들어가는 것만 확인.

### 사용자 결정이 필요한 점
- **409 정책**(바꾸지 않음): 같은 표기·다른 읽기 단어(예: 明日/あす 가 있는데 明日/あした 를 교정 채택·직접 추가)는 지금도 409 로 막힌다. 기본 단어 팩은 두 행을 넣는데 사용자가 직접은 못 넣는 비대칭 — 허용할지 결정 필요.
- 철자 차이 짝 병합 여부(위 차이 1).
