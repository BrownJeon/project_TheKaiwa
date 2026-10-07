/** qa-045-b1 항목 3(+4①) — #177 동시성. A: 같은 사용자 7건 동시(=200 1·409 5·429 1 기대, LLM 1회). B: #177 + #166(인라인 주제) 동시(락 분리 → 둘 다 200, LLM 2회). 사용법: SP=<scratchpad> node item3-busy.mjs <cookie> <log> <A|B> */
import { readFileSync } from 'node:fs'
import { api, cookieOf, check, summary, errCode, reason } from './lib.mjs'
const [, , cookieFile, log, phase] = process.argv
const cookie = cookieOf(cookieFile)
const llmCount = () => (readFileSync(`${process.env.SP}/qa045b-dev.log`, 'utf8').match(/\[claudeCli\] 완료/g) ?? []).length
const before = llmCount()
const v = (axes) => api(cookie, 'POST', '/api/v1/scenarios/scn_directions-station-exit/variants/drafts', { axes }, { log })
if (phase === 'A') {
  const rs = await Promise.all(Array.from({ length: 7 }, () => v({ twist: 'mishear' })))
  const st = rs.map((r) => r.status).sort()
  console.log(`A statuses=${JSON.stringify(st)} ms=${JSON.stringify(rs.map((r) => r.ms))}`)
  check('A 200 1건', st.filter((x) => x === 200).length === 1, JSON.stringify(st))
  const busy = rs.filter((r) => r.status === 409)
  check('A 409 DRAFT_BUSY 5건(reason)', busy.length === 5 && busy.every((r) => reason(r) === 'DRAFT_BUSY'), `n=${busy.length} reasons=${JSON.stringify(busy.map(reason))}`)
  const lim = rs.filter((r) => r.status === 429)
  check('A 429 1건 + Retry-After(분당 6, 7번째)', lim.length === 1 && !!lim[0].retryAfter, `n=${lim.length} retryAfter=${lim[0]?.retryAfter} code=${errCode(lim[0] ?? {})} msg=${lim[0]?.json?.message}`)
  const w = rs.find((r) => r.status === 200)
  check('A 승자 모양', !!w?.json?.data?.draft && !!w.json.data.changedFields, '')
  // 락 해제 후 같은 사용자 재요청은 한도(분당 6) 때문에 429 일 수 있어 여기서는 하지 않는다 — B 단계에서 확인
  console.log(`LLM invocations during A: ${llmCount() - before}`)
}
if (phase === 'B') {
  const desc = { description: '병원에서 접수하고 증상을 설명하는 상황', level: 'N4', topic: { title: '병원 진료', titleJa: '病院' } }
  const t0 = Date.now()
  const [a, b] = await Promise.all([v({ persona: 'kind' }), api(cookie, 'POST', '/api/v1/scenarios/drafts', desc, { log })])
  console.log(`B #177=${a.status} ${a.ms}ms · #166 inline=${b.status} ${b.ms}ms (wall ${Date.now() - t0}ms)`)
  check('B 락 분리: #177 200', a.status === 200, `status=${a.status} reason=${reason(a)}`)
  check('B 락 분리: #166 인라인 주제 200', b.status === 200 && !!b.json?.data?.draft, `status=${b.status} reason=${reason(b)} msg=${b.json?.message}`)
  const d = b.json?.data?.draft
  if (d) {
    console.log(`  166 draft: title=${d.title}/${d.titleJa} level=${d.level} roles=${d.roles?.learner}/${d.roles?.tutor} topicIds=${JSON.stringify(d.topicIds)} expr=${(d.keyExpressions ?? []).map((e) => e.ja).join(' ; ')}`)
    console.log(`  166 steps=${(d.steps ?? []).map((s) => s.ko).join(' | ')} opening=${d.opening?.ja}`)
    check('B #166 표현 id 없음·행 생성 0은 별도 확인', (d.keyExpressions ?? []).every((e) => e.id === undefined), '')
    check('B #166 인라인 주제는 topicIds 로 새지 않음(저장 전 주제)', !d.topicIds || d.topicIds.length === 0, JSON.stringify(d.topicIds))
  }
  const conflict = await api(cookie, 'POST', '/api/v1/scenarios/drafts', { ...desc, topicId: 'cmuihjs9h000qw1dgthvl3fxn' }, { log })
  check('B #166 topic+topicId 동시 → 400 topic/conflict', conflict.status === 400 && conflict.json?.data?.details?.field === 'topic' && conflict.json?.data?.details?.reason === 'conflict', `status=${conflict.status} details=${JSON.stringify(conflict.json?.data?.details)} msg=${conflict.json?.message}`)
  const bad = await api(cookie, 'POST', '/api/v1/scenarios/drafts', { ...desc, topic: { title: '<b>병원</b>' } }, { log })
  check('B #166 인라인 주제 꺾쇠 → 400 topic.title', bad.status === 400 && bad.json?.data?.details?.field === 'topic.title', `status=${bad.status} details=${JSON.stringify(bad.json?.data?.details)}`)
  console.log(`LLM invocations during B: ${llmCount() - before}`)
}
summary()
