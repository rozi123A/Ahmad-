import { Telegraf, Markup } from "telegraf";
import type { Express } from "express";
import fs from "fs";
import path from "path";
import { getTelegramUser, upsertTelegramUser, getInactiveUsers, createTransaction, getTransactions, getSetting, updateLastReminded } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL;
const BOT_USERNAME = process.env.TELEGRAM_BOT || process.env.VITE_BOT_USER_NAME || process.env.BOT_USERNAME || "";

// Minimum points to trigger withdrawal notification
const WITHDRAW_THRESHOLD = 10000;

// Track which users already received the withdrawal notification this session
const notifiedWithdraw = new Set<number>();

// Track which users received the "near withdrawal" notification this session
const notifiedNearWithdraw = new Set<number>();

export async function notifyNearWithdraw(telegramId: number, balance: number): Promise<void> {
  if (!BOT_TOKEN) return;
  if (notifiedNearWithdraw.has(telegramId)) return;

  try {
    const minWithdraw = Number(await getSetting("minWithdraw", 10000));
    const threshold = minWithdraw * 0.8;

    // Only notify when between 80% and 100% of minWithdraw
    if (balance < threshold || balance >= minWithdraw) return;

    notifiedNearWithdraw.add(telegramId);

    const remaining = minWithdraw - balance;
    const webappUrl = WEBAPP_URL || "";

    const bot = new Telegraf(BOT_TOKEN);
    await bot.telegram.sendMessage(
      telegramId,
      `🔥 أنت قريب جداً من السحب!\n\n` +
      `💰 رصيدك: ${balance.toLocaleString()} نقطة\n` +
      `🎯 لم يبق إلا ${remaining.toLocaleString()} نقطة للوصول!\n\n` +
      `العب أكثر واسحب نجومك قريباً ⭐`,
      webappUrl ? {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 العب الآن وأكمل الهدف!", web_app: { url: webappUrl } }]
          ]
        }
      } : undefined
    );
  } catch (err: any) {
    if (err?.response?.error_code !== 403) {
      console.warn(`[Bot] Failed to send near-withdraw notification to ${telegramId}:`, err?.message);
    }
  }
}

export async function notifyWithdrawReady(telegramId: number, balance: number): Promise<void> {
  if (!BOT_TOKEN) return;
  if (notifiedWithdraw.has(telegramId)) return;
  if (balance < WITHDRAW_THRESHOLD) return;

  notifiedWithdraw.add(telegramId);

  try {
    const bot = new Telegraf(BOT_TOKEN);
    const webappUrl = WEBAPP_URL || "";
    await bot.telegram.sendMessage(
      telegramId,
      `💰 رصيدك وصل ${balance.toLocaleString()} نقطة!\n\n` +
      `🎉 يمكنك الآن سحب نقاطك كـ Telegram Stars ⭐\n\n` +
      `اضغط الزر أدناه للسحب الآن 👇`,
      webappUrl ? {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💸 اسحب الآن", web_app: { url: webappUrl } }]
          ]
        }
      } : undefined
    );
  } catch (err: any) {
    if (err?.response?.error_code !== 403) {
      console.warn(`[Bot] Failed to send withdraw notification to ${telegramId}:`, err?.message);
    }
  }
}
function buildRandomCaption(code: string, reward: number, expiresInHours: number, maxUses: number): string {
  const h = expiresInHours;
  const timeLabel = h === 1 ? "1 Hour Only" : `${h} Hours Only`;
  const timeShort = h === 1 ? "1 Hour" : `${h} Hours`;
  const pts = reward.toLocaleString();

  const templates = [
    // 1 — Original style
    `⚡ *New Redeem Code is LIVE!* ⚡\n\n` +
    `🎟 Code: \`${code}\`\n` +
    `🎁 Reward: ${pts} Points\n` +
    `⏳ Valid For: ${timeLabel}\n` +
    `👥 Limited To: ${maxUses} Users\n\n` +
    `🔥 Time is running out — redeem your reward now before the code expires!\n` +
    `🚀 Open the Mini App and claim it instantly 💎`,

    // 2 — Alert style
    `🚨 *EXCLUSIVE CODE DROP* 🚨\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🎫 Code: \`${code}\`\n` +
    `💰 Reward: ${pts} Points\n` +
    `⌛ Active For: ${timeShort}\n` +
    `🎯 Only ${maxUses} Spots Left!\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⚡ First come, first served!\n` +
    `👉 Claim before it's gone 🏆`,

    // 3 — Premium style
    `💎 *PREMIUM CODE JUST DROPPED* 💎\n\n` +
    `🔑 Code: \`${code}\`\n` +
    `🏆 Earn: ${pts} Points\n` +
    `⏱ Valid: ${timeShort}\n` +
    `🎯 Limited: ${maxUses} Users Only\n\n` +
    `🌟 The fastest win — don't sleep on this!\n` +
    `🚀 Open the Mini App and grab your reward 💰`,

    // 4 — Fire style
    `🔥 *HOT CODE ALERT* 🔥\n\n` +
    `🎟 Code: \`${code}\`\n` +
    `💎 Points: ${pts}\n` +
    `⏳ Time Left: ${timeShort}\n` +
    `👥 Max Users: ${maxUses}\n\n` +
    `💥 Snap it before it's gone!\n` +
    `✅ Tap & claim instantly in the Mini App 🚀`,
  ];

  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

export async function postCodeToChannel(code: string, reward: number, expiresInHours: number, maxUses: number): Promise<void> {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN غير موجود — تحقق من متغيرات البيئة");
  const channel = process.env.REQUIRED_CHANNEL;
  if (!channel) throw new Error("REQUIRED_CHANNEL غير موجود — تحقق من متغيرات البيئة");

  const webappUrl = (WEBAPP_URL || "").replace(/\/$/, "");
  const caption = buildRandomCaption(code, reward, expiresInHours, maxUses);

  const miniAppLink = BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?startapp`
    : webappUrl;
  const replyMarkup = miniAppLink
    ? { inline_keyboard: [[{ text: "⚡️ OPEN & CLAIM YOUR REWARD ⚡️", url: miniAppLink }]] }
    : undefined;

  // Try to load the banner image from filesystem (works in both dev & prod)
  const bannerPaths = [
    path.join(process.cwd(), "dist/public/code-banner.png"),
    path.join(process.cwd(), "client/public/code-banner.png"),
  ];
  let bannerBuffer: Buffer | null = null;
  for (const p of bannerPaths) {
    if (fs.existsSync(p)) {
      bannerBuffer = fs.readFileSync(p);
      break;
    }
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);
    let sentMsg: any;
    if (bannerBuffer) {
      // Send photo (buffer) with caption — works without public URL
      sentMsg = await (bot.telegram as any).sendPhoto(
        channel,
        { source: bannerBuffer },
        {
          caption,
          parse_mode: "Markdown",
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }
      );
    } else {
      // Fallback: text-only if image not found
      console.warn("[Bot] code-banner.png not found — sending text-only");
      sentMsg = await (bot.telegram as any).sendMessage(channel, caption, {
        parse_mode: "Markdown",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
    }

    // 📌 تثبيت الرسالة تلقائياً في أعلى القناة
    if (sentMsg?.message_id) {
      try {
        await bot.telegram.pinChatMessage(channel, sentMsg.message_id, { disable_notification: true });
        console.log(`[Bot] Message pinned in channel: ${sentMsg.message_id}`);
      } catch (pinErr: any) {
        console.warn(`[Bot] Could not pin message (check bot is admin with pin permission):`, pinErr?.message);
      }
    }

    console.log(`[Bot] Code posted to channel: ${code}`);
  } catch (err: any) {
    console.error(`[Bot] Failed to post code to channel:`, err?.message);
    throw err;
  }
}

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (WEBAPP_URL ? new URL(WEBAPP_URL).origin : undefined);

let isBotStarted = false;

// Per-user 24h cooldown is handled in getInactiveUsers via lastRemindedAt

async function sendInactivityReminders(bot: Telegraf, webappUrl: string) {
  try {
    const inactiveUsers = await getInactiveUsers(1, 200);
    let sent = 0;
    for (const user of inactiveUsers) {
      try {
        const name = user.firstName || user.username || "صديقي";
        await bot.telegram.sendMessage(
          user.telegramId,
          `👋 مرحباً ${name}!\n\n` +
          `لاحظنا أنك لم تلعب منذ فترة 😔\n\n` +
          `🎁 لديك ${user.spinsLeft} دورة مجانية بانتظارك!\n` +
          `💰 رصيدك الحالي: ${user.balance} نقطة\n\n` +
          `تعال والعب الآن واربح أكثر! 🚀`,
          webappUrl ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 العب الآن!", web_app: { url: webappUrl } }]
              ]
            }
          } : undefined
        );
        await updateLastReminded(user.telegramId);
        sent++;
        await new Promise(r => setTimeout(r, 1200));
      } catch (err: any) {
        // 403 = user blocked bot — skip silently
        if (err?.response?.error_code !== 403) {
          console.warn(`[Bot] Failed to notify user ${user.telegramId}:`, err?.message);
        }
      }
    }
    console.log(`[Bot] Sent inactivity reminders to ${sent}/${inactiveUsers.length} users`);
    // Per-user cooldown already saved via updateLastReminded above
  } catch (err) {
    console.error("[Bot] Error in sendInactivityReminders:", err);
  }
}

function scheduleReminders(bot: Telegraf) {
  const check = async () => {
    try {
      // No global lock — per-user lastRemindedAt (24h cooldown) prevents spam
      console.log("[Bot] Running inactivity reminder check...");
      await sendInactivityReminders(bot, WEBAPP_URL || "");
    } catch (err) {
      console.error("[Bot] scheduleReminders check error:", err);
    }
  };

  // Check every 30 minutes — resilient against restarts and Render free-tier sleep
  setInterval(check, 30 * 60 * 1000);

  // Run 1 minute after startup to let DB settle (reduced from 5 min)
  setTimeout(() => {
    console.log("[Bot] Running startup inactivity check...");
    check();
  }, 60 * 1000);
}

export async function startBot(app?: Express) {
  if (!BOT_TOKEN) {
    console.warn("[Bot] BOT_TOKEN is not set. Bot will not start.");
    return;
  }

  if (isBotStarted) {
    console.warn("[Bot] Bot is already starting or started. Skipping duplicate call.");
    return;
  }
  isBotStarted = true;

  const bot = new Telegraf(BOT_TOKEN);

  scheduleReminders(bot);

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    const startPayload = ctx.payload || "";
    let referrerId: string | null = null;
    if (startPayload.startsWith("ref_")) {
      const rid = startPayload.replace("ref_", "");
      if (/^\d+$/.test(rid)) referrerId = rid;
    }

    console.log(`[Bot] New user started bot: ${telegramId} (@${username}) ref=${referrerId || "none"}`);

    try {
      let user = await getTelegramUser(telegramId);
      const isNewUser = !user;
      if (!user) {
        user = await upsertTelegramUser({
          telegramId,
          username,
          firstName,
          lastName,
          referralCode: "ref_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
          referredBy: referrerId ? parseInt(referrerId) : undefined,
        }) || null;
        await createTransaction({ telegramId, type: "bonus", points: 0, metadata: JSON.stringify({ action: "registration" }) });

        // 🔔 إشعار الأدمن بمستخدم جديد
        const adminId = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;
        if (adminId) {
          const displayName = [firstName, lastName].filter(Boolean).join(" ");
          const usernameStr = username ? ` (@${username})` : "";
          const refStr = referrerId ? `\n👥 جاء عن طريق دعوة` : "";
          const notifMsg = `🆕 مستخدم جديد انضم!\n\n👤 الاسم: ${displayName}${usernameStr}\n🆔 ID: ${telegramId}${refStr}`;
          try { await bot.telegram.sendMessage(adminId, notifMsg); } catch (_) { /* لا تعطّل التسجيل إذا فشل الإشعار */ }
        }
      }

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\n🎮 العب الآن واربح النقاط!\n🚀 كلما لعبت أكثر ربحت أكثر.\n💰 اجمع النقاط واستبدلها بالجوائز.`;

      if (WEBAPP_URL) {
        const appUrl = referrerId
          ? WEBAPP_URL.replace(/\/+$/, "") + "?ref=" + referrerId
          : WEBAPP_URL;

        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.webApp("فتح التطبيق 📱", appUrl)],
            [Markup.button.url("قناة التحديثات 📢", "https://t.me/ads_reward123")],
          ])
        );
      } else {
        await ctx.reply(welcomeMessage + "\n\n(ملاحظة: WEBAPP_URL غير مهيأ حالياً)");
      }
    } catch (error) {
      console.error("[Bot] Error in start command:", error);
      try { await ctx.reply("حدث خطأ أثناء تهيئة حسابك. يرجى المحاولة لاحقاً."); } catch (e) { /* ignore */ }
    }
  });

  const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;

  bot.command("admin", async (ctx) => {
    const ak = process.env.ADMIN_SECRET ? encodeURIComponent(process.env.ADMIN_SECRET) : '';
    const adminUrl = WEBAPP_URL ? `${WEBAPP_URL.replace(/\/+$/, "")}/admin${ak ? '?ak=' + ak : ''}` : null;
    if (adminUrl) {
      await ctx.reply(
        "🛡️ لوحة الإدارة — ستحتاج كلمة المرور إن لم تكن مشرفاً:",
        Markup.inlineKeyboard([
          [Markup.button.webApp("🛡️ فتح لوحة الإدارة", adminUrl)]
        ])
      );
    } else {
      await ctx.reply("⚠️ WEBAPP_URL غير مهيأ.");
    }
  });

  bot.help((ctx) => {
    ctx.reply("استخدم الزر 'فتح التطبيق' للوصول إلى واجهة الكسب الخاصة بك.");
  });

  // ── أوامر الأدمن: رصيد البوت وشحن النجوم ──────────────────────────────

  // /botbalance — يعرض رصيد النجوم الحالي في البوت
  bot.command("botbalance", async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) {
      await ctx.reply("❌ غير مصرح | ID: " + ctx.from?.id + " expected: " + ADMIN_TELEGRAM_ID);
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getStarTransactions?limit=1`);
      const data = (await res.json()) as any;
      if (data.ok) {
        const balance = data.result?.amount ?? 0;
        await ctx.reply(`⭐ رصيد البوت الحالي: ${balance} نجمة\n\nلشحن النجوم استخدم: /topup <عدد النجوم>\nمثال: /topup 100`);
      } else {
        await ctx.reply("❌ فشل جلب الرصيد: " + (data.description || "خطأ غير معروف"));
      }
    } catch (e: any) {
      await ctx.reply("❌ خطأ: " + (e?.message || "تعذّر الاتصال"));
    }
  });

  // /topup <amount> — ينشئ رابط دفع لشحن خزينة البوت من نجوم الأدمن
  bot.command("topup", async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) {
      await ctx.reply("❌ غير مصرح | ID: " + ctx.from?.id + " expected: " + ADMIN_TELEGRAM_ID);
      return;
    }
    const args = ctx.message?.text?.trim().split(/\s+/);
    const amount = parseInt(args?.[1] || "");
    if (!amount || amount < 1) {
      await ctx.reply(
        "⚠️ الاستخدام الصحيح:\n/topup <عدد النجوم>\n\nمثال: /topup 100\nيشحن 100 نجمة من حسابك إلى خزينة البوت."
      );
      return;
    }
    try {
      const invoiceLink = await ctx.telegram.createInvoiceLink({
        title: "شحن خزينة البوت ⭐",
        description: `إيداع ${amount} نجمة في البوت لإرسالها تلقائياً عند الموافقة على طلبات السحب`,
        payload: `admin_topup_${amount}_${Date.now()}`,
        currency: "XTR",
        prices: [{ label: `${amount} نجمة`, amount }],
      });
      await ctx.reply(
        `⭐ لشحن البوت بـ ${amount} نجمة اضغط الرابط أدناه:\n${invoiceLink}\n\n` +
        `✅ بعد الدفع ستُرسل النجوم تلقائياً للمستخدمين عند كل موافقة على سحب.`
      );
    } catch (e: any) {
      await ctx.reply("❌ فشل إنشاء رابط الدفع: " + (e?.message || "خطأ غير معروف"));
    }
  });

  // قبول دفع شحن الخزينة تلقائياً
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // تأكيد نجاح الشحن وإشعار الأدمن
  bot.on("message", async (ctx, next) => {
    const msg = ctx.message as any;
    if (msg?.successful_payment && msg.successful_payment.invoice_payload?.startsWith("admin_topup_")) {
      const stars = msg.successful_payment.total_amount;
      try {
        await ctx.reply(
          `✅ تم شحن البوت بنجاح!\n⭐ المبلغ: ${stars} نجمة\n\nالبوت الآن قادر على إرسال النجوم تلقائياً عند الموافقة على طلبات السحب.`
        );
      } catch (_) {}
      return;
    }
    return next();
  });

  bot.on("chat_member", async (ctx) => {
    try {
      const update = (ctx.update as any).chat_member;
      if (!update) return;
      const wasActive = ["member","administrator","creator"].includes(update.old_chat_member?.status || "");
      const nowLeft = ["left","kicked","banned"].includes(update.new_chat_member?.status || "");
      if (!wasActive || !nowLeft) return;
      const telegramId = update.from.id;
      const chatId = String(update.chat.id);
      const { getTasks, getUserTasks, removeUserTask, getTelegramUser, upsertTelegramUser, createTransaction } = await import("./db");
      const [allTasks, userTasks] = await Promise.all([getTasks(), getUserTasks(telegramId)]);
      for (const task of allTasks) {
        if (task.channelId !== chatId) continue;
        const ut = userTasks.find(u => u.taskId === task.id);
        if (!ut) continue;
        const dbUser = await getTelegramUser(telegramId);
        if (!dbUser) continue;
        const newBal = Math.max(0, (dbUser.balance || 0) - ut.pointsEarned);
        await Promise.all([
          removeUserTask(telegramId, task.id),
          upsertTelegramUser({ telegramId, balance: newBal }),
          createTransaction({ telegramId, type: "task_penalty", points: -ut.pointsEarned, metadata: JSON.stringify({ taskId: task.id }) }),
        ]);
        const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
        await ctx.telegram.sendMessage(telegramId,
          `⚠️ غادرت ${task.name} وتم خصم ${ut.pointsEarned} نقطة من رصيدك!`,
          webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}
        ).catch(() => {});
      }
    } catch (e) { console.error("[Bot] chat_member error:", e); }
  });

  try {
    console.log("[Bot] Clearing existing webhook/polling state to prevent 409...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err: any) {
    console.warn("[Bot] Pre-launch cleanup warning:", err?.message);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && PUBLIC_URL && app) {
    const secretPath = `/telegraf/${bot.secretPathComponent()}`;
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}${secretPath}`;

    try {
      app.use(bot.webhookCallback(secretPath));
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true, allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member", "pre_checkout_query"] });
      console.log(`[Bot] ✅ Webhook mode ENABLED (Anti-409): ${webhookUrl}`);
      return;
    } catch (err) {
      console.error("[Bot] Webhook setup failed, this may cause 409:", err);
    }
  }

  if (!isProduction) {
    console.log("[Bot] Starting in long polling mode (Development)...");
    try {
      await bot.launch({ dropPendingUpdates: true });
      console.log("[Bot] ✅ Telegram bot launched (long polling)");
    } catch (err: any) {
      console.error("[Bot] Polling launch failed:", err?.message);
      isBotStarted = false;
    }
  } else {
    console.error("[Bot] ❌ CRITICAL: Webhook could not be established in production. Polling disabled to prevent 409.");
  }

  const stopBot = (reason: string) => {
    bot.stop(reason);
    isBotStarted = false;
  };
  process.once("SIGINT", () => stopBot("SIGINT"));
  process.once("SIGTERM", () => stopBot("SIGTERM"));
}

// ── إرسال نجوم تلقائياً عبر sendGift (Bot API 8.3+) ──────────────────────
// يعمل مع أي مبلغ بما فيه الحد الأدنى 10 نجوم:
// 1) يحاول المطابقة التامة أولاً (هدايا كبيرة + صغيرة)
// 2) إذا تعذّرت المطابقة التامة يرسل أصغر هدية متاحة ≥ المبلغ المتبقي (فرق بسيط للمستخدم)
export async function sendStarsGift(
  botToken: string,
  telegramId: number,
  starsCount: number
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    // جلب الهدايا المتاحة من تيليغرام
    const giftsRes = await fetch(`https://api.telegram.org/bot${botToken}/getAvailableGifts`);
    const giftsData = (await giftsRes.json()) as any;

    if (!giftsData.ok || !Array.isArray(giftsData.result?.gifts)) {
      return { success: false, sent: 0, error: giftsData.description || 'لا توجد هدايا متاحة' };
    }

    // تصفية هدايا النجوم فقط
    const starGifts: Array<{ id: string; star_count: number }> = giftsData.result.gifts
      .filter((g: any) => typeof g.star_count === 'number' && g.star_count > 0);

    if (starGifts.length === 0) {
      return { success: false, sent: 0, error: 'لا تتوفر هدايا نجوم في المتجر حالياً' };
    }

    // ترتيب تنازلي للخوارزمية الجشعة
    const descGifts = [...starGifts].sort((a, b) => b.star_count - a.star_count);
    // ترتيب تصاعدي للعثور على أصغر هدية تغطي المتبقي
    const ascGifts  = [...starGifts].sort((a, b) => a.star_count - b.star_count);

    let remaining = starsCount;
    let totalSent  = 0;

    // دالة مساعدة لإرسال هدية واحدة
    async function sendOne(giftId: string, giftStars: number): Promise<string | null> {
      const res  = await fetch(`https://api.telegram.org/bot${botToken}/sendGift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: telegramId, gift_id: giftId }),
      });
      const data = (await res.json()) as any;
      return data.ok ? null : (data.description || 'فشل إرسال الهدية — تحقق من رصيد النجوم في البوت');
    }

    // المرحلة 1: خوارزمية جشعة — أكبر هدية أولاً (مطابقة تامة قدر الإمكان)
    for (const gift of descGifts) {
      while (remaining >= gift.star_count) {
        const err = await sendOne(gift.id, gift.star_count);
        if (err) return { success: totalSent > 0, sent: totalSent, error: err };
        totalSent += gift.star_count;
        remaining -= gift.star_count;
      }
    }

    // المرحلة 2: إذا بقي مبلغ لم يُغطَّ (هدايا ≥ remaining غير موجودة بالضبط)
    // → أرسل أصغر هدية متاحة قيمتها ≥ remaining (المستخدم يحصل على الفرق كمكافأة)
    if (remaining > 0) {
      const cover = ascGifts.find(g => g.star_count >= remaining);
      if (cover) {
        const err = await sendOne(cover.id, cover.star_count);
        if (err) return { success: totalSent > 0, sent: totalSent, error: err };
        totalSent += cover.star_count;
        remaining  = 0;
      } else {
        // لا توجد هدية تغطي المتبقي (أي الطلب أصغر من أصغر هدية متاحة وأكبر مما أُرسل)
        if (totalSent === 0) {
          // أرسل أصغر هدية متاحة على الأقل حتى لا يخرج المستخدم بلا شيء
          const smallest = ascGifts[0];
          const err = await sendOne(smallest.id, smallest.star_count);
          if (err) return { success: false, sent: 0, error: err };
          totalSent += smallest.star_count;
          remaining  = 0;
        }
      }
    }

    if (totalSent === 0) {
      return { success: false, sent: 0, error: 'تعذّر إرسال النجوم — لا توجد هدايا مناسبة' };
    }

    return { success: true, sent: totalSent };
  } catch (err: any) {
    return { success: false, sent: 0, error: err?.message || 'خطأ غير متوقع أثناء إرسال النجوم' };
  }
}

