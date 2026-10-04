/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트(응답 JSON 형태를 느슨하게 다룬다) */
/**
 * task-032 QA 라이브 점검 — 관리자 발음 사전(LOCAL 환경 한정)을 관리자 API 로 바꾸고 #24r 읽기 응답(ruby·pron·한글 줄)이 따라 바뀌는지 본다.
 * 서버 127.0.0.1(개발 미러 next dev, APP_ENV=LOCAL)만. 운영(3010)·PRODUCTION 사전은 쓰지 않는다(PRODUCTION 은 DB 읽기 조회만).
 * 쓰는 것 = LOCAL 사전의 가짜가 아닌 실제 항목(青か 등) — 끝에 Rollback(v1)으로 ACTIVE 를 시작 전 항목 집합으로 되돌린다. 버전 행은 남는다(불변 이력).
 *
 * 사용: node --env-file=.env --import tsx tests/live/task032-qa.ts <cookieUserA> <cookieUserB> <cookieAdmin>
 * 환경변수 BASE(기본 http://127.0.0.1:3024)
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { hangulLine, toRubyMarkup, type ReadingSegment } from '../../src/modules/speech/reading/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3024'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만')
if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만')
const [cA, cB, cAdmin] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cA || !cB || !cAdmin) throw new Error('사용: <cookieA> <cookieB> <cookieAdmin>')

const prisma = new PrismaClient()
const L = '/api/admin/v1/lexicon'
type Json = Record<string, unknown>
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
async function call(cookie: string | null, method: string, path: string, body?: unknown): Promise<{ status: number; json: any; text: string }> {
  const h: Record<string, string> = {}
  if (cookie) h.Cookie = cookie
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: r.status, json, text }
}
interface Row {
  text: string
  ruby: string | null
  hg: string | null
  pronNull: boolean
}
const allText: string[] = []
async function ann(cookie: string, texts: string[]): Promise<{ rows: Row[]; available: boolean; status: number }> {
  const r = await call(cookie, 'POST', '/api/v1/text/annotate', { texts })
  allText.push(r.text)
  if (r.status !== 200) return { rows: [], available: false, status: r.status }
  const items = r.json.data.items as Array<{ segments: ReadingSegment[] } | null>
  return {
    status: 200,
    available: r.json.data.available,
    rows: items.map((it, i) =>
      it
        ? { text: texts[i], ruby: toRubyMarkup(it.segments), hg: hangulLine(it.segments), pronNull: it.segments.some((s) => s.pron === null) }
        : { text: texts[i], ruby: null, hg: null, pronNull: true },
    ),
  }
}
const show = (tag: string, rows: Row[]) => rows.forEach((x) => console.log(`   [${tag}] ${x.text}  =>  ruby=${x.ruby}  hangul=${x.hg}  pronNull=${x.pronNull}`))
async function activeVersion(): Promise<number> {
  const r = await call(cAdmin, 'GET', `${L}?pageSize=1`)
  return (r.json?.data?.active?.version ?? r.json?.data?.dictionaryVersion) as number
}
async function add(surface: string, reading: string, scope: 'GLOBAL' | 'USER', scopeRefId: string | null, reason: string): Promise<{ id: string; status: number; version: number }> {
  const base = await activeVersion()
  const body: Json = { surface, reading, scope, baseVersion: base, reason }
  if (scopeRefId) body.scopeRefId = scopeRefId
  const r = await call(cAdmin, 'POST', L, body)
  console.log(`   (admin) POST ${scope} ${surface}=${reading} → ${r.status} v${(r.json?.data?.version as Json | undefined)?.version ?? '?'}`)
  return { id: r.json?.data?.entry?.id, status: r.status, version: (r.json?.data?.version as Json | undefined)?.version as number }
}
async function disable(id: string, reason: string): Promise<number> {
  const base = await activeVersion()
  const r = await call(cAdmin, 'DELETE', `${L}/${id}`, { baseVersion: base, reason })
  console.log(`   (admin) DELETE ${id} → ${r.status} v${(r.json?.data?.version as Json | undefined)?.version ?? '?'}`)
  return r.status
}
async function rollback(version: number, reason: string): Promise<number> {
  const base = await activeVersion()
  const r = await call(cAdmin, 'POST', `${L}/versions/${version}/rollback`, { baseVersion: base, reason })
  console.log(`   (admin) ROLLBACK to v${version} → ${r.status} new v${(r.json?.data?.version as Json | undefined)?.version ?? '?'}`)
  return r.status
}

const BASELINE = ['赤か青か', '愚か。', 'それは密か', '先生へ', '家へ', '経営', '通り', '明日香さん', '明日', '上手い', '上手な人', '青かった', '神保町', '今日は天気がいい']

async function main() {
  const A = (await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })).id
  const startVersions = await prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })
  const prodBefore = await prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'PRODUCTION' }, select: { version: true, status: true, snapshotHash: true } })
  const v1 = await activeVersion()
  console.log(`기준: LOCAL ACTIVE v${v1}, LOCAL 버전 행 ${startVersions}, PRODUCTION 버전 행 ${prodBefore.length}`)

  // ── 기준선(항목 5 시드만) ───────────────────────────────────────────
  const base = await ann(cA, BASELINE)
  console.log('## 기준선(시드 6건만)')
  show('base', base.rows)
  const g = (rows: Row[], t: string) => rows.find((x) => x.text === t)!
  const baseMap = new Map(base.rows.map((x) => [x.text, x]))
  check('5a 시드만: 先生へ 센세-에 · 家へ 이에에 · 経営 케-에- · 通り 토-리', base.available && g(base.rows, '先生へ').hg === '센세-에' && g(base.rows, '家へ').hg === '이에에' && g(base.rows, '経営').hg === '케-에-' && g(base.rows, '通り').hg === '토-리', [ '先生へ', '家へ', '経営', '通り' ].map((t) => `${t}:${g(base.rows, t).hg}`).join(' '))
  check('1-pre 사전 항목 없음: 赤か青か 원본(青{せい}か)', g(base.rows, '赤か青か').ruby === '赤{あか}か青{せい}か', String(g(base.rows, '赤か青か').ruby))

  // ── 1. GLOBAL 青か·愚か·密か ────────────────────────────────────────
  console.log('## 1. GLOBAL 추가')
  const e1 = await add('青か', 'アオカ', 'GLOBAL', null, 'QA-032 青か')
  const a1 = await ann(cA, ['赤か青か'])
  show('+青か', a1.rows)
  check('1a GLOBAL 青か 추가 → 赤か青か: 青{あお}か · 한글 아오까', e1.status === 200 && a1.rows[0].ruby === '赤{あか}か青{あお}か' && /아오까/.test(a1.rows[0].hg ?? ''), `${a1.rows[0].ruby} / ${a1.rows[0].hg}`)
  const e2 = await add('愚か', 'オロカ', 'GLOBAL', null, 'QA-032 愚か')
  const e3 = await add('密か', 'ヒソカ', 'GLOBAL', null, 'QA-032 密か')
  const a1b = await ann(cA, ['赤か青か', '愚か。', 'それは密か'])
  show('+3항목', a1b.rows)
  check('1a2 愚か·密か 도 반영(愚{おろ}か·密{ひそ}か, 한글 오로까·히소까)', a1b.rows[1].ruby === '愚{おろ}か。' && a1b.rows[2].ruby === 'それは密{ひそ}か' && /오로까/.test(a1b.rows[1].hg ?? '') && /히소까/.test(a1b.rows[2].hg ?? ''), `${a1b.rows[1].hg} / ${a1b.rows[2].hg}`)
  // 항목 끄기 → 원복
  const dis = await disable(e1.id, 'QA-032 青か 끄기')
  const a1c = await ann(cA, ['赤か青か', '愚か。'])
  show('青か 끈 뒤', a1c.rows)
  check('1b 青か 끄기 → 다음 요청 원복(青{せい}か), 愚か 는 유지', dis === 200 && a1c.rows[0].ruby === '赤{あか}か青{せい}か' && a1c.rows[1].ruby === '愚{おろ}か。', `${a1c.rows[0].ruby} / ${a1c.rows[1].ruby}`)
  // 되살림(POST 같은 키 → 비활성이면 되살림) → 적용, 그 뒤 Rollback(v1)로 전부 원복
  const rev = await add('青か', 'アオカ', 'GLOBAL', null, 'QA-032 青か 되살림')
  const a1d = await ann(cA, ['赤か青か'])
  check('1c 되살림 → 다시 적용', a1d.rows[0].ruby === '赤{あか}か青{あお}か', String(a1d.rows[0].ruby))
  const rb = await rollback(v1, 'QA-032 v1 로 Rollback')
  const a1e = await ann(cA, ['赤か青か', '愚か。', 'それは密か'])
  show('Rollback v1', a1e.rows)
  check('1d Rollback(v1) → 三 항목 모두 원복(원본 분석기 출력), 새 버전으로 기록', rb === 200 && a1e.rows[0].ruby === '赤{あか}か青{せい}か' && a1e.rows[1].ruby === base.rows[1].ruby && a1e.rows[2].ruby === base.rows[2].ruby, `${a1e.rows.map((x) => x.ruby).join(' | ')}`)
  void e2
  void e3
  void rev

  // ── 2. USER 소유자 격리 ─────────────────────────────────────────────
  console.log('## 2. USER 범위 (A=qa-bot 에게만)')
  const u1 = await add('青か', 'アオカ', 'USER', A, 'QA-032 A 의 USER 青か')
  const ua = await ann(cA, ['赤か青か'])
  const ub = await ann(cB, ['赤か青か'])
  const uadm = await ann(cAdmin, ['赤か青か'])
  show('A', ua.rows)
  show('B', ub.rows)
  show('admin', uadm.rows)
  check('2a A 에게만 적용(青{あお}か), B·관리자 계정 응답은 원본(青{せい}か) — 소유자 누출 0', u1.status === 200 && ua.rows[0].ruby === '赤{あか}か青{あお}か' && ub.rows[0].ruby === '赤{あか}か青{せい}か' && uadm.rows[0].ruby === '赤{あか}か青{せい}か', `A=${ua.rows[0].ruby} B=${ub.rows[0].ruby} admin=${uadm.rows[0].ruby}`)
  // 같은 요청에서 B 가 userId 를 속일 수 있는 입력은 없다 — 라우트는 본문 userId 를 읽지 않는다
  const spoof = await call(cB, 'POST', '/api/v1/text/annotate', { texts: ['赤か青か'], userId: A, scopeRefId: A })
  allText.push(spoof.text)
  const spoofRuby = toRubyMarkup(spoof.json.data.items[0].segments)
  check('2b B 가 본문에 userId=A 를 실어도 미적용', spoofRuby === '赤{あか}か青{せい}か', spoofRuby)
  await disable(u1.id, 'QA-032 A USER 青か 끄기')
  const ua2 = await ann(cA, ['赤か青か'])
  check('2c A 의 USER 항목 끄기 → A 도 원복', ua2.rows[0].ruby === '赤{あか}か青{せい}か', String(ua2.rows[0].ruby))
  await rollback(v1, 'QA-032 v1 로 Rollback')

  // ── 3·4. 활용형 충돌·복합어 ─────────────────────────────────────────
  console.log('## 3·4. 上手=ジョウズ + 青か')
  await add('上手', 'ジョウズ', 'GLOBAL', null, 'QA-032 上手')
  await add('青か', 'アオカ', 'GLOBAL', null, 'QA-032 青か')
  const c3 = await ann(cA, ['上手い', '上手な人', '上手です', '青かった', '赤か青か', '明日香さん', '明日', '明日は'])
  show('충돌', c3.rows)
  const r = (t: string) => c3.rows.find((x) => x.text === t)!
  check('3a 上手い → ruby null·pron null(한글 줄 숨김, 틀린 읽기 0)', r('上手い').ruby === '上手い' && r('上手い').hg === null && r('上手い').pronNull, `ruby=${r('上手い').ruby} hg=${r('上手い').hg}`)
  check('3b 上手な人 유지(上手 한글 있음)', r('上手な人').hg !== null && /(조-즈|조즈|죠-즈|죠즈)/.test(r('上手な人').hg ?? '') && r('上手な人').ruby === '上手{じょうず}な人{ひと}', `${r('上手な人').ruby} / ${r('上手な人').hg}`)
  check('3c 青かった 유지(青{あお}かった) — 가나 활용 소리 같음', r('青かった').ruby === '青{あお}かった', `${r('青かった').ruby} / ${r('青かった').hg}`)
  check('4a 明日香さん → あすか 유지(明日 시드·복합어 가드)', r('明日香さん').ruby === '明日香{あすか}さん' && /아스까/.test(r("明日香さん").hg ?? ""), `${r('明日香さん').ruby} / ${r('明日香さん').hg}`)
  check('4b 明日 단독은 시드 그대로(あした)', r('明日').ruby === '明日{あした}', `${r('明日').ruby} / ${r('明日').hg}`)
  // ── 5. 시드+임의 항목 상태에서 030·031 한글 불변 ─────────────────────
  const c5 = await ann(cA, ['先生へ', '家へ', '経営', '通り'])
  check('5b 항목(上手·青か)이 더 있어도 先生へ 센세-에 · 家へ 이에에 · 経営 케-에- · 通り 토-리 불변', c5.rows.map((x) => x.hg).join(',') === '센세-에,이에에,케-에-,토-리', c5.rows.map((x) => x.hg).join(','))
  // 3d: 같은 문장 반복 요청에서 캐시 객체 불변(두 번째 호출도 동일)
  const again = await ann(cA, ['上手い', '赤か青か'])
  check('3d 같은 문장 재요청에도 같은 결과(서버 캐시 객체 오염 0)', again.rows[0].ruby === '上手い' && again.rows[0].hg === null && again.rows[1].ruby === '赤{あか}か青{あお}か', `${again.rows[0].ruby}/${again.rows[1].ruby}`)
  await rollback(v1, 'QA-032 v1 로 Rollback')
  const fin = await ann(cA, BASELINE)
  const same = fin.rows.every((x) => x.ruby === baseMap.get(x.text)!.ruby && x.hg === baseMap.get(x.text)!.hg)
  check('R 최종 Rollback(v1) 뒤 14문장 전부 기준선과 동일(ruby·한글)', same, fin.rows.filter((x) => x.ruby !== baseMap.get(x.text)!.ruby || x.hg !== baseMap.get(x.text)!.hg).map((x) => x.text).join(',') || 'diff 0')

  // ── 7. 응답 누출 ───────────────────────────────────────────────────
  const leak = /reazon|whisper|style-?bert|sbv2|openjtalk|pyopenjtalk|claude|model_?id|speaker_?id|sherpa|lexicon|dictionary|snapshot|reason|QA-032/i
  check('7a 읽기 응답 본문 전체(' + allText.length + '건)에 엔진명·사전 필드·감사 사유 문자열 0', allText.every((t) => !leak.test(t)), allText.filter((t) => leak.test(t)).slice(0, 1).map((t) => t.match(leak)?.[0]).join(','))
  const noCookie = await call(null, 'POST', '/api/v1/text/annotate', { texts: ['赤か青か'] })
  check('7b 쿠키 없음 → 401', noCookie.status === 401, `${noCookie.status} ${noCookie.text.slice(0, 80)}`)
  const bad = await call(cA, 'POST', '/api/v1/text/annotate', { texts: 'x' })
  check('7c 입력 검증 400 유지', bad.status === 400, `${bad.status}`)

  // ── DB 사후 점검 ───────────────────────────────────────────────────
  const prodAfter = await prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'PRODUCTION' }, select: { version: true, status: true, snapshotHash: true } })
  check('3p PRODUCTION 사전 무영향(버전 행·상태·해시 동일)', JSON.stringify(prodBefore) === JSON.stringify(prodAfter), `행 ${prodBefore.length}→${prodAfter.length}`)
  const prodEntries = await prisma.pronunciationLexiconEntry.count({ where: { environment: 'PRODUCTION', surface: { in: ['青か', '愚か', '密か', '上手'] } } })
  check('3p2 PRODUCTION 항목 표에 青か·愚か·密か·上手 0건', prodEntries === 0, String(prodEntries))
  const localAfter = await prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'LOCAL' }, orderBy: { version: 'asc' }, select: { version: true, status: true } })
  const active = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL', enabled: true }, select: { surface: true, scope: true } })
  console.log(`LOCAL 버전 행 ${startVersions} → ${localAfter.length}, ACTIVE v${localAfter.find((x) => x.status === 'ACTIVE')?.version}, ACTIVE 표 enabled ${active.length}건: ${active.map((e) => `${e.scope}:${e.surface}`).join(' ')}`)
  const ver = await call(cAdmin, 'GET', `${L}/versions/${localAfter.find((x) => x.status === 'ACTIVE')?.version}`)
  console.log(`ACTIVE 버전 상세 status ${ver.status}`)
  void v1
}
main()
  .catch((e) => {
    console.error('중단:', e instanceof Error ? e.stack : e)
    process.exitCode = 2
  })
  .finally(async () => {
    await prisma.$disconnect()
    const failed = results.filter((r) => !r.ok)
    console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
    if (failed.length) process.exitCode = 1
  })
