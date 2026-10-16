import React from "react";
import { Linking, NativeModules, Platform, Pressable, Text, View } from "react-native";
import { ChevronRight, Download, FileUp, Heart, Sun, Volume2 } from "lucide-react-native";
import { Btn, Card, PaletteContext, SettingsToggle } from "./components";
import { PremiumScrollView as ScrollView } from "./interaction-components";
import { BUILT_IN_SOUNDS } from "./lib/sounds";
export const SettingsPage = React.memo(function SettingsPage({ Alert, alarmStatus, exportWith, onImport, setShowSounds, settings, sounds, tabBarHeight, updateSettings }) {
  const palette = React.useContext(PaletteContext);
  const isDark = settings.theme === "dark";
  return (
            <ScrollView
              boundaryInset={tabBarHeight}
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 110,
              }}
            >
              <Text
                style={{
                  color: palette.text,
                  fontSize: 28,
                  fontWeight: "800",
                }}
              >
                Settings
              </Text>
              <Text
                style={{
                  color: palette.muted,
                  marginTop: 5,
                  marginBottom: 22,
                }}
              >
                Make Offline Reminder work your way.
              </Text>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                PERSONAL EXPERIENCE
              </Text>
              <Card
                style={{
                  padding: 0,
                  overflow: "hidden",
                  marginBottom: 22,
                }}
              >
                <SettingRow
                  palette={palette}
                  icon={<Sun color={palette.brand} />}
                  title="Appearance"
                  subtitle={isDark ? "Dark Mode" : "Light Mode"}
                  right={
                    <SettingsToggle
                      label="Dark Mode"
                      value={isDark}
                      onValueChange={() =>
                        updateSettings({ theme: current => current === "dark" ? "light" : "dark" })
                      }
                    />
                  }
                />
                <SettingRow
                  palette={palette}
                  icon={<Volume2 color={palette.brand} />}
                  title="Reminder Sound"
                  subtitle={
                    (
                      sounds.find((s) => s.id === settings.defaultSoundId) ||
                      BUILT_IN_SOUNDS.find(
                        (s) => s.id === (settings.defaultSoundId || null),
                      )
                    )?.name || "Reminder"
                  }
                  onPress={() => setShowSounds(true)}
                  right={<ChevronRight color={palette.muted} />}
                  last
                />
              </Card>
              <Card
                style={{
                  marginBottom: 22,
                }}
              >
                {alarmStatus && (
                  <Text
                    style={{
                      color: palette.text,
                      marginBottom: 12,
                    }}
                  >
                    Alarm timing:{" "}
                    {alarmStatus.exact
                      ? "Exact alarms allowed"
                      : "Approximate · access unavailable"}
                  </Text>
                )}
                {alarmStatus && !alarmStatus.exact && (
                  <Btn
                    secondary
                    title="Enable precise timing"
                    onPress={() =>
                      NativeModules.ReminderNative?.openSettings(
                        "alarms",
                      ).catch((e) => Alert.alert("Settings", e.message))
                    }
                  />
                )}
                <Text
                  style={{
                    color: palette.muted,
                    fontSize: 12,
                    marginTop: 12,
                    lineHeight: 18,
                  }}
                >
                  Allow clock and reminder permissions so reminders can arrive
                  as close to their scheduled time as possible.
                </Text>
              </Card>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                BACKUP & RESTORE
              </Text>
              <Card
                style={{
                  padding: 0,
                  overflow: "hidden",
                  marginBottom: 22,
                }}
              >
                <SettingRow
                  palette={palette}
                  icon={<Download color={palette.brand} />}
                  title="Export Backup"
                  subtitle="Best for restoring reminders and repeat settings"
                  onPress={() =>
                    Alert.alert(
                      "Export Backup",
                      "Choose where to save your backup.",
                      [
                        {
                          text: "Download to Device",
                          onPress: () => exportWith("download"),
                        },
                        {
                          text: "Share",
                          onPress: () => exportWith("share"),
                        },
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                      ],
                    )
                  }
                  right={<ChevronRight color={palette.muted} />}
                />
                <SettingRow
                  palette={palette}
                  icon={<FileUp color={palette.brand} />}
                  title="Import Backup"
                  subtitle="Restore reminders on this phone"
                  onPress={onImport}
                  right={<ChevronRight color={palette.muted} />}
                  last
                />
              </Card>
              <Text
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                ABOUT YOUR DATA
              </Text>
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <Heart color={palette.brand} size={23} />
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: "800",
                        fontSize: 15,
                      }}
                    >
                      Your reminders belong to you.
                    </Text>
                    <Text
                      style={{
                        color: palette.muted,
                        lineHeight: 20,
                        marginTop: 7,
                        fontSize: 13,
                      }}
                    >
                      No login, no profile and no cloud account. Your reminders
                      are stored locally on this device. Export a backup before
                      changing phones or uninstalling the app. OS settings can
                      still silence or delay notifications.
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: palette.border,
                    marginVertical: 16,
                  }}
                />
                <Text
                  style={{
                    color: palette.muted,
                    fontSize: 12,
                  }}
                >
                  Offline Reminder · Version 1.0.0
                </Text>
                <Pressable
                  accessibilityRole="link"
                  {...(Platform.OS === "web"
                    ? { href: "https://www.buggerspot.com/apps/reminder-offline/privacy-policy" }
                    : { onPress: () => Linking.openURL("https://www.buggerspot.com/apps/reminder-offline/privacy-policy") })}
                  style={{
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: palette.brand,
                      fontWeight: "700",
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Pressable>
              </Card>
            </ScrollView>
  );
});

function SettingRow({
  palette,
  icon,
  title,
  subtitle,
  right,
  onPress,
  last = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: palette.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: palette.muted,
              fontSize: 11,
              marginTop: 4,
              lineHeight: 16,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || <ChevronRight color={palette.muted} size={18} />}
    </Pressable>
  );
}
