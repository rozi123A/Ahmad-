const TelegramBot = require('node-telegram-bot-api');

let bot = null;

const initBot = () => {
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token') {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram Bot initialized');
  }
  return bot;
};

const sendMessage = async (chatId, message, options = {}) => {
  if (!bot) return null;
  try {
    return await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...options
    });
  } catch (error) {
    console.error('Telegram send error:', error.message);
    return null;
  }
};

const sendNotification = async (telegramId, title, message) => {
  const text = `🔔 <b>${title}</b>\n\n${message}`;
  return await sendMessage(telegramId, text);
};

// Send referral notification with open app button
const sendReferralNotification = async (referrerTelegramId, newUser) => {
  const firstName = newUser.firstName || '';
  const lastName = newUser.lastName || '';
  const username = newUser.username ? ` @${newUser.username}` : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const appUrl = process.env.CLIENT_URL || '';
  const botUsername = process.env.BOT_USERNAME || process.env.TELEGRAM_BOT || '';

  const text = `🎉 <b>مبروك! انضم ${fullName}${username} عبر رابطك!</b>\n\n🎁 لديك <b>100 نقطة</b> في انتظارك\n👆 افتح التطبيق لتحصل على نقاطك!`;

  const options = {};
  if (appUrl || botUsername) {
    const webUrl = appUrl || `https://t.me/${botUsername}`;
    options.reply_markup = {
      inline_keyboard: [[
        { text: '🚀 افتح التطبيق', web_app: { url: webUrl } }
      ]]
    };
  }

  return await sendMessage(referrerTelegramId, text, options);
};

const broadcastMessage = async (userIds, message) => {
  const results = { sent: 0, failed: 0 };
  for (const userId of userIds) {
    try {
      await sendMessage(userId, message);
      results.sent++;
      await new Promise(resolve => setTimeout(resolve, 35));
    } catch (error) {
      results.failed++;
    }
  }
  return results;
};

module.exports = { initBot, sendMessage, sendNotification, sendReferralNotification, broadcastMessage };
