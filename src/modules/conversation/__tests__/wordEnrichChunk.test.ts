/**
 * task-068 D5/J12 — (1) 선생님 초안(`wordEnrich@v2`)의 조각 정확도 픽스처 구조 (2) **5번째 조각 유형 `EXPRESSION` 이 단어 보강 밖으로 새지 않는다**.
 * 라이브 호출 0 · DB 0 — 정확도 실측은 `tests/prompts/word-enrich-chunk-live.ts`(별도, 호출 상한 40).
 *
 * J12(Leader 확정): 교정·수업·평가·주제 프롬프트의 조각 enum 은 **4유형 그대로**다(예외 1곳: task-081 수업 «조각(pieces)» 6유형 — schemas.ts 의 `PIECE_TYPES`·`LESSON_SCHEMA` 에만). `EXPRESSION` 은 단어장 전용이라 DB `ChunkType` 이 5개로
 * 늘어도 모델이 교정/수업 응답에서 그 값을 내면 안 된다(내면 교정 화면의 조각 칩 4종·수업 조각 조립이 깨진다).
 * 고정 방법 3겹: ① `structuredResponse/`·`prompts/` 모듈이 내보내는 **모든 스키마·배열**을 훑어 'NAME'·'ACTION' 을 가진 enum 이 정확히 4값인지
 * ② 같은 폴더 소스 줄에 `chunkType` 과 맨 낱말 `EXPRESSION` 이 함께 있는지 ③ 강사 페르소나 §5 가 네 유형 문장 그대로인지. 각 검사기는 변이본으로 빈 증명이 아님을 보인다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CHUNK_TYPES, PIECE_TYPES } from '../structuredResponse/schemas'
import { buildWordEnrichRequest, WORD_CHUNK_TYPES, WORD_ENRICH_PROMPT_VERSION } from '../prompts/wordEnrich'

const ROOT = process.cwd()
const CONV = join(ROOT, 'src/modules/conversation')

// ── (1) 조각 정확도 픽스처 구조 ──────────────────────────────────────────────────────────────────────────

interface ChunkItem { id: string; surface: string; level: string; expected: string; group: string; seedChunk: string | null; inPrompt?: boolean; note?: string }
interface InfoItem { id: string; surface: string; level: string; acceptable: string[]; note?: string }
interface ChunkFixture {
  version: string
  promptExamples: string[]
  passLine: { total: number; min: number }
  baseline: { promptVersion: string; knownMisses: Record<string, string>; firstPass: { scored: string } }
  items: ChunkItem[]
  info: InfoItem[]
  invalid: Array<{ id: string; surface: string }>
}
const fx = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/word-enrich-chunk.json'), 'utf8')) as ChunkFixture
const system = buildWordEnrichRequest({ surface: '映画', level: 'N5' }).system

test('조각 픽스처: 25단어·합격선 22/25·id/표기 중복 없음·기대값은 5유형 안', () => {
  assert.equal(fx.version, 'word-enrich-chunk@v1')
  assert.equal(fx.items.length, 25)
  assert.deepEqual(fx.passLine, { total: 25, min: 22 })
  assert.equal(new Set(fx.items.map((i) => i.id)).size, fx.items.length, 'id 중복')
  assert.equal(new Set([...fx.items, ...fx.info].map((i) => i.surface)).size, fx.items.length + fx.info.length, '표기 중복')
  for (const it of fx.items) assert.ok((WORD_CHUNK_TYPES as readonly string[]).includes(it.expected), `${it.id} 기대값 ${it.expected}`)
  for (const it of fx.info) {
    assert.ok(it.acceptable.length >= 2)
    for (const a of it.acceptable) assert.ok((WORD_CHUNK_TYPES as readonly string[]).includes(a), `${it.id} 허용값 ${a}`)
  }
})

test('조각 픽스처: 측정 기준선(baseline)은 현재 프롬프트 버전이고 알려진 미스는 실제 항목이며, 무효 입력 2건이 있다', () => {
  assert.equal(fx.baseline.promptVersion, WORD_ENRICH_PROMPT_VERSION, '프롬프트 버전이 바뀌면 baseline 을 다시 재야 한다')
  for (const id of Object.keys(fx.baseline.knownMisses)) assert.ok(fx.items.some((i) => i.id === id), `knownMisses ${id}`)
  const [hit, total] = fx.baseline.firstPass.scored.split('/').map(Number)
  assert.ok(total === fx.passLine.total && hit >= fx.passLine.min, `기준선 ${fx.baseline.firstPass.scored} 가 합격선 안`)
  assert.deepEqual(fx.invalid.map((i) => i.id), ['x01', 'x02'])
})

test('조각 픽스처: 유형마다 4개 이상, 동작성 명사 5개 이상(勉強·準備 같은 — 품사만으로 틀리기 쉬운 사례), 표현 유형 5개 이상', () => {
  const count = (t: string) => fx.items.filter((i) => i.expected === t).length
  for (const t of WORD_CHUNK_TYPES) assert.ok(count(t) >= 4, `${t} ${count(t)}개`)
  assert.ok(fx.items.filter((i) => i.group === 'ACTION_NOUN').length >= 5)
  assert.ok(fx.items.filter((i) => i.group === 'ACTION_NOUN').every((i) => i.expected === 'ACTION'))
  assert.ok(count('EXPRESSION') >= 5)
})

test('조각 픽스처: 기존 시드 분류(seedChunk)가 있는 행은 기대값과 같다 — 기대표가 기존 분류와 어긋나지 않는다', () => {
  const withSeed = fx.items.filter((i) => i.seedChunk !== null)
  assert.ok(withSeed.length >= 15, `시드 근거가 있는 행 ${withSeed.length}`)
  for (const it of withSeed) {
    assert.ok((CHUNK_TYPES as readonly string[]).includes(it.seedChunk as string), `${it.id} seedChunk 는 4유형`)
    assert.equal(it.seedChunk, it.expected, `${it.id} ${it.surface}`)
  }
  // seedChunk null = 시드에서 조각이 비어 있던 행(= 표현·접사·조사·대명사 의문어) 또는 시드에 없는 표기 — 새 유형 EXPRESSION 이 전부 여기에 있다.
  assert.ok(fx.items.filter((i) => i.expected === 'EXPRESSION').every((i) => i.seedChunk === null))
})

test('조각 픽스처: 지시문에 예로 적힌 낱말(勉強·準備·挨拶)만 inPrompt, 나머지 22단어는 지시문에 나오지 않는다(일반화 확인 집합이 오염되지 않음)', () => {
  assert.deepEqual(fx.promptExamples, ['勉強', '準備', '挨拶'])
  assert.deepEqual(fx.items.filter((i) => i.inPrompt).map((i) => i.surface), fx.promptExamples)
  for (const w of fx.promptExamples) assert.ok(system.includes(w), `${w} 가 지시문에 있다`)
  const heldOut = fx.items.filter((i) => !i.inPrompt)
  assert.equal(heldOut.length, 22)
  for (const it of [...heldOut, ...fx.info]) assert.ok(!system.includes(it.surface), `${it.surface} 가 지시문에 새어 있다 — 보류 집합이 오염된다`)
})

// ── (2) J12: 교정·수업·평가·주제의 조각 enum 은 4유형 그대로 ─────────────────────────────────────────────────

/** 리터럴로 고정한다 — `CHUNK_TYPES` 상수에서 계산하면 상수가 바뀔 때 기대값도 같이 바뀌어 아무것도 못 잡는다. */
const FOUR = ['ACTION', 'FEELING', 'MODIFIER', 'NAME']

/** 'NAME'·'ACTION' 을 함께 가진 문자열 배열(= 조각 enum 후보)을 객체 안 어디서든 찾는다. */
function collectChunkLikeArrays(node: unknown, path: string, out: Array<{ path: string; values: string[] }>, seen = new WeakSet<object>(), depth = 0): void {
  if (node === null || typeof node !== 'object' || depth > 40) return
  if (seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every((x) => typeof x === 'string')) {
      const vals = node as string[]
      if (vals.includes('NAME') && vals.includes('ACTION')) out.push({ path, values: vals })
    }
    node.forEach((x, i) => collectChunkLikeArrays(x, `${path}[${i}]`, out, seen, depth + 1))
    return
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) collectChunkLikeArrays(v, `${path}.${k}`, out, seen, depth + 1)
}

/** 4유형이 아닌 조각 enum 후보의 경로를 돌려준다. */
function notFour(found: Array<{ path: string; values: string[] }>): string[] {
  return found.filter((f) => JSON.stringify([...f.values].sort()) !== JSON.stringify(FOUR)).map((f) => `${f.path}=${f.values.join('|')}`)
}

const SCAN_DIRS = ['structuredResponse', 'prompts'] as const
const listTs = (dir: string) => readdirSync(join(CONV, dir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

test('J12 스키마: structuredResponse/·prompts/ 가 내보내는 모든 값 중 조각 enum(NAME·ACTION 포함)은 정확히 4유형 — wordEnrich.ts 만 5유형', async () => {
  const found: Array<{ path: string; values: string[] }> = []
  let modules = 0
  let built = 0
  for (const dir of SCAN_DIRS) {
    for (const f of listTs(dir)) {
      if (dir === 'prompts' && f === 'wordEnrich.ts') continue // 단어 보강만 5유형을 낸다 — 아래 별도 시험
      const mod = (await import(pathToFileURL(join(CONV, dir, f)).href)) as Record<string, unknown>
      modules++
      for (const [name, value] of Object.entries(mod)) {
        collectChunkLikeArrays(value, `${dir}/${f}#${name}`, found)
        // 평가 스키마처럼 상수가 아니라 빌더 함수(`build*Schema`)가 스키마를 만든다 — 인자 없이 되는 것은 그대로, 평가 생성은 두 종류 인자로 불러 그 결과도 훑는다.
        if (typeof value === 'function' && /^build\w*Schema$/.test(name)) {
          const argSets: unknown[][] = name === 'buildEvalGenSchema' ? [['WORDS'], ['TALK']] : [[]]
          for (const args of argSets) {
            try {
              collectChunkLikeArrays((value as (...a: unknown[]) => unknown)(...args), `${dir}/${f}#${name}(${args.join(',')})`, found)
              built++
            } catch {
              /* 인자가 필요한 다른 빌더는 건너뛴다 — 조각 enum 이 없는 스키마들이다 */
            }
          }
        }
      }
    }
  }
  assert.ok(modules >= 25, `훑은 모듈 ${modules}`)
  assert.ok(built >= 2, `빌더로 만든 스키마 ${built}개 — 평가 생성(WORDS·TALK) 최소 2개`)
  // 빈 증명 방지 — 실제로 조각 enum 이 여러 곳(교정·수업·평가·주제 스키마와 CHUNK_TYPES 상수)에서 발견돼야 한다.
  assert.ok(found.length >= 6, `조각 enum 발견 ${found.length}곳: ${found.map((f) => f.path).join(', ')}`)
  const files = new Set(found.map((f) => f.path.split('#')[0]))
  for (const must of ['structuredResponse/schemas.ts', 'structuredResponse/evalSchemas.ts', 'structuredResponse/topicDraftSchemas.ts']) assert.ok(files.has(must), `${must} 에서 조각 enum 을 못 찾음`)
  // task-081(사용자 Q9 A 승인): 수업 «조각(pieces)» 은 6유형(+EXPRESSION·LINK)이다 — 그 enum 은 `structuredResponse/schemas.ts` 의 `PIECE_TYPES`·`LESSON_SCHEMA` 두 곳에만 있어야 한다. 그 밖은 여전히 4유형.
  const isPieceEnum = (f: { values: string[] }) => f.values.length === PIECE_TYPES.length && PIECE_TYPES.every((v) => f.values.includes(v))
  const pieceEnums = found.filter(isPieceEnum)
  assert.ok(pieceEnums.length >= 2, `수업 조각 enum(6유형) 발견 ${pieceEnums.length}곳 — PIECE_TYPES·LESSON_SCHEMA`)
  for (const f of pieceEnums) assert.match(f.path, /^structuredResponse\/schemas\.ts#(PIECE_TYPES|LESSON_SCHEMA)/, `6유형 조각 enum 이 허용된 곳 밖에 있다: ${f.path}`)
  assert.deepEqual(notFour(found.filter((f) => !isPieceEnum(f))), [], '4유형이 아닌 조각 enum — 교정·평가·주제 프롬프트는 EXPRESSION 을 내면 안 된다(J12). 수업 pieces 만 6유형 예외(task-081)')
})

test('J12 스키마 검사기는 빈 증명이 아니다 — 변이(5번째 값 추가·값 하나 빠짐)를 각각 잡는다', () => {
  const ok = { properties: { chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: ['NAME', 'ACTION', 'FEELING', 'MODIFIER'] }] } } }
  const withExpr = { properties: { chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] }] } } }
  const missing = { items: [{ type: 'string', enum: ['NAME', 'ACTION', 'FEELING'] }] }
  const run = (v: unknown) => { const f: Array<{ path: string; values: string[] }> = []; collectChunkLikeArrays(v, 'x', f); return f }
  assert.equal(run(ok).length, 1)
  assert.deepEqual(notFour(run(ok)), [])
  assert.equal(notFour(run(withExpr)).length, 1, '5번째 값 EXPRESSION 이 섞인 enum')
  assert.equal(notFour(run(missing)).length, 1, '값이 빠진 enum')
  // 5유형 상수 배열 자체도 후보로 잡혀야(수출 상수가 새는 경우)
  assert.equal(notFour(run({ LEAK: ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] })).length, 1)
})

test('wordEnrich.ts 만 5유형 — 출력 스키마의 조각 enum 은 WORD_CHUNK_TYPES 이고 CHUNK_TYPES 는 그대로 4개', async () => {
  const mod = (await import(pathToFileURL(join(CONV, 'prompts/wordEnrich.ts')).href)) as Record<string, unknown>
  const found: Array<{ path: string; values: string[] }> = []
  for (const [name, value] of Object.entries(mod)) collectChunkLikeArrays(value, name, found)
  assert.deepEqual(found.filter((f) => f.path.startsWith('WORD_ENRICH_OUTPUT_SCHEMA')).map((f) => f.values), [[...WORD_CHUNK_TYPES]])
  assert.deepEqual([...CHUNK_TYPES], ['NAME', 'ACTION', 'FEELING', 'MODIFIER'], 'CHUNK_TYPES(교정·수업·평가·주제 공용)는 4유형 그대로')
  assert.equal(WORD_CHUNK_TYPES.length, 5)
})

/** 한 줄에 `chunkType`(또는 chunk_type) 과 맨 낱말 `EXPRESSION` 이 같이 있는 줄(= 조각 유형으로 EXPRESSION 을 쓰는 코드·지시문) 목록. */
function chunkExpressionLines(src: string): string[] {
  return src.split('\n').filter((line) => /chunk_?type/i.test(line) && /\bEXPRESSION\b/.test(line))
}

test('J12 소스 스캔: structuredResponse/·prompts/ 소스(wordEnrich.ts 제외)에 chunkType 과 EXPRESSION 을 한 줄에 쓰는 곳이 없다', () => {
  const hits: string[] = []
  let scanned = 0
  for (const dir of SCAN_DIRS) {
    for (const f of listTs(dir)) {
      if (dir === 'prompts' && f === 'wordEnrich.ts') continue
      scanned++
      for (const line of chunkExpressionLines(readFileSync(join(CONV, dir, f), 'utf8'))) hits.push(`${dir}/${f}: ${line.trim().slice(0, 120)}`)
    }
  }
  assert.ok(scanned >= 25)
  assert.deepEqual(hits, [])
})

test('J12 소스 스캔기는 빈 증명이 아니다 — 변이 줄은 잡고, 무관한 EXPRESSION(품사·itemType) 줄은 안 잡는다', () => {
  assert.equal(chunkExpressionLines("  chunkType: { type: 'string', enum: ['NAME', 'EXPRESSION'] },").length, 1)
  assert.equal(chunkExpressionLines('- chunk_type: NAME|ACTION|EXPRESSION').length, 1)
  assert.equal(chunkExpressionLines("export const PART_OF_SPEECH = ['NOUN', 'EXPRESSION', 'OTHER'] as const").length, 0)
  assert.equal(chunkExpressionLines("itemType: 'EXPRESSION' | 'CHUNK' | 'GRAMMAR'").length, 0)
  assert.equal(chunkExpressionLines('SCENARIO_EXPRESSION_MAX chunkType').length, 0, '낱말 경계: SCENARIO_EXPRESSION_MAX 는 다른 이름')
})

test('J12 페르소나: tutor.md 는 조각을 네 유형으로만 말한다(EXPRESSION 없음) — 수업 조각 분류가 5번째 값으로 새지 않는다', () => {
  const tutor = readFileSync(join(ROOT, '.claude/agents/tutor.md'), 'utf8')
  assert.ok(!/\bEXPRESSION\b/.test(tutor), 'tutor.md 에 EXPRESSION 이 있다 — 페르소나는 조각 4유형 프레임')
  assert.match(tutor, /레슨의 `chunks` 는 반드시 이 네 유형 중 하나로 분류/)
})
