const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withMainActivity,
  withGradleProperties,
} = require("expo/config-plugins");
module.exports = function withReminderNative(config) {
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (p) => p.key !== "AsyncStorage_db_size_in_MB",
    );
    config.modResults.push({
      type: "property",
      key: "AsyncStorage_db_size_in_MB",
      value: "128",
    });
    return config;
  });
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const java = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java/com/buggerspot/reminderoffline",
      );
      fs.mkdirSync(java, { recursive: true });
      fs.copyFileSync(
        path.join(root, "native/android/ReminderNative.kt"),
        path.join(java, "ReminderNative.kt"),
      );
      const tests = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/androidTest/java/com/buggerspot/reminderoffline",
      );
      fs.mkdirSync(tests, { recursive: true });
      fs.copyFileSync(
        path.join(root, "native/tests/ReminderInstrumentation.kt"),
        path.join(tests, "ReminderInstrumentation.kt"),
      );
      for (const [folder, name] of [
        ["xml", "reminder_sound_paths.xml"],
        ["drawable", "ic_reminder_notification.xml"],
      ]) {
        const target = path.join(
          config.modRequest.platformProjectRoot,
          "app/src/main/res",
          folder,
        );
        fs.mkdirSync(target, { recursive: true });
        fs.copyFileSync(
          path.join(root, "native/android", name),
          path.join(target, name),
        );
      }
      return config;
    },
  ]);
  config = withMainApplication(config, (config) => {
    if (!config.modResults.contents.includes("add(ReminderNativePackage())"))
      config.modResults.contents = config.modResults.contents.replace(
        "PackageList(this).packages.apply {",
        "PackageList(this).packages.apply {\n          add(ReminderNativePackage())",
      );
    return config;
  });
  config = withMainActivity(config, (config) => {
    if (!config.modResults.contents.includes("override fun onNewIntent"))
      config.modResults.contents = config.modResults.contents.replace(
        "class MainActivity : ReactActivity() {",
        "class MainActivity : ReactActivity() {\n  override fun onNewIntent(intent: android.content.Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n  }",
      );
    return config;
  });
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("offlineReminderValidation"))
      config.modResults.contents = config.modResults.contents.replace(
        "applicationId 'com.buggerspot.reminderoffline'",
        "applicationId 'com.buggerspot.reminderoffline'\n        if (findProperty('offlineReminderValidation') == 'true') applicationIdSuffix '.validation'",
      );
    if (!config.modResults.contents.includes("testInstrumentationRunner"))
      config.modResults.contents = config.modResults.contents.replace(
        "defaultConfig {",
        "defaultConfig {\n        testInstrumentationRunner 'com.buggerspot.reminderoffline.ReminderInstrumentation'",
      );
    if (!config.modResults.contents.includes("coreLibraryDesugaringEnabled")) {
      config.modResults.contents = config.modResults.contents
        .replace(
          "android {",
          "android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }",
        )
        .replace(
          "dependencies {",
          "dependencies {\n    coreLibraryDesugaring('com.android.tools:desugar_jdk_libs:2.1.5')",
        );
    }
    return config;
  });
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.service = (app.service || []).filter(
      (s) => s.$["android:name"] !== ".ReminderPlaybackService",
    );
    app.service.push({
      $: {
        "android:name": ".ReminderPlaybackService",
        "android:exported": "false",
        "android:foregroundServiceType": "mediaPlayback",
      },
    });
    app.provider = app.provider || [];
    if (
      !app.provider.some(
        (p) => p.$["android:authorities"] === "${applicationId}.remindersounds",
      )
    )
      app.provider.push({
        $: {
          "android:name": "androidx.core.content.FileProvider",
          "android:authorities": "${applicationId}.remindersounds",
          "android:exported": "false",
          "android:grantUriPermissions": "true",
        },
        "meta-data": [
          {
            $: {
              "android:name": "android.support.FILE_PROVIDER_PATHS",
              "android:resource": "@xml/reminder_sound_paths",
            },
          },
        ],
      });
    app.receiver = app.receiver || [];
    if (!app.receiver.some((r) => r.$["android:name"] === ".ReminderReceiver"))
      app.receiver.push({
        $: { "android:name": ".ReminderReceiver", "android:exported": "false" },
        "intent-filter": [
          {
            action: [
              "BOOT_COMPLETED",
              "MY_PACKAGE_REPLACED",
              "TIME_SET",
              "TIMEZONE_CHANGED",
            ]
              .map((a) => ({
                $: { "android:name": "android.intent.action." + a },
              }))
              .concat([
                {
                  $: {
                    "android:name":
                      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
                  },
                },
              ]),
          },
        ],
      });
    return config;
  });
};
