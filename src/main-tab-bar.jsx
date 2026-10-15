import React, { useSyncExternalStore } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Home, CalendarDays, Settings as SettingsIcon } from "lucide-react-native";
import { PaletteContext } from "./palette";
export const MainTabBar = React.memo(function MainTabBar({ navigation, onLayout }) {
  const tab = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
  const palette = React.useContext(PaletteContext);
  return (
          <View
            onLayout={onLayout}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: palette.card,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              paddingTop: 10,
              paddingBottom: Platform.OS === "ios" ? 12 : 10,
              flexDirection: "row",
              justifyContent: "space-around",
            }}
          >
            {[
              {
                name: "Home",
                icon: Home,
              },
              {
                name: "Calendar",
                icon: CalendarDays,
              },
              {
                name: "Settings",
                icon: SettingsIcon,
              },
            ].map((x) => {
              const I = x.icon;
              const active = tab === x.name;
              return (
                <Pressable
                  key={x.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => navigation.navigate(x.name)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.65 : 1,
                    alignItems: "center",
                    gap: 4,
                    minWidth: 70,
                  })}
                >
                  <I size={21} color={active ? palette.brand : palette.muted} />
                  <Text
                    style={{
                      color: active ? palette.brand : palette.muted,
                      fontSize: 11,
                      fontWeight: active ? "800" : "600",
                    }}
                  >
                    {x.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

  );
});
