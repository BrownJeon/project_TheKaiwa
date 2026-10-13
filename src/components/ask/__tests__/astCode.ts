/**
 * 소스 구조 시험 도구(task-066 FIX) — DOM 시험 도구가 없어 화면 배선은 소스로 잠근다. 줄 모양·들여쓰기에 기대는 정규식 대신
 * TypeScript 구문 트리로 「어디서 무엇을 부르는가」를 본다(한 줄 효과·이름 바꿈·줄바꿈에도 같은 결과).
 * 주석은 걷어 낸 소스(`readCode`)를 파싱한다 — 주석 속 글자가 통과 근거가 되지 않게.
 */
import ts from 'typescript'
import { readCode } from '../../__tests__/sourceCode'

export function parseCode(path: string): ts.SourceFile {
  const src = readCode(path)
  return ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

export function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (c) => walk(c, visit))
}

export function calls(root: ts.Node, pred?: (callee: string, n: ts.CallExpression) => boolean): ts.CallExpression[] {
  const out: ts.CallExpression[] = []
  walk(root, (n) => {
    if (ts.isCallExpression(n) && (!pred || pred(n.expression.getText(), n))) out.push(n)
  })
  return out
}

/** 가장 가까운 「이름 있는 주인」 — JSX 속성 · 변수 · 함수 · 객체 속성 · 메서드. 이름이 없으면 null. */
export function ownerName(node: ts.Node): string | null {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return p.name.getText()
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text
    if (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) return p.name.getText()
  }
  return null
}

/** `useEffect`·`useLayoutEffect`·`useInsertionEffect` 의 첫 인자(콜백) 노드. */
export function effectCallbacks(root: ts.Node): ts.Node[] {
  return calls(root, (c) => /^(React\.)?use(Layout|Insertion)?Effect$/.test(c))
    .map((c) => c.arguments[0])
    .filter((a): a is ts.Expression => !!a)
}

/** 이름으로 선언된 변수/함수의 초기값·본문. */
export function declOf(root: ts.Node, name: string): ts.Node | null {
  let found: ts.Node | null = null
  walk(root, (n) => {
    if (found) return
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) found = n.initializer
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n
  })
  return found
}

/** 함수 노드의 `return () => {…}`(정리 함수) — 마지막 return 의 함수. 없으면 null. */
export function cleanupOf(effectCb: ts.Node): ts.Node | null {
  let found: ts.Node | null = null
  if (!(ts.isArrowFunction(effectCb) || ts.isFunctionExpression(effectCb)) || !ts.isBlock(effectCb.body)) return null
  for (const st of effectCb.body.statements) {
    if (ts.isReturnStatement(st) && st.expression && (ts.isArrowFunction(st.expression) || ts.isFunctionExpression(st.expression))) found = st.expression
  }
  return found
}

export interface ListenerCall {
  kind: 'add' | 'remove'
  target: string
  event: string
  handler: string
}

/** `x.addEventListener(ev, fn)` · `x.removeEventListener(ev, fn)` 모두. */
export function listenerCalls(root: ts.Node): ListenerCall[] {
  return calls(root, (c) => /\.(add|remove)EventListener$/.test(c)).map((c) => {
    const callee = c.expression.getText()
    const m = /^(.*)\.(add|remove)EventListener$/.exec(callee)!
    return { kind: m[2] as 'add' | 'remove', target: m[1], event: c.arguments[0]?.getText() ?? '', handler: c.arguments[1]?.getText() ?? '' }
  })
}

export const text = (n: ts.Node | null | undefined): string => (n ? n.getText() : '')
