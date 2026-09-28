import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JWT_SECRET ??= 'test-jwt-secret-0123456789abcdef'

import { etagMatches, parseRange, serveFile, StreamSlots } from '../fileServe'
import { realpathInside } from '../storage'
import { buildVersionInfo, compareVersionNames, parseClientVersion, pickReleaseForFile, releaseFilePath, verifyReleaseFile, type ReleaseRow } from '../appRelease'
import { bindAppAuthCode, consumeAppAuthCode, issueAppAuthCode, type AppAuthCodeStore, type AppAuthCodeUser } from '../auth/oauth/app-code'
import { isPkceChallenge, isPkceVerifier, pkceChallengeOf } from '../auth/oauth/pkce'
import { createOAuthState, verifyOAuthState } from '../auth/oauth/state'
import { signPendingSignup, verifyPendingSignup } from '../auth/oauth/pending'
import { buildGoogleAuthHref } from '../auth/oauth/next-path'

// ── Range·ETag ──────────────────────────────────────────────────────────

test('parseRange: 단일 구간·열린 끝·접미사·범위 밖 416·형식 오류/여러 구간은 무시', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 })
  assert.deepEqual(parseRange('bytes=990-5000', 1000), { start: 990, end: 999 }, '끝이 크기를 넘으면 잘라 준다')
  assert.equal(parseRange('bytes=1000-', 1000), 'unsatisfiable')
  assert.equal(parseRange('bytes=1000-1001', 1000), 'unsatisfiable')
  assert.equal(parseRange('bytes=-0', 1000), 'unsatisfiable')
  assert.equal(parseRange(null, 1000), null)
  assert.equal(parseRange('bytes=0-1,5-9', 1000), null, '여러 구간은 전체 응답')
  assert.equal(parseRange('bytes=9-1', 1000), null, '뒤집힌 구간은 무시')
  assert.equal(parseRange('items=0-1', 1000), null)
  assert.equal(parseRange('bytes=abc-', 1000), null)
  assert.equal(parseRange('bytes=-', 1000), null)
})

test('etagMatches: 정확·목록·약한·* 비교', () => {
  assert.ok(etagMatches('"abc"', '"abc"'))
  assert.ok(etagMatches('W/"abc"', '"abc"'))
  assert.ok(etagMatches('"x", "abc"', '"abc"'))
  assert.ok(etagMatches('*', '"abc"'))
  assert.ok(!etagMatches('"abcd"', '"abc"'))
  assert.ok(!etagMatches(null, '"abc"'))
})

test('StreamSlots: 상한·반납 1회', () => {
  const s = new StreamSlots(2)
  const a = s.tryAcquire()
  const b = s.tryAcquire()
  assert.ok(a && b)
  assert.equal(s.tryAcquire(), null)
  a!()
  a!()
  assert.equal(s.inUse, 1, '두 번 반납해도 한 자리')
  assert.ok(s.tryAcquire())
})

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'kaiwa-003f-'))
}

async function body(r: Response): Promise<Buffer> {
  return Buffer.from(await r.arrayBuffer())
}

test('serveFile: 200 전체·206 구간·416·304·If-Range 불일치 전체·HEAD·크기 기록 불일치 404·동시 상한 503', async () => {
  const dir = tmp()
  try {
    const data = randomBytes(700_000)
    const p = join(dir, 'm.bin')
    writeFileSync(p, data)
    const etag = `"${createHash('sha256').update(data).digest('hex')}"`
    const o = { path: p, etag, contentType: 'application/octet-stream', cacheControl: 'public, max-age=31536000, immutable', expectedSize: data.length }
    const get = (h: Record<string, string> = {}, method = 'GET') => new Request('http://x/m', { method, headers: h })

    const full = await serveFile(get(), o)
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(full.headers.get('content-length'), String(data.length))
    assert.equal(full.headers.get('etag'), etag)
    assert.ok((await body(full)).equals(data), '여러 조각(256KB)을 이어 붙인 본문이 원본과 같다')

    const part = await serveFile(get({ Range: 'bytes=300000-' }), o)
    assert.equal(part.status, 206)
    assert.equal(part.headers.get('content-range'), `bytes 300000-${data.length - 1}/${data.length}`)
    assert.ok((await body(part)).equals(data.subarray(300000)), '이어받기 구간')

    const mid = await serveFile(get({ Range: 'bytes=10-19' }), o)
    assert.equal(mid.status, 206)
    assert.ok((await body(mid)).equals(data.subarray(10, 20)))

    const bad = await serveFile(get({ Range: `bytes=${data.length}-` }), o)
    assert.equal(bad.status, 416)
    assert.equal(bad.headers.get('content-range'), `bytes */${data.length}`)

    assert.equal((await serveFile(get({ 'If-None-Match': etag }), o)).status, 304)
    const stale = await serveFile(get({ Range: 'bytes=0-9', 'If-Range': '"other"' }), o)
    assert.equal(stale.status, 200, '파일이 바뀌었으면(If-Range 불일치) 처음부터 전체')
    await stale.body?.cancel()
    const same = await serveFile(get({ Range: 'bytes=0-9', 'If-Range': etag }), o)
    assert.equal(same.status, 206)
    await same.body?.cancel()

    const head = await serveFile(get({}, 'HEAD'), o)
    assert.equal(head.status, 200)
    assert.equal(head.body, null)
    assert.equal(head.headers.get('content-length'), String(data.length))

    assert.equal((await serveFile(get(), { ...o, expectedSize: data.length + 1 })).status, 404, '기록과 크기가 다르면 내보내지 않는다')
    assert.equal((await serveFile(get(), { ...o, path: join(dir, 'none.bin') })).status, 404)
    assert.equal((await serveFile(get(), { ...o, path: dir })).status, 404, '디렉터리는 404')

    const slots = new StreamSlots(1)
    const first = await serveFile(get(), { ...o, slots })
    assert.equal(first.status, 200)
    assert.equal((await serveFile(get(), { ...o, slots })).status, 503, '동시 상한')
    await first.body?.cancel()
    assert.equal(slots.inUse, 0, '끊기면(cancel) 자리를 돌려준다')
    const again = await serveFile(get(), { ...o, slots })
    await body(again)
    assert.equal(slots.inUse, 0, '다 보내면 자리를 돌려준다')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('realpathInside: 루트 밖을 가리키는 링크·없는 파일은 null', async () => {
  const dir = tmp()
  try {
    const root = join(dir, 'root')
    mkdirSync(root)
    writeFileSync(join(root, 'ok.bin'), 'x')
    writeFileSync(join(dir, 'secret.txt'), 's')
    symlinkSync(join(dir, 'secret.txt'), join(root, 'escape.bin'))
    symlinkSync(join(root, 'ok.bin'), join(root, 'alias.bin'))
    assert.ok((await realpathInside(root, join(root, 'ok.bin')))?.endsWith('ok.bin'))
    assert.ok((await realpathInside(root, join(root, 'alias.bin')))?.endsWith('ok.bin'), '안쪽 링크는 허용')
    assert.equal(await realpathInside(root, join(root, 'escape.bin')), null)
    assert.equal(await realpathInside(root, join(root, 'none.bin')), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── AppRelease ─────────────────────────────────────────────────────────

const rel = (versionCode: number, versionName: string, minSupported: number, apkPath = `thekaiwa-${versionName}.apk`): ReleaseRow => ({
  versionCode,
  versionName,
  apkPath,
  sha256: 'a'.repeat(64),
  notes: `v${versionName}`,
  minSupported,
  createdAt: new Date('2026-09-28T00:00:00Z'),
})

test('#8 buildVersionInfo: 행 없음·헤더 없음·뒤처짐·최소 미만·이름만·최신', () => {
  const none = buildVersionInfo([], { code: 5, name: '1.0.0' }, '/app/download/latest.apk')
  assert.equal(none.latest, null)
  assert.equal(none.url, null)
  assert.equal(none.reinstallRequired, false)
  assert.equal(none.updateRequired, false)

  const rows = [rel(3, '1.2.0', 2), rel(2, '1.1.0', 1), rel(1, '1.0.0', 1)]
  const url = 'https://kaiwa.example/app/download/latest.apk'
  const noHeader = buildVersionInfo(rows, { code: null, name: null }, url)
  assert.equal(noHeader.latest, '1.2.0')
  assert.equal(noHeader.latestCode, 3)
  assert.equal(noHeader.minSupported, '1.1.0')
  assert.equal(noHeader.minSupportedCode, 2)
  assert.equal(noHeader.url, url)
  assert.equal(noHeader.reinstallRequired, false, '웹(헤더 없음)은 배너 없음')
  assert.equal(noHeader.updateRequired, false)

  const behind = buildVersionInfo(rows, { code: 2, name: '1.1.0' }, url)
  assert.equal(behind.reinstallRequired, true)
  assert.equal(behind.updateRequired, false)
  const blocked = buildVersionInfo(rows, { code: 1, name: null }, url)
  assert.equal(blocked.updateRequired, true, 'minSupported 미만은 닫을 수 없는 배너')
  const current = buildVersionInfo(rows, { code: 3, name: '1.2.0' }, url)
  assert.equal(current.reinstallRequired, false)
  assert.equal(current.updateAvailable, false)
  const byName = buildVersionInfo(rows, { code: null, name: '1.0.0' }, url)
  assert.equal(byName.updateRequired, false, '비교는 versionCode 정수로만(Leader ③) — 이름만으로는 판단하지 않는다')
  assert.equal(byName.reinstallRequired, false)
  assert.equal(buildVersionInfo(rows, { code: 10, name: '1.9.0' }, url).reinstallRequired, false, '1.10 > 1.9 류 이름 오판 없음 — 코드가 크면 최신')
  assert.equal(buildVersionInfo(rows, { code: 3, name: null }, url, 31_457_280).bytes, 31_457_280)
  assert.equal(noHeader.bytes, null)
})

test('#8 parseClientVersion·compareVersionNames', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  assert.deepEqual(parseClientVersion(h({ 'X-App-Build': '12', 'X-App-Version': '1.2.0' })), { code: 12, name: '1.2.0' })
  assert.deepEqual(parseClientVersion(h({ 'X-App-Build': '0' })), { code: null, name: null })
  assert.deepEqual(parseClientVersion(h({ 'X-App-Build': '1e3', 'X-App-Version': '1.2.0-beta' })), { code: null, name: null })
  assert.deepEqual(parseClientVersion(h({})), { code: null, name: null })
  assert.ok(compareVersionNames('1.2', '1.10') < 0)
  assert.equal(compareVersionNames('1.0', '1.0.0'), 0)
  assert.ok(compareVersionNames('2.0.0', '1.9.9') > 0)
})

test('/app/download: 파일 이름 → 행, apkPath → releases 아래 경로만', () => {
  const rows = [rel(2, '1.1.0', 1), rel(1, '1.0.0', 1)]
  assert.equal(pickReleaseForFile(rows, 'latest.apk')?.versionCode, 2)
  assert.equal(pickReleaseForFile(rows, 'thekaiwa-1.0.0.apk')?.versionCode, 1)
  assert.equal(pickReleaseForFile(rows, 'thekaiwa-9.apk'), null)
  assert.equal(pickReleaseForFile(rows, '../x.apk'), null)
  assert.equal(pickReleaseForFile(rows, 'latest.zip'), null)
  assert.equal(pickReleaseForFile([], 'latest.apk'), null)
  const dir = '/srv/data/releases'
  assert.equal(releaseFilePath('thekaiwa-1.0.0.apk', dir), '/srv/data/releases/thekaiwa-1.0.0.apk')
  assert.equal(releaseFilePath('/srv/data/releases/thekaiwa-1.0.0.apk', dir), '/srv/data/releases/thekaiwa-1.0.0.apk')
  assert.equal(releaseFilePath('/srv/data/other/thekaiwa.apk', dir), null)
  assert.equal(releaseFilePath('/srv/data/releases/../x.apk', dir), null)
  assert.equal(releaseFilePath('sub/thekaiwa.apk', dir), null)
  assert.equal(releaseFilePath('thekaiwa.txt', dir), null)
})

test('/app/download: 기록 sha256 과 같은 파일만(바뀐 파일·밖을 가리키는 링크·없는 파일은 null)', async () => {
  const dir = tmp()
  try {
    const releases = join(dir, 'releases')
    mkdirSync(releases)
    const apk = randomBytes(4096)
    writeFileSync(join(releases, 'thekaiwa-1.0.0.apk'), apk)
    const sha = createHash('sha256').update(apk).digest('hex')
    const row = { ...rel(1, '1.0.0', 1), sha256: sha }
    const ok = await verifyReleaseFile(row, releases)
    assert.equal(ok?.sha256, sha)
    assert.equal(ok?.size, 4096)
    assert.equal(ok?.fileName, 'thekaiwa-1.0.0.apk')
    assert.equal(await verifyReleaseFile({ ...row, sha256: 'b'.repeat(64) }, releases), null, '기록과 다른 해시')
    assert.equal(await verifyReleaseFile({ ...row, apkPath: 'none.apk' }, releases), null)
    writeFileSync(join(dir, 'outside.apk'), apk)
    symlinkSync(join(dir, 'outside.apk'), join(releases, 'link.apk'))
    assert.equal(await verifyReleaseFile({ ...row, apkPath: 'link.apk' }, releases), null, 'releases 밖을 가리키는 링크')
    writeFileSync(join(releases, 'thekaiwa-1.0.0.apk'), Buffer.concat([apk, Buffer.from('x')]))
    assert.equal(await verifyReleaseFile(row, releases), null, '파일이 바뀌면(크기·수정 시각) 다시 해시해 거부')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── PKCE(C1-1) ─────────────────────────────────────────────────────────

function verifier(): string {
  return randomBytes(32).toString('base64url')
}

class MemoryStore implements AppAuthCodeStore {
  rows = new Map<string, { userId: string; expiresAt: Date; usedAt: Date | null }>()
  async create(row: { code: string; userId: string; expiresAt: Date }) {
    this.rows.set(row.code, { userId: row.userId, expiresAt: row.expiresAt, usedAt: null })
  }
  async burn(code: string, now: Date) {
    const r = this.rows.get(code)
    if (!r || r.usedAt !== null || r.expiresAt <= now) return 0
    r.usedAt = now
    return 1
  }
  async userOf(code: string): Promise<AppAuthCodeUser | null> {
    const r = this.rows.get(code)
    return r ? { id: r.userId, email: `${r.userId}@x.test` } : null
  }
}

test('PKCE: S256 = RFC 7636 부록 B 예시, 형식 검사', () => {
  assert.equal(pkceChallengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  assert.ok(isPkceVerifier(verifier()))
  assert.ok(isPkceChallenge(pkceChallengeOf(verifier())))
  assert.ok(!isPkceVerifier('short'))
  assert.ok(!isPkceVerifier('a'.repeat(129)))
  assert.ok(!isPkceVerifier(`${'a'.repeat(42)}!`))
  assert.ok(!isPkceChallenge('a'.repeat(42)))
  assert.ok(!isPkceChallenge(`${'a'.repeat(42)}=`))
})

test('C1-1: DB 에는 code_r 이 아니라 결속 값만, 가로챈 code_r 만으로는 교환 불가', async () => {
  const store = new MemoryStore()
  const v = verifier()
  const codeR = await issueAppAuthCode('u1', pkceChallengeOf(v), store)
  assert.match(codeR, /^[0-9a-f]{64}$/)
  assert.ok(!store.rows.has(codeR), '딥링크 값(code_r)은 DB 키가 아니다')
  assert.ok(store.rows.has(bindAppAuthCode(codeR, pkceChallengeOf(v))))

  assert.equal(await consumeAppAuthCode(codeR, null, store), null, 'verifier 없음')
  assert.equal(await consumeAppAuthCode(codeR, verifier(), store), null, '다른 verifier(가로챈 앱이 만든 것)')
  assert.equal(await consumeAppAuthCode(codeR, pkceChallengeOf(v), store), null, 'challenge 를 verifier 자리에 넣어도 불가')
  const ok = await consumeAppAuthCode(codeR, v, store)
  assert.equal(ok?.id, 'u1', '정상 교환')
  assert.equal(await consumeAppAuthCode(codeR, v, store), null, '재사용 불가(1회용)')
})

test('C1-1: 틀린 시도는 코드를 태우지 않는다(정상 앱은 이어서 교환 가능)·만료·형식', async () => {
  const store = new MemoryStore()
  const v = verifier()
  const codeR = await issueAppAuthCode('u2', pkceChallengeOf(v), store)
  assert.equal(await consumeAppAuthCode(codeR, verifier(), store), null)
  assert.equal((await consumeAppAuthCode(codeR, v, store))?.id, 'u2')

  const late = await issueAppAuthCode('u3', pkceChallengeOf(v), store)
  assert.equal(await consumeAppAuthCode(late, v, store, new Date(Date.now() + 61_000)), null, '60초 만료')

  assert.equal(await consumeAppAuthCode('XYZ', v, store), null)
  assert.equal(await consumeAppAuthCode(codeR.toUpperCase(), v, store), null)
  await assert.rejects(() => issueAppAuthCode('u4', 'not-a-challenge', store), /PKCE/)
})

test('C1-1: challenge 는 서명된 state·pending 으로만 운반된다(앱 필수, 웹 무시)', () => {
  const ch = pkceChallengeOf(verifier())
  const app = createOAuthState('/study/ai', 'app', ch)
  const back = verifyOAuthState(app.state, app.nonce)
  assert.ok(back.ok && back.platform === 'app' && back.challenge === ch)
  assert.throws(() => createOAuthState('/', 'app', null), /PKCE/)
  assert.throws(() => createOAuthState('/', 'app', 'bad'), /PKCE/)
  const web = createOAuthState('/', 'web', ch)
  const wb = verifyOAuthState(web.state, web.nonce)
  assert.ok(wb.ok && wb.challenge === null, '웹 흐름은 challenge 를 싣지 않는다')

  const profile = { providerId: 'g1', email: 'a@b.c', name: 'A', avatar: null, emailVerified: true }
  const p = verifyPendingSignup(signPendingSignup(profile as never, '/', 'app', ch))
  assert.ok(p.ok && p.pending.challenge === ch)
  const pw = verifyPendingSignup(signPendingSignup(profile as never, '/', 'web', ch))
  assert.ok(pw.ok && pw.pending.challenge === null)
  const pn = verifyPendingSignup(signPendingSignup(profile as never, '/', 'app', null))
  assert.ok(pn.ok && pn.pending.challenge === null, 'challenge 없는 앱 pending 은 complete 가 거부한다')
})

test('앱 로그인 시작 링크: platform=app 이면 challenge 를 싣는다', () => {
  const ch = pkceChallengeOf(verifier())
  const href = buildGoogleAuthHref('/study/ai', 'app', ch)
  const u = new URL(href, 'https://x')
  assert.equal(u.searchParams.get('platform'), 'app')
  assert.equal(u.searchParams.get('challenge'), ch)
  assert.equal(new URL(buildGoogleAuthHref(null, 'web', ch), 'https://x').searchParams.get('challenge'), null, '웹은 싣지 않는다')
})
