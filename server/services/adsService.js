/**
 * Ads Service - Independent module for Rewarded Ads
 * Ready to integrate with Adsgram or any other ad provider
 */

class AdsService {
  constructor() {
    this.provider = process.env.ADS_PROVIDER || 'adsgram';
    this.apiKey = process.env.ADS_API_KEY;
    this.apiUrl = process.env.ADS_API_URL;
    this.pointsPerAd = 10;
    this.dailyLimit = 50;
    this.spinAdDailyLimit = 5;
  }

  async verifyAdCompletion(adId, userId, watchDuration) {
    // Verify that the ad was watched completely
    // Minimum watch duration is 15 seconds for a valid ad view
    const MIN_WATCH_DURATION = 15;
    
    if (watchDuration < MIN_WATCH_DURATION) {
      return { valid: false, reason: 'Ad not watched completely' };
    }

    // In production, verify with ad provider API
    if (this.apiKey && this.apiUrl) {
      try {
        // Verify with provider
        // const response = await fetch(`${this.apiUrl}/verify`, {
        //   method: 'POST',
        //   headers: { 'Authorization': `Bearer ${this.apiKey}` },
        //   body: JSON.stringify({ adId, userId })
        // });
        // return await response.json();
      } catch (error) {
        console.error('Ad verification error:', error);
      }
    }

    return { valid: true, points: this.pointsPerAd };
  }

  async getAdUnit(userId, type = 'rewarded') {
    // Return ad configuration for the client
    return {
      provider: this.provider,
      type: type,
      blockId: this.apiKey || 'configure-in-env',
      minWatchDuration: 15,
    };
  }

  getDailyLimit() {
    return this.dailyLimit;
  }

  getSpinAdDailyLimit() {
    return this.spinAdDailyLimit;
  }

  getPointsPerAd() {
    return this.pointsPerAd;
  }
}

module.exports = new AdsService();
