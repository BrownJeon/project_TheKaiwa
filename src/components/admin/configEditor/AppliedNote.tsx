/** 적용 결과 한 줄(데모 v2 `appliedNote`) — 새 버전 번호 · 첫 적용 기준선 · 반영 시점(이 서버 바로, 다른 프로세스 30초) · 파생 버전 · env 가 덮는 키. */
import type { ConfigApplyResultDto } from '@/types/admin'
import { Note } from './ui'

export default function AppliedNote({ r }: { r: ConfigApplyResultDto | null }) {
  if (!r) return null
  if (!r.changed) {
    return (
      <Note tone="neu" role="status" className="mt-2.5">
        지금 저장값과 같아 적용하지 않았어요(버전을 만들지 않았어요).
      </Note>
    )
  }
  const derived = r.derived[0]
  return (
    <Note tone="good" role="status" className="mt-2.5">
      <b className="text-good">적용했어요 · v{r.version?.version}</b>
      {r.baselineVersion ? ' — 그 전 값은 기준선 v1 로 함께 남겼어요.' : ''} 이 서버에는 바로, 다른 서버 프로세스에는 30초 안에 반영돼요.
      {derived ? ` 미리듣기 버전도 함께 올라갔어요(v${derived.version.version}).` : ''}
      {r.warnings.includes('W_SHADOWED_BY_ENVIRONMENT') ? ' 환경 변수가 덮는 키는 실제 값이 그대로예요.' : ''}
    </Note>
  )
}
