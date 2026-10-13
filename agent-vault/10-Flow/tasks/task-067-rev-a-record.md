---
tags: [type/task-note, domain/ask]
aliases: [REV-067A]
---
# task-067 감사 A (서버 S + 지난 질문 시트 U1) — reviewer 기록 (최종)

이력서: [[task-067-ask-history-title-paging]] · 개발 기록 [[task-067-dev-s-record]] · [[task-067-dev-u1-record]] · 가이드 `docs/screens.md` §27 · 감사 범위: S + U1 (U2·AskChatTab 은 감사 B — 여기서는 읽기만)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 2. QA 진행 가능. `native_change: false`(`prisma/`·`android/`·`plugins/`·`capacitor.config.ts` 변경 0 — `git status` 확인).
데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(v1 approved, hash verified) · `evidence.jsonl` 39행 approve(2026-10-13 16:19:46, prompt 16:19:27, 이 세션) — 에이전트가 approve/waive 를 대신 실행한 흔적 없음.

## 지적

| ID | 심각도 | 위치 | 요약 |
|---|---|---|---|
| REV-067A-1 | Medium | `AskHistorySheet.tsx` 배선 · `useAskHistoryPages.ts` 열기 훅 | 시트 부모-자식 배선을 지키는 시험이 없다 — 변이 4건 생존 |
| REV-067A-2 | Low | `historyPaging.ts` `isPaged`/`canNext` · `chats/index.ts` `Promise.all` | `total` 이 목록과 한 순간이 아니라 쪽 줄이 사라질 수 있다 |
| REV-067A-3 | Low | 소유·분담 | §27-9 표 밖 파일 2개·이중 소유 1개·시험 위치 변경 1개 (결함 아님, 기록) |

### REV-067A-1 (Medium) 시트 배선 시험 공백 [확실 — 변이로 증명]
- 증거: 공용 `Sheet` 가 포털이라 서버 렌더가 안 돼 `AskHistorySheet` 본체는 시험이 안 그린다(`AskHistoryList` 부품과 순수 함수만 행동 시험, 배선은 정규식 소스 스캔). 아래 4개를 일부러 고쳐도 `askHistoryPaging`·`askActivity`·`askChatTab`·`askCopy`·`askBehavior`·`askRoom`·`askHead` 96개가 **전부 통과**했다.
  - W1 `AskHistorySheet.tsx` `onPrev={() => turnPage(pages.prev)}` → `pages.next` (이전·다음 뒤바뀜)
  - W2 `deleteHistoryRow` 의 `reload: pages.reload` → `() => {}` (삭제한 행이 시트에 남는다)
  - W3 `useEffect(() => { if (open) refresh() })` 제거 (열 때 알약 목록 갱신 안 됨 — 시트 행 「답 만드는 중」 덮어쓰기가 낡음)
  - W4 `useAskHistoryPages` 의 `beginPage(n, 'open')` 호출 제거 (J2: 다시 열 때 지금 쪽을 다시 읽지 않음 — 순수 `beginPage('open')` 은 시험되지만 훅이 부르는지는 안 봄)
- 실패 시나리오: 누군가 리팩터링에서 위 줄을 잘못 바꿔도 시험이 초록이라 사용자 폰에서 처음 드러난다.
- 권고: 소스 스캔 단언에 `onPrev={() => turnPage(pages.prev)}`·`onNext={() => turnPage(pages.next)}`·`reload: pages.reload`·`if (open) refresh()`·`beginPage(n, 'open')` 줄을 추가(싸다), 또는 가짜 `Sheet` 로 `AskHistorySheet` 를 렌더하는 시험. 지금은 **QA 가 실제 브라우저로 반드시 확인**(아래 high_risk_areas).

### REV-067A-2 (Low) `total` 과 쪽 목록이 한 순간이 아님 [확실 — 입력을 주고 실행해 봄 / 발생 조건은 추측]
- 증거: `chats/index.ts` 180~182행 `Promise.all([findMany, count])` — 트랜잭션 아님(자기모순 가능). `findMany` 가 6행을 본 뒤 `count` 가 다른 기기의 삭제 뒤에 실행되면 `{items:5, nextCursor:'c1', total:5}`. 이 입력을 `settlePage` 에 넣어 실행: `isPaged=false`·`canNext=false`·`pages=1` → **쪽 줄이 없고 6번째 질문에 도달 못 한다**(시트를 다시 열 때 읽으면 회복).
- 같은 뿌리: 쪽 이동은 커서(키셋), 쪽 수·「3 / 4」 라벨은 `total` 이라, 다른 기기에서 새 대화가 생기면 마지막 쪽 라벨이 「3 / 4」인데 [다음]이 흐린 어긋남이 가능(자기 기기 새 대화는 `pageResetKey` 로 1쪽 복귀해 해당 없음). 단일 사용자 앱이라 드묾.
- 권고(선택): `isPaged` 에 `hasNext` 포함 — `(total ?? 0) > 5 || page > 0 || hasNext`(쪽 줄이 생기고 [다음]은 `canNext` 가 `page < pages - 1` 에 막히지 않게 `pages = max(historyPages(total), page + (hasNext ? 2 : 1))`). 안 고쳐도 사용자 데이터 손실은 없다.

### REV-067A-3 (Low) 분담 기록
- `topic/__tests__/removalA11y.test.ts` 2줄(허용 목록에 `AskHistorySheet.tsx` 추가): §27-9 표에 소유자가 없고 어느 개발 기록에도 한 사람이 적혀 있지 않다. 내용은 맞다(삭제 확인의 `describedBy` 는 가이드 27-5 C 지시).
- `(app)/ask/(tab)/page.tsx`: 가이드는 S 소유, U2 기록은 자기 파일로 적음(수정 시각 16:52 — S 의 16:29 이후). 내용은 가이드 27-7 A 와 같다.
- S 는 가이드가 말한 새 파일 `ask/__tests__/askRoute.test.ts` 대신 `(app)/_lib/__tests__/askLegacyRoom.test.ts`(+ `_lib/askLegacyRoom.ts` 순수 함수)에 썼다. T20 의 「`AskRoom` import 0 · `redirect(` · 잘못된 id → `/ask`」는 거기서 잠기고, `(tab)/page.tsx` callbackUrl 은 U2 의 `askChatTab.test` ⑭ 가 잠근다. 기능 차이 없음.
- 소유 밖·범위 밖: `.obsidian/`(untracked, 워크스페이스 설정 — task 와 무관). `prisma/`·`android/`·`plugins/`·`package.json`·`scripts/` 변경 0. 옛 에이전트 ask-u1/ask-u2 가 만진 흔적(내용상 §27-9 표 밖 로직 변경)은 발견 못 함 — 단 mtime 만으로는 사람을 가릴 수 없다([추측]).

## 영역별 확인 (증거 파일:줄)
**서버 S**
- A-S1 `total` [확실]: `chatListFilter(userId, kind)`(`chats/index.ts:141`) 한 함수를 `findMany`(`AND:[filter, afterChatCursor]`)와 `count({where: filter})` 가 같이 씀 → 소유자·`kind` 동일, 커서·`limit` 무관(시험 T25 + 변이 S1~S4 전부 잡힘). 모순 가능성은 REV-067A-2.
- A-S2 [확실]: 호출처 `listChats` = `app/api/v1/chats/route.ts:12` 한 곳(grep). 응답 `{items,nextCursor,total}` additive, 정렬 `lastMessageAt desc, id desc`·커서 모양 불변, `ListChatsDeps` 는 기본값 있는 3번째 인자라 라우트 불변. conversation 층이 자기 테이블(`chat`)만 읽고(import 방향 변화 0), 스키마·인덱스 변경 0(`@@index([userId, kind, lastMessageAt])` 이 `count` 에도 맞음). api-contract #27·§2-18-A 10항이 코드와 일치.
- A-S3 [확실]: `ask/[chatId]/page.tsx` 는 `legacyAskRoomTarget` 만(DB 조회 0 → 없는 id·남의 id 같은 응답, 존재 비노출), 목적지는 항상 내부 상대 경로. 이상한 id 21종을 직접 실행: 공백·`/`·`..`·`%`·`?`·`#`·`&`·`//evil.com`·`https://…`·한글·개행·NUL·65자↑·비문자열 전부 `/ask`, 64자·`cuid_x-Y_1` 은 `/ask?chat=<id>`. 비로그인은 `callbackUrl=encodeURIComponent(target)`(새 주소) — `redirect` 307(`permanentRedirect` 아님, 시험이 잠금). 변이 S5(`permanentRedirect`)·S6(검사 제거) 잡힘.

**시트·쪽 U1**
- A-U1 커서 스택: 다음→이전→다음(`pushCursor` 가 뒤쪽 옛 커서를 버림), `seq` 로 옛 응답 무시(변이 M7 잡힘), 넘기는 중 연타(`canNext/canPrev` 가 `status==='ready'` 만 허용 — `beginPage` 가 같은 상태를 돌려줌), 실패→`pageError`→재시도(같은 커서), 빈 쪽·`page>0` → 앞 쪽, `resetPager`(seq 보존), `pageAfterDelete`(변이 M6 잡힘)는 코드와 시험으로 확인. J2(닫았다 열 때 쪽 유지)는 `AskChatTab` 이 시트를 늘 마운트(`AskChatTab.tsx:183`)하고 쪽 상태가 시트 안 훅에 있어 성립; 새 대화 생성 때만 `setPageResetKey`(`AskChatTab.tsx:157`, 변이 W5 잡힘). 단 열기 훅 배선은 REV-067A-1.
- A-U2 [확실]: 마지막 쪽 숨은 행(`FillerRow`: `invisible`+`aria-hidden`, 실제 행과 같은 `ASK_ROW_CLASS` 두 줄 구조 — 고정 높이 아님), 쪽 오류 4개·5개 이하/0개 0개(`fillerCount`, 변이 M11 잡힘). 쪽 단추는 `aria-disabled`+`onClick={undefined}`(변이 M4 `disabled` 잡힘), `h-11 min-w-[92px]`, `nav aria-label="지난 질문 쪽"`, 가운데 라벨 `aria-hidden` + 같은 뜻의 `role="status" sr-only` 한 줄. 행 ⋯ 는 `h-11 w-11`, 행 `pr-[52px]`. 행 높이 차(배지 유무)는 계산상 ≈1px — 실측은 QA Q5.
- A-U3 [확실]: 하위 화면 `row→rename→confirm`; 초점 `focusIn('[data-sheet-first]'|'[data-sheet-cancel]'|'[data-ask-row-more]')`(`Btn` 이 `...props` 로 `data-*` 전달 확인), 삭제 뒤 비지금 대화는 시트 제목 `h2`; `Sheet dismissible={!busy}`·`describedBy` 확인 화면만(`removalA11y` 허용 목록 갱신). 잠금: 「이 대화」 화면 줄과 `remove` 안 `deleteHistoryRow` 두 곳에서 `locked` 면 요청 0(변이 M9 잡힘). 지금 대화 삭제: `deps.onDeleted(id, id === currentChatId)` **한 번**(`historyPaging.ts:226`), 토스트는 시트가 `onToast` 로 한 번 — `AskChatTab.onDeleted`(`:116`)는 토스트를 내지 않고 `startFresh()` 만, `flash` 효과는 `ChatMenuSheet` 경로 표지만 읽음 → 중복 없음(B 감사용 사실 기록). 제목 저장: `pages.patch` + 토스트 + `onRenamed`.
- A-U4 [확실]: `useAskActivity` 읽기 URL `limit=${ASK_LIST_LIMIT}`(20), `setList(r.items)` 전체 교체 — 알약은 시트와 독립(변이 M5a `slice(0,5)`·M5b `ASK_LIST_LIMIT=5` 잡힘). `more`·`appendRooms`·`mergeFirstPage` 삭제는 알약 계산을 바꾸지 않는다. 삭제된 대화: `forget` 으로 `waiting`/`newAnswer` 저장소에서 먼저 지우고(변이 M13 잡힘) `refresh()` 로 20개를 다시 읽는다 — DELETE 가 끝난 뒤에 읽으므로 되살아나지 않는다.
- A-U5 [확실]: `askCopy` 새 키(`head.*`·`rename.*`·`history.*`) 가 §27-3 F·27-4 F·27-5 E 표와 글자 같음, 엔진명 정규식(`reazon|whisper|style-bert|claude|ollama|qwen|sherpa|model_id|speaker_id`) U1 파일 0건, 「이름 바꾸기」·「이전 질문 더 보기」 `src` 0건, `router.*`·`useRouter`·`replaceState`·`fetch(`·`window.Capacitor` U1 파일 0건. 남긴 최상위 `toList`('질문으로')·`notFoundTitle` 은 `useAskInput.tsx:347`·`logic.ts:338` 이 실제로 쓴다(가이드 27-7 C 의 「지울 목록」과 다르지만 올바른 판단). 관찰: `ASK_COPY.toList`('질문으로')와 `ASK_COPY.history.toList`('목록으로')가 같은 키 이름·다른 뜻이라 혼동 여지 — 지적 아님.
- A-U6: 아래 변이.

## 변이 시험 — 27회 실행, 23 잡힘, 4 생존
전용 미러 `~/.node-local/thekaiwa-rev067a`(매번 `cp --remove-destination` 으로 새 inode → 수정 → NFS 원본으로 복원, 마지막에 `sync-local.sh` 후 11개 파일 `cmp` 일치 확인, 원본 미러 `~/.node-local/thekaiwa` 오염 0 확인).
- 잡힘(23): ① `ASK_HISTORY_PAGE` 5→6 ② `ceil→floor` ③ `> 5→>= 5` ④ `aria-disabled→disabled` ⑥ `pageAfterDelete` 빈 쪽 머묾 ⑦ 옛 응답 `seq` 검사 제거 ⑤ 알약 목록 `slice(0,5)` · `ASK_LIST_LIMIT 5` · `rowRunning` 쪽 값만 · 잠금 무시 · `fillerCount` 0 · `onDeleted(id,false)` 고정 · `forget` 누락 · 쪽 초기화 호출 제거(W5) · 지금 대화 닫기 무시(W6) · 시트 삭제 알림 항상(W7) · 행 안 중첩 단추(W8) · S1 `count` 에 커서 · S2 `kind` 조건 제거 · S3 `count` 전체 사용자 · S4 `total` 0 고정 · S5 `permanentRedirect` · S6 id 검사 제거.
- 생존(4, REV-067A-1): W1 이전/다음 뒤바뀜 · W2 삭제 뒤 `reload` 없음 · W3 열 때 `refresh()` 없음 · W4 열 때 다시 읽기 없음.

## QA 에 넘길 high_risk_areas
1. **쪽 이동 방향·초점**(W1): 지난 질문 12개 계정으로 1/3→2/3→3/3→2/3, 단추를 누른 자리에 초점이 남는지, 3/3 에서 [다음]이 흐리고 눌러도 무반응·초점 유지, 쪽 줄 위치 변화 ≤1px(글꼴 130% 포함 — 배지 있는 행과 숨은 행 높이 차).
2. **시트에서 삭제**(W2): 다른 대화 삭제 → 행 사라짐·「모두 n개」 감소·뒤 행이 올라옴·마지막 쪽이 비면 앞 쪽; 지금 대화 삭제 → 시트 닫힘·빈 대화·주소 `/ask`·토스트 1번·뒤로가기=탭 전 화면; 답 만드는 중 행은 요청 0+토스트; 네트워크 끊고 삭제 실패 한 줄.
3. **다시 열기**(W3·W4, J2): 2쪽에서 닫았다 열면 2쪽을 다시 읽어 새 값(「답 만드는 중」·「새 답」)이 나오는지, 새 대화를 만든 뒤에는 1쪽부터인지(이어 묻기는 보던 쪽 유지).
4. **알약**(Q8): 6번째 이후 대화가 답을 만드는 중이어도 알약 「답 만드는 중」→ 끝나면 「새 답 도착」+토스트 1번(시트가 5개만 읽어도).
5. **경계 개수**: 대화 0·5·6개 계정(쪽 줄 유무·빈 상태·6개에서 2쪽), 행 ⋯ → 제목 바꾸기/삭제 하위 화면의 Esc·초점·`aria`(TalkBack 쪽 안내 「3쪽 중 2쪽 · 모두 12개」).
6. **옛 주소**(Q4): `/ask/<id>` 직접 입력(로그인 상태·로그아웃 상태→로그인 뒤 그 대화), 잘못된 id→빈 대화, 남의 id→빈 대화+토스트. 3폭(360/390/412)·라이트/다크.
