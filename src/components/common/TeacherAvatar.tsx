/**
 * 선생님 아바타(첫 글자) — 채팅 말풍선(sm 28px)·설정 목소리 카드 머리(md 40px) 공용(screens §7-5, 채팅에서 옮김).
 * 장식이라 `aria-hidden` — 이름은 옆 텍스트가 읽힌다.
 */
export default function TeacherAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'h-10 w-10 text-[16px]' : 'h-7 w-7 text-[13px]'
  return (
    <span aria-hidden="true" className={`grid flex-none place-items-center rounded-full bg-accent-soft font-semibold text-ink ${box}`}>
      {Array.from(name)[0] ?? '선'}
    </span>
  )
}
