'use client'

/**
 * 휴대폰 인식 진단(screens §11-2 I, Leader ⑯) — **관리자(`engine.read`) + 앱 + 플러그인**에서만. F6 실측 게이트(5초 발화 디코드 ≤0.8s·
 * RSS ≤600MB)를 adb 없이 폰에서 읽는 자리. 값은 마운트·[다시 읽기] 때만 읽고(폴링 없음), 이 휴대폰 안에만 있다(저장·전송 없음).
 * "최근 발화"는 이번 앱 실행의 마지막 휴대폰 인식 final 의 길이·디코드 시간(글자·소리 없음).
 */
import { useCallback, useEffect, useState } from 'react'
import { Badge, Btn, BtnRow, Card, Section, SectionHeader } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { useOnDeviceModel } from '@/components/speech/useOnDeviceModel'
import { lastOnDeviceTimings } from '@/modules/speech/stt/client'
import type { OnDeviceDiagnostics } from '@/modules/infra/native'

const GATE_DECODE_MS = 800
const GATE_RSS_MB = 600
const GATE_MIN_SPEECH_MS = 5000

export const DIAG_COPY = {
  title: '휴대폰 인식 진단',
  adminOnly: '관리자에게만 보여요',
  recognizer: '인식기',
  loadTime: '불러오기 시간',
  lastUtterance: '최근 발화',
  memory: '메모리',
  fileVersion: '파일 버전',
  build: '앱 구성',
  loaded: (n: number | null) => (n ? `불러옴 · 스레드 ${n}` : '불러옴'),
  notLoaded: '안 불러옴',
  seconds: (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}초`,
  utterance: (d: number, t: number | null) => (t === null ? `${(d / 1000).toFixed(1)}초 말함` : `${(d / 1000).toFixed(1)}초 말함 → ${(t / 1000).toFixed(2)}초 만에 알아들음`),
  none: '아직 없음',
  memoryValue: (rss: number | null, heap: number | null) => [rss !== null ? `앱 ${Math.round(rss)}MB` : null, heap !== null ? `Java ${Math.round(heap)}MB` : null].filter(Boolean).join(' · ') || '—',
  buildValue: (v: string | null, abi: string | null) => [v ? `플러그인 ${v}` : null, abi].filter(Boolean).join(' · ') || '—',
  over: '기준 초과',
  reread: '다시 읽기',
  preload: '미리 불러오기',
  loading: '불러오는 중…',
  note: '측정값은 이 휴대폰 안에만 있어요. 서버로 보내지 않아요.',
  failed: '진단 값을 읽지 못했어요. 다시 눌러 주세요.',
} as const

export default function OnDeviceDiagnosticsCard({ show }: { show: boolean }) {
  const { native, ready } = useNativeEnv()
  if (!show || !ready || !native) return null
  return <Diagnostics />
}

function Diagnostics() {
  const m = useOnDeviceModel(null)
  const [diag, setDiag] = useState<OnDeviceDiagnostics | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [last, setLast] = useState(lastOnDeviceTimings())
  const { readDiagnostics } = m

  const read = useCallback(async () => {
    setFailed(false)
    setLast(lastOnDeviceTimings())
    try {
      setDiag(await readDiagnostics())
    } catch {
      setFailed(true)
    }
    // 스토어 동작은 싱글턴이라 안정적이다 — 마운트 때 한 번만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void read()
  }, [read])

  if (m.snap.phase === 'unsupported') return null

  const preload = async () => {
    setLoading(true)
    try {
      setLoadMs((await m.preload(diag?.numThreads)).loadMs)
      await read()
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const loadShown = loadMs ?? diag?.lastLoadMs ?? null
  const decodeOver = !!last && last.durationMs >= GATE_MIN_SPEECH_MS && last.decodeMs !== null && last.decodeMs > GATE_DECODE_MS
  const rssOver = typeof diag?.rssMb === 'number' && diag.rssMb > GATE_RSS_MB
  const row = (label: string, value: React.ReactNode, over = false) => (
    <>
      <dt className="text-[13px] text-ink2">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right text-[14px] text-ink tabular-nums break-keep">
        {value}
        {over ? <Badge tone="bad">{DIAG_COPY.over}</Badge> : null}
      </dd>
    </>
  )

  return (
    <Section>
      <SectionHeader title={DIAG_COPY.title} right={<span className="text-[12px] text-ink2">{DIAG_COPY.adminOnly}</span>} />
      <Card>
        <dl data-ondevice-diagnostics className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
          {row(DIAG_COPY.recognizer, diag?.recognizerLoaded ? DIAG_COPY.loaded(diag.numThreads ?? null) : DIAG_COPY.notLoaded)}
          {row(DIAG_COPY.loadTime, loadShown !== null ? DIAG_COPY.seconds(loadShown) : '—')}
          {row(DIAG_COPY.lastUtterance, last ? DIAG_COPY.utterance(last.durationMs, last.decodeMs) : DIAG_COPY.none, decodeOver)}
          {row(DIAG_COPY.memory, DIAG_COPY.memoryValue(diag?.rssMb ?? null, diag?.javaHeapMb ?? null), rssOver)}
          {row(DIAG_COPY.fileVersion, diag?.modelVersion ?? '—')}
          {row(DIAG_COPY.build, DIAG_COPY.buildValue(diag?.pluginVersion ?? null, diag?.abi ?? null))}
        </dl>
        {failed ? (
          <p role="alert" className="mt-2 text-[13px] text-bad">
            {DIAG_COPY.failed}
          </p>
        ) : null}
        <BtnRow>
          <Btn variant="ghost" onClick={() => void read()}>
            {DIAG_COPY.reread}
          </Btn>
          <Btn variant="ghost" onClick={() => void preload()} disabled={loading || !m.snap.installed}>
            {loading ? DIAG_COPY.loading : DIAG_COPY.preload}
          </Btn>
        </BtnRow>
        <p className="mt-2 text-[12px] text-ink2 break-keep">{DIAG_COPY.note}</p>
      </Card>
    </Section>
  )
}
