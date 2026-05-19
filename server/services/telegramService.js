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

const broadcastMessage = async (userIds, message) => {
  const results = { sent: 0, failed: 0 };
  
  for (const userId of userIds) {
    try {
      await sendMessage(userId, message);
      results.sent++;
      // Rate limit: 30 messages per second
      await new Promise(resolve => setTimeout(resolve, 35));
    } catch (error) {
      results.failed++;
    }
  }
  
  return results;
};

module.exports = { initBot, sendMessage, sendNotification, broadcastMessage };
