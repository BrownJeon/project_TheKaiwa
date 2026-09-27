import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Err } from '@/components/common/errors'
import {
  actorLabel,
  fieldErrorText,
  importErrorText,
  mapServerFieldErrors,
  previewErrorText,
  refLabel,
  subCode,
  writeErrorNotice,
} from '../lexiconCopy'
import { DEFAULT_LEXICON_PARAMS, isFiltered, parseLexiconParams, parseVersionParam, patchParams, toQuery } from '../lexiconParams'
import { listPath } from '../lexiconApi'

function err(status: number, details: Record<string, unknown> = {}, code: string | null = null, retryAfterSec: number | null = null): Err {
  return { status, message: '서버 문구(그리지 않음)', code, details, retryAfterSec }
}

test('409 두 갈래: 버전 충돌(→ 새로 불러오기, v{a} → v{b}) · 중복(→ 그 항목 열기, 꺼짐 표시)', () => {
  const vc = writeErrorNotice(err(409, { reason: 'VERSION_CONFLICT', baseVersion: 7, currentVersion: 8 }, 'CONFLICT'), 'save')
  assert.equal(vc.action, 'reload')
  assert.match(vc.text, /\(v7 → v8\)/)
  assert.match(vc.text, /입력한 내용은 그대로예요/)
  const imp = writeErrorNotice(err(409, { reason: 'VERSION_CONFLICT', currentVersion: 9 }, 'CONFLICT'), 'import', { baseVersion: 8 })
  assert.equal(imp.action, 'redryRun')
  assert.match(imp.text, /\(v8 → v9\)/)
  assert.equal(writeErrorNotice(err(409, { reason: 'VERSION_CONFLICT' }), 'rollback').action, 'reload')
  const dup = writeErrorNotice(err(409, { reason: 'E_LEXICON_DUPLICATE', existingId: 'x' }, 'CONFLICT'), 'save', { surface: '日本橋', existingDisabled: true })
  assert.equal(dup.action, 'openExisting')
  assert.equal(dup.text, '같은 범위에 「日本橋」 항목이 이미 있어요 (꺼져 있어요).')
  assert.equal(writeErrorNotice(err(409, { reason: 'ALREADY_ACTIVE' }), 'rollback').text, '지금 쓰는 버전이에요.')
  assert.equal(writeErrorNotice(err(409, { reason: 'NO_CHANGE' }), 'rollback').text, '지금 사전과 내용이 같아 되돌릴 것이 없어요.')
})

test('403: PRODUCTION(누락 capability 또는 확인 문구) · 그 밖(누락 이름)', () => {
  const prod = '운영 환경 사전은 SUPER_ADMIN 이 확인 문구를 넣어야 바꿀 수 있어요.'
  assert.equal(writeErrorNotice(err(403, { missing: ['config.apply.production'] }, 'FORBIDDEN'), 'save').text, prod)
  assert.equal(writeErrorNotice(err(403, { reason: 'PRODUCTION_CONFIRMATION_REQUIRED' }, 'FORBIDDEN'), 'disable').text, prod)
  assert.equal(writeErrorNotice(err(403, { missing: ['voices.manage'] }, 'FORBIDDEN'), 'save').text, '이 변경 권한이 없어요 (voices.manage).')
})

test('404·413·422(가져오기)·429·0·500', () => {
  assert.equal(writeErrorNotice(err(404), 'save').action, 'refreshList')
  assert.equal(writeErrorNotice(err(404), 'rollback').text, '그 버전을 찾을 수 없어요.')
  assert.match(writeErrorNotice(err(413), 'import').text, /256KB/)
  assert.match(writeErrorNotice(err(422, { reason: 'E_IMPORT_TOO_MANY_ROWS', rows: 2500 }), 'import').text, /2,000행을 넘어요\(2500행\)/)
  assert.match(writeErrorNotice(err(422, { reason: 'E_IMPORT_HEADER' }), 'import').text, /머리글/)
  const has = writeErrorNotice(err(422, { reason: 'E_IMPORT_HAS_ERRORS' }), 'import')
  assert.equal(has.action, 'redryRun')
  assert.match(writeErrorNotice(err(422, { reason: 'E_IMPORT_FORMAT' }), 'import').text, /UTF-8 CSV/)
  assert.match(writeErrorNotice(err(429, {}, 'RATE_LIMITED', 12), 'save').text, /12초 뒤/)
  assert.equal(writeErrorNotice(err(0), 'save').text, '연결하지 못했어요. 네트워크를 확인해 주세요.')
  assert.equal(writeErrorNotice(err(0), 'import').action, 'refreshList')
  assert.match(writeErrorNotice(err(500), 'save').text, /입력한 내용은 그대로예요/)
})

test('서버 message 는 어떤 문구에도 섞이지 않는다', () => {
  for (const s of [0, 400, 403, 404, 409, 413, 422, 429, 500, 502]) {
    for (const k of ['save', 'disable', 'enable', 'import', 'rollback'] as const) assert.doesNotMatch(writeErrorNotice(err(s), k).text, /서버 문구/)
    assert.doesNotMatch(previewErrorText(err(s)), /서버 문구/)
  }
})

test('mapServerFieldErrors: errors[] · fields{} · field+reason 세 모양, 칸 밖이면 null', () => {
  const a = mapServerFieldErrors(err(422, { reason: 'E_LEXICON_ENTRY_INVALID', errors: [{ field: 'reading', code: 'E_READING' }, { field: 'reason', code: 'E_REASON' }] }))
  assert.deepEqual(a?.fields, { reading: { code: 'E_READING' } })
  assert.deepEqual(a?.reason, { code: 'E_REASON' })
  const b = mapServerFieldErrors(err(422, { fields: { accentType: 'E_ACCENT', surface: 'E_SURFACE_NOT_JA' } }))
  assert.deepEqual(b?.fields, { accentType: { code: 'E_ACCENT' }, surface: { code: 'E_SURFACE_NOT_JA' } })
  const c = mapServerFieldErrors(err(400, { field: 'reason' }, 'VALIDATION'))
  assert.deepEqual(c?.reason, { code: 'REQUIRED' })
  assert.equal(mapServerFieldErrors(err(400, { field: 'baseVersion' })), null)
  assert.equal(mapServerFieldErrors(err(409, { field: 'reading' })), null)
})

test('fieldErrorText: 서버 코드(E_*)와 화면 코드가 같은 문구, 모르는 코드는 코드를 보인다', () => {
  assert.equal(fieldErrorText('surface', { code: 'E_SURFACE_NOT_JA' }), '일본어 글자(가나·한자)가 들어가야 해요.')
  assert.equal(fieldErrorText('surface', { code: 'NO_JAPANESE' }), '일본어 글자(가나·한자)가 들어가야 해요.')
  assert.equal(fieldErrorText('surface', { code: 'TOO_LONG', n: 41 }), '표기는 40자까지예요(41자).')
  assert.equal(fieldErrorText('reading', { code: 'E_READING' }), '읽기는 가나(히라가나·가타카나)와 장음 ー 만 쓸 수 있어요.')
  assert.equal(fieldErrorText('accentType', { code: 'E_ACCENT' }, { moras: 5 }), '악센트는 0(평판)부터 5(모라 수)까지예요.')
  assert.equal(fieldErrorText('priority', { code: 'E_PRIORITY' }), '우선순위는 0~1000 사이 정수예요.')
  assert.equal(fieldErrorText('scopeRefId', { code: 'E_SCOPE_REF' }, { scope: 'VOICE' }), '목소리를 골라 주세요.')
  assert.equal(fieldErrorText('scopeRefId', { code: 'E_SCOPE_REF' }, { scope: 'LESSON' }), '레슨 id를 입력해 주세요.')
  assert.equal(fieldErrorText('scopeRefId', { code: 'E_SCOPE_REF_NOT_FOUND' }, { scope: 'COURSE' }), '그 id 의 코스를 찾을 수 없어요.')
  assert.equal(fieldErrorText('confirm', { code: 'MISMATCH' }), 'PRODUCTION 을 그대로 입력해야 바꿀 수 있어요.')
  assert.equal(fieldErrorText('note', { code: 'E_WHAT' }), '메모는 200자까지예요.')
  assert.equal(fieldErrorText('reading', { code: 'E_WHAT' }), '입력값을 확인해 주세요 (E_WHAT)')
})

test('previewErrorText: 429 카운트다운 · 엔진 코드(422 ENGINE_UNAVAILABLE 포함) · 502/504 · 0 · 403 · 예문 길이', () => {
  assert.match(previewErrorText(err(429, { retryAfterSec: 30 })), /1분에 10번까지예요\. 30초 뒤에/)
  const down = '지금은 선생님 목소리 서비스에 닿지 않아 읽기 확인·미리듣기를 할 수 없어요. 저장은 할 수 있어요.'
  assert.equal(previewErrorText(err(422, {}, 'ENGINE_UNAVAILABLE')), down)
  assert.equal(previewErrorText(err(502, {}, 'ENGINE_ERROR')), down)
  assert.equal(previewErrorText(err(504)), down)
  assert.equal(previewErrorText(err(0)), '연결하지 못했어요. 네트워크를 확인해 주세요.')
  assert.equal(previewErrorText(err(403)), '미리듣기 권한이 없어요 (voices.manage).')
  assert.equal(previewErrorText(err(422, { reason: 'E_PREVIEW_TEXT_TOO_LONG', field: 'text' })), '예문이 너무 길어요. 더 짧게 줄여 주세요.')
})

test('importErrorText: 칸+코드, 모르는 코드는 "확인이 필요해요 ({code})"', () => {
  assert.equal(importErrorText('reading', 'E_READING'), '읽기는 가나와 ー 만 쓸 수 있어요(60자까지)')
  assert.equal(importErrorText(null, 'E_DUPLICATE_IN_FILE'), '파일 안에 같은 표기·범위가 두 번 있어요')
  assert.equal(importErrorText('row', 'E_ROW_FORMAT'), '칸 수가 머리글과 달라요')
  assert.equal(importErrorText('scopeRefId', 'E_SCOPE_REF_NOT_FOUND'), '대상 id 를 찾을 수 없어요')
  assert.equal(importErrorText(null, 'E_SCOPE'), '범위는 GLOBAL·COURSE·LESSON·VOICE·USER 중 하나예요')
  assert.equal(importErrorText(null, 'E_WHAT'), '확인이 필요해요 (E_WHAT)')
})

test('subCode·actorLabel·refLabel', () => {
  assert.equal(subCode(err(409, { reason: 'VERSION_CONFLICT' }, 'CONFLICT')), 'VERSION_CONFLICT')
  assert.equal(subCode(err(409, {}, 'CONFLICT')), 'CONFLICT')
  assert.equal(actorLabel(null), '시스템')
  assert.equal(actorLabel({ name: '관리자', role: 'SUPER_ADMIN' }), '관리자(SUPER_ADMIN)')
  assert.equal(actorLabel({ name: null, role: null }), '알 수 없음')
  assert.equal(refLabel({ scope: 'VOICE', scopeRefId: 'voice_haruka_0001' }, (id) => (id === 'voice_haruka_0001' ? '하루카' : null)), '하루카')
  assert.equal(refLabel({ scope: 'USER', scopeRefId: 'cm1abcdefghijklmnop' }, () => null), 'cm1abcde…')
  assert.equal(refLabel({ scope: 'GLOBAL', scopeRefId: null }, () => null), '')
})

test('parseLexiconParams: 틀린 값은 버린다 · toQuery 는 기본값을 뺀다', () => {
  assert.deepEqual(parseLexiconParams({ scope: 'X', page: '-1', inactive: 'yes', ref: 'a b' }), DEFAULT_LEXICON_PARAMS)
  assert.deepEqual(parseLexiconParams({ q: '日本', scope: 'USER', ref: 'cm1_x-2', inactive: '1', page: '3' }), { q: '日本', scope: 'USER', ref: 'cm1_x-2', inactive: true, page: 3 })
  assert.equal(parseLexiconParams({ scope: 'GLOBAL', ref: 'abc' }).ref, '')
  assert.equal(parseLexiconParams({ page: '1001' }).page, 1)
  assert.equal(parseLexiconParams({ q: 'あ'.repeat(41) }).q, '')
  assert.equal(parseLexiconParams({ scope: ['USER', 'GLOBAL'] }).scope, 'ALL')
  assert.equal(parseVersionParam({ v: '7' }), 7)
  assert.equal(parseVersionParam({ v: '0' }), null)
  assert.equal(parseVersionParam({ v: 'x' }), null)
  assert.equal(toQuery(DEFAULT_LEXICON_PARAMS), '')
  assert.equal(toQuery({ q: '日本', scope: 'VOICE', ref: 'v1', inactive: true, page: 2 }), `?q=${encodeURIComponent('日本')}&scope=VOICE&ref=v1&inactive=1&page=2`)
})

test('patchParams: 필터가 바뀌면 1쪽 · 범위를 바꾸면 대상 초기화', () => {
  const p = { q: '', scope: 'USER' as const, ref: 'u1', inactive: false, page: 4 }
  assert.equal(patchParams(p, { q: '日' }).page, 1)
  assert.equal(patchParams(p, { page: 2 }).page, 2)
  assert.equal(patchParams(p, { scope: 'LESSON' }).ref, '')
  assert.equal(patchParams(p, { scope: 'ALL' }).ref, '')
  assert.equal(isFiltered(DEFAULT_LEXICON_PARAMS), false)
  assert.equal(isFiltered({ ...DEFAULT_LEXICON_PARAMS, inactive: true, page: 3 }), false)
})

test('listPath: 범위 ALL 이면 scope·대상을 빼고 enabled=1|all·pageSize=50', () => {
  assert.equal(listPath(DEFAULT_LEXICON_PARAMS), '/api/admin/v1/lexicon?enabled=1&page=1&pageSize=50')
  assert.equal(
    listPath({ q: 'ニホン', scope: 'VOICE', ref: 'v1', inactive: true, page: 2 }),
    `/api/admin/v1/lexicon?q=${encodeURIComponent('ニホン')}&scope=VOICE&scopeRefId=v1&enabled=all&page=2&pageSize=50`,
  )
})

// ── 엔진명 0(screens.md §10-9): 이 화면의 문자열 리터럴에 엔진·모델·서비스 이름이 없다(주석 제외) ──────────────────
const BANNED = /g2p|openjtalk|mecab|user[_-]?dict|style-?bert|sbv2|\bM4\b|:8200|reazon|whisper|claude|haiku|sonnet|opus|qwen/i

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

test('엔진명 0: src/components/admin/lexicon 의 코드(주석 제외)', () => {
  const files = sourceFiles(join(process.cwd(), 'src/components/admin/lexicon'))
  assert.ok(files.length >= 20, `파일 ${files.length}개`)
  for (const f of files) {
    const hit = stripComments(readFileSync(f, 'utf8')).match(BANNED)
    assert.equal(hit, null, `${f}: ${hit?.[0]}`)
  }
})
