/* eslint-disable @typescript-eslint/no-explicit-any -- QA 점검 스크립트 */
/**
 * task-034 QA — 사전 캐시 세대(REV-103 L-1): "게시 순간 진행 중이던 옛 조회가 옛 사전을 캐시에 다시 채우지 않는다".
 * 같은 프로세스 안에서 **실제 DB(LOCAL)·실제 관리자 서비스(createLexiconEntry·disableLexiconEntry — 트랜잭션·AuditLog·afterLexiconCommit→clearLexiconCache)** 를 쓴다.
 * 경합 재현: 사전 조회(`prisma.pronunciationLexiconVersion.findFirst`)의 **첫 호출만** 실제 질의(게시 전 상태를 읽음)를 먼저 하고 결과 도착을 900ms 늦춘다
 * → 그 사이 실제 게시(커밋+clear)가 끝나고, 늦은 옛 결과가 도착한 뒤 같은 프로세스의 다음 조회가 새 사전을 보는지 확인한다.
 *   A 표시용 경로(loadLexiconForDisplay = #24r 읽기 줄) · B 합성 경로(loadActiveLexicon = #23·미리듣기)
 * 같은 스크립트를 새 코드(미러)와 옛 코드(복제본, git HEAD)에서 모두 돌려 옛 결함 재현·새 코드 해소를 대조한다.
 * 쓰는 데이터: LOCAL 사전의 `青か`(GLOBAL, 시작 때 비활성) 항목을 켰다 끄기 — 끝에 항목 비활성·ACTIVE 스냅샷 해시가 시작 때와 같은지 확인.
 * 사용(미러 또는 복제본 루트에서): node --env-file=.env --import tsx tests/live/task034-qa-race.ts [expect=new|old]
 */
import { PrismaClient } from '@prisma/client'
import { CAPABILITIES } from '../../src/modules/admin/permissions/matrix'
import { createLexiconEntry, disableLexiconEntry } from '../../src/modules/admin/speech/lexicon'
import { clearLexiconCache, loadActiveLexicon, loadLexiconForDisplay, type ActiveLexicon } from '../../src/modules/speech/tts/lexicon'
import { prisma } from '../../src/modules/infra'

if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만')
const expectMode = process.argv[2] === 'old' ? 'old' : 'new'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const hasEntry = (l: ActiveLexicon | null) => !!l && l.entries.some((e) => e.surface === '青か' && e.scope === 'GLOBAL' && e.enabled !== false)

async function main() {
  const qa = await new PrismaClient().user.findUniqueOrThrow({ where: { email: 'qa-super@thekaiwa.test' }, select: { id: true, email: true, name: true } })
  const actor = { id: qa.id, email: qa.email, name: qa.name, role: 'SUPER_ADMIN', capabilities: [...CAPABILITIES], environment: 'LOCAL', ip: null } as any
  const startActive = await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } })
  const startVersions = await prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })
  if (!startActive) throw new Error('LOCAL ACTIVE 없음')
  console.log(`모드: ${expectMode === 'old' ? '옛 코드(복제본) — 결함 재현 기대' : '새 코드(미러) — 해소 기대'} · 시작: ACTIVE v${startActive.version} hash ${startActive.snapshotHash.slice(0, 12)} · 버전 행 ${startVersions}`)
  const ffHolder = prisma.pronunciationLexiconVersion as any
  const origFindFirst = ffHolder.findFirst.bind(ffHolder)

  /** 첫 findFirst 만: 실제 질의를 먼저 실행(= 커밋 전 상태를 읽음)한 뒤 결과 도착을 늦춘다. */
  function delayFirstLookup(ms: number): () => void {
    let first = true
    ffHolder.findFirst = async (args: unknown) => {
      const r = await origFindFirst(args)
      if (first) {
        first = false
        await sleep(ms)
      }
      return r
    }
    return () => {
      ffHolder.findFirst = origFindFirst
    }
  }

  let entryId: string | null = null
  async function publish(kind: 'create' | 'disable', reason: string): Promise<number> {
    const base = (await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true } }))!.version
    if (kind === 'create') {
      const r = await createLexiconEntry(actor, { surface: '青か', reading: 'アオカ', scope: 'GLOBAL', baseVersion: base, reason })
      entryId = (r as any).entry?.id ?? entryId
      return (r as any).version.version
    }
    const r = await disableLexiconEntry(actor, entryId!, { baseVersion: base, reason })
    return (r as any).version.version
  }

  const trials: { id: string; loader: (e: 'LOCAL') => Promise<ActiveLexicon | null>; label: string }[] = [
    { id: 'A', label: '표시용(loadLexiconForDisplay)', loader: (e) => loadLexiconForDisplay(e, { timeoutMs: 5000 }) },
    { id: 'B', label: '합성(loadActiveLexicon)', loader: (e) => loadActiveLexicon(e) },
  ]
  for (const t of trials) {
    for (const kind of ['create', 'disable'] as const) {
      clearLexiconCache()
      const before = await t.loader('LOCAL') // 워밍(옛 상태가 캐시에 있음 — 아래에서 clear 로 비운 뒤 늦은 조회를 시작한다)
      clearLexiconCache()
      const restore = delayFirstLookup(3000)
      let lateAt = 0
      const inflight = t.loader('LOCAL').then((v) => {
        lateAt = Date.now()
        return v
      }) // 게시 전 상태를 읽는 진행 중 조회
      await sleep(250) // 실제 질의가 이미 끝나 결과가 지연 대기 중
      const vNew = await publish(kind, `QA-034 race ${t.id}-${kind}`) // 실제 커밋 + afterLexiconCommit(clear)
      const publishEnd = Date.now()
      const late = await inflight // 늦은 옛 결과 도착(이 호출자는 받은 값을 그대로 쓴다 — 계약)
      const raced = lateAt > publishEnd // 늦은 결과가 clear 뒤에 도착했는가(경합 성립)
      restore()
      const next = await t.loader('LOCAL') // 같은 프로세스의 그 다음 조회
      const nextHas = hasEntry(next)
      const wantHas = kind === 'create'
      const fresh = (next as ActiveLexicon).dictionaryVersion === vNew && nextHas === wantHas
      const lateWasOld = (late as ActiveLexicon).dictionaryVersion < vNew
      const pass = raced && (expectMode === 'new' ? fresh : !fresh)
      check(
        `${t.id}-${kind} [${t.label}] ${expectMode === 'new' ? '게시 직후 다음 조회가 새 사전(v' + vNew + ')' : '옛 결함 재현: 다음 조회가 옛 사전 재사용'}`,
        pass,
        `진행 중 조회 결과 v${(late as ActiveLexicon).dictionaryVersion}(${lateWasOld ? '옛' : '새'}) · 다음 조회 v${(next as ActiveLexicon).dictionaryVersion} 항목 ${nextHas ? '있음' : '없음'} (게시 v${vNew}, 기대 항목 ${wantHas ? '있음' : '없음'}) ${fresh ? '→ 새 사전' : '→ 옛 사전(stale)'} · 늦은 결과는 게시 완료 ${lateAt - publishEnd}ms 뒤 도착(${raced ? '경합 성립' : '경합 미성립 — 무효'})`,
      )
      void before
    }
  }
  clearLexiconCache()

  // 시작 상태 복귀 확인
  const endActive = await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } })
  const endVersions = await prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })
  const entryRow = await prisma.pronunciationLexiconEntry.findFirst({ where: { environment: 'LOCAL', surface: '青か', scope: 'GLOBAL' }, select: { enabled: true } })
  check('R1 항목 青か(GLOBAL) 다시 비활성 · ACTIVE 스냅샷 해시가 시작 때와 동일', entryRow?.enabled === false && endActive?.snapshotHash === startActive.snapshotHash, `ACTIVE v${startActive.version} → v${endActive?.version} · 해시 ${endActive?.snapshotHash === startActive.snapshotHash ? '동일' : '다름'} · 버전 행 ${startVersions} → ${endVersions}`)
  const failed = results.filter((r) => !r.ok)
  console.log(`\n== task034-qa-race(${expectMode}): ${results.length - failed.length}/${results.length} 기대대로${failed.length ? ` — 기대와 다름: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}
main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 2
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit()
  })
