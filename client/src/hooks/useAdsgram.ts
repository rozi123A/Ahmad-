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

export function useAdsgram({ blockId, onReward, onError }: useAdsgramParams): () => Promise<void> {
  const AdControllerRef = useRef<AdController | undefined>(undefined);

  useEffect(() => {
    if ((window as any).Adsgram) {
      AdControllerRef.current = (window as any).Adsgram.init({ blockId });
    }
  }, [blockId]);

  return useCallback(async () => {
    if (AdControllerRef.current) {
      AdControllerRef.current
        .show()
        .then((result: ShowPromiseResult) => {
          if (result.done) {
            onReward?.();
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
  }, [onError, onReward]);
}
