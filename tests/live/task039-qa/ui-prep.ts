/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * task-039 QA 화면 검증용 데이터 준비 — QA 계정(qa-bot)에만.
 *  ① TALK 방(회화방): DB 로 심은 앞선 대화 10쌍(목록을 길게) + **실제 턴 4건**(실 LLM·TTS — 교정 카드가 진짜 경로로 만들어진다) 뒤,
 *     교정 4건의 `Correction.extraNoteKo` 를 QA 가 DB 에서 직접 지정한다(짧은 값·긴 값 200자·null·XSS 리터럴 — 화면 상태를 만들려는 합성) 하고
 *     `toolLog.correction.deliver` 를 정한다(NOW 3·LATER 1 — 유창성 모드는 MINOR 가 LATER 라 상태를 고정).
 *  ② CHAT 방(표현 점검 결과 화면): DB 로 심은 사용자 메시지 4건 + 합성 교정 4건(짧은 값·긴 값·null·XSS) + reviewedAt — 화면은 #34 로 읽는다.
 * 출력: JSON(방 id·교정 id). 정리는 `tests/live/task039-qa/cleanup.ts`. 합성 값은 LLM 출력이 아니다 — 보고서에 그 사실을 적는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('dev localhost 만')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const OUT = process.argv[3] ?? '/tmp/kaiwa-qa039-ui.json'
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SHORT = 'い형용사 과거: 寒い→寒かった'
const LONG_BASE =
  '「〜ことになっている」: 규칙·관례·예정으로 정해져 있다는 뜻의 문형이에요. 동사 사전형 + ことになっている 로 접속하고 회사 규칙이나 일정, 사회 관습을 말할 때 자주 나와요. 비슷한 「〜ことにしている」(스스로 정한 습관)와 구별하고, 「〜ことになる」(결정된 결과)와도 헷갈리지 마세요.'
const pad = (s: string, n: number): string => {
  const a = Array.from(s)
  if (a.length >= n) return a.slice(0, n).join('')
  return s + ' 예: 毎朝走ることになっている。'.repeat(10)
}
const LONG = Array.from(pad(LONG_BASE, 200)).slice(0, 200).join('')
const XSS = '<img src=x onerror="window.__xss=1"> 「〜て<b>い</b>る」: 진행 표현 <script>window.__xss=2</script>'

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: any }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = (await r.json().catch(() => ({}))) as { data?: any }
  return { status: r.status, data: body.data ?? {} }
}
async function turn(chatId: string, text: string): Promise<Record<string, any> | null> {
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  const raw = await r.text()
  if (/session limit|hit your/i.test(raw)) throw new Error('세션 한도 — 중단')
  const m = /event: done\ndata: (.+)/.exec(raw)
  return m ? JSON.parse(m[1]) : null
}

async function main(): Promise<void> {
  const out: Record<string, any> = { longLen: Array.from(LONG).length }
  // ── ① TALK 방 ──
  const talk = await api('POST', '/api/v1/chats', { kind: 'TALK', title: 'qa039 ui talk' })
  const talkId = String(talk.data.id)
  const userId = (await prisma.chat.findUnique({ where: { id: talkId }, select: { userId: true } }))!.userId
  const base = Date.now() - 6 * 3_600_000
  for (let k = 0; k < 10; k++) {
    await prisma.chatMessage.create({ data: { chatId: talkId, userId, role: 'USER', content: `これは準備の発話です。${k + 1}番目のメッセージです。`, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(base + k * 120_000) } })
    await prisma.chatMessage.create({
      data: { chatId: talkId, userId, role: 'ASSISTANT', content: `そうですか。${k + 1}番目ですね。もう少し話してください。`, translation: `그렇군요. ${k + 1}번째네요. 조금 더 이야기해 주세요.`, status: 'DONE', createdAt: new Date(base + k * 120_000 + 30_000) },
    })
  }
  await api('GET', `/api/v1/chats/${talkId}`)
  await sleep(2500)
  const sentences = ['昨日映画を見に行くました。', '私は毎日友達と会いますでした。', '日本語が上手になるために毎日練習するます。', '週末に公園でバーベキューを食べました。']
  const dones: Record<string, any>[] = []
  for (const s of sentences) {
    const d = await turn(talkId, s)
    if (!d) throw new Error('턴 실패')
    dones.push(d)
    await sleep(6500)
  }
  const corrIds: string[] = []
  const userMsgIds: string[] = []
  for (const d of dones) {
    if (d.correction?.id) { corrIds.push(String(d.correction.id)); userMsgIds.push(String(d.userMessageId)) }
  }
  out.talk = { chatId: talkId, corrIds, turns: dones.length, withCorrection: corrIds.length }
  // 값 지정(마지막 턴의 카드를 바닥에 두려고 LONG 을 마지막으로): c0 XSS(LATER) · c1 SHORT(NOW) · c2 null(NOW) · c3 LONG(NOW)
  const plan: { extra: string | null; deliver: 'NOW' | 'LATER' }[] = [
    { extra: XSS, deliver: 'LATER' },
    { extra: SHORT, deliver: 'NOW' },
    { extra: null, deliver: 'NOW' },
    { extra: LONG, deliver: 'NOW' },
  ]
  for (let i = 0; i < corrIds.length && i < plan.length; i++) {
    await prisma.correction.update({ where: { id: corrIds[i] }, data: { extraNoteKo: plan[i].extra } })
    const m = await prisma.chatMessage.findUnique({ where: { id: userMsgIds[i] }, select: { toolLog: true } })
    const tl = (m?.toolLog ?? {}) as Record<string, any>
    tl.correction = { ...(tl.correction ?? { id: corrIds[i], mode: 'FLUENCY', hintKo: null, selfCheck: null }), deliver: plan[i].deliver }
    await prisma.chatMessage.update({ where: { id: userMsgIds[i] }, data: { toolLog: tl } })
  }
  // ── ② CHAT 방(표현 점검 결과) ──
  const chat = await api('POST', '/api/v1/chats', { kind: 'CHAT', title: 'qa039 ui review' })
  const chatId = String(chat.data.id)
  const texts = ['昨日、スーパーで野菜が買いました。', 'コーヒーを二つをください。', '遅れてしまってごめんなさいです。', '日本語が話せるために、毎日練習しています。']
  const ids: string[] = []
  for (let k = 0; k < texts.length; k++) {
    const m = await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: texts[k], inputSource: 'TEXT', status: 'DONE', createdAt: new Date(base + k * 60_000) } })
    ids.push(m.id)
  }
  const spec = [
    { original: '野菜が買いました', corrected: '野菜を買いました', explanation: '「買う」は目的語に「を」を使います。', errorType: 'PARTICLE', chunkType: 'ACTION', extra: SHORT },
    { original: '二つを', corrected: '二つ', explanation: '数量の後ろの「を」は普通は付けません。', errorType: 'PARTICLE', chunkType: 'MODIFIER', extra: LONG },
    { original: 'ごめんなさいです', corrected: 'ごめんなさい', explanation: '「ごめんなさい」にもう一度「です」を付けると不自然です。', errorType: 'NATURALNESS', chunkType: 'FEELING', extra: null },
    { original: '話せるために', corrected: '話せるように', explanation: '能力・状態の目的には「ように」が自然です。', errorType: 'GRAMMAR', chunkType: 'ACTION', extra: XSS },
  ]
  const cids: string[] = []
  for (let k = 0; k < spec.length; k++) {
    const s = spec[k]
    const c = await prisma.correction.create({
      data: { userId, chatId, messageId: ids[k], original: s.original, corrected: s.corrected, explanation: `액션 조각 확인용 합성 설명 ${k + 1}번이에요. ${s.explanation}`, extraNoteKo: s.extra, errorType: s.errorType as any, severity: 'MINOR', chunkType: s.chunkType as any, status: 'PROPOSED' },
    })
    cids.push(c.id)
  }
  await prisma.chat.update({ where: { id: chatId }, data: { messageCount: texts.length, lastMessageAt: new Date(base + 5 * 60_000), reviewedAt: new Date() } })
  out.review = { chatId, corrIds: cids }
  out.userId = userId
  writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8')
  console.log(JSON.stringify(out))
  await prisma.$disconnect()
}
main().catch((e) => {
  console.error('prep 예외:', e instanceof Error ? e.message : String(e))
  process.exitCode = 1
})
