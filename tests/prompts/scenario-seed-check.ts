/**
 * task-010d PE-2 — 시드 상황(`prisma/seed-data/scenarios.json`) 품질 점검. **결정적·LLM 0·DB 0**(일회용 점검 스크립트).
 *
 * 실행(미러에서, DB 접촉 없음):
 *   DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx tests/prompts/scenario-seed-check.ts
 * 끝 코드 0 = 모든 FAIL 항목 통과(WARN 은 사람이 읽을 참고). 파일을 고치면 이 스크립트를 다시 돌린다.
 *
 * 점검 묶음
 *   A 구조      로더 검사 통과(`parseSeedScenarios`) · key 유일 · 주제 key ∈ topics.json · 주제당 상황 2 · 수준 N5 6~7·N4 3~4 · 난이도 곡선(① 1~2, ② ①보다 위·2~3)
 *   B 글 칸     모든 일본어 칸 한도 내 · 제어·비가시 문자 0 · 한국어 칸에 가나/한자 0 · 일본어 칸에 한글 0 · 꺾쇠 0 · 엔진명·실제 상표·연락처 0 · 읽기 칸은 한자 표현에만(가나만) + ja 와 정합
 *   C 표현      id e1…eN 연속 · 같은 일본어 중복 0 · 표현 5~8 · 필수 1~3(≤표현 수) · steps 3~5 · 성공 조건 2~3 · 첫마디가 선생님 질문/권유형
 *   D 표현 확인  (코드 판정 `scenarioExpressionForms`) 자기 표현 인식 · **일본어 5자 미만 0(조정관 지시 — 3자 이하 표현은 쓰지 않는다)** · 모든 대안(ja·읽기·정중 어미 뗀 핵심·match)이
 *               3자 이상(3자는 한자 포함일 때만) · 상황 안 두 표현이 서로를 인식하면(중복 변형) FAIL · 흔한 맞장구·빈 말("です"·"お願いします"…)이 어떤 표현도 통과시키지 않음
 *   G 변형 인식  "바꿔 말하는" 표현의 자연스러운 변형 18개를 코드가 인식(MUST) · 되묻기·다른 표현 30문장이 그 표현으로 세어지지 않음(NEG) · 못 잡는 6개는 GAP 으로 정보만(qa-p2c-B #7)
 *   F 로더       실제 파일로 `seedScenarios` 를 메모리 가짜 DB 에 돌려 — 드라이런 쓰기 0 · 첫 실행 새 10 · 다시 실행 쓰기 0(멱등) · 연결 10 · 시드 아닌 행·지우기 0
 *   E 헤더 예산  `[상황]` 블록 FULL 단계가 460자 안·`…`(잘림) 0, COMPACT 단계는 잘림 0 을 권장(WARN) — 표현은 앞 5개가 FULL, 앞 3개가 MINIMAL 에 실린다
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma, type PrismaClient } from '@prisma/client'
import { parseSeedScenarios, seedScenarios, type ScenarioSeed } from '../../prisma/seed-scenarios'
import type { SeedTopicInput } from '../../prisma/seed-topics'
import { detectScenarioExpressions, readScenarioExpressions, scenarioExpressionForms, scenarioRequiredExpressions } from '../../src/modules/learning/scenarios/expressions'
import { readScenarioGoal, readScenarioOpening, readScenarioRoles, readScenarioSteps } from '../../src/modules/learning/scenarios/view'
import { normalizeForMatch } from '../../src/modules/learning/lessons/matching'
import { renderScenarioBlock, SCENARIO_BLOCK_MAX, type TalkScenarioInput } from '../../src/modules/conversation/prompts/talkScenario'

const ROOT = process.cwd()
// 변이 시험용으로 SCENARIO_SEED_FILE 로 다른 파일을 가리킬 수 있다(기본 = 실제 시드 파일).
const seedFile = process.env.SCENARIO_SEED_FILE ?? join(ROOT, 'prisma/seed-data/scenarios.json')
const rawText = readFileSync(seedFile, 'utf8')
const raw = JSON.parse(rawText) as Record<string, unknown>[]
const topics = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as { key: string; title: string; level: string }[]
const topicKeys = new Set(topics.map((t) => t.key))

const fails: string[] = []
const warns: string[] = []
const fail = (k: string, m: string) => fails.push(`[${k}] ${m}`)
const warn = (k: string, m: string) => warns.push(`[${k}] ${m}`)
const len = (s: string) => Array.from(s).length

const KANJI = /[㐀-鿿々]/u
const KANA = /[぀-ゟ゠-ヿ]/u
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/u
const HIRA_KATA_ONLY = /^[぀-ゟ゠-ヿー、。・\s]+$/u
// 제어문자·서식·무시 가능 문자·줄/문단 구분자·점자 공백·BOM — 소스에 문자가 그대로 들어가지 않게 코드포인트(0x…)로 만든다.
const INVISIBLE = new RegExp('[\\p{Cc}\\p{Cf}\\p{Default_Ignorable_Code_Point}' + String.fromCharCode(0x2028, 0x2029, 0x2800, 0xfeff) + ']', 'u')
const DENY = /(reazon|whisper|style-?bert|sbv2|claude|anthropic|qwen|ollama|model_?id|speaker_?id|connectionId|スターバックス|スタバ|ドトール|タリーズ|starbucks|マクドナルド|セブン|ローソン|ファミリーマート|Suica|スイカ|PASMO|JR東|電話番号|@[a-z0-9]|https?:)/i

// ── A. 구조 ────────────────────────────────────────────────────────────
let seeds: ScenarioSeed[] = []
try {
  seeds = parseSeedScenarios(raw, topicKeys)
} catch (e) {
  fail('A-parse', (e as Error).message)
}
if (raw.length !== 10) fail('A-count', `상황 ${raw.length}개(10개여야 함)`)
const byTopic = new Map<string, Record<string, unknown>[]>()
for (const e of raw) {
  const ts = e.topics as { key: string }[]
  const primary = ts?.[0]?.key
  if (!primary || !topicKeys.has(primary)) fail('A-topic', `${String(e.key)}: 주제 key 가 topics.json 에 없음`)
  else byTopic.set(primary, [...(byTopic.get(primary) ?? []), e])
}
for (const [k, list] of byTopic) if (list.length !== 2) fail('A-topic2', `주제 ${k} 의 대표 상황이 ${list.length}개(2개여야 함)`)
if (byTopic.size < 5) fail('A-topic5', `상황이 있는 주제 ${byTopic.size}개(5개 이상)`)
const lv = (l: string) => raw.filter((e) => e.level === l).length
if (lv('N5') < 6 || lv('N5') > 7) fail('A-level', `N5 ${lv('N5')}개(6~7)`)
if (lv('N4') < 3 || lv('N4') > 4) fail('A-level', `N4 ${lv('N4')}개(3~4)`)
if (lv('N5') + lv('N4') !== raw.length) fail('A-level', 'N5·N4 밖의 수준이 있음')
for (const [k, list] of byTopic) {
  if (list.length !== 2) continue // 위 A-topic2 가 이미 FAIL
  const [a, b] = list.map((e) => e.difficulty as number)
  if (!(a >= 1 && a <= 2)) fail('A-curve', `${k} ①(${String(list[0].key)}) 난이도 ${a} — 1~2 여야 함`)
  if (!(b >= 2 && b <= 3 && b > a)) fail('A-curve', `${k} ②(${String(list[1].key)}) 난이도 ${b} — ①(${a})보다 위인 2~3 이어야 함`)
}

// ── B. 글 칸 ───────────────────────────────────────────────────────────
function walk(v: unknown, path: string, cb: (s: string, p: string) => void): void {
  if (typeof v === 'string') cb(v, path)
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, cb))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, cb)
}
if (INVISIBLE.test(rawText.replace(/[\n\r\t]/g, ''))) fail('B-invisible', '파일 원문에 제어·비가시 문자가 있음')
raw.forEach((e, i) => {
  const key = String(e.key)
  walk(e, key, (s, p) => {
    if (INVISIBLE.test(s)) fail('B-invisible', `${p} 에 제어·비가시 문자`)
    if (/[<>]/.test(s)) fail('B-angle', `${p} 에 꺾쇠`)
    if (DENY.test(s)) fail('B-deny', `${p} 에 엔진명·상표·연락처 유사 문자열: ${s}`)
    const last = p.split(/[.[]/).filter(Boolean).pop() ?? ''
    const isJa = /(^|\.)(titleJa|ja|reading|match)$/.test(p) || p.endsWith('opening.ja')
    const isSystem = /(^|\.)(key|level|id)$/.test(p) || /topics\[\d+\]\.key$/.test(p)
    if (isSystem) return
    if (isJa) {
      if (HANGUL.test(s)) fail('B-lang', `${p}: 일본어 칸에 한글 — ${s}`)
    } else if (last !== 'difficulty' && last !== 'weight' && last !== 'requiredExpressions') {
      if (KANA.test(s)) fail('B-lang', `${p}: 한국어 칸에 가나 — ${s}`)
      if (KANJI.test(s)) fail('B-lang', `${p}: 한국어 칸에 한자 — ${s}`)
    }
  })
  void i
})
// 읽기 칸: 한자가 있는 표현에만 · 가나만 · ja 와 정합(한자 덩어리 → 가나 덩어리, 나머지는 그대로)
function readingMatches(ja: string, reading: string): boolean {
  const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let re = ''
  let inKanji = false
  for (const c of Array.from(ja)) {
    if (KANJI.test(c)) {
      if (!inKanji) re += '[\\u3040-\\u309F\\u30A0-\\u30FFー]+'
      inKanji = true
    } else {
      inKanji = false
      re += esc(c)
    }
  }
  return new RegExp(`^${re}$`, 'u').test(reading)
}
raw.forEach((e) => {
  for (const x of (e.keyExpressions as Record<string, string>[]) ?? []) {
    const where = `${String(e.key)}.${x.id}`
    const hasKanji = KANJI.test(x.ja)
    if (hasKanji && !x.reading) fail('B-reading', `${where}: 한자 표현인데 읽기가 없음 — ${x.ja}`)
    if (!hasKanji && x.reading) fail('B-reading', `${where}: 한자가 없는데 읽기가 있음 — ${x.ja}`)
    if (x.reading) {
      if (!HIRA_KATA_ONLY.test(x.reading)) fail('B-reading', `${where}: 읽기는 가나만 — ${x.reading}`)
      else if (!readingMatches(x.ja, x.reading)) fail('B-reading', `${where}: 읽기가 ja 와 맞지 않음 — ${x.ja} / ${x.reading}`)
    }
  }
  const t = e.titleJa as string | undefined
  if (t && KANJI.test(t) === false && /[ぁ-ん]/.test(t) === false && /[ァ-ヴ]/.test(t) === false) fail('B-titleJa', `${String(e.key)}: titleJa 가 일본어가 아님`)
})

// ── C. 표현·단계·첫마디 ─────────────────────────────────────────────────
const crossDup = new Map<string, string[]>()
raw.forEach((e) => {
  const key = String(e.key)
  const exprs = (e.keyExpressions as Record<string, string>[]) ?? []
  if (exprs.length < 5 || exprs.length > 8) fail('C-count', `${key}: 표현 ${exprs.length}개(5~8)`)
  exprs.forEach((x, i) => {
    if (x.id !== `e${i + 1}`) fail('C-id', `${key}: ${i + 1}번째 표현 id 가 e${i + 1} 이 아님(${x.id})`)
    crossDup.set(x.ja, [...(crossDup.get(x.ja) ?? []), key])
  })
  const jas = exprs.map((x) => normalizeForMatch(x.ja))
  if (new Set(jas).size !== jas.length) fail('C-dup', `${key}: 같은 일본어 표현 중복`)
  const req = e.requiredExpressions as number
  if (!Number.isInteger(req) || req < 1 || req > 3 || req > exprs.length) fail('C-required', `${key}: 필수 ${req} — 1~3, 표현 수(${exprs.length}) 이하`)
  const steps = (e.steps as unknown[]) ?? []
  if (steps.length < 3 || steps.length > 5) fail('C-steps', `${key}: 단계 ${steps.length}개(3~5)`)
  if (steps.length > 4) warn('C-steps', `${key}: 단계 ${steps.length}개 — COMPACT 헤더는 4개까지만 싣는다`)
  const crit = ((e.goal as { successCriteria?: unknown[] })?.successCriteria ?? []) as unknown[]
  if (crit.length < 2 || crit.length > 3) fail('C-criteria', `${key}: 성공 조건 ${crit.length}개(2~3)`)
  const open = (e.opening as { ja?: string; ko?: string }) ?? {}
  if (!open.ja || !KANA.test(open.ja)) fail('C-opening', `${key}: 첫마디 일본어 없음`)
  else if (!/(ですか|ますか|ください|どうぞ|ですよ|か。)/.test(open.ja)) fail('C-opening', `${key}: 첫마디가 학습자가 대답할 수 있는 질문·권유형이 아님 — ${open.ja}`)
  if (!open.ko) fail('C-opening', `${key}: 첫마디 뜻 없음`)
})
for (const [ja, keys] of crossDup) if (keys.length > 1) warn('C-crossdup', `같은 일본어가 여러 상황에 있음(허용 — 상황별 id 는 따로): ${ja} ← ${keys.join(', ')}`)

// ── D. 표현 확인(코드 판정) ─────────────────────────────────────────────
const FILLERS = ['です', 'ます', 'はい', 'はい。', 'そうですね', 'ですね', 'お願いします', '大丈夫です', 'いいです', 'わかりません', 'ありません', 'ください', 'こんにちは', 'すみません', 'ありがとう', 'そうです', '分かりました']
seeds.forEach((s) => {
  const e = raw.find((r) => r.key === s.key)!
  const exprs = readScenarioExpressions(s.data.keyExpressions)
  const where = (id: string) => `${s.key}.${id}`
  exprs.forEach((x) => {
    const jaLen = len(x.textJa)
    if (jaLen < 5) fail('D-short', `${where(x.id)}: 일본어 ${jaLen}자(5자 이상 — 3자 이하는 쓰지 않는다) — ${x.textJa}`)
    else if (jaLen > 14) warn('D-long', `${where(x.id)}: 일본어 ${jaLen}자 — COMPACT 헤더는 14자에서 잘린다 — ${x.textJa}`)
    const forms = scenarioExpressionForms(x)
    for (const alt of forms) {
      const frag = alt.join('')
      const n = len(frag)
      if (n < 3 || (n === 3 && !KANJI.test(frag))) fail('D-weak', `${where(x.id)}: 인식 대안이 너무 짧음 「${frag}」(${n}자) — ${x.textJa}${x.match ? ` / match ${x.match}` : ''}`)
      else if (n === 3) warn('D-3char', `${where(x.id)}: 3자 대안(한자 포함) 「${frag}」`)
    }
    const hit = detectScenarioExpressions([x.textJa], exprs)
    if (!hit.includes(x.id)) fail('D-self', `${where(x.id)}: 자기 표현을 스스로 인식하지 못함 — ${x.textJa}`)
    if (x.reading && !detectScenarioExpressions([x.reading], exprs).includes(x.id)) fail('D-self', `${where(x.id)}: 읽기(가나)로 쓴 말을 인식하지 못함 — ${x.reading}`)
  })
  // 서로 인식(중복 변형)
  const detects = new Map(exprs.map((x) => [x.id, new Set(detectScenarioExpressions([x.textJa, ...(x.reading ? [x.reading] : [])], exprs).filter((id) => id !== x.id))]))
  for (const a of exprs)
    for (const b of exprs) {
      if (a.id >= b.id) continue
      const ab = detects.get(a.id)!.has(b.id)
      const ba = detects.get(b.id)!.has(a.id)
      if (ab && ba) fail('D-mutual', `${s.key}: ${a.id}↔${b.id} 가 서로를 인식(중복 변형) — 「${a.textJa}」「${b.textJa}」`)
      else if (ab || ba) warn('D-cross', `${s.key}: ${ab ? `${a.id}→${b.id}` : `${b.id}→${a.id}`} 한쪽 인식(문장 하나로 둘이 채워질 수 있음) — 「${a.textJa}」「${b.textJa}」`)
    }
  // 흔한 빈 말이 표현을 통과시키지 않음
  for (const f of FILLERS) {
    const got = detectScenarioExpressions([f], exprs)
    if (got.length) fail('D-filler', `${s.key}: 빈 말 「${f}」 이 표현 ${got.join(',')} 을 통과시킴`)
  }
  void e
})

// ── G. 바꿔 말하기 변형 인식(qa-p2c-B 결함 #7 — `b-recog.ts` 24 변형을 고정) ───────────────────
// MUST = 코드가 알아봐야 하는 자연스러운 변형(데이터 `match` 로 닿는 18개 — 빠지면 FAIL) · NEG = 그 표현으로 세면 안 되는 말(되묻기·다른 표현 — 인식되면 FAIL).
// GAP = 알려진 한계 6개(한 조각 `match` 로는 정밀하게 못 잡는 열린 칸·결제 수단 목록 — 정보만 출력, 코드가 `match` 의 `|`(대안)·`〜`(모두 포함)를 지원하면 MUST 로 올린다).
const VAR_MUST: Record<string, string> = {
  'self-intro-first-meeting:e1': '私の名前はスミです', 'self-intro-first-meeting:e3': '釜山に住んでいます', 'self-intro-likes:e4': '休みの日によく料理をします',
  'cafe-order-drink:e1': 'ラテをください', 'cafe-order-drink:e3': '大きいサイズでお願いします', 'cafe-order-takeout:e2': 'すみません、やっぱり持ち帰りに変えてもいいですか',
  'directions-station-exit:e1': 'すみません、トイレはどこですか', 'directions-station-exit:e5': '駅までここから遠いですか', 'directions-recheck:e4': '駅はどこですか',
  'weekend-plan-tell:e2': '家族と一緒に行きます', 'weekend-plan-tell:e3': 'たぶん日曜日に行きます', 'weekend-plan-invite:e2': '日曜日は大丈夫ですか', 'weekend-plan-invite:e3': '土曜日ならいいです',
  'travel-story-tell:e1': '大阪に行ってきました', 'travel-story-tell:e3': '景色がすてきでした', 'travel-story-tell:e5': '旅館に泊まりました',
  'travel-story-recommend:e4': 'でも少し遠かったです', 'travel-story-recommend:e5': '夏に行くのがおすすめです',
}
const VAR_GAP: Record<string, string> = {
  'self-intro-first-meeting:e2': '学生です', 'self-intro-likes:e1': '私は映画が好きです', 'self-intro-likes:e2': 'とてもおもしろいです',
  'cafe-order-takeout:e4': '現金でお願いします', 'weekend-plan-tell:e1': '買い物に行きます', 'travel-story-recommend:e1': '景色がすばらしかったです',
}
const VAR_NEG: Record<string, string[]> = {
  'self-intro-first-meeting:e2': ['私の名前はスミです', '釜山に住んでいます', 'よろしくお願いします'],
  'self-intro-likes:e1': ['あなたは何が好きですか', '何が好きですか', 'いいですね'],
  'self-intro-likes:e2': ['いいですね', 'あなたは何が好きですか', 'わかりません'],
  'self-intro-likes:e4': ['休みの日は何をしますか', '私は映画が好きです', 'あなたは何が好きですか'],
  'cafe-order-takeout:e4': ['持ち帰りでお願いします', 'ここで飲みます', '全部でいくらですか'],
  'weekend-plan-tell:e1': ['友だちと一緒に行きます', 'たぶん土曜日に行きます', '日曜日は家でゆっくりします'],
  'weekend-plan-tell:e3': ['日曜日は家でゆっくりします', '映画を見に行きます', '友だちと一緒に行きます'],
  'travel-story-tell:e3': ['写真をたくさん撮りました', '思ったより混んでいました', '京都に行ってきました'],
  'travel-story-recommend:e1': ['でも少し高かったです', '人が多かったので疲れました', '春に行くのがおすすめです'],
  'travel-story-recommend:e4': ['食べ物がおいしかったです', '人が多かったので疲れました', '景色がきれいでした'],
}
{
  let must = 0
  let gapHit = 0
  seeds.forEach((s) => {
    const exprs = readScenarioExpressions(s.data.keyExpressions)
    for (const x of exprs) {
      const k = `${s.key}:${x.id}`
      if (VAR_MUST[k] !== undefined) {
        if (detectScenarioExpressions([VAR_MUST[k]], exprs).includes(x.id)) must++
        else fail('G-must', `${k}: 자연스러운 변형 「${VAR_MUST[k]}」 을 코드가 인식하지 못함(match ${x.match ?? '없음'})`)
      }
      if (VAR_GAP[k] !== undefined && detectScenarioExpressions([VAR_GAP[k]], exprs).includes(x.id)) gapHit++
      for (const n of VAR_NEG[k] ?? []) if (detectScenarioExpressions([n], exprs).includes(x.id)) fail('G-neg', `${k}: 「${n}」 은 이 표현이 아닌데 인식됨(match ${x.match ?? '없음'})`)
    }
  })
  console.log(`G 변형 인식: MUST ${must}/${Object.keys(VAR_MUST).length} · 알려진 한계(GAP) ${gapHit}/${Object.keys(VAR_GAP).length} 인식(0 이 기대 — 올라가면 MUST 로 승격) · NEG ${Object.values(VAR_NEG).reduce((n, l) => n + l.length, 0)}문장 오탐 검사`)
}

// ── E. [상황] 헤더 예산 ─────────────────────────────────────────────────
const rows: string[][] = []
seeds.forEach((s) => {
  const exprs = readScenarioExpressions(s.data.keyExpressions)
  const input: TalkScenarioInput = {
    roles: readScenarioRoles(s.data.roles),
    goalKo: readScenarioGoal(s.data.goal).communicativeGoalKo,
    successCriteria: readScenarioGoal(s.data.goal).successCriteria,
    steps: readScenarioSteps(s.data.constraints, s.data.goal),
    expressions: exprs.map((x) => ({ id: x.id, ja: x.textJa, ko: x.meaningKo })),
    requiredExpressions: scenarioRequiredExpressions(s.data.completionRule, exprs.length),
    opening: readScenarioOpening(s.data.constraints, s.data.goal),
  }
  const full = renderScenarioBlock(input, SCENARIO_BLOCK_MAX)
  if (full.tier !== 'FULL') fail('E-full', `${s.key}: 최대 예산(${SCENARIO_BLOCK_MAX}자)에서도 FULL 이 아님(${full.tier}, ${full.text.length}자)`)
  if (full.text.includes('…')) fail('E-clip', `${s.key}: FULL 헤더에서 글이 잘림 — ${full.text.split('\n').filter((l) => l.includes('…')).join(' | ')}`)
  const compact = renderScenarioBlock(input, 330)
  if (compact.tier === 'FULL') {
    /* 330자 안에 FULL 이 들어가면 더 좋은 것 */
  } else if (compact.text.includes('…')) warn('E-compact', `${s.key}: ${compact.tier}(330자 예산) 헤더에서 글이 잘림 — ${compact.text.split('\n').filter((l) => l.includes('…')).join(' | ')}`)
  const minimal = renderScenarioBlock(input, 1)
  if (minimal.text.includes('…')) warn('E-minimal', `${s.key}: MINIMAL 헤더 잘림(최후 단계, 참고) — ${minimal.text.split('\n').filter((l) => l.includes('…')).join(' | ')}`)
  const raws = raw.find((r) => r.key === s.key)!
  rows.push([s.key, (raws.topics as { key: string }[])[0].key, String(raws.level), String(raws.difficulty), String(raws.title), `${input.requiredExpressions}/${exprs.length}`, `${full.text.length}자 ${full.tier}`, `${compact.tier}`])
})

// ── F. 로더(메모리 가짜 DB — DB 접촉 0) ────────────────────────────────
type Row = Record<string, unknown> & { id: string; topics: { topicId: string; weight: number }[] }
const unDbNull = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === Prisma.DbNull ? null : v])) as T
async function loaderCheck(): Promise<string[]> {
  const out: string[] = []
  const topicSeeds = JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/topics.json'), 'utf8')) as SeedTopicInput[]
  const topicRows = (topicSeeds as unknown as Record<string, unknown>[]).map((t) => ({
    id: `tp_${String(t.key)}`,
    title: t.title,
    titleJa: t.titleJa,
    level: t.level,
    description: t.description,
    tags: t.tags ?? [],
    chunks: ((t.chunks as Record<string, unknown>[]) ?? []).map((c, j) => ({ id: `ck_${String(t.key)}_${j}`, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading ?? null, meaningKo: c.meaningKo ?? null, order: c.order ?? j })),
  }))
  const store = new Map<string, Row>()
  let writes = 0
  const tx = {
    scenario: {
      // 실제 DB 는 Prisma.DbNull 을 SQL NULL 로 저장하고 null 로 돌려준다 — 가짜도 같게.
      create: async ({ data }: { data: Row }) => (writes++, store.set(data.id, { ...unDbNull(data), topics: [] })),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => (writes++, store.set(where.id, { ...store.get(where.id)!, ...unDbNull(data) })),
      delete: async () => { throw new Error('상황 삭제 시도') },
      deleteMany: async () => { throw new Error('상황 삭제 시도') },
    },
    scenarioTopic: {
      deleteMany: async ({ where }: { where: { scenarioId: string } }) => { store.get(where.scenarioId)!.topics = [] },
      createMany: async ({ data }: { data: { scenarioId: string; topicId: string; weight: number }[] }) => { for (const d of data) store.get(d.scenarioId)!.topics.push({ topicId: d.topicId, weight: d.weight }) },
    },
  }
  const prisma = {
    conversationTopic: { findMany: async () => topicRows },
    scenario: { ...tx.scenario, findMany: async () => [...store.values()].map((r) => ({ ...r })) },
    scenarioTopic: tx.scenarioTopic,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient
  const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const log = console.log
    console.log = () => {}
    try {
      return await fn()
    } finally {
      console.log = log
    }
  }
  const dry = await quiet(() => seedScenarios(prisma, raw, topicSeeds, { dryRun: true }))
  if (writes !== 0 || store.size !== 0) fail('F-dry', `드라이런이 썼음(writes ${writes}, 행 ${store.size})`)
  if (dry.scenarios.create !== 10 || dry.scenarios.update !== 0 || dry.scenarios.keep !== 0) fail('F-dry', `드라이런 계획이 새 10 이 아님: ${JSON.stringify(dry)}`)
  if (dry.orphans !== 0) fail('F-dry', `고아 시드 상황 ${dry.orphans}`)
  const first = await quiet(() => seedScenarios(prisma, raw, topicSeeds))
  if (store.size !== 10) fail('F-first', `첫 실행 뒤 행 ${store.size}(10)`)
  if (first.scenarios.create !== 10 || first.linksChanged !== 10) fail('F-first', `첫 실행 요약: ${JSON.stringify(first)}`)
  for (const r of store.values()) {
    if (r.userId !== null || r.isSeed !== true || r.status !== 'ACTIVE') fail('F-first', `${r.id}: 시드 행 모양이 아님(userId ${String(r.userId)}, isSeed ${String(r.isSeed)}, status ${String(r.status)})`)
    if (!/^scn_[a-z0-9-]+$/.test(r.id)) fail('F-first', `${r.id}: 안정 id 모양(scn_<key>)이 아님`)
    if (r.topics.length !== 1) fail('F-first', `${r.id}: 연결 ${r.topics.length}개(1개)`)
  }
  const before = writes
  const second = await quiet(() => seedScenarios(prisma, raw, topicSeeds))
  if (writes !== before || second.writes !== 0 || second.scenarios.keep !== 10) fail('F-idem', `다시 실행이 멱등이 아님: ${JSON.stringify(second)} (추가 쓰기 ${writes - before})`)
  out.push(`드라이런 ${JSON.stringify(dry)} → 첫 실행 ${JSON.stringify(first)} → 다시 실행 ${JSON.stringify(second)} (행 ${store.size})`)
  return out
}
void loaderCheck()
  .then((loaderLines) => {

// ── 보고 ───────────────────────────────────────────────────────────────
console.log('key | 주제 | 수준 | 난이도 | 제목 | 필수/표현 | FULL 헤더 | 330자 예산')
for (const r of rows) console.log(r.join(' | '))
for (const l of loaderLines) console.log(`로더: ${l}`)
console.log(`\n상황 ${raw.length}개 · 로더 검사 통과 ${seeds.length}개 · 표현 ${raw.reduce((n, e) => n + ((e.keyExpressions as unknown[])?.length ?? 0), 0)}개`)
for (const w of warns) console.log(`WARN ${w}`)
for (const f of fails) console.log(`FAIL ${f}`)
console.log(`\n결과: FAIL ${fails.length} · WARN ${warns.length}`)
if (fails.length) process.exit(1)
  })
  .catch((e) => {
    console.error(e)
    process.exit(2)
  })
