'use client'

/**
 * 표현 점검 결과 `/study/ai/chat/[chatId]/review`(screens.md §3-2 D·§3-3 점검). 점검은 **이 화면이 소유**한다:
 * 안내 → [점검 받기] → 진행(동기 ≤90s / 잡 #55 폴링 / 409 재조회) → 결과. 새로고침·재방문에도 같은 결과를 복원한다
 * (#34 교정 + ADD_STUDY_LOG payload 의 총평 — task-006 D3·D4).
 *
 * 스크롤은 앱 셸 `main` 하나(머리 `BackBar` 는 sticky). 교정·제안 카드의 상태 변경은 응답 후 로컬로만 반영하고,
 * 409 때만 목록을 다시 읽는다. `dropped`(원문 불일치로 버린 수)는 내부 품질 지표라 보이지 않는다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, LoadingBlock } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import type {
  ChatDetail,
  ChatInfo,
  CorrectionDto,
  CorrectionRejectResponse,
  JobDto,
  Paged,
  ProposalDto,
  ReviewItemDto,
  ReviewJobResponse,
  ReviewSyncResponse,
  StudyLogPayload,
} from '@/types/chat'
import AcceptCorrectionSheet from './AcceptCorrectionSheet'
import CorrectionCard from './CorrectionCard'
import { toErr } from './errors'
import { actionErrorText } from './labels'
import ProposalCard from './ProposalCard'
import { ReviewIntro, ReviewProgress, ReviewSummary, type ReviewSummaryData } from './ReviewParts'
import { KEYS, readStore, writeStore } from './storage'

type View = 'loading' | 'notFound' | 'notChat' | 'intro' | 'running' | 'result' | 'error'
type Filter = 'remaining' | 'all'

interface RunState {
  mode: 'sync' | 'job' | 'waiting'
  startedAt: number
  progress: number | null
}

const FAIL_TEXT = '점검을 끝내지 못했어요. 잠시 후 다시 시도해 주세요.'
const CHECK_FAIL_TEXT = '점검 상태를 확인하지 못했어요.'
const JOB_MAX_MS = 10 * 60_000
const WAIT_409_MS = 180_000
const WAIT_NETWORK_MS = 120_000
const MAX_CORRECTION_PAGES = 3

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function normalizeItem(it: ReviewItemDto): CorrectionDto {
  return {
    id: it.correctionId,
    messageId: it.messageId,
    status: it.status,
    original: it.original,
    corrected: it.corrected,
    explanation: it.explanation ?? it.explanationKo ?? '',
    errorType: it.errorType,
    severity: it.severity,
    chunkType: it.chunkType ?? null,
    savedWordId: null,
  }
}

function summaryFromPayload(p: ProposalDto | null): ReviewSummaryData | null {
  if (!p) return null
  const pl = p.payload as StudyLogPayload
  return { summaryKo: pl.summaryKo ?? null, strengths: pl.strengths ?? null, focus: pl.focus ?? null, skippedMessages: pl.skippedMessages ?? null }
}

/** `#cr_<id>` 로 들어왔으면 그 교정 id. */
function hashTarget(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash
  return h.startsWith('#cr_') ? decodeURIComponent(h.slice(4)) : null
}

export default function ChatReview({ chatId }: { chatId: string }) {
  const router = useRouter()
  const toast = useToast()
  const [view, setView] = useState<View>('loading')
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [run, setRun] = useState<RunState | null>(null)
  const [errorView, setErrorView] = useState<{ text: string; action: 'retry' | 'recheck' }>({ text: FAIL_TEXT, action: 'retry' })
  const [introError, setIntroError] = useState<string | null>(null)
  const [corrections, setCorrections] = useState<CorrectionDto[]>([])
  const [studyLog, setStudyLog] = useState<ProposalDto | null>(null)
  const [summary, setSummary] = useState<ReviewSummaryData | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [acceptTarget, setAcceptTarget] = useState<CorrectionDto | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const alive = useRef(true)
  /** 폴링 루프 세대 — 새 루프가 시작되면 이전 루프는 스스로 멈춘다(개발 모드 이중 실행·[다시 확인] 반복). */
  const gen = useRef(0)
  const chatPath = `/api/v1/chats/${encodeURIComponent(chatId)}`
  const roomHref = `/study/ai/chat/${encodeURIComponent(chatId)}`

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const fail = useCallback((text: string, action: 'retry' | 'recheck') => {
    if (!alive.current) return
    setErrorView({ text, action })
    setView('error')
  }, [])

  /** 결과 화면을 연다. 해시로 들어온 교정이 "남은 교정" 필터에 없으면 전체로 바꾼다. */
  const showResult = useCallback((list: CorrectionDto[]) => {
    const target = hashTarget()
    const hasPending = list.some((c) => c.status === 'PROPOSED')
    const targetItem = target ? list.find((c) => c.id === target) : undefined
    setCorrections(list)
    setTouched(new Set())
    setFilter(hasPending && (!targetItem || targetItem.status === 'PROPOSED') ? 'remaining' : 'all')
    setHighlightId(targetItem ? targetItem.id : null)
    setView('result')
  }, [])

  const fetchCorrections = useCallback(async (): Promise<CorrectionDto[]> => {
    const all: CorrectionDto[] = []
    let cursor: string | null = null
    for (let page = 0; page < MAX_CORRECTION_PAGES; page++) {
      const q = new URLSearchParams({ chatId, limit: '100' })
      if (cursor) q.set('cursor', cursor)
      const r: Paged<CorrectionDto> = await apiGet<Paged<CorrectionDto>>(`/api/v1/corrections?${q.toString()}`)
      all.push(...r.items)
      cursor = r.nextCursor
      if (!cursor) break
    }
    return all
  }, [chatId])

  const fetchStudyLog = useCallback(async (): Promise<ProposalDto | null> => {
    try {
      const r = await apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}&kind=ADD_STUDY_LOG`)
      return r.items.find((p) => p.kind === 'ADD_STUDY_LOG') ?? null
    } catch {
      return null
    }
  }, [chatId])

  /** 재방문·잡 완료 경로: 교정 목록 + 공부 기록 제안(총평 보관처). */
  const loadResult = useCallback(async () => {
    try {
      const [list, sl] = await Promise.all([fetchCorrections(), fetchStudyLog()])
      if (!alive.current) return
      setStudyLog(sl)
      setSummary(summaryFromPayload(sl))
      showResult(list)
    } catch (e) {
      if (!alive.current) return
      if (toErr(e).status === 404) setView('notFound')
      else fail(CHECK_FAIL_TEXT, 'recheck')
    }
  }, [fetchCorrections, fetchStudyLog, showResult, fail])

  /** 교정 목록만 다시(409 뒤). 총평·필터는 그대로 둔다. */
  const refreshCorrections = useCallback(async () => {
    try {
      const list = await fetchCorrections()
      if (alive.current) setCorrections(list)
    } catch {
      /* 다음 동작에서 다시 맞춘다 */
    }
  }, [fetchCorrections])

  const readChat = useCallback(async (): Promise<ChatInfo> => {
    const d = await apiGet<ChatDetail>(`${chatPath}?limit=1`)
    if (alive.current) setChat(d.chat)
    return d.chat
  }, [chatPath])

  /** 점검 끝(`reviewedAt`)을 기다린다 — 409(다른 점검 진행 중)·네트워크 끊김 뒤. */
  const waitReviewed = useCallback(
    async (maxMs: number) => {
      const my = ++gen.current
      const live = () => alive.current && gen.current === my
      const start = Date.now()
      if (live()) setRun({ mode: 'waiting', startedAt: start, progress: null })
      while (live() && Date.now() - start < maxMs) {
        await sleep(3_000)
        if (!live()) return
        try {
          const c = await readChat()
          if (c.reviewedAt) {
            await loadResult()
            return
          }
        } catch (e) {
          if (toErr(e).status === 404) {
            if (live()) setView('notFound')
            return
          }
        }
      }
      if (live()) fail(CHECK_FAIL_TEXT, 'recheck')
    },
    [readChat, loadResult, fail],
  )

  const waitJob = useCallback(
    async (jobId: string) => {
      const my = ++gen.current
      const live = () => alive.current && gen.current === my
      const start = Date.now()
      if (live()) setRun({ mode: 'job', startedAt: start, progress: null })
      while (live()) {
        const elapsed = Date.now() - start
        if (elapsed > JOB_MAX_MS) {
          fail(CHECK_FAIL_TEXT, 'recheck')
          return
        }
        await sleep(elapsed < 30_000 ? 2_000 : 5_000)
        if (!live()) return
        try {
          const j = await apiGet<JobDto>(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
          if (!live()) return
          setRun((r) => (r ? { ...r, progress: typeof j.progress === 'number' ? j.progress : null } : r))
          if (j.status === 'DONE') {
            writeStore('session', KEYS.reviewJob(chatId), null)
            await readChat().catch(() => null)
            await loadResult()
            return
          }
          if (j.status === 'FAILED') {
            writeStore('session', KEYS.reviewJob(chatId), null)
            fail(FAIL_TEXT, 'retry')
            return
          }
        } catch (e) {
          if (toErr(e).status === 404) {
            // 잡이 사라졌다(재시작 정리 등) — 채팅 상태로 판단한다.
            writeStore('session', KEYS.reviewJob(chatId), null)
            try {
              const c = await readChat()
              if (!live()) return
              if (c.reviewedAt) await loadResult()
              else setView('intro')
            } catch {
              fail(CHECK_FAIL_TEXT, 'recheck')
            }
            return
          }
          // 네트워크 오류는 다음 간격에 다시.
        }
      }
    },
    [chatId, readChat, loadResult, fail],
  )

  /** 채팅 상태로 갈래를 정한다: 점검됨 → 결과 / 진행 중 잡 → 폴링 / 아니면 안내. */
  const decide = useCallback(
    async (c: ChatInfo) => {
      if (!alive.current) return
      setChat(c)
      if (c.kind !== 'CHAT') {
        setView('notChat')
        return
      }
      if (c.reviewedAt) {
        await loadResult()
        return
      }
      const job = readStore('session', KEYS.reviewJob(chatId))
      if (job) {
        setView('running')
        await waitJob(job)
        return
      }
      setView('intro')
    },
    [chatId, loadResult, waitJob],
  )

  const readFailed = useCallback(
    (e: unknown) => {
      if (!alive.current) return
      if (toErr(e).status === 404) setView('notFound')
      else fail(CHECK_FAIL_TEXT, 'recheck')
    },
    [fail],
  )

  /** [다시 확인] */
  const recheck = async () => {
    try {
      const d = await apiGet<ChatDetail>(`${chatPath}?limit=1`)
      await decide(d.chat)
    } catch (e) {
      readFailed(e)
    }
  }

  useEffect(() => {
    const token = gen.current
    // gen 은 DOM 노드가 아니라 세대 번호다 — 정리 시점의 "현재 값"을 올려 이 effect 가 띄운 루프를 멈추는 것이 의도다.
    const cancelLoops = () => {
      gen.current += 1
    }
    apiGet<ChatDetail>(`${chatPath}?limit=1`)
      .then((d) => (gen.current === token ? decide(d.chat) : undefined))
      .catch(readFailed)
    return cancelLoops
  }, [chatPath, decide, readFailed])

  // 해시로 들어온 교정 카드로 스크롤 + 2초 강조.
  useEffect(() => {
    if (view !== 'result' || !highlightId) return
    const el = document.getElementById(`cr_${highlightId}`)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    const t = setTimeout(() => setHighlightId(null), 2_000)
    return () => clearTimeout(t)
  }, [view, highlightId])

  const start = async () => {
    setIntroError(null)
    setView('running')
    setRun({ mode: 'sync', startedAt: Date.now(), progress: null })
    try {
      // 중단하지 않는다 — 화면을 떠나도 서버가 끝까지 처리·저장한다(D3).
      const r = await apiPost<ReviewSyncResponse | ReviewJobResponse>(`${chatPath}/review`, {})
      if (!alive.current) return
      if ('jobId' in r && r.jobId) {
        writeStore('session', KEYS.reviewJob(chatId), r.jobId)
        await waitJob(r.jobId)
        return
      }
      const sync = r as ReviewSyncResponse
      setChat((c) => (c ? { ...c, reviewedAt: sync.reviewedAt ?? c.reviewedAt } : c))
      setSummary({
        summaryKo: sync.summaryKo ?? null,
        strengths: sync.strengths ?? null,
        focus: sync.focus ?? null,
        skippedMessages: sync.skippedMessages ?? null,
      })
      showResult((sync.items ?? []).map(normalizeItem))
      const sl = await fetchStudyLog()
      if (alive.current) setStudyLog(sl)
    } catch (e) {
      if (!alive.current) return
      const err = toErr(e)
      if (err.status === 409) {
        try {
          const c = await readChat()
          if (c.reviewedAt) await loadResult()
          else await waitReviewed(WAIT_409_MS)
        } catch {
          fail(CHECK_FAIL_TEXT, 'recheck')
        }
      } else if (err.status === 0) {
        await waitReviewed(WAIT_NETWORK_MS)
      } else if (err.status === 400) {
        setIntroError(err.message || actionErrorText(err))
        setView('intro')
      } else if (err.status === 404) {
        setView('notFound')
      } else {
        fail(FAIL_TEXT, 'retry')
      }
    }
  }

  const reject = async (c: CorrectionDto) => {
    if (busyId) return
    setBusyId(c.id)
    try {
      const r = await apiPost<CorrectionRejectResponse>(`/api/v1/corrections/${encodeURIComponent(c.id)}/reject`)
      setCorrections((list) => list.map((x) => (x.id === c.id ? { ...x, status: r.status, resolvedAt: r.resolvedAt } : x)))
      setTouched((s) => new Set(s).add(c.id))
      toast.show('무시했어요 · 기록에 남지 않아요')
    } catch (e) {
      const err = toErr(e)
      if (err.status === 409) {
        toast.show('이미 처리된 교정이에요')
        void refreshCorrections()
      } else {
        toast.show(actionErrorText(err))
      }
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    total: corrections.length,
    accepted: corrections.filter((c) => c.status === 'ACCEPTED').length,
    rejected: corrections.filter((c) => c.status === 'REJECTED').length,
    pending: corrections.filter((c) => c.status === 'PROPOSED').length,
  }
  // "남은 교정" 에서 방금 처리한 카드가 바로 사라지면 결과 문구를 못 본다 — 이번 방문에 손댄 카드는 남겨 둔다.
  const visible = filter === 'remaining' ? corrections.filter((c) => c.status === 'PROPOSED' || touched.has(c.id)) : corrections

  let body: React.ReactNode
  if (view === 'loading') {
    body = <LoadingBlock />
  } else if (view === 'notFound') {
    body = (
      <div role="alert" className="rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold break-keep">채팅을 찾을 수 없어요</p>
        <Link href="/study/ai?tab=chat" className="mt-3 inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold">
          채팅 목록으로
        </Link>
      </div>
    )
  } else if (view === 'notChat') {
    body = (
      <div className="rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[15px] break-keep">표현 점검은 채팅에서만 할 수 있어요.</p>
        <Link href="/study/ai?tab=chat" className="mt-3 inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold">
          채팅 목록으로
        </Link>
      </div>
    )
  } else if (view === 'intro') {
    body = (
      <ReviewIntro
        messageCount={chat?.messageCount ?? 0}
        error={introError}
        onStart={() => void start()}
        onBack={() => router.push(roomHref)}
        onBlocked={toast.show}
      />
    )
  } else if (view === 'running') {
    body = <ReviewProgress startedAt={run?.startedAt ?? 0} progress={run?.progress ?? null} waiting={run?.mode === 'waiting'} />
  } else if (view === 'error') {
    body = (
      <div role="alert" className="rounded-[14px] border border-bad-soft bg-bad-soft p-4 text-bad">
        <p className="text-[14px] break-keep">{errorView.text}</p>
        <Btn
          variant="ghost"
          className="mt-3"
          onClick={() => {
            if (errorView.action === 'retry') void start()
            else {
              setView('loading')
              void recheck()
            }
          }}
        >
          {errorView.action === 'retry' ? '다시 점검하기' : '다시 확인'}
        </Btn>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-ink2 break-keep">선생님의 교정은 제안이에요. 채택한 것만 내 기록과 단어장에 남아요.</p>
        <ReviewSummary summary={summary} counts={counts} />
        {studyLog ? <ProposalCard proposal={studyLog} onChange={setStudyLog} onToast={toast.show} /> : null}
        {counts.total === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center text-[14px] text-ink2 break-keep">
            고칠 곳을 찾지 못했어요. 자연스럽게 잘 썼어요!
          </div>
        ) : (
          <>
            <Segmented<Filter>
              ariaLabel="교정 보기"
              options={[
                { value: 'remaining', label: `남은 교정 ${counts.pending}` },
                { value: 'all', label: `전체 ${counts.total}` },
              ]}
              value={filter}
              onChange={(v) => {
                setFilter(v)
                setTouched(new Set())
              }}
            />
            <ul className="flex min-w-0 flex-col gap-3">
              {visible.map((c) => (
                <CorrectionCard
                  key={c.id}
                  correction={c}
                  index={corrections.indexOf(c) + 1}
                  total={counts.total}
                  busy={busyId === c.id}
                  highlighted={highlightId === c.id}
                  onAccept={setAcceptTarget}
                  onReject={(x) => void reject(x)}
                />
              ))}
            </ul>
          </>
        )}
        <Btn variant="ghost" className="w-full" onClick={() => router.push(roomHref)}>
          대화로 돌아가기
        </Btn>
      </div>
    )
  }

  return (
    <>
      <BackBar sticky backHref={roomHref} backLabel="대화로 돌아가기" title="표현 점검" subtitle={chat?.title} />
      <div className="px-4 pt-3" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
        {body}
      </div>
      <AcceptCorrectionSheet
        key={acceptTarget?.id ?? 'none'}
        correction={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onDone={(updated, withWord) => {
          setCorrections((list) => list.map((x) => (x.id === updated.id ? updated : x)))
          setTouched((s) => new Set(s).add(updated.id))
          setAcceptTarget(null)
          toast.show(withWord ? '채택하고 단어장에 넣었어요' : '채택했어요')
        }}
        onConflict={() => {
          setAcceptTarget(null)
          toast.show('이미 처리된 교정이에요')
          void refreshCorrections()
        }}
      />
      <Toast message={toast.message} />
    </>
  )
}
