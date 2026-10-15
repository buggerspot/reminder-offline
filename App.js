import React, {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useState,
  useRef,
} from "react";
import {
  Appearance,
  AppState,
  Linking,
  NativeModules,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileUp,
  Heart,
  Home,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  configureNotifications,
  setForegroundNotificationSound,
  scheduleReminder,
  cancelReminderNotification,
  COMPLETE_ACTION,
} from "./src/lib/notifications";
import {
  loadReminders,
  saveReminders,
  loadSettings,
  saveSettings,
} from "./src/lib/storage";
import { cleanupCompleted } from "./src/lib/retention";
import { reminderCategories } from "./src/lib/categories";
import { importReminderImage } from "./src/lib/images";
import {
  completeSelectedOccurrences,
  deleteSelected,
} from "./src/lib/selection";
import {
  exportJSON,
  importReminders,
  newReminders,
} from "./src/lib/exportImport";
import {
  occursOn,
  calendarOccurrences,
  nextOccurrence,
  displayOccurrence,
  validDate,
  localDate,
} from "./src/lib/recurrence";
import { formatDate, formatTime } from "./src/lib/format";
import {
  BUILT_IN_SOUNDS,
  loadSounds,
  importSound,
  removeSound,
  previewSound,
  stopPreview,
} from "./src/lib/sounds";
import {
  AppDialog,
  SelectionToolbar,
  SelectionArea,
  SelectedDateText,
  PaletteContext,
  Card,
  Btn,
  Label,
  Field,
  Chip,
  ReminderRow,
  SettingsToggle,
  PermissionBanner,
} from "./src/components";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  TabPager,
  PremiumFlatList as FlatList,
  PremiumScrollView as ScrollView,
  ImageViewerScope,
  ZoomableImage,
} from "./src/interaction-components";
import { PermissionOnboarding } from "./src/permission-onboarding";
import { CATEGORY_NAMES, TAB_NAMES } from "./src/lib/interactions";
import {
  createReminderPresentation,
  createTabNavigation,
  createCategorySelection,
  createEditorPresentation,
  createDialogQueue,
} from "./src/lib/presentation";
import { ReminderDetails } from "./src/reminder-details";
import { MainTabBar } from "./src/main-tab-bar";
import { HomeReminders } from "./src/home-reminders";
import { ReminderEditor } from "./src/reminder-editor";
import { DialogPresenter } from "./src/dialog-presenter";
import { ReminderSounds } from "./src/reminder-sounds";
import { SettingsPage } from "./src/settings-page";
import { CalendarPage } from "./src/calendar-page";
import { useStableCallbacks } from "./src/use-stable-callbacks";
const C = {
  brand: "#0F766E",
  brand2: "#14B8A6",
  ink: "#102A2A",
  muted: "#6B7F7D",
  bg: "#F4F8F7",
  card: "#FFFFFF",
  border: "#E1EBE8",
  mint: "#D1FAE5",
  orange: "#F59E0B",
  red: "#DC5757",
  darkBg: "#000000",
  darkCard: "#141414",
  darkBorder: "#303030",
  white: "#F5F5F5",
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const timeNow = () => {
  const d = new Date(Date.now() + 5 * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function ReminderApp() {
  const [reminders, setReminders] = useState([]);
  const [settings, setSettings] = useState({
    theme: "light",
    soundEnabled: true,
    keepReminderAfterDismiss: true,
    confirmBeforeClear: false,
    haptics: true,
    defaultRepeat: "none",
  });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dataReady = useRef(false);
  const [navigation] = useState(() => createTabNavigation(TAB_NAMES));
  const setTab = useCallback((name) => navigation.navigate(name), [navigation]);
  const onTabBarLayout = useCallback(
    (e) => setTabBarHeight(e.nativeEvent.layout.height),
    [],
  );
  const [tabBarHeight, setTabBarHeight] = useState(60);
  const [categories] = useState(() => createCategorySelection(CATEGORY_NAMES));
  const [editor] = useState(createEditorPresentation);
  const [details] = useState(createReminderPresentation);
  const setDetail = useCallback((value) => details.set(value), [details]);
  const sheetRef = useRef(null);
  const pendingEditor = useRef(false);
  const showPendingEditor = useCallback(() => {
    if (!pendingEditor.current) return;
    const pending = pendingEditor.current;
    pendingEditor.current = false;
    editor.open(pending.form, pending.editing);
  }, []);
  const closeDetails = useCallback(() => {
    setDetail(null);
    if (Platform.OS !== "ios") requestAnimationFrame(showPendingEditor);
  }, [showPendingEditor]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dateChosen, setDateChosen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [clock, setClock] = useState(Date.now());
  const [permission, setPermission] = useState(true);
  const [onboardingActive, setOnboardingActive] = useState(true);
  const [alarmStatus, setAlarmStatus] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sounds, setSounds] = useState([]);
  const soundRef = useRef(sounds);
  soundRef.current = sounds;
  const [showSounds, setShowSounds] = useState(false);
  const closeSounds = useCallback(() => setShowSounds(false), []);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const handledResponse = useRef(null);
  const reminderRef = useRef(reminders);
  reminderRef.current = reminders;
  const settingsRef = useRef(settings);

  const migratedNotifications = useRef(false);
  const [dialogs] = useState(createDialogQueue);
  const Alert = useMemo(() => ({ alert: dialogs.alert }), [dialogs]);
  const clearSelection = useCallback(
    () => setSelectedIds((ids) => (ids.length ? [] : ids)),
    [],
  );
  const selectionMode = selectedIds.length > 0;
  useEffect(
    () =>
      navigation.subscribe(() =>
        setSelectedIds((ids) => (ids.length ? [] : ids)),
      ),
    [navigation],
  );
  useEffect(
    () =>
      categories.subscribe(() =>
        setSelectedIds((ids) => (ids.length ? [] : ids)),
      ),
    [categories],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedDate]);
  const isDark = settings.theme === "dark";
  const palette = useMemo(
    () =>
      isDark
        ? {
            bg: C.darkBg,
            card: C.darkCard,
            text: C.white,
            muted: "#A8A8A8",
            border: C.darkBorder,
            soft: "#202020",
            brand: "#2DD4BF",
            onBrand: "#071A18",
            danger: "#FCA5A5",
            dangerSoft: "#2B1515",
          }
        : {
            bg: C.bg,
            card: C.card,
            text: C.ink,
            muted: C.muted,
            border: C.border,
            soft: "#EAF7F3",
            brand: C.brand,
            onBrand: "#FFFFFF",
            danger: "#B91C1C",
            dangerSoft: "#FCE8E8",
          },
    [isDark],
  );
  useEffect(() => {
    // Commit palette colors before updating native window appearance.
    Appearance.setColorScheme(settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    (async () => {
      dataReady.current = false;
      const [r, s] = await Promise.all([loadReminders(), loadSettings()]);
      if (!Array.isArray(r))
        throw new Error("Stored reminder data is invalid.");
      const retained = cleanupCompleted(r);
      if (retained !== r) await saveReminders(retained);
      setReminders(retained);
      dataReady.current = true;
      settingsRef.current = s;
      setSettings(s);
      setSounds(await loadSounds());
      setPermission(await configureNotifications(s.soundEnabled));
      setLoaded(true);
    })().catch((e) => {
      console.warn(e);
      if (!dataReady.current)
        setLoadError(e.message || "Local storage is unavailable.");
      setLoaded(true);
    });
  }, [loadAttempt]);
  useEffect(() => {
    let refreshInProgress = false;
    const refresh = async () => {
      if (!loaded || !dataReady.current || refreshInProgress) return;
      refreshInProgress = true;
      try {
        setClock(Date.now());
        setPermission((await Notifications.getPermissionsAsync()).granted);
        const completed =
          await NativeModules.ReminderNative?.takeCompletions?.();
        if (completed) {
          const actions = JSON.parse(completed);
          if (actions.length) {
            const next = reminderRef.current.map((r) => {
              const dates = actions
                .filter((a) => a.id === r.id)
                .map((a) => a.date);
              return dates.length
                ? r.repeat && r.repeat !== "none"
                  ? {
                      ...r,
                      completedDateTimes: {
                        ...r.completedDateTimes,
                        ...Object.fromEntries(
                          dates.map((date) => [date, new Date().toISOString()]),
                        ),
                      },
                      completedDates: [
                        ...new Set([...(r.completedDates || []), ...dates]),
                      ],
                    }
                  : {
                      ...r,
                      completed: true,
                      completedAt: new Date().toISOString(),
                    }
                : r;
            });
            setReminders(next);
            await saveReminders(next);
            await NativeModules.ReminderNative.acknowledgeCompletions(
              completed,
            );
          }
        }
        const openId = await NativeModules.ReminderNative?.takeOpenReminder?.();
        if (openId) {
          const item = reminderRef.current.find((r) => r.id === openId);
          if (item) {
            setDetail(displayOccurrence(item) || item);
            setTab("Home");
          }
        }
        const status = await NativeModules.ReminderNative?.status?.();
        if (status) setAlarmStatus(status);
        if (NativeModules.ReminderNative)
          await NativeModules.ReminderNative.sync(
            JSON.stringify(
              reminderRef.current.map((r) => ({
                ...r,
                soundId: settingsRef.current.defaultSoundId || null,
                soundUri:
                  soundRef.current.find(
                    (s) => s.id === settingsRef.current.defaultSoundId,
                  )?.uri || null,
              })),
            ),
            true,
          );
      } finally {
        refreshInProgress = false;
      }
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setBannerDismissed(false);
        refresh().catch(console.warn);
      } else stopPreview();
    });
    const interval = setInterval(() => setClock(Date.now()), 30000);
    const focus =
      Platform.OS === "android"
        ? AppState.addEventListener("focus", () =>
            refresh().catch(console.warn),
          )
        : null;
    refresh().catch(console.warn);
    return () => {
      subscription.remove();
      focus?.remove();
      clearInterval(interval);
      stopPreview();
    };
  }, [loaded]);
  useEffect(() => {
    if (!loaded || !dataReady.current) return;
    let active = true;
    const reconcile = async () => {
      if (Platform.OS === "android" && !NativeModules.ReminderNative) return;
      if (!migratedNotifications.current) {
        const scheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        for (const request of scheduled) {
          if (request.content.data?.reminderId && Platform.OS === "android")
            await cancelReminderNotification(request.identifier);
        }
        migratedNotifications.current = true;
      }
      if (active && NativeModules.ReminderNative)
        await NativeModules.ReminderNative.sync(
          JSON.stringify(
            reminders.map((r) => ({
              ...r,
              soundId: settings.defaultSoundId || null,
              soundUri:
                sounds.find((s) => s.id === settings.defaultSoundId)?.uri ||
                null,
            })),
          ),
          true,
        );
    };
    reconcile().catch((e) => Alert.alert("Notification setup", e.message));
    return () => {
      active = false;
    };
  }, [loaded, reminders, settings.defaultSoundId, sounds]);
  useEffect(() => {
    if (!loaded || !dataReady.current) return;
    const current = reminderRef.current;
    const retained = cleanupCompleted(current, clock);
    if (retained === current) return;
    // Update the ref immediately so foreground refresh uses the same snapshot.
    reminderRef.current = retained;
    setReminders(retained);
    setSelectedIds((ids) =>
      ids.filter((id) => retained.some((r) => r.id === id)),
    );
    setDetail((item) =>
      item && !retained.some((r) => r.id === item.id) ? null : item,
    );
    saveReminders(retained).catch((e) => {
      console.warn("Completed reminder cleanup", e);
      // Retry on the next clock tick if persistence failed.
      if (reminderRef.current === retained) {
        reminderRef.current = current;
        setReminders(current);
      }
    });
  }, [loaded, clock, reminders]);
  const markComplete = useCallback(
    async (id) => {
      const current = reminders.find((x) => x.id === id);
      if (!current || current.completed) {
        sheetRef.current?.close();
        return;
      }
      await NativeModules.ReminderNative?.clearNotification?.(id);
      let updated;
      if (current.repeat && current.repeat !== "none") {
        const detail = details.getSnapshot();
        const occurrenceDate = detail?.id === id ? detail.date : todayISO();
        updated = reminders.map((r) =>
          r.id === id
            ? {
                ...r,
                completedDateTimes: {
                  ...r.completedDateTimes,
                  [occurrenceDate]: new Date().toISOString(),
                },
                completedDates: [
                  ...new Set([...(r.completedDates || []), occurrenceDate]),
                ],
              }
            : r,
        );
        if (Platform.OS !== "android") {
          await cancelReminderNotification(current.notificationId);
          const series = updated.find((r) => r.id === id);
          series.notificationId = await scheduleReminder(
            series,
            settings.soundEnabled,
          );
        }
      } else {
        await cancelReminderNotification(current.notificationId);
        updated = reminders.map((r) =>
          r.id === id
            ? {
                ...r,
                completed: true,
                completedAt: new Date().toISOString(),
              }
            : r,
        );
      }
      await saveReminders(updated);
      setReminders(updated);
      sheetRef.current?.close();
    },
    [reminders, settings.soundEnabled, details],
  );
  useEffect(() => {
    const handle = (response) => {
      if (!loaded || !response) return;
      const responseKey =
        response.notification.request.identifier +
        ":" +
        response.actionIdentifier;
      if (handledResponse.current === responseKey) return;
      handledResponse.current = responseKey;
      const data = response?.notification?.request?.content?.data;
      const id = data?.reminderId;
      if (id && response.actionIdentifier === COMPLETE_ACTION) markComplete(id);
      else if (id) {
        const r = reminders.find((x) => x.id === id);
        if (r) {
          setDetail(r);
          setTab("Home");
        }
      }
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch(() => {});
    return () => subscription.remove();
  }, [markComplete, reminders, loaded]);
  const updateSettings = async (patch) => {
    const previous = settingsRef.current;
    if (typeof patch.theme === "function")
      patch = { ...patch, theme: patch.theme(previous.theme) };
    const next = {
      ...settingsRef.current,
      ...patch,
    };
    settingsRef.current = next;
    setSettings(next);
    if ("soundEnabled" in patch)
      setForegroundNotificationSound(next.soundEnabled);
    try {
      await saveSettings(next);
    } catch (e) {
      if (settingsRef.current === next) {
        // A failed write must not undo the user's appearance selection.
        settingsRef.current = { ...previous, theme: next.theme };
        setSettings(settingsRef.current);
        setForegroundNotificationSound(previous.soundEnabled);
      }
      Alert.alert(
        "Could not save settings",
        e.message || "Check available device storage and try again.",
      );
    }
  };
  const openNew = (date = todayISO()) => {
    if (typeof date !== "string") date = todayISO();
    const form = {
      title: "",
      imageUri: null,
      description: "",
      date,
      weekdays: [new Date(`${date}T12:00:00`).getDay()],
      monthDay: new Date(`${date}T12:00:00`).getDate(),
      soundId: settings.defaultSoundId || null,
      time: timeNow(),
      repeat: settings.defaultRepeat || "none",
      repeatUntil: "",
    };
    editor.open(form);
  };
  const openEdit = (r) => {
    const form = {
      title: r.title,
      imageUri: r.imageUri || null,
      description: r.description || "",
      date: r.seriesDate || r.date,
      weekdays: r.weekdays || [
        new Date(`${r.seriesDate || r.date}T12:00:00`).getDay(),
      ],
      monthDay:
        r.monthDay || new Date(`${r.seriesDate || r.date}T12:00:00`).getDate(),
      soundId: r.soundId || null,
      time: r.time,
      repeat: r.repeat || "none",
      repeatUntil: r.repeatUntil || "",
    };
    if (details.getSnapshot() && sheetRef.current) {
      pendingEditor.current = { form, editing: r };
      sheetRef.current.close();
    } else editor.open(form, r);
  };
  const persistReminder = async (form, editing) => {
    const title = form.title.trim();

    if (editing?.notificationId)
      await cancelReminderNotification(editing.notificationId);
    const item = {
      id: editing?.id || makeId(),
      title,
      imageUri: form.imageUri || null,
      description: form.description.trim(),
      date: form.date,
      time: form.time,
      repeat: form.repeat,
      weekdays: form.weekdays,
      monthDay: Number(form.monthDay),
      soundId: settings.defaultSoundId || null,
      soundUri:
        sounds.find((s) => s.id === settings.defaultSoundId)?.uri || null,
      completedDateTimes: editing?.completedDateTimes || {},
      completedDates: editing?.completedDates || [],
      repeatUntil: form.repeatUntil,
      completed: false,
      createdAt: editing?.createdAt || new Date().toISOString(),
      notificationId: null,
    };
    item.notificationId = await scheduleReminder(item, settings.soundEnabled);
    const next = editing
      ? reminderRef.current.map((r) => (r.id === editing.id ? item : r))
      : [...reminderRef.current, item];
    await saveReminders(next);
    setReminders(next);
  };
  const deleteReminder = (r) =>
    Alert.alert(
      "Delete reminder?",
      `“${r.title}” will be removed from this device.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await NativeModules.ReminderNative?.clearNotification?.(r.id);
            await cancelReminderNotification(r.notificationId);
            const next = reminders.filter((x) => x.id !== r.id);
            await saveReminders(next);
            setReminders(next);
            sheetRef.current?.close();
          },
        },
      ],
    );
  const toggleSelection = (id) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };
  const deleteMany = (ids) =>
    Alert.alert(
      "Delete reminders?",
      `${ids.length} reminder${ids.length === 1 ? "" : "s"} will be permanently deleted from this device. This cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: `Delete ${ids.length}`,
          style: "destructive",
          onPress: async () => {
            try {
              const deletedIds = new Set(ids);
              const next = deleteSelected(
                reminderRef.current,
                deletedIds,
                navigation.getSnapshot() === "Home"
                  ? categories.getSnapshot()
                  : "Calendar",
              );
              for (const r of reminders.filter((r) => deletedIds.has(r.id))) {
                await NativeModules.ReminderNative?.clearNotification?.(r.id);
                await cancelReminderNotification(r.notificationId);
              }
              await saveReminders(next);
              setReminders(next);
              setSelectedIds([]);
            } catch (e) {
              Alert.alert("Delete failed", e.message);
            }
          },
        },
      ],
    );
  const categoryRows = useMemo(
    () => reminderCategories(reminders, new Date(clock)),
    [reminders, clock],
  );
  const completeSelected = async () => {
    const visible = categoryRows[categories.getSnapshot()];
    const rows = new Map(
      visible.filter((r) => selectedSet.has(r.id)).map((r) => [r.id, r]),
    );
    if (!rows.size) return;
    try {
      const completedAt = new Date().toISOString();
      const current = reminderRef.current;
      const updated = completeSelectedOccurrences(
        current,
        [...rows.values()],
        completedAt,
      );
      for (let i = 0; i < current.length; i++) {
        if (current[i] === updated[i]) continue;
        await NativeModules.ReminderNative?.clearNotification?.(current[i].id);
        await cancelReminderNotification(current[i].notificationId);
        updated[i].notificationId = await scheduleReminder(
          updated[i],
          settings.soundEnabled,
        );
      }
      await saveReminders(updated);
      setReminders(updated);

      setSelectedIds([]);
    } catch (e) {
      Alert.alert("Could not complete reminders", e.message);
    }
  };

  const calendarRows = useMemo(
    () => calendarOccurrences(reminders, selectedDate, clock),
    [reminders, selectedDate, clock],
  );
  useEffect(() => {
    const available = new Set(
      (navigation.getSnapshot() === "Calendar"
        ? calendarRows
        : categoryRows[categories.getSnapshot()]
      ).map((r) => r.id),
    );
    setSelectedIds((ids) =>
      ids.every((id) => available.has(id))
        ? ids
        : ids.filter((id) => available.has(id)),
    );
  }, [navigation, calendarRows, categoryRows, categories]);
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear(),
      month = calendarMonth.getMonth();
    const offset = new Date(year, month, 1).getDay();
    return Array.from(
      {
        length: offset + new Date(year, month + 1, 0).getDate(),
      },
      (_, i) =>
        i < offset ? null : localDate(new Date(year, month, i - offset + 1)),
    );
  }, [calendarMonth]);
  const calendarMarks = useMemo(
    () =>
      new Set(
        calendarDays.filter(
          (date) =>
            date &&
            reminders.some(
              (r) =>
                occursOn(r, date) && +new Date(`${date}T${r.time}:00`) >= clock,
            ),
        ),
      ),
    [calendarDays, reminders, clock],
  );
  const moveMonth = (amount) =>
    setCalendarMonth(
      (d) => new Date(d.getFullYear(), d.getMonth() + amount, 1),
    );
  const openReminder = useCallback(
    (item) => {
      details.open(item);
    },
    [details],
  );
  const onImport = async () => {
    try {
      const imported = await importReminders();
      if (!imported) return;
      const valid = newReminders(reminderRef.current, imported).map((r) => ({
        ...r,
        id: r.id || makeId(),
        notificationId: null,
        soundId: sounds.some((s) => s.id === r.soundId) ? r.soundId : null,
        soundUri: sounds.find((s) => s.id === r.soundId)?.uri || null,
      }));
      const skipped = imported.length - valid.length;
      if (!valid.length)
        return Alert.alert(
          "Nothing new to import",
          imported.length
            ? "All reminders are already imported. Nothing new to import."
            : "No reminders available to import.",
        );
      const combined = [...reminders, ...valid];
      if (Platform.OS !== "android")
        for (const r of valid)
          r.notificationId = await scheduleReminder(r, settings.soundEnabled);
      await saveReminders(combined);
      setReminders(combined);
      Alert.alert(
        "Import complete",
        `${valid.length} reminders imported. ${skipped} skipped as duplicates.`,
      );
    } catch (e) {
      Alert.alert(
        "Import failed",
        e.message || "Please select a valid JSON backup.",
      );
    }
  };
  const exportWith = async (type) => {
    if (!reminders.length)
      return Alert.alert(
        "Nothing to export",
        "No reminders available to export.",
      );
    try {
      const result = await exportJSON(reminders, type);
      if (!result || type !== "download") return;
      Alert.alert(
        "Backup exported",
        "Your JSON backup was saved successfully. Imported sound files stay on this device; import them again on a new phone.",
      );
    } catch (e) {
      Alert.alert("Export failed", e.message || "Could not export reminders.");
    }
  };

  const actions = useStableCallbacks({
    updateSettings,
    openNew,
    openEdit,
    persistReminder,
    deleteReminder,
    toggleSelection,
    deleteMany,
    completeSelected,
    moveMonth,
    onImport,
    exportWith,
    markComplete,
  });
  if (loadError)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontSize: 20,
            fontWeight: "700",
          }}
        >
          Could not read your reminders
        </Text>
        <Text
          style={{
            color: palette.muted,
            lineHeight: 22,
            marginVertical: 16,
          }}
        >
          {loadError} Your stored reminders and alarms have not been cleared.
          Check available device storage and try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLoadError(null);
            setLoaded(false);
            setLoadAttempt((n) => n + 1);
          }}
          style={{
            backgroundColor: palette.brand,
            padding: 16,
            borderRadius: 14,
          }}
        >
          <Text
            style={{
              color: palette.onBrand,
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Try again
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!loaded)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={32} color={C.brand} />
        <Text
          style={{
            marginTop: 12,
            color: palette.text,
          }}
        >
          Getting your reminders ready…
        </Text>
      </SafeAreaView>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaletteContext.Provider value={palette}>
        <ImageViewerScope>
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: palette.bg,
            }}
            edges={["top", "left", "right"]}
          >
            <ExpoStatusBar style={isDark ? "light" : "dark"} />
            {(!permission || alarmStatus?.exact === false) &&
              !bannerDismissed &&
              !onboardingActive && (
                <PermissionBanner
                  message={
                    !permission
                      ? "Enable notifications to receive your reminders on time."
                      : "Enable precise alarms for reminders to trigger on time. Without this setting, reminders may be slightly delayed."
                  }
                  actionTitle={
                    !permission
                      ? "Enable Notifications"
                      : "Enable precise timing"
                  }
                  onDismiss={() => setBannerDismissed(true)}
                  onEnable={async () => {
                    try {
                      if (NativeModules.ReminderNative)
                        await NativeModules.ReminderNative.openSettings(
                          !permission ? "notifications" : "alarms",
                        );
                      else await Linking.openSettings();
                    } catch {
                      Alert.alert(
                        "Notification settings",
                        "Open this app in system Settings and enable notifications.",
                      );
                    }
                  }}
                />
              )}
            <View
              accessibilityElementsHidden={onboardingActive}
              importantForAccessibility={
                onboardingActive ? "no-hide-descendants" : "auto"
              }
              style={{
                flex: 1,
              }}
            >
              <TabPager navigation={navigation}>
                <View style={{ flex: 1 }}>
                  <HomeReminders
                    categories={categories}
                    C={C}
                    categoryRows={categoryRows}
                    completeSelected={actions.completeSelected}
                    deleteMany={actions.deleteMany}
                    openNew={actions.openNew}
                    openReminder={openReminder}
                    reminders={reminders}
                    onSearchChange={clearSelection}
                    selectedIds={selectedIds}
                    selectedSet={selectedSet}
                    selectionMode={selectionMode}
                    setSelectedIds={setSelectedIds}
                    setTab={setTab}
                    tabBarHeight={tabBarHeight}
                    toggleSelection={actions.toggleSelection}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <CalendarPage
                    calendarDays={calendarDays}
                    calendarMarks={calendarMarks}
                    calendarMonth={calendarMonth}
                    calendarRows={calendarRows}
                    dateChosen={dateChosen}
                    deleteMany={actions.deleteMany}
                    moveMonth={actions.moveMonth}
                    openNew={actions.openNew}
                    openReminder={openReminder}
                    selectedDate={selectedDate}
                    selectedIds={selectedIds}
                    selectedSet={selectedSet}
                    selectionMode={selectionMode}
                    setCalendarMonth={setCalendarMonth}
                    setDateChosen={setDateChosen}
                    setSelectedDate={setSelectedDate}
                    setSelectedIds={setSelectedIds}
                    tabBarHeight={tabBarHeight}
                    todayISO={todayISO}
                    toggleSelection={actions.toggleSelection}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <SettingsPage
                    Alert={Alert}
                    alarmStatus={alarmStatus}
                    exportWith={actions.exportWith}
                    onImport={actions.onImport}
                    setShowPrivacy={setShowPrivacy}
                    setShowSounds={setShowSounds}
                    settings={settings}
                    sounds={sounds}
                    tabBarHeight={tabBarHeight}
                    updateSettings={actions.updateSettings}
                  />
                </View>
              </TabPager>

              <MainTabBar navigation={navigation} onLayout={onTabBarLayout} />
            </View>

            <ReminderEditor
              controller={editor}
              onSave={actions.persistReminder}
              Alert={Alert}
              todayISO={todayISO}
              timeNow={timeNow}
            />

            <ReminderSounds
              visible={showSounds}
              onClose={closeSounds}
              sounds={sounds}
              setSounds={setSounds}
              settings={settings}
              updateSettings={actions.updateSettings}
              Alert={Alert}
              C={C}
            />
            <Modal
              visible={showPrivacy}
              animationType="slide"
              onRequestClose={() => setShowPrivacy(false)}
            >
              {showPrivacy ? (
                <SafeAreaView
                  style={{
                    flex: 1,
                    backgroundColor: palette.bg,
                  }}
                >
                  <ScrollView
                    contentContainerStyle={{
                      padding: 20,
                    }}
                  >
                    <Btn
                      secondary
                      title="Close"
                      onPress={() => setShowPrivacy(false)}
                    />
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 26,
                        fontWeight: "800",
                        marginVertical: 20,
                      }}
                    >
                      Privacy Policy
                    </Text>
                    <Text
                      style={{
                        color: palette.text,
                        lineHeight: 24,
                      }}
                    >
                      Offline Reminder stores your reminders, preferences,
                      reminder images and imported audio files locally on your
                      device. The app does not require an account and does not
                      send this data to a backend, analytics or advertising
                      service. Notifications are scheduled through your
                      operating system. Audio files are accessed only when you
                      choose them using the system file picker, and a private
                      copy is saved in app storage. Exporting a backup shares
                      the reminder data with the destination you select; images
                      and imported audio are not included. Android device backup
                      may include app data according to your system backup
                      settings. You can delete reminders and imported sounds in
                      the app, or clear all app data in system settings.
                      Uninstalling the app removes its local private data. Keep
                      your backups safe: they can contain personal information.
                      This policy applies to version 1.0.0. Updated October 13,
                      2026.
                    </Text>
                  </ScrollView>
                </SafeAreaView>
              ) : null}
            </Modal>
            <ReminderDetails
              presentation={details}
              sheetRef={sheetRef}
              onClose={closeDetails}
              onDismiss={showPendingEditor}
              markComplete={actions.markComplete}
              openEdit={actions.openEdit}
              deleteReminder={actions.deleteReminder}
            />
            <DialogPresenter controller={dialogs} />
            <PermissionOnboarding
              onNotificationChange={setPermission}
              onActiveChange={setOnboardingActive}
            />
          </SafeAreaView>
        </ImageViewerScope>
      </PaletteContext.Provider>
    </GestureHandlerRootView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ReminderApp />
    </SafeAreaProvider>
  );
}
