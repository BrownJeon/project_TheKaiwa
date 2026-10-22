---
task_id: task-083
role: developer
tags:
  - type/record
  - domain/vocab
---
# task-083 Developer 기록 (light 트랙)

- [진행] 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED` / status not_required(light 면제). 백업: 스크래치패드 `dev-083/*.orig`. 미러 `dev083` 생성(`make-mirror.sh dev083` → MIRROR_OK).
- [진행] `VocabCardFace.tsx` 뒷면 4곳 적용: 띠 `mt-2`→`mt-1.5` · 본문(`bodyRef`) `mt-2`→`mt-1.5` · 예문 `JaText` `mt-2`→`mt-1` · 예문 `HangulLine` className `line-clamp-1!` → `line-clamp-1! mt-0! leading-[1.3]!`. 머리 주석에 WHY 한 줄(`!` 는 `HangulLine` 기본 `mt-0.5`·`leading-[1.5]` 를 이기려는 것).
- [진행] 중요도 `!` 필요성을 코드로 확인(미러에서 `@tailwindcss/node` compile, 4.3.3): 생성 CSS 순서가 `.mt-0` → `.mt-0.5`, `.leading-[1.3]` → `.leading-[1.5]` 라 `!` 없이는 뒤에 오는 기본값(`mt-0.5`·`leading-[1.5]`)이 이긴다. `mt-0!`·`leading-[1.3]!` 는 `!important` 로 나온다.
- [진행] `cardFace.test.ts`: 기존 단언 1건(예문 `HangulLine` className `line-clamp-1!"` 로 끝남)을 `line-clamp-1! ` 로 맞춤 + 새 시험 1건(간격 4곳 계약 + 예문 한글은 `dropLevel >= 1` 로만 가림 + 뒷면에 `mt-2` 잔존 없음).
- [완료] 실행 증빙(미러 `~/.node-local/thekaiwa-dev083`, `sync-local.sh` 로 채움, `mirror-audit --check` exit 0):
  - `cardFace.test.ts` → 15 pass / 0 fail(전 14 → 15). `src/components/vocab/__tests__/*.test.ts` + `src/components/common/__tests__/*.test.ts` → **494 pass / 0 fail**(전 493).
  - `tsc --noEmit -p .` → exit 0(출력 0). `eslint`(VocabCardFace.tsx·cardFace.test.ts) → exit 0.
  - 변이 7종(미러에서 임시 파일 + `os.replace`, 끝에 원복 후 NFS 원본과 `cmp` 동일 — 스크립트 `dev-083/mutate.py`), 전부 잡힘: M1 `mt-0!` 제거 · M2 `leading-[1.3]!` 의 `!` 제거 · M3 띠 `mt-1.5`→`mt-2` · M4 본문 `mt-1.5`→`mt-2` · M5 예문 `mt-1`→`mt-2` → 모두 새 시험 12번 실패 / M6 예문 한글 가림 `>= 1`→`>= 2` → 7번·12번 실패 / M7 `line-clamp-1!` 제거 → 11번 실패.

## 변경 파일 (2개 + 이 기록)
- `src/components/vocab/VocabCardFace.tsx`: 위 4곳 + 머리 주석 1줄. 판정 로직(`DropLevel`·`nextDropLevel`·`pickDropLevel`·`hangulOnOwnLine`·측정 효과)·표제어 행·앞면 diff 0(`git diff -U0` 로 변경 줄 확인).
- `src/components/vocab/__tests__/cardFace.test.ts`: 단언 1 맞춤 + 시험 1 추가.

## 한계 / reviewer 가 볼 곳
- **높이 절약 ≈ 12.6px 는 코드 값 계산이지 실측 아님**: 띠 2 + 본문 2 + 예문 4 + 예문 한글 위 간격 2 + 줄 높이 19.5→16.9(2.6). 사양의 «≈13px» 와 일치. 실카드 높이 스윕·사용자 카드(226px) 합성은 Leader 실브라우저 몫.
- 예문 한글 줄은 `line-clamp-1`(overflow hidden) + `leading-[1.3]` 이다 — 13px 한글 글자 상자 대비 줄 높이 16.9px 라 윗·아랫 잘림은 없을 것으로 추정(추측) → Leader 실화면에서 한글 줄 글자 아래가 잘리지 않는지 확인.
- 시험은 클래스 문자열 계약(소스 단언)이라 실제 렌더 높이는 못 본다 — 한글 줄 존재·높이는 실브라우저.
- 훅: 편집 전 `[데모 검토 게이트]` 경고 «active task 없음» (task-082 와 같음) — `check.mjs check --task` 는 `DEMO_GATE_PASSED`(not_required, light 면제).
- 미커밋 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts` · 이 기록. 커밋·푸시·배포·브라우저·dev 서버·DB·LLM 호출 없음, 띄운 프로세스 없음(tsc/시험/tailwind compile 모두 끝남).

### 체크포인트
- 완료: 위 전부. 남은 일: reviewer 감사(간격 4곳·판정 로직 diff 0·`!` 근거) → Leader 실브라우저 스윕(한글 2줄 유지 하한 ≥10px 하락, 226px 합성).
