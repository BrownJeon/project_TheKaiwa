import { redirect } from 'next/navigation'

/** 루트는 항상 '오늘' 탭으로 보낸다. 미로그인 사용자는 middleware 가 /login 으로 돌린다. */
export default function RootPage() {
  redirect('/study/today')
}
