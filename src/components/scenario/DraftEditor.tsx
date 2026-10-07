'use client'

/**
 * 초안 편집기(가이드 §3-H `dr-edit`·`dr-edit-existing`) — 제목 → 일본어 제목 → 장소 → 수준 → 역할 → 목표 → 대화 순서 → 성공 조건 → 핵심 표현 → 선생님 첫마디.
 * 입력칸은 16px(확대 방지), 제목·입력칸에는 루비를 달지 않는다(§15-1 F). 칸 문제는 칸 아래 + `aria-invalid`. 초점 id 는 `logic.problemDomId` 규칙.
 * 첫마디는 늘 보이는 `OpeningField`(task-045 D5=A — 한국어 주 입력 + 선생님이 만든 일본어). 회화 탭 새 상황·고치기·기본 상황 고치기가 같은 편집기다.
 */
import Segmented from '@/components/common/Segmented'
import { Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import type { JlptLevel } from '@/types/lesson'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import ExpressionEditor from './ExpressionEditor'
import ListEditor from './ListEditor'
import OpeningField from './OpeningField'
import { DRAFT_LEVELS, type EditableDraft } from './logic'
import PlaceChips from './PlaceChips'
import { DRAFT } from './scenarioCopy'

const inputCls = (err: boolean) => `h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink ${err ? 'border-bad' : 'border-line'}`
const areaCls = (err: boolean) => `w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink ${err ? 'border-bad' : 'border-line'}`

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="text-[12px] text-bad break-keep">
      {text}
    </p>
  ) : null
}

/** 수준 칸 선택지 — 초안은 N5~N3, 저장된 값이 그 밖이면 그 값도 함께. */
export function levelOptions(current: JlptLevel): { value: JlptLevel; label: string }[] {
  const base: JlptLevel[] = [...DRAFT_LEVELS]
  if (!base.includes(current)) base.push(current)
  return base.map((v) => ({ value: v, label: v }))
}

export default function DraftEditor({
  draft,
  setDraft,
  errors,
  places,
  placesFailed,
  disabled = false,
}: {
  draft: EditableDraft
  setDraft: (fn: (d: EditableDraft) => EditableDraft) => void
  errors: Record<string, string>
  places: { id: string; title: string }[]
  placesFailed: boolean
  disabled?: boolean
}) {
  const set = (patch: Partial<EditableDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const placeOpts = [{ value: '', label: DRAFT.placeNone }, ...places.map((p) => ({ value: p.id, label: p.title }))]
  const goalLen = cpLength(draft.goalKo.trim())
  const placeTitle = places.find((p) => p.id === draft.topicIds[0])?.title ?? null

  return (
    <div className="flex min-w-0 flex-col gap-[18px]">
      <Field label={DRAFT.fTitle} htmlFor="dr-title">
        <input
          id="dr-title"
          value={draft.title}
          disabled={disabled}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'dr-title-err' : undefined}
          onChange={(e) => set({ title: e.target.value })}
          className={inputCls(!!errors.title)}
        />
        <FieldError id="dr-title-err" text={errors.title} />
      </Field>
      <Field label={DRAFT.fTitleJa} htmlFor="dr-titleJa">
        <input
          id="dr-titleJa"
          lang="ja"
          value={draft.titleJa}
          disabled={disabled}
          aria-invalid={errors.titleJa ? true : undefined}
          aria-describedby={errors.titleJa ? 'dr-titleJa-err' : undefined}
          onChange={(e) => set({ titleJa: e.target.value })}
          className={inputCls(!!errors.titleJa)}
        />
        <FieldError id="dr-titleJa-err" text={errors.titleJa} />
      </Field>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{DRAFT.placeLabel}</span>
        {placesFailed ? (
          <p className="text-[12px] text-ink2 break-keep">{DRAFT.placesFail}</p>
        ) : (
          <PlaceChips<string>
            id="dr-place"
            ariaLabel={DRAFT.placeLabel}
            options={placeOpts}
            value={draft.topicIds[0] ?? ''}
            describedBy={errors.place ? 'dr-place-err' : undefined}
            onChange={(v) => !disabled && set({ topicIds: v ? [v] : [] })}
          />
        )}
        <FieldError id="dr-place-err" text={errors.place} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{DRAFT.levelLabel}</span>
        <div id="dr-level" tabIndex={-1} className="outline-none">
          <Segmented<JlptLevel> ariaLabel={DRAFT.levelLabel} options={levelOptions(draft.level)} value={draft.level} onChange={(v) => !disabled && set({ level: v })} />
        </div>
        <FieldError id="dr-level-err" text={errors.level} />
      </div>
      <fieldset className="min-w-0" disabled={disabled}>
        <legend className="text-[12.5px] font-medium text-ink2">{DRAFT.fRoles}</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="dr-learner" className="text-[12px] text-ink2">
              {DRAFT.fLearner}
            </label>
            <input
              id="dr-learner"
              value={draft.learner}
              aria-invalid={errors.learner ? true : undefined}
              aria-describedby={errors.learner ? 'dr-learner-err' : undefined}
              onChange={(e) => set({ learner: e.target.value })}
              className={inputCls(!!errors.learner)}
            />
            <FieldError id="dr-learner-err" text={errors.learner} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="dr-tutor" className="text-[12px] text-ink2">
              {DRAFT.fTutor}
            </label>
            <input
              id="dr-tutor"
              value={draft.tutor}
              aria-invalid={errors.tutor ? true : undefined}
              aria-describedby={errors.tutor ? 'dr-tutor-err' : undefined}
              onChange={(e) => set({ tutor: e.target.value })}
              className={inputCls(!!errors.tutor)}
            />
            <FieldError id="dr-tutor-err" text={errors.tutor} />
          </div>
        </div>
      </fieldset>
      <Field label={DRAFT.fGoal} htmlFor="dr-goal">
        <textarea
          id="dr-goal"
          rows={2}
          value={draft.goalKo}
          disabled={disabled}
          aria-invalid={errors.goal ? true : undefined}
          aria-describedby={errors.goal ? 'dr-goal-err' : 'dr-goal-count'}
          onChange={(e) => set({ goalKo: e.target.value })}
          className={areaCls(!!errors.goal)}
        />
        <p id="dr-goal-count" className={`text-right text-[12px] tabular-nums ${goalLen > L.goalMax ? 'text-bad' : 'text-ink2'}`}>
          {goalLen}/{L.goalMax}
        </p>
        <FieldError id="dr-goal-err" text={errors.goal} />
      </Field>
      <ListEditor
        base="steps"
        label={DRAFT.fSteps}
        items={draft.steps}
        onChange={(steps) => set({ steps })}
        min={L.stepsMin}
        max={L.stepsMax}
        addLabel={DRAFT.stepAdd}
        maxNote={DRAFT.stepMax}
        minNote={DRAFT.stepMin}
        menuLabel={DRAFT.stepMenu}
        errors={errors}
        disabled={disabled}
      />
      <ListEditor
        base="criteria"
        label={DRAFT.fCriteria}
        items={draft.criteria}
        onChange={(criteria) => set({ criteria })}
        min={L.successCriteriaMin}
        max={L.successCriteriaMax}
        addLabel={DRAFT.criterionAdd}
        maxNote={DRAFT.criterionMax}
        minNote={DRAFT.criterionMin}
        menuLabel={DRAFT.criterionMenu}
        errors={errors}
        disabled={disabled}
      />
      <ExpressionEditor items={draft.expressions} onChange={(expressions) => set({ expressions })} errors={errors} storedRequired={draft.requiredExpressions} disabled={disabled} />
      <OpeningField draft={draft} setDraft={setDraft} errors={errors} placeTitle={placeTitle} disabled={disabled} />
    </div>
  )
}
