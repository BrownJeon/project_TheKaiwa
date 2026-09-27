/**
 * 환경 띠(screens.md §6-2 A) — `main` 밖이라 스크롤해도 늘 보이고, 어떤 화면에서도 숨길 수 없다.
 * PRODUCTION = 빨간 띠(`bg-bad text-surface`, 라이트·다크 ≥4.5:1). 360px 에서 문구는 말줄임, 환경 이름·버전은 남는다.
 */
import type { AdminEnvironment } from '@/types/admin'
import { ENV_KO, envMessage, envTone } from './labels'

export default function EnvStrip({ environment, appVersion }: { environment: AdminEnvironment; appVersion: string | null }) {
  const tone = envTone(environment)
  const message = envMessage(environment)
  return (
    <div
      role="note"
      aria-label={`환경: ${ENV_KO[environment] ?? environment}(${environment}). ${message}`}
      className={`flex min-h-8 min-w-0 items-center gap-2 px-4 text-[12px] ${tone.strip}`}
    >
      <span className={`flex-none rounded px-1.5 py-px font-mono text-[11.5px] font-bold tracking-wide ${tone.pill}`}>{environment}</span>
      <span className="min-w-0 flex-1 truncate">{message}</span>
      {appVersion ? <span className="flex-none tabular-nums">v{appVersion}</span> : null}
    </div>
  )
}
