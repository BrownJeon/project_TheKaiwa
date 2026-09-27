/**
 * multipart 본문을 **상한까지만** 읽는다(api-contract #21 ≤2MB). `req.formData()` 는 본문 전체를 제한 없이 메모리에 올리므로
 * Content-Length 가 없거나(청크 전송) 거짓이어도 상한을 넘는 순간 읽기를 끊는다.
 */
import { ApiError } from './http'

export async function readFormDataCapped(req: Request, maxBytes: number): Promise<FormData> {
  const ct = req.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;\s*boundary=/i.test(ct)) throw new ApiError('VALIDATION', 'multipart/form-data 로 보내 주세요.', { reason: 'CONTENT_TYPE' })
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError('VALIDATION', '파일이 너무 커요.', { field: 'audio', reason: 'TOO_LARGE' })
  if (!req.body) throw new ApiError('VALIDATION', '본문이 비었어요.', { reason: 'EMPTY' })

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ApiError('VALIDATION', '파일이 너무 커요.', { field: 'audio', reason: 'TOO_LARGE' })
    }
    chunks.push(value)
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'content-type': ct } }).formData()
  } catch {
    throw new ApiError('VALIDATION', '업로드 형식이 올바르지 않아요.', { reason: 'MULTIPART' })
  }
}
