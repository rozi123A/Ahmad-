/**
 * FaucetPay Integration — Auto Payout for USDT (TRC-20)
 *
 * HOW TO ACTIVATE:
 *   1. Set FAUCETPAY_API_KEY in Render environment variables
 *   Done! USDT withdrawals will be sent automatically on approval.
 *
 * NOTE: FaucetPay does not support TON — TON withdrawals fall back to manual admin notification.
 * If FAUCETPAY_API_KEY is not set, all payouts fall back to manual.
 */

const FAUCETPAY_BASE_URL = "https://faucetpay.io/api/v1";

export interface FostpayPayoutResult {
  success: boolean;
  txHash?: string;
  error?: string;
  fallbackToManual?: boolean;
}

function getFaucetPayConfig() {
  const apiKey = process.env.FAUCETPAY_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

export function isFostpayEnabled(): boolean {
  return !!process.env.FAUCETPAY_API_KEY;
}

/**
 * TON is NOT supported by FaucetPay — always falls back to manual admin payout.
 */
export async function fostpaySendTon(
  _toWallet: string,
  _amount: number,
  _memo?: string
): Promise<FostpayPayoutResult> {
  return {
    success: false,
    fallbackToManual: true,
    error: "TON غير مدعوم من FaucetPay — يلزم إرسال يدوي",
  };
}

/**
 * Send USDT (TRC-20) automatically via FaucetPay API
 * Docs: https://faucetpay.io/page/merchant-api
 */
export async function fostpaySendUsdt(
  toWallet: string,
  amount: number,
  memo?: string
): Promise<FostpayPayoutResult> {
  const config = getFaucetPayConfig();
  if (!config) {
    return { success: false, fallbackToManual: true, error: "FAUCETPAY_API_KEY not configured" };
  }

  try {
    const params = new URLSearchParams({
      api_key: config.apiKey,
      to: toWallet,
      amount: String(Math.round(amount * 100) / 100),
      currency: "USDT",
    });
    if (memo) params.append("referral", memo.slice(0, 50));

    const res = await fetch(`${FAUCETPAY_BASE_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json() as any;

    if (data.status === 200) {
      return {
        success: true,
        txHash: data.payment_id ? String(data.payment_id) : (data.payout_user_hash || ""),
      };
    }

    return {
      success: false,
      error: data.message || `FaucetPay error: status ${data.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Check FaucetPay USDT balance
 */
export async function fostpayGetBalance(): Promise<{ ton: number; usdt: number } | null> {
  const config = getFaucetPayConfig();
  if (!config) return null;

  try {
    const params = new URLSearchParams({ api_key: config.apiKey, currency: "USDT" });
    const res = await fetch(`${FAUCETPAY_BASE_URL}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json() as any;
    if (data.status === 200) {
      return { ton: 0, usdt: Number(data.balance || 0) };
    }
    return null;
  } catch {
    return null;
  }
}
