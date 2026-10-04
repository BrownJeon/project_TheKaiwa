'use client'

/**
 * 일본어 표시 설정 저장 실패 알림(task-026 REV-096 #2) — 앱 셸에 하나. 저장소의 `failEpoch` 가 오르면 같은 문구를 띄운다.
 * 스위치를 누른 화면을 떠난 뒤에 실패해도(PUT 상한 10초) 알림이 사라지지 않게 화면이 아니라 셸이 소유한다. 성공 토스트는 각 화면이 띄운다.
 * 표시 설정을 읽지 않는 화면에서는 GET 을 일으키지 않는다(구독만).
 * 회화방이 열려 있으면 방이 알림을 맡는다(`useClaimDisplaySaveFailure` — 방 토스트 자리 136·녹음 중 미룸, task-030 REV-097 L-2) — 그때 셸은 띄우지 않는다.
 */
import { useEffect } from 'react'
import Toast, { useToast } from '@/components/common/Toast'
import { DISPLAY_COPY, DISPLAY_TOAST_MS, saveFailureClaims, useDisplaySaveFailure } from '@/components/common/japanese/displayPrefs'

export default function DisplaySaveNotice() {
  const toast = useToast()
  const show = toast.show
  // 맡은 화면이 사라질 때 못 띄운 알림이 남아 있으면 이 셸이 대신 1번 띄운다(REV-100 #2).
  useEffect(() => saveFailureClaims.setShell(() => show(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS)), [show])
  useDisplaySaveFailure(() => saveFailureClaims.route(() => toast.show(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS)))
  return <Toast message={toast.message} />
}
