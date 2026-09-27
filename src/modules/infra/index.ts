/**
 * L6 AI Infrastructure — db(prisma)·auth(OAuth·초대코드·세션)·jwt·session·dates(KST)·native/bridge·secrets·storage·jobs·runtime·config·audit·validation·logging. Phase 0 = auth·db·jwt·session·dates·native 이식(TheMeal).
 *
 * 이 파일이 모듈의 **유일한 공개 API** 다 — 다른 층·모듈은 `@/modules/infra` 만 import 한다(eslint no-restricted-imports).
 * 정본: docs/design/module-dependency.md
 */
export { prisma } from './db'
export { auth, isOwner } from './auth'
export { SESSION_COOKIE_NAME, verifyJwt } from './jwt'
export { setSessionCookie, clearSessionCookie } from './session'
export * as dates from './dates'
export { ok, fail, withApi, requireSession, readJsonObject, rateLimit, ApiError, toErrorResponse, classifyError } from './http'
export type { ServerErrorCode, ClassifiedError } from './http'
export { withTransaction, lockUserRow } from './tx'
export type { Tx, TxOptions } from './tx'
export { sanitizeText, codePointLength, truncateCodePoints, toPreview, escapeLike } from './text'
export { encodeCursor, decodeCursor, parseLimit, isTimeIdCursor, isOffsetCursor } from './pagination'
export { sseResponse, formatSseEvent, SSE_PING_MS } from './sse'
export type { SseChannel } from './sse'
export * as jobs from './jobs'
export type { JobDto } from './jobs'
export { recordAudit } from './audit'
export type { AuditEntry } from './audit'
export { describeCredentialRef, isCredentialRef, CREDENTIAL_REF_PATTERN, hasServiceSecret, serviceSecretOrigin, readServiceSecretFor } from './secrets'
export type { CredentialRefStatus, ServiceSecretName, ServiceSecretGrant } from './secrets'
export { dataRoot, dataPath, writeDataFile, readDataFile, removeDataFile, ensureDataDir, StorageError } from './storage'
export { maskSensitive, maskString, looksSecret, MASK } from './mask'
export { signScopedToken, verifyScopedToken } from './scopedToken'
export type { ScopedToken, ScopedTokenPayload } from './scopedToken'
export { checkInternalSecret, INTERNAL_SECRET_HEADER } from './internalAuth'
export type { InternalAuthResult } from './internalAuth'
export { readFormDataCapped } from './multipart'
