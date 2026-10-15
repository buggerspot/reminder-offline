import React, { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarDays, Clock3, CheckCircle2, Trash2, X } from "lucide-react-native";
import { Btn, PaletteContext } from "./components";
import { ReminderSheet, ZoomableImage } from "./interaction-components";
import { formatDate, formatTime } from "./lib/format";

export const ReminderDetails = React.memo(function ReminderDetails({ presentation, sheetRef, onClose, onDismiss, markComplete, openEdit, deleteReminder }) {
  const detail = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  const palette = useContext(PaletteContext);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [detailImageFailed, setDetailImageFailed] = useState(false);
  useEffect(() => { setSheetExpanded(false); setDetailImageFailed(false); }, [detail?.id, detail?.imageUri]);
  return (
        <ReminderSheet ref={sheetRef} item={detail} presentation={presentation} expanded={sheetExpanded} onClose={onClose} onDismiss={onDismiss} onExpand={() => setSheetExpanded(true)} onCollapse={() => setSheetExpanded(false)}>
            <View
              style={{
                backgroundColor: palette.bg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 22,
                paddingBottom: 34,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{
                      color: palette.muted,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    REMINDER DETAILS
                  </Text>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 24,
                      fontWeight: "800",
                      marginTop: 7,
                    }}
                  >
                    {detail?.title}
                  </Text>
                </View>
                {detail?.imageUri && !detailImageFailed && <ZoomableImage uri={detail.imageUri} onError={() => setDetailImageFailed(true)} style={{ width: 46, height: 46, borderRadius: 15, marginRight: 12 }} />}
                <Pressable onPress={() => sheetRef.current?.close()}>
                  <X color={palette.text} />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 20,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: palette.card,
                    borderRadius: 15,
                    padding: 13,
                  }}
                >
                  <CalendarDays color={palette.brand} size={20} />
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      marginTop: 8,
                    }}
                  >
                    {detail ? formatDate(detail.date) : ""}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: palette.card,
                    borderRadius: 15,
                    padding: 13,
                  }}
                >
                  <Clock3 color={palette.brand} size={20} />
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      marginTop: 8,
                    }}
                  >
                    {detail ? formatTime(detail.time) : ""}
                  </Text>
                </View>
              </View>
              {detail?.description ? (
                <Text
                  style={{
                    color: palette.muted,
                    lineHeight: 21,
                    marginBottom: 18,
                  }}
                >
                  {detail.description}
                </Text>
              ) : null}
              {detail?.repeat && detail.repeat !== "none" ? (
                <Text
                  style={{
                    color: palette.muted,
                    marginBottom: 16,
                  }}
                >
                  Repeats {detail.repeat}
                  {detail.repeatUntil ? ` until ${detail.repeatUntil}` : ""}
                </Text>
              ) : null}
              {detail?.imageUri && !detailImageFailed && <View style={{ marginBottom: 18, alignItems: "flex-start" }}>
                <ZoomableImage uri={detail.imageUri} onError={() => setDetailImageFailed(true)} style={{ width: 180, height: 180, borderRadius: 15 }} />
              </View>}
              {!detail?.completed && (
                <View
                  style={{
                    marginBottom: 10,
                  }}
                >
                  <Btn
                    title="Mark as complete"
                    onPress={() => markComplete(detail.id)}
                    icon={<CheckCircle2 color="white" size={18} />}
                  />
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Btn
                    title="Edit"
                    secondary
                    onPress={() => openEdit(detail)}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Btn
                    title="Delete"
                    danger
                    onPress={() => deleteReminder(detail)}
                    icon={<Trash2 color="#B91C1C" size={17} />}
                  />
                </View>
              </View>
            </View>
        </ReminderSheet>
  );
});
