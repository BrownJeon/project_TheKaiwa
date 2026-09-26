'use client'

import { useEffect } from 'react'
import { apiPost } from '@/components/common/api'

/**
 * 하루 1회 출석 체크(api-contract #25). 앱 셸이 열릴 때 호출하고, 같은 탭 세션에서는 sessionStorage 로 다시 부르지 않는다.
 * 최종 보증은 서버 `@@unique([userId, date])` 라 저장소가 막혀도(사생활 모드) 중복 행은 생기지 않는다. 실패는 조용히 넘긴다.
 */
export default function AttendancePing() {
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    const key = `kaiwa.checkin.${today}`
    try {
      if (sessionStorage.getItem(key)) return
    } catch {
      /* 저장소 차단 — 서버가 멱등이라 그대로 호출 */
    }
    apiPost('/api/v1/attendance/check-in')
      .then(() => {
        try {
          sessionStorage.setItem(key, '1')
        } catch {
          /* 무시 */
        }
      })
      .catch(() => {
        /* 출석 실패가 화면을 막지 않는다 */
      })
  }, [])
  return null
}
