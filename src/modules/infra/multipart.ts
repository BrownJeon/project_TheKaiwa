/**
 * multipart 본문을 **상한까지만** 읽는다(api-contract #21 ≤2MB). `req.formData()` 는 본문 전체를 제한 없이 메모리에 올리므로
 * Content-Length 가 없거나(청크 전송) 거짓이어도 상한을 넘는 순간 읽기를 끊는다.
 */
import { ApiError, readBodyCapped } from './http'

export async function readFormDataCapped(req: Request, maxBytes: number): Promise<FormData> {
  const ct = req.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;\s*boundary=/i.test(ct)) throw new ApiError('VALIDATION', 'multipart/form-data 로 보내 주세요.', { reason: 'CONTENT_TYPE' })
  if (!req.body) throw new ApiError('VALIDATION', '본문이 비었어요.', { reason: 'EMPTY' })
  const bytes = await readBodyCapped(req, maxBytes)
  if (!bytes) throw new ApiError('VALIDATION', '파일이 너무 커요.', { field: 'audio', reason: 'TOO_LARGE' })
  try {
    return await new Response(Buffer.from(bytes), { headers: { 'content-type': ct } }).formData()
  } catch {
    throw new ApiError('VALIDATION', '업로드 형식이 올바르지 않아요.', { reason: 'MULTIPART' })
  }
}
