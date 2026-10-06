/**
 * task-039(IMP-0025) — 교정 설명이 "일상 회화 중심"인지 "JLPT 식 문법 설명"인지 가르는 **규칙 기반 판정기**(순수 함수, 모델 호출 없음).
 * `task039-explain-ab.ts` 가 측정 요약에, 단위 테스트(`src/modules/conversation/__tests__/task039.test.ts`)가 어휘 사전의 회귀에 쓴다.
 *
 * 판정은 거칠다 — 키워드·급수 표기만 본다. **보고서에는 반드시 샘플 눈 판정을 함께 적는다**(규칙 판정은 방향을 보는 용도).
 *  - `examMarker`  : 급수·시험 틀(JLPT·N5~N1 표기·시험·출제·급수 …) — 설명이 "시험 대비" 쪽으로 기운 신호.
 *  - `strongTerm`  : 교과서식 문법 용어(문형·접속 형태·て형·ない형·조동사·어미·용법 …) — 문법 술어가 설명의 중심이 된 신호.
 *  - `weakTerm`    : 입문 설명에도 흔히 나오는 말(조사·활용·동사·형용사 …) — 따로 세고 JLPT 식 판정에는 넣지 않는다.
 *  - `jlptStyle`   : examMarker || strongTerm (메인 설명에서는 줄어야 하는 것, 추가 설명 칸에서는 오히려 허용되는 것).
 *  - `everyday`    : "일상·회화·자연스러운·실제로·말할 때·쓰는 표현·라고 해요…" 처럼 쓰임 맥락을 직접 말하는 표지(있다고 좋은 설명은 아니다 — 보조 지표). 기준선·작업본 **모두 같은 사전**으로 센다
 *                   (1회전 결과를 본 뒤 `쓰임|쓸 때|쓰는 표현|라고 해요|자주 써|주로|평소` 를 더했고, 기준선 행도 이 사전으로 다시 센다 — 판정은 호출 없이 JSON 에서 재계산).
 *  - grammarPoint 는 짧은 라벨이라 일본어 문법 용어(過去形·疑問文·助詞·活用 …)와 입문 용어(과거형·동사·조사 …)도 문법 용어 라벨(`gpTerm`)로 센다.
 */

export const EXAM_RE = /JLPT|능력\s*시험|급수|시험|출제|기출|수험|\bN[1-5]\b/
export const STRONG_TERM_RE =
  /문형|문법\s*(?:항목|용어|포인트|패턴|표현)|접속\s*(?:형태|형|방법|규칙)|활용\s*(?:형|어미|규칙|표)|[てたな]형|ない형|ます형|사전형|기본형|원형|연용형|연체형|가정형|미연형|의지형|명령형|가능형|수동형|사역형|조동사|보조동사|형식명사|접속조사|격조사|종조사|부조사|양태|전문\s*(?:표현|의|형)|伝聞|様態|어미|어간|용법|존경어|겸양어|자동사|타동사|수동태|사역수동|가정\s*표현|조건\s*표현|조건형/
export const WEAK_TERM_RE = /조사|활용|접속|시제|과거형|부정형|정중형|동사|형용사|명사|수동|사역|조건|가정|보조/
export const EVERYDAY_RE = /일상|회화|실제로|자연스러|보통|흔히|많이\s*(?:써|쓰|말)|구어|입말|말할\s*때|원어민|일본\s*사람|일본인|딱딱|편하게|친구끼리|가게|식당|줄여|축약|쓰임|쓸\s*때|쓰는\s*표현|라고\s*(?:해요|말해요|합니다|말합니다)|자주\s*(?:써|쓰|말)|주로|평소/
/** grammarPoint 라벨에서 보는 일본어 문법 용어(기능 설명인 許可·依頼 등은 넣지 않는다 — 쉬운 말에 가깝다). */
export const JA_LABEL_RE = /過去形|否定形|丁寧形|普通形|可能形|受身|使役|条件|仮定|命令形|意志形|疑問文|助詞|活用|接続|文型|用法|敬語|尊敬|謙譲|終助詞|形容詞|動詞|名詞|副詞|助動詞|連用形|連体形|未然形|て形|た形|ない形|ます形|辞書形|様態|伝聞|推量/

export interface TextFlags {
  examMarker: boolean
  strongTerm: boolean
  weakTerm: boolean
  jlptStyle: boolean
  everyday: boolean
}

export function flagsOf(text: string | null | undefined): TextFlags {
  const t = text ?? ''
  const examMarker = EXAM_RE.test(t)
  const strongTerm = STRONG_TERM_RE.test(t)
  return { examMarker, strongTerm, weakTerm: WEAK_TERM_RE.test(t), jlptStyle: examMarker || strongTerm, everyday: EVERYDAY_RE.test(t) }
}

export interface StyleSample {
  explanationKo: string | null
  grammarPoint: string | null
  extraNoteKo?: string | null
}

export interface StyleVerdict {
  /** 메인 설명(explanationKo)이 JLPT 식인가. */
  explJlpt: boolean
  /** 메인 설명이 일상 쓰임을 직접 말하면서 JLPT 식이 아닌가. */
  explEveryday: boolean
  /** grammarPoint 라벨이 문법 용어·급수 표기인가(null 이면 false). */
  gpTerm: boolean
  /** 메인(설명·문법 포인트) 중 어느 한쪽이라도 JLPT 식. */
  mainJlpt: boolean
  extraPresent: boolean
  /** 추가 설명 칸에 JLPT 식(급수·문법 용어)이 실제로 들어 있는가. */
  extraJlpt: boolean
}

export function verdictOf(s: StyleSample): StyleVerdict {
  const ef = flagsOf(s.explanationKo)
  const gp = s.grammarPoint ?? ''
  const gpTerm = Boolean(gp) && (JA_LABEL_RE.test(gp) || WEAK_TERM_RE.test(gp) || flagsOf(gp).jlptStyle)
  const extra = s.extraNoteKo?.trim() ?? ''
  return {
    explJlpt: ef.jlptStyle,
    explEveryday: ef.everyday && !ef.jlptStyle,
    gpTerm,
    mainJlpt: ef.jlptStyle || gpTerm,
    extraPresent: extra.length > 0,
    extraJlpt: extra.length > 0 && (flagsOf(extra).jlptStyle || /〜|~/.test(extra)),
  }
}
