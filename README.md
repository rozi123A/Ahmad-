# 🎰 RewardSpin - Telegram Mini App

تطبيق Telegram Mini App احترافي لكسب النقاط وسحبها كـ Telegram Stars.

## ✨ الميزات

- 🏠 **صفحة ترحيب** - تعرض صورة واسم المستخدم من Telegram
- 💰 **نظام نقاط (pts)** - تحديث فوري بدون إعادة تحميل
- 🎁 **هدية يومية 3D** - 100 pts كل 24 ساعة مع countdown
- 🎰 **عجلة الحظ** - 5 سبينات مجانية يومياً (50-500 pts)
- 📺 **مشاهدة إعلانات** - حد 50 إعلان يومياً مع نظام تحقق
- ⭐ **سحب Stars** - 10000 pts = 10 Telegram Stars
- 🛡️ **لوحة Admin** - إحصائيات، إدارة مستخدمين، broadcast، سحوبات
- 🔒 **نظام أمان** - JWT, Rate Limit, Telegram verification

## 🛠️ التقنيات

- **Backend:** Node.js + Express + MongoDB/Mongoose
- **Frontend:** React + React Router + Framer Motion
- **Bot:** node-telegram-bot-api
- **Ads:** Adsgram (جاهز للتكامل)
- **Design:** Dark Neon Theme, RTL, Mobile First

## 🚀 التشغيل

### متطلبات
- Node.js 18+
- MongoDB
- Telegram Bot Token

### التثبيت

```bash
# تثبيت التبعيات
npm run install-all

# نسخ ملف البيئة
cp .env.example .env
# عدّل القيم في .env

# تشغيل Development
npm run dev

# بناء Client
npm run build

# تشغيل Production
npm start
```

### متغيرات البيئة

| المتغير | الوصف |
|---------|-------|
| PORT | منفذ السيرفر (5000) |
| MONGODB_URI | رابط MongoDB |
| JWT_SECRET | مفتاح JWT |
| TELEGRAM_BOT_TOKEN | توكن البوت |
| ADMIN_TELEGRAM_IDS | IDs الأدمن (مفصولة بفاصلة) |
| ADS_PROVIDER | مزود الإعلانات |
| ADS_API_KEY | مفتاح API الإعلانات |
| CLIENT_URL | رابط الواجهة |

## 📁 هيكل المشروع

```
RewardSpin/
├── server/
│   ├── index.js          # Entry point
│   ├── config/db.js      # MongoDB connection
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── middleware/       # Auth & admin middleware
│   └── services/         # Telegram & Ads services
├── client/
│   ├── public/
│   └── src/
│       ├── pages/        # React pages
│       ├── services/     # API service
│       └── styles/       # CSS (Dark Neon)
├── Dockerfile
├── railway.toml
├── .env.example
└── README.md
```

## 🌐 النشر على Railway/Render

1. أنشئ مشروع جديد
2. اربط المستودع
3. أضف متغيرات البيئة
4. سيتم البناء والنشر تلقائياً

## 📱 إعداد Telegram Mini App

1. أنشئ بوت عبر @BotFather
2. فعّل Mini App وأضف رابط التطبيق
3. أضف التوكن في .env

## 📄 License

MIT
