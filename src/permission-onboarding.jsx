import React, { useEffect, useRef } from "react";
import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { runPermissionOnboarding } from "./lib/permission-onboarding";

export function PermissionOnboarding({ onNotificationChange, onActiveChange }) {
  const callbacks = useRef({ onNotificationChange, onActiveChange });
  callbacks.current = { onNotificationChange, onActiveChange };
  const operation = useRef(null);
  useEffect(() => {
    let active = true;
    callbacks.current.onActiveChange(true);
    // Keep one operation across effect replays; never overlap native prompts.
    if (!operation.current) operation.current = runPermissionOnboarding({
      platform: Platform.OS,
      api: Platform.Version,
      storage: AsyncStorage,
      notifications: Notifications,
      alarms: NativeModules.ReminderNative,
    });
    operation.current.then(granted => {
      if (active && granted !== undefined) callbacks.current.onNotificationChange(granted);
    }).catch(e => console.warn("Could not request reminder permissions", e))
      .finally(() => { if (active) callbacks.current.onActiveChange(false); });
    return () => { active = false; };
  }, []);
  return null;
}
