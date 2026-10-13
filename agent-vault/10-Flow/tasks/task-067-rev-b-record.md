---
task: task-067
role: reviewer
part: 감사 B (머리 제목 줄 · 제목 바꾸기 공용 칸 · 대화 열기 연결 · D4 · room 정리 + 실제 Next 라우터 관점)
tags: [type/task-note, domain/ask]
---
# task-067 reviewer 기록 — 감사 B (REV-067B)

본 이력서: [[task-067-ask-history-title-paging]] · 개발 기록 [[task-067-dev-u2-record]] · 같은 종류 결함 이력 [[task-066-rev-u1-record]] F1(High, `history.state` 를 넘기면 Next 가 라우터 동기화를 건너뜀).
확신 표시: [확실] = 이번 세션에 코드·Next 소스·실행으로 직접 확인 / [가능성 높음] = 소스 읽기 기반 추론(실제 브라우저 미확인) / [추측].

## 판정: PASS_WITH_NOTES  (Critical 0 · High 0 · Medium 2 · Low 3) — native_change: false

### 지적
| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-067B-1 | Medium | `src/components/chat/ChatRenameForm.tsx:201-202,222` | 질문 제목 칸: 빈 값/초과 오류가 입력을 고쳐도 [저장]을 다시 누를 때까지 남는다(승인 데모는 입력하면 지움) |
| REV-067B-3 | Medium | `src/components/ask/AskChatTab.tsx:36-38,61` + 시험 `askChatTab.test.ts:146-151`(T22) | 주소 쿼리가 **없고** 서버 prop 이 낡았을 때(=`?chat=A` 로 서버가 그린 기록에서 「새 질문 시작」 뒤 다른 탭 갔다 뒤로) 서버 값 A 가 되살아난다 |
| REV-067B-2 | Low | `ChatRenameForm.tsx:225-227` (옛 `ChatMenuSheet` rename [취소]) | 회화·채팅 제목 바꾸기: 저장 중 [취소]가 옛엔 메뉴로 갔고 지금은 아무 일 없음(개선에 가깝지만 「동작 불변」 보고와 다름) |
| REV-067B-4 | Low | `src/components/ask/AskHeadTitle.tsx:22` | 머리 단추의 `onClick={onRename}` 을 지워도 시험 통과(변이 M12 생존) — 눌러도 아무 일 없는 단추가 시험에 안 잡힘 |
| REV-067B-5 | Low | `ChatRenameForm.tsx:184` | 저장 이중 제출 방어 `if (busy) return` 삭제 변이 생존(M14) — 실제 위험은 낮음(React 가 click·keydown 을 동기 반영) |

#### REV-067B-1 상세
- 실패 시나리오: 제목 칸을 비우고 [저장] → 「제목을 적어 주세요」 + 빨간 테두리 + `aria-invalid` → 사용자가 글을 쓴다 → 글자 수 줄은 바로 바뀌지만 **오류 문장·빨간 테두리·`aria-invalid` 는 그대로**(유효한 제목인데 「제목을 적어 주세요」가 보임). 화면 읽기도 `role="alert"` 이전 오류를 `aria-describedby` 로 계속 읽는다.
- 증거 [확실]: `ChatRenameForm.tsx:201-202` 오류·invalid 는 저장 때만 세팅, `:222` `onChange={setValue}` 가 둘을 안 지움. 승인 데모 `docs/demo/task-067-ask-history-v1.html:1529-1531` input 핸들러는 `rnErr` 가 `fail` 이 아니면 지운다(데모 D·empty → 입력하면 안내 줄·테두리 복귀).
- 권고: `ask` 변형에서 `onChange` 때 `invalid`(빈 값/초과) 오류를 지움(저장 실패 `rename.fail` 은 데모대로 유지). 시험 1개 추가. 데모 gate 분류 = defect(승인본 동작 누락).

#### REV-067B-3 상세
- 근거 [확실]: Next 16.3.2 `segment-cache/bfcache.js` `readFromBFCache` 주석 「back/forward 에서는 데이터가 얼마나 낡았든 상관없다 — staleness 검사를 건너뛴다」. 그리고 `replaceState`(우리 `replaceAskUrl`)는 ACTION_RESTORE 로 **현재 트리를 그대로** 두고 주소만 바꾼다(`restore-reducer.js`), 즉 그 기록이 처음 서버에서 그려진 payload(`initialChatId`)는 안 바뀐다.
- 재현 경로 [가능성 높음]: `/ask?chat=A` 가 **서버에서 그려진** 기록(옛 `/ask/<id>` 리다이렉트 · 새로고침 · 근거 카드 → 수업 → 머리 ← 「질문으로」(`Link` push `/ask?chat=A`)) → 머리 ⋯ 「새 질문 시작」(replace → 주소 `/ask`, 빈 대화) → 하단 탭 「공부」 → 휴대폰 뒤로. 기록은 주소 `/ask`(q=null) 지만 되살아난 페이지 prop `initialChatId='A'` → `askInitialConvId(null,'A')==='A'` → **빈 대화가 아니라 A 가 열리고** 이어서 묻는 질문이 A 에 붙는다(주소와 화면 불일치). task-066 은 새 질문이 `router.push` 라 새 기록·새 payload 였지만 D4 로 replace 가 되면서 생긴 틈. `onGone` 의 `replaceUrl('/ask')` 도 같은 틈.
- 서버 prop 이 낡은 값일 수 있는 건 가이드 27-1 D 의 전제(「페이지 조각은 처음 서버가 그린 것일 수 있다」)와 같은 이유 — 그런데 방어가 `q` 가 있을 때만 이긴다. `useSearchParams()` 는 서버 렌더에서도 실제 쿼리를 주므로(동적 페이지) 서버 prop 은 사실상 중복이다.
- 권고: `askInitialConvId` 가 `initialChatId` 를 쓰지 않게(`isAskId(q) ? q : null`) 하고 T22 의 `(null,'A')==='A'` 단언을 `null` 로 바꿈. 서버 prop 은 그대로 둬도 무해(미사용). **QA 가 먼저 실제 Next(운영 빌드)로 재현을 확인**하고 고치는 순서를 권한다.

#### REV-067B-2/4/5
- B-2: 옛 코드 `<Btn variant="ghost" onClick={() => setMode('menu')} aria-disabled={busy}>`(`Btn` 은 `aria-disabled` 클릭을 막지 않음 [확실] `common/ui.tsx:94-108`). 새 코드 `onCancel={() => { if (!busy) onCancel() }}`. TALK/CHAT 화면에서 저장 중 취소가 막힌다 — 바람직하나 개발 기록(「마크업·동작 모두 지금 그대로」)·시험 T16(마크업만)과 어긋난다. 허용하려면 기록만 정정.
- B-4/B-5: 변이 시험 결과 참고.

### 확인 끝난 항목 (문제 없음)
- **B-R1 [확실]** `src/components/ask/**`(시험 제외) `router.push(`·`router.replace(`·`useRouter`·`history.state`·`pushState(` 0건, `replaceState(` 는 `logic.ts:161` `h.replaceState(null, '', url)` 한 곳, 호출은 `AskChatTab.tsx:29` 한 곳. `chat/` 의 `router.replace` 는 `ChatMenuSheet` 삭제(가이드 예외)와 `ChatRoom.tsx:106`(`/chat/<askId>` 를 잘못 연 드문 경로 — 서버 요청 1회·기록 안 늘어 안전; `(tab)/loading.tsx` 자리표시가 잠깐 뜰 수 있음).
- **B-R2 (Next 16.3.2 소스)** `replaceState(null,…)` → 패치된 replaceState 가 현재 `__NA`/TREE 를 복사하고 ACTION_RESTORE(현재 트리) → `canonicalUrl` 갱신 → `useSearchParams` 가 새 주소 [확실]. 같은 트리라 `startPPRNavigation` 은 null(하드 이동)이 아니다(null 은 새 root layout·not-found 뿐) → 서버 요청 0·다시 마운트 0 [가능성 높음 — task-066 QA 실측과 같은 호출 모양].
  - ① 공부→질문→A→B→뒤로 = 공부(기록은 하단 탭 `Link` push 1칸뿐) ✓ ② 새 질문 시작(`startFresh` 상태→주소) ✓ ③ 첫 질문 방 생성(`onCreated` 상태→주소) ✓ — 둘 다 `askConvTransition` 가 `none`.
  - ④ 열기 뒤 하단 탭 「질문」 재누름(push `/ask`, q: B→null → 전이 `'new'` → 빈 대화) → **뒤로가기**: popstate → `dispatchTraverseAction(location.href, E1.tree)` → `completeTraverseNavigation` 이 `canonicalUrl=/ask?chat=B` → q null→B → `askConvTransition(null,B,null)` = `{open:B}` → B 다시 열림 [가능성 높음]. 쿼리만 다른 이동이라 페이지 조각은 `bfcacheId` 를 이어 받아 다시 마운트되지 않으므로(`ppr-navigations.js:102-108` 주석) 렌더 중 비교(`q !== prevQ`)가 덮고, 다시 마운트돼도 `askInitialConvId(q,…)` 가 덮는다. **실제 브라우저 확인은 QA.**
- **B-R3** `askInitialConvId`: 형식 틀린 q(`../x`, 빈 값) → `isAskId` 거절 → 서버 값(위 B-3 참고), q 있으면 q 우선(Q3 근거 카드→수업→뒤로) ✓. 시험 T22 있음.
- **B-R4** 열기 `openConv`: 상태(`setConv`+`hint`) → 주소(`replaceUrl`) → 시트 닫기 → `focusPill` 순서 [확실, T10]. `AskRoom key={chatId}` 라 이전 대화의 늦은 응답은 언마운트 + `cancelled` 로 새 화면에 섞일 수 없음 [확실 `AskRoom.tsx:293-324`]. 같은 대화 다시 고르기 = 시트만 닫기(T11). 없어진 대화 `onGone` = `replaceUrl('/ask')`+토스트+`startNew`(`startNew` 가 `conv.id=null` 이라 전이 `none`). 첫 질문 방 생성 중(Q9)에 다른 대화를 열면 `onCreated` 가 새 대화로 화면을 바꾼다 — 가이드 27-1 C 가 정한 동작(보낸 질문 우선), 글자 모드 실패는 초안 저장소에 남고 말 모드 실패의 「보내지 못한 말」 띠만 언마운트로 잃음(Low 이하, 기록만).
- **B-R5 (소스)** `AppBar heading` 미지정 출력 불변(T18, 변이 M5 KILLED) · 지정 시 `h1` 1개 안 단추 · `AskHeadTitle` 3상태, 불러오는 중은 단추 아님 · 단추 `h-11`(44px) · 둘째 줄 `min-w-0 truncate`(변이 M16 KILLED) + 연필 `flex-none` + h1/단추 `min-w-0 flex-1` 로 360px 가로 넘침 소스상 없음 · 읽기 이름 `질문 · 지금 대화 「…」 — 눌러서 제목 바꾸기`. 3폭×알약 3상태 실측은 QA Q10.
- **B-R6** 서버 #30 `parseTitle` = `sanitizeText`(제어문자 제거·trim) 후 `codePointLength`(100), 클라 `renameCheck` = `trim` 후 `Array.from().length` → 이모지 경계 불일치 없음 [확실]. 앞뒤 공백 trim · 빈 값/초과 요청 0(T15) · `variant='default'` 마크업 불변(T16) · `startMode='rename'` 취소=닫기(T17) ✓. 제어문자만 있는 제목은 클라 통과·서버 400(일반 실패 문구) — 기존 동작과 같음.
- **B-R7 [확실]** `AskRoom` `variant`·`BackBar`·`Link`·`useRouter` 0, `routes.ts` 에 `'/ask/'` 0(`isFocusRoute('/ask/abc')===false`), 근거 돌아오기 주소 늘 `askChatHref`(`SourceList.tsx:25`), 죽은 코드(`askRoomRedirect`·`scopeLinePaddingBottom`·`ScopeLineVariant`·`AskVariant`·`returnHref`) 잔존 0, eslint 0. 옛 `/ask/<id>` 리다이렉트 순간 하단 탭이 숨던 문제는 집중 화면 목록에서 빠져 해소(QA 3폭에서 첫 그림 확인).
- **B-R8 [확실]** `AskChatTab` → `AskHistorySheet` props 9개 전부 시트 선언과 일치(필수까지), `renamed`·`onDeleted` 는 토스트를 내지 않아 이중 토스트 없음(ChatMenuSheet 의 「제목을 바꿨어요」 1회), `AskHistoryButton ref` prop OK, 초점은 `focusPill`(`afterCommit`).

### B-R9 소유 밖 변경 (git status 대조)
- §27-9 A 소유 표 밖: `src/components/ask/__tests__/askBehavior.test.ts`(U2, M-2 블록 2줄 — `SourceList` 인자 삭제의 직접 결과, 개발 기록에 공개), `src/components/topic/__tests__/removalA11y.test.ts`(Leader 허용 목록 1줄 `AskHistorySheet.tsx` + 주석), `src/app/(app)/_lib/askLegacyRoom.ts` + `_lib/__tests__/askLegacyRoom.test.ts`(S 새 파일 — 가이드는 page 인라인·`askRoute.test.ts` 였음, 위치만 다름), `src/modules/conversation/__tests__/{fakeChatListDb,task067ChatListTotal}.ts`·`src/app/api/v1/__tests__/task067ChatsRouteTotal.test.ts`(S 시험). 모두 목적상 정당·공개됨. 의심스러운 변경 없음(옛 `ask-u1`/`ask-u2` 가 건드렸다는 증거 없음: 변경 29개 파일 mtime 이 16:46~16:56 한 구간, 소유 표 밖 소스(.tsx) 변경 0). `.obsidian/` 는 untracked(이번 task 무관).

### B-R10 변이 시험 (전용 미러 `~/.node-local/thekaiwa-rev067b`, 매번 원복·NFS 소스 무수정) — 17회 실행 · 15 KILLED · 2 SURVIVED
| # | 변이 | 결과 (잡은 시험) |
|---|---|---|
| M1 | `replaceAskUrl` 첫 인자 `null`→`window.history.state` | KILLED (T9, F1) |
| M2a | 「새 질문 시작」을 `router.push('/ask')` 로 | KILLED (T9) |
| M2b | `AskRoom.newQ` 에 `router.push('/ask')` 추가 | KILLED (T9, 머리 시험) |
| M3 | `openConv` 주소 먼저/상태 나중 | KILLED (T10) |
| M4 | 제목 길이 `cpLength`→`.length` | KILLED (T15) |
| M5 | `AppBar` heading 없을 때 클래스 `text-xl`→`text-lg` | KILLED (T18) |
| M6a | `variant='default'` 칸에 「n / 100」 추가 | KILLED (T16) |
| M6b | TALK/CHAT 메뉴가 `variant="ask"` 사용 | KILLED (T17) |
| M7 | `routes.ts` 에 `'/ask/'` 되살림 | KILLED (⑭·T21·routes) |
| M8 | `askInitialConvId` 서버 값만 | KILLED (T22) |
| M9 | rename [취소] 항상 메뉴로 | KILLED (T17) |
| M10 | `ChatRoom` 이 옛 `/ask/<id>` 로 replace | KILLED (T21) |
| M11 | 지금 대화 행도 다시 엶 | KILLED (T11) |
| **M12** | 머리 단추 `onClick={onRename}` 삭제 | **SURVIVED** (B-4) |
| M13 | IME 조합 중 Enter 저장 | KILLED (T15) |
| **M14** | 저장 이중 제출 가드 삭제 | **SURVIVED** (B-5) |
| M15 | 머리 탭이 rename 대신 메뉴로 | KILLED (머리 시험) |
| M16 | 둘째 줄 `min-w-0 truncate` 삭제 | KILLED (T19) |
기준선: U2 관련 시험 6파일 58개 통과.

### QA 에 넘기는 high_risk_areas (실제 Next 라우터·운영 빌드, 360·390·412)
1. **B-3 재현**: 서버에서 `/ask?chat=A` 로 그려진 기록(새로고침 또는 근거 카드→수업→← 「질문으로」)에서 ⋯ 「새 질문 시작」 → 하단 탭 「공부」 → 휴대폰 뒤로: 기대 = 빈 대화(주소 `/ask`). A 가 열리면 B-3 확정.
2. **B-R2 ④**: 지난 질문에서 B 열기 → 하단 탭 「질문」 재누름(빈 대화) → 뒤로 → B 가 다시 열리는지(빈 대화에 머물면 FAIL), 이어서 한 번 더 뒤로 = 공부 탭. 그리고 Q1(열기: RSC 요청 0·주소 `/ask?chat=<id>`), Q2(열기·새 질문 시작·첫 질문 생성 뒤 뒤로 = 공부 탭, `history.length` 불변).
3. 앱(Capacitor) 안드로이드 뒤로가기 버튼: 기록이 늘지 않아 공부 탭/종료 흐름이 의도대로인지.
4. Q6 제목 바꾸기 세 진입 + 키보드 위 [저장] 보임, **오류 뒤 입력하면 오류가 사라지는지**(B-1 수정 전엔 남음), 머리 단추가 실제로 눌리는지(B-4).
5. Q9 경합: 첫 질문 보내자마자 시트에서 다른 대화 → 새 대화 화면으로 바뀌고 질문·답 정상, 방 1개.
6. 회화·채팅 ⋯ → 제목 바꾸기 화면이 이전과 같은지(글자 수·안내 줄 없음, 저장 중 [취소] 무반응 B-2).
7. 옛 `/ask/<id>` 직접 입력·로그아웃 상태: 첫 그림부터 하단 탭이 보이는지(깜빡임 없음), 로그인 뒤 그 대화로.
8. Q10 머리 3폭×알약 3상태 둘째 줄 말줄임, 글꼴 130% 에서 머리 52 안.
