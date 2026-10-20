package com.buggerspot.reminderoffline

import android.view.ContextThemeWrapper
import android.view.View
import android.widget.DatePicker
import android.widget.FrameLayout
import android.widget.TimePicker
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

/** The existing Android calendar/clock controls, embedded in the editor's themed panel. */
class ReminderPickerView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
  var kind = "date"
  var value = ""
  var dark = false
  private var appliedKind = ""
  private var appliedDark = false
  private var updating = false

  fun updatePicker() {
    updating = true
    try {
      if (childCount == 0 || appliedKind != kind || appliedDark != dark) {
        removeAllViews()
        val themed = ContextThemeWrapper(reactContext, if (dark) R.style.ReminderPickerDark else R.style.ReminderPickerLight)
        val picker: View = if (kind == "time") TimePicker(themed).apply {
          setIs24HourView(android.text.format.DateFormat.is24HourFormat(reactContext))
          setOnTimeChangedListener { _, hour, minute -> emit(String.format(Locale.ROOT, "%02d:%02d", hour, minute)) }
        } else DatePicker(themed).apply {
          val date = runCatching { LocalDate.parse(value) }.getOrElse { LocalDate.now() }
          init(date.year, date.monthValue - 1, date.dayOfMonth) { _, year, month, day -> emit(LocalDate.of(year, month + 1, day).toString()) }
        }
        picker.setBackgroundColor(android.graphics.Color.parseColor(if (dark) "#000000" else "#F4F8F7"))
        addView(picker, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        appliedKind = kind
        appliedDark = dark
      }
      when (val picker = getChildAt(0)) {
        is DatePicker -> {
          val date = runCatching { LocalDate.parse(value) }.getOrElse { LocalDate.now() }
          if (picker.year != date.year || picker.month != date.monthValue - 1 || picker.dayOfMonth != date.dayOfMonth)
            picker.updateDate(date.year, date.monthValue - 1, date.dayOfMonth)
        }
        is TimePicker -> {
          val time = runCatching { LocalTime.parse(value) }.getOrElse { LocalTime.of(9, 30) }
          if (picker.hour != time.hour) picker.hour = time.hour
          if (picker.minute != time.minute) picker.minute = time.minute
        }
      }
      requestLayout()
    } finally { updating = false }
  }

  private fun emit(next: String) {
    if (updating || value == next) return
    value = next
    UIManagerHelper.getEventDispatcher(reactContext)?.dispatchEvent(PickerChangeEvent(UIManagerHelper.getSurfaceId(reactContext), id, next))
  }

  // Native child controls perform their own layout, rather than using Yoga.
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (childCount == 0) return
    val child = getChildAt(0)
    child.measure(MeasureSpec.makeMeasureSpec(right - left, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(bottom - top, MeasureSpec.AT_MOST))
    child.layout(0, 0, child.measuredWidth, child.measuredHeight)
  }
}

private class PickerChangeEvent(surfaceId: Int, viewId: Int, private val value: String) : Event<PickerChangeEvent>(surfaceId, viewId) {
  override fun getEventName() = "topChange"
  override fun getEventData() = Arguments.createMap().apply { putString("value", value) }
}

class ReminderPickerManager : SimpleViewManager<ReminderPickerView>() {
  override fun getName() = "ReminderVisualPicker"
  override fun createViewInstance(context: ThemedReactContext) = ReminderPickerView(context)
  @ReactProp(name = "kind") fun setKind(view: ReminderPickerView, value: String?) { view.kind = value ?: "date" }
  @ReactProp(name = "value") fun setValue(view: ReminderPickerView, value: String?) { view.value = value ?: "" }
  @ReactProp(name = "dark") fun setDark(view: ReminderPickerView, value: Boolean) { view.dark = value }
  override fun onAfterUpdateTransaction(view: ReminderPickerView) { super.onAfterUpdateTransaction(view); view.updatePicker() }
  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf("topChange" to mapOf("registrationName" to "onChange"))
}
