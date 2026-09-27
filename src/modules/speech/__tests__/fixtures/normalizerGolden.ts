/**
 * 정규화 골든셋(task-003d 완료 기준 4, speech-platform/16 §3.3) — 숫자·날짜·시간·단위·조수사·기호·약어.
 *   normalized : 앱 정규화기의 기대 출력(단위 테스트가 정확히 비교)
 *   reading    : 래퍼 `/g2p` 읽기(발음형 가타카나)에 **들어 있어야 하는 조각** — 라이브 스모크가 長音(ー)·ウ 를 지우고 포함 여부로 비교
 * 읽기 조각은 pyopenjtalk 발음형 기준이다. 라이브에서 어긋나면 정규화 표(normalizer.ts)를 고치고 여기에 기록한다.
 */
export interface GoldenCase {
  id: string
  category: 'DATE' | 'TIME' | 'NUMBER' | 'UNIT' | 'COUNTER' | 'SYMBOL' | 'ABBREVIATION' | 'CURRENCY'
  text: string
  normalized: string
  reading: string[]
}

export const NORMALIZER_GOLDEN: readonly GoldenCase[] = [
  { id: 'g01', category: 'DATE', text: '2026年9月26日に会いましょう。', normalized: '二千二十六年九月二十六日に会いましょう。', reading: ['ニセンニジューロクネン', 'クガツニジューロクニチ'] },
  { id: 'g02', category: 'DATE', text: '9月1日は休みです。', normalized: '九月ついたちは休みです。', reading: ['クガツツイタチ'] },
  { id: 'g03', category: 'DATE', text: '10月14日に出発します。', normalized: '十月じゅうよっかに出発します。', reading: ['ジューガツジューヨッカ'] },
  { id: 'g04', category: 'DATE', text: '2026/9/26の予定です。', normalized: '二千二十六年九月二十六日の予定です。', reading: ['ニセンニジューロクネンクガツニジューロクニチ'] },
  { id: 'g05', category: 'TIME', text: '9:30に駅で待ち合わせです。', normalized: '九時三十分に駅で待ち合わせです。', reading: ['クジサンジュップン'] },
  { id: 'g06', category: 'TIME', text: '朝7:05に起きました。', normalized: '朝七時五分に起きました。', reading: ['シチジゴフン'] },
  { id: 'g07', category: 'TIME', text: '10:00から会議です。', normalized: '十時から会議です。', reading: ['ジュージカラ'] },
  { id: 'g08', category: 'COUNTER', text: '午後3時に来てください。', normalized: '午後三時に来てください。', reading: ['ゴゴサンジ'] },
  { id: 'g09', category: 'UNIT', text: '5kmを走りました！', normalized: '五キロメートルを走りました！', reading: ['ゴキロメートル'] },
  { id: 'g10', category: 'UNIT', text: '30%オフです。', normalized: '三十パーセントオフです。', reading: ['パーセント'] },
  { id: 'g11', category: 'UNIT', text: '2.5kgのお米を買いました。', normalized: '二点五キログラムのお米を買いました。', reading: ['ニテンゴキログラム'] },
  { id: 'g12', category: 'UNIT', text: '気温は-3℃です。', normalized: '気温はマイナス三度です。', reading: ['マイナスサンド'] },
  { id: 'g13', category: 'COUNTER', text: 'りんごを3個ください。', normalized: 'りんごを三個ください。', reading: ['サンコ'] },
  { id: 'g14', category: 'NUMBER', text: '1,200円です。', normalized: '千二百円です。', reading: ['センニヒャクエン'] },
  { id: 'g15', category: 'COUNTER', text: '1人で行きます。', normalized: 'ひとりで行きます。', reading: ['ヒトリデ'] },
  { id: 'g16', category: 'COUNTER', text: '2人で映画を見ました。', normalized: 'ふたりで映画を見ました。', reading: ['フタリデ'] },
  { id: 'g17', category: 'COUNTER', text: '1日中寝ていました。', normalized: '一日中寝ていました。', reading: ['イチニチジュー'] },
  { id: 'g18', category: 'COUNTER', text: '1日に3回飲みます。', normalized: 'いちにちに三回飲みます。', reading: ['イチニチニサンカイ'] },
  { id: 'g19', category: 'COUNTER', text: '20歳になりました。', normalized: 'はたちになりました。', reading: ['ハタチ'] },
  { id: 'g20', category: 'NUMBER', text: '12,345人が参加しました。', normalized: '一万二千三百四十五人が参加しました。', reading: ['イチマンニセンサンビャクヨンジューゴニン'] },
  { id: 'g21', category: 'CURRENCY', text: '¥1,500と$20です。', normalized: '千五百円と二十ドルです。', reading: ['センゴヒャクエン', 'ニジュードル'] },
  { id: 'g22', category: 'SYMBOL', text: '3〜5人で行きます。', normalized: '三から五人で行きます。', reading: ['サンカラゴニン'] },
  { id: 'g23', category: 'ABBREVIATION', text: 'OKです！JRで行きます。', normalized: 'オーケーです！ジェイアールで行きます。', reading: ['オーケー', 'ジェイアール'] },
  { id: 'g24', category: 'ABBREVIATION', text: 'N5の試験は7月です。', normalized: 'エヌゴの試験は七月です。', reading: ['エヌゴ', 'シチガツ'] },
  { id: 'g25', category: 'SYMBOL', text: 'すご〜い!!', normalized: 'すごーい！', reading: ['スゴーイ'] },
  { id: 'g26', category: 'SYMBOL', text: 'こんにちは😊 元気？', normalized: 'こんにちは、元気？', reading: ['ゲンキ'] },
  { id: 'g27', category: 'SYMBOL', text: 'そうですね…分かりました。', normalized: 'そうですね、分かりました。', reading: ['ワカリマシタ'] },
  { id: 'g28', category: 'NUMBER', text: '１２３ページを開いて。', normalized: '百二十三ページを開いて。', reading: ['ヒャクニジューサンページ'] },
]
