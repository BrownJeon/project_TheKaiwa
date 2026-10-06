/**
 * 한국어 문장 속 「…」 조각 나누기(순수) — HTML 주입 없이 그 조각에만 `lang="ja"` 를 달기 위해. 복습 근거 상자(task-010b)와
 * 교정 카드의 추가 설명 줄(task-039)이 같이 쓴다. 히라가나·한글을 달지 않는다(설명 속 인용 규칙 §15-1 F).
 */
export interface QuotePart {
  text: string
  ja: boolean
}

/** 「…」 조각만 일본어로 표시한다(React 노드로 감싸기 위해 — HTML 주입 없음). 빈 조각은 버린다. */
export function splitJaQuotes(s: string): QuotePart[] {
  return s
    .split(/(「[^」]*」)/)
    .filter((t) => t.length > 0)
    .map((t) => ({ text: t, ja: t.startsWith('「') && t.endsWith('」') }))
}

/**
 * 「」 밖 일본어 구간(task-039 REV-115 M-1) — 가나·한자가 적어도 한 글자 있는 연속 구간. 장음·반복·물결·가운뎃점·탁점(ー々〆〜～・ｰﾞﾟ゛゜)은
 * 가나·한자와 붙어 있을 때만 들어간다(「3〜7일」 의 〜 처럼 한국어 속 기호는 일본어가 아니다). 、。 는 일본어 글자 사이에 끼었을 때만 이어 붙여
 * 한 구간으로 둔다(스크린리더가 구두점 하나 때문에 언어를 오가지 않게). 한글·라틴·숫자·그 밖의 구두점·공백은 구간을 끊는다.
 */
const JA_CORE = '\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}'
const JA_MARK = 'ー々〆〜～・ｰﾞﾟ゛゜'
const JA_WORD = `[${JA_MARK}]*[${JA_CORE}][${JA_CORE}${JA_MARK}]*`
const JA_RUN_SPLIT = new RegExp(`(${JA_WORD}(?:[、。]+${JA_WORD})*)`, 'u')

/**
 * 「…」 조각은 `splitJaQuotes` 그대로 일본어로 두고, 그 밖 글에서는 일본어 구간만 따로 나눈다(순수 — HTML 주입 없이 `lang="ja"` 를 달기 위해).
 * 「」 밖에 일본어가 없으면 결과가 `splitJaQuotes` 와 같다. 교정 카드 추가 설명 줄 전용 — 복습 근거 상자(`TeacherWhy`)는 `splitJaQuotes` 를 계속 쓴다.
 */
export function splitJaRuns(s: string): QuotePart[] {
  const out: QuotePart[] = []
  for (const part of splitJaQuotes(s)) {
    if (part.ja) {
      out.push(part)
      continue
    }
    part.text.split(JA_RUN_SPLIT).forEach((t, i) => {
      if (t.length > 0) out.push({ text: t, ja: i % 2 === 1 })
    })
  }
  return out
}
