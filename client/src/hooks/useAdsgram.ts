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
  onReward?: () => void;
  onError?: (result: ShowPromiseResult) => void;
}

const ADSGRAM_SDK_URL = "https://sad.adsgram.ai/js/adsgram-ad-sdk.js";
const ADSGRAM_UNIT_ID = "34059";

let _sdkPromise: Promise<void> | null = null;

function loadAdsgramSDK(): Promise<void> {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Adsgram) {
      console.log('[Adsgram] SDK already present ✅');
      resolve(); return;
    }
    console.log('[Adsgram] Loading SDK:', ADSGRAM_SDK_URL);
    document.getElementById('adsgram-sdk')?.remove();
    const script = document.createElement('script');
    script.id = 'adsgram-sdk';
    script.src = ADSGRAM_SDK_URL;
    script.async = true;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true; _sdkPromise = null;
      console.error('[Adsgram] SDK timeout ❌');
      reject(new Error('Adsgram SDK timeout after 10s'));
    }, 10000);
    script.onload = () => {
      console.log('[Adsgram] Script tag loaded, polling window.Adsgram...');
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if ((window as any).Adsgram) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; console.log('[Adsgram] SDK ready ✅'); resolve(); }
        } else if (tries > 50) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) {
            settled = true; _sdkPromise = null;
            console.error('[Adsgram] window.Adsgram missing after load ❌');
            reject(new Error('window.Adsgram not found after script loaded'));
          }
        }
      }, 200);
    };
    script.onerror = (e) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true; _sdkPromise = null;
        console.error('[Adsgram] Script load failed ❌', e);
        reject(new Error('Failed to load: ' + ADSGRAM_SDK_URL));
      }
    };
    document.head.appendChild(script);
  });
  return _sdkPromise;
}

export function useAdsgram({ blockId, onReward, onError }: useAdsgramParams): () => Promise<void> {
  const controllerRef = useRef<AdController | undefined>(undefined);
  const unitId = blockId || ADSGRAM_UNIT_ID;

  useEffect(() => {
    console.log('[Adsgram] Mount — Unit ID:', unitId);
    loadAdsgramSDK()
      .then(() => {
        controllerRef.current = (window as any).Adsgram.init({ blockId: unitId });
        console.log('[Adsgram] Controller pre-initialized ✅');
      })
      .catch((err: Error) => {
        console.warn('[Adsgram] Pre-load failed (will retry on show):', err.message);
      });
  }, [unitId]);

  return useCallback(async () => {
    console.log('[Adsgram] show() — Unit ID:', unitId);
    if (!controllerRef.current) {
      console.log('[Adsgram] Controller not ready — initializing...');
      try {
        await loadAdsgramSDK();
        controllerRef.current = (window as any).Adsgram.init({ blockId: unitId });
        console.log('[Adsgram] Controller initialized on demand ✅');
      } catch (err: any) {
        console.error('[Adsgram] Init failed:', err.message);
        onError?.({ error: true, done: false, state: 'load', description: err.message });
        return;
      }
    }
    try {
      console.log('[Adsgram] Calling controller.show()...');
      const result: ShowPromiseResult = await controllerRef.current!.show();
      console.log('[Adsgram] Result:', JSON.stringify(result));
      if (result.done) {
        console.log('[Adsgram] ✅ Ad completed — awarding reward');
        onReward?.();
      } else if (result.error) {
        console.warn('[Adsgram] ❌ Ad error — state:', result.state, 'desc:', result.description);
        onError?.({ ...result, error: true });
      } else {
        console.warn('[Adsgram] ⚠️ Ad closed early by user — no reward');
        onError?.({ ...result, error: true, description: 'يجب مشاهدة الإعلان بالكامل للحصول على المكافأة' });
      }
    } catch (thrown: any) {
      console.error('[Adsgram] show() threw:', thrown);
      if (thrown && typeof thrown === 'object' && 'error' in thrown) {
        onError?.(thrown as ShowPromiseResult);
      } else {
        onError?.({ error: true, done: false, state: 'destroy', description: 'خطأ في Adsgram: ' + (thrown?.message ?? String(thrown)) });
      }
    }
  }, [unitId, onReward, onError]);
}
