/**
 * task-003g 발음 사전 관리 — 입력 검증(G3)·Import 파서·CSV 인젝션 이스케이프·왕복 불변·변경 계획·버전 전이·Rollback(메모리 가짜 tx).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import type { LexiconEntryFields } from '@/types/lexicon'
import { selectEntries, snapshotHash, type LexiconEntryData } from '../tts/lexicon'
import { escapeCsvCell, formatLexiconCsv, parseCsv, parseLexiconFile, unescapeCsvCell } from '../tts/lexiconCsv'
import { packChunks } from '../tts/lexiconPreview'
import {
  applyPlan,
  diffRows,
  entryKey,
  fieldsOf,
  normalizeReading,
  parseEntryInput,
  planRows,
  planCreate,
  planDisable,
  planImport,
  planRollback,
  planUpdate,
  readSnapshot,
  rollbackSummary,
  searchReading,
  summarize,
  toSnapshot,
  type LexiconEntryRow,
} from '../tts/lexiconRules'
import { checkSnapshot, getLexiconVersionDiff, LexiconDuplicateError, LexiconEntryInvalidError, LexiconImportInvalidError, LexiconRollbackRejectedError, LexiconSnapshotIntegrityError, LexiconVersionConflictError, writeLexicon } from '../tts/lexiconStore'
import { concatWav, wavInfo } from '../tts/wav'

const F = (o: Partial<LexiconEntryFields> & Pick<LexiconEntryFields, 'surface' | 'reading'>): LexiconEntryFields => ({
  accentType: 0,
  priority: 10,
  scope: 'GLOBAL',
  scopeRefId: null,
  wordType: null,
  note: null,
  enabled: true,
  ...o,
})
const R = (id: string, o: Partial<LexiconEntryFields> & Pick<LexiconEntryFields, 'surface' | 'reading'>): LexiconEntryRow => ({ id, ...F(o) })
const codes = (r: { errors: { field: string; code: string }[] }) => r.errors.map((e) => `${e.field}:${e.code}`)
/** 시드 v1 처럼 note 키가 없는 스냅샷 행. */
function withoutNote<T extends { note?: unknown }>(x: T): Omit<T, 'note'> {
  const c = { ...x }
  delete c.note
  return c
}

// ── G3 검증 ─────────────────────────────────────────────────────────────

test('읽기 정규화: 저장용은 반각 → 전각만(히라가나 그대로 → 검증에서 거부), 검색용은 히라가나 → 가타카나', () => {
  assert.equal(normalizeReading(' ｼﾞﾝﾎﾞｰﾁｮｰ '), 'ジンボーチョー')
  assert.equal(normalizeReading('にほんばし'), 'にほんばし')
  assert.equal(searchReading('にほん'), 'ニホン')
  assert.equal(searchReading('きっぷ'), 'キップ')
})

test('검증: 정상 입력은 기본값을 채우고, 표기·읽기·악센트·우선순위·범위·품사 위반은 필드 오류', () => {
  const ok = parseEntryInput({ surface: ' 日本橋 ', reading: 'ニホンバシ', accentType: '0' })
  assert.deepEqual(ok.value, F({ surface: '日本橋', reading: 'ニホンバシ' }))
  assert.deepEqual(codes(parseEntryInput({ surface: 'ATM', reading: 'エーティーエム' })), ['surface:E_SURFACE_NOT_JA'])
  assert.deepEqual(codes(parseEntryInput({ surface: '日本 橋', reading: 'ニホンバシ' })), ['surface:E_SURFACE_CHARS'])
  assert.deepEqual(codes(parseEntryInput({ surface: '日\u200b本', reading: 'ニホン' })), ['surface:E_SURFACE_CHARS'])
  assert.deepEqual(codes(parseEntryInput({ surface: '長'.repeat(41), reading: 'ナガ' })), ['surface:E_SURFACE'])
  assert.deepEqual(codes(parseEntryInput({ surface: '', reading: 'ナガ' })), ['surface:E_SURFACE'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'tokyo' })), ['reading:E_READING'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'とうきょう' })), ['reading:E_READING'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'ア'.repeat(61) })), ['reading:E_READING'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', accentType: 6 })), ['accentType:E_ACCENT'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', accentType: 1.5 })), ['accentType:E_ACCENT'])
  assert.equal(parseEntryInput({ surface: '東京', reading: 'トーキョー', priority: 1000 }).value?.priority, 1000)
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', priority: 1001 })), ['priority:E_PRIORITY'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', scope: 'USER' })), ['scopeRefId:E_SCOPE_REF'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', scopeRefId: 'u1' })), ['scopeRefId:E_SCOPE_REF'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', scope: 'USER', scopeRefId: '../x' })), ['scopeRefId:E_SCOPE_REF'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', scope: 'TEAM' })), ['scope:E_SCOPE'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', wordType: 'VERB' })), ['wordType:E_WORD_TYPE'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', note: 'x'.repeat(201) })), ['note:E_NOTE'])
  assert.deepEqual(codes(parseEntryInput({ surface: '東京', reading: 'トーキョー', enabled: 'maybe' })), ['enabled:E_ENABLED'])
  const csvish = parseEntryInput({ surface: '東京', reading: 'トーキョー', accentType: '', priority: '', scope: 'user', scopeRefId: 'u_1', wordType: 'place', note: ' 줄\n바꿈 ', enabled: 'FALSE' })
  assert.deepEqual(csvish.value, F({ surface: '東京', reading: 'トーキョー', scope: 'USER', scopeRefId: 'u_1', wordType: 'PLACE', note: '줄 바꿈', enabled: false }))
})

test('수정(패치): 보낸 필드만 바뀌고, 읽기가 짧아져 악센트가 넘치면 오류', () => {
  const base = F({ surface: '日本橋', reading: 'ニホンバシ', accentType: 3, note: '메모' })
  assert.deepEqual(parseEntryInput({ priority: 50 }, base).value, { ...base, priority: 50 })
  assert.deepEqual(codes(parseEntryInput({ reading: 'ニチ' }, base)), ['accentType:E_ACCENT'])
  assert.deepEqual(parseEntryInput({ note: null }, base).value?.note, null)
})

// ── 계획 ───────────────────────────────────────────────────────────────

test('키는 working 표기(전각 영숫자=ASCII)·범위·대상으로 — 매칭과 같은 좌표', () => {
  assert.equal(entryKey(F({ surface: 'ＪＲ東', reading: 'ジェイアールヒガシ' })), entryKey(F({ surface: 'JR東', reading: 'x' })))
  assert.notEqual(entryKey(F({ surface: '東', reading: 'ヒガシ' })), entryKey(F({ surface: '東', reading: 'ヒガシ', scope: 'USER', scopeRefId: 'u1' })))
})

test('추가: 활성 중복은 DUPLICATE, 비활성 같은 키는 되살림, 수정: 같은 값 NOOP·끄기 값이면 DISABLE, 비활성: 이미 비활성이면 null', () => {
  const rows = [R('a', { surface: '明日', reading: 'アシタ' }), R('b', { surface: '今日', reading: 'キョー', enabled: false })]
  assert.deepEqual(planCreate(rows, F({ surface: '明日', reading: 'アス' })), { kind: 'DUPLICATE', id: 'a' })
  const revive = planCreate(rows, F({ surface: '今日', reading: 'キョウ' }))
  assert.equal(revive.kind, 'REVIVE')
  assert.equal(planCreate(rows, F({ surface: '昨日', reading: 'キノー' })).kind, 'ADD')
  assert.deepEqual(planUpdate(rows[0], F({ surface: '明日', reading: 'アシタ' })), { kind: 'NOOP' })
  assert.equal((planUpdate(rows[0], F({ surface: '明日', reading: 'アシタ', enabled: false })) as { item: { action: string } }).item.action, 'DISABLE')
  assert.equal((planUpdate(rows[1], F({ surface: '今日', reading: 'キョー', enabled: true })) as { item: { action: string } }).item.action, 'UPDATE')
  assert.equal(planDisable(rows[1]), null)
  assert.equal(planDisable(rows[0])?.action, 'DISABLE')
})

test('Import MERGE: 추가·갱신·그대로·파일 내 중복·대상 없음·행 오류 / REPLACE_SCOPE: 파일에 나온 묶음의 빠진 활성 항목만 비활성', () => {
  const existing = [
    R('g1', { surface: '明日', reading: 'アシタ', accentType: 3 }),
    R('g2', { surface: '日本橋', reading: 'ニホンバシ' }),
    R('u1', { surface: '田中', reading: 'タナカ', scope: 'USER', scopeRefId: 'user1' }),
  ]
  const rows = [
    { row: 1, raw: { surface: '明日', reading: 'アシタ' } }, // accentType 열 없음 → 기존 3 유지 → 그대로
    { row: 2, raw: { surface: '日本橋', reading: 'ニッポンバシ' } },
    { row: 3, raw: { surface: '秋葉原', reading: 'ｱｷﾊﾊﾞﾗ', accentType: '3' } },
    { row: 4, raw: { surface: '秋葉原', reading: 'アキバ' } },
    { row: 5, raw: { surface: '佐藤', reading: 'サトウ', scope: 'USER', scopeRefId: 'ghost' } },
    { row: 6, raw: { surface: 'ABC', reading: 'エービーシー' } },
    { row: 7, raw: {}, errors: [{ field: 'row' as const, code: 'E_ROW_FORMAT', message: 'x' }] },
  ]
  const merge = planImport(existing, rows, 'MERGE', new Set(['USER:ghost']))
  assert.deepEqual(merge.counts, { add: 1, update: 1, disable: 0, unchanged: 1, error: 4 })
  const byRow = new Map(merge.results.map((r) => [r.row, r]))
  assert.equal(byRow.get(1)?.action, 'UNCHANGED')
  assert.equal(byRow.get(2)?.action, 'UPDATE')
  assert.equal(byRow.get(3)?.after?.reading, 'アキハバラ')
  assert.deepEqual(codes(byRow.get(4)!), ['row:E_DUPLICATE_IN_FILE'])
  assert.deepEqual(codes(byRow.get(5)!), ['scopeRefId:E_SCOPE_REF_NOT_FOUND'])
  assert.deepEqual(codes(byRow.get(6)!), ['surface:E_SURFACE_NOT_JA'])
  assert.deepEqual(codes(byRow.get(7)!), ['row:E_ROW_FORMAT'])
  assert.deepEqual(merge.scopes, [{ scope: 'GLOBAL', scopeRefId: null, disable: 0 }])
  assert.deepEqual(
    planRows(merge.items).map((r) => `${r.kind}:${r.surface}:${r.row}`),
    ['CHANGED:日本橋:2', 'ADDED:秋葉原:3'],
  )

  const replace = planImport(existing, [{ row: 1, raw: { surface: '明日', reading: 'アシタ', accentType: 3 } }], 'REPLACE_SCOPE')
  assert.deepEqual(replace.counts, { add: 0, update: 0, disable: 1, unchanged: 1, error: 0 })
  const disabled = replace.results.find((r) => r.action === 'DISABLE')
  assert.equal(disabled?.row, null)
  assert.equal(disabled?.surface, '日本橋') // GLOBAL 묶음만 — USER 田中 는 파일에 없는 묶음이라 그대로
  assert.deepEqual(replace.scopes, [{ scope: 'GLOBAL', scopeRefId: null, disable: 1 }])
})

test('Rollback 계획: 항목 표를 대상 스냅샷과 같게(추가·갱신·나머지 비활성) → 활성 해시가 대상과 같다, 스냅샷에 note 가 없으면 현재 메모 유지', () => {
  const target = toSnapshot([F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })])
  const existing = [
    R('a', { surface: '明日', reading: 'アス', note: '메모' }),
    R('c', { surface: '秋葉原', reading: 'アキハバラ' }),
  ]
  const legacy = readSnapshot(target.map(withoutNote))
  const items = planRollback(existing, legacy)
  assert.deepEqual(
    items.map((i) => `${i.action}:${(i.action === 'ADD' ? i.after : i.before).surface}`).sort(),
    ['ADD:日本橋', 'DISABLE:秋葉原', 'UPDATE:明日'],
  )
  const after = applyPlan(existing, items)
  assert.equal(snapshotHash(after), snapshotHash(target))
  assert.equal(after.find((e) => e.surface === '明日')?.note, '메모')
  assert.equal(after.length, 3) // 물리 삭제 없음
})

test('diff: ADDED·CHANGED·DISABLED(꺼짐·대상에 없는 활성 키)·ENABLED, 옛 스냅샷(note 없음)은 메모 비교 안 함, 요약 ≤300', () => {
  const legacyTomorrow = withoutNote(F({ surface: '明日', reading: 'アシタ' }))
  const d = diffRows(
    [legacyTomorrow, F({ surface: '今日', reading: 'キョー' }), F({ surface: '昨日', reading: 'キノー', enabled: false }), F({ surface: '秋', reading: 'アキ' })],
    [F({ surface: '明日', reading: 'アシタ', note: '메모' }), F({ surface: '今日', reading: 'キョウ' }), F({ surface: '昨日', reading: 'キノー' }), F({ surface: '春', reading: 'ハル' }), F({ surface: '冬', reading: 'フユ', enabled: false })],
  )
  assert.deepEqual(
    d.rows.map((r) => `${r.kind}:${r.surface}`),
    ['CHANGED:今日', 'ADDED:春', 'ENABLED:昨日', 'DISABLED:秋'],
  )
  assert.deepEqual(d.counts, { added: 1, changed: 1, disabled: 1, enabled: 1 })
  assert.equal(rollbackSummary(7, '문제 있는 변경 되돌림'), 'v7 로 되돌림: 문제 있는 변경 되돌림')
  const many = Array.from({ length: 50 }, (_, i) => ({ action: 'ADD' as const, row: i, after: F({ surface: `語${'長'.repeat(30)}${i}`, reading: 'ゴ' }) }))
  const s = summarize('가져오기(MERGE)', many, many.map((m) => m.after))
  assert.ok([...s].length <= 300)
  assert.match(s, /추가 50·수정 0·비활성 0/)
})

// ── CSV·JSON ────────────────────────────────────────────────────────────

test('CSV 인젝션: = + - @ 탭 CR \' 로 시작하는 셀은 \' 접두, 가져올 때 그 접두만 떼어 원값 복원', () => {
  for (const v of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '\tx', "'=already", "'plain", '普通', '']) {
    assert.equal(unescapeCsvCell(parseCsv(`k,${escapeCsvCell(v)}\n`)![0].cells[1]), v, JSON.stringify(v))
  }
  assert.equal(escapeCsvCell('=1+1'), "'=1+1")
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')
})

test('CSV 파서: BOM·CRLF·따옴표 안 쉼표/줄바꿈·빈 줄, 닫히지 않은 따옴표는 null', () => {
  const recs = parseCsv('﻿a,b\r\n"x,1","y\n2"\r\n\r\nz,\n')!
  assert.deepEqual(
    recs.map((r) => r.cells),
    [
      ['a', 'b'],
      ['x,1', 'y\n2'],
      ['z', ''],
    ],
  )
  assert.equal(recs[2].line, 5)
  assert.equal(parseCsv('a,"b\n'), null)
})

test('파일 파서: 헤더 필수 열·알 수 없는 열 경고·칸 초과 행 오류·2,000행 상한·JSON 배열/{entries}', () => {
  assert.equal(parseLexiconFile('surface,accentType\n明日,3\n', 'csv').fileErrors[0]?.code, 'E_IMPORT_HEADER')
  const f = parseLexiconFile('Surface,reading,extra\n明日,アシタ,x\n今日,キョー,y,z\n', 'csv')
  assert.deepEqual(f.warnings, ['UNKNOWN_COLUMN:extra'])
  assert.deepEqual(f.rows[0].raw, { surface: '明日', reading: 'アシタ' })
  assert.equal(f.rows[1].errors?.[0]?.code, 'E_ROW_FORMAT')
  const big = parseLexiconFile('surface,reading\n' + '明日,アシタ\n'.repeat(2001), 'csv')
  assert.deepEqual([big.fileErrors[0]?.code, big.rowCount], ['E_IMPORT_TOO_MANY_ROWS', 2001])
  assert.equal(parseLexiconFile('{"entries":[{"surface":"明日","reading":"アシタ","id":"x"}]}', 'json').rows[0].raw.surface, '明日')
  assert.deepEqual(parseLexiconFile('{"entries":[{"surface":"明日","reading":"アシタ","id":"x"}]}', 'json').warnings, ['UNKNOWN_KEY:id'])
  assert.equal(parseLexiconFile('[1]', 'json').rows[0].errors?.[0]?.code, 'E_ROW_FORMAT')
  assert.equal(parseLexiconFile('{', 'json').fileErrors[0]?.code, 'E_IMPORT_FORMAT')
  assert.equal(parseLexiconFile('a,"b\n', 'csv').fileErrors[0]?.code, 'E_IMPORT_FORMAT')
})

test('왕복 불변: Export CSV/JSON → 같은 표에 Import 하면 전부 UNCHANGED(메모·비활성·범위·위험 문자 포함)', () => {
  const existing = [
    R('a', { surface: '明日', reading: 'アシタ', accentType: 3, wordType: 'COMMON', note: '=cmd|" 쉼표,포함' }),
    R('b', { surface: '日本橋', reading: 'ニホンバシ', note: null, enabled: false }),
    R('c', { surface: '田中', reading: 'タナカ', scope: 'USER', scopeRefId: 'user1', priority: 99, note: '-메모' }),
  ]
  const csv = formatLexiconCsv(existing)
  assert.ok(csv.startsWith('﻿surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled\r\n'))
  const fromCsv = parseLexiconFile(csv, 'csv')
  assert.deepEqual(planImport(existing, fromCsv.rows, 'REPLACE_SCOPE').counts, { add: 0, update: 0, disable: 0, unchanged: 3, error: 0 })
  const json = JSON.stringify({ dictionaryVersion: 3, environment: 'LOCAL', exportedAt: 'x', entries: existing.map(fieldsOf) })
  assert.deepEqual(planImport(existing, parseLexiconFile(json, 'json').rows, 'MERGE').counts, { add: 0, update: 0, disable: 0, unchanged: 3, error: 0 })
})

// ── 미리듣기 도우미 ─────────────────────────────────────────────────────

test('미리듣기: 초안(forced)은 문맥 밖 범위여도 적용되고 같은 표기의 ACTIVE 항목보다 우선', () => {
  const E = (o: Partial<LexiconEntryData> & Pick<LexiconEntryData, 'surface' | 'reading'>): LexiconEntryData => ({ accentType: 0, priority: 10, scope: 'GLOBAL', scopeRefId: null, wordType: null, enabled: true, ...o })
  const active = E({ surface: '明日', reading: 'アシタ', scope: 'USER', scopeRefId: 'me' })
  const draft = E({ surface: '明日', reading: 'アス', scope: 'LESSON', scopeRefId: 'l1' })
  const sel = selectEntries([active, draft], { userId: 'me' }, new Set([draft]))
  assert.equal(sel.get('明日')?.reading, 'アス')
  assert.equal(selectEntries([active, draft], { userId: 'me' }).get('明日')?.reading, 'アシタ')
})

test('미리듣기 조각: 문장 단위로 60자 이하 묶음', () => {
  assert.deepEqual(packChunks('こんにちは。元気ですか。'), ['こんにちは。元気ですか。'])
  const long = `${'あ'.repeat(40)}。${'い'.repeat(40)}。`
  assert.deepEqual(
    packChunks(long).map((c) => [...c].length),
    [41, 41],
  )
})

function wav(samples: number, rate = 1000): Buffer {
  const data = Buffer.alloc(samples * 2)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0, 'ascii')
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8, 'ascii')
  h.write('fmt ', 12, 'ascii')
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36, 'ascii')
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

test('WAV 잇기: 길이 = 합 + 간격, 형식이 다르면 null', () => {
  const joined = concatWav([wav(500), wav(300)], 200)!
  assert.equal(wavInfo(joined)?.durationMs, 1000)
  assert.equal(concatWav([wav(500), wav(300, 2000)]), null)
  const one = wav(100)
  assert.equal(concatWav([one]), one)
})

// ── 버전 전이(메모리 가짜 트랜잭션) ──────────────────────────────────────

type Ver = { id: string; environment: string; version: number; status: string; snapshotHash: string; snapshot: unknown; changeSummary: string | null; actorUserId: string | null; createdAt: Date }
type Ent = LexiconEntryRow & { environment: string; createdAt: Date; updatedAt: Date }

function fakeTx(entries: Ent[], versions: Ver[], writes: string[] = []): Tx {
  let n = 100
  const now = () => new Date()
  const envOf = (w: { environment?: string }) => w.environment
  const db = {
    $queryRaw: async () => [],
    pronunciationLexiconVersion: {
      findFirst: async ({ where }: { where: { environment: string; status?: string; version?: { lt: number } } }) =>
        versions
          .filter((v) => v.environment === envOf(where) && (!where.status || v.status === where.status) && (!where.version || v.version < where.version.lt))
          .sort((a, b) => b.version - a.version)[0] ?? null,
      aggregate: async ({ where }: { where: { environment: string } }) => {
        const vs = versions.filter((v) => v.environment === where.environment).map((v) => v.version)
        return { _max: { version: vs.length ? Math.max(...vs) : null } }
      },
      updateMany: async ({ where, data }: { where: { environment: string; status: string }; data: { status: string } }) => {
        writes.push('version.updateMany')
        let count = 0
        for (const v of versions) {
          if (v.environment !== where.environment || v.status !== where.status) continue
          v.status = data.status
          count++
        }
        return { count }
      },
      create: async ({ data }: { data: Omit<Ver, 'id' | 'createdAt'> }) => {
        writes.push('version.create')
        if (versions.some((v) => v.environment === data.environment && v.version === data.version)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        const row = { ...data, id: `v${n++}`, createdAt: now() }
        versions.push(row)
        return row
      },
      findUnique: async ({ where }: { where: { environment_version: { environment: string; version: number } } }) =>
        versions.find((v) => v.environment === where.environment_version.environment && v.version === where.environment_version.version) ?? null,
    },
    pronunciationLexiconEntry: {
      findMany: async ({ where }: { where: { environment: string } }) => entries.filter((e) => e.environment === where.environment),
      create: async ({ data }: { data: Omit<Ent, 'id' | 'createdAt' | 'updatedAt'> }) => {
        writes.push('entry.create')
        const row = { ...data, id: `e${n++}`, createdAt: now(), updatedAt: now() }
        entries.push(row)
        return row
      },
      createMany: async ({ data }: { data: Omit<Ent, 'id' | 'createdAt' | 'updatedAt'>[] }) => {
        writes.push('entry.createMany')
        for (const d of data) entries.push({ ...d, id: `e${n++}`, createdAt: now(), updatedAt: now() })
        return { count: data.length }
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Ent> }) => {
        writes.push('entry.update')
        return Object.assign(entries.find((e) => e.id === where.id)!, data, { updatedAt: now() })
      },
      findUnique: async ({ where }: { where: { id: string } }) => entries.find((e) => e.id === where.id) ?? null,
    },
  }
  return db as unknown as Tx
}

test('버전 전이: 변경마다 새 ACTIVE 1·직전 SUPERSEDED, 무변경은 버전 없음, baseVersion 불일치 409, 중복 409, Rollback = 새 ACTIVE·대체된 버전 ROLLED_BACK·대상 상태 불변', async () => {
  const seed = [F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })]
  const entries: Ent[] = seed.map((f, i) => ({ ...f, id: `s${i}`, environment: 'LOCAL', createdAt: new Date(), updatedAt: new Date() }))
  const v1Snapshot = toSnapshot(seed).map(withoutNote) // 시드 v1 은 note 없음
  const versions: Ver[] = [{ id: 'v1', environment: 'LOCAL', version: 1, status: 'ACTIVE', snapshotHash: snapshotHash(seed), snapshot: v1Snapshot, changeSummary: '시드', actorUserId: null, createdAt: new Date() }]
  const tx = fakeTx(entries, versions)
  const ctx = (baseVersion: number) => ({ environment: 'LOCAL' as const, actorUserId: 'admin', baseVersion, reason: 'QA' })
  const statuses = () => versions.map((v) => `${v.version}:${v.status}`).join(' ')

  const created = await writeLexicon(tx, ctx(1), { kind: 'CREATE', value: F({ surface: '秋葉原', reading: 'アキハバラ', scope: 'USER', scopeRefId: 'u1' }) })
  assert.equal(created.changed, true)
  assert.equal(created.version.version, 2)
  assert.equal(created.previousVersion, 1)
  assert.equal(created.entry?.surface, '秋葉原')
  assert.equal(statuses(), '1:SUPERSEDED 2:ACTIVE')
  assert.equal(versions[1].snapshotHash, snapshotHash([...seed, F({ surface: '秋葉原', reading: 'アキハバラ', scope: 'USER', scopeRefId: 'u1' })]))

  await assert.rejects(writeLexicon(tx, ctx(1), { kind: 'DISABLE', id: created.entry!.id }), (e: unknown) => e instanceof LexiconVersionConflictError && e.currentVersion === 2 && e.baseVersion === 1)
  await assert.rejects(writeLexicon(tx, ctx(2), { kind: 'CREATE', value: F({ surface: '秋葉原', reading: 'アキバ', scope: 'USER', scopeRefId: 'u1' }) }), (e: unknown) => e instanceof LexiconDuplicateError && e.existing?.id === created.entry!.id)
  await assert.rejects(writeLexicon(tx, ctx(2), { kind: 'UPDATE', id: created.entry!.id, patch: { surface: '秋葉' } }), (e: unknown) => e instanceof LexiconEntryInvalidError && e.errors[0].code === 'E_IMMUTABLE')

  const noop = await writeLexicon(tx, ctx(2), { kind: 'UPDATE', id: created.entry!.id, patch: { reading: 'ｱｷﾊﾊﾞﾗ' } })
  assert.deepEqual([noop.changed, noop.version.version, versions.length], [false, 2, 2])

  const disabled = await writeLexicon(tx, ctx(2), { kind: 'DISABLE', id: created.entry!.id })
  assert.deepEqual([disabled.changed, disabled.version.version, disabled.entry?.enabled], [true, 3, false])
  const again = await writeLexicon(tx, ctx(3), { kind: 'DISABLE', id: created.entry!.id })
  assert.deepEqual([again.changed, versions.length], [false, 3])

  const revived = await writeLexicon(tx, ctx(3), { kind: 'CREATE', value: F({ surface: '秋葉原', reading: 'アキバ', scope: 'USER', scopeRefId: 'u1' }) })
  assert.deepEqual([revived.revived, revived.version.version, revived.entry?.id, revived.entry?.reading, entries.length], [true, 4, created.entry!.id, 'アキバ', 3])

  await assert.rejects(writeLexicon(tx, ctx(4), { kind: 'IMPORT', rows: [{ row: 1, raw: { surface: 'ABC', reading: 'エー' } }], mode: 'MERGE' }), LexiconImportInvalidError)
  assert.equal(versions.length, 4)

  const rb = await writeLexicon(tx, ctx(4), { kind: 'ROLLBACK', targetVersion: 1 })
  assert.deepEqual([rb.version.version, rb.restoredFrom, rb.counts, rb.changeSummary], [5, 1, { add: 0, update: 0, disable: 1 }, 'v1 로 되돌림: QA'])
  assert.equal(statuses(), '1:SUPERSEDED 2:SUPERSEDED 3:SUPERSEDED 4:ROLLED_BACK 5:ACTIVE')
  assert.equal(versions[4].snapshotHash, versions[0].snapshotHash)
  assert.equal(entries.length, 3) // 물리 삭제 없음 — 되돌린 항목은 비활성으로 남는다
  assert.equal(entries.find((e) => e.surface === '秋葉原')?.enabled, false)
  await assert.rejects(writeLexicon(tx, ctx(5), { kind: 'ROLLBACK', targetVersion: 5 }), (e: unknown) => e instanceof LexiconRollbackRejectedError && e.reason === 'ALREADY_ACTIVE')
  await assert.rejects(writeLexicon(tx, ctx(5), { kind: 'ROLLBACK', targetVersion: 1 }), (e: unknown) => e instanceof LexiconRollbackRejectedError && e.reason === 'NO_CHANGE')
  assert.equal(versions.filter((v) => v.status === 'ACTIVE').length, 1)

  const imported = await writeLexicon(tx, ctx(5), {
    kind: 'IMPORT',
    mode: 'MERGE',
    rows: [
      { row: 1, raw: { surface: '明日', reading: 'アシタ', accentType: 3 } },
      { row: 2, raw: { surface: '御徒町', reading: 'オカチマチ' } },
    ],
  })
  assert.deepEqual([imported.version.version, imported.counts, imported.importPlan?.counts.unchanged], [6, { add: 1, update: 0, disable: 0 }, 1])
  const diff = diffRows(readSnapshot(versions[4].snapshot), readSnapshot(versions[5].snapshot))
  assert.deepEqual(
    diff.rows.map((r) => `${r.kind}:${r.surface}`),
    ['ADDED:御徒町'],
  )
})

// ── REV-017 M1: 빠진 값(짧은 행·없는 키) vs 명시적 빈 값 ─────────────────────

const HEADER = 'surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled'
const CUSTOM = { surface: '明日', reading: 'アシタ', accentType: 3, priority: 500, wordType: 'COMMON' as const, note: 'keep me', enabled: false }

test('REV-017: 머리글보다 짧은 행의 뒤쪽 칸은 값 없음 — 기존 값 유지(꺼진 항목은 꺼진 채), 새 항목은 기본값', () => {
  const existing = [R('a', CUSTOM)]
  const same = parseLexiconFile(`${HEADER}\n明日,アシタ\n`, 'csv')
  assert.deepEqual(same.rows[0].raw, { surface: '明日', reading: 'アシタ' })
  assert.deepEqual(same.rows[0].errors, [])
  assert.deepEqual(planImport(existing, same.rows, 'MERGE').counts, { add: 0, update: 0, disable: 0, unchanged: 1, error: 0 })

  const changed = planImport(existing, parseLexiconFile(`${HEADER}\n明日,アスノヒ\n`, 'csv').rows, 'MERGE')
  assert.deepEqual(changed.counts, { add: 0, update: 1, disable: 0, unchanged: 0, error: 0 })
  assert.deepEqual(changed.items[0].after, F({ ...CUSTOM, reading: 'アスノヒ' }))
  assert.equal(planRows(changed.items)[0].kind, 'CHANGED') // 켜지지 않는다

  const added = planImport(existing, parseLexiconFile(`${HEADER}\n今日,キョー\n`, 'csv').rows, 'MERGE')
  assert.deepEqual(added.items[0].after, F({ surface: '今日', reading: 'キョー' }))
})

test('REV-017: 칸이 있는 빈 값("")·JSON null 은 명시적 기본값 — 메모·종류 지움·우선순위 10·enabled 빈 칸은 true(켜짐)', () => {
  const existing = [R('a', CUSTOM)]
  const cleared = planImport(existing, parseLexiconFile(`${HEADER}\n明日,アシタ,3,,GLOBAL,,,,\n`, 'csv').rows, 'MERGE')
  assert.deepEqual(cleared.items[0].after, F({ surface: '明日', reading: 'アシタ', accentType: 3 }))
  assert.equal(planRows(cleared.items)[0].kind, 'ENABLED')
  const partial = planImport(existing, parseLexiconFile(`${HEADER}\n明日,アシタ,3,500,GLOBAL,,COMMON,\n`, 'csv').rows, 'MERGE') // note 빈 칸, enabled 칸 없음
  assert.deepEqual(partial.items[0].after, F({ ...CUSTOM, note: null }))

  const jsonMissing = planImport(existing, parseLexiconFile(JSON.stringify([{ surface: '明日', reading: 'アシタ' }]), 'json').rows, 'MERGE')
  assert.deepEqual(jsonMissing.counts.unchanged, 1)
  const jsonNull = planImport(existing, parseLexiconFile(JSON.stringify([{ surface: '明日', reading: 'アシタ', note: null, wordType: null }]), 'json').rows, 'MERGE')
  assert.deepEqual(jsonNull.items[0].after, F({ ...CUSTOM, note: null, wordType: null }))
})

test('REV-017: dryRun 계획 = 실제 적용 결과(짧은 행·빈 칸·새 항목 섞음), 적용 뒤 Export → Import 변경 0', async () => {
  const seed = [F(CUSTOM), F({ surface: '日本橋', reading: 'ニホンバシ', note: '메모' })]
  const entries: Ent[] = seed.map((f, i) => ({ ...f, id: `s${i}`, environment: 'LOCAL', createdAt: new Date(), updatedAt: new Date() }))
  const versions: Ver[] = [{ id: 'v1', environment: 'LOCAL', version: 1, status: 'ACTIVE', snapshotHash: snapshotHash(seed), snapshot: toSnapshot(seed), changeSummary: '시드', actorUserId: null, createdAt: new Date() }]
  const rows = parseLexiconFile(`${HEADER}\n明日,アスノヒ\n日本橋,ニッポンバシ,0,10,GLOBAL,,,,\n秋葉原,アキハバラ\n`, 'csv').rows
  const before = entries.map(({ id, surface, reading, accentType, priority, scope, scopeRefId, wordType, note, enabled }) => ({ id, surface, reading, accentType, priority, scope, scopeRefId, wordType, note, enabled }))
  const plan = planImport(before, rows, 'MERGE')
  const expected = toSnapshot(applyPlan(before, plan.items))
  const r = await writeLexicon(fakeTx(entries, versions), { environment: 'LOCAL', actorUserId: 'admin', baseVersion: 1, reason: 'QA' }, { kind: 'IMPORT', rows, mode: 'MERGE' })
  assert.deepEqual(r.importPlan?.counts, plan.counts)
  assert.deepEqual(toSnapshot(entries), expected)
  assert.deepEqual(readSnapshot(versions[1].snapshot), readSnapshot(expected))
  assert.equal(entries.find((e) => e.surface === '明日')?.enabled, false)
  assert.equal(entries.find((e) => e.surface === '日本橋')?.note, null)
  const rows2 = parseLexiconFile(formatLexiconCsv(toSnapshot(entries) as LexiconEntryFields[]), 'csv').rows
  assert.deepEqual(planImport(entries, rows2, 'REPLACE_SCOPE').counts, { add: 0, update: 0, disable: 0, unchanged: 3, error: 0 })
})

// ── Codex C2: 스냅샷 무결성(해시·모양·규칙) — 가짜 tx 에 손상 스냅샷을 넣는다(라이브 DB 는 건드리지 않음) ──────

function c2Fixture(v1Snapshot: unknown, v1Hash?: string) {
  const seed = [F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })]
  const now = [...seed, F({ surface: '秋葉原', reading: 'アキハバラ' })]
  const entries: Ent[] = now.map((f, i) => ({ ...f, id: `s${i}`, environment: 'LOCAL', createdAt: new Date(), updatedAt: new Date() }))
  const versions: Ver[] = [
    { id: 'v1', environment: 'LOCAL', version: 1, status: 'SUPERSEDED', snapshotHash: v1Hash ?? snapshotHash(seed), snapshot: v1Snapshot, changeSummary: '시드', actorUserId: null, createdAt: new Date() },
    { id: 'v2', environment: 'LOCAL', version: 2, status: 'ACTIVE', snapshotHash: snapshotHash(now), snapshot: toSnapshot(now), changeSummary: '추가', actorUserId: 'admin', createdAt: new Date() },
  ]
  const writes: string[] = []
  return { seed, entries, versions, writes, tx: fakeTx(entries, versions, writes) }
}
const rollbackTo1 = (tx: Tx) => writeLexicon(tx, { environment: 'LOCAL', actorUserId: 'admin', baseVersion: 2, reason: 'QA' }, { kind: 'ROLLBACK', targetVersion: 1 })

test('C2: 정상 스냅샷(시드처럼 note 없음 포함)은 무결성 OK → 되돌리기 그대로 동작', async () => {
  const seed = [F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })]
  const legacy = toSnapshot(seed).map(withoutNote)
  assert.equal(checkSnapshot(legacy, snapshotHash(seed)).integrity, 'OK')
  const f = c2Fixture(legacy)
  const r = await rollbackTo1(f.tx)
  assert.deepEqual([r.version.version, r.counts], [3, { add: 0, update: 0, disable: 1 }])
  assert.equal(f.versions[2].snapshotHash, f.versions[0].snapshotHash)
})

test('C2: 해시 불일치(정상 행 하나가 빠진 스냅샷) → 되돌리기 거절 MISMATCH, 버전·항목·감사 쓰기 0', async () => {
  const seed = [F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })]
  const tampered = toSnapshot([seed[0]]) // 日本橋 가 빠짐 — 예전 readSnapshot 이면 정상 항목 日本橋 를 끄는 계획이 나왔다
  const f = c2Fixture(tampered, snapshotHash(seed))
  await assert.rejects(rollbackTo1(f.tx), (e: unknown) => e instanceof LexiconSnapshotIntegrityError && e.integrity === 'MISMATCH' && e.version === 1)
  assert.deepEqual(f.writes, []) // writeLexicon 이 던지면 admin commit 은 감사 행을 쓰지 않는다(같은 tx 안, 반환 뒤에만 기록)
  assert.deepEqual(f.versions.map((v) => `${v.version}:${v.status}`), ['1:SUPERSEDED', '2:ACTIVE'])
  assert.ok(f.entries.every((e) => e.enabled))
})

test('C2: 모양 손상(MALFORMED)·규칙 위반/정규형 아님/키 중복(INVALID_ENTRIES) → 행을 버리지 않고 거절(해시가 그 값으로 계산됐어도)', async () => {
  const good = toSnapshot([F({ surface: '明日', reading: 'アシタ', accentType: 3 })])[0]
  const cases: [string, unknown[], string, string[]][] = [
    ['악센트 문자열', [{ ...good, accentType: '3' }], 'MALFORMED', ['E_SNAPSHOT_ROW']],
    ['scopeRefId 키 없음', [Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'scopeRefId'))], 'MALFORMED', ['E_SNAPSHOT_ROW']],
    ['배열 아님', { rows: [] } as unknown as unknown[], 'MALFORMED', ['E_SNAPSHOT_SHAPE']],
    ['히라가나 읽기(옛 규칙)', [{ ...good, reading: 'あした', accentType: 0 }], 'INVALID_ENTRIES', ['E_READING']],
    ['우선순위 범위 밖', [{ ...good, priority: 5000 }], 'INVALID_ENTRIES', ['E_PRIORITY']],
    ['정규형 아님(앞 공백)', [{ ...good, surface: ' 明日' }], 'INVALID_ENTRIES', ['E_NOT_CANONICAL']],
    ['키 중복', [good, { ...good, reading: 'アス', accentType: 0 }], 'INVALID_ENTRIES', ['E_DUPLICATE_KEY']],
  ]
  for (const [name, snap, integrity, codes] of cases) {
    const rows = Array.isArray(snap) ? (snap as LexiconEntryFields[]).filter((r) => r && typeof r === 'object') : []
    const hash = snapshotHash(rows.map((r) => ({ ...r, note: r.note ?? null })))
    const c = checkSnapshot(snap, hash)
    assert.equal(c.integrity, integrity, name)
    assert.deepEqual(c.issues.at(-1)?.codes, codes, name)
    const f = c2Fixture(snap, hash)
    await assert.rejects(rollbackTo1(f.tx), (e: unknown) => e instanceof LexiconSnapshotIntegrityError && e.integrity === integrity, name)
    assert.deepEqual(f.writes, [], name)
  }
})

test('C2: 버전 diff — 손상 스냅샷은 그럴듯한 diff 대신 거절(어느 버전인지), compare=active 는 지금 항목 표 기준', async () => {
  const seed = [F({ surface: '明日', reading: 'アシタ', accentType: 3 }), F({ surface: '日本橋', reading: 'ニホンバシ' })]
  const bad = c2Fixture(toSnapshot([seed[0]]), snapshotHash(seed))
  await assert.rejects(getLexiconVersionDiff('LOCAL', 1, 'active', bad.tx), (e: unknown) => e instanceof LexiconSnapshotIntegrityError && e.version === 1)
  await assert.rejects(getLexiconVersionDiff('LOCAL', 2, 'previous', bad.tx), (e: unknown) => e instanceof LexiconSnapshotIntegrityError && e.version === 1) // 비교 기준(앞 버전)이 손상
  const good = c2Fixture(toSnapshot(seed))
  const prev = await getLexiconVersionDiff('LOCAL', 2, 'previous', good.tx)
  assert.deepEqual([prev?.against, prev?.row.integrity, prev?.rows.map((r) => `${r.kind}:${r.surface}`)], [1, 'OK', ['ADDED:秋葉原']])
  good.entries.find((e) => e.surface === '日本橋')!.enabled = false // 지금 항목 표만 바뀐 상태(스냅샷과 다름)
  const act = await getLexiconVersionDiff('LOCAL', 1, 'active', good.tx)
  assert.deepEqual([act?.against, act?.rows.map((r) => `${r.kind}:${r.surface}`).sort()], [2, ['DISABLED:秋葉原', 'ENABLED:日本橋']])
})
