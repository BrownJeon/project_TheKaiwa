'use client'

/**
 * 주제 지우기·내 버전 지우기·되돌리기·숨기기 확인 시트 상태(screens.md §16-2 S8·S9, §16-4 `useTopicRemoval`).
 * `loading → ready → busy → (changed → ready) | done | gone`, 확인 실패는 `loadFail`.
 *
 * - 열면 #172 미리보기를 읽고 그 `ack` 로만 실행한다(숨기기는 서버가 `ack` 를 보지 않아 `none`). 되돌리기는 #176 `{kind:'TOPIC', seedId, ack}`.
 * - 409 `IMPACT_CHANGED` 는 `details.preview` 로 본문을 다시 채우고 `changed` 만 켠다 — **자동으로 다시 보내지 않는다**(사용자가 다시 눌러야 지워진다).
 *   `details.preview` 가 미리보기 모양이 아니면 #172 를 다시 읽는다(옛 `ack` 로 다시 보내지 않게).
 * - 더블 탭은 React 상태가 아니라 흐름 안의 값으로 막는다(`ready` 일 때만 실행 — 두 번째 탭은 이미 `busy`).
 * - 늦게 온 응답(닫은 뒤·다시 연 뒤)은 순번으로 버린다. 흐름은 React 를 모르는 객체라 가짜 API 로 시험한다(`__tests__/removal.test.ts`).
 */
import { useEffect, useState } from 'react'
import { toErr } from '@/components/common/errors'
import type { RestoreSeedResult } from '@/types/seedOverride'
import type { TopicRemovalPreview, TopicRemovalResult } from '@/types/topic'
import { getTopicRemoval, removeTopic, restoreSeed } from './api'
import { failureCopy, type FailContext } from './failure'
import { asRemovalPreview, restoreRemovalOf } from './logic'
import { REMOVAL, type RemovalMode } from './topicCopy'

export interface RemovalDeps {
  preview: (topicId: string) => Promise<TopicRemovalPreview>
  remove: (topicId: string, ack: string) => Promise<TopicRemovalResult>
  restore: (body: { kind: 'TOPIC'; seedId: string; ack: string }) => Promise<RestoreSeedResult>
}

export const REMOVAL_API: RemovalDeps = { preview: getTopicRemoval, remove: removeTopic, restore: restoreSeed }

export interface RemovalTarget {
  mode: RemovalMode
  topicId: string
  /** 되돌리기만 — 그 내 버전의 시드 id(#179). */
  seedId: string | null
}

export type RemovalPhase = 'idle' | 'loading' | 'loadFail' | 'ready' | 'busy' | 'done' | 'gone'

export interface RemovalState {
  phase: RemovalPhase
  preview: TopicRemovalPreview | null
  /** 409 뒤 새 미리보기로 다시 그렸음 — 맨 위 알림 줄. */
  changed: boolean
  /** `loadFail` 이면 확인 실패 문구, `ready` 면 실행 실패 문구(시트 안). */
  error: string | null
  result: TopicRemovalResult | null
  /** `gone` 의 까닭 — 이미 지워졌음 / 이미 기본으로 돌아가 있음. */
  goneKind: 'gone' | 'notOverridden' | null
}

export const REMOVAL_IDLE: RemovalState = { phase: 'idle', preview: null, changed: false, error: null, result: null, goneKind: null }

const CTX: Record<RemovalMode, FailContext> = { delete: 'topicDelete', copyDelete: 'topicDelete', restore: 'topicRestore', hide: 'topicHide' }
/** 숨기기(#173 시드 id)는 서버가 `ack` 를 보지 않는다(§16-2 S8·S9 표). */
const HIDE_ACK = 'none'

export interface RemovalFlow {
  state: () => RemovalState
  open: (t: RemovalTarget) => void
  close: () => void
  retryLoad: () => void
  confirm: () => Promise<void>
}

export function createRemovalFlow(deps: RemovalDeps, onChange: (s: RemovalState) => void): RemovalFlow {
  let state = REMOVAL_IDLE
  let target: RemovalTarget | null = null
  let seq = 0
  const set = (patch: Partial<RemovalState>) => {
    state = { ...state, ...patch }
    onChange(state)
  }

  const load = async (changed: boolean) => {
    const t = target
    if (!t) return
    const my = ++seq
    set({ phase: 'loading', error: null, changed })
    try {
      const p = await deps.preview(t.topicId)
      if (my !== seq) return
      set({ phase: 'ready', preview: p })
    } catch (e) {
      if (my !== seq) return
      const f = failureCopy('removalPreview', toErr(e))
      if (f.kind === 'gone') set({ phase: 'gone', goneKind: 'gone' })
      else set({ phase: 'loadFail', error: f.text })
    }
  }

  const execute = async (t: RemovalTarget, p: TopicRemovalPreview): Promise<TopicRemovalResult> => {
    if (t.mode === 'restore') return restoreRemovalOf(await deps.restore({ kind: 'TOPIC', seedId: t.seedId as string, ack: p.ack }), t.topicId)
    return deps.remove(t.topicId, t.mode === 'hide' ? HIDE_ACK : p.ack)
  }

  return {
    state: () => state,
    open(t) {
      target = t
      state = { ...REMOVAL_IDLE }
      void load(false)
    },
    close() {
      if (state.phase === 'busy') return
      seq++
      target = null
      state = REMOVAL_IDLE
      onChange(state)
    },
    retryLoad() {
      if (state.phase === 'loadFail') void load(state.changed)
    },
    async confirm() {
      const t = target
      const p = state.preview
      if (state.phase !== 'ready' || !t || !p) return
      if (t.mode === 'restore' && !t.seedId) {
        set({ error: REMOVAL.fail.restore })
        return
      }
      const my = ++seq
      set({ phase: 'busy', error: null })
      try {
        const result = await execute(t, p)
        if (my !== seq) return
        set({ phase: 'done', result })
      } catch (e) {
        if (my !== seq) return
        const f = failureCopy(CTX[t.mode], toErr(e))
        if (f.kind === 'impactChanged') {
          const next = asRemovalPreview(f.preview)
          if (next) set({ phase: 'ready', preview: next, changed: true, error: null })
          else void load(true)
          return
        }
        if (f.kind === 'gone') return set({ phase: 'gone', goneKind: 'gone' })
        if (f.kind === 'notOverridden') return set({ phase: 'gone', goneKind: 'notOverridden' })
        set({ phase: 'ready', error: f.text })
      }
    },
  }
}

/** `target` 이 null 이면 닫힘. 같은 대상(mode·id)이면 다시 읽지 않는다. */
export function useTopicRemoval(target: RemovalTarget | null, deps: RemovalDeps = REMOVAL_API) {
  const [state, setState] = useState<RemovalState>(REMOVAL_IDLE)
  const [flow] = useState(() => createRemovalFlow(deps, setState))
  const mode = target?.mode ?? null
  const topicId = target?.topicId ?? null
  const seedId = target?.seedId ?? null

  useEffect(() => {
    if (mode && topicId) flow.open({ mode, topicId, seedId })
    else flow.close()
  }, [flow, mode, topicId, seedId])

  return { state, confirm: flow.confirm, retryLoad: flow.retryLoad }
}
