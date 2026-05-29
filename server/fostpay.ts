/**
 * Fostpay Integration — Auto Payout for TON & USDT
 *
 * HOW TO ACTIVATE:
 *   1. Set FOSTPAY_API_KEY in your environment variables
 *   2. Set FOSTPAY_WALLET_TON  — your TON wallet address (source)
 *   3. Set FOSTPAY_WALLET_USDT — your USDT (TRC-20) wallet address (source)
 *   Done! Payouts will be sent automatically on withdrawal approval.
 *
 * If FOSTPAY_API_KEY is not set, the system falls back to manual admin notification.
 */

const FOSTPAY_BASE_URL = "https://api.fostpay.io/v1"; // Update if Fostpay gives a different URL

export interface FostpayPayoutResult {
  success: boolean;
  txHash?: string;
  error?: string;
  fallbackToManual?: boolean;
}

function getFostpayConfig() {
  const apiKey = process.env.FOSTPAY_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    walletTon: process.env.FOSTPAY_WALLET_TON || "",
    walletUsdt: process.env.FOSTPAY_WALLET_USDT || "",
  };
}

export function isFostpayEnabled(): boolean {
  return !!process.env.FOSTPAY_API_KEY;
}

/**
 * Send TON automatically to a user's wallet via Fostpay
 */
export async function fostpaySendTon(
  toWallet: string,
  amount: number, // in TON (e.g. 0.05)
  memo?: string
): Promise<FostpayPayoutResult> {
  const config = getFostpayConfig();
  if (!config) {
    return { success: false, fallbackToManual: true, error: "FOSTPAY_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${FOSTPAY_BASE_URL}/payout/ton`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        to: toWallet,
        amount: amount.toFixed(4),
        currency: "TON",
        memo: memo || "Reward withdrawal",
        from_wallet: config.walletTon || undefined,
      }),
    });

    const data = await res.json() as any;

    if (res.ok && data.success !== false) {
      return {
        success: true,
        txHash: data.tx_hash || data.txHash || data.transaction_id || "",
      };
    }

    return {
      success: false,
      error: data.message || data.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Send USDT (TRC-20) automatically to a user's wallet via Fostpay
 */
export async function fostpaySendUsdt(
  toWallet: string,
  amount: number, // in USDT (e.g. 0.05)
  memo?: string
): Promise<FostpayPayoutResult> {
  const config = getFostpayConfig();
  if (!config) {
    return { success: false, fallbackToManual: true, error: "FOSTPAY_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${FOSTPAY_BASE_URL}/payout/usdt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        to: toWallet,
        amount: amount.toFixed(4),
        currency: "USDT",
        network: "TRC20",
        memo: memo || "Reward withdrawal",
        from_wallet: config.walletUsdt || undefined,
      }),
    });

    const data = await res.json() as any;

    if (res.ok && data.success !== false) {
      return {
        success: true,
        txHash: data.tx_hash || data.txHash || data.transaction_id || "",
      };
    }

    return {
      success: false,
      error: data.message || data.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

/**
 * Check Fostpay wallet balance (to verify funds before payout)
 */
export async function fostpayGetBalance(): Promise<{ ton: number; usdt: number } | null> {
  const config = getFostpayConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${FOSTPAY_BASE_URL}/wallet/balance`, {
      headers: { "Authorization": `Bearer ${config.apiKey}` },
    });
    const data = await res.json() as any;
    return {
      ton: Number(data.ton || data.TON || 0),
      usdt: Number(data.usdt || data.USDT || 0),
    };
  } catch {
    return null;
  }
}
