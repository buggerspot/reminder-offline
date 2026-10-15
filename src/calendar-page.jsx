import React from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react-native";
import { Btn, Card, Chip, PaletteContext, ReminderRow, SelectedDateText, SelectionArea, SelectionToolbar } from "./components";
import { PremiumFlatList as FlatList } from "./interaction-components";
import { formatDate } from "./lib/format";
export const CalendarPage = React.memo(function CalendarPage({ calendarDays, calendarMarks, calendarMonth, calendarRows, dateChosen, deleteMany, moveMonth, openNew, openReminder, selectedDate, selectedIds, selectedSet, selectionMode, setCalendarMonth, setDateChosen, setSelectedDate, setSelectedIds, tabBarHeight, todayISO, toggleSelection }) {
  const palette = React.useContext(PaletteContext);
  return (
            <View style={{ flex: 1 }}>
              <FlatList
              boundaryInset={tabBarHeight}
                data={calendarRows}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ReminderRow
                    item={item}
                    showStatus
                    selected={selectedSet.has(item.id)}
                    selectionMode={selectionMode}
                    onLongPress={() => toggleSelection(item.id)}
                    onOpen={(r) =>
                      selectionMode ? toggleSelection(r.id) : openReminder(r)
                    }
                  />
                )}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                contentContainerStyle={{
                  padding: 20,
                  paddingBottom: 110,
                }}
                ListHeaderComponent={
                  <View>
                    <Text
                      style={{
                        color: palette.text,
                        fontSize: 28,
                        fontWeight: "800",
                        marginBottom: 20,
                      }}
                    >
                      Your calendar
                    </Text>
                    <Card>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Pressable
                          accessibilityLabel="Previous month"
                          onPress={() => moveMonth(-1)}
                          hitSlop={12}
                        >
                          <ChevronLeft color={palette.brand} />
                        </Pressable>
                        <Text
                          style={{
                            color: palette.text,
                            fontSize: 18,
                            fontWeight: "800",
                          }}
                        >
                          {calendarMonth.toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })}
                        </Text>
                        <Pressable
                          accessibilityLabel="Next month"
                          onPress={() => moveMonth(1)}
                          hitSlop={12}
                        >
                          <ChevronRight color={palette.brand} />
                        </Pressable>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                          justifyContent: "space-between",
                          marginVertical: 14,
                        }}
                      >
                        <Chip
                          label="Previous year"
                          onPress={() => moveMonth(-12)}
                        />
                        <Chip
                          label="Today"
                          onPress={() => {
                            setCalendarMonth(new Date());
                            setSelectedDate(todayISO());
                            setDateChosen(true);
                          }}
                        />
                        <Chip label="Next year" onPress={() => moveMonth(12)} />
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                        }}
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (day) => (
                            <Text
                              key={day}
                              style={{
                                width: "14.28%",
                                textAlign: "center",
                                color: palette.muted,
                                fontSize: 11,
                              }}
                            >
                              {day}
                            </Text>
                          ),
                        )}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                        }}
                      >
                        {calendarDays.map((date, i) => (
                          <Pressable
                            key={date || i}
                            disabled={!date}
                            accessibilityRole="button"
                            accessibilityLabel={date || undefined}
                            accessibilityState={{
                              selected: date === selectedDate,
                            }}
                            onPress={() => {
                              setSelectedDate(date);
                              setDateChosen(true);
                            }}
                            style={{
                              width: "14.28%",
                              alignItems: "center",
                              paddingVertical: 8,
                            }}
                          >
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor:
                                  date === selectedDate
                                    ? palette.brand
                                    : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    date === selectedDate
                                      ? palette.onBrand
                                      : palette.text,
                                }}
                              >
                                {date ? Number(date.slice(-2)) : ""}
                              </Text>
                            </View>
                            <View
                              style={{
                                height: 5,
                                width: 5,
                                borderRadius: 3,
                                backgroundColor: calendarMarks.has(date)
                                  ? palette.brand
                                  : "transparent",
                                marginTop: 3,
                              }}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </Card>
                    <SelectionArea
                      active={selectionMode}
                      actions={
                        <SelectionToolbar
                          count={selectedIds.length}
                          total={calendarRows.length}
                          onSelectAll={() =>
                            setSelectedIds(
                              selectedIds.length === calendarRows.length
                                ? []
                                : calendarRows.map((r) => r.id),
                            )
                          }
                          onCancel={() => setSelectedIds([])}
                          onDelete={() =>
                            deleteMany(
                              calendarRows
                                .filter((r) => selectedSet.has(r.id))
                                .map((r) => r.id),
                            )
                          }
                        />
                      }
                    >
                      <View
                        style={{
                          height: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <SelectedDateText
                          date={dateChosen ? selectedDate : null}
                          label={formatDate(selectedDate)}
                          palette={palette}
                          style={{
                            marginVertical: 2,
                            flexShrink: 1,
                            marginLeft: 6,
                          }}
                        />
                      </View>
                    </SelectionArea>
                    <View
                      style={{
                        marginBottom: 16,
                      }}
                    >
                      <Btn
                        title="Create reminder on this date"
                        onPress={() => openNew(selectedDate)}
                      />
                    </View>
                  </View>
                }
                ListEmptyComponent={
                  <Text
                    style={{
                      color: palette.muted,
                    }}
                  >
                    No upcoming reminders scheduled for this date.
                  </Text>
                }
              />
            </View>

  );
});
