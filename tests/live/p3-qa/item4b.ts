/** 항목 4 ③ 보충 — item4 의 두 입력이 제목 20자 상한에 먼저 걸려 검사 못 한 XSS 리터럴·카드번호 모양을 짧게/다른 칸으로 다시. 400 만 기대(행 0). QA 계정 3. */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaUser, QA3, summary } from './common'
const j = (v: unknown) => JSON.stringify(v)
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const seed = data(await api(c3, 'GET', '/api/v1/topics?level=all')).items.find((t: any) => t.title === '자기소개')
  const ch = seed.chunks.slice(0, 8).map((x: any) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
  const body = (o: Record<string, unknown> = {}) => ({ title: 'QA 입력', titleJa: '自己紹介', level: 'N5', description: 'QA 설명', chunks: ch, ...o })
  const cases: Array<[string, any, string[]]> = [
    ['title `<img onerror=1>`(15자)', body({ title: '<img onerror=1>' }), ['forbidden_char']],
    ['title 전각 `＜img＞`', body({ title: '＜img src=x＞' }), ['forbidden_char']],
    ['description XSS 리터럴(30자)', body({ description: '"><img src=x onerror=alert(1)>' }), ['forbidden_char']],
    ['description `<script>`', body({ description: '<script>alert(1)</script>' }), ['forbidden_char']],
    ['title 카드번호 모양 19자', body({ title: '4111 1111 1111 1111' }), ['secret_like']],
    ['title 하이픈 카드 19자', body({ title: '4111-1111-1111-1111' }), ['secret_like']],
    ['description 카드번호', body({ description: '카드 4111 1111 1111 1111 입니다' }), ['secret_like']],
    ['description 13자리', body({ description: '번호 1234567890123' }), ['secret_like']],
    ['description URL(http)', body({ description: 'http://evil.example.com' }), ['forbidden_char']],
    ['조각 뜻 XSS', body({ chunks: [{ ...ch[0], meaningKo: '<img onerror=1>' }, ...ch.slice(1)] }), ['forbidden_char', 'chars']],
    ['조각 표기 `<`', body({ chunks: [{ ...ch[0], textJa: '名前<' }, ...ch.slice(1)] }), ['forbidden_char', 'chars']],
    ['titleJa XSS', body({ titleJa: '<img>' }), ['forbidden_char', 'not_japanese']],
  ]
  const miss: string[] = []
  for (const [name, b, reasons] of cases) {
    const r = await api(c3, 'POST', '/api/v1/topics', b)
    const okk = r.status === 400 && code(r) === 'VALIDATION' && reasons.includes(details(r)?.reason)
    console.log(okk ? 'ok  ' : 'MISS', name, r.status, details(r)?.reason, details(r)?.field)
    if (!okk) miss.push(`${name}: status=${r.status} reason=${details(r)?.reason} field=${details(r)?.field}`)
  }
  check('③ XSS 리터럴·카드번호 모양·13자리·URL 12종(제목·설명·조각 칸) 모두 400 VALIDATION', miss.length === 0, miss.join(' | '))
  check('③ 행 0(저장되지 않음)', (await prisma.conversationTopic.count({ where: { userId: u3.id } })) === 0)
  // PATCH 쪽도 같은 검사
  const ok = await api(c3, 'POST', '/api/v1/topics', body({ title: 'QA 패치용' }))
  const pr = await api(c3, 'PATCH', `/api/v1/topics/${data(ok)?.topic?.id}`, { description: '"><img src=x onerror=alert(1)>' })
  check('③ PATCH 설명 XSS 리터럴 → 400(저장 안 됨)', pr.status === 400 && (await prisma.conversationTopic.findUnique({ where: { id: data(ok).topic.id } }))?.description === 'QA 설명', `status=${pr.status} ${j(details(pr))}`)
  console.log('cleanup', j(await cleanupQa(u3.id)))
  summary('item4b')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
