# Offline Reminder

Offline Android reminder app using Expo SDK 57, React Native, AsyncStorage, and native Android alarms. Existing mint/teal styling and light layout are preserved; dark backgrounds are pure black.

## Run

Use Node LTS, Bun, Android SDK 36, and JDK 21. Android Studio's installed JDK 25 caused CMake configuration failures here, so builds were verified with JDK 21.

```powershell
bun install
bun run test
bun run typecheck
bunx expo prebuild --platform android --no-install
bun run android
```

The postinstall script applies a guarded, idempotent Expo compatibility fix: `RawPropsParser(bool)` becomes `RawPropsParser()`. The parser itself remains supported by React Native 0.86. This patch should be removed when Expo incorporates it upstream. Run `node scripts/fix-expo-props.cjs` manually if installation scripts are disabled.

`plugins/withReminderNative.cjs` recreates the native scheduler, audio provider, pickers, registration, permissions and instrumentation tests during prebuild. Keep `native/` and `plugins/` in source control. Changes do not require renaming the package identifier or storage keys, which preserves installed app data. Expo Go cannot run this Android native module; rebuild the app.

## Implementation

- Inputs and shared controls are defined outside `App` in `src/components.jsx`. They retain component identity while typing, fixing keyboard dismissal at its root.
- Home and Calendar use FlatList with bounded rendering batches and no scrolling loading indicator. Deferred search, memoized derived data/cards and unchanged-record storage caching avoid unnecessary work.
- The unused NativeWind CSS watcher is removed from Metro. All screens already use native style objects; their styles are unchanged. This also avoids repeated development bundle requests stalling in the CSS pipeline.
- Storage migrates the legacy reminder array on the next save. Individual records are written only when changed, with a published ID index and serialized writes. Old records are removed after migration succeeds. Settings writes are serialized as well. Android's AsyncStorage database limit is raised from its 6 MB default to 128 MB for larger reminder libraries.
- Recurring series keep one ID and a list of completed occurrence dates. Shared date rules drive Calendar, Upcoming and Missed. Recurring misses are limited to today's applicable occurrence; overdue one-time reminders stay missed. The Completed tab displays the latest completed occurrence of each series.
- Creation offers date/time pickers on Android, selected weekdays, monthly day numbers, and optional recurrence end dates. Shorter months skip nonexistent days; leap-day yearly reminders skip non-leap years. Custom interval recurrence was not present in the original app and has not been added.
- Calendar has correctly aligned weekdays, month/year navigation, date markers, date-specific reminders, and creation from the selected date.
- Settings switches use stable native animated controls with immediate state updates. Banner dismissal lasts until the next foreground session, and notification permission is refreshed on foreground.
- Settings includes an offline Privacy Policy page immediately after the version. No public policy URL existed. Publish a hosted policy before store submission if required by the store.

## Android delivery and audio

ReminderEngine persists series in private SharedPreferences and uses **one** AlarmManager alarm for the earliest deadline. This avoids Android's limit on the number of alarms per app when there are thousands of reminders. All due reminders are processed off the UI thread. Next occurrences are scheduled by the receiver even when the app is closed and the user never completes an occurrence.

The scheduler uses RTC_WAKEUP with `setExactAndAllowWhileIdle` when Android permits it, and `setAndAllowWhileIdle` otherwise. Settings offers precise timing only when exact-alarm access is unavailable. Notification permission is the only runtime permission requested automatically. No battery exemption, broad storage access, or overlay access is requested. Exact-alarm access remains optional, but is needed for reliable background looping audio on Android 12+, because user-requested exact alarms are exempt from background foreground-service start restrictions.

Boot, app updates, wall-clock changes, time-zone changes and exact-alarm grants rebuild deadlines. Foreground reconciliation restores the global alarm, and old Expo reminder schedules are cancelled during migration. Native completion actions are persisted and acknowledged only after JS stores the resulting completion. Editing updates the schedule without dismissing an already delivered notification. Completion and deletion explicitly cancel the notification and stop its audio. A last-delivered date prevents the same series occurrence from being delivered twice, including after clock changes.

Schedules follow the device's local time zone. `java.time` resolves a DST gap forward to the next valid local time and chooses the earlier offset in an overlap. Android desugaring preserves support for the project's existing API 24 minimum.

Exact access does not guarantee exact delivery: device power management, Doze quotas, disabled or silent notification channels, DND, permission revocation and force stopping can still delay or prevent delivery. A force-stopped app must be reopened. Inexact fallback can be delayed substantially. See [Android alarm documentation](https://developer.android.com/develop/background-work/services/alarms).

Audio import uses the system document picker, not broad storage permissions. MP3, WAV, M4A, AAC, OGG and FLAC files up to 20 MB are copied into app-private storage and checked by Android's decoder. The common sound picker offers Reminder, Gentle chime, Bright bell, and imported audio in compact waveform rows. One selection applies to all reminders, including existing records. Preview is released on close/background and stops after 15 seconds. Each imported sound has its own notification channel and a narrowly scoped FileProvider URI. Removing the selected sound restores the common bundled default, then deletes the file and channel. Missing audio falls back to the bundled sound during delivery and shows an actionable error during preview. Android users can override channel sound settings.

Notifications use `setAutoCancel(false)`, an explicit Clear action and a dismissal receiver. Viewing or opening a notification keeps it visible. The mediaPlayback foreground service loops one shared player while any delivered reminder remains uncleared. Mark complete, swipe/dismiss, Clear, or deleting that reminder stops its participation; the player is released when none remain. A small playback notification offers Clear ringing reminders. The service runs only during ringing and holds a partial wake lock only for playback. DND, muted/disabled channels and notification denial are respected at delivery. If Android rejects a service start from an approximate alarm, delivery falls back to ordinary notification audio. See [Android foreground service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start). OS force-stop and process termination can stop audio; no app can override those controls.

Long-press a reminder in Home or Calendar to select it, then tap more rows and Delete selected. Delete all and selected deletion always confirm the exact count. Completing a reminder is immediate; legacy sound/confirmation/retention switches are normalized to predefined behavior while preserving theme and sound selection.

These scheduling and audio enhancements target **Android**. The iOS Expo path retains scheduling the next occurrence after completion; it does not provide the new closed-app native recurrence engine, imported-sound preview or Android settings controls. iOS requires its own native implementation and device QA before feature parity can be claimed.

## Backups

Export offers Share and Download to Device. Android download uses the system folder picker and Storage Access Framework without broad storage permissions; import uses the existing file picker. JSON schema version 2 is the single import/export format. Legacy version-1 Reminder Pro JSON backups remain accepted. The entire file is validated before any reminders are changed; unsupported versions, malformed dates/rules and duplicate IDs fail with a useful message. Import merges reminders and skips existing IDs or matching reminder content. Recurrence rules and completed dates are retained. Device-specific notification IDs and audio paths are excluded.

Imported audio bytes are not included in a backup. Imported reminder sound references are superseded by the current device’s common sound selection. Import the original audio files again on a new device. Uninstalling or clearing app storage deletes local data, subject to the device's own backup/restore settings.

## Verification

`node --test tests/reminders.test.cjs` passes twelve tests, including storage-read failures, recurrence boundaries, leap years, short months, missed-task rules, backup validation, 10,000-record date filtering and incremental persistence across 2,000 records. TypeScript checks the existing configured TypeScript files; it does not fully typecheck the JS application. Metro generated the Android development bundle successfully.

Both the debug app and native instrumentation test APK compile successfully. `native/tests/ReminderInstrumentation.kt` contains native monthly/DST checks and a timing probe for a separate validation installation. On Android 16, the isolated validation APKs installed successfully and native monthly/DST gap/overlap checks passed. The notification persistence/audio smoke test is available with -e mode persistent, but was not run because the device rejects ADB runtime-permission grants and the validation app still needs notification permission enabled by the user. Interactive UI, closed-app audio, swipe dismissal and file-provider download checks remain device QA.

Build an isolated test installation to protect existing reminder data:

```powershell
cd android
./gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a -PofflineReminderValidation=true
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w com.buggerspot.reminderoffline.validation.test/com.buggerspot.reminderoffline.ReminderInstrumentation
```

The validation app ID ends in `.validation`. Omitting the property builds the normal app. Connect Metro with `adb reverse tcp:8081 tcp:8081` (or the server's chosen port). The timing probe uses `-e mode alarm`, schedules 30 seconds ahead and reports the target timestamp and exact access; compare the actual notification post time in `dumpsys notification`. Enable notification permission in the validation app before running it. Do not run the timing probe against an app containing real reminders; the test enforces the validation ID.

Outstanding physical-device QA: uninterrupted multiword typing in every input; month/year navigation and calendar creation; daily/selected-weekday/monthly recurrence while locked and closed; edit/cancel/completion without duplicates; sound import/preview/removal/restart and picker cancellation; several thousand reminders during scrolling/search; banner denial/dismiss/foreground/grant; rapid switches and theme restart; JSON duplicate/malformed/round-trip cases; reboot/time-zone/DST restoration; exact-access denial and measured timing under battery restrictions. Release signing, public policy hosting and the placeholder EAS/project identifiers also remain deployment work.
