import { randomInt, timingSafeEqual } from "crypto";

function safeCompareSecret(input: string, expected: string): boolean {
  if (!expected || expected.length === 0) return false;
  try {
    const a = Buffer.from(input);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      timingSafeEqual(Buffer.alloc(b.length), b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notifyWithdrawReady, notifyNearWithdraw, postCodeToChannel, sendStarsGift } from "./bot";
import { z } from "zod";
import { getDb, getPool, getTelegramUser, upsertTelegramUser, createTransaction, createWithdrawal, createAdToken, getAdToken, markAdTokenUsed, getSetting, getTransactions, getUserWithdrawals, updateWithdrawalStatus, getPendingWithdrawals, getReferralStats, getAdminStats, getAllTelegramUsersAdmin, getAllUsersForBroadcast, getInactiveUsers, banTelegramUser, getAllWithdrawals,
  getLeaderboard, getTasks, getTaskById, completeUserTask, getUserTaskEntry, removeUserTask, getUserTasks, createTask, updateTask, deleteTask, getAllTasks,
  createRedeemCode, getAllRedeemCodes, getRedeemCodeByCode, hasUserRedeemedCode, recordRedeemCodeUse, deactivateRedeemCode } from "./db";
import { eq } from "drizzle-orm";
import { telegramUsers, withdrawals, transactions } from "../drizzle/schema";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { ENV } from "./_core/env";

// ── Anti-bot: in-memory rate limiter ──
// NOTE: Resets on server restart — migrate to Redis for persistent rate limiting.
const tokenRateMap = new Map<number, { count: number; windowStart: number }>();
const MIN_AD_SECONDS = 15;
const INSTANT_BAN_SECONDS = 8;
const RATE_WINDOW_MS = 120_000;
const MAX_TOKENS_PER_MIN = 3;

// Purge stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of tokenRateMap.entries()) {
    if (now - rec.windowStart > RATE_WINDOW_MS * 2) tokenRateMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(telegramId: number): boolean {
  const now = Date.now();
  const rec = tokenRateMap.get(telegramId);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    tokenRateMap.set(telegramId, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= MAX_TOKENS_PER_MIN) return false;
  rec.count++;
  return true;
}


// Helper to verify Telegram WebApp data
function verifyTelegramWebApp(initData: string) {
  if (!initData) return null;
  const botToken = ENV.botToken;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return null;

    urlParams.delete("hash");

    const userRaw = urlParams.get("user") || "{}";
    let userData: any = null;
    try { userData = JSON.parse(userRaw); } catch { return null; }

    // BOT_TOKEN is required in ALL environments — no bypass
    if (!botToken) {
      console.error("[Auth] Security Error: BOT_TOKEN is required for authentication!");
      return null;
    }

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) {
      console.warn("[Auth] Hash mismatch — rejecting request");
    return null;
    }

    return userData;
  } catch (e) {
    console.error("[Auth] Error verifying Telegram data:", e);
    return null;
  }
}

// Format date as YYYY-MM-DD (max 10 chars, fits in varchar(10))
function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Helper to reset daily limits — uses UTC date strings for consistency
function resetDailyIfNeeded(user: any) {
  const todayStr = toDateString(new Date()); // "YYYY-MM-DD" in UTC

  const updates: any = {};

  const adDate = user.todayAdsDate || "";
  if (adDate < todayStr) {
    // New day — reset counter
    updates.todayAds = 0;
    updates.todayAdsDate = todayStr;
  } else if (Number(user.todayAds) > 50) {
    // Same day but value corrupted — cap it
    updates.todayAds = 50;
  }

  const spinDate = user.spinsDate || "";
  if (spinDate < todayStr) {
    updates.spinsLeft = 5;
    updates.spinsDate = todayStr;
  }

  return updates;
}

export const appRouter = router({
  system: systemRouter,
  
  telegram: router({
    checkChannelMember: publicProcedure
        .input(z.object({ telegramId: z.number(), initData: z.string() }))
        .mutation(async ({ input }) => {
          const verified = verifyTelegramWebApp(input.initData);
          if (!verified || verified.id !== input.telegramId) return { isMember: false };
          const botToken = ENV.botToken;
          const channel = process.env.REQUIRED_CHANNEL || "@Scriylj";
          if (!botToken) return { isMember: false };
          try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${input.telegramId}`);
            const data = await res.json() as any;
            const status = data?.result?.status;
            const isMember = ['member', 'administrator', 'creator'].includes(status);
            return { isMember, channel };
          } catch {
            return { isMember: false, channel };
          }
        }),

      getUser: publicProcedure
      .input(z.object({ 
        telegramId: z.number(), 
        initData: z.string(),
        referredBy: z.number().optional(),
        country: z.string().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid Telegram data" };
        }

        let user = await getTelegramUser(input.telegramId);

               const badCountryValues = ['العربية', 'Arabic', 'Russian', 'Turkish', 'French', 'German', 'Spanish', 'Portuguese', 'Indonesian', 'Persian', 'Hindi'];
          const needsCountryUpdate = !user?.country || badCountryValues.includes(user.country);
          const detectedCountry = (needsCountryUpdate && input.country) ? input.country : undefined;
        const now = new Date();

        if (!user) {
          // New user registration
          user = await upsertTelegramUser({
            telegramId: input.telegramId,
            username: verified.username,
            firstName: verified.first_name,
            lastName: verified.last_name,
            photoUrl: verified.photo_url,
            balance: 0,
            totalEarned: 0,
            todayAds: 0,
            todayAdsDate: toDateString(now),
            spinsLeft: 5,
            spinsDate: toDateString(now),
            referredBy: input.referredBy && input.referredBy !== input.telegramId ? input.referredBy : null,
          });

          // Create registration log
          await createTransaction({
            telegramId: input.telegramId,
            type: "bonus",
            points: 0,
            metadata: JSON.stringify({ action: "registration" }),
          });

          // Handle referral bonus
          if (input.referredBy && input.referredBy !== input.telegramId) {
            const inviter = await getTelegramUser(input.referredBy);
            if (inviter && !inviter.isBanned) {
              const bonusPerReferral = 100;

              // ── AUTO-CREDIT inviter immediately ──
              await upsertTelegramUser({
                ...inviter,
                balance: Number(inviter.balance) + bonusPerReferral,
                totalEarned: Number(inviter.totalEarned) + bonusPerReferral,
              });
              await createTransaction({
                telegramId: input.referredBy,
                type: "referral",
                points: bonusPerReferral,
                metadata: JSON.stringify({ action: "referral_bonus", newUserId: input.telegramId }),
              });

              // ── Send Telegram notification to inviter ──
              const botToken = ENV.botToken;
              const newUserName = verified.first_name
                ? `${verified.first_name}${verified.last_name ? " " + verified.last_name : ""}`
                : (verified.username ? `@${verified.username}` : "صديق جديد");
              if (botToken) {
                const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
                const newInviterBalance = Number(inviter.balance) + bonusPerReferral;
                const msg =
                  `🎉 *مبروك!* انضم *${newUserName}* عبر رابطك!\n\n` +
                  `✅ تمت إضافة *${bonusPerReferral} نقطة* إلى رصيدك تلقائياً\n` +
                  `💰 رصيدك الجديد: *${newInviterBalance.toLocaleString()} نقطة*\n\n` +
                  `👥 شارك رابطك مع المزيد من الأصدقاء لتربح أكثر!`;
                const body: any = {
                  chat_id: input.referredBy,
                  text: msg,
                  parse_mode: "Markdown",
                };
                if (webappUrl) {
                  body.reply_markup = JSON.stringify({
                    inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]],
                  });
                }
                fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }).catch(() => {}); // fire-and-forget, don't block registration
              }

              // ── New user welcome bonus (300 pts) ──
              const welcomeBonus = 300;
              await upsertTelegramUser({
                telegramId: input.telegramId,
                balance: welcomeBonus,
                totalEarned: welcomeBonus,
              });
              await createTransaction({
                telegramId: input.telegramId,
                type: "bonus",
                points: welcomeBonus,
                metadata: JSON.stringify({ action: "referral_welcome", invitedBy: input.referredBy }),
              });

              // ── Send welcome notification to NEW user ──
              if (botToken) {
                const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
                const inviterName = inviter.firstName
                  ? `${inviter.firstName}${inviter.lastName ? " " + inviter.lastName : ""}`
                  : (inviter.username ? `@${inviter.username}` : "صديقك");
                const welcomeMsg =
                  `⭐ *Stars* 🎊 *أهلاً وسهلاً!*\n\n` +
                  `لقد انضممت عبر رابط *${inviterName}* وحصلت على:\n` +
                  `🎁 *${welcomeBonus} نقطة* ترحيبية أُضيفت لرصيدك الآن!\n\n` +
                  `📺 شاهد الإعلانات يومياً واربح المزيد من النقاط\n` +
                  `🌟 حوّل نقاطك إلى *Telegram Stars* ⭐`;
                const welcomeBody: any = {
                  chat_id: input.telegramId,
                  text: welcomeMsg,
                  parse_mode: "Markdown",
                };
                if (webappUrl) {
                  welcomeBody.reply_markup = JSON.stringify({
                    inline_keyboard: [[{ text: "🎮 ابدأ اللعب والربح!", web_app: { url: webappUrl } }]],
                  });
                }
                fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(welcomeBody),
                }).catch(() => {}); // fire-and-forget
              }

              // Refresh user object with updated balance
              user = await getTelegramUser(input.telegramId);
            }
          }
        } else {
          if (detectedCountry && needsCountryUpdate) {
            await upsertTelegramUser({ telegramId: input.telegramId, country: detectedCountry });
            user = { ...user, country: detectedCountry };
          }
          // ── Process referral for existing users who haven't been credited yet ──
          if (input.referredBy && input.referredBy !== input.telegramId) {
            const existingTxs = await getTransactions(input.telegramId, 100);
            const alreadyRewarded = existingTxs.some((tx: any) => {
              try { return JSON.parse(tx.metadata || '{}').action === 'referral_welcome'; } catch { return false; }
            });
            if (!alreadyRewarded) {
              const inviter = await getTelegramUser(input.referredBy);
              if (inviter && !inviter.isBanned) {
                const bonusPerReferral = 100;
                // ── AUTO-CREDIT inviter ──
                await upsertTelegramUser({
                  ...inviter,
                  balance: Number(inviter.balance) + bonusPerReferral,
                  totalEarned: Number(inviter.totalEarned) + bonusPerReferral,
                });
                await createTransaction({
                  telegramId: input.referredBy,
                  type: "referral",
                  points: bonusPerReferral,
                  metadata: JSON.stringify({ action: "referral_bonus", newUserId: input.telegramId }),
                });
                // ── Save referredBy on existing user ──
                await upsertTelegramUser({ telegramId: input.telegramId, referredBy: input.referredBy });
                // ── Notify inviter ──
                const botToken2 = ENV.botToken;
                const newUserName2 = verified.first_name
                  ? `${verified.first_name}${verified.last_name ? " " + verified.last_name : ""}`
                  : (verified.username ? `@${verified.username}` : "صديق جديد");
                if (botToken2) {
                  const webappUrl2 = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
                  const newInviterBalance2 = Number(inviter.balance) + bonusPerReferral;
                  const msg2 =
                    `🎉 *مبروك!* انضم *${newUserName2}* عبر رابطك!\n\n` +
                    `✅ تمت إضافة *${bonusPerReferral} نقطة* إلى رصيدك تلقائياً\n` +
                    `💰 رصيدك الجديد: *${newInviterBalance2.toLocaleString()} نقطة*\n\n` +
                    `👥 شارك رابطك مع المزيد من الأصدقاء لتربح أكثر!`;
                  const body2: any = { chat_id: input.referredBy, text: msg2, parse_mode: "Markdown" };
                  if (webappUrl2) body2.reply_markup = JSON.stringify({ inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl2 } }]] });
                  fetch(`https://api.telegram.org/bot${botToken2}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body2),
                  }).catch(() => {});
                }
                // ── Welcome bonus for the existing user ──
                const welcomeBonus2 = 300;
                await upsertTelegramUser({
                  telegramId: input.telegramId,
                  balance: Number(user.balance) + welcomeBonus2,
                  totalEarned: Number(user.totalEarned) + welcomeBonus2,
                });
                await createTransaction({
                  telegramId: input.telegramId,
                  type: "bonus",
                  points: welcomeBonus2,
                  metadata: JSON.stringify({ action: "referral_welcome", invitedBy: input.referredBy }),
                });
                // ── Welcome notification ──
                if (botToken2) {
                  const webappUrl3 = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
                  const inviterName2 = inviter.firstName
                    ? `${inviter.firstName}${inviter.lastName ? " " + inviter.lastName : ""}`
                    : (inviter.username ? `@${inviter.username}` : "صديقك");
                  const welcomeMsg2 =
                    `⭐ *Stars* 🎊 *أهلاً وسهلاً!*\n\n` +
                    `لقد انضممت عبر رابط *${inviterName2}* وحصلت على:\n` +
                    `🎁 *${welcomeBonus2} نقطة* ترحيبية أُضيفت لرصيدك الآن!\n\n` +
                    `📺 شاهد الإعلانات يومياً واربح المزيد من النقاط\n` +
                    `🌟 حوّل نقاطك إلى *Telegram Stars* ⭐`;
                  const welcomeBody2: any = { chat_id: input.telegramId, text: welcomeMsg2, parse_mode: "Markdown" };
                  if (webappUrl3) welcomeBody2.reply_markup = JSON.stringify({ inline_keyboard: [[{ text: "🎮 ابدأ اللعب والربح!", web_app: { url: webappUrl3 } }]] });
                  fetch(`https://api.telegram.org/bot${botToken2}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(welcomeBody2),
                  }).catch(() => {});
                }
                user = await getTelegramUser(input.telegramId);
              }
            }
          }
          const dailyUpdates = resetDailyIfNeeded(user);
          if (Object.keys(dailyUpdates).length > 0) {
            user = await upsertTelegramUser({ ...user, ...dailyUpdates });
          }
        }

        const starsRate = await getSetting("starsRate", 1000);
        const minWithdraw = await getSetting("minWithdraw", 10000);

        return {
          success: true,
          user: {
            ...user,
            adReward: await getSetting("adReward", 10),
            adCooldown: await getSetting("adCooldown", 30),
            starsRate,
            minWithdraw,
            adsgramBlockId: ENV.adsgramBlockId,
            lastAdTime: user?.lastAdTime ? new Date(user.lastAdTime).getTime() : null,
            isAdmin: ENV.adminTelegramId ? ENV.adminTelegramId === input.telegramId : false,
            isBanned: !!user?.isBanned,
          },
        };
      }),
    getTransactions: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .query(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return [];
        return await getTransactions(input.telegramId);
      }),

    getReferralStats: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .query(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { count: 0, totalEarned: 0 };
        return await getReferralStats(input.telegramId);
      }),

    claimReferral: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, claimed: 0, points: 0 };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, claimed: 0, points: 0 };

        // Get all users referred by this user
        const stats = await getReferralStats(input.telegramId);
        const referredCount = stats.count;
        if (referredCount === 0) return { success: true, claimed: 0, points: 0 };

        // Count actual referral transactions (not divide totalEarned which includes other types)
        const allUserTxs = await getTransactions(input.telegramId, 500);
        const existingTxCount = allUserTxs.filter((tx: any) => {
          try {
            const m = JSON.parse(tx.metadata || '{}');
            return tx.type === 'referral' && (m.action === 'referral_bonus' || m.action === 'claim_missed_referral');
          } catch { return false; }
        }).length;

        // How many referrals haven't been paid yet
        const unpaidCount = Math.max(0, referredCount - existingTxCount);
        if (unpaidCount === 0) return { success: true, claimed: 0, points: 0 };

        // Pay missed referral bonuses
        const bonusPerReferral = 100;
        const totalBonus = unpaidCount * bonusPerReferral;

        await upsertTelegramUser({
          ...user,
          balance: Number(user.balance) + totalBonus,
          totalEarned: Number(user.totalEarned) + totalBonus,
        });

        for (let i = 0; i < unpaidCount; i++) {
          await createTransaction({
            telegramId: input.telegramId,
            type: "referral",
            points: bonusPerReferral,
            metadata: JSON.stringify({ action: "claim_missed_referral", batch: true }),
          });
        }

        return { success: true, claimed: unpaidCount, points: totalBonus };
      }),
  }),

  ads: router({
    getToken: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string(), type: z.enum(["points", "spin"]).optional().default("points") }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        // ── Anti-bot checks ──
        // Always allow admin to use ads (auto-unban if needed)
        if (user.isBanned === true) {
          if (ENV.adminTelegramId && ENV.adminTelegramId === input.telegramId) {
            await banTelegramUser(input.telegramId, false); // auto-unban admin
          } else {
            return { success: false, message: "تم تعليق حسابك بسبب نشاط مشبوه" };
          }
        }
        // Spin-type ads bypass the daily points-ad limit (they have their own 5/day limit on the client)
        if (input.type !== "spin" && user.todayAds >= 50) return { success: false, message: "Daily limit reached" };
        if (!checkRateLimit(input.telegramId)) {
          return { success: false, message: "طلبات كثيرة جداً — انتظر دقيقة" };
        }

        const token = uuidv4();
        await createAdToken(token, input.telegramId);
        return { success: true, token };
      }),

    claim: publicProcedure
      .input(z.object({ 
        telegramId: z.number(), 
        token: z.string(), 
        initData: z.string(),
        type: z.enum(["points", "spin"]).default("points")
      }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const adToken = await getAdToken(input.token);
        if (!adToken || Number(adToken.telegramId) !== Number(input.telegramId) || adToken.used === true) {
          return { success: false, message: "Invalid token" };
        }

        // ── Anti-bot: enforce minimum viewing time ──
        const tokenAge = (Date.now() - new Date(adToken.createdAt).getTime()) / 1000;
        if (tokenAge < INSTANT_BAN_SECONDS) {
          // Claimed too fast — warn only, do NOT permanently ban
          await markAdTokenUsed(input.token);
          return { success: false, message: `يجب مشاهدة الإعلان كاملاً (${MIN_AD_SECONDS} ثانية) للحصول على النقاط` };
        }
        if (tokenAge < MIN_AD_SECONDS) {
          return { success: false, message: `يجب مشاهدة الإعلان ${MIN_AD_SECONDS} ثانية على الأقل` };
        }

        await markAdTokenUsed(input.token);
        let user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };
        if (user.isBanned === true) return { success: false, message: "تم تعليق حسابك" };

        const reward = 10;
        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;
        const currentTodayAds = Number(user.todayAds) || 0;
        const currentSpins = Number(user.spinsLeft) || 0;

        const updates: any = {
          ...user,
          todayAds: currentTodayAds + 1,
          lastAdTime: new Date().toISOString().replace("T", " ").replace("Z", ""),
        };

        if (input.type === "spin") {
          updates.spinsLeft = currentSpins + 1;
          // Spin reward: extra spin only, no points
        } else {
          updates.balance = currentBalance + reward;
          updates.totalEarned = currentTotalEarned + reward;
        }

        user = await upsertTelegramUser(updates);

        await createTransaction({
          telegramId: input.telegramId,
          type: "ad",
          points: input.type === "spin" ? 0 : reward,
          metadata: JSON.stringify({ token: input.token, adType: input.type }),
        });

        // Always return balance — use computed value as fallback if upsert returned null
        const claimBalance = Number(user?.balance ?? updates.balance);
        if (input.type !== "spin") {
          notifyWithdrawReady(input.telegramId, claimBalance).catch(() => {});
          notifyNearWithdraw(input.telegramId, claimBalance).catch(() => {});
        }
          return { 
            success: true, 
            reward, 
            balance: claimBalance, 
            spinsLeft: user?.spinsLeft ?? updates.spinsLeft 
          };
      }),
  }),

  spin: router({
    perform: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        let user = await getTelegramUser(input.telegramId);
        if (!user || user.spinsLeft <= 0) return { success: false, message: "No spins left" };

        const prizes = [50, 75, 100, 150, 200, 250, 500, 1000];
        const weights = [40, 25, 15, 10, 5, 3, 1.5, 0.5];
        
        // Weighted random
        let totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = randomInt(0, 1e9) / 1e9 * totalWeight;
        let prize = prizes[0];
        for (let i = 0; i < weights.length; i++) {
          if (random < weights[i]) {
            prize = prizes[i];
            break;
          }
          random -= weights[i];
        }

        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;
        const currentSpins = Number(user.spinsLeft) || 0;

        user = await upsertTelegramUser({
          telegramId: input.telegramId,
          balance: currentBalance + prize,
          totalEarned: currentTotalEarned + prize,
          spinsLeft: Math.max(0, currentSpins - 1),
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "spin",
          points: prize,
          metadata: JSON.stringify({ prize }),
        });

        const finalBalance = Number(user?.balance ?? (currentBalance + prize));
        notifyWithdrawReady(input.telegramId, finalBalance).catch(() => {});
        notifyNearWithdraw(input.telegramId, finalBalance).catch(() => {});

        return { success: true, prize, balance: finalBalance, spinsLeft: user?.spinsLeft ?? Math.max(0, currentSpins - 1) };
      }),

    buy: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string(), quantity: z.number().min(1).max(10) }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };
        if (user.isBanned) return { success: false, message: "تم تعليق حسابك" };

        // Pricing: 1 spin = 500 pts, 3 spins = 1200 pts, 5 spins = 1800 pts
        const PRICES: Record<number, number> = { 1: 500, 3: 1200, 5: 1800 };
        const cost = PRICES[input.quantity] ?? input.quantity * 500;
        const currentBalance = Number(user.balance) || 0;
        const currentSpins = Number(user.spinsLeft) || 0;

        if (currentBalance < cost) return { success: false, message: "رصيدك غير كافٍ" };

        const updatedUser = await upsertTelegramUser({
          telegramId: input.telegramId,
          balance: currentBalance - cost,
          spinsLeft: currentSpins + input.quantity,
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "bonus",
          points: -cost,
          metadata: JSON.stringify({ action: "buy_spins", quantity: input.quantity, cost }),
        });

        return {
          success: true,
          balance: updatedUser?.balance ?? (currentBalance - cost),
          spinsLeft: updatedUser?.spinsLeft ?? (currentSpins + input.quantity),
        };
      }),
  }),


  dailyGift: router({
    claim: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid data" };
        }

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        // Check 24h cooldown using completedTasks JSON field (no schema change needed)
        let completedTasksData: any = {};
        try {
          completedTasksData = user.completedTasks ? JSON.parse(user.completedTasks) : {};
        } catch { completedTasksData = {}; }

        const lastGift = completedTasksData.lastDailyGift;
        if (lastGift) {
          const diff = Date.now() - new Date(lastGift).getTime();
          if (diff < 24 * 60 * 60 * 1000) {
            return { success: false, message: "Already claimed today", nextClaim: new Date(lastGift).getTime() + 24 * 60 * 60 * 1000 };
          }
        }

         // الهدية اليومية ثابتة: 10 نقاط فقط (بعد مشاهدة إعلان)
          const reward = 10;

        const now = new Date();
        completedTasksData.lastDailyGift = now.toISOString();

        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;

        const updated = await upsertTelegramUser({
          ...user,
          balance: currentBalance + reward,
          totalEarned: currentTotalEarned + reward,
          completedTasks: JSON.stringify(completedTasksData),
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "bonus",
          points: reward,
          metadata: JSON.stringify({ action: "daily_gift", reward }),
        });

        return {
          success: true,
          reward,
          balance: updated?.balance,
          totalEarned: updated?.totalEarned,
          nextClaim: now.getTime() + 24 * 60 * 60 * 1000,
        };
      }),
  }),

  withdraw: router({
    // Create a new withdrawal request
    request: publicProcedure
      .input(z.object({ telegramId: z.number(), amount: z.number().int().positive().min(10000), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "بيانات غير صالحة" };
        }

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "المستخدم غير موجود" };

        const minWithdraw = await getSetting("minWithdraw", 10000);
        const starsRate = await getSetting("starsRate", 1000);
        const currentBalance = Number(user.balance) || 0;

        // Enforce minimum 10000 and positive integer at server level too
        if (!Number.isInteger(input.amount) || input.amount <= 0) {
          return { success: false, message: "المبلغ يجب أن يكون عدداً صحيحاً موجباً" };
        }
        if (input.amount < minWithdraw) {
          return { success: false, message: `الحد الأدنى للسحب ${minWithdraw.toLocaleString()} نقطة` };
        }
        if (input.amount > currentBalance) {
          return { success: false, message: "رصيدك غير كافٍ" };
        }

        // Check no already-pending withdrawal for this user
        const userWithdrawals = await getUserWithdrawals(input.telegramId, 5);
        const hasPending = userWithdrawals.some((w: any) => w.status === "pending");
        if (hasPending) {
          return { success: false, message: "لديك طلب سحب قيد المعالجة، انتظر حتى تتم معالجته" };
        }

        const stars = Math.floor(input.amount / starsRate);
        if (stars < 1) {
          return { success: false, message: `الحد الأدنى للسحب هو 10,000 نقطة (= 10 نجوم)` };
        }

        const pool = await getPool();
        if (!pool) return { success: false, message: "قاعدة البيانات غير متوفرة" };

        // Ensure withdrawals table exists with all required columns
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
              id serial PRIMARY KEY,
              telegram_id bigint NOT NULL,
              amount bigint NOT NULL,
              stars integer NOT NULL,
              method varchar(50) DEFAULT 'telegram_stars',
              status text NOT NULL DEFAULT 'pending',
              processed_at timestamp,
              note text,
              created_at timestamp NOT NULL DEFAULT NOW(),
              updated_at timestamp NOT NULL DEFAULT NOW()
            )
          `);
          await pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT NOW()`);
          await pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS method varchar(50) DEFAULT 'telegram_stars'`);
          await pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS note text`);
          await pool.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at timestamp`);
        } catch (_) {}

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // 1. Re-verify balance inside transaction
          const userRes = await client.query(
            "SELECT balance FROM telegram_users WHERE telegram_id = $1 FOR UPDATE",
            [input.telegramId]
          );
          if (!userRes.rows[0]) throw new Error("المستخدم غير موجود في قاعدة البيانات");
          const currentBal = Number(userRes.rows[0].balance);
          if (currentBal < input.amount) throw new Error("رصيدك غير كافٍ أو حدث خطأ في المزامنة");

          // 2. Deduct balance
          await client.query(
            "UPDATE telegram_users SET balance = balance - $1, updated_at = NOW() WHERE telegram_id = $2",
            [input.amount, input.telegramId]
          );

          // 3. Create withdrawal record (only use guaranteed columns)
          await client.query(
            `INSERT INTO withdrawals (telegram_id, amount, stars, status)
             VALUES ($1, $2, $3, 'pending')`,
            [input.telegramId, input.amount, stars]
          );

          // 4. Create transaction record
          await client.query(
            `INSERT INTO transactions (telegram_id, type, points, metadata)
             VALUES ($1, 'withdraw', $2, $3)`,
            [input.telegramId, -input.amount, JSON.stringify({ stars, status: "pending" })]
          );

          await client.query("COMMIT");
        } catch (error: any) {
          await client.query("ROLLBACK").catch(() => {});
          console.error("[Withdraw] Transaction failed:", error);
          const realMsg = error.detail || error.message || "فشلت عملية السحب، يرجى المحاولة لاحقاً";
          return { success: false, message: realMsg };
        } finally {
          client.release();
        }

        // Notify admin via Telegram Bot API
        const botToken = ENV.botToken;
        const adminId = ENV.adminTelegramId;
        if (botToken && adminId) {
          const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "مجهول";
          const username = user.username ? `@${user.username}` : "بدون username";
          const msg = [
            `🔔 <b>طلب سحب جديد</b>`,
            ``,
            `👤 الاسم: <b>${name}</b>`,
            `🔗 المعرف: ${username}`,
            `🆔 Telegram ID: <code>${input.telegramId}</code>`,
            ``,
            `💰 النقاط: <b>${input.amount.toLocaleString()}</b>`,
            `⭐ النجوم: <b>${stars}</b>`,
            ``,
            `📋 حالة الطلب: قيد المعالجة`,
            `⏰ الوقت: ${new Date().toLocaleString("ar-SA")}`,
            ``,
            `للموافقة أو الرفض استخدم لوحة الأدمن في التطبيق.`,
          ].join("\n");

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: adminId, text: msg, parse_mode: "HTML" }),
          }).catch(() => {});
        }

        return { success: true, stars, message: "تم إرسال طلب السحب بنجاح! سيتم المعالجة خلال 24 ساعة." };
      }),

    // Get current user's withdrawal history
    getHistory: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .query(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return [];
        return await getUserWithdrawals(input.telegramId, 10);
      }),

    // Admin: get all pending withdrawals (only if adminId matches env)
    adminGetPending: publicProcedure
      .input(z.object({ telegramId: z.number() }))
      .query(async ({ input }) => {
        if (!ENV.adminTelegramId || input.telegramId !== ENV.adminTelegramId) {
          return { success: false, message: "غير مصرح", withdrawals: [] };
        }
        const list = await getPendingWithdrawals();
        return { success: true, withdrawals: list };
      }),

    // Admin: approve or reject a withdrawal
    adminUpdate: publicProcedure
      .input(z.object({
        telegramId: z.number(),
        withdrawalId: z.number(),
        status: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!ENV.adminTelegramId || input.telegramId !== ENV.adminTelegramId) {
          return { success: false, message: "غير مصرح" };
        }

        // If rejected, restore user's balance
        // Fetch withdrawal BEFORE updating its status so we can find it regardless of current status
        if (input.status === "rejected") {
          const allW = await getAllWithdrawals();
          const w = allW.find((p: any) => p.id === input.withdrawalId);
          if (w && w.status === "pending") {
            const user = await getTelegramUser(w.telegramId);
            if (user) {
              await upsertTelegramUser({
                ...user,
                balance: Number(user.balance) + Number(w.amount),
              });
            }
          }
        }

        await updateWithdrawalStatus(
          input.withdrawalId,
          input.status as "approved" | "rejected",
          input.note
        );

        // Notify user via bot + auto-send stars on approval
        const botToken = ENV.botToken;
        if (botToken) {
          const allW = await getAllWithdrawals();
          const w = allW.find((p: any) => p.id === input.withdrawalId);
          if (w) {
            const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";

            // ── إرسال النجوم تلقائياً عند الموافقة ──
            let starsResult: { success: boolean; sent: number; error?: string } = { success: false, sent: 0 };
            if (input.status === "approved") {
              starsResult = await sendStarsGift(botToken, Number(w.telegramId), Number(w.stars)).catch((e) => ({
                success: false, sent: 0, error: e?.message || "خطأ غير متوقع"
              }));
            }

            const msg = input.status === "approved"
              ? starsResult.success
                ? `✅ *تم إرسال نجومك بنجاح!*\n\n` +
                  `⭐ لقد أرسلنا لك *${Number(w.stars).toLocaleString()} Stars* إلى حسابك\n` +
                  `💰 المبلغ: ${Number(w.amount).toLocaleString()} نقطة\n\n` +
                  `شكراً لك، استمر باللعب لتربح المزيد! 🚀`
                : `✅ *تمت الموافقة على طلب السحب*\n\n` +
                  `⭐ طلبك لسحب *${Number(w.stars).toLocaleString()} Stars* قيد المعالجة\n` +
                  `💰 المبلغ: ${Number(w.amount).toLocaleString()} نقطة\n\n` +
                  `⚠️ ${starsResult.error || "سيتم الإرسال يدوياً من الإدارة خلال 24 ساعة"}\n\n` +
                  `شكراً لك، استمر باللعب لتربح المزيد! 🚀`
              : `❌ *تم رفض طلب السحب*\n\n` +
                `نأسف، تم رفض طلبك لسحب *${Number(w.stars).toLocaleString()} ⭐ Stars*\n` +
                `${input.note ? `📝 السبب: ${input.note}\n` : ""}` +
                `💰 تم إعادة نقاطك إلى رصيدك تلقائياً\n\n` +
                `تواصل مع الدعم إذا كان لديك استفسار.`;
            const body: any = {
              chat_id: w.telegramId,
              text: msg,
              parse_mode: "Markdown",
            };
            if (webappUrl) {
              body.reply_markup = JSON.stringify({
                inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]],
              });
            }
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => {});
          }
        }

        return { success: true, message: `تم ${input.status === "approved" ? "الموافقة" : "رفض"} الطلب بنجاح` };
      }),
  }),


    admin: router({
      // Auto-auth using Telegram identity (admin only)
      adminAutoAuth: publicProcedure
        .input(z.object({ telegramId: z.number(), initData: z.string() }))
        .mutation(async ({ input }) => {
          const verified = verifyTelegramWebApp(input.initData);
          if (!verified || verified.id !== input.telegramId) return { success: false };
          const adminId = ENV.adminTelegramId;
          if (!adminId || adminId !== input.telegramId) return { success: false };
          const adminSecret = process.env.ADMIN_SECRET || '';
          if (!adminSecret) return { success: false };
          // Never transmit ADMIN_SECRET over network — client uses admin.verify separately
          return { success: true };
        }),

      // Verify admin access — checks secret against env
      verify: publicProcedure
        .input(z.object({ secret: z.string() }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          const isValid = safeCompareSecret(input.secret, adminSecret);
          return { success: isValid };
        }),

      // Full stats for dashboard
      getStats: publicProcedure
        .input(z.object({ secret: z.string() }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, data: null };
          const stats = await getAdminStats();
          return { success: true, data: stats };
        }),

      // Paginated users list
      getUsers: publicProcedure
        .input(z.object({ secret: z.string(), page: z.number().default(1) }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, users: [] };
          const limit = 20;
          const offset = (input.page - 1) * limit;
          const users = await getAllTelegramUsersAdmin(limit, offset);
          return { success: true, users };
        }),

      // All withdrawals (with optional status filter)
      getWithdrawals: publicProcedure
        .input(z.object({ secret: z.string(), status: z.string().optional() }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, withdrawals: [] };
          const list = await getAllWithdrawals(input.status);
          return { success: true, withdrawals: list };
        }),

      // Ban / unban a user
      unbanUser: publicProcedure
      .input(z.object({ adminId: z.number(), targetId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        const envAdminId = ENV.adminTelegramId;
        if (!verified || !envAdminId || envAdminId !== input.adminId) return { success: false, message: "غير مصرح" };
        await banTelegramUser(input.targetId, false);
        return { success: true, message: `تم رفع الحظر عن ${input.targetId}` };
      }),

    banUser: publicProcedure
        .input(z.object({ secret: z.string(), telegramId: z.number(), ban: z.boolean() }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, message: "غير مصرح" };
          await banTelegramUser(input.telegramId, input.ban);
          return { success: true };
        }),

      // Broadcast message to all users (or inactive only)
      broadcast: publicProcedure
        .input(z.object({
          secret: z.string(),
          message: z.string().min(1).max(1000),
          targetGroup: z.enum(["all", "inactive"]).default("all"),
        }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, sent: 0, message: "غير مصرح" };

          const botToken = ENV.botToken;
          const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
          if (!botToken) return { success: false, sent: 0, message: "BOT_TOKEN غير مضبوط" };

          let users: any[] = [];
          if (input.targetGroup === "inactive") {
            users = await getInactiveUsers(3, 300);
          } else {
            users = await getAllUsersForBroadcast(500);
          }

          let sent = 0;
          const keyboard = webappUrl ? {
            inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]]
          } : undefined;

          for (const u of users) {
            try {
              // Replace personalized template variables per user
              const name = u.firstName || u.username || "صديق";
              const balance = String(u.balance ?? 0);
              const personalizedText = input.message
                .replace(/{name}/g, name)
                .replace(/{balance}/g, balance);
              const payload: any = { chat_id: u.telegramId, text: personalizedText, parse_mode: "HTML" };
              if (keyboard) payload.reply_markup = keyboard;
              const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (r.ok) sent++;
              await new Promise(res => setTimeout(res, 50));
            } catch {}
          }
          return { success: true, sent, total: users.length };
        }),

      // Send admin a bot message with a direct chat button for a user (no username fallback)
      sendUserChatLink: publicProcedure
        .input(z.object({
          secret: z.string(),
          adminTelegramId: z.number(),
          targetTelegramId: z.number(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) {
            return { success: false, message: "غير مصرح" };
          }
          const botToken = ENV.botToken;
          if (!botToken) return { success: false, message: "BOT_TOKEN غير مضبوط في السيرفر" };
          // Use adminTelegramId from the request (WebApp knows who the admin is)
          const adminId = input.adminTelegramId;

          const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || `#${input.targetTelegramId}`;
          // Send the admin a message with a tg://openmessage button — works in native Telegram (not WebApp)
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminId,
              text: `👤 *${name}*\nID: \`${input.targetTelegramId}\`\n\nاضغط الزر أدناه لفتح المحادثة المباشرة:`,
              parse_mode: "Markdown",
              reply_markup: JSON.stringify({
                inline_keyboard: [[
                  { text: "💬 فتح المحادثة المباشرة", url: `tg://openmessage?user_id=${input.targetTelegramId}` },
                ]],
              }),
            }),
          });
          const data = await res.json() as any;
          if (!data.ok) return { success: false, message: data.description || "فشل الإرسال" };
          return { success: true };
        }),

      // Approve or reject a withdrawal (secret-based auth)
      adminUpdate: publicProcedure
        .input(z.object({
          secret: z.string(),
          withdrawalId: z.number(),
          status: z.enum(["approved", "rejected"]),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!safeCompareSecret(input.secret, adminSecret)) {
            return { success: false, message: "غير مصرح" };
          }

          const pool = await getPool();
          if (!pool) return { success: false, message: "قاعدة البيانات غير متوفرة" };

          // Fetch the withdrawal record
          const wRes = await pool.query(
            "SELECT * FROM withdrawals WHERE id = $1 LIMIT 1",
            [input.withdrawalId]
          );
          const w = wRes.rows[0];
          if (!w) return { success: false, message: "الطلب غير موجود" };

          // If rejecting a pending withdrawal → restore user balance
          if (input.status === "rejected" && w.status === "pending") {
            await pool.query(
              "UPDATE telegram_users SET balance = balance + $1, updated_at = NOW() WHERE telegram_id = $2",
              [Number(w.amount), Number(w.telegram_id)]
            );
          }

          // Update withdrawal status
          await pool.query(
            `UPDATE withdrawals SET status = $1, processed_at = NOW(), note = $2 WHERE id = $3`,
            [input.status, input.note || null, input.withdrawalId]
          );

          // Notify user via Telegram bot + auto-send stars on approval
          const botToken = ENV.botToken;
          const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";

          // ── إرسال النجوم تلقائياً عند الموافقة ──
          let starsResult2: { success: boolean; sent: number; error?: string } = { success: false, sent: 0 };
          if (input.status === "approved" && botToken && w) {
            starsResult2 = await sendStarsGift(botToken, Number(w.telegram_id), Number(w.stars)).catch((e) => ({
              success: false, sent: 0, error: e?.message || "خطأ غير متوقع"
            }));
          }

          if (botToken && w) {
            const msg = input.status === "approved"
              ? starsResult2.success
                ? `✅ *تم إرسال نجومك بنجاح!*\n\n` +
                  `⭐ لقد أرسلنا لك *${Number(w.stars).toLocaleString()} Stars* إلى حسابك\n` +
                  `💰 المبلغ: ${Number(w.amount).toLocaleString()} نقطة\n\n` +
                  `شكراً لك، استمر باللعب لتربح المزيد! 🚀`
                : `✅ *تمت الموافقة على طلب السحب*\n\n` +
                  `⭐ طلبك لسحب *${Number(w.stars).toLocaleString()} Stars* قيد المعالجة\n` +
                  `💰 المبلغ: ${Number(w.amount).toLocaleString()} نقطة\n\n` +
                  `⚠️ ${starsResult2.error || "سيتم الإرسال يدوياً من الإدارة خلال 24 ساعة"}\n\n` +
                  `شكراً لك، استمر باللعب لتربح المزيد! 🚀`
              : `❌ *تم رفض طلب السحب*\n\n` +
                `نأسف، تم رفض طلبك لسحب *${Number(w.stars).toLocaleString()} ⭐ Stars*\n` +
                `${input.note ? `📝 السبب: ${input.note}\n` : ""}` +
                `💰 تم إعادة نقاطك إلى رصيدك تلقائياً\n\n` +
                `تواصل مع الدعم إذا كان لديك استفسار.`;
            const body: any = { chat_id: Number(w.telegram_id), text: msg, parse_mode: "Markdown" };
            if (webappUrl) {
              body.reply_markup = JSON.stringify({
                inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]],
              });
            }
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => {});
          }

          return { success: true, message: `تم ${input.status === "approved" ? "الموافقة على" : "رفض"} الطلب بنجاح` };
        }),
    }),


      // ── Tasks Router ────────────────────────────────────────────────────
      tasks: router({

        // List all active tasks with completion status for user
        list: publicProcedure
          .input(z.object({ telegramId: z.number(), initData: z.string() }))
          .query(async ({ input }) => {
            const verified = verifyTelegramWebApp(input.initData);
            if (!verified) return { success: false, tasks: [] };
            const [allTasks, completedTasks] = await Promise.all([
              getTasks(),
              getUserTasks(input.telegramId),
            ]);
            const completedMap = new Map(completedTasks.map(ct => [ct.taskId, ct.pointsEarned]));
            return {
              success: true,
              tasks: allTasks.map(t => ({
                ...t,
                completed: completedMap.has(t.id),
                pointsEarned: completedMap.get(t.id) ?? null,
              })),
            };
          }),

        // Verify membership and award points
        claim: publicProcedure
          .input(z.object({ telegramId: z.number(), initData: z.string(), taskId: z.number() }))
          .mutation(async ({ input }) => {
            const verified = verifyTelegramWebApp(input.initData);
            if (!verified) return { success: false, message: "غير مصرح" };

            // Check if already completed
            const existing = await getUserTaskEntry(input.telegramId, input.taskId);
            if (existing) return { success: false, message: "أنجزت هذه المهمة مسبقاً" };

            const task = await getTaskById(input.taskId);
            if (!task || !task.isActive) return { success: false, message: "المهمة غير موجودة" };

            const botToken = ENV.botToken;
            if (!botToken) return { success: false, message: "إعداد البوت غير مكتمل" };

            // Verify membership via Telegram API
            const rawUsername = task.channelUsername?.replace('@', '').trim() ?? '';
            const chatId = task.channelId || ('@' + rawUsername);
            if (!rawUsername && !task.channelId) {
              return { success: false, message: "إعداد المهمة غير صحيح، تواصل مع الدعم" };
            }
            try {
              const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${input.telegramId}`);
              const data = await res.json();

              if (!data.ok) {
                const desc: string = data.description ?? '';
                if (desc.includes('user not found') || desc.includes('USER_ID_INVALID')) {
                  // Telegram can't find the user — likely they haven't started the bot yet
                  return { success: false, message: "تأكد أنك فتحت البوت أولاً وأرسلت له /start ثم حاول مجدداً" };
                }
                if (desc.includes('chat not found') || desc.includes('PEER_ID_INVALID')) {
                  return { success: false, message: "القناة غير موجودة أو البوت ليس عضواً فيها — تواصل مع المشرف" };
                }
                if (desc.includes('bot was kicked') || desc.includes('not enough rights')) {
                  return { success: false, message: "البوت يحتاج صلاحيات في القناة — تواصل مع المشرف" };
                }
                if (desc.includes('member list is inaccessible')) {
                  // Private channel — bot must be admin
                  return { success: false, message: "القناة خاصة — يجب أن يكون البوت مشرفاً فيها" };
                }
                return { success: false, message: "تعذّر التحقق من العضوية، حاول مجدداً" };
              }

              const status = data?.result?.status;
              const isMember = ['member', 'administrator', 'creator'].includes(status);
              if (!isMember) return { success: false, message: "لم يتم التحقق من انضمامك للقناة، انضم أولاً ثم اضغط تحقق" };
            } catch {
              return { success: false, message: "تعذّر التحقق من العضوية، حاول مجدداً" };
            }

            // Award random points
            const pts = Math.floor(Math.random() * (task.pointsMax - task.pointsMin + 1)) + task.pointsMin;
            const user = await getTelegramUser(input.telegramId);
            if (!user) return { success: false, message: "المستخدم غير موجود" };

            await Promise.all([
              completeUserTask(input.telegramId, input.taskId, pts),
              upsertTelegramUser({ telegramId: input.telegramId, balance: (user.balance || 0) + pts, totalEarned: (user.totalEarned || 0) + pts }),
              createTransaction({ telegramId: input.telegramId, type: "task", points: pts, metadata: JSON.stringify({ taskId: task.id, taskName: task.name }) }),
            ]);

            return { success: true, points: pts, message: `🎉 ربحت ${pts} نقطة!` };
          }),

        // Re-check membership (called when user opens tasks tab to detect leaves)
        recheck: publicProcedure
          .input(z.object({ telegramId: z.number(), initData: z.string() }))
          .mutation(async ({ input }) => {
            const verified = verifyTelegramWebApp(input.initData);
            if (!verified) return { success: false, deducted: 0 };

            const botToken = ENV.botToken;
            if (!botToken) return { success: false, deducted: 0 };

            const [completedTasks, allTasks] = await Promise.all([
              getUserTasks(input.telegramId),
              getTasks(),
            ]);
            if (!completedTasks.length) return { success: true, deducted: 0, left: [] };

            const taskMap = new Map(allTasks.map(t => [t.id, t]));
            let totalDeducted = 0;
            const left: string[] = [];

            for (const ct of completedTasks) {
              const task = taskMap.get(ct.taskId);
              if (!task) continue;
              const chatId = task.channelId || ('@' + task.channelUsername.replace('@', '').trim());
              try {
                const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${input.telegramId}`);
                const data = await res.json();
                // If channel not found / bot not in channel, skip silently (don't penalize)
                if (!data.ok) continue;
                const status = data?.result?.status;
                const isMember = ['member', 'administrator', 'creator'].includes(status);
                if (!isMember) {
                  const pts = ct.pointsEarned;
                  const user = await getTelegramUser(input.telegramId);
                  if (user) {
                    const newBal = Math.max(0, (user.balance || 0) - pts);
                    await Promise.all([
                      removeUserTask(input.telegramId, ct.taskId),
                      upsertTelegramUser({ telegramId: input.telegramId, balance: newBal }),
                      createTransaction({ telegramId: input.telegramId, type: "task_penalty", points: -pts, metadata: JSON.stringify({ taskId: task.id, taskName: task.name }) }),
                    ]);
                    totalDeducted += pts;
                    left.push(task.name);
                  }
                }
              } catch {}
            }

            return { success: true, deducted: totalDeducted, left };
          }),

        // Admin: add task
        adminCreate: publicProcedure
          .input(z.object({
            secret: z.string(),
            name: z.string().min(1),
            description: z.string().optional(),
            channelUsername: z.string().min(1),
            channelId: z.string().optional(),
            type: z.enum(["channel", "bot"]).default("channel"),
            pointsMin: z.number().min(1).max(100).default(1),
            pointsMax: z.number().min(1).max(100).default(10),
          }))
          .mutation(async ({ input }) => {
            const adminSecret = process.env.ADMIN_SECRET || "";
            if (!safeCompareSecret(input.secret, adminSecret)) return { success: false };
            const task = await createTask({
              name: input.name,
              description: input.description ?? null,
              channelUsername: input.channelUsername,
              channelId: input.channelId ?? null,
              type: input.type,
              pointsMin: input.pointsMin,
              pointsMax: input.pointsMax,
            });
            return { success: true, task };
          }),

        // Admin: list all tasks
        adminList: publicProcedure
          .input(z.object({ secret: z.string() }))
          .query(async ({ input }) => {
            const adminSecret = process.env.ADMIN_SECRET || "";
            if (!safeCompareSecret(input.secret, adminSecret)) return { success: false, tasks: [] };
            const list = await getAllTasks();
            return { success: true, tasks: list };
          }),

        // Admin: delete task
        adminDelete: publicProcedure
          .input(z.object({ secret: z.string(), taskId: z.number() }))
          .mutation(async ({ input }) => {
            const adminSecret = process.env.ADMIN_SECRET || "";
            if (!safeCompareSecret(input.secret, adminSecret)) return { success: false };
            await deleteTask(input.taskId);
            return { success: true };
          }),
      }),
  
    leaderboard: router({
      get: publicProcedure
        .input(z.object({ telegramId: z.number().optional() }))
        .query(async ({ input }) => {
          const rows = await getLeaderboard(20);
          const myRank = input.telegramId
            ? rows.findIndex(r => r.telegramId === input.telegramId) + 1
            : 0;
          return { success: true, rows, myRank };
        }),
    }),

  codes: router({

    // Admin: create a new redeem code (optionally post to channel)
    create: publicProcedure
      .input(z.object({
        secret: z.string(),
        code: z.string().min(4).max(50),
        reward: z.number().int().positive(),
        maxUses: z.number().int().positive().default(100),
        expiresInHours: z.number().int().positive().default(24),
        postToChannel: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const adminSecret = process.env.ADMIN_SECRET || "";
        if (!adminSecret || input.secret !== adminSecret) return { success: false, message: "غير مصرح" };
        const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
        try {
          const created = await createRedeemCode(input.code, input.reward, input.maxUses, expiresAt);
          if (input.postToChannel) {
            postCodeToChannel(created.code, input.reward, input.expiresInHours, input.maxUses).catch(() => {});
          }
          return { success: true, code: created };
        } catch (err: any) {
          if (err?.message?.includes("unique") || err?.code === "23505") {
            return { success: false, message: "الكود موجود مسبقاً، جرّب كوداً مختلفاً" };
          }
          return { success: false, message: "خطأ في إنشاء الكود" };
        }
      }),

    // Admin: list all codes
    list: publicProcedure
      .input(z.object({ secret: z.string() }))
      .query(async ({ input }) => {
        const adminSecret = process.env.ADMIN_SECRET || "";
        if (!adminSecret || input.secret !== adminSecret) return { success: false, codes: [] };
        const codes = await getAllRedeemCodes();
        return { success: true, codes };
      }),

    // Admin: deactivate a code
    delete: publicProcedure
      .input(z.object({ secret: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const adminSecret = process.env.ADMIN_SECRET || "";
        if (!adminSecret || input.secret !== adminSecret) return { success: false };
        await deactivateRedeemCode(input.id);
        return { success: true };
      }),

    // Admin: post an existing active code to Telegram channel
    postToChannel: publicProcedure
      .input(z.object({
        secret: z.string(),
        code: z.string(),
        reward: z.number(),
        maxUses: z.number(),
        expiresAt: z.union([z.string(), z.date()]).transform(v => new Date(v)),
      }))
      .mutation(async ({ input }) => {
        const adminSecret = process.env.ADMIN_SECRET || "";
        if (!adminSecret || input.secret !== adminSecret) return { success: false, message: "غير مصرح" };
        const hoursLeft = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
        try {
          await postCodeToChannel(input.code, input.reward, hoursLeft, input.maxUses);
          return { success: true };
        } catch (err: any) {
          return { success: false, message: err?.message || "فشل الإرسال للقناة" };
        }
      }),

    // User: redeem a code
    redeem: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string(), code: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "غير مصرح" };

        const rc = await getRedeemCodeByCode(input.code.trim());
        if (!rc) return { success: false, message: "❌ الكود غير موجود" };
        if (!rc.isActive) return { success: false, message: "❌ هذا الكود غير نشط" };
        if (new Date() > new Date(rc.expiresAt)) return { success: false, message: "⏰ انتهت صلاحية الكود" };
        if (rc.usedCount >= rc.maxUses) return { success: false, message: "👥 اكتمل عدد المستخدمين لهذا الكود" };

        const alreadyUsed = await hasUserRedeemedCode(rc.id, input.telegramId);
        if (alreadyUsed) return { success: false, message: "✋ استخدمت هذا الكود من قبل" };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "المستخدم غير موجود" };

        const newBalance = Number(user.balance) + rc.reward;
        await Promise.all([
          upsertTelegramUser({ ...user, balance: newBalance, totalEarned: Number(user.totalEarned) + rc.reward }),
          createTransaction({ telegramId: input.telegramId, type: "redeem_code", points: rc.reward, metadata: JSON.stringify({ code: rc.code }) }),
          recordRedeemCodeUse(rc.id, input.telegramId),
        ]);

        if (rc.usedCount + 1 >= rc.maxUses) {
          deactivateRedeemCode(rc.id).catch(() => {});
        }

        return { success: true, message: `🎉 تهانينا! ربحت ${rc.reward.toLocaleString()} نقطة`, reward: rc.reward, balance: newBalance };
      }),
  }),

  });
