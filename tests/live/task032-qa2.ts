/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트(응답 JSON 형태를 느슨하게 다룬다) */
/**
 * task-032 QA 보조 점검 — 별도 프로세스(서버와 캐시 분리)에서 annotateReadings 를 직접 부른다. 실 gateway(개발 8198) + 실 DB(LOCAL 사전 읽기 전용).
 *  A. 다른 프로세스 전파 ≤30초(서버가 관리자 API 로 사전 변경 → 이 프로세스는 30초 캐시 동안 옛 사전, 지난 뒤 새 사전)
 *  B. 사전 조회 장애·지연 주입(prisma.pronunciationLexiconVersion.findFirst 를 이 프로세스에서만 가로챔) — 읽기 응답 시간·available·결과
 *  C. 지연: 12문장 캐시 미스 p50 — 사전 없음(loadLexicon→null) vs 사전 적용(캐시 적중) vs 사전 냉 조회
 * 사용: node --env-file=.env --import tsx tests/live/task032-qa2.ts <cookieAdmin>
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/modules/infra'
import { annotateReadings, resetReadingCache } from '../../src/modules/speech/reading'
import { clearLexiconCache } from '../../src/modules/speech/tts/lexicon'
import { toRubyMarkup, hangulLine, type ReadingSegment } from '../../src/modules/speech/reading/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3024'
if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만')
const cAdmin = readFileSync(process.argv[2], 'utf8').trim()
const L = '/api/admin/v1/lexicon'
const results: { id: string; ok: boolean; note: string }[] = []
const check = (id: string, ok: boolean, note = '') => {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function admin(method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: cAdmin, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const activeV = async () => (await admin('GET', `${L}?pageSize=1`)).json.data.dictionaryVersion as number
const ruby = (segs: ReadingSegment[] | null) => (segs ? toRubyMarkup(segs) : null)
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))]
const real = prisma.pronunciationLexiconVersion.findFirst.bind(prisma.pronunciationLexiconVersion)

async function main() {
  const v1 = await activeV()
  console.log(`ACTIVE v${v1}`)

  // ── A. 다른 프로세스 전파 ≤30초 ─────────────────────────────────────
  if (!process.env.SKIP_A) {
  resetReadingCache()
  clearLexiconCache()
  const r0 = await annotateReadings(['赤か青か'], {}, 'qa-proc', { userId: null })
  console.log(`   [A0 이 프로세스 사전 로드] ${ruby(r0.items[0])}  available=${r0.available}`)
  const add = await admin('POST', L, { surface: '青か', reading: 'アオカ', scope: 'GLOBAL', baseVersion: v1, reason: 'QA-032 프로세스 간 전파' })
  const t0 = Date.now()
  const r1 = await annotateReadings(['赤か青か'], {}, 'qa-proc', { userId: null })
  check('A1 서버가 항목 추가 직후, 이 프로세스(30초 캐시 안)는 아직 옛 사전(青{せい}か) — 최대 30초 지연이 설계', add.status === 200 && ruby(r1.items[0]) === '赤{あか}か青{せい}か', String(ruby(r1.items[0])))
  let appliedAt: number | null = null
  for (let i = 0; i < 40; i++) {
    await sleep(1000)
    const r = await annotateReadings(['赤か青か'], {}, 'qa-proc', { userId: null })
    if (ruby(r.items[0]) === '赤{あか}か青{あお}か') {
      appliedAt = (Date.now() - t0) / 1000
      break
    }
  }
  check('A2 다른 프로세스에 ≤30초 안에 반영', appliedAt !== null && appliedAt <= 31, `반영까지 ${appliedAt?.toFixed(1)}초`)
  const vAdd = await activeV()
  const rb = await admin('POST', `${L}/versions/${v1}/rollback`, { baseVersion: vAdd, reason: 'QA-032 Rollback v1' })
  console.log(`   (admin) Rollback v${v1} → ${rb.status}`)
  }

  // ── B. 사전 조회 장애·지연 주입 ────────────────────────────────────
  // 이 프로세스 사전 캐시에는 青か 포함 사전이 들어 있다(마지막 반영분). 먼저 완전 냉 상태를 만든다.
  // 유한 지연(3초 뒤 실제 조회) — 끝나지 않는 조회(무한)는 Prisma 자체 타임아웃이 있는 실환경과 다르다(별도 관찰로 남김).
  const slow = (ms: number) => (args: any) => new Promise((res) => setTimeout(() => res(real(args)), ms))
  const stub = (impl: (args?: any) => any) => ((prisma.pronunciationLexiconVersion as any).findFirst = impl)
  const restore = () => ((prisma.pronunciationLexiconVersion as any).findFirst = real)
  async function timed(label: string, texts: string[]) {
    const t = performance.now()
    const r = await annotateReadings(texts, {}, 'qa-proc', { userId: null })
    const ms = performance.now() - t
    console.log(`   [${label}] ${ms.toFixed(0)}ms available=${r.available} ${r.items.map(ruby).join(' | ')}`)
    return { ms, r }
  }
  // B1 냉 + 3초 지연
  resetReadingCache()
  clearLexiconCache()
  stub(slow(3000))
  const b1 = await timed('B1 냉·사전 DB 3초 지연', ['赤か青か'])
  check('B1 사전 조회가 3초 걸려도 읽기 응답 ≈1초(상한)·available 유지·원본 분석기 결과', b1.ms < 1300 && b1.r.available && ruby(b1.r.items[0]) === '赤{あか}か青{せい}か', `${b1.ms.toFixed(0)}ms`)
  const b1b = await timed('B1b 진행 조회에 합류하는 재요청', ['愚か。'])
  check('B1b 조회 진행 중 재요청도 ≈1초 상한 내', b1b.ms < 1300 && b1b.r.available, `${b1b.ms.toFixed(0)}ms`)
  await sleep(2500) // 늦은 조회가 끝나 캐시를 채운다
  const b1c = await timed('B1c 늦은 조회 완료 뒤', ['赤か青か'])
  check('B1c 늦은 조회가 끝난 뒤에는 지연 없음(캐시 적중)', b1c.ms < 100, `${b1c.ms.toFixed(0)}ms`)
  restore()
  // B2 냉 + 즉시 실패
  resetReadingCache()
  clearLexiconCache()
  stub(() => Promise.reject(new Error('QA injected DB failure')))
  const b2 = await timed('B2 냉·사전 DB 즉시 실패', ['赤か青か'])
  check('B2 사전 조회 즉시 실패 → 빠르게(<500ms)·available 유지·원본', b2.ms < 500 && b2.r.available && ruby(b2.r.items[0]) === '赤{あか}か青{せい}か', `${b2.ms.toFixed(0)}ms ${ruby(b2.r.items[0])}`)
  restore()
  // B3 사전(青か) 로드 → 캐시 만료 흉내 → 조회 실패 → 직전 사전 계속
  resetReadingCache()
  clearLexiconCache()
  const vNow = await activeV()
  const add2 = await admin('POST', L, { surface: '青か', reading: 'アオカ', scope: 'GLOBAL', baseVersion: vNow, reason: 'QA-032 stale 점검' })
  const warm = await timed('B3a 사전 로드(青か 포함)', ['赤か青か'])
  check('B3a 사전 로드 후 적용', add2.status === 200 && ruby(warm.r.items[0]) === '赤{あか}か青{あお}か', String(ruby(warm.r.items[0])))
  const realNow = Date.now
  Date.now = () => realNow() + 31_000 // 30초 캐시 만료를 흉내
  stub(() => Promise.reject(new Error('QA injected DB failure')))
  const b3 = await timed('B3b 캐시 만료 + 조회 실패 → 직전 사전', ['愚か。', '赤か青か'])
  check('B3b 만료 후 조회 실패 → 직전 사전으로 계속 적용(青{あお}か)·빠름', b3.ms < 500 && b3.r.available && ruby(b3.r.items[1]) === '赤{あか}か青{あお}か', `${b3.ms.toFixed(0)}ms ${ruby(b3.r.items[1])}`)
  // B3c 만료 + 3초 지연 → 직전 사전 + ≈1초
  stub(slow(3000))
  Date.now = () => realNow() + 62_000
  const b3c = await timed('B3c 캐시 만료 + 조회 3초 지연 → 직전 사전·≈1초', ['赤か青か'])
  check('B3c 만료 후 조회 지연 → 직전 사전 적용·≈1초 상한', b3c.ms < 1300 && ruby(b3c.r.items[0]) === '赤{あか}か青{あお}か', `${b3c.ms.toFixed(0)}ms ${ruby(b3c.r.items[0])}`)
  restore()
  Date.now = realNow
  await sleep(3200)
  const vNow2 = await activeV()
  await admin('POST', `${L}/versions/${v1}/rollback`, { baseVersion: vNow2, reason: 'QA-032 Rollback to start' })

  // ── C. 지연 ────────────────────────────────────────────────────────
  const SENT = ['今日は天気がいいですね。', '私は毎日日本語を勉強しています。', '先生へ話します。', '家へ帰ります。', '経営について聞きました。', '通りを歩いています。', '明日香さんと会います。', '赤か青か決めて。', '上手い料理ですね。', '神保町で本を買いました。', 'それは密かな楽しみです。', '愚かなことをしました。']
  const mkTexts = (n: number) => SENT.map((s, i) => `${s}${'あ'.repeat(n % 7)}${i}${n}`) // 매번 새 문장 → 분석 캐시 미스
  const withNull: number[] = []
  const withLex: number[] = []
  const withCold: number[] = []
  restore()
  clearLexiconCache()
  await annotateReadings(mkTexts(999), {}, 'qa-proc', {}) // 워밍
  for (let i = 0; i < 12; i++) {
    resetReadingCache()
    let t = performance.now()
    await annotateReadings(mkTexts(i), { loadLexicon: async () => null }, 'qa-proc', {})
    withNull.push(performance.now() - t)
    resetReadingCache()
    t = performance.now()
    await annotateReadings(mkTexts(i), {}, 'qa-proc', {}) // 사전 캐시 적중
    withLex.push(performance.now() - t)
    resetReadingCache()
    clearLexiconCache()
    t = performance.now()
    await annotateReadings(mkTexts(i), {}, 'qa-proc', {}) // 사전 냉 조회
    withCold.push(performance.now() - t)
  }
  const f = (a: number[]) => `p50 ${q(a, 0.5).toFixed(1)}ms · p95 ${q(a, 0.95).toFixed(1)}ms`
  console.log(`   12문장 캐시 미스(n=12, 교대): 사전 없음 ${f(withNull)} | 사전 캐시 적중 ${f(withLex)} | 사전 냉 조회 ${f(withCold)}`)
  check('C 읽기 지연 악화 없음(사전 적용 p50 ≤ 사전 없음 p50 + 10ms, 냉 조회도 + 20ms)', q(withLex, 0.5) <= q(withNull, 0.5) + 10 && q(withCold, 0.5) <= q(withNull, 0.5) + 20, `없음 ${q(withNull, 0.5).toFixed(1)} / 적중 ${q(withLex, 0.5).toFixed(1)} / 냉 ${q(withCold, 0.5).toFixed(1)}`)
  const hg = (await annotateReadings(['先生へ', '家へ', '経営', '通り'], {}, 'qa-proc', {})).items.map((s) => hangulLine(s!)).join(',')
  check('C2 시드만일 때 한글 불변(센세-에,이에에,케-에-,토-리)', hg === '센세-에,이에에,케-에-,토-리', hg)
  const fin = await activeV()
  console.log(`최종 ACTIVE v${fin}`)
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
    process.exit()
  })
