'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, Card, ErrorBlock, Field, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'

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
  explainDepth: 'BRIEF' | 'NORMAL' | 'DETAILED'
}

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'].map((v) => ({ value: v as Level, label: v }))
const inputCls = 'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink3'

/** 설정 허브 · 기본정보·목표·학습(api-contract #11·#12). 선생님 이름은 비우면 "선생님". */
export default function LearningSettings() {
  const [p, setP] = useState<Profile | null>(null)
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
      const { displayName, teacherName, level, politeness, goalLevel, dailyWordCount, dailyMinutes, strictness, explainDepth } = p
      setP(await apiPut<Profile>('/api/v1/settings/profile', { displayName: displayName || null, teacherName: teacherName || null, level, politeness, goalLevel, dailyWordCount, dailyMinutes, strictness, explainDepth }))
      toast.show('학습 설정을 저장했어요')
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
