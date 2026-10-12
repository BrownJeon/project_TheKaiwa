---
task_id: task-064
role: developer
part: dev-U2 (화면 — 질문 방 /ask/[chatId])
tags:
  - type/task-record
  - domain/ask
  - domain/ui
aliases:
  - task-064 dev-U2
created: 2026-10-12
---

# task-064 — Developer 기록 (dev-U2: 질문 방 `/ask/[chatId]`)

이력서 본문: [[task-064-ask-anything-3a]] · 앞선 기록 [[task-064-dev-u-record]] · 구현 가이드 `docs/screens.md` §25 · 계약 `docs/design/api-contract.md` §2-18-A

## ★ 공유 인터페이스 (dev-U3 목록 화면도 import — 바꾸면 여기 먼저 고친다)

```ts
// src/components/ask/useScopeNoticeGate.ts  ('use client')
export function useScopeNoticeGate(): { acknowledged: boolean | null; ack(): void }
//   acknowledged: 서버 렌더·첫 수화 = null(모름) → 그 뒤 true|false. 부르는 쪽은 `acknowledged !== true` 면 시트를 띄운다.
//   ack(): localStorage `kaiwa.ask.scopeNotice.v1` = '1' 쓰기 + 저장이 막힌 기기도 이 페이지 동안은 다시 묻지 않음(모듈 메모리).
//   읽기 예외 = 안 본 것(false). 키는 ASK_KEYS.scopeNotice 한 곳(logic.ts).
export function readScopeNoticeAck(): boolean        // 순수 읽기(시험·비훅 용)
export function writeScopeNoticeAck(): void
export function scopeNoticeAcked(raw: string | null): boolean   // '1' 만 true

// src/components/ask/ScopeNoticeSheet.tsx  ('use client', default export)
export type ScopeNoticeMode = 'first' | 'again'
export default function ScopeNoticeSheet(p: { open: boolean; mode: ScopeNoticeMode; onConfirm?: () => void; onClose: () => void })
//   first = [알겠어요, 보내기](onConfirm) [취소](onClose) + 「이 안내는 질문 방 메뉴 ⋯ …」 꼬리 / again = [닫기](onClose)
//   [취소]·배경·Esc·✕ = onClose. 시트는 키를 쓰지 않는다 — onConfirm 안에서 부르는 쪽이 gate.ack() 후 원래 보내기를 잇는다.
export function ScopeNoticeBody(p: { mode; leadId; onConfirm?; onClose })   // 시험용 본문(Sheet 없이)
```

사용 예(목록 첫 질문):
```ts
const gate = useScopeNoticeGate()
const [sheet, setSheet] = useState<null | 'first' | 'again'>(null)
const pendingRef = useRef<string | null>(null)
function submit(text) { if (gate.acknowledged !== true) { pendingRef.current = text; setSheet('first'); return } create(text) }
<ScopeNoticeSheet open={sheet !== null} mode={sheet ?? 'first'} onConfirm={() => { gate.ack(); setSheet(null); const t = pendingRef.current; pendingRef.current = null; if (t) create(t) }} onClose={() => { pendingRef.current = null; setSheet(null) }} />
```

## 진행 기록
- [착수] 데모 게이트 `check.mjs check --task …task-064-ask-anything-3a.md` → `DEMO_GATE_PASSED` / `task: task-064` (status approved). 전용 미러 `~/.node-local/thekaiwa-dev064u2`(predeploy node_modules `cp -al`, package.json 동일).
- 체크포인트 1 — 공유 부품: 시험 `ask/__tests__/scopeNotice.test.ts` 먼저(모듈 없음 실패 확인) → `useScopeNoticeGate.ts`·`ScopeNoticeSheet.tsx` → **6/6 pass**. §25 와 다른 점: prop 이름 `variant` → **`mode`**(Leader 인터페이스), 관문 훅은 대기 보내기를 들지 않고 `{acknowledged, ack}` 만(Leader 인터페이스 — 대기 글은 부르는 화면이 든다).
- 체크포인트 2 — 질문 방: 시험 `ask/__tests__/askRoom.test.ts`(18건 — ⑦ 렌더 7·⑧·⑩·안내 문구·도착 알림·예문 분석 대상·넘겨받기·제자리 주소·⑯⑰ 배선·⑱ 금기·라우트) → `AskAnswer.tsx`(+`answerProposals`)·`AskRoom.tsx`(+순수 `askPlaceholder`·`askArrivalText`·`exampleTexts`·`takeAskHandoff`·`askRoomRedirect`)·`src/app/(app)/ask/[chatId]/page.tsx` → 두 파일 **24/24 pass**. (askRoom 시험은 구현 전에 썼지만 실패 실행은 따로 하지 않음 — 대신 아래 변이 확인으로 잡는지 본다.)
  - 남은 일: tsc·eslint·전체 components 시험·변이 ≥6·build → 마무리 기록. 미커밋: `ask/{ScopeNoticeSheet.tsx,useScopeNoticeGate.ts,AskAnswer.tsx,AskRoom.tsx}`·`ask/__tests__/{scopeNotice,askRoom}.test.ts`·`app/(app)/ask/[chatId]/page.tsx`.
- 체크포인트 3 — Leader 추가 지시(`sources[].id` = `string | null`, 계약 §2-18-A 3항) 반영:
  - `src/types/ask.ts` `AskSource.id: string | null`, **`type: AskSourceType | null`**(목록 밖 값 → 화면이 null 로 읽어 라벨만).
  - `ask/logic.ts` `askSourceHref`: `id:null` → `STUDY_LOG` `/plan` · `REVIEW` `/study/today` · 그 밖 null. `id` 있으면 기존 상세 규칙 그대로(형식 이상 → null). `sourceOf`(askMetaOf): 라벨 있으면 남김 — **모르는 유형은 버리지 않고 `type:null`**(dev-U 의 「모르는 유형 버림」 규칙을 Leader 지시로 바꿈), 문자열이 아니거나 빈 id → `id:null`. `isAskFocusTarget(null)` = false.
  - `ask/SourceList.tsx`: `sourceMetaLine`(export) — 모르는 유형은 머리 줄·표식 없이 라벨만. 이동할 곳 없는 카드는 기존대로 정적 `div`(링크·버튼·초점·› 없음), 링크 카드 이름 = 카드 글.
  - 시험: `logic.test.ts` ⑤ 집계 항목 1건 추가·⑥ 기대값 갱신(모르는 유형 유지·숫자/빈 id → null), `askRoom.test.ts` 근거 카드 렌더 1건(링크 2·정적 1·모르는 유형 라벨만). ask 시험 전체 **77/77 pass**(dev-U3 `askHome.test.ts` 포함).
- 체크포인트 4 — **범위 밖 시험 1줄 수정(Leader 승인 2026-10-12)**: `src/components/topic/__tests__/removalA11y.test.ts` M-1 허용 목록에 `join('components','ask','ScopeNoticeSheet.tsx')` 추가(위에 이유 주석 한 줄, 기존 단언·경로 순서 그대로). 허용 목록 밖 파일(미러의 `ChatMenuSheet.tsx` 에 `describedBy` 를 임시로 넣어 봄)은 여전히 실패 확인 후 미러 원복.
- 변이 확인(전용 미러에서 원본을 바꿔 해당 시험만 실행 → 원복) **11건 중 11건 검출**: M1 `annotate={false}` 삭제 · M2 제안을 근거 앞으로 · M3 `id:null` STUDY_LOG → null · M4 다시 보기에도 안내 꼬리 · M5 안내 키 아무 값이나 본 것으로 · M6 제안 종류 거르기 삭제 · M7 넘겨받기 키 안 지움 · M8 칩이 최근 답 조건 무시 · M9 모르는 유형 버림(옛 규칙) · M10 정적 카드를 링크로 · M11 관문 건너뛰기(처음엔 **못 잡음** → ⑯ 배선 시험에 `if (gate.acknowledged === true) {`·`setScopeSheet('first')`·`gate.ack()` 추가 후 검출).
- 실행 증빙(전용 미러, NFS `sync-local.sh` 후): `tsc --noEmit` **0** · `eslint src` **0**(0 errors, 경고 5건은 모두 기존 파일 — admin/trace/DiagnosticsScreen·settings/{LearningSettings,OnDeviceDiagnosticsCard,SpeechSettings,VoiceSettings}) · components 전체 시험 **1377/1377 pass**.
- [17:49] `next build`(전용 미러): **처음 exit 1** — 원인은 다른 에이전트(서버 쪽)의 미완성 시험 `src/modules/conversation/__tests__/askApi.test.ts`(없는 `chats/askLimits`·`chats/askView`·`assertTurnFitsKind`·`ASK_DEFAULT_TITLE`·`defaultChatTitle`·`scope` 를 import). 미러에서만 그 파일을 잠시 빼고 `tsc` **0**·`next build` **0**(`○ /ask`·`ƒ /ask/[chatId]`) 확인 → `sync-local.sh` 로 미러 원복. NFS 원본은 건드리지 않음.

## 마무리 — 파일 표

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/ask/useScopeNoticeGate.ts` | 새 | 보내는 범위 관문(위 공유 인터페이스) — `useSyncExternalStore`, 다른 탭 `storage` 이벤트 따라감 |
| `src/components/ask/ScopeNoticeSheet.tsx` | 새 | 시트 `first`/`again` + 시험용 `ScopeNoticeBody` — 승인 데모 v2 문구(보내는 것 5·보내지 않는 것 3), 음성 줄 없음 |
| `src/components/ask/AskAnswer.tsx` | 새 | 답 묶음(누가 줄 → LOW·기록 없음 줄 → 본문 → 되묻기 문장 → 칩 → 근거 → 제안 → 시각) + `answerProposals` |
| `src/components/ask/AskRoom.tsx` | 새 | 질문 방 본체 + 순수 도우미 5개(`askPlaceholder`·`askArrivalText`·`exampleTexts`·`takeAskHandoff`·`askRoomRedirect`) |
| `src/app/(app)/ask/[chatId]/page.tsx` | 새 | `auth()`→`/login?callbackUrl=`, `getProfile` 선생님 이름 → `<AskRoom>`. `loading.tsx` 없음(§25-7 B) |
| `src/components/ask/__tests__/scopeNotice.test.ts` · `askRoom.test.ts` | 새 | 6 + 19건 |
| `src/types/ask.ts` · `ask/logic.ts` · `ask/SourceList.tsx` · `ask/__tests__/logic.test.ts` | 고침(Leader 추가 지시) | `sources[].id` null·모르는 유형 라벨만(체크포인트 3) |
| `src/components/topic/__tests__/removalA11y.test.ts` | 고침 1줄(+주석) | Leader 승인 — 체크포인트 4 |
| `src/components/chat/*` | **안 고침** | dev-U 가 넣은 선택 옵션만으로 충분했다. 레슨·평가·역할극 화면도 안 고침 — ← 「질문으로」는 `BackBar`/`TalkRoomHeader` → `usePlanReturn` → `currentBackHref`(dev-U 가 세 기록으로 넓힘)로 이미 연결됨 |

## §25 와 다르게 한 곳
1. 시트 prop `variant` → `mode`, 관문 훅은 `{acknowledged, ack}` 만(Leader 인터페이스). 대기 보내기는 방(`pendingSendRef`)·목록이 각자 하나만 든다.
2. 첫 질문 넘겨받기는 #29 로드 직후가 아니라 **입력 바가 그려진 다음 효과**에서 보낸다 — 거절(429·409·네트워크) 때 `restoreText` 가 입력 바에 글을 돌려주려면 `Composer` 가 마운트돼 있어야 한다. 넘겨받은 글은 관문을 다시 거치지 않는다(목록에서 이미 확인).
3. 도착 알림은 `onSettled('done', id)` 로 받은 답 id 를 상태로 두고 렌더에서 문장을 계산(근거 수 = 그 답 `ask.sources`, 제안 수 = 그 답의 3a 종류 제안). 다음 보내기 때 비운다(같은 문장 다시 알림 = 비웠다 넣기). 폴링으로 이어받은 답은 제안을 늦게 다시 읽으면 문장이 한 번 더 바뀔 수 있다(드묾, 수용).
4. 칩 누름·메뉴 「보내는 범위 보기」의 초점 이동은 `requestAnimationFrame`+`setTimeout 0` 뒤(시트 닫힘이 연 사람에게 초점을 돌려준 다음) — 같은 커밋 안에서 옮기면 사라지는 칩·닫히는 시트에 씻겨 나간다.
5. 근거: 모르는 유형은 버리지 않고 라벨만(Leader 추가 지시 — dev-U 의 25-11 ⑥ 「버림」 규칙을 바꿈), 문자열이 아니거나 빈 id → `id:null`.
6. 메뉴 「보내는 범위 보기 ›」 줄 모양은 `ChatMenuSheet` 줄과 같은 클래스를 방 파일에 둠(회화방 메뉴 확장과 같은 관례 — `ChatMenuSheet` 를 고치지 않으려고).

## 남은 의문 · 확인 못 한 것
- **높이 실측(25-7 A)·3폭·TalkBack** 은 하지 못함(로그인 세션·서버 ASK 경로가 필요하고 개발 서버·QA 계정 쓰기 금지) → QA 몫. 방 고정 높이 = BackBar 52 + 표시 바 44 + 입력 바 61 은 `ChatRoom` 과 같은 부품이라 같을 것으로 봄 [가능성 높음].
- 실제 서버 응답(#29 메시지의 `ask` 칸, #32 `done.conversation`·`proposals`)과의 연결은 모의 값 시험만 — QA 실측 필요.
- `askApi.test.ts`(서버 쪽 미완성)가 지금 저장소 전체 `tsc`·`next build` 를 깨뜨린다 — 그 담당이 끝내야 전체 빌드 통과.
- 이어받은 대기(방을 다시 열어 폴링)에서 경과 초 기준 = 마지막 내 질문 `createdAt`(dev-U `askPendingSince`) — 서버 `createdAt` 이 UTC ISO 라는 전제.
- 미커밋 파일: 위 표 전부(커밋·add 안 함).
