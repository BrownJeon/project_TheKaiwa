/**
 * qa-p2c-B 항목 D — 실제 서버(운영 빌드·실제 LLM·시드 상황)에서 역할극 품질·지연을 잰다. 합성 학습자 발화만 사용(개인 데이터 없음).
 *   PASS=1: 상황 5개 × 6턴 — 역할극 대화와 일반 TALK 대화를 **턴마다 번갈아**(앞뒤 순서도 번갈아) 같은 말로 보낸다 → 첫 조각(첫 audio) p50/p95·짝 비교 + 종료 판정
 *   PASS=2: 상황 5개(다른 시드) × 6턴 — 역할극만(마지막 상황은 "약한 학습자": 내용 없는 대답) → 종료 판정 분포·표현 인식·rejectedClaims
 * 매 턴 앞에 음성 사용 흉내: `POST /api/v1/speech/ticket {TURN}`(→ 서버가 LLM 예열) 후 WARMUP_MS(기본 2000) 기다렸다가 턴을 보낸다(두 팔 같은 조건).
 * 사용: BASE=http://127.0.0.1:3034 SERVER_PID=<pid> PASS=1|2 OUT=<json> node --env-file=.env --import tsx tests/live/p2c-qa/b-roleplay-quality.ts <QA4 쿠키>
 * 한도 신호(429·session limit)가 보이면 즉시 중단. 정리는 final-cleanup + b-state restore.
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../../src/modules/infra/db'
import { api, claudeOthers, cookieOf, doneOf, num, obj, sleep, startTurn, type Json } from './b-lib'

const C4 = cookieOf(process.argv[2])
const PASS = Number(process.env.PASS ?? 1)
const OUT = process.env.OUT ?? '/tmp/b-d-results.json'
const WARMUP_MS = Number(process.env.WARMUP_MS ?? 2000)
const GAP_MS = Number(process.env.GAP_MS ?? 1200)
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const LIMIT_RE = /session limit|usage limit|hit your|limit reached|overloaded/i

const SCRIPTS1: Record<string, string[]> = {
  'self-intro-likes': ['私は映画が好きです。', 'とてもおもしろいです。', '休みの日によく料理をします。', 'あなたは何が好きですか。', 'いいですね。私もやってみたいです。', 'ありがとうございます。楽しかったです。'],
  'cafe-order-drink': ['すみません、ラテをください。', 'ホットでお願いします。', '大きいサイズでお願いします。', 'ケーキも一つください。', 'はい、お願いします。', 'ありがとうございます。'],
  'directions-station-exit': ['すみません、東口はどこですか。', 'A3出口ですか。ここから遠いですか。', 'まっすぐ行って、右ですね。', 'はい、わかりました。', '助かりました。', 'ありがとうございました。'],
  'travel-story-tell': ['先週、大阪に行ってきました。', '城の写真をたくさん撮りました。', '景色がとてもきれいでした。', '思ったより人が多かったです。', '駅の近くのホテルに泊まりました。', 'とても楽しかったです。また行きたいです。'],
  'weekend-plan-invite': ['今度の土曜日、映画を見に行きませんか。', '土曜日は大丈夫ですか。', 'そうですか。日曜日ならいいです。', 'では、日曜日に行きましょう。', '何時に会いましょうか。', '楽しみにしています。'],
}
const SCRIPTS2: Record<string, string[]> = {
  'self-intro-first-meeting': ['はじめまして。', '私の名前はキムです。', '会社員です。', 'ソウルに住んでいます。', 'よろしくお願いします。', 'ありがとうございます。'],
  'cafe-order-takeout': ['コーヒーをお願いします。', 'やっぱり持ち帰りにしてください。', '全部でいくらですか。', 'カードでお願いします。', 'ありがとうございました。', 'また来ます。'],
  'directions-recheck': ['すみません、銀行はどこですか。', 'すみません、もう一度お願いします。', 'もう少しゆっくりお願いします。', 'まっすぐ行って、次を右ですね。', 'わかりました。', 'ありがとうございました。'],
  'weekend-plan-tell': ['今週末は映画を見に行きます。', '友だちと一緒に行きます。', 'たぶん土曜日に行きます。', '日曜日は家でゆっくりします。', 'とても楽しみです。', '週末が楽しみですね。'],
  'travel-story-recommend[weak]': ['はい。', 'そうですね。', 'わかりません。', 'うーん。', 'はい。', 'はい。'],
}
const SCRIPTS = PASS === 1 ? SCRIPTS1 : SCRIPTS2
const pct = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] }

interface Row { scenario: string; turn: number; arm: 'ROLE' | 'PLAIN'; order: number; ticket: number; status: number; headMs: number | null; firstAudioMs: number | null; doneMs: number | null; traceId: string | null; err?: string }
const rows: Row[] = []
const finishes: Json[] = []
const chatIds: string[] = []

async function turnArm(arm: 'ROLE' | 'PLAIN', key: string, chat: string, turn: number, text: string, order: number): Promise<Row> {
  const tk = await api(C4, 'POST', '/api/v1/speech/ticket', { chatId: chat, purpose: 'TURN' })
  await sleep(WARMUP_MS)
  const r = startTurn(C4, chat, text)
  const head = await r.head
  const f = await r.finished
  const done = doneOf(f.events)
  const row: Row = { scenario: key, turn, arm, order, ticket: tk.status, status: f.status, headMs: head.at, firstAudioMs: f.firstAudioAt, doneMs: f.doneAt, traceId: typeof done.traceId === 'string' ? done.traceId : null }
  if (f.status !== 200) {
    row.err = JSON.stringify(f.data).slice(0, 160)
    if (LIMIT_RE.test(row.err) || f.status === 429) { console.log(`!! 한도/429 신호 status=${f.status} ${row.err} — 중단`); persist(); process.exit(2) }
  }
  return row
}
function persist(): void { writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), pass: PASS, rows, finishes, chatIds })) }

async function main(): Promise<void> {
  const keys = Object.keys(SCRIPTS).filter((k) => !ONLY.length || ONLY.includes(k))
  console.log(`[b-roleplay-quality] PASS=${PASS} scenarios=${keys.join(',')} others=${claudeOthers()} warmup=${WARMUP_MS}ms`)
  let flip = PASS === 1 ? 0 : 0
  for (const full of keys) {
    const key = full.replace(/\[weak\]$/, '')
    const lines = SCRIPTS[full]
    const rp = await api(C4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: `scn_${key}` })
    const RP = String(rp.data.id ?? '')
    if (!RP) { console.log(`  ! 역할극 시작 실패 ${full} status=${rp.status}`); continue }
    chatIds.push(RP)
    let PL = ''
    if (PASS === 1) {
      const pl = await api(C4, 'POST', '/api/v1/chats', { kind: 'TALK' })
      PL = String(pl.data.id ?? ''); chatIds.push(PL)
    }
    for (let i = 0; i < lines.length; i++) {
      const order = flip++ % 2
      const arms: ('ROLE' | 'PLAIN')[] = PASS === 1 ? (order === 0 ? ['ROLE', 'PLAIN'] : ['PLAIN', 'ROLE']) : ['ROLE']
      for (const arm of arms) {
        const row = await turnArm(arm, full, arm === 'ROLE' ? RP : PL, i + 1, lines[i], order)
        rows.push(row)
        console.log(`  ${full}#${i + 1} ${arm} status=${row.status} firstAudio=${row.firstAudioMs === null ? '-' : Math.round(row.firstAudioMs)}ms done=${row.doneMs === null ? '-' : Math.round(row.doneMs)}ms`)
        persist()
        await sleep(GAP_MS)
      }
    }
    // 종료 판정
    const t0 = Date.now()
    const fin = await api(C4, 'POST', `/api/v1/chats/${RP}/scenario/finish`)
    const ex = obj(fin.data.expressions)
    const rec: Json = { scenario: full, status: fin.status, ms: Date.now() - t0, outcome: fin.data.outcome, goalAchieved: fin.data.goalAchieved, tutorGoalAchieved: fin.data.tutorGoalAchieved, codeRulePassed: fin.data.codeRulePassed, communicationSuccess: fin.data.communicationSuccess, judged: fin.data.judged, turns: fin.data.turns, hintsUsed: fin.data.hintsUsed, selfCorrections: fin.data.selfCorrections, verifiedIds: ex.verifiedIds, usedIds: ex.usedIds, missedIds: ex.missedIds, required: ex.required, total: ex.total, chatId: RP }
    finishes.push(rec)
    console.log(`  → 종료 ${full}: ${fin.status} outcome=${String(fin.data.outcome)} judged=${String(fin.data.judged)} tutor=${String(fin.data.tutorGoalAchieved)} code=${String(fin.data.codeRulePassed)} verified=${JSON.stringify(ex.verifiedIds)} used=${JSON.stringify(ex.usedIds)} (필수 ${String(ex.required)}/${String(ex.total)}) ${Date.now() - t0}ms`)
    persist()
    await sleep(GAP_MS)
  }

  // Trace 수거(지연 기록 — 폴링)
  await sleep(3000)
  const ids = rows.map((r) => r.traceId).filter((x): x is string => !!x)
  const traces = await prisma.requestTrace.findMany({ where: { traceId: { in: ids } }, select: { traceId: true, steps: true, totalMs: true } })
  const byId = new Map(traces.map((t) => [t.traceId, t]))
  const detail: Record<string, Json> = {}
  for (const r of rows) {
    const t = r.traceId ? byId.get(r.traceId) : undefined
    const steps = (Array.isArray(t?.steps) ? t!.steps : []) as Json[]
    const llm = steps.find((s) => s.name === 'LLM') ?? {}
    const prompt = steps.find((s) => s.name === 'PROMPT') ?? {}
    detail[r.traceId ?? `${r.scenario}#${r.turn}${r.arm}`] = { arm: r.arm, scenario: r.scenario, turn: r.turn, llm, prompt, totalMs: t?.totalMs ?? null }
  }
  // 종료 Trace(SCENARIO_VERDICT)
  const fts = await prisma.requestTrace.findMany({ where: { refType: 'scenarioFinish', refId: { in: finishes.map((f) => String(f.chatId)) } }, select: { refId: true, steps: true } })
  for (const f of finishes) {
    const t = fts.find((x) => x.refId === f.chatId)
    const v = ((Array.isArray(t?.steps) ? t!.steps : []) as Json[]).find((s) => s.name === 'SCENARIO_VERDICT')
    f.verdictTrace = v ?? null
  }
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), pass: PASS, rows, finishes, chatIds, detail }))

  // 요약
  const arm = (a: 'ROLE' | 'PLAIN') => rows.filter((r) => r.arm === a && r.status === 200)
  const fa = (a: 'ROLE' | 'PLAIN') => arm(a).map((r) => r.firstAudioMs).filter((v): v is number => typeof v === 'number')
  const dn = (a: 'ROLE' | 'PLAIN') => arm(a).map((r) => r.doneMs).filter((v): v is number => typeof v === 'number')
  console.log('\n## 지연(첫 audio = TTFA, 클라 기준 ms)')
  for (const a of ['ROLE', 'PLAIN'] as const) {
    const x = fa(a)
    if (!x.length) continue
    const warm = arm(a).filter((r) => obj(detail[r.traceId ?? '']?.llm).warm).length
    console.log(`${a}: n=${arm(a).length} firstAudio p50=${Math.round(pct(x, 50))} p95=${Math.round(pct(x, 95))} max=${Math.round(Math.max(...x))} · done p50=${Math.round(pct(dn(a), 50))} p95=${Math.round(pct(dn(a), 95))} · warm 표시 ${warm}/${arm(a).length}`)
  }
  if (PASS === 1) {
    const diffs: number[] = []
    for (const r of arm('ROLE')) { const p = arm('PLAIN').find((x) => x.scenario === r.scenario && x.turn === r.turn); if (p && r.firstAudioMs !== null && p.firstAudioMs !== null) diffs.push(r.firstAudioMs - p.firstAudioMs) }
    console.log(`짝 비교(역할극 − 일반) n=${diffs.length}: 중앙값 ${Math.round(pct(diffs, 50))}ms · 평균 ${Math.round(diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length))}ms · 역할극이 더 느린 짝 ${diffs.filter((d) => d > 0).length}`)
    const firstDelta = (a: 'ROLE' | 'PLAIN') => arm(a).map((r) => num(obj(detail[r.traceId ?? '']?.llm).firstDeltaMs)).filter((v) => v > 0)
    console.log(`LLM firstDeltaMs(Trace) ROLE p50=${Math.round(pct(firstDelta('ROLE'), 50))} p95=${Math.round(pct(firstDelta('ROLE'), 95))} · PLAIN p50=${Math.round(pct(firstDelta('PLAIN'), 50))} p95=${Math.round(pct(firstDelta('PLAIN'), 95))}`)
  }
  console.log('\n## 종료 판정')
  let rej = 0, acc = 0
  for (const f of finishes) {
    const v = obj(f.verdictTrace)
    const r = num(v.rejectedUnknownId) + num(v.rejectedNoQuote) + num(v.rejectedLoose)
    rej += r; acc += num(v.used)
    console.log(`${String(f.scenario)}: outcome=${String(f.outcome)} judged=${String(f.judged)} tutorGoal=${String(f.tutorGoalAchieved)} codeRule=${String(f.codeRulePassed)} verified=${JSON.stringify(f.verifiedIds)} used=${JSON.stringify(f.usedIds)} 필수 ${String(f.required)}/${String(f.total)} · 판정 ${num(v.ms)}ms 시도 ${num(v.attempts)} model=${String(v.model ?? '-')} 인정 ${num(v.used)} · 거절 id/인용없음/느슨 ${num(v.rejectedUnknownId)}/${num(v.rejectedNoQuote)}/${num(v.rejectedLoose)} · 종료 API ${String(f.ms)}ms`)
  }
  console.log(`거절 합계 ${rej} / (인정 ${acc} + 거절 ${rej}) = ${acc + rej ? Math.round((rej / (acc + rej)) * 100) : 0}%`)
  const fm = finishes.map((f) => num(f.ms))
  console.log(`종료 API ms p50=${Math.round(pct(fm, 50))} p95=${Math.round(pct(fm, 95))} (n=${fm.length})`)
}
main().catch((e) => { console.error(e); persist(); process.exitCode = 1 }).finally(() => prisma.$disconnect())
