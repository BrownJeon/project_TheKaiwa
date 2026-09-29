/**
 * task-012c 서버 2단계 Codex C2 ① — `reason` 저장 전 문장 단위 마스킹(`maskText`). CX-3(쓰기 거부)와 탐지 규칙이 달라 그 밖으로 새는
 * 비밀 모양 조각을 AuditLog·ConfigurationVersion 저장값에서 가린다. 평범한 이유(한국어·일본어·모델 id·cuid)는 그대로.
 * + Codex C2 ② 실측에서 드러난 `$queryRaw` 교착(P2010·1213) 재시도 판정.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskText, MASK } from '../mask'
import { checkReason } from '../reason'
import { recordAudit } from '../audit'
import { isRetryableTxError, type Tx } from '../tx'

/** CX-3 는 통과하지만(쓰기 거부 대상 아님) 마스킹 규칙에는 걸리는 조각들. */
const MASKED: [string, string][] = [
  ['API 교체 pk-live1234567890ab 완료', `API 교체 ${MASK} 완료`],
  ['옛 키 0123456789abcdef0123456789abcdef 폐기', `옛 키 ${MASK} 폐기`],
  ['주소 https://admin:hunter2@example.com/path 로 변경', '주소 https://example.com/path 로 변경'],
  ['콜백 https://example.com/cb?sig=abc123&x=1 확인', `콜백 https://example.com/cb?sig=${MASK}&x=1 확인`],
  ['鍵はpk-live1234567890abです', `鍵は${MASK}です`],
  ['(0123456789abcdef0123456789abcdef).', `(${MASK}).`],
]

const PLAIN = [
  '미리듣기 문장 교체 — 발음이 어색함',
  '発音が不自然なので例文を差し替えます。',
  'zipformer-ja-reazonspeech-2024-08-01-int8 로 교체 cmulypske001xw1m3jt2vjzss',
  'timeoutMs 20000 → 15000 (M4 지연 측정 p95 9.8s)',
  'env:HOME_M4_API_KEY 참조로 바꿈',
]

test('maskText — CX-3 는 통과하는 비밀 모양 조각(pk- 접두·32자 hex·URL 자격증명·토큰 쿼리)을 문장 안에서 가린다', () => {
  for (const [raw, want] of MASKED) {
    assert.equal(checkReason(raw, { production: false }).ok, true, `CX-3 통과 전제: ${raw}`)
    assert.equal(maskText(raw), want, raw)
  }
  assert.equal(maskText('토큰 갱신 Bearer abcdefghijklmnop 끝'), `토큰 갱신 Bearer ${MASK} 끝`)
})

test('maskText — 평범한 이유(한국어·일본어·모델 id·cuid·credentialRef 이름·숫자)는 바이트 그대로', () => {
  for (const s of PLAIN) assert.equal(maskText(s), s)
  assert.equal(maskText(''), '')
  assert.equal(maskText(`이미 ${MASK} 인 값`), `이미 ${MASK} 인 값`)
})

test('recordAudit — reason 은 저장 직전 maskText(모든 호출자 자동 적용), 평범한 이유는 그대로', async () => {
  const saved: Record<string, unknown>[] = []
  const tx = { auditLog: { create: async (args: { data: Record<string, unknown> }) => (saved.push(args.data), { id: `a${saved.length}` }) } } as unknown as Tx
  const base = { environment: 'LOCAL' as const, actor: null, action: 'config.apply' }
  await recordAudit({ ...base, reason: MASKED[0][0] }, tx)
  await recordAudit({ ...base, reason: PLAIN[1] }, tx)
  await recordAudit({ ...base, reason: null }, tx)
  assert.equal(saved[0].reason, MASKED[0][1])
  assert.equal(saved[1].reason, PLAIN[1])
  assert.equal(saved[2].reason, null)
  assert.ok(!JSON.stringify(saved).includes('pk-live'))
})

test('withTransaction 재시도 판정 — P2034 와 $queryRaw 안의 교착(P2010·meta.code 1213)만, 잠금 대기 초과(1205)·다른 raw 오류는 아님', () => {
  assert.equal(isRetryableTxError({ code: 'P2034' }), true)
  assert.equal(isRetryableTxError({ code: 'P2010', meta: { code: '1213', message: 'Deadlock found' } }), true)
  assert.equal(isRetryableTxError({ code: 'P2010', meta: { code: 1213 } }), true)
  assert.equal(isRetryableTxError({ code: 'P2010', meta: { code: '1205' } }), false)
  assert.equal(isRetryableTxError({ code: 'P2002' }), false)
  assert.equal(isRetryableTxError(null), false)
})
