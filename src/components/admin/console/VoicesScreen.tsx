'use client'

/**
 * 목소리 목록(#82, 읽기 전용, screens.md §6-2 F). 상태 칩은 받은 목록을 화면에서 거르고, [보관 포함]은 `includeArchived=1` 로 다시 읽는다.
 * 미리듣기·재동기화·활성화는 Phase 2 — 버튼을 그리지 않는다.
 */
import { useState } from 'react'
import { Card } from '@/components/common/ui'
import type { AdminVoiceDto } from '@/types/admin'
import { VoiceStatusBadge } from './Badges'
import { ChipRadio, type ChipOption, ToggleButton } from './ChipRadio'
import { ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from './ConsoleStates'
import KeyValueList, { type KvItem } from './KeyValueList'
import { type VoiceFilter, voiceFilterOf } from './labels'
import MonoId from './MonoId'
import RefreshLine from './RefreshLine'
import { useAdminResource } from './useAdminResource'

function VoiceCard({ voice }: { voice: AdminVoiceDto }) {
  const styles = voice.styles.map((s) => s.label || s.name).join(' · ')
  const items: KvItem[] = [
    {
      key: 'model',
      label: '모델',
      mono: true,
      value: voice.model ? `${voice.model.id}${voice.model.version ? ` v${voice.model.version}` : ''}` : null,
    },
    { key: 'speaker', label: '화자', value: voice.speaker },
    { key: 'styles', label: '스타일', value: styles || '없음' },
    { key: 'usage', label: '쓰는 사용자', value: `${voice.usage.users}명` },
    ...(voice.statusReason ? [{ key: 'statusReason', label: '상태 사유', value: voice.statusReason }] : []),
  ]
  return (
    <li>
      <Card>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{voice.displayName}</span>
          <VoiceStatusBadge status={voice.status} enabled={voice.enabled} />
        </div>
        <MonoId value={voice.id} copy label="목소리 ID" />
        <KeyValueList className="mt-1" items={items} />
      </Card>
    </li>
  )
}

export default function VoicesScreen() {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [filter, setFilter] = useState<VoiceFilter>('ALL')
  const res = useAdminResource<AdminVoiceDto[]>(`/api/admin/v1/voices?includeArchived=${includeArchived ? 1 : 0}`)

  if (res.status === 'error' && res.err) return <LoadError err={res.err} name="목소리" onRetry={res.reload} />
  const all = res.data ?? []
  const n = (f: Exclude<VoiceFilter, 'ALL'>) => all.filter((v) => voiceFilterOf(v.status, v.enabled) === f).length
  const options: ChipOption<VoiceFilter>[] = [
    { value: 'ALL', label: '전체', count: all.length },
    { value: 'AVAILABLE', label: '사용 가능', count: n('AVAILABLE') },
    { value: 'OFF', label: '꺼짐', count: n('OFF') },
    { value: 'ERROR', label: '오류', count: n('ERROR') },
  ]
  const shown = filter === 'ALL' ? all : all.filter((v) => voiceFilterOf(v.status, v.enabled) === filter)

  return (
    <>
      <RefreshLine loadedAt={res.loadedAt} reloading={res.reloading} onReload={res.reload} />
      {res.err ? <ConsoleError message={loadErrorText(res.err, '목소리')} onRetry={res.reload} /> : null}
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <ChipRadio ariaLabel="목소리 상태" options={options} value={filter} onChange={setFilter} bleed="-ml-4 pl-4" />
        </div>
        <ToggleButton pressed={includeArchived} onToggle={() => setIncludeArchived((v) => !v)}>
          보관 포함
        </ToggleButton>
      </div>
      <div className="@container mt-3">
        {res.status === 'loading' ? (
          <ConsoleLoading />
        ) : shown.length === 0 ? (
          <EmptyNote>등록된 목소리가 없어요.</EmptyNote>
        ) : (
          <ul className="grid gap-2.5 @min-[640px]:grid-cols-2">
            {shown.map((v) => (
              <VoiceCard key={v.id} voice={v} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
