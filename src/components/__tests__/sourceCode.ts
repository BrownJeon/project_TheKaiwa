/**
 * 소스 검사 시험 공용 도구 — 화면 파일을 글자로 읽어 배선(`onPointerDown={keepInputFocus}`·`helper.close()` 호출·`<Panel …/>` 개수 …)을
 * 정규식·`includes` 로 잠그는 시험이 쓴다. 시험 파일 안에서만 쓰며 앱 번들에는 들어가지 않는다.
 *
 * 왜 따로 두나: 원문을 그대로 보면 **주석 처리한 코드도 통과**한다(REV-193 F-1 · REV-194 F-1). 행 맨 앞 `//`·`*` 만 걷는 정규식은
 * JSX 중괄호 주석 · 줄 끝 `// …` · 여는 태그 안의 `// onPointerDown={…}` 를 놓친다(JSX 여는 태그 안의 `//` 는 컴파일되므로
 * 속성이 빠진 채 빌드된다). 여기서는 TypeScript 파서로 **주석 trivia 만** 찾아 걷어 낸다 — 문자열·템플릿·정규식·JSX 글자 안의 `//` 는 주석이 아니다.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

export type CommentRange = { pos: number; end: number }

const kindOf = (fileName: string) => (fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

/** 소스 안 모든 주석(한 줄 · 블록 · JSX 중괄호 안 · 여는 태그 안)의 [pos, end) 범위, 앞에서부터. `.tsx` 만 JSX 로 읽는다. */
export function commentRanges(src: string, fileName: string): CommentRange[] {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, kindOf(fileName))
  const found = new Map<number, CommentRange>()
  const take = (list: ts.CommentRange[] | undefined) => {
    for (const r of list ?? []) found.set(r.pos, { pos: r.pos, end: r.end })
  }
  const visit = (node: ts.Node) => {
    // JSDoc 안쪽 토큰은 trivia 가 아니라 주석 본문이다 — 그 안의 `//` 를 새 주석으로 읽지 않는다.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return
    const kids = node.getChildren(sf)
    if (kids.length > 0) {
      for (const k of kids) visit(k)
      return
    }
    // JSX 글자는 토큰이 아니다(그 안의 `//` 는 글자). 빈 SyntaxList 는 다음 토큰과 같은 위치라 건너뛴다.
    if (node.kind === ts.SyntaxKind.JsxText || node.kind === ts.SyntaxKind.SyntaxList) return
    // 주석은 두 토큰 사이 trivia — 앞 토큰과 같은 줄에 붙은 것은 trailing, 그 뒤 줄들은 leading 으로 나뉘어 잡힌다.
    take(ts.getLeadingCommentRanges(src, node.pos))
    take(ts.getTrailingCommentRanges(src, node.pos))
  }
  visit(sf)
  const sorted = [...found.values()].sort((a, b) => a.pos - b.pos)
  const out: CommentRange[] = []
  for (const r of sorted) if (!out.length || r.pos >= out[out.length - 1].end) out.push(r)
  return out
}

/**
 * 주석을 걷어 낸 소스. 주석만 있는 줄은 줄째 지우고, 코드 옆 주석은 그 부분만 지운다(양옆이 붙어 토큰이 합쳐지면 공백 하나).
 * `between()` 같은 「표지 사이 조각」 자르기는 주석 때문에 길어지지 않고 짧아지기만 한다.
 */
export function stripComments(src: string, fileName: string): string {
  let out = src
  for (const { pos, end } of commentRanges(src, fileName).reverse()) {
    const lineStart = out.lastIndexOf('\n', pos - 1) + 1
    const nl = out.indexOf('\n', end)
    const lineEnd = nl < 0 ? out.length : nl
    const alone = out.slice(lineStart, pos).trim() === '' && out.slice(end, lineEnd).trim() === ''
    if (alone) {
      out = out.slice(0, lineStart) + out.slice(nl < 0 ? out.length : nl + 1)
    } else {
      const glued = pos > 0 && end < out.length && !/\s/.test(out[pos - 1]) && !/\s/.test(out[end])
      out = out.slice(0, pos) + (glued ? ' ' : '') + out.slice(end)
    }
  }
  return out
}

/** 파일을 읽어 주석을 걷은 소스를 돌려준다 — 소스 검사 시험은 `readFileSync` 대신 이것을 쓴다. */
export function readCode(path: string): string {
  return stripComments(readFileSync(path, 'utf8'), path)
}
