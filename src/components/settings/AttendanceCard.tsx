'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Card } from '@/components/common/ui'

/** 이번 달 출석 요약(api-contract #26). */
export default function AttendanceCard() {
  const [data, setData] = useState<{ count: number; streak: number } | null>(null)
  useEffect(() => {
    apiGet<{ count: number; streak: number }>('/api/v1/attendance').then(setData, () => setData(null))
  }, [])
  if (!data) return null
  return (
    <Card flat className="mx-4 mb-4 flex items-center justify-between">
      <span className="text-[14px] text-ink2">이번 달 출석 {data.count}일</span>
      <span className="text-[15px] font-semibold text-ink">연속 {data.streak}일</span>
    </Card>
  )
}
