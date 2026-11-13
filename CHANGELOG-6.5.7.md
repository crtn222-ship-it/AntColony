# 6.5.7 — الهجرة لـ Unity Ads SDK 4.21 (API الجديد) 🎬 (13 نوفمبر 2026)

## لماذا الإعلانات لم تعمل يومين؟
- التوثيق الرسمي الحالي (4.21.0) غيّر الـ API كلياً: `UnityAds.initialize/load/show`
  الثابتة صارت deprecated ومجدولة حذفها في 5.0، و`MetaData` (اللي كنا نضبط بها COPPA)
  deprecated من 4.19 — أي كودنا القديم (SDK 4.12) يعمل ضد بروتوكول جديد، وصفحة
  الأخطاء تذكر صراحة: "An outdated SDK is used against a newer protocol".
- أيضاً: الموافقة/الخصوصية صارت إجبارية قبل التهيئة، والإعلانات تنتهي صلاحيتها
  بعد التحميل إن لم تُعرض (كانت عندنا تُطلب مرة واحدة وتبقى معلقة).

## الجديد (حسب التوثيق حرفياً)
- `unity-ads:4.21.0` + Kotlin 2.1.20 (متطلب التوثيق: Kotlin 2.1.x وcompileSdk 33+).
- التهيئة: `InitializationConfiguration.Builder(GAME_ID).withTestMode(true).build()`
  + `UnityAds.initialize(config) { error -> }` مع `@OptIn(UnityAdsExperimental)`.
- الخصوصية (لعبة أطفال): `UnityAds.nonBehavioral = true` قبل التهيئة بدل `MetaData`
  المحذوفة — إعلانات سياقية فقط.
- التحميل: `RewardedAd.load(LoadConfiguration.Builder(PLACEMENT).build()) { ad, error -> }`
  + معالجة انتهاء الصلاحية `onAdExpired` (إعادة تحميل تلقائية).
- العرض: `ad.show(ShowConfiguration.Builder().build(), RewardedShowListener)`
  والمكافأة تُصرف في `onRewarded` فقط (بلا ازدواج مع onCompleted).
- الأخطاء الآن مرقمة `[code] message` وتظهر على زر الإعلان باللعبة للتشخيص.

## للمستخدم (مهم)
1. ابنِ هذه الحزمة بتيرموكس (ستحمّل SDK 4.21 + Kotlin 2.1 أول مرة — تأخذ وقتاً).
2. اترك `UNITY_TEST_MODE = true` حتى تشتغل الإعلانات التجريبية فوراً.
3. بلوحة Unity: سجّل جهازك كـ Test Device + فعّل Force test mode ON (احتياط ضد fraud flag).
4. قبل نسخة المتجر: اقلب TEST_MODE لـ false.
