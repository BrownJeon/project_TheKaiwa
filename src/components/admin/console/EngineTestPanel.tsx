'use client'

/**
 * 상태 확인·기능 테스트 한 패널(screens.md §6-2 C·§6-3). 역할 페이지·연결 상세가 함께 쓴다.
 *
 * - 콘솔 화면에서 나가는 쓰기는 #95·#96 두 가지뿐이다(G2). 권한 없는 버튼은 렌더하지 않는다(서버가 다시 검사).
 * - 같은 연결에서는 한 번에 하나만(`busy` 동안 두 버튼 다 잠금). 결과가 오면 `onDone` → 부모가 연결·기록을 다시 읽는다.
 * - 서비스가 꺼져 있는 것(UNAVAILABLE)은 오류가 아니다 — 회색 결과 카드. 빨간 ErrorBlock 은 500·네트워크에만.
 * - 429 는 버튼 자리 카운트다운. 기능 테스트는 끝난 직후 30초를 화면이 먼저 잠근다(서버의 연결당 30초 1회와 같은 값 — 헛 429 방지.
 *   가이드는 LLM 만 적었지만 서버 제한이 모든 연결에 걸려 있어 모두 잠근다).
 * - 언마운트 뒤 온 결과는 버린다. 요청은 끊지 않는다(서버는 끝까지 기록한다).
 */
import { useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { retryAfterOf, toErr } from '@/components/common/errors'
import { Btn, Card, ErrorBlock } from '@/components/common/ui'
import { elapsedSec, useCountdown, useNow } from '@/components/common/useNow'
import type { ConnectionTypeName, EngineRoleName, EngineStatusName, HealthKindName, HealthRunDto } from '@/types/admin'
import { useCan } from './ConsoleProvider'
import { missingOf } from './ConsoleStates'
import { HEALTH_KIND_KO, panelHelp } from './labels'
import TestResultCard, { type TestResult } from './TestResultCard'

export const FUNCTIONAL_LOCK_SEC = 30

export interface PanelConnection {
  id: string
  key: string
  role: EngineRoleName
  connectionType: ConnectionTypeName
  enabled: boolean
  status: EngineStatusName
}

interface Cooldown {
  until: number
  sec: number
}

export default function EngineTestPanel({ connection, onDone }: { connection: PanelConnection; onDone: (r: HealthRunDto | null) => void }) {
  const can = useCan()
  const [run, setRun] = useState<{ kind: HealthKindName; startedAt: number } | null>(null)
  const [result, setResult] = useState<{ kind: HealthKindName; body: TestResult; receivedAt: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cool, setCool] = useState<Partial<Record<HealthKindName, Cooldown>>>({})
  const aliveRef = useRef(true)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const now = useNow(run !== null, 1000)
  const healthLeft = useCountdown(cool.HEALTH?.until ?? null)
  const funcLeft = useCountdown(cool.FUNCTIONAL?.until ?? null)

  const canHealth = can('health.run')
  const canFunctional = can('functional_test.run') && connection.connectionType !== 'ONDEVICE'
  if (!can('health.run') && !can('functional_test.run')) return null

  const left = (kind: HealthKindName): number | null => {
    const c = cool[kind]
    if (!c) return 0
    const n = kind === 'HEALTH' ? healthLeft : funcLeft
    return n === null ? c.sec : n
  }
  const cooling = (kind: HealthKindName) => (left(kind) ?? 0) > 0
  const busy = run !== null

  const lock = (kind: HealthKindName, sec: number) => {
    setCool((c) => ({ ...c, [kind]: { until: Date.now() + sec * 1000, sec } }))
  }

  const start = async (kind: HealthKindName) => {
    if (busy || cooling(kind)) return
    setRun({ kind, startedAt: Date.now() })
    setNotice(null)
    setError(null)
    const path = `/api/admin/v1/engine-connections/${encodeURIComponent(connection.id)}/${kind === 'HEALTH' ? 'health' : 'test'}`
    try {
      const body = await apiPost<HealthRunDto>(path, {})
      if (!aliveRef.current) return
      const shown: TestResult = {
        ...body,
        detail: (body.detail ?? null) as Record<string, unknown> | null,
        connectionStatus: body.connectionStatus !== connection.status ? body.connectionStatus : undefined,
      }
      setResult({ kind, body: shown, receivedAt: Date.now() })
      if (kind === 'FUNCTIONAL') lock('FUNCTIONAL', FUNCTIONAL_LOCK_SEC)
      onDoneRef.current(body)
    } catch (e) {
      if (!aliveRef.current) return
      const err = toErr(e)
      const traceId = typeof err.details.traceId === 'string' ? err.details.traceId : null
      if (err.status === 409) {
        const why = String(err.details.reason ?? err.details.code ?? '')
        if (/NOT_ENABLED|DISABLED/i.test(why)) {
          setNotice('꺼져 있는 연결이라 실행하지 않았어요.')
        } else {
          setNotice('이미 실행 중이에요. 끝나면 아래 기록에 나타나요.')
          setTimeout(() => {
            if (aliveRef.current) onDoneRef.current(null)
          }, 5000)
        }
      } else if (err.status === 429) {
        const sec = retryAfterOf(err)
        lock(kind, sec)
        setNotice(`${sec}초에 한 번만 실행할 수 있어요.`)
      } else if (err.status === 403) {
        const caps = missingOf(err)
        setNotice(`이 실행 권한이 없어요${caps.length ? ` (${caps.join(', ')})` : ''}`)
      } else if (err.status === 404) {
        setNotice('연결을 찾을 수 없어요. 목록을 다시 불러와 주세요.')
      } else if (err.status === 504 || err.status === 502) {
        const timeout = err.status === 504
        setResult({
          kind,
          receivedAt: Date.now(),
          body: { ok: false, status: 'UNKNOWN', latencyMs: null, traceId, detail: { errorCode: timeout ? 'E_TEST_TIMEOUT' : 'E_TEST_UPSTREAM' } },
        })
        if (kind === 'FUNCTIONAL') lock('FUNCTIONAL', FUNCTIONAL_LOCK_SEC)
        onDoneRef.current(null)
      } else if (err.status === 400 || err.status === 422) {
        setNotice(err.message || '실행하지 못했어요.')
      } else {
        setError('실행하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
      }
    } finally {
      if (aliveRef.current) setRun(null)
    }
  }

  const label = (kind: HealthKindName, idle: string, running: string) => {
    if (run?.kind === kind) return running
    const n = left(kind)
    return n && n > 0 ? `${n}초 뒤 다시` : idle
  }

  return (
    <Card className="mt-2.5">
      {!connection.enabled ? (
        <p className="text-[13px] text-ink2 break-keep">꺼져 있는 연결이에요 — 켜기는 다음 단계(편집)에서 할 수 있어요.</p>
      ) : (
        <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          {canHealth ? (
            <Btn variant="ghost" onClick={() => void start('HEALTH')} disabled={busy || cooling('HEALTH')} aria-busy={run?.kind === 'HEALTH'}>
              {label('HEALTH', '상태 확인', '확인 중…')}
            </Btn>
          ) : null}
          {canFunctional ? (
            <Btn variant="ghost" onClick={() => void start('FUNCTIONAL')} disabled={busy || cooling('FUNCTIONAL')} aria-busy={run?.kind === 'FUNCTIONAL'}>
              {label('FUNCTIONAL', '기능 테스트', '테스트 중…')}
            </Btn>
          ) : null}
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink2 break-keep">{panelHelp(connection.connectionType, connection.role)}</p>
      <div aria-live="polite" className="min-w-0">
        {run ? (
          <p role="status" className="mt-3 text-[13px] text-ink2">
            {HEALTH_KIND_KO[run.kind]} 중… {elapsedSec(now, run.startedAt)}초
          </p>
        ) : null}
        {notice ? <p className="mt-3 text-[13px] text-ink break-keep">{notice}</p> : null}
        {error ? (
          <div className="mt-3">
            <ErrorBlock message={error} />
          </div>
        ) : null}
        {result ? <TestResultCard kind={result.kind} result={result.body} receivedAt={result.receivedAt} /> : null}
      </div>
    </Card>
  )
}
