'use client'

/**
 * 항목 시트(screens.md §10-2 D) — 추가·고치기·보기·끄기·다시 켜기·닫기 확인을 한 시트의 모드로. 부모가 열 때마다 `key` 로 새로 그려
 * 입력 상태가 이전 열기와 섞이지 않게 한다. 목록이 다시 와도 시트 안 `entry` 는 열 때의 값(409 [새로 불러오기]만 바꾼다).
 */
import { useEffect, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow, Card } from '@/components/common/ui'
import type { AdminVoiceDto } from '@/types/admin'
import type { LexiconEntryDto, LexiconWriteResultDto } from '@/types/lexicon'
import { formatDateTime } from '../console/format'
import KeyValueList, { type KvItem } from '../console/KeyValueList'
import MonoId from '../console/MonoId'
import { EntryStatusBadge } from './Badges'
import EntryForm from './EntryForm'
import { FIELD_ID } from './focus'
import { accentNotation, priorityValue, splitMoras, toKatakana } from './kana'
import type { DraftEntryBody } from './lexiconApi'
import { NOTICE_ACTION_LABEL, QUICK_REASONS, REF_NAME, refLabel, saveHint, WORD_TYPE_KO } from './lexiconCopy'
import LexiconPreviewPanel from './LexiconPreviewPanel'
import SheetNotice, { type SheetNoticeValue } from './SheetNotice'
import { type EntryWriteKind, useLexiconForm } from './useLexiconForm'
import type { LexiconAccess } from './useLexiconAccess'
import WriteConfirmFields from './WriteConfirmFields'

export type EntrySheetMode = 'add' | 'edit' | 'view' | 'confirmDisable' | 'confirmEnable' | 'discard'

const TITLE: Record<Exclude<EntrySheetMode, 'discard'>, string> = {
  add: '항목 추가',
  edit: '항목 고치기',
  view: '항목 보기',
  confirmDisable: '항목 끄기',
  confirmEnable: '항목 다시 켜기',
}

function EntryHead({ entry, voiceName, editable }: { entry: LexiconEntryDto; voiceName: (id: string) => string | null; editable: boolean }) {
  const parts = [entry.scope, entry.scopeRefId ? refLabel(entry, voiceName) : null, entry.wordType ? WORD_TYPE_KO[entry.wordType] : null].filter(Boolean)
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <p lang="ja" className="min-w-0 flex-1 text-[20px] font-semibold [overflow-wrap:anywhere]">
          {entry.surface}
        </p>
        <EntryStatusBadge enabled={entry.enabled} />
      </div>
      <p className="text-[12px] text-ink2 [overflow-wrap:anywhere]">{parts.join(' · ')}</p>
      {editable ? <p className="text-[12px] text-ink2 break-keep">표기·범위는 바꿀 수 없어요 — 끄고 새로 추가해 주세요.</p> : null}
    </div>
  )
}

function focusSheetTitle() {
  setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] h2')?.focus(), 0)
}

export default function LexiconEntrySheet({
  initialMode,
  entry,
  baseVersion,
  voices,
  access,
  onClose,
  onSaved,
  onNoChange,
  onReload,
  onConflictVersion,
  onOpenExisting,
  onRefreshList,
  toast,
}: {
  initialMode: 'add' | 'edit' | 'view'
  entry: LexiconEntryDto | null
  baseVersion: number | null
  voices: readonly AdminVoiceDto[]
  access: LexiconAccess
  onClose: () => void
  onSaved: (res: LexiconWriteResultDto, kind: EntryWriteKind) => void
  onNoChange: () => void
  onReload: () => void
  onConflictVersion: (v: number) => void
  onOpenExisting: (existing: LexiconEntryDto | null, fallback: { surface: string; scope: LexiconEntryDto['scope'] | null }) => void
  onRefreshList: () => void
  toast: (msg: string) => void
}) {
  const [mode, setMode] = useState<EntrySheetMode>(initialMode)
  const [backMode, setBackMode] = useState<EntrySheetMode>(initialMode)
  const formMode = initialMode === 'add' ? 'add' : 'edit'
  const f = useLexiconForm(formMode, entry, baseVersion, access.needsConfirm, { onSaved, onNoChange, onConflictVersion, toast })
  // 처음 열 때(add)는 표기 칸, 모드가 바뀔 때는 시트 제목으로. 개발 모드의 effect 두 번 실행에도 한 번만 옮기도록 직전 모드와 비교한다.
  const shownMode = useRef<EntrySheetMode | null>(null)
  useEffect(() => {
    const prev = shownMode.current
    shownMode.current = mode
    if (prev === mode) return
    if (prev === null) {
      if (mode === 'add') setTimeout(() => document.getElementById(FIELD_ID.surface)?.focus(), 0)
      return
    }
    focusSheetTitle()
  }, [mode])

  const voiceName = (id: string) => voices.find((v) => v.id === id)?.displayName ?? null
  const writing = mode === 'add' || mode === 'edit' || mode === 'confirmDisable' || mode === 'confirmEnable'

  const requestClose = () => {
    if (f.submitting) return
    if (writing && f.dirty) {
      setBackMode(mode)
      setMode('discard')
      return
    }
    onClose()
  }

  const title = mode === 'discard' ? TITLE[backMode === 'discard' ? 'edit' : backMode] : TITLE[mode]

  const noticeValue: SheetNoticeValue | null = f.notice
    ? {
        text: f.notice.value.text,
        action: f.notice.value.action
          ? {
              label: NOTICE_ACTION_LABEL[f.notice.value.action],
              onClick: () => {
                const a = f.notice?.value.action
                const existing = f.notice?.err.details.existing
                f.clearNotice()
                if (a === 'reload') onReload()
                else if (a === 'refreshList') onRefreshList()
                else if (a === 'openExisting') {
                  const ex = existing && typeof existing === 'object' && typeof (existing as LexiconEntryDto).id === 'string' ? (existing as LexiconEntryDto) : null
                  onOpenExisting(ex, { surface: entry?.surface ?? f.draft.surface.trim(), scope: entry?.scope ?? f.draft.scope })
                }
              },
            }
          : undefined,
      }
    : null

  const d = f.draft
  const previewDraft: DraftEntryBody | null =
    f.validDraft && (entry || d.scope)
      ? {
          surface: entry?.surface ?? d.surface.trim(),
          reading: toKatakana(d.reading),
          accentType: d.accentType,
          priority: priorityValue(d.priority) ?? 0,
          scope: entry?.scope ?? d.scope ?? 'GLOBAL',
          scopeRefId: entry ? entry.scopeRefId : d.scope && d.scope !== 'GLOBAL' ? d.scopeRefId.trim() : null,
          wordType: d.wordType || null,
        }
      : null
  const lockedVoiceId = previewDraft?.scope === 'VOICE' ? previewDraft.scopeRefId : null
  const writeFields = (quick: readonly string[]) => (
    <WriteConfirmFields
      reason={f.reason}
      onReason={f.setReason}
      confirm={f.confirm}
      onConfirm={f.setConfirm}
      needsConfirm={access.needsConfirm}
      quick={quick}
      errors={f.metaText}
    />
  )
  const submitLabel = (base: string, prod: string, busy: string) => (f.submitting ? busy : access.needsConfirm ? prod : base)

  return (
    <Sheet open title={title} onClose={requestClose} dismissible={!f.submitting}>
      {mode === 'add' || mode === 'edit' ? (
        <>
          {mode === 'edit' && entry ? <EntryHead entry={entry} voiceName={voiceName} editable /> : null}
          {mode === 'edit' && entry && !entry.enabled ? (
            <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 rounded-xl bg-surface2 px-3 py-1.5 text-[13px] text-ink">
              <span className="break-keep">꺼진 항목이에요. 고쳐 저장해도 꺼진 채로 남아요.</span>
              <button type="button" className="h-11 font-semibold text-accent" onClick={() => setMode('confirmEnable')}>
                다시 켜기
              </button>
            </p>
          ) : null}
          <div className="mt-3">
            <EntryForm mode={formMode} draft={d} errors={f.fieldErrors} voices={voices} onChange={f.change} />
          </div>
          {access.canPreview ? (
            <LexiconPreviewPanel mode="compare" draft={previewDraft} draftValid={f.validDraft} voices={voices} lockedVoiceId={lockedVoiceId} onInvalidDraft={f.revealErrors} />
          ) : null}
          <hr className="my-4 border-line" />
          {writeFields(QUICK_REASONS.save)}
          {noticeValue ? <SheetNotice notice={noticeValue} /> : null}
          <p className="mt-2 text-[12px] text-ink2 break-keep">{saveHint((baseVersion ?? 0) + 1)}</p>
          <BtnRow>
            <Btn variant="primary" aria-busy={f.submitting} onClick={() => void f.submit('save')}>
              {submitLabel('저장', 'PRODUCTION 에 저장', '저장하는 중…')}
            </Btn>
            <Btn variant="ghost" onClick={requestClose}>
              취소
            </Btn>
          </BtnRow>
          {mode === 'edit' && entry?.enabled ? (
            <button type="button" className="mt-2 flex h-11 w-full items-center justify-center text-[14px] font-semibold text-bad" onClick={() => setMode('confirmDisable')}>
              이 항목 끄기
            </button>
          ) : null}
        </>
      ) : null}

      {mode === 'view' && entry ? <ViewBody entry={entry} voiceName={voiceName} canPreview={access.canPreview} voices={voices} onClose={onClose} /> : null}

      {(mode === 'confirmDisable' || mode === 'confirmEnable') && entry ? (
        <>
          <p lang="ja" className="text-[20px] font-semibold [overflow-wrap:anywhere]">
            {entry.surface}
          </p>
          {mode === 'confirmDisable' ? (
            <>
              <p className="mt-1 text-[14px] break-keep">
                이 항목을 끌까요? 다음 문장부터 이 읽기(<span lang="ja">{entry.reading}</span>)를 쓰지 않아요.
              </p>
              <p className="mt-1 text-[13px] text-ink2 break-keep">지우지 않아요 — 버전 기록과 내보내기에 남고, 언제든 다시 켤 수 있어요.</p>
            </>
          ) : (
            <p className="mt-1 text-[14px] break-keep">이 항목을 다시 켤까요? 다음 문장부터 이 읽기를 다시 써요.</p>
          )}
          <div className="mt-3">{writeFields(mode === 'confirmDisable' ? QUICK_REASONS.disable : QUICK_REASONS.enable)}</div>
          {noticeValue ? <SheetNotice notice={noticeValue} /> : null}
          <BtnRow>
            {mode === 'confirmDisable' ? (
              <Btn variant="danger" aria-busy={f.submitting} onClick={() => void f.submit('disable')}>
                {submitLabel('끄기', 'PRODUCTION 에서 끄기', '끄는 중…')}
              </Btn>
            ) : (
              <Btn variant="primary" aria-busy={f.submitting} onClick={() => void f.submit('enable')}>
                {submitLabel('다시 켜기', 'PRODUCTION 에서 다시 켜기', '켜는 중…')}
              </Btn>
            )}
            <Btn
              variant="ghost"
              disabled={f.submitting}
              onClick={() => {
                f.clearNotice()
                setMode('edit')
              }}
            >
              돌아가기
            </Btn>
          </BtnRow>
        </>
      ) : null}

      {mode === 'discard' ? (
        <>
          <p className="text-[15px] break-keep">저장하지 않은 입력이 있어요. 닫을까요?</p>
          <BtnRow>
            <Btn variant="danger" onClick={onClose}>
              입력 버리고 닫기
            </Btn>
            <Btn variant="ghost" onClick={() => setMode(backMode)}>
              계속 쓰기
            </Btn>
          </BtnRow>
        </>
      ) : null}
    </Sheet>
  )
}

function ViewBody({
  entry,
  voiceName,
  canPreview,
  voices,
  onClose,
}: {
  entry: LexiconEntryDto
  voiceName: (id: string) => string | null
  canPreview: boolean
  voices: readonly AdminVoiceDto[]
  onClose: () => void
}) {
  const notation = accentNotation(splitMoras(entry.reading), entry.accentType)
  const items: KvItem[] = [
    {
      key: 'reading',
      label: '읽기',
      node: (
        <span lang="ja" className="text-[16px]">
          {entry.reading}
        </span>
      ),
    },
    {
      key: 'accentType',
      label: '악센트',
      node: (
        <span>
          {entry.accentType}
          {entry.accentType === 0 ? ' 평판' : ''}
          {notation ? (
            <span lang="ja" className="ml-1.5 text-[16px]">
              {notation}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'priority', label: '우선순위', value: entry.priority },
    { key: 'scope', label: '범위', value: entry.scope },
    ...(entry.scopeRefId
      ? [
          {
            key: 'scopeRefId',
            label: entry.scope === 'GLOBAL' ? '대상' : REF_NAME[entry.scope],
            node: (
              <div className="min-w-0">
                {entry.scope === 'VOICE' && voiceName(entry.scopeRefId) ? <span className="block text-[14px]">{voiceName(entry.scopeRefId)}</span> : null}
                <MonoId value={entry.scopeRefId} copy label="대상 id" />
              </div>
            ),
          },
        ]
      : []),
    { key: 'wordType', label: '종류', value: entry.wordType ? WORD_TYPE_KO[entry.wordType] : null },
    { key: 'note', label: '메모', node: entry.note ? <span className="[overflow-wrap:anywhere]">{entry.note}</span> : <span className="text-ink2">없음</span> },
    { key: 'enabled', label: '상태', value: entry.enabled ? '사용 중' : '꺼짐' },
    { key: 'updatedAt', label: '수정', value: formatDateTime(entry.updatedAt) },
  ]
  return (
    <>
      <EntryHead entry={entry} voiceName={voiceName} editable={false} />
      <Card flat className="mt-3">
        <KeyValueList items={items} />
      </Card>
      {canPreview ? <LexiconPreviewPanel mode="current" initialText={entry.surface} voices={voices} /> : null}
      <Btn variant="ghost" className="mt-3 w-full" onClick={onClose}>
        닫기
      </Btn>
    </>
  )
}
