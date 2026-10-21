/**
 * task-081 PE «회귀 확인» — `tests/prompts/lesson-pieces-live.ts` 의 PLAN=reg(복습·상황·붙여넣기 3회) 시험. 호출 0.
 * 위치: `src/**` 는 이번 소환의 편집 범위 밖이라 `tests/prompts/` 에 둔다 — `npm test`(src 만 찾는다)에는 안 잡히므로 미러에서 직접 돌린다:
 *   cd ~/.node-local/thekaiwa-pe081 && node --import tsx --test src/modules/conversation/__tests__/lessonPiecesLiveReg.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HARD_CAP, KIND_CAP, buildPlan, buildRequest, compareById, type Row } from '../../../../tests/prompts/lesson-pieces-live'
import { PIECES_INSTRUCTION_LINE } from '../prompts/piecesInstruction'

test('reg 계획: 정확히 3건 — core 의 R-6·S-cafe-order-N5·SRC-paste-N4 와 «같은 입력·같은 id»(객체까지 동일)', () => {
  const reg = buildPlan('reg')
  const core = buildPlan('core')
  assert.deepEqual(reg.map((p) => p.id), ['R-6', 'S-cafe-order-N5', 'SRC-paste-N4'])
  assert.equal(reg.length, 3)
  for (const p of reg) assert.deepEqual(p, core.find((c) => c.id === p.id), `${p.id}: core 와 같은 입력`)
  assert.deepEqual(reg.map((p) => p.kind).sort(), ['REVIEW', 'SCENARIO', 'SOURCE'])
  assert.equal(new Set(reg.map((p) => p.id)).size, 3)
})

test('호출 상한: KIND_CAP.reg = 3, HARD_CAP 과 다른 계획의 상한은 그대로', () => {
  assert.equal(KIND_CAP.reg, 3)
  assert.equal(HARD_CAP, 20, 'HARD_CAP 불변')
  assert.deepEqual({ core: KIND_CAP.core, extra: KIND_CAP.extra, r2: KIND_CAP.r2 }, { core: 12, extra: 6, r2: 6 })
  assert.ok(KIND_CAP.reg <= HARD_CAP)
})

test('reg 요청: core 와 바이트 동일(system·user·스키마) · 조각 지침 정확히 1번', () => {
  const core = buildPlan('core')
  for (const p of buildPlan('reg')) {
    const a = buildRequest(p)
    const b = buildRequest(core.find((c) => c.id === p.id)!)
    assert.equal(a.system, b.system, `${p.id}: system 동일`)
    assert.deepEqual(a.messages, b.messages, `${p.id}: user 동일`)
    assert.deepEqual(a.jsonSchema, b.jsonSchema, `${p.id}: 스키마 동일`)
    assert.equal(a.system.split(PIECES_INSTRUCTION_LINE).length - 1, 1, `${p.id}: 조각 지침 정확히 1번`)
  }
})

test('가드(하위 프로세스, 호출 0): PLAN=reg MAX_CALLS=99 라도 상한은 3 이고, LIVE_OK 가 없으면 호출·원장 없이 계획만 출력한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reg-guard-'))
  try {
    const out = join(dir, 'reg.json')
    const env: NodeJS.ProcessEnv = { ...process.env, PLAN: 'reg', MAX_CALLS: '99', OUT: out }
    delete env.LIVE_OK
    delete env.DRY
    delete env.COMPARE
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'tests/prompts/lesson-pieces-live.ts'], { env, cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /계획\(reg\) 3회\(상한 MAX_CALLS=3, HARD_CAP=20\): R-6 S-cafe-order-N5 SRC-paste-N4/)
    assert.match(r.stdout, /LIVE_OK=task-081 이 없어 호출하지 않는다/)
    assert.ok(!existsSync(out), '결과 파일 없음')
    assert.ok(!existsSync(out.replace(/\.json$/, '') + '.calls.json'), '원장도 없음(호출 시도 0)')
    // LIVE_OK 가 틀려도 호출하지 않는다.
    const r2 = spawnSync(process.execPath, ['--import', 'tsx', 'tests/prompts/lesson-pieces-live.ts'], { env: { ...env, LIVE_OK: 'task-080' }, cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 })
    assert.match(r2.stdout, /LIVE_OK=task-081 이 없어 호출하지 않는다/)
    assert.ok(!existsSync(out.replace(/\.json$/, '') + '.calls.json'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('compareById: 같은 id 끼리 core·reg 값을 짝짓고, core 에 없으면 core=null', () => {
  const mk = (id: string, over: Partial<Row> = {}): Row => ({
    id, kind: 'REVIEW', level: 'N4', arm: 'v10', ok: true, elapsedMs: 38_000, attempts: 1, promptChars: 10_000,
    metrics: { lines: 1, nullLines: 0, pieceCount: 2, typedCount: 2, koNoHangul: 0, typeDist: {}, slashes: 0, koLenMean: 2, outChars: 5000, piecesChars: 1500,
      flags: { particleNotLink: 0, particlePieces: 0, splitLines: 0, expressionLong: 0, slashNoneLines: 0, slashManyLines: 0, koLong: 0, lonelyCopula: 0, lonelyCopulaLines: 0, feelingVerbForm: 0, quantityNotName: 0, greetingAsAction: 0, koYoBad: 0, slashBeforeLink: 0 } },
    logs: {}, dialogue: [{ speaker: 'A', ja: '食べます', ko: 'x', pieces: [{ ja: '食べ', type: 'ACTION', ko: '먹', slash: false }, { ja: 'ます', type: 'ACTION', ko: '요', slash: false }] }],
    ...over,
  })
  const t = compareById([mk('R-6'), mk('X-only-core')], [mk('R-6', { elapsedMs: 41_000, arm: 'v10r2' }), mk('S-new')])
  assert.deepEqual(t.map((x) => x.id), ['R-6', 'S-new'])
  assert.equal(t[0].core?.elapsedMs, 38_000)
  assert.equal(t[0].reg?.elapsedMs, 41_000)
  assert.equal(t[0].reg?.flags?.splitLines, 1, '저장된 dialogue 를 현재 분석기로 다시 센다(食べ｜ます)')
  assert.equal(t[1].core, null)
})
