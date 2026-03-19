import { create } from 'zustand';
import { openDB, type IDBPDatabase } from 'idb';

export interface OfflineMutation {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  timestamp: number;
}

interface OfflineState {
  queue: OfflineMutation[];
  isReady: boolean;
  init: () => Promise<void>;
  enqueue: (mutation: Omit<OfflineMutation, 'id' | 'timestamp'>) => Promise<void>;
  dequeue: () => Promise<OfflineMutation | undefined>;
  peek: () => OfflineMutation | undefined;
  clear: () => Promise<void>;
}

const DB_NAME = 'dialed-offline';
const STORE_NAME = 'mutations';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const useOfflineStore = create<OfflineState>()((set, get) => ({
  queue: [],
  isReady: false,

  init: async () => {
    try {
      const db = await getDb();
      const all = await db.getAll(STORE_NAME);
      const sorted = (all as OfflineMutation[]).sort(
        (a, b) => a.timestamp - b.timestamp,
      );
      set({ queue: sorted, isReady: true });
    } catch {
      // IndexedDB not available (SSR, test env, etc.)
      set({ queue: [], isReady: true });
    }
  },

  enqueue: async (mutation) => {
    const entry: OfflineMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    try {
      const db = await getDb();
      await db.put(STORE_NAME, entry);
    } catch {
      // IndexedDB not available
    }
    set((state) => ({ queue: [...state.queue, entry] }));
  },

  dequeue: async () => {
    const { queue } = get();
    if (queue.length === 0) return undefined;
    const [first, ...rest] = queue;
    try {
      const db = await getDb();
      await db.delete(STORE_NAME, first.id);
    } catch {
      // IndexedDB not available
    }
    set({ queue: rest });
    return first;
  },

  peek: () => {
    const { queue } = get();
    return queue[0];
  },

  clear: async () => {
    try {
      const db = await getDb();
      await db.clear(STORE_NAME);
    } catch {
      // IndexedDB not available
    }
    set({ queue: [] });
  },
}));
