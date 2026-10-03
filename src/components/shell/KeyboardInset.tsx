'use client'

/**
 * 키보드 공통 처리(task-021, IMP-0008 · 데모 v1 R1~R7) — 루트 레이아웃에 **한 번** 마운트한다.
 * 화면마다 키보드를 따로 재지 않는다(R1). 여기서 `<html>` 에 두 가지를 쓰고, 화면은 CSS 로만 따른다.
 *
 *  - `data-kb="open"` — 키보드가 열려 있다. 하단 탭을 숨기고(D1 A) 입력 바·시트 아래 제스처 바 여백을 없앤다(R2) — globals.css.
 *  - `--kb-inset` — 키보드가 화면을 덮기만 하는 브라우저에서 덮인 높이. 앱 셸·시트·토스트가 그만큼 올라간다(R2·R4·R7).
 *    화면 자체가 줄어드는 환경(모바일 Chrome `resizes-content`)에서는 0 이다 — 이미 키보드 위까지로 줄었다.
 *
 * 그리고 키보드가 열린 뒤(또는 열린 채 다른 칸으로 옮기면) 입력 칸이 키보드 위 16px 이상에 오도록 그 칸의 스크롤 영역만
 * 한 번 옮긴다(R4 시트 안쪽·R5 스크롤 폼). `scrollIntoView` 를 쓰지 않는 이유: 붙박이 헤더·키보드 여유를 모른다.
 *
 * ⚠ 앱(Android 15 edge-to-edge WebView)은 지금 키보드가 떠도 창도 visualViewport 도 줄지 않는다 — Capacitor 가 키보드
 * 인셋을 WebView 에 넘기지 않기 때문이다(`CapacitorWebView.edgeToEdgeHandler` 가 시스템 바만 margin 으로 주고 CONSUMED).
 * 그 환경에서는 여기서 아무것도 바뀌지 않는다(지금과 같음). 창을 키보드만큼 줄이는 네이티브 보정이 들어오면 ① 경로로 같이 동작한다.
 */
import { useEffect } from 'react'
import { INITIAL_BASELINE, baselineFor, isTextEntry, keyboardState, resetBaseline, revealDelta, trackBaseline } from './keyboard'

/** 키보드가 다 올라온 뒤(마지막 resize 뒤) 스크롤해야 위치가 맞는다. */
const SETTLE_MS = 120

function focusedTextEntry(): HTMLElement | null {
  const el = document.activeElement
  return el instanceof HTMLElement && isTextEntry(el) ? el : null
}

/** 입력 칸을 품은 가장 가까운 세로 스크롤 영역(시트 본문·main·대화 목록). 스크롤할 것이 없으면 null. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p
  }
  return null
}

/** 스크롤 영역 안 붙박이 헤더(AppBar·sticky BackBar)의 아래 끝 — 입력 칸을 그 밑으로 밀어 넣지 않게. */
function stickyHeaderBottom(sc: HTMLElement): number {
  const h = sc.querySelector('header')
  return h && getComputedStyle(h).position === 'sticky' ? h.getBoundingClientRect().bottom : Number.NEGATIVE_INFINITY
}

export default function KeyboardInset() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    const coarse = window.matchMedia?.('(pointer: coarse)')
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let baseline = INITIAL_BASELINE
    let open = false
    let inset = 0
    let lastHeight = 0
    let raf = 0
    let settle: number | undefined

    const reveal = () => {
      const el = focusedTextEntry()
      // 아래에 붙은 입력 바(채팅방·회화방·수업 ⑤)는 셸이 키보드 위에 붙인다(R2) — 스크롤로 옮기면 방 전체가 밀린다.
      if (!open || !el || el.closest('[data-kb-docked]') || (vv && vv.scale > 1.01)) return
      const sc = scrollParent(el)
      if (!sc) return
      const box = sc.getBoundingClientRect()
      const field = el.getBoundingClientRect()
      const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
      const d = revealDelta({
        fieldTop: field.top,
        fieldBottom: field.bottom,
        visibleTop: Math.max(box.top, stickyHeaderBottom(sc)),
        visibleBottom: Math.min(box.bottom, viewBottom),
      })
      if (d !== 0) sc.scrollBy({ top: d, behavior: reduce?.matches ? 'auto' : 'smooth' })
    }

    const scheduleReveal = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(reveal, SETTLE_MS)
    }

    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const textFocused = focusedTextEntry() !== null
      baseline = trackBaseline(baseline, { width: w, innerHeight: h, textFocused, now: performance.now() })
      const next = keyboardState({
        innerHeight: h,
        baselineHeight: baselineFor(baseline, w, h),
        vvHeight: vv ? vv.height : null,
        vvOffsetTop: vv?.offsetTop ?? 0,
        vvScale: vv?.scale ?? 1,
        textFocused,
        coarsePointer: coarse?.matches ?? false,
      })
      const changed = next.open !== open || next.insetPx !== inset || h !== lastHeight
      lastHeight = h
      if (next.insetPx !== inset) {
        inset = next.insetPx
        root.style.setProperty('--kb-inset', `${inset}px`)
      }
      if (next.open !== open) {
        open = next.open
        if (open) root.dataset.kb = 'open'
        else delete root.dataset.kb
      }
      // 열렸을 때·키보드 높이가 바뀌었을 때(추천 단어 띠 등)만 — 사용자가 직접 옮긴 스크롤을 되돌리지 않는다.
      if (open && changed) scheduleReveal()
    }

    const onViewport = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const onFocusIn = () => {
      onViewport()
      // 키보드가 열린 채 다음 칸으로 옮겼다 — 창 크기는 그대로라 measure 만으로는 스크롤하지 않는다.
      if (open) scheduleReveal()
    }
    const onReset = () => {
      baseline = resetBaseline(baseline)
      onViewport()
    }

    root.style.setProperty('--kb-inset', '0px')
    measure()
    vv?.addEventListener('resize', onViewport)
    vv?.addEventListener('scroll', onViewport)
    window.addEventListener('resize', onViewport)
    // focusout 직후에는 activeElement 가 아직 바뀌기 전일 수 있다 — 다음 프레임에 잰다.
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onViewport)
    window.addEventListener('orientationchange', onReset)
    document.addEventListener('visibilitychange', onReset)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(settle)
      vv?.removeEventListener('resize', onViewport)
      vv?.removeEventListener('scroll', onViewport)
      window.removeEventListener('resize', onViewport)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onViewport)
      window.removeEventListener('orientationchange', onReset)
      document.removeEventListener('visibilitychange', onReset)
      root.style.removeProperty('--kb-inset')
      delete root.dataset.kb
    }
  }, [])

  return null
}
