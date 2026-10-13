/**
 * task-066 §26-13 ⑥⑬⑮ — 말로 묻기 문구·보내지 못한 말 띠·[고쳐서 묻기] 대상·소스 불변식(목소리 미저장).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { unsentText } from '@/components/talk/talkCopy'
import type { ChatMessageView } from '@/types/chat'
import {
  ASK_VOICE_COPY,
  askUnsentBarReason,
  askUnsentCanResend,
  askUnsentReasonOf,
  askUnsentText,
  type AskUnsent,
} from '../askVoiceCopy'
import { isVoiceQuestion, lastUserVoiceId, voiceQuestionTexts } from '../voiceBubble'
import AskQuestionBubble from '../AskQuestionBubble'

const ENGINE_NAMES = /claude|anthropic|haiku|sonnet|opus|whisper|reazon|sherpa|zipformer|style[-_ ]?bert|sbv2|qwen|ollama|gateway|MIC_TEST|model_id|speaker_id/i

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (typeof v === 'function') return [String((v as (n: number) => string)(12))]
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings)
  return []
}

test('문구 = §26-10 B 원문', () => {
  assert.equal(ASK_VOICE_COPY.idle, '누르고 있는 동안 일본어로 말해요')
  assert.equal(ASK_VOICE_COPY.pttLabel, '누르고 있는 동안 일본어로 말하기')
  assert.equal(ASK_VOICE_COPY.waiting, '답을 받은 뒤 말할 수 있어요')
  assert.equal(ASK_VOICE_COPY.unavailable, '지금은 말로 물어볼 수 없어요 · 글자로 물어보세요')
  assert.equal(ASK_VOICE_COPY.daily, '오늘은 더 물어볼 수 없어요')
  assert.equal(ASK_VOICE_COPY.out, '손을 떼면 보내지 않아요')
  assert.equal(ASK_VOICE_COPY.cancelHint, '틀렸으면 손가락을 버튼 밖으로 빼서 떼세요')
  assert.equal(ASK_VOICE_COPY.cancelledToast, '보내지 않았어요')
  assert.equal(ASK_VOICE_COPY.toText, '글자로 묻기')
  assert.equal(ASK_VOICE_COPY.toVoice, '말로 묻기')
  assert.equal(ASK_VOICE_COPY.asked, '말로 물었어요')
  assert.equal(ASK_VOICE_COPY.fix, '고쳐서 묻기')
  assert.equal(ASK_VOICE_COPY.meSr, '나(말로 물음): ')
  assert.equal(ASK_VOICE_COPY.unsent.rate(12), '질문을 너무 자주 보냈어요. 12초 뒤에 다시 보낼 수 있어요.')
  assert.equal(ASK_VOICE_COPY.unsent.rateMin(3), '질문을 너무 자주 보냈어요. 3분 뒤에 다시 보낼 수 있어요.')
  assert.equal(ASK_VOICE_COPY.unsent.daily, '오늘은 더 물어볼 수 없어요 — 내일 다시 물어봐 주세요.')
  assert.equal(ASK_VOICE_COPY.unsent.busy(20), '지금 질문이 몰려 있어요. 20초 뒤에 다시 물어봐 주세요.')
  assert.equal(ASK_VOICE_COPY.unsent.busyNoSec, '지금 질문이 몰려 있어요. 잠시 뒤에 다시 물어봐 주세요.')
  assert.equal(ASK_VOICE_COPY.unsent.other, '선생님이 다른 대화에 답하는 중이라 보내지 못했어요. 답이 끝나면 다시 보내 주세요.')
})

test('문구에 엔진·모델·호스트·티켓 용도 이름 0, 「질문 방」·「목록으로」 0', () => {
  for (const s of strings(ASK_VOICE_COPY)) {
    assert.doesNotMatch(s, ENGINE_NAMES, s)
    assert.doesNotMatch(s, /질문 방|목록으로|나가서 기다리기/, s)
  }
})

const U = (p: Partial<AskUnsent>): AskUnsent => ({ text: '大丈夫', reason: 429, ...p })

test('보내지 못한 말 띠 문구(§26-7 G 표): 분당·분 단위·하루·몰림·서버 409·경합 409·네트워크', () => {
  assert.equal(askUnsentText(U({ askReason: 'ASK_RATE' }), 12), ASK_VOICE_COPY.unsent.rate(12))
  assert.equal(askUnsentText(U({ askReason: 'ASK_RATE' }), 91), ASK_VOICE_COPY.unsent.rateMin(2), '90초 넘으면 분')
  assert.equal(askUnsentText(U({}), 40), ASK_VOICE_COPY.unsent.rate(40), '이유 없음 ≤3,600 = 분당')
  assert.equal(askUnsentText(U({}), 3700), ASK_VOICE_COPY.unsent.daily, '이유 없음 >3,600 = 하루')
  assert.equal(askUnsentText(U({ askReason: 'ASK_DAILY' }), 30), ASK_VOICE_COPY.unsent.daily)
  assert.equal(askUnsentText(U({ askReason: 'ASK_BUSY' }), 20), ASK_VOICE_COPY.unsent.busy(20))
  assert.equal(askUnsentText(U({ askReason: 'ASK_BUSY' }), null), ASK_VOICE_COPY.unsent.busyNoSec)
  assert.equal(askUnsentText(U({ askReason: 'ASK_RATE', retryAfterSec: 30 }), null), ASK_VOICE_COPY.unsent.rate(30), '첫 틱 전엔 처음 받은 초')
  assert.equal(askUnsentText(U({ reason: 409 }), null), ASK_VOICE_COPY.unsent.other)
  assert.equal(askUnsentText(U({ reason: 'self409' }), null), unsentText(409))
  assert.equal(askUnsentText(U({ reason: 0 }), null), unsentText(0))
  assert.equal(askUnsentText(U({ reason: 400, serverMessage: '서버' }), null), '서버')
  assert.equal(askUnsentText(U({ reason: 422 }), null), unsentText(422))
  for (const r of [12, 91, 3700]) assert.doesNotMatch(askUnsentText(U({}), r), /3번|60번|횟수/, '남은 횟수·한도 숫자 없음')
})

test('띠 [다시 보내기]: 하루·400 없음, 그 밖 있음 · self409 는 공용 띠에 409 로', () => {
  assert.equal(askUnsentCanResend(U({ askReason: 'ASK_DAILY' }), 30), false)
  assert.equal(askUnsentCanResend(U({}), 5000), false)
  assert.equal(askUnsentCanResend(U({ askReason: 'ASK_RATE' }), 30), true)
  assert.equal(askUnsentCanResend(U({ askReason: 'ASK_BUSY' }), 30), true)
  assert.equal(askUnsentCanResend(U({ reason: 400 }), null), false)
  for (const r of [409, 'self409', 0, 422, 'other'] as const) assert.equal(askUnsentCanResend(U({ reason: r }), null), true, String(r))
  assert.equal(askUnsentBarReason(U({ reason: 'self409' })), 409)
  assert.equal(askUnsentBarReason(U({ reason: 429 })), 429)
  assert.deepEqual([409, 429, 400, 422, 0, -1, 500, 404].map(askUnsentReasonOf), [409, 429, 400, 422, 0, 0, 'other', 'other'])
})

const M = (id: string, role: 'USER' | 'ASSISTANT', inputSource: ChatMessageView['inputSource'], content = id): Pick<ChatMessageView, 'id' | 'role' | 'content' | 'inputSource'> => ({
  id,
  role,
  inputSource,
  content,
})

test('[고쳐서 묻기] 대상 = 마지막 USER 가 말일 때 그 id(⑮)', () => {
  assert.equal(lastUserVoiceId([M('u1', 'USER', 'REALTIME_STT')]), 'u1')
  assert.equal(lastUserVoiceId([M('u1', 'USER', 'REALTIME_STT'), M('a1', 'ASSISTANT', null)]), 'u1', '답이 뒤에 있어도 마지막 USER 기준')
  assert.equal(lastUserVoiceId([M('u1', 'USER', 'REALTIME_STT'), M('a1', 'ASSISTANT', null), M('u2', 'USER', 'TEXT')]), null, '글자 질문이 뒤에 오면 없음')
  assert.equal(lastUserVoiceId([M('u1', 'USER', 'REALTIME_STT'), M('u2', 'USER', undefined)]), null)
  assert.equal(lastUserVoiceId([M('u1', 'USER', 'TEXT'), M('u2', 'USER', 'REALTIME_STT')]), 'u2')
  assert.equal(lastUserVoiceId([M('a1', 'ASSISTANT', null)]), null)
  assert.equal(lastUserVoiceId([]), null)
  assert.equal(isVoiceQuestion({ role: 'ASSISTANT', inputSource: 'REALTIME_STT' }), false)
})

test('읽기 층 요청 글 = 말로 물은 USER 글만(중복·빈 글 제외)', () => {
  const ms = [M('u1', 'USER', 'REALTIME_STT', '大丈夫'), M('a1', 'ASSISTANT', null, '答'), M('u2', 'USER', 'TEXT', '한국어'), M('u3', 'USER', 'REALTIME_STT', '大丈夫'), M('u4', 'USER', 'REALTIME_STT', ' ')]
  assert.deepEqual(voiceQuestionTexts(ms), ['大丈夫'])
})

const SRC = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

test('목소리 미저장(⑥ 소스): 입력 묶음은 점검 용도 티켓 1건·회화 용도 0·대화 id 안 넘김·발화 id 0·발화 업로드 0·콘솔 0', () => {
  const src = SRC('src/components/ask/useAskInput.tsx')
  assert.equal(src.match(/purpose: 'MIC_TEST'/g)?.length, 1)
  assert.ok(!src.includes("'TURN'"))
  const call = src.slice(src.indexOf('useRealtimeStt({'), src.indexOf('})', src.indexOf('useRealtimeStt({')))
  assert.ok(call.length > 0 && !call.includes('chatId'), call)
  assert.ok(!/utteranceId/.test(src))
  assert.ok(!/\/api\/v1\/utterances|uploadOnDeviceUtterance|useUtteranceReviews|canMine|buildTurnBody/.test(src))
  for (const f of ['useAskInput.tsx', 'askInputControl.ts', 'voiceView.ts', 'askVoiceCopy.ts', 'voiceBubble.ts', 'AskQuestionBubble.tsx']) {
    const s = SRC(`src/components/ask/${f}`)
    assert.ok(!/console\./.test(s), `${f}: console`)
    assert.ok(!/window\.Capacitor|\bfetch\(/.test(s), `${f}: 직접 호출`)
  }
})

test('밀어서 취소·여백(소스): 말 바는 cancelOutside·safeBottom={false}·「글자로 묻기」, 글자 바는 safeBottom={false}', () => {
  const src = SRC('src/components/ask/useAskInput.tsx')
  const bar = src.slice(src.indexOf('<VoiceBar'), src.indexOf('/>', src.indexOf('<VoiceBar')))
  assert.match(bar, /cancelOutside=\{cancelOutside\}/)
  assert.match(bar, /safeBottom=\{false\}/)
  assert.match(bar, /keyboardLabel=\{ASK_VOICE_COPY\.toText\}/)
  const comp = src.slice(src.indexOf('<Composer'), src.indexOf('leading=', src.indexOf('<Composer')))
  assert.match(comp, /safeBottom=\{false\}/)
  // 취소한 말은 늦게 온 결과가 와도 보내지 않는다 — 규칙은 `askInputControl` 이 갖고 행동 시험(askInputControl.test.ts V3)이 잠근다.
  assert.match(SRC('src/components/ask/askInputControl.ts'), /onFinal: \(text\) => \{\s*if \(cancelled\) return/)
})

const TEXT_NO_TIME =
  '<div class="flex min-w-0 flex-col items-end"><p class="min-w-0 max-w-[84%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-[15px] leading-[1.55] text-ink [overflow-wrap:anywhere]"><span class="sr-only">나: </span><span lang="ja" style="word-break:inherit">大丈夫</span><span> 는 무슨 뜻이에요?</span></p><p class="min-h-6 text-[12px] text-ink2"></p></div>'
const TEXT_SENDING = TEXT_NO_TIME.replace('<p class="min-h-6 text-[12px] text-ink2"></p>', '<p class="min-h-6 text-[12px] text-ink2">보내는 중…</p>')

test('내 질문 말풍선: 글자 갈래는 task-064 마크업 그대로(확장 전 고정), 말 갈래는 일본어 17px·「말로 물었어요」·[고쳐서 묻기]는 허락될 때만', () => {
  const base = { id: 'u1', role: 'USER', content: '大丈夫 는 무슨 뜻이에요?', createdAt: '2026-10-13T00:05:00.000Z', status: 'DONE' } as unknown as ChatMessageView
  const text = { ...base, inputSource: 'TEXT' } as ChatMessageView
  assert.equal(renderToStaticMarkup(createElement(AskQuestionBubble, { m: text, showTime: false })), TEXT_NO_TIME)
  assert.equal(renderToStaticMarkup(createElement(AskQuestionBubble, { m: { ...text, localStatus: 'SENDING' }, showTime: false })), TEXT_SENDING)
  assert.equal(renderToStaticMarkup(createElement(AskQuestionBubble, { m: text, sending: true })), TEXT_SENDING, '임시 말풍선(sending prop)')
  assert.match(renderToStaticMarkup(createElement(AskQuestionBubble, { m: text, showTime: true })), /<time dateTime="2026-10-13T00:05:00.000Z">/)
  assert.doesNotMatch(renderToStaticMarkup(createElement(AskQuestionBubble, { m: text, showTime: false, canFix: true, onFix: () => undefined })), /고쳐서 묻기|말로 물었어요/, '글자 질문엔 없음')

  const voice = { ...base, content: 'それはちょっと難しいですね', inputSource: 'REALTIME_STT' } as ChatMessageView
  const plain = renderToStaticMarkup(createElement(AskQuestionBubble, { m: voice, showTime: false }))
  assert.match(plain, /<div lang="ja" class="min-w-0 max-w-\[84%\] rounded-2xl rounded-br-md bg-accent-soft/)
  assert.match(plain, /text-\[17px\]/)
  assert.match(plain, /나\(말로 물음\): /)
  assert.match(plain, /말로 물었어요/)
  assert.match(plain, /それはちょっと難しいですね/)
  assert.doesNotMatch(plain, /고쳐서 묻기/, 'canFix 없으면 없음')
  const fix = renderToStaticMarkup(createElement(AskQuestionBubble, { m: voice, showTime: false, canFix: true, onFix: () => undefined }))
  assert.match(fix, /<button type="button" class="inline-flex min-h-11[^"]*">고쳐서 묻기<\/button>/)
  assert.match(renderToStaticMarkup(createElement(AskQuestionBubble, { m: voice, sending: true, canFix: true, onFix: () => undefined })), /고쳐서 묻기<\/button>보내는 중…/)
})
