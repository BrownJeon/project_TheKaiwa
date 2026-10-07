/**
 * task-010d 시드 표현 인식 보강(qa-p2c-B #7) — `match` 문법 `|`(대안 여럿)·`〜`(조각 모두 포함) 단위 테스트(DB·LLM 없음).
 * 구분자 없는 기존 `match` 는 출력 불변(옛 공식과 대조), 구분자가 있으면 쓴 그대로만(자동 핵심 없음), 빈 대안·짧은 대안은 건너뛰고,
 * 되묻기·빈 말은 통과시키지 않는다. 사용자 상황 입력(shape.ts)은 `match` 를 받지 않는다는 사실도 함께 고정한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chunkForms } from '../lessons/matching'
import { detectScenarioExpressions, parseScenarioMatch, readScenarioExpressions, scenarioExpressionForms, type ScenarioExpression } from '../scenarios/expressions'
import { cleanScenarioText, normalizeScenarioInput } from '../scenarios/shape'

const expr = (id: string, textJa: string, match: string | null, reading: string | null = null): ScenarioExpression => ({ id, chunkId: null, textJa, reading, meaningKo: null, chunkType: null, match })

/** 이 변경 전의 공식 그대로 — 구분자 없는 `match` 는 이것과 같아야 한다. */
function legacyForms(e: ScenarioExpression): string[][] {
  const alts = new Map<string, string[]>()
  for (const alt of [...chunkForms(e.textJa, e.reading), ...(e.match ? chunkForms(e.match) : [])]) alts.set(alt.join('\u0000'), alt)
  return [...alts.values()]
}

const hits = (text: string, ...ex: ScenarioExpression[]) => detectScenarioExpressions([text], ex)

test('구분자 없는 match 는 출력 불변 — 옛 공식과 같다(자동 핵심 포함)', () => {
  const olds = ['にしてください', '持ち帰り', '好きですか', '景色が', 'おいしかった', '行ってきました', 'ホットで', 'カードで', 'に住んでい', 'で払います', 'アイスコ', '写真を撮', 'まっすぐ行', 'ゆっくり', '見に行き', 'ならいいです']
  for (const m of olds) {
    const e = expr('x', 'カードでお願いします', m, 'カードでおねがいします')
    assert.deepEqual(scenarioExpressionForms(e), legacyForms(e), `match ${m}`)
    assert.deepEqual(parseScenarioMatch(m), { explicit: false, alts: chunkForms(m), ignored: [] })
  }
  assert.deepEqual(parseScenarioMatch(null), { explicit: false, alts: [], ignored: [] })
  assert.deepEqual(parseScenarioMatch(''), { explicit: false, alts: [], ignored: [] })
  const noMatch = expr('x', 'カードでお願いします', null)
  assert.deepEqual(scenarioExpressionForms(noMatch), legacyForms(noMatch))
})

test('실제 시드 파일: 구분자 없는 match 는 옛 공식과 같고, 구분자 있는 match 는 버려진 대안 없이 살아남는다', () => {
  const seeds = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/scenarios.json'), 'utf8')) as { key: string; keyExpressions: Record<string, unknown>[] }[]
  let plain = 0
  for (const s of seeds) {
    for (const e of readScenarioExpressions(s.keyExpressions)) {
      const p = parseScenarioMatch(e.match)
      if (!p.explicit) {
        assert.deepEqual(scenarioExpressionForms(e), legacyForms(e), `${s.key}:${e.id}`)
        plain++
      } else {
        assert.deepEqual(p.ignored, [], `${s.key}:${e.id} match ${e.match} — 빈·짧은 대안이 있다`)
        assert.ok(p.alts.length > 0, `${s.key}:${e.id} match ${e.match} — 살아남은 대안 없음`)
      }
    }
  }
  assert.ok(plain > 0)
})

test('| 대안 OR: 하나라도 들어 있으면 사용 — 결제 수단 목록', () => {
  const pay = expr('e4', 'カードでお願いします', 'カードで|現金で|で払います', 'カードでおねがいします')
  assert.deepEqual(parseScenarioMatch(pay.match), { explicit: true, alts: [['かーどで'], ['現金で'], ['で払います']], ignored: [] })
  assert.deepEqual(hits('カードでお願いします', pay), ['e4'])
  assert.deepEqual(hits('現金でお願いします', pay), ['e4'])
  assert.deepEqual(hits('お金で払います', pay), ['e4'])
  assert.deepEqual(hits('ばらのかわりに現金でどうぞ', pay), ['e4'])
  for (const no of ['持ち帰りでお願いします', 'ここで飲みます', '全部でいくらですか', 'ありがとうございます']) assert.deepEqual(hits(no, pay), [], no)
  // 전각 구분자도 같은 뜻
  assert.deepEqual(parseScenarioMatch('カードで｜現金で').alts, parseScenarioMatch('カードで|現金で').alts)
})

test('〜 조각 AND: 모두(순서 무관) 들어 있어야 사용 — 되묻기 「何が好きですか」는 통과하지 않는다', () => {
  const likes = expr('e1', '私は音楽が好きです', '私は〜が好き', 'わたしはおんがくがすきです')
  assert.deepEqual(parseScenarioMatch(likes.match), { explicit: true, alts: [['私は', 'が好き']], ignored: [] })
  assert.deepEqual(hits('私は映画が好きです', likes), ['e1'])
  assert.deepEqual(hits('私は料理が好きなんです', likes), ['e1'])
  assert.deepEqual(hits('が好きです、私は', likes), ['e1'], '순서 무관(문서화된 느슨함)')
  for (const no of ['あなたは何が好きですか', '何が好きですか', 'いいですね', '私は好きです', 'わかりません']) assert.deepEqual(hits(no, likes), [], no)
  // 문형용 grammarForms 였다면 한자를 건너뛴 가나 조각 `きです` 한 대안이 생겨 되묻기가 통과했을 것이다 — 그런 대안이 없다.
  assert.ok(!scenarioExpressionForms(likes).some((a) => a.join('').length <= 2), '2자 이하 대안 없음')
  // 대안(|)과 조각(〜)을 같이 쓴다
  const lively = expr('e2', 'とても楽しいです', 'とても〜です|すごく〜です|おもしろい')
  assert.deepEqual(parseScenarioMatch(lively.match).alts, [['とても', 'です'], ['すごく', 'です'], ['おもしろい']])
  assert.deepEqual(hits('とてもおもしろいです', lively), ['e2'])
  assert.deepEqual(hits('すごくたのしかったです', lively), ['e2'])
  assert.deepEqual(hits('おもしろいと思います', lively), ['e2'])
  for (const no of ['いいですね', 'あなたは何が好きですか', 'わかりません', 'そうです']) assert.deepEqual(hits(no, lively), [], no)
})

test('구분자가 있으면 자동 핵심(정중·사전형 어미를 뗀 글)을 만들지 않는다', () => {
  // 구분자 없음 = 기존: `で払います` → `で払い` 핵심도 대안.
  const plain = expr('x', 'カードでお願いします', 'で払います')
  assert.ok(scenarioExpressionForms(plain).some((a) => a.join('') === 'で払い'))
  assert.deepEqual(hits('で払いました', plain), ['x'])
  // 구분자 있음 = 쓴 그대로만.
  const explicit = expr('x', 'カードでお願いします', 'で払います|現金で')
  assert.ok(!scenarioExpressionForms(explicit).some((a) => a.join('') === 'で払い'))
  assert.deepEqual(hits('で払いました', explicit), [])
  assert.deepEqual(hits('で払います', explicit), ['x'])
  // 표기·읽기(ja·reading)의 자동 핵심은 그대로 — `match` 쪽만 다르다.
  assert.deepEqual(scenarioExpressionForms(explicit).slice(0, chunkForms('カードでお願いします', null).length), chunkForms('カードでお願いします', null))
  // 직업 접미 — `員です` 가 `員で` 가 되면 「員で…」 가 모두 통과한다.
  const job = expr('e2', '会社員です', '員です|生です')
  assert.ok(!scenarioExpressionForms(job).some((a) => a.join('') === '員で' || a.join('') === '員'))
  assert.deepEqual(hits('学生です', job), ['e2'])
  assert.deepEqual(hits('エンジニアです', job), [], '카타카나 직업은 못 잡는다(알려진 한계)')
  assert.deepEqual(hits('私の名前はスミです', job), [])
})

test('빈 대안·앞뒤 구분자·구분자만·중복·포함 조각: 안전하게 건너뛴다', () => {
  const ok = parseScenarioMatch('カードで|現金で').alts
  for (const m of ['カードで||現金で', '|カードで|現金で', 'カードで|現金で|', ' | カードで | 現金で | ', '||カードで|||現金で||']) {
    const p = parseScenarioMatch(m)
    assert.deepEqual(p.alts, ok, m)
    assert.ok(p.ignored.length > 0 && p.ignored.every((x) => x === ''), `${m} — 빈 대안은 ignored 에 '' 로 남는다`)
  }
  for (const m of ['〜', '|', '〜|〜', '｜', '～～', ' 〜 | 〜 ']) {
    const p = parseScenarioMatch(m)
    assert.deepEqual([p.explicit, p.alts], [true, []], m)
    // match 가 아무것도 못 낳아도 표기·읽기 대안은 그대로(ja 만으로 인식).
    const e = expr('x', 'ホットでお願いします', m)
    assert.deepEqual(scenarioExpressionForms(e), legacyForms({ ...e, match: null }), m)
    assert.deepEqual(hits('ホットでお願いします', e), ['x'])
  }
  // 같은 조각 중복·다른 조각 안에 든 조각은 합친다.
  assert.deepEqual(parseScenarioMatch('が好き〜が好き〜私は').alts, [['が好き', '私は']])
  assert.deepEqual(parseScenarioMatch('好き〜が好き〜私は').alts, [['が好き', '私は']], '好き 는 が好き 안에 있다')
  // 정규화: 전각·가타카나·공백
  assert.deepEqual(parseScenarioMatch('ＫＡＲＤ で|カード で').alts, [['kardで'], ['かーどで']])
})

test('길이 하한: 조각을 이은 길이가 3자 미만인 대안은 버린다(です 한 조각이 모든 정중한 말에 걸리는 것을 막는다)', () => {
  assert.deepEqual(parseScenarioMatch('〜です'), { explicit: true, alts: [], ignored: ['〜です'] })
  assert.deepEqual(parseScenarioMatch('です〜です'), { explicit: true, alts: [], ignored: ['です〜です'] })
  assert.deepEqual(parseScenarioMatch('です|カードで'), { explicit: true, alts: [['かーどで']], ignored: ['です'] })
  assert.deepEqual(parseScenarioMatch('員です'), { explicit: false, alts: chunkForms('員です'), ignored: [] }, '구분자가 없으면 기존 규칙(점검 스크립트 D-weak 가 본다)')
  assert.deepEqual(parseScenarioMatch('員です|生').alts, [['員です']])
  assert.deepEqual(parseScenarioMatch('員です|生').ignored, ['生'])
  const weak = expr('x', 'ホットでお願いします', 'です|ます')
  for (const filler of ['です', 'ます', 'はい、そうです', 'お願いします', '大丈夫です']) assert.deepEqual(hits(filler, weak), [], filler)
})

test('저장·입력 경로: match 의 | 〜 는 지워지지 않고 읽히며, 사용자 상황 입력(create·patch)은 match 칸을 받지 않는다(시드 전용)', () => {
  for (const m of ['とても〜です|すごく〜です|おもしろい', 'カードで｜現金で', '私は～が好き', '私は~が好き']) assert.equal(cleanScenarioText(m), m)
  const read = readScenarioExpressions([{ id: 'e2', ja: 'とても楽しいです', ko: '아주 즐거워요', match: ' とても〜です|すごく〜です|おもしろい ' }])
  assert.equal(read[0].match, 'とても〜です|すごく〜です|おもしろい', '읽을 때 앞뒤 공백만 정리')
  const body = (mode: 'create' | 'patch' | 'seed') =>
    normalizeScenarioInput(
      {
        ...(mode === 'patch' ? {} : { title: 'T', level: 'N5', roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoalKo: '목표', successCriteria: ['하나'] }, steps: [{ ko: 'a' }, { ko: 'b' }] }),
        keyExpressions: [
          { id: 'e1', ja: 'とても楽しいです', ko: '즐거워요', match: 'とても〜です|すごく〜です|おもしろい' },
          { id: 'e2', ja: 'ホットで', ko: '따뜻하게' },
        ],
      },
      mode,
    )
  const seed = body('seed')
  assert.deepEqual(seed.value.keyExpressions?.[0].match, 'とても〜です|すごく〜です|おもしろい')
  for (const mode of ['create', 'patch'] as const) {
    const r = body(mode)
    assert.ok(r.problems.some((p) => p.field === 'keyExpressions[0].match' && p.reason === 'unknown_key'), `${mode}: match 는 unknown_key`)
  }
})
