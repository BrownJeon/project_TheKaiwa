/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트 */
/**
 * task-034 QA — 관리자 API(HTTP, 서버 NEW 3011 · LOCAL 사전) 로 사전을 바꾸고 **같은 프로세스**의 합성(#23)·읽기 줄(#24r)이 곧바로 새 사전을 반영하는지,
 * 끄기·Rollback 으로 원복되는지, USER 범위(본인만)·한자 이름 트레이드오프(M-2)를 실측한다. 그리고 읽기 줄 경로 무영향을 옛 코드 서버(OLD 3012)와의 **차분 비교**로 확인한다.
 * 쓰는 데이터: LOCAL 사전(GLOBAL 青か·愚か·密か·上手·明日香, USER 山田(qa-bot)) — 끝에 Rollback 으로 시작 버전 내용으로 복귀, TtsCache 는 만든 키만 삭제.
 * 사용: node --env-file=.env --import tsx tests/live/task034-qa-http.ts <admin> <qa-bot> <qa-bot2>
 */
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'
import { cacheSegments } from '../../src/modules/speech/tts/cache'
import { Admin, call, check, cookie, corpus, ENGINE_NAME_RE, L, NEW, OLD, sleep, summary } from './task034-lib'

const [fAdmin, fA, fB] = process.argv.slice(2)
if (!fAdmin || !fA || !fB) throw new Error('사용: <admin> <qa-bot> <qa-bot2>')
const cAdmin = cookie(fAdmin)
const cA = cookie(fA)
const cB = cookie(fB)
const prisma = new PrismaClient()
const admin = new Admin(NEW, cAdmin)
const createdKeys = new Set<string>()

async function synth(ck: string, text: string): Promise<{ dictionaryVersion: number; matches: number | null; cacheKey: string; cached: boolean; normalizedText: string }> {
  const r = await call(NEW, ck, 'POST', '/api/v1/speech/tts', { text }, { accept: 'application/json' })
  if (r.status !== 200) throw new Error(`synth ${text} → ${r.status} ${r.text.slice(0, 160)}`)
  const d = r.json.data
  if (!d.cached) createdKeys.add(d.cacheKey)
  let matches: number | null = null
  for (let i = 0; i < 15; i++) {
    const t = await prisma.requestTrace.findFirst({ where: { traceId: d.traceId }, select: { steps: true } })
    if (t) {
      const lex = (t.steps as { name: string; matches?: number }[]).find((s) => s.name === 'TTS_LEXICON')
      matches = typeof lex?.matches === 'number' ? lex.matches : null
      break
    }
    await sleep(200)
  }
  return { dictionaryVersion: d.dictionaryVersion, matches, cacheKey: d.cacheKey, cached: d.cached, normalizedText: d.normalizedText }
}
async function annotate(base: string, ck: string, texts: string[]): Promise<any[]> {
  const r = await call(base, ck, 'POST', '/api/v1/text/annotate', { texts })
  if (r.status !== 200) throw new Error(`annotate ${base} → ${r.status} ${r.text.slice(0, 160)}`)
  return r.json.data.items
}
const rubyOf = (item: any) => (item ? JSON.stringify(item.segments) : 'null')
const has = (item: any, s: string) => rubyOf(item).includes(s)

const BASELINE = ['赤か青か', '愚か。', 'それは密か', '先生へ', '家へ', '経営', '通り', '明日香さん', '明日', '上手い', '上手な人', '青かった', '神保町', '今日は天気がいい']

async function main() {
  const idA = (await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })).id
  const startVersions = await prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })
  const startActive = (await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } }))!
  const prodBefore = await prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'PRODUCTION' }, select: { version: true, status: true, snapshotHash: true } })
  const startCache = await prisma.ttsCache.count()
  const v0 = startActive.version
  console.log(`기준: LOCAL ACTIVE v${v0} · 버전 행 ${startVersions} · PRODUCTION 버전 ${prodBefore.length}행 · TtsCache ${startCache}`)
  const ids: string[] = []
  try {
    // ── H1·H2. GLOBAL 青か 켜기 → 같은 프로세스 즉시 반영 → 끄기 → 원복 ──────────────
    console.log('\n## H1/H2. 게시 직후 같은 프로세스에서 새 사전 반영')
    await annotate(NEW, cA, ['赤か青か']) // 캐시를 옛 사전으로 채워 둔다(최악의 경우)
    const h1 = await admin.add('青か', 'アオカ', 'GLOBAL', null, 'QA-034 H1 青か 켜기')
    if (h1.id) ids.push(h1.id)
    const a1 = await annotate(NEW, cA, ['赤か青か'])
    const s1 = await synth(cA, '赤か青か')
    check('H1 青か 켜기(게시 v' + h1.version + ') → 곧바로 읽기 줄 青{あお}か · 합성 dictionaryVersion = 새 버전 · 합성 hint 1건', h1.status === 200 && has(a1[0], 'あお') && s1.dictionaryVersion === h1.version && s1.matches === 1, `읽기=${has(a1[0], 'あお') ? 'あお' : 'せい'} · 합성 v${s1.dictionaryVersion} matches=${s1.matches}`)
    const d1 = h1.id ? await admin.disable(h1.id, 'QA-034 H2 青か 끄기') : { status: 0, version: null }
    const a2 = await annotate(NEW, cA, ['赤か青か'])
    const s2 = await synth(cA, '赤か青か')
    check('H2 青か 끄기(게시 v' + d1.version + ') → 곧바로 읽기 줄 青{せい}か 원복 · 합성 dictionaryVersion = 끈 버전 · hint 0건', d1.status === 200 && has(a2[0], 'せい') && s2.dictionaryVersion === d1.version && s2.matches === 0, `읽기=${has(a2[0], 'せい') ? 'せい' : 'あお'} · 합성 v${s2.dictionaryVersion} matches=${s2.matches}`)

    // ── H3. 복합어를 사전에 직접 등록하는 정상 경로 ────────────────────────────────
    console.log('\n## H3. 복합어 직접 등록(明日香=アスカ) — 가드와 공존')
    const h3 = await admin.add('明日香', 'アスカ', 'GLOBAL', null, 'QA-034 H3 明日香', { wordType: 'PERSON' })
    if (h3.id) ids.push(h3.id)
    const s3a = await synth(cA, '明日香さん')
    const s3b = await synth(cA, '明日香さんは明日来ます')
    check('H3 明日香=アスカ 등록 → 明日香さん 합성 hint 1건(明日香)·キー가 사전 없을 때와 다름', h3.status === 200 && s3a.matches === 1 && s3a.dictionaryVersion === h3.version, `matches=${s3a.matches} v${s3a.dictionaryVersion}`)
    check('H3b 明日香さんは明日来ます → hint 1건(明日香만, 복합어 안 明日 아님·뒤 한자 이웃 明日는 가드로 제외)', s3b.matches === 1, `matches=${s3b.matches}`)
    if (h3.id) await admin.disable(h3.id, 'QA-034 H3 明日香 끄기')

    // ── H4. USER 범위(본인만) + 한자 이름 트레이드오프 ────────────────────────────────
    console.log('\n## H4. USER 山田(qa-bot 전용)')
    const h4 = await admin.add('山田', 'ヤマダ', 'USER', idA, 'QA-034 H4 山田', { wordType: 'PERSON' })
    if (h4.id) ids.push(h4.id)
    const u1 = await synth(cA, '山田さん')
    const u2 = await synth(cA, '山田先生')
    const u3 = await synth(cB, '山田さん')
    check('H4a 본인(qa-bot): 山田さん → hint 1건(적용)', h4.status === 200 && u1.matches === 1, `matches=${u1.matches}`)
    check('H4b [M-2 기록] 본인(qa-bot): 山田先生 → hint 0건(한자 접미어로 미적용 — 엔진 기본 읽기)', u2.matches === 0, `matches=${u2.matches}`)
    check('H4c 타 사용자(qa-bot2): 山田さん → hint 0건(USER 범위 격리)', u3.matches === 0, `matches=${u3.matches}`)
    const ann4a = await annotate(NEW, cA, ['山田さん'])
    const ann4b = await annotate(NEW, cB, ['山田さん'])
    console.log(`  (참고) 읽기 줄(annotate) 山田さん — A: ${rubyOf(ann4a[0])} / B: ${rubyOf(ann4b[0])}`)
    if (h4.id) await admin.disable(h4.id, 'QA-034 H4 山田 끄기')

    // ── H5. Rollback(시작 버전) → 시작 상태 복귀 ──────────────────────────────────
    console.log('\n## H5. Rollback → 시작 버전 내용으로')
    const rb = await admin.rollback(v0, 'QA-034 시작 버전으로 Rollback')
    const endActive = (await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } }))!
    check('H5 Rollback(v' + v0 + ') → 새 버전 v' + rb.version + ' · ACTIVE 스냅샷 해시가 시작 버전과 동일', rb.status === 200 && (rb.version ?? 0) > v0 && endActive.snapshotHash === startActive.snapshotHash, `ACTIVE v${endActive.version} hash ${endActive.snapshotHash === startActive.snapshotHash ? '동일' : '다름'}`)
    const s5 = await synth(cA, '明日香さん')
    check('H5b Rollback 직후 같은 프로세스 합성 dictionaryVersion = Rollback 버전', s5.dictionaryVersion === rb.version, `v${s5.dictionaryVersion}`)

    // ── H6. 읽기 줄 경로 무영향 — 옛 코드(OLD 3012)와 차분 비교(시드만 / 확장 사전) ─────────
    console.log('\n## H6. 읽기 줄(#24r) 5분기 무영향 — OLD(가드 전) vs NEW 응답 동일')
    const waitOld = async (probe: string, mark: string, want: boolean) => {
      for (let i = 0; i < 50; i++) {
        const it = await annotate(OLD, cA, [probe])
        if (has(it[0], mark) === want) return i
        await sleep(1000)
      }
      return -1
    }
    // 시드만 — OLD 의 30초 캐시가 레이스 시험으로 바뀐 버전과 어긋날 수 있어 시드 상태가 보일 때까지 기다린다
    const w0 = await waitOld('赤か青か', 'あお', false)
    const nS = await annotate(NEW, cA, BASELINE)
    const oS = await annotate(OLD, cB, BASELINE)
    const eqS = JSON.stringify(nS) === JSON.stringify(oS)
    check('H6a 시드만: 14문장 읽기 응답이 OLD 와 완전히 동일', w0 >= 0 && eqS, `OLD 캐시 정렬 대기 ${w0}s · ${BASELINE.filter((_, i) => JSON.stringify(nS[i]) !== JSON.stringify(oS[i])).join(',') || '차이 0'}`)
    const extra: [string, string][] = [['青か', 'アオカ'], ['愚か', 'オロカ'], ['密か', 'ヒソカ'], ['上手', 'ジョウズ']]
    for (const [s, r] of extra) {
      const e = await admin.add(s, r, 'GLOBAL', null, `QA-034 H6 ${s}`)
      if (e.id) ids.push(e.id)
    }
    const w1 = await waitOld('赤か青か', 'あお', true)
    const nX = await annotate(NEW, cA, BASELINE)
    const oX = await annotate(OLD, cB, BASELINE)
    const eqX = JSON.stringify(nX) === JSON.stringify(oX)
    const changed = BASELINE.filter((_, i) => JSON.stringify(nX[i]) !== JSON.stringify(nS[i]))
    check('H6b 青か·愚か·密か·上手 켠 상태: 14문장 읽기 응답이 OLD 와 완전히 동일(5분기: 같음·교체·복합어 유지·활용 같음·숨김)', w1 >= 0 && eqX && changed.length > 0, `OLD 캐시 정렬 대기 ${w1}s · 사전이 읽기를 바꾼 문장 ${changed.length}개(${changed.join(',')}) · NEW≠OLD ${BASELINE.filter((_, i) => JSON.stringify(nX[i]) !== JSON.stringify(oX[i])).join(',') || '0'}`)
    console.log(`  明日香さん(시드 明日 + 복합어 유지): ${rubyOf(nX[7])}`)
    console.log(`  上手い(활용형 숨김): ${rubyOf(nX[9])} / 上手な人: ${rubyOf(nX[10])}`)
    const rb2 = await admin.rollback(v0, 'QA-034 H6 후 시작 버전으로 Rollback')
    const end2 = (await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } }))!
    check('H6c 최종 Rollback → ACTIVE 스냅샷 해시 시작 때와 동일 · 새 버전', rb2.status === 200 && end2.snapshotHash === startActive.snapshotHash, `ACTIVE v${end2.version}`)
    const post = await annotate(NEW, cA, BASELINE)
    check('H6d 최종 상태 읽기 응답 = 시드만 상태 응답(원복)', JSON.stringify(post) === JSON.stringify(nS), '14문장 비교')

    // ── 노출·환경 ─────────────────────────────────────────────────────
    const hit = corpus.join('\n').match(ENGINE_NAME_RE)
    check('E1 이 점검의 모든 응답(관리자·합성·읽기)에 엔진명·model_id·speaker_id 0건', !hit, hit ? `검출: ${hit[0]}` : `${corpus.length}개 응답`)
    const prodAfter = await prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'PRODUCTION' }, select: { version: true, status: true, snapshotHash: true } })
    const prodAudit = await prisma.auditLog.count({ where: { environment: 'PRODUCTION', action: { startsWith: 'lexicon.' } } })
    check('V1 PRODUCTION 사전 무영향(버전 행·ACTIVE·해시 전후 동일, lexicon 감사 0)', JSON.stringify(prodBefore) === JSON.stringify(prodAfter) && prodAudit === 0, `PRODUCTION 버전 ${prodAfter.length}행 · 감사 ${prodAudit}`)
    void createHash
    void L
  } finally {
    // 중간 실패로 사전이 시작 상태가 아니면 마지막 방어 — 시작 버전으로 되돌린다.
    const cur = await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { snapshotHash: true } })
    if (cur && cur.snapshotHash !== startActive.snapshotHash) {
      const rr = await admin.rollback(v0, 'QA-034 정리(방어)')
      console.log(`  (방어 Rollback → ${rr.status})`)
    }
    let n = 0
    for (const key of createdKeys) {
      await prisma.ttsCache.delete({ where: { key } }).catch(() => undefined)
      await removeDataFile(cacheSegments(key)).catch(() => undefined)
      n++
    }
    const endCache = await prisma.ttsCache.count()
    const endVersions = await prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })
    console.log(`\n정리: TtsCache 만든 키 ${n}개 삭제 → 행 ${startCache} → ${endCache} · LOCAL 버전 행 ${startVersions} → ${endVersions}(+${endVersions - startVersions}, 불변 이력)`)
    check('C1 TtsCache 행 수 원복', endCache === startCache, `${startCache} → ${endCache}`)
    await prisma.$disconnect()
  }
  summary('task034-qa-http')
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 2
})
