'use client'

/**
 * 붙여넣기 `/study/today/talk/new/paste`(screens §12-2 C · 데모 v2 `#paste`·`#paste-short`·`#paste-noja`).
 * 글자 수는 코드포인트로 센다. 일본어 비율은 **보낼 때 서버가** 판정한다(400 `NOT_JAPANESE` → 오류 상자) — 기준을 한 곳에 둔다.
 * 입력 초안은 `sessionStorage` 에 둔다(나갔다 와도 유지, 보내면 지움). 성공하면 수업 경로로 replace(뒤로가기가 여기로 오지 않게).
 *
 * 공유하기로 받은 글(task-052, screens §20-4 — 승인 데모 `task-052-share-target-v1` D1~D5 A): 셸 `ShareReceiver` 가
 * `?from=share` 로 데려오면 마운트 때 한 번, 이미 이 화면이면 `SHARE_EVENT` 로 받아 입력칸에 채운다. 본문은 브리지에서
 * 여기서만 꺼내고(`consumeSharedText`), 채운 뒤에는 초안 `sessionStorage` 에만 둔다. 쓰던 글·자르기 전 원문은 이 화면 상태에만.
 * 앱이 아니면 공유 코드는 첫 줄에서 끝난다(리스너 없음). 2,000자 자르기 줄은 웹·앱 공통(D3-A).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import BackBar from '@/components/shell/BackBar'
import { SHARE_EVENT, SHARE_PASTE_PATH } from '@/components/shell/shareTarget'
import { Btn } from '@/components/common/ui'
import { consumeSharedText, isNativeApp } from '@/modules/infra/native'
import { HOME, PASTE, PASTE_SHARE, PASTE_TRIM } from './lessonCopy'
import { arriveShare, charCount, swapShare, trimRemoved, trimToLimit, type ShareBannerState } from './pasteShare'
import { LESSON_KEYS, useLessonCreate } from './useLessonCreate'

const MIN = 50
const MAX = 2000
const SHARE_TOAST_MS = 4000

export function pasteMeta(text: string): { n: number; hint: string; bad: boolean; ok: boolean } {
  const n = Array.from(text).length
  if (n === 0) return { n, hint: PASTE.hintEmpty, bad: false, ok: false }
  if (n < MIN) return { n, hint: PASTE.hintShort(n), bad: false, ok: false }
  if (n > MAX) return { n, hint: PASTE.hintLong, bad: true, ok: false }
  return { n, hint: PASTE.hintOk, bad: false, ok: true }
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

/** 안내 띠(D1-A, 데모 `.shb`). 되돌리기·다시 넣기는 같은 버튼 요소의 글만 바뀐다 — 누른 버튼에 초점이 남고 `role=status` 가 새 제목을 읽는다. */
function ShareBanner({ state, onSwap, ref }: { state: ShareBannerState; onSwap: () => void; ref?: React.Ref<HTMLDivElement> }) {
  const [title, body, action] =
    state.kind === 'arrived'
      ? [PASTE_SHARE.arrivedTitle, PASTE_SHARE.arrivedBody, null]
      : state.kind === 'replaced'
        ? [PASTE_SHARE.replacedTitle, PASTE_SHARE.replacedBody(state.n), PASTE_SHARE.replacedAction]
        : [PASTE_SHARE.restoredTitle, PASTE_SHARE.restoredBody(state.n), PASTE_SHARE.restoredAction]
  return (
    <div ref={ref} role="status" className="flex min-w-0 items-start gap-2.5 rounded-xl bg-surface2 px-3 py-2.5">
      <span aria-hidden className="mt-px grid size-7 flex-none place-items-center rounded-full bg-surface text-ink2">
        <ShareIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold leading-[1.4] text-ink break-keep">{title}</p>
        <p className="text-[12.5px] leading-[1.45] text-ink2 break-keep">{body}</p>
        {action ? (
          <Btn variant="ghost" size="sm" className="mt-2 min-h-11" onClick={onSwap}>
            {action}
          </Btn>
        ) : null}
      </div>
    </div>
  )
}

/** 2,000자 자르기 줄(D3-A, 데모 `.trim`). 「자르기 전」↔「잘랐음」도 같은 버튼 요소의 글만 바뀐다. */
function TrimRow({ removed, done, onClick }: { removed: number; done: boolean; onClick: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
      <p id="paste-trim" aria-live="polite" className="min-w-0 flex-[1_1_170px] text-[12.5px] text-ink2 break-keep">
        {done ? PASTE_TRIM.done(removed) : PASTE_TRIM.hint(removed)}
      </p>
      <Btn variant="ghost" size="sm" className="min-h-11" aria-describedby="paste-trim" onClick={onClick}>
        {done ? PASTE_TRIM.undo : PASTE_TRIM.action}
      </Btn>
    </div>
  )
}

export default function LessonPasteScreen({ fromShare = false }: { fromShare?: boolean }) {
  const toast = useToast()
  const { show } = toast
  const { create, busy } = useLessonCreate(show)
  const [text, setText] = useState('')
  const [noJa, setNoJa] = useState(false)
  const [banner, setBanner] = useState<ShareBannerState | null>(null)
  /** 띠의 되돌리기 상대편 글(쓰던 글 ↔ 공유한 글). 이 화면 상태에만 — 저장소·서버·로그에 싣지 않는다(D2-A). */
  const [alt, setAlt] = useState<string | null>(null)
  /** 자르기 전 원문과 뺀 글자 수. 입력칸을 고치면 지운다. */
  const [trim, setTrim] = useState<{ full: string; removed: number } | null>(null)
  const [scrollSeq, setScrollSeq] = useState(0)
  /** 도착 판단(`prev`)은 상태 클로저가 아니라 이 ref 를 읽는다 — 초안 복원 직후 도착해도 쓰던 글을 놓치지 않게. */
  const textRef = useRef('')
  const handledRef = useRef(false)
  /** 한 번만 주는 값을 두 경로(마운트·신호)가 겹쳐 꺼내지 않게. */
  const consumingRef = useRef(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  const put = useCallback((t: string) => {
    textRef.current = t
    setText(t)
    setNoJa(false)
    writeStore('session', LESSON_KEYS.pasteDraft, t || null)
  }, [])

  const applyShare = useCallback(
    (raw: string): boolean => {
      const r = arriveShare(textRef.current, raw)
      if (r.kind === 'empty') {
        show(PASTE_SHARE.empty, SHARE_TOAST_MS)
        return false
      }
      put(r.text)
      setAlt(r.alt)
      setBanner(r.banner)
      setTrim(null)
      return true
    },
    [put, show],
  )

  useEffect(() => {
    const d = readStore('session', LESSON_KEYS.pasteDraft) ?? ''
    textRef.current = d
    if (d) queueMicrotask(() => setText(d))
    if (!fromShare || handledRef.current) return
    handledRef.current = true
    // 뒤로·앞으로 가기로 다시 그려지면 캐시된 prop 은 여전히 true 다 — 표시를 지운 뒤의 주소로 한 번 더 확인한다.
    if (new URLSearchParams(window.location.search).get('from') !== 'share') return
    window.history.replaceState(null, '', SHARE_PASTE_PATH)
    if (!isNativeApp()) return
    // 취소 플래그로 결과를 버리지 않는다 — 한 번만 주는 값이라 버리면 잃는다(StrictMode 두 번째 실행은 handledRef 가 막는다).
    consumingRef.current = true
    void consumeSharedText().then((r) => {
      consumingRef.current = false
      if (r) applyShare(r.text)
      else show(PASTE_SHARE.lost, SHARE_TOAST_MS)
    })
  }, [fromShare, applyShare, show])

  useEffect(() => {
    if (!isNativeApp()) return
    const onShare = () => {
      // 만드는 중이면 네이티브에 남겨 둔다 — 다음 resume 에 셸이 다시 확인한다.
      if (busy || consumingRef.current) return
      consumingRef.current = true
      void consumeSharedText().then((r) => {
        consumingRef.current = false
        if (r && applyShare(r.text)) setScrollSeq((n) => n + 1)
      })
    }
    window.addEventListener(SHARE_EVENT, onShare)
    return () => window.removeEventListener(SHARE_EVENT, onShare)
  }, [busy, applyShare])

  useEffect(() => {
    if (scrollSeq > 0) bannerRef.current?.scrollIntoView({ block: 'nearest' })
  }, [scrollSeq])

  const m = pasteMeta(text)
  const cutRemoved = useMemo(() => (!trim && m.n > MAX ? trimRemoved(text, MAX) : 0), [trim, m.n, text])

  const swap = () => {
    if (alt === null || !banner || banner.kind === 'arrived') return
    const s = swapShare(text, alt, banner)
    put(s.text)
    setAlt(s.alt)
    setBanner(s.banner)
    setTrim(null)
  }

  const cut = () => {
    const next = trimToLimit(text, MAX)
    setTrim({ full: text, removed: charCount(text) - charCount(next) })
    put(next)
  }

  const uncut = () => {
    if (!trim) return
    put(trim.full)
    setTrim(null)
  }

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
        {banner ? <ShareBanner ref={bannerRef} state={banner} onSwap={swap} /> : null}
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
              put(e.target.value)
              setTrim(null)
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
          {trim ? (
            <TrimRow done removed={trim.removed} onClick={uncut} />
          ) : m.n > MAX ? (
            <TrimRow done={false} removed={cutRemoved} onClick={cut} />
          ) : null}
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
