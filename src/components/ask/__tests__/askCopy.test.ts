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

test('⑬ 26-10 A 원문 — 안내 말풍선·알약·범위 줄·메뉴·대화 문구', () => {
  assert.equal(ASK_COPY.title, '질문')
  assert.equal(ASK_COPY.more, '이전 질문 더 보기')
  const g = ASK_COPY.greeting
  assert.equal(g.leadHead + g.leadBold + g.leadTail, '무엇이든 물어보세요. 일본어 표현·문법도, 내 공부 기록(교정·복습·수업)도 좋아요.')
  assert.equal(g.leadBold, '내 공부 기록')
  assert.equal(g.chipsLabel, '글로 물어보기 · 누르면 바로 물어봐요')
  assert.deepEqual(
    g.examples.map((e) => [e.tag, e.q]),
    [
      ['문법', '〜ている 와 〜てある 차이가 뭐예요?'],
      ['내 기록', '이번 주에 내가 자주 틀린 조사 알려줘'],
      ['복습', '오늘 복습할 거 뭐 있어?'],
    ],
  )
  assert.equal(g.voiceHead, '모르는 일본어는 🎤 로 그대로 말해 보세요')
  assert.equal(g.voiceBody, '뜻·읽기·느낌을 예문과 함께 알려 줘요. 예)')
  assert.deepEqual(g.voiceExamples, ['大丈夫', 'お疲れ様でした', 'それはちょっと難しいですね'])
  const h = ASK_COPY.history
  assert.deepEqual([h.button, h.running, h.newAnswer, h.title, h.current, h.empty], ['지난 질문', '답 만드는 중', '새 답 도착', '지난 질문', '지금 대화', '아직 지난 질문이 없어요.'])
  assert.deepEqual([h.aria('idle'), h.aria('running'), h.aria('new')], ['지난 질문', '지난 질문 — 답 만드는 중', '지난 질문 — 새 답 도착'])
  assert.deepEqual(ASK_COPY.scopeLine, {
    text: '내 학습 기록 일부가 AI 에 보내져요',
    more: '자세히',
    aria: '내 학습 기록 일부가 AI 에 보내져요 — 자세히, 선생님에게 보내는 범위',
  })
  const m = ASK_COPY.menu
  assert.deepEqual([m.title, m.noun, m.newQ, m.scope, m.displayHead, m.voiceHead, m.convHead, m.emptyNote, m.delete, m.confirmTitle], [
    '질문 메뉴', '대화', '새 질문 시작', '보내는 범위 보기', '일본어 표시 · 모든 화면에 적용', '말로 묻기', '이 대화',
    '아직 보낸 질문이 없어 이름 바꾸기·삭제는 없어요.', '이 대화 삭제', '이 대화를 삭제할까요?',
  ])
  assert.deepEqual([ASK_COPY.backLabel, ASK_COPY.toList, ASK_COPY.menuAria], ['질문으로', '질문으로', '질문 메뉴'])
  assert.deepEqual([ASK_COPY.deletedToast, ASK_COPY.loadError, ASK_COPY.notFoundTitle, ASK_COPY.goneToast, ASK_COPY.loadingConv], [
    '대화를 삭제했어요', '대화를 불러오지 못했어요.', '대화를 찾을 수 없어요', '대화를 찾을 수 없어요', '대화를 불러오고 있어요',
  ])
  assert.equal(ASK_COPY.loadErrorBody, '연결을 확인하고 다시 시도해 주세요. 새 질문은 그대로 보낼 수 있어요.')
  assert.equal(ASK_COPY.placeholderNew, '무엇이든 물어보세요')
  assert.equal(ASK_COPY.placeholder, '이어서 물어보세요')
  assert.equal(ASK_COPY.listError, '지난 질문을 불러오지 못했어요')
  assert.equal(ASK_COPY.arrivedToast, '답이 도착했어요')
  assert.deepEqual(ASK_COPY.steps, ['질문 살펴보기', '답 쓰기', '정리하기'])
  assert.equal(ASK_COPY.arrivedLive('사쿠라 선생님', 3, 1), '사쿠라 선생님 답이 도착했어요 · 근거 3개 · 제안 1개')
  assert.equal(ASK_COPY.arrivedLive('선생님', 0, 0), '선생님 답이 도착했어요')
})

test('⑬ 대기 안내 끝말 — Leader L-1: D1=B 라 「지난 질문」에서(데모의 「이 자리에서」·옛 「이 질문 방에서」 아님)', () => {
  assert.equal(ASK_COPY.leaveLine, '다른 화면으로 가도 답은 계속 만들어져요. 돌아오면 「지난 질문」에서 볼 수 있어요.')
  assert.ok(!ASK_COPY.leaveLine.includes('이 자리에서'))
})

test('⑬ 보내는 범위 시트 = 승인 데모 v2 원문(Leader L-5) — 보내는 것 5 · 보내지 않는 것 4(목소리 줄) · 「말로 물어볼 때」 띠 · 확인 문구 없음', () => {
  const sc = ASK_COPY.scope
  assert.equal(sc.leadHead + sc.leadBold + sc.leadTail, '질문을 보내면 아래 내용이 선생님(외부 AI 서비스)에게 전달돼요. 기록은 한 번에 20건·2,000자까지만 보내요.')
  assert.deepEqual(sc.send, [
    '질문과 이 대화의 최근 메시지(12개까지)',
    '표시 이름·레벨 같은 학습자 정보',
    '공부 기록 요약 — 공부 횟수·점수·복습 예정 목록',
    '내가 채택한 교정의 원래 문장과 고친 문장',
    '수업에서 배운 표현',
  ])
  assert.deepEqual(sc.noSend, ['이메일·계정 정보', '내부 번호(id)', '내 목소리 — 말로 물어도 선생님에게는 들린 글(일본어)만 가요', '다른 회화·채팅의 대화 내용'])
  assert.ok(sc.noSend[sc.voiceIndex].startsWith(sc.voiceBold))
  assert.equal(sc.voiceBandBold + sc.voiceBandTail, '말로 물어볼 때 — 일본어 음성 인식은 회화와 같은 방식(휴대폰, 또는 이 앱 서버)으로 글자로 바꿔요. 선생님에게는 그 글만 가요.')
  assert.equal(sc.title, '선생님에게 보내는 범위')
  assert.equal(sc.note, '이 앱은 내 대화·기록을 AI 학습 데이터로 쓰지 않아요. 이 안내는 ⋯ 메뉴 「보내는 범위 보기」에서도 볼 수 있어요.')
  assert.equal(sc.close, '닫기')
  for (const k of ['ok', 'cancel', 'noteFirstTail']) assert.ok(!(k in sc), `scope.${k} 없음(확인 관문 제거)`)
  const all = allStrings(sc).join('\n')
  assert.doesNotMatch(all, /알겠어요, 보내기|30일/)
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

test('⑬ 화면 문구 — MIC_TEST·「질문 방」·「목록으로」·「나가서 기다리기」 0건, 옛 목록 화면 문구 키 없음', () => {
  for (const s of allStrings(ASK_COPY)) {
    for (const bad of ['MIC_TEST', '질문 방', '목록으로', '나가서 기다리기']) assert.ok(!s.includes(bad), `${bad}: ${s}`)
  }
  for (const k of ['composerLabel', 'composerPlaceholder', 'ask', 'scopeLink', 'examplesTitle', 'examplesDescHead', 'examplesRowTitle', 'examples', 'roomsTitle']) {
    assert.ok(!(k in ASK_COPY), k)
  }
})
