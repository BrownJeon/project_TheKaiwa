'use client'

/**
 * 일본어 칸(표현·예문) 하나의 「글자로/말로」 전환(task-069, 수업 ④ 「말로 쓰기」와 같은 모양). 라벨 줄 오른쪽에 전환 버튼이 있고,
 * 말로 쓰는 동안은 입력 칸 자리에 「누르고 말하기」가 온다 — 결과는 칸에 들어가며 글자 모드로 돌아와 사용자가 고친 뒤 저장한다.
 *
 * 쓸 수 없는 환경(비보안 주소·지원 안 함·서버 인식 꺼짐·마이크 거부…)이면 버튼을 숨기지 않고 막은 채 이유 한 줄을 보인다.
 * 키보드 입력은 어떤 경우에도 그대로다(`children` = 원래 입력 칸).
 */
import { useEffect, useRef, useState } from 'react'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import { MIC_TEST_COPY, sttErrorCopy } from '@/components/speech/sttCopy'
import SttAlert from '@/components/talk/SttAlert'
import { WORD_MIC_COPY } from './labels'
import { micResultFocus, type WordMic, type WordMicTarget } from './wordMic'

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  )
}

export default function WordMicField({
  mic,
  target,
  idPrefix,
  value,
  label,
  children,
}: {
  mic: WordMic
  target: WordMicTarget
  idPrefix: string
  /** 칸의 지금 값 — 말로 쓰는 동안 칸 자리에 보여 준다 */
  value: string
  label: React.ReactNode
  children: React.ReactNode
}) {
  const { native } = useNativeEnv()
  const open = mic.target === target
  // 열려 있는 칸은 막힌 상태여도 글자로 돌아갈 수 있어야 한다.
  const off = !open && mic.blocked !== null
  const whyId = `${idPrefix}_${target}_mic_why`
  const statusId = `${idPrefix}_${target}_mic_status`
  const fieldName = WORD_MIC_COPY.field[target]
  const v = mic.voice
  const err = open ? v.error : null
  const why = off && mic.blocked ? sttErrorCopy(mic.blocked, { native, canOpenSettings: false, place: 'talk' }) : null
  const announce = mic.announce && mic.announce.target === target ? mic.announce : null
  const hint = WORD_MIC_COPY.hint[target]
  // 결과가 들어가면 칸이 글자 모드로 닫히며 누르고 말하기 버튼이 사라진다 — 항상 그려지는 전환 버튼으로 포커스를 옮긴다(마운트 때는 옮기지 않는다).
  const toggleRef = useRef<HTMLButtonElement>(null)
  const seenN = useRef(announce?.n ?? null)
  useEffect(() => {
    if (!micResultFocus(seenN.current, announce)) return
    seenN.current = announce?.n ?? null
    toggleRef.current?.focus()
  }, [announce])
  // 화면 읽기용 줄에 확인 안내를 합칠지는 **결과가 들어온 그 순간**의 안내 상태로 한 번 정한다 — 안내가 거두어질 때(고침·다시 열기·단계 넘어감) 줄의 글이 되돌아가
  // 같은 「알아들은 말」이 다시 읽히지 않게. 렌더 중 상태 갱신은 새 결과(n)를 처음 볼 때만 한다.
  const [srCheck, setSrCheck] = useState({ n: announce?.n ?? null, on: mic.notice[target] })
  if (announce && srCheck.n !== announce.n) setSrCheck({ n: announce.n, on: mic.notice[target] })

  return (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        {label}
        <button
          ref={toggleRef}
          type="button"
          aria-label={`${fieldName} ${open ? WORD_MIC_COPY.byText : WORD_MIC_COPY.byVoice}`}
          aria-disabled={off || undefined}
          aria-describedby={why ? whyId : undefined}
          onClick={() => mic.toggle(target)}
          className={`inline-flex h-11 flex-none items-center gap-1 text-[13px] font-medium text-ink underline underline-offset-4 ${off ? 'opacity-40' : ''}`}
        >
          {open ? <KeyboardIcon /> : <MicIcon />}
          {open ? WORD_MIC_COPY.byText : WORD_MIC_COPY.byVoice}
        </button>
      </div>
      {why ? (
        <p id={whyId} className="text-[12px] text-ink2 break-keep">
          {why.title}
          {mic.blocked === 'MIC_DENIED' ? ` ${why.action}` : ''}
        </p>
      ) : null}
      {open ? (
        <div className="flex min-w-0 flex-col items-center gap-2">
          <div aria-hidden="true" className="min-h-16 w-full min-w-0 rounded-xl border border-dashed border-line px-3 py-2.5">
            {v.recording && v.partial ? (
              <p lang="ja" className="text-[17px] text-ink2 [overflow-wrap:anywhere]">
                {v.partial}…
              </p>
            ) : value ? (
              <p lang="ja" className="line-clamp-3 text-[17px] text-ink [overflow-wrap:anywhere] whitespace-pre-wrap">
                {value}
              </p>
            ) : (
              <span className="text-[13px] text-ink2">{WORD_MIC_COPY.voiceBox}</span>
            )}
          </div>
          {err ? (
            <div className="w-full min-w-0">
              <SttAlert
                code={err.code}
                retryAfterSec={err.retryAfterSec}
                mountCheck={err.mountCheck}
                switched={err.switched}
                offlineMode={err.offlineMode}
                native={native}
                textMode={false}
                textModeLabel={WORD_MIC_COPY.byText}
                onTextMode={() => {
                  mic.dismissError()
                  mic.close(target)
                  toggleRef.current?.focus()
                }}
                onClose={mic.dismissError}
              />
            </div>
          ) : null}
          <p className="w-full text-[12px] text-ink2 break-keep">
            {typeof hint === 'string' ? (
              hint
            ) : (
              <>
                {hint[0]}
                <span lang="ja">{hint[1]}</span>
                {hint[2]}
              </>
            )}
          </p>
          <PushToTalkButton phase={v.phase} label={v.pttLabel} describedBy={statusId} onPress={v.press} onRelease={v.release} onAbort={v.abort} />
          <div id={statusId} className="flex h-6 min-w-0 max-w-full items-center justify-center gap-2 text-[13px] text-ink2">
            <MicLevelMeter db={v.db} active={v.phase === 'recording'} />
            <span className="min-w-0 truncate break-keep">{v.statusText}</span>
          </div>
        </div>
      ) : (
        <>
          {children}
          {mic.notice[target] ? (
            // 읽기는 아래 화면 읽기용 줄이 「알아들은 말」과 한 번에 맡는다(새로 끼우는 상태 줄은 읽기 프로그램에 따라 안 읽힐 수 있어서) — 이중 낭독 방지로 눈에만 보인다.
            <p aria-hidden="true" className="text-[12px] text-ink2 break-keep">
              {WORD_MIC_COPY.checkNotice}
            </p>
          ) : null}
        </>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announce ? `${MIC_TEST_COPY.announcePrefix}${announce.text}${srCheck.on ? `. ${WORD_MIC_COPY.checkNotice}` : ''}` : ''}
      </span>
    </>
  )
}
