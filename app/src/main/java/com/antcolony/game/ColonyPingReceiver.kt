package com.antcolony.game

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

// 📢 مستقبل الإشعارات المحلية — يوقظه AlarmManager حتى لو اللعبة مغلقة
class ColonyPingReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        try {
            val title = i.getStringExtra("title") ?: "🐜 Ant Colony"
            val text = i.getStringExtra("text") ?: ""
            if (text.isEmpty()) return
            val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val open = PendingIntent.getActivity(
                c, 0,
                Intent(c, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val nb = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(c, "colony")
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(c)
            }
            nb.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(open)
                .setAutoCancel(true)
            nm.notify(1000 + (System.currentTimeMillis() % 900).toInt(), nb.build())
        } catch (_: Exception) { }
    }
}
