/**
 * task-012c REV-056(Codex C2 부분 채택) — 일반 STRING·PATH·URL·JSON 설정 값의 비밀 유사 문자열 거부.
 *
 * - 판정 규칙은 reason 과 같은 `isSecretLikeText` 하나(role-permission §7 ③). 자유 문장 키(`freeText` = 미리듣기 문장)는 전체 규칙,
 *   그 밖(모델명·id·경로·주소·JSON)은 "긴 토큰" 규칙만 뺀다 — 모델 id·경로 오탐 방지.
 * - 거부는 `secretValue`(stage SCHEMA) 한 건, 입력 값은 오류 어디에도 싣지 않는다.
 * - 쓰기 진입점(Validate·Diff·Test·Apply·Raw dryRun/적용·#93·#100·#123b·Rollback)은 전부 `validatePatch` → `checkEditValue` 를 지나고,
 *   Rollback 은 스냅샷 값 전체도 `checkEditValue` 로 다시 본다(snapshotIntegrity·planRestore) — 그래서 오탐은 곧 되돌리기 불가다. 기본값·시드 값 전수 통과를 여기서 고정한다.
 * - (Codex C2 재검토, REV-062 대상) 비자유 키는 긴 토큰 규칙 대신 "구분 기호 없는 긴 혼합 런"(`[A-Za-z0-9_+=]` ≥32자·문자 종류 ≥3) 보강 규칙 —
 *   경계표·L4 가드(창 23자가 기대는 reason.ts 규칙 길이)·L6(폭 0 삽입 github_pat_·bearer)는 파일 아래쪽.
 * DB 행 수(거부 시 ConfigurationVersion·AuditLog 0)는 라이브 확인(이력서 Developer 기록)에서 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codePointLength, isSecretLikeText } from '@/modules/infra'
import { connectionKeyDefs, FALLBACK_KEY_DEFS, type EditKeyDef } from '../configuration/keys'
import { APP_SETTING_SCHEMA, appSettingKeyDefs, DEFAULT_VOICE_KEY, PREVIEW_TEXT_KEY } from '../configuration/appSettingSchema'
import { checkEditValue, MIXED_RUN_KINDS, MIXED_RUN_MIN, NO_LONG_TOKEN_WINDOW, validatePatch } from '../configuration/validate'
import { planRestore, snapshotIntegrity } from '../configuration/rollback'
import { applyConnectionPatch, connectionFlat, connectionManaged, connectionSnapshot, type ConnectionManaged } from '../configuration/shapes'
import { getConfigurationSchema } from '../registry'

const MESSAGE = '비밀처럼 보이는 글자가 있어 저장하지 않았어요.'
const PREVIEW = appSettingKeyDefs(PREVIEW_TEXT_KEY)![0]
const VOICE = appSettingKeyDefs(DEFAULT_VOICE_KEY)![0]
const FALLBACK_IDS = FALLBACK_KEY_DEFS.find((d) => d.key === 'fallbackConnectionIds')!

function defsOf(engineId: string, type: string): EditKeyDef[] {
  const schema = getConfigurationSchema(engineId)
  assert.ok(schema, engineId)
  return connectionKeyDefs(schema, type)
}
function defOf(engineId: string, type: string, key: string): EditKeyDef {
  const d = defsOf(engineId, type).find((x) => x.key === key)
  assert.ok(d, `${engineId}/${type} ${key}`)
  return d
}

const MODEL_FAST = defOf('claude-cli', 'CLI', 'runtime.modelByTier.fast')
const M4_MODEL = defOf('home-m4-api', 'HTTP', 'runtime.model')
const MODEL_VERSION = defOf('sherpa-onnx-reazon', 'ONDEVICE', 'runtime.modelVersion')
const BIN_PATH = defOf('claude-cli', 'CLI', 'connection.binPath')
const TTS_URL = defOf('style-bert-vits2', 'HTTP', 'connection.baseUrl')

function rejected(def: EditKeyDef, value: unknown, label = JSON.stringify(value)): void {
  const issues = checkEditValue(def, value)
  assert.deepEqual(issues, [{ key: def.key, rule: 'secretValue', message: MESSAGE }], `${def.key} ← ${label}`)
  const text = JSON.stringify(issues)
  for (const needle of ['hunter2', 'abcdefgh', 'ABCdef', 'eyJ']) assert.ok(!text.includes(needle), `오류에 입력 값이 들어갔다: ${label}`)
}
function passes(def: EditKeyDef, value: unknown): void {
  assert.deepEqual(checkEditValue(def, value), [], `${def.key} ← ${JSON.stringify(value)}`)
}
const noSecretIssue = (def: EditKeyDef, value: unknown) => checkEditValue(def, value).filter((i) => i.rule === 'secretValue')

test('자유 문장(미리듣기 문장) — 키=값·접두·JWT·인증 스킴·긴 토큰, 전각·폭 0 변형까지 secretValue 로 거부하고 값은 싣지 않는다', () => {
  assert.equal(PREVIEW.freeText, true)
  for (const v of [
    'password=hunter2',
    'token: abc',
    'こんにちは。password = hunter2 です。',
    'API_KEY=abc',
    'secret:x',
    'ｐａｓｓｗｏｒｄ＝ｘ',
    'pass​word=x',
    'to‍ke﻿n: abc',
    'pass­word⁠=x',
    'ｓｋ－ａｂｃｄｅｆｇｈ１２３４',
    'sk-abcdefgh12345678',
    'ghp_abcdefgh12345678',
    'xoxb-abcdefgh1234',
    'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeKKF2',
    'Bearer abcdefgh12345',
    'aB3dE5fG7hJ9kL1mN3pQ5rS7tU',
  ]) {
    rejected(PREVIEW, v)
  }
})

test('자유 문장 — 정상 일본어 문장·기본 미리듣기 문장은 통과(토큰·パスワード 같은 일본어 낱말은 규칙 밖)', () => {
  passes(PREVIEW, APP_SETTING_SCHEMA[PREVIEW_TEXT_KEY].default)
  for (const v of ['こんにちは。今日も一緒に楽しく日本語を勉強しましょう。', 'はじめまして。私はハルカです。よろしくお願いします。', 'パスワードを忘れました。トークンが切れたかもしれません。', '駅まで歩いて10分です。', 'Hello, nice to meet you.']) {
    passes(PREVIEW, v)
  }
})

test('모델명·id(pattern 키) — 접두·키=값은 거부, 긴 모델 id 는 긴 토큰 규칙을 빼서 통과', () => {
  rejected(MODEL_FAST, 'sk-abcdefgh12345678')
  rejected(MODEL_FAST, 'ghp_abcdefgh12345678')
  rejected(MODEL_FAST, 'token:abc')
  rejected(MODEL_FAST, 'github_pat_ABCdef12345678')
  // 23자 창 밖(뒤쪽)의 접두도 잡는다.
  rejected(MODEL_FAST, 'claude-3-5-sonnet-20241022.sk-abcdefgh12345')
  rejected(M4_MODEL, 'org/some-very-long-model-name-2025/ghp_abcdefgh12345678')
  for (const v of ['haiku', 'sonnet', 'opus', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-5-20250929', 'claude-opus-4-1-20250805', 'claude-haiku-4-5-20251001', 'claude-opus-4-5', 'claude-sonnet-4-5']) {
    passes(MODEL_FAST, v)
  }
  for (const v of ['qwen2.5:14b', 'qwen2.5:14b-instruct', 'qwen2.5:14b-instruct-q4_K_M', 'qwen3:30b-a3b-instruct-2507-q4_K_M', 'library/qwen2.5-coder:32b-instruct-q8_0']) {
    passes(M4_MODEL, v)
  }
  // 창 첫 글자를 문자열 시작으로 오인하면 `task-…` 의 `sk-…` 를 접두로 잡는다(원 규칙은 앞 글자가 영숫자면 접두가 아니다).
  passes(MODEL_FAST, 'mytask-abcdefgh1234567890')
  for (const v of ['teacher_haruka', 'teacher_sakura', 'teacher_takumi']) passes(VOICE, v)
})

test('pattern 없는 비자유 문장 키(모델 버전·경로·주소) — 긴 토큰 규칙은 빼고, 키=값·접두는 거부', () => {
  assert.equal(MODEL_VERSION.freeText, undefined)
  passes(MODEL_VERSION, 'zipformer-ja-reazonspeech-2024-08-01-int8')
  passes(BIN_PATH, '/home/brownjeon/.node-local/thekaiwa-speech/models/zipformer-ja-reazonspeech-2024-08-01-int8/encoder.int8.onnx')
  assert.deepEqual(noSecretIssue(TTS_URL, 'http://192.168.219.100:8200'), [])
  rejected(MODEL_VERSION, 'password=hunter2')
  rejected(BIN_PATH, '/usr/bin/claude --token=abcdefgh')
  rejected(TTS_URL, 'http://192.168.219.100:8200/?token=abcdefgh')
})

test('JSON — 중첩 잎·객체 키·`키: 값` 짝·전각·폭 0 을 거부, 깊이 8단·배열 200개 넘으면 type(다 보지 못한 값은 통과시키지 않는다)', () => {
  rejected(FALLBACK_IDS, ['cmg1abcd0000xyz12345abcd', 'password=hunter2'])
  rejected(FALLBACK_IDS, [{ a: [{ b: 'token: abc' }] }])
  rejected(FALLBACK_IDS, [{ ghp_abcdefgh12345678: 1 }], '객체 키')
  rejected(FALLBACK_IDS, [{ 'password=hunter2': true }], '객체 키 문장')
  rejected(FALLBACK_IDS, { password: 'hunter2' }, '키·값 짝')
  rejected(FALLBACK_IDS, [{ note: 'ｐａｓｓｗｏｒｄ＝ｘ' }], '전각')
  rejected(FALLBACK_IDS, ['pass​word=x'], '폭 0')
  let deep8: unknown = 'ok'
  for (let i = 0; i < 8; i++) deep8 = [deep8]
  passes(FALLBACK_IDS, deep8)
  let deep9: unknown = 'ok'
  for (let i = 0; i < 9; i++) deep9 = [deep9]
  assert.deepEqual(checkEditValue(FALLBACK_IDS, deep9).map((i) => i.rule), ['type'])
  passes(FALLBACK_IDS, Array.from({ length: 200 }, () => 'a'))
  assert.deepEqual(checkEditValue(FALLBACK_IDS, Array.from({ length: 201 }, () => 'a')).map((i) => i.rule), ['type'])
  for (const v of [[], ['cmg1abcd0000xyz12345abcd', 'cmg1abcd0000xyz12345abce'], ['claude-cli-local-primary-connection-2024'], ['wordEnrich', 'distractorGen', 'chatReviewFallback'], { maxTokens: 100 }]) {
    passes(FALLBACK_IDS, v)
  }
})

// ── 오탐 전수: 스키마 기본값·시드 값 전부 ─────────────────────────────────────

type SeedConnection = { key: string; engineId: string; connectionType: string; connection: unknown; runtime: unknown; credentialRef: string | null }
const seed = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/engines.json'), 'utf8')) as { connections: SeedConnection[] }

test('오탐 전수 — 어댑터 스키마 기본값·Fallback·AppSetting 기본값·시드 연결 값 전부 secretValue 0', () => {
  let checked = 0
  for (const c of seed.connections) {
    const defs = defsOf(c.engineId, c.connectionType)
    for (const d of defs) {
      if (d.type === 'SECRET_REF' || d.default == null) continue
      assert.deepEqual(noSecretIssue(d, d.default), [], `기본값 ${c.engineId}/${c.connectionType} ${d.key}`)
      checked++
    }
    const flat = connectionFlat(connectionManaged({ connection: c.connection as never, runtime: c.runtime as never, credentialRef: c.credentialRef, logLevel: 'INFO', enabled: true }))
    for (const d of defs) {
      if (d.type === 'SECRET_REF' || flat[d.key] == null) continue
      assert.deepEqual(noSecretIssue(d, flat[d.key]), [], `시드 ${c.key} ${d.key}=${JSON.stringify(flat[d.key])}`)
      checked++
    }
  }
  for (const d of FALLBACK_KEY_DEFS) if (d.default != null) assert.deepEqual(noSecretIssue(d, d.default), [], `Fallback ${d.key}`)
  for (const k of Object.keys(APP_SETTING_SCHEMA)) {
    const d = appSettingKeyDefs(k)![0]
    if (d.default != null) assert.deepEqual(noSecretIssue(d, d.default), [], `AppSetting ${k}`)
    checked++
  }
  assert.ok(checked > 40, `검사 수 ${checked}`)
})

test('기본값 스냅샷은 되돌리기 무결성 OK(오탐이면 Rollback 이 E_SNAPSHOT_INTEGRITY 로 막힌다)', () => {
  for (const c of seed.connections) {
    const defs = defsOf(c.engineId, c.connectionType)
    const flat = connectionFlat(connectionManaged({ connection: c.connection as never, runtime: c.runtime as never, credentialRef: c.credentialRef, logLevel: 'INFO', enabled: true }))
    const r = snapshotIntegrity({ ok: true }, defs, flat)
    assert.deepEqual(r.issues.filter((i) => i.rule === 'secretValue'), [], c.key)
  }
})

// ── validatePatch 경유(모든 쓰기 진입점의 공통 관문) ─────────────────────────────

const claudeSeed = seed.connections.find((c) => c.key === 'claude-cli-local')!
const claudeManaged: ConnectionManaged = connectionManaged({ connection: claudeSeed.connection as never, runtime: claudeSeed.runtime as never, credentialRef: null, logLevel: 'INFO', enabled: true })
const CLAUDE_DEFS = defsOf('claude-cli', 'CLI')
const CLAUDE_STORED = connectionFlat(claudeManaged)

test('validatePatch — Form/AppSetting patch 와 Raw 문서 전체(잠긴 키 그대로) 모두 SCHEMA secretValue, 응답 어디에도 값 없음', async () => {
  const app = await validatePatch([PREVIEW], { value: PREVIEW.default }, { value: 'password=hunter2' }, { envSet: () => false })
  assert.equal(app.valid, false)
  assert.equal(app.stage, 'SCHEMA')
  assert.deepEqual(app.errors, [{ key: 'value', rule: 'secretValue', message: MESSAGE }])
  assert.ok(!JSON.stringify(app).includes('hunter2'))

  const raw = await validatePatch(CLAUDE_DEFS, CLAUDE_STORED, { ...CLAUDE_STORED, 'runtime.modelByTier.fast': 'ghp_abcdefgh12345678' }, { envSet: () => false })
  assert.equal(raw.stage, 'SCHEMA')
  assert.deepEqual(raw.errors.map((e) => [e.key, e.rule]), [['runtime.modelByTier.fast', 'secretValue']])
  assert.ok(!JSON.stringify(raw).includes('ghp_abcdefgh'))

  const ok = await validatePatch(CLAUDE_DEFS, CLAUDE_STORED, { 'runtime.modelByTier.fast': 'claude-3-5-haiku-20241022' }, { envSet: () => false })
  assert.equal(ok.valid, true)
})

test('x- 확장 키 — 경고만, 변경 키·스냅샷(=감사 values 의 원천)에 들어가지 않는다', async () => {
  const v = await validatePatch(CLAUDE_DEFS, CLAUDE_STORED, { 'runtime.modelByTier.fast': 'sonnet', 'x-note': 'password=hunter2' }, { envSet: () => false })
  assert.equal(v.valid, true)
  assert.deepEqual(v.changedKeys, ['runtime.modelByTier.fast'])
  assert.deepEqual(v.warnings.map((w) => [w.key, w.code]), [['x-note', 'W_EXTENSION_KEY']])
  assert.match(v.warnings[0].message, /저장하지 않고/)
  const snap = connectionSnapshot(applyConnectionPatch(claudeManaged, { 'runtime.modelByTier.fast': 'sonnet', 'x-note': 'password=hunter2' }), { schemaVersion: 1, origin: 'RAW_JSON' })
  assert.ok(!JSON.stringify(snap).includes('x-note') && !JSON.stringify(snap).includes('hunter2'))
})

test('Rollback — 비밀 유사 값이 든 옛 스냅샷은 INVALID_ENTRIES(쓰기 0 경로), 이슈에 값 없음', async () => {
  const bad = { value: 'token: abcdefgh' }
  const integrity = snapshotIntegrity({ ok: true }, [PREVIEW], bad)
  assert.equal(integrity.integrity, 'INVALID_ENTRIES')
  const plan = await planRestore([PREVIEW], { value: PREVIEW.default }, bad, { envSet: () => false })
  assert.equal(plan.integrity, 'INVALID_ENTRIES')
  assert.deepEqual([...new Set(plan.issues.map((i) => i.rule))], ['secretValue'])
  assert.ok(!JSON.stringify(plan.issues).includes('abcdefgh'))
})

// ── Codex C2 재검토(REV-062 대상) — 비자유 키 "구분 기호 없는 긴 혼합 런" 보강 규칙 ──────────────────────────────

const PRIMARY_ID = FALLBACK_KEY_DEFS.find((d) => d.key === 'primaryConnectionId')!
const MODEL_DEEP = defOf('claude-cli', 'CLI', 'runtime.modelByTier.deep')
const CODEX_REPRO = 'Abcdefghijklmnopqrstuvwxyz0123456789_X'

type Kind = 'lower' | 'upper' | 'digit' | 'other'
// 기존 규칙(접두·인증 스킴·JWT·키=값 낱말)을 만들 수 없는 글자만 쓴다 — 판정이 혼합 런 규칙에서만 갈리게.
const POOL: Record<Exclude<Kind, 'other'>, string> = { lower: 'abcdmnqr', upper: 'BCDFGHLM', digit: '23456789' }
/** `kinds` 를 돌아가며 채운 길이 `len` 의 런(각 종류가 반드시 들어간다). */
function mixedRun(kinds: readonly Kind[], len: number, other = '_'): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    const k = kinds[i % kinds.length]
    const pool = k === 'other' ? other : POOL[k]
    s += pool[Math.floor(i / kinds.length) % pool.length]
  }
  return s
}
const KIND_SETS: Record<2 | 3 | 4, Kind[][]> = {
  2: [['lower', 'digit'], ['upper', 'lower'], ['lower', 'other'], ['upper', 'digit'], ['digit', 'other']],
  3: [['lower', 'upper', 'digit'], ['lower', 'digit', 'other'], ['upper', 'digit', 'other'], ['lower', 'upper', 'other']],
  4: [['lower', 'upper', 'digit', 'other']],
}
const fullwidth = (s: string) => Array.from(s, (c) => (c >= '!' && c <= '~' ? String.fromCodePoint(c.codePointAt(0)! + 0xfee0) : c === ' ' ? '　' : c)).join('')
const ZERO_WIDTH = ['​', '­', '⁠', '﻿', '‍']
/** 글자 사이마다 폭 0·서식 문자를 끼운다(종류를 돌려 가며). */
const zeroWidth = (s: string) => Array.from(s, (c, i) => (i === 0 ? c : ZERO_WIDTH[i % ZERO_WIDTH.length] + c)).join('')
const rulesOf = (def: EditKeyDef, v: unknown) => checkEditValue(def, v).map((i) => i.rule)

/** 비자유 STRING(pattern 없음)·PATH·JSON 잎·JSON 객체 키 — 같은 단일 판정 함수를 지나는 네 자리의 거부 여부. */
function nonFreeVerdicts(v: string): boolean[] {
  return [MODEL_VERSION, BIN_PATH].map((d) => noSecretIssue(d, v).length > 0).concat([noSecretIssue(FALLBACK_IDS, [v]).length > 0, noSecretIssue(FALLBACK_IDS, [{ [v]: 1 }]).length > 0])
}
function expectNonFree(v: string, secret: boolean, label: string): void {
  assert.deepEqual(nonFreeVerdicts(v), [secret, secret, secret, secret], label)
}
/** 거부 + 입력 조각 비에코. */
function rejectedNoEcho(def: EditKeyDef, value: unknown, needle: string): void {
  const issues = checkEditValue(def, value)
  assert.deepEqual(issues, [{ key: def.key, rule: 'secretValue', message: MESSAGE }], `${def.key} ← ${needle}`)
  assert.ok(!JSON.stringify(issues).includes(needle.slice(0, 10)), `오류에 입력 값이 들어갔다: ${def.key}`)
}

test('경계표 — 길이 31/32/33 × 문자 종류 2/3/4(`_`·`+`·`=`) × 전각 × 폭 0 × 구분 기호: ≥32자·3종↑ 런만 거부하고 네 자리(STRING·PATH·JSON 잎·키)가 같은 판정', () => {
  assert.equal(MIXED_RUN_MIN, 32)
  assert.equal(MIXED_RUN_KINDS, 3)
  let cases = 0
  for (const len of [31, 32, 33]) {
    for (const k of [2, 3, 4] as const) {
      for (const kinds of KIND_SETS[k]) {
        for (const other of ['_', '+', '=']) {
          if (!kinds.includes('other') && other !== '_') continue
          const r = mixedRun(kinds, len, other)
          assert.equal(r.length, len)
          const label = `len=${len} kinds=${kinds.join('+')} other=${other}`
          const secret = len >= 32 && k >= 3
          expectNonFree(r, secret, label)
          expectNonFree(fullwidth(r), secret, `${label} 전각`)
          expectNonFree(zeroWidth(r), secret, `${label} 폭 0`)
          expectNonFree(fullwidth(zeroWidth(r)), secret, `${label} 전각+폭 0`)
          for (const sep of ['-', '.', ':', '/', ' ']) {
            // 가운데를 끊으면 두 런 다 32자 미만 → 통과. 한쪽 런이 32자↑로 남으면 구분 기호가 있어도 거부.
            expectNonFree(r.slice(0, 16) + sep + r.slice(16), false, `${label} 가운데 '${sep}'`)
            expectNonFree(fullwidth(r.slice(0, 16) + sep + r.slice(16)), false, `${label} 가운데 전각 '${sep}'`)
            expectNonFree(`model${sep}${r}${sep}v2`, secret, `${label} 앞뒤 '${sep}'`)
          }
          // 자유 문장 키는 원래의 긴 토큰 규칙(24자↑·3종↑)이 이미 덮는다 — 보강 규칙은 비자유 키 전용.
          assert.equal(noSecretIssue(PREVIEW, r).length > 0, k >= 3, `${label} 자유 문장`)
          cases++
        }
      }
    }
  }
  assert.ok(cases >= 40, `경계표 행 ${cases}`)
})

test('문장·식별자 — 일본어·한글·영어 문장, URL·경로·목록 값·camelCase·cuid·uuid·16진수·모델 id 는 통과, 문장 속 32자↑ 혼합 런은 거부', () => {
  const r33 = mixedRun(KIND_SETS[4][0], 33)
  const r31 = mixedRun(KIND_SETS[3][0], 31)
  for (const s of [
    'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。',
    'はじめまして。私はハルカです。よろしくお願いします。',
    '안녕하세요. 오늘도 함께 일본어를 공부해요.',
    '미리듣기 문장을 바꿨습니다 (버전 2).',
    'APIの設定はclaudeSonnet45を使います。モデルはqwen25Coder32bInstructです。',
    'Hello, nice to meet you. This is a perfectly normal English sentence with words.',
    `今日のキーは${r31}です`,
  ]) {
    expectNonFree(s, false, s)
  }
  expectNonFree(`今日のキーは${r33}です`, true, '일본어 사이 33자 런')
  expectNonFree(`비밀은 ${r33} 입니다`, true, '한글 사이 33자 런')
  expectNonFree(`비밀은${fullwidth(r33)}입니다`, true, '한글 사이 전각 런')
  for (const v of [
    'http://192.168.219.100:8200',
    'https://kaiwa.example.local/models/reazonspeech-int8/manifest.json?v=20241001',
    '/home/brownjeon/.node-local/thekaiwa-speech/models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/encoder-epoch-99-avg-1.int8.onnx',
    '/models/reazonspeech-int8/manifest.json',
    '.claude/agents/tutor.md',
    '$CLAUDE_CLI_PATH',
    'greedy_search',
    'modified_beam_search',
    'large-v3-turbo',
    'int8_float16',
    'chatReviewFallback',
    'chatReviewFallbackDistractorGenWordEnrich',
    'CLAUDE_CLI_CONCURRENCY_LIMIT_FOR_SHARED_SUBSCRIPTION',
    'cmg1abcd0000xyz12345abcd',
    'clx9z8y7w6v5u4t3r2q1p0n9m8l7k6j5h4',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'zipformer-ja-reazonspeech-2024-08-01-int8',
    'hf.co/bartowski/Qwen2.5-14B-Instruct-GGUF:Q4_K_M',
    'library/qwen2.5-coder:32b-instruct-q8_0',
    'claude-sonnet-4-5-20250929',
    'jvnv-F1-jp',
  ]) {
    expectNonFree(v, false, v)
  }
  for (const v of ['claude-sonnet-4-5-20250929', 'claude-3-5-haiku-20241022', 'claude-opus-4-5']) passes(MODEL_DEEP, v)
  passes(M4_MODEL, 'hf.co/bartowski/Qwen2.5-14B-Instruct-GGUF:Q4_K_M')
  for (const v of ['cmg1abcd0000xyz12345abcd', 'cmg8x2k4l0000qwer7tyu1iop']) passes(PRIMARY_ID, v)
  passes(FALLBACK_IDS, ['cmg1abcd0000xyz12345abcd', 'cmg8x2k4l0000qwer7tyu1iop'])
})

test('Codex 재현값 — 접두 없는 38자 혼합 키를 모델명·연결 id·목소리 id·모델 버전·JSON 에 넣으면 secretValue(값 비에코), 실제 비밀 모양도 거부', () => {
  for (const d of [MODEL_FAST, MODEL_DEEP, M4_MODEL, PRIMARY_ID, VOICE, MODEL_VERSION, BIN_PATH]) rejectedNoEcho(d, CODEX_REPRO, CODEX_REPRO)
  rejectedNoEcho(FALLBACK_IDS, ['cmg1abcd0000xyz12345abcd', CODEX_REPRO], CODEX_REPRO)
  rejectedNoEcho(FALLBACK_IDS, [{ [CODEX_REPRO]: true }], CODEX_REPRO)
  rejectedNoEcho(FALLBACK_IDS, { note: CODEX_REPRO }, CODEX_REPRO)
  rejectedNoEcho(MODEL_VERSION, fullwidth(CODEX_REPRO), CODEX_REPRO)
  rejectedNoEcho(MODEL_VERSION, zeroWidth(CODEX_REPRO), CODEX_REPRO)
  for (const v of ['Q2xhdWRlU2VjcmV0S2V5MTIzNDU2Nzg5MEFCQ0RF', 'hf_AbCdEfGhIjKlMnOpQrStUvWxYz01234567', 'xR7mQ2pL9vN4kT8wZ3cF6hJ1bD5gS0aY']) {
    rejectedNoEcho(MODEL_FAST, v, v)
    rejectedNoEcho(FALLBACK_IDS, [v], v)
  }
})

test('Codex 재현값 — validatePatch(Form·Raw 공통 관문)는 SCHEMA secretValue 한 건·값 비에코, 그런 값이 든 옛 스냅샷은 INVALID_ENTRIES', async () => {
  const raw = await validatePatch(CLAUDE_DEFS, CLAUDE_STORED, { ...CLAUDE_STORED, 'runtime.modelByTier.fast': CODEX_REPRO }, { envSet: () => false })
  assert.equal(raw.valid, false)
  assert.equal(raw.stage, 'SCHEMA')
  assert.deepEqual(raw.errors, [{ key: 'runtime.modelByTier.fast', rule: 'secretValue', message: MESSAGE }])
  assert.ok(!JSON.stringify(raw).includes('Abcdefghij'))
  const fbStored = { primaryConnectionId: 'cmg1abcd0000xyz12345abcd', fallbackConnectionIds: [], retryOnce: true, enabled: true }
  for (const patch of [{ primaryConnectionId: CODEX_REPRO }, { fallbackConnectionIds: [CODEX_REPRO] }]) {
    const fb = await validatePatch(FALLBACK_KEY_DEFS, fbStored, patch, { envSet: () => false })
    assert.equal(fb.stage, 'SCHEMA')
    assert.deepEqual(fb.errors.map((e) => e.rule), ['secretValue'])
    assert.ok(!JSON.stringify(fb).includes('Abcdefghij'))
  }
  const integrity = snapshotIntegrity({ ok: true }, CLAUDE_DEFS, { ...CLAUDE_STORED, 'runtime.modelByTier.fast': CODEX_REPRO })
  assert.equal(integrity.integrity, 'INVALID_ENTRIES')
  assert.ok(!JSON.stringify(integrity).includes('Abcdefghij'))
})

test('JSON 한도와 혼합 런 — 깊이 8 은 끝까지 보고 거부·9 는 type, 배열 200 은 거부·201 은 type, 8KB 초과는 type(fail-closed)', () => {
  const secret = mixedRun(KIND_SETS[4][0], 32)
  const benign = mixedRun(KIND_SETS[3][0], 31)
  const nest = (leaf: unknown, n: number): unknown => {
    let v = leaf
    for (let i = 0; i < n; i++) v = [v]
    return v
  }
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest(secret, 8)), ['secretValue'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest(benign, 8)), [])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest(secret, 9)), ['type'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest(benign, 9)), ['type'])
  // 객체 키: 7겹 배열 안 객체 = 깊이 8(키까지 본다) · 8겹 = 깊이 9(한도 초과).
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest({ [secret]: 1 }, 7)), ['secretValue'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest({ [benign]: 1 }, 7)), [])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest({ [secret]: 1 }, 8)), ['type'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, nest({ [benign]: 1 }, 8)), ['type'])
  const fill = (n: number, last: string) => [...Array.from({ length: n - 1 }, () => 'a'), last]
  assert.deepEqual(rulesOf(FALLBACK_IDS, fill(200, secret)), ['secretValue'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, fill(200, benign)), [])
  assert.deepEqual(rulesOf(FALLBACK_IDS, fill(201, secret)), ['type'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, fill(201, benign)), ['type'])
  const big = Array.from({ length: 150 }, () => 'a'.repeat(60))
  assert.ok(JSON.stringify(big).length > 8_000)
  assert.deepEqual(rulesOf(FALLBACK_IDS, big), ['type'])
  assert.deepEqual(rulesOf(FALLBACK_IDS, [...big.slice(0, 149), secret]), ['type'])
  const under = Array.from({ length: 100 }, () => 'a'.repeat(60))
  assert.ok(JSON.stringify([...under, secret]).length < 8_000)
  assert.deepEqual(rulesOf(FALLBACK_IDS, [...under, secret]), ['secretValue'])
})

test('오탐 전수(보강 규칙) — 모든 엔진·연결 종류의 STRING/PATH/URL/ENUM/JSON 기본값과 ENUM 목록 값 전부 secretValue 0', () => {
  const engines = (JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/engines.json'), 'utf8')) as { engines: { id: string; connectionTypes: string[] }[] }).engines
  let n = 0
  for (const e of engines) {
    for (const t of e.connectionTypes) {
      for (const d of defsOf(e.id, t)) {
        if (d.type === 'SECRET_REF') continue
        if (d.default != null) {
          assert.deepEqual(noSecretIssue(d, d.default), [], `기본값 ${e.id}/${t} ${d.key}`)
          n++
        }
        for (const ev of d.enum ?? []) {
          assert.deepEqual(noSecretIssue(d, ev), [], `목록 값 ${e.id}/${t} ${d.key}=${String(ev)}`)
          n++
        }
      }
    }
  }
  assert.ok(n > 60, `검사 수 ${n}`)
})

// ── REV-059 L4 가드 — 창 23자(NO_LONG_TOKEN_WINDOW)는 reason.ts 규칙의 최소 일치(경계 포함) ≤20자에 기댄다 ─────────────

/** reason.ts 규칙별 "가장 긴 최소 일치"(왼쪽 경계 1자 포함, 공백은 판정용 형태에서 한 칸으로 접힌다). */
const MIN_MATCHES: readonly (readonly [string, string])[] = [
  ['sk-', ' sk-abcdefgh'],
  ['ghp_', ' ghp_abcdefgh'],
  ['gho_', ' gho_abcdefgh'],
  ['github_pat_', ' github_pat_abcdefgh'],
  ['AKIA', ' AKIAABCDEFGHJLMN'],
  ['xox?-', ' xoxb-abcdefgh'],
  ['bearer', ' bearer abcdefgh'],
  ['basic', ' basic abcdefgh'],
  ['JWT', 'eyJabcde.abcde.abcde'],
  ['키=값', 'credentials = x'],
]

test('L4 가드 — reason.ts 규칙 원문 고정: 바뀌면 최소 일치 표·NO_LONG_TOKEN_WINDOW 를 재검토한 뒤에만 이 기대값을 고친다', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/infra/reason.ts'), 'utf8')
  const consts = Object.fromEntries([...src.matchAll(/^const ([A-Z_]+) = (\/.+\/[a-z]*)$/gm)].map((m) => [m[1], m[2]]))
  assert.deepEqual(Object.keys(consts).sort(), ['AUTH_SCHEME', 'CONTROL_RUN', 'FORMAT_CHARS', 'JWT_LIKE', 'KEY_VALUE', 'LONE_SURROGATE', 'SECRET_PREFIX', 'TOKEN_RUN'], '규칙 상수가 늘거나 줄었다')
  assert.deepEqual(
    { SECRET_PREFIX: consts.SECRET_PREFIX, AUTH_SCHEME: consts.AUTH_SCHEME, JWT_LIKE: consts.JWT_LIKE, KEY_VALUE: consts.KEY_VALUE, TOKEN_RUN: consts.TOKEN_RUN },
    {
      SECRET_PREFIX: String.raw`/(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{8,}|gh[po]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{12,}|xox[a-z]-[A-Za-z0-9-]{8,})/`,
      AUTH_SCHEME: String.raw`/(?:^|[^A-Za-z0-9])(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/i`,
      JWT_LIKE: String.raw`/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/`,
      KEY_VALUE: String.raw`/(?:password|passwd|secret|token|api[_-]?key|apikey|credential)s?\s*[:=]\s*\S/i`,
      TOKEN_RUN: String.raw`/[A-Za-z0-9\-_+/=]{24,}/g`,
    },
    'reason.ts 판정 규칙이 바뀌었다 — validate.ts NO_LONG_TOKEN_WINDOW·MIN_MATCHES 재검토',
  )
  const start = src.indexOf('export function isSecretLikeText(')
  assert.ok(start >= 0)
  assert.equal(
    src.slice(start, src.indexOf('\n}\n', start) + 2),
    [
      'export function isSecretLikeText(s: string): boolean {',
      '  const t = reasonCheckForm(s)',
      '  if (SECRET_PREFIX.test(t) || AUTH_SCHEME.test(t) || JWT_LIKE.test(t) || KEY_VALUE.test(t)) return true',
      '  for (const m of t.matchAll(TOKEN_RUN)) if (charKinds(m[0]) >= 3) return true',
      '  return false',
      '}',
    ].join('\n'),
    'isSecretLikeText 판정 흐름이 바뀌었다 — 창 산술 재검토',
  )
})

test('L4 가드 — 규칙별 최소 일치는 경계 포함 ≤20자(정확히 최소)이고, 창 23자 = 앞 붙임 1 + 22 안에 들어가며 긴 토큰(24자) 미만', () => {
  const lengths: number[] = []
  for (const [rule, text] of MIN_MATCHES) {
    assert.equal(isSecretLikeText(text), true, `${rule} 최소 일치가 안 걸린다`)
    assert.equal(isSecretLikeText(text.slice(0, -1)), false, `${rule} 표가 최소가 아니다(규칙 최소 길이가 바뀌었다)`)
    lengths.push(codePointLength(text))
  }
  const longest = Math.max(...lengths)
  assert.equal(longest, 20, '최장 최소 일치(github_pat_·JWT)')
  assert.ok(longest <= 20, 'role-permission §7 ⑥: 접두 규칙은 20자 이내')
  // i>0 창 = 숫자 '0' 1자 + 원문 22자 → 경계 포함 일치가 22자 이하여야 통째로 들어간다.
  assert.ok(longest <= NO_LONG_TOKEN_WINDOW - 1, `창 ${NO_LONG_TOKEN_WINDOW} 이 최장 일치 ${longest} 를 못 담는다`)
  // 창 안에서 긴 토큰(24자↑) 규칙이 다시 켜지면 모델 id 오탐이 돌아온다.
  assert.ok(NO_LONG_TOKEN_WINDOW < 24)
})

test('L4 가드 — 모든 최소 일치를 앞쪽 0~40자 어느 위치에 두어도(첫 창 밖 포함) 비자유 STRING·JSON 이 거부, 폭 0 을 끼워도 같다', () => {
  for (const [rule, text] of MIN_MATCHES) {
    for (let pad = 0; pad <= 40; pad++) {
      const v = `${'zipformer-ja-reazonspeech-2024-08-01-int8'.slice(0, pad)}/${text}`
      assert.deepEqual(rulesOf(MODEL_VERSION, v), ['secretValue'], `${rule} @${pad}`)
      assert.deepEqual(rulesOf(FALLBACK_IDS, [v]), ['secretValue'], `${rule} @${pad} JSON`)
    }
    assert.deepEqual(rulesOf(MODEL_VERSION, `zipformer-ja-reazonspeech-2024-08-01-int8/${zeroWidth(text)}`), ['secretValue'], `${rule} 폭 0`)
  }
})

// ── REV-059 L6 — 판정용 형태(NFKC·폭 0 삭제)를 생략하는 변이(M4)를 잡는다 ─────────────────────────────

test('L6 — 글자마다 폭 0 문자를 끼운 github_pat_·bearer 를 비자유 STRING·JSON 에서 거부', () => {
  const zwsp = (s: string) => Array.from(s).join('​')
  for (const v of ['github_pat_ABCdef12345678', 'bearer abcdefgh12345']) {
    rejected(MODEL_VERSION, zwsp(v), `폭 0 ${v}`)
    rejected(BIN_PATH, zwsp(v), `폭 0 ${v}`)
    rejected(FALLBACK_IDS, [zwsp(v)], `폭 0 JSON 잎 ${v}`)
    rejected(FALLBACK_IDS, [{ [zwsp(v)]: 1 }], `폭 0 JSON 키 ${v}`)
    rejected(FALLBACK_IDS, { note: zwsp(v) }, `폭 0 JSON 값 ${v}`)
  }
})

test('목록 값(ENUM) — 목록 검사 뒤 같은 판정 함수를 지난다(코드 목록이라 실제 값은 없지만 스냅샷 재검증과 경로를 맞춘다)', () => {
  const def: EditKeyDef = { key: 'runtime.synthetic', type: 'ENUM', enum: [CODEX_REPRO, 'greedy_search', 'sk-abcdefgh12345678'], default: 'greedy_search', description: '', editability: 'RUNTIME_EDITABLE', strict: false, consumer: 'APP', verify: 'NONE', lock: null }
  passes(def, 'greedy_search')
  rejectedNoEcho(def, CODEX_REPRO, CODEX_REPRO)
  rejected(def, 'sk-abcdefgh12345678')
  assert.deepEqual(rulesOf(def, 'not-listed'), ['enum'])
})
