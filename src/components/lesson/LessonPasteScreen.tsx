'use client'

/**
 * 붙여넣기 `/study/today/talk/new/paste`(screens §12-2 C · 데모 v2 `#paste`·`#paste-short`·`#paste-noja`).
 * 글자 수는 코드포인트로 센다. 일본어 비율은 **보낼 때 서버가** 판정한다(400 `NOT_JAPANESE` → 오류 상자) — 기준을 한 곳에 둔다.
 * 입력 초안은 `sessionStorage` 에 둔다(나갔다 와도 유지, 보내면 지움). 성공하면 수업 경로로 replace(뒤로가기가 여기로 오지 않게).
 */
import { useEffect, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import BackBar from '@/components/shell/BackBar'
import { Btn } from '@/components/common/ui'
import { HOME, PASTE } from './lessonCopy'
import { LESSON_KEYS, useLessonCreate } from './useLessonCreate'

const MIN = 50
const MAX = 2000

export function pasteMeta(text: string): { n: number; hint: string; bad: boolean; ok: boolean } {
  const n = Array.from(text).length
  if (n === 0) return { n, hint: PASTE.hintEmpty, bad: false, ok: false }
  if (n < MIN) return { n, hint: PASTE.hintShort(n), bad: false, ok: false }
  if (n > MAX) return { n, hint: PASTE.hintLong, bad: true, ok: false }
  return { n, hint: PASTE.hintOk, bad: false, ok: true }
}

export default function LessonPasteScreen() {
  const toast = useToast()
  const { show } = toast
  const { create, busy } = useLessonCreate(show)
  const [text, setText] = useState('')
  const [noJa, setNoJa] = useState(false)

  useEffect(() => {
    const d = readStore('session', LESSON_KEYS.pasteDraft)
    if (d) queueMicrotask(() => setText(d))
  }, [])

  const m = pasteMeta(text)
  const submit = async () => {
    if (busy) return
    if (!m.ok) {
      show(m.n > MAX ? PASTE.hintLong : PASTE.hintShort(m.n))
      return
    }
    const r = await create({ sourceText: text }, { replace: true })
    if (r === 'ok') writeStore('session', LESSON_KEYS.pasteDraft, null)
    else if (r === 'noJa') setNoJa(true)
  }

  return (
    <>
      <BackBar sticky backHref="/study/today/talk/new" backLabel={PASTE.back} title={PASTE.title} subtitle={PASTE.subtitle} />
      <div className="flex flex-col gap-[18px] px-4 pb-8 pt-3.5">
        <p className="text-[14px] break-keep">{PASTE.intro}</p>
        <div className="min-w-0">
          <label htmlFor="paste" className="text-[12.5px] font-medium text-ink2">
            {PASTE.label}
          </label>
          <textarea
            id="paste"
            lang="ja"
            rows={8}
            value={text}
            placeholder={PASTE.placeholder}
            aria-describedby="paste-hint paste-count"
            onChange={(e) => {
              setText(e.target.value)
              setNoJa(false)
              writeStore('session', LESSON_KEYS.pasteDraft, e.target.value || null)
            }}
            onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
            className="mt-1.5 block min-h-[176px] w-full min-w-0 resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-relaxed text-ink placeholder:text-ink3"
          />
          <div className="mt-1.5 flex justify-between gap-2">
            <span id="paste-hint" className={`min-w-0 text-[12px] break-keep ${m.bad ? 'text-bad' : 'text-ink2'}`}>
              {m.hint}
            </span>
            <span id="paste-count" className={`flex-none text-[12px] tabular-nums ${m.bad ? 'text-bad' : 'text-ink2'}`}>
              {PASTE.count(m.n)}
            </span>
          </div>
          {noJa ? (
            <div role="alert" className="mt-2 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
              <p className="font-semibold">{PASTE.noJaTitle}</p>
              <p>{PASTE.noJaBody}</p>
            </div>
          ) : null}
        </div>
        <p className="text-[12px] text-ink2">{PASTE.saved}</p>
        <div>
          <Btn className="w-full" aria-disabled={!m.ok || busy || undefined} aria-busy={busy || undefined} onClick={() => void submit()}>
            {busy ? HOME.creating : PASTE.submit}
          </Btn>
          <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{PASTE.note}</p>
        </div>
      </div>
      <Toast message={toast.message} bottomPx={24} />
    </>
  )
}
