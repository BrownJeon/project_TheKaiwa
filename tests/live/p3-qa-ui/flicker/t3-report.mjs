/**
 * t3-jump.mjs 결과 JSON → 표. node t3-report.mjs <결과.json> [summary|states] [키] [탭라벨]
 * summary: 실행(계정:폭:스로틀) × 도착 탭(오늘·계획표) 별로 표본 중앙값/범위 — 상태 수 · 안정까지 · 첫 화면 위치 점프(상위 3블록 중 뷰포트 안 블록의 |Δtop| 최대) ·
 *          마지막 블록 높이 변화 · scrollH 첫→최종 · CLS · 보이는 「불러오는 중」 프레임 수 · 자리표시 중 눌리는 버튼 프레임 수.
 */
import { readFileSync } from 'node:fs'
const [file, mode = 'summary', keyArg, tabArg] = process.argv.slice(2)
const R = JSON.parse(readFileSync(file, 'utf8'))
const VIEW_H = { 360: 667, 390: 771, 412: 819 } // 하단 탭을 뺀 main 높이(앱바 포함)
const med = (a) => { const s = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
const rng = (a) => { const s = a.filter((x) => x !== null && x !== undefined); return s.length ? (Math.min(...s) === Math.max(...s) ? `${med(s)}` : `${Math.min(...s)}–${Math.max(...s)}(중앙 ${med(s)})`) : '-' }

function analyse(t, w) {
  const f = t.first; const e = t.final
  const states = t.states.filter((s) => s.p && s.blocks && s.blocks.length)
  // 서명이 같은 연속 상태는 이미 t3-jump 에서 합쳤다 → 개수 = 시각 상태 수(첫 화면 이후). 옛 화면(출발 경로) 상태는 뺀다.
  const target = states.filter((s) => s.p === t.targetPath)
  const nStates = target.length
  const view = VIEW_H[w] ?? 771
  let jump = null; let dh = null
  if (f && e && f.blocks.length && e.blocks.length) {
    const n = Math.min(3, f.blocks.length, e.blocks.length)
    jump = 0
    dh = []
    for (let i = 0; i < n; i++) {
      const tf = f.blocks[i][0]; const te = e.blocks[i][0]
      if (Math.min(tf, te) < view) jump = Math.max(jump, Math.abs(te - tf))
      dh.push(Math.round((e.blocks[i][1] - f.blocks[i][1]) * 10) / 10)
    }
  }
  const post = states.filter((s) => s.p === t.targetPath)
  const loadFrames = post.filter((s) => s.load).length
  // 월 이동 줄(오늘·이전 달·다음 달)은 데이터 없이도 쓰는 진짜 조작이라 가짜 CTA 가 아니다. 챌린지 카드가 먼저 도착한 프레임의 그 카드 버튼도 진짜 데이터다 → 첫 프레임(자리표시만 있는 때)만 본다.
  const REAL_NAV = new Set(['오늘', '이전 달', '다음 달'])
  const fakeCta = post.length && post[0].sk ? post[0].ctas.filter((c) => !REAL_NAV.has(c)).length : 0
  return { nStates, stable: t.stableAt, jump, dh, sh: f && e ? [f.sh, e.sh] : null, cls: t.cls, loadFrames, fakeCta, firstSk: f?.sk ?? null, nBlocks: f && e ? [f.blocks.length, e.blocks.length] : null }
}

const TARGET = { 오늘: '/study/today', 계획표: '/plan' }
if (mode === 'summary') {
  for (const [key, run] of Object.entries(R.runs)) {
    if (run.error) { console.log(`\n### ${key} ERROR ${run.error}`); continue }
    const w = Number(key.split(':')[1])
    console.log(`\n### ${key} (표본 ${run.length})`)
    console.log('| 도착 탭 | 표본 | 상태수 | 안정까지ms | 첫 화면 점프px(상위 3블록 중 뷰포트 안) | 블록별 높이 변화 Δh(첫 3블록) | scrollH 첫→최종 | CLS | 보이는 「불러오는 중」 프레임 | 자리표시 첫 프레임의 진짜 아닌 버튼 수 | 첫 프레임이 자리표시 | 블록 수 첫→최종 |')
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const label of ['오늘', '계획표']) {
      const ts = run.filter((t) => t.label === label).map((t) => ({ ...t, targetPath: TARGET[label] }))
      const a = ts.map((t) => analyse(t, w))
      console.log(`| ${label} | ${a.length} | ${rng(a.map((x) => x.nStates))} | ${rng(a.map((x) => x.stable))} | ${rng(a.map((x) => x.jump))} | ${[0, 1, 2].map((i) => rng(a.map((x) => x.dh?.[i]))).join(' / ')} | ${rng(a.map((x) => x.sh?.[0]))}→${rng(a.map((x) => x.sh?.[1]))} | ${rng(a.map((x) => x.cls))} | ${rng(a.map((x) => x.loadFrames))} | ${rng(a.map((x) => x.fakeCta))} | ${a.filter((x) => x.firstSk).length}/${a.length} | ${rng(a.map((x) => x.nBlocks?.[0]))}→${rng(a.map((x) => x.nBlocks?.[1]))} |`)
    }
  }
} else if (mode === 'states') {
  const run = R.runs[keyArg]
  for (const t of run.filter((x) => x.label === tabArg)) {
    console.log(`\n## ${keyArg} ${t.from}→${t.label} 안정 ${t.stableAt}ms CLS ${t.cls}`)
    for (const s of t.states) console.log(`  ${String(s.t).padStart(5)}ms ${s.p} sk=${+s.sk} load=${+s.load} sh=${s.sh} blocks=${JSON.stringify(s.blocks)} ctas=${JSON.stringify((s.ctas ?? []).slice(0, 5))}`)
  }
}
