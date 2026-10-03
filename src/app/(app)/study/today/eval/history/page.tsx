import { redirect } from 'next/navigation'
import EvalHistory from '@/components/eval/EvalHistory'
import { auth } from '@/modules/infra'

/** AI 평가 기록(task-011 데모 v1 `#hist*`) — 목록은 화면이 #69 로 읽는다. */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/study/today/eval/history')}`)
  return <EvalHistory />
}
