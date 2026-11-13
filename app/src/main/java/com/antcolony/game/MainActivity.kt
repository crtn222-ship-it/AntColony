package com.antcolony.game

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import android.webkit.JavascriptInterface
import com.unity3d.ads.AdExpiredListener
import com.unity3d.ads.InitializationConfiguration
import com.unity3d.ads.InitializationListener
import com.unity3d.ads.LoadConfiguration
import com.unity3d.ads.RewardedAd
import com.unity3d.ads.RewardedShowListener
import com.unity3d.ads.ShowConfiguration
import com.unity3d.ads.ShowFinishState
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsError
import com.unity3d.ads.UnityAdsExperimental
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent

class MainActivity : AppCompatActivity() {

    companion object {
        // ═══════════════════════════════════════════════════════════
        //  اللعبة مضمّنة داخل التطبيق (assets/www) — تعمل أوفلاين
        //  بالكامل ولا تحتاج أي رابط خارجي.
        // ═══════════════════════════════════════════════════════════
        const val GAME_URL = "file:///android_asset/www/index.html"
        // 🎬 Unity Ads — IDs من لوحة تحكم يونيتي (وضع الإنتاج)
        const val UNITY_GAME_ID = "800433668"
        const val UNITY_REWARD_PLACEMENT = "BP_Rewarded_Android"
        const val AD_REWARD_HONEY = 50
        // ⚠️ وضع الاختبار: true يعرض إعلانات تجريبية دائماً (للتطوير فقط — لا تدفع شيئاً).
        // نسخة الإنتاج (المنشورة): يجب أن تكون false — إعلانات حقيقية مدفوعةة.
        const val UNITY_TEST_MODE = false
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: View
    // 🎬 حالة إعلان المكافأة (يُحمَّل مسبقاً ويُعاد تحميله بعد كل عرض)
    private var unityAdReady = false
    private var unityInitState = "starting" // starting | ok | fail
    private var unityLastError = ""
    private val adsHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var fullscreenView: View? = null

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = mutableListOf<Uri>()
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            if (data.clipData != null) {
                for (i in 0 until data.clipData!!.itemCount) {
                    uris.add(data.clipData!!.getItemAt(i).uri)
                }
            } else if (data.data != null) {
                uris.add(data.data!!)
            }
        }
        filePathCallback?.onReceiveValue(uris.toTypedArray())
        filePathCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        webView = WebView(this)
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        errorView = layoutInflater.inflate(R.layout.view_error, root, false).apply {
            visibility = View.GONE
            findViewById<Button>(R.id.retryBtn).setOnClickListener { loadGame() }
        }
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(progressBar, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(errorView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

        // ملء الشاشة الغامر (الأزرار تختفي) + إبقاء الشاشة مضيئة أثناء اللعب
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableImmersive()

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = true
            allowContentAccess = true
            // الحزمة محلية بالكامل (file://) — السماح للوحدات والملفات المحلية فقط
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " AntColonyApp/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                errorView.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?, request: WebResourceRequest?, error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true && !isOnline()) {
                    webView.visibility = View.INVISIBLE
                    errorView.visibility = View.VISIBLE
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                // روابط اللعبة تبقى داخل التطبيق، الباقي يُفتح بالمتصفح
                return if (url.contains("perchance.org") || url.startsWith("about:") || url.startsWith("blob:")) {
                    false
                } else {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    } catch (_: Exception) { }
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                progressBar.progress = newProgress
            }

            // اختيار الملفات (رفع الصور داخل إضافات اللعبة)
            override fun onShowFileChooser(
                view: WebView?, callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    val intent = params?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE)
                    filePicker.launch(intent)
                    true
                } catch (_: Exception) {
                    filePathCallback = null
                    false
                }
            }

            // الفيديو بملء الشاشة
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                fullscreenView = view
                (window.decorView as ViewGroup).addView(view,
                    ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT))
                webView.visibility = View.INVISIBLE
            }

            override fun onHideCustomView() {
                fullscreenView?.let { (window.decorView as ViewGroup).removeView(it) }
                fullscreenView = null
                webView.visibility = View.VISIBLE
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val req = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                    addRequestHeader("User-Agent", userAgent)
                    setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType))
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        URLUtil.guessFileName(url, contentDisposition, mimeType))
                }
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            } catch (_: Exception) { }
        })

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (fullscreenView != null) {
                    webView.webChromeClient?.onHideCustomView()
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // 🎬 جسر إعلانات Unity Ads للعبة (window.UnityAdsBridge)
        webView.addJavascriptInterface(AdsBridge(), "UnityAdsBridge")
        initUnityAds()

        // 📢 جسر الإشعارات المحلية (window.LocalNotify) — تعمل أوفلاين وبلا إذن (targetSdk 32)
        webView.addJavascriptInterface(NotifyBridge(), "LocalNotify")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(NotificationChannel(
                "colony", "أخبار المستعمرة", NotificationManager.IMPORTANCE_DEFAULT))
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadGame()
        }
    }

    // إخفاء أزرار النظام (غامر لاصق): تُسحب وتختفي وحدها، ويُعاد تطبيقه عند رجوع التركيز
    private fun enableImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(
                    android.view.WindowInsets.Type.statusBars() or
                        android.view.WindowInsets.Type.navigationBars()
                )
                it.systemBarsBehavior =
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enableImmersive()
    }

    // ═══════════════════════════════════════════════════
    // 🎬 Unity Ads بالمكافأة (SDK 4.21 — API الجديد): تهيئة + تحميل مسبق + عرض + مكافأة JS
    // ═══════════════════════════════════════════════════
    private var rewardedAd: RewardedAd? = null

    @OptIn(UnityAdsExperimental::class)
    private fun initUnityAds() {
        try {
            // اللعبة تستهدف الأطفال — إعلانات سياقية (غير مخصصة) فقط، قبل التهيئة
            UnityAds.nonBehavioral = true
        } catch (_: Exception) { }
        try {
            val config = InitializationConfiguration.Builder(UNITY_GAME_ID)
                .withTestMode(UNITY_TEST_MODE)
                .build()
            UnityAds.initialize(config) { error ->
                if (error == null) {
                    unityInitState = "ok"
                    runOnUiThread {
                        webView.evaluateJavascript("window.__unityInit='ok'", null)
                    }
                    loadRewarded()
                } else {
                    unityInitState = "fail"
                    unityLastError = "[${error.code}] ${error.message}"
                    val safe = unityLastError.replace("'", "").take(120)
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.__unityInit='fail';window.__unityLoadErr='$safe'", null)
                    }
                    adsHandler.postDelayed({ initUnityAds() }, 15000)
                }
            }
        } catch (_: Exception) {
            adsHandler.postDelayed({ initUnityAds() }, 15000)
        }
    }

    private var loadInFlight = false

    @OptIn(UnityAdsExperimental::class)
    private fun loadRewarded() {
        // التحميل على خيط الواجهة + طلب واحد فقط بالمرة (منع التزاحم)
        runOnUiThread {
            if (unityAdReady || rewardedAd != null || loadInFlight) return@runOnUiThread
            loadInFlight = true
            try {
                val loadConfig = LoadConfiguration.Builder(UNITY_REWARD_PLACEMENT).build()
                RewardedAd.load(loadConfig) { ad, error ->
                    loadInFlight = false
                    if (ad != null) {
                        rewardedAd = ad
                        unityAdReady = true
                        runOnUiThread {
                            webView.evaluateJavascript("window.__unityAdReady=true", null)
                        }
                        ad.onAdExpired = AdExpiredListener { _ ->
                            rewardedAd = null
                            unityAdReady = false
                            loadRewarded()
                        }
                    } else {
                        unityAdReady = false
                        unityLastError = if (error != null) "[${error.code}] ${error.message}" else "load-fail"
                        val safe = unityLastError.replace("'", "").take(120)
                        runOnUiThread {
                            webView.evaluateJavascript("window.__unityLoadErr='$safe'", null)
                        }
                        adsHandler.postDelayed({ loadRewarded() }, 20000)
                    }
                }
            } catch (_: Exception) {
                loadInFlight = false
                adsHandler.postDelayed({ loadRewarded() }, 20000)
            }
        }
    }

    @OptIn(UnityAdsExperimental::class)
    private fun showRewarded() {
        runOnUiThread {
            val ad = rewardedAd
            if (ad == null) {
                try { webView.evaluateJavascript("window.__unityAdFail()", null) } catch (_: Exception) { }
                loadRewarded()
                return@runOnUiThread
            }
            rewardedAd = null
            unityAdReady = false
            try {
                val showConfig = ShowConfiguration.Builder().build()
                ad.show(this@MainActivity, showConfig, object : RewardedShowListener {
                    override fun onStarted(unityAd: RewardedAd) { }
                    override fun onClicked(unityAd: RewardedAd) { }
                    override fun onRewarded(unityAd: RewardedAd) {
                        webView.evaluateJavascript(
                            "window.__unityReward($AD_REWARD_HONEY)", null)
                    }
                    override fun onCompleted(unityAd: RewardedAd, state: ShowFinishState) {
                        // COMPLETED: المكافأة انصرفت بـ onRewarded — SKIPPED: بلا مكافأة
                        loadRewarded()
                    }
                    override fun onFailed(unityAd: RewardedAd, error: UnityAdsError) {
                        webView.evaluateJavascript("window.__unityAdFail()", null)
                        loadRewarded()
                    }
                })
            } catch (_: Exception) {
                webView.evaluateJavascript("window.__unityAdFail()", null)
                loadRewarded()
            }
        }
    }

    inner class AdsBridge {
        @JavascriptInterface
        fun isReady(): Boolean = unityAdReady

        @JavascriptInterface
        fun showRewarded() {
            this@MainActivity.showRewarded()
        }

        // طلب تحميل جديد عند ضغط الزر + حالة للتشخيص: init|ready|error
        @JavascriptInterface
        fun loadAd() {
            adsHandler.post { loadRewarded() }
        }

        @JavascriptInterface
        fun status(): String = "$unityInitState|$unityAdReady|$unityLastError"
    }

    // ═══════════════════════════════════════════════════
    // 📢 إشعارات محلية: جدولة/إلغاء عبر AlarmManager (غير دقيق — بلا إذن)
    // ═══════════════════════════════════════════════════
    inner class NotifyBridge {
        @JavascriptInterface
        fun schedule(title: String, text: String, delaySec: Int, id: Int) {
            try {
                val intent = Intent(this@MainActivity, ColonyPingReceiver::class.java).apply {
                    putExtra("title", title)
                    putExtra("text", text)
                }
                val pi = PendingIntent.getBroadcast(
                    this@MainActivity, id, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + delaySec * 1000L, pi)
            } catch (_: Exception) { }
        }

        @JavascriptInterface
        fun cancel(id: Int) {
            try {
                val pi = PendingIntent.getBroadcast(
                    this@MainActivity, id,
                    Intent(this@MainActivity, ColonyPingReceiver::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                (getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi)
            } catch (_: Exception) { }
        }
    }

    private fun loadGame() {
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(GAME_URL)
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
