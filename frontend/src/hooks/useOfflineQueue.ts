import { useEffect, useRef } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useOfflineStore } from '@/stores/offlineStore';
import { apiClient } from '@/api/client';

/**
 * Initializes the offline queue on mount, and replays queued mutations
 * when the browser comes back online. Integrates with TanStack Query's
 * onlineManager so paused mutations are resumed automatically.
 *
 * Mount this once near the app root (e.g., in App.tsx).
 */
export function useOfflineQueue() {
  const replayingRef = useRef(false);

  // Initialize the offline store (loads from IndexedDB)
  useEffect(() => {
    useOfflineStore.getState().init();
  }, []);

  // Wire up TanStack Query's onlineManager to browser events
  useEffect(() => {
    const setOnline = () => onlineManager.setOnline(true);
    const setOffline = () => onlineManager.setOnline(false);

    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    // Set initial state
    onlineManager.setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  // Replay queued mutations when online
  useEffect(() => {
    async function replay() {
      if (replayingRef.current) return;
      replayingRef.current = true;

      const store = useOfflineStore.getState();
      let mutation = store.peek();

      while (mutation && navigator.onLine) {
        try {
          await apiClient(mutation.endpoint, {
            method: mutation.method,
            body: mutation.body,
          });
          await store.dequeue();
        } catch (err) {
          // If the replay fails, stop and leave remaining items in queue.
          // The user will be notified about conflicts via the UI.
          console.error('[OfflineQueue] Replay failed for', mutation.endpoint, err);
          break;
        }
        mutation = useOfflineStore.getState().peek();
      }

      replayingRef.current = false;
    }

    const handleOnline = () => {
      replay();
    };

    window.addEventListener('online', handleOnline);

    // Also attempt replay on mount if already online and queue has items
    if (navigator.onLine && useOfflineStore.getState().queue.length > 0) {
      replay();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
