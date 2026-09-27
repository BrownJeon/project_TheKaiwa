'use client'

/**
 * 세트 결과(screens.md §5-2 E) — 세트가 `DONE` 이면 같은 경로에서 이 화면을 그린다(새로고침·재방문·보관 세트 열기가 한 곳).
 * 개수·걸린 시간·보관 여부는 #49 세션(F4)을 먼저, 없으면 #51 응답, 그래도 없으면 카드로 센다.
 * 보관(#52)·다시 풀기(#53)는 응답 뒤에 반영한다. 다시 풀기는 **보관한 세트만**(F7).
 * 여기서는 `main` 이 스크롤되고(BackBar sticky) 탭 바가 없어서 하단 Toast 를 쓴다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, BtnRow, Card } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import type { CreateSessionResult, FinishResult, VocabCard, VocabSessionInfo } from '@/types/vocab'
import { tallyCards } from './deck'
import { formatDuration, formatSessionDate } from './format'
import { putSession, VOCAB_KEYS } from './hooks'
import { actionErrorText, FLASH, MODE_LABEL } from './labels'
import WordResultList from './WordResultList'

function StatTile({ label, value, tone }: { label: string; value: number; tone: 'good' | 'bad' | 'none' }) {
  const top = tone === 'good' ? 'border-t-good' : tone === 'bad' ? 'border-t-bad' : 'border-t-ink3'
  return (
    <div className={`min-w-0 rounded-xl border border-line border-t-4 bg-surface px-2.5 py-2 ${top}`}>
      <p className="text-[22px] font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[12px] text-ink2">{label}</p>
    </div>
  )
}

export default function VocabResult({
  session,
  cards,
  finish,
  today,
  flash,
  onFlashShown,
  onSession,
}: {
  session: VocabSessionInfo
  cards: VocabCard[]
  finish: FinishResult | null
  today: string
  flash: string | null
  onFlashShown: () => void
  onSession: (s: VocabSessionInfo) => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [keeping, setKeeping] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const { show } = toast

  useEffect(() => {
    if (!flash) return
    show(flash)
    onFlashShown()
  }, [flash, onFlashShown, show])

  const t = tallyCards(cards)
  const n = session.cardCount || cards.length
  const correct = session.correctCount ?? finish?.session.correctCount ?? t.correct
  const wrong = session.wrongCount ?? finish?.session.wrongCount ?? t.wrong
  const skipped = session.skippedCount ?? finish?.session.skippedCount ?? Math.max(0, n - t.correct - t.wrong)
  const duration = formatDuration(session.durationSec ?? finish?.session.durationSec ?? null)
  const flagged = t.flagged
  const kept = !!session.keptAt
  const base = `/api/v1/vocab/sessions/${encodeURIComponent(session.id)}`

  const keep = async (next: boolean) => {
    if (keeping) return
    setKeeping(true)
    try {
      const r = await apiPost<Partial<VocabSessionInfo>>(`${base}/keep`, { kept: next })
      const keptAt = r && 'keptAt' in r ? (r.keptAt ?? null) : next ? new Date().toISOString() : null
      onSession({ ...session, keptAt })
      show(next ? '보관했어요 · 오늘 탭 ‘보관한 세트’에서 다시 풀 수 있어요' : '보관을 풀었어요')
    } catch (e) {
      const err = toErr(e)
      show(err.status === 409 ? '끝난 세트만 보관할 수 있어요' : actionErrorText(err))
    } finally {
      setKeeping(false)
    }
  }

  const replay = async () => {
    if (replaying) return
    setReplaying(true)
    try {
      const r = await apiPost<CreateSessionResult>(`${base}/replay`)
      if (r.session) {
        if (r.session.downgraded) putSession(VOCAB_KEYS.notice(r.session.id), 'deleted')
        router.push(`/study/today/words/${encodeURIComponent(r.session.id)}`)
        return
      }
      setReplaying(false)
      show(actionErrorText({ status: -1 }))
    } catch (e) {
      const err = toErr(e)
      setReplaying(false)
      if (err.status === 409) {
        putSession(VOCAB_KEYS.flash, FLASH.finishFirst)
        router.push('/study/today')
        return
      }
      show(actionErrorText(err))
    }
  }

  const wrongCards = cards.filter((c) => c.answer === 'WRONG')
  const flaggedCards = cards.filter((c) => c.flagged)
  const dateLabel = formatSessionDate(session.date, today)

  return (
    <>
      <BackBar backHref="/study/today" backLabel="오늘로" title="세트 결과" subtitle={`${dateLabel} · ${MODE_LABEL[session.mode]} · ${n}장`} sticky />
      <div className="mx-auto w-full min-w-0 max-w-[520px] px-4 pb-8 pt-3">
        <Card>
          <p className="text-[22px] font-semibold break-keep">
            {n}장 중 {correct}장 {session.mode === 'FLIP' ? '알았어요' : '맞혔어요'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label="맞힘" value={correct} tone="good" />
            <StatTile label="틀림" value={wrong} tone="bad" />
            <StatTile label="건너뜀" value={skipped} tone="none" />
          </div>
          <p className="mt-2 text-[13px] text-ink2 break-keep">
            {duration ? `걸린 시간 ${duration} · ` : ''}다시 볼 카드 {flagged}장
          </p>
          {session.replayOfId ? <p className="text-[12px] text-ink2 break-keep">보관한 세트를 다시 푼 결과예요.</p> : null}
        </Card>

        <Card flat className="mt-3">
          {kept ? (
            <>
              <p className="text-[15px]">★ 보관한 세트예요</p>
              <BtnRow>
                <Btn onClick={() => void replay()} aria-disabled={replaying || undefined} aria-busy={replaying || undefined}>
                  {replaying ? '만드는 중…' : '다시 풀기'}
                </Btn>
                <Btn variant="ghost" onClick={() => void keep(false)} aria-disabled={keeping || undefined} aria-busy={keeping || undefined}>
                  보관 풀기
                </Btn>
              </BtnRow>
            </>
          ) : (
            <>
              <Btn variant="ghost" className="w-full" onClick={() => void keep(true)} aria-disabled={keeping || undefined} aria-busy={keeping || undefined}>
                ☆ 이 세트 보관
              </Btn>
              <p className="mt-1.5 text-[12px] text-ink2 break-keep">보관하면 오늘 탭에서 같은 단어로 다시 풀 수 있어요.</p>
            </>
          )}
        </Card>

        <WordResultList title={`틀린 단어 ${wrongCards.length}`} cards={wrongCards} showResult={false} />
        <WordResultList title={`다시 볼 카드 ${flaggedCards.length}`} cards={flaggedCards} showResult={false} />
        <details className="mt-4">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-[14px] font-medium">전체 카드 {n}장 보기</summary>
          <WordResultList cards={cards} showResult />
        </details>

        <BtnRow>
          <Link href="/study/today" className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent">
            오늘로
          </Link>
          <Link href="/drawer/words" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
            단어장 보기
          </Link>
        </BtnRow>
      </div>
      <Toast message={toast.message} />
    </>
  )
}
