/**
 * `JaQuoted` 와 같은 모양(조각마다 `<span>`, 일본어 조각만 `lang="ja"`)에 「」 밖 일본어 구간까지 `lang="ja"` 를 단다(`splitJaRuns`, REV-115 M-1).
 * 텍스트로만 그린다(`dangerouslySetInnerHTML` 금지) — 히라가나·한글 없음(§15-1 F). 「」 밖에 일본어가 없으면 마크업이 `JaQuoted` 와 같다.
 *
 * 「」 밖 구간은 줄바꿈 규칙을 둘레 문장에서 물려받는다(`word-break: inherit`). 「〜ましょう: 어간+ましょう」 처럼 한국어 어절에 붙은 짧은 문형이라
 * 일본어 조각용 `word-break: normal`(부모의 `[lang=ja]` 규칙)을 받으면 「동사て|형」·「ま|しょう」·「親|切」 처럼 어절 한가운데서 끊긴다 —
 * 헤드리스 Chrome 실측(dev-039c, 실제 출력 94건 × 폭 150~320px 86단계): normal 이면 50건·932경우에서 줄 위치가 바뀌고, inherit 이면 2경우
 * (일본어 글꼴로 바뀐 글자 폭 차이로 줄 끝 어절 하나가 넘어감)뿐이다.
 */
import { splitJaRuns } from './jaQuotes'

const FOLLOW_SURROUNDING_BREAK = { wordBreak: 'inherit' } as const

export function JaRuns({ text }: { text: string }) {
  return (
    <>
      {splitJaRuns(text).map((p, i) =>
        p.ja ? (
          <span key={i} lang="ja" style={p.text.startsWith('「') ? undefined : FOLLOW_SURROUNDING_BREAK}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
