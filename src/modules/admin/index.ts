/**
 * L0 조합 모듈(app 층) — console·configuration(editor·diff·versions·rollback·presets·export/import·overrides)·diagnostics·playground·audit·permissions. 모든 층 import 가능. Phase 1 = task-005b.
 *
 * 이 파일이 모듈의 **유일한 공개 API** 다 — 다른 층·모듈은 `@/modules/admin` 만 import 한다(eslint no-restricted-imports).
 * 정본: docs/design/module-dependency.md
 */
export { getHealthSummary } from './health'
