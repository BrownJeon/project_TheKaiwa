'use client'

/**
 * 한 번에 쓰는 확인 창(연결 켜기·끄기 · 비밀 참조 연결 · 되돌리기)의 사전 준비 — 운영이면 같은 후보로 변경 요약(#106 — 요약 해시·테스트 필요 여부)을
 * 만들고, 기능 테스트(#105)를 부른다. 개발 환경은 테스트가 선택이다(결과는 안내용·첨부 가능).
 * 창이 닫히면 아무것도 읽지 않는다. 후보가 바뀌면(참조 고르기) 요약·테스트를 새로 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, retryAfterOf, toErr } from '@/components/common/errors'
import { useCountdown } from '@/components/common/useNow'
import type { ConfigDiffDto, ConfigTestDto } from '@/types/admin'
import * as api from './configApi'
import { requestErrorText } from './flow'

export interface WritePrep {
  diff: ConfigDiffDto | null
  diffLoading: boolean
  diffError: Err | null
  test: ConfigTestDto | null
  testing: boolean
  testError: string | null
  cooldownSec: number
  runTest: () => void
  /** 운영 적용 조건을 채웠는가(요약 있음 · 테스트가 필요하면 ok 결과 있음). */
  ready: boolean
  meta: (o: { baseVersion: number; reason: string; confirm: string }) => api.WriteMeta
}

export function useWritePrep({ open, target, candidate, production }: { open: boolean; target: api.TargetRef; candidate: api.Candidate | null; production: boolean }): WritePrep {
  const key = open && candidate ? JSON.stringify([target, candidate]) : null
  const [state, setState] = useState<{ key: string | null; diff: ConfigDiffDto | null; diffError: Err | null; test: ConfigTestDto | null; testError: string | null }>({
    key: null,
    diff: null,
    diffError: null,
    test: null,
    testError: null,
  })
  const [testing, setTesting] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const cooldownSec = useCountdown(cooldownUntil) ?? 0
  const ctrl = useRef<AbortController | null>(null)
  const current = state.key === key

  useEffect(() => {
    if (!key || !production || !candidate) return
    let alive = true
    api
      .diff(target, candidate)
      .then((d) => {
        if (alive) setState({ key, diff: d, diffError: null, test: null, testError: null })
      })
      .catch((e) => {
        if (alive) setState({ key, diff: null, diffError: toErr(e), test: null, testError: null })
      })
    return () => {
      alive = false
    }
    // key 가 후보·대상을 담는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, production])

  useEffect(() => () => ctrl.current?.abort(), [])

  const runTest = useCallback(() => {
    if (!key || !candidate || cooldownSec > 0) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setTesting(true)
    api
      .test(target, candidate, { signal: c.signal })
      .then((t) => {
        setState((s) => ({ ...(s.key === key ? s : { key, diff: null, diffError: null }), key, test: t, testError: null }))
        if (t.runs.length) setCooldownUntil(Date.now() + 30_000)
      })
      .catch((e) => {
        if (isAbort(e)) return
        const err = toErr(e)
        if (err.status === 429) setCooldownUntil(Date.now() + retryAfterOf(err) * 1000)
        setState((s) => ({ ...(s.key === key ? s : { key, diff: null, diffError: null }), key, test: null, testError: err.status === 429 ? '이 연결은 30초에 한 번만 테스트할 수 있어요.' : requestErrorText(err, '기능 테스트') }))
      })
      .finally(() => setTesting(false))
  }, [key, candidate, target, cooldownSec])

  const diff = current ? state.diff : null
  const test = current ? state.test : null
  const testOk = Boolean(test && test.status === 'ok')
  const ready = !production || Boolean(diff && (!diff.testRequired || (testOk && test?.testResultId)))
  const meta = useCallback(
    (o: { baseVersion: number; reason: string; confirm: string }) =>
      api.writeMeta({
        baseVersion: o.baseVersion,
        reason: o.reason,
        production,
        confirm: o.confirm,
        summaryHash: diff?.summaryHash ?? null,
        testResultId: testOk && (!production || diff?.testRequired) ? (test?.testResultId ?? null) : null,
      }),
    [production, diff, test, testOk],
  )

  return {
    diff,
    diffLoading: Boolean(key && production && !current),
    diffError: current ? state.diffError : null,
    test,
    testing,
    testError: current ? state.testError : null,
    cooldownSec,
    runTest,
    ready,
    meta,
  }
}
