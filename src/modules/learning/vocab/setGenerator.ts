/**
 * 오늘의 단어 세트 생성 — 순수 함수(DB 없음). design-spec §7-2 공식을 그대로 옮긴다.
 *
 *   w = clamp(1 + 2·wrong − 0.5·correct, 0.25, 8) × recency(미노출 2.0 / 7일↑ 1.5 / 1~7일 1.0 / 24h 내 0.3) × 단계 계수(천장을 줄 때만)
 *   가중 비복원 샘플링(시드 PRNG) → Fisher-Yates 로 순서 섞기
 *
 * 단계 계수(task-053, IMP-0028): 단어 단계가 천장(지금·목표 수준 중 높은 쪽)보다 d 단계 위면 d≤0 → 1 · 1 → 0.3 · 2 → 0.05 · ≥3 → 0.
 * 0 인 단어도 후보에서 빼지 않고 아주 작은 양수 가중으로 둔다 — 후보가 모자랄 때만 마지막에 채워지게(세트가 `count` 보다 줄지 않게).
 * **`ceiling` 을 주지 않으면 계산도 난수 소비도 변경 전과 같다.**
 *
 * **같은 시드 + 같은 후보 → 같은 결과**가 계약이다(`VocabSession.seed` 로 재현). 그래서 후보를 먼저 id 로 정렬해
 * DB 가 돌려준 순서에 결과가 흔들리지 않게 하고, 난수는 전부 시드에서 나온 한 줄기(`Rng`)에서만 뽑는다.
 */
import { randomBytes } from 'node:crypto'

export type Rng = () => number

const DAY_MS = 86_400_000

/** 문자열 시드 → 128비트 상태(cyrb128). 짧은 문자열 차이도 상태 전체로 퍼진다. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** 시드 문자열 → [0,1) 난수 생성기(sfc32). `Math.random` 을 쓰지 않는다(재현 불가). */
export function createRng(seed: string): Rng {
  let [a, b, c, d] = cyrb128(seed)
  return () => {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * 새 세트의 시드(`VocabSession.seed`, VARCHAR(32)). 첫 글자는 **요청한 모드**(`C`=CHOICE·`F`=FLIP)다 — 스키마에
 * "요청 모드" 컬럼이 없어서 #49 가 `downgraded`(요청 CHOICE → 실제 FLIP)를 다시 계산할 수 있게 여기에 적는다.
 * PRNG 는 이 문자열 전체를 시드로 쓰므로 재현성은 그대로다.
 */
export function newSeed(requestedMode: 'CHOICE' | 'FLIP'): string {
  return `${requestedMode === 'CHOICE' ? 'C' : 'F'}${randomBytes(15).toString('hex')}`
}

export function requestedModeOf(seed: string): 'CHOICE' | 'FLIP' | null {
  return seed.startsWith('C') ? 'CHOICE' : seed.startsWith('F') ? 'FLIP' : null
}

/** 최근성 계수 — 미노출 2.0 / 7일 이상 1.5 / 1일 이상 7일 미만 1.0 / 24시간 안 0.3. */
export function recencyFactor(lastSeenAt: Date | null, now: Date): number {
  if (!lastSeenAt) return 2.0
  const age = now.getTime() - lastSeenAt.getTime()
  if (age >= 7 * DAY_MS) return 1.5
  if (age >= DAY_MS) return 1.0
  return 0.3
}

/** JLPT 단계 코드 — Prisma `JlptLevel` 과 같은 문자열(순수 함수라 `@prisma/client` 를 끌어오지 않는다). */
export type LevelCode = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

/** 쉬움 → 어려움. 순위가 클수록 어렵다. */
export const LEVEL_ORDER: readonly LevelCode[] = ['N5', 'N4', 'N3', 'N2', 'N1']

function rankOf(level: string | null | undefined): number {
  return level ? (LEVEL_ORDER as readonly string[]).indexOf(level) : -1
}

/**
 * 단계 계수 — 천장보다 몇 단계 위인가(d)로 정한다. 단어 단계나 천장이 없거나 알 수 없는 값이면 1(줄이지 않는다).
 * 천장 이하(d≤0)는 1, 1단계 위 0.3, 2단계 위 0.05, 3단계 이상 0.
 */
export function levelFactor(wordLevel: string | null | undefined, ceiling: string | null | undefined): number {
  const w = rankOf(wordLevel)
  const c = rankOf(ceiling)
  if (w < 0 || c < 0) return 1
  const d = w - c
  if (d <= 0) return 1
  if (d === 1) return 0.3
  if (d === 2) return 0.05
  return 0
}

/** 천장 = 지금 수준과 목표 수준 중 어려운 쪽. 목표가 없으면 지금 수준. 둘 다 알 수 없으면 `undefined`(= 가중 안 함). */
export function ceilingOf(level: string | null | undefined, goalLevel: string | null | undefined): LevelCode | undefined {
  const best = Math.max(rankOf(level), rankOf(goalLevel))
  return best < 0 ? undefined : LEVEL_ORDER[best]
}

/** 계수 0 인 단어의 최소 계수 — `ln(u)/w` 키가 유한하게 남아, 후보가 모자랄 때만 마지막으로 뽑힌다. */
export const LEVEL_FACTOR_FLOOR = 1e-9

export interface WeightInput {
  correctCount: number
  wrongCount: number
  lastSeenAt: Date | null
}

export function weightOf(w: WeightInput, now: Date): number {
  const base = Math.min(8, Math.max(0.25, 1 + 2 * w.wrongCount - 0.5 * w.correctCount))
  return base * recencyFactor(w.lastSeenAt, now)
}

/** Fisher-Yates(새 배열). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 가중 비복원 샘플링(Efraimidis–Spirakis): 항목마다 key = ln(u)/w 를 뽑아 큰 순서로 k 개. 입력 순서가 곧 난수 소비 순서라
 * 호출자가 순서를 고정해 줘야 재현된다(`generateWordSet` 이 id 로 정렬한다).
 */
export function sampleWeighted<T>(items: readonly T[], weights: readonly number[], k: number, rng: Rng): T[] {
  const keyed = items.map((item, i) => {
    const u = 1 - rng() // (0,1]
    return { item, key: Math.log(u) / weights[i], i }
  })
  keyed.sort((x, y) => y.key - x.key || x.i - y.i)
  return keyed.slice(0, Math.max(0, k)).map((x) => x.item)
}

export interface SetCandidate extends WeightInput {
  id: string
  /** 단어의 JLPT 단계 — 없으면 단계 계수를 적용하지 않는다. */
  jlpt?: LevelCode | null
}

/**
 * 풀에서 `count` 장을 가중 샘플링해 섞은 순서로 돌려준다. 같은 (후보 집합, 시드, now, ceiling) → 같은 결과.
 * `ceiling` 을 주면 단계 계수(`levelFactor`)를 곱한다 — 주지 않거나 후보에 `jlpt` 가 없으면 변경 전과 완전히 같다.
 */
export function generateWordSet<T extends SetCandidate>(pool: readonly T[], count: number, rng: Rng, now: Date, ceiling?: LevelCode | null): T[] {
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const weights = sorted.map((c) => (ceiling ? weightOf(c, now) * Math.max(levelFactor(c.jlpt, ceiling), LEVEL_FACTOR_FLOOR) : weightOf(c, now)))
  const picked = sampleWeighted(sorted, weights, Math.min(count, sorted.length), rng)
  return shuffle(picked, rng)
}
