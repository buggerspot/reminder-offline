import React, { useEffect, useRef, useState } from "react";
import { Linking, NativeModules, Platform, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Btn, Card, PaletteContext } from "./components";
import { nextPermissionStep, PERMISSION_ONBOARDING_KEY } from "./lib/permission-onboarding";

export function PermissionOnboarding({ onNotificationChange, onActiveChange }) {
  const palette = React.useContext(PaletteContext);
  const [step, setStep] = useState(null);
  const [ready, setReady] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const resolveStep = async stage => {
    if (!["android", "ios"].includes(Platform.OS)) return { step: "done", canAskAgain: false };
    const permissions = await Notifications.getPermissionsAsync();
    const alarms = Platform.OS === "android" ? await NativeModules.ReminderNative?.status?.() : null;
    return {
      step: nextPermissionStep({ stage, platform: Platform.OS, api: Platform.Version, notificationsGranted: permissions.granted, exact: alarms?.exact, hasNativeAlarms: !!NativeModules.ReminderNative }),
      canAskAgain: permissions.canAskAgain !== false,
    };
  };
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const stage = await AsyncStorage.getItem(PERMISSION_ONBOARDING_KEY);
      if (stage === "done") return;
      const next = await resolveStep(stage);
      if (next.step === "done") await AsyncStorage.setItem(PERMISSION_ONBOARDING_KEY, "done");
      if (mounted.current) { setCanAskAgain(next.canAskAgain); setStep(next.step === "done" ? null : next.step); }
    })().catch(e => console.warn("Could not start permission onboarding", e)).finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { onActiveChange(!ready || !!step); return () => onActiveChange(false); }, [ready, step, onActiveChange]);

  const advance = async allow => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      // Persist before leaving the app or showing a system prompt. A restart
      // or a declined request must not trap the user in repeated onboarding.
      const stage = step === "notifications" ? "alarms" : "done";
      await AsyncStorage.setItem(PERMISSION_ONBOARDING_KEY, stage);
      if (allow && step === "notifications") {
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) onNotificationChange(true);
        else if (current.canAskAgain === false) await Linking.openSettings();
        else {
          const result = await Notifications.requestPermissionsAsync(Platform.OS === "ios" ? { ios: { allowAlert: true, allowSound: true, allowBadge: false } } : undefined);
          onNotificationChange(result.granted);
        }
      } else if (allow && step === "alarms") {
        const status = await NativeModules.ReminderNative?.status?.();
        if (Platform.OS === "android" && Number(Platform.Version) >= 31 && status?.exact === false)
          await NativeModules.ReminderNative.openSettings("alarms");
      }
      const next = await resolveStep(stage);
      if (next.step === "done") await AsyncStorage.setItem(PERMISSION_ONBOARDING_KEY, "done");
      if (mounted.current) { setStep(next.step === "done" ? null : next.step); setCanAskAgain(next.canAskAgain); }
    } catch (e) {
      if (mounted.current) setError(e.message || "Could not open permission settings. You can try again or choose Not now.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (!step) return null;
  const notifications = step === "notifications";
  return <View accessibilityViewIsModal style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#0008", justifyContent: "center", padding: 24 }}>
    <Card style={{ width: "100%", maxWidth: 460, alignSelf: "center", padding: 24 }}>
      <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 20, fontWeight: "800" }}>{notifications ? "Stay on top of your reminders" : "Enable precise reminder timing"}</Text>
      <Text style={{ color: palette.muted, fontSize: 15, lineHeight: 23, marginTop: 12 }}>
        {notifications
          ? `Offline Reminder needs notification permission to show your reminders and play their sounds when the app is closed. ${canAskAgain ? "You can allow or decline the system request." : "You can enable notifications in this app’s system settings."}`
          : "Android’s Alarms & reminders access lets Offline Reminder schedule reminders at the time you choose. On the next screen, enable Allow setting alarms and reminders, then return here. This is optional; without it, Android may delay reminders. It does not grant access to your calendar or contacts."}
      </Text>
      {!!error && <Text style={{ color: palette.danger, marginTop: 12 }}>{error}</Text>}
      <View style={{ gap: 10, marginTop: 24 }}>
        <Btn title={busy ? "Please wait…" : notifications ? canAskAgain ? "Continue" : "Open notification settings" : "Enable precise timing"} disabled={busy} onPress={() => advance(true)} />
        <Btn title="Not now" secondary disabled={busy} onPress={() => advance(false)} />
      </View>
    </Card>
  </View>;
}
