/**
 * 설명 문장을 텍스트로만 그리고(`dangerouslySetInnerHTML` 금지) 「…」 조각에만 `lang="ja"` 를 단다 — 히라가나·한글 없음(§15-1 F).
 */
import { splitJaQuotes } from './jaQuotes'

export function JaQuoted({ text }: { text: string }) {
  return (
    <>
      {splitJaQuotes(text).map((p, i) =>
        p.ja ? (
          <span key={i} lang="ja">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
