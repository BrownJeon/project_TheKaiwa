/**
 * TTS 재생(screens §7-3 B) — 싱글턴 `AudioContext`. 자동재생 정책(Chrome·안드로이드 WebView `mediaPlaybackRequiresUserGesture`) 때문에
 * **탭 핸들러 안에서 동기로 `unlockTtsAudio()`** 를 불러 컨텍스트를 깨운 뒤, 받은 wav 를 `playWav` 로 재생한다.
 * 컨텍스트가 깨어 있지 않으면 `NotAllowedError` 를 던진다(호출자가 "눌러서 듣기" 로 한 번 더 누르게 한다).
 * `AudioContext` 가 없는 환경만 `HTMLAudioElement` + object URL(정지·종료 시 revoke). task-007 재생 큐가 같은 컨텍스트를 쓴다.
 */

export interface TtsPlayback {
  stop(): void
  ended: Promise<void>
}

type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null
const active = new Set<TtsPlayback>()

function ctor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** 탭 핸들러 안에서 **동기로** 부른다(첫 await 앞). 없으면 만들고, 멈춰 있으면 깨운다. */
export function unlockTtsAudio(): void {
  const C = ctor()
  if (!C) return
  if (!ctx) ctx = new C()
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
}

function notAllowed(): DOMException {
  return new DOMException('재생이 허용되지 않았습니다', 'NotAllowedError')
}

async function playWithElement(buf: ArrayBuffer): Promise<TtsPlayback> {
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  const el = new Audio(url)
  let done: () => void = () => undefined
  const ended = new Promise<void>((res) => (done = res))
  const cleanup = () => {
    URL.revokeObjectURL(url)
    done()
  }
  el.addEventListener('ended', cleanup, { once: true })
  el.addEventListener('error', cleanup, { once: true })
  try {
    await el.play()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return {
    stop() {
      el.pause()
      cleanup()
    },
    ended,
  }
}

export async function playWav(buf: ArrayBuffer): Promise<TtsPlayback> {
  if (!ctor()) return playWithElement(buf)
  if (!ctx) throw notAllowed()
  if (ctx.state !== 'running') {
    await ctx.resume().catch(() => undefined)
    if ((ctx.state as AudioContextState) !== 'running') throw notAllowed()
  }
  const audio = await ctx.decodeAudioData(buf.slice(0))
  const src = ctx.createBufferSource()
  src.buffer = audio
  src.connect(ctx.destination)
  let done: () => void = () => undefined
  const ended = new Promise<void>((res) => (done = res))
  const playback: TtsPlayback = {
    stop() {
      try {
        src.stop()
      } catch {
        // 이미 끝났다.
      }
      done()
    },
    ended,
  }
  src.onended = () => {
    active.delete(playback)
    done()
  }
  active.add(playback)
  src.start()
  return playback
}

export function stopAllTts(): void {
  for (const p of [...active]) p.stop()
  active.clear()
}
