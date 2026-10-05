/**
 * task-034 QA — 실 엔진(M4 tts-service `/g2p`, 앱의 사전 미리듣기 읽기 확인 경로)로 읽기를 대조한다.
 *   P. 가드 후 hint 가 빠진 문장의 "엔진 기본 읽기"가 맞는지(明日香さん·明日来ます·日本橋駅·山田先生 …) + 옛 동작이 만들던 치환 문장의 읽기(참고)
 *   D. 사전 미리듣기 compare(초안) — 걸리지 않음 / 복합어 항목으로 해소 / USER 한자 이름 트레이드오프 표시
 * 저장·캐시 변화 0(미리듣기는 캐시 우회). 서버 NEW(3011). 사용: node --env-file=.env --import tsx tests/live/task034-qa-g2p.ts <admin> <developer> <super>
 */
import { call, check, cookie, corpus, ENGINE_NAME_RE, NEW, Previewer, summary } from './task034-lib'

const [fa, fd, fs] = process.argv.slice(2)
if (!fa || !fd || !fs) throw new Error('사용: <admin> <developer> <super> 쿠키 파일')
const pv = new Previewer(NEW, [cookie(fa), cookie(fd), cookie(fs)])

interface Side {
  normalizedText: string
  reading: string
  accent: string
  matches: { surface: string; reading: string; scope: string; source: string }[]
}
async function read(text: string, drafts: unknown[] = [], compare = false): Promise<{ status: number; before?: Side; after?: Side | null; dictionaryVersion?: number; raw: string }> {
  const r = await pv.preview(text, drafts, compare)
  if (r.status !== 200) {
    console.log(`  ! ${text} → HTTP ${r.status} ${r.text.slice(0, 160)}`)
    return { status: r.status, raw: r.text }
  }
  return { status: 200, before: r.json.data.before, after: r.json.data.after, dictionaryVersion: r.json.data.dictionaryVersion, raw: r.text }
}
const show = (tag: string, s: Side | null | undefined) => console.log(`   ${tag}: norm「${s?.normalizedText}」 reading「${s?.reading}」 accent「${s?.accent}」 matches=${JSON.stringify(s?.matches.map((m) => `${m.surface}→${m.reading}(${m.source})`))}`)

async function main() {
  const health = await fetch('http://192.168.219.100:8200/health').then((r) => r.text()).catch((e) => `ERR ${e}`)
  console.log(`M4 /health: ${health}`)

  // ── P. 엔진 기본 읽기 ─────────────────────────────────────────────
  console.log('\n## P. 사전 미리듣기 읽기 확인 = M4 /g2p (before 쪽 = 지금 ACTIVE 사전 + 새 가드)')
  const samples: Record<string, Side> = {}
  const order = ['明日香さん', 'アシタ香さん', '明日来ます', '日本橋駅', 'ニホンバシ駅', '山田先生', '山田さん', '明日は晴れです', '明日', '今日明日', '秋葉原駅で会おう', '等々力渓谷', '明日香さんは明日来ます']
  for (const t of order) {
    const r = await read(t)
    if (r.status !== 200 || !r.before) {
      check(`P-${t}`, false, `HTTP ${r.status}`)
      continue
    }
    samples[t] = r.before
    console.log(`  ${t}`)
    show('before', r.before)
  }
  const has = (t: string, re: RegExp) => !!samples[t] && re.test(samples[t].reading)
  check('P1 明日香さん → hint 0 · 엔진 읽기 アスカサン (アシタ 아님)', !!samples['明日香さん'] && samples['明日香さん'].matches.length === 0 && has('明日香さん', /^アスカサン$/) , `「${samples['明日香さん']?.reading}」`)
  check('P2 (참고) 옛 치환 アシタ香さん 의 엔진 읽기는 アスカ 가 아니다 — 옛 결함의 소리 재현', !!samples['アシタ香さん'] && /アシタ/.test(samples['アシタ香さん'].reading) && !/アスカ/.test(samples['アシタ香さん'].reading), `「${samples['アシタ香さん']?.reading}」`)
  check('P3 明日来ます → hint 0 · 엔진 읽기 アシタキマス', !!samples['明日来ます'] && samples['明日来ます'].matches.length === 0 && has('明日来ます', /^アシタキマス$/), `「${samples['明日来ます']?.reading}」`)
  check('P4 日本橋駅 → hint 0 · 엔진 읽기 ニホンバシエキ(사전 빠져도 회귀 없음)', !!samples['日本橋駅'] && samples['日本橋駅'].matches.length === 0 && has('日本橋駅', /^ニホンバシエキ$/), `「${samples['日本橋駅']?.reading}」 / 옛 치환 문장 읽기 「${samples['ニホンバシ駅']?.reading}」`)
  check('P5 山田先生 → hint 0 · 엔진 읽기 ヤマダセンセイ(g2p 표기 ヤマダセンセエ — 長音은 모음 가나로 적힌다)', !!samples['山田先生'] && samples['山田先生'].matches.length === 0 && has('山田先生', /^ヤマダセンセ[ーイエ]$/), `「${samples['山田先生']?.reading}」`)
  check('P6 明日は晴れです → 사전 적용 유지(matches 明日, 읽기 アシタワハレデス)', !!samples['明日は晴れです'] && samples['明日は晴れです'].matches.some((m) => m.surface === '明日') && has('明日は晴れです', /^アシタワハレデス$/), `「${samples['明日は晴れです']?.reading}」`)
  check('P7 明日 단독 → 적용 유지(matches 明日 · アシタ)', !!samples['明日'] && samples['明日'].matches.length === 1 && has('明日', /^アシタ$/), `「${samples['明日']?.reading}」`)
  check('P8 秋葉原駅·等々力渓谷 → hint 0 · 엔진 읽기 アキハバラエキ…/トドロキケイコク(g2p 표기 長音=모음 가나)', samples['秋葉原駅で会おう']?.matches.length === 0 && samples['等々力渓谷']?.matches.length === 0 && has('秋葉原駅で会おう', /^アキハバラエキデアオ[ーオ]$/) && has('等々力渓谷', /^トドロキケ[イエ]コク$/),`「${samples['秋葉原駅で会おう']?.reading}」「${samples['等々力渓谷']?.reading}」`)
  check('P9 明日香さんは明日来ます → hint 0 · 엔진 읽기 アスカサンワアシタキマス', !!samples['明日香さんは明日来ます'] && samples['明日香さんは明日来ます'].matches.length === 0 && has('明日香さんは明日来ます', /^アスカサンワアシタキマス$/), `「${samples['明日香さんは明日来ます']?.reading}」`)
  console.log(`  (참고) 今日明日(시드엔 今日 없음 → 明日 이웃 한자로 hint 0): 「${samples['今日明日']?.reading}」 matches=${samples['今日明日']?.matches.length}`)
  check('P10 今日明日 → 엔진 읽기 キョーアシタ/キョウアシタ 류(결함 없음)', !!samples['今日明日'] && /^キョ[ーウオ]アシタ$/.test(samples['今日明日'].reading), `「${samples['今日明日']?.reading}」`)

  // ── D. compare(초안) ───────────────────────────────────────────────
  console.log('\n## D. 사전 미리듣기 compare — 초안 항목')
  {
    const r = await read('明日香さん', [{ surface: '明日', reading: 'アシタ', scope: 'GLOBAL' }], true)
    console.log('  [明日香さん + 초안 明日=アシタ]')
    show('before', r.before)
    show('after ', r.after)
    check('D1 明日香さん + 초안 明日: after.matches 0(「걸리지 않았어요」 표시 조건) · 읽기 변화 없음', !!r.after && r.after.matches.length === 0 && r.after.reading === r.before?.reading, `after「${r.after?.reading}」`)
  }
  {
    const r = await read('明日香さん', [{ surface: '明日香', reading: 'アスカ', scope: 'GLOBAL' }], true)
    console.log('  [明日香さん + 초안 明日香=アスカ — 복합어를 직접 등록]')
    show('before', r.before)
    show('after ', r.after)
    check('D2 초안 明日香=アスカ: after 에 明日香(DRAFT) 걸림 · 읽기 アスカサン', !!r.after && r.after.matches.some((m) => m.surface === '明日香' && m.source === 'DRAFT') && /^アスカサン$/.test(r.after.reading), `after「${r.after?.reading}」`)
  }
  {
    const r = await read('明日は晴れです', [{ surface: '明日', reading: 'アス', scope: 'GLOBAL' }], true)
    console.log('  [明日は晴れです + 초안 明日=アス — 초안이 같은 키의 저장 항목을 대신]')
    show('before', r.before)
    show('after ', r.after)
    check('D3 초안 明日=アス: 가나 이웃 문장은 정상 적용(before アシタ → after アス)', !!r.before && !!r.after && /^アシタワ/.test(r.before.reading) && /^アスワ/.test(r.after.reading) && r.after.matches.some((m) => m.source === 'DRAFT'), `after「${r.after?.reading}」`)
  }
  for (const [text, expectHit] of [['山田さん', true], ['山田先生', false], ['山田先生と山田さん', false]] as const) {
    const r = await read(text, [{ surface: '山田', reading: 'ヤマダ', scope: 'USER', scopeRefId: 'qa-x', wordType: 'PERSON' }], true)
    console.log(`  [${text} + 초안 山田=ヤマダ(USER)]`)
    show('before', r.before)
    show('after ', r.after)
    check(`D4 [M-2 기록] ${text} + 초안 山田: after.matches ${expectHit ? '1(적용)' : '0(걸리지 않음 표시)'}`, !!r.after && (expectHit ? r.after.matches.length === 1 : r.after.matches.length === 0), `after「${r.after?.reading}」 matches=${r.after?.matches.length}`)
  }

  const joined = corpus.join('\n')
  const hit = joined.match(ENGINE_NAME_RE)
  check('E1 미리듣기 응답 전체에 엔진명·model_id·speaker_id 0건', !hit, hit ? `검출: ${hit[0]}` : `${corpus.length}개 응답 본문`)
  void call
  summary('task034-qa-g2p')
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 2
})
