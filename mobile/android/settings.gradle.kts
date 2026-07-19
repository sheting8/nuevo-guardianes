pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    // Declared (apply false) so the version is resolved and cached, but NOT
    // applied anywhere yet: the google-services plugin throws a hard
    // GradleException at configuration time if android/app/google-services.json
    // doesn't exist, and that file isn't in this repo yet (no real Firebase
    // project). Once you add the real google-services.json under
    // android/app/, add this one line to the `plugins { ... }` block in
    // android/app/build.gradle.kts to finish wiring it up:
    //   id("com.google.gms.google-services")
    id("com.google.gms.google-services") version "4.4.2" apply false
}

include(":app")
