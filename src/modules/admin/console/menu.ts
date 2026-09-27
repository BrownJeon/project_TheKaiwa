/**
 * 콘솔 메뉴 단일 상수(admin-console/01 §3·§9) — 사이드바·드로어·breadcrumb 이 이것만 읽는다.
 * 표시 여부는 capability 로만 거른다(없는 메뉴는 렌더하지 않는다, §6). 서버가 매 요청 다시 검사하므로 메뉴는 UX 일 뿐이다.
 * Phase 1 에 화면이 있는 항목만 `phase: 1`. 발음 사전(01 표 "1(P0)")은 task-005b G1 결정으로 task-003 이후로 이월해 여기 없다.
 */
import type { AdminMenuItem, Capability } from '@/types/admin'
import { can } from '../permissions/can'

export const ADMIN_MENU: readonly AdminMenuItem[] = [
  { id: 'dashboard', path: '/admin/dashboard', label: '대시보드', capability: 'engine.read', phase: 1, group: 'overview' },
  { id: 'speech-realtime', path: '/admin/speech/realtime', label: '실시간 음성 인식', capability: 'engine.read', phase: 1, group: 'speech' },
  { id: 'speech-analysis', path: '/admin/speech/analysis', label: '분석 음성 인식', capability: 'engine.read', phase: 1, group: 'speech' },
  { id: 'speech-tts', path: '/admin/speech/tts', label: '음성 합성', capability: 'engine.read', phase: 1, group: 'speech' },
  { id: 'llm', path: '/admin/llm', label: 'LLM', capability: 'engine.read', phase: 1, group: 'llm' },
  { id: 'voices', path: '/admin/voices', label: '목소리', capability: 'voices.read', phase: 1, group: 'voices' },
  { id: 'connections', path: '/admin/connections', label: '연결', capability: 'engine.read', phase: 1, group: 'engines' },
  { id: 'plugins', path: '/admin/plugins', label: '플러그인', capability: 'plugins.read', phase: 1, group: 'engines' },
  {
    id: 'configuration',
    path: '/admin/configuration',
    label: '설정',
    capability: 'config.effective.read',
    phase: 1,
    group: 'configuration',
    tabs: [
      { id: 'effective', label: 'Effective', capability: 'config.effective.read', phase: 1 },
      { id: 'raw', label: 'Raw JSON', capability: 'config.raw.read', phase: 2 },
      { id: 'diff', label: 'Diff', capability: 'config.edit', phase: 2 },
      { id: 'overrides', label: 'Overrides', capability: 'override.create', phase: 4 },
    ],
  },
  {
    id: 'diagnostics',
    path: '/admin/diagnostics',
    label: '진단',
    capability: 'engine.read',
    phase: 1,
    group: 'diagnostics',
    tabs: [
      { id: 'health', label: 'Health', capability: 'engine.read', phase: 1 },
      { id: 'traces', label: 'Trace', capability: 'trace.read', phase: 1 },
    ],
  },
  { id: 'prompts', path: '/admin/prompts', label: '프롬프트', capability: 'prompts.read', phase: 2, group: 'tools' },
  { id: 'playground', path: '/admin/playground', label: 'Playground', capability: 'playground.use', phase: 2, group: 'tools' },
  { id: 'history', path: '/admin/history', label: '이력', capability: 'audit.read', phase: 2, group: 'tools' },
]

/** actor(또는 역할)가 볼 수 있는 메뉴·탭만 — `maxPhase` 이하(기본 1: 화면이 있는 것)만 남긴다. */
export function menuFor(who: { role: string }, opts: { maxPhase?: number } = {}): AdminMenuItem[] {
  // voices.read 처럼 USER 도 가진 capability 가 있으므로 콘솔 진입(console.access)부터 확인한다.
  if (!can(who, 'console.access').allowed) return []
  const maxPhase = opts.maxPhase ?? 1
  const ok = (cap: Capability) => can(who, cap).allowed
  return ADMIN_MENU.filter((m) => m.phase <= maxPhase && ok(m.capability)).map((m) =>
    m.tabs ? { ...m, tabs: m.tabs.filter((t) => t.phase <= maxPhase && ok(t.capability)) } : { ...m },
  )
}
