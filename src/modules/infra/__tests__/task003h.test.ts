import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apkDownloadName } from '../appRelease'

test('task-003h 받는 APK 파일 이름 = 제품 이름(저장 이름 thekaiwa-*.apk 와 별개), 이상한 버전 이름은 번호 없이', () => {
  assert.equal(apkDownloadName({ versionName: '1.0.1' }), 'LingofyJapanese-1.0.1.apk')
  assert.equal(apkDownloadName({ versionName: '1.0.1"; x=y' }), 'LingofyJapanese.apk', '헤더에 따옴표가 들어가지 않게')
  assert.equal(apkDownloadName({ versionName: '' }), 'LingofyJapanese.apk')
})
