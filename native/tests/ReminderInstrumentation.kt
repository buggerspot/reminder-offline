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
        var delivered = manager.activeNotifications.first {it.id == ReminderPlaybackService.notificationId("persistence-validation")}
        check(delivered.notification.flags and android.app.Notification.FLAG_AUTO_CANCEL == 0) {"Opening must not auto-cancel"}
        ReminderEngine.sync(targetContext,"[$record]",true)
        check(manager.activeNotifications.any {it.id == ReminderPlaybackService.notificationId("persistence-validation")}) {"Foreground sync dismissed a delivered reminder"}
        check(manager.activeNotifications.none {it.id == 91842}) {"Separate playback notification must not be displayed"}
        delivered.notification.actions.first {it.title.toString() == "Clear"}.actionIntent.send()
        Thread.sleep(1000)
        check(manager.activeNotifications.none {it.id == ReminderPlaybackService.notificationId("persistence-validation") || it.id == 91842}) {"Explicit clear did not stop playback and notification"}
        ReminderEngine.sync(targetContext,"[]",true)
        result.putString("persistence","Notification persists through foreground sync; explicit clear stops playback and dismisses it.")
      }
      if (arguments.getString("mode")=="playback") {
        check(targetContext.packageName.endsWith(".validation"))
        val id="playback-"+System.currentTimeMillis()
        val file=java.io.File(java.io.File(targetContext.filesDir,"sounds").apply {mkdirs()},"validation-long.wav")
        val samples=8000*40
        val wav=java.nio.ByteBuffer.allocate(44+samples*2).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        wav.put("RIFF".toByteArray()).putInt(36+samples*2).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(8000).putInt(16000).putShort(2).putShort(16).put("data".toByteArray()).putInt(samples*2)
        repeat(samples) {wav.putShort((500*kotlin.math.sin(it*2*Math.PI*440/8000)).toInt().toShort())}
        file.writeBytes(wav.array())
        val record=JSONObject(base.toString()).put("id",id).put("repeat","none").put("soundUri",android.net.Uri.fromFile(file).toString()).put("soundId","validation-long").put("completedDates",org.json.JSONArray())
        val manager=targetContext.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        val store=targetContext.getSharedPreferences("offline-reminder-alarms-v2",android.content.Context.MODE_PRIVATE)
        fun forceDelivery() {
          val due=JSONObject(store.getString("r:$id",null)!!).put("scheduledDate",LocalDate.now().toString()).put("scheduledAt",System.currentTimeMillis()-1000)
          store.edit().putString("r:$id",due.toString()).commit();ReminderEngine.fireDue(targetContext)
        }
        fun player():android.media.MediaPlayer? {
          var value:android.media.MediaPlayer?=null
          runOnMainSync {
            val service=ReminderPlaybackService::class.java.getDeclaredField("instance").apply {isAccessible=true}.get(null)
            if(service!=null) value=(ReminderPlaybackService::class.java.getDeclaredField("players").apply {isAccessible=true}.get(service) as Map<*,*>)[id] as? android.media.MediaPlayer
          }
          return value
        }
        try {
          ReminderEngine.sync(targetContext,"[$record]",true);forceDelivery();Thread.sleep(2000)
          val first=player() ?: error("Long audio did not start")
          check(first.isPlaying && !first.isLooping)
          forceDelivery();ReminderEngine.sync(targetContext,"[$record]",true)
          val notification=manager.activeNotifications.first {it.id==ReminderPlaybackService.notificationId(id)}.notification
          val replay=android.content.Intent(targetContext,ReminderPlaybackService::class.java).putExtra("id",id).putExtra("trigger",LocalDate.now().toString()+"/09:00").putExtra("uri",ReminderEngine.soundUri(targetContext,record).toString()).putExtra("notification",notification)
          androidx.core.content.ContextCompat.startForegroundService(targetContext,replay);Thread.sleep(1500)
          check(player()===first && first.currentPosition>=2500) {"Duplicate delivery restarted audio"}
          check(manager.activeNotifications.none {it.id==91842})
          Thread.sleep(29000)
          check(player()==null) {"Long audio exceeded 30 seconds"}
          check(manager.activeNotifications.any {it.id==ReminderPlaybackService.notificationId(id)}) {"Timeout dismissed reminder"}
          androidx.core.content.ContextCompat.startForegroundService(targetContext,replay);Thread.sleep(1000)
          check(player()==null) {"Finished occurrence restarted audio"}
          val shortWav=wav.array().copyOf(44+16000)
          java.nio.ByteBuffer.wrap(shortWav).order(java.nio.ByteOrder.LITTLE_ENDIAN).putInt(4,36+16000).putInt(40,16000)
          file.writeBytes(shortWav)
          androidx.core.content.ContextCompat.startForegroundService(targetContext,android.content.Intent(replay).putExtra("trigger","short-completion"))
          Thread.sleep(400)
          check(player()?.isPlaying==true) {"New occurrence did not start"}
          Thread.sleep(1800)
          check(player()==null) {"Short audio did not release on completion"}
          check(manager.activeNotifications.any {it.id==ReminderPlaybackService.notificationId(id)})
          ReminderEngine.clear(targetContext,id);Thread.sleep(500)
          check(manager.activeNotifications.none {it.id==ReminderPlaybackService.notificationId(id)})
          result.putString("playback","Duplicate delivery and sync do not restart audio; 40-second file stops at 30 seconds without dismissing reminder; no separate sound notification.")
        } finally {ReminderEngine.sync(targetContext,"[]",true);file.delete()}
      }
      result.putString("stream","Native monthly, DST gap and overlap checks passed.\n")
      finish(-1,result)
    } catch(e:Throwable) {result.putString("stream",e.stackTraceToString());finish(0,result)}
  }
}
