import React, { useContext, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, KeyboardAvoidingView, NativeModules, Platform, Pressable, Text, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarDays, ChevronRight, Clock, Repeat, Check, Trash2, X } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Btn, Chip, Field, Label, PaletteContext } from "./components";
import { PremiumScrollView as ScrollView, ImageViewerScope, ZoomableImage } from "./interaction-components";
import { importReminderImage } from "./lib/images";
import { ReminderValuePicker, REPEAT_OPTIONS } from "./reminder-value-picker";
import { validDate, nextOccurrence } from "./lib/recurrence";

function VisualPickerField({ label, kind, value, onChangeText, placeholder, fallback, optional, Alert }) {
  const palette = useContext(PaletteContext);
  const [visible, setVisible] = useState(false);
  const opening = useRef(false);
  const Icon = kind === "time" ? Clock : kind === "repeat" ? Repeat : CalendarDays;
  const open = async () => {
    if (opening.current) return;
    Keyboard.dismiss();
    const choose = kind === "date" ? NativeModules.ReminderNative?.chooseDate : kind === "time" ? NativeModules.ReminderNative?.chooseTime : null;
    if (!choose) { setVisible(true); return; }
    opening.current = true;
    try {
      const initial = kind === "date" ? (validDate(value) ? value : fallback) : (/^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback);
      const selected = await choose(initial);
      if (selected) onChangeText(selected);
    } catch (error) { Alert.alert(kind === "date" ? "Choose date" : "Choose time", error.message); }
    finally { opening.current = false; }
  };
  const display = kind === "repeat" ? REPEAT_OPTIONS.find(option => option.value === value)?.label : value;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${display || placeholder}`} accessibilityHint="Opens selection picker" onPress={open}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, minHeight: 48, opacity: pressed ? 0.7 : 1 })}>
      <Icon size={18} color={palette.brand} />
      <Text style={{ flex: 1, color: display ? palette.text : palette.muted, fontSize: 14 }}>{display || placeholder}</Text>
      <ChevronRight size={18} color={palette.muted} />
    </Pressable>
    {optional && value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear repeat end date" onPress={() => onChangeText("")} style={{ paddingVertical: 10 }}><Text style={{ color: palette.brand, fontWeight: "700" }}>No end date</Text></Pressable> : null}
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      {visible && <ReminderValuePicker visualOnly field={{ kind, label, placeholder, fallback, optional }} value={value} onChange={onChangeText} onClose={() => setVisible(false)} />}
    </Modal>
  </>;
}

function ReminderDraft({ initial, onClose, onSave, Alert, todayISO, timeNow }) {
  const palette = useContext(PaletteContext);
  const [form, setForm] = useState(initial.form);
  const editing = initial.editing;
  const [busy, setBusy] = useState(false);
  const [saveBarHeight, setSaveBarHeight] = useState(88);
  const saving = useRef(false);
  const submitReminder = async () => {
    if (saving.current) return;
    const title = form.title.trim();
    if (!title)
      return Alert.alert(
        "Add a title",
        "Give your reminder a short, clear title.",
      );
    if (
      !validDate(form.date) ||
      (form.repeat === "none" && form.date < todayISO())
    )
      return Alert.alert(
        "Check the date",
        "Choose today or a future date in YYYY-MM-DD format.",
      );
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time))
      return Alert.alert(
        "Check the time",
        "Enter time in 24-hour HH:MM format.",
      );
    const target = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(target.getTime()))
      return Alert.alert(
        "Check the date",
        "Enter a real calendar date in YYYY-MM-DD format.",
      );
    if (form.repeat === "none" && target.getTime() <= Date.now())
      return Alert.alert(
        "Choose a future time",
        "This reminder time has already passed.",
      );
    if (form.repeat === "weekly" && !form.weekdays?.length)
      return Alert.alert("Choose weekdays", "Select at least one weekday.");
    if (
      form.repeat === "monthly" &&
      (!Number.isInteger(Number(form.monthDay)) ||
        Number(form.monthDay) < 1 ||
        Number(form.monthDay) > 31)
    )
      return Alert.alert(
        "Choose a day",
        "Enter a day from 1 to 31. Shorter months skip this occurrence.",
      );
    if (
      form.repeatUntil &&
      (!validDate(form.repeatUntil) || form.repeatUntil < form.date)
    )
      return Alert.alert(
        "Check repeat end date",
        "Repeat end date must be on or after the first reminder date.",
      );
    if (
      form.repeat !== "none" &&
      !nextOccurrence({
        ...form,
        monthDay: Number(form.monthDay),
      })
    )
      return Alert.alert(
        "No future occurrences",
        "Choose a repeat end date and schedule with a future occurrence.",
      );
    saving.current = true;
    setBusy(true);
    try { await onSave(form, editing); onClose(); }
    catch (e) { Alert.alert("Could not schedule reminder", String(e?.message || e)); }
    finally { saving.current = false; setBusy(false); }
  };
  return (

          <SafeAreaView
            edges={["top", "left", "right", "bottom"]}
            style={{
              flex: 1,
              backgroundColor: palette.bg,
            }}
          >
            <KeyboardAvoidingView
              style={{
                flex: 1,
              }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: saveBarHeight + 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close reminder editor"
                    onPress={onClose}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: palette.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X color={palette.text} />
                  </Pressable>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 20,
                      fontWeight: "800",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    {editing ? "Edit reminder" : "New reminder"}
                  </Text>
                  <View
                    style={{
                      width: 42,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: palette.muted,
                    marginBottom: 18,
                  }}
                >
                  A title, a time, and you are all set.
                </Text>
                <Label>REMINDER TITLE *</Label>
                <Field
                  value={form.title}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      title: v,
                    }))
                  }
                  placeholder="e.g. Mom's birthday"
                  inputProps={{ accessibilityLabel: "Reminder title", returnKeyType: "done" }}
                />
                <Label>IMAGE (OPTIONAL)</Label>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {form.imageUri && (
                    <ZoomableImage
                      uri={form.imageUri}
                      style={{ width: 46, height: 46, borderRadius: 15 }}
                    />
                  )}
                  <Btn
                    secondary
                    title={form.imageUri ? "Change image" : "Choose image"}
                    onPress={async () => {
                      try {
                        const uri = await importReminderImage();
                        if (uri) setForm((p) => ({ ...p, imageUri: uri }));
                      } catch (e) {
                        Alert.alert("Cannot select image", e.message);
                      }
                    }}
                  />
                  {form.imageUri && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove image"
                      onPress={() => setForm((p) => ({ ...p, imageUri: null }))}
                      style={{ padding: 12 }}
                    >
                      <Trash2 size={20} color={palette.danger} />
                    </Pressable>
                  )}
                </View>
                <Label>DESCRIPTION (OPTIONAL)</Label>
                <Field
                  value={form.description}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      description: v,
                    }))
                  }
                  placeholder="Add a note or a little context…"
                  multiline
                  inputProps={{ accessibilityLabel: "Description" }}
                />
                {(form.repeat === "none" || form.repeat === "yearly") && (
                  <>
                    <Label>DATE · YYYY-MM-DD</Label>
                    <VisualPickerField
                      label="DATE · YYYY-MM-DD"
                      kind="date" fallback={todayISO()} Alert={Alert}
                      value={form.date}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          date: v,
                        }))
                      }
                      placeholder="2026-12-24"
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text
                      style={{
                        color: palette.muted,
                        fontSize: 11,
                        marginTop: 5,
                      }}
                    >
                      Use today or a future date.
                    </Text>
                  </>
                )}
                <Label>TIME · 24-HOUR HH:MM</Label>
                <VisualPickerField
                  label="TIME · 24-HOUR HH:MM"
                  kind="time" fallback={timeNow()} Alert={Alert}
                      value={form.time}
                  onChangeText={(v) =>
                    setForm((p) => ({
                      ...p,
                      time: v,
                    }))
                  }
                  placeholder="09:30"
                  keyboardType="numbers-and-punctuation"
                />
                <Label>REPEAT</Label>
                <VisualPickerField label="Repeat" kind="repeat" value={form.repeat}
                  onChangeText={repeat => setForm(p => ({ ...p, repeat,
                    weekdays: p.weekdays || [new Date(`${p.date}T12:00:00`).getDay()],
                    monthDay: p.monthDay || new Date(`${p.date}T12:00:00`).getDate(),
                  }))} />
                {form.repeat === "weekly" && (
                  <>
                    <Label>WEEKDAYS</Label>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (label, day) => (
                          <Chip
                            key={label}
                            label={label}
                            active={form.weekdays?.includes(day)}
                            onPress={() =>
                              setForm((p) => ({
                                ...p,
                                weekdays: p.weekdays?.includes(day)
                                  ? p.weekdays.filter((d) => d !== day)
                                  : [...(p.weekdays || []), day],
                              }))
                            }
                          />
                        ),
                      )}
                    </View>
                  </>
                )}
                {form.repeat === "monthly" && (
                  <>
                    <Label>DAY OF MONTH · 1–31</Label>
                    <VisualPickerField
                      label="DAY OF MONTH · 1–31"
                      kind="monthDay"
                      value={String(form.monthDay || "")}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          monthDay: v,
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="20"
                    />
                    {Number(form.monthDay) >= 29 && Number(form.monthDay) <= 31 && (
                    <Text
                      style={{
                        color: palette.muted,
                        marginTop: 6,
                      }}
                    >
                      Months without this day are skipped.
                    </Text>
                    )}
                  </>
                )}
                {form.repeat !== "none" && (
                  <>
                    <Label>REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD</Label>
                    <VisualPickerField
                      label="REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD"
                      kind="date" optional fallback={validDate(form.date) ? form.date : todayISO()} Alert={Alert}
                      value={form.repeatUntil}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          repeatUntil: v,
                        }))
                      }
                      placeholder="Leave empty to repeat indefinitely"
                      keyboardType="numbers-and-punctuation"
                    />
                  </>
                )}
              </ScrollView>
                <View
                  onLayout={event => setSaveBarHeight(event.nativeEvent.layout.height)}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 20,
                    backgroundColor: palette.bg,
                  }}
                >
                  <Btn
                    title={
                      busy
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : "Save reminder"
                    }
                    onPress={submitReminder}
                    disabled={busy}
                    icon={<Check color="white" size={18} />}
                  />
                </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
  );
}

export const ReminderEditor = React.memo(function ReminderEditor({ controller, onSave, Alert, todayISO, timeNow }) {
  const initial = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const viewer = useRef(null);
  return <Modal visible={!!initial} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!viewer.current?.closeIfOpen()) controller.close(); }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ImageViewerScope ref={viewer}>{initial ? <ReminderDraft key={initial.editing?.id || "new"} initial={initial} onClose={controller.close} onSave={onSave} Alert={Alert} todayISO={todayISO} timeNow={timeNow} /> : null}</ImageViewerScope>
    </GestureHandlerRootView>
  </Modal>;
});
