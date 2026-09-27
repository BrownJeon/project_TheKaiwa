import { redirect } from 'next/navigation'
import { requireConsolePage } from '@/modules/admin'

/** `/admin` → `/admin/dashboard`(H6). 콘솔 밖 사용자는 redirect 전에 가드가 404 로 막는다(존재 비노출). */
export default async function Page() {
  await requireConsolePage()
  redirect('/admin/dashboard')
}
