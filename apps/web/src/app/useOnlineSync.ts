import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * Flushes the offline attempt queue to the backend (FR-42) whenever the app comes online and once
 * every few minutes while it stays online. A no-op with no VITE_API_URL or while signed out of the
 * backend — the queue then simply keeps growing locally, exactly as before this feature existed.
 */
export function useOnlineSync() {
  const flushQueue = useStore((s) => s.flushQueue);

  useEffect(() => {
    void flushQueue();
    const onOnline = () => void flushQueue();
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => void flushQueue(), 3 * 60_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [flushQueue]);
}
