'use client'

/**
 * 새 단어 대기 화면 훅(task-044 가이드 §3-5) — `createTopicSetStarter` 를 감싼다.
 * 시작 값은 sessionStorage 토큰(E2)을 effect 에서 한 번 읽어 ref 에 둔다(StrictMode 이중 effect 에도 같은 값, 서버 렌더와 어긋나지 않게).
 * 시작은 `setTimeout 0` 뒤 — 개발 모드 StrictMode 의 첫 effect 정리가 요청을 보내기 전에 지워져 요청이 한 번만 나간다.
 * 떠나면(unmount·`pagehide`) 취소한다. `visibilitychange:hidden` 은 취소하지 않는다(다른 앱을 잠깐 봐도 이어서 — 서버 벽시계 30초가 상한).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost, isAbort } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import type { CreateSessionResult } from '@/types/vocab'
import { putSession, VOCAB_KEYS } from './hooks'
import { WAIT } from './topicCopy'
import { parseTopicStart, topicStartBody, type TopicStartToken } from './topicLogic'
import { createTopicSetStarter, type StartFailure, type StarterState, type TopicSetStarter } from './topicSetStart'

export function toStartFailure(e: unknown): StartFailure {
  if (isAbort(e)) return { abort: true, status: 0, reason: null, sessionId: null }
  const err = toErr(e)
  return { abort: false, status: err.status, reason: detailString(err, 'reason'), sessionId: detailString(err, 'sessionId') }
}

/** 오늘 카드·결과의 [시작하기]·[한 세트 더] — 토큰을 남기고 대기 화면으로. */
export function writeTopicStart(t: Omit<TopicStartToken, 'v' | 'at'>): void {
  const token: TopicStartToken = { v: 1, at: Date.now(), ...t }
  writeStore('session', VOCAB_KEYS.topicStart, JSON.stringify(token))
}

export function useTopicSetStart() {
  const router = useRouter()
  const [token, setToken] = useState<TopicStartToken | null>(null)
  const [state, setState] = useState<StarterState>({ kind: 'quiet' })
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const tokenRef = useRef<TopicStartToken | null | undefined>(undefined)
  const starterRef = useRef<TopicSetStarter | null>(null)

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = parseTopicStart(readStore('session', VOCAB_KEYS.topicStart), Date.now())
    const t = tokenRef.current
    if (!t) {
      router.replace('/study/today')
      return
    }
    setToken(t)
    const starter = createTopicSetStarter({
      body: topicStartBody(t),
      post: (body, signal) => apiPost<CreateSessionResult>('/api/v1/vocab/sessions', body, { signal }),
      toFailure: toStartFailure,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      onState: (s) => {
        setState(s)
        if (s.kind === 'done') {
          writeStore('session', VOCAB_KEYS.topicStart, null)
          putSession(VOCAB_KEYS.notice(s.session.id), s.noChoice ? 'noChoice' : s.session.downgraded ? 'few' : '')
          if (s.generation) putSession(VOCAB_KEYS.topicGen(s.session.id), JSON.stringify(s.generation))
          router.replace(`/study/today/words/${encodeURIComponent(s.session.id)}`)
        } else if (s.kind === 'resume') {
          writeStore('session', VOCAB_KEYS.topicStart, null)
          router.replace(`/study/today/words/${encodeURIComponent(s.sessionId)}`)
        } else if (s.kind === 'inProgress') {
          writeStore('session', VOCAB_KEYS.topicStart, null)
          putSession(VOCAB_KEYS.flash, WAIT.ipFlash)
          router.replace('/study/today')
        }
      },
    })
    starterRef.current = starter
    const kick = setTimeout(() => {
      setStartedAt(Date.now())
      starter.start()
    }, 0)
    const onHide = () => starter.dispose()
    window.addEventListener('pagehide', onHide)
    return () => {
      clearTimeout(kick)
      window.removeEventListener('pagehide', onHide)
      starter.dispose()
      starterRef.current = null
    }
  }, [router])

  // 화면을 떠나면(성공 이동 포함) 시작 값을 지운다 — 뒤로 가기로 돌아와도 다시 요청하지 않게.
  useEffect(() => () => writeStore('session', VOCAB_KEYS.topicStart, null), [])

  // 두 번 누름·진행 중 누름은 상태 기계가 무시한다(REV-125 M-2) — 받아들여졌을 때만 경과 시계를 다시 잰다.
  const skip = useCallback(() => {
    starterRef.current?.skip()
  }, [])
  const retry = useCallback(() => {
    if (starterRef.current?.retry()) setStartedAt(Date.now())
  }, [])
  const openMine = useCallback(() => {
    putSession(VOCAB_KEYS.openMine, '1')
    router.replace('/study/today')
  }, [router])

  return { token, state, startedAt, skip, retry, openMine }
}
