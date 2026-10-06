/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * task-039 QA — 제안→채택 원칙과 새 칸의 불변: 합성 교정 3건(추가 설명 있음 2·null 1, QA 계정 소유·DB 로 심음)을 채택(+단어 추가)·채택(단어 없음)·무시하며
 * ① 채택 전 WordEntry·StudyLog 0 ② 채택(addWord) 뒤 WordEntry 1(source=CORRECTION·sourceRefId=교정)·StudyLog 0(교정 accept 는 StudyLog 를 만들지 않는다 — api-contract #35)
 * ③ 채택·무시 뒤에도 original·corrected·explanation·extraNoteKo 불변(DB·#34 모두) ④ 재채택·채택 뒤 무시 = 409 ⑤ 타 사용자(qa-bot2)는 같은 교정 조회·채택 404
 * 실행: BASE=http://127.0.0.1:3030 node --env-file=.env --import tsx tests/live/task039-qa/adopt-check.ts <쿠키1> <쿠키2>
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (/:3010$/.test(BASE)) throw new Error('운영 금지')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
const C1 = readFileSync(process.argv[2], 'utf8').trim()
const C2 = readFileSync(process.argv[3], 'utf8').trim()
const prisma = new PrismaClient()
const res: boolean[] = []
const check = (n: string, ok: boolean, d = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`) }
const api = async (c: string, m: string, p: string, j?: unknown) => { const r = await fetch(BASE + p, { method: m, headers: { Cookie: c, 'Content-Type': 'application/json' }, body: j === undefined ? undefined : JSON.stringify(j) }); const b = (await r.json().catch(() => ({}))) as any; return { status: r.status, data: b.data ?? {} } }
async function main() {
  const chat = await api(C1, 'POST', '/api/v1/chats', { kind: 'TALK', title: 'qa039 adopt' })
  const chatId = chat.data.id as string
  const userId = (await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } }))!.userId
  const spec = [
    { text: '昨日映画を見に行くました。', original: '行くました', corrected: '行きました', extra: '「〜ことになっている」: 규칙·예정' },
    { text: '日本語が話せるために、毎日練習しています。', original: '話せるために', corrected: '話せるように', extra: '〜ように: 목적·능력 (시험 문형)' },
    { text: 'コーヒーを二つをください。', original: '二つを', corrected: '二つ', extra: null },
  ]
  const ids: string[] = []
  for (let k = 0; k < spec.length; k++) {
    const m = await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: spec[k].text, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(Date.now() - 600_000 + k * 60_000) } })
    const c = await prisma.correction.create({ data: { userId, chatId, messageId: m.id, original: spec[k].original, corrected: spec[k].corrected, explanation: `합성 설명 ${k}`, extraNoteKo: spec[k].extra, errorType: 'GRAMMAR', severity: 'MINOR', status: 'PROPOSED' } })
    ids.push(c.id)
  }
  const snap = async () => Object.fromEntries((await prisma.correction.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' } })).map((r) => [r.id, { o: r.original, c: r.corrected, e: r.explanation, x: r.extraNoteKo, s: r.status }]))
  const before = await snap()
  const w0 = await prisma.wordEntry.count({ where: { userId } })
  const l0 = await prisma.studyLog.count({ where: { userId } })
  check('채택 전: 교정 3건 PROPOSED·WordEntry·StudyLog 증가 0', Object.values(before).every((r) => r.s === 'PROPOSED') && w0 === (await prisma.wordEntry.count({ where: { userId } })) && l0 === (await prisma.studyLog.count({ where: { userId } })))
  const a1 = await api(C1, 'POST', `/api/v1/corrections/${ids[0]}/accept`, { addWord: { surface: '行きました(qa039)', meaning: '갔어요', category: '교정', partOfSpeech: 'EXPRESSION' } })
  const w = await prisma.wordEntry.findFirst({ where: { userId, sourceRefId: ids[0] } })
  check('채택(addWord) → 200·WordEntry 1(source=CORRECTION·sourceRefId=교정)·StudyLog 증가 0', a1.status === 200 && !!w && w.source === 'CORRECTION' && (await prisma.wordEntry.count({ where: { userId } })) === w0 + 1 && (await prisma.studyLog.count({ where: { userId } })) === l0, `status=${a1.status}`)
  const a2 = await api(C1, 'POST', `/api/v1/corrections/${ids[1]}/accept`, {})
  check('채택(단어 없음) → 200·WordEntry 추가 0', a2.status === 200 && (await prisma.wordEntry.count({ where: { userId } })) === w0 + 1, `status=${a2.status}`)
  const r3 = await api(C1, 'POST', `/api/v1/corrections/${ids[2]}/reject`)
  check('무시 → 200·WordEntry·StudyLog 추가 0', r3.status === 200 && (await prisma.wordEntry.count({ where: { userId } })) === w0 + 1 && (await prisma.studyLog.count({ where: { userId } })) === l0, `status=${r3.status}`)
  const after = await snap()
  check('채택·무시 뒤 original·corrected·explanation·extraNoteKo 불변(DB)', ids.every((id) => before[id].o === after[id].o && before[id].c === after[id].c && before[id].e === after[id].e && before[id].x === after[id].x), '')
  check('상태 전이: ACCEPTED·ACCEPTED·REJECTED', after[ids[0]].s === 'ACCEPTED' && after[ids[1]].s === 'ACCEPTED' && after[ids[2]].s === 'REJECTED', JSON.stringify(ids.map((i) => after[i].s)))
  const lst = await api(C1, 'GET', `/api/v1/corrections?chatId=${chatId}&limit=50`)
  const items = (lst.data.items ?? []) as any[]
  check('#34 목록의 extraNoteKo 가 채택·무시 뒤에도 같은 값(키 존재)', ids.every((id, k) => { const it = items.find((x) => x.id === id); return !!it && 'extraNoteKo' in it && it.extraNoteKo === spec[k].extra }), '')
  const re = await api(C1, 'POST', `/api/v1/corrections/${ids[0]}/accept`, {})
  const re2 = await api(C1, 'POST', `/api/v1/corrections/${ids[0]}/reject`)
  check('재채택·채택 뒤 무시 → 409', re.status === 409 && re2.status === 409, `${re.status},${re2.status}`)
  const idor = [await api(C2, 'POST', `/api/v1/corrections/${ids[1]}/accept`, {}), await api(C2, 'POST', `/api/v1/corrections/${ids[1]}/reject`)]
  const lst2 = await api(C2, 'GET', `/api/v1/corrections?chatId=${chatId}&limit=50`)
  check('타 사용자(qa-bot2) 채택·무시 404·목록에 안 보임(추가 설명 포함 응답 0건)', idor.every((r) => r.status === 404) && ((lst2.data.items ?? []) as any[]).length === 0, `${idor.map((r) => r.status)} items=${((lst2.data.items ?? []) as any[]).length}`)
  const final = await snap()
  check('타 사용자 시도 뒤에도 행 불변', ids.every((id) => final[id].s === after[id].s && final[id].x === after[id].x))
  // 정리: 채팅(교정 cascade) · 만든 단어 · LearnerErrorStat/관측은 cleanup.ts 로
  await prisma.wordEntry.deleteMany({ where: { userId, sourceRefId: { in: ids } } })
  await prisma.chat.delete({ where: { id: chatId } })
  await prisma.$disconnect()
  console.log(`\n결과: ${res.filter(Boolean).length}/${res.length} PASS`)
  process.exitCode = res.every(Boolean) ? 0 : 1
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
