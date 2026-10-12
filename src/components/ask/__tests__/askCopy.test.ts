import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ASK_COPY } from '../askCopy'
import { readCode } from '../../__tests__/sourceCode'

// task-064 §25-10 · §25-11 ⑮ ⑱ — 문구는 승인 데모 원문, 엔진·모델 이름 0, 3a 는 글자 질문만(마이크 0).

const ENGINE = /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx|anthropic|ollama/i

function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (typeof v === 'function') {
    const fn = v as (...a: unknown[]) => unknown
    out.push(String(fn('N', 'M', 'K')))
  } else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out))
  return out
}

test('⑮ 데모 원문 — 목록·입력 카드·예시·상태 문구', () => {
  assert.equal(ASK_COPY.title, '질문')
  assert.equal(ASK_COPY.roomsTitle, '지난 질문')
  assert.equal(ASK_COPY.more, '이전 질문 더 보기')
  assert.equal(ASK_COPY.composerLabel, '선생님에게 물어보기')
  assert.equal(ASK_COPY.composerPlaceholder, '일본어 표현·문법이나 내 공부 기록을 물어보세요')
  assert.equal(ASK_COPY.ask, '물어보기')
  assert.equal(ASK_COPY.scopeLink, '선생님에게 보내는 범위')
  assert.equal(ASK_COPY.examplesTitle, '이렇게 물어볼 수 있어요')
  assert.deepEqual(
    ASK_COPY.examples.map((e) => [e.tag, e.q]),
    [
      ['문법', '〜ている 와 〜てある 차이가 뭐예요?'],
      ['내 기록', '이번 주에 내가 자주 틀린 조사 알려줘'],
      ['복습', '오늘 복습할 거 뭐 있어?'],
      ['배운 표현', '역에서 길 물을 때 쓰던 표현 뭐였지?'],
    ],
  )
  assert.equal(ASK_COPY.listError, '지난 질문을 불러오지 못했어요')
  assert.equal(ASK_COPY.runningLine, '선생님이 답을 만드는 중이에요')
  assert.equal(ASK_COPY.arrivedToast, '답이 도착했어요')
  assert.equal(ASK_COPY.leaveLine, '다른 화면으로 가도 답은 계속 만들어져요. 돌아오면 이 질문 방에서 볼 수 있어요.')
  assert.deepEqual(ASK_COPY.steps, ['질문 살펴보기', '답 쓰기', '정리하기'])
  assert.equal(ASK_COPY.arrivedLive('사쿠라 선생님', 3, 1), '사쿠라 선생님 답이 도착했어요 · 근거 3개 · 제안 1개')
  assert.equal(ASK_COPY.arrivedLive('선생님', 0, 0), '선생님 답이 도착했어요')
  assert.equal(ASK_COPY.arrivedLive('선생님', 0, 2), '선생님 답이 도착했어요 · 제안 2개')
})

test('⑮ 보내는 범위 시트 = 승인 데모 v2 문구 그대로(Leader L-5) — 보내는 것 5줄 · 보내지 않는 것 3줄 · 음성 줄 없음', () => {
  assert.deepEqual(ASK_COPY.scope.send, [
    '질문과 이 질문 방의 최근 대화(12개까지)',
    '표시 이름·레벨 같은 학습자 정보',
    '공부 기록 요약 — 공부 횟수·점수·복습 예정 목록',
    '내가 채택한 교정의 원래 문장과 고친 문장',
    '수업에서 배운 표현',
  ])
  assert.deepEqual(ASK_COPY.scope.noSend, ['이메일·계정 정보', '내부 번호(id)', '다른 회화·채팅의 대화 내용'])
  const all = allStrings(ASK_COPY.scope).join('\n')
  assert.doesNotMatch(all, /목소리|말로 물어|교정 설명|역할극 표현|단어장 단어/)
  assert.equal(ASK_COPY.scope.title, '선생님에게 보내는 범위')
  assert.equal(ASK_COPY.scope.note, '이 앱은 내 대화·기록을 AI 학습 데이터로 쓰지 않아요.')
})

test('⑮ 엔진·모델 이름 0건 · 「나가서 기다리기」 0건 · 3a 범위 밖 주제 제안·단어 근거 문구 없음', () => {
  const all = allStrings(ASK_COPY)
  assert.ok(all.length > 60)
  for (const s of all) {
    assert.doesNotMatch(s, ENGINE, s)
    assert.ok(!s.includes('나가서 기다리기'), s)
  }
  assert.ok(!('topic' in ASK_COPY), 'ADD_TOPIC 은 3a 에서 구현하지 않는다(L-2)')
  assert.ok(!Object.keys(ASK_COPY.sourceType).includes('WORD'), 'WORD 근거 유형 없음(L-10)')
})

test('⑮ ask/ 화면 소스 문자열에도 엔진·모델 이름 0건', () => {
  const dir = join(__dirname, '..')
  for (const f of readdirSync(dir).filter((x) => /\.(ts|tsx)$/.test(x))) {
    assert.doesNotMatch(readCode(join(dir, f)), ENGINE, f)
  }
})

test('⑱ 3a 범위 — ask/ 소스에 마이크·녹음·실시간 인식 import 0건, 보내는 입력 경로는 TEXT 만', () => {
  const dir = join(__dirname, '..')
  for (const f of readdirSync(dir).filter((x) => /\.(ts|tsx)$/.test(x))) {
    const code = readCode(join(dir, f))
    for (const bad of ['getUserMedia', 'useRealtimeStt', 'PushToTalk', 'speech/stt', 'MediaRecorder', 'REALTIME_STT', 'SERVER_STT', '🎤']) {
      assert.ok(!code.includes(bad), `${f} 에 ${bad}`)
    }
    assert.ok(!/inputSource\s*:\s*'(?!TEXT)/.test(code), f)
  }
})
