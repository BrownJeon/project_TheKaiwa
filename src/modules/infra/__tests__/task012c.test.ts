/**
 * task-012c 1단계 게이트(infra) — 연결 주소 허용 목록(D-C3(c)) · 전역 거부 분류·credentialRef 값 해석(D-C3(a)(b), Codex C1 CX-1) · reason 공용 검사(CX-3).
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkOutboundUrl, classifyAddress, vetOutboundUrl, type LookupFn } from '../netPolicy'
import { envOrigin, isDeniedCredentialRef, readCredentialFor, secretFileDeps } from '../secrets'
import { checkReason, isSecretLikeText, normalizeReason, reasonCheckForm, requireReason } from '../reason'
import { ApiError } from '../http'

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

// ── 주소 분류 ────────────────────────────────────────────────────────────

test('classifyAddress — loopback·LAN 만, IPv4-mapped 는 안의 IPv4 로, 나머지(다른 사설망·0.0.0.0·::·compat·NAT64·zone) 거부', () => {
  const yes: [string, string][] = [
    ['127.0.0.1', 'LOOPBACK'],
    ['127.8.9.10', 'LOOPBACK'],
    ['::1', 'LOOPBACK'],
    ['[::1]', 'LOOPBACK'],
    ['0:0:0:0:0:0:0:1', 'LOOPBACK'],
    ['192.168.219.100', 'LAN'],
    ['192.168.219.0', 'LAN'],
    ['::ffff:192.168.219.100', 'LAN'],
    ['[::ffff:c0a8:db64]', 'LAN'],
    ['::ffff:7f00:1', 'LOOPBACK'],
  ]
  for (const [a, c] of yes) assert.equal(classifyAddress(a), c, a)
  for (const a of ['10.0.0.1', '192.168.1.10', '192.168.220.1', '172.16.0.1', '8.8.8.8', '0.0.0.0', '::', '::7f00:1', '::c0a8:db64', '64:ff9b::c0a8:db64', 'fe80::1', 'fe80::1%eth0', '::ffff:10.0.0.1', 'localhost', 'not-an-ip', '']) {
    assert.equal(classifyAddress(a), null, a)
  }
})

test('checkOutboundUrl — 스킴·userinfo·길이·IP 표기(10진·8진·16진·축약)·기본 포트·신뢰 origin', () => {
  const trusted = ['http://192.168.219.100:8000', 'https://svc.example.org']
  const ok = (u: string) => {
    const r = checkOutboundUrl(u, trusted)
    return r.ok ? r : null
  }
  const reason = (u: string) => {
    const r = checkOutboundUrl(u, trusted)
    return r.ok ? 'OK' : r.reason
  }
  assert.equal(ok('http://127.0.0.1:8100')?.hostKind, 'IP')
  assert.equal(ok('http://192.168.219.100:8200')?.trusted, false, 'LAN 이면 신뢰 origin 이 아니어도 주소 자체는 허용')
  assert.equal(ok('http://192.168.219.100:8000/x')?.trusted, true)
  assert.equal(ok('http://3232291684:8000')?.url.hostname, '192.168.219.100', '10진 표기 → 정규화 후 LAN')
  assert.equal(ok('http://0300.0250.0333.0144/')?.url.hostname, '192.168.219.100', '8진 표기')
  assert.equal(ok('http://0xc0a8db64/')?.url.hostname, '192.168.219.100', '16진 표기')
  assert.equal(ok('http://127.1/')?.url.hostname, '127.0.0.1', '축약 표기')
  assert.equal(ok('http://2130706433/')?.hostKind, 'IP')
  assert.equal(ok('http://[::ffff:192.168.219.100]:8000/')?.hostKind, 'IP')
  assert.equal(ok('http://[::1]:3010/')?.hostKind, 'IP')
  assert.equal(ok('https://svc.example.org/v1')?.trusted, true, 'env 에 적힌 https 이름 origin 은 허용')
  assert.equal(ok('https://svc.example.org:443/')?.trusted, true, '기본 포트 표기도 같은 origin')
  assert.equal(ok('http://192.168.219.100:8000/')?.trusted, true)
  assert.equal(ok('http://localhost:8100')?.hostKind, 'NAME', 'http 이름은 해석 단계로')
  assert.equal(reason('ftp://127.0.0.1/'), 'SCHEME_NOT_ALLOWED')
  assert.equal(reason('file:///etc/passwd'), 'SCHEME_NOT_ALLOWED')
  assert.equal(reason('http://user:pw@127.0.0.1:8000'), 'USERINFO')
  assert.equal(reason('http://user@192.168.219.100:8000'), 'USERINFO')
  assert.equal(reason('http://10.0.0.1:8090'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('http://[::ffff:10.0.0.1]:8090'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('http://[::]:8000'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('http://0.0.0.0:8000'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('http://0/'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('https://localhost:8000'), 'HOST_NOT_ALLOWED', 'https 이름은 주소 고정 불가 — env origin 만')
  assert.equal(reason('https://192.168.219.100.nip.io'), 'HOST_NOT_ALLOWED')
  assert.equal(reason('not a url'), 'BAD_URL')
  assert.equal(reason(`http://127.0.0.1/${'a'.repeat(300)}`), 'BAD_URL')
  assert.equal(checkOutboundUrl(42, trusted).ok, false)
})

test('vetOutboundUrl — 이름은 해석한 주소가 전부 허용 대역일 때만, connectUrl 은 검사한 IP 로 고정(DNS 재바인딩)', async () => {
  const table: Record<string, { address: string; family: number }[]> = {
    'lan.host': [{ address: '192.168.219.50', family: 4 }],
    'loop.host': [{ address: '::1', family: 6 }],
    'mixed.host': [
      { address: '192.168.219.50', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ],
    'public.host': [{ address: '93.184.216.34', family: 4 }],
    'rebind.host': [{ address: '::ffff:169.254.169.254', family: 6 }],
  }
  let calls = 0
  const lookup: LookupFn = async (h) => {
    calls++
    const r = table[h]
    if (!r) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
    return r
  }
  const a = await vetOutboundUrl('http://lan.host:8300/health', [], lookup)
  assert.ok(a.ok && a.connectUrl.toString() === 'http://192.168.219.50:8300/health' && a.url.hostname === 'lan.host')
  const b = await vetOutboundUrl('http://loop.host:9/x', [], lookup)
  assert.ok(b.ok && b.connectUrl.hostname === '[::1]')
  for (const h of ['mixed.host', 'public.host', 'rebind.host']) {
    const r = await vetOutboundUrl(`http://${h}/`, [], lookup)
    assert.deepEqual(r, { ok: false, reason: 'HOST_NOT_ALLOWED' }, h)
  }
  assert.deepEqual(await vetOutboundUrl('http://nx.host/', [], lookup), { ok: false, reason: 'DNS_FAILED' })
  const before = calls
  const ip = await vetOutboundUrl('http://127.0.0.1:1/', [], lookup)
  const trustedName = await vetOutboundUrl('http://m4.lan:8000/v1/chat', ['http://m4.lan:8000'], lookup)
  assert.ok(ip.ok && trustedName.ok && trustedName.connectUrl.hostname === 'm4.lan')
  assert.equal(calls, before, 'IP 리터럴·신뢰 origin 은 해석하지 않는다')
  const slow: LookupFn = () => new Promise(() => undefined)
  const t0 = Date.now()
  assert.deepEqual(await vetOutboundUrl('http://slow.host/', [], slow), { ok: false, reason: 'DNS_FAILED' })
  assert.ok(Date.now() - t0 < 3_000, 'DNS 2초 상한')
})

// ── 전역 거부 분류 · 값 해석 ───────────────────────────────────────────────

test('isDeniedCredentialRef — 부팅·내부 시크릿(env:·같은 이름 file:·대소문자) 거부, 어댑터 키는 통과', () => {
  const denied = [
    'env:JWT_SECRET',
    'env:DATABASE_URL',
    'env:GOOGLE_CLIENT_SECRET',
    'env:SIGNUP_INVITE_CODE',
    'env:SPEECH_INTERNAL_SECRET',
    'env:TTS_SERVICE_SECRET',
    'env:ANTHROPIC_API_KEY',
    'env:CLI_OAUTH_TOKEN',
    'env:DB_PASSWORD',
    'env:OWNER_EMAIL',
    'file:jwt-secret',
    'file:speech-internal-secret',
    'file:tts-service-secret',
    'file:database-url',
    'file:google-client-secret',
    'env:jwt_secret',
  ]
  for (const r of denied) assert.equal(isDeniedCredentialRef(r), true, r)
  for (const r of ['env:HOME_M4_API_KEY', 'env:AI_API_KEY', 'file:home-m4-api-key', 'file:tts-service-token', 'x', 'sk-abc']) assert.equal(isDeniedCredentialRef(r), false, r)
})

test('envOrigin — 값 뒤 주석 무시·http(s)·자격증명 없는 URL 만', async () => {
  await withEnv({ T012C_A: 'http://192.168.219.100:8000     # 주석', T012C_B: 'http://u:p@127.0.0.1:1', T012C_C: 'ftp://x', T012C_D: undefined }, () => {
    assert.equal(envOrigin('T012C_A'), 'http://192.168.219.100:8000')
    assert.equal(envOrigin('T012C_B'), null)
    assert.equal(envOrigin('T012C_C'), null)
    assert.equal(envOrigin('T012C_D'), null)
    assert.equal(envOrigin('lower'), null)
  })
})

test('readCredentialFor — 대상 origin 이 env origin 과 정확히 같을 때만 값(다른 origin·같은 host 다른 port·IPv6 표기·userinfo·env 없음·거부 ref·허용 목록 밖)', async () => {
  const KEY = 'k-0123456789abcdef-test'
  // 거부 분류 ref 를 일부러 허용 목록에 넣어도 전역 거부가 이긴다.
  const ALLOW = ['env:T012C_KEY', 'env:T012C_NOT_SET', 'env:JWT_SECRET', 'file:jwt-secret', 'sk-plaintext']
  await withEnv({ T012C_BASE: 'http://192.168.219.100:8000', T012C_KEY: KEY, T012C_OTHER: 'other-key-value', JWT_SECRET: 'must-never-leave' }, () => {
    const t = (u: string) => new URL(u)
    const r = (ref: string | null, u: string, env = 'T012C_BASE', allow: readonly string[] = ALLOW) => readCredentialFor(ref, t(u), env, allow)
    assert.deepEqual(r('env:T012C_KEY', 'http://192.168.219.100:8000/v1/chat'), { ok: true, secret: KEY })
    assert.deepEqual(r('env:T012C_KEY', 'http://192.168.219.100:80/v1/chat'), { ok: false, reason: 'TARGET_NOT_ALLOWED' })
    assert.deepEqual(r('env:T012C_KEY', 'http://192.168.219.100:8200/v1/chat'), { ok: false, reason: 'TARGET_NOT_ALLOWED' }, '같은 host 다른 port')
    assert.deepEqual(r('env:T012C_KEY', 'http://10.0.0.1:8000/v1/chat'), { ok: false, reason: 'TARGET_NOT_ALLOWED' }, '다른 origin')
    assert.deepEqual(r('env:T012C_KEY', 'http://[::ffff:192.168.219.100]:8000/'), { ok: false, reason: 'TARGET_NOT_ALLOWED' }, '같은 주소의 IPv6 표기도 origin 이 다르면 거부')
    assert.deepEqual(r('env:T012C_KEY', 'http://u:p@192.168.219.100:8000/'), { ok: false, reason: 'TARGET_NOT_ALLOWED' })
    assert.deepEqual(r('env:T012C_KEY', 'http://192.168.219.100:8000/', 'T012C_NOPE'), { ok: false, reason: 'TARGET_UNSET' })
    assert.deepEqual(r('env:JWT_SECRET', 'http://192.168.219.100:8000/'), { ok: false, reason: 'REF_NOT_ALLOWED' }, '부팅 시크릿 ref(허용 목록에 있어도)')
    assert.deepEqual(r('file:jwt-secret', 'http://192.168.219.100:8000/'), { ok: false, reason: 'REF_NOT_ALLOWED' })
    assert.deepEqual(r('sk-plaintext', 'http://192.168.219.100:8000/'), { ok: false, reason: 'REF_NOT_ALLOWED' })
    assert.deepEqual(r('env:T012C_OTHER', 'http://192.168.219.100:8000/'), { ok: false, reason: 'REF_NOT_ALLOWED' }, '호출자 허용 목록 밖 ref(REV-035 Low 1)')
    assert.deepEqual(r('env:T012C_NOT_SET', 'http://192.168.219.100:8000/'), { ok: false, reason: 'SECRET_MISSING' })
    assert.deepEqual(r(null, 'http://192.168.219.100:8000/'), { ok: false, reason: 'SECRET_MISSING' })
  })
})

test('readCredentialFor file: — fd 하나로 열기·검사·읽기(O_NOFOLLOW·fstat·/proc 경로), 심볼릭 링크·일반 파일 아님·0644·4KB 초과·바꿔치기 거부(Codex C2 ②)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kaiwa-012c-'))
  const dir = join(root, 'secrets')
  mkdirSync(dir, { mode: 0o700 })
  const outside = join(root, 'outside-secret')
  writeFileSync(outside, 'OUTSIDE-VALUE-must-not-be-read', { mode: 0o600 })
  try {
    writeFileSync(join(dir, 'svc-key'), 'file-secret-value\n', { mode: 0o600 })
    writeFileSync(join(dir, 'wide-key'), 'x', { mode: 0o644 })
    chmodSync(join(dir, 'wide-key'), 0o644)
    symlinkSync(outside, join(dir, 'link-key'))
    mkdirSync(join(dir, 'dir-key'), { mode: 0o700 })
    execFileSync('mkfifo', ['-m', '600', join(dir, 'fifo-key')])
    writeFileSync(join(dir, 'big-key'), 'a'.repeat(5000), { mode: 0o600 })
    writeFileSync(join(dir, 'swap-key'), 'original-value', { mode: 0o600 })
    writeFileSync(join(dir, 'late-key'), 'late-original', { mode: 0o600 })
    const ALLOW = ['file:svc-key', 'file:wide-key', 'file:link-key', 'file:dir-key', 'file:fifo-key', 'file:big-key', 'file:none-key', 'file:swap-key', 'file:late-key']
    await withEnv({ SECRETS_DIR: dir, KAIWA_SECRETS_DIR: undefined, T012C_BASE: 'http://127.0.0.1:9' }, () => {
      const t = new URL('http://127.0.0.1:9/x')
      const r = (ref: string) => readCredentialFor(ref, t, 'T012C_BASE', ALLOW)
      assert.deepEqual(r('file:svc-key'), { ok: true, secret: 'file-secret-value' })
      assert.deepEqual(r('file:wide-key'), { ok: false, reason: 'SECRET_PERMISSION' }, '0644')
      assert.deepEqual(r('file:link-key'), { ok: false, reason: 'SECRET_PERMISSION' }, '심볼릭 링크(O_NOFOLLOW → ELOOP)')
      assert.deepEqual(r('file:dir-key'), { ok: false, reason: 'SECRET_PERMISSION' }, '디렉터리 = 일반 파일 아님')
      const t0 = Date.now()
      assert.deepEqual(r('file:fifo-key'), { ok: false, reason: 'SECRET_PERMISSION' }, 'FIFO = 일반 파일 아님(막히지 않음)')
      assert.ok(Date.now() - t0 < 2_000)
      assert.deepEqual(r('file:big-key'), { ok: false, reason: 'SECRET_PERMISSION' }, '4KB 초과')
      assert.deepEqual(r('file:none-key'), { ok: false, reason: 'SECRET_MISSING' })
      assert.deepEqual(readCredentialFor('file:svc-key', new URL('http://127.0.0.1:10/x'), 'T012C_BASE', ALLOW), { ok: false, reason: 'TARGET_NOT_ALLOWED' }, '대상이 먼저 — 파일을 열지도 않는다')

      const realOpen = secretFileDeps.open
      // 검사 직전 바꿔치기: 열기 바로 전에 경로가 밖을 가리키는 링크가 되면 O_NOFOLLOW 가 막는다.
      mock.method(secretFileDeps, 'open', (path: string, flags: number) => {
        if (path.endsWith('/swap-key')) {
          unlinkSync(path)
          symlinkSync(outside, path)
        }
        return realOpen(path, flags)
      })
      const swapped = r('file:swap-key')
      mock.restoreAll()
      assert.deepEqual(swapped, { ok: false, reason: 'SECRET_PERMISSION' })
      // 연 뒤 바꿔치기: 이미 연 fd 로만 읽으므로 경로가 링크로 바뀌어도 원래 파일 내용을 읽고 링크 대상은 읽지 않는다(경로 재오픈 없음).
      mock.method(secretFileDeps, 'open', (path: string, flags: number) => {
        const fd = realOpen(path, flags)
        if (path.endsWith('/late-key')) {
          renameSync(path, `${path}.moved`)
          symlinkSync(outside, path)
        }
        return fd
      })
      const late = r('file:late-key')
      mock.restoreAll()
      assert.ok(!JSON.stringify(late).includes('OUTSIDE-VALUE'), '링크 대상 내용이 새지 않는다')
      assert.deepEqual(late, { ok: false, reason: 'SECRET_PERMISSION' }, '열린 파일의 실제 경로(/proc)가 더는 SECRETS_DIR/<name> 이 아니면 거부')
      // 디렉터리 성분 바꿔치기 흉내: 열린 fd 의 실제 경로가 SECRETS_DIR 밖이면 거부.
      mock.method(secretFileDeps, 'fdPath', () => outside)
      const elsewhere = r('file:svc-key')
      mock.restoreAll()
      assert.deepEqual(elsewhere, { ok: false, reason: 'SECRET_PERMISSION' })
    })
    // SECRETS_DIR 자체가 링크(운영자 설정)면 realpath 기준으로 그대로 동작한다.
    const linkDir = join(root, 'secrets-link')
    symlinkSync(dir, linkDir)
    await withEnv({ SECRETS_DIR: linkDir, KAIWA_SECRETS_DIR: undefined, T012C_BASE: 'http://127.0.0.1:9' }, () => {
      assert.deepEqual(readCredentialFor('file:svc-key', new URL('http://127.0.0.1:9/'), 'T012C_BASE', ['file:svc-key']), { ok: true, secret: 'file-secret-value' })
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('normalizeReason — 줄바꿈·탭·제어문자 구간 → 공백 하나, 앞뒤 공백 제거', () => {
  assert.equal(normalizeReason('  첫 줄\r\n둘째\t셋째\u0007\u2028끝  '), '첫 줄 둘째 셋째 끝')
  assert.equal(normalizeReason('a\n\n\nb'), 'a b')
})

test('checkReason — 1~200자(PRODUCTION 10~200)·201자·빈 값', () => {
  assert.deepEqual(checkReason('x', { production: false }), { ok: true, reason: 'x' })
  assert.equal((checkReason('짧다', { production: true }) as { problem: string }).problem, 'TOO_SHORT')
  assert.deepEqual(checkReason('운영 반영 전 검증 완료', { production: true }), { ok: true, reason: '운영 반영 전 검증 완료' })
  assert.equal((checkReason('あ'.repeat(201), { production: false }) as { problem: string }).problem, 'TOO_LONG')
  assert.deepEqual(checkReason('😀'.repeat(200), { production: false }), { ok: true, reason: '😀'.repeat(200) }, '코드포인트 기준')
  for (const v of ['', '   ', '\n\t', null, 3]) assert.equal((checkReason(v, { production: false }) as { problem: string }).problem, 'REQUIRED', String(v))
  assert.deepEqual(checkReason('줄1\n줄2', { production: false }), { ok: true, reason: '줄1 줄2' }, '줄바꿈이 공백으로 저장된다')
})

test('isSecretLikeText — 비밀 유사 7종 이상 거부, 평범한 이유는 통과', () => {
  const secretish = [
    'key sk-proj-AbCdEf123456 교체',
    'ghp_ABCDEFGHijklmnop1234 토큰',
    'AKIAIOSFODNN7EXAMPLE 키',
    'Authorization: Bearer abcdef1234567890',
    'basic dXNlcjpwYXNzd29yZA==',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl 로 확인',
    'password=hunter2 로 바꿈',
    'api_key: abcd',
    'SECRET = x',
    'token:qwerty',
    'credential=abc',
    'xoxb-1234567890-abcdefgh',
    'github_pat_11ABCDEFG0123456789',
    '값 Q2xhdWRlLXRlc3Qtc2VjcmV0LTEyMzQ1Njc4OQ 넣음',
    'aB3dE5gH7jK9mN1pQ3sT5vX7z 참고',
  ]
  for (const s of secretish) assert.equal(isSecretLikeText(s), true, s)
  const fine = [
    '주 연결 교체 — 지연이 커서',
    '모델 속도 테스트 후 원복',
    'risk-free 변경, ask-me 태그',
    'http://192.168.219.100:8000 로 주소 정정',
    'token 만료로 교체 예정',
    'cuid clx9abcdefghijklmnopqrs 참조',
    'QA 스모크 추가',
  ]
  for (const s of fine) assert.equal(isSecretLikeText(s), false, s)
})

test('Codex C2 ③ — 서식·기본 무시 문자(soft hyphen·ZWSP·ZWNJ·ZWJ·BOM·word joiner·CGJ)와 전각 문자로 끊은 비밀 유사 문자열도 거부', () => {
  const SHY = '\u00AD'
  const ZWSP = '\u200B'
  const ZWNJ = '\u200C'
  const ZWJ = '\u200D'
  const BOM = '\uFEFF'
  const WJ = '\u2060'
  const CGJ = '\u034F'
  const spread = (s: string, sep: string) => [...s].join(sep)
  const cases: [string, string][] = [
    ['sk- 사이 soft hyphen', `키 s${SHY}k-proj-AbCdEf1234567890 교체`],
    ['sk- 사이 ZWSP', `키 sk${ZWSP}-proj-AbCdEf1234567890`],
    ['Bearer 사이 ZWJ', `Authorization: Bea${ZWJ}rer abcdef1234567890`],
    ['Bearer 사이 BOM', `Bear${BOM}er ${spread('abcdef1234567890', BOM)}`],
    ['JWT 점 앞뒤 ZWNJ', `eyJ${ZWNJ}hbGciOiJIUzI1NiJ9${ZWNJ}.eyJzdWIiOiIxMjM0In0.${ZWSP}c2lnbmF0dXJl`],
    ['password= 사이 ZWSP', `pass${ZWSP}word${ZWSP}=hunter2`],
    ['password= 사이 soft hyphen', `pass${SHY}word=${SHY}hunter2`],
    ['token: 사이 word joiner', `to${WJ}ken:${WJ}qwerty`],
    ['고엔트로피 토큰 글자마다 ZWNJ', spread('aB3dE5gH7jK9mN1pQ3sT5vX7z', ZWNJ)],
    ['AKIA 글자마다 soft hyphen', spread('AKIAIOSFODNN7EXAMPLE', SHY)],
    ['ghp_ 사이 CGJ(Mn·기본 무시)', `gh${CGJ}p_ABCDEFGHijklmnop1234`],
    ['전각 문자(NFKC)', '키 \uff53\uff4b\uff0d\uff50\uff52\uff4f\uff4a\uff0d\uff21\uff42\uff23\uff44\uff25\uff46\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18 교체'],
  ]
  for (const [id, text] of cases) {
    assert.equal(isSecretLikeText(text), true, id)
    const r = checkReason(text, { production: false })
    assert.ok(!r.ok && r.problem === 'SECRET_LIKE', id)
    assert.equal(requireReasonCode(text), 'E_REASON_SECRET_LIKE', id)
  }
})

function requireReasonCode(raw: string): unknown {
  try {
    requireReason(raw, { production: false })
    return 'OK'
  } catch (e) {
    return e instanceof ApiError ? e.details?.reason : 'NOT_API_ERROR'
  }
}

test('Codex C2 ③ — 판정용 형태만 바뀌고 저장값은 그대로, 한국어·일본어 평범한 이유는 통과, 폭 0 문자로 채운 이유는 거부', () => {
  const ZWSP = '\u200B'
  const plain = ['주 연결 교체 — 지연이 커서', '発音辞書の読みを修正（東京）', 'ｶﾀｶﾅ 반각 표기 교정', '運用 반영 전 검증 완료 👍🏻', '한글 자모 ㄱㄴㄷ 확인']
  for (const t of plain) {
    assert.equal(isSecretLikeText(t), false, t)
    assert.deepEqual(checkReason(t, { production: true }), { ok: true, reason: t }, `저장값 불변: ${t}`)
  }
  assert.equal(reasonCheckForm('ｶﾀｶﾅ'), 'カタカナ', 'NFKC 는 판정용 형태에서만')
  assert.equal(reasonCheckForm(`a${ZWSP}b`), 'ab')
  assert.equal((checkReason(ZWSP.repeat(5), { production: false }) as { problem: string }).problem, 'REQUIRED', '보이는 글자 0')
  const padded = checkReason(`수정${ZWSP.repeat(12)}`, { production: true })
  assert.ok(!padded.ok && padded.problem === 'TOO_SHORT' && padded.length === 2, '폭 0 문자로 10자를 채워도 PRODUCTION 최소 길이 미달')
})

test('requireReason — 400 VALIDATION(길이)·422 E_REASON_SECRET_LIKE, 오류 어디에도 원문 없음', () => {
  const secret = 'password=Sup3rS3cret!value'
  const errOf = (raw: unknown, production = false): ApiError => {
    try {
      requireReason(raw, { production })
    } catch (e) {
      if (e instanceof ApiError) return e
    }
    throw new Error('ApiError 가 아님')
  }
  const s = errOf(`변경 ${secret}`)
  assert.equal(s.code, 'UNPROCESSABLE')
  assert.equal(s.details?.reason, 'E_REASON_SECRET_LIKE')
  assert.ok(!JSON.stringify({ m: s.message, u: s.userMessage, d: s.details }).includes('Sup3rS3cret'))
  const long = errOf('가'.repeat(201))
  assert.equal(long.code, 'VALIDATION')
  assert.deepEqual(long.details, { field: 'reason', reason: 'REASON_TOO_LONG', length: 201, min: 1, max: 200 })
  assert.equal(errOf('짧음', true).details?.reason, 'REASON_TOO_SHORT')
  assert.equal(errOf('').details?.reason, 'REASON_REQUIRED')
  assert.equal(requireReason(' 이유\n있음 ', { production: false }), '이유 있음')
})
