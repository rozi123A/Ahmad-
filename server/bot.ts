import { Telegraf, Markup } from "telegraf";
import type { Express } from "express";
import { getTelegramUser, upsertTelegramUser, getInactiveUsers } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL;
const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (WEBAPP_URL ? new URL(WEBAPP_URL).origin : undefined);

let isBotStarted = false;

async function sendInactivityReminders(bot: Telegraf, webappUrl: string) {
  try {
    const inactiveUsers = await getInactiveUsers(3, 50);
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
        sent++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        console.warn(`[Bot] Failed to notify user ${user.telegramId}:`, err?.message);
      }
    }
    console.log(`[Bot] Sent inactivity reminders to ${sent}/${inactiveUsers.length} users`);
  } catch (err) {
    console.error("[Bot] Error in sendInactivityReminders:", err);
  }
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

  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 10 && now.getMinutes() === 0) {
      console.log("[Bot] Running daily inactivity check...");
      await sendInactivityReminders(bot, WEBAPP_URL || "");
    }
  }, 60 * 1000);

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    // Extract referral ID from start payload (e.g. /start ref_12345)
    const startPayload = ctx.payload || "";
    let referrerId: string | null = null;
    if (startPayload.startsWith("ref_")) {
      const rid = startPayload.replace("ref_", "");
      if (/^\d+$/.test(rid)) referrerId = rid;
    }

    console.log(`[Bot] New user started bot: ${telegramId} (@${username}) ref=${referrerId || "none"}`);

    try {
      let user = await getTelegramUser(telegramId);
      if (!user) {
        await upsertTelegramUser({
          telegramId,
          username,
          firstName,
          lastName,
          referralCode: "ref_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        });
      }

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\n🎮 العب الآن واربح النقاط!\n🚀 كلما لعبت أكثر ربحت أكثر.\n💰 اجمع النقاط واستبدلها بالجوائز.`;

      if (WEBAPP_URL) {
        // Embed referral ID in URL so the Mini App can read it via ?ref=
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

  const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID || "0");

  bot.command("admin", async (ctx) => {
    if (!ADMIN_TELEGRAM_ID || ctx.from.id !== ADMIN_TELEGRAM_ID) {
      await ctx.reply("❌ هذا الأمر للمشرف فقط.");
      return;
    }
    const ak = process.env.ADMIN_SECRET ? encodeURIComponent(process.env.ADMIN_SECRET) : '';
    const adminUrl = WEBAPP_URL ? `${WEBAPP_URL.replace(/\/+$/, "")}/admin${ak ? '?ak=' + ak : ''}` : null;
    if (adminUrl) {
      await ctx.reply(
        "🛡️ مرحباً يا مشرف! افتح لوحة الإدارة:",
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
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true, allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"] });
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
