# Reminder Pro

An offline-first React Native reminder app starter built with Expo SDK 57, React Native, NativeWind/Tailwind CSS, AsyncStorage and local notifications. No account, backend, analytics, or personal information is required.

## Included

- Clean home dashboard, reminder list, search, calendar month view, detail sheet and settings
- Create/edit/delete reminders with title, description, date and time validation
- Daily, weekly, monthly and yearly repeat options; recurring occurrences are recreated when the current occurrence is completed
- Local notification scheduling with Android notification channel and notification action category
- Mark-complete action on supported notification surfaces; tapping notification opens the app
- Light/dark theme setting, sound toggle, keep reminder data after notification dismissal preference, completion confirmation
- JSON backup/restore and CSV export/import using the system share sheet/document picker
- Device-local persistence through AsyncStorage; no login or server
- App configuration for Android/iOS identifiers, notification plugin, sound asset and permissions

## Requirements

- Node.js LTS supported by Expo SDK 57
- Android Studio / Android SDK for Android native builds
- macOS + Xcode for local iOS builds, or EAS Build

## Install and run

```bash
npm install
npx expo install --check
npx expo start
```

For notification actions and final notification behavior, use a development build / native build rather than relying on Expo Go:

```bash
npx expo prebuild
npx expo run:android
# On macOS:
npx expo run:ios
```

Before publishing, replace `com.yourcompany.reminderpro` and `REPLACE_WITH_YOUR_EAS_PROJECT_ID` with your own unique identifiers. Then configure EAS Build and create signed release builds.

## Important platform notes

1. **Notification persistence is OS-controlled.** The app includes an action category with “Mark complete” and “Open reminder”, but exact button visibility varies by Android manufacturer, OS version, lock-screen state, and iOS notification presentation. Expo's cross-platform API cannot guarantee a permanently ongoing, non-dismissible notification. A user swipe or “Clear all” can dismiss the notification surface; the reminder record remains in the app unless completed/deleted there.
2. **Notification actions are best-effort across app states.** The included response listener handles action taps when the app receives the response. For production-grade background action processing, add and test a native background task / task manager integration on real devices, and reconcile notification responses on app launch. Do not assume Expo Go accurately represents production native behavior.
3. **Exact alarm delivery is not guaranteed.** Android 12+ exact-alarm access, Android 13+ notification permission, battery optimization, focus modes, and vendor power management can delay or block notifications. Add an onboarding permission explanation and test the Play policy requirements for exact alarms before requesting special access.
4. **No app can keep private data after uninstall or clear-storage.** AsyncStorage is app-private and normally survives clearing cache, but Android “Clear storage/data”, uninstall/reinstall, and device loss can remove it. Export JSON before migration. Importing a backup restores records and schedules future reminders again.
5. **Sound asset behavior.** `assets/sounds/reminder.wav` is bundled in the app and configured in `app.json`, so it is not dependent on a user-managed download. Android notification sound behavior is tied to the notification channel; after channel creation, Android may require users to change sound through system settings. iOS sound files must satisfy Apple notification sound format/duration constraints. Test the bundled sound on physical devices.
6. **CSV is for portability; JSON is the full-fidelity backup.** JSON preserves all reminder fields and repeat settings. CSV is intended for spreadsheets and basic import/export. Test round trips with non-English text and commas/quotes before production release.
7. **App store compliance.** Publish a privacy policy accurately describing local storage and any future analytics; request notification permission contextually; use your own icons/screenshots; verify current Google Play exact-alarm and target API policies; complete Data safety and App Privacy forms truthfully; use a unique application ID, signing key, and release build; test accessibility, tablet layouts, TalkBack/VoiceOver, timezone changes, daylight saving time, reboot behavior, and OS upgrades.

## Data design

Reminder records are JSON objects stored under a versioned AsyncStorage key. There is no account or remote database. For larger datasets or stronger transactional guarantees, consider SQLite with migrations; for this starter, AsyncStorage keeps the project simple.

## Current scope / production TODO

- Replace date/time text inputs with native date/time pickers if desired; inputs currently validate ISO date and 24-hour time.
- Add robust background notification-action processing and startup reconciliation for scheduled IDs.
- Add automated tests (date validation, recurrence rules, CSV parser, import validation), error reporting that respects privacy, and Android/iOS physical-device QA.
- Add timezone-aware recurrence semantics and DST tests for birthdays / all-day events.
- Add an optional in-app onboarding screen explaining notification permissions and backup limitations.
