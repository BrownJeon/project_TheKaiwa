import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { exampleJaLines, parseAnswerMd, parseInline, sanitizeAnswerText, type AskBlock } from '../answerMd'
import AnswerMarkdown from '../AnswerMarkdown'
import { readCode } from '../../__tests__/sourceCode'

// task-064 §25-11 ①~④ — answerMd 는 화이트리스트 노드(문단·굵게·기울임·목록·인용·줄바꿈)만, 링크·HTML 은 어떤 형태로도 그리지 않는다.

const render = (md: string) => renderToStaticMarkup(createElement(AnswerMarkdown, { blocks: parseAnswerMd(md), annOf: () => ({ s: 'off' as const }) }))

const HOSTILE = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="https://evil.example/x"></iframe>',
  '[눌러](javascript:alert(1))',
  '![x](data:image/png;base64,AAAA)',
  '[링크](https://example.com)',
  '맨 주소 https://example.com/path?q=1 끝',
  '웹 www.example.com 끝',
  '꺾쇠 <https://example.com> 끝',
  '스킴 javascript:alert(1) 끝',
  '데이터 data:text/html,<b>x</b> 끝',
  'vb vbscript:msgbox(1) 끝',
].join('\n\n')

test('① 렌더 결과에 스크립트·iframe·img·링크·href·onerror·스킴·주소가 0건, 링크 글은 남는다', () => {
  const html = render(HOSTILE)
  for (const bad of ['<script', '<iframe', '<img', '<a ', '<a>', 'href=', 'onerror', 'javascript:', 'data:', 'vbscript:', 'https://', 'http://', 'www.', 'evil.example']) {
    assert.ok(!html.toLowerCase().includes(bad), `${bad} 가 남았다: ${html}`)
  }
  assert.ok(html.includes('눌러'))
  assert.ok(html.includes('링크'))
  assert.ok(html.includes('끝'))
})

test('① sanitizeAnswerText — 제어 문자(\\n 제외) 제거 · 탭 → 공백 · 각주 표식 지움 · CRLF → LF', () => {
  assert.equal(sanitizeAnswerText('가\u0000나\u0007다\r\n라\r마'), '가나다\n라\n마')
  assert.equal(sanitizeAnswerText('a\tb'), 'a b')
  assert.equal(sanitizeAnswerText('뜻이에요[^3] 그리고[^note]'), '뜻이에요 그리고')
  assert.equal(sanitizeAnswerText('<b>굵게</b>'), '굵게')
  assert.equal(sanitizeAnswerText('[글](https://a.b/c(d))'), '글')
  assert.equal(sanitizeAnswerText('![설명](https://a.b/x.png)남음'), '남음')
})

test('① ask/ 소스 어디에도 HTML 주입 경로가 없다(주석 제거본 검사)', () => {
  const dir = join(__dirname, '..')
  const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f))
  assert.ok(files.length >= 5)
  for (const f of files) {
    const code = readCode(join(dir, f))
    for (const bad of ['dangerouslySetInnerHTML', 'innerHTML', 'DOMParser', 'outerHTML', 'insertAdjacentHTML']) {
      assert.ok(!code.includes(bad), `${f} 에 ${bad}`)
    }
  }
  // 답 렌더러는 링크 부품을 쓰지 않는다(근거 카드·목록 행·404 링크만 Link).
  const md = readCode(join(dir, 'AnswerMarkdown.tsx'))
  assert.ok(!/next\/link|<a\b|href/.test(md))
})

test('② 문단 — 이어진 줄은 줄바꿈 노드, 빈 줄이 블록 경계, 빈 입력 → []', () => {
  assert.deepEqual(parseAnswerMd(''), [])
  assert.deepEqual(parseAnswerMd('  \n\n '), [])
  assert.deepEqual(parseAnswerMd('첫 줄\n둘째 줄\n\n새 문단'), [
    { k: 'p', c: [{ t: 'text', s: '첫 줄' }, { t: 'br' }, { t: 'text', s: '둘째 줄' }] },
    { k: 'p', c: [{ t: 'text', s: '새 문단' }] },
  ])
})

test('② 목록 — `- `·`* `·`+ `·`・`·`• ` 한 목록, 들여 쓴 이음 줄은 앞 항목에 줄바꿈으로', () => {
  const b = parseAnswerMd('- 하나\n* 둘\n+ 셋\n・넷\n• 다섯\n  이어짐')
  assert.equal(b.length, 1)
  assert.equal(b[0].k, 'ul')
  const items = (b[0] as Extract<AskBlock, { k: 'ul' }>).items
  assert.equal(items.length, 5)
  assert.deepEqual(items[4], [{ t: 'text', s: '다섯' }, { t: 'br' }, { t: 'text', s: '이어짐' }])
})

test('② 번호 목록 — `1. `·`1) `, 첫 번호를 start 로', () => {
  assert.deepEqual(parseAnswerMd('3. 가\n4) 나'), [{ k: 'ol', start: 3, items: [[{ t: 'text', s: '가' }], [{ t: 'text', s: '나' }]] }])
})

test('② `#` 제목 → 굵은 문단 · 가로줄·울타리 줄 버림 · 블록 종류가 바뀌면 빈 줄 없이도 새 블록', () => {
  assert.deepEqual(parseAnswerMd('## 자주 틀린 곳'), [{ k: 'p', c: [{ t: 'strong', c: [{ t: 'text', s: '자주 틀린 곳' }] }] }])
  assert.deepEqual(parseAnswerMd('위\n---\n아래'), [
    { k: 'p', c: [{ t: 'text', s: '위' }] },
    { k: 'p', c: [{ t: 'text', s: '아래' }] },
  ])
  assert.deepEqual(parseAnswerMd('```\n코드 같은 글\n```'), [{ k: 'p', c: [{ t: 'text', s: '코드 같은 글' }] }])
  // 예문 뒤의 한글 한 줄은 뜻으로 가져가지 않도록 `> →` 줄을 둔다(기호 없는 뜻 줄 규칙은 H-1 시험이 잠근다).
  const mixed = parseAnswerMd('설명\n- 항목\n1. 번호\n> 窓が開いている。\n> → 창문\n끝')
  assert.deepEqual(
    mixed.map((x) => x.k),
    ['p', 'ul', 'ol', 'ex', 'p'],
  )
})

test('③ 예문 — JA+M · JA 만 · 한 묶음 여러 예문 · `->` 뜻 · `**` 표식 지움', () => {
  assert.deepEqual(parseAnswerMd('> 窓が開いている。\n> → 창문이 열려 있어요.'), [{ k: 'ex', ja: '窓が開いている。', meaning: '창문이 열려 있어요.' }])
  assert.deepEqual(parseAnswerMd('> 窓が開いている。'), [{ k: 'ex', ja: '窓が開いている。', meaning: null }])
  assert.deepEqual(parseAnswerMd('> 窓が開いている。\n> → 가\n> 窓が開けてある。\n> -> 나'), [
    { k: 'ex', ja: '窓が開いている。', meaning: '가' },
    { k: 'ex', ja: '窓が開けてある。', meaning: '나' },
  ])
  assert.deepEqual(parseAnswerMd('> **窓が**開いている。\n> →'), [{ k: 'ex', ja: '窓が開いている。', meaning: null }])
  assert.deepEqual(parseAnswerMd('> 窓が開いている。\n> → 가\n\n> 窓が開けてある。\n> → 나').map((b) => b.k), ['ex', 'ex'])
})

test('③ 예문 아님 → 인용 상자 — M 이 먼저 · 한글 섞인 일본어 줄 · M 연달아 · 201 코드포인트', () => {
  assert.equal(parseAnswerMd('> → 뜻만\n> 窓が開いている。')[0].k, 'quote')
  assert.equal(parseAnswerMd('> 窓が 열려 있어요')[0].k, 'quote')
  assert.equal(parseAnswerMd('> 窓が開いている。\n> → 가\n> → 나')[0].k, 'quote')
  assert.equal(parseAnswerMd(`> ${'あ'.repeat(200)}`)[0].k, 'ex')
  assert.equal(parseAnswerMd(`> ${'あ'.repeat(201)}`)[0].k, 'quote')
  assert.deepEqual(parseAnswerMd('> 그냥 인용\n> 둘째 줄'), [{ k: 'quote', c: [{ t: 'text', s: '그냥 인용' }, { t: 'br' }, { t: 'text', s: '둘째 줄' }] }])
})

test('③ exampleJaLines — 예문 일본어 줄만 순서대로(뜻·인용·문단 제외)', () => {
  const blocks = parseAnswerMd('설명 「窓」\n\n> 窓が開いている。\n> → 가\n\n> 그냥 인용\n\n> 窓が開けてある。')
  assert.deepEqual(exampleJaLines(blocks), ['窓が開いている。', '窓が開けてある。'])
})

test('④ 인라인 — 굵게·기울임·굵게 안 기울임·짝 없는 별표는 글자·굵게 안 굵게는 글자', () => {
  assert.deepEqual(parseInline('**굵게** 와 __밑줄굵게__'), [
    { t: 'strong', c: [{ t: 'text', s: '굵게' }] },
    { t: 'text', s: ' 와 ' },
    { t: 'strong', c: [{ t: 'text', s: '밑줄굵게' }] },
  ])
  assert.deepEqual(parseInline('*기울임* 끝'), [{ t: 'em', c: [{ t: 'text', s: '기울임' }] }, { t: 'text', s: ' 끝' }])
  assert.deepEqual(parseInline('**굵게 *기울임* 굵게**'), [
    { t: 'strong', c: [{ t: 'text', s: '굵게 ' }, { t: 'em', c: [{ t: 'text', s: '기울임' }] }, { t: 'text', s: ' 굵게' }] },
  ])
  assert.deepEqual(parseInline('3 * 4 = 12 그리고 별*'), [{ t: 'text', s: '3 * 4 = 12 그리고 별*' }])
  assert.deepEqual(parseInline('* 띄움*'), [{ t: 'text', s: '* 띄움*' }])
  assert.deepEqual(parseInline('**바깥 __안__ 바깥**'), [{ t: 'strong', c: [{ t: 'text', s: '바깥 __안__ 바깥' }] }])
})

test('④ 렌더 — 일본어 구간만 lang=ja, 굵게는 strong, 목록은 ul/ol, 예문 뜻 줄은 늘 보임', () => {
  const html = render('「窓」은 **창문**이에요.\n\n- 하나\n\n2. 둘\n\n> 窓が開いている。\n> → 창문이 열려 있어요.')
  assert.match(html, /<span lang="ja"[^>]*>「窓」<\/span>/)
  assert.match(html, /<strong class="font-bold">/)
  assert.match(html, /<ul class="[^"]*list-disc/)
  assert.match(html, /<ol start="2"/)
  assert.ok(html.includes('창문이 열려 있어요.'))
  assert.ok(html.includes('뜻: '))
})

// ── REV-064-U1 H-1 — 예문 뜻 줄 두 형식(§25-6 B 정정): `> →` 줄(우선) · JA 줄 바로 다음의 기호 없는 한 줄 ──────────────────

const JA1 = '窓が開いている。'
const JA2 = '窓が開けてある。'
const ex = (ja: string, meaning: string | null): AskBlock => ({ k: 'ex', ja, meaning })
const para = (s: string): AskBlock => ({ k: 'p', c: [{ t: 'text', s }] })

test('H-1 ① PE 픽스처가 실제로 내는 예문 모양(`> 일본어` 바로 아래 기호 없는 뜻 줄)을 그대로 넣으면 뜻이 예문 상자 안에 붙는다', () => {
  const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/ask.json'), 'utf8')) as {
    cases: { id: string; history?: { role: string; content: string }[] }[]
  }
  const answers = fx.cases.flatMap((c) => (c.history ?? []).filter((h) => h.role === 'assistant' && /(^|\n)> /.test(h.content)).map((h) => ({ id: c.id, md: h.content })))
  assert.ok(answers.length >= 1, '픽스처에 예문이 든 선생님 답이 있어야 이 교차 시험이 뜻이 있다')
  for (const a of answers) {
    const lines = a.md.split('\n')
    const expected: { ja: string; ko: string }[] = []
    lines.forEach((l, i) => {
      if (l.startsWith('> ') && lines[i + 1] && !lines[i + 1].startsWith('>')) expected.push({ ja: l.slice(2).trim(), ko: lines[i + 1].trim() })
    })
    assert.ok(expected.length >= 1, `${a.id}: 기대 예문이 없다`)
    const blocks = parseAnswerMd(a.md)
    const exs = blocks.filter((b): b is Extract<AskBlock, { k: 'ex' }> => b.k === 'ex')
    assert.deepEqual(
      exs.map((b) => ({ ja: b.ja, ko: b.meaning })),
      expected,
      `${a.id}: 예문 상자마다 뜻이 붙어야 한다`,
    )
    // 뜻이 상자 밖 별도 문단으로 새지 않는다.
    for (const e of expected) assert.ok(!blocks.some((b) => b.k === 'p' && JSON.stringify(b.c).includes(e.ko)), `${a.id}: 「${e.ko}」 가 상자 밖 문단으로 떨어졌다`)
  }
})

test('H-1 ② 기호 없는 뜻 줄 — 한 예문 · 앞뒤 문단 · 뜻이 상자 안(렌더)', () => {
  assert.deepEqual(parseAnswerMd(`${'> ' + JA1}\n창문이 열려 있어요.`), [ex(JA1, '창문이 열려 있어요.')])
  assert.deepEqual(parseAnswerMd(`핵심이에요.\n\n> ${JA1}\n창문이 열려 있어요.\n\n다음 설명`), [para('핵심이에요.'), ex(JA1, '창문이 열려 있어요.'), para('다음 설명')])
  const html = render(`> ${JA1}\n창문이 열려 있어요.`)
  assert.equal((html.match(/bg-surface2/g) ?? []).length, 1, '예문 상자 하나')
  assert.match(html, /bg-surface2[\s\S]*뜻: [\s\S]*창문이 열려 있어요\./)
  assert.ok(!/<p class="[^"]*text-\[15px\][^"]*">[^<]*창문이 열려 있어요/.test(html), '뜻이 본문 문단으로 따로 그려지면 안 된다')
})

test('H-1 ③ 두 형식을 섞어도 — 예문마다 제 뜻 · 한 묶음 안에서 `→` 줄과 기호 없는 줄이 이어짐', () => {
  // 서로 다른 묶음(빈 줄) — 한쪽은 `> →`, 다른 쪽은 기호 없는 줄
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> → 가\n\n> ${JA2}\n나`), [ex(JA1, '가'), ex(JA2, '나')])
  // 같은 묶음 — 앞 예문은 `→`, 마지막 예문은 기호 없는 줄
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> → 가\n> ${JA2}\n나`), [ex(JA1, '가'), ex(JA2, '나')])
  // 뜻 줄 없는 앞 예문 + 마지막 예문의 기호 없는 뜻
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> ${JA2}\n나`), [ex(JA1, null), ex(JA2, '나')])
  // 기호 없는 뜻 뒤에 곧바로 새 인용 묶음
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n가\n> ${JA2}\n나`), [ex(JA1, '가'), ex(JA2, '나')])
  // 여러 예문(빈 줄로 구분)
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n창문이 열려 있어요.\n\n> ${JA2}\n누군가 열어 두었어요.`), [ex(JA1, '창문이 열려 있어요.'), ex(JA2, '누군가 열어 두었어요.')])
})

test('H-1 ④ `> →`(또는 `->`) 줄이 있으면 그것이 우선 — 뒤따르는 기호 없는 줄은 별도 문단', () => {
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> → 가\n나`), [ex(JA1, '가'), para('나')])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> -> 가\n나`), [ex(JA1, '가'), para('나')])
  // 기존 `> →` 동작은 그대로(25-11 ③)
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> → 창문이 열려 있어요.`), [ex(JA1, '창문이 열려 있어요.')])
})

test('H-1 ⑤ 뜻 줄에 일본어가 섞여도 한글이 있으면 뜻 · 굵게 표식과 앞의 화살표는 지움 · 뒤따르는 줄은 새 문단', () => {
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n창문이 열려 있어요 (窓が開いている)`), [ex(JA1, '창문이 열려 있어요 (窓が開いている)')])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n**창문**이 열려 있어요.`), [ex(JA1, '창문이 열려 있어요.')])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n→ 창문이 열려 있어요.`), [ex(JA1, '창문이 열려 있어요.')])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n창문이 열려 있어요.\n이 문장은 자주 써요.`), [ex(JA1, '창문이 열려 있어요.'), para('이 문장은 자주 써요.')])
})

test('H-1 ⑥ 뜻으로 안 맞으면 지금처럼 별도 문단 — 한글 0자 · 120 코드포인트 초과 · 빈 줄 뒤 · 목록 표식 · 제목', () => {
  // 한글이 없음(일본어만·영어만)
  assert.deepEqual(parseAnswerMd(`> ${JA1}\nまどがあいている。`), [ex(JA1, null), para('まどがあいている。')])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\nThe window is open.`), [ex(JA1, null), para('The window is open.')])
  // 120 / 121 코드포인트 경계
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n${'가'.repeat(120)}`), [ex(JA1, '가'.repeat(120))])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n${'가'.repeat(121)}`), [ex(JA1, null), para('가'.repeat(121))])
  // 빈 줄 뒤
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n\n창문이 열려 있어요.`), [ex(JA1, null), para('창문이 열려 있어요.')])
  // 목록 표식 · 번호 · 제목 · 인용
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n- 창문이 열려 있어요.`).map((b) => b.k), ['ex', 'ul'])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n・창문이 열려 있어요.`).map((b) => b.k), ['ex', 'ul'])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n1. 창문이 열려 있어요.`).map((b) => b.k), ['ex', 'ol'])
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n## 창문이 열려 있어요.`).map((b) => b.k), ['ex', 'p'])
  assert.equal((parseAnswerMd(`> ${JA1}\n- 창문이 열려 있어요.`)[0] as Extract<AskBlock, { k: 'ex' }>).meaning, null)
  // 일본어 줄 사이에 빈 `>` 줄이 끼면 「바로 다음」이 아니다
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n>\n창문이 열려 있어요.`), [ex(JA1, null), para('창문이 열려 있어요.')])
})

test('H-1 ⑦ 인용 묶음이 예문 묶음이 아니면 뒤따르는 줄을 뜻으로 가져가지 않는다', () => {
  // 한글 섞인 일본어 줄 → 인용 상자 + 문단
  assert.deepEqual(parseAnswerMd('> 窓が 열려 있어요\n창문이 열려 있어요.').map((b) => b.k), ['quote', 'p'])
  // 첫 줄이 뜻(M) → 인용 상자 + 문단
  assert.deepEqual(parseAnswerMd(`> → 뜻만\n> ${JA1}\n창문이 열려 있어요.`).map((b) => b.k), ['quote', 'p'])
  // 마지막 줄이 뜻(M)이면 이미 뜻이 있다
  assert.deepEqual(parseAnswerMd(`> ${JA1}\n> →\n창문이 열려 있어요.`), [ex(JA1, null), para('창문이 열려 있어요.')])
  // 그냥 인용
  assert.deepEqual(parseAnswerMd('> 그냥 인용\n둘째 줄').map((b) => b.k), ['quote', 'p'])
  // 일본어 줄이 201 코드포인트 → 인용 상자 + 문단
  assert.deepEqual(parseAnswerMd(`> ${'あ'.repeat(201)}\n뜻이에요.`).map((b) => b.k), ['quote', 'p'])
})

test('H-1 ⑧ exampleJaLines — 두 형식 모두 예문 일본어 줄만 순서대로', () => {
  const blocks = parseAnswerMd(`설명 「窓」\n\n> ${JA1}\n창문이 열려 있어요.\n\n> ${JA2}\n> → 나\n\n> 그냥 인용`)
  assert.deepEqual(exampleJaLines(blocks), [JA1, JA2])
})
