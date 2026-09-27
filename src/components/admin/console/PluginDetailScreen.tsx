'use client'

/**
 * 플러그인 상세(#122, screens.md §6-2 G). `sourcePath` 는 저장소 상대 경로만(서버 경로면 가림).
 * 기본 설정 문서는 스키마 기본값뿐이라 펼쳐 보기를 허용한다 — 그래도 값마다 가림 규칙(maskDeep)을 거친다.
 */
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { PluginDetailDto } from '@/types/admin'
import { LoadedBadge, NeutralBadge } from './Badges'
import { BackLink, ConsoleLoading, LoadError } from './ConsoleStates'
import { displayValue, maskDeep } from './format'
import KeyValueList from './KeyValueList'
import { CONN_TYPE_KO, editabilityText } from './labels'
import { useAdminResource } from './useAdminResource'

const NOT_FOUND = { backHref: '/admin/plugins', backLabel: '플러그인 목록으로' }

export default function PluginDetailScreen({ id }: { id: string }) {
  const res = useAdminResource<PluginDetailDto>(`/api/admin/v1/plugins/${encodeURIComponent(id)}`)
  const back = <BackLink href="/admin/plugins">플러그인 목록</BackLink>
  if (res.status === 'loading' || res.status === 'idle') {
    return (
      <>
        {back}
        <ConsoleLoading />
      </>
    )
  }
  if (res.status === 'error' && res.err) {
    return (
      <>
        {back}
        <LoadError err={res.err} name="플러그인" onRetry={res.reload} notFound={NOT_FOUND} />
      </>
    )
  }
  const p = res.data
  if (!p) return null
  const keys = p.schema?.keys ?? []

  return (
    <>
      {back}
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="min-w-0 flex-1 font-mono text-[18px] font-semibold [overflow-wrap:anywhere]">{p.id}</h2>
        <LoadedBadge loaded={p.loaded} />
      </div>
      <Section>
        <SectionHeader title="정보" />
        <Card>
          <KeyValueList
            items={[
              { key: 'displayName', label: '표시 이름', value: p.displayName },
              { key: 'type', label: '종류', value: p.type },
              { key: 'version', label: '버전', value: p.version, mono: true },
              { key: 'providerClass', label: '구현 클래스', value: p.providerClass, mono: true },
              { key: 'roles', label: '역할', value: p.roles },
              { key: 'connectionTypes', label: '연결 방식', value: p.connectionTypes.map((t) => CONN_TYPE_KO[t] ?? t) },
              { key: 'schemaVersion', label: '스키마 버전', value: p.schemaVersion },
              { key: 'sourcePath', label: '소스 파일', value: p.sourcePath, mono: true },
            ]}
          />
        </Card>
      </Section>
      <Section>
        <SectionHeader title="기능(capabilities)" />
        {p.capabilities.length ? (
          <div className="flex flex-wrap gap-1.5">
            {p.capabilities.map((c) => (
              <NeutralBadge key={c} mono>
                {c}
              </NeutralBadge>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-ink2">없음</p>
        )}
      </Section>
      {p.initError ? (
        <Section>
          <SectionHeader title="초기화 오류" />
          <p className="rounded-xl bg-bad-soft p-3 font-mono text-[12.5px] text-bad [overflow-wrap:anywhere]">{displayValue('initError', p.initError)}</p>
        </Section>
      ) : null}
      <Section>
        <SectionHeader title={`설정 키 (${keys.length})`} />
        {keys.length === 0 ? (
          <p className="text-[13px] text-ink2">스키마가 없어요.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {keys.map((k) => {
              const range = [k.min !== undefined || k.max !== undefined ? ` · ${k.min ?? ''}~${k.max ?? ''}` : '', k.enum?.length ? ` · ${k.enum.join(' / ')}` : ''].join('')
              return (
                <li key={k.key} className="min-w-0 px-3.5 py-2.5">
                  <p className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-mono text-[13px]">{k.key}</span> <span className="text-[12px] text-ink2">{k.type}</span>
                  </p>
                  <p className="text-[13px] [overflow-wrap:anywhere]">
                    기본값 <span className="font-mono">{k.secret ? '•••(숨김)' : displayValue(k.key, k.default, k.type)}</span>
                    {range}
                  </p>
                  <p className="text-[12px] text-ink2">
                    {editabilityText(k.editability, k.restartRequired)}
                    {k.strict ? ' · 운영 민감' : ''}
                  </p>
                  {k.description ? <p className="mt-0.5 text-[13px] text-ink2 break-keep">{k.description}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      <Section>
        <SectionHeader title="기본 설정 문서" />
        <details className="rounded-[14px] border border-line bg-surface">
          <summary className="flex h-11 cursor-pointer items-center px-3.5 text-[14px] font-medium">펼쳐 보기</summary>
          <pre className="whitespace-pre-wrap px-3.5 pb-3 font-mono text-[12.5px] [overflow-wrap:anywhere]">
            {JSON.stringify(maskDeep(p.defaultConfiguration), null, 2)}
          </pre>
        </details>
      </Section>
    </>
  )
}
