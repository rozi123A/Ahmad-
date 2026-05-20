/**
 * Ads Service - Server-side session tracking to prevent fake ad completions
 */

// In-memory store: sessionToken -> startTimestamp
const adSessions = new Map();

// Clean expired sessions every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, ts] of adSessions) {
    if (ts < cutoff) adSessions.delete(key);
  }
}, 10 * 60 * 1000);

class AdsService {
  constructor() {
    this.provider = process.env.ADS_PROVIDER || 'adsgram';
    this.apiKey = process.env.ADS_API_KEY;
    this.apiUrl = process.env.ADS_API_URL;
    this.pointsPerAd = 10;
    this.dailyLimit = 50;
    this.spinAdDailyLimit = 5;
    this.MIN_WATCH_SECONDS = 13; // 15s ad with 2s tolerance
  }

  // Generate a session token when user starts watching
  startSession(telegramId) {
    const token = `${telegramId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    adSessions.set(token, Date.now());
    return token;
  }

  async verifyAdCompletion(adId, telegramId, watchDuration, sessionToken) {
    // Primary check: server-side elapsed time via session token
    if (sessionToken && adSessions.has(sessionToken)) {
      const startTime = adSessions.get(sessionToken);
      const serverElapsed = (Date.now() - startTime) / 1000;
      adSessions.delete(sessionToken); // one-time use

      if (serverElapsed < this.MIN_WATCH_SECONDS) {
        console.warn(`Ad fraud attempt by ${telegramId}: ${Math.round(serverElapsed)}s elapsed`);
        return { valid: false, reason: 'Ad not watched completely' };
      }
      return { valid: true, points: this.pointsPerAd };
    }

    // Fallback: check client-reported duration (less secure but better than nothing)
    if (!watchDuration || watchDuration < this.MIN_WATCH_SECONDS) {
      return { valid: false, reason: 'Ad not watched completely' };
    }

    return { valid: true, points: this.pointsPerAd };
  }

  async getAdUnit(userId, type = 'rewarded') {
    return {
      provider: this.provider,
      type,
      blockId: this.apiKey || 'configure-in-env',
      minWatchDuration: 15,
    };
  }

  getDailyLimit() { return this.dailyLimit; }
  getSpinAdDailyLimit() { return this.spinAdDailyLimit; }
  getPointsPerAd() { return this.pointsPerAd; }
}

module.exports = new AdsService();
