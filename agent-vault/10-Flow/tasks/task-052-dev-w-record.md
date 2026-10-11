---
task: task-052
role: developer
agent: dev-W
scope: 화면(웹) — screens.md §20-7 파일만
tags:
  - type/task-record
  - domain/native
  - domain/lesson
---
# task-052 dev-W 기록 — 카카오톡 공유하기 수신 화면

> 이력서 [[task-052-improve-kakao-share-target]] · 네이티브·브리지 기록 [[task-052-dev-n-record]] · 계약 `docs/screens.md` §20 + 승인 데모 `docs/demo/task-052-share-target-v1.html`(D1~D6 모두 A).
> 실행 미러: `$HOME/.node-local/thekaiwa-share052w`(node_modules = `cp -al` share052n). DB 접속 없음·dev 서버 없음·커밋 없음.

## 데모 게이트
```
DEMO_GATE_PASSED
task: task-052
```
(10:27 실행, status approved · approved_version v1 · demo docs/demo/task-052-share-target-v1.html)

## 체크포인트 (20-8 순서)
- [10:27] 착수 — §20 전체·§12-2 C·데모 SH/arrive/trim 로직·브리지(sharedText.ts·bridge.ts·index.ts)·fake-capacitor SharedText 흉내·현재 화면 소스 읽음. 전용 미러 생성.
- [10:31] 20-8 ①② 완료 — `src/components/shell/shareTarget.ts`(상수·`isShareCallback`·순수 판정 `decideShareAction`) + 시험 9건, `src/components/lesson/pasteShare.ts`(`normalizeShared`·`arriveShare`·`swapShare`·`trimToLimit`·`trimRemoved`·`charCount`) + 시험 15건. 대상 실행 24/24 pass.
- [10:31] 20-8 ③ 완료 — `lessonCopy.ts` 에 `PASTE_SHARE`·`PASTE_TRIM` 추가(기존 `PASTE` 그대로). 문구는 데모 v1 `SH` 와 글자 단위 대조 시험으로 고정.
- [10:33] 20-8 ④ 완료 — `LessonPasteScreen.tsx`: `TrimRow`(웹·앱 공통) → `ShareBanner`·`swap` → `fromShare` 마운트 순서(초안 복원 → handledRef → 주소 재확인 → replaceState → isNativeApp → consume, 취소 플래그 없음) → `SHARE_EVENT` 리스너(앱일 때만, busy·겹침이면 무시, 도착 시 띠 scrollIntoView nearest).
- [10:33] 20-8 ⑤ 완료 — `paste/page.tsx`: searchParams `from` → `fromShare` prop, 로그인 없으면 callbackUrl 에 `?from=share` 유지.
- [10:33] 20-8 ⑥ 완료 — 로그인 `page.tsx`: `isShareCallback(callbackUrl)` 일 때만 안내 한 줄(오류·미설정 알림 아래, AppLoginArea 바로 위).
- [10:34] 20-8 ⑦ 완료 — `ShareReceiver.tsx`(return null, 앱 아니면 effect 첫 줄 return) + 루트 `layout.tsx` 의 `<KeyboardInset />` 바로 다음에 마운트. 브리지는 dev-N 산출이 이미 커밋돼 있어 실물 함수로 연결.
- [10:36] 20-8 ⑧(코드 범위) 완료 — 시험·tsc·eslint·next build 통과(아래). 브라우저·가짜 브리지 실측은 하지 않음(dev 서버·DB 금지 — QA 몫).

## 변경 파일
- 생성: `src/components/shell/ShareReceiver.tsx` · `src/components/shell/shareTarget.ts` · `src/components/lesson/pasteShare.ts` · `src/components/lesson/__tests__/pasteShare.test.ts` · `src/components/shell/__tests__/shareTarget.test.ts`
- 수정: `src/app/layout.tsx`(`<ShareReceiver />` 한 줄 + import) · `src/components/lesson/LessonPasteScreen.tsx` · `src/components/lesson/lessonCopy.ts`(`PASTE_SHARE`·`PASTE_TRIM`) · `src/app/(app)/study/today/talk/new/paste/page.tsx` · `src/app/(auth)/login/page.tsx`
- 미커밋: 위 10개 + 이 기록 파일(커밋은 Leader). `src/modules/**`·`android/**`·`docs/**`·데모·`tests/**` 손대지 않음.

## 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-share052w`)
- 신규 시험: `DATABASE_URL=mysql://invalid… node --import tsx --test src/components/lesson/__tests__/pasteShare.test.ts src/components/shell/__tests__/shareTarget.test.ts` → `# tests 24 · # pass 24 · # fail 0`
- 회귀: `find src/components/lesson src/components/shell -name '*.test.ts'` 전부 → `# tests 148 · # pass 148 · # fail 0 · # skipped 0`
- `node node_modules/typescript/bin/tsc --noEmit` → rc=0, 출력 없음
- `node node_modules/eslint/bin/eslint.js src/components src/app` → rc=0, `✖ 5 problems (0 errors, 5 warnings)` — 경고 5건은 전부 기존 파일(`admin/trace/DiagnosticsScreen.tsx`·`settings/{LearningSettings,OnDeviceDiagnosticsCard,SpeechSettings,VoiceSettings}.tsx` 의 set-state-in-effect), 바꾼 파일 0건
- `DATABASE_URL=mysql://invalid… ./node_modules/.bin/next build > /tmp/claude-1000/build052w.log 2>&1` → `exit=0`, `✓ Compiled successfully`, `Generating static pages (20/20)`(루트 레이아웃 = `ShareReceiver` 포함 정적 프리렌더 `/_not-found` 등 성공 → SSR 안전), `ƒ /study/today/talk/new/paste`·`ƒ /login`. Turbopack 경고 3건은 기존(`conversation/persona/loader.ts`·`engine/adapters/llm/claudeCli.ts`).
- 엔진명·`window.Capacitor`·`console.`·`localStorage` grep(바꾼 8개 파일) → 0건

## 설계-코드 차이 (보이는 의미 변화 없음 — Leader 확인용)
1. `isShareCallback` 에 **같은 출처 확인** 추가 — 절대 주소·`//다른곳/…` 은 경로가 같아도 거짓(가이드는 경로·from 만). 로그인 안내 줄 표시 조건만 좁아지고 `ShareReceiver` 가 만드는 값은 언제나 상대 주소라 실사용 차이 없음.
2. 20-3 의사코드의 분기를 순수 함수 `decideShareAction(pathname, search)`(signal·stay·login·go)와 상수 `SHARE_LOGIN_HREF` 로 `shareTarget.ts` 에 뺐다(시험 가능하게). 동작은 의사코드와 같다.
3. 붙여넣기 화면 마운트 ②: `handledRef` 다음에 **현재 주소에 `from=share` 가 실제로 있는지 한 번 더 확인**한다. 이유: Next 16.3.2 의 패치된 `history.replaceState` 는 RSC 트리(페이지 세그먼트 키 `__PAGE__?{"from":"share"}`)를 그대로 history state 에 복사한다 → 다른 화면으로 갔다가 기기 뒤로 가기로 이 항목에 돌아오면 캐시된 prop `fromShare=true` 로 다시 마운트될 수 있고, 그러면 consume → null → 「받지 못했어요」가 뜬다. 주소 재확인으로 ②-3 의 의도(새로고침·뒤로·앞으로 가기에서 재수신·토스트 금지)를 지킨다. 같은 커밋에서 URL 이 먼저 바뀐다는 근거: `node_modules/next/dist/client/components/app-router.js` HistoryUpdater 가 `useInsertionEffect` 로 pushState(패시브 effect 보다 먼저).
4. **`consumingRef`**(가이드에 없음): 마운트 consume 이 진행 중일 때 `SHARE_EVENT` 가 오면 이벤트 쪽은 꺼내지 않는다 — 두 경로가 한 번만 주는 값을 겹쳐 꺼내 마운트 쪽이 null(→ 잘못된 「받지 못했어요」)을 받는 일을 막는다. 그 사이 온 새 공유는 네이티브에 남아 다음 resume 에 셸이 다시 확인(=`busy` 규칙과 같은 방식).
5. `ShareReceiver` 안전 해제 타이머를 ref 로 두고 effect 정리에서 지우지 않는다 — 개발 모드 effect 이중 실행에서 첫 확인이 잡은 `pending` 이 영영 안 풀리는 일 방지. 운영(루트 레이아웃 언마운트 없음)에는 영향 없음.
6. 공유 아이콘 SVG(데모 `IC_SHARE` 그대로)를 붙여넣기 화면과 로그인 화면에 **두 벌** 둠 — 20-7 파일 목록 밖에 공용 아이콘 파일을 만들지 않으려고(`shareTarget.ts` 는 서버도 쓰는 `.ts`).
7. 도착 후 띠 스크롤은 상태(`scrollSeq`) 증가 → 그려진 뒤 effect 에서 `scrollIntoView({block:'nearest'})`(그리기 전에 부르면 띠가 없을 수 있어서).

## 미확인 (QA·실기기)
- 브라우저 실측 전부(3폭 360/390/412 × 780, 가짜 브리지 상태 A·B·C1·C2·C3·D·D 받지 못함·E, 띠·자르기 줄 가로 넘침, 높이) — dev 서버 금지로 하지 않음.
- 차이 3의 뒤로 가기 재마운트가 실제로 일어나는지(일어나도 막히는지) — QA: 공유 → 채움 → 링크로 다른 화면 → 기기 뒤로 → 토스트·재채움 없어야 함.
- `replaceState` 뒤 화면이 다시 마운트되지 않는지(되면 띠가 사라짐) [가능성 높음: 같은 트리 RESTORE 라 재마운트 없음].
- 붙여넣기 주소(표시 없음)로 콜드 스타트하는 드문 경우 `SHARE_EVENT` 가 화면 리스너보다 먼저 가는지 [가능성 높음: peek 왕복 뒤라 리스너가 먼저 달림].
