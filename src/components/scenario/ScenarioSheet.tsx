'use client'

/**
 * 상황 시트(가이드 §3-C — v1 `#sc-sheet` + 대화 순서·이어서 하기·내 상황 고치기/지우기). 공용 `Sheet`(무변경) 안에서
 * 아래 버튼 줄만 시트 스크롤 안 `sticky`(입력칸이 없는 시트라 키보드 규칙과 무관 — 가이드 §9 M-4).
 * 상세는 열 때 S2 로 읽는다(목록 실패여도 딥링크 시트는 따로 열린다). 시작은 S5, 지우기는 #165.
 * 표현 ▶ 는 사용자 목소리 설정 그대로(#23), 표시등이 자막만이면 숨긴다.
 * task-045 S10: 행동 줄은 출처별(#179 로 내 버전 판정) — 내 상황 [고치기·지우기(#165 보관)] · 기본 [고치기·지우기(#165 = 나에게서 숨기기)] ·
 * 내 버전 [고치기·기본으로 되돌리기(#176)]. 상세와 #179 가 둘 다 온 뒤 한 번에 그린다(자리 44px 고정 — 늦게 붙는 버튼으로 줄이 밀리지 않게).
 * 확인은 기존 인라인 확인 자리(위쪽, 열면 제목 초점·취소하면 연 버튼 초점). 관리 화면 아래에서 열리면 [고치기]가 `?from=manage` 를 단다.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { apiDelete, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { useKeyedResource } from '@/components/plan/usePlanData'
import Sheet from '@/components/common/Sheet'
import { Badge, Btn } from '@/components/common/ui'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { SOUND_MSG, SOUND_RETRYING, soundText } from '@/components/vocab/wordSound'
import { ErrorBox, Skeleton } from '@/components/challenge/parts'
import type { ScenarioDetail } from '@/types/scenario'
import type { SeedOverrideItem } from '@/types/seedOverride'
import { scenarioFailure } from './failure'
import { DifficultyDots } from './ScenarioCard'
import { dateLabel, josa, requiredOf, seedIdOfCopy, sheetOrigin, type SheetOrigin } from './logic'
import { HOME, OUTCOME_KO, scenarioEditHref, SHEET } from './scenarioCopy'
import { useKeyedSound } from './useKeyedSound'
import { useScenarioDetail } from './useScenarioDetail'
import { useStartRolePlay } from './useStartRolePlay'

export interface ScenarioSheetProps {
  /** 열린 상황(null 이면 닫힘). */
  id: string | null
  onClose: () => void
  /** 초안 저장 직후(`?saved=1`) — 맨 위 한 줄. */
  saved?: boolean
  /** 수업 종료 카드에서 열었을 때(B3) — 안내 한 줄 + 시작 요청에 `lessonId`. */
  fromLesson?: { lessonId: string; title: string } | null
  /** 지우기·숨기기·되돌리기 성공(또는 이미 목록에 없음) — 목록 다시 읽기·토스트(`toast` 문구)는 부르는 쪽. */
  onDeleted?: (id: string, toast: string) => void
  /** `sh-404` [다른 상황 고르기] — 기본은 닫기. */
  onPickOther?: () => void
}

const btnGhostDanger = 'border-bad text-bad'
const overridesPath = () => '/api/v1/seed-overrides?kind=SCENARIO'

type ConfirmKind = 'delete' | 'hide' | 'revert'
const CONFIRM_OF: Record<Exclude<SheetOrigin, 'MINE_UNSURE'>, ConfirmKind> = { MINE: 'delete', SEED: 'hide', COPY: 'revert' }

export default function ScenarioSheet({ id, onClose, saved = false, fromLesson = null, onDeleted, onPickOther }: ScenarioSheetProps) {
  const detail = useScenarioDetail(id)
  const start = useStartRolePlay()
  const sound = useKeyedSound()
  const overrides = useKeyedResource<{ items?: SeedOverrideItem[] }>(id ? `so:${id}` : null, overridesPath)
  const fromManage = (usePathname() ?? '').startsWith('/settings/scenarios')
  const [confirmDel, setConfirmDel] = useState<ConfirmKind | null>(null)
  const [delState, setDelState] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [delFail, setDelFail] = useState<string | null>(null)
  const delHeadId = useId()
  const delHeadRef = useRef<HTMLHeadingElement>(null)
  const delBtnRef = useRef<HTMLButtonElement>(null)
  const starting = start.state.phase === 'starting'
  const busy = starting || delState === 'busy'

  const { stop: stopSound } = sound
  const { reset: resetStart } = start
  const close = useCallback(() => {
    if (busy) return
    stopSound()
    resetStart()
    setConfirmDel(null)
    setDelState('idle')
    onClose()
  }, [busy, stopSound, resetStart, onClose])

  useEffect(() => {
    if (confirmDel) delHeadRef.current?.focus()
  }, [confirmDel])

  const soItems = overrides.status === 'ready' ? (Array.isArray(overrides.data?.items) ? overrides.data.items : []) : null

  const done = (sid: string, toast: string) => {
    stopSound()
    setConfirmDel(null)
    setDelState('idle')
    // 목록이 없는 곳(수업 카드·결과 화면)은 받을 쪽이 없으니 시트만 닫는다(숨긴·지운 상황을 계속 보여 주지 않게).
    if (onDeleted) onDeleted(sid, toast)
    else onClose()
  }

  const remove = async (s: ScenarioDetail, kind: ConfirmKind) => {
    if (delState === 'busy') return
    const ctx = kind === 'delete' ? 'scenarioDelete' : kind === 'hide' ? 'scenarioHide' : 'scenarioRevert'
    const seedId = kind === 'revert' ? seedIdOfCopy(s.id, soItems) : null
    setDelState('busy')
    setDelFail(null)
    try {
      if (kind === 'revert') {
        if (!seedId) throw new Error('no seed')
        await apiPost('/api/v1/seed-overrides/restore', { kind: 'SCENARIO', seedId })
        done(s.id, SHEET.reverted)
      } else {
        await apiDelete(`/api/v1/scenarios/${encodeURIComponent(s.id)}`)
        done(s.id, kind === 'hide' ? SHEET.hidden(s.title) : HOME.deleted)
      }
    } catch (e) {
      const f = scenarioFailure(ctx, toErr(e))
      // 이미 목록에 없거나 이미 기본으로 돌아가 있으면 시트를 닫고 목록을 다시 읽는다(같은 결과).
      if (f.kind === 'gone' || f.kind === 'notOverridden') return done(s.id, f.text)
      setDelFail(f.text)
      setDelState('failed')
    }
  }

  const gone = (detail.status === 'error' && detail.errStatus === 404) || (start.state.phase === 'failed' && start.state.failure === 'gone')

  return (
    <Sheet open={id !== null} title={SHEET.title} onClose={close} dismissible={!busy}>
      {detail.status === 'loading' ? (
        <div className="pb-4">
          <Skeleton heights={[26, 18, 120]} label={SHEET.loadingSr} />
        </div>
      ) : gone ? (
        <GoneBlock onPick={() => (onPickOther ? (close(), onPickOther()) : close())} />
      ) : detail.status === 'error' || !detail.data ? (
        <div className="pb-4">
          <ErrorBox title={SHEET.error} onRetry={detail.reload} retryLabel={SHEET.retry} />
        </div>
      ) : (
        <SheetBody
          s={detail.data}
          saved={saved}
          fromLesson={fromLesson}
          sound={sound}
          confirmDel={confirmDel}
          delState={delState}
          delHeadId={delHeadId}
          delHeadRef={delHeadRef}
          delBtnRef={delBtnRef}
          origin={overrides.status === 'loading' ? null : sheetOrigin(detail.data, soItems)}
          editHref={scenarioEditHref(detail.data.id, fromManage ? 'manage' : null)}
          delFail={delFail}
          onAskDelete={(kind) => {
            setDelState('idle')
            setDelFail(null)
            setConfirmDel(kind)
          }}
          onCancelDelete={() => {
            setConfirmDel(null)
            setDelState('idle')
            requestAnimationFrame(() => delBtnRef.current?.focus())
          }}
          onDelete={() => confirmDel && void remove(detail.data!, confirmDel)}
          footer={
            <StartBar
              s={detail.data}
              phase={start.state}
              disabled={delState === 'busy'}
              onStart={() => void start.start(detail.data!.id, { lessonId: fromLesson?.lessonId ?? null })}
              onResume={(chatId) => {
                stopSound()
                start.resume(chatId)
              }}
              onClose={close}
            />
          }
        />
      )}
    </Sheet>
  )
}

function GoneBlock({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col gap-2 pb-4">
      <p className="text-[15px] font-semibold">{SHEET.goneTitle}</p>
      <p className="text-[13px] text-ink2 break-keep">{SHEET.goneBody}</p>
      <Btn variant="ghost" className="mt-2 w-full" onClick={onPick}>
        {SHEET.goneBtn}
      </Btn>
    </div>
  )
}

function SheetBody({
  s,
  saved,
  fromLesson,
  sound,
  confirmDel,
  delState,
  delHeadId,
  delHeadRef,
  delBtnRef,
  origin,
  editHref,
  delFail,
  onAskDelete,
  onCancelDelete,
  onDelete,
  footer,
}: {
  s: ScenarioDetail
  saved: boolean
  fromLesson: { lessonId: string; title: string } | null
  sound: ReturnType<typeof useKeyedSound>
  confirmDel: ConfirmKind | null
  delState: 'idle' | 'busy' | 'failed'
  delHeadId: string
  delHeadRef: React.RefObject<HTMLHeadingElement | null>
  delBtnRef: React.RefObject<HTMLButtonElement | null>
  /** null = #179 를 읽는 중(행동 줄 자리만 둔다). */
  origin: SheetOrigin | null
  editHref: string
  delFail: string | null
  onAskDelete: (kind: ConfirmKind) => void
  onCancelDelete: () => void
  onDelete: () => void
  footer: React.ReactNode
}) {
  const tts = useTtsRuntimeStatus()
  const textOnly = tts.snapshot.state === 'TEXT_ONLY'
  const ann = useAnnotations(s.keyExpressions.map((e) => e.ja))
  const n = s.keyExpressions.length
  const m = requiredOf(n, s.requiredExpressions)
  const place = s.topics[0]?.title ?? null
  const voice = !textOnly && s.keyExpressions.some((e) => soundText(e.ja))
  const last = s.last && Object.prototype.hasOwnProperty.call(OUTCOME_KO, s.last.outcome) ? s.last : null
  const tutorJ = josa(s.roles.tutor, '이', '가')
  const confirmKind = origin && origin !== 'MINE_UNSURE' ? CONFIRM_OF[origin] : null
  const badge = origin === 'SEED' ? SHEET.badgeSeed : origin === 'COPY' ? SHEET.badgeCopy : origin === 'MINE' || origin === 'MINE_UNSURE' ? SHEET.mineBadge : null

  return (
    <div className="flex min-w-0 flex-col">
      {confirmDel ? (
        <div role="group" aria-labelledby={delHeadId} aria-busy={delState === 'busy' || undefined} className="mb-3 rounded-[14px] border border-line bg-surface2 p-3.5">
          <h3 id={delHeadId} ref={delHeadRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
            {confirmDel === 'revert' ? SHEET.revertTitle : confirmDel === 'hide' ? SHEET.hideTitle : SHEET.deleteTitle}
          </h3>
          {confirmDel === 'hide' ? (
            <p className="mt-1 text-[13px] text-ink2 break-keep">
              <b className="font-semibold text-ink">{SHEET.hideBodyStrong}</b> {SHEET.hideBodyRest}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-ink2 break-keep">{confirmDel === 'revert' ? SHEET.revertBody : SHEET.deleteBody}</p>
          )}
          {delState === 'failed' ? (
            <p role="alert" className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
              {delFail ?? SHEET.deleteFail}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <Btn variant="ghost" className={btnGhostDanger} aria-busy={delState === 'busy' || undefined} aria-disabled={delState === 'busy' || undefined} onClick={() => delState !== 'busy' && onDelete()}>
              {delState === 'busy'
                ? confirmDel === 'revert'
                  ? SHEET.reverting
                  : confirmDel === 'hide'
                    ? SHEET.hiding
                    : SHEET.deleting
                : confirmDel === 'revert'
                  ? SHEET.revertConfirm
                  : confirmDel === 'hide'
                    ? SHEET.hideConfirm
                    : SHEET.deleteConfirm}
            </Btn>
            <Btn variant="ghost" aria-disabled={delState === 'busy' || undefined} onClick={() => delState !== 'busy' && onCancelDelete()}>
              {SHEET.deleteCancel}
            </Btn>
          </div>
        </div>
      ) : null}

      <p className="text-[18px] font-semibold leading-snug [overflow-wrap:anywhere]">{s.title}</p>
      {s.titleJa ? (
        <p lang="ja" className="text-[14px] text-ink2 [overflow-wrap:anywhere]">
          {s.titleJa}
        </p>
      ) : null}
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
        <Badge>{s.level}</Badge>
        <DifficultyDots value={s.difficulty} />
        {place ? <span>{place}</span> : null}
        {badge ? <Badge>{badge}</Badge> : null}
      </p>

      {saved ? (
        <p role="status" className="mt-3 rounded-xl bg-good-soft px-3 py-2 text-[13px] font-semibold text-good">
          {SHEET.saved}
        </p>
      ) : null}
      {fromLesson ? (
        <p className="mt-2 text-[13px] text-ink2 break-keep">
          {SHEET.fromLessonBefore}
          <span lang="ja">{fromLesson.title}</span>
          {SHEET.fromLessonAfter}
        </p>
      ) : null}

      <div role="group" aria-label={SHEET.rolesAria} className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl bg-surface2 p-3">
          <p className="text-[12px] text-ink2">{SHEET.me}</p>
          <p className="text-[15px] font-semibold [overflow-wrap:anywhere]">{s.roles.learner}</p>
        </div>
        <div className="min-w-0 rounded-xl bg-surface2 p-3">
          <p className="text-[12px] text-ink2">{SHEET.tutor}</p>
          <p className="text-[15px] font-semibold [overflow-wrap:anywhere]">{s.roles.tutor}</p>
        </div>
      </div>

      <div className="mt-3 rounded-[14px] bg-accent-soft p-3.5">
        <p className="text-[12px] text-ink2">{SHEET.goalLabel}</p>
        <p className="text-[15px] text-ink break-keep">{s.goal.communicativeGoalKo}</p>
        {s.goal.successCriteria.length ? (
          <>
            <p className="mt-2 text-[12px] text-ink">{SHEET.successLabel}</p>
            <ol className="mt-1 list-decimal pl-5 text-[14px] break-keep">
              {s.goal.successCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ol>
          </>
        ) : null}
      </div>

      {s.steps.length ? (
        <section className="mt-[18px]">
          <h3 className="text-[15px] font-semibold">{SHEET.stepsTitle}</h3>
          <p className="text-[12px] text-ink2">{SHEET.stepsSub(s.steps.length)}</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {s.steps.map((st, i) => (
              <li key={i} className="flex min-w-0 items-start gap-2 text-[14px]">
                <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-surface2 text-[12px] font-semibold text-ink2">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">{st.ko}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-[18px]">
        <h3 className="text-[15px] font-semibold">{SHEET.exprTitle(n)}</h3>
        <p className="text-[12px] text-ink2 break-keep">{SHEET.exprSub(n, m, voice)}</p>
        <ul className="mt-1">
          {s.keyExpressions.map((e, i) => (
            <ExprRow key={e.id} ja={e.ja} ko={e.ko} soundKey={e.id} state={ann[i]} sound={sound} canPlay={!textOnly && !!soundText(e.ja)} />
          ))}
        </ul>
        {textOnly ? (
          <p role="status" className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-[13px] text-ink2 break-keep">
            {SHEET.textOnly}
          </p>
        ) : null}
      </section>

      {last ? (
        <p className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-[13px] break-keep">
          {SHEET.prev(dateLabel(last.at), OUTCOME_KO[last.outcome], last.usedCount, last.totalCount)}
        </p>
      ) : null}

      <p className="mt-3 text-[12px] text-ink2 break-keep">
        {s.opening ? SHEET.leadOpening(tutorJ) : SHEET.leadNoOpening(tutorJ, josa(s.roles.learner, '이', '가'))}
      </p>

      <div className="mt-2 flex min-h-11 gap-2">
        {origin ? (
          <>
            <Link href={editHref} className="inline-flex h-11 items-center px-1 text-[13px] font-semibold text-accent">
              {SHEET.edit}
            </Link>
            {confirmKind ? (
              <button ref={delBtnRef} type="button" aria-haspopup="true" onClick={() => onAskDelete(confirmKind)} className="inline-flex h-11 items-center px-1 text-[13px] font-semibold text-bad">
                {confirmKind === 'revert' ? SHEET.revert : SHEET.delete}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {footer}
    </div>
  )
}

function ExprRow({
  ja,
  ko,
  soundKey,
  state,
  sound,
  canPlay,
}: {
  ja: string
  ko: string
  soundKey: string
  state: ReturnType<typeof useAnnotations>[number]
  sound: ReturnType<typeof useKeyedSound>
  canPlay: boolean
}) {
  const view = sound.view(soundKey)
  const line = sound.line(soundKey)
  const text = soundText(ja)
  const label = view.phase === 'playing' ? SHEET.exprStop(ja) : view.busy ? SHEET.exprLoading(ja) : SHEET.exprListen(ja)
  return (
    <li className="flex min-w-0 items-start gap-2 border-t border-line py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <JaText text={ja} state={state} className="text-[16px] [overflow-wrap:anywhere]" rt={11} leading={2.1} />
        <HangulLine state={state} size={12} />
        <p className="text-[13px] text-ink2 break-keep">{ko}</p>
        {line.kind === 'msg' ? (
          <p role={SOUND_MSG[line.msg].role} className={`text-[12px] break-keep ${SOUND_MSG[line.msg].tone === 'bad' ? 'text-bad' : 'text-ink2'}`}>
            {SOUND_MSG[line.msg].text}
            {SOUND_MSG[line.msg].retry && text ? (
              <button type="button" onClick={() => sound.retry(soundKey, text)} className="ml-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]">
                {SOUND_MSG[line.msg].retry}
              </button>
            ) : null}
          </p>
        ) : line.kind === 'retrying' ? (
          <p role="status" className="text-[12px] text-ink2">
            {SOUND_RETRYING}
          </p>
        ) : (
          <span role="status" className="sr-only">
            {line.text}
          </span>
        )}
      </div>
      {canPlay && text ? (
        <button
          type="button"
          aria-label={label}
          aria-busy={view.busy || undefined}
          onClick={() => sound.tap(soundKey, text)}
          className={`grid h-11 w-11 flex-none place-items-center rounded-full border text-[14px] ${view.look === 'on' ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink'}`}
        >
          <span aria-hidden="true">{view.phase === 'playing' ? '■' : '▶'}</span>
        </button>
      ) : null}
    </li>
  )
}

function StartBar({
  s,
  phase,
  disabled,
  onStart,
  onResume,
  onClose,
}: {
  s: ScenarioDetail
  phase: ReturnType<typeof useStartRolePlay>['state']
  disabled: boolean
  onStart: () => void
  onResume: (chatId: string) => void
  onClose: () => void
}) {
  const starting = phase.phase === 'starting'
  const failure = phase.phase === 'failed' ? phase.failure : null
  const blocked = starting || disabled
  const resumeId = s.inProgressChatId ?? null
  return (
    // 긴 시트에서는 스크롤 영역 맨 아래에 붙어 시트 본문의 아래 여백이 사라진다 — 하단 고정 줄 공통 규칙(Composer·StageSpeak)으로 제스처 바를 비킨다.
    <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 'max(8px, var(--safe-bottom))' }}>
      {failure && failure !== 'gone' ? (
        <p role="alert" className="mb-2 rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
          {failure === 'archived' ? SHEET.archived : failure === 'rate' ? SHEET.startRate : SHEET.startFail}
        </p>
      ) : null}
      {resumeId ? (
        <>
          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <Btn aria-disabled={blocked || undefined} onClick={() => !blocked && onResume(resumeId)}>
              {SHEET.resume}
            </Btn>
            <Btn variant="ghost" aria-disabled={blocked || undefined} aria-busy={starting || undefined} onClick={() => !blocked && onStart()}>
              {starting ? SHEET.starting : SHEET.restart}
            </Btn>
          </div>
          <p className="mt-1.5 text-[12px] text-ink2 break-keep">{SHEET.resumeNote}</p>
        </>
      ) : (
        <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn aria-disabled={blocked || undefined} aria-busy={starting || undefined} onClick={() => !blocked && onStart()}>
            {starting ? SHEET.starting : SHEET.start}
          </Btn>
          <Btn variant="ghost" aria-disabled={starting || undefined} onClick={() => !starting && onClose()}>
            {SHEET.close}
          </Btn>
        </div>
      )}
    </div>
  )
}
