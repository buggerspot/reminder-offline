package com.buggerspot.reminderoffline

import android.app.Instrumentation
import android.os.Bundle
import org.json.JSONObject
import java.time.*
import java.util.TimeZone

/** Runs only in the androidTest APK; no test hook is shipped in the app. */
class ReminderInstrumentation : Instrumentation() {
  private var arguments=Bundle()
  override fun onCreate(arguments:Bundle?) {super.onCreate(arguments);this.arguments=arguments ?: Bundle();start()}
  override fun onStart() {
    val result=Bundle()
    try {
      val base=JSONObject().put("id","native-validation").put("title","Offline Reminder timing validation").put("date",LocalDate.now().toString()).put("time","09:00").put("repeat","daily").put("completed",false)
      check(ReminderEngine.next(JSONObject(base.toString()).put("date","2026-01-31").put("repeat","monthly").put("monthDay",31), ZonedDateTime.of(2026,2,1,12,0,0,0,ZoneId.systemDefault()).toInstant())?.toLocalDate().toString()=="2026-03-31")
      val original=TimeZone.getDefault()
      try {
        TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"))
        val gap=ReminderEngine.next(JSONObject(base.toString()).put("date","2026-03-01").put("time","02:30"),Instant.parse("2026-03-08T05:00:00Z"))!!
        check(gap.hour==3 && gap.minute==30)
        val overlap=ReminderEngine.next(JSONObject(base.toString()).put("date","2026-11-01").put("time","01:30"),Instant.parse("2026-11-01T04:00:00Z"))!!
        check(overlap.toInstant()==Instant.parse("2026-11-01T05:30:00Z"))
      } finally {TimeZone.setDefault(original)}
      if (arguments.getString("mode")=="alarm") {
        check(targetContext.packageName.endsWith(".validation")) {"Timing tests must use the separate validation installation."}
        val target=ZonedDateTime.now().plusSeconds(30).withNano(0)
        base.put("repeat","none").put("date",target.toLocalDate().toString()).put("time",target.toLocalTime().toString())
        ReminderEngine.sync(targetContext,"[$base]",true)
        result.putString("scheduledAt",target.toInstant().toString())
        result.putBoolean("exact",ReminderEngine.exact(targetContext))
      }
      if (arguments.getString("mode")=="persistent") {
        check(targetContext.packageName.endsWith(".validation"))
        val manager = targetContext.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val record = JSONObject(base.toString()).put("id","persistence-validation").put("repeat","none").put("date",LocalDate.now().toString()).put("completedDates",org.json.JSONArray()).put("soundId",JSONObject.NULL).put("soundUri",JSONObject.NULL)
        ReminderEngine.sync(targetContext,"[$record]",true)
        val store = targetContext.getSharedPreferences("offline-reminder-alarms-v2",android.content.Context.MODE_PRIVATE)
        val due = JSONObject(store.getString("r:persistence-validation",null)!!).put("scheduledDate",LocalDate.now().toString()).put("scheduledAt",System.currentTimeMillis()-1000)
        store.edit().putString("r:persistence-validation",due.toString()).commit()
        ReminderEngine.fireDue(targetContext)
        Thread.sleep(1500)
        var delivered = manager.activeNotifications.first {it.tag == "persistence-validation"}
        check(delivered.notification.flags and android.app.Notification.FLAG_AUTO_CANCEL == 0) {"Opening must not auto-cancel"}
        ReminderEngine.sync(targetContext,"[$record]",true)
        check(manager.activeNotifications.any {it.tag == "persistence-validation"}) {"Foreground sync dismissed a delivered reminder"}
        check(manager.activeNotifications.any {it.id == 91842}) {"Looping audio service did not start"}
        delivered.notification.actions.first {it.title.toString() == "Clear"}.actionIntent.send()
        Thread.sleep(1000)
        check(manager.activeNotifications.none {it.tag == "persistence-validation" || it.id == 91842}) {"Explicit clear did not stop playback and notification"}
        ReminderEngine.sync(targetContext,"[]",true)
        result.putString("persistence","Notification persists through foreground sync; explicit clear stops playback and dismisses it.")
      }
      result.putString("stream","Native monthly, DST gap and overlap checks passed.\n")
      finish(-1,result)
    } catch(e:Throwable) {result.putString("stream",e.stackTraceToString());finish(0,result)}
  }
}
