/**
 * 상황 역할극 라우트 조합 헬퍼(task-010d A3b-1) — 결과 화면의 "다음 상황"(S8 `next`)은 learning 추천, 수업 제목은 learning 수업 읽기라서
 * conversation(L2)이 아니라 라우트가 붙인다(L3 → L2 import 없음, conversation 은 결과·진행 값만).
 * 둘 다 부가 칸이라 실패하면 칸 없이 응답한다(결과·대화 응답을 막지 않는다).
 */
import { getLesson, listScenarios, parseScenarioListQuery } from '@/modules/learning'
import type { RolePlayNext } from '@/types/chat'

/** 코드 추천 첫 상황(방금 마친 상황 제외). 추천은 "오늘 한 상황"을 이미 빼지만, 어제 끝낸 대화를 다시 열면 같은 상황이 올 수 있어 한 번 더 거른다. */
export async function nextScenarioFor(userId: string, currentScenarioId: string): Promise<RolePlayNext | undefined> {
  try {
    const r = await listScenarios(userId, parseScenarioListQuery(new URLSearchParams({ recommended: '1', limit: '3' })))
    const it = r.items.find((i) => i.id !== currentScenarioId)
    return it ? { id: it.id, title: it.title, titleJa: it.titleJa, goalKo: it.goalKo } : undefined
  } catch {
    return undefined
  }
}

/** 수업에서 이어진 역할극의 수업 제목(`rp-fromlesson`). 없거나 남의 수업·읽기 실패면 null. */
export async function lessonRefFor(userId: string, lessonId: string | null): Promise<{ id: string; title: string } | null> {
  if (!lessonId) return null
  try {
    const l = await getLesson(userId, lessonId)
    return { id: l.id, title: l.title }
  } catch {
    return null
  }
}
