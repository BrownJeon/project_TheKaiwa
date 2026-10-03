'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge, Btn, Card, ErrorBlock, Field, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import { CORRECTION_MODE_COPY, type CorrectionModeValue } from '@/components/talk/talkCopy'

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
interface Profile {
  displayName: string | null
  teacherName: string | null
  level: Level
  politeness: 'POLITE' | 'CASUAL'
  goalLevel: Level | null
  dailyWordCount: number
  dailyMinutes: number
  strictness: 'GENTLE' | 'NORMAL' | 'STRICT'
  correctionMode: CorrectionModeValue
  explainDepth: 'BRIEF' | 'NORMAL' | 'DETAILED'
}

const MODES: CorrectionModeValue[] = ['FLUENCY', 'COACH']

/**
 * 교정 방식(task-010c, 데모 v1 `set`) — 설명이 길어 분절 버튼 대신 설명이 늘 보이는 두 줄 선택 카드. 카드 전체(56px↑)가 눌리고 화살표 키로도
 * 바뀐다(네이티브 radio). 고른 쪽은 테두리 + 채운 동그라미(색만 쓰지 않음). 저장은 카드 아래 [학습 설정 저장] 하나로.
 */
function CorrectionModeField({ value, disabled, onChange }: { value: CorrectionModeValue; disabled: boolean; onChange: (v: CorrectionModeValue) => void }) {
  const c = CORRECTION_MODE_COPY
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p id="correctionModeLabel" className="text-[12.5px] font-medium text-ink2">
        {c.label}
      </p>
      <p id="correctionModeHelp" className="text-[12.5px] leading-[1.45] text-ink2 break-keep">
        {c.helpParts.map((t, i) =>
          i % 2 === 1 ? (
            <b key={i} className="font-semibold text-ink">
              {t}
            </b>
          ) : (
            <span key={i}>{t}</span>
          ),
        )}
      </p>
      <div role="radiogroup" aria-labelledby="correctionModeLabel" aria-describedby="correctionModeHelp" className="flex flex-col gap-2">
        {MODES.map((m) => {
          const on = value === m
          return (
            <label
              key={m}
              className={`relative grid min-h-14 grid-cols-[20px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border bg-surface p-3 ${
                on ? 'border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line'
              } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="correctionMode"
                value={m}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(m)}
                className={`mt-px grid h-5 w-5 appearance-none place-items-center rounded-full border-2 bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on ? "border-accent after:h-2.5 after:w-2.5 after:rounded-full after:bg-accent after:content-['']" : 'border-ink3'
                }`}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                  {c.name[m]}
                  {m === 'FLUENCY' ? <Badge>{c.defaultBadge}</Badge> : null}
                </span>
                <span className="mt-0.5 block text-[13px] leading-[1.45] text-ink2 break-keep">{c.desc[m]}</span>
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-[12px] text-ink2 break-keep">{c.scope}</p>
    </div>
  )
}

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'].map((v) => ({ value: v as Level, label: v }))
const inputCls = 'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink3'

/** 설정 허브 · 기본정보·목표·학습(api-contract #11·#12). 선생님 이름은 비우면 "선생님". */
export default function LearningSettings() {
  const [p, setP] = useState<Profile | null>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      setP(await apiGet<Profile>('/api/v1/settings/profile'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorBlock message={error} onRetry={load} />
  if (!p) return <LoadingBlock />
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v })

  const save = async () => {
    setSaving(true)
    try {
      const { displayName, teacherName, level, politeness, goalLevel, dailyWordCount, dailyMinutes, strictness, correctionMode, explainDepth } = p
      setP(
        await apiPut<Profile>('/api/v1/settings/profile', {
          displayName: displayName || null,
          teacherName: teacherName || null,
          level,
          politeness,
          goalLevel,
          dailyWordCount,
          dailyMinutes,
          strictness,
          correctionMode,
          explainDepth,
        }),
      )
      toast.show('학습 설정을 저장했어요')
      // 목소리 카드 머리의 선생님 이름(서버 컴포넌트가 읽음)을 바로 갱신한다 — 클라 상태는 유지된다(screens §7-2 A).
      router.refresh()
    } catch (e) {
      toast.show(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section>
      <SectionHeader title="기본정보 · 학습" />
      <Card className="flex flex-col gap-3.5">
        <Field label="내 이름(선생님이 부를 이름)" htmlFor="displayName">
          <input id="displayName" className={inputCls} maxLength={40} value={p.displayName ?? ''} onChange={(e) => set('displayName', e.target.value)} placeholder="예: 준" />
        </Field>
        <Field label="선생님 이름" htmlFor="teacherName">
          <input id="teacherName" className={inputCls} maxLength={30} value={p.teacherName ?? ''} onChange={(e) => set('teacherName', e.target.value)} placeholder="비우면 '선생님'" />
        </Field>
        <Field label="지금 수준">
          <Segmented ariaLabel="지금 수준" options={LEVELS} value={p.level} onChange={(v) => set('level', v)} />
        </Field>
        <Field label="목표 수준">
          <Segmented ariaLabel="목표 수준" options={[{ value: 'NONE', label: '없음' }, ...LEVELS] as { value: Level | 'NONE'; label: string }[]} value={p.goalLevel ?? 'NONE'} onChange={(v) => set('goalLevel', v === 'NONE' ? null : (v as Level))} />
        </Field>
        <Field label="대화 문체">
          <Segmented ariaLabel="대화 문체" options={[{ value: 'POLITE', label: '존댓말(です・ます)' }, { value: 'CASUAL', label: '반말(タメ口)' }] as const} value={p.politeness} onChange={(v) => set('politeness', v)} />
        </Field>
        <Field label="교정 강도">
          <Segmented ariaLabel="교정 강도" options={[{ value: 'GENTLE', label: '가볍게' }, { value: 'NORMAL', label: '보통' }, { value: 'STRICT', label: '꼼꼼하게' }] as const} value={p.strictness} onChange={(v) => set('strictness', v)} />
        </Field>
        <CorrectionModeField value={p.correctionMode === 'COACH' ? 'COACH' : 'FLUENCY'} disabled={saving} onChange={(v) => set('correctionMode', v)} />
        <Field label="설명 자세히">
          <Segmented ariaLabel="설명 자세히" options={[{ value: 'BRIEF', label: '짧게' }, { value: 'NORMAL', label: '보통' }, { value: 'DETAILED', label: '자세히' }] as const} value={p.explainDepth} onChange={(v) => set('explainDepth', v)} />
        </Field>
        <Field label="오늘의 단어 개수">
          <Segmented ariaLabel="오늘의 단어 개수" options={[5, 10, 15, 20, 30].map((n) => ({ value: n, label: `${n}개` }))} value={p.dailyWordCount} onChange={(v) => set('dailyWordCount', v)} />
        </Field>
        <Field label="하루 공부 시간">
          <Segmented ariaLabel="하루 공부 시간" options={[10, 15, 20, 30, 60].map((n) => ({ value: n, label: `${n}분` }))} value={p.dailyMinutes} onChange={(v) => set('dailyMinutes', v)} />
        </Field>
        <Btn onClick={save} disabled={saving}>{saving ? '저장 중…' : '학습 설정 저장'}</Btn>
      </Card>
      <Toast message={toast.message} />
    </Section>
  )
}
