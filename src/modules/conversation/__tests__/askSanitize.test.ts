/**
 * task-064 dev-san — `sanitizeAskAnswerMd`(저장 전 `answerMd` 살균, api-contract §2-18-A 8항) 보강 시험.
 * REV-064-S1 [Medium]: 태그 제거가 단일 패스라 중첩(`<<<b>b>script>`)·줄바꿈 태그(`<img ⏎ onerror=…>`)가 살아남았다.
 * 여기서는 고정점 반복·줄바꿈 포함 태그·속성 안 `>`·불완전 태그·중첩 링크/스킴·제어 문자·긴 입력(선형)·멱등·정상 글 보존을 고정한다.
 *
 * 허용 기준(정상 글 보존): ① `<` 바로 뒤가 영문자·`/`·`!`·`?` 일 때만 태그 시작으로 본다 — `3 < 5`·`3<5`·`a > b`·`a>b`·`< script>`(공백) 는 글자다.
 * ② 줄 머리 `>`(인용·예문)는 그대로 둔다. ③ `<` 바로 뒤에 글자가 붙은 `a<b` 는 태그 시작 후보라 `>` 가 없으면 `<` 만 지운다(글자는 남음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAskResponse, sanitizeAskAnswerMd } from '../prompts/ask'

const san = (s: string): string => sanitizeAskAnswerMd(s).text

// ── 탐지기(구현과 따로 쓴 독립 정의) ─────────────────────────────────────────
const TAG_START = /<[A-Za-z/!?]/
const HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\p{Cf}|\uFFFD/u
const SCHEME_WORD = /\b(?:javascript|data|vbscript|file):/i
const WWW_WORD = /\bwww\.[^\s)」』]/i
/** 작은 입력 전용(정규식이 이차) — 완결된 `[레이블](주소)` 문법. */
const MD_LINK = /\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)/
/** `scheme://꼬리` — 선형 탐지. */
function hasAuthorityUrl(t: string): boolean {
  let from = 0
  for (;;) {
    const q = t.indexOf('://', from)
    if (q < 0) return false
    let b = q
    while (b > 0 && /[A-Za-z0-9+.-]/.test(t[b - 1])) b--
    let st = b
    while (st < q && !/[A-Za-z]/.test(t[st])) st++
    const tail = t[q + 3]
    if (st < q && tail !== undefined && !/[\s)」』]/.test(tail)) return true
    from = q + 1
  }
}
function leaks(t: string): string[] {
  const v: string[] = []
  if (TAG_START.test(t)) v.push('태그 시작')
  if (HIDDEN.test(t)) v.push('숨은 글자')
  if (SCHEME_WORD.test(t)) v.push('스킴')
  if (WWW_WORD.test(t)) v.push('www')
  if (hasAuthorityUrl(t)) v.push('://')
  return v
}
function leaksSmall(t: string): string[] {
  const v = leaks(t)
  if (MD_LINK.test(t)) v.push('링크 문법')
  if (/!\[[^\]\n]*\]\(/.test(t) && MD_LINK.test(t)) v.push('이미지 문법')
  return v
}
function assertClean(t: string, label = ''): void {
  assert.deepEqual(leaksSmall(t), [], `${label} 살균 결과에 위험 표지가 남았다: ${JSON.stringify(t.slice(0, 200))}`)
}

/** 깊이 n 중첩 태그: n 번 지워야 `<script>` 가 완성된다(`<<b>script>` = 1, `<<<b>b>script>` = 2). */
const nestedTag = (n: number): string => '<'.repeat(n + 1) + 'b>'.repeat(n) + 'script>alert(1)</b>'
/** 깊이 n 중첩 링크: `[[[x](javascript:alert(1))](javascript:alert(1))](https://e.example)`. */
function nestedLink(n: number, url = 'javascript:alert(1)'): string {
  let s = 'x'
  for (let i = 0; i < n; i++) s = `[${s}](${url})`
  return s
}

function timed<T>(fn: () => T): { v: T; ms: number } {
  const t0 = performance.now()
  const v = fn()
  return { v, ms: performance.now() - t0 }
}

// ── 1. 중첩 태그 — 고정점까지 반복 ────────────────────────────────────────────

test('살균(태그): 2·3·5중 중첩해도 `<script>` 가 다시 만들어지지 않는다', () => {
  for (const n of [1, 2, 3, 5, 9]) {
    const out = san(nestedTag(n))
    assert.ok(!TAG_START.test(out), `깊이 ${n}: ${out}`)
    assert.match(out, /alert\(1\)/, '태그 안 글자는 평문으로 남는다')
  }
  assert.equal(san('<<b>script>alert(1)</script>'), 'alert(1)')
})

test('살균(태그): 파서와 마지막 살균을 두 번 거쳐도(parseAskResponse → finalize) 3중 중첩이 재구성되지 않는다', () => {
  const md = `${nestedTag(3)} 한국어 설명이에요.`
  const parsed = parseAskResponse({ needsScope: null, answerMd: md, sourceKeys: [], confidence: 'HIGH', proposals: [] }, { shownKeys: [] })
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  assert.ok(!TAG_START.test(parsed.value.answerMd), parsed.value.answerMd)
  const second = san(parsed.value.answerMd)
  assert.equal(second, parsed.value.answerMd, '두 번째 살균은 아무것도 바꾸지 않는다(멱등)')
  assert.match(second, /한국어 설명이에요\./)
})

test('살균(태그): 태그 안 줄바꿈 — `<img src=x⏎onerror=…>`·`<scr⏎ipt>` 도 통째로 지워진다', () => {
  assert.equal(san('앞 <img src=x\nonerror=alert(1)> 뒤'), '앞  뒤')
  assert.equal(san('앞<a\n  href=x\n  title=y>링크</a>뒤'), '앞링크뒤')
  const out = san('<scr\nipt>alert(1)</scr\nipt>')
  assert.ok(!TAG_START.test(out) && !out.includes('ipt>'), out)
  // 태그 이름 안의 `<br>` 는 HTML 토크나이저와 같이 한 태그(`<scr<br>`)다 — 옛 구현은 `<br>` 을 줄바꿈으로 바꾼 뒤 `<scr⏎ipt>` 를 남겼다.
  const viaBr = san('<scr<br>ipt>alert(1)</script>')
  assert.ok(!viaBr.includes('<') && viaBr.includes('alert(1)'), viaBr)
})

test('살균(태그): 속성 값 안의 `>` 는 태그 끝이 아니다(따옴표 인식) — 뒤에 속성이 남지 않는다', () => {
  assert.equal(san('앞<img alt=">" src=x onerror=alert(1)>뒤'), '앞뒤')
  assert.equal(san("<a title='>' onclick=alert(1)>클릭</a>"), '클릭')
  assert.equal(san('<a href = "x>y" onmouseover=1>가</a>'), '가')
  // 닫히지 않은 따옴표는 첫 `>` 에서 끝낸다(남은 글이 통째로 사라지지 않는다).
  const open = san('앞 <a title="x>중간</a> 끝')
  assert.ok(!TAG_START.test(open) && open.includes('끝'), open)
})

test('살균(태그): 불완전 태그(`>` 없음)는 `<` 만 지우고 글자는 남긴다 — 태그 시작 후보가 남지 않는다', () => {
  assert.equal(san('텍스트 <scr'), '텍스트 scr')
  assert.equal(san('앞 <img src=x onerror=alert(1) 뒤'), '앞 img src=x onerror=alert(1) 뒤')
  assert.equal(san('<<<scr'), 'scr', '`<` 연속열은 한 번에')
  assert.equal(san('a<b 그리고 c'), 'ab 그리고 c')
  assert.equal(san('끝 </'), '끝 /')
  assert.equal(san('<!doctype'), '!doctype')
  assert.ok(!TAG_START.test(san('<?php echo 1')))
})

test('살균(태그): 글 한가운데 `a<b` 하나가 뒤의 설명·예문 블록을 지우지 않는다 — 빈 줄·줄 머리 `>` 에서 태그를 포기한다', () => {
  assert.equal(san('비교: a<b 라는 식이에요.\n\n> 窓が開いている。\n창문이 열려 있어요.'), '비교: ab 라는 식이에요.\n\n> 窓が開いている。\n창문이 열려 있어요.')
  assert.equal(san('a<b 설명\n> 窓が開いている。'), 'ab 설명\n> 窓が開いている。')
  assert.equal(san('a<b 설명\n\n그리고 x > y 예요'), 'ab 설명\n\n그리고 x > y 예요', '빈 줄을 넘어 뒤의 `>` 까지 지우지 않는다')
  assert.equal(san('a<b 설명\n  > 窓が開いている。'), 'ab 설명\n> 窓が開いている。')
  // 빈 줄을 낀 공격 모양도 태그 시작 후보는 남지 않는다(`<` 만 지워 글자가 남는다).
  const blank = san('<img src=x\n\nonerror=alert(1)>')
  assert.ok(!TAG_START.test(blank) && !blank.includes('<'), blank)
  // 한 줄 안에서 `>` 가 멀리(2,000자 넘게) 있으면 같은 글로 본다.
  const far = san(`앞 <a ${'가'.repeat(2_100)}> 뒤`)
  assert.ok(!TAG_START.test(far) && far.includes('뒤') && far.includes('가'.repeat(100)))
})

test('살균(태그): 대소문자·열고 닫기·공백/제어 문자를 끼운 변형', () => {
  assert.equal(san('<ScRiPt>alert(1)</sCrIpT>'), 'alert(1)')
  assert.equal(san('<SCRIPT\n>alert(1)</SCRIPT\t>'), 'alert(1)')
  assert.equal(san('<script/x>alert(1)</script >'), 'alert(1)')
  assert.equal(san('<scr\u200Bipt>alert(1)</scr\u200Bipt>'), 'alert(1)', '보이지 않는 글자를 끼워도')
  assert.equal(san('<\u0000script>alert(1)</script>'), 'alert(1)', '제어 문자를 끼워도')
  assert.equal(san('<svg/onload=alert(1)>'), '')
  assert.equal(san('<!-- 주석 --> 끝'), '끝')
  const viaComment = san('<scr<!-- x -->ipt>alert(1)</script>')
  assert.ok(!viaComment.includes('<') && viaComment.includes('alert(1)'), `태그 이름 안의 주석 모양도 한 태그로 본다: ${viaComment}`)
  assert.equal(san('가<br>나<br/>다<BR />라<br   >마'), '가\n나\n다\n라\n마', '<br> 은 줄바꿈')
})

test('살균(태그): `< script`(공백)는 태그가 아니라 글자다 — 그대로 둔다', () => {
  assert.equal(san('< script>alert(1)< /script>'), '< script>alert(1)< /script>')
  assert.equal(san('<\nscript>'), '<\nscript>')
})

// ── 2. 링크·이미지·스킴·URL — 같은 반복 ───────────────────────────────────────

test('살균(링크): 중첩 `[[x](javascript:…)](…)` 도 글자만 남는다 — 깊이 1·2·5·9', () => {
  assert.equal(san('[[x](javascript:alert(1))](https://evil.example/a)'), 'x')
  for (const n of [1, 2, 5, 9]) {
    assert.equal(san(nestedLink(n)), 'x', `깊이 ${n}`)
    assert.equal(san(nestedLink(n, 'data:text/html;base64,AAAA')), 'x', `data 깊이 ${n}`)
  }
  assert.equal(san('[a](java<b>script:alert(1))'), 'a')
})

test('살균(이미지): `![alt](…)` 은 통째로, 중첩·배지 형태도 남지 않는다', () => {
  assert.equal(san('앞 ![x](http://evil.example/a.png) 뒤'), '앞  뒤')
  assert.equal(san('앞 ![](javascript:alert(1)) 뒤'), '앞  뒤')
  for (const s of ['![[a](b)](c)', '[![alt](img)](link)', '![a](b)![c](d)![e](f)', '![x](java<b>script:alert(1))']) {
    const out = san(s)
    assertClean(out, s)
    assert.ok(!out.includes('!['), `${s} → ${out}`)
  }
})

test('살균(스킴·URL): 스킴 4종·`://`·`www.` 가 사라진다 — 대소문자·태그/백틱/보이지 않는 글자로 쪼개도', () => {
  assert.equal(san('a javascript:void b'), 'a  b')
  assert.equal(san('a JaVaScRiPt:alert b'), 'a  b')
  assert.equal(san('a javascript:alert(1) b'), 'a ) b', '꼬리는 공백·`)` 에서 끝난다(옛 동작 그대로 — `)` 한 글자는 남는다)')
  assert.equal(san('a data:text/html;base64,AAAA b'), 'a  b')
  assert.equal(san('a vbscript:msgbox b'), 'a  b')
  assert.equal(san('a file:///etc/passwd b'), 'a  b')
  assert.equal(san('a https://evil.example/a?b=1 b'), 'a  b')
  assert.equal(san('a www.evil.example b'), 'a  b')
  // 쪼개 놓은 조각이 다른 제거 뒤에 이어 붙는 경우 — 한 번 지운 뒤 다시 보고 지운다.
  for (const s of ['java<b>script:alert(1)', 'java`script:alert(1)', 'jav\u200Bascript:alert(1)', 'ht<i>tp://evil.example/x', 'ww<b>w.evil.example', 'dat<!-- x -->a:text/html,1', 'ja<br>va', 'java<b></b>script:1']) {
    const out = san(s)
    assertClean(out, s)
  }
  assert.ok(!san('java`script:alert(1)').includes('javascript:'))
})

test('살균(링크): 제목 줄 `**` 제거로 `](` 가 다시 붙어도 다음 반복에서 지운다', () => {
  const out = san('# [a]**(javascript:alert(1))**')
  assertClean(out)
  assert.ok(!out.includes('javascript'), out)
})

// ── 3. 제어/양방향 문자 ───────────────────────────────────────────────────────

test('살균(숨은 글자): 제어·양방향·영폭·BOM·깨진 글자가 모두 사라지고 줄바꿈·탭은 남는다', () => {
  const hidden = '\u0000\u0001\u0008\u000b\u000c\u001f\u007f\u0085\u009f\u200B\u200E\u200F\u202A\u202E\u2066\u2069\uFEFF\u00AD\uFFFD'
  const out = san(`가${hidden}나\n다\t라`)
  assert.equal(out, '가나\n다\t라')
  assert.deepEqual(leaks(out), [])
})

// ── 4. 정상 글 보존 ───────────────────────────────────────────────────────────

test('보존: 예문 인용 줄(`> 昨日…`, `> → 어제…`)·굵게/기울임/목록·「N5: …」 콜론 글', () => {
  const keep = [
    '> 昨日は雨でした。\n어제는 비가 왔어요.',
    '> 昨日は雨でした。\n> → 어제는 비가 왔어요.',
    '**굵게** 와 *기울임* 그리고 「N5: 食べる」는 기본 단어예요.',
    '- 항목 하나\n- 항목 둘\n\n> 窓が開いている。\n창문이 열려 있어요.',
    'N5: 기본 문형 / metadata: 설명 / profile: 소개',
    '「〜ている」는 상태를 말해요. 예: 窓が開いている。',
  ]
  for (const s of keep) assert.equal(san(s), s, s)
})

test('보존: 부등호가 들어간 일상 글(`3 < 5`·`a>b`·`x <= y`·`3<5`·`→ A > B`)은 지워지지 않는다', () => {
  const keep = ['3 < 5 이고 7 > 4 예요', 'a>b 이면 a가 커요', 'x <= y 이고 y >= z', '3<5 예요', '→ A > B 순서', '1 < 2 > 0', '"<" 기호는 작다는 뜻이에요', '화살표 <- 와 -> 는 달라요', '비교: a < b, c > d']
  for (const s of keep) assert.equal(san(s), s, s)
  assert.equal(san('a > b\n> 窓が開いている。'), 'a > b\n> 窓が開いている。')
})

test('보존: 서식 변환은 그대로 — 제목→굵게·번호 목록→"- "·표→목록·인라인 코드', () => {
  assert.equal(san('## 핵심\n\n1. 첫째\n2) 둘째\n\n`食べる`와 `abc` 비교'), '**핵심**\n\n- 첫째\n- 둘째\n\n「食べる」와 abc 비교')
  assert.equal(san('# 제목 ##'), '**제목**')
  assert.equal(san('| 표현 | 뜻 |\n|---|---|\n| 食べる | 먹다 |'), '- 표현 · 뜻\n- 食べる · 먹다')
})

// ── 5. 멱등·고정점 ────────────────────────────────────────────────────────────

const ATTACKS = [
  nestedTag(1), nestedTag(3), nestedTag(7),
  '<img src=x\nonerror=alert(1)>', '<img alt=">" onerror=alert(1)>', '<scr', '<scr\nipt>',
  nestedLink(3), '![[a](b)](c)', '[![alt](img)](link)', 'java`script:alert(1)', 'java<b>script:alert(1)',
  '# [a]**(javascript:alert(1))**', '<scr<br>ipt>alert(1)</script>', '가<br>나', '> 예문\n뜻', '3 < 5 > 4',
  '| a | b |\n|---|---|\n| <b>c</b> | [d](e) |', '```\n<script>\n```', '1. <b>x</b>\n2. [y](z)',
]

test('멱등: 살균 결과를 다시 살균해도 같다(고정점) — 공격 문자열 전체', () => {
  for (const s of ATTACKS) {
    const once = san(s)
    assert.equal(san(once), once, `멱등 아님: ${JSON.stringify(s)} → ${JSON.stringify(once)}`)
  }
})

test('성질 시험: 무작위 조각 조합 5,000개 — 위험 표지 0 · 멱등', () => {
  const FR = ['<', '>', '<b>', '</b>', 'b', 'script', 'img', 'on', 'error', '=', '"', "'", '[', ']', '(', ')', '![', '](', 'javascript:', 'java', ':', '//', 'http', 'www.', '.', ' ', ' ', '\n', '\n', '`', '``', '-', '#', '##', '|', '*', '**', '_', '__', '1.', '> ', '!', '?', '/', '\u200B', '\u0000', '한글', 'data:', 'x', '<!--', '-->', '<br>', '3', '＜', '「', '」']
  let seed = 20261012
  const rnd = (n: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % n
  }
  for (let i = 0; i < 5_000; i++) {
    const len = 1 + rnd(36)
    let s = ''
    for (let j = 0; j < len; j++) s += FR[rnd(FR.length)]
    const once = san(s)
    assertClean(once, JSON.stringify(s))
    assert.equal(san(once), once, `멱등 아님: ${JSON.stringify(s)} → ${JSON.stringify(once)}`)
  }
})

// ── 6. 반복 상한 ──────────────────────────────────────────────────────────────

test('상한: 아주 깊은 중첩(200·50,000)도 위험 표지 없이 끝난다 — 반복 상한 뒤 남은 태그 시작 후보를 지운다', () => {
  for (const n of [40, 200]) {
    const out = san(nestedTag(n))
    assert.ok(!TAG_START.test(out), `깊이 ${n}: ${out.slice(0, 80)}`)
    assert.equal(san(out), out, '상한 경로 결과도 멱등')
  }
  assertClean(san(nestedLink(60)))
  // 한 패스 안의 링크 벗기기(32겹)×패스 상한(16) = 512겹을 넘는 중첩 — 상한 경로가 `](` 열을 끊는다.
  const deepLink = san(nestedLink(600))
  assertClean(deepLink)
  assert.equal(san(deepLink), deepLink)
  // 상한 경로는 정상 글을 통째로 버리지 않는다: 깊은 중첩 뒤의 `[1]`·`(괄호)`·`` `코드` `` 가 살아 있다(마지막 방어선인 문자 일괄 삭제가 아니라 `hardStrip` 으로 끝났다는 뜻).
  const keepAfterCap = san(`${nestedTag(200)} 참고 [1] 항목 (괄호) \`abc\``)
  assert.ok(keepAfterCap.includes('[1]') && keepAfterCap.includes('(괄호)') && keepAfterCap.includes('abc'), keepAfterCap)
  assert.ok(!TAG_START.test(keepAfterCap))
  const { v, ms } = timed(() => san(nestedTag(50_000)))
  assert.ok(!TAG_START.test(v), '깊이 50,000')
  assert.ok(ms < 3_000, `깊이 50,000 중첩 ${ms.toFixed(0)}ms`)
})

test('상한 시험 이음매(maxPasses): 상한을 1로 줘도(상한 경로를 강제) 위험 표지가 남지 않는다', () => {
  for (const s of [...ATTACKS, nestedTag(2), nestedTag(5), nestedLink(4), 'java`script:alert(1)', '# [a]**(javascript:alert(1))**']) {
    const out = sanitizeAskAnswerMd(s, { maxPasses: 1 }).text
    assertClean(out, `maxPasses=1 ${JSON.stringify(s)}`)
  }
  // 정상 글은 상한 1에서도 같은 결과(변환이 한 번에 끝나는 글).
  assert.equal(sanitizeAskAnswerMd('> 窓が開いている。\n창문이 열려 있어요.', { maxPasses: 1 }).text, '> 窓が開いている。\n창문이 열려 있어요.')
})

// ── 7. 긴 입력(20만 자) — 선형 ────────────────────────────────────────────────

const N = 200_000
const BIG: { name: string; input: string; expect?: string }[] = [
  { name: 'a×N', input: 'a'.repeat(N), expect: 'a'.repeat(N) },
  { name: '공백×N + x', input: ' '.repeat(N) + 'x', expect: 'x' },
  { name: 'a + 공백×N + b', input: 'a' + ' '.repeat(N) + 'b' },
  { name: '탭 섞은 공백×N', input: 'a' + ' \t'.repeat(N / 2) + 'b' },
  { name: '<×N', input: '<'.repeat(N), expect: '<'.repeat(N) },
  { name: '<a×N/2', input: '<a'.repeat(N / 2), expect: 'a'.repeat(N / 2) },
  { name: '<a ×N/3 (닫힘 없음)', input: '<a '.repeat(N / 3) },
  { name: '<a ×N/3 + > (끝에 >)', input: '<a '.repeat(N / 3) + '>' },
  { name: '<a ×N/3 + 줄 머리 >', input: '<a '.repeat(N / 3) + '\n> x' },
  { name: '<a >×N/4 (태그 다수)', input: '<a >'.repeat(N / 4), expect: '' },
  { name: '<b>×N/3', input: '<b>'.repeat(N / 3), expect: '' },
  { name: '<!--×N/4 (주석 닫힘 없음)', input: '<!--'.repeat(N / 4), expect: '!--'.repeat(N / 4) },
  { name: '<!-- x -->×N/10', input: '<!-- x -->'.repeat(N / 10), expect: '' },
  { name: '<a x=">×N/6 (따옴표 짝 어긋남)', input: '<a x=">'.repeat(N / 6) },
  { name: '<a x=\'"×N/6', input: "<a x='\"".repeat(N / 6) },
  { name: '<×N + b>', input: '<'.repeat(N) + 'b>', expect: '<'.repeat(N - 1) },
  { name: '<×N/2 + b>×N/4 + script>', input: '<'.repeat(N / 2) + 'b>'.repeat(N / 4) + 'script>' },
  { name: '[×N', input: '['.repeat(N), expect: '['.repeat(N) },
  { name: '![×N/2', input: '!['.repeat(N / 2), expect: '!['.repeat(N / 2) },
  { name: ']( ×N/2', input: ']('.repeat(N / 2), expect: ']('.repeat(N / 2) },
  { name: '[a](×N/4 (닫는 괄호 없음)', input: '[a]('.repeat(N / 4), expect: '[a]('.repeat(N / 4) },
  { name: '[a](b)×N/6', input: '[a](b)'.repeat(N / 6), expect: 'a'.repeat(N / 6) },
  { name: '![a](b)×N/7', input: '![a](b)'.repeat(N / 7), expect: '' },
  { name: '[×N + ](x) (레이블 시작 다수)', input: '['.repeat(N) + '](x)', expect: '['.repeat(N - 1) },
  { name: '[a](((×N/6)', input: '[a](((('.repeat(N / 7) },
  { name: '`×N', input: '`'.repeat(N), expect: '' },
  { name: '`a×N/2', input: '`a'.repeat(N / 2) },
  { name: '__×N/2', input: '__'.repeat(N / 2) },
  { name: '__a_×N/4', input: '__a_'.repeat(N / 4) },
  { name: '\\n×N', input: '\n'.repeat(N), expect: '' },
  { name: 'a\\n×N/2', input: 'a\n'.repeat(N / 2) },
  { name: 'http://×N/7', input: 'http://'.repeat(N / 7) },
  { name: 'a×N + ://x', input: 'a'.repeat(N) + '://x', expect: '' },
  { name: '1×N + ://x (글자 없는 스킴)', input: '1'.repeat(N) + '://x' },
  { name: 'a://×N/4', input: 'a://'.repeat(N / 4) },
  { name: 'javascript:×N/11', input: 'javascript:'.repeat(N / 11), expect: '' },
  { name: 'data: data:×N/6', input: 'data: '.repeat(N / 6) },
  { name: 'www.×N/4', input: 'www.'.repeat(N / 4) },
  { name: '| ×N/2', input: '| '.repeat(N / 2) },
  { name: '|-×N/2', input: '|-'.repeat(N / 2) },
  { name: '| a ×N/4 + x', input: '| a '.repeat(N / 4) + 'x' },
  { name: '> ×N/2', input: '> '.repeat(N / 2), expect: '>' },
  { name: '- ×N/2', input: '- '.repeat(N / 2) },
  { name: '- - -×N 끝에 x', input: '- '.repeat(N / 2) + 'x' },
  { name: '#  + 공백×N + x', input: '# ' + ' '.repeat(N) + 'x', expect: '**x**' },
  { name: '# a + 공백×N + b', input: '# a' + ' '.repeat(N) + 'b' },
  { name: '#×N', input: '#'.repeat(N), expect: '#'.repeat(N) },
  { name: '# ×N/2', input: '# '.repeat(N / 2) },
  { name: '# a ##...# ×N', input: '# a ' + '#'.repeat(N) },
  { name: '1. ×N/3', input: '1. '.repeat(N / 3) },
  { name: '공백×N + 1. x', input: ' '.repeat(N) + '1. x', expect: '- x' },
  { name: '```×N/3', input: '```'.repeat(N / 3), expect: '' },
  { name: '---×N/3', input: '---'.repeat(N / 3) },
  { name: '- - -...(구분선)', input: '- '.repeat(N / 2).trim(), expect: '' },
  { name: '제어 문자×N', input: '\u0000\u200B'.repeat(N / 2), expect: '' },
  { name: '한글 본문 N', input: '가나다라마 '.repeat(N / 6) },
]

test('긴 입력(20만 자): 이차 폭주 없이 끝나고(각 2초 이내) 위험 표지가 없으며 멱등이다', () => {
  for (const c of BIG) {
    assert.ok(c.input.length >= N * 0.9, `${c.name}: 입력 길이 ${c.input.length}`)
    const { v, ms } = timed(() => san(c.input))
    assert.ok(ms < 2_000, `${c.name}: ${ms.toFixed(0)}ms (2초 초과 — 선형이 아님)`)
    if (c.expect !== undefined) assert.equal(v, c.expect, c.name)
    assert.deepEqual(leaks(v), [], `${c.name}: 위험 표지 잔존`)
    const again = timed(() => san(v))
    assert.ok(again.ms < 2_000, `${c.name}: 두 번째 살균 ${again.ms.toFixed(0)}ms`)
    assert.equal(again.v === v, true, `${c.name}: 멱등 아님`)
  }
})

test('긴 입력: 정상적으로 긴 본문(4,000자 상한 부근, 서식·예문 혼합)도 한 번에 끝난다', () => {
  const body = ['## 정리', '', '- 항목 **하나**', '', '> 窓が開いている。', '창문이 열려 있어요.', '', '3 < 5 이고 a>b 예요. 「N5: 食べる」'].join('\n')
  const input = Array.from({ length: 40 }, () => body).join('\n\n')
  const { v, ms } = timed(() => san(input))
  assert.ok(ms < 200, `${ms.toFixed(0)}ms`)
  assert.ok(v.includes('> 窓が開いている。\n창문이 열려 있어요.') && v.includes('3 < 5 이고 a>b 예요.') && v.includes('**정리**'))
  assert.equal(san(v), v)
})

test('집계(fixes): 중첩 태그·줄바꿈 태그·불완전 태그도 html 로 센다', () => {
  assert.ok(sanitizeAskAnswerMd(nestedTag(3)).fixes.html >= 3)
  assert.ok(sanitizeAskAnswerMd('<img\nonerror=1>').fixes.html === 1)
  assert.ok(sanitizeAskAnswerMd('끝 <scr').fixes.html === 1)
  assert.ok(Object.values(sanitizeAskAnswerMd('3 < 5 이고 a>b').fixes).every((n) => n === 0), '정상 글은 0')
})
