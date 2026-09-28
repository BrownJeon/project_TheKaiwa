/**
 * task-012b 음성 P2(분석 STT) — 적재 게이트·claim(환경 필터·고아 회수)·실패 백오프·펜싱·#138 판정·멱등·#21a 조건부 확정·#22 DTO·D-B7 채점 텍스트.
 * DB 호출은 `analysisDb`·`resolveDb`·`utteranceDb` 를 바꿔 끼워 재현한다(Prisma 위임 객체는 mock.method 로 못 바꾼다). 실제 잠금(SKIP LOCKED)은 라이브 스모크가 본다.
 */
import { after, afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApiError, checkInternalCaller, type Tx } from '@/modules/infra'
import { analysisDb, type ClaimedRow, type LockedJob, type LockedUtterance, type OrphanRow } from '../analysis/db'
import { claimAnalysisJobs, lockClaimable, reportJobFailure } from '../analysis/jobs'
import { applyAnalysisResult } from '../analysis/apply'
import { isAnalysisWorkerAlive, recordWorkerHeartbeat, resetWorkerHeartbeat } from '../analysis/heartbeat'
import {
  answerCameFrom,
  claimDeferral,
  debouncedRunAfter,
  enqueueDelayMs,
  judgeReview,
  nextAfterFailure,
  orphanOutcome,
  pickGradingText,
  reviewThreshold,
  shouldEnqueue,
  wasReviewTarget,
  type GradingUtterance,
} from '../analysis/policy'
import { parseAnalysisBody, parseClaimBody, parseFailureBody } from '../analysis/validate'
import { parseResolveBody, resolveDb, resolveFinalText, toUtteranceView } from '../utterances/review'
import { recordUploadedUtterance, registerGatewayUtterance } from '../utterances'
import { utteranceDb } from '../utterances/store'
import { speechAnswerOverrides } from '../../learning/evaluation/grade'
import { summarizeHealth } from '../../admin/health'

const NOW = 1_790_000_000_000
const QA = 'cqauser000000000000000001'
const REAL = 'crealuser0000000000000001'
const FAKE_TX = {} as Tx

const saved = { ...analysisDb }
const savedResolve = { ...resolveDb }
const savedUtt = { ...utteranceDb }
const savedEnv = process.env.APP_ENV
let root = ''
const savedRoot = process.env.DATA_ROOT

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'kaiwa-task012b-'))
  process.env.DATA_ROOT = root
  globalThis.__kaiwaUtterancePurgeAt = Date.now() + 24 * 60 * 60 * 1000
})
after(async () => {
  process.env.DATA_ROOT = savedRoot
  await rm(root, { recursive: true, force: true })
})
afterEach(() => {
  Object.assign(analysisDb, saved)
  Object.assign(resolveDb, savedResolve)
  Object.assign(utteranceDb, savedUtt)
  process.env.APP_ENV = savedEnv
  resetWorkerHeartbeat()
})

const reasonOf = (e: unknown) => (e instanceof ApiError ? [e.code, e.details?.reason] : ['?', String(e)])

async function rejects(p: Promise<unknown>): Promise<unknown[]> {
  try {
    await p
  } catch (e) {
    return reasonOf(e)
  }
  assert.fail('예외가 나야 한다')
}

// ── 정책(순수) ───────────────────────────────────────────────────────────

test('적재 게이트 4조건 — 하나라도 아니면 적재 안 함', () => {
  const ok = { workerAlive: true, recognitionMode: 'AUTO' as const, analysisConnection: true, hasAudio: true }
  assert.equal(shouldEnqueue(ok), true)
  assert.equal(shouldEnqueue({ ...ok, workerAlive: false }), false)
  assert.equal(shouldEnqueue({ ...ok, recognitionMode: 'OFFLINE' }), false)
  assert.equal(shouldEnqueue({ ...ok, analysisConnection: false }), false)
  assert.equal(shouldEnqueue({ ...ok, hasAudio: false }), false)
  for (const m of ['AUTO', 'FAST', 'ACCURATE'] as const) assert.equal(shouldEnqueue({ ...ok, recognitionMode: m }), true, m)
})

test('새 잡 지연(D-B8 수정): 디바운스 20초가 바닥 — FAST 30초, gateway 파일 여유(10초)는 가려진다', () => {
  assert.equal(enqueueDelayMs('AUTO', 'upload'), 20_000)
  assert.equal(enqueueDelayMs('ACCURATE', 'upload'), 20_000)
  assert.equal(enqueueDelayMs('FAST', 'upload'), 30_000)
  assert.equal(enqueueDelayMs('AUTO', 'gateway'), 20_000)
  assert.equal(enqueueDelayMs('FAST', 'gateway'), 30_000)
})

test('사용자별 디바운스: 마지막 발화 +20초로 미루되 줄이지 않고, 만든 지 5분 지난 잡은 그대로·상한은 createdAt+5분', () => {
  const at = (ms: number) => new Date(NOW + ms)
  assert.deepEqual(debouncedRunAfter({ createdAt: at(-10_000), runAfter: at(10_000) }, NOW), at(20_000))
  assert.equal(debouncedRunAfter({ createdAt: at(-10_000), runAfter: at(600_000) }, NOW), null, '백오프로 더 먼 잡은 당기지 않는다')
  assert.equal(debouncedRunAfter({ createdAt: at(-300_000), runAfter: at(-1) }, NOW), null, '딱 5분 — 더 밀지 않음')
  assert.deepEqual(debouncedRunAfter({ createdAt: at(-290_000), runAfter: at(-1) }, NOW), at(10_000), '상한 createdAt+5분이 now+20초보다 이르면 상한')
  assert.equal(debouncedRunAfter({ createdAt: at(-290_000), runAfter: at(10_000) }, NOW), null)
})

test('재확인 임계: 0.85, ACCURATE 0.90, AppSetting 숫자(0~1)면 그 값 · 판정 = similarity<임계 || flags', () => {
  assert.equal(reviewThreshold('AUTO', null), 0.85)
  assert.equal(reviewThreshold('FAST', null), 0.85)
  assert.equal(reviewThreshold('ACCURATE', null), 0.9)
  assert.equal(reviewThreshold('ACCURATE', 0.7), 0.7)
  assert.equal(reviewThreshold('AUTO', 'x'), 0.85)
  assert.equal(reviewThreshold('AUTO', 1.5), 0.85)
  assert.equal(judgeReview(0.86, [], 0.85), false)
  assert.equal(judgeReview(0.85, [], 0.85), false, '임계와 같으면 재확인 아님')
  assert.equal(judgeReview(0.849, [], 0.85), true)
  assert.equal(judgeReview(0.88, [], 0.9), true, 'ACCURATE 0.90')
  assert.equal(judgeReview(0.99, ['LENGTH_RATIO'], 0.85), true)
})

test('실패 백오프: attempts 1→30초, 2→2분, 3→FAILED · 재시도 불가 코드·retryable=false 는 바로 FAILED', () => {
  const at = (attempts: number, retryable = true, error = 'ANALYSIS_TIMEOUT') => nextAfterFailure({ attempts, maxAttempts: 3, retryable, error }, NOW)
  assert.deepEqual(at(1), { status: 'QUEUED', runAfter: new Date(NOW + 30_000) })
  assert.deepEqual(at(2), { status: 'QUEUED', runAfter: new Date(NOW + 120_000) })
  assert.deepEqual(at(3), { status: 'FAILED' })
  assert.deepEqual(at(1, false), { status: 'FAILED' })
  for (const code of ['AUDIO_MISSING', 'AUDIO_INVALID', 'EMPTY_TRANSCRIPTS', 'READING_UNAVAILABLE']) assert.deepEqual(at(1, true, code), { status: 'FAILED' }, code)
  assert.equal(orphanOutcome(1, 3), 'QUEUED')
  assert.equal(orphanOutcome(3, 3), 'FAILED', '고아 회수도 3회 한도에 포함')
})

const gu = (p: Partial<GradingUtterance> = {}): GradingUtterance => ({
  status: 'ANALYZED',
  requiresReview: false,
  finalText: '昨日行った',
  finalSource: 'REALTIME',
  realtimeText: '昨日行った',
  analysisText: '昨日行きました',
  transcriptConfidence: 0.95,
  snapshot: { reviewThreshold: 0.85, flags: [] },
  ...p,
})

test('D-B7 채점 텍스트: 확정(ANALYSIS·USER·재확인 뒤 REALTIME) > 재확인 불필요 분석 > 그 외 null', () => {
  assert.deepEqual(pickGradingText(gu()), { text: '昨日行きました', inputSource: 'SERVER_STT' })
  assert.equal(pickGradingText(gu({ status: 'QUEUED', analysisText: null, transcriptConfidence: null, snapshot: null })), null, '분석 전')
  assert.equal(pickGradingText(gu({ status: 'FAILED' })), null, '분석 실패')
  assert.equal(pickGradingText(gu({ requiresReview: true, transcriptConfidence: 0.5 })), null, '확정 대기')
  assert.deepEqual(pickGradingText(gu({ finalSource: 'ANALYSIS', finalText: '昨日行きました', transcriptConfidence: 0.5 })), { text: '昨日行きました', inputSource: 'SERVER_STT' })
  assert.deepEqual(pickGradingText(gu({ finalSource: 'USER', finalText: '昨日行ったよ', transcriptConfidence: 0.5 })), { text: '昨日行ったよ', inputSource: 'TEXT' })
  assert.deepEqual(pickGradingText(gu({ transcriptConfidence: 0.5 })), { text: '昨日行った', inputSource: 'REALTIME_STT' }, '재확인 대상이었는데 확정됨 = 실시간 안을 골랐다')
  assert.equal(wasReviewTarget(0.9, { reviewThreshold: 0.85, flags: ['LENGTH_RATIO'] }), true)
  assert.equal(wasReviewTarget(0.5, null), false)
  assert.equal(answerCameFrom(' 昨日行った ', { finalText: null, realtimeText: '昨日行った' }), true)
  assert.equal(answerCameFrom('다른 답', { finalText: '昨日行った', realtimeText: '昨日行った' }), false)
})

test('D-B7 learning 주입: 음성 서술형만 묻고, 다른 것만 덮고, 주입 실패는 저장된 답으로', async () => {
  type Row = Parameters<typeof speechAnswerOverrides>[0][number]
  const item = (id: string, kind: string, answerText: string | null, inputSource: string | null) => ({ id, kind, answerText, inputSource }) as unknown as Row
  const items = [
    item('i1', 'SITUATION_RESPOND', '実時間', 'REALTIME_STT'),
    item('i2', 'SITUATION_RESPOND', '타이핑', 'TEXT'),
    item('i3', 'MEANING_CHOICE', '보기', 'REALTIME_STT'),
    item('i4', 'LISTEN_RESPOND', null, null),
    item('i5', 'CORRECTION_SPOT', '同じ', 'REALTIME_STT'),
  ]
  let asked: string[] = []
  const out = await speechAnswerOverrides(items, async (q) => {
    asked = q.map((x) => x.evaluationItemId)
    return new Map([
      ['i1', { text: '分析 ', inputSource: 'SERVER_STT' as const }],
      ['i5', { text: '同じ', inputSource: 'REALTIME_STT' as const }],
    ])
  })
  assert.deepEqual(asked, ['i1', 'i5'])
  assert.deepEqual([...out], [['i1', { answerText: '分析', inputSource: 'SERVER_STT' }]])
  assert.equal((await speechAnswerOverrides(items, async () => Promise.reject(new Error('db')))).size, 0)
  assert.equal((await speechAnswerOverrides(items, undefined)).size, 0)
})

test('하트비트 120초 창 · health 는 degraded 로만(200)', () => {
  assert.equal(isAnalysisWorkerAlive(NOW), false)
  recordWorkerHeartbeat(NOW)
  assert.equal(isAnalysisWorkerAlive(NOW + 120_000), true)
  assert.equal(isAnalysisWorkerAlive(NOW + 120_001), false)
  const ok = { env_database: true, env_jwt: true, env_google_oauth: true, env_data_root: true, db: true, stt_analysis_worker: false }
  const s = summarizeHealth(ok)
  assert.equal(s.status, 'degraded')
  assert.deepEqual(s.degraded, ['stt_analysis_worker'])
})

test('worker 콜백 인증: 시크릿 없음 MISSING·틀림 INVALID(서비스·환경보다 먼저)·X-Service 다름·X-Service-Env 다름/없음', () => {
  const savedSecret = process.env.SPEECH_INTERNAL_SECRET
  process.env.SPEECH_INTERNAL_SECRET = 'internal-secret-0123456789'
  process.env.APP_ENV = 'LOCAL'
  try {
    const h = (o: Record<string, string>) => new Headers(o)
    const good = { 'x-internal-secret': 'internal-secret-0123456789', 'x-service': 'worker', 'x-service-env': 'LOCAL' }
    assert.equal(checkInternalCaller(h(good), 'worker'), 'OK')
    assert.equal(checkInternalCaller(h({ ...good, 'x-service-env': 'local' }), 'worker'), 'OK', '대소문자 무시')
    assert.equal(checkInternalCaller(h({ 'x-service': 'worker', 'x-service-env': 'LOCAL' }), 'worker'), 'MISSING')
    assert.equal(checkInternalCaller(h({ ...good, 'x-internal-secret': 'nope', 'x-service': 'gateway', 'x-service-env': 'PRODUCTION' }), 'worker'), 'INVALID', '인증 전에는 다른 불일치를 알리지 않는다')
    assert.equal(checkInternalCaller(h({ ...good, 'x-service': 'gateway' }), 'worker'), 'SERVICE_MISMATCH')
    assert.equal(checkInternalCaller(h({ ...good, 'x-service-env': 'PRODUCTION' }), 'worker'), 'ENV_MISMATCH')
    const { ['x-service-env']: _drop, ...noEnv } = good
    void _drop
    assert.equal(checkInternalCaller(h(noEnv), 'worker'), 'ENV_MISMATCH')
    process.env.SPEECH_INTERNAL_SECRET = 'short'
    assert.equal(checkInternalCaller(h(good), 'worker'), 'INVALID', '서버 시크릿이 16자 미만이면 무엇도 통과 못 함')
  } finally {
    process.env.SPEECH_INTERNAL_SECRET = savedSecret
  }
})

// ── 본문 검증 ───────────────────────────────────────────────────────────

test('#139·#140 본문 검증', () => {
  assert.deepEqual(parseClaimBody({ workerId: 'worker-1', kinds: ['ANALYSIS_STT'] }), { workerId: 'worker-1', kinds: ['ANALYSIS_STT'], max: 1 })
  for (const bad of [{ workerId: '../x', kinds: ['ANALYSIS_STT'] }, { workerId: 'w', kinds: [] }, { workerId: 'w', kinds: ['X'] }, { workerId: 'w', kinds: ['ANALYSIS_STT'], max: 3 }, { workerId: 'w', kinds: ['ANALYSIS_STT'], extra: 1 }]) {
    assert.throws(() => parseClaimBody(bad as Record<string, unknown>), ApiError, JSON.stringify(bad))
  }
  assert.deepEqual(parseFailureBody({ workerId: 'w', status: 'FAILED', error: 'ANALYSIS_TIMEOUT', retryable: true }), { workerId: 'w', error: 'ANALYSIS_TIMEOUT', retryable: true })
  assert.throws(() => parseFailureBody({ workerId: 'w', status: 'DONE', error: 'X', retryable: true }), ApiError)
  assert.throws(() => parseFailureBody({ workerId: 'w', status: 'FAILED', error: '昨日の文', retryable: true }), ApiError, '원문 같은 값은 코드가 아니다')
})

const analysisBody = (p: Record<string, unknown> = {}) => ({
  jobId: 'cjob1',
  workerId: 'worker-1',
  analysisEngine: 'analysis-conn',
  analysisText: '昨日行きました',
  segments: [{ start: 0, end: 900, text: '昨日行きました' }],
  language: 'ja',
  latencyMs: 1200,
  comparator: { similarity: 0.7, flags: [], realtimeLen: 5, analysisLen: 7, version: '1.0' },
  pronunciation: null,
  engineVersions: { analysisStt: 'medium', reading: 'pyopenjtalk-0.4.1' },
  traceId: 't_abc',
  ...p,
})

test('#138 본문 검증 — flags enum·similarity 0~1·pronunciation(Phase 3) 거부·판정 스냅샷 칸 덮어쓰기 거부·원문 길이', () => {
  const ok = parseAnalysisBody(analysisBody())
  assert.equal(ok.similarity, 0.7)
  assert.deepEqual(ok.engineVersions, { analysisStt: 'medium', reading: 'pyopenjtalk-0.4.1' })
  const bad: Record<string, unknown>[] = [
    analysisBody({ comparator: { similarity: 1.2, flags: [], version: '1.0' } }),
    analysisBody({ comparator: { similarity: 0.5, flags: ['NOPE'], version: '1.0' } }),
    analysisBody({ comparator: { similarity: 0.5, flags: [], version: '1.0', normalized: 'きのう' } }),
    analysisBody({ pronunciation: { score: 1 } }),
    analysisBody({ engineVersions: { reviewThreshold: 0.1 } }),
    analysisBody({ analysisText: 'あ'.repeat(2001) }),
    analysisBody({ jobId: '../x' }),
    analysisBody({ requiresReview: true }),
  ]
  for (const b of bad) assert.throws(() => parseAnalysisBody(b), ApiError, JSON.stringify(Object.keys(b)))
})

// ── claim ───────────────────────────────────────────────────────────────

function claimRig(queued: string[], orphans: OrphanRow[] = []) {
  const calls: Record<string, unknown[]> = { lockQueued: [], requeueOrphan: [], failOrphan: [], markRunning: [] }
  Object.assign(analysisDb, {
    transaction: async <T>(fn: (tx: Tx) => Promise<T>) => fn(FAKE_TX),
    hasClaimable: async () => true,
    qaUserIds: async () => [QA],
    recognitionModes: async () => new Map([[QA, 'ACCURATE' as const]]),
    orphans: async () => orphans,
    ownStale: async () => [],
    requeueOrphan: async (_tx: Tx, id: string) => (calls.requeueOrphan.push(id), 1),
    failOrphan: async (_tx: Tx, row: OrphanRow) => (calls.failOrphan.push(row.id), 1),
    // 한 번만 준다(한 트랜잭션 안에서 이미 잠근/올린 잡은 다음 라운드에 다시 나오지 않는 DB 동작 흉내).
    lockQueued: async (_tx: Tx, q: unknown) => {
      calls.lockQueued.push(q)
      const out = queued.splice(0).map((id) => ({ id, userId: QA, createdAt: new Date(NOW - 60_000) }))
      return out
    },
    lastUtteranceAt: async () => new Map(),
    deferQueued: async (_tx: Tx, id: string, runAfter: Date) => (calls.deferQueued = [...(calls.deferQueued ?? []), { id, runAfter }], undefined),
    markRunning: async (_tx: Tx, ids: string[], workerId: string) => (calls.markRunning.push({ ids, workerId }), ids.length),
    claimedRows: async (_tx: Tx, ids: string[]): Promise<ClaimedRow[]> =>
      ids.map((id) => ({ id, kind: 'ANALYSIS_STT', attempts: 1, userId: QA, utteranceId: `u-${id}`, audioPath: `users/${QA}/utterances/2026-09/u-${id}.wav`, audioDeletedAt: null, realtimeText: 'こんにちは' })),
  })
  return calls
}

test('claim: 비운영은 QA 계정 잡만(D-B11), 운영은 필터 없음 · 빈 응답도 하트비트 갱신', async () => {
  process.env.APP_ENV = 'LOCAL'
  const calls = claimRig([])
  assert.deepEqual(await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW)), { jobs: [] })
  assert.deepEqual((calls.lockQueued[0] as { userIds: string[] }).userIds, [QA])
  assert.equal(isAnalysisWorkerAlive(NOW + 1000), true, '빈 응답이어도 하트비트')

  process.env.APP_ENV = 'PRODUCTION'
  const c2 = claimRig([])
  await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 2 }, new Date(NOW))
  assert.equal((c2.lockQueued[0] as { userIds: unknown }).userIds, null)
  assert.equal((c2.lockQueued[0] as { max: number }).max, 2)
})

test('claim: QA 계정이 없으면 DB 트랜잭션 없이 빈 응답(비운영)', async () => {
  process.env.APP_ENV = 'LOCAL'
  claimRig(['j1'])
  analysisDb.qaUserIds = async () => []
  analysisDb.transaction = async () => assert.fail('트랜잭션을 열지 않는다')
  assert.deepEqual(await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW)), { jobs: [] })
})

test('claim: 집을 잡·고아가 없으면 트랜잭션 없이 빈 응답(유휴 워커 DB 부하) — 하트비트는 갱신', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  claimRig(['j1'])
  let asked: { cutoff: Date; userIds: unknown } | null = null
  analysisDb.hasClaimable = async (q) => ((asked = q), false)
  analysisDb.transaction = async () => assert.fail('트랜잭션을 열지 않는다')
  assert.deepEqual(await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW)), { jobs: [] })
  assert.equal(asked!.cutoff.getTime(), NOW - 15 * 60_000)
  assert.equal(asked!.userIds, null)
  assert.equal(isAnalysisWorkerAlive(NOW), true)
})

test('claim: 잠근 잡을 RUNNING 으로 넘기고 계약 모양으로 돌려준다(엔진명 없음)', async () => {
  process.env.APP_ENV = 'LOCAL'
  const calls = claimRig(['j1'])
  const r = await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.deepEqual(calls.markRunning, [{ ids: ['j1'], workerId: 'w1' }])
  assert.deepEqual(r.jobs, [{ id: 'j1', kind: 'ANALYSIS_STT', utteranceId: 'u-j1', audioPath: `users/${QA}/utterances/2026-09/u-j1.wav`, realtimeText: 'こんにちは', recognitionMode: 'ACCURATE', attempts: 1 }])
})

test('claim: 같은 워커가 쥔 채 남은 RUNNING(응답 유실)은 15분을 기다리지 않고 되돌린다 — 다른 워커 잡은 건드리지 않음', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  const calls = claimRig([])
  let askedWorker = ''
  analysisDb.ownStale = async (_tx, workerId) => ((askedWorker = workerId), [{ id: 'mine', utteranceId: 'u9', attempts: 1, maxAttempts: 3 }])
  let hasQ: { workerId: string } | null = null
  analysisDb.hasClaimable = async (q) => ((hasQ = q), true)
  await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.equal(askedWorker, 'w1')
  assert.equal(hasQ!.workerId, 'w1', '빈 큐 판정에도 자기 잡을 넣는다')
  assert.deepEqual(calls.requeueOrphan, ['mine'])
})

test('claim M1: 같은 SPEECH_WORKER_ID·다른 nonce(인스턴스 id) 두 워커는 서로의 잡을 되돌리지 않는다 — 정확히 같은 인스턴스만 self-reclaim', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  // 인스턴스 id 가 lockedBy 와 정확히 같을 때만 ownStale 이 행을 준다(DB WHERE lockedBy = :id 흉내).
  const held = [{ id: 'jA', utteranceId: 'uA', attempts: 1, maxAttempts: 3, lockedBy: 'worker-1-aaaa1111' }]
  const calls = claimRig([])
  analysisDb.ownStale = async (_tx, workerId) => held.filter((h) => h.lockedBy === workerId)
  await claimAnalysisJobs({ workerId: 'worker-1-bbbb2222', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.deepEqual(calls.requeueOrphan, [], '다른 인스턴스(같은 base)는 A 의 잡을 건드리지 않음')
  await claimAnalysisJobs({ workerId: 'worker-1-aaaa1111', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.deepEqual(calls.requeueOrphan, ['jA'], '같은 인스턴스의 재claim = 응답 유실 복구')
  // #140 펜싱도 인스턴스 id 정확 일치 — B 의 늦은 실패 보고는 A 가 쥔 잡을 바꾸지 못한다
  failureRig(lockedJob({ lockedBy: 'worker-1-aaaa1111' }))
  assert.deepEqual(await rejects(reportJobFailure('j1', { workerId: 'worker-1-bbbb2222', error: 'X', retryable: true })), ['CONFLICT', 'STALE_CLAIM'])
  assert.deepEqual(parseClaimBody({ workerId: `${'w'.repeat(64)}-abcd1234`, kinds: ['ANALYSIS_STT'] }).workerId.length, 73, '인스턴스 id ≤80자 허용')
  assert.throws(() => parseClaimBody({ workerId: 'w'.repeat(81), kinds: ['ANALYSIS_STT'] }), ApiError)
})

test('claim 재검사 규칙(Codex C2 지적 1): 사용자의 마지막 발화 20초 안이면 미룸(마지막 발화+20초, 상한 createdAt+5분) · 5분 지난 잡·조용한 사용자는 집음', () => {
  const at = (ms: number) => new Date(NOW + ms)
  assert.equal(claimDeferral({ createdAt: at(-60_000) }, null, NOW), null, '최근 발화 없음')
  assert.equal(claimDeferral({ createdAt: at(-60_000) }, at(-20_000), NOW), null, '딱 20초 — 조용해짐')
  assert.deepEqual(claimDeferral({ createdAt: at(-60_000) }, at(-5_000), NOW), at(15_000))
  assert.equal(claimDeferral({ createdAt: at(-300_000) }, at(-1_000), NOW), null, '만든 지 5분 — 상한, 미루지 않음')
  assert.deepEqual(claimDeferral({ createdAt: at(-295_000) }, at(-1_000), NOW), at(5_000), '상한이 더 이르면 상한')
})

test('claim 재검사: 잠근 잡의 사용자가 방금 말했으면 올리지 않고 미룸 · 다른 사용자 잡은 다음 라운드에서 집음 · 트랜잭션 안에서 읽음', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  const calls = claimRig([])
  const OTHER = 'cotheruser000000000000001'
  let round = 0
  analysisDb.lockQueued = async (_tx, q) => {
    calls.lockQueued.push(q)
    round++
    if (round === 1) return [{ id: 'jTalking', userId: QA, createdAt: new Date(NOW - 60_000) }]
    if (round === 2) return [{ id: 'jQuiet', userId: OTHER, createdAt: new Date(NOW - 60_000) }]
    return []
  }
  let since: Date | null = null
  analysisDb.lastUtteranceAt = async (tx, userIds, s) => ((since = s), assert.equal(tx, FAKE_TX), new Map(userIds.includes(QA) ? [[QA, new Date(NOW - 3_000)]] : []))
  const ids = await lockClaimable(FAKE_TX, { workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW), null)
  assert.deepEqual(ids, ['jQuiet'])
  assert.deepEqual(calls.deferQueued, [{ id: 'jTalking', runAfter: new Date(NOW + 17_000) }])
  assert.equal(since!.getTime(), NOW - 20_000)
  // claim 전체로도: 미룬 잡은 RUNNING 으로 올리지 않는다
  const c2 = claimRig([])
  analysisDb.lockQueued = async (_tx, q) => (c2.lockQueued.push(q), c2.lockQueued.length === 1 ? [{ id: 'jT', userId: QA, createdAt: new Date(NOW - 60_000) }] : [])
  analysisDb.lastUtteranceAt = async () => new Map([[QA, new Date(NOW - 1_000)]])
  assert.deepEqual(await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW)), { jobs: [] })
  assert.deepEqual(c2.markRunning, [])
})

test('claim 지적 2: 고아·자기 잡 회수·빈 큐 판정 모두 요청한 종류(kinds)만 본다', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  claimRig([])
  const seen: unknown[] = []
  analysisDb.hasClaimable = async (q) => (seen.push(['has', q.kinds]), true)
  analysisDb.orphans = async (_tx, _c, _u, kinds) => (seen.push(['orphans', kinds]), [])
  analysisDb.ownStale = async (_tx, _w, _u, kinds) => (seen.push(['own', kinds]), [])
  await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.deepEqual(seen, [['has', ['ANALYSIS_STT']], ['orphans', ['ANALYSIS_STT']], ['own', ['ANALYSIS_STT']]])
})

test('claim: 고아 회수 — 한도 남은 잡은 QUEUED, 다 쓴 잡은 FAILED', async () => {
  process.env.APP_ENV = 'PRODUCTION'
  const calls = claimRig([], [
    { id: 'o1', utteranceId: 'u1', attempts: 1, maxAttempts: 3 },
    { id: 'o3', utteranceId: 'u3', attempts: 3, maxAttempts: 3 },
  ])
  await claimAnalysisJobs({ workerId: 'w1', kinds: ['ANALYSIS_STT'], max: 1 }, new Date(NOW))
  assert.deepEqual(calls.requeueOrphan, ['o1'])
  assert.deepEqual(calls.failOrphan, ['o3'])
})

// ── #140 ────────────────────────────────────────────────────────────────

function failureRig(job: LockedJob | null) {
  const calls: Record<string, unknown[]> = { requeue: [], fail: [] }
  Object.assign(analysisDb, {
    transaction: async <T>(fn: (tx: Tx) => Promise<T>) => fn(FAKE_TX),
    qaUserIds: async () => [QA],
    lockJob: async () => job,
    requeueJob: async (_tx: Tx, id: string, runAfter: Date, error: string) => (calls.requeue.push({ id, runAfter, error }), {}),
    failJob: async (_tx: Tx, j: LockedJob, error: string) => (calls.fail.push({ id: j.id, error }), undefined),
  })
  return calls
}

const lockedJob = (p: Partial<LockedJob> = {}): LockedJob => ({ id: 'j1', userId: QA, utteranceId: 'u1', kind: 'ANALYSIS_STT', status: 'RUNNING', lockedBy: 'w1', attempts: 1, maxAttempts: 3, ...p })

test('#140: 재시도면 QUEUED(30초 뒤), 한도·재시도 불가면 FAILED(+발화 FAILED)', async () => {
  process.env.APP_ENV = 'LOCAL'
  let calls = failureRig(lockedJob())
  assert.deepEqual(await reportJobFailure('j1', { workerId: 'w1', error: 'ANALYSIS_UNAVAILABLE', retryable: true }, new Date(NOW)), { ok: true, jobStatus: 'QUEUED' })
  assert.deepEqual(calls.requeue, [{ id: 'j1', runAfter: new Date(NOW + 30_000), error: 'ANALYSIS_UNAVAILABLE' }])
  calls = failureRig(lockedJob({ attempts: 3 }))
  assert.deepEqual(await reportJobFailure('j1', { workerId: 'w1', error: 'ANALYSIS_UNAVAILABLE', retryable: true }, new Date(NOW)), { ok: true, jobStatus: 'FAILED' })
  assert.deepEqual(calls.fail, [{ id: 'j1', error: 'ANALYSIS_UNAVAILABLE' }])
  calls = failureRig(lockedJob())
  assert.equal((await reportJobFailure('j1', { workerId: 'w1', error: 'AUDIO_MISSING', retryable: false }, new Date(NOW))).jobStatus, 'FAILED')
})

test('#140 펜싱: 다른 워커·RUNNING 아님 409 STALE_CLAIM · 없음·비운영에서 실사용자 잡 404', async () => {
  process.env.APP_ENV = 'LOCAL'
  failureRig(lockedJob({ lockedBy: 'w2' }))
  assert.deepEqual(await rejects(reportJobFailure('j1', { workerId: 'w1', error: 'X', retryable: true })), ['CONFLICT', 'STALE_CLAIM'])
  failureRig(lockedJob({ status: 'QUEUED', lockedBy: null }))
  assert.deepEqual(await rejects(reportJobFailure('j1', { workerId: 'w1', error: 'X', retryable: true })), ['CONFLICT', 'STALE_CLAIM'])
  failureRig(null)
  assert.deepEqual(await rejects(reportJobFailure('j1', { workerId: 'w1', error: 'X', retryable: true })), ['NOT_FOUND', undefined])
  failureRig(lockedJob({ userId: REAL }))
  assert.deepEqual(await rejects(reportJobFailure('j1', { workerId: 'w1', error: 'X', retryable: true })), ['NOT_FOUND', undefined])
})

// ── #138 ────────────────────────────────────────────────────────────────

function applyRig(u: LockedUtterance | null, job: { id: string; kind: 'ANALYSIS_STT' | 'PRONUNCIATION'; status: 'RUNNING' | 'QUEUED' | 'DONE' | 'FAILED' } | null, mode: 'AUTO' | 'ACCURATE' = 'AUTO') {
  const stored: Record<string, unknown>[] = []
  Object.assign(analysisDb, {
    transaction: async <T>(fn: (tx: Tx) => Promise<T>) => fn(FAKE_TX),
    qaUserIds: async () => [QA],
    analysisConnectionKey: async (k: string) => (k === 'analysis-conn' ? k : null),
    reviewOverride: async () => null,
    recognitionMode: async () => mode,
    lockUtterance: async () => u,
    jobOfUtterance: async () => job,
    storeAnalysis: async (_tx: Tx, input: Record<string, unknown>) => (stored.push(input), undefined),
  })
  return stored
}

const lockedUtt = (p: Partial<LockedUtterance> = {}): LockedUtterance => ({ id: 'u1', userId: QA, status: 'QUEUED', finalSource: 'REALTIME', requiresReview: false, transcriptConfidence: null, ...p })

test('#138: 앱이 판정 · finalText/finalSource 는 저장 입력에 없다 · 임계·flags 스냅샷', async () => {
  process.env.APP_ENV = 'LOCAL'
  const stored = applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' })
  const r = await applyAnalysisResult('u1', parseAnalysisBody(analysisBody()), new Date(NOW))
  assert.deepEqual(r, { stored: true, utteranceStatus: 'ANALYZED', transcriptConfidence: 0.7, requiresReview: true, finalSource: 'REALTIME' })
  const s = stored[0]
  assert.equal(s.requiresReview, true)
  assert.equal(s.confidence, 0.7)
  assert.ok(!('finalText' in s) && !('finalSource' in s), 'D-B5: 분석만으로 finalText·finalSource 불변')
  assert.deepEqual(s.engineVersions, { analysisStt: 'medium', reading: 'pyopenjtalk-0.4.1', comparator: '1.0', reviewThreshold: 0.85, flags: [], recognitionMode: 'AUTO' })
})

test('#138 ⑫: 이미 학습자가 고친 발화(finalSource=USER)는 낮은 유사도·flags 여도 requiresReview=false — 신뢰도·임계 스냅샷은 그대로 저장', async () => {
  process.env.APP_ENV = 'LOCAL'
  const stored = applyRig(lockedUtt({ finalSource: 'USER' }), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' })
  const r = await applyAnalysisResult('u1', parseAnalysisBody(analysisBody({ comparator: { similarity: 0.2, flags: ['LENGTH_RATIO'], version: '1.0' } })))
  assert.deepEqual([r.stored, r.requiresReview, r.transcriptConfidence, r.finalSource], [true, false, 0.2, 'USER'])
  assert.equal(stored[0].requiresReview, false)
  assert.equal(stored[0].confidence, 0.2)
  const ev = stored[0].engineVersions as Record<string, unknown>
  assert.deepEqual([ev.reviewThreshold, ev.flags], [0.85, ['LENGTH_RATIO']])
})

test('#138: ACCURATE 0.88 → 재확인, AUTO 0.88 → 아님 · flags 있으면 재확인', async () => {
  process.env.APP_ENV = 'LOCAL'
  applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' }, 'ACCURATE')
  const body = analysisBody({ comparator: { similarity: 0.88, flags: [], version: '1.0' } })
  assert.equal((await applyAnalysisResult('u1', parseAnalysisBody(body))).requiresReview, true)
  applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' }, 'AUTO')
  assert.equal((await applyAnalysisResult('u1', parseAnalysisBody(body))).requiresReview, false)
  applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'QUEUED' }, 'AUTO')
  const flagged = analysisBody({ comparator: { similarity: 0.95, flags: ['LENGTH_RATIO'], version: '1.0' } })
  assert.equal((await applyAnalysisResult('u1', parseAnalysisBody(flagged))).requiresReview, true, '회수돼 QUEUED 인 잡의 늦은 결과도 받는다')
})

test('#138 멱등·거부: 이미 ANALYZED → stored:false ALREADY_ANALYZED(저장 없음) · 남의 잡 404 · 끝난 잡 409 · 모르는 connection 400 · 비운영 실사용자 404', async () => {
  process.env.APP_ENV = 'LOCAL'
  let stored = applyRig(lockedUtt({ status: 'ANALYZED', requiresReview: true, transcriptConfidence: 0.5 }), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'DONE' })
  assert.deepEqual(await applyAnalysisResult('u1', parseAnalysisBody(analysisBody())), { stored: false, reason: 'ALREADY_ANALYZED', utteranceStatus: 'ANALYZED', transcriptConfidence: 0.5, requiresReview: true, finalSource: 'REALTIME' })
  assert.equal(stored.length, 0)
  applyRig(lockedUtt(), null)
  assert.deepEqual(await rejects(applyAnalysisResult('u1', parseAnalysisBody(analysisBody()))), ['NOT_FOUND', undefined])
  applyRig(lockedUtt(), { id: 'cjob1', kind: 'PRONUNCIATION', status: 'RUNNING' })
  assert.deepEqual(await rejects(applyAnalysisResult('u1', parseAnalysisBody(analysisBody()))), ['NOT_FOUND', undefined])
  stored = applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'FAILED' })
  assert.deepEqual(await rejects(applyAnalysisResult('u1', parseAnalysisBody(analysisBody()))), ['CONFLICT', 'STALE_CLAIM'])
  applyRig(lockedUtt(), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' })
  assert.deepEqual(await rejects(applyAnalysisResult('u1', parseAnalysisBody(analysisBody({ analysisEngine: 'other' })))), ['VALIDATION', 'UNKNOWN_CONNECTION'])
  applyRig(lockedUtt({ userId: REAL }), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' })
  assert.deepEqual(await rejects(applyAnalysisResult('u1', parseAnalysisBody(analysisBody()))), ['NOT_FOUND', undefined])
  process.env.APP_ENV = 'PRODUCTION'
  applyRig(lockedUtt({ userId: REAL }), { id: 'cjob1', kind: 'ANALYSIS_STT', status: 'RUNNING' })
  assert.equal((await applyAnalysisResult('u1', parseAnalysisBody(analysisBody()))).stored, true, '운영은 실사용자 발화를 처리')
})

// ── 적재(#21·gateway) ────────────────────────────────────────────────────

function wav(ms: number): Buffer {
  const data = Math.round((16_000 * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + data, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(16_000, 24)
  b.writeUInt32LE(32_000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(data, 40)
  return b
}

function enqueueRig(mode: 'AUTO' | 'FAST' | 'OFFLINE' = 'AUTO', target: { id: string; key: string } | null = { id: 'c1', key: 'k' }) {
  const created: Record<string, unknown>[] = []
  Object.assign(analysisDb, { recognitionMode: async () => mode, analysisTarget: async () => target })
  Object.assign(utteranceDb, {
    realtimeConnection: async () => ({ id: 'rc', key: 'rt-conn', connectionType: 'ONDEVICE' }),
    create: async (data: Record<string, unknown>) => (created.push(data), { id: data.id as string }),
    remove: async () => ({}),
  })
  return created
}

const upload = () => ({ audio: wav(500), text: 'こんにちは', chatId: null, lessonId: null, realtimeConnectionKey: 'rt-conn', durationMs: null, segments: null, timings: null }) as unknown as Parameters<typeof recordUploadedUtterance>[1]

test('#21: 워커 없음 → RECORDED·false · 워커 있음 → 같은 쓰기에 잡(QUEUED·true) · OFFLINE·connection 없음 → false', async () => {
  let created = enqueueRig()
  let r = await recordUploadedUtterance(QA, upload())
  assert.equal(r.analysisQueued, false)
  assert.equal(r.status, 'RECORDED')
  assert.equal(created[0].status, 'RECORDED')
  assert.ok(!('jobs' in created[0]))

  recordWorkerHeartbeat()
  created = enqueueRig('AUTO')
  r = await recordUploadedUtterance(QA, upload())
  assert.deepEqual([r.status, r.analysisQueued], ['QUEUED', true])
  const jobs = created[0].jobs as { create: { userId: string; kind: string; runAfter: Date } }
  assert.equal(created[0].status, 'QUEUED')
  assert.deepEqual([jobs.create.userId, jobs.create.kind], [QA, 'ANALYSIS_STT'])
  assert.ok(Math.abs(jobs.create.runAfter.getTime() - (Date.now() + 20_000)) < 5_000, '디바운스 20초')

  created = enqueueRig('FAST')
  await recordUploadedUtterance(QA, upload())
  assert.ok((created[0].jobs as { create: { runAfter: Date } }).create.runAfter.getTime() - Date.now() > 25_000, 'FAST 는 30초 뒤')

  created = enqueueRig('OFFLINE')
  assert.equal((await recordUploadedUtterance(QA, upload())).analysisQueued, false)
  created = enqueueRig('AUTO', null)
  assert.equal((await recordUploadedUtterance(QA, upload())).analysisQueued, false)
  Object.assign(analysisDb, { recognitionMode: async () => Promise.reject(new Error('db down')) })
  assert.equal((await recordUploadedUtterance(QA, upload())).analysisQueued, false, '판정 오류는 적재 안 함 — 업로드는 성공')
})

test('gateway TURN 콜백도 같은 게이트 — 집는 시각은 디바운스(20초, 파일 이동 여유 10초 포함)', async () => {
  recordWorkerHeartbeat()
  const created = enqueueRig('AUTO')
  const r = await registerGatewayUtterance({ userId: QA, chatId: null, durationMs: 1000, sampleRate: 16000, audioBytes: 32000, realtimeEngine: 'rt-conn', realtimeText: 'はい', segments: null, timings: null, traceId: null } as unknown as Parameters<typeof registerGatewayUtterance>[0])
  assert.deepEqual([r.status, r.analysisQueued], ['QUEUED', true])
  const runAfter = (created[0].jobs as { create: { runAfter: Date } }).create.runAfter.getTime()
  assert.ok(runAfter - Date.now() > 18_000 && runAfter - Date.now() <= 20_000)
})

// ── #22·#21a ────────────────────────────────────────────────────────────

const viewRow = (p: Record<string, unknown> = {}) =>
  ({
    id: 'u1',
    chatMessageId: null,
    durationMs: 1200,
    status: 'QUEUED',
    realtimeText: 'きのういった',
    analysisText: 'きのう行った',
    transcriptConfidence: 0.7,
    requiresReview: false,
    finalText: 'きのういった',
    finalSource: 'REALTIME',
    audioPath: 'users/x/utterances/2026-09/u1.wav',
    audioExpiresAt: new Date(NOW + 1000),
    audioDeletedAt: null,
    analysis: null,
    ...p,
  }) as unknown as Parameters<typeof toUtteranceView>[0]

test('#22 DTO: 분석 전엔 분석 텍스트·신뢰도 null · 엔진 칸 없음 · 원음 기한 지나면 audioUrl null', () => {
  const v = toUtteranceView(viewRow(), new Date(NOW))
  assert.equal(v.analysisText, null)
  assert.equal(v.transcriptConfidence, null)
  assert.equal(v.audioUrl, '/api/v1/speech/utterances/u1/audio')
  const json = JSON.stringify(v)
  for (const k of ['realtimeEngine', 'analysisEngine', 'engineVersions', 'audioPath']) assert.ok(!json.includes(k), k)
  const a = toUtteranceView(viewRow({ status: 'ANALYZED', analysis: { grammarScore: null, pronunciationScore: null, fluencyScore: null, wordScores: null, feedbackKo: null, analyzedAt: new Date(NOW) } }), new Date(NOW + 2000))
  assert.equal(a.analysisText, 'きのう行った')
  assert.equal(a.transcriptConfidence, 0.7)
  assert.equal(a.audioUrl, null)
  assert.deepEqual(a.analysis, { grammarScore: null, pronunciationScore: null, fluencyScore: null, wordScores: null, feedbackKo: null, createdAt: new Date(NOW).toISOString() })
})

test('#21a 본문: USER 만 text(1~1,000자), 나머지는 text 거부', () => {
  assert.deepEqual(parseResolveBody({ choice: 'ANALYSIS' }), { choice: 'ANALYSIS', text: null })
  assert.deepEqual(parseResolveBody({ choice: 'USER', text: '  昨日行きました  ' }), { choice: 'USER', text: '昨日行きました' })
  for (const b of [{ choice: 'X' }, { choice: 'REALTIME', text: 'a' }, { choice: 'USER' }, { choice: 'USER', text: '   ' }, { choice: 'USER', text: 'あ'.repeat(1001) }, { choice: 'USER', text: 'a', x: 1 }]) {
    assert.throws(() => parseResolveBody(b), ApiError, JSON.stringify(b))
  }
})

test('#21a: 조건부 갱신 1회 — 동시 두 요청은 한쪽만(두 번째 409) · 없음 404 · 빈 안 400', async () => {
  let n = 1
  Object.assign(resolveDb, {
    update: async () => {
      const r = n
      n = 0
      return r
    },
    state: async () => ({ status: 'ANALYZED', requiresReview: false, realtimeText: 'a', analysisText: 'b' }),
  })
  // 성공 뒤 조회(getUtteranceView)는 실제 DB 를 부르므로 첫 요청의 성공 경로는 update 결과만 확인한다.
  assert.equal(await resolveDb.update(QA, 'u1', { choice: 'ANALYSIS', text: null }), 1)
  assert.deepEqual(await rejects(resolveFinalText(QA, 'u1', { choice: 'ANALYSIS', text: null })), ['CONFLICT', 'NOT_REVIEWABLE'])

  Object.assign(resolveDb, { update: async () => 0, state: async () => null })
  assert.deepEqual(await rejects(resolveFinalText(QA, 'u1', { choice: 'REALTIME', text: null })), ['NOT_FOUND', undefined])
  assert.deepEqual(await rejects(resolveFinalText(QA, '../u1', { choice: 'REALTIME', text: null })), ['NOT_FOUND', undefined])

  Object.assign(resolveDb, { update: async () => 0, state: async () => ({ status: 'ANALYZED', requiresReview: true, realtimeText: 'a', analysisText: '' }) })
  assert.deepEqual(await rejects(resolveFinalText(QA, 'u1', { choice: 'ANALYSIS', text: null })), ['VALIDATION', 'EMPTY_CHOICE'])
  Object.assign(resolveDb, { update: async () => 0, state: async () => ({ status: 'QUEUED', requiresReview: false, realtimeText: 'a', analysisText: null }) })
  assert.deepEqual(await rejects(resolveFinalText(QA, 'u1', { choice: 'USER', text: 'x' })), ['CONFLICT', 'NOT_REVIEWABLE'], '분석 전')
})
