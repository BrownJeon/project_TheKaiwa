---
task_id: task-032
title: "관리자 발음 사전을 읽기 분석기(히라가나·한글 표시)에도 반영 — 青か·愚か·密か 오분절"
status: done
base_ref: 26b6322
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-026-improve-hangul-reading, task-003g-lexicon-admin, task-003d-tts-p0]
tags:
  - type/task
  - domain/speech
  - domain/admin
aliases:
  - 발음 사전 읽기 반영
  - task-032
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
지금 관리자 발음 사전(PronunciationLexicon, [[task-003g-lexicon-admin]])은 TTS 에만 쓰이고, 화면의 히라가나·한글 줄을 만드는 읽기 분석기(gateway pyopenjtalk, [[task-026-improve-hangul-reading]])는 모른다. 그래서 `赤か青か` 의 `青か` 를 한 단어(セイカ)로 읽어 `青{せい}か`·세-카 가 된다(愚か·密か 도 같은 계열 — 026 L7 "알려진 한계").

관리자가 사전에 고친 읽기가 화면 읽기 줄에도 같게 나오도록, 활성 사전 버전을 읽기 분석 경로에 반영한다.

검토할 설계 질문(C1 전 Leader·developer):
- 반영 위치: (a) 앱 L4 `speech/reading` 이 분석 결과를 사전으로 후처리 vs (b) gateway 에 사전 버전을 넘겨 pyopenjtalk 사용자 사전으로 분석. 엔진명은 adapter·`speech/common` 밖으로 내지 않는다.
- 캐시 키에 사전 버전 포함(사전 변경 뒤 옛 읽기 잔존 금지), 환경(DEVELOPMENT/PRODUCTION) 분리.
- 사전 항목이 "표기 → 읽기"라 분절 자체를 바꾸는 경우(青か → 青+か) 처리 가능 범위.

완료 기준: 青か·愚か·密か 와 사전에 추가한 임의 항목이 읽기·한글 줄에 반영, 사전 끄기/롤백 시 원복, 기존 읽기 회귀 0, 첫 화면 읽기 지연 악화 없음, 엔진명 누출 0.

## 예상 변경 경로
- `src/modules/speech/reading/**` · `src/modules/engine/adapters/text/annotateHttp.ts`
- `speech/gateway/kaiwa_gateway/text.py` · `speech/gateway/app.py` · `speech/gateway/tests/test_text.py`
- (조회만) 발음 사전 버전 조회 경로 — `ConfigurationVersion`·`LexiconVersion` 쓰기는 하지 않음

## 관련 과거 이력 요약
- [[task-003g-lexicon-admin]]: 사전 버전+감사 한 트랜잭션, 환경 잠금, Rollback 은 새 버전(ConfigScope LEXICON — [[task-018-db-structure-hardening]]).
- [[task-026-improve-hangul-reading]]: 읽기 출처 pyopenjtalk, 형용동사 어간 합침/숨김 규칙(N1), 1-스레드 executor, "틀린 것보다 없음".
- 승인된 교훈: 없음.

## Judge 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "intake",
  "checkpoint": null,
  "task_id": "task-032",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.5.0",
  "model": "jev-1.13.0",
  "decision": {
    "task_type": "feature",
    "complexity": 2.44,
    "needs_info": false,
    "risk": "R1",
    "developer_model": "opus",
    "roles": [
      "designer?",
      "prompt-engineer?",
      "developer",
      "reviewer",
      "qa"
    ],
    "demo": {
      "required": false,
      "level": "none",
      "owner": null,
      "publish": "artifact+repo",
      "source": "jev",
      "rule_id": null,
      "rule_ids": [],
      "waiver_requested": false,
      "configuration_error": null
    },
    "track": "standard",
    "next": "assign",
    "next_actions": [
      "assign_developer"
    ],
    "blocking_gate": null
  },
  "signals": {
    "task_type": {
      "choice": "feature",
      "confidence": 0.5
    },
    "complexity": {
      "score": 2.44,
      "confidence": 0.56
    },
    "needs_info": {
      "noul": 0.59
    },
    "risk": {
      "choice": "normal",
      "probabilities": {
        "low": 0,
        "normal": 0.72,
        "high": 0.28
      }
    },
    "ui_detect": "listed",
    "ui_change": {
      "valid": true,
      "choice": "none",
      "confidence": 0.98,
      "probabilities": {
        "behavior_change": 0.01,
        "new_screen": 0,
        "minor_visual": 0,
        "none": 0.99,
        "partial_restructure": 0,
        "overhaul": 0
      }
    }
  },
  "rule_overrides": [],
  "fallback": null,
  "input_tokens": 1362,
  "cost_usd": 0.000057,
  "latency_ms": 271
}
```

**기록**:
- [2026-10-04 23:37] intake engine=jev → task_type=feature · risk=R1 · developer_model=opus · next=assign | overrides=- | fallback=- | tokens=1362

- [2026-10-05 00:30] codex_gate[C1] engine=jev → codex_required=false · budget_rule=CX-limit-unknown-hold (design_uncertainty 1.14) | overrides=- | fallback=- | tokens=835 — Codex 호출 없음


- [2026-10-05 00:35] codex_gate[C2] engine=jev → codex_required=false · budget_rule=CX-limit-unknown-hold | overrides=CX-limit-unknown-hold | fallback=- | tokens=994
## Leader 기록 (C1 설계 확정, 2026-10-05)
- 설계안 (a) 앱 L4 후처리 채택(gateway·어댑터·서버 읽기 캐시 불변, 재배포 불필요).
- **사용자 결정(AskUserQuestion)**: ① 적용 범위 "전체 + 내 사전 (Recommended)" = GLOBAL + 본인 USER (VOICE·LESSON·COURSE 제외) ② 활용형 충돌(`上手`=ジョウズ vs `上手い`=ウマイ) "숨김 (Recommended)".
- judge C1 Codex 불필요. 구현 developer(opus, 실호출모델=opus) 소환. 정본 3곳(api-contract #24r·speech-platform/16 §2·module-dependency) 갱신은 Leader 가 구현 후 반영.
- 범위 밖 기록: TTS 가 사전 `明日` 때문에 `明日香` → アシタ香 — 후속 후보.

## 설계안 (Developer, C1 대상)

> 설계 단계 산출물(코드 무수정). 실험은 개발 venv `~/.node-local/thekaiwa-speech-dev`(pyopenjtalk 0.4.1)와 스크래치 사본 `text.py` 에서만 했다. 운영·DB 쓰기 0.

### 1. 현재 경로 (사실 확인)
- **TTS 사전 적용(방식 A, 치환)**: `speech/tts/synthesize.ts:199-203` 가 `loadActiveLexicon(currentEnvironment())`(ACTIVE `PronunciationLexiconVersion.snapshot`, 환경별 30초 메모리 캐시 `lexicon.ts:169-184`, 쓴 프로세스는 커밋 직후 `afterLexiconCommit` 로 비움) → `selectEntries`(`lexicon.ts:85` — enabled + 문맥 범위 USER>VOICE>LESSON>COURSE>GLOBAL, 표기당 1건) → `renderingPlan.ts:29` `findLexiconMatches`(working 표기 최장 일치, `lexicon.ts:101`) → 정규화가 매칭 구간을 보호 → 어댑터 `engine/adapters/tts/styleBertHttp.ts:43` `substituteReadings` 가 표기를 **가타카나 읽기로 치환**해 M4 로 보냄(악센트 미반영). 캐시 키 사전 요소 = `dictionaryVersion[:lexiconDigest]`(`tts/cache.ts:46`).
- **읽기 분석 경로**: 라우트 `app/api/v1/text/annotate/route.ts:21` → L4 `speech/reading/index.ts:107` `annotateReadings`(프로세스 LRU 캐시 키 = sha256(문장)만 `:45`, 5,000건·6h·120,000단위, 실패 30초 쉼, 동시 상한) → L5 파사드 `engine/text` → 어댑터 `engine/adapters/text/annotateHttp.ts:124`(칸별 검증 `:84-122`, surface 이어 붙임 = 원문) → gateway `kaiwa_gateway/text.py:273` `annotate_one`(pyopenjtalk `run_frontend`, 1-스레드 executor `:337`, 形容動詞語幹 합침/숨김 `_merge_split_stems :240`). **사전은 이 경로 어디에도 없다.** 브라우저에도 문장별 메모리 캐시(`components/common/japanese/annotations.ts:125`, 페이지 생존 동안).
- **실측(현재 분석기)**: `赤か青か`→노드 `青か/セイカ`(한 단어) · `愚か`/`愚か。`/`それは愚か。`→`愚/グ + か` · `密か`/`密か。`→`密/ミツ + か`. 단 `愚かな`·`愚かだ`·`密かに`·`密かな` 는 원래 맞음(オロカ·ヒソカ) — **문장 끝 오분절**이 문제. 시드 GLOBAL 6건(日本橋·秋葉原·御徒町·神保町·等々力·明日)은 분석기 읽기와 이미 같은 소리(神保町 은 ruby じんぼうちょう·pron ジンボーチョー).

### 2. 선택지 비교

| 기준 | (a) 앱 L4 후처리(분석 결과 조각에 사전 덮어쓰기) | (b) gateway 에 활성 사전 전달 → pyopenjtalk 사용자 사전 | (c) gateway 에 매칭 구간 전달 → TTS 처럼 가타카나 치환 후 분석·역매핑 |
|---|---|---|---|
| 青か·愚か·密か | ✅ 표기 `青か`·`愚か`·`密か` 항목이 조각 경계와 맞음(`青か` 1조각, `愚+か` 2조각) → 교체. 프로토타입 실측 OK | ✅ 단 **비용(cost) 의존**: 사용자 항목 cost 1 → 고침 / 6000 → `青か` 못 고침. cost 1 은 시드 `明日` 이 `明日香`→`明日+香(ガ)` 로 **틀린 읽기**를 새로 만듦(원칙 위반). 품사도 wordType→품사 매핑을 임의로 정해야 함 | △ 치환 문자열 `アオカ` 를 분석기가 `アオ+カ(副詞)` 로 쪼개고 구절 경계(chain_flag)가 단어 중간에 생김 → 구간 안 노드 합치기·경계 보정 필요. 결과 표시는 (a)와 같음 |
| 분절 자체를 바꾸는 경우 | 항목 표기가 조각 경계와 맞으면 교체. 안 맞으면 규칙(§3)으로 **유지 또는 숨김**(틀린 읽기 안 냄) | 격자(lattice)가 결정 — 가장 자연스럽지만 결과를 예측·보장 못 함 | 치환 구간 기준 역매핑, 경계 밖으로 번지면 숨김 |
| 범위(USER 등) | GLOBAL+본인 USER 그대로(요청당 선택) | 사용자별 사전 컴파일 필요 → 사실상 GLOBAL 만 | 가능(매칭은 앱) |
| 6층·엔진명 | L4 `speech/reading` 이 같은 모듈 `speech/tts/lexicon` 을 읽기만. 엔진명 0 | 어댑터 계약에 사전 항목 추가, gateway 가 MeCab CSV 품사·비용을 앎(엔진 내부라 경계 OK) | 어댑터 계약에 구간 추가 |
| 캐시 무효화 | 서버 읽기 캐시는 **사전 무관 원본**만 담고 덮어쓰기는 캐시 뒤에서 매 요청 → 키 변경 불필요, 버전 바뀌면 즉시 새 결과 | 앱 캐시 키에 사전 버전+digest, gateway 에 버전별 사전 인스턴스 캐시 | 앱 캐시 키에 digest |
| 환경 분리 | `loadActiveLexicon(currentEnvironment())` 그대로 | 앱이 환경 사전을 보내야 함 | 같음(a) |
| 첫 화면 지연 | 덮어쓰기 실측 2,389문장 13~17ms 합계(문장당 ~7µs). 사전 로드는 30초 캐시 + 분석기 호출과 **병렬** | 사전 컴파일 3건 8.8ms·인스턴스 0.2ms/+1MB(실측) — 버전 바뀐 첫 요청만 | 분석 1회 그대로 + 역매핑 |
| gateway 재배포 | **불필요**(웹 배포만) | 필요(Python·테스트·pm2) | 필요 |
| 끄기/롤백 원복 | 항목 끄기·Rollback = 새 ACTIVE → 다음 요청부터(다른 프로세스 ≤30초) 원복 | 버전 키로 원복(사전 재컴파일) | 같음(a) |
| 실패 시 | 사전 로드 실패 → 직전 성공 사전(없으면 덮어쓰기 없이 지금과 같은 출력) | 사전 컴파일 실패 → 기본 분석 | 역매핑 실패 → 그 칸 숨김 |
| TTS 와 일치 | 맞는 조각은 같은 읽기. TTS 치환 버그(`明日香`→`アシタ香`)는 표시에 옮기지 않음(§3 유지 규칙) | 분절 방식이 TTS(치환)와 달라 어긋날 수 있음 | TTS 와 가장 같음(버그까지) |

### 3. 권고안 — (a) 앱 L4 후처리 "사전 덮어쓰기"
gateway·어댑터·서버 읽기 캐시·응답 모양은 그대로 두고, `annotateReadings` 가 캐시(또는 분석기)에서 얻은 원본 조각 위에 **요청마다** 활성 사전을 덮어쓴다.

- **사전 선택**: `loadActiveLexicon(currentEnvironment())` + `selectEntries(entries, { userId })` → **GLOBAL + 본인 USER** 만(VOICE·LESSON·COURSE 는 문맥 id 가 없어 자동 제외 — VOICE 는 목소리별 소리 보정이라 화면 읽기에 맞지 않고, 라우트에 레슨·주제 문맥이 없다). 매칭은 TTS 와 같은 `findLexiconMatches`(최장 일치·priority) — 표시와 소리가 같은 항목을 고른다.
- **매칭 하나의 처리 규칙**(원문 좌표, 조각 = gateway 세그먼트):
  1. **같음**: 매칭 구간이 조각 경계와 정확히 맞고, 그 조각들의 발음(pron 이어 붙임) 또는 읽기(ruby 읽기+가나 표기를 가타카나로)가 항목 읽기와 같으면 **그대로**(神保町·御徒町·日本橋 — 분석기의 더 나은 ruby `じんぼうちょう`·`御徒{おかち}町{まち}` 유지).
  2. **교체**: 경계가 맞고 읽기가 다르면 그 조각들을 한 조각으로 — `surface`=원문 구간, `ruby`=`alignWordRuby(surface, 항목 읽기)`(실패 시 null), `pron`=항목 읽기, `boundary`=첫 조각 것. 바로 뒤 조각의 `boundary==='particle'` 은 `'phrase'` 로(합친 구간 끝의 조사 は·を·へ 가 사라졌으므로). → `青{あお}か`·アオカ, `愚{おろ}か`·オロカ, `密{ひそ}か`·ヒソカ.
  3. **유지(복합어)**: 경계가 안 맞고 구간 밖으로 삐져나온 부분에 한자 등 가나 아닌 글자가 있으면 분석기가 더 긴 단어를 알아본 것 → **그대로**(`明日香`=あすか, 항목 `明日` 미적용).
  4. **유지(일치)**: 삐져나온 부분이 가나뿐이고 조각들 읽기 = 앞가나+항목 읽기+뒷가나 이면 이미 같은 소리 → **그대로**(`青から`·`青かった`·`青かな` + 항목 `青か`).
  5. **숨김**: 그 밖(가나만 삐져나왔는데 읽기가 충돌, 예: 항목 `上手=ジョウズ` 와 `上手い/ウマイ`) → 겹친 조각 `ruby/pron=null`(한글 줄은 기존 규칙대로 문장 전체 숨김) — "틀린 것보다 없음".
  - 불변식: 결과 surface 이어 붙임 = 원문(아니면 원본 조각 반환), 입력 배열·캐시 객체 **변경 금지**(새 배열), 예외 → 그 문장은 원본 조각.
- **캐시·환경·원복**: 서버 LRU 는 사전 무관 원본만 — 키 변경 없음, 사전 버전 변경·끄기·Rollback 은 다음 요청에 바로 반영(다른 프로세스는 사전 30초 캐시 뒤). 덮어쓴 결과는 서버에 캐시하지 않는다(문장당 µs). 환경은 `currentEnvironment()` 의 ACTIVE 버전. 브라우저 캐시(페이지 생존)는 새로 고침 후 반영 — 수용.
- **지연**: 사전 로드를 분석기 호출과 `Promise.all`. 사전 로드 실패·1초 초과 → 그 환경의 **직전 성공 사전**(stale) 사용, 한 번도 못 읽었으면 덮어쓰기 생략(지금과 같은 출력) + 경고 로그(종류만). 이를 위해 `lexicon.ts` 에 표시용 로더(같은 캐시 맵, stale 허용) 1함수 추가 — TTS 경로 `loadActiveLexicon` 은 무변경.
- **실측(프로토타입 `scratchpad/t032/overlay2.py`, 실분석기, 코퍼스 2,389문장 = seed-data·테스트 픽스처·프롬프트 문자열·템플릿)**: 시드 6건만 → 바뀐 문장 **0**(같음 317·복합어 유지 48). 시드+`青か`·`愚か`·`密か` → 교체 94·유지(일치) 16·숨김 8(전부 비문 템플릿 `愚かかった`·`密かかった` — 원래도 グ·ミツ 오독), 정상 문장 숨김 0.

### 4. 변경 파일(서브태스크 1개, 약 7개)
1. `src/modules/speech/reading/lexiconOverlay.ts`(신규, 순수 함수 — 규칙 1~5·불변식)
2. `src/modules/speech/reading/index.ts`(사전 로드 병렬·덮어쓰기 적용, `deps.loadLexicon` 주입, 옵션 `userId`)
3. `src/modules/speech/tts/lexicon.ts`(표시용 stale 허용 로더 1함수 — 쓰기 0)
4. `src/app/api/v1/text/annotate/route.ts`(세션 사용자 id 를 `userId` 로 넘김 — 1줄)
5. `src/modules/speech/__tests__/reading.test.ts`(기존 테스트에 빈 사전 로더 주입 — DB 안 부르게)
6. `src/modules/speech/__tests__/readingLexicon.test.ts`(신규) + `__tests__/fixtures/readingLexiconSegments.json`(실분석기로 뜬 조각 고정 — gateway 없이 결정적)
- gateway(`text.py`·`server.py`·pytest)·어댑터 `annotateHttp.ts` **무변경**(회귀 실행만).
- Leader 몫(문서): `api-contract` #24r "관리자 발음 사전(GLOBAL+본인 USER) 반영" 한 줄, `speech-platform/16` §2 적용 대상에 "화면 읽기 줄", `module-dependency` reading→tts/lexicon(같은 L4 내부).
- 선택(designer, 화면 파일): 관리자 사전 "적용 규칙"(`components/admin/lexicon/lexiconCopy.ts:15-20`)에 "화면 후리가나·한글 줄에도 전체·사용자 범위가 반영돼요" 한 줄 — 하지 않아도 기능 무관.

### 5. 테스트 계획
- **단위(규칙)**: 픽스처 조각으로 — 교체(`赤か青か`·`この赤か青か決めて`·`愚か。`·`それは密か`) / 같음(神保町 ruby `じんぼうちょう` 유지·御徒町 2조각 유지·`明日は`) / 복합어 유지(`明日香`) / 일치 유지(`青から`·`青かった`·`青かな`) / 숨김(`上手=ジョウズ`+`上手い`) / 조사 경계 보정 / `alignWordRuby` 실패 시 ruby null·pron 유지 / surface 불변식 / 입력 deep-freeze 후 무변경 / 다른 사용자 USER·VOICE·LESSON·꺼진 항목 미적용.
- **단위(통합)**: 같은 문장을 사전 v1→v2→(끄기)v3 로 세 번 → 분석기 호출 1회·결과 3종(캐시 키 무관 반영) / 로더 실패 → stale 사용, 최초 실패 → 원본 / 로더·분석기 병렬(가짜 지연 합 < 순차) / `available` 값 불변.
- **변이(전부 FAIL 확인)**: 경계 검사 제거(→明日香) · 일치 유지 제거(→青から 숨김) · 같음 규칙 제거(→神保町 ruby `ー`) · 범위 필터 제거 · 입력 변경(제자리 수정) · 뒤 조각 경계 보정 제거 · stale 대체 제거.
- **회귀**: 기존 `reading.test.ts`·전체 단위·tsc·eslint, gateway pytest(무변경 확인), 코퍼스 스크립트(시드만 → 바뀐 문장 0).
- **QA 라이브(LOCAL/DEVELOPMENT 환경)**: 관리자 API 로 GLOBAL `青か/アオカ`·`愚か/オロカ`·`密か/ヒソカ`+임의 항목 추가 → `/api/v1/text/annotate` ruby·pron·한글 줄 반영 → 끄기·Rollback → 원복 → PRODUCTION 사전 무영향 → 첫 화면 읽기 p50 전후 → 응답·로그 엔진명 0 → 테스트 데이터 원복.

### 6. 위험
- R1 표기가 더 긴 가나 활용형의 일부인데 읽기가 다른 항목(예 `上手`) → 그 문장 한글 줄 숨김(틀린 읽기는 아님). 관리자 추가 항목에 따라 생길 수 있음 — 미리듣기에서 표시 결과를 보여 주는 것은 후속 후보.
- R2 교체 시 ruby 는 항목 읽기 그대로라 장음을 `ー` 로 적은 항목은 `じんぼーちょー` 처럼 보임, `ウ` 로 적은 항목은 한글 `우`(분석기 `ー` 대비) — 규칙 1(같음)이 분석기와 같은 소리면 막아 줌.
- R3 표시(분석기 복합어 유지)와 TTS(치환)가 갈리는 경우: `明日香` 을 TTS 는 `アシタ香` 로 읽음 — **기존 TTS 결함**(이번 범위 밖, 후속 IMP 후보: TTS 치환에도 같은 복합어 가드).
- R4 읽기 경로가 사전 DB 조회에 기대게 됨 — 30초 캐시·병렬·stale 대체로 지연·장애 전파 차단.
- R5 열린 화면의 브라우저 캐시는 새로 고침 전까지 옛 표시.

## Developer 기록
- [00:09] **체크포인트 — 설계 단계 완료(C1 대상).** 완료: 현재 경로 확인(TTS 사전 치환·읽기 캐시·gateway), 개발 venv 실험 3종((a) 프로토타입 코퍼스 2,389문장 · (b) 사용자 사전 cost 1/3000/6000 비교 · (c) 가타카나 치환 분절), 위 "설계안" 절 작성. 남은 일: judge C1 → (필요 시 Codex) → 구현 소환. 다음 첫 행동(구현자): `src/modules/speech/reading/lexiconOverlay.ts` 를 규칙 1~5 로 작성하고 픽스처를 개발 venv 로 뜬다(`scratchpad/.../t032/overlay2.py`·`run2.py` 참고 — 세션 스크래치라 사라질 수 있음, 규칙은 위 §3 이 정본). 주의점: 분석기 출력에 `read` 가 없으므로 "일치" 판정은 ruby 읽기+가나 표기로 재구성(ruby null·한자 포함 조각은 pron 비교만); 캐시 객체 제자리 수정 금지; 기존 reading 테스트가 DB 를 부르지 않게 로더 주입. 미커밋 파일: 이 이력서만(코드 0).
- [00:25] **체크포인트 — 구현 1차(코드·단위 테스트).** 완료: `speech/reading/lexiconOverlay.ts`(신규, 규칙 1~5·불변식) · `reading/index.ts`(사전 로드∥분석기, `deps.loadLexicon` 주입, 4번째 인자 `{ userId }`) · `tts/lexicon.ts` `loadLexiconForDisplay`(같은 30초 캐시·1초 상한·stale·환경별 단일 조회, 쓰기 0) · 라우트 1줄 · `reading.test.ts`(빈 사전 주입 23곳) · `readingLexicon.test.ts`(12건 통과) · 픽스처 `fixtures/readingLexiconSegments.json`(개발 venv `~/.node-local/thekaiwa-speech-dev/bin/python` + 실제 `kaiwa_gateway/text.py` annotate_one). 남은 일: 코퍼스 회귀(TS 구현)·변이 검사·전체 단위/tsc/eslint·gateway pytest·개발 미러 라이브 스모크·지연 측정. 다음 첫 행동: 스크래치 `t032impl/corpusSegments.json`(2,389문장 실분석 조각)으로 TS 덮어쓰기 회귀 스크립트 실행. 주의점: `今日は`=コンニチワ 같은 항목은 は≠ワ 라 루비 정렬 실패 → 루비 null·발음만(설계 §3 규칙대로). 미커밋: 위 7개.
- [00:28] **구현 완료 → Reviewer 인계.** 설계 §3 (a) 그대로(gateway·어댑터·서버 읽기 캐시 키·DB 스키마·화면·네이티브 무변경).
  - **변경 파일(8)**: 신규 `src/modules/speech/reading/lexiconOverlay.ts`(규칙 1 같음·2 교체(+뒤 조각 `particle`→`phrase`)·3 복합어 유지·4 가나 일치 유지·5 숨김, 불변식: surface 이어 붙임=원문·입력 무변경·예외→원본, `selectDisplayEntries`=GLOBAL+본인 USER) · `reading/index.ts`(사전 로드를 분석기와 병렬, 캐시엔 원본만·요청마다 덮어쓰기, `ReadingDeps.loadLexicon` 주입, 4번째 인자 `{ userId }`) · `tts/lexicon.ts` `loadLexiconForDisplay`(같은 30초 캐시·1초 상한·만료 뒤 실패/지연=직전 사전·최초 실패=null·환경별 진행 중 조회 1건·쓰기 0, `loadActiveLexicon` 무변경) · `app/api/v1/text/annotate/route.ts`(호출 1줄 `{ userId: s.user.id }` + 주석 1줄) · `__tests__/reading.test.ts`(빈 사전 주입 23곳) · 신규 `__tests__/readingLexicon.test.ts`(12건) · 신규 `__tests__/fixtures/readingLexiconSegments.json`(24문장, 실분석기 출력).
  - **실행 증빙**:
    - `npm run typecheck` → exit 0.
    - `npm run lint` → exit 1 이지만 오류 2건은 미러에만 있는 남의 임시 파일 `~/.node-local/thekaiwa/tmp-pe/t49.ts`(10-01, 저장소에 없음) — 저장소 동기화 범위 `eslint src prisma scripts` → **0 errors, 5 warnings**(기존 set-state-in-effect 5건, 변경 파일 0) exit 0.
    - 신규+기존 읽기 테스트 `node --import tsx --test readingLexicon.test.ts reading.test.ts` → readingLexicon **12/12**, reading 18/18.
    - 전체 단위 `npm test` → **# tests 1413 · pass 1412 · fail 0 · skipped 1**, exit 0.
    - gateway pytest(무변경 확인, 개발 venv) `python -m pytest speech/gateway/tests` → **86 passed**.
    - **코퍼스 회귀**(설계 때 2,389문장, 실분석기 조각 → TS 구현 `applyLexiconOverlay`): 시드 6건만 → 같은 참조 **2,389/2,389 · 바뀐 문장 0 · 새 숨김 0**(12.4ms 합계) / 시드+青か·愚か·密か → 바뀐 **102**(교체 94 + 숨김 8) · 숨김 8 = 전부 비문 템플릿 `…愚かかった`·`…密かかった` · 정상 문장 숨김 0(12.0ms 합계). 설계 실측(교체 94·숨김 8)과 일치.
    - **변이 검사 12/12 KILLED**(미러 사본에 하나씩 넣고 readingLexicon.test.ts 실행, 끝에 sync 로 원복): 경계 검사 제거 · 가나 일치 유지 제거 · 같음 규칙 제거 · 범위 필터 제거(전부 강제 적용) · 입력 제자리 수정 · 뒤 조각 경계 보정 제거 · stale 대체 제거 · 복합어(가나 아님) 유지 제거 · index 덮어쓰기 미적용 · userId 미전달 · 사전 조회 순차화 · 숨김 제거.
    - **실 gateway 스모크**(개발 미러 `~/.node-local/thekaiwa-dev-030` rsync·`diff -rq` 일치, `next dev 127.0.0.1:3023` + 개발 venv gateway `127.0.0.1:8197`(난수 내부 시크릿), `APP_ENV=LOCAL`; 운영 3010·8100·pm2·릴리스 무접촉): ① 라우트 #24r(QA_ACCOUNT=1 쿠키) 7문장 → 200·`available:true`, LOCAL ACTIVE v1(시드 6건만)이라 `青{せい}か`·`愚{ぐ}か`(항목 없음 = 기존과 같음)·`神保町{じんぼうちょう}`·`明日香{あすか}` 유지, 응답 엔진명 0 · QA2 쿠키 200 동일 · 쿠키 없음 401. ② 서버 경로(`annotateReadings` + 실 gateway + **실 DB LOCAL 사전 읽기** + 주입 항목): `赤か青か`→`赤{あか}か青{あお}か`·아까까 아오까 / `愚か。`→`愚{おろ}か。`·오로까. / `それは密か`→`密{ひそ}か`·소레와 히소까 / `上手い`(+上手=ジョウズ)→루비·한글 숨김 / 타 사용자 USER `赤=レッド` 미적용, 본인이면 적용 / `青か` enabled=false → 원복. **DB 쓰기 0**(사전 추가·끄기·Rollback 의 관리자 API 경로는 LexiconVersion 쓰기라 QA 라이브 §5 로 남김).
    - **지연**: 첫 사전 조회(냉, DB 연결 포함) 17.3ms — 분석기 호출과 병렬. `annotateReadings` 12문장 캐시 미스 p50(10회 교대): 사전 없음(이전 동작) **3.9ms** · DB 사전 캐시 적중 **3.6ms** · 30초 캐시 비운 냉 조회 **4.5ms**(+0.6ms). 라우트 #24r 12문장 캐시 미스 p50 **15.6ms**(12.4~25.6, n=10). 덮어쓰기 자체 2,389문장 ≈12ms(문장당 ~5µs).
    - 엔진명 grep(변경 3개 소스 파일: reazon·whisper·style-bert·sbv2·openjtalk·claude·gateway·speaker_id·model_id) → 0건.
  - **정리**: 3023·8197 listener 0 · 미러 `.env`·쿠키 2개·내부 시크릿 shred · 미러 `scratch/t032` 삭제 · 개발 미러 `thekaiwa-dev-030` src 는 현재 NFS 와 같음(보존).
  - **Reviewer 중점**: (1) `lexiconOverlay` 규칙 1~5 판정식 — 특히 `sounds()` 가 발음 또는 재구성 읽기 중 하나만 맞아도 "같음/일치"(神保町 ジンボーチョー vs じんぼうちょう) (2) 교체 후 `particle→phrase` 보정 (3) 캐시 객체 불변(splice 는 `segments.slice()` 사본에만) (4) `loadLexiconForDisplay` 의 진행 중 조회 공유·타임아웃·stale·`clearLexiconCache` 와의 경쟁(커밋 직후 늦게 끝난 옛 조회가 캐시를 다시 채울 수 있음 — 기존 `loadActiveLexicon` 과 같은 수준, ≤30초) (5) 라우트 userId = 세션 사용자(타 사용자 USER 미적용) (6) speech 내부 `reading → ../tts/lexicon` import(같은 L4 내부, voices/preview 와 같은 방식).
  - **QA high_risk 후보**: 관리자 API 로 LOCAL(비운영) 환경 GLOBAL·USER 항목 추가→#24r 반영→끄기·Rollback→다음 요청 원복(다른 프로세스 ≤30초) · PRODUCTION 사전 무영향 · 타 사용자 USER 항목 비노출 · `上手` 류 활용형 충돌 시 한글 줄 숨김(틀린 읽기 0) · 화면 첫 읽기 지연 전후 · 응답·로그 엔진명 0 · 테스트 데이터 원복(버전은 새 버전으로만 되돌릴 수 있음 — 남는 버전 행 수 기록).
  - 미커밋: 위 8개 파일 + 이 이력서. 커밋·push·배포 안 함.

## Reviewer 기록

- **REV-103 — PASS_WITH_NOTES (standard 트랙, 2026-10-05)** · Critical 0 · High 0 · Medium 0 · Low 5 · native_change false. 코드 수정 없음(Read 전용). 7영역 검토 완료. 재실행: `npm run typecheck` exit 0 · 개발 미러 `node --import tsx --test readingLexicon.test.ts reading.test.ts` → 30/30 pass · `npm test` 전체 → tests 1413 · pass 1412 · fail 0 · skipped 1(Developer 증빙과 동일) · `eslint src/modules/speech src/app/api/v1/text` → 출력 0(오류·경고 없음). 추가로 미러에 임시 프로브 테스트를 넣어 적대 사례 17건 실행 후 삭제(미러 `zzprobe` 잔존 0).
- **중점 판정**
  1. 5분기: 틀린 읽기를 통과시키는 경로 없음 확인. `sounds()` 의 OR(발음 또는 재구성 읽기)는 둘 다 같은 분석기 노드에서 나와 표기 규약(ー·ワ·オ)만 다르므로 "같은 소리" 판정으로 안전(발음이 맞으면 한글 줄이, 읽기가 맞으면 후리가나 줄이 이미 항목과 같다). 프로브: `それは`=ソレハ→분석기 ソレワ 유지 / `赤か青`+`か`→전부 숨김(한글 줄 null) / `赤か青か` 두 항목 동시 교체(오른쪽부터 splice)→번호 어긋남 없음 / `今日は`=コンニチハ 교체 시 뒤 조각 `particle→phrase` 로 한글 줄 정상. 오른쪽부터 처리·정확 경계 때문에 두 매칭이 같은 조각을 공유해 splice 가 꼬이는 경로는 없다(교체는 매칭 경계=조각 경계일 때만). 조사 경계 보정은 `boundary`=이 조각 **앞** 구분(client.ts:28 주석·text.py:317)이라 방향이 맞고 030 `particleMark`(조각 자체 표기 を·へ + pron)·031 장음 규칙(pron 문자열 기반)과 충돌하지 않는다(교체 조각은 표기가 を·へ 하나가 아니다).
  2. 캐시 객체 불변: `segments.slice()` 사본 + 교체/숨김은 새 객체(`{...out[i]}`·`{...next}`), 원본 ruby 배열 재사용 없음. 테스트 deep-freeze 통과. 합 불일치 시 원본 반환.
  3. `loadLexiconForDisplay`: 쓰기 0, 환경별 캐시·진행 조회 분리, 소유자 필터는 `selectEntries({userId})` 라 타 사용자 USER·VOICE·LESSON·COURSE 누출 0(문맥 id 가 userId 하나뿐), 로그는 종류(`e.name`)만. 1초 타임아웃·직전 사전·최초 null 동작 확인. 아래 L-1(늦은 옛 조회·진행 조회 공유).
  4. 라우트: `requireSession()` 선행(401 유지)·`userId=s.user.id` 만 넘김(요청 본문에서 userId 안 받음)·`Cache-Control: private, no-store` 유지. 응답에 엔진명 0.
  5. 6층: `reading → ../tts/lexicon` 은 같은 L4 내부 상대 import. eslint `src/modules/speech/**` 경계(상위 층·타 모듈 금지)에 맞고 lint 0. `reading/client.ts` 순수성(import 0)·클라이언트가 `reading/client` 만 쓰는 구조 그대로 — 서버 파일이 prisma 를 끌어오는 일은 `reading/index.ts`(서버 전용)에 한정. `speech/index.ts` 공개 API 는 `annotateReadings` 시그니처만 확장(4번째 선택 인자).
  6. 엔진명 grep(`lexiconOverlay.ts`·`reading/index.ts`·route) 0건. 로그에 사전 내용·사용자 데이터 없음(건수·종류만, 기존 `[reading]` 형식).
  7. "틀린 것보다 없음": 충돌은 숨김, 경계 밖 한자는 분석기 우선 유지, 정렬 실패는 루비 null + 발음만. 아래 L-4 만 예외 성격.
- **지적**

| ID | 심각도 | 위치 | 내용·근거 | 권고 |
|---|---|---|---|---|
| L-1 | LOW | `src/modules/speech/tts/lexicon.ts:191,206-216` | `displayInflight` 가 `clearLexiconCache()`(커밋 직후 호출)로 비워지지 않는다. 관리자가 사전을 게시하는 순간 진행 중이던 옛 조회가 있으면 커밋 후 첫 읽기 요청이 그 옛 조회에 합류해 옛 사전을 받고 캐시를 다시 채울 수 있다(쓴 프로세스 ≤30초, DB 정상이면 조회가 ms 단위라 창이 매우 짧음). 기존 `loadActiveLexicon` 도 같은 종류의 경쟁이 있어 신규 악화는 미미. 또 DB 장애 중에는 stale 이 만료 없이 계속 쓰여 Rollback 이 반영되지 않는다(복구 시 자동 해소). | `clearLexiconCache()` 에서 진행 조회도 버리거나(세대 번호 비교) 현 상태를 `lexicon.ts` 주석에 명시. 비차단. |
| L-2 | LOW | `lexiconOverlay.ts:43-57`(`sounds`) | 항목 읽기가 조사 표기 그대로(`ハ`·`ヲ`·`ヘ`)인 경우 `それは`=`ソレハ` 처럼 재구성 읽기(ハ)가 맞아 "같음"으로 유지되어 화면은 분석기의 ソレワ(조사 발음), TTS 는 사전 치환대로 ソレハ — 표시와 소리가 갈린다. 화면이 더 자연스러운 쪽이라 해악은 없고 관리자 입력 규약 문제. | 관리자 사전 안내 문구에 "조사 は 는 ワ 로 적는다" 정도(선택, designer/Leader). 코드 변경 불필요. |
| L-3 | LOW | `lexiconOverlay.ts:59-62`+`client.ts alignWordRuby` | 교체 조각의 루비는 `alignWordRuby` 의 "한자 묶음 최단 우선" 정렬이라 읽기에 가나가 반복되는 다중 한자 표기에서 묶음별 후리가나 분할이 어색할 수 있다(프로브: 항목 `赤か青か`=アカアオカ → `赤{あ}か青{あお}か`; 합치면 읽기는 맞음). 정렬이 모호할 때도 null 이 아니라 첫 해를 쓴다. 실사용 항목(青か·愚か·密か) 은 정확. | 후속 후보 — 정렬이 둘 이상 가능하면 루비 null(발음만). 이번 범위에선 비차단. |
| L-4 | LOW | `src/modules/speech/tts/lexicon.ts:103-107` ← `lexiconOverlay.ts:72` | `findLexiconMatches` 가 문장마다 첫 글자 인덱스·정렬을 새로 만든다(요청당 최대 64문장 × 항목 수). 현재 항목 수(시드 6 + 소수)에서는 코퍼스 2,389문장 ≈12ms 라 무시 가능하나 사전이 수천 건으로 커지면 요청당 수십 ms. | 후속 후보 — 요청당 인덱스 1회 생성 후 문장 간 공유. 비차단. |
| L-5 | LOW (문서) | `docs/design/{api-contract #24r, speech-platform/16 §2, module-dependency}` | 정본 3곳에 사전 반영·`reading → tts/lexicon`(같은 L4) 문구가 아직 없다(Leader 몫으로 이력서에 예고됨). 코드와 정본 어긋남 상태. | Leader 가 배포 전 반영. |

- **테스트 갭(비차단)**: 조사 표기 그대로 항목(L-2)·다중 한자 정렬 모호(L-3) 케이스 단위 테스트 없음. `clearLexiconCache` 와 진행 조회 경쟁 테스트 없음(L-1).
- **QA high_risk_areas**
  1. 관리자 API 로 LOCAL(비운영) GLOBAL `青か/アオカ`·`愚か/オロカ`·`密か/ヒソカ` + USER 항목 추가 → `/api/v1/text/annotate` ruby·pron·한글 줄 반영 → 끄기·Rollback → 다음 요청 원복(같은 프로세스 즉시·다른 프로세스 ≤30초). 테스트 항목은 새 버전으로만 되돌릴 수 있으니 남는 버전 행 수 기록.
  2. 소유자 격리: 사용자 A 의 USER 항목이 사용자 B 응답에 미적용(QA 계정 2개), 쿠키 없음 401.
  3. 환경 분리: PRODUCTION ACTIVE 사전 무영향·LOCAL 항목이 운영 응답에 안 나옴.
  4. 활용형 충돌 숨김: `上手`=ジョウズ 추가 시 `上手い` 문장은 한글 줄·후리가나 숨김(틀린 읽기 0), `上手な人`·`青かった` 는 유지.
  5. 복합어 가드: `明日`(시드)와 `明日香さん` → あすか 유지.
  6. 사전 조회 지연·장애 시 읽기 응답이 1초를 넘지 않고 `available` 값 불변(가능하면 사전 조회 실패 주입).
  7. 첫 화면 읽기 지연 전후(p50, Developer 실측: 사전 없음 3.9ms → 캐시 적중 3.6ms·냉 4.5ms)·응답·로그 엔진명 0·테스트 데이터 원복.
  8. 030(장음 뒤 へ)·031(経営 장음) 한글 줄 회귀: 사전이 비어 있거나 시드만일 때 이전과 같은 출력.
- 판정 근거: Critical 0·High 0 → 기준상 PASS. 노트 5건(전부 LOW)은 QA 진행을 막지 않는다. Codex: judge C2 판정 대기(이 감사는 Codex 결과 없이 완료 — 기준 불변).

## QA 기록

- **판정: PASS (결함 0건)** · 2026-10-05 · QA · 환경 = 개발 미러 `~/.node-local/thekaiwa-dev-030`(NFS src diff 0) + `next dev 127.0.0.1:3024`(APP_ENV=LOCAL) + 개발 venv gateway `127.0.0.1:8198`. 운영 3010·8100·`/home/brownjeon/apps/thekaiwa`·PRODUCTION 사전 무접촉. 코드 수정 없음(`tests/live/task032-qa.ts`·`task032-qa2.ts`·`task032-ui.mjs` 점검 스크립트 3개만 추가).
- **체크리스트(전부 직접 실행, 원 출력)**

| # | 항목 | 판정 | 근거(실행·핵심 출력) |
|---|---|---|---|
| 1 | GLOBAL 青か 추가→반영→끄기→Rollback 원복 | PASS | `task032-qa.ts`: 추가(v2) `赤{あか}か青{あお}か`·한글 `아까까 아오까` / 愚か·密か 추가 `愚{おろ}か。`(오로까.)·`それは密{ひそ}か`(소레와 히소까) / 青か 끄기(v5) → `赤{あか}か青{せい}か`(愚か 유지) / 되살림(v6) 재적용 / Rollback(v1)→새 v7 → 3문장 전부 분석기 원본(`愚{ぐ}か。`·`密{みつ}か`). 같은 서버 프로세스는 다음 요청에 즉시 반영 |
| 1b | 다른 프로세스 ≤30초 | PASS | `task032-qa2.ts` A: 서버가 항목 추가 직후 별도 프로세스(자기 30초 캐시)는 옛 사전 `青{せい}か`, **30.0초 뒤** `青{あお}か` 반영(설계대로) |
| 2 | USER 격리 | PASS | A(qa-bot)의 USER 青か → A=`青{あお}か`, B(qa-bot2)·admin 계정=`青{せい}か`, B 가 본문에 `userId`·`scopeRefId`=A 를 실어도 미적용(라우트가 본문 userId 안 읽음). USER 항목 끄기 → A 도 원복 |
| 3 | 활용형 충돌 | PASS | `上手`=ジョウズ: `上手い` → ruby `上手い`(후리가나 없음)·한글 줄 null·pron null(숨김), `上手な人` → `上手{じょうず}な人{ひと}`(죠-즈나 히또) 유지, `上手です` 유지, `青かった` → `青{あお}かった`(아오깟따) 유지. 재요청에도 동일(캐시 객체 오염 0) |
| 4 | 복합어 | PASS | 시드 `明日`=アシタ 상태에서 `明日香さん` → `明日香{あすか}さん`·아스까상, `明日` → あした. (qa.ts 4a 는 내 정규식 오타 `아스카` 로 한 번 FAIL 표기 — 출력은 정답, 스크립트 `아스까` 로 정정) |
| 5 | 030·031 한글 불변 | PASS | 시드만(라이브): 先生へ `센세-에`·家へ `이에에`·経営 `케-에-`·通り `토-리`. 青か·上手 항목이 더 있어도 동일. 최종 Rollback 뒤 14문장 ruby·한글 전부 기준선과 동일(diff 0). 빈 사전: 단위 `reading.test.ts`(빈 사전 주입 23곳) 통과 — 라이브 빈 사전은 시드 6건을 끄지 않아 미실행 |
| 6 | 사전 조회 장애·지연(별도 프로세스, `prisma…findFirst` 가로채기, 실 gateway) | PASS(관찰 1) | 3초 지연: 응답 **1001ms**·available=true·원본 / 진행 조회 합류 재요청 1000ms / 늦은 조회 완료 뒤 1ms / 즉시 실패 **3ms**·원본 / 캐시 만료+실패 → 직전 사전 적용 2ms / 만료+3초 지연 → 직전 사전 적용 1001ms. 관찰: 사전 DB 가 느리면 요청마다 상한 1.0초가 붙는다(설계값) |
| 7 | 응답·로그·401·429 | PASS | 읽기 응답 15건 전체에 엔진명(reazon·whisper·style-bert·openjtalk·claude·model_id·speaker_id·sherpa)·`lexicon|dictionary|snapshot|reason|QA-032` 0건 / 서버 로그에 엔진명·사전 본문(アオカ·青か) 0건(상태 줄만) / 쿠키 없음 401 UNAUTHENTICATED / 입력 검증 400 / 61번째 요청 429 `retry-after: 60` |
| 8 | 단위·타입·린트 | PASS | `npm run typecheck` exit 0 · `npm test` exit 0 → **tests 1413 · pass 1412 · fail 0 · skipped 1** · eslint(`src/modules/speech`·`src/app/api/v1/text`·QA 스크립트) exit 0 · gateway pytest 86 passed(무변경 확인) |
| 환경 | PRODUCTION 무영향 | PASS | DB 읽기: PRODUCTION 버전 1행·ACTIVE v1·활성 항목 6(시드) 전후 동일, 青か·愚か·密か·上手 0건, PRODUCTION lexicon 감사 행 0 |
| 지연 | 첫 화면 읽기 | PASS | `annotateReadings` 12문장 캐시 미스(n=12 교대) p50: 사전 없음 **2.8ms**(p95 4.2) · 사전 캐시 적중 **2.5ms**(p95 3.1) · 사전 냉 조회 **3.1ms**(p95 4.2) — 악화 없음 |
| 화면 | 채팅방 青か (Playwright 실 Chrome) | PASS | 360/390/412, DPR 2.625, ko-KR·Asia/Seoul, light, 모션 축소, 폰트 로딩 대기, 채팅 GET 응답의 마지막 강사 말만 `赤か青か、どっちがいいですか？` 로 치환(DB 변경 0). 3폭 모두 annotate 200, ruby `赤{あか}青{あお}`, 한글 줄 `[아까까 아오까, 돗찌가 이-데스까?]`, scrollWidth=clientWidth(360/390/412), 폭 넘침 요소 0. 390 스크린샷 육안: 후리가나·한글 줄 정상. 화면 코드 무변경이라 터치 44px·safe-area 등 그 밖 3폭 항목은 NOT_VERIFIED(범위 밖) |

- **지표**: 읽기 p50 2.5~3.1ms(캐시 미스 12문장), 사전 지연 시 상한 1.0초, 다른 프로세스 반영 30.0초. 회화 30턴·단어 세트·평가 기록률은 이 task 범위 밖.
- **테스트 데이터 원복**: LOCAL 사전 ACTIVE v20 = 활성 항목 시드 6건(日本橋 秋葉原 御徒町 神保町 等々力 明日)로 Rollback 완료. **LOCAL 버전 행 1 → 20(+19, 감사 19행과 1:1 — 불변 이력이라 삭제 안 함)**, 항목 표에 비활성(enabled=false) 행 5개(青か GLOBAL·USER, 愚か, 密か, 上手) 잔존 — 개발 LOCAL 데이터이며 읽기 응답에 영향 없음. PRODUCTION 변경 0.
- **관찰(결함 아님, 비차단)**: (O-1) 사전 조회가 **영원히** 끝나지 않으면(Prisma 타임아웃이 안 걸리는 가정) `displayInflight` 가 그 약속을 계속 들고 있어 이후 요청이 전부 1초씩 기다리고 사전을 못 쓴다 — 실환경은 DB 드라이버 타임아웃이 있어 비현실적(REV-103 L-1 과 같은 계열). (O-2) 사전 DB 지연 시 읽기 응답이 정확히 ≈1.001초라 "1초 내"는 경계값.
- **육안 확인 필요(실기기)**: 해당 없음(화면 무변경·네이티브 무변경, 웹 배포만). 배포 인계 시 `post_deploy_checks`: `/api/health` status=ok, 360/390/412 채팅방 후리가나·한글 줄 확인, 관리자 사전에 青か 추가→읽기 반영은 PRODUCTION 은 SUPER_ADMIN confirm 후 사용자 몫.
- **산출물 정리**: /tmp/qa-artifacts/TheKaiwa/task-032 삭제(스크린샷·로그·쿠키 4개 shred). **프로세스 정리**: dev 3024·gateway 8198 종료·포트 비움(`ss -ltn` 확인), 미러 `.env` 사본 shred, 운영 3010·8100 은 그대로 리슨. 추가 파일: `tests/live/task032-qa.ts`·`task032-qa2.ts`·`task032-ui.mjs`(미커밋).

## Deployer 기록

- **배포 실행 (2026-10-05 00:50~05:39, 표준 배포 경로)**: `scripts/deploy.sh TheKaiwa --yes`
  - Pre-deploy: git status 청결(ahead 0) ✅ · branch main ✅ · sync-local ✅ · dry-run 계획 확인 ✅
  - 배포 결과: RELEASE_RESULT `{"status":"ok","release":"20261005-005038-2a90f567","sha":"2a90f567dcb13ffd6cb5dec44b3ad1e16893e93d","previous":"…20261005-005001-2a90f567","migrated":false}` ✅
  - 앱 3개 reload 완료 (thekaiwa·thekaiwa-speech-gateway·thekaiwa-speech-worker) ✅
  
- **Post-deploy checks**:
  1. `/api/health` (운영 127.0.0.1:3010): **env=PRODUCTION · status=ok · degraded=[] · checks.db/env_*/llm/stt_gateway/stt_analysis*/tts 모두 true** ✅
  2. Task006 스모크 (단어·채팅·회화): **42/42 PASS** ✅ (p50=4743ms)
  3. Task007 스모크 (AI평가·음성·발화): **45/45 PASS** ✅
  
- **배포 영향**: 웹(app 서버) 변경만. DB 스키마·음성 gateway·M4 tts·네이티브 변경 없음. `--with-migrate` 미사용 · APK 불필요 ✅

## 최종 요약 (Leader, 2026-10-05 01:00)

**무엇이 바뀌었나** — 관리자 발음 사전(지금까지 TTS 전용)이 화면의 히라가나·한글 읽기 줄에도 적용됩니다.
- 분석기가 잘못 나누던 `青か`·`愚か`·`密か` 같은 표현을 사전 항목으로 고칠 수 있습니다(`赤か青か` → 아까까 아오까).
- 적용 범위는 전체(GLOBAL) + 본인(USER) 사전(사용자 결정). 다른 사람 사전은 섞이지 않습니다.
- 사전과 읽기가 충돌하는 활용형(`上手`=じょうず vs `上手い`)은 그 부분 읽기 줄을 숨깁니다(사용자 결정, "틀린 것보다 없음").
- 사전을 끄거나 롤백하면 다음 요청부터 원래 읽기로 돌아옵니다(다른 서버 프로세스는 최대 30초).
- 음성 gateway·DB·화면 코드는 바꾸지 않았습니다.

**검증 경로** — judge intake(feature·R1·standard·opus·데모 없음) → 설계(developer, 안 (a) 앱 후처리, 2,389문장 실험) → 사용자 결정 2건 → judge C1(Codex 불필요) → 구현(opus) → **REV-103 PASS_WITH_NOTES**(Low 5) → judge C2(Codex 원했으나 한도 값 미갱신으로 보류 `CX-limit-unknown-hold`) → **QA PASS(결함 0, 8항목 실행·3폭 화면 확인)** → 배포. 정본 3곳(api-contract #24r · speech-platform/16 §2.4a · module-dependency) Leader 갱신.

**배포** — 코드 `afde949`·문서 `2a90f56`, 릴리스 `20261005-005038-2a90f567`(웹훅·수동 같은 sha 2회, `RELEASE_RESULT ok`), health ok·PRODUCTION, 운영 스모크 **채팅 42/42 · 회화 45/45**. 웹 배포만 — 앱 재설치 불필요.

**남은 것(비차단)** — REV-103 L-1 사전 저장 직후 진행 중 조회가 옛 사전으로 캐시를 다시 채울 수 있음(최대 30초)·DB 장애 시 직전 사전 무기한 유지 / L-2 조사 문자 그대로 적은 항목(それは=ソレハ) 관례 / L-3 긴 항목 루비 분할 첫 후보 / L-4 사전 수천 항목 시 색인 재구성 비용 / QA O-1·O-2 사전 DB 지연 시 1.001초 경계. LOCAL 사전에 QA 비활성 항목 5개·버전 v20 남음(읽기 영향 없음). 범위 밖: TTS 가 `明日` 항목 때문에 `明日香` → アシタ香 로 읽음(후속 후보). Codex 한도 값(`/status`) 미갱신 — 사용자가 알려 주면 `set-limit` 기록.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-04 23:39 |
