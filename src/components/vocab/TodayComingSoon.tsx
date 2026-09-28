/**
 * 오늘 홈의 "곧 열려요"(screens.md §5-2 A). 단계·작업 번호·날짜 약속은 쓰지 않는다. 버튼·링크 없음(눌러도 반응 없는 요소를 만들지 않는다).
 */
import { Badge, Card, Section, SectionHeader } from '@/components/common/ui'

// 오늘의 회화는 task-010 에서 열렸다(오늘 홈 카드) — AI 평가만 남는다(screens §12-2 A).
const ITEMS = [{ title: 'AI 평가', body: '내 단어와 표현으로 지금 실력을 점검해요.' }] as const

export default function TodayComingSoon() {
  return (
    <Section>
      <SectionHeader title="곧 열려요" />
      <div className="flex flex-col gap-2">
        {ITEMS.map((it) => (
          <Card key={it.title} flat>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{it.title}</p>
                <p className="mt-0.5 text-[13px] text-ink2 break-keep">{it.body}</p>
              </div>
              <Badge tone="neutral">곧 열려요</Badge>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  )
}
