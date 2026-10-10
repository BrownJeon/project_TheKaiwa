/**
 * JLPT 시드 검증(task-051) — 통과하지 못한 파일은 시드에 넣지 않는다. build.ts 가 단계마다 부르고, 사람이 따로 돌릴 수도 있다.
 *
 *   node --import tsx scripts/seed-build/validate.ts --repo <저장소 루트> [--raw DIR] [--levels N5,N4]
 *
 * hard(실패): 7필드·키 순서, 빈 값, 품사·조각 enum, 읽기 가나, 뜻 한글·일본어 문자·길이, 예문 문자·길이·표제어 포함, 번역 문자·길이,
 *             원본(OpenJLPT)에 없는 (표기, 읽기)·원본 순서 위반, 단계 안 (표기, 읽기) 중복, `seedPackCounts.ts` 와 파일 길이 불일치,
 *             cp932 로 인코딩되지 않는 글자(표기·읽기·예문), 원본 디렉터리 없음(`--allow-missing-raw` 면 경고 + 종료 코드 4),
 *             N5: 기존 `words-n5.json` 50개가 (표기, 읽기)로 모두 있음(철자 차이 짝은 상대 표기로) · 병합 행은 기존 값 그대로·원본 행 뒤에 기존 순서로.
 * 보고(실패 아님): 단계 간 (표기, 읽기) 중복, 단계 간 표기만 같은 단어 수, 기존 `words-n5.json` 50개와 겹치는 수, soft 코드 수.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  CHUNK_TYPES, KANA_ONLY, LEGACY_SPELLING_VARIANTS, LEVELS, PARTS_OF_SPEECH, SEED_RECORD_KEYS, exampleCodes, meaningCodes, nonCp932Chars,
  type SeedRecord, type VocabLevel, type VocabSource,
} from './enrich'

export interface ValidateOptions {
  repo: string
  raw: string
  levels: readonly VocabLevel[]
  /** 단계별로 정식 파일 대신 읽을 경로(build.ts 가 rename 전 `.next` 파일을 검사할 때). */
  fileOverride?: Partial<Record<VocabLevel, string>>
  /** `src/types/seedPackCounts.ts` 와 파일 길이 대조(다섯 파일이 모두 있을 때만). */
  checkCounts: boolean
  /** 원본(raw) 파일이 없을 때 실패 대신 원본 대조만 건너뛰고 `rawMissing` 에 남긴다(종료 코드 4 — 통과로 치지 않는다). */
  allowMissingRaw?: boolean
}
export interface ValidateReport { hardTotal: number; rawMissing: VocabLevel[]; text: string; perLevel: Record<string, { records: number; hard: Record<string, number>; soft: Record<string, number> }> }

const STR_KEYS = ['surface', 'reading', 'meaning', 'example', 'exampleKo'] as const
const key = (s: string, r: string) => `${s}\u0000${r}`

function levelPath(o: ValidateOptions, level: VocabLevel): string {
  return o.fileOverride?.[level] ?? join(o.repo, 'prisma', 'seed-data', 'jlpt', `${level.toLowerCase()}.json`)
}

function loadRaw(rawDir: string, level: VocabLevel): VocabSource[] | null {
  const p = join(rawDir, `${level.toLowerCase()}.json`)
  if (!existsSync(p)) return null
  return (JSON.parse(readFileSync(p, 'utf8')) as { word: string; reading: string; pos?: string[]; meanings?: string[] }[])
    .map((r) => ({ word: r.word, reading: r.reading, pos: r.pos ?? [], meanings: r.meanings ?? [] }))
}

/** 레코드 한 개의 hard·soft 코드. `src` 가 없으면(원본 없음·기존 50개 병합 행) 예문 표제어 검사는 어간 규칙 없이 보고, 못 찾으면 soft(미확인)로 남긴다. */
export function checkRecord(rec: unknown, src: VocabSource | null): { hard: string[]; soft: string[] } {
  const hard: string[] = []
  const soft: string[] = []
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { hard: ['NOT_OBJECT'], soft }
  const r = rec as Record<string, unknown>
  const keys = Object.keys(r)
  if (keys.length !== SEED_RECORD_KEYS.length || keys.some((k, i) => k !== SEED_RECORD_KEYS[i])) hard.push('KEYS')
  for (const k of STR_KEYS) if (typeof r[k] !== 'string' || !(r[k] as string).trim()) hard.push(`EMPTY_${k}`)
  if (typeof r.partOfSpeech !== 'string' || !(PARTS_OF_SPEECH as readonly string[]).includes(r.partOfSpeech)) hard.push('ENUM_POS')
  if (r.chunkType !== null && (typeof r.chunkType !== 'string' || !(CHUNK_TYPES as readonly string[]).includes(r.chunkType))) hard.push('ENUM_CHUNK')
  if (hard.some((h) => h.startsWith('EMPTY_') || h === 'NOT_OBJECT')) return { hard, soft }
  const s = r as unknown as SeedRecord
  if (!KANA_ONLY.test(s.reading)) hard.push('READING_KANA')
  if (nonCp932Chars(s.surface).length || nonCp932Chars(s.reading).length) hard.push('NOT_CP932')
  if ([...s.surface].length > 80) hard.push('SURFACE_LEN') // api-contract #41 한도
  const m = meaningCodes(s.meaning)
  hard.push(...m.hard)
  soft.push(...m.soft)
  if (s.example !== s.example.trim() || s.exampleKo !== s.exampleKo.trim()) hard.push('EXAMPLE_WHITESPACE')
  const e = exampleCodes(s.example, s.exampleKo, src ?? { word: s.surface, reading: s.reading, pos: [] })
  // 원본이 없으면 품사태그(어간 규칙)를 몰라 활용형 예문을 판정할 수 없다 — 표제어 검사만 「미확인」 soft 로(원본 없음은 호출자가 따로 실패/INCOMPLETE 처리).
  hard.push(...(src ? e.hard : e.hard.filter((c) => c !== 'EXJA_NO_HEADWORD')))
  if (!src && e.hard.includes('EXJA_NO_HEADWORD')) soft.push('EXJA_HEADWORD_UNCHECKED')
  soft.push(...e.soft)
  return { hard, soft }
}

export function validateLevels(o: ValidateOptions): ValidateReport {
  const out: string[] = []
  const perLevel: ValidateReport['perLevel'] = {}
  let hardTotal = 0
  const rawMissing: VocabLevel[] = []
  const legacyPath = join(o.repo, 'prisma', 'seed-data', 'words-n5.json')
  const legacy = existsSync(legacyPath) ? (JSON.parse(readFileSync(legacyPath, 'utf8')) as SeedRecord[]) : null
  const legacyByKey = new Map((legacy ?? []).map((w, i) => [key(w.surface, w.reading), { w, i }]))
  const loaded = new Map<VocabLevel, SeedRecord[]>()
  for (const level of LEVELS) {
    const p = levelPath(o, level)
    if (existsSync(p)) loaded.set(level, JSON.parse(readFileSync(p, 'utf8')) as SeedRecord[])
  }
  for (const level of o.levels) {
    const recs = loaded.get(level)
    if (!recs) { out.push(`${level}: 파일 없음 (${levelPath(o, level)})`); hardTotal++; continue }
    const raw = loadRaw(o.raw, level)
    const rawIndex = raw ? new Map(raw.map((s, i) => [key(s.word, s.reading), i])) : null
    if (!raw) rawMissing.push(level)
    const hard: Record<string, number> = {}
    const soft: Record<string, number> = {}
    const examples: string[] = []
    const bump = (t: Record<string, number>, c: string) => { t[c] = (t[c] ?? 0) + 1 }
    const seen = new Set<string>()
    let lastIdx = -1
    let lastLegacy = -1
    if (!Array.isArray(recs)) { out.push(`${level}: 배열이 아님`); hardTotal++; continue }
    recs.forEach((rec, i) => {
      const r = rec as Partial<SeedRecord>
      const k = key(String(r.surface), String(r.reading))
      const at = rawIndex?.get(k)
      const codes = checkRecord(rec, at !== undefined && raw ? raw[at]! : null)
      const old = level === 'N5' && rawIndex && at === undefined ? legacyByKey.get(k) : undefined
      if (old) {
        // 병합된 기존 행(REV-179 M3): 기존 값 그대로, 원본 행 뒤에 기존 순서로.
        if (SEED_RECORD_KEYS.some((f) => (rec as unknown as Record<string, unknown>)[f] !== old.w[f])) codes.hard.push('LEGACY_CHANGED')
        if (old.i <= lastLegacy) codes.hard.push('LEGACY_ORDER')
        lastLegacy = old.i
      } else if (rawIndex) {
        if (at === undefined) codes.hard.push('NOT_IN_SOURCE')
        else if (at <= lastIdx || lastLegacy >= 0) codes.hard.push('ORDER')
        else lastIdx = at
      }
      if (seen.has(k)) codes.hard.push('DUP_IN_LEVEL')
      seen.add(k)
      for (const c of codes.hard) bump(hard, c)
      for (const c of codes.soft) bump(soft, c)
      if (codes.hard.length && examples.length < 10) examples.push(`  [${i}] ${r.surface}(${r.reading}) ${codes.hard.join(',')}`)
    })
    const nHard = Object.values(hard).reduce((a, b) => a + b, 0)
    hardTotal += nHard
    perLevel[level] = { records: recs.length, hard, soft }
    if (!raw && !o.allowMissingRaw) { bump(hard, 'RAW_MISSING'); hardTotal++ }
    out.push(`${level}: ${recs.length}개 · 원본 ${raw ? raw.length : `없음(${join(o.raw, `${level.toLowerCase()}.json`)})`}${lastLegacy >= 0 ? ' · 기존 50개 병합 포함' : ''} · hard ${nHard} ${JSON.stringify(hard)} · soft ${JSON.stringify(soft)}`)
    out.push(...examples)
  }

  // 단계 간 비교·기존 50개 겹침 — 실패가 아니라 보고(같은 표기·다른 읽기는 다른 단어 — Leader 결정 2026-10-10).
  const pairLevels = new Map<string, VocabLevel[]>()
  const surfaceLevels = new Map<string, Set<VocabLevel>>()
  for (const [level, recs] of loaded) {
    for (const r of recs) {
      const k = key(r.surface, r.reading)
      pairLevels.set(k, [...(pairLevels.get(k) ?? []), level])
      surfaceLevels.set(r.surface, (surfaceLevels.get(r.surface) ?? new Set()).add(level))
    }
  }
  const crossPair = [...pairLevels].filter(([, v]) => new Set(v).size > 1)
  const crossSurface = [...surfaceLevels].filter(([, v]) => v.size > 1)
  out.push(`단계 간 (표기, 읽기) 중복: ${crossPair.length}${crossPair.length ? ` — ${crossPair.slice(0, 10).map(([k, v]) => `${k.replace('\u0000', '/')}[${v.join(',')}]`).join(' ')}` : ''}`)
  out.push(`단계 간 표기만 같은 단어(읽기 다름 — 정상): ${crossSurface.length - crossPair.length}`)
  if (legacy) {
    const byPair = legacy.filter((w) => pairLevels.has(key(w.surface, w.reading)))
    const bySurface = legacy.filter((w) => surfaceLevels.has(w.surface))
    out.push(`기존 words-n5.json ${legacy.length}개와 겹침(정상 — 삽입 때 건너뜀): (표기, 읽기) ${byPair.length} · 표기만 ${bySurface.length}`
      + ` · 표기는 같고 읽기가 다른 것: ${bySurface.filter((w) => !pairLevels.has(key(w.surface, w.reading))).map((w) => `${w.surface}/${w.reading}`).join(' ') || '없음'}`)
    const n5 = loaded.get('N5')
    if (n5 && o.levels.includes('N5')) {
      const n5Keys = new Set(n5.map((r) => key(r.surface, r.reading)))
      const missing = legacy.filter((w) => !n5Keys.has(key(w.surface, w.reading)) && !(LEGACY_SPELLING_VARIANTS[w.surface] && n5Keys.has(key(LEGACY_SPELLING_VARIANTS[w.surface]!, w.reading))))
      const variants = legacy.filter((w) => !n5Keys.has(key(w.surface, w.reading)) && !missing.includes(w))
      out.push(`기존 50개 → N5 보장: 빠진 것 ${missing.length}${missing.length ? ` — ${missing.map((w) => `${w.surface}/${w.reading}`).join(' ')}` : ''}`
        + ` · 철자 차이 짝으로 대신한 것: ${variants.map((w) => `${w.surface}→${LEGACY_SPELLING_VARIANTS[w.surface]}/${w.reading}`).join(' ') || '없음'}`)
      hardTotal += missing.length
    }
  }
  if (rawMissing.length) out.push(`⚠ 원본 없음(${rawMissing.join('·')}) — 원본 대조(NOT_IN_SOURCE·ORDER·어간 규칙)를 하지 못했다${o.allowMissingRaw ? ' — --allow-missing-raw: 통과로 치지 않음(종료 코드 4)' : ''}`)

  if (o.checkCounts && LEVELS.every((l) => loaded.has(l))) {
    const p = join(o.repo, 'src', 'types', 'seedPackCounts.ts')
    const txt = existsSync(p) ? readFileSync(p, 'utf8') : ''
    const bad = LEVELS.filter((l) => Number(txt.match(new RegExp(`\\b${l}:\\s*(\\d+)`))?.[1]) !== loaded.get(l)!.length)
    out.push(`seedPackCounts.ts 대조: ${bad.length ? `불일치 ${bad.join(',')}` : '일치'}`)
    hardTotal += bad.length
  }
  out.push(`결과: ${hardTotal > 0 ? `VALIDATE_FAILED (hard ${hardTotal})` : rawMissing.length ? 'VALIDATE_INCOMPLETE (원본 없음)' : 'VALIDATE_PASSED'}`)
  return { hardTotal, rawMissing, text: out.join('\n'), perLevel }
}

function main(): void {
  const argv = process.argv.slice(2)
  const get = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
  const repo = get('repo')
  if (!repo) throw new Error('--repo <저장소 루트> 가 필요합니다')
  const levels = (get('levels') ?? LEVELS.join(',')).split(',').map((s) => s.trim().toUpperCase()) as VocabLevel[]
  const allowMissingRaw = argv.includes('--allow-missing-raw')
  const report = validateLevels({ repo: resolve(repo), raw: resolve(get('raw') ?? join(homedir(), '.node-local', 'thekaiwa-seedwork', 'raw')), levels, checkCounts: true, allowMissingRaw })
  console.log(report.text)
  if (report.hardTotal > 0) process.exitCode = 1
  else if (report.rawMissing.length) process.exitCode = 4
}

if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) {
  try { main() } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1 }
}
