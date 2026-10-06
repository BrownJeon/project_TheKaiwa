/**
 * task-012b-2 라이브 스모크 — #21c 내 발화 목록(인증·소유자·IDOR·질의 검사·응답 모양·엔진 정보 0·커서)·#66 `items[].voiced`·#21a/#21b 남의 발화 404.
 * **DB 에 쓰지 않는다**: 목록·조회는 읽기, #21a 는 계정 2 의 "확인할 수 없는" 발화에만 보낸다 — 소유자 검사가 맞으면 404, 깨졌어도 409 NOT_REVIEWABLE
 * 로 끝나 행이 바뀌지 않는다(그 차이로 IDOR 를 잡는다). 픽스처 id 는 Prisma 로 **읽기만** 찾는다. LLM·M4·STT 호출 0.
 *
 * 실행(우분투 미러 루트, dev 서버 127.0.0.1 — 운영 3010 금지):
 *   QA_ACCOUNT=1 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-qa1
 *   QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-qa2
 *   BASE=http://127.0.0.1:3027 node --env-file=.env --import tsx tests/live/task012b2-smoke.ts /tmp/c-qa1 /tmp/c-qa2
 *   rm -f /tmp/c-qa1 /tmp/c-qa2
 * 계정 1 에 발화가 없으면 목록 모양 항목 일부가 SKIP 으로 나온다(실패 아님) — 회화방에서 한 번 말해 두면 전부 돈다.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3027'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if (/:3010$/.test(BASE)) throw new Error('운영 포트 3010 에서는 실행하지 않는다')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다')
const [c1, c2] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!c1 || !c2) throw new Error('사용: task012b2-smoke.ts <QA 계정 1 쿠키 파일> <QA 계정 2 쿠키 파일>')
const COOKIE = { A: c1, B: c2 } as const

const prisma = new PrismaClient()
const results: { id: string; ok: boolean | null; note: string }[] = []
function check(id: string, ok: boolean | null, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  data: Json
  text: string
}
async function api(who: keyof typeof COOKIE | null, path: string, init: RequestInit = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
  if (who) headers.Cookie = COOKIE[who]
  const r = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' })
  const text = await r.text()
  let data: Json = {}
  try {
    data = (JSON.parse(text) as { data?: Json }).data ?? {}
  } catch {
    data = {}
  }
  return { status: r.status, data, text }
}

const LIST = '/api/v1/speech/utterances'
const ITEM_KEYS = ['analysisText', 'audioAvailable', 'chatMessageId', 'context', 'createdAt', 'durationMs', 'finalSource', 'finalText', 'id', 'realtimeText', 'requiresReview', 'status', 'wasReviewTarget']
const BANNED = /engine|confidence|reviewThreshold|audioPath|\.wav|users\/|reazon|whisper|style-?bert|sherpa|claude|qwen/i

async function userIdOf(email: string): Promise<string | null> {
  return (await prisma.user.findFirst({ where: { email, provider: 'test' }, select: { id: true } }))?.id ?? null
}

async function main() {
  const uA = await userIdOf('qa-bot@thekaiwa.test')
  const uB = await userIdOf('qa-bot2@thekaiwa.test')
  if (!uA || !uB) throw new Error('QA 계정 1·2 가 없다 — qa-session.ts 로 먼저 만든다')

  // ── 인증·질의 검사 ─────────────────────────────────────────
  check('S1 무세션 401', (await api(null, `${LIST}?limit=1`)).status === 401)
  for (const [id, q] of [
    ['S2a 모르는 키', 'userId=x'],
    ['S2b limit=0', 'limit=0'],
    ['S2c limit=51', 'limit=51'],
    ['S2d reviewable=true', 'reviewable=true'],
    ['S2e chatId 형식', 'chatId=..%2Fx'],
    ['S2f 깨진 커서', 'cursor=@@@'],
  ] as const) {
    const r = await api('A', `${LIST}?${q}`)
    check(`${id} 400`, r.status === 400, `status=${r.status}`)
  }

  // ── 응답 모양·엔진 정보 0 ─────────────────────────────────
  const page1 = await api('A', `${LIST}?limit=20`)
  check('S3 계정 1 목록 200', page1.status === 200, `status=${page1.status}`)
  const items = (page1.data.items as Json[] | undefined) ?? []
  check('S3a 응답 칸 {items,nextCursor,reviewableCount}', Array.isArray(page1.data.items) && 'nextCursor' in page1.data && typeof page1.data.reviewableCount === 'number')
  check('S3b 응답 전체에 엔진·신뢰도·경로 문자열 0', !BANNED.test(page1.text))
  if (items.length) {
    check('S3c 항목 칸 13개 고정', items.every((it) => JSON.stringify(Object.keys(it).sort()) === JSON.stringify(ITEM_KEYS)))
    check('S3d 최근 것부터(createdAt 내림차순)', items.every((it, i) => i === 0 || String(items[i - 1].createdAt) >= String(it.createdAt)))
    const ids = items.map((it) => String(it.id))
    const owned = await prisma.utterance.count({ where: { id: { in: ids }, userId: uA } })
    check('S3e 전부 계정 1 소유(DB 대조)', owned === ids.length, `${owned}/${ids.length}`)
  } else check('S3c~e 항목 검사', null, '계정 1 발화 0건')

  // ── 커서 ───────────────────────────────────────────────────
  const p1 = await api('A', `${LIST}?limit=1`)
  const next = p1.data.nextCursor as string | null
  if (next) {
    const p2 = await api('A', `${LIST}?limit=1&cursor=${encodeURIComponent(next)}`)
    const a = (p1.data.items as Json[])[0]
    const b = (p2.data.items as Json[] | undefined)?.[0]
    check('S4 커서 다음 쪽 — 다른 행·더 이른 시각', p2.status === 200 && !!b && b.id !== a.id && String(b.createdAt) <= String(a.createdAt))
  } else check('S4 커서', null, '발화 2건 미만')

  // ── reviewable 필터 ───────────────────────────────────────
  const rv = await api('A', `${LIST}?reviewable=1&limit=50`)
  const rvItems = (rv.data.items as Json[] | undefined) ?? []
  check(
    'S5 reviewable=1 → 전부 확인 가능 조건',
    rv.status === 200 && rvItems.every((it) => it.status === 'ANALYZED' && it.requiresReview === true && it.finalSource === 'REALTIME' && String(it.realtimeText).trim() !== ''),
    `n=${rvItems.length}`,
  )
  const dbReviewable = await prisma.utterance.count({ where: { userId: uA, status: 'ANALYZED', requiresReview: true, finalSource: 'REALTIME', NOT: { realtimeText: '' } } })
  check('S5a reviewableCount = DB 개수', rv.data.reviewableCount === dbReviewable, `api=${String(rv.data.reviewableCount)} db=${dbReviewable}`)

  // ── chatId 필터·IDOR ──────────────────────────────────────
  const chatA = await prisma.chat.findFirst({ where: { userId: uA }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
  const chatB = await prisma.chat.findFirst({ where: { userId: uB }, select: { id: true } })
  if (chatA) {
    const r = await api('A', `${LIST}?chatId=${chatA.id}&limit=50`)
    const its = (r.data.items as Json[] | undefined) ?? []
    const inChat = its.length ? await prisma.utterance.count({ where: { id: { in: its.map((x) => String(x.id)) }, chatId: chatA.id, userId: uA } }) : 0
    check('S6 내 방 chatId 200 · 전부 그 방 발화', r.status === 200 && inChat === its.length, `n=${its.length}`)
  } else check('S6 내 방 chatId', null, '계정 1 방 없음')
  check('S6a 없는 방 404', (await api('A', `${LIST}?chatId=cnotexist000000000000000`)).status === 404)
  if (chatB) check('S6b 계정 2 의 방을 계정 1 로 → 404', (await api('A', `${LIST}?chatId=${chatB.id}`)).status === 404)
  else check('S6b 남의 방 404', null, '계정 2 방 없음')

  // ── 계정 2 목록에 계정 1 발화 0 ───────────────────────────
  const listB = await api('B', `${LIST}?limit=50`)
  const idsB = new Set(((listB.data.items as Json[] | undefined) ?? []).map((x) => String(x.id)))
  check('S7 계정 2 목록에 계정 1 발화 0', listB.status === 200 && items.every((it) => !idsB.has(String(it.id))))

  // ── #21a·#21b 남의 발화 404(쓰기 없음) ────────────────────
  const uttB = await prisma.utterance.findFirst({ where: { userId: uB, NOT: { status: 'ANALYZED', requiresReview: true, finalSource: 'REALTIME' } }, select: { id: true } })
  if (uttB) {
    const patch = await api('A', `${LIST}/${uttB.id}`, { method: 'PATCH', body: JSON.stringify({ choice: 'REALTIME' }) })
    check('S8 계정 2 발화 #21a(계정 1) → 404', patch.status === 404, `status=${patch.status}${patch.status === 409 ? ' ← 소유자 검사 누락 의심' : ''}`)
    check('S8a 계정 2 발화 #21b 원음(계정 1) → 404', (await api('A', `${LIST}/${uttB.id}/audio`)).status === 404)
  } else check('S8 남의 발화 #21a·#21b', null, '계정 2 의 확인 불가 발화 없음')

  // ── #66 voiced ─────────────────────────────────────────────
  const evA = await prisma.evaluation.findFirst({ where: { userId: uA, status: 'DONE' }, orderBy: { completedAt: 'desc' }, select: { id: true } })
  if (evA) {
    const r = await api('A', `/api/v1/evaluations/${evA.id}`)
    const evItems = (r.data.items as Json[] | undefined) ?? []
    check('S9 #66 items[].voiced 가 전부 boolean', r.status === 200 && evItems.length > 0 && evItems.every((it) => typeof it.voiced === 'boolean'))
    check('S9a 음성 출처(REALTIME_STT·SERVER_STT) 답은 voiced=true', evItems.filter((it) => it.inputSource === 'REALTIME_STT' || it.inputSource === 'SERVER_STT').every((it) => it.voiced === true))
    check('S9b 답 없는 문항은 voiced=false', evItems.filter((it) => it.inputSource == null).every((it) => it.voiced === false))
    check('S9c #66 응답에 엔진 문자열 0', !/reazon|whisper|style-?bert|sherpa|transcriptConfidence|engineVersions/i.test(r.text))
  } else check('S9 #66 voiced', null, '계정 1 완료 평가 없음')
  const evB = await prisma.evaluation.findFirst({ where: { userId: uB }, select: { id: true } })
  if (evB) check('S9d 계정 2 평가 #66(계정 1) → 404', (await api('A', `/api/v1/evaluations/${evB.id}`)).status === 404)

  const fail = results.filter((r) => r.ok === false).length
  const skip = results.filter((r) => r.ok === null).length
  console.log(`\n[task012b2-smoke] ${results.length} checks · pass ${results.length - fail - skip} · fail ${fail} · skip ${skip}`)
  process.exitCode = fail ? 1 : 0
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
