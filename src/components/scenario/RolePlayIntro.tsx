'use client'

/**
 * 역할극 방의 첫 안내(가이드 §3-D).
 *  - `RolePlayIntro`: 첫마디가 없는 상황(D-3 c·첫마디 저장 실패)의 빈 방 — 역할 소개 + 먼저 말 걸기 + 시작 예(누르는 기능 없음).
 *  - `RolePlaySystemLine`: 첫마디가 있는 방의 목록 맨 위 한 줄(v1 `.sysn.box`) — 선생님 첫 말풍선 바로 위.
 * 수업에서 이어진 역할극이면 둘 다 "오늘 수업 「…」에서 이어져요."를 앞에 붙인다(`rp-fromlesson`). 수업 제목은 일본어라 「…」 조각만 `lang="ja"`(`JaQuoted`).
 */
import { JaQuoted } from '@/components/common/japanese/JaQuoted'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { josa } from './logic'
import { ROOM } from './scenarioCopy'
import type { RolePlay } from './useRolePlay'

/** 받침 있으면 "이에요", 없으면 "예요"(끝이 한글이 아니면 "이에요(예요)"). */
function copulaOf(word: string): string {
  return josa(word, '이에요', '예요').slice(word.length)
}

export function RolePlaySystemLine({ rp }: { rp: RolePlay }) {
  const v = rp.view
  if (!v) return null
  return (
    <p className="mb-3 rounded-[10px] bg-surface2 px-2.5 py-2 text-center text-[12.5px] text-ink break-keep">
      {v.lesson?.title ? (
        <>
          <JaQuoted text={ROOM.fromLesson(v.lesson.title)} />{' '}
        </>
      ) : null}
      {ROOM.sysPre}
      <b className="font-semibold">{v.roles.tutor}</b>
      {ROOM.sysMid}
      <b className="font-semibold">{v.roles.learner}</b>
      {`${copulaOf(v.roles.learner)}. ${ROOM.sysFirst}`}
    </p>
  )
}

export default function RolePlayIntro({ rp, teacherName, voice }: { rp: RolePlay; teacherName: string; voice: boolean }) {
  const v = rp.view
  if (!v) return null
  const learnerWithJosa = josa(v.roles.learner, '이', '가')
  const example = v.keyExpressions[0]?.ja ?? null
  return (
    <div className="flex min-w-0 items-start gap-2 pt-2">
      <TeacherAvatar name={teacherName} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5">
        {v.lesson?.title ? (
          <p className="mb-1 text-[13px] text-ink2 break-keep">
            <JaQuoted text={ROOM.fromLesson(v.lesson.title)} />
          </p>
        ) : null}
        <p className="text-[15px] font-semibold break-keep">{ROOM.introLead(josa(teacherName, '은', '는'), v.roles.tutor, `${v.roles.learner}${copulaOf(v.roles.learner)}`)}</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep">{voice ? ROOM.introHowVoice(learnerWithJosa) : ROOM.introHowText(learnerWithJosa)}</p>
        {example ? (
          <>
            <p className="mt-2 text-[13px] text-ink2 break-keep">{ROOM.introTry}</p>
            <p lang="ja" className="mt-1 text-[15px] text-ink2 [overflow-wrap:anywhere]">
              {example}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
