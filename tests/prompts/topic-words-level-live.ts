/**
 * task-078 PE 진단 — A12 `topicWords@v2` 에서 «챌린지 난이도가 주제 수준보다 두 단계 이상 높으면 새 단어가 0~2장만 통과» 하는 **탈락 사유를 처음으로 측정**한다.
 * 가설(미측정): 지시문 «[수준]과 같거나 한 단계 위·아래만, 그보다 어려운 단어는 내지 않는다» 때문에 모델이 주제의 쉬운 단어(N4~N5)를 만들고 급수를 솔직히 달면
 * 검사 ⑤ `JLPT_WINDOW`(수준 ±1 창) 밖이라 탈락한다. 이 도구는 가설이 아니라 **숫자**로 답한다.
 *
 * 입력 = 주제 1개(픽스처 `topic-words.json` 의 N4 주제, 기본 `weekend-plan`) × `[수준]` 값만 바꾼 4조건: 챌린지 N2(두 단계 위)·N3(한 단계 위)·N5(한 단계 아래)·대조 N4(주제 그대로).
 * 운영과 같은 방식으로 `[수준]` 과 검사 ⑤ 창을 **같은 값(챌린지 난이도)** 으로 넣는다(`learning/vocab/topicSet.ts` `runTopicWords`: `build({topic:{...topic, level}})` + `assemble(r.data,{level})`).
 * 목표 장수 10(요청 13), 제외 목록 = 그 주제 기본 표현뿐(첫날 조건). **variant(이번 초점)** 는 운영 첫날이 항상 0(명사 초점)이라 세트 6개가 거의 같은 응답이 되므로,
 * 세트마다 0~5 로 돌려 입력을 달리한다: N3·N5·대조는 {0,2,4}, N2 는 {0,1,2,3,4,5}(N2 의 {0,2,4} 는 나머지 조건과 같은 입력 쌍으로 읽을 수 있다).
 *
 * **호출 경로** = 운영 A12 와 같다: `buildTopicWordsRequest` → `llm.completeJson`, task=`topicWords`(fast·20s·interactive — `engine/router/tasks.ts`), `tier`·`timeoutMs` 덮어쓰지 않음.
 * 운영과 다른 점(한계): DB·Trace 없음(연결은 시드 모양 고정 — task049 `STUB_CONNECTION` 방식), 벽시계 30초·손님 취소 없음, 운영 서버·DB 접촉 0.
 *
 * 측정(호출마다 저장):
 *  ① 통과 장수·`classifyTopicWordsResult`  ② `droppedByReason`  ③ 모델이 단 `jlpt` 분포(N1~N5·JSON null·문자열 "null")  ④ `jlpt` 가 null 이라 통과한 단어 수
 *  ⑤ 단어마다 탈락 사유(앞에서부터 prefix 로 `assembleTopicWords` 를 다시 돌려 항목별 상태를 정확히 분리)
 *  ⑥ 반사실: `jlpt` 를 전부 null 로 바꿔 다시 조립했을 때의 통과 장수(= ⑤ 창을 껐다면) — 가설이 맞으면 목표(10) 근처로 오르고, 틀리면 안 오른다
 *  ⑦ **외부 급수 기준** `prisma/seed-data/jlpt/n1~n5.json`(surface 로 대조, DB 없음) — 사전 매칭률·방향 일치율·모델 급수와 사전 급수의 일치(자기 신고 vs 외부 기준)
 *     매칭: ⓐ 표기 그대로 ⓑ 정중형·과거형을 사전형으로 되돌린 후보(飲みます→飲む, おいしいです→おいしい) ⓒ 가나로만 쓴 표기는 사전 읽기와 대조(ひま→暇). 급수가 여러 개에 걸친 표기는 «애매» 로
 *     방향 계산에서 뺀다. 복합 표현(家でゆっくりします)은 매칭되지 않는다 — 매칭률은 지표의 한계다(사전 = 시드 JLPT 목록 7,647 표기, 공식 급수표가 아니다).
 *
 * **라이브 호출은 15회까지**(task-078 사용자 승인 예산 약 40회 중 진단 몫): N2×6 · N3×3 · N5×3 · 대조×3. (`PLAN=improve` 는 프롬프트를 고친 뒤 개선 측정 25회 — N2×10·N3×6·N5×6·대조×3 — 용이고 진단에서는 쓰지 않았다.) `MAX_CALLS`(기본 15)는 OUT 에 남은 행(실패 포함)까지 세어 넘기지 않는다 —
 * 시험 호출도 이 15회 안이다. 429·한도 문구·즉시 실패(5초 안 비타임아웃 오류) 2연속이면 멈추고 그대로 기록한다. 호출 간격 ≥ 1.5초, 직렬.
 * 호출 점검은 `DRY=1`(호출 없음 — 계획·프롬프트 길이·분석기 자체 점검), 결과 요약은 `DUMP=1`(OUT 만 읽음, 호출 없음).
 *
 * 실행(전용 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-pe078 && OUT=<결과.json> node --env-file=.env --import tsx tests/prompts/topic-words-level-live.ts
 * 환경: OUT · TOPIC(주제 key, 기본 weekend-plan) · TARGET=10 · GAP_MS=1500(최소 1500) · PLAN=diag|improve · MAX_CALLS=15(improve 25) · RESUME=1(OUT 의 끝난 호출은 건너뜀) · DRY=1 · DUMP=1
 *       ARM=base(기본, 운영 프롬프트 그대로)|v3(개선 변형) · STAGE=1(improve 의 N2×10 만)|2(N3×6·N5×6·대조×3 — 1단계가 합격선 이상일 때만)
 *       ※ v3 반영 뒤 `ARM=base` = 현재 운영(`topicWords@v3`)이다 — 진단의 v2 기준선은 이 도구로 재현되지 않고 진단 결과 JSON 에만 있다.
 *
 * ── 개선 단계(task-078 PE 개선, `pe-078-improve`) ────────────────────────────────────────────
 * `ARM=v3` 는 **운영 파일을 바꾸지 않고** 운영 `SYSTEM_PROMPT` 위에 `VARIANT_EDITS` 치환 3곳만 얹어 잰다(앵커가 정확히 1번 나오지 않으면 던진다 — 운영 프롬프트가 바뀌었다는 뜻).
 * 합격해서 운영 파일이 같은 문구로 바뀐 뒤에는 `to` 문구가 이미 들어 있으므로 치환 없이 통과하고, DRY 가 «운영 = 변형» 동일성을 점검한다.
 * 판정(Leader L1~L3)은 `gate()` 가 낸다: L1 N2 평균 ≥ 8.0장 · L2 N3 방향 일치율 − 진단 기준선 22.7% ≥ +15%p(보조) · L3 N5·대조 평균 ≥ 9.0장 · jlpt null 통과 ≤ 10% · 지연 p95 ≤ 12초 · 1차 ajv 유지.
 * 급수 부풀리기(거짓 급수로 통과) 점검용으로 N2 통과 단어의 사전 급수 분포(`dictKept`)와 모델−사전 편향(`labelVsDictAll.meanBiasN`)을 gate 에 함께 낸다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import {
  assembleTopicWords,
  buildTopicWordsRequest,
  classifyTopicWordsResult,
  TOPIC_WORDS_PROMPT_VERSION,
  topicWordsLevelWindow,
  topicWordsRequestCount,
  type TopicWordDropReason,
  type TopicWordsResponse,
} from '../../src/modules/conversation/prompts/topicWords'
import type { JlptLevel } from '../../src/modules/conversation/structuredResponse/schemas'

// ── 설정 ─────────────────────────────────────────────────────────────────────────────────
interface FxChunk { textJa: string; reading: string; meaningKo: string; chunkType: string }
interface FxTopic { key: string; title: string; titleJa: string; description: string; level: JlptLevel; chunks: FxChunk[] }
interface FxResponse { id: string; note: string; topic: string; level: string; target: number; response: unknown }
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words.json'), 'utf8')) as { topics: FxTopic[]; responses: FxResponse[] }

const OUT = process.env.OUT ?? join(tmpdir(), 'thekaiwa-pe078', 'task078-topicwords-level.json')
const TOPIC_KEY = process.env.TOPIC ?? 'weekend-plan'
const TARGET = Number(process.env.TARGET ?? 10)
const GAP_MS = Math.max(1500, Number(process.env.GAP_MS ?? 1500))
/** PLAN=diag(기본, 진단 15회: N2×6·N3×3·N5×3·대조×3) · PLAN=improve(개선 후 25회: N2×10·N3×6·N5×6·대조×3 — task-078 예산 배분, 프롬프트를 고친 뒤 같은 하네스로 잰다). */
const PLAN_KIND = process.env.PLAN === 'improve' ? 'improve' : 'diag'
const MAX_CALLS = Number(process.env.MAX_CALLS ?? (PLAN_KIND === 'improve' ? 25 : 15))
/** ARM=v3 → 운영 시스템 프롬프트에 `VARIANT_EDITS` 를 얹는다(운영 파일은 그대로). */
const ARM: 'base' | 'v3' = process.env.ARM === 'v3' ? 'v3' : 'base'
/** improve 계획의 단계: 1 = N2×10 만 · 2 = N3×6·N5×6·대조×3 · 0 = 전체 25회 인터리브(예전 방식). task-078 L4 — N2×10 평균이 8.0 미만이면 2단계를 부르지 않는다. */
const STAGE: 0 | 1 | 2 = process.env.STAGE === '1' ? 1 : process.env.STAGE === '2' ? 2 : 0
/** 진단 15회(운영 `topicWords@v2`)에서 대조 N4 단어에 같은 판정식을 적용한 «방향 일치» 기준선(%) — Leader L2 가 이 값(N3 22.7%)을 빼라고 정했다. N2 는 보조 참고. */
const DIAG_BASELINE_PCT = { N3: 22.7, N2: 9.1 } as const
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const IMMEDIATE_FAIL_MS = 5_000

// DB 없이 연결 고정(시드 claude-cli-local 모양 — task042·task049 실측과 같다).
const STUB_CONNECTION: ResolvedConnection = {
  id: 'stub-claude-cli-local',
  key: 'claude-cli-local',
  engineId: 'claude-cli',
  connectionType: 'CLI',
  connection: {},
  runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, concurrency: 1, interactiveLane: true, permissionMode: 'dontAsk', tools: '' },
  credentialRef: null,
}
routerDeps.loadChain = async () => [STUB_CONNECTION]

type CondKey = 'N2' | 'N3' | 'N5' | 'CTRL'
interface Cond { key: CondKey; level: JlptLevel; variants: number[] }
const CONDS: Cond[] = [
  { key: 'N2', level: 'N2', variants: [0, 1, 2, 3, 4, 5] },
  { key: 'N3', level: 'N3', variants: [0, 2, 4] },
  { key: 'N5', level: 'N5', variants: [0, 2, 4] },
  { key: 'CTRL', level: 'N4', variants: [0, 2, 4] },
]
const LEVEL_NUM: Record<string, number> = { N1: 1, N2: 2, N3: 3, N4: 4, N5: 5 }

interface Planned { id: string; cond: CondKey; level: JlptLevel; variant: number }

/** improve 계획의 조건별 variant(같은 초점 번호가 겹치면 id 에 `#2` 를 붙인다). N2 는 8방향을 모두 돌고 2개를 되풀이한다. */
const IMPROVE_VARIANTS: Record<CondKey, number[]> = {
  N2: [0, 1, 2, 3, 4, 5, 6, 7, 0, 4],
  N3: [0, 2, 4, 1, 3, 5],
  N5: [0, 2, 4, 1, 3, 5],
  CTRL: [0, 2, 4],
}

/** 변형 `v3` — 운영 `SYSTEM_PROMPT` 위에 얹는 치환 3곳(task-078 PE 개선). `from` 은 운영 문구와 **바이트 일치**해야 하고, 합격하면 운영 파일의 해당 줄이 `to` 로 바뀐다. */
const L232_FROM = '- 주제 안에서 실제로 말하는 단어·표현만 냅니다. 주제 밖 단어와, 시험 문법 용어·문형 이름·급수 설명은 내지 않습니다.'
const L239_FROM =
  '- jlpt: [수준]과 같거나 한 단계 위·아래 난이도만 냅니다(예: N5 → N5·N4). 그보다 어려운 단어는 내지 않습니다. jlpt 는 급수를 확신할 때만 N5~N1 로 쓰고, 모르면 null(따옴표 없는 JSON null)입니다.'
export const VARIANT_EDITS: Array<{ id: string; from: string; to: string }> = [
  {
    id: 'A-지시줄에 수준',
    from: '그 주제의 일상 회화에서 한국인 일본어 학습자가 실제로 쓰는 단어·짧은 표현을 냅니다.',
    to: '그 주제의 일상 회화에서 한국인 일본어 학습자가 실제로 쓰는 단어·짧은 표현 중, [수준]에서 배울 만한 것을 냅니다.',
  },
  {
    id: 'B-난이도 선택 기준(새 줄)',
    from: L232_FROM,
    to: `${L232_FROM}\n- 난이도: [수준]은 학습자가 배우려는 난이도입니다. 단어를 고르는 단계부터 맞춥니다 — 카드의 절반 이상은 급수가 [수준]인 표현으로 고르고, [수준]보다 두 단계 이상 쉬운 기초어는 내지 않습니다(예: [수준]이 N2 면 食べる·行く·大きい·約束·準備 같은 N5·N4 기초어는 제외). 같은 뜻이면 더 쉬운 말보다 [수준]에 맞는 말을 고릅니다(N2 → 한자어·복합어·추상적인 말 쪽). 난이도를 맞추려고 주제 밖 단어를 내지는 않습니다.`,
  },
  {
    id: 'C-jlpt 줄(범위 예시·실제 급수)',
    from: L239_FROM,
    to: '- jlpt: [수준]과 같거나 한 단계 위·아래 급수만 냅니다(예: N5 → N5·N4, N2 → N3·N2·N1). 이 범위 밖 급수는 내지 않습니다. jlpt 는 그 단어의 실제 급수를 쓰고 [수준]에 맞추려고 바꾸지 않습니다. 급수를 확신할 때만 N5~N1 로 쓰고, 모르면 null(따옴표 없는 JSON null)입니다.',
  },
]

/** 운영 시스템 프롬프트에 변형을 얹는다. 앵커가 1번이 아니면(운영이 바뀜) 던진다 — 단, 이미 모든 `to` 가 들어 있고 `from` 이 없으면(합격 후 운영 반영) 그대로 돌려준다. */
export function applyVariant(system: string): string {
  // 운영이 이미 세 `to` 를 모두 갖고 있으면(합격 후 반영) 치환하지 않는다 — B 의 `to` 는 `from` 을 포함하므로 `from` 개수로는 구분할 수 없다.
  if (VARIANT_EDITS.every((e) => system.includes(e.to))) return system
  let s = system
  for (const e of VARIANT_EDITS) {
    const n = s.split(e.from).length - 1
    if (n !== 1) throw new Error(`변형 치환 앵커 ${e.id} 가 ${n}번 나온다(1번이어야 한다) — 운영 프롬프트가 바뀌었다`)
    s = s.replace(e.from, () => e.to)
  }
  return s
}

/** ARM 에 맞는 요청 — 변형은 system 한 칸만 바꾼다(입력 블록·스키마·persona 는 운영 그대로). */
function buildRequestForArm(input: Parameters<typeof buildTopicWordsRequest>[0]) {
  const req = buildTopicWordsRequest(input)
  return ARM === 'v3' ? { ...req, system: applyVariant(req.system) } : req
}

function buildImprovePlan(): Planned[] {
  const plan: Planned[] = []
  const seen = new Map<string, number>()
  const active = STAGE === 1 ? CONDS.filter((c) => c.key === 'N2') : STAGE === 2 ? CONDS.filter((c) => c.key !== 'N2') : CONDS
  const rounds = Math.max(...active.map((c) => IMPROVE_VARIANTS[c.key].length))
  for (let i = 0; i < rounds; i++) {
    const order = active.map((_, k) => active[(k + i) % active.length]) // 라운드마다 시작 조건을 돌려 시간 편향을 줄인다
    for (const c of order) {
      const v = IMPROVE_VARIANTS[c.key][i]
      if (v === undefined) continue
      const base = `${c.key}-v${v}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      plan.push({ id: n === 1 ? base : `${base}#${n}`, cond: c.key, level: c.level, variant: v })
    }
  }
  return plan
}

/** 진단 15회 계획 — 변형(0·2·4) 라운드마다 4조건을 돌려 가며(시간 편향 완화) 부르고, 각 라운드 끝에 N2 추가 세트(1·3·5)를 한 번씩 부른다. */
function buildPlan(): Planned[] {
  if (PLAN_KIND === 'improve') return buildImprovePlan()
  const plan: Planned[] = []
  const base = [0, 2, 4]
  const extra = [1, 3, 5]
  base.forEach((v, round) => {
    const order = CONDS.map((_, i) => CONDS[(i + round) % CONDS.length])
    for (const c of order) plan.push({ id: `${c.key}-v${v}`, cond: c.key, level: c.level, variant: v })
    plan.push({ id: `N2-v${extra[round]}`, cond: 'N2', level: 'N2', variant: extra[round] })
  })
  return plan
}

// ── 급수 사전(외부 기준, DB 없음) ───────────────────────────────────────────────────────────
interface DictEntry { surface: string; reading: string; meaning: string }
const dict = new Map<string, Set<number>>()
/** 읽기(히라가나 정규화) → 급수. 가나로만 쓴 표기(ひま·れじ)를 한자 표제어(暇·レジ)와 이어 주는 마지막 후보다 — 동음이의가 여러 급수에 걸치면 «애매» 로 빠진다. */
const dictByReading = new Map<string, Set<number>>()
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
function loadDict(): { counts: Record<string, number>; surfaces: number; multiLevel: number } {
  const counts: Record<string, number> = {}
  for (const n of [1, 2, 3, 4, 5]) {
    const path = join(process.cwd(), `prisma/seed-data/jlpt/n${n}.json`)
    const list = JSON.parse(readFileSync(path, 'utf8')) as DictEntry[]
    counts[`N${n}`] = list.length
    for (const w of list) {
      const set = dict.get(w.surface) ?? new Set<number>()
      set.add(n)
      dict.set(w.surface, set)
      const rk = toHira(w.reading ?? '')
      if (rk) {
        const rs = dictByReading.get(rk) ?? new Set<number>()
        rs.add(n)
        dictByReading.set(rk, rs)
      }
    }
  }
  return { counts, surfaces: dict.size, multiLevel: [...dict.values()].filter((s) => s.size > 1).length }
}

const U_ROW: Record<string, string> = { い: 'う', き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る' }

/** 사전 찾기 후보 — 표기 그대로 + 정중형·과거형을 사전형으로 되돌린 것(거친 규칙, 오탈 가능). */
function dictCandidates(textJa: string): string[] {
  const out: string[] = [textJa]
  const push = (s: string) => { if (s && !out.includes(s)) out.push(s) }
  let s = textJa
  const stripped = /^(.*?)(でした|です)$/.exec(s)
  if (stripped) {
    s = stripped[1]
    push(s)
    if (s.endsWith('かった')) push(`${s.slice(0, -3)}い`) // おいしかったです → おいしい
  }
  const masu = /^(.*?)(ませんでした|ました|ません|ます)$/.exec(textJa)
  if (masu && masu[1]) {
    const stem = masu[1]
    const last = stem.slice(-1)
    const head = stem.slice(0, -1)
    if (U_ROW[last]) push(`${head}${U_ROW[last]}`) // 飲み → 飲む, 行き → 行く(5단)
    push(`${stem}る`) // 食べ → 食べる(1단)
    if (last === 'し') {
      push(`${head}する`) // 勉強し → 勉強する
      push(head) // 勉強
    }
    push(stem)
  }
  return out
}

interface DictHit { how: 'exact' | 'deconj' | 'reading' | 'none'; levels: number[]; via: string | null }
function lookupDict(textJa: string): DictHit {
  const c = dictCandidates(textJa.trim())
  for (let i = 0; i < c.length; i++) {
    const set = dict.get(c[i])
    if (set) return { how: i === 0 ? 'exact' : 'deconj', levels: [...set].sort(), via: c[i] }
  }
  for (const cand of c) {
    if (!KANA_ONLY.test(cand)) continue
    const set = dictByReading.get(toHira(cand))
    if (set) return { how: 'reading', levels: [...set].sort(), via: cand }
  }
  return { how: 'none', levels: [], via: null }
}

// ── 호출 ─────────────────────────────────────────────────────────────────────────────────
interface RawWord { textJa: string; reading: string; meaningKo: string; chunkType: string; jlpt?: unknown; valid?: unknown; exampleJa?: unknown; exampleKo?: unknown }

interface ItemTrace {
  i: number
  textJa: string
  reading: string
  meaningKo: string
  chunkType: string
  jlptRaw: string // 'N3' | 'null'(JSON null) | '"null"'(문자열) | 'undefined' | 그 밖
  status: 'KEPT' | TopicWordDropReason
  dict: DictHit
}

interface Row {
  id: string
  arm?: 'base' | 'v3'
  cond: CondKey
  level: JlptLevel
  topicLevel: JlptLevel
  variant: number
  target: number
  count: number
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  received?: number
  keptCount?: number
  keptIfWindowOff?: number
  droppedByReason?: Partial<Record<TopicWordDropReason, number>>
  outcome?: { source: string; reason: string | null; fillCount: number }
  items?: ItemTrace[]
  words?: RawWord[]
  errorName?: string
  error?: string
  limitHit?: boolean
  timeout?: boolean
}
interface Saved { startedAt: string; version: string; arm?: 'base' | 'v3'; topic: string; topicLevel: JlptLevel; target: number; maxCalls: number; rows: Row[]; stopped?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const pctOf = (n: number, d: number) => round((n / Math.max(1, d)) * 100)

function jlptRawLabel(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v === 'null' ? '"null"' : v
  return `other:${typeof v}`
}

/** 앞에서부터 prefix 로 조립을 다시 돌려 항목마다 통과/탈락 사유를 분리한다(조립은 앞에서 뒤로 순차·결정적이라 정확하다). */
function traceItems(words: RawWord[], ctx: { level: JlptLevel; exclude: string[]; excludeMeanings: string[] }): ItemTrace[] {
  const traces: ItemTrace[] = []
  let prevKept = 0
  for (let i = 0; i < words.length; i++) {
    const a = assembleTopicWords({ words: words.slice(0, i + 1) }, ctx)
    const kept = a.words.length > prevKept
    const status: ItemTrace['status'] = kept ? 'KEPT' : (a.dropped[a.dropped.length - 1]?.reason ?? 'MALFORMED')
    prevKept = a.words.length
    const w = words[i]
    traces.push({
      i,
      textJa: String(w.textJa ?? ''),
      reading: String(w.reading ?? ''),
      meaningKo: String(w.meaningKo ?? ''),
      chunkType: String(w.chunkType ?? ''),
      jlptRaw: jlptRawLabel(w.jlpt),
      status,
      dict: lookupDict(String(w.textJa ?? '')),
    })
  }
  return traces
}

/** 한 응답의 분석 — 호출 결과와 DRY 자체 점검이 같이 쓴다. */
function analyze(base: Omit<Row, 'ok' | 'elapsedMs'>, data: TopicWordsResponse, exclude: string[], excludeMeanings: string[]): Partial<Row> {
  const ctx = { level: base.level, exclude, excludeMeanings }
  const raw = data.words as unknown as RawWord[]
  const asm = assembleTopicWords(data, ctx)
  // 반사실: jlpt 를 모두 null 로 — 검사 ⑤ 를 끈 것과 같다(이후 검사 ⑥·⑦ 은 통과한 앞 항목 기준으로 그대로 돈다).
  const off = assembleTopicWords({ words: raw.map((w) => ({ ...w, jlpt: null })) }, ctx)
  const oc = classifyTopicWordsResult(asm.words.length, base.target)
  return {
    received: asm.received,
    keptCount: asm.words.length,
    keptIfWindowOff: off.words.length,
    droppedByReason: asm.droppedByReason,
    outcome: { source: oc.source, reason: oc.reason, fillCount: oc.fillCount },
    items: traceItems(raw, ctx),
    words: raw,
  }
}

function makeBase(p: Planned, topic: FxTopic): Omit<Row, 'ok' | 'elapsedMs'> {
  return { id: p.id, arm: ARM, cond: p.cond, level: p.level, topicLevel: topic.level, variant: p.variant, target: TARGET, count: topicWordsRequestCount(TARGET) }
}

function buildInput(p: Planned, topic: FxTopic) {
  const exclude = topic.chunks.map((x) => x.textJa)
  const excludeMeanings = topic.chunks.map((x) => x.meaningKo)
  return {
    exclude,
    excludeMeanings,
    input: { topic: { title: topic.title, titleJa: topic.titleJa, description: topic.description, level: p.level }, targetCount: TARGET, exclude, variant: p.variant },
  }
}

async function runCall(p: Planned, topic: FxTopic): Promise<Row> {
  const base = makeBase(p, topic)
  const { exclude, excludeMeanings, input } = buildInput(p, topic)
  const req = buildRequestForArm(input)
  const t0 = Date.now()
  try {
    // tier·timeoutMs 를 덮어쓰지 않는다 — 레지스트리의 topicWords(fast·20s·interactive)가 그대로 적용된다(운영과 같은 값).
    const r = await llm.completeJson<TopicWordsResponse>(req)
    return { ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, ...analyze(base, r.data, exclude, excludeMeanings) }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${typeof err.raw === 'string' ? err.raw.slice(0, 2000) : ''}`
    return { ...base, ok: false, elapsedMs: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 240), limitHit: LIMIT_RE.test(blob), timeout: /Timeout/i.test(err.name) }
  }
}

// ── 요약 ─────────────────────────────────────────────────────────────────────────────────
type Count = Record<string, number>
const inc = (m: Count, k: string, n = 1) => { m[k] = (m[k] ?? 0) + n }

/** 사전 급수가 한 개로 정해진 단어만(여러 급수에 걸친 표기는 애매하다) 방향을 본다. 같은 거리면 `tie`. */
function direction(level: number, chal: number, topic: number): 'toChallenge' | 'tie' | 'toTopic' {
  const dc = Math.abs(level - chal)
  const dt = Math.abs(level - topic)
  return dc < dt ? 'toChallenge' : dc > dt ? 'toTopic' : 'tie'
}

function dictStats(items: ItemTrace[], chal: number, topic: number) {
  const hit = items.filter((t) => t.dict.how !== 'none')
  const exact = items.filter((t) => t.dict.how === 'exact')
  const byHow: Count = {}
  for (const t of items) inc(byHow, t.dict.how)
  const single = hit.filter((t) => t.dict.levels.length === 1)
  const levels: Count = {}
  for (const t of single) inc(levels, `N${t.dict.levels[0]}`)
  const dir: Count = {}
  if (chal !== topic) for (const t of single) inc(dir, direction(t.dict.levels[0], chal, topic))
  const nums = single.map((t) => t.dict.levels[0])
  const toChal = dir.toChallenge ?? 0
  return {
    n: items.length,
    matched: hit.length,
    matchedExact: exact.length,
    byHow,
    matchRatePct: round((hit.length / Math.max(1, items.length)) * 100),
    matchRateExactPct: round((exact.length / Math.max(1, items.length)) * 100),
    ambiguousMultiLevel: hit.length - single.length,
    dictLevelDist: levels,
    meanDictN: round(mean(nums), 2), // N 번호 평균 — 낮을수록 어렵다
    direction: chal === topic ? 'n/a(대조)' : dir,
    directionMatchPct: chal === topic ? null : round((toChal / Math.max(1, single.length)) * 100),
    directionMatchBasis: single.length,
  }
}

/** 모델이 단 급수 vs 사전 급수(자기 신고 vs 외부 기준) — 사전 급수가 한 개로 정해지고 모델 급수가 N1~N5 인 단어만. */
function labelHonesty(items: ItemTrace[]) {
  const pairs = items.filter((t) => t.dict.how !== 'none' && t.dict.levels.length === 1 && LEVEL_NUM[t.jlptRaw] !== undefined)
  let same = 0
  let modelEasier = 0
  let modelHarder = 0
  const bias: number[] = []
  for (const t of pairs) {
    const m = LEVEL_NUM[t.jlptRaw]
    const d = t.dict.levels[0]
    bias.push(m - d)
    if (m === d) same++
    else if (m > d) modelEasier++ // 모델이 사전보다 쉬운 급수(N 번호 큼)를 달았다
    else modelHarder++
  }
  return { basis: pairs.length, same, modelLabelsEasierThanDict: modelEasier, modelLabelsHarderThanDict: modelHarder, meanBiasN: round(mean(bias), 2), samePct: round((same / Math.max(1, pairs.length)) * 100) }
}

function condStats(rows: Row[], cond: Cond, topicLevel: JlptLevel) {
  const mine = rows.filter((r) => r.cond === cond.key)
  const ok = mine.filter((r) => r.ok)
  const chal = LEVEL_NUM[cond.level]
  const topic = LEVEL_NUM[topicLevel]
  const items = ok.flatMap((r) => r.items ?? [])
  const kept = items.filter((t) => t.status === 'KEPT')
  const droppedWin = items.filter((t) => t.status === 'JLPT_WINDOW')
  const droppedOther = items.filter((t) => t.status !== 'KEPT' && t.status !== 'JLPT_WINDOW')
  const drops: Count = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.droppedByReason ?? {})) inc(drops, k, v as number)
  const jAll: Count = {}
  const jKept: Count = {}
  const jWin: Count = {}
  for (const t of items) inc(jAll, t.jlptRaw)
  for (const t of kept) inc(jKept, t.jlptRaw)
  for (const t of droppedWin) inc(jWin, t.jlptRaw)
  const outcomes: Count = {}
  for (const r of ok) if (r.outcome) inc(outcomes, `${r.outcome.source}/${r.outcome.reason ?? 'null'}`)
  // 조립은 장수를 자르지 않는다(자르기는 호출자 몫) — 세트에 실제로 들어가는 새 단어 장수는 min(통과, 목표)다.
  const keptPer = ok.map((r) => Math.min(r.keptCount ?? 0, r.target))
  const offPer = ok.map((r) => Math.min(r.keptIfWindowOff ?? 0, r.target))
  const keptRawPer = ok.map((r) => r.keptCount ?? 0)
  const keptNullLabel = kept.filter((t) => t.jlptRaw === 'null' || t.jlptRaw === '"null"' || t.jlptRaw === 'undefined').length
  const labelNums = items.map((t) => LEVEL_NUM[t.jlptRaw]).filter((n): n is number => n !== undefined)
  const labelPct: Count = {}
  for (const [k, v] of Object.entries(jAll)) labelPct[k] = round((v / Math.max(1, items.length)) * 100)
  const lens = items.map((t) => [...t.textJa].length)
  // 대략적인 «표현(구) 모양» 표지 — 여섯 글자 이상이거나 조사·활용 어미가 들어 있다(단어 카드가 아니라 문형 조각으로 흐르는 정도를 보는 거친 지표).
  const phraseLike = items.filter((t) => [...t.textJa].length >= 6 || /[をがはも]|ます|です|ません|ください/.test(t.textJa)).length
  return {
    cond: cond.key,
    challengeLevel: cond.level,
    topicLevel,
    window: topicWordsLevelWindow(cond.level),
    calls: mine.length,
    ok: ok.length,
    failed: mine.length - ok.length,
    keptPerCall: keptPer,
    keptRawPerCall: keptRawPer,
    keptMean: round(mean(keptPer), 2),
    keptMeanPctOfTarget: round((mean(keptPer) / Math.max(1, TARGET)) * 100),
    callsKeptGeTarget: `${ok.filter((r) => (r.keptCount ?? 0) >= r.target).length}/${ok.length}`,
    keptIfWindowOffPerCall: offPer,
    keptIfWindowOffMean: round(mean(offPer), 2),
    received: items.length,
    receivedPerCallMean: round(items.length / Math.max(1, ok.length), 1),
    droppedByReason: drops,
    outcomes,
    jlptLabelAll: jAll,
    jlptLabelAllPct: labelPct,
    meanLabelN: round(mean(labelNums), 2),
    meanSurfaceLen: round(mean(lens), 2),
    phraseLikePct: round((phraseLike / Math.max(1, items.length)) * 100),
    perSet: ok.map((r) => ({ id: r.id, variant: r.variant, kept: Math.min(r.keptCount ?? 0, r.target), windowOff: Math.min(r.keptIfWindowOff ?? 0, r.target) })),
    jlptLabelKept: jKept,
    jlptLabelDroppedByWindow: jWin,
    keptWithNullJlptLabel: keptNullLabel,
    dictAll: dictStats(items, chal, topic),
    dictKept: dictStats(kept, chal, topic),
    dictDroppedByWindow: dictStats(droppedWin, chal, topic),
    dictDroppedOther: dictStats(droppedOther, chal, topic),
    labelVsDictAll: labelHonesty(items),
    attemptsSum: ok.reduce((n, r) => n + (r.attempts ?? 1), 0),
    elapsedOkMeanMs: round(mean(ok.map((r) => r.elapsedMs)), 0),
  }
}

/**
 * 대조(CTRL) 대비 — «방향 일치율» 은 0 에서 시작하지 않는다: 대조 세트의 단어도 사전 급수가 챌린지 쪽에 더 가까운 것이 일정 비율 있다(예: 대조에서 N3 이상 단어 비율).
 * 그래서 같은 판정식을 **대조 단어에 적용한 기준선**을 빼서 «이동분(lift)» 으로 읽는다. 평균 사전 급수(N 번호, 낮을수록 어려움)도 대조와 뺀다 — 완전히 이동했다면 (챌린지 N − 주제 N) 만큼 어긋난다.
 */
function vsCtrl(saved: Saved) {
  const topicN = LEVEL_NUM[saved.topicLevel]
  const ctrlRows = saved.rows.filter((r) => r.cond === 'CTRL' && r.ok)
  const ctrlItems = ctrlRows.flatMap((r) => r.items ?? [])
  const ctrlSingle = ctrlItems.filter((t) => t.dict.how !== 'none' && t.dict.levels.length === 1)
  const ctrlStats = condStats(saved.rows, CONDS.find((c) => c.key === 'CTRL') as Cond, saved.topicLevel)
  return CONDS.filter((c) => c.key !== 'CTRL').map((c) => {
    const chalN = LEVEL_NUM[c.level]
    const mine = condStats(saved.rows, c, saved.topicLevel)
    const base = ctrlSingle.filter((t) => direction(t.dict.levels[0], chalN, topicN) === 'toChallenge').length
    const baselinePct = round((base / Math.max(1, ctrlSingle.length)) * 100)
    const nowPct = mine.dictAll.directionMatchPct
    return {
      cond: c.key,
      expectedMeanDictNShift: chalN - topicN,
      meanDictNShiftVsCtrl: round((mine.dictAll.meanDictN ?? NaN) - (ctrlStats.dictAll.meanDictN ?? NaN), 2),
      meanLabelNShiftVsCtrl: round((mine.meanLabelN ?? NaN) - (ctrlStats.meanLabelN ?? NaN), 2),
      directionMatchPct: nowPct,
      directionBaselineCtrlPct: baselinePct,
      directionLiftPp: nowPct === null ? null : round(nowPct - baselinePct),
      basis: { cond: mine.dictAll.directionMatchBasis, ctrl: ctrlSingle.length },
      keptMeanPctOfTarget: mine.keptMeanPctOfTarget,
      ctrlKeptMeanPctOfTarget: ctrlStats.keptMeanPctOfTarget,
    }
  })
}

/** 최근접 순위 분위수. 표본이 25 이하라 p95 는 사실상 최댓값 근처다 — 판정표에는 max 도 함께 쓴다. */
function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]
}

/**
 * Leader L1~L3 판정(task-078). 데이터가 없는 조건은 `null`(미측정)로 두고 합격/불합격을 지어내지 않는다.
 *  L1 N2 세트 평균 `min(통과, 목표)` ≥ 8.0장 · L2 N3 방향 일치율 − 진단 기준선 22.7% ≥ +15%p(보조: 6세트·사전 매칭 ~50%) ·
 *  L3 N5·대조 평균 ≥ 9.0장 · jlpt null 로 통과한 비율 ≤ 10% · 지연 p95 ≤ 12초 · 1차 ajv(= CLI 재시도 0, 실패 0).
 */
function gate(saved: Saved) {
  const byKey = (k: CondKey) => condStats(saved.rows, CONDS.find((c) => c.key === k) as Cond, saved.topicLevel)
  const n2 = byKey('N2')
  const n3 = byKey('N3')
  const n5 = byKey('N5')
  const ctrl = byKey('CTRL')
  const okRows = saved.rows.filter((r) => r.ok)
  const keptItems = okRows.flatMap((r) => (r.items ?? []).filter((t) => t.status === 'KEPT'))
  const nullKept = keptItems.filter((t) => t.jlptRaw === 'null' || t.jlptRaw === '"null"' || t.jlptRaw === 'undefined').length
  const elapsed = okRows.map((r) => r.elapsedMs)
  const retried = okRows.filter((r) => (r.attempts ?? 1) > 1).length
  const failed = saved.rows.length - okRows.length
  const fin = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x)
  const vs = vsCtrl(saved)
  const n3dir = n3.ok > 0 ? n3.dictAll.directionMatchPct : null
  const n3lift = fin(n3dir) ? round(n3dir - DIAG_BASELINE_PCT.N3) : null
  const n2dir = n2.ok > 0 ? n2.dictAll.directionMatchPct : null
  const stdev = (xs: number[]) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : NaN }
  return {
    arm: saved.arm ?? 'base',
    calls: { logical: saved.rows.length, ok: okRows.length, failed, cliAttemptsOk: okRows.reduce((n, r) => n + (r.attempts ?? 1), 0), retried },
    L1: n2.ok === 0 ? null : { n2Sets: n2.ok, perSet: n2.keptPerCall, mean: n2.keptMean, sd: round(stdev(n2.keptPerCall), 2), min: Math.min(...n2.keptPerCall), pass: n2.keptMean >= 8.0, complete: n2.ok >= 10 },
    L2: n3.ok === 0 ? null : { n3Sets: n3.ok, directionMatchPct: n3dir, diagBaselinePct: DIAG_BASELINE_PCT.N3, liftPp: n3lift, pass: fin(n3lift) ? n3lift >= 15 : null, basisWords: n3.dictAll.directionMatchBasis, dictMatchRatePct: n3.dictAll.matchRatePct, liftVsNewCtrlPp: vs.find((v) => v.cond === 'N3')?.directionLiftPp ?? null, note: '보조(방향 확인) — 표본 6세트·사전 매칭 ~50%' },
    L3: {
      n5Mean: n5.ok === 0 ? null : n5.keptMean,
      ctrlMean: ctrl.ok === 0 ? null : ctrl.keptMean,
      n5Pass: n5.ok === 0 ? null : n5.keptMean >= 9.0,
      ctrlPass: ctrl.ok === 0 ? null : ctrl.keptMean >= 9.0,
      keptWords: keptItems.length,
      nullPassWords: nullKept,
      nullPassPct: pctOf(nullKept, keptItems.length),
      nullPass: pctOf(nullKept, keptItems.length) <= 10,
      latencyMs: { n: elapsed.length, p50: quantile(elapsed, 0.5), p95: quantile(elapsed, 0.95), max: elapsed.length ? Math.max(...elapsed) : NaN },
      latencyPass: elapsed.length ? quantile(elapsed, 0.95) <= 12_000 : null,
      ajvFirstPass: { retried, failed, pass: retried === 0 && failed === 0 },
    },
    // 급수 부풀리기 점검(N2): 통과가 늘었는데 통과 단어의 사전 급수가 여전히 쉬우면 라벨만 올린 것이다.
    inflationCheckN2: n2.ok === 0 ? null : {
      dictMatchRatePct: n2.dictAll.matchRatePct,
      dictKeptLevelDist: n2.dictKept.dictLevelDist,
      dictKeptMeanN: n2.dictKept.meanDictN,
      dictAllMeanN: n2.dictAll.meanDictN,
      directionMatchPct: n2dir,
      diagBaselinePct: DIAG_BASELINE_PCT.N2,
      directionLiftPp: fin(n2dir) ? round(n2dir - DIAG_BASELINE_PCT.N2) : null,
      labelVsDict: n2.labelVsDictAll,
      modelLabelDist: n2.jlptLabelAllPct,
      keptLabelDist: n2.jlptLabelKept,
      droppedByReason: n2.droppedByReason,
      phraseLikePct: n2.phraseLikePct,
    },
  }
}

function summarize(saved: Saved) {
  return saved.rows.length === 0 ? { conds: [], vsCtrl: [], gate: null } : { conds: CONDS.map((c) => condStats(saved.rows, c, saved.topicLevel)), vsCtrl: vsCtrl(saved), gate: gate(saved) }
}

type DictS = ReturnType<typeof dictStats>
function fmtDict(d: DictS): string {
  const dir = typeof d.direction === 'string' ? d.direction : JSON.stringify(d.direction)
  return `n=${d.n} 매칭 ${d.matched}(${d.matchRatePct}%, 표기그대로 ${d.matchRateExactPct}%, ${JSON.stringify(d.byHow)}) 애매 ${d.ambiguousMultiLevel} 급수분포 ${JSON.stringify(d.dictLevelDist)} 평균N ${d.meanDictN} 방향 ${dir}${d.directionMatchPct === null ? '' : ` 일치 ${d.directionMatchPct}%(기준 ${d.directionMatchBasis})`}`
}

function printCompact(stats: ReturnType<typeof condStats>[]) {
  for (const s of stats) {
    console.log(`\n── ${s.cond} (챌린지 ${s.challengeLevel}, 주제 ${s.topicLevel}, 창 ${s.window.join('·')}) 호출 ${s.calls} 성공 ${s.ok} 실패 ${s.failed}`)
    console.log(`  통과 장수/호출(목표로 자름) ${JSON.stringify(s.keptPerCall)} (자르기 전 ${JSON.stringify(s.keptRawPerCall)}) 평균 ${s.keptMean}(목표의 ${s.keptMeanPctOfTarget}%) 목표 이상 ${s.callsKeptGeTarget} · 창을 껐다면 ${JSON.stringify(s.keptIfWindowOffPerCall)} 평균 ${s.keptIfWindowOffMean}`)
    console.log(`  받은 항목 ${s.received} · droppedByReason ${JSON.stringify(s.droppedByReason)} · outcome ${JSON.stringify(s.outcomes)}`)
    console.log(`  모델 jlpt 분포 전체 ${JSON.stringify(s.jlptLabelAll)} · 통과 ${JSON.stringify(s.jlptLabelKept)} · JLPT_WINDOW 탈락 ${JSON.stringify(s.jlptLabelDroppedByWindow)} · jlpt null/"null" 인데 통과 ${s.keptWithNullJlptLabel}`)
    console.log(`  사전(전체)        ${fmtDict(s.dictAll)}`)
    console.log(`  사전(통과)        ${fmtDict(s.dictKept)}`)
    console.log(`  사전(창 탈락)     ${fmtDict(s.dictDroppedByWindow)}`)
    console.log(`  사전(그 밖 탈락)  ${fmtDict(s.dictDroppedOther)}`)
    console.log(`  모델 급수 vs 사전 급수 ${JSON.stringify(s.labelVsDictAll)}`)
    console.log(`  모델 jlpt 분포(%) ${JSON.stringify(s.jlptLabelAllPct)} 평균 급수 N${s.meanLabelN} · 표기 평균 길이 ${s.meanSurfaceLen}자 · 구(句)모양 ${s.phraseLikePct}%`)
    console.log(`  세트별(variant→통과/창 껐다면) ${s.perSet.map((x) => `v${x.variant}:${x.kept}/${x.windowOff}`).join(' ')}`)
    console.log(`  CLI 시도 합 ${s.attemptsSum} · 성공 호출 평균 ${s.elapsedOkMeanMs}ms`)
  }
}

function printItems(saved: Saved) {
  for (const c of CONDS) {
    for (const r of saved.rows.filter((x) => x.cond === c.key && x.ok)) {
      console.log(`\n### ${r.id} [수준 ${r.level}] kept ${r.keptCount}/${r.target} (창 끈 반사실 ${r.keptIfWindowOff}) ${r.outcome?.source}/${r.outcome?.reason ?? '-'}  ${r.elapsedMs}ms a=${r.attempts}`)
      for (const t of r.items ?? []) {
        const d = t.dict.how === 'none' ? '사전-' : `사전N${t.dict.levels.join('/')}${t.dict.how === 'exact' ? '' : `(${t.dict.how[0]}:${t.dict.via})`}`
        console.log(`  ${String(t.i + 1).padStart(2)} ${t.status.padEnd(13)} jlpt=${t.jlptRaw.padEnd(6)} ${d.padEnd(16)} ${t.textJa} (${t.reading}) ${t.meaningKo}`)
      }
    }
  }
}

function report(saved: Saved, withItems: boolean) {
  const used = saved.rows.length
  const attempts = saved.rows.reduce((n, r) => n + (r.ok ? (r.attempts ?? 1) : 1), 0)
  console.log(`\n## 요약 (${saved.version}${saved.arm === 'v3' ? ' + 변형 v3' : ''}, 주제 ${saved.topic}(${saved.topicLevel}), 목표 ${saved.target}장 → 요청 ${topicWordsRequestCount(saved.target)}, 시작 ${saved.startedAt}${saved.stopped ? `, 중단: ${saved.stopped}` : ''})`)
  console.log(saved.startedAt === 'DRY' ? `(DRY 합성 행 ${used}개 — 라이브 호출 0회)` : `라이브 호출 ${used}/${saved.maxCalls}회(실패 포함 논리 호출, CLI 시도 합 ≥${attempts})`)
  const sum = summarize(saved)
  printCompact(sum.conds)
  console.log('\n## 대조(CTRL) 대비 — 평균 사전 급수 이동·방향 일치율 이동분(대조 단어에 같은 판정식을 적용한 기준선을 뺀 값)')
  for (const v of sum.vsCtrl) console.log(`  ${v.cond}: 통과 ${v.keptMeanPctOfTarget}%(대조 ${v.ctrlKeptMeanPctOfTarget}%) · 평균 사전 N 이동 ${v.meanDictNShiftVsCtrl}(완전 이동이면 ${v.expectedMeanDictNShift}) · 모델 급수 평균 이동 ${v.meanLabelNShiftVsCtrl} · 방향 일치 ${v.directionMatchPct}% − 기준선 ${v.directionBaselineCtrlPct}% = 이동분 ${v.directionLiftPp}%p (기준 단어 ${v.basis.cond}/대조 ${v.basis.ctrl})`)
  if (sum.gate) {
    console.log('\n## 판정(L1~L3, 미측정은 null)')
    console.log(JSON.stringify(sum.gate, null, 1))
  }
  if (withItems) printItems(saved)
}

function save(rows: Row[], startedAt: string, topic: FxTopic, stopped?: string) {
  mkdirSync(dirname(OUT), { recursive: true })
  const out: Saved = { startedAt, version: TOPIC_WORDS_PROMPT_VERSION, arm: ARM, topic: topic.key, topicLevel: topic.level, target: TARGET, maxCalls: MAX_CALLS, rows, ...(stopped ? { stopped } : {}) }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  writeFileSync(OUT.replace(/\.json$/, '') + '.summary.json', JSON.stringify(summarize(out), null, 1))
}

// ── DRY: 호출 없이 계획·프롬프트 길이·분석기 자체 점검 ──────────────────────────────────────────
function dry(topic: FxTopic) {
  const info = loadDict()
  console.log(`## DRY — 호출 0회. 사전 ${JSON.stringify(info)}`)
  console.log(`주제 ${topic.key} (${topic.level}) · 기본 표현 ${topic.chunks.length}개 · 제외 ${topic.chunks.map((c) => c.textJa).join(', ')}`)
  const plan = buildPlan()
  console.log(`계획(${PLAN_KIND}) ${plan.length}회(상한 ${MAX_CALLS}): ${plan.map((p) => p.id).join(' ')}`)
  const perCond: Count = {}
  for (const p of plan) inc(perCond, p.cond)
  console.log(`조건별 ${JSON.stringify(perCond)}`)
  for (const c of CONDS) {
    const p: Planned = { id: `${c.key}-dry`, cond: c.key, level: c.level, variant: 0 }
    const { input } = buildInput(p, topic)
    const req = buildTopicWordsRequest(input)
    const user = req.messages[0]?.content ?? ''
    console.log(`\n[${c.key}] system ${req.system.length}자 + user ${user.length}자 · [수준] 줄: ${user.split('\n').find((l) => l.startsWith('[수준]'))}`)
  }
  const diffN2N4 = (() => {
    const a = buildTopicWordsRequest(buildInput({ id: 'a', cond: 'N2', level: 'N2', variant: 0 }, topic).input).messages[0]?.content ?? ''
    const b = buildTopicWordsRequest(buildInput({ id: 'b', cond: 'CTRL', level: 'N4', variant: 0 }, topic).input).messages[0]?.content ?? ''
    return a.split('\n').filter((l, i) => l !== b.split('\n')[i])
  })()
  console.log(`\nN2 vs 대조 입력의 다른 줄: ${JSON.stringify(diffN2N4)} (system 은 모든 조건에서 같다)`)

  // 변형 v3 점검 — 치환 앵커 3곳이 운영 문구와 일치하는지, 길이가 얼마나 늘었는지, 운영이 이미 변형을 갖고 있는지.
  const baseSys = buildTopicWordsRequest(buildInput({ id: 'x', cond: 'N2', level: 'N2', variant: 0 }, topic).input).system
  const adopted = VARIANT_EDITS.every((e) => baseSys.includes(e.to))
  const v3Sys = applyVariant(baseSys)
  console.log(`\n## 변형 v3 점검 — ARM=${ARM} · 운영 system ${baseSys.length}자 · 변형 적용 후 ${v3Sys.length}자(${v3Sys.length - baseSys.length >= 0 ? '+' : ''}${v3Sys.length - baseSys.length}자) · ${adopted ? '운영이 이미 변형 문구를 갖고 있다(반영 후) — 운영 = 변형' : '운영은 아직 변형 전 문구'}`)
  if (!adopted) {
    for (const e of VARIANT_EDITS) console.log(`  앵커 ${e.id}: 운영에 ${baseSys.split(e.from).length - 1}번 · from ${[...e.from].length}자 → to ${[...e.to].length}자`)
  }
  const baseLines = baseSys.split('\n')
  const v3Lines = v3Sys.split('\n')
  console.log(`  줄 수 ${baseLines.length} → ${v3Lines.length} · 달라진 줄:`)
  v3Lines.forEach((l, i) => { if (!baseLines.includes(l)) console.log(`    [v3 ${i + 1}] ${l}`) })
  if (process.env.SHOW_SYSTEM === '1') console.log(`\n--- v3 system 전문 ---\n${v3Sys}\n--- 끝 ---`)

  // 분석기 자체 점검 — 픽스처의 합성 응답(합성 입력만)으로 가짜 행을 만들어 같은 경로를 태운다.
  console.log('\n## 분석기 자체 점검(합성 응답, 호출 없음)')
  const syn = fixture.responses.filter((r) => r.topic === 'cafe-order' || r.topic === 'weekend-plan').slice(0, 3)
  const rows: Row[] = []
  syn.forEach((s, i) => {
    const c = CONDS[i % CONDS.length]
    const p: Planned = { id: `dry-${c.key}-${s.id}`, cond: c.key, level: c.level, variant: 0 }
    const { exclude, excludeMeanings } = buildInput(p, topic)
    const data = s.response as TopicWordsResponse
    if (!Array.isArray((data as { words?: unknown }).words)) return
    rows.push({ ...makeBase(p, topic), ok: true, elapsedMs: 0, attempts: 1, ...analyze(makeBase(p, topic), data, exclude, excludeMeanings) })
  })
  report({ startedAt: 'DRY', version: TOPIC_WORDS_PROMPT_VERSION, topic: topic.key, topicLevel: topic.level, target: TARGET, maxCalls: MAX_CALLS, rows }, true)
  // 사전 되돌리기 규칙 점검
  const probes = ['飲みます', '食べます', '行きます', '見に行きます', 'おいしいです', '楽しみです', '疲れました', 'ひまです', '勉強します', '週末', 'たぶん', '家でゆっくりします', '久しぶりに', '会う予定です']
  console.log('\n## 사전 대조 점검')
  for (const t of probes) {
    const h = lookupDict(t)
    console.log(`  ${t.padEnd(10)} → ${h.how === 'none' ? '없음' : `N${h.levels.join('/')} (${h.how}${h.via && h.via !== t ? ` ← ${h.via}` : ''})`}`)
  }
}

async function main() {
  const topics = new Map(fixture.topics.map((t) => [t.key, t]))
  const topic = topics.get(TOPIC_KEY)
  if (!topic) throw new Error(`픽스처에 주제 ${TOPIC_KEY} 없음`)
  if (topic.level !== 'N4') console.log(`주의: 주제 수준이 N4 가 아니다(${topic.level}) — 조건표는 N4 기준이다.`)
  loadDict()
  if (process.env.DRY === '1') { dry(topic); return }
  if (process.env.DUMP === '1') {
    const saved = JSON.parse(readFileSync(OUT, 'utf8')) as Saved
    report(saved, true)
    writeFileSync(OUT.replace(/\.json$/, '') + '.summary.json', JSON.stringify(summarize(saved), null, 1)) // 저장된 요약을 현재 집계식으로 갱신
    return
  }
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  if (process.env.RESUME === '1' && existsSync(OUT)) rows.push(...(JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows)
  const done = new Set(rows.map((r) => r.id)) // 실패한 행도 호출 1회를 쓴 것이라 다시 부르지 않는다(상한 15 는 시험 호출 포함).
  let stopped: string | undefined
  let immediateFails = 0
  for (const p of buildPlan()) {
    if (done.has(p.id)) continue
    if (rows.length >= MAX_CALLS) { stopped = `호출 상한 ${MAX_CALLS}회 도달(${p.id} 부터 미실행)`; break }
    const row = await runCall(p, topic)
    rows.push(row)
    save(rows, startedAt, topic)
    console.log(row.ok
      ? `${p.id}\t[${p.level}]\t${row.elapsedMs}ms\ta=${row.attempts}\tpc=${row.promptChars}\trecv=${row.received}\tkept=${row.keptCount}/${row.target}\twindowOff=${row.keptIfWindowOff}\t${row.outcome?.source}/${row.outcome?.reason ?? '-'}\tdrops=${JSON.stringify(row.droppedByReason)}`
      : `${p.id}\tFAIL ${row.elapsedMs}ms ${row.errorName}: ${row.error}`)
    if (row.limitHit) { stopped = `한도·429 문구 감지(${p.id})`; break }
    immediateFails = !row.ok && !row.timeout && row.elapsedMs < IMMEDIATE_FAIL_MS ? immediateFails + 1 : 0
    if (immediateFails >= 2) { stopped = `즉시 실패 2연속(${p.id})`; break }
    await sleep(GAP_MS)
  }
  if (stopped) { save(rows, startedAt, topic, stopped); console.log(`BLOCKED: ${stopped} — 여기서 멈춘다(추정 없음).`) }
  report({ startedAt, version: TOPIC_WORDS_PROMPT_VERSION, arm: ARM, topic: topic.key, topicLevel: topic.level, target: TARGET, maxCalls: MAX_CALLS, rows, ...(stopped ? { stopped } : {}) }, true)
  console.log(`\n결과 파일: ${OUT}`)
}

// import 만으로는 실행하지 않는다 — task-078 개선 단계에서 `node -e "import('…/topic-words-level-live.ts')"` 로 `VARIANT_EDITS` 를 보려다 DRY 없이 **라이브 호출 2회가 나간** 사고가 있었다(예산 초과).
// 직접 실행(`node … tests/prompts/topic-words-level-live.ts`)일 때만 `main()` 을 돈다. 상수·`applyVariant` 를 다른 파일에서 쓰려면 import 해도 안전하다.
if ((process.argv[1] ?? '').endsWith('topic-words-level-live.ts')) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e)
      process.exit(1)
    },
  )
}
