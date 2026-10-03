'use client'

/**
 * Form 칸 목록(데모 v2 `fieldGroups`, 사용자 결정 d1 = B "바꿀 수 있는 설정 먼저"): 묶음(connection·runtime …)마다 입력칸을 먼저,
 * 바꿀 수 없는 키는 "바꿀 수 없는 설정 n개(이유별 개수)"로 접는다. 설정 화면 Form 탭과 연결 상세 편집이 같이 쓴다.
 * 잠긴 칸은 값 + 이유 한 줄 + 잠금 뱃지(입력 DOM 없음). 비밀 참조 칸은 값 입력이 없다 — 참조 이름만, [있는지 확인](secrets.read_ref)·
 * [비밀 참조 연결](credentials.manage)은 권한이 있을 때만 그린다.
 */
import { useId } from 'react'
import type { ConfigIssueDto } from '@/types/admin'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { editabilityText } from '../console/labels'
import { type FieldLock, LOCK_BADGE } from './configCopy'
import { baselineOf, coerceInput, type Draft, draftValue, type FieldModel, hasDraftKey, inputText, isLockedRow } from './draft'
import { valueText } from './DiffView'
import SourceBadge from './SourceBadge'
import { ChangedBadge, FIELD_ERROR, FIELD_HELP, INPUT, LINK_SM, LockBadge, LockIcon, StrictBadge, Switch, TEXTAREA } from './ui'

const GROUP_KO: Record<string, string> = { connection: '연결', runtime: '실행 설정', logging: '로그', enabled: '사용 여부' }

export interface SecretActions {
  canRead: boolean
  canLink: boolean
  onRead: (ref: string | null) => void
  onLink: () => void
}

export interface VoiceOption {
  id: string
  label: string
}

function groupOf(fields: readonly FieldModel[]): [string, FieldModel[]][] {
  const map = new Map<string, FieldModel[]>()
  for (const f of fields) {
    const g = f.key.includes('.') ? f.key.slice(0, f.key.indexOf('.')) : f.key
    const list = map.get(g)
    if (list) list.push(f)
    else map.set(g, [f])
  }
  return Array.from(map.entries())
}

/** 잠긴 칸 이유별 개수("서비스 관리 3 · 읽기 전용 2"). */
export function lockCounts(fields: readonly Pick<FieldModel, 'lock' | 'secret'>[]): string {
  const m = new Map<FieldLock, number>()
  for (const f of fields) if (f.lock && isLockedRow(f)) m.set(f.lock, (m.get(f.lock) ?? 0) + 1)
  return Array.from(m.entries())
    .map(([k, n]) => `${LOCK_BADGE[k]} ${n}`)
    .join(' · ')
}

function rangeText(f: FieldModel): string | null {
  if (f.min !== undefined && f.max !== undefined) return `${f.min}~${f.max}`
  if (f.min !== undefined) return `${f.min} 이상`
  if (f.max !== undefined) return `${f.max} 이하`
  if (f.maxLength !== undefined) return `${f.maxLength}자까지`
  return null
}

function LockedValue({ f }: { f: FieldModel }) {
  const shown = f.lock === 'SHADOW' ? f.effective : f.hasStored ? f.stored : f.effective
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl bg-surface2 px-3 py-2.5">
      <span className="mt-0.5 flex-none text-ink2">
        <LockIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span lang={f.ja ? 'ja' : undefined} className={`block text-[14px] text-ink [overflow-wrap:anywhere] ${f.ja ? '' : 'font-mono'}`}>
          {valueText(f.key, shown)}
        </span>
        {f.lockWhy ? <span className="mt-0.5 block text-[12px] text-ink2 break-keep">{f.lockWhy}</span> : null}
        {f.lock === 'SHADOW' && f.hasStored ? <span className="mt-0.5 block text-[12px] text-ink2 [overflow-wrap:anywhere]">저장값 <span className="font-mono">{valueText(f.key, f.stored)}</span></span> : null}
      </span>
      {f.lock === 'SHADOW' ? <SourceBadge source="ENVIRONMENT" /> : f.lock ? <LockBadge lock={f.lock} /> : null}
    </div>
  )
}

function SecretValue({ f, draft, actions }: { f: FieldModel; draft: Draft; actions?: SecretActions }) {
  const v = draftValue(draft, f)
  const ref = typeof v === 'string' && v ? v : null
  return (
    <>
      <div className="flex min-w-0 items-start gap-2 rounded-xl bg-surface2 px-3 py-2.5">
        <span className="mt-0.5 flex-none text-ink2">
          <LockIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[14px] text-ink [overflow-wrap:anywhere]">
            {ref ? (
              <>
                {valueText(f.key, ref)}{' '}
                <span role="img" aria-label="비밀 참조">
                  🔒
                </span>
              </>
            ) : (
              <span className="font-sans text-ink2">연결 안 됨</span>
            )}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink2 break-keep">값은 화면·저장소 어디에도 없어요. 서버에 넣어 둔 비밀의 이름만 가리켜요.</span>
        </span>
      </div>
      {actions && ((actions.canRead && ref) || actions.canLink) ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3">
          {actions.canRead && ref ? (
            <button type="button" aria-haspopup="dialog" onClick={() => actions.onRead(ref)} className="inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-accent">
              있는지 확인
            </button>
          ) : null}
          {actions.canLink ? (
            <button type="button" aria-haspopup="dialog" onClick={actions.onLink} className="inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-accent">
              비밀 참조 연결
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function InputControl({
  f,
  id,
  labelId,
  value,
  error,
  frozen,
  voices,
  onChange,
}: {
  f: FieldModel
  id: string
  labelId: string
  value: unknown
  error: ConfigIssueDto | undefined
  frozen: boolean
  voices?: VoiceOption[] | null
  onChange: (v: unknown) => void
}) {
  const errId = error ? `${id}-e` : undefined
  const common = { 'aria-invalid': error ? true : undefined, 'aria-describedby': errId, disabled: frozen }
  if (f.type === 'BOOLEAN') return <Switch checked={value === true} onChange={onChange} labelledBy={labelId} disabled={frozen} />
  if (f.voice && voices && voices.length) {
    const cur = typeof value === 'string' ? value : ''
    const opts = voices.some((v) => v.id === cur) || !cur ? voices : [{ id: cur, label: `${cur} (목록에 없음)` }, ...voices]
    return (
      <select id={id} value={cur} onChange={(e) => onChange(e.target.value)} className={`${INPUT} px-2.5`} {...common}>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (f.type === 'ENUM' && f.enum && f.enum.length) {
    const opts = f.enum.map((o) => ({ value: String(o), label: String(o) }))
    const cur = value === null || value === undefined ? '' : String(value)
    const pick = (s: string) => onChange(f.enum!.find((o) => String(o) === s) ?? s)
    if (opts.length <= 3 && !frozen) {
      return (
        <>
          <ConsoleSegmented ariaLabel={f.label} options={opts} value={cur} onChange={pick} />
          <p className="mt-1 font-mono text-[12px] text-ink2">{cur}</p>
        </>
      )
    }
    return (
      <select id={id} value={cur} onChange={(e) => pick(e.target.value)} className={`${INPUT} px-2.5`} {...common}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  const text = inputText(f.type, value)
  if (f.multiline || f.type === 'JSON') {
    return (
      <textarea
        id={id}
        rows={3}
        lang={f.ja ? 'ja' : undefined}
        spellCheck={false}
        value={text}
        onChange={(e) => onChange(coerceInput(f.type, e.target.value))}
        className={`${TEXTAREA} ${f.type === 'JSON' ? 'font-mono' : ''}`}
        {...common}
      />
    )
  }
  const mode = f.type === 'URL' ? 'url' : f.type === 'INTEGER' ? 'numeric' : f.type === 'NUMBER' ? 'decimal' : 'text'
  return (
    <input
      id={id}
      type="text"
      inputMode={mode}
      autoComplete="off"
      spellCheck={false}
      value={text}
      onChange={(e) => onChange(coerceInput(f.type, e.target.value))}
      className={`${INPUT} font-mono`}
      {...common}
    />
  )
}

function FieldRow({
  f,
  draft,
  error,
  frozen,
  voices,
  secret,
  onChange,
  onReset,
}: {
  f: FieldModel
  draft: Draft
  error?: ConfigIssueDto
  frozen: boolean
  voices?: VoiceOption[] | null
  secret?: SecretActions
  onChange: (f: FieldModel, v: unknown) => void
  onReset: (key: string) => void
}) {
  const uid = useId()
  const id = `${uid}-in`
  const labelId = `${uid}-l`
  const locked = isLockedRow(f)
  const changed = hasDraftKey(draft, f.key)
  const value = draftValue(draft, f)
  const range = rangeText(f)
  const labelled = !locked && !f.secret && f.type !== 'BOOLEAN' && !(f.type === 'ENUM' && (f.enum?.length ?? 0) <= 3 && !frozen)
  return (
    <div data-field={f.key} className="grid min-w-0 gap-1.5 border-t border-line py-3.5 first:border-t-0 @min-[620px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @min-[620px]:items-start @min-[620px]:gap-x-5">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {labelled ? (
            <label id={labelId} htmlFor={id} className="text-[14px] font-semibold text-ink">
              {f.label}
            </label>
          ) : (
            <span id={labelId} className="text-[14px] font-semibold text-ink">
              {f.label}
            </span>
          )}
          {f.strict ? <StrictBadge /> : null}
          {changed ? <ChangedBadge /> : null}
        </div>
        <p className="font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{f.key}</p>
      </div>
      <div className="min-w-0">
        {locked ? (
          <LockedValue f={f} />
        ) : f.secret ? (
          <SecretValue f={f} draft={draft} actions={secret} />
        ) : (
          <>
            <InputControl f={f} id={id} labelId={labelId} value={value} error={error} frozen={frozen} voices={voices} onChange={(v) => onChange(f, v)} />
            <p className={`${FIELD_HELP} flex flex-wrap items-center gap-x-2 gap-y-1`}>
              {f.source ? <SourceBadge source={f.source} /> : null}
              <span>{editabilityText(f.editability)}</span>
              {range ? <span>{range}</span> : null}
              {f.verifiable === 'NO' ? <span>실행 검증 없음</span> : null}
              {f.multiline ? <span className="tabular-nums">{Array.from(typeof value === 'string' ? value : '').length}자</span> : null}
            </p>
            {f.help ? <p className={FIELD_HELP}>{f.help}</p> : null}
            {changed ? (
              <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-ink2">
                원래 값{' '}
                <span lang={f.ja ? 'ja' : undefined} className={`text-ink [overflow-wrap:anywhere] ${f.ja ? '' : 'font-mono'}`}>
                  {valueText(f.key, baselineOf(f))}
                </span>
                <button type="button" onClick={() => onReset(f.key)} className={LINK_SM}>
                  원래대로
                </button>
              </p>
            ) : null}
          </>
        )}
        {error ? (
          <p id={`${id}-e`} className={FIELD_ERROR}>
            {error.message}
            {error.suggestion ? ` · 혹시 ${error.suggestion} 인가요?` : ''}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function FieldList({
  fields,
  draft,
  errors,
  frozen = false,
  voices,
  secret,
  groupTitle,
  onChange,
  onReset,
}: {
  fields: readonly FieldModel[]
  draft: Draft
  errors: Readonly<Record<string, ConfigIssueDto>>
  frozen?: boolean
  voices?: VoiceOption[] | null
  secret?: SecretActions
  groupTitle?: (group: string) => string | null
  onChange: (f: FieldModel, v: unknown) => void
  onReset: (key: string) => void
}) {
  return (
    <>
      {groupOf(fields).map(([g, list]) => {
        const editable = list.filter((f) => !isLockedRow(f))
        const locked = list.filter((f) => isLockedRow(f))
        const title = groupTitle ? groupTitle(g) : GROUP_KO[g] ?? g
        const row = (f: FieldModel) => <FieldRow key={f.key} f={f} draft={draft} error={errors[f.key]} frozen={frozen} voices={voices} secret={secret} onChange={onChange} onReset={onReset} />
        return (
          <section key={g} className="mt-[18px] min-w-0">
            {title !== null ? (
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="min-w-0 truncate text-[15px] font-semibold">{title}</h3>
                {list.length > 1 || g.includes('.') ? <span className="flex-none font-mono text-[12px] text-ink2">{g}.*</span> : null}
              </div>
            ) : null}
            {editable.length ? <div className="@container min-w-0 rounded-[14px] border border-line bg-surface px-3.5">{editable.map(row)}</div> : null}
            {locked.length ? (
              <details className="group mt-2" open={editable.length === 0 || undefined}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-block text-ink2 group-open:rotate-90">
                    ▸
                  </span>
                  바꿀 수 없는 설정 {locked.length}개 <span className="font-normal text-ink2">({lockCounts(locked)})</span>
                </summary>
                <div className="@container min-w-0 rounded-[14px] border border-line bg-surface px-3.5">{locked.map(row)}</div>
              </details>
            ) : null}
          </section>
        )
      })}
    </>
  )
}
