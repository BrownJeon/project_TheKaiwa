---
task_id: task-074
role: reviewer
title: "task-074 서버 부분 reviewer 기록 — REV-074S (즐겨찾기 칸·#182/#183·목록 favorite 필터)"
tags:
  - type/task-record
  - domain/vocab
created: 2026-10-18
---

# REV-074S — task-074 서버 독립 감사 (Reviewer 기록)

이력서 [[task-074-improve-word-favorites]] · developer 기록 [[task-074-dev-server-record]] · 미러 `~/.node-local/thekaiwa-rev074s`

## 진행 (발견마다 덧붙임)
- [00] 기록 파일 생성. 이력서·developer 기록 읽음.
- [01] 중간 기록 — 코드·시험·문서 읽기 완료, 미러 `thekaiwa-rev074s`(cp -al → .next 삭제 → `src`(components 제외)·`tests`·`prisma` rsync, `package.json` 동일) 준비. `tsc --noEmit --incremental false` **exit 0**(공유 하드링크 `tsconfig.tsbuildinfo` 링크 수 33 이라 제자리 쓰기를 피해 incremental off) · `eslint src/modules/learning src/app/api/v1/words src/types` **exit 0**(출력 0) · learning+routes 시험 **633 중 통과 631·실패 0·건너뜀 2**(R5 계약 대조는 미러에 docs 가 없어 건너뜀 → 저장소 경로로 따로 실행 예정) — 전체 시험·build 는 계속 진행 중.
- [02] 읽기 결과(아직 판정 전, 근거 있는 것만):
  - **격리 [확실]**: 상태 읽기·쓰기 경로 전부 `(요청자 userId, wordId)` — `favoritedBy`(`some:{userId,favorite:true}`)·`loadWordStates`(where userId)·`setWordFavoriteTx` upsert key `userId_wordId`. 가시성 검사(`visibleWordWhere`)가 잠금 뒤·상태 쓰기 앞에 있어 남의 내 단어는 404(존재 노출 없음, `isValidId` 실패도 404).
  - **상태 행 upsert 하는 다른 곳**: `bumpWordStates`(세트 끝내기)는 `createMany(skipDuplicates)`+`updateMany` 로 카운터·`lastSeen*` 만 건드려 `favorite` 를 덮지 않음(코드로 확인). `scripts/migrate-seed-copies.ts` upsert 는 `favorite` 를 쓰지 않음(create 는 DB 기본값 false) — 일회성 이관이고 사본 0(task-068) 이라 무해.
  - **`favorite=0` = 조건 없음** 은 화면 계약(§32 D1: 「전체」 칸은 `favorite` 를 아예 안 보냄)과 맞고, `archived=0`(= 보관 아님만)과 **비대칭**이라는 점은 api-contract #40 에 명시돼 있음. 아래 판정 참고.

## 판정 — **PASS_WITH_NOTES** (REV-074S)

```json
{ "reviewId": "REV-074S", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 0, "medium": 2, "low": 5 }, "native_change": false }
```

불편한 사실부터: **서버 코드 결함은 찾지 못했다. 찾은 것은 전부 「시험이 이 결함을 잡지 못한다」는 공백이다.** developer 변이 16/16 포착이라는 숫자는 정확하지만, 그 16개는 「별 기능의 직접 고장」에 몰려 있고, 별을 **우연히 덮어쓰는 이웃 코드**(세트 끝내기)와 **정렬 × 별 조합**에는 방어선이 없다. 내가 넣은 변이 16개 중 5개가 생존했다. 코드를 읽고 별도 동작 탐침(P1·P2)으로 현재 코드는 맞다는 것을 확인했으므로 FAIL 사유는 아니다([확실]). 다만 Medium 2건은 QA 가 실제 DB 로 보완 확인해야 한다.

### 지적 표
| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | Medium(시험 공백) | `wordState.ts:105-107` `bumpWordStates` ↔ 시험 | 세트 끝내기(오늘의 단어 채점)가 `updateMany` 의 `data` 에 `favorite:false` 를 끼워 넣어도 **어떤 시험도 실패하지 않는다**(변이 V3 생존, learning+routes 전체 633개 실행). 현재 코드는 카운터·`lastSeen*` 만 쓰므로 맞다 — 코드 읽기 + 탐침 P2(켜기 → 채점 → 보관 → 되돌리기 → `favorite=1` 목록에 둘 다 남음) 통과 | `task068WordState.test.ts` 의 bump 시험 행에 별이 없다. 이 기능의 핵심 회귀 위험(「채점하면 별이 사라진다」)을 지키는 시험이 없음 | bump 시험 픽스처 상태 행에 `favorite:true, favoritedAt` 을 두고 bump 전후 값 유지 단언 추가(맞힘·틀림·건너뜀 3경로) |
| M-2 | Medium(시험 공백) | `task074Favorite.test.ts` F8 | F8 의 기대값이 **같은 코드의 출력**(`favorite=0` 결과 ∩ 내 별)이라 `sort=wrong` 에서 별 아닌 틀린 단어가 섞여도 못 잡는다(V4b 생존: 앞 묶음만 `favorite` 조건 제외). 더 나아가 `wrongSegment` 가 **모든 필터**를 무시해도 생존(V4) — task-068 때부터 있던 공백이지만 F8 이 「조합 전부」라고 주장하는 영역이다. 현재 코드는 맞다(탐침 P1: 틀린 별 아닌 단어 `b1` 제외, 틀린 별 `a1` 이 앞, `total` 2) | F8 픽스처에서 틀린 단어(`b3`·`a2`)가 둘 다 별이라 반례가 없음. 「즐겨찾기 칸 + 많이 틀린 순」은 실제 사용자가 만들 수 있는 조합 | F8 에 별 아닌 틀린 단어를 하나 두거나 `sort=wrong` 용 독립 기대값 시험 1개 추가(P1 을 그대로 시험으로 승격 가능) |
| L-1 | Low | F4 (`task074Favorite.test.ts:117-126`) | 잠금 순서 단언이 `lock < upsert` 뿐이라, 잠금을 **상태 읽기 뒤**로 옮겨도 통과(V8 생존). 그 순서면 두 연타가 모두 `cur=null` 을 읽고 둘 다 켜기를 쓴다(유니크 충돌은 아니지만 `favoritedAt` 이 늦은 쪽으로 갱신 → 멱등 위반) | 가짜 DB 는 동시성이 없어 직접 재현 불가 | `lock:user` 가 첫 `state:findUnique` 보다 앞서는지로 단언 강화(한 줄) |
| L-2 | Low | `schema.prisma` `@@index([userId, favorite])` | 색인 한 줄을 지워도 시험 통과(V9). 스키마·DB 는 Leader 가 실제 diff 로 확인했으므로 지금은 맞다 | `favorite=1` 목록이 색인을 실제로 타는지는 코드로 못 본다(Prisma `some` → `id IN (SELECT wordId … userId=? AND favorite=1)`, [가능성 높음]) | QA EXPLAIN(high_risk 3). 단어 7.8천·별 수십 규모라 어느 쪽이어도 체감 위험은 낮다 [추측] |
| L-3 | Low(설계 메모) | `words.ts` `parseWordListQuery` | `favorite=0` = **조건 없음** 이 `archived=0`(= 보관 아님만)과 비대칭. 화면 계약(§32 D1: 「전체」 칸은 `favorite` 를 **아예 안 보냄**)과는 맞고, api-contract #40 에 「즐겨찾기 아닌 것만이 아니다」로 명시돼 있어 **결함 아님**. 이름이 함정이라는 점만 남긴다 | F1 이 `favorite=0`·빈 값·없음 → false 를 고정. F8 이 `all` 에 별이 섞이는 것을 암묵 검증 | 유지. 나중에 「별 아닌 것만」이 필요하면 새 값(`favorite=none` 등)으로 추가 — 0 의 뜻을 바꾸지 말 것 |
| L-4 | Low(문서) | `api-contract.md:981` · `words/route.ts` GET/`[id]/route.ts` PATCH JSDoc · `wordState.ts:74-76` | ① #40 오류 요약 행이 `favorite` 를 안 나열(`archived`·`sort` 도 원래 없음) ② 두 라우트 JSDoc 이 `favorite`/별 read_only 를 언급 안 함 ③ `loadActiveWordStates` 주석 「상태 행은 본 적 있는 단어에만 있으므로」는 이제 사실이 아님(별만 켠 단어도 행이 있다). **동작 영향 없음**: 두 호출처가 `states.get(id) ?? EMPTY` 로 값만 쓴다(`sessions.ts:162`, `materials.ts:111`) | grep 으로 확인 | 문구 보정 |
| L-5 | Low | `types/vocab.ts` · `setWordFavoriteTx` | `WordEntry.favorite?` 옵션(D-e) — 화면은 `=== true` 로만 읽어야 한다(화면 감사에서 확인). 화면 픽스처 정리 뒤 필수로 승격 권고. 또한 `lockUserRow` 반환값(사용자 행 없음)을 무시 — 세션은 있는데 User 행이 없으면 FK 로 500; 보관 라우트와 동일한 선례라 이번 범위에서 고치지 않음 | — | 화면 단계에서 확인 / 별도 정리 |

Critical 0 · High 0 · Medium 2 · Low 5.

### 관점별 결과
1. **사용자 격리 [확실]**: 읽기는 `favoritedBy`(`some:{userId,favorite:true}`)·`loadWordStates`(`where userId`)·`getWordDetail`·`updateWord`·`createWord(linkBaseDuplicate)` 모두 요청자 기준, 쓰기는 `upsert` key `userId_wordId` 하나. 가시성 검사(`visibleWordWhere`)가 잠금 뒤·쓰기 앞이라 남의 내 단어·없는 id·빈 id·41자 id 는 404(존재 노출 없음). 기본 단어 공용 행(`WordEntry`)은 변경 0(F3 이 `JSON.stringify(words)` 전후 동일). 변이 V7(`loadWordStates` userId 제거)·V12 가 killed.
2. **목록 필터**: `favorite=1` 이 archived·source·chunkType·q·category 와 AND, `total`·`pages` 필터 반영, `baseTotal` 불변 — F8 이 3×2×4×2×2×3=288 조합을 `limit=1` 쪽 이어붙이기까지 확인하고 변이 V5·V6·V10·V15 killed. 잘못된 값 400(`2`·`true`·`01`·공백·`1,0`…). `favorite=0` 은 L-3. 실행계획은 QA 몫(L-2).
3. **#182·#183**: 멱등(두 번 켜기 `favoritedAt` 유지, 행 없는 끄기는 행 생성 0), 켤 때만 새 시각·끌 때 null(V11 killed), 응답 = 보관과 같은 `WordEntry` 전체(`userId`·`seedKey` 없음 — R2), `await requireSession()`(늦게 풀리는 세션으로 R2~R4 가 검증), 한도 없음은 보관 라우트와 같고 인증+가시성+멱등이 방어선. 잠금 = `SELECT id FROM User WHERE id=? FOR UPDATE` 를 `prisma.$transaction`(ReadCommitted, maxWait 5s, 15s 타임아웃) 안에서 — 커밋·롤백 시 자동 해제(누수 없음), `withTransaction` 이 데드락·직렬화 오류만 2회 재시도하고 연산이 멱등이라 재시도 안전. 같은 사용자의 다른 쓰기(채팅·세트 끝내기 등 36곳)와 직렬화되는 비용은 보관과 동일.
4. **`WordEntry` 를 돌려주는 곳**: developer 표를 `grep toWordDto|withStates|loadWordStates|WORD_STATE_FIELDS|archivedAt` 로 재검증 — 사실이다. 응답 생산지는 `toWordDto` 한 곳(목록·생성·채택연결·상세·수정·보관·별), `archived` 를 싣는 모든 곳에 `favorite` 가 같이 실린다(빠진 곳 0). 단어 세트 카드·평가 재료·#46 분류 개수는 의도적으로 제외(L6·D6). #43 이 `favorite`·`favoritedAt` 를 `400 read_only` 로 거절하는 것은 `archived`·`jlpt` 선례와 같은 처리(`unknown_key` 도 400 이라 기존 화면 영향 0), `#41` POST 는 모르는 키라 `unknown_key` 400 — 대량 할당 경로 없음. 옵션 타입의 부작용은 L-5.
5. **6층·보안·운영**: 라우트 2개는 `@/modules/infra`·`@/modules/learning` index 만 import, 하위→상위 import 없음, 엔진명·model_id 문자열 0(`grep` 0건), 에러 메시지는 `단어를 찾을 수 없어요.` 뿐. 상태 행을 쓰는 다른 곳: `bumpWordStates`(`createMany skipDuplicates` + `updateMany` 카운터·`lastSeen*`, `favorite` 미접촉), 일회성 `scripts/migrate-seed-copies.ts`(upsert 가 `favorite` 를 안 씀, create 는 DB 기본값 false, 사본 0 이라 무해), 삭제 cascade(단어 삭제 시 상태 함께 — F6). 단어·사용자 삭제 외에 별을 지우는 경로 없음. 옛 코드(task-072)가 새 칸을 모른 채 보관 upsert 하는 것은 새 칸에 영향 없음(블루/그린 겹침 안전).
6. **시험의 질**: 동작 시험이다(가짜 DB 위에서 진짜 `learning`·진짜 라우트·`withApi`·실제 세션 Promise). 아래 변이 표 참고 — 격리·멱등·AND·total·보관 독립은 잘 잡고, 이웃 코드 덮어쓰기(M-1)·정렬 조합(M-2)·잠금 순서(L-1)·색인(L-2)은 못 잡는다.
7. **문서**: `domain-model.md`(칸 2·색인 1·주석)와 `api-contract.md`(#40 쿼리·`favorite` 의미, #182·#183 행, §2-9 칸 설명, #43 read_only, #45 별 유지)가 코드와 일치. 번호 #182·#183 충돌 없음(R5 + T25 가 `KAIWA_PROJECT_ROOT` 지정 시 통과). L-4 의 세 군데 문구만 보정 권고.

### 직접 한 변이 (미러 `thekaiwa-rev074s-mut`, 매번 원본 복원 · developer 표 M1~M16 과 겹치지 않게)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| V1 | `toWordDto` 가 `favoritedAt` 을 항상 null | **killed** | F3·F5·F8·F10 |
| V2 | 보관 upsert 가 `favorite:false` 로 덮음 | **killed** | F7 |
| V3 | 세트 끝내기 맞힘 `updateMany` 가 `favorite:false` 로 덮음 | **survived** | — (**M-1**) |
| V4 | `sort=wrong` 앞 묶음이 모든 필터 무시 | **survived** | — (M-2, task-068 부터의 공백) |
| V4b | `sort=wrong` 앞 묶음만 `favorite` 제외 필터 | **survived** | — (**M-2**) |
| V5 | `total` 을 쪽 항목 수로 | **killed** | T16·F8 |
| V6 | `archived=1` 일 때 `favorite` 조건 무시 | **killed** | F2·F7·F8 |
| V7 | `loadWordStates` 에서 `userId` 조건 제거(남의 상태 노출) | **killed** | R4·loadWordStates·T14·T16 |
| V8 | 사용자 잠금을 상태 읽기 뒤로 이동 | **survived** | — (L-1) |
| V9 | 스키마 `(userId, favorite)` 색인 제거 | **survived** | — (L-2) |
| V10 | `baseTotal` 이 필터 반영 | **killed** | R4·T16·F8 |
| V11 | 끄기가 `favoritedAt` 안 지움 | **killed** | R2·F3 |
| V12 | 채택 연결 응답이 내 상태를 잃음 | **killed** | F10 |
| V13 | `READ_ONLY_KEYS` 에서 `favoritedAt` 만 제거 | **killed** | F10 |
| V14 | 수정 응답이 별을 잃음 | **killed** | F10 |
| V15 | 기본 단어 묶음이 `favorite` 무시 | **killed** | R4·F5·F7·F8 |

16개 중 killed 11 · survived 5(M-1·M-2·L-1·L-2 로 귀속). 하네스 `scratchpad/rev074s-mut.py`(저장소 밖). 동작 탐침 2개(`revProbe074.test.ts`, 미러에만 있고 저장소엔 없음): P1·P2 둘 다 통과 → 현재 코드가 맞다는 직접 증거.

### 증빙 숫자 대조 (미러 `thekaiwa-rev074s`, `.next` 삭제 후, 가짜 `DATABASE_URL`, `prisma generate` 안 돌림 — 클라이언트 `favorite` 82건 확인만)
| 항목 | developer 보고 | reviewer 재실행 |
|---|---|---|
| `tsc --noEmit` | 0 | **0**(`--incremental false`; 공유 `tsconfig.tsbuildinfo` 링크 수 33 → 제자리 쓰기 회피) |
| eslint | 오류 0(`src prisma`, 경고 5) | **0**(`src/modules/learning`·`src/app/api/v1/words`·`src/types` + 새 시험 3파일, 출력 0) |
| learning + routes 시험 | 관련 4파일 51/51 | **633 중 통과 631·실패 0·건너뜀 2** |
| 전체 시험 | 4,278 중 통과 4,277·실패 0·건너뜀 1 | **4,278 중 통과 4,275·실패 0·건너뜀 3** — 건너뜀 +2 는 미러에 `docs/`·`speech/models` 가 없어서(R5·T25·#9). R5·T25 는 `KAIWA_PROJECT_ROOT` 로 따로 실행해 **통과**(18/18). #9(음성 모델 manifest)는 이번 변경과 무관해 재실행 안 함 |
| `next build` | exit 0 | **exit 0**, 라우트 `ƒ /api/v1/words/[id]/favorite`·`unfavorite` 출력 확인(경고 3건은 기존 페르소나 파일 추적 경고) |
| 저장소 ↔ 미러 | — | 서버 파일(`src` components 제외)·`prisma` `diff` 0 |
변경 범위 확인: 화면(`src/components/**`)은 다른 developer 작업 중이라 제외했다 — **tsc·build 는 화면 변경 전(미러에 있던 HEAD 기준) `src/components` 로 돌렸으므로 화면 구현 중 변경분(WordRow·WordsScreen·Sheet 등)은 이번 증빙에 포함되지 않는다**(화면 감사 REV-074U 몫). 서버가 바꾼 `src/types/vocab.ts` 는 포함. 커밋·푸시·배포·DB 접촉·QA 서버 기동 0.

### QA 가 실제 서버·실제 DB 로 확인할 high_risk_areas (QA 서버 `APP_ENV=LOCAL`, 실제 HTTP)
1. **사용자 격리 2계정 교차**: A 가 켠 별(기본·내 단어)이 B 의 목록·상세·`favorite=1`·`archived=1&favorite=1` 에 안 보임 / B 가 A 의 내 단어에 `favorite`·`unfavorite` → 404 + A 행 불변 / 같은 기본 단어를 A·B 가 각자 켜고 끔.
2. **동시 연타**: 같은 단어 `favorite` 를 동시 5~10건, 그리고 `favorite`/`unfavorite` 교차 동시 → 전부 200·상태 행 1개·`favoritedAt` 최초 값 유지·500/유니크 충돌 0(가짜 DB 가 증명 못 하는 부분, 변이 V8 이 못 잡는 영역).
3. **색인·성능**: `favorite=1` 목록의 count/findMany `EXPLAIN` 이 `UserWordState_userId_favorite_idx`(또는 semi-join)를 쓰는지, 별 0개·수십 개·수백 개 계정에서 `favorite=1`·`favorite=1&sort=wrong`·`sort=surface` 응답 시간(7,757 단어).
4. **401 HTTP**: 쿠키 없이 `POST /favorite`·`/unfavorite`·`GET ?favorite=1` → 실제 401(미들웨어 포함), 잘못된 값 `favorite=2`·`true`·`01` 400, 반복 `favorite=1&favorite=0` 첫 값.
5. **보관·풀기·채점이 별을 안 지움**(M-1 의 실제 DB 확인): 기본/내 단어 각각 켜기 → 보관 → 풀기, **오늘의 단어 세트 finish(맞힘·틀림·건너뜀) 전후** `favorite`·`favoritedAt` 동일, 평가 제출 후도 동일.
6. **수정·삭제**: `PATCH {favorite:true}` 내 단어·기본 단어 모두 400 `read_only`(403 아님), 정상 수정 응답에 `favorite` 유지, 단어 삭제 뒤 같은 id `favorite` → 404 + 상태 행 cascade.
7. **쪽 이동·합계**: `favorite=1&limit=7` 의 `total`·`pages`·2쪽, 쪽 초과 → `items:[]` + `total` 유지, `favorite=0`·없음의 `total` 이 전체와 동일, `baseTotal` 불변.
8. **응답 모양·행 수**: #182/#183 응답에 `userId`·`seedKey` 없음·`favoritedAt` ISO, 두 번 켜기 불변, **상태 행 없는 기본 단어 끄기 전후 `UserWordState` 행 수 동일**(DB 직접 대조).
9. **`sort=wrong` × 즐겨찾기**(M-2): 틀린 단어 중 별 있는 것·없는 것을 섞어 `favorite=1&sort=wrong` 결과가 별만 · 틀린 수 내림차순인지.
10. **DB 칸 전제**: QA 서버가 쓰는 DB 에 `favorite`·`favoritedAt` 칸이 있는지(이미 반영, Leader 확인) — 새 코드는 칸이 없으면 단어 API·세트 생성·평가가 모두 실패한다(`STATE_SELECT`). 쓰기 시험 후 QA 계정 별 원복(개발·운영 공유 DB).

### 다음 단계
- **Developer(서버)**: 필수는 없음(FAIL 사유 0). M-1·M-2·L-1 시험 보강 3건 + L-4 문구 보정을 화면 순환과 함께 처리 권고 — 시험만 바뀌므로 서버 재감사는 불필요, 화면 감사(REV-074U)에서 변경 diff 만 확인.
- **QA**: 위 high_risk_areas 10건을 화면 구현이 끝난 뒤 한 번에.
- **Leader**: Codex 개입 판정(C2) 대상 여부는 judge 소관 — 이번 서버 감사에서 Codex 지적은 받지 못했다.
