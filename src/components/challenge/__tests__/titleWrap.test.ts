import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-045 ui-e3-fix(qa-045-ui-e3 결함 #1). 사용자가 정한 주제·챌린지 제목은 40자 공백 없이도 들어올 수 있다.
// `break-keep`(word-break: keep-all)만 있으면 한글이 낱말 중간에서 못 꺾여 박스·뷰포트 밖으로 나가므로
// 넘칠 때만 꺾는 `[overflow-wrap:anywhere]` 를 함께 쓴다(토픽 화면 `uiAFix.test.ts` 결함 #4 와 같은 방식). 실제 줄바꿈은 QA 실측.
const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (f: string) => strip(readFileSync(join(dir, f), 'utf8'))
const ANYWHERE = /\[overflow-wrap:anywhere\]/

/** `needle` 이 들어 있는 곳을 감싸는 가장 가까운 여는 태그(`<p …>` 등) 전체. */
function openingTagBefore(src: string, needle: string): string {
  const at = src.indexOf(needle)
  assert.ok(at >= 0, `${needle} 을(를) 찾지 못함`)
  const start = src.lastIndexOf('<', at)
  const end = src.indexOf('>', start)
  return src.slice(start, end + 1)
}

test('결과 화면 「지금은 「제목」(n일째)를 하고 있어요」 문단은 [overflow-wrap:anywhere] 를 갖는다(결함 #1 — 다른 챌린지 진행 중 + 무공백 40자)', () => {
  const tag = openingTagBefore(read('ChallengeScreen.tsx'), '{blockedNoteText(retry, next.topicGone)}')
  assert.match(tag, /^<p\b/, tag)
  assert.match(tag, ANYWHERE, tag)
})

test('결과·진행 화면에서 주제 제목이 들어가는 다른 문장(소제목·「오늘의 단어 n세트」 줄)도 같은 안전장치를 갖고 break-keep 은 유지한다', () => {
  const src = read('ChallengeScreen.tsx')
  const wordsLine = openingTagBefore(src, '「{d.topic.title}」 오늘의 단어')
  assert.match(wordsLine, /break-keep/, '한글은 낱말 단위 줄바꿈 규칙을 유지')
  assert.match(wordsLine, ANYWHERE, wordsLine)
  // 소제목(`「{d.topic.title}」 표현`)은 H2 컴포넌트를 거치므로 H2 자체에 있어야 한다.
  const h2 = openingTagBefore(src.slice(src.indexOf('function H2(')), '<h2')
  assert.match(h2, /break-keep/)
  assert.match(h2, ANYWHERE, h2)
  assert.match(src, /<H2>\s*「\{d\.topic\.title\}」 표현\s*<\/H2>/, '소제목은 H2 를 쓴다')
})

test('InfoBox·ErrorBox(제목·본문 문장이 들어가는 공용 상자)의 break-keep 줄은 모두 [overflow-wrap:anywhere] 와 함께 쓴다', () => {
  const src = read('parts.tsx')
  for (const name of ['InfoBox', 'ErrorBox']) {
    const from = src.indexOf(`export function ${name}(`)
    assert.ok(from >= 0, name)
    const next = src.indexOf('\nexport function ', from + 1)
    const body = src.slice(from, next < 0 ? undefined : next)
    const lines = body.split('\n').filter((l) => /break-keep/.test(l))
    assert.ok(lines.length >= 1, `${name}: break-keep 줄을 못 찾음`)
    for (const l of lines) assert.match(l, ANYWHERE, `${name}: ${l.trim().slice(0, 90)}`)
  }
})

test('만들기 화면: 체크 카드 본문(주제 제목이 들어감)·주제 카드 설명도 같은 안전장치', () => {
  const src = read('createParts.tsx')
  for (const needle of ['{body}</span>', '{topic.description}</span>']) {
    const lines = src.split('\n').filter((l) => l.includes(needle))
    assert.equal(lines.length, 1, needle)
    assert.match(lines[0], /break-keep/, lines[0].trim().slice(0, 90))
    assert.match(lines[0], ANYWHERE, lines[0].trim().slice(0, 90))
  }
})

test('일본어 이름(lang="ja")에는 break-keep 을 쓰지 않는다 — 일본어는 낱말 단위 줄바꿈이 없어 keep-all 이 글자 사이를 막는다', () => {
  let found = 0
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
    for (const l of read(f).split('\n').filter((x) => /lang="ja"/.test(x))) {
      found++
      assert.ok(!/break-keep/.test(l), `${f}: ${l.trim().slice(0, 90)}`)
    }
  }
  assert.ok(found >= 2, `일본어 줄을 못 찾음(${found})`)
})
