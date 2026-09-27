'use client'

/**
 * 가져오기 시트(screens.md §10-2 G): 파일(≤256KB) + 방식(MERGE / REPLACE_SCOPE — 끄기 위험) → [변경 내용 미리 보기](dryRun) → 결과 →
 * **오류 0 이고 바뀌는 것이 있을 때만** 이유 → [적용]. REPLACE_SCOPE 의 끄기 수는 방식 설명·결과·확정 버튼 세 곳에서 말한다.
 */
import { useId } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { LEXICON_CSV_COLUMNS, type LexiconImportMode, type LexiconImportResultDto } from '@/types/lexicon'
import ImportReview from './ImportReview'
import { NOTICE_ACTION_LABEL, QUICK_REASONS } from './lexiconCopy'
import { RadioCards, type RadioCardOption } from './ScopePicker'
import SheetNotice from './SheetNotice'
import { canApply, useLexiconImport } from './useLexiconImport'
import WriteConfirmFields from './WriteConfirmFields'

const MODE_OPTIONS: RadioCardOption<LexiconImportMode>[] = [
  { value: 'MERGE', code: 'MERGE', text: '합치기 — 파일의 항목을 추가하거나, 같은 표기·범위의 항목을 파일 값으로 고쳐요. 파일에 없는 항목은 그대로 둬요.' },
  {
    value: 'REPLACE_SCOPE',
    code: 'REPLACE_SCOPE',
    text: '범위 바꾸기 — 파일에 나온 범위(예: GLOBAL)를 파일 내용으로 통째로 바꿔요.',
    warn: '⚠ 그 범위에서 파일에 없는 항목은 모두 꺼져요.',
  },
]

const GHOST_LABEL = 'flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink'

export default function LexiconImportSheet({
  needsConfirm,
  onClose,
  onApplied,
  onRefreshList,
}: {
  needsConfirm: boolean
  onClose: () => void
  onApplied: (res: LexiconImportResultDto) => void
  onRefreshList: () => void
}) {
  const uid = useId()
  const fileId = `${uid}-file`
  const im = useLexiconImport(needsConfirm, onApplied)
  const busy = im.step === 'checking' || im.step === 'applying'
  const r = im.review
  const disable = r?.counts.disable ?? 0

  const noticeAction = im.notice?.value.action
  const notice = im.notice
    ? {
        text: im.notice.value.text,
        action: noticeAction
          ? {
              label: NOTICE_ACTION_LABEL[noticeAction],
              onClick: () => {
                im.clearNotice()
                if (noticeAction === 'redryRun' || noticeAction === 'reload') void im.dryRun()
                else if (noticeAction === 'refreshList') onRefreshList()
              },
            }
          : undefined,
      }
    : null

  return (
    <Sheet open title="사전 가져오기" onClose={onClose} dismissible={!busy}>
      <input
        id={fileId}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="sr-only"
        onChange={(e) => {
          im.setFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <label htmlFor={fileId} className={GHOST_LABEL}>
        {im.file ? '다른 파일 고르기' : '파일 고르기 (CSV · JSON)'}
      </label>
      {im.file ? (
        <p className="mt-1 truncate text-[13px]">
          {im.file.name} · {Math.max(1, Math.ceil(im.file.size / 1024))}KB
        </p>
      ) : null}
      {im.fileError ? <p className="mt-1 text-[12px] text-bad break-keep">{im.fileError}</p> : null}
      <details className="mt-2">
        <summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">파일 형식</summary>
        <p className="text-[12.5px] text-ink2">CSV(UTF-8) 첫 줄:</p>
        <code className="block font-mono text-[12px] [overflow-wrap:anywhere]">{LEXICON_CSV_COLUMNS.join(',')}</code>
        <p className="mt-1 text-[12.5px] text-ink2 break-keep">JSON: 같은 키를 가진 객체의 배열 · 최대 2,000행 · 256KB · 내보내기 파일을 그대로 다시 올릴 수 있어요.</p>
        <p className="mt-1 text-[12.5px] text-ink2 break-keep">빈 칸은 기본값이고, 없는 칸(짧은 행·없는 열)은 기존 값을 그대로 둬요. 꺼진 항목은 enabled 를 true 로 적어야 다시 켜져요.</p>
      </details>
      <div className="mt-3">
        <RadioCards options={MODE_OPTIONS} value={im.mode} onChange={im.setMode} ariaLabel="가져오는 방식" />
      </div>
      <Btn variant="ghost" className="mt-3 w-full" aria-busy={im.step === 'checking'} disabled={busy} onClick={() => void im.dryRun()}>
        {im.step === 'checking' ? '파일을 확인하는 중…' : '변경 내용 미리 보기'}
      </Btn>
      {im.step === 'pick' && notice ? <SheetNotice notice={notice} /> : null}

      {r && (im.step === 'reviewed' || im.step === 'applying') ? (
        <>
          <ImportReview result={r} mode={im.mode} />
          {r.counts.error > 0 ? (
            <p className="mt-3 text-[13px] text-ink break-keep">오류가 있는 행을 고친 파일로 다시 확인해 주세요. 오류가 0 일 때만 적용할 수 있어요.</p>
          ) : !canApply(r) ? (
            <p className="mt-3 text-[13px] text-ink">바뀌는 항목이 없어요 — 지금 사전과 같아요.</p>
          ) : (
            <>
              <hr className="my-4 border-line" />
              <WriteConfirmFields
                reason={im.reason}
                onReason={im.setReason}
                confirm={im.confirm}
                onConfirm={im.setConfirm}
                needsConfirm={needsConfirm}
                quick={QUICK_REASONS.import}
                errors={im.metaText}
              />
              {notice ? <SheetNotice notice={notice} /> : null}
              <p className="mt-2 text-[12px] text-ink2">적용하면 사전 v{r.baseVersion + 1} 이 만들어져요.</p>
              <BtnRow>
                <Btn variant="primary" aria-busy={im.step === 'applying'} onClick={() => void im.apply()}>
                  {im.step === 'applying' ? '적용하는 중…' : `${needsConfirm ? 'PRODUCTION 에 적용' : '적용'}${disable > 0 ? ` (${disable}개 끄기 포함)` : ''}`}
                </Btn>
                <Btn variant="ghost" onClick={onClose} disabled={busy}>
                  취소
                </Btn>
              </BtnRow>
            </>
          )}
        </>
      ) : null}
    </Sheet>
  )
}
