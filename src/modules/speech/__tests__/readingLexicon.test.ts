import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Environment, LexiconScope } from '@prisma/client'
import { hangulLine, toRubyMarkup, type ReadingSegment } from '../reading/client'
import { annotateReadings, resetReadingCache } from '../reading'
import { applyLexiconOverlay, selectDisplayEntries } from '../reading/lexiconOverlay'
import { clearLexiconCache, loadLexiconForDisplay, type ActiveLexicon, type LexiconEntryData } from '../tts/lexicon'

// task-032 — 관리자 발음 사전을 화면 읽기 줄에 덮어쓰기. 조각은 실분석기 출력 고정본(fixtures/readingLexiconSegments.json).
const FX = (JSON.parse(readFileSync(join(__dirname, 'fixtures', 'readingLexiconSegments.json'), 'utf8')) as { segments: Record<string, ReadingSegment[]> }).segments
const SEED = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'prisma', 'seed-data', 'lexicon.json'), 'utf8')) as {
  entries: Array<{ surface: string; reading: string; accentType: number; priority: number; wordType: string | null }>
}).entries.map((e): LexiconEntryData => ({ ...e, scope: 'GLOBAL', scopeRefId: null, enabled: true }))

function entry(surface: string, reading: string, more: Partial<LexiconEntryData> = {}): LexiconEntryData {
  return { surface, reading, accentType: 0, priority: 10, scope: 'GLOBAL', scopeRefId: null, wordType: null, enabled: true, ...more }
}

const FIX3 = [entry('青か', 'アオカ'), entry('愚か', 'オロカ'), entry('密か', 'ヒソカ')]

function seg(text: string): ReadingSegment[] {
  const s = FX[text]
  assert.ok(s, `fixture 없음: ${text}`)
  return structuredClone(s)
}

function apply(text: string, entries: readonly LexiconEntryData[], userId: string | null = null): ReadingSegment[] {
  return applyLexiconOverlay(text, seg(text), selectDisplayEntries(entries, userId))
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k])
    Object.freeze(v)
  }
  return v
}

test('교체 — 青か·愚か·密か 오분절을 항목 읽기로(루비·발음·한글 줄)', () => {
  assert.equal(toRubyMarkup(seg('赤か青か')), '赤{あか}か青{せい}か', '전제: 분석기 원본은 セーカ')
  const a = apply('赤か青か', FIX3)
  assert.equal(toRubyMarkup(a), '赤{あか}か青{あお}か')
  assert.deepEqual(a[2], { surface: '青か', ruby: [['青', 'あお'], ['か', null]], pron: 'アオカ', boundary: 'phrase' })
  assert.equal(hangulLine(a), '아까까 아오까')

  assert.equal(toRubyMarkup(apply('この赤か青か決めて', FIX3)), 'この赤{あか}か青{あお}か決{き}めて')
  const g = apply('愚か。', FIX3)
  assert.equal(toRubyMarkup(g), '愚{おろ}か。')
  assert.equal(g.length, 2)
  assert.equal(g[0].pron, 'オロカ')
  assert.equal(toRubyMarkup(apply('愚か', FIX3)), '愚{おろ}か')
  const h = apply('それは密か', FIX3)
  assert.equal(toRubyMarkup(h), 'それは密{ひそ}か')
  assert.equal(h[h.length - 1].boundary, 'particle', '합친 조각 경계 = 첫 조각 경계')
  assert.equal(hangulLine(h), '소레와 히소까')
  assert.equal(toRubyMarkup(apply('密か。', FIX3)), '密{ひそ}か。')
  assert.equal(toRubyMarkup(apply('赤か青か、どっち？', FIX3)), '赤{あか}か青{あお}か、どっち？')
})

test('같음 — 경계가 맞고 소리가 같으면 분석기 조각 그대로(같은 참조, 분석기 루비 유지)', () => {
  const all = [...SEED, ...FIX3]
  for (const t of ['神保町', '神保町へ行く', '御徒町で降りる', '明日は雨', '日本橋へ行く', '秋葉原', '彼は愚かだ', '愚かな人', '密かに練習する', '青かな', '上手な人']) {
    const input = seg(t)
    const out = applyLexiconOverlay(t, input, selectDisplayEntries([...all, entry('上手', 'ジョウズ')], null))
    assert.equal(out, input, t)
  }
  // 神保町: 항목 ジンボーチョー = 발음, 루비는 분석기의 じんぼうちょう 유지 · 上手な: 항목 ジョウズ = 루비 읽기(발음은 ジョーズ)
  assert.equal(toRubyMarkup(apply('神保町', SEED)), '神保町{じんぼうちょう}')
  assert.equal(toRubyMarkup(apply('御徒町で降りる', SEED)), '御徒{おかち}町{まち}で降{お}りる')
})

test('유지 — 복합어(明日香 ≠ 明日)와 가나 활용형 일치(青から·青かった)', () => {
  for (const t of ['明日香さん', '青から始める', '青かった', '青い空']) {
    const input = seg(t)
    assert.equal(applyLexiconOverlay(t, input, selectDisplayEntries([...SEED, ...FIX3], null)), input, t)
  }
  assert.equal(toRubyMarkup(apply('明日香さん', SEED)), '明日香{あすか}さん')
})

test('숨김 — 항목이 더 긴 가나 활용형의 일부이고 읽기가 충돌(上手=ジョウズ vs 上手い=ウマイ)', () => {
  const out = apply('上手い', [entry('上手', 'ジョウズ')])
  assert.deepEqual(out, [{ surface: '上手い', ruby: null, pron: null, boundary: null }])
  assert.equal(hangulLine(out), null, '한글 줄은 문장 전체 숨김')
  assert.equal(toRubyMarkup(out), '上手い', '후리가나 없이 원문')
})

test('교체 뒤 조사 경계 보정 — 합친 구간이 조사 は 로 끝나면 뒤 조각은 구절 경계', () => {
  const t = '今日は良い天気'
  assert.equal(seg(t)[2].boundary, 'particle', '전제')
  const out = apply(t, [entry('今日は', 'コンニチワ')])
  // 루비는 は≠ワ 라 정렬 실패 → null(발음은 항목 읽기)
  assert.deepEqual(out[0], { surface: '今日は', ruby: null, pron: 'コンニチワ', boundary: null })
  assert.equal(out[1].surface, '良い')
  assert.equal(out[1].boundary, 'phrase')
  assert.equal(hangulLine(out), '콘니찌와 요이 텡끼')
})

test('교체 — 루비 정렬 실패면 루비 null·발음은 항목 읽기 / 한자 없는 표기도 교체', () => {
  const out = apply('赤か青か', [entry('青か', 'ブルー')])
  assert.deepEqual(out[2], { surface: '青か', ruby: null, pron: 'ブルー', boundary: 'phrase' })
  // か青 은 조각 경계와 안 맞음(か | 青か) — 가나만 삐져나옴: 소리가 이어지면 유지, 충돌하면 겹친 조각 숨김
  const keep = seg('赤か青か')
  assert.equal(applyLexiconOverlay('赤か青か', keep, selectDisplayEntries([entry('か青', 'カセー')], null)), keep)
  const k = apply('赤か青か', [entry('か青', 'カアオ')])
  assert.deepEqual(k.map((s) => s.pron), ['アカ', null, null])
})

test('불변식 — 원문과 조각이 어긋나면 원본, 입력(캐시 객체)은 바꾸지 않는다', () => {
  const input = seg('赤か青か')
  assert.equal(applyLexiconOverlay('赤か青かX', input, selectDisplayEntries(FIX3, null)), input)
  for (const [t, es] of [
    ['赤か青か', FIX3],
    ['上手い', [entry('上手', 'ジョウズ')]],
    ['今日は良い天気', [entry('今日は', 'コンニチワ')]],
  ] as const) {
    const frozen = deepFreeze(seg(t))
    const before = structuredClone(frozen)
    const out = applyLexiconOverlay(t, frozen, selectDisplayEntries(es, null))
    assert.notEqual(out, frozen)
    assert.deepEqual(frozen, before, t)
    assert.equal(out.map((s) => s.surface).join(''), t)
  }
  assert.equal(applyLexiconOverlay('赤か青か', input, new Map()), input, '빈 사전 = 입력 그대로')
})

test('범위 — GLOBAL + 본인 USER 만, 다른 사용자 USER·VOICE·LESSON·COURSE·꺼진 항목은 미적용, USER 가 GLOBAL 을 이긴다', () => {
  const scoped = (scope: LexiconScope, ref: string | null, more: Partial<LexiconEntryData> = {}) => entry('青か', 'アオカ', { scope, scopeRefId: ref, ...more })
  const orig = toRubyMarkup(seg('赤か青か'))
  assert.equal(toRubyMarkup(apply('赤か青か', [scoped('USER', 'u2')], 'u1')), orig)
  assert.equal(toRubyMarkup(apply('赤か青か', [scoped('USER', 'u2')], null)), orig)
  assert.equal(toRubyMarkup(apply('赤か青か', [scoped('USER', 'u1')], 'u1')), '赤{あか}か青{あお}か')
  for (const sc of ['VOICE', 'LESSON', 'COURSE'] as const) assert.equal(toRubyMarkup(apply('赤か青か', [scoped(sc, 'u1')], 'u1')), orig, sc)
  assert.equal(toRubyMarkup(apply('赤か青か', [scoped('GLOBAL', null, { enabled: false })], 'u1')), orig)
  const both = [entry('青か', 'ブルー'), scoped('USER', 'u1')]
  assert.equal(apply('赤か青か', both, 'u1')[2].pron, 'アオカ')
  assert.equal(apply('赤か青か', both, 'u2')[2].pron, 'ブルー')
})

function fakeAnalyzer() {
  let calls = 0
  return {
    annotate: async (texts: readonly string[]) => {
      calls += texts.length
      return texts.map((t) => (FX[t] ? structuredClone(FX[t]) : null))
    },
    get calls() {
      return calls
    },
  }
}

test('annotateReadings — 사전 버전이 바뀌면 다음 요청에 바로 반영(분석기 1회, 캐시 원본 불변)·끄기/롤백 원복', async () => {
  resetReadingCache()
  const a = fakeAnalyzer()
  let lex: LexiconEntryData[] | null = []
  const deps = { annotate: a.annotate, loadLexicon: async () => lex }
  const run = async () => toRubyMarkup((await annotateReadings(['赤か青か'], deps, 'u1', { userId: 'u1' })).items[0]!)
  assert.equal(await run(), '赤{あか}か青{せい}か', 'v1 빈 사전 = 기존 출력')
  lex = [entry('青か', 'アオカ')]
  assert.equal(await run(), '赤{あか}か青{あお}か', 'v2 항목 추가')
  lex = [entry('青か', 'アオカ', { enabled: false })]
  assert.equal(await run(), '赤{あか}か青{せい}か', 'v3 끄기 → 원복')
  lex = [entry('青か', 'アオカ')]
  assert.equal(await run(), '赤{あか}か青{あお}か', 'v4 롤백(새 ACTIVE)')
  lex = null
  assert.equal(await run(), '赤{あか}か青{せい}か', '사전 없음(조회 실패·최초) → 원본')
  assert.equal(a.calls, 1, '분석기는 한 번 — 캐시 키는 사전과 무관')
  resetReadingCache()
})

test('annotateReadings — 다른 사용자 USER 항목은 미적용, userId 없으면 GLOBAL 만 / 빈 사전이면 결과 객체 그대로', async () => {
  resetReadingCache()
  const a = fakeAnalyzer()
  const lex = [entry('青か', 'アオカ', { scope: 'USER', scopeRefId: 'u2' }), entry('愚か', 'オロカ')]
  const deps = { annotate: a.annotate, loadLexicon: async () => lex }
  const r1 = await annotateReadings(['赤か青か', '愚か。'], deps, 'u1', { userId: 'u1' })
  assert.deepEqual(r1.items.map((s) => toRubyMarkup(s!)), ['赤{あか}か青{せい}か', '愚{おろ}か。'])
  const r2 = await annotateReadings(['赤か青か'], deps, 'u2', { userId: 'u2' })
  assert.equal(toRubyMarkup(r2.items[0]!), '赤{あか}か青{あお}か')
  const r3 = await annotateReadings(['赤か青か', '愚か。'], deps)
  assert.deepEqual(r3.items.map((s) => toRubyMarkup(s!)), ['赤{あか}か青{せい}か', '愚{おろ}か。'])
  const empty = await annotateReadings(['赤か青か'], { annotate: a.annotate, loadLexicon: async () => [] })
  const again = await annotateReadings(['赤か青か'], { annotate: a.annotate, loadLexicon: async () => [] })
  assert.equal(empty.items[0], again.items[0], '빈 사전 = 캐시 원본 그대로')
  resetReadingCache()
})

test('annotateReadings — 사전 로더 예외·분석기 degrade 에도 available·칸 의미 불변, 사전 조회는 분석기와 병렬', async () => {
  resetReadingCache()
  const a = fakeAnalyzer()
  const thrown = await annotateReadings(['赤か青か'], {
    annotate: a.annotate,
    loadLexicon: async () => {
      throw new Error('db')
    },
  })
  assert.equal(thrown.available, true)
  assert.equal(toRubyMarkup(thrown.items[0]!), '赤{あか}か青{せい}か')
  resetReadingCache()
  const down = await annotateReadings(['赤か青か'], {
    annotate: async () => {
      throw new Error('ECONNREFUSED')
    },
    loadLexicon: async () => FIX3,
  })
  assert.deepEqual(down, { items: [null], available: false })
  resetReadingCache()
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const t0 = Date.now()
  const slow = await annotateReadings(['赤か青か'], {
    annotate: async (t) => {
      await sleep(120)
      return a.annotate(t)
    },
    loadLexicon: async () => {
      await sleep(120)
      return FIX3
    },
  })
  const ms = Date.now() - t0
  assert.equal(toRubyMarkup(slow.items[0]!), '赤{あか}か青{あお}か')
  assert.ok(ms < 220, `병렬이어야 한다(${ms}ms)`)
  resetReadingCache()
})

test('loadLexiconForDisplay — 30초 캐시, 만료 뒤 조회 실패·지연이면 직전 성공 사전, 최초 실패면 null, 환경별 분리', async () => {
  clearLexiconCache()
  const dev = 'DEVELOPMENT' as Environment
  const prod = 'PRODUCTION' as Environment
  const v = (n: number): ActiveLexicon => ({ dictionaryVersion: n, entries: [entry('青か', 'アオカ')] })
  let now = 1_000_000
  let calls = 0
  const fail = async () => {
    calls++
    throw new Error('db down')
  }
  const okWith = (n: number) => async () => {
    calls++
    return v(n)
  }
  const opt = (fetch: (e: Environment) => Promise<ActiveLexicon>, timeoutMs = 50) => ({ fetch, now: () => now, timeoutMs })

  assert.equal(await loadLexiconForDisplay(dev, opt(fail)), null, '최초 실패 → null(덮어쓰기 생략)')
  assert.equal((await loadLexiconForDisplay(dev, opt(okWith(1))))?.dictionaryVersion, 1)
  now += 10_000
  assert.equal((await loadLexiconForDisplay(dev, opt(fail)))?.dictionaryVersion, 1, '30초 안은 캐시')
  assert.equal(calls, 2)
  now += 25_000
  assert.equal((await loadLexiconForDisplay(dev, opt(fail)))?.dictionaryVersion, 1, '만료 뒤 실패 → 직전 사전')
  assert.equal(calls, 3)

  let release: (x: ActiveLexicon) => void = () => undefined
  const hang = async () => {
    calls++
    return new Promise<ActiveLexicon>((r) => {
      release = r
    })
  }
  assert.equal((await loadLexiconForDisplay(dev, opt(hang, 20)))?.dictionaryVersion, 1, '지연 → 직전 사전')
  assert.equal((await loadLexiconForDisplay(dev, opt(hang, 20)))?.dictionaryVersion, 1, '진행 중 조회를 다시 시작하지 않는다')
  assert.equal(calls, 4)
  release(v(2))
  await new Promise((r) => setImmediate(r))
  assert.equal((await loadLexiconForDisplay(dev, opt(fail)))?.dictionaryVersion, 2, '늦은 조회가 끝나면 캐시 갱신')
  assert.equal(calls, 4)

  assert.equal(await loadLexiconForDisplay(prod, opt(fail)), null, 'PRODUCTION 은 DEVELOPMENT 사전을 쓰지 않는다')
  clearLexiconCache()
})
