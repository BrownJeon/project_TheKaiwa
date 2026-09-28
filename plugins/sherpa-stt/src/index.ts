/**
 * 네이티브 등록만 한다. 앱(Next.js) 코드는 이 모듈을 import 하지 않는다 — ESLint `no-restricted-imports`,
 * 호출은 `src/modules/infra/native/bridge.ts` 가 `window.Capacitor.Plugins.SherpaStt` 로 한다(README §2).
 */
import { registerPlugin } from '@capacitor/core'

import type { SherpaSttPlugin } from './definitions'

export const SherpaStt = registerPlugin<SherpaSttPlugin>('SherpaStt', {
  web: () => import('./web').then((m) => new m.SherpaSttWeb()),
})

export * from './definitions'
