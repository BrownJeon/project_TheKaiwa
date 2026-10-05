/**
 * task-036 QA — 새 TALK·CHAT 턴 계약을 SSE 로 직접 받아 본다(구 `conversation.replyReading` 제거, talk@v8·chat@v3).
 *
 * 확인(턴마다): ① SSE `accepted` 첫 번째·`done` 마지막·`error` 0 ② `done.conversation` 키가 정확히 `replyJa`·`replyKo`(옛 키·`reading` 0)
 * ③ DB `ChatMessage`(새 강사 행) `reading IS NULL`·`content === replyJa`·`translation === replyKo`·status DONE ④ #29 응답의 같은 메시지 `reading:null`
 * ⑤ status 경고(`AUDIO_TEXT_MISMATCH`·`CORRECTION_ORIGINAL_MISMATCH`) 0 ⑥ TALK 은 audio ≥1·audioCount 일치.
 * 시작 전에 **옛 방식 메시지**(reading 값이 있는 강사 행 2건 — 배포 전 데이터 모양)를 QA 방에 심어 두고, 끝에 #29 가 그 값을 그대로 돌려주는지·옛 행이 있는
 * 방에서도 새 턴이 정상인지 본다. W1 관찰용으로 RequestTrace `LLM` 단계의 attempts·earlyStop 과 ChatMessage.toolLog.attempt 를 모은다.
 *
 * 실행(우분투 미러): `node --env-file=.env --import tsx tests/live/task036-qa-turns.ts <쿠키> [종류별 턴 수=3]` — BASE(기본 http://127.0.0.1:3011)는 localhost 만.
 * 쿠키는 `tests/live/qa-session.ts` 로 만든 권한 600 파일(QA_ACCOUNT=1·2·admin). Claude CLI = 턴 수 × 2(+1). 끝에 QA 방·Trace 를 지운다. 출력에 쿠키·전사 전문을 찍지 않는다
 * (일본어 합성 입력 문장은 이 파일에 있는 고정 문장이다).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const N = Number(process.argv[3] ?? 3)
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const results: { name: string; ok: boolean; detail: string }[] = []
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const TEXTS: Record<'TALK' | 'CHAT', string[]> = {
  // 오류 1건(行くました) + 정답 문장 — 교정 카드·정답 응답 모두 지나가게 한다.
  TALK: ['昨日映画を見に行くました。', '私は毎日日本語を勉強しています。', '週末に友達とコーヒーを飲みました。', '明日は仕事がありません。'],
  CHAT: ['明日は何をしますか？', '私はコーヒーが好きです。', '日本の料理を作ってみたいです。', '先週の日曜日に公園へ行きました。'],
}

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  return { status: r.status, data: body.data ?? {} }
}

interface TurnResult {
  names: string[]
  done: Record<string, unknown> | null
  error: Record<string, unknown> | null
  warnings: string[]
  audio: { text: string; status: string; chunkIndex: number }[]
  firstAudioMs: number | null
  totalMs: number
  httpStatus: number
}

async function turn(chatId: string, text: string): Promise<TurnResult> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  const out: TurnResult = { names: [], done: null, error: null, warnings: [], audio: [], firstAudioMs: null, totalMs: 0, httpStatus: r.status }
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    out.error = { code: `HTTP${r.status}`, message: (await r.text()).slice(0, 120) }
    out.totalMs = Math.round(performance.now() - t0)
    return out
  }
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (!ev || !d) continue
      const data = JSON.parse(d) as Record<string, unknown>
      out.names.push(ev)
      if (ev === 'done') out.done = data
      if (ev === 'error') out.error = data
      if (ev === 'status' && typeof data.warning === 'string') out.warnings.push(data.warning)
      if (ev === 'audio') {
        out.audio.push({ text: String(data.text ?? ''), status: String(data.status ?? ''), chunkIndex: Number(data.chunkIndex ?? 0) })
        if (out.firstAudioMs === null && data.status === 'OK') out.firstAudioMs = Math.round(performance.now() - t0)
      }
    }
  }
  out.totalMs = Math.round(performance.now() - t0)
  return out
}

interface Obs {
  kind: string
  n: number
  attempt: number | null
  earlyStop: string | null
  llmMs: number | null
  firstSentenceMs: number | null
  totalMs: number
  firstAudioMs: number | null
  status: string
}

async function main(): Promise<void> {
  const chatIds: string[] = []
  const traceIds: string[] = []
  const obs: Obs[] = []
  try {
    for (const kind of ['TALK', 'CHAT'] as const) {
      const chat = await api('POST', '/api/v1/chats', { kind, title: `t036 qa ${kind}` })
      const chatId = String(chat.data.id ?? '')
      check(`${kind} 방 생성`, chat.status === 200 || chat.status === 201, `status=${chat.status}`)
      if (!chatId) throw new Error('채팅방 생성 실패')
      chatIds.push(chatId)
      const row = await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } })
      const userId = row!.userId
      // 옛 방식(task-036 이전) 강사 메시지 2건을 먼저 심는다 — 읽기 값이 있는 행. createdAt 을 과거로 둔다.
      const OLD = [
        { reading: 'そうですね。きょうは なにを しましたか。', content: 'そうですね。今日は何をしましたか。', translation: '그렇군요. 오늘은 뭘 했어요?' },
        { reading: 'いいですね。', content: 'いいですね。', translation: '좋네요.' },
      ]
      const oldIds: string[] = []
      for (let k = 0; k < OLD.length; k++) {
        const u = await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: 'こんにちは。', inputSource: 'TEXT', status: 'DONE', createdAt: new Date(Date.UTC(2026, 9, 1, 0, k, 0)) } })
        const a = await prisma.chatMessage.create({ data: { chatId, userId, role: 'ASSISTANT', status: 'DONE', ...OLD[k], createdAt: new Date(Date.UTC(2026, 9, 1, 0, k, 30)) } })
        oldIds.push(u.id, a.id)
      }
      if (kind === 'TALK') {
        await api('GET', `/api/v1/chats/${chatId}`) // 방 진입 = 예열
        await sleep(3_000)
      }
      const newAssistantIds: string[] = []
      for (let i = 0; i < N; i++) {
        const started = performance.now()
        const text = TEXTS[kind][i % TEXTS[kind].length]
        const t = await turn(chatId, text)
        const tag = `${kind} #${i + 1}`
        check(`${tag} SSE 순서 accepted 첫째·done 마지막·error 0`, t.names[0] === 'accepted' && t.names[t.names.length - 1] === 'done' && t.names.filter((x) => x === 'done').length === 1 && t.error === null, `events=${t.names.join(',')}${t.error ? ` error=${JSON.stringify(t.error).slice(0, 120)}` : ''}`)
        if (!t.done) {
          obs.push({ kind, n: i + 1, attempt: null, earlyStop: null, llmMs: null, firstSentenceMs: null, totalMs: t.totalMs, firstAudioMs: t.firstAudioMs, status: `NO_DONE:${String(t.error?.code ?? '?')}` })
          continue
        }
        const done = t.done
        const conv = (done.conversation ?? {}) as Record<string, unknown>
        const keys = Object.keys(conv).sort()
        check(`${tag} done.conversation 키 = [replyJa, replyKo] 뿐`, JSON.stringify(keys) === JSON.stringify(['replyJa', 'replyKo']), `keys=${keys.join(',')}`)
        const topKeys = Object.keys(done)
        check(`${tag} done 최상위에 reading·replyReading 없음`, !topKeys.some((k) => /reading/i.test(k)), `top=${topKeys.join(',')}`)
        check(`${tag} replyJa·replyKo 비어 있지 않음`, typeof conv.replyJa === 'string' && conv.replyJa.length > 0 && typeof conv.replyKo === 'string' && /[가-힣]/.test(String(conv.replyKo)), `replyJa=${String(conv.replyJa ?? '').length}자`)
        check(`${tag} status 경고 0(AUDIO_TEXT_MISMATCH·CORRECTION_ORIGINAL_MISMATCH)`, !t.warnings.includes('AUDIO_TEXT_MISMATCH') && !t.warnings.includes('CORRECTION_ORIGINAL_MISMATCH'), `warnings=${t.warnings.join(',') || '-'}`)
        if (kind === 'TALK') {
          const ok = t.audio.filter((a) => a.status === 'OK')
          check(`${tag} audio ≥1·audioCount = OK 청크 수`, ok.length >= 1 && Number(done.audioCount) === ok.length, `ok=${ok.length} audioCount=${String(done.audioCount)}`)
          // audio 이벤트는 도착 순서가 chunkIndex 순서와 다를 수 있다(캐시 HIT 가 먼저 도착) — 클라처럼 chunkIndex 로 정렬해 잇는다.
          const joined = [...ok].sort((x, y) => x.chunkIndex - y.chunkIndex).map((a) => a.text).join('')
          const A = joined.replace(/\s/g, '')
          const B = String(conv.replyJa).replace(/\s/g, '')
          let diff = ''
          if (A !== B) {
            const ca = [...A]
            const cb = [...B]
            const k = ca.findIndex((c, idx) => c !== cb[idx])
            diff = ` 첫 차이 idx=${k} audio=U+${(ca[k] ?? '').codePointAt(0)?.toString(16)} replyJa=U+${(cb[k] ?? '').codePointAt(0)?.toString(16)} 주변 audio「${ca.slice(Math.max(0, k - 4), k + 4).join('')}」 replyJa「${cb.slice(Math.max(0, k - 4), k + 4).join('')}」`
          }
          check(`${tag} audio 문장 이음 = replyJa(들리는 것 = 보이는 것)`, A === B, `audio=${joined.length}자 replyJa=${String(conv.replyJa).length}자${diff}`)
        } else {
          check(`${tag} CHAT audio 0`, t.audio.length === 0 && Number(done.audioCount ?? 0) === 0)
        }
        const aid = String(done.assistantMessageId)
        newAssistantIds.push(aid)
        traceIds.push(String(done.traceId ?? ''))
        const m = await prisma.chatMessage.findUnique({ where: { id: aid } })
        check(`${tag} DB 강사 행 reading NULL`, m !== null && m.reading === null, `reading=${JSON.stringify(m?.reading)}`)
        check(`${tag} DB content === replyJa·translation === replyKo·status DONE`, m !== null && m.content === conv.replyJa && m.translation === conv.replyKo && m.status === 'DONE', `status=${m?.status} contentEq=${m?.content === conv.replyJa} translationEq=${m?.translation === conv.replyKo}`)
        const tl = (m?.toolLog ?? {}) as Record<string, unknown>
        // Trace 는 SSE 종료 직후가 아니라 조금 뒤에 기록될 수 있다 — 최대 5s 기다린다.
        let steps: Record<string, unknown>[] = []
        for (let w = 0; w < 10; w++) {
          const trace = await prisma.requestTrace.findUnique({ where: { traceId: String(done.traceId ?? '') } })
          steps = (trace?.steps ?? []) as Record<string, unknown>[]
          if (steps.some((s) => s.name === 'LLM')) break
          await sleep(500)
        }
        const llm = steps.find((s) => s.name === 'LLM')
        obs.push({
          kind,
          n: i + 1,
          attempt: typeof tl.attempt === 'number' ? tl.attempt : null,
          earlyStop: typeof llm?.earlyStop === 'string' ? llm.earlyStop : llm?.earlyStop === null ? 'null' : null,
          llmMs: typeof llm?.ms === 'number' ? llm.ms : null,
          firstSentenceMs: typeof llm?.firstSentenceMs === 'number' ? llm.firstSentenceMs : null,
          totalMs: t.totalMs,
          firstAudioMs: t.firstAudioMs,
          status: 'OK',
        })
        console.log(`   · ${tag} total=${t.totalMs}ms firstAudio=${t.firstAudioMs ?? '-'}ms attempt=${String(tl.attempt ?? '-')} earlyStop=${String(llm?.earlyStop ?? '-')} attempts(trace)=${String(llm?.attempts ?? '-')} llmMs=${String(llm?.ms ?? '-')} corr=${done.correction ? 'Y' : 'N'}`)
        const wait = 6_000 - (performance.now() - started)
        if (wait > 0) await sleep(wait)
      }
      // #29 — 옛 행은 reading 값 그대로, 새 행은 reading null.
      const got = await api('GET', `/api/v1/chats/${chatId}?limit=50`)
      const msgs = (got.data.messages ?? []) as Record<string, unknown>[]
      check(`${kind} #29 200`, got.status === 200, `status=${got.status} messages=${msgs.length}`)
      for (let k = 0; k < OLD.length; k++) {
        const id = oldIds[k * 2 + 1]
        const o = msgs.find((x) => x.id === id)
        check(`${kind} #29 옛 메시지 ${k + 1} reading 값 그대로`, !!o && o.reading === OLD[k].reading && o.content === OLD[k].content && o.translation === OLD[k].translation, `reading=${JSON.stringify(o?.reading)}`)
      }
      for (const aid of newAssistantIds) {
        const o = msgs.find((x) => x.id === aid)
        check(`${kind} #29 새 메시지 reading:null (${aid.slice(-6)})`, !!o && o.reading === null && 'reading' in o, `reading=${JSON.stringify(o?.reading)} hasKey=${!!o && 'reading' in o}`)
      }
      // 옛 방에서도 새 턴이 정상이었는지(위 SSE·DB 확인이 같은 방에서 돌았다) — 방의 메시지 수 = 심은 4 + 새 2N.
      const total = await prisma.chatMessage.count({ where: { chatId } })
      check(`${kind} 방 메시지 수 = 옛 4 + 새 ${2 * newAssistantIds.length}`, total === 4 + 2 * newAssistantIds.length, `count=${total}`)
    }
    // 집계(W1 관찰용)
    const valid = obs.filter((o) => o.status === 'OK')
    const a2 = valid.filter((o) => (o.attempt ?? 1) >= 2).length
    const retry = valid.filter((o) => o.earlyStop === 'RETRY').length
    console.log(`\n관찰(W1): 턴 ${valid.length}/${obs.length} · toolLog.attempt≥2 ${a2} · LLM earlyStop='RETRY' ${retry}`)
    console.log('| 종류 | n | 첫 audio ms | 총 ms | LLM ms | attempt | earlyStop |')
    console.log('|---|---|---|---|---|---|---|')
    for (const o of obs) console.log(`| ${o.kind} | ${o.n} | ${o.firstAudioMs ?? '-'} | ${o.totalMs} | ${o.llmMs ?? '-'} | ${o.attempt ?? '-'} | ${o.earlyStop ?? '-'} |`)
  } finally {
    await prisma.requestTrace.deleteMany({ where: { traceId: { in: traceIds.filter(Boolean) } } })
    for (const id of chatIds) {
      const r = await api('DELETE', `/api/v1/chats/${id}`).catch(() => ({ status: 0, data: {} }))
      if (r.status !== 200) await prisma.chat.delete({ where: { id } }).catch(() => undefined)
    }
    await prisma.$disconnect()
  }
  const fail = results.filter((r) => !r.ok)
  console.log(`\n결과: PASS ${results.length - fail.length} / ${results.length}${fail.length ? ` · FAIL ${fail.length}` : ''}`)
  if (fail.length) process.exit(1)
}

main().catch((e) => {
  console.error('QA 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  process.exit(1)
})
