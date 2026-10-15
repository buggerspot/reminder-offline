import React, { useContext, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Pause, Trash2, Volume2, X } from "lucide-react-native";
import { Btn, Card, Label, PaletteContext } from "./components";
import { PremiumFlatList as FlatList } from "./interaction-components";
import { BUILT_IN_SOUNDS, importSound, loadSounds, removeSound, stopPreview } from "./lib/sounds";
import { soundPreview, observeSoundPreview } from "./lib/sound-preview-native";

export const ReminderSounds = React.memo(function ReminderSounds({ visible, onClose, sounds, setSounds, settings, updateSettings, Alert, C }) {
  const palette = useContext(PaletteContext);
  const preview = useSyncExternalStore(soundPreview.subscribe, soundPreview.getSnapshot, soundPreview.getSnapshot);
  const previewing = ["playing", "loading"].includes(preview.status) ? preview.soundKey : null;
  useLayoutEffect(() => {
    if (!visible) return;
    const unsubscribe = observeSoundPreview();
    return () => { soundPreview.stop(); unsubscribe(); };
  }, [visible]);
  useEffect(() => { if (visible && preview.error) Alert.alert("Cannot play sound", preview.error); }, [visible, preview.error, Alert]);
  return (
        <Modal
          visible={visible}
          animationType="slide"
          onRequestClose={() => {
            stopPreview();
            onClose();

          }}
        >
          {visible ? <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: palette.bg,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: palette.text,
                  fontSize: 24,
                  fontWeight: "800",
                }}
              >
                Reminder sounds
              </Text>
              <Pressable
                accessibilityLabel="Close sounds"
                onPress={() => {
                  stopPreview();
                  onClose();

                }}
              >
                <X color={palette.text} />
              </Pressable>
            </View>
            <Text
              style={{
                color: palette.muted,
                lineHeight: 20,
                marginBottom: 18,
              }}
            >
              Choose an audio file using the system picker. A private copy stays
              on this device. No broad storage permission is needed.
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                marginBottom: 12,
              }}
            >
              <Btn
                title="Import Sound"
                secondary
                onPress={async () => {
                  try {
                    const sound = await importSound();
                    if (sound) setSounds(await loadSounds());
                  } catch (e) {
                    Alert.alert(
                      "Audio file access",
                      e.message +
                        " Choose an accessible audio file, or check the file provider permissions in system Settings.",
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                        {
                          text: "Choose Audio File",
                          onPress: async () => {
                            try {
                              await importSound();
                              setSounds(await loadSounds());
                            } catch (e) {
                              Alert.alert("Import failed", e.message);
                            }
                          },
                        },
                        {
                          text: "Settings",
                          onPress: () => Linking.openSettings(),
                        },
                      ],
                    );
                  }
                }}
              />
            </View>
            <FlatList
              data={[...BUILT_IN_SOUNDS, ...sounds]}
              keyExtractor={(s) => s.id || "default"}
              renderItem={({ item, index }) => (
                <View>
                  {(index === 0 || index === BUILT_IN_SOUNDS.length) && (
                    <Label>
                      {index === 0 ? "BUILT-IN SOUNDS" : "IMPORTED SOUNDS"}
                    </Label>
                  )}
                  <Card
                    style={{
                      marginBottom: 8,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Pressable
                        accessibilityLabel={
                          previewing === (item.id || "default")
                            ? "Pause preview"
                            : preview.status === "paused" && preview.soundKey === (item.id || "default") ? `Resume ${item.name}` : `Preview ${item.name}`
                        }
                        onPress={() => soundPreview.toggle(item)}
                        style={{
                          padding: 10,
                          borderRadius: 14,
                          backgroundColor: palette.soft,
                        }}
                      >
                        {previewing === (item.id || "default") ? (
                          <Pause color={palette.brand} size={22} />
                        ) : (
                          <Volume2 color={palette.brand} size={22} />
                        )}
                      </Pressable>
                      <Pressable
                        style={{
                          flex: 1,
                        }}
                        onPress={() => {
                          stopPreview();

                          updateSettings({
                            defaultSoundId: item.id,
                          }).catch((e) => Alert.alert("Settings", e.message));
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            color: palette.text,
                            fontWeight: "700",
                          }}
                        >
                          {item.name}
                        </Text>
                        <View
                          accessibilityLabel="Decorative audio waveform"
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            height: 22,
                            marginTop: 5,
                          }}
                        >
                          {[
                            5, 12, 8, 18, 10, 20, 7, 15, 9, 17, 6, 12, 8, 4,
                          ].map((h, i) => (
                            <View
                              key={i}
                              style={{
                                width: 3,
                                height: h,
                                borderRadius: 2,
                                backgroundColor:
                                  previewing === (item.id || "default")
                                    ? palette.brand
                                    : palette.muted,
                                opacity: 0.6,
                              }}
                            />
                          ))}
                        </View>
                      </Pressable>
                      {(settings.defaultSoundId || null) === item.id && (
                        <CheckCircle2 color={palette.brand} size={22} />
                      )}
                      {!item.builtIn && (
                        <Pressable
                          accessibilityLabel={`Remove ${item.name}`}
                          onPress={() =>
                            Alert.alert(
                              "Remove sound?",
                              "1 imported sound will be deleted. If selected, all reminders will use Reminder.",
                              [
                                {
                                  text: "Cancel",
                                  style: "cancel",
                                },
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      stopPreview();
                                      if (settings.defaultSoundId === item.id)
                                        await updateSettings({
                                          defaultSoundId: null,
                                        });
                                      await removeSound(item);
                                      setSounds(await loadSounds());
                                    } catch (e) {
                                      Alert.alert(
                                        "Cannot remove sound",
                                        e.message,
                                      );
                                    }
                                  },
                                },
                              ],
                            )
                          }
                        >
                          <Trash2 color={C.red} size={19} />
                        </Pressable>
                      )}
                    </View>
                  </Card>
                </View>
              )}
              ListFooterComponent={
                <Text
                  style={{
                    color: palette.muted,
                    marginTop: 8,
                  }}
                >
                  One common sound for every reminder. Tap a speaker to preview,
                  pause to pause playback, or a name to select.
                </Text>
              }
            />
          </SafeAreaView> : null}
        </Modal>
  );
});
