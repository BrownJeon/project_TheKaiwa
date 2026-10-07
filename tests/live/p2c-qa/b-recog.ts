/** qa-p2c-B D — 시드 상황 10개의 "바꿔 말하는" 표현 24개에 자연스러운 변형 발화를 넣어 코드 인식(detectScenarioExpressions)이 되는지 센다. LLM 0·DB 0(시드 JSON + 순수 함수). */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectScenarioExpressions, readScenarioExpressions } from '../../../src/modules/learning/scenarios/expressions'
const seeds = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/scenarios.json'), 'utf8')) as { key: string; keyExpressions: Record<string, unknown>[] }[]
const V: Record<string, string> = {
  'self-intro-first-meeting:e1': '私の名前はスミです', 'self-intro-first-meeting:e2': '学生です', 'self-intro-first-meeting:e3': '釜山に住んでいます',
  'self-intro-likes:e1': '私は映画が好きです', 'self-intro-likes:e2': 'とてもおもしろいです', 'self-intro-likes:e4': '休みの日によく料理をします',
  'cafe-order-drink:e1': 'ラテをください', 'cafe-order-drink:e3': '大きいサイズでお願いします',
  'cafe-order-takeout:e2': 'すみません、やっぱり持ち帰りに変えてもいいですか', 'cafe-order-takeout:e4': '現金でお願いします',
  'directions-station-exit:e1': 'すみません、トイレはどこですか', 'directions-station-exit:e5': '駅までここから遠いですか', 'directions-recheck:e4': '駅はどこですか',
  'weekend-plan-tell:e1': '買い物に行きます', 'weekend-plan-tell:e2': '家族と一緒に行きます', 'weekend-plan-tell:e3': 'たぶん日曜日に行きます',
  'weekend-plan-invite:e2': '日曜日は大丈夫ですか', 'weekend-plan-invite:e3': '土曜日ならいいです',
  'travel-story-tell:e1': '大阪に行ってきました', 'travel-story-tell:e3': '景色がすてきでした', 'travel-story-tell:e5': '旅館に泊まりました',
  'travel-story-recommend:e1': '景色がすばらしかったです', 'travel-story-recommend:e4': 'でも少し遠かったです', 'travel-story-recommend:e5': '夏に行くのがおすすめです',
}
let hit = 0; const miss: string[] = []; let exactOk = 0; let exactN = 0; const noMatchVar: string[] = []
for (const s of seeds) {
  const ex = readScenarioExpressions(s.keyExpressions)
  for (const e of ex) {
    exactN++; if (detectScenarioExpressions([e.textJa], ex).includes(e.id)) exactOk++
    const v = V[`${s.key}:${e.id}`]; if (!v) continue
    const ok = detectScenarioExpressions([v], ex).includes(e.id)
    if (ok) hit++; else { miss.push(`${s.key}:${e.id}「${v}」(match=${e.match ?? '없음'})`); if (!e.match) noMatchVar.push(`${s.key}:${e.id}`) }
  }
}
console.log(`정확 문구 인식 ${exactOk}/${exactN}`)
console.log(`자연 변형 인식 ${hit}/${Object.keys(V).length} · 놓침 ${miss.length}`)
for (const m of miss) console.log('  놓침: ' + m)
console.log(`놓침 중 match 없음 ${noMatchVar.length}건: ${noMatchVar.join(', ')}`)
