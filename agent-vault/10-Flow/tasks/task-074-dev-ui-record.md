---
task_id: task-074
role: developer
title: "task-074 화면(UI) developer 기록 — 행 별·출처 4칸·빈 화면·시트 머리 별·공용 Sheet headerAction"
tags:
  - type/task-record
  - domain/vocab
  - domain/ui
created: 2026-10-18
---

# task-074 화면 — developer 기록

이력서: [[task-074-improve-word-favorites]] · 서버 기록 [[task-074-dev-server-record]] · 가이드 정본 `docs/screens.md` §32 · 승인 데모 `docs/demo/task-074-word-favorites-v2.html`(읽기 전용) · 미러 `~/.node-local/thekaiwa-dev074-ui`

## 진행
- [01] 기록 파일 생성. §32(13857~14115) 전체·서버 기록 읽음. 데모 게이트 activate 완료(Leader 전달).
- [02] 미러 `thekaiwa-dev074-ui` 생성(`cp -al dev074-sv` → `.next` 삭제 → `src`/`tests`/`prisma` rsync·`package.json` 새 파일, `.env` 없음, `prisma generate` 안 함). 변경 전 `Sheet` 정적 렌더 골든 5종(basic·notDismissible·describedBy·longTitle·closed) → 미러 `tmp074/golden-before.json`(4,752바이트, createPortal 을 노드 그대로 돌려주게 바꾸고 `document` 가짜).
- [03] 단계 ①②③ 코드 작성: 새 `vocab/favorite.ts`(favoriteStep·favoriteView·favoriteErrorText·rowStarLayout·createFavoriteController) · 새 `vocab/FavoriteStar.tsx` · `WordRow.tsx`(li relative·형제 별·pr-6·H2) · `labels.ts`(FAVORITE_COPY·4칸·listLeadText favorite·listConditionText 확장·favoriteMatchParts) · `logic.ts`(WordSourceView·listHeader favorite) · `validate.ts`(emptyVariant·두 값) · `wordsPaging.ts`(wordsListUrl 만) · `WordsEmpty.tsx`(두 경우·onClearFavorite) · 새 `useWordFavorites.ts`(컨트롤러는 효과 안에서 생성 — StrictMode 재마운트 대비). 시험·WordsScreen·Sheet 아직.
- [04] 단계 ④⑤ 연결: `WordsScreen.tsx`(훅·`listReadAt`·목록 요청 직전 stamp·성공 응답에만 `setListReadAt`·효과(토스트/404 시트 닫기+reloadAll/즐겨찾기 칸 reload+초점 확인 rAF)·`WordsPageList` favView/onStar·빈 화면 onClearFavorite) · `common/Sheet.tsx` 세 곳 추가(**공용 부품 변경**) · `WordDetailSheet.tsx`(`fav?` 선택 prop·`readAt`·GET/PATCH/보관 직전 stamp·`headerAction`). **가이드에 없던 호출처 발견**: `drawer/CorrectionsScreen.tsx` 397행도 `WordDetailSheet` 를 쓴다 → `fav` 를 선택 prop 으로 두고 안 넘기면 머리 별 없음(그 화면 지금 그대로, 내 소유 밖 파일 수정 0) — Leader 확인 사항으로 올림.
- [05] 시험: 새 `vocab/__tests__/favorite.test.ts`(25개 — 컨트롤러 C1~C7·favoriteView V1~V2·rowStarLayout L1~L2·주소/열쇠/머리줄/빈화면/문구 U1~U6·부품 동작 B1~B4(컴포넌트 함수를 렌더 문맥 안에서 불러 처리기를 직접 호출 — jsdom 없음)·소스 S1) · 새 `common/__tests__/sheetHeaderAction.test.ts`(H1 골든 5종 바이트 동일+undefined/null · H2 위치 · H3 소스) + 골든 `common/__tests__/fixtures/sheet-golden-074.json` · 갱신 `labels.test.ts` 171행(4칸, 의도) · `wordsScreenParts.test.ts` list() 도우미(favView·onStar, 단언 그대로) · `wordDetailOrigin.test.ts` row() 도우미(props 3개, 단언 그대로). tsc 0 · 관련 8파일 83/83 · eslint 0 오류(경고 5 = 기존 다른 파일).
- [06] `next build`(미러, `.next` 새로) **exit 0**. **별 세로 자리 실측(W8 일부)** — 헤드리스 Chrome, 빌드된 CSS(`.next/static/chunks/*.css`) + 실제 행 마크업(서버 렌더 `WordsPageList`) + 히라가나/한글 4조합 변형(한글 줄은 `HangulLine` 클래스 그대로 손으로 넣음, 히라가나 켬은 `line-height:1.95`+`top 2.471em`), 폭 360/390/412 × 정렬 2 × 행 5 = **120행: 아이콘↔글자 겹침 0 · 아래 행 침범 0(최소 여유 0.63px — 한글·히라가나 끔·뱃지 없는 70px 행, 가이드 예측 0.6) · 아이콘 오른쪽 끝 = 뱃지 오른쪽 끝(차 0) · 아이콘 위 ↔ 뱃지 아래 ≥2.75px · 한글 줄 있는 행에서 별 가운데 − 한글 줄 가운데 = 0.00px(2.021em·2.471em 모두, 긴 한글이 두 줄로 접힌 행만 −1.63)**. → `2.021em` 식 확인. 측정 못 한 것: 글꼴 130%(WebView 글자 배율 흉내 불가)·실제 루비 요소 높이·실기기 — QA W8·W9. 측정 스크립트는 미러 `tmp074/{rows.ts,measure2.js}`(저장소 밖).

## 공용 `Sheet` 변경 영향 (공용 부품 변경 — DOM 불변 증명)
| 항목 | 값 |
|---|---|
| 변경 | `common/Sheet.tsx` 추가 3곳(구조 분해 `headerAction` · props 타입 `headerAction?: React.ReactNode` + 주석 · `</h2>` 다음 줄 `{headerAction}`) — `git diff -U0` 의 `-` 줄 **0** |
| 호출 전수 | `grep -rn "<Sheet\b" src --include=*.tsx \| grep -v __tests__` = **51곳 · 43파일**(가이드 수와 같음) |
| `headerAction` 을 넘기는 곳 | `vocab/WordDetailSheet.tsx` 단어가 있을 때 시트 1곳뿐(`fav` 가 있고 삭제 확인이 아닐 때만 값, 나머지는 `undefined`) — 같은 파일 로딩 시트 포함 나머지 50곳은 prop 없음 |
| 골든 | 변경 **전** `Sheet.tsx` 로 뽑은 정적 렌더 5종(기본 · `dismissible=false` · `describedBy` · 긴 제목+여러 자식 · 닫힘) → `common/__tests__/fixtures/sheet-golden-074.json`(4,752바이트). 방법: 시험 프로세스 안에서만 `react-dom.createPortal` 을 노드 그대로 돌려주게 하고 `document` 가짜 |
| 바이트 동일 | 변경 **후** 같은 5종 렌더 = 골든 **바이트 동일**(+ `headerAction={undefined}`·`{null}` 도 동일) — 시험 H1 로 고정 |
| 넘길 때 | `</h2>` 와 `<button … aria-label="닫기"` 사이에 감싸는 요소 없이 그대로(H2 — 골든을 그 자리에서 잘라 끼운 문자열과 정확히 같음) · 소스 H3(`{headerAction}` 1회, `</h2>` 바로 다음 줄) |
| 변이 | 슬롯을 `<div>` 로 감쌈 · 안 넘긴 시트에 자리 요소 — 둘 다 H1 이 잡음(아래 변이 표 M21·M22) |

## 가이드와 다른 점 (docs/screens.md 는 고치지 않음 — designer·Leader 확인 대상)
1. **`WordDetailSheet` 를 쓰는 곳이 하나 더 있다** — `drawer/CorrectionsScreen.tsx` 397행(채택 교정 모음 → 단어 상세). §32-5 는 단어장만 다뤘다. 내 소유 밖 파일이라 고치지 않고 `fav` 를 **선택 prop** 으로 두어 안 넘기면 머리 별 없음(그 화면은 지금과 같다, 시험 B3). **결정 필요**: 교정 모음의 단어 상세에도 별을 둘지(두려면 그 화면이 `useWordFavorites` 를 갖고 `fav` 를 넘기면 됨 — 목록 다시 읽기 효과는 그 화면 몫).
2. **훅 모양** — 가이드 `useWordFavorites()`(인자 없음) → `useWordFavorites({ inFavoriteView, onEffect })`(화면의 최신 콜백을 ref 로 받음). 컨트롤러는 렌더 중이 아니라 **효과 안에서** 만들고 정리 때 `dispose()` — `next.config` 가 `reactStrictMode: true` 라 개발 모드에서 효과를 한 번 껐다 켜므로, 렌더 중에 하나만 만들면 꺼진 컨트롤러가 남는다. `view` 는 React 상태를 읽어 상태가 바뀔 때만 새 함수(렌더마다는 아님), `press`·`stamp` 는 늘 같은 함수.
3. **`send` 실패 모양** — 훅의 `sendFavorite` 가 `apiPost` 오류를 `Error + { status: toErr(e).status }` 로 다시 던지고, 컨트롤러는 `status` 숫자만 읽는다(모르는 모양 = −1 → 일반 실패 문구).
4. **`ok` 무시 조건 확대** — 가이드 「기록 없는 id 의 ok·fail 무시」 + **처리 중이 아닌 기록의 ok·fail 도 무시**(중복 응답 방어, 잠금 때문에 정상 흐름에선 생기지 않음).
5. **목록 `readAt` 갱신 조건** — 성공 응답(`res.ok`)을 깔 때만(쪽 오류·clamp 때는 그대로). 오류 응답에 시각만 앞당기면 옛 행의 서버 값이 더 새로운 별 기록을 이길 수 있어서.
6. **빈 화면 `noFavoriteMatch` 본문** — 조각을 `favoriteMatchParts`(labels.ts, 순수)로 만들고 뒤 글은 `FAVORITE_COPY.matchBody('')` 로 붙여 글자 단일 출처를 지킴(시험 U5 가 `matchBody('‘ねこ’ 검색')` 와 같음을 확인).
7. 히라가나 끔 `2.021em` — 가이드 값 그대로, 실측으로 확인(진행 [06]).
- [07] 전체 시험(미러, 가짜 `DATABASE_URL`, `--test-concurrency=1`, `src`+`scripts/seed-build`): **4,303 중 통과 4,300 · 실패 0 · 건너뜀 3**(모두 저장소 문서·모델이 필요한 기존 대조 시험 — 미러에 `docs/`·`speech/models` 없음: 서버 R5 · T25 · models manifest #9). 변이 점검 30개 백그라운드 시작(스크립트 scratchpad `mutate074ui.py`, 미러 사본만 임시 파일+rename 으로 바꾸고 저장소 파일로 되돌림, 하드링크 공유 파일은 거부).
- [08] 변이 점검 **31개 중 31개 포착**(첫 판 30개 중 M29 생존 → 원인: `listHeader` 의 `if (f.source === 'favorite') return { lead: 'favorite' … }` 줄이 바로 아래 `return { lead: f.source … }` 와 같은 값이라 **동치 변이**. 그 중복 줄을 지우고(동작 같음) M29 를 「즐겨찾기 앞말을 보관함·검색보다 먼저」로 바꾸고 M31 추가 → 둘 다 포착). 매번 미러 파일을 저장소 파일로 되돌림 → `RESTORED_IDENTICAL True`, 저장소↔미러 `diff -rq src` 동일.
- [09] 최종 확인(중복 줄 삭제 뒤 다시): `tsc --noEmit` 0 · `eslint src/components src/modules/learning` 0 오류(경고 5 = 기존 다른 파일 `admin/trace/DiagnosticsScreen`·`settings/{Learning,OnDeviceDiagnosticsCard,Speech,Voice}Settings` 의 set-state-in-effect) · 화면 시험(`vocab`·`common`·`drawer` __tests__ 전부) **529/529** · `next build` **exit 0**(두 번째). 엔진명·model_id grep(바꾼·새 화면 파일 12개) 0 · `window.Capacitor`·`fetch(` 0(요청은 `apiPost` 경유). 네이티브 변경 없음. 커밋·푸시·DB·서버 기동 0.

## 변이 점검 표 (미러 사본에만 → 관련 8파일 시험 → 저장소 파일로 복원)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | 잠김 무시 제거(연타 → 요청 2) | 포착 | C1 |
| M2 | 실패 되돌림 제거 | 포착 | C3·C4 |
| M3 | 실패 되돌림을 `!값` 으로 | 포착 | C4 |
| M4 | 즐겨찾기 칸에서 꺼도 행이 안 빠짐(reload 없음) | 포착 | C2 |
| M5 | reload 조건 반전 | 포착 | C2 |
| M6 | 토스트를 칸 기준으로(켬에도 토스트) | 포착 | C2 |
| M7 | `favoriteView` 처리 중 우선 제거(낙관적 값이 응답에 덮임) | 포착 | C1·C4·V1 |
| M8 | `favoriteView` 시각 비교 제거 | 포착 | V1·V2 |
| M9 | `>` → `>=` | 포착 | V1 |
| M10 | 응답 `favorite` 무시 | 포착 | C6 |
| M11 | dispose 뒤 응답 반영 | 포착 | C5 |
| M12 | `rowStarLayout` 이 `prefsLoaded` 무시 | 포착 | L1 |
| M13 | H2 판정을 한글 설정만으로 | 포착 | L1 |
| M14 | 세로 자리 `2.471em` 고정 | 포착 | L2 |
| M15 | `aria-pressed` 누락(꺼짐) | 포착 | B1·B4 |
| M16 | 이름 이중 낭독(상태로 이름 바뀜) | 포착 | B1 |
| M17 | 잠김을 `disabled` 로 | 포착 | B1·B4 |
| M18 | 별을 열기 단추 안으로 | 포착 | B2·B4 |
| M19 | `li` 에 클릭 처리기 | 포착 | B2 |
| M20 | 행 별이 보인 값을 뒤집어 보냄 | 포착 | B2 |
| M21 | `Sheet` 슬롯을 `<div>` 로 감쌈 | 포착 | H1·H2·H3 |
| M22 | `Sheet` 가 안 넘긴 시트에도 자리 요소(새어 나옴) | 포착 | H1·H3 |
| M23 | 시트 별이 `w.favorite` 직접 | 포착 | B3·S1 |
| M24 | 시트 별이 삭제 확인에도 | 포착 | S1(소스 스캔 — 모드 전환은 jsdom 없이 못 돌림) |
| M25 | 주소에서 `favorite=1` 빠뜨림 | 포착 | U1 |
| M26 | `source=favorite` 그대로 전송 | 포착 | U1 |
| M27 | 다른 칸에 `favorite=0` 전송 | 포착 | U1·wordsPaging T1 |
| M28 | `emptyVariant` 순서(검색이 먼저) | 포착 | U4 |
| M29 | 머리 줄 즐겨찾기 앞말을 보관함·검색보다 먼저 | 포착 | U3 |
| M30 | 조건 「즐겨찾기」를 늘 붙임 | 포착 | U3 |
| M31 | 즐겨찾기 칸 머리 줄이 「단어 n개」 | 포착 | U3 |
**31/31.** 스크립트 scratchpad `mutate074ui.py`(저장소 밖). 동작으로 못 잡고 소스 스캔으로만 잡는 것: M24 하나(+ `WordsScreen` 의 `listReadAt`·`onClearFavorite` 배선은 S1 스캔만).

## 변경 파일 (화면만 — 서버·API·타입·DB·프롬프트·docs 변경 0)
- 새: `src/components/vocab/favorite.ts` · `src/components/vocab/FavoriteStar.tsx` · `src/components/vocab/useWordFavorites.ts` · `src/components/vocab/__tests__/favorite.test.ts` · `src/components/common/__tests__/sheetHeaderAction.test.ts` · `src/components/common/__tests__/fixtures/sheet-golden-074.json`
- 고침: `src/components/common/Sheet.tsx`(**공용 부품**, 추가만) · `src/components/vocab/{WordRow,WordsScreen,WordDetailSheet,WordsEmpty}.tsx` · `src/components/vocab/{labels,logic,validate,wordsPaging}.ts` · 시험 `src/components/vocab/__tests__/{labels,wordsScreenParts,wordDetailOrigin}.test.ts`(도우미·의도된 4칸 단언만, 약화 0)
- 고치지 않음(가이드대로): `WordsSkeleton`(상수로 자동 4칸)·`TabSkeleton`·`WordForm`·`WordAddSheet`·`ArchiveToggle`·칩·`Segmented`·`japanese/**`·`talk/**`·`drawer/CorrectionsScreen.tsx`(가이드와 다른 점 1)

## 알려진 한계
1. ~~채택 교정 모음의 단어 상세엔 별이 없다~~ — **해소(아래 「교정 모음 상세 연결」, Leader 결정으로 연결함)**.
2. 시트에서 [저장]·보관 응답이 별보다 **먼저 보낸 요청의 옛 값**으로 목록 행을 바꿔 끼울 때(`onChanged`), 목록 `listReadAt` 이 그 별 확정보다 **나중**이면 행이 잠깐 옛 값을 보일 수 있다 — 바로 이어지는 `reloadAll()` 응답이 고친다(가이드 「목록 쪽 readAt 은 바꾸지 않는다」 그대로, 창 = 다시 읽기 왕복).
3. 즐겨찾기 칸에서 끈 직후 다시 켜면(다시 읽기 응답 전) 행이 빠졌다 돌아올 수 있다(가이드 함정 6, 0.3~0.6초).
4. 시트에서 별을 끈 뒤 시트를 닫을 때 원래 열기 단추가 없으면 초점을 잃음 — 보관(#45)과 같은 기존 한계(함정 5).
5. 실측은 100% 글꼴·헤드리스 Chrome 고정 폭 상자 기준 — 글꼴 130%·실제 루비 높이·WebView·TalkBack 낭독은 미측정.
6. `WordsScreen` 의 효과 연결(토스트·404 시트 닫기·reload·초점 rAF)은 jsdom 이 없어 동작 시험이 없다(컨트롤러 효과 값은 C2·C3 로 고정, 배선은 S1 스캔·QA).

## QA 가 볼 곳 (W1~W16 중 이번 구현에서 특히)
- **W8·W9**: 히라가나 끔(+한글 끔) 행 별 위치·아래 행 침범(헤드리스 여유 0.63px 로 빠듯) — 360/390/412 × 100/130%, 실제 루비 켬 행도.
- **W4·W5**: 느린 망에서 행↔시트 연타 요청 1 · 실패/오프라인/404 되돌림·문구 · 404 때 열린 시트 닫힘 + 토스트 1번(시트 자체 `onNotFound` 토스트와 겹치지 않는지).
- **W6**: 시트에서 별 → [수정][저장]/[보관하기] 빠르게 → 시트·목록 별 불변.
- **W13**: 즐겨찾기 칸에서 키보드·TalkBack 으로 별 끔 → 행 빠짐·토스트 1·초점 머리 줄(rAF 판정).
- **W12**: 다른 시트(예: `WordsJumpSheet`·새 채팅 시트) 머리 줄 outerHTML 이 운영과 같음.
- 채택 교정 모음 → 단어 상세: ~~별 없음~~ → **이제 머리 별 있음**(아래 「교정 모음 상세 연결」 QA 확인 항목).
- 개발 모드(StrictMode)에서도 별이 동작하는지(효과 재실행 뒤 컨트롤러 살아 있음).

## 교정 모음 상세 연결 (후속 소작업 — 채택 교정 모음의 단어 상세 시트에도 머리 별)
Leader 결정: 같은 상세 시트라 일관성을 위해 연결(새 화면 요소 아님 — 승인된 시트 머리 별을 다른 호스트 화면에서 쓴다, 데모 재승인 불필요). 데모 게이트 `DEMO_GATE_PASSED`(task-074 approved v2).
- [A1] 착수. `task-074-dev-ui-record`·§32-5·§32-9·`favorite.ts`·`useWordFavorites.ts`·`WordsScreen` 효과 처리·`CorrectionsScreen` 읽음. 미러 `thekaiwa-dev074-ui2`(= `-ui` 하드링크 복사, `.next` 삭제, tsbuildinfo 링크 끊음)에서만 시험·빌드.
- [A2] 구현. 새 `src/components/drawer/correctionsFavorite.ts`(순수 — `correctionsInFavoriteView`(늘 false)·`correctionsFavoriteEffect(x, open, host)`) + `CorrectionsScreen.tsx`(훅 호출 1곳 — 첫 비어 있음 조기 반환보다 앞, `<WordDetailSheet … fav={fav} />`). 첫 판은 헬퍼 `correctionsFavoriteDeps({openWord,…})` 로 묶었으나 eslint `react-hooks/refs`(렌더 중 호출 함수에 ref 를 만지는 `afterWordGone` 을 넘김) 오류 → **`WordsScreen` 처럼 훅 인자 안 인라인 화살표**로 바꾸고 순수 판단 함수만 효과 안에서 부르게 함(오류 0).
- [A3] 시험 새 `src/components/drawer/__tests__/correctionsFavorite.test.ts` 6개(F1~F5 동작 · S1 소스 스캔) 6/6. 변이 점검 16/16 포착(아래 표). tsc 0 · eslint 오류 0(경고 5 = 기존 다른 파일) · `components` 전체 시험 1,763/1,763 · `drawer`+`vocab`+`common` 535/535.
- [A4] 최종 확인(미러 `thekaiwa-dev074-ui2`, 저장소 `src` 와 `diff -rq` 동일): `tsc --noEmit` **0** · `eslint src/components` 오류 **0**(경고 5 = 기존 다른 파일) · 화면 시험 `drawer`+`vocab`+`common` __tests__ 전부 **535/535**(`components` 전체 1,763/1,763) · **전체 시험 4,317 중 통과 4,314 · 실패 0 · 건너뜀 3**(가짜 `DATABASE_URL`, `--test-concurrency=1`, `src`+`scripts/seed-build`; 건너뜀 3 = 기존 문서·모델 의존 대조 시험) · `./node_modules/.bin/next build` **exit 0**. 엔진명·model_id·`fetch(`·`window.Capacitor` grep 0. 네이티브 변경 없음. 커밋·푸시·배포·DB·서버 기동 0.

### 변경 파일 (교정 모음 상세 연결 — 서버·API·타입·`prisma/**`·docs·`package.json` 변경 0)
- 새: `src/components/drawer/correctionsFavorite.ts`(33줄, 순수) · `src/components/drawer/__tests__/correctionsFavorite.test.ts`(6개)
- 고침: `src/components/drawer/CorrectionsScreen.tsx`(+13줄 — import 2 · 훅 호출 1곳 · `fav={fav}` 1줄. 기존 줄 수정·삭제 0)
- 고치지 않음(지시대로): `WordsScreen`·`WordRow`·공용 `Sheet`·`favorite.ts`·`useWordFavorites.ts`·`WordDetailSheet.tsx`·`FavoriteStar.tsx`·문구(`FAVORITE_COPY` 재사용 — 새 문구 0)

### 결정과 이 화면에서 효과를 처리하는 법
| 컨트롤러 효과 | 단어장 화면(`WordsScreen`) | 교정 모음(이 화면) |
|---|---|---|
| `inFavoriteView` | 지금 깔린 목록이 「즐겨찾기」 칸인가 | **늘 false** — 이 화면은 즐겨찾기 칸이 아님 → 별을 꺼도 빠질 행·다시 읽을 칸이 없고, 컨트롤러가 `reload`·「즐겨찾기에서 뺐어요」 를 **만들지 않는다**(시험 F1) |
| `x.reload` | `request('reload')` + 초점 확인 | **해당 없음** — 코드가 `x.reload` 를 읽지 않음(S1 스캔) |
| `x.toast`(실패 문구) | `showToast` | `toast.show`(이 화면 기존 토스트) 1번. 500/기타 → 일반 실패, 상태 0 → 연결 문구(F2) |
| `x.notFound`(404) | 그 단어 시트 닫기 + `reloadAll()` + 토스트 1번 | **그 단어 시트가 열려 있으면** 이 화면의 기존 「단어가 사라짐」 경로 `afterWordGone(fromId, WORD_NOT_FOUND)` — 시트 닫기 + 토스트 1번 + 누른 카드 기준 다시 읽기(`reloadKeep`) + 카드 요약 버튼 초점. 시트 자신의 `onNotFound` 와 **같은 경로**라 따로 만든 새 동작 없음(F3). 시트가 닫혔거나 **다른 단어**가 열려 있으면 토스트만(F4) |
- **별 값을 되먹일 곳이 없다 [확실]**: 이 화면의 목록은 교정 카드(`DrawerCorrectionItem`)라 `favorite` 칸이 타입에도 없고, 시트의 `onChanged` 는 `listWithWordSurface`(표현만 바꿔 끼움)다. 별 기록은 이 화면의 훅이 하나 갖고 시트만 본다. 단어장 탭으로 넘어가면 단어장 화면이 새로 목록을 읽는다(별 기록은 화면 안 메모리라 화면을 떠나면 사라지고 서버 값이 이긴다).
- **React Compiler 린트(`react-hooks/refs`)**: 처음엔 헬퍼 `correctionsFavoriteDeps({ afterWordGone … })` 로 묶었으나, ref 를 만지는 `afterWordGone` 을 렌더 중 호출하는 함수에 넘겨 **린트 오류**. `WordsScreen` 과 같게 훅 인자 안 인라인 화살표로 바꾸고 순수 판단 함수(`correctionsFavoriteEffect`)만 효과 안에서 부름 → 오류 0.
- 훅 호출 위치 = `afterWordGone` 정의 바로 뒤, 첫 비어 있음 조기 반환(`view.body === 'emptyFirst'`) **앞** — 훅 규칙. 훅 뒤 조기 반환 이전에 ref 를 읽는 코드는 없음.
- 새 UI 요소·새 문구·새 요청 0 — 승인된 시트 머리 별(데모 v2 `d-base`·`d-mine`)을 다른 호스트 화면에서 쓰는 것뿐.

### 변이 점검 표 (미러 사본에만, 새 시험 파일 6개로 판정, 저장소 내용으로 복원 — `RESTORED_IDENTICAL True`)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| X1 | 화면이 시트에 `fav` 를 안 넘김 | 포착 | S1(스캔) |
| X2 | 화면이 `inFavoriteView` 를 `() => true` 로 | 포착 | S1(스캔) |
| X3 | 훅을 첫 비어 있음 조기 반환 뒤로 | 포착 | S1(스캔) |
| X4 | 화면이 열린 시트 대신 `null` 을 넘김(404 처리 누락) | 포착 | S1(스캔) |
| X5 | 화면이 토스트 연결 누락(`toast: () => {}`) | 포착 | S1(스캔) |
| X6 | 화면이 `wordGone` 대신 시트만 닫음 | 포착 | S1(스캔) |
| Y1 | `correctionsInFavoriteView` 가 true | 포착 | F1(동작) |
| Y2 | 404 처리 누락(시트 열려도 토스트만) | 포착 | F3(동작) |
| Y3 | 토스트 누락 | 포착 | F2·F4(동작) |
| Y4 | 404 때 토스트 이중(wordGone + toast) | 포착 | F3(동작) |
| Y5 | 열린 시트의 단어 id 비교 없음(다른 단어가 열려도 닫음) | 포착 | F4(동작) |
| Y6 | `notFound` 대신 토스트 유무로(500 에도 시트 닫음) | 포착 | F2(동작) |
| Y7 | `wordGone` 에 누른 카드 id 대신 빈 값 | 포착 | F3(동작) |
| Y8 | `reload` 표시에 반응해 토스트 | 포착 | F1(동작) |
| W1 | 시트가 `fav` 가 있을 때 머리 별 말고도 다름(제목) | 포착 | F5(요소 트리) |
| W2 | 시트가 `fav` 가 있으면 닫기 막음 | 포착 | F5(요소 트리) |
**16/16 포착.** 스크립트 scratchpad `mutate074ui2.py`(저장소 밖). **동작으로 못 잡고 소스 스캔(S1)으로만 잡는 것: X1~X6 — 「화면이 훅 인자·`fav` 를 이렇게 넘긴다」는 배선 6개.** jsdom 이 없어 `CorrectionsScreen` 을 단어 시트가 열린 상태로 렌더할 수 없다(`wordSheet` 가 클릭으로만 생기는 `useState`). 효과 판단(Y1~Y8)은 동작 시험, 시트 요소 트리(W1·W2)는 요소 비교(F5).

### 남는 한계
1. 화면 배선(X1~X6)은 소스 스캔 + QA(브라우저) — jsdom 이 없음.
2. 시트가 닫혔거나 다른 단어가 열린 상태에서 온 404 는 토스트만 한다(교정 카드의 [단어 보기] 가 지워진 단어를 가리키는 채로 다음 다시 읽기까지 남음). 그 카드를 누르면 시트 GET 이 404 → 기존 `onNotFound` 경로가 지금처럼 정리한다 — 이번 연결 전과 같은 자가 치유.
3. 별 기록은 이 화면 안 메모리 — 시트를 닫았다 같은 화면에서 다시 열면 GET 응답이 서버 값을 가져오고, 별 확정 시각이 더 나중이면 기록이 이긴다(단어장 화면과 같은 규칙, 그대로).
4. 실기기·TalkBack 낭독은 미측정(QA).

### QA 가 볼 곳 (교정 모음 → 단어 상세)
- 채택 교정 모음에서 [단어 보기 ›] → 시트 머리 ✕ 왼쪽에 별(단어장에서 연 시트와 같은 모양·같은 자리, 기본 단어·내 단어 모두). 누르면 즉시 금색, 토스트 없음, 끄면 토스트 **없음**(즐겨찾기 칸이 아니므로).
- 별 요청 실패(오프라인/500) → 되돌림 + 토스트 1번, 시트는 열린 채. 별을 누른 채 그 단어가 다른 곳에서 삭제됐을 때(404) → 시트 닫힘 + 토스트 1번 + 목록 다시 읽기 + 초점이 누른 카드의 요약 버튼으로.
- 교정 모음에서 켠 별이 단어장 탭에서 그대로 켜져 있음(서버 반영), 단어장의 「즐겨찾기」 칸에 나타남.
- 시트가 삭제 확인 모드일 때 별 없음(단어장과 같은 규칙, `WordDetailSheet` 그대로).

## 감사 후 시험 보강 (REV-074U M-1)
지시: 화면 배선의 동작 시험 부재(M-1) 해소 — 사용자에게 보이는 동작·DOM·문구·요청·타이밍 불변, 효과 처리를 순수 함수로 빼고 동작 시험 추가. 감사자 생존 변이 A1~A17 을 시험이 잡게 한다. 미러 `~/.node-local/thekaiwa-dev074-ui3`(검증)·`-ui3-mut`(변이), jsdom 추가 금지.
- [11:31] 착수. REV-074U(M-1·직접 변이 표·시험 구분표·Developer 에게 4권고)·이 기록 전체·구현 파일 7개·`correctionsFavorite.ts`·기존 시험 2개·감사자 `rev074u/mut.py` 읽음. 계획: (a) `vocab/wordsFavoriteEffect.ts` 새 파일 — 효과 계획(순수)+실행(가짜 setter 로 시험)+목록 응답 꼬리(readAt·초점 확인)+행 별 처리기 · (b) `useWordFavorites` 의 컨트롤러 수명 헬퍼(`mountFavoriteController`) 분리 + 진짜 `sendFavorite` 를 가짜 전역 `fetch` 로 · (c) `WordDetailSheet` 저장·보관 stamp 헬퍼 + 시험 프로세스 한정 `useState` 대체로 두 경로를 실제 처리기로 돌림 · (d) `WordsEmpty` 처리기 직접 호출 · (e) `useSyncExternalStore` 시험 프로세스 한정 대체로 로드된 설정 행 렌더.
- [11:33] 미러 `thekaiwa-dev074-ui3` 생성(`cp -al …-ui2`, `.next` 삭제, 루트 `tsconfig.tsbuildinfo`·`next-env.d.ts`·`tsconfig.json`·`package.json` 링크 끊음, `src`/`tests`/`prisma` rsync 후 **세 트리 전 파일 링크 끊음 1,793개**(임시 파일+mv) → 이후 미러 편집이 다른 미러에 새지 않음, `.env` 없음, `prisma generate` 안 함). 리팩터 **전** 정적 렌더 130종 → 미러 `tmp074u3/before.json`(556,983B; 목록 90 = 설정 5상태×층 3×정렬 2×상태 3 · 빈 화면 30 = 10종×조건 3 · 상세 시트 7 = 기본/내 단어×별 없음/켬/잠김+로딩 · 화면 전체 3). 설정 로드 흉내 = 시험 프로세스 한정 `useSyncExternalStore` 대체.
- [11:36] 제품 코드 리팩터(미러): 새 `vocab/wordsFavoriteEffect.ts`(`wordsInFavoriteView`·`wordsFavoriteEffect`→계획·`detailSheetAfterGone`·`runWordsFavoriteEffect`·`wordsStarHandler`·`finishWordsArrival`) · `WordsScreen.tsx`(훅 인자 두 줄·`onStar` = `useMemo(wordsStarHandler)`·목록 응답 꼬리 = `finishWordsArrival`) · `useWordFavorites.ts`(+`mountFavoriteController`·`stampedSend`, 효과는 헬퍼 호출만) · `WordDetailSheet.tsx`(GET·저장·보관 세 곳 `stampedSend` — 찍는 순서·`setReadAt` 위치 그대로). `tsc` 0(제품) · 리팩터 **후** 같은 130종 렌더 → `cmp before.json after1.json` **동일**. 다음: 시험 파일.
- [11:38] 새 시험 `vocab/__tests__/favoriteWiring.test.ts` 16개(W1~W7·B5~B7·C8~C11·D1·E1) **16/16** 첫 실행 통과. 화면 시험 551 중 1 실패 = 기존 소스 스캔 `wordsPaging.test.ts` REV-068C-4(쪽 도착 `scroll:true` 줄을 WordsScreen 에서 찾음) — 그 줄을 `finishWordsArrival` 로 옮긴 모양 때문. **같은 강도로 갱신**: WordsScreen 이 `focusHead: out.focusHead` 를 꼬리에 넘김 + `focusHead: (scroll) => setFocusReq(… scroll …)` + 꼬리 파일의 `if (a.focusHead) d.focusHead(true)` 세 정규식(원래 한 줄 → 세 줄, 동작은 W6 이 추가로 고정). tsc 0 · eslint(vocab·drawer·common) 0.
- [11:48] 변이 재실행 끝(미러 `-ui3-mut`, 임시 파일+`os.replace` 로만 쓰고 원본으로 복원 — 매번 `restored True`, 판정 = `vocab`+`common`+`drawer` 551개, 기준 실행 551/551·20초). 스크립트 scratchpad `dev074u3/mut.py`(저장소 밖, 감사자 `rev074u/mut.py` 의 같은 의도를 새 모양으로 옮김).

### 빼낸 함수·파일
| 파일 | 함수 | 화면이 하는 일 |
|---|---|---|
| 새 `vocab/wordsFavoriteEffect.ts` | `wordsInFavoriteView(list)` · `wordsFavoriteEffect(x)`→계획 `{toast, closeDetailId, reloadAll, reload, focusCheck}` · `detailSheetAfterGone(s,id)` · `runWordsFavoriteEffect(x, {showToast,setSheet,reloadAll,request,focusCheck})` · `wordsStarHandler(press)` · `finishWordsArrival({ok,readAt,toast,focusHead}, deps)` | `WordsScreen` 은 훅 인자 두 줄·`useMemo(wordsStarHandler)`·목록 응답 꼬리 호출 하나 |
| `vocab/useWordFavorites.ts` | + `mountFavoriteController(slot, deps)`(정리 = dispose + 자기 것일 때만 slot 비움) · + `stampedSend(stamp, send)`(찍고 → 보냄) | 훅 효과 = `mountFavoriteController(ctrlRef, …)` 한 줄 |
| `vocab/WordDetailSheet.tsx` | GET·저장·보관 세 곳 `const { readAt: t, res } = stampedSend(favStamp, () => api…)` | `setReadAt(t)` 위치·순서·try 범위 그대로(저장·보관은 원래 try 밖의 `favStamp()` 를 try 안 첫 줄로 — `performance.now()` 라 던지지 않음) |
| 시험 새 `vocab/__tests__/favoriteWiring.test.ts` | 16개: W1~W7(효과 표·실행 순서·진짜 컨트롤러 결합·칸 판정·행 처리기·응답 꼬리·**화면 요소 트리에서 시트에 `fav` 전달**) · B5~B7(진짜 `sendFavorite`+가짜 전역 `fetch`·오류 status→문구·수명) · C8~C11(`stampedSend` 순서 · **진짜 시트 처리기로 저장·보관·보관 풀기·실패** · 수정/삭제 확인 모드 머리 별) · D1(빈 화면 두 경우 처리기 직접 호출) · E1(설정 로드 뒤 행 렌더) | — |
| 시험 갱신 `vocab/__tests__/wordsPaging.test.ts` REV-068C-4 | 정규식 1 → 3(같은 강도, 이유: 그 줄을 꼬리 함수로 옮김) | — |

시험 기법(jsdom·의존성 추가 0, 소스 스캔 0): ① 가짜 setter/가짜 `send` ② 가짜 전역 `fetch`(진짜 `apiPost`·`ApiError`·`toErr` 경로 그대로) ③ **시험 프로세스 한정 `useState` 대체**(호출 순서별 슬롯 유지 — 진짜 `WordDetailSheet` 를 함수로 다시 불러 [수정]→`WordForm.onChange`→`<form onSubmit>`·[보관하기] 처리기를 실제로 부름, 효과는 돌지 않음 = 서버 렌더 그대로) ④ 시험 프로세스 한정 `useSyncExternalStore` 대체(표시 설정 로드됨 / 수화 뒤) ⑤ 요소 트리 순회.

### 리팩터 전/후 렌더
리팩터 전 130종 `before.json` ↔ 후 `after1.json` **`cmp` 동일**(556,983B). 목록 90(설정 로드 전·히라가나/한글 켬끔 4 × 층 off/ready/섞음 × 정렬 × ready/paging/pageError) · 빈 화면 30(10종 × 조건 3) · 상세 시트 7(기본/내 단어 × 별 없음/켬/잠김 + 로딩) · `WordsScreen` 전체 3(기본·`initialWordId`·`initialAdd`, 라우터 문맥).

### A1~A17 변이 재실행 (원래 의도 → 옮긴 곳 → 결과)
| # | 원래 의도(REV-074U) | 이번 변이(새 모양) | 결과 | 잡은 시험 |
|---|---|---|---|---|
| A1 | `WordRow` 셋째 줄 `pr-6` 늘 | 같은 줄 그대로 | **포착** | E1 |
| A2 | `WordRow` 별 `top` 2.471em 고정 | 같은 줄 그대로 | **포착** | E1 |
| A3 | 끈 뒤 초점 확인(rAF) 판정 제거 | `finishWordsArrival` 판정 줄 → `void el` | **포착** | W6 |
| A4 | `setListReadAt` 제거 | `finishWordsArrival` 의 `d.setListReadAt` 제거 | **포착** | W6 |
| A5 | 시트 저장 뒤 `setReadAt(t)` 제거 | 같은 줄 그대로 | **포착** | C9 |
| A6 | 시트 보관 뒤 `setReadAt(t)` 제거 | 같은 줄 그대로 | **포착** | C10 |
| A7 | 저장 stamp 를 응답 뒤로 | 저장이 헬퍼 없이 `await apiPatch` 뒤 `favStamp()` | **포착** | C9 |
| (A7b) | 〃 헬퍼 쪽 | `stampedSend` 가 보낸 뒤 찍음 | **포착** | C8(+C9·C10) |
| (A7c) | 〃 보관 경로 | 보관이 응답 뒤 `favStamp()` | **포착** | C10 |
| A8 | 정리에서 `dispose()` 누락 | `mountFavoriteController` 의 `c.dispose()` 제거 | **포착** | B7 |
| A9 | 404 때 시트 안 닫음 | `runWordsFavoriteEffect` 의 `setSheet` 호출 제거 | **포착** | W2·W3 |
| (A9b) | 〃 판정 쪽 | `detailSheetAfterGone` 이 늘 그대로 | **포착** | W2 |
| A10 | 머리 별을 보기 모드에서만 | 같은 줄 그대로 | **포착** | S1(스캔) + **C9(동작 — 수정 모드 머리 별)** |
| A11a/b | 빈 화면 두 단추가 `onShowAll` | 같은 줄 그대로 | **포착 ×2** | D1 |
| A12 | `sendFavorite` 켜기↔끄기 뒤집힘 | 같은 줄 그대로 | **포착** | B5 |
| A13 | `inFavoriteView` 늘 false | `wordsInFavoriteView` → `return false` | **포착** | W3·W4 |
| A14 | 행 별이 보인 값을 한 번 더 뒤집음 | `wordsStarHandler` 가 `!shownOn` | **포착** | W5 |
| A15 | 별 실패 토스트 제거 | `runWordsFavoriteEffect` 토스트 줄 제거 | **포착** | W2·W3 |
| A16 | 즐겨찾기 칸 끈 뒤 다시 읽기 제거 | `runWordsFavoriteEffect` `request('reload')` 줄 제거 | **포착** | W2·W3 |
| A17 | 단어장 상세 시트에 `fav` 안 넘김 | 같은 줄 그대로 | **포착** | W7 |
| A3r·A4r·A9r·A13r·A14r·A15r·A16r | (배선 잔여 — 정직 확인용) `WordsScreen` 이 헬퍼에 넘기는 인자를 빈 함수/다른 값으로: 꼬리 `focusCheck`·`setListReadAt`, 효과 `setSheet`·`showToast`·`request`, 훅 `inFavoriteView: () => false`, `wordsStarHandler` 에 뒤집는 press | **생존 7** | — |
| C1~C7 | (대조, 감사자와 같음) | 같음 | **7/7 포착** | B1·L1·F1·U1·T24·F5·B2 |

**감사자 A 변이 18개(A1~A17, A11 은 a/b) 전부 포착(18/18)** — 감사 때 1/18. 추가 변형 3개(A7b·A7c·A9b)도 포착. **배선 잔여 7개는 생존**: `WordsScreen` 본문이 헬퍼에 무엇을 넘기는지(한 줄씩)는 화면 컴포넌트를 효과까지 돌려야 보이는데 jsdom 이 없다 — 아래 「남는 한계」 1.
- [11:54] 최종 확인(미러 `-ui3`, 저장소로 옮긴 뒤 `diff -rq src`·`tests`·`prisma`·`package.json` **동일**): `tsc --noEmit --incremental false` **0** · `eslint src/components` 오류 **0**(경고 5 = 기존 다른 파일 `settings/*`·`admin/trace/*`) · 화면 시험 `vocab`+`common`+`drawer` **551/551** · **전체 시험 4,333 중 통과 4,330 · 실패 0 · 건너뜀 3**(가짜 `DATABASE_URL`, `--test-concurrency=1`, `src`+`scripts/seed-build` — 4,317 + 새 16) · 건너뜀 3 은 `KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO` = 저장소로 `task074FavoriteRoutes`·`task068Words`·`modelPackage` 따로 **25/25** · `./node_modules/.bin/next build` **exit 0**(경고 3 = 기존 파일 추적 경고) · 최종 트리 렌더 130종 다시 → `cmp before.json after2.json` **동일** · 바꾼 파일 엔진명·`fetch(`·`window.Capacitor`·`localStorage` grep 0. 저장소에 옮긴 파일 6개(아래). 커밋·푸시·배포·DB·서버 기동·`prisma generate` 0. 다른 미러 쓰기 0(이 미러는 세 트리 링크를 먼저 끊음, 변이 미러는 `os.replace` 만).

### 변경 파일 (감사 후 시험 보강 — 화면 동작·DOM·문구·요청 불변)
- 새: `src/components/vocab/wordsFavoriteEffect.ts` · `src/components/vocab/__tests__/favoriteWiring.test.ts`(16개)
- 고침: `src/components/vocab/WordsScreen.tsx`(효과·응답 꼬리·행 처리기를 헬퍼 호출로, `useCallback`→`useMemo` import) · `src/components/vocab/useWordFavorites.ts`(+`mountFavoriteController`·`stampedSend`) · `src/components/vocab/WordDetailSheet.tsx`(stamp 세 곳 `stampedSend`) · `src/components/vocab/__tests__/wordsPaging.test.ts`(REV-068C-4 정규식 같은 강도 갱신)
- 고치지 않음: `common/Sheet.tsx`·`favorite.ts`·`FavoriteStar.tsx`·`WordRow.tsx`·`WordsEmpty.tsx`·`CorrectionsScreen.tsx`·`correctionsFavorite.ts`·서버·타입·`prisma/**`·`docs/**`·`package.json`·기존 시험 `favorite.test.ts`(S1 스캔 그대로 통과)

### 남는 한계 (동작 시험이 닿지 못하는 곳)
1. **`WordsScreen` 본문의 배선 줄(잔여 변이 7개 생존)** — 훅 인자 `inFavoriteView: () => wordsInFavoriteView(listRef.current)`·`onEffect: (x) => runWordsFavoriteEffect(x, { showToast, setSheet, reloadAll, request, focusCheck: focusCheckRef })`·`useMemo(() => wordsStarHandler(favPress))`·`finishWordsArrival` 에 넘기는 deps 객체. 이 줄을 동작으로 보려면 `WordsScreen` 의 효과(목록 GET·훅의 컨트롤러 만들기)까지 돌아야 해 jsdom(또는 `useEffect`·`useRef` 까지 대체하는 더 큰 시험 런타임)이 필요하다. 각 줄은 이름이 같은 값을 그대로 넘기는 한 줄이라 타입이 대부분을 막지만(빈 함수·`false` 로 바꾸는 것은 못 막음) **QA 브라우저 확인(감사 high_risk 2~6) 대상으로 남긴다**. 같은 이유로 교정 모음 X1~X6 도 스캔 그대로.
2. `useWordFavorites` 훅 자체(효과가 `mountFavoriteController` 에 `sendFavorite`·`optsRef` 를 넘기는 한 줄, `view` 의 `[state]` 메모)는 동작 시험 밖 — 부품(`mountFavoriteController`·`sendFavorite`·컨트롤러)은 각각 동작 시험.
3. 시트 GET 경로의 stamp(`useEffect` 안)는 서버 렌더에서 효과가 돌지 않아 동작 시험 밖(같은 `stampedSend` 를 쓰고 C8 이 순서를 고정). 저장·보관·보관 풀기·실패는 진짜 처리기로 시험.
4. `useState` 대체 하네스는 React 의 실제 일괄 처리·재렌더 타이밍을 흉내 내지 않는다(호출 순서와 값만 본다) — 「응답 뒤 readAt」은 가짜 `fetch` 응답 이벤트와 setState 순서로 판정. 실제 렌더 타이밍(낙관적 별이 저장 응답에 덮이지 않음)은 QA W6.
5. 정적 렌더 바이트 비교는 서버 렌더 기준(수화·효과 뒤 DOM 아님) — 효과 뒤 DOM 은 이 리팩터가 바꾼 코드(효과 처리·응답 꼬리)가 만드는 상태 값이 시험 W2·W3·W6 로 같음을 보였다.
