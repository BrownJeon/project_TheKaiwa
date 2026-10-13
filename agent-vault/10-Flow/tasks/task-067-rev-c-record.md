---
task: task-067
role: reviewer
part: 감사 C (감사 B 지적 REV-067B-1~5 수정분 좁은 재감사)
tags: [type/task-note, domain/ask]
---
# task-067 reviewer 기록 — 감사 C (REV-067C)

본 이력서: [[task-067-ask-history-title-paging]] · 수정 기록 [[task-067-dev-fix-record]] · 원 지적 [[task-067-rev-b-record]].
확신 표시: [확실] = 이번 세션에 코드·Next 소스·실행으로 직접 확인 / [가능성 높음] = 소스 읽기 기반 추론(실제 브라우저 미확인) / [추측].
범위: 수정 7개 파일(`ChatRenameForm.tsx` · `AskChatTab.tsx` · `(tab)/page.tsx` · 시험 3개)과 Leader 가 맞춘 `docs/screens.md`. 소스·시험은 고치지 않았다. 변이는 전용 미러 `~/.node-local/thekaiwa-rev067c` 에서만 했고 매번 `sync-local.sh` 로 원복해 `cmp` 로 확인했다(NFS 소스 무수정).

## 판정: PASS_WITH_NOTES  (Critical 0 · High 0 · Medium 0 · Low 2) — native_change: false

B 지적 5개 모두 코드로 해소를 확인했다. 새 결함 Low 2건(동작 불변 주장의 좁은 틈 · 문서 낡은 문장)만 남는다.

### 지적
| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-067C-1 | Low | `src/components/chat/ChatMenuSheet.tsx:76-77,85,108` + `ChatRenameForm.tsx:254-256` | 회화·채팅: 저장 중 [취소]로 메뉴로 돌아간 뒤 두 번째 저장·삭제를 막던 공유 `busy` 가 옛 코드에선 있었고 지금은 없다 |
| REV-067C-2 | Low(문서) | `docs/screens.md:11523·11530·11537·12096` | §26 옛 문장이 아직 `initialChatId` 를 현재형으로 적는다(§27-1 D 에는 정정 표시가 있으나 이 줄들엔 포인터 없음) |

#### REV-067C-1 상세 [가능성 높음 — 코드 읽기, 실행 안 함]
- 옛 `ChatMenuSheet`(`git show HEAD:…`)는 `busy` 하나를 `rename`·`remove`·`close`·`dismissible` 이 같이 썼다. [취소] 는 `aria-disabled` 만이라 저장 중에도 눌려(`Btn` 은 클릭을 막지 않음, `common/ui.tsx:94-108`) 메뉴로 돌아가지만, 그 뒤 `rename()`·`remove()` 는 `if (busy) return` 으로 막혔다.
- 지금: 칸의 `busy` 는 칸 안 상태, 시트는 `renameBusy` 를 받아 `close`·`dismissible` 에만 쓴다(`ChatMenuSheet.tsx:76-77,108`). `remove` 는 시트 자신의 `busy`(`:85`)만 본다. default 의 [취소](`renameCancelAllowed('default', true) === true`)로 칸이 사라지면 새 칸은 `busy=false` 로 시작하므로 `saveRenameUnlessBusy(false, …)` 가 통과한다.
- 실패 시나리오: 회화방 ⋯ → 제목 바꾸기 → 저장(요청 진행 중) → 취소 → 메뉴 → 제목 바꾸기 → 저장 ⇒ PATCH 2건, 첫 응답이 시트를 닫고 둘째 응답이 「제목을 바꿨어요」를 한 번 더 띄운다. 또는 취소 직후 「회화 삭제」→삭제가 진행 중인 PATCH 와 겹친다. 요청 한 번이 끝나기 전에 사용자가 3탭을 해야 하므로 확률은 매우 낮고, 서버는 제목 PATCH 가 멱등이라 데이터 손상은 없다.
- 권고(택1): ① `ChatMenuSheet.remove` 와 제목 바꾸기 진입에서 `renameBusy` 도 본다(`if (busy || renameBusy) return`) ② 받아들이고 수정 기록의 「동작 불변」에 이 틈을 한 줄 적는다. 질문(`ask`)은 저장 중 [취소]·바깥·Esc 가 모두 막혀 이 경로가 없다.

#### REV-067C-2 상세 [확실]
- 정정은 §27-1 D(`:12222`)·§27-3 끝(`:12304`)·T22(`:12637`)에 있고 코드와 일치한다. §26 쪽 `:11523`(`<AskChatTab … initialChatId=…>`)·`:11530`·`:11537`(`initialChatId=x`)·`:12096`(L-3 「`initialChatId` 를 버리면 되지만」)은 현재형 그대로다. `:11597` 에만 「§27-1 D: initialChatId 폐지」 포인터가 있다. 구현 가이드를 §26 부터 읽는 사람이 서버 prop 을 되살릴 수 있다.
- 권고: 네 줄에 「(§27-1 D 로 폐지)」 한 구절씩.

### B 지적별 재검증 (증거 = 파일:줄)
- **REV-067B-3 [확실]** `AskChatTab.tsx:37-39` `askInitialConvId(q) = isAskId(q) ? q : null`, 서버 값을 읽지 않는다. 호출은 `:62` 한 곳(`id: askInitialConvId(q)`), 컴포넌트 props 는 `{ teacherName }` 뿐(`:60`). `initialChatId` 는 `src/` 전체에서 시험의 「없음」 단언 2곳(`askChatTab.test.ts:159,258`)뿐이고 `AskChatTab` 의 다른 호출처는 `(tab)/page.tsx:20` 하나(`<AskChatTab teacherName={teacherName} />`). 죽은 참조·미사용 import 없음(`isAskId` 는 `askInitialConvId`·페이지의 `callbackUrl` 이 쓴다), eslint 0 · tsc 는 미러의 낡은 prisma client 등으로 나는 65줄(개발 기록과 동일) 중 바꾼 파일 0건.
  - SSR 첫 렌더 = 클라이언트 첫 렌더 [확실 — Next 16.3.2 소스]: `useSearchParams`(`navigation.js:95-124`)는 `SearchParamsContext` 값을 그대로 돌려주고, 정적 생성 단계(`prerender-legacy`·`prerender-ppr`)에서만 CSR 로 빠진다(`dynamic-rendering.js:586-617`). 이 페이지는 `await searchParams` + `auth()` 라 요청 시 렌더이고 `next.config.ts` 에 `cacheComponents` 도 없다. 그래서 서버가 `/ask?chat=A` 를 그릴 때 `q='A'`, 하이드레이션 때 라우터 상태의 같은 주소에서 `q='A'`. 같은 프로젝트의 다른 `useSearchParams` 페이지(`study/ai/(tab)`·`drawer/*` 등)와 같은 패턴이다. 운영 빌드에서 `/ask` 가 동적(ƒ)으로 분류되는지는 QA 가 `next build` 출력으로 확인(여기선 `npm run build` 금지).
  - `/ask`(쿼리 없음)·`/ask?chat=`·`/ask?chat=../x` → `isAskId` 가 `^[A-Za-z0-9_-]{1,64}$`(`logic.ts:109`)라 `null` → 빈 대화 [확실, 시험 `askChatTab.test.ts:147-150`].
  - 옛 `/ask/<id>` → `[chatId]/page.tsx` 가 `legacyAskRoomTarget` 으로 `/ask?chat=<id>`(형식 틀리면 `/ask`)로 `redirect` → 탭이 그 쿼리로 시작 [확실, 코드]. 로그인 안 됐으면 `callbackUrl` 에 같은 주소.
  - `(tab)/page.tsx:17` 로그인 돌아올 주소 `isAskId(chat) ? askChatHref(chat) : '/ask'` 유지, `searchParams` 는 이 용도로만 읽는다 [확실].
- **REV-067B-1 [확실]** `ChatRenameForm.tsx:68-74` `renameErrorAfterInput(variant, cur)` = `variant === 'ask' && cur.invalid ? 지움 : cur`. `onInput`(`:228-232`)이 `setValue(v)` 뒤 이 함수로 `error`·`invalid` 를 맞추고 `onChange={onInput}`(`:251`)로 연결. 저장 실패(`rename.fail`, `invalid=false`)는 안 지워진다. 승인 데모 `docs/demo/task-067-ask-history-v1.html:1529-1531`(`rnErr !== 'fail'` 만 지움)과 같다. default 는 `cur` 그대로 — T16 고정 문자열(`OLD_IDLE`·`OLD_BUSY_ERR`)이 `git show HEAD:…ChatMenuSheet.tsx` 의 rename 본문(`id="chatRename"` · `border border-line` · `text-[12px] text-bad` · 저장/취소 `aria-disabled`)과 같은 값임을 대조했다 [확실].
- **REV-067B-2 [확실, 단 REV-067C-1 참고]** `renameCancelAllowed(variant, busy) = variant === 'default' || !busy`(`:76-78`), [취소] 는 `if (renameCancelAllowed(variant, busy)) onCancel()`(`:254-256`). default 는 저장 중에도 `onCancel` → `ChatMenuSheet` 가 `startMode` 없음이라 `setMode('menu')` — 옛 `onClick={() => setMode('menu')}` 와 같다. 질문만 저장 중 무반응. 부모 시트 `dismissible={!busy && !renameBusy}`(`ChatMenuSheet.tsx:108`)·`close` 의 `if (busy || renameBusy) return`(`:77`)은 그대로고 `AskHistorySheet.tsx:333` 도 `dismissible={!busy}` + `onBusyChange={setBusy}` — 저장 중 바깥·Esc 로 안 닫힌다. `save` 의 `busyTo(true)`(시작)·성공·비검사실패 때 `busyTo(false)` 도 그대로.
- **REV-067B-4·5 [확실]** 아래 변이 15회 전부 KILLED. 추가된 시험은 소스 스캔이 아니라 값을 돌려 보는 행동 시험이다: `saveRenameUnlessBusy(true, o)` 가 `null`·요청 0, `renameErrorAfterInput`·`renameCancelAllowed` 진리표, `AskHeadTitle({state:'ready'})` 를 직접 불러 `props.onClick === onRename`·호출 횟수.

### T9·약속 유지 확인 [확실]
- `src/components/ask/**`(시험 제외) `router.push(`·`router.replace(`·`useRouter`·`pushState(` 0건, `history.state` 는 `logic.ts:157` 주석 1곳뿐. `replaceState(` 는 `logic.ts:161` `h.replaceState(null, '', url)` 한 곳, 호출은 `AskChatTab.tsx:28-29` `replaceUrl` 한 곳을 거쳐 `:96,108,157,173`.
- 수정 시간 창(17:15~)에 바뀐 파일 = 보고된 7개 + Leader 의 `docs/screens.md` 뿐(`find -newermt`), 소유 밖 변경 없음.
- 관련 시험 `components/{ask,chat,shell}` + `app/**` 486개 전부 통과(미러, 원복 후 재동기화·`cmp` 확인). eslint(수정 7개) 0. 데모 게이트 `check` 출력 = approved v1 · hash verified.

### 변이 시험 (전용 미러 `~/.node-local/thekaiwa-rev067c`, 대상 시험 3개 31개) — 15회 실행 · 15 KILLED · 0 SURVIVED · 원복 15/15
| 요청 | 변이 | 잡은 시험 |
|---|---|---|
| ① | M1a `askInitialConvId(q, s = null)` 가 서버 값 반환 | T22 |
| ① | M1b 탭이 `initialChatId` prop 을 다시 받아 `?? initialChatId` | T22 |
| ① | M1c `askInitialConvId` 가 항상 `null`(주소 무시) | T22 |
| ② | M2a `renameErrorAfterInput` → `return cur` | T15 오류 지움 |
| ② | M2b `onInput` 이 헬퍼를 안 부름 | T15 오류 지움 |
| ② | M2c 저장 실패 문구도 지움(`invalid` 조건 삭제) | T15 오류 지움 |
| ② | M2d default 도 지움 | T15 오류 지움 |
| ③ | M3a `renameCancelAllowed` 가 default 도 막음(`!busy`) | T17 |
| ③ | M3b [취소] 가 헬퍼를 무시(항상 `onCancel`) | T17 |
| ③ | M3c [취소] 를 `!busy` 인라인으로 | T17 |
| ④ | M4a `saveRenameUnlessBusy` 의 `if (busy) return null` 삭제 | T15 이중 제출 |
| ④ | M4b `save()` 가 `busy` 대신 `false` 전달 | T15 이중 제출 |
| ④ | M4c `save()` 가 가드 없이 `saveRename` 직접 호출 | T15 이중 제출 |
| ⑤ | M5 `AskHeadTitle` 의 `onClick={onRename}` 줄 삭제 | T19 단추 연결 |
| ⑤ | M5b `onClick={() => {}}` | T19 단추 연결 |

시험이 못 보는 것(변이가 아니라 구조 한계): 순수 함수·요소 트리·소스 구조 시험이라 실제 DOM 에서 `onChange`→오류 지움, 머리 단추→제목 칸 열림, 실제 Next 라우터의 뒤로가기 복원은 눌러 본 적이 없다(DOM 시험 도구 없음).

### QA 에 넘기는 high_risk_areas (실제 Next 운영 빌드, 360·390·412)
1. **B-3 재현(핵심)**: 서버가 그린 `/ask?chat=A`(새로고침 또는 옛 `/ask/A` 리다이렉트) → 머리 ⋯ 「새 질문 시작」 → 하단 탭 「공부」 → 휴대폰 뒤로 ⇒ **빈 대화**(A 아님), 이어 묻는 질문이 새 대화에 붙고 주소와 화면이 같다. `/ask?chat=B` 직접 로드 시 하이드레이션 경고·콘솔 오류 0. `next build` 출력에서 `/ask` 가 동적(ƒ) 인지.
2. `/ask?chat=` · `/ask?chat=../x` · `/ask` → 빈 대화. 로그인 풀린 채 `/ask?chat=A` → 로그인 뒤 같은 주소로 돌아오는지.
3. **오류 지움(B-1)**: 질문 시트 행 ⋯ 와 머리 연필 모두 — 빈 칸 [저장] → 오류·빨간 테두리 → 글자 입력하면 안내 줄·테두리 복귀 / 101자 → 줄이면 복귀 / 저장 실패(요청 차단) 문구는 입력해도 유지.
4. **머리 단추(B-4)**: 준비 상태에서 탭 → 제목 칸이 열린다, 불러오는 중·새 질문에서는 단추가 아니다. 44px 이상.
5. **[취소](B-2)**: 질문 저장 중 [취소]·바깥·Esc 모두 무반응 / 회화·채팅 제목 바꾸기 저장 중 [취소] → 메뉴로(+ REV-067C-1 시나리오: 취소 직후 다시 저장·삭제가 두 번 나가는지 확인, 나가도 Low).
6. T9 회귀: 공부→질문→A→B→뒤로 = 공부(기록 1칸), 새 질문 시작·첫 질문 방 생성·시트 열기가 기록을 늘리지 않음.
