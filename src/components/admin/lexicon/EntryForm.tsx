'use client'

/**
 * 항목 입력 칸(screens.md §10-2 D). add 는 모든 칸, edit 는 표기·범위·대상 칸이 없다(`EntryHead` 가 보여 준다).
 * 길이는 코드포인트로 세고 `maxLength` 는 쓰지 않는다 — 넘치면 칸 아래 오류(검증은 `validateDraft`).
 * 읽기는 친 그대로 두고 칸을 떠날 때 가타카나로 바꿔 다시 쓴다(IME 조합 중에는 바꾸지 않는다).
 */
import { useRef } from 'react'
import { LEXICON_LIMITS, LEXICON_WORD_TYPES, type LexiconScopeName, type LexiconWordType } from '@/types/lexicon'
import type { AdminVoiceDto } from '@/types/admin'
import AccentPicker from './AccentPicker'
import { autoGrow } from './autoGrow'
import { FIELD_ID } from './focus'
import { type DraftField, hasHiragana, isReading, type LexiconDraft, moraCount, toKatakana } from './kana'
import { ACCENT_HELP, PRIORITY_HELP, readingHelp, REF_NAME, WORD_TYPE_KO } from './lexiconCopy'
import { FIELD_ERROR, FIELD_HELP, INPUT, LABEL, TEXTAREA } from './lexiconStyles'
import ScopePicker from './ScopePicker'

function Label({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={LABEL}>
      {children}
      {required ? <span aria-hidden="true">*</span> : null}
    </label>
  )
}

function Err({ field, text }: { field: DraftField; text?: string }) {
  if (!text) return null
  return (
    <p id={`${FIELD_ID[field]}-err`} className={FIELD_ERROR}>
      {text}
    </p>
  )
}

const invalidProps = (field: DraftField, text?: string) =>
  text ? { 'aria-invalid': true as const, 'aria-describedby': `${FIELD_ID[field]}-err` } : {}

export function voiceOptionLabel(v: Pick<AdminVoiceDto, 'displayName' | 'status' | 'enabled'>): string {
  return v.status === 'AVAILABLE' && v.enabled ? v.displayName : `${v.displayName} (꺼짐)`
}

export default function EntryForm({
  mode,
  draft,
  errors,
  voices,
  onChange,
}: {
  mode: 'add' | 'edit'
  draft: LexiconDraft
  errors: Partial<Record<DraftField, string>>
  voices: readonly AdminVoiceDto[]
  onChange: (patch: Partial<LexiconDraft>) => void
}) {
  const composing = useRef(false)
  const kata = toKatakana(draft.reading)
  const readingOk = kata !== '' && isReading(kata)
  const scope = draft.scope

  return (
    <div className="grid min-w-0 gap-3">
      {mode === 'add' ? (
        <div className="min-w-0">
          <Label htmlFor={FIELD_ID.surface} required>
            표기
          </Label>
          <input
            id={FIELD_ID.surface}
            lang="ja"
            autoFocus
            aria-required="true"
            autoComplete="off"
            placeholder="예: 日本橋, 等々力"
            value={draft.surface}
            onChange={(e) => onChange({ surface: e.target.value })}
            className={`${INPUT} mt-1.5`}
            {...invalidProps('surface', errors.surface)}
          />
          <Err field="surface" text={errors.surface} />
        </div>
      ) : null}

      <div className="min-w-0">
        <Label htmlFor={FIELD_ID.reading} required>
          읽기
        </Label>
        <input
          id={FIELD_ID.reading}
          lang="ja"
          aria-required="true"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="예: ニホンバシ (히라가나로 써도 돼요)"
          value={draft.reading}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onChange={(e) => onChange({ reading: e.target.value })}
          onBlur={() => {
            if (composing.current) return
            const next = toKatakana(draft.reading)
            if (next !== draft.reading) onChange({ reading: next })
          }}
          className={`${INPUT} mt-1.5`}
          {...invalidProps('reading', errors.reading)}
        />
        {errors.reading ? (
          <Err field="reading" text={errors.reading} />
        ) : readingOk ? (
          <p className={FIELD_HELP}>{readingHelp(kata, moraCount(kata), hasHiragana(draft.reading) || draft.reading.trim() !== kata)}</p>
        ) : null}
      </div>

      <div className="min-w-0">
        <AccentPicker reading={draft.reading} value={draft.accentType} error={errors.accentType} onChange={(n) => onChange({ accentType: n })} />
        <p className={FIELD_HELP}>{ACCENT_HELP}</p>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2.5">
        <div className="min-w-0">
          <Label htmlFor={FIELD_ID.priority}>우선순위</Label>
          <input
            id={FIELD_ID.priority}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft.priority}
            placeholder={String(LEXICON_LIMITS.priorityDefault)}
            onChange={(e) => onChange({ priority: e.target.value })}
            className={`${INPUT} mt-1.5 tabular-nums`}
            {...invalidProps('priority', errors.priority)}
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={FIELD_ID.wordType}>종류</Label>
          <select
            id={FIELD_ID.wordType}
            value={draft.wordType}
            onChange={(e) => onChange({ wordType: e.target.value as LexiconWordType | '' })}
            className={`${INPUT} mt-1.5`}
            {...invalidProps('wordType', errors.wordType)}
          >
            <option value="">선택 안 함</option>
            {LEXICON_WORD_TYPES.map((w) => (
              <option key={w} value={w}>
                {WORD_TYPE_KO[w]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="-mt-2 min-w-0">
        <Err field="priority" text={errors.priority} />
        <Err field="wordType" text={errors.wordType} />
        <p className={FIELD_HELP}>{PRIORITY_HELP}</p>
      </div>

      {mode === 'add' ? (
        <div className="min-w-0">
          <p className={LABEL}>
            범위<span aria-hidden="true">*</span>
          </p>
          <div className="mt-1.5">
            <ScopePicker
              value={scope}
              onChange={(s: LexiconScopeName) => onChange({ scope: s, scopeRefId: '' })}
              invalid={Boolean(errors.scope)}
              describedBy={errors.scope ? `${FIELD_ID.scope}-err` : undefined}
            />
          </div>
          <Err field="scope" text={errors.scope} />
        </div>
      ) : null}

      {mode === 'add' && scope && scope !== 'GLOBAL' ? (
        <div className="min-w-0">
          <Label htmlFor={FIELD_ID.scopeRefId} required>
            {REF_NAME[scope]}
          </Label>
          {scope === 'VOICE' ? (
            <select
              id={FIELD_ID.scopeRefId}
              aria-required="true"
              value={draft.scopeRefId}
              onChange={(e) => onChange({ scopeRefId: e.target.value })}
              className={`${INPUT} mt-1.5`}
              {...invalidProps('scopeRefId', errors.scopeRefId)}
            >
              <option value="">목소리 고르기</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {voiceOptionLabel(v)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={FIELD_ID.scopeRefId}
              aria-required="true"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              placeholder={REF_NAME[scope]}
              value={draft.scopeRefId}
              onChange={(e) => onChange({ scopeRefId: e.target.value })}
              className={`${INPUT} mt-1.5 font-mono`}
              {...invalidProps('scopeRefId', errors.scopeRefId)}
            />
          )}
          {errors.scopeRefId ? <Err field="scopeRefId" text={errors.scopeRefId} /> : <p className={FIELD_HELP}>저장할 때 서버가 있는 id 인지 확인해요.</p>}
        </div>
      ) : null}

      <div className="min-w-0">
        <Label htmlFor={FIELD_ID.note}>메모</Label>
        <textarea
          id={FIELD_ID.note}
          rows={2}
          placeholder="왜 이렇게 읽는지 (선택)"
          value={draft.note}
          onChange={(e) => {
            onChange({ note: e.target.value })
            autoGrow(e.currentTarget, 5)
          }}
          className={`${TEXTAREA} mt-1.5`}
          {...invalidProps('note', errors.note)}
        />
        <Err field="note" text={errors.note} />
      </div>
    </div>
  )
}
