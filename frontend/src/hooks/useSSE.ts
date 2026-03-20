import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const BASE_URL = import.meta.env.VITE_GATEWAY_URL ?? '';
const API_PREFIX = '/api/v1';

export interface SSEHandlers {
  onToken?: (text: string) => void;
  onStatus?: (status: string) => void;
  onComplete?: (data: unknown) => void;
  onFailed?: (data: unknown) => void;
  onError?: (error: Event) => void;
}

/**
 * Generic SSE hook. Creates an EventSource when `url` is non-null,
 * tears it down on unmount or when url changes.
 *
 * @param url - Relative API path (e.g., `/ingest/jobs/{id}/stream`).
 *              Pass null/undefined to keep the connection closed.
 * @param handlers - Callbacks for each SSE event type.
 */
export function useSSE(url: string | null | undefined, handlers: SSEHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const eventSourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!url) {
      close();
      return;
    }

    // EventSource does not support custom headers natively.
    // Append token as query param for SSE auth.
    const token = useAuthStore.getState().token;
    const fullUrl = new URL(`${BASE_URL}${API_PREFIX}${url}`);
    if (token) {
      fullUrl.searchParams.set('token', token);
    }

    const es = new EventSource(fullUrl.toString());
    eventSourceRef.current = es;

    es.addEventListener('token', (e: MessageEvent) => {
      handlersRef.current.onToken?.(e.data);
    });

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        handlersRef.current.onStatus?.(parsed.status ?? e.data);
      } catch {
        handlersRef.current.onStatus?.(e.data);
      }
    });

    es.addEventListener('complete', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        handlersRef.current.onComplete?.(parsed);
      } catch {
        handlersRef.current.onComplete?.(e.data);
      }
      // Stream is done after complete
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        handlersRef.current.onFailed?.(parsed);
      } catch {
        handlersRef.current.onFailed?.(e.data);
      }
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = (e: Event) => {
      handlersRef.current.onError?.(e);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [url, close]);

  return { close };
}
