---
task_id: task-052
role: qa (레인 E — APK 빌드·Manifest·네이티브 단위 시험)
tags:
  - type/task-record
  - domain/native
---
# task-052 QA 레인 E 기록 — APK·Manifest·네이티브 단위 시험

> 대상 커밋 `51d1b33`(전체 해시 `51d1b33ce25ed05f3bd7c6686a0eae201add913c`). 서버·DB·포트 사용 없음. 이력서 본문은 수정하지 않는다.

## 체크포인트 0 — 사전 점검 (build-apk.sh 실행 전)
- 격리: `git archive 51d1b33` → `~/.node-local/thekaiwa-qa052e`(신규, 실행 전 없었음). APK 작업 디렉터리 = `~/.node-local/thekaiwa-apk-052qa-e`(신규 전용). dev-N 의 `thekaiwa-apk-052n`·운영 `thekaiwa-apk`·다른 레인 폴더는 읽기 외 접근 없음.
- `scripts/build-apk.sh`(197줄) 전체 읽음. 인자 없이 실행 → `--publish`·`--test` 분기 미실행. **쓰기 대상 목록** (모두 `$WORK`=`THEKAIWA_APK_WORK` 아래):
  - `$WORK/android/`(rsync --delete, 그 안에 `local.properties`·cap sync 생성물·gradle `build/`·`.gradle/`) · `$WORK/plugins/` · `$WORK/public/app-shell/` · `$WORK/capacitor.config.ts` · `$WORK/package.json`·`.npmrc`·`.pkg-hash`·`node_modules/`·`package-lock.json` · `$WORK/.cache/`(AAR) · `$WORK/logs/` · `$WORK/out/`
  - 스크립트에 `$WORK` 밖을 쓰는 줄 없음. `--publish` 분기만 `$PROJECT_ROOT/.env` 읽기 + `DATA_ROOT/releases` 쓰기 — **실행 안 함**.
  - 도구가 암묵적으로 쓰는 공용 캐시(스크립트 줄 아님): `~/.npm`(npm 캐시)·`~/.gradle`(현재 6.2G, 의존성 캐시)·`~/.android`(adb 등). 서명 키 `~/.android/debug.keystore` 는 **읽기 전용**(존재: 예, 2618바이트, `KAIWA_KEYSTORE` 미설정 → 기본 경로). 내용·비밀번호 출력·기록 안 함.
  - 네트워크: npm 레지스트리·Maven/Gradle 저장소. sherpa-onnx AAR 은 기존 캐시(`~/.node-local/thekaiwa-apk/.cache/`)에서 **복사(읽기)** 해 sha256 고정 검사를 스크립트가 다시 수행하게 함(GitHub 재다운로드 회피).
  - DATA_ROOT·`/app/download/`·`AppRelease`(DB)·3010·3002·3070대 포트: 접근 없음.
- 환경: `adb devices` → 연결 기기 **0대**(`List of devices attached` 뒤 빈 줄). adb 데몬은 내가 띄웠음 → 종료 예정. 동시 실행 중인 gradle/claude 프로세스: VS Code 확장의 gradle-server 만(무관).
- 남은 일: E-1(빌드·APK 검사) · E-2(JUnit·소스 정적 확인) · 정리
- 다음 첫 명령: `THEKAIWA_APK_WORK=~/.node-local/thekaiwa-apk-052qa-e bash ~/.node-local/thekaiwa-qa052e/scripts/build-apk.sh` (백그라운드, 로그 파일)

## 체크포인트 1 — E-2 소스 정적 확인 (추출본 `~/.node-local/thekaiwa-qa052e`, 커밋 51d1b33)
- 완료(판정 PASS, 근거 = `cat -n`/`grep -n` 원문):
  - ① 순서: `MainActivity.java` L71 `registerPlugin(SharedTextPlugin.class)` → L72 `takeShare(getIntent(), savedInstanceState != null)` → L73 `super.onCreate(savedInstanceState)`. onNewIntent 도 L83 `takeShare` → L84 `super.onNewIntent`(다른 플러그인에 넘기기 전에 비움).
  - ② 지움: L64-66 `SHARE_BODY_EXTRAS = {EXTRA_TEXT, EXTRA_HTML_TEXT, EXTRA_SUBJECT, EXTRA_TITLE}` → `forgetShare` L113-123 가 L115-117 `removeExtra` 반복 + L118 `setClipData(null)` + L119 「처리함」 extra. `takeShare` 의 `finally`(L108-110)에서 어떤 경로든 호출(early return·예외 포함).
  - ③ `grep -n -E "Log\.|System\.out|System\.err|printStackTrace|SharedPreferences|getSharedPreferences|FileOutputStream|FileWriter|openFileOutput|Files\.write|PrintWriter|getExternalFilesDir|getFilesDir|getCacheDir|Timber"` (MainActivity·SharedTextHolder·SharedTextPlugin) → **코드 0건**. 히트 1건은 `SharedTextHolder.java:8` 주석 문장(「디스크·SharedPreferences·로그에 쓰지 않는다」)뿐. `Shared` 는 `toString` 미정의(L26-35).
  - ④ `SharedTextPlugin.java`: `grep reject|.error(|unavailable|throw` → 코드 0건(L22 주석만). `call.resolve` 2곳(L34 peek, L45 consume)뿐 — 값 없으면 `{}` resolve.
  - ⑤ `SharedTextHolder.java` L19 `MAX_CODE_POINTS = 10_000`, L20 `TTL_MS = 30L*60L*1000L`(=1,800,000ms). 초과 시 L52-55 코드포인트 단위로 자름(`offsetByCodePoints`), 만료·역행 시계(age<0) 모두 L90 에서 폐기.
- 소스 Manifest diff(`git diff df9df75 51d1b33 -- AndroidManifest.xml`): **+11줄 = 주석 + intent-filter 1개(SEND + DEFAULT + `mimeType="text/plain"`)** 외 변경 없음. `uses-permission` 2개(INTERNET·RECORD_AUDIO) → 2개, `android:exported` 2곳(activity true·provider false) → 2곳(불변). `android/` 전체 변경 7파일(build.gradle 4줄 = versionCode 3→4/1.0.2→1.0.3, Manifest, MainActivity, Holder, Plugin, JUnit, package.json 은 test 스크립트의 seed-build 경로 1줄 — 네이티브 무관).
- `adb devices` → 연결 기기 0대(빈 목록). 따라서 인텐트 수신 자체는 **NOT_VERIFIED**(사용자 실기기).
- 발견(결함 후보, 기존 사항): `git ls-files -s android/gradlew` = `100644`(git 에는 비실행 모드, task-003f `eea1763` 부터). NFS 작업 트리는 755(`core.fileMode=false`). 그래서 `git archive 51d1b33` 추출본에서 `build-apk.sh` 첫 실행이 `./gradlew: Permission denied` rc=126 으로 실패(로그 `logs/gradle-20261011-105601.log`). 추출본의 gradlew 에만 `chmod +x`(내용은 NFS 와 `cmp` 동일) 후 스크립트는 수정 없이 재실행. deployer 는 NFS 작업 트리에서 돌리므로 배포를 막지는 않으나 깨끗한 clone/archive 에서는 재현됨.
- 남은 일: 빌드 결과 E-1(badging·xmltree·dex·unzip -l) · E-2 JUnit 재현 · 정리
- 다음 첫 명령: `tail ~/.node-local/thekaiwa-apk-052qa-e/logs/gradle-*.log` → 빌드 rc 확인
- 주의점: 띄운 프로세스 = adb 데몬(종료 예정)·build-apk(백그라운드 PID 파일 scratchpad `qa052e-build.pid`). 만든 폴더 = `~/.node-local/thekaiwa-qa052e`·`~/.node-local/thekaiwa-apk-052qa-e`.

## 체크포인트 2 — E-1 빌드·APK 검사 (1차: 51d1b33 산출물)
- 빌드: 2회차(gradlew 모드 보정 후) `THEKAIWA_APK_WORK=~/.node-local/thekaiwa-apk-052qa-e bash ~/.node-local/thekaiwa-qa052e/scripts/build-apk.sh`(인자 없음, `--publish` 아님) → `BUILD SUCCESSFUL in 28s`, 스크립트가 마지막 줄 `debuggable : no` 까지 출력하고 끝남(백그라운드 실행이라 종료 코드를 직접 캡처하지는 못함 — `set -euo pipefail` 이므로 끝까지 도달 = rc=0 근거). 산출: `~/.node-local/thekaiwa-apk-052qa-e/out/thekaiwa-1.0.3-4.apk` · 35,216,161 bytes · sha256 `ec05330b4d12c2badf930142eca51bfd5b737499ee4660f5a5b99083ec58c9b1`(dev-N 의 `f7e04e6d…` 와 다름 = dev-N 은 REV-181 반영 전 코드). 서명 SHA-256 `a4c23dca…9e47`(dev-N 빌드와 동일 서명자, 공개 지문), `apksigner verify` → Verifies / v2 true / signers 1. 서명 키는 `~/.android/debug.keystore` 읽기만(내용 미출력).
- `aapt2 dump badging`: `package: name='com.miraclepenguin.kaiwa' versionCode='4' versionName='1.0.3'`, label 'Lingofy Japanese', targetSdk 35, `application-debuggable` **0건**, `native-code: 'arm64-v8a'`. → **PASS**
- 병합 Manifest(`aapt2 dump xmltree --file AndroidManifest.xml`, 117줄) `MainActivity`(exported=true, launchMode=2 singleTask) intent-filter **3개**:
  1. `MAIN` + `LAUNCHER`
  2. `VIEW` + `DEFAULT` + `BROWSABLE` + data `thekaiwa://auth/callback` (scheme=thekaiwa host=auth path=/callback)
  3. `android.intent.action.SEND` + `android.intent.category.DEFAULT` + `mimeType="text/plain"` ← **정확히 1개**
  `SEND_MULTIPLE` **0건**. 기존 필터 2개 그대로. → **PASS**
- 병합 Manifest 의 다른 구성요소: provider FileProvider(exported=false) · BrowserControllerActivity(exported=false) · InitializationProvider(exported=false) · ProfileInstallReceiver(exported=**true**, `android.permission.DUMP` 보호 — androidx 라이브러리 기본). uses-permission 4개 = INTERNET · RECORD_AUDIO · ACCESS_NETWORK_STATE(Capacitor) · DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION(androidx 자체 서명 권한). 이 4개/exported 구성이 직전 릴리스와 같은지는 df9df75 빌드와의 1:1 비교로 확정(체크포인트 3).
- dex(`apkanalyzer dex packages --defined-only`): `SharedTextHolder`·`SharedTextHolder$Clock`·`SharedTextHolder$Shared`·`SharedTextPlugin`(+람다 1) 존재. `SharedTextPlugin` 메서드 `peek`·`consume`·`notifyArrived`, `MainActivity` 메서드 `takeShare`·`forgetShare`·`notifyShareArrived` 이름 그대로(`minifyEnabled false`·`shrinkResources false`). `javap -v` 컴파일 클래스에 `@CapacitorPlugin(name="SharedText")` + `@PluginMethod`(peek·consume) RuntimeVisibleAnnotations 확인. dex 문자열에 `android.intent.extra.{TEXT,HTML_TEXT,SUBJECT,TITLE}`·`SHARE_HANDLED` 존재(= REV-181 L-1 반영분이 이 APK 에 들어 있음). → **PASS**
- `unzip -l`: 452 entries · `classes.dex` 1개 · 민감 패턴(`.env|.pem|.key|.jks|.keystore|credential|secret|node_modules|.git|.npmrc|.map|.ts|.tsx|package.json|prisma|.sql|.p12|google-services`) **0건**. assets = `capacitor.config.json`·`capacitor.plugins.json`·`native-bridge.js`·`public/{cordova.js,cordova_plugins.js,index.html}`·`dexopt/baseline.prof(m)` 뿐. `capacitor.plugins.json` 에 SharedText 는 없음(MainActivity.registerPlugin 로 등록 — 정상, dev-N 기록과 일치). → **PASS**
- 남은 일: df9df75 APK 병합 Manifest 1:1 비교(진행 중, `~/.node-local/thekaiwa-apk-052qa-e-prev`) · E-2 `:app:testReleaseUnitTest` · 정리
- 주의점: AAR(50,129,134 bytes)을 `~/.node-local/thekaiwa-apk/.cache/`(운영 작업 디렉터리)에서 **읽어 복사**했다(수정·삭제 없음, sha256 `633c2432…bd96` = 스크립트 고정값과 일치) — "운영 작업 디렉터리 접근 금지" 문구의 엄격한 해석에 걸릴 수 있어 보고에 명시. 이후 prev 빌드는 내 폴더의 AAR 사본을 사용.
- 미정리: `~/.node-local/thekaiwa-qa052e` · `~/.node-local/thekaiwa-apk-052qa-e` · `~/.node-local/thekaiwa-qa052e-prev` · `~/.node-local/thekaiwa-apk-052qa-e-prev` · scratchpad 임시 파일 · adb 데몬

## 체크포인트 3 — E-1 직전 릴리스 1:1 비교 + E-2 JUnit (레인 E 완료)
- 직전 릴리스 비교: `git archive df9df75`(versionCode 3 / 1.0.2, gradlew 만 chmod +x)를 별도 폴더에서 같은 스크립트·인자 없음으로 빌드 → `thekaiwa-1.0.2-3.apk` 35,216,073 bytes, 서명자 동일(`a4c23dca…`). 두 APK 의 `aapt2 dump xmltree` 병합 Manifest `diff`(줄 번호 정규화) 결과 = **versionCode 3→4 · versionName 1.0.2→1.0.3 · `MainActivity` 에 intent-filter 1개(`SEND`+`DEFAULT`+`text/plain`) 추가** 3군데뿐. 집계 old→new: uses-permission 4→4 · permission 1→1 · activity 2→2 · service 0→0 · receiver 1→1 · provider 2→2 · intent-filter 6→7 · exported=true 2→2 · exported=false 3→3. 권한 이름 4개 동일(INTERNET·RECORD_AUDIO·ACCESS_NETWORK_STATE·DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION). → **새로 늘어난 권한 0, 새 exported 구성요소 0 — PASS**
- E-2 JUnit: 추출본의 작업 디렉터리에서 `./gradlew :app:testReleaseUnitTest --no-daemon -PsherpaOnnxAar=…` → `BUILD SUCCESSFUL in 7s`, rc=0. 결과 XML: `SharedTextHolderTest tests="12" skipped="0" failures="0" errors="0"`(+ Capacitor 템플릿 `ExampleUnitTest` 1개 통과). 소스의 `@Test` 12개 = testcase 12개, `@Ignore`/`Assume` 0. 시험 이름: cap_overLimit_truncatedToFirstCodePoints · cap_exactLimit_notTruncated · cap_countsCodePoints_neverSplitsSurrogatePair · ttl_keepsUntil30Minutes_thenExpires · ttl_expiredTake_isNull_andClockGoingBackIsExpired · take_returnsOnce_thenEmpty · put_replacesPrevious · emptyNullOrBlank_isKeptAsEmptyShare_once · textWithSurroundingSpaces_isKeptAsIs · shared_toString_doesNotLeakText · isFreshTextShare · isPlainText. system-out/err 비어 있음(본문 출력 없음). dev-N 기록(12 tests, 0 failures)과 재현 일치. → **PASS**
- 시험 범위의 한계(결함 아님): JUnit 은 순수 Java 보관함(`SharedTextHolder`)만 덮는다. `MainActivity.takeShare/forgetShare/onNewIntent` 의 분기(저장 상태 복구·최근 앱 재진입 시 무시, extras 삭제, 「처리함」 표시)는 Android 런타임이 필요해 JVM 시험이 없고 **소스 정독 + dex 존재 확인**까지만 했다. → 인텐트 수신·실제 extras 삭제·`registerPlugin` 앞 등록이 브리지에서 실제로 동작하는지는 **NOT_VERIFIED(사용자 실기기)**. `adb devices` 0대.
- [결함 #1] [Low] `android/gradlew` (git 모드 100644, task-003f `eea1763` 부터) / `git ls-files -s android/gradlew` → `100644 …` · `git archive 51d1b33 | tar -x -C <dir>; THEKAIWA_APK_WORK=<work> bash <dir>/scripts/build-apk.sh` / 실제: `scripts/build-apk.sh: line 137: ./gradlew: Permission denied`, 스크립트 rc=126 (로그 `gradle-20261011-105601.log`) / 기대: 깨끗한 checkout 에서도 빌드 / 원인 추정: NFS 작업 트리는 755 이지만 `core.fileMode=false` 라 git 에는 644 로 들어갔다. rsync -a 가 모드를 보존하므로 NFS 트리에서 도는 deployer 경로는 영향 없음 — 새 clone·CI·다른 머신에서만 재현. task-052 가 만든 문제가 아님(기존). 수정은 Developer 소관(`git update-index --chmod=+x android/gradlew` 또는 build-apk.sh 에서 `bash ./gradlew`).
- 판정 요약: E-1 **PASS** · E-2 **PASS**(JUnit·소스 정적) · 인텐트 수신 실동작 **NOT_VERIFIED**. Critical/High 0, Low 1(기존).
- 실기기 필요(사용자): 카톡 「공유」 목록에 Lingofy Japanese 노출 · 콜드/웜 두 경로에서 붙여넣기 화면 채움 · SEND_MULTIPLE(사진 여러 장)·이미지 공유 목록에 안 나오는지 · 최근 앱에서 다시 열 때 예전 공유가 되살아나지 않는지 · 공유 후 뒤로 가기/재진입 시 본문 재노출 없음 · 로그인 왕복(Custom Tab) 중 프로세스 종료 시 동작 · 카톡이 넘기는 MIME 이 정확히 `text/plain` 인지 · APK 1.0.3 덮어쓰기 설치 시 로그인 유지(서명자 `a4c23dca…` 동일 확인됨).
- 배포 인계 참고(deployer): `reinstall_required=true`(네이티브 변경, versionCode 3→4), post_deploy_checks 에 360/390/412 폭과 `/api/health` `status=ok` 포함. 이 레인은 서버·DB를 쓰지 않았으므로 AppRelease 행·`/api/app/version` 은 손대지 않았다.

## 정리 결과 (레인 E 종료)
- 산출물 정리: 폴더 4개 삭제(`~/.node-local/thekaiwa-qa052e` · `thekaiwa-apk-052qa-e`(APK 1.0.3-4 포함) · `thekaiwa-qa052e-prev` · `thekaiwa-apk-052qa-e-prev`(APK 1.0.2-3 포함)) + scratchpad `qa052e-*` 9개 삭제. 스크린샷 없음(화면 검증 해당 없음).
- 프로세스 정리: adb 데몬(5037) 종료·포트 비움 확인, gradle/build-apk 잔류 프로세스 없음(`--no-daemon`). dev 서버·DB 접속 없음.
- 건드리지 않음: `thekaiwa-apk-052n`(dev-N) · `thekaiwa-apk`(운영 작업 디렉터리 — AAR 1개 읽기 복사만) · `thekaiwa-apk-052f` · `thekaiwa-qa052c` · DATA_ROOT · `/app/download/` · AppRelease(DB). 공용 캐시 `~/.gradle`·`~/.npm` 은 의존성 캐시로 남음.
- 저장소: `git status` 에 내 변경은 이 기록 파일(untracked)뿐, `src/**`·`prisma/**`·`android/**` 수정 없음.
