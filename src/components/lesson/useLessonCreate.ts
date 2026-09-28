'use client'

/**
 * 수업 만들기(#59) — 오늘 홈 카드·주제 시트·붙여넣기·대기 실패·종료 카드가 같은 처리를 쓴다(screens §12-2 A "카드 버튼 동작").
 * 두 번 눌러도 요청은 한 번. 결과에 따라 수업 경로로 가고, 거기서 한 번 띄울 안내는 flash(`sessionStorage`)로 넘긴다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import type { CreateLessonResult } from '@/types/lesson'
import { FLASH } from './lessonCopy'

export const LESSON_KEYS = {
  flash: 'kaiwa.lesson.flash',
  src: (lessonId: string) => `kaiwa.lesson.src.${lessonId}`,
  pasteDraft: 'kaiwa.lesson.pasteDraft',
  speakDraft: (lessonId: string, itemId: string) => `kaiwa.lesson.speakDraft.${lessonId}.${itemId}`,
  added: (lessonId: string) => `kaiwa.lesson.added.${lessonId}`,
} as const

export const lessonPath = (id: string) => `/study/today/talk/${encodeURIComponent(id)}`

export function putFlash(msg: string): void {
  writeStore('session', LESSON_KEYS.flash, msg)
}

export function takeFlash(): string | null {
  const v = readStore('session', LESSON_KEYS.flash)
  if (v !== null) writeStore('session', LESSON_KEYS.flash, null)
  return v
}

export type CreateOutcome = 'ok' | 'noJa' | 'error'

export function useLessonCreate(onToast: (msg: string) => void) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const create = useCallback(
    async (body: { topicId: string } | { sourceText: string }, opts: { replace?: boolean } = {}): Promise<CreateOutcome> => {
      if (busyRef.current) return 'error'
      busyRef.current = true
      setBusy(true)
      const go = (id: string) => (opts.replace ? router.replace(lessonPath(id)) : router.push(lessonPath(id)))
      try {
        const r = await apiPost<CreateLessonResult>('/api/v1/lessons', body)
        if ('sourceText' in body) writeStore('session', LESSON_KEYS.src(r.lessonId), body.sourceText)
        if (r.reused && r.status !== 'GENERATING') putFlash(FLASH.reused)
        go(r.lessonId)
        return 'ok'
      } catch (e) {
        const err = toErr(e)
        const lessonId = detailString(err, 'lessonId')
        if (err.status === 409 && lessonId) {
          putFlash(FLASH.generating)
          go(lessonId)
          return 'ok'
        }
        if (err.status === 400 && detailString(err, 'reason') === 'NOT_JAPANESE') return 'noJa'
        if (err.status === 404) onToast(FLASH.topicMissing)
        else if (err.status === 429) onToast(FLASH.rateLimited)
        else if (err.status === 0) onToast(FLASH.network)
        else onToast(FLASH.failed)
        return 'error'
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [router, onToast],
  )

  return { create, busy }
}
