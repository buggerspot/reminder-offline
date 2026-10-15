package com.buggerspot.reminderoffline

import android.app.*
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.content.*
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.IBinder
import androidx.core.content.ContextCompat
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import com.facebook.react.BaseReactPackage
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.*
import java.util.concurrent.Executors

/** Persisted series with a single earliest-deadline alarm; avoids Android's per-app alarm limit. */
object ReminderEngine {
  private fun prefs(c: Context) = c.getSharedPreferences("offline-reminder-alarms-v2", Context.MODE_PRIVATE)
  fun records(c: Context): Map<String, JSONObject> = prefs(c).all.filterKeys { it.startsWith("r:") }.mapValues { JSONObject(it.value as String) }
  fun exact(c: Context): Boolean = Build.VERSION.SDK_INT < 31 || (c.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
  private fun pending(c: Context, id: String): PendingIntent = PendingIntent.getBroadcast(c, 0,
    Intent(c, ReminderReceiver::class.java).setAction("REMINDER_FIRE").setData(Uri.parse("offline-reminder://alarm/${Uri.encode(id)}")).putExtra("id", id),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  fun occurs(r: JSONObject, date: LocalDate): Boolean {
    val start = LocalDate.parse(r.getString("date"))
    val end = r.optString("repeatUntil")
    if (r.optBoolean("completed") || date < start || (end.isNotEmpty() && date > LocalDate.parse(end))) return false
    val completed = r.optJSONArray("completedDates") ?: JSONArray()
    if ((0 until completed.length()).any { completed.optString(it) == date.toString() }) return false
    return when (r.optString("repeat", "none")) {
      "daily" -> true
      "weekly" -> { val days = r.optJSONArray("weekdays"); val day = date.dayOfWeek.value % 7
        if (days == null || days.length() == 0) day == start.dayOfWeek.value % 7 else (0 until days.length()).any { days.optInt(it) == day } }
      "monthly" -> date.dayOfMonth == r.optInt("monthDay", start.dayOfMonth)
      "yearly" -> date.month == start.month && date.dayOfMonth == start.dayOfMonth
      else -> date == start
    }
  }
  fun next(r: JSONObject, after: Instant = Instant.now()): ZonedDateTime? {
    if (r.optBoolean("completed")) return null
    val zone = ZoneId.systemDefault()
    var day = after.atZone(zone).toLocalDate().coerceAtLeast(LocalDate.parse(r.getString("date")))
    val time = LocalTime.parse(r.getString("time"))
    val end = r.optString("repeatUntil")
    val repeatType = r.optString("repeat","none")
    if (repeatType == "monthly" || repeatType == "yearly") {
      val start=LocalDate.parse(r.getString("date"))
      val requestedDay=if(repeatType == "monthly") r.optInt("monthDay",start.dayOfMonth) else start.dayOfMonth
      var month=if(repeatType == "monthly") YearMonth.from(day) else YearMonth.of(day.year,start.monthValue)
      repeat(100) {
        if(requestedDay <= month.lengthOfMonth()) {
          val candidate=month.atDay(requestedDay)
          if(end.isNotEmpty() && candidate > LocalDate.parse(end)) return null
          val target=candidate.atTime(time).atZone(zone)
          if(occurs(r,candidate) && target.toInstant() > after) return target
        }
        month=if(repeatType == "monthly") month.plusMonths(1) else month.plusYears(1)
      }
      return null
    }
    repeat(2923) {
      if (end.isNotEmpty() && day > LocalDate.parse(end)) return null
      // java.time resolves DST gaps forward and chooses the earlier offset in overlaps.
      val target = day.atTime(time).atZone(zone)
      if (occurs(r, day) && target.toInstant() > after) return target
      if (r.optString("repeat", "none") == "none" && day >= LocalDate.parse(r.getString("date"))) return null
      day = day.plusDays(1)
    }
    return null
  }
  fun schedule(c: Context, r: JSONObject) {
    val target = next(r)
    r.remove("scheduledAt"); r.remove("scheduledDate")
    if (target != null) r.put("scheduledDate", target.toLocalDate().toString()).put("scheduledAt", target.toInstant().toEpochMilli())
    prefs(c).edit().putString("r:${r.getString("id")}", r.toString()).apply()
  }
  // Match the Missed tab: one row per series, including ended series.
  fun missed(r: JSONObject, now: ZonedDateTime): Boolean {
    if (r.optBoolean("completed")) return false
    val today = now.toLocalDate()
    val time = LocalTime.parse(r.getString("time"))
    if (r.optString("repeat", "none") == "none") return LocalDate.parse(r.getString("date")).atTime(time).atZone(now.zone).toInstant() < now.toInstant()
    if (occurs(r, today)) return today.atTime(time).atZone(now.zone).toInstant() < now.toInstant()
    if (next(r, now.toInstant()) != null) return false
    var day = r.optString("repeatUntil").takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it).coerceAtMost(today) } ?: today
    val start = LocalDate.parse(r.getString("date"))
    repeat(2923) {
      if (day < start) return false
      if (occurs(r, day) && day.atTime(time).atZone(now.zone).toInstant() <= now.toInstant()) return true
      day = day.minusDays(1)
    }
    return false
  }
  private fun dailyPending(c: Context) = PendingIntent.getBroadcast(c, 0,
    Intent(c, ReminderReceiver::class.java).setAction("REMINDER_MISSED_DAILY"),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun armDaily(c: Context) {
    val now = ZonedDateTime.now()
    var target = now.toLocalDate().atTime(6, 0).atZone(now.zone)
    if (target <= now) target = target.toLocalDate().plusDays(1).atTime(6, 0).atZone(now.zone)
    val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val operation = dailyPending(c)
    try {
      if (exact(c)) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.toInstant().toEpochMilli(), operation)
      else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.toInstant().toEpochMilli(), operation)
    } catch (_: SecurityException) { manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target.toInstant().toEpochMilli(), operation) }
  }
  fun branded(builder: NotificationCompat.Builder, c: Context): NotificationCompat.Builder {
    val size = (64 * c.resources.displayMetrics.density).toInt().coerceAtLeast(64)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawCircle(size / 2f, size / 2f, size / 2f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#2DD4BF") })
    c.getDrawable(R.drawable.ic_reminder_notification)?.mutate()?.let {
      it.setTint(Color.WHITE)
      it.setBounds(size / 4, size / 4, size * 3 / 4, size * 3 / 4)
      it.draw(canvas)
    }
    return builder.setSmallIcon(R.drawable.ic_reminder_notification).setColor(Color.parseColor("#14B8A6")).setLargeIcon(bitmap)
  }
  @Synchronized fun dailyMissed(c: Context) {
    try {
      val now = ZonedDateTime.now()
      val today = now.toLocalDate().toString()
      if (prefs(c).getString("dailyReported", "") == today) return
      val count = records(c).values.count { missed(it, now) }
      val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (count == 0) { manager.cancel("missed-summary", 0); return }
      val channel = "offline-reminder-missed-v1"
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(channel, "Missed reminders", NotificationManager.IMPORTANCE_DEFAULT).apply { setSound(null, null) })
      val open = PendingIntent.getActivity(c, 0, c.packageManager.getLaunchIntentForPackage(c.packageName)!!, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val body = if (count == 1) "You have 1 missed reminder. Check it or mark it as complete." else "You have $count missed reminders. Check them or mark them as complete."
      val notification = branded(NotificationCompat.Builder(c, channel), c).setContentTitle("Missed reminders").setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setSubText("Offline Reminder").setContentIntent(open)
        .setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_REMINDER).build()
      try {
        manager.notify("missed-summary", 0, notification)
        prefs(c).edit().putString("dailyReported", today).apply()
      } catch (_: SecurityException) { /* Existing permission banner handles this. */ }
    } finally { armDaily(c) }
  }
  private fun arm(c: Context) {
    armDaily(c)
    val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val operation = pending(c,"next")
    manager.cancel(operation)
    val millis = records(c).values.map {it.optLong("scheduledAt",Long.MAX_VALUE)}.minOrNull() ?: return
    if (millis == Long.MAX_VALUE) return
    try {
      if (exact(c)) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, operation)
      else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, operation)
    } catch (_: SecurityException) { manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, operation) }
  }
  @Synchronized fun sync(c: Context, raw: String, sound: Boolean) {
    val incoming = JSONArray(raw)
    val previous = records(c)
    val retained = mutableSetOf<String>()
    for (i in 0 until incoming.length()) {
      val r = incoming.getJSONObject(i)
      val key = "r:${r.getString("id")}"; retained.add(key)
      r.remove("notificationId"); r.put("soundEnabled", sound)
      val old = previous[key]
      if (old != null) {
        val changedSchedule = old.optString("date") != r.optString("date") || old.optString("time") != r.optString("time") || old.optString("repeat") != r.optString("repeat") || old.optString("weekdays") != r.optString("weekdays") || old.optInt("monthDay") != r.optInt("monthDay")
        r.put("lastDelivered", if (changedSchedule) "" else old.optString("lastDelivered"))
        // Merge native actions until JS acknowledges them, preventing a foreground race.
        val completed = r.optJSONArray("completedDates") ?: JSONArray()
        val oldDates = old.optJSONArray("completedDates") ?: JSONArray()
        val knownDates=(0 until completed.length()).map {completed.optString(it)}.toMutableSet()
        val pendingActions = JSONArray(prefs(c).getString("actions", "[]"))
        for (j in 0 until pendingActions.length()) {
          val action = pendingActions.getJSONObject(j)
          val actionDate = action.optString("date")
          if (action.optString("id") == r.getString("id") && knownDates.add(actionDate)) completed.put(actionDate)
        }
        r.put("completedDates", completed)
        if (old.optBoolean("completed") && prefs(c).getString("actions", "[]")!!.contains(r.getString("id"))) r.put("completed", true)
        val normalized = JSONObject(old.toString()).apply { remove("scheduledDate"); remove("scheduledAt") }
        if (normalized.toString() == r.toString() && old.optLong("scheduledAt") > System.currentTimeMillis()) continue
        if (r.optBoolean("completed") || oldDates.toString() != completed.toString()) {
          ReminderPlaybackService.stop(c, r.getString("id"))
          (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ReminderPlaybackService.notificationId(r.getString("id")))
        }
      }
      prefs(c).edit().putString(key, r.toString()).apply()
      schedule(c, r)
    }
    previous.keys.filter { it !in retained }.forEach { key ->
      val id = key.removePrefix("r:")
      ReminderPlaybackService.stop(c,id)
      (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ReminderPlaybackService.notificationId(id))
      prefs(c).edit().remove(key).apply()
    }
    arm(c)
  }
  @Synchronized fun restore(c: Context) { records(c).values.forEach { try { schedule(c, it) } catch (e: Exception) {android.util.Log.w("OfflineReminder", "Cannot restore alarm", e)} };arm(c) }
  fun soundUri(c: Context, r: JSONObject): Uri? {
    if (!r.optBoolean("soundEnabled", true)) return null
    val raw = r.optString("soundUri")
    if (raw.isNotEmpty() && raw != "null") {
      val file = File(Uri.parse(raw).path ?: "")
      if (file.exists() && file.canonicalPath.startsWith(c.filesDir.canonicalPath + File.separator)) {
        val uri = FileProvider.getUriForFile(c, "${c.packageName}.remindersounds", file)
        try {
          c.grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
          c.grantUriPermission("android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: SecurityException) { return Uri.parse("android.resource://${c.packageName}/raw/reminder") }
        return uri
      }
    }
    val name = when(r.optString("soundId")) { "gentle" -> "gentle"; "bright" -> "bright"; else -> "reminder" }
    return Uri.parse("android.resource://${c.packageName}/raw/$name")
  }
  @Synchronized fun fireDue(c: Context) {
    val now=System.currentTimeMillis()
    records(c).values.filter {it.has("scheduledAt") && it.optLong("scheduledAt") <= now + 500}.forEach {r ->
      try {
        if (r.optString("repeat","none") != "none" && r.optString("scheduledDate") != LocalDate.now().toString()) schedule(c,r)
        else fire(c,r.getString("id"))
      } catch(e:Exception) {android.util.Log.w("OfflineReminder","Notification delivery failed",e);schedule(c,r)}
    }
    arm(c)
  }
  private fun fire(c: Context, id: String) {
    val raw = prefs(c).getString("r:$id", null) ?: return
    val r = JSONObject(raw)
    val date = r.optString("scheduledDate")
    if (date.isEmpty() || r.optBoolean("completed")) return
    if (r.optLong("scheduledAt") > System.currentTimeMillis() + 1000) return
    if (r.optString("lastDelivered") == date || !occurs(r, LocalDate.parse(date))) { schedule(c,r); return }
    r.put("lastDelivered", date)
    prefs(c).edit().putString("r:$id", r.toString()).commit()
    val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val uri = soundUri(c,r)
    val soundId = if (uri == null) "silent" else if (r.optString("soundId").isNotEmpty() && r.optString("soundId") != "null") r.optString("soundId") else "default"
    val channel = "offline-reminder-$soundId-v3"
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(channel, "Offline Reminder · ${if (soundId == "silent") "Silent" else "Reminders"}", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(null, null); enableVibration(true)
    })
    val launch = c.packageManager.getLaunchIntentForPackage(c.packageName)!!.putExtra("reminderId",id)
    val open = PendingIntent.getActivity(c, id.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val complete = PendingIntent.getBroadcast(c, 0, Intent(c,ReminderReceiver::class.java).setAction("REMINDER_COMPLETE").setData(Uri.parse("offline-reminder://complete/${Uri.encode(id)}/$date")).putExtra("id",id).putExtra("date",date), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val clear = PendingIntent.getBroadcast(c, 0, Intent(c,ReminderReceiver::class.java).setAction("REMINDER_CLEAR").setData(Uri.parse("offline-reminder://clear/${Uri.encode(id)}")).putExtra("id",id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = branded(NotificationCompat.Builder(c,channel), c).setOnlyAlertOnce(true).setSound(null).setVibrate(longArrayOf(0,250,150,250)).setSmallIcon(R.drawable.ic_reminder_notification).setContentTitle(r.getString("title")).setContentText(r.optString("description").ifEmpty {"It is time for your reminder."}).setSubText("Offline Reminder").setContentIntent(open).setAutoCancel(false).setCategory(NotificationCompat.CATEGORY_REMINDER).setPriority(NotificationCompat.PRIORITY_HIGH).setDeleteIntent(clear).addAction(0,"Mark complete",complete).addAction(0,"Clear",clear).build()
    try {manager.notify(ReminderPlaybackService.notificationId(id),notification)} catch (_: SecurityException) { /* permission banner handles this */ }
    // Playback owns audio; the notification channel stays silent to avoid overlap.
    val permitted = Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(channel)?.let { it.importance >= NotificationManager.IMPORTANCE_DEFAULT } == true
    if (uri != null && permitted && androidx.core.app.NotificationManagerCompat.from(c).areNotificationsEnabled() && manager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALL) {
      try {
        ContextCompat.startForegroundService(c, Intent(c, ReminderPlaybackService::class.java).putExtra("id",id).putExtra("uri",uri.toString()).putExtra("trigger","$date/${r.getString("time")}").putExtra("notification",notification))
      } catch(e:Exception) {android.util.Log.w("OfflineReminder","Background playback unavailable",e)}
    }
    // Schedule the next occurrence even when this one is never completed.
    schedule(c,r)
  }
  @Synchronized fun complete(c: Context,id: String,date: String) {
    val raw = prefs(c).getString("r:$id",null) ?: return
    val r = JSONObject(raw)
    if (r.optString("repeat","none") == "none") r.put("completed",true)
    else { val dates = r.optJSONArray("completedDates") ?: JSONArray(); if (!(0 until dates.length()).any {dates.optString(it) == date}) dates.put(date); r.put("completedDates",dates) }
    val actions = JSONArray(prefs(c).getString("actions","[]")); actions.put(JSONObject().put("id",id).put("date",date))
    prefs(c).edit().putString("actions",actions.toString()).putString("r:$id",r.toString()).commit()
    clear(c,id)
    schedule(c,r)
    arm(c)
  }
  fun clear(c: Context, id: String) {
    ReminderPlaybackService.stop(c,id)
    (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ReminderPlaybackService.notificationId(id))
  }
  @Synchronized fun takeCompletions(c: Context): String {
    val value = prefs(c).getString("actions","[]")!!
    // Acknowledge separately after JS persistence so a crash cannot lose completions.
    return value
  }
  @Synchronized fun acknowledge(c: Context,raw: String) {
    val acknowledged = JSONArray(raw)
    val actions = JSONArray(prefs(c).getString("actions","[]")); val remaining = JSONArray()
    for(i in 0 until actions.length()) {val action=actions.getJSONObject(i); if (!(0 until acknowledged.length()).any {acknowledged.getJSONObject(it).toString() == action.toString()}) remaining.put(action)}
    prefs(c).edit().putString("actions",remaining.toString()).commit()
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context,intent: Intent) {
    if(intent.action == Intent.ACTION_TIMEZONE_CHANGED) java.util.TimeZone.setDefault(null)
    val result=goAsync()
    executor.execute {try {when(intent.action) {
      "REMINDER_FIRE" -> ReminderEngine.fireDue(context)
      "REMINDER_MISSED_DAILY" -> ReminderEngine.dailyMissed(context)
      "REMINDER_CLEAR" -> ReminderEngine.clear(context,intent.getStringExtra("id") ?: "")
      "REMINDER_COMPLETE" -> ReminderEngine.complete(context,intent.getStringExtra("id") ?: "",intent.getStringExtra("date") ?: "")
      else -> ReminderEngine.restore(context)
    }} finally {result.finish()}}
  }
  companion object {private val executor=Executors.newSingleThreadExecutor()}
}

class ReminderNativeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor=Executors.newSingleThreadExecutor()
  private var player: MediaPlayer?=null
  override fun getName()="ReminderNative"
  private fun task(promise: Promise,block: () -> Any?) {executor.execute {try {promise.resolve(block())} catch(e:Exception) {promise.reject("REMINDER_ERROR",e.message,e)}}}
  @ReactMethod fun clearNotification(id:String,promise:Promise)=task(promise) {ReminderEngine.clear(context,id);true}
  @ReactMethod fun sync(raw:String,sound:Boolean,promise:Promise)=task(promise) {ReminderEngine.sync(context,raw,sound);true}
  @ReactMethod fun takeCompletions(promise:Promise)=task(promise) {ReminderEngine.takeCompletions(context)}
  @ReactMethod fun acknowledgeCompletions(raw:String,promise:Promise)=task(promise) {ReminderEngine.acknowledge(context,raw);true}
  @ReactMethod fun takeOpenReminder(promise:Promise) {
    context.runOnUiQueueThread {val intent=context.currentActivity?.intent;val id=intent?.getStringExtra("reminderId");intent?.removeExtra("reminderId");promise.resolve(id)}
  }
  @ReactMethod fun status(promise:Promise)=task(promise) { Arguments.createMap().apply {putBoolean("exact",ReminderEngine.exact(context))} }
  @ReactMethod fun chooseDate(initial:String,promise:Promise) {
    context.runOnUiQueueThread {try {
      val activity=context.currentActivity ?: throw IllegalStateException("Open the app to choose a date.")
      val date=LocalDate.parse(initial)
      DatePickerDialog(activity,{_,year,month,day -> promise.resolve(LocalDate.of(year,month+1,day).toString())},date.year,date.monthValue-1,date.dayOfMonth).apply {setOnCancelListener {promise.resolve(null)};show()}
    } catch(e:Exception) {promise.reject("DATE_PICKER",e.message,e)}}
  }
  @ReactMethod fun chooseTime(initial:String,promise:Promise) {
    context.runOnUiQueueThread {try {
      val activity=context.currentActivity ?: throw IllegalStateException("Open the app to choose a time.")
      val time=LocalTime.parse(initial)
      TimePickerDialog(activity,{_,hour,minute -> promise.resolve(String.format(java.util.Locale.ROOT,"%02d:%02d",hour,minute))},time.hour,time.minute,android.text.format.DateFormat.is24HourFormat(activity)).apply {setOnCancelListener {promise.resolve(null)};show()}
    } catch(e:Exception) {promise.reject("TIME_PICKER",e.message,e)}}
  }
  @ReactMethod fun openSettings(kind:String,promise:Promise)=task(promise) {
    val intent=when(kind) {
      "alarms" -> if(Build.VERSION.SDK_INT >= 31) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:${context.packageName}")) else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${context.packageName}"))
      "notifications" -> if(Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,context.packageName) else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${context.packageName}"))
      else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:${context.packageName}"))
    }
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));true
  }
  private fun audio(uri:String):MediaPlayer {
    val file=File(Uri.parse(uri).path ?: "")
    require(file.exists() && file.canonicalPath.startsWith(context.filesDir.canonicalPath + File.separator)) {"Audio file is missing or inaccessible."}
    return MediaPlayer().apply {try {setDataSource(context,Uri.parse(uri));setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build());prepare()} catch(e:Exception) {release();throw e}}
  }
  @ReactMethod fun previewBuiltIn(name:String,promise:Promise)=task(promise) {
    require(name in listOf("reminder","gentle","bright"))
    player?.release()
    player=MediaPlayer.create(context,context.resources.getIdentifier(name,"raw",context.packageName)).apply {setOnCompletionListener {it.release();player=null};start()};true
  }
  @ReactMethod fun validateAudio(uri:String,promise:Promise)=task(promise) {audio(uri).release();true}
  @ReactMethod fun preview(uri:String,promise:Promise)=task(promise) {player?.release();player=audio(uri).apply {setOnCompletionListener {it.release();player=null};start()};true}
  @ReactMethod fun stopPreview() {executor.execute {player?.release();player=null}}
  @ReactMethod fun removeSoundChannel(id:String,promise:Promise)=task(promise) {if(Build.VERSION.SDK_INT >= 26) (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).deleteNotificationChannel("offline-reminder-$id-v2");true}
  override fun invalidate() {executor.execute {player?.release();player=null};executor.shutdown();super.invalidate()}
}
class ReminderNativePackage : BaseReactPackage() {
  override fun getModule(name:String,reactContext:ReactApplicationContext):NativeModule? = if(name == "ReminderNative") ReminderNativeModule(reactContext) else null
  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {mapOf("ReminderNative" to ReactModuleInfo("ReminderNative",ReminderNativeModule::class.java.name,false,false,false,false))}
  override fun createViewManagers(reactContext:ReactApplicationContext):List<ViewManager<*,*>> = emptyList()
}

/** Exists only while delivered reminders are ringing; scheduling never keeps a service alive. */
class ReminderPlaybackService : Service() {
  private val players = mutableMapOf<String, MediaPlayer>()
  private var foregroundId = 0
  private val notifications = mutableMapOf<String, Notification>()
  private val handler = android.os.Handler(android.os.Looper.getMainLooper())
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onCreate() { super.onCreate(); instance = this }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "CLEAR_ALL") {
      players.keys.toList().forEach { ReminderEngine.clear(this,it) }
      stopSelf()
      return START_NOT_STICKY
    }
    val id = intent?.getStringExtra("id") ?: run {stopSelf(); return START_NOT_STICKY}
    @Suppress("DEPRECATION")
    val notification = intent.getParcelableExtra<Notification>("notification") ?: run { stopSelf(); return START_NOT_STICKY }
    if (foregroundId != 0 && foregroundId != notificationId(id)) stopForeground(STOP_FOREGROUND_DETACH)
    notifications[id] = notification
    foregroundId = notificationId(id)
    if (Build.VERSION.SDK_INT >= 29) startForeground(foregroundId,notification,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK) else startForeground(foregroundId,notification)
    val history = getSharedPreferences("reminder-playback-history", Context.MODE_PRIVATE)
    val trigger = intent.getStringExtra("trigger") ?: ""
    if (history.getString(id,null) == trigger) {
      if (players.isEmpty()) { stopForeground(STOP_FOREGROUND_DETACH); stopSelf() }
      return START_NOT_STICKY
    }
    history.edit().putString(id,trigger).commit()
    players.remove(id)?.release()
    try {
      val player = MediaPlayer()
      players[id] = player
      player.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
      player.setDataSource(this,Uri.parse(intent.getStringExtra("uri")))
      player.isLooping = false
      player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK)
      player.setOnCompletionListener { if (players[id] === it) remove(id) }
      player.setOnErrorListener { value,_,_ -> if (players[id] === value) remove(id); true }
      player.setOnPreparedListener {
        if (players[id] === it) {
          it.start()
          handler.postDelayed({ if (players[id] === it) remove(id) },30_000)
        }
      }
      player.prepareAsync()
    } catch(e:Exception) { android.util.Log.w("OfflineReminder","Cannot play reminder sound",e); remove(id) }
    return START_NOT_STICKY
  }
  private fun remove(id:String) {
    players.remove(id)?.release()
    notifications.remove(id)
    if (players.isNotEmpty() && foregroundId == notificationId(id)) {
      val other = players.keys.first()
      stopForeground(STOP_FOREGROUND_DETACH)
      foregroundId = notificationId(other)
      val notification = notifications.getValue(other)
      if (Build.VERSION.SDK_INT >= 29) startForeground(foregroundId, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK) else startForeground(foregroundId, notification)
    }
    if (players.isEmpty()) {stopForeground(STOP_FOREGROUND_DETACH);stopSelf()}
  }
  override fun onDestroy() {stopForeground(STOP_FOREGROUND_DETACH);handler.removeCallbacksAndMessages(null);players.values.forEach {it.release()};players.clear();instance=null;super.onDestroy()}
  companion object {
    fun notificationId(id: String): Int = ("reminder:$id".hashCode() and 0x7fffffff).coerceAtLeast(1)
    @Volatile private var instance: ReminderPlaybackService? = null
    fun stop(c:Context,id:String) {android.os.Handler(android.os.Looper.getMainLooper()).post {instance?.remove(id)}}
  }
}
