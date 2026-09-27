/**
 * Configuration Schema 작성 도우미 — 어댑터가 키를 짧게 선언하게 한다(configuration-resolution §5-1 규격).
 * `group` 은 키 접두에서, `restartRequired` 는 editability 에서 파생한다(둘이 어긋나는 스키마를 만들 수 없게).
 */
import type { SchemaKey, SchemaKeyType } from '../../registry/types'

type KeyOpts = Omit<Partial<SchemaKey>, 'key' | 'type' | 'default' | 'group' | 'restartRequired'> & { description: string }

export function key(k: string, type: SchemaKeyType, def: unknown, opts: KeyOpts): SchemaKey {
  const group = k.split('.')[0] as SchemaKey['group']
  const editability = opts.editability ?? (type === 'SECRET_REF' ? 'SECRET' : 'RUNTIME_EDITABLE')
  return {
    key: k,
    group,
    type,
    default: def,
    ...opts,
    editability,
    restartRequired: editability === 'RESTART_REQUIRED' || editability === 'REDEPLOY_REQUIRED',
  }
}

export const LOG_LEVEL_KEY: SchemaKey = key('logging.level', 'ENUM', 'INFO', {
  enum: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'],
  description: '연결 로그 레벨(EngineConnection.logLevel). PRODUCTION DEBUG 이상은 SUPER_ADMIN + TTL(Phase 3)',
})

export const SCHEMA_GROUPS = [
  { id: 'connection', label: '연결' },
  { id: 'runtime', label: '런타임' },
  { id: 'logging', label: '로깅' },
]

export const REPO_ADAPTERS = 'src/modules/engine/adapters'
