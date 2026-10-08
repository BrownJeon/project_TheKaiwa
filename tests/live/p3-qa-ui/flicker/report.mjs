/**
 * measure.mjs 결과 JSON → 마크다운 요약. node report.mjs <결과.json> <mode> [키]
 *   mode=summary  : 탭별 상태 수·나쁜 상태 ms·점프·누름 반응·네트워크 (모든 실행)
 *   mode=blocks   : 키(예 1:390:none)의 탭별 최종 화면 블록 트리 (깊이 DEPTH, 기본 3)
 *   mode=heights  : 세 폭 × 계정의 탭별 최종 최상위 블록 높이 표
 *   mode=states   : 키의 탭 하나(TAB)의 상태 순서 원본
 */
import { readFileSync } from 'node:fs'
const [file, mode = 'summary', keyArg] = process.argv.slice(2)
const R = JSON.parse(readFileSync(file, 'utf8'))
const TABS = ['회화', '오늘', '계획표', '단어장', '질문']
const b20 = (h) => Math.round(h / 20) * 20
const catKey = (s) => `${s.p}|${s.a}|L${+s.L}|S${+s.S}|B${+s.B}|E${s.E.length}|C${s.C.length}|h${b20(s.h)}|${s.tb ? 'tab' : 'NOTAB'}`
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
const mm = (a) => (a.length ? `${Math.min(...a)}–${Math.max(...a)}${a.length > 2 ? ` (중앙 ${med(a)})` : ''}` : '-')

function analyse(t) {
  const post = t.states.filter((s) => s.t >= 0)
  const fin = t.final
  const finE = new Set(fin.E); const finC = new Set(fin.C)
  // 상태 목록(연속 중복 제거)
  const cats = []
  for (let i = 0; i < post.length; i++) {
    const k = catKey(post[i]); const end = i + 1 < post.length ? post[i + 1].t : t.stableAt
    const dur = Math.max(0, end - post[i].t)
    const last = cats[cats.length - 1]
    if (last && last.k === k) last.dur += dur
    else cats.push({ k, s: post[i], t: post[i].t, dur })
  }
  let loadMs = 0, fakeEmptyMs = 0, fakeCtaMs = 0, badUnionMs = 0
  for (let i = 0; i < post.length; i++) {
    const s = post[i]; const end = i + 1 < post.length ? post[i + 1].t : s.t // 마지막(최종) 상태의 지속은 세지 않는다
    const dur = Math.max(0, end - s.t)
    const isLast = i === post.length - 1
    if (isLast) continue
    const fe = s.E.some((x) => !finE.has(x)); const fc = s.C.some((x) => !finC.has(x))
    if (s.L) loadMs += dur
    if (fe) fakeEmptyMs += dur
    if (fc) fakeCtaMs += dur
    if (s.L || fe || fc) badUnionMs += dur
  }
  const ft = t.firstTarget
  const hs = post.filter((s) => s.p && s.main).map((s) => s.h)
  return {
    nStates: cats.length, nRaw: post.length, loadMs, fakeEmptyMs, fakeCtaMs, badUnionMs,
    stableAt: t.stableAt, tAct: t.tAct, tPath: t.tPath, first: t.firstChangeAfterDown,
    jump: ft ? Math.round(fin.h - ft.h) : null, firstH: ft?.h ?? null, finalH: fin.h,
    spread: hs.length ? Math.max(...hs) - Math.min(...hs) : null,
    clsAll: t.clsAll, clsNoRecent: t.clsNoRecent,
    api: t.net.filter((n) => n.k === 'api').length, apiNames: [...new Set(t.net.filter((n) => n.k === 'api').map((n) => n.u.replace('/api/v1/', '')))],
    rsc: t.net.filter((n) => n.k === 'rsc').length, nextAssets: t.net.filter((n) => n.k === 'next').length,
    rscEnd: Math.max(0, ...t.net.filter((n) => n.k === 'rsc').map((n) => n.e ?? 0)),
    apiEnd: Math.max(0, ...t.net.filter((n) => n.k === 'api').map((n) => n.e ?? 0)),
    cats, finalPath: fin.p,
  }
}

const blocksOf = (dump) => {
  // main 아래에서 자식이 2개 이상인 첫 노드까지 내려가 그 자식들을 최상위 블록으로 본다.
  let n = dump; const path = []
  while (n && n.k && n.k.length === 1) { path.push(n.s); n = n.k[0] }
  return n?.k ?? []
}

// 화면 본문 블록: main 의 첫 자식(앱바 header)을 건너뛴 본문 div 에서 자식이 2개 이상인 첫 노드까지 내려가 그 자식들을 반환한다.
const bodyOf = (dump) => {
  if (!dump?.k) return { body: null, blocks: [] }
  const rest = dump.k.filter((c) => !c.s.startsWith('header'))
  let n = rest[0] ?? null; const bodyTop = n
  while (n && n.k && n.k.length === 1) n = n.k[0]
  return { body: bodyTop, blocks: n?.k ?? [], header: dump.k.find((c) => c.s.startsWith('header')) ?? null, multi: rest.length }
}
const blk = (b) => `[${b.top},${b.h}${b.n ? `×${b.n}(${b.hmin}-${b.hmax})` : ''}]`

function fmt(node, depth, max, indent = '') {
  if (!node) return ''
  const cnt = node.n ? ` ×${node.n}(h ${node.hmin}–${node.hmax})` : ''
  let line = `${indent}${node.s.slice(0, 54)} top=${node.top} h=${node.h} w=${node.w}${cnt}${node.tx ? ` "${node.tx}"` : ''}\n`
  if (node.k && depth < max) for (const c of node.k) line += fmt(c, depth + 1, max, indent + '  ')
  return line
}

const lastInto = (run, label) => [...run.transitions].reverse().find((t) => t.label === label)
const allInto = (run, label) => run.transitions.filter((t) => t.label === label)

if (mode === 'summary') {
  for (const key of Object.keys(R.runs)) {
    const run = R.runs[key]
    if (run.error) { console.log(`\n### ${key} ERROR ${run.error}`); continue }
    console.log(`\n### 실행 ${key} (계정:폭:스로틀)`)
    console.log('| 탭(출발) | 상태수 | 로딩문구ms | 가짜빈상태ms | 가짜CTAms | 나쁜합ms | 안정까지ms | 활성표시ms | 주소변경ms | 점프px(첫→최종 h) | 높이변동폭 | CLS전체/제외 | API수 | RSC끝ms | API끝ms | 정적자원 |')
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const label of TABS) for (const t of allInto(run, label)) {
      const a = analyse(t)
      console.log(`| ${label}(${t.from}) | ${a.nStates} | ${a.loadMs} | ${a.fakeEmptyMs} | ${a.fakeCtaMs} | ${a.badUnionMs} | ${a.stableAt} | ${a.tAct} | ${a.tPath} | ${a.jump}(${a.firstH}→${a.finalH}) | ${a.spread} | ${a.clsAll}/${a.clsNoRecent} | ${a.api} | ${a.rscEnd} | ${a.apiEnd} | ${a.nextAssets} |`)
    }
  }
} else if (mode === 'states') {
  const run = R.runs[keyArg]; const label = process.env.TAB
  for (const t of allInto(run, label)) {
    console.log(`\n## ${keyArg} ${t.from}→${label} 안정 ${t.stableAt}ms 활성 ${t.tAct} 주소 ${t.tPath} CLS ${t.clsAll}/${t.clsNoRecent}`)
    for (const s of t.states) console.log(`  ${String(s.t).padStart(5)}ms ${s.p} a=${s.a} L=${+s.L} S=${+s.S} B=${+s.B} h=${s.h} kids=${s.kids} E=${JSON.stringify(s.E)} C=${JSON.stringify(s.C.slice(0, 6))}`)
    console.log('  net: ' + t.net.map((n) => `${n.k}:${n.u.replace('/api/v1/', '').slice(0, 24)}@${n.s}-${n.e}`).join(' | '))
  }
} else if (mode === 'blocks') {
  const run = R.runs[keyArg]; const depth = Number(process.env.DEPTH ?? 3)
  for (const label of TABS) {
    const t = lastInto(run, label); if (!t) continue
    console.log(`\n## ${keyArg} ${label} 최종(h=${t.final.h}) 첫 프레임(h=${t.firstTarget?.h})`)
    console.log('--- 최종'); process.stdout.write(fmt(t.final.dump, 0, depth))
    if (process.env.FIRST) { console.log('--- 첫 프레임'); process.stdout.write(fmt(t.firstTarget?.dump, 0, depth)) }
  }
} else if (mode === 'heights') {
  for (const label of TABS) {
    console.log(`\n#### ${label} — 최종 안정 화면 최상위 블록 [top,h] (main 스크롤 높이 포함)`)
    for (const acct of [1, 2]) for (const net of ['none', 'slow']) {
      const row = []
      for (const w of [360, 390, 412]) {
        const run = R.runs[`${acct}:${w}:${net}`]; const t = run && !run.error ? lastInto(run, label) : null
        if (!t) { row.push(`${w}: -`); continue }
        { const bo = bodyOf(t.final.dump); row.push(`${w}: H=${t.final.h} 앱바${bo.header?.h ?? '-'} 본문${bo.body?.h ?? '-'}(top ${bo.body?.top ?? '-'}) ` + bo.blocks.map(blk).join('')) }
      }
      console.log(`- 계정${acct}·${net}: ` + row.join(' / '))
    }
  }
} else if (mode === 'jump') {
  // 첫 프레임(주소가 바뀐 첫 프레임) 본문 블록 vs 최종 본문 블록 — scrollHeight 가 같아도(뷰포트보다 짧은 화면) 블록 위치·높이 변화를 본다.
  const keys = keyArg ? [keyArg] : Object.keys(R.runs)
  for (const key of keys) {
    const run = R.runs[key]; if (!run || run.error) continue
    console.log(`\n### ${key}`)
    for (const label of TABS) for (const t of allInto(run, label)) {
      const f = bodyOf(t.firstTarget?.dump); const e = bodyOf(t.final.dump)
      const n = Math.min(f.blocks.length, e.blocks.length)
      let maxTop = 0, maxH = 0
      for (let i = 0; i < n; i++) { maxTop = Math.max(maxTop, Math.abs(e.blocks[i].top - f.blocks[i].top)); maxH = Math.max(maxH, Math.abs(e.blocks[i].h - f.blocks[i].h)) }
      console.log(`- ${label}(${t.from}) 본문 ${f.body?.h ?? '-'}→${e.body?.h ?? '-'} (Δ${e.body && f.body ? Math.round((e.body.h - f.body.h) * 10) / 10 : '-'}) · scrollH ${t.firstTarget?.h}→${t.final.h} · 블록수 ${f.blocks.length}→${e.blocks.length} · 공통 ${n}개 중 top 최대이동 ${maxTop} h 최대변화 ${maxH} · 첫 ${f.blocks.slice(0, 5).map(blk).join('')} → 최종 ${e.blocks.slice(0, 5).map(blk).join('')}`)
    }
  }
}
