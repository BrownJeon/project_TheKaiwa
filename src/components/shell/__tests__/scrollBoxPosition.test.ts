import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-047: 안쪽 세로 스크롤 상자가 위치 기준(`position`)을 갖지 않으면 그 안의 `sr-only`(absolute)가 앱 셸 `main`(`relative`) 기준으로 잡혀
// `main` 의 스크롤 높이가 늘고, 숨은 입력에 초점이 가면 `main` 까지 따로 스크롤된다(task-021·029·045 가 한 곳씩 고친 같은 결함).
// 그래서 `globals.css` 의 `@layer base` 한 규칙이 `main` 안의 `overflow-y-auto|overflow-auto|overflow-y-scroll|overflow-scroll` 를 `relative` 로 만든다.
// 이 시험은 ① 그 규칙이 살아 있는지 ② 소스의 세로 스크롤 토큰이 규칙이 덮는 모양(접두어 없는 위 네 개)뿐인지를 고정한다 —
// 규칙이 못 덮는 모양(`md:` 변형·`overflow-[auto]`·인라인 스타일·`main` 요소 자신)은 같은 요소에 직접 위치 지정이 있거나 허용 목록의 사유가 있어야 한다.
// 정적 분석이라 "이 상자가 `main` 안에 있는가"는 알 수 없다: `main` 밖 상자(포털 시트·콘솔 사이드바)는 허용 목록에 사유로 적어 두고,
// 새로 생긴 `main` 밖 상자가 abspos 자손을 가지는 경우는 이 시험이 잡지 못한다(알려진 한계). 실제 계산값은 QA 가 브라우저에서 본다.
// 그 밖의 알려진 한계(현재 소스에는 해당 모양 0건): 동적 조립(`overflow-${x}-auto`)·`.css` 안의 클래스형 규칙은 스캔 대상이 아니고,
// JSX 텍스트의 따옴표 밖 `//` 는 줄 주석으로 오인되며, 템플릿 리터럴 안 삼항의 따옴표는 className 구간 추정을 흐린다(`enclosingString`).

const srcDir = join(__dirname, '..', '..', '..')
const rootDir = join(srcDir, '..')

const POSITIONED = ['relative', 'absolute', 'fixed', 'sticky']
/** 규칙이 덮어야 하는 선택자 네 가지(`:where()` 안 목록). */
const REQUIRED_SELECTORS = ['main .overflow-y-auto', 'main .overflow-auto', 'main .overflow-y-scroll', 'main .overflow-scroll']

// ───────────────────────── 소스 스캔 ─────────────────────────

/** 같은 줄 `from` 부터 이스케이프되지 않은 닫는 따옴표 `q` 가 있는가. */
function closesOnLine(line: string, from: number, q: string): boolean {
  for (let j = from; j < line.length; j++) {
    if (line[j] === '\\') j++
    else if (line[j] === q) return true
  }
  return false
}

// 주석을 지운다 — 블록 주석(JSX 안의 중괄호 주석 포함)과 줄 주석.
// 줄 주석은 같은 줄에서 닫히는 문자열 밖의 `//` 만 주석으로 본다(`'a // b'`·`"https://…"` 는 남긴다). `://` 의 URL 도 남긴다.
// 같은 줄에 닫는 따옴표가 없는 따옴표(JSX 텍스트의 아포스트로피·여러 줄 템플릿)는 문자열로 보지 않는다(이전 판과 같은 동작으로 되돌아간다).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      let quote = ''
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '\\') i++ // 문자열 안의 이스케이프이자, 정규식 리터럴 `/^W\//` 의 `\/` 도 주석 시작으로 보지 않기 위해
        else if (quote) {
          if (ch === quote) quote = ''
        } else if (ch === '"' || ch === "'" || ch === '`') {
          if (closesOnLine(line, i + 1, ch)) quote = ch
        } else if (ch === '/' && line[i + 1] === '/' && line[i - 1] !== ':') {
          return line.slice(0, i)
        }
      }
      return line
    })
    .join('\n')
}

type Hit = {
  file: string
  /** 허용 목록 열쇠 — 파일에 토큰이 하나면 경로, 둘 이상이면 `경로#순번`(1부터). */
  key: string
  /** class: 접두어 없는 표준 토큰(규칙이 덮음) · variant: 접두어·임의값 변형(규칙이 못 덮음) · inline: 인라인 스타일(못 덮음). */
  kind: 'class' | 'variant' | 'inline'
  token: string
  /** 토큰이 든 문자열 리터럴(요소 하나의 className 문자열). inline 은 ''. */
  cls: string
  /** 토큰이 `<main …>` 요소 자신의 className 에 있다 — 규칙은 `main` 의 후손만 덮으므로 `main` 자신은 직접 위치 지정이 필요하다. */
  mainSelf: boolean
}

// 접두어(`md:`·`max-lg:`·`[&_div]:`)는 `:` 로 끝나는 덩어리의 반복. 앞 글자(따옴표·공백 …)는 그룹 1 로 먹고, 뒤는 이어 붙은 단어가 아닐 때만.
const CLASS_TOKEN = /(^|[^\w-])((?:[^\s"'`:{}]+:)*)(overflow-(?:y-)?(?:auto|scroll))(?![\w-])/g
const ARBITRARY_TOKEN = /(^|[^\w-])((?:[^\s"'`:{}]+:)*)(overflow-(?:y-)?\[(?:auto|scroll)\]|\[overflow(?:-y)?:(?:auto|scroll)\])/g
// 같은 줄에서 `overflow(Y)? = / :` 뒤에 auto|scroll 이 오는 대입·객체 속성(삼항 `cond ? 'auto' : 'hidden'` 과 `overflow-y: auto` 문자열 포함). `===` 비교는 아니다.
const INLINE_TOKEN = /(^|[^\w[-])(overflow(?:Y|-y)?[ \t]*(?::|=(?!=))(?:[^\n;{}]*?['"`]|[ \t]*)(?:auto|scroll)(?![\w-]))/g

function enclosingString(text: string, idx: number): { start: number; value: string } {
  let s = idx - 1
  while (s >= 0 && !`"'\``.includes(text[s])) s--
  if (s < 0) return { start: 0, value: '' }
  const e = text.indexOf(text[s], idx)
  return { start: s, value: e < 0 ? '' : text.slice(s + 1, e) }
}

function isMainTag(text: string, stringStart: number): boolean {
  const lt = text.lastIndexOf('<', stringStart)
  return lt >= 0 && /^<main(?=[\s>])/.test(text.slice(lt, lt + 8))
}

function hasPositionToken(cls: string): boolean {
  return cls.split(/\s+/).some((t) => POSITIONED.includes(t))
}

/** 파일 하나의 세로 스크롤 토큰(가로 `overflow-x-*` 는 대상이 아니다). 열쇠는 `assignKeys` 가 붙인다. */
function scanSource(file: string, raw: string): Omit<Hit, 'key'>[] {
  const text = stripComments(raw)
  const found: { index: number; hit: Omit<Hit, 'key'> }[] = []
  const pushClass = (m: RegExpMatchArray, kind: (prefix: string) => Hit['kind']) => {
    const index = (m.index ?? 0) + m[1].length
    const str = enclosingString(text, index)
    found.push({ index, hit: { file, kind: kind(m[2]), token: m[2] + m[3], cls: str.value, mainSelf: isMainTag(text, str.start) } })
  }
  for (const m of text.matchAll(CLASS_TOKEN)) {
    // Tailwind 중요 표시(`!overflow-y-auto`·`overflow-y-auto!`)의 실제 클래스는 `.\!overflow-y-auto` 라 규칙의 `.overflow-y-auto` 에 안 걸린다 → 변형과 같다.
    const end = (m.index ?? 0) + m[1].length + m[2].length + m[3].length
    const important = m[1] === '!' || text[end] === '!'
    pushClass(m, (prefix) => (prefix || important ? 'variant' : 'class'))
  }
  for (const m of text.matchAll(ARBITRARY_TOKEN)) pushClass(m, () => 'variant')
  for (const m of text.matchAll(INLINE_TOKEN)) found.push({ index: (m.index ?? 0) + m[1].length, hit: { file, kind: 'inline', token: m[2], cls: '', mainSelf: false } })
  return found.sort((a, b) => a.index - b.index).map((f) => f.hit)
}

function assignKeys(hits: Omit<Hit, 'key'>[]): Hit[] {
  const perFile = new Map<string, number>()
  for (const h of hits) perFile.set(h.file, (perFile.get(h.file) ?? 0) + 1)
  const seen = new Map<string, number>()
  return hits.map((h) => {
    const n = (seen.get(h.file) ?? 0) + 1
    seen.set(h.file, n)
    return { ...h, key: perFile.get(h.file) === 1 ? h.file : `${h.file}#${n}` }
  })
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : sourceFiles(p)
    return /\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name) ? [p] : []
  })
}

function scanTree(): { files: number; hits: Hit[]; texts: Map<string, string> } {
  const files = [...sourceFiles(join(srcDir, 'components')), ...sourceFiles(join(srcDir, 'app'))].sort()
  const texts = new Map<string, string>()
  const raw: Omit<Hit, 'key'>[] = []
  for (const abs of files) {
    const rel = abs.slice(rootDir.length + 1)
    const src = readFileSync(abs, 'utf8')
    texts.set(rel, stripComments(src))
    raw.push(...scanSource(rel, src))
  }
  return { files: files.length, hits: assignKeys(raw), texts }
}

// ───────────────────────── 허용 목록 ─────────────────────────

type Allow = { why: string; must?: RegExp; mustNot?: RegExp }
const NO_ABSPOS_CHILD = /sr-only|(?:^|[^\w:-])absolute(?![\w-])/

/**
 * 규칙이 덮지 못하거나 덮을 필요가 없는 상자. 열쇠 = 토큰 열쇠(위 `Hit.key`). 사유가 비면 실패, 코드에 없는 항목도 실패(썩지 않게).
 * `must`/`mustNot` 은 사유가 기대는 사실을 파일 텍스트(주석 제거 뒤)로 확인한다 — 사실이 깨지면 이 상자를 다시 본다.
 */
const ALLOW: Record<string, Allow> = {
  'src/components/common/Sheet.tsx': {
    why: '`document.body` 로 포털하는 `fixed` 시트라 `main` 밖 — 규칙이 안 닿고, 안쪽 abspos 자손의 containing block 은 시트 패널(absolute)이다',
    must: /createPortal\(/,
  },
  'src/components/chat/Composer.tsx': {
    why: 'textarea — 자손이 없다(채팅방처럼 `main` 안이면 규칙이 relative 로 만들고, 시트 안이면 그대로. 어느 쪽이든 무해)',
    mustNot: NO_ABSPOS_CHILD,
  },
  'src/components/vocab/WordForm.tsx': {
    why: '인라인 스타일(`style.overflowY`)로 켜는 textarea — 클래스 규칙이 닿지 않지만 자손이 없다',
    mustNot: NO_ABSPOS_CHILD,
  },
  'src/components/admin/console/ConsoleNav.tsx': {
    why: '`aside` 는 `main` 의 형제라 규칙이 안 닿는다 — 링크만 있고(모바일 메뉴는 포털 `Sheet`) abspos 자손이 없다. `sr-only` 가 생기면 재검토',
    mustNot: NO_ABSPOS_CHILD,
  },
}

function hitProblems(hits: Hit[], allow: Record<string, Allow>): string[] {
  const out: string[] = []
  for (const h of hits) {
    if (allow[h.key]) continue
    const positioned = hasPositionToken(h.cls)
    if (h.kind === 'inline') out.push(`${h.key}: 인라인 스타일 overflow(${h.token}) — 클래스 규칙이 닿지 않는다. 허용 목록에 사유를 적거나 클래스로 바꿀 것`)
    else if (h.kind === 'variant' && !positioned) out.push(`${h.key}: \`${h.token}\` — 접두어·임의값 변형은 규칙이 못 덮는다. 같은 요소에 relative|absolute|fixed|sticky 를 직접 주거나 허용 목록에 사유를 적을 것 → "${h.cls}"`)
    else if (h.kind === 'class' && h.mainSelf && !positioned) out.push(`${h.key}: \`<main>\` 자신은 규칙이 덮지 않는다(후손만) — relative 를 직접 줄 것 → "${h.cls}"`)
  }
  return out
}

function allowProblems(hits: Hit[], allow: Record<string, Allow>, texts: Map<string, string>): string[] {
  const out: string[] = []
  for (const [key, e] of Object.entries(allow)) {
    const hit = hits.find((h) => h.key === key)
    if (!e.why.trim()) out.push(`${key}: 허용 사유가 비어 있다`)
    if (!hit) {
      out.push(`${key}: 허용 목록에만 있고 코드에는 세로 스크롤 토큰이 없다(지울 것)`)
      continue
    }
    const text = texts.get(hit.file) ?? ''
    if (e.must && !e.must.test(text)) out.push(`${key}: 사유가 기대는 사실이 사라졌다 — 파일에 ${e.must} 가 있어야 한다`)
    if (e.mustNot && e.mustNot.test(text)) out.push(`${key}: 사유("자손 없음")가 깨졌다 — 파일에 ${e.mustNot} 가 생겼다. 이 상자를 다시 볼 것`)
  }
  return out
}

// ───────────────────────── globals.css 규칙 ─────────────────────────

/** `@layer <name> { … }` 블록 본문을 모으고, 그것들을 뺀 나머지 CSS 를 돌려준다. */
function splitLayer(css: string, name: string): { bodies: string[]; rest: string } {
  const bodies: string[] = []
  let rest = ''
  let pos = 0
  const re = new RegExp(`@layer\\s+${name}\\s*\\{`, 'g')
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1
    let j = m.index + m[0].length
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    bodies.push(css.slice(m.index + m[0].length, j - 1))
    rest += css.slice(pos, m.index)
    pos = j
    re.lastIndex = j
  }
  return { bodies, rest: rest + css.slice(pos) }
}

function parseDecls(inner: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of inner.split(';')) {
    const i = d.indexOf(':')
    if (i > 0) out[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).replace(/\s+/g, ' ').trim().toLowerCase()
  }
  return out
}

function rulesOf(body: string): { selector: string; decls: Record<string, string> }[] {
  const out: { selector: string; decls: Record<string, string> }[] = []
  let i = 0
  while (i < body.length) {
    const open = body.indexOf('{', i)
    if (open < 0) break
    let depth = 1
    let j = open + 1
    while (j < body.length && depth > 0) {
      if (body[j] === '{') depth++
      else if (body[j] === '}') depth--
      j++
    }
    out.push({ selector: body.slice(i, open).trim(), decls: parseDecls(body.slice(open + 1, j - 1)) })
    i = j
  }
  return out
}

/** `:where(a, b, c)` 의 최상위 쉼표 목록. `:where()` 가 아니면 null. */
function whereList(selector: string): string[] | null {
  const m = selector.match(/^:where\(([\s\S]*)\)$/)
  if (!m) return null
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of m[1]) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.replace(/\s+/g, ' ').trim())
}

function ruleProblems(rawCss: string): string[] {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const { bodies, rest } = splitLayer(css, 'base')
  const rules = bodies.flatMap(rulesOf)
  const out: string[] = []
  for (const sel of REQUIRED_SELECTORS) {
    const covering = rules.filter((r) => whereList(r.selector)?.includes(sel))
    if (covering.length === 0) out.push(`@layer base 안 \`:where(…)\` 규칙에 \`${sel}\` 가 없다`)
    for (const r of covering) if (r.decls.position !== 'relative') out.push(`\`${sel}\` 규칙의 position 이 relative 가 아니다: ${r.decls.position ?? '(없음)'}`)
  }
  // 층 밖(unlayered)에 두면 `absolute|fixed|sticky` 유틸리티보다 이겨 그 상자들의 위치를 덮어쓴다.
  if (/main\s+\.overflow-/.test(rest)) out.push('`main .overflow-*` 규칙이 @layer base 밖에 있다 — utilities 층의 absolute|fixed|sticky 를 이겨 버린다')
  return out
}

// ───────────────────────── 시험 ─────────────────────────

test('판별기 자체 점검: 소스 스캔이 변형·임의값·인라인·main 자신·주석·상수 문자열을 가려낸다', () => {
  const kinds = (src: string) => scanSource('x.tsx', src).map((h) => `${h.kind}${h.mainSelf ? '+main' : ''}`)
  assert.deepEqual(kinds('<div className="flex overflow-y-auto px-4">'), ['class'])
  assert.deepEqual(kinds('<div className="overflow-auto">'), ['class'])
  assert.deepEqual(kinds('<div className="overflow-y-scroll">'), ['class'])
  assert.deepEqual(kinds('<div className="md:overflow-y-auto">'), ['variant'])
  assert.deepEqual(kinds('<div className="max-lg:overflow-auto">'), ['variant'])
  assert.deepEqual(kinds('<div className="overflow-[auto]">'), ['variant'])
  assert.deepEqual(kinds('<div className="overflow-y-[scroll]">'), ['variant'])
  assert.deepEqual(kinds('<div className="[overflow-y:auto]">'), ['variant'])
  assert.deepEqual(kinds('<div className="!overflow-y-auto">'), ['variant'], 'Tailwind 중요 표시(앞 `!`)는 규칙의 `.overflow-y-auto` 에 안 걸린다')
  assert.deepEqual(kinds('<div className="overflow-y-auto!">'), ['variant'], 'Tailwind 4 중요 표시(뒤 `!`)도 마찬가지')
  assert.deepEqual(kinds('<div className="md:!overflow-auto">'), ['variant'])
  assert.deepEqual(kinds('<main className="relative overflow-y-auto">'), ['class+main'])
  assert.deepEqual(kinds('<div className={`flex ${x} overflow-y-auto`}>'), ['class'])
  assert.deepEqual(kinds("const BOX = 'max-h-[40dvh] overflow-y-auto overscroll-contain'"), ['class'])
  assert.deepEqual(kinds("el.style.overflowY = h > MAX ? 'auto' : 'hidden'"), ['inline'])
  assert.deepEqual(kinds("<div style={{ overflowY: 'scroll' }} />"), ['inline'])
  // 대상이 아닌 것: 가로, hidden/visible, 비교, 주석, 읽기
  assert.deepEqual(kinds('<div className="overflow-x-auto overflow-hidden overflow-y-hidden overflow-visible">'), [])
  assert.deepEqual(kinds('<div className="no-overflow-auto overflow-auto-x">'), [])
  assert.deepEqual(kinds("if (getComputedStyle(p).overflowY === 'auto') run()"), [])
  assert.deepEqual(kinds("el.style.overflow = 'hidden'"), [])
  assert.deepEqual(kinds('// overflow-y-auto 는 주석\n/* overflow-auto */ <div className="flex">{/* overflow-y-scroll */}'), [])
  assert.deepEqual(kinds('const x = 1 // overflow-y-auto 는 줄 끝 주석\nconst y = "overflow-auto" // 뒤쪽만 주석'), ['class'], '문자열 앞의 토큰은 남기고 줄 끝 주석은 지운다')
  // 문자열 안의 `//` 는 주석이 아니다 — 같은 줄 뒤쪽 className 이 지워지면 안 된다(REV-174 L-1)
  assert.deepEqual(kinds("const u = 'a // b'; const c = <div className=\"md:overflow-y-auto\"/>"), ['variant'])
  assert.deepEqual(kinds('const u = "https://x.y/z"; const c = <div className="max-lg:overflow-auto"/>'), ['variant'])
  assert.deepEqual(kinds('const r = /^W\\//; const c = <div className="md:overflow-y-auto"/>'), ['variant'], '정규식 리터럴의 `\\//` 를 줄 주석으로 오인하지 않는다')
  assert.deepEqual(kinds("<p>don't</p> // overflow-y-auto 는 주석"), [], '짝 없는 아포스트로피는 문자열로 보지 않아 뒤의 줄 주석이 지워진다')
  // 요소 하나의 className 문자열을 정확히 잘라 낸다
  const [h] = scanSource('x.tsx', '<a className="p-1 relative">x</a><div className="min-h-0 md:relative overflow-y-auto">')
  assert.equal(h.cls, 'min-h-0 md:relative overflow-y-auto')
  assert.equal(hasPositionToken(h.cls), false, '`md:relative` 는 위치 지정으로 인정하지 않는다')
  assert.equal(hasPositionToken('min-h-0 relative overflow-y-auto'), true)
})

test('판별기 자체 점검: 판정 정책 — 변형·인라인·main 자신만 걸리고, 같은 요소의 위치 지정·허용 목록으로 풀린다', () => {
  const hits = (src: string) => assignKeys(scanSource('x.tsx', src))
  const bad = (src: string, allow: Record<string, Allow> = {}) => hitProblems(hits(src), allow).length
  assert.equal(bad('<div className="overflow-y-auto">'), 0, '접두어 없는 표준 토큰은 규칙이 덮는다')
  assert.equal(bad('<div className="md:overflow-y-auto">'), 1)
  assert.equal(bad('<div className="relative md:overflow-y-auto">'), 0, '같은 요소에 직접 위치 지정이 있으면 통과')
  assert.equal(bad('<div className="md:relative md:overflow-y-auto">'), 1, '`md:relative` 는 인정하지 않는다')
  assert.equal(bad('<div className="overflow-[auto]">'), 1)
  assert.equal(bad('<div className="!overflow-y-auto"><span className="sr-only">x</span></div>'), 1, '중요 표시 토큰은 규칙이 못 덮으니 직접 위치 지정이 필요하다')
  assert.equal(bad('<div className="overflow-y-auto!">'), 1)
  assert.equal(bad('<div className="relative !overflow-y-auto">'), 0, '같은 요소에 직접 위치 지정이 있으면 통과')
  assert.equal(bad("el.style.overflowY = 'auto'"), 1)
  assert.equal(bad("el.style.overflowY = 'auto'", { x: { why: 'r' } }), 1, '열쇠는 토큰 열쇠(파일 경로)여야 한다')
  assert.equal(bad("el.style.overflowY = 'auto'", { 'x.tsx': { why: 'r' } }), 0)
  assert.equal(bad('<main className="overflow-y-auto">'), 1, '`main` 자신은 규칙이 덮지 않는다')
  assert.equal(bad('<main className="relative overflow-y-auto">'), 0)
  assert.equal(bad('<main className="fixed overflow-y-auto">'), 0)
  // 한 파일에 토큰이 둘 이상이면 열쇠에 #순번
  assert.deepEqual(hits('<a className="overflow-y-auto"/><b className="overflow-auto"/>').map((h) => h.key), ['x.tsx#1', 'x.tsx#2'])
  assert.deepEqual(hits('<a className="overflow-y-auto"/>').map((h) => h.key), ['x.tsx'])
  // 허용 목록 무결성
  const texts = new Map([['x.tsx', 'createPortal( overflow-y-auto']])
  const one = hits('<a className="overflow-y-auto"/>')
  assert.deepEqual(allowProblems(one, { 'x.tsx': { why: '사유', must: /createPortal\(/ } }, texts), [])
  assert.equal(allowProblems(one, { 'x.tsx': { why: '  ' } }, texts).length, 1, '사유가 비면 실패')
  assert.equal(allowProblems(one, { 'y.tsx': { why: '사유' } }, texts).length, 1, '코드에 없는 항목은 실패')
  assert.equal(allowProblems(one, { 'x.tsx': { why: '사유', mustNot: /createPortal/ } }, texts).length, 1, 'mustNot 이 깨지면 실패')
  assert.equal(allowProblems(one, { 'x.tsx': { why: '사유', must: /nope/ } }, texts).length, 1, 'must 가 깨지면 실패')
})

test('판별기 자체 점검: CSS 규칙 판정 — 선택자 누락·position 변경·층 밖을 가려낸다', () => {
  const sel = REQUIRED_SELECTORS.join(', ')
  const good = `@layer base { :where(${sel}) { position: relative; } }`
  assert.deepEqual(ruleProblems(good), [])
  assert.deepEqual(ruleProblems(`/* 주석 @layer base */\n@layer base {\n  :where(\n    ${REQUIRED_SELECTORS.join(',\n    ')}\n  ) {\n    position:   RELATIVE ;\n  }\n}`), [])
  assert.equal(ruleProblems('').length, 4, '규칙이 없으면 선택자 네 개가 모두 빠진 것')
  assert.equal(ruleProblems(`@layer base { :where(${REQUIRED_SELECTORS.slice(0, 3).join(', ')}) { position: relative } }`).length, 1)
  assert.equal(ruleProblems(`@layer base { :where(${sel}) { position: static } }`).length, 4)
  assert.equal(ruleProblems(`@layer base { :where(${sel}) { top: 0 } }`).length, 4)
  assert.ok(ruleProblems(`:where(${sel}) { position: relative }`).length >= 5, '층 밖 규칙은 선택자 누락 + 층 밖 경고')
  assert.equal(ruleProblems(`@layer utilities { :where(${sel}) { position: relative } }`).length, 5, '다른 층에 있으면 base 규칙이 아니다(선택자 4 + 층 밖 경고)')
  assert.equal(ruleProblems(`${good}\n:where(${sel}) { position: relative }`).length, 1, 'base 에 있어도 층 밖에 같은 규칙이 또 있으면 실패')
  assert.equal(ruleProblems(`@layer base, components;\n${good}`).length, 0, '층 순서 선언문은 블록이 아니다')
})

test('globals.css: `main` 안 세로 스크롤 상자를 relative 로 만드는 규칙이 @layer base 에 있다', () => {
  const css = readFileSync(join(srcDir, 'app', 'globals.css'), 'utf8')
  assert.deepEqual(ruleProblems(css), [])
})

test('소스 스캔: 빈 통과 방지 — 파일·토큰 수 하한과 알려진 상자', () => {
  const { files, hits } = scanTree()
  // 하한의 목적은 「디렉터리 이동·정규식 고장으로 아무것도 안 읽고 통과」를 막는 것뿐이다. 읽은 값(2026-10-10: 파일 약 620, 토큰 22)보다 일부러 한참 낮춰,
  // 세로 스크롤 상자를 한두 개 지우거나 파일을 정리하는 정상 변경에는 깨지지 않게 한다. 정규식이 일부만 놓치는 고장은 아래 알려진 상자 이름 검사가 잡는다.
  assert.ok(files >= 300, `읽은 소스 파일이 너무 적다(${files}) — 디렉터리가 옮겨졌나?`)
  assert.ok(hits.length >= 15, `세로 스크롤 토큰이 너무 적다(${hits.length}) — 정규식이나 경로가 깨졌나? (상자를 대거 정리한 변경이라면 이 하한과 아래 알려진 상자 목록을 함께 손볼 것)`)
  const keys = hits.map((h) => h.key)
  for (const f of ['chat/MessageList.tsx', 'eval/EvalResult.tsx', 'admin/console/ConsoleShell.tsx', 'common/Sheet.tsx', 'lesson/LessonScreen.tsx', 'scenario/RolePlayGoalCard.tsx', 'vocab/WordForm.tsx']) {
    assert.ok(keys.includes(`src/components/${f}`), `${f} 의 세로 스크롤 토큰을 찾지 못함: ${keys.join(', ')}`)
  }
  assert.ok(keys.includes('src/app/(app)/layout.tsx'), '앱 셸 main 의 토큰을 찾지 못함')
  const goal = hits.find((h) => h.file.endsWith('scenario/RolePlayGoalCard.tsx'))
  assert.equal(goal?.kind, 'class', '상수 문자열(GOAL_REGION_MAX)의 토큰도 잡아야 한다')
})

test('소스 스캔: 규칙이 못 덮는 모양(접두어·임의값 변형, 인라인 스타일, main 자신)은 직접 위치 지정이나 허용 사유가 있어야 한다', () => {
  assert.deepEqual(hitProblems(scanTree().hits, ALLOW), [])
})

test('허용 목록: 사유가 있고, 코드에 실제로 있고, 사유가 기대는 사실이 그대로다', () => {
  const { hits, texts } = scanTree()
  assert.deepEqual(allowProblems(hits, ALLOW, texts), [])
})

test('콘솔 셸 `main`: relative(조상에도 위치 지정이 없어 안쪽 상자가 없어도 sr-only 가 문서 스크롤을 늘린다) + 스크롤 한 곳', () => {
  const src = readFileSync(join(srcDir, 'components', 'admin', 'console', 'ConsoleShell.tsx'), 'utf8')
  const cls = src.match(/<main\s+className="([^"]*)"/)?.[1] ?? ''
  assert.ok(cls, '<main className="…"> 를 찾지 못함')
  const tokens = cls.split(/\s+/)
  for (const t of ['relative', 'overflow-y-auto', 'min-h-0', 'min-w-0']) assert.ok(tokens.includes(t), `콘솔 main 에 ${t} 필요: ${cls}`)
})
