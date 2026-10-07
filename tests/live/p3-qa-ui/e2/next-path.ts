// /api/auth/google 가 callbackUrl 에 쓰는 sanitizeNextPath 를 직접 호출해 열린 리다이렉트 값이 기본 경로로 막히는지 본다(OAuth 로그인 없이).
import { sanitizeNextPath } from '../../../../src/modules/infra/auth/oauth/next-path'
const T = 'cmuihjozt000dw1dgeo2on2uf'
const ok = '/study/ai/scenario/new?from=manage&topicId=' + T
const cases: [string, boolean][] = [
  [ok, true], ['/study/ai/scenario/scn_cafe-order-drink/variant?from=manage', true],
  ['//evil.example/x', false], ['https://evil.example', false], ['javascript:alert(1)', false], ['/\\evil.example', false], ['/%09/evil.example', false],
  ['/study/ai/scenario/new?topicId=\nabc', false], ['/study/ai/scenario/new?topicId=%0Aabc', true], ['\\\\evil.example', false], ['/../\\evil.example', false],
  ['/study/ai/scenario/new?from=//evil.example&topicId=https://evil.example', true],
]
let bad = 0
for (const [raw, keep] of cases) {
  const out = sanitizeNextPath(raw)
  const same = out === raw || out === new URL(raw, 'http://x.invalid').pathname + new URL(raw, 'http://x.invalid').search
  const safe = out.startsWith('/') && !out.startsWith('//') && !out.includes('\\')
  const pass = safe && (keep ? same : out === '/' || out === sanitizeNextPath(undefined))
  if (!pass) bad++
  console.log(`${pass ? 'PASS' : 'FAIL'} | in=${JSON.stringify(raw).slice(0, 80)} out=${JSON.stringify(out).slice(0, 80)} (기대: ${keep ? '같은 출처 경로 보존' : '기본 경로로 대체'})`)
}
console.log(`== next-path: ${cases.length - bad}/${cases.length} PASS (기본 경로=${JSON.stringify(sanitizeNextPath(undefined))})`)
