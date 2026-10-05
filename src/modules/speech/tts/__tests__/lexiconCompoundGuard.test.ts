import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Environment } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { ttsCacheKey, type CacheKeyParts } from '../cache'
import {
  clearLexiconCache,
  findLexiconMatches,
  guardCompoundMatches,
  lexiconDigest,
  loadActiveLexicon,
  loadLexiconForDisplay,
  rescanHintSurfaces,
  selectEntries,
  type ActiveLexicon,
  type LexiconEntryData,
  type LexiconHint,
} from '../lexicon'
import { prepareSegments } from '../renderingPlan'

const E = (surface: string, reading: string): LexiconEntryData => ({ surface, reading, accentType: 0, priority: 10, scope: 'GLOBAL', scopeRefId: null, wordType: null, enabled: true })
const lexicon = (...entries: LexiconEntryData[]) => selectEntries(entries, {})
const SEED_ASHITA = lexicon(E('明日', 'アシタ'))

/**
 * 어댑터 강등 치환(표기 재검색)과 같은 결과 — `rescanHintSurfaces` 자리에 읽기를 넣는다(같은 표기는 어댑터처럼 마지막 hint 의 읽기).
 * 엔진 어댑터 파일은 L4 테스트에서 import 하지 않으므로, 어댑터 테스트(engine/__tests__/ttsAdapter)와 같은 계약표
 * `fixtures/hintRescanCases.json` 을 둘 다 읽어 맞춘다.
 */
function substituted(text: string, hints: readonly Pick<LexiconHint, 'surface' | 'reading'>[]): string {
  const reading = new Map(hints.map((h) => [h.surface, h.reading]))
  let out = ''
  let pos = 0
  for (const r of rescanHintSurfaces(text, hints.map((h) => h.surface))) {
    out += text.slice(pos, r.start) + (reading.get(r.surface) ?? r.surface)
    pos = r.start + r.surface.length
  }
  return out + text.slice(pos)
}

interface HintRescanCase {
  id: string
  text: string
  hints: { surface: string; reading: string }[]
  expected: string
}
const HINT_RESCAN_CASES = (JSON.parse(readFileSync(join(__dirname, 'fixtures', 'hintRescanCases.json'), 'utf8')) as { cases: HintRescanCase[] }).cases

/** prepareSegments(합성·사전 미리듣기 공용 경로) 한 문장 → [hint 표기들, 어댑터가 엔진에 보낼 문장]. */
function tts(text: string, lex: ReadonlyMap<string, LexiconEntryData>) {
  const [seg] = prepareSegments(text, { lexicon: lex, maxChars: 100, single: true })
  return { surfaces: seg.hints.map((h) => h.surface), sent: substituted(seg.normalizedText, seg.hints), seg }
}

test('복합어 가드: 시드 明日=アシタ 가 明日香(あすか) 안에서는 적용되지 않고, 단독·조사 앞에서는 적용된다', () => {
  assert.deepEqual(tts('明日香さん', SEED_ASHITA).surfaces, [])
  assert.equal(tts('明日香さん', SEED_ASHITA).sent, '明日香さん')
  assert.deepEqual(tts('明日香', SEED_ASHITA).surfaces, [])
  assert.deepEqual(tts('明日は晴れです', SEED_ASHITA).surfaces, ['明日'])
  assert.equal(tts('明日は晴れです', SEED_ASHITA).sent, 'アシタは晴れです')
  assert.deepEqual(tts('明日', SEED_ASHITA).surfaces, ['明日'])
  // 이웃이 한자면 버린다 — 엔진 기본 읽기(안전 방향)
  assert.deepEqual(tts('明日学校へ行く', SEED_ASHITA).surfaces, [])
  assert.deepEqual(tts('新日本橋', lexicon(E('日本橋', 'ニホンバシ'))).surfaces, [])
})

test('복합어 가드: 이웃 한자가 다른 사전 일치에 속하면 경계로 본다(순서 무관)', () => {
  const lex = lexicon(E('今日', 'キョー'), E('明日', 'アシタ'))
  assert.deepEqual(tts('今日明日', lex).surfaces, ['今日', '明日'])
  assert.equal(tts('今日明日', lex).sent, 'キョーアシタ')
  // 明日 은 香 쪽이 다른 일치가 아니라 버리고, 今日 은 明 이 후보 明日 에 속해 경계 — 버린 후보도 경계 판정에는 쓴다
  assert.deepEqual(tts('今日明日香さんが来る', lex).surfaces, ['今日'])
  assert.equal(tts('今日明日香さんが来る', lex).sent, 'キョー明日香さんが来る')
  const text = '今日明日香'
  const cands = findLexiconMatches(text, lex)
  assert.deepEqual(guardCompoundMatches(text, [...cands].reverse()).map((m) => m.surface).sort(), guardCompoundMatches(text, cands).map((m) => m.surface).sort())
})

test('복합어 가드: 가나·영숫자가 섞인 표기는 대상이 아니다(한자 이웃이어도 적용)', () => {
  const lex = lexicon(E('青か', 'アオカ'), E('愚か', 'オロカ'), E('JR1番線', 'ジェイアールイチバンセン'), E('カフェ', 'カフェ'))
  assert.deepEqual(tts('赤か青か決めて', lex).surfaces, ['青か'])
  assert.deepEqual(tts('紺青か', lex).surfaces, ['青か'])
  assert.deepEqual(tts('愚か者', lex).surfaces, ['愚か'])
  assert.deepEqual(tts('JR1番線駅', lex).surfaces, ['JR1番線'])
  assert.deepEqual(tts('駅カフェ店', lex).surfaces, ['カフェ'])
})

test('복합어 가드: 々·〆·ヶ·서로게이트 쌍 한자도 한자 이웃으로 본다', () => {
  assert.deepEqual(tts('人々', lexicon(E('人', 'ヒト'))).surfaces, [])
  assert.deepEqual(tts('霞ヶ関', lexicon(E('霞', 'カスミ'))).surfaces, [])
  assert.deepEqual(tts('𠮷明日', SEED_ASHITA).surfaces, [])
  assert.deepEqual(tts('明日𠮷', SEED_ASHITA).surfaces, [])
  assert.deepEqual(tts('〆明日', SEED_ASHITA).surfaces, [])
})

test('화면 읽기 경로의 findLexiconMatches 는 그대로(가드는 TTS prepareSegments 에서만)', () => {
  assert.deepEqual(
    findLexiconMatches('明日香さん', SEED_ASHITA).map((m) => [m.surface, m.start]),
    [['明日', 0]],
  )
})

test('어댑터 재검색 일관성: 같은 표기가 복합어 안과 단독으로 함께 있으면 그 표기 hint 를 통째로 뺀다', () => {
  const r = tts('明日香さんは明日来ます', SEED_ASHITA)
  assert.deepEqual(r.surfaces, [])
  assert.equal(r.sent.includes('アシタ'), false)
  // 버린 긴 후보(東京都 — 庁 와 붙음) 안의 짧은 표기(京都)를 어댑터가 다시 잡지 않게
  const lex = lexicon(E('東京都', 'トーキョート'), E('京都', 'キョート'))
  const t = tts('東京都庁と京都', lex)
  assert.deepEqual(t.surfaces, [])
  assert.equal(t.sent, '東京都庁と京都')
  // 버린 것이 없으면 기존과 같다
  assert.equal(tts('東京都と京都', lex).sent, 'トーキョートとキョート')
})

test('어댑터 재검색 일관성: 정규화가 숫자를 한자로 바꿔도(明日3時 → 明日三時) 원문 판정을 지킨다', () => {
  const r = tts('明日3時に会おう', SEED_ASHITA)
  assert.equal(r.seg.normalizedText, '明日三時に会おう')
  assert.deepEqual(r.surfaces, ['明日'])
  assert.equal(r.sent, 'アシタ三時に会おう')
  const lead = tts(' 明日、10時', SEED_ASHITA)
  assert.deepEqual(lead.surfaces, ['明日'])
  assert.equal(lead.sent, 'アシタ、十時')
})

test('앞 공백·지워지는 기호로 시작하는 문장: prepareSegments 결과 고정(task-035 L-2)', () => {
  const lex = lexicon(E('明日', 'アシタ'), E('京都', 'キョート'), E('東京都', 'トーキョート'))
  const hint = (surface: string, reading: string) => ({ surface, reading, accentType: 0, wordType: null })
  const cases: [string, string, ReturnType<typeof hint>[], number][] = [
    [' 明日、10時', '明日、十時', [hint('明日', 'アシタ')], 2],
    ['　明日は京都', '明日は京都', [hint('明日', 'アシタ'), hint('京都', 'キョート')], 1],
    ['\n明日は京都', '明日は京都', [hint('明日', 'アシタ'), hint('京都', 'キョート')], 1],
    ['\t 明日香さんは明日来ます', '明日香さんは明日来ます', [], 1],
    ['😀 明日は', '明日は', [hint('明日', 'アシタ')], 2],
    ['" 明日は東京都と京都', '明日は東京都と京都', [hint('明日', 'アシタ'), hint('東京都', 'トーキョート'), hint('京都', 'キョート')], 2],
    ['〜 明日', '明日', [hint('明日', 'アシタ')], 2],
    [' 東京都庁と京都 ', '東京都庁と京都', [], 2],
  ]
  for (const [text, normalizedText, hints, rulesApplied] of cases) {
    assert.deepEqual(prepareSegments(text, { lexicon: lex, maxChars: 100, single: true }), [{ text, normalizedText, hints, rulesApplied }], JSON.stringify(text))
  }
})

test('방어(lead): 공백으로 시작하는 표기가 손상 스냅샷으로 들어와도 뒤 hint 좌표가 어긋나지 않는다(task-035 L-2)', () => {
  // 관리 입력은 공백 표기를 막지만 스냅샷 읽기 필터(validateLexiconEntry)는 trim 후 빈 값만 거른다 — selectEntries 를 거치지 않고 직접 만든 사전
  const lex = new Map([
    [' 明日', E(' 明日', 'アシタ')],
    ['京都', E('京都', 'キョート')],
  ])
  const kyoto = { surface: '京都', reading: 'キョート', accentType: 0, wordType: null }
  for (const [text, normalizedText] of [
    [' 明日京都', '明日京都'],
    [' 明日は京都', '明日は京都'],
  ]) {
    assert.deepEqual(prepareSegments(text, { lexicon: lex, maxChars: 100, single: true }), [{ text, normalizedText, hints: [kyoto], rulesApplied: 1 }], JSON.stringify(text))
  }
})

test('계약표(hintRescanCases.json): rescanHintSurfaces 재구성이 어댑터 substituteReadings 와 같은 문장을 낸다', () => {
  assert.ok(HINT_RESCAN_CASES.length >= 10)
  for (const c of HINT_RESCAN_CASES) assert.equal(substituted(c.text, c.hints), c.expected, c.id)
})

test('rescanHintSurfaces 는 어댑터 강등 치환 규칙(중복 제거 → 긴 표기 먼저 → 왼쪽부터 건너뛰기)과 같은 자리를 잡는다', () => {
  // 위치 정보가 없어 긴 표기 안의 짧은 표기·같은 표기의 모든 자리를 잡는다 — prepareSegments 가 이것을 막아야 하는 이유
  assert.deepEqual(rescanHintSurfaces('東京都庁と京都', ['京都']), [
    { start: 1, surface: '京都' },
    { start: 5, surface: '京都' },
  ])
  assert.deepEqual(rescanHintSurfaces('明日香と明日', ['明日', '明日']), [
    { start: 0, surface: '明日' },
    { start: 4, surface: '明日' },
  ])
  assert.deepEqual(rescanHintSurfaces('', ['明日']), [])
  assert.deepEqual(rescanHintSurfaces('明日', ['']), [])
})

test('캐시 키: 가드로 hint 가 빠진 문장은 옛 키(アシタ香 오디오)와 다르고, 바뀌지 않은 문장은 같다', () => {
  const parts = (hints: readonly { surface: string; reading: string; accentType: number; wordType: string | null }[], normalizedText: string): CacheKeyParts => ({
    normalizedText,
    voiceProfileId: 'v1',
    modelVersion: 'm1',
    dictionaryVersion: 3,
    lexiconDigest: lexiconDigest(hints),
    speechProfile: 'NATIVE',
    style: 'Neutral',
    styleWeight: 1,
    speed: 1,
    pitch: 1,
    intonation: 1,
    engineConnectionKey: 'c1',
    textVersion: 1,
  })
  // 옛 경로 = 최장 일치 그대로 hint
  const oldHints = (text: string) => findLexiconMatches(text, SEED_ASHITA).map(({ surface, reading, accentType, wordType }) => ({ surface, reading, accentType, wordType }))
  for (const text of ['明日香さん', '明日香さんは明日来ます']) {
    const now = tts(text, SEED_ASHITA).seg
    assert.notEqual(ttsCacheKey(parts(now.hints, now.normalizedText)), ttsCacheKey(parts(oldHints(text), now.normalizedText)), text)
  }
  const same = tts('明日は晴れです', SEED_ASHITA).seg
  assert.equal(ttsCacheKey(parts(same.hints, same.normalizedText)), ttsCacheKey(parts(oldHints('明日は晴れです'), same.normalizedText)))
})

// ── 사전 캐시 세대(REV-103 L-1) ──────────────────────────────────────

const v = (n: number): ActiveLexicon => ({ dictionaryVersion: n, entries: [E('明日', 'アシタ')] })
const tick = () => new Promise((r) => setImmediate(r))

function hanging() {
  let release: (x: ActiveLexicon) => void = () => undefined
  let calls = 0
  const fetch = () => {
    calls++
    return new Promise<ActiveLexicon>((r) => {
      release = r
    })
  }
  return { fetch, release: (x: ActiveLexicon) => release(x), calls: () => calls }
}

test('표시용 사전: clear 직후 늦게 끝난 옛 조회는 캐시를 채우지 못한다', async () => {
  clearLexiconCache()
  const env = 'STAGING' as Environment
  const old = hanging()
  assert.equal(await loadLexiconForDisplay(env, { fetch: old.fetch, timeoutMs: 10 }), null)
  clearLexiconCache() // 사전 커밋
  old.release(v(1))
  await tick()
  let calls = 0
  const fresh = async () => {
    calls++
    return v(2)
  }
  assert.equal((await loadLexiconForDisplay(env, { fetch: fresh, timeoutMs: 50 }))?.dictionaryVersion, 2)
  assert.equal(calls, 1, '옛 조회 결과(v1)가 캐시에 남지 않아 새로 조회')
  clearLexiconCache()
})

test('표시용 사전: clear 뒤 요청은 옛 진행 조회에 합류하지 않고, 옛 조회의 정리가 새 진행 조회 자리를 지우지 않는다', async () => {
  clearLexiconCache()
  const env = 'LOCAL' as Environment
  const a = hanging()
  assert.equal(await loadLexiconForDisplay(env, { fetch: a.fetch, timeoutMs: 10 }), null)
  clearLexiconCache()
  const b = hanging()
  assert.equal(await loadLexiconForDisplay(env, { fetch: b.fetch, timeoutMs: 10 }), null)
  assert.equal(b.calls(), 1, '새 조회 시작(옛 조회 합류 아님)')
  a.release(v(1))
  await tick()
  const c = hanging()
  assert.equal(await loadLexiconForDisplay(env, { fetch: c.fetch, timeoutMs: 10 }), null)
  assert.equal(c.calls(), 0, '진행 중인 새 조회(b)에 합류 — 옛 조회 a 의 정리가 b 자리를 지우지 않았다')
  b.release(v(2))
  await tick()
  assert.equal((await loadLexiconForDisplay(env, { fetch: c.fetch, timeoutMs: 10 }))?.dictionaryVersion, 2)
  assert.equal(c.calls(), 0)
  clearLexiconCache()
})

test('loadActiveLexicon: 값 반환 계약은 그대로, clear 전에 시작한 조회는 캐시를 채우지 않는다', async () => {
  clearLexiconCache()
  const env = 'DEVELOPMENT' as Environment
  const row = (version: number) => ({ version, snapshot: [{ scope: 'GLOBAL', scopeRefId: null, surface: '明日', reading: 'アシタ', accentType: 0, priority: 10, wordType: null, enabled: true }] })
  let release: (x: ReturnType<typeof row>) => void = () => undefined
  let calls = 0
  let next: () => Promise<ReturnType<typeof row>> = () =>
    new Promise((r) => {
      release = r
    })
  // Prisma 위임 객체는 프록시라 mock.method 가 속성을 못 찾는다 — 직접 바꾸고 finally 에서 되돌린다(DB 접속 없음).
  const delegate = prisma.pronunciationLexiconVersion as unknown as { findFirst: (...a: unknown[]) => Promise<unknown> }
  const original = delegate.findFirst
  delegate.findFirst = () => {
    calls++
    return next()
  }
  try {
    const pending = loadActiveLexicon(env)
    await tick()
    clearLexiconCache()
    release(row(1))
    assert.equal((await pending).dictionaryVersion, 1, '기다리던 요청 자신은 받은 값을 쓴다')
    next = async () => row(2)
    assert.equal((await loadActiveLexicon(env)).dictionaryVersion, 2, '옛 조회(v1)는 캐시에 남지 않았다')
    assert.equal(calls, 2)
    assert.equal((await loadActiveLexicon(env)).dictionaryVersion, 2, '새 세대 조회는 캐시를 채운다')
    assert.equal(calls, 2)
  } finally {
    delegate.findFirst = original
    clearLexiconCache()
  }
})
