# 🚀 دليل نشر RewardSpin على Render

## المتطلبات الأساسية

قبل البدء، تأكد من توفر المتغيرات التالية:

### 1. متغيرات البيئة الإلزامية

| المتغير | الوصف | مثال |
|--------|-------|------|
| **MONGODB_URI** | رابط قاعدة البيانات MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net/rewardspin` |
| **JWT_SECRET** | مفتاح سري لتشفير التوكنات | أي نص عشوائي قوي |
| **TELEGRAM_BOT_TOKEN** | توكن البوت من @BotFather | `123456789:ABCDefGHIjklmnoPQRstuvWXYZ` |
| **ADMIN_TELEGRAM_IDS** | معرفات الأدمن (مفصولة بفاصلة) | `123456789,987654321` |

### 2. متغيرات البيئة الاختيارية

| المتغير | القيمة الافتراضية | الوصف |
|--------|-----------------|-------|
| **ADS_PROVIDER** | `adsgram` | مزود الإعلانات |
| **ADS_API_KEY** | - | مفتاح API الإعلانات |
| **CLIENT_URL** | `https://rewardspin.onrender.com` | رابط الواجهة الأمامية |

## خطوات النشر

### الخطوة 1: إنشاء مشروع جديد على Render

1. اذهب إلى [https://render.com](https://render.com)
2. اضغط على **"New +"** واختر **"Web Service"**
3. اختر **"Deploy an existing Git repository"**
4. اربط مستودع GitHub الخاص بك

### الخطوة 2: إضافة متغيرات البيئة

1. في صفحة إعدادات الخدمة، انتقل إلى **"Environment"**
2. أضف المتغيرات التالية:

```
MONGODB_URI = mongodb+srv://your_username:your_password@your_cluster.mongodb.net/rewardspin
JWT_SECRET = your_secret_key_here
TELEGRAM_BOT_TOKEN = your_bot_token_here
ADMIN_TELEGRAM_IDS = your_telegram_id
ADS_PROVIDER = adsgram
ADS_API_KEY = your_ads_api_key_here
CLIENT_URL = https://your-service-name.onrender.com
NODE_ENV = production
PORT = 5000
NODE_OPTIONS = --max-old-space-size=512
```

### الخطوة 3: التحقق من الإعدادات

تأكد من أن الإعدادات التالية موجودة في صفحة الخدمة:

- **Build Command:** `npm install --legacy-peer-deps && cd client && npm install --legacy-peer-deps && npm run build`
- **Start Command:** `node server/index.js`
- **Node Version:** 18.x أو أعلى

### الخطوة 4: النشر

1. اضغط على **"Deploy"** أو **"Manual Deploy"**
2. انتظر انتهاء عملية البناء (قد تستغرق 5-10 دقائق)
3. تحقق من السجلات (Logs) للتأكد من عدم وجود أخطاء

## استكشاف الأخطاء

### المشكلة: فشل البناء (Build Failed)

**الحل:**
- تحقق من أن جميع متغيرات البيئة الإلزامية موجودة
- تأكد من أن المستودع يحتوي على جميع الملفات المطلوبة
- تحقق من السجلات (Logs) للرسائل التفصيلية

### المشكلة: الخادم لا يبدأ (Server Won't Start)

**الحل:**
- تحقق من أن `MONGODB_URI` صحيح
- تأكد من أن `JWT_SECRET` و `TELEGRAM_BOT_TOKEN` موجودان
- تحقق من السجلات (Logs) للأخطاء المحددة

### المشكلة: الواجهة الأمامية لا تعمل (Frontend Not Loading)

**الحل:**
- تأكد من أن `NODE_ENV` مضبوط على `production`
- تحقق من أن ملف البناء موجود في `client/build`
- امسح ذاكرة التخزين المؤقت (Cache) في المتصفح

## نصائح مهمة

✅ **استخدم متغيرات البيئة:** لا تضع أي بيانات حساسة في الكود مباشرة

✅ **راقب السجلات:** استخدم صفحة "Logs" على Render لتتبع المشاكل

✅ **اختبر محلياً أولاً:** تأكد من أن المشروع يعمل بشكل صحيح على جهازك قبل النشر

✅ **استخدم MongoDB Atlas:** للحصول على قاعدة بيانات موثوقة ومجانية

## الدعم والمساعدة

إذا واجهت مشاكل:

1. تحقق من [توثيق Render](https://render.com/docs)
2. اطلع على السجلات (Logs) في لوحة التحكم
3. تأكد من أن جميع المتغيرات مضبوطة بشكل صحيح

---

**آخر تحديث:** 19 مايو 2026
