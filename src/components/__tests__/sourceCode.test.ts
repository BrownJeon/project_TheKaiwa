/**
 * 소스 검사 시험 공용 도구(`sourceCode.ts`) 자체 시험 — 주석만 정확히 걷고 코드는 한 글자도 건드리지 않는다(task-056 REV-194).
 *  - 주석 종류별(줄 전체 · 줄 끝 · 블록 · 여러 줄 · JSX 중괄호 · 여는 태그 안 · JSDoc) 제거.
 *  - 주석이 아닌 `//`·`/*` (문자열 · 템플릿 · 정규식 · JSX 글자 · URL 속성)는 그대로.
 *  - 실제 화면 소스 전부(talk · scenario)에서 코드 토큰 열이 원문과 같고 주석이 남지 않는다.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'
import { commentRanges, stripComments } from './sourceCode'

const TSX = 'sample.tsx'

test('주석 종류별: 줄 전체·줄 끝·블록(여러 줄)·JSX 중괄호·여는 태그 안·JSDoc 이 모두 사라지고 코드는 그대로 남는다', () => {
  const src = [
    '/** 머리 설명 // 안쪽 슬래시 helper.close() */',
    'export function A() {',
    '  // 줄 전체 주석 helper.close()',
    '  const x = 1 // 줄 끝 주석 helper.close()',
    '  /* 블록',
    '     여러 줄 helper.close() */',
    '  return (',
    '    <div>',
    '      {/* JSX 주석 helper.close() */}',
    '      <button',
    '        type="button"',
    '        // onPointerDown={keepInputFocus}',
    '        onClick={go} /* 줄 끝 블록 onPointerDown={keepInputFocus} */',
    '      >',
    '        확인',
    '      </button>',
    '    </div>',
    '  )',
    '}',
  ].join('\n')
  assert.ok(src.includes('onPointerDown={keepInputFocus}') && src.includes('helper.close()'), '원문에는 있다(= 원문 검사는 통과해 버린다)')
  const out = stripComments(src, TSX)
  for (const gone of ['머리 설명', '안쪽 슬래시', '줄 전체 주석', '줄 끝 주석', '여러 줄', 'JSX 주석', 'keepInputFocus', 'helper.close()']) {
    assert.ok(!out.includes(gone), `주석 속 「${gone}」 이 남았다`)
  }
  for (const kept of ['export function A() {', 'const x = 1', 'type="button"', 'onClick={go}', '확인', '</button>', '{ }']) {
    assert.ok(out.includes(kept), `코드 「${kept}」 가 사라졌다`)
  }
  assert.equal(commentRanges(out, TSX).length, 0, '걷은 뒤에 주석이 남지 않는다')
  assert.equal(stripComments(out, TSX), out, '두 번 걷어도 같다')
})

test('걷는 모양: 주석만 있는 줄은 줄째, 코드 옆 주석은 그 부분만 — 양옆이 붙으면 공백 하나', () => {
  assert.equal(stripComments('a\n  // c\nb\n', 'a.ts'), 'a\nb\n')
  assert.equal(stripComments('a // c\nb\n', 'a.ts'), 'a \nb\n')
  assert.equal(stripComments('a /* c */ b', 'a.ts'), 'a  b')
  assert.equal(stripComments('a/* c */b', 'a.ts'), 'a b', '토큰이 합쳐지지 않는다')
  assert.equal(stripComments('x\n/* 가\n나 */\ny', 'a.ts'), 'x\ny')
  assert.equal(stripComments('x // 끝', 'a.ts'), 'x ', '파일 끝 줄 주석')
  assert.equal(stripComments('// 첫 줄\nx', 'a.ts'), 'x')
})

test('주석이 아닌 슬래시는 건드리지 않는다: 문자열·템플릿·정규식·JSX 글자·URL 속성·나눗셈', () => {
  const src = [
    "const a = 'http://example.com/*x*/ // not'",
    'const b = "//" + `//${a}/*`',
    'const c = /\\/\\/ x/.test(a)',
    'const d = 4 / 2 / 1',
    'export const J = () => (',
    '  <p>',
    '    <a href="http://x.y/*z*/">http://y // not a comment /* nor this */</a>',
    '    걸어요 // 이것도 글자',
    '  </p>',
    ')',
  ].join('\n')
  assert.equal(commentRanges(src, TSX).length, 0)
  assert.equal(stripComments(src, TSX), src)
})

test('.ts 는 JSX 가 아니다: 제네릭 화살표 `<T,>` 와 꺾쇠 단언이 있어도 주석만 걷는다', () => {
  const src = 'const id = <T,>(x: T) => x // 끝\nconst n = <number>(1 as unknown) /* 단언 */\n'
  assert.equal(stripComments(src, 'a.ts'), 'const id = <T,>(x: T) => x \nconst n = <number>(1 as unknown) \n')
})

/* ── 실제 화면 소스 전부 ─────────────────────────────────────────────── */

function codeTokens(src: string, fileName: string): string[] {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return
    const kids = n.getChildren(sf)
    if (kids.length > 0) return void kids.forEach(walk)
    if (n.kind !== ts.SyntaxKind.SyntaxList) out.push(n.getText(sf).trim())
  }
  walk(sf)
  return out.filter((t) => t !== '')
}

test('실제 소스(talk·scenario 의 화면 파일 전부): 걷은 뒤 코드 토큰 열이 원문과 같고, 주석이 남지 않으며, 길이가 줄어들기만 한다', () => {
  let files = 0
  let withComments = 0
  for (const dir of ['talk', 'scenario']) {
    const base = join(process.cwd(), 'src/components', dir)
    for (const name of readdirSync(base).filter((n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))) {
      const path = join(base, name)
      const src = readFileSync(path, 'utf8')
      const out = stripComments(src, path)
      files++
      if (out.length < src.length) withComments++
      assert.deepEqual(codeTokens(out, path), codeTokens(src, path), `${dir}/${name}: 코드 토큰이 달라졌다`)
      assert.equal(commentRanges(out, path).length, 0, `${dir}/${name}: 주석이 남았다`)
      assert.ok(out.length <= src.length, `${dir}/${name}: 길어졌다`)
    }
  }
  assert.ok(files >= 20, `훑은 파일이 너무 적다(${files})`)
  assert.ok(withComments >= 10, `주석이 있는 파일을 못 찾았다(${withComments}) — 도구가 아무것도 안 걷는 건 아닌지`)
})
