/**
 * task-003g 라이브 스모크 — 발음 사전 관리 API(api-contract §7-2)를 실제 서버(127.0.0.1)·실제 DB(LOCAL)·M4 TTS 에 친다.
 * Leader 완료 기준 2~6·8 을 항목별 PASS/FAIL 로 찍는다(1 = tsc·lint·test·격리 build, 7 = 화면은 developer B·QA 몫).
 *
 * 실행(우분투 미러): `bash tests/live/task003g-smoke.sh [포트=3011]` — USER·ADMIN·DEVELOPER·SUPER_ADMIN QA 쿠키 생성·삭제를 감싼다.
 * DB(개발·운영 공유, **APP_ENV=LOCAL 만** — 운영 pm2 도 LOCAL 이라 이 사전이 실사용자 발음이다):
 *   쓰는 것 = QA 계정(qa-bot) USER 범위의 가짜 표기(試験語彙·検証単語·確認用語·並行甲·並行乙)와 그 버전들. GLOBAL(시드 6)은 건드리지 않는다.
 *   끝나면(finally) 항목 표·버전 행·상태를 시작 전 그대로 되돌리고, 이 실행 중 생긴 TtsCache(사전 버전이 기준보다 크거나 가짜 표기 포함) 행·파일과
 *   QA 계정 Trace 를 지운다. **AuditLog 는 불변이라 지우지 않는다**(QA 계정 행으로 남음 — 버전 목록은 버전보다 오래된 감사 행을 무시한다).
 * M4: #23 합성 3회 + 미리듣기 소리 2회 + 읽기 확인 약 12회(분당 10 확인 포함) — 모두 짧은 문장.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { cacheSegments } from '../../src/modules/speech/tts/cache'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const ENV = (process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (ENV !== 'LOCAL') throw new Error('이 스모크는 APP_ENV=LOCAL 에서만 돈다')
const [cUser, cAdmin, cDev, cSuper] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cUser || !cAdmin || !cDev || !cSuper) throw new Error('사용: task003g-smoke.ts <user> <admin> <developer> <super> 쿠키 파일')

const prisma = new PrismaClient()
const startedAt = new Date()
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  headers: Headers
  json: { success?: boolean; data?: Json & { code?: string; details?: Json }; message?: string | null } | null
  text: string
  bytes: Buffer
}
const previewCorpus: string[] = []
async function call(cookie: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const h: Record<string, string> = { ...headers }
  if (cookie) h.Cookie = cookie
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${path}`, { method, headers: h, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) })
  const bytes = Buffer.from(await r.arrayBuffer())
  const text = bytes.toString('utf8')
  let json: Res['json'] = null
  if ((r.headers.get('content-type') ?? '').includes('json')) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (path.includes('/lexicon/preview')) previewCorpus.push(text)
  return { status: r.status, headers: r.headers, json, text, bytes }
}
async function upload(cookie: string, path: string, file: { name: string; content: string }, fields: Record<string, string> = {}): Promise<Res> {
  const fd = new FormData()
  fd.append('file', new Blob([file.content], { type: file.name.endsWith('.json') ? 'application/json' : 'text/csv' }), file.name)
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Cookie: cookie }, redirect: 'manual', body: fd })
  const bytes = Buffer.from(await r.arrayBuffer())
  const text = bytes.toString('utf8')
  let json: Res['json'] = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: r.status, headers: r.headers, json, text, bytes }
}
const d = (r: Res) => (r.json?.data ?? {}) as Json
const code = (r: Res) => r.json?.data?.code
const det = (r: Res) => (r.json?.data?.details ?? {}) as Json
const L = '/api/admin/v1/lexicon'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MARKERS = ['試験語彙', '検証単語', '確認用語', '並行甲', '並行乙']

async function lexAudits(): Promise<number> {
  return prisma.auditLog.count({ where: { environment: 'LOCAL', action: { startsWith: 'lexicon.' }, createdAt: { gte: startedAt } } })
}
async function versionRows() {
  return prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'LOCAL' }, orderBy: { version: 'asc' }, select: { id: true, version: true, status: true, snapshotHash: true } })
}

async function main() {
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  const qaIds = (await prisma.user.findMany({ where: { email: { in: ['qa-bot@thekaiwa.test', 'qa-admin@thekaiwa.test', 'qa-developer@thekaiwa.test', 'qa-super@thekaiwa.test'] } }, select: { id: true } })).map((u) => u.id)
  const baseVersions = await versionRows()
  const baseEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
  const baseMax = Math.max(0, ...baseVersions.map((v) => v.version))
  const baseActive = baseVersions.find((v) => v.status === 'ACTIVE')
  if (!baseActive) throw new Error('LOCAL 에 ACTIVE 사전 버전이 없다 — 시드 확인')
  if (baseEntries.some((e) => MARKERS.includes(e.surface))) throw new Error('이전 실행의 가짜 표기가 남아 있다 — 수동 확인 필요')
  console.log(`기준선: 버전 ${baseVersions.length}개(ACTIVE v${baseActive.version}, 최대 v${baseMax}) · 항목 ${baseEntries.length}개`)
  let expectedAudits = 0
  const user = (surface: string, reading: string, extra: Json = {}) => ({ surface, reading, scope: 'USER', scopeRefId: qa.id, ...extra })

  async function tts23(text: string): Promise<{ status: number; cached: unknown; dictionaryVersion: unknown; matches: number | null }> {
    const r = await call(cUser, 'POST', '/api/v1/speech/tts', { text }, { accept: 'application/json' })
    const traceId = d(r).traceId as string | undefined
    let matches: number | null = null
    for (let i = 0; i < 10 && traceId; i++) {
      const t = await prisma.requestTrace.findFirst({ where: { traceId }, select: { steps: true } })
      if (t) {
        const lex = (t.steps as { name: string; matches?: number }[]).find((s) => s.name === 'TTS_LEXICON')
        matches = typeof lex?.matches === 'number' ? lex.matches : null
        break
      }
      await sleep(200)
    }
    return { status: r.status, cached: d(r).cached, dictionaryVersion: d(r).dictionaryVersion, matches }
  }

  try {
    // ── 2. 권한 ────────────────────────────────────────────────────────
    const anon = await call(null, 'GET', L)
    check('2a 세션 없음 → 401', anon.status === 401 && code(anon) === 'UNAUTHENTICATED', `${anon.status}`)
    const userPaths: [string, string, unknown?][] = [
      ['GET', L],
      ['POST', L, { ...user('試験語彙', 'シケンゴイ'), baseVersion: baseActive.version, reason: 'x' }],
      ['GET', `${L}/versions`],
      ['GET', `${L}/export?format=csv`],
      ['POST', `${L}/preview`, { text: 'テスト' }],
      ['POST', `${L}/import?dryRun=1`, { format: 'csv', content: 'surface,reading\n試験語彙,シケンゴイ\n' }],
      ['POST', `${L}/versions/${baseActive.version}/rollback`, { baseVersion: baseActive.version, reason: 'x' }],
    ]
    const userStatuses = await Promise.all(userPaths.map(([m, p, b]) => call(cUser, m, p, b).then((r) => r.status)))
    check('2b USER → 모든 사전 API 404(콘솔 비노출)', userStatuses.every((s) => s === 404), userStatuses.join(','))
    const roleList = await Promise.all([cAdmin, cDev, cSuper].map((c) => call(c, 'GET', `${L}?pageSize=5`)))
    check('2c ADMIN·DEVELOPER·SUPER_ADMIN 목록 200', roleList.every((r) => r.status === 200 && d(r).environment === 'LOCAL'), roleList.map((r) => r.status).join(','))
    let v = d(roleList[0]).dictionaryVersion as number
    const counts0 = d(roleList[0]).counts as Json
    const active0 = d(roleList[0]).active as Json | null
    check('2d 목록 dictionaryVersion = DB ACTIVE·counts·active(요약 카드)', v === baseActive.version && counts0?.enabled === baseEntries.filter((e) => e.enabled).length && active0?.version === v && d(roleList[0]).pageSize === 5, `v${v} ${JSON.stringify(counts0)}`)

    // ── 검증(G3) ──────────────────────────────────────────────────────
    const bad = async (body: Json) => call(cAdmin, 'POST', L, { baseVersion: v, reason: '검증', ...body })
    const noReason = await call(cAdmin, 'POST', L, { ...user('試験語彙', 'シケンゴイ'), baseVersion: v })
    const noBase = await call(cAdmin, 'POST', L, { ...user('試験語彙', 'シケンゴイ'), reason: 'x' })
    const badKana = await bad(user('試験語彙', 'shikengoi'))
    const noJa = await bad(user('ABC', 'エービーシー'))
    const ghost = await bad({ surface: '試験語彙', reading: 'シケンゴイ', scope: 'USER', scopeRefId: 'ghost_user_x' })
    const globalRef = await bad({ surface: '試験語彙', reading: 'シケンゴイ', scope: 'GLOBAL', scopeRefId: qa.id })
    const accent = await bad(user('試験語彙', 'シケンゴイ', { accentType: 9 }))
    const hira = await bad(user('試験語彙', 'しけんごい'))
    const errCode = (r: Res) => ((det(r).errors as { code: string }[] | undefined)?.[0]?.code ?? det(r).field) as string
    const field422 = [noReason, badKana, hira, noJa, ghost, globalRef, accent]
    check('3v0 baseVersion 없음 → 400 VALIDATION(field baseVersion)', noBase.status === 400 && code(noBase) === 'VALIDATION' && det(noBase).field === 'baseVersion', `${noBase.status}`)
    check(
      '3v 칸 오류 → 422 UNPROCESSABLE E_LEXICON_ENTRY_INVALID: 이유·로마자 읽기·히라가나 읽기·일본어 없음·대상 없음·GLOBAL+ref·악센트 범위',
      field422.every((r) => r.status === 422 && code(r) === 'UNPROCESSABLE' && det(r).reason === 'E_LEXICON_ENTRY_INVALID') &&
        field422.map(errCode).join(',') === 'E_REASON,E_READING,E_READING,E_SURFACE_NOT_JA,E_SCOPE_REF_NOT_FOUND,E_SCOPE_REF,E_ACCENT' &&
        (det(badKana).fields as Json)?.reading === 'E_READING',
      field422.map((r) => `${r.status}:${errCode(r)}`).join(','),
    )
    check('3v2 검증 실패는 버전·감사 0', (await versionRows()).length === baseVersions.length && (await lexAudits()) === 0)

    // ── 4-전. #23 기준(사전 적용 전) ────────────────────────────────────
    const SENT = '試験語彙を確認します。'
    const t0 = await tts23(SENT)
    check('4a #23 기준: 사전 버전 = 기준 ACTIVE, 매칭 0', t0.status === 200 && t0.dictionaryVersion === v && t0.matches === 0, JSON.stringify(t0))

    // ── 3. 추가·수정·비활성·되살림 ─────────────────────────────────────
    const c1 = await call(cAdmin, 'POST', L, { ...user('試験語彙', 'ｼｹﾝｺﾞｲ', { accentType: 0, wordType: 'COMMON', note: 'QA 스모크' }), baseVersion: v, reason: 'QA 스모크 추가' })
    expectedAudits++
    const e1 = d(c1).entry as Json | undefined
    const vr1 = await versionRows()
    check(
      '3a 추가 → 새 ACTIVE 1·직전 SUPERSEDED·반각 읽기 전각 저장·version{version, createdAt}',
      c1.status === 200 && d(c1).changed === true && (d(c1).version as Json)?.version === baseMax + 1 && typeof (d(c1).version as Json)?.createdAt === 'string' && d(c1).previousVersion === v && e1?.reading === 'シケンゴイ' && vr1.filter((x) => x.status === 'ACTIVE').length === 1 && vr1.find((x) => x.id === baseActive.id)?.status === 'SUPERSEDED',
      `${c1.status} ${JSON.stringify(d(c1).version)}`,
    )
    const vOf = (r: Res) => (d(r).version as Json)?.version as number
    v = vOf(c1)
    const id1 = e1?.id as string
    const a1 = await prisma.auditLog.findFirst({ where: { environment: 'LOCAL', targetId: `lexicon:v${v}` }, orderBy: { createdAt: 'desc' } })
    check('3b 감사 1행(action lexicon.create·targetId lexicon:v<n>·이유·작업자)', a1?.action === 'lexicon.create' && a1.reason === 'QA 스모크 추가' && a1.actorEmailSnap === 'qa-admin@thekaiwa.test' && a1.scope === null, a1?.action ?? 'none')

    const t1 = await tts23(SENT)
    check('4b 추가 후 #23: 캐시 미적중·새 사전 버전·매칭 1(읽기 반영)', t1.status === 200 && t1.cached === false && t1.dictionaryVersion === v && t1.matches === 1, JSON.stringify(t1))

    const dup = await call(cAdmin, 'POST', L, { ...user('試験語彙', 'シケンゴ'), baseVersion: v, reason: '중복' })
    check('3c 같은 키 활성 중복 → 409 E_LEXICON_DUPLICATE + existing(항목 DTO)', dup.status === 409 && code(dup) === 'CONFLICT' && det(dup).reason === 'E_LEXICON_DUPLICATE' && (det(dup).existing as Json)?.id === id1 && det(dup).existingId === id1, `${dup.status} ${det(dup).reason}`)
    const stale = await call(cAdmin, 'PUT', `${L}/${id1}`, { reading: 'シケンゴイイ', baseVersion: v - 1, reason: '옛 기준' })
    check('3d baseVersion 불일치 → 409 VERSION_CONFLICT(baseVersion·currentVersion)', stale.status === 409 && det(stale).reason === 'VERSION_CONFLICT' && det(stale).currentVersion === v && det(stale).baseVersion === v - 1, `${stale.status}`)
    const imm = await call(cAdmin, 'PUT', `${L}/${id1}`, { surface: '試験', baseVersion: v, reason: '키 변경' })
    check('3d2 수정에서 표기·범위 변경 → 422 E_IMMUTABLE', imm.status === 422 && (det(imm).fields as Json)?.surface === 'E_IMMUTABLE', `${imm.status}`)

    const u1 = await call(cAdmin, 'PUT', `${L}/${id1}`, { reading: 'シケンゴイ', priority: 300, baseVersion: v, reason: 'QA 수정' })
    expectedAudits++
    check('3e 수정 → 새 버전·priority 300(0~1000) 반영', u1.status === 200 && d(u1).changed === true && vOf(u1) === v + 1 && (d(u1).entry as Json)?.priority === 300, `${u1.status} v${vOf(u1)}`)
    v = vOf(u1)
    const n1 = await call(cAdmin, 'PUT', `${L}/${id1}`, { priority: 300, baseVersion: v, reason: '같은 값' })
    check('3f 같은 값 수정 → changed:false·버전·감사 없음', n1.status === 200 && d(n1).changed === false && vOf(n1) === v && d(n1).previousVersion === null && (await lexAudits()) === expectedAudits, `${n1.status}`)
    const del = await call(cAdmin, 'DELETE', `${L}/${id1}`, { baseVersion: v, reason: 'QA 비활성' })
    expectedAudits++
    const row1 = await prisma.pronunciationLexiconEntry.findUnique({ where: { id: id1 } })
    check('3g 비활성(DELETE + 본문 이유) → 새 버전·enabled=false·물리 삭제 0', del.status === 200 && vOf(del) === v + 1 && row1?.enabled === false, `${del.status}`)
    v = vOf(del)
    const delNoReason = await call(cAdmin, 'DELETE', `${L}/${id1}`, { baseVersion: v })
    check('3g2 비활성 이유 없음 → 422 E_REASON', delNoReason.status === 422 && (det(delNoReason).fields as Json)?.reason === 'E_REASON')
    const del2 = await call(cAdmin, 'DELETE', `${L}/${id1}`, { baseVersion: v, reason: '또' })
    check('3h 이미 비활성 → changed:false', del2.status === 200 && d(del2).changed === false && vOf(del2) === v)
    const rv = await call(cDev, 'POST', L, { ...user('試験語彙', 'シケンゴイ'), baseVersion: v, reason: 'QA 되살림' })
    expectedAudits++
    check('3i 꺼진 같은 키 추가 → 되살림(revived·같은 id)·DEVELOPER 쓰기 가능', rv.status === 200 && d(rv).revived === true && (d(rv).entry as Json)?.id === id1 && (d(rv).entry as Json)?.enabled === true, `${rv.status}`)
    v = vOf(rv)
    const search = await call(cAdmin, 'GET', `${L}?q=${encodeURIComponent('しけん')}&scope=USER&enabled=1`)
    check('3j 검색(히라가나 → 읽기 가타카나 일치)·범위·활성 필터', search.status === 200 && (d(search).items as Json[]).some((i) => i.id === id1), `${d(search).total}건`)
    const one = await call(cAdmin, 'GET', `${L}/${id1}`)
    const none = await call(cAdmin, 'GET', `${L}/nonexistent_id_000`)
    check('3k 단건 200·없는 id 404', one.status === 200 && none.status === 404)

    // 동시 쓰기 2건(같은 baseVersion) → 하나만 성공, 나머지 409, ACTIVE 1
    const [p1, p2] = await Promise.all([
      call(cAdmin, 'POST', L, { ...user('並行甲', 'ヘイコウコウ'), baseVersion: v, reason: 'QA 동시 1' }),
      call(cSuper, 'POST', L, { ...user('並行乙', 'ヘイコウオツ'), baseVersion: v, reason: 'QA 동시 2' }),
    ])
    expectedAudits++
    const vrc = await versionRows()
    check(
      '3l 동시 쓰기(같은 기준) → 200 1건 + 409 1건·ACTIVE 1·번호 중복 0(잠금)',
      [p1.status, p2.status].sort().join(',') === '200,409' && vrc.filter((x) => x.status === 'ACTIVE').length === 1 && new Set(vrc.map((x) => x.version)).size === vrc.length,
      `${p1.status},${p2.status}`,
    )
    v = p1.status === 200 ? vOf(p1) : vOf(p2)

    // ── 5. 미리듣기 ─────────────────────────────────────────────────────
    const PTEXT = '検証単語と試験語彙を読みます。'
    const DRAFT = [user('検証単語', 'ヨミカエタ', { accentType: 0 })] // 長音 없는 읽기 — 엔진 읽기 확인은 ー 를 모음으로 적는다(ワード → ワアド)
    const before = { versions: (await versionRows()).length, entries: await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL' } }), audits: await lexAudits() }
    const pv = await call(cAdmin, 'POST', `${L}/preview`, { text: PTEXT, draftEntries: DRAFT, compare: true })
    let previews = 1
    const pd = d(pv)
    const pb = pd.before as Json
    const pa = pd.after as Json
    const aMatches = (pa?.matches as Json[]) ?? []
    check(
      '5a 읽기 확인(compare) 200: before=지금 사전·after=초안 적용(읽기·악센트·matches DRAFT), 소리 URL 없음',
      pv.status === 200 && pd.dictionaryVersion === v && typeof pb?.reading === 'string' && typeof pa?.accent === 'string' && String(pa?.reading).includes('ヨミカエタ') && !String(pb?.reading).includes('ヨミカエタ') && aMatches.some((m) => m.source === 'DRAFT' && m.surface === '検証単語') && pb?.audioUrl === null,
      `전 ${pb?.reading} / 후 ${pa?.reading} / ${aMatches.map((m) => `${m.surface}:${m.source}`).join(',')}`,
    )
    const single = await call(cAdmin, 'POST', `${L}/preview`, { text: PTEXT })
    previews++
    check('5a2 compare 없음 → before 만(after null)', single.status === 200 && d(single).after === null && typeof (d(single).before as Json)?.reading === 'string')
    const wav = async (side: string) => call(cAdmin, 'POST', `${L}/preview`, { text: PTEXT, draftEntries: DRAFT, side }, { accept: 'audio/wav' })
    const [wa, wb] = [await wav('after'), await wav('before')]
    const noSide = await call(cAdmin, 'POST', `${L}/preview`, { text: PTEXT }, { accept: 'audio/wav' })
    check(
      '5b 소리: Accept audio/wav + side → WAV(after·before 각각)·side 없음 400',
      wa.status === 200 && (wa.headers.get('content-type') ?? '').includes('audio/wav') && wa.bytes.toString('ascii', 0, 4) === 'RIFF' && wb.status === 200 && wb.bytes.length > 1000 && noSide.status === 400,
      `${wa.status} ${wa.bytes.length}B / ${wb.status} ${wb.bytes.length}B / ${noSide.status}`,
    )
    const after = { versions: (await versionRows()).length, entries: await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL' } }), audits: await lexAudits() }
    const cacheLeak = await prisma.ttsCache.count({ where: { createdAt: { gte: startedAt }, normalizedText: { contains: '検証単語と' } } })
    check('5c 미리듣기 저장 0: 버전·항목·감사·TtsCache 변화 0', JSON.stringify(before) === JSON.stringify(after) && cacheLeak === 0, `${JSON.stringify(after)} cache+${cacheLeak}`)
    let pvTrace: { kind: string; refType: string | null; steps: unknown } | null = null
    for (let i = 0; i < 10 && !pvTrace; i++) {
      pvTrace = await prisma.requestTrace.findFirst({ where: { traceId: String(pd.traceId) }, select: { kind: true, refType: true, steps: true } })
      if (!pvTrace) await sleep(300)
    }
    check('5d Trace PLAYGROUND(lexiconPreview)·본문 없음', pvTrace?.kind === 'PLAYGROUND' && pvTrace.refType === 'lexiconPreview' && !JSON.stringify(pvTrace.steps).includes('検証'), pvTrace?.kind ?? 'none')
    const pvBad = await Promise.all([
      call(cAdmin, 'POST', `${L}/preview`, { text: 'あ'.repeat(201) }),
      call(cAdmin, 'POST', `${L}/preview`, { text: 'テスト', draftEntries: Array.from({ length: 21 }, () => user('試験語彙', 'シケンゴイ')) }),
      call(cAdmin, 'POST', `${L}/preview`, { text: 'テスト', draftEntries: [{ surface: '試験語彙', reading: 'abc' }] }),
      call(cAdmin, 'POST', `${L}/preview`, { text: '' }),
    ])
    check('5e 미리듣기 검증: 200자 초과 400·초안 21개 400·초안 칸 오류 422·빈 예문 400', pvBad.map((r) => r.status).join(',') === '400,400,422,400', pvBad.map((r) => r.status).join(','))
    const leaks = previewCorpus.join('\n').match(/style-?bert|sbv2|jvnv|:8200|192\.168\.|connectionKey|tts-cache\/|DATA_ROOT/gi)
    check('5f 미리듣기 응답에 엔진명·호스트·연결 키·경로 0', !leaks, leaks ? [...new Set(leaks)].join(',') : `${previewCorpus.length}개 응답`)

    // ── 6. Import(multipart) ────────────────────────────────────────────
    const header = 'surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled'
    const good1 = `検証単語,ケンショウタンゴ,0,20,USER,${qa.id},COMMON,=1+1,true`
    const good2 = `確認用語,カクニンヨウゴ,,,USER,${qa.id},,,true`
    const csvMixed = [header, good1, good2, `ABC,エービーシー,0,10,USER,${qa.id},,,true`, `検証単語,ケンショー,0,10,USER,${qa.id},,,true`, `幽霊語,ユウレイゴ,0,10,USER,ghost_user_x,,,true`].join('\n')
    const snapBefore = { versions: (await versionRows()).length, audits: await lexAudits() }
    const dry = await upload(cAdmin, `${L}/import?mode=MERGE&dryRun=1`, { name: 'qa.csv', content: csvMixed })
    const errs = ((d(dry).errors as Json[]) ?? []).map((e) => `${e.row}:${e.field}:${e.code}`)
    check(
      '6a dryRun: 추가 2·오류 3(행·칸·코드)·changes·baseVersion·DB 변화 0',
      dry.status === 200 && d(dry).dryRun === true && d(dry).applied === false && d(dry).version === null && d(dry).rows === 5 && d(dry).baseVersion === v &&
        JSON.stringify(d(dry).counts) === JSON.stringify({ add: 2, update: 0, disable: 0, unchanged: 0, error: 3 }) &&
        errs.join(',') === '3:surface:E_SURFACE_NOT_JA,4:null:E_DUPLICATE_IN_FILE,5:scopeRefId:E_SCOPE_REF_NOT_FOUND' &&
        ((d(dry).changes as Json[]) ?? []).map((c) => `${c.kind}:${c.row}`).join(',') === 'ADDED:1,ADDED:2',
      `${dry.status} ${JSON.stringify(d(dry).counts)} ${errs.join(',')}`,
    )
    const applyBad = await upload(cAdmin, `${L}/import?mode=MERGE`, { name: 'qa.csv', content: csvMixed }, { baseVersion: String(v), reason: 'QA 오류 포함' })
    check('6b 오류 행 있는 적용 → 422 E_IMPORT_HAS_ERRORS(전부 아니면 전무)', applyBad.status === 422 && det(applyBad).reason === 'E_IMPORT_HAS_ERRORS' && ((det(applyBad).errors as Json[]) ?? []).length === 3, `${applyBad.status} ${det(applyBad).reason}`)
    check('6b2 dryRun·거부 뒤 버전·감사 그대로', JSON.stringify(snapBefore) === JSON.stringify({ versions: (await versionRows()).length, audits: await lexAudits() }))
    const applyOk = await upload(cAdmin, `${L}/import?mode=MERGE`, { name: 'qa.csv', content: [header, good1, good2].join('\n') }, { baseVersion: String(v), reason: 'QA 가져오기' })
    expectedAudits++
    check('6c MERGE 적용 → 추가 2·새 버전 1', applyOk.status === 200 && d(applyOk).applied === true && vOf(applyOk) === v + 1 && JSON.stringify(d(applyOk).counts) === JSON.stringify({ add: 2, update: 0, disable: 0, unchanged: 0, error: 0 }), `${applyOk.status} ${JSON.stringify(d(applyOk).counts)}`)
    v = vOf(applyOk)
    // REV-017: 머리글보다 짧은 행의 뒤쪽 칸 = 값 없음 → 기존 값(priority 20·COMMON·메모) 유지 = 변경 0
    const shortRow = await upload(cAdmin, `${L}/import?mode=MERGE&dryRun=1`, { name: 'short.csv', content: `surface,reading,scope,scopeRefId,priority,wordType,note,enabled\n検証単語,ケンショウタンゴ,USER,${qa.id}\n` })
    check('6c2 짧은 행(뒤쪽 칸 없음) → 기존 값 유지(UNCHANGED, 변경 0)', shortRow.status === 200 && JSON.stringify(d(shortRow).counts) === JSON.stringify({ add: 0, update: 0, disable: 0, unchanged: 1, error: 0 }), `${shortRow.status} ${JSON.stringify(d(shortRow).counts)}`)
    const scopeEnabled = await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL', scope: 'USER', scopeRefId: qa.id, enabled: true } })
    const repl = await upload(cAdmin, `${L}/import?mode=REPLACE_SCOPE`, { name: 'qa.csv', content: [header, good1].join('\n') }, { baseVersion: String(v), reason: 'QA 범위 교체' })
    expectedAudits++
    const replScopes = (d(repl).scopes as Json[]) ?? []
    check(
      '6d REPLACE_SCOPE → 파일에 나온 범위의 빠진 활성 항목만 끄기(scopes 끄기 수)',
      repl.status === 200 && (d(repl).counts as Json)?.disable === scopeEnabled - 1 && (d(repl).counts as Json)?.unchanged === 1 && vOf(repl) === v + 1 && replScopes.length === 1 && replScopes[0].disable === scopeEnabled - 1,
      `${JSON.stringify(d(repl).counts)} scopes=${JSON.stringify(replScopes)} (범위 활성 ${scopeEnabled})`,
    )
    v = vOf(repl)
    const tooMany = await upload(cAdmin, `${L}/import?dryRun=1`, { name: 'big.csv', content: `surface,reading\n${'試験語彙,シケンゴイ\n'.repeat(2001)}` })
    const tooBig = await upload(cAdmin, `${L}/import?dryRun=1`, { name: 'huge.csv', content: `surface,reading\n${'あ'.repeat(90_000)}` })
    const badExt = await upload(cAdmin, `${L}/import?dryRun=1`, { name: 'qa.txt', content: 'surface,reading\n' })
    const badHeader = await upload(cAdmin, `${L}/import?dryRun=1`, { name: 'qa.csv', content: 'surface,accentType\n試験語彙,0\n' })
    const badJson = await upload(cAdmin, `${L}/import?dryRun=1`, { name: 'qa.json', content: '{"entries":' })
    const badMode = await upload(cAdmin, `${L}/import?mode=REPLACE&dryRun=1`, { name: 'qa.csv', content: 'surface,reading\n' })
    check(
      '6e 422: 2,001행 E_IMPORT_TOO_MANY_ROWS·256KB 초과 E_IMPORT_TOO_LARGE·확장자 E_IMPORT_FORMAT·머리글 E_IMPORT_HEADER·JSON 깨짐 E_IMPORT_FORMAT / 잘못된 mode 400',
      [tooMany, tooBig, badExt, badHeader, badJson].map((r) => `${r.status}:${det(r).reason}`).join(',') === '422:E_IMPORT_TOO_MANY_ROWS,422:E_IMPORT_TOO_LARGE,422:E_IMPORT_FORMAT,422:E_IMPORT_HEADER,422:E_IMPORT_FORMAT' && badMode.status === 400 && det(tooMany).rows === 2001,
      [tooMany, tooBig, badExt, badHeader, badJson, badMode].map((r) => `${r.status}:${det(r).reason ?? det(r).field}`).join(','),
    )

    // ── 6. Export 왕복 ──────────────────────────────────────────────────
    const exCsv = await call(cDev, 'GET', `${L}/export?format=csv`)
    const exJson = await call(cDev, 'GET', `${L}/export?format=json`)
    check(
      '6f Export CSV: BOM·머리글·첨부 파일명·메타 헤더·인젝션 이스케이프(\'=1+1)',
      exCsv.status === 200 && exCsv.text.startsWith(`\uFEFF${header}\r\n`) && /attachment; filename="lexicon-local-v\d+-\d{8}\.csv"/.test(exCsv.headers.get('content-disposition') ?? '') && exCsv.headers.get('x-lexicon-dictionary-version') === String(v) && exCsv.headers.get('x-lexicon-consistent') === '1' && exCsv.text.includes(",'=1+1,"),
      `${exCsv.status} ${exCsv.headers.get('content-disposition')}`,
    )
    const exJ = JSON.parse(exJson.text) as { dictionaryVersion: number; environment: string; exportedAt: string; entries: unknown[] }
    check('6g Export JSON: {dictionaryVersion, environment, exportedAt, entries}', exJson.status === 200 && exJ.dictionaryVersion === v && exJ.environment === 'LOCAL' && Array.isArray(exJ.entries) && exJ.entries.length === (await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL' } })))
    const rt = [
      await upload(cAdmin, `${L}/import?mode=MERGE&dryRun=1`, { name: 'rt.csv', content: exCsv.text }),
      await upload(cAdmin, `${L}/import?mode=REPLACE_SCOPE&dryRun=1`, { name: 'rt.csv', content: exCsv.text }),
      await upload(cAdmin, `${L}/import?mode=REPLACE_SCOPE&dryRun=1`, { name: 'rt.json', content: exJson.text }),
    ]
    const zero = (r: Res) => {
      const c = d(r).counts as Json
      return r.status === 200 && c?.add === 0 && c?.update === 0 && c?.disable === 0 && c?.error === 0 && c?.unchanged === exJ.entries.length
    }
    check('6h 왕복 불변: Export(CSV·JSON) → Import dryRun(MERGE·REPLACE_SCOPE) 변경 0', rt.every(zero), rt.map((r) => `${r.status} ${JSON.stringify(d(r).counts ?? det(r))}`).join(' | '))
    const rtApply = await upload(cAdmin, `${L}/import?mode=MERGE`, { name: 'rt.csv', content: exCsv.text }, { baseVersion: String(v), reason: 'QA 왕복' })
    check('6i 왕복 적용 → applied:false·버전·감사 그대로', rtApply.status === 200 && d(rtApply).applied === false && vOf(rtApply) === v && (await lexAudits()) === expectedAudits, `${rtApply.status} applied=${d(rtApply).applied}`)

    // ── 3·4. 버전 목록·상세·Rollback ─────────────────────────────────────
    const vl = await call(cAdmin, 'GET', `${L}/versions?pageSize=50`)
    const items = (d(vl).items as Json[]) ?? []
    const mine = items.filter((i) => (i.version as number) > baseMax)
    const seedRow = items.find((i) => i.version === baseActive.version)
    check(
      '3m 버전 목록(쪽): 이번 버전 전부 작업자{name, role}·이유·action·항목/켜진 수·해시, 시드는 actor null',
      vl.status === 200 && d(vl).total === baseVersions.length + expectedAudits && mine.length === expectedAudits &&
        mine.every((i) => typeof (i.actor as Json)?.name === 'string' && (i.actor as Json)?.role && typeof i.reason === 'string' && String(i.action).startsWith('lexicon.') && typeof i.entryCount === 'number' && typeof i.enabledCount === 'number' && typeof i.snapshotHash === 'string') &&
        d(vl).activeVersion === v && (seedRow ? seedRow.actor === null || baseActive.version > 1 : true),
      `${mine.length}개 / 기대 ${expectedAudits} · total ${d(vl).total}`,
    )
    const vd = await call(cAdmin, 'GET', `${L}/versions/${baseMax + 1}?compare=previous`)
    const vdRows = (d(vd).rows as Json[]) ?? []
    check('3n 버전 상세 compare=previous: against=직전·rows(ADDED 試験語彙)·counts·truncated', vd.status === 200 && d(vd).compare === 'previous' && d(vd).against === baseActive.version && vdRows.some((r) => r.kind === 'ADDED' && r.surface === '試験語彙') && (d(vd).counts as Json)?.added === 1 && d(vd).truncated === 0, `${vd.status} ${JSON.stringify(d(vd).counts)}`)
    const va = await call(cAdmin, 'GET', `${L}/versions/${baseActive.version}?compare=active`)
    const vaRows = (d(va).rows as Json[]) ?? []
    check('3n2 compare=active(되돌리기 확인): 지금 → 기준 버전으로 가면 QA 항목만 DISABLED', va.status === 200 && d(va).against === v && vaRows.length > 0 && vaRows.every((r) => r.kind === 'DISABLED' && MARKERS.includes(String(r.surface))), vaRows.map((r) => `${r.kind}:${r.surface}`).join(','))

    const rbStale = await call(cAdmin, 'POST', `${L}/versions/${baseActive.version}/rollback`, { baseVersion: v - 1, reason: '옛 기준' })
    const rbNone = await call(cAdmin, 'POST', `${L}/versions/99999/rollback`, { baseVersion: v, reason: '없는 버전' })
    const rbSelf = await call(cAdmin, 'POST', `${L}/versions/${v}/rollback`, { baseVersion: v, reason: '지금 버전' })
    check('3o Rollback 오류: 옛 기준 409 VERSION_CONFLICT·없는 버전 404·지금 ACTIVE 409 ALREADY_ACTIVE', rbStale.status === 409 && det(rbStale).reason === 'VERSION_CONFLICT' && rbNone.status === 404 && rbSelf.status === 409 && det(rbSelf).reason === 'ALREADY_ACTIVE', `${rbStale.status},${rbNone.status},${rbSelf.status}`)
    const replaced = v
    const rb = await call(cAdmin, 'POST', `${L}/versions/${baseActive.version}/rollback`, { baseVersion: v, reason: 'QA 되돌림' })
    expectedAudits++
    const vrb = await versionRows()
    const newActive = vrb.find((x) => x.status === 'ACTIVE')
    check(
      '3p Rollback → 새 ACTIVE(스냅샷 해시 = 대상)·대체된 버전 ROLLED_BACK·대상 상태 불변',
      rb.status === 200 && vOf(rb) === v + 1 && d(rb).restoredFrom === baseActive.version && (d(rb).replaced as Json)?.version === replaced && (d(rb).replaced as Json)?.status === 'ROLLED_BACK' && newActive?.version === v + 1 && newActive.snapshotHash === baseActive.snapshotHash && vrb.find((x) => x.version === replaced)?.status === 'ROLLED_BACK' && vrb.find((x) => x.id === baseActive.id)?.status === 'SUPERSEDED',
      `${rb.status} ${JSON.stringify(d(rb).counts)}`,
    )
    v = vOf(rb)
    const rbSame = await call(cAdmin, 'POST', `${L}/versions/${baseActive.version}/rollback`, { baseVersion: v, reason: '같은 내용' })
    check('3p2 내용이 같은 버전으로 되돌리기 → 409 NO_CHANGE(버전 안 만듦)', rbSame.status === 409 && det(rbSame).reason === 'NO_CHANGE' && (await versionRows()).length === vrb.length, `${rbSame.status} ${det(rbSame).reason}`)
    const qaActive = await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL', scope: 'USER', scopeRefId: qa.id, enabled: true } })
    const qaRows = await prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL', surface: { in: MARKERS } } })
    check('3q Rollback 뒤 QA 항목은 비활성으로만 남음(물리 삭제 0)', qaActive === 0 && qaRows >= 4, `활성 ${qaActive}·행 ${qaRows}`)
    const t2 = await tts23(SENT)
    check('4c Rollback 뒤 #23: 캐시 미적중(새 버전)·매칭 0(원래 읽기)', t2.status === 200 && t2.cached === false && t2.dictionaryVersion === v && t2.matches === 0, JSON.stringify(t2))
    const vl2 = await call(cAdmin, 'GET', `${L}/versions?pageSize=5`)
    const top = ((d(vl2).items as Json[]) ?? [])[0]
    check('3r 버전 목록 맨 위 = Rollback(changeSummary "v{n} 로 되돌림: 이유"·restoredFrom·action)', top?.version === v && top.restoredFrom === baseActive.version && top.action === 'lexicon.rollback' && top.changeSummary === `v${baseActive.version} 로 되돌림: QA 되돌림`, String(top?.changeSummary))

    // ── 3·감사 대조 ─────────────────────────────────────────────────────
    const auditRows = await prisma.auditLog.findMany({ where: { environment: 'LOCAL', action: { startsWith: 'lexicon.' }, createdAt: { gte: startedAt } }, select: { targetId: true, actorUserId: true } })
    const versionsMade = (await versionRows()).filter((x) => x.version > baseMax).length
    check('3s 감사 행 수 = 변경 요청 수 = 새 버전 수(1:1)', auditRows.length === expectedAudits && versionsMade === expectedAudits && new Set(auditRows.map((a) => a.targetId)).size === auditRows.length && auditRows.every((a) => qaIds.includes(a.actorUserId ?? '')), `감사 ${auditRows.length}·버전 ${versionsMade}·기대 ${expectedAudits}`)

    // ── 5. 분당 10회(마지막 — 다른 미리듣기를 막지 않게) ──────────────────
    let limited: Res | null = null
    for (; previews < 11; previews++) {
      const r = await call(cAdmin, 'POST', `${L}/preview`, { text: 'テスト。' })
      if (r.status === 429) {
        limited = r
        break
      }
    }
    check('5g 읽기 확인 관리자당 분당 10 → 11번째 429(Retry-After)', limited?.status === 429 && previews === 10 && !!limited.headers.get('retry-after'), `${previews}회째 ${limited?.status}`)
  } finally {
    // ── 8. 원복 ─────────────────────────────────────────────────────────
    const baseIds = new Set(baseEntries.map((e) => e.id))
    const nowEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
    const extra = nowEntries.filter((e) => !baseIds.has(e.id))
    const delEntries = await prisma.pronunciationLexiconEntry.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } })
    let restored = 0
    for (const b of baseEntries) {
      const cur = nowEntries.find((e) => e.id === b.id)
      if (!cur || JSON.stringify(cur) === JSON.stringify(b)) continue
      const { id: _id, environment: _env, createdAt: _c, ...data } = b
      await prisma.pronunciationLexiconEntry.update({ where: { id: b.id }, data })
      restored++
    }
    const delVersions = await prisma.pronunciationLexiconVersion.deleteMany({ where: { environment: 'LOCAL', version: { gt: baseMax } } })
    for (const bv of baseVersions) await prisma.pronunciationLexiconVersion.update({ where: { id: bv.id }, data: { status: bv.status } })
    const caches = await prisma.ttsCache.findMany({ where: { createdAt: { gte: startedAt }, OR: [{ dictionaryVersion: { gt: baseMax } }, ...MARKERS.map((m) => ({ normalizedText: { contains: m } }))] }, select: { key: true } })
    for (const c of caches) {
      await prisma.ttsCache.delete({ where: { key: c.key } }).catch(() => undefined)
      await removeDataFile(cacheSegments(c.key)).catch(() => undefined)
    }
    const tr = await prisma.requestTrace.deleteMany({ where: { userId: { in: qaIds }, createdAt: { gte: startedAt } } })
    console.log(`(원복) 항목 삭제 ${delEntries.count}·복원 ${restored} · 버전 삭제 ${delVersions.count}(상태 복원 ${baseVersions.length}) · TtsCache ${caches.length} · Trace ${tr.count} · AuditLog 는 불변이라 유지`)

    const afterVersions = await versionRows()
    const afterEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
    const sameVersions = JSON.stringify(afterVersions) === JSON.stringify(baseVersions)
    const sameEntries = JSON.stringify(afterEntries.sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify([...baseEntries].sort((a, b) => a.id.localeCompare(b.id)))
    const globals = afterEntries.filter((e) => e.scope === 'GLOBAL')
    check('8 원복: 버전 행·상태·항목 표가 시작 전과 동일(시드 GLOBAL 6 무변경)', sameVersions && sameEntries && globals.length === baseEntries.filter((e) => e.scope === 'GLOBAL').length, `버전 ${afterVersions.length}·항목 ${afterEntries.length}·GLOBAL ${globals.length}`)
    await prisma.$disconnect()
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error('스모크 중단:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
