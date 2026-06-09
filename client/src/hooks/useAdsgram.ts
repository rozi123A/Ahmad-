import { useCallback, useEffect, useRef } from 'react';

  export interface ShowPromiseResult {
    done: boolean;
    description: string;
    state: 'load' | 'render' | 'playing' | 'destroy';
    error: boolean;
  }
  export interface AdController {
    show: () => Promise<ShowPromiseResult>;
  }
  export interface useAdsgramParams {
    blockId?: string;
    telegramId?: number | string;
    onReward?: () => void;
    onError?: (result: ShowPromiseResult) => void;
    onPending?: () => void;
  }

  // ✅ Block ID الرسمي الخاص بك
  // يقرأ من VITE_ADSGRAM_BLOCK_ID (يجب أن يبدأ بـ VITE_ ليصل إلى الفرونت)
  // مع fallback آمن إلى "34660" في حال لم يُعرَّف المتغير
  const ADSGRAM_BLOCK_ID =
    (import.meta as any).env?.VITE_ADSGRAM_BLOCK_ID || "34660";
  // ✅ رابط SDK الرسمي
  const ADSGRAM_SDK_URL = "https://sad.adsgram.ai/js/adsgram-ad-sdk.js";
  // ✅ رابط التحقق من المكافأة (Reward URL) — يجب أن يحتوي على [userId]
  const VERIFY_BASE_URL =
    (import.meta as any).env?.VITE_REWARD_VERIFY_URL ||
    (import.meta as any).env?.VITE_WEBAPP_URL ||
    "https://earn-money-jufo.onrender.com/";

  let _sdkPromise: Promise<void> | null = null;

  /** كشف حالة "الحساب قيد المراجعة" */
  function isPendingAccountError(description: string): boolean {
    const lower = (description || "").toLowerCase();
    return (
      lower.includes("no ads") ||
      lower.includes("no fill") ||
      lower.includes("no campaigns") ||
      lower.includes("block not found") ||
      lower.includes("not found") ||
      lower.includes("not active") ||
      lower.includes("pending") ||
      lower.includes("created") ||
      lower.includes("under review") ||
      lower.includes("disabled")
    );
  }

  /** إرسال طلب التحقق من المكافأة للسيرفر */
  async function sendRewardVerification(userId: number | string): Promise<void> {
    try {
      await fetch(`${VERIFY_BASE_URL}?user_id=${userId}`, {
        method: 'GET',
        mode: 'no-cors',
      });
      console.log('[Adsgram] ✅ Reward verification sent for user:', userId);
    } catch (err) {
      console.warn('[Adsgram] ⚠️ Reward verification request failed (non-critical):', err);
    }
  }

  function loadAdsgramSDK(): Promise<void> {
    if (_sdkPromise) return _sdkPromise;
    _sdkPromise = new Promise<void>((resolve, reject) => {
      if ((window as any).Adsgram) {
        console.log('[Adsgram] SDK already present ✅');
        resolve();
        return;
      }
      console.log('[Adsgram] Loading SDK from:', ADSGRAM_SDK_URL);
      document.getElementById('adsgram-sdk')?.remove();
      const script = document.createElement('script');
      script.id = 'adsgram-sdk';
      script.src = ADSGRAM_SDK_URL;
      script.async = true;
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        _sdkPromise = null;
        console.error('[Adsgram] SDK load timeout ❌');
        reject(new Error('Adsgram SDK timeout after 12s'));
      }, 12000);

      script.onload = () => {
        let tries = 0;
        const poll = setInterval(() => {
          tries++;
          if ((window as any).Adsgram) {
            clearInterval(poll);
            clearTimeout(timeout);
            if (!settled) {
              settled = true;
              console.log('[Adsgram] SDK ready ✅');
              resolve();
            }
          } else if (tries > 60) {
            clearInterval(poll);
            clearTimeout(timeout);
            if (!settled) {
              settled = true;
              _sdkPromise = null;
              console.error('[Adsgram] window.Adsgram missing after load ❌');
              reject(new Error('window.Adsgram not found after script loaded'));
            }
          }
        }, 200);
      };

      script.onerror = () => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          _sdkPromise = null;
          console.error('[Adsgram] Script load failed ❌');
          reject(new Error('Failed to load Adsgram SDK from: ' + ADSGRAM_SDK_URL));
        }
      };

      document.head.appendChild(script);
    });
    return _sdkPromise;
  }

  export function useAdsgram({
    blockId,
    telegramId,
    onReward,
    onError,
    onPending,
  }: useAdsgramParams): () => Promise<void> {
    const controllerRef = useRef<AdController | undefined>(undefined);
    const unitId = blockId || ADSGRAM_BLOCK_ID;

    // تحميل مسبق عند mount لتسريع ظهور الإعلان
    useEffect(() => {
      console.log('[Adsgram] Pre-loading — Block ID:', unitId);
      loadAdsgramSDK()
        .then(() => {
          controllerRef.current = (window as any).Adsgram.init({ blockId: unitId });
          console.log('[Adsgram] Controller pre-initialized ✅');
        })
        .catch((err: Error) => {
          console.warn('[Adsgram] Pre-load skipped (will retry on show):', err.message);
        });
    }, [unitId]);

    return useCallback(async () => {
      console.log('[Adsgram] show() — Block ID:', unitId);

      // إعادة تهيئة إذا لم يكن Controller جاهزاً
      if (!controllerRef.current) {
        try {
          await loadAdsgramSDK();
          controllerRef.current = (window as any).Adsgram.init({ blockId: unitId });
        } catch (err: any) {
          console.error('[Adsgram] Init failed:', err.message);
          if (isPendingAccountError(err.message)) {
            console.warn('[Adsgram] Account pending review');
            onPending?.();
          } else {
            onError?.({ error: true, done: false, state: 'load', description: err.message });
          }
          return;
        }
      }

      try {
        const result: ShowPromiseResult = await controllerRef.current!.show();
        console.log('[Adsgram] Result:', JSON.stringify(result));

        if (result.done) {
          // ✅ شاهد الإعلان بالكامل → مكافأة
          console.log('[Adsgram] ✅ Ad completed — rewarding user');
          if (telegramId) await sendRewardVerification(telegramId);
          onReward?.();
        } else if (result.error) {
          // ❌ خطأ في تحميل/عرض الإعلان
          if (isPendingAccountError(result.description)) {
            console.warn('[Adsgram] Account pending review — description:', result.description);
            onPending?.();
          } else {
            console.warn('[Adsgram] Ad error — state:', result.state, '| desc:', result.description);
            onError?.(result);
          }
        } else {
          // ⚠️ المستخدم أغلق الإعلان مبكراً
          console.warn('[Adsgram] User closed ad early — no reward');
          onError?.({
            ...result,
            error: true,
            description: 'يجب مشاهدة الإعلان بالكامل للحصول على المكافأة',
          });
        }
      } catch (thrown: any) {
        console.error('[Adsgram] show() threw:', thrown);
        const desc: string =
          typeof thrown?.description === 'string'
            ? thrown.description
            : thrown?.message ?? String(thrown);

        if (isPendingAccountError(desc)) {
          console.warn('[Adsgram] Account pending review (caught)');
          onPending?.();
        } else if (thrown && typeof thrown === 'object' && 'error' in thrown) {
          onError?.(thrown as ShowPromiseResult);
        } else {
          onError?.({
            error: true,
            done: false,
            state: 'destroy',
            description: 'خطأ في Adsgram: ' + desc,
          });
        }
      }
    }, [unitId, telegramId, onReward, onError, onPending]);
  }
  