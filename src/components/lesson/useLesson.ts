'use client'

/**
 * 수업 상태(screens §12-3 B) — #60 을 읽고, 진행 쓰기(#61)를 **한 줄 큐**로 보낸다(§5 덱과 같은 방식).
 *  - 화면은 낙관적으로 먼저 바꾸고(`update`), 어느 절이 바뀌었는지만 표시해 둔다. 보낼 때는 그 절의 **지금 값 전체**를 보낸다 —
 *    서버가 합집합·첫 답 고정·칸 교체로 병합하므로 같은 값을 여러 번 보내도 결과가 같다(재시도 안전).
 *  - 들은 구간·메모·③ 본 문장(`pieces.seen`)은 800ms 모아 한 번에, 응용 답은 바로 보낸다. 단계 넘김(`advance`)은 큐를 비운 뒤 `stageDone` 을 보낸다.
 *  - 서버 칸(`listen.proposed`·`speaking`)은 보내지 않는다(#61 400).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPatch } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import type { LessonDto, LessonProgress, ProgressPatch } from '@/types/lesson'

export type Section = 'listen' | 'application' | 'pieces'

export interface UseLesson {
  load: 'loading' | 'error' | 'notFound' | 'ready'
  lesson: LessonDto | null
  reload: () => Promise<LessonDto | null>
  /** 낙관적 갱신 + (sections 가 있으면) 그 절을 저장 대기로. */
  update: (fn: (p: LessonProgress) => LessonProgress, sections?: Section[], opts?: { immediate?: boolean }) => void
  replace: (l: LessonDto) => void
  flush: () => Promise<boolean>
  advance: (stageDone: number) => Promise<boolean>
  saveError: boolean
}

/** 저장 대기 절의 지금 값 전체 → #61 본문. `pieces.seen` 은 중복 없이 오름차순(서버가 중복을 400 으로 막는다 — 400 은 재시도하지 않으므로 보내기 전에 정리). */
export function patchOf(p: LessonProgress, sections: ReadonlySet<Section>): ProgressPatch {
  const out: ProgressPatch = {}
  if (sections.has('listen')) out.listen = { segmentsDone: p.listen?.segmentsDone ?? [], played: { slow: p.listen?.played?.slow ?? [], normal: p.listen?.played?.normal ?? [] }, memo: p.listen?.memo ?? [] }
  if (sections.has('application')) out.application = { answers: p.application?.answers ?? [] }
  if (sections.has('pieces')) out.pieces = { seen: [...new Set((p.pieces?.seen ?? []).filter((x) => Number.isInteger(x) && x >= 0))].sort((a, b) => a - b) }
  return out
}

export function useLesson(lessonId: string): UseLesson {
  const [load, setLoad] = useState<UseLesson['load']>('loading')
  const [lesson, setLesson] = useState<LessonDto | null>(null)
  const [saveError, setSaveError] = useState(false)
  const lessonRef = useRef<LessonDto | null>(null)
  const dirty = useRef(new Set<Section>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chain = useRef<Promise<boolean>>(Promise.resolve(true))
  const path = `/api/v1/lessons/${encodeURIComponent(lessonId)}`

  const replace = useCallback((l: LessonDto) => {
    lessonRef.current = l
    setLesson(l)
  }, [])

  const reload = useCallback(async (): Promise<LessonDto | null> => {
    try {
      const l = await apiGet<LessonDto>(path)
      replace(l)
      setLoad('ready')
      return l
    } catch (e) {
      const err = toErr(e)
      setLoad((prev) => (prev === 'ready' && err.status !== 404 ? prev : err.status === 404 ? 'notFound' : 'error'))
      return null
    }
  }, [path, replace])

  useEffect(() => {
    queueMicrotask(() => void reload())
  }, [reload])

  const send = useCallback((): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const l = lessonRef.current
      if (!l || dirty.current.size === 0) return true
      const sections = new Set(dirty.current)
      dirty.current.clear()
      try {
        await apiPatch(`${path}/progress`, { progress: patchOf(l.progress, sections) })
        setSaveError(false)
        return true
      } catch (e) {
        const err = toErr(e)
        if (err.status === 409) {
          void reload()
          return false
        }
        if (err.status !== 400) for (const s of sections) dirty.current.add(s)
        setSaveError(true)
        return false
      }
    }
    chain.current = chain.current.then(run, run)
    return chain.current
  }, [path, reload])

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    return send()
  }, [send])

  const update = useCallback(
    (fn: (p: LessonProgress) => LessonProgress, sections: Section[] = [], opts: { immediate?: boolean } = {}) => {
      const l = lessonRef.current
      if (!l) return
      const next = { ...l, progress: fn(l.progress), status: l.status === 'READY' && sections.length ? ('IN_PROGRESS' as const) : l.status }
      replace(next)
      if (!sections.length) return
      for (const s of sections) dirty.current.add(s)
      if (timer.current) clearTimeout(timer.current)
      if (opts.immediate) {
        timer.current = null
        void send()
      } else timer.current = setTimeout(() => {
        timer.current = null
        void send()
      }, 800)
    },
    [replace, send],
  )

  // 화면을 떠날 때 모아 둔 쓰기를 보낸다(가려짐·언마운트).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void send()
      }
    }
  }, [flush, send])

  const advance = useCallback(
    async (stageDone: number): Promise<boolean> => {
      const okFlush = await flush()
      if (!okFlush && dirty.current.size) return false
      const l = lessonRef.current
      if (!l) return false
      if (stageDone <= l.stageDone) return true
      try {
        const r = await apiPatch<LessonDto>(`${path}/progress`, { stageDone })
        replace({ ...l, stageDone: r.stageDone, status: r.status })
        setSaveError(false)
        return true
      } catch (e) {
        const err = toErr(e)
        if (err.status === 400 && detailString(err, 'reason') === 'monotonic') {
          await reload()
          return true
        }
        if (err.status === 409) await reload()
        return false
      }
    },
    [flush, path, reload, replace],
  )

  return { load, lesson, reload, update, replace, flush, advance, saveError }
}
