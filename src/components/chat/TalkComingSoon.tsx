import { Btn, Card } from '@/components/common/ui'

/** 음성 회화 탭 — 회화방이 열리기 전 안내. 사용자 화면에는 개발 단계·작업 번호를 쓰지 않는다. */
export default function TalkComingSoon({ onGoChat }: { onGoChat: () => void }) {
  return (
    <Card className="mt-3.5 flex flex-col gap-1.5">
      <h2 className="text-[17px] font-semibold break-keep">음성 회화는 곧 열려요</h2>
      <p className="text-[15px] text-ink2 break-keep">말하면 선생님이 대답하고, 틀린 표현은 그 자리에서 짚어 줘요.</p>
      <p className="text-[15px] text-ink2 break-keep">지금은 채팅으로 연습해 보세요.</p>
      <Btn className="mt-2 w-full" onClick={onGoChat}>
        채팅으로 연습하기
      </Btn>
    </Card>
  )
}
