/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트 */
/**
 * task-034 QA — 렌더링 플랜(prepareSegments) 오프라인 점검. 서버·M4 없이 개발 미러에서 실제 코드를 직접 호출한다(DB 는 LOCAL ACTIVE 사전 읽기뿐).
 *   A. 대표 문장 표: 옛 동작(가드 전 = findLexiconMatches + 정규화 protect) vs 새 동작(prepareSegments) — hints·어댑터 치환 결과·캐시 키
 *   B. 무작위 퍼저: 키가 같은데 어댑터 입력(소리)이 다른 경우 0 / hint 가 달라졌는데 키가 같은 경우 0 / `アシタ香` 0
 * 사용: node --env-file=.env --import tsx tests/live/task034-qa-plan.ts   (APP_ENV=LOCAL)
 */
import { substituteReadings } from '../../src/modules/engine/adapters/tts/styleBertHttp'
import { ttsCacheKey, type CacheKeyParts } from '../../src/modules/speech/tts/cache'
import { findLexiconMatches, lexiconDigest, loadActiveLexicon, selectEntries, type LexiconEntryData } from '../../src/modules/speech/tts/lexicon'
import { normalizeJapanese } from '../../src/modules/speech/tts/normalizer'
import { prepareSegments } from '../../src/modules/speech/tts/renderingPlan'

if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만')
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

const ent = (surface: string, reading: string, wordType: LexiconEntryData['wordType'] = null, extra: Partial<LexiconEntryData> = {}): LexiconEntryData => ({ surface, reading, accentType: -1, priority: 10, scope: 'GLOBAL', scopeRefId: null, wordType, enabled: true, ...extra } as LexiconEntryData)

interface Prep {
  normalizedText: string
  hints: { surface: string; reading: string; accentType: number; wordType: string | null }[]
}
function oldPrepare(text: string, selected: ReadonlyMap<string, LexiconEntryData>): Prep {
  const matches = findLexiconMatches(text, selected)
  const n = normalizeJapanese(text, { protect: matches })
  return { normalizedText: n.normalizedText, hints: matches.map(({ surface, reading, accentType, wordType }) => ({ surface, reading, accentType, wordType })) as any }
}
function newPrepare(text: string, selected: ReadonlyMap<string, LexiconEntryData>): Prep {
  const [seg] = prepareSegments(text, { lexicon: selected, maxChars: 100, single: true })
  return { normalizedText: seg.normalizedText, hints: seg.hints as any }
}
function keyOf(p: Prep, dictionaryVersion: number): string {
  const parts: CacheKeyParts = {
    normalizedText: p.normalizedText,
    voiceProfileId: 'qa-voice',
    modelVersion: 'qa-model',
    dictionaryVersion,
    lexiconDigest: lexiconDigest(p.hints as any),
    speechProfile: 'NATIVE' as any,
    style: 'Neutral',
    styleWeight: 1,
    speed: 1,
    pitch: 1,
    intonation: 1,
    engineConnectionKey: 'qa-conn',
    textVersion: 1,
  }
  return ttsCacheKey(parts)
}
const sub = (p: Prep) => substituteReadings(p.normalizedText, p.hints as any)

async function main() {
  const active = await loadActiveLexicon('LOCAL')
  const seed = selectEntries(active.entries, { userId: null })
  console.log(`LOCAL ACTIVE v${active.dictionaryVersion}, 선택된 표기: ${[...seed.keys()].join(' ')}`)
  const dv = active.dictionaryVersion

  // ── A. 대표 문장 표 (시드만) ──────────────────────────────────────────
  console.log('\n## A. 대표 문장 — 시드 사전만 (옛 → 새)')
  const rows: [string, string][] = [
    ['明日香さん', '핵심 결함(あすか)'],
    ['明日来ます', '복합어 뒤 한자'],
    ['日本橋駅', '시드 日本橋 + 한자 접미'],
    ['山田先生', '시드 밖(사전 무관)'],
    ['明日は晴れです', '회귀: 明日 단독(가나 이웃)'],
    ['明日', '회귀: 문장 전체=표기'],
    ['今日明日', '시드엔 今日 없음 — 한자 이웃'],
    ['明日香さんは明日来ます', '복합어+단독 혼재'],
    ['今日明日香さんが来る', '복합어 앞 한자'],
    ['明日3時に会おう', '정규화가 만든 한자 이웃'],
    ['秋葉原駅で会おう', '시드+접미'],
    ['神保町に行く', '시드+가나'],
    ['等々力渓谷', '시드+한자'],
    ['東京都庁と京都', '미시드(참고)'],
    ['明日の天気は明日香さんに聞く', '혼재2'],
  ]
  let aDefectAsitaKa = 0
  for (const [t, note] of rows) {
    const o = oldPrepare(t, seed)
    const n = newPrepare(t, seed)
    const ko = keyOf(o, dv)
    const kn = keyOf(n, dv)
    console.log(`  [${note}] ${t}\n     old hints=${JSON.stringify(o.hints.map((h) => h.surface))} → adapter「${sub(o)}」 key=${ko.slice(0, 10)}\n     new hints=${JSON.stringify(n.hints.map((h) => h.surface))} → adapter「${sub(n)}」 key=${kn.slice(0, 10)}  ${ko === kn ? '(키 동일)' : '(키 다름)'}`)
    if (/アシタ香/.test(sub(n))) aDefectAsitaKa++
  }
  const g = (t: string, selected = seed) => ({ o: oldPrepare(t, selected), n: newPrepare(t, selected) })
  {
    const { o, n } = g('明日香さん')
    check('A1 明日香さん: 옛=アシタ香さん(결함 재현) → 새=hint 0·원문 그대로', sub(o) === 'アシタ香さん' && n.hints.length === 0 && sub(n) === '明日香さん', `old「${sub(o)}」 new「${sub(n)}」 hints=${n.hints.length}`)
    check('A2 明日香さん: 새 키 ≠ 옛 키(옛 오디오 재사용 없음)', keyOf(o, dv) !== keyOf(n, dv), `${keyOf(o, dv).slice(0, 12)} vs ${keyOf(n, dv).slice(0, 12)}`)
  }
  {
    const { o, n } = g('明日は晴れです')
    check('A3 明日は晴れです: 사전 적용 유지(アシタは晴れです), 옛=새·키 동일', sub(n) === 'アシタは晴れです' && sub(o) === sub(n) && keyOf(o, dv) === keyOf(n, dv), `new「${sub(n)}」`)
  }
  {
    const { n } = g('明日')
    check('A4 明日 단독: 적용 유지(アシタ)', sub(n) === 'アシタ', `new「${sub(n)}」`)
  }
  {
    const { n } = g('明日香さんは明日来ます')
    check('A5 明日香さんは明日来ます: 어댑터 재검색까지 뚫리지 않음(アシタ 0건)', !/アシタ/.test(sub(n)) && n.hints.length === 0, `new「${sub(n)}」 hints=${n.hints.length}`)
  }
  {
    const { n } = g('明日3時に会おう')
    check('A6 明日3時に会おう: 정규화 한자 이웃에도 사전 유지(アシタ三時)', /^アシタ三時/.test(sub(n)), `new「${sub(n)}」`)
  }
  {
    const { n } = g('日本橋駅')
    check('A7 日本橋駅: 사전이 한자 이웃으로 빠짐 → hint 0(엔진 기본 읽기 몫)', n.hints.length === 0, `new「${sub(n)}」`)
  }

  // ── A'. 확장 사전 — 가나 혼합·今日 포함 ─────────────────────────────
  console.log('\n## A\'. 확장 사전(합성 항목: 愚か·青か·今日·山田·明日香)')
  const withKana = new Map([...seed, ...selectEntries([ent('愚か', 'オロカ'), ent('青か', 'アオカ'), ent('今日', 'キョー'), ent('山田', 'ヤマダ', 'PERSON')], { userId: null })])
  for (const t of ['愚か。', '赤か青か', '青かった', '愚か者', '今日明日', '今日明日香さんが来る', '山田さん', '山田先生', '山田先生と山田さん', '山田は来る']) {
    const o = oldPrepare(t, withKana)
    const n = newPrepare(t, withKana)
    console.log(`  ${t}\n     old → 「${sub(o)}」 hints=${o.hints.length}\n     new → 「${sub(n)}」 hints=${n.hints.length}`)
  }
  {
    const { o, n } = g('愚か。', withKana)
    check('A8 愚か。(가나 혼합) 불변', sub(o) === sub(n) && sub(n) === 'オロカ。', `「${sub(n)}」`)
    const b = g('赤か青か', withKana)
    check('A9 赤か青か(가나 혼합) 불변', sub(b.o) === sub(b.n) && /アオカ/.test(sub(b.n)), `「${sub(b.n)}」`)
    const c = g('青かった', withKana)
    check('A10 青かった(가나 혼합) 불변', sub(c.o) === sub(c.n), `「${sub(c.n)}」`)
  }
  {
    const { n } = g('今日明日', withKana)
    check('A11 今日·明日 둘 다 사전에 있으면 今日明日 양쪽 적용(キョーアシタ)', sub(n) === 'キョーアシタ', `「${sub(n)}」`)
    const k = g('今日明日香さんが来る', withKana)
    check('A12 今日明日香さんが来る: 今日 유지·明日 버림(キョー明日香さん…)', /^キョー明日香さん/.test(sub(k.n)), `「${sub(k.n)}」`)
  }
  {
    const y1 = g('山田さん', withKana).n
    const y2 = g('山田先生', withKana).n
    const y3 = g('山田先生と山田さん', withKana).n
    check('A13 [M-2 기록] 山田さん 적용', y1.hints.length === 1 && sub(y1) === 'ヤマダさん', `「${sub(y1)}」`)
    check('A14 [M-2 기록] 山田先生 미적용(한자 접미어)', y2.hints.length === 0, `「${sub(y2)}」`)
    check('A15 [M-2 기록] 山田先生と山田さん: 두 표기 통째로 꺼짐(어댑터 재검색 일관성)', y3.hints.length === 0, `「${sub(y3)}」`)
  }
  check('A16 새 동작에서 アシタ香 0건(전 대표문장)', aDefectAsitaKa === 0, `${aDefectAsitaKa}건`)

  // ── B. 무작위 퍼저 ────────────────────────────────────────────────────
  console.log('\n## B. 무작위 퍼저(시드 + 확장 사전)')
  const POOL = ['明日', '日本橋', '秋葉原', '御徒町', '神保町', '等々力', '香', '駅', '学', '来', '今日', '山田', '先生', 'は', 'が', 'さん', 'を', '、', '。', '3', '時', '愚', 'か', '青', '京', '都', '東', ' ', 'ABC', '１０']
  let seedState = 12345
  const rnd = () => ((seedState = (seedState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const N = 150_000
  const stats = { total: 0, hintsChanged: 0, keySameSoundDiff: 0, hintsChangedKeySame: 0, asitaKa: 0, exceptions: 0, spuriousSubstitution: 0, hintSentences: 0 }
  const examples: string[] = []
  for (const lex of [seed, withKana]) {
    for (let i = 0; i < N; i++) {
      const len = 1 + Math.floor(rnd() * 6)
      let t = ''
      for (let j = 0; j < len; j++) t += POOL[Math.floor(rnd() * POOL.length)]
      if (t.trim().length === 0) continue
      stats.total++
      try {
        const o = oldPrepare(t, lex)
        const n = newPrepare(t, lex)
        const ko = keyOf(o, dv)
        const kn = keyOf(n, dv)
        const so = sub(o)
        const sn = sub(n)
        const hintsSame = JSON.stringify(o.hints) === JSON.stringify(n.hints)
        if (!hintsSame) stats.hintsChanged++
        if (ko === kn && so !== sn) {
          stats.keySameSoundDiff++
          if (examples.length < 5) examples.push(`키 동일·소리 상이: ${t} old「${so}」 new「${sn}」`)
        }
        if (!hintsSame && ko === kn) {
          stats.hintsChangedKeySame++
          if (examples.length < 5) examples.push(`hint 변경·키 동일: ${t}`)
        }
        // 독립 불변식: 실제 어댑터(substituteReadings)에 hint 마다 같은 표식 글자를 읽기로 넣어, 치환 횟수 = hint 수(가드가 버린 자리·재검색 우연 일치가 치환되지 않음)
        if (n.hints.length > 0) stats.hintSentences++
        const marked = substituteReadings(n.normalizedText, n.hints.map((h) => ({ ...h, reading: '\uE000' })) as any)
        if ([...marked].filter((c) => c === '\uE000').length !== n.hints.length) {
          stats.spuriousSubstitution++
          if (examples.length < 5) examples.push(`치환 횟수 불일치: ${t} hints=${n.hints.length} marked=${marked}`)
        }
        if (/明日香/.test(t) && /アシタ香/.test(sn)) {
          stats.asitaKa++
          if (examples.length < 5) examples.push(`アシタ香: ${t} → ${sn}`)
        }
      } catch (e) {
        stats.exceptions++
        if (examples.length < 5) examples.push(`예외: ${t} ${(e as Error).message}`)
      }
    }
  }
  console.log('  stats', JSON.stringify(stats), examples)
  check('B1 퍼저: 예외 0', stats.exceptions === 0, `총 ${stats.total}건`)
  check('B2 퍼저: 키가 같은데 어댑터 입력(소리)이 다른 경우 0', stats.keySameSoundDiff === 0, `hint 변경 ${stats.hintsChanged}건 중`)
  check('B3 퍼저: hint 목록이 바뀌었는데 키가 같은 경우 0', stats.hintsChangedKeySame === 0)
  check('B4 퍼저: 明日香 포함 문장에서 アシタ香 0', stats.asitaKa === 0)
  check('B5 퍼저: 실제 어댑터 치환 횟수 = hint 수(가드가 버린 자리가 어댑터 재검색에 뚫리지 않음)', stats.spuriousSubstitution === 0, `hint 가 남은 문장 ${stats.hintSentences}건 검사`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n== task034-qa-plan: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}
main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 2
  })
  .finally(() => process.exit())
