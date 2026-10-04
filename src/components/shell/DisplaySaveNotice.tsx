'use client'

/**
 * 일본어 표시 설정 저장 실패 알림(task-026 REV-096 #2) — 앱 셸에 하나. 저장소의 `failEpoch` 가 오르면 같은 문구를 띄운다.
 * 스위치를 누른 화면을 떠난 뒤에 실패해도(PUT 상한 10초) 알림이 사라지지 않게 화면이 아니라 셸이 소유한다. 성공 토스트는 각 화면이 띄운다.
 * 표시 설정을 읽지 않는 화면에서는 GET 을 일으키지 않는다(구독만).
 */
import Toast, { useToast } from '@/components/common/Toast'
import { DISPLAY_COPY, DISPLAY_TOAST_MS, useDisplaySaveFailure } from '@/components/common/japanese/displayPrefs'

export default function DisplaySaveNotice() {
  const toast = useToast()
  useDisplaySaveFailure(() => toast.show(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS))
  return <Toast message={toast.message} />
}
