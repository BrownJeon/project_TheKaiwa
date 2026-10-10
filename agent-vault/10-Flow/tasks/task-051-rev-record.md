---
task: task-051
role: reviewer
tags:
  - type/task-record
  - domain/vocab
---
# task-051 Reviewer 기록 — REV-179 (A1 파이프라인·데이터 + A2 서버 모듈)

본 이력서: [[task-051-improve-n5-vocab-pack]] · 기록: [[task-051-dev-a1-record]] · [[task-051-dev-a2-record]]

## Reviewer 기록 (REV-179)
- [중간 1] 스냅샷 `~/.node-local/thekaiwa-rev179-src`(git archive def8fd4, node_modules 하드링크 + `.prisma`·`@prisma/client` 실복사 후 `prisma generate`) 준비. 재현: 지정 시험 3파일 21개 중 20 통과·1 실패(`私` わたし↔わたくし, 개발자 고지와 동일) · `validate.ts` `VALIDATE_PASSED`(개수·중복 수치 개발자 기록과 일치). seedPack.ts·types·tx.ts 정독 완료.
- [중간 2] **지연 로딩 확인(질문 2)**: 스냅샷에서 `next build`(DATABASE_URL 무효값, 포트 미사용) exit 0. 단계별 JSON 이 각각 별도 서버 청크(`prisma_seed-data_jlpt_n{5..1}_json_*.js` 126KB·127KB·361KB·418KB·709KB)로 갈라졌고, #46b 라우트 `route.js` 가 시작 때 읽는 것은 768바이트 로더 청크 하나뿐(`s.l()` 로 호출 때 단계 청크 로드) — 데이터 청크를 `R.c` 로 미리 읽는 라우트/페이지 0개. 클라이언트 `.next/static` 에는 JSON 없음. → 지연 로딩 OK. (nft.json 은 파일 추적 목록일 뿐 — admin 페이지 다수가 `@/modules/learning` 배럴 때문에 데이터 청크를 추적 목록에 가진다. 실행에는 영향 없음, standalone 출력 안 씀.)
- [중간 2] **표기 조회 경로(질문 3)**: `words.ts:121 findSameSurface`(표기 일치 → 읽기 무시, orderBy 없는 findMany 의 첫 항목) ← createWord(채택 경로)·POST /words·`findWordIdBySurface`(enrich 전 중복 확인)·updateWord 표기 변경. `evaluation/generate.ts:75 bySurface=new Map(…)`(뒤 행이 앞 행을 덮음). `lessons/memo.ts:65-70 wordbookMatches`(앞 행 선택, orderBy 없음, take 500). 아래 최종 기록에 정리.
- [중간 3] **파이프라인 코드 정독(질문 4)**: `build.ts` — Claude CLI 호출은 `spawn('claude', argv배열)`(셸 문자열 조립 없음), 프롬프트는 stdin, env 는 허용 목록(HOME·PATH·USER·LANG·LC_ALL·TMPDIR·SHELL + `MAX_THINKING_TOKENS=0`), `--tools ''`·`--strict-mcp-config`·`--setting-sources ''`·`--permission-mode dontAsk`. 입력은 `raw/n?.json`(OpenJLPT 공개 사전)뿐, 사용자 데이터 경로 없음. 로그(`calls.jsonl`·콘솔)에는 프롬프트·키 없음(오류 문구 160자만). 체크포인트 `state.json` 은 임시 파일+rename 원자 저장, 배치마다 저장, `loadState` 가 total·promptVersion·model 이 다르면 중단. 결함 후보: 체크포인트가 **위치(index)** 기준이라 raw 파일 내용(순서)이 바뀌고 길이만 같으면 조용히 어긋남(Low).
- [중간 4] **데이터 독립 표본·분류(질문 7)**: 고정 seed 179 로 단계별 15개(총 75) 읽음 + 일관성 집계. 거절 58건 분류는 개발자 기록과 일치(예문 null 26·뜻 null 21·표제어 불일치 9·뜻 문자 2 = 58; 단계별 36/11/10/1/0). 발견: ① N5 `知る` 「私は彼を知ります。」(知っています 가 자연스러움) ② N4 `すく` 「お水が少なくなったから、すきました。」(すく=배가 고프다·비다 용법에 맞지 않음) ③ N4 `すっと` 번역 「곧게 일어섰어요」 어색 ④ N4 `見える` 뜻 「보이다, 보이다」 되풀이 ⑤ N4 `あ` 예문 ASCII `!` ⑥ N1 `演出`·`反射` 번역 끝이 전각 `。` ⑦ N2 `注す` 예문 「酒を注して」 부자연 ⑧ N1 `手掛ける` 번역 「손수 다루었다」 어색 ⑨ `フィルム`「フィルムです。」 같은 정보 없는 예문(7자 이하 N5 156·N4 36). 75개 중 확정 오류 2·어색 3 수준 — **원어민 검수 아님.**
- [중간 5] 질문 5·6·8 확인 완료(아래 최종에 통합). 스냅샷에서 소유 밖 파일 없음(검토용 `rev179-check.test.ts` 는 스냅샷 안에만 둠, 저장소 무변경).

## 최종 판정 (REV-179) — **PASS-with-fixes** (Critical 0 · High 0 · Medium 4 · Low 8)
재현 근거: 스냅샷 `~/.node-local/thekaiwa-rev179-src`(def8fd4). 지정 시험 3파일 21개 중 20 통과·1 실패(`私`), `validate.ts` VALIDATE_PASSED(7,753개·단계 간 (표기,읽기) 중복 0·표기만 같은 105), eslint 변경 파일 exit 0, `next build` exit 0(TypeScript 단계 통과). 법률 판단 없음, 한국어 뜻·예문은 원어민 검수가 아니다.

### 질문별 결론
1. **seedPack.ts**: ① `withTransaction`+`lockUserRow` 한 트랜잭션, 예외를 삼키지 않아 전부 롤백(가짜 tx 로 확인, 실제 DB 롤백은 QA) ② 판정은 JS `===`, 시험 `ネコ`≠`ねこ` 확인 — DB 가 IN 으로 더 넓게 돌려줘도 안전(상위집합) ③ 청크 산술 정확: 빈 단어장 기준 N5 [500,174]·N4 [500,129]·N3 [500×3,149]·N2 [500×3,267]·N1 [500×6,34], 조회·삽입 합계 = 단어 수 = 고유 표기 수, 두 번째 누름 added 0 ④ `withTransaction(fn,{timeoutMs})` 시그니처 실재(`tx.ts:29`), 기본 15s→30s. 위험: 사용자 행 잠금이 최대 30s 유지(같은 사용자의 채팅 턴이 기다림)·초과 시 Prisma P2028 이 그대로 500 — 실측 전 값 ⑤ 팩 안 중복은 `taken` 집합으로 1회(시험 있음) ⑥ `parseSeedPackBody`: 객체 아님·여분 키·열거 밖 값 400, 사용자 id 는 세션에서만(`route.ts`), 소유자 문제 없음.
2. **지연 로딩 OK**: 단계별 서버 청크 126KB·127KB·361KB·418KB·709KB 로 분리, #46b `route.js` 가 시작 때 읽는 건 768B 로더 청크뿐(데이터 청크를 `R.c` 로 선적재하는 라우트 0개), `.next/static` 에 JSON 없음. JSON 모듈은 `a.exports=JSON.parse(...)` CJS 라 `import().default`=배열이 되는지는 실행 증거가 없다(`[가능성 높음]`) → QA 첫 호출로 확인.
3. **표기만 보고 단어를 찾는 경로**(같은 표기 다른 읽기 행이 105개 표기 + `私`×3 으로 생김): `words.ts:121 findSameSurface`(읽기 무시·orderBy 없는 findMany 첫 항목) ← `createWord`(교정/제안 채택 `corrections/[id]/accept`·`proposals/[id]/accept`)·`POST /words`·`findWordIdBySurface`(enrich 전 확인)·`updateWord` 표기 변경 → 다른 읽기를 추가/채택하면 409 + 임의 형제의 `existingId`; `evaluation/generate.ts:75 new Map(materials.map(w=>[w.surface,w.id]))` 뒤 행이 덮어 문제 `wordId` 가 형제 행으로 붙음; `lessons/memo.ts:65-70` 앞 행 임의 선택(`take:500`, orderBy 없음). 세션·반복 학습은 `wordId`/`refId` 기준이라 영향 없음.
4. **파이프라인**: argv 배열 spawn·stdin 프롬프트·env 허용 목록·`--tools ''`·입력은 공개 사전뿐·로그에 프롬프트/키 없음·체크포인트 원자 저장·원본 개수/프롬프트/모델 불일치 시 거부. `validate.ts` 재현 PASSED. 사각은 아래 Low.
5. **sync-local.sh**: 구/신 규칙 dry-run 비교 — 새로 복사되는 파일은 `seed-build/{build,enrich,enrich.test,validate}.ts` 4개뿐, 사라지는 것 0, `scripts/` 하위 폴더는 `seed-build` 하나. 다른 미러 동기화 부작용 없음(대신 이 4파일이 모든 미러의 tsc·eslint 범위에 들어옴).
6. **SOURCES.md**: OpenJLPT `NOTICE.md` 5행·12행 인용 문구 일치, 「비공식 목록」·SA 파생·변경 표시·JLPT FAQ 링크 있음. 누락/불일치는 아래 Low(영어 뜻 출처 귀속·Tatoeba 문장 3건·앱 내 출처 줄 미구현).
7. **표본**: 단계별 15개(seed 179) 75개 중 확정 오류 2·어색 3 (아래). 거절 58 분류 개발자 기록과 일치.
8. **私 시험 실패 의견**: 허용 목록으로 풀 일이 아니다. 시험 문구(「다시 누르면 추가된다」)가 사실이 아니다 — 시뮬레이션: 옛 50개 사용자가 N5 를 누르면 added 628·skipped 46(私/わたくし 추가), **두 번째는 added 0**(멱등). 즉 불변식은 데이터가 아니라 `planSeedInsert` 가 보장하므로 단언을 「N5 두 번 눌러 둘째가 0」 로 바꾸는 게 맞다. 진짜 문제는 데이터 공백이다 — 옛 50개 중 `私/わたし`·`日本語`·`ご飯`·`友だち` 4개가 새 N5 에 없고(새 N5 는 `御飯`·`友達` 표기), 신규 사용자의 「초보자」 팩에는 日本語·私/わたし 가 없으며 옛 50개 사용자는 ご飯/御飯·友だち/友達 가 철자만 다른 중복 행이 된다. 처리는 Leader 결정(옛 50개를 N5 보충 목록으로 합치기 vs 중복 감수 고지).

### 지적 (심각도 · 근거 · 권고 · 확신)
- **M1 배포 결합** — `components/vocab/TodayWordsCard.tsx:131`·`WordAddSheet.tsx:315`·`hooks.ts:117`(`{pack:'N5'}` 고정)·`labels.ts:44,143` 이 아직 「기본 단어 50개」 문구인데 이 커밋만 나가면 같은 버튼이 674개를 넣고, SOURCES.md 가 약속한 앱 내 출처 줄(`DataCreditRow`)은 없다. 권고: 화면(B)·출처 줄 완료 전 push·배포 금지(Leader 게이트). `[확실]`
- **M2 표기 전용 조회 모호** — 질문 3. 권고: (a) `generate.ts:75` 는 (표기, 읽기) 키 또는 중복 표기 제외 후 매칭 (b) `memo.ts` 는 읽기까지 비교 또는 첫 행 고정 정렬 (c) `findSameSurface` 에 `orderBy:{createdAt:'asc'}` 로 `existingId` 를 결정적으로, 읽기가 다른 경우의 409 허용 여부는 정책 결정. 수정은 별도 task. `[확실]`(코드 읽음) / 영향 크기 `[가능성 높음]`
- **M3 N5 공백·시험 단언** — 질문 8. `[확실]`
- **M4 데이터 품질** — 75개 표본: N5 `知る` 「私は彼を知ります。」(知っています 가 일반적) · N4 `すく` 「お水が少なくなったから、すきました。」(用法 어긋남, 1~2자 가나 어간 검사가 공허하게 통과한 47개 중 하나) · N4 `すっと` 번역 「곧게」 · N2 `注す` 「酒を注して」 · N1 `手掛ける` 번역 「손수 다루었다」. 권고: 사용자 표본 검수(단계당 30~40, 이미 필수 게이트)에 위 행을 포함, 검수에서 나온 오류율로 전체 재생성/수동 패치 여부 결정. `[가능성 높음]`(내 읽기)
- L1 `enrich.test.ts`(enum 이 `words.ts` 와 같은지 원문 대조)가 `npm test` 의 `find src -name '*.test.ts'` 범위 밖 — 표준 시험에서 안 돈다. `[확실]`
- L2 `validate.ts` — 원본(raw) 디렉터리가 없으면 `NOT_IN_SOURCE`·`ORDER` 검사를 건너뛰고도 VALIDATE_PASSED(「원본 못 읽음」만 출력). 권고: raw 없으면 실패 또는 경고 코드. `[확실]`
- L3 `build.ts loadState` 체크포인트가 위치 기준 — raw 순서가 바뀌고 길이만 같으면 조용히 어긋남. 권고: raw 해시 저장. `[확실]`
- L4 검사 사각: 전각 `。` 로 끝나는 번역 2건(`演出`·`反射`), ASCII `!` 예문 1건(`あ`), 뜻 부분 되풀이 1건(`見える` 「보이다, 보이다」), 번역에 「」, 정보 없는 예문(7자 이하 N5 156·N4 36, 예 「フィルムです。」). 가나 1~2자 어간 47건은 포함 검사가 사실상 공허. `[확실]`
- L5 SOURCES.md 귀속 — 영어 뜻 출처를 JMdict 로만 적었지만 OpenJLPT NOTICE 는 영어 뜻을 Waller(CC BY)로 적는다(JMdict 는 id·품사·읽기 보정). Waller 크레딧 자체는 있으므로 표의 「쓴 것」 칸만 정정. `[확실]`
- L6 「Tatoeba 미사용」 — 입력에는 안 넣었지만 생성 예문 3건(`お手洗い`·`革`·`昇進`)이 raw 의 Tatoeba 문장과 글자까지 같다(짧은 흔한 문장이라 우연 `[가능성 높음]`). 문구를 「입력에 쓰지 않았다(우연히 같은 짧은 문장 3건 있음)」로.
- L7 거절 58 중 일상 단어(`ポーズ`·`つき`·`おだいじに`·`相変わらず`)가 수동 보충 경로 없이 빠짐. README 의 raw 받는 명령은 `main` 고정(트리 해시는 URL 로 못 씀) — 커밋 SHA 기록 권고.
- L8 보강 CLI 는 `HOME` 을 넘기므로 사용자 전역 CLAUDE.md 가 시스템 프롬프트 옆에 실릴 수 있다(`--setting-sources ''` 는 설정 파일만 막음) `[추측]` — 출력이 JSON 뿐이라 영향은 작음.
- 성능 참고(Low): `sessions.ts:428,573,879,895` 가 세트 생성 때마다 보관 안 한 단어 전부를 읽는다(사용자 단어 ≤100 → 최대 약 7.8천). 오늘의 단어는 미학습 단어가 균등 가중이라 N1 을 받은 사용자의 풀이 N1 위주가 됨 — 단계 필터는 분류 칩(`category`)으로만 가능.

### QA 에 넘길 high_risk_areas
1. 실제 DB 에서 N1 3,034개 삽입 시간(30s 상한)·중간 실패 시 0행 롤백·삽입 중 같은 사용자 채팅 턴 대기 2. 단계별 첫 호출 `added/skipped` 와 `import().default` 배열 동작(N5→N1 모두) 3. 옛 50개 사용자: N5 628/46 → 두 번째 0, ご飯/御飯·友だち/友達·私 3행 확인 4. 같은 표기 다른 읽기 행에서 교정 채택(409 existingId)·평가 생성(wordId)·레슨 메모 연결 5. 7.7천 단어 보유 사용자 오늘의 단어 세트 생성 지연 6. B 완료 전 문구(「50개」) 7. 앱 내 출처 줄 존재
native_change: false

## Reviewer 기록 (REV-180) — A3 델타 + B 화면
- [중간 1] 스냅샷 `~/.node-local/thekaiwa-rev180-src`(git archive 46efd74, node_modules 하드링크). 재현(질문 8): `next build` exit 0(`✓ Compiled successfully`) · tsc exit 0 · eslint 0 error/5 warning(기존 `useEffect(load)` 패턴) · 지정 시험 1468/1468 통과 · `validate.ts` VALIDATE_PASSED(N5 676·병합 2행 포함). 
- [중간 1] A3 질문 9~11: ① 새 검사 규칙을 A3 이전 데이터(def8fd4)에 돌리면 정확히 6행(N5 EXJA_NOT_CP932 1·N4 ASCII_PUNCT 1+MEANING_REPEAT 1·N2 KO_JA_PUNCT 1·N1 KO_JA_PUNCT 2)+기존 50개 누락 2 = hard 8, 최종 데이터·원본 5단계 표기/읽기에는 0건(과잉 거부 0 확인). 단 `nonCp932Chars('〜' U+301C)` 는 걸리는데 `JA_OK` 는 U+301C 를 허용 — 불일치(재생성 때만 영향, 현 데이터 0행). ② M2 세 곳 변이(정렬 제거·첫 행 고정→마지막 덮어쓰기·memo 정렬 제거) 3건 모두 새 시험이 실패로 잡음. 
- [중간 1] B: §19-4 A·B·C·D·F 문구·구조 대부분 가이드와 일치 확인(WordsEmpty·WordAddSheet·TodayWordsCard·DataCreditRow 문구 원문 대조). 남은 확인: 시험 파일 내용·#11 중복 호출·`.next/static` 데이터 유입·SOURCES.md 대조·Segmented 사용처·접근성 세부.
- [중간 2] 체크포인트: 전체 시험 `find src scripts/seed-build`(= 바뀐 `npm test` 범위) 2953/2953 통과 · validate `--raw /nonexistent` exit 1, `--allow-missing-raw` exit 4 재현 · `.next/static` 에 단어 데이터 0(「OpenJLPT」 글자만 한 청크) · 화면 파일 mtime 23:10~23:14 > 승인 22:56:43 · 데모 게이트 `DEMO_GATE_PASSED`(v1, hash verified, evidence.jsonl 승인 줄 1개 — 세션 id 일치, waive 없음).

## 최종 판정 (REV-180) — **PASS-with-fixes** (Critical 0 · High 0 · Medium 1(배포 게이트) · Low 8, 코드 수정 필수 0)
재현 근거: 스냅샷 `~/.node-local/thekaiwa-rev180-src`(46efd74). `next build` exit 0 · tsc 0 · eslint 0 error(경고 5, 기존 `useEffect(load)`) · 지정 시험 1468/1468 · 전체 2953/2953 · `validate.ts` VALIDATE_PASSED. DB·서버·포트 접속 없음. 브라우저 실측 없음(QA 몫). 디자인 판단은 하지 않았다.

### 질문별 결론
1. **§19-4 대조**: A·B·C·D·E·F-1·F-2 문구를 가이드 원문과 줄 단위 대조 — 불일치 0(`labels.ts` `SEED_COPY`·`seedResultText`·`levelHelpText`, `DataCreditRow.tsx` `DATA_CREDIT`). 구조·위계(채움 1·ghost 보조·직접 추가)·`aria-describedby`·`aria-label`·`aria-busy/aria-disabled`·버튼 말줄임 금지 모두 가이드대로. `DataCreditRow` 는 `Card` 클래스를 그대로 옮긴 `button`.
2. **D4-B 경계**: `seedLevelsFrom`(labels.ts) 이 level 아닌 값→둘 다 null, goal==main→null, 목표가 더 낮아도 그림, `'NONE'`→null. 시험이 이 경계를 모두 덮는다. loading 중 빈 카드는 `WordsScreen`(skeleton)·`TodayHome`(`state='loading'`)에서 #11 이 끝날 때까지 유지 — 늦게 끼어들어 커지지 않음. 훅의 status 전이는 시험 없음(L3).
3. **D6-A**: 확인 창 없음, `inFlight` ref + `isSeedPack` 통과 값만 `{pack}` 전송(`hooks.ts`), 화면의 `if (seedingPack) return` 도 유지, 결과 문구 4경우 가이드와 같음, 실패는 `actionErrorText` 공통 표.
4. **단일 출처**: 화면 코드에 옛 이름 「원어민」·기본 단어 `50개`·674·7,811·`'N5 기초'` 생성 0(주석·무관 문구만), 엔진·모델 이름 0, 출처 시트 Tatoeba 0, 라이선스 3줄이 SOURCES.md 와 일치(OpenJLPT CC BY-SA 4.0·Tanos CC BY·JMdict CC BY-SA 4.0). 합계는 `seedPackTotal()`.
5. **경계·번들**: 화면은 `@/types/seedPack` 리프만 import(서버 모듈 import 0), 클라이언트 번들에 단어 JSON 0. `Segmented` 사용처 33개 파일 — 한 줄 가지 클래스 문자열 동일(`tone` 분리만), `ariaLabel`/`sub` 는 선택 필드라 tsc 통과·시험 확인.
6. **접근성·모바일(소스 판단)**: 터치 44px↑(재시도 `min-h-[44px]`, 시트 글자 버튼, 분절 `h-12`), 긴 보조 버튼 `whitespace-normal break-keep` 2줄, 시트 초점·Esc·복귀는 공용 `Sheet` 규칙. 360 계산: 목표 수준 6칸 ≈46px(안쪽 ≈42px) 안에 「최상급」12.5px 세 글자 ≈38px, WordForm select 칸 ≈111~119px 안에 「최상급 (N1)」≈83px — 소스상 들어감 `[가능성 높음]`, 실측은 QA.
7. **보고된 차이 5개**: ① `seed()` 중복 호출 `null` — 타당(호출부 2곳 `if (!r) return`) ② `SegOption.ariaLabel?` — 타당(두 줄 칸의 이름이 「초보자N5」가 되지 않게) ③ 주 버튼 줄바꿈 클래스 — 무해 ④ 누른 버튼도 `aria-disabled` — 기존 방식 ⑤ #11 중복 — 가이드 준수지만 개선 여지(L1). 재시도 링크 정렬(빈 단어장 가운데·오늘 카드 왼쪽)은 각 카드의 기존 정렬(`Card text-center` / 왼쪽)과 일치, 디자이너 확인 권고 유지.
8. **재현**: 위 근거.
9. **N5 병합**: `build.ts finalizeLevel`→`mergeLegacyN5`(원본 행 뒤, 기존 값 그대로) 재현 가능, `validate.ts` 가 보장·값 불변·순서를 검사(A3 이전 데이터에서는 「빠진 것 2」 hard 로 잡힘). 위험 기록은 정확 — SOURCES.md 가공 6항·README(옛 50개 사용자만 `ご飯`+`御飯`·`友だち`+`友達` 공존, 신규 사용자는 중복 없음), 시뮬레이션 added 628·skipped 48·두 번째 0 과 일치. 다만 Leader 의 REV-179 처리 문구는 4행 병합이라 이 결정(2행)은 아직 Leader 확인 전(L4).
10. **새 검사 규칙**: A3 이전 데이터에 돌리면 정확히 6행(N5 `员` 1·N4 `!`·뜻 되풀이·N2 `「」`·N1 `。` 2) + 병합 누락 2 = hard 8, 최종 데이터·원본 5단계에는 0 — 과잉 거부 없음, 6건 모두 진짜 결함. 예외: `nonCp932Chars('〜' U+301C)` 가 걸리는데 `JA_OK` 는 허용(L5).
11. **M2 세 곳**: 변이 3건(정렬 제거·첫 행 고정→마지막 덮어쓰기·memo 정렬 제거) 모두 `task051Homograph.test.ts` 가 실패로 잡음 — 시험이 의미 있음. 전체 시험 통과로 기존 동작 회귀 없음.

### 지적 (심각도 · 근거 · 권고 · 확신)
- **M1(Medium·배포 게이트)** 출처 시트 문구 「사람은 일부만 확인했어요」(`DataCreditRow.tsx:26`)와 SOURCES.md 가공 4항은 사용자 표본 검수가 끝났다는 전제인데 검수는 「남은 일」이다(ACTIVE·이력서). 이 상태로 배포하면 사용자 화면의 사실 진술이 거짓. 권고: Leader 게이트 유지(표본 검수 전 push·배포 금지)를 deployer 체크리스트에 넣거나 검수 전에는 문구를 「사람이 확인하지 않은 항목이 많아요」로. `[확실]`
- L1 `study/today/(tab)/page.tsx` 가 이미 `getProfile` 로 level 을 읽는데 `goalLevel` 만 안 넘겨 #11 을 클라이언트에서 다시 부르고(요청 +1) 빈 카드가 로딩 대기를 한다. 권고: 후속 개선으로 서버 prop 전달(가이드 19-3 은 준수). `[확실]`
- L2 B 기록의 체크포인트 시각(22:10~22:55)이 실제와 어긋난다 — 화면 파일 mtime 은 23:10~23:14, 승인 22:56:43, 가이드 커밋 23:06. 승인 뒤 작성이라 게이트 위반은 아니지만 기록이 위반처럼 읽힘. 권고: 실제 시각으로 정정. `[확실]`
- L3 시험 공백: `useSeedPack` 의 `inFlight` 중복 탭 차단과 `useSeedLevels` 상태 전이·화면의 로딩 대기 분기는 SSR 문자열 시험 밖(훅 시험 없음). 서버가 멱등(두 번째 added 0)이라 피해는 작음. 권고: QA 가 실제 더블탭으로 확인. `[확실]`
- L4 Leader 결정 불일치: `task-051-improve-n5-vocab-pack.md` 「Leader 처리」는 4행 병합이고 A3 는 2행(+철자 짝 제외). 합리적 판단이나 승인·이력서 갱신 필요. `[확실]`
- L5 `enrich.ts` `JA_OK` 는 `〜`(U+301C) 허용, `CP932_CHARS` 는 불허 — 모델이 `〜` 를 쓰면 재생성에서 거절. 현 데이터 0행이라 영향은 다음 재생성뿐. 권고: `〜`→`～` 정규화 또는 JA_OK 와 맞춤. `[확실]`
- L6 `generate.ts` 앞 행 고정은 결정성만 보장(개발자 기록과 같음) — 평가 문항 `wordId` 가 같은 표기 형제 행에 붙을 수 있는 근본 문제는 `materials.ts` 에서 같은 표기 하나만 뽑는 후속 필요. `[확실]`
- L7 출처 시트가 Tanos 주소를 보이는데 SOURCES.md 는 사이트 접속 불가(보관본만)라고 적는다. 귀속 의무는 충족, 주소가 죽어 있음. `[확실]`
- L8 `aria-disabled` 에 시각 표시가 없어 넣는 중 다른 넣기 버튼이 활성처럼 보인다(기존 방식). 설정 외 화면(평가 홈 카드·평가 시작 화면)에는 여전히 「내 레벨 N5」 같은 raw 코드가 있어 §19 의 「이름 (코드)」 통일 밖 — designer 판단 사항으로 Leader 에게 전달. `[확실]`

### QA 에 넘길 high_risk_areas
1. 실제 브라우저 360/390/412: (지금 고급·목표 최상급) 보조 버튼 2줄이 48px 안, 오늘 홈 보조 버튼 +56px 일 때 [시작하기]·회화 카드 위치, 설정 목표 수준 6칸 「최상급」 잘림, WordForm 2열 select 「최상급 (N1)」, 추가 시트 글자 버튼 줄바꿈, 출처 시트 안 스크롤·초점 복귀·Esc
2. 넣기 실동작: N1 3,034개 시간(상한 30s)·실패 시 0행·넣는 중 다른 버튼 무반응·더블탭 1회·결과 문구 숫자(옛 50개 사용자 628/48, 두 번째 0)
3. #11 실패(오프라인) → 「다시 시도」 → 복귀, loading 중 빈 카드 대기(높이 변화·깜빡임), 웹·앱 설정 맨 아래 순서(웹: 음성 인식→출처 줄 / 앱: 버전→출처→관리자)
4. 같은 표기 다른 읽기 행: 교정 채택 409 `existingId`·평가 wordId·레슨 메모 연결
5. `Segmented` 한 줄 사용처 회귀(채팅·회화·관리자 등 33개 파일) 시각 확인, 스크린리더 이름(「초보자 (N5)」)·`aria-busy`
6. 표본 검수 완료 전 배포 금지(M1)
native_change: false
