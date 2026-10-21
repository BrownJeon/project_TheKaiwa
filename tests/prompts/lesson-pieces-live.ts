/**
 * task-081 PE 2단계 — 오늘의 회화 «조각(pieces)» 라이브 측정 하네스(lesson@v10 · lessonScenario@v2 · reviewMix@v4). **1단계에서는 실행하지 않는다**(DRY 만) — 사용자의 호출 예산 승인 뒤 2단계 지시로 돈다.
 *
 * 무엇을 재나 — screens.md 37-12-4·37-16 의 «생성 시간·크기·`piecesNullLines` 비율»:
 *  ① 지연: 생성 호출 경과(`completeJson` 한 번 = 재시도 포함) 중앙값·최대, 1차 성공 호출만의 중앙값 / 120초 잡 예산 초과 여부
 *  ② 크기: 응답 JSON 글자 수(최종 정리 후)·그중 pieces 몫 / 프롬프트 글자 수
 *  ③ 계약: 재시도율(`attempts=2`)·재시도 원인(규칙·경로만 — `[json] 1차 응답 계약 위반` 로그)·최종 실패(던짐)·마지막 시도 면책(조각 위반 줄을 null 로 저장) 횟수
 *  ④ 조각 품질(결정적): 줄 단위 null 비율 `piecesNullLines/piecesTotal`·null 이유별(`join_mismatch` 등)·`koNoHangul`·종류 분포·구간(slash) 수·조각 수/줄·ko 길이
 *  ⑤ 조각 품질(휴리스틱 플래그 — 게이트 아님, 사람이 볼 곳을 좁힌다): 조사가 LINK 가 아님·です/ます 분리·활용 어미 분리·긴 EXPRESSION·구간 없음/과다·긴 ko
 *  ⑥ **눈가림 판정 표**(`SHEET=1`): 줄을 무작위로 뽑아 조 이름 없이 «원문·조각·종류·뜻» 만 보여 주고 Leader 가 «맞음/어색/틀림» 을 채운다 → `SCORE=1` 이 집계한다.
 *
 * ── 입력 세트(PLAN=core 12회) ─────────────────────────────────────────────────────────────
 *  주제 8: 시드 5종 원래 수준(self-intro N5·cafe-order N5·ask-directions N5·weekend-plan N4·travel-story N4) + 수준 올림 3(travel-story→N3·weekend-plan→N2·cafe-order→N3 — 줄이 길고 활용·복합 문형이 늘어난다)
 *  상황 1(cafe-order 주제 + «카페에서 주문 바꾸기» 상황, N5 → `lessonScenario@v2`) · 붙여넣기 1(sourceText, N4) · 복습 2(`reviewMix@v4` 6항목·10항목).
 *  PLAN=extra 6회: 같은 입력 되풀이(self-intro·weekend-plan·travel-story·ask-directions·복습 6·상황) — core 결과가 경계(지연·재시도)에 걸릴 때만 추가한다.
 *  **PLAN=r2 6회(PE 3단계 재측정)**: 지침 보정(`piecesInstruction.ts`) 뒤 «어색이 몰렸던 주제» 를 core 와 겹치지 않는 (주제, 수준) 조합으로 — self-intro N4·N3 · cafe-order N4 · travel-story N5·N2 · ask-directions N4. 복습·상황·붙여넣기는 지침 줄이 같은 바이트라 다시 부르지 않는다(시험이 고정).
 *  **PLAN=reg 3회(PE 회귀 확인)**: core 의 `R-6`(복습 6항목 — `reviewMix@v4`)·`S-cafe-order-N5`(상황 — `lessonScenario@v2`)·`SRC-paste-N4`(붙여넣기 sourceText) 와 **같은 입력·같은 id** 를 보정된 지침(`piecesInstruction.ts`, CAP 10,300)으로 다시 부른다 —
 *  r2 는 주제 수업만이라 복습·상황·붙여넣기 경로는 보정 지침으로 라이브 확인이 없었다. 결과 라벨 기본 `v10r2`. 호출 상한 `KIND_CAP.reg = 3`(`HARD_CAP` 불변). 가드 4겹 그대로.
 *  `COMPARE=1 CORE_FILE=<core.json> OUT=<r2.json>`: 두 결과를 같은 정의(현재 분석기)로 나란히 계산한다(호출 0). `PLAN=reg` 이면 core 쪽을 **reg 와 같은 id 만** 걸러 비교하고 id 별 표(`byId`)도 낸다.
 *  학습자 헤더는 단위 시험과 같은 고정값(브라운·유우·N4 등 — 레벨만 행에 맞춤). 운영 DB·Trace·사용자 데이터 접촉 0.
 *
 * ── 호출 경로·가드 ────────────────────────────────────────────────────────────────────────
 *  운영과 같다: `buildLessonRequest`/`buildReviewMixRequest` → `llm.completeJson`(task=lesson/reviewMix: balanced·120초·batch — `engine/router/tasks.ts`, 덮어쓰지 않음). 연결은 시드 모양 고정(`claude-cli-local`).
 *  한계: DB·Trace·큐 경합 없음, 잡 러너의 120초 벽시계 없음(단 `completeJson` 자체 120초 타임아웃은 있음).
 *  **호출 초과 사고 방지 4겹**: ① `main()` 은 직접 실행일 때만(import 부작용 호출 0 — task-078 사고 교훈) ② 실제 호출은 `LIVE_OK=task-081` 이 있어야 하고 없으면 계획만 출력하고 끝 ③ `MAX_CALLS`(core 12·extra 6) 와 절대 상한 `HARD_CAP`(20)을
 *  OUT 에 남은 행(실패 포함)까지 세어 넘기지 않음 ④ 호출 원장 `calls.json`(OUT 옆, 호출 전에 «시작» 줄을 먼저 쓴다) — 프로세스가 죽어도 몇 번 불렀는지 남는다. 429·한도 문구·즉시 실패(5초 안 비타임아웃 오류) 2연속이면 멈춘다. 직렬·호출 간격 ≥1.5초.
 *
 * ── 실행(전용 미러, 한 번에 하나) ──────────────────────────────────────────────────────────
 *  점검(호출 0)  : cd ~/.node-local/thekaiwa-pe081 && DRY=1 node --env-file=.env --import tsx tests/prompts/lesson-pieces-live.ts
 *  라이브        : LIVE_OK=task-081 PLAN=core OUT=<결과.json> node --env-file=.env --import tsx tests/prompts/lesson-pieces-live.ts
 *  요약만        : DUMP=1 OUT=<결과.json> …                (OUT 만 읽음, 호출 0)
 *  눈가림 표     : SHEET=1 SHEET_FROM=<a.json[,b.json]> SHEET_N=40 SEED=81 OUT=<표 접두> …  → <접두>.sheet.md(+.key.json)
 *  표 집계       : SCORE=1 VERDICTS=<판정.json> KEY=<.key.json> …  (판정.json = {"S01":"맞음","S02":"어색",…})
 *  환경: OUT · PLAN=core|extra · MAX_CALLS · GAP_MS · RESUME=1 · PIECES_FILE(조각 지침 줄을 이 파일 내용으로 대체 — 변형 시험, 운영 파일 불변) · ARM(결과 라벨)
 *
 * ── 합격선(사전 등록 — 측정 전에 이력서에 고정, 숫자는 `GATE` 상수) ─────────────────────────────
 *  G1 지연: 1차 성공 호출의 중앙값 ≤ 60초 · 전체 최대 ≤ 100초 · 120초 초과 0 (v9 운영 Trace 기준선: lessonGen LLM 단계 n=11 중앙값 42.6초·최대 70.3초, reviewGen n=2 39.9~44.3초)
 *  G2 재시도율 ≤ 17%(12회 중 2) · 최종 실패(던짐) 0
 *  G3 조각 null 줄 비율(전체 풀링) ≤ 10% · 마지막 시도 면책 0건 · 1차에서 조각 임계(절반 초과)로 재시도한 호출 ≤ 1건
 *  G4 koNoHangul ≤ 3%(type 있는 조각 대비)
 *  G5 휴리스틱 플래그: 조사가 LINK 가 아닌 조각 ≤ 3%(조사 조각 대비) · です/ます·어미 분리 줄 ≤ 5%(줄 대비)
 *  G6 눈가림(Leader): 표본 ≥ 40줄에서 «틀림» ≤ 5% · «맞음» ≥ 70% · «맞음+어색» ≥ 92%
 *  G1~G5 는 이 하네스가 판정하고 G6 은 `SCORE=1` 이 판정한다. 하나라도 실패하면 프롬프트 지침 줄을 고치거나(변형 → PIECES_FILE 로 재측정) 에스컬레이션한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildLessonRequest, type LessonRequest, type LessonScenarioInput, type LessonTopicInput } from '../../src/modules/conversation/prompts/lesson'
import { buildReviewMixRequest, type ReviewMixItemInput, type ReviewMixRequest } from '../../src/modules/conversation/prompts/reviewMix'
import { PIECES_INSTRUCTION_LINE } from '../../src/modules/conversation/prompts/piecesInstruction'
import type { JlptLevel, LessonResponse } from '../../src/modules/conversation/structuredResponse/schemas'

// ── 설정 ─────────────────────────────────────────────────────────────────────────────────
export const HARD_CAP = 20
type PlanKind = 'core' | 'extra' | 'r2' | 'reg'
const PLAN_KIND: PlanKind = process.env.PLAN === 'extra' ? 'extra' : process.env.PLAN === 'r2' ? 'r2' : process.env.PLAN === 'reg' ? 'reg' : 'core'
/** 계획별 호출 상한(기본값이자 천장) — 환경의 `MAX_CALLS` 가 이보다 커도 이 값을 넘기지 않는다. */
export const KIND_CAP: Record<PlanKind, number> = { core: 12, extra: 6, r2: 6, reg: 3 }
const MAX_CALLS = Math.min(HARD_CAP, KIND_CAP[PLAN_KIND], Number(process.env.MAX_CALLS ?? KIND_CAP[PLAN_KIND]))
const GAP_MS = Math.max(1500, Number(process.env.GAP_MS ?? 1500))
const OUT = process.env.OUT ?? join(tmpdir(), 'thekaiwa-pe081', `task081-pieces-${PLAN_KIND}.json`)
const ARM = process.env.ARM ?? (PLAN_KIND === 'reg' ? 'v10r2' : 'v10')
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const IMMEDIATE_FAIL_MS = 5_000
const JOB_BUDGET_MS = 120_000

/** 합격선(사전 등록) — 값을 바꾸면 이력서 기록과 어긋나므로 측정 뒤에는 고치지 않는다. */
export const GATE = {
  g1MedianSingleMs: 60_000,
  g1MaxMs: 100_000,
  g2RetryRate: 2 / 12,
  g3NullLineRate: 0.10,
  g3FirstAttemptThresholdMax: 1,
  g4KoNoHangulRate: 0.03,
  g5ParticleNotLinkRate: 0.03,
  g5SplitLineRate: 0.05,
  g6Wrong: 0.05,
  g6Right: 0.70,
  g6RightOrAwkward: 0.92,
  g6MinSample: 40,
} as const

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

// ── 입력 ─────────────────────────────────────────────────────────────────────────────────
interface SeedTopic { key: string; title: string; titleJa: string; level: JlptLevel; chunks: { chunkType: 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER'; textJa: string; reading: string; meaningKo: string }[] }
const root = process.cwd()
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), 'utf8')) as T
const SEEDS = (): SeedTopic[] => readJson<SeedTopic[]>('prisma/seed-data/topics.json')
const LESSON_FX = () => readJson<{ sourceText: string }>('tests/prompts/fixtures/lesson.json')
const REVIEW_FX = () => readJson<{ items: ReviewMixItemInput[]; mixNoteKo: string }>('tests/prompts/fixtures/review-mix.json')

const SCENARIO: LessonScenarioInput = {
  title: '카페에서 주문 바꾸기',
  titleJa: 'カフェで注文を変える',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '주문한 음료의 사이즈와 온도를 바꿔 다시 주문한다',
  steps: [{ ko: '인사하고 음료 말하기' }, { ko: '사이즈 바꾸기' }, { ko: '뜨겁게 또는 차갑게 바꾸기' }, { ko: '포장 여부 답하기' }, { ko: '계산하고 인사하기' }],
  expressions: [
    { ja: 'サイズを変えてください', ko: '사이즈를 바꿔 주세요' },
    { ja: 'ホットにしてください', ko: '따뜻한 걸로 해 주세요' },
    { ja: '持ち帰りでお願いします', ko: '포장으로 부탁해요' },
  ],
}

type Kind = 'TOPIC' | 'SCENARIO' | 'SOURCE' | 'REVIEW'
export interface Planned { id: string; kind: Kind; level: JlptLevel; topicKey?: string; reviewItems?: 6 | 10 }

export function buildPlan(kind: PlanKind = PLAN_KIND): Planned[] {
  const T = (topicKey: string, level: JlptLevel, suffix = ''): Planned => ({ id: `T-${topicKey}-${level}${suffix}`, kind: 'TOPIC', level, topicKey })
  if (kind === 'reg') {
    // core 의 R-6·S-cafe-order-N5·SRC-paste-N4 와 «같은 입력·같은 id» — 객체까지 같게 core 에서 그대로 집는다(복제 오차 방지).
    const ids = ['R-6', 'S-cafe-order-N5', 'SRC-paste-N4']
    const core = buildPlan('core')
    return ids.map((id) => {
      const found = core.find((p) => p.id === id)
      if (!found) throw new Error(`core 계획에 ${id} 가 없다`)
      return { ...found }
    })
  }
  if (kind === 'r2') {
    return [T('self-intro', 'N4'), T('cafe-order', 'N4'), T('travel-story', 'N5'), T('self-intro', 'N3'), T('travel-story', 'N2'), T('ask-directions', 'N4')]
  }
  if (kind === 'extra') {
    return [T('self-intro', 'N5', '#2'), T('weekend-plan', 'N4', '#2'), T('travel-story', 'N4', '#2'), T('ask-directions', 'N5', '#2'),
      { id: 'R-6#2', kind: 'REVIEW', level: 'N4', reviewItems: 6 }, { id: 'S-cafe-order-N5#2', kind: 'SCENARIO', level: 'N5', topicKey: 'cafe-order' }]
  }
  return [
    T('self-intro', 'N5'), T('cafe-order', 'N5'), T('ask-directions', 'N5'), T('weekend-plan', 'N4'), T('travel-story', 'N4'),
    T('travel-story', 'N3'), T('weekend-plan', 'N2'), T('cafe-order', 'N3'),
    { id: 'S-cafe-order-N5', kind: 'SCENARIO', level: 'N5', topicKey: 'cafe-order' },
    { id: 'SRC-paste-N4', kind: 'SOURCE', level: 'N4' },
    { id: 'R-6', kind: 'REVIEW', level: 'N4', reviewItems: 6 },
    { id: 'R-10', kind: 'REVIEW', level: 'N4', reviewItems: 10 },
  ]
}

const LEARNER = (level: string) => ({ displayName: '브라운', teacherName: '유우', level, weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 })

/** 조각 지침 줄 대체(변형 시험) — 운영 파일은 그대로, 요청의 system 에서 그 줄만 바꾼다. 줄이 정확히 한 번 나오지 않으면 던진다(운영 프롬프트가 바뀐 것). */
export function applyPiecesOverride(system: string, replacement: string | null): string {
  if (replacement === null) return system
  const n = system.split(PIECES_INSTRUCTION_LINE).length - 1
  if (n !== 1) throw new Error(`조각 지침 줄이 system 에 ${n}번 나온다(1번이어야 함) — 운영 프롬프트가 바뀌었다`)
  return system.replace(PIECES_INSTRUCTION_LINE, replacement.trim())
}

export function buildRequest(p: Planned, override: string | null = null): LessonRequest | ReviewMixRequest {
  const todayKst = '2026-10-21'
  if (p.kind === 'REVIEW') {
    const fx = REVIEW_FX()
    let items = fx.items
    if (p.reviewItems === 10) {
      const extra = (SEEDS().find((t) => t.key === 'travel-story')?.chunks ?? []).slice(0, 4).map<ReviewMixItemInput>((c, i) => ({ id: `rep-${7 + i}`, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo }))
      items = [...fx.items, ...extra]
    }
    const req = buildReviewMixRequest({ todayKst, learner: LEARNER(p.level), level: p.level, items, mixNoteKo: fx.mixNoteKo })
    return { ...req, system: applyPiecesOverride(req.system, override) }
  }
  if (p.kind === 'SOURCE') {
    const req = buildLessonRequest({ todayKst, learner: LEARNER(p.level), sourceText: LESSON_FX().sourceText })
    return { ...req, system: applyPiecesOverride(req.system, override) }
  }
  const seed = SEEDS().find((t) => t.key === p.topicKey)
  if (!seed) throw new Error(`시드 주제 ${p.topicKey} 없음`)
  const topic: LessonTopicInput = { title: seed.title, titleJa: seed.titleJa, level: p.level, chunks: seed.chunks.map((c, i) => ({ id: `${seed.key}-${String(i + 1).padStart(2, '0')}`, ...c })) }
  const req = buildLessonRequest({ todayKst, learner: LEARNER(p.level), topic, ...(p.kind === 'SCENARIO' ? { scenario: SCENARIO } : {}) })
  return { ...req, system: applyPiecesOverride(req.system, override) }
}

// ── 분석(순수 함수 — DRY 가 합성 응답으로 점검) ────────────────────────────────────────────
const PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'の', 'へ', 'も', 'から', 'まで', 'か', 'ね', 'よ', 'や', 'より', 'でも'])
const COPULA = /^(です|ます|でした|ました|ません|でしょう|だ)/
const AUX_AFTER_ACTION = /^(ます|ました|ません|ない|なかった|た|て|ている|ています|ていた)/
const cp = (s: string) => Array.from(s).length
/** ① 홀로 떨어진 です/ます 류(와 か·ね·よ 가 붙은 꼴) — 앞 조각에서 떼어 낸 것. */
const LONELY_COPULA_RE = /^(です|でした|ます|ました|ません|でしょう)(か|ね|よ)?$/
/** ② FEELING 인데 동사 꼴(〜ている/〜ていました/する동사) — 지침: 〜ている 상태 동사·する동사는 ACTION. */
const FEELING_VERB_RE = /[てで]い(ます|ました|ません|る|た)$|(します|しました|している|していた)$/
/** ② 수량(一つ·二人·三枚) 인데 NAME 이 아님 — 지침: 수량은 NAME. */
const QUANTITY_RE = /^[一二三四五六七八九十百千0-9０-９]+(つ|人|枚|個|本|杯|回|台|冊|歳)$/
/** ② 정형 인사·부탁인데 ACTION — 지침: 통째 EXPRESSION. */
const GREETING_RE = /(お願いします|失礼します|いただきます|ごちそうさま(でした)?|お邪魔します)$/

export interface Flags {
  particleNotLink: number; particlePieces: number; splitLines: number; expressionLong: number; slashNoneLines: number; slashManyLines: number; koLong: number
  /** PE 3단계 휴리스틱(게이트 아님) — 눈가림 «어색» 원인 ①~④ 의 자동 탐지 가능한 일부. 아래 정규식 주석 참고. */
  lonelyCopula: number; lonelyCopulaLines: number; feelingVerbForm: number; quantityNotName: number; greetingAsAction: number; koYoBad: number; slashBeforeLink: number
}
export interface DialogueDump { speaker: string; ja: string; ko: string; pieces: { ja: string; type: string | null; ko: string | null; slash?: boolean }[] | null }
export interface Metrics {
  lines: number; nullLines: number; pieceCount: number; typedCount: number; koNoHangul: number
  typeDist: Record<string, number>; slashes: number; koLenMean: number; flags: Flags; outChars: number; piecesChars: number
}

export function analyzeData(data: LessonResponse): Metrics {
  const typeDist: Record<string, number> = {}
  const flags: Flags = { particleNotLink: 0, particlePieces: 0, splitLines: 0, expressionLong: 0, slashNoneLines: 0, slashManyLines: 0, koLong: 0, lonelyCopula: 0, lonelyCopulaLines: 0, feelingVerbForm: 0, quantityNotName: 0, greetingAsAction: 0, koYoBad: 0, slashBeforeLink: 0 }
  let nullLines = 0, pieceCount = 0, typedCount = 0, koNoHangul = 0, slashes = 0, koLenSum = 0, piecesChars = 0
  for (const d of data.dialogue) {
    if (d.pieces === null || d.pieces === undefined) { nullLines++; continue }
    piecesChars += JSON.stringify(d.pieces).length
    pieceCount += d.pieces.length
    let lineSlashes = 0, split = false, typedInLine = 0, lonelyInLine = 0
    d.pieces.forEach((p, i) => {
      if (p.slash === true) { slashes++; lineSlashes++ }
      if (p.type === null) return
      typedCount++; typedInLine++
      typeDist[p.type] = (typeDist[p.type] ?? 0) + 1
      const ko = p.ko ?? ''
      koLenSum += cp(ko)
      if (cp(ko) > 12) flags.koLong++
      if (!/[가-힣]/.test(ko)) koNoHangul++
      if (PARTICLES.has(p.ja)) { flags.particlePieces++; if (p.type !== 'LINK') flags.particleNotLink++ }
      if (p.type === 'EXPRESSION' && cp(p.ja) > 12) flags.expressionLong++
      if (LONELY_COPULA_RE.test(p.ja)) { flags.lonelyCopula++; lonelyInLine++ }
      if (p.type === 'FEELING' && FEELING_VERB_RE.test(p.ja)) flags.feelingVerbForm++
      if (p.type !== 'NAME' && QUANTITY_RE.test(p.ja)) flags.quantityNotName++
      if (p.type === 'ACTION' && GREETING_RE.test(p.ja)) flags.greetingAsAction++
      if (p.ja === 'よ' && p.type === 'LINK' && /이에요|이요|입니다/.test(ko)) flags.koYoBad++
      const next = d.pieces![i + 1]
      if (p.slash === true && next && next.type === 'LINK') flags.slashBeforeLink++ // 정리 뒤에는 0 이어야 한다(옮김) — 옛 파이프라인 결과에서는 «명사-조사 사이 slash» 수
      if (next && next.type !== null) {
        if (p.type === 'FEELING' && COPULA.test(next.ja)) split = true // 静か｜です — です/ます 는 앞 조각에 붙인다
        if (p.type === 'ACTION' && next.type === 'ACTION' && AUX_AFTER_ACTION.test(next.ja)) split = true // 食べ｜ます — 활용형은 한 조각
      }
    })
    if (split) flags.splitLines++
    if (lonelyInLine > 0) flags.lonelyCopulaLines++
    if (typedInLine >= 4 && lineSlashes === 0) flags.slashNoneLines++
    if (lineSlashes > 5) flags.slashManyLines++
  }
  const outChars = JSON.stringify(data).length
  return { lines: data.dialogue.length, nullLines, pieceCount, typedCount, koNoHangul, typeDist, slashes, koLenMean: typedCount ? Math.round((koLenSum / typedCount) * 10) / 10 : 0, flags, outChars, piecesChars }
}

export interface LogFacts { pieces?: { lines: number; nullLines: number; pieces: number; koNoHangul: number; reasons: Record<string, number>; slashMoved?: number }; retryReason?: string; tolerated?: string }
export function parseLogs(lines: string[]): LogFacts {
  const f: LogFacts = {}
  for (const l of lines) {
    const m = /^\[(?:lesson|reviewMix)\] pieces — lines=(\d+) nullLines=(\d+) pieces=(\d+) koNoHangul=(\d+) reasons=(\{.*\})(?: slashMoved=(\d+))?$/.exec(l)
    if (m) f.pieces = { lines: +m[1], nullLines: +m[2], pieces: +m[3], koNoHangul: +m[4], reasons: JSON.parse(m[5]) as Record<string, number>, ...(m[6] !== undefined ? { slashMoved: +m[6] } : {}) }
    const r = /^\[json\] 1차 응답 계약 위반 → 재시도: (.*)$/.exec(l)
    if (r) f.retryReason = r[1].slice(0, 300)
    if (/^\[(?:lesson|reviewMix)\] 마지막 시도 — 눈감고 통과시킨/.test(l)) f.tolerated = l.slice(0, 200)
  }
  return f
}

export interface Row {
  id: string; kind: Kind; level: string; arm: string
  ok: boolean; elapsedMs: number; attempts?: number; promptChars?: number; model?: string
  error?: string; errorName?: string; limitHit?: boolean; timeout?: boolean
  metrics?: Metrics; logs?: LogFacts; dialogue?: DialogueDump[]
}

// ── 요약·게이트 ──────────────────────────────────────────────────────────────────────────
function pct(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

function baseSummary(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const single = ok.filter((r) => (r.attempts ?? 1) === 1).map((r) => r.elapsedMs).sort((a, b) => a - b)
  const all = ok.map((r) => r.elapsedMs).sort((a, b) => a - b)
  const retried = ok.filter((r) => (r.attempts ?? 1) === 2)
  const m = ok.map((r) => r.metrics!).filter(Boolean)
  const lines = sum(m.map((x) => x.lines))
  const nullLines = sum(m.map((x) => x.nullLines))
  const typed = sum(m.map((x) => x.typedCount))
  const flags = (k: keyof Flags) => sum(m.map((x) => x.flags[k]))
  const out = ok.map((r) => r.metrics!.outChars).sort((a, b) => a - b)
  const pc = ok.map((r) => r.metrics!.piecesChars).sort((a, b) => a - b)
  const typeDist: Record<string, number> = {}
  for (const x of m) for (const [k, v] of Object.entries(x.typeDist)) typeDist[k] = (typeDist[k] ?? 0) + v
  const reasons: Record<string, number> = {}
  for (const r of ok) for (const [k, v] of Object.entries(r.logs?.pieces?.reasons ?? {})) reasons[k] = (reasons[k] ?? 0) + v
  const firstAttemptThreshold = rows.filter((r) => (r.logs?.retryReason ?? '').includes('pieces 가 규칙을 어겼다')).length
  const tolerated = rows.filter((r) => r.logs?.tolerated?.includes('조각 위반')).length
  const byKind: Record<string, number> = {}
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
  const s = {
    calls: rows.length, ok: ok.length, failed: rows.length - ok.length, byKind,
    elapsed: { medianSingleMs: pct(single, 0.5), medianAllMs: pct(all, 0.5), p90Ms: pct(all, 0.9), maxMs: all.length ? all[all.length - 1] : null, over120: rows.filter((r) => r.elapsedMs > JOB_BUDGET_MS).length },
    retry: { retried: retried.length, rate: rows.length ? retried.length / rows.length : 0, firstAttemptThreshold, tolerated, reasons: retried.map((r) => r.logs?.retryReason ?? '(원인 로그 없음)') },
    size: { outCharsMedian: pct(out, 0.5), outCharsMax: out.length ? out[out.length - 1] : null, piecesCharsMedian: pct(pc, 0.5), piecesShare: sum(out) ? Math.round((sum(pc) / sum(out)) * 1000) / 10 : null, promptCharsMax: Math.max(0, ...ok.map((r) => r.promptChars ?? 0)) },
    pieces: { lines, nullLines, nullLineRate: lines ? nullLines / lines : 0, reasons, pieceCount: sum(m.map((x) => x.pieceCount)), piecesPerLine: lines - nullLines ? Math.round((sum(m.map((x) => x.pieceCount)) / (lines - nullLines)) * 10) / 10 : 0, typed, koNoHangul: sum(m.map((x) => x.koNoHangul)), koNoHangulRate: typed ? sum(m.map((x) => x.koNoHangul)) / typed : 0, typeDist, slashesPerLine: lines - nullLines ? Math.round((sum(m.map((x) => x.slashes)) / (lines - nullLines)) * 100) / 100 : 0 },
    flags: { particleNotLinkRate: flags('particlePieces') ? flags('particleNotLink') / flags('particlePieces') : 0, particlePieces: flags('particlePieces'), splitLineRate: lines ? flags('splitLines') / lines : 0, expressionLong: flags('expressionLong'), slashNoneLines: flags('slashNoneLines'), slashManyLines: flags('slashManyLines'), koLong: flags('koLong'),
      lonelyCopula: flags('lonelyCopula'), lonelyCopulaLines: flags('lonelyCopulaLines'), feelingVerbForm: flags('feelingVerbForm'), quantityNotName: flags('quantityNotName'), greetingAsAction: flags('greetingAsAction'), koYoBad: flags('koYoBad'), slashBeforeLink: flags('slashBeforeLink'),
      /** 로그에서 읽은 «정리 단계가 조사로 옮긴 slash 구간 수» — 옛 파이프라인 결과에는 없다(null). */
      slashMoved: ok.some((r) => r.logs?.pieces?.slashMoved !== undefined) ? sum(ok.map((r) => r.logs?.pieces?.slashMoved ?? 0)) : null },
    errors: rows.filter((r) => !r.ok).map((r) => `${r.id}: ${r.errorName}: ${r.error}`),
  }
  return s
}

type Summary = ReturnType<typeof baseSummary>
export function summarize(rows: Row[]) {
  const s = baseSummary(rows)
  return { ...s, gate: gate(s) }
}
export function gate(s: Summary) {
  const n = s.calls
  const rule = (id: string, rule: string, value: unknown, pass: boolean | null) => ({ id, rule, value, pass })
  return [
    rule('G1a', `1차 성공 호출 중앙값 ≤ ${GATE.g1MedianSingleMs / 1000}초`, s.elapsed.medianSingleMs, s.elapsed.medianSingleMs === null ? null : s.elapsed.medianSingleMs <= GATE.g1MedianSingleMs),
    rule('G1b', `전체 최대 ≤ ${GATE.g1MaxMs / 1000}초`, s.elapsed.maxMs, s.elapsed.maxMs === null ? null : s.elapsed.maxMs <= GATE.g1MaxMs),
    rule('G1c', '120초 초과 0', s.elapsed.over120, n ? s.elapsed.over120 === 0 : null),
    rule('G2a', `재시도율 ≤ ${Math.round(GATE.g2RetryRate * 100)}%`, `${s.retry.retried}/${n}`, n ? s.retry.rate <= GATE.g2RetryRate + 1e-9 : null),
    rule('G2b', '최종 실패(던짐) 0', s.failed, n ? s.failed === 0 : null),
    rule('G3a', `조각 null 줄 비율 ≤ ${GATE.g3NullLineRate * 100}%`, `${s.pieces.nullLines}/${s.pieces.lines}`, s.pieces.lines ? s.pieces.nullLineRate <= GATE.g3NullLineRate : null),
    rule('G3b', '마지막 시도 면책(조각 위반 줄 null 저장) 0건', s.retry.tolerated, n ? s.retry.tolerated === 0 : null),
    rule('G3c', `1차 조각 임계 재시도 ≤ ${GATE.g3FirstAttemptThresholdMax}건`, s.retry.firstAttemptThreshold, n ? s.retry.firstAttemptThreshold <= GATE.g3FirstAttemptThresholdMax : null),
    rule('G4', `koNoHangul ≤ ${GATE.g4KoNoHangulRate * 100}%`, `${s.pieces.koNoHangul}/${s.pieces.typed}`, s.pieces.typed ? s.pieces.koNoHangulRate <= GATE.g4KoNoHangulRate : null),
    rule('G5a', `조사가 LINK 가 아닌 조각 ≤ ${GATE.g5ParticleNotLinkRate * 100}%`, `${Math.round(s.flags.particleNotLinkRate * 1000) / 10}% of ${s.flags.particlePieces}`, s.flags.particlePieces ? s.flags.particleNotLinkRate <= GATE.g5ParticleNotLinkRate : null),
    rule('G5b', `です/ます·어미 분리 줄 ≤ ${GATE.g5SplitLineRate * 100}%`, `${Math.round(s.flags.splitLineRate * 1000) / 10}%`, s.pieces.lines ? s.flags.splitLineRate <= GATE.g5SplitLineRate : null),
  ]
}

// ── 눈가림 표 ────────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const TYPE_KO: Record<string, string> = { NAME: '이름', ACTION: '액션', FEELING: '느낌', MODIFIER: '꾸밈', EXPRESSION: '표현', LINK: '연결' }
export function renderPieces(pieces: NonNullable<DialogueDump['pieces']>): string {
  return pieces.map((p) => `${p.ja}${p.type === null ? '' : `〔${TYPE_KO[p.type] ?? p.type}:${p.ko ?? ''}〕`}${p.slash ? ' ／' : ''}`).join(' ｜ ')
}

/** 줄을 무작위(시드 고정)로 `n` 개 뽑아 arm 이름·호출 id 없이 번호 `S01…` 만 붙인 표와 키를 만든다. null 줄은 표에서 뺀다(비율은 요약이 센다). */
export function blindSheet(rowsByFile: Row[][], n: number, seed: number) {
  const pool: { arm: string; call: string; line: number; d: DialogueDump }[] = []
  for (const rows of rowsByFile) for (const r of rows) if (r.ok) (r.dialogue ?? []).forEach((d, i) => { if (d.pieces) pool.push({ arm: r.arm, call: r.id, line: i, d }) })
  const rnd = mulberry32(seed)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const picked = pool.slice(0, n)
  const key: Record<string, { arm: string; call: string; line: number }> = {}
  const md = [
    '# 조각 분해 눈가림 판정표 (task-081)',
    '',
    '각 줄의 «조각»을 보고 **맞음 / 어색 / 틀림** 으로 판정해 주세요. 어느 쪽 프롬프트·어느 호출인지는 숨겼습니다.',
    '- **맞음**: 사람이 나눠도 같은 덩어리·같은 종류·맞는 뜻이다.',
    '- **어색**: 쓸 수는 있으나 더 나은 나눔이 있다(너무 잘게/크게, 종류가 애매, 뜻이 어색).',
    '- **틀림**: 종류가 틀렸거나 뜻이 틀렸거나 학습자가 오해할 묶음이다.',
    '표기: `조각〔종류:뜻〕`, ` ｜ ` = 조각 경계, ` ／ ` = 끊어 읽기.',
    '',
    '| # | 원문 | 한국어 | 조각 | 판정 | 메모 |',
    '|---|---|---|---|---|---|',
  ]
  picked.forEach((p, i) => {
    const id = `S${String(i + 1).padStart(2, '0')}`
    key[id] = { arm: p.arm, call: p.call, line: p.line }
    md.push(`| ${id} | ${p.d.ja} | ${p.d.ko} | ${renderPieces(p.d.pieces!)} |  |  |`)
  })
  return { md: md.join('\n') + '\n', key, count: picked.length, poolSize: pool.length }
}

export type Verdict = '맞음' | '어색' | '틀림'
export function scoreVerdicts(verdicts: Record<string, string>, key: Record<string, { arm: string }>) {
  const byArm: Record<string, Record<string, number>> = {}
  for (const [id, v] of Object.entries(verdicts)) {
    const arm = key[id]?.arm
    if (!arm) continue
    byArm[arm] ??= { 맞음: 0, 어색: 0, 틀림: 0, total: 0 }
    if (v === '맞음' || v === '어색' || v === '틀림') { byArm[arm][v]++; byArm[arm].total++ }
  }
  return Object.fromEntries(Object.entries(byArm).map(([arm, c]) => {
    const t = c.total || 1
    const right = c.맞음 / t, awk = c.어색 / t, wrong = c.틀림 / t
    return [arm, { ...c, total: c.total, rightRate: round(right), rightOrAwkwardRate: round(right + awk), wrongRate: round(wrong),
      g6: c.total >= GATE.g6MinSample ? wrong <= GATE.g6Wrong && right >= GATE.g6Right && right + awk >= GATE.g6RightOrAwkward : null }]
  }))
}
const round = (x: number) => Math.round(x * 1000) / 10

// ── 호출 ─────────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ledgerPath = () => OUT.replace(/\.json$/, '') + '.calls.json'
function ledger(entry: Record<string, unknown>) {
  const p = ledgerPath()
  mkdirSync(dirname(p), { recursive: true })
  const cur = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>[]) : []
  cur.push({ at: new Date().toISOString(), ...entry })
  writeFileSync(p, JSON.stringify(cur, null, 1))
}

async function runCall(p: Planned, override: string | null): Promise<Row> {
  const base = { id: p.id, kind: p.kind, level: p.level, arm: ARM }
  const req = buildRequest(p, override)
  const logs: string[] = []
  const info = console.info, warn = console.warn
  console.info = (...a: unknown[]) => void logs.push(a.map(String).join(' '))
  console.warn = (...a: unknown[]) => void logs.push(a.map(String).join(' '))
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>(req as LessonRequest)
    const metrics = analyzeData(r.data)
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, promptChars: r.promptChars, model: r.model, metrics, logs: parseLogs(logs),
      dialogue: r.data.dialogue.map((d) => ({ speaker: d.speaker, ja: d.ja, ko: d.ko, pieces: d.pieces as DialogueDump['pieces'] })),
    }
  } catch (e) {
    const err = e as Error & { raw?: string }
    const blob = `${err.message}\n${typeof err.raw === 'string' ? err.raw.slice(0, 2000) : ''}`
    return { ...base, ok: false, elapsedMs: Date.now() - t0, errorName: err.name, error: err.message.slice(0, 240), limitHit: LIMIT_RE.test(blob), timeout: /Timeout/i.test(err.name), logs: parseLogs(logs) }
  } finally {
    console.info = info
    console.warn = warn
  }
}

function printSummary(rows: Row[]) {
  const s = summarize(rows)
  console.log(`\n## 요약 (${ARM}) — 호출 ${s.calls}회 (성공 ${s.ok}, 실패 ${s.failed}) ${JSON.stringify(s.byKind)}`)
  console.log(JSON.stringify({ elapsed: s.elapsed, retry: s.retry, size: s.size, pieces: s.pieces, flags: s.flags, errors: s.errors }, null, 1))
  console.log('\n## 게이트 G1~G5 (G6 눈가림은 SCORE=1)')
  for (const g of s.gate) console.log(`  ${g.pass === null ? '··' : g.pass ? 'OK' : 'NG'}  ${g.id}  ${g.rule}  → ${JSON.stringify(g.value)}`)
}

/** 점검(호출 0) — 계획·프롬프트 길이·조각 지침 포함·합성 응답 분석·눈가림 표·게이트. */
function dry() {
  const override = process.env.PIECES_FILE ? readFileSync(process.env.PIECES_FILE, 'utf8') : null
  const plan = buildPlan('core')
  const extra = buildPlan('extra')
  const r2 = buildPlan('r2')
  const reg = buildPlan('reg')
  console.log(`DRY — 라이브 호출 0회. core ${plan.length}회 · extra ${extra.length}회 · r2 ${r2.length}회 · reg ${reg.length}회 · HARD_CAP ${HARD_CAP} · 오늘 설정 PLAN=${PLAN_KIND} MAX_CALLS=${MAX_CALLS} KIND_CAP=${JSON.stringify(KIND_CAP)} 원장=${ledgerPath()}`)
  if (r2.length !== KIND_CAP.r2 || new Set(r2.map((p) => p.id)).size !== r2.length) throw new Error('r2 계획 길이/중복 점검 실패')
  if (reg.length !== KIND_CAP.reg || new Set(reg.map((p) => p.id)).size !== reg.length) throw new Error('reg 계획 길이/중복 점검 실패')
  for (const p of reg) {
    const c = plan.find((x) => x.id === p.id)
    if (!c || JSON.stringify(c) !== JSON.stringify(p)) throw new Error(`reg 계획 ${p.id} 가 core 의 같은 입력이 아니다`)
  }
  const coreIds = new Set(plan.map((p) => p.id))
  if (r2.some((p) => coreIds.has(p.id))) throw new Error('r2 계획이 core 와 같은 (주제, 수준) 조합을 포함한다')
  const synthetic: Row[] = []
  for (const p of [...plan, ...extra, ...r2, ...reg]) {
    const req = buildRequest(p, override)
    const sysHas = req.system.includes(override?.trim() ?? PIECES_INSTRUCTION_LINE)
    console.log(`  ${p.id.padEnd(22)} ${p.kind.padEnd(8)} ${p.level}  prompt≈${(req.system.length + (req.messages[0]?.content.length ?? 0))}자  조각지침 ${sysHas ? '있음' : '없음!'}  스키마 ${(req.jsonSchema as { required: string[] }).required.includes('quiz') ? 'quiz 남음!' : 'quiz 없음'}`)
    if (!sysHas) throw new Error(`${p.id}: 조각 지침이 system 에 없다`)
  }
  // 합성 응답 2개(정상·null 줄 포함)로 분석기·요약·게이트·눈가림 표를 점검한다.
  const mk = (id: string, pieces: DialogueDump['pieces']): Row => {
    const data = { dialogue: [{ speaker: 'A', ja: '温かいコーヒーを一つください。', ko: '따뜻한 커피 하나 주세요.', reading: 'x', pieces }, { speaker: 'B', ja: '駅です', ko: '역이에요', reading: 'x', pieces: null }] } as unknown as LessonResponse
    return { id, kind: 'TOPIC', level: 'N5', arm: 'dry', ok: true, elapsedMs: 41_000, attempts: 1, promptChars: 9000, metrics: analyzeData(data), logs: { pieces: { lines: 2, nullLines: 1, pieces: 6, koNoHangul: 0, reasons: { join_mismatch: 1 } } }, dialogue: data.dialogue.map((d) => ({ speaker: d.speaker, ja: d.ja, ko: d.ko, pieces: d.pieces as DialogueDump['pieces'] })) }
  }
  const good = [{ ja: '温かい', type: 'FEELING', ko: '따뜻한' }, { ja: 'コーヒー', type: 'NAME', ko: '커피' }, { ja: 'を', type: 'LINK', ko: '~을/를', slash: true }, { ja: '一つ', type: 'NAME', ko: '하나', slash: true }, { ja: 'ください', type: 'ACTION', ko: '주세요' }, { ja: '。', type: null, ko: null }] as DialogueDump['pieces']
  synthetic.push(mk('dry-1', good), mk('dry-2', good))
  const s = summarize(synthetic)
  if (s.pieces.nullLines !== 2 || s.pieces.lines !== 4) throw new Error(`분석기 점검 실패: ${JSON.stringify(s.pieces)}`)
  if (!(s.flags.particlePieces === 2 && s.flags.particleNotLinkRate === 0)) throw new Error(`플래그 점검 실패: ${JSON.stringify(s.flags)}`)
  const flagged = analyzeData({ dialogue: [{ speaker: 'A', ja: '食べます', ko: 'x', reading: 'x', pieces: [{ ja: '食べ', type: 'ACTION', ko: '먹', slash: false }, { ja: 'ます', type: 'ACTION', ko: '요', slash: false }, { ja: 'を', type: 'NAME', ko: '~을', slash: false }] }] } as unknown as LessonResponse)
  if (flagged.flags.splitLines !== 1 || flagged.flags.particleNotLink !== 1) throw new Error(`분해 플래그 점검 실패: ${JSON.stringify(flagged.flags)}`)
  const flagged2 = analyzeData({ dialogue: [{ speaker: 'A', ja: 'x', ko: 'x', reading: 'x', pieces: [
    { ja: '写真', type: 'NAME', ko: '사진', slash: true }, { ja: 'を', type: 'LINK', ko: '~을/를' }, { ja: '緊張しています', type: 'FEELING', ko: '긴장', slash: false }, { ja: 'です', type: 'FEELING', ko: '~입니다' },
    { ja: '一つ', type: 'MODIFIER', ko: '하나' }, { ja: 'よろしくお願いします', type: 'ACTION', ko: '잘 부탁' }, { ja: 'よ', type: 'LINK', ko: '~이에요(강조)' }] }] } as unknown as LessonResponse)
  const f2 = flagged2.flags
  if (f2.slashBeforeLink !== 1 || f2.feelingVerbForm !== 1 || f2.lonelyCopula !== 1 || f2.lonelyCopulaLines !== 1 || f2.quantityNotName !== 1 || f2.greetingAsAction !== 1 || f2.koYoBad !== 1) throw new Error(`PE 3단계 플래그 점검 실패: ${JSON.stringify(f2)}`)
  const sheet = blindSheet([synthetic], 5, 81)
  if (sheet.count !== 2 || /dry|dry-1/.test(sheet.md)) throw new Error('눈가림 표에 arm/호출 id 가 새거나 줄 수가 틀리다')
  const sc = scoreVerdicts({ S01: '맞음', S02: '어색' }, sheet.key)
  if (!sc.dry || sc.dry.total !== 2) throw new Error('판정 집계 점검 실패')
  console.log(`분석기·플래그·눈가림 표·판정 집계 점검 통과. 게이트 항목 ${s.gate.length}개(합성 데이터라 값은 의미 없음).`)
  console.log('\n--- 눈가림 표 미리보기(합성) ---\n' + sheet.md.split('\n').slice(9, 11).join('\n'))
}

/** 두 결과(core·r2)를 같은 정의(현재 분석기)로 나란히 계산한다 — 저장된 dialogue 로 플래그를 다시 센다(호출 0). 크기 지표는 저장된 값을 쓴다. */
export function compareRuns(coreRows: Row[], r2Rows: Row[]) {
  const re = (rows: Row[]): Row[] => rows.map((r) => (r.ok && r.dialogue && r.metrics
    ? { ...r, metrics: { ...analyzeData({ dialogue: r.dialogue } as unknown as LessonResponse), outChars: r.metrics.outChars, piecesChars: r.metrics.piecesChars } }
    : r))
  const col = (rows: Row[]) => {
    const s = summarize(re(rows))
    const prompt = rows.filter((r) => r.ok).map((r) => (r.attempts === 2 ? Math.round((r.promptChars ?? 0) / 2) : r.promptChars ?? 0)).sort((a, b) => a - b)
    return {
      calls: s.calls, failed: s.failed, retried: s.retry.retried, over120: s.elapsed.over120,
      medianSingleMs: s.elapsed.medianSingleMs, p90Ms: s.elapsed.p90Ms, maxMs: s.elapsed.maxMs,
      promptCharsMedian: pct(prompt, 0.5), outCharsMedian: s.size.outCharsMedian, piecesShare: s.size.piecesShare,
      lines: s.pieces.lines, nullLines: s.pieces.nullLines, nullLineRate: s.pieces.nullLineRate, reasons: s.pieces.reasons, pieceCount: s.pieces.pieceCount, piecesPerLine: s.pieces.piecesPerLine, slashesPerLine: s.pieces.slashesPerLine,
      typed: s.pieces.typed, koNoHangul: s.pieces.koNoHangul, typeDist: s.pieces.typeDist,
      flags: s.flags, gate: Object.fromEntries(s.gate.map((g) => [g.id, { value: g.value, pass: g.pass }])),
    }
  }
  return { core: col(coreRows), r2: col(r2Rows) }
}

/** 같은 id 끼리 core 값과 나란히 — 경과·재시도·프롬프트/응답 글자 수·null 줄·플래그(저장된 dialogue 를 현재 분석기로 다시 센 값). 호출 0. */
export function compareById(coreRows: Row[], regRows: Row[]) {
  const flagsOf = (r: Row) => (r.ok && r.dialogue ? analyzeData({ dialogue: r.dialogue } as unknown as LessonResponse).flags : null)
  return regRows.map((g) => {
    const c = coreRows.find((x) => x.id === g.id)
    const side = (r: Row | undefined) => (r
      ? { ok: r.ok, elapsedMs: r.elapsedMs, attempts: r.attempts ?? null, promptChars: r.promptChars ?? null, outChars: r.metrics?.outChars ?? null, lines: r.metrics?.lines ?? null, nullLines: r.metrics?.nullLines ?? null,
          pieceCount: r.metrics?.pieceCount ?? null, koNoHangul: r.metrics?.koNoHangul ?? null, slashes: r.metrics?.slashes ?? null, reasons: r.logs?.pieces?.reasons ?? null, slashMoved: r.logs?.pieces?.slashMoved ?? null,
          retryReason: r.logs?.retryReason ?? null, tolerated: r.logs?.tolerated ?? null, flags: flagsOf(r), error: r.ok ? null : `${r.errorName}: ${r.error}` }
      : null)
    return { id: g.id, core: side(c), reg: side(g) }
  })
}

async function main() {
  if (process.env.DRY === '1') { dry(); return }
  if (process.env.COMPARE === '1') {
    const load = (f: string) => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows
    const coreRows = load(process.env.CORE_FILE ?? ''), outRows = load(OUT)
    if (PLAN_KIND === 'reg') {
      const ids = new Set(outRows.map((r) => r.id))
      const same = coreRows.filter((r) => ids.has(r.id))
      const agg = compareRuns(same, outRows) // compareRuns 의 두 번째 열 이름은 r2 — 여기서는 reg 결과다
      console.log(JSON.stringify({ aggregate: { core: agg.core, reg: agg.r2 }, byId: compareById(coreRows, outRows) }, null, 1))
      return
    }
    console.log(JSON.stringify(compareRuns(coreRows, outRows), null, 1))
    return
  }
  if (process.env.DUMP === '1') { printSummary((JSON.parse(readFileSync(OUT, 'utf8')) as { rows: Row[] }).rows); return }
  if (process.env.SHEET === '1') {
    const files = (process.env.SHEET_FROM ?? OUT).split(',').filter(Boolean)
    const rowsByFile = files.map((f) => (JSON.parse(readFileSync(f, 'utf8')) as { rows: Row[] }).rows)
    const sheet = blindSheet(rowsByFile, Number(process.env.SHEET_N ?? 40), Number(process.env.SEED ?? 81))
    const base = OUT.replace(/\.json$/, '')
    writeFileSync(`${base}.sheet.md`, sheet.md)
    writeFileSync(`${base}.sheet.key.json`, JSON.stringify(sheet.key, null, 1))
    console.log(`표 ${sheet.count}줄(풀 ${sheet.poolSize}줄) → ${base}.sheet.md · 키 ${base}.sheet.key.json (키는 Leader 에게 보이지 말 것)`)
    return
  }
  if (process.env.SCORE === '1') {
    const verdicts = JSON.parse(readFileSync(process.env.VERDICTS ?? '', 'utf8')) as Record<string, string>
    const key = JSON.parse(readFileSync(process.env.KEY ?? '', 'utf8')) as Record<string, { arm: string }>
    console.log(JSON.stringify(scoreVerdicts(verdicts, key), null, 1))
    return
  }
  const plan = buildPlan()
  console.log(`계획(${PLAN_KIND}) ${plan.length}회(상한 MAX_CALLS=${MAX_CALLS}, HARD_CAP=${HARD_CAP}): ${plan.map((p) => p.id).join(' ')}`)
  if (process.env.LIVE_OK !== 'task-081') { console.log('LIVE_OK=task-081 이 없어 호출하지 않는다(계획만 출력). 사용자 호출 예산 승인 뒤 2단계 지시에서만 켠다.'); return }
  const override = process.env.PIECES_FILE ? readFileSync(process.env.PIECES_FILE, 'utf8') : null
  const startedAt = new Date().toISOString()
  const rows: Row[] = []
  if (process.env.RESUME === '1' && existsSync(OUT)) rows.push(...(JSON.parse(readFileSync(OUT, 'utf8')) as { rows: Row[] }).rows)
  const done = new Set(rows.map((r) => r.id))
  let stopped: string | undefined
  let immediateFails = 0
  for (const p of plan) {
    if (done.has(p.id)) continue
    if (rows.length >= MAX_CALLS || rows.length >= HARD_CAP) { stopped = `호출 상한 도달(${p.id} 부터 미실행)`; break }
    ledger({ event: 'start', id: p.id, n: rows.length + 1, arm: ARM })
    const row = await runCall(p, override)
    rows.push(row)
    ledger({ event: 'end', id: p.id, ok: row.ok, elapsedMs: row.elapsedMs, attempts: row.attempts })
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ startedAt, version: ARM, plan: PLAN_KIND, maxCalls: MAX_CALLS, rows, ...(stopped ? { stopped } : {}) }, null, 1))
    console.log(row.ok ? `${p.id}\t${row.elapsedMs}ms\ta=${row.attempts}\tlines=${row.metrics?.lines}\tnull=${row.metrics?.nullLines}\tpieces=${row.metrics?.pieceCount}\tout=${row.metrics?.outChars}` : `${p.id}\tFAIL ${row.elapsedMs}ms ${row.errorName}: ${row.error}`)
    if (row.limitHit) { stopped = `한도·429 문구 감지(${p.id})`; break }
    immediateFails = !row.ok && !row.timeout && row.elapsedMs < IMMEDIATE_FAIL_MS ? immediateFails + 1 : 0
    if (immediateFails >= 2) { stopped = `즉시 실패 2연속(${p.id})`; break }
    await sleep(GAP_MS)
  }
  if (stopped) { writeFileSync(OUT, JSON.stringify({ startedAt, version: ARM, plan: PLAN_KIND, maxCalls: MAX_CALLS, rows, stopped }, null, 1)); console.log(`BLOCKED: ${stopped} — 여기서 멈춘다(추정 없음).`) }
  printSummary(rows)
  console.log(`\n결과 파일: ${OUT}`)
}

// import 만으로는 실행하지 않는다 — task-078 사고(import 부작용으로 라이브 호출 2회) 재발 방지.
if ((process.argv[1] ?? '').endsWith('lesson-pieces-live.ts')) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e)
      process.exit(1)
    },
  )
}
