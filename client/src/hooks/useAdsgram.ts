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
  blockId: string;
  onReward?: () => void;
  onError?: (result: ShowPromiseResult) => void;
}

const ADSGRAM_SDK = "https://sad.adsgram.ai/js/adsgram-ad-sdk.js";

function loadAdsgramSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Adsgram) { resolve(); return; }
    const existing = document.getElementById("adsgram-sdk");
    if (existing) {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if ((window as any).Adsgram) { clearInterval(poll); resolve(); }
        else if (tries > 40) { clearInterval(poll); reject(new Error("Adsgram not ready")); }
      }, 200);
      return;
    }
    const s = document.createElement("script");
    s.id = "adsgram-sdk";
    s.src = ADSGRAM_SDK;
    s.async = true;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Adsgram SDK timeout")); }
    }, 8000);
    s.onload = () => {
      let tries = 0;
      const poll = setInterval(() => {
        tries++;
        if ((window as any).Adsgram) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; resolve(); }
        } else if (tries > 30) {
          clearInterval(poll); clearTimeout(timeout);
          if (!settled) { settled = true; reject(new Error("Adsgram not ready after load")); }
        }
      }, 200);
    };
    s.onerror = () => {
      clearTimeout(timeout);
      if (!settled) { settled = true; reject(new Error("Adsgram load failed")); }
    };
    document.head.appendChild(s);
  });
}

export function useAdsgram({ blockId, onReward, onError }: useAdsgramParams): () => Promise<void> {
  const AdControllerRef = useRef<AdController | undefined>(undefined);

  useEffect(() => {
    loadAdsgramSDK()
      .then(() => {
        if ((window as any).Adsgram) {
          AdControllerRef.current = (window as any).Adsgram.init({ blockId });
        }
      })
      .catch(() => {
        // SDK failed to load — will retry on show()
      });
  }, [blockId]);

  return useCallback(async () => {
    if (!AdControllerRef.current) {
      try {
        await loadAdsgramSDK();
        if ((window as any).Adsgram) {
          AdControllerRef.current = (window as any).Adsgram.init({ blockId });
        }
      } catch {
        onError?.({
          error: true,
          done: false,
          state: 'load',
          description: 'Adsgram script not loaded',
        });
        return;
      }
    }

    if (AdControllerRef.current) {
      AdControllerRef.current
        .show()
        .then((result: ShowPromiseResult) => {
          if (result.done) {
            onReward?.();
          } else {
            onError?.({
              ...result,
              error: true,
              description: result.description || 'Ad was closed before completing',
            });
          }
        })
        .catch((result: ShowPromiseResult) => {
          onError?.(result);
        });
    } else {
      onError?.({
        error: true,
        done: false,
        state: 'load',
        description: 'Adsgram script not loaded',
      });
    }
  }, [blockId, onError, onReward]);
}
