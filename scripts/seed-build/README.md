# scripts/seed-build — JLPT 기본 단어 시드 생성 (task-051)

OpenJLPT(CC BY-SA 4.0) 표기·읽기에 한국어 뜻·품사·조각 유형·예문(일·한)을 Claude CLI 로 채워
`prisma/seed-data/jlpt/{n5,n4,n3,n2,n1}.json` 과 `src/types/seedPackCounts.ts` 를 만든다. 출처·라이선스는 `prisma/seed-data/SOURCES.md`.

**앱 런타임과 무관한 오프라인 도구다.** 앱은 생성된 JSON 만 읽는다(`src/modules/learning/vocab/seedPack.ts`). DB 를 쓰지 않는다.

| 파일 | 역할 |
|---|---|
| `enrich.ts` | 프롬프트(prompt-engineer draft3 그대로)·응답 파싱 `parseRows`·행 판정 `checkRow`·레코드 변환·공용 검사 함수 |
| `build.ts` | 단계별 생성 러너(체크포인트·재개·재시도·한도 백오프), `counts`·`sample` 보조 명령 |
| `validate.ts` | 시드 파일 검증(통과 못 하면 시드에 못 넣는다) — build 가 단계마다 부르고 따로 돌려도 된다 |
| `enrich.test.ts` | 행 판정·레코드 검사 단위 시험 |

## 1. 원본 받기 (데이터 파일만 — 코드 실행 없음)

```bash
REF=bf4e1eecd5d11406aaecdee910464507aef7fcdc   # task-051 이 쓴 OpenJLPT 커밋(아래 표) — main 이 아니라 커밋 SHA 로 받는다
mkdir -p ~/.node-local/thekaiwa-seedwork/raw && cd ~/.node-local/thekaiwa-seedwork/raw
for l in n5 n4 n3 n2 n1; do curl -fsSLO "https://raw.githubusercontent.com/evanclan/OpenJLPT/$REF/data/json/vocab/$l.json"; done
curl -fsSLO "https://raw.githubusercontent.com/evanclan/OpenJLPT/$REF/data/json/meta.json"   # version 0.3.0 · counts 674/630/1659/1778/3070
sha256sum n5.json n4.json n3.json n2.json n1.json   # 아래 표와 같아야 한다
```

task-051 생성에 쓴 원본(2026-10-10 받음, `main` 에서 받았고 그때 `data/json/vocab` 의 마지막 변경 커밋이 아래다 — GitHub API 로 확인):

| 항목 | 값 |
|---|---|
| OpenJLPT 커밋 | `bf4e1eecd5d11406aaecdee910464507aef7fcdc` (2026-09-30, 「openjlpt upgrade (#3)」) · v0.3.0 |
| `data/json/vocab` 트리 | `ada3a00c1f4300efb3fa4cac6ab46b0bbb7a789d` |
| sha256 n5 · n4 | `cbb221c9a3a92108fcd02fb088d9afacc70bc8c96570d5730425de0a49dad5f3` · `b38512a6dc1e06a3615f377b3e58184c4a85b6f769c2e3f58f2a4ef0e1810927` |
| sha256 n3 · n2 | `17ca6bcbba9d212c3c9d38c38cecc2adef0fd8718cb7157bb48dd9d3a1724948` · `4c7053d1b61f71ca4004252cafdf89439c65531900e7bab6c53078802acf3c5b` |
| sha256 n1 | `09325eb676ec26044e9019afb5ddd460a394a0d8cb51b0b34d30d03124c131ff` |

체크포인트(`state.json`)는 이 원본 해시를 저장하고, 원본이 바뀌면 거부한다(위치 기준이라 순서가 바뀌면 조용히 어긋나기 때문). 원본은 저장소에 넣지 않는다(작업 폴더 `~/.node-local/thekaiwa-seedwork/`).

## 2. 실행 (NFS 는 noexec — 미러에서)

```bash
cd <저장소>   # NFS 원본
KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-seed051a1 bash scripts/sync-local.sh   # 전용 미러(없으면 기본 미러를 cp -al 해서 만든다)
cd ~/.node-local/thekaiwa-seed051a1

# 생성 — 결과는 --repo(NFS 원본)에 쓴다. 단계 순서 N5 → N1, 단계마다 끝나면 검증 후 파일 기록.
nohup node --import tsx scripts/seed-build/build.ts run --repo <저장소> > ~/.node-local/thekaiwa-seedwork/build.log 2>&1 &
cat ~/.node-local/thekaiwa-seedwork/build/progress.json      # 진행 확인

node --import tsx scripts/seed-build/validate.ts --repo <저장소>     # 검증(VALIDATE_PASSED / exit 0)
node --import tsx scripts/seed-build/build.ts sample --repo <저장소> # 사용자 표본 검수 파일 다시 만들기
node --import tsx scripts/seed-build/build.ts counts --repo <저장소> # seedPackCounts.ts 만 다시 쓰기
node --import tsx scripts/seed-build/build.ts recheck --repo <저장소> # 검사기를 바꾼 뒤: 거절 행 재판정 + 새 규칙에 걸린 ok 행을 다시 생성 대기로
node --import tsx scripts/seed-build/build.ts run --repo <저장소> --levels N5,N4   # → 대기 행만 다시 생성(같은 프롬프트·모델·행 단위 재시도)
node --import tsx --test scripts/seed-build/enrich.test.ts           # 단위 시험(npm test 범위에도 들어 있다)
```

**데이터를 손으로 고치지 않는다.** 검사 규칙을 추가하면 `recheck` → `run` 으로 걸린 행만 같은 경로로 다시 만든다(REV-179 때 6행: 간체자 `员` 1 · 예문 ASCII `!` 1 · 뜻 되풀이 1 · 번역 `「」` 1 · 번역 끝 `。` 2 — 모두 1차에 통과).
다시 만든 행은 `state.json` 의 `requeued`(이전 값)로 남고, 표본 검수 파일 ②표에 전후가 나온다.

### 기존 50개 병합 (N5)

N5 확정 때 기존 `prisma/seed-data/words-n5.json`(사람이 쓴 50개) 중 N5 에 (표기, 읽기)가 없는 행을 OpenJLPT 순서 **뒤에** 기존 순서·기존 값 그대로 붙인다
(`enrich.ts mergeLegacyN5`, REV-179 M3 — 지금은 `私/わたし`·`日本語/にほんご` 2행). 같은 읽기의 철자 차이 짝 `ご飯→御飯`·`友だち→友達`(`LEGACY_SPELLING_VARIANTS`)는
같은 단어라 붙이지 않는다 — **알려진 한계**: 옛 50개를 이미 가진 사용자가 N5 를 넣으면 두 표기가 함께 남는다(단어장 중복 키가 (표기, 읽기)).

옵션: `--levels N5,N4`(일부 단계만) · `--conc 1~3`(동시 호출, 최대 3) · `--work DIR`(체크포인트, 기본 `~/.node-local/thekaiwa-seedwork/build`) · `--raw DIR`.

모델·배치(Leader 결정, task-051): N5·N4 = haiku 배치 40, N3·N2·N1 = sonnet 배치 20. 출력은 키 없는 6칸 배열(`--json-schema` 없음).

## 3. 재개·재시도 규칙

- 체크포인트: `<work>/<단계>/state.json`(항목별 상태), 호출 기록 `calls.jsonl`(토큰·시간만, 프롬프트 원문 없음), 단계 요약 `summary.json`.
  끊겨도 같은 명령을 다시 실행하면 남은 항목부터 이어서 한다. 프롬프트 버전·모델·원본 개수가 바뀌면 체크포인트를 거부한다(지우고 다시).
- 행 단위: `ok` 는 확정, `retry`(계약 위반)·`null`(모델이 확신 없음·예문 못 씀)은 다음 배치로 모아 **1회** 재호출 → 그래도 아니면 거절.
  거절 행은 지어내지 않고 `~/.node-local/thekaiwa-seedwork/rejected-<단계>.json` 에 모은다(시드에 넣지 않음).
- 호출 단위: 종료 코드·파싱·행 수 불일치·타임아웃(240초)은 같은 배치를 3번까지 재시도. 그래도 실패하면 그 항목은 남겨 두고 종료 코드 2(다시 실행).
- 429·한도 오류: 30·60·120초 백오프 후에도 계속되면 **전체 중단**(종료 코드 3) — 상태는 저장돼 있다.
- 단계 완료 시 `<단계>.json.next` 로 쓰고 `validate` 를 통과해야 정식 이름으로 바꾼다.

## 4. 검증 규칙 (validate.ts)

hard(실패): 7필드·키 순서 · 빈 값 · 품사·조각 enum(`words.ts` 와 같음 — 시험이 원문 대조) · 읽기 가나 · 뜻(한글 필수, 일본어 문자 금지, 40자, 같은 뜻 되풀이 「보이다, 보이다」 금지)
· 예문(일본어 문자·전각 문장부호만 — ASCII `!?,.` 금지, 60자, 표제어 포함 — 활용형은 어간, 불규칙은 면제, 가나 표기는 읽기로 허용) · 번역(한글, 일본어 문자·일본어 전각 문장부호 `。！？「」『』、` 금지, 100자)
· **cp932(Windows-31J)로 인코딩되지 않는 글자**(표기·읽기·예문 — 중국어 간체자 등, 일본어에 없는 한자) · OpenJLPT 에 없는 (표기, 읽기)·순서 위반 · 단계 안 (표기, 읽기) 중복
· `seedPackCounts.ts` 와 길이 불일치 · N5: 기존 50개가 모두 (표기, 읽기)로 있음(철자 차이 짝은 상대 표기로), 병합 행은 기존 값 그대로·원본 행 뒤
· **원본(raw) 디렉터리 없음** — 원본 대조 없이는 통과로 치지 않는다(`--allow-missing-raw` 면 경고만 하고 `VALIDATE_INCOMPLETE`, 종료 코드 4).
보고만: 단계 간 (표기, 읽기) 중복, 단계 간 표기만 같은 단어(읽기 다름 — 다른 단어), 기존 `words-n5.json` 과 겹침, soft 코드(어간만·읽기만 포함 등).

**자동 검사는 한국어 뜻·번역의 오류를 잡지 못한다** — 배포 전 사용자 표본 검수(`agent-vault/10-Flow/tasks/task-051-sample-review.md`)가 필수다.
