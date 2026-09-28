# sherpa-onnx 의 JNI 가 설정 객체의 필드·게터를 이름으로 찾는다(GetFieldID) — 난독화·제거되면 네이티브에서 죽는다.
# 앱은 지금 minify 를 끄지만(WebView 셸), 켜는 날을 위해 규칙을 플러그인이 들고 다닌다.
-keep class com.k2fsa.sherpa.onnx.** { *; }
-keep class com.miraclepenguin.kaiwa.sherpastt.SherpaSttPlugin { *; }
