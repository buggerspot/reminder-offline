import React, { useContext, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, KeyboardAvoidingView, NativeModules, Platform, Pressable, Text, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Trash2, X } from "lucide-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Btn, Chip, Field, Label, PaletteContext } from "./components";
import { PremiumScrollView as ScrollView, ImageViewerScope, ZoomableImage } from "./interaction-components";
import { importReminderImage } from "./lib/images";
import { validDate, nextOccurrence } from "./lib/recurrence";

function ManualDateTimeField({ label, ...props }) {
  const palette = useContext(PaletteContext);
  const [visible, setVisible] = useState(false);
  const input = useRef(null);
  const close = () => { Keyboard.dismiss(); setVisible(false); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={() => { Keyboard.dismiss(); setVisible(true); }}>
      <View pointerEvents="none">
        <Field {...props} inputProps={{ editable: false, accessible: false }} />
      </View>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} onShow={() => input.current?.focus()}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
            <View accessibilityViewIsModal style={{ backgroundColor: palette.card, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 20 }}>
              <Label>{label}</Label>
              <Field {...props} inputProps={{ ref: input, accessibilityLabel: label, returnKeyType: "done", onSubmitEditing: close }} />
              <View style={{ marginTop: 16 }}><Btn title="Done" onPress={close} /></View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

function ReminderDraft({ initial, onClose, onSave, Alert, todayISO, timeNow }) {
  const palette = useContext(PaletteContext);
  const [form, setForm] = useState(initial.form);
  const editing = initial.editing;
  const [busy, setBusy] = useState(false);
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
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: 40,
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
                />
                <Label>IMAGE (OPTIONAL)</Label>
                <View
                  style={{
                    flexDirection: "row",
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
                />
                {(form.repeat === "none" || form.repeat === "yearly") && (
                  <>
                    <Label>DATE · YYYY-MM-DD</Label>
                    <ManualDateTimeField
                      label="DATE · YYYY-MM-DD"
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
                    {NativeModules.ReminderNative && (
                      <Pressable
                        accessibilityRole="button"
                        style={{
                          paddingVertical: 12,
                        }}
                        onPress={async () => {
                          try {
                            const date =
                              await NativeModules.ReminderNative.chooseDate(
                                validDate(form.date) ? form.date : todayISO(),
                              );
                            if (date)
                              setForm((p) => ({
                                ...p,
                                date,
                              }));
                          } catch (e) {
                            Alert.alert("Choose date", e.message);
                          }
                        }}
                      >
                        <Text
                          style={{
                            color: palette.brand,
                            fontWeight: "700",
                          }}
                        >
                          Choose date
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
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
                    <Field
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
                    <Text
                      style={{
                        color: palette.muted,
                        marginTop: 6,
                      }}
                    >
                      Months without this day are skipped.
                    </Text>
                  </>
                )}
                <Label>TIME · 24-HOUR HH:MM</Label>
                <ManualDateTimeField
                  label="TIME · 24-HOUR HH:MM"
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
                {NativeModules.ReminderNative && (
                  <Pressable
                    accessibilityRole="button"
                    style={{
                      paddingVertical: 12,
                    }}
                    onPress={async () => {
                      try {
                        const time =
                          await NativeModules.ReminderNative.chooseTime(
                            /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)
                              ? form.time
                              : timeNow(),
                          );
                        if (time)
                          setForm((p) => ({
                            ...p,
                            time,
                          }));
                      } catch (e) {
                        Alert.alert("Choose time", e.message);
                      }
                    }}
                  >
                    <Text
                      style={{
                        color: palette.brand,
                        fontWeight: "700",
                      }}
                    >
                      Choose time
                    </Text>
                  </Pressable>
                )}
                <Label>REPEAT</Label>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {[
                    {
                      v: "none",
                      l: "Never",
                    },
                    {
                      v: "daily",
                      l: "Daily",
                    },
                    {
                      v: "weekly",
                      l: "Weekly",
                    },
                    {
                      v: "monthly",
                      l: "Monthly",
                    },
                    {
                      v: "yearly",
                      l: "Yearly",
                    },
                  ].map((o) => (
                    <Chip
                      key={o.v}
                      label={o.l}
                      active={form.repeat === o.v}
                      onPress={() =>
                        setForm((p) => ({
                          ...p,
                          repeat: o.v,
                          weekdays: p.weekdays || [
                            new Date(`${p.date}T12:00:00`).getDay(),
                          ],
                          monthDay:
                            p.monthDay ||
                            new Date(`${p.date}T12:00:00`).getDate(),
                        }))
                      }
                    />
                  ))}
                </View>
                {form.repeat !== "none" && (
                  <>
                    <Label>REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD</Label>
                    <ManualDateTimeField
                      label="REPEAT UNTIL (OPTIONAL) · YYYY-MM-DD"
                      value={form.repeatUntil}
                      onChangeText={(v) =>
                        setForm((p) => ({
                          ...p,
                          repeatUntil: v,
                        }))
                      }
                      placeholder="Leave empty to repeat indefinitely"
                    />
                  </>
                )}
                <View
                  style={{
                    marginTop: 26,
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
              </ScrollView>
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
