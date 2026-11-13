# 6.5.2 — Ad button self-prepares the ad

- Tapping the reward button now triggers a fresh ad load and shows
  "preparing" instead of failing when no ad is cached yet.
- Android bridge reports init/load status to the game for self-diagnosis
  (window.__unityInit / __unityLoadErr / status()).
- New ad_loading string in all 9 languages (92 keys total).
- Game stays fully offline; internet is used only to fetch the ad video.
- No notifications used anywhere.
- versionCode 652 — same save key.

# 6.5.2 — زر الاعلان يجهز الاعلان تلقائيا

- الضغط على زر المكافاة يطلب تحميلا جديدا ويعرض "جاري التجهيز"
  بدلا من الفشل عندما لا يوجد اعلان مخزن.
- الجسر يبلغ اللعبة بحالة التهيئة والتحميل للتشخيص الذاتي.
- نص ad_loading باللغات التسع (92 مفتاحا).
- اللعبة تبقى اوفلاين بالكامل؛ الانترنت فقط لجلب فيديو الاعلان.
- لا اشعارات مستخدمة.
- versionCode 652 — نفس مفتاح الحفظ.
