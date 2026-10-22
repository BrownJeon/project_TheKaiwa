---
task_id: task-083
role: reviewer
tags:
  - type/record
  - domain/vocab
---
# task-083 Reviewer 기록 (light 트랙) — REV-083

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 3 · native_change false. light 범위 안(변경 파일 2개·신규 화면/마이그레이션/네이티브/인증 변경 없음) → «light 승격 필요» 없음.

## 확인한 것 (직접 실행·읽기)
1. **변경이 사양과 같다** [확실] — `git diff -U0` 변경 hunk 4개뿐: 머리 주석 1줄, 띠 `mt-2→mt-1.5`, 본문 `bodyRef` `mt-2→mt-1.5`, 예문 `JaText` `mt-2→mt-1`, 예문 `HangulLine` `line-clamp-1!`→`line-clamp-1! mt-0! leading-[1.3]!` (VocabCardFace.tsx 8·224·229·230행 근처). `DropLevel`·`nextDropLevel`·`pickDropLevel`·`hangulOnOwnLine`·측정 효과·표제어 행·앞면 diff 0. `git status` 의 비문서 변경은 이 2파일뿐(`JapaneseText.tsx` 미변경).
2. **Tailwind `!` 접미 문법** [확실] — 미러 `@tailwindcss/node` 4.3.3 `compile` 을 직접 돌려 확인(스크래치패드 `rev-083/tw.cjs`): `.mt-0\!{margin-top:0px !important}`, `.leading-\[1\.3\]\!{--tw-leading:1.3 !important;line-height:1.3 !important}`, 기존 선례 `.line-clamp-1\!` 도 같은 형식(`!important`). 기본 `.mt-0\.5`·`.leading-\[1\.5\]` 은 `!important` 없음 → 출력 순서와 무관하게 새 클래스가 이긴다. v4 의 후행 `!` 표기가 맞고 선례 `line-clamp-1!`(HEAD, task-082)와 같은 형식.
3. **다른 소비처 영향 0** [확실] — 클래스는 `VocabCardFace` 호출부에서만 `className` 으로 넘긴다. `HangulLine` 정의(`JapaneseText.tsx`)·다른 40여 소비처는 diff 0.
4. **실행 증빙 대조**(미러 `~/.node-local/thekaiwa-dev083`, NFS 소스와 `cmp` 동일, `mirror-audit --check` exit 0): `cardFace.test.ts` 15 pass/0 fail · `vocab/__tests__`+`common/__tests__` **494 pass/0 fail**(개발 기록과 일치) · `lesson/__tests__/display.test.ts`(VocabCardFace 를 읽는 시험) 5 pass · `tsc --noEmit -p .` exit 0 · `eslint`(변경 2파일) exit 0.
5. **금기** [확실] — 엔진명·`fetch`·`Capacitor`·새 문구 0(바뀐 줄은 클래스와 주석뿐). 앞면 diff 0. 데모 게이트 `check.mjs check --task` → `DEMO_GATE_PASSED`(not_required, light 면제). 에이전트가 `approve/waive` 를 대신 실행한 흔적은 이 task 범위에서 보지 못함(검사 못 함: evidence.jsonl 전체 대조는 light 면제라 생략).
6. **시험 품질** — 새 시험 12번(`task-083`)은 공허하지 않다: 4곳 간격 정규식 + 예문 한글 줄을 `exampleAnn` 줄에서 찾아 토큰 단위(`cls.includes('mt-0!')`·`'leading-[1.3]!'`)로 단언하고, `dropLevel >= 1 ? null :`(가림 단계 유지)와 `mt-2` 잔존 0 을 본다. 개발 기록의 변이 7종(M1~M7)이 모두 실패로 잡힌다는 설명은 코드 구조와 맞는다(각 변이가 해당 단언의 정규식/토큰을 직접 깬다) — 변이는 내가 재실행하지 않음(턴 예산), 코드 읽기로만 대조.

## 이슈 (Low 3 — 모두 판정에 영향 없음)
- **L-1 (Low) 시험은 소스 문자열 계약이라 렌더 높이를 못 본다** — `cardFace.test.ts` 12번. 개발 기록이 이미 한계로 적었고 Leader 실브라우저(226px 합성·높이 스윕)가 그 몫을 한다. 권고: 없음(알려진 한계).
- **L-2 (Low) 정규식 취약성** — `<p className={\`mt-1\.5 self-start ` 와 `[^\n]*className="mt-1 line-clamp-2 ` 는 한 줄 포맷·클래스 순서에 묶여 있다. 클래스 상수로 뽑거나 줄바꿈하면 시험이 실패한다(실패 메시지는 명확하므로 거짓 통과는 아님). 또 `\bmt-2\b` 는 `mt-2.5` 도 잡는 보수적 단언. 권고: 지금은 둬도 된다.
- **L-3 (Low) 구현 가이드 문구가 옛 값** — `docs/screens.md` §15-11-3 B 1항(8292행)이 뒷면 본문 상자를 `mt-2 min-h-0 flex-1` 로 적고 있다(옛 task-033 기준). 이번 변경으로 코드는 `mt-1.5`. 이 task 는 문서 변경 없음(light) — 갱신 여부는 Leader 판단(정본 아님, 구현 가이드).

## 시각 위험(코드 읽기) — 결론
- 한글 줄 잘림 [가능성 높음]: `line-clamp-1!` 의 `overflow:hidden` 은 줄 상자(13×1.3=16.9px)에서 자른다. Hangul 잉크는 대략 baseline 위 0.88em·아래 0.12em 안이고, CJK 폰트 content area(≈1.45em)의 half-leading 이 -0.075em 라 잉크 하단 ≈1.2em < 1.3em → 잘림 없음으로 계산된다. Leader 의 실브라우저 확인(내용 잘림 없음)과 일치.
- 예문 루비 줄이 띠·뜻과 붙는 정도 [못 봄/디자인 판단]: 간격 `mt-2→mt-1`(4px 감소)이지만 예문 줄이 `leading 2.15`(34.4px) 라 루비 `<rt>` 자리가 줄 안에 이미 확보돼 있다. 붙어 보이는지는 시각 판단이라 reviewer 판정 대상이 아니다(디자인 문제로 보이면 Leader→designer).

## QA 전달 (light 트랙은 QA 없음)
high_risk_areas: 없음(순수 클래스 변경). 폰 확인 포인트 후보: 사용자 카드(`来ました`, 뒷면)에서 예문 한글이 보이는지·한글 줄 글자 아래 잘림 없음·번역 줄 안 잘림 / 글꼴 130%·2줄 예문에서는 예문 한글이 빠질 수 있음(마지막 수단 유지).
