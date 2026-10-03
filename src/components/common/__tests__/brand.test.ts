import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { APP_NAME, APP_TAGLINE } from '../brand'
import { APP_LABEL } from '../../speech/sttCopy'
import { APP_UPDATE_COPY } from '../../shell/appUpdateCopy'

/**
 * task-003h — 사용자에게 보이는 앱 이름·부제가 한 값인지. 빌드 밖 자산(안드로이드 런처 이름·Capacitor appName·웹 매니페스트·
 * 연결 실패 화면)은 brand.ts 를 import 할 수 없어 값을 직접 적으므로, 파일을 읽어 같은지 확인한다.
 * 테스트는 미러(`~/.node-local/thekaiwa`, sync-local 이 android/·public/·capacitor.config.ts 를 보낸다)에서 돈다.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

test('brand: 이름·부제 값', () => {
  assert.equal(APP_NAME, 'Lingofy Japanese')
  assert.equal(APP_TAGLINE, '일본어가 자연스러워지는 AI 회화')
  assert.equal(APP_LABEL, APP_NAME, '권한 안내의 앱 이름 = 안드로이드 설정 목록 이름')
})

test('brand: 빌드 밖 자산도 같은 이름(런처·Capacitor·매니페스트·연결 실패 화면)', { skip: !existsSync(join(ROOT, 'android')) && '미러에 android/ 없음' }, () => {
  const strings = read('android/app/src/main/res/values/strings.xml')
  assert.match(strings, /<string name="app_name">Lingofy Japanese<\/string>/)
  assert.match(strings, /<string name="title_activity_main">Lingofy Japanese<\/string>/)
  assert.match(read('capacitor.config.ts'), /appName: 'Lingofy Japanese'/)
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as { name: string; short_name: string; description: string }
  assert.equal(manifest.name, APP_NAME)
  assert.equal(manifest.short_name, APP_NAME)
  assert.equal(manifest.description, APP_TAGLINE)
  const shell = read('public/app-shell/index.html')
  assert.match(shell, /<title>Lingofy Japanese<\/title>/)
  assert.ok(shell.includes(APP_TAGLINE))
  for (const f of ['android/app/src/main/res/values/strings.xml', 'capacitor.config.ts', 'public/manifest.webmanifest', 'public/app-shell/index.html']) {
    assert.doesNotMatch(read(f), /TheKaiwa|일본어교육|The<span>Kaiwa/, `${f} 에 옛 이름`)
  }
})

test('brand: 기술 식별자는 그대로(appId·딥링크 스킴 — 바꾸면 1.0.0 위에 덮어 깔리지 않는다)', { skip: !existsSync(join(ROOT, 'android')) && '미러에 android/ 없음' }, () => {
  assert.match(read('capacitor.config.ts'), /appId: 'com\.miraclepenguin\.kaiwa'/)
  const gradle = read('android/app/build.gradle')
  assert.match(gradle, /applicationId "com\.miraclepenguin\.kaiwa"/)
  assert.match(gradle, /def kaiwaVersionCode = \d+\b/)
  assert.match(gradle, /def kaiwaVersionName = "\d+\.\d+\.\d+"/)
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:scheme="thekaiwa"/)
})

test('업데이트 띠·시트·앱 버전 줄 문구에 앱 이름', () => {
  assert.equal(APP_UPDATE_COPY.recommendedTitle('1.0.1'), 'Lingofy Japanese v1.0.1')
  assert.equal(APP_UPDATE_COPY.forcedTitle, 'Lingofy Japanese를 업데이트해 주세요')
  assert.equal(APP_UPDATE_COPY.sheetTitle, 'Lingofy Japanese 업데이트')
  assert.equal(APP_UPDATE_COPY.versionTitle('1.0.0'), 'Lingofy Japanese v1.0.0')
  assert.equal(APP_UPDATE_COPY.versionTagline, APP_TAGLINE)
  assert.equal(APP_UPDATE_COPY.versionNew('1.0.1'), '새 버전 1.0.1 ›')
})
