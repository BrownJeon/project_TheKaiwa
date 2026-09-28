/**
 * 브라우저 stub — 모든 메서드가 unavailable 로 reject 한다. 브라우저의 실시간 인식은 gateway(WebSocketSttClient)가
 * 맡으므로 여기로 오면 라우터가 잘못 고른 것이다(README §7).
 */
import { WebPlugin } from '@capacitor/core'

import type { PermissionStatus, SherpaSttPlugin } from './definitions'

type Methods = Omit<SherpaSttPlugin, 'addListener' | 'removeAllListeners'>

export class SherpaSttWeb extends WebPlugin implements Methods {
  private no(): Promise<never> {
    return Promise.reject(this.unavailable('SherpaStt is only available in the Android app'))
  }

  async checkPermissions(): Promise<PermissionStatus> {
    return this.no()
  }
  async requestPermissions(): Promise<PermissionStatus> {
    return this.no()
  }
  checkModel = (): Promise<never> => this.no()
  downloadModel = (): Promise<never> => this.no()
  cancelDownload = (): Promise<never> => this.no()
  deleteModel = (): Promise<never> => this.no()
  preload = (): Promise<never> => this.no()
  start = (): Promise<never> => this.no()
  stop = (): Promise<never> => this.no()
  cancel = (): Promise<never> => this.no()
  release = (): Promise<never> => this.no()
  deleteWav = (): Promise<never> => this.no()
  getDiagnostics = (): Promise<never> => this.no()
  openAppSettings = (): Promise<never> => this.no()
}
