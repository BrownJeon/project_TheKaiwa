import { redirect } from 'next/navigation'
import RolePlayResultScreen from '@/components/scenario/RolePlayResultScreen'
import { auth } from '@/modules/infra'

/**
 * 역할극 결과(task-010d 가이드 §3-G) — 회화방과 같은 규칙: 서버는 세션만 확인하고, 소유 확인·결과는 화면이 #29 로 읽는다
 * (남의·없는 대화 = 화면의 "찾을 수 없어요", 마치지 않은 역할극 = "아직 마치지 않은 역할극이에요"). 이 페이지는 아무것도 쓰지 않는다(D-9).
 * 하단 탭 없음(집중 화면 `/study/ai/talk/`).
 */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/study/ai/talk/${chatId}/result`)}`)
  return <RolePlayResultScreen chatId={chatId} />
}
