# sealed — 눈가림 판정이 끝나기 전에 열지 않는다

- `key.json` : 단어 id → arm(v3/v4)·호출 id 열쇠
- `rows.json` : 호출별 원본 결과(통과 단어와 뜻 전체, arm 표시 있음)
- `summary.json`·`report.log` : arm 별 객관 지표(보조 뜻 개수 등으로 arm 을 짐작할 수 있다)

판정 방법: `blind-words.md` 의 각 단어를 «맞음/어색/틀림» 으로 판정해 `verdicts.txt`(한 줄에 `W012 맞음,어색`) 를 만든 뒤
`cd ~/.node-local/thekaiwa-pe079 && MODE=score OUT_DIR=<이 폴더의 부모를 가리키는 스크래치> VERDICTS=<verdicts.txt> node --env-file=.env --import tsx tests/prompts/topic-words-meaning-live.ts`
(`OUT_DIR` 에 `key.json`·`blind-words.md` 가 있어야 한다 — 이 폴더의 `sealed/key.json` 과 상위 `blind-words.md` 를 같은 폴더에 복사해서 쓴다.)
