import ChatReview from '@/components/chat/ChatReview'

/** 표현 점검 결과(screens.md §3-2 D). 소유 확인·데이터는 화면이 #29·#34·#37 로 읽는다(타인·없는 채팅은 404 화면). */
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  return <ChatReview chatId={chatId} />
}
