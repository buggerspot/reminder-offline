import React, { useContext, useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Bell, CalendarDays, Plus, Search, Settings as SettingsIcon, X } from "lucide-react-native";
import { Btn, Card, PaletteContext, ReminderRow, SelectionArea, SelectionToolbar } from "./components";
import { PremiumFlatList as FlatList } from "./interaction-components";

export const HomeReminders = React.memo(function HomeReminders({ categories, C, categoryRows, completeSelected, deleteMany, homeRows, openNew, openReminder, reminders, search, searchedCategories, selectedIds, selectedSet, selectionMode, setSearch, setSelectedIds, setTab, tabBarHeight, toggleSelection }) {
  const filter = useSyncExternalStore(categories.subscribe, categories.getSnapshot, categories.getSnapshot);
  const palette = useContext(PaletteContext);
  const visible = searchedCategories[filter];
  const setFilter = name => categories.select(name);
  const header = useMemo(() => (

                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 22,
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            color: palette.muted,
                            fontSize: 13,
                          }}
                        >
                          YOUR PERSONAL ASSISTANT
                        </Text>
                        <Text
                          style={{
                            color: palette.text,
                            fontSize: 28,
                            fontWeight: "800",
                            marginTop: 3,
                          }}
                        >
                          Make time matter.
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setTab("Settings")}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 15,
                          backgroundColor: palette.card,
                          borderColor: palette.border,
                          borderWidth: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <SettingsIcon color={palette.text} />
                      </Pressable>
                    </View>
                    <View
                      style={{
                        backgroundColor: C.brand,
                        borderRadius: 24,
                        padding: 20,
                        marginBottom: 22,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={{
                              color: "#CCFBF1",
                              fontSize: 12,
                              fontWeight: "700",
                            }}
                          >
                            A LITTLE MORE PEACE OF MIND
                          </Text>
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontSize: 23,
                              fontWeight: "800",
                              marginTop: 8,
                            }}
                          >
                            Remember what matters.
                          </Text>
                          <Text
                            style={{
                              color: "#D1FAE5",
                              fontSize: 13,
                              marginTop: 7,
                              lineHeight: 19,
                            }}
                          >
                            Big moments, tiny tasks — let us keep track.
                          </Text>
                        </View>
                        <Bell color="#D1FAE5" size={50} />
                      </View>
                      <Pressable
                        onPress={openNew}
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderRadius: 13,
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          alignSelf: "flex-start",
                          marginTop: 18,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Plus color={C.brand} size={18} />
                        <Text
                          style={{
                            color: C.brand,
                            fontWeight: "800",
                          }}
                        >
                          Create reminder
                        </Text>
                      </Pressable>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 13,
                      }}
                    >
                      <Text
                        style={{
                          color: palette.text,
                          fontSize: 19,
                          fontWeight: "800",
                        }}
                      >
                        Your reminders
                      </Text>
                      <Pressable onPress={() => setTab("Calendar")}>
                        <Text
                          style={{ color: palette.brand, fontWeight: "700" }}
                        >
                          View calendar
                        </Text>
                      </Pressable>
                    </View>
                  </View>

  ), [palette, C, openNew, setTab]);
  return (
            <FlatList
              boundaryInset={tabBarHeight}
              data={homeRows[filter]}
              stickyHeaderIndices={[1]}
              keyExtractor={(item) =>
                item.header
                  ? "list-header"
                  : item.controls
                    ? "list-controls"
                    : `reminder:${item.id}`
              }
              renderItem={({ item }) =>
                item.header ? header : item.controls ? (
                  <View style={{ backgroundColor: palette.bg, paddingTop: 8 }}>
                    <View
                      style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}
                    >
                      {["Upcoming", "Completed", "Missed"].map((category) => (
                        <Pressable
                          key={category}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: filter === category }}
                          onPress={() => setFilter(category)}
                          style={{
                            flex: 1,
                            backgroundColor:
                              filter === category
                                ? palette.brand
                                : palette.card,
                            borderColor:
                              filter === category
                                ? palette.brand
                                : palette.border,
                            borderWidth: 1,
                            borderRadius: 17,
                            padding: 12,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                filter === category
                                  ? palette.onBrand
                                  : palette.text,
                              fontSize: 23,
                              fontWeight: "800",
                            }}
                          >
                            {categoryRows[category].length}
                          </Text>
                          <Text
                            style={{
                              color:
                                filter === category
                                  ? palette.onBrand
                                  : palette.muted,
                              fontSize: 11,
                              marginTop: 3,
                            }}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <SelectionArea
                      active={selectionMode}
                      actions={
                        <SelectionToolbar
                          count={selectedIds.length}
                          total={visible.length}
                          onSelectAll={() =>
                            setSelectedIds(
                              selectedIds.length === visible.length
                                ? []
                                : visible.map((r) => r.id),
                            )
                          }
                          onCancel={() => {
                            setSelectedIds([]);
                          }}
                          onDelete={() =>
                            deleteMany(
                              visible
                                .filter((r) => selectedSet.has(r.id))
                                .map((r) => r.id),
                            )
                          }
                          onComplete={
                            filter === "Upcoming" ? completeSelected : undefined
                          }
                        />
                      }
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: palette.card,
                          borderWidth: 1,
                          borderColor: palette.border,
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          height: 48,
                        }}
                      >
                        <Search color={palette.muted} size={18} />
                        <TextInput
                          editable={!selectionMode}
                          value={search}
                          onChangeText={setSearch}
                          placeholder="Search reminders"
                          placeholderTextColor={palette.muted}
                          style={{
                            flex: 1,
                            padding: 12,
                            color: palette.text,
                          }}
                        />
                        {search ? (
                          <Pressable onPress={() => setSearch("")}>
                            <X size={16} color={palette.muted} />
                          </Pressable>
                        ) : null}
                      </View>
                    </SelectionArea>
                  </View>
                ) : (
                  <ReminderRow
                    item={item}
                    selected={selectedSet.has(item.id)}
                    selectionMode={selectionMode}
                    onLongPress={() => toggleSelection(item.id)}
                    onOpen={(r) =>
                      selectionMode ? toggleSelection(r.id) : openReminder(r)
                    }
                  />
                )
              }
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 110,
              }}
              ListFooterComponent={
                visible.length ? null : (
                  <Card>
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 20,
                      }}
                    >
                      <CalendarDays color={palette.brand} size={34} />
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: "800",
                          fontSize: 16,
                          marginTop: 12,
                        }}
                      >
                        {reminders.length
                          ? `No ${filter.toLowerCase()} reminders.`
                          : "A little room to breathe"}
                      </Text>
                      <Text
                        style={{
                          color: palette.muted,
                          textAlign: "center",
                          marginTop: 6,
                          lineHeight: 20,
                        }}
                      >
                        {reminders.length
                          ? search
                            ? "Try another search."
                            : "Your reminders will appear here."
                          : "No reminders here yet. Add one now and let your mind focus on what matters."}
                      </Text>
                      <View
                        style={{
                          marginTop: 16,
                          width: "100%",
                        }}
                      >
                        <Btn
                          title={
                            reminders.length
                              ? "Add reminder"
                              : "Add your first reminder"
                          }
                          onPress={openNew}
                          icon={<Plus color="white" size={18} />}
                        />
                      </View>
                    </View>
                  </Card>
                )
              }
            />
  );
});
