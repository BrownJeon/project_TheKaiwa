// 플러그인의 순수 로직(SttSession·Audio — 소스 그대로)을 데스크톱 sherpa-onnx(JVM, 같은 1.13.8)와 실제 모델로 돌려
// stt20 20문장을 인식한다. 폰 없이 "VAD 구간 + 여유 + 0 패딩" 이 gateway 와 같은 결과를 내는지 본다(성능은 폰에서).
// 실행: bash plugins/sherpa-stt/tools/desktop-check/run.sh (NFS noexec 라 APK 작업 디렉터리에서 돈다)
plugins {
    kotlin("jvm") version "2.1.20"
    application
}
repositories { mavenCentral() }
val jars = providers.gradleProperty("sherpaJvmJars").get().split(",")
dependencies {
    implementation(files(jars))
    implementation("org.json:json:20240303")
}
kotlin { jvmToolchain(21) }
sourceSets {
    main {
        kotlin.srcDir("src/main/kotlin")
        // 플러그인 소스 중 안드로이드에 기대지 않는 두 파일만 그대로 컴파일한다.
        kotlin.srcDir("../../android/src/main/java")
        kotlin.include("Harness.kt", "**/sherpastt/Audio.kt", "**/sherpastt/SttSession.kt")
    }
}
application { mainClass.set("HarnessKt") }
